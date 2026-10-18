// API de las fechas de un dataset (spec 2026-10-17-fechas-datasets, secciones 7 y 10): lo que suman GET /datasets y
// GET /datasets/:id (Datos al, tipo de pedido, pedido, estado) y los dos cálculos para la pantalla de admin
// (opciones-proxima y calculo-pedido). Los datasets de prueba se cargan por SQL, con el prefijo [TEST].
// El servidor usa siempre el hoy real (hoyArgentina), y R7 mueve el pedido cuando pasa el vencimiento: por eso las
// fechas de los fixtures salen de hoy (en meses a partir del fin del mes actual) y los textos esperados se arman con
// la forma de cada pedido. Los valores fijos de la spec están en fechas-reglas.test.js, que pasa hoy como parámetro.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import {
  iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, catalogos, query, PREFIJO_TEST
} from './helpers.js';
import { diasEntre, formatoCorto, hoyArgentina } from '../services/notasDigitalesCalendario.js';
import { sumarMeses, vencimientoDelMes } from '../services/fechasDatasetReglas.js';

let servidor, api, usuarios, cat;
const ids = {};

const HOY = hoyArgentina();
const FIN_DE_MES = vencimientoDelMes(HOY);
// El fin de mes que está n meses después del actual (n = 0 es el actual)
const enMeses = (n) => sumarMeses(FIN_DE_MES, n);
const anioDe = (iso) => Number(iso.slice(0, 4));

