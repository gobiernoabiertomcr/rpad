// Las consultas del Seguimiento del dataset (services/seguimientoDatos.js, solo lectura): de la base a `Fuentes`, la misma
// forma de CASOS[id] de tests/seguimiento-casos.js más `catalogos`. Contra una base de prueba propia, con nombres ficticios.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query } from './helpers.js';
import { crearArea, crearDataset, crearNota, crearEmailViejo, limpiarBase, asegurarBaseDePrueba } from './notas-fixtures.js';
import { CASOS } from './seguimiento-casos.js';

const MOMENTO = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
let base, dbReal, fuentesDe;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_seguimiento_datos');
  process.env.DB_NAME = base.nombre;
  ({ fuentesDe } = await import('../services/seguimientoDatos.js'));
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  await limpiarBase();
  await query('DELETE FROM cambios_pendientes');
  // Las notas DGMIT no se van con sus datasets (solo sus filas de notas_dgmit_datasets): se borran aparte, con su historial
  await query('DELETE FROM notas_dgmit');
  await query('DELETE FROM usuarios');
});

// Instante de una fecha y hora de Argentina (UTC-3), en segundos: las columnas TIMESTAMP se cargan con FROM_UNIXTIME,
// que no depende de la zona horaria de la base (en Docker es UTC)
const instante = (texto) => Date.parse(`${texto.replace(' ', 'T')}-03:00`) / 1000;

const crearUsuario = async (nombre) => {
  const username = `t_${crypto.randomBytes(4).toString('hex')}`;
  const r = await query(
    "INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES (?, 'x', ?, ?, 'admin', 1)",
    [username, nombre, `${username}@rpad.test`]
  );
  return r.insertId;
};

const fijarAlta = (datasetId, momento) => query('UPDATE datasets SET created_at = FROM_UNIXTIME(?) WHERE id = ?', [instante(momento), datasetId]);

// datasetId null: un 'crear' aprobado que quedó sin dataset. Los JSON van como texto, como los guarda la aplicación.
const insertarCambio = async ({
  tipo = 'editar', datasetId = null, estado = 'pendiente', creado = '2026-09-01 10:00:00', revisado = null,
  propuso, reviso = null, motivo = null, nuevos = { titulo: 'Nuevo' }, anteriores = null
}) => (await query(
  `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, datos_anteriores, usuario_id, estado, revisor_id,
     comentario_rechazo, created_at, revisado_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), ${revisado ? 'FROM_UNIXTIME(?)' : '?'})`,
  [tipo, datasetId, JSON.stringify(nuevos), anteriores && JSON.stringify(anteriores), propuso, estado, reviso, motivo,
    instante(creado), revisado ? instante(revisado) : null]
)).insertId;

const insertarEmail = async ({ tipo = 'area-aviso-40', areaId = null, destinatarios = 'mit@rpad.test', ids, cantidad, enviado, success = 1, error = null }) => (await query(
  `INSERT INTO notificaciones_log (tipo, area_id, destinatarios, datasets_ids, cantidad_datasets, enviado_at, success, error_message)
   VALUES (?, ?, ?, ?, ?, FROM_UNIXTIME(?), ?, ?)`,
  [tipo, areaId, destinatarios, ids, cantidad ?? 1, instante(enviado), success, error]
)).insertId;

// Una nota DGMIT como la guarda la API (controllers/notasDgmitController.js): la cabecera y sus datasets. cargada: el momento
// de la carga (created_at), en hora argentina
const insertarNotaDgmit = async ({
  numero, tipo = 'solicitud', recibida, anulada = 0, creadoPor = null, cargada = '2026-10-22 10:00:00', datasets = []
}) => {
  const id = (await query(
    'INSERT INTO notas_dgmit (numero, tipo, recibida, anulada, creado_por, created_at) VALUES (?, ?, ?, ?, ?, FROM_UNIXTIME(?))',
    [numero, tipo, recibida, anulada, creadoPor, instante(cargada)]
  )).insertId;
  if (datasets.length > 0) await query('INSERT INTO notas_dgmit_datasets (nota_id, dataset_id) VALUES ?', [datasets.map((d) => [id, d])]);
  return id;
};

// Una corrección o la anulación de una nota DGMIT, como las guarda la API: anteriores (JSON) solo en una corrección
const insertarHistorialDgmit = ({ notaId, accion = 'correccion', motivo, usuarioId = null, momento, anteriores = null }) => query(
  'INSERT INTO notas_dgmit_historial (nota_id, accion, motivo, anteriores, usuario_id, created_at) VALUES (?, ?, ?, ?, ?, FROM_UNIXTIME(?))',
  [notaId, accion, motivo, anteriores && JSON.stringify(anteriores), usuarioId, instante(momento)]
);

