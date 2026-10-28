// Los feriados de la tabla en las Notas Digitales y los recordatorios (spec 2026-10-27-feriados-en-notas), sobre una base de
// prueba con la precarga de database/updates/migracion-feriados-datos.sql tal cual, más Mailpit. Ningún test escribe en
// `feriados`: la precarga es la de producción, y conLaTablaRenombrada la devuelve igual.
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, correrSqlEnBaseDePrueba, cerrarDb, query, mailpit, paraCasilla } from './helpers.js';
import { limpiarBase, configurarNotas, asegurarBaseDePrueba } from './notas-fixtures.js';
import { pngRgba } from './firma-fixtures.js';
import { FILAS_PRECARGA } from './fixtures/feriados-precarga.js';
import { MENSAJE_CORRIDA_SIN_FERIADOS } from '../services/feriadosReglas.js';
import { CALENDARIO_FIJO } from '../services/notasDigitalesCalendario.js';

const FIRMA = pngRgba({ ancho: 40, alto: 20 });
let base, dbReal, feriadosDatos, motor, avisos, auditoria, controlador;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_feriados_en_notas');
  await correrSqlEnBaseDePrueba(base.nombre, 'database/updates/migracion-feriados-datos.sql');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba
  feriadosDatos = await import('../services/feriadosDatos.js');
  motor = await import('../services/notasDigitales.js');
  avisos = await import('../services/avisosDiariosService.js');
  auditoria = await import('../services/auditoriaService.js');
  controlador = await import('../controllers/notificacionesController.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

// usuarios_auditoria va antes que usuarios: su clave foránea a usuarios no tiene ON DELETE
beforeEach(async () => {
  process.env.EMAIL_SOLO_A = '';
  await limpiarBase();
  // Sin firmante titular: el de un test anterior ya no existe (los usuarios se borran)
  await configurarNotas({ firmante_usuario_id: null });
  await query('DELETE FROM usuarios_auditoria');
  await query('DELETE FROM cambios_pendientes');
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios_firmas');
  await query('DELETE FROM usuarios');
  await mailpit.vaciar();
});

// Un usuario de prueba con su firma (como en tests/notas-licencias.test.js)
const crearUsuario = async (rol, { conFirma = true } = {}) => {
  const username = `t_${rol}_${crypto.randomBytes(3).toString('hex')}`;
  const email = `${username}@rpad.test`;
  const r = await query(
    "INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES (?, 'x', ?, ?, ?, 1)",
    [username, `Persona ${rol}`, email, rol]
  );
  if (conFirma) {
    await query("INSERT INTO usuarios_firmas (usuario_id, nombre, cargo, imagen, mime) VALUES (?, ?, ?, ?, 'image/png')",
      [r.insertId, `Firma ${rol}`, `Cargo ${rol}`, FIRMA]);
  }
  return { id: r.insertId, email };
};

// Una licencia de Configuración, con o sin persona autorizada (como en tests/notas-licencias.test.js)
const licencia = async (usuario, desde, hasta, autorizadoDe = null) => (await query(
  'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, autorizado_id, autorizado_at) VALUES (?, ?, ?, ?, ?)',
  [usuario.id, desde, hasta, autorizadoDe?.id ?? null, autorizadoDe ? '2026-11-20 10:00:00' : null]
)).insertId;

// Un cambio pendiente propuesto hace `haceMinutos` minutos (como en tests/avisos-diarios.test.js) o, con `creado`
// ('AAAA-MM-DD HH:MM:SS' en hora argentina), en ese momento. created_at es TIMESTAMP: el instante va con FROM_UNIXTIME, así no
// depende de la zona de la base
const proponerCambio = async (usuarioId, titulo, { haceMinutos = 120, creado } = {}) => {
  const datos = JSON.stringify({ titulo });
  const resultado = creado === undefined
    ? await query(
      `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id, created_at)
       VALUES ('crear', NULL, ?, ?, NOW() - INTERVAL ? MINUTE)`,
      [datos, usuarioId, haceMinutos]
    )
    : await query(
      `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id, created_at)
       VALUES ('crear', NULL, ?, ?, FROM_UNIXTIME(?))`,
      [datos, usuarioId, Date.parse(`${creado.replace(' ', 'T')}-03:00`) / 1000]
    );
  return resultado.insertId;
};

// Mientras corre fn, la tabla `feriados` no se puede leer (se renombra); al terminar vuelve, también si fn tira
const conLaTablaRenombrada = async (fn) => {
  await asegurarBaseDePrueba();
  await query('RENAME TABLE feriados TO feriados_sin_leer');
  try {
    return await fn();
  } finally {
    await query('RENAME TABLE feriados_sin_leer TO feriados');
  }
};

describe('la precarga de las fixtures es la de migracion-feriados-datos.sql', () => {
  it('las 28 filas, en orden, con id de 1 a 28, activas, sin baja desde un año y sin años que no rigen', async () => {
    assert.deepEqual(await feriadosDatos.filasDeFeriados(), FILAS_PRECARGA);
  });
});

describe('leerCalendario con la precarga', () => {
  it('lee la tabla: el 02/11/2026 no es hábil y el 03/11 sí', async () => {
    const calendario = await feriadosDatos.leerCalendario();
    assert.equal(calendario.origen, 'tabla');
    assert.equal(calendario.error, null);
    assert.equal(calendario.esDiaHabil('2026-11-02'), false);
    assert.equal(calendario.esDiaHabil('2026-11-03'), true);
    assert.ok(Object.isFrozen(calendario));
  });

  it('con la tabla renombrada cae a los 9 fijos, con el error, sin tirar', async () => {
    const consola = mock.method(console, 'error', () => {});
    try {
      const calendario = await conLaTablaRenombrada(() => feriadosDatos.leerCalendario());
      assert.equal(calendario.origen, 'fijos');
      assert.match(calendario.error, /feriados/);
      assert.equal(calendario.esDiaHabil('2026-11-02'), true);
      assert.ok(Object.isFrozen(calendario));
      // El error queda en la consola
      assert.equal(consola.mock.callCount(), 1);
      assert.match(consola.mock.calls[0].arguments.map(String).join(' '), /feriados/);
    } finally {
      consola.mock.restore();
    }
    // La tabla volvió: se lee otra vez
    assert.equal((await feriadosDatos.leerCalendario()).origen, 'tabla');
  });
});

// Una respuesta de Express falsa, que guarda el status y el cuerpo
const respuestaFalsa = () => ({
  statusCode: null, body: null,
  status(codigo) { this.statusCode = codigo; return this; },
  json(cuerpo) { this.body = cuerpo; return this; }
});

// El controlador de la corrida de las 14:00 (nunca /api/cron/*) con el reloj en un momento fijo; devuelve la respuesta
const corridaDeLas14 = async (momento) => {
  const res = respuestaFalsa();
  mock.timers.enable({ apis: ['Date'], now: new Date(momento) });
  try {
    await controlador.ejecutarNotificacionCambiosPendientes({}, res);
  } finally {
    mock.timers.reset();
  }
  return res;
};

describe('auditoría: un solo calendario a las 8:15 y a las 14:00', () => {
  // El titular firmante (superadmin, con su firma) propone un alta el viernes 30/10 a las 12:00 y tiene su primer recordatorio
  // ese día a las 14:00; el otro admin lo audita. Con la precarga, el lunes 02/11 no es hábil: el 03/11 es el segundo
  // recordatorio y la nota sale el 04/11 (con los 9 fijos, el 02/11 sería el segundo y la nota saldría el 03/11)
  let titular, otro, cambioId;
  const TITULO = 'Dataset nuevo del titular';

  beforeEach(async () => {
    await configurarNotas({ para_auditoria: 'auditoria@rpad.test' });
    titular = await crearUsuario('superadmin');
    otro = await crearUsuario('admin');
    await query('UPDATE notas_digitales_config SET firmante_usuario_id = ? WHERE id = 1', [titular.id]);
    cambioId = await proponerCambio(titular.id, TITULO, { creado: '2026-10-30 12:00:00' });
    await query("UPDATE cambios_pendientes SET primer_recordatorio_at = '2026-10-30 14:00:00' WHERE id = ?", [cambioId]);
  });

  // El recordatorio lleva solo lo propuesto hace una hora o más, medido con el reloj de la base (el de verdad): hasta el 30/10 a
  // las 13:00, el cambio del 30/10 no la tiene. Antes de la corrida de las 14:00 se lo pasa a hace dos horas; su canal depende
  // solo del primer recordatorio, que no cambia
  const conMasDeUnaHora = () => query('UPDATE cambios_pendientes SET created_at = NOW() - INTERVAL 2 HOUR WHERE id = ?', [cambioId]);
  const notasDeAuditoria = () => query("SELECT id, html FROM notas_digitales WHERE tipo = 'auditoria' AND es_prueba = 0 ORDER BY id");
  // Los mensajes de Mailpit a las casillas de este test
  const deEsteTest = (mensajes) => mensajes.filter((m) => [titular.email, otro.email, 'auditoria@rpad.test']
    .some((email) => paraCasilla(email)(m)));

  it('el 03/11 va por recordatorio a las 8:15 y a las 14:00', async () => {
    const corrida = await motor.ejecutarNotasDigitales({ hoy: '2026-11-03' });
    assert.equal(corrida.ejecutado, true);
    assert.deepEqual(corrida.errores, []);
    assert.deepEqual(corrida.generadas.filter((g) => g.tipo === 'auditoria'), []);
    assert.deepEqual(await notasDeAuditoria(), []);

    await conMasDeUnaHora();
    const resultado = await avisos.enviarCambiosPendientes({ hoy: '2026-11-03' });
    assert.equal(resultado.dia_habil, true);
    assert.equal(resultado.canal_nota, 0);
    assert.deepEqual(resultado.errores, []);
    assert.deepEqual(resultado.enviados.map((e) => e.email), [otro.email]);
    assert.equal((await mailpit.esperar(paraCasilla(otro.email))).length, 1);
  });

  it('el 04/11 va por nota en las dos', async () => {
    const corrida = await motor.ejecutarNotasDigitales({ hoy: '2026-11-04' });
    assert.deepEqual(corrida.errores, []);
    const [generada, ...otras] = corrida.generadas.filter((g) => g.tipo === 'auditoria');
    assert.equal(otras.length, 0);
    assert.deepEqual(await query('SELECT cambio_id, seccion FROM notas_digitales_cambios WHERE nota_id = ?', [generada.id]),
      [{ cambio_id: cambioId, seccion: 'nuevo' }]);

    await conMasDeUnaHora();
    const resultado = await avisos.enviarCambiosPendientes({ hoy: '2026-11-04' });
    assert.equal(resultado.dia_habil, true);
    assert.equal(resultado.canal_nota, 1);
    assert.deepEqual(resultado.enviados, []);
  });

  it('la nota del 04/11 dice 2 días hábiles pendiente (Review Focus 3)', async () => {
    await motor.ejecutarNotasDigitales({ hoy: '2026-11-04' });
    const [nota, ...otras] = await notasDeAuditoria();
    assert.equal(otras.length, 0);
    assert.ok(nota.html.includes(TITULO));
    // La fila del cambio termina en «Fecha de la propuesta» y «Días hábiles pendiente»: el 03/11 y el 04/11 (el 02/11 es
    // feriado de la tabla; con los 9 fijos serían 3)
    const fila = nota.html.match(/>30\/10\/2026<\/td><td style="[^"]*">(\d+)<\/td><\/tr>/);
    assert.ok(fila, nota.html);
    assert.equal(fila[1], '2');
  });

  it('el 02/11 la corrida de las 14:00 no es día hábil', async () => {
    // Con los 9 fijos, el cambio entraría en el recordatorio del otro admin
    await conMasDeUnaHora();
    const resultado = await avisos.enviarCambiosPendientes({ hoy: '2026-11-02' });
    assert.equal(resultado.dia_habil, false);
    assert.deepEqual([resultado.enviados, resultado.canal_nota, resultado.errores], [[], 0, []]);
    assert.deepEqual(deEsteTest(await mailpit.mensajes()), []);
  });

  it('la de las 14:00 dice qué calendario usó', async () => {
    const res = await corridaDeLas14('2026-11-02T17:00:00Z');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'Hoy no es día hábil: no se envían recordatorios.');
    assert.equal(res.body.data.calendario, 'tabla');
    assert.equal(res.body.data.dia_habil, false);
  });

  it('proximoDiaConQuienAudite desde el sábado 07/11 es el 10/11', async () => {
    assert.equal(await auditoria.proximoDiaConQuienAudite(titular.id, '2026-11-07'), '2026-11-10');
    // Con los 9 fijos, el lunes 09/11
    assert.equal(await auditoria.proximoDiaConQuienAudite(titular.id, '2026-11-07', CALENDARIO_FIJO), '2026-11-09');
  });

  it('periodosSinAuditor: con los dos auditores de licencia del 03/11 al 06/11, la vuelta es el 10/11', async () => {
    await licencia(titular, '2026-11-03', '2026-11-06');
    await licencia(otro, '2026-11-03', '2026-11-06');
    const periodo = { desde: '2026-11-03', hasta: '2026-11-06', vuelve: '2026-11-10', respaldo: [] };
    assert.deepEqual(await auditoria.periodosSinAuditor('2026-11-03', '2026-11-06'), [periodo]);
    // Con los 9 fijos, el lunes 09/11
    assert.deepEqual(await auditoria.periodosSinAuditor('2026-11-03', '2026-11-06', { calendario: CALENDARIO_FIJO }),
      [{ ...periodo, vuelve: '2026-11-09' }]);
  });

  it('el calendario que recibe la de las 14:00 llega al canal y al «hasta» del aviso a quien propone', async () => {
    await conMasDeUnaHora();
    // El 03/11, con los 9 fijos el cambio ya va por nota
    assert.equal((await avisos.enviarCambiosPendientes({ hoy: '2026-11-03', calendario: CALENDARIO_FIJO })).canal_nota, 1);
    // El otro admin de licencia del 03/11 al 06/11: el viernes 06/11 nadie puede auditar el cambio del titular, y el aviso le dice
    // hasta cuándo: el lunes 09/11 con los 9 fijos y el martes 10/11 con la tabla
    await licencia(otro, '2026-11-03', '2026-11-06');
    const hasta = async (calendario) => {
      await query('UPDATE cambios_pendientes SET aviso_sin_auditores_at = NULL WHERE id = ?', [cambioId]);
      const { sin_auditor: sinAuditor, errores } = await avisos.enviarCambiosPendientes({ hoy: '2026-11-06', calendario });
      assert.deepEqual(errores, []);
      return sinAuditor.map((aviso) => aviso.hasta);
    };
    assert.deepEqual(await hasta(CALENDARIO_FIJO), ['2026-11-09']);
    assert.deepEqual(await hasta(undefined), ['2026-11-10']);
  });

  it('con la tabla renombrada, la de las 14:00 responde 207 y lo anota en la última corrida', async () => {
    const consola = mock.method(console, 'error', () => {});
    let res;
    try {
      res = await conLaTablaRenombrada(() => corridaDeLas14('2026-11-02T17:00:00Z'));
    } finally {
      consola.mock.restore();
    }
    assert.equal(res.statusCode, 207);
    assert.equal(res.body.success, false);
    assert.equal(res.body.data.calendario, 'fijos');
    // Con los 9 fijos, el 02/11 es hábil
    assert.equal(res.body.data.dia_habil, true);
    const [config] = await query('SELECT ultima_corrida_resultado, ultima_corrida_con_errores FROM notas_digitales_config WHERE id = 1');
    assert.ok(String(config.ultima_corrida_resultado).includes(MENSAJE_CORRIDA_SIN_FERIADOS), config.ultima_corrida_resultado);
    assert.equal(config.ultima_corrida_con_errores, 1);
  });
});
