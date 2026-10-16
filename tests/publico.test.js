// Rutas públicas: consulta de datasets, catálogos, áreas y formulario de contacto
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, crearCliente, cerrarDb, query, mailpit } from './helpers.js';

let servidor, api;

before(async () => {
  servidor = await iniciarServidor();
  api = crearCliente(servidor.url);
});

after(async () => {
  await cerrarDb();
  await servidor?.detener();
});

describe('consultas públicas', () => {
  it('lista solo los datasets activos', async () => {
    const res = await api.get('/datasets');
    assert.equal(res.status, 200);
    const [{ activos }] = await query('SELECT COUNT(*) AS activos FROM datasets WHERE activo = 1');
    assert.equal(res.body.data.length, activos);
  });

  it('devuelve el detalle de un dataset', async () => {
    const [dataset] = await query('SELECT id, titulo FROM datasets WHERE activo = 1 LIMIT 1');
    const res = await api.get(`/datasets/${dataset.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.titulo, dataset.titulo);
  });

  it('devuelve 404 para un dataset inexistente', async () => {
    assert.equal((await api.get('/datasets/999999')).status, 404);
  });

  it('calcula estadísticas sobre todos los activos', async () => {
    const res = await api.get('/datasets/estadisticas');
    assert.equal(res.status, 200);
    const [{ activos }] = await query('SELECT COUNT(*) AS activos FROM datasets WHERE activo = 1');
    assert.equal(res.body.data.total, activos);
  });

  for (const ruta of ['/catalogos/temas', '/catalogos/frecuencias', '/catalogos/formatos', '/areas']) {
    it(`responde ${ruta}`, async () => {
      const res = await api.get(ruta);
      assert.equal(res.status, 200);
      assert.ok(res.body.data.length > 0);
    });
  }
});

describe('formulario de contacto', () => {
  const mensajeValido = {
    nombre: 'Persona de prueba',
    email: 'persona@rpad.test',
    tipo: 'consulta-general',
    mensaje: 'Mensaje de prueba enviado por los tests automáticos.'
  };

  it('envía el mensaje a la casilla de datos públicos', async () => {
    await mailpit.vaciar();
    const res = await api.post('/contacto', mensajeValido);
    assert.equal(res.status, 200);
    const mensajes = await mailpit.mensajes();
    assert.equal(mensajes.length, 1);
    assert.deepEqual(mensajes[0].To.map(t => t.Address), ['datospublicos@comodoro.gov.ar']);
    assert.equal(mensajes[0].From.Name, 'Dir. de Datos Públicos y Comunicación');
  });

  it('rechaza un mensaje demasiado corto', async () => {
    const res = await api.post('/contacto', { ...mensajeValido, mensaje: 'corto' });
    assert.equal(res.status, 400);
  });

  it('rechaza un tipo de consulta inválido', async () => {
    const res = await api.post('/contacto', { ...mensajeValido, tipo: 'cualquiera' });
    assert.equal(res.status, 400);
  });
});
