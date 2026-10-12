// Doble verificación: un admin propone, otro admin distinto aprueba o rechaza
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb,
  catalogos, query, PREFIJO_TEST
} from './helpers.js';

let servidor, api, usuarios, cat;

before(async () => {
  servidor = await iniciarServidor();
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api);
  cat = await catalogos();
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
});

const datosAlta = (titulo) => ({
  titulo: `${PREFIJO_TEST} ${titulo}`,
  descripcion: 'Dataset creado por los tests',
  area_id: cat.areaId,
  frecuencia_id: cat.frecuenciaId,
  tema_principal_id: cat.temaId,
  tipo_gestion: 'interna',
  formatos: [cat.formatoId],
  url_dataset: 'https://datos.comodoro.gov.ar/dataset/test'
});

const aprobar = (cambioId, usuario) =>
  api.post(`/cambios-pendientes/${cambioId}/aprobar`, {}, { token: usuario.token });

const rechazar = (cambioId, usuario, comentario = 'Rechazado por los tests') =>
  api.post(`/cambios-pendientes/${cambioId}/rechazar`, { comentario }, { token: usuario.token });

// Crea un dataset de prueba pasando por el circuito completo (A propone, B aprueba)
const crearDatasetAprobado = async (titulo) => {
  const alta = await api.post('/datasets', datosAlta(titulo), { token: usuarios.adminA.token });
  assert.equal(alta.status, 201);
  const aprobacion = await aprobar(alta.body.data.cambio_pendiente_id, usuarios.adminB);
  assert.equal(aprobacion.status, 200);
  return aprobacion.body.data.dataset_id;
};

const datasetEnDb = async (id) => (await query('SELECT * FROM datasets WHERE id = ?', [id]))[0];

describe('alta de dataset', () => {
  it('queda pendiente y no crea el dataset hasta que se apruebe', async () => {
    const titulo = `${PREFIJO_TEST} alta pendiente`;
    const alta = await api.post('/datasets', datosAlta('alta pendiente'), { token: usuarios.adminA.token });
    assert.equal(alta.status, 201);
    assert.ok(alta.body.data.cambio_pendiente_id);
    const creados = await query('SELECT id FROM datasets WHERE titulo = ?', [titulo]);
    assert.equal(creados.length, 0);
  });

  it('el mismo admin que propone no puede aprobar', async () => {
    const alta = await api.post('/datasets', datosAlta('autoaprobación'), { token: usuarios.adminA.token });
    const res = await aprobar(alta.body.data.cambio_pendiente_id, usuarios.adminA);
    assert.equal(res.status, 403);
  });

  it('el mismo admin que propone no puede rechazar', async () => {
    const alta = await api.post('/datasets', datosAlta('autorrechazo'), { token: usuarios.adminA.token });
    const res = await rechazar(alta.body.data.cambio_pendiente_id, usuarios.adminA);
    assert.equal(res.status, 403);
  });

  it('otro admin aprueba y el dataset se crea con sus formatos', async () => {
    const id = await crearDatasetAprobado('alta aprobada');
    const dataset = await datasetEnDb(id);
    assert.equal(dataset.titulo, `${PREFIJO_TEST} alta aprobada`);
    assert.equal(dataset.activo, 1);
    const formatos = await query('SELECT formato_id FROM dataset_formatos WHERE dataset_id = ?', [id]);
    assert.deepEqual(formatos.map(f => f.formato_id), [cat.formatoId]);
  });

  it('un cambio ya aprobado no se puede volver a aprobar', async () => {
    const alta = await api.post('/datasets', datosAlta('doble aprobación secuencial'), { token: usuarios.adminA.token });
    const cambioId = alta.body.data.cambio_pendiente_id;
    assert.equal((await aprobar(cambioId, usuarios.adminB)).status, 200);
    assert.equal((await aprobar(cambioId, usuarios.adminB)).status, 404);
    const creados = await query('SELECT id FROM datasets WHERE titulo = ?', [`${PREFIJO_TEST} doble aprobación secuencial`]);
    assert.equal(creados.length, 1);
  });
});

