// El sellado de la votación de la principal del equipo y el mail del resultado (spec 2026-11-23-dato-quincena-principal-votacion, 6;
// services/datoQuincenaVotacion.js), contra una base de prueba propia con la precarga de feriados tal cual (el lunes 23/11/2026 es
// feriado). Se llama al servicio con un ahora y un calendario fijos (nunca a /api/cron/*) y los mails van a un `enviar` falso que junta lo
// que le llega: no sale ninguno, ni a Mailpit. Las corridas enteras (el controlador) se llaman con el reloj fijo y sin nadie de
// administración en la base, así tampoco mandan nada. Las personas («PruebaUno Ejemplo») y sus casillas (@ejemplo.test) son inventadas
// y cambian en cada test; las ediciones salen de tests/dato-quincena-fixtures.js.
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { crearBaseDePrueba, correrSqlEnBaseDePrueba, cerrarDb, query, db } from './helpers.js';
import { asegurarBaseDePrueba } from './notas-fixtures.js';
import { edicionDePrueba, pilotoDePrueba, partesDePrueba } from './dato-quincena-fixtures.js';
import { FILAS_PRECARGA } from './fixtures/feriados-precarga.js';
import { claveDeEdicion, filasDeLaEdicion, huellaDelPaquete } from '../services/datoQuincenaReglas.js';
import { calendarioCon } from '../services/feriadosReglas.js';
import { votacionParaElDetalle } from '../services/datoQuincenaVotacionReglas.js';
import { RPAD_URL } from '../services/emailTemplates.js';
import { remitente } from '../services/emailService.js';

const CALENDARIO = calendarioCon(FILAS_PRECARGA);
const CALENDARIO_CAIDO = calendarioCon([], { origen: 'fijos', error: 'No se pudo leer la tabla de feriados.' });
// El mismo, con el martes 24/11 también no laborable: una votación sin sellar que cerraba ese día pasaría a cerrar el 25/11
const CON_EL_24 = calendarioCon([...FILAS_PRECARGA, {
  id: 99, fecha: '2026-11-24', nombre: 'Un asueto inventado', tipo: 'no_laborable', trasladado_de: null, se_repite: 0, hasta_anio: null,
  activo: 1, no_rige: []
}]);
const ASUNTO = 'La principal del equipo del lunes 23/11/2026';
const NO_SE_ENVIO = 'No se pudo enviar el mail de la votación.';
const EN_LA_CORRIDA = 'No se pudo completar el sellado de la votación del dato de la quincena.';
// La alerta de Correos → Estado: «parcial», a alguien no le llegó; «fallido», a nadie
const ALERTA_DEL_23 = {
  tipo: 'dato-quincena-votacion-no-llego', nivel: 'error',
  mensaje: 'El mail de la votación del 23/11 no le llegó a todas las personas de administración.'
};
const ALERTA_DEL_23_A_NADIE = { ...ALERTA_DEL_23, mensaje: 'El mail de la votación del 23/11 no le llegó a nadie de administración.' };
const TABLAS = ['dato_quincena_votos', 'dato_quincena_votacion_personas', 'dato_quincena_votaciones', 'dato_quincena_votantes',
  'dato_quincena_envios', 'dato_quincena_correos', 'dato_quincena_destinatarios', 'dato_quincena_adjuntos',
  'dato_quincena_principal_equipo', 'dato_quincena_propuestas', 'dato_quincena_ediciones', 'usuarios_licencias', 'usuarios'];

let base, dbReal, emailSoloA, servicio, datos, votacionDatos, correo, controlador, pool;

before(async () => {
  dbReal = process.env.DB_NAME;
  emailSoloA = process.env.EMAIL_SOLO_A;
  base = await crearBaseDePrueba('rpad_test_dato_quincena_votacion_sellado');
  await correrSqlEnBaseDePrueba(base.nombre, 'database/updates/migracion-feriados-datos.sql');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba
  servicio = await import('../services/datoQuincenaVotacion.js');
  datos = await import('../services/datoQuincenaDatos.js');
  votacionDatos = await import('../services/datoQuincenaVotacionDatos.js');
  correo = await import('../services/datoQuincenaCorreo.js');
  controlador = await import('../controllers/notificacionesController.js');
  pool = (await import('../config/database.js')).default;
});

after(async () => {
  await pool?.end();
  await cerrarDb();
  if (emailSoloA === undefined) delete process.env.EMAIL_SOLO_A;
  else process.env.EMAIL_SOLO_A = emailSoloA;
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  await asegurarBaseDePrueba();
  for (const tabla of TABLAS) await query(`DELETE FROM ${tabla}`);
  await query(
    `UPDATE dato_quincena_correo_config SET envio_activo = 1, cambiado_por = NULL, corrida_inicio_at = NULL, corrida_fin_at = NULL,
       corrida_resultado = NULL, corrida_con_errores = 0 WHERE id = 1`
  );
});

const sufijo = () => crypto.randomBytes(3).toString('hex');