describe('fuentesDe: los datasets', () => {
  it('trae la ficha con la forma de Fuentes: fechas como texto, activo booleano, meses y alta en hora argentina', async () => {
    const areaId = await crearArea({ nombre: 'Área del seguimiento', area_superior: 'Secretaría de prueba' });
    const id = await crearDataset({
      titulo: 'Dataset visto', gestion: 'externa', areaId, frecuencia: 'Trimestralmente', vencimiento: '2026-12-31',
      ultima: '2026-09-15', datosAl: '2026-09-30', tipoPedido: 'acumulado', url: 'https://datos.comodoro.gov.ar/dataset/visto',
      requiereNota: 1
    });
    await fijarAlta(id, '2026-03-04 21:30:15');
    const fuentes = (await fuentesDe([id])).get(id);
    assert.deepEqual(fuentes.dataset, {
      id, titulo: 'Dataset visto', area: 'Área del seguimiento', area_superior: 'Secretaría de prueba', area_id: areaId,
      tipo_gestion: 'externa', requiere_nota: 1, frecuencia: 'Trimestralmente', meses: 3, proxima: '2026-12-31', datos_al: '2026-09-30',
      ultima: '2026-09-15', tipo_pedido: 'acumulado', url_dataset: 'https://datos.comodoro.gov.ar/dataset/visto',
      activo: true, alta: '2026-03-04 21:30:15'
    });
  });

  // «Requiere nota DGMIT» (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.7): 1 es Sí, 0 es No (un valor, no un vacío) y
  // NULL es sin dato
  it('fuentesDe trae requiere_nota', async () => {
    const si = await crearDataset({ gestion: 'externa', vencimiento: '2026-12-31', requiereNota: 1 });
    const no = await crearDataset({ gestion: 'externa', vencimiento: '2026-12-31', requiereNota: 0 });
    const sinDato = await crearDataset({ gestion: 'externa', vencimiento: '2026-12-31' });
    const interna = await crearDataset({ gestion: 'interna', vencimiento: '2026-12-31' });
    const mapa = await fuentesDe([si, no, sinDato, interna]);
    assert.strictEqual(mapa.get(si).dataset.requiere_nota, 1);
    assert.strictEqual(mapa.get(no).dataset.requiere_nota, 0);
    assert.strictEqual(mapa.get(sinDato).dataset.requiere_nota, null);
    assert.strictEqual(mapa.get(interna).dataset.requiere_nota, null);
  });

  it('las fechas vacías vuelven como null y la frecuencia sin meses (Eventual), con meses null', async () => {
    const id = await crearDataset({ frecuencia: 'Eventual' });
    const { dataset } = (await fuentesDe([id])).get(id);
    assert.equal(dataset.meses, null);
    assert.equal(dataset.proxima, null);
    assert.equal(dataset.ultima, null);
    assert.equal(dataset.datos_al, null);
    assert.equal(dataset.tipo_pedido, null);
  });

  it('un dataset inactivo también aparece (activo false)', async () => {
    const activo = await crearDataset({ vencimiento: '2026-12-31' });
    const inactivo = await crearDataset({ vencimiento: '2026-12-31', activo: 0 });
    const mapa = await fuentesDe([activo, inactivo]);
    assert.equal(mapa.get(activo).dataset.activo, true);
    assert.equal(mapa.get(inactivo).dataset.activo, false);
  });

  it('fuentesDe(null) trae todos los datasets, activos e inactivos, y cada uno con las siete listas vacías', async () => {
    const a = await crearDataset({ vencimiento: '2026-12-31' });
    const b = await crearDataset({ vencimiento: '2026-12-31', activo: 0 });
    const c = await crearDataset({ vencimiento: '2026-12-31' });
    const mapa = await fuentesDe(null);
    assert.ok(mapa instanceof Map);
    assert.deepEqual([...mapa.keys()], [a, b, c]);
    for (const f of mapa.values()) {
      for (const lista of ['altasSinDataset', 'cambios', 'historial', 'emails', 'notas', 'auditorias', 'notasDgmit']) assert.deepEqual(f[lista], [], lista);
    }
  });

  it('fuentesDe() sin argumentos equivale a null; con ids, trae solo esos; un id que no existe no figura; una lista vacía, un mapa vacío', async () => {
    const a = await crearDataset({ vencimiento: '2026-12-31' });
    const b = await crearDataset({ vencimiento: '2026-12-31' });
    assert.deepEqual([...(await fuentesDe()).keys()], [a, b]);
    assert.deepEqual([...(await fuentesDe([b, 999999])).keys()], [b]);
    const vacio = await fuentesDe([]);
    assert.ok(vacio instanceof Map);
    assert.equal(vacio.size, 0);
  });

  it('catalogos lleva areas, frecuencias, temas y formatos (id → nombre) y es el mismo objeto para todos los datasets', async () => {
    const areaId = await crearArea({ nombre: 'Área de catálogo' });
    const a = await crearDataset({ areaId, vencimiento: '2026-12-31' });
    const b = await crearDataset({ areaId, vencimiento: '2026-12-31' });
    const mapa = await fuentesDe([a, b]);
    const { catalogos } = mapa.get(a);
    assert.deepEqual(Object.keys(catalogos), ['areas', 'frecuencias', 'temas', 'formatos']);
    assert.equal(catalogos.areas[areaId], 'Área de catálogo');
    assert.equal(catalogos.frecuencias[1], 'Mensualmente');
    assert.equal(catalogos.temas[1], 'Economía y Finanzas');
    assert.equal(catalogos.formatos[1], 'CSV');
    assert.equal(mapa.get(b).catalogos, catalogos);
  });
});

describe('fuentesDe: los cambios', () => {
  it('trae los del dataset, con los JSON ya como objetos, los nombres de quien propuso y revisó y los momentos en hora argentina', async () => {
    const propuso = await crearUsuario('Ana Prueba Uno');
    const reviso = await crearUsuario('Bruno Prueba Dos');
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    const otro = await crearDataset({ vencimiento: '2026-12-31' });
    const cambio = await insertarCambio({
      tipo: 'editar', datasetId: id, estado: 'aprobado', creado: '2026-09-01 23:50:10', revisado: '2026-09-02 00:10:20',
      propuso, reviso, nuevos: { ultima_actualizacion: '2026-09-01', registro_actualizacion: true, notas: null },
      anteriores: { ultima_actualizacion: '2026-03-01' }
    });
    await insertarCambio({ tipo: 'editar', datasetId: otro, propuso });
    const { cambios } = (await fuentesDe([id])).get(id);
    assert.deepEqual(cambios, [{
      id: cambio, tipo: 'editar', estado: 'aprobado', creado: '2026-09-01 23:50:10', revisado: '2026-09-02 00:10:20',
      propuso: 'Ana Prueba Uno', reviso: 'Bruno Prueba Dos', motivo: null,
      nuevos: { ultima_actualizacion: '2026-09-01', registro_actualizacion: true, notas: null },
      anteriores: { ultima_actualizacion: '2026-03-01' }, dataset_id: id
    }]);
    assert.equal(typeof cambios[0].nuevos, 'object');
    assert.equal(typeof cambios[0].anteriores, 'object');
  });

  it('un cambio pendiente: sin revisión (null), sin datos anteriores (null) y el motivo de un rechazo', async () => {
    const propuso = await crearUsuario('Ana Prueba Uno');
    const reviso = await crearUsuario('Bruno Prueba Dos');
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    const pendiente = await insertarCambio({ datasetId: id, propuso, creado: '2026-09-01 10:00:00' });
    const rechazado = await insertarCambio({
      datasetId: id, propuso, reviso, estado: 'rechazado', creado: '2026-09-02 10:00:00', revisado: '2026-09-02 11:00:00', motivo: 'Falta el período'
    });
    const [a, b] = (await fuentesDe([id])).get(id).cambios;
    assert.deepEqual([a.id, a.estado, a.revisado, a.reviso, a.anteriores, a.motivo], [pendiente, 'pendiente', null, null, null, null]);
    assert.deepEqual([b.id, b.estado, b.revisado, b.reviso, b.motivo], [rechazado, 'rechazado', '2026-09-02 11:00:00', 'Bruno Prueba Dos', 'Falta el período']);
  });

  it('van ordenados por fecha de creación y después por id', async () => {
    const propuso = await crearUsuario('Ana Prueba Uno');
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    const tarde = await insertarCambio({ datasetId: id, propuso, creado: '2026-09-05 10:00:00' });
    const temprano = await insertarCambio({ datasetId: id, propuso, creado: '2026-09-01 10:00:00' });
    const igual = await insertarCambio({ datasetId: id, propuso, creado: '2026-09-01 10:00:00' });
    assert.deepEqual((await fuentesDe([id])).get(id).cambios.map(c => c.id), [temprano, igual, tarde]);
  });

  it('si quien revisó ya no existe (se borró el usuario), reviso es null y propuso se conserva', async () => {
    const propuso = await crearUsuario('Ana Prueba Uno');
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    const reviso = await crearUsuario('Bruno Prueba Dos');
    await insertarCambio({ datasetId: id, propuso, reviso, estado: 'aprobado', creado: '2026-09-01 10:00:00', revisado: '2026-09-01 11:00:00' });
    await query('DELETE FROM usuarios WHERE id = ?', [reviso]);
    const [cambio] = (await fuentesDe([id])).get(id).cambios;
    assert.equal(cambio.reviso, null);
    assert.equal(cambio.propuso, 'Ana Prueba Uno');
  });
});

