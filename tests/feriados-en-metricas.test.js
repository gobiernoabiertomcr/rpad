// Los feriados de la tabla en Métricas (spec 2026-10-27-feriados-en-notas, 2 y 5; tanda 2), sobre una base de prueba con la
// precarga de database/updates/migracion-feriados-datos.sql tal cual. Ningún test escribe en `feriados`: la precarga es la de
// producción, y conLaTablaRenombrada la devuelve igual. Se llama al servicio, y a la corrida diaria (el controlador, nunca
// /api/cron/*), con un hoy fijo.
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, correrSqlEnBaseDePrueba, cerrarDb, query, mailpit } from './helpers.js';
import { crearDataset, limpiarBase, configurarNotas, asegurarBaseDePrueba } from './notas-fixtures.js';
import { MENSAJE_METRICAS_SIN_FERIADOS, calendarioCon } from '../services/feriadosReglas.js';
import { casosDe, vistaDe } from '../services/metricasReglas.js';
import { CALENDARIO_FIJO } from '../services/notasDigitalesCalendario.js';
import { FILAS_PRECARGA } from './fixtures/feriados-precarga.js';
import { textosPorHoja } from './pdf-lector.js';

// Los días que la precarga saca de los hábiles de 2025 a 2027 (los de lunes a viernes que no son de los 9 fijos): los que guarda la
// foto de 2026, hasta el 31/12 del año siguiente
const FERIADOS_DE_LA_PRECARGA = [
  '2026-01-02', '2026-02-16', '2026-02-17', '2026-02-23', '2026-03-23', '2026-04-03', '2026-04-30', '2026-06-15', '2026-07-10',
  '2026-07-28', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-09', '2026-11-23', '2026-12-07', '2027-02-08', '2027-02-09',
  '2027-02-23', '2027-03-25', '2027-03-26', '2027-06-21', '2027-07-28', '2027-08-16', '2027-10-11', '2027-11-01', '2027-11-08',
  '2027-12-13'
];
let base, dbReal, foto, controlador, seguimientoDatos, usuarioId;

// Copiado de tests/metricas-foto.test.js, con la precarga de los feriados (como tests/feriados-en-notas.test.js)
before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_feriados_en_metricas');
  await correrSqlEnBaseDePrueba(base.nombre, 'database/updates/migracion-feriados-datos.sql');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba
  foto = await import('../services/metricasFoto.js');
  controlador = await import('../controllers/notificacionesController.js');
  seguimientoDatos = await import('../services/seguimientoDatos.js');
  const username = `t_${crypto.randomBytes(4).toString('hex')}`;
  usuarioId = (await query(
    "INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES (?, 'x', 'Persona de Prueba', ?, 'admin', 1)",
    [username, `${username}@rpad.test`]
  )).insertId;
});

// Copiado de tests/metricas-foto.test.js
after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

// Copiado de tests/metricas-foto.test.js (el de tests/feriados-en-notas.test.js no: borra los usuarios, y `aprobado` usa el del
// before)
beforeEach(async () => {
  process.env.EMAIL_SOLO_A = '';
  // limpiarBase comprueba que la base es de prueba; los cambios se van con sus datasets
  await limpiarBase();
  await query('DELETE FROM metricas_fotos');
  // Las notas DGMIT no se van con sus datasets (solo sus filas de notas_dgmit_datasets)
  await query('DELETE FROM notas_dgmit');
  await configurarNotas();
  await mailpit.vaciar();
});

// Copiado de tests/metricas-foto.test.js. Instante de una fecha y hora de Argentina (UTC-3), en segundos: las columnas TIMESTAMP se
// cargan con FROM_UNIXTIME, que no depende de la zona horaria de la base (en Docker es UTC)
const instante = (texto) => Date.parse(`${texto.replace(' ', 'T')}-03:00`) / 1000;
const fijarAlta = (datasetId, momento) => query('UPDATE datasets SET created_at = FROM_UNIXTIME(?) WHERE id = ?', [instante(momento), datasetId]);