// Una persona con su casilla inventada; `clave` arma su primer nombre («PruebaUno»)
const persona = async ({ clave, rol = 'admin', activo = 1, email = null }) => {
  const username = `t_dqv_${sufijo()}`;
  const casilla = email ?? `${username}@ejemplo.test`;
  const { insertId: id } = await query(
    "INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES (?, 'x', ?, ?, ?, ?)",
    [username, `Prueba${clave} Ejemplo`, casilla, rol, activo]
  );
  return { id, email: casilla, nombre: `Prueba${clave}` };
};
const aLosQueVotan = async (...personas) => {
  for (const quien of personas) {
    await query("INSERT INTO dato_quincena_votantes (usuario_id, agregado_por, agregado_at) VALUES (?, NULL, '2026-11-01 09:00:00')", [quien.id]);
  }
};
const licencia = (quien, desde, hasta) => query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [quien.id, desde, hasta]);
const prender = (activo) => query('UPDATE dato_quincena_correo_config SET envio_activo = ? WHERE id = 1', [activo ? 1 : 0]);

// La gente de casi todos los tests: tres de administración que reciben (admin, editor y superadmin) y, que no lo reciben, una lectora, una
// admin inactiva, una de licencia oficial el martes 24/11 y una sin un email válido. Votan la admin, el editor y la lectora
const laGente = async () => {
  const gente = {
    uno: await persona({ clave: 'Uno', rol: 'admin' }),
    dos: await persona({ clave: 'Dos', rol: 'editor' }),
    tres: await persona({ clave: 'Tres', rol: 'superadmin' }),
    lectora: await persona({ clave: 'Lectora', rol: 'lector' }),
    inactiva: await persona({ clave: 'Inactiva', activo: 0 }),
    deLicencia: await persona({ clave: 'Licencia' }),
    sinEmail: await persona({ clave: 'SinEmail', email: 'sin-arroba' })
  };
  await licencia(gente.deLicencia, '2026-11-24', '2026-11-27');
  await aLosQueVotan(gente.uno, gente.dos, gente.lectora);
  return gente;
};
const DE_ADMINISTRACION = ['uno', 'dos', 'tres'];

// Los segundos UNIX de una hora argentina 'AAAA-MM-DD HH:MM'
const segundos = (hora) => Date.parse(`${hora.replace(' ', 'T')}:00-03:00`) / 1000;

// Llega una edición por el mismo camino que el POST (guardarEdicion: nace su votación con la foto de quienes votan) y su llegada se fija
// en `llegada` ('AAAA-MM-DD HH:MM', hora argentina). Con `piloto: true`, el piloto 4 de ese día. Devuelve su id
const llega = async (fecha_edicion, llegada, { piloto = false } = {}) => {
  const edicion = (piloto ? pilotoDePrueba : edicionDePrueba)({ fecha_edicion, titulo: `El dato de la quincena del ${fecha_edicion}` });
  const partes = partesDePrueba(edicion);
  const manifiesto = JSON.parse(partes.metadata.toString('utf8'));
  const { estado, id } = await datos.guardarEdicion({
    clave: claveDeEdicion(edicion),
    tipo: edicion.tipo,
    fecha_edicion,
    referencia_piloto: edicion.referencia_piloto,
    titulo: edicion.titulo,
    metadataTexto: partes.metadata.toString('utf8'),
    huella: huellaDelPaquete(partes),
    filas: filasDeLaEdicion(edicion),
    adjuntos: manifiesto.adjuntos.map(({ campo, nombre, mime }) => ({
      campo, nombre, mime, bytes: partes[campo].length, sha256: crypto.createHash('sha256').update(partes[campo]).digest('hex'),
      contenido: partes[campo]
    })),
    ahora: `${llegada}:00`
  });
  assert.equal(estado, 'creada');
  await query('UPDATE dato_quincena_ediciones SET recibida_at = FROM_UNIXTIME(?) WHERE id = ?', [segundos(llegada), id]);
  return id;
};

// Un voto escrito a mano (el PUT se prueba en tests/dato-quincena-votacion-api.test.js), con su hora
const voto = async (edicionId, quien, orden, votadoAt) => {
  const [{ id }] = await query('SELECT id FROM dato_quincena_votacion_personas WHERE edicion_id = ? AND usuario_id = ?', [edicionId, quien.id]);
  await query('INSERT INTO dato_quincena_votos (persona_id, orden, votado_at) VALUES (?, ?, ?)', [id, orden, votadoAt]);
};
// Gana la 2 por puntos, 5 contra 4. El voto de la lectora de las 12:30 llegó después del cierre: no cuenta
const votosDelMartes = async (id, { uno, dos, lectora }) => {
  await voto(id, uno, '2,1', '2026-11-23 10:00:00');
  await voto(id, dos, '2,1', '2026-11-24 09:00:00');
  await voto(id, lectora, '1,2', '2026-11-24 11:59:00');
  await voto(id, lectora, '2,1', '2026-11-24 12:30:00');
};

