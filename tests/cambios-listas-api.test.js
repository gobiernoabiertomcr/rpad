// Las listas de cambios pendientes de Mi Perfil (para-revisar y mis-cambios) traen la misma comparación que el detalle,
// los nombres de catálogo, la URL del dataset y, en para-revisar, el permiso de auditoría con quiénes lo auditan; las
// fechas se comparan por día. Contra una base de prueba propia. La API usa la fecha real: las licencias se arman desde hoy.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { crearArea, crearDataset, limpiarBase } from './notas-fixtures.js';
import { hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';

// El editor, con auditores disponibles, audita sin responsabilidad el cambio de un auditor (spec 2026-10-20-editor-sin-responsabilidad)
const AVISO = 'Este cambio lo auditan Test adminB y Test superadmin. Si lo aprobás o lo rechazás vos, queda registrado sin responsabilidad por la auditoría.';
const hoy = hoyArgentina();
let base, servidor, api, usuarios, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_cambios_listas');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, { adminA: 'admin', adminB: 'admin', superadmin: 'superadmin', editor: 'editor' });
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  await limpiarBase();
  await query('DELETE FROM cambios_pendientes');
  await query('DELETE FROM usuarios_licencias');
});

const como = (clave) => ({ token: usuarios[clave].token });
// De licencia desde ayer hasta mañana
const deLicenciaHoy = (...claves) => Promise.all(claves.map(clave => query(
  'INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuarios[clave].id, sumarDias(hoy, -1), sumarDias(hoy, 1)]
)));
const insertarCambio = async ({ tipo, datasetId = null, nuevos, anteriores = null, clave }) => (await query(
  `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, datos_anteriores, usuario_id) VALUES (?, ?, ?, ?, ?)`,
  [tipo, datasetId, JSON.stringify(nuevos), anteriores && JSON.stringify(anteriores), usuarios[clave].id]
)).insertId;
// Un editar de esa persona sobre un dataset de prueba: cambian el título y las observaciones, el área queda igual
const proponerEdicion = async (clave) => {
  const areaId = await crearArea({ nombre: 'Área de la comparación' });
  const datasetId = await crearDataset({ titulo: 'Viejo', areaId, vencimiento: '2027-06-30' });
  const id = await insertarCambio({
    tipo: 'editar', datasetId, clave,
    anteriores: { titulo: 'Viejo', area_id: areaId, observaciones: null },
    nuevos: { titulo: 'Nuevo', area_id: areaId, observaciones: 'Obs nueva' }
  });
  return { id, areaId, datasetId };
};
const proponerBaja = async (clave) => {
  const datasetId = await crearDataset({ titulo: 'Dataset a dar de baja', vencimiento: '2027-06-30' });
  return insertarCambio({ tipo: 'eliminar', datasetId, clave, nuevos: { eliminado: true }, anteriores: { titulo: 'Dataset a dar de baja' } });
};
const lista = async (ruta, clave, filtro = '') => (await api.get(`/cambios-pendientes/${ruta}${filtro}`, como(clave))).body.data;
const detalle = async (id, clave) => (await api.get(`/cambios-pendientes/${id}`, como(clave))).body.data;

const COMPARACION = [
  { campo: 'Titulo', antes: 'Viejo', despues: 'Nuevo' },
  { campo: 'Observaciones', antes: '-', despues: 'Obs nueva' }
];

