// API de las fechas de un dataset (spec 2026-10-17-fechas-datasets, secciones 7 y 10): lo que suman GET /datasets y
// GET /datasets/:id (Datos al, tipo de pedido, pedido, estado) y los dos cálculos para la pantalla de admin
// (opciones-proxima y calculo-pedido). Los datasets de prueba se cargan por SQL, con el prefijo [TEST].
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import {
  iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, catalogos, query, PREFIJO_TEST
} from './helpers.js';
import { hoyArgentina } from '../services/notasDigitalesCalendario.js';
import { estadoDelDataset } from '../services/fechasDatasetReglas.js';

let servidor, api, usuarios, cat;
const ids = {};

// Carga un dataset por SQL: la API no deja crear los datos "raros" (próxima que no es fin de mes, sin próxima, etc.)
const cargarDataset = async ({ clave, frecuencia, gestion = 'externa', proxima = null, datosAl = null, tipoPedido = null }) => {
  const [{ id: frecuenciaId }] = await query('SELECT id FROM frecuencias WHERE nombre = ?', [frecuencia]);
  const resultado = await query(
    `INSERT INTO datasets (titulo, area_id, frecuencia_id, proxima_actualizacion, datos_al, tipo_pedido, tema_principal_id,
       tipo_gestion, url_dataset, activo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'https://datos.comodoro.gov.ar/dataset/test', 1)`,
    [`${PREFIJO_TEST} fechas ${clave}`, cat.areaId, frecuenciaId, proxima, datosAl, tipoPedido, cat.temaId, gestion]
  );
  ids[clave] = resultado.insertId;
};

before(async () => {
  servidor = await iniciarServidor();
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, { admin: 'admin', lector: 'lector' });
  cat = await catalogos();

  await cargarDataset({ clave: 'trimestral', frecuencia: 'Trimestralmente', proxima: '2027-01-31', datosAl: '2026-07-31' });
  await cargarDataset({
    clave: 'foto', frecuencia: 'Cada medio año', gestion: 'interna', proxima: '2027-06-30', datosAl: '2026-12-31', tipoPedido: 'foto'
  });
  await cargarDataset({ clave: 'no-fin-de-mes', frecuencia: 'Mensualmente', proxima: '2026-03-29' });
  await cargarDataset({ clave: 'cero', frecuencia: 'Mensualmente', proxima: '0000-00-00' });
  await cargarDataset({ clave: 'sin-proxima', frecuencia: 'Mensualmente' });
  await cargarDataset({ clave: 'eventual', frecuencia: 'Eventual' });
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
});

const admin = () => ({ token: usuarios.admin.token });
const lector = () => ({ token: usuarios.lector.token });