// Un `enviar` falso: junta cada mail que le llega y contesta como sendEmail; a las casillas de `fallaPara`, que no salió, y a las de
// `tiraPara`, con una excepción (no se sabe si salió)
const transporte = ({ fallaPara = [], tiraPara = [] } = {}) => {
  const mails = [];
  const enviar = async (mail) => {
    mails.push(mail);
    if (mail.to.some((para) => tiraPara.includes(para))) throw Object.assign(new Error(`Conexión cortada con ${mail.to.join(', ')}`), { code: 'ECONNRESET' });
    if (mail.to.some((para) => fallaPara.includes(para))) return { success: false, error: `Falla simulada para ${mail.to.join(', ')}` };
    return { success: true, messageId: `<${sufijo()}@ejemplo.test>` };
  };
  return { mails, enviar };
};
const casillasDe = (mails) => mails.map((mail) => mail.to).sort();
const casillas = (gente, claves) => claves.map((clave) => [gente[clave].email]).sort();

// Una corrida del paso con un ahora y un calendario fijos
const corrida = (ahora, { calendario = CALENDARIO, enviar } = {}) => servicio.ejecutarLaVotacionDelDatoQuincena({ ahora, calendario, enviar });
const resultado = (cambios = {}) => ({ ocupada: false, selladas: 0, mails: 0, errores: [], ...cambios });
const SIN_SELLAR = { cierre_at: null, sellada_at: null, aviso: null, aviso_at: null };
const votacionDe = async (id) => ({ ...(await query(
  `SELECT DATE_FORMAT(cierre_at, '%Y-%m-%d %H:%i:%s') AS cierre_at, DATE_FORMAT(sellada_at, '%Y-%m-%d %H:%i:%s') AS sellada_at, aviso,
          DATE_FORMAT(aviso_at, '%Y-%m-%d %H:%i:%s') AS aviso_at
   FROM dato_quincena_votaciones WHERE edicion_id = ?`, [id]
))[0] });
const sellada = (cierre, cuando, aviso) => ({ cierre_at: cierre, sellada_at: cuando, aviso, aviso_at: cuando });

const callado = (metodo) => mock.method(console, metodo, () => {});
const conArroba = (consola) => consola.mock.calls.some((llamada) => llamada.arguments.some((arg) => String(arg?.stack ?? arg).includes('@')));
const estado = (ahora = '2026-11-25 15:00:00') => correo.estadoDelCorreoDelDatoQuincena({ ahora });