describe('listas de cambios pendientes con la comparación', () => {
  it('para-revisar trae la comparación, los nombres de catálogo y la URL, igual que el detalle', async () => {
    const { id } = await proponerEdicion('adminA');
    const elemento = (await lista('para-revisar', 'adminB')).find(c => c.id === id);
    assert.ok(elemento);
    assert.deepEqual(elemento.campos_modificados, COMPARACION);
    assert.deepEqual(elemento.campos_modificados, (await detalle(id, 'adminB')).campos_modificados);
    assert.equal(elemento.datos_nuevos.area_nombre, 'Área de la comparación');
    assert.equal(elemento.datos_anteriores.area_nombre, 'Área de la comparación');
    assert.ok('dataset_url' in elemento);
    assert.equal(elemento.dataset_url, 'https://datos.comodoro.gov.ar/dataset/prueba');
  });

  it('mis-cambios trae lo mismo y no trae auditoria', async () => {
    const { id } = await proponerEdicion('adminA');
    const elemento = (await lista('mis-cambios', 'adminA')).find(c => c.id === id);
    assert.ok(elemento);
    assert.deepEqual(elemento.campos_modificados, COMPARACION);
    assert.ok(elemento.datos_nuevos.area_nombre);
    assert.ok('dataset_url' in elemento);
    assert.ok(!('auditoria' in elemento));
  });

  it('crear y eliminar traen campos_modificados null', async () => {
    const crear = await insertarCambio({ tipo: 'crear', clave: 'adminA', nuevos: { titulo: 'Dataset nuevo' } });
    const eliminar = await proponerBaja('adminA');
    for (const lectura of [() => lista('para-revisar', 'adminB'), () => lista('mis-cambios', 'adminA')]) {
      const cambios = await lectura();
      for (const id of [crear, eliminar]) {
        const elemento = cambios.find(c => c.id === id);
        assert.ok(elemento, `falta el cambio ${id}`);
        assert.equal(elemento.campos_modificados, null);
      }
    }
    // Un alta no tiene dataset todavía: la URL viene null
    assert.equal((await lista('mis-cambios', 'adminA')).find(c => c.id === crear).dataset_url, null);
  });
});

describe('auditoria en la lista de para-revisar', () => {
  it('el mismo permiso que el detalle, con quiénes lo auditan', async () => {
    const id = await proponerBaja('adminA');
    const AUDITAN = ['Test adminB', 'Test superadmin'];
    const deLista = async (clave, filtro) => (await lista('para-revisar', clave, filtro)).find(c => c.id === id).auditoria;
    const delDetalle = async (clave) => (await detalle(id, clave)).auditoria;
    const sinAuditan = ({ auditan, ...resto }) => resto;

    assert.deepEqual(await deLista('editor'), { puede: true, respaldo: false, sin_responsabilidad: true, mensaje: AVISO, auditan: AUDITAN });
    assert.deepEqual(await deLista('adminB'), { puede: true, respaldo: false, sin_responsabilidad: false, mensaje: null, auditan: AUDITAN });
    assert.deepEqual(sinAuditan(await deLista('editor')), await delDetalle('editor'));
    assert.deepEqual(sinAuditan(await deLista('adminB')), await delDetalle('adminB'));

    await deLicenciaHoy('adminB', 'superadmin');
    assert.deepEqual(await deLista('editor'), { puede: true, respaldo: true, sin_responsabilidad: false, mensaje: null, auditan: [] });
    assert.deepEqual(sinAuditan(await deLista('editor')), await delDetalle('editor'));
    await query('DELETE FROM usuarios_licencias');

    await query(`UPDATE cambios_pendientes SET estado = 'aprobado', revisor_id = ? WHERE id = ?`, [usuarios.adminB.id, id]);
    assert.deepEqual(await deLista('editor', '?estado=todos'),
      { puede: false, respaldo: false, sin_responsabilidad: false, mensaje: null, auditan: [] });
    assert.deepEqual(await delDetalle('editor'), { puede: false, respaldo: false, sin_responsabilidad: false, mensaje: null });
  });

  it('el detalle trae auditoria con sus cuatro claves, sin auditan', async () => {
    const CLAVES = ['mensaje', 'puede', 'respaldo', 'sin_responsabilidad'];
    const id = await proponerBaja('adminA');
    for (const clave of ['editor', 'adminB', 'adminA']) {
      assert.deepEqual(Object.keys((await detalle(id, clave)).auditoria).sort(), CLAVES);
    }
    await deLicenciaHoy('adminB', 'superadmin');
    assert.deepEqual(Object.keys((await detalle(id, 'editor')).auditoria).sort(), CLAVES);
  });
});

