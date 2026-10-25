// La pestaña Métricas de «Métricas y Reportes» (spec 2026-10-24-metricas-y-reportes, 1.4 a 1.7, 2.1 a 2.3 y 6), ejecutada en Node:
// lo puro de public/js/reportes.js (el estado de la URL, la barra, la franja de lo destildado, el circuito, la cinta y los casos) con
// lo que arma el servidor (services/metricasReglas.js y metricasCinta.js sobre los casos reales de tests/metricas-casos.js) y con
// tramos y cintas armados a mano. Como seguimiento.js, el script al cargarse solo declara: se carga en un vm con un document que no
// hace nada, junto con el api.js de verdad (Utils). La página no recalcula nada: dibuja lo que manda el servidor.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import { casosDe, vistaDe, unidadDe, SIN_NOTAS_DGMIT } from '../services/metricasReglas.js';
import { cintaDeMetricas, cintasDeLaVista } from '../services/metricasCinta.js';
import { mapaDeLosCasos, mapaDe, fuentesDelCaso, con, notaDgmit, HOY_DE_LAS_METRICAS as HOY } from './metricas-casos.js';

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

// La vista y las cintas de los casos reales al 24/10/2026, como las manda GET /api/metricas
const CASOS = casosDe(mapaDeLosCasos(), { hoy: HOY });
const vistaReal = (opciones = {}) => vistaDe(CASOS, { anio: 2026, al: HOY, ...opciones });
const VISTA = vistaReal();
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

  it('la franja dice «Calculado sin 1 dataset: Parque Automotor.» y «Volver a todos»', () => {
    assert.equal(ctx.htmlDeFranjaSin({ sin_titulos: [] }, POR_DEFECTO), '');
    assert.equal(ctx.htmlDeFranjaSin({}, POR_DEFECTO), '');
    const html = ctx.htmlDeFranjaSin({ sin_titulos: ['Parque Automotor'] }, { ...POR_DEFECTO, dias: 'corridos', sin: [11] });
    assert.match(html, /Calculado sin 1 dataset: Parque Automotor\./);
    // El link conserva todo lo demás y saca los destildados
    assert.match(html, /<a href="reportes\.html\?dias=corridos" class="mt-franja-link" data-accion="todos">Volver a todos<\/a>/);
    const dos = ctx.htmlDeFranjaSin({ sin_titulos: ['Parque Automotor', 'Pauta Publicitaria'] }, { ...POR_DEFECTO, sin: [11, 10] });
    assert.match(dos, /Calculado sin 2 datasets: Parque Automotor, Pauta Publicitaria\./);
    assert.match(dos, /href="reportes\.html"/);
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
    sinMalo(ctx.htmlDeFranjaSin({ sin_titulos: [malo] }, { ...POR_DEFECTO, sin: [5] }), 'franja');
    sinMalo(ctx.htmlDeBarra({ anio: 2026, anios: [2026], en_vivo: true, aviso_foto: malo, sin_titulos: [] }, POR_DEFECTO), 'barra');
    sinMalo(ctx.htmlDeAclaraciones({ circuito: { aclaraciones: { interna: { ya_vencidos: { n: 1, texto: malo } } } } }, 'interna'), 'aclaraciones');
    const cinta = { ...CINTA_EXTERNA, ticks: [{ x: 30, texto: malo }], rotulos: [{ x: 40, y: 26, texto: malo, anclaje: 'start', color: 'tinta' }],
      segmentos: [{ x0: 40, x1: 80, texto: malo, color: 'violeta' }], gris: { x0: 500, x1: 970, texto: malo }, eje: { ...CINTA_EXTERNA.eje, texto: malo } };
    sinMalo(ctx.svgDeCinta(cinta, 'externa'), 'cinta');
    // Un anclaje o un color que no es de la lista no se escribe en un atributo
    const raro = ctx.svgDeCinta({ ...CINTA_EXTERNA, rotulos: [{ x: 40, y: 26, texto: 'r', anclaje: '"><script>', color: '"><x' }],
      segmentos: [{ x0: 40, x1: 80, texto: 's', color: '"><x' }], marcas: [{ x: 50, tipo: '"><x', tipos: [] }] }, 'externa');
    assert.doesNotMatch(raro, /<script>|"><x/);
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
      ctx.htmlDeBarra({}, POR_DEFECTO), ctx.htmlDeFranjaSin({ sin_titulos: [null] }, POR_DEFECTO)].join('');
    assert.doesNotMatch(vacio, /NaN|null|undefined/);
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
      'mt-leyenda', 'mt-aclaracion-cinta', 'mt-aclaraciones', 'mt-ver-casos', 'mt-titulo-casos', 'mt-casos']) {
      assert.equal(cuantas(html, new RegExp(`id="${id}"`, 'g')), 1, id);
    }
    assert.ok(html.includes('Con «Mediana», el número grande es el del medio: en la mitad de los casos, ese número o menos. Con «Promedio» o «Días corridos», cada cifra lo dice debajo.'));
  });

  it('la pestaña Reportes conserva las cuatro tarjetas de siempre', () => {
    const reportes = html.match(/<section id="vista-reportes"[\s\S]*?<\/section>/)?.[0] ?? '';
    for (const funcion of ['generarReporteEstadoGeneral', 'generarReporteHistorial', 'generarReportePorArea', 'generarReporteCumplimiento']) {
      assert.ok(reportes.includes(`onclick="${funcion}()"`), funcion);
      assert.equal(typeof ctx[funcion], 'function', funcion);
    }
    for (const id of ['historial-desde', 'historial-hasta', 'area-select', 'periodo-select']) assert.ok(reportes.includes(`id="${id}"`), id);
  });

  it('sin Chart.js ni publico.css, y los tokens del Seguimiento en su <style>', () => {
    assert.doesNotMatch(html, /chart\.js|chart\.umd/i);
    assert.doesNotMatch(html, /publico\.css/);
    assert.match(html, /--sg-tinta: #1A365D;/);
    assert.match(html, /--sg-violeta: #5B4691;/);
  });
});