describe('GET /datasets/:id: las fechas de un dataset', () => {
  it('trae Datos al, el tipo de pedido, la frecuencia en meses, el pedido y el estado', async () => {
    const res = await api.get(`/datasets/${ids.trimestral}`);
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.equal(d.datos_al, '2026-07-31');
    assert.equal(d.tipo_pedido, 'acumulado');
    assert.equal(d.tipo_pedido_guardado, null);
    assert.equal(d.frecuencia_meses, 3);
    assert.equal(d.pedido.texto, 'Del 01/01/2026 al 31/12/2026');
    assert.equal(d.pedido.desde, '2026-01-01');
    assert.equal(d.pedido.hasta, '2026-12-31');
    const esperado = estadoDelDataset({ proxima: '2027-01-31', meses: 3, tipoGestion: 'externa', hoy: hoyArgentina() });
    assert.equal(d.estado, esperado.estado);
    assert.equal(d.dias_para_vencer, esperado.dias);
  });

  it('no cambia los campos de siempre: las fechas de la próxima y de la última siguen viajando como hasta ahora', async () => {
    const d = (await api.get(`/datasets/${ids.trimestral}`)).body.data;
    assert.equal(d.titulo, `${PREFIJO_TEST} fechas trimestral`);
    assert.equal(d.frecuencia_nombre, 'Trimestralmente');
    assert.equal(d.frecuencia_dias, 90);
    assert.equal(d.tipo_gestion, 'externa');
    assert.match(d.proxima_actualizacion, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok('ultima_actualizacion' in d);
    assert.ok(Array.isArray(d.formatos_array));
  });

  it('no deja los auxiliares del SELECT en la respuesta', async () => {
    const d = (await api.get(`/datasets/${ids.trimestral}`)).body.data;
    for (const auxiliar of ['proxima_iso', 'datos_al_iso']) assert.ok(!(auxiliar in d), auxiliar);
  });

  it('con un tipo guardado, el efectivo es ese y el guardado también', async () => {
    const d = (await api.get(`/datasets/${ids.foto}`)).body.data;
    assert.equal(d.tipo_pedido, 'foto');
    assert.equal(d.tipo_pedido_guardado, 'foto');
    assert.equal(d.frecuencia_meses, 6);
    assert.equal(d.pedido.texto, 'Vigente al 31/05/2027');
  });

  it('un dataset eventual da estado eventual y ningún pedido', async () => {
    const d = (await api.get(`/datasets/${ids.eventual}`)).body.data;
    assert.equal(d.estado, 'eventual');
    assert.equal(d.tipo_pedido, 'eventual');
    assert.equal(d.tipo_pedido_guardado, null);
    assert.equal(d.frecuencia_meses, null);
    assert.equal(d.pedido, null);
    assert.equal(d.dias_para_vencer, null);
    assert.equal(d.datos_al, null);
  });

  it('un dataset que no existe da 404', async () => {
    assert.equal((await api.get('/datasets/999999999')).status, 404);
  });
});

describe('GET /datasets: datos viejos o raros no lo rompen', () => {
  let lista;
  before(async () => {
    const res = await api.get('/datasets');
    assert.equal(res.status, 200);
    lista = res.body.data;
  });
  const dataset = (clave) => lista.find(d => d.id === ids[clave]);

  it('trae las fechas nuevas de cada dataset', () => {
    const d = dataset('trimestral');
    assert.equal(d.datos_al, '2026-07-31');
    assert.equal(d.tipo_pedido, 'acumulado');
    assert.equal(d.frecuencia_meses, 3);
    assert.equal(d.pedido.texto, 'Del 01/01/2026 al 31/12/2026');
    assert.ok(typeof d.estado === 'string');
  });

  it('una próxima que no es fin de mes cuenta como el fin de su mes y el dataset figura vencido', () => {
    const d = dataset('no-fin-de-mes');
    assert.equal(d.estado, 'sin-respuesta');
    assert.ok(d.dias_para_vencer < 0);
    assert.equal(typeof d.pedido.texto, 'string');
    assert.equal(d.datos_al, null);
    assert.equal(d.tipo_pedido, 'acumulado');
  });

  it('una próxima 0000-00-00 da pedido nulo y sin fecha', () => {
    const d = dataset('cero');
    assert.equal(d.pedido, null);
    assert.equal(d.estado, 'sin-fecha');
    assert.equal(d.dias_para_vencer, null);
  });

  it('sin próxima da pedido nulo y sin fecha', () => {
    const d = dataset('sin-proxima');
    assert.equal(d.pedido, null);
    assert.equal(d.estado, 'sin-fecha');
    assert.equal(d.dias_para_vencer, null);
  });

  it('un eventual da estado eventual', () => {
    const d = dataset('eventual');
    assert.equal(d.estado, 'eventual');
    assert.equal(d.tipo_pedido, 'eventual');
    assert.equal(d.pedido, null);
  });

  it('el filtro por estado de siempre sigue funcionando', async () => {
    const res = await api.get('/datasets?estado=sin-respuesta');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.some(d => d.id === ids['no-fin-de-mes']));
  });
});