describe('edición, bloqueo y rechazo', () => {
  it('aprobar una edición aplica el nuevo título', async () => {
    const id = await crearDatasetAprobado('para editar');
    const edicion = await api.put(`/datasets/${id}`, { titulo: `${PREFIJO_TEST} editado` }, { token: usuarios.adminA.token });
    assert.equal(edicion.status, 200);
    assert.equal((await datasetEnDb(id)).titulo, `${PREFIJO_TEST} para editar`);
    assert.equal((await aprobar(edicion.body.data.cambio_pendiente_id, usuarios.adminB)).status, 200);
    assert.equal((await datasetEnDb(id)).titulo, `${PREFIJO_TEST} editado`);
  });

  it('con un cambio pendiente el dataset queda bloqueado para editar, actualizar y eliminar', async () => {
    const id = await crearDatasetAprobado('bloqueo');
    const edicion = await api.put(`/datasets/${id}`, { titulo: `${PREFIJO_TEST} bloqueo v2` }, { token: usuarios.adminA.token });
    assert.equal(edicion.status, 200);

    const otraEdicion = await api.put(`/datasets/${id}`, { titulo: `${PREFIJO_TEST} bloqueo v3` }, { token: usuarios.adminB.token });
    const actualizacion = await api.post(`/datasets/${id}/actualizar`, {}, { token: usuarios.adminB.token });
    const baja = await api.delete(`/datasets/${id}`, { token: usuarios.adminB.token });
    assert.deepEqual([otraEdicion.status, actualizacion.status, baja.status], [409, 409, 409]);
  });

  it('rechazar exige un motivo', async () => {
    const id = await crearDatasetAprobado('rechazo sin motivo');
    const edicion = await api.put(`/datasets/${id}`, { titulo: `${PREFIJO_TEST} x` }, { token: usuarios.adminA.token });
    const res = await rechazar(edicion.body.data.cambio_pendiente_id, usuarios.adminB, '');
    assert.equal(res.status, 400);
  });

  it('rechazar deja el dataset como estaba y lo desbloquea', async () => {
    const id = await crearDatasetAprobado('rechazo');
    const edicion = await api.put(`/datasets/${id}`, { titulo: `${PREFIJO_TEST} no debería aplicarse` }, { token: usuarios.adminA.token });
    assert.equal((await rechazar(edicion.body.data.cambio_pendiente_id, usuarios.adminB)).status, 200);
    assert.equal((await datasetEnDb(id)).titulo, `${PREFIJO_TEST} rechazo`);
    const nuevaEdicion = await api.put(`/datasets/${id}`, { titulo: `${PREFIJO_TEST} rechazo v2` }, { token: usuarios.adminA.token });
    assert.equal(nuevaEdicion.status, 200);
  });
});

describe('baja y registro de actualización', () => {
  it('aprobar una baja desactiva el dataset sin borrarlo', async () => {
    const id = await crearDatasetAprobado('baja');
    const baja = await api.delete(`/datasets/${id}`, { token: usuarios.adminA.token });
    assert.equal(baja.status, 200);
    assert.equal((await aprobar(baja.body.data.cambio_pendiente_id, usuarios.adminB)).status, 200);
    const dataset = await datasetEnDb(id);
    assert.ok(dataset, 'el registro debe seguir existiendo');
    assert.equal(dataset.activo, 0);
    assert.equal((await api.get(`/datasets/${id}`)).status, 404);
  });

  it('registrar una actualización y aprobarla mueve las fechas', async () => {
    const id = await crearDatasetAprobado('actualización');
    const res = await api.post(`/datasets/${id}/actualizar`, { fecha_actualizacion: '2026-03-15' }, { token: usuarios.adminA.token });
    assert.equal(res.status, 200);
    assert.equal((await aprobar(res.body.data.cambio_pendiente_id, usuarios.adminB)).status, 200);
    const [fechas] = await query(
      `SELECT DATE_FORMAT(ultima_actualizacion, '%Y-%m-%d') AS ultima,
              DATEDIFF(proxima_actualizacion, ultima_actualizacion) AS dias,
              (SELECT dias FROM frecuencias WHERE id = ?) AS dias_frecuencia
       FROM datasets WHERE id = ?`,
      [cat.frecuenciaId, id]
    );
    assert.equal(fechas.ultima, '2026-03-15');
    assert.equal(fechas.dias, fechas.dias_frecuencia);
  });
});