describe('cuándo se sella (spec, 6)', () => {
  it('antes de las 14:00 del día del cierre no sella ni manda nada; a las 14:00 sella y le manda a cada persona de administración', async () => {
    const gente = await laGente();
    const id = await llega('2026-11-23', '2026-11-23 09:45');
    await votosDelMartes(id, gente);
    const { mails, enviar } = transporte();
    for (const ahora of ['2026-11-24 11:00:00', '2026-11-24 12:30:00', '2026-11-24 13:59:00', '2026-11-24 13:59:59']) {
      assert.deepEqual(await corrida(ahora, { enviar }), resultado(), ahora);
    }
    assert.deepEqual(mails, []);
    assert.deepEqual(await votacionDe(id), SIN_SELLAR);

    assert.deepEqual(await corrida('2026-11-24 14:00:00', { enviar }), resultado({ selladas: 1, mails: 3 }));
    assert.deepEqual(await votacionDe(id), sellada('2026-11-24 12:00:00', '2026-11-24 14:00:00', 'enviado'));
    // Ni a la lectora (vota, pero no es de administración), ni a la inactiva, ni a la de licencia, ni a la que no tiene un email válido
    assert.deepEqual(casillasDe(mails), casillas(gente, DE_ADMINISTRACION));
    for (const mail of mails) {
      assert.equal(mail.from, remitente());
      assert.equal(mail.subject, ASUNTO);
      assert.equal(mail.to.length, 1);
    }
  });

  it('el mail dice el resultado de los votos hasta el cierre, con el nombre de quien lo recibe y la dirección de la edición', async () => {
    const gente = await laGente();
    const id = await llega('2026-11-23', '2026-11-23 09:45');
    await votosDelMartes(id, gente);
    const { mails, enviar } = transporte();
    await corrida('2026-11-24 14:00:00', { enviar });
    const mail = mails.find((uno) => uno.to[0] === gente.uno.email);
    assert.ok(mail.text.startsWith('Hola, PruebaUno:\n\n'), mail.text);
    assert.ok(mail.html.includes('Hola, PruebaUno:'));
    assert.ok(mails.find((uno) => uno.to[0] === gente.dos.email).text.startsWith('Hola, PruebaDos:'));
    // El voto de las 12:30 no cuenta: gana la 2 con 5 puntos contra 4 (con él, 6 contra 3)
    assert.ok(mail.text.includes('Ganó por puntos: 5, contra 4 de la que siguió.'), mail.text);
    assert.ok(mail.text.includes('Otro título inventado'));
    assert.ok(mail.text.includes('56 casos · septiembre de 2026'));
    assert.ok(mail.text.includes('Votaron 3 de 3.'));
    assert.ok(mail.text.includes('La votación cerró el martes 24/11/2026 a las 12:00.'));
    assert.ok(mail.html.includes(`<a href="${RPAD_URL}/dato-quincena.html?id=${id}" style="display: inline-block; color: #FFFFFF;`));
    assert.ok(mail.text.includes(`Ver la edición en el RPAD: ${RPAD_URL}/dato-quincena.html?id=${id}`));
    assert.equal(mail.attachments, undefined, 'sin adjuntos');
  });

  it('un día no hábil no sella: la que cerró el viernes 20/11 se sella el martes 24/11 a las 8:05 (el lunes 23/11 es feriado)', async () => {
    const gente = await laGente();
    const id = await llega('2026-11-20', '2026-11-20 07:00');
    const { mails, enviar } = transporte();
    for (const ahora of ['2026-11-21 14:00:00', '2026-11-22 08:05:00', '2026-11-23 08:05:00', '2026-11-23 14:00:00']) {
      assert.deepEqual(await corrida(ahora, { enviar }), resultado(), ahora);
    }
    assert.deepEqual(await votacionDe(id), SIN_SELLAR);
    assert.deepEqual(await corrida('2026-11-24 08:05:00', { enviar }), resultado({ selladas: 1, mails: 3 }));
    assert.deepEqual(await votacionDe(id), sellada('2026-11-20 12:00:00', '2026-11-24 08:05:00', 'enviado'));
    // Nadie votó: queda la de Datito, y el mail lo dice
    assert.ok(mails[0].text.includes('Nadie votó: quedó la de Datito.'), mails[0].text);
    assert.deepEqual(casillasDe(mails), casillas(gente, DE_ADMINISTRACION));
  });

  it('sin poder leer los feriados (calendario.error) no sella ni da error: la sella la corrida siguiente con el calendario leído', async () => {
    await laGente();
    const id = await llega('2026-11-23', '2026-11-23 09:45');
    const { mails, enviar } = transporte();
    assert.deepEqual(await corrida('2026-11-24 14:00:00', { calendario: CALENDARIO_CAIDO, enviar }), resultado());
    assert.deepEqual(await votacionDe(id), SIN_SELLAR);
    assert.deepEqual(mails, []);
    assert.deepEqual(await corrida('2026-11-25 08:05:00', { enviar }), resultado({ selladas: 1, mails: 3 }));
    assert.deepEqual(await votacionDe(id), sellada('2026-11-24 12:00:00', '2026-11-25 08:05:00', 'enviado'));
  });

  it('una edición de antes (sin votación) no se toca, y sin votaciones la corrida no hace nada', async () => {
    await laGente();
    const { mails, enviar } = transporte();
    assert.deepEqual(await corrida('2026-11-24 14:00:00', { enviar }), resultado());
    const id = await llega('2026-11-23', '2026-11-23 09:45');
    await query('DELETE FROM dato_quincena_votaciones WHERE edicion_id = ?', [id]);
    assert.deepEqual(await corrida('2026-11-24 14:00:00', { enviar }), resultado());
    assert.deepEqual(mails, []);
  });

  it('una sellada no se vuelve a abrir aunque el calendario cambie: el detalle la sigue mostrando cerrada, con su cierre', async () => {
    const gente = await laGente();
    const id = await llega('2026-11-23', '2026-11-23 09:45');
    await votosDelMartes(id, gente);
    const detalle = async (calendario, ahora) => {
      const votacion = (await votacionDatos.leerVotaciones([id])).get(id);
      const edicion = JSON.parse((await datos.leerEdicion(id)).fila.metadata);
      return votacionParaElDetalle({ votacion, edicion, quienMira: null, ahora, calendario });
    };
    // Sin sellar, con el martes no laborable, se volvería a votar hasta el miércoles
    assert.equal((await detalle(CON_EL_24, '2026-11-24 15:00:00')).estado, 'abierta');
    const { mails, enviar } = transporte();
    await corrida('2026-11-24 14:00:00', { enviar });
    const despues = await detalle(CON_EL_24, '2026-11-24 15:00:00');
    assert.equal(despues.estado, 'cerrada');
    assert.equal(despues.cierre, 'La votación cerró el martes 24/11/2026 a las 12:00.');
    assert.equal(despues.resultado.orden, 2);
    // Otra corrida, con el calendario nuevo, no la sella de nuevo ni manda nada
    assert.deepEqual(await corrida('2026-11-25 14:00:00', { calendario: CON_EL_24, enviar }), resultado());
    assert.deepEqual(await votacionDe(id), sellada('2026-11-24 12:00:00', '2026-11-24 14:00:00', 'enviado'));
    assert.equal(mails.length, 3);
  });
});

