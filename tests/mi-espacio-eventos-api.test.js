// La agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, secciones 1, 2, 3 y 7): la API de los eventos, contra una base
// de prueba propia. Lo ve quien lo creó, las personas invitadas y, si es para todos, la administración activa; lo cambia y lo
// borra solo quien lo creó (el resto recibe 404: no se revela que existe); comparte solo administración, y solo con
// administración; una invitada apaga o prende su recordatorio, y cuándo sale se calcula en cada pedido con los feriados de
// ese momento (Review Focus 3). Las lecturas de services/miEspacioEventosDatos.js se prueban también directo (audienciaDe, la de
// los emails). También lo demás de la agenda (tus licencias de Mi espacio, los feriados y los compañeros que no están, sin el
// tipo), los eventos de «Hoy y mañana» del Resumen y los emails que salen al guardar (la invitación, el cambio y la
// cancelación, en Mailpit, después de responder) y, en Correos → Estado, la línea de la última corrida de los recordatorios con
// sus alertas. La API usa la fecha real: las fechas de los tests se arman desde hoy. Las personas son «Test <clave>».
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query, mailpit,
  paraCasilla
} from './helpers.js';
import { asegurarBaseDePrueba } from './notas-fixtures.js';
import { textoVisible } from './emails-fixtures.js';
import { hoyArgentina, ahoraArgentina, sumarDias, esDiaHabil } from '../services/notasDigitalesCalendario.js';
import { MENSAJES_EVENTO, textoRangoEvento, fechaMaximaEvento, BLOQUEO_EVENTOS } from '../services/miEspacioEventosReglas.js';
import { MENSAJES_MI_ESPACIO } from '../services/miEspacioReglas.js';

let base, servidor, api, usuarios, dbReal, emailSoloA, datos, corrida, pool;
const hoy = hoyArgentina();
const dia = (n) => sumarDias(hoy, n);
// Los eventos se arman sobre dos semanas sin feriados (el primer lunes desde dentro de 7 días cuyos diez días de semana son
// hábiles), como en tests/mi-espacio-api.test.js: q(0) es ese lunes, q(4) el viernes, q(7) el lunes siguiente. Vale mientras la
// tabla `feriados` está vacía (el beforeEach la vacía)
const LUNES = (() => {
  const esLunes = (fecha) => new Date(`${fecha}T12:00:00Z`).getUTCDay() === 1;
  const habiles = (lunes) => [0, 1, 2, 3, 4, 7, 8, 9, 10, 11].every(n => esDiaHabil(sumarDias(lunes, n)));
  let lunes = dia(7);
  while (!esLunes(lunes) || !habiles(lunes)) lunes = sumarDias(lunes, 1);
  return lunes;
})();
const q = (n) => sumarDias(LUNES, n);
// 'dd/mm' de una fecha, escrito a mano (no con el código que se prueba)
const ddmm = (fecha) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

// Las seis personas, con su rol; quedan «Test <clave>»
const ROLES = Object.freeze({
  superadmin: 'superadmin', adminA: 'admin', adminB: 'admin', editor: 'editor', lector: 'lector', colab: 'colaborador'
});
const TABLAS = ['mi_espacio_evento_envios', 'mi_espacio_evento_personas', 'mi_espacio_eventos', 'mi_espacio_eventos_corridas',
  'feriados', 'mi_espacio_licencias', 'usuarios_licencias'];

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_mi_espacio_eventos');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, ROLES);
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba. El servidor arranca sin la barrera; el proceso
  // del test (que manda emails en «los emails del guardado») lee el .env, que puede tenerla: sin barrera, salvo donde se pide
  emailSoloA = process.env.EMAIL_SOLO_A;
  process.env.EMAIL_SOLO_A = '';
  datos = await import('../services/miEspacioEventosDatos.js');
  corrida = await import('../services/miEspacioEventosCorrida.js');
  pool = (await import('../config/database.js')).default;
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await pool?.end();
  await cerrarDb();
  await servidor?.detener();
  if (emailSoloA === undefined) delete process.env.EMAIL_SOLO_A;
  else process.env.EMAIL_SOLO_A = emailSoloA;
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

// Cuidado con lo que queda de un test anterior: el servidor manda los emails de un guardado después de responder, así que
// los de un test pueden llegar a Mailpit, y anotarse en mi_espacio_evento_envios, después de que empezó el siguiente (y
// después de este vaciado y de estos DELETE). Todo lo que lee Mailpit filtra por la marca del test (en el título: las
// casillas son las mismas en todo el archivo, no alcanzan) y todo lo que lee mi_espacio_evento_envios, por su evento: nunca
// contar todo lo que hay. La corrida de los recordatorios se prueba en tests/mi-espacio-eventos-corrida.test.js, con su
// propia base
beforeEach(async () => {
  await asegurarBaseDePrueba();
  process.env.EMAIL_SOLO_A = '';
  for (const tabla of TABLAS) await query(`DELETE FROM ${tabla}`);
  // Cada test arranca con los roles de entrada y todas activas (los que cambian un rol o desactivan a alguien, por SQL)
  for (const [clave, rol] of Object.entries(ROLES)) {
    await query('UPDATE usuarios SET rol = ?, activo = 1 WHERE id = ?', [rol, usuarios[clave].id]);
  }
  await mailpit.vaciar();
});

const como = (clave) => ({ token: usuarios[clave].token });
const idDe = (clave) => usuarios[clave].id;

// Un evento del formulario (el martes q(1) de 10:00 a 11:00, personal), con lo que cambia cada caso
const formulario = (cambios = {}) =>
  ({ titulo: 'Reunión de equipo', fecha: q(1), desde: '10:00', hasta: '11:00', detalle: '', ...cambios });
const compartidoCon = (...claves) => ({ compartido: true, personas: claves.map(idDe) });
const PARA_TODOS = Object.freeze({ compartido: true, para_todos: true });

const crear = async (clave, cambios = {}) => {
  const res = await api.post('/mi-espacio/eventos', formulario(cambios), como(clave));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data.id;
};
const cambiar = (clave, id, cambios = {}) => api.put(`/mi-espacio/eventos/${id}`, formulario(cambios), como(clave));
const borrar = (clave, id) => api.delete(`/mi-espacio/eventos/${id}`, como(clave));
const miRecordatorio = (clave, id, cuerpo) => api.put(`/mi-espacio/eventos/${id}/mi-recordatorio`, cuerpo, como(clave));

// GET /mi-espacio/eventos de una persona (de q(0) a q(20), salvo que diga otro rango): el `data` entero
const listado = async (clave, desde = q(0), hasta = q(20)) => {
  const res = await api.get(`/mi-espacio/eventos?desde=${desde}&hasta=${hasta}`, como(clave));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.success, true);
  return res.body.data;
};
const eventosDe = async (clave, desde, hasta) => (await listado(clave, desde, hasta)).eventos;
const elDe = async (clave, id) => (await eventosDe(clave)).find((evento) => evento.id === id);
const idsDe = async (clave) => (await eventosDe(clave)).map((evento) => evento.id);

// Las filas de las personas de un evento, por SQL: [{ usuario_id, sin_recordatorio }] por id
const filasDe = async (eventoId) => (await query(
  'SELECT usuario_id, sin_recordatorio FROM mi_espacio_evento_personas WHERE evento_id = ? ORDER BY usuario_id', [eventoId]
)).map((fila) => ({ usuario_id: Number(fila.usuario_id), sin_recordatorio: Number(fila.sin_recordatorio) }));
const filaDelEvento = async (id) => (await query(
  `SELECT titulo, detalle, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, TIME_FORMAT(desde, '%H:%i') AS desde,
     TIME_FORMAT(hasta, '%H:%i') AS hasta, compartido, para_todos, recordatorio, activo, creado_por
   FROM mi_espacio_eventos WHERE id = ?`, [id]
))[0];
const cuantosEventos = async () => Number((await query('SELECT COUNT(*) AS n FROM mi_espacio_eventos'))[0].n);
const conFeriado = (fecha, nombre = 'Feriado de prueba') =>
  query("INSERT INTO feriados (fecha, nombre, tipo, se_repite) VALUES (?, ?, 'nacional', 0)", [fecha, nombre]);

// Un 400 con su campo y su mensaje
const es400 = (res, campo, mensaje) => {
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.deepEqual(res.body, { success: false, error: mensaje, campo });
};
const es404 = (res) => {
  assert.equal(res.status, 404, JSON.stringify(res.body));
  assert.deepEqual(res.body, { success: false, error: MENSAJES_EVENTO.noEncontrado });
};

const CLAVES_DEL_MIO = ['id', 'titulo', 'detalle', 'fecha', 'desde', 'hasta', 'es_mio', 'compartido', 'para_todos', 'creador',
  'personas', 'personas_ids', 'recordatorio', 'recordatorio_texto', 'mi_recordatorio', 'aviso', 'quien_texto'];
const CLAVES_DEL_AJENO = ['id', 'titulo', 'detalle', 'fecha', 'desde', 'hasta', 'es_mio', 'compartido', 'para_todos', 'creador',
  'personas', 'recordatorio', 'recordatorio_texto', 'mi_recordatorio', 'aviso', 'quien_texto', 'quien_largo'];

describe('un evento personal', () => {
  it('se guarda (201, «Evento guardado.») y quien lo creó lo ve como suyo, «Solo vos», con cuándo sale su aviso', async () => {
    const res = await api.post('/mi-espacio/eventos',
      formulario({ detalle: '  Sala de reuniones del 2.º piso.  ', recordatorio: '2h' }), como('adminA'));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, data: { id: res.body.data.id }, message: 'Evento guardado.' });
    const { id } = res.body.data;
    assert.ok(Number.isInteger(id) && id > 0);

    const data = await listado('adminA');
    assert.deepEqual(Object.keys(data),
      ['desde', 'hasta', 'hoy', 'puede_compartir', 'eventos', 'licencias', 'feriados', 'ausentes']);
    assert.equal(data.desde, q(0));
    assert.equal(data.hasta, q(20));
    assert.equal(data.hoy, hoyArgentina());
    assert.equal(data.puede_compartir, true);
    assert.equal(data.eventos.length, 1);
    // Leído de la base (los TIME, con TIME_FORMAT): el aviso sale con su momento, nunca null por un '10:00:00'
    assert.deepEqual(data.eventos[0], {
      id, titulo: 'Reunión de equipo', detalle: 'Sala de reuniones del 2.º piso.', fecha: q(1), desde: '10:00', hasta: '11:00',
      es_mio: true, compartido: false, para_todos: false, creador: 'Test adminA', personas: [], personas_ids: [],
      recordatorio: '2h', recordatorio_texto: '2 horas antes', mi_recordatorio: '2h',
      aviso: { momento: `${q(1)} 08:00`, texto: `2 horas antes (el martes ${ddmm(q(1))} a las 08:00)`, corto: 'Aviso 2 h antes' },
      quien_texto: 'Solo vos'
    });
    assert.deepEqual(Object.keys(data.eventos[0]), CLAVES_DEL_MIO);
    assert.deepEqual(await filaDelEvento(id), {
      titulo: 'Reunión de equipo', detalle: 'Sala de reuniones del 2.º piso.', fecha: q(1), desde: '10:00', hasta: '11:00',
      compartido: 0, para_todos: 0, recordatorio: '2h', activo: 1, creado_por: idDe('adminA')
    });
    assert.deepEqual(await filasDe(id), []);
  });

  it('sin hora de fin ni recordatorio: hasta null y «2 horas antes»; el detalle vacío es null', async () => {
    const id = await crear('adminA', { hasta: '', detalle: '   ', recordatorio: undefined });
    const evento = await elDe('adminA', id);
    assert.equal(evento.hasta, null);
    assert.equal(evento.detalle, null);
    assert.equal(evento.recordatorio, '2h');
    const fila = await filaDelEvento(id);
    assert.equal(fila.hasta, null);
    assert.equal(fila.detalle, null);
  });

  it('no sale en el GET de adminB ni del superadmin, y su PUT, su DELETE y su «mi recordatorio» dan 404', async () => {
    const id = await crear('adminA');
    assert.deepEqual(await idsDe('adminB'), []);
    assert.deepEqual(await idsDe('superadmin'), []);
    for (const clave of ['adminB', 'superadmin']) {
      es404(await cambiar(clave, id, { titulo: 'Otro' }));
      es404(await borrar(clave, id));
      es404(await miRecordatorio(clave, id, { sin_aviso: true }));
    }
    // No cambió nada
    assert.equal((await filaDelEvento(id)).titulo, 'Reunión de equipo');
    assert.equal((await filaDelEvento(id)).activo, 1);
  });

  it('por fecha, hora y título; solo los del rango pedido', async () => {
    const tarde = await crear('adminA', { titulo: 'B', fecha: q(2), desde: '09:00', hasta: '' });
    const z = await crear('adminA', { titulo: 'Z', fecha: q(1), desde: '10:00', hasta: '' });
    const a = await crear('adminA', { titulo: 'A', fecha: q(1), desde: '10:00', hasta: '' });
    const temprano = await crear('adminA', { titulo: 'C', fecha: q(1), desde: '08:00', hasta: '' });
    const lejos = await crear('adminA', { titulo: 'Lejos', fecha: q(30), desde: '08:00', hasta: '' });
    assert.deepEqual(await idsDe('adminA'), [temprano, a, z, tarde]);
    assert.deepEqual((await eventosDe('adminA', q(2), q(30))).map((evento) => evento.id), [tarde, lejos]);
    assert.deepEqual((await eventosDe('adminA', q(1), q(1))).map((evento) => evento.id), [temprano, a, z]);
  });
});