// Pauta trimestral (acumulado): vence dentro de 3 meses, así que todavía no pasó ningún vencimiento del ciclo (R7 no
// mueve nada). Se piden los datos del año del corte, hasta el corte; los últimos publicados son del 31/12 anterior.
const PAUTA = {
  proxima: enMeses(3),
  corte: enMeses(2),
  anio: anioDe(enMeses(2)),
  datosAl: `${anioDe(enMeses(2)) - 1}-12-31`,
  texto: `Del 01/01/${anioDe(enMeses(2))} al ${formatoCorto(enMeses(2))}`
};

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

  await cargarDataset({ clave: 'trimestral', frecuencia: 'Trimestralmente', proxima: PAUTA.proxima, datosAl: PAUTA.datosAl });
  await cargarDataset({
    clave: 'foto', frecuencia: 'Cada medio año', gestion: 'interna', proxima: enMeses(2), datosAl: enMeses(-6), tipoPedido: 'foto'
  });
  // Un vencimiento viejo que no es fin de mes: siempre en el pasado
  await cargarDataset({ clave: 'no-fin-de-mes', frecuencia: 'Mensualmente', proxima: '2026-03-29' });
  // Fechas en cero (la base local no es estricta): ni la próxima ni Datos al son fechas
  await cargarDataset({ clave: 'cero', frecuencia: 'Mensualmente', proxima: '0000-00-00', datosAl: '0000-00-00' });
  await cargarDataset({ clave: 'sin-proxima', frecuencia: 'Mensualmente' });
  await cargarDataset({ clave: 'eventual', frecuencia: 'Eventual' });
  // Un presupuesto: Datos al es el 31/12 del ejercicio publicado
  await cargarDataset({
    clave: 'ejercicio', frecuencia: 'Anualmente', proxima: enMeses(3), datosAl: `${anioDe(HOY) - 1}-12-31`, tipoPedido: 'ejercicio'
  });
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
    assert.equal(d.datos_al, PAUTA.datosAl);
    assert.equal(d.tipo_pedido, 'acumulado');
    assert.equal(d.tipo_pedido_nombre, 'Acumulado');
    assert.equal(d.tipo_pedido_guardado, null);
    assert.equal(d.frecuencia_meses, 3);
    assert.equal(d.pedido.texto, PAUTA.texto);
    assert.equal(d.pedido.desde, `${PAUTA.anio}-01-01`);
    assert.equal(d.pedido.hasta, PAUTA.corte);
    // Vence dentro de 3 meses: faltan entre 89 y 92 días, más de los 60 del "próximo a vencer"
    assert.equal(d.dias_para_vencer, diasEntre(HOY, PAUTA.proxima));
    assert.ok(d.dias_para_vencer > 60);
    assert.equal(d.estado, 'actualizado');
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
    assert.equal(d.tipo_pedido_nombre, 'Foto al corte');
    assert.equal(d.tipo_pedido_guardado, 'foto');
    assert.equal(d.frecuencia_meses, 6);
    // La foto es al corte: el fin del mes anterior al vencimiento
    assert.equal(d.pedido.texto, `Vigente al ${formatoCorto(enMeses(1))}`);
  });

  it('un dataset eventual da estado eventual y ningún pedido', async () => {
    const d = (await api.get(`/datasets/${ids.eventual}`)).body.data;
    assert.equal(d.estado, 'eventual');
    assert.equal(d.tipo_pedido, 'eventual');
    assert.equal(d.tipo_pedido_nombre, 'Eventual');
    assert.equal(d.tipo_pedido_guardado, null);
    assert.equal(d.frecuencia_meses, null);
    assert.equal(d.pedido, null);
    assert.equal(d.dias_para_vencer, null);
    assert.equal(d.datos_al, null);
  });

  it('un Datos al en cero sale como null, no como el texto 0000-00-00', async () => {
    const d = (await api.get(`/datasets/${ids.cero}`)).body.data;
    assert.equal(d.datos_al, null);
    assert.equal(d.pedido, null);
    assert.equal(d.estado, 'sin-fecha');
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
    assert.equal(d.datos_al, PAUTA.datosAl);
    assert.equal(d.tipo_pedido, 'acumulado');
    assert.equal(d.tipo_pedido_nombre, 'Acumulado');
    assert.equal(d.frecuencia_meses, 3);
    assert.equal(d.pedido.texto, PAUTA.texto);
    assert.equal(d.estado, 'actualizado');
    assert.equal(d.dias_para_vencer, diasEntre(HOY, PAUTA.proxima));
  });

  it('una próxima que no es fin de mes cuenta como el fin de su mes y el dataset figura vencido', () => {
    const d = dataset('no-fin-de-mes');
    assert.equal(d.estado, 'sin-respuesta');
    assert.ok(d.dias_para_vencer < 0);
    assert.equal(typeof d.pedido.texto, 'string');
    assert.equal(d.datos_al, null);
    assert.equal(d.tipo_pedido, 'acumulado');
  });

  it('una próxima y un Datos al 0000-00-00 dan pedido nulo, sin fecha y Datos al null', () => {
    const d = dataset('cero');
    assert.equal(d.pedido, null);
    assert.equal(d.estado, 'sin-fecha');
    assert.equal(d.dias_para_vencer, null);
    assert.equal(d.datos_al, null);
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
    assert.equal(d.tipo_pedido_nombre, 'Eventual');
    assert.equal(d.pedido, null);
  });

  it('el filtro por estado de siempre sigue funcionando', async () => {
    const res = await api.get('/datasets?estado=sin-respuesta');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.some(d => d.id === ids['no-fin-de-mes']));
  });

  it('el filtro por estado acepta eventual, y los eventuales ya no son actualizados', async () => {
    const eventuales = (await api.get('/datasets?estado=eventual')).body.data;
    assert.ok(eventuales.some(d => d.id === ids.eventual));
    assert.ok(eventuales.every(d => d.estado === 'eventual'));
    const actualizados = (await api.get('/datasets?estado=actualizado')).body.data;
    assert.ok(actualizados.some(d => d.id === ids.trimestral));
    assert.ok(!actualizados.some(d => d.id === ids.eventual));
    assert.ok(actualizados.every(d => d.estado === 'actualizado'));
  });

  it('sin-fecha filtra a los que no tienen próxima', async () => {
    const sinFecha = (await api.get('/datasets?estado=sin-fecha')).body.data;
    assert.ok(sinFecha.some(d => d.id === ids['sin-proxima']));
    assert.ok(sinFecha.some(d => d.id === ids.cero));
    assert.ok(sinFecha.every(d => d.estado === 'sin-fecha'));
  });

  it('las estadísticas cuentan con el mismo estado que el listado, y la tasa deja afuera a los eventuales', async () => {
    const porEstado = {};
    for (const d of lista) porEstado[d.estado] = (porEstado[d.estado] ?? 0) + 1;
    const cuenta = (estado) => porEstado[estado] ?? 0;
    const e = (await api.get('/datasets/estadisticas')).body.data;
    assert.equal(e.total, lista.length);
    assert.equal(e.actualizados, cuenta('actualizado'));
    assert.equal(e.proximos, cuenta('proximo'));
    assert.equal(e.atrasados, cuenta('atrasado'));
    assert.equal(e.sinRespuesta, cuenta('sin-respuesta'));
    assert.equal(e.sinFecha, cuenta('sin-fecha'));
    assert.equal(e.eventuales, cuenta('eventual'));
    assert.ok(e.eventuales >= 1);
    assert.equal(e.tasaActualizacion, Math.round(((e.actualizados + e.proximos) / (e.total - e.eventuales)) * 100));
  });
});