describe('a quién le llega y cómo queda el aviso (spec, 6)', () => {
  it('con el envío automático apagado se sella igual, sin mail («apagado»), y prenderlo después no lo manda', async () => {
    await laGente();
    const id = await llega('2026-11-23', '2026-11-23 09:45');
    await prender(false);
    const { mails, enviar } = transporte();
    assert.deepEqual(await corrida('2026-11-24 14:00:00', { enviar }), resultado({ selladas: 1 }));
    assert.deepEqual(await votacionDe(id), sellada('2026-11-24 12:00:00', '2026-11-24 14:00:00', 'apagado'));
    await prender(true);
    assert.deepEqual(await corrida('2026-11-25 08:05:00', { enviar }), resultado());
    assert.deepEqual(mails, []);
  });

  it('un piloto se sella sin mail («no_corresponde»), también con el envío prendido', async () => {
    await laGente();
    const id = await llega('2026-11-23', '2026-11-23 09:45', { piloto: true });
    const { mails, enviar } = transporte();
    assert.deepEqual(await corrida('2026-11-24 14:00:00', { enviar }), resultado({ selladas: 1 }));
    assert.deepEqual(await votacionDe(id), sellada('2026-11-24 12:00:00', '2026-11-24 14:00:00', 'no_corresponde'));
    assert.deepEqual(mails, []);
  });

  it('sin nadie de administración a quien mandarle (todas de licencia, o solo lectores), «no_corresponde»', async () => {
    const lector = await persona({ clave: 'Uno', rol: 'lector' });
    const deLicencia = await persona({ clave: 'Dos', rol: 'admin' });
    await licencia(deLicencia, '2026-11-24', '2026-11-24');
    await aLosQueVotan(lector, deLicencia);
    const id = await llega('2026-11-23', '2026-11-23 09:45');
    const { mails, enviar } = transporte();
    assert.deepEqual(await corrida('2026-11-24 14:00:00', { enviar }), resultado({ selladas: 1 }));
    assert.deepEqual(await votacionDe(id), sellada('2026-11-24 12:00:00', '2026-11-24 14:00:00', 'no_corresponde'));
    assert.deepEqual(mails, []);
  });

  it('una licencia anulada no cuenta: le llega', async () => {
    const gente = await laGente();
    await query('UPDATE usuarios_licencias SET anulada = 1 WHERE usuario_id = ?', [gente.deLicencia.id]);
    await llega('2026-11-23', '2026-11-23 09:45');
    const { mails, enviar } = transporte();
    assert.deepEqual(await corrida('2026-11-24 14:00:00', { enviar }), resultado({ selladas: 1, mails: 4 }));
    assert.deepEqual(casillasDe(mails), casillas(gente, [...DE_ADMINISTRACION, 'deLicencia']));
  });

  it('un mail que no sale para una persona: «parcial», su error con un texto fijo, sin reintento y la alerta en Correos → Estado', async () => {
    const gente = await laGente();
    const id = await llega('2026-11-23', '2026-11-23 09:45');
    const { mails, enviar } = transporte({ fallaPara: [gente.dos.email] });
    const errores = callado('error');
    let primera;
    let segunda;
    try {
      primera = await corrida('2026-11-24 14:00:00', { enviar });
      segunda = await corrida('2026-11-25 08:05:00', { enviar });
      assert.ok(!conArroba(errores), 'la consola no lleva direcciones');
    } finally {
      errores.mock.restore();
    }
    assert.deepEqual(primera, resultado({
      selladas: 1, mails: 2, errores: [{ edicion_id: id, usuario_id: gente.dos.id, error: NO_SE_ENVIO }]
    }));
    assert.deepEqual(segunda, resultado(), 'no se reintenta');
    assert.equal(mails.length, 3);
    assert.deepEqual(await votacionDe(id), sellada('2026-11-24 12:00:00', '2026-11-24 14:00:00', 'parcial'));
    assert.deepEqual((await estado()).alertas, [ALERTA_DEL_23]);
  });

  it('un transporte que tira cuenta como que no salió, y no frena a las demás', async () => {
    const gente = await laGente();
    const id = await llega('2026-11-23', '2026-11-23 09:45');
    const { mails, enviar } = transporte({ tiraPara: [gente.uno.email] });
    const errores = callado('error');
    let primera;
    try {
      primera = await corrida('2026-11-24 14:00:00', { enviar });
      assert.ok(!conArroba(errores), 'la consola no lleva direcciones');
    } finally {
      errores.mock.restore();
    }
    assert.deepEqual(primera, resultado({
      selladas: 1, mails: 2, errores: [{ edicion_id: id, usuario_id: gente.uno.id, error: NO_SE_ENVIO }]
    }));
    assert.equal(mails.length, 3);
    assert.equal((await votacionDe(id)).aviso, 'parcial');
  });

  it('si no le llega a nadie: «fallido» y la alerta lo dice', async () => {
    const gente = await laGente();
    const id = await llega('2026-11-23', '2026-11-23 09:45');
    const { enviar } = transporte({ fallaPara: DE_ADMINISTRACION.map((clave) => gente[clave].email) });
    const errores = callado('error');
    try {
      const { mails: enviados, errores: fallas } = await corrida('2026-11-24 14:00:00', { enviar });
      assert.equal(enviados, 0);
      assert.equal(fallas.length, 3);
    } finally {
      errores.mock.restore();
    }
    assert.equal((await votacionDe(id)).aviso, 'fallido');
    assert.deepEqual((await estado()).alertas, [ALERTA_DEL_23_A_NADIE]);
  });

  it('la alerta mira la última regular sellada de los últimos 14 días: una más nueva que salió bien la saca; un piloto no cuenta', async () => {
    const gente = await laGente();
    const id = await llega('2026-11-23', '2026-11-23 09:45');
    const errores = callado('error');
    try {
      await corrida('2026-11-24 14:00:00', { enviar: transporte({ fallaPara: [gente.dos.email] }).enviar });
    } finally {
      errores.mock.restore();
    }
    assert.equal((await votacionDe(id)).aviso, 'parcial');
    assert.deepEqual((await estado('2026-12-08 14:00:00')).alertas, [ALERTA_DEL_23], 'a los 14 días justos, todavía');
    assert.deepEqual((await estado('2026-12-08 14:00:01')).alertas, [], 'después, ya no');

    // Un piloto sellado después no la saca
    await llega('2026-11-30', '2026-11-30 07:00', { piloto: true });
    await corrida('2026-11-30 14:00:00', { enviar: transporte().enviar });
    assert.deepEqual((await estado('2026-11-30 15:00:00')).alertas, [ALERTA_DEL_23]);
    // Una regular más nueva que le llegó a todas, sí
    await llega('2026-12-07', '2026-12-04 15:00');
    await corrida('2026-12-09 14:00:00', { enviar: transporte().enviar });
    assert.deepEqual((await estado('2026-12-09 15:00:00')).alertas, []);
  });

  it('Correos → Estado sin votaciones: sin la alerta, y la línea del correo como siempre', async () => {
    assert.deepEqual(await estado(), { texto: 'El dato de la quincena: sin registro de corridas todavía.', alertas: [] });
  });
});

