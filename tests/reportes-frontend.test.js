// La pestaña Métricas de «Métricas y Reportes» (spec 2026-10-24-metricas-y-reportes, 1.4 a 1.7, 2.1 a 2.3 y 6), ejecutada en Node:
// lo puro de public/js/reportes.js (el estado de la URL, la barra, la franja de lo destildado, el circuito, la cinta y los casos) con
// lo que arma el servidor (services/metricasReglas.js y metricasCinta.js sobre los casos reales de tests/metricas-casos.js) y con
// tramos y cintas armados a mano. Como seguimiento.js, el script al cargarse solo declara: se carga en un vm con un document que no
// hace nada, junto con el api.js de verdad (Utils). La página no recalcula nada: dibuja lo que manda el servidor. También la pestaña
// Reportes (spec 5): las ocho tarjetas, lo que pide cada una y, con un document de mentira, la descarga con API.pedirArchivo.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import {
  casosDe, vistaDe, unidadDe, SIN_NOTAS_DGMIT, contextoDelAnio, trabajoDelAnio, areasYTemas, sinLosDestildados, textoDeLaFranja,
  ESTADISTICOS as ESTADISTICOS_DEL_SERVIDOR, DIAS as DIAS_DEL_SERVIDOR, GESTIONES as GESTIONES_DEL_SERVIDOR
} from '../services/metricasReglas.js';
import { cintaDeMetricas, cintasDeLaVista, FORMA_DE_LA_CINTA } from '../services/metricasCinta.js';
import { graficoDelTramo, GRAFICO } from '../services/metricasGrafico.js';
import { mapaDeLosCasos, mapaDe, fuentesDelCaso, con, notaDgmit, HOY_DE_LAS_METRICAS as HOY } from './metricas-casos.js';
import {
  TEXTOS_DE_LA_PESTANA as T, textoDelDesglose, textoDeLoQueFalta, textoDeDondeSale, textoDelMesManual, textoSinManuales,
  textoDeLaPildora
} from '../services/reportesMetricasPdf.js';
import {
  TEXTOS_DE_PARA_COMPLETAR, debajoDeLaNota, queDeLaNota, debajoDelRecibido, queDelRecibido
} from '../services/reportesParaCompletarPdf.js';
import { MENSAJE_PERIODO_INVALIDO } from '../services/reportesAvisosPdf.js';
import { MESES_DE_LA_AGENDA, MESES_POR_DEFECTO, GESTIONES_DE_LA_AGENDA } from '../services/reportesAgenda.js';
import { fotosDeMetricas, opcionesDeMetricas } from '../services/metricasOpciones.js';
import { nombreDelReporte as nombreDelReporteDelServidor } from '../services/reportesNombres.js';

const leer = (ruta) => fs.readFileSync(new URL(`../public/${ruta}`, import.meta.url), 'utf8');

const cargar = (globales = {}) => {
  const contexto = vm.createContext({
    CONFIG: { API_URL: '/api' },
    console,
    document: { addEventListener() {}, getElementById: () => null },
    URLSearchParams,
    Auth: { isAuthenticated: () => true, isAdmin: () => false },
    window: { location: { search: '', hash: '' }, addEventListener() {} },
    ...globales
  });
  vm.runInContext(`${leer('js/api.js')}\n;globalThis.Utils = Utils;`, contexto);
  vm.runInContext(leer('js/reportes.js'), contexto);
  return contexto;
};

// Lo que devuelve una función del vm es de otro contexto: deepStrictEqual compara prototipos, así que se pasa a uno de acá
const plano = (valor) => JSON.parse(JSON.stringify(valor));
const ctx = cargar();
const cuantas = (texto, patron) => (texto.match(patron) ?? []).length;
// Una coordenada como la escribe la página (dos decimales)
const coord = (valor) => String(Math.round(valor * 100) / 100);

// La vista y las cintas de los casos reales al 24/10/2026, como las manda GET /api/metricas (siempre en días corridos: en la de hábiles,
// el modal de cada tramo es null), y el resto de la pestaña (el contexto, el trabajo del RPAD y las áreas)
const MAPA = mapaDeLosCasos();
const CASOS = casosDe(MAPA, { hoy: HOY });
const vistaReal = (opciones = {}) => vistaDe(CASOS, { anio: 2026, al: HOY, dias: 'corridos', ...opciones });
const VISTA = vistaReal();
const DEL_ANIO = { anio: 2026, al: HOY };
const CONTEXTO = contextoDelAnio(MAPA, DEL_ANIO);
const INDICE = CONTEXTO.indice;
const ANTIGUEDAD = CONTEXTO.antiguedad;
const TRABAJO = trabajoDelAnio(MAPA, CASOS, { ...DEL_ANIO, estadistico: 'mediana' });
const AREAS = areasYTemas(MAPA, DEL_ANIO);
const tramoDe = (vista, gestion, clave) => vista.circuito[gestion].find((t) => t.clave === clave);

// Sin `dias`: no hay selector de días (spec 2026-11-07-metricas-cajones-y-ciclos, 4)
const POR_DEFECTO = { anio: null, estadistico: 'mediana', gestion: 'externa', sin: [], pestana: 'metricas' };

// Los tramos de vistaDe armados a mano (como en tests/metricas-cinta.test.js): el nombre, el texto de la flecha, quién está a cargo
// y si es de la DGMIT. Sin las claves de la spec 2026-11-07-metricas-cajones-y-ciclos (como_se_cuenta, habiles_texto…), como los de una
// foto vieja: el cajón dice «desde → hasta». Los tests de la frase y de los hábiles las suman
const DE_LA_CLAVE = {
  aviso: { nombre: 'Aviso anticipado', desde_hasta: 'Del aviso al vencimiento', responsable: 'DDPC', dgmit: false },
  tramite: { nombre: 'Redacción y entrega de nota', desde_hasta: 'Del aviso a la nota en el área', responsable: 'DGMIT y DA', dgmit: true },
  respuesta: { nombre: 'Respuesta del área', desde_hasta: 'De la nota a la entrega', responsable: 'Área', dgmit: false },
  produccion: { nombre: 'Producción del relevamiento', desde_hasta: 'Del aviso a la entrega', responsable: 'DGMIT y DIT', dgmit: true },
  carga: { nombre: 'Preparación y carga', desde_hasta: 'De la entrega a la carga', responsable: 'DDPC', dgmit: false }
};
const tramo = (clave, valor, { dias = 'habiles', estadistico = 'mediana', ciclos = 12, vacio = null, en_curso = null, pendientes, pendientes_texto = null, habiles } = {}) => ({
  clave, ...DE_LA_CLAVE[clave],
  ...(habiles === undefined ? {} : { habiles: { valor: habiles } }),
  cifra: valor === null ? null : {
    valor, texto: valor === 0 ? 'En el día' : String(valor), unidad: valor === 0 ? '' : unidadDe(valor, dias),
    debajo: valor === 0 ? `${estadistico} en días ${dias === 'corridos' ? 'corridos' : 'hábiles'}` : `${estadistico} de ${ciclos} ${ciclos === 1 ? 'ciclo' : 'ciclos'}`,
    ciclos, ciclos_texto: `${ciclos} ${ciclos === 1 ? 'ciclo' : 'ciclos'}`, en_el_dia: valor === 0, orientativo: ciclos <= 4
  },
  vacio: valor === null ? (vacio ?? { titulo: 'Sin casos en 2026', texto: '' }) : null,
  en_curso,
  pendientes: pendientes ?? (clave === 'tramite' ? 0 : null),
  pendientes_texto
});

// Una cinta con la cadena completa, en días corridos con sus hábiles (cifras inventadas): la interna con la producción y la entrega y la
// carga juntas (0 días), y la externa con todos sus tramos (con notas DGMIT cargadas). El aviso cae dentro de la zona a escala
const CINTA_INTERNA = cintaDeMetricas([tramo('aviso', 30, { dias: 'corridos', habiles: 21 }), tramo('produccion', 33, { dias: 'corridos', habiles: 23 }),
  tramo('carga', 0, { dias: 'corridos', habiles: 0 })], { gestion: 'interna', dias: 'corridos' });
const CINTA_EXTERNA = cintaDeMetricas([tramo('aviso', 29, { dias: 'corridos', habiles: 20 }), tramo('tramite', 12, { dias: 'corridos', habiles: 9 }),
  tramo('respuesta', 20, { dias: 'corridos', habiles: 14 }), tramo('carga', 3, { dias: 'corridos', habiles: 2 })], { gestion: 'externa', dias: 'corridos' });

describe('reportes.js: el estado de la URL', () => {
  it('estadoDeLaUrl ignora valores inválidos y urlDeEstado omite los de por defecto', () => {
    assert.deepEqual(plano(ctx.estadoDeLaUrl('')), POR_DEFECTO);
    assert.deepEqual(plano(ctx.estadoDeLaUrl(undefined)), POR_DEFECTO);
    // Lo que no sirve cae al de entrada; de los destildados quedan los enteros positivos escritos con dígitos, sin repetidos
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?anio=abc&sin=x,1e3,-2,5,5,0,1.5&estadistico=foo&dias=bar&gestion=z#otra')), { ...POR_DEFECTO, sin: [5] });
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?anio=20266&estadistico=Promedio')), POR_DEFECTO);
    assert.equal(ctx.estadoDeLaUrl('?anio=0000').anio, null);
    assert.equal(ctx.estadoDeLaUrl('?anio=0999').anio, null);
    assert.equal(ctx.estadoDeLaUrl('?anio=1000').anio, 1000);
    const todo = '?anio=2026&estadistico=promedio&gestion=interna&sin=12,45#reportes';
    const estado = { anio: 2026, estadistico: 'promedio', gestion: 'interna', sin: [12, 45], pestana: 'reportes' };
    assert.deepEqual(plano(ctx.estadoDeLaUrl(todo)), estado);
    // Sin el «?» también, y un parámetro repetido suma sus destildados
    assert.deepEqual(plano(ctx.estadoDeLaUrl('sin=3&sin=4,3#metricas')), { ...POR_DEFECTO, sin: [3, 4] });
    assert.equal(ctx.estadoDeLaUrl('#reportes').pestana, 'reportes');

    // urlDeEstado: lo que está en su valor por defecto no se escribe (tampoco la pestaña Métricas); el resto, en este orden
    assert.equal(ctx.urlDeEstado(POR_DEFECTO), '');
    assert.equal(ctx.urlDeEstado({ ...POR_DEFECTO, estadistico: 'promedio' }), '?estadistico=promedio');
    assert.equal(ctx.urlDeEstado({ ...POR_DEFECTO, pestana: 'reportes' }), '#reportes');
    assert.equal(ctx.urlDeEstado({ ...POR_DEFECTO, sin: [11] }), '?sin=11');
    assert.equal(ctx.urlDeEstado(estado), todo);
    assert.deepEqual(plano(ctx.estadoDeLaUrl(ctx.urlDeEstado(estado))), estado, 'ida y vuelta');
    // Un estado raro no se escribe tal cual: lo que no sirve no va
    assert.equal(ctx.urlDeEstado({ anio: 'x', estadistico: '<b>', dias: null, gestion: 'z', sin: ['a', -1, 7], pestana: 'otra' }), '?sin=7');
    assert.equal(ctx.urlDeEstado(undefined), '');
  });

  // Spec 2026-11-07-metricas-cajones-y-ciclos, 4: sin selector de días. Un link viejo con ?dias= (un marcador guardado) se abre igual, y
  // la dirección nunca lo vuelve a escribir (Review Focus 1)
  it('sin dias: estadoDeLaUrl no lo lee y urlDeEstado no lo escribe', () => {
    for (const dias of ['habiles', 'corridos', 'x']) {
      assert.deepEqual(plano(ctx.estadoDeLaUrl(`?dias=${dias}`)), POR_DEFECTO, dias);
      assert.deepEqual(plano(ctx.estadoDeLaUrl(`?anio=2026&estadistico=promedio&dias=${dias}&sin=4#reportes`)),
        { ...POR_DEFECTO, anio: 2026, estadistico: 'promedio', sin: [4], pestana: 'reportes' }, dias);
      // Un estado que todavía lo traiga (una pestaña con la página de antes) no lo escribe
      assert.equal(ctx.urlDeEstado({ ...POR_DEFECTO, dias }), '', dias);
      assert.equal(ctx.urlDeEstado({ ...POR_DEFECTO, dias, sin: [4] }), '?sin=4', dias);
    }
    assert.ok(!('dias' in ctx.estadoDeLaUrl('?dias=habiles')));
  });

  // Copias de los selectores del servidor (ESTADISTICOS, DIAS y GESTIONES de services/metricasReglas.js) y de sus valores de entrada
  // (los de opcionesDeMetricas, services/metricasOpciones.js: el primero de cada lista, ningún destildado). Si cambia uno, falla
  it('ESTADISTICOS, GESTIONES y los de entrada de ESTADO_POR_DEFECTO son los del servidor; los días no son un selector', () => {
    const valores = (nombre) => plano(vm.runInContext(nombre, ctx)).map(([valor]) => valor);
    assert.deepEqual(valores('ESTADISTICOS'), [...ESTADISTICOS_DEL_SERVIDOR]);
    assert.deepEqual(valores('GESTIONES'), [...GESTIONES_DEL_SERVIDOR]);
    const porDefecto = plano(vm.runInContext('ESTADO_POR_DEFECTO', ctx));
    const delServidor = opcionesDeMetricas({}, { hoy: HOY, aniosConFoto: [] });
    assert.deepEqual(
      { estadistico: porDefecto.estadistico, gestion: porDefecto.gestion, sin: porDefecto.sin },
      { estadistico: delServidor.estadistico, gestion: delServidor.gestion, sin: delServidor.sin }
    );
    // Sin selector de días (spec 2026-11-07-metricas-cajones-y-ciclos, 4): el servidor va siempre en días corridos, que es una de las
    // unidades de DIAS, y la página no los tiene ni en su estado ni como constante
    assert.equal(delServidor.dias, 'corridos');
    assert.ok(DIAS_DEL_SERVIDOR.includes(delServidor.dias));
    assert.ok(!('dias' in porDefecto));
    assert.equal(vm.runInContext('typeof DIAS', ctx), 'undefined');
    // El año de entrada es el que dice el servidor (null en la página: no se manda y el servidor usa el de hoy)
    assert.equal(porDefecto.anio, null);
    assert.equal(delServidor.anio, Number(HOY.slice(0, 4)));
    // Y lo que la página entiende como de entrada es eso: sin parámetros, ESTADO_POR_DEFECTO
    assert.deepEqual(plano(ctx.estadoDeLaUrl('')), porDefecto);
  });

  it('la consulta de la API lleva el año, el estadístico y los destildados, pero no los días, la gestión ni la pestaña', () => {
    assert.equal(ctx.consultaDeLaApi(POR_DEFECTO), '');
    // Un estado que todavía trae `dias` (de la página de antes) no lo manda
    for (const dias of ['corridos', 'habiles']) {
      assert.equal(ctx.consultaDeLaApi({ anio: 2026, estadistico: 'promedio', dias, gestion: 'interna', sin: [12, 45], pestana: 'reportes' }),
        'anio=2026&estadistico=promedio&sin=12,45', dias);
      assert.equal(ctx.consultaDeLaApi({ ...POR_DEFECTO, dias }), '', dias);
    }
  });

  it('cambiar un selector: lo que no sirve no cambia nada, y el año en curso vuelve a ser el de entrada', () => {
    const anios = [2026, 2027];
    assert.deepEqual(plano(ctx.conSelector(POR_DEFECTO, 'estadistico', 'promedio', anios)), { ...POR_DEFECTO, estadistico: 'promedio' });
    assert.deepEqual(plano(ctx.conSelector(POR_DEFECTO, 'gestion', 'interna', anios)), { ...POR_DEFECTO, gestion: 'interna' });
    assert.deepEqual(plano(ctx.conSelector(POR_DEFECTO, 'anio', '2026', anios)), { ...POR_DEFECTO, anio: 2026 });
    assert.deepEqual(plano(ctx.conSelector({ ...POR_DEFECTO, anio: 2026 }, 'anio', '2027', anios)), POR_DEFECTO, 'el último es el en curso');
    // Los días ya no son un selector: no cambian nada
    for (const [clave, valor] of [['estadistico', 'foo'], ['dias', 'corridos'], ['dias', 'habiles'], ['dias', ''], ['gestion', null], ['anio', '1999'],
      ['anio', 'abc'], ['otra', 'x']]) {
      assert.deepEqual(plano(ctx.conSelector(POR_DEFECTO, clave, valor, anios)), POR_DEFECTO, `${clave}=${valor}`);
    }
  });

  it('destildar un dataset lo suma al final; volver a tildarlo lo saca', () => {
    assert.deepEqual(plano(ctx.conDestildado([], 11)), [11]);
    assert.deepEqual(plano(ctx.conDestildado([12], '11')), [12, 11]);
    assert.deepEqual(plano(ctx.conDestildado([12, 11], 11)), [12]);
    assert.deepEqual(plano(ctx.conDestildado([12], 'x')), [12], 'un id que no es un id no cambia nada');
  });

  // Spec 2026-11-07-metricas-cajones-y-ciclos, 4: los días van corridos y, entre paréntesis, hábiles (los hábiles no cuentan los
  // feriados de Configuración → Feriados, además de los 9 fijos: spec 2026-10-27-feriados-en-notas, 6)
  it('la bajada dice cómo se cuentan los días: corridos y, entre paréntesis, hábiles', () => {
    const base = 'Cuánto tarda cada paso del circuito, desde el aviso del RPAD hasta la carga en el portal, y los reportes en PDF.';
    assert.equal(ctx.textoDeLaBajada(), `${base} Los días van corridos y, entre paréntesis, hábiles: de lunes a viernes, sin feriados ni días no laborables.`);
  });

  it('la bajada que trae reportes.html es la de reportes.js', () => {
    const bajada = leer('reportes.html').match(/<p class="mt-bajada" id="mt-bajada">([^<]*)<\/p>/);
    assert.ok(bajada, 'la bajada');
    assert.equal(bajada[1], ctx.textoDeLaBajada());
    assert.doesNotMatch(leer('reportes.html'), /Días hábiles \| Días corridos/);
  });
});

describe('reportes.js: la barra y la franja de lo destildado', () => {
  const DATOS = { anio: 2026, al: HOY, en_vivo: true, aviso_foto: null, anios: [2026], vista: VISTA, sin_titulos: [] };

  it('htmlDeBarra: el año, el estadístico con aria-pressed, «Casos: todos» y «Descargar PDF»', () => {
    const html = ctx.htmlDeBarra(DATOS, POR_DEFECTO);
    assert.match(html, /<select[^>]*id="mt-anio"[^>]*>/);
    assert.match(html, /<option value="2026" selected>2026 \(en curso\)<\/option>/);
    for (const [selector, valor, texto, pulsado] of [['estadistico', 'mediana', 'Mediana', true], ['estadistico', 'promedio', 'Promedio', false]]) {
      assert.match(html, new RegExp(`<button type="button" class="mt-chip" data-selector="${selector}" data-valor="${valor}" aria-pressed="${pulsado}">${texto}</button>`));
    }
    // Sin el selector de días (spec 2026-11-07-metricas-cajones-y-ciclos, 4): un solo grupo de chips, el del estadístico
    assert.equal(cuantas(html, /role="group"/g), 1);
    assert.doesNotMatch(html, /data-selector="dias"|Cómo se cuentan los días|Días hábiles|Días corridos/);
    assert.match(html, /Casos: <b>todos<\/b>/);
    assert.match(html, /data-accion="pdf"[^>]*>[\s\S]*Descargar PDF<\/button>/);
    assert.doesNotMatch(html, /mt-aviso-foto/);

    const otra = ctx.htmlDeBarra({ ...DATOS, sin_titulos: ['Parque Automotor (Patentamiento)'] }, { ...POR_DEFECTO, estadistico: 'promedio', dias: 'corridos', sin: [11] });
    assert.match(otra, /data-valor="promedio" aria-pressed="true"/);
    assert.doesNotMatch(otra, /data-selector="dias"/);
    assert.match(otra, /Casos: <b>todos menos 1<\/b>/);
  });

  it('htmlDeBarra: los años anteriores debajo del en curso, y el aviso de la foto', () => {
    const html = ctx.htmlDeBarra({ ...DATOS, anio: 2026, al: '2026-12-31', anios: [2026, 2027], aviso_foto: 'La foto de 2026 se saca el 10/01/2027' }, { ...POR_DEFECTO, anio: 2026 });
    assert.match(html, /<option value="2027">2027 \(en curso\)<\/option><option value="2026" selected>2026<\/option>/);
    assert.match(html, /<p class="mt-aviso-foto"[^>]*>La foto de 2026 se saca el 10\/01\/2027<\/p>/);
    // Un año con foto: se calculó con todos y no se destilda
    const foto = ctx.htmlDeBarra({ ...DATOS, anio: 2026, al: '2026-12-31', en_vivo: false, anios: [2026, 2027] }, { ...POR_DEFECTO, anio: 2026 });
    assert.match(foto, /<p class="mt-aviso-foto"[^>]*>Sale de la foto del 31\/12\/2026, calculada con todos los datasets\.<\/p>/);
    // Elegido el en curso (anio null) con los datos de 2026 todavía a la vista: el select ya marca el en curso
    const volviendo = ctx.htmlDeBarra({ ...DATOS, anio: 2026, anios: [2026, 2027] }, POR_DEFECTO);
    assert.match(volviendo, /<option value="2027" selected>2027 \(en curso\)<\/option><option value="2026">2026<\/option>/);
  });

  // La franja imprime el texto que arma el servidor (sin_texto de GET /api/metricas: textoDeLaFranja; Ruling 19, revisión final B-6)
  it('la franja dice «Calculado sin 1 dataset: Parque Automotor.» y «Volver a todos»', () => {
    assert.equal(ctx.htmlDeFranjaSin({ sin_texto: '' }, POR_DEFECTO), '');
    assert.equal(ctx.htmlDeFranjaSin({}, POR_DEFECTO), '');
    // Sin el texto del servidor no hay franja, aunque lleguen títulos: la página no arma la leyenda
    assert.equal(ctx.htmlDeFranjaSin({ sin_titulos: ['Parque Automotor'] }, POR_DEFECTO), '');
    const html = ctx.htmlDeFranjaSin({ sin_texto: textoDeLaFranja(['Parque Automotor']) }, { ...POR_DEFECTO, estadistico: 'promedio', sin: [11] });
    assert.match(html, /<span>Calculado sin 1 dataset: Parque Automotor\.<\/span>/);
    // El link conserva todo lo demás y saca los destildados
    assert.match(html, /<a href="reportes\.html\?estadistico=promedio" class="mt-franja-link" data-accion="todos">Volver a todos<\/a>/);
    const dos = ctx.htmlDeFranjaSin({ sin_texto: textoDeLaFranja(['Parque Automotor', 'Pauta Publicitaria']) }, { ...POR_DEFECTO, sin: [11, 10] });
    assert.match(dos, /<span>Calculado sin 2 datasets: Parque Automotor, Pauta Publicitaria\.<\/span>/);
    assert.match(dos, /href="reportes\.html"/);
  });

  // Spec 1.5: «El PDF lleva la misma leyenda en una píldora». Las dos salen del mismo armador del servidor (sinLosDestildados), con 1 y
  // con 2 destildados
  it('la franja y la píldora del PDF de Métricas dicen la misma leyenda', () => {
    for (const titulos of [['Parque Automotor'], ['Parque Automotor', 'Pauta Publicitaria']]) {
      const leyenda = sinLosDestildados(titulos);
      assert.equal(leyenda, titulos.length === 1 ? 'sin 1 dataset: Parque Automotor' : 'sin 2 datasets: Parque Automotor, Pauta Publicitaria');
      const franja = ctx.htmlDeFranjaSin({ sin_texto: textoDeLaFranja(titulos) }, { ...POR_DEFECTO, sin: [11] });
      assert.ok(franja.includes(`<span>Calculado ${leyenda}.</span>`), franja);
      assert.equal(textoDeLaPildora({ estadistico: 'mediana', dias: 'habiles', sin_titulos: titulos }), `Mediana en días hábiles · calculado ${leyenda}`);
    }
    assert.deepEqual([sinLosDestildados([]), textoDeLaFranja([]), sinLosDestildados(['', null])], ['', '', '']);
  });

  // «Volver a todos» (revisión final, B-3): cuando llegan las métricas la franja se vacía y el link que tenía el foco desaparece; el foco
  // va antes al chip «Casos: …» de la barra, que conElFoco conserva al redibujarla
  it('«Volver a todos» lleva el foco al chip «Casos: …» y pide las métricas sin destildados', async () => {
    const enfocados = [];
    const pedidos = [];
    const urls = [];
    const chip = { focus: () => enfocados.push('[data-accion="casos"]'), dataset: { accion: 'casos' } };
    const elemento = (id) => ({
      id, innerHTML: '', textContent: '', hidden: false, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
      setAttribute() {}, removeAttribute() {}, addEventListener() {}, querySelectorAll: () => [], contains: () => false, focus: () => enfocados.push(id),
      querySelector: (selector) => (id === 'mt-barra' && selector === '[data-accion="casos"]' ? chip : null)
    });
    const elementos = {};
    const pagina = cargar({
      __pedidos: pedidos,
      document: { addEventListener() {}, getElementById: (id) => (elementos[id] ??= elemento(id)), activeElement: null },
      history: { replaceState: (estado, titulo, url) => urls.push(url) },
      location: { pathname: '/reportes.html', search: '', hash: '' }
    });
    vm.runInContext(`
      API.pedirJson = (metodo, ruta) => { __pedidos.push(ruta); return new Promise(() => {}); };
      pagina.datos = { anio: 2026, anios: [2026], sin_titulos: ['Vencido'], sin_texto: 'Calculado sin 1 dataset: Vencido.' };
      pagina.estado = { ...pagina.estado, estadistico: 'promedio', sin: [5] };`, pagina);
    pagina.volverATodos();
    assert.deepEqual(enfocados, ['[data-accion="casos"]']);
    assert.deepEqual(plano(vm.runInContext('pagina.estado.sin', pagina)), []);
    assert.deepEqual(urls, ['/reportes.html?estadistico=promedio']);
    assert.deepEqual(pedidos, ['/metricas?estadistico=promedio']);
    // Al redibujar la barra, el foco vuelve al mismo chip
    assert.equal(cargar({ document: { addEventListener() {}, getElementById: () => null, activeElement: chip } })
      .claveDelFoco({ contains: () => true }), '[data-accion="casos"]');
  });

  // Review Focus 1 (spec 2026-11-07-metricas-cajones-y-ciclos, 4): un marcador guardado con ?dias=habiles abre la pestaña en las dos
  // unidades. Al entrar, la dirección queda sin los días (mostrarPestana la vuelve a escribir con lo elegido) y la API se pide sin ellos
  it('un link viejo con ?dias=habiles: la dirección queda sin dias y la API se pide sin dias', () => {
    const urls = [];
    const pedidos = [];
    const elemento = (id) => ({
      id, innerHTML: '', textContent: '', hidden: false, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
      setAttribute() {}, removeAttribute() {}, addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, contains: () => false
    });
    const elementos = {};
    const pagina = cargar({
      __pedidos: pedidos,
      document: { addEventListener() {}, getElementById: (id) => (elementos[id] ??= elemento(id)), activeElement: null },
      history: { replaceState: (estado, titulo, url) => urls.push(url) },
      location: { pathname: '/reportes.html', search: '?estadistico=promedio&dias=habiles&sin=4', hash: '' }
    });
    vm.runInContext('API.pedirJson = (metodo, ruta) => { __pedidos.push(ruta); return new Promise(() => {}); };', pagina);
    pagina.iniciarReportes();
    assert.deepEqual(plano(vm.runInContext('pagina.estado', pagina)), { ...POR_DEFECTO, estadistico: 'promedio', sin: [4] });
    assert.deepEqual(urls, ['/reportes.html?estadistico=promedio&sin=4']);
    assert.ok(pedidos.includes('/metricas?estadistico=promedio&sin=4'), JSON.stringify(pedidos));
    assert.deepEqual(pedidos.filter((ruta) => ruta.includes('dias')), [], JSON.stringify(pedidos));
    assert.equal(elementos['mt-bajada'].textContent, ctx.textoDeLaBajada());
  });
});