describe('fechas comparadas por día', () => {
  it('una fecha con hora y la misma sin hora no figura como cambio; un día distinto sí', async () => {
    const datasetId = await crearDataset({ titulo: 'X', vencimiento: '2027-06-30' });
    const id = await insertarCambio({
      tipo: 'editar', datasetId, clave: 'adminA',
      anteriores: { titulo: 'X', ultima_actualizacion: '2026-03-13T03:00:00.000Z', proxima_actualizacion: '2026-05-31T03:00:00.000Z' },
      nuevos: { titulo: 'X', ultima_actualizacion: '2026-03-20', proxima_actualizacion: '2026-05-31' }
    });
    // "Ultima Actualizacion" pasa a llamarse "Cargado en el portal" (spec 2026-10-17-fechas-datasets, 10.1)
    const esperado = [{ campo: 'Cargado en el portal', antes: '2026-03-13T03:00:00.000Z', despues: '2026-03-20' }];
    assert.deepEqual((await detalle(id, 'adminB')).campos_modificados, esperado);
    assert.deepEqual((await lista('para-revisar', 'adminB')).find(c => c.id === id).campos_modificados, esperado);
  });

  it('"Datos al" y "Recibido el" también se comparan por día: con hora o sin hora no es un cambio, otro día sí', async () => {
    const datasetId = await crearDataset({ titulo: 'X', vencimiento: '2027-06-30' });
    const id = await insertarCambio({
      tipo: 'editar', datasetId, clave: 'adminA',
      anteriores: { titulo: 'X', datos_al: '2026-02-28T03:00:00.000Z', recibido_el: '2026-03-02T03:00:00.000Z' },
      nuevos: { titulo: 'X', datos_al: '2026-02-28', recibido_el: '2026-03-03' }
    });
    const esperado = [{ campo: 'Recibido el', antes: '2026-03-02T03:00:00.000Z', despues: '2026-03-03' }];
    assert.deepEqual((await detalle(id, 'adminB')).campos_modificados, esperado);
    assert.deepEqual((await lista('para-revisar', 'adminB')).find(c => c.id === id).campos_modificados, esperado);
  });
});

