// La página de El dato de la quincena (spec 2026-11-07-dato-quincena, 9, 10 y 11), ejecutada en Node: lo puro de
// public/js/dato-quincena.js (la dirección, los enlaces seguros, el HTML de la lista, del detalle y de cada estado, y
// «Copiar») con las respuestas inventadas de tests/fixtures/dato-quincena-respuestas.json, que tienen la forma de la sección 9
// (el contrato que cumplen las lecturas del servidor). Como proyectos.js, el script al cargarse solo declara: se carga en un
// vm después del main.js de verdad y del api.js de verdad (Utils), como en la página, con setTimeout y sin navigator.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import { anioDeLaLista } from '../services/datoQuincenaReglas.js';

const leer = (ruta) => fs.readFileSync(new URL(`../public/${ruta}`, import.meta.url), 'utf8');
const RESPUESTAS = JSON.parse(fs.readFileSync(new URL('./fixtures/dato-quincena-respuestas.json', import.meta.url), 'utf8'));

// Cada test arma su copia: cambiarla no toca las demás
const respuesta = (nombre) => structuredClone(RESPUESTAS[nombre]);
const LISTA = () => respuesta('lista').data;
const LISTA_DOS_ANIOS = () => respuesta('lista_dos_anios').data;
const LISTA_VACIA = () => respuesta('lista_vacia').data;
const DETALLE = () => respuesta('detalle').data;

// Un document que alcanza para que main.js se cargue (crea la hoja de los toasts y engancha DOMContentLoaded)
const documentoMinimo = () => ({
  head: { appendChild() {} },
  body: { appendChild() {} },
  createElement: () => ({ textContent: '', remove() {} }),
  addEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null
});

const cargarBase = () => {
  const contexto = vm.createContext({
    CONFIG: { API_URL: '/api' },
    console,
    document: documentoMinimo(),
    URLSearchParams,
    Intl,
    Date,
    setTimeout,
    Auth: { isAuthenticated: () => true, isAdmin: () => false },
    window: { location: { search: '', hash: '', pathname: '/dato-quincena.html', href: '' } }
  });
  // En el orden de la página: main.js antes que api.js
  vm.runInContext(leer('js/main.js'), contexto);
  vm.runInContext(`${leer('js/api.js')}\n;globalThis.Utils = Utils;`, contexto);
  return contexto;
};

const cargar = () => {
  const contexto = cargarBase();
  vm.runInContext(leer('js/dato-quincena.js'), contexto);
  return contexto;
};

// Lo que devuelve una función del vm es de otro contexto: deepStrictEqual compara prototipos, así que se pasa a uno de acá
const plano = (valor) => JSON.parse(JSON.stringify(valor));
const ctx = cargar();
const constante = (nombre) => plano(vm.runInContext(nombre, ctx));
const esc = (texto) => ctx.Utils.escapeHtml(texto);
const cuantas = (texto, patron) => (texto.match(patron) ?? []).length;

// Un nombre de clase o de id que empieza con «ad-» (la expresión de tests/paginas.test.js)
const PREFIJO_DE_ANUNCIOS = /(?<![A-Za-z0-9_-])ad-[A-Za-z0-9_]/;
const XSS = '<img src=x onerror=1>';
const XSS_ESCAPADO = '&lt;img src=x onerror=1&gt;';

// Todos los textos de un objeto (también en listas y objetos anidados) cambiados por `valor`; los números y los booleanos quedan
const conTextos = (objeto, valor) => {
  if (typeof objeto === 'string') return valor;
  if (Array.isArray(objeto)) return objeto.map((elemento) => conTextos(elemento, valor));
  if (objeto !== null && typeof objeto === 'object') {
    return Object.fromEntries(Object.entries(objeto).map(([clave, elemento]) => [clave, conTextos(elemento, valor)]));
  }
  return objeto;
};

// La parte del HTML de la propuesta número `n` (desde 0) del detalle
const propuestasDe = (html) => html.split('<li class="dq-propuesta').slice(1);

describe('dato-quincena.js: al cargarse solo declara', () => {
  it('no toca el DOM, la dirección ni la API: a lo sumo engancha DOMContentLoaded', () => {
    const contexto = cargarBase();
    const enganchados = [];
    const prohibido = (nombre) => new Proxy({}, {
      get: (_, clave) => {
        if (nombre === 'document' && clave === 'addEventListener') return (evento) => enganchados.push(evento);
        throw new Error(`${nombre}.${String(clave)} al cargarse`);
      }
    });
    contexto.document = prohibido('document');
    contexto.window = prohibido('window');
    contexto.history = prohibido('history');
    contexto.location = prohibido('location');
    contexto.API = prohibido('API');
    contexto.navigator = prohibido('navigator');
    vm.runInContext(leer('js/dato-quincena.js'), contexto);
    assert.deepEqual(enganchados, ['DOMContentLoaded']);
  });

  it('sin sesión, al cargar la página va al login sin pedir nada', () => {
    const contexto = cargarBase();
    const oyentes = [];
    contexto.document = { ...documentoMinimo(), addEventListener: (tipo, funcion) => oyentes.push([tipo, funcion]) };
    contexto.Auth = { isAuthenticated: () => false };
    contexto.API = new Proxy({}, { get: (_, clave) => { throw new Error(`API.${String(clave)} sin sesión`); } });
    vm.runInContext(leer('js/dato-quincena.js'), contexto);
    const [[tipo, alCargar]] = oyentes;
    assert.equal(tipo, 'DOMContentLoaded');
    alCargar();
    assert.equal(contexto.window.location.href, 'login.html');
  });
});