describe('nunca dos veces (Review Focus 5)', () => {
  it('dos corridas seguidas: un solo mail por persona', async () => {
    const gente = await laGente();
    await llega('2026-11-23', '2026-11-23 09:45');
    const { mails, enviar } = transporte();
    assert.deepEqual(await corrida('2026-11-24 14:00:00', { enviar }), resultado({ selladas: 1, mails: 3 }));
    assert.deepEqual(await corrida('2026-11-24 14:00:30', { enviar }), resultado());
    assert.deepEqual(await corrida('2026-11-25 08:05:00', { enviar }), resultado());
    assert.deepEqual(casillasDe(mails), casillas(gente, DE_ADMINISTRACION));
  });

  it('dos corridas a la vez: un solo mail por persona', async () => {
    const gente = await laGente();
    const id = await llega('2026-11-23', '2026-11-23 09:45');
    const { mails, enviar } = transporte();
    const [una, otra] = await Promise.all([corrida('2026-11-24 14:00:00', { enviar }), corrida('2026-11-24 14:00:00', { enviar })]);
    assert.equal(una.selladas + otra.selladas, 1);
    assert.equal(una.mails + otra.mails, 3);
    assert.deepEqual([...una.errores, ...otra.errores], []);
    assert.deepEqual(casillasDe(mails), casillas(gente, DE_ADMINISTRACION));
    assert.equal((await votacionDe(id)).aviso, 'enviado');
  });

  it('la reserva la garantiza la base, no el candado: sellarLaVotacion da true una sola vez y no pisa lo sellado', async () => {
    await laGente();
    const id = await llega('2026-11-23', '2026-11-23 09:45');
    const sellar = (ahora) => votacionDatos.sellarLaVotacion({ edicionId: id, cierre: '2026-11-24 12:00:00', ahora });
    const dos = await Promise.all([sellar('2026-11-24 14:00:00'), sellar('2026-11-24 14:00:00')]);
    assert.deepEqual(dos.sort(), [false, true]);
    assert.equal(await sellar('2026-11-25 08:05:00'), false);
    assert.deepEqual(await votacionDe(id), { ...SIN_SELLAR, cierre_at: '2026-11-24 12:00:00', sellada_at: '2026-11-24 14:00:00' });
    // Una sellada a mano (la reserva ya tomada) no se vuelve a sellar ni manda el mail
    const { mails, enviar } = transporte();
    assert.deepEqual(await corrida('2026-11-25 08:05:00', { enviar }), resultado());
    assert.deepEqual(mails, []);
  });

  it('con el candado tomado en otra conexión: «ocupada», sin sellar ni mandar nada', async () => {
    await laGente();
    const id = await llega('2026-11-23', '2026-11-23 09:45');
    assert.equal(servicio.BLOQUEO_VOTACION, 'rpad_dato_quincena_votacion');
    const { mails, enviar } = transporte();
    const conexion = await db().getConnection();
    try {
      const [[{ tomado }]] = await conexion.query('SELECT GET_LOCK(?, 5) AS tomado', [servicio.BLOQUEO_VOTACION]);
      assert.equal(Number(tomado), 1);
      assert.deepEqual(await corrida('2026-11-24 14:00:00', { enviar }), resultado({ ocupada: true }));
    } finally {
      await conexion.query('SELECT RELEASE_LOCK(?)', [servicio.BLOQUEO_VOTACION]);
      conexion.release();
    }
    assert.deepEqual(mails, []);
    assert.deepEqual(await votacionDe(id), SIN_SELLAR);
  });

  it('el candado es el suyo: con el del correo del dato de la quincena tomado, sella igual', async () => {
    await laGente();
    await llega('2026-11-23', '2026-11-23 09:45');
    const { enviar } = transporte();
    const conexion = await db().getConnection();
    try {
      await conexion.query('SELECT GET_LOCK(?, 5)', [correo.BLOQUEO_DATO_QUINCENA]);
      assert.deepEqual(await corrida('2026-11-24 14:00:00', { enviar }), resultado({ selladas: 1, mails: 3 }));
    } finally {
      await conexion.query('SELECT RELEASE_LOCK(?)', [correo.BLOQUEO_DATO_QUINCENA]);
      conexion.release();
    }
  });
});

