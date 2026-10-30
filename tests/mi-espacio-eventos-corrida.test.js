// La corrida de los recordatorios de la agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, secciones 3 y 5;
// services/miEspacioEventosCorrida.js): la llama una Tarea Cron cada media hora, solo manda en días hábiles (con los feriados
// de la tabla, leídos en cada corrida: un feriado cargado después mueve el aviso, Review Focus 3), los atrasados solo de 07:00
// a 20:00, nunca dos veces (cada envío se reserva con INSERT IGNORE y uno que falló se reintenta en la misma fila), a quien lo
// creó y a su audiencia activa (Review Focus 4), con su propio candado (no el de las Notas Digitales) y anota cada corrida en
// mi_espacio_eventos_corridas. Contra una base de prueba propia, con personas «Test <clave>» y casillas @rpad.test que cambian
// en cada test. Se llama al servicio y al controlador del cron (nunca a /api/cron/*) con un momento fijo de Argentina
// (mock.timers sobre Date). La corrida manda dentro de la llamada: cuando vuelve, los emails ya están en Mailpit. Mailpit se
// mira solo por las casillas de cada test, o por la marca de su título (otras sesiones pueden compartirlo: no se vacía).
// Las fechas: el sábado 31/10/2026, el lunes 02/11, el martes 03/11, el miércoles 04/11, el jueves 05/11, el viernes 06/11 y
// el lunes 09/11.
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query, db, mailpit, paraCasilla } from './helpers.js';
import { asegurarBaseDePrueba } from './notas-fixtures.js';
import { textoVisible } from './emails-fixtures.js';
import { BLOQUEO_EVENTOS, VENTANA_DE_LA_CORRIDA } from '../services/miEspacioEventosReglas.js';

// Las casillas por defecto de sendEmail (services/emailService.js): las de la DGMIT. Nunca les llega nada de acá
const CASILLAS_POR_DEFECTO = ['datospublicos@comodoro.gov.ar', 'mit@comodoro.gov.ar', 'investigacionterritorial@comodoro.gov.ar'];
const BLOQUEO_DE_LAS_NOTAS = 'rpad_notas_digitales';
const NO_HABIL = 'Día no hábil: no se mandan recordatorios.';
const TABLAS = ['mi_espacio_evento_envios', 'mi_espacio_evento_personas', 'mi_espacio_evento_vistas', 'mi_espacio_eventos',
  'mi_espacio_eventos_corridas', 'feriados', 'usuarios_licencias', 'usuarios'];

let base, dbReal, emailSoloA, corrida, datos, controlador, pool;

before(async () => {
  dbReal = process.env.DB_NAME;
  emailSoloA = process.env.EMAIL_SOLO_A;
  base = await crearBaseDePrueba('rpad_test_mi_espacio_eventos_corrida');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba
  corrida = await import('../services/miEspacioEventosCorrida.js');
  datos = await import('../services/miEspacioEventosDatos.js');
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
  // El .env puede tener la barrera: sin ella, salvo donde se pide
  process.env.EMAIL_SOLO_A = '';
  await asegurarBaseDePrueba();
  for (const tabla of TABLAS) await query(`DELETE FROM ${tabla}`);
});

const sufijo = () => crypto.randomBytes(3).toString('hex');

// Una persona inventada, «Test <clave>», activa y de administración, con una casilla propia de este test, salvo lo que se pida
const persona = async ({ clave = 'persona', rol = 'admin', activo = 1, email = null } = {}) => {
  const username = `t_ev_${sufijo()}`;
  const casilla = email ?? `${username}@rpad.test`;
  const { insertId: id } = await query(
    `INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES (?, 'x', ?, ?, ?, ?)`,
    [username, `Test ${clave}`, casilla, rol, activo]
  );
  return { id, email: casilla };
};