describe('dato-quincena.js: las respuestas del servidor (spec, 9) son el contrato del fixture', () => {
  it('la lista: anios, anio y ediciones con id, fecha_texto, marca, principal (título y cifra) y resto', () => {
    for (const nombre of ['lista', 'lista_dos_anios', 'lista_de_2027', 'lista_vacia']) {
      const { success, data } = respuesta(nombre);
      assert.equal(success, true, nombre);
      assert.deepEqual(Object.keys(data), ['anios', 'anio', 'ediciones'], nombre);
      for (const anio of data.anios) assert.deepEqual(Object.keys(anio), ['anio', 'cantidad'], nombre);
      for (const edicion of data.ediciones) {
        assert.deepEqual(Object.keys(edicion), ['id', 'fecha_texto', 'marca', 'principal', 'resto'], nombre);
        assert.deepEqual(Object.keys(edicion.principal), ['titulo', 'cifra_clave'], nombre);
      }
    }
    assert.deepEqual(LISTA_VACIA(), { anios: [], anio: null, ediciones: [] });
  });

  it('el detalle: con su id y los textos ya armados, la agenda, las propuestas y los archivos', () => {
    const detalle = DETALLE();
    assert.deepEqual(Object.keys(detalle), [
      'id', 'fecha_texto', 'marca', 'titulo', 'nota_archivo', 'llegada', 'correo', 'cantidad', 'agenda', 'propuestas', 'archivos'
    ]);
    for (const evento of detalle.agenda) assert.deepEqual(Object.keys(evento), ['fecha_texto', 'titulo', 'detalle', 'url']);
    for (const propuesta of detalle.propuestas) {
      assert.deepEqual(Object.keys(propuesta), [
        'orden_texto', 'etiquetas', 'principal', 'titulo', 'cifra_clave', 'dataset', 'foto', 'notas_validacion', 'calculo',
        'contexto_historico', 'por_que_hoy', 'angulo', 'idea_placa', 'texto_redes', 'puntos_centrales', 'borrador_nota', 'fuentes',
        'para_copiar', 'borrador_para_copiar'
      ]);
      assert.deepEqual(Object.keys(propuesta.dataset), ['nombre', 'id_enlace', 'url']);
      assert.deepEqual(Object.keys(propuesta.borrador_nota), ['titulo', 'parrafos']);
      for (const fila of propuesta.foto) assert.deepEqual(Object.keys(fila), ['rotulo', 'valor']);
    }
    assert.deepEqual(detalle.archivos.map((archivo) => Object.keys(archivo)), Array(4).fill(['campo', 'rotulo', 'nombre', 'detalle', 'se_puede_ver']));
    assert.deepEqual(detalle.archivos.map((archivo) => archivo.campo), ['infografia_png', 'correo_texto', 'calculos', 'metadata']);
    assert.deepEqual(respuesta('no_existe'), { success: false, error: 'No existe esa edición.' });
  });
});

describe('dato-quincena.js: la dirección', () => {
  it('estadoDeLaUrl: el id, un entero positivo, y el año, de 2000 a 2100; lo demás, null', () => {
    assert.deepEqual(plano(ctx.estadoDeLaUrl('')), { id: null, anio: null });
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?id=12')), { id: 12, anio: null });
    assert.deepEqual(plano(ctx.estadoDeLaUrl('id=7')), { id: 7, anio: null });
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?anio=2026')), { id: null, anio: 2026 });
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?id=3&anio=2027')), { id: 3, anio: 2027 });
    for (const id of ['0', '-1', 'abc', '1.5', '1e3', ' 4', '012', '99999999999999999999', '']) {
      assert.equal(ctx.estadoDeLaUrl(`?id=${encodeURIComponent(id)}`).id, null, id);
    }
    for (const anio of ['1999', '2101', '26', 'abc', '2026.0', '']) {
      assert.equal(ctx.estadoDeLaUrl(`?anio=${encodeURIComponent(anio)}`).anio, null, anio);
    }
  });

  // La copia del navegador de la regla del año (CLAUDE.md, «El servidor manda»): ante el mismo texto, el mismo año que
  // anioDeLaLista, y null donde el servidor no lo acepta (sin ?anio=, el servidor también toma el año más reciente)
  it('el año: la misma regla que anioDeLaLista del servidor', () => {
    for (const anio of ['1999', '2000', '2026', '2100', '2101', 'abc', '02026', '20260', '', ' 2026', '2026 ', '2026.0', '-2026',
      '+2026', '2026\n', '２０２６', '2e3', '0x7EA', '0999', '0000']) {
      const delServidor = anioDeLaLista(anio);
      const deLaPagina = ctx.estadoDeLaUrl(`?anio=${encodeURIComponent(anio)}`).anio;
      assert.equal(deLaPagina, delServidor.valido ? delServidor.anio : null, JSON.stringify(anio));
    }
    assert.equal(ctx.estadoDeLaUrl('').anio, anioDeLaLista(undefined).anio);
    for (const anio of [1999, 2000, 2026, 2100, 2101, 2026.5, NaN, null]) {
      const delServidor = anioDeLaLista(String(anio));
      assert.equal(ctx.urlDeEstado({ anio }) === `dato-quincena.html?anio=${String(anio)}`, delServidor.valido, String(anio));
    }
  });

  it('urlDeEstado: la página con el id, si hay; si no, con el año; si no, sola', () => {
    assert.equal(ctx.urlDeEstado({ id: 12, anio: null }), 'dato-quincena.html?id=12');
    assert.equal(ctx.urlDeEstado({ id: 12, anio: 2026 }), 'dato-quincena.html?id=12');
    assert.equal(ctx.urlDeEstado({ id: null, anio: 2026 }), 'dato-quincena.html?anio=2026');
    assert.equal(ctx.urlDeEstado({ id: null, anio: null }), 'dato-quincena.html');
    assert.equal(ctx.urlDeEstado({}), 'dato-quincena.html');
    assert.equal(ctx.urlDeEstado({ id: '12" onclick="x', anio: '2026"' }), 'dato-quincena.html');
    assert.equal(ctx.urlDeEstado({ id: 0, anio: 1999 }), 'dato-quincena.html');
  });

  it('esEnlaceSeguro: solo una dirección que empieza con https://', () => {
    assert.equal(ctx.esEnlaceSeguro('https://datos.ejemplo.gob.ar/a.csv'), true);
    for (const url of ['http://datos.ejemplo.gob.ar', 'javascript:alert(1)', 'data:text/html,x', ' https://x.test', 'HTTPS://x.test',
      '//x.test', 'ftp://x.test', '', null, undefined, 12, { toString: () => 'https://x.test' }]) {
      assert.equal(ctx.esEnlaceSeguro(url), false, String(url));
    }
  });
});

