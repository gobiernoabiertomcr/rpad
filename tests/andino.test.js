// El pedido al portal de datos abiertos, sin servidor ni red (spec 2026-11-03-validacion-api-publica): `fetch` falso. El tiempo límite
// es de verdad: cuando un test necesita que venza, usa el `AbortSignal.timeout` real con un plazo corto
import { describe, it, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { fetchFromAndino } from '../controllers/andinoController.js';

const URL_VALIDA = 'https://datos.comodoro.gov.ar/dataset/nombre-del-dataset';
const NO_RESPONDIO = 'El portal de datos abiertos no respondió a tiempo. Probá de nuevo en unos minutos.';
const timeoutReal = AbortSignal.timeout.bind(AbortSignal);

const pedir = async (query) => {
  const respuesta = { status: 200 };
  const res = {
    status(codigo) { respuesta.status = codigo; return this; },
    json(cuerpo) { respuesta.body = cuerpo; return this; }
  };
  await fetchFromAndino({ query }, res);
  return respuesta;
};

const datosDelPortal = {
  success: true,
  result: {
    title: 'Título del portal',
    notes: 'Descripción del portal',
    author: 'Área del portal',
    resources: [{ format: 'csv' }, { format: 'md' }, { format: 'ZIP', name: 'Shapefile de la ciudad' }]
  }
};
const portalQueContesta = (datos = datosDelPortal, { ok = true, status = 200 } = {}) => async () => ({ ok, status, json: async () => datos });

// El temporizador de AbortSignal.timeout no mantiene vivo el proceso: sin esto, node --test terminaría antes de que venza
let vivo;
before(() => { vivo = setInterval(() => {}, 1000); });
after(() => clearInterval(vivo));

beforeEach(() => { mock.method(console, 'error', () => {}); });
afterEach(() => mock.restoreAll());

describe('el tiempo límite', () => {
  it('el pedido lleva un signal de 10 segundos, y no la opción timeout, que fetch no conoce', async () => {
    const espera = mock.method(AbortSignal, 'timeout');
    const portal = mock.method(globalThis, 'fetch', portalQueContesta());
    assert.equal((await pedir({ url: URL_VALIDA })).status, 200);
    assert.deepEqual(espera.mock.calls.map((llamada) => llamada.arguments[0]), [10000]);
    const [, opciones] = portal.mock.calls[0].arguments;
    assert.ok(opciones.signal instanceof AbortSignal);
    assert.equal('timeout' in opciones, false);
  });

  it('si el portal no contesta, vence: 504 con un mensaje claro', { timeout: 2000 }, async () => {
    mock.method(AbortSignal, 'timeout', () => timeoutReal(20));
    mock.method(globalThis, 'fetch', (_, { signal }) => new Promise((_resolver, rechazar) => {
      signal.addEventListener('abort', () => rechazar(signal.reason));
    }));
    const res = await pedir({ url: URL_VALIDA });
    assert.equal(res.status, 504);
    assert.deepEqual(res.body, { success: false, error: NO_RESPONDIO });
  });

  it('si contesta los encabezados y se cuelga en el cuerpo, también vence', { timeout: 2000 }, async () => {
    mock.method(AbortSignal, 'timeout', () => timeoutReal(20));
    mock.method(globalThis, 'fetch', async (_, { signal }) => ({
      ok: true,
      status: 200,
      json: () => new Promise((_resolver, rechazar) => {
        signal.addEventListener('abort', () => rechazar(signal.reason));
      })
    }));
    const res = await pedir({ url: URL_VALIDA });
    assert.equal(res.status, 504);
    assert.deepEqual(res.body, { success: false, error: NO_RESPONDIO });
  });
});

describe('el parámetro url', () => {
  for (const url of [['a', 'b'], { x: 'y' }, [URL_VALIDA]]) {
    it(`${JSON.stringify(url)} no es un texto: 400, sin salir a la red`, async () => {
      const portal = mock.method(globalThis, 'fetch', portalQueContesta());
      const res = await pedir({ url });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, { success: false, error: 'Se requiere el parámetro url' });
      assert.equal(portal.mock.callCount(), 0);
    });
  }

  it('sin url: 400, sin salir a la red', async () => {
    const portal = mock.method(globalThis, 'fetch', portalQueContesta());
    assert.equal((await pedir({})).status, 400);
    assert.equal((await pedir({ url: '' })).status, 400);
    assert.equal(portal.mock.callCount(), 0);
  });

  it('una URL de otro sitio: 400, sin salir a la red', async () => {
    const portal = mock.method(globalThis, 'fetch', portalQueContesta());
    const res = await pedir({ url: 'https://otro.example/dataset/algo' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /URL no válida/);
    assert.equal(portal.mock.callCount(), 0);
  });
});

describe('lo que ya andaba', () => {
  it('devuelve lo del portal mapeado y consulta siempre al portal, con el dataset de la URL', async () => {
    const portal = mock.method(globalThis, 'fetch', portalQueContesta());
    const res = await pedir({ url: ` ${URL_VALIDA} ` });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, {
      titulo: 'Título del portal',
      descripcion: 'Descripción del portal',
      area_responsable_texto: 'Área del portal',
      url_dataset: URL_VALIDA,
      formatos: ['CSV', 'Markdown', 'SHP']
    });
    assert.equal(portal.mock.calls[0].arguments[0], 'https://datos.comodoro.gov.ar/api/3/action/package_show?id=nombre-del-dataset');
  });

  it('un dataset que el portal no tiene: 404', async () => {
    mock.method(globalThis, 'fetch', portalQueContesta({}, { ok: false, status: 404 }));
    const res = await pedir({ url: URL_VALIDA });
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Dataset no encontrado en el portal de datos abiertos');
  });

  it('otro status del portal: 500', async () => {
    mock.method(globalThis, 'fetch', portalQueContesta({}, { ok: false, status: 502 }));
    assert.equal((await pedir({ url: URL_VALIDA })).status, 500);
  });

  it('la red caída: 503', async () => {
    mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed'); });
    const res = await pedir({ url: URL_VALIDA });
    assert.equal(res.status, 503);
    assert.match(res.body.error, /No se pudo conectar con el portal/);
  });

  it('un cuerpo que no es un JSON: 500', async () => {
    mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('no es un JSON'); } }));
    assert.equal((await pedir({ url: URL_VALIDA })).status, 500);
  });
});