describe('reportes.js: el circuito', () => {
  it('htmlDeFlecha: «27» + «días hábiles» + «mediana de 32 ciclos»; con 0, «En el día» + «mediana en días hábiles» y los ciclos en el texto', () => {
    const aviso = ctx.htmlDeFlecha(tramo('aviso', 27, { ciclos: 32 }));
    assert.match(aviso, /<span class="n">27 <small>días hábiles<\/small><\/span><span class="u">mediana de 32 ciclos<\/span>/);
    assert.match(aviso, /<span class="t">Aviso anticipado<\/span>/);
    assert.match(aviso, /<span class="c">Del aviso al vencimiento<\/span>/);
    assert.match(aviso, /<span class="mt-resp">DDPC<\/span>/);
    assert.doesNotMatch(aviso, /antes/, 'la cifra del aviso anticipado no lleva «antes»');
    assert.equal(cuantas(aviso, /32 ciclos/g), 1, 'la cantidad no se repite en el texto de la flecha');
    assert.doesNotMatch(aviso, /orientativo/);

    const cero = ctx.htmlDeFlecha(tramo('carga', 0, { ciclos: 23 }));
    assert.match(cero, /<span class="n">En el día<\/span><span class="u">mediana en días hábiles<\/span>/);
    assert.match(cero, /<span class="c"><b>23 ciclos<\/b><\/span>/);
    assert.doesNotMatch(cero, /<small>/);
    assert.match(ctx.htmlDeFlecha(tramo('carga', 0, { ciclos: 1 })), /<span class="o">con tan pocos casos, es orientativo<\/span>[\s\S]*<b>1 ciclo<\/b>/);
    // La página no compara el valor: la cantidad de ciclos va en el texto de la flecha cuando el servidor dice que es «En el día», y
    // con el texto del servidor
    const conMarca = tramo('carga', 7);
    assert.match(ctx.htmlDeFlecha({ ...conMarca, cifra: { ...conMarca.cifra, en_el_dia: true, ciclos_texto: 'Ciclos del servidor' } }), /<b>Ciclos del servidor<\/b>/);
    const sinMarca = tramo('carga', 0);
    assert.doesNotMatch(ctx.htmlDeFlecha({ ...sinMarca, cifra: { ...sinMarca.cifra, en_el_dia: false } }), /<b>/);

    // Con la cifra real: la redacción de la nota, con una nota DGMIT cargada (los casos de las pruebas). El aviso real lleva su cajón
    const conNota = con(fuentesDelCaso(52, { importados: { 7: { recibido_el: '2026-02-02', origen_datos: 'area' } } }), {
      notasDgmit: [notaDgmit({ recibida: '2026-01-05' })]
    });
    const real = tramoDe(vistaDe(casosDe(mapaDe(conNota), { hoy: HOY }), { anio: 2026, al: HOY }), 'externa', 'tramite');
    assert.match(ctx.htmlDeFlecha(real), new RegExp(`<span class="n">${real.cifra.texto} <small>${real.cifra.unidad}</small></span><span class="u">${real.cifra.debajo}</span>`));
    // El singular y los días corridos los manda el servidor tal cual
    assert.match(ctx.htmlDeFlecha(tramo('aviso', 1, { dias: 'corridos', estadistico: 'promedio', ciclos: 5 })), /1 <small>día corrido<\/small><\/span><span class="u">promedio de 5 ciclos/);
    assert.match(ctx.htmlDeFlecha(tramo('aviso', 40, { ciclos: 3 })), /<span class="o">con tan pocos casos, es orientativo<\/span>/);
  });

  // El cajón «Aviso anticipado» (spec 2026-11-06-metricas-anticipacion-y-corridos, 7)
  const CLASES_DEL_CAJON = /mt-anticipa|class="mt-flecha anticipa"/;

  it('htmlDeFlecha: el cajón del aviso con su frase y su línea', () => {
    const html = ctx.htmlDeFlecha({ ...tramo('aviso', 53, { ciclos: 32 }), anticipacion_texto: 'días hábiles de anticipación' });
    assert.match(html, /class="mt-flecha anticipa"/);
    assert.match(html, /<span class="n">53<\/span><span class="mt-anticipa-frase">días hábiles de anticipación<\/span><div class="mt-anticipa-tramo" aria-hidden="true">/);
    // La línea es un dibujo fijo: un punto, el trazo y un aro. El lector de pantalla la salta y lee las puntas
    assert.match(html, /<div class="mt-anticipa-tramo" aria-hidden="true"><span class="mt-anticipa-punto"><\/span><span class="mt-anticipa-linea"><\/span><span class="mt-anticipa-aro"><\/span><\/div>/);
    assert.match(html, /<div class="mt-anticipa-pie"><span>aviso<\/span><span>vencimiento<\/span><\/div><span class="u">mediana de 32 ciclos<\/span>/);
    assert.doesNotMatch(html, /<small>/);
    assert.doesNotMatch(html, /Del aviso al vencimiento/);
    assert.match(html, /<span class="t">Aviso anticipado<\/span>/);
    assert.match(html, /mt-resp/);
    // Después del estadístico, lo de siempre y en el orden de siempre
    assert.match(html, /<span class="u">mediana de 32 ciclos<\/span><span class="t">Aviso anticipado<\/span><div class="l" aria-hidden="true"><\/div><span class="mt-resp">DDPC<\/span><\/div>$/);
    assert.doesNotMatch(html, /orientativo/);
  });

  it('htmlDeFlecha: sin anticipacion_texto, el cajón de siempre', () => {
    const conCifra = tramo('aviso', 27, { ciclos: 32 });
    for (const t of [conCifra, { ...conCifra, anticipacion_texto: null }, { ...conCifra, anticipacion_texto: '' }, { ...conCifra, anticipacion_texto: true }]) {
      const html = ctx.htmlDeFlecha(t);
      assert.match(html, /^<div class="mt-flecha">/);
      assert.doesNotMatch(html, CLASES_DEL_CAJON);
      assert.match(html, /<span class="n">27 <small>días hábiles<\/small><\/span><span class="u">mediana de 32 ciclos<\/span>/);
      assert.match(html, /<span class="c">Del aviso al vencimiento<\/span>/);
    }
    // Sin cifra no hay número que acompañar, aunque llegue el texto
    const sinCifra = ctx.htmlDeFlecha({ ...tramo('aviso', null), anticipacion_texto: 'días hábiles de anticipación' });
    assert.match(sinCifra, /^<div class="mt-flecha vacia">/);
    assert.doesNotMatch(sinCifra, CLASES_DEL_CAJON);
    assert.doesNotMatch(sinCifra, /de anticipación/);
    assert.match(sinCifra, /<span class="n">Sin casos en 2026<\/span>/);
    assert.match(sinCifra, /<span class="c">Del aviso al vencimiento<\/span>/);
  });

  it('htmlDeFlecha: un aviso de 1 día lleva el singular del servidor y uno de 0, el cajón de siempre', () => {
    const unDia = ctx.htmlDeFlecha({ ...tramo('aviso', 1, { dias: 'corridos' }), anticipacion_texto: 'día corrido de anticipación' });
    assert.match(unDia, /<span class="n">1<\/span><span class="mt-anticipa-frase">día corrido de anticipación<\/span>/);
    const enElDia = ctx.htmlDeFlecha({ ...tramo('aviso', 0, { ciclos: 9 }), anticipacion_texto: null });
    assert.doesNotMatch(enElDia, CLASES_DEL_CAJON);
    assert.match(enElDia, /<span class="n">En el día<\/span><span class="u">mediana en días hábiles<\/span>/);
    assert.match(enElDia, /<span class="c">Del aviso al vencimiento<\/span><span class="c"><b>9 ciclos<\/b><\/span>/);
  });

  it('htmlDeFlecha: escapa lo del servidor en el cajón', () => {
    const malo = '<b>x</b>';
    const base = tramo('aviso', 53);
    const html = ctx.htmlDeFlecha({ ...base, nombre: malo, responsable: malo, anticipacion_texto: malo, cifra: { ...base.cifra, texto: malo, debajo: malo } });
    assert.doesNotMatch(html, /<b>/);
    assert.match(html, /<span class="n">&lt;b&gt;x&lt;\/b&gt;<\/span><span class="mt-anticipa-frase">&lt;b&gt;x&lt;\/b&gt;<\/span>/);
    assert.equal(cuantas(html, /&lt;b&gt;x&lt;\/b&gt;/g), 5, 'el número, la frase, el estadístico, el nombre y quién está a cargo');
  });

  it('el orientativo sigue debajo del estadístico', () => {
    const html = ctx.htmlDeFlecha({ ...tramo('aviso', 40, { ciclos: 3 }), anticipacion_texto: 'días hábiles de anticipación' });
    assert.match(html, /<\/div><span class="u">mediana de 3 ciclos<\/span><span class="o">con tan pocos casos, es orientativo<\/span><span class="t">/);
  });

  it('el circuito: el cajón nuevo solo en el aviso de cada gestión', () => {
    for (const g of ['externa', 'interna']) {
      const html = ctx.htmlDeCircuito(VISTA, g);
      assert.equal(cuantas(html, /class="mt-flecha anticipa"/g), 1, g);
      assert.equal(cuantas(html, /class="mt-anticipa-tramo"/g), 1, g);
      assert.equal(html.match(/class="mt-flecha[^"]*"/)[0], 'class="mt-flecha anticipa"', `${g}: es la primera etapa`);
    }
  });

  it('el CSS: la letra de los otros cajones y el alto contraste', () => {
    const pagina = leer('reportes.html');
    const regla = (selector) => {
      const desde = pagina.indexOf(`${selector} {`);
      assert.notEqual(desde, -1, selector);
      return pagina.slice(desde, pagina.indexOf('}', desde));
    };
    // Bordes y no fondos: con forced-colors, el navegador saca los fondos y deja los bordes
    assert.match(regla('.mt-anticipa-linea'), /border-top: 2px solid currentColor/);
    assert.doesNotMatch(regla('.mt-anticipa-linea'), /background/);
    assert.match(regla('.mt-anticipa-punto'), /width: 9px; height: 9px;/);
    assert.match(regla('.mt-anticipa-punto'), /border: 2px solid currentColor/);
    assert.match(regla('.mt-anticipa-aro'), /width: 11px; height: 11px;/);
    assert.match(regla('.mt-anticipa-aro'), /border: 2px solid currentColor/);
    assert.match(regla('.mt-anticipa-aro'), /background: #F4F8FC/);
    // El punto sigue lleno en alto contraste, con el color del sistema: después de su regla, que tiene la misma especificidad
    const altoContraste = pagina.indexOf('@media (forced-colors: active) {');
    assert.ok(pagina.indexOf('.mt-anticipa-punto {') < altoContraste);
    const bloque = pagina.slice(altoContraste, pagina.indexOf('@media (forced-colors: active) and', altoContraste));
    assert.match(bloque, /\.mt-anticipa-punto \{[^}]*forced-color-adjust: none;[^}]*background: CanvasText;[^}]*border-color: CanvasText;[^}]*\}/);
    // La cifra conserva su letra: el cajón no pisa .n
    assert.doesNotMatch(pagina, /\.anticipa \.n\b/);
    assert.doesNotMatch(pagina, /\.anticipa \.n small/);
    // Los dos tienen la misma especificidad: va después, para que el aire del estadístico sea el del cajón
    assert.ok(pagina.indexOf('.mt-flecha .u {') < pagina.indexOf('.anticipa .u {'));
    assert.match(regla('.anticipa .u'), /margin-top: 8px/);
    assert.match(regla('.mt-anticipa-pie'), /justify-content: space-between/);
    // Este cajón no lleva la frase de cómo se cuenta: .l queda anteúltima, y mostrada, sin alto, le da a la insignia el aire de las otras tarjetas
    assert.ok(pagina.includes('.mt-flecha > :nth-last-child(2) { margin-bottom: 10px; }'));
    assert.ok(pagina.indexOf('.mt-flecha .l {') < pagina.indexOf('.anticipa .l {'));
    assert.match(regla('.anticipa .l'), /display: block/);
    // Si la frase va en dos renglones, no se separan más que los de abajo
    assert.match(regla('.mt-anticipa-frase'), /line-height: 1\.25/);
  });

  // Spec 2026-11-07-metricas-cajones-y-ciclos, 3: los hábiles, en la tinta de su tarjeta (como el número), y sin las clases de lo que salió
  it('el CSS: los hábiles en la tinta de la tarjeta; sin los pendientes ni los en curso', () => {
    const pagina = leer('reportes.html');
    const desde = pagina.indexOf('.mt-flecha .h {');
    assert.notEqual(desde, -1);
    const regla = pagina.slice(desde, pagina.indexOf('}', desde));
    assert.match(regla, /font-size: 0\.8rem;/);
    assert.match(regla, /font-weight: 700;/);
    assert.match(regla, /color: var\(--sg-tinta\);/);
    // En la DGMIT, violeta; en la del área, su color: con las reglas del número
    assert.match(pagina, /\.mt-flecha\.dgmit \.n, \.mt-flecha\.dgmit \.h, \.mt-flecha\.dgmit \.u, \.mt-flecha\.dgmit \.t \{ color: var\(--sg-violeta\); \}/);
    assert.match(pagina, /\.mt-tramos\.externa > \.mt-flecha:nth-child\(6\) \.h(, [^{]*)? \{ color: var\(--sg-del-area\); \}/);
    // Después de la regla común, que tiene menos especificidad
    assert.ok(desde < pagina.indexOf('.mt-flecha.dgmit .n, .mt-flecha.dgmit .h'));
    assert.doesNotMatch(pagina, /\.mt-flecha \.c\.(pend|curso)/);
  });

  // Review Focus 2 (spec 2026-11-07-metricas-cajones-y-ciclos, 3): un tramo con solo ciclos en curso, sin cifra, dice el vacío y la frase.
  // Los en curso ya no van en el cajón: van en el modal de su tramo
  it('un tramo con solo ciclos en curso: el vacío y la frase, sin los en curso; la DGMIT en violeta', () => {
    const real = tramoDe(vistaReal({ dias: 'corridos' }), 'interna', 'produccion');
    assert.ok(real.en_curso && real.en_curso.n > 0 && real.cifra === null, JSON.stringify(real.en_curso));
    const html = ctx.htmlDeFlecha(real);
    assert.match(html, /^<div class="mt-flecha dgmit vacia">/);
    assert.ok(html.includes(`<span class="n">${real.vacio.titulo}</span><span class="t">Producción del relevamiento</span><div class="l" aria-hidden="true"></div>`
      + `<span class="c">${real.como_se_cuenta}</span><span class="mt-resp">DGMIT y DIT</span></div>`), html);
    assert.equal(real.como_se_cuenta, 'Se cuenta desde que la DGMIT y la DIT reciben el aviso hasta que entregan el relevamiento a la DDPC.');
    assert.doesNotMatch(html, /sin datos registrados|Se cuenta hasta|class="c curso"|class="h"/);
    // Con cifra, tampoco: la cifra, sus hábiles y la frase
    const conCifra = ctx.htmlDeFlecha({ ...tramo('produccion', 45, { dias: 'corridos', en_curso: { n: 3, valor: 206, texto: '3 sin datos registrados todavía, hace 206 días corridos (mediana)' } }),
      como_se_cuenta: real.como_se_cuenta, habiles_texto: '(31 días hábiles)' });
    assert.match(conCifra, /^<div class="mt-flecha dgmit">/);
    assert.match(conCifra, /45 <small>días corridos<\/small><\/span><span class="h">\(31 días hábiles\)<\/span>/);
    assert.ok(conCifra.includes(`<span class="c">${real.como_se_cuenta}</span>`));
    assert.doesNotMatch(conCifra, /sin datos registrados|Se cuenta hasta|class="c curso"/);
  });

  it('el tramo vacío de la DGMIT dice «Todavía no hay notas DGMIT cargadas» y la frase; los pendientes van en el modal', () => {
    const tramite = tramoDe(vistaReal({ dias: 'corridos' }), 'externa', 'tramite');
    assert.equal(tramite.vacio.titulo, SIN_NOTAS_DGMIT);
    assert.match(tramite.vacio.texto, /^\d+ notas pendientes de carga de ciclos abiertos$/);
    const html = ctx.htmlDeFlecha(tramite);
    assert.match(html, /^<div class="mt-flecha dgmit vacia">/);
    assert.ok(html.includes(`<span class="n">Todavía no hay notas DGMIT cargadas</span><span class="t">Redacción y entrega de nota</span><div class="l" aria-hidden="true"></div>`
      + `<span class="c">${tramite.como_se_cuenta}</span><span class="mt-resp">DGMIT y DA</span></div>`), html);
    assert.equal(cuantas(html, /pendientes? de carga/g), 0, 'los pendientes no van en el cajón');
    assert.doesNotMatch(html, /<span class="u">/, 'sin cifra no hay estadístico');
    // El del área, mientras tanto, con su porqué después de la frase
    const respuesta = tramoDe(vistaReal({ dias: 'corridos' }), 'externa', 'respuesta');
    const area = ctx.htmlDeFlecha(respuesta);
    assert.ok(area.includes(`<span class="n">Sin datos todavía</span><span class="t">Respuesta del área</span><div class="l" aria-hidden="true"></div>`
      + `<span class="c">${respuesta.como_se_cuenta}</span><span class="c">Se empieza a contar cuando haya notas DGMIT cargadas</span>`), area);
    // Con notas cargadas, la cifra y sus hábiles, sin los pendientes (el 52 con una nota DGMIT del 05/01/2026: su ciclo abierto sigue
    // pendiente de carga)
    const conNota = con(fuentesDelCaso(52, { importados: { 7: { recibido_el: '2026-02-02', origen_datos: 'area' } } }), {
      notasDgmit: [notaDgmit({ recibida: '2026-01-05' })]
    });
    const conNotas = tramoDe(vistaDe(casosDe(mapaDe(conNota), { hoy: HOY }), { anio: 2026, al: HOY, dias: 'corridos' }), 'externa', 'tramite');
    assert.equal(conNotas.pendientes_texto, '1 nota pendiente de carga de un ciclo abierto');
    const conCifra = ctx.htmlDeFlecha(conNotas);
    assert.ok(conCifra.includes(`<span class="n">${conNotas.cifra.texto} <small>${conNotas.cifra.unidad}</small></span><span class="h">${conNotas.habiles_texto}</span>`), conCifra);
    assert.doesNotMatch(conCifra, /pendientes? de carga|class="c pend"/);
    // Con o sin el texto, la página no lo escribe
    assert.doesNotMatch(ctx.htmlDeFlecha(tramo('tramite', 12, { pendientes: 3, pendientes_texto: 'Texto del servidor' })), /Texto del servidor|class="c pend"/);
    // Sin cifra y con el texto del vacío, tampoco: lo distingue la clave del tramo
    assert.doesNotMatch(ctx.htmlDeFlecha({ ...tramo('tramite', null), vacio: { titulo: SIN_NOTAS_DGMIT, texto: 'Texto del servidor' } }), /Texto del servidor/);
  });

  // Spec 2026-11-07-metricas-cajones-y-ciclos, 3: una sola frase por cajón, «Se cuenta desde … hasta …», en lugar de «desde → hasta»; los
  // hábiles entre paréntesis debajo del número
  it('htmlDeFlecha: la frase del servidor y los hábiles debajo del número, en cada tramo real', () => {
    for (const estadistico of ['mediana', 'promedio']) {
      for (const vista of [vistaReal({ dias: 'corridos', estadistico }), vistaDe(casosDe(mapaDe(con(fuentesDelCaso(52, {
        importados: { 7: { recibido_el: '2026-02-02', origen_datos: 'area' } }
      }), { notasDgmit: [notaDgmit({ recibida: '2026-01-05' })] })), { hoy: HOY }), { anio: 2026, al: HOY, dias: 'corridos', estadistico })]) {
        for (const g of ['externa', 'interna']) {
          for (const t of vista.circuito[g]) {
            const html = ctx.htmlDeFlecha(t);
            const donde = `${estadistico} ${g} ${t.clave}`;
            assert.ok(t.como_se_cuenta.startsWith('Se cuenta desde '), donde);
            const anticipa = t.cifra !== null && typeof t.anticipacion_texto === 'string' && t.anticipacion_texto !== '';
            // El aviso con su línea no lleva la frase: lo dice el dibujo
            assert.equal(html.includes(`<span class="c">${t.como_se_cuenta}</span>`), !anticipa, donde);
            assert.ok(!html.includes(t.desde_hasta), `${donde}: sin «desde → hasta»`);
            assert.doesNotMatch(html, /class="c pend"|class="c curso"|Se cuenta hasta|sin datos registrados/, donde);
            if (t.habiles_texto === '') {
              assert.doesNotMatch(html, /class="h"/, donde);
            } else if (anticipa) {
              assert.ok(html.includes(`<span class="mt-anticipa-frase">${t.anticipacion_texto}</span><span class="h">${t.habiles_texto}</span><div class="mt-anticipa-tramo"`), donde);
            } else {
              assert.ok(html.includes(`<small>${t.cifra.unidad}</small></span><span class="h">${t.habiles_texto}</span><span class="u">${t.cifra.debajo}</span>`), donde);
            }
          }
        }
      }
    }
  });

  it('htmlDeFlecha: el cajón entero, en su orden, con la frase y los hábiles', () => {
    const FRASE = 'Se cuenta desde que la DGMIT y la DA entregan la nota hasta que la DDPC recibe la actualización.';
    const respuesta = { ...tramo('respuesta', 64, { dias: 'corridos', ciclos: 3, en_curso: { n: 2, valor: 9, texto: '2 sin datos registrados todavía, hace 9 días corridos (mediana)' } }),
      como_se_cuenta: FRASE, habiles_texto: '(45 días hábiles)' };
    assert.equal(ctx.htmlDeFlecha(respuesta), '<div class="mt-flecha"><span class="n">64 <small>días corridos</small></span><span class="h">(45 días hábiles)</span>'
      + '<span class="u">mediana de 3 ciclos</span><span class="o">con tan pocos casos, es orientativo</span><span class="t">Respuesta del área</span>'
      + `<div class="l" aria-hidden="true"></div><span class="c">${FRASE}</span><span class="mt-resp">Área</span></div>`);
    // Con «En el día», sin paréntesis (el servidor manda '') y con los ciclos después de la frase
    const enElDia = { ...tramo('carga', 0, { dias: 'corridos', ciclos: 9 }), como_se_cuenta: 'Se cuenta desde X hasta Y.', habiles_texto: '' };
    assert.match(ctx.htmlDeFlecha(enElDia), /<span class="n">En el día<\/span><span class="u">mediana en días corridos<\/span>[\s\S]*<span class="c">Se cuenta desde X hasta Y\.<\/span><span class="c"><b>9 ciclos<\/b><\/span><span class="mt-resp">/);
    // Con corridos y 0 hábiles, lo que dice el servidor
    assert.match(ctx.htmlDeFlecha({ ...enElDia, cifra: { ...tramo('carga', 3, { dias: 'corridos' }).cifra }, habiles_texto: '(En el día, en días hábiles)' }),
      /<small>días corridos<\/small><\/span><span class="h">\(En el día, en días hábiles\)<\/span><span class="u">/);
    // Sin cifra, el paréntesis no va aunque llegue
    assert.doesNotMatch(ctx.htmlDeFlecha({ ...tramo('carga', null), como_se_cuenta: 'Se cuenta desde X hasta Y.', habiles_texto: '(3 días hábiles)' }), /class="h"|3 días hábiles/);
  });

  it('htmlDeFlecha: el aviso con su línea lleva los hábiles y no la frase; sin la línea, la frase', () => {
    const FRASE = 'Se cuenta desde que el RPAD avisa hasta el vencimiento.';
    const html = ctx.htmlDeFlecha({ ...tramo('aviso', 51, { dias: 'corridos', ciclos: 32 }), anticipacion_texto: 'días corridos de anticipación', como_se_cuenta: FRASE, habiles_texto: '(35 días hábiles)' });
    assert.match(html, /<span class="n">51<\/span><span class="mt-anticipa-frase">días corridos de anticipación<\/span><span class="h">\(35 días hábiles\)<\/span><div class="mt-anticipa-tramo" aria-hidden="true">/);
    assert.match(html, /<span class="u">mediana de 32 ciclos<\/span><span class="t">Aviso anticipado<\/span><div class="l" aria-hidden="true"><\/div><span class="mt-resp">DDPC<\/span><\/div>$/);
    assert.doesNotMatch(html, /Se cuenta desde|Del aviso al vencimiento/);
    // Con «En el día» o sin cifra no hay línea: la frase, como cualquier cajón
    for (const t of [{ ...tramo('aviso', 0, { dias: 'corridos' }), anticipacion_texto: null }, tramo('aviso', null)]) {
      const sinLinea = ctx.htmlDeFlecha({ ...t, como_se_cuenta: FRASE, habiles_texto: '' });
      assert.doesNotMatch(sinLinea, /mt-anticipa/);
      assert.ok(sinLinea.includes(`<span class="c">${FRASE}</span>`), sinLinea);
      assert.doesNotMatch(sinLinea, /Del aviso al vencimiento/);
    }
  });

  // Review Focus 5 (spec 2026-11-07-metricas-cajones-y-ciclos, 7): una foto sacada antes de las claves nuevas
  it('htmlDeFlecha: sin como_se_cuenta (una foto vieja), «desde → hasta»; sin habiles_texto, sin paréntesis', () => {
    const viejo = tramo('respuesta', 64, { dias: 'corridos' });
    assert.ok(!('como_se_cuenta' in viejo) && !('habiles_texto' in viejo));
    const html = ctx.htmlDeFlecha(viejo);
    assert.ok(html.includes('<span class="c">De la nota a la entrega</span>'), html);
    assert.doesNotMatch(html, /class="h"/);
    // Lo que no es un texto tampoco se escribe
    for (const raro of [null, true, {}, '']) {
      const conRaro = ctx.htmlDeFlecha({ ...viejo, como_se_cuenta: raro, habiles_texto: raro });
      assert.ok(conRaro.includes('<span class="c">De la nota a la entrega</span>'), String(raro));
      assert.doesNotMatch(conRaro, /class="h"|null|undefined|object/, String(raro));
    }
  });

  it('htmlDeCircuito: los nodos de cada gestión, en orden, con las flechas entre ellos', () => {
    // Un nodo con tramo es un botón (el modal de su tramo); el Portal, un <div>
    const nodos = (html) => [...html.matchAll(/<(?:div|button)[^>]* class="mt-nodo[^"]*"[^>]*><span class="q">([^<]+)<\/span><span class="r">([^<]+)<\/span>/g)].map((m) => `${m[1]} / ${m[2]}`);
    const externa = ctx.htmlDeCircuito(VISTA, 'externa');
    assert.deepEqual(nodos(externa), ['RPAD / Datos Públicos avisa', 'DGMIT y Dirección Administrativa / Mandan la nota formal',
      'Área responsable / Prepara los datos', 'Datos Públicos / Limpia y estructura', 'Portal / Datos publicados']);
    assert.equal(cuantas(externa, /<div class="mt-flecha/g), 4);
    assert.match(externa, /^<div class="mt-tramos externa" role="group" aria-label="El circuito de la gestión externa">/);
    assert.match(externa, /<button type="button" class="mt-nodo dgmit" data-tramo="tramite" data-gestion="externa" [^>]*><span class="q">DGMIT y Dirección Administrativa/);
    assert.match(externa, /<div class="mt-nodo fin"><span class="q">Portal/);
    // El CSS ubica cada hijo por su lugar (spec 2026-11-05-circuito-diseno, 5): el Área es el quinto y su etapa, el sexto
    const hijos = [...externa.matchAll(/<(?:div|button type="button") class="(mt-nodo|mt-flecha)[^"]*"/g)].map((m) => m[1]);
    assert.deepEqual(hijos, ['mt-nodo', 'mt-flecha', 'mt-nodo', 'mt-flecha', 'mt-nodo', 'mt-flecha', 'mt-nodo', 'mt-flecha', 'mt-nodo']);
    // Cada flecha entre sus dos nodos: el aviso anticipado va del RPAD a la DGMIT (el título de la tarjeta: el nombre del tramo también
    // está en el nombre del botón de su nodo)
    const delAviso = externa.indexOf('<span class="t">Aviso anticipado</span>');
    assert.ok(externa.indexOf('Datos Públicos avisa') < delAviso && delAviso < externa.indexOf('Mandan la nota formal'));
    const interna = ctx.htmlDeCircuito(VISTA, 'interna');
    assert.deepEqual(nodos(interna), ['RPAD / Datos Públicos avisa', 'DGMIT y Dirección de Investigación Territorial / Hacen el relevamiento',
      'Datos Públicos / Limpia y estructura', 'Portal / Datos publicados']);
    assert.equal(cuantas(interna, /<div class="mt-flecha/g), 3);
    assert.match(interna, /Producción del relevamiento/);
    // Cada flecha va por la clave de su tramo, no por su lugar en la lista; la que falta queda vacía
    const desordenada = { circuito: { externa: [...VISTA.circuito.externa].reverse() } };
    assert.equal(ctx.htmlDeCircuito(desordenada, 'externa'), externa);
    const sinTramite = ctx.htmlDeCircuito({ circuito: { externa: VISTA.circuito.externa.filter((t) => t.clave !== 'tramite') } }, 'externa');
    assert.equal(cuantas(sinTramite, /<div class="mt-flecha/g), 4);
    assert.ok(sinTramite.indexOf('Mandan la nota formal') < sinTramite.indexOf('Respuesta del área'));
    assert.match(externa, /Redacción y entrega de nota/);
    assert.doesNotMatch(sinTramite, /Redacción y entrega de nota/);
    assert.equal(ctx.htmlDeCircuito(null, 'externa'), '');
    assert.equal(ctx.htmlDeCircuito({}, 'externa'), '');
  });
});

// La banda abre el modal de cada tramo (spec 2026-11-07-metricas-cajones-y-ciclos, 5): cada nodo con tramo es un botón y el modal lo arma
// entero el servidor (tramo.modal, modalDelTramo de services/metricasReglas.js, con el gráfico de services/metricasGrafico.js); la página
// solo lo dibuja. Los tramos y los ciclos a mano son inventados
describe('reportes.js: la banda y el modal de cada tramo', () => {
  const BOTON = /<button type="button" class="mt-nodo([^"]*)" data-tramo="([a-z]+)" data-gestion="([a-z]+)" aria-haspopup="dialog" aria-label="([^"]*)">/g;
  const FRASE_DE_LA_RESPUESTA = 'Se cuenta desde que la DGMIT y la DA entregan la nota hasta que la DDPC recibe la actualización.';
  const SIN_TEXTO = 'Calculado sin 1 dataset: Dataset de ejemplo.';
  const ETIQUETA_DEL_GRAFICO = 'Un punto por ciclo según sus días corridos. La lista de abajo tiene los mismos datos.';
  // Tres ciclos que cuentan (uno en el día) y uno en curso, con la forma de los de modalDelTramo
  const CICLOS = [
    { dataset_id: 7, titulo: 'Dataset de ejemplo', area: 'Área de ejemplo', estado: 'cuenta', desde: '2026-03-02', hasta: '2026-05-05', hasta_texto: '',
      dias_texto: '64 días corridos (45 hábiles)', nota: '' },
    { dataset_id: 8, titulo: 'Otro dataset', area: 'Otra área', estado: 'cuenta', desde: '2026-04-01', hasta: '2026-05-21', hasta_texto: '',
      dias_texto: '50 días corridos (34 hábiles)', nota: '' },
    { dataset_id: 9, titulo: 'Un tercer dataset', area: 'Área de ejemplo', estado: 'cuenta', desde: '2026-06-10', hasta: '2026-06-10', hasta_texto: '',
      dias_texto: 'En el día', nota: '' },
    { dataset_id: 12, titulo: 'Dataset abierto', area: 'Otra área', estado: 'en_curso', desde: '2026-08-14', hasta: null, hasta_texto: 'en curso',
      dias_texto: 'hace 71 días corridos (49 hábiles)', nota: '' }
  ];
  const DIAS_DE_LOS_CICLOS = [64, 50, 0, 71];
  const graficoDe = (ciclos, linea) => graficoDelTramo(ciclos.map((c, i) => ({ valor: DIAS_DE_LOS_CICLOS[i], estado: c.estado, titulo: `${c.titulo}: ${c.dias_texto}` })), { linea });
  const modalAMano = (cambios = {}) => ({
    quien: 'Área responsable · gestión externa',
    leyenda: [{ marca: 'cuenta', texto: '3 ciclos cuentan en la cifra' }, { marca: 'en_curso', texto: '1 en curso, todavía no cuenta' }],
    como_se_cuenta: ['1 ciclo abierto todavía no tiene datos registrados, hace 71 días corridos (49 hábiles, mediana): cuenta cuando se registra la actualización.'],
    lista: 'Los ciclos (4)',
    puntas: ['Nota DGMIT', 'Datos recibidos'],
    ciclos: CICLOS,
    vacio: '',
    grafico: graficoDe(CICLOS, { valor: 50, texto: 'mediana: 50 días corridos' }),
    ...cambios
  });
  const tramoConModal = (cambios = {}) => ({
    ...tramo('respuesta', 50, { dias: 'corridos', ciclos: 3 }), como_se_cuenta: FRASE_DE_LA_RESPUESTA, habiles: null, habiles_texto: '(34 días hábiles)',
    modal: modalAMano(), ...cambios
  });
  // Las filas de la tabla del modal (sin la de los títulos)
  const filasDe = (html) => [...(html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '').matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);

  it('htmlDeCircuito: cada nodo con tramo es un botón «Ver los ciclos»; el Portal sigue siendo un <div>', () => {
    for (const [g, claves] of [['externa', ['aviso', 'tramite', 'respuesta', 'carga']], ['interna', ['aviso', 'produccion', 'carga']]]) {
      const html = ctx.htmlDeCircuito(VISTA, g);
      const botones = [...html.matchAll(BOTON)];
      // Todos, también el de un tramo sin ciclos (la respuesta del área): el modal dice por qué
      assert.deepEqual(botones.map((m) => m[2]), claves, g);
      assert.deepEqual(botones.map((m) => m[3]), claves.map(() => g), g);
      assert.deepEqual(botones.map((m) => m[4]), claves.map((clave) => `Ver los ciclos de ${tramoDe(VISTA, g, clave).nombre}`), g);
      // Lo de la DGMIT sigue en violeta
      assert.deepEqual(botones.map((m) => m[1]), claves.map((clave) => (['tramite', 'produccion'].includes(clave) ? ' dgmit' : '')), g);
      // Cada uno: quién, qué hace y «Ver los ciclos», con su ícono fuera del lector de pantalla
      const enteros = [...html.matchAll(/<button type="button" class="mt-nodo[\s\S]*?<\/button>/g)].map((m) => m[0]);
      assert.equal(enteros.length, claves.length, g);
      for (const boton of enteros) {
        assert.match(boton, /<span class="q">[^<]+<\/span><span class="r">[^<]+<\/span><span class="mt-ver"><svg aria-hidden="true" [^>]*>(?:(?!<\/svg>)[\s\S])*<\/svg><span>Ver los ciclos<\/span><\/span><\/button>$/, boton);
      }
      assert.match(html, /<div class="mt-nodo fin"><span class="q">Portal<\/span><span class="r">Datos publicados<\/span><\/div><\/div>$/, g);
      // El orden de los hijos de .mt-tramos no cambió: la grilla los ubica por su lugar (nth-child)
      const hijos = [...html.matchAll(/<(?:div|button type="button") class="(mt-nodo|mt-flecha)[^"]*"/g)].map((m) => m[1]);
      assert.deepEqual(hijos, [...claves.flatMap(() => ['mt-nodo', 'mt-flecha']), 'mt-nodo'], g);
    }
  });

  // Review Focus 5: una foto sacada antes de las claves nuevas (y la vista en hábiles, que no trae modal)
  it('un tramo sin modal: su nodo es el <div> de siempre, sin botón', () => {
    for (const modal of [undefined, null, 'x', [], 0]) {
      const html = ctx.htmlDeCircuito({ circuito: { externa: VISTA.circuito.externa.map((t) => ({ ...t, modal })) } }, 'externa');
      assert.doesNotMatch(html, /<button|data-tramo|Ver los ciclos|aria-haspopup/, String(modal));
      assert.equal(cuantas(html, /<div class="mt-nodo[^"]*"><span class="q">[^<]+<\/span><span class="r">[^<]+<\/span><\/div>/g), 5, String(modal));
    }
    const sinElDelTramite = { circuito: { externa: VISTA.circuito.externa.map((t) => (t.clave === 'tramite' ? { ...t, modal: null } : t)) } };
    assert.deepEqual([...ctx.htmlDeCircuito(sinElDelTramite, 'externa').matchAll(BOTON)].map((m) => m[2]), ['aviso', 'respuesta', 'carga']);
    assert.doesNotMatch(ctx.htmlDeCircuito(vistaReal({ dias: 'habiles' }), 'externa'), /<button/);
    // Sin el tramo, tampoco
    assert.deepEqual([...ctx.htmlDeCircuito({ circuito: { interna: [tramoDe(VISTA, 'interna', 'carga')] } }, 'interna').matchAll(BOTON)].map((m) => m[2]), ['carga']);
  });

  it('htmlDelModal: el título, quién, la frase, la cifra con sus hábiles, la leyenda, el gráfico, «Cómo se cuenta» y los ciclos, en ese orden; sin las claves nuevas (una foto vieja), «Días» y la fecha sola', () => {
    const t = tramoConModal();
    const html = ctx.htmlDelModal(t);
    assert.ok(html.startsWith('<div class="modal-header"><div class="mt-modal-cabeza"><h2 class="modal-title" id="mt-modal-titulo">Respuesta del área</h2>'
      + '<p class="mt-modal-quien">Área responsable · gestión externa</p></div>'
      + '<button type="button" class="modal-close" data-cerrar aria-label="Cerrar">&times;</button></div><div class="modal-body mt-color-area">'), html);
    assert.doesNotMatch(html, /mt-franja/);
    const piezas = [`<p class="mt-modal-frase">${FRASE_DE_LA_RESPUESTA}</p>`,
      '<div class="mt-modal-cifra"><span class="n">50 <small>días corridos</small></span><span class="h">(34 días hábiles)</span>'
        + '<span class="u">mediana de 3 ciclos</span><span class="o">con tan pocos casos, es orientativo</span></div>',
      '<ul class="mt-modal-leyenda"><li><svg class="mt-ley-cuenta" aria-hidden="true"', '3 ciclos cuentan en la cifra</li><li><svg class="mt-ley-curso" aria-hidden="true"',
      '1 en curso, todavía no cuenta</li></ul>',
      ctx.svgDelGrafico(t.modal.grafico),
      `<h3 class="mt-modal-h3">Cómo se cuenta</h3><ul class="mt-modal-como"><li>${t.modal.como_se_cuenta[0]}</li></ul>`,
      '<h3 class="mt-modal-h3" id="mt-modal-lista">Los ciclos (4)</h3><div class="mt-modal-tabla" tabindex="0" role="group" aria-labelledby="mt-modal-lista"><table class="mt-tabla">'
        + '<thead><tr><th scope="col">Dataset</th><th scope="col">Nota DGMIT</th><th scope="col">Datos recibidos</th><th scope="col">Días</th></tr></thead>'];
    const lugares = piezas.map((pieza) => html.indexOf(pieza));
    assert.ok(lugares.every((lugar, i) => lugar !== -1 && (i === 0 || lugar > lugares[i - 1])), JSON.stringify(lugares));
    assert.ok(t.modal.grafico !== null && piezas[5].startsWith('<svg class="mt-grafico"'));
    // Cada ciclo con el link a su Seguimiento y su área debajo, las dos fechas y los días; el en curso, «en curso» y «hace …»
    assert.deepEqual(filasDe(html), [
      '<td class="t"><a href="seguimiento.html?id=7">Dataset de ejemplo</a><small>Área de ejemplo</small></td><td>02/03/2026</td><td>05/05/2026</td><td>64 días corridos (45 hábiles)</td>',
      '<td class="t"><a href="seguimiento.html?id=8">Otro dataset</a><small>Otra área</small></td><td>01/04/2026</td><td>21/05/2026</td><td>50 días corridos (34 hábiles)</td>',
      '<td class="t"><a href="seguimiento.html?id=9">Un tercer dataset</a><small>Área de ejemplo</small></td><td>10/06/2026</td><td>10/06/2026</td><td>En el día</td>',
      '<td class="t"><a href="seguimiento.html?id=12">Dataset abierto</a><small>Otra área</small></td><td>14/08/2026</td><td><span class="mt-curso">en curso</span></td>'
        + '<td class="mt-curso">hace 71 días corridos (49 hábiles)</td>'
    ]);
    assert.ok(html.endsWith('</tbody></table></div></div>'), html.slice(-80));
    // Sin el modal, nada
    for (const sinModal of [null, undefined, {}, { ...t, modal: null }, { ...t, modal: [] }]) assert.equal(ctx.htmlDelModal(sinModal), '');
  });

  it('htmlDelModal: el rótulo de los días del servidor y el número de la nota DGMIT junto a su fecha, en un renglón', () => {
    const conNotas = (primero) => CICLOS.map((c, i) => ({ ...c, desde_nota_dgmit: i === 0 ? primero.desde : '', hasta_nota_dgmit: i === 0 ? primero.hasta : '' }));
    const modalCon = (ciclos) => tramoConModal({ modal: modalAMano({ puntas: ['Entrega de nota DGMIT', 'Datos recibidos'], rotulo_de_los_dias: 'Días de circuito y producción', ciclos }) });
    const html = ctx.htmlDelModal(modalCon(conNotas({ desde: '(N° 7/26)', hasta: '' })));
    assert.ok(html.includes('<thead><tr><th scope="col">Dataset</th><th scope="col">Entrega de nota DGMIT</th><th scope="col">Datos recibidos</th><th scope="col">Días de circuito y producción</th></tr></thead>'), html);
    const filas = filasDe(html);
    assert.ok(filas[0].includes('<td><span class="nro">02/03/2026 (N° 7/26)</span></td><td>05/05/2026</td>'), filas[0]);
    assert.ok(filas[1].includes('<td>01/04/2026</td><td>21/05/2026</td>'));
    assert.ok(filas[2].includes('<td>10/06/2026</td><td>10/06/2026</td>'));
    assert.ok(filas[3].includes('<td>14/08/2026</td><td><span class="mt-curso">en curso</span></td>'));
    assert.doesNotMatch(filas.slice(1).join(''), /nro/);
    const hasta = filasDe(ctx.htmlDelModal(modalCon(conNotas({ desde: '', hasta: '(N° 9/26)' }))));
    assert.ok(hasta[0].includes('<td>02/03/2026</td><td><span class="nro">05/05/2026 (N° 9/26)</span></td>'), hasta[0]);
    const curso = conNotas({ desde: '', hasta: '' });
    curso[3].hasta_nota_dgmit = '(N° 9/26)';
    const enCurso = filasDe(ctx.htmlDelModal(modalCon(curso)))[3];
    assert.ok(enCurso.includes('<td><span class="mt-curso">en curso</span></td>'), enCurso);
    assert.doesNotMatch(enCurso, /nro|N° 9/);
  });

  it('reportes.html: el número de la nota DGMIT no se parte', () => {
    assert.match(leer('reportes.html'), /\.mt-modal-tabla \.nro \{ white-space: nowrap; \}/);
  });

  it('htmlDelModal: la nota pendiente de carga, el avisado ya vencido y un dataset sin id; lo de la DGMIT en violeta', () => {
    const ciclos = [
      { dataset_id: 21, titulo: 'Dataset avisado', area: 'Área de ejemplo', estado: 'cuenta', desde: '2026-01-02', hasta: '2026-02-10', hasta_texto: '',
        dias_texto: '39 días corridos (26 hábiles)', nota: 'avisado ya vencido: desde ese primer aviso' },
      { dataset_id: '3#x', titulo: 'Dataset sin id', area: null, estado: 'cuenta', desde: '2026-02-02', hasta: '2026-02-20', hasta_texto: '',
        dias_texto: '18 días corridos (14 hábiles)', nota: '' },
      { dataset_id: 22, titulo: 'Dataset sin nota', area: 'Otra área', estado: 'pendiente', desde: '2026-05-04', hasta: null, hasta_texto: 'pendiente de carga',
        dias_texto: '—', nota: '' }
    ];
    const t = { ...tramo('tramite', 39, { dias: 'corridos', ciclos: 2 }), como_se_cuenta: 'Se cuenta desde que la DGMIT y la DA reciben el aviso hasta que entregan la nota.',
      habiles_texto: '(26 días hábiles)', modal: modalAMano({ quien: 'DGMIT y Dirección Administrativa · gestión externa', puntas: ['Aviso', 'Nota DGMIT'], ciclos,
        leyenda: [{ marca: 'cuenta', texto: '2 ciclos cuentan en la cifra' }, { marca: 'pendiente', texto: '1 nota pendiente de carga, sin días' }], lista: 'Los ciclos (3)' }) };
    const html = ctx.htmlDelModal(t);
    assert.match(html, /<div class="modal-body mt-color-violeta">/);
    assert.match(html, /<li><svg class="mt-ley-pend" aria-hidden="true"[^>]*>(?:(?!<\/svg>)[\s\S])*<\/svg>1 nota pendiente de carga, sin días<\/li>/);
    assert.ok(html.includes('<th scope="col">Aviso</th><th scope="col">Nota DGMIT</th>'));
    assert.deepEqual(filasDe(html), [
      '<td class="t"><a href="seguimiento.html?id=21">Dataset avisado</a><small>Área de ejemplo</small></td><td>02/01/2026<span class="d">avisado ya vencido: desde ese primer aviso</span></td>'
        + '<td>10/02/2026</td><td>39 días corridos (26 hábiles)</td>',
      '<td class="t">Dataset sin id</td><td>02/02/2026</td><td>20/02/2026</td><td>18 días corridos (14 hábiles)</td>',
      '<td class="t"><a href="seguimiento.html?id=22">Dataset sin nota</a><small>Otra área</small></td><td>04/05/2026</td><td><span class="mt-pend">pendiente de carga</span></td><td>—</td>'
    ]);
    // Las marcas de la leyenda son tres formas (lleno, aro con flecha, punteado): nunca solo el color; una marca que no es de la lista no va
    const marcas = ctx.htmlDelModal(tramoConModal({ modal: modalAMano({ leyenda: [{ marca: 'cuenta', texto: 'a' }, { marca: 'en_curso', texto: 'b' },
      { marca: 'pendiente', texto: 'c' }, { marca: '__proto__', texto: 'd' }, { marca: 'cuenta', texto: '' }] }) }));
    const leyenda = marcas.match(/<ul class="mt-modal-leyenda">([\s\S]*?)<\/ul>/)[1];
    assert.deepEqual([...leyenda.matchAll(/<li>(?:<svg class="([a-z-]+)"[\s\S]*?<\/svg>)?([^<]*)<\/li>/g)].map((m) => `${m[1] ?? ''}:${m[2]}`),
      ['mt-ley-cuenta:a', 'mt-ley-curso:b', 'mt-ley-pend:c', ':d']);
    assert.match(leyenda, /<svg class="mt-ley-curso"[^>]*><circle [^>]*\/><path [^>]*\/><\/svg>/);
    assert.doesNotMatch(marcas, /\[object|undefined|null/);
  });

  it('htmlDelModal: la cifra del aviso con su anticipación; sin cifra, el título y el texto del vacío; sin ciclos, el vacío del servidor y ninguna tabla', () => {
    // El aviso real: el número con «días corridos de anticipación» y sus hábiles
    const aviso = tramoDe(VISTA, 'externa', 'aviso');
    assert.ok(aviso.cifra && aviso.anticipacion_texto && aviso.habiles_texto);
    assert.ok(ctx.htmlDelModal(aviso).includes(`<div class="mt-modal-cifra"><span class="n">${aviso.cifra.texto} <small>${aviso.anticipacion_texto}</small></span>`
      + `<span class="h">${aviso.habiles_texto}</span><span class="u">${aviso.cifra.debajo}</span>`));
    assert.match(ctx.htmlDelModal(aviso), /<div class="modal-body mt-color-tinta">/);
    // La respuesta real: sin cifra y sin ciclos
    const respuesta = tramoDe(VISTA, 'externa', 'respuesta');
    assert.ok(respuesta.cifra === null && respuesta.modal.ciclos.length === 0 && respuesta.modal.vacio !== '');
    const sinCiclos = ctx.htmlDelModal(respuesta);
    assert.ok(sinCiclos.includes(`<div class="mt-modal-cifra vacia"><span class="n">${respuesta.vacio.titulo}</span><span class="u">${respuesta.vacio.texto}</span></div>`), sinCiclos);
    assert.ok(sinCiclos.includes(`<h3 class="mt-modal-h3" id="mt-modal-lista">${respuesta.modal.lista}</h3><p class="mt-vacio">${respuesta.modal.vacio}</p></div>`), sinCiclos);
    assert.doesNotMatch(sinCiclos, /<table|mt-modal-tabla|Cómo se cuenta|<svg|mt-modal-leyenda/);
    // La redacción real sin notas cargadas: el título y el texto del vacío (spec 5: «Sin cifra, el título y el texto del vacío»), también
    // aunque los pendientes estén en la leyenda y en «Cómo se cuenta» (en el cajón, no: ahí van en el modal)
    const tramite = tramoDe(VISTA, 'externa', 'tramite');
    assert.ok(tramite.cifra === null && tramite.vacio.texto !== '');
    const deLaDgmit = ctx.htmlDelModal(tramite);
    assert.ok(deLaDgmit.includes(`<div class="mt-modal-cifra vacia"><span class="n">${tramite.vacio.titulo}</span><span class="u">${tramite.vacio.texto}</span></div>`), deLaDgmit);
    assert.ok(deLaDgmit.includes(`${tramite.modal.leyenda[0].texto}</li>`) && deLaDgmit.includes(`<li>${tramite.modal.como_se_cuenta[0]}</li>`));
    // Con datos a mano: la redacción y la respuesta sin cifra, cada una con su título y su texto; sin texto, solo el título
    for (const [clave, titulo, texto] of [['tramite', SIN_NOTAS_DGMIT, '4 notas pendientes de carga de ciclos abiertos'],
      ['respuesta', 'Sin datos todavía', 'Se empieza a contar cuando haya notas DGMIT cargadas']]) {
      const html = ctx.htmlDelModal({ ...tramoConModal(), ...tramo(clave, null), vacio: { titulo, texto } });
      assert.ok(html.includes(`<div class="mt-modal-cifra vacia"><span class="n">${titulo}</span><span class="u">${texto}</span></div>`), clave);
      assert.ok(ctx.htmlDelModal({ ...tramoConModal(), ...tramo(clave, null), vacio: { titulo, texto: '' } })
        .includes(`<div class="mt-modal-cifra vacia"><span class="n">${titulo}</span></div>`), `${clave} sin texto`);
    }
    // Sin pendientes ni ciclos con días, sin gráfico; con ciclos, la tabla
    assert.equal(tramite.modal.grafico, null);
    assert.equal(filasDe(deLaDgmit).length, tramite.modal.ciclos.length);
    // Un vacío del servidor gana aunque lleguen ciclos; sin ninguna línea, sin «Cómo se cuenta»
    const conVacio = ctx.htmlDelModal(tramoConModal({ modal: modalAMano({ vacio: 'Sin ciclos en 2026.', como_se_cuenta: [] }) }));
    assert.doesNotMatch(conVacio, /<table|Cómo se cuenta/);
    assert.ok(conVacio.includes('<p class="mt-vacio">Sin ciclos en 2026.</p>'));
  });

  // Review Focus 2: un tramo con solo ciclos en curso (sin cifra): los aros, sin la línea del estadístico
  it('un tramo con solo ciclos en curso: el vacío y los aros con su flecha, sin la línea', () => {
    const produccion = tramoDe(VISTA, 'interna', 'produccion');
    assert.ok(produccion.cifra === null && produccion.modal.grafico !== null && produccion.modal.grafico.linea === null);
    const html = ctx.htmlDelModal(produccion);
    assert.ok(html.includes(`<div class="mt-modal-cifra vacia"><span class="n">${produccion.vacio.titulo}</span></div>`));
    assert.equal(cuantas(html, /<g class="p-curso">/g), produccion.modal.grafico.puntos.length);
    assert.doesNotMatch(html, /class="p-cuenta"|class="linea|mt-ley-cuenta/);
    // La lista dice «en curso» y «hace …», con la marca del avisado ya vencido
    const [fila] = filasDe(html);
    const [ciclo] = produccion.modal.ciclos;
    assert.ok(fila.endsWith(`<span class="d">${ciclo.nota}</span></td><td><span class="mt-curso">en curso</span></td><td class="mt-curso">${ciclo.dias_texto}</td>`), fila);
  });

  // Review Focus 3: los destildados no están en el modal, como no están en la cifra, y el modal repite la franja
  it('con destildados: el modal no los lista, cuenta lo de la cifra y repite la franja «Calculado sin…»', () => {
    const aviso = tramoDe(VISTA, 'externa', 'aviso');
    const id = aviso.modal.ciclos[0].dataset_id;
    const sin = tramoDe(vistaReal({ sin: [id] }), 'externa', 'aviso');
    assert.ok(sin.modal.ciclos.every((c) => c.dataset_id !== id));
    assert.equal(sin.modal.ciclos.filter((c) => c.estado === 'cuenta').length, sin.cifra.ciclos);
    const html = ctx.htmlDelModal(sin, { sinTexto: SIN_TEXTO });
    assert.ok(!html.includes(`seguimiento.html?id=${id}"`));
    assert.equal(filasDe(html).length, sin.modal.ciclos.length);
    assert.ok(html.includes(`<p class="mt-modal-quien">${sin.modal.quien}</p><p class="mt-franja mt-modal-franja">${SIN_TEXTO}</p></div>`), html.slice(0, 400));
    // Sin el link «Volver a todos» (es de la pestaña); sin destildados, sin franja
    assert.doesNotMatch(html, /Volver a todos|data-accion/);
    for (const sinTexto of ['', null, undefined, {}]) assert.doesNotMatch(ctx.htmlDelModal(sin, { sinTexto }), /mt-franja/, String(sinTexto));
  });

  it('svgDelGrafico: los puntos, los aros con su flecha, la línea, los «+N» y el eje, con las coordenadas del servidor', () => {
    for (const nada of [null, undefined, {}, 'x', { ancho: 760 }]) assert.equal(ctx.svgDelGrafico(nada), '', String(nada));
    // Una columna de 11 que cuentan con 30 días (8 dibujados y «+3»), uno de 12 y dos en curso
    const puntos = [...Array.from({ length: 11 }, (_, i) => ({ valor: 30, estado: 'cuenta', titulo: `Dataset ${String(i)}: 30 días corridos (21 hábiles)` })),
      { valor: 12, estado: 'cuenta', titulo: 'Dataset A: 12 días corridos (8 hábiles)' },
      { valor: 95, estado: 'en_curso', titulo: 'Dataset B: hace 95 días corridos (66 hábiles)' },
      { valor: 140, estado: 'en_curso', titulo: 'Dataset C: hace 140 días corridos (97 hábiles)' }];
    const g = graficoDelTramo(puntos, { linea: { valor: 30, texto: 'mediana: 30 días corridos' } });
    assert.ok(g.mas.length === 1 && g.linea !== null);
    const svg = ctx.svgDelGrafico(g);
    assert.ok(svg.startsWith(`<svg class="mt-grafico" viewBox="0 0 ${coord(g.ancho)} ${coord(g.alto)}" role="img" aria-label="${ETIQUETA_DEL_GRAFICO}" xmlns="http://www.w3.org/2000/svg">`), svg.slice(0, 200));
    assert.ok(svg.endsWith('</svg>'));
    const R = GRAFICO.radio;
    // Un círculo lleno por punto que cuenta (el anillo blanco lo da el CSS: el trazo de 2 sale 1 afuera, lo que mide el servidor)
    const cuentan = g.puntos.filter((p) => p.estado === 'cuenta');
    assert.equal(cuantas(svg, /<g class="p-cuenta">/g), cuentan.length);
    for (const p of cuentan) assert.ok(svg.includes(`<g class="p-cuenta"><title>${p.titulo}</title><circle cx="${coord(p.x)}" cy="${coord(p.y)}" r="${coord(R)}"/></g>`), p.titulo);
    // Un aro por punto en curso, con su flecha a la derecha: de afuera del aro hasta GRAFICO.flecha, donde termina lo que mide el servidor
    const enCurso = g.puntos.filter((p) => p.estado === 'en_curso');
    assert.equal(enCurso.length, 2);
    assert.equal(cuantas(svg, /<g class="p-curso">/g), 2);
    for (const p of enCurso) {
      const punta = p.x + R + GRAFICO.flecha;
      assert.ok(svg.includes(`<g class="p-curso"><title>${p.titulo}</title><circle cx="${coord(p.x)}" cy="${coord(p.y)}" r="${coord(R)}"/>`
        + `<path d="M${coord(p.x + R + 1)} ${coord(p.y)}H${coord(punta)}M${coord(punta - 3.5)} ${coord(p.y - 3.5)}L${coord(punta)} ${coord(p.y)}L${coord(punta - 3.5)} ${coord(p.y + 3.5)}"/></g>`), p.titulo);
    }
    // La línea del estadístico con su rótulo; el «+N»; el eje de la primera marca a la última, con una rayita y su número en cada una, y «días corridos»
    const { linea, eje } = g;
    assert.ok(svg.includes(`<line x1="${coord(linea.x)}" y1="${coord(linea.y0)}" x2="${coord(linea.x)}" y2="${coord(linea.y1)}" class="linea"/>`));
    assert.ok(svg.includes(`<text x="${coord(linea.rotulo.x)}" y="${coord(linea.rotulo.y)}" text-anchor="${linea.rotulo.anclaje}" class="linea-r">mediana: 30 días corridos</text>`));
    assert.ok(svg.includes(`<text x="${coord(g.mas[0].x)}" y="${coord(g.mas[0].y)}" text-anchor="middle" class="mas">+3</text>`));
    assert.ok(svg.includes(`<line x1="${coord(eje.marcas[0].x)}" y1="${coord(eje.y)}" x2="${coord(eje.marcas.at(-1).x)}" y2="${coord(eje.y)}" class="eje"/>`));
    for (const m of eje.marcas) {
      assert.ok(svg.includes(`<line x1="${coord(m.x)}" y1="${coord(eje.y)}" x2="${coord(m.x)}" y2="${coord(eje.y + 5)}" class="eje"/>`), m.texto);
      assert.ok(svg.includes(`<text x="${coord(m.x)}" y="${coord(m.y)}" text-anchor="middle" class="eje-n">${m.texto}</text>`), m.texto);
    }
    assert.ok(svg.includes(`<text x="${coord(eje.rotulo.x)}" y="${coord(eje.rotulo.y)}" text-anchor="end" class="eje-r">días corridos</text>`));
    // La línea, antes que los puntos: los de su columna la tapan con su anillo blanco
    assert.ok(svg.indexOf('class="linea"') < svg.indexOf('<g class="p-'));
    // Sin cifra, sin línea
    const sinLinea = ctx.svgDelGrafico(graficoDelTramo(puntos.slice(-2), { linea: null }));
    assert.doesNotMatch(sinLinea, /class="linea/);
    assert.equal(cuantas(sinLinea, /<g class="p-curso">/g), 2);
    // Lo que no se puede leer no se dibuja: un punto sin x, un estado que no es de la lista, un «+N» sin texto
    const raro = ctx.svgDelGrafico({ ...g, puntos: [{ x: 'a', y: 1, estado: 'cuenta', titulo: 't' }, { x: 1, y: 2, estado: '"><x', titulo: 't' }],
      mas: [{ x: 1, y: 2, texto: '' }], linea: { ...linea, rotulo: { ...linea.rotulo, anclaje: '"><script>' } } });
    assert.doesNotMatch(raro, /<g class="p-|class="mas"|<script>|"><x|NaN|undefined|null/);
    assert.match(raro, /text-anchor="start" class="linea-r"/);
  });

  it('la página dibuja los puntos con el radio y la flecha del servidor (copias de GRAFICO, atadas)', () => {
    assert.equal(vm.runInContext('RADIO_DEL_PUNTO', ctx), GRAFICO.radio);
    assert.equal(vm.runInContext('FLECHA_DEL_EN_CURSO', ctx), GRAFICO.flecha);
    // La rayita del eje entra en el lugar que deja el servidor (los números, con su base 18 debajo de la línea: hasta 6)
    assert.ok(vm.runInContext('RAYITA_DEL_EJE', ctx) <= 6);
  });

  it('todo lo del servidor escapado: un título <b>"x"</b> en la tabla y en el <title> de su punto, y en el nombre del botón', () => {
    const malo = '<b>"x"</b>';
    const escapado = '&lt;b&gt;&quot;x&quot;&lt;/b&gt;';
    const ciclos = [{ ...CICLOS[0], titulo: malo, area: malo, dias_texto: malo, nota: malo, desde_nota_dgmit: malo }, { ...CICLOS[3], hasta_texto: malo, dias_texto: malo }];
    const grafico = graficoDe(ciclos, { valor: 64, texto: malo });
    grafico.eje.marcas[0].texto = malo;
    grafico.eje.rotulo.texto = malo;
    grafico.mas = [{ x: 30, y: 40, texto: malo }];
    const t = tramoConModal({ nombre: malo, como_se_cuenta: malo, habiles_texto: malo, cifra: { ...tramo('respuesta', 64).cifra, texto: malo, unidad: malo, debajo: malo },
      modal: modalAMano({ quien: malo, leyenda: [{ marca: 'cuenta', texto: malo }], como_se_cuenta: [malo], lista: malo, puntas: [malo, malo], rotulo_de_los_dias: malo, ciclos, grafico }) });
    const html = ctx.htmlDelModal(t, { sinTexto: malo });
    assert.doesNotMatch(html, /<b>|"x"/);
    assert.ok(html.includes(`<a href="seguimiento.html?id=7">${escapado}</a>`));
    assert.ok(html.includes(`<title>${escapado}: ${escapado}</title>`));
    // El nombre, quién, la franja, la frase, la cifra (tres), los hábiles, la leyenda, «Cómo se cuenta», la lista, las dos puntas, el rótulo de
    // la línea, el primer número y el rótulo del eje, el «+N», los dos <title> (el primero con dos) y, en la tabla, el título, el área, la
    // nota, los días (dos) y «en curso», más el rótulo de los días y el número de la nota
    assert.equal(cuantas(html, /&lt;b&gt;&quot;x&quot;&lt;\/b&gt;/g), 28);
    // El vacío del cajón y el del servidor, con el nombre y la frase
    const vacio = ctx.htmlDelModal({ ...t, cifra: null, vacio: { titulo: malo, texto: malo }, modal: modalAMano({ vacio: malo }) });
    assert.doesNotMatch(vacio, /<b>/);
    assert.equal(cuantas(vacio, /&lt;b&gt;/g), 5);
    // El nombre del botón de la banda
    const banda = ctx.htmlDeCircuito({ circuito: { externa: [{ ...tramoConModal(), clave: 'aviso', nombre: malo }] } }, 'externa');
    assert.ok(banda.includes(`aria-label="Ver los ciclos de ${escapado}"`), banda);
    assert.doesNotMatch(banda, /<b>/);
  });

  it('un 0 se escribe como 0, y nada dice NaN, null ni undefined', () => {
    const g = graficoDe(CICLOS, null);
    const svg = ctx.svgDelGrafico({ ...g, puntos: [{ x: 0, y: 0, estado: 'cuenta', titulo: '0' }], mas: [{ x: 0, y: 0, texto: '0' }] });
    assert.ok(svg.includes('<g class="p-cuenta"><title>0</title><circle cx="0" cy="0" r="5.5"/></g>'));
    assert.ok(svg.includes('<text x="0" y="0" text-anchor="middle" class="mas">0</text>'));
    assert.ok(svg.includes(`text-anchor="middle" class="eje-n">0</text>`));
    const cero = ctx.htmlDelModal(tramoConModal({ modal: modalAMano({ lista: '0', vacio: '0', leyenda: [{ marca: 'cuenta', texto: '0' }] }) }));
    assert.ok(cero.includes('<h3 class="mt-modal-h3" id="mt-modal-lista">0</h3><p class="mt-vacio">0</p>'));
    assert.match(cero, /<\/svg>0<\/li>/);
    const vacios = [ctx.htmlDelModal({ modal: {} }), ctx.htmlDelModal({ clave: 'respuesta', modal: { ciclos: [{}, null, { desde: '2026-01-02', desde_nota_dgmit: null, hasta_nota_dgmit: 0 }], rotulo_de_los_dias: null, leyenda: [null, {}], como_se_cuenta: [null, 3], puntas: [] } }),
      ctx.svgDelGrafico({ ancho: 760, alto: 100, eje: {}, puntos: [{}, null], mas: [{}], linea: {} })].join('');
    assert.doesNotMatch(vacios, /NaN|null|undefined|\[object/);
  });

  // Un document de mentira con lo que tocan el modal y la pestaña: cada elemento guarda sus oyentes y sus clases, y anota a quién va el foco
  const conDocumento = () => {
    const enfocados = [];
    const oyentes = {};
    const elementos = {};
    const elemento = (id) => {
      const clases = new Set();
      return {
        id, innerHTML: '', textContent: '', hidden: false, dataset: {},
        classList: { add: (clase) => clases.add(clase), remove: (clase) => clases.delete(clase), toggle() {}, contains: (clase) => clases.has(clase) },
        setAttribute() {}, removeAttribute() {}, querySelectorAll: () => [], querySelector: () => null, contains: () => false, closest: () => null,
        focus: () => enfocados.push(id), addEventListener: (tipo, fn) => (oyentes[`${id}:${tipo}`] ??= []).push(fn)
      };
    };
    const app = { inert: false };
    const body = { style: { overflow: '' } };
    const documento = {
      addEventListener: (tipo, fn) => (oyentes[`document:${tipo}`] ??= []).push(fn),
      getElementById: (id) => (elementos[id] ??= elemento(id)),
      querySelector: (selector) => (selector === '.app-container' ? app : null),
      activeElement: null, body
    };
    const disparar = (clave, evento) => { for (const fn of oyentes[clave] ?? []) fn(evento); };
    return { enfocados, elementos, app, body, documento, disparar, porId: documento.getElementById };
  };

  it('abrir y cerrar: la página inerte y quieta, el foco a la × y de vuelta al botón de la banda (o al chip de la gestión)', () => {
    const d = conDocumento();
    const pagina = cargar({ document: d.documento, setTimeout: (fn) => fn(), __vista: VISTA, __sin: SIN_TEXTO });
    const consultas = [];
    let boton = { focus: () => d.enfocados.push('botón') };
    d.porId('mt-modal-contenido').querySelector = (selector) => (selector === '.modal-close' ? { focus: () => d.enfocados.push('×') } : null);
    d.porId('mt-circuito').querySelector = (selector) => { consultas.push(selector); return boton; };
    d.porId('mt-gestiones').querySelector = (selector) => { consultas.push(selector); return { focus: () => d.enfocados.push('chip') }; };
    const velo = d.porId('mt-modal-tramo');
    vm.runInContext('pagina.datos = { vista: __vista, sin_texto: __sin };', pagina);

    pagina.abrirModalDelTramo('externa', 'respuesta');
    assert.ok(velo.classList.contains('active'));
    assert.equal(d.app.inert, true);
    assert.equal(d.body.style.overflow, 'hidden');
    assert.equal(d.porId('mt-modal-contenido').innerHTML, ctx.htmlDelModal(tramoDe(VISTA, 'externa', 'respuesta'), { sinTexto: SIN_TEXTO }));
    assert.deepEqual(d.enfocados, ['×']);
    assert.deepEqual(plano(vm.runInContext('pagina.modal', pagina)), { gestion: 'externa', clave: 'respuesta' });

    pagina.cerrarModalDelTramo();
    assert.ok(!velo.classList.contains('active'));
    assert.equal(d.app.inert, false);
    assert.equal(d.body.style.overflow, '');
    assert.deepEqual(d.enfocados, ['×', 'botón']);
    assert.deepEqual(consultas, ['button[data-tramo="respuesta"][data-gestion="externa"]']);
    assert.equal(vm.runInContext('pagina.modal', pagina), null);
    // Cerrar sin un modal abierto no hace nada
    pagina.cerrarModalDelTramo();
    assert.deepEqual(d.enfocados, ['×', 'botón']);

    // Si el botón ya no está, el foco va al chip de la gestión elegida
    boton = null;
    vm.runInContext("pagina.estado.gestion = 'interna';", pagina);
    pagina.abrirModalDelTramo('interna', 'produccion');
    pagina.cerrarModalDelTramo();
    assert.deepEqual(d.enfocados.slice(-1), ['chip']);
    assert.deepEqual(consultas.slice(-2), ['button[data-tramo="produccion"][data-gestion="interna"]', 'button[data-selector="gestion"][data-valor="interna"]']);

    // Sin modal no abre: el Portal, un tramo de la otra gestión, uno que no es del circuito y uno sin modal
    for (const [gestion, clave] of [['externa', 'portal'], ['interna', 'tramite'], ['externa', '"]x'], ['otra', 'aviso']]) {
      pagina.abrirModalDelTramo(gestion, clave);
      assert.ok(!velo.classList.contains('active'), `${gestion} ${clave}`);
    }
    vm.runInContext('pagina.datos = { vista: { circuito: { externa: [{ ...__vista.circuito.externa[0], modal: null }] } } };', pagina);
    pagina.abrirModalDelTramo('externa', 'aviso');
    assert.ok(!velo.classList.contains('active'));
    assert.equal(d.app.inert, false);
  });

  it('la banda abre el modal; la ×, un clic que empieza y termina en el velo y Escape lo cierran', () => {
    const d = conDocumento();
    const pagina = cargar({ document: d.documento, setTimeout: (fn) => fn(), history: { replaceState() {} },
      location: { pathname: '/reportes.html', search: '', hash: '' }, __vista: VISTA });
    vm.runInContext('API.pedirJson = () => new Promise(() => {});', pagina);
    pagina.iniciarReportes();
    vm.runInContext("pagina.datos = { vista: __vista, sin_texto: '' };", pagina);
    const velo = d.porId('mt-modal-tramo');
    const abierto = () => velo.classList.contains('active');
    const enLaBanda = (dataset) => ({ target: { closest: (selector) => (selector === 'button[data-tramo]' && dataset ? { dataset } : null) } });
    const adentro = { closest: () => null };
    const abrir = () => {
      d.disparar('mt-circuito:click', enLaBanda({ tramo: 'carga', gestion: 'externa' }));
      assert.ok(abierto());
      assert.deepEqual(plano(vm.runInContext('pagina.modal', pagina)), { gestion: 'externa', clave: 'carga' });
    };
    // Un clic en la banda fuera de un botón no abre nada
    d.disparar('mt-circuito:click', enLaBanda(null));
    assert.ok(!abierto());

    abrir();
    d.disparar('document:keydown', { key: 'Enter' });
    assert.ok(abierto());
    d.disparar('document:keydown', { key: 'Escape' });
    assert.ok(!abierto());

    abrir();
    d.disparar('mt-modal-tramo:mousedown', { target: adentro });
    d.disparar('mt-modal-tramo:click', { target: { closest: (selector) => (selector === '[data-cerrar]' ? {} : null) } });
    assert.ok(!abierto(), 'la ×');

    abrir();
    d.disparar('mt-modal-tramo:mousedown', { target: adentro });
    d.disparar('mt-modal-tramo:click', { target: adentro });
    assert.ok(abierto(), 'un clic adentro');
    d.disparar('mt-modal-tramo:mousedown', { target: adentro });
    d.disparar('mt-modal-tramo:click', { target: velo });
    assert.ok(abierto(), 'soltar en el velo una selección que empezó adentro');
    d.disparar('mt-modal-tramo:mousedown', { target: velo });
    d.disparar('mt-modal-tramo:click', { target: velo });
    assert.ok(!abierto(), 'un clic en el velo');
  });

  it('un Escape antes de que termine la entrada: el foco queda en el botón de la banda, no va a la × del modal cerrado', () => {
    const d = conDocumento();
    const esperando = [];
    const pagina = cargar({ document: d.documento, setTimeout: (fn) => esperando.push(fn), history: { replaceState() {} },
      location: { pathname: '/reportes.html', search: '', hash: '' }, __vista: VISTA });
    vm.runInContext('API.pedirJson = () => new Promise(() => {});', pagina);
    pagina.iniciarReportes();
    vm.runInContext("pagina.datos = { vista: __vista, sin_texto: '' };", pagina);
    d.porId('mt-modal-contenido').querySelector = (selector) => (selector === '.modal-close' ? { focus: () => d.enfocados.push('×') } : null);
    d.porId('mt-circuito').querySelector = () => ({ focus: () => d.enfocados.push('botón') });
    const velo = d.porId('mt-modal-tramo');

    pagina.abrirModalDelTramo('externa', 'respuesta');
    assert.equal(esperando.length, 1);
    d.disparar('document:keydown', { key: 'Escape' });
    assert.ok(!velo.classList.contains('active'));
    esperando.shift()();
    assert.deepEqual(d.enfocados, ['botón']);

    // Abierto, el foco va a la × cuando termina la entrada
    pagina.abrirModalDelTramo('externa', 'respuesta');
    esperando.shift()();
    assert.deepEqual(d.enfocados, ['botón', '×']);
  });

  it('cargarMetricas cierra el modal antes de dibujar y el foco va al botón nuevo del mismo tramo', async () => {
    const d = conDocumento();
    const datos = { anio: 2026, anios: [2026], al: HOY, en_vivo: true, aviso_foto: null, fotos: [], vista: VISTA, cinta: cintasDeLaVista(VISTA, {}),
      contexto: CONTEXTO, trabajo: TRABAJO, areas: AREAS, sin_titulos: [], sin_texto: '' };
    const pagina = cargar({ document: d.documento, setTimeout: (fn) => fn(), history: { replaceState() {} },
      location: { pathname: '/reportes.html', search: '', hash: '' }, __datos: datos });
    const velo = d.porId('mt-modal-tramo');
    // La banda anota si se dibujó con el modal abierto, y tiene el botón del aviso solo después de dibujarse
    const circuito = d.porId('mt-circuito');
    const dibujos = [];
    let banda = '';
    Object.defineProperty(circuito, 'innerHTML', {
      get: () => banda,
      set: (html) => { dibujos.push(velo.classList.contains('active') ? 'con el modal abierto' : 'con el modal cerrado'); banda = html; }
    });
    circuito.querySelector = (selector) => (selector === 'button[data-tramo="aviso"][data-gestion="externa"]' && banda.includes('data-tramo="aviso"')
      ? { focus: () => d.enfocados.push('el botón nuevo') } : null);
    vm.runInContext('API.pedirJson = async (metodo, ruta) => ({ data: ruta.startsWith("/metricas") ? __datos : [] }); pagina.datos = __datos;', pagina);
    pagina.abrirModalDelTramo('externa', 'aviso');
    assert.ok(velo.classList.contains('active'));
    await pagina.cargarMetricas();
    assert.ok(!velo.classList.contains('active'));
    assert.equal(d.app.inert, false);
    assert.equal(d.body.style.overflow, '');
    assert.deepEqual(dibujos, ['con el modal cerrado']);
    assert.equal(d.enfocados.at(-1), 'el botón nuevo');
    assert.equal(d.porId('mt-contenido').hidden, false);
  });

  // Spec 2026-11-08-metricas-recorrido-tipico, 5: una cinta con la forma de antes (la de una foto vieja) no se dibuja ni deja su frase
  it('dibujarElCircuito: con la cinta de antes oculta la sección y vacía su frase; con la de ahora, la muestra', () => {
    const d = conDocumento();
    const vieja = { ancho: 1000, alto: 156, segmentos: [], aclaracion: 'Una frase de la cinta de antes.' };
    const pagina = cargar({ document: d.documento, __vista: VISTA, __cinta: { externa: vieja, interna: CINTA_INTERNA }, __nueva: { externa: CINTA_EXTERNA } });
    const dibujar = (cinta, gestion) => vm.runInContext(`pagina.estado = { ...pagina.estado, gestion: '${gestion}' }; dibujarElCircuito({ vista: __vista, cinta: ${cinta} })`, pagina);
    // La cinta de ahora: se muestra, con su frase
    dibujar('__nueva', 'externa');
    assert.equal(d.porId('mt-cinta').hidden, false);
    assert.equal(d.porId('mt-cinta').innerHTML, ctx.htmlDeCinta(CINTA_EXTERNA));
    assert.equal(d.porId('mt-aclaracion-cinta').textContent, CINTA_EXTERNA.aclaracion);
    assert.notEqual(CINTA_EXTERNA.aclaracion, '');
    // La de antes: oculta, sin nada adentro y sin frase (aunque la traiga)
    dibujar('__cinta', 'externa');
    assert.equal(d.porId('mt-cinta').hidden, true);
    assert.equal(d.porId('mt-cinta').innerHTML, '');
    assert.equal(d.porId('mt-aclaracion-cinta').textContent, '');
    // Sin cinta de esa gestión, lo mismo
    dibujar('__nueva', 'interna');
    assert.equal(d.porId('mt-cinta').hidden, true);
    assert.equal(d.porId('mt-aclaracion-cinta').textContent, '');
  });
});

// El recorrido típico (spec 2026-11-08-metricas-recorrido-tipico, 3 y 5): la página imprime lo que arma cintaDeMetricas (los textos, los
// anchos, la x del vencimiento y el largo de la regla) sin calcular nada. Las cifras de los tramos son inventadas
describe('reportes.js: el recorrido típico', () => {
  const escapado = (texto) => ctx.Utils.escapeHtml(texto);
  // Lo que lee una persona: sin las etiquetas y con los espacios juntos
  const sinEtiquetas = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  // Un recorrido de la gestión externa en días corridos, con hábiles: el aviso, la redacción, la respuesta y la carga
  const externa = (aviso, tramite, respuesta, carga, opciones = {}) => cintaDeMetricas([
    tramo('aviso', aviso[0], { dias: 'corridos', habiles: aviso[1] }), tramo('tramite', tramite[0], { dias: 'corridos', habiles: tramite[1] }),
    tramo('respuesta', respuesta[0], { dias: 'corridos', habiles: respuesta[1] }), tramo('carga', carga[0], { dias: 'corridos', habiles: carga[1] })
  ], { gestion: 'externa', dias: 'corridos', ...opciones });

  it('htmlDeCinta imprime lo que manda el servidor', () => {
    for (const cinta of [CINTA_INTERNA, CINTA_EXTERNA]) {
      const html = ctx.htmlDeCinta(cinta);
      assert.ok(html.startsWith('<div class="mt-rec"><h3 class="mt-rec-titulo">El recorrido típico</h3>'));
      assert.ok(html.includes(`<p class="mt-rec-bajada">${cinta.bajada}</p>`));
      assert.ok(html.includes(`<div class="mt-rec-dibujo" role="img" aria-label="${escapado(cinta.descripcion)}">`));
      // El total, con la cifra en negrita
      assert.ok(html.includes(`<span>${cinta.total.antes}<b>${cinta.total.cifra}</b>${cinta.total.despues}</span>`), 'total');
      // Cada tramo a escala: su ancho, su actor, su cifra grande, su nombre y sus días
      assert.equal(cuantas(html, /class="mt-rec-parte /g), cinta.partes.length + 1, 'los tramos y la carga');
      for (const p of cinta.partes) {
        assert.ok(html.includes(`<div class="mt-rec-parte ${p.actor}${p.angosta ? ' angosta' : ''}" style="width:${coord(p.ancho)}%">`
          + `<div class="mt-rec-textos"><p class="mt-rec-grande">${p.grande}</p><p class="mt-rec-nombre">${p.nombre}</p><p class="mt-rec-dias">${p.dias}</p></div>`
          + '<div class="mt-rec-pista"><i class="mt-rec-hito" aria-hidden="true"></i></div></div>'), p.clave);
      }
      // La carga, de ancho fijo y con el círculo del Portal; el Portal al lado
      const c = cinta.carga;
      assert.ok(html.includes(`<div class="mt-rec-fin"><div class="mt-rec-parte ${c.actor}"><div class="mt-rec-textos"><p class="mt-rec-grande">${c.grande}</p><p class="mt-rec-nombre">${c.nombre}</p>`
        + `<p class="mt-rec-dias">${c.dias}</p></div><div class="mt-rec-pista"><i class="mt-rec-hito" aria-hidden="true"></i><i class="mt-rec-meta" aria-hidden="true"></i></div></div>`), 'carga');
      assert.ok(html.includes(`<p class="mt-rec-portal"><b>${cinta.portal.nombre}</b> ${cinta.portal.texto}</p>`), 'portal');
      // El vencimiento y la regla del aviso
      assert.ok(html.includes(`<span class="mt-rec-vence" style="left:${coord(cinta.vencimiento.x)}%" aria-hidden="true"></span>`), 'vencimiento');
      const a = cinta.aviso;
      assert.ok(html.includes(`<div class="mt-rec-aviso" style="width:${coord(a.ancho)}%">`), 'regla');
      assert.ok(html.includes(`<b>${a.rotulo}</b> ${a.texto}</span>`), 'texto del aviso');
      assert.ok(html.includes(`<i class="mt-rec-tope" aria-hidden="true"></i></div><em class="mt-rec-aviso-venc">${a.vencimiento}</em></div>`), 'tope y «vencimiento»');
      // La regla es el contenedor (el CSS le mira el ancho) y la fila va adentro; «vencimiento» es hermano de la fila, no hijo: el texto que baja
      // no lo mueve. El texto está entre los dos rieles, para que el CSS pueda esconder el segundo
      assert.ok(html.includes(`<div class="mt-rec-aviso" style="width:${coord(a.ancho)}%"><div class="mt-rec-aviso-fila"><i class="mt-rec-rombo" aria-hidden="true"></i>`
        + '<span class="mt-rec-riel" aria-hidden="true"></span><span class="mt-rec-aviso-txt"><b>'), 'contenedor, fila y texto');
      assert.ok(html.includes('</span><span class="mt-rec-riel" aria-hidden="true"></span><i class="mt-rec-tope"'), 'el segundo riel, después del texto');
      // Lo que no es el dibujo (los avisos de «orientativo» y la lista) queda fuera del role="img": se lee aparte
      const [dibujo, fuera] = html.split('<div class="mt-rec-hueco"></div></div></div>');
      assert.ok(fuera !== undefined && fuera.startsWith('<ul class="mt-rec-lista'), 'la lista, justo después de cerrarse el dibujo');
      assert.doesNotMatch(dibujo, /<ul|mt-rec-orientativo/);
      assert.equal(a.vencimiento, 'vencimiento');
      // La lista del teléfono: un renglón por tramo
      assert.equal(cuantas(html, /<li>/g), cinta.lista.length);
      for (const renglon of cinta.lista) {
        assert.ok(html.includes(`<li><i class="mt-rec-sw ${renglon.actor}" aria-hidden="true"></i><b>${renglon.nombre}</b><span>${renglon.texto}</span></li>`), renglon.nombre);
      }
      assert.ok(html.includes('<ul class="mt-rec-lista">'), 'sin tramo angosto, la lista es solo del teléfono');
      // Es solo HTML y CSS: ningún SVG
      assert.doesNotMatch(html, /<svg|<rect|<text/);
    }
  });

  it('los actores y la forma son los del servidor', () => {
    assert.deepEqual(plano(vm.runInContext('ACTORES', ctx)), ['gris', 'dgmit', 'area', 'ddpc']);
    assert.equal(vm.runInContext('FORMA_DE_LA_CINTA', ctx), FORMA_DE_LA_CINTA);
    const cintas = [CINTA_INTERNA, CINTA_EXTERNA, cintasDeLaVista(VISTA, {}).externa, cintasDeLaVista(VISTA, {}).interna,
      externa([35, 24], [12, 9], [null, null], [3, 2])].filter(Boolean);
    for (const cinta of cintas) {
      const actores = [...cinta.partes, cinta.carga, ...cinta.lista].map((p) => p.actor);
      for (const actor of actores) assert.ok(['gris', 'dgmit', 'area', 'ddpc'].includes(actor), actor);
    }
    // Un tramo sin casos es gris y punteado (el CSS), con su porqué en lugar de los días
    const sinRespuesta = externa([35, 24], [12, 9], [null, null], [3, 2]);
    assert.ok(ctx.htmlDeCinta(sinRespuesta).includes('<div class="mt-rec-parte gris" style="width:'));
  });

  it('sin regla: el aviso en un renglón; con «sigue», la regla termina en flecha y no dice «vencimiento»', () => {
    const sinRegla = externa([35, 24], [12, 9], [null, null], [3, 2]);
    assert.equal(sinRegla.aviso.ancho, null);
    const html = ctx.htmlDeCinta(sinRegla);
    // El rótulo y el texto, juntos en un `<span>`: el renglón es flex, y el `gap` va solo entre el rombo y el texto
    assert.ok(html.includes(`<p class="mt-rec-aviso-solo"><i class="mt-rec-rombo" aria-hidden="true"></i><span><b>${sinRegla.aviso.rotulo}</b> ${sinRegla.aviso.texto}</span></p>`));
    assert.ok(sinEtiquetas(html).includes(`${sinRegla.aviso.rotulo} ${sinRegla.aviso.texto}`));
    assert.doesNotMatch(html, /mt-rec-aviso"|mt-rec-riel|mt-rec-tope|mt-rec-aviso-venc|mt-rec-vence/);
    // Con el aviso más largo que el circuito: la regla llega al final de la zona a escala y termina en una flecha
    const sigue = externa([50, 34], [12, 9], [20, 14], [3, 2]);
    assert.equal(sigue.aviso.sigue, true);
    const conFlecha = ctx.htmlDeCinta(sigue);
    assert.ok(conFlecha.includes('<div class="mt-rec-aviso sigue" style="width:100%">'));
    assert.ok(conFlecha.includes('<i class="mt-rec-flechita" aria-hidden="true"></i></div></div>'));
    assert.doesNotMatch(conFlecha, /mt-rec-tope|mt-rec-aviso-venc|mt-rec-vence/);
    assert.ok(sinEtiquetas(conFlecha).includes(`${sigue.aviso.rotulo} ${sigue.aviso.texto}`));
  });

  it('la lista también en la computadora con un tramo angosto', () => {
    const angosta = externa([35, 24], [1, 1], [30, 21], [3, 2]);
    assert.equal(angosta.lista_siempre, true);
    assert.equal(angosta.partes[0].angosta, true);
    const html = ctx.htmlDeCinta(angosta);
    assert.ok(html.includes('<ul class="mt-rec-lista siempre">'));
    assert.match(html, /<div class="mt-rec-parte dgmit angosta" style="width:/);
    assert.equal(cuantas(html, / angosta"/g), 1);
    // Sin tramo angosto, ni la clase ni la lista siempre
    for (const cinta of [CINTA_INTERNA, CINTA_EXTERNA]) assert.doesNotMatch(ctx.htmlDeCinta(cinta), /angosta|lista siempre/);
  });

  it('los avisos de «orientativo» van entre el dibujo y la lista', () => {
    const cinta = { ...CINTA_EXTERNA, orientativos: ['Aviso anticipado: con tan pocos casos, es orientativo.'] };
    const html = ctx.htmlDeCinta(cinta);
    assert.ok(html.includes('<p class="mt-rec-orientativo">Aviso anticipado: con tan pocos casos, es orientativo.</p>'));
    assert.ok(html.indexOf('mt-rec-dibujo') < html.indexOf('mt-rec-orientativo') && html.indexOf('mt-rec-orientativo') < html.indexOf('mt-rec-lista'));
    // Y los dos, fuera del role="img" (que se lee como una sola imagen): después de que se cierra
    const [dibujo, fuera] = html.split('<div class="mt-rec-hueco"></div></div></div>');
    assert.doesNotMatch(dibujo, /mt-rec-orientativo|<ul/);
    assert.ok(fuera.startsWith('<p class="mt-rec-orientativo">') && fuera.includes('<ul class="mt-rec-lista'));
    assert.doesNotMatch(ctx.htmlDeCinta({ ...CINTA_EXTERNA, orientativos: [] }), /mt-rec-orientativo/);
  });

  it('sin cinta o con la forma de antes, nada', () => {
    assert.equal(ctx.htmlDeCinta(null), '');
    assert.equal(ctx.htmlDeCinta(undefined), '');
    assert.equal(ctx.htmlDeCinta({}), '');
    assert.equal(ctx.htmlDeCinta([]), '');
    assert.equal(ctx.htmlDeCinta({ ancho: 1000, alto: 156, segmentos: [] }), '');
    assert.equal(ctx.htmlDeCinta({ ...CINTA_EXTERNA, forma: 'cinta' }), '');
    assert.equal(ctx.htmlDeCinta({ ...CINTA_EXTERNA, forma: undefined }), '');
  });
});

describe('reportes.js: los casos', () => {
  it('htmlDeCasos tacha las filas de los destildados', () => {
    const vista = vistaReal({ sin: [11] });
    const html = ctx.htmlDeCasos(vista, { ...POR_DEFECTO, sin: [11] }, { anio: 2026, editable: true });
    const filas = html.match(/<tr[ >][\s\S]*?<\/tr>/g).slice(1);
    const externas = vista.casos.filter((c) => c.gestion === 'externa');
    assert.equal(filas.length, externas.length, 'solo los de la gestión elegida');
    externas.forEach((caso, i) => {
      const fila = filas[i];
      assert.ok(fila.includes(caso.titulo), caso.titulo);
      if (caso.dataset_id === 11) {
        assert.match(fila, /^<tr class="fuera">/);
        assert.match(fila, /<input type="checkbox" class="mt-contar" data-dataset="11" data-fila="\d+" aria-label="Contar Parque Automotor \(Patentamiento\)">/);
      } else {
        assert.match(fila, /^<tr>/);
        assert.match(fila, new RegExp(`data-dataset="${caso.dataset_id}" data-fila="\\d+" checked aria-label="Contar `));
      }
    });
    // La interna no lleva la columna de la nota DGMIT
    assert.match(html, /<th scope="col">Nota DGMIT<\/th>/);
    const interna = ctx.htmlDeCasos(vista, { ...POR_DEFECTO, gestion: 'interna' }, { anio: 2026, editable: true });
    assert.doesNotMatch(interna, /Nota DGMIT/);
    assert.equal(interna.match(/<tr[ >]/g).length - 1, vista.casos.filter((c) => c.gestion === 'interna').length);
    // Un año con foto no se destilda
    assert.match(ctx.htmlDeCasos(vista, POR_DEFECTO, { anio: 2026, editable: false }), /class="mt-contar"[^>]* disabled/);
  });

  it('cada fecha con lo que dice el servidor debajo', () => {
    const caso = VISTA.casos.find((c) => c.dataset_id === 11);
    const html = ctx.htmlDeCasos({ casos: [caso] }, POR_DEFECTO, { anio: 2026, editable: true });
    assert.ok(html.includes(`<td class="t">Parque Automotor (Patentamiento)<small>${caso.area}</small></td>`));
    assert.ok(html.includes(`<td>31/01/2024</td>`));
    assert.ok(html.includes(`<td>${caso.aviso.fecha.split('-').reverse().join('/')}<span class="d">avisado ya vencido · ${caso.aviso.que}</span></td>`));
    assert.ok(html.includes('<td>—<span class="d pend">pendiente de carga</span></td>'));
    assert.ok(html.includes(`<td>—<span class="d curso">${caso.recibido.texto}</span></td>`), caso.recibido.texto);
    // Con la nota DGMIT, su número y su tipo; con los datos, el origen. Los días, como los arma el servidor: corridos y, entre paréntesis,
    // hábiles (spec 2026-11-07-metricas-cajones-y-ciclos, 4)
    const conTodo = {
      dataset_id: 5, titulo: 'Un dataset', area: 'Un área', gestion: 'externa', contar: true, vencimiento: '2026-07-31',
      aviso: { fecha: '2026-06-21', texto: '40 días corridos (29 hábiles) antes del vencimiento', que: 'Nota Digital 2/26' },
      nota: { numero: '156/26', tipo: 'Solicitud', texto: '3 días corridos (en el día, en días hábiles) desde el aviso' },
      recibido: { fecha: '2026-08-04', texto: 'en el día', origen: 'Los entregó el área' },
      carga: { fecha: '2026-08-05', texto: '1 día corrido (1 hábil) desde que se recibió' }
    };
    const fila = ctx.htmlDeCasos({ casos: [conTodo] }, POR_DEFECTO, { anio: 2026, editable: true });
    assert.ok(fila.includes('<td>21/06/2026<span class="d">40 días corridos (29 hábiles) antes del vencimiento · Nota Digital 2/26</span></td>'));
    assert.ok(fila.includes('<td>156/26<span class="d">Solicitud · 3 días corridos (en el día, en días hábiles) desde el aviso</span></td>'));
    assert.ok(fila.includes('<td>04/08/2026<span class="d">en el día · Los entregó el área</span></td>'));
    assert.ok(fila.includes('<td>05/08/2026<span class="d">1 día corrido (1 hábil) desde que se recibió</span></td>'));
  });

  it('el título de los casos y la lista vacía', () => {
    assert.equal(ctx.textoDeLosCasos(VISTA, 'externa', 2026), `Los casos de 2026 (${VISTA.casos.filter((c) => c.gestion === 'externa').length})`);
    const vacia = ctx.htmlDeCasos({ casos: [] }, POR_DEFECTO, { anio: 2026, editable: true });
    assert.match(vacia, /<p class="mt-vacio">No hay casos de la gestión externa en 2026\.<\/p>/);
    assert.doesNotMatch(vacia, /<table/);
  });

  it('el pie de los casos dice lo de destildar y, con foto, que no se destilda: los días los dice cada fila', () => {
    const habiles = ctx.htmlDeCasos(VISTA, POR_DEFECTO, { anio: 2026, editable: true });
    assert.match(habiles, /<p class="mt-pie">Destildar un dataset lo saca de todas las cuentas de esta página/);
    assert.doesNotMatch(habiles, /Debajo de cada fecha/);
    assert.match(ctx.htmlDeCasos(VISTA, POR_DEFECTO, { anio: 2026, editable: false }), /se calculó con todos los datasets: no se puede destildar/);
  });
});

describe('reportes.js: el índice de la página', () => {
  const links = (html) => [...html.matchAll(/<a href="#(mt-seccion-[a-z]+)" data-ir="(mt-titulo-[a-z]+)">([^<]+)<\/a>/g)].map((m) => [m[1], m[2], m[3]]);

  it('«En esta página»: las seis secciones, cada una con su link, y «Para completar (N)» con el total del servidor', () => {
    const html = ctx.htmlDelIndiceDeLaPagina(VISTA);
    assert.match(html, /^<span class="mt-indice-rotulo">En esta página:<\/span>/);
    assert.deepEqual(links(html), [
      ['mt-seccion-circuito', 'mt-titulo-circuito', 'El circuito'], ['mt-seccion-resultados', 'mt-titulo-resultados', 'Resultados del año'],
      ['mt-seccion-contexto', 'mt-titulo-contexto', 'Contexto'], ['mt-seccion-trabajo', 'mt-titulo-trabajo', 'El trabajo del RPAD'],
      ['mt-seccion-areas', 'mt-titulo-areas', 'Áreas y temas'],
      ['mt-seccion-completar', 'mt-titulo-completar', `Para completar (${VISTA.para_completar.total})`]
    ]);
    assert.equal(VISTA.para_completar.total, 23);
    // Con 0, «Para completar (0)»; sin el total (una vista vieja), sin número
    assert.match(ctx.htmlDelIndiceDeLaPagina({ para_completar: { total: 0 } }), />Para completar \(0\)<\/a>$/);
    assert.match(ctx.htmlDelIndiceDeLaPagina({}), />Para completar<\/a>$/);
    assert.match(ctx.htmlDelIndiceDeLaPagina(null), />Para completar<\/a>$/);
  });
});

describe('reportes.js: los resultados del año', () => {
  // Los resultados de la maqueta 4 (datos reales al 24/10/2026), con los textos como los arma el servidor; los 88 días corridos del
  // «después» son inventados
  const RESULTADOS = {
    a_tiempo: {
      a_tiempo: 5, total: 33, externa: [4, 27], interna: [1, 6],
      despues: { valor: 61, texto: 'Los otros 28 se cargaron una mediana de 88 días corridos (61 hábiles) después.' }
    },
    cobertura: { si: 34, total: 35, faltan: [{ titulo: 'Listado de Proveedores', venc: '2026-01-31', motivo: 'sin el aviso de la regla' }] },
    reiteraciones: { rpad: { ninguna: 5, una: 3, dos_o_mas: 39, total: 47 }, dgmit: null },
    textos: {
      a_tiempo: { de: 'de 33 ciclos', medidor: 15, vacio: '' },
      cobertura: {
        de: 'de 35 vencimientos', medidor: 97, regla: 'El RPAD avisó con la anticipación de la regla (40 días en externa, 60 en interna).',
        faltan: 'El que falta:', vacio: ''
      },
      reiteraciones: {
        rpad: 'Del RPAD a la DGMIT (47 ciclos)', rpad_vacio: '', dgmit: 'De la DGMIT al área', dgmit_vacio: 'Todavía no hay notas DGMIT cargadas.',
        aclaracion: 'Hasta el 12/10, el email de los 5 días y el resumen mensual de vencidos se sumaban a cada ciclo.'
      }
    }
  };

  it('htmlDeResultados: «5 de 33 ciclos» y «una mediana de 88 días corridos (61 hábiles) después»', () => {
    const html = ctx.htmlDeResultados({ resultados: RESULTADOS });
    // Actualizados a tiempo: la cifra con «de 33 ciclos» del servidor, el medidor, el texto de después y el desglose
    assert.match(html, /<h3 id="mt-res-a-tiempo">Actualizados a tiempo<\/h3>/);
    assert.match(html, /<div class="mt-heroe">5 <small>de 33 ciclos<\/small><\/div><div class="mt-medidor" aria-hidden="true"><i style="width:15%"><\/i><\/div>/);
    assert.ok(html.includes('<p class="mt-texto">Cargados en el portal hasta el día del vencimiento. Los otros 28 se cargaron una mediana de 88 días corridos (61 hábiles) después.</p>'));
    assert.ok(html.includes('<p class="mt-texto s">Externa: 4 de 27 · Interna: 1 de 6</p>'));
    // La cobertura: la cifra, la regla y el que falta, con su vencimiento y su motivo
    assert.match(html, /<div class="mt-heroe">34 <small>de 35 vencimientos<\/small><\/div><div class="mt-medidor" aria-hidden="true"><i style="width:97%"><\/i><\/div>/);
    assert.ok(html.includes('<p class="mt-texto">El RPAD avisó con la anticipación de la regla (40 días en externa, 60 en interna).</p>'));
    assert.ok(html.includes('<p class="mt-texto s">El que falta:</p><ul class="mt-faltan"><li>Listado de Proveedores (vencimiento 31/01/2026), sin el aviso de la regla</li></ul>'));
    // Las reiteraciones: los tres grupos del RPAD (la barra, relativa a la más larga) y, sin notas DGMIT, el aviso
    assert.ok(html.includes('<h4 class="mt-mini">Del RPAD a la DGMIT (47 ciclos)</h4>'));
    const barras = [...html.matchAll(/<div><span>([^<]+)<\/span><i aria-hidden="true" style="width:(\d+)%"><\/i><b>(\d+)<\/b><\/div>/g)].map((m) => m.slice(1).join(' '));
    assert.deepEqual(barras, ['Ninguna 13 5', '1 8 3', '2 o más 100 39']);
    assert.ok(html.includes('<h4 class="mt-mini dgmit">De la DGMIT al área</h4><p class="mt-vacio-caja">Todavía no hay notas DGMIT cargadas.</p>'));
    assert.doesNotMatch(html, /null|undefined|NaN/);
  });

  it('la aclaración de las reiteraciones (Ruling 21), la del servidor, va debajo de las barras del RPAD; sin ella, nada', () => {
    const aclaracion = 'Hasta el 12/10, el email de los 5 días y el resumen mensual de vencidos se sumaban a cada ciclo.';
    const html = ctx.htmlDeResultados({ resultados: RESULTADOS });
    assert.ok(html.includes(`<b>39</b></div></div><p class="mt-pie mt-aclaracion">${aclaracion}</p><h4 class="mt-mini dgmit">`));
    assert.equal(cuantas(html, /mt-aclaracion/g), 1);
    // null (ningún ciclo con emails) o sin el texto: no se imprime
    for (const valor of [null, undefined, '']) {
      const sin = { ...RESULTADOS, textos: { ...RESULTADOS.textos, reiteraciones: { ...RESULTADOS.textos.reiteraciones, aclaracion: valor } } };
      assert.doesNotMatch(ctx.htmlDeResultados({ resultados: sin }), /mt-aclaracion|Hasta el 12\/10/, String(valor));
    }
    // Con los resultados reales, la del servidor: las dos juntas (spec 2026-11-03-reiteracion-bimestral, 6)
    const delServidor = `${aclaracion} Desde diciembre de 2026, la reiteración sale cada dos meses.`;
    assert.equal(VISTA.resultados.textos.reiteraciones.aclaracion, delServidor);
    assert.ok(ctx.htmlDeResultados(VISTA).includes(`<p class="mt-pie mt-aclaracion">${delServidor}</p>`));
  });

  it('con notas DGMIT, los dos grupos de la DGMIT; sin cifras, los vacíos del servidor y ningún medidor', () => {
    const conNotas = {
      ...RESULTADOS, reiteraciones: { ...RESULTADOS.reiteraciones, dgmit: { ninguna: 2, una_o_mas: 1, total: 3 } },
      textos: { ...RESULTADOS.textos, reiteraciones: { ...RESULTADOS.textos.reiteraciones, dgmit: 'De la DGMIT al área (3 ciclos)', dgmit_vacio: '' } }
    };
    const html = ctx.htmlDeResultados({ resultados: conNotas });
    assert.match(html, /<h4 class="mt-mini dgmit">De la DGMIT al área \(3 ciclos\)<\/h4><div class="mt-barras">/);
    assert.match(html, /<span>Ninguna<\/span><i aria-hidden="true" style="width:100%"><\/i><b>2<\/b>[\s\S]*<span>1 o más<\/span><i aria-hidden="true" style="width:50%"><\/i><b>1<\/b>/);
    // Sin casos en el año: los textos de lo vacío, sin cifras ni medidores
    const vacia = ctx.htmlDeResultados(vistaDe([], DEL_ANIO));
    for (const texto of ['Sin actualizaciones registradas en 2026.', 'Sin vencimientos de 2026 con la fecha del aviso ya cumplida.', 'Sin ciclos en 2026.',
      'Todavía no hay notas DGMIT cargadas.']) {
      assert.ok(vacia.includes(texto), texto);
    }
    assert.doesNotMatch(vacia, /mt-heroe|mt-medidor|Externa:|El RPAD avisó/);
    assert.equal(ctx.htmlDeResultados(null), '');
  });

  it('con los resultados reales, la página escribe los textos del servidor', () => {
    const { resultados } = VISTA;
    const html = ctx.htmlDeResultados(VISTA);
    assert.ok(html.includes(`<div class="mt-heroe">${resultados.a_tiempo.a_tiempo} <small>${resultados.textos.a_tiempo.de}</small></div>`));
    assert.ok(html.includes(resultados.a_tiempo.despues.texto));
    assert.ok(html.includes(`<div class="mt-heroe">${resultados.cobertura.si} <small>${resultados.textos.cobertura.de}</small></div>`));
    assert.ok(html.includes(`<p class="mt-texto s">${resultados.textos.cobertura.faltan}</p>`));
    assert.equal(cuantas(html, /<ul class="mt-faltan">[\s\S]*?<\/ul>/g), 1);
    assert.equal(cuantas(html.match(/<ul class="mt-faltan">[\s\S]*?<\/ul>/)[0], /<li>/g), resultados.cobertura.faltan.length);
    assert.ok(html.includes(`<h4 class="mt-mini">${resultados.textos.reiteraciones.rpad}</h4>`));
  });
});

describe('reportes.js: el contexto', () => {
  const punto = (dia, tasa, etiqueta, texto) => ({ dia, tasa, al_dia: tasa === null ? null : 1, base: tasa === null ? null : 2, etiqueta, texto });

  it('svgDeIndice: sin puntos no dibuja nada; un mes con tasa null no se dibuja', () => {
    assert.equal(ctx.svgDeIndice([]), '');
    assert.equal(ctx.svgDeIndice(null), '');
    assert.equal(ctx.svgDeIndice([punto('2026-01-01', null, 'ene', 'Al 1/1/2026: sin datos suficientes para calcularlo')]), '');
    const puntos = [
      punto('2026-01-01', 75, 'ene', 'Al 1/1/2026: 75% al día (9 de 12)'),
      punto('2026-02-01', null, 'feb', 'Al 1/2/2026: sin datos suficientes para calcularlo'),
      punto('2026-03-01', 50, 'mar', 'Al 1/3/2026: 50% al día (6 de 12)'),
      punto('2026-04-01', 0, 'abr', 'Al 1/4/2026: 0% al día (0 de 12)'),
      punto('2026-04-20', 60, 'hoy', 'Hoy: 60% al día (6 de 10)')
    ];
    const svg = ctx.svgDeIndice(puntos);
    assert.match(svg, /^<svg class="mt-indice-svg" viewBox="0 0 600 220" role="group" aria-label="Índice de actualización, mes a mes" xmlns="http:\/\/www\.w3\.org\/2000\/svg">/);
    // Cuatro puntos, cada uno con su valor en un <title> y alcanzable con el teclado; el de febrero no se dibuja
    assert.equal(cuantas(svg, /<g class="mt-punto[^"]*" tabindex="0" role="img" aria-label="[^"]+"><title>/g), 4);
    for (const p of puntos.filter((x) => x.tasa !== null)) assert.ok(svg.includes(`aria-label="${p.texto}"><title>${p.texto}</title>`), p.texto);
    assert.doesNotMatch(svg, /sin datos suficientes/);
    // Su valor, con textoPorcentaje (un 0 es «0%»)
    for (const valor of ['75%', '50%', '0%', '60%']) assert.match(svg, new RegExp(`class="v"[^>]*>${valor}</text>`), valor);
    // La línea se corta en el mes sin tasa: enero queda solo (sin línea) y de marzo a hoy va una polilínea de tres puntos
    assert.equal(cuantas(svg, /<polyline /g), 1);
    assert.equal(svg.match(/<polyline points="([^"]+)"/)[1].split(' ').length, 3);
    // El eje: los meses, también el que no se dibuja, y «hoy»
    for (const etiqueta of ['ene', 'feb', 'mar', 'abr', 'hoy']) assert.match(svg, new RegExp(`class="mes"[^>]*>${etiqueta}</text>`), etiqueta);
    // 100 % arriba y 0 % abajo: el de 0 está más abajo que el de 75
    const y = (i) => Number(svg.match(new RegExp(`aria-label="${puntos[i].texto.replace(/[()]/g, '\\$&')}"><title>[^<]+</title><circle cx="[\\d.]+" cy="([\\d.]+)"`))[1]);
    assert.ok(y(3) > y(0));
  });

  it('el índice real: once puntos, una sola línea, y «Hoy» en la cabeza de la tarjeta con los valores también en una lista', () => {
    const svg = ctx.svgDeIndice(INDICE);
    assert.equal(cuantas(svg, /<g class="mt-punto/g), 11);
    assert.equal(svg.match(/<polyline points="([^"]+)"/)[1].split(' ').length, 11);
    const html = ctx.htmlDeContexto(CONTEXTO);
    assert.ok(html.includes(`<h3 id="mt-ctx-indice">Índice de actualización, mes a mes</h3><span>${INDICE.at(-1).texto}</span>`));
    assert.equal(INDICE.at(-1).texto, 'Hoy: 54% al día (7 de 13)');
    assert.ok(html.includes(svg));
    assert.match(html, /<details class="mt-valores"><summary>Ver los valores<\/summary><ul>/);
    for (const p of INDICE) assert.ok(html.includes(`<li>${p.texto}</li>`), p.texto);
    assert.ok(html.includes(ctx.htmlDeAntiguedad(ANTIGUEDAD)));
    assert.equal(CONTEXTO.indice_vacio, null);
    assert.doesNotMatch(html, /mt-vacio/);
    // Sin puntos para dibujar, lo que dice el servidor (contexto.indice_vacio, Ruling 19); la página no lo decide
    const sinPuntos = contextoDelAnio(new Map(), DEL_ANIO);
    assert.equal(sinPuntos.indice_vacio, 'No hay datos para dibujar el índice.');
    const vacio = ctx.htmlDeContexto(sinPuntos);
    assert.match(vacio, /<p class="mt-vacio">No hay datos para dibujar el índice\.<\/p>/);
    assert.doesNotMatch(vacio, /<svg/);
    assert.doesNotMatch(ctx.htmlDeContexto({ indice: [], antiguedad: ANTIGUEDAD }), /mt-vacio|<svg/);
    assert.ok(ctx.htmlDeContexto({ ...CONTEXTO, indice_vacio: 'Texto del servidor' }).includes('<p class="mt-vacio">Texto del servidor</p>'));
    assert.equal(ctx.htmlDeContexto(null), '');
  });

  it('htmlDeAntiguedad: los tres grupos en barras ámbar y los textos del servidor', () => {
    const html = ctx.htmlDeAntiguedad(ANTIGUEDAD);
    assert.ok(html.includes(`<h3 id="mt-ctx-antiguedad">Antigüedad de los vencidos</h3><span>${ANTIGUEDAD.textos.titulo}</span>`));
    const barras = [...html.matchAll(/<div><span>([^<]+)<\/span><i class="ambar" aria-hidden="true" style="width:(\d+)%"><\/i><b>(\d+)<\/b><\/div>/g)].map((m) => m.slice(1).join(' '));
    assert.deepEqual(barras, ['Menos de 3 meses 33 1', 'De 3 a 12 meses 100 3', 'Más de un año 67 2']);
    assert.ok(html.includes(`<p class="mt-texto">${ANTIGUEDAD.textos.inicio}</p>`));
    assert.equal(ANTIGUEDAD.textos.inicio, 'Al 1/1/2026 eran 3: de esos, 1 ya se actualizó.');
    // Sin vencidos, las barras en 0
    const cero = ctx.htmlDeAntiguedad({ total: 0, menos_de_3_meses: 0, de_3_a_12: 0, mas_de_un_anio: 0, textos: { titulo: 'Hoy: ningún dataset vencido', inicio: '' } });
    assert.equal(cuantas(cero, /style="width:0%"><\/i><b>0<\/b>/g), 3);
    assert.doesNotMatch(cero, /<p class="mt-texto"><\/p>/);
  });
});

describe('reportes.js: el trabajo del RPAD', () => {
  const columnas = (html) => [...html.matchAll(/<div class="mt-columna"><b>(\d+)<\/b><i aria-hidden="true" style="height:(\d+)%"><\/i><span>([a-z]+)<\/span><\/div>/g)]
    .map((m) => [m[3], Number(m[1]), Number(m[2])]);

  it('htmlDeTrabajo: los cinco totales con su texto del servidor y las columnas por mes, con chips', () => {
    const html = ctx.htmlDeTrabajo(TRABAJO, { serie: 'avisos' });
    const totales = [...html.matchAll(/<div><b>(\d+)<\/b><span>([^<]+)<\/span><\/div>/g)].map((m) => `${m[1]} ${m[2]}`);
    assert.deepEqual(totales, ['35 avisos y notas a la DGMIT', '9 actualizaciones registradas', '19 cambios auditados (doble verificación)',
      '1 dataset nuevo', '0 pedidos resueltos con una fuente pública']);
    // Los chips de la serie y, por mes, de enero al mes de hoy (los meses que manda el servidor)
    for (const [valor, texto, pulsado] of [['avisos', 'Avisos y notas', true], ['actualizaciones', 'Actualizaciones', false], ['auditados', 'Cambios auditados', false]]) {
      assert.ok(html.includes(`data-selector="serie" data-valor="${valor}" aria-pressed="${pulsado}">${texto}</button>`), valor);
    }
    assert.match(html, /<div class="mt-columnas" role="group" aria-label="Avisos y notas por mes">/);
    assert.deepEqual(columnas(html), [['ene', 6, 100], ['feb', 3, 50], ['mar', 3, 50], ['abr', 5, 83], ['may', 2, 33], ['jun', 1, 17], ['jul', 3, 50],
      ['ago', 4, 67], ['sep', 2, 33], ['oct', 6, 100]]);
    // Otra serie; una que no existe es la de entrada
    assert.deepEqual(columnas(ctx.htmlDeTrabajo(TRABAJO, { serie: 'actualizaciones' })).map((c) => c[1]), [0, 3, 1, 0, 1, 0, 0, 0, 1, 3]);
    assert.equal(ctx.htmlDeTrabajo(TRABAJO, { serie: 'x' }), html);
    assert.equal(ctx.htmlDeTrabajo(TRABAJO), html);
    // Todo en 0: las columnas sin altura
    const vacio = trabajoDelAnio(new Map(), [], { ...DEL_ANIO, estadistico: 'mediana' });
    assert.ok(columnas(ctx.htmlDeTrabajo(vacio)).every(([, valor, alto]) => valor === 0 && alto === 0));
    assert.equal(columnas(ctx.htmlDeTrabajo(vacio)).length, 10);
    assert.equal(ctx.htmlDeTrabajo(null), '');
  });

  it('mesesDeMetricasManuales: desde enero del año, y un mes más (la base puede ir en UTC: a las 21 del último día ya es el mes siguiente)', () => {
    // El 24/10/2026: 10 meses. Con CURDATE() ya en noviembre, (2026 × 12 + 11) − 10 es enero de 2026: enero sigue entrando
    assert.equal(ctx.mesesDeMetricasManuales(2026, '2026-10-24'), 10);
    assert.equal(ctx.mesesDeMetricasManuales(2026, '2026-10-31'), 10);
    assert.equal(ctx.mesesDeMetricasManuales(2026, '2026-01-31'), 1);
    // Un año anterior: hasta su enero
    assert.equal(ctx.mesesDeMetricasManuales(2026, '2027-01-15'), 13);
    assert.equal(ctx.mesesDeMetricasManuales(2026, '2028-03-01'), 27);
    // Lo que no sirve: los 12 de siempre de la API
    assert.equal(ctx.mesesDeMetricasManuales(2027, '2026-10-24'), 12);
    assert.equal(ctx.mesesDeMetricasManuales(2026, 'x'), 12);
  });

  it('htmlDeMetricasManuales: las del año, y el botón de eliminar solo para administración', () => {
    const lista = [
      { id: 3, tipo: 'consultas_atendidas', anio: 2026, mes: 3, cantidad: 12 },
      { id: 4, tipo: 'notas_enviadas', anio: 2025, mes: 12, cantidad: 2 },
      { id: 5, tipo: 'reuniones_capacitaciones', anio: 2026, mes: 10, cantidad: 0 }
    ];
    const html = ctx.htmlDeMetricasManuales(lista, { anio: 2026, esAdmin: false });
    const filas = [...html.matchAll(/<li><span class="t">([^<]+)<\/span><span class="p">([^<]+)<\/span><b>(\d+)<\/b><\/li>/g)].map((m) => m.slice(1).join(' · '));
    assert.deepEqual(filas, ['Consultas atendidas · Marzo 2026 · 12', 'Reuniones y capacitaciones · Octubre 2026 · 0']);
    assert.doesNotMatch(html, /data-eliminar/);
    const admin = ctx.htmlDeMetricasManuales(lista, { anio: 2026, esAdmin: true });
    assert.ok(admin.includes('<button type="button" class="mt-eliminar" data-eliminar="3" aria-label="Eliminar Consultas atendidas de Marzo 2026">×</button>'));
    assert.equal(cuantas(admin, /data-eliminar=/g), 2);
    // Sin ninguna del año, lo dice
    assert.equal(ctx.htmlDeMetricasManuales([lista[1]], { anio: 2026, esAdmin: true }), '<p class="mt-vacio-caja">Todavía no hay métricas manuales cargadas en 2026.</p>');
    assert.equal(ctx.htmlDeMetricasManuales(null, { anio: 2026 }), '<p class="mt-vacio-caja">Todavía no hay métricas manuales cargadas en 2026.</p>');
  });
});

describe('reportes.js: áreas y temas', () => {
  // Los de la pestaña Métricas de la vieja página Gestión, que se mudaron sin cambios
  it('textoPorcentaje: un número con %, y null con una raya', () => {
    assert.equal(ctx.textoPorcentaje(83), '83%');
    assert.equal(ctx.textoPorcentaje(0), '0%');
    assert.equal(ctx.textoPorcentaje(null), '—');
    assert.equal(ctx.textoPorcentaje(undefined), '—');
  });

  it('un área con solo eventuales dice "—" y no 100%', () => {
    const html = ctx.htmlDelRanking([
      { area: 'Área A', total_datasets: 7, al_dia: 3, porcentaje: 60 },
      { area: 'Área <C>', total_datasets: 1, al_dia: 0, porcentaje: null }
    ]);
    assert.match(html, /<td>60%<\/td>/);
    assert.match(html, /<td>—<\/td>/);
    assert.doesNotMatch(html, /null|100%/);
    assert.ok(html.includes('Área &lt;C&gt;'));
    assert.match(html, /width:0%/);
  });

  it('sin áreas, lo dice', () => {
    assert.match(ctx.htmlDelRanking([]), /Sin datos de áreas/);
  });

  it('htmlDeAreas: el ranking del servidor y los temas o las frecuencias en barras horizontales, con un chip', () => {
    const html = ctx.htmlDeAreas(AREAS, 'temas');
    assert.ok(html.includes(ctx.htmlDelRanking(AREAS.ranking)));
    assert.ok(AREAS.ranking.every((a) => Number.isInteger(a.total_datasets)));
    assert.ok(html.includes(`<td>${AREAS.ranking[0].total_datasets}</td>`));
    assert.match(html, /<div class="mt-tabla-marco mt-ranking" tabindex="0" role="group" aria-label="Ranking de áreas">/);
    assert.ok(html.includes('data-selector="agrupar" data-valor="temas" aria-pressed="true">Tema</button>'));
    assert.ok(html.includes('data-selector="agrupar" data-valor="frecuencias" aria-pressed="false">Frecuencia</button>'));
    const barras = (texto) => [...texto.matchAll(/<div><span>([^<]+)<\/span><i aria-hidden="true" style="width:(\d+)%"><\/i><b>(\d+)<\/b><\/div>/g)].map((m) => [m[1], Number(m[3])]);
    assert.deepEqual(barras(html), AREAS.temas);
    assert.deepEqual(barras(ctx.htmlDeAreas(AREAS, 'frecuencias')), AREAS.frecuencias);
    assert.equal(ctx.htmlDeAreas(AREAS, 'x'), html);
    assert.match(html, /<div><span>Gobierno y Gestión Pública<\/span><i aria-hidden="true" style="width:100%"><\/i><b>6<\/b><\/div>/);
    // Sin datasets: lo que dice el servidor (areas.vacios, Ruling 19), del agrupado elegido; la página no lo decide
    const sinDatasets = areasYTemas(new Map(), DEL_ANIO);
    assert.match(ctx.htmlDeAreas(sinDatasets, 'temas'), /<p class="mt-vacio">Sin datasets\.<\/p>/);
    assert.match(ctx.htmlDeAreas(sinDatasets, 'frecuencias'), /<p class="mt-vacio">Sin datasets\.<\/p>/);
    assert.doesNotMatch(ctx.htmlDeAreas({ ranking: [], temas: [], frecuencias: [] }, 'temas'), /mt-vacio/);
    assert.ok(ctx.htmlDeAreas({ ...AREAS, vacios: { temas: 'Texto del servidor', frecuencias: null } }, 'temas').includes('<p class="mt-vacio">Texto del servidor</p>'));
    assert.doesNotMatch(html, /mt-vacio/);
    assert.equal(ctx.htmlDeAreas(null), '');
  });
});

describe('reportes.js: para completar', () => {
  const { notas, recibido } = VISTA.para_completar;

  it('htmlDeParaCompletar sin permiso no tiene el link de carga', () => {
    const html = ctx.htmlDeParaCompletar(VISTA, false);
    assert.doesNotMatch(html, /Cargar nota DGMIT|#cargar-nota/);
    // La lista es la misma: los títulos del servidor, cada nota pendiente y cada actualización sin «Recibido el»
    assert.ok(html.includes(`<h3 class="mt-grupo">${VISTA.para_completar.textos.notas}</h3>`));
    assert.ok(html.includes(`<h3 class="mt-grupo">${VISTA.para_completar.textos.recibido}</h3>`));
    assert.equal(cuantas(html, /<li class="mt-tarea">/g), notas.length + recibido.length);
    assert.ok(html.includes('<span class="d"><b>Áreas específicas de género</b><small>Secretaría de la Mujer, Género y Diversidad · ciclo abierto</small></span>'
      + '<span class="q">Aviso del 01/10/2026 (email de 60 días)</span>'));
    assert.ok(html.includes('<small>Dirección General de Relaciones Laborales · actualizado el 04/02/2026</small>'));
    // Las actualizaciones sin «Recibido el», con un link al Seguimiento para todos
    assert.ok(html.includes('<span class="d"><b>Escala salarial municipal (planta permanente)</b><small>gestión interna · Falta «Recibido el»</small></span>'
      + '<span class="q">Cargada en el portal el 12/02/2026</span>'
      + '<a href="seguimiento.html?id=38" aria-label="Ver en el Seguimiento: Escala salarial municipal (planta permanente)">Ver en el Seguimiento</a>'));
    assert.equal(cuantas(html, />Ver en el Seguimiento<\/a>/g), recibido.length);
  });

  it('con permiso, cada nota pendiente lleva «Cargar nota DGMIT», que abre el formulario del Seguimiento con ese dataset', () => {
    const html = ctx.htmlDeParaCompletar(VISTA, true);
    assert.equal(cuantas(html, /<a href="seguimiento\.html\?id=\d+#cargar-nota" aria-label="Cargar nota DGMIT: [^"]+">Cargar nota DGMIT<\/a>/g), notas.length);
    assert.ok(html.includes('<a href="seguimiento.html?id=58#cargar-nota" aria-label="Cargar nota DGMIT: Áreas específicas de género">Cargar nota DGMIT</a>'));
    // Solo cuenta el true literal
    for (const raro of ['true', 1, undefined]) assert.doesNotMatch(ctx.htmlDeParaCompletar(VISTA, raro), /#cargar-nota/, String(raro));
  });

  it('sin pendientes, los textos de lo vacío del servidor', () => {
    const html = ctx.htmlDeParaCompletar(vistaDe([], DEL_ANIO), true);
    assert.ok(html.includes('<h3 class="mt-grupo">Notas DGMIT pendientes de carga (0)</h3><p class="mt-vacio">No hay notas DGMIT pendientes de carga.</p>'));
    assert.ok(html.includes('<p class="mt-vacio">No hay actualizaciones sin «Recibido el» ni sin el origen de los datos.</p>'));
    assert.doesNotMatch(html, /<ul/);
    assert.equal(ctx.htmlDeParaCompletar(null, true), '');
  });
});

describe('reportes.js: lo que llega del servidor', () => {
  it('todo pasa por escapeHtml', () => {
    const malo = '<b>x</b>';
    const sinMalo = (html, donde) => {
      assert.doesNotMatch(html, /<b>x<\/b>/, donde);
      assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'), donde);
    };
    const t = { ...tramo('aviso', 27), nombre: malo, desde_hasta: malo, responsable: malo };
    t.cifra = { ...t.cifra, texto: malo, unidad: malo, debajo: malo };
    sinMalo(ctx.htmlDeFlecha(t), 'flecha');
    // La frase y los hábiles (spec 2026-11-07-metricas-cajones-y-ciclos, 3), también en el cajón del aviso
    const conFrase = ctx.htmlDeFlecha({ ...tramo('respuesta', 64), como_se_cuenta: malo, habiles_texto: malo });
    sinMalo(conFrase, 'frase y hábiles');
    assert.equal(cuantas(conFrase, /&lt;b&gt;x&lt;\/b&gt;/g), 2, 'la frase y los hábiles');
    sinMalo(ctx.htmlDeFlecha({ ...tramo('aviso', 51), anticipacion_texto: 'días corridos de anticipación', habiles_texto: malo }), 'hábiles del aviso');
    sinMalo(ctx.htmlDeFlecha({ ...tramo('respuesta', null), como_se_cuenta: malo }), 'frase sin cifra');
    sinMalo(ctx.htmlDeFlecha({ ...tramo('tramite', null), vacio: { titulo: malo, texto: malo }, en_curso: { n: 1, valor: 1, texto: malo } }), 'flecha vacía');
    const caso = {
      dataset_id: 5, titulo: malo, area: malo, gestion: 'externa', contar: false, vencimiento: malo,
      aviso: { fecha: '2026-01-01', texto: malo, que: malo }, nota: { numero: malo, tipo: malo, texto: malo },
      recibido: { fecha: null, texto: malo, origen: malo }, carga: { fecha: null, texto: malo }
    };
    sinMalo(ctx.htmlDeCasos({ casos: [caso] }, POR_DEFECTO, { anio: 2026, editable: true }), 'casos');
    sinMalo(ctx.htmlDeFranjaSin({ sin_texto: textoDeLaFranja([malo]) }, { ...POR_DEFECTO, sin: [5] }), 'franja');
    sinMalo(ctx.htmlDeBarra({ anio: 2026, anios: [2026], en_vivo: true, aviso_foto: malo, sin_titulos: [] }, POR_DEFECTO), 'barra');
    // El recorrido típico: todo texto del servidor, escapado (también el de la descripción, que va en un atributo); un actor que no está en la
    // lista no se escribe en una clase y se dibuja como gris
    const recorrido = {
      ...CINTA_EXTERNA, titulo: malo, bajada: malo, descripcion: '"><b>x</b>', total: { antes: malo, cifra: malo, despues: malo },
      partes: CINTA_EXTERNA.partes.map((p) => ({ ...p, actor: '"><x', grande: malo, nombre: malo, dias: malo })),
      carga: { ...CINTA_EXTERNA.carga, actor: '"><x', grande: malo, nombre: malo, dias: malo }, portal: { nombre: malo, texto: malo },
      aviso: { ...CINTA_EXTERNA.aviso, rotulo: malo, texto: malo, vencimiento: malo }, orientativos: [malo],
      lista: [{ actor: '"><x', nombre: malo, texto: malo }]
    };
    const html = ctx.htmlDeCinta(recorrido);
    sinMalo(html, 'recorrido');
    assert.doesNotMatch(html, /<script>|"><x/);
    // La descripción va en un atributo: la comilla y el «<» se escapan, y el atributo no se cierra antes de tiempo
    assert.ok(html.includes(`role="img" aria-label="${ctx.Utils.escapeHtml('"><b>x</b>')}">`));
    assert.doesNotMatch(html, /aria-label="[^"]*"[^>]*><b>x<\/b>/);
    assert.equal(cuantas(html, /class="mt-rec-parte gris/g), CINTA_EXTERNA.partes.length + 1, 'los tramos y la carga, como gris');
    assert.match(html, /<i class="mt-rec-sw gris" aria-hidden="true"><\/i>/);
    // Un aviso en un renglón, sin regla, también escapa
    sinMalo(ctx.htmlDeCinta({ ...recorrido, aviso: { rotulo: malo, texto: malo, ancho: null, sigue: false, vencimiento: '' } }), 'aviso sin regla');

    // Las secciones de abajo: los resultados, el contexto, el trabajo, las áreas y «Para completar»
    const textosMalos = (objeto) => Object.fromEntries(Object.entries(objeto).map(([clave, valor]) => [clave, typeof valor === 'string' ? malo : valor]));
    const { resultados } = VISTA;
    sinMalo(ctx.htmlDeResultados({ resultados: {
      ...resultados,
      a_tiempo: { ...resultados.a_tiempo, despues: { valor: 1, texto: malo } },
      cobertura: { ...resultados.cobertura, faltan: [{ titulo: malo, venc: '2026-01-31', motivo: malo }] },
      textos: { a_tiempo: textosMalos(resultados.textos.a_tiempo), cobertura: textosMalos(resultados.textos.cobertura),
        reiteraciones: { rpad: malo, rpad_vacio: '', dgmit: malo, dgmit_vacio: malo, aclaracion: malo } }
    } }), 'resultados');
    sinMalo(ctx.svgDeIndice([{ dia: '2026-01-01', tasa: 50, al_dia: 1, base: 2, etiqueta: malo, texto: malo }]), 'índice');
    sinMalo(ctx.htmlDeContexto({ indice: [{ dia: '2026-01-01', tasa: 50, al_dia: 1, base: 2, etiqueta: 'ene', texto: malo }], antiguedad: ANTIGUEDAD }), 'contexto');
    sinMalo(ctx.htmlDeContexto({ indice: [], indice_vacio: malo, antiguedad: ANTIGUEDAD }), 'índice vacío');
    sinMalo(ctx.htmlDeAreas({ ranking: [], temas: [], frecuencias: [], vacios: { temas: malo } }, 'temas'), 'áreas vacías');
    sinMalo(ctx.htmlDeAntiguedad({ ...ANTIGUEDAD, textos: { titulo: malo, inicio: malo } }), 'antigüedad');
    sinMalo(ctx.htmlDeTrabajo({ ...TRABAJO, textos: { ...TRABAJO.textos, meses: [malo], totales: textosMalos(TRABAJO.textos.totales) } }), 'trabajo');
    sinMalo(ctx.htmlDeMetricasManuales([{ id: '<b>x</b>', tipo: malo, anio: 2026, mes: 3, cantidad: 1 }], { anio: 2026, esAdmin: true }), 'manuales');
    sinMalo(ctx.htmlDeAreas({ ranking: [{ area: malo, total_datasets: 1, al_dia: 1, porcentaje: 100 }], temas: [[malo, 2]], frecuencias: [] }, 'temas'), 'áreas');
    sinMalo(ctx.htmlDeParaCompletar({ para_completar: {
      notas: [{ dataset_id: 5, titulo: malo, area: malo, abierto: true, aviso: '2026-01-01', que: malo, carga: null, situacion: malo }],
      recibido: [{ dataset_id: 6, titulo: malo, gestion: malo, carga: '2026-01-01', falta: 'recibido', falta_texto: malo }],
      total: 2, textos: { notas: malo, notas_vacio: '', recibido: malo, recibido_vacio: '' }
    } }, true), 'para completar');
    // Un id que no es un id no va en la dirección
    assert.doesNotMatch(ctx.htmlDeParaCompletar({ para_completar: { ...VISTA.para_completar, notas: [{ ...VISTA.para_completar.notas[0], dataset_id: '1#x' }],
      recibido: [{ ...VISTA.para_completar.recibido[0], dataset_id: 'x' }] } }, true), /href=/);
  });

  it('un 0 se escribe como 0', () => {
    // La cantidad de casos, una coordenada y un ancho de 0
    assert.equal(ctx.textoDeLosCasos({ casos: [] }, 'externa', 2026), 'Los casos de 2026 (0)');
    const ceros = ctx.htmlDeCinta({ ...CINTA_EXTERNA, partes: CINTA_EXTERNA.partes.map((p) => ({ ...p, ancho: 0 })), vencimiento: { x: 0 },
      aviso: { ...CINTA_EXTERNA.aviso, ancho: 0 } });
    assert.equal(cuantas(ceros, /style="width:0%"/g), CINTA_EXTERNA.partes.length + 1, 'los anchos y la regla');
    assert.ok(ceros.includes('<span class="mt-rec-vence" style="left:0%" aria-hidden="true"></span>'));
    assert.ok(ceros.includes('<div class="mt-rec-aviso" style="width:0%">'));
    // Todo en 0 días: partes iguales y «En el día»
    const todoEnElDia = cintaDeMetricas([tramo('aviso', 0, { dias: 'corridos', habiles: 0 }), tramo('tramite', 0, { dias: 'corridos', habiles: 0 }),
      tramo('respuesta', 0, { dias: 'corridos', habiles: 0 }), tramo('carga', 0, { dias: 'corridos', habiles: 0 })], { gestion: 'externa', dias: 'corridos' });
    const enElDia = ctx.htmlDeCinta(todoEnElDia);
    assert.ok(enElDia.includes('<span>En total, <b>en el día</b></span>'));
    assert.ok(enElDia.includes(`style="width:${coord(todoEnElDia.partes[0].ancho)}%"`));
    // Y nada dice NaN, null ni undefined con datos que faltan
    const sinDatos = [ceros, enElDia, ctx.htmlDeCinta(CINTA_EXTERNA), ctx.htmlDeCinta(CINTA_INTERNA), ctx.htmlDeCinta({ forma: FORMA_DE_LA_CINTA }),
      ctx.htmlDeCinta({ ...CINTA_EXTERNA, partes: [null, {}], carga: null, portal: null, aviso: null, total: null, vencimiento: { x: 'x' }, lista: [null, {}], orientativos: [null, 3] })].join('');
    assert.doesNotMatch(sinDatos, /NaN|null|undefined/);
    // Los textos con un 0 que manda el servidor van tal cual
    const flecha = ctx.htmlDeFlecha({ ...tramo('respuesta', null), vacio: { titulo: 'Sin datos todavía', texto: '0' }, como_se_cuenta: '0' });
    assert.match(flecha, /<span class="c">0<\/span><span class="c">0<\/span>/);
    const caso = { ...VISTA.casos[0], carga: { fecha: '2026-03-02', texto: '0' } };
    assert.match(ctx.htmlDeCasos({ casos: [caso] }, POR_DEFECTO, { anio: 2026, editable: true }), /<td>02\/03\/2026<span class="d">0<\/span><\/td>/);
    // Y nada dice NaN, null ni undefined con datos que faltan
    const vacio = [ctx.htmlDeCircuito({ circuito: { externa: [{}, null, { clave: 'tramite' }] } }, 'externa'),
      ctx.htmlDeCasos({ casos: [{}, null] }, POR_DEFECTO, { anio: 2026, editable: true }),
      ctx.htmlDeBarra({}, POR_DEFECTO), ctx.htmlDeFranjaSin({ sin_titulos: [null], sin_texto: null }, POR_DEFECTO)].join('');
    assert.doesNotMatch(vacio, /NaN|null|undefined/);
  });
});

// La pestaña Reportes (spec 2026-10-24-metricas-y-reportes, 5; maquetas 3-reportes.html y 6-reportes-datos-reales.html): ocho tarjetas
// en dos grupos, cada una con su PDF, que se descarga con el JWT en el encabezado (API.pedirArchivo). Qué años tienen foto y qué dice el
// botón del Informe anual sin ella lo dice el servidor (`fotos` de GET /api/metricas, fotosDeMetricas): la página no lo deduce
describe('reportes.js: la pestaña Reportes', () => {
  const HOY_DE_LA_PRUEBA = '2026-10-25';
  const DISPONIBLE_2027 = 'Disponible desde el 10/01/2027';
  const SE_REINTENTA_2026 = 'La foto de 2026 todavía no se sacó: se reintenta en la próxima corrida.';
  const conFoto = (anio) => ({ anio, con_foto: true, aviso_informe: null });
  const sinFoto = (anio, aviso = `Disponible desde el 10/01/${anio + 1}`) => ({ anio, con_foto: false, aviso_informe: aviso });
  const FOTOS_2026 = [sinFoto(2026)];
  const LAS_AREAS = [{ id: 7, nombre: 'Secretaría de Hacienda' }, { id: 3, nombre: 'Área de Ambiente' }, { id: 12, nombre: 'Dirección de Comercio' }];
  const ELEGIDO = { metricas: null, ciclo: null, informe: null, area: '', desde: '2026-01-01', hasta: HOY_DE_LA_PRUEBA, meses: 6, gestion: 'ambas', completar: null };
  const reportes = (elegido = ELEGIDO, opciones = {}) => ctx.htmlDeReportes(elegido, { anios: FOTOS_2026, areas: LAS_AREAS, ...opciones });
  // La tarjeta de un reporte (lo que va de su <section> a la siguiente)
  const tarjeta = (html, clave) => html.match(new RegExp(`<section class="rp-tarjeta" aria-labelledby="rp-titulo-${clave}">[\\s\\S]*?</section>`))?.[0] ?? '';
  const pedido = (clave, elegido = ELEGIDO, { estado = POR_DEFECTO, anios = FOTOS_2026, hoy = HOY_DE_LA_PRUEBA } = {}) =>
    plano(ctx.pedidoDeReporte(clave, elegido, { estado, anios, hoy }) ?? null);
  const NO_DISPONIBLE = '<button type="button" class="mt-btn rp-no-disponible" data-reporte="informe" aria-disabled="true" aria-describedby="rp-titulo-informe">';

  it('ocho tarjetas en dos grupos', () => {
    const html = reportes();
    const grupos = [...html.matchAll(/<h2 class="mt-seccion-titulo" id="rp-grupo-([a-z]+)">([^<]+)<\/h2><p class="mt-seccion-bajada">([^<]+)<\/p>/g)]
      .map((m) => [m[1], m[2], m[3]]);
    assert.deepEqual(grupos, [
      ['presentar', 'Para presentar', 'El estado del registro y cómo funcionó el circuito.'],
      ['trabajar', 'Para trabajar', 'Para preparar una reunión, planificar o dejar constancia.']
    ]);
    // Cada tarjeta es una sección con su h3 (los cuatro de «Para presentar», con su ícono, como en la maqueta), en su grupo y en orden;
    // el Ciclo de vida del dato, segundo en «Para presentar», que pasa a cuatro columnas
    const titulos = (parte) => [...parte.matchAll(/<section class="rp-tarjeta" aria-labelledby="rp-titulo-([a-z]+)"><h3 id="rp-titulo-\1">(<svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>)?([^<]+)<\/h3>/g)]
      .map((m) => [m[1], m[3], Boolean(m[2])]);
    const [presentar, trabajar] = html.split('id="rp-grupo-trabajar"');
    assert.deepEqual(titulos(presentar), [['metricas', 'Métricas del año', true], ['ciclo', 'Ciclo de vida del dato', true], ['informe', 'Informe anual', true],
      ['estado', 'Estado general de los datasets', true]]);
    assert.deepEqual(titulos(trabajar), [['area', 'Por área', false], ['avisos', 'Avisos del RPAD', false], ['agenda', 'Agenda de pedidos', false],
      ['completar', 'Datos para completar', false]]);
    assert.match(presentar, /<div class="rp-grilla g4">/);
    assert.match(trabajar, /<div class="rp-grilla g4">/);
    // El ícono del Ciclo de vida del dato, el «route» de Lucide (el de la maqueta)
    assert.ok(tarjeta(html, 'ciclo').includes('<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>Ciclo de vida del dato</h3>'));
    // Los textos de la maqueta; la cantidad de hojas, la real con los datos de hoy (Ruling 24), y donde depende de lo que se elige, sin
    // un número
    for (const [clave, texto, hojas] of [
      ['metricas', 'Lo que muestra la pestaña Métricas: el circuito de las dos gestiones, los resultados, el contexto y el trabajo del RPAD. Respeta los casos destildados y lo aclara.', 'Unas 5 hojas'],
      ['ciclo', 'Cuánto tarda cada etapa del circuito, del aviso del RPAD a la carga en el portal: la mediana, el promedio y los casos más largo y más corto de cada una. Una hoja para cada gestión.', '2 hojas: la gestión externa y la interna'],
      ['informe', 'Para un año cerrado: la foto del 31/12, la comparación con el año anterior y los logros del año (los hitos de Herramientas → Proyectos).', 'Se arma con la foto del 31/12'],
      ['estado', 'La foto de hoy: actualizados, próximos a vencer, vencidos, eventuales y sin fecha, el índice de actualización y la tabla de todos los datasets.', 'Unas 4 hojas'],
      ['area', 'Una portada con el área, sus contactos y el estado de sus datasets y, detrás, una hoja de Seguimiento por cada dataset.', 'Una portada y una hoja por dataset'],
      ['avisos', 'La constancia de cada aviso del período: emails y Notas Digitales, con número, fecha, gestión y datasets. Sin direcciones de email.', null],
      ['agenda', 'Qué vence en los próximos meses, mes por mes, con el área y los datos que se van a pedir.', null],
      ['completar', 'Lo que falta cargar para que las métricas estén completas: notas DGMIT pendientes de carga y actualizaciones sin «Recibido el».', 'Unas 3 hojas. También en Métricas → Para completar']
    ]) {
      const t = tarjeta(html, clave);
      assert.ok(t.includes(`<p class="rp-texto">${texto}</p>`), clave);
      if (hojas) assert.ok(t.includes(`<p class="rp-hojas">${hojas}</p>`), `${clave}: ${hojas}`);
      else assert.doesNotMatch(t, /rp-hojas/, clave);
      // Un botón de descarga por tarjeta (el del Informe anual sin foto, deshabilitado: ver abajo), descripto por el título de su tarjeta
      if (clave !== 'informe') {
        assert.ok(t.includes(`<button type="button" class="mt-btn mt-btn-tinta" data-reporte="${clave}" aria-describedby="rp-titulo-${clave}">${vm.runInContext('ICONO_DESCARGA', ctx)}Descargar PDF</button>`), clave);
      }
      assert.equal(cuantas(t, /<button type="button" class="mt-btn/g), 1, clave);
      // Cada tarjeta, sola, es la misma que dentro de la pestaña (la página redibuja de a una)
      assert.equal(ctx.htmlDeTarjetaDeReportes(clave, ELEGIDO, { anios: FOTOS_2026, areas: LAS_AREAS }), t, clave);
    }
    assert.equal(ctx.htmlDeTarjetaDeReportes('cumplimiento', ELEGIDO, {}), '');
    // Cada selector con su label, una sola vez
    for (const [id, rotulo] of [['rp-metricas-anio', 'Año'], ['rp-ciclo-anio', 'Año'], ['rp-informe-anio', 'Año'], ['rp-area', 'Área'], ['rp-desde', 'Desde'], ['rp-hasta', 'Hasta'],
      ['rp-gestion', 'Gestión'], ['rp-completar-anio', 'Año']]) {
      assert.equal(cuantas(html, new RegExp(`<label for="${id}">${rotulo}</label>`, 'g')), 1, id);
      assert.equal(cuantas(html, new RegExp(`id="${id}"`, 'g')), 1, id);
    }
    // El Estado general no elige nada (Datos para completar elige el año: Ruling 39)
    assert.doesNotMatch(tarjeta(html, 'estado'), /<select|<input|rp-campos/);
  });

  it('el Informe anual sin foto, deshabilitado con «Disponible desde el 10/01/2027»', () => {
    const sinFoto2026 = tarjeta(reportes(), 'informe');
    assert.ok(sinFoto2026.includes(`${NO_DISPONIBLE}${DISPONIBLE_2027}</button>`), sinFoto2026);
    assert.doesNotMatch(sinFoto2026, /Descargar PDF/);
    assert.match(sinFoto2026, /<select id="rp-informe-anio" class="mt-select" data-selector="rp-informe"><option value="2026" selected>2026<\/option><\/select>/);
    // Sin foto no se pide nada
    assert.equal(pedido('informe'), null);
    // El texto es el del servidor (aviso_informe), no uno de la página
    assert.ok(tarjeta(reportes(ELEGIDO, { anios: [sinFoto(2026, 'Disponible desde el 11/01/2027')] }), 'informe').includes('Disponible desde el 11/01/2027'));

    // Entre el 1/1 y el 10/1 ningún año tiene foto: se propone el cerrado, el primero que la va a tener
    const enero = tarjeta(reportes(ELEGIDO, { anios: [sinFoto(2026), sinFoto(2027)] }), 'informe');
    assert.match(enero, /<option value="2027">2027<\/option><option value="2026" selected>2026<\/option>/);
    assert.ok(enero.includes(`${NO_DISPONIBLE}${DISPONIBLE_2027}</button>`));

    // Con foto: se propone el más nuevo que la tiene, y se descarga
    const dosAnios = [conFoto(2026), sinFoto(2027)];
    const disponible = tarjeta(reportes(ELEGIDO, { anios: dosAnios }), 'informe');
    assert.match(disponible, /<option value="2027">2027<\/option><option value="2026" selected>2026<\/option>/);
    assert.ok(disponible.includes('<button type="button" class="mt-btn mt-btn-tinta" data-reporte="informe" aria-describedby="rp-titulo-informe">'), disponible);
    assert.match(disponible, /Descargar PDF<\/button>/);
    assert.doesNotMatch(disponible, /aria-disabled|Disponible desde/);
    assert.deepEqual(pedido('informe', ELEGIDO, { anios: dosAnios }), { ruta: '/reportes/informe-anual?anio=2026', nombre: 'Informe-anual-RPAD-2026.pdf' });
    // Elegido el en curso, que todavía no la tiene: deshabilitado, con su día
    const elegido2027 = { ...ELEGIDO, informe: 2027 };
    assert.ok(tarjeta(reportes(elegido2027, { anios: dosAnios }), 'informe').includes(`${NO_DISPONIBLE}Disponible desde el 10/01/2028</button>`));
    assert.equal(pedido('informe', elegido2027, { anios: dosAnios }), null);
    // Un año elegido que no está entre los del servidor no vale: queda el propuesto
    assert.equal(pedido('informe', { ...ELEGIDO, informe: 2025 }, { anios: dosAnios }).ruta, '/reportes/informe-anual?anio=2026');
  });

  // Ruling 34: el año cerrado cuya foto no se pudo sacar es el que se propone, y su botón no dice una fecha que ya pasó: dice lo que manda el
  // servidor (fotosDeMetricas, el mismo aviso de la pestaña Métricas)
  it('el Informe anual de un año cerrado cuya foto no se pudo sacar dice que se reintenta, con el texto del servidor', () => {
    for (const hoy of ['2027-01-11', '2027-06-15']) {
      const anios = plano(fotosDeMetricas({ hoy, aniosConFoto: [] }));
      assert.deepEqual(anios, [sinFoto(2026, SE_REINTENTA_2026), sinFoto(2027)], hoy);
      const informe = tarjeta(reportes(ELEGIDO, { anios }), 'informe');
      assert.match(informe, /<option value="2026" selected>2026<\/option>/, hoy);
      assert.ok(informe.includes(`${NO_DISPONIBLE}${SE_REINTENTA_2026}</button>`), informe);
      assert.doesNotMatch(informe, /10\/01\/2027/, hoy);
      assert.equal(pedido('informe', ELEGIDO, { anios }), null, hoy);
    }
    // Hasta el 10/01 inclusive, desde cuándo
    for (const hoy of ['2027-01-01', '2027-01-10']) {
      const anios = plano(fotosDeMetricas({ hoy, aniosConFoto: [] }));
      assert.ok(tarjeta(reportes(ELEGIDO, { anios }), 'informe').includes(`${NO_DISPONIBLE}${DISPONIBLE_2027}</button>`), hoy);
    }
    // El del año en curso, también del servidor
    assert.ok(tarjeta(reportes(ELEGIDO, { anios: plano(fotosDeMetricas({ hoy: HOY_DE_LA_PRUEBA, aniosConFoto: [] })) }), 'informe')
      .includes(`${NO_DISPONIBLE}${DISPONIBLE_2027}</button>`));
  });

  it('mientras llegan los años y si no llegan, el Informe anual no se puede pedir', () => {
    for (const [anios, aviso] of [[null, 'Cargando los años…'], [[], 'No se pudieron cargar los años.']]) {
      const html = reportes(ELEGIDO, { anios });
      const informe = tarjeta(html, 'informe');
      assert.ok(informe.includes(`<p class="rp-estado">${aviso}</p>`), informe);
      assert.doesNotMatch(informe, /<select/);
      assert.ok(informe.includes(`${NO_DISPONIBLE}Descargar PDF</button>`));
      assert.equal(pedido('informe', ELEGIDO, { anios }), null, String(anios));
      // Métricas del año se descarga igual: con el año de la pestaña (el en curso, si no eligió otro)
      const metricas = tarjeta(html, 'metricas');
      assert.ok(metricas.includes(`<p class="rp-estado">${aviso}</p>`));
      assert.doesNotMatch(metricas, /<select|aria-disabled/);
      assert.deepEqual(pedido('metricas', ELEGIDO, { anios }), { ruta: '/metricas/pdf', nombre: 'Metricas-RPAD-2026.pdf' });
    }
  });

  it('Métricas del año: el año de la pestaña o el de la tarjeta, con la combinación y los destildados de la pestaña', () => {
    const dosAnios = [conFoto(2026), sinFoto(2027)];
    const select = (elegido) => tarjeta(reportes(elegido, { anios: dosAnios }), 'metricas').match(/<select id="rp-metricas-anio"[^>]*>[\s\S]*?<\/select>/)?.[0];
    // El en curso arriba, como en la barra de Métricas
    assert.equal(select(ELEGIDO), '<select id="rp-metricas-anio" class="mt-select" data-selector="rp-metricas"><option value="2027" selected>2027 (en curso)</option><option value="2026">2026</option></select>');
    assert.match(select({ ...ELEGIDO, metricas: 2026 }), /<option value="2027">2027 \(en curso\)<\/option><option value="2026" selected>2026<\/option>/);
    // El pedido: lo de la pestaña (consultaDeLaApi) con el año de la tarjeta; el en curso no se escribe
    // (sin los días, que no son un selector: un estado que todavía los trae no los manda)
    const estado = { ...POR_DEFECTO, estadistico: 'promedio', dias: 'habiles', gestion: 'interna', sin: [12, 45] };
    assert.deepEqual(pedido('metricas', ELEGIDO, { estado, anios: dosAnios }),
      { ruta: '/metricas/pdf?estadistico=promedio&sin=12,45', nombre: 'Metricas-RPAD-2027.pdf' });
    assert.deepEqual(pedido('metricas', { ...ELEGIDO, metricas: 2026 }, { estado, anios: dosAnios }),
      { ruta: '/metricas/pdf?anio=2026&estadistico=promedio&sin=12,45', nombre: 'Metricas-RPAD-2026.pdf' });
    assert.deepEqual(pedido('metricas', { ...ELEGIDO, metricas: 2027 }, { anios: dosAnios }), { ruta: '/metricas/pdf', nombre: 'Metricas-RPAD-2027.pdf' });
    // Un año que no es de los del servidor no vale: el en curso
    assert.deepEqual(pedido('metricas', { ...ELEGIDO, metricas: 2020 }, { anios: dosAnios }), { ruta: '/metricas/pdf', nombre: 'Metricas-RPAD-2027.pdf' });
    // Lo elegido en la tarjeta: el año como número; lo que no es un año no cambia nada
    assert.equal(ctx.conReporteElegido(ELEGIDO, 'metricas', '2026').metricas, 2026);
    assert.equal(ctx.conReporteElegido(ELEGIDO, 'informe', '2027').informe, 2027);
    assert.deepEqual(plano(ctx.conReporteElegido(ELEGIDO, 'metricas', 'x')), ELEGIDO);
  });

  // Ruling 39 (revisión final, A-3): del 01/01 al día de la foto, lo que le falta al año cerrado se completa antes de que se congele, así
  // que la tarjeta lo propone; si no hay un año cerrado sin foto, el en curso. El en curso no se escribe en la ruta (como Métricas del año)
  it('Datos para completar: el año cerrado sin foto o el en curso, con ?anio= si no es el en curso', () => {
    const select = (elegido, anios) => tarjeta(reportes(elegido, { anios }), 'completar').match(/<select id="rp-completar-anio"[^>]*>[\s\S]*?<\/select>/)?.[0];
    // Hoy (25/10/2026): solo el en curso
    assert.equal(select(ELEGIDO, FOTOS_2026), '<select id="rp-completar-anio" class="mt-select" data-selector="rp-completar"><option value="2026" selected>2026 (en curso)</option></select>');
    assert.deepEqual(pedido('completar'), { ruta: '/reportes/para-completar', nombre: 'Datos-para-completar-2026-10-25.pdf' });
    // Entre el 1/1 y el 10/1, 2026 todavía no tiene foto: se propone 2026
    const enero = plano(fotosDeMetricas({ hoy: '2027-01-05', aniosConFoto: [] }));
    assert.match(select(ELEGIDO, enero), /<option value="2027">2027 \(en curso\)<\/option><option value="2026" selected>2026<\/option>/);
    assert.deepEqual(pedido('completar', ELEGIDO, { anios: enero, hoy: '2027-01-05' }),
      { ruta: '/reportes/para-completar?anio=2026', nombre: 'Datos-para-completar-2027-01-05.pdf' });
    // Si la foto de 2026 falló y se reintenta, 2026 sigue sin foto y se sigue proponiendo
    const sinLaFoto = plano(fotosDeMetricas({ hoy: '2027-02-01', aniosConFoto: [] }));
    assert.equal(pedido('completar', ELEGIDO, { anios: sinLaFoto, hoy: '2027-02-01' }).ruta, '/reportes/para-completar?anio=2026');
    // Con la foto de 2026, el en curso
    const conLaFoto = plano(fotosDeMetricas({ hoy: '2027-01-11', aniosConFoto: [2026] }));
    assert.match(select(ELEGIDO, conLaFoto), /<option value="2027" selected>2027 \(en curso\)<\/option><option value="2026">2026<\/option>/);
    assert.equal(pedido('completar', ELEGIDO, { anios: conLaFoto }).ruta, '/reportes/para-completar');
    // Lo elegido en la tarjeta manda, si es de los del servidor; el en curso no se escribe
    assert.equal(pedido('completar', { ...ELEGIDO, completar: 2026 }, { anios: conLaFoto }).ruta, '/reportes/para-completar?anio=2026');
    assert.equal(pedido('completar', { ...ELEGIDO, completar: 2027 }, { anios: enero }).ruta, '/reportes/para-completar');
    assert.equal(pedido('completar', { ...ELEGIDO, completar: 2020 }, { anios: enero }).ruta, '/reportes/para-completar?anio=2026');
    assert.match(select({ ...ELEGIDO, completar: 2027 }, enero), /<option value="2027" selected>/);
    // El nombre del archivo lleva siempre el día de hoy (el PDF dice de qué año es)
    assert.equal(pedido('completar', { ...ELEGIDO, completar: 2026 }, { anios: conLaFoto }).nombre, 'Datos-para-completar-2026-10-25.pdf');
    // Lo elegido: el año como número; lo que no es un año no cambia nada
    assert.equal(ctx.conReporteElegido(ELEGIDO, 'completar', '2026').completar, 2026);
    assert.deepEqual(plano(ctx.conReporteElegido(ELEGIDO, 'completar', 'x')), ELEGIDO);
    // Sin años (mientras llegan o si no llegaron), el aviso en lugar del selector, y se pide el en curso del servidor
    for (const [anios, aviso] of [[null, 'Cargando los años…'], [[], 'No se pudieron cargar los años.']]) {
      const completar = tarjeta(reportes(ELEGIDO, { anios }), 'completar');
      assert.ok(completar.includes(`<p class="rp-estado">${aviso}</p>`), completar);
      assert.doesNotMatch(completar, /<select|aria-disabled/);
      assert.deepEqual(pedido('completar', ELEGIDO, { anios }), { ruta: '/reportes/para-completar', nombre: 'Datos-para-completar-2026-10-25.pdf' });
    }
  });

  // Spec 2026-10-25-ciclo-de-vida-del-dato, 4: el selector de los años de `fotos`, con el en curso arriba y elegido de entrada, como en
  // Métricas del año, pero independiente de la pestaña Métricas (no lleva su año, sus selectores ni sus destildados). El en curso no se
  // escribe en la ruta
  it('Ciclo de vida del dato: el en curso arriba y elegido, independiente de la pestaña Métricas', () => {
    const select = (elegido, anios) => tarjeta(reportes(elegido, { anios }), 'ciclo').match(/<select id="rp-ciclo-anio"[^>]*>[\s\S]*?<\/select>/)?.[0];
    // Hoy (25/10/2026): solo el en curso
    assert.equal(select(ELEGIDO, FOTOS_2026), '<select id="rp-ciclo-anio" class="mt-select" data-selector="rp-ciclo"><option value="2026" selected>2026 (en curso)</option></select>');
    assert.deepEqual(pedido('ciclo'), { ruta: '/reportes/ciclo-de-vida', nombre: 'Ciclo-de-vida-del-dato-2026.pdf' });
    // Con 2026 cerrado y 2027 en curso: el en curso elegido de entrada (también entre el 1/1 y el día de la foto, sin la de 2026)
    const dosAnios = [conFoto(2026), sinFoto(2027)];
    for (const anios of [dosAnios, [sinFoto(2026), sinFoto(2027)]]) {
      assert.equal(select(ELEGIDO, anios), '<select id="rp-ciclo-anio" class="mt-select" data-selector="rp-ciclo"><option value="2027" selected>2027 (en curso)</option><option value="2026">2026</option></select>');
      assert.deepEqual(pedido('ciclo', ELEGIDO, { anios }), { ruta: '/reportes/ciclo-de-vida', nombre: 'Ciclo-de-vida-del-dato-2027.pdf' });
    }
    // Elegido 2026, con ?anio=2026; elegido el en curso, sin año en la ruta
    assert.match(select({ ...ELEGIDO, ciclo: 2026 }, dosAnios), /<option value="2027">2027 \(en curso\)<\/option><option value="2026" selected>2026<\/option>/);
    assert.deepEqual(pedido('ciclo', { ...ELEGIDO, ciclo: 2026 }, { anios: dosAnios }), { ruta: '/reportes/ciclo-de-vida?anio=2026', nombre: 'Ciclo-de-vida-del-dato-2026.pdf' });
    assert.deepEqual(pedido('ciclo', { ...ELEGIDO, ciclo: 2027 }, { anios: dosAnios }), { ruta: '/reportes/ciclo-de-vida', nombre: 'Ciclo-de-vida-del-dato-2027.pdf' });
    // Un año que no es de los del servidor no vale: el en curso
    assert.deepEqual(pedido('ciclo', { ...ELEGIDO, ciclo: 2020 }, { anios: dosAnios }), { ruta: '/reportes/ciclo-de-vida', nombre: 'Ciclo-de-vida-del-dato-2027.pdf' });
    // Lo de la pestaña Métricas no llega: ni su año (el de Métricas del año), ni la combinación, ni los destildados
    const estado = { ...POR_DEFECTO, anio: 2026, estadistico: 'promedio', gestion: 'interna', sin: [12, 45] };
    assert.deepEqual(pedido('ciclo', { ...ELEGIDO, metricas: 2026 }, { estado, anios: dosAnios }), { ruta: '/reportes/ciclo-de-vida', nombre: 'Ciclo-de-vida-del-dato-2027.pdf' });
    assert.match(select({ ...ELEGIDO, metricas: 2026 }, dosAnios), /<option value="2027" selected>2027 \(en curso\)<\/option>/);
    // Lo elegido en la tarjeta: el año como número; lo que no es un año no cambia nada. De entrada, ninguno (el en curso)
    assert.equal(ctx.conReporteElegido(ELEGIDO, 'ciclo', '2026').ciclo, 2026);
    assert.deepEqual(plano(ctx.conReporteElegido(ELEGIDO, 'ciclo', 'x')), ELEGIDO);
    assert.equal(plano(vm.runInContext('REPORTES_POR_DEFECTO', ctx)).ciclo, null);
    // Se redibuja cuando llegan los años, como las otras tarjetas con año
    assert.deepEqual(plano(vm.runInContext('TARJETAS_CON_ANIO', ctx)), ['metricas', 'ciclo', 'informe', 'completar']);
    // Sin años (mientras llegan o si no llegaron), el aviso en lugar del selector, y se pide el en curso del servidor, con el año de hoy en
    // el nombre
    for (const [anios, aviso] of [[null, 'Cargando los años…'], [[], 'No se pudieron cargar los años.']]) {
      const ciclo = tarjeta(reportes(ELEGIDO, { anios }), 'ciclo');
      assert.ok(ciclo.includes(`<p class="rp-estado">${aviso}</p>`), ciclo);
      assert.doesNotMatch(ciclo, /<select|aria-disabled/);
      assert.deepEqual(pedido('ciclo', ELEGIDO, { anios }), { ruta: '/reportes/ciclo-de-vida', nombre: 'Ciclo-de-vida-del-dato-2026.pdf' });
      assert.equal(pedido('ciclo', ELEGIDO, { anios, hoy: '2027-01-02' }).nombre, 'Ciclo-de-vida-del-dato-2027.pdf');
    }
    // Con datos vacíos, nada dice NaN, null ni undefined
    for (const datos of [{}, undefined, null]) {
      for (const anios of [null, [], undefined, dosAnios]) {
        assert.doesNotMatch(JSON.stringify(ctx.pedidoDeReporte('ciclo', datos, { anios, hoy: HOY_DE_LA_PRUEBA })), /NaN|null|undefined/);
        assert.doesNotMatch(ctx.htmlDeTarjetaDeReportes('ciclo', datos, { anios }), /NaN|null|undefined/);
      }
    }
  });

  it('las rutas y los nombres de los ocho PDF, con el día de hoy en Argentina', () => {
    // El nombre, el que pone el servidor en su Content-Disposition (API.pedirArchivo da solo el Blob: se arma acá con nombreDelReporte)
    assert.deepEqual(pedido('metricas'), { ruta: '/metricas/pdf', nombre: 'Metricas-RPAD-2026.pdf' });
    assert.deepEqual(pedido('ciclo'), { ruta: '/reportes/ciclo-de-vida', nombre: 'Ciclo-de-vida-del-dato-2026.pdf' });
    assert.deepEqual(pedido('informe', ELEGIDO, { anios: [conFoto(2026)] }), { ruta: '/reportes/informe-anual?anio=2026', nombre: 'Informe-anual-RPAD-2026.pdf' });
    assert.deepEqual(pedido('estado'), { ruta: '/reportes/estado-general', nombre: 'estado-general-25-10-2026.pdf' });
    assert.deepEqual(pedido('area', { ...ELEGIDO, area: '7' }), { ruta: '/reportes/por-area/7', nombre: 'Reporte-area-7-2026-10-25.pdf' });
    assert.deepEqual(pedido('avisos'), { ruta: '/reportes/avisos?desde=2026-01-01&hasta=2026-10-25', nombre: 'Avisos-RPAD-2026-10-25.pdf' });
    assert.deepEqual(pedido('agenda'), { ruta: '/reportes/agenda?meses=6&gestion=ambas', nombre: 'Agenda-de-pedidos-2026-10-25.pdf' });
    assert.deepEqual(pedido('agenda', { ...ELEGIDO, meses: 12, gestion: 'externa' }), { ruta: '/reportes/agenda?meses=12&gestion=externa', nombre: 'Agenda-de-pedidos-2026-10-25.pdf' });
    assert.deepEqual(pedido('completar'), { ruta: '/reportes/para-completar', nombre: 'Datos-para-completar-2026-10-25.pdf' });
    // El día es el de `hoy` (Utils.hoyEnArgentina() en la página)
    assert.equal(pedido('completar', ELEGIDO, { hoy: '2027-01-02' }).nombre, 'Datos-para-completar-2027-01-02.pdf');
    assert.equal(pedido('estado', ELEGIDO, { hoy: '2027-01-02' }).nombre, 'estado-general-02-01-2027.pdf');
    // Un reporte que no es de los ocho, nada
    assert.equal(pedido('cumplimiento'), null);
  });

  // Los controladores ponen el nombre con nombreDelReporte (services/reportesNombres.js); la página guarda el Blob con su copia
  it('nombreDelReporte es el mismo en la página y en el servidor', () => {
    const casos = [
      ...['metricas', 'ciclo', 'informe'].flatMap((tipo) => [2026, 2027, '2026'].map((anio) => [tipo, { anio }])),
      ...['estado', 'avisos', 'agenda', 'completar'].flatMap((tipo) => ['2026-10-25', '2027-01-02', '2028-02-29', '2026-12-31'].map((hoy) => [tipo, { hoy }])),
      ...[7, '34', 145].flatMap((area) => ['2026-10-25', '2027-01-02'].map((hoy) => ['area', { area, hoy }])),
      ['cumplimiento', { hoy: '2026-10-25' }], ['', {}]
    ];
    for (const [tipo, datos] of casos) assert.equal(ctx.nombreDelReporte(tipo, datos), nombreDelReporteDelServidor(tipo, datos), `${tipo} ${JSON.stringify(datos)}`);
    // Y lo que pide cada tarjeta lleva ese nombre
    for (const clave of ['estado', 'avisos', 'agenda', 'completar']) {
      assert.equal(pedido(clave).nombre, nombreDelReporteDelServidor(clave, { hoy: HOY_DE_LA_PRUEBA }), clave);
    }
    assert.equal(pedido('area', { ...ELEGIDO, area: '7' }).nombre, nombreDelReporteDelServidor('area', { area: 7, hoy: HOY_DE_LA_PRUEBA }));
    assert.equal(pedido('metricas').nombre, nombreDelReporteDelServidor('metricas', { anio: 2026 }));
    assert.equal(pedido('ciclo').nombre, nombreDelReporteDelServidor('ciclo', { anio: 2026 }));
    assert.equal(pedido('ciclo', { ...ELEGIDO, ciclo: 2026 }, { anios: [conFoto(2026), sinFoto(2027)] }).nombre, nombreDelReporteDelServidor('ciclo', { anio: 2026 }));
    assert.equal(pedido('informe', ELEGIDO, { anios: [conFoto(2026)] }).nombre, nombreDelReporteDelServidor('informe', { anio: 2026 }));
  });

  it('la Agenda: los chips 3, 6 y 12 meses con aria-pressed y la gestión, con los valores del servidor', () => {
    const agenda = tarjeta(reportes(), 'agenda');
    assert.match(agenda, /<span class="rp-rotulo" id="rp-meses-rotulo">Próximos<\/span><div class="mt-chips" role="group" aria-labelledby="rp-meses-rotulo">/);
    const chips = [...agenda.matchAll(/<button type="button" class="mt-chip" data-selector="rp-meses" data-valor="(\d+)" aria-pressed="(true|false)">([^<]+)<\/button>/g)]
      .map((m) => [Number(m[1]), m[2], m[3]]);
    assert.deepEqual(chips, [[3, 'false', '3'], [6, 'true', '6'], [12, 'false', '12 meses']]);
    assert.match(agenda, /<select id="rp-gestion" class="mt-select" data-selector="rp-gestion"><option value="ambas" selected>Las dos gestiones<\/option><option value="externa">Gestión externa<\/option><option value="interna">Gestión interna<\/option><\/select>/);
    const otra = tarjeta(reportes({ ...ELEGIDO, meses: 12, gestion: 'interna' }), 'agenda');
    assert.match(otra, /data-valor="12" aria-pressed="true"/);
    assert.match(otra, /<option value="interna" selected>/);
    // Los valores son los de opcionesDeAgenda (services/reportesAgenda.js), con 6 meses y las dos gestiones de entrada
    assert.deepEqual(chips.map(([n]) => n), [...MESES_DE_LA_AGENDA]);
    assert.deepEqual([...agenda.matchAll(/<option value="([a-z]+)"/g)].map((m) => m[1]), [...GESTIONES_DE_LA_AGENDA]);
    const porDefecto = plano(vm.runInContext('REPORTES_POR_DEFECTO', ctx));
    assert.deepEqual([porDefecto.meses, porDefecto.gestion], [MESES_POR_DEFECTO, GESTIONES_DE_LA_AGENDA[0]]);
    // Lo que no es de la lista no cambia nada
    assert.equal(ctx.conReporteElegido(ELEGIDO, 'meses', '12').meses, 12);
    assert.equal(ctx.conReporteElegido(ELEGIDO, 'gestion', 'externa').gestion, 'externa');
    for (const [clave, valor] of [['meses', '5'], ['meses', 'x'], ['gestion', 'todas'], ['otra', '1']]) {
      assert.deepEqual(plano(ctx.conReporteElegido(ELEGIDO, clave, valor)), ELEGIDO, `${clave}=${valor}`);
    }
    // Un valor raro en lo elegido no llega a la ruta
    assert.equal(pedido('agenda', { ...ELEGIDO, meses: 5, gestion: '"><x' }).ruta, '/reportes/agenda?meses=6&gestion=ambas');
  });

  it('Por área: las áreas por nombre, «Elegí un área» primero, y lo elegido marcado', () => {
    const area = tarjeta(reportes({ ...ELEGIDO, area: '12' }), 'area');
    assert.match(area, /<select id="rp-area" class="mt-select" data-selector="rp-area"><option value="">Elegí un área<\/option><option value="3">Área de Ambiente<\/option><option value="12" selected>Dirección de Comercio<\/option><option value="7">Secretaría de Hacienda<\/option><\/select>/);
    // Mientras llegan, lo dice
    assert.match(tarjeta(reportes(ELEGIDO, { areas: null }), 'area'), /<select id="rp-area" class="mt-select" data-selector="rp-area"><option value="">Cargando las áreas…<\/option><\/select>/);
    // Un área sin un id que pueda ir en la dirección no se ofrece
    assert.doesNotMatch(tarjeta(reportes(ELEGIDO, { areas: [{ id: '1#x', nombre: 'Rara' }, { id: 0, nombre: 'Cero' }, null] }), 'area'), /Rara|Cero/);
    // Sin elegir (o con algo que no es un id), el aviso y el foco en el selector
    for (const valor of ['', 'x', '0', '-3', '1.5', '7#x']) {
      assert.deepEqual(pedido('area', { ...ELEGIDO, area: valor }), { error: 'Elegí un área.', foco: 'rp-area' }, valor);
    }
  });

  it('Avisos del RPAD: un período que no es válido no se pide y se avisa con el mensaje del servidor', () => {
    // El mensaje es una copia del de periodoDeAvisos (controllers/reportesController.js)
    assert.equal(vm.runInContext('PERIODO_INVALIDO', ctx), MENSAJE_PERIODO_INVALIDO);
    for (const [desde, hasta, foco] of [['', HOY_DE_LA_PRUEBA, 'rp-desde'], ['2026-02-30', HOY_DE_LA_PRUEBA, 'rp-desde'], ['2026-01-01', '', 'rp-hasta'],
      ['2026-01-01', '2026-13-01', 'rp-hasta'], ['2026-10-26', HOY_DE_LA_PRUEBA, 'rp-desde'], ['01/01/2026', HOY_DE_LA_PRUEBA, 'rp-desde']]) {
      assert.deepEqual(pedido('avisos', { ...ELEGIDO, desde, hasta }), { error: MENSAJE_PERIODO_INVALIDO, foco }, `${desde} → ${hasta}`);
    }
    // Un solo día vale
    assert.equal(pedido('avisos', { ...ELEGIDO, desde: HOY_DE_LA_PRUEBA }).ruta, `/reportes/avisos?desde=${HOY_DE_LA_PRUEBA}&hasta=${HOY_DE_LA_PRUEBA}`);
    const avisos = tarjeta(reportes(), 'avisos');
    assert.match(avisos, /<input type="date" id="rp-desde" class="mt-entrada" data-selector="rp-desde" value="2026-01-01">/);
    assert.match(avisos, /<input type="date" id="rp-hasta" class="mt-entrada" data-selector="rp-hasta" value="2026-10-25">/);
  });

  it('el botón de un reporte que se está descargando queda deshabilitado en cada redibujo', () => {
    const html = reportes(ELEGIDO, { descargando: ['estado', 'agenda'] });
    for (const clave of ['estado', 'agenda']) assert.match(tarjeta(html, clave), new RegExp(`data-reporte="${clave}" aria-describedby="rp-titulo-${clave}" disabled>`), clave);
    for (const clave of ['metricas', 'ciclo', 'area', 'avisos', 'completar']) assert.doesNotMatch(tarjeta(html, clave), / disabled>/, clave);
  });

  it('lo que llega del servidor y de los campos pasa por escapeHtml', () => {
    const html = ctx.htmlDeReportes({ ...ELEGIDO, desde: '"><b>x</b>' }, { anios: [sinFoto(2026, '<b>x</b>')], areas: [{ id: 5, nombre: '<b>x</b>' }] });
    assert.doesNotMatch(html, /<b>x<\/b>/);
    assert.ok(html.includes('<option value="5">&lt;b&gt;x&lt;/b&gt;</option>'));
    assert.ok(html.includes('value="&quot;&gt;&lt;b&gt;x&lt;/b&gt;"'));
    assert.ok(tarjeta(html, 'informe').includes(`${NO_DISPONIBLE}&lt;b&gt;x&lt;/b&gt;</button>`));
    // Sin el texto del servidor, el botón no dice nada raro
    assert.ok(tarjeta(ctx.htmlDeReportes(ELEGIDO, { anios: [{ anio: 2026, con_foto: false }] }), 'informe').includes(`${NO_DISPONIBLE}Descargar PDF</button>`));
    assert.doesNotMatch(ctx.htmlDeReportes({}, {}), /NaN|null|undefined/);
    assert.doesNotMatch(ctx.htmlDeReportes(undefined, undefined), /NaN|null|undefined/);
    assert.doesNotMatch(ctx.htmlDeReportes(null, null), /NaN|null|undefined/);
  });

  // Lo que toca el DOM: el document de mentira de la página. Cada id tiene un elemento que no hace nada (el de las tarjetas guarda su HTML
  // y sus oyentes; los controles que reciben el foco lo anotan) y la API responde por ruta (`rutas`: la ruta exacta o, terminada en *, las
  // que empiezan así; sin ruta, un 404; una función que tira es un error del servidor)
  const conLaPagina = (rutas = {}) => {
    const pedidos = [];
    const descargas = [];
    const avisos = [];
    const enfocados = [];
    const oyentes = {};
    const elemento = (id) => ({
      id, innerHTML: '', textContent: '', hidden: false, value: '', dataset: {}, style: {},
      classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, removeAttribute() {}, getAttribute: () => null,
      addEventListener: (tipo, oyente) => { if (id === 'rp-reportes') oyentes[tipo] = oyente; },
      querySelector: () => null, querySelectorAll: () => [], contains: () => false, focus: () => enfocados.push(id), scrollIntoView() {}
    });
    const elementos = {};
    const contexto = cargar({
      __pedidos: pedidos,
      __rutas: { '/areas': () => ({ success: true, data: LAS_AREAS }), '/gestion/metricas-manuales*': () => ({ success: true, data: [] }), ...rutas },
      document: {
        addEventListener() {}, getElementById: (id) => (elementos[id] ??= elemento(id)), activeElement: null,
        createElement: () => ({ click() { descargas.push(this.download); } })
      },
      showToast: (mensaje, tipo) => avisos.push([mensaje, tipo]),
      URL: { createObjectURL: () => 'blob:reporte', revokeObjectURL() {} },
      setTimeout: () => {}
    });
    vm.runInContext(`
      API.pedirJson = async (metodo, ruta) => {
        __pedidos.push(ruta);
        const clave = Object.keys(__rutas).find((r) => (r.endsWith('*') ? ruta.startsWith(r.slice(0, -1)) : ruta === r));
        if (!clave) throw Object.assign(new Error('Error 404'), { status: 404 });
        return __rutas[clave]();
      };
      API.pedirArchivo = async (ruta) => { __pedidos.push(ruta); return "pdf"; };`, contexto);
    const hoy = vm.runInContext('Utils.hoyEnArgentina()', contexto);
    const contenedor = () => elementos['rp-reportes'];
    // Un cambio en un control de las tarjetas, como lo manda el navegador
    const cambiar = (selector, value) => {
      const objetivo = { dataset: { selector }, value, closest: () => objetivo };
      oyentes.change({ type: 'change', target: objetivo });
    };
    // Un click en un chip o en un botón de las tarjetas
    const clic = (objetivo) => oyentes.click({ target: { closest: (selector) => (objetivo.coincide(selector) ? objetivo : null), ...objetivo } });
    const boton = (reporte) => ({ dataset: { reporte }, disabled: false, getAttribute: () => null });
    return { contexto, contenedor, pedidos, descargas, avisos, enfocados, hoy, cambiar, clic, boton };
  };

  it('Avisos del RPAD trae del 1/1 a hoy', async () => {
    const p = conLaPagina();
    await p.contexto.iniciarTarjetasDeReportes();
    const desde = `${p.hoy.slice(0, 4)}-01-01`;
    assert.ok(p.contenedor().innerHTML.includes(`id="rp-desde" class="mt-entrada" data-selector="rp-desde" value="${desde}"`), 'desde');
    assert.ok(p.contenedor().innerHTML.includes(`id="rp-hasta" class="mt-entrada" data-selector="rp-hasta" value="${p.hoy}"`), 'hasta');
    // Las áreas llegaron (GET /api/areas)
    assert.ok(p.contenedor().innerHTML.includes('<option value="7">Secretaría de Hacienda</option>'));
    const boton = p.boton('avisos');
    await p.contexto.descargarDeLaTarjeta(boton);
    assert.deepEqual(p.pedidos, ['/areas', `/reportes/avisos?desde=${desde}&hasta=${p.hoy}`]);
    assert.deepEqual(p.descargas, [`Avisos-RPAD-${p.hoy}.pdf`]);
    assert.equal(boton.disabled, false);
    // Otro período: el que se eligió (un solo día, hoy)
    p.cambiar('rp-desde', p.hoy);
    await p.contexto.descargarDeLaTarjeta(boton);
    assert.equal(p.pedidos.at(-1), `/reportes/avisos?desde=${p.hoy}&hasta=${p.hoy}`);
    // Desde después de hasta: no se pide nada, se avisa con el mensaje del servidor y el foco va al campo
    p.cambiar('rp-desde', `${Number(p.hoy.slice(0, 4)) + 1}-01-01`);
    await p.contexto.descargarDeLaTarjeta(boton);
    assert.equal(p.pedidos.length, 3);
    assert.deepEqual(p.avisos, [[MENSAJE_PERIODO_INVALIDO, 'error']]);
    assert.deepEqual(p.enfocados, ['rp-desde']);
  });

  it('Por área sin elegir no descarga y avisa «Elegí un área.»', async () => {
    const p = conLaPagina();
    await p.contexto.iniciarTarjetasDeReportes();
    await p.contexto.descargarDeLaTarjeta(p.boton('area'));
    assert.deepEqual(p.pedidos, ['/areas']);
    assert.deepEqual(p.descargas, []);
    assert.deepEqual(p.avisos, [['Elegí un área.', 'error']]);
    assert.deepEqual(p.enfocados, ['rp-area']);
    // Elegida, se descarga con su id y el día de hoy
    p.cambiar('rp-area', '7');
    await p.contexto.descargarDeLaTarjeta(p.boton('area'));
    assert.deepEqual(p.pedidos, ['/areas', '/reportes/por-area/7']);
    assert.deepEqual(p.descargas, [`Reporte-area-7-${p.hoy}.pdf`]);
  });

  // GET /api/areas con API.pedirJson: una respuesta de error tira (API.getAreas la devolvería como una lista vacía, sin aviso)
  it('si las áreas no llegan, lo avisa y el selector queda con «Elegí un área»', async () => {
    const p = conLaPagina({ '/areas': () => { throw Object.assign(new Error('Error al obtener las áreas'), { status: 500 }); } });
    await p.contexto.iniciarTarjetasDeReportes();
    assert.deepEqual(p.pedidos, ['/areas']);
    assert.deepEqual(p.avisos, [['No se pudieron cargar las áreas.', 'error']]);
    assert.match(p.contenedor().innerHTML, /<select id="rp-area" class="mt-select" data-selector="rp-area"><option value="">Elegí un área<\/option><\/select>/);
  });

  it('un botón deshabilitado no pide nada, y un error del servidor se avisa', async () => {
    const p = conLaPagina();
    await p.contexto.iniciarTarjetasDeReportes();
    await p.contexto.descargarDeLaTarjeta({ dataset: { reporte: 'estado' }, disabled: false, getAttribute: (nombre) => (nombre === 'aria-disabled' ? 'true' : null) });
    assert.deepEqual(p.pedidos, ['/areas']);
    vm.runInContext('API.pedirArchivo = async () => { throw new Error("No hay métricas de ese año"); };', p.contexto);
    const boton = p.boton('completar');
    await p.contexto.descargarDeLaTarjeta(boton);
    assert.deepEqual(p.avisos, [['No se pudo descargar el PDF: No hay métricas de ese año', 'error']]);
    assert.deepEqual(p.descargas, []);
    assert.equal(boton.disabled, false);
  });

  // Un redibujo en medio de una descarga no le habilita el botón (el estado lo sabe): no se pide dos veces
  it('una descarga en curso sigue deshabilitada aunque se redibuje, y no se pide dos veces', async () => {
    const p = conLaPagina();
    await p.contexto.iniciarTarjetasDeReportes();
    vm.runInContext('API.pedirArchivo = (ruta) => { __pedidos.push(ruta); return new Promise((resolver) => { globalThis.__terminar = () => resolver("pdf"); }); };', p.contexto);
    const boton = p.boton('estado');
    const descarga = p.contexto.descargarDeLaTarjeta(boton);
    assert.equal(boton.disabled, true);
    // Un redibujo de todas (el de la página de mentira) la dibuja deshabilitada
    vm.runInContext('dibujarReportes()', p.contexto);
    assert.match(p.contenedor().innerHTML, /data-reporte="estado" aria-describedby="rp-titulo-estado" disabled>/);
    // Otro click sobre el botón nuevo (habilitado en el DOM de mentira) no vuelve a pedir
    await p.contexto.descargarDeLaTarjeta(p.boton('estado'));
    assert.equal(p.pedidos.filter((ruta) => ruta === '/reportes/estado-general').length, 1);
    vm.runInContext('__terminar()', p.contexto);
    await descarga;
    assert.equal(boton.disabled, false);
    vm.runInContext('dibujarReportes()', p.contexto);
    assert.doesNotMatch(p.contenedor().innerHTML, / disabled>/);
    assert.deepEqual(p.descargas, [`estado-general-${p.hoy.slice(8, 10)}-${p.hoy.slice(5, 7)}-${p.hoy.slice(0, 4)}.pdf`]);
  });

  // conElFoco y el redibujo de una tarjeta devuelven el foco al botón del mismo reporte
  it('el foco vuelve al botón del mismo reporte después de redibujar', () => {
    const activo = { dataset: { reporte: 'estado' } };
    const contexto = cargar({ document: { addEventListener() {}, getElementById: () => null, activeElement: activo } });
    assert.equal(contexto.claveDelFoco({ contains: (elemento) => elemento === activo }), '[data-reporte="estado"]');
    assert.equal(contexto.claveDelFoco({ contains: () => false }), null);
    // Los de siempre siguen igual: el chip con su valor, el selector, la fila y la acción
    const conDatos = (dataset) => cargar({ document: { addEventListener() {}, getElementById: () => null, activeElement: { dataset } } })
      .claveDelFoco({ contains: () => true });
    assert.equal(conDatos({ selector: 'rp-meses', valor: '6' }), '[data-selector="rp-meses"][data-valor="6"]');
    assert.equal(conDatos({ selector: 'rp-informe' }), '[data-selector="rp-informe"]');
    assert.equal(conDatos({ fila: '3' }), '[data-fila="3"]');
    assert.equal(conDatos({ accion: 'pdf' }), '[data-accion="pdf"]');
  });

  it('un chip de la Agenda cambia los meses y se redibuja; un botón descarga', async () => {
    const p = conLaPagina();
    await p.contexto.iniciarTarjetasDeReportes();
    const chip = { dataset: { selector: 'rp-meses', valor: '12' }, coincide: (selector) => selector === 'button[data-selector="rp-meses"]' };
    p.clic(chip);
    assert.equal(vm.runInContext('pagina.reportes.elegido.meses', p.contexto), 12);
    assert.match(p.contenedor().innerHTML, /data-valor="12" aria-pressed="true">12 meses</);
    assert.match(p.contenedor().innerHTML, /data-valor="6" aria-pressed="false">6</);
    const boton = { ...p.boton('agenda'), coincide: (selector) => selector === 'button[data-reporte]' };
    p.clic(boton);
    await new Promise((resolver) => setImmediate(resolver));
    assert.equal(p.pedidos.at(-1), '/reportes/agenda?meses=12&gestion=ambas');
  });

  it('cambiar el año del Informe anual redibuja su botón', async () => {
    const p = conLaPagina();
    await p.contexto.iniciarTarjetasDeReportes();
    p.contexto.conLosAniosDeReportes([conFoto(2026), sinFoto(2027)]);
    assert.match(p.contenedor().innerHTML, /<option value="2026" selected>2026<\/option><\/select><\/div><\/div><button type="button" class="mt-btn mt-btn-tinta" data-reporte="informe"/);
    p.cambiar('rp-informe', '2027');
    assert.equal(vm.runInContext('pagina.reportes.elegido.informe', p.contexto), 2027);
    const informe = tarjeta(p.contenedor().innerHTML, 'informe');
    assert.match(informe, /<option value="2027" selected>2027<\/option>/);
    assert.ok(informe.includes(`${NO_DISPONIBLE}Disponible desde el 10/01/2028</button>`), informe);
  });

  // Sin la clave en conReporteElegido y en CONTROLES_DE_REPORTES, el selector de la tarjeta no haría nada (spec 4)
  it('el año del Ciclo de vida del dato queda en lo elegido y lo pide el botón, sin el año de la pestaña Métricas', async () => {
    const p = conLaPagina();
    await p.contexto.iniciarTarjetasDeReportes();
    p.contexto.conLosAniosDeReportes([conFoto(2026), sinFoto(2027)]);
    // La pestaña Métricas en 2026: Métricas del año la sigue; el Ciclo de vida del dato, no
    vm.runInContext('pagina.estado = { ...pagina.estado, anio: 2026, estadistico: "promedio", sin: [12] }; dibujarReportes();', p.contexto);
    assert.match(tarjeta(p.contenedor().innerHTML, 'metricas'), /<option value="2026" selected>2026<\/option>/);
    assert.match(tarjeta(p.contenedor().innerHTML, 'ciclo'), /<option value="2027" selected>2027 \(en curso\)<\/option><option value="2026">2026<\/option>/);
    await p.contexto.descargarDeLaTarjeta(p.boton('ciclo'));
    assert.equal(p.pedidos.at(-1), '/reportes/ciclo-de-vida');
    assert.deepEqual(p.descargas, ['Ciclo-de-vida-del-dato-2027.pdf']);
    // Elegido 2026 en la tarjeta
    p.cambiar('rp-ciclo', '2026');
    assert.equal(vm.runInContext('pagina.reportes.elegido.ciclo', p.contexto), 2026);
    await p.contexto.descargarDeLaTarjeta(p.boton('ciclo'));
    assert.equal(p.pedidos.at(-1), '/reportes/ciclo-de-vida?anio=2026');
    assert.deepEqual(p.descargas, ['Ciclo-de-vida-del-dato-2027.pdf', 'Ciclo-de-vida-del-dato-2026.pdf']);
    vm.runInContext('dibujarReportes()', p.contexto);
    assert.match(tarjeta(p.contenedor().innerHTML, 'ciclo'), /<option value="2026" selected>2026<\/option>/);
    // Y Métricas del año no cambió
    assert.equal(vm.runInContext('pagina.reportes.elegido.metricas', p.contexto), null);
  });

  // Los años llegan con la respuesta de la pestaña Métricas (cargarMetricas → conLosAniosDeReportes). Si esa respuesta es un error (un año
  // sin métricas en la dirección), se piden una vez con GET /api/metricas sin parámetros; solo si eso también falla, «No se pudieron…»
  describe('los años de las tarjetas', () => {
    const METRICAS = {
      anio: 2026, al: HOY, en_vivo: true, aviso_foto: null, anios: [2026], fotos: [conFoto(2026)], vista: VISTA,
      cinta: { externa: CINTA_EXTERNA, interna: CINTA_INTERNA }, contexto: CONTEXTO, trabajo: TRABAJO, areas: AREAS, sin_titulos: [], sin_texto: ''
    };
    const informe = (p) => tarjeta(p.contenedor().innerHTML, 'informe');

    it('con la respuesta de la pestaña Métricas', async () => {
      const p = conLaPagina({ '/metricas?*': () => ({ success: true, data: METRICAS }) });
      await p.contexto.iniciarTarjetasDeReportes();
      assert.ok(informe(p).includes('<p class="rp-estado">Cargando los años…</p>'));
      await p.contexto.cargarMetricas();
      assert.ok(informe(p).includes('<button type="button" class="mt-btn mt-btn-tinta" data-reporte="informe"'), informe(p));
      assert.match(informe(p), /<option value="2026" selected>2026<\/option>/);
      assert.equal(p.pedidos.filter((ruta) => ruta === '/metricas').length, 0, 'sin pedido de respaldo');
      // Datos para completar también recibe los años (Ruling 39) y guarda el que se elige
      assert.match(tarjeta(p.contenedor().innerHTML, 'completar'), /<select id="rp-completar-anio" class="mt-select" data-selector="rp-completar"><option value="2026" selected>2026 \(en curso\)<\/option><\/select>/);
      p.cambiar('rp-completar', '2026');
      assert.equal(vm.runInContext('pagina.reportes.elegido.completar', p.contexto), 2026);
    });

    it('con un 404 de la pestaña, de GET /api/metricas sin parámetros, una sola vez', async () => {
      const p = conLaPagina({ '/metricas': () => ({ success: true, data: { ...METRICAS, fotos: [sinFoto(2026)] } }) });
      await p.contexto.iniciarTarjetasDeReportes();
      vm.runInContext('pagina.estado = { ...pagina.estado, anio: 2030 }', p.contexto);
      await p.contexto.cargarMetricas();
      await vm.runInContext('pagina.reportes.pedidoDeAnios', p.contexto);
      assert.ok(p.pedidos.includes('/metricas?anio=2030'));
      assert.ok(informe(p).includes(`${NO_DISPONIBLE}${DISPONIBLE_2027}</button>`), informe(p));
      // Otra respuesta de error no lo vuelve a pedir
      await p.contexto.cargarMetricas();
      assert.equal(p.pedidos.filter((ruta) => ruta === '/metricas').length, 1);
      assert.ok(informe(p).includes(DISPONIBLE_2027));
    });

    it('si el respaldo también falla, «No se pudieron cargar los años.»', async () => {
      const p = conLaPagina({ '/metricas?*': () => { throw Object.assign(new Error('Error al obtener las métricas'), { status: 500 }); } });
      await p.contexto.iniciarTarjetasDeReportes();
      await p.contexto.cargarMetricas();
      await vm.runInContext('pagina.reportes.pedidoDeAnios', p.contexto);
      assert.deepEqual(p.pedidos.filter((ruta) => ruta.startsWith('/metricas')), ['/metricas?', '/metricas']);
      assert.ok(informe(p).includes('<p class="rp-estado">No se pudieron cargar los años.</p>'), informe(p));
      assert.ok(tarjeta(p.contenedor().innerHTML, 'metricas').includes('<p class="rp-estado">No se pudieron cargar los años.</p>'));
    });
  });
});

describe('reportes.html', () => {
  const html = leer('reportes.html');

  it('se llama «Métricas y Reportes» y tiene las dos pestañas, Métricas primero', () => {
    assert.match(html, /<title>Métricas y Reportes - RPAD<\/title>/);
    assert.match(html, /<h1 class="page-title">[\s\S]*?Métricas y Reportes\s*<\/h1>/);
    assert.match(html, /<div class="mt-pestanas" id="pestanas-reportes" role="tablist" aria-label="Secciones de Métricas y Reportes">/);
    const pestanas = [...html.matchAll(/<button type="button" class="mt-pestana" role="tab" id="pestana-([a-z]+)" aria-selected="false" aria-controls="vista-\1" data-vista="\1" tabindex="-1">([^<]+)<\/button>/g)]
      .map((m) => `${m[1]}: ${m[2]}`);
    assert.deepEqual(pestanas, ['metricas: Métricas', 'reportes: Reportes']);
    for (const nombre of ['metricas', 'reportes']) assert.match(html, new RegExp(`<section id="vista-${nombre}" role="tabpanel" aria-labelledby="pestana-${nombre}"`));
  });

  it('los estados de la pestaña Métricas y los lugares que llena reportes.js', () => {
    assert.match(html, /role="status">Cargando las métricas…</);
    assert.match(html, /role="alert" hidden>\s*<p>No se pudieron cargar las métricas\. Probá de nuevo en unos minutos\.<\/p>/);
    for (const id of ['mt-bajada', 'mt-barra', 'mt-franja', 'mt-cargando', 'mt-error', 'mt-sin-datos', 'mt-contenido', 'mt-gestiones', 'mt-circuito', 'mt-cinta',
      'mt-aclaracion-cinta', 'mt-ver-casos', 'mt-titulo-casos', 'mt-casos', 'mt-indice', 'mt-resultados', 'mt-bajada-resultados',
      'mt-contexto', 'mt-trabajo', 'mt-bajada-trabajo', 'mt-manuales', 'mt-auditoria', 'mt-csv', 'mt-areas', 'mt-completar']) {
      assert.equal(cuantas(html, new RegExp(`id="${id}"`, 'g')), 1, id);
    }
    // Sin «Días corridos», que ya no es un selector (spec 2026-11-07-metricas-cajones-y-ciclos, 4), y sin la leyenda de la cinta, el recuadro
    // de las aclaraciones ni el pie de la mediana (spec 2026-11-08-metricas-recorrido-tipico)
    assert.doesNotMatch(html, /«Días corridos»|«Días hábiles»/);
    assert.doesNotMatch(html, /id="mt-leyenda"|id="mt-aclaraciones"|Con «Mediana», el número grande/);
    // El recorrido típico: el lugar del dibujo y, debajo, su frase; los dos antes de «Los casos». Sin foco, sin rol y sin desplazarse de costado
    const dibujo = html.indexOf('id="mt-cinta"');
    assert.ok(dibujo > html.indexOf('id="mt-circuito"') && dibujo < html.indexOf('id="mt-aclaracion-cinta"'));
    assert.ok(html.indexOf('id="mt-aclaracion-cinta"') < html.indexOf('class="mt-casos-cab"'));
    assert.match(html, /<div id="mt-cinta" hidden><\/div>\s*<p class="mt-pie" id="mt-aclaracion-cinta"><\/p>/);
    assert.doesNotMatch(html, /mt-cinta-marco|mt-cinta-svg|class="mk |\.mk-/);
    // «No hay métricas de ese año» no escribe un año a mano
    const sinDatos = html.match(/<div class="mt-estado" id="mt-sin-datos"[\s\S]*?<\/div>/)?.[0] ?? '';
    assert.match(sinDatos, /<h2>No hay métricas de ese año<\/h2>/);
    assert.doesNotMatch(sinDatos, /\d{4}/);
  });

  // El recorrido típico (spec 2026-11-08-metricas-recorrido-tipico): lo que el dibujo necesita del CSS, sin medirlo (eso se mira en el navegador)
  it('el CSS del recorrido típico: la regla del aviso es un contenedor, el tramo angosto no lleva nada arriba y sin clases con «ad-»', () => {
    const regla = (selector) => {
      const desde = html.indexOf(`${selector} {`);
      assert.notEqual(desde, -1, selector);
      return html.slice(desde, html.indexOf('}', desde));
    };
    assert.match(regla('.mt-rec-aviso'), /container-type: inline-size/);
    // En el caso angosto la fila es una grilla (el rombo y el riel siempre en un renglón) y el texto va en el segundo. El tope queda fuera de la
    // grilla, contra el final de la regla: su borde cae donde termina la regla a cualquier ancho (también 0), sin el margen de -8 px de la fila
    // flex, que en la grilla lo corría a la izquierda del vencimiento
    assert.match(html, /@container \(max-width: 419px\) \{[^@]*\.mt-rec-aviso:not\(\.sigue\) \.mt-rec-aviso-fila \{[^}]*display: grid;[^}]*grid-template-columns: auto minmax\(0, 1fr\);/);
    assert.match(html, /@container \(max-width: 419px\) \{[^@]*\.mt-rec-aviso:not\(\.sigue\) \.mt-rec-aviso-txt \{[^}]*grid-row: 2;[^}]*grid-column: 1 \/ -1;[^}]*max-width: 280px;[^}]*white-space: normal;[^}]*text-wrap: balance;/);
    assert.match(html, /@container \(max-width: 419px\) \{[^@]*\.mt-rec-aviso:not\(\.sigue\) \.mt-rec-riel \{ min-width: 0; \}/);
    assert.match(html, /@container \(max-width: 419px\) \{[^@]*\.mt-rec-aviso:not\(\.sigue\) \.mt-rec-tope \{[^}]*position: absolute;[^}]*right: 0;[^}]*margin-left: 0;/);
    assert.match(regla('.mt-rec-aviso'), /position: relative/);
    assert.match(html, /@container \(max-width: 719px\) \{[^@]*\.mt-rec-aviso\.sigue \.mt-rec-aviso-fila \{[^}]*display: grid;/);
    assert.match(html, /@container \(max-width: 719px\) \{[^@]*\.mt-rec-aviso\.sigue \.mt-rec-aviso-txt \{[^}]*grid-row: 2;[^}]*white-space: normal;[^}]*text-wrap: balance;/);
    // El texto del aviso y el del total, donde se parten en renglones, van parejos (`text-wrap: balance`, después de `white-space: normal`)
    assert.match(regla('.mt-rec-aviso.sigue .mt-rec-aviso-txt'), /white-space: normal; text-wrap: balance;/);
    assert.match(regla('.mt-rec-aviso-solo > span'), /text-wrap: balance/);
    assert.match(html, /@media \(max-width: 700px\) \{[^@]*\.mt-rec-total span \{[^}]*white-space: normal; text-wrap: balance;/);
    // La cifra grande se puede partir por palabras; en el teléfono, cada tramo a escala (no la carga) es un contenedor y, con menos de 56 px
    // (50 de contenido), esconde sus textos sin sacar la caja
    assert.doesNotMatch(regla('.mt-rec-grande'), /nowrap/);
    assert.match(html, /@media \(max-width: 700px\) \{[^@]*\.mt-rec-escala > \.mt-rec-parte \{ container-type: inline-size; container-name: mt-rec-tramo; \}/);
    assert.match(html, /@container mt-rec-tramo \(width < 50px\) \{\s*\.mt-rec-escala > \.mt-rec-parte > \.mt-rec-textos \{ visibility: hidden; \}/);
    assert.equal(cuantas(html, /container-name: mt-rec-tramo/g), 1);
    // El aire hasta la línea es de los textos juntos (no de uno que el teléfono esconde); un tramo angosto esconde todos
    assert.match(regla('.mt-rec-parte .mt-rec-textos'), /margin-bottom: 10px/);
    assert.match(regla('.mt-rec-parte.angosta .mt-rec-textos'), /display: none/);
    assert.match(regla('.mt-rec-pista'), /margin: auto -6px 0 0/);
    // «vencimiento» deja lugar para el rombo de una regla de ancho 0
    assert.match(regla('.mt-rec-aviso-venc'), /left: calc\(100% \+ 18px\)/);
    assert.match(regla('.mt-rec .gris'), /--c: var\(--sg-gris\)/);
    assert.doesNotMatch(html, /mt-directo/);
  });

  it('el índice «En esta página» lleva a las seis secciones, cada una con su título alcanzable con el foco', () => {
    assert.match(html, /<nav class="mt-indice" id="mt-indice" aria-label="En esta página"><\/nav>/);
    for (const [seccion, titulo] of [['circuito', 'El circuito'], ['resultados', 'Resultados del año'], ['contexto', 'Contexto'],
      ['trabajo', 'El trabajo del RPAD'], ['areas', 'Áreas y temas'], ['completar', 'Para completar']]) {
      assert.equal(cuantas(html, new RegExp(`<section[^>]* id="mt-seccion-${seccion}" aria-labelledby="mt-titulo-${seccion}"`, 'g')), 1, seccion);
      assert.match(html, new RegExp(`<h2[^>]* id="mt-titulo-${seccion}" tabindex="-1">${titulo}</h2>`), seccion);
    }
    // En el orden de la spec (2.1)
    const orden = [...html.matchAll(/id="mt-seccion-([a-z]+)"/g)].map((m) => m[1]);
    assert.deepEqual(orden, ['circuito', 'resultados', 'contexto', 'trabajo', 'areas', 'completar']);
  });

  it('las métricas manuales: «Cargar el mes» y su formulario, ocultos (los muestra reportes.js solo a administración), cada campo con su label', () => {
    assert.match(html, /<button type="button" class="mt-link" id="mt-manual-abrir" aria-expanded="false" aria-controls="mt-manual-form" hidden>Cargar el mes<\/button>/);
    const formulario = html.match(/<form class="mt-form" id="mt-manual-form"[^>]*>[\s\S]*?<\/form>/)?.[0] ?? '';
    assert.match(formulario, /^<form class="mt-form" id="mt-manual-form" novalidate hidden>/);
    for (const [id, rotulo] of [['mt-manual-tipo', 'Tipo'], ['mt-manual-mes', 'Mes'], ['mt-manual-anio', 'Año'], ['mt-manual-cantidad', 'Cantidad']]) {
      assert.match(formulario, new RegExp(`<label for="${id}">${rotulo}</label>`), id);
      assert.equal(cuantas(formulario, new RegExp(`id="${id}"`, 'g')), 1, id);
    }
    // Los tipos de la API de Gestión (tiposValidos de createMetricaManual) y los doce meses
    assert.deepEqual([...formulario.matchAll(/<option value="([a-z_]+)">/g)].map((m) => m[1]), ['reuniones_capacitaciones', 'consultas_atendidas', 'notas_enviadas']);
    assert.equal(cuantas(formulario, /<option value="\d+">/g), 12);
    assert.match(formulario, /<button type="submit" class="mt-btn mt-btn-tinta" id="mt-manual-guardar">Guardar<\/button>/);
  });

  // La pestaña Reportes la dibuja reportes.js (htmlDeReportes): el HTML tiene solo su lugar. Sale el Cumplimiento y el Historial de
  // notificaciones pasa a ser «Avisos del RPAD» (spec 2026-10-24-metricas-y-reportes, 5)
  it('la pestaña Reportes: el lugar de las tarjetas, sin onclick ni las tarjetas y funciones viejas', () => {
    const reportes = html.match(/<section id="vista-reportes"[\s\S]*?<\/section>/)?.[0] ?? '';
    assert.match(reportes, /^<section id="vista-reportes" role="tabpanel" aria-labelledby="pestana-reportes" hidden>\s*<div id="rp-reportes"><\/div>\s*<\/section>$/);
    assert.equal(cuantas(html, /id="rp-reportes"/g), 1);
    assert.doesNotMatch(html, /onclick|onchange/i);
    for (const viejo of ['Cumplimiento', 'Historial', 'periodo-select', 'historial-desde', 'area-select', 'avisos-desde', 'reportes-grid', 'reporte-card', 'btn-generar']) {
      assert.ok(!html.includes(viejo), viejo);
    }
    for (const viejo of ['generarReporteEstadoGeneral', 'generarReporteAvisos', 'generarReportePorArea', 'generarReporteHistorial', 'generarReporteCumplimiento',
      'descargarPDF', 'rutaDeAvisos']) {
      assert.equal(typeof ctx[viejo], 'undefined', viejo);
    }
    // El nombre de cada archivo lleva el día de hoy en Argentina: toISOString, después de las 21, decía mañana
    assert.doesNotMatch(leer('js/reportes.js'), /\.toISOString\(/);
    // Las piezas de las tarjetas, en el <style> de la página
    for (const clase of ['.rp-grilla', '.rp-tarjeta', '.rp-campos', '.rp-hojas', '.rp-no-disponible']) assert.ok(html.includes(`${clase} {`), clase);
  });

  it('sin Chart.js ni publico.css, y los tokens del Seguimiento en su <style>', () => {
    assert.doesNotMatch(html, /chart\.js|chart\.umd/i);
    assert.doesNotMatch(html, /publico\.css/);
    assert.match(html, /--sg-tinta: #1A365D;/);
    assert.match(html, /--sg-violeta: #5B4691;/);
  });

  // El modal de cada tramo (spec 2026-11-07-metricas-cajones-y-ciclos, 5): el de main.css, vacío (lo llena reportes.js), hijo de <body>
  // después de .app-container (que queda inerte mientras está abierto) y antes de los scripts
  it('el modal de cada tramo: después de .app-container y antes de los scripts, con su título como nombre', () => {
    assert.match(html, /<\/main>\s*<\/div>\s*(?:<!--(?:(?!-->)[\s\S])*-->\s*)?<div class="modal-overlay" id="mt-modal-tramo">\s*<div class="modal mt-modal" role="dialog" aria-modal="true" aria-labelledby="mt-modal-titulo" id="mt-modal-contenido"><\/div>\s*<\/div>\s*<!-- Scripts -->/);
    for (const id of ['mt-modal-tramo', 'mt-modal-contenido']) assert.equal(cuantas(html, new RegExp(`id="${id}"`, 'g')), 1, id);
    // El título lo pone reportes.js (htmlDelModal): el HTML no lo trae
    assert.doesNotMatch(html, /id="mt-modal-titulo"/);
  });

  describe('el CSS de la banda y del modal', () => {
    // Una regla del <style>, de su selector a su llave de cierre; un bloque @media entero
    const regla = (selector) => {
      const desde = html.indexOf(`${selector} {`);
      assert.notEqual(desde, -1, selector);
      return html.slice(desde, html.indexOf('}', desde));
    };
    const bloque = (inicio) => {
      const desde = html.indexOf(inicio);
      assert.notEqual(desde, -1, inicio);
      let abiertas = 0;
      for (let i = html.indexOf('{', desde); i < html.length; i++) {
        if (html[i] === '{') abiertas++;
        if (html[i] === '}' && --abiertas === 0) return html.slice(desde, i + 1);
      }
      return assert.fail(`${inicio}: sin cierre`);
    };
    // Un color: un #RRGGBB o un token --sg- de :root
    const hexDe = (valor) => {
      const token = /^var\((--[\w-]+)\)$/.exec(valor.trim());
      return token ? new RegExp(`${token[1]}: (#[0-9A-Fa-f]{6});`).exec(html)[1] : valor.trim();
    };
    // El contraste de dos colores #RRGGBB (WCAG 2.1)
    const luminancia = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contraste = (uno, otro) => {
      const [claro, oscuro] = [luminancia(uno), luminancia(otro)].sort((a, b) => b - a);
      return (claro + 0.05) / (oscuro + 0.05);
    };

    it('el botón de la banda tiene la letra y el lugar del nodo, y su foco se ve adentro de la flecha', () => {
      const boton = regla('button.mt-nodo');
      for (const declaracion of ['font: inherit;', 'text-align: left;', 'border: 0;', 'width: 100%;']) assert.ok(boton.includes(declaracion), declaracion);
      // Gana a la regla común del foco de la página (.mt-pagina button:focus-visible) por especificidad: el contorno de afuera no va
      assert.match(regla('.mt-pagina button.mt-nodo:focus-visible'), /outline: 3px solid #fff; outline-offset: -\d+px; box-shadow: none;/);
      // Desde 961 px el nodo entra 10 px en la muesca del siguiente (margin-right: -10px): el botón también (un <div> se estira solo)
      assert.match(bloque('@media (min-width: 961px) {'), /button\.mt-nodo \{ width: calc\(100% \+ 10px\); \}/);
      // «Ver los ciclos», subrayado y en blanco
      assert.match(regla('.mt-ver span'), /text-decoration: underline;/);
      assert.match(regla('.mt-ver'), /color: #fff;/);
    });

    it('con forced-colors, el botón conserva su borde', () => {
      const altoContraste = bloque('@media (forced-colors: active) {');
      assert.match(altoContraste, /button\.mt-nodo \{ border: 1px solid CanvasText; \}/);
      // En fila, con el margen de 8 px de los nodos en alto contraste
      assert.match(bloque('@media (forced-colors: active) and (min-width: 961px) {'), /button\.mt-nodo \{ width: calc\(100% - 8px\); \}/);
      // El gráfico y las marcas de la leyenda, con los colores del sistema: lo lleno sigue lleno y el aro, aro; los textos, con la misma
      // especificidad que sus reglas de color (van después)
      const delModal = /@media \(forced-colors: active\) \{\s*\.mt-grafico, \.mt-modal-leyenda svg \{ forced-color-adjust: none; \}[^@]*?\n {8}\}/.exec(html)?.[0] ?? '';
      assert.match(delModal, /\.mt-grafico \.eje-n, \.mt-grafico \.eje-r, \.mt-grafico \.linea-r, \.mt-grafico \.mas \{ fill: CanvasText; \}/);
      assert.match(delModal, /\.mt-grafico \.p-cuenta circle, \.mt-ley-cuenta circle \{ fill: CanvasText; stroke: Canvas; \}/);
      assert.match(delModal, /\.mt-grafico \.p-curso circle, \.mt-ley-curso circle \{ fill: Canvas; stroke: CanvasText; \}/);
      assert.ok(html.indexOf('.mt-grafico .eje-n, .mt-grafico .eje-r {') < html.indexOf(delModal));
    });

    it('el modal: de 900 px, la × con 4,5:1 sobre el blanco, el cuerpo se desplaza adentro y la página de atrás no se mueve', () => {
      assert.match(regla('.modal.mt-modal'), /max-width: 900px;/);
      const color = /(?:^|[ ;{])color: ([^;]+);/.exec(regla('.mt-modal .modal-close'))[1];
      assert.ok(contraste(hexDe(color), '#FFFFFF') >= 4.5, `${color}: ${contraste(hexDe(color), '#FFFFFF').toFixed(2)}:1`);
      const alPasar = /(?:^|[ ;{])color: ([^;]+);/.exec(regla('.mt-modal .modal-close:hover'))[1];
      assert.ok(contraste(hexDe(alPasar), hexDe(/background: ([^;]+);/.exec(regla('.mt-modal .modal-close:hover'))[1])) >= 4.5, alPasar);
      assert.match(regla('.mt-modal .modal-body'), /overscroll-behavior: contain;/);
      assert.match(regla('#mt-modal-tramo'), /overscroll-behavior: contain;/);
      // El foco visible de la carcasa: el modal va fuera de .mt-pagina
      assert.match(regla('.mt-modal :focus-visible'), /outline: 3px solid var\(--tinta\); outline-offset: 2px; box-shadow: 0 0 0 5px var\(--sol-fuerte\);/);
    });

    // El gráfico, desde 800 px de ancho: más angosto, su letra (12 en un ancho fijo de 760) baja de 9 px
    it('por debajo de 800 px, sin el gráfico; en el teléfono, la tabla se desplaza de costado en su marco', () => {
      const sinGrafico = bloque('@media (max-width: 799px) {');
      assert.match(sinGrafico, /\.mt-grafico \{ display: none; \}/);
      assert.doesNotMatch(html, /@media \(max-width: 599px\) \{[^@]*\.mt-grafico/);
      assert.equal(cuantas(html, /\.mt-grafico \{ display: none; \}/g), 1);
      assert.match(regla('.mt-modal-tabla'), /overflow-x: auto;/);
      assert.match(regla('.mt-modal-tabla table.mt-tabla'), /min-width: \d+px;/);
      assert.match(regla('.mt-modal-tabla td:last-child'), /white-space: nowrap;/);
    });

    it('con prefers-reduced-motion, el modal aparece sin achicarse ni agrandarse', () => {
      const quieto = bloque('@media (prefers-reduced-motion: reduce) {');
      assert.match(quieto, /\.mt-modal, \.modal-overlay\.active \.mt-modal \{ transform: none; transition: none; \}/);
    });

    it('los textos del modal y sus marcas: 4,5:1 o más sobre el blanco; las marcas y los puntos, 3:1', () => {
      for (const [selector, propiedad] of [['.mt-modal-quien', 'color'], ['.mt-modal-cifra .n small', 'color'], ['.mt-modal-cifra .u', 'color'],
        ['.mt-modal-cifra .o', 'color'], ['.mt-modal-tabla .mt-curso', 'color'], ['.mt-modal-tabla .mt-pend', 'color'], ['.mt-grafico .eje-n, .mt-grafico .eje-r', 'fill'],
        ['.mt-grafico .linea-r', 'fill'], ['.mt-grafico .mas', 'fill']]) {
        const valor = new RegExp(`(?:^|[ ;{])${propiedad}: ([^;]+);`).exec(regla(selector))[1];
        assert.ok(contraste(hexDe(valor), '#FFFFFF') >= 4.5, `${selector}: ${valor}`);
      }
      // Los colores de los tramos (el número de la cifra, los puntos y la marca de la leyenda) y el aro ámbar
      for (const token of ['--sg-tinta', '--sg-violeta', '--sg-del-area', '--sg-ambar']) assert.ok(contraste(hexDe(`var(${token})`), '#FFFFFF') >= 4.5, token);
      for (const color of ['tinta', 'violeta', 'area']) assert.ok(html.includes(`.mt-color-${color} { --mt-color: var(--sg-${color === 'area' ? 'del-area' : color}); }`), color);
      assert.match(regla('.mt-grafico .p-cuenta circle'), /fill: var\(--mt-color\); stroke: #fff; stroke-width: 2;/);
      assert.match(regla('.mt-grafico .p-curso circle'), /fill: #fff; stroke: var\(--sg-ambar\); stroke-width: 2;/);
      // La línea del eje: 3:1 sobre el blanco
      assert.ok(contraste(hexDe(/stroke: ([^;]+);/.exec(regla('.mt-grafico .eje'))[1]), '#FFFFFF') >= 3);
      // El gráfico usa la letra con que lo mide el servidor
      assert.match(regla('.mt-grafico text'), new RegExp(`font-size: ${GRAFICO.letra}px;`));
    });
  });
});

// El PDF de Métricas (services/reportesMetricasPdf.js) escribe los textos fijos de la pestaña: la página los tiene en su HTML y en
// reportes.js, y el PDF los toma de TEXTOS_DE_LA_PESTANA (y de unas funciones que arman lo mismo que la pestaña). Si cambia uno de la
// pestaña, este test falla: no se separan sin que nadie lo vea
describe('reportes.js y el PDF de Métricas: los mismos textos', () => {
  const html = leer('reportes.html');
  const fuente = leer('js/reportes.js');

  it('la bajada, el pie del circuito, los nombres de las secciones y lo de la doble verificación', () => {
    // La bajada de los días (spec 2026-11-07-metricas-cajones-y-ciclos, 4): la de la pestaña termina con la oración con que empieza
    // «Cómo se cuenta» del PDF
    assert.equal(T.bajada, 'Los días van corridos y, entre paréntesis, hábiles: de lunes a viernes, sin feriados ni días no laborables.');
    assert.ok(ctx.textoDeLaBajada().endsWith(` ${T.bajada}`));
    assert.ok(html.includes(`<p class="mt-bajada" id="mt-bajada">${ctx.textoDeLaBajada()}</p>`));
    // El pie del circuito sigue en el PDF de Métricas, pero ya no está en la página (spec 2026-11-08-metricas-recorrido-tipico)
    assert.equal(T.pieDelCircuito, 'Con «Mediana», el número grande es el del medio: en la mitad de los casos, ese número o menos. Con «Promedio», cada cifra lo dice debajo.');
    assert.ok(!html.includes(T.pieDelCircuito));
    for (const t of [T.pieDeLaAuditoria, T.titulos.manuales, T.titulos.auditoria, T.titulos.resultados, T.titulos.contexto,
      T.titulos.trabajo, T.titulos.areas]) {
      assert.ok(html.includes(t), t);
    }
    // Los selectores: los chips de la barra dicen «Mediana» y «Promedio»
    const barra = ctx.htmlDeBarra({ anios: [2026], anio: 2026 }, POR_DEFECTO);
    for (const t of Object.values(T.estadisticos)) assert.ok(barra.includes(`>${t}</button>`), t);
    // Las bajadas de los resultados y del trabajo: la pestaña las arma con « en 2026» en el medio
    assert.ok(fuente.includes('`Lo que dejó el circuito${anio}, con las dos gestiones juntas.`'));
    assert.equal(T.bajadaDeResultados(2026), 'Lo que dejó el circuito en 2026, con las dos gestiones juntas.');
    assert.ok(fuente.includes('`Lo que hizo el sistema y el equipo de Datos Públicos${anio}.`'));
    assert.equal(T.bajadaDelTrabajo(2026), 'Lo que hizo el sistema y el equipo de Datos Públicos en 2026.');
  });

  // «Se cuenta hasta que se registra la actualización.» ya no va: cada cajón dice su frase, que arma el servidor (spec
  // 2026-11-07-metricas-cajones-y-ciclos, 3), y los en curso van en el modal de la página y en «Cómo se cuenta» del PDF
  it('el circuito: los roles de los nodos y «con tan pocos casos, es orientativo»; sin «Se cuenta hasta…»', () => {
    const circuitos = ctx.htmlDeCircuito(VISTA, 'externa') + ctx.htmlDeCircuito(VISTA, 'interna');
    for (const rol of Object.values(T.roles)) assert.ok(circuitos.includes(`<span class="r">${rol}</span>`), rol);
    const flecha = ctx.htmlDeFlecha(tramo('produccion', 3, { ciclos: 2, en_curso: { n: 1, valor: 9, texto: '1 sin datos registrados todavía, hace 9 días hábiles (mediana)' } }));
    assert.ok(flecha.includes(`<span class="o">${T.orientativo}</span>`));
    assert.equal(T.seCuentaHasta, undefined);
    assert.doesNotMatch(fuente, /SE_CUENTA_HASTA|Se cuenta hasta/);
    assert.doesNotMatch(flecha, /Se cuenta hasta/);
  });

  it('el cajón del aviso: las dos puntas de la línea y el tramo real con su frase', () => {
    assert.ok(fuente.includes(`const ANTICIPACION_DESDE = '${T.anticipacion.desde}';`));
    assert.ok(fuente.includes(`const ANTICIPACION_HASTA = '${T.anticipacion.hasta}';`));
    for (const dias of ['habiles', 'corridos']) {
      for (const estadistico of ['mediana', 'promedio']) {
        for (const g of ['externa', 'interna']) {
          const real = tramoDe(vistaReal({ dias, estadistico }), g, 'aviso');
          assert.ok(real.anticipacion_texto.endsWith(' de anticipación'), `${dias} ${estadistico} ${g}`);
          const html = ctx.htmlDeFlecha(real);
          assert.ok(html.includes(`<span class="n">${real.cifra.texto}</span><span class="mt-anticipa-frase">${real.anticipacion_texto}</span>`), `${dias} ${estadistico} ${g}`);
          assert.ok(html.includes(`<div class="mt-anticipa-pie"><span>${T.anticipacion.desde}</span><span>${T.anticipacion.hasta}</span></div>`), `${dias} ${estadistico} ${g}`);
          assert.ok(html.includes(`<span class="u">${real.cifra.debajo}</span>`), `${dias} ${estadistico} ${g}`);
        }
      }
    }
  });

  it('los resultados: lo de estar a tiempo, el desglose, lo que falta, las reiteraciones y sus títulos', () => {
    const a = { a_tiempo: 5, total: 33, externa: [4, 27], interna: [1, 6], despues: { valor: 61, texto: '' } };
    const aTiempo = ctx.htmlDeATiempo(a, { de: 'de 33 ciclos', medidor: 15, vacio: '' });
    assert.ok(aTiempo.includes(`<p class="mt-texto">${T.aTiempo}</p>`));
    assert.ok(aTiempo.includes(`<p class="mt-texto s">${textoDelDesglose(a)}</p>`), textoDelDesglose(a));
    assert.ok(aTiempo.includes(`>${T.titulos.aTiempo}</h3>`));
    const falta = { titulo: 'Listado de Proveedores', venc: '2026-01-31', motivo: 'sin el aviso de la regla' };
    const cobertura = ctx.htmlDeCobertura({ si: 34, total: 35, faltan: [falta] }, { de: 'de 35 vencimientos', medidor: 97, regla: 'x', faltan: 'El que falta:', vacio: '' });
    assert.ok(cobertura.includes(`<li>${textoDeLoQueFalta(falta)}</li>`), textoDeLoQueFalta(falta));
    assert.ok(cobertura.includes(`>${T.titulos.cobertura}</h3>`));
    const reiteraciones = ctx.htmlDeReiteraciones({ rpad: { ninguna: 1, una: 2, dos_o_mas: 3, total: 6 }, dgmit: { ninguna: 1, una_o_mas: 2, total: 3 } },
      { rpad: 'Del RPAD a la DGMIT (6 ciclos)', rpad_vacio: '', dgmit: 'De la DGMIT al área (3 ciclos)', dgmit_vacio: '', aclaracion: null });
    for (const [, nombre] of [...T.gruposDelRpad, ...T.gruposDeLaDgmit]) assert.ok(reiteraciones.includes(`<span>${nombre}</span>`), nombre);
    assert.ok(reiteraciones.includes(T.pieDeLasReiteraciones));
    assert.ok(reiteraciones.includes(`>${T.titulos.reiteraciones}</h3>`));
  });

  it('el contexto: el pie del índice, los grupos de la antigüedad y su pie', () => {
    const contexto = ctx.htmlDeContexto(CONTEXTO);
    assert.ok(contexto.includes(T.pieDelIndice));
    assert.ok(contexto.includes(`>${T.titulos.indice}</h3>`));
    const antiguedad = ctx.htmlDeAntiguedad(ANTIGUEDAD);
    for (const grupo of T.antiguedad) assert.ok(antiguedad.includes(`<span>${grupo}</span>`), grupo);
    assert.ok(antiguedad.includes(T.pieDeLaAntiguedad));
    assert.ok(antiguedad.includes(`>${T.titulos.antiguedad}</h3>`));
  });

  it('el trabajo: las series por mes y las métricas manuales (sus tipos, el mes y lo que dice sin ninguna)', () => {
    const trabajo = ctx.htmlDeTrabajo(TRABAJO);
    for (const [, nombre] of T.series) assert.ok(trabajo.includes(`>${nombre}</button>`), nombre);
    assert.ok(trabajo.includes(`>${T.titulos.porMes}</h3>`));
    const lista = Object.keys(T.tiposManuales).map((tipo, i) => ({ id: i + 1, tipo, anio: 2026, mes: i + 3, cantidad: i }));
    const manuales = ctx.htmlDeMetricasManuales(lista, { anio: 2026 });
    for (const m of lista) {
      assert.ok(manuales.includes(`<span class="t">${T.tiposManuales[m.tipo]}</span><span class="p">${textoDelMesManual(m.mes, m.anio)}</span>`), m.tipo);
    }
    assert.equal(ctx.htmlDeMetricasManuales([], { anio: 2026 }), `<p class="mt-vacio-caja">${textoSinManuales(2026)}</p>`);
  });

  it('las áreas, los casos y de dónde sale un año cerrado', () => {
    assert.ok(ctx.htmlDelRanking([]).includes(T.sinAreas));
    const areas = ctx.htmlDeAreas(AREAS);
    assert.ok(areas.includes(`<span>${T.alDia}</span>`));
    assert.ok(areas.includes(`>${T.titulos.ranking}</h3>`));
    const cerrado = { anio: 2026, anios: [2026, 2027], al: '2026-12-31', en_vivo: false, aviso_foto: null };
    assert.ok(ctx.htmlDeBarra(cerrado, { ...POR_DEFECTO, anio: 2026 }).includes(`>${textoDeDondeSale(cerrado)}</p>`), textoDeDondeSale(cerrado));
    const sinFoto = { ...cerrado, en_vivo: true, aviso_foto: 'La foto de 2026 se saca el 10/01/2027' };
    assert.ok(ctx.htmlDeBarra(sinFoto, POR_DEFECTO).includes(`>${textoDeDondeSale(sinFoto)}</p>`));
  });
});

// El PDF «Datos para completar» (services/reportesParaCompletarPdf.js) imprime lo mismo que «Para completar» de la pestaña: la bajada de
// la sección (en public/reportes.html), su pie y, en cada tarea, lo de debajo del dataset y qué pasó (htmlDeParaCompletar). Los arma
// con TEXTOS_DE_PARA_COMPLETAR y unas funciones que hacen lo mismo que la pestaña: si cambia uno allá, este test falla
describe('reportes.js y el PDF de Datos para completar: los mismos textos', () => {
  const tarea = (titulo, debajo, que) =>
    `<span class="d"><b>${ctx.escaparTexto(titulo)}</b><small>${ctx.escaparTexto(debajo)}</small></span><span class="q">${ctx.escaparTexto(que)}</span>`;

  it('la bajada de la sección y el pie', () => {
    assert.ok(leer('reportes.html').includes(`<p class="mt-seccion-bajada">${TEXTOS_DE_PARA_COMPLETAR.bajada}</p>`));
    assert.ok(ctx.htmlDeParaCompletar(VISTA, false).includes(`<p class="mt-pie">${TEXTOS_DE_PARA_COMPLETAR.pie}</p>`));
  });

  it('cada tarea: el área y cómo está el ciclo, el aviso del RPAD, la gestión y qué falta y la carga', () => {
    const { notas, recibido } = VISTA.para_completar;
    assert.ok(notas.length > 0 && recibido.length > 0);
    // También sin qué fue el aviso, sin aviso, sin situación, sin gestión, sin qué falta y sin carga
    const [nota] = notas;
    const [actualizacion] = recibido;
    const raras = { para_completar: {
      ...VISTA.para_completar,
      notas: [...notas, { ...nota, que: '' }, { ...nota, aviso: null }, { ...nota, situacion: null }, { ...nota, area: '' }],
      recibido: [...recibido, { ...actualizacion, gestion: null }, { ...actualizacion, falta_texto: '' }, { ...actualizacion, carga: null }]
    } };
    for (const puedeCargar of [false, true]) {
      const html = ctx.htmlDeParaCompletar(raras, puedeCargar);
      for (const n of raras.para_completar.notas) {
        assert.ok(html.includes(tarea(n.titulo, debajoDeLaNota(n), queDeLaNota(n))), `${n.titulo}: ${debajoDeLaNota(n)} / ${queDeLaNota(n)}`);
      }
      for (const r of raras.para_completar.recibido) {
        assert.ok(html.includes(tarea(r.titulo, debajoDelRecibido(r), queDelRecibido(r))), `${r.titulo}: ${debajoDelRecibido(r)} / ${queDelRecibido(r)}`);
      }
    }
  });
});