describe('dato-quincena.js: la lista (spec, 10)', () => {
  it('con un solo año, sin los botones de los años; una fila por edición, con su enlace, en el orden del servidor', () => {
    const html = ctx.htmlDeLaLista(LISTA());
    assert.ok(!html.includes('dq-anios'), 'sin los botones');
    assert.ok(!html.includes('data-anio'), 'sin los botones');
    assert.equal(cuantas(html, /<li class="dq-fila">/g), 3);
    const enlaces = [...html.matchAll(/<a class="dq-fila-enlace" href="([^"]+)">/g)].map((m) => m[1]);
    assert.deepEqual(enlaces, ['dato-quincena.html?id=14', 'dato-quincena.html?id=13', 'dato-quincena.html?id=12']);
    assert.ok(html.startsWith('<ol class="dq-lista">'), html.slice(0, 60));
  });

  it('con dos años, los botones con su cantidad y el año elegido marcado', () => {
    const html = ctx.htmlDeLaLista(LISTA_DOS_ANIOS());
    assert.match(html, /<div class="dq-anios" role="group" aria-label="Año">/);
    assert.ok(html.includes('<button type="button" class="dq-chip" aria-pressed="false" data-anio="2027">2027 <b>1</b></button>'));
    assert.ok(html.includes('<button type="button" class="dq-chip dq-activo" aria-pressed="true" data-anio="2026">2026 <b>3</b></button>'));
    assert.ok(html.indexOf('data-anio="2027"') < html.indexOf('data-anio="2026"'), 'en el orden del servidor');
    assert.equal(cuantas(html, /<li class="dq-fila">/g), 3);
    assert.ok(html.indexOf('dq-anios') < html.indexOf('dq-lista'), 'los años arriba de la lista');
  });

  it('htmlDeAnios: con uno o ninguno, nada', () => {
    assert.equal(ctx.htmlDeAnios([], null), '');
    assert.equal(ctx.htmlDeAnios([{ anio: 2026, cantidad: 3 }], 2026), '');
    assert.equal(ctx.htmlDeAnios(null, null), '');
    // El año elegido marcado, el otro no; un año sin ediciones (el 0 es un valor) dice 0
    const html = ctx.htmlDeAnios([{ anio: 2027, cantidad: 0 }, { anio: 2026, cantidad: 3 }], 2027);
    assert.ok(html.includes('aria-pressed="true" data-anio="2027">2027 <b>0</b>'));
    assert.ok(html.includes('aria-pressed="false" data-anio="2026">2026 <b>3</b>'));
  });

  it('la fila de una regular: la miniatura que se pide, la fecha, el título y la cifra de la principal, y el resto; sin marca', () => {
    const [regular] = LISTA().ediciones;
    const html = ctx.htmlDeFila(regular);
    assert.ok(html.includes('<span class="dq-mini" aria-hidden="true" data-mini="/dato-quincena/ediciones/14/archivos/infografia_png"></span>'));
    assert.ok(html.includes('<span class="dq-fila-fecha">Lunes 16 de noviembre de 2026</span>'));
    assert.ok(html.includes(`<span class="dq-fila-titulo">${esc(regular.principal.titulo)}</span>`));
    assert.ok(html.includes(`<span class="dq-fila-cifra">${esc(regular.principal.cifra_clave)}</span>`));
    assert.ok(html.includes('<span class="dq-fila-resto">Y 2 propuestas más: Dataset de prueba B y Dataset de prueba C.</span>'));
    assert.ok(!html.includes('dq-marca'), 'sin marca');
  });

  it('la fila de un piloto: la marca junto a la fecha; sin resto, sin esa línea', () => {
    const [, piloto] = LISTA().ediciones;
    const html = ctx.htmlDeFila(piloto);
    assert.ok(html.includes('<span class="dq-fila-fecha">Lunes 2 de noviembre de 2026<span class="dq-marca">Piloto 4</span></span>'));
    assert.ok(!html.includes('dq-fila-resto'));
  });

  it('una fila con un id que no sirve se dibuja sin enlace ni miniatura', () => {
    const [regular] = LISTA().ediciones;
    for (const id of [0, -3, '14', null, 1.5]) {
      const html = ctx.htmlDeFila({ ...regular, id });
      assert.ok(!html.includes('href='), String(id));
      assert.ok(!html.includes('data-mini'), String(id));
      assert.ok(html.includes('Lunes 16 de noviembre de 2026'), String(id));
    }
  });

  it('el archivo vacío: el texto del vacío, sin lista ni años', () => {
    const html = ctx.htmlDeLaLista(LISTA_VACIA());
    assert.equal(html, ctx.htmlDelEstado('vacio'));
    assert.ok(html.includes('Todavía no llegó ninguna edición. Grok Bot manda cada una después de enviar su correo.'));
  });
});