// Copiado de tests/metricas-foto.test.js. Un cambio aprobado, como lo deja aprobarCambio (los JSON como texto)
const aprobado = ({ tipo = 'editar', datasetId, creado, revisado, nuevos = {}, anteriores = null }) => query(
  `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, datos_anteriores, usuario_id, estado, revisor_id, created_at,
     revisado_at) VALUES (?, ?, ?, ?, ?, 'aprobado', ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))`,
  [tipo, datasetId, JSON.stringify(nuevos), anteriores && JSON.stringify(anteriores), usuarioId, usuarioId, instante(creado), instante(revisado)]
);

// Copiado de tests/metricas-foto.test.js. Una actualización registrada: la próxima pasa de `de` a `a`, la carga de `cargaAnterior`
// a `carga`, con su «Recibido el»
const actualizacion = ({ datasetId, creado, revisado, de, a, cargaAnterior, carga, recibido, origen }) => aprobado({
  datasetId, creado, revisado,
  anteriores: { proxima_actualizacion: de, ultima_actualizacion: cargaAnterior },
  nuevos: {
    proxima_actualizacion: a, ultima_actualizacion: carga, registro_actualizacion: true, recibido_el: recibido,
    ...(origen ? { origen_datos: origen } : {})
  }
});

// Copiado de tests/metricas-foto.test.js. Un email viejo a la DGMIT que se envió
const emailEnviado = ({ tipo, datasetId, enviado }) => query(
  `INSERT INTO notificaciones_log (tipo, area_id, destinatarios, datasets_ids, cantidad_datasets, enviado_at, success)
   VALUES (?, NULL, 'mit@rpad.test', ?, 1, FROM_UNIXTIME(?), 1)`,
  [tipo, String(datasetId), instante(enviado)]
);

// Copiado de tests/metricas-foto.test.js. El año 2026 de tres datasets anuales, todos dados de alta el 15/01/2026 salvo el C:
// - A, externo con «Requiere nota DGMIT» Sí: vencía el 30/11/2026 y se avisó por la regla el 21/10/2026 (el email de 40 días); los
//   datos llegaron el 29/12/2026 y se cargaron el 30/12/2026, pero la actualización se aprobó el 05/01/2027;
// - B, interno: vencía el 30/11/2026 y se avisó el 01/10/2026 (el email de 60 días); los datos llegaron el 02/01/2027 y se cargaron el
//   03/01/2027 (aprobada ese día);
// - C, externo: se actualizó el 10/06/2025 y se dio de baja el 20/11/2025, antes de vencer: no toca 2026.
const prepararElAnio = async () => {
  const a = await crearDataset({
    titulo: 'Dataset A de prueba', gestion: 'externa', requiereNota: 1, vencimiento: '2027-11-30', ultima: '2026-12-30'
  });
  await fijarAlta(a, '2026-01-15 10:00:00');
  await emailEnviado({ tipo: 'externo-40', datasetId: a, enviado: '2026-10-21 08:15:00' });
  await actualizacion({
    datasetId: a, creado: '2027-01-04 09:00:00', revisado: '2027-01-05 10:00:00', de: '2026-11-30', a: '2027-11-30',
    cargaAnterior: '2025-12-15', carga: '2026-12-30', recibido: '2026-12-29', origen: 'area'
  });

  const b = await crearDataset({ titulo: 'Dataset B de prueba', gestion: 'interna', vencimiento: '2027-11-30', ultima: '2027-01-03' });
  await fijarAlta(b, '2026-01-15 10:00:00');
  await emailEnviado({ tipo: 'interno-60', datasetId: b, enviado: '2026-10-01 08:15:00' });
  await actualizacion({
    datasetId: b, creado: '2027-01-03 09:00:00', revisado: '2027-01-03 11:00:00', de: '2026-11-30', a: '2027-11-30',
    cargaAnterior: '2025-12-10', carga: '2027-01-03', recibido: '2027-01-02'
  });

  const c = await crearDataset({
    titulo: 'Dataset C de prueba', gestion: 'externa', requiereNota: 1, vencimiento: '2025-12-31', ultima: '2025-06-10', activo: 0
  });
  await fijarAlta(c, '2025-03-01 10:00:00');
  await actualizacion({
    datasetId: c, creado: '2025-06-10 09:00:00', revisado: '2025-06-10 10:00:00', de: '2025-05-31', a: '2025-12-31',
    cargaAnterior: '2024-06-01', carga: '2025-06-10', recibido: '2025-06-05', origen: 'area'
  });
  await aprobado({ tipo: 'eliminar', datasetId: c, creado: '2025-11-20 09:00:00', revisado: '2025-11-20 10:00:00' });
  return { a, b, c };
};