describe('compartido con personas', () => {
  // Las personas del archivo empiezan todas con «Test»: el nombre corto (nombreCorto) suma la inicial del último apellido
  // («Test e.»), salvo adminA y adminB, que también la comparten y quedan con el nombre completo
  it('adminB lo ve como ajeno, «De Test adminA», y el editor no; adminA, «Con Test adminB» y sus ids', async () => {
    const id = await crear('adminA', compartidoCon('adminB'));
    const deB = await elDe('adminB', id);
    assert.equal(deB.es_mio, false);
    assert.equal(deB.compartido, true);
    assert.equal(deB.para_todos, false);
    assert.equal(deB.creador, 'Test adminA');
    assert.equal(deB.quien_texto, 'De Test adminA');
    assert.equal(deB.quien_largo, 'Lo creó Test adminA. Están: vos.');
    assert.deepEqual(deB.personas, ['Test adminB']);
    assert.equal(deB.mi_recordatorio, '2h');
    assert.deepEqual(Object.keys(deB), CLAVES_DEL_AJENO);
    assert.deepEqual(await idsDe('editor'), []);
    assert.deepEqual(await idsDe('superadmin'), []);

    const deA = await elDe('adminA', id);
    assert.equal(deA.es_mio, true);
    assert.equal(deA.quien_texto, 'Con Test adminB');
    assert.deepEqual(deA.personas, ['Test adminB']);
    assert.deepEqual(deA.personas_ids, [idDe('adminB')]);
    assert.deepEqual(Object.keys(deA), CLAVES_DEL_MIO);
    assert.deepEqual(await filasDe(id), [{ usuario_id: idDe('adminB'), sin_recordatorio: 0 }]);
  });

  it('con dos personas: «Con 2 personas», y cada invitada se ve primero, como «vos»', async () => {
    const id = await crear('adminA', compartidoCon('editor', 'adminB'));
    assert.equal((await elDe('adminA', id)).quien_texto, 'Con 2 personas');
    assert.deepEqual((await elDe('adminA', id)).personas, ['Test adminB', 'Test editor']);
    assert.equal((await elDe('adminB', id)).quien_largo, 'Lo creó Test adminA. Están: vos y Test e.');
    assert.equal((await elDe('editor', id)).quien_largo, 'Lo creó Test adminA. Están: vos y Test adminB.');
  });

  it('el id propio entre las personas se saca sin error; solo el propio es como ninguna', async () => {
    const id = await crear('adminA', { compartido: true, personas: [idDe('adminA'), idDe('adminB')] });
    assert.deepEqual(await filasDe(id), [{ usuario_id: idDe('adminB'), sin_recordatorio: 0 }]);
    const res = await api.post('/mi-espacio/eventos', formulario({ compartido: true, personas: [idDe('adminA')] }),
      como('adminA'));
    es400(res, 'personas', MENSAJES_EVENTO.personas);
  });

  it('con adminA desactivada, adminB lo sigue viendo (y no lo puede cambiar)', async () => {
    const id = await crear('adminA', compartidoCon('adminB'));
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [idDe('adminA')]);
    const deB = await elDe('adminB', id);
    assert.equal(deB.creador, 'Test adminA');
    assert.equal(deB.es_mio, false);
    es404(await cambiar('adminB', id, { titulo: 'Otro' }));
  });
});

describe('para todos', () => {
  it('lo ven el superadmin, adminB, el editor y un admin creado después; no el lector ni el colaborador', async () => {
    const id = await crear('adminA', PARA_TODOS);
    for (const clave of ['superadmin', 'adminB', 'editor']) {
      const evento = await elDe(clave, id);
      assert.ok(evento, clave);
      assert.equal(evento.es_mio, false);
      assert.equal(evento.para_todos, true);
      assert.equal(evento.quien_texto, 'De Test adminA');
      assert.equal(evento.quien_largo, 'Lo creó Test adminA. Es para todos.');
      assert.deepEqual(evento.personas, []);
    }
    assert.deepEqual(await idsDe('lector'), []);
    assert.deepEqual(await idsDe('colab'), []);

    const deA = await elDe('adminA', id);
    assert.equal(deA.quien_texto, 'Con todos');
    assert.deepEqual(deA.personas, []);
    assert.deepEqual(deA.personas_ids, []);
    // «Todos» es una marca, no una lista: no hay filas
    assert.deepEqual(await filasDe(id), []);

    // Alguien que se suma después también lo ve
    const nuevos = await crearUsuariosPrueba(api, { despues: 'admin' });
    try {
      const res = await api.get(`/mi-espacio/eventos?desde=${q(0)}&hasta=${q(20)}`, { token: nuevos.despues.token });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(res.body.data.eventos.map((evento) => evento.id), [id]);
    } finally {
      await limpiarDatosPrueba(nuevos);
    }
  });

  it('las personas que vengan con «Todos» se descartan', async () => {
    const id = await crear('adminA', { ...PARA_TODOS, personas: [idDe('adminB'), idDe('lector')] });
    assert.deepEqual(await filasDe(id), []);
    assert.deepEqual(await idsDe('lector'), []);
  });
});

describe('quién puede compartir', () => {
  it('el lector y el colaborador no comparten (400 sinPermiso en compartido); personal, sí', async () => {
    for (const clave of ['lector', 'colab']) {
      es400(await api.post('/mi-espacio/eventos', formulario(compartidoCon('adminB')), como(clave)),
        'compartido', MENSAJES_EVENTO.sinPermiso);
      es400(await api.post('/mi-espacio/eventos', formulario(PARA_TODOS), como(clave)), 'compartido', MENSAJES_EVENTO.sinPermiso);
    }
    assert.equal(await cuantosEventos(), 0);
    const id = await crear('lector');
    const data = await listado('lector');
    assert.equal(data.puede_compartir, false);
    assert.deepEqual(data.eventos.map((evento) => evento.id), [id]);
    assert.equal(data.eventos[0].quien_texto, 'Solo vos');
    await crear('colab');
  });

  it('GET /personas: 403 con «No tenés permiso para compartir eventos.» al lector y al colaborador', async () => {
    for (const clave of ['lector', 'colab']) {
      const res = await api.get('/mi-espacio/personas', como(clave));
      assert.equal(res.status, 403, JSON.stringify(res.body));
      assert.deepEqual(res.body, { success: false, error: 'No tenés permiso para compartir eventos.' });
    }
  });

  it('GET /personas: id, nombre e iniciales de la administración activa, por nombre, sin quien pide', async () => {
    const nuevos = await crearUsuariosPrueba(api, { inactiva: 'admin' });
    try {
      await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [nuevos.inactiva.id]);
      const res = await api.get('/mi-espacio/personas', como('adminA'));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, [
        { id: idDe('adminB'), nombre: 'Test adminB', iniciales: 'TA' },
        { id: idDe('editor'), nombre: 'Test editor', iniciales: 'TE' },
        { id: idDe('superadmin'), nombre: 'Test superadmin', iniciales: 'TS' }
      ]);
      for (const persona of res.body.data) assert.deepEqual(Object.keys(persona), ['id', 'nombre', 'iniciales']);
      // El editor también la pide (es administración), sin él
      const delEditor = await api.get('/mi-espacio/personas', como('editor'));
      assert.deepEqual(delEditor.body.data.map((persona) => persona.id), [idDe('adminA'), idDe('adminB'), idDe('superadmin')]);
    } finally {
      await limpiarDatosPrueba(nuevos);
    }
  });

  it('no se comparte con quien no está en la lista: el lector, el colaborador, una desactivada o uno que no existe', async () => {
    const nuevos = await crearUsuariosPrueba(api, { inactiva: 'admin' });
    try {
      await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [nuevos.inactiva.id]);
      for (const persona of [idDe('lector'), idDe('colab'), nuevos.inactiva.id, 999999]) {
        const res = await api.post('/mi-espacio/eventos',
          formulario({ compartido: true, personas: [idDe('adminB'), persona] }), como('adminA'));
        es400(res, 'personas', MENSAJES_EVENTO.personasInvalidas);
      }
      assert.equal(await cuantosEventos(), 0);
    } finally {
      await limpiarDatosPrueba(nuevos);
    }
  });
});