describe('GET /datasets/:id/opciones-proxima', () => {
  const opciones = (id, datosAl, quien = admin()) =>
    api.get(`/datasets/${id}/opciones-proxima${datosAl === undefined ? '' : `?datos_al=${datosAl}`}`, quien);

  // Llegaron datos hasta el fin del mes pasado: no cubren el corte de la Pauta (dos meses adelante)
  const DATOS_NUEVOS = enMeses(-1);

  it('con datos que no alcanzan, sugiere el siguiente período y ofrece mantener el vencimiento actual', async () => {
    const res = await opciones(ids.trimestral, DATOS_NUEVOS);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const { pedido, opciones: lista } = res.body.data;

    const siguiente = enMeses(6);
    assert.equal(lista[0].fecha, siguiente);
    assert.equal(lista[0].sugerida, true);
    assert.equal(lista[0].motivo, 'Siguiente período');
    // La nota siguiente pide desde el 1° del mes siguiente a lo que llegó (o desde enero, si eso es anterior) hasta su corte
    const corteSiguiente = enMeses(5);
    const desde = [`${FIN_DE_MES.slice(0, 8)}01`, `${anioDe(corteSiguiente)}-01-01`].sort()[0];
    assert.equal(lista[0].pideDespues, `Del ${formatoCorto(desde)} al ${formatoCorto(corteSiguiente)}`);

    const mantener = lista.find(o => o.fecha === PAUTA.proxima);
    assert.ok(mantener, 'tiene que ofrecer mantener el vencimiento actual');
    assert.equal(mantener.sugerida, false);
    assert.match(mantener.motivo, /^Mantener/);
    assert.equal(mantener.advertencia, null);
    assert.equal(lista.length, 2);
    // El pedido es el del vencimiento actual, con los datos que ya tiene publicados el dataset
    assert.equal(pedido.texto, PAUTA.texto);
  });

  it('sin token da 401 y con un lector, 403', async () => {
    assert.equal((await opciones(ids.trimestral, DATOS_NUEVOS, {})).status, 401);
    assert.equal((await opciones(ids.trimestral, DATOS_NUEVOS, lector())).status, 403);
  });

  it('un dataset que no existe da 404', async () => {
    assert.equal((await opciones(999999999, DATOS_NUEVOS)).status, 404);
  });

  it('sin datos_al, con uno inválido o que no es fin de mes da 400', async () => {
    for (const datosAl of [undefined, '', 'abc', '2026-02-30', '2026-09-15', '2028-02-29']) {
      const res = await opciones(ids.trimestral, datosAl);
      assert.equal(res.status, 400, `datos_al=${datosAl}`);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error);
    }
  });

  it('el tope de Datos al es el fin del mes actual: ese día se acepta y el mes siguiente da 400', async () => {
    assert.equal((await opciones(ids.trimestral, FIN_DE_MES)).status, 200);
    for (const datosAl of [enMeses(1), '2099-12-31']) {
      const res = await opciones(ids.trimestral, datosAl);
      assert.equal(res.status, 400, datosAl);
      assert.equal(res.body.error, `Todavía no puede haber datos al ${formatoCorto(datosAl)}`);
    }
  });

  it('en un presupuesto (ejercicio), un Datos al que no es 31/12 da 400 y el 31/12 del año siguiente es el tope', async () => {
    const anio = anioDe(HOY);
    const res = await opciones(ids.ejercicio, `${anio}-06-30`);
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'En un presupuesto, Datos al tiene que ser el 31/12 del ejercicio publicado');
    assert.equal((await opciones(ids.ejercicio, `${anio + 1}-12-31`)).status, 200);
    const futuro = await opciones(ids.ejercicio, `${anio + 2}-12-31`);
    assert.equal(futuro.status, 400);
    assert.equal(futuro.body.error, `Todavía no puede haber datos al 31/12/${anio + 2}`);
  });

  it('un eventual y un dataset sin próxima no tienen opciones', async () => {
    for (const clave of ['eventual', 'sin-proxima']) {
      const res = await opciones(ids[clave], DATOS_NUEVOS);
      assert.equal(res.status, 200, clave);
      assert.deepEqual(res.body.data.opciones, [], clave);
      assert.equal(res.body.data.pedido, null, clave);
    }
  });
});