describe('dato-quincena.js: el detalle (spec, 10)', () => {
  it('«Todas las ediciones», la fecha, el título, la llegada, el correo, la cantidad y la nota de archivo', () => {
    const detalle = DETALLE();
    const html = ctx.htmlDelDetalle(detalle);
    assert.match(html, /<a class="dq-link dq-volver" href="dato-quincena\.html"><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>Todas las ediciones<\/a>/);
    assert.ok(html.includes('<h2 class="dq-fecha">Lunes 2 de noviembre de 2026</h2>'));
    assert.ok(html.includes(`<p class="dq-titulo-paquete">${esc(detalle.titulo)}</p>`));
    // La cantidad del servidor tal cual, y el punto final lo pone la página (como en la maqueta)
    assert.ok(html.includes('<p class="dq-recibo">Llegó al RPAD el 02/11/2026 a las 08:14. Correo enviado el 02/11/2026 a las 08:12, según Grok Bot. 2 propuestas.</p>'));
    // Sin la cantidad, sin ese punto
    assert.ok(ctx.htmlDelDetalle({ ...detalle, cantidad: null }).includes('<p class="dq-recibo">Llegó al RPAD el 02/11/2026 a las 08:14. Correo enviado el 02/11/2026 a las 08:12, según Grok Bot.</p>'));
    assert.ok(html.includes(`<p class="dq-nota-archivo"><b>Nota de Grok Bot:</b> ${esc(detalle.nota_archivo)}</p>`));
    assert.ok(html.indexOf('dq-volver') < html.indexOf('dq-fecha'));
  });

  it('un piloto lleva su marca junto a la fecha', () => {
    const html = ctx.htmlDelDetalle({ ...DETALLE(), marca: 'Piloto 4' });
    assert.ok(html.includes('<h2 class="dq-fecha">Lunes 2 de noviembre de 2026<span class="dq-marca">Piloto 4</span></h2>'));
  });

  it('una nota de archivo null, vacía o de solo espacios no se dibuja', () => {
    for (const nota_archivo of [null, '', '   ', '\n\t']) {
      assert.ok(!ctx.htmlDelDetalle({ ...DETALLE(), nota_archivo }).includes('dq-nota-archivo'), JSON.stringify(nota_archivo));
    }
  });

  it('con agenda: cada evento con su fecha, título, detalle y enlace; sin agenda, ese bloque no va', () => {
    const [evento] = DETALLE().agenda;
    const agenda = ctx.htmlDeLaAgenda([evento]);
    assert.match(agenda, /^<section class="dq-agenda" aria-labelledby="dq-agenda-titulo"><h3 class="dq-seccion-titulo" id="dq-agenda-titulo">Agenda de la quincena<\/h3>/);
    assert.ok(agenda.includes('<span class="dq-dia">10/11/2026</span>'));
    assert.ok(agenda.includes(`<b>${esc(evento.titulo)}</b>`));
    assert.ok(agenda.includes(esc(evento.detalle)));
    assert.ok(agenda.includes(`<a href="${esc(evento.url)}" target="_blank" rel="noopener noreferrer">Ver<span class="visualmente-oculto"> ${esc(evento.titulo)}</span></a>`));
    assert.ok(ctx.htmlDelDetalle(DETALLE()).includes(agenda), 'en el detalle');
    assert.equal(ctx.htmlDeLaAgenda([]), '');
    assert.equal(ctx.htmlDeLaAgenda(null), '');
    assert.ok(!ctx.htmlDelDetalle({ ...DETALLE(), agenda: [] }).includes('dq-agenda'));
    // Una dirección que no es https://, sin enlace
    const sinEnlace = ctx.htmlDeLaAgenda([{ ...evento, url: 'javascript:alert(1)' }]);
    assert.ok(!sinEnlace.includes('<a '), sinEnlace);
    assert.ok(!sinEnlace.includes('javascript:'), sinEnlace);
  });

  it('la infografía se pide desde un blob: (el lugar con su ruta y su texto alternativo) y la agenda va antes de las propuestas', () => {
    const detalle = DETALLE();
    const html = ctx.htmlDelDetalle(detalle);
    assert.ok(html.includes(`<div class="dq-infografia" data-infografia="/dato-quincena/ediciones/12/archivos/infografia_png" data-alt="Infografía de la propuesta principal: ${esc(detalle.propuestas[0].titulo)}"></div>`));
    assert.ok(html.indexOf('<aside class="dq-lateral"') < html.indexOf('dq-agenda'), 'el costado primero (arriba en el teléfono)');
    assert.ok(html.indexOf('dq-agenda') < html.indexOf('dq-propuestas'));
    assert.ok(html.indexOf('data-infografia') < html.indexOf('dq-archivos'));
  });

  it('la principal abierta y las otras cerradas, con sus textos; la principal con el borde grueso', () => {
    const html = ctx.htmlDelDetalle(DETALLE());
    const [principal, otra] = propuestasDe(html);
    assert.ok(principal.startsWith(' dq-principal">'), principal.slice(0, 40));
    assert.ok(otra.startsWith('">'), otra.slice(0, 40));
    assert.match(principal, /<details class="dq-completa" open><summary><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg><span>La propuesta completa<\/span><\/summary>/);
    assert.match(otra, /<details class="dq-completa"><summary><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg><span>Ver la propuesta completa<\/span><\/summary>/);
    assert.equal(cuantas(html, /<details /g), 2);
  });

  it('el número, las etiquetas (Validar con su ícono, nunca solo el color), el título y la cifra', () => {
    const [principal, otra] = propuestasDe(ctx.htmlDelDetalle(DETALLE()));
    assert.ok(principal.includes('<span class="dq-orden">Propuesta 1</span>'));
    assert.ok(principal.includes('<span class="dq-etiqueta dq-et-principal">Principal</span>'));
    assert.match(principal, /<span class="dq-etiqueta dq-et-validar"><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>Validar<\/span>/);
    assert.ok(otra.includes('<span class="dq-etiqueta dq-et-agenda">Agenda</span>'));
    assert.ok(principal.includes('<h4 class="dq-prop-titulo">Un título inventado</h4>'));
    assert.ok(principal.includes(`<p class="dq-cifra">${esc('1.234 casos · septiembre de 2026')}</p>`));
    // Una etiqueta que no conoce, escapada y sin color
    const rara = ctx.htmlDePropuesta({ ...DETALLE().propuestas[1], etiquetas: [XSS] });
    assert.ok(rara.includes(`<span class="dq-etiqueta">${XSS_ESCAPADO}</span>`));
  });

  it('«Para validar antes de publicar», con su ícono, fuera del <details> y siempre a la vista; sin notas, no va', () => {
    const [principal, otra] = propuestasDe(ctx.htmlDelDetalle(DETALLE()));
    assert.match(principal, /<div class="dq-validar"><h5><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>Para validar antes de publicar<\/h5><ul><li>Primera nota\.<\/li><li>Segunda nota\.<\/li><\/ul><\/div>/);
    assert.ok(principal.indexOf('dq-validar') < principal.indexOf('<details'), 'antes del <details>');
    assert.ok(!otra.includes('Para validar'));
  });

  it('la foto del RPAD de ese día, tal como la manda el servidor', () => {
    const [primera] = DETALLE().propuestas;
    assert.equal(ctx.htmlDeLaFoto(primera.foto), '<dl class="dq-foto">'
      + '<div><dt>En el RPAD ese día:</dt><dd>Actualizado</dd></div>'
      + '<div><dt>Datos al</dt><dd>30/09/2026</dd></div>'
      + '<div><dt>Última actualización</dt><dd>30/10/2026</dd></div>'
      + '<div><dt>Próxima en</dt><dd>29 días</dd></div></dl>');
    assert.ok(ctx.htmlDePropuesta(primera).includes(ctx.htmlDeLaFoto(primera.foto)));
    assert.equal(ctx.htmlDeLaFoto([]), '');
    assert.equal(ctx.htmlDeLaFoto(null), '');
  });

  it('el dataset: el enlace a su página solo con id_enlace, y «en el portal» siempre, con enlace solo si es https://', () => {
    const [primera, segunda] = DETALLE().propuestas;
    assert.ok(ctx.htmlDePropuesta(primera).includes('<p class="dq-dataset">Dataset: <a href="dataset.html?id=1">Dataset de prueba A</a> · '
      + '<a href="https://datos.ejemplo.gob.ar/dataset/prueba-a" target="_blank" rel="noopener noreferrer">en el portal</a></p>'));
    assert.ok(ctx.htmlDePropuesta(segunda).includes('<p class="dq-dataset">Dataset: Dataset de prueba B · '
      + '<a href="https://datos.ejemplo.gob.ar/dataset/prueba-b" target="_blank" rel="noopener noreferrer">en el portal</a></p>'));
    for (const id_enlace of [0, -1, '1', 1.5, null]) {
      assert.ok(!ctx.htmlDePropuesta({ ...primera, dataset: { ...primera.dataset, id_enlace } }).includes('dataset.html'), String(id_enlace));
    }
    for (const url of ['http://datos.ejemplo.gob.ar/x', 'javascript:alert(1)', '']) {
      const html = ctx.htmlDePropuesta({ ...primera, dataset: { ...primera.dataset, url } });
      assert.ok(html.includes('<p class="dq-dataset">Dataset: <a href="dataset.html?id=1">Dataset de prueba A</a> · en el portal</p>'), url);
      assert.ok(!html.includes('javascript:'), url);
    }
  });

  it('las fuentes: con enlace solo si es https://; si no, el texto sin enlace', () => {
    const [primera] = DETALLE().propuestas;
    const html = ctx.htmlDePropuesta({ ...primera, fuentes: ['https://datos.ejemplo.gob.ar/a.csv', 'http://datos.ejemplo.gob.ar/b.csv', 'javascript:alert(1)'] });
    assert.ok(html.includes('<li><a href="https://datos.ejemplo.gob.ar/a.csv" target="_blank" rel="noopener noreferrer">https://datos.ejemplo.gob.ar/a.csv</a></li>'));
    assert.ok(html.includes('<li>http://datos.ejemplo.gob.ar/b.csv</li>'));
    assert.ok(html.includes('<li>javascript:alert(1)</li>'));
    assert.equal(cuantas(html, /href="javascript:/g), 0);
    assert.equal(cuantas(html, /href="http:/g), 0);
  });

  it('dentro del <details>, los campos en el orden de la sección 9, con los textos tal como llegaron', () => {
    const [primera] = DETALLE().propuestas;
    const html = ctx.htmlDePropuesta(primera);
    const completa = html.slice(html.indexOf('<details'), html.indexOf('</details>'));
    const titulos = [...completa.matchAll(/<h5>([^<]+)/g)].map((m) => m[1]);
    assert.deepEqual(titulos, ['Cómo se calculó', 'Contexto histórico', 'Por qué hoy', 'Ángulo', 'Idea de placa', 'Texto para redes', 'Puntos centrales', 'Borrador de nota', 'Fuentes']);
    for (const campo of ['calculo', 'contexto_historico', 'por_que_hoy', 'angulo', 'idea_placa', 'texto_redes']) {
      assert.ok(completa.includes(`<p class="dq-texto">${esc(primera[campo])}</p>`), campo);
    }
    assert.ok(completa.includes('<ul><li>Primer punto inventado.</li><li>Segundo punto inventado.</li><li>Tercer punto inventado.</li></ul>'));
    assert.ok(completa.includes('<div class="dq-nota"><p class="dq-nota-titulo">Un borrador inventado</p><p class="dq-texto">Primer párrafo inventado.</p><p class="dq-texto">Segundo párrafo inventado.</p></div>'));
    // El texto para redes conserva su salto de línea (lo muestra white-space: pre-line)
    assert.ok(completa.includes('Un texto para redes inventado.\nCon un segundo renglón.'));
  });

  it('los tres «Copiar»: el texto para redes, el borrador y la propuesta entera, tal como llegan del servidor', () => {
    for (const propuesta of DETALLE().propuestas) {
      const html = ctx.htmlDePropuesta(propuesta);
      const copiar = [...html.matchAll(/<button type="button" class="([^"]+)" data-copiar="([^"]*)" aria-label="([^"]*)">([^<]+)<\/button>/g)]
        .map(([, clase, texto, nombre, rotulo]) => ({ clase, texto, nombre, rotulo }));
      assert.deepEqual(copiar.map((c) => c.rotulo), ['Copiar', 'Copiar', 'Copiar la propuesta']);
      // Cada uno dice qué copia (el texto del botón cambia a «Copiado» y lo anuncia #dq-anuncio); el de la propuesta, cuál. Cada
      // nombre contiene el texto que se ve (WCAG 2.5.3): quien maneja la página con la voz lo encuentra por lo que lee
      assert.deepEqual(copiar.map((c) => c.nombre), ['Copiar el texto para redes', 'Copiar el borrador', `Copiar la propuesta (${propuesta.orden_texto})`]);
      for (const { nombre, rotulo } of copiar) assert.ok(nombre.startsWith(rotulo), `${nombre} contiene ${rotulo}`);
      assert.deepEqual(copiar.map((c) => c.texto), [esc(propuesta.texto_redes), esc(propuesta.borrador_para_copiar), esc(propuesta.para_copiar)]);
      assert.deepEqual(copiar.map((c) => c.clase), ['dq-link dq-copiar', 'dq-link dq-copiar', 'dq-btn dq-btn-borde dq-btn-chico dq-copiar']);
      // «Copiar la propuesta» al pie, después del <details>
      assert.ok(html.indexOf('</details>') < html.indexOf('Copiar la propuesta'));
    }
    // El de la propuesta copia para_copiar tal cual (con sus saltos de línea), sin recalcular nada
    const [primera] = DETALLE().propuestas;
    assert.ok(ctx.htmlDePropuesta({ ...primera, para_copiar: 'Otro texto\n\ndel servidor' }).includes('data-copiar="Otro texto\n\ndel servidor" aria-label="Copiar la propuesta (Propuesta 1)">Copiar la propuesta'));
    // Los nombres exactos, y sin orden_texto, el de la propuesta a secas
    const nombres = (html) => [...html.matchAll(/data-copiar="[^"]*" aria-label="([^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(nombres(ctx.htmlDePropuesta(DETALLE().propuestas[1])), ['Copiar el texto para redes', 'Copiar el borrador', 'Copiar la propuesta (Propuesta 2)']);
    assert.deepEqual(nombres(ctx.htmlDePropuesta({ ...primera, orden_texto: null })), ['Copiar el texto para redes', 'Copiar el borrador', 'Copiar la propuesta']);
  });

  it('los archivos: los cuatro, con «Descargar» en cada uno y «Ver» solo en el texto y los cálculos', () => {
    const detalle = DETALLE();
    const html = ctx.htmlDeArchivos(detalle.archivos, detalle.id);
    assert.match(html, /^<section class="dq-archivos" aria-labelledby="dq-archivos-titulo"><h3 id="dq-archivos-titulo">Archivos<\/h3><ul>/);
    assert.equal(cuantas(html, /<li>/g), 4);
    assert.equal(cuantas(html, />Descargar<\/button>/g), 4);
    assert.equal(cuantas(html, />Ver<\/button>/g), 2);
    const filas = html.split('<li>').slice(1);
    for (const [fila, archivo] of filas.map((f, i) => [f, detalle.archivos[i]])) {
      assert.ok(fila.includes(`<span class="dq-archivo">${esc(archivo.rotulo)} <small>${esc(archivo.detalle)}</small></span>`), archivo.campo);
      const datos = `data-ruta="/dato-quincena/ediciones/12/archivos/${archivo.campo}" data-nombre="${esc(archivo.nombre)}"`;
      assert.ok(fila.includes(`<button type="button" class="dq-link" data-descargar ${datos} aria-label="Descargar ${esc(archivo.rotulo)}">Descargar</button>`), archivo.campo);
      const ver = `<button type="button" class="dq-link" data-ver ${datos} data-rotulo="${esc(archivo.rotulo)}" aria-label="Ver ${esc(archivo.rotulo)}">Ver</button>`;
      assert.equal(fila.includes(ver), archivo.se_puede_ver, archivo.campo);
    }
    assert.ok(ctx.htmlDelDetalle(detalle).includes(html), 'en el costado del detalle');
    // Sin los cálculos, tres; sin un id que sirva, nada (no hay a dónde pedirlos)
    assert.equal(cuantas(ctx.htmlDeArchivos(detalle.archivos.filter((a) => a.campo !== 'calculos'), 12), /<li>/g), 3);
    assert.equal(ctx.htmlDeArchivos(detalle.archivos, 0), '');
    assert.equal(ctx.htmlDeArchivos([], 12), '');
  });

  it('el campo de un archivo va codificado en la ruta', () => {
    const html = ctx.htmlDeArchivos([{ campo: '../x?y', rotulo: 'R', nombre: 'n', detalle: 'd', se_puede_ver: true }], 12);
    assert.ok(html.includes('data-ruta="/dato-quincena/ediciones/12/archivos/..%2Fx%3Fy"'), html);
  });
});

describe('dato-quincena.js: los estados (spec, 10)', () => {
  it('cargando, error, vacío y una edición que no existe, cada uno con su texto', () => {
    assert.equal(ctx.htmlDelEstado('cargando'), '<p class="dq-estado" role="status">Cargando…</p>');
    assert.equal(ctx.htmlDelEstado('error'),
      '<div class="dq-estado dq-error" role="alert"><p>No se pudieron cargar las ediciones. Probá de nuevo en unos minutos.</p></div>');
    assert.equal(ctx.htmlDelEstado('vacio'),
      '<p class="dq-estado">Todavía no llegó ninguna edición. Grok Bot manda cada una después de enviar su correo.</p>');
    assert.equal(ctx.htmlDelEstado('no-existe'),
      '<div class="dq-estado"><h2>No existe esa edición.</h2><p><a class="dq-link" href="dato-quincena.html">Todas las ediciones</a></p></div>');
    assert.equal(ctx.htmlDelEstado('otro'), '');
    assert.equal(ctx.htmlDelEstado('constructor'), '');
  });

  it('la página empieza con el de cargando, el mismo que arma htmlDelEstado', () => {
    assert.ok(leer('dato-quincena.html').includes(`<div id="dq-contenido">${ctx.htmlDelEstado('cargando')}</div>`));
  });
});

describe('dato-quincena.js: todo texto del servidor va escapado', () => {
  it('la lista: un título <img src=x onerror=1> sale como texto', () => {
    const datos = conTextos(LISTA_DOS_ANIOS(), XSS);
    const html = ctx.htmlDeLaLista(datos);
    assert.ok(!html.includes('<img'), html);
    assert.ok(html.includes(XSS_ESCAPADO));
    // Un año o una cantidad que no son números
    const anios = ctx.htmlDeAnios([{ anio: XSS, cantidad: XSS }, { anio: 2026, cantidad: XSS }], 2026);
    assert.ok(!anios.includes('<img'), anios);
  });

  it('el detalle: todos sus textos, también en data-, title, alt y aria-label', () => {
    const datos = conTextos(DETALLE(), XSS);
    const html = ctx.htmlDelDetalle(datos);
    assert.ok(!html.includes('<img'), html);
    assert.ok(cuantas(html, /&lt;img src=x onerror=1&gt;/g) > 30);
    // Ninguna dirección que no es https:// llega a un href
    assert.ok(!/href="(?!dato-quincena\.html|dataset\.html\?id=\d+"|https:\/\/)/.test(html), html);
    assert.ok(html.includes(`data-copiar="${XSS_ESCAPADO}"`));
    assert.ok(html.includes(`aria-label="Copiar la propuesta (${XSS_ESCAPADO})"`));
    assert.ok(html.includes(`data-alt="Infografía de la propuesta principal: ${XSS_ESCAPADO}"`));
    assert.ok(html.includes(`aria-label="Descargar ${XSS_ESCAPADO}"`));
    assert.ok(html.includes(`data-nombre="${XSS_ESCAPADO}"`));
  });

  it('una dirección https:// con comillas no se sale del atributo', () => {
    const [primera] = DETALLE().propuestas;
    const url = 'https://x.test/"><img src=x onerror=1>';
    const html = ctx.htmlDePropuesta({ ...primera, fuentes: [url], dataset: { ...primera.dataset, url } });
    assert.ok(!html.includes('<img'), html);
    assert.ok(html.includes('href="https://x.test/&quot;&gt;&lt;img src=x onerror=1&gt;"'));
  });

  it('ninguna clase ni id empieza con «ad-» en lo que arma la página', () => {
    const todo = [ctx.htmlDeLaLista(LISTA_DOS_ANIOS()), ctx.htmlDeLaLista(LISTA_VACIA()), ctx.htmlDelDetalle(DETALLE()),
      ...['cargando', 'error', 'vacio', 'no-existe'].map((tipo) => ctx.htmlDelEstado(tipo))].join('\n');
    assert.doesNotMatch(todo, PREFIJO_DE_ANUNCIOS);
    // Las clases y los ids de la página empiezan con dq- (salvo visualmente-oculto, la de todas las páginas)
    const clases = [...todo.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(' '));
    const ids = [...todo.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual([...new Set([...clases, ...ids])].filter((n) => !n.startsWith('dq-') && n !== 'visualmente-oculto'), []);
  });
});

describe('dato-quincena.js: «Copiar» (spec, 10)', () => {
  const boton = (texto = 'Copiar') => ({ textContent: texto, dataset: {} });

  it('los mensajes', () => {
    assert.deepEqual(constante('MENSAJES_COPIAR'), { copiado: 'Copiado', fallo: 'No se pudo copiar: seleccioná el texto.' });
  });

  it('sin portapapeles (sin navigator en el contexto), el botón dice que no se pudo y no tira', async () => {
    const copiar = boton();
    const esperas = [];
    const resultado = await ctx.copiarTexto(copiar, 'Un texto', { esperar: (funcion, ms) => esperas.push([funcion, ms]) });
    assert.equal(resultado, false);
    assert.equal(copiar.textContent, 'No se pudo copiar: seleccioná el texto.');
    // Más tarde vuelve al texto de antes
    assert.equal(esperas.length, 1);
    esperas[0][0]();
    assert.equal(copiar.textContent, 'Copiar');
    // Con el valor por defecto (globalThis.navigator, que no está) tampoco tira
    const otro = boton('Copiar la propuesta');
    await assert.doesNotReject(ctx.copiarTexto(otro, 'x', { esperar: () => {} }));
    assert.equal(otro.textContent, 'No se pudo copiar: seleccioná el texto.');
  });

  it('un portapapeles sin writeText o que falla: no se pudo', async () => {
    for (const portapapeles of [{}, { writeText: () => Promise.reject(new Error('sin permiso')) }, { writeText: () => { throw new Error('x'); } }]) {
      const copiar = boton();
      assert.equal(await ctx.copiarTexto(copiar, 'x', { portapapeles, esperar: () => {} }), false);
      assert.equal(copiar.textContent, 'No se pudo copiar: seleccioná el texto.');
    }
  });

  it('con un portapapeles: copia el texto tal cual, dice «Copiado» y a los 2 s vuelve al texto original', async () => {
    const copiados = [];
    const portapapeles = { writeText: async (texto) => { copiados.push(texto); } };
    const esperas = [];
    const copiar = boton('Copiar la propuesta');
    const texto = 'Un título [Principal]\n\nDos renglones';
    assert.equal(await ctx.copiarTexto(copiar, texto, { portapapeles, esperar: (funcion, ms) => esperas.push([funcion, ms]) }), true);
    assert.deepEqual(copiados, [texto]);
    assert.equal(copiar.textContent, 'Copiado');
    assert.deepEqual(esperas.map(([, ms]) => ms), [2000]);
    // Un segundo clic mientras dice «Copiado» no pierde el texto original
    await ctx.copiarTexto(copiar, texto, { portapapeles, esperar: (funcion, ms) => esperas.push([funcion, ms]) });
    for (const [funcion] of esperas) funcion();
    assert.equal(copiar.textContent, 'Copiar la propuesta');
  });
});

describe('dato-quincena.html: la página', () => {
  const html = leer('dato-quincena.html');

  it('el título, la descripción, el h1 con el diario de Lucide (decorativo) y la bajada', () => {
    assert.ok(html.includes('<title>El dato de la quincena - RPAD</title>'));
    assert.match(html, /<meta name="description" content="[^"]+">/);
    const h1 = html.match(/<h1 class="page-title">[\s\S]*?<\/h1>/)?.[0] ?? '';
    assert.match(h1, /<svg aria-hidden="true" [^>]*><path d="M15 18h-5"\/><path d="M18 14h-8"\/>/);
    assert.equal(h1.replace(/<svg[\s\S]*?<\/svg>/, '').replace(/<[^>]+>/g, '').trim(), 'El dato de la quincena');
    assert.ok(html.includes('<p class="dq-bajada">Las propuestas de comunicación que manda Grok Bot cada dos lunes, tal como llegaron. '
      + 'Son internas: guardarlas acá no las aprueba ni las publica.</p>'));
  });

  it('#dq-anuncio es la región viva, una sola vez y fuera de lo que se vuelve a dibujar', () => {
    assert.equal(cuantas(html, /role="status"/g), 2, 'la región viva y «Cargando…»');
    assert.ok(html.includes('<p class="visualmente-oculto" id="dq-anuncio" role="status"></p>'));
    assert.ok(html.indexOf('id="dq-anuncio"') < html.indexOf('id="dq-contenido"'));
  });

  it('el modal de «Ver»: el título, el texto en un <pre>, «Cerrar» y «Descargar», después del footer', () => {
    const modal = html.match(/<div class="modal-overlay" id="dq-modal">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)?.[0] ?? '';
    assert.match(modal, /<div class="modal dq-modal" role="dialog" aria-modal="true" aria-labelledby="dq-modal-titulo">/);
    assert.match(modal, /<h2 class="modal-title" id="dq-modal-titulo"><\/h2>/);
    assert.match(modal, /<button type="button" class="modal-close" data-cerrar aria-label="Cerrar">&times;<\/button>/);
    assert.match(modal, /<pre class="dq-texto-plano" id="dq-modal-texto" tabindex="0"><\/pre>/);
    assert.match(modal, /<button type="button" class="dq-btn dq-btn-borde" data-cerrar>Cerrar<\/button>/);
    assert.match(modal, /<button type="button" class="dq-btn dq-btn-tinta" id="dq-modal-descargar">Descargar<\/button>/);
    assert.ok(html.indexOf('</footer>') < html.indexOf('id="dq-modal"'));
  });

  it('ningún id se repite', () => {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
  });

  it('los scripts, a secas y en su orden: config, auth, main, api y dato-quincena.js', () => {
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
    assert.deepEqual(scripts.map((s) => s.match(/^<script src="js\/([\w-]+)\.js(\?v=\d+)?">$/)?.[1]), ['config', 'auth', 'main', 'api', 'dato-quincena']);
  });

  it('el <style> define los tokens --sg-* que usa, el foco visible y nada se mueve con prefers-reduced-motion', () => {
    const estilo = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    const definidos = new Set([...estilo.matchAll(/(--sg-[\w-]+):/g)].map((m) => m[1]));
    const usados = new Set([...estilo.matchAll(/var\((--sg-[\w-]+)\)/g)].map((m) => m[1]));
    assert.deepEqual([...usados].filter((token) => !definidos.has(token)), []);
    assert.match(estilo, /\.dq-pagina a:focus-visible/);
    assert.match(estilo, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*transition: none/);
    // Las piezas de la página llevan dq- (los botones también: no son los del Seguimiento)
    assert.doesNotMatch(estilo, /\.sg-(btn|link)/);
    // El teléfono: la miniatura de 72 px y una sola columna en el detalle
    assert.match(estilo, /\.dq-mini \{[^}]*width: 104px; height: 104px;/);
    assert.match(estilo, /@media \(max-width: 560px\) \{[\s\S]*?\.dq-mini \{ width: 72px; height: 72px; \}/);
  });
});
