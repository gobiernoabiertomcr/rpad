// La pestaña Métricas de «Métricas y Reportes» (spec 2026-10-24-metricas-y-reportes, 1.4 a 1.7, 2.1 a 2.3 y 6), ejecutada en Node:
// lo puro de public/js/reportes.js (el estado de la URL, la barra, la franja de lo destildado, el circuito, la cinta y los casos) con
// lo que arma el servidor (services/metricasReglas.js y metricasCinta.js sobre los casos reales de tests/metricas-casos.js) y con
// tramos y cintas armados a mano. Como seguimiento.js, el script al cargarse solo declara: se carga en un vm con un document que no
// hace nada, junto con el api.js de verdad (Utils). La página no recalcula nada: dibuja lo que manda el servidor. También la pestaña
// Reportes (spec 5): las siete tarjetas, lo que pide cada una y, con un document de mentira, la descarga con API.pedirArchivo.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import {
  casosDe, vistaDe, unidadDe, SIN_NOTAS_DGMIT, contextoDelAnio, trabajoDelAnio, areasYTemas, sinLosDestildados, textoDeLaFranja,
  ESTADISTICOS as ESTADISTICOS_DEL_SERVIDOR, DIAS as DIAS_DEL_SERVIDOR, GESTIONES as GESTIONES_DEL_SERVIDOR
} from '../services/metricasReglas.js';
import { cintaDeMetricas, cintasDeLaVista } from '../services/metricasCinta.js';
import { mapaDeLosCasos, mapaDe, fuentesDelCaso, con, notaDgmit, HOY_DE_LAS_METRICAS as HOY } from './metricas-casos.js';
import {
  TEXTOS_DE_LA_PESTANA as T, textoDelDesglose, textoDeLoQueFalta, textoDeDondeSale, textoDelMesManual, textoSinManuales,
  textoDelPieDeLosCasos, textoDeLaPildora
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

// La vista y las cintas de los casos reales al 24/10/2026, como las manda GET /api/metricas, y el resto de la pestaña (el contexto, el
// trabajo del RPAD y las áreas)
const MAPA = mapaDeLosCasos();
const CASOS = casosDe(MAPA, { hoy: HOY });
const vistaReal = (opciones = {}) => vistaDe(CASOS, { anio: 2026, al: HOY, ...opciones });
const VISTA = vistaReal();
const DEL_ANIO = { anio: 2026, al: HOY };
const CONTEXTO = contextoDelAnio(MAPA, DEL_ANIO);
const INDICE = CONTEXTO.indice;
const ANTIGUEDAD = CONTEXTO.antiguedad;
const TRABAJO = trabajoDelAnio(MAPA, CASOS, { ...DEL_ANIO, estadistico: 'mediana' });
const AREAS = areasYTemas(MAPA, DEL_ANIO);
const tramoDe = (vista, gestion, clave) => vista.circuito[gestion].find((t) => t.clave === clave);

const POR_DEFECTO = { anio: null, estadistico: 'mediana', dias: 'habiles', gestion: 'externa', sin: [], pestana: 'metricas' };

// Los tramos de vistaDe armados a mano (como en tests/metricas-cinta.test.js): el nombre, el texto de la flecha, quién está a cargo
// y si es de la DGMIT
const DE_LA_CLAVE = {
  aviso: { nombre: 'Aviso anticipado', desde_hasta: 'Del aviso al vencimiento', responsable: 'DDPC', dgmit: false },
  tramite: { nombre: 'Trámite y entrega de la nota', desde_hasta: 'Del aviso a la nota en el área', responsable: 'DGMIT y DA', dgmit: true },
  respuesta: { nombre: 'Respuesta del área', desde_hasta: 'De la nota a la entrega', responsable: 'Área', dgmit: false },
  produccion: { nombre: 'Producción del relevamiento', desde_hasta: 'Del aviso a la entrega', responsable: 'DGMIT y DIT', dgmit: true },
  carga: { nombre: 'Preparación y carga', desde_hasta: 'De la entrega a la carga', responsable: 'DDPC', dgmit: false }
};
const tramo = (clave, valor, { dias = 'habiles', estadistico = 'mediana', ciclos = 12, vacio = null, en_curso = null, pendientes, pendientes_texto = null } = {}) => ({
  clave, ...DE_LA_CLAVE[clave],
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

// Una cinta con la cadena completa: la interna con la producción y la entrega y la carga juntas (0 días), y la externa con todos sus
// tramos (con notas DGMIT cargadas)
const CINTA_INTERNA = cintaDeMetricas([tramo('aviso', 41), tramo('produccion', 45), tramo('carga', 0)], { gestion: 'interna' });
const CINTA_EXTERNA = cintaDeMetricas([tramo('aviso', 27), tramo('tramite', 12), tramo('respuesta', 20), tramo('carga', 3)], { gestion: 'externa' });

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
    const todo = '?anio=2026&estadistico=promedio&dias=corridos&gestion=interna&sin=12,45#reportes';
    const estado = { anio: 2026, estadistico: 'promedio', dias: 'corridos', gestion: 'interna', sin: [12, 45], pestana: 'reportes' };
    assert.deepEqual(plano(ctx.estadoDeLaUrl(todo)), estado);
    // Sin el «?» también, y un parámetro repetido suma sus destildados
    assert.deepEqual(plano(ctx.estadoDeLaUrl('sin=3&sin=4,3#metricas')), { ...POR_DEFECTO, sin: [3, 4] });
    assert.equal(ctx.estadoDeLaUrl('#reportes').pestana, 'reportes');

    // urlDeEstado: lo que está en su valor por defecto no se escribe (tampoco la pestaña Métricas); el resto, en este orden
    assert.equal(ctx.urlDeEstado(POR_DEFECTO), '');
    assert.equal(ctx.urlDeEstado({ ...POR_DEFECTO, dias: 'corridos' }), '?dias=corridos');
    assert.equal(ctx.urlDeEstado({ ...POR_DEFECTO, pestana: 'reportes' }), '#reportes');
    assert.equal(ctx.urlDeEstado({ ...POR_DEFECTO, sin: [11] }), '?sin=11');
    assert.equal(ctx.urlDeEstado(estado), todo);
    assert.deepEqual(plano(ctx.estadoDeLaUrl(ctx.urlDeEstado(estado))), estado, 'ida y vuelta');
    // Un estado raro no se escribe tal cual: lo que no sirve no va
    assert.equal(ctx.urlDeEstado({ anio: 'x', estadistico: '<b>', dias: null, gestion: 'z', sin: ['a', -1, 7], pestana: 'otra' }), '?sin=7');
    assert.equal(ctx.urlDeEstado(undefined), '');
  });

  // Copias de los selectores del servidor (ESTADISTICOS, DIAS y GESTIONES de services/metricasReglas.js) y de sus valores de entrada
  // (los de opcionesDeMetricas, services/metricasOpciones.js: el primero de cada lista, ningún destildado). Si cambia uno, falla
  it('ESTADISTICOS, DIAS, GESTIONES y los de entrada de ESTADO_POR_DEFECTO son los del servidor', () => {
    const valores = (nombre) => plano(vm.runInContext(nombre, ctx)).map(([valor]) => valor);
    assert.deepEqual(valores('ESTADISTICOS'), [...ESTADISTICOS_DEL_SERVIDOR]);
    assert.deepEqual(valores('DIAS'), [...DIAS_DEL_SERVIDOR]);
    assert.deepEqual(valores('GESTIONES'), [...GESTIONES_DEL_SERVIDOR]);
    const porDefecto = plano(vm.runInContext('ESTADO_POR_DEFECTO', ctx));
    const delServidor = opcionesDeMetricas({}, { hoy: HOY, aniosConFoto: [] });
    assert.deepEqual(
      { estadistico: porDefecto.estadistico, dias: porDefecto.dias, gestion: porDefecto.gestion, sin: porDefecto.sin },
      { estadistico: delServidor.estadistico, dias: delServidor.dias, gestion: delServidor.gestion, sin: delServidor.sin }
    );
    // El año de entrada es el que dice el servidor (null en la página: no se manda y el servidor usa el de hoy)
    assert.equal(porDefecto.anio, null);
    assert.equal(delServidor.anio, Number(HOY.slice(0, 4)));
    // Y lo que la página entiende como de entrada es eso: sin parámetros, ESTADO_POR_DEFECTO
    assert.deepEqual(plano(ctx.estadoDeLaUrl('')), porDefecto);
  });

  it('la consulta de la API lleva el año, los selectores y los destildados, pero no la gestión ni la pestaña', () => {
    assert.equal(ctx.consultaDeLaApi(POR_DEFECTO), '');
    assert.equal(ctx.consultaDeLaApi({ anio: 2026, estadistico: 'promedio', dias: 'corridos', gestion: 'interna', sin: [12, 45], pestana: 'reportes' }),
      'anio=2026&estadistico=promedio&dias=corridos&sin=12,45');
  });

  it('cambiar un selector: lo que no sirve no cambia nada, y el año en curso vuelve a ser el de entrada', () => {
    const anios = [2026, 2027];
    assert.deepEqual(plano(ctx.conSelector(POR_DEFECTO, 'estadistico', 'promedio', anios)), { ...POR_DEFECTO, estadistico: 'promedio' });
    assert.deepEqual(plano(ctx.conSelector(POR_DEFECTO, 'dias', 'corridos', anios)), { ...POR_DEFECTO, dias: 'corridos' });
    assert.deepEqual(plano(ctx.conSelector(POR_DEFECTO, 'gestion', 'interna', anios)), { ...POR_DEFECTO, gestion: 'interna' });
    assert.deepEqual(plano(ctx.conSelector(POR_DEFECTO, 'anio', '2026', anios)), { ...POR_DEFECTO, anio: 2026 });
    assert.deepEqual(plano(ctx.conSelector({ ...POR_DEFECTO, anio: 2026 }, 'anio', '2027', anios)), POR_DEFECTO, 'el último es el en curso');
    for (const [clave, valor] of [['estadistico', 'foo'], ['dias', ''], ['gestion', null], ['anio', '1999'], ['anio', 'abc'], ['otra', 'x']]) {
      assert.deepEqual(plano(ctx.conSelector(POR_DEFECTO, clave, valor, anios)), POR_DEFECTO, `${clave}=${valor}`);
    }
  });

  it('destildar un dataset lo suma al final; volver a tildarlo lo saca', () => {
    assert.deepEqual(plano(ctx.conDestildado([], 11)), [11]);
    assert.deepEqual(plano(ctx.conDestildado([12], '11')), [12, 11]);
    assert.deepEqual(plano(ctx.conDestildado([12, 11], 11)), [12]);
    assert.deepEqual(plano(ctx.conDestildado([12], 'x')), [12], 'un id que no es un id no cambia nada');
  });

  it('la bajada dice cómo se cuentan los días', () => {
    const base = 'Cuánto tarda cada paso del circuito, desde el aviso del RPAD hasta la carga en el portal, y los reportes en PDF.';
    assert.equal(ctx.textoDeLaBajada('habiles'), `${base} Los días son hábiles: de lunes a viernes, sin los feriados nacionales fijos.`);
    assert.equal(ctx.textoDeLaBajada('corridos'), `${base} Los días son corridos: todos los días del calendario.`);
  });
});

