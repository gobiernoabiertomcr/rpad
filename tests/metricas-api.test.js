// API de métricas (spec 2026-10-24-metricas-y-reportes, 1.5 a 1.7, 2.3 y 3): GET /api/metricas la ven todos los roles con sesión
// (también el lector y el colaborador); sin sesión, 401. Los parámetros raros caen a los de entrada y un año sin métricas da 404 en
// JSON. Contra una base de prueba propia, con datos inventados. El servidor corre con el reloj de verdad: lo que depende del día (un
// año cerrado con su foto o todavía sin ella) se prueba con metricasDe y un hoy fijo, como la foto (sacarFotoSiCorresponde). La foto
// se guarda con datosDeLaFoto y un INSERT: nunca /api/cron/*. Las opciones del pedido, puras, en tests/metricas-opciones.test.js. Al
// final, el Informe anual (GET /api/reportes/informe-anual), que sale solo de la foto: no depende del día.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { crearDataset, limpiarBase } from './notas-fixtures.js';
import {
  ESTADISTICOS, DIAS, casosDe, vistaDe, duracion, cifraDe, indiceMesAMes, antiguedadDeVencidos, estadosAl, trabajoDelAnio, areasYTemas
} from '../services/metricasReglas.js';
import { hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';
import { disposicionDeAdjunto } from '../services/seguimientoReglas.js';
import { lineasPorHoja, HOJA_A4, todasDelTamano } from './pdf-lector.js';

const AL = '2026-12-31';
const CLAVES_DE_DATA = ['anio', 'al', 'en_vivo', 'aviso_foto', 'anios', 'fotos', 'vista', 'cinta', 'contexto', 'trabajo', 'areas', 'sin_titulos'];
const COMBINACIONES = ESTADISTICOS.flatMap((estadistico) => DIAS.map((dias) => ({ estadistico, dias })));
let base, servidor, api, usuarios, dbReal, controlador, seguimientoDatos, foto;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_metricas_api');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, { adminA: 'admin', lector: 'lector', colab: 'colaborador' });
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba
  controlador = await import('../controllers/metricasController.js');
  seguimientoDatos = await import('../services/seguimientoDatos.js');
  foto = await import('../services/metricasFoto.js');
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  await servidor?.detener();
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  // limpiarBase comprueba que la base es de prueba; los cambios se van con sus datasets
  await limpiarBase();
  await query('DELETE FROM metricas_fotos');
  // Las notas DGMIT no se van con sus datasets (solo sus filas de notas_dgmit_datasets)
  await query('DELETE FROM notas_dgmit');
});

const como = (clave) => ({ token: usuarios[clave].token });

// Instante de una fecha y hora de Argentina (UTC-3), en segundos: las columnas TIMESTAMP se cargan con FROM_UNIXTIME, que no
// depende de la zona horaria de la base (en Docker es UTC)
const instante = (texto) => Date.parse(`${texto.replace(' ', 'T')}-03:00`) / 1000;
const fijarAlta = (datasetId, momento) => query('UPDATE datasets SET created_at = FROM_UNIXTIME(?) WHERE id = ?', [instante(momento), datasetId]);

// Una actualización registrada y aprobada, como la deja aprobarCambio (los JSON como texto; los momentos, en segundos): la próxima
// pasa de `de` a `a` y la carga de `cargaAnterior` a `carga`, con su «Recibido el» y el origen de los datos del área
const actualizacion = ({ datasetId, creado, revisado, de, a, cargaAnterior, carga, recibido }) => query(
  `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, datos_anteriores, usuario_id, estado, revisor_id, created_at,
     revisado_at) VALUES ('editar', ?, ?, ?, ?, 'aprobado', ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))`,
  [datasetId, JSON.stringify({
    proxima_actualizacion: a, ultima_actualizacion: carga, registro_actualizacion: true, recibido_el: recibido, origen_datos: 'area'
  }), JSON.stringify({ proxima_actualizacion: de, ultima_actualizacion: cargaAnterior }), usuarios.adminA.id, usuarios.adminA.id,
  creado, revisado]
);

// Un email viejo a la DGMIT que se envió
const emailEnviado = ({ tipo, datasetId, enviado }) => query(
  `INSERT INTO notificaciones_log (tipo, area_id, destinatarios, datasets_ids, cantidad_datasets, enviado_at, success)
   VALUES (?, NULL, 'mit@rpad.test', ?, 1, FROM_UNIXTIME(?), 1)`,
  [tipo, String(datasetId), instante(enviado)]
);

const tramoDe = (data, gestion, clave) => data.vista.circuito[gestion].find((t) => t.clave === clave);

// Un año sin foto en `fotos` (lo que lee la tarjeta del Informe anual, Ruling 34): hasta el 10/01 del año siguiente, desde cuándo se
// descarga; después, que se reintenta
const sinFoto = (anio, hoy) => ({
  anio, con_foto: false, aviso_informe: hoy <= `${anio + 1}-01-10` ? `Disponible desde el 10/01/${anio + 1}`
    : `La foto de ${anio} todavía no se sacó: se reintenta en la próxima corrida.`
});

// ---------------------------------------------------------------------------------------------------------------------
// GET /api/metricas (con el servidor, en el año en curso)
// ---------------------------------------------------------------------------------------------------------------------