describe('GET /datasets/calculo-pedido', () => {
  const calculo = (consulta, quien = admin()) => api.get(`/datasets/calculo-pedido${consulta}`, quien);

  it('una foto cada 24 meses con próxima el 31/03 pide "Vigente al 28/02", también en un año bisiesto', async () => {
    // El próximo 31 de marzo que no pasó (o el de hoy)
    const anio = HOY <= `${anioDe(HOY)}-03-31` ? anioDe(HOY) : anioDe(HOY) + 1;
    const res = await calculo(`?tipo=foto&meses=24&proxima=${anio}-03-31`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.pedido.texto, `Vigente al 28/02/${anio}`);
    assert.equal(res.body.data.pedido.hasta, `${anio}-02-28`);
    // Y en el año bisiesto 2028 también
    const bisiesto = await calculo('?tipo=foto&proxima=2028-03-31');
    assert.equal(bisiesto.body.data.pedido.texto, 'Vigente al 28/02/2028');
  });

  it('con Datos al, pide todo lo que falta', async () => {
    const proxima = enMeses(3);
    const anio = anioDe(enMeses(2));
    const res = await calculo(`?tipo=acumulado&meses=12&proxima=${proxima}&datos_al=${anio - 2}-12-31`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.pedido.texto, `Del 01/01/${anio - 1} al ${formatoCorto(enMeses(2))}`);
  });

  it('un tipo sin meses (edición, relevamiento) no necesita la frecuencia', async () => {
    const res = await calculo(`?tipo=edicion&meses=&proxima=${enMeses(3)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.pedido.texto, 'Próxima edición disponible');
  });

  it('sin próxima o con un eventual, el pedido es null', async () => {
    assert.equal((await calculo('?tipo=acumulado&meses=3')).body.data.pedido, null);
    assert.equal((await calculo('?tipo=acumulado&meses=3&proxima=')).body.data.pedido, null);
    const eventual = await calculo(`?tipo=eventual&proxima=${enMeses(3)}`);
    assert.equal(eventual.status, 200);
    assert.equal(eventual.body.data.pedido, null);
  });

  it('sin token da 401 y con un lector, 403 (la ruta no la toma /datasets/:id)', async () => {
    const consulta = `?tipo=foto&meses=24&proxima=${enMeses(3)}`;
    assert.equal((await calculo(consulta, {})).status, 401);
    assert.equal((await calculo(consulta, lector())).status, 403);
  });

  it('un tipo que falta o que no existe da 400', async () => {
    for (const consulta of ['', '?tipo=', `?tipo=inventado&meses=3&proxima=${enMeses(3)}`, '?tipo=foto&tipo=acumulado']) {
      const res = await calculo(consulta);
      assert.equal(res.status, 400, consulta);
      assert.equal(res.body.success, false);
    }
  });

  it('meses, próxima o Datos al inválidos dan 400', async () => {
    for (const consulta of [
      '?tipo=foto&meses=abc', '?tipo=foto&meses=2.5', '?tipo=foto&meses=0', '?tipo=foto&meses=-3', '?tipo=foto&meses=3&meses=6',
      '?tipo=foto&meses=3&proxima=2027-02-30', '?tipo=foto&meses=3&proxima=mañana',
      `?tipo=foto&meses=3&proxima=${enMeses(3)}&datos_al=2026-13-01`
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