describe('reportes.js: la barra y la franja de lo destildado', () => {
  const DATOS = { anio: 2026, al: HOY, en_vivo: true, aviso_foto: null, anios: [2026], vista: VISTA, sin_titulos: [] };

  it('htmlDeBarra: el año, los selectores con aria-pressed, «Casos: todos» y «Descargar PDF»', () => {
    const html = ctx.htmlDeBarra(DATOS, POR_DEFECTO);
    assert.match(html, /<select[^>]*id="mt-anio"[^>]*>/);
    assert.match(html, /<option value="2026" selected>2026 \(en curso\)<\/option>/);
    for (const [selector, valor, texto, pulsado] of [['estadistico', 'mediana', 'Mediana', true], ['estadistico', 'promedio', 'Promedio', false],
      ['dias', 'habiles', 'Días hábiles', true], ['dias', 'corridos', 'Días corridos', false]]) {
      assert.match(html, new RegExp(`<button type="button" class="mt-chip" data-selector="${selector}" data-valor="${valor}" aria-pressed="${pulsado}">${texto}</button>`));
    }
    assert.match(html, /Casos: <b>todos<\/b>/);
    assert.match(html, /data-accion="pdf"[^>]*>[\s\S]*Descargar PDF<\/button>/);
    assert.doesNotMatch(html, /mt-aviso-foto/);

    const otra = ctx.htmlDeBarra({ ...DATOS, sin_titulos: ['Parque Automotor (Patentamiento)'] }, { ...POR_DEFECTO, estadistico: 'promedio', dias: 'corridos', sin: [11] });
    assert.match(otra, /data-valor="promedio" aria-pressed="true"/);
    assert.match(otra, /data-valor="corridos" aria-pressed="true"/);
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
    const html = ctx.htmlDeFranjaSin({ sin_texto: textoDeLaFranja(['Parque Automotor']) }, { ...POR_DEFECTO, dias: 'corridos', sin: [11] });
    assert.match(html, /<span>Calculado sin 1 dataset: Parque Automotor\.<\/span>/);
    // El link conserva todo lo demás y saca los destildados
    assert.match(html, /<a href="reportes\.html\?dias=corridos" class="mt-franja-link" data-accion="todos">Volver a todos<\/a>/);
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
      pagina.estado = { ...pagina.estado, dias: 'corridos', sin: [5] };`, pagina);
    pagina.volverATodos();
    assert.deepEqual(enfocados, ['[data-accion="casos"]']);
    assert.deepEqual(plano(vm.runInContext('pagina.estado.sin', pagina)), []);
    assert.deepEqual(urls, ['/reportes.html?dias=corridos']);
    assert.deepEqual(pedidos, ['/metricas?dias=corridos']);
    // Al redibujar la barra, el foco vuelve al mismo chip
    assert.equal(cargar({ document: { addEventListener() {}, getElementById: () => null, activeElement: chip } })
      .claveDelFoco({ contains: () => true }), '[data-accion="casos"]');
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

    // Con la cifra real: «27 días hábiles» y «mediana de 11 ciclos» (los casos de las pruebas)
    const real = tramoDe(VISTA, 'externa', 'aviso');
    assert.match(ctx.htmlDeFlecha(real), new RegExp(`<span class="n">${real.cifra.texto} <small>${real.cifra.unidad}</small></span><span class="u">${real.cifra.debajo}</span>`));
    // El singular y los días corridos los manda el servidor tal cual
    assert.match(ctx.htmlDeFlecha(tramo('aviso', 1, { dias: 'corridos', estadistico: 'promedio', ciclos: 5 })), /1 <small>día corrido<\/small><\/span><span class="u">promedio de 5 ciclos/);
    assert.match(ctx.htmlDeFlecha(tramo('aviso', 40, { ciclos: 3 })), /<span class="o">con tan pocos casos, es orientativo<\/span>/);
  });

  it('los en curso, con su texto y la aclaración, y la DGMIT en violeta', () => {
    const real = tramoDe(VISTA, 'interna', 'produccion');
    const html = ctx.htmlDeFlecha(real);
    assert.match(html, /^<div class="mt-flecha dgmit vacia">/);
    assert.match(html, /<span class="n">Sin casos en 2026<\/span>/);
    assert.ok(html.includes(`<span class="c curso">${real.en_curso.texto}</span>`), real.en_curso.texto);
    assert.match(real.en_curso.texto, /^1 sin datos registrados todavía, hace 206 días hábiles \(mediana\)$/);
    assert.match(html, /<span class="c">Se cuenta hasta que se registra la actualización\.<\/span>/);
    assert.match(html, /<span class="mt-resp">DGMIT y DIT<\/span>/);
    const conCifra = ctx.htmlDeFlecha(tramo('produccion', 45, { en_curso: { n: 3, valor: 206, texto: '3 sin datos registrados todavía, hace 206 días hábiles (mediana)' } }));
    assert.match(conCifra, /^<div class="mt-flecha dgmit">/);
    assert.match(conCifra, /45 <small>días hábiles<\/small>/);
    assert.match(conCifra, /3 sin datos registrados todavía, hace 206 días hábiles \(mediana\)/);
  });

  it('el tramo vacío de la DGMIT dice «Todavía no hay notas DGMIT cargadas» y los pendientes', () => {
    const tramite = tramoDe(VISTA, 'externa', 'tramite');
    assert.equal(tramite.vacio.titulo, SIN_NOTAS_DGMIT);
    const html = ctx.htmlDeFlecha(tramite);
    assert.match(html, /^<div class="mt-flecha dgmit vacia">/);
    assert.match(html, /<span class="n">Todavía no hay notas DGMIT cargadas<\/span>/);
    assert.ok(html.includes(`<span class="c pend">${tramite.vacio.texto}</span>`));
    assert.match(tramite.vacio.texto, /^\d+ notas pendientes de carga$/);
    assert.equal(cuantas(html, /pendientes? de carga/g), 1, 'los pendientes no se repiten');
    assert.doesNotMatch(html, /<span class="u">/, 'sin cifra no hay estadístico');
    // El del área, mientras tanto
    const area = ctx.htmlDeFlecha(tramoDe(VISTA, 'externa', 'respuesta'));
    assert.match(area, /<span class="n">Sin datos todavía<\/span>/);
    assert.match(area, /Se empieza a contar cuando haya notas DGMIT cargadas/);
    // Con notas cargadas, la cifra y los pendientes, con el texto del servidor (el 52 con una nota DGMIT del 05/01/2026: su ciclo
    // abierto sigue pendiente de carga)
    const conNota = con(fuentesDelCaso(52, { importados: { 7: { recibido_el: '2026-02-02', origen_datos: 'area' } } }), {
      notasDgmit: [notaDgmit({ recibida: '2026-01-05' })]
    });
    const conNotas = tramoDe(vistaDe(casosDe(mapaDe(conNota), { hoy: HOY }), { anio: 2026, al: HOY }), 'externa', 'tramite');
    assert.equal(conNotas.pendientes_texto, '1 nota pendiente de carga');
    assert.match(ctx.htmlDeFlecha(conNotas), /8 <small>días hábiles<\/small>[\s\S]*<span class="c pend">1 nota pendiente de carga<\/span>/);
    // La página escribe lo que manda el servidor, sin mirar la cantidad; sin texto, nada
    assert.match(ctx.htmlDeFlecha(tramo('tramite', 12, { pendientes: 3, pendientes_texto: 'Texto del servidor' })), /<span class="c pend">Texto del servidor<\/span>/);
    assert.doesNotMatch(ctx.htmlDeFlecha(tramo('tramite', 12, { pendientes: 3 })), /pendiente/);
  });

  it('htmlDeCircuito: los nodos de cada gestión, en orden, con las flechas entre ellos', () => {
    const nodos = (html) => [...html.matchAll(/<div class="mt-nodo[^"]*"><span class="q">([^<]+)<\/span><span class="r">([^<]+)<\/span><\/div>/g)].map((m) => `${m[1]} / ${m[2]}`);
    const externa = ctx.htmlDeCircuito(VISTA, 'externa');
    assert.deepEqual(nodos(externa), ['RPAD / Datos Públicos avisa', 'DGMIT y Dirección Administrativa / Mandan la nota formal',
      'Área responsable / Prepara los datos', 'Datos Públicos / Limpia y estructura', 'Portal / Datos publicados']);
    assert.equal(cuantas(externa, /<div class="mt-flecha/g), 4);
    assert.match(externa, /^<div class="mt-tramos externa" role="group" aria-label="El circuito de la gestión externa">/);
    assert.match(externa, /<div class="mt-nodo dgmit"><span class="q">DGMIT y Dirección Administrativa/);
    assert.match(externa, /<div class="mt-nodo fin"><span class="q">Portal/);
    // Cada flecha entre sus dos nodos: el aviso anticipado va del RPAD a la DGMIT
    assert.ok(externa.indexOf('Datos Públicos avisa') < externa.indexOf('Aviso anticipado') && externa.indexOf('Aviso anticipado') < externa.indexOf('Mandan la nota formal'));
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
    assert.doesNotMatch(sinTramite, /Trámite y entrega de la nota/);
    assert.equal(ctx.htmlDeCircuito(null, 'externa'), '');
    assert.equal(ctx.htmlDeCircuito({}, 'externa'), '');
  });

  it('htmlDeAclaraciones: las del servidor, de la gestión elegida, y la de «Requiere nota DGMIT: No» en la externa', () => {
    const externa = ctx.htmlDeAclaraciones(VISTA, 'externa');
    assert.ok(externa.includes(VISTA.circuito.aclaraciones.externa.ya_vencidos.texto));
    // La de «Requiere nota DGMIT: No» también la arma el servidor (el 81 con «No» y sin nota DGMIT); sin ciclos así, no va
    const sinNota = vistaDe(casosDe(mapaDe(fuentesDelCaso(81, { dataset: { requiere_nota: 0 } })), { hoy: HOY }), { anio: 2026, al: HOY });
    const noRequieren = sinNota.circuito.aclaraciones.externa.no_requieren_nota;
    assert.match(noRequieren.texto, /^1 ciclo es de un dataset que no requiere nota DGMIT: cuenta solo en el aviso anticipado y en la carga\.$/);
    assert.ok(ctx.htmlDeAclaraciones(sinNota, 'externa').includes(`<p>${noRequieren.texto}</p>`));
    assert.equal(VISTA.circuito.aclaraciones.externa.no_requieren_nota.n, 0);
    assert.doesNotMatch(externa, /requiere/);
    const fuente = { ...VISTA, circuito: { ...VISTA.circuito, aclaraciones: { ...VISTA.circuito.aclaraciones,
      externa: { ya_vencidos: { n: 0, texto: '' }, fuente_publica: { n: 2, texto: '2 ciclos se resolvieron con datos de una fuente pública: no cuentan en la respuesta del área.' },
        no_requieren_nota: { n: 0, texto: '' } } } } };
    const conFuente = ctx.htmlDeAclaraciones(fuente, 'externa');
    assert.match(conFuente, /2 ciclos se resolvieron con datos de una fuente pública: no cuentan en la respuesta del área\./);
    assert.doesNotMatch(conFuente, /ya estaban vencidos/);
    const interna = ctx.htmlDeAclaraciones(VISTA, 'interna');
    assert.ok(interna.includes(VISTA.circuito.aclaraciones.interna.ya_vencidos.texto));
    assert.doesNotMatch(interna, /requiere/);
    // Sin ninguna aclaración, no hay recuadro
    const sinNada = { circuito: { aclaraciones: { interna: { ya_vencidos: { n: 0, texto: '' } } } } };
    assert.equal(ctx.htmlDeAclaraciones(sinNada, 'interna'), '');
    assert.equal(ctx.htmlDeAclaraciones({ circuito: { aclaraciones: { externa: { ya_vencidos: { n: 0, texto: '' }, fuente_publica: { n: 0, texto: '' },
      no_requieren_nota: { n: 0, texto: '' } } } } }, 'externa'), '');
  });
});

describe('reportes.js: la cinta', () => {
  it('svgDeCinta dibuja lo que manda el servidor (x, rótulos y anclajes)', () => {
    for (const [cinta, gestion] of [[CINTA_INTERNA, 'interna'], [CINTA_EXTERNA, 'externa']]) {
      const svg = ctx.svgDeCinta(cinta, gestion);
      const A = cinta.alturas;
      assert.match(svg, new RegExp(`^<svg class="mt-cinta-svg" viewBox="0 0 ${cinta.ancho} ${cinta.alto}" role="img" aria-label="Recorrido típico de un pedido de la gestión ${gestion}[^"]*"`));
      for (const tick of cinta.ticks) {
        assert.ok(svg.includes(`<text x="${coord(tick.x)}" y="${A.ticks}" class="tick">${tick.texto}</text>`), `tick ${tick.texto}`);
      }
      assert.ok(svg.includes(`<rect x="${coord(cinta.banda.x0)}" y="${A.banda.y}" width="${coord(cinta.banda.x1 - cinta.banda.x0)}" height="${A.banda.alto}" class="banda"/>`), 'banda');
      const v = coord(cinta.vencimiento.x);
      assert.ok(svg.includes(`<line x1="${v}" y1="${A.vencimiento.desde}" x2="${v}" y2="${A.vencimiento.hasta}" class="l-vence"/>`));
      assert.ok(svg.includes(`<text x="${v}" y="${A.vencimiento.texto}" class="vence">vencimiento</text>`));
      for (const s of cinta.segmentos) {
        assert.ok(svg.includes(`<rect x="${coord(s.x0)}" y="${A.segmentos.y}" width="${coord(s.x1 - s.x0)}" height="${A.segmentos.alto}" rx="4" class="s-${s.color}"><title>${s.texto}</title></rect>`), s.texto);
      }
      for (const r of cinta.rotulos) {
        assert.ok(svg.includes(`<text x="${coord(r.x)}" y="${r.y}" text-anchor="${r.anclaje}" class="rotulo r-${r.color}">${r.texto}</text>`), r.texto);
      }
      assert.ok(svg.includes(`<text x="${coord(cinta.eje.x)}" y="${cinta.eje.y}" text-anchor="${cinta.eje.anclaje}" class="eje">${cinta.eje.texto}</text>`));
      assert.equal(cuantas(svg, /<g class="marca m-/g), cinta.marcas.length);
      for (const m of cinta.marcas) assert.ok(svg.includes(`<g class="marca m-${m.tipo}" data-x="${coord(m.x)}">`), m.tipo);
    }
    // La interna: la entrega y la carga juntas, con su rótulo; la producción en violeta
    assert.deepEqual(CINTA_INTERNA.marcas.map((m) => m.tipo), ['aviso', 'datos-y-carga']);
    const interna = ctx.svgDeCinta(CINTA_INTERNA, 'interna');
    assert.match(interna, /Entrega y carga, el mismo día<\/text>/);
    assert.match(interna, /class="s-violeta"><title>Producción del relevamiento · 45 días hábiles<\/title>/);
    // El rayado: del vencimiento a la carga
    const r = CINTA_INTERNA.rayado;
    assert.ok(interna.includes(`<rect x="${coord(r.x0)}" y="${CINTA_INTERNA.alturas.banda.y}" width="${coord(r.x1 - r.x0)}" height="${CINTA_INTERNA.alturas.banda.alto}" class="rayado"/>`));
    assert.equal(ctx.svgDeCinta(null), '');
    assert.equal(ctx.svgDeCinta({}), '');
  });

  it('la cadena cortada: el gris con su texto, y sin rayado ni segmentos', () => {
    const cinta = cintasDeLaVista(VISTA, {}).externa;
    assert.ok(cinta.gris && cinta.gris.texto);
    const svg = ctx.svgDeCinta(cinta, 'externa');
    const A = cinta.alturas;
    assert.ok(svg.includes(`<rect x="${coord(cinta.gris.x0)}" y="${A.banda.y}" width="${coord(cinta.gris.x1 - cinta.gris.x0)}" height="${A.banda.alto}" class="gris"/>`));
    assert.ok(svg.includes(`<text x="${coord((cinta.gris.x0 + cinta.gris.x1) / 2)}" y="${A.textoDelGris}" class="t-gris">La cinta se completa cuando haya notas DGMIT cargadas</text>`));
    assert.doesNotMatch(svg, /class="rayado"|class="s-/);
    // Un gris sin lugar para su texto no lleva texto
    assert.doesNotMatch(ctx.svgDeCinta({ ...cinta, gris: { ...cinta.gris, texto: '' } }, 'externa'), /class="t-gris"/);
  });

  it('la línea del eje es la que manda el servidor (cinta.linea), no una copia', () => {
    for (const cinta of [CINTA_INTERNA, CINTA_EXTERNA, cintasDeLaVista(VISTA, {}).interna]) {
      const { x0, x1 } = cinta.linea;
      assert.ok(ctx.svgDeCinta(cinta).includes(`<line x1="${coord(x0)}" y1="${cinta.alturas.linea}" x2="${coord(x1)}" y2="${cinta.alturas.linea}" class="l-eje"/>`));
    }
    const otra = ctx.svgDeCinta({ ...CINTA_EXTERNA, linea: { x0: 50, x1: 900 } });
    assert.ok(otra.includes(`<line x1="50" y1="${CINTA_EXTERNA.alturas.linea}" x2="900" y2="${CINTA_EXTERNA.alturas.linea}" class="l-eje"/>`));
    // Sin la línea (una cinta vieja o rara), no se inventa
    assert.doesNotMatch(ctx.svgDeCinta({ ...CINTA_EXTERNA, linea: undefined }), /class="l-eje"/);
  });

  it('las marcas: el rombo del aviso, el cuadrado violeta de la nota, el aro de los datos, el punto verde de la carga y el de los dos juntos', () => {
    const A = CINTA_EXTERNA.alturas;
    const marcas = [{ x: 100, tipo: 'aviso', tipos: ['aviso'] }, { x: 300, tipo: 'nota', tipos: ['nota'] }, { x: 500, tipo: 'datos', tipos: ['datos'] },
      { x: 700, tipo: 'carga', tipos: ['carga'] }, { x: 900, tipo: 'datos-y-carga', tipos: ['datos', 'carga'] }];
    const svg = ctx.svgDeCinta({ ...CINTA_EXTERNA, marcas }, 'externa');
    const y = A.marcas;
    assert.ok(svg.includes(`<rect x="93" y="${y - 7}" width="14" height="14" transform="rotate(45 100 ${y})" class="i-aviso"/>`));
    assert.ok(svg.includes(`<rect x="294" y="${y - 6}" width="12" height="12" rx="3" class="i-nota"/>`));
    assert.ok(svg.includes(`<circle cx="500" cy="${y}" r="6.5" class="i-datos"/>`));
    assert.ok(svg.includes(`<circle cx="700" cy="${y}" r="7" class="i-carga"/>`));
    assert.ok(svg.includes(`<circle cx="900" cy="${y}" r="8.5" class="i-datos-y-carga"/>`));
    assert.match(svg, /<g class="marca m-datos-y-carga" data-x="900"><title>Datos entregados y carga en el portal<\/title>/);
    assert.match(ctx.svgDeCinta({ ...CINTA_EXTERNA, marcas }, 'interna'), /<title>Relevamiento entregado y carga en el portal<\/title>/);
  });

  it('la leyenda trae solo lo que se dibuja', () => {
    const leyenda = (cinta, gestion) => [...ctx.htmlDeLeyendaDeCinta(cinta, gestion).matchAll(/<i class="mk mk-([a-z-]+)" aria-hidden="true"><\/i>([^<]+)/g)].map((m) => `${m[1]}: ${m[2]}`);
    assert.deepEqual(leyenda(cintasDeLaVista(VISTA, {}).externa, 'externa'), ['aviso: Aviso del RPAD']);
    assert.deepEqual(leyenda(CINTA_INTERNA, 'interna'), ['aviso: Aviso del RPAD', 'datos-y-carga: Entrega y carga juntas', 'rayado: Después del vencimiento']);
    assert.deepEqual(leyenda(CINTA_EXTERNA, 'externa'), ['aviso: Aviso del RPAD', 'nota: Nota DGMIT recibida por el área', 'datos: Datos entregados',
      'carga: Carga en el portal', 'rayado: Después del vencimiento']);
    assert.equal(ctx.htmlDeLeyendaDeCinta(null, 'externa'), '');
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
    // Con la nota DGMIT, su número y su tipo; con los datos, el origen
    const conTodo = {
      dataset_id: 5, titulo: 'Un dataset', area: 'Un área', gestion: 'externa', contar: true, vencimiento: '2026-07-31',
      aviso: { fecha: '2026-06-21', texto: '29 antes', que: 'Nota Digital 2/26' }, nota: { numero: '156/26', tipo: 'Solicitud', texto: '3' },
      recibido: { fecha: '2026-08-04', texto: 'en el día', origen: 'Los entregó el área' }, carga: { fecha: '2026-08-05', texto: '1' }
    };
    const fila = ctx.htmlDeCasos({ casos: [conTodo] }, POR_DEFECTO, { anio: 2026, editable: true });
    assert.ok(fila.includes('<td>21/06/2026<span class="d">29 antes · Nota Digital 2/26</span></td>'));
    assert.ok(fila.includes('<td>156/26<span class="d">Solicitud · 3</span></td>'));
    assert.ok(fila.includes('<td>04/08/2026<span class="d">en el día · Los entregó el área</span></td>'));
    assert.ok(fila.includes('<td>05/08/2026<span class="d">1</span></td>'));
  });

  it('el título de los casos y la lista vacía', () => {
    assert.equal(ctx.textoDeLosCasos(VISTA, 'externa', 2026), `Los casos de 2026 (${VISTA.casos.filter((c) => c.gestion === 'externa').length})`);
    const vacia = ctx.htmlDeCasos({ casos: [] }, POR_DEFECTO, { anio: 2026, editable: true });
    assert.match(vacia, /<p class="mt-vacio">No hay casos de la gestión externa en 2026\.<\/p>/);
    assert.doesNotMatch(vacia, /<table/);
  });

  it('la aclaración de los casos dice los días elegidos y, con foto, que no se destilda', () => {
    const habiles = ctx.htmlDeCasos(VISTA, POR_DEFECTO, { anio: 2026, editable: true });
    assert.match(habiles, /Debajo de cada fecha, los días hábiles del tramo o su estado\./);
    assert.match(habiles, /Destildar un dataset lo saca de todas las cuentas de esta página/);
    assert.match(ctx.htmlDeCasos(VISTA, { ...POR_DEFECTO, dias: 'corridos' }, { anio: 2026, editable: true }), /los días corridos del tramo/);
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
  // Los resultados de la maqueta 4 (datos reales al 24/10/2026), con los textos como los arma el servidor
  const RESULTADOS = {
    a_tiempo: {
      a_tiempo: 5, total: 33, externa: [4, 27], interna: [1, 6],
      despues: { valor: 61, texto: 'Los otros 28 se cargaron una mediana de 61 días hábiles después.' }
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

  it('htmlDeResultados: «5 de 33 ciclos» y «una mediana de 61 días hábiles después»', () => {
    const html = ctx.htmlDeResultados({ resultados: RESULTADOS });
    // Actualizados a tiempo: la cifra con «de 33 ciclos» del servidor, el medidor, el texto de después y el desglose
    assert.match(html, /<h3 id="mt-res-a-tiempo">Actualizados a tiempo<\/h3>/);
    assert.match(html, /<div class="mt-heroe">5 <small>de 33 ciclos<\/small><\/div><div class="mt-medidor" aria-hidden="true"><i style="width:15%"><\/i><\/div>/);
    assert.ok(html.includes('<p class="mt-texto">Cargados en el portal hasta el día del vencimiento. Los otros 28 se cargaron una mediana de 61 días hábiles después.</p>'));
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
    // Con los resultados reales, la del servidor
    assert.equal(VISTA.resultados.textos.reiteraciones.aclaracion, aclaracion);
    assert.ok(ctx.htmlDeResultados(VISTA).includes(`<p class="mt-pie mt-aclaracion">${aclaracion}</p>`));
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
  // Los de gestion.js, que se mudaron sin cambios
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
    sinMalo(ctx.htmlDeFlecha({ ...tramo('tramite', null), vacio: { titulo: malo, texto: malo }, en_curso: { n: 1, valor: 1, texto: malo } }), 'flecha vacía');
    const caso = {
      dataset_id: 5, titulo: malo, area: malo, gestion: 'externa', contar: false, vencimiento: malo,
      aviso: { fecha: '2026-01-01', texto: malo, que: malo }, nota: { numero: malo, tipo: malo, texto: malo },
      recibido: { fecha: null, texto: malo, origen: malo }, carga: { fecha: null, texto: malo }
    };
    sinMalo(ctx.htmlDeCasos({ casos: [caso] }, POR_DEFECTO, { anio: 2026, editable: true }), 'casos');
    sinMalo(ctx.htmlDeFranjaSin({ sin_texto: textoDeLaFranja([malo]) }, { ...POR_DEFECTO, sin: [5] }), 'franja');
    sinMalo(ctx.htmlDeBarra({ anio: 2026, anios: [2026], en_vivo: true, aviso_foto: malo, sin_titulos: [] }, POR_DEFECTO), 'barra');
    sinMalo(ctx.htmlDeAclaraciones({ circuito: { aclaraciones: { interna: { ya_vencidos: { n: 1, texto: malo } } } } }, 'interna'), 'aclaraciones');
    const cinta = { ...CINTA_EXTERNA, ticks: [{ x: 30, texto: malo }], rotulos: [{ x: 40, y: 26, texto: malo, anclaje: 'start', color: 'tinta' }],
      segmentos: [{ x0: 40, x1: 80, texto: malo, color: 'violeta' }], gris: { x0: 500, x1: 970, texto: malo }, eje: { ...CINTA_EXTERNA.eje, texto: malo } };
    sinMalo(ctx.svgDeCinta(cinta, 'externa'), 'cinta');
    // Un anclaje o un color que no es de la lista no se escribe en un atributo
    const raro = ctx.svgDeCinta({ ...CINTA_EXTERNA, rotulos: [{ x: 40, y: 26, texto: 'r', anclaje: '"><script>', color: '"><x' }],
      segmentos: [{ x0: 40, x1: 80, texto: 's', color: '"><x' }], marcas: [{ x: 50, tipo: '"><x', tipos: [] }] }, 'externa');
    assert.doesNotMatch(raro, /<script>|"><x/);

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
    const cinta = { ...CINTA_EXTERNA, banda: { x0: 0, x1: 0 }, ticks: [{ x: 0, texto: '−40' }], rotulos: [{ x: 0, y: 26, texto: 'r', anclaje: 'start', color: 'tinta' }] };
    const svg = ctx.svgDeCinta(cinta, 'externa');
    assert.ok(svg.includes(`<rect x="0" y="${cinta.alturas.banda.y}" width="0" height="${cinta.alturas.banda.alto}" class="banda"/>`));
    assert.ok(svg.includes(`<text x="0" y="${cinta.alturas.ticks}" class="tick">−40</text>`));
    assert.ok(svg.includes('<text x="0" y="26" text-anchor="start" class="rotulo r-tinta">r</text>'));
    // Los textos con un 0 que manda el servidor van tal cual
    const flecha = ctx.htmlDeFlecha({ ...tramo('tramite', null), vacio: { titulo: SIN_NOTAS_DGMIT, texto: '0 notas pendientes de carga' } });
    assert.match(flecha, /<span class="c pend">0 notas pendientes de carga<\/span>/);
    const caso = { ...VISTA.casos[0], carga: { fecha: '2026-03-02', texto: '0' } };
    assert.match(ctx.htmlDeCasos({ casos: [caso] }, POR_DEFECTO, { anio: 2026, editable: true }), /<td>02\/03\/2026<span class="d">0<\/span><\/td>/);
    // Y nada dice NaN, null ni undefined con datos que faltan
    const vacio = [ctx.htmlDeCircuito({ circuito: { externa: [{}, null, { clave: 'tramite' }] } }, 'externa'),
      ctx.htmlDeCasos({ casos: [{}, null] }, POR_DEFECTO, { anio: 2026, editable: true }), ctx.svgDeCinta({ ...CINTA_EXTERNA, marcas: [{}], rotulos: [{}] }, 'externa'),
      ctx.htmlDeBarra({}, POR_DEFECTO), ctx.htmlDeFranjaSin({ sin_titulos: [null], sin_texto: null }, POR_DEFECTO)].join('');
    assert.doesNotMatch(vacio, /NaN|null|undefined/);
  });
});

// La pestaña Reportes (spec 2026-10-24-metricas-y-reportes, 5; maquetas 3-reportes.html y 6-reportes-datos-reales.html): siete tarjetas
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
  const ELEGIDO = { metricas: null, informe: null, area: '', desde: '2026-01-01', hasta: HOY_DE_LA_PRUEBA, meses: 6, gestion: 'ambas', completar: null };
  const reportes = (elegido = ELEGIDO, opciones = {}) => ctx.htmlDeReportes(elegido, { anios: FOTOS_2026, areas: LAS_AREAS, ...opciones });
  // La tarjeta de un reporte (lo que va de su <section> a la siguiente)
  const tarjeta = (html, clave) => html.match(new RegExp(`<section class="rp-tarjeta" aria-labelledby="rp-titulo-${clave}">[\\s\\S]*?</section>`))?.[0] ?? '';
  const pedido = (clave, elegido = ELEGIDO, { estado = POR_DEFECTO, anios = FOTOS_2026, hoy = HOY_DE_LA_PRUEBA } = {}) =>
    plano(ctx.pedidoDeReporte(clave, elegido, { estado, anios, hoy }) ?? null);
  const NO_DISPONIBLE = '<button type="button" class="mt-btn rp-no-disponible" data-reporte="informe" aria-disabled="true" aria-describedby="rp-titulo-informe">';

  it('siete tarjetas en dos grupos', () => {
    const html = reportes();
    const grupos = [...html.matchAll(/<h2 class="mt-seccion-titulo" id="rp-grupo-([a-z]+)">([^<]+)<\/h2><p class="mt-seccion-bajada">([^<]+)<\/p>/g)]
      .map((m) => [m[1], m[2], m[3]]);
    assert.deepEqual(grupos, [
      ['presentar', 'Para presentar', 'El estado del registro y cómo funcionó el circuito.'],
      ['trabajar', 'Para trabajar', 'Para preparar una reunión, planificar o dejar constancia.']
    ]);
    // Cada tarjeta es una sección con su h3 (los tres de «Para presentar», con su ícono, como en la maqueta), en su grupo y en orden
    const titulos = (parte) => [...parte.matchAll(/<section class="rp-tarjeta" aria-labelledby="rp-titulo-([a-z]+)"><h3 id="rp-titulo-\1">(<svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>)?([^<]+)<\/h3>/g)]
      .map((m) => [m[1], m[3], Boolean(m[2])]);
    const [presentar, trabajar] = html.split('id="rp-grupo-trabajar"');
    assert.deepEqual(titulos(presentar), [['metricas', 'Métricas del año', true], ['informe', 'Informe anual', true], ['estado', 'Estado general de los datasets', true]]);
    assert.deepEqual(titulos(trabajar), [['area', 'Por área', false], ['avisos', 'Avisos del RPAD', false], ['agenda', 'Agenda de pedidos', false],
      ['completar', 'Datos para completar', false]]);
    assert.match(presentar, /<div class="rp-grilla">/);
    assert.match(trabajar, /<div class="rp-grilla g4">/);
    // Los textos de la maqueta; la cantidad de hojas, la real con los datos de hoy (Ruling 24), y donde depende de lo que se elige, sin
    // un número
    for (const [clave, texto, hojas] of [
      ['metricas', 'Lo que muestra la pestaña Métricas: el circuito de las dos gestiones, los resultados, el contexto y el trabajo del RPAD. Respeta los casos destildados y lo aclara.', 'Unas 5 hojas'],
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
    for (const [id, rotulo] of [['rp-metricas-anio', 'Año'], ['rp-informe-anio', 'Año'], ['rp-area', 'Área'], ['rp-desde', 'Desde'], ['rp-hasta', 'Hasta'],
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
    const estado = { ...POR_DEFECTO, estadistico: 'promedio', dias: 'corridos', gestion: 'interna', sin: [12, 45] };
    assert.deepEqual(pedido('metricas', ELEGIDO, { estado, anios: dosAnios }),
      { ruta: '/metricas/pdf?estadistico=promedio&dias=corridos&sin=12,45', nombre: 'Metricas-RPAD-2027.pdf' });
    assert.deepEqual(pedido('metricas', { ...ELEGIDO, metricas: 2026 }, { estado, anios: dosAnios }),
      { ruta: '/metricas/pdf?anio=2026&estadistico=promedio&dias=corridos&sin=12,45', nombre: 'Metricas-RPAD-2026.pdf' });
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

  it('las rutas y los nombres de los siete PDF, con el día de hoy en Argentina', () => {
    // El nombre, el que pone el servidor en su Content-Disposition (API.pedirArchivo da solo el Blob: se arma acá con nombreDelReporte)
    assert.deepEqual(pedido('metricas'), { ruta: '/metricas/pdf', nombre: 'Metricas-RPAD-2026.pdf' });
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
    // Un reporte que no es de los siete, nada
    assert.equal(pedido('cumplimiento'), null);
  });

  // Los controladores ponen el nombre con nombreDelReporte (services/reportesNombres.js); la página guarda el Blob con su copia
  it('nombreDelReporte es el mismo en la página y en el servidor', () => {
    const casos = [
      ...['metricas', 'informe'].flatMap((tipo) => [2026, 2027, '2026'].map((anio) => [tipo, { anio }])),
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
    for (const clave of ['metricas', 'area', 'avisos', 'completar']) assert.doesNotMatch(tarjeta(html, clave), / disabled>/, clave);
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
      'mt-leyenda', 'mt-aclaracion-cinta', 'mt-aclaraciones', 'mt-ver-casos', 'mt-titulo-casos', 'mt-casos', 'mt-indice', 'mt-resultados', 'mt-bajada-resultados',
      'mt-contexto', 'mt-trabajo', 'mt-bajada-trabajo', 'mt-manuales', 'mt-auditoria', 'mt-csv', 'mt-areas', 'mt-completar']) {
      assert.equal(cuantas(html, new RegExp(`id="${id}"`, 'g')), 1, id);
    }
    assert.ok(html.includes('Con «Mediana», el número grande es el del medio: en la mitad de los casos, ese número o menos. Con «Promedio» o «Días corridos», cada cifra lo dice debajo.'));
    // «No hay métricas de ese año» no escribe un año a mano
    const sinDatos = html.match(/<div class="mt-estado" id="mt-sin-datos"[\s\S]*?<\/div>/)?.[0] ?? '';
    assert.match(sinDatos, /<h2>No hay métricas de ese año<\/h2>/);
    assert.doesNotMatch(sinDatos, /\d{4}/);
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
});

// El PDF de Métricas (services/reportesMetricasPdf.js) escribe los textos fijos de la pestaña: la página los tiene en su HTML y en
// reportes.js, y el PDF los toma de TEXTOS_DE_LA_PESTANA (y de unas funciones que arman lo mismo que la pestaña). Si cambia uno de la
// pestaña, este test falla: no se separan sin que nadie lo vea
describe('reportes.js y el PDF de Métricas: los mismos textos', () => {
  const html = leer('reportes.html');
  const fuente = leer('js/reportes.js');

  it('la bajada, el pie del circuito, los nombres de las secciones y lo de la doble verificación', () => {
    for (const dias of ['habiles', 'corridos']) assert.ok(ctx.textoDeLaBajada(dias).endsWith(` ${T.bajada[dias]}`), dias);
    for (const t of [T.pieDelCircuito, T.pieDeLaAuditoria, T.titulos.manuales, T.titulos.auditoria, T.titulos.resultados, T.titulos.contexto,
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

  it('el circuito: los roles de los nodos, «con tan pocos casos, es orientativo» y «Se cuenta hasta…»', () => {
    const circuitos = ctx.htmlDeCircuito(VISTA, 'externa') + ctx.htmlDeCircuito(VISTA, 'interna');
    for (const rol of Object.values(T.roles)) assert.ok(circuitos.includes(`<span class="r">${rol}</span>`), rol);
    const flecha = ctx.htmlDeFlecha(tramo('produccion', 3, { ciclos: 2, en_curso: { n: 1, valor: 9, texto: '1 sin datos registrados todavía, hace 9 días hábiles (mediana)' } }));
    assert.ok(flecha.includes(`<span class="o">${T.orientativo}</span>`));
    assert.ok(flecha.includes(`<span class="c">${T.seCuentaHasta}</span>`));
  });

  it('la leyenda de la cinta', () => {
    const conDatosYCarga = cintaDeMetricas([tramo('aviso', 41), tramo('produccion', 45), tramo('carga', 30)], { gestion: 'interna' });
    const vistos = new Set();
    for (const [cinta, gestion] of [[CINTA_EXTERNA, 'externa'], [CINTA_INTERNA, 'interna'], [conDatosYCarga, 'interna']]) {
      const leyenda = ctx.htmlDeLeyendaDeCinta(cinta, gestion);
      const tipos = [...new Set(cinta.marcas.map((m) => m.tipo)), ...(cinta.rayado ? ['rayado'] : [])];
      for (const tipo of tipos) {
        const nombre = typeof T.leyenda[tipo] === 'string' ? T.leyenda[tipo] : T.leyenda[tipo][gestion];
        assert.ok(leyenda.includes(`</i>${nombre}</span>`), `${gestion} ${tipo}: ${nombre}`);
        vistos.add(`${tipo} ${gestion}`);
      }
    }
    // Están todos los de la leyenda del PDF, menos la nota en la interna (no tiene)
    for (const esperado of ['aviso externa', 'nota externa', 'datos externa', 'carga externa', 'rayado externa', 'datos-y-carga interna', 'datos interna']) {
      assert.ok(vistos.has(esperado), esperado);
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
    for (const dias of ['habiles', 'corridos']) {
      assert.ok(ctx.htmlDeCasos(VISTA, { ...POR_DEFECTO, dias }).includes(`<p class="mt-pie">${textoDelPieDeLosCasos(dias)}`), dias);
    }
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