describe('GET /datasets/:id/opciones-proxima', () => {
  const opciones = (id, datosAl, quien = admin()) =>
    api.get(`/datasets/${id}/opciones-proxima${datosAl === undefined ? '' : `?datos_al=${datosAl}`}`, quien);

  it('con datos al 30/09/2026 sugiere el 30/04/2027 y ofrece mantener el 31/01/2027', async () => {
    const res = await opciones(ids.trimestral, '2026-09-30');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const { pedido, opciones: lista } = res.body.data;
    assert.equal(lista[0].fecha, '2027-04-30');
    assert.equal(lista[0].sugerida, true);
    assert.equal(lista[0].motivo, 'Siguiente período');
    assert.equal(lista[0].pideDespues, 'Del 01/10/2026 al 31/03/2027');
    const mantener = lista.find(o => o.fecha === '2027-01-31');
    assert.ok(mantener, 'tiene que ofrecer mantener el vencimiento actual');
    assert.equal(mantener.sugerida, false);
    assert.match(mantener.motivo, /^Mantener/);
    // El pedido es el del vencimiento actual, con los datos que ya tiene publicados el dataset
    assert.equal(pedido.texto, 'Del 01/01/2026 al 31/12/2026');
  });

  it('sin token da 401 y con un lector, 403', async () => {
    assert.equal((await opciones(ids.trimestral, '2026-09-30', {})).status, 401);
    assert.equal((await opciones(ids.trimestral, '2026-09-30', lector())).status, 403);
  });

  it('un dataset que no existe da 404', async () => {
    assert.equal((await opciones(999999999, '2026-09-30')).status, 404);
  });

  it('sin datos_al, con uno inválido o que no es fin de mes da 400', async () => {
    for (const datosAl of [undefined, '', 'abc', '2026-02-30', '2026-09-15', '2028-02-29']) {
      const res = await opciones(ids.trimestral, datosAl);
      assert.equal(res.status, 400, `datos_al=${datosAl}`);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error);
    }
  });

  it('con un datos_al posterior al tope (el fin del mes actual) da 400', async () => {
    const res = await opciones(ids.trimestral, '2099-12-31');
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Todavía no puede haber datos al 31\/12\/2099/);
  });

  it('un eventual y un dataset sin próxima no tienen opciones', async () => {
    for (const clave of ['eventual', 'sin-proxima']) {
      const res = await opciones(ids[clave], '2026-09-30');
      assert.equal(res.status, 200, clave);
      assert.deepEqual(res.body.data.opciones, [], clave);
      assert.equal(res.body.data.pedido, null, clave);
    }
  });
});

describe('GET /datasets/calculo-pedido', () => {
  const calculo = (consulta, quien = admin()) => api.get(`/datasets/calculo-pedido${consulta}`, quien);

  it('una foto cada 24 meses con próxima 31/03/2027 pide "Vigente al 28/02/2027"', async () => {
    const res = await calculo('?tipo=foto&meses=24&proxima=2027-03-31');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.pedido.texto, 'Vigente al 28/02/2027');
  });

  it('con Datos al, pide todo lo que falta', async () => {
    const res = await calculo('?tipo=acumulado&meses=12&proxima=2027-01-31&datos_al=2024-12-31');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.pedido.texto, 'Del 01/01/2025 al 31/12/2026');
  });

  it('un tipo sin meses (edición, relevamiento) no necesita la frecuencia', async () => {
    const res = await calculo('?tipo=edicion&meses=&proxima=2027-03-31');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.pedido.texto, 'Próxima edición disponible');
  });

  it('sin próxima o con un eventual, el pedido es null', async () => {
    assert.equal((await calculo('?tipo=acumulado&meses=3')).body.data.pedido, null);
    assert.equal((await calculo('?tipo=acumulado&meses=3&proxima=')).body.data.pedido, null);
    const eventual = await calculo('?tipo=eventual&proxima=2027-03-31');
    assert.equal(eventual.status, 200);
    assert.equal(eventual.body.data.pedido, null);
  });

  it('sin token da 401 y con un lector, 403 (la ruta no la toma /datasets/:id)', async () => {
    assert.equal((await calculo('?tipo=foto&meses=24&proxima=2027-03-31', {})).status, 401);
    assert.equal((await calculo('?tipo=foto&meses=24&proxima=2027-03-31', lector())).status, 403);
  });

  it('un tipo que falta o que no existe da 400', async () => {
    for (const consulta of ['', '?tipo=', '?tipo=inventado&meses=3&proxima=2027-03-31', '?tipo=foto&tipo=acumulado']) {
      const res = await calculo(consulta);
      assert.equal(res.status, 400, consulta);
      assert.equal(res.body.success, false);
    }
  });

  it('meses, próxima o Datos al inválidos dan 400', async () => {
    for (const consulta of [
      '?tipo=foto&meses=abc', '?tipo=foto&meses=2.5', '?tipo=foto&meses=0', '?tipo=foto&meses=-3', '?tipo=foto&meses=3&meses=6',
      '?tipo=foto&meses=3&proxima=2027-02-30', '?tipo=foto&meses=3&proxima=mañana',
      '?tipo=foto&meses=3&proxima=2027-03-31&datos_al=2026-13-01'
    ]) {
      const res = await calculo(consulta);
      assert.equal(res.status, 400, consulta);
      assert.ok(res.body.error, consulta);
    }
  });
});