// Un evento por SQL (el martes 03/11/2026 de 10:00 a 11:00 con «2 horas antes», personal), con lo que cambia cada caso.
// `personas`: las elegidas, con su recordatorio; `apagados`: filas con el recordatorio apagado (con «Todos», las únicas filas).
// Compartido si es para todos o tiene alguna fila
const evento = async ({
  creador, titulo = 'Reunión de equipo', detalle = null, fecha = '2026-11-03', desde = '10:00', hasta = '11:00',
  recordatorio = '2h', personas = [], apagados = [], paraTodos = false, activo = 1
}) => {
  const compartido = paraTodos || personas.length + apagados.length > 0;
  const { insertId: id } = await query(
    `INSERT INTO mi_espacio_eventos (creado_por, titulo, detalle, fecha, desde, hasta, compartido, para_todos, recordatorio, activo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [creador.id, titulo, detalle, fecha, desde, hasta, compartido ? 1 : 0, paraTodos ? 1 : 0, recordatorio, activo]
  );
  for (const [quien, apagado] of [...personas.map((p) => [p, 0]), ...apagados.map((p) => [p, 1])]) {
    await query('INSERT INTO mi_espacio_evento_personas (evento_id, usuario_id, sin_recordatorio) VALUES (?, ?, ?)',
      [id, quien.id, apagado]);
  }
  return id;
};

// Un Personal (Público) por SQL (spec 2026-10-29-mi-espacio-evento-publico, 6.1: compartido y para_todos en 0), el martes 03/11
// de 10:00 a 11:00 con «2 horas antes»: con «Todos» (`todos`) o con `vistas`, las personas a quienes se les muestra.
// `compartido` y `paraTodos` en 1 son datos mal, para la defensa
const publico = async ({
  creador, todos = false, vistas = [], compartido = 0, paraTodos = 0, titulo = 'Turno con el dentista'
}) => {
  const { insertId: id } = await query(
    `INSERT INTO mi_espacio_eventos (creado_por, titulo, detalle, fecha, desde, hasta, compartido, para_todos, publico,
       publico_todos, texto_publico, recordatorio)
     VALUES (?, ?, 'Llevar el carnet', '2026-11-03', '10:00', '11:00', ?, ?, 1, ?, 'Turno médico', '2h')`,
    [creador.id, titulo, compartido, paraTodos, todos ? 1 : 0]
  );
  for (const quien of vistas) {
    await query('INSERT INTO mi_espacio_evento_vistas (evento_id, usuario_id) VALUES (?, ?)', [id, quien.id]);
  }
  return id;
};

const conFeriado = (fecha) =>
  query("INSERT INTO feriados (fecha, nombre, tipo, se_repite) VALUES (?, 'Feriado de prueba', 'nacional', 0)", [fecha]);

// Un momento de Argentina, 'AAAA-MM-DD HH:MM', como Date (UTC − 3: las 07:30 son las 10:30 UTC)
const aLas = (momento) => new Date(`${momento.replace(' ', 'T')}:00-03:00`);

// La corrida (el servicio, como lo llama el cron) en un momento fijo de Argentina
const corridaA = async (momento) => {
  mock.timers.enable({ apis: ['Date'], now: aLas(momento) });
  try {
    return await corrida.ejecutarRecordatoriosDeEventos();
  } finally {
    mock.timers.reset();
  }
};

// El controlador del cron (sin pasar por /api/cron/*) en un momento fijo. Devuelve lo que respondió
const cronA = async (momento) => {
  const res = {
    statusCode: null, body: null,
    status(codigo) { this.statusCode = codigo; return this; },
    json(cuerpo) { this.body = cuerpo; return this; }
  };
  mock.timers.enable({ apis: ['Date'], now: aLas(momento) });
  try {
    await controlador.ejecutarRecordatoriosDeEventos({}, res);
  } finally {
    mock.timers.reset();
  }
  return res;
};

// Lo que devuelve una corrida que corrió, con lo que cambia cada caso
const resultado = (cambios = {}) => ({ ocupada: false, dia_habil: true, enviados: 0, fallidos: 0, errores: [], ...cambios });

// Los envíos anotados de un evento, por persona
const enviosDe = async (eventoId) => (await query(
  `SELECT usuario_id, tipo, DATE_FORMAT(para, '%Y-%m-%d %H:%i') AS para,
     DATE_FORMAT(enviado_at, '%Y-%m-%d %H:%i:%s') AS enviado_at, success
   FROM mi_espacio_evento_envios WHERE evento_id = ? ORDER BY usuario_id, id`, [eventoId]
)).map((fila) => ({ ...fila, usuario_id: Number(fila.usuario_id), success: Number(fila.success) }));
// Un envío de recordatorio que salió (o no, con success 0) a esa hora
const enviado = (quien, para, enviadoAt, success = 1) =>
  ({ usuario_id: quien.id, tipo: 'recordatorio', para, enviado_at: enviadoAt, success });

const ultimaCorrida = async () => query(
  `SELECT DATE_FORMAT(inicio_at, '%Y-%m-%d %H:%i:%s') AS inicio_at, DATE_FORMAT(fin_at, '%Y-%m-%d %H:%i:%s') AS fin_at,
     resultado, con_errores
   FROM mi_espacio_eventos_corridas ORDER BY id`
);
const bloqueoLibre = async (nombre = BLOQUEO_EVENTOS) =>
  Number((await query('SELECT IS_FREE_LOCK(?) AS libre', [nombre]))[0].libre) === 1;

// Los emails de Mailpit a una casilla (solo los suyos: Mailpit puede tener los de otras sesiones)
const recibidos = async (email) => (await mailpit.mensajes()).filter(paraCasilla(email));
// Los de una casilla, esperando (hasta unos 5 s) a que haya al menos `cantidad`
const esperarDe = async (email, cantidad = 1) => {
  let mensajes = await recibidos(email);
  for (let intento = 0; intento < 50 && mensajes.length < cantidad; intento++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    mensajes = await recibidos(email);
  }
  return mensajes;
};
const asuntosDe = async (email, cantidad) => (await esperarDe(email, cantidad)).map((mensaje) => mensaje.Subject).sort();

// Corre fn con otra conexión que tiene tomado el candado `nombre` (otra corrida, en otro proceso) y lo libera al final
const conCandadoAjeno = async (nombre, fn) => {
  const otra = await db().getConnection();
  try {
    const [[{ tomado }]] = await otra.query('SELECT GET_LOCK(?, 0) AS tomado', [nombre]);
    assert.equal(Number(tomado), 1);
    return await fn(otra);
  } finally {
    await otra.query('SELECT RELEASE_LOCK(?)', [nombre]);
    otra.release();
  }
};

// Corre fn con la anotación de un envío de una persona rota (un trigger rechaza el UPDATE: el email sale y no se anota)
const conAnotacionQueFalla = async (usuarioId, fn) => {
  await query('DROP TRIGGER IF EXISTS falla_simulada_mi_espacio_evento_envios');
  await query(`CREATE TRIGGER falla_simulada_mi_espacio_evento_envios BEFORE UPDATE ON mi_espacio_evento_envios FOR EACH ROW
    BEGIN
      IF NEW.usuario_id = ${Number(usuarioId)} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falla simulada'; END IF;
    END`);
  try {
    return await fn();
  } finally {
    await query('DROP TRIGGER IF EXISTS falla_simulada_mi_espacio_evento_envios');
  }
};

// Corre fn con una tabla renombrada (como si faltara) y la consola de errores callada; devuelve lo que devolvió fn y lo que
// se escribió en la consola (el primer argumento de cada llamada)
const sinLaTabla = async (tabla, fn) => {
  const log = mock.method(console, 'error', () => {});
  await query(`RENAME TABLE ${tabla} TO ${tabla}_aparte`);
  try {
    return { devuelto: await fn(), consola: log.mock.calls.map((llamada) => llamada.arguments) };
  } finally {
    await query(`RENAME TABLE ${tabla}_aparte TO ${tabla}`);
    log.mock.restore();
  }
};

describe('eventosParaLaCorrida: los eventos de la corrida, en lote', () => {
  it('los activos con recordatorio de hoy a hoy + 15, con sus destinatarios y solo sus envíos de recordatorio', async () => {
    assert.equal(VENTANA_DE_LA_CORRIDA, 15);
    const adminA = await persona({ clave: 'adminA' });
    const adminB = await persona({ clave: 'adminB' });
    await evento({ creador: adminA, fecha: '2026-11-02' });
    const deHoy = await evento({ creador: adminA, personas: [adminB], detalle: 'Sala 1.' });
    const delFinal = await evento({ creador: adminA, fecha: '2026-11-18', desde: '09:30', hasta: null, recordatorio: 'dia_anterior' });
    await evento({ creador: adminA, fecha: '2026-11-19' });
    await evento({ creador: adminA, recordatorio: 'ninguno' });
    await evento({ creador: adminA, activo: 0 });
    // Un recordatorio que falló (terminado), una reserva sin terminar y una invitación con el mismo `para`, que no va
    await query(
      `INSERT INTO mi_espacio_evento_envios (evento_id, usuario_id, tipo, para, enviado_at, success) VALUES
       (?, ?, 'recordatorio', '2026-11-03 10:00:00', '2026-11-03 08:00:00', 0),
       (?, ?, 'recordatorio', '2026-11-03 10:00:00', NULL, 0),
       (?, ?, 'invitacion', '2026-11-03 10:00:00', '2026-11-01 12:00:00', 1)`,
      [deHoy, adminB.id, deHoy, adminA.id, deHoy, adminB.id]
    );

    const eventos = await datos.eventosParaLaCorrida('2026-11-03');
    assert.deepEqual(eventos.map((e) => e.id), [deHoy, delFinal]);
    assert.deepEqual(eventos[0], {
      id: deHoy, creado_por: adminA.id, titulo: 'Reunión de equipo', detalle: 'Sala 1.', fecha: '2026-11-03', desde: '10:00',
      hasta: '11:00', recordatorio: '2h', compartido: true, para_todos: false, publico: false,
      destinatarios: [
        { usuario_id: adminA.id, email: adminA.email, sin_recordatorio: false },
        { usuario_id: adminB.id, email: adminB.email, sin_recordatorio: false }
      ],
      // `para` sin los segundos (igual a 'fecha desde'), y success y terminado como números
      envios: [
        { usuario_id: adminA.id, para: '2026-11-03 10:00', success: 0, terminado: 0 },
        { usuario_id: adminB.id, para: '2026-11-03 10:00', success: 0, terminado: 1 }
      ]
    });
    assert.deepEqual(eventos[1], {
      id: delFinal, creado_por: adminA.id, titulo: 'Reunión de equipo', detalle: null, fecha: '2026-11-18', desde: '09:30',
      hasta: null, recordatorio: 'dia_anterior', compartido: false, para_todos: false, publico: false,
      destinatarios: [{ usuario_id: adminA.id, email: adminA.email, sin_recordatorio: false }], envios: []
    });
    // Sin un hoy, nada
    for (const raro of [undefined, null, '2026-02-30', 'hoy']) assert.deepEqual(await datos.eventosParaLaCorrida(raro), []);
  });

  it('sin N+1: unas pocas consultas, las mismas con 2 eventos que con 12 (riesgo 22)', async () => {
    const consultas = async () => {
      let cantidad = 0;
      const conexion = { query: (...argumentos) => { cantidad += 1; return pool.query(...argumentos); } };
      const eventos = await datos.eventosParaLaCorrida('2026-11-03', conexion);
      return { cantidad, eventos: eventos.length };
    };
    const adminA = await persona({ clave: 'adminA' });
    const adminB = await persona({ clave: 'adminB' });
    await evento({ creador: adminA, personas: [adminB] });
    await evento({ creador: adminB, paraTodos: true });
    const conDos = await consultas();
    for (let n = 0; n < 5; n++) {
      await evento({ creador: adminA, personas: [adminB], fecha: '2026-11-04' });
      await evento({ creador: adminB, paraTodos: true, apagados: [adminA], fecha: '2026-11-05' });
    }
    const conDoce = await consultas();
    assert.equal(conDos.eventos, 2);
    assert.equal(conDoce.eventos, 12);
    assert.ok(conDos.cantidad <= 4, String(conDos.cantidad));
    assert.equal(conDoce.cantidad, conDos.cantidad);
  });

  it('los destinatarios son quien lo creó, si está activo, y su audienciaDe (Review Focus 4): las mismas personas', async () => {
    const adminA = await persona({ clave: 'adminA' });
    const adminB = await persona({ clave: 'adminB' });
    const editor = await persona({ clave: 'editor', rol: 'editor' });
    const superadmin = await persona({ clave: 'superadmin', rol: 'superadmin' });
    await persona({ clave: 'lector', rol: 'lector' });
    await persona({ clave: 'colab', rol: 'colaborador' });
    // Dejó de ser administración: sigue en los eventos en que la eligieron, no en los «para todos»
    const exAdmin = await persona({ clave: 'exAdmin', rol: 'lector' });
    const desactivada = await persona({ clave: 'desactivada', activo: 0 });
    const apagada = await persona({ clave: 'apagada' });

    const ids = [
      await evento({ creador: adminA }),
      await evento({ creador: adminA, personas: [adminB, exAdmin, desactivada], apagados: [apagada] }),
      await evento({ creador: adminA, paraTodos: true, apagados: [apagada, exAdmin] }),
      await evento({ creador: desactivada, personas: [adminB, adminA] }),
      await evento({ creador: desactivada, paraTodos: true })
    ];
    const eventos = await datos.eventosParaLaCorrida('2026-11-03');
    assert.deepEqual(eventos.map((e) => e.id), ids);
    const porId = (lista) => [...lista].sort((a, b) => a.usuario_id - b.usuario_id);
    const activos = new Set([adminA, adminB, editor, superadmin, exAdmin, apagada].map((quien) => quien.id));
    for (const e of eventos) {
      const creador = activos.has(e.creado_por)
        ? [{ usuario_id: e.creado_por, email: (await query('SELECT email FROM usuarios WHERE id = ?', [e.creado_por]))[0].email,
          sin_recordatorio: false }]
        : [];
      const audiencia = (await datos.audienciaDe(e))
        .map((p) => ({ usuario_id: p.id, email: p.email, sin_recordatorio: p.sin_recordatorio }));
      assert.deepEqual(porId(e.destinatarios), porId([...creador, ...audiencia]), `evento ${e.id}`);
    }
    // Y no son listas vacías: quiénes son, por evento
    const quienes = (e) => porId(e.destinatarios).map((d) => [d.usuario_id, d.sin_recordatorio]);
    const ordenar = (lista) => [...lista].sort((a, b) => a[0] - b[0]);
    assert.deepEqual(quienes(eventos[0]), [[adminA.id, false]]);
    assert.deepEqual(quienes(eventos[1]), ordenar([[adminA.id, false], [adminB.id, false], [exAdmin.id, false], [apagada.id, true]]));
    assert.deepEqual(quienes(eventos[2]), ordenar([[adminA.id, false], [adminB.id, false], [editor.id, false],
      [superadmin.id, false], [apagada.id, true]]));
    assert.deepEqual(quienes(eventos[3]), ordenar([[adminA.id, false], [adminB.id, false]]));
    assert.deepEqual(quienes(eventos[4]), ordenar([[adminA.id, false], [adminB.id, false], [editor.id, false],
      [superadmin.id, false], [apagada.id, false]]));
  });
});

describe('la corrida de los recordatorios', () => {
  it('uno de adminA compartido con adminB, el martes 03/11 a las 10:00 con «2 horas antes»: a las 07:30 nada; a las 08:00, '
    + 'uno a cada uno; a las 08:30, ninguno más', async () => {
    const adminA = await persona({ clave: 'adminA' });
    const adminB = await persona({ clave: 'adminB' });
    const id = await evento({ creador: adminA, personas: [adminB], detalle: 'Sala de reuniones.' });

    assert.deepEqual(await corridaA('2026-11-03 07:30'), resultado());
    assert.deepEqual(await enviosDe(id), []);

    assert.deepEqual(await corridaA('2026-11-03 08:00'), resultado({ enviados: 2 }));
    assert.deepEqual(await enviosDe(id), [adminA, adminB].map((quien) =>
      enviado(quien, '2026-11-03 10:00', '2026-11-03 08:00:00')));
    for (const quien of [adminA, adminB]) {
      const [mensaje] = await esperarDe(quien.email);
      assert.equal(mensaje.Subject, 'RPAD: Reunión de equipo, hoy a las 10:00');
      assert.deepEqual(mensaje.To.map((to) => to.Address), [quien.email]);
      assert.deepEqual([...mensaje.Cc ?? [], ...mensaje.Bcc ?? []], []);
      assert.equal(mensaje.From.Name, 'Dir. de Datos Públicos y Comunicación');
      const texto = textoVisible(await mailpit.html(mensaje.ID));
      assert.ok(texto.includes('Recordatorio Hoy a las 10:00: Reunión de equipo Sala de reuniones. Ver en Mi espacio'), texto);
    }

    assert.deepEqual(await corridaA('2026-11-03 08:30'), resultado());
    for (const quien of [adminA, adminB]) assert.equal((await recibidos(quien.email)).length, 1);
    assert.equal((await enviosDe(id)).length, 2);
    assert.equal(await bloqueoLibre(), true);
  });

  it('creado a las 09:45, la corrida de las 10:00 no manda nada: el evento ya empezó', async () => {
    const adminA = await persona({ clave: 'adminA' });
    const adminB = await persona({ clave: 'adminB' });
    const id = await evento({ creador: adminA, personas: [adminB] });
    assert.deepEqual(await corridaA('2026-11-03 10:00'), resultado());
    assert.deepEqual(await enviosDe(id), []);
    for (const quien of [adminA, adminB]) assert.deepEqual(await recibidos(quien.email), []);
  });

  it('con el recordatorio de adminB apagado, solo a adminA', async () => {
    const adminA = await persona({ clave: 'adminA' });
    const adminB = await persona({ clave: 'adminB' });
    const id = await evento({ creador: adminA, apagados: [adminB] });
    assert.deepEqual(await corridaA('2026-11-03 08:00'), resultado({ enviados: 1 }));
    assert.deepEqual(await enviosDe(id), [enviado(adminA, '2026-11-03 10:00', '2026-11-03 08:00:00')]);
    assert.equal((await esperarDe(adminA.email)).length, 1);
    assert.deepEqual(await recibidos(adminB.email), []);
  });

  // El Personal (Público) (spec 2026-10-29-mi-espacio-evento-publico, 2.6 y 6.7): su recordatorio, como el de un Privado, le
  // llega solo a quien lo creó; a los que lo ven, nada
  it('un Personal (Público), para todos o con personas, le manda un solo recordatorio por evento: el de quien lo creó',
    async () => {
      const lector = await persona({ clave: 'lector', rol: 'lector' });
      const adminB = await persona({ clave: 'adminB' });
      const editor = await persona({ clave: 'editor', rol: 'editor' });
      const colab = await persona({ clave: 'colab', rol: 'colaborador' });
      const superadmin = await persona({ clave: 'superadmin', rol: 'superadmin' });
      const paraTodos = await publico({ creador: lector, todos: true });
      const conVistas = await publico({ creador: adminB, vistas: [editor, colab] });

      const eventos = await datos.eventosParaLaCorrida('2026-11-03');
      assert.deepEqual(eventos.map((e) => [e.id, e.publico, e.compartido, e.para_todos, e.destinatarios]), [
        [paraTodos, true, false, false, [{ usuario_id: lector.id, email: lector.email, sin_recordatorio: false }]],
        [conVistas, true, false, false, [{ usuario_id: adminB.id, email: adminB.email, sin_recordatorio: false }]]
      ]);

      assert.deepEqual(await corridaA('2026-11-03 08:00'), resultado({ enviados: 2 }));
      assert.deepEqual(await enviosDe(paraTodos), [enviado(lector, '2026-11-03 10:00', '2026-11-03 08:00:00')]);
      assert.deepEqual(await enviosDe(conVistas), [enviado(adminB, '2026-11-03 10:00', '2026-11-03 08:00:00')]);
      assert.deepEqual(await asuntosDe(lector.email, 1), ['RPAD: Turno con el dentista, hoy a las 10:00']);
      assert.deepEqual(await asuntosDe(adminB.email, 1), ['RPAD: Turno con el dentista, hoy a las 10:00']);
      for (const quien of [editor, colab, superadmin]) assert.deepEqual(await recibidos(quien.email), []);
      // Una corrida más no repite nada
      assert.deepEqual(await corridaA('2026-11-03 08:30'), resultado());
    });

  it('la defensa: un Público con compartido y para_todos en 1 (datos mal, por SQL) le llega solo a quien lo creó, y '
    + 'audienciaDe da []', async () => {
    const marca = sufijo();
    const adminA = await persona({ clave: 'adminA' });
    const adminB = await persona({ clave: 'adminB' });
    const editor = await persona({ clave: 'editor', rol: 'editor' });
    const id = await publico({ creador: adminA, vistas: [adminB], compartido: 1, paraTodos: 1, titulo: `Turno ${marca}` });
    // Y una fila de personas, como si quedara de un Laboral
    await query('INSERT INTO mi_espacio_evento_personas (evento_id, usuario_id) VALUES (?, ?)', [id, editor.id]);

    assert.deepEqual(await datos.audienciaDe({ id, creado_por: adminA.id, compartido: 1, para_todos: 1, publico: 1 }), []);
    assert.deepEqual(await datos.audienciaDe({ id, creado_por: adminA.id, compartido: true, para_todos: false, publico: true }),
      []);
    const [delEvento] = await datos.eventosParaLaCorrida('2026-11-03');
    assert.deepEqual(delEvento.destinatarios, [{ usuario_id: adminA.id, email: adminA.email, sin_recordatorio: false }]);

    assert.deepEqual(await corridaA('2026-11-03 08:00'), resultado({ enviados: 1 }));
    assert.deepEqual(await enviosDe(id), [enviado(adminA, '2026-11-03 10:00', '2026-11-03 08:00:00')]);
    assert.equal((await esperarDe(adminA.email)).length, 1);
    for (const quien of [adminB, editor]) assert.deepEqual(await recibidos(quien.email), []);
    const delTest = (await mailpit.mensajes()).filter((mensaje) => mensaje.Subject.includes(marca));
    assert.deepEqual(delTest.flatMap((mensaje) => mensaje.To.map((to) => to.Address)), [adminA.email]);
  });

  it('pasado a las 15:00 después de avisar, sale otra vez a las 13:00, con otra fila', async () => {
    const adminA = await persona({ clave: 'adminA' });
    const adminB = await persona({ clave: 'adminB' });
    const id = await evento({ creador: adminA, personas: [adminB] });
    assert.deepEqual(await corridaA('2026-11-03 08:00'), resultado({ enviados: 2 }));
    await query("UPDATE mi_espacio_eventos SET desde = '15:00', hasta = '16:00' WHERE id = ?", [id]);

    assert.deepEqual(await corridaA('2026-11-03 12:30'), resultado());
    assert.deepEqual(await corridaA('2026-11-03 13:00'), resultado({ enviados: 2 }));
    assert.deepEqual(await enviosDe(id), [adminA, adminA, adminB, adminB].map((quien, i) => (i % 2 === 0
      ? enviado(quien, '2026-11-03 10:00', '2026-11-03 08:00:00')
      : enviado(quien, '2026-11-03 15:00', '2026-11-03 13:00:00'))));
    for (const quien of [adminA, adminB]) {
      assert.deepEqual(await asuntosDe(quien.email, 2),
        ['RPAD: Reunión de equipo, hoy a las 10:00', 'RPAD: Reunión de equipo, hoy a las 15:00']);
    }
  });

  it('un envío que falla queda con success = 0 y la corrida siguiente lo reintenta en la misma fila, leída de la base', async () => {
    const adminA = await persona({ clave: 'adminA' });
    const adminB = await persona({ clave: 'adminB' });
    const id = await evento({ creador: adminA, personas: [adminB] });

    // Con la barrera, sendEmail no manda (y avisa en la consola, que acá se calla)
    process.env.EMAIL_SOLO_A = 'nadie@rpad.test';
    const aviso = mock.method(console, 'warn', () => {});
    let fallida;
    try {
      fallida = await corridaA('2026-11-03 08:00');
    } finally {
      aviso.mock.restore();
      process.env.EMAIL_SOLO_A = '';
    }
    assert.deepEqual(fallida, resultado({ fallidos: 2 }));
    assert.deepEqual(await enviosDe(id), [adminA, adminB].map((quien) =>
      enviado(quien, '2026-11-03 10:00', '2026-11-03 08:00:00', 0)));
    assert.deepEqual(await ultimaCorrida(), [{
      inicio_at: '2026-11-03 08:00:00', fin_at: '2026-11-03 08:00:00', resultado: 'Recordatorios enviados: 0. Fallidos: 2.',
      con_errores: 1
    }]);

    assert.deepEqual(await corridaA('2026-11-03 08:30'), resultado({ enviados: 2 }));
    // Una sola fila por persona: el reintento usa la misma
    assert.deepEqual(await enviosDe(id), [adminA, adminB].map((quien) =>
      enviado(quien, '2026-11-03 10:00', '2026-11-03 08:30:00')));
    for (const quien of [adminA, adminB]) assert.equal((await esperarDe(quien.email)).length, 1);
    assert.deepEqual(await corridaA('2026-11-03 09:00'), resultado());
    for (const quien of [adminA, adminB]) assert.equal((await recibidos(quien.email)).length, 1);
  });

  it('una reserva sin terminar (enviado_at NULL: pudo haber salido) no se repite: a adminB no le llega', async () => {
    const adminA = await persona({ clave: 'adminA' });
    const adminB = await persona({ clave: 'adminB' });
    const id = await evento({ creador: adminA, personas: [adminB] });
    await query(
      `INSERT INTO mi_espacio_evento_envios (evento_id, usuario_id, tipo, para, enviado_at, success)
       VALUES (?, ?, 'recordatorio', '2026-11-03 10:00:00', NULL, 0)`, [id, adminB.id]
    );
    assert.deepEqual(await corridaA('2026-11-03 08:00'), resultado({ enviados: 1 }));
    assert.deepEqual(await enviosDe(id), [
      enviado(adminA, '2026-11-03 10:00', '2026-11-03 08:00:00'), enviado(adminB, '2026-11-03 10:00', null, 0)
    ]);
    assert.equal((await esperarDe(adminA.email)).length, 1);
    assert.deepEqual(await recibidos(adminB.email), []);
  });

  it('dos corridas a la vez no mandan dos veces', async () => {
    const adminA = await persona({ clave: 'adminA' });
    const adminB = await persona({ clave: 'adminB' });
    const id = await evento({ creador: adminA, personas: [adminB] });
    mock.timers.enable({ apis: ['Date'], now: aLas('2026-11-03 08:00') });
    let corridas;
    try {
      corridas = await Promise.all([corrida.ejecutarRecordatoriosDeEventos(), corrida.ejecutarRecordatoriosDeEventos()]);
    } finally {
      mock.timers.reset();
    }
    assert.equal(corridas.reduce((total, una) => total + una.enviados, 0), 2, JSON.stringify(corridas));
    assert.equal((await enviosDe(id)).length, 2);
    for (const quien of [adminA, adminB]) assert.equal((await esperarDe(quien.email)).length, 1);
  });

  describe('los días hábiles y los atrasados', () => {
    it('un sábado no manda nada: uno del sábado 31/10 a las 12:00 con «1 hora antes», a las 11:00', async () => {
      const adminA = await persona({ clave: 'adminA' });
      const id = await evento({ creador: adminA, fecha: '2026-10-31', desde: '12:00', hasta: '13:00', recordatorio: '1h' });
      assert.deepEqual(await corridaA('2026-10-31 11:00'), resultado({ dia_habil: false }));
      assert.deepEqual(await enviosDe(id), []);
      assert.deepEqual(await recibidos(adminA.email), []);
    });

    it('atrasado: uno del lunes 02/11 a las 10:00 con «el día hábil anterior», cargado el sábado, no sale a las 00:00 ni a '
      + 'las 06:30 del lunes y sale a las 07:00', async () => {
      const adminA = await persona({ clave: 'adminA' });
      const id = await evento({ creador: adminA, fecha: '2026-11-02', recordatorio: 'dia_anterior' });
      assert.deepEqual(await corridaA('2026-10-31 15:00'), resultado({ dia_habil: false }));
      assert.deepEqual(await corridaA('2026-11-02 00:00'), resultado());
      assert.deepEqual(await corridaA('2026-11-02 06:30'), resultado());
      assert.deepEqual(await enviosDe(id), []);
      assert.deepEqual(await corridaA('2026-11-02 07:00'), resultado({ enviados: 1 }));
      assert.deepEqual(await enviosDe(id), [enviado(adminA, '2026-11-02 10:00', '2026-11-02 07:00:00')]);
      assert.deepEqual(await asuntosDe(adminA.email, 1), ['RPAD: Reunión de equipo, hoy a las 10:00']);
    });

    it('a tiempo, antes de las 07:00: uno del martes 03/11 a las 08:00 con «2 horas antes» sale a las 06:00', async () => {
      const adminA = await persona({ clave: 'adminA' });
      const id = await evento({ creador: adminA, desde: '08:00', hasta: '09:00' });
      assert.deepEqual(await corridaA('2026-11-03 05:30'), resultado());
      assert.deepEqual(await corridaA('2026-11-03 06:00'), resultado({ enviados: 1 }));
      assert.deepEqual(await enviosDe(id), [enviado(adminA, '2026-11-03 08:00', '2026-11-03 06:00:00')]);
      assert.deepEqual(await asuntosDe(adminA.email, 1), ['RPAD: Reunión de equipo, hoy a las 08:00']);
    });

    it('creado el lunes 02/11 a las 22:00 para el martes 03/11 a las 08:00 con «el día hábil anterior»: no sale a las 22:30 y '
      + 'sale el martes a las 07:00', async () => {
      const adminA = await persona({ clave: 'adminA' });
      const id = await evento({ creador: adminA, desde: '08:00', hasta: '09:00', recordatorio: 'dia_anterior' });
      assert.deepEqual(await corridaA('2026-11-02 22:30'), resultado());
      assert.deepEqual(await corridaA('2026-11-03 06:30'), resultado());
      assert.deepEqual(await enviosDe(id), []);
      assert.deepEqual(await corridaA('2026-11-03 07:00'), resultado({ enviados: 1 }));
      assert.deepEqual(await enviosDe(id), [enviado(adminA, '2026-11-03 08:00', '2026-11-03 07:00:00')]);
    });

    it('creado el martes 03/11 a las 15:00 para el miércoles 04/11 a las 10:00 con «el día hábil anterior»: sale el martes a '
      + 'las 15:30', async () => {
      const adminA = await persona({ clave: 'adminA' });
      const id = await evento({ creador: adminA, fecha: '2026-11-04', recordatorio: 'dia_anterior' });
      assert.deepEqual(await corridaA('2026-11-03 15:30'), resultado({ enviados: 1 }));
      assert.deepEqual(await enviosDe(id), [enviado(adminA, '2026-11-04 10:00', '2026-11-03 15:30:00')]);
      assert.deepEqual(await asuntosDe(adminA.email, 1), ['RPAD: Reunión de equipo, mañana a las 10:00']);
    });

    it('un atrasado sale a las 19:30; a las 20:00 ya no, y espera a las 07:00 del día hábil siguiente', async () => {
      const adminA = await persona({ clave: 'adminA' });
      const temprano = await evento({ creador: adminA, fecha: '2026-11-04', recordatorio: 'dia_anterior' });
      assert.deepEqual(await corridaA('2026-11-03 19:30'), resultado({ enviados: 1 }));
      assert.deepEqual((await enviosDe(temprano)).map((e) => e.enviado_at), ['2026-11-03 19:30:00']);

      const tarde = await evento({ creador: adminA, titulo: 'Otra reunión', fecha: '2026-11-04', recordatorio: 'dia_anterior' });
      assert.deepEqual(await corridaA('2026-11-03 20:00'), resultado());
      assert.deepEqual(await corridaA('2026-11-03 23:30'), resultado());
      assert.deepEqual(await corridaA('2026-11-04 06:30'), resultado());
      assert.deepEqual(await enviosDe(tarde), []);
      assert.deepEqual(await corridaA('2026-11-04 07:00'), resultado({ enviados: 1 }));
      assert.deepEqual(await enviosDe(tarde), [enviado(adminA, '2026-11-04 10:00', '2026-11-04 07:00:00')]);
      assert.deepEqual(await asuntosDe(adminA.email, 2),
        ['RPAD: Otra reunión, hoy a las 10:00', 'RPAD: Reunión de equipo, mañana a las 10:00']);
    });

    it('con un feriado el martes 03/11, ese día no manda nada (el aviso pasó al lunes 02/11)', async () => {
      const adminA = await persona({ clave: 'adminA' });
      await conFeriado('2026-11-03');
      const id = await evento({ creador: adminA });
      assert.deepEqual(await corridaA('2026-11-03 08:00'), resultado({ dia_habil: false }));
      assert.deepEqual(await enviosDe(id), []);
      assert.deepEqual(await corridaA('2026-11-02 08:00'), resultado({ enviados: 1 }));
      assert.deepEqual(await asuntosDe(adminA.email, 1), ['RPAD: Reunión de equipo, mañana a las 10:00']);
    });

    it('Review Focus 3: uno del lunes 09/11 a las 10:00 con «el día hábil anterior» sale el viernes 06/11 a las 10:00',
      async () => {
        const adminA = await persona({ clave: 'adminA' });
        const id = await evento({ creador: adminA, fecha: '2026-11-09', recordatorio: 'dia_anterior' });
        assert.deepEqual(await corridaA('2026-11-05 10:00'), resultado());
        assert.deepEqual(await corridaA('2026-11-06 09:30'), resultado());
        assert.deepEqual(await corridaA('2026-11-06 10:00'), resultado({ enviados: 1 }));
        assert.deepEqual(await enviosDe(id), [enviado(adminA, '2026-11-09 10:00', '2026-11-06 10:00:00')]);
        assert.deepEqual(await asuntosDe(adminA.email, 1), ['RPAD: Reunión de equipo, el lunes 09/11 a las 10:00']);
      });

    it('Review Focus 3: con un feriado cargado el 06/11 después de crearlo, sale el jueves 05/11 a las 10:00', async () => {
      const adminA = await persona({ clave: 'adminA' });
      const id = await evento({ creador: adminA, fecha: '2026-11-09', recordatorio: 'dia_anterior' });
      assert.deepEqual(await corridaA('2026-11-05 10:00'), resultado());
      // El feriado se carga después: la corrida siguiente ya lo usa (el aviso nunca se guarda)
      await conFeriado('2026-11-06');
      assert.deepEqual(await corridaA('2026-11-05 10:00'), resultado({ enviados: 1 }));
      assert.deepEqual(await enviosDe(id), [enviado(adminA, '2026-11-09 10:00', '2026-11-05 10:00:00')]);
      assert.deepEqual(await corridaA('2026-11-06 10:00'), resultado({ dia_habil: false }));
      assert.equal((await esperarDe(adminA.email)).length, 1);
    });
  });

  describe('a quién le llega', () => {
    it('adminB, con una licencia de Configuración ese día, lo recibe; la desactivada (Review Focus 4) o sin email, no; nada a '
      + 'otras casillas', async () => {
      const marca = sufijo();
      const adminA = await persona({ clave: 'adminA' });
      const adminB = await persona({ clave: 'adminB' });
      await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [adminB.id, '2026-11-02', '2026-11-06']);
      const desactivada = await persona({ clave: 'desactivada', activo: 0 });
      const sinEmail = await persona({ clave: 'sinEmail', email: `sin-arroba-${sufijo()}` });
      const exAdmin = await persona({ clave: 'exAdmin', rol: 'lector' });
      const id = await evento({ creador: adminA, titulo: `Reunión ${marca}`, personas: [adminB, desactivada, sinEmail, exAdmin] });

      assert.deepEqual(await corridaA('2026-11-03 08:00'), resultado({ enviados: 3 }));
      assert.deepEqual((await enviosDe(id)).map((envio) => envio.usuario_id), [adminA.id, adminB.id, exAdmin.id].sort((a, b) => a - b));
      for (const quien of [adminA, adminB, exAdmin]) {
        assert.deepEqual(await asuntosDe(quien.email, 1), [`RPAD: Reunión ${marca}, hoy a las 10:00`]);
      }
      assert.deepEqual(await recibidos(desactivada.email), []);
      // Los de este test (por la marca del título): solo a esas tres casillas, nunca a las de la DGMIT ni a otra
      const delTest = (await mailpit.mensajes()).filter((mensaje) => mensaje.Subject.includes(marca));
      const casillas = delTest.flatMap((mensaje) => [...mensaje.To, ...mensaje.Cc ?? [], ...mensaje.Bcc ?? []])
        .map((to) => to.Address).sort();
      assert.deepEqual(casillas, [adminA.email, adminB.email, exAdmin.email].sort());
      for (const casilla of CASILLAS_POR_DEFECTO) assert.ok(!casillas.includes(casilla), casilla);
    });

    it('«Todos»: a quien lo creó y a la administración activa, menos a quien lo apagó; ni al lector ni al colaborador',
      async () => {
        const adminA = await persona({ clave: 'adminA' });
        const adminB = await persona({ clave: 'adminB' });
        const editor = await persona({ clave: 'editor', rol: 'editor' });
        const superadmin = await persona({ clave: 'superadmin', rol: 'superadmin' });
        const apagada = await persona({ clave: 'apagada' });
        const lector = await persona({ clave: 'lector', rol: 'lector' });
        const colab = await persona({ clave: 'colab', rol: 'colaborador' });
        const desactivada = await persona({ clave: 'desactivada', activo: 0 });
        const id = await evento({ creador: adminA, paraTodos: true, apagados: [apagada] });

        assert.deepEqual(await corridaA('2026-11-03 08:00'), resultado({ enviados: 4 }));
        const reciben = [adminA, adminB, editor, superadmin];
        assert.deepEqual((await enviosDe(id)).map((envio) => envio.usuario_id), reciben.map((q) => q.id).sort((a, b) => a - b));
        for (const quien of reciben) assert.equal((await esperarDe(quien.email)).length, 1);
        for (const quien of [apagada, lector, colab, desactivada]) assert.deepEqual(await recibidos(quien.email), []);
      });

    it('si quien lo creó está desactivada, no lo recibe; sus invitadas, sí', async () => {
      const creadora = await persona({ clave: 'creadora', activo: 0 });
      const adminB = await persona({ clave: 'adminB' });
      const id = await evento({ creador: creadora, personas: [adminB] });
      assert.deepEqual(await corridaA('2026-11-03 08:00'), resultado({ enviados: 1 }));
      assert.deepEqual((await enviosDe(id)).map((envio) => envio.usuario_id), [adminB.id]);
      assert.equal((await esperarDe(adminB.email)).length, 1);
      assert.deepEqual(await recibidos(creadora.email), []);
    });
  });

  describe('el candado', () => {
    it('con el candado de la corrida tomado en otra conexión: «ocupada», sin emails ni anotación', async () => {
      const adminA = await persona({ clave: 'adminA' });
      const id = await evento({ creador: adminA });
      const ocupada = await conCandadoAjeno(BLOQUEO_EVENTOS, () => corridaA('2026-11-03 08:00'));
      assert.deepEqual(ocupada, { ocupada: true, dia_habil: null, enviados: 0, fallidos: 0, errores: [] });
      assert.deepEqual(await enviosDe(id), []);
      assert.deepEqual(await ultimaCorrida(), []);
      assert.deepEqual(await recibidos(adminA.email), []);
      assert.equal(await bloqueoLibre(), true);
    });

    it('con el candado de las Notas Digitales tomado, corre: es otro', async () => {
      const adminA = await persona({ clave: 'adminA' });
      const id = await evento({ creador: adminA });
      assert.deepEqual(await conCandadoAjeno(BLOQUEO_DE_LAS_NOTAS, () => corridaA('2026-11-03 08:00')), resultado({ enviados: 1 }));
      assert.deepEqual(await enviosDe(id), [enviado(adminA, '2026-11-03 10:00', '2026-11-03 08:00:00')]);
      assert.equal((await esperarDe(adminA.email)).length, 1);
      assert.equal(await bloqueoLibre(), true);
      assert.equal(await bloqueoLibre(BLOQUEO_DE_LAS_NOTAS), true);
    });
  });

  describe('la anotación de la corrida y sus fallas', () => {
    it('anota cada corrida, también un sábado: inicio_at es el momento simulado, con fin_at y su resultado', async () => {
      assert.deepEqual(await corridaA('2026-10-31 11:00'), resultado({ dia_habil: false }));
      assert.deepEqual(await ultimaCorrida(), [{
        inicio_at: '2026-10-31 11:00:00', fin_at: '2026-10-31 11:00:00', resultado: NO_HABIL, con_errores: 0
      }]);
      assert.deepEqual(await corrida.leerCorridaDeEventos(), {
        inicio: '2026-10-31 11:00', fin: '2026-10-31 11:00', resultado: NO_HABIL, con_errores: false, en_curso: false
      });

      // Un día hábil, en la misma fila
      const adminA = await persona({ clave: 'adminA' });
      await evento({ creador: adminA });
      assert.deepEqual(await corridaA('2026-11-03 08:00'), resultado({ enviados: 1 }));
      assert.deepEqual(await ultimaCorrida(), [{
        inicio_at: '2026-11-03 08:00:00', fin_at: '2026-11-03 08:00:00', resultado: 'Recordatorios enviados: 1.', con_errores: 0
      }]);
    });

    it('leerCorridaDeEventos: null sin registro; sin fin, «en curso» solo con el candado tomado', async () => {
      assert.equal(await corrida.leerCorridaDeEventos(), null);
      await query("INSERT INTO mi_espacio_eventos_corridas (id, inicio_at) VALUES (1, '2026-11-03 08:30:00')");
      const sinFin = { inicio: '2026-11-03 08:30', fin: null, resultado: null, con_errores: false };
      // Sin el candado: empezó y no terminó (se interrumpió)
      assert.deepEqual(await corrida.leerCorridaDeEventos(), { ...sinFin, en_curso: false });
      assert.deepEqual(await conCandadoAjeno(BLOQUEO_EVENTOS, () => corrida.leerCorridaDeEventos()), { ...sinFin, en_curso: true });
      // Con otra conexión
      assert.deepEqual(await corrida.leerCorridaDeEventos(pool), { ...sinFin, en_curso: false });
    });

    it('si anotar un envío falla: salió, va a los errores y a la consola, y la corrida siguiente no lo repite', async () => {
      const adminA = await persona({ clave: 'adminA' });
      const adminB = await persona({ clave: 'adminB' });
      const id = await evento({ creador: adminA, personas: [adminB] });
      const log = mock.method(console, 'error', () => {});
      let primera;
      try {
        primera = await conAnotacionQueFalla(adminA.id, () => corridaA('2026-11-03 08:00'));
      } finally {
        log.mock.restore();
      }
      assert.deepEqual(primera, resultado({ enviados: 2, errores: [{ evento_id: id, usuario_id: adminA.id, error: 'Falla simulada' }] }));
      assert.deepEqual(log.mock.calls.map((llamada) => llamada.arguments[0]), ['Error al anotar el recordatorio de un evento:']);
      assert.match(log.mock.calls[0].arguments[1], /Falla simulada/);
      // La reserva de adminA quedó sin terminar: no se repite
      assert.deepEqual(await enviosDe(id), [
        enviado(adminA, '2026-11-03 10:00', null, 0), enviado(adminB, '2026-11-03 10:00', '2026-11-03 08:00:00')
      ]);
      assert.deepEqual(await ultimaCorrida(), [{
        inicio_at: '2026-11-03 08:00:00', fin_at: '2026-11-03 08:00:00',
        resultado: `Recordatorios enviados: 2. Errores: evento ${id}, persona ${adminA.id}: Falla simulada`, con_errores: 1
      }]);
      assert.deepEqual(await corridaA('2026-11-03 08:30'), resultado());
      for (const quien of [adminA, adminB]) assert.equal((await esperarDe(quien.email)).length, 1);
    });

    it('si no se puede anotar la corrida (sin la tabla), los recordatorios salen igual y la consola lo dice', async () => {
      const adminA = await persona({ clave: 'adminA' });
      const id = await evento({ creador: adminA });
      const { devuelto, consola } = await sinLaTabla('mi_espacio_eventos_corridas', () => corridaA('2026-11-03 08:00'));
      assert.deepEqual(devuelto, resultado({ enviados: 1 }));
      assert.deepEqual(consola.map((argumentos) => argumentos[0]), [
        'No se pudo anotar el inicio de la corrida de los recordatorios:',
        'No se pudo anotar el fin de la corrida de los recordatorios:'
      ]);
      assert.deepEqual(await enviosDe(id), [enviado(adminA, '2026-11-03 10:00', '2026-11-03 08:00:00')]);
      assert.deepEqual(await ultimaCorrida(), []);
    });

    it('si falla toda la corrida (los eventos no se pueden leer), va a los errores y queda anotada con errores', async () => {
      const { devuelto, consola } = await sinLaTabla('mi_espacio_eventos', () => corridaA('2026-11-03 08:00'));
      assert.equal(devuelto.errores.length, 1, JSON.stringify(devuelto));
      const [{ error }] = devuelto.errores;
      assert.match(error, /mi_espacio_eventos/);
      assert.deepEqual(devuelto, resultado({ errores: [{ evento_id: null, usuario_id: null, error }] }));
      assert.deepEqual(consola.map((argumentos) => argumentos[0]), ['Error en la corrida de los recordatorios:']);
      assert.deepEqual(await ultimaCorrida(), [{
        inicio_at: '2026-11-03 08:00:00', fin_at: '2026-11-03 08:00:00', resultado: `Recordatorios enviados: 0. Errores: ${error}`,
        con_errores: 1
      }]);
      assert.equal(await bloqueoLibre(), true);
    });
  });
});

describe('el cron: ejecutarRecordatoriosDeEventos (el controlador)', () => {
  it('un día no hábil, 200 «Hoy no es día hábil: no se mandan recordatorios.», con data', async () => {
    const res = await cronA('2026-10-31 11:00');
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      success: true, message: 'Hoy no es día hábil: no se mandan recordatorios.', data: resultado({ dia_habil: false })
    });
  });

  it('con todo enviado, 200 «Recordatorios enviados: N.»', async () => {
    const adminA = await persona({ clave: 'adminA' });
    const adminB = await persona({ clave: 'adminB' });
    await evento({ creador: adminA, personas: [adminB] });
    const res = await cronA('2026-11-03 08:00');
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true, message: 'Recordatorios enviados: 2.', data: resultado({ enviados: 2 }) });
    const sinNada = await cronA('2026-11-03 08:30');
    assert.equal(sinNada.statusCode, 200);
    assert.deepEqual(sinNada.body, { success: true, message: 'Recordatorios enviados: 0.', data: resultado() });
  });

  it('con fallidos (o errores), 207', async () => {
    const adminA = await persona({ clave: 'adminA' });
    await evento({ creador: adminA });
    process.env.EMAIL_SOLO_A = 'nadie@rpad.test';
    const aviso = mock.method(console, 'warn', () => {});
    let res;
    try {
      res = await cronA('2026-11-03 08:00');
    } finally {
      aviso.mock.restore();
      process.env.EMAIL_SOLO_A = '';
    }
    assert.equal(res.statusCode, 207);
    assert.deepEqual(res.body, {
      success: false, message: 'Recordatorios enviados: 0. Fallidos: 1.', data: resultado({ fallidos: 1 })
    });
  });

  it('con otra corrida en curso, 200 «Otra corrida de los recordatorios está en curso.»', async () => {
    const res = await conCandadoAjeno(BLOQUEO_EVENTOS, () => cronA('2026-11-03 08:00'));
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      success: true, message: 'Otra corrida de los recordatorios está en curso.',
      data: { ocupada: true, dia_habil: null, enviados: 0, fallidos: 0, errores: [] }
    });
  });

  it('una excepción (no se puede tomar el candado), 500 «Error en los recordatorios de la agenda»', async () => {
    const getConnection = mock.method(pool, 'getConnection', async () => { throw new Error('Falla simulada'); });
    const log = mock.method(console, 'error', () => {});
    let res;
    try {
      res = await cronA('2026-11-03 08:00');
    } finally {
      getConnection.mock.restore();
      log.mock.restore();
    }
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { success: false, error: 'Error en los recordatorios de la agenda' });
    assert.deepEqual(log.mock.calls.map((llamada) => llamada.arguments[0]), ['Error en los recordatorios de la agenda:']);
    assert.deepEqual(await ultimaCorrida(), []);
  });
});
