// Las consultas del aviso diario de la agenda (spec 2026-11-04-agenda-aviso-y-dependencia, 5 y 6; services/miEspacioEventosDiarioDatos.js), contra
// una base de prueba propia, con personas «Test <clave>». Lo que dicen las reglas con esto, en mi-espacio-eventos-diario-reglas.test.js.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query } from './helpers.js';
import { asegurarBaseDePrueba } from './notas-fixtures.js';

const TABLAS = ['mi_espacio_evento_informados', 'mi_espacio_evento_personas', 'mi_espacio_evento_vistas', 'mi_espacio_eventos', 'mi_espacio_licencias',
  'usuarios_licencias', 'cambios_pendientes', 'usuarios'];
let base, dbReal, datos, pool;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_mi_espacio_eventos_diario_datos');
  process.env.DB_NAME = base.nombre;
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba
  datos = await import('../services/miEspacioEventosDiarioDatos.js');
  pool = (await import('../config/database.js')).default;
});

after(async () => {
  await pool?.end();
  await cerrarDb();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  await asegurarBaseDePrueba();
  await query('UPDATE usuarios SET depende_de = NULL');
  for (const tabla of TABLAS) await query(`DELETE FROM ${tabla}`);
});

const persona = async ({ clave, activo = 1, dependeDe = null, porMail = 1 }) => {
  const username = `t_dd_${crypto.randomBytes(3).toString('hex')}`;
  const { insertId } = await query(
    `INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo, depende_de, eventos_por_mail) VALUES (?, 'x', ?, ?, 'lector', ?, ?, ?)`,
    [username, `Test ${clave}`, `${username}@rpad.test`, activo, dependeDe, porMail]
  );
  return insertId;
};
const evento = async ({ creador, fecha = '2026-11-06', desde = '09:30:00', hasta = null, activo = 1, publico = 0, publicado = null }) => {
  const { insertId } = await query(
    `INSERT INTO mi_espacio_eventos (creado_por, titulo, detalle, fecha, desde, hasta, publico, texto_publico, publicado_at, recordatorio, activo)
     VALUES (?, 'Título', 'Detalle', ?, ?, ?, ?, ?, ?, 'ninguno', ?)`,
    [creador, fecha, desde, hasta, publico, publico ? 'Fuera de la oficina' : null, publicado, activo]
  );
  return insertId;
};

describe('usuariosDelAviso', () => {
  it('todos, también los desactivados, por id y con booleanos', async () => {
    const jefa = await persona({ clave: 'jefa', activo: 0 });
    const quien = await persona({ clave: 'quien', dependeDe: jefa, porMail: 0 });
    assert.deepEqual((await datos.usuariosDelAviso()).map(({ id, activo, depende_de: dependeDe, eventos_por_mail: porMail }) => [id, activo, dependeDe, porMail]),
      [[jefa, false, null, true], [quien, true, jefa, false]]);
  });
});

describe('deLicenciaOficial', () => {
  const licencia = (id, desde, hasta, anulada = 0) => query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta, anulada) VALUES (?, ?, ?, ?)', [id, desde, hasta, anulada]);

  it('con los dos bordes incluidos', async () => {
    const quien = await persona({ clave: 'quien' });
    await licencia(quien, '2026-11-05', '2026-11-06');
    for (const dia of ['2026-11-05', '2026-11-06']) assert.deepEqual([...await datos.deLicenciaOficial(dia)], [quien], dia);
    for (const dia of ['2026-11-04', '2026-11-07']) assert.deepEqual([...await datos.deLicenciaOficial(dia)], [], dia);
  });

  it('una anulada no cuenta', async () => {
    await licencia(await persona({ clave: 'quien' }), '2026-11-05', '2026-11-06', 1);
    assert.deepEqual([...await datos.deLicenciaOficial('2026-11-05')], []);
  });

  it('lo cargado solo en Mi espacio no cuenta', async () => {
    await query("INSERT INTO mi_espacio_licencias (usuario_id, tipo, desde, hasta, activo) VALUES (?, 'vacaciones', '2026-11-05', '2026-11-06', 1)", [await persona({ clave: 'quien' })]);
    assert.deepEqual([...await datos.deLicenciaOficial('2026-11-05')], []);
  });
});