describe('fuentesDe: las altas sin dataset', () => {
  it('un crear aprobado con la aprobación a 3 s del alta del dataset entra, con dataset_id null; el de 60 s no', async () => {
    const propuso = await crearUsuario('Ana Prueba Uno');
    const reviso = await crearUsuario('Bruno Prueba Dos');
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    await fijarAlta(id, '2026-01-26 12:00:30');
    const cerca = await insertarCambio({
      tipo: 'crear', estado: 'aprobado', creado: '2026-01-26 11:00:00', revisado: '2026-01-26 12:00:27', propuso, reviso, nuevos: { titulo: 'Alta cercana' }
    });
    await insertarCambio({
      tipo: 'crear', estado: 'aprobado', creado: '2026-01-26 11:00:00', revisado: '2026-01-26 12:01:30', propuso, reviso, nuevos: { titulo: 'Alta lejana' }
    });
    const { altasSinDataset, cambios } = (await fuentesDe([id])).get(id);
    assert.deepEqual(altasSinDataset, [{
      id: cerca, tipo: 'crear', estado: 'aprobado', creado: '2026-01-26 11:00:00', revisado: '2026-01-26 12:00:27',
      propuso: 'Ana Prueba Uno', reviso: 'Bruno Prueba Dos', motivo: null, nuevos: { titulo: 'Alta cercana' }, anteriores: null, dataset_id: null
    }]);
    assert.deepEqual(cambios, []);
  });

  it('el borde: a 5 s entra y a 6 s no, antes o después del alta (en orden de creación)', async () => {
    const propuso = await crearUsuario('Ana Prueba Uno');
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    await fijarAlta(id, '2026-01-26 12:00:30');
    const mas5 = await insertarCambio({ tipo: 'crear', estado: 'aprobado', revisado: '2026-01-26 12:00:35', propuso });
    const menos5 = await insertarCambio({ tipo: 'crear', estado: 'aprobado', revisado: '2026-01-26 12:00:25', propuso });
    await insertarCambio({ tipo: 'crear', estado: 'aprobado', revisado: '2026-01-26 12:00:36', propuso });
    await insertarCambio({ tipo: 'crear', estado: 'aprobado', revisado: '2026-01-26 12:00:24', propuso });
    assert.deepEqual((await fuentesDe([id])).get(id).altasSinDataset.map(c => c.id), [mas5, menos5]);
  });

  it('solo cuentan los crear aprobados sin dataset: ni los pendientes, ni los rechazados, ni los que ya tienen dataset_id', async () => {
    const propuso = await crearUsuario('Ana Prueba Uno');
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    await fijarAlta(id, '2026-01-26 12:00:30');
    await insertarCambio({ tipo: 'crear', estado: 'pendiente', propuso });
    await insertarCambio({ tipo: 'crear', estado: 'rechazado', revisado: '2026-01-26 12:00:30', propuso });
    await insertarCambio({ tipo: 'editar', estado: 'aprobado', revisado: '2026-01-26 12:00:30', propuso });
    const conDataset = await insertarCambio({ tipo: 'crear', datasetId: id, estado: 'aprobado', revisado: '2026-01-26 12:00:30', propuso });
    const { altasSinDataset, cambios } = (await fuentesDe([id])).get(id);
    assert.deepEqual(altasSinDataset, []);
    assert.deepEqual(cambios.map(c => c.id), [conDataset]);
  });
});

describe('fuentesDe: el historial', () => {
  it('trae las cargas del dataset con la fecha como texto, el momento de registro en hora argentina, el usuario y el cambio', async () => {
    const usuario = await crearUsuario('Ana Prueba Uno');
    const propuso = await crearUsuario('Bruno Prueba Dos');
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    const otro = await crearDataset({ vencimiento: '2026-12-31' });
    const cambio = await insertarCambio({ datasetId: id, propuso, estado: 'aprobado', revisado: '2026-09-02 10:00:00' });
    await query(
      'INSERT INTO historial_actualizaciones (dataset_id, fecha_actualizacion, usuario_id, created_at, cambio_id) VALUES (?, ?, ?, FROM_UNIXTIME(?), ?)',
      [id, '2026-09-01', usuario, instante('2026-09-02 23:59:59'), cambio]
    );
    await query('INSERT INTO historial_actualizaciones (dataset_id, fecha_actualizacion, usuario_id, created_at) VALUES (?, ?, NULL, FROM_UNIXTIME(?))',
      [id, '2026-03-01', instante('2026-03-02 09:00:00')]);
    await query('INSERT INTO historial_actualizaciones (dataset_id, fecha_actualizacion, usuario_id, created_at) VALUES (?, ?, ?, FROM_UNIXTIME(?))',
      [otro, '2026-04-01', usuario, instante('2026-04-02 09:00:00')]);
    const { historial } = (await fuentesDe([id])).get(id);
    assert.deepEqual(historial, [
      { fecha: '2026-03-01', creado: '2026-03-02 09:00:00', usuario: null, cambio_id: null },
      { fecha: '2026-09-01', creado: '2026-09-02 23:59:59', usuario: 'Ana Prueba Uno', cambio_id: cambio }
    ]);
  });
});

