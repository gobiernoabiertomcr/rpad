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
import { seguimientoDe, resumenParaLista, nombreDelPdf, conNotasDgmitEditables } from '../services/seguimientoReglas.js';
import { textoRequiereNota } from '../services/requiereNotaReglas.js';
import {
  TEXTO_TIPO_NOTA_DGMIT, MENSAJES_NOTA_DGMIT, LARGO_NUMERO, LARGO_MOTIVO, FECHA_MINIMA, validarNotaDgmit, validarMotivo
} from '../services/notasDgmitReglas.js';

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
    assert.ok(html.includes('class="sg-flecha fuera"') && html.includes('Pendiente de carga'));
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
    for (const texto of ['Nota Digital a DGMIT', 'Email a DGMIT', 'Email al área', 'Nota DGMIT al área', 'Actualización', 'Actualización pendiente',
      'Cambio en la ficha', 'Cambio pendiente', 'Propuesta rechazada', 'Alta', 'Vencido']) assert.ok(html.includes(`</i>${texto}</span>`), texto);
    assert.equal(cuantas(html, /aria-hidden="true"/g), 11);
  });
});

describe('seguimiento.js: los movimientos', () => {
  const s52 = seguimientoDe(f(52), HOY);
  const items52 = ctx.itemsDeLaLista(s52.movimientos, s52.hitos, 'todos');

  it('los filtros, en orden y con sus textos', () => {
    assert.deepEqual(plano(vm.runInContext('FILTROS_MOVIMIENTOS', ctx)), [['todos', 'Todos'], ['avisos', 'Avisos a DGMIT'], ['area', 'Emails al área'],
      ['dgmit', 'Notas DGMIT'], ['actualizaciones', 'Actualizaciones'], ['cambios', 'Cambios en la ficha'], ['propuestas', 'Propuestas'],
      ['auditoria', 'Notas de auditoría'], ['altas', 'Alta y baja']]);
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

// Notas DGMIT (spec 2026-10-24-notas-dgmit, 6): la columna de la lista, el tramo del circuito, la marca de la cinta, el filtro y el
// detalle del movimiento, con lo que arma el servidor (seguimientoDe sobre los casos más `notasDgmit`, y conNotasDgmitEditables según
// quién mira, como GET /api/seguimiento/:id)
describe('seguimiento.js: las notas DGMIT', () => {
  // Una nota DGMIT como la da fuentesDe: `por` y los `por` del historial con el nombre completo (el servidor los acorta)
  const notaDgmit = (datos) => ({
    id: 1, numero: '156/26', tipo: 'solicitud', recibida: '2026-10-15', anulada: false, cargada: '2026-10-16 09:30:00',
    por: 'Diego Martín Cuatro', por_id: 7, datasets: [{ id: 58, titulo: 'Áreas específicas de género' }], historial: [], ...datos
  });
  const conNotasDgmit = (id, notasDgmit, dataset = {}) => ({ ...f(id), dataset: { ...CASOS[id].dataset, ...dataset }, notasDgmit });
  // El seguimiento como lo manda el servidor a quien mira (por defecto, quien cargó las notas: el usuario 7)
  const comoLoVe = (fuentes, quien = { usuarioId: 7 }) => conNotasDgmitEditables(seguimientoDe(fuentes, HOY), quien);
  const dgmitDe = (seguimiento) => seguimiento.movimientos.filter((m) => m.tipo === 'dgmit');
  const AREA_58 = CASOS[58].dataset.area;
  const HOTELERIA = { id: 25, titulo: 'Hotelería en Comodoro Rivadavia' };
  const CORRECCION = { accion: 'correccion', motivo: 'Faltaba un dataset', por: 'Elena Noelia Cuatro', momento: '2026-10-17 10:00:00' };
  const ANULACION = { accion: 'anulacion', motivo: 'Se cargó dos veces', por: 'Elena Noelia Cuatro', momento: '2026-10-18 09:30:00' };
  // Cada botón con un nombre accesible propio: "Corregir la nota DGMIT N° 156/26" (ruling R6)
  const BOTON = (accion, texto, id = 1, numero = '156/26') =>
    `<button type="button" class="sg-link" data-accion="${accion}" data-nota="${id}" aria-label="${texto} la nota DGMIT N° ${numero}">${texto}</button>`;

  it('la lista tiene la columna Última nota DGMIT al área: con nota y con —', () => {
    // El encabezado: la columna nueva va al final, y cada fila tiene tantas celdas como columnas
    const thead = leer('seguimiento.html').match(/<thead>([\s\S]*?)<\/thead>/)[1];
    const columnas = [...thead.matchAll(/<th scope="col">([^<]*)<\/th>/g)].map((m) => m[1]);
    assert.deepEqual(columnas, ['Dataset y área', 'Vencimiento', 'Vencido hace', 'Avisos a DGMIT en el ciclo', 'Último aviso', 'Última nota DGMIT al área']);
    const conNota = ctx.htmlDeFilaDeLista(resumenParaLista(conNotasDgmit(58, [notaDgmit({})]), HOY));
    assert.equal(cuantas(conNota, /<td[ >]/g), columnas.length);
    assert.match(conNota, /<td class="nota-dgmit"><b>N° 156\/26<\/b><small>Solicitud, recibida el 15\/10\/2026<\/small><\/td>\s*<\/tr>$/);
    const reiteracion = ctx.htmlDeFilaDeLista(resumenParaLista(conNotasDgmit(58, [notaDgmit({ tipo: 'reiteracion', numero: '305/26' })]), HOY));
    assert.ok(reiteracion.includes('<td class="nota-dgmit"><b>N° 305/26</b><small>Reiteración, recibida el 15/10/2026</small></td>'));
    // Sin nota (o con la nota anulada), una raya
    for (const fila of [resumenParaLista(f(52), HOY), resumenParaLista(conNotasDgmit(58, [notaDgmit({ anulada: true })]), HOY)]) {
      const html = ctx.htmlDeFilaDeLista(fila);
      assert.equal(cuantas(html, /<td[ >]/g), columnas.length);
      assert.match(html, /<td class="nota-dgmit">—<\/td>\s*<\/tr>$/);
    }
    // Lo que manda el servidor tal cual: con un tipo que no conoce, sin el tipo; con algo raro, la raya
    assert.ok(ctx.htmlDeFilaDeLista({ ...resumenParaLista(f(52), HOY), nota_dgmit: { numero: '9/26', tipo: 'otra', recibida: '2026-10-01' } })
      .includes('<td class="nota-dgmit"><b>N° 9/26</b><small>Recibida el 01/10/2026</small></td>'));
    for (const raro of [null, undefined, 'x', {}, { numero: '  ' }]) {
      assert.match(ctx.htmlDeFilaDeLista({ ...resumenParaLista(f(52), HOY), nota_dgmit: raro }), /<td class="nota-dgmit">—<\/td>/, String(raro));
    }
  });

  it('el circuito con nota usa sg-flecha registrada; sin nota, fuera, con Pendiente de carga', () => {
    const con = ctx.htmlDelCircuito(comoLoVe(conNotasDgmit(58, [notaDgmit({})])).circuito);
    assert.ok(con.includes('<div class="sg-flecha registrada"><div class="n">Nota DGMIT N° 156/26</div><div class="l" aria-hidden="true"></div>'
      + '<div class="c">Solicitud recibida por el área el 15/10/2026, hace 5 días</div></div>'));
    assert.ok(!con.includes('sg-flecha fuera'));
    assert.equal(cuantas(con, /class="sg-flecha"/g), 1, 'el tramo de los avisos sigue igual');
    const sin = ctx.htmlDelCircuito(seguimientoDe(f(52), HOY).circuito);
    assert.ok(sin.includes('<div class="sg-flecha fuera"><div class="n">Nota formal</div><div class="l" aria-hidden="true"></div><div class="c">Pendiente de carga</div></div>'));
    assert.ok(!sin.includes('registrada'));
    // Solo el true literal: cualquier otra cosa es el tramo punteado
    for (const registrada of ['true', 1, null, undefined]) {
      assert.ok(ctx.htmlDelCircuito({ tramoFuera: { titulo: 'Nota formal', texto: 'Pendiente de carga', registrada } }).includes('class="sg-flecha fuera"'), String(registrada));
    }
  });

  it('el filtro Notas DGMIT aparece con su cantidad, después de Emails al área', () => {
    // Cuenta también las anuladas
    const s = comoLoVe(conNotasDgmit(52, [notaDgmit({ datasets: [] }), notaDgmit({ id: 2, numero: '151/26', recibida: '2026-10-10', anulada: true, datasets: [] })]));
    const html = ctx.htmlDeFiltrosDeMovimientos(s.movimientos, 'todos');
    const botones = [...html.matchAll(/data-filtro="([^"]+)" aria-pressed="(?:true|false)">([^<]+) <b>(\d+)<\/b>/g)].map((m) => [m[1], m[2], Number(m[3])]);
    assert.deepEqual(botones, [['todos', 'Todos', 18], ['avisos', 'Avisos a DGMIT', 9], ['area', 'Emails al área', 2], ['dgmit', 'Notas DGMIT', 2],
      ['actualizaciones', 'Actualizaciones', 2], ['propuestas', 'Propuestas', 2], ['altas', 'Alta y baja', 1]]);
    // Sin notas DGMIT, el botón no aparece; elegido, sí (con 0)
    assert.ok(!ctx.htmlDeFiltrosDeMovimientos(seguimientoDe(f(52), HOY).movimientos, 'todos').includes('Notas DGMIT'));
    assert.ok(ctx.htmlDeFiltrosDeMovimientos(seguimientoDe(f(52), HOY).movimientos, 'dgmit').includes('data-filtro="dgmit" aria-pressed="true">Notas DGMIT <b>0</b>'));
    // El filtro deja solo las notas DGMIT (sin hitos)
    const items = ctx.itemsDeLaLista(s.movimientos, s.hitos, 'dgmit');
    assert.deepEqual(plano(items.map((i) => i.movimiento.extra.numero)), ['156/26', '151/26']);
  });

  it('la leyenda incluye Nota DGMIT al área', () => {
    assert.deepEqual(plano(vm.runInContext('LEYENDA_CINTA', ctx)).map(([tipo]) => tipo),
      ['nota', 'email', 'area', 'dgmit', 'act', 'actp', 'cambio', 'cambiop', 'rech', 'alta', 'vencido']);
    assert.ok(ctx.htmlDeLeyenda().includes('<span><i class="mk mk-dgmit" aria-hidden="true"></i>Nota DGMIT al área</span>'));
  });

  it('el ícono de la cinta de una nota DGMIT', () => {
    assert.equal(ctx.iconoDeCinta('dgmit', 100, 92), '<rect x="95" y="85.5" width="10" height="13" rx="1.5" class="i-dgmit"/>');
    assert.equal(ctx.iconoDeCinta('dgmit', 500.123, 92), '<rect x="495.12" y="85.5" width="10" height="13" rx="1.5" class="i-dgmit"/>');
    // En la cinta del dataset: una marca en la fila de abajo (y = 92), con su <title>; la anulada no tiene marca
    const svg = ctx.svgDeCinta(comoLoVe(conNotasDgmit(58, [notaDgmit({}), notaDgmit({ id: 2, numero: '151/26', recibida: '2026-08-10', anulada: true })])).cinta);
    assert.equal(cuantas(svg, /class="i-dgmit"/g), 1);
    assert.match(svg, /<title>15\/10\/2026: Nota DGMIT N° 156\/26 al área: solicitud<\/title><rect x="[\d.]+" y="85.5" width="10" height="13" rx="1.5" class="i-dgmit"\/>/);
    // La marca de la lista y de la leyenda
    assert.ok(vm.runInContext('TIPOS_DE_MARCA', ctx).includes('dgmit'));
  });

  it('el detalle de una nota DGMIT: filas, correcciones y botones solo si editable', () => {
    const fuentes = conNotasDgmit(58, [notaDgmit({ datasets: [{ id: 58, titulo: 'Áreas específicas de género' }, HOTELERIA],
      historial: [{ ...CORRECCION, momento: '2026-10-19 11:20:00', motivo: 'El número estaba mal escrito (decía 165/26).' }, CORRECCION] })]);
    const [m] = dgmitDe(comoLoVe(fuentes));
    const html = ctx.htmlDeMovimiento(m, 0, {});
    assert.match(html, /^<li class="sg-mov"><button type="button" class="sg-fila"/);
    assert.ok(html.includes('<i class="mk mk-dgmit" aria-hidden="true"></i><span><span class="q">Nota DGMIT N° 156/26 al área: solicitud</span>'));
    assert.ok(html.includes('<span class="p">Cargó Diego Cuatro</span>'));
    const pares = [...html.matchAll(/<dt>([^<]*)<\/dt><dd>(.*?)<\/dd>/g)].map((par) => [par[1], par[2]]);
    assert.deepEqual(pares, [
      ['Número de nota DGMIT', '156/26'],
      ['Tipo de nota', 'Solicitud: la primera vez que se le piden los datos al área'],
      ['Recibida por el área', '15/10/2026'],
      ['Área', AREA_58],
      ['Datasets de la nota', 'Áreas específicas de género<br>Hotelería en Comodoro Rivadavia'],
      ['Cargada', '16/10/2026 a las 09:30, por Diego Cuatro'],
      ['Corregida', '19/10/2026 a las 11:20, por Elena Cuatro: El número estaba mal escrito (decía 165/26).'],
      ['Corregida', '17/10/2026 a las 10:00, por Elena Cuatro: Faltaba un dataset']
    ]);
    // Quien la cargó (o administración) ve Corregir y Anular, con el id de la nota
    assert.ok(html.includes(`<div class="sg-acciones-nota">${BOTON('corregir-nota', 'Corregir')}${BOTON('anular-nota', 'Anular')}`));
    const admin = ctx.htmlDeMovimiento(dgmitDe(comoLoVe(fuentes, { usuarioId: 99, administracion: true }))[0], 0, {});
    assert.ok(admin.includes(BOTON('corregir-nota', 'Corregir')) && admin.includes(BOTON('anular-nota', 'Anular')));
    // Otro usuario (o una respuesta sin `editable`) no ve los botones
    for (const otro of [dgmitDe(comoLoVe(fuentes, { usuarioId: 99 }))[0], { ...m, extra: { ...m.extra, editable: undefined } },
      { ...m, extra: { ...m.extra, editable: 'true' } }]) {
      const sinBotones = ctx.htmlDeMovimiento(otro, 0, { esAdmin: true });
      assert.ok(!sinBotones.includes('data-accion=') && !sinBotones.includes('sg-acciones-nota'));
      assert.ok(sinBotones.includes('<dt>Número de nota DGMIT</dt><dd>156/26</dd>'));
    }
    // Una reiteración, sin quién la cargó y sin correcciones
    const reiteracion = ctx.htmlDeMovimiento(dgmitDe(comoLoVe(conNotasDgmit(58, [notaDgmit({ tipo: 'reiteracion', por: null, por_id: null })])))[0], 0, {});
    assert.ok(reiteracion.includes('<dt>Tipo de nota</dt><dd>Reiteración: ya se le habían pedido y se le vuelven a pedir</dd>'));
    assert.ok(reiteracion.includes('<dt>Cargada</dt><dd>16/10/2026 a las 09:30</dd>'));
    assert.ok(!reiteracion.includes('Corregida') && !reiteracion.includes('data-accion='));
  });

  it('la anulada: li con clase anulada, sin botones, con la fila Anulada', () => {
    const fuentes = conNotasDgmit(58, [notaDgmit({ anulada: true, historial: [ANULACION, CORRECCION] })]);
    // La ve administración (editable): igual no tiene botones
    const [m] = dgmitDe(comoLoVe(fuentes, { usuarioId: 7, administracion: true }));
    assert.equal(m.extra.editable, true);
    const html = ctx.htmlDeMovimiento(m, 2, {});
    assert.match(html, /^<li class="sg-mov anulada"><button type="button" class="sg-fila" aria-expanded="false" aria-controls="sg-cuerpo-2">/);
    assert.ok(html.includes('<span class="d">Recibida por el área el 15/10/2026. Anulada el 18/10/2026 por Elena Cuatro: Se cargó dos veces.</span>'));
    assert.ok(!html.includes('data-accion=') && !html.includes('sg-acciones-nota'));
    // La fila "Anulada", en rojo y negrita como en la maqueta (ruling R6): su <dd> lleva la clase motivo-anulacion
    assert.ok(html.includes('<dt>Anulada</dt><dd class="motivo-anulacion">18/10/2026 a las 09:30, por Elena Cuatro: Se cargó dos veces</dd>'
      + '<dt>Corregida</dt><dd>17/10/2026 a las 10:00, por Elena Cuatro: Faltaba un dataset</dd>'));
    assert.match(leer('seguimiento.html'), /\.sg-cuerpo dd\.motivo-anulacion \{ color: var\(--sg-rojo\); font-weight: 600; \}/);
    // Las que no están anuladas, y los demás movimientos, siguen sin la clase
    assert.match(ctx.htmlDeMovimiento(dgmitDe(comoLoVe(conNotasDgmit(58, [notaDgmit({})])))[0], 0, {}), /^<li class="sg-mov">/);
    assert.ok(!ctx.htmlDeMovimiento({ ...seguimientoDe(f(52), HOY).movimientos[0], extra: { anulada: true } }, 0, {}).includes('anulada'));
    // En la lista, con las demás
    const lista = ctx.htmlDeMovimientos(ctx.itemsDeLaLista(comoLoVe(fuentes).movimientos, [], 'dgmit'), 10, {});
    assert.equal(cuantas(lista, /<li class="sg-mov anulada">/g), 1);
  });

  it('TIPOS_NOTA_DGMIT del navegador = TEXTO_TIPO_NOTA_DGMIT del servidor', () => {
    assert.deepEqual(plano(vm.runInContext('TIPOS_NOTA_DGMIT', ctx)), { ...TEXTO_TIPO_NOTA_DGMIT });
    assert.deepEqual(plano(vm.runInContext('TIPOS_NOTA_DGMIT_LARGOS', ctx)), {
      solicitud: 'Solicitud: la primera vez que se le piden los datos al área',
      reiteracion: 'Reiteración: ya se le habían pedido y se le vuelven a pedir'
    });
    // Cada texto largo empieza con el nombre del tipo
    for (const [tipo, texto] of Object.entries(TEXTO_TIPO_NOTA_DGMIT)) {
      assert.ok(vm.runInContext('TIPOS_NOTA_DGMIT_LARGOS', ctx)[tipo].startsWith(`${texto}: `), tipo);
    }
  });

  it('un texto con < > & en el número o el motivo llega escapado', () => {
    const raro = '<img src=x onerror=alert(1)> & "co"';
    const fuentes = conNotasDgmit(58, [notaDgmit({ numero: raro, datasets: [{ id: 58, titulo: 'Áreas específicas de género' }, { id: 9, titulo: '<b>Otro</b>' }],
      historial: [{ ...CORRECCION, motivo: '<script>x</script> & y' }] })]);
    const s = comoLoVe(fuentes);
    const html = [ctx.htmlDeMovimiento(dgmitDe(s)[0], 0, {}), ctx.htmlDelCircuito(s.circuito), ctx.svgDeCinta(s.cinta),
      ctx.htmlDeFilaDeLista(resumenParaLista(fuentes, HOY))].join('');
    assert.ok(!html.includes('<img') && !html.includes('<script') && !html.includes('<b>Otro'));
    assert.ok(html.includes('<dt>Número de nota DGMIT</dt><dd>&lt;img src=x onerror=alert(1)&gt; &amp; &quot;co&quot;</dd>'));
    assert.ok(html.includes('por Elena Cuatro: &lt;script&gt;x&lt;/script&gt; &amp; y</dd>'));
    assert.ok(html.includes('Áreas específicas de género<br>&lt;b&gt;Otro&lt;/b&gt;</dd>'));
    assert.ok(html.includes('<td class="nota-dgmit"><b>N° &lt;img src=x onerror=alert(1)&gt; &amp; &quot;co&quot;</b>'));
    assert.ok(html.includes('class="n">Nota DGMIT N° &lt;img src=x onerror=alert(1)&gt; &amp; &quot;co&quot;</div>'));
    // El nombre accesible de los botones, también escapado
    assert.ok(html.includes('aria-label="Corregir la nota DGMIT N° &lt;img src=x onerror=alert(1)&gt; &amp; &quot;co&quot;">Corregir</button>'));
    assert.ok(html.includes('aria-label="Anular la nota DGMIT N° &lt;img src=x onerror=alert(1)&gt; &amp; &quot;co&quot;">Anular</button>'));
    // Lo que no pasa por el servidor también: el área, quién, el id de la nota y el momento
    const directo = ctx.htmlDeMovimiento({ tipo: 'dgmit', filtro: 'dgmit', fecha: '2026-10-15', titulo: 't', quien: [], extra: {
      nota_id: '1" onclick="x', numero: '1', tipo: 'solicitud', recibida: '2026-10-15', anulada: false, cargada: '<b>', por: '<i>Ana</i>',
      area: '<u>Área</u>', datasets: [{ id: 1, titulo: 'a & b' }], historial: [{ accion: 'correccion', motivo: 'm', por: '<i>X</i>', momento: '2026-10-16 10:00:00' }],
      editable: true } }, 0, {});
    assert.ok(!directo.includes('<i>') && !directo.includes('<u>') && !directo.includes('" onclick'));
    assert.ok(directo.includes('data-nota="1&quot; onclick=&quot;x"'));
    assert.ok(directo.includes('<dt>Área</dt><dd>&lt;u&gt;Área&lt;/u&gt;</dd>') && directo.includes('<dd>a &amp; b</dd>'));
    assert.ok(directo.includes('<dt>Cargada</dt><dd>—, por &lt;i&gt;Ana&lt;/i&gt;</dd>'));
    // Datos raros: no tira error
    assert.doesNotThrow(() => ctx.htmlDeMovimiento({ tipo: 'dgmit', extra: null }, 0, {}));
    assert.doesNotThrow(() => ctx.htmlDeMovimiento({ tipo: 'dgmit', extra: { datasets: 'x', historial: [null, 'x', {}] } }, 0, {}));
  });
});

// Cargar, corregir y anular notas DGMIT (spec 2026-10-24-notas-dgmit, 2 y 3): lo puro del formulario y del modal de anular, con las
// filas de la lista de "Sin elegir" que arma el servidor (resumenParaLista)
describe('seguimiento.js: el formulario de las notas DGMIT', () => {
  const ids = (filas) => plano(filas.map((fila) => fila.id)).sort((a, b) => a - b);
  // De los casos, los externos activos (todos sin dato en «Requiere nota DGMIT»): 11; vencidos o próximos: 7
  const ELEGIBLES = [1, 9, 10, 11, 25, 33, 42, 52, 58, 61, 81];
  const INICIALES = [1, 11, 33, 52, 58, 61, 81];
  const conNota = (filas, id, nota) => filas.map((fila) => (fila.id === id ? { ...fila, nota_dgmit: nota } : fila));

  it('MENSAJES_NOTA_DGMIT del navegador = los del servidor', () => {
    assert.deepEqual(plano(vm.runInContext('MENSAJES_NOTA_DGMIT', ctx)), { ...MENSAJES_NOTA_DGMIT });
    assert.equal(vm.runInContext('LARGO_NUMERO_NOTA_DGMIT', ctx), LARGO_NUMERO);
    assert.equal(vm.runInContext('LARGO_MOTIVO_NOTA_DGMIT', ctx), LARGO_MOTIVO);
    assert.equal(vm.runInContext('FECHA_MINIMA_NOTA_DGMIT', ctx), FECHA_MINIMA);
    assert.ok(vm.runInContext('Object.isFrozen(MENSAJES_NOTA_DGMIT)', ctx));
  });

  it('datasetsParaElegir: deja afuera internos, No e inactivos; incluir los suma', () => {
    const filas = [...filasDeLosCasos(),
      { id: 200, titulo: 'Con No', area: 'A', tipo_gestion: 'externa', requiere_nota: 0, activo: true, estado: 'vencido', dias: -5 },
      { id: 201, titulo: 'Dado de baja', area: 'A', tipo_gestion: 'externa', requiere_nota: 1, activo: false, estado: 'baja', dias: null },
      { id: 202, titulo: 'Con Sí', area: 'A', tipo_gestion: 'externa', requiere_nota: 1, activo: true, estado: 'proximo', dias: 3 },
      { id: 203, titulo: 'Sin gestión', area: 'A', tipo_gestion: null, requiere_nota: null, activo: true, estado: 'proximo', dias: 3 }];
    assert.deepEqual(ids(ctx.datasetsParaElegir(filas)), [...ELEGIBLES, 202]);
    // Los de la nota que se corrige se suman aunque hoy no se puedan elegir (el id, como número o como texto)
    assert.deepEqual(ids(ctx.datasetsParaElegir(filas, [200, '26', 201, 999])), [...ELEGIBLES, 26, 200, 201, 202].sort((a, b) => a - b));
    // Cada fila una sola vez, en el orden en que llegan
    assert.deepEqual(plano(ctx.datasetsParaElegir(filas, [1, 1, '1']).map((f) => f.id)).filter((id) => id === 1), [1]);
    for (const raro of [null, undefined, 'x', {}, [null, 'x', { titulo: 'sin id', tipo_gestion: 'externa' }]]) {
      assert.deepEqual(plano(ctx.datasetsParaElegir(raro, null)), [], String(raro));
    }
  });

  it('estaEnElAlcanceInicial: los vencidos y los próximos a vencer', () => {
    assert.deepEqual(ids(filasDeLosCasos().filter((fila) => ctx.estaEnElAlcanceInicial(fila))), [1, 11, 26, 33, 52, 58, 61, 81]);
    for (const estado of ['actualizado', 'eventual', 'sin-fecha', 'baja', 'atrasado', null]) assert.equal(ctx.estaEnElAlcanceInicial({ estado }), false, String(estado));
    assert.equal(ctx.estaEnElAlcanceInicial(null), false);
  });

  it('textoDeEstadoDeOpcion para vencido, próximo, actualizado, sin fecha y eventual', () => {
    const fila = (id) => filasDeLosCasos().find((f) => f.id === id);
    assert.deepEqual(plano(ctx.textoDeEstadoDeOpcion(fila(52))), ['vencido', 'Vencido hace 81 días']);
    assert.deepEqual(plano(ctx.textoDeEstadoDeOpcion(fila(81))), ['proximo', 'Vence en 11 días']);
    assert.deepEqual(plano(ctx.textoDeEstadoDeOpcion(fila(9))), ['', 'Vence el 31/01/2027']);
    assert.deepEqual(plano(ctx.textoDeEstadoDeOpcion(fila(66))), ['', 'Sin vencimiento']);
    assert.deepEqual(plano(ctx.textoDeEstadoDeOpcion({ estado: 'sin-fecha', dias: null, proxima: null })), ['', 'Sin fecha']);
    // Un día, en singular; el día del vencimiento, "Vence hoy"
    assert.deepEqual(plano(ctx.textoDeEstadoDeOpcion({ estado: 'vencido', dias: -1 })), ['vencido', 'Vencido hace 1 día']);
    assert.deepEqual(plano(ctx.textoDeEstadoDeOpcion({ estado: 'proximo', dias: 1 })), ['proximo', 'Vence en 1 día']);
    assert.deepEqual(plano(ctx.textoDeEstadoDeOpcion({ estado: 'proximo', dias: 0 })), ['proximo', 'Vence hoy']);
    // Uno que la nota ya tenía y se dio de baja
    assert.deepEqual(plano(ctx.textoDeEstadoDeOpcion({ estado: 'baja', dias: null })), ['', 'Dado de baja']);
    for (const raro of [null, {}, { estado: 'otro' }]) assert.deepEqual(plano(ctx.textoDeEstadoDeOpcion(raro)), ['', '—'], JSON.stringify(raro));
  });

  it('htmlDeOpcionesDeNota: agrupado por área en orden, con los elegidos marcados y los textos escapados', () => {
    const MUJER = 'Secretaría de la Mujer, Género y Diversidad';
    const ECONOMIA = 'Secretaría de Economía, Finanzas y Control de Gestión';
    const filas = [...ctx.datasetsParaElegir(filasDeLosCasos()),
      { id: 300, titulo: 'Zonas', area: MUJER, tipo_gestion: 'externa', requiere_nota: 1, activo: true, estado: 'actualizado', dias: 90, proxima: '2027-01-31' },
      { id: 301, titulo: 'Gasto Público', area: ECONOMIA, tipo_gestion: 'externa', requiere_nota: null, activo: true, estado: 'vencido', dias: -83 }];
    const html = ctx.htmlDeOpcionesDeNota(filas, [52, '58']);
    const areas = [...html.matchAll(/<div class="sg-grupo" data-area="([^"]*)">/g)].map((m) => m[1]);
    assert.deepEqual(areas, ['Agencia de Acceso a la Información Pública', 'Dirección de Estadística y Evaluación Educativa',
      'Dirección de Información Tributaria. Dirección General de Análisis y Administración Tributaria', 'Dirección General de Habilitaciones Comerciales',
      'Dirección General de Relaciones Laborales', 'Dirección General de Servicios Administrativos', 'Dirección General de Sueldos',
      'Ente Autárquico Comodoro Turismo', ECONOMIA, MUJER, 'Subsecretaría de Comunicación']);
    assert.equal(cuantas(html, /<div class="sg-grupo-area">/g), 11);
    // Los títulos, por orden alfabético en español (la Á va con la A)
    const valores = [...html.matchAll(/<input type="checkbox" value="(\d+)"/g)].map((m) => Number(m[1]));
    assert.deepEqual(valores, [9, 42, 11, 61, 52, 33, 81, 25, 301, 1, 58, 300, 10]);
    // Cada opción: la casilla (value = id, data-titulo), el título, el estado y la marca de alcance; los elegidos, marcados
    assert.ok(html.includes('<label class="sg-opcion elegida" data-inicial="1"><input type="checkbox" value="52" data-titulo="Directores Generales de Planta Permanente" checked>'
      + '<span class="t">Directores Generales de Planta Permanente</span><span class="e vencido">Vencido hace 81 días</span></label>'));
    assert.ok(html.includes('<label class="sg-opcion elegida" data-inicial="1"><input type="checkbox" value="58" data-titulo="Áreas específicas de género" checked>'
      + '<span class="t">Áreas específicas de género</span><span class="e proximo">Vence en 41 días</span></label>'));
    assert.ok(html.includes('<label class="sg-opcion" data-inicial="0"><input type="checkbox" value="9" data-titulo="Pedidos de Acceso a la Información Pública">'
      + '<span class="t">Pedidos de Acceso a la Información Pública</span><span class="e">Vence el 31/01/2027</span></label>'));
    assert.equal(cuantas(html, / checked>/g), 2);
    // Escapa el título y el área; sin área, "Sin área"
    const raro = ctx.htmlDeOpcionesDeNota([{ id: 7, titulo: '<b>x</b> & "y"', area: '<i>A</i>', estado: 'vencido', dias: -2 }, { id: 8, titulo: 'Sola', area: null, estado: 'eventual' }], []);
    assert.ok(!raro.includes('<b>') && !raro.includes('<i>'));
    assert.ok(raro.includes('data-area="&lt;i&gt;A&lt;/i&gt;"') && raro.includes('<div class="sg-grupo-area">&lt;i&gt;A&lt;/i&gt;</div>'));
    assert.ok(raro.includes('data-titulo="&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;"') && raro.includes('<span class="t">&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;</span>'));
    assert.ok(raro.includes('<div class="sg-grupo-area">Sin área</div>'));
    assert.equal(ctx.htmlDeOpcionesDeNota([], []), '');
    assert.equal(ctx.htmlDeOpcionesDeNota(null, null), '');
  });

  it('el alcance: "Vencidos y próximos a vencer" (el inicial) y "Todos", con su cantidad y la búsqueda sin tildes ni mayúsculas', () => {
    const filas = ctx.datasetsParaElegir(filasDeLosCasos());
    assert.deepEqual(ids(ctx.opcionesDeNota(filas, 'inicial', '')), INICIALES);
    assert.deepEqual(ids(ctx.opcionesDeNota(filas, 'todos', '')), ELEGIBLES);
    assert.deepEqual(ids(ctx.opcionesDeNota(filas, 'todos', '  AREAS especificas ')), [58]);
    assert.deepEqual(ids(ctx.opcionesDeNota(filas, 'todos', 'turismo')), [25], 'también por el área');
    assert.deepEqual(ids(ctx.opcionesDeNota(filas, 'inicial', 'turismo')), []);
    assert.deepEqual(plano(ctx.cantidadesDeAlcance(filas, '')), { inicial: 7, todos: 11 });
    assert.deepEqual(plano(ctx.cantidadesDeAlcance(filas, 'turismo')), { inicial: 0, todos: 1 });
    const chips = ctx.htmlDeAlcanceDeNota({ inicial: 7, todos: 11 }, 'inicial');
    assert.equal(chips, '<button type="button" class="sg-chip" data-alcance="inicial" aria-pressed="true">Vencidos y próximos a vencer <b>7</b></button>'
      + '<button type="button" class="sg-chip" data-alcance="todos" aria-pressed="false">Todos <b>11</b></button>');
    assert.match(ctx.htmlDeAlcanceDeNota({}, 'todos'), /data-alcance="todos" aria-pressed="true">Todos <b>0<\/b>/);
    // Sin opciones: qué decir
    assert.equal(ctx.textoSinOpcionesDeNota('xyz', 'inicial'), 'Ningún dataset coincide con lo que buscaste. Si es uno que todavía no vence, buscalo en «Todos».');
    assert.equal(ctx.textoSinOpcionesDeNota('xyz', 'todos'), 'Ningún dataset coincide con lo que buscaste.');
    assert.equal(ctx.textoSinOpcionesDeNota('  ', 'inicial'), 'No hay datasets vencidos ni próximos a vencer. Los demás están en «Todos».');
    assert.equal(ctx.textoSinOpcionesDeNota('', 'todos'), 'No hay datasets de gestión externa que requieran nota DGMIT.');
  });

  it('alcanceInicialDeNota: en "Todos" si algún elegido no está en el alcance inicial', () => {
    const filas = ctx.datasetsParaElegir(filasDeLosCasos());
    assert.equal(ctx.alcanceInicialDeNota(filas, []), 'inicial');
    assert.equal(ctx.alcanceInicialDeNota(filas, [52]), 'inicial');
    assert.equal(ctx.alcanceInicialDeNota(filas, ['52', 58]), 'inicial');
    assert.equal(ctx.alcanceInicialDeNota(filas, [52, 9]), 'todos', '9 vence el 31/01/2027');
    assert.equal(ctx.alcanceInicialDeNota(filas, [999]), 'todos', 'uno que no está en la lista');
  });

  it('htmlDeElegidos con 0, 1 y 2', () => {
    const filas = ctx.datasetsParaElegir(filasDeLosCasos());
    assert.equal(ctx.htmlDeElegidos(filas, []), '<span>Todavía no elegiste ningún dataset.</span>');
    assert.equal(ctx.htmlDeElegidos(filas, [52]), '<span>1 dataset elegido:</span><span class="sg-elegido">Directores Generales de Planta Permanente'
      + '<button type="button" data-quitar="52" aria-label="Quitar Directores Generales de Planta Permanente">×</button></span>');
    // Dos, en el orden de la lista (por área y por título), no en el de la elección
    const dos = ctx.htmlDeElegidos(filas, ['58', 52]);
    assert.ok(dos.startsWith('<span>2 datasets elegidos:</span>'));
    assert.deepEqual([...dos.matchAll(/data-quitar="(\d+)"/g)].map((m) => m[1]), ['52', '58']);
    assert.ok(dos.includes('aria-label="Quitar Áreas específicas de género">×</button>'));
    // Un id que no está entre las filas no cuenta; los textos, escapados
    assert.equal(ctx.htmlDeElegidos(filas, [999]), '<span>Todavía no elegiste ningún dataset.</span>');
    const raro = ctx.htmlDeElegidos([{ id: 3, titulo: '<b>"x"</b>', area: 'A' }], [3]);
    assert.ok(!raro.includes('<b>') && raro.includes('&lt;b&gt;&quot;x&quot;&lt;/b&gt;<button') && raro.includes('aria-label="Quitar &lt;b&gt;&quot;x&quot;&lt;/b&gt;"'));
  });

  it('textoDePistaDeSolicitud: con Solicitud y un dataset con nota en el ciclo; con Reiteración, vacío; excluye el número que se corrige', () => {
    let filas = ctx.datasetsParaElegir(filasDeLosCasos());
    filas = conNota(filas, 58, { numero: '156/26', tipo: 'solicitud', recibida: '2026-10-15' });
    filas = conNota(filas, 61, { numero: '305/26', tipo: 'reiteracion', recibida: '2026-10-19' });
    const REITERACION = 'Si se le vuelven a pedir los datos, es una reiteración.';
    assert.equal(ctx.textoDePistaDeSolicitud(filas, [58, 52], 'solicitud'),
      `«Áreas específicas de género» ya tiene la nota DGMIT N° 156/26 (solicitud, recibida el 15/10/2026) en este ciclo.\n${REITERACION}`);
    // Con más de uno, un renglón por dataset, en el orden de la lista
    assert.equal(ctx.textoDePistaDeSolicitud(filas, ['58', '61'], 'solicitud'),
      '«Comercios habilitados por rubro» ya tiene la nota DGMIT N° 305/26 (reiteración, recibida el 19/10/2026) en este ciclo.\n'
      + `«Áreas específicas de género» ya tiene la nota DGMIT N° 156/26 (solicitud, recibida el 15/10/2026) en este ciclo.\n${REITERACION}`);
    // Con Reiteración (o sin tipo), nada; sin nota en el ciclo, nada
    for (const tipo of ['reiteracion', '', null]) assert.equal(ctx.textoDePistaDeSolicitud(filas, [58, 61], tipo), '', String(tipo));
    assert.equal(ctx.textoDePistaDeSolicitud(filas, [52, 1], 'solicitud'), '');
    assert.equal(ctx.textoDePistaDeSolicitud(filas, [], 'solicitud'), '');
    // La nota que se corrige no cuenta (sin importar mayúsculas ni los espacios de los extremos)
    assert.equal(ctx.textoDePistaDeSolicitud(filas, [58], 'solicitud', '156/26'), '');
    const conLetras = conNota(filas, 58, { numero: 'DGMIT-156/26', tipo: 'solicitud', recibida: '2026-10-15' });
    assert.equal(ctx.textoDePistaDeSolicitud(conLetras, [58], 'solicitud', ' dgmit-156/26 '), '');
    assert.ok(ctx.textoDePistaDeSolicitud(filas, [58, 61], 'solicitud', '156/26').startsWith('«Comercios habilitados por rubro» ya tiene'));
    // Es texto plano (va con textContent): el título no se escapa; un tipo desconocido no se nombra
    const raro = [{ id: 4, titulo: '<b>x</b>', area: 'A', nota_dgmit: { numero: '1/26', tipo: 'otra', recibida: '2026-10-01' } }];
    assert.equal(ctx.textoDePistaDeSolicitud(raro, [4], 'solicitud'), `«<b>x</b>» ya tiene la nota DGMIT N° 1/26 (recibida el 01/10/2026) en este ciclo.\n${REITERACION}`);
    assert.equal(ctx.textoDePistaDeSolicitud([{ id: 4, titulo: 'x', nota_dgmit: { numero: '  ' } }], [4], 'solicitud'), '');
  });

  it('erroresDelFormularioDeNota da lo mismo que validarNotaDgmit en los casos de borde', () => {
    const VALIDA = { numero: '156/26', recibida: '2026-10-22', tipo: 'solicitud', datasets: [12] };
    // Los casos de tests/notas-dgmit-reglas.test.js
    const cambios = [
      {}, { numero: '' }, { numero: '   ' }, { numero: '\t \n' }, { numero: '  N° 156 / 26  ' }, { numero: 'A'.repeat(40) },
      { numero: `   ${'A'.repeat(40)}   ` }, { numero: 'A'.repeat(41) }, { numero: `A${' '.repeat(39)}B` }, { numero: 'Ñ°'.repeat(20) },
      { numero: '𝟙'.repeat(40) }, { numero: '𝟙'.repeat(41) }, { numero: 156 }, { numero: null }, { numero: undefined },
      ...['2025-01-01', '2026-10-24', '2024-12-31', '2026-10-25', '2027-01-01', '2026-02-30', '22/10/2026', '2026-10-22 ', ' 2026-10-22',
        '2026-10-22T00:00:00', '2026-1-5', '2026-13-01', '2026-00-10', '2026-10-00', '0000-01-01', '1900-02-29', '2000-02-29', '2028-02-29',
        '', null, undefined, 20261022].map((recibida) => ({ recibida })),
      ...['reiteracion', 'Solicitud', 'SOLICITUD', ' solicitud', 'reiteración', 'otro', 'autorizacion', 'constructor', 'toString', '',
        1, true, ['solicitud'], {}, null].map((tipo) => ({ tipo })),
      // Con huecos ([, 7], new Array(2)): un hueco es undefined, no un id
      ...[[], '5', [0], [-1], ['a'], [1.5], ['7', 7, 8], [7, 'x'], ['0'], ['-1'], ['1.5'], ['1e3'], [' 7'], ['7 '], [''], [null], [undefined],
        [true], [NaN], [Infinity], [Number.MAX_SAFE_INTEGER + 1], ['9007199254740993'], [[7]], [{}], {}, { 0: 7, length: 1 }, 7, null,
        ['007', Number.MAX_SAFE_INTEGER], [, 7], new Array(2)].map((datasets) => ({ datasets })),
      { numero: '', recibida: '', tipo: '', datasets: [] }, { numero: 156, recibida: 20261022, tipo: 1, datasets: 'abc' }
    ];
    for (const hoy of ['2026-10-24', '2028-03-01', undefined, null, '', '24/10/2026', 20261024]) {
      for (const cambio of cambios) {
        const entrada = { ...VALIDA, ...cambio };
        const esperado = validarNotaDgmit(entrada, hoy).errores;
        assert.deepEqual(plano(ctx.erroresDelFormularioDeNota(entrada, { hoy })), esperado, `${String(hoy)} ${JSON.stringify(cambio)}`);
        assert.deepEqual(plano(ctx.erroresDelFormularioDeNota(entrada, { hoy, conMotivo: false })), esperado);
      }
    }
    // Entradas que no son un objeto: los cuatro errores, como el servidor
    for (const entrada of [null, undefined, 'texto', 5, true, []]) {
      assert.deepEqual(plano(ctx.erroresDelFormularioDeNota(entrada, { hoy: '2026-10-24' })), validarNotaDgmit(entrada, '2026-10-24').errores, String(entrada));
    }
    assert.deepEqual(plano(ctx.erroresDelFormularioDeNota(VALIDA)), validarNotaDgmit(VALIDA).errores, 'sin hoy no pasa');
    // El motivo, con conMotivo: el error de validarMotivo, con la misma clave que el servidor
    for (const motivo of ['', '   ', '\n\t', 'm'.repeat(500), `  ${'m'.repeat(500)}  `, 'm'.repeat(501), '  El número estaba mal  ', '𝟙'.repeat(500),
      '𝟙'.repeat(501), null, undefined, 5, true, {}, ['motivo']]) {
      const errores = plano(ctx.erroresDelFormularioDeNota({ ...VALIDA, motivo }, { hoy: '2026-10-24', conMotivo: true }));
      const { error } = validarMotivo(motivo);
      assert.deepEqual(errores, error ? { motivo: error } : {}, JSON.stringify(motivo));
      assert.equal(ctx.errorDeMotivoDeNota(motivo), error, JSON.stringify(motivo));
      // Sin conMotivo, el motivo no se mira (la carga no lo lleva)
      assert.deepEqual(plano(ctx.erroresDelFormularioDeNota({ ...VALIDA, motivo }, { hoy: '2026-10-24' })), {});
    }
    // Los errores van en el orden de los campos del formulario, el mismo con el que el servidor elige el primero
    assert.deepEqual(plano(Object.keys(ctx.erroresDelFormularioDeNota({}, { hoy: '2026-10-24', conMotivo: true }))), ['numero', 'recibida', 'tipo', 'datasets', 'motivo']);
  });

  it('los textos del formulario según el modo, el cuerpo que se manda y el texto de anular', () => {
    assert.deepEqual(plano(ctx.textosDelFormularioDeNota('cargar')), {
      titulo: 'Cargar nota DGMIT', boton: 'Guardar nota', pie: 'Se guarda al confirmar y queda registrado quién la cargó y cuándo.'
    });
    assert.deepEqual(plano(ctx.textosDelFormularioDeNota('corregir', '156/26')), {
      titulo: 'Corregir nota DGMIT N° 156/26', boton: 'Guardar corrección',
      pie: 'Se guarda al confirmar. Queda registrado quién la corrigió, cuándo, por qué y qué decía antes.'
    });
    // El cuerpo: el número y el motivo sin los espacios de los extremos, los datasets como números, sin repetidos
    assert.deepEqual(plano(ctx.cuerpoDeLaNota({ numero: ' 156/26 ', recibida: '2026-10-15', tipo: 'solicitud', datasets: ['58', 25, '58'], motivo: ' x ' }, false)),
      { numero: '156/26', recibida: '2026-10-15', tipo: 'solicitud', datasets: [58, 25] });
    assert.deepEqual(plano(ctx.cuerpoDeLaNota({ numero: '156/26', recibida: '2026-10-15', tipo: 'reiteracion', datasets: [58], motivo: '  Estaba mal  ' }, true)),
      { numero: '156/26', recibida: '2026-10-15', tipo: 'reiteracion', datasets: [58], motivo: 'Estaba mal' });
    // Anular: "de su dataset" con uno, "de sus N datasets" con más
    assert.equal(ctx.textoDeConfirmarAnulacion('156/26', 1),
      '¿Anular la nota DGMIT N° 156/26? Deja de contar en el Seguimiento de su dataset, pero no se borra: queda en los movimientos, tachada y con el motivo.');
    assert.equal(ctx.textoDeConfirmarAnulacion('156/26', 3),
      '¿Anular la nota DGMIT N° 156/26? Deja de contar en el Seguimiento de sus 3 datasets, pero no se borra: queda en los movimientos, tachada y con el motivo.');
  });

  it('conLosDatasetsDeLaNota: un dataset de la nota que no está en la lista se suma, para que corregir no lo saque sin querer', () => {
    const filas = filasDeLosCasos();
    const juntas = ctx.conLosDatasetsDeLaNota(filas, [{ id: 58, titulo: 'Áreas específicas de género' }, { id: 500, titulo: 'Otro' }, null, { titulo: 'sin id' }]);
    assert.equal(juntas.length, filas.length + 1);
    assert.deepEqual(plano(juntas.at(-1)), { id: 500, titulo: 'Otro', area: null, tipo_gestion: null, requiere_nota: null, activo: true,
      estado: null, dias: null, proxima: null, nota_dgmit: null });
    assert.deepEqual(ids(ctx.datasetsParaElegir(juntas, [58, 500])), [...ELEGIBLES, 500]);
    assert.equal(ctx.conLosDatasetsDeLaNota(filas, null).length, filas.length);
  });

  it('cargar la página no hace nada en el vm', () => {
    // Un document sin nada más que addEventListener: si el script tocara el DOM al cargarse, tiraría error
    const registrados = [];
    assert.doesNotThrow(() => cargar({ document: { addEventListener: (tipo) => registrados.push(tipo) } }));
    assert.deepEqual(registrados, ['DOMContentLoaded']);
  });

  it('la página tiene el botón Cargar nota DGMIT oculto, el formulario y el modal de anular, con sus ids', () => {
    const html = leer('seguimiento.html');
    // El botón, en el encabezado, junto al título, oculto hasta que el script lo muestre
    const cabecera = html.match(/<div class="page-header">([\s\S]*?)<\/div>\s*<p class="sg-bajada">/)[1];
    assert.match(cabecera, /<button type="button" class="sg-btn sg-btn-tinta" id="sg-cargar-nota" hidden>[\s\S]*Cargar nota DGMIT<\/button>/);
    // Cada id, una sola vez en la página
    const todos = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(todos).size, todos.length, 'ids repetidos');
    for (const id of ['modal-nota', 'modal-nota-titulo', 'nd-numero', 'nd-numero-error', 'nd-fecha', 'nd-fecha-error', 'nd-tipos', 'nd-tipo-solicitud',
      'nd-tipo-reiteracion', 'nd-tipo-error', 'nd-buscar', 'nd-alcance', 'nd-opciones', 'nd-elegidos', 'nd-datasets-error', 'nd-pista', 'nd-motivo-grupo',
      'nd-motivo', 'nd-motivo-error', 'nd-pie', 'nd-guardar', 'modal-anular', 'modal-anular-titulo', 'an-texto', 'an-motivo', 'an-motivo-error', 'an-confirmar']) {
      assert.ok(todos.includes(id), id);
    }
    // Los diálogos, como los de administración: role, aria-modal y el título
    assert.match(html, /<div class="modal-overlay" id="modal-nota">\s*<div class="modal sg-modal" role="dialog" aria-modal="true" aria-labelledby="modal-nota-titulo">/);
    assert.match(html, /<div class="modal-overlay" id="modal-anular">\s*<div class="modal sg-modal sg-modal-chico" role="dialog" aria-modal="true" aria-labelledby="modal-anular-titulo">/);
    // Los campos, con sus límites, obligatorios y con su ayuda y su error unidos
    assert.match(html, /<input type="text" id="nd-numero" class="form-input" maxlength="40" placeholder="Ej\.: 156\/26" autocomplete="off" aria-required="true" aria-describedby="nd-numero-ayuda nd-numero-error">/);
    assert.match(html, /<input type="date" id="nd-fecha" class="form-input" min="2025-01-01" aria-required="true" aria-describedby="nd-fecha-ayuda nd-fecha-error">/);
    assert.equal(cuantas(html, /<input type="radio" name="nd-tipo" id="nd-tipo-(solicitud|reiteracion)" value="\1" aria-describedby="nd-tipo-error">/g), 2);
    assert.match(html, /<input type="search" id="nd-buscar" [^>]*aria-describedby="nd-datasets-ayuda nd-datasets-error">/);
    assert.match(html, /<textarea id="nd-motivo" class="form-input" rows="2" maxlength="500" aria-required="true" aria-describedby="nd-motivo-error"><\/textarea>/);
    assert.match(html, /<textarea id="an-motivo" class="form-input" rows="3" maxlength="500" aria-required="true" aria-describedby="an-motivo-error"><\/textarea>/);
    assert.ok(html.includes('<div class="form-group sg-motivo" id="nd-motivo-grupo" hidden>'));
    for (const texto of ['Número de nota DGMIT', 'Como figura en la nota.', 'Fecha de recepción', 'El día en que el área recibió la nota.', 'Tipo de nota',
      '<b>Solicitud</b><small>La primera vez que se le piden los datos al área.</small>', '<b>Reiteración</b><small>Ya se le habían pedido y se le vuelven a pedir.</small>',
      'Datasets asociados', 'Motivo de la corrección', 'Motivo de la anulación', '>Guardar nota</button>', '>Anular nota</button>',
      'Se guarda al confirmar y queda registrado quién la cargó y cuándo.']) {
      assert.ok(html.includes(texto), texto);
    }
    assert.match(html, /<button type="button" class="sg-btn sg-btn-rojo" id="an-confirmar">Anular nota<\/button>/);
    // El foco visible de los modales: anillo --tinta de 3 px con halo --sol-fuerte
    assert.match(html, /\.sg-modal :focus-visible \{ outline: 3px solid var\(--tinta\); outline-offset: 2px; box-shadow: 0 0 0 5px var\(--sol-fuerte\); \}/);
    // Los modales van fuera del contenido, antes de los scripts
    assert.ok(html.indexOf('id="modal-nota"') > html.indexOf('</main>') && html.indexOf('id="modal-anular"') < html.indexOf('<script'));
  });
});

// La página con un DOM falso: cada id es un elemento (oculto, salvo #loading y #sg-volver, como en seguimiento.html), un
// API.pedirJson falso y el id de la URL. Cada elemento lleva lo que usan los modales de las notas DGMIT (classList, atributos,
// checked, disabled) y anota a quién va el foco
const elementoFalso = (id, alEnfocar = () => {}) => {
  const clases = new Set();
  const atributos = {};
  return {
    id, hidden: !['loading', 'sg-volver'].includes(id), innerHTML: '', textContent: '', value: '', checked: false, disabled: false,
    isConnected: true, dataset: {}, scrollTop: 0,
    classList: { add: (c) => clases.add(c), remove: (c) => clases.delete(c), contains: (c) => clases.has(c), toggle: (c, si = !clases.has(c)) => (si ? clases.add(c) : clases.delete(c), si) },
    setAttribute(nombre, valor) { atributos[nombre] = String(valor); }, removeAttribute(nombre) { delete atributos[nombre]; },
    getAttribute: (nombre) => atributos[nombre] ?? null,
    addEventListener() {}, insertAdjacentHTML(_donde, html) { this.innerHTML += html; }, querySelector: () => null, querySelectorAll: () => [],
    closest: () => null, focus() { alEnfocar(id); }
  };
};
const preparar = ({ id = null, respuestas = {}, errores = {}, esAdmin = false, puedeCargar = false } = {}) => {
  // setTimeout, en el acto: el foco del modal abierto se pone después de la transición
  const pagina = cargar({ setTimeout: (funcion) => { funcion(); return 0; } });
  const elementos = {};
  const pedidos = [];
  const cuerpos = [];
  const avisos = [];
  const enfocados = [];
  pagina.document.getElementById = (clave) => (elementos[clave] ??= elementoFalso(clave, (quien) => enfocados.push(quien)));
  pagina.console = { error() {} };
  pagina.Auth = { isAuthenticated: () => true, isAdmin: () => esAdmin, puedeCargarNotasDgmit: () => puedeCargar };
  pagina.Utils.getUrlParams = () => (id === null ? {} : { id });
  pagina.Utils.hoyEnArgentina = () => HOY;
  pagina.showToast = (mensaje, tipo) => avisos.push([tipo, mensaje]);
  vm.runInContext('API', pagina).pedirJson = async (metodo, ruta, cuerpo) => {
    pedidos.push(`${metodo} ${ruta}`);
    if (cuerpo !== undefined) cuerpos.push([`${metodo} ${ruta}`, plano(cuerpo)]);
    if (errores[ruta]) throw errores[ruta];
    return typeof respuestas[ruta] === 'function' ? respuestas[ruta]() : respuestas[ruta];
  };
  const el = (clave) => pagina.document.getElementById(clave);
  const ESTADOS = ['loading', 'vista-lista', 'vista-dataset', 'not-found', 'sg-error'];
  const visibles = () => ESTADOS.filter((clave) => !el(clave).hidden);
  return { pagina, el, visibles, pedidos, cuerpos, avisos, enfocados };
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

  it('Corregir y Anular de una nota DGMIT no descargan nada ni despliegan la fila; "Descargar la nota y su anexo" sí descarga', async () => {
    // Un botón falso con sus data-*; closest entiende los selectores de atributo de seguimiento.js (button[data-x] y button[data-x="v"])
    const boton = (datos) => ({
      dataset: datos, disabled: false,
      closest(selector) {
        const partes = /^button\[data-([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector);
        if (!partes) return null;
        const clave = partes[1].replace(/-([a-z])/g, (_, letra) => letra.toUpperCase());
        return Object.hasOwn(datos, clave) && (partes[2] === undefined || datos[clave] === partes[2]) ? this : null;
      }
    });
    const { pagina } = preparar({ esAdmin: true });
    const pedidas = [];
    pagina.showToast = () => {};
    const api = vm.runInContext('API', pagina);
    api.getNotaPdf = async (id) => { pedidas.push(id); throw new Error('sin servidor'); };
    for (const accion of ['corregir-nota', 'anular-nota']) {
      pagina.alTocarUnMovimiento({ target: boton({ accion, nota: '1' }) });
    }
    await new Promise((resolver) => setImmediate(resolver));
    assert.deepEqual(pedidas, []);
    pagina.alTocarUnMovimiento({ target: boton({ nota: '4', archivo: 'Nota-Digital-2-26.pdf' }) });
    await new Promise((resolver) => setImmediate(resolver));
    assert.deepEqual(pedidas, ['4']);
  });

  it('elegir una sugerencia que coincide exacto abre su seguimiento', async () => {
    const { pagina } = preparar({ respuestas: { '/seguimiento': LISTA() } });
    await pagina.cargarLista();
    pagina.alEscribirEnElBuscador({ target: { value: 'Pauta Publicitaria — Subsecretaría de Comunicación' } });
    assert.equal(pagina.window.location.href, 'seguimiento.html?id=10');
  });
});

// Cargar, corregir y anular desde la página (DOM falso): lo que se manda, los errores en su campo, el aviso y la recarga de la vista
describe('seguimiento.js: cargar, corregir y anular desde la página', () => {
  const activo = (el, id) => el(id).classList.contains('active');
  // Una casilla de la lista de datasets, marcada o desmarcada
  const marcar = (pagina, valor, checked = true) => pagina.alMarcarDataset({ target: { type: 'checkbox', value: String(valor), checked, closest: () => null } });
  // El seguimiento de 58 con la nota 156/26 (solicitud del 15/10, también para Hotelería, 25), como lo ve quien la cargó
  const NOTA = {
    id: 1, numero: '156/26', tipo: 'solicitud', recibida: '2026-10-15', anulada: false, cargada: '2026-10-16 09:30:00', por: 'Diego Martín Cuatro', por_id: 7,
    datasets: [{ id: 58, titulo: 'Áreas específicas de género' }, { id: 25, titulo: 'Hotelería en Comodoro Rivadavia' }], historial: []
  };
  const DE_58_CON_NOTA = () => ({ success: true, data: conNotasDgmitEditables(seguimientoDe({ ...f(58), notasDgmit: [NOTA] }, HOY), { usuarioId: 7 }) });
  const conCampo = (status, campo, mensaje) => Object.assign(new Error(mensaje), { status, campo });

  it('el botón Cargar nota DGMIT: oculto para el lector, visible para quien puede cargar', async () => {
    const lector = preparar({ respuestas: { '/seguimiento': LISTA() } });
    await lector.pagina.iniciarSeguimiento();
    assert.equal(lector.el('sg-cargar-nota').hidden, true);
    // El lector no abre nada, aunque llegue a llamar a las funciones
    await lector.pagina.abrirFormularioDeNota(lector.el('sg-cargar-nota'));
    lector.pagina.abrirAnulacion(lector.el('x'), '1');
    assert.ok(!activo(lector.el, 'modal-nota') && !activo(lector.el, 'modal-anular'));
    assert.deepEqual(lector.pedidos, ['GET /seguimiento']);
    const colaborador = preparar({ respuestas: { '/seguimiento': LISTA() }, puedeCargar: true });
    await colaborador.pagina.iniciarSeguimiento();
    assert.equal(colaborador.el('sg-cargar-nota').hidden, false);
  });

  // El link «Cargar nota DGMIT» de «Para completar», en Métricas (spec 2026-10-24-metricas-y-reportes, 2.2): seguimiento.html?id=N#cargar-nota
  it('abreLaCargaPorElHash: solo #cargar-nota y solo para quien puede cargar (el true literal)', () => {
    assert.equal(ctx.abreLaCargaPorElHash('#cargar-nota', true), true);
    for (const [hash, puede] of [['#cargar-nota', false], ['#cargar-nota', 'true'], ['#cargar-notas', true], ['cargar-nota', true], ['', true], [undefined, true]]) {
      assert.equal(ctx.abreLaCargaPorElHash(hash, puede), false, `${hash} ${puede}`);
    }
  });

  it('con #cargar-nota, el formulario abre con ese dataset elegido y el hash se va de la dirección; al lector no se le abre', async () => {
    const respuestas = { '/seguimiento/52': DE(52), '/seguimiento': LISTA() };
    const conHash = (preparado) => {
      const reemplazos = [];
      Object.assign(preparado.pagina.window.location, { pathname: '/seguimiento.html', search: '?id=52', hash: '#cargar-nota' });
      preparado.pagina.window.history = { replaceState: (_estado, _titulo, url) => reemplazos.push(url) };
      return reemplazos;
    };
    const colaborador = preparar({ id: '52', respuestas, puedeCargar: true });
    const reemplazos = conHash(colaborador);
    await colaborador.pagina.iniciarSeguimiento();
    assert.deepEqual(colaborador.visibles(), ['vista-dataset']);
    assert.ok(activo(colaborador.el, 'modal-nota'));
    assert.equal(colaborador.el('modal-nota-titulo').textContent, 'Cargar nota DGMIT');
    assert.ok(colaborador.el('nd-elegidos').innerHTML.startsWith('<span>1 dataset elegido:</span>'));
    assert.ok(colaborador.el('nd-elegidos').innerHTML.includes('Directores Generales de Planta Permanente'));
    assert.deepEqual(reemplazos, ['/seguimiento.html?id=52']);
    // El lector no ve el formulario (y la dirección no cambia)
    const lector = preparar({ id: '52', respuestas });
    const sinCambios = conHash(lector);
    await lector.pagina.iniciarSeguimiento();
    assert.deepEqual(lector.visibles(), ['vista-dataset']);
    assert.ok(!activo(lector.el, 'modal-nota'));
    assert.deepEqual(sinCambios, []);
    // Sin el hash, no se abre
    const sinHash = preparar({ id: '52', respuestas, puedeCargar: true });
    await sinHash.pagina.iniciarSeguimiento();
    assert.ok(!activo(sinHash.el, 'modal-nota'));
    // Un dataset que no existe: no encontrado, sin formulario
    const noExiste = preparar({ id: '999', errores: { '/seguimiento/999': conEstado(404) }, respuestas: { '/seguimiento': LISTA() }, puedeCargar: true });
    conHash(noExiste);
    await noExiste.pagina.iniciarSeguimiento();
    assert.deepEqual(noExiste.visibles(), ['not-found']);
    assert.ok(!activo(noExiste.el, 'modal-nota'));
  });

  it('cargar desde la lista: abre con los vencidos y próximos, valida en el navegador y guarda con POST', async () => {
    const mensaje = 'Nota DGMIT N° 9/26 (solicitud) cargada en 1 dataset.';
    const { pagina, el, pedidos, cuerpos, avisos, enfocados } = preparar({ puedeCargar: true,
      respuestas: { '/seguimiento': LISTA(), '/notas-dgmit': { success: true, data: { id: 3 }, message: mensaje } } });
    await pagina.iniciarSeguimiento();
    await pagina.abrirFormularioDeNota(el('sg-cargar-nota'));
    assert.ok(activo(el, 'modal-nota'));
    assert.equal(el('modal-nota-titulo').textContent, 'Cargar nota DGMIT');
    assert.equal(el('nd-guardar').textContent, 'Guardar nota');
    assert.equal(el('nd-pie').textContent, 'Se guarda al confirmar y queda registrado quién la cargó y cuándo.');
    assert.equal(el('nd-motivo-grupo').hidden, true);
    assert.equal(el('nd-fecha').max, HOY);
    assert.match(el('nd-alcance').innerHTML, /data-alcance="inicial" aria-pressed="true">Vencidos y próximos a vencer <b>7<\/b>/);
    assert.match(el('nd-alcance').innerHTML, /data-alcance="todos" aria-pressed="false">Todos <b>11<\/b>/);
    assert.equal(cuantas(el('nd-opciones').innerHTML, /type="checkbox"/g), 7);
    assert.equal(el('nd-elegidos').innerHTML, '<span>Todavía no elegiste ningún dataset.</span>');
    assert.equal(enfocados.at(-1), 'nd-numero', 'el foco, al primer campo');
    // "Todos" y la búsqueda
    pagina.elegirAlcanceDeNota('todos');
    assert.equal(cuantas(el('nd-opciones').innerHTML, /type="checkbox"/g), 11);
    el('nd-buscar').value = 'RELACIONES laborales';
    pagina.dibujarOpcionesDeNota();
    assert.equal(cuantas(el('nd-opciones').innerHTML, /type="checkbox"/g), 1);
    el('nd-buscar').value = 'xyz';
    pagina.dibujarOpcionesDeNota();
    assert.equal(el('nd-opciones').innerHTML, '<p class="sg-sin-opciones">Ningún dataset coincide con lo que buscaste.</p>');

    // Sin nada: los cuatro errores en sus campos, el foco al primero y ningún pedido
    await pagina.guardarNotaDgmit();
    assert.deepEqual(pedidos, ['GET /seguimiento']);
    assert.equal(el('nd-numero-error').textContent, 'Escribí el número de la nota.');
    assert.equal(el('nd-numero-error').hidden, false);
    assert.equal(el('nd-numero').getAttribute('aria-invalid'), 'true');
    assert.equal(el('nd-fecha-error').textContent, 'Elegí la fecha en que el área recibió la nota.');
    assert.equal(el('nd-tipo-error').textContent, 'Elegí si es una solicitud o una reiteración.');
    assert.equal(el('nd-tipo-solicitud').getAttribute('aria-invalid'), 'true');
    assert.ok(el('nd-tipos').classList.contains('invalido'));
    assert.equal(el('nd-datasets-error').textContent, 'Elegí al menos un dataset.');
    assert.ok(el('nd-opciones').classList.contains('invalido'));
    assert.equal(el('nd-motivo-error').hidden, true, 'la carga no pide motivo');
    assert.equal(enfocados.at(-1), 'nd-numero');
    // Una fecha posterior a hoy
    el('nd-numero').value = ' 9/26 ';
    el('nd-fecha').value = '2026-10-21';
    await pagina.guardarNotaDgmit();
    assert.equal(el('nd-numero-error').hidden, true);
    assert.equal(el('nd-numero').getAttribute('aria-invalid'), null);
    assert.equal(el('nd-fecha-error').textContent, 'La fecha de recepción no puede ser posterior a hoy.');
    assert.equal(enfocados.at(-1), 'nd-fecha');

    // Completo: POST con el número recortado y el dataset elegido
    el('nd-fecha').value = '2026-10-15';
    el('nd-tipo-solicitud').checked = true;
    pagina.alElegirTipoDeNota();
    marcar(pagina, 52);
    assert.ok(el('nd-elegidos').innerHTML.startsWith('<span>1 dataset elegido:</span>'));
    assert.equal(el('nd-datasets-error').hidden, true, 'elegir uno saca el error');
    await pagina.guardarNotaDgmit();
    assert.deepEqual(cuerpos, [['POST /notas-dgmit', { numero: '9/26', recibida: '2026-10-15', tipo: 'solicitud', datasets: [52] }]]);
    assert.deepEqual(avisos, [['success', mensaje]]);
    assert.ok(!activo(el, 'modal-nota'));
    // La lista se vuelve a pedir
    assert.deepEqual(pedidos, ['GET /seguimiento', 'POST /notas-dgmit', 'GET /seguimiento']);
  });

  it('un error del servidor con campo va a ese campo; sin campo, un aviso; el aviso de éxito se escapa', async () => {
    const repetido = 'Ya hay una nota DGMIT N° 9/26 cargada. Para sumarle datasets o cambiar algo, corregila.';
    const llenar = (pagina, el) => {
      el('nd-numero').value = '9/26';
      el('nd-fecha').value = '2026-10-15';
      el('nd-tipo-reiteracion').checked = true;
      marcar(pagina, 52);
    };
    const conRepetido = preparar({ puedeCargar: true, respuestas: { '/seguimiento': LISTA() }, errores: { '/notas-dgmit': conCampo(409, 'numero', repetido) } });
    await conRepetido.pagina.iniciarSeguimiento();
    await conRepetido.pagina.abrirFormularioDeNota(conRepetido.el('sg-cargar-nota'));
    llenar(conRepetido.pagina, conRepetido.el);
    await conRepetido.pagina.guardarNotaDgmit();
    assert.equal(conRepetido.el('nd-numero-error').textContent, repetido);
    assert.equal(conRepetido.el('nd-numero').getAttribute('aria-invalid'), 'true');
    assert.equal(conRepetido.enfocados.at(-1), 'nd-numero');
    assert.ok(activo(conRepetido.el, 'modal-nota'), 'el formulario queda abierto');
    assert.deepEqual(conRepetido.avisos, []);
    assert.equal(conRepetido.el('nd-guardar').disabled, false);

    const sinPermiso = preparar({ puedeCargar: true, respuestas: { '/seguimiento': LISTA() },
      errores: { '/notas-dgmit': Object.assign(new Error('No tenés permiso <b>para</b> cargar notas DGMIT.'), { status: 403 }) } });
    await sinPermiso.pagina.iniciarSeguimiento();
    await sinPermiso.pagina.abrirFormularioDeNota(sinPermiso.el('sg-cargar-nota'));
    llenar(sinPermiso.pagina, sinPermiso.el);
    await sinPermiso.pagina.guardarNotaDgmit();
    assert.deepEqual(sinPermiso.avisos, [['error', 'No tenés permiso &lt;b&gt;para&lt;/b&gt; cargar notas DGMIT.']]);
    // Un 403 sin campo (quien mira ya no puede cargar): se cierra y se vuelve a pedir la lista
    assert.ok(!activo(sinPermiso.el, 'modal-nota'));
    assert.deepEqual(sinPermiso.pedidos, ['GET /seguimiento', 'POST /notas-dgmit', 'GET /seguimiento']);

    const raro = preparar({ puedeCargar: true, respuestas: { '/seguimiento': LISTA(), '/notas-dgmit': { success: true, message: 'Nota DGMIT N° <i>1</i> (reiteración) cargada en 1 dataset.' } } });
    await raro.pagina.iniciarSeguimiento();
    await raro.pagina.abrirFormularioDeNota(raro.el('sg-cargar-nota'));
    llenar(raro.pagina, raro.el);
    await raro.pagina.guardarNotaDgmit();
    assert.deepEqual(raro.avisos, [['success', 'Nota DGMIT N° &lt;i&gt;1&lt;/i&gt; (reiteración) cargada en 1 dataset.']]);
  });

  it('desde un dataset, abre con ese dataset elegido (y en Todos si no está en el alcance inicial); uno que no se puede elegir, ninguno', async () => {
    const abrir = async (id) => {
      const pagina = preparar({ id: String(id), puedeCargar: true, respuestas: { [`/seguimiento/${id}`]: DE(id), '/seguimiento': LISTA() } });
      await pagina.pagina.iniciarSeguimiento();
      await pagina.pagina.abrirFormularioDeNota(pagina.el('sg-cargar-nota'));
      return pagina;
    };
    const vencido = await abrir(52);
    assert.match(vencido.el('nd-alcance').innerHTML, /data-alcance="inicial" aria-pressed="true"/);
    assert.ok(vencido.el('nd-opciones').innerHTML.includes('value="52" data-titulo="Directores Generales de Planta Permanente" checked>'));
    assert.ok(vencido.el('nd-elegidos').innerHTML.startsWith('<span>1 dataset elegido:</span>'));
    const alDia = await abrir(9);
    assert.match(alDia.el('nd-alcance').innerHTML, /data-alcance="todos" aria-pressed="true"/);
    assert.ok(alDia.el('nd-opciones').innerHTML.includes('value="9" data-titulo="Pedidos de Acceso a la Información Pública" checked>'));
    const interna = await abrir(26);
    assert.match(interna.el('nd-alcance').innerHTML, /data-alcance="inicial" aria-pressed="true"/);
    assert.ok(!interna.el('nd-opciones').innerHTML.includes(' checked>'));
    assert.equal(interna.el('nd-elegidos').innerHTML, '<span>Todavía no elegiste ningún dataset.</span>');
  });

  it('la pista de solicitud repetida aparece al elegir Solicitud con un dataset que ya tiene nota en el ciclo', async () => {
    const filas = filasDeLosCasos().map((fila) => (fila.id === 58 ? { ...fila, nota_dgmit: { numero: '156/26', tipo: 'solicitud', recibida: '2026-10-15' } } : fila));
    const { pagina, el } = preparar({ puedeCargar: true, respuestas: { '/seguimiento': { success: true, data: filas } } });
    await pagina.iniciarSeguimiento();
    await pagina.abrirFormularioDeNota(el('sg-cargar-nota'));
    marcar(pagina, 58);
    assert.equal(el('nd-pista').hidden, true, 'sin tipo, nada');
    el('nd-tipo-solicitud').checked = true;
    pagina.alElegirTipoDeNota();
    assert.equal(el('nd-pista').hidden, false);
    assert.equal(el('nd-pista').textContent, '«Áreas específicas de género» ya tiene la nota DGMIT N° 156/26 (solicitud, recibida el 15/10/2026) en este ciclo.\n'
      + 'Si se le vuelven a pedir los datos, es una reiteración.');
    el('nd-tipo-solicitud').checked = false;
    el('nd-tipo-reiteracion').checked = true;
    pagina.alElegirTipoDeNota();
    assert.equal(el('nd-pista').hidden, true);
    assert.equal(el('nd-pista').textContent, '');
  });

  it('Corregir abre el formulario con los datos de la nota y guarda con PUT y el motivo', async () => {
    const { pagina, el, pedidos, cuerpos, avisos, enfocados } = preparar({ id: '58', puedeCargar: true, respuestas: {
      '/seguimiento/58': DE_58_CON_NOTA, '/seguimiento': LISTA(), '/notas-dgmit/1': { success: true, message: 'Nota DGMIT N° 156/27 corregida.' } } });
    await pagina.iniciarSeguimiento();
    const corregir = elementoFalso('corregir');
    pagina.alTocarUnMovimiento({ target: { closest: (selector) => (selector === 'button[data-accion="corregir-nota"]' ? Object.assign(corregir, { dataset: { accion: 'corregir-nota', nota: '1' } }) : null) } });
    await new Promise((resolver) => setImmediate(resolver));
    assert.ok(activo(el, 'modal-nota'));
    assert.equal(el('modal-nota-titulo').textContent, 'Corregir nota DGMIT N° 156/26');
    assert.equal(el('nd-guardar').textContent, 'Guardar corrección');
    assert.equal(el('nd-pie').textContent, 'Se guarda al confirmar. Queda registrado quién la corrigió, cuándo, por qué y qué decía antes.');
    assert.equal(el('nd-motivo-grupo').hidden, false);
    assert.equal(el('nd-numero').value, '156/26');
    assert.equal(el('nd-fecha').value, '2026-10-15');
    assert.equal(el('nd-tipo-solicitud').checked, true);
    assert.equal(el('nd-tipo-reiteracion').checked, false);
    // Los dos datasets de la nota, marcados; Hotelería todavía no vence: abre en "Todos"
    assert.match(el('nd-alcance').innerHTML, /data-alcance="todos" aria-pressed="true"/);
    assert.equal(cuantas(el('nd-opciones').innerHTML, / checked>/g), 2);
    assert.ok(el('nd-elegidos').innerHTML.startsWith('<span>2 datasets elegidos:</span>'));
    // La nota que se corrige no se avisa a sí misma
    assert.equal(el('nd-pista').hidden, true);
    // Sin motivo, no se manda
    await pagina.guardarNotaDgmit();
    assert.equal(el('nd-motivo-error').textContent, 'Escribí el motivo.');
    assert.equal(el('nd-motivo').getAttribute('aria-invalid'), 'true');
    assert.equal(enfocados.at(-1), 'nd-motivo');
    assert.ok(!pedidos.includes('PUT /notas-dgmit/1'));
    // Con el motivo: PUT con todo
    el('nd-numero').value = '156/27';
    el('nd-motivo').value = '  El número estaba mal  ';
    marcar(pagina, 25, false);
    await pagina.guardarNotaDgmit();
    assert.deepEqual(cuerpos, [['PUT /notas-dgmit/1', { numero: '156/27', recibida: '2026-10-15', tipo: 'solicitud', datasets: [58], motivo: 'El número estaba mal' }]]);
    assert.deepEqual(avisos, [['success', 'Nota DGMIT N° 156/27 corregida.']]);
    assert.ok(!activo(el, 'modal-nota'));
    // Vuelve a pedir el dataset y la lista; el foco, al botón del encabezado (el de "Corregir" se volvió a dibujar)
    assert.deepEqual(pedidos.slice(-2).sort(), ['GET /seguimiento', 'GET /seguimiento/58']);
    assert.equal(enfocados.at(-1), 'sg-cargar-nota');
  });

  it('Anular pide el motivo y anula con POST; Escape cierra sin mandar nada', async () => {
    const { pagina, el, pedidos, cuerpos, avisos, enfocados } = preparar({ id: '58', puedeCargar: true, respuestas: {
      '/seguimiento/58': DE_58_CON_NOTA, '/seguimiento': LISTA(), '/notas-dgmit/1/anular': { success: true, message: 'Nota DGMIT N° 156/26 anulada.' } } });
    await pagina.iniciarSeguimiento();
    const anular = elementoFalso('anular', (quien) => enfocados.push(quien));
    pagina.abrirAnulacion(anular, '1');
    assert.ok(activo(el, 'modal-anular'));
    assert.equal(el('modal-anular-titulo').textContent, 'Anular nota DGMIT N° 156/26');
    assert.equal(el('an-texto').textContent,
      '¿Anular la nota DGMIT N° 156/26? Deja de contar en el Seguimiento de sus 2 datasets, pero no se borra: queda en los movimientos, tachada y con el motivo.');
    assert.equal(enfocados.at(-1), 'an-motivo');
    // Escape cierra y el foco vuelve al botón
    pagina.alApretarEscape({ key: 'Escape' });
    assert.ok(!activo(el, 'modal-anular'));
    assert.equal(enfocados.at(-1), 'anular');
    // Sin motivo, no se manda
    pagina.abrirAnulacion(anular, '1');
    await pagina.confirmarAnulacion();
    assert.equal(el('an-motivo-error').textContent, 'Escribí el motivo.');
    assert.equal(el('an-motivo').getAttribute('aria-invalid'), 'true');
    assert.ok(!pedidos.some((p) => p.startsWith('POST')));
    el('an-motivo').value = ' Se cargó dos veces ';
    await pagina.confirmarAnulacion();
    assert.deepEqual(cuerpos, [['POST /notas-dgmit/1/anular', { motivo: 'Se cargó dos veces' }]]);
    assert.deepEqual(avisos, [['success', 'Nota DGMIT N° 156/26 anulada.']]);
    assert.ok(!activo(el, 'modal-anular'));
    assert.deepEqual(pedidos.slice(-2).sort(), ['GET /seguimiento', 'GET /seguimiento/58']);
    // Una nota que no está en la vista (o ya anulada) no abre nada
    pagina.abrirAnulacion(anular, '99');
    assert.ok(!activo(el, 'modal-anular'));
    // El formulario también se cierra con Escape (otra tecla no)
    await pagina.abrirFormularioDeNota(el('sg-cargar-nota'));
    assert.ok(activo(el, 'modal-nota'));
    pagina.alApretarEscape({ key: 'Enter' });
    assert.ok(activo(el, 'modal-nota'));
    pagina.alApretarEscape({ key: 'Escape' });
    assert.ok(!activo(el, 'modal-nota'));
  });

  // Un error del servidor sin campo. Con 403, 404 o 409 (alguien anuló la nota mientras tanto, o quien mira ya no puede corregirla) la
  // vista quedó vieja: el aviso, se cierra el modal y se vuelve a pedir la vista. Con otro (un 400 como «La corrección no cambia ningún
  // dato de la nota.», un 500 o sin conexión) el modal queda abierto y el foco vuelve al botón, ya habilitado (deshabilitado durante el
  // pedido, lo había soltado)
  const conFocoAnotado = (prueba, id) => {
    prueba.el(id).focus = function () { prueba.enfocados.push(this.disabled ? `${id} (deshabilitado)` : id); };
  };
  const corregirConFalla = async (falla) => {
    const prueba = preparar({ id: '58', puedeCargar: true,
      respuestas: { '/seguimiento/58': DE_58_CON_NOTA, '/seguimiento': LISTA() }, errores: { '/notas-dgmit/1': falla } });
    await prueba.pagina.iniciarSeguimiento();
    const corregir = Object.assign(elementoFalso('corregir'), { dataset: { accion: 'corregir-nota', nota: '1' } });
    prueba.pagina.alTocarUnMovimiento({ target: { closest: (selector) => (selector === 'button[data-accion="corregir-nota"]' ? corregir : null) } });
    await new Promise((resolver) => setImmediate(resolver));
    assert.ok(activo(prueba.el, 'modal-nota'));
    prueba.el('nd-motivo').value = 'Otra fecha';
    conFocoAnotado(prueba, 'nd-guardar');
    const antes = prueba.pedidos.length;
    await prueba.pagina.guardarNotaDgmit();
    return { ...prueba, nuevos: prueba.pedidos.slice(antes) };
  };
  const anularConFalla = async (falla) => {
    const prueba = preparar({ id: '58', puedeCargar: true,
      respuestas: { '/seguimiento/58': DE_58_CON_NOTA, '/seguimiento': LISTA() }, errores: { '/notas-dgmit/1/anular': falla } });
    await prueba.pagina.iniciarSeguimiento();
    prueba.pagina.abrirAnulacion(elementoFalso('anular'), '1');
    assert.ok(activo(prueba.el, 'modal-anular'));
    prueba.el('an-motivo').value = 'Se cargó dos veces';
    conFocoAnotado(prueba, 'an-confirmar');
    const antes = prueba.pedidos.length;
    await prueba.pagina.confirmarAnulacion();
    return { ...prueba, nuevos: prueba.pedidos.slice(antes) };
  };
  const VIEJAS = [
    [403, 'Solo quien cargó la nota o administración pueden corregirla o anularla.'],
    [404, 'Nota DGMIT no encontrada'],
    [409, 'La nota está anulada: no se puede corregir ni volver a anular.']
  ];

  it('corregir: un 400 sin campo deja el formulario abierto y el foco en el botón; un 403, 404 o 409 lo cierra y vuelve a pedir la vista', async () => {
    const mensaje = 'La corrección no cambia ningún dato de la nota.';
    const sinCambios = await corregirConFalla(Object.assign(new Error(mensaje), { status: 400 }));
    assert.deepEqual(sinCambios.avisos, [['error', mensaje]]);
    assert.ok(activo(sinCambios.el, 'modal-nota'), 'el formulario queda abierto');
    assert.equal(sinCambios.el('nd-guardar').disabled, false);
    assert.equal(sinCambios.enfocados.at(-1), 'nd-guardar', 'el foco vuelve al botón, ya habilitado');
    assert.deepEqual(sinCambios.nuevos, ['PUT /notas-dgmit/1'], 'no se vuelve a pedir la vista');
    // Lo mismo con un 500 o sin conexión (sin status)
    for (const falla of [conEstado(500), new Error('Failed to fetch')]) {
      const otra = await corregirConFalla(falla);
      assert.ok(activo(otra.el, 'modal-nota'));
      assert.equal(otra.enfocados.at(-1), 'nd-guardar');
      assert.deepEqual(otra.nuevos, ['PUT /notas-dgmit/1']);
    }
    for (const [status, texto] of VIEJAS) {
      const vieja = await corregirConFalla(Object.assign(new Error(texto), { status }));
      assert.deepEqual(vieja.avisos, [['error', texto]], `${status}`);
      assert.ok(!activo(vieja.el, 'modal-nota'), `${status}: se cierra`);
      assert.deepEqual(vieja.nuevos.slice(1).sort(), ['GET /seguimiento', 'GET /seguimiento/58'], `${status}: vuelve a pedir la vista`);
      assert.equal(vieja.enfocados.at(-1), 'sg-cargar-nota', `${status}: el foco, al botón del encabezado`);
    }
    // Con campo, como siempre: al campo, sin cerrar (el número repetido es un 409 con campo)
    const repetido = await corregirConFalla(Object.assign(new Error('Ya hay una nota DGMIT N° 9/26 cargada.'), { status: 409, campo: 'numero' }));
    assert.ok(activo(repetido.el, 'modal-nota'));
    assert.equal(repetido.el('nd-numero-error').textContent, 'Ya hay una nota DGMIT N° 9/26 cargada.');
    assert.equal(repetido.enfocados.at(-1), 'nd-numero');
    assert.deepEqual(repetido.avisos, []);
    assert.deepEqual(repetido.nuevos, ['PUT /notas-dgmit/1']);
  });

  it('anular: un error sin campo que no es 403, 404 ni 409 deja el modal abierto y el foco en Anular; esos lo cierran y vuelven a pedir la vista', async () => {
    const caida = await anularConFalla(conEstado(500));
    assert.deepEqual(caida.avisos, [['error', 'Error 500']]);
    assert.ok(activo(caida.el, 'modal-anular'));
    assert.equal(caida.el('an-confirmar').disabled, false);
    assert.equal(caida.enfocados.at(-1), 'an-confirmar', 'el foco vuelve al botón, ya habilitado');
    assert.deepEqual(caida.nuevos, ['POST /notas-dgmit/1/anular']);
    for (const [status, texto] of VIEJAS) {
      const vieja = await anularConFalla(Object.assign(new Error(texto), { status }));
      assert.deepEqual(vieja.avisos, [['error', texto]], `${status}`);
      assert.ok(!activo(vieja.el, 'modal-anular'), `${status}: se cierra`);
      assert.deepEqual(vieja.nuevos.slice(1).sort(), ['GET /seguimiento', 'GET /seguimiento/58'], `${status}: vuelve a pedir la vista`);
      assert.equal(vieja.enfocados.at(-1), 'sg-cargar-nota', `${status}`);
    }
    // El motivo que el servidor rechaza va al campo, sin cerrar
    const motivo = await anularConFalla(Object.assign(new Error('El motivo no puede tener más de 500 caracteres.'), { status: 400, campo: 'motivo' }));
    assert.ok(activo(motivo.el, 'modal-anular'));
    assert.equal(motivo.el('an-motivo-error').textContent, 'El motivo no puede tener más de 500 caracteres.');
    assert.equal(motivo.enfocados.at(-1), 'an-motivo');
    assert.deepEqual(motivo.avisos, []);
  });

  it('si la lista no se puede cargar, avisa y no abre el formulario', async () => {
    const { pagina, el, avisos } = preparar({ id: '58', puedeCargar: true, respuestas: { '/seguimiento/58': DE(58) }, errores: { '/seguimiento': conEstado(500) } });
    await pagina.iniciarSeguimiento();
    await pagina.abrirFormularioDeNota(el('sg-cargar-nota'));
    assert.ok(!activo(el, 'modal-nota'));
    assert.deepEqual(avisos, [['error', 'No se pudo cargar la lista de datasets: Error 500']]);
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
