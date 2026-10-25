// API de métricas (spec 2026-10-24-metricas-y-reportes, 1.5 a 1.7, 2.3 y 3): GET /api/metricas la ven todos los roles con sesión
// (también el lector y el colaborador); sin sesión, 401. Los parámetros raros caen a los de entrada y un año sin métricas da 404 en
// JSON. Contra una base de prueba propia, con datos inventados. El servidor corre con el reloj de verdad: lo que depende del día (un
// año cerrado con su foto, el año que terminó entre el 1/1 y el 10/1) se prueba con metricasDe y un hoy fijo, como la foto
// (sacarFotoSiCorresponde). La foto se guarda con datosDeLaFoto y un INSERT: nunca /api/cron/*.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { crearDataset, limpiarBase } from './notas-fixtures.js';
import {
  ESTADISTICOS, DIAS, casosDe, vistaDe, duracion, cifraDe, indiceMesAMes, antiguedadDeVencidos, estadosAl, trabajoDelAnio, areasYTemas
} from '../services/metricasReglas.js';
import { hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';

const AL = '2026-12-31';
const CLAVES_DE_DATA = ['anio', 'al', 'en_vivo', 'aviso_foto', 'anios', 'vista', 'cinta', 'contexto', 'trabajo', 'areas', 'sin_titulos'];
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

// ---------------------------------------------------------------------------------------------------------------------
// opcionesDeMetricas y aniosDeMetricas (puras)
// ---------------------------------------------------------------------------------------------------------------------

describe('opcionesDeMetricas', () => {
  const opciones = (query, hoy = '2026-10-24', aniosConFoto = []) => controlador.opcionesDeMetricas(query, { hoy, aniosConFoto });
  const DE_ENTRADA = { anio: 2026, al: '2026-10-24', en_vivo: true, aviso_foto: null, estadistico: 'mediana', dias: 'habiles', gestion: 'externa' };

  // Review Focus 2
  it('los valores inválidos caen a los de entrada y sin acepta solo enteros positivos, sin repetidos', () => {
    assert.deepEqual(opciones({ anio: 'abc', sin: 'x,1e3,-2,5,5', estadistico: 'foo', dias: 'bar', gestion: 'z' }), { ...DE_ENTRADA, sin: [5] });
    // Sin parámetros (o sin query), los de entrada
    assert.deepEqual(opciones({}), { ...DE_ENTRADA, sin: [] });
    assert.deepEqual(opciones(undefined), { ...DE_ENTRADA, sin: [] });
    assert.deepEqual(opciones(null), { ...DE_ENTRADA, sin: [] });
    // Un año que no son cuatro dígitos, o que no es un texto ni un número, tampoco sirve
    for (const anio of ['', '2026x', '02026', '26', '2026.0', ['2026', '2027'], { a: 1 }, 2026.5, true]) {
      assert.deepEqual(opciones({ anio }), { ...DE_ENTRADA, sin: [] }, JSON.stringify(anio));
    }
    // Un selector repetido en la URL llega como lista: no sirve
    assert.deepEqual(opciones({ estadistico: ['promedio', 'mediana'], dias: ['corridos'], gestion: ['interna'] }), { ...DE_ENTRADA, sin: [] });
  });

  it('los valores válidos pasan, y sin conserva el orden pedido', () => {
    assert.deepEqual(opciones({ anio: '2026', sin: '45,12,45', estadistico: 'promedio', dias: 'corridos', gestion: 'interna' }), {
      ...DE_ENTRADA, estadistico: 'promedio', dias: 'corridos', gestion: 'interna', sin: [45, 12]
    });
    assert.equal(opciones({ anio: 2026 }).anio, 2026);
  });

  it('sin: dígitos y nada más (con espacios alrededor), un número seguro y mayor que 0; también repetido en la URL', () => {
    const sin = (valor) => opciones({ sin: valor }).sin;
    assert.deepEqual(sin('0,00,1.5,1e3,-3,abc,,12abc, 7 ,007'), [7]);
    assert.deepEqual(sin('99999999999999999999,9007199254740991'), [9007199254740991]);
    assert.deepEqual(sin(['3', '1,3', '2']), [3, 1, 2]);
    for (const valor of ['', ',', undefined, null, 5, { 1: '2' }, [1, 2]]) assert.deepEqual(sin(valor), [], JSON.stringify(valor));
  });

  it('el año en curso va en vivo, al día de hoy; un año sin métricas da null (el 404)', () => {
    assert.deepEqual(opciones({ anio: '2026' }, '2026-01-01'), { ...DE_ENTRADA, al: '2026-01-01', sin: [] });
    // Antes del primer año (2026), un año futuro o uno cerrado sin foto: no hay métricas
    for (const anio of ['1999', '2025', '2027', 2025]) assert.equal(opciones({ anio }), null, String(anio));
    assert.equal(opciones({ anio: '2026' }, '2028-03-01'), null);
    // Un hoy que no es una fecha
    for (const hoy of ['2026-13-01', '24/10/2026', null, undefined]) {
      assert.equal(controlador.opcionesDeMetricas({}, { hoy, aniosConFoto: [] }), null, String(hoy));
    }
    assert.equal(controlador.opcionesDeMetricas({}), null);
  });

  it('entre el 1/1 y el 10/1, el año que terminó va en vivo «al 31/12» con el aviso de la foto; con foto, sale de la foto y sin destildar', () => {
    for (const hoy of ['2027-01-01', '2027-01-05', '2027-01-10']) {
      assert.deepEqual(opciones({ anio: '2026', sin: '4,2' }, hoy), {
        ...DE_ENTRADA, al: AL, aviso_foto: 'La foto de 2026 se saca el 10/01/2027', sin: [4, 2]
      }, hoy);
      // El de entrada sigue siendo el año en curso
      assert.deepEqual(opciones({}, hoy), { ...DE_ENTRADA, anio: 2027, al: hoy, sin: [] }, hoy);
    }
    // Desde el 11/01, sin foto, ese año ya no se puede ver; con foto, sale de la foto (también el 10/01, una vez sacada), y en un año con
    // foto no se destilda
    assert.equal(opciones({ anio: '2026' }, '2027-01-11'), null);
    for (const hoy of ['2027-01-10', '2027-01-11', '2027-06-15', '2029-03-01']) {
      assert.deepEqual(opciones({ anio: '2026', sin: '4,2' }, hoy, [2026]), { ...DE_ENTRADA, al: AL, en_vivo: false, sin: [] }, hoy);
    }
    // Los años con foto pueden llegar como texto; un año en curso con foto (no pasa: se saca el 10/01 del siguiente) sigue en vivo
    assert.equal(opciones({ anio: '2026' }, '2027-06-15', ['2026']).en_vivo, false);
    assert.deepEqual(opciones({ anio: '2026' }, '2026-10-24', [2026]), { ...DE_ENTRADA, sin: [] });
    // El aviso dice el año que corresponde
    assert.equal(opciones({ anio: '2027' }, '2028-01-03').aviso_foto, 'La foto de 2027 se saca el 10/01/2028');
    // aniosConFoto que no es una lista: ninguno
    assert.equal(controlador.opcionesDeMetricas({ anio: '2026' }, { hoy: '2027-06-15', aniosConFoto: 'x' }), null);
  });
});

describe('aniosDeMetricas', () => {
  const anios = (hoy, aniosConFoto = []) => controlador.aniosDeMetricas({ hoy, aniosConFoto });

  it('desde 2026 hasta el actual: el en curso, el que terminó hasta el 10/01 y los que tienen foto', () => {
    assert.deepEqual(anios('2026-10-24'), [2026]);
    assert.deepEqual(anios('2026-01-05'), [2026]);
    assert.deepEqual(anios('2027-01-05'), [2026, 2027]);
    assert.deepEqual(anios('2027-01-10'), [2026, 2027]);
    assert.deepEqual(anios('2027-01-11'), [2027]);
    assert.deepEqual(anios('2027-01-11', [2026]), [2026, 2027]);
    assert.deepEqual(anios('2029-01-05', [2026, 2027]), [2026, 2027, 2028, 2029]);
    assert.deepEqual(anios('2029-02-01', [2027, 2026]), [2026, 2027, 2029]);
    // Una foto anterior a 2026 o posterior al año en curso no cuenta (no puede haberla)
    assert.deepEqual(anios('2027-03-01', [2025, 2026, 2030]), [2026, 2027]);
    assert.deepEqual(anios('no es una fecha'), []);
  });
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
      assert.deepEqual(Object.keys(data.vista), ['circuito', 'resultados', 'casos', 'para_completar'], quien);
      assert.deepEqual(Object.keys(data.cinta), ['externa', 'interna'], quien);
      assert.deepEqual(Object.keys(data.contexto), ['indice', 'antiguedad', 'estados'], quien);
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
  it('los parámetros raros caen a los de entrada, con 200', async () => {
    await prepararHoy();
    const deEntrada = await api.get('/metricas', como('lector'));
    const raro = await api.get('/metricas?anio=abc&sin=x,1e3,-2&estadistico=foo&dias=bar&gestion=z', como('lector'));
    assert.equal(raro.status, 200);
    assert.deepEqual(raro.body, deEntrada.body);
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

  // El antiobjetivo: que el índice diga una cosa en la portada y otra en Métricas
  it('el índice de hoy da lo mismo que la portada (GET /datasets/estadisticas)', async () => {
    const { hoy } = await prepararHoy();
    const [metricas, portada] = await Promise.all([api.get('/metricas', como('lector')), api.get('/datasets/estadisticas')]);
    assert.equal(portada.body.data.tasaActualizacion, 75);
    const { contexto } = metricas.body.data;
    assert.deepEqual(contexto.indice.at(-1), { dia: hoy, tasa: 75, al_dia: 3, base: 4 });
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
      indice: indiceMesAMes(fuentes, opciones), antiguedad: antiguedadDeVencidos(fuentes, opciones), estados: estadosAl(fuentes, opciones)
    },
    trabajo: trabajoDelAnio(fuentes, casos, { ...opciones, estadistico }),
    areas: areasYTemas(fuentes, opciones)
  };
};

const guardarFoto = async () => {
  const datos = foto.datosDeLaFoto(await seguimientoDatos.fuentesDe(null), { anio: 2026, generada: '2027-01-10 08:15:00' });
  await query('INSERT INTO metricas_fotos (anio, al, datos) VALUES (?, ?, ?)', [2026, AL, JSON.stringify(datos)]);
  return (await foto.leerFoto(2026)).datos;
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
  });

  it('entre el 1/1 y el 10/1, el año que terminó va en vivo «al 31/12», con el aviso de la foto, y da lo mismo que la foto', async () => {
    const ids = await prepararElAnio();
    const fuentes = await seguimientoDatos.fuentesDe(null);
    const laQueSeVaASacar = foto.datosDeLaFoto(fuentes, { anio: 2026, generada: '2027-01-10 08:15:00' });
    for (const hoy of ['2027-01-01', '2027-01-05', '2027-01-10']) {
      for (const { estadistico, dias } of COMBINACIONES) {
        const clave = `${hoy} ${foto.claveDeLaVista(estadistico, dias)}`;
        const data = await metricas({ anio: '2026', estadistico, dias }, hoy);
        assert.deepEqual([data.anio, data.al, data.en_vivo, data.aviso_foto, data.anios, data.sin_titulos],
          [2026, AL, true, 'La foto de 2026 se saca el 10/01/2027', [2026, 2027], []], clave);
        assert.deepEqual(data.vista, laQueSeVaASacar.vistas[foto.claveDeLaVista(estadistico, dias)], clave);
        assert.deepEqual(data.cinta, laQueSeVaASacar.cintas[foto.claveDeLaVista(estadistico, dias)], clave);
        assert.deepEqual(data.contexto, laQueSeVaASacar.contexto, clave);
        assert.deepEqual(data.trabajo, laQueSeVaASacar.trabajo[estadistico], clave);
        assert.deepEqual(data.areas, laQueSeVaASacar.areas, clave);
      }
    }
    // En vivo se puede destildar
    const sinUno = await metricas({ anio: '2026', sin: `${ids[0]},999999,${ids[0]}` }, '2027-01-05');
    assert.deepEqual(sinUno.sin_titulos, ['Dataset 1 de prueba']);
    assert.deepEqual(sinUno.vista.casos.filter((fila) => fila.dataset_id === ids[0]).map((fila) => fila.contar), [false]);
    assert.equal(tramoDe(sinUno, 'externa', 'carga').cifra.ciclos, 2);
    assert.deepEqual(sinUno.vista, vistaDe(casosDe(fuentes, { hoy: AL }), { anio: 2026, al: AL, sin: [ids[0]] }));
    // El año en curso es el de entrada
    const enCurso = await metricas({}, '2027-01-05');
    assert.deepEqual([enCurso.anio, enCurso.al, enCurso.en_vivo, enCurso.aviso_foto, enCurso.anios], [2027, '2027-01-05', true, null, [2026, 2027]]);

    // Desde el 11/01 sin foto, ese año no tiene métricas (el 404); con la foto, sale de ella, también el mismo 10/01
    assert.equal(await metricas({ anio: '2026' }, '2027-01-11'), null);
    assert.deepEqual((await metricas({}, '2027-01-11')).anios, [2027]);
    const guardada = await guardarFoto();
    for (const hoy of ['2027-01-10', '2027-01-11']) {
      const data = await metricas({ anio: '2026', sin: String(ids[0]) }, hoy);
      assert.deepEqual([data.en_vivo, data.aviso_foto, data.anios, data.sin_titulos], [false, null, [2026, 2027], []], hoy);
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