describe('fuentesDe: los emails', () => {
  it('un email insertado a las 08:00:04 (hora argentina) vuelve con ese mismo momento, con la forma de Fuentes', async () => {
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    const email = await insertarEmail({
      tipo: 'externo-40', ids: String(id), cantidad: 1, enviado: '2026-06-21 08:00:04', destinatarios: 'a@rpad.test,b@rpad.test', success: 0, error: 'Casilla llena'
    });
    const { emails } = (await fuentesDe([id])).get(id);
    assert.deepEqual(emails, [{
      id: email, tipo: 'externo-40', enviado: '2026-06-21 08:00:04', success: false, cantidad: 1, area: null, area_articulo: null,
      destinatarios: 'a@rpad.test,b@rpad.test', error: 'Casilla llena'
    }]);
    assert.equal(emails[0].enviado, '2026-06-21 08:00:04');
  });

  it('un email de las 23:30 argentinas sigue en su día (la base está en UTC y el día UTC ya cambió)', async () => {
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    await insertarEmail({ ids: String(id), enviado: '2026-06-21 23:30:00' });
    assert.equal((await fuentesDe([id])).get(id).emails[0].enviado, '2026-06-21 23:30:00');
  });

  it('un area-aviso-40 trae el nombre y el artículo del área del email, aunque después se cambie el área del dataset', async () => {
    const areaDelEnvio = await crearArea({ nombre: 'Dirección del envío' });
    await query("UPDATE areas SET articulo = 'el' WHERE id = ?", [areaDelEnvio]);
    const areaNueva = await crearArea({ nombre: 'Dirección nueva' });
    const id = await crearDataset({ areaId: areaDelEnvio, vencimiento: '2026-12-31' });
    await insertarEmail({ tipo: 'area-aviso-40', areaId: areaDelEnvio, ids: String(id), enviado: '2026-09-21 08:00:05' });
    await query('UPDATE datasets SET area_id = ? WHERE id = ?', [areaNueva, id]);
    const fuentes = (await fuentesDe([id])).get(id);
    assert.equal(fuentes.dataset.area, 'Dirección nueva');
    assert.equal(fuentes.emails[0].area, 'Dirección del envío');
    assert.equal(fuentes.emails[0].area_articulo, 'el');
  });

  it('un area-aviso-40 de un área con artículo "la" trae "la"', async () => {
    const areaId = await crearArea({ nombre: 'Secretaría del envío' });
    const id = await crearDataset({ areaId, vencimiento: '2026-12-31' });
    await insertarEmail({ areaId, ids: String(id), enviado: '2026-09-21 08:00:05' });
    assert.equal((await fuentesDe([id])).get(id).emails[0].area_articulo, 'la');
  });

  it('datasets_ids con espacios (" 5, 7") se reparte en cada uno de los datasets nombrados', async () => {
    const a = await crearDataset({ vencimiento: '2026-12-31' });
    const b = await crearDataset({ vencimiento: '2026-12-31' });
    const c = await crearDataset({ vencimiento: '2026-12-31' });
    await insertarEmail({ tipo: 'externo-60', ids: ` ${a}, ${b}`, cantidad: 2, enviado: '2026-06-21 08:00:04' });
    const mapa = await fuentesDe([a, b, c]);
    assert.equal(mapa.get(a).emails.length, 1);
    assert.equal(mapa.get(b).emails.length, 1);
    assert.equal(mapa.get(a).emails[0].id, mapa.get(b).emails[0].id);
    assert.equal(mapa.get(a).emails[0].cantidad, 2);
    assert.deepEqual(mapa.get(c).emails, []);
  });

  it('un id que es parte de otro (7 y 77) no se confunde: se compara el id entero', async () => {
    await query('ALTER TABLE datasets AUTO_INCREMENT = 7');
    const a = await crearDataset({ vencimiento: '2026-12-31' });
    await query('ALTER TABLE datasets AUTO_INCREMENT = 77');
    const b = await crearDataset({ vencimiento: '2026-12-31' });
    assert.deepEqual([a, b], [7, 77]);
    await insertarEmail({ ids: `${b}`, enviado: '2026-06-21 08:00:04' });
    const mapa = await fuentesDe([a, b]);
    assert.deepEqual(mapa.get(a).emails, []);
    assert.equal(mapa.get(b).emails.length, 1);
  });

  it('el mismo dataset repetido en un email figura una sola vez; ids vacíos o raros no rompen', async () => {
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    await insertarEmail({ ids: `${id},${id}`, enviado: '2026-06-21 08:00:04' });
    await insertarEmail({ ids: '', enviado: '2026-06-22 08:00:04' });
    await insertarEmail({ ids: `x,,${id}`, enviado: '2026-06-23 08:00:04' });
    assert.deepEqual((await fuentesDe([id])).get(id).emails.map(e => e.enviado), ['2026-06-21 08:00:04', '2026-06-23 08:00:04']);
  });

  it('van ordenados por momento de envío y después por id', async () => {
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    const tarde = await insertarEmail({ ids: String(id), enviado: '2026-08-01 08:00:00' });
    const temprano = await insertarEmail({ ids: String(id), enviado: '2026-07-01 08:00:00' });
    const igual = await insertarEmail({ ids: String(id), enviado: '2026-07-01 08:00:00' });
    assert.deepEqual((await fuentesDe([id])).get(id).emails.map(e => e.id), [temprano, igual, tarde]);
  });

  it('un email viejo (fixture crearEmailViejo, sin área) entra con area y area_articulo null', async () => {
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    await crearEmailViejo({ tipo: 'interno-30', datasetIds: [id], enviado: '2026-02-03 12:00:00' });
    const [email] = (await fuentesDe([id])).get(id).emails;
    assert.equal(email.tipo, 'interno-30');
    assert.equal(email.area, null);
    assert.equal(email.area_articulo, null);
    assert.match(email.enviado, MOMENTO);
  });
});