describe('aislado: nunca rechaza', () => {
  it('sin la tabla de las votaciones: un error con un texto fijo, y en la consola solo el código y el mensaje', async () => {
    const errores = callado('error');
    await query('RENAME TABLE dato_quincena_votaciones TO dato_quincena_votaciones_aparte');
    try {
      assert.deepEqual(await servicio.votacionDelDatoQuincenaAislada(CALENDARIO, { ahora: '2026-11-24 14:00:00' }),
        resultado({ errores: [{ edicion_id: null, usuario_id: null, error: EN_LA_CORRIDA }] }));
      assert.ok(errores.mock.calls.length > 0);
      for (const llamada of errores.mock.calls) {
        assert.ok(llamada.arguments.every((arg) => typeof arg === 'string'), 'sin el objeto del error (sin la consulta armada)');
      }
    } finally {
      await query('RENAME TABLE dato_quincena_votaciones_aparte TO dato_quincena_votaciones');
      errores.mock.restore();
    }
  });

  it('una edición que no se puede preparar no se sella (sale en la corrida siguiente) y no frena a las demás', async () => {
    const gente = await laGente();
    const rota = await llega('2026-11-20', '2026-11-20 07:00');
    const buena = await llega('2026-11-23', '2026-11-23 09:45');
    await query("UPDATE dato_quincena_ediciones SET metadata = '{no es json' WHERE id = ?", [rota]);
    const { mails, enviar } = transporte();
    const errores = callado('error');
    let primera;
    try {
      primera = await corrida('2026-11-24 14:00:00', { enviar });
    } finally {
      errores.mock.restore();
    }
    assert.deepEqual(primera, resultado({
      selladas: 1, mails: 3, errores: [{ edicion_id: rota, usuario_id: null, error: 'No se pudo sellar la votación de una edición.' }]
    }));
    assert.deepEqual(await votacionDe(rota), SIN_SELLAR);
    assert.equal((await votacionDe(buena)).aviso, 'enviado');
    assert.deepEqual(casillasDe(mails), casillas(gente, DE_ADMINISTRACION));
  });
});