describe('API.calculoPedido y API.opcionesDeProxima (api.js)', () => {
  // api.js es un script de navegador: se ejecuta en un contexto aislado con un fetch que anota los pedidos
  const cargarApi = (respuesta = { ok: true, json: async () => ({ success: true, data: { pedido: null } }) }) => {
    const pedidos = [];
    const contexto = vm.createContext({
      CONFIG: { API_URL: '/api' },
      Auth: { getAuthHeaders: () => ({ Authorization: 'Bearer X' }) },
      fetch: async (url, opciones) => { pedidos.push({ url, opciones }); return respuesta; },
      URLSearchParams, console
    });
    const codigo = fs.readFileSync(new URL('../public/js/api.js', import.meta.url), 'utf8');
    vm.runInContext(`${codigo}\n;globalThis.API = API;`, contexto);
    return { API: contexto.API, pedidos };
  };

  it('calculoPedido pide /datasets/calculo-pedido con los parámetros que vienen y la sesión', async () => {
    const { API, pedidos } = cargarApi();
    await API.calculoPedido({ tipo: 'foto', meses: 24, proxima: '2027-03-31', datos_al: '2026-09-30' });
    assert.equal(pedidos[0].url, '/api/datasets/calculo-pedido?tipo=foto&meses=24&proxima=2027-03-31&datos_al=2026-09-30');
    assert.equal(pedidos[0].opciones.headers.Authorization, 'Bearer X');
  });

  it('calculoPedido no manda los parámetros vacíos y devuelve data', async () => {
    const { API, pedidos } = cargarApi({ ok: true, json: async () => ({ success: true, data: { pedido: { texto: 'X' } } }) });
    const data = await API.calculoPedido({ tipo: 'edicion', meses: null, proxima: '', datos_al: undefined });
    assert.equal(pedidos[0].url, '/api/datasets/calculo-pedido?tipo=edicion');
    assert.deepEqual(data, { pedido: { texto: 'X' } });
  });

  it('opcionesDeProxima pide /datasets/:id/opciones-proxima y devuelve data', async () => {
    const { API, pedidos } = cargarApi({ ok: true, json: async () => ({ success: true, data: { pedido: null, opciones: [] } }) });
    const data = await API.opcionesDeProxima(7, '2026-09-30');
    assert.equal(pedidos[0].url, '/api/datasets/7/opciones-proxima?datos_al=2026-09-30');
    assert.equal(pedidos[0].opciones.headers.Authorization, 'Bearer X');
    assert.deepEqual(data, { pedido: null, opciones: [] });
  });

  it('si el servidor responde con error, lanza un Error con su mensaje', async () => {
    const { API } = cargarApi({ ok: false, json: async () => ({ success: false, error: 'Todavía no puede haber datos al 31/12/2099.' }) });
    await assert.rejects(() => API.opcionesDeProxima(7, '2099-12-31'), { message: 'Todavía no puede haber datos al 31/12/2099.' });
    await assert.rejects(() => API.calculoPedido({ tipo: 'x' }), { message: 'Todavía no puede haber datos al 31/12/2099.' });
  });
});