describe('fuentesDe: las notas', () => {
  it('trae el aviso con su sección, vencimiento y datos solicitados, quién la creó y la firmó y cuándo se envió', async () => {
    const creador = await crearUsuario('Ana Prueba Uno');
    const firmante = await crearUsuario('Bruno Prueba Dos');
    const id = await crearDataset({ gestion: 'externa', vencimiento: '2026-12-31' });
    const nota = await crearNota({ tipo: 'aviso', gestion: 'externa', fecha: '2026-10-13', numero: 2, anio: 2026, datasets: [{ id, seccion: 'vencido', vencimiento: '2026-01-31' }] });
    await query('UPDATE notas_digitales SET para = ?, cc = ?, creado_por = ?, firmante_id = ?, enviada_at = ? WHERE id = ?',
      ['para@rpad.test', 'cc@rpad.test', creador, firmante, '2026-10-13 14:50:30', nota]);
    await query('UPDATE notas_digitales_datasets SET datos_solicitados = ? WHERE nota_id = ?', ['Desde el 01/01/2026 hasta el 31/12/2026', nota]);
    const { notas } = (await fuentesDe([id])).get(id);
    assert.deepEqual(notas, [{
      id: nota, numero: 2, anio: 2026, tipo: 'aviso', gestion: 'externa', fecha: '2026-10-13', estado: 'enviada', enviada: '2026-10-13 14:50:30',
      para: 'para@rpad.test', cc: 'cc@rpad.test', seccion: 'vencido', vencimiento: '2026-01-31',
      datos_solicitados: 'Desde el 01/01/2026 hasta el 31/12/2026', creado_por: 'Ana Prueba Uno', firmante: 'Bruno Prueba Dos'
    }]);
  });

  it('una nota sin enviar, sin creador ni firmante ni datos solicitados trae null en esos campos', async () => {
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    await crearNota({ tipo: 'aviso', fecha: '2026-10-13', numero: 3, anio: 2026, estado: 'pendiente', datasets: [{ id, vencimiento: '2026-12-31' }] });
    const [nota] = (await fuentesDe([id])).get(id).notas;
    assert.deepEqual([nota.estado, nota.enviada, nota.cc, nota.creado_por, nota.firmante, nota.datos_solicitados], ['pendiente', null, null, null, null, null]);
  });

  it('una nota de prueba (es_prueba = 1) no aparece', async () => {
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    await crearNota({ tipo: 'aviso', fecha: '2026-10-13', esPrueba: 1, datasets: [{ id, vencimiento: '2026-12-31' }] });
    const real = await crearNota({ tipo: 'aviso', fecha: '2026-10-14', numero: 4, anio: 2026, datasets: [{ id, vencimiento: '2026-12-31' }] });
    assert.deepEqual((await fuentesDe([id])).get(id).notas.map(n => n.id), [real]);
  });

  it('solo avisos y reiteraciones: una nota de otro tipo que nombre al dataset no aparece', async () => {
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    const aviso = await crearNota({ tipo: 'aviso', fecha: '2026-10-01', numero: 1, anio: 2026, datasets: [{ id, vencimiento: '2026-12-31' }] });
    const reiteracion = await crearNota({ tipo: 'reiteracion', fecha: '2026-10-10', numero: 2, anio: 2026, datasets: [{ id, seccion: 'vencido', vencimiento: '2026-09-30' }] });
    await crearNota({ tipo: 'autorizacion', gestion: null, fecha: '2026-10-11', numero: 3, anio: 2026, datasets: [{ id, vencimiento: '2026-12-31' }] });
    await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-10-12', numero: 4, anio: 2026, datasets: [{ id, vencimiento: '2026-12-31' }] });
    const notas = (await fuentesDe([id])).get(id).notas;
    assert.deepEqual(notas.map(n => [n.id, n.tipo]), [[aviso, 'aviso'], [reiteracion, 'reiteracion']]);
  });

  it('van ordenadas por fecha y después por id, y cada dataset trae las suyas', async () => {
    const a = await crearDataset({ vencimiento: '2026-12-31' });
    const b = await crearDataset({ vencimiento: '2026-12-31' });
    const tarde = await crearNota({ fecha: '2026-10-20', numero: 3, anio: 2026, datasets: [{ id: a, vencimiento: '2026-12-31' }, { id: b, vencimiento: '2026-12-31' }] });
    const temprano = await crearNota({ fecha: '2026-10-01', numero: 1, anio: 2026, datasets: [{ id: a, vencimiento: '2026-12-31' }] });
    const mapa = await fuentesDe([a, b]);
    assert.deepEqual(mapa.get(a).notas.map(n => n.id), [temprano, tarde]);
    assert.deepEqual(mapa.get(b).notas.map(n => n.id), [tarde]);
  });
});

describe('fuentesDe: las auditorías', () => {
  it('trae las notas de auditoría de los cambios del dataset y de sus altas unidas, sin las de prueba ni las de otros', async () => {
    const propuso = await crearUsuario('Ana Prueba Uno');
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    const otro = await crearDataset({ vencimiento: '2026-12-31' });
    await fijarAlta(id, '2026-01-26 12:00:30');
    const alta = await insertarCambio({ tipo: 'crear', estado: 'aprobado', revisado: '2026-01-26 12:00:29', propuso });
    const altaLejana = await insertarCambio({ tipo: 'crear', estado: 'aprobado', revisado: '2026-02-26 12:00:29', propuso });
    const edicion = await insertarCambio({ datasetId: id, propuso });
    const edicionAjena = await insertarCambio({ datasetId: otro, propuso });
    const notaAltas = await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-01-30', numero: 1, anio: 2026 });
    const notaEdicion = await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-09-05', numero: 2, anio: 2026, estado: 'pendiente' });
    const notaPrueba = await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-09-06', esPrueba: 1 });
    for (const [nota, cambio, seccion] of [
      [notaAltas, alta, 'nuevo'], [notaAltas, altaLejana, 'nuevo'], [notaEdicion, edicion, 'nuevo'], [notaEdicion, edicionAjena, 'nuevo'],
      [notaPrueba, edicion, 'nuevo']
    ]) await query('INSERT INTO notas_digitales_cambios (nota_id, cambio_id, seccion) VALUES (?, ?, ?)', [nota, cambio, seccion]);
    const notaReiterada = await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-09-12', numero: 3, anio: 2026 });
    await query("INSERT INTO notas_digitales_cambios (nota_id, cambio_id, seccion) VALUES (?, ?, 'reiterado')", [notaReiterada, edicion]);
    const firmante = await crearUsuario('Bruno Prueba Dos');
    await query('UPDATE notas_digitales SET creado_por = ?, firmante_id = ? WHERE id = ?', [propuso, firmante, notaEdicion]);
    await query('UPDATE notas_digitales SET firmante_id = ? WHERE id = ?', [firmante, notaReiterada]);
    const { auditorias } = (await fuentesDe([id])).get(id);
    assert.deepEqual(auditorias, [
      { id: notaAltas, numero: 1, anio: 2026, fecha: '2026-01-30', estado: 'enviada', cambio_id: alta, seccion: 'nuevo', creado_por: null, firmante: null },
      { id: notaEdicion, numero: 2, anio: 2026, fecha: '2026-09-05', estado: 'pendiente', cambio_id: edicion, seccion: 'nuevo',
        creado_por: 'Ana Prueba Uno', firmante: 'Bruno Prueba Dos' },
      { id: notaReiterada, numero: 3, anio: 2026, fecha: '2026-09-12', estado: 'enviada', cambio_id: edicion, seccion: 'reiterado',
        creado_por: null, firmante: 'Bruno Prueba Dos' }
    ]);
  });

  it('las reglas dicen el estado y quién de cada auditoría tal como vienen de la base', async () => {
    const { movimientosDe } = await import('../services/seguimientoReglas.js');
    const propuso = await crearUsuario('Ana Prueba Uno');
    const firmante = await crearUsuario('Bruno Prueba Dos');
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    const edicion = await insertarCambio({ datasetId: id, propuso });
    const pendiente = await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-09-05', numero: 2, anio: 2026, estado: 'pendiente' });
    const fallida = await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-09-12', numero: 3, anio: 2026, estado: 'fallida' });
    await query('UPDATE notas_digitales SET creado_por = ?, firmante_id = ? WHERE id = ?', [propuso, firmante, pendiente]);
    await query('UPDATE notas_digitales SET firmante_id = ? WHERE id = ?', [firmante, fallida]);
    await query("INSERT INTO notas_digitales_cambios (nota_id, cambio_id, seccion) VALUES (?, ?, 'nuevo'), (?, ?, 'reiterado')", [pendiente, edicion, fallida, edicion]);
    const movimientos = movimientosDe((await fuentesDe([id])).get(id)).filter((m) => m.tipo === 'auditoria');
    assert.deepEqual(movimientos.map((m) => [m.titulo, m.detalle, m.quien]), [
      ['Nota Digital N° 3/26 de auditoría', `Pidió auditar el cambio #${edicion} (reiterado). No se pudo enviar.`, ['Envío automático', 'Firmó Bruno Dos']],
      ['Nota Digital N° 2/26 de auditoría', `Pidió auditar el cambio #${edicion}. Pendiente de envío.`, ['Generada por Ana Uno', 'Firmó Bruno Dos']]
    ]);
  });

  it('un dataset sin cambios ni altas no consulta ni trae auditorías', async () => {
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    assert.deepEqual((await fuentesDe([id])).get(id).auditorias, []);
  });
});

