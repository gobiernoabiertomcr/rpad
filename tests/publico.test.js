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
      // Sin sesión, las áreas salen sin los datos de contacto (spec 2026-10-24-configuracion, 5.1)
      if (ruta === '/areas') assert.ok(res.body.data.every((area) => !('email_principal' in area)));
    });
  }
});

// La CSP de Helmet (app.js): Chart.js salió de Gestión (spec 2026-10-24-metricas-y-reportes, 6) y ninguna página carga nada de un CDN
// (tests/paginas.test.js), así que la CSP ya no permite ninguno
describe('la política de seguridad de contenido', () => {
  it('no permite scripts ni hojas de un CDN (jsDelivr ni cdnjs), y sigue permitiendo el sitio y las fuentes de Google', async () => {
    const res = await fetch(`${servidor.url}/index.html`);
    assert.equal(res.status, 200);
    const csp = res.headers.get('content-security-policy') ?? '';
    const directiva = (nombre) => csp.split(';').map(d => d.trim()).find(d => d.startsWith(`${nombre} `)) ?? '';
    assert.match(directiva('script-src'), /'self'/);
    assert.match(directiva('style-src'), /'self'/);
    assert.match(directiva('style-src'), /https:\/\/fonts\.googleapis\.com/);
    assert.match(directiva('font-src'), /https:\/\/fonts\.gstatic\.com/);
    assert.doesNotMatch(csp, /cdn\.jsdelivr\.net/);
    assert.doesNotMatch(csp, /cdnjs\.cloudflare\.com/);
    // script-src: solo el sitio (y los scripts en línea de siempre)
    assert.equal(directiva('script-src'), "script-src 'self' 'unsafe-inline'");
  });
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

  // Con su IP: el límite de 5 envíos por hora se cuenta antes de validar
  it('un campo que no es un texto da 400, no un error del servidor', async () => {
    const headers = { 'X-Forwarded-For': '203.0.113.100' };
    const res = await api.post('/contacto', { ...mensajeValido, nombre: 12345, email: ['persona@rpad.test'], mensaje: { a: 1 } }, { headers });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /El nombre debe tener al menos 2 caracteres/);
    assert.match(res.body.error, /Ingrese un email válido/);
    assert.match(res.body.error, /El mensaje debe tener al menos 10 caracteres/);
  });

  it('en un formulario, también', async () => {
    const respuesta = await fetch(`${servidor.url}/api/contacto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': '203.0.113.101' },
      body: 'nombre[a]=Persona&email[]=persona@rpad.test&tipo=consulta-general&mensaje[a]=Mensaje de prueba'
    });
    assert.equal(respuesta.status, 400);
    assert.match((await respuesta.json()).error, /Ingrese un email válido/);
  });

  it('un email más largo que el tope da 400', async () => {
    const headers = { 'X-Forwarded-For': '203.0.113.102' };
    const res = await api.post('/contacto', { ...mensajeValido, email: `${'a'.repeat(100)}@rpad.test` }, { headers });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Ingrese un email válido');
  });
});