describe('eventosDelAviso', () => {
  it('los activos del rango, con los dos bordes, por fecha y hora', async () => {
    const creador = await persona({ clave: 'creador' });
    const antes = await evento({ creador, fecha: '2026-11-05' });
    const tarde = await evento({ creador, fecha: '2026-11-07', desde: '16:00:00' });
    const temprano = await evento({ creador, fecha: '2026-11-07', desde: '08:00:00' });
    await evento({ creador, fecha: '2026-11-08' });
    await evento({ creador, fecha: '2026-11-06', activo: 0 });
    assert.deepEqual((await datos.eventosDelAviso('2026-11-05', '2026-11-07')).map((e) => e.id), [antes, temprano, tarde]);
  });

  it('las fechas y las horas, como texto: un Date crudo no coincidiría nunca con lo informado', async () => {
    const creador = await persona({ clave: 'creador' });
    await evento({ creador, hasta: '10:15:00', publico: 1, publicado: '2026-11-05 14:02:03' });
    const [item] = await datos.eventosDelAviso('2026-11-06', '2026-11-06');
    assert.equal(item.fecha, '2026-11-06');
    assert.equal(item.desde, '09:30');
    assert.equal(item.hasta, '10:15');
    assert.equal(item.publicado_at, '2026-11-05 14:02:03');
    assert.equal(item.publico, true);
    assert.equal(item.compartido, false);
  });

  it('sin hora de fin ni publicación, null; con sus personas y sus vistas, en lote', async () => {
    const creador = await persona({ clave: 'creador' });
    const otra = await persona({ clave: 'otra' });
    const sinNada = await evento({ creador });
    const conTodo = await evento({ creador, desde: '11:00:00' });
    await query('INSERT INTO mi_espacio_evento_personas (evento_id, usuario_id) VALUES (?, ?)', [conTodo, otra]);
    await query('INSERT INTO mi_espacio_evento_vistas (evento_id, usuario_id) VALUES (?, ?)', [conTodo, otra]);
    const [uno, dos] = await datos.eventosDelAviso('2026-11-06', '2026-11-06');
    assert.equal(uno.id, sinNada);
    assert.equal(uno.hasta, null);
    assert.equal(uno.publicado_at, null);
    assert.deepEqual([uno.personas, uno.vistas], [[], []]);
    assert.deepEqual([dos.personas.map((p) => p.id), dos.vistas.map((v) => v.id)], [[otra], [otra]]);
  });

  it('el creador desactivado queda dicho, y un evento sin creador no se rompe', async () => {
    const inactiva = await persona({ clave: 'inactiva', activo: 0 });
    await evento({ creador: inactiva });
    await evento({ creador: null, desde: '11:00:00' });
    const [conCreador, sinCreador] = await datos.eventosDelAviso('2026-11-06', '2026-11-06');
    assert.deepEqual([conCreador.creado_por, conCreador.creador, conCreador.creador_activo], [inactiva, 'Test inactiva', false]);
    assert.deepEqual([sinCreador.creado_por, sinCreador.creador, sinCreador.creador_activo], [null, null, false]);
  });

  it('sin un rango que sirva, nada', async () => {
    await evento({ creador: await persona({ clave: 'creador' }) });
    assert.deepEqual(await datos.eventosDelAviso('2026-11-07', '2026-11-06'), []);
    assert.deepEqual(await datos.eventosDelAviso('no es', '2026-11-06'), []);
    assert.deepEqual(await datos.eventosDelAviso('2026-11-06', null), []);
  });
});

describe('lo informado', () => {
  it('se anota y se lee con la fecha como texto; lo que ya estaba, se saltea', async () => {
    const quien = await persona({ clave: 'quien' });
    const creador = await persona({ clave: 'creador' });
    const id = await evento({ creador, publico: 1 });
    const informa = [{ evento_id: id, fecha: '2026-11-06' }];
    await datos.marcarInformados(quien, informa, '2026-11-05 14:00:00');
    await datos.marcarInformados(quien, informa, '2026-11-05 15:00:00');
    const leido = await datos.informadosDe([id]);
    assert.deepEqual([...leido], [`${id}|${quien}|2026-11-06`]);
    const filas = await query('SELECT COUNT(*) AS cuantas FROM mi_espacio_evento_informados');
    assert.equal(Number(filas[0].cuantas), 1);
  });

  it('por fecha: el mismo evento en otra fecha es otra fila', async () => {
    const quien = await persona({ clave: 'quien' });
    const id = await evento({ creador: quien, publico: 1 });
    await datos.marcarInformados(quien, [{ evento_id: id, fecha: '2026-11-06' }, { evento_id: id, fecha: '2026-11-10' }], '2026-11-05 14:00:00');
    assert.equal((await datos.informadosDe([id])).size, 2);
  });

  it('sin nada, no consulta: una lista vacía rompería el IN', async () => {
    assert.deepEqual([...await datos.informadosDe([])], []);
    assert.deepEqual([...await datos.informadosDe(null)], []);
    await datos.marcarInformados(1, [], '2026-11-05 14:00:00');
    await datos.marcarInformados(1, null, '2026-11-05 14:00:00');
  });
});