// Una actualización registrada (POST /datasets/:id/actualizar) y los demás cambios de las fechas nuevas: los rótulos
// "Datos al", "Cargado en el portal", "Recibido el" y "Tipo de pedido" (spec 2026-10-17-fechas-datasets, 10.1)
describe('comparación de las fechas nuevas', () => {
  it('un registro de actualización: Datos al, Cargado en el portal, Recibido el y la próxima, sin la marca ni las notas', async () => {
    const datasetId = await crearDataset({ titulo: 'X', vencimiento: '2027-06-30' });
    const id = await insertarCambio({
      tipo: 'editar', datasetId, clave: 'adminA',
      anteriores: { ultima_actualizacion: '2026-03-13', datos_al: '2026-02-28', proxima_actualizacion: '2026-03-31' },
      nuevos: {
        ultima_actualizacion: '2026-04-03', datos_al: '2026-03-31', proxima_actualizacion: '2026-06-30', recibido_el: '2026-04-02',
        notas: 'Llegó por mail', registro_actualizacion: true
      }
    });
    const esperado = [
      { campo: 'Datos al', antes: '2026-02-28', despues: '2026-03-31' },
      { campo: 'Cargado en el portal', antes: '2026-03-13', despues: '2026-04-03' },
      { campo: 'Recibido el', antes: '-', despues: '2026-04-02' },
      { campo: 'Proxima Actualizacion', antes: '2026-03-31', despues: '2026-06-30' }
    ];
    assert.deepEqual((await detalle(id, 'adminB')).campos_modificados, esperado);
    assert.deepEqual((await lista('para-revisar', 'adminB')).find(c => c.id === id).campos_modificados, esperado);
    // La marca viaja en los datos nuevos, no como un campo comparado
    assert.equal((await detalle(id, 'adminB')).datos_nuevos.registro_actualizacion, true);
  });

  // El origen de los datos (spec 2026-10-24-metricas-y-reportes, 4): viaja en el registro y se compara después de «Recibido el»;
  // en gestión interna llega null y no se lista
  it('un registro con el origen de los datos lo compara como «Origen de los datos»; con el origen en null, no', async () => {
    const registro = async (origen) => insertarCambio({
      tipo: 'editar', datasetId: await crearDataset({ titulo: 'X', vencimiento: '2027-06-30' }), clave: 'adminA',
      anteriores: { ultima_actualizacion: '2026-03-13', datos_al: '2026-02-28', proxima_actualizacion: '2026-03-31' },
      nuevos: {
        ultima_actualizacion: '2026-04-03', datos_al: '2026-03-31', proxima_actualizacion: '2026-06-30', recibido_el: '2026-04-02',
        origen_datos: origen, notas: null, registro_actualizacion: true
      }
    });
    const FECHAS = [
      { campo: 'Datos al', antes: '2026-02-28', despues: '2026-03-31' },
      { campo: 'Cargado en el portal', antes: '2026-03-13', despues: '2026-04-03' },
      { campo: 'Recibido el', antes: '-', despues: '2026-04-02' }
    ];
    const PROXIMA = { campo: 'Proxima Actualizacion', antes: '2026-03-31', despues: '2026-06-30' };

    const conOrigen = await registro('fuente_publica');
    const esperado = [...FECHAS, { campo: 'Origen de los datos', antes: '-', despues: 'Fuente pública' }, PROXIMA];
    assert.deepEqual((await detalle(conOrigen, 'adminB')).campos_modificados, esperado);
    assert.deepEqual((await lista('para-revisar', 'adminB')).find(c => c.id === conOrigen).campos_modificados, esperado);

    const interno = await registro(null);
    assert.deepEqual((await detalle(interno, 'adminB')).campos_modificados, [...FECHAS, PROXIMA]);
    assert.deepEqual((await lista('para-revisar', 'adminB')).find(c => c.id === interno).campos_modificados, [...FECHAS, PROXIMA]);
  });

  it('el tipo de pedido se compara con su nombre en pantalla', async () => {
    const datasetId = await crearDataset({ titulo: 'X', vencimiento: '2027-06-30' });
    const id = await insertarCambio({
      tipo: 'editar', datasetId, clave: 'adminA',
      anteriores: { titulo: 'X', tipo_pedido: 'acumulado' },
      nuevos: { titulo: 'X', tipo_pedido: 'foto' }
    });
    const esperado = [{ campo: 'Tipo de pedido', antes: 'Acumulado', despues: 'Foto al corte' }];
    assert.deepEqual((await detalle(id, 'adminB')).campos_modificados, esperado);
    assert.deepEqual((await lista('para-revisar', 'adminB')).find(c => c.id === id).campos_modificados, esperado);
  });

  it('un cambio con la forma vieja (sin las claves nuevas) no menciona Datos al, Recibido el ni el tipo de pedido', async () => {
    const datasetId = await crearDataset({ titulo: 'X', vencimiento: '2027-06-30' });
    const id = await insertarCambio({
      tipo: 'editar', datasetId, clave: 'adminA',
      anteriores: { ultima_actualizacion: '2026-03-13T03:00:00.000Z', proxima_actualizacion: '2026-03-31T03:00:00.000Z' },
      nuevos: { ultima_actualizacion: '2026-03-20', proxima_actualizacion: '2026-06-30', notas: 'x' }
    });
    assert.deepEqual((await detalle(id, 'adminB')).campos_modificados, [
      { campo: 'Cargado en el portal', antes: '2026-03-13T03:00:00.000Z', despues: '2026-03-20' },
      { campo: 'Proxima Actualizacion', antes: '2026-03-31T03:00:00.000Z', despues: '2026-06-30' }
    ]);
  });
});