// Las notas DGMIT (spec 2026-10-24-notas-dgmit, 5): las notas que la DGMIT le mandó al área, cargadas a mano. Todas, también las
// anuladas, con todos los datasets de la nota, quién la cargó (nombre completo: las reglas lo acortan) y su historial
describe('fuentesDe: las notas DGMIT', () => {
  it('fuentesDe trae las notas DGMIT de cada dataset, con todos sus datasets, quién la cargó y el historial', async () => {
    const diego = await crearUsuario('Diego Prueba Cuatro');
    const ana = await crearUsuario('Ana Prueba Uno');
    const gasto = await crearDataset({ titulo: 'Gasto Público', gestion: 'externa', vencimiento: '2026-12-31', requiereNota: 1 });
    const presupuesto = await crearDataset({ titulo: 'Presupuesto Municipal', gestion: 'externa', vencimiento: '2026-12-31', requiereNota: 1 });
    // Dado de baja después de la carga y no pedido a fuentesDe: igual figura entre los datasets de la nota
    const agua = await crearDataset({ titulo: 'Agua potable', gestion: 'externa', vencimiento: '2026-12-31', requiereNota: 1, activo: 0 });
    const ajeno = await crearDataset({ titulo: 'Dataset ajeno', gestion: 'externa', vencimiento: '2026-12-31', requiereNota: 1 });
    const sinNotas = await crearDataset({ titulo: 'Sin notas', gestion: 'externa', vencimiento: '2026-12-31', requiereNota: 1 });

    // La de menor id es la más nueva: el orden es por recibida y, el mismo día, por id
    const solicitud = await insertarNotaDgmit({
      numero: '156/26', recibida: '2026-10-22', creadoPor: diego, cargada: '2026-10-22 11:15:00', datasets: [presupuesto, gasto, agua]
    });
    const reiteracion = await insertarNotaDgmit({ numero: '98/26', tipo: 'reiteracion', recibida: '2026-10-01', cargada: '2026-10-02 09:00:00', datasets: [gasto] });
    const mismoDia = await insertarNotaDgmit({ numero: '99/26', recibida: '2026-10-01', creadoPor: ana, cargada: '2026-10-02 09:05:00', datasets: [gasto] });
    await insertarNotaDgmit({ numero: '200/26', recibida: '2026-10-05', creadoPor: diego, datasets: [ajeno] });
    await insertarHistorialDgmit({
      notaId: solicitud, motivo: 'Faltaba Agua potable', usuarioId: ana, momento: '2026-10-23 09:00:00',
      anteriores: { numero: '156/26', tipo: 'solicitud', recibida: '2026-10-22', datasets: [gasto, presupuesto] }
    });
    await insertarHistorialDgmit({
      notaId: solicitud, motivo: 'La fecha estaba mal', usuarioId: diego, momento: '2026-10-23 10:30:00',
      anteriores: { numero: '156/26', tipo: 'solicitud', recibida: '2026-10-21', datasets: [gasto, presupuesto, agua] }
    });

    const mapa = await fuentesDe([gasto, presupuesto, sinNotas]);
    const datasetsDeLaSolicitud = [
      { id: agua, titulo: 'Agua potable' }, { id: gasto, titulo: 'Gasto Público' }, { id: presupuesto, titulo: 'Presupuesto Municipal' }
    ];
    const laSolicitud = {
      id: solicitud, numero: '156/26', tipo: 'solicitud', recibida: '2026-10-22', anulada: false, cargada: '2026-10-22 11:15:00',
      por: 'Diego Prueba Cuatro', por_id: diego, datasets: datasetsDeLaSolicitud,
      historial: [
        { accion: 'correccion', motivo: 'La fecha estaba mal', por: 'Diego Prueba Cuatro', momento: '2026-10-23 10:30:00' },
        { accion: 'correccion', motivo: 'Faltaba Agua potable', por: 'Ana Prueba Uno', momento: '2026-10-23 09:00:00' }
      ]
    };
    assert.deepEqual(mapa.get(gasto).notasDgmit, [
      {
        id: reiteracion, numero: '98/26', tipo: 'reiteracion', recibida: '2026-10-01', anulada: false, cargada: '2026-10-02 09:00:00',
        por: null, por_id: null, datasets: [{ id: gasto, titulo: 'Gasto Público' }], historial: []
      },
      {
        id: mismoDia, numero: '99/26', tipo: 'solicitud', recibida: '2026-10-01', anulada: false, cargada: '2026-10-02 09:05:00',
        por: 'Ana Prueba Uno', por_id: ana, datasets: [{ id: gasto, titulo: 'Gasto Público' }], historial: []
      },
      laSolicitud
    ]);
    assert.deepEqual(mapa.get(presupuesto).notasDgmit, [laSolicitud]);
    assert.deepEqual(mapa.get(sinNotas).notasDgmit, []);
    // Una copia por dataset: ninguna nota, lista de datasets ni historial se comparte con la de otro dataset
    const [deGasto, dePresupuesto] = [mapa.get(gasto).notasDgmit[2], mapa.get(presupuesto).notasDgmit[0]];
    assert.notStrictEqual(deGasto, dePresupuesto);
    assert.notStrictEqual(deGasto.datasets, dePresupuesto.datasets);
    assert.notStrictEqual(deGasto.datasets[0], dePresupuesto.datasets[0]);
    assert.notStrictEqual(deGasto.historial, dePresupuesto.historial);
    assert.notStrictEqual(deGasto.historial[0], dePresupuesto.historial[0]);
  });

  it('si quien la cargó o quien la corrigió ya no existe (se borró el usuario), por y por_id son null', async () => {
    const diego = await crearUsuario('Diego Prueba Cuatro');
    const ana = await crearUsuario('Ana Prueba Uno');
    const id = await crearDataset({ gestion: 'externa', vencimiento: '2026-12-31', requiereNota: 1 });
    const nota = await insertarNotaDgmit({ numero: '156/26', recibida: '2026-10-22', creadoPor: diego, datasets: [id] });
    await insertarHistorialDgmit({ notaId: nota, motivo: 'Número mal escrito', usuarioId: ana, momento: '2026-10-23 09:00:00' });
    await query('DELETE FROM usuarios WHERE id IN (?)', [[diego, ana]]);
    const [deLaBase] = (await fuentesDe([id])).get(id).notasDgmit;
    assert.deepEqual([deLaBase.por, deLaBase.por_id, deLaBase.historial[0].por], [null, null, null]);
  });

  it('la anulada viene con anulada: true y su anulación en el historial', async () => {
    const diego = await crearUsuario('Diego Prueba Cuatro');
    const ana = await crearUsuario('Ana Prueba Uno');
    const id = await crearDataset({ gestion: 'externa', vencimiento: '2026-12-31', requiereNota: 1 });
    const anulada = await insertarNotaDgmit({ numero: '156/26', recibida: '2026-10-22', anulada: 1, creadoPor: diego, datasets: [id] });
    const vigente = await insertarNotaDgmit({ numero: '157/26', recibida: '2026-10-23', creadoPor: diego, datasets: [id] });
    await insertarHistorialDgmit({
      notaId: anulada, motivo: 'Faltaba un dataset', usuarioId: diego, momento: '2026-10-22 12:00:00',
      anteriores: { numero: '156/26', tipo: 'solicitud', recibida: '2026-10-22', datasets: [] }
    });
    await insertarHistorialDgmit({ notaId: anulada, accion: 'anulacion', motivo: 'Se cargó dos veces', usuarioId: ana, momento: '2026-10-23 08:45:00' });
    const notas = (await fuentesDe([id])).get(id).notasDgmit;
    assert.deepEqual(notas.map((n) => [n.id, n.anulada]), [[anulada, true], [vigente, false]]);
    assert.deepEqual(notas[0].historial, [
      { accion: 'anulacion', motivo: 'Se cargó dos veces', por: 'Ana Prueba Uno', momento: '2026-10-23 08:45:00' },
      { accion: 'correccion', motivo: 'Faltaba un dataset', por: 'Diego Prueba Cuatro', momento: '2026-10-22 12:00:00' }
    ]);
  });

  it('recibida sin correrse un día y cargada en hora argentina', async () => {
    const diego = await crearUsuario('Diego Prueba Cuatro');
    const id = await crearDataset({ gestion: 'externa', vencimiento: '2026-12-31', requiereNota: 1 });
    // 23:30 y 22:15 argentinas: en la base (UTC) ya es el día siguiente
    const nota = await insertarNotaDgmit({ numero: '156/26', recibida: '2026-10-22', creadoPor: diego, cargada: '2026-10-22 23:30:00', datasets: [id] });
    await insertarHistorialDgmit({ notaId: nota, accion: 'anulacion', motivo: 'Duplicada', usuarioId: diego, momento: '2026-10-23 22:15:00' });
    const [deLaBase] = (await fuentesDe([id])).get(id).notasDgmit;
    assert.equal(deLaBase.recibida, '2026-10-22');
    assert.equal(deLaBase.cargada, '2026-10-22 23:30:00');
    assert.equal(deLaBase.historial[0].momento, '2026-10-23 22:15:00');
    assert.match(deLaBase.cargada, MOMENTO);
    assert.match(deLaBase.historial[0].momento, MOMENTO);
  });

  // La consulta va aislada: fuentesDe también arma el anexo de la reiteración, y una falla de las notas DGMIT (por ejemplo, la
  // migración sin correr) no puede frenarlo. Se renombra la tabla solo en la base de prueba de este archivo, y se vuelve a su
  // nombre pase lo que pase; el console.error esperado se captura para no ensuciar la salida
  it('si la tabla de notas DGMIT no existe, fuentesDe sale igual con notasDgmit vacía', async () => {
    const id = await crearDataset({ gestion: 'externa', vencimiento: '2026-12-31', requiereNota: 1 });
    await insertarEmail({ tipo: 'externo-40', ids: String(id), enviado: '2026-06-21 08:00:04' });
    const aviso = await crearNota({ tipo: 'aviso', gestion: 'externa', fecha: '2026-10-13', numero: 2, anio: 2026, datasets: [{ id, vencimiento: '2026-12-31' }] });
    await insertarNotaDgmit({ numero: '156/26', recibida: '2026-10-22', datasets: [id] });
    assert.equal((await fuentesDe([id])).get(id).notasDgmit.length, 1);

    await asegurarBaseDePrueba();
    const errores = [];
    const consoleError = console.error;
    await query('RENAME TABLE notas_dgmit TO notas_dgmit_x');
    try {
      console.error = (...args) => { errores.push(args); };
      const fuentes = (await fuentesDe([id])).get(id);
      console.error = consoleError;
      assert.deepEqual(fuentes.notasDgmit, []);
      assert.equal(fuentes.dataset.id, id);
      assert.deepEqual(fuentes.notas.map((n) => n.id), [aviso]);
      assert.equal(fuentes.emails.length, 1);
      assert.equal(errores.length, 1);
      assert.equal(errores[0][0], 'No se pudieron leer las notas DGMIT:');
      assert.equal(errores[0][1]?.code, 'ER_NO_SUCH_TABLE');
    } finally {
      console.error = consoleError;
      await query('RENAME TABLE notas_dgmit_x TO notas_dgmit');
    }
  });
});