describe('en las dos corridas (spec, 6)', () => {
  const respuestaFalsa = () => ({ statusCode: 200, body: null, status(codigo) { this.statusCode = codigo; return this; }, json(cuerpo) { this.body = cuerpo; return this; } });
  const conReloj = async (momento, fn) => {
    mock.timers.enable({ apis: ['Date'], now: new Date(`${momento.replace(' ', 'T')}-03:00`) });
    try {
      return await fn();
    } finally {
      mock.timers.reset();
    }
  };
  const lasDe14 = async (momento) => {
    const res = respuestaFalsa();
    await conReloj(momento, () => controlador.ejecutarNotificacionCambiosPendientes({}, res));
    return res;
  };
  const lasDe8 = async (momento) => {
    const res = respuestaFalsa();
    await conReloj(momento, () => controlador.ejecutarNotificacionesDiarias({}, res));
    return res;
  };
  // Sin nadie de administración: la corrida entera no manda ningún mail (el aviso queda «no_corresponde»)
  const soloLectores = async () => {
    const uno = await persona({ clave: 'Uno', rol: 'lector' });
    await aLosQueVotan(uno);
  };

  it('a las 14:00 va en `votacion_dato_quincena`, y antes de las 14:00 del día del cierre la corrida a mano no sella', async () => {
    await soloLectores();
    const id = await llega('2026-11-23', '2026-11-23 09:45');
    const temprano = await lasDe14('2026-11-24 13:30:00');
    assert.equal(temprano.statusCode, 200, JSON.stringify(temprano.body));
    assert.deepEqual(temprano.body.data.votacion_dato_quincena, resultado());
    assert.deepEqual(await votacionDe(id), SIN_SELLAR);
    const res = await lasDe14('2026-11-24 14:00:00');
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.votacion_dato_quincena, resultado({ selladas: 1 }));
    assert.equal((await votacionDe(id)).aviso, 'no_corresponde');
  });

  it('a las 8:05 sella la que cerró un día hábil anterior y no se pudo sellar, y va en `votacion_dato_quincena`', async () => {
    await soloLectores();
    const id = await llega('2026-11-20', '2026-11-20 07:00');
    const res = await lasDe8('2026-11-24 08:05:00');
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.votacion_dato_quincena, resultado({ selladas: 1 }));
    assert.deepEqual(await votacionDe(id), sellada('2026-11-20 12:00:00', '2026-11-24 08:05:00', 'no_corresponde'));
  });

  it('«ocupada» no es un error: las dos corridas siguen en 200', async () => {
    const conexion = await db().getConnection();
    try {
      await conexion.query('SELECT GET_LOCK(?, 5)', [servicio.BLOQUEO_VOTACION]);
      const deTarde = await lasDe14('2026-11-24 14:00:00');
      assert.equal(deTarde.statusCode, 200, JSON.stringify(deTarde.body));
      assert.equal(deTarde.body.data.votacion_dato_quincena.ocupada, true);
      const deMañana = await lasDe8('2026-11-25 08:05:00');
      assert.equal(deMañana.statusCode, 200, JSON.stringify(deMañana.body));
      assert.equal(deMañana.body.data.votacion_dato_quincena.ocupada, true);
    } finally {
      await conexion.query('SELECT RELEASE_LOCK(?)', [servicio.BLOQUEO_VOTACION]);
      conexion.release();
    }
  });

  it('un error suyo da 207, con su tipo a las 8:05 y en `votacion_dato_quincena.errores` a las 14:00, y lo demás sigue', async () => {
    const errores = callado('error');
    await query('RENAME TABLE dato_quincena_votaciones TO dato_quincena_votaciones_aparte');
    try {
      const deMañana = await lasDe8('2026-11-24 08:05:00');
      assert.equal(deMañana.statusCode, 207);
      assert.deepEqual(deMañana.body.data.errores.filter((fallo) => fallo.tipo === 'dato-quincena-votacion'),
        [{ tipo: 'dato-quincena-votacion', edicion_id: null, usuario_id: null, error: EN_LA_CORRIDA }]);
      assert.notEqual(deMañana.body.data.notasDigitales, null);
      assert.notEqual(deMañana.body.data.dato_quincena, null);
      const deTarde = await lasDe14('2026-11-24 14:00:00');
      assert.equal(deTarde.statusCode, 207);
      assert.equal(deTarde.body.success, false);
      assert.match(deTarde.body.message, /^Recordatorios enviados a /);
      assert.equal(deTarde.body.data.votacion_dato_quincena.errores.length, 1);
      const feriado = await lasDe14('2026-11-23 14:00:00');
      assert.equal(feriado.statusCode, 207, 'también un día no hábil');
      assert.equal(feriado.body.message, 'Hoy no es día hábil: no se envían recordatorios.');
    } finally {
      await query('RENAME TABLE dato_quincena_votaciones_aparte TO dato_quincena_votaciones');
      errores.mock.restore();
    }
  });

  it('el orden del código: en las dos, después del correo del dato de la quincena; a las 8:05, antes de esperar al diario; a las 14:00, aunque los recordatorios tiren', () => {
    const fuente = readFileSync(new URL('../controllers/notificacionesController.js', import.meta.url), 'utf8');
    const corridaDe8 = fuente.slice(fuente.indexOf('export const ejecutarNotificacionesDiarias'), fuente.indexOf('export const pruebaAvisoArea'));
    const paso8 = corridaDe8.indexOf('await votacionDelDatoQuincenaAislada(calendario)');
    assert.ok(paso8 > corridaDe8.indexOf('await correoDelDatoQuincenaAislado(calendario)'));
    assert.ok(paso8 < corridaDe8.indexOf('resultados.diario = await diario'));
    const corridaDe14 = fuente.slice(fuente.indexOf('export const ejecutarNotificacionCambiosPendientes'),
      fuente.indexOf('export const ejecutarRecordatoriosDeEventos'));
    const paso14 = corridaDe14.indexOf('await votacionDelDatoQuincenaAislada(calendario)');
    assert.ok(paso14 > corridaDe14.indexOf('await correoDelDatoQuincenaAislado(calendario)'));
    assert.ok(paso14 < corridaDe14.indexOf('if (fallaDeLosRecordatorios) throw'), 'corre aunque los recordatorios tiren');
  });
});