// Copiado de tests/metricas-foto.test.js. La corrida diaria de las 8:15 (el controlador del cron, sin pasar por /api/cron/*) en un
// momento fijo: el reloj se simula solo mientras corre. Devuelve lo que respondió
const corridaDiaria = async (momento) => {
  const res = {
    statusCode: null, body: null,
    status(codigo) { this.statusCode = codigo; return this; },
    json(cuerpo) { this.body = cuerpo; return this; }
  };
  mock.timers.enable({ apis: ['Date'], now: new Date(momento) });
  try {
    await controlador.ejecutarNotificacionesDiarias({}, res);
  } finally {
    mock.timers.reset();
  }
  return res;
};

// Copiado de tests/metricas-foto.test.js
const ultimaCorrida = async () => (await query(
  `SELECT DATE_FORMAT(ultima_corrida_fecha, '%Y-%m-%d') fecha, ultima_corrida_resultado resultado, ultima_corrida_con_errores con_errores
   FROM notas_digitales_config WHERE id = 1`
))[0];

// Copiado de tests/feriados-en-notas.test.js. Mientras corre fn, la tabla `feriados` no se puede leer (se renombra); al terminar
// vuelve, también si fn tira
const conLaTablaRenombrada = async (fn) => {
  await asegurarBaseDePrueba();
  await query('RENAME TABLE feriados TO feriados_sin_leer');
  try {
    return await fn();
  } finally {
    await query('RENAME TABLE feriados_sin_leer TO feriados');
  }
};

// Copiado de tests/feriados-en-notas.test.js. Lo que dice leerCalendario en la consola cuando no puede leer la tabla: una vez por
// lectura
const lecturasFallidas = (consola) => consola.mock.calls
  .filter((llamada) => String(llamada.arguments[0]).startsWith('No se pudieron leer los feriados')).length;

// La mediana en días hábiles de la etapa del aviso anticipado de cada gestión: A se avisó el 21/10 y B el 01/10, y los dos vencían el
// 30/11/2026. Con la precarga, sin el 12/10, el 02/11, el 09/11 y el 23/11: 25 y 38 (con los 9 fijos, 28 y 42)
const avisos = (etapas) => ['externa', 'interna']
  .map((gestion) => etapas[gestion].find((etapa) => etapa.clave === 'aviso').habiles.mediana);

// El 31/12 de la foto de 2026: el hoy de sus casos
const AL_2026 = '2026-12-31';
const cuantasFotos = async () => Number((await query('SELECT COUNT(*) n FROM metricas_fotos'))[0].n);