// Tres externos actualizados hoy con los datos recibidos hace 2, 5 y 30 días corridos (mediana 5, promedio 12, y otras cifras en días
// hábiles): la preparación y carga da otra cifra con cada combinación de los selectores, sea el día que sea. Y uno vencido. Los
// actualizados vencían el 31/12 del año anterior y ahora vencen el 31/12 del siguiente: el índice de hoy es 3 de 4, el 75 %.
const DIAS_DE_LOS_DATOS = [2, 5, 30];
const prepararHoy = async () => {
  // El momento de las aprobaciones, unos segundos antes del pedido: hoy es el de ese momento
  const ahora = Math.floor(Date.now() / 1000) - 5;
  const hoy = hoyArgentina(new Date(ahora * 1000));
  const anio = Number(hoy.slice(0, 4));
  const ids = [];
  for (const [i, dias] of DIAS_DE_LOS_DATOS.entries()) {
    const id = await crearDataset({
      titulo: `Actualizado ${i + 1}`, gestion: 'externa', requiereNota: 1, vencimiento: `${anio + 1}-12-31`, ultima: hoy
    });
    await fijarAlta(id, `${anio - 1}-06-01 10:00:00`);
    await actualizacion({
      datasetId: id, creado: ahora - 60, revisado: ahora, de: `${anio - 1}-12-31`, a: `${anio + 1}-12-31`,
      cargaAnterior: `${anio - 1}-01-15`, carga: hoy, recibido: sumarDias(hoy, -dias)
    });
    ids.push(id);
  }
  const vencido = await crearDataset({ titulo: 'Vencido', gestion: 'externa', requiereNota: 1, vencimiento: `${anio - 1}-12-31` });
  return { hoy, anio, ids, vencido };
};

// La cifra que se espera para la preparación y carga, con los días de DIAS_DE_LOS_DATOS hasta hoy
const cifraEsperada = (hoy, estadistico, dias, cuales = DIAS_DE_LOS_DATOS) =>
  cifraDe(cuales.map((d) => duracion(sumarDias(hoy, -d), hoy, dias)))[estadistico];

