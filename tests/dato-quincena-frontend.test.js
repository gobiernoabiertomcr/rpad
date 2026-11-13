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
import { textoDeLosQueReciben } from '../services/datoQuincenaCorreoReglas.js';

const leer = (ruta) => fs.readFileSync(new URL(`../public/${ruta}`, import.meta.url), 'utf8');
const RESPUESTAS = JSON.parse(fs.readFileSync(new URL('./fixtures/dato-quincena-respuestas.json', import.meta.url), 'utf8'));

// Cada test arma su copia: cambiarla no toca las demás
const respuesta = (nombre) => structuredClone(RESPUESTAS[nombre]);
const LISTA = () => respuesta('lista').data;
const LISTA_DOS_ANIOS = () => respuesta('lista_dos_anios').data;
const LISTA_VACIA = () => respuesta('lista_vacia').data;
const DETALLE = () => respuesta('detalle').data;

// Las respuestas de administración (spec 2026-11-12-dato-quincena-correo, 12), inventadas, con la forma de
// controllers/datoQuincenaCorreoController.js: GET /dato-quincena/correo y GET /dato-quincena/ediciones/:id/correo
const CORREO = () => ({
  envio_activo: true,
  proximas: [
    { edicion: '2026-11-23', sale: '2026-11-24', motivo: 'no es hábil el lunes 23/11, Día de la Soberanía Nacional', edicion_texto: 'lunes 23/11/2026',
      texto: 'Sale el martes 24/11/2026 a las 8:05: no es hábil el lunes 23/11, Día de la Soberanía Nacional.' },
    { edicion: '2026-12-21', sale: '2026-12-21', motivo: null, edicion_texto: 'lunes 21/12/2026', texto: 'Sale ese día a las 8:05.' }
  ],
  personas: [
    { id: 31, nombre: 'PruebaUno Ejemplo', cargo: 'Cargo inventado', rol: 'Lector', email: 'uno@ejemplo.test', recibe: true, licencia: null },
    { id: 32, nombre: 'PruebaDos Ejemplo', cargo: null, rol: 'Editor', email: 'dos@ejemplo.test', recibe: false,
      licencia: 'De licencia hasta el 30/11' }
  ],
  reciben_texto: 'Lo recibe 1 persona.'
});
const CAJA = () => ({
  resumen: 'Enviada el martes 24/11/2026 a las 8:05, a 1 de 2 personas.',
  linea: 'Enviada por correo el martes 24/11/2026 a las 8:05.',
  personas: [
    { nombre: 'PruebaDos Ejemplo', texto: 'No se envió: de licencia', mal: true },
    { nombre: 'PruebaUno Ejemplo', texto: 'Enviado el 24/11 a las 8:05', mal: false }
  ],
  reenvios: [{ texto: 'Prueba enviada a PruebaTres Ejemplo el 24/11 a las 10:12.' }, { texto: 'Reenviada a PruebaDos Ejemplo el 25/11 a las 9:30.' }],
  se_puede_reenviar: true,
  lista_de_hoy: [{ id: 32, nombre: 'PruebaDos Ejemplo' }, { id: 31, nombre: 'PruebaUno Ejemplo' }]
});

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
  it('la lista: anios, anio y ediciones con id, fecha_texto, marca, principal (título y cifra), resto, numero, fecha_partes, cantidad y envio', () => {
    for (const nombre of ['lista', 'lista_dos_anios', 'lista_de_2027', 'lista_vacia', 'lista_sin_envio']) {
      const { success, data } = respuesta(nombre);
      assert.equal(success, true, nombre);
      assert.deepEqual(Object.keys(data), ['anios', 'anio', 'ediciones'], nombre);
      for (const anio of data.anios) assert.deepEqual(Object.keys(anio), ['anio', 'cantidad'], nombre);
      for (const edicion of data.ediciones) {
        assert.deepEqual(Object.keys(edicion),
          ['id', 'fecha_texto', 'marca', 'principal', 'resto', 'numero', 'fecha_partes', 'cantidad', 'envio'], nombre);
        assert.deepEqual(Object.keys(edicion.principal), ['titulo', 'cifra_clave'], nombre);
        assert.deepEqual(Object.keys(edicion.fecha_partes), ['dia', 'fecha', 'anio'], nombre);
        // La pastilla del envío (spec 2026-11-12-dato-quincena-correo, 6 y 12): { tipo, texto }, o null si no lleva
        if (edicion.envio !== null) assert.deepEqual(Object.keys(edicion.envio), ['tipo', 'texto'], nombre);
      }
    }
    assert.deepEqual(LISTA_VACIA(), { anios: [], anio: null, ediciones: [] });
  });

  it('el detalle: con su id y los textos ya armados, la agenda, las propuestas y los archivos', () => {
    const detalle = DETALLE();
    assert.deepEqual(Object.keys(detalle), [
      'id', 'fecha_texto', 'marca', 'numero', 'titulo', 'nota_archivo', 'llegada', 'correo', 'cantidad', 'agenda', 'propuestas',
      'archivos'
    ]);
    for (const evento of detalle.agenda) assert.deepEqual(Object.keys(evento), ['fecha_texto', 'titulo', 'detalle', 'url', 'etiqueta']);
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
    assert.deepEqual(detalle.archivos.map((archivo) => Object.keys(archivo)), Array(5).fill(['campo', 'rotulo', 'nombre', 'detalle', 'se_puede_ver']));
    assert.deepEqual(detalle.archivos.map((archivo) => archivo.campo),
      ['infografia_png', 'infografia_svg', 'correo_texto', 'calculos', 'metadata']);
    assert.deepEqual(respuesta('no_existe'), { success: false, error: 'No existe esa edición.' });
  });
});