describe('fuentesDe: la forma y los momentos', () => {
  it('una base con de todo: cada lista tiene exactamente las claves de CASOS (guarda de regresión de la forma)', async () => {
    const propuso = await crearUsuario('Ana Prueba Uno');
    const reviso = await crearUsuario('Bruno Prueba Dos');
    const areaId = await crearArea({ nombre: 'Área completa' });
    const id = await crearDataset({ areaId, vencimiento: '2026-12-31', ultima: '2026-01-31', datosAl: '2025-12-31', tipoPedido: 'ejercicio' });
    await fijarAlta(id, '2026-01-26 12:00:30');
    const alta = await insertarCambio({ tipo: 'crear', estado: 'aprobado', revisado: '2026-01-26 12:00:29', propuso, reviso });
    const edicion = await insertarCambio({ datasetId: id, propuso, reviso, estado: 'aprobado', revisado: '2026-02-01 10:00:00', anteriores: { titulo: 'Viejo' } });
    await query('INSERT INTO historial_actualizaciones (dataset_id, fecha_actualizacion, usuario_id, cambio_id) VALUES (?, ?, ?, ?)', [id, '2026-02-01', propuso, edicion]);
    await insertarEmail({ areaId, ids: String(id), enviado: '2026-06-21 08:00:04' });
    await crearNota({ fecha: '2026-10-13', numero: 2, anio: 2026, datasets: [{ id, seccion: 'vencido', vencimiento: '2026-01-31' }] });
    const auditoria = await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-02-05', numero: 1, anio: 2026 });
    await query("INSERT INTO notas_digitales_cambios (nota_id, cambio_id, seccion) VALUES (?, ?, 'nuevo'), (?, ?, 'nuevo')", [auditoria, alta, auditoria, edicion]);
    const notaDgmit = await insertarNotaDgmit({ numero: '156/26', recibida: '2026-10-22', creadoPor: propuso, datasets: [id] });
    await insertarHistorialDgmit({ notaId: notaDgmit, motivo: 'Número mal escrito', usuarioId: reviso, momento: '2026-10-23 09:00:00' });

    const fuentes = (await fuentesDe([id])).get(id);
    const modelo = CASOS[52] ?? Object.values(CASOS)[0];
    const claves = (objeto) => Object.keys(objeto);
    assert.deepEqual(claves(fuentes), [...claves(modelo), 'catalogos']);
    assert.deepEqual(claves(fuentes.dataset), claves(modelo.dataset));
    const conTodo = Object.values(CASOS);
    const primera = (campo) => conTodo.flatMap(c => c[campo])[0];
    assert.ok(fuentes.altasSinDataset.length && fuentes.cambios.length && fuentes.historial.length && fuentes.emails.length && fuentes.notas.length && fuentes.auditorias.length
      && fuentes.notasDgmit.length);
    assert.deepEqual(claves(fuentes.altasSinDataset[0]), claves(primera('altasSinDataset')));
    assert.deepEqual(claves(fuentes.cambios[0]), claves(primera('cambios')));
    assert.deepEqual(claves(fuentes.historial[0]), claves(primera('historial')));
    assert.deepEqual(claves(fuentes.emails[0]), claves(primera('emails')));
    assert.deepEqual(claves(fuentes.notas[0]), claves(primera('notas')));
    // Ningún caso real tiene auditorías: la forma sale del plan (Fuentes.auditorias)
    assert.deepEqual(claves(fuentes.auditorias[0]), ['id', 'numero', 'anio', 'fecha', 'estado', 'cambio_id', 'seccion', 'creado_por', 'firmante']);
    // Ni las notas DGMIT: el dump de los casos es anterior a ellas (spec 2026-10-24-notas-dgmit, 5)
    assert.deepEqual(claves(fuentes.notasDgmit[0]), ['id', 'numero', 'tipo', 'recibida', 'anulada', 'cargada', 'por', 'por_id', 'datasets', 'historial']);
    assert.deepEqual(claves(fuentes.notasDgmit[0].datasets[0]), ['id', 'titulo']);
    assert.deepEqual(claves(fuentes.notasDgmit[0].historial[0]), ['accion', 'motivo', 'por', 'momento']);
  });

  it('todos los momentos (alta, creado, revisado, historial, emails) tienen el formato AAAA-MM-DD HH:MM:SS', async () => {
    const propuso = await crearUsuario('Ana Prueba Uno');
    const reviso = await crearUsuario('Bruno Prueba Dos');
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    await insertarCambio({ datasetId: id, propuso, reviso, estado: 'aprobado', creado: '2026-02-01 00:00:00', revisado: '2026-02-01 10:00:00' });
    await query('INSERT INTO historial_actualizaciones (dataset_id, fecha_actualizacion, usuario_id) VALUES (?, ?, ?)', [id, '2026-02-01', propuso]);
    await insertarEmail({ ids: String(id), enviado: '2026-06-21 08:00:04' });
    const nota = await crearNota({ fecha: '2026-10-13', numero: 2, anio: 2026, datasets: [{ id, vencimiento: '2026-12-31' }] });
    await query("UPDATE notas_digitales SET enviada_at = '2026-10-13 14:50:30' WHERE id = ?", [nota]);
    const f = (await fuentesDe([id])).get(id);
    const momentos = [f.dataset.alta, f.cambios[0].creado, f.cambios[0].revisado, f.historial[0].creado, f.emails[0].enviado, f.notas[0].enviada];
    for (const m of momentos) assert.match(m, MOMENTO);
    assert.equal(f.cambios[0].creado, '2026-02-01 00:00:00');
  });

  it('el momento de alta en hora argentina cuando la base (UTC) está en otro día', async () => {
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    await fijarAlta(id, '2026-03-04 22:15:00');
    assert.equal((await fuentesDe([id])).get(id).dataset.alta, '2026-03-04 22:15:00');
  });
});