describe('la foto', () => {
  it('el 10/01/2027 la saca con los feriados de la tabla y los guarda', async () => {
    await prepararElAnio();
    // Sin calendario: lo lee de la tabla
    assert.deepEqual(await foto.sacarFotoSiCorresponde({ hoy: '2027-01-10' }), { anio: 2026, sacada: true });
    const { datos } = await foto.leerFoto(2026);
    assert.deepEqual(datos.feriados, FERIADOS_DE_LA_PRECARGA);
    assert.deepEqual(avisos(datos.etapas), [25, 38]);
    // Las vistas también: el tramo del aviso anticipado de la mediana en días hábiles
    const vista = datos.vistas['mediana-habiles'];
    assert.deepEqual(['externa', 'interna'].map((gestion) => vista.circuito[gestion].find((t) => t.clave === 'aviso').cifra.valor),
      [25, 38]);
  });

  // Review Focus 3: una foto sin etapas (si etapasParaLaFoto falló al sacarla) se recalcula con sus feriados; sin feriados (sacada
  // con el código anterior), con los 9 fijos, como se sacó
  it('una foto sin etapas se recalcula con sus feriados; sin feriados, con los 9 fijos', async () => {
    await prepararElAnio();
    await foto.sacarFotoSiCorresponde({ hoy: '2027-01-10' });
    const { etapas, ...sinEtapas } = (await foto.leerFoto(2026)).datos;
    const recalculadas = foto.etapasDeLaFoto({ anio: 2026, datos: sinEtapas });
    assert.deepEqual(avisos(recalculadas), [25, 38]);
    assert.deepEqual(recalculadas, etapas);

    const { feriados, ...sinNada } = sinEtapas;
    assert.deepEqual(feriados, FERIADOS_DE_LA_PRECARGA);
    assert.deepEqual(avisos(foto.etapasDeLaFoto({ anio: 2026, datos: sinNada })), [28, 42]);
  });

  // Review Focus 1 y 2: la foto del 10/01/2027 con la tabla sin leer no se saca (no queda una foto de 2026 con los 9 fijos, que no se
  // modifica nunca); la corrida lee la tabla una sola vez y la foto usa ese calendario; la del día siguiente la saca con la tabla
  it('con la tabla sin leer no se saca: la corrida responde 207, lo anota y la del día siguiente la saca', async () => {
    await prepararElAnio();
    const consola = mock.method(console, 'error', () => {});
    let res;
    try {
      res = await conLaTablaRenombrada(() => corridaDiaria('2027-01-10T11:15:00Z'));
      // Una sola lectura de la tabla en toda la corrida: la del controlador, que recibe también la foto (el email de vencimiento de
      // Mi espacio lee los feriados por su cuenta)
      assert.equal(lecturasFallidas(consola), 1);
    } finally {
      consola.mock.restore();
    }
    assert.equal(res.statusCode, 207);
    assert.equal(res.body.success, false);
    assert.equal(res.body.data.calendario, 'fijos');
    assert.equal(res.body.data.foto, null);
    assert.deepEqual(res.body.data.errores.filter((e) => e.tipo === 'foto-del-anio'),
      [{ tipo: 'foto-del-anio', error: MENSAJE_METRICAS_SIN_FERIADOS }]);
    assert.equal(await cuantasFotos(), 0);
    const anotada = await ultimaCorrida();
    assert.equal(anotada.fecha, '2027-01-10');
    assert.equal(anotada.con_errores, 1);
    assert.ok(anotada.resultado.includes(
      'No se pudo sacar la foto del año: no se pudieron leer los feriados de Configuración → Feriados'), anotada.resultado);

    // La corrida del día siguiente, con la tabla, la saca con sus 28 feriados
    const otra = await corridaDiaria('2027-01-11T11:15:00Z');
    assert.deepEqual(otra.body.data.foto, { anio: 2026, sacada: true });
    assert.ok(!otra.body.data.errores.some((e) => e.tipo === 'foto-del-anio'), JSON.stringify(otra.body.data.errores));
    const { datos } = await foto.leerFoto(2026);
    assert.deepEqual(datos.feriados, FERIADOS_DE_LA_PRECARGA);
    assert.deepEqual(avisos(datos.etapas), [25, 38]);
  });

  it('con un calendario que cayó a los 9 fijos tira y no guarda nada; si no toca sacar una, no lo mira', async () => {
    await prepararElAnio();
    const caido = calendarioCon([], { origen: 'fijos', error: 'falla' });
    await assert.rejects(foto.sacarFotoSiCorresponde({ hoy: '2027-01-10', calendario: caido }),
      { message: MENSAJE_METRICAS_SIN_FERIADOS });
    assert.equal(await cuantasFotos(), 0);
    // El 09/01 todavía no toca: no tira
    assert.equal(await foto.sacarFotoSiCorresponde({ hoy: '2027-01-09', calendario: caido }), null);
    // Con la de 2026 ya sacada, tampoco
    assert.deepEqual(await foto.sacarFotoSiCorresponde({ hoy: '2027-01-10' }), { anio: 2026, sacada: true });
    assert.deepEqual(await foto.sacarFotoSiCorresponde({ hoy: '2027-01-10', calendario: caido }), { anio: 2026, ya: true });
    assert.equal(await cuantasFotos(), 1);
  });

  // Los casos de la foto también cuentan con la tabla (casosDe recibe el calendario): el día en que sale el aviso de la regla decide
  // si un ciclo ya lo esperaba y, sin el aviso, con qué motivo figura (motivo_sin_aviso, que la foto guarda en sus casos)
  it('los casos saben el día del aviso con la tabla: un ciclo que se cerró antes no lo esperaba', async () => {
    // D, externo, vencía el 31/12/2026: la regla de los 40 días cae el sábado 21/11 y el aviso sale el hábil siguiente, el lunes
    // 23/11 con los 9 fijos y el martes 24/11 con la tabla (el 23/11 es la Soberanía). No se avisó, y la actualización se aprobó el
    // 24/11: con la tabla, el ciclo dejó de regir el mismo día del aviso, sin tenerlo, así que no lo esperaba
    const d = await crearDataset({
      titulo: 'Dataset D de prueba', gestion: 'externa', requiereNota: 1, vencimiento: '2027-12-31', ultima: '2026-11-24'
    });
    await fijarAlta(d, '2026-01-15 10:00:00');
    await actualizacion({
      datasetId: d, creado: '2026-11-24 09:00:00', revisado: '2026-11-24 10:00:00', de: '2026-12-31', a: '2027-12-31',
      cargaAnterior: '2025-12-15', carga: '2026-11-24', recibido: '2026-11-20', origen: 'area'
    });
    const delCiclo = (casos) => casos.find((caso) => caso.dataset_id === d && caso.venc === '2026-12-31');
    const fuentes = await seguimientoDatos.fuentesDe(null);
    // Con los 9 fijos lo esperaba (el 23/11, antes de la aprobación) y figuraría «sin aviso»
    assert.equal(delCiclo(casosDe(fuentes, { hoy: AL_2026, calendario: CALENDARIO_FIJO })).motivo_sin_aviso, 'sin-aviso');
    assert.equal(delCiclo(casosDe(fuentes, { hoy: AL_2026, calendario: calendarioCon(FILAS_PRECARGA) })).motivo_sin_aviso, null);

    assert.deepEqual(await foto.sacarFotoSiCorresponde({ hoy: '2027-01-10' }), { anio: 2026, sacada: true });
    const { datos } = await foto.leerFoto(2026);
    assert.equal(delCiclo(datos.casos).motivo_sin_aviso, null);
  });
});