describe('GET /metricas', () => {
  it('GET /metricas con lector y con colaborador da 200; sin sesión, 401', async () => {
    const { hoy, anio } = await prepararHoy();
    for (const quien of ['lector', 'colab', 'adminA']) {
      const res = await api.get('/metricas', como(quien));
      assert.equal(res.status, 200, quien);
      assert.equal(res.body.success, true, quien);
      const { data } = res.body;
      assert.deepEqual(Object.keys(data), CLAVES_DE_DATA, quien);
      // El año en curso, en vivo al día de hoy
      assert.deepEqual([data.anio, data.al, data.en_vivo, data.aviso_foto, data.anios.at(-1)], [anio, hoy, true, null, anio], quien);
      // Cada año con su foto (sin fotos en la base, ninguno) y lo que dice el botón del Informe anual
      assert.deepEqual(data.fotos, data.anios.map((a) => sinFoto(a, hoy)), quien);
      assert.deepEqual(Object.keys(data.vista), ['circuito', 'resultados', 'casos', 'para_completar'], quien);
      assert.deepEqual(Object.keys(data.cinta), ['externa', 'interna'], quien);
      assert.deepEqual(Object.keys(data.contexto), ['indice', 'indice_vacio', 'antiguedad', 'estados'], quien);
      assert.deepEqual(data.sin_titulos, [], quien);
    }
    for (const token of [undefined, 'no-es-un-token']) {
      const res = await api.get('/metricas', { token });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    }
  });

  it('?anio=1999 da 404 en JSON', async () => {
    const anioActual = Number(hoyArgentina().slice(0, 4));
    // Antes del primer año, un año cerrado sin foto (2025 nunca la tiene) y uno futuro
    for (const anio of ['1999', '2025', String(anioActual + 1)]) {
      const res = await api.get(`/metricas?anio=${anio}`, como('lector'));
      assert.equal(res.status, 404, anio);
      assert.match(res.headers.get('content-type'), /^application\/json/);
      assert.deepEqual(res.body, { success: false, error: 'No hay métricas de ese año' }, anio);
    }
  });

  // Review Focus 2: lo raro se ignora, siempre con 200 y nunca con 500
  it('los parámetros raros caen a los de entrada, con 200: solo queda sin = [5]', async () => {
    // El dataset 5 es el vencido: los de este test se numeran desde 100 (la base de prueba está vacía y el DELETE no vuelve a numerar),
    // así el 5 queda libre, y el vencido no tiene nada colgado
    await query('ALTER TABLE datasets AUTO_INCREMENT = 100');
    const { hoy, anio, vencido } = await prepararHoy();
    await query('UPDATE datasets SET id = 5 WHERE id = ?', [vencido]);
    const deEntrada = await api.get('/metricas', como('lector'));
    const raro = await api.get('/metricas?anio=abc&sin=x,1e3,-2,5,5&estadistico=foo&dias=bar&gestion=z', como('lector'));
    assert.equal(raro.status, 200);
    // Lo mismo que pedir solo ?sin=5: el año en curso, mediana, días hábiles y el 5 destildado una vez
    assert.deepEqual(raro.body, (await api.get('/metricas?sin=5', como('lector'))).body);
    const { data } = raro.body;
    assert.deepEqual([data.anio, data.al, data.en_vivo, data.sin_titulos], [anio, hoy, true, ['Vencido']]);
    assert.equal(tramoDe(data, 'externa', 'carga').cifra.debajo, 'mediana de 3 ciclos');
    assert.deepEqual(tramoDe(data, 'externa', 'carga').cifra.valor, cifraEsperada(hoy, 'mediana', 'habiles'));
    // Sin el vencido, el contexto cuenta 3 y todos al día; sin destildar, 4 y el 75 %
    assert.deepEqual([data.contexto.estados.total, data.contexto.estados.tasa], [3, 100]);
    assert.deepEqual([deEntrada.body.data.contexto.estados.total, deEntrada.body.data.contexto.estados.tasa], [4, 75]);
    // Repetidos en la URL (llegan como lista) y un año con otra forma, igual
    const repetidos = await api.get('/metricas?anio=2026&anio=2027&estadistico=promedio&estadistico=mediana&sin[a]=1&dias[]=corridos', como('lector'));
    assert.equal(repetidos.status, 200);
    assert.deepEqual(repetidos.body, deEntrada.body);
  });

  it('?estadistico=promedio&dias=corridos cambia las cifras', async () => {
    const { hoy } = await prepararHoy();
    const carga = {};
    for (const { estadistico, dias } of COMBINACIONES) {
      const res = await api.get(`/metricas?estadistico=${estadistico}&dias=${dias}`, como('lector'));
      assert.equal(res.status, 200);
      carga[`${estadistico}-${dias}`] = tramoDe(res.body.data, 'externa', 'carga').cifra;
    }
    // En días corridos, la mediana de 2, 5 y 30 es 5 y el promedio, 12; en hábiles, otra cosa (5 días corridos son como mucho 5 hábiles)
    assert.deepEqual([carga['promedio-corridos'].valor, carga['promedio-corridos'].unidad, carga['promedio-corridos'].debajo],
      [12, 'días corridos', 'promedio de 3 ciclos']);
    assert.deepEqual([carga['mediana-corridos'].valor, carga['mediana-corridos'].debajo], [5, 'mediana de 3 ciclos']);
    for (const { estadistico, dias } of COMBINACIONES) {
      assert.equal(carga[`${estadistico}-${dias}`].valor, cifraEsperada(hoy, estadistico, dias), `${estadistico}-${dias}`);
    }
    assert.notEqual(carga['mediana-habiles'].valor, carga['promedio-corridos'].valor);
    assert.ok(carga['promedio-habiles'].valor < 12, JSON.stringify(carga));
  });

  it('?sin= destilda: no cuenta en las cifras, sus filas quedan con contar false y sin_titulos dice cuáles, en el orden pedido', async () => {
    const { hoy, ids, vencido } = await prepararHoy();
    const res = await api.get(`/metricas?sin=${ids[2]},999999,${vencido},${ids[2]}&estadistico=promedio&dias=corridos`, como('lector'));
    assert.equal(res.status, 200);
    const { data } = res.body;
    // El que no existe no va; los demás, en el orden pedido y una sola vez
    assert.deepEqual(data.sin_titulos, ['Actualizado 3', 'Vencido']);
    const cifra = tramoDe(data, 'externa', 'carga').cifra;
    assert.deepEqual([cifra.valor, cifra.ciclos], [cifraEsperada(hoy, 'promedio', 'corridos', [2, 5]), 2]);
    assert.deepEqual(data.vista.casos.map((fila) => [fila.dataset_id, fila.contar]), [[ids[0], true], [ids[1], true], [ids[2], false]]);
    // El contexto tampoco los cuenta: sin el vencido, todos al día
    assert.deepEqual([data.contexto.estados.total, data.contexto.estados.tasa], [2, 100]);
  });

  // El PDF de Métricas del año (spec 5): lo mismo que GET /metricas, con la misma consulta. Para todos los roles con sesión
  it('el lector lo descarga', async () => {
    const { anio, vencido } = await prepararHoy();
    const res = await api.get('/metricas/pdf', como('lector'));
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /^application\/pdf/);
    assert.equal(res.headers.get('content-disposition'), disposicionDeAdjunto(`Metricas-RPAD-${anio}.pdf`));
    assert.equal(res.body.subarray(0, 5).toString(), '%PDF-');
    assert.ok(todasDelTamano(res.body, HOJA_A4));
    const hojas = lineasPorHoja(res.body);
    hojas.forEach((lineas, k) => {
      assert.ok(lineas.includes(`Métricas del RPAD · ${anio} · Hoja ${k + 1} de ${hojas.length}`), `hoja ${k + 1}: ${lineas.join(' | ')}`);
      // «Generado el … por <nombre corto>», como el Estado general
      assert.ok(lineas.some((l) => /^Generado el \d{2}\/\d{2}\/\d{4} a las \d{2}:\d{2} por \S/.test(l)), `hoja ${k + 1}`);
    });
    assert.ok(hojas[0].includes('Mediana en días hábiles · con todos los datasets'), hojas[0].join(' | '));
    assert.ok(hojas[0].includes(`MÉTRICAS · AÑO ${anio}, EN CURSO`));
    // Con lo elegido y un destildado: lo dice la píldora y las cifras son las de GET /metricas con la misma consulta
    const consulta = `estadistico=promedio&dias=corridos&sin=${vencido}`;
    const [pdf, json] = await Promise.all([api.get(`/metricas/pdf?${consulta}`, como('lector')), api.get(`/metricas?${consulta}`, como('lector'))]);
    assert.equal(pdf.status, 200);
    const primera = lineasPorHoja(pdf.body)[0];
    assert.ok(primera.includes('Promedio en días corridos · calculado sin 1 dataset: Vencido'), primera.join(' | '));
    const carga = tramoDe(json.body.data, 'externa', 'carga').cifra;
    assert.ok(primera.join(' ').includes(`${carga.texto} ${carga.unidad}`.trim()), primera.join(' | '));
    assert.ok(primera.join(' ').includes(carga.debajo));
    // El colaborador también; sin sesión, 401; un año sin métricas, el 404 en JSON de la API
    assert.equal((await api.get('/metricas/pdf', como('colab'))).status, 200);
    for (const token of [undefined, 'no-es-un-token']) assert.equal((await api.get('/metricas/pdf', { token })).status, 401);
    const sinMetricas = await api.get('/metricas/pdf?anio=1999', como('lector'));
    assert.equal(sinMetricas.status, 404);
    assert.deepEqual(sinMetricas.body, { success: false, error: 'No hay métricas de ese año' });
  });

  // Las métricas manuales de Gestión (spec 2.2: van en «El trabajo del RPAD») del año del PDF; las de otro año, no
  it('el PDF trae las métricas manuales del año, que lee de la base', async () => {
    const { anio } = await prepararHoy();
    const sinNinguna = lineasPorHoja((await api.get('/metricas/pdf', como('lector'))).body).flat();
    assert.ok(sinNinguna.includes(`Todavía no hay métricas manuales cargadas en ${anio}.`));
    const insertar = (tipo, anioDeLaMetrica, mes, cantidad) => query(
      'INSERT INTO metricas_manuales (tipo, anio, mes, cantidad, created_by) VALUES (?, ?, ?, ?, ?)', [tipo, anioDeLaMetrica, mes, cantidad, usuarios.adminA.id]
    );
    try {
      await insertar('consultas_atendidas', anio, 1, 17);
      await insertar('notas_enviadas', anio - 1, 12, 5);
      const todo = lineasPorHoja((await api.get('/metricas/pdf', como('lector'))).body).flat();
      const i = todo.indexOf('Consultas atendidas');
      assert.deepEqual(todo.slice(i, i + 3), ['Consultas atendidas', `Enero ${anio}`, '17'], todo.join(' | '));
      assert.ok(!todo.includes('Notas enviadas fuera del RPAD'));
      assert.ok(!todo.includes(`Todavía no hay métricas manuales cargadas en ${anio}.`));
    } finally {
      await query('DELETE FROM metricas_manuales');
    }
  });

  // El antiobjetivo: que el índice diga una cosa en la portada y otra en Métricas
  it('el índice de hoy da lo mismo que la portada (GET /datasets/estadisticas)', async () => {
    const { hoy } = await prepararHoy();
    const [metricas, portada] = await Promise.all([api.get('/metricas', como('lector')), api.get('/datasets/estadisticas')]);
    assert.equal(portada.body.data.tasaActualizacion, 75);
    const { contexto } = metricas.body.data;
    // La etiqueta del eje: el mes si hoy es el primero de un mes; si no, «hoy» (o «31/12», el último día del año, que es el del año cerrado)
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const finDeAnio = hoy.endsWith('-12-31');
    const etiqueta = hoy.endsWith('-01') ? meses[Number(hoy.slice(5, 7)) - 1] : finDeAnio ? '31/12' : 'hoy';
    const cuando = finDeAnio ? `Al 31/12/${hoy.slice(0, 4)}` : 'Hoy';
    assert.deepEqual(contexto.indice.at(-1), { dia: hoy, tasa: 75, al_dia: 3, base: 4, etiqueta, texto: `${cuando}: 75% al día (3 de 4)` });
    assert.equal(contexto.indice_vacio, null);
    assert.deepEqual([contexto.estados.tasa, contexto.estados.actualizado, contexto.estados.vencidos], [75, 3, 1]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// metricasDe con un hoy fijo: un año cerrado, con su foto o todavía sin ella
// ---------------------------------------------------------------------------------------------------------------------

// Tres externos anuales con «Requiere nota DGMIT» Sí, dados de alta el 15/01/2026, que vencían el 30/06/2026 y se avisaron por la
// regla el 21/05/2026 (el email de 40 días). Los datos llegaron y se cargaron en fechas distintas (2, 7 y 30 días corridos después),
// así que la preparación y carga da otra cifra con cada combinación de los selectores.
const CARGAS = [['2026-06-10', '2026-06-12'], ['2026-06-15', '2026-06-22'], ['2026-07-01', '2026-07-31']];
const prepararElAnio = async () => {
  const ids = [];
  for (const [i, [recibido, carga]] of CARGAS.entries()) {
    const id = await crearDataset({
      titulo: `Dataset ${i + 1} de prueba`, gestion: 'externa', requiereNota: 1, vencimiento: '2027-06-30', ultima: carga
    });
    await fijarAlta(id, '2026-01-15 10:00:00');
    await emailEnviado({ tipo: 'externo-40', datasetId: id, enviado: '2026-05-21 08:15:00' });
    await actualizacion({
      datasetId: id, creado: instante(`${carga} 09:00:00`), revisado: instante(`${carga} 12:00:00`), de: '2026-06-30', a: '2027-06-30',
      cargaAnterior: '2025-06-15', carga, recibido
    });
    ids.push(id);
  }
  return ids;
};

// Lo que dan las reglas con las fuentes de hoy de la base, como lo calcula la foto (al 31/12 y con todos los datasets)
const metricasDeLasReglas = (fuentes, { estadistico, dias }) => {
  const casos = casosDe(fuentes, { hoy: AL });
  const opciones = { anio: 2026, al: AL };
  return {
    vista: vistaDe(casos, { ...opciones, estadistico, dias }),
    contexto: {
      indice: indiceMesAMes(fuentes, opciones), indice_vacio: null, antiguedad: antiguedadDeVencidos(fuentes, opciones),
      estados: estadosAl(fuentes, opciones)
    },
    trabajo: trabajoDelAnio(fuentes, casos, { ...opciones, estadistico }),
    areas: areasYTemas(fuentes, opciones)
  };
};

const guardarFoto = async (anio = 2026) => {
  const datos = foto.datosDeLaFoto(await seguimientoDatos.fuentesDe(null), { anio, generada: `${anio + 1}-01-10 08:15:00` });
  await query('INSERT INTO metricas_fotos (anio, al, datos) VALUES (?, ?, ?)', [anio, `${anio}-12-31`, JSON.stringify(datos)]);
  return (await foto.leerFoto(anio)).datos;
};

describe('metricasDe con un hoy fijo', () => {
  const metricas = (query, hoy) => controlador.metricasDe(query, { hoy });

  it('con una foto guardada, la vista sale de la foto aunque cambie la base', async () => {
    const ids = await prepararElAnio();
    const guardada = await guardarFoto();

    // La base cambia después de la foto: otro título, una nota DGMIT del 01/06/2026 y un dataset menos. Con la base de hoy, el año
    // 2026 ya no da lo mismo
    await query('UPDATE datasets SET titulo = ? WHERE id = ?', ['Otro título', ids[0]]);
    const notaDgmit = (await query("INSERT INTO notas_dgmit (numero, tipo, recibida, anulada) VALUES ('45/26', 'solicitud', '2026-06-01', 0)")).insertId;
    await query('INSERT INTO notas_dgmit_datasets (nota_id, dataset_id) VALUES (?, ?)', [notaDgmit, ids[1]]);
    await query('DELETE FROM datasets WHERE id = ?', [ids[2]]);
    const fuentesDeHoy = await seguimientoDatos.fuentesDe(null);

    for (const { estadistico, dias } of COMBINACIONES) {
      const clave = foto.claveDeLaVista(estadistico, dias);
      // Con destildados en la URL: en un año con foto no se destilda
      const data = await metricas({ anio: '2026', estadistico, dias, sin: `${ids[0]},${ids[1]}` }, '2027-03-01');
      assert.deepEqual(Object.keys(data), CLAVES_DE_DATA, clave);
      assert.deepEqual([data.anio, data.al, data.en_vivo, data.aviso_foto, data.anios, data.sin_titulos], [2026, AL, false, null, [2026, 2027], []], clave);
      assert.deepEqual(data.fotos, [{ anio: 2026, con_foto: true, aviso_informe: null }, sinFoto(2027, '2027-03-01')], clave);
      assert.deepEqual(data.vista, guardada.vistas[clave], clave);
      assert.deepEqual(data.cinta, guardada.cintas[clave], clave);
      assert.deepEqual(data.contexto, guardada.contexto, clave);
      assert.deepEqual(data.trabajo, guardada.trabajo[estadistico], clave);
      assert.deepEqual(data.areas, guardada.areas, clave);
      assert.ok(data.vista.casos.every((fila) => fila.contar), clave);
      // No se recalculó: con la base de hoy da otra cosa
      const deHoy = metricasDeLasReglas(fuentesDeHoy, { estadistico, dias });
      assert.notDeepEqual(data.vista, deHoy.vista, clave);
      assert.notDeepEqual(data.areas, deHoy.areas, clave);
    }
    const data = await metricas({ anio: '2026' }, '2027-03-01');
    assert.deepEqual(data.vista.casos.map((fila) => [fila.dataset_id, fila.titulo]),
      [[ids[0], 'Dataset 1 de prueba'], [ids[1], 'Dataset 2 de prueba'], [ids[2], 'Dataset 3 de prueba']]);
    assert.equal(tramoDe(data, 'externa', 'tramite').cifra, null);
    assert.ok(data.cinta.externa, 'la cinta externa se dibuja');

    // Las cifras de la foto también cambian con los selectores: la preparación y carga de 2, 7 y 30 días corridos
    const promedioCorridos = await metricas({ anio: '2026', estadistico: 'promedio', dias: 'corridos' }, '2027-03-01');
    assert.deepEqual([tramoDe(promedioCorridos, 'externa', 'carga').cifra.valor, tramoDe(data, 'externa', 'carga').cifra.valor],
      [13, cifraDe(CARGAS.map(([recibido, carga]) => duracion(recibido, carga, 'habiles'))).mediana]);
    assert.notEqual(tramoDe(data, 'externa', 'carga').cifra.valor, 13);
    assert.notDeepEqual(promedioCorridos.trabajo, data.trabajo);
    // El año en curso, en vivo con la base de hoy
    const enCurso = await metricas({}, '2027-03-01');
    assert.deepEqual([enCurso.anio, enCurso.al, enCurso.en_vivo, enCurso.aviso_foto], [2027, '2027-03-01', true, null]);
    // El año en curso también dice qué años tienen foto
    assert.deepEqual(enCurso.fotos.map((f) => [f.anio, f.con_foto]), [[2026, true], [2027, false]]);
  });

  // Spec 5: el PDF de un año con foto sale de la foto. El servidor de los tests corre con el reloj de verdad (en 2026 no hay ningún año
  // cerrado con métricas), así que se pide con pdfDeMetricas, lo que hace GET /api/metricas/pdf, con un momento fijo
  it('el PDF de un año con foto sale de la foto, aunque la base cambie después', async () => {
    const ids = await prepararElAnio();
    const guardada = await guardarFoto();
    await query('DELETE FROM datasets WHERE id = ?', [ids[2]]);
    const generado = { momento: '2027-03-01 10:00:00', por: 'Usuario Ejemplo' };
    const resultado = await controlador.pdfDeMetricas({ anio: '2026', estadistico: 'promedio', dias: 'corridos', sin: String(ids[0]) }, generado);
    assert.equal(resultado.anio, 2026);
    const hojas = lineasPorHoja(resultado.pdf);
    const primera = hojas[0].join(' ');
    assert.ok(hojas[0].includes('MÉTRICAS · AÑO 2026, AL 31/12/2026'), primera);
    assert.ok(primera.includes('Sale de la foto del 31/12/2026, calculada con todos los datasets.'), primera);
    // En un año con foto no se destilda
    assert.ok(hojas[0].includes('Promedio en días corridos · con todos los datasets'), primera);
    // La cifra de la carga es la de la foto (13 días corridos con los tres datasets); con la base de hoy serían dos
    const carga = guardada.vistas['promedio-corridos'].circuito.externa.find((t) => t.clave === 'carga').cifra;
    assert.deepEqual([carga.texto, carga.unidad, carga.debajo], ['13', 'días corridos', 'promedio de 3 ciclos']);
    assert.ok(primera.includes('13 días corridos') && primera.includes('promedio de 3 ciclos'), primera);
    hojas.forEach((lineas, k) => assert.ok(lineas.includes(`Métricas del RPAD · 2026 · Hoja ${k + 1} de ${hojas.length}`), `hoja ${k + 1}`));
    // Un año sin métricas: null (el 404 de la ruta)
    assert.equal(await controlador.pdfDeMetricas({ anio: '1999' }, generado), null);
  });

  // Ruling 17: un año cerrado sin foto nunca desaparece. Hasta el 10/01 del año siguiente el aviso dice cuándo se saca; después (la
  // corrida no pudo), que se reintenta
  it('un año cerrado sin foto va en vivo «al 31/12», con el aviso de la foto, y da lo mismo que la foto', async () => {
    const ids = await prepararElAnio();
    const fuentes = await seguimientoDatos.fuentesDe(null);
    const laQueSeVaASacar = foto.datosDeLaFoto(fuentes, { anio: 2026, generada: '2027-01-10 08:15:00' });
    const SE_SACA = 'La foto de 2026 se saca el 10/01/2027';
    const SE_REINTENTA = 'La foto de 2026 todavía no se sacó: se reintenta en la próxima corrida.';
    for (const [hoy, aviso, anios] of [['2027-01-01', SE_SACA, [2026, 2027]], ['2027-01-05', SE_SACA, [2026, 2027]],
      ['2027-01-10', SE_SACA, [2026, 2027]], ['2027-01-11', SE_REINTENTA, [2026, 2027]], ['2028-03-01', SE_REINTENTA, [2026, 2027, 2028]]]) {
      for (const { estadistico, dias } of COMBINACIONES) {
        const clave = `${hoy} ${foto.claveDeLaVista(estadistico, dias)}`;
        const data = await metricas({ anio: '2026', estadistico, dias }, hoy);
        assert.deepEqual([data.anio, data.al, data.en_vivo, data.aviso_foto, data.anios, data.sin_titulos],
          [2026, AL, true, aviso, anios, []], clave);
        assert.deepEqual(data.fotos, anios.map((a) => sinFoto(a, hoy)), clave);
        assert.deepEqual(data.vista, laQueSeVaASacar.vistas[foto.claveDeLaVista(estadistico, dias)], clave);
        assert.deepEqual(data.cinta, laQueSeVaASacar.cintas[foto.claveDeLaVista(estadistico, dias)], clave);
        assert.deepEqual(data.contexto, laQueSeVaASacar.contexto, clave);
        assert.deepEqual(data.trabajo, laQueSeVaASacar.trabajo[estadistico], clave);
        assert.deepEqual(data.areas, laQueSeVaASacar.areas, clave);
      }
    }
    // En vivo se puede destildar, también después del 10/01
    for (const hoy of ['2027-01-05', '2027-03-01']) {
      const sinUno = await metricas({ anio: '2026', sin: `${ids[0]},999999,${ids[0]}` }, hoy);
      assert.deepEqual(sinUno.sin_titulos, ['Dataset 1 de prueba'], hoy);
      assert.deepEqual(sinUno.vista.casos.filter((fila) => fila.dataset_id === ids[0]).map((fila) => fila.contar), [false], hoy);
      assert.equal(tramoDe(sinUno, 'externa', 'carga').cifra.ciclos, 2, hoy);
      assert.deepEqual(sinUno.vista, vistaDe(casosDe(fuentes, { hoy: AL }), { anio: 2026, al: AL, sin: [ids[0]] }), hoy);
    }
    // El año en curso es el de entrada
    const enCurso = await metricas({}, '2027-01-05');
    assert.deepEqual([enCurso.anio, enCurso.al, enCurso.en_vivo, enCurso.aviso_foto, enCurso.anios], [2027, '2027-01-05', true, null, [2026, 2027]]);

    // Con dos años cerrados sin foto, cada uno en vivo al 31/12 de su año y con su aviso
    const de2027 = await metricas({ anio: '2027' }, '2028-03-01');
    assert.deepEqual([de2027.anio, de2027.al, de2027.en_vivo, de2027.aviso_foto],
      [2027, '2027-12-31', true, 'La foto de 2027 todavía no se sacó: se reintenta en la próxima corrida.']);
    // Solo un año anterior a 2026 o futuro no tiene métricas (el 404)
    for (const [anio, hoy] of [['2025', '2027-01-11'], ['2028', '2027-01-11'], ['1999', '2028-03-01']]) {
      assert.equal(await metricas({ anio }, hoy), null, `${anio} ${hoy}`);
    }
    // Con la foto, sale de ella, también el mismo 10/01
    const guardada = await guardarFoto();
    for (const hoy of ['2027-01-10', '2027-01-11']) {
      const data = await metricas({ anio: '2026', sin: String(ids[0]) }, hoy);
      assert.deepEqual([data.en_vivo, data.aviso_foto, data.anios, data.sin_titulos], [false, null, [2026, 2027], []], hoy);
      assert.deepEqual(data.fotos.map((f) => [f.anio, f.con_foto]), [[2026, true], [2027, false]], hoy);
      assert.deepEqual(data.vista, guardada.vistas['mediana-habiles'], hoy);
    }
  });

  it('una foto que no se puede leer no pasa por «no hay métricas»: tira (el 500)', async () => {
    await query("INSERT INTO metricas_fotos (anio, al, datos) VALUES (2026, '2026-12-31', '{roto')");
    await assert.rejects(metricas({ anio: '2026' }, '2027-03-01'), { message: 'La foto de 2026 no se puede leer' });
    // Una foto de la versión 1 a la que le falta la combinación pedida, tampoco
    const datos = foto.datosDeLaFoto(new Map(), { anio: 2026, generada: '2027-01-10 08:15:00' });
    delete datos.vistas['promedio-corridos'];
    await query('UPDATE metricas_fotos SET datos = ? WHERE anio = 2026', [JSON.stringify(datos)]);
    await assert.rejects(metricas({ anio: '2026', estadistico: 'promedio', dias: 'corridos' }, '2027-03-01'),
      { message: 'La foto de 2026 no se puede leer' });
    // Las otras combinaciones sí
    assert.equal((await metricas({ anio: '2026' }, '2027-03-01')).en_vivo, false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// GET /api/reportes/informe-anual?anio= (spec 5, Para presentar, punto 2): solo para un año con foto, que lo da entero (la foto, la
// comparación con la del año anterior y los logros del año, los hitos de Gestión → Proyectos)
// ---------------------------------------------------------------------------------------------------------------------

const SIN_FOTO = { success: false, error: 'Todavía no hay foto de ese año: se saca el 10/01 del año siguiente.' };

// Un proyecto de Gestión y un hito (sin proyecto, un logro del área)
const proyecto = async ({ nombre, categoria = 'tecnologia', activo = 1 }) => (await query(
  "INSERT INTO proyectos (nombre, estado, categoria, activo, created_by) VALUES (?, 'en_curso', ?, ?, ?)",
  [nombre, categoria, activo, usuarios.adminA.id]
)).insertId;
const hitoDe = (proyectoId, fecha, titulo, descripcion = null) => query(
  'INSERT INTO proyecto_hitos (proyecto_id, titulo, fecha, descripcion) VALUES (?, ?, ?, ?)', [proyectoId, titulo, fecha, descripcion]
);

const pedirInforme = (consulta, quien) => api.get(`/reportes/informe-anual${consulta}`, quien ? como(quien) : {});

describe('GET /reportes/informe-anual', () => {
  beforeEach(async () => {
    await query('DELETE FROM proyecto_hitos');
    await query('DELETE FROM proyectos');
  });

  it('sin foto, 404 con el mensaje', async () => {
    await prepararElAnio();
    // Sin la foto del año (ni la de 2026, que todavía no se sacó, ni la de 2025, que nunca la tiene), sin año o con uno que no es un año
    for (const consulta of ['?anio=2026', '?anio=2025', '', '?anio=', '?anio=abc', '?anio=0', '?anio=0999', '?anio=10000', '?anio=2026.5',
      '?anio=1e3', '?anio=-2026', '?anio=2026&anio=2027', '?anio[a]=2026']) {
      for (const quien of ['lector', 'colab', 'adminA']) {
        const res = await pedirInforme(consulta, quien);
        assert.equal(res.status, 404, `${consulta} ${quien}`);
        assert.match(res.headers.get('content-type'), /^application\/json/);
        assert.deepEqual(res.body, SIN_FOTO, `${consulta} ${quien}`);
      }
    }
    // Con la foto de otro año, tampoco
    await guardarFoto(2026);
    assert.deepEqual((await pedirInforme('?anio=2027', 'lector')).body, SIN_FOTO);
    // Sin sesión, 401
    for (const token of [undefined, 'no-es-un-token']) {
      const res = await api.get('/reportes/informe-anual?anio=2026', { token });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    }
  });

  it('con foto de 2026 y sin la de 2025: «Primer año con foto»', async () => {
    const ids = await prepararElAnio();
    const guardada = await guardarFoto(2026);
    // La base cambia después de la foto: el Informe sale de la foto
    await query('DELETE FROM datasets WHERE id = ?', [ids[2]]);
    for (const quien of ['lector', 'colab']) {
      const res = await pedirInforme('?anio=2026', quien);
      assert.equal(res.status, 200, quien);
      assert.match(res.headers.get('content-type'), /^application\/pdf/);
      assert.equal(res.headers.get('content-disposition'), disposicionDeAdjunto('Informe-anual-RPAD-2026.pdf'));
      assert.equal(res.body.subarray(0, 5).toString(), '%PDF-');
      assert.ok(todasDelTamano(res.body, HOJA_A4), 'todas las hojas son A4');
      const hojas = lineasPorHoja(res.body);
      hojas.forEach((lineas, k) => {
        assert.ok(lineas.includes(`Informe anual 2026 · Hoja ${k + 1} de ${hojas.length}`), `hoja ${k + 1}: ${lineas.join(' | ')}`);
        assert.ok(lineas.includes('Informe anual 2026'), `hoja ${k + 1}`);
        // «Generado el … por <nombre corto>»
        assert.ok(lineas.some((l) => /^Generado el \d{2}\/\d{2}\/\d{4} a las \d{2}:\d{2} por \S/.test(l)), `hoja ${k + 1}`);
      });
      const todo = hojas.flat();
      assert.ok(todo.includes('Primer año con foto'), todo.join(' | '));
      assert.ok(!todo.includes('Diferencia'));
      // La cifra de la carga es la de la foto, con los tres datasets (con la base de hoy serían dos)
      const primera = hojas[0].join(' ');
      assert.ok(hojas[0].includes('INFORME ANUAL · AÑO 2026, AL 31/12/2026'), primera);
      assert.ok(primera.includes('Sale de la foto del 31/12/2026, calculada con todos los datasets.'), primera);
      assert.ok(primera.includes('Mediana en días hábiles · con todos los datasets'), primera);
      const carga = guardada.vistas['mediana-habiles'].circuito.externa.find((t) => t.clave === 'carga').cifra;
      assert.equal(carga.debajo, 'mediana de 3 ciclos');
      assert.ok(primera.includes(`${carga.texto} ${carga.unidad}`) && primera.includes(carga.debajo), primera);
      // Sin hitos en 2026
      assert.ok(todo.includes('Sin hitos registrados en 2026.'));
    }
  });

  it('con la foto de 2025, la comparación con los números de las dos fotos', async () => {
    await prepararElAnio();
    await guardarFoto(2025);
    await guardarFoto(2026);
    const res = await pedirInforme('?anio=2026', 'lector');
    assert.equal(res.status, 200);
    const todo = lineasPorHoja(res.body).flat();
    assert.ok(!todo.includes('Primer año con foto'));
    const comparacion = todo.slice(todo.indexOf('COMPARACIÓN CON 2025'));
    assert.ok(comparacion.includes('Las fotos del 31/12/2025 y del 31/12/2026'), comparacion.join(' | '));
    // Cada fila, con sus celdas en orden (una celda puede ir en más de una línea)
    const tabla = comparacion.join(' ');
    const fila = (...celdas) => assert.ok(tabla.includes(celdas.join(' ')), `falta «${celdas.join(' | ')}» en ${tabla}`);
    fila('El trabajo del RPAD', '2025', '2026', 'Diferencia');
    // Los tres datasets se dieron de alta y se actualizaron en 2026: en la foto de 2025 no estaban, y la foto lo dice con sus textos
    fila('Datasets nuevos', '0', '3', '+3');
    fila('Actualizaciones registradas', '0', '3', '+3');
    fila('Actualizados a tiempo', 'Sin actualizaciones registradas en 2025.', '2 de 3 ciclos (67%)', '—');
    fila('Índice de actualización', 'Al 31/12/2025: sin datasets con vencimiento', 'Al 31/12/2026: 100% al día (3 de 3)', '—');
    fila('Datasets en el registro', '0', '3', '+3');
    // El Informe de 2025 compara con 2024, que no tiene foto
    const de2025 = await pedirInforme('?anio=2025', 'lector');
    assert.equal(de2025.status, 200);
    const lineas2025 = lineasPorHoja(de2025.body).flat();
    assert.ok(lineas2025.includes('COMPARACIÓN CON 2024') && lineas2025.includes('Primer año con foto'), lineas2025.join(' | '));
  });

  it('los logros de 2026 por proyecto', async () => {
    await prepararElAnio();
    await guardarFoto(2026);
    const portal = await proyecto({ nombre: 'Portal de prueba', categoria: 'tecnologia' });
    const difusion = await proyecto({ nombre: 'Difusión de prueba', categoria: 'difusion' });
    const deBaja = await proyecto({ nombre: 'Proyecto dado de baja', activo: 0 });
    await hitoDe(difusion, '2026-08-01', 'Taller con las áreas', 'Se hizo en el salón.');
    await hitoDe(portal, '2026-11-30', 'Segundo hito del portal');
    await hitoDe(portal, '2026-02-03', 'Primer hito del portal', 'Con su descripción.');
    await hitoDe(portal, '2025-12-31', 'Hito de 2025');
    await hitoDe(portal, '2027-01-01', 'Hito de 2027');
    await hitoDe(deBaja, '2026-05-05', 'Hito de un proyecto dado de baja');
    await hitoDe(null, '2026-06-15', 'Logro sin proyecto');
    const res = await pedirInforme('?anio=2026', 'lector');
    assert.equal(res.status, 200);
    const todo = lineasPorHoja(res.body).flat();
    const logros = todo.slice(todo.indexOf('LOGROS DEL AÑO'));
    // Los proyectos en el orden de Gestión → Proyectos (por categoría), cada hito por fecha, y los logros del área al final
    const orden = ['Portal de prueba', '03/02/2026', 'Primer hito del portal', 'Con su descripción.', '30/11/2026', 'Segundo hito del portal',
      'Difusión de prueba', '01/08/2026', 'Taller con las áreas', 'Se hizo en el salón.', 'Logros del Área', '15/06/2026', 'Logro sin proyecto'];
    const posiciones = orden.map((t) => logros.indexOf(t));
    assert.ok(posiciones.every((p) => p !== -1), JSON.stringify(Object.fromEntries(orden.map((t, i) => [t, posiciones[i]]))));
    assert.deepEqual([...posiciones].sort((a, b) => a - b), posiciones);
    // Los de otro año y los de un proyecto dado de baja, no
    for (const t of ['Hito de 2025', 'Hito de 2027', 'Hito de un proyecto dado de baja', 'Proyecto dado de baja']) {
      assert.ok(!todo.includes(t), t);
    }
    assert.ok(!todo.includes('Sin hitos registrados en 2026.'));
  });
});