describe('solo quien lo creó lo cambia o lo borra', () => {
  it('adminB invitada recibe 404 en el PUT y el DELETE, como un id que no sirve o uno dado de baja', async () => {
    const id = await crear('adminA', compartidoCon('adminB'));
    es404(await cambiar('adminB', id, { titulo: 'Otro' }));
    es404(await borrar('adminB', id));
    for (const otro of ['abc', '1e3', '0', '-3', '1.5', '999999']) {
      es404(await cambiar('adminA', otro));
      es404(await borrar('adminA', otro));
      es404(await miRecordatorio('adminB', otro, { sin_aviso: true }));
    }
    const baja = await crear('adminA', compartidoCon('adminB'));
    await query('UPDATE mi_espacio_eventos SET activo = 0 WHERE id = ?', [baja]);
    es404(await cambiar('adminA', baja));
    es404(await borrar('adminA', baja));
    es404(await miRecordatorio('adminB', baja, { sin_aviso: true }));
    assert.deepEqual(await idsDe('adminA'), [id]);
    assert.deepEqual(await idsDe('adminB'), [id]);
    assert.equal((await filaDelEvento(id)).titulo, 'Reunión de equipo');
  });

  it('quien lo creó lo cambia: el formulario entero (200, «Evento cambiado.»)', async () => {
    const id = await crear('adminA', { recordatorio: '2h' });
    const res = await cambiar('adminA', id,
      { titulo: 'Reunión de equipo, segunda parte', fecha: q(2), desde: '15:30', hasta: '', detalle: 'Otra sala.',
        recordatorio: 'dia_anterior' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, data: { id }, message: 'Evento cambiado.' });
    assert.deepEqual(await filaDelEvento(id), {
      titulo: 'Reunión de equipo, segunda parte', detalle: 'Otra sala.', fecha: q(2), desde: '15:30', hasta: null,
      compartido: 0, para_todos: 0, recordatorio: 'dia_anterior', activo: 1, creado_por: idDe('adminA')
    });
    const evento = await elDe('adminA', id);
    assert.equal(evento.aviso.momento, `${q(1)} 15:30`);
  });

  it('las personas al cambiar: exactamente las elegidas; con «Todos», solo las apagadas; «Solo yo», ninguna', async () => {
    const id = await crear('adminA', compartidoCon('adminB', 'editor'));
    // El editor apaga su recordatorio
    assert.equal((await miRecordatorio('editor', id, { sin_aviso: true })).status, 200);
    // Saca a adminB y suma al superadmin: el editor sigue apagado
    assert.equal((await cambiar('adminA', id, compartidoCon('editor', 'superadmin'))).status, 200);
    assert.deepEqual(await filasDe(id), [
      { usuario_id: idDe('superadmin'), sin_recordatorio: 0 }, { usuario_id: idDe('editor'), sin_recordatorio: 1 }
    ].sort((a, b) => a.usuario_id - b.usuario_id));
    assert.deepEqual(await idsDe('adminB'), []);
    // Para todos: quedan solo las filas apagadas, y el editor lo sigue teniendo apagado
    assert.equal((await cambiar('adminA', id, PARA_TODOS)).status, 200);
    assert.deepEqual(await filasDe(id), [{ usuario_id: idDe('editor'), sin_recordatorio: 1 }]);
    assert.equal((await elDe('editor', id)).mi_recordatorio, 'ninguno');
    assert.equal((await elDe('adminB', id)).mi_recordatorio, '2h');
    // De vuelta a personas, con el editor: sigue apagado
    assert.equal((await cambiar('adminA', id, compartidoCon('editor'))).status, 200);
    assert.deepEqual(await filasDe(id), [{ usuario_id: idDe('editor'), sin_recordatorio: 1 }]);
    // Solo yo: ninguna, y deja de verse
    assert.equal((await cambiar('adminA', id, { compartido: false })).status, 200);
    assert.deepEqual(await filasDe(id), []);
    assert.deepEqual(await idsDe('editor'), []);
    assert.equal((await filaDelEvento(id)).compartido, 0);
  });

  it('el borrado: 200, «Evento borrado.», activo = 0 y deja de verse para todos; un segundo DELETE, 404', async () => {
    const id = await crear('adminA', compartidoCon('adminB'));
    const res = await borrar('adminA', id);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, message: 'Evento borrado.' });
    assert.equal((await filaDelEvento(id)).activo, 0);
    assert.deepEqual(await idsDe('adminA'), []);
    assert.deepEqual(await idsDe('adminB'), []);
    es404(await borrar('adminA', id));
  });
});

describe('los 400', () => {
  const maxima = fechaMaximaEvento(hoy);
  const CASOS = [
    ['titulo', { titulo: '   ' }, MENSAJES_EVENTO.titulo],
    ['titulo', { titulo: 'x'.repeat(151) }, MENSAJES_EVENTO.tituloLargo],
    ['fecha', { fecha: '2024-12-31' }, textoRangoEvento(maxima)],
    ['fecha', { fecha: sumarDias(maxima, 1) }, textoRangoEvento(maxima)],
    ['fecha', { fecha: '2026-02-30' }, textoRangoEvento(maxima)],
    ['desde', { desde: '9:00' }, MENSAJES_EVENTO.desde],
    ['hasta', { hasta: '09:00' }, MENSAJES_EVENTO.hasta],
    ['detalle', { detalle: 'x'.repeat(1001) }, MENSAJES_EVENTO.detalle],
    ['personas', { compartido: true, personas: [] }, MENSAJES_EVENTO.personas],
    ['personas', { compartido: true }, MENSAJES_EVENTO.personas],
    ['personas', { compartido: true, personas: ['abc'] }, MENSAJES_EVENTO.personasInvalidas],
    ['recordatorio', { recordatorio: 'otro' }, MENSAJES_EVENTO.recordatorio]
  ];

  for (const [campo, cambios, mensaje] of CASOS) {
    it(`${campo}: ${JSON.stringify(cambios).slice(0, 60)}, en el alta y en el cambio, sin escribir nada`, async () => {
      es400(await api.post('/mi-espacio/eventos', formulario(cambios), como('adminA')), campo, mensaje);
      assert.equal(await cuantosEventos(), 0);
      const id = await crear('adminA');
      es400(await cambiar('adminA', id, cambios), campo, mensaje);
      assert.equal((await filaDelEvento(id)).titulo, 'Reunión de equipo');
    });
  }

  it('un cuerpo que no es un objeto es un formulario vacío: el título', async () => {
    const res = await api.post('/mi-espacio/eventos', ['Reunión'], como('adminA'));
    es400(res, 'titulo', MENSAJES_EVENTO.titulo);
  });

  it('un 404 va antes que la validación', async () => {
    const id = await crear('adminA', compartidoCon('adminB'));
    es404(await cambiar('adminB', id, { titulo: '' }));
    es404(await cambiar('adminA', 'abc', { titulo: '' }));
  });

  it('GET /eventos: las fechas que faltan o no sirven y un rango de más de 93 días, 400 en fechas, también para el lector',
    async () => {
      for (const clave of ['adminA', 'lector']) {
        for (const ruta of ['/mi-espacio/eventos', `/mi-espacio/eventos?desde=${q(0)}`,
          `/mi-espacio/eventos?desde=abc&hasta=${q(0)}`, `/mi-espacio/eventos?desde=${q(1)}&hasta=${q(0)}`,
          `/mi-espacio/eventos?desde=${q(0)}&hasta=2026-02-30`, `/mi-espacio/eventos?desde=1999-12-31&hasta=2000-01-01`]) {
          es400(await api.get(ruta, como(clave)), 'fechas', MENSAJES_MI_ESPACIO.fecha);
        }
        es400(await api.get(`/mi-espacio/eventos?desde=${q(0)}&hasta=${q(93)}`, como(clave)), 'fechas',
          'Elegí un rango de hasta 93 días.');
        assert.equal((await api.get(`/mi-espacio/eventos?desde=${q(0)}&hasta=${q(92)}`, como(clave))).status, 200);
      }
    });
});

describe('«mi recordatorio»', () => {
  it('adminB invitada lo apaga (ninguno, sin aviso) y lo prende; el evento no cambia', async () => {
    const id = await crear('adminA', compartidoCon('adminB'));
    const apagar = await miRecordatorio('adminB', id, { sin_aviso: true });
    assert.equal(apagar.status, 200, JSON.stringify(apagar.body));
    assert.deepEqual(apagar.body, {
      success: true, data: { mi_recordatorio: 'ninguno', aviso: { momento: null, texto: 'Sin aviso', corto: 'Sin aviso' } },
      message: 'Recordatorio apagado.'
    });
    assert.deepEqual(await filasDe(id), [{ usuario_id: idDe('adminB'), sin_recordatorio: 1 }]);
    const deB = await elDe('adminB', id);
    assert.equal(deB.mi_recordatorio, 'ninguno');
    assert.equal(deB.recordatorio, '2h');
    assert.equal((await elDe('adminA', id)).mi_recordatorio, '2h');
    assert.equal((await filaDelEvento(id)).recordatorio, '2h');

    const prender = await miRecordatorio('adminB', id, { sin_aviso: false });
    assert.equal(prender.status, 200, JSON.stringify(prender.body));
    assert.deepEqual(prender.body.data, {
      mi_recordatorio: '2h',
      aviso: { momento: `${q(1)} 08:00`, texto: `2 horas antes (el martes ${ddmm(q(1))} a las 08:00)`, corto: 'Aviso 2 h antes' }
    });
    assert.equal(prender.body.message, 'Recordatorio prendido.');
    assert.deepEqual(await filasDe(id), [{ usuario_id: idDe('adminB'), sin_recordatorio: 0 }]);
  });

  it('el editor apaga uno para todos (una fila nueva) y lo prende (sin fila)', async () => {
    const id = await crear('adminA', PARA_TODOS);
    assert.equal((await miRecordatorio('editor', id, { sin_aviso: true })).status, 200);
    assert.deepEqual(await filasDe(id), [{ usuario_id: idDe('editor'), sin_recordatorio: 1 }]);
    // Apagarlo otra vez no suma otra fila
    assert.equal((await miRecordatorio('editor', id, { sin_aviso: true })).status, 200);
    assert.deepEqual(await filasDe(id), [{ usuario_id: idDe('editor'), sin_recordatorio: 1 }]);
    assert.equal((await elDe('editor', id)).mi_recordatorio, 'ninguno');
    assert.equal((await elDe('adminB', id)).mi_recordatorio, '2h');
    assert.equal((await miRecordatorio('editor', id, { sin_aviso: false })).status, 200);
    assert.deepEqual(await filasDe(id), []);
    assert.equal((await elDe('editor', id)).mi_recordatorio, '2h');
  });

  it('el de un evento propio: 400 esTuyo; y uno que no ve, 404', async () => {
    const id = await crear('adminA', PARA_TODOS);
    const res = await miRecordatorio('adminA', id, { sin_aviso: true });
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: false, error: MENSAJES_EVENTO.esTuyo, campo: null });
    es404(await miRecordatorio('lector', id, { sin_aviso: true }));
    es404(await miRecordatorio('colab', id, { sin_aviso: true }));
    assert.deepEqual(await filasDe(id), []);
  });

  it('sin_aviso que no es un booleano: 400 en sin_aviso', async () => {
    const id = await crear('adminA', compartidoCon('adminB'));
    for (const cuerpo of [{ sin_aviso: 'si' }, { sin_aviso: 1 }, {}, { sin_aviso: null }]) {
      es400(await miRecordatorio('adminB', id, cuerpo), 'sin_aviso', MENSAJES_EVENTO.miRecordatorio);
    }
    assert.deepEqual(await filasDe(id), [{ usuario_id: idDe('adminB'), sin_recordatorio: 0 }]);
  });
});