// Los puntos de entrada de Métricas en vivo, del Ciclo de vida del dato y de la Agenda de pedidos (spec 2026-10-27-feriados-en-notas,
// 2 y 5): leen el calendario una sola vez por pedido y lo exigen con la tabla (sin ella, el 500 de siempre); un año con foto no la lee.
// Los controladores se llaman directo, con un `res` falso
describe('Métricas, el Ciclo de vida y la Agenda', () => {
  // El calendario de la precarga, el que lee leerCalendario de esta base
  const TABLA = calendarioCon(FILAS_PRECARGA);
  let metricas, reportes, pool;

  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba (el before de arriba corre antes)
  before(async () => {
    metricas = await import('../controllers/metricasController.js');
    reportes = await import('../controllers/reportesController.js');
    pool = (await import('../config/database.js')).default;
  });

  // Un `res` falso de Express: lo que respondió el controlador y, si armó un PDF, sus encabezados y sus bytes
  const respuesta = () => ({
    statusCode: 200, body: null, headers: {}, enviado: null,
    status(codigo) { this.statusCode = codigo; return this; },
    json(cuerpo) { this.body = cuerpo; return this; },
    setHeader(nombre, valor) { this.headers[nombre] = valor; },
    send(contenido) { this.enviado = contenido; return this; }
  });
  const pedido = (query = {}) => ({ query, user: { userId: usuarioId } });

  // fn con el reloj en `momento` (solo Date: la base sigue andando)
  const conElReloj = async (momento, fn) => {
    mock.timers.enable({ apis: ['Date'], now: new Date(momento) });
    try {
      return await fn();
    } finally {
      mock.timers.reset();
    }
  };

  // Cuántas veces fn lee la tabla de los feriados: las consultas con `feriados_no_rige` (pool.query espiado, sin cambiar lo que
  // hace). filasDeFeriados hace esa consulta solo si hay filas: cuenta porque esta base tiene la precarga
  const lecturasDeLaTabla = async (fn) => {
    const espia = mock.method(pool, 'query');
    try {
      const resultado = await fn();
      const lecturas = espia.mock.calls.filter((llamada) => String(llamada.arguments[0]).includes('feriados_no_rige')).length;
      return { resultado, lecturas };
    } finally {
      espia.mock.restore();
    }
  };

  // La cifra del aviso anticipado de cada gestión en el circuito de la vista (la mediana en días hábiles)
  const avisosDeLaVista = (vista) => ['externa', 'interna']
    .map((gestion) => vista.circuito[gestion].find((tramo) => tramo.clave === 'aviso').cifra.valor);

  it('Métricas en vivo cuenta con la tabla: el aviso anticipado, 25 y 38 días hábiles', async () => {
    await prepararElAnio();
    const data = await metricas.metricasDe({ anio: '2026' }, { hoy: AL_2026 });
    assert.deepEqual(avisosDeLaVista(data.vista), [25, 38]);
    const casos = casosDe(await seguimientoDatos.fuentesDe(null), { hoy: AL_2026, calendario: TABLA });
    assert.deepEqual(data.vista, vistaDe(casos, { anio: 2026, al: AL_2026, calendario: TABLA }));
  });

  it('el Ciclo de vida en vivo cuenta con la tabla: el aviso anticipado, 25 y 38 días hábiles', async () => {
    await prepararElAnio();
    const datos = await metricas.cicloDeVidaDe({ anio: '2026' }, { hoy: AL_2026 });
    assert.equal(datos.etapas.externa[0].habiles.mediana, 25);
    assert.equal(datos.etapas.interna[0].habiles.mediana, 38);
  });

  // Review Focus 5: el 05/01/2027, pidiendo 2027, los dos años van en vivo (2026 todavía no tiene foto) y la tabla se lee una vez
  it('una sola lectura de la tabla por pedido: el Ciclo de vida con los dos años en vivo y Métricas', async () => {
    await prepararElAnio();
    // Sin ninguna foto: 2026 también va en vivo
    assert.equal(await cuantasFotos(), 0);
    const ciclo = await lecturasDeLaTabla(() => metricas.cicloDeVidaDe({ anio: '2027' }, { hoy: '2027-01-05' }));
    assert.equal(ciclo.resultado.anio, 2027);
    assert.equal(ciclo.resultado.en_vivo, true);
    // El año anterior también se contó con la tabla
    assert.equal(ciclo.resultado.etapas.externa[0].textos.anterior, 'Año anterior: mediana de 25 días hábiles');
    assert.equal(ciclo.resultado.etapas.interna[0].textos.anterior, 'Año anterior: mediana de 38 días hábiles');
    assert.equal(ciclo.lecturas, 1);

    const delAnio = await lecturasDeLaTabla(() => metricas.metricasDe({ anio: '2026' }, { hoy: AL_2026 }));
    assert.equal(delAnio.resultado.en_vivo, true);
    assert.equal(delAnio.lecturas, 1);
  });

  // Review Focus 4: un año con foto se lee de la foto, sin la tabla: con ella no la lee y sin ella responde igual
  it('un año con foto no lee la tabla: Métricas, el Ciclo de vida y el Informe anual responden también sin ella', async () => {
    await prepararElAnio();
    assert.deepEqual(await foto.sacarFotoSiCorresponde({ hoy: '2027-01-10' }), { anio: 2026, sacada: true });
    const hoy = '2027-01-12';
    const losTres = async () => {
      const deMetricas = await metricas.metricasDe({ anio: '2026' }, { hoy });
      const delCiclo = await metricas.cicloDeVidaDe({ anio: '2026' }, { hoy });
      const res = respuesta();
      await reportes.reporteInformeAnual(pedido({ anio: '2026' }), res);
      return { deMetricas, delCiclo, res };
    };
    const comprobar = ({ deMetricas, delCiclo, res }) => {
      assert.equal(deMetricas.en_vivo, false);
      assert.deepEqual(avisosDeLaVista(deMetricas.vista), [25, 38]);
      assert.equal(delCiclo.en_vivo, false);
      assert.equal(delCiclo.etapas.externa[0].habiles.mediana, 25);
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      assert.equal(res.headers['Content-Type'], 'application/pdf');
      assert.ok(Buffer.isBuffer(res.enviado) && res.enviado.subarray(0, 5).toString() === '%PDF-');
    };

    const conLaTabla = await lecturasDeLaTabla(losTres);
    comprobar(conLaTabla.resultado);
    assert.equal(conLaTabla.lecturas, 0);

    const consola = mock.method(console, 'error', () => {});
    try {
      comprobar(await conLaTablaRenombrada(losTres));
      assert.equal(lecturasFallidas(consola), 0);
    } finally {
      consola.mock.restore();
    }
  });

  // Sin la tabla, en vivo: el 500 de siempre, con el mensaje fijo de cada uno (spec, 2), y ningún PDF. Cada pedido la intenta leer una
  // sola vez
  it('sin la tabla, Métricas en vivo, el Ciclo de vida, la Agenda y «Datos para completar» responden 500 sin armar un PDF', async () => {
    await prepararElAnio();
    const pedidos = [
      ['verMetricas', metricas.verMetricas, 'Error al obtener las métricas'],
      ['descargarMetricasPdf', metricas.descargarMetricasPdf, 'Error al generar el PDF de las métricas'],
      ['reporteCicloDeVida', reportes.reporteCicloDeVida, 'Error al generar el Ciclo de vida del dato'],
      ['reporteAgenda', reportes.reporteAgenda, 'Error al generar el PDF de la Agenda de pedidos'],
      ['reporteParaCompletar', reportes.reporteParaCompletar, 'Error al generar el PDF de Datos para completar']
    ];
    await conLaTablaRenombrada(() => conElReloj('2026-12-31T15:00:00Z', async () => {
      for (const [nombre, controlador, mensaje] of pedidos) {
        const consola = mock.method(console, 'error', () => {});
        const res = respuesta();
        try {
          await controlador(pedido({ anio: '2026' }), res);
          assert.equal(lecturasFallidas(consola), 1, nombre);
        } finally {
          consola.mock.restore();
        }
        assert.equal(res.statusCode, 500, `${nombre}: ${JSON.stringify(res.body)}`);
        assert.deepEqual(res.body, { success: false, error: mensaje }, nombre);
        assert.equal(res.enviado, null, `${nombre} no arma un PDF`);
        assert.equal(res.headers['Content-Type'], undefined, nombre);
      }
    }));
  });

  // «Aviso aprox.» de la Agenda con la tabla: un interno que vence el 31/12/2026 se avisa 60 días antes, el domingo 01/11; el hábil
  // siguiente es el lunes 02/11 con los 9 fijos y el martes 03/11 con la tabla (el 02/11 es feriado)
  it('la Agenda de pedidos dice el aviso aprox. con la tabla: el 03/11/2026, no el 02/11', async () => {
    const titulo = 'Dataset E de prueba';
    await crearDataset({ titulo, gestion: 'interna', vencimiento: '2026-12-31', ultima: '2025-12-15' });
    const res = respuesta();
    await conElReloj('2026-10-28T13:00:00Z', () => reportes.reporteAgenda(pedido(), res));
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    // El renglón del dataset: los textos de su misma hoja y su misma línea de base, de izquierda a derecha
    const textos = textosPorHoja(res.enviado).flatMap((hoja, k) => hoja.map((t) => ({ ...t, hoja: k })));
    const delTitulo = textos.find((t) => t.texto === titulo);
    assert.ok(delTitulo, `falta «${titulo}» en el PDF`);
    const fila = textos.filter((t) => t.hoja === delTitulo.hoja && Math.abs(t.base - delTitulo.base) < 0.5)
      .sort((a, b) => a.x - b.x).map((t) => t.texto);
    assert.equal(fila.at(-1), '03/11/2026', fila.join(' | '));
    assert.ok(!fila.includes('02/11/2026'), fila.join(' | '));
  });
});
