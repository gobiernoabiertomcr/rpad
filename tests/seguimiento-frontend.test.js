// La pantalla del Seguimiento (spec 2026-10-20-seguimiento-dataset, "La pantalla"), ejecutada en Node: lo puro de
// public/js/seguimiento.js (la lista de "Sin elegir", la ficha, el circuito, la cinta y los movimientos) con los datos reales
// que arma el servidor (services/seguimientoReglas.js sobre los casos anonimizados de tests/seguimiento-casos.js), y la carga de
// la página con un DOM falso. Como perfil.js y correos.js, el script al cargarse solo declara: se carga en un vm con un document
// que no hace nada, junto con el api.js de verdad (Utils).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import { CASOS, CATALOGOS, HOY_DE_LOS_CASOS as HOY } from './seguimiento-casos.js';
import { seguimientoDe, resumenParaLista, nombreDelPdf } from '../services/seguimientoReglas.js';
import { textoRequiereNota } from '../services/requiereNotaReglas.js';

const leer = (ruta) => fs.readFileSync(new URL(`../public/${ruta}`, import.meta.url), 'utf8');

const cargar = (globales = {}) => {
  const contexto = vm.createContext({
    CONFIG: { API_URL: '/api' },
    console,
    document: { addEventListener() {}, getElementById: () => null },
    URLSearchParams,
    Auth: { isAuthenticated: () => true, isAdmin: () => false },
    window: { location: { search: '' } },
    ...globales
  });
  vm.runInContext(`${leer('js/api.js')}\n;globalThis.Utils = Utils;`, contexto);
  vm.runInContext(leer('js/seguimiento.js'), contexto);
  return contexto;
};

// Lo que devuelve una función del vm es de otro contexto: deepStrictEqual compara prototipos, así que se pasa a uno de acá
const plano = (valor) => JSON.parse(JSON.stringify(valor));
const f = (id) => ({ ...CASOS[id], catalogos: CATALOGOS });
const IDS = Object.keys(CASOS);
const ctx = cargar();
const filasDeLosCasos = () => IDS.map((id) => resumenParaLista(f(id), HOY));
const cuantas = (texto, patron) => (texto.match(patron) ?? []).length;