describe('Review Focus 1: el recordatorio apagado sobrevive a un cambio del evento', () => {
  it('adminA cambia la hora con las mismas personas y adminB sigue apagada', async () => {
    const id = await crear('adminA', compartidoCon('adminB', 'editor'));
    assert.equal((await miRecordatorio('adminB', id, { sin_aviso: true })).status, 200);
    const res = await cambiar('adminA', id, { ...compartidoCon('adminB', 'editor'), desde: '11:00', hasta: '12:00' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const filas = await filasDe(id);
    assert.deepEqual(filas.find((fila) => fila.usuario_id === idDe('adminB')), { usuario_id: idDe('adminB'), sin_recordatorio: 1 });
    assert.deepEqual(filas.find((fila) => fila.usuario_id === idDe('editor')), { usuario_id: idDe('editor'), sin_recordatorio: 0 });
    assert.equal((await elDe('adminB', id)).mi_recordatorio, 'ninguno');
    assert.equal((await elDe('adminB', id)).desde, '11:00');
  });
});

describe('Review Focus 4: una invitada que dejó de ser administración o se desactivó', () => {
  it('el editor pasa a lector: adminA cambia el título sin tocarlo (200) y él lo sigue viendo; sumarlo a otro, no', async () => {
    const id = await crear('adminA', compartidoCon('adminB', 'editor'));
    await query("UPDATE usuarios SET rol = 'lector' WHERE id = ?", [idDe('editor')]);
    const res = await cambiar('adminA', id, { ...compartidoCon('adminB', 'editor'), titulo: 'Reunión de equipo (cambiada)' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const delEditor = await elDe('editor', id);
    assert.equal(delEditor.titulo, 'Reunión de equipo (cambiada)');
    assert.equal(delEditor.es_mio, false);
    es400(await api.post('/mi-espacio/eventos', formulario(compartidoCon('adminB', 'editor')), como('adminA')),
      'personas', MENSAJES_EVENTO.personasInvalidas);
    // Si adminA lo saca, no lo puede volver a sumar
    assert.equal((await cambiar('adminA', id, compartidoCon('adminB'))).status, 200);
    es400(await cambiar('adminA', id, compartidoCon('adminB', 'editor')), 'personas', MENSAJES_EVENTO.personasInvalidas);
  });

  it('una invitada desactivada: adminA guarda sin tocarla (200) y nadie la puede sumar de nuevo', async () => {
    const id = await crear('adminA', compartidoCon('adminB', 'editor'));
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [idDe('editor')]);
    assert.equal((await cambiar('adminA', id, { ...compartidoCon('adminB', 'editor'), desde: '09:00' })).status, 200);
    assert.deepEqual((await filasDe(id)).map((fila) => fila.usuario_id).sort((a, b) => a - b),
      [idDe('adminB'), idDe('editor')].sort((a, b) => a - b));
    // Sigue en el evento: adminA la ve entre las personas
    assert.deepEqual((await elDe('adminA', id)).personas_ids.sort((a, b) => a - b),
      [idDe('adminB'), idDe('editor')].sort((a, b) => a - b));
    es400(await api.post('/mi-espacio/eventos', formulario(compartidoCon('editor')), como('superadmin')),
      'personas', MENSAJES_EVENTO.personasInvalidas);
  });

  it('con adminA lectora: guardarlo compartido da 400 en compartido, y «Solo yo», 200', async () => {
    const id = await crear('adminA', compartidoCon('adminB'));
    await query("UPDATE usuarios SET rol = 'lector' WHERE id = ?", [idDe('adminA')]);
    es400(await cambiar('adminA', id, compartidoCon('adminB')), 'compartido', MENSAJES_EVENTO.sinPermiso);
    es400(await cambiar('adminA', id, PARA_TODOS), 'compartido', MENSAJES_EVENTO.sinPermiso);
    assert.deepEqual(await filasDe(id), [{ usuario_id: idDe('adminB'), sin_recordatorio: 0 }]);
    const solo = await cambiar('adminA', id, { compartido: false });
    assert.equal(solo.status, 200, JSON.stringify(solo.body));
    assert.deepEqual(await filasDe(id), []);
    assert.equal((await listado('adminA')).puede_compartir, false);
  });
});

describe('Review Focus 3: cuándo sale el aviso, con los feriados de cada pedido', () => {
  // Un lunes a más de dos semanas: su viernes, q(11), y su jueves, q(10), son hábiles
  const LEJOS = q(14);

  it('GET /eventos/aviso: el día hábil anterior de un lunes es el viernes y, con un feriado ese viernes, el jueves', async () => {
    const ruta = `/mi-espacio/eventos/aviso?fecha=${LEJOS}&desde=10:00&recordatorio=dia_anterior`;
    const antes = await api.get(ruta, como('lector'));
    assert.equal(antes.status, 200, JSON.stringify(antes.body));
    assert.deepEqual(antes.body, {
      success: true,
      data: { momento: `${q(11)} 10:00`, texto: `El día hábil anterior (el viernes ${ddmm(q(11))} a las 10:00)` }
    });
    await conFeriado(q(11));
    const despues = await api.get(ruta, como('lector'));
    assert.deepEqual(despues.body.data,
      { momento: `${q(10)} 10:00`, texto: `El día hábil anterior (el jueves ${ddmm(q(10))} a las 10:00)` });
    // No guarda nada
    assert.equal(await cuantosEventos(), 0);
  });

  it('GET /eventos/aviso: sin recordatorio, «2 horas antes»; «Sin aviso», momento null', async () => {
    const res = await api.get(`/mi-espacio/eventos/aviso?fecha=${q(1)}&desde=10:00`, como('adminA'));
    assert.deepEqual(res.body.data,
      { momento: `${q(1)} 08:00`, texto: `2 horas antes (el martes ${ddmm(q(1))} a las 08:00)` });
    const ninguno = await api.get(`/mi-espacio/eventos/aviso?fecha=${q(1)}&desde=10:00&recordatorio=ninguno`, como('adminA'));
    assert.deepEqual(ninguno.body.data, { momento: null, texto: 'Sin aviso' });
  });

  it('GET /eventos/aviso: un dato que no sirve, 400 en su campo', async () => {
    const maxima = fechaMaximaEvento(hoy);
    es400(await api.get(`/mi-espacio/eventos/aviso?fecha=${LEJOS}&desde=10:00&recordatorio=otro`, como('adminA')),
      'recordatorio', MENSAJES_EVENTO.recordatorio);
    es400(await api.get(`/mi-espacio/eventos/aviso?fecha=${LEJOS}&desde=9:00&recordatorio=2h`, como('adminA')),
      'desde', MENSAJES_EVENTO.desde);
    es400(await api.get('/mi-espacio/eventos/aviso?fecha=abc&desde=10:00&recordatorio=2h', como('adminA')),
      'fecha', textoRangoEvento(maxima));
    es400(await api.get('/mi-espacio/eventos/aviso', como('adminA')), 'fecha', textoRangoEvento(maxima));
  });

  it('un feriado cargado después de crear el evento mueve su aviso en el GET siguiente', async () => {
    const id = await crear('adminA', { fecha: LEJOS, recordatorio: 'dia_anterior' });
    const antes = (await eventosDe('adminA', LEJOS, LEJOS)).find((evento) => evento.id === id);
    assert.equal(antes.aviso.momento, `${q(11)} 10:00`);
    assert.equal(antes.aviso.texto, `El día hábil anterior (el viernes ${ddmm(q(11))} a las 10:00)`);
    assert.equal(antes.aviso.corto, 'Aviso el día hábil anterior');
    await conFeriado(q(11));
    const despues = (await eventosDe('adminA', LEJOS, LEJOS)).find((evento) => evento.id === id);
    assert.equal(despues.aviso.momento, `${q(10)} 10:00`);
    assert.equal(despues.aviso.texto, `El día hábil anterior (el jueves ${ddmm(q(10))} a las 10:00)`);
  });
});

describe('los datos (services/miEspacioEventosDatos.js)', () => {
  it('eventoPropio y eventoVisible: el Evento con creado_por y las horas como \'HH:MM\', o null', async () => {
    const id = await crear('adminA', { ...compartidoCon('adminB'), hasta: '' });
    const propio = await datos.eventoPropio(id, idDe('adminA'));
    assert.deepEqual(propio, {
      id, creado_por: idDe('adminA'), creador: 'Test adminA', titulo: 'Reunión de equipo', detalle: null, fecha: q(1),
      desde: '10:00', hasta: null, compartido: true, para_todos: false, recordatorio: '2h',
      personas: [{ id: idDe('adminB'), nombre: 'Test adminB', sin_recordatorio: false }]
    });
    assert.equal(await datos.eventoPropio(id, idDe('adminB')), null);
    assert.equal(await datos.eventoPropio('abc', idDe('adminA')), null);
    assert.deepEqual(await datos.eventoVisible(id, { id: idDe('adminB'), rol: 'admin' }), propio);
    assert.equal(await datos.eventoVisible(id, { id: idDe('editor'), rol: 'editor' }), null);
  });

  it('audienciaDe: sin quien lo creó y solo activas; con «Todos», la administración activa', async () => {
    const personas = await crear('adminA', compartidoCon('adminB', 'editor'));
    assert.equal((await miRecordatorio('adminB', personas, { sin_aviso: true })).status, 200);
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [idDe('editor')]);
    const evento = await datos.eventoPropio(personas, idDe('adminA'));
    assert.deepEqual(await datos.audienciaDe(evento), [
      { id: idDe('adminB'), nombre: 'Test adminB', email: usuarios.adminB.email, sin_recordatorio: true }
    ]);

    const todos = await crear('adminA', PARA_TODOS);
    assert.equal((await miRecordatorio('superadmin', todos, { sin_aviso: true })).status, 200);
    const delTodos = await datos.audienciaDe(await datos.eventoPropio(todos, idDe('adminA')));
    assert.deepEqual(delTodos, [
      { id: idDe('adminB'), nombre: 'Test adminB', email: usuarios.adminB.email, sin_recordatorio: false },
      { id: idDe('superadmin'), nombre: 'Test superadmin', email: usuarios.superadmin.email, sin_recordatorio: true }
    ]);
    // Con las marcas como llegan de un tinyint, lo mismo
    assert.deepEqual(await datos.audienciaDe({ id: todos, creado_por: idDe('adminA'), compartido: 1, para_todos: 1 }), delTodos);

    const personal = await crear('adminA');
    assert.deepEqual(await datos.audienciaDe(await datos.eventoPropio(personal, idDe('adminA'))), []);
    for (const raro of [null, undefined, 42, {}]) assert.deepEqual(await datos.audienciaDe(raro), []);
  });
});

// Lo demás de la agenda (spec, secciones 6 y 7): tus licencias de Mi espacio (con el tipo), los feriados y los compañeros que
// no están (sin el tipo: antiobjetivo), y los eventos de hoy y de mañana en «Hoy y mañana» del Resumen
describe('lo demás de la agenda', () => {
  const conLicencia = async (clave, { tipo, desde, hasta = desde, horas = null, nota = null, activo = 1, mostrar = 1 }) =>
    (await query(
      `INSERT INTO mi_espacio_licencias (usuario_id, tipo, desde, hasta, horas, nota, activo, mostrar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [idDe(clave), tipo, desde, hasta, horas, nota, activo, mostrar]
    )).insertId;
  const SEMANA = [q(0), q(1), q(2), q(3), q(4)];
  const CLAVES_DE_LA_LICENCIA = ['id', 'tipo', 'desde', 'hasta', 'texto', 'hasta_texto', 'dias'];
  const CLAVES_DEL_COMPANERO = ['nombre', 'desde', 'hasta', 'texto', 'hasta_texto', 'dias'];

  it('tus licencias de Mi espacio salen con su tipo, enteras y con sus días hábiles del rango; las de otra persona, no',
    async () => {
      // Del viernes anterior al rango al viernes q(4), con una nota (que no sale)
      const vacaciones = await conLicencia('adminA', { tipo: 'vacaciones', desde: q(-3), hasta: q(4), nota: 'Viaje familiar' });
      // Las horas llegan de la base como '2.0'
      const franquicia = await conLicencia('adminA', { tipo: 'franquicia', desde: q(8), horas: 2 });
      // Ni una dada de baja ni una fuera del rango
      await conLicencia('adminA', { tipo: 'medica', desde: q(9), activo: 0 });
      await conLicencia('adminA', { tipo: 'familiar', desde: q(30) });
      const deAdminB = await conLicencia('adminB', { tipo: 'medica', desde: q(2), mostrar: 0 });

      const { licencias } = await listado('adminA');
      assert.deepEqual(licencias, [
        {
          id: vacaciones, tipo: 'vacaciones', desde: q(-3), hasta: q(4), texto: 'Vacaciones',
          hasta_texto: `Hasta el viernes ${ddmm(q(4))}`, dias: SEMANA
        },
        { id: franquicia, tipo: 'franquicia', desde: q(8), hasta: q(8), texto: 'Franquicia, 2 h', hasta_texto: '', dias: [q(8)] }
      ]);
      for (const licencia of licencias) assert.deepEqual(Object.keys(licencia), CLAVES_DE_LA_LICENCIA);
      assert.ok(!JSON.stringify(licencias).includes('Viaje'));

      // adminB ve la suya, aunque no la muestre a los compañeros; y no la de adminA
      const deB = await listado('adminB');
      assert.deepEqual(deB.licencias.map((licencia) => [licencia.id, licencia.texto]), [[deAdminB, 'Atención médica']]);
      // El lector también tiene las suyas
      const delLector = await conLicencia('lector', { tipo: 'estudios', desde: q(3) });
      assert.deepEqual((await listado('lector')).licencias.map((licencia) => licencia.id), [delLector]);
    });

  it('licenciasPropiasEntre: las activas de la persona que tocan el rango, con las horas como número; sin un rango, []',
    async () => {
      const vacaciones = await conLicencia('adminA', { tipo: 'vacaciones', desde: q(-3), hasta: q(4) });
      const franquicia = await conLicencia('adminA', { tipo: 'franquicia', desde: q(4), horas: '7.5' });
      await conLicencia('adminA', { tipo: 'medica', desde: q(2), activo: 0 });
      await conLicencia('adminA', { tipo: 'familiar', desde: q(7) });
      await conLicencia('adminB', { tipo: 'medica', desde: q(2) });
      assert.deepEqual(await datos.licenciasPropiasEntre(idDe('adminA'), q(0), q(4)), [
        { id: vacaciones, tipo: 'vacaciones', desde: q(-3), hasta: q(4), horas: null },
        { id: franquicia, tipo: 'franquicia', desde: q(4), hasta: q(4), horas: 7.5 }
      ]);
      // Los dos días incluidos
      assert.deepEqual((await datos.licenciasPropiasEntre(idDe('adminA'), q(7), q(7))).length, 1);
      for (const [usuario, desde, hasta] of [['abc', q(0), q(4)], [idDe('adminA'), 'abc', q(4)], [idDe('adminA'), q(4), q(0)]]) {
        assert.deepEqual(await datos.licenciasPropiasEntre(usuario, desde, hasta), []);
      }
    });

  it('los compañeros que no están, sin el tipo ni la nota: con «Mostrar» sí, sin él no; unidos con lo de antes del rango',
    async () => {
      // adminB: una atención médica antes del rango, separada solo por el fin de semana, y unas vacaciones: una sola ausencia
      await conLicencia('adminB', { tipo: 'medica', desde: q(-7), hasta: q(-3), nota: 'Turno con la doctora' });
      await conLicencia('adminB', { tipo: 'vacaciones', desde: q(0), hasta: q(4), nota: 'Viaje a la costa' });
      // El editor no la muestra
      await conLicencia('editor', { tipo: 'vacaciones', desde: q(1), hasta: q(2), mostrar: 0 });
      // La de adminA no sale en la suya (sale en sus licencias)
      await conLicencia('adminA', { tipo: 'familiar', desde: q(2) });

      const { ausentes } = await listado('adminA');
      assert.deepEqual(ausentes, [{
        nombre: 'Test adminB', desde: q(-7), hasta: q(4), texto: 'Test adminB no está',
        hasta_texto: `Hasta el viernes ${ddmm(q(4))}`, dias: SEMANA
      }]);
      assert.deepEqual(Object.keys(ausentes[0]), CLAVES_DEL_COMPANERO);
      const texto = JSON.stringify(ausentes);
      for (const nada of ['medica', 'vacaciones', 'Turno', 'Viaje', 'usuario_id', 'vuelve']) {
        assert.ok(!texto.includes(nada), nada);
      }

      // adminB ve a adminA (de un día), no a sí misma
      assert.deepEqual((await listado('adminB')).ausentes, [{
        nombre: 'Test adminA', desde: q(2), hasta: q(2), texto: 'Test adminA no está', hasta_texto: '', dias: [q(2)]
      }]);
      // El lector y el colaborador no ven a los compañeros
      for (const clave of ['lector', 'colab']) assert.deepEqual((await listado(clave)).ausentes, [], clave);
    });

  it('los feriados del rango: «Feriado: <nombre>», también en un fin de semana, y sacan el día de una licencia', async () => {
    await conFeriado(q(2), 'Feriado de prueba');
    await conFeriado(q(5), 'Feriado de un sábado');
    await conLicencia('adminA', { tipo: 'vacaciones', desde: q(0), hasta: q(4) });
    // q(0) a q(4) son días de semana hábiles: ningún fijo
    const data = await listado('adminA', q(0), q(4));
    assert.deepEqual(data.feriados, [{ fecha: q(2), nombre: 'Feriado de prueba', texto: 'Feriado: Feriado de prueba' }]);
    assert.deepEqual(data.licencias[0].dias, [q(0), q(1), q(3), q(4)]);
    const conElSabado = (await listado('adminA', q(0), q(6))).feriados;
    assert.ok(conElSabado.some((feriado) => feriado.fecha === q(5) && feriado.texto === 'Feriado: Feriado de un sábado'));
  });

  it('un fijo con el mismo nombre en la tabla va una vez; con otro nombre, los dos; los fijos sin cargar nada', async () => {
    const anio = Number(hoy.slice(0, 4)) + 1;
    await conFeriado(`${anio}-12-25`, 'Navidad');
    await conFeriado(`${anio}-12-08`, 'Otro feriado de prueba');
    const { feriados } = await listado('adminA', `${anio}-12-01`, `${anio}-12-31`);
    assert.deepEqual(feriados, [
      { fecha: `${anio}-12-08`, nombre: 'Inmaculada Concepción de María', texto: 'Feriado: Inmaculada Concepción de María' },
      { fecha: `${anio}-12-08`, nombre: 'Otro feriado de prueba', texto: 'Feriado: Otro feriado de prueba' },
      { fecha: `${anio}-12-25`, nombre: 'Navidad', texto: 'Feriado: Navidad' }
    ]);
  });
});

describe('«Hoy y mañana» del Resumen: los eventos', () => {
  // La API usa la hora real y los de hoy que ya terminaron no van (spec 2026-10-27-mi-espacio-resumen, 4.4): los de hoy que
  // tienen que salir terminan a las 23:59
  it('uno de hoy y uno compartido de mañana salen; uno de pasado mañana, uno de ayer y uno que no ve, no', async () => {
    const deHoy = await crear('adminA', { titulo: 'Llamar a Vialidad por el TMDA', fecha: dia(0), desde: '12:00', hasta: '23:59' });
    const deManana = await crear('adminB', { fecha: dia(1), desde: '10:00', ...compartidoCon('adminA') });
    await crear('adminA', { titulo: 'Pasado mañana', fecha: dia(2) });
    await crear('adminA', { titulo: 'Ayer', fecha: dia(-1) });
    await crear('adminB', { titulo: 'De adminB, personal', fecha: dia(0), hasta: '23:59' });

    const res = await api.get('/mi-espacio/resumen', como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { hoy_y_manana: hoyYManana } = res.body.data;
    assert.deepEqual(Object.keys(hoyYManana), ['ausentes_hoy', 'ausentes_manana', 'proximo_feriado', 'eventos']);
    assert.deepEqual(hoyYManana.eventos, [
      {
        id: deHoy, hora: '12:00', titulo: 'Llamar a Vialidad por el TMDA', compartido: false, detalle: 'Hoy · solo vos',
        dia: 'hoy', quien: 'solo vos'
      },
      {
        id: deManana, hora: '10:00', titulo: 'Reunión de equipo', compartido: true, detalle: 'Mañana · de Test adminB',
        dia: 'manana', quien: 'de Test adminB'
      }
    ]);

    // Quien lo creó lo ve con sus personas
    const deB = (await api.get('/mi-espacio/resumen', como('adminB'))).body.data.hoy_y_manana.eventos;
    assert.deepEqual(deB.map((evento) => evento.detalle), ['Hoy · solo vos', 'Mañana · con Test adminA']);
    // Sin modalidad ni eventos, la lista vacía (la página decide qué mostrar)
    const delLector = await api.get('/mi-espacio/resumen', como('lector'));
    assert.equal(delLector.status, 200, JSON.stringify(delLector.body));
    assert.deepEqual(delLector.body.data.hoy_y_manana.eventos, []);
  });

  it('el de hoy que ya terminó no va; el de mañana a la misma hora, sí', async () => {
    const yaTermino = await crear('adminA', { titulo: 'Ya terminó', fecha: dia(0), desde: '00:00', hasta: '00:01' });
    const deManana = await crear('adminA', { titulo: 'Mañana temprano', fecha: dia(1), desde: '00:00', hasta: '00:01' });
    const antes = ahoraArgentina();
    const res = await api.get('/mi-espacio/resumen', como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const ids = res.body.data.hoy_y_manana.eventos.map((evento) => evento.id);
    assert.ok(ids.includes(deManana), JSON.stringify(ids));
    // Entre las 00:00 y las 00:01 todavía no terminó: solo se mira si el pedido salió más tarde, el mismo día
    if (antes.slice(0, 10) === hoy && antes.slice(11, 16) > '00:01') assert.ok(!ids.includes(yaTermino), JSON.stringify(ids));
  });

  it('aislado: si leer los eventos falla, el Resumen sale igual, con la lista vacía', async () => {
    await crear('adminA', { fecha: dia(0), hasta: '23:59' });
    await query('RENAME TABLE mi_espacio_eventos TO mi_espacio_eventos_falla_simulada');
    try {
      const res = await api.get('/mi-espacio/resumen', como('adminA'));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(res.body.data.hoy_y_manana.eventos, []);
      assert.deepEqual(Object.keys(res.body.data.hoy_y_manana),
        ['ausentes_hoy', 'ausentes_manana', 'proximo_feriado', 'eventos']);
    } finally {
      await query('RENAME TABLE mi_espacio_eventos_falla_simulada TO mi_espacio_eventos');
    }
    assert.equal((await api.get('/mi-espacio/resumen', como('adminA'))).body.data.hoy_y_manana.eventos.length, 1);
  });
});

// El nombre corto (spec 2026-10-28-mi-espacio-agenda-onda, 5.1 y decisiones 9.3, 9.4 y 9.13): en la agenda y en el Resumen,
// los compañeros que no están, quien creó un evento y quién está van con el primer nombre (y la inicial del último apellido si
// otra persona de la administración activa tiene el mismo); `personas`, con los nombres completos. Con personas inventadas
// (las del archivo empiezan todas con «Test»), y los eventos y las ausencias cargados por SQL: no sale ningún email
describe('el nombre corto en la agenda y en el Resumen', () => {
  const NOMBRES = Object.freeze({
    andrea: ['admin', 'Andrea Paula Molina'],
    julian: ['admin', 'Julián Esteban Ferreyra'],
    carlaB: ['editor', 'Carla Inés Benítez'],
    carlaR: ['editor', 'Carla Ríos']
  });
  let companeros;
  const de = (clave) => ({ token: companeros[clave].token });
  const activa = (clave, activo) => query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo, companeros[clave].id]);
  // Un evento de `clave` (de 10:00 a 11:00) compartido con `invitadas`
  const compartidoPor = async (clave, invitadas, fecha = q(1)) => {
    const { insertId } = await query(
      `INSERT INTO mi_espacio_eventos (creado_por, titulo, fecha, desde, hasta, compartido, para_todos)
       VALUES (?, 'Reunión de equipo', ?, '10:00', '11:00', 1, 0)`, [companeros[clave].id, fecha]
    );
    for (const invitada of invitadas) {
      await query('INSERT INTO mi_espacio_evento_personas (evento_id, usuario_id) VALUES (?, ?)',
        [insertId, companeros[invitada].id]);
    }
    return insertId;
  };
  const ausenciaDe = (clave, desde, hasta = desde) => query(
    "INSERT INTO mi_espacio_licencias (usuario_id, tipo, desde, hasta, mostrar) VALUES (?, 'medica', ?, ?, 1)",
    [companeros[clave].id, desde, hasta]
  );
  // GET /mi-espacio/eventos de q(0) a q(20), como lo ve `clave`
  const agendaDe = async (clave) => {
    const res = await api.get(`/mi-espacio/eventos?desde=${q(0)}&hasta=${q(20)}`, de(clave));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data;
  };
  const elEventoDe = async (clave, id) => (await agendaDe(clave)).eventos.find((evento) => evento.id === id);

  before(async () => {
    companeros = await crearUsuariosPrueba(api, Object.fromEntries(Object.entries(NOMBRES).map(([clave, [rol]]) => [clave, rol])));
    for (const [clave, [, nombre]] of Object.entries(NOMBRES)) {
      await query('UPDATE usuarios SET nombre_completo = ? WHERE id = ?', [nombre, companeros[clave].id]);
    }
  });

  after(async () => {
    if (companeros) await limpiarDatosPrueba(companeros);
  });

  it('GET /eventos: el de Julián, «De Julián» y «Lo creó Julián. Están: vos y Carla B.»; personas, con los nombres completos',
    async () => {
      const deJulian = await compartidoPor('julian', ['andrea', 'carlaB']);
      const comoLoVeAndrea = await elEventoDe('andrea', deJulian);
      assert.equal(comoLoVeAndrea.es_mio, false);
      assert.equal(comoLoVeAndrea.creador, 'Julián');
      assert.equal(comoLoVeAndrea.quien_texto, 'De Julián');
      assert.equal(comoLoVeAndrea.quien_largo, 'Lo creó Julián. Están: vos y Carla B.');
      assert.deepEqual(comoLoVeAndrea.personas, ['Andrea Paula Molina', 'Carla Inés Benítez']);
      assert.deepEqual(Object.keys(comoLoVeAndrea), CLAVES_DEL_AJENO);
      // Julián lo ve como suyo, con dos personas
      const comoLoVeJulian = await elEventoDe('julian', deJulian);
      assert.equal(comoLoVeJulian.quien_texto, 'Con 2 personas');
      assert.deepEqual(comoLoVeJulian.personas, ['Andrea Paula Molina', 'Carla Inés Benítez']);
      // Uno de Andrea con una sola persona la nombra: «Con Carla B.»
      const deAndrea = await compartidoPor('andrea', ['carlaB'], q(2));
      assert.equal((await elEventoDe('andrea', deAndrea)).quien_texto, 'Con Carla B.');
      assert.equal((await elEventoDe('carlaB', deAndrea)).quien_largo, 'Lo creó Andrea. Están: vos.');
      // La administración se lee en cada pedido: con Carla Ríos desactivada, Carla Benítez es «Carla»
      try {
        await activa('carlaR', 0);
        assert.equal((await elEventoDe('andrea', deJulian)).quien_largo, 'Lo creó Julián. Están: vos y Carla.');
        assert.equal((await elEventoDe('andrea', deAndrea)).quien_texto, 'Con Carla');
      } finally {
        await activa('carlaR', 1);
      }
    });

  it('GET /eventos: los compañeros que no están, «Carla B. no está» y «Carla R. no está»; sin Carla Ríos, «Carla no está»',
    async () => {
      await ausenciaDe('carlaB', q(1), q(2));
      await ausenciaDe('carlaR', q(3));
      assert.deepEqual((await agendaDe('andrea')).ausentes, [
        {
          nombre: 'Carla B.', desde: q(1), hasta: q(2), texto: 'Carla B. no está', hasta_texto: `Hasta el miércoles ${ddmm(q(2))}`,
          dias: [q(1), q(2)]
        },
        { nombre: 'Carla R.', desde: q(3), hasta: q(3), texto: 'Carla R. no está', hasta_texto: '', dias: [q(3)] }
      ]);
      try {
        await activa('carlaR', 0);
        assert.deepEqual((await agendaDe('andrea')).ausentes.map(({ nombre, texto }) => [nombre, texto]),
          [['Carla', 'Carla no está']]);
      } finally {
        await activa('carlaR', 1);
      }
    });

  it('el Resumen: «Hoy y mañana» dice «de Julián» y, a Julián, «con Andrea»', async () => {
    const id = await compartidoPor('julian', ['andrea'], dia(1));
    const res = await api.get('/mi-espacio/resumen', de('andrea'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.hoy_y_manana.eventos.map(({ id: cada, quien, detalle }) => [cada, quien, detalle]),
      [[id, 'de Julián', 'Mañana · de Julián']]);
    const deJulian = await api.get('/mi-espacio/resumen', de('julian'));
    assert.equal(deJulian.status, 200, JSON.stringify(deJulian.body));
    assert.deepEqual(deJulian.body.data.hoy_y_manana.eventos.map(({ id: cada, quien }) => [cada, quien]), [[id, 'con Andrea']]);
  });
});

// Los emails que salen al guardar un evento (spec, sección 4; services/miEspacioEventosEmails.js): la invitación, el cambio y
// la cancelación, después de responder y aunque la persona esté de licencia. Cada envío deja su fila en
// mi_espacio_evento_envios, que se anota después de mandar: con las filas, los emails ya están en Mailpit. El título de cada
// evento lleva una marca propia del test, y de Mailpit cuentan solo los emails con ella (su Snippet trae el comienzo del cuerpo,
// con el título): Mailpit puede tener los de otras sesiones, o uno de un test anterior que salió después de que se vació
describe('los emails del guardado', () => {
  const ASUNTOS = Object.freeze({
    invitacion: 'RPAD: te sumaron a un evento', cambio: 'RPAD: cambió un evento', cancelacion: 'RPAD: se canceló un evento'
  });
  // Las casillas por defecto de sendEmail (services/emailService.js): las de la DGMIT. Nunca les llega nada de acá
  const CASILLAS_POR_DEFECTO = [
    'datospublicos@comodoro.gov.ar', 'mit@comodoro.gov.ar', 'investigacionterritorial@comodoro.gov.ar'
  ];
  // 'dd/mm/aaaa' de una fecha, escrito a mano
  const fechaLarga = (fecha) => `${ddmm(fecha)}/${fecha.slice(0, 4)}`;
  const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  let marca;
  beforeEach(() => {
    marca = crypto.randomBytes(4).toString('hex');
  });
  const titulo = () => `Reunión ${marca}`;
  // El formulario de este test: el título con la marca y lo que cambia cada caso
  const conMarca = (cambios = {}) => ({ titulo: titulo(), ...cambios });

  // Los envíos anotados de un evento, en el orden en que se anotaron
  const enviosDe = async (eventoId) => (await query(
    `SELECT usuario_id, tipo, DATE_FORMAT(para, '%Y-%m-%d %H:%i') AS para,
       DATE_FORMAT(enviado_at, '%Y-%m-%d %H:%i:%s') AS enviado_at, success
     FROM mi_espacio_evento_envios WHERE evento_id = ? ORDER BY id`, [eventoId]
  )).map((fila) => ({ ...fila, usuario_id: Number(fila.usuario_id), success: Number(fila.success) }));
  // Espera a que el evento tenga al menos `cantidad` envíos anotados (hasta unos 5 s) y un rato más, por si llega uno de más:
  // los emails salen después de responder
  const esperarEnvios = async (eventoId, cantidad) => {
    for (let intento = 0; intento < 100 && (await enviosDe(eventoId)).length < cantidad; intento++) await esperar(50);
    await esperar(300);
    return enviosDe(eventoId);
  };
  const claveDe = (id) => Object.keys(usuarios).find((clave) => usuarios[clave].id === id);
  // [tipo, clave] de cada envío, para compararlos sin depender del orden de los ids
  const quienes = (envios) => envios.map((envio) => [envio.tipo, claveDe(envio.usuario_id)]).sort();

  // Los emails de este test en Mailpit (con la marca), con su texto visible; a una persona, o a cualquiera
  const emailsDelTest = async (clave = null) => {
    const delTest = (await mailpit.mensajes()).filter((mensaje) => (mensaje.Snippet ?? '').includes(marca))
      .filter((mensaje) => clave === null || paraCasilla(usuarios[clave].email)(mensaje));
    return Promise.all(delTest.map(async (mensaje) => ({
      asunto: mensaje.Subject, casillas: mensaje.To.map((to) => to.Address), texto: textoVisible(await mailpit.html(mensaje.ID))
    })));
  };
  // Espera a que Mailpit tenga `cantidad` emails de este test (hasta unos 5 s) y los devuelve
  const esperarEmails = async (cantidad) => {
    let emails = await emailsDelTest();
    for (let intento = 0; intento < 100 && emails.length < cantidad; intento++) {
      await esperar(50);
      emails = await emailsDelTest();
    }
    return emails;
  };
  const casillasDe = (emails) => emails.flatMap((email) => email.casillas).sort();
  const casillasDeLas = (...claves) => claves.map((clave) => usuarios[clave].email).sort();

  it('el alta compartida le llega a adminB y no a adminA, después de responder, con su fila (success = 1)', async () => {
    const desde = ahoraArgentina();
    const id = await crear('adminA', conMarca(compartidoCon('adminB')));
    const envios = await esperarEnvios(id, 1);
    const hasta = ahoraArgentina();
    assert.equal(envios.length, 1, JSON.stringify(envios));
    const [envio] = envios;
    assert.deepEqual({ ...envio, enviado_at: undefined },
      { usuario_id: idDe('adminB'), tipo: 'invitacion', para: `${q(1)} 10:00`, enviado_at: undefined, success: 1 });
    // enviado_at, con ahoraArgentina(): entre antes de guardar y después de anotar
    assert.ok(envio.enviado_at >= desde && envio.enviado_at <= hasta, `${desde} <= ${envio.enviado_at} <= ${hasta}`);

    const emails = await esperarEmails(1);
    assert.deepEqual(casillasDe(emails), casillasDeLas('adminB'));
    assert.equal(emails[0].asunto, ASUNTOS.invitacion);
    const invitacion = `Test adminA te sumó a un evento: ${titulo()}, martes ${fechaLarga(q(1))} de 10:00 a 11:00. `
      + 'Ver en Mi espacio';
    assert.ok(emails[0].texto.includes(invitacion), emails[0].texto);
    assert.deepEqual(await emailsDelTest('adminA'), []);
  });

  it('con todos, a toda la administración activa menos adminA, y a nadie más (ni al lector, ni al colaborador)', async () => {
    const id = await crear('adminA', conMarca(PARA_TODOS));
    const envios = await esperarEnvios(id, 3);
    assert.deepEqual(quienes(envios), [['invitacion', 'adminB'], ['invitacion', 'editor'], ['invitacion', 'superadmin']]);
    assert.ok(envios.every((envio) => envio.success === 1 && envio.para === `${q(1)} 10:00`), JSON.stringify(envios));
    const emails = await esperarEmails(3);
    assert.deepEqual(casillasDe(emails), casillasDeLas('adminB', 'editor', 'superadmin'));
    assert.ok(emails.every((email) => email.asunto === ASUNTOS.invitacion));
    for (const casilla of CASILLAS_POR_DEFECTO) assert.ok(!casillasDe(emails).includes(casilla), casilla);
  });

  it('cambiar la hora le avisa a adminB; el detalle o el recordatorio, no; sumar al editor lo invita solo a él', async () => {
    const id = await crear('adminA', conMarca(compartidoCon('adminB')));
    await esperarEnvios(id, 1);
    // Solo el detalle y el recordatorio: nada
    const soloDetalle = await cambiar('adminA', id,
      conMarca({ ...compartidoCon('adminB'), detalle: 'Otro detalle', recordatorio: '1h' }));
    assert.equal(soloDetalle.status, 200, JSON.stringify(soloDetalle.body));
    // La hora: el cambio, a adminB (si el detalle hubiera mandado otro, serían dos)
    const otraHora = { ...compartidoCon('adminB'), detalle: 'Otro detalle', recordatorio: '1h', desde: '11:00', hasta: '12:00' };
    assert.equal((await cambiar('adminA', id, conMarca(otraHora))).status, 200);
    let envios = await esperarEnvios(id, 2);
    assert.deepEqual(envios.map((envio) => [envio.tipo, claveDe(envio.usuario_id), envio.para]),
      [['invitacion', 'adminB', `${q(1)} 10:00`], ['cambio', 'adminB', `${q(1)} 11:00`]]);

    // Sumar al editor sin cambiar nada más: la invitación, solo a él
    assert.equal((await cambiar('adminA', id, conMarca({ ...otraHora, ...compartidoCon('adminB', 'editor') }))).status, 200);
    envios = await esperarEnvios(id, 3);
    assert.deepEqual(quienes(envios.slice(2)), [['invitacion', 'editor']]);

    // Cambiar la fecha y sumar al superadmin: el cambio a los que estaban y la invitación, con lo nuevo, al que entra
    const otroDia = { ...otraHora, ...compartidoCon('adminB', 'editor', 'superadmin'), fecha: q(2) };
    assert.equal((await cambiar('adminA', id, conMarca(otroDia))).status, 200);
    envios = await esperarEnvios(id, 6);
    assert.equal(envios.length, 6, JSON.stringify(envios));
    assert.deepEqual(quienes(envios.slice(3)), [['cambio', 'adminB'], ['cambio', 'editor'], ['invitacion', 'superadmin']]);
    assert.ok(envios.slice(3).every((envio) => envio.para === `${q(2)} 11:00` && envio.success === 1));

    const emails = await esperarEmails(6);
    const deB = emails.filter((email) => email.casillas.includes(usuarios.adminB.email));
    assert.deepEqual(deB.map((email) => email.asunto).sort(), [ASUNTOS.cambio, ASUNTOS.cambio, ASUNTOS.invitacion].sort());
    const elUltimo = deB.find((email) => email.texto.includes('miércoles'));
    const cambio = `Cambió un evento: ${titulo()}, miércoles ${fechaLarga(q(2))} de 11:00 a 12:00. `
      + `Antes: ${titulo()}, martes ${fechaLarga(q(1))} de 11:00 a 12:00 Otro detalle Lo cambió Test adminA. Ver en Mi espacio`;
    assert.ok(elUltimo.texto.includes(cambio), elUltimo.texto);
    const delSuperadmin = emails.filter((email) => email.casillas.includes(usuarios.superadmin.email));
    assert.equal(delSuperadmin.length, 1);
    assert.equal(delSuperadmin[0].asunto, ASUNTOS.invitacion);
    const nueva = `te sumó a un evento: ${titulo()}, miércoles ${fechaLarga(q(2))} de 11:00 a 12:00.`;
    assert.ok(delSuperadmin[0].texto.includes(nueva), delSuperadmin[0].texto);
  });

  it('borrarlo les avisa a los dos que se canceló, con la fecha y la hora que tenía', async () => {
    const id = await crear('adminA', conMarca(compartidoCon('adminB', 'editor')));
    await esperarEnvios(id, 2);
    assert.equal((await borrar('adminA', id)).status, 200);
    const envios = await esperarEnvios(id, 4);
    assert.equal(envios.length, 4, JSON.stringify(envios));
    assert.deepEqual(quienes(envios.slice(2)), [['cancelacion', 'adminB'], ['cancelacion', 'editor']]);
    assert.ok(envios.slice(2).every((envio) => envio.para === `${q(1)} 10:00` && envio.success === 1));
    const emails = (await esperarEmails(4)).filter((email) => email.asunto === ASUNTOS.cancelacion);
    assert.deepEqual(casillasDe(emails), casillasDeLas('adminB', 'editor'));
    const cancelacion = `Se canceló: ${titulo()}, martes ${fechaLarga(q(1))} a las 10:00. Lo canceló Test adminA. `
      + 'Ver en Mi espacio';
    assert.ok(emails[0].texto.includes(cancelacion), emails[0].texto);
  });

  it('a quien se saca, o si pasa a «Solo yo», no le llega nada; si se lo vuelve a sumar, otra invitación', async () => {
    const id = await crear('adminA', conMarca(compartidoCon('adminB', 'editor')));
    await esperarEnvios(id, 2);
    // Sale el editor y cambia la hora: el cambio, solo a adminB
    assert.equal((await cambiar('adminA', id, conMarca({ ...compartidoCon('adminB'), desde: '09:00' }))).status, 200);
    let envios = await esperarEnvios(id, 3);
    assert.deepEqual(quienes(envios.slice(2)), [['cambio', 'adminB']]);
    // Pasa a «Solo yo» y cambia la hora otra vez: nada. Vuelve adminB: otra invitación (si «Solo yo» hubiera mandado algo,
    // serían dos)
    assert.equal((await cambiar('adminA', id, conMarca({ compartido: false, desde: '08:00' }))).status, 200);
    assert.equal((await cambiar('adminA', id, conMarca({ ...compartidoCon('adminB'), desde: '08:00' }))).status, 200);
    envios = await esperarEnvios(id, 4);
    assert.equal(envios.length, 4, JSON.stringify(envios));
    assert.deepEqual(quienes(envios.slice(3)), [['invitacion', 'adminB']]);
    assert.deepEqual(quienes(envios.filter((envio) => envio.usuario_id === idDe('editor'))), [['invitacion', 'editor']]);
  });

  it('Review Focus 4: la invitada desactivada no recibe nada; la que dejó de ser administración, sí', async () => {
    const conLasTres = compartidoCon('adminB', 'editor', 'superadmin');
    const id = await crear('adminA', conMarca(conLasTres));
    await esperarEnvios(id, 3);
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [idDe('editor')]);
    await query("UPDATE usuarios SET rol = 'lector' WHERE id = ?", [idDe('superadmin')]);
    assert.equal((await cambiar('adminA', id, conMarca({ ...conLasTres, desde: '09:00' }))).status, 200);
    let envios = await esperarEnvios(id, 5);
    assert.deepEqual(quienes(envios.slice(3)), [['cambio', 'adminB'], ['cambio', 'superadmin']]);
    assert.equal((await borrar('adminA', id)).status, 200);
    envios = await esperarEnvios(id, 7);
    assert.equal(envios.length, 7, JSON.stringify(envios));
    assert.deepEqual(quienes(envios.slice(5)), [['cancelacion', 'adminB'], ['cancelacion', 'superadmin']]);
    // Al editor, solo la invitación de cuando estaba activo
    assert.deepEqual(quienes(envios.filter((envio) => envio.usuario_id === idDe('editor'))), [['invitacion', 'editor']]);
    const emails = await esperarEmails(7);
    assert.equal(emails.filter((email) => email.casillas.includes(usuarios.editor.email)).length, 1);
  });

  it('adminB, con una licencia de Configuración hoy, lo recibe igual: van al mail laboral', async () => {
    await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [idDe('adminB'), hoy, dia(2)]);
    const id = await crear('adminA', conMarca(compartidoCon('adminB')));
    const envios = await esperarEnvios(id, 1);
    assert.deepEqual(quienes(envios), [['invitacion', 'adminB']]);
    assert.equal(envios[0].success, 1);
    assert.deepEqual(casillasDe(await esperarEmails(1)), casillasDeLas('adminB'));
  });

  it('con un email que no pasa emailValido: ni mensaje ni fila (nunca a las casillas por defecto)', async () => {
    await query("UPDATE usuarios SET email = 'sin-arroba' WHERE id = ?", [idDe('adminB')]);
    try {
      const id = await crear('adminA', conMarca(compartidoCon('adminB', 'editor')));
      const envios = await esperarEnvios(id, 1);
      assert.deepEqual(quienes(envios), [['invitacion', 'editor']]);
      assert.deepEqual(casillasDe(await esperarEmails(1)), casillasDeLas('editor'));
    } finally {
      await query('UPDATE usuarios SET email = ? WHERE id = ?', [usuarios.adminB.email, idDe('adminB')]);
    }
  });

  // Los emails salen solo con un 2xx (guardarEvento): un rechazo no manda nada ni deja filas. Lo prueba un guardado posterior que
  // sí manda (si los rechazados hubieran mandado algo, habría más filas)
  it('un guardado rechazado no manda nada ni deja filas: el 400 con la hora cambiada y el 404 de quien no lo creó', async () => {
    const conLosDos = compartidoCon('adminB', 'editor');
    const id = await crear('adminA', conMarca(conLosDos));
    await esperarEnvios(id, 2);
    // adminA le cambia la hora con «A» antes de «De»: 400, no se guarda
    const invalido = await cambiar('adminA', id, conMarca({ ...conLosDos, desde: '12:00', hasta: '11:00' }));
    assert.equal(invalido.status, 400, JSON.stringify(invalido.body));
    // adminB no lo creó: cambiarle la hora y borrarlo le dan 404
    assert.equal((await cambiar('adminB', id, conMarca({ ...compartidoCon('adminA', 'editor'), desde: '09:00' }))).status, 404);
    assert.equal((await borrar('adminB', id)).status, 404);
    // Un cambio de hora que sí sale: el cambio, a los dos, con la hora nueva
    assert.equal((await cambiar('adminA', id, conMarca({ ...conLosDos, desde: '08:00', hasta: '09:00' }))).status, 200);
    const envios = await esperarEnvios(id, 4);
    assert.equal(envios.length, 4, JSON.stringify(envios));
    assert.deepEqual(quienes(envios.slice(2)), [['cambio', 'adminB'], ['cambio', 'editor']]);
    assert.ok(envios.slice(2).every((envio) => envio.para === `${q(1)} 08:00` && envio.success === 1), JSON.stringify(envios));
    const emails = await esperarEmails(4);
    assert.equal(emails.length, 4, JSON.stringify(emails.map((email) => email.asunto)));
    assert.deepEqual(emails.map((email) => email.asunto).sort(),
      [ASUNTOS.cambio, ASUNTOS.cambio, ASUNTOS.invitacion, ASUNTOS.invitacion]);
    assert.ok(!emails.some((email) => email.asunto === ASUNTOS.cancelacion));
  });

  // El servicio, llamado en el proceso del test (el pool ya apunta a la base de prueba): con la barrera EMAIL_SOLO_A, que
  // filtra todo, sendEmail no manda y el envío queda anotado con success = 0. Nunca tira
  it('en el proceso: con EMAIL_SOLO_A = nadie@rpad.test, success = 0, y nunca tira', async () => {
    const servicio = await import('../services/miEspacioEventosEmails.js');
    const id = await crear('adminA', conMarca());
    const evento = await datos.eventoPropio(id, idDe('adminA'));
    const audiencia = new Map([[idDe('adminB'), { email: usuarios.adminB.email }], [idDe('editor'), { email: 'sin-arroba' }]]);
    const avisos = mock.method(console, 'warn', () => {});
    const errores = mock.method(console, 'error', () => {});
    process.env.EMAIL_SOLO_A = 'nadie@rpad.test';
    try {
      const resultado = await servicio.enviarEmailsDelGuardado({
        plan: { invitacion: [idDe('adminB'), idDe('editor')], cambio: [], cancelacion: [] },
        antes: null, despues: evento, creador: 'Test adminA', audiencia
      });
      assert.deepEqual(resultado, { enviados: 0, fallidos: 1 });
      const envios = await enviosDe(id);
      assert.deepEqual(envios.map((envio) => ({ ...envio, enviado_at: undefined })),
        [{ usuario_id: idDe('adminB'), tipo: 'invitacion', para: `${q(1)} 10:00`, enviado_at: undefined, success: 0 }]);
      assert.match(envios[0].enviado_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

      // Lo que no sirve no tira: sin entrada, sin un plan, sin un Map
      for (const raro of [undefined, null, 42, {}, { plan: null }, { plan: { invitacion: [idDe('adminB')] }, despues: evento }]) {
        assert.deepEqual(await servicio.enviarEmailsDelGuardado(raro), { enviados: 0, fallidos: 0 }, JSON.stringify(raro));
      }
      // Un evento que ya no existe: anotarlo falla (la clave foránea) y va a la consola, sin tirar
      const fantasma = await servicio.enviarEmailsDelGuardado({
        plan: { invitacion: [idDe('adminB')], cambio: [], cancelacion: [] }, antes: null, despues: { ...evento, id: 999999 },
        creador: 'Test adminA', audiencia
      });
      assert.deepEqual(fantasma, { enviados: 0, fallidos: 1 });
      assert.ok(errores.mock.callCount() >= 1);
      assert.equal((await enviosDe(id)).length, 1);
    } finally {
      process.env.EMAIL_SOLO_A = '';
      avisos.mock.restore();
      errores.mock.restore();
    }
  });
});

// Correos → Estado (spec, sección 5): la línea de la última corrida de los recordatorios y sus alertas, que avisan si en un
// día hábil la corrida no pasó en la última hora (así se nota que la Tarea Cron no quedó configurada). La corrida es la fila
// 1 de mi_espacio_eventos_corridas, escrita por SQL; los feriados se leen de la tabla en cada pedido
describe('Correos → Estado: la última corrida de los recordatorios', () => {
  // El lunes 26/10/2026 a las 10:45; el sábado 31/10/2026
  const LUNES_10_45 = '2026-10-26 10:45:00';
  const SABADO = '2026-10-31 10:45:00';
  const ENVIADOS = 'Recordatorios enviados: 2.';
  const CON_ERRORES = 'Recordatorios enviados: 0. Fallidos: 1.';
  const SIN_REGISTRO = 'Recordatorios de la agenda: sin registro todavía.';
  const NINGUNA = Object.freeze({
    tipo: 'eventos-sin-corrida', nivel: 'error',
    mensaje: 'No hay registro de ninguna corrida de los recordatorios de la agenda: revisá la Tarea Cron de /api/cron/eventos.'
  });
  const SIN_ESTADO = Object.freeze({
    tipo: 'eventos-sin-estado', nivel: 'advertencia', mensaje: 'No se pudo leer la última corrida de los recordatorios de la agenda.'
  });
  // Los campos de siempre del estado de las Notas Digitales (estadoNotas de services/notasDigitales.js)
  const CAMPOS_DE_SIEMPRE = ['envio_activo', 'configuracion_faltante', 'fallidas', 'proximas', 'licencia_firmante', 'auditoria',
    'ultima_corrida', 'alertas'];

  // La fila de la última corrida: empezó en `inicio` ('AAAA-MM-DD HH:MM:SS') y, salvo que diga otra cosa, terminó a los 4
  // segundos
  const anotarCorrida = ({ inicio, fin = `${inicio.slice(0, 17)}04`, resultado = ENVIADOS, conErrores = 0 }) => query(
    'INSERT INTO mi_espacio_eventos_corridas (id, inicio_at, fin_at, resultado, con_errores) VALUES (1, ?, ?, ?, ?)',
    [inicio, fin, resultado, conErrores]
  );
  const pedirEstado = async () => {
    const res = await api.get('/notificaciones/notas-digitales/estado', como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.success, true);
    for (const campo of CAMPOS_DE_SIEMPRE) assert.ok(campo in res.body.data, `falta ${campo}`);
    assert.ok(Array.isArray(res.body.data.alertas));
    return res.body.data;
  };
  const esDeEventos = (alerta) => alerta.tipo.startsWith('eventos-');
  const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  describe('estadoDeLosRecordatorios, en el proceso', () => {
    it('la línea, la corrida y ninguna alerta con la última a las 10:30; a las 11:45, eventos-sin-corrida', async () => {
      await anotarCorrida({ inicio: '2026-10-26 10:30:00' });
      const leida = { inicio: '2026-10-26 10:30', fin: '2026-10-26 10:30', resultado: ENVIADOS, con_errores: false, en_curso: false };
      const texto = 'Recordatorios de la agenda: última corrida hoy a las 10:30. Recordatorios enviados: 2.';
      assert.deepEqual(await corrida.estadoDeLosRecordatorios({ ahora: LUNES_10_45 }), { texto, corrida: leida, alertas: [] });
      assert.deepEqual(await corrida.estadoDeLosRecordatorios({ ahora: '2026-10-26 11:45:00' }), {
        texto, corrida: leida,
        alertas: [{
          tipo: 'eventos-sin-corrida', nivel: 'error',
          mensaje: 'Los recordatorios de la agenda no corren desde hoy a las 10:30: revisá la Tarea Cron de /api/cron/eventos.'
        }]
      });
    });

    it('un feriado cargado en la tabla saca la alerta de ese día: se lee en cada pedido', async () => {
      await anotarCorrida({ inicio: '2026-10-23 10:30:00' });
      assert.equal((await corrida.estadoDeLosRecordatorios({ ahora: LUNES_10_45 })).alertas.length, 1);
      await conFeriado('2026-10-26');
      assert.deepEqual((await corrida.estadoDeLosRecordatorios({ ahora: LUNES_10_45 })).alertas, []);
    });

    it('sin ninguna corrida: «sin registro todavía.» y, en un día hábil, la alerta de que no hay registro; un sábado, ninguna', async () => {
      assert.deepEqual(await corrida.estadoDeLosRecordatorios({ ahora: LUNES_10_45 }),
        { texto: SIN_REGISTRO, corrida: null, alertas: [NINGUNA] });
      assert.deepEqual(await corrida.estadoDeLosRecordatorios({ ahora: SABADO }), { texto: SIN_REGISTRO, corrida: null, alertas: [] });
    });

    it('con errores, eventos-con-errores; sin fin, interrumpida o, con el candado tomado, en curso', async () => {
      await anotarCorrida({ inicio: '2026-10-26 10:30:00', resultado: CON_ERRORES, conErrores: 1 });
      assert.deepEqual((await corrida.estadoDeLosRecordatorios({ ahora: LUNES_10_45 })).alertas, [{
        tipo: 'eventos-con-errores', nivel: 'error',
        mensaje: `La última corrida de los recordatorios de la agenda (hoy a las 10:30) terminó con errores: ${CON_ERRORES}`
      }]);

      await query('DELETE FROM mi_espacio_eventos_corridas');
      await anotarCorrida({ inicio: '2026-10-26 10:30:00', fin: null, resultado: null });
      const interrumpida = await corrida.estadoDeLosRecordatorios({ ahora: LUNES_10_45 });
      assert.equal(interrumpida.texto, 'Recordatorios de la agenda: última corrida hoy a las 10:30.');
      assert.deepEqual(interrumpida.alertas, [{
        tipo: 'eventos-interrumpida', nivel: 'error',
        mensaje: 'La corrida de los recordatorios de la agenda que empezó hoy a las 10:30 no terminó.'
      }]);

      // Otra corrida (otra conexión) tiene el candado: está en curso
      const otra = await pool.getConnection();
      try {
        const [[{ tomado }]] = await otra.query('SELECT GET_LOCK(?, 0) AS tomado', [BLOQUEO_EVENTOS]);
        assert.equal(Number(tomado), 1);
        const enCurso = await corrida.estadoDeLosRecordatorios({ ahora: LUNES_10_45 });
        assert.equal(enCurso.texto, 'Recordatorios de la agenda: corrida en curso, desde hoy a las 10:30.');
        assert.equal(enCurso.corrida.en_curso, true);
        assert.deepEqual(enCurso.alertas, []);
      } finally {
        await otra.query('SELECT RELEASE_LOCK(?)', [BLOQUEO_EVENTOS]);
        otra.release();
      }
    });
  });

  describe('GET /notificaciones/notas-digitales/estado', () => {
    // La API usa el momento real: sin corrida, la alerta va solo si hoy es hábil (la tabla de feriados está vacía)
    it('trae data.eventos con la línea y la corrida, y los campos de siempre; sin corrida, la alerta va al final si hoy es hábil', async () => {
      const data = await pedirEstado();
      assert.deepEqual(data.eventos, { texto: SIN_REGISTRO, corrida: null });
      const deEventos = data.alertas.filter(esDeEventos);
      assert.deepEqual(deEventos, esDiaHabil(hoyArgentina()) ? [NINGUNA] : []);
      if (deEventos.length > 0) assert.deepEqual(data.alertas.at(-1), NINGUNA);
    });

    it('las alertas de la agenda van al final, después de las de las Notas Digitales', async () => {
      // Una corrida de recién, que terminó con errores: la alerta de los errores sale cualquier día
      const ahora = ahoraArgentina();
      const hora = ahora.slice(11, 16);
      await anotarCorrida({ inicio: ahora, fin: ahora, resultado: CON_ERRORES, conErrores: 1 });
      const data = await pedirEstado();
      // «hoy», salvo que el pedido cruce la medianoche
      assert.match(data.eventos.texto, new RegExp(
        `^Recordatorios de la agenda: última corrida (hoy|ayer) a las ${hora}\\. ${escaparRegex(CON_ERRORES)}$`));
      assert.deepEqual(data.eventos.corrida, {
        inicio: ahora.slice(0, 16), fin: ahora.slice(0, 16), resultado: CON_ERRORES, con_errores: true, en_curso: false
      });
      const ultima = data.alertas.at(-1);
      assert.equal(ultima.tipo, 'eventos-con-errores');
      assert.equal(ultima.nivel, 'error');
      assert.match(ultima.mensaje, new RegExp(
        `^La última corrida de los recordatorios de la agenda \\((hoy|ayer) a las ${hora}\\) terminó con errores: ${escaparRegex(CON_ERRORES)}$`));
      // Hay alertas de las Notas Digitales (la base de prueba no tiene firma ni membrete) y todas van antes
      const primeraDeEventos = data.alertas.findIndex(esDeEventos);
      assert.ok(primeraDeEventos > 0, JSON.stringify(data.alertas));
      assert.ok(data.alertas.slice(primeraDeEventos).every(esDeEventos), JSON.stringify(data.alertas));
    });

    it('si no se puede leer la corrida, data.eventos es null, la advertencia va al final y lo demás responde igual', async () => {
      await query('ALTER TABLE mi_espacio_eventos_corridas RENAME TO mi_espacio_eventos_corridas_oculta');
      try {
        const data = await pedirEstado();
        assert.equal(data.eventos, null);
        assert.deepEqual(data.alertas.at(-1), SIN_ESTADO);
        assert.deepEqual(data.alertas.filter(esDeEventos), [SIN_ESTADO]);
      } finally {
        await query('ALTER TABLE mi_espacio_eventos_corridas_oculta RENAME TO mi_espacio_eventos_corridas');
      }
    });
  });
});