describe('dato-quincena.js: la dirección', () => {
  it('estadoDeLaUrl: el id, un entero positivo, y el año, de 2000 a 2100; lo demás, null', () => {
    assert.deepEqual(plano(ctx.estadoDeLaUrl('')), { id: null, anio: null, pagina: 1, correo: false });
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?id=12')), { id: 12, anio: null, pagina: 1, correo: false });
    assert.deepEqual(plano(ctx.estadoDeLaUrl('id=7')), { id: 7, anio: null, pagina: 1, correo: false });
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?anio=2026')), { id: null, anio: 2026, pagina: 1, correo: false });
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?id=3&anio=2027')), { id: 3, anio: 2027, pagina: 1, correo: false });
    // La página (un entero positivo) y el #correo
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?anio=2026&pagina=2')), { id: null, anio: 2026, pagina: 2, correo: false });
    assert.deepEqual(plano(ctx.estadoDeLaUrl('', '#correo')), { id: null, anio: null, pagina: 1, correo: true });
    for (const pagina of ['0', '-1', 'x', '1.5', '02', '']) assert.equal(ctx.estadoDeLaUrl(`?pagina=${pagina}`).pagina, 1, pagina);
    for (const hash of ['', '#', '#otro', '#Correo', '#correo2']) assert.equal(ctx.estadoDeLaUrl('', hash).correo, false, hash);
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
    // La página, solo desde la 2 y con un año; el correo, con el #
    assert.equal(ctx.urlDeEstado({ anio: 2026, pagina: 2 }), 'dato-quincena.html?anio=2026&pagina=2');
    assert.equal(ctx.urlDeEstado({ anio: 2026, pagina: 1 }), 'dato-quincena.html?anio=2026');
    assert.equal(ctx.urlDeEstado({ pagina: 3 }), 'dato-quincena.html');
    assert.equal(ctx.urlDeEstado({ anio: 2026, pagina: '2" x' }), 'dato-quincena.html?anio=2026');
    assert.equal(ctx.urlDeEstado({ correo: true }), 'dato-quincena.html#correo');
    // El #correo va junto a lo que pide Ediciones (spec 2026-11-12-dato-quincena-correo, 13)
    assert.equal(ctx.urlDeEstado({ id: 12, correo: true }), 'dato-quincena.html?id=12#correo');
    assert.equal(ctx.urlDeEstado({ anio: 2026, pagina: 2, correo: true }), 'dato-quincena.html?anio=2026&pagina=2#correo');
    assert.equal(ctx.urlDeEstado({ anio: 2026, correo: true }), 'dato-quincena.html?anio=2026#correo');
    assert.equal(ctx.urlDeEstado({ correo: 'true' }), 'dato-quincena.html');
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

describe('dato-quincena.js: la lista en tarjetas (spec 2026-11-12-dato-quincena-correo, 13)', () => {
  const tarjetas = (html) => html.split('<li class="dq-tarjeta">').slice(1);
  const muchas = (n) => Array.from({ length: n }, (_, i) => ({ ...LISTA().ediciones[0], id: i + 1 }));

  it('con un solo año, sin los botones de los años; una tarjeta por edición, con su enlace, en el orden del servidor', () => {
    const html = ctx.htmlDeLaLista(LISTA(), 1);
    assert.ok(!html.includes('data-anio'), 'sin los botones');
    assert.ok(html.includes('<p class="dq-cuantas">Ediciones de 2026: 3</p>'));
    assert.equal(cuantas(html, /<li class="dq-tarjeta">/g), 3);
    const enlaces = [...html.matchAll(/<a class="dq-tarjeta-enlace" href="([^"]+)">/g)].map((m) => m[1]);
    assert.deepEqual(enlaces, ['dato-quincena.html?id=14', 'dato-quincena.html?id=13', 'dato-quincena.html?id=12']);
    assert.ok(html.includes('<ol class="dq-tarjetas">'));
    assert.ok(!html.includes('dq-paginas'), 'con 3 ediciones, una sola página');
    assert.ok(!html.includes('data-mini'));
  });

  it('con dos años, los botones con su cantidad y el año elegido marcado, arriba de las tarjetas', () => {
    const html = ctx.htmlDeLaLista(LISTA_DOS_ANIOS(), 1);
    assert.match(html, /<div class="dq-anios" role="group" aria-label="Año">/);
    assert.ok(html.includes('<button type="button" class="dq-chip" aria-pressed="false" data-anio="2027">2027 <b>1</b></button>'));
    assert.ok(html.includes('<button type="button" class="dq-chip dq-activo" aria-pressed="true" data-anio="2026">2026 <b>3</b></button>'));
    assert.ok(html.indexOf('data-anio="2027"') < html.indexOf('data-anio="2026"'), 'en el orden del servidor');
    assert.ok(html.indexOf('dq-lista-arriba') < html.indexOf('dq-tarjetas'));
    assert.equal(cuantas(html, /<li class="dq-tarjeta">/g), 3);
  });

  it('htmlDeAnios: con uno o ninguno, nada', () => {
    assert.equal(ctx.htmlDeAnios([], null), '');
    assert.equal(ctx.htmlDeAnios([{ anio: 2026, cantidad: 3 }], 2026), '');
    assert.equal(ctx.htmlDeAnios(null, null), '');
    const html = ctx.htmlDeAnios([{ anio: 2027, cantidad: 0 }, { anio: 2026, cantidad: 3 }], 2027);
    assert.ok(html.includes('aria-pressed="true" data-anio="2027">2027 <b>0</b>'));
    assert.ok(html.includes('aria-pressed="false" data-anio="2026">2026 <b>3</b>'));
  });

  it('la tarjeta de una regular: el N.º, la fecha en tres renglones, la cantidad, el título y la pastilla; un solo enlace', () => {
    const [regular] = LISTA().ediciones;
    const html = ctx.htmlDeTarjeta(regular);
    assert.ok(html.startsWith('<li class="dq-tarjeta">'));
    assert.ok(html.includes('<p class="dq-cabecera-diario"><span>El dato de la quincena</span><span class="dq-numero">N.º 2</span></p>'));
    // Con un espacio entre los tres renglones: copiada o leída en voz alta, la fecha dice «Lunes 16 de noviembre de 2026»
    assert.ok(html.includes('<h3 class="dq-fecha-diario"><a class="dq-tarjeta-enlace" href="dato-quincena.html?id=14">'
      + '<span class="dq-fd-dia">Lunes</span> <span class="dq-fd-fecha">16 de noviembre</span> <span class="dq-fd-anio">de 2026</span></a></h3>'));
    assert.equal(html.match(/<h3 class="dq-fecha-diario">[\s\S]*?<\/h3>/)[0].replace(/<[^>]+>/g, ''), 'Lunes 16 de noviembre de 2026');
    assert.ok(html.includes('<p class="dq-cuantas-prop">3 propuestas</p>'));
    assert.ok(html.includes(`<p class="dq-principal-diario">${esc(regular.principal.titulo)}</p>`));
    assert.match(html, /<div class="dq-tarjeta-pie"><span class="dq-envio dq-envio-enviada"><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>Enviada el lun 16\/11<\/span><\/div>/);
    assert.equal(cuantas(html, /<a /g), 1);
    assert.ok(!html.includes('dq-marca'));
    assert.ok(!html.includes('data-mini') && !html.includes('<img'));
  });

  it('la de un piloto: la marca en lugar del N.º y la pastilla de piloto', () => {
    const [, piloto] = LISTA().ediciones;
    const html = ctx.htmlDeTarjeta(piloto);
    assert.ok(html.includes('<span>El dato de la quincena</span><span class="dq-marca">Piloto 4</span>'));
    assert.ok(!html.includes('dq-numero'));
    assert.ok(html.includes('dq-envio dq-envio-piloto'));
    assert.ok(html.includes('Piloto: no se envía'));
    assert.ok(html.includes('<p class="dq-cuantas-prop">1 propuesta</p>'));
  });

  it('una edición sin envío (null) no lleva pastilla ni pie', () => {
    const [sinEnvio] = respuesta('lista_sin_envio').data.ediciones;
    assert.equal(sinEnvio.envio, null);
    const html = ctx.htmlDeTarjeta(sinEnvio);
    assert.ok(!html.includes('dq-envio'));
    assert.ok(!html.includes('dq-tarjeta-pie'));
    assert.ok(html.includes('dq-fd-fecha'));
  });

  it('cada tipo de envío tiene su clase y su ícono; uno desconocido, sin clase de color', () => {
    for (const tipo of ['enviada', 'programada', 'parcial', 'fallida', 'espera', 'no_enviada', 'piloto']) {
      const html = ctx.htmlDeTarjeta({ ...LISTA().ediciones[0], envio: { tipo, texto: 'Un texto' } });
      assert.match(html, new RegExp(`<span class="dq-envio dq-envio-${tipo}"><svg aria-hidden="true"`), tipo);
    }
    const raro = ctx.htmlDeTarjeta({ ...LISTA().ediciones[0], envio: { tipo: 'x" onclick="1', texto: 'Un texto' } });
    assert.ok(raro.includes('<span class="dq-envio">Un texto</span>'), raro);
  });

  it('una tarjeta con un id que no sirve se dibuja sin enlace; sin fecha_partes, la fecha de texto', () => {
    const [regular] = LISTA().ediciones;
    for (const id of [0, -3, '14', null, 1.5]) {
      const html = ctx.htmlDeTarjeta({ ...regular, id });
      assert.ok(!html.includes('href='), String(id));
      assert.ok(html.includes('16 de noviembre'), String(id));
    }
    const html = ctx.htmlDeTarjeta({ ...regular, fecha_partes: null });
    assert.ok(html.includes('<span class="dq-fd-fecha">Lunes 16 de noviembre de 2026</span>'), html);
  });

  it('paginaDeEdiciones: 18 por página; una pedida fuera de rango va a la última que existe', () => {
    assert.equal(constante('POR_PAGINA'), 18);
    const lista = muchas(27);
    const uno = plano(ctx.paginaDeEdiciones(lista, 1));
    assert.deepEqual({ ...uno, visibles: uno.visibles.length }, { pagina: 1, paginas: 2, desde: 1, hasta: 18, total: 27, visibles: 18 });
    const dos = plano(ctx.paginaDeEdiciones(lista, 2));
    assert.deepEqual({ ...dos, visibles: dos.visibles.map((e) => e.id) }, { pagina: 2, paginas: 2, desde: 19, hasta: 27, total: 27, visibles: [19, 20, 21, 22, 23, 24, 25, 26, 27] });
    for (const pedida of [5, 99, Infinity]) assert.equal(ctx.paginaDeEdiciones(lista, pedida).pagina, 2, String(pedida));
    for (const pedida of [0, -2, null, undefined, 'x', 1.5, NaN]) assert.equal(ctx.paginaDeEdiciones(lista, pedida).pagina, 1, String(pedida));
    assert.deepEqual(plano(ctx.paginaDeEdiciones([], 3)), { pagina: 1, paginas: 1, desde: 0, hasta: 0, total: 0, visibles: [] });
    assert.equal(ctx.paginaDeEdiciones(muchas(18), 2).paginas, 1);
    assert.equal(ctx.paginaDeEdiciones(muchas(19), 1).paginas, 2);
  });

  it('htmlDePaginasDeEdiciones: Anterior, «Página 1 de 2» con «Mostrando 1–18 de 27» y Siguiente; con una página, nada', () => {
    assert.equal(ctx.htmlDePaginasDeEdiciones({ pagina: 1, paginas: 1, desde: 1, hasta: 3, total: 3 }), '');
    const primera = ctx.htmlDePaginasDeEdiciones({ pagina: 1, paginas: 2, desde: 1, hasta: 18, total: 27 });
    assert.match(primera, /^<nav class="dq-paginas" aria-label="Páginas de las ediciones">/);
    assert.ok(primera.includes('<button type="button" class="dq-btn dq-btn-borde dq-pag" disabled>Anterior</button>'));
    assert.ok(primera.includes('<span class="dq-pagina-texto">Página 1 de 2<small>Mostrando 1–18 de 27</small></span>'));
    assert.ok(primera.includes('<button type="button" class="dq-btn dq-btn-borde dq-pag" data-pagina="2">Siguiente</button>'));
    const ultima = ctx.htmlDePaginasDeEdiciones({ pagina: 2, paginas: 2, desde: 19, hasta: 27, total: 27 });
    assert.ok(ultima.includes('data-pagina="1">Anterior</button>'));
    assert.ok(ultima.includes('disabled>Siguiente</button>'));
    assert.ok(ultima.includes('Página 2 de 2<small>Mostrando 19–27 de 27</small>'));
  });

  it('htmlDeLaLista con 27 ediciones: la página pedida, con las páginas abajo; la pedida fuera de rango, la última', () => {
    const datos = { ...LISTA(), ediciones: muchas(27) };
    const p1 = ctx.htmlDeLaLista(datos, 1);
    assert.equal(cuantas(p1, /<li class="dq-tarjeta">/g), 18);
    assert.ok(p1.includes('<p class="dq-cuantas">Ediciones de 2026: 27</p>'));
    assert.ok(p1.indexOf('dq-tarjetas') < p1.indexOf('dq-paginas'));
    const p9 = ctx.htmlDeLaLista(datos, 9);
    assert.equal(cuantas(p9, /<li class="dq-tarjeta">/g), 9);
    assert.ok(p9.includes('Página 2 de 2'));
    assert.ok(ctx.htmlDeLaLista({ ...LISTA(), ediciones: muchas(1) }, 1).includes('<p class="dq-cuantas">Ediciones de 2026: 1</p>'));
  });

  it('el archivo vacío: el texto del vacío, sin lista ni años', () => {
    const html = ctx.htmlDeLaLista(LISTA_VACIA(), 1);
    assert.equal(html, ctx.htmlDelEstado('vacio'));
    assert.ok(html.includes('Todavía no llegó ninguna edición. Datito manda cada una cada dos lunes.'));
  });

  it('las pestañas: tablist con Ediciones y Correo, la activa con aria-selected y las otras fuera del orden del teclado', () => {
    const html = ctx.htmlDePestanas('ediciones');
    assert.match(html, /^<div class="dq-pestanas" role="tablist" aria-label="El dato de la quincena">/);
    assert.ok(html.includes('<button type="button" class="dq-pestana dq-activa" role="tab" id="dq-tab-ediciones" aria-selected="true" aria-controls="dq-contenido" data-pestana="ediciones">Ediciones</button>'));
    assert.ok(html.includes('<button type="button" class="dq-pestana" role="tab" id="dq-tab-correo" aria-selected="false" aria-controls="dq-contenido" tabindex="-1" data-pestana="correo">Correo</button>'));
    const otra = ctx.htmlDePestanas('correo');
    assert.ok(otra.includes('id="dq-tab-correo" aria-selected="true"'));
    assert.ok(otra.includes('id="dq-tab-ediciones" aria-selected="false"'));
    assert.equal(cuantas(otra, /role="tab"/g), 2);
    assert.equal(ctx.htmlDePestanas('otra'), ctx.htmlDePestanas('ediciones'));
  });
});

describe('dato-quincena.js: la pastilla del envío y las páginas en la dirección', () => {
  it('color e ícono por tipo (spec 6): verde con el check, cielo con el reloj, sol con el triángulo, gris con el guion', () => {
    const html = leer('dato-quincena.html');
    const regla = (clase) => html.match(new RegExp(`[^}]*\\.${clase}[^{]*\\{([^}]*)\\}`))?.[1] ?? '';
    assert.match(regla('dq-envio-enviada'), /--sg-verde-fondo/);
    assert.match(regla('dq-envio-programada'), /--sg-cielo/);
    for (const clase of ['dq-envio-parcial', 'dq-envio-fallida', 'dq-envio-espera']) assert.match(regla(clase), /--sg-sol/, clase);
    for (const clase of ['dq-envio-no_enviada', 'dq-envio-piloto']) assert.match(regla(clase), /--sg-sutil/, clase);
    const icono = (tipo) => ctx.htmlDeLaPastilla({ tipo, texto: 't' }).match(/<svg[\s\S]*?<\/svg>/)?.[0];
    assert.match(icono('enviada'), /M20 6 9 17l-5-5/);
    assert.match(icono('programada'), /M12 6v6l4 2/);
    for (const tipo of ['parcial', 'fallida', 'espera']) assert.match(icono(tipo), /m21\.73 18/, tipo);
    for (const tipo of ['no_enviada', 'piloto']) assert.match(icono(tipo), /M8 12h8/, tipo);
  });

  it('las páginas no llevan aria-live (lo anuncia #dq-anuncio) y la lista tiene su principio enfocable', () => {
    assert.ok(!ctx.htmlDePaginasDeEdiciones({ pagina: 1, paginas: 2, desde: 1, hasta: 18, total: 27 }).includes('aria-live'));
    assert.ok(ctx.htmlDeLaLista(LISTA(), 1).includes('<div class="dq-lista-arriba" id="dq-lista-arriba" tabindex="-1">'));
  });

  it('la dirección sigue a la página (también al volver a la 1) y un clic de página con un año en camino no hace nada', () => {
    const c = cargar();
    const urls = [];
    const lugares = { 'dq-contenido': { innerHTML: '', querySelector: () => null }, 'dq-lista-arriba': { focus() {}, scrollIntoView() {} } };
    c.document = { ...documentoMinimo(), getElementById: (id) => lugares[id] ?? null };
    c.window = { history: { replaceState: (_a, _b, url) => urls.push(url) }, location: { search: '', hash: '' } };
    const ediciones = Array.from({ length: 27 }, (_, i) => ({ ...LISTA().ediciones[0], id: i + 1 }));
    vm.runInContext(`vistaDatoQuincena.datos = { anios: [], anio: 2026, ediciones: ${JSON.stringify(ediciones)} }; vistaDatoQuincena.anio = 2026;`, c);
    const clic = (n) => c.irAPaginaDq({ dataset: { pagina: String(n) } });
    clic(2);
    clic(1);
    assert.deepEqual(urls, ['dato-quincena.html?anio=2026&pagina=2', 'dato-quincena.html?anio=2026']);
    vm.runInContext('vistaDatoQuincena.cargando = true', c);
    clic(2);
    assert.equal(urls.length, 2);
  });
});

describe('dato-quincena.js: la bajada y las constantes', () => {
  it('el nombre del bot y los textos que lo nombran', () => {
    assert.equal(constante('NOMBRE_DEL_BOT'), 'Datito');
    assert.equal(ctx.textoDeLaBajada(), 'Las propuestas de comunicación que arma Datito cada dos lunes, tal como llegaron. '
      + 'Son internas: guardarlas acá no las aprueba ni las publica. El RPAD las manda por correo a las personas de la lista.');
  });
});

describe('dato-quincena.js: el detalle (spec, 10)', () => {
  it('«Todas las ediciones», la fecha, el título, la llegada, el correo, la cantidad y la nota de archivo', () => {
    const detalle = DETALLE();
    const html = ctx.htmlDelDetalle(detalle);
    assert.match(html, /<a class="dq-link dq-volver" href="dato-quincena\.html"><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>Todas las ediciones<\/a>/);
    // El número de la regular, junto a la fecha como la marca de un piloto
    assert.ok(html.includes('<h2 class="dq-fecha">Lunes 2 de noviembre de 2026<span class="dq-marca">N.º 1</span></h2>'));
    assert.ok(ctx.htmlDelDetalle({ ...detalle, numero: null }).includes('<h2 class="dq-fecha">Lunes 2 de noviembre de 2026</h2>'));
    assert.ok(html.includes(`<p class="dq-titulo-paquete">${esc(detalle.titulo)}</p>`));
    // La cantidad del servidor tal cual, y el punto final lo pone la página (como en la maqueta)
    assert.ok(html.includes('<p class="dq-recibo">Llegó al RPAD el 02/11/2026 a las 08:14. Correo enviado el 02/11/2026 a las 08:12, según Datito. 2 propuestas.</p>'));
    // Sin la cantidad, sin ese punto
    assert.ok(ctx.htmlDelDetalle({ ...detalle, cantidad: null }).includes('<p class="dq-recibo">Llegó al RPAD el 02/11/2026 a las 08:14. Correo enviado el 02/11/2026 a las 08:12, según Datito.</p>'));
    assert.ok(html.includes(`<p class="dq-nota-archivo"><b>Nota de Datito:</b> ${esc(detalle.nota_archivo)}</p>`));
    assert.ok(html.indexOf('dq-volver') < html.indexOf('dq-fecha'));
  });

  it('un piloto lleva su marca junto a la fecha', () => {
    const html = ctx.htmlDelDetalle({ ...DETALLE(), marca: 'Piloto 4', numero: null });
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
    assert.ok(ctx.htmlDelDetalle(DETALLE()).includes(ctx.htmlDeLaAgenda(DETALLE().agenda)), 'en el detalle');
    assert.equal(ctx.htmlDeLaAgenda([]), '');
    assert.equal(ctx.htmlDeLaAgenda(null), '');
    assert.ok(!ctx.htmlDelDetalle({ ...DETALLE(), agenda: [] }).includes('dq-agenda'));
    // Una dirección que no es https://, sin enlace
    const sinEnlace = ctx.htmlDeLaAgenda([{ ...evento, url: 'javascript:alert(1)' }]);
    assert.ok(!sinEnlace.includes('<a '), sinEnlace);
    assert.ok(!sinEnlace.includes('javascript:'), sinEnlace);
  });

  it('en la agenda, la etiqueta suave «Efeméride» (texto, no solo color) en los ítems que la traen', () => {
    const [sin, con] = DETALLE().agenda;
    assert.equal(sin.etiqueta, null);
    assert.equal(con.etiqueta, 'Efeméride');
    const html = ctx.htmlDeLaAgenda([sin, con]);
    assert.equal(cuantas(html, /dq-etiqueta-agenda/g), 1);
    assert.ok(html.includes('<span class="dq-etiqueta-agenda">Efeméride</span>'));
    const raro = ctx.htmlDeLaAgenda([{ ...con, etiqueta: XSS }]);
    assert.ok(raro.includes(`<span class="dq-etiqueta-agenda">${XSS_ESCAPADO}</span>`) && !raro.includes('<img'));
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

  it('los archivos: los cinco, con «Descargar» en cada uno y «Ver» solo en el texto y los cálculos', () => {
    const detalle = DETALLE();
    const html = ctx.htmlDeArchivos(detalle.archivos, detalle.id);
    assert.match(html, /^<section class="dq-archivos" aria-labelledby="dq-archivos-titulo"><h3 id="dq-archivos-titulo">Archivos<\/h3><ul>/);
    assert.equal(cuantas(html, /<li>/g), 5);
    assert.equal(cuantas(html, />Descargar<\/button>/g), 5);
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
    // Sin los cálculos, cuatro; sin un id que sirva, nada (no hay a dónde pedirlos)
    assert.equal(cuantas(ctx.htmlDeArchivos(detalle.archivos.filter((a) => a.campo !== 'calculos'), 12), /<li>/g), 4);
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
      '<p class="dq-estado">Todavía no llegó ninguna edición. Datito manda cada una cada dos lunes.</p>');
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
    const html = ctx.htmlDeLaLista(datos, 1);
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
    const todo = [ctx.htmlDeLaLista(LISTA_DOS_ANIOS(), 1), ctx.htmlDeLaLista(LISTA_VACIA(), 1), ctx.htmlDelDetalle(DETALLE()), ctx.htmlDePestanas('ediciones'),
      ctx.htmlDelDetalle(DETALLE(), { admin: true }), ctx.htmlDelCorreo(CORREO()), ctx.htmlDelCorreo({ ...CORREO(), proximas: [] }),
      ctx.htmlDeLaCajaDelCorreo(CAJA()), ctx.htmlDeLaCajaDelCorreo(null), ctx.htmlDelReenvio(CAJA().lista_de_hoy), ctx.htmlDelReenvio([]),
      ctx.htmlDelEstado('error-correo'),
      ctx.htmlDeLaLista({ ...LISTA(), ediciones: Array.from({ length: 30 }, (_, i) => ({ ...LISTA().ediciones[0], id: i + 1 })) }, 1),
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

describe('dato-quincena.js: la pestaña Correo (spec 2026-11-12-dato-quincena-correo, 13)', () => {
  // La copia del navegador (CLAUDE.md, «El servidor manda»): cuenta mientras se tilda, con el mismo texto que el servidor
  it('textoDeLosQueReciben: la misma regla que la del servidor', () => {
    for (let n = 0; n <= 25; n++) assert.equal(ctx.textoDeLosQueReciben(n), textoDeLosQueReciben(n), String(n));
    assert.equal(ctx.textoDeLosQueReciben(1), 'Lo recibe 1 persona.');
  });

  it('htmlDelCorreo: «Envío por correo» con el interruptor prendido, la regla y las próximas; «Quién lo recibe» con la tabla', () => {
    const html = ctx.htmlDelCorreo(CORREO());
    assert.match(html, /^<div class="dq-correo"><section class="dq-caja" aria-labelledby="dq-auto-titulo">/);
    assert.equal(cuantas(html, /<section class="dq-caja"/g), 2);
    assert.ok(html.includes('<h2 id="dq-auto-titulo">Envío por correo</h2>'));
    assert.ok(html.includes('<h2 id="dq-quien-titulo">Quién lo recibe</h2>'));
    assert.ok(html.indexOf('dq-auto-titulo') < html.indexOf('dq-quien-titulo'));
    // El interruptor: una casilla con role="switch", prendida, y el texto que dice cómo está (nunca solo el color)
    assert.ok(html.includes('<label class="dq-switch" for="dq-envio-activo"><input type="checkbox" id="dq-envio-activo" role="switch" aria-label="Envío automático" checked>'
      + '<span id="dq-envio-estado">Envío automático prendido</span></label>'));
    // La regla y lo que pasa apagado
    assert.ok(html.includes('a las <b>8:05 del primer día hábil</b> en que ya está en el RPAD. Si llega después de las 8:05 de un día hábil, sale a las 14:00. Los pilotos no se envían.'));
    assert.ok(html.includes('Apagado, las ediciones se siguen guardando acá y no sale ningún mail.'));
    // Las próximas, con los textos del servidor; la que se corre, marcada (el texto dice por qué)
    assert.ok(html.includes('<h3 class="dq-caja-subtitulo">Las próximas ediciones</h3><ul class="dq-proximas">'
      + '<li><b>Edición del lunes 23/11/2026</b><span class="dq-corrida">Sale el martes 24/11/2026 a las 8:05: no es hábil el lunes 23/11, Día de la Soberanía Nacional.</span></li>'
      + '<li><b>Edición del lunes 21/12/2026</b><span>Sale ese día a las 8:05.</span></li></ul>'));
    // La tabla: persona y cargo (y la licencia), rol, correo y «Lo recibe»
    assert.ok(html.includes('<table class="dq-tabla" aria-labelledby="dq-quien-titulo"><thead><tr><th scope="col">Persona</th><th scope="col">Rol</th>'
      + '<th scope="col" class="dq-col-correo">Correo</th><th scope="col" class="dq-col-recibe">Lo recibe</th></tr></thead>'));
    assert.ok(html.includes('<tr><td>PruebaUno Ejemplo<small>Cargo inventado</small></td><td>Lector</td><td class="dq-col-correo">uno@ejemplo.test</td>'
      + '<td class="dq-col-recibe"><input type="checkbox" data-usuario="31" aria-label="PruebaUno Ejemplo recibe el mail" checked></td></tr>'));
    assert.ok(html.includes('<tr><td>PruebaDos Ejemplo<small class="dq-licencia">De licencia hasta el 30/11</small></td><td>Editor</td><td class="dq-col-correo">dos@ejemplo.test</td>'
      + '<td class="dq-col-recibe"><input type="checkbox" data-usuario="32" aria-label="PruebaDos Ejemplo recibe el mail"></td></tr>'));
    // El pie: el texto del servidor tal cual («Lo recibe 1 persona.», no «Lo reciben 1 personas.») y «Guardar»
    assert.ok(html.includes('<div class="dq-correo-pie"><p class="dq-suave" id="dq-cuantas-reciben">Lo recibe 1 persona.</p>'
      + '<button type="button" class="dq-btn dq-btn-tinta" data-guardar-lista>Guardar</button></div>'));
    assert.ok(!html.includes('Lo reciben 1'));
  });

  it('apagado, sin checked y lo dice; sin próximas (no se pudo leer el calendario), lo dice; una persona sin un id que sirva, sin casilla', () => {
    const html = ctx.htmlDelCorreo({ ...CORREO(), envio_activo: false, proximas: [] });
    assert.ok(html.includes('<input type="checkbox" id="dq-envio-activo" role="switch" aria-label="Envío automático"><span id="dq-envio-estado">Envío automático apagado</span>'));
    assert.ok(!html.includes('dq-proximas'));
    assert.ok(html.includes('<p class="dq-suave">No se pudieron estimar las próximas ediciones. Probá de nuevo en unos minutos.</p>'));
    // Solo el true literal está prendido
    assert.ok(ctx.htmlDelCorreo({ ...CORREO(), envio_activo: 'true' }).includes('Envío automático apagado'));
    const rara = ctx.htmlDelCorreo({ ...CORREO(), personas: [{ ...CORREO().personas[0], id: '31" onclick="x' }] });
    assert.ok(!rara.includes('data-usuario'), rara);
  });

  it('htmlDeLaCajaDelCorreo: el resumen, una fila por persona (la que no lo recibió, en ámbar con su texto), los reenvíos y los botones', () => {
    const html = ctx.htmlDeLaCajaDelCorreo(CAJA());
    assert.match(html, /^<section class="dq-envio-caja" aria-labelledby="dq-caja-correo-titulo"><h3 id="dq-caja-correo-titulo">Correo<\/h3>/);
    assert.ok(html.includes('<p>Enviada el martes 24/11/2026 a las 8:05, a 1 de 2 personas.</p>'));
    assert.ok(html.includes('<ul class="dq-envio-personas"><li><span>PruebaDos Ejemplo</span><small><span class="dq-mal">No se envió: de licencia</span></small></li>'
      + '<li><span>PruebaUno Ejemplo</span><small>Enviado el 24/11 a las 8:05</small></li></ul>'));
    assert.ok(html.includes('<ul class="dq-envio-a-mano"><li>Prueba enviada a PruebaTres Ejemplo el 24/11 a las 10:12.</li><li>Reenviada a PruebaDos Ejemplo el 25/11 a las 9:30.</li></ul>'));
    assert.ok(html.includes('<div class="dq-envio-acciones"><button type="button" class="dq-btn dq-btn-borde dq-btn-chico" data-reenviar aria-haspopup="dialog">Reenviar…</button>'
      + '<button type="button" class="dq-btn dq-btn-borde dq-btn-chico" data-prueba>Enviarme una prueba</button></div></section>'));
    // La línea del detalle no se repite en la caja
    assert.ok(!html.includes(CAJA().linea));
  });

  it('sin se_puede_reenviar, sin «Reenviar…» (la prueba sigue); sin personas ni reenvíos, sin esas listas; sin datos, el error', () => {
    for (const se_puede_reenviar of [false, 'true', 1, null]) {
      const html = ctx.htmlDeLaCajaDelCorreo({ ...CAJA(), se_puede_reenviar });
      assert.ok(!html.includes('data-reenviar'), String(se_puede_reenviar));
      assert.ok(html.includes('data-prueba>Enviarme una prueba</button>'), String(se_puede_reenviar));
    }
    const sola = ctx.htmlDeLaCajaDelCorreo({ ...CAJA(), personas: [], reenvios: [], resumen: 'Los pilotos no se envían por correo.' });
    assert.ok(!sola.includes('<ul'), sola);
    assert.ok(sola.includes('<p>Los pilotos no se envían por correo.</p>'));
    for (const datos of [null, undefined, 'x']) {
      const error = ctx.htmlDeLaCajaDelCorreo(datos);
      assert.ok(error.includes('<p>No se pudo cargar el correo de esta edición. Probá de nuevo en unos minutos.</p>'), String(datos));
      assert.ok(!error.includes('<button'), String(datos));
    }
  });

  it('htmlDelReenvio: «A todas las personas que hoy lo reciben (N)» o «A una persona:» con la lista de hoy, y la nota', () => {
    const html = ctx.htmlDelReenvio(CAJA().lista_de_hoy);
    assert.ok(html.startsWith('<fieldset class="dq-opciones"><legend class="visualmente-oculto">A quién se reenvía</legend>'));
    assert.ok(html.includes('<label><input type="radio" name="dq-a" value="todas" checked> <span>A todas las personas que hoy lo reciben (2)</span></label>'));
    assert.ok(html.includes('<label><input type="radio" name="dq-a" value="una"> <span id="dq-reenvio-una">A una persona:</span></label>'));
    assert.ok(html.includes('<select id="dq-reenvio-persona" aria-labelledby="dq-reenvio-una">'
      + '<option value="32">PruebaDos Ejemplo</option><option value="31">PruebaUno Ejemplo</option></select>'));
    assert.ok(html.endsWith('</fieldset><p class="dq-reenvio-nota">Sale ahora, aunque hoy no sea día hábil, con el mismo asunto.</p>'));
    // Sin nadie en la lista, solo «a todas (0)» (el servidor dice que la lista está vacía)
    const vacia = ctx.htmlDelReenvio([]);
    assert.ok(vacia.includes('A todas las personas que hoy lo reciben (0)'));
    assert.ok(!vacia.includes('<select') && !vacia.includes('value="una"'));
    // Una persona sin un id que sirva no va
    assert.ok(!ctx.htmlDelReenvio([{ id: '7" x', nombre: 'Rara' }]).includes('Rara'));
  });

  it('el detalle de la administración tiene el lugar de la caja debajo de «Archivos»; el de los demás, no', () => {
    const admin = ctx.htmlDelDetalle(DETALLE(), { admin: true });
    assert.ok(admin.includes('<aside class="dq-lateral dq-lateral-con-correo" aria-label="Infografía, archivos y correo">'));
    assert.ok(admin.includes('<div id="dq-envio-lugar"><section class="dq-envio-caja" aria-label="Correo"><h3>Correo</h3><p>Cargando…</p></section></div></aside>'));
    assert.ok(admin.indexOf('dq-archivos') < admin.indexOf('dq-envio-lugar'));
    for (const otro of [ctx.htmlDelDetalle(DETALLE()), ctx.htmlDelDetalle(DETALLE(), { admin: 'true' })]) {
      assert.ok(!otro.includes('dq-envio'), 'sin la caja');
      assert.ok(otro.includes('<aside class="dq-lateral" aria-label="Infografía y archivos">'));
    }
    // Sin un id que sirva, sin caja: no hay a dónde pedirla
    assert.ok(!ctx.htmlDelDetalle({ ...DETALLE(), id: 0 }, { admin: true }).includes('dq-envio-lugar'));
  });

  it('htmlDelRecibo: la llegada, el correo y la cantidad (el renglón que se vuelve a dibujar después de un reenvío)', () => {
    assert.equal(ctx.htmlDelRecibo(DETALLE()), 'Llegó al RPAD el 02/11/2026 a las 08:14. Correo enviado el 02/11/2026 a las 08:12, según Datito. 2 propuestas.');
    assert.equal(ctx.htmlDelRecibo({ ...DETALLE(), correo: XSS }), `Llegó al RPAD el 02/11/2026 a las 08:14. ${XSS_ESCAPADO} 2 propuestas.`);
    assert.ok(ctx.htmlDelDetalle(DETALLE()).includes(`<p class="dq-recibo">${ctx.htmlDelRecibo(DETALLE())}</p>`));
  });

  it('todo texto del servidor va escapado: un nombre con <b>, también en aria-label y en las opciones', () => {
    const nombre = '<b>Negrita</b>';
    const correo = ctx.htmlDelCorreo(conTextos(CORREO(), XSS));
    assert.ok(!correo.includes('<img'), correo);
    assert.ok(cuantas(correo, /&lt;img src=x onerror=1&gt;/g) >= 12);
    const conNombre = ctx.htmlDelCorreo({ ...CORREO(), personas: [{ ...CORREO().personas[0], nombre }] });
    assert.ok(conNombre.includes('aria-label="&lt;b&gt;Negrita&lt;/b&gt; recibe el mail"'));
    assert.ok(!conNombre.includes('<b>Negrita'));
    const caja = ctx.htmlDeLaCajaDelCorreo(conTextos(CAJA(), XSS));
    assert.ok(!caja.includes('<img'), caja);
    assert.ok(cuantas(caja, /&lt;img src=x onerror=1&gt;/g) >= 5);
    const reenvio = ctx.htmlDelReenvio([{ id: 31, nombre }]);
    assert.ok(reenvio.includes('<option value="31">&lt;b&gt;Negrita&lt;/b&gt;</option>'));
    assert.ok(!reenvio.includes('<b>Negrita'));
  });

  it('el error de la pestaña: su propio texto', () => {
    assert.equal(ctx.htmlDelEstado('error-correo'),
      '<div class="dq-estado dq-error" role="alert"><p>No se pudo cargar el correo. Probá de nuevo en unos minutos.</p></div>');
  });
});

// ---- La parte del DOM, con una página falsa: lo justo para ver qué se pide, qué se muestra y qué se deshabilita ----

// Un elemento falso
const falso = (props = {}) => {
  const clases = new Set();
  const atributos = {};
  return {
    textContent: '', innerHTML: '', dataset: {}, disabled: false, checked: false, value: '', isConnected: true,
    classList: { add: (c) => clases.add(c), remove: (c) => clases.delete(c), contains: (c) => clases.has(c) },
    setAttribute: (n, v) => { atributos[n] = String(v); }, getAttribute: (n) => atributos[n] ?? null, atributos,
    addEventListener() {}, focus() {}, querySelector: () => null, querySelectorAll: () => [],
    ...props
  };
};

/**
 * Una página falsa con dato-quincena.js cargado: `lugares` son los elementos por id; `responder(metodo, ruta, cuerpo)` contesta
 * cada API.pedirJson (o tira). Devuelve el contexto, los pedidos, los avisos, las direcciones escritas y lo que se enganchó.
 */
const paginaFalsa = ({ admin = true, search = '', hash = '', lugares = {}, responder = () => ({ success: true, data: {} }), confirmar = () => true } = {}) => {
  const c = cargar();
  const pedidos = [];
  const avisos = [];
  const urls = [];
  const oyentes = {};
  const confirmaciones = [];
  const location = { search, hash, href: '' };
  const todos = { 'dq-contenido': falso(), 'dq-pestanas': falso(), 'dq-anuncio': falso(), 'dq-bajada': falso(), 'dq-modal': falso(),
    'dq-modal-descargar': falso(), 'dq-reenvio': falso(), 'dq-reenvio-confirmar': falso(), 'dq-reenvio-cuerpo': falso(), ...lugares };
  c.document = { ...documentoMinimo(), title: '', getElementById: (id) => todos[id] ?? null, addEventListener: (tipo, f) => { oyentes[`document:${tipo}`] = f; } };
  c.window = {
    location,
    history: { replaceState: (_a, _b, url) => {
      urls.push(url);
      const [sinHash, resto] = url.split('#');
      location.search = sinHash.includes('?') ? sinHash.slice(sinHash.indexOf('?')) : '';
      location.hash = resto === undefined ? '' : `#${resto}`;
    } },
    confirm: (texto) => { confirmaciones.push(texto); return confirmar(texto); },
    addEventListener: (tipo, f) => { oyentes[`window:${tipo}`] = f; },
    matchMedia: () => ({ matches: false })
  };
  c.Auth = { isAuthenticated: () => true, isAdmin: () => admin };
  // API es un const de api.js (no una propiedad del global del vm): se cambian sus métodos
  const api = vm.runInContext('API', c);
  api.pedirJson = async (metodo, ruta, cuerpo) => {
    // El cuerpo es un objeto del vm: se guarda una copia de acá (deepStrictEqual compara prototipos)
    pedidos.push(cuerpo === undefined ? [metodo, ruta] : [metodo, ruta, plano(cuerpo)]);
    return responder(metodo, ruta, cuerpo);
  };
  api.pedirArchivo = async () => { throw new Error('sin archivos en la prueba'); };
  c.showToast = (mensaje, tipo) => avisos.push([mensaje, tipo]);
  c.console = { ...console, error() {} };
  return { c, pedidos, avisos, urls, oyentes, confirmaciones, todos, location };
};
const errorDelServidor = (status, mensaje) => Object.assign(new Error(mensaje), { status });
const LISTA_RESPUESTA = () => ({ success: true, data: LISTA() });

describe('dato-quincena.js: el interruptor, «Guardar», la caja del detalle y quién pide qué (la parte del DOM)', () => {
  const interruptor = (checked) => falso({ id: 'dq-envio-activo', checked });

  it('al prender pregunta; si no se confirma, vuelve a apagado y no pide nada', async () => {
    const { c, pedidos, confirmaciones } = paginaFalsa({ confirmar: () => false, lugares: { 'dq-envio-estado': falso() } });
    const casilla = interruptor(true);
    await c.cambiarEnvioDq(casilla);
    assert.deepEqual(confirmaciones, ['Desde ahora, cada edición regular que llegue sale por correo a la lista. ¿Prendemos el envío automático?']);
    assert.equal(casilla.checked, false);
    assert.deepEqual(pedidos, []);
  });

  it('al prender y confirmar: PUT con el true literal, deshabilitado mientras tanto; el texto del interruptor y el aviso del servidor, escapado', async () => {
    let casilla;
    const estado = falso();
    const { c, pedidos, avisos } = paginaFalsa({
      lugares: { 'dq-envio-estado': estado },
      responder: () => {
        assert.equal(casilla.disabled, true, 'deshabilitado hasta la respuesta');
        return { success: true, data: { envio_activo: true }, message: 'El envío automático quedó <prendido>.' };
      }
    });
    casilla = interruptor(true);
    await c.cambiarEnvioDq(casilla);
    assert.deepEqual(pedidos, [['PUT', '/dato-quincena/correo/envio', { activo: true }]]);
    assert.equal(casilla.checked, true);
    assert.equal(casilla.disabled, false);
    assert.equal(estado.textContent, 'Envío automático prendido');
    assert.deepEqual(avisos, [['El envío automático quedó &lt;prendido&gt;.', 'success']]);
  });

  it('si el PUT falla, vuelve a como estaba y avisa con el error del servidor (escapado); sin respuesta, un texto fijo', async () => {
    const estado = falso();
    const { c, avisos } = paginaFalsa({
      lugares: { 'dq-envio-estado': estado },
      responder: () => { throw errorDelServidor(400, 'Elegí <si> el envío automático queda prendido o apagado.'); }
    });
    const casilla = interruptor(true);
    await c.cambiarEnvioDq(casilla);
    assert.equal(casilla.checked, false);
    assert.equal(casilla.disabled, false);
    assert.equal(estado.textContent, 'Envío automático apagado');
    assert.deepEqual(avisos, [['Elegí &lt;si&gt; el envío automático queda prendido o apagado.', 'error']]);
    // Sin respuesta del servidor (la red), el texto fijo; al apagar, sin preguntar
    const otra = paginaFalsa({ lugares: { 'dq-envio-estado': falso() }, responder: () => { throw new TypeError('Failed to fetch'); } });
    const apagar = interruptor(false);
    await otra.c.cambiarEnvioDq(apagar);
    assert.deepEqual(otra.confirmaciones, []);
    assert.equal(apagar.checked, true, 'vuelve a prendido');
    assert.deepEqual(otra.avisos, [['No se pudo cambiar el envío automático. Probá de nuevo en unos minutos.', 'error']]);
  });

  it('al apagar no pregunta: PUT con false', async () => {
    const { c, pedidos, confirmaciones } = paginaFalsa({
      lugares: { 'dq-envio-estado': falso() }, responder: () => ({ success: true, data: { envio_activo: false }, message: 'Listo.' })
    });
    const casilla = interruptor(false);
    await c.cambiarEnvioDq(casilla);
    assert.deepEqual(confirmaciones, []);
    assert.deepEqual(pedidos, [['PUT', '/dato-quincena/correo/envio', { activo: false }]]);
    assert.equal(casilla.checked, false);
  });

  it('tildar cuenta en vivo con la copia de la regla; «Guardar» manda los tildados y queda deshabilitado hasta la respuesta', async () => {
    const casillas = [falso({ checked: true, dataset: { usuario: '31' } }), falso({ checked: false, dataset: { usuario: '32' } }),
      falso({ checked: true, dataset: { usuario: '33' } })];
    const cuantasReciben = falso();
    let boton;
    const contenido = falso({ querySelectorAll: (selector) => (selector === 'input[data-usuario]' ? casillas : []) });
    const { c, pedidos, avisos } = paginaFalsa({
      lugares: { 'dq-contenido': contenido, 'dq-cuantas-reciben': cuantasReciben },
      responder: () => {
        assert.equal(boton.disabled, true, 'deshabilitado hasta la respuesta');
        return { success: true, data: { usuarios: [31, 33] }, message: 'Se guardó la lista: lo reciben 2 personas.' };
      }
    });
    c.contarLosQueRecibenDq();
    assert.equal(cuantasReciben.textContent, 'Lo reciben 2 personas.');
    casillas[2].checked = false;
    c.contarLosQueRecibenDq();
    assert.equal(cuantasReciben.textContent, 'Lo recibe 1 persona.');
    casillas[0].checked = false;
    c.contarLosQueRecibenDq();
    assert.equal(cuantasReciben.textContent, 'Todavía no lo recibe nadie.');
    casillas[0].checked = true;
    casillas[2].checked = true;
    boton = falso();
    const guardando = c.guardarListaDq(boton);
    await c.guardarListaDq(boton);
    await guardando;
    assert.deepEqual(pedidos, [['PUT', '/dato-quincena/correo/destinatarios', { usuarios: [31, 33] }]], 'un doble clic manda un solo pedido');
    assert.equal(boton.disabled, false);
    assert.deepEqual(avisos, [['Se guardó la lista: lo reciben 2 personas.', 'success']]);
  });

  it('solo la administración pide el correo: un lector con #correo ve la lista; su detalle no pide la caja', async () => {
    const lista = paginaFalsa({ admin: false, hash: '#correo', responder: LISTA_RESPUESTA });
    await lista.c.iniciarDatoQuincena();
    assert.deepEqual(lista.pedidos, [['GET', '/dato-quincena/ediciones']]);
    assert.equal(lista.todos['dq-pestanas'].innerHTML, '', 'sin pestañas');
    assert.equal(lista.todos['dq-contenido'].getAttribute('role'), null, 'sin tabpanel');
    assert.equal(lista.oyentes['window:hashchange'], undefined);
    const detalle = paginaFalsa({ admin: false, search: '?id=12', responder: () => ({ success: true, data: DETALLE() }) });
    await detalle.c.iniciarDatoQuincena();
    assert.deepEqual(detalle.pedidos, [['GET', '/dato-quincena/ediciones/12']]);
    assert.ok(!detalle.todos['dq-contenido'].innerHTML.includes('dq-envio'));
  });

  it('la administración: el detalle pide su caja y la dibuja debajo de «Archivos»; si no llega, el error en la caja', async () => {
    const lugar = falso();
    const { c, pedidos, todos } = paginaFalsa({
      search: '?id=12', lugares: { 'dq-envio-lugar': lugar },
      responder: (_m, ruta) => ({ success: true, data: ruta.endsWith('/correo') ? CAJA() : DETALLE() })
    });
    await c.iniciarDatoQuincena();
    assert.deepEqual(pedidos, [['GET', '/dato-quincena/ediciones/12'], ['GET', '/dato-quincena/ediciones/12/correo']]);
    assert.ok(todos['dq-contenido'].innerHTML.includes('id="dq-envio-lugar"'));
    assert.equal(lugar.innerHTML, c.htmlDeLaCajaDelCorreo(CAJA()));
    assert.equal(todos['dq-contenido'].getAttribute('role'), 'tabpanel');
    assert.equal(todos['dq-contenido'].getAttribute('aria-labelledby'), 'dq-tab-ediciones');
    const fallo = paginaFalsa({
      search: '?id=12', lugares: { 'dq-envio-lugar': falso() },
      responder: (_m, ruta) => { if (ruta.endsWith('/correo')) throw errorDelServidor(500, 'Error al obtener el correo de la edición'); return { success: true, data: DETALLE() }; }
    });
    await fallo.c.iniciarDatoQuincena();
    assert.equal(fallo.todos['dq-envio-lugar'].innerHTML, fallo.c.htmlDeLaCajaDelCorreo(null));
  });

  it('las pestañas conservan ?anio y &pagina (y ?id) junto a #correo, el título sigue a la vista y #correo en la dirección cambia de pestaña', async () => {
    // 27 ediciones: la página 2 existe
    const ediciones = Array.from({ length: 27 }, (_, i) => ({ ...LISTA().ediciones[0], id: i + 1 }));
    const { c, pedidos, urls, oyentes, todos, location } = paginaFalsa({
      search: '?anio=2026&pagina=2',
      responder: (_m, ruta) => ({ success: true, data: ruta === '/dato-quincena/correo' ? CORREO() : { ...LISTA(), ediciones } })
    });
    await c.iniciarDatoQuincena();
    assert.deepEqual(pedidos, [['GET', '/dato-quincena/ediciones?anio=2026']]);
    assert.equal(c.document.title, 'El dato de la quincena - RPAD');
    await c.elegirPestanaDq('correo');
    assert.equal(urls.at(-1), 'dato-quincena.html?anio=2026&pagina=2#correo');
    assert.deepEqual(pedidos.at(-1), ['GET', '/dato-quincena/correo']);
    assert.equal(todos['dq-contenido'].innerHTML, c.htmlDelCorreo(CORREO()));
    assert.equal(todos['dq-contenido'].getAttribute('aria-labelledby'), 'dq-tab-correo');
    assert.equal(c.document.title, 'Correo - El dato de la quincena - RPAD');
    await c.elegirPestanaDq('ediciones');
    assert.equal(urls.at(-1), 'dato-quincena.html?anio=2026&pagina=2');
    assert.deepEqual(pedidos.at(-1), ['GET', '/dato-quincena/ediciones?anio=2026']);
    assert.equal(c.document.title, 'El dato de la quincena - RPAD');
    // Un #correo que llega por la dirección (un enlace, el botón atrás) cambia de pestaña; el mismo, no vuelve a pedir
    location.hash = '#correo';
    await oyentes['window:hashchange']();
    assert.deepEqual(pedidos.at(-1), ['GET', '/dato-quincena/correo']);
    const cuantos = pedidos.length;
    await oyentes['window:hashchange']();
    assert.equal(pedidos.length, cuantos);
    // Desde el detalle: ?id=12#correo y de vuelta el detalle
    const detalle = paginaFalsa({ search: '?id=12', lugares: { 'dq-envio-lugar': falso() },
      responder: (_m, ruta) => ({ success: true, data: ruta === '/dato-quincena/correo' ? CORREO() : (ruta.endsWith('/correo') ? CAJA() : DETALLE()) }) });
    await detalle.c.iniciarDatoQuincena();
    await detalle.c.elegirPestanaDq('correo');
    assert.equal(detalle.urls.at(-1), 'dato-quincena.html?id=12#correo');
    await detalle.c.elegirPestanaDq('ediciones');
    assert.equal(detalle.urls.at(-1), 'dato-quincena.html?id=12');
    assert.deepEqual(detalle.pedidos.at(-2), ['GET', '/dato-quincena/ediciones/12']);
    assert.equal(detalle.c.document.title, 'Lunes 2 de noviembre de 2026 - El dato de la quincena - RPAD');
  });

  it('cargar con #correo (administración) abre la pestaña Correo, también con ?id; si falla, su error', async () => {
    const { c, pedidos, todos } = paginaFalsa({ search: '?id=12', hash: '#correo', responder: () => ({ success: true, data: CORREO() }) });
    await c.iniciarDatoQuincena();
    assert.deepEqual(pedidos, [['GET', '/dato-quincena/correo']]);
    assert.ok(todos['dq-pestanas'].innerHTML.includes('id="dq-tab-correo" aria-selected="true"'));
    const fallo = paginaFalsa({ hash: '#correo', responder: () => { throw errorDelServidor(500, 'x'); } });
    await fallo.c.iniciarDatoQuincena();
    assert.equal(fallo.todos['dq-contenido'].innerHTML, fallo.c.htmlDelEstado('error-correo'));
  });

  it('«Reenviar…»: a una persona manda su id; cierra el diálogo, avisa y vuelve a pedir la caja y la línea; a todas, «todas»', async () => {
    const elegida = { value: 'una' };
    const modal = falso({ querySelector: (selector) => (selector === 'input[name="dq-a"]:checked' ? elegida : null) });
    const persona = falso({ value: '31' });
    const recibo = falso();
    const lugar = falso();
    const contenido = falso({ querySelector: (selector) => (selector === '.dq-recibo' ? recibo : null) });
    let confirmar;
    const { c, pedidos, avisos, todos } = paginaFalsa({
      lugares: { 'dq-reenvio': modal, 'dq-reenvio-persona': persona, 'dq-envio-lugar': lugar, 'dq-contenido': contenido },
      responder: (metodo, ruta) => {
        if (metodo === 'POST') {
          assert.equal(confirmar.disabled, true, 'deshabilitado hasta la respuesta');
          return { success: true, data: { enviados: 1, fallidos: 0 }, message: 'Se reenvió a 1 persona.' };
        }
        assert.equal(ruta, '/dato-quincena/ediciones/12/correo');
        return { success: true, data: { ...CAJA(), linea: 'Reenviada por correo el miércoles 25/11/2026 a las 10:12.' } };
      }
    });
    vm.runInContext(`vistaDatoQuincena.detalle = ${JSON.stringify(DETALLE())}; vistaDatoQuincena.caja = ${JSON.stringify(CAJA())};`, c);
    const abrir = falso({ dataset: {} });
    c.abrirReenvioDq(abrir);
    assert.equal(todos['dq-reenvio-cuerpo'].innerHTML, c.htmlDelReenvio(CAJA().lista_de_hoy));
    assert.ok(modal.classList.contains('active'));
    confirmar = falso();
    await c.confirmarReenvioDq(confirmar);
    assert.deepEqual(pedidos, [['POST', '/dato-quincena/ediciones/12/reenvios', { a: 31 }], ['GET', '/dato-quincena/ediciones/12/correo']]);
    assert.ok(!modal.classList.contains('active'), 'cerrado');
    assert.deepEqual(avisos, [['Se reenvió a 1 persona.', 'success']]);
    assert.equal(lugar.innerHTML, c.htmlDeLaCajaDelCorreo({ ...CAJA(), linea: 'Reenviada por correo el miércoles 25/11/2026 a las 10:12.' }));
    assert.ok(recibo.innerHTML.includes('Reenviada por correo el miércoles 25/11/2026 a las 10:12.'), recibo.innerHTML);
    // A todas
    elegida.value = 'todas';
    c.abrirReenvioDq(abrir);
    await c.confirmarReenvioDq(confirmar);
    assert.deepEqual(pedidos.at(-2), ['POST', '/dato-quincena/ediciones/12/reenvios', { a: 'todas' }]);
  });

  it('«Reenviar» con un error (409, 502): el error del servidor escapado, y la caja se vuelve a pedir; el diálogo cierra con Escape', async () => {
    const modal = falso({ querySelector: () => ({ value: 'todas' }) });
    const { c, pedidos, avisos, oyentes } = paginaFalsa({
      lugares: { 'dq-reenvio': modal, 'dq-envio-lugar': falso() },
      responder: (metodo) => {
        if (metodo === 'POST') throw errorDelServidor(409, 'Esta edición todavía se está mandando <sola>.');
        return { success: true, data: CAJA() };
      }
    });
    c.iniciarDatoQuincena();
    vm.runInContext(`vistaDatoQuincena.detalle = ${JSON.stringify(DETALLE())}; vistaDatoQuincena.caja = ${JSON.stringify(CAJA())};`, c);
    const abrir = falso();
    c.abrirReenvioDq(abrir);
    await c.confirmarReenvioDq(falso());
    assert.deepEqual(avisos.at(-1), ['Esta edición todavía se está mandando &lt;sola&gt;.', 'error']);
    assert.deepEqual(pedidos.at(-1), ['GET', '/dato-quincena/ediciones/12/correo']);
    // Escape cierra y el foco vuelve al botón
    let enfocado = null;
    abrir.focus = () => { enfocado = abrir; };
    c.abrirReenvioDq(abrir);
    assert.ok(modal.classList.contains('active'));
    oyentes['document:keydown']({ key: 'Escape', preventDefault() {} });
    assert.ok(!modal.classList.contains('active'));
    assert.equal(enfocado, abrir);
  });

  it('«Enviarme una prueba»: POST sin cuerpo, deshabilitado hasta la respuesta, el aviso del servidor y la caja de nuevo', async () => {
    let boton;
    const { c, pedidos, avisos } = paginaFalsa({
      lugares: { 'dq-envio-lugar': falso() },
      responder: (metodo) => {
        if (metodo === 'POST') {
          assert.equal(boton.disabled, true);
          return { success: true, message: 'Te mandamos la prueba a tu casilla.' };
        }
        return { success: true, data: CAJA() };
      }
    });
    vm.runInContext(`vistaDatoQuincena.detalle = ${JSON.stringify(DETALLE())};`, c);
    boton = falso();
    await c.mandarPruebaDq(boton);
    assert.deepEqual(pedidos, [['POST', '/dato-quincena/ediciones/12/prueba'], ['GET', '/dato-quincena/ediciones/12/correo']]);
    assert.deepEqual(avisos, [['Te mandamos la prueba a tu casilla.', 'success']]);
  });
});

describe('dato-quincena.html: la página', () => {
  const html = leer('dato-quincena.html');

  it('el título, la descripción, el h1 con el diario de Lucide (decorativo) y la bajada', () => {
    assert.ok(html.includes('<title>El dato de la quincena - RPAD</title>'));
    assert.match(html, /<meta name="description" content="[^"]+">/);
    // El nombre del bot lo pone el script (NOMBRE_DEL_BOT): el HTML estático no lo nombra
    assert.doesNotMatch(html, /Datito|Grok/);
    const h1 = html.match(/<h1 class="page-title">[\s\S]*?<\/h1>/)?.[0] ?? '';
    assert.match(h1, /<svg aria-hidden="true" [^>]*><path d="M15 18h-5"\/><path d="M18 14h-8"\/>/);
    assert.equal(h1.replace(/<svg[\s\S]*?<\/svg>/, '').replace(/<[^>]+>/g, '').trim(), 'El dato de la quincena');
    assert.match(html, /<p class="dq-bajada" id="dq-bajada"><\/p>/);
    assert.ok(html.includes('<div id="dq-pestanas"></div>'));
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

  it('el diálogo de «Reenviar»: el título, la ×, el cuerpo que llena el script, «Cancelar» y «Reenviar», después del footer', () => {
    const modal = html.match(/<div class="modal-overlay" id="dq-reenvio">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)?.[0] ?? '';
    assert.match(modal, /<div class="modal dq-modal dq-modal-chico" role="dialog" aria-modal="true" aria-labelledby="dq-reenvio-titulo">/);
    assert.match(modal, /<h2 class="modal-title" id="dq-reenvio-titulo">Reenviar la edición<\/h2>/);
    assert.match(modal, /<button type="button" class="modal-close" data-cerrar aria-label="Cerrar">&times;<\/button>/);
    assert.match(modal, /<div class="modal-body" id="dq-reenvio-cuerpo"><\/div>/);
    assert.match(modal, /<button type="button" class="dq-btn dq-btn-borde" data-cerrar>Cancelar<\/button>/);
    assert.match(modal, /<button type="button" class="dq-btn dq-btn-tinta" id="dq-reenvio-confirmar">Reenviar<\/button>/);
    assert.ok(html.indexOf('</footer>') < html.indexOf('id="dq-reenvio"'));
  });

  it('ningún id se repite: en la página, ni en la página con el panel de Correo o con el detalle, su caja y el diálogo', () => {
    const repetidos = (texto) => {
      const ids = [...texto.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
      return ids.filter((id, i) => ids.indexOf(id) !== i);
    };
    assert.deepEqual(repetidos(html), []);
    assert.deepEqual(repetidos(html + ctx.htmlDePestanas('correo') + ctx.htmlDelCorreo(CORREO())), []);
    assert.deepEqual(repetidos(html + ctx.htmlDePestanas('ediciones') + ctx.htmlDelDetalle(DETALLE(), { admin: true })
      + ctx.htmlDeLaCajaDelCorreo(CAJA()) + ctx.htmlDelReenvio(CAJA().lista_de_hoy)), []);
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
    // La lista ya no carga miniaturas
    assert.doesNotMatch(estilo, /dq-mini/);
    assert.doesNotMatch(leer('js/dato-quincena.js'), /data-mini|dq-mini/);
    // Las tarjetas: 3 columnas, 2 a 960 px y 1 a 560 px
    assert.match(estilo, /\.dq-tarjetas \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    assert.match(estilo, /@media \(max-width: 960px\) \{[\s\S]*?\.dq-tarjetas \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
    assert.match(estilo, /@media \(max-width: 560px\) \{[\s\S]*?\.dq-tarjetas \{ grid-template-columns: minmax\(0, 1fr\); \}/);
    // El enlace de la tarjeta se estira con ::after (un solo enlace) y su foco se ve en toda la tarjeta
    assert.match(estilo, /\.dq-tarjeta-enlace::after \{[^}]*position: absolute; inset: 0;/);
    assert.match(estilo, /\.dq-tarjeta:has\(\.dq-tarjeta-enlace:focus-visible\) \{[^}]*outline: 3px solid/);
    // Las pestañas y las pastillas del envío, con los tokens del verde
    assert.match(estilo, /--sg-verde: #2E6B4C; --sg-verde-fondo: #DDF1E6;/);
    for (const clase of ['dq-pestana', 'dq-envio-enviada', 'dq-envio-programada', 'dq-envio-parcial', 'dq-envio-fallida', 'dq-envio-espera',
      'dq-envio-no_enviada', 'dq-envio-piloto', 'dq-paginas', 'dq-pagina-texto']) assert.ok(estilo.includes(`.${clase}`), clase);
    assert.doesNotMatch(estilo, /(?<![A-Za-z0-9_-])\.ad-/);
  });

  it('el foco de la tarjeta: el enlace pierde su anillo solo donde la tarjeta lo muestra con :has (dentro de @supports)', () => {
    const estilo = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    const bloque = estilo.match(/@supports selector\(:has\(\*\)\) \{([\s\S]*?)\n {8}\}/)?.[1] ?? '';
    assert.match(bloque, /\.dq-tarjeta:has\(\.dq-tarjeta-enlace:focus-visible\) \{[^}]*outline: 3px solid/);
    assert.match(bloque, /\.dq-pagina \.dq-tarjeta-enlace:focus-visible \{ outline: none; box-shadow: none; \}/);
    // Fuera de @supports, nada le saca el anillo al enlace
    assert.equal(cuantas(estilo, /dq-tarjeta-enlace:focus-visible \{ outline: none/g), 1);
  });

  it('el CSS de la pestaña Correo y de la caja del detalle (la maqueta aprobada): el interruptor quieto con movimiento reducido', () => {
    const estilo = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    for (const clase of ['dq-correo', 'dq-caja', 'dq-caja-cabeza', 'dq-switch', 'dq-proximas', 'dq-corrida', 'dq-tabla', 'dq-col-correo',
      'dq-col-recibe', 'dq-correo-pie', 'dq-envio-caja', 'dq-mal', 'dq-envio-acciones', 'dq-opciones', 'dq-licencia']) {
      assert.ok(estilo.includes(`.${clase}`), clase);
    }
    assert.match(estilo, /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.dq-switch input, \.dq-switch input::after \{ transition: none; \}/);
    // El foco visible también en las casillas, las opciones y la lista de personas
    assert.match(estilo, /\.dq-pagina input:focus-visible, \.dq-pagina select:focus-visible/);
    // En un teléfono, la tabla sin la columna del correo
    assert.match(estilo, /@media \(max-width: 560px\) \{[\s\S]*?\.dq-tabla \.dq-col-correo \{ display: none; \}/);
  });
});