describe('seguimiento.js: la lista de "Sin elegir"', () => {
  it('los filtros, en orden y con sus textos', () => {
    assert.deepEqual(plano(vm.runInContext('FILTROS_LISTA', ctx)), [['vencidos', 'Vencidos'], ['proximos', 'Próximos a vencer'],
      ['actualizados', 'Actualizados'], ['eventuales', 'Eventuales'], ['sin-fecha', 'Sin fecha'], ['bajas', 'Dados de baja'], ['todos', 'Todos']]);
  });

  it('el filtro de cada estado del servidor', () => {
    const esperado = { vencido: 'vencidos', proximo: 'proximos', actualizado: 'actualizados', eventual: 'eventuales', 'sin-fecha': 'sin-fecha', baja: 'bajas' };
    for (const [estado, filtro] of Object.entries(esperado)) assert.equal(ctx.filtroDeEstado(estado), filtro, estado);
    for (const raro of ['atrasado', 'sin-respuesta', 'constructor', '', null, undefined]) assert.equal(ctx.filtroDeEstado(raro), null, String(raro));
  });

  it('lista: filtros, cantidades y orden', () => {
    const filas = filasDeLosCasos();
    const vencidos = filas.filter(x => ctx.filtroDeEstado(x.estado) === 'vencidos').map(x => x.id).sort((a, b) => a - b);
    assert.deepEqual(vencidos, [1, 11, 26, 33, 52, 61]);
    assert.equal(ctx.cantidadesPorFiltro(filas, '').vencidos, 6);
    assert.deepEqual(plano(ctx.ordenarFilas(ctx.filasDelFiltro(filas, 'vencidos', ''), 'vencidos').map(x => x.id)).slice(0, 2), [11, 26]);
  });

  it('los vencidos, por días de vencido (el mayor arriba) y a igual cantidad por título', () => {
    const orden = ctx.ordenarFilas(ctx.filasDelFiltro(filasDeLosCasos(), 'vencidos', ''), 'vencidos').map(x => x.id);
    assert.deepEqual(plano(orden), [11, 26, 61, 33, 1, 52]);
  });

  it('el resto, por vencimiento (los sin vencimiento al final) y después por título', () => {
    const orden = plano(ctx.ordenarFilas(ctx.filasDelFiltro(filasDeLosCasos(), 'todos', ''), 'todos').map(x => x.id));
    assert.equal(orden[0], 11);
    assert.equal(orden.at(-1), 66);
    const a = orden.indexOf(61), b = orden.indexOf(33), c = orden.indexOf(1);
    assert.ok(a < b && b < c, 'Comercios, Listado y Presupuesto vencen el mismo día: por título');
    assert.deepEqual(plano(ctx.ordenarFilas(ctx.filasDelFiltro(filasDeLosCasos(), 'actualizados', ''), 'actualizados').map(x => x.id)), [10, 9, 38, 42, 25]);
  });

  it('las cantidades de cada filtro; "Todos" son los activos y los dados de baja van aparte', () => {
    const filas = [...filasDeLosCasos(), { ...resumenParaLista(f(52), HOY), id: 999, activo: false, estado: 'baja', dias: null }];
    assert.deepEqual(plano(ctx.cantidadesPorFiltro(filas, '')),
      { vencidos: 6, proximos: 2, actualizados: 5, eventuales: 1, 'sin-fecha': 0, bajas: 1, todos: 14 });
    assert.deepEqual(plano(ctx.filasDelFiltro(filas, 'bajas', '').map(x => x.id)), [999]);
    assert.ok(!ctx.filasDelFiltro(filas, 'todos', '').some(x => x.id === 999));
  });

  it('la búsqueda compara sin tildes ni mayúsculas, en el título o en el área', () => {
    const filas = filasDeLosCasos();
    const ids = (filtro, texto) => plano(ctx.filasDelFiltro(filas, filtro, texto).map(x => x.id)).sort((a, b) => a - b);
    assert.deepEqual(ids('todos', 'EVALUACION'), [42]);
    assert.deepEqual(ids('todos', '  relaciones laborales '), [52]);
    assert.deepEqual(ids('todos', 'pauta'), [10]);
    assert.deepEqual(ids('vencidos', 'pauta'), []);
    assert.deepEqual(plano(ctx.cantidadesPorFiltro(filas, 'pauta')), { vencidos: 0, proximos: 0, actualizados: 1, eventuales: 0, 'sin-fecha': 0, bajas: 0, todos: 1 });
  });

  it('los botones de los filtros: aria-pressed y la cantidad; "Sin fecha" y "Dados de baja" solo si tienen algo o están elegidos', () => {
    const cantidades = ctx.cantidadesPorFiltro(filasDeLosCasos(), '');
    const html = ctx.htmlDeFiltros(cantidades, 'vencidos');
    assert.match(html, /<button type="button" class="sg-chip" data-filtro="vencidos" aria-pressed="true">Vencidos <b>6<\/b><\/button>/);
    assert.match(html, /data-filtro="todos" aria-pressed="false">Todos <b>14<\/b>/);
    assert.equal(cuantas(html, /aria-pressed="true"/g), 1);
    assert.ok(!html.includes('Sin fecha') && !html.includes('Dados de baja'));
    const elegido = ctx.htmlDeFiltros(cantidades, 'bajas');
    assert.match(elegido, /data-filtro="bajas" aria-pressed="true">Dados de baja <b>0<\/b>/);
    assert.ok(ctx.htmlDeFiltros({ ...plano(cantidades), 'sin-fecha': 2 }, 'vencidos').includes('Sin fecha <b>2</b>'));
  });

  it('una fila: el link al seguimiento, el vencimiento, los días, los avisos del ciclo y el último aviso', () => {
    const fila = ctx.htmlDeFilaDeLista(resumenParaLista(f(52), HOY));
    assert.match(fila, /^<tr>/);
    assert.ok(fila.includes('<a href="seguimiento.html?id=52">Directores Generales de Planta Permanente</a>'));
    assert.ok(fila.includes('<small>Dirección General de Relaciones Laborales</small>'));
    assert.match(fila, /<td class="num">31\/07\/2026<\/td>/);
    assert.match(fila, /<td class="num atraso">81 días<\/td>/);
    assert.match(fila, /<td class="avisos"><b>6<\/b><small>5 emails y 1 nota<\/small><\/td>/);
    assert.match(fila, /<td class="num">13\/10\/2026<\/td>/);
    assert.ok(!fila.includes('sg-etq'));
  });

  it('las etiquetas de gestión interna y del cambio pendiente; un eventual sin vencimiento ni avisos que contar', () => {
    assert.ok(ctx.htmlDeFilaDeLista(resumenParaLista(f(26), HOY)).includes('<span class="sg-etq interna">Gestión interna</span>'));
    assert.ok(ctx.htmlDeFilaDeLista(resumenParaLista(f(1), HOY)).includes('<span class="sg-etq pendiente">Cambio pendiente de aprobación</span>'));
    const eventual = ctx.htmlDeFilaDeLista(resumenParaLista(f(66), HOY));
    assert.match(eventual, /<td class="num">Sin vencimiento<\/td>/);
    assert.match(eventual, /<td class="avisos">—<\/td>/);
    const proximo = ctx.htmlDeFilaDeLista(resumenParaLista(f(81), HOY));
    assert.match(proximo, /<td class="num">31\/10\/2026<\/td>\s*<td class="num">—<\/td>/);
    assert.ok(proximo.includes('<b>1</b><small>1 nota</small>'));
    const sinAvisos = ctx.htmlDeFilaDeLista(resumenParaLista(f(10), HOY));
    assert.match(sinAvisos, /<td class="avisos"><b>0<\/b><\/td>/);
  });

  it('una fila escapa el título y el área', () => {
    const fila = ctx.htmlDeFilaDeLista({ ...resumenParaLista(f(52), HOY), titulo: '<img src=x onerror=alert(1)>', area: 'A & "B"' });
    assert.ok(fila.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(fila.includes('A &amp; &quot;B&quot;'));
    assert.ok(!fila.includes('<img'));
  });

  it('las sugerencias del buscador son "título — área", y elegir una que coincide exacto da su id', () => {
    const filas = filasDeLosCasos();
    const html = ctx.htmlDeSugerencias(filas);
    assert.equal(cuantas(html, /<option /g), 14);
    assert.ok(html.includes('<option value="Directores Generales de Planta Permanente — Dirección General de Relaciones Laborales"></option>'));
    assert.equal(ctx.idDeLaSugerencia('Directores Generales de Planta Permanente — Dirección General de Relaciones Laborales', filas), 52);
    assert.equal(ctx.idDeLaSugerencia('Directores Generales de Planta Permanente', filas), null);
    assert.equal(ctx.idDeLaSugerencia('', filas), null);
    assert.ok(ctx.htmlDeSugerencias([{ id: 1, titulo: 'a"<b>', area: 'x' }]).includes('value="a&quot;&lt;b&gt; — x"'));
  });
});

describe('seguimiento.js: la ficha y el circuito', () => {
  it('la ficha de 52: título, insignia "Vencido", área, botones y la fila de datos', () => {
    const html = ctx.htmlDeFicha(seguimientoDe(f(52), HOY).ficha);
    assert.ok(html.includes('<h2 class="sg-titulo" id="sg-titulo-dataset">Directores Generales de Planta Permanente</h2>'));
    assert.ok(html.includes('<span class="sg-insignia sg-vencido">Vencido</span>'));
    assert.ok(html.includes('Área responsable: <strong>Dirección General de Relaciones Laborales</strong>, gestión externa'));
    assert.match(html, /<button type="button" class="sg-btn sg-btn-tinta" data-accion="pdf">[\s\S]*Descargar PDF<\/button>/);
    assert.ok(html.includes('href="https://datos.comodoro.gov.ar/dataset/directores-generales-de-planta-permanente"'));
    assert.ok(html.includes('>Ver en el portal</a>'));
    for (const [rotulo, valor] of [['Frecuencia', 'Cada medio año'], ['Datos al', '31/12/2025'], ['Cargado en el portal', '04/02/2026'], ['Datos solicitados hoy', 'Vigente al 30/06/2026']]) {
      assert.ok(html.includes(`<div class="sg-dato"><dt>${rotulo}</dt><dd>${valor}</dd></div>`), rotulo);
    }
    assert.ok(html.includes('<div class="sg-dato"><dt>Venció el</dt><dd class="alerta">31/07/2026, hace 81 días</dd></div>'));
  });

  it('un dataset al día dice "Vence el"; un eventual, sin vencimiento; uno de gestión interna lo dice', () => {
    const al = ctx.htmlDeFicha(seguimientoDe(f(81), HOY).ficha);
    assert.ok(al.includes('<div class="sg-dato"><dt>Vence el</dt><dd>31/10/2026</dd></div>'));
    assert.ok(al.includes('<span class="sg-insignia sg-proximo">Próximo a vencer</span>'));
    const eventual = ctx.htmlDeFicha(seguimientoDe(f(66), HOY).ficha);
    assert.ok(eventual.includes('<div class="sg-dato"><dt>Vencimiento</dt><dd>Sin vencimiento</dd></div>'));
    assert.ok(eventual.includes('<div class="sg-dato"><dt>Datos solicitados hoy</dt><dd>—</dd></div>'));
    assert.ok(eventual.includes(', gestión interna</p>'));
  });

  it('un dataset dado de baja: la insignia y "Dado de baja el …"', () => {
    const ficha = { ...seguimientoDe(f(52), HOY).ficha, activo: false, baja: '2026-09-15', estado: { estado: 'baja', texto: 'Dado de baja', dias: null } };
    const html = ctx.htmlDeFicha(ficha);
    assert.ok(html.includes('<span class="sg-insignia sg-baja">Dado de baja</span>'));
    assert.ok(html.includes('Dado de baja el 15/09/2026'));
    assert.ok(html.includes('<dt>Vencimiento</dt><dd>Sin vencimiento</dd>'));
  });

  it('escapa el título y la URL', () => {
    const html = ctx.htmlDeFicha({ ...seguimientoDe(f(52), HOY).ficha, titulo: '<b>x</b>', url_dataset: null });
    assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;')); assert.ok(!html.includes('Ver en el portal'));
    assert.ok(!ctx.htmlDeFicha({ ...seguimientoDe(f(52), HOY).ficha, url_dataset: 'javascript:alert(1)' }).includes('Ver en el portal'));
    const comillas = ctx.htmlDeFicha({ ...seguimientoDe(f(52), HOY).ficha, url_dataset: 'https://x.test/?a="b"&c=<d>' });
    assert.ok(comillas.includes('href="https://x.test/?a=&quot;b&quot;&amp;c=&lt;d&gt;"'));
    assert.equal(ctx.htmlDeFicha(null), '');
  });

  it('el circuito de 52, con los textos del servidor', () => {
    const s = seguimientoDe(f(52), HOY), html = ctx.htmlDelCircuito(s.circuito);
    for (const t of ['6 avisos', '5 emails y la Nota Digital N° 2/26', 'DGMIT y Dirección Administrativa', 'Vencido hace 81 días']) assert.ok(html.includes(t), t);
    assert.ok(html.includes('<div class="sg-nodo area">'), 'el área vencida, en rojo');
    assert.ok(html.includes('Además, el 21/06/2026 el RPAD le anticipó por email al área que iba a recibir una nota formal.'));
    assert.ok(html.includes('class="sg-flecha fuera"') && html.includes('Por fuera del RPAD: no queda registrada'));
  });

  it('el encabezado del circuito: desde cuándo se cuentan los avisos y el vencimiento, con los textos del servidor', () => {
    assert.equal(ctx.textoDeCabezaDelCircuito(seguimientoDe(f(58), HOY).circuito), 'Desde la actualización del 16/12/2025 · Vencimiento del 30/11/2026');
    assert.equal(ctx.textoDeCabezaDelCircuito({ desde: null, vencimiento: { texto: 'Vencimiento del 31/07/2026' } }), 'Vencimiento del 31/07/2026');
    assert.equal(ctx.textoDeCabezaDelCircuito(seguimientoDe(f(66), HOY).circuito), '');
    assert.equal(ctx.textoDeCabezaDelCircuito(null), '');
  });

  it('el circuito de gestión interna (26), sin avisos (10) y eventual (66)', () => {
    const interna = ctx.htmlDelCircuito(seguimientoDe(f(26), HOY).circuito);
    assert.ok(interna.includes('DGMIT y Dirección de Investigación Territorial') && interna.includes('Relevamiento'));
    assert.ok(!interna.includes('sg-directo'), 'sin la línea del email al área');
    const sinAvisos = ctx.htmlDelCircuito(seguimientoDe(f(10), HOY).circuito);
    assert.ok(sinAvisos.includes('Sin avisos') && sinAvisos.includes('Todavía no hizo falta') && sinAvisos.includes('Vence en 103 días'));
    assert.ok(!sinAvisos.includes('sg-nodo area'));
    const eventual = ctx.htmlDelCircuito(seguimientoDe(f(66), HOY).circuito);
    assert.equal(cuantas(eventual, /Sin vencimiento/g), 2);
    assert.equal(ctx.htmlDelCircuito(null), '');
  });

  // «Requiere nota DGMIT» (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.7)
  const conDato = (id, requiere_nota) => seguimientoDe({ ...f(id), dataset: { ...CASOS[id].dataset, requiere_nota } }, HOY);
  const DATO = (valor) => `<div class="sg-dato"><dt>Requiere nota DGMIT</dt><dd>${valor}</dd></div>`;

  it('la ficha de un externo muestra Requiere nota DGMIT: No; con null, Sin dato; la interna no lo muestra', () => {
    assert.ok(ctx.htmlDeFicha(conDato(52, 0).ficha).includes(DATO('No')), 'No');
    assert.ok(ctx.htmlDeFicha(conDato(52, 1).ficha).includes(DATO('Sí')), 'Sí');
    assert.ok(ctx.htmlDeFicha(conDato(52, null).ficha).includes(DATO('Sin dato')), 'null');
    assert.ok(ctx.htmlDeFicha(seguimientoDe(f(52), HOY).ficha).includes(DATO('Sin dato')), 'los casos reales, sin dato');
    // La interna no lo muestra, aunque el dataset traiga un valor (el servidor lo manda null)
    for (const valor of [null, 0, 1]) {
      const interna = ctx.htmlDeFicha(conDato(38, valor).ficha);
      assert.ok(!interna.includes('Requiere nota'), `interna con ${valor}`);
      assert.ok(interna.includes('gestión interna</p>'));
    }
    // Aunque le pasaran un 0 a la ficha de una interna, lo decide la gestión
    assert.ok(!ctx.htmlDeFicha({ ...conDato(38, null).ficha, requiere_nota: 0 }).includes('Requiere nota'));
  });

  it('el dato va después de «Datos solicitados hoy» y es el último de la fila de datos', () => {
    const html = ctx.htmlDeFicha(conDato(52, 0).ficha);
    const rotulos = [...html.matchAll(/<dt>([^<]*)<\/dt>/g)].map(m => m[1]);
    assert.deepEqual(rotulos, ['Frecuencia', 'Datos al', 'Cargado en el portal', 'Venció el', 'Datos solicitados hoy', 'Requiere nota DGMIT']);
    assert.match(html, /Requiere nota DGMIT<\/dt><dd>No<\/dd><\/div>\s*<\/dl>/);
  });

  it('textoDeRequiereNota es una copia de textoRequiereNota del servidor, con «Sin dato» donde no hay dato', () => {
    for (const valor of [1, 0, true, false, '1', '0', null, undefined, '', 'si', 2, -1, {}, [], NaN]) {
      assert.equal(ctx.textoDeRequiereNota(valor), textoRequiereNota(valor, 'Sin dato'), String(valor));
    }
    assert.equal(ctx.textoDeRequiereNota(0), 'No');
    assert.equal(ctx.textoDeRequiereNota(1), 'Sí');
    assert.equal(ctx.textoDeRequiereNota(null), 'Sin dato');
  });

  it('el circuito con No dice lo que manda el servidor y no dibuja «Al área» si no hay email', () => {
    const sinEmail = ctx.htmlDelCircuito(conDato(81, 0).circuito);
    for (const t of ['DGMIT y Dirección Administrativa', 'No hace falta nota formal', 'Sin nota formal', 'Los datos se obtienen de la fuente']) {
      assert.ok(sinEmail.includes(t), t);
    }
    assert.ok(!sinEmail.includes('Mandan la nota formal al área') && !sinEmail.includes('Por fuera del RPAD'));
    assert.ok(sinEmail.includes('class="sg-flecha fuera"'), 'el tramo sigue punteado');
    assert.ok(!sinEmail.includes('sg-directo'), 'sin la línea del email al área');
    // Con un email al área en el ciclo (caso 52), la línea sigue
    const conEmail = ctx.htmlDelCircuito(conDato(52, 0).circuito);
    assert.ok(conEmail.includes('No hace falta nota formal'));
    assert.ok(conEmail.includes('Además, el 21/06/2026 el RPAD le anticipó por email al área que iba a recibir una nota formal.'));
  });
});

describe('seguimiento.js: la cinta', () => {
  it('la cinta: una marca por agrupación, con <title>', () => {
    const s = seguimientoDe(f(52), HOY), svg = ctx.svgDeCinta(s.cinta);
    assert.equal((svg.match(/<title>/g) ?? []).length, s.cinta.marcas.length);
  });

  it('el SVG de 1000 × 170 con las filas de la pantalla, los textos del servidor y la cantidad de una marca agrupada', () => {
    const svg = ctx.svgDeCinta(seguimientoDe(f(52), HOY).cinta);
    assert.match(svg, /^<svg class="sg-cinta-svg" viewBox="0 0 1000 170" role="img" aria-label="[^"]+"/);
    assert.ok(svg.includes('<pattern id="sg-rayado"'));
    assert.ok(svg.includes('>Vencido hace 81 días</text>'));
    assert.ok(svg.includes('>vence 31/01</text>') && svg.includes('>vence 31/07</text>'));
    assert.match(svg, /<text x="[\d.]+" y="113" class="hoy">hoy<\/text>/);
    assert.match(svg, /y="14" class="etq-nota">Nota 2\/26<\/text>/);
    assert.match(svg, /y="151" class="mes">nov<\/text>/);
    assert.match(svg, /y="164" class="anio">2025<\/text>/);
    assert.match(svg, /y="164" class="anio">2026<\/text>/);
    assert.equal(cuantas(svg, /class="anio"/g), 2);
    // Las dos propuestas rechazadas del 04/02 en una sola marca, con un 2
    assert.match(svg, /<title>04\/02\/2026: Propuesta rechazada\n04\/02\/2026: Propuesta rechazada<\/title><g class="i-rech">[\s\S]*?class="cuenta">2<\/text><\/g>/);
  });

  it('un ciclo que empieza donde terminó otro se dibuja 1,5 más adentro', () => {
    const svg = ctx.svgDeCinta(seguimientoDe(f(52), HOY).cinta);
    // El segundo ciclo de 52 empieza en 275.95, donde termina lo vencido del primero; el de después de la actualización simple del
    // 17/12/2025, en 149.75, donde termina el ciclo de antes (que no tiene vencimiento conocido)
    assert.match(svg, /<rect x="277.45" y="54" width="[\d.]+" height="22" class="t-ciclo"\/>/);
    assert.match(svg, /<rect x="151.25" y="54" width="[\d.]+" height="22" class="t-ciclo"\/>/);
    assert.match(svg, /<rect x="108.55" y="54" width="[\d.]+" height="22" class="t-ciclo"\/>/);
  });

  it('"hoy" baja un renglón si choca con un vencimiento (38) y el eventual lleva su texto (66)', () => {
    assert.match(ctx.svgDeCinta(seguimientoDe(f(38), HOY).cinta), /<text x="[\d.]+" y="126" class="hoy">hoy<\/text>/);
    const eventual = ctx.svgDeCinta(seguimientoDe(f(66), HOY).cinta);
    assert.ok(eventual.includes('class="t-eventual"') && eventual.includes('>Frecuencia eventual: sin vencimiento</text>'));
    assert.ok(ctx.svgDeCinta(seguimientoDe(f(81), HOY).cinta).includes('class="t-gris">Todavía no estaba en el RPAD</text>'));
  });

  it('escapa lo que dibuja y no tira error con datos raros', () => {
    const cinta = { meses: [], tramos: [{ x0: 'a', x1: 2, tipo: 'ciclo' }], textos: [{ x: 500, texto: '<b>', tipo: 'vencido' }], vencimientos: [],
      marcas: [{ x: 100, fila: 'arriba', tipo: 'nota', cantidad: 1, etiqueta: 'Nota <1>', detalle: ['<script>&'] }], hoy: { x: 940, renglon: 1 } };
    const svg = ctx.svgDeCinta(cinta);
    assert.ok(svg.includes('<title>&lt;script&gt;&amp;</title>') && svg.includes('&lt;b&gt;') && svg.includes('Nota &lt;1&gt;'));
    assert.ok(!svg.includes('<script') && !svg.includes('NaN'));
    assert.equal(ctx.svgDeCinta(null), '');
  });

  it('la leyenda, con todos los tipos y el rayado "Vencido"', () => {
    const html = ctx.htmlDeLeyenda();
    for (const texto of ['Nota Digital a DGMIT', 'Email a DGMIT', 'Email al área', 'Actualización', 'Actualización pendiente', 'Cambio en la ficha',
      'Cambio pendiente', 'Propuesta rechazada', 'Alta', 'Vencido']) assert.ok(html.includes(`</i>${texto}</span>`), texto);
    assert.equal(cuantas(html, /aria-hidden="true"/g), 10);
  });
});

describe('seguimiento.js: los movimientos', () => {
  const s52 = seguimientoDe(f(52), HOY);
  const items52 = ctx.itemsDeLaLista(s52.movimientos, s52.hitos, 'todos');

  it('los filtros, en orden y con sus textos', () => {
    assert.deepEqual(plano(vm.runInContext('FILTROS_MOVIMIENTOS', ctx)), [['todos', 'Todos'], ['avisos', 'Avisos a DGMIT'], ['area', 'Emails al área'],
      ['actualizaciones', 'Actualizaciones'], ['cambios', 'Cambios en la ficha'], ['propuestas', 'Propuestas'], ['auditoria', 'Notas de auditoría'], ['altas', 'Alta y baja']]);
  });

  it('los botones de los filtros, con su cantidad y solo los que tienen algo', () => {
    const html = ctx.htmlDeFiltrosDeMovimientos(s52.movimientos, 'todos');
    const botones = [...html.matchAll(/data-filtro="([^"]+)" aria-pressed="(true|false)">([^<]+) <b>(\d+)<\/b>/g)].map(m => [m[1], m[2], m[3], Number(m[4])]);
    assert.deepEqual(botones, [['todos', 'true', 'Todos', 16], ['avisos', 'false', 'Avisos a DGMIT', 9], ['area', 'false', 'Emails al área', 2],
      ['actualizaciones', 'false', 'Actualizaciones', 2], ['propuestas', 'false', 'Propuestas', 2], ['altas', 'false', 'Alta y baja', 1]]);
  });

  it('los hitos solo con "Todos", intercalados por fecha', () => {
    assert.equal(items52.length, 18);
    const orden = plano(items52.map(i => (i.hito ? `hito ${i.hito.fecha}` : i.movimiento.fecha)));
    assert.deepEqual(orden.slice(3, 6), ['2026-08-01', 'hito 2026-07-31', '2026-07-26']);
    assert.deepEqual(orden.slice(11, 14), ['2026-02-01', 'hito 2026-01-31', '2026-01-26']);
    const avisos = ctx.itemsDeLaLista(s52.movimientos, s52.hitos, 'avisos');
    assert.equal(avisos.length, 9);
    assert.ok(avisos.every(i => i.movimiento && i.movimiento.filtro === 'avisos'));
  });

  it('una fila: li.sg-mov con el botón que se despliega y el cuerpo oculto', () => {
    const html = ctx.htmlDeMovimiento(s52.movimientos[0], 0, { esAdmin: false });
    assert.match(html, /^<li class="sg-mov"><button type="button" class="sg-fila" aria-expanded="false" aria-controls="sg-cuerpo-0">/);
    assert.ok(html.includes('<span class="f">13/10/2026</span><i class="mk mk-nota" aria-hidden="true"></i>'));
    assert.ok(html.includes('<span class="q">Nota Digital N° 2/26 a DGMIT</span><span class="d">Aviso de gestión externa, sección vencidos: vencía el 31/07/2026.</span>'));
    assert.ok(html.includes('<span class="p">Envío automático</span>'));
    assert.match(html, /<div class="sg-cuerpo" id="sg-cuerpo-0" hidden>/);
    const act = ctx.htmlDeMovimiento(s52.movimientos.find(m => m.tipo === 'act'), 3, {});
    assert.ok(act.includes('<span class="p">Propuso Ana Uno<br>Aprobó Bruno Dos</span>'));
    assert.ok(act.includes('aria-controls="sg-cuerpo-3"') && act.includes('id="sg-cuerpo-3"'));
  });

  it('la nota desplegada: descarga solo para administración', () => {
    const nota = seguimientoDe(f(52), HOY).movimientos[0];
    assert.ok(ctx.htmlDeMovimiento(nota, 0, { esAdmin: true }).includes('Descargar la nota y su anexo'));
    assert.ok(!ctx.htmlDeMovimiento(nota, 0, { esAdmin: false }).includes('Descargar la nota y su anexo'));
  });

  it('la nota desplegada: vencimiento, datos solicitados, Para y CC, envío y estado; el botón lleva el id y el nombre del archivo', () => {
    const html = ctx.htmlDeMovimiento(s52.movimientos[0], 0, { esAdmin: true });
    for (const [dt, dd] of [['Vencimiento informado', '31/07/2026'], ['Datos solicitados', 'No quedó guardado: las notas 1/26 y 2/26 son anteriores a ese dato.'],
      ['Para', 'correo2@rpad.test'], ['CC', 'correo3@rpad.test'], ['Enviada', '13/10/2026 a las 14:50'], ['Estado', 'Enviada']]) {
      assert.ok(html.includes(`<dt>${dt}</dt><dd>${dd}</dd>`), dt);
    }
    assert.match(html, /<button type="button" class="sg-link" data-nota="4" data-archivo="Nota-Digital-2-26.pdf">Descargar la nota y su anexo<\/button>/);
    const nota81 = ctx.htmlDeMovimiento(seguimientoDe(f(81), HOY).movimientos[0], 0, {});
    assert.ok(nota81.includes('<dt>Datos solicitados</dt><dd>Vigente al 30/09/2026</dd>'));
  });

  it('el email desplegado: el asunto original, los destinatarios, la hora y el resultado', () => {
    const email = ctx.htmlDeMovimiento(s52.movimientos[1], 1, {});
    assert.ok(email.includes('<dt>Asunto original</dt><dd class="sg-asunto">Resumen Mensual: Sin Respuesta (Externos)</dd>'));
    assert.ok(email.includes('<dt>Destinatarios</dt><dd>correo1@rpad.test, correo2@rpad.test, correo3@rpad.test</dd>'));
    assert.ok(email.includes('<dt>Enviado</dt><dd>01/10/2026 a las 08:00</dd>'));
    assert.ok(email.includes('<dt>Resultado</dt><dd>Enviado</dd>'));
    const fallido = ctx.htmlDeMovimiento(seguimientoDe(f(42), HOY).movimientos.find(m => m.tipo === 'email' && !m.extra.success), 0, {});
    assert.ok(fallido.includes('<dt>Resultado</dt><dd>No se pudo enviar: connect ECONNREFUSED 64.233.178.109:587</dd>'));
  });

  it('el cambio desplegado: los campos con el antes y el después, y cuándo se propuso y se aprobó o rechazó', () => {
    const act = ctx.htmlDeMovimiento(s52.movimientos.find(m => m.tipo === 'act' && m.extra.cambio_id === 7), 0, {});
    assert.ok(act.includes('<dt>Cargado en el portal</dt><dd><span class="sg-antes">17/12/2025</span> a <strong>04/02/2026</strong></dd>'));
    assert.ok(act.includes('<dt>Próxima actualización</dt><dd><span class="sg-antes">31/01/2026</span> a <strong>31/07/2026</strong></dd>'));
    assert.ok(act.includes('<dt>Propuesto</dt><dd>04/02/2026 a las 09:57</dd>') && act.includes('<dt>Aprobado</dt><dd>04/02/2026 a las 09:58</dd>'));
    const rech = ctx.htmlDeMovimiento(s52.movimientos.find(m => m.tipo === 'rech'), 0, {});
    assert.ok(rech.includes('<dt>Rechazado</dt><dd>04/02/2026 a las 09:57</dd>'));
    const pendiente = ctx.htmlDeMovimiento(seguimientoDe(f(1), HOY).movimientos.find(m => m.tipo === 'actp'), 0, {});
    assert.ok(pendiente.includes('<dt>Recibido el</dt><dd><span class="sg-antes">—</span> a <strong>19/10/2026</strong></dd>'));
    assert.ok(pendiente.includes('<dt>Aprobación</dt><dd>Pendiente</dd>'));
    const historial = ctx.htmlDeMovimiento(s52.movimientos.find(m => m.tipo === 'act' && m.extra.cambio_id === null), 0, {});
    assert.ok(historial.includes('<dt>Registrado</dt><dd>17/12/2025 a las 08:54</dd>'));
  });

  it('un hito: la fecha y el texto del servidor, en verde si se actualizó', () => {
    assert.equal(ctx.htmlDeHito(s52.hitos[0]), '<li class="sg-hito"><span class="f">31/07/2026</span><span class="t">Venció</span></li>');
    assert.equal(ctx.htmlDeHito(s52.hitos[1]),
      '<li class="sg-hito cumplido"><span class="f">31/01/2026</span><span class="t">Venció. Actualizado el 04/02/2026, 4 días después del vencimiento</span></li>');
  });

  it('la lista: los primeros 10 movimientos (los hitos no cuentan) y después de a 20', () => {
    const primera = ctx.htmlDeMovimientos(items52, 10, { esAdmin: false });
    assert.equal(cuantas(primera, /<li class="sg-mov">/g), 10);
    assert.equal(cuantas(primera, /<li class="sg-hito/g), 1);
    const segunda = ctx.htmlDeMovimientos(items52, 30, { esAdmin: false, desde: 10 });
    assert.equal(cuantas(segunda, /<li class="sg-mov">/g), 6);
    assert.equal(cuantas(segunda, /<li class="sg-hito/g), 1);
    assert.ok(segunda.includes('id="sg-cuerpo-10"') && !segunda.includes('id="sg-cuerpo-9"'));
    assert.equal(ctx.textoDeMas(16, 10), 'Ver los 6 anteriores');
    assert.equal(ctx.textoDeMas(45, 10), 'Ver los 20 anteriores');
    assert.equal(ctx.textoDeMas(11, 10), 'Ver el anterior');
    assert.equal(ctx.textoDeMas(10, 10), '');
  });

  it('el nombre del PDF, igual al del servidor', () => {
    for (const titulo of ['Directores Generales de Planta Permanente', 'Título — con "comillas" y <b>', '']) {
      assert.equal(ctx.nombreDelPdf(titulo, HOY), nombreDelPdf(titulo, HOY));
    }
  });
});

// La página con un DOM falso: cada id es un elemento (oculto, salvo #loading y #sg-volver, como en seguimiento.html), un
// API.pedirJson falso y el id de la URL
const elementoFalso = (id) => ({
  id, hidden: !['loading', 'sg-volver'].includes(id), innerHTML: '', textContent: '', value: '',
  addEventListener() {}, insertAdjacentHTML(_donde, html) { this.innerHTML += html; }, querySelector: () => null, querySelectorAll: () => [], focus() {}
});
const preparar = ({ id = null, respuestas = {}, errores = {}, esAdmin = false } = {}) => {
  const pagina = cargar();
  const elementos = {};
  const pedidos = [];
  pagina.document.getElementById = (clave) => (elementos[clave] ??= elementoFalso(clave));
  pagina.console = { error() {} };
  pagina.Auth = { isAuthenticated: () => true, isAdmin: () => esAdmin };
  pagina.Utils.getUrlParams = () => (id === null ? {} : { id });
  vm.runInContext('API', pagina).pedirJson = async (metodo, ruta) => {
    pedidos.push(`${metodo} ${ruta}`);
    if (errores[ruta]) throw errores[ruta];
    return typeof respuestas[ruta] === 'function' ? respuestas[ruta]() : respuestas[ruta];
  };
  const el = (clave) => pagina.document.getElementById(clave);
  const ESTADOS = ['loading', 'vista-lista', 'vista-dataset', 'not-found', 'sg-error'];
  const visibles = () => ESTADOS.filter((clave) => !el(clave).hidden);
  return { pagina, el, visibles, pedidos };
};
const conEstado = (status) => Object.assign(new Error(`Error ${status}`), { status });
const LISTA = () => ({ success: true, data: filasDeLosCasos() });
const DE = (id) => ({ success: true, data: seguimientoDe(f(id), HOY) });

describe('seguimiento.js: la página', () => {
  it('sin sesión, al login', async () => {
    let arranque = null;
    const window = { location: {} };
    const pagina = cargar({
      document: { addEventListener: (tipo, funcion) => { if (tipo === 'DOMContentLoaded') arranque = funcion; }, getElementById: () => null },
      Auth: { isAuthenticated: () => false },
      window
    });
    assert.equal(typeof arranque, 'function');
    let inicio = 0;
    pagina.iniciarSeguimiento = () => { inicio += 1; };
    arranque();
    assert.equal(window.location.href, 'login.html');
    assert.equal(inicio, 0);
  });

  it('con sesión y sin id: la lista, con los vencidos y sin "Ver todos los datasets"', async () => {
    const { pagina, el, visibles, pedidos } = preparar({ respuestas: { '/seguimiento': LISTA() } });
    await pagina.iniciarSeguimiento();
    assert.deepEqual(pedidos, ['GET /seguimiento']);
    assert.deepEqual(visibles(), ['vista-lista']);
    assert.equal(el('sg-volver').hidden, true);
    assert.equal(cuantas(el('sg-filas').innerHTML, /<tr>/g), 6);
    assert.match(el('sg-filtros').innerHTML, /data-filtro="vencidos" aria-pressed="true"/);
    assert.equal(el('sg-vacio').hidden, true);
    assert.equal(cuantas(el('sg-sugerencias').innerHTML, /<option /g), 14);
  });

  it('con id: el dataset, y además la lista para las sugerencias', async () => {
    const { pagina, el, visibles, pedidos } = preparar({ id: '52', respuestas: { '/seguimiento/52': DE(52), '/seguimiento': LISTA() } });
    await pagina.iniciarSeguimiento();
    assert.deepEqual(pedidos.sort(), ['GET /seguimiento', 'GET /seguimiento/52']);
    assert.deepEqual(visibles(), ['vista-dataset']);
    assert.equal(el('sg-volver').hidden, false);
    assert.ok(el('sg-ficha').innerHTML.includes('Directores Generales de Planta Permanente'));
    assert.ok(el('sg-circuito').innerHTML.includes('6 avisos'));
    assert.equal(el('sg-circuito-vencimiento').textContent, 'Desde la actualización del 04/02/2026 · Vencimiento del 31/07/2026');
    assert.ok(el('sg-cinta').innerHTML.startsWith('<svg class="sg-cinta-svg"'));
    assert.ok(el('sg-leyenda').innerHTML.includes('Nota Digital a DGMIT'));
    assert.equal(cuantas(el('sg-movimientos').innerHTML, /<li class="sg-mov">/g), 10);
    assert.equal(el('sg-mas').hidden, false);
    assert.equal(el('sg-mas').textContent, 'Ver los 6 anteriores');
    assert.equal(el('sg-buscar').value, 'Directores Generales de Planta Permanente');
    assert.equal(cuantas(el('sg-sugerencias').innerHTML, /<option /g), 14);
    assert.equal(pagina.document.title, 'Directores Generales de Planta Permanente - Seguimiento - RPAD');
  });

  it('cambiar de filtro vuelve a 10 filas', async () => {
    const { pagina, el } = preparar({ id: '9', respuestas: { '/seguimiento/9': DE(9), '/seguimiento': LISTA() } });
    await pagina.cargarDataset('9');
    const vista = vm.runInContext('vista', pagina);
    const filas = () => cuantas(el('sg-movimientos').innerHTML, /<li class="sg-mov">/g);
    assert.equal(filas(), 10);
    pagina.verMasMovimientos();
    assert.equal(vista.visibles, 30);
    assert.equal(filas(), 18);
    assert.equal(el('sg-mas').hidden, true);
    pagina.elegirFiltroDeMovimientos('avisos');
    assert.equal(vista.filtroMov, 'avisos');
    assert.equal(vista.visibles, 10);
    assert.equal(filas(), 10);
    assert.match(el('sg-filtros-mov').innerHTML, /data-filtro="avisos" aria-pressed="true">Avisos a DGMIT <b>11<\/b>/);
    assert.equal(el('sg-mas').hidden, false);
    assert.equal(el('sg-mas').textContent, 'Ver el anterior');
    // Un filtro que no existe no cambia nada
    pagina.elegirFiltroDeMovimientos('otro');
    assert.equal(vista.filtroMov, 'avisos');
  });

  it('cuatro estados: 404 → not-found; 500 → sg-error; el dibujo roto → sg-error', async () => {
    const encontrado = preparar({ id: '52', respuestas: { '/seguimiento/52': DE(52) } });
    assert.deepEqual(encontrado.visibles(), ['loading'], 'cargando, al abrir');
    await encontrado.pagina.cargarDataset('52');
    assert.deepEqual(encontrado.visibles(), ['vista-dataset']);

    const noEncontrado = preparar({ id: '999999', errores: { '/seguimiento/999999': conEstado(404) } });
    await noEncontrado.pagina.cargarDataset('999999');
    assert.deepEqual(noEncontrado.visibles(), ['not-found']);
    assert.equal(noEncontrado.pagina.document.title, 'Dataset no encontrado - Seguimiento - RPAD');

    for (const error of [conEstado(500), new TypeError('Failed to fetch')]) {
      const caido = preparar({ id: '52', errores: { '/seguimiento/52': error } });
      await caido.pagina.cargarDataset('52');
      assert.deepEqual(caido.visibles(), ['sg-error'], error.message);
    }

    const roto = preparar({ id: '52', respuestas: { '/seguimiento/52': DE(52) } });
    roto.pagina.htmlDeFicha = () => { throw new TypeError('dato raro'); };
    await roto.pagina.cargarDataset('52');
    assert.deepEqual(roto.visibles(), ['sg-error']);
    assert.equal(roto.pagina.document.title, 'No se pudo cargar el seguimiento - RPAD');

    const raro = preparar({ id: '52', respuestas: { '/seguimiento/52': { success: true, data: { total: 3 } } } });
    await raro.pagina.cargarDataset('52');
    assert.deepEqual(raro.visibles(), ['sg-error'], 'una respuesta que no es un seguimiento');

    const lista = preparar({ errores: { '/seguimiento': conEstado(500) } });
    await lista.pagina.cargarLista();
    assert.deepEqual(lista.visibles(), ['sg-error'], 'la lista también');
  });

  it('el id va codificado en la ruta', async () => {
    const { pagina, pedidos, visibles } = preparar({ id: '1/../usuarios', errores: { '/seguimiento/1%2F..%2Fusuarios': conEstado(404) } });
    await pagina.cargarDataset('1/../usuarios');
    assert.deepEqual(pedidos, ['GET /seguimiento/1%2F..%2Fusuarios']);
    assert.deepEqual(visibles(), ['not-found']);
  });

  it('descarta la respuesta vieja si llegó otra después', async () => {
    let soltar;
    const lenta = new Promise((resolver) => { soltar = resolver; });
    const { pagina, el } = preparar({ respuestas: { '/seguimiento/1': () => lenta, '/seguimiento/52': DE(52) } });
    const primera = pagina.cargarDataset('1');
    await pagina.cargarDataset('52');
    soltar(DE(1));
    await primera;
    assert.ok(el('sg-ficha').innerHTML.includes('Directores Generales de Planta Permanente'));
    assert.ok(!el('sg-ficha').innerHTML.includes('Presupuesto Municipal'));
  });

  it('en la lista, el buscador filtra en vivo y avisa si no hay ninguno', async () => {
    const { pagina, el } = preparar({ respuestas: { '/seguimiento': LISTA() } });
    await pagina.cargarLista();
    pagina.alEscribirEnElBuscador({ target: { value: 'parque' } });
    assert.equal(cuantas(el('sg-filas').innerHTML, /<tr>/g), 1);
    pagina.alEscribirEnElBuscador({ target: { value: 'pauta' } });
    assert.equal(cuantas(el('sg-filas').innerHTML, /<tr>/g), 0);
    assert.equal(el('sg-vacio').hidden, false);
    assert.match(el('sg-filtros').innerHTML, /Actualizados <b>1<\/b>/);
  });

  it('elegir una sugerencia que coincide exacto abre su seguimiento', async () => {
    const { pagina } = preparar({ respuestas: { '/seguimiento': LISTA() } });
    await pagina.cargarLista();
    pagina.alEscribirEnElBuscador({ target: { value: 'Pauta Publicitaria — Subsecretaría de Comunicación' } });
    assert.equal(pagina.window.location.href, 'seguimiento.html?id=10');
  });
});

describe('seguimiento.js: lenguaje neutro', () => {
  it('lenguaje neutro en todo el HTML de los 14 casos', () => {
    for (const id of IDS) {
      const s = seguimientoDe(f(id), HOY);
      const html = [
        ctx.htmlDeFicha(s.ficha), ctx.htmlDelCircuito(s.circuito), ctx.svgDeCinta(s.cinta),
        ctx.htmlDeMovimientos(ctx.itemsDeLaLista(s.movimientos, s.hitos, 'todos'), Infinity, { esAdmin: true }),
        ctx.htmlDeFilaDeLista(resumenParaLista(f(id), HOY))
      ].join('');
      // La única excepción: el asunto original de un email, que se cita tal cual en su detalle
      const sinAsuntos = html.replace(/<dd class="sg-asunto">[^<]*<\/dd>/g, '');
      assert.doesNotMatch(sinAsuntos, /sin entregar|sin respuesta|atrasad/i, `caso ${id}`);
    }
    const s52 = seguimientoDe(f(52), HOY);
    assert.ok(ctx.htmlDeMovimientos(ctx.itemsDeLaLista(s52.movimientos, s52.hitos, 'todos'), Infinity, {}).includes('Resumen Mensual: Sin Respuesta (Externos)'));
  });

  it('la página no dice "sin entregar" ni "sin respuesta" en su HTML estático', () => {
    assert.doesNotMatch(leer('seguimiento.html'), /sin entregar|sin respuesta|atrasad/i);
    assert.doesNotMatch(leer('js/seguimiento.js'), /sin entregar|sin respuesta|atrasad/i);
  });
});
