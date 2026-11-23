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
import { textoDeLosQueVotan } from '../services/datoQuincenaVotacionReglas.js';

const leer = (ruta) => fs.readFileSync(new URL(`../public/${ruta}`, import.meta.url), 'utf8');
const RESPUESTAS = JSON.parse(fs.readFileSync(new URL('./fixtures/dato-quincena-respuestas.json', import.meta.url), 'utf8'));

// Cada test arma su copia: cambiarla no toca las demás
const respuesta = (nombre) => structuredClone(RESPUESTAS[nombre]);
const LISTA = () => respuesta('lista').data;
const LISTA_DOS_ANIOS = () => respuesta('lista_dos_anios').data;
const LISTA_VACIA = () => respuesta('lista_vacia').data;
const DETALLE = () => respuesta('detalle').data;
// La edición del 16/11 con repeticiones (spec 2026-11-14-dato-quincena-v1-3, 3): la principal repite la de prueba (con enlace), la
// segunda es una efeméride y la tercera repite una edición que no está en el RPAD (sin enlace)
const DETALLE_CON_REPETICION = () => respuesta('detalle_con_repeticion').data;

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
    { id: 31, nombre: 'PruebaUno Ejemplo', cargo: 'Cargo inventado', rol: 'Lector', email: 'uno@ejemplo.test', recibe: true, vota: false, licencia: null },
    { id: 32, nombre: 'PruebaDos Ejemplo', cargo: null, rol: 'Editor', email: 'dos@ejemplo.test', recibe: false, vota: true,
      licencia: 'De licencia hasta el 30/11' }
  ],
  reciben_texto: 'Lo recibe 1 persona.',
  votan_texto: 'Vota 1 persona.'
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
// La etiqueta «Principal» de una propuesta, con la pastilla del servidor y el ícono del bot (spec 2026-11-21-dato-quincena-principal-equipo, 4)
const PASTILLA_DE_DATITO = /<span class="dq-etiqueta dq-et-principal"><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>Principal de Datito<\/span>/;

// Todos los textos de un objeto (también en listas y objetos anidados) cambiados por `valor`; los números y los booleanos quedan
const conTextos = (objeto, valor) => {
  if (typeof objeto === 'string') return valor;
  if (Array.isArray(objeto)) return objeto.map((elemento) => conTextos(elemento, valor));
  if (objeto !== null && typeof objeto === 'object') {
    return Object.fromEntries(Object.entries(objeto).map(([clave, elemento]) => [clave, conTextos(elemento, valor)]));
  }
  return objeto;
};

// El <article> de la propuesta que se ve en un HTML ('' si no hay)
const articuloDe = (html) => {
  const desde = html.indexOf('<article class="dq-propuesta"');
  return desde === -1 ? '' : html.slice(desde, html.indexOf('</article>', desde) + '</article>'.length);
};
// El <article> de cada propuesta del detalle, en su orden: Propuestas muestra una por vez, así que se elige cada una por su número
const propuestasDe = (detalle) => detalle.propuestas.map((p) => articuloDe(ctx.htmlDelDetalle(detalle, { vista: 'propuestas', propuesta: p.orden })));
// El HTML del panel `clave` del detalle (General, Propuestas o Datasets nuevos), desde su apertura hasta el próximo panel o el final
// de la hoja; '' si no está
const panelDe = (html, clave) => {
  const desde = html.indexOf(`<div class="dq-ed-panel" role="tabpanel" id="dq-panel-${clave}"`);
  if (desde === -1) return '';
  const siguiente = html.indexOf('<div class="dq-ed-panel" role="tabpanel"', desde + 1);
  return html.slice(desde, siguiente === -1 ? html.length : siguiente);
};

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
  it('la lista: anios, anio y ediciones con id, fecha_texto, marca, principal (título, cifra y rótulo), resto, numero, fecha_partes, cantidad y envio', () => {
    for (const nombre of ['lista', 'lista_dos_anios', 'lista_de_2027', 'lista_vacia', 'lista_sin_envio']) {
      const { success, data } = respuesta(nombre);
      assert.equal(success, true, nombre);
      assert.deepEqual(Object.keys(data), ['anios', 'anio', 'ediciones'], nombre);
      for (const anio of data.anios) assert.deepEqual(Object.keys(anio), ['anio', 'cantidad'], nombre);
      for (const edicion of data.ediciones) {
        assert.deepEqual(Object.keys(edicion),
          ['id', 'fecha_texto', 'marca', 'principal', 'resto', 'numero', 'fecha_partes', 'cantidad', 'envio', 'votacion'], nombre);
        // La principal que cuenta (spec 2026-11-21-dato-quincena-principal-equipo, 3): la del equipo si eligió; si no, la de Datito,
        // con su rótulo
        assert.deepEqual(Object.keys(edicion.principal), ['titulo', 'cifra_clave', 'rotulo'], nombre);
        assert.ok(['Principal del equipo', 'Principal de Datito'].includes(edicion.principal.rotulo), nombre);
        assert.deepEqual(Object.keys(edicion.fecha_partes), ['dia', 'fecha', 'anio'], nombre);
        // La pastilla del envío (spec 2026-11-12-dato-quincena-correo, 6 y 12): { tipo, texto }, o null si no lleva
        if (edicion.envio !== null) assert.deepEqual(Object.keys(edicion.envio), ['tipo', 'texto'], nombre);
      }
    }
    assert.deepEqual(LISTA_VACIA(), { anios: [], anio: null, ediciones: [] });
  });

  it('el detalle: con su id y los textos ya armados, la agenda, las propuestas, las de datasets y los archivos', () => {
    const conDatasets = [respuesta('detalle_con_datasets').data, respuesta('detalle_datasets_vacia').data];
    const delEquipo = [respuesta('detalle_equipo_coincide').data, respuesta('detalle_equipo_otra').data];
    const votados = ['detalle_votacion_abierta', 'detalle_votacion_abierta_con_voto', 'detalle_votacion_cerrada_puntos',
      'detalle_votacion_cerrada_desempate', 'detalle_votacion_cerrada_nadie'].map((n) => respuesta(n).data);
    for (const detalle of [DETALLE(), DETALLE_CON_REPETICION(), ...conDatasets, ...delEquipo, ...votados]) {
      assert.deepEqual(Object.keys(detalle), [
        'id', 'fecha_texto', 'marca', 'numero', 'titulo', 'nota_archivo', 'llegada', 'correo', 'cantidad', 'agenda', 'agenda_grupos',
        'propuestas', 'propuestas_datasets', 'matriz_de_prioridad', 'cantidades', 'ver_propuestas', 'aviso_datasets_nuevos',
        'ver_datasets_nuevos', 'archivos', 'principal_datito', 'principal_equipo', 'votacion'
      ]);
      // Las dos principales (spec 2026-11-21-dato-quincena-principal-equipo, 3), con los textos ya armados
      assert.deepEqual(Object.keys(detalle.principal_datito), ['orden', 'rotulo', 'pastilla', 'marca', 'infografia_pie', 'infografia_alt']);
      assert.deepEqual(Object.keys(detalle.principal_equipo), ['orden', 'coincide', 'rotulo', 'pastilla', 'marca', 'resumen', 'cifra_clave', 'quien']);
      // Lo que suma el servidor para las pestañas (spec 2026-11-18-dato-quincena-detalle-pestanas, 6): la matriz (null sin la
      // clave, o sus 9 celdas), las cantidades de las pestañas y los textos con su plural
      assert.deepEqual(Object.keys(detalle.cantidades), ['propuestas', 'datasets_nuevos']);
      for (const celda of detalle.matriz_de_prioridad ?? []) {
        assert.deepEqual(Object.keys(celda), ['valor', 'riesgo', 'clave', 'texto', 'con_rotulo']);
      }
      assert.ok(detalle.matriz_de_prioridad === null || detalle.matriz_de_prioridad.length === 9);
      // Las propuestas de datasets (spec 2026-11-18-dato-quincena-propuestas-datasets, 4): null sin la clave, [] o cada una con
      // sus textos, la prioridad { clave, texto } y los relacionados { nombre, url }
      for (const propuesta of detalle.propuestas_datasets ?? []) {
        assert.deepEqual(Object.keys(propuesta), [
          'numero', 'numero_texto', 'titulo', 'origenes', 'justificacion', 'prioridad', 'valor', 'riesgo', 'valor_y_riesgo', 'formato',
          'campos', 'anonimizacion', 'datasets_relacionados', 'fuentes'
        ]);
        assert.deepEqual(Object.keys(propuesta.prioridad), ['clave', 'texto']);
        for (const relacionado of propuesta.datasets_relacionados) assert.deepEqual(Object.keys(relacionado), ['nombre', 'url']);
      }
      for (const evento of detalle.agenda) assert.deepEqual(Object.keys(evento), ['fecha_texto', 'titulo', 'detalle', 'url', 'etiqueta']);
      // La agenda en sus grupos (spec 2026-11-14-dato-quincena-agenda-grupos): { titulo, eventos }, cada evento sin etiqueta
      for (const grupo of detalle.agenda_grupos) {
        assert.deepEqual(Object.keys(grupo), ['titulo', 'eventos']);
        for (const evento of grupo.eventos) assert.deepEqual(Object.keys(evento), ['fecha_texto', 'titulo', 'detalle', 'url']);
      }
      for (const propuesta of detalle.propuestas) {
        assert.deepEqual(Object.keys(propuesta), [
          'orden', 'orden_texto', 'etiquetas', 'principal', 'titulo', 'cifra_clave', 'dataset', 'foto', 'repeticion', 'notas_validacion',
          'calculo', 'contexto_historico', 'por_que_hoy', 'angulo', 'idea_placa', 'texto_redes', 'puntos_centrales', 'borrador_nota',
          'fuentes', 'para_copiar', 'borrador_para_copiar'
        ]);
        assert.deepEqual(Object.keys(propuesta.dataset), ['nombre', 'id_enlace', 'url']);
        assert.deepEqual(Object.keys(propuesta.borrador_nota), ['titulo', 'parrafos']);
        for (const fila of propuesta.foto) assert.deepEqual(Object.keys(fila), ['rotulo', 'valor']);
        // La repetición (spec 2026-11-14-dato-quincena-v1-3, 3): null o { texto, motivo, id_edicion }
        if (propuesta.repeticion !== null) assert.deepEqual(Object.keys(propuesta.repeticion), ['texto', 'motivo', 'id_edicion']);
      }
      assert.deepEqual(detalle.archivos.map((archivo) => Object.keys(archivo)), Array(5).fill(['campo', 'rotulo', 'nombre', 'detalle', 'se_puede_ver']));
      assert.deepEqual(detalle.archivos.map((archivo) => archivo.campo),
        ['infografia_png', 'infografia_svg', 'correo_texto', 'calculos', 'metadata']);
    }
    assert.deepEqual(DETALLE().propuestas.map((p) => p.repeticion), [null, null]);
    assert.deepEqual([DETALLE().propuestas_datasets, DETALLE_CON_REPETICION().propuestas_datasets], [null, null]);
    assert.deepEqual(conDatasets.map((d) => d.propuestas_datasets.map((p) => p.prioridad.clave)),
      [['alta', 'si_hay_recursos', 'evaluar'], []]);
    assert.deepEqual(DETALLE_CON_REPETICION().propuestas.map((p) => p.repeticion?.id_edicion ?? null), [12, null, null]);
    assert.deepEqual(DETALLE_CON_REPETICION().propuestas.map((p) => p.repeticion === null), [false, true, false]);
    assert.deepEqual(respuesta('no_existe'), { success: false, error: 'No existe esa edición.' });
    // Los tres estados de la del equipo: sin elegir, la misma de Datito y otra
    assert.deepEqual([DETALLE(), ...delEquipo].map((d) => [d.principal_equipo.orden, d.principal_equipo.coincide]), [[null, false], [1, true], [2, false]]);
    assert.deepEqual([DETALLE(), ...delEquipo].map((d) => d.principal_datito.orden), [1, 1, 1]);
  });
});

describe('dato-quincena.js: la dirección', () => {
  it('estadoDeLaUrl: el id, un entero positivo, y el año, de 2000 a 2100; lo demás, null', () => {
    assert.deepEqual(plano(ctx.estadoDeLaUrl('')), { id: null, anio: null, pagina: 1, correo: false, vista: null, propuesta: null });
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?id=12')), { id: 12, anio: null, pagina: 1, correo: false, vista: null, propuesta: null });
    assert.deepEqual(plano(ctx.estadoDeLaUrl('id=7')), { id: 7, anio: null, pagina: 1, correo: false, vista: null, propuesta: null });
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?anio=2026')), { id: null, anio: 2026, pagina: 1, correo: false, vista: null, propuesta: null });
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?id=3&anio=2027')), { id: 3, anio: 2027, pagina: 1, correo: false, vista: null, propuesta: null });
    // La página (un entero positivo) y el #correo
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?anio=2026&pagina=2')), { id: null, anio: 2026, pagina: 2, correo: false, vista: null, propuesta: null });
    assert.deepEqual(plano(ctx.estadoDeLaUrl('', '#correo')), { id: null, anio: null, pagina: 1, correo: true, vista: null, propuesta: null });
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

  // spec 2026-11-18-dato-quincena-detalle-pestanas, 1: la pestaña de la edición (&vista=) y la propuesta que se mira (&propuesta=)
  it('estadoDeLaUrl: la vista, de una lista cerrada, y la propuesta, un entero positivo sin ceros adelante; lo demás, null', () => {
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?id=20')), { id: 20, anio: null, pagina: 1, correo: false, vista: null, propuesta: null });
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?id=20&vista=propuestas&propuesta=3')),
      { id: 20, anio: null, pagina: 1, correo: false, vista: 'propuestas', propuesta: 3 });
    for (const vista of ['general', 'propuestas', 'datasets']) assert.equal(ctx.estadoDeLaUrl(`?id=20&vista=${vista}`).vista, vista);
    for (const vista of ['x', 'Propuestas', 'GENERAL', 'general ', ' datasets', 'datasets-nuevos', '', 'constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      assert.equal(ctx.estadoDeLaUrl(`?id=20&vista=${encodeURIComponent(vista)}`).vista, null, vista);
    }
    for (const propuesta of ['0', '03', '-1', '1.5', 'x', '', ' 3', '3 ', '+3', '1e1', '99999999999999999999']) {
      assert.equal(ctx.estadoDeLaUrl(`?id=20&vista=propuestas&propuesta=${encodeURIComponent(propuesta)}`).propuesta, null, propuesta);
    }
    // La propuesta se lee sola: la página la usa solo con vista=propuestas (y corrige la dirección)
    assert.equal(ctx.estadoDeLaUrl('?id=20&propuesta=3').propuesta, 3);
    // #correo sigue igual, junto a la vista y la propuesta
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?id=20&vista=propuestas&propuesta=2', '#correo')),
      { id: 20, anio: null, pagina: 1, correo: true, vista: 'propuestas', propuesta: 2 });
  });

  it('urlDeEstado: &vista= solo si no es General y &propuesta= solo en Propuestas; nada de eso sin un id', () => {
    assert.equal(ctx.urlDeEstado({ id: 20, vista: 'general' }), 'dato-quincena.html?id=20');
    assert.equal(ctx.urlDeEstado({ id: 20, vista: 'propuestas' }), 'dato-quincena.html?id=20&vista=propuestas');
    assert.equal(ctx.urlDeEstado({ id: 20, vista: 'propuestas', propuesta: 3 }), 'dato-quincena.html?id=20&vista=propuestas&propuesta=3');
    assert.equal(ctx.urlDeEstado({ id: 20, vista: 'datasets' }), 'dato-quincena.html?id=20&vista=datasets');
    assert.equal(ctx.urlDeEstado({ id: 20, vista: 'general', propuesta: 3 }), 'dato-quincena.html?id=20');
    assert.equal(ctx.urlDeEstado({ id: 20, vista: 'datasets', propuesta: 3 }), 'dato-quincena.html?id=20&vista=datasets');
    assert.equal(ctx.urlDeEstado({ id: 20, propuesta: 3 }), 'dato-quincena.html?id=20');
    assert.equal(ctx.urlDeEstado({ id: 20, vista: 'propuestas', propuesta: 3, correo: true }), 'dato-quincena.html?id=20&vista=propuestas&propuesta=3#correo');
    // Lo que no sirve no se escribe
    for (const vista of ['x', 'Propuestas', '', null, 3, 'constructor', 'propuestas" onclick="x']) {
      assert.equal(ctx.urlDeEstado({ id: 20, vista, propuesta: 3 }), 'dato-quincena.html?id=20', String(vista));
    }
    for (const propuesta of [0, -1, 1.5, '3', '3" x', null, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      assert.equal(ctx.urlDeEstado({ id: 20, vista: 'propuestas', propuesta }), 'dato-quincena.html?id=20&vista=propuestas', String(propuesta));
    }
    // La lista no lleva vista ni propuesta
    assert.equal(ctx.urlDeEstado({ anio: 2026, pagina: 2, vista: 'propuestas', propuesta: 2 }), 'dato-quincena.html?anio=2026&pagina=2');
    assert.equal(ctx.urlDeEstado({ vista: 'datasets' }), 'dato-quincena.html');
    // Ida y vuelta: lo que se lee de una dirección que sirve la vuelve a escribir igual
    for (const [search, hash] of [['?id=20', ''], ['?id=20&vista=propuestas&propuesta=3', ''], ['?id=20&vista=datasets', '#correo'],
      ['?id=20&vista=propuestas', '#correo'], ['?anio=2026&pagina=2', '#correo']]) {
      assert.equal(ctx.urlDeEstado(ctx.estadoDeLaUrl(search, hash)), `dato-quincena.html${search}${hash}`, search + hash);
    }
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

  it('las pestañas: tablist con Ediciones y «Envío y votación», la activa con aria-selected y las otras fuera del orden del teclado', () => {
    const html = ctx.htmlDePestanas('ediciones');
    assert.match(html, /^<div class="dq-pestanas" role="tablist" aria-label="El dato de la quincena">/);
    assert.ok(html.includes('<button type="button" class="dq-pestana dq-activa" role="tab" id="dq-tab-ediciones" aria-selected="true" aria-controls="dq-contenido" data-pestana="ediciones">Ediciones</button>'));
    assert.ok(html.includes('<button type="button" class="dq-pestana" role="tab" id="dq-tab-correo" aria-selected="false" aria-controls="dq-contenido" tabindex="-1" data-pestana="correo">Envío y votación</button>'));
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
  // spec 2026-11-18-dato-quincena-detalle-pestanas, 2: la cabecera «tipo diario», como la de las tarjetas de la lista
  it('«Todas las ediciones» y la cabecera: «El dato de la quincena» con el N.º, la fecha grande y el título del paquete', () => {
    const detalle = DETALLE();
    const html = ctx.htmlDelDetalle(detalle);
    assert.match(html, /^<p class="dq-volver-caja"><a class="dq-link dq-volver" href="dato-quincena\.html"><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>Todas las ediciones<\/a><\/p><div class="dq-hoja">/);
    assert.ok(html.includes('<header class="dq-ed-cabecera"><p class="dq-mancheta"><span>El dato de la quincena</span><span class="dq-numero">N.º 1</span></p>'
      + '<h2 class="dq-ed-fecha">Lunes 2 de noviembre de 2026</h2>'
      + `<p class="dq-ed-paquete">${esc(detalle.titulo)}</p><div class="dq-ed-pestanas" role="tablist" aria-label="La edición">`));
    assert.ok(ctx.htmlDelDetalle({ ...detalle, numero: null }).includes('<p class="dq-mancheta"><span>El dato de la quincena</span></p>'));
    // Sin título del paquete, sin el renglón vacío
    assert.ok(!ctx.htmlDelDetalle({ ...detalle, titulo: '' }).includes('dq-ed-paquete'));
    // Las pestañas, pegadas a la cabecera, y los paneles después
    assert.ok(html.indexOf('</div></header><div class="dq-ed-panel"') > 0);
  });

  it('un piloto lleva su marca en lugar del N.º', () => {
    const html = ctx.htmlDelDetalle({ ...DETALLE(), marca: 'Piloto 4', numero: null });
    assert.ok(html.includes('<p class="dq-mancheta"><span>El dato de la quincena</span><span class="dq-marca">Piloto 4</span></p>'));
    assert.ok(html.includes('<h2 class="dq-ed-fecha">Lunes 2 de noviembre de 2026</h2>'));
  });

  it('la llegada, el correo y la cantidad (el punto lo pone la página) y la nota de Datito, en General', () => {
    const detalle = DETALLE();
    const general = panelDe(ctx.htmlDelDetalle(detalle), 'general');
    // La cantidad del servidor tal cual, y el punto final lo pone la página (como en la maqueta)
    assert.ok(general.includes('<p class="dq-recibo">Llegó al RPAD el 02/11/2026 a las 08:14. Correo enviado el 02/11/2026 a las 08:12, según Datito. 2 propuestas.</p>'));
    // Sin la cantidad, sin ese punto
    assert.ok(ctx.htmlDelDetalle({ ...detalle, cantidad: null }).includes('<p class="dq-recibo">Llegó al RPAD el 02/11/2026 a las 08:14. Correo enviado el 02/11/2026 a las 08:12, según Datito.</p>'));
    assert.ok(general.includes(`<div class="dq-edicion-pie"><p class="dq-nota-archivo"><b>Nota de Datito:</b> ${esc(detalle.nota_archivo)}</p><p class="dq-recibo">`));
    // Un solo renglón del recibo en todo el detalle: es el que se vuelve a dibujar después de un reenvío
    assert.equal(cuantas(ctx.htmlDelDetalle(respuesta('detalle_con_datasets').data, { admin: true }), /class="dq-recibo"/g), 1);
  });

  it('una nota de archivo null, vacía o de solo espacios no se dibuja', () => {
    for (const nota_archivo of [null, '', '   ', '\n\t']) {
      assert.ok(!ctx.htmlDelDetalle({ ...DETALLE(), nota_archivo }).includes('dq-nota-archivo'), JSON.stringify(nota_archivo));
    }
  });

  // spec 2026-11-14-dato-quincena-agenda-grupos: la agenda en sus grupos, como los arma el servidor (agenda_grupos): cada uno con su
  // título en un h4 y su lista, en su orden; sin la pastilla «Efeméride» (el título del grupo ya lo dice)
  const GRUPOS = () => [
    { titulo: 'Lo que pasó', eventos: [
      { fecha_texto: '06/11/2026', titulo: 'Feria inventada', detalle: 'Un evento que ya pasó.', url: 'https://datos.ejemplo.gob.ar/feria' }
    ] },
    { titulo: 'Lo que viene', eventos: [
      { fecha_texto: '14/11/2026', titulo: 'Festival inventado', detalle: 'El día de la edición.', url: 'https://datos.ejemplo.gob.ar/festival' },
      { fecha_texto: '23/11/2026', titulo: 'Jornada inventada', detalle: 'Más adelante.', url: 'https://datos.ejemplo.gob.ar/jornada' }
    ] },
    { titulo: 'Efemérides', eventos: [
      { fecha_texto: '18/11/2026', titulo: 'Día inventado', detalle: 'Una efeméride inventada.', url: 'https://datos.ejemplo.gob.ar/dia' }
    ] }
  ];
  const titulosDeLosGrupos = (html) => [...html.matchAll(/<h4 class="dq-agenda-grupo">([^<]*)<\/h4>/g)].map((encontrado) => encontrado[1]);

  // spec 2026-11-18-dato-quincena-detalle-pestanas, 3: en General, a lo ancho, cada grupo en su columna, como una línea de tiempo corta
  it('con agenda: el título de la sección y cada grupo en su columna con su título (h4) y su línea, en el orden del servidor', () => {
    const agenda = ctx.htmlDeLaAgenda(GRUPOS());
    assert.match(agenda, /^<section class="dq-agenda" aria-labelledby="dq-agenda-titulo"><h3 class="dq-seccion-titulo" id="dq-agenda-titulo">Agenda de la quincena<\/h3><div class="dq-agenda-cols"><div class="dq-agenda-col"><h4 class="dq-agenda-grupo">Lo que pasó<\/h4><ol class="dq-linea"><li>/);
    assert.deepEqual(titulosDeLosGrupos(agenda), ['Lo que pasó', 'Lo que viene', 'Efemérides']);
    assert.equal(cuantas(agenda, /<div class="dq-agenda-col">/g), 3);
    assert.equal(cuantas(agenda, /<ol class="dq-linea">/g), 3);
    // Cada evento en la lista de su grupo, en el orden en que llegó
    const dias = [...agenda.matchAll(/<span class="dq-dia">([^<]*)<\/span>/g)].map((encontrado) => encontrado[1]);
    assert.deepEqual(dias, ['06/11/2026', '14/11/2026', '23/11/2026', '18/11/2026']);
    assert.ok(agenda.indexOf('Lo que viene</h4>') < agenda.indexOf('Festival inventado')
      && agenda.indexOf('Jornada inventada') < agenda.indexOf('Efemérides</h4>'));
    assert.deepEqual(titulosDeLosGrupos(ctx.htmlDeLaAgenda(GRUPOS().reverse())), ['Efemérides', 'Lo que viene', 'Lo que pasó']);
    // Los del fixture: la edición del 02/11, con el evento que viene y la efeméride; la del 16/11, con el mismo evento ya pasado
    assert.deepEqual(titulosDeLosGrupos(ctx.htmlDeLaAgenda(DETALLE().agenda_grupos)), ['Lo que viene', 'Efemérides']);
    assert.deepEqual(titulosDeLosGrupos(ctx.htmlDeLaAgenda(DETALLE_CON_REPETICION().agenda_grupos)), ['Lo que pasó', 'Efemérides']);
  });

  it('cada evento con su fecha, título, detalle y enlace, separados por un espacio; sin la pastilla «Efeméride»', () => {
    const [{ eventos: [evento] }] = DETALLE().agenda_grupos;
    const agenda = ctx.htmlDeLaAgenda(DETALLE().agenda_grupos);
    // Entre las piezas va un espacio (la grilla no lo dibuja): copiado o leído en voz alta no queda todo pegado
    assert.ok(agenda.includes(`<li><span class="dq-dia">10/11/2026</span> <b class="dq-evento-titulo">${esc(evento.titulo)}</b> `
      + `<span class="dq-evento-detalle">${esc(evento.detalle)} <a `));
    assert.ok(agenda.includes(`<a href="${esc(evento.url)}" target="_blank" rel="noopener noreferrer">Ver<span class="visualmente-oculto"> ${esc(evento.titulo)}</span></a>`));
    assert.ok(!agenda.includes('dq-etiqueta'), 'sin pastillas');
    assert.ok(!agenda.includes('>Efeméride<'));
    assert.ok(!ctx.htmlDelDetalle(DETALLE()).includes('dq-etiqueta-agenda'));
    // Una dirección que no es https://, sin enlace
    const sinEnlace = ctx.htmlDeLaAgenda([{ titulo: 'Lo que viene', eventos: [{ ...evento, url: 'javascript:alert(1)' }] }]);
    assert.ok(!sinEnlace.includes('<a '), sinEnlace);
    assert.ok(!sinEnlace.includes('javascript:'), sinEnlace);
  });

  it('en el detalle, la agenda de agenda_grupos; sin grupos, o con grupos sin eventos, ese bloque no va', () => {
    assert.ok(ctx.htmlDelDetalle(DETALLE()).includes(ctx.htmlDeLaAgenda(DETALLE().agenda_grupos)), 'en el detalle');
    assert.ok(!ctx.htmlDelDetalle({ ...DETALLE(), agenda_grupos: [] }).includes('dq-agenda'));
    assert.ok(ctx.htmlDelDetalle({ ...DETALLE(), agenda: [] }).includes('<section class="dq-agenda"'), 'sale de agenda_grupos, no de agenda');
    assert.equal(ctx.htmlDeLaAgenda([]), '');
    assert.equal(ctx.htmlDeLaAgenda(null), '');
    assert.equal(ctx.htmlDeLaAgenda([{ titulo: 'Lo que pasó', eventos: [] }]), '');
    const sinElPrimero = GRUPOS();
    sinElPrimero[0].eventos = [];
    assert.deepEqual(titulosDeLosGrupos(ctx.htmlDeLaAgenda(sinElPrimero)), ['Lo que viene', 'Efemérides']);
  });

  it('en la agenda, todo texto del servidor va escapado: el título del grupo y cada evento', () => {
    const raro = ctx.htmlDeLaAgenda([{
      titulo: XSS, eventos: [{ fecha_texto: XSS, titulo: XSS, detalle: XSS, url: 'https://datos.ejemplo.gob.ar/a?b="c"&d=<e>' }]
    }]);
    assert.ok(!raro.includes('<img'), raro);
    assert.ok(raro.includes(`<h4 class="dq-agenda-grupo">${XSS_ESCAPADO}</h4>`));
    assert.ok(raro.includes(`<span class="dq-dia">${XSS_ESCAPADO}</span>`));
    assert.ok(raro.includes(`<b class="dq-evento-titulo">${XSS_ESCAPADO}</b> <span class="dq-evento-detalle">${XSS_ESCAPADO} <a `));
    assert.ok(raro.includes('href="https://datos.ejemplo.gob.ar/a?b=&quot;c&quot;&amp;d=&lt;e&gt;"'));
  });

  // spec 2026-11-21-dato-quincena-principal-equipo, 4: la infografía es la de la principal de Datito (un solo PNG por edición): el pie
  // y el texto alternativo son los del servidor, también cuando el equipo eligió otra
  it('la infografía, en General, se pide desde un blob: (el lugar con su ruta y su texto alternativo), con su pie', () => {
    const detalle = DETALLE();
    const figura = '<figure class="dq-figura"><div class="dq-infografia" data-infografia="/dato-quincena/ediciones/12/archivos/infografia_png" '
      + 'data-alt="Infografía de la principal de Datito: Un título inventado"></div>'
      + '<figcaption class="dq-infografia-pie">La infografía de la principal de Datito.</figcaption></figure>';
    for (const nombre of ['detalle', 'detalle_equipo_coincide', 'detalle_equipo_otra']) {
      assert.ok(panelDe(ctx.htmlDelDetalle(respuesta(nombre).data), 'general').includes(figura), nombre);
    }
    // Los textos son los del servidor, tal cual
    const otros = { ...detalle, principal_datito: { ...detalle.principal_datito, infografia_pie: 'Un pie <b>.', infografia_alt: 'Un alt "raro".' } };
    assert.ok(ctx.htmlDelDetalle(otros).includes('data-alt="Un alt &quot;raro&quot;."></div><figcaption class="dq-infografia-pie">Un pie &lt;b&gt;.</figcaption>'));
    // Una sola en todo el detalle: se carga una vez y cambiar de pestaña no la vuelve a pedir
    assert.equal(cuantas(ctx.htmlDelDetalle(respuesta('detalle_con_datasets').data, { admin: true }), /data-infografia=/g), 1);
    // Sin un id que sirva, sin lugar (no hay a dónde pedirla)
    assert.ok(!ctx.htmlDelDetalle({ ...detalle, id: 0 }).includes('data-infografia'));
    // Sin principal_datito (un servidor de antes), los textos de antes, con la marcada o, si ninguna, la primera
    const { principal_datito: _pd, principal_equipo: _pe, ...deAntes } = detalle;
    assert.ok(ctx.htmlDelDetalle(deAntes).includes(`data-alt="Infografía de la propuesta principal: ${esc(detalle.propuestas[0].titulo)}"></div>`
      + '<figcaption class="dq-infografia-pie">La infografía de la propuesta principal.</figcaption>'));
    const sinPrincipal = { ...deAntes, propuestas: detalle.propuestas.map((p) => ({ ...p, principal: false })) };
    assert.ok(ctx.htmlDelDetalle(sinPrincipal).includes(`data-alt="Infografía de la propuesta principal: ${esc(detalle.propuestas[0].titulo)}"`));
  });

  it('Propuestas muestra una sola propuesta, en un <article> nombrado por su título, con los tres plegados cerrados', () => {
    const html = ctx.htmlDelDetalle(DETALLE(), { vista: 'propuestas' });
    const panel = panelDe(html, 'propuestas');
    assert.equal(cuantas(panel, /<article /g), 1);
    assert.ok(articuloDe(panel).startsWith('<article class="dq-propuesta" aria-labelledby="dq-propuesta-titulo"><div class="dq-prop-arriba">'));
    assert.equal(cuantas(panel, /<details class="dq-plegado"><summary>/g), 3);
    assert.ok(!panel.includes(' open'), 'los plegados, cerrados');
    // Ya no hay «La propuesta completa» ni una lista de propuestas
    assert.ok(!html.includes('dq-completa') && !html.includes('<li class="dq-propuesta'));
  });

  it('el número, las etiquetas (Validar con su ícono, nunca solo el color), el título y la cifra', () => {
    const [principal, otra] = propuestasDe(DETALLE());
    assert.ok(principal.includes('<span class="dq-orden">Propuesta 1</span>'));
    // La etiqueta «Principal» se muestra con la pastilla del servidor («Principal de Datito»), con el ícono del bot
    assert.match(principal, PASTILLA_DE_DATITO);
    assert.ok(!principal.includes('>Principal</span>'));
    assert.match(principal, /<span class="dq-etiqueta dq-et-validar"><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>Validar<\/span>/);
    assert.ok(otra.includes('<span class="dq-etiqueta dq-et-agenda">Agenda</span>'));
    // El título, un h3 que recibe el foco al elegir la propuesta
    assert.ok(principal.includes('<h3 class="dq-prop-titulo" id="dq-propuesta-titulo" tabindex="-1">Un título inventado</h3>'));
    assert.ok(principal.includes(`<div class="dq-cifra"><p class="dq-cifra-rotulo">La cifra clave</p><p class="dq-cifra-texto">${esc('1.234 casos · septiembre de 2026')}</p></div>`));
    // Una etiqueta que no conoce, escapada y sin color
    const rara = ctx.htmlDePropuesta({ ...DETALLE().propuestas[1], etiquetas: [XSS] });
    assert.ok(rara.includes(`<span class="dq-etiqueta">${XSS_ESCAPADO}</span>`));
  });

  // spec 2026-11-23-dato-quincena-detalle-visual: la cifra clave, en una ficha con su rótulo fijo, distinta del título
  it('la cifra clave en una ficha con su rótulo, en Propuestas y en General, escapada', () => {
    assert.equal(constante('TEXTO_CIFRA_CLAVE'), 'La cifra clave');
    assert.equal(ctx.htmlDeLaCifra(XSS, 'dq-cifra'),
      `<div class="dq-cifra"><p class="dq-cifra-rotulo">La cifra clave</p><p class="dq-cifra-texto">${XSS_ESCAPADO}</p></div>`);
    const detalle = conTextos(DETALLE(), XSS);
    const [propuesta] = propuestasDe(detalle);
    const general = panelDe(ctx.htmlDelDetalle(detalle), 'general');
    for (const [nombre, html, clase] of [['Propuestas', propuesta, 'dq-cifra'], ['General', general, 'dq-principal-cifra']]) {
      assert.equal(cuantas(html, /class="dq-cifra-rotulo"/g), 1, nombre);
      assert.ok(html.includes(`<div class="${clase}"><p class="dq-cifra-rotulo">La cifra clave</p><p class="dq-cifra-texto">${XSS_ESCAPADO}</p></div>`), nombre);
      assert.ok(!html.includes('<p class="dq-cifra">') && !html.includes('<p class="dq-principal-cifra">'), nombre);
    }
  });

  // spec 2026-11-14-dato-quincena-v1-3, 4: «Repite» con su clase y el history de Lucide (decorativo, como el de Validar);
  // «Efeméride», el estilo neutro de .dq-etiqueta, sin clase propia. Las etiquetas dicen su nombre: nunca solo el color
  it('las etiquetas Repite (con su clase y el history de Lucide) y Efeméride (la neutra, sin clase)', () => {
    const [principal, segunda, tercera] = propuestasDe(DETALLE_CON_REPETICION());
    const REPITE = /<span class="dq-etiqueta dq-et-repite"><svg aria-hidden="true"[^>]*><path d="M3 12a9 9 0 1 0 9-9 9\.75 9\.75 0 0 0-6\.74 2\.74L3 8"\/><path d="M3 3v5h5"\/><path d="M12 7v5l4 2"\/><\/svg>Repite<\/span>/;
    assert.match(principal, REPITE);
    assert.match(tercera, REPITE);
    assert.match(principal, PASTILLA_DE_DATITO);
    assert.match(principal, /<span class="dq-etiqueta dq-et-validar"><svg aria-hidden="true"/);
    assert.ok(segunda.includes('<span class="dq-etiqueta dq-et-agenda">Agenda</span><span class="dq-etiqueta">Efeméride</span>'));
    assert.ok(!segunda.includes('dq-et-repite'));
    assert.deepEqual(constante('CLASE_DE_LA_ETIQUETA'),
      { Principal: 'dq-et-principal', Agenda: 'dq-et-agenda', Validar: 'dq-et-validar', Repite: 'dq-et-repite' });
  });

  it('la caja de la repetición, después de la foto y antes de «Para validar»: el texto en negrita con el enlace a la edición y el motivo', () => {
    const [principal, segunda, tercera] = propuestasDe(DETALLE_CON_REPETICION());
    const icono = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" '
      + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 '
      + '2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>';
    assert.ok(principal.includes(`<div class="dq-repite"><p class="dq-repite-texto">${icono}<b><a href="dato-quincena.html?id=12">`
      + 'Repite el dataset de la edición del 02/11/2026.</a></b></p><p class="dq-repite-motivo">Datos nuevos: Llegaron los datos de '
      + 'octubre, que la edición anterior no tenía.</p></div>'));
    const foto = principal.indexOf('<dl class="dq-foto">');
    const caja = principal.indexOf('<div class="dq-repite">');
    assert.ok(foto > 0 && foto < caja && caja < principal.indexOf('<div class="dq-validar">'), 'entre la foto y Para validar');
    assert.ok(caja < principal.indexOf('<div class="dq-dos">'), 'arriba de los campos, siempre a la vista');
    // Sin un id que sirva, el texto sin enlace
    assert.ok(tercera.includes(`<div class="dq-repite"><p class="dq-repite-texto">${icono}<b>Repite el tema de la edición del 19/10/2026.</b>`
      + '</p><p class="dq-repite-motivo">Hecho actual: Esta quincena el tema volvió a estar en agenda.</p></div>'));
    // Sin repetición, nada
    assert.ok(!segunda.includes('dq-repite'));
  });

  it('htmlDeLaRepeticion: el enlace solo con un id que acepta idDeEdicion; null, sin la clave o algo raro, nada', () => {
    const repeticion = DETALLE_CON_REPETICION().propuestas[0].repeticion;
    for (const id_edicion of [null, undefined, 0, -12, 1.5, '12', Number.MAX_SAFE_INTEGER + 1]) {
      const html = ctx.htmlDeLaRepeticion({ ...repeticion, id_edicion });
      assert.ok(!html.includes('<a '), String(id_edicion));
      assert.ok(html.includes('<b>Repite el dataset de la edición del 02/11/2026.</b>'), String(id_edicion));
    }
    assert.ok(ctx.htmlDeLaRepeticion({ ...repeticion, id_edicion: 7 }).includes('<a href="dato-quincena.html?id=7">'));
    for (const valor of [null, undefined, 'sí', 3]) assert.equal(ctx.htmlDeLaRepeticion(valor), '', String(valor));
    // Una edición v1.2 (repeticion null) y una propuesta sin la clave, como antes
    const [primera] = DETALLE().propuestas;
    const { repeticion: _, ...sinLaClave } = primera;
    assert.equal(ctx.htmlDePropuesta(sinLaClave), ctx.htmlDePropuesta(primera));
    assert.ok(!ctx.htmlDelDetalle(DETALLE()).includes('dq-repite'));
  });

  it('«Para validar antes de publicar», con su ícono, arriba de los campos y siempre a la vista; sin notas, no va', () => {
    const [principal, otra] = propuestasDe(DETALLE());
    assert.match(principal, /<div class="dq-validar"><h4><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>Para validar antes de publicar<\/h4><ul><li>Primera nota\.<\/li><li>Segunda nota\.<\/li><\/ul><\/div>/);
    assert.ok(principal.indexOf('dq-validar') < principal.indexOf('<div class="dq-dos">'), 'antes de los campos');
    assert.ok(principal.indexOf('dq-validar') < principal.indexOf('<details'), 'fuera de los plegados');
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
    // En una tira con la foto del RPAD
    assert.ok(ctx.htmlDePropuesta(primera).includes('<div class="dq-tira"><p class="dq-dataset"><span class="dq-tira-rotulo">Dataset:</span> <a href="dataset.html?id=1">Dataset de prueba A</a> · '
      + `<a href="https://datos.ejemplo.gob.ar/dataset/prueba-a" target="_blank" rel="noopener noreferrer">en el portal</a></p>${ctx.htmlDeLaFoto(primera.foto)}</div>`));
    assert.ok(ctx.htmlDePropuesta(segunda).includes('<p class="dq-dataset"><span class="dq-tira-rotulo">Dataset:</span> Dataset de prueba B · '
      + '<a href="https://datos.ejemplo.gob.ar/dataset/prueba-b" target="_blank" rel="noopener noreferrer">en el portal</a></p>'));
    for (const id_enlace of [0, -1, '1', 1.5, null]) {
      assert.ok(!ctx.htmlDePropuesta({ ...primera, dataset: { ...primera.dataset, id_enlace } }).includes('dataset.html'), String(id_enlace));
    }
    for (const url of ['http://datos.ejemplo.gob.ar/x', 'javascript:alert(1)', '']) {
      const html = ctx.htmlDePropuesta({ ...primera, dataset: { ...primera.dataset, url } });
      assert.ok(html.includes('<p class="dq-dataset"><span class="dq-tira-rotulo">Dataset:</span> <a href="dataset.html?id=1">Dataset de prueba A</a> · en el portal</p>'), url);
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

  // spec 2026-11-18-dato-quincena-detalle-pestanas, 4: en dos columnas, «Por qué es noticia», «Ángulo» y «Puntos centrales» | «Texto para
  // redes»; a lo ancho, el borrador y la idea de placa; plegados, el cálculo, el contexto y las fuentes
  it('los campos, en el orden de la spec 4, con los textos tal como llegaron', () => {
    const [primera] = DETALLE().propuestas;
    const html = ctx.htmlDePropuesta(primera);
    const titulos = [...html.matchAll(/<h4>([^<]+)<\/h4>|<summary><svg[^>]*>[\s\S]*?<\/svg><span>([^<]+)<\/span>/g)].map((m) => m[1] ?? m[2]);
    assert.deepEqual(titulos, ['Por qué es noticia', 'Ángulo', 'Puntos centrales', 'Texto para redes', 'Borrador de nota', 'Idea de placa',
      'Cómo se calculó', 'Contexto histórico', 'Fuentes']);
    for (const campo of ['calculo', 'contexto_historico', 'por_que_hoy', 'angulo', 'idea_placa', 'texto_redes']) {
      assert.ok(html.includes(`<p class="dq-texto">${esc(primera[campo])}</p>`), campo);
    }
    // Las dos columnas: los tres campos a la izquierda y el texto para redes, como tarjeta de publicación, a la derecha
    const dos = html.slice(html.indexOf('<div class="dq-dos">'), html.indexOf('<div class="dq-borrador">'));
    assert.match(dos, /^<div class="dq-dos"><div class="dq-dos-izq"><div class="dq-campo"><h4>Por qué es noticia<\/h4>[\s\S]*<\/div><\/div><div class="dq-redes"><div class="dq-redes-cabeza"><h4>Texto para redes<\/h4><button [^>]*>Copiar<\/button><\/div><div class="dq-redes-post"><p class="dq-texto">[^<]*<\/p><\/div><\/div><\/div>$/);
    assert.ok(dos.includes('<div class="dq-campo"><h4>Puntos centrales</h4><ul><li>Primer punto inventado.</li><li>Segundo punto inventado.</li><li>Tercer punto inventado.</li></ul></div>'));
    // El borrador, como artículo, con su «Copiar»
    assert.match(html, /<div class="dq-borrador"><div class="dq-borrador-cabeza"><h4>Borrador de nota<\/h4><button [^>]*>Copiar<\/button><\/div><div class="dq-borrador-cuerpo"><p class="dq-nota-titulo">Un borrador inventado<\/p><p class="dq-texto">Primer párrafo inventado\.<\/p><p class="dq-texto">Segundo párrafo inventado\.<\/p><\/div><\/div>/);
    assert.ok(html.includes(`<div class="dq-campo dq-placa"><h4>Idea de placa</h4><p class="dq-texto">${esc(primera.idea_placa)}</p></div>`));
    // Plegados, en <details> cerrados, con el ícono decorativo
    assert.match(html, /<div class="dq-plegados"><details class="dq-plegado"><summary><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg><span>Cómo se calculó<\/span><\/summary><div class="dq-plegado-cuerpo"><p class="dq-texto">/);
    assert.ok(html.includes('<span>Fuentes</span></summary><div class="dq-plegado-cuerpo"><ul><li><a href="https://datos.ejemplo.gob.ar/a.csv"'));
    // El texto para redes conserva su salto de línea (lo muestra white-space: pre-line)
    assert.ok(html.includes('Un texto para redes inventado.\nCon un segundo renglón.'));
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
      assert.deepEqual(copiar.map((c) => c.clase), ['dq-btn dq-btn-borde dq-btn-chico dq-copiar', 'dq-btn dq-btn-borde dq-btn-chico dq-copiar', 'dq-btn dq-btn-tinta dq-copiar']);
      // «Copiar la propuesta» al pie, después de los plegados
      assert.ok(html.lastIndexOf('</details>') < html.indexOf('<footer class="dq-prop-pie"><p class="dq-copiar-todo"><button type="button" class="dq-btn dq-btn-tinta dq-copiar"'));
    }
    // El de la propuesta copia para_copiar tal cual (con sus saltos de línea), sin recalcular nada
    const [primera] = DETALLE().propuestas;
    assert.ok(ctx.htmlDePropuesta({ ...primera, para_copiar: 'Otro texto\n\ndel servidor' }).includes('data-copiar="Otro texto\n\ndel servidor" aria-label="Copiar la propuesta (Propuesta 1)">Copiar la propuesta'));
    // Los nombres exactos, y sin orden_texto, el de la propuesta a secas
    const nombres = (html) => [...html.matchAll(/data-copiar="[^"]*" aria-label="([^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(nombres(ctx.htmlDePropuesta(DETALLE().propuestas[1])), ['Copiar el texto para redes', 'Copiar el borrador', 'Copiar la propuesta (Propuesta 2)']);
    assert.deepEqual(nombres(ctx.htmlDePropuesta({ ...primera, orden_texto: null })), ['Copiar el texto para redes', 'Copiar el borrador', 'Copiar la propuesta']);
  });

  it('los archivos, en una fila: los cinco, con «Descargar» en cada uno y «Ver» solo en el texto y los cálculos', () => {
    const detalle = DETALLE();
    const html = ctx.htmlDeArchivos(detalle.archivos, detalle.id);
    assert.match(html, /^<section class="dq-archivos" aria-labelledby="dq-archivos-titulo"><h3 class="dq-seccion-titulo" id="dq-archivos-titulo">Archivos<\/h3><ul class="dq-archivos-fila">/);
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
    assert.ok(panelDe(ctx.htmlDelDetalle(detalle), 'general').includes(html), 'en General');
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

// spec 2026-11-18-dato-quincena-detalle-pestanas, 2 y 3: la edición en tres pestañas (General, Propuestas y Datasets nuevos), dibujadas
// juntas y con la elegida a la vista
describe('dato-quincena.js: el detalle en pestañas y General (spec 2026-11-18-dato-quincena-detalle-pestanas, 2 y 3)', () => {
  const CON_DATASETS = () => respuesta('detalle_con_datasets').data;
  const VACIA = () => respuesta('detalle_datasets_vacia').data;
  const PESTANA = /<button type="button" class="dq-ed-pestana" role="tab" id="dq-tab-(\w+)" aria-selected="(true|false)" aria-controls="dq-panel-(\w+)"( tabindex="-1")? data-vista="(\w+)"><span>([^<]+)<\/span>(?: <span class="dq-ed-cuenta">(\d+)<\/span>)?<\/button>/g;
  const pestanas = (html) => [...html.matchAll(PESTANA)]
    .map(([, id, elegida, controla, fuera, vista, texto, cuenta]) => ({ id, elegida: elegida === 'true', controla, fuera: Boolean(fuera), vista, texto, cuenta: cuenta ?? null }));
  const paneles = (html) => [...html.matchAll(/<div class="dq-ed-panel" role="tabpanel" id="dq-panel-(\w+)" aria-labelledby="dq-tab-(\w+)" tabindex="0"( hidden)?>/g)]
    .map(([, id, nombrado, oculto]) => ({ id, nombrado, oculto: Boolean(oculto) }));
  const elegida = (html) => pestanas(html).filter((p) => p.elegida).map((p) => p.vista);

  it('sin la clave (null), dos pestañas; con [] o con una lista, tres, con su cantidad; la elegida por defecto es General', () => {
    assert.deepEqual(pestanas(ctx.htmlDelDetalle(DETALLE())), [
      { id: 'general', elegida: true, controla: 'general', fuera: false, vista: 'general', texto: 'General', cuenta: null },
      { id: 'propuestas', elegida: false, controla: 'propuestas', fuera: true, vista: 'propuestas', texto: 'Propuestas', cuenta: '2' }
    ]);
    assert.deepEqual(pestanas(ctx.htmlDelDetalle(VACIA())).map((p) => [p.vista, p.texto, p.cuenta]),
      [['general', 'General', null], ['propuestas', 'Propuestas', '2'], ['datasets', 'Datasets nuevos', '0']]);
    assert.deepEqual(pestanas(ctx.htmlDelDetalle(CON_DATASETS())).map((p) => [p.vista, p.cuenta]), [['general', null], ['propuestas', '2'], ['datasets', '3']]);
    // Cada pestaña controla su panel y cada panel la nombra; los no elegidos, con hidden
    assert.deepEqual(paneles(ctx.htmlDelDetalle(CON_DATASETS())), [{ id: 'general', nombrado: 'general', oculto: false },
      { id: 'propuestas', nombrado: 'propuestas', oculto: true }, { id: 'datasets', nombrado: 'datasets', oculto: true }]);
    assert.deepEqual(paneles(ctx.htmlDelDetalle(DETALLE())).map((p) => p.id), ['general', 'propuestas']);
    // Un solo tablist, con todas las pestañas adentro, y nada más que ellas
    const html = ctx.htmlDelDetalle(CON_DATASETS());
    assert.equal(cuantas(html, /role="tablist"/g), 1);
    const lista = html.slice(html.indexOf('<div class="dq-ed-pestanas" role="tablist" aria-label="La edición">'), html.indexOf('</header>'));
    assert.equal(lista.replace(PESTANA, ''), '<div class="dq-ed-pestanas" role="tablist" aria-label="La edición"></div>');
  });

  it('la vista elige la pestaña y su panel; una que la edición no tiene, o que no sirve, abre General', () => {
    const casos = [
      [DETALLE(), 'propuestas', 'propuestas'], [DETALLE(), 'datasets', 'general'], [DETALLE(), 'x', 'general'], [DETALLE(), null, 'general'],
      [CON_DATASETS(), 'datasets', 'datasets'], [VACIA(), 'datasets', 'datasets'], [CON_DATASETS(), 'constructor', 'general'], [CON_DATASETS(), 'general', 'general']
    ];
    for (const [detalle, vista, esperada] of casos) {
      const html = ctx.htmlDelDetalle(detalle, { vista });
      assert.deepEqual(elegida(html), [esperada], String(vista));
      assert.deepEqual(paneles(html).filter((p) => !p.oculto).map((p) => p.id), [esperada], String(vista));
      // La elegida es la única en el orden del teclado
      assert.deepEqual(pestanas(html).filter((p) => !p.fuera).map((p) => p.vista), [esperada], String(vista));
    }
    assert.equal(ctx.vistaElegida(DETALLE(), 'datasets'), 'general');
    assert.equal(ctx.vistaElegida(VACIA(), 'datasets'), 'datasets');
    assert.equal(ctx.vistaElegida(null, 'propuestas'), 'propuestas');
    assert.equal(ctx.vistaElegida(DETALLE(), '__proto__'), 'general');
  });

  it('sin cantidades (un servidor de antes), las pestañas van sin número; una cantidad que no es un entero de 0 en adelante, tampoco', () => {
    const { cantidades: _, ...sinCantidades } = CON_DATASETS();
    assert.deepEqual(pestanas(ctx.htmlDelDetalle(sinCantidades)).map((p) => [p.vista, p.cuenta]), [['general', null], ['propuestas', null], ['datasets', null]]);
    for (const raro of [{ propuestas: '2', datasets_nuevos: -1 }, { propuestas: 1.5, datasets_nuevos: null }, null, 'x', []]) {
      const html = ctx.htmlDelDetalle({ ...CON_DATASETS(), cantidades: raro });
      assert.ok(!html.includes('dq-ed-cuenta'), JSON.stringify(raro));
      assert.equal(pestanas(html).length, 3, JSON.stringify(raro));
    }
    assert.deepEqual(plano(ctx.pestanasDeLaEdicion(CON_DATASETS())),
      [{ clave: 'general', cuenta: null }, { clave: 'propuestas', cuenta: 2 }, { clave: 'datasets', cuenta: 3 }]);
    assert.deepEqual(plano(ctx.pestanasDeLaEdicion(undefined)), [{ clave: 'general', cuenta: null }, { clave: 'propuestas', cuenta: null }]);
  });

  it('vistaVecina: las flechas (dando la vuelta, sin saltear la del medio), Inicio y Fin; otra tecla o una clave que no está, null', () => {
    const tres = ['general', 'propuestas', 'datasets'];
    assert.equal(ctx.vistaVecina(tres, 'general', 'ArrowRight'), 'propuestas');
    assert.equal(ctx.vistaVecina(tres, 'propuestas', 'ArrowRight'), 'datasets');
    assert.equal(ctx.vistaVecina(tres, 'datasets', 'ArrowRight'), 'general');
    assert.equal(ctx.vistaVecina(tres, 'general', 'ArrowLeft'), 'datasets');
    assert.equal(ctx.vistaVecina(tres, 'datasets', 'ArrowLeft'), 'propuestas');
    assert.equal(ctx.vistaVecina(tres, 'propuestas', 'Home'), 'general');
    assert.equal(ctx.vistaVecina(tres, 'propuestas', 'End'), 'datasets');
    assert.equal(ctx.vistaVecina(['general', 'propuestas'], 'propuestas', 'ArrowRight'), 'general');
    for (const tecla of ['Enter', ' ', 'ArrowDown', 'Tab', 'a']) assert.equal(ctx.vistaVecina(tres, 'general', tecla), null, tecla);
    assert.equal(ctx.vistaVecina(tres, 'otra', 'ArrowRight'), null);
    assert.equal(ctx.vistaVecina([], 'general', 'Home'), null);
  });

  // spec 2026-11-21-dato-quincena-principal-equipo, 4: la portada es la de Datito, rotulada con el texto del servidor
  it('General: la principal de Datito con sus etiquetas (sin «Principal»: ya lo dice arriba), su título, su cifra, su dataset y el botón del servidor', () => {
    const detalle = DETALLE();
    const general = panelDe(ctx.htmlDelDetalle(detalle), 'general');
    const principal = general.slice(general.indexOf('<div class="dq-la-principal">'), general.indexOf('<div class="dq-edicion-pie">'));
    assert.match(principal, new RegExp('^<div class="dq-la-principal"><p class="dq-sobre">La principal de Datito</p><h3 class="dq-principal-titulo">Un título inventado</h3>'
      + '<p class="dq-principal-etiquetas"><span class="dq-etiqueta dq-et-validar"><svg aria-hidden="true"[^>]*>[\\s\\S]*?</svg>Validar</span></p>'
      + `<div class="dq-principal-cifra"><p class="dq-cifra-rotulo">La cifra clave</p><p class="dq-cifra-texto">${esc('1.234 casos · septiembre de 2026')}</p></div>`
      + '<p class="dq-principal-dataset">Dataset: <a href="dataset.html\\?id=1">Dataset de prueba A</a> · '
      + '<a href="https://datos.ejemplo.gob.ar/dataset/prueba-a" target="_blank" rel="noopener noreferrer">en el portal</a></p>'
      + '<p class="dq-ir"><button type="button" class="dq-btn dq-btn-tinta" data-ir-vista="propuestas">Ver las 2 propuestas</button></p>$'));
    assert.ok(!principal.includes('>Principal<'));
    // El texto del botón es el del servidor; sin él (un servidor de antes), uno fijo
    assert.ok(ctx.htmlDelDetalle({ ...detalle, ver_propuestas: 'Ver la propuesta' }).includes('data-ir-vista="propuestas">Ver la propuesta</button>'));
    for (const ver_propuestas of [undefined, null, '', 3]) {
      assert.ok(ctx.htmlDelDetalle({ ...detalle, ver_propuestas }).includes('data-ir-vista="propuestas">Ver las propuestas</button>'), String(ver_propuestas));
    }
    // El dataset sin id_enlace ni https://, sin enlaces (las mismas reglas que en la propuesta)
    const sinEnlaces = { ...detalle, propuestas: [{ ...detalle.propuestas[0], dataset: { nombre: 'Uno', id_enlace: null, url: 'http://x.test' } }] };
    assert.ok(ctx.htmlDelDetalle(sinEnlaces).includes('<p class="dq-principal-dataset">Dataset: Uno · en el portal</p>'));
    // Cuando el equipo eligió otra, la portada sigue siendo la de Datito (con su infografía); la del equipo va en la franja
    const otra = panelDe(ctx.htmlDelDetalle(respuesta('detalle_equipo_otra').data), 'general');
    assert.ok(otra.includes('<div class="dq-la-principal"><p class="dq-sobre">La principal de Datito</p><h3 class="dq-principal-titulo">Un título inventado</h3>'));
    // La portada sigue a principal_datito.orden, el del servidor
    const deLaSegunda = { ...detalle, principal_datito: { ...detalle.principal_datito, orden: 2 } };
    assert.ok(panelDe(ctx.htmlDelDetalle(deLaSegunda), 'general').includes('<h3 class="dq-principal-titulo">Otro título inventado</h3>'));
    // Sin principal_datito (un servidor de antes), «La principal»
    const { principal_datito: _pd, principal_equipo: _pe, ...deAntes } = detalle;
    assert.ok(panelDe(ctx.htmlDelDetalle(deAntes), 'general').includes('<p class="dq-sobre">La principal</p><h3 class="dq-principal-titulo">Un título inventado</h3>'));
  });

  it('General con una sola propuesta sin principal marcada, sin nota, sin agenda ni archivos: la primera, sin títulos vacíos', () => {
    const detalle = DETALLE();
    const una = {
      ...detalle, nota_archivo: null, agenda: [], agenda_grupos: [], archivos: [], ver_propuestas: 'Ver la propuesta',
      cantidades: { propuestas: 1, datasets_nuevos: null },
      propuestas: [{ ...detalle.propuestas[1], principal: false, etiquetas: [] }]
    };
    const html = ctx.htmlDelDetalle(una);
    const general = panelDe(html, 'general');
    assert.ok(general.includes('<h3 class="dq-principal-titulo">Otro título inventado</h3>'));
    assert.ok(!general.includes('dq-principal-etiquetas'), 'sin etiquetas, sin su renglón');
    assert.ok(!general.includes('dq-nota-archivo'));
    assert.ok(!general.includes('dq-agenda'));
    assert.ok(!general.includes('dq-archivos'));
    assert.ok(!general.includes('dq-aviso-nuevos'));
    assert.ok(general.includes('data-ir-vista="propuestas">Ver la propuesta</button>'));
    assert.deepEqual(pestanas(html).map((p) => [p.vista, p.cuenta]), [['general', null], ['propuestas', '1']]);
    // Ningún título (h2, h3 o h4) vacío
    assert.doesNotMatch(html, /<h[234][^>]*><\/h[234]>/);
    // Sin propuestas (no llega: el POST pide al menos una), sin la principal y sin el botón, pero con el recibo
    const sinNinguna = panelDe(ctx.htmlDelDetalle({ ...una, propuestas: [] }, { admin: true }), 'general');
    assert.ok(!sinNinguna.includes('dq-sobre') && !sinNinguna.includes('data-ir-vista'));
    assert.ok(!sinNinguna.includes('dq-franja'), 'sin propuestas, no hay nada que elegir');
    assert.ok(sinNinguna.includes('<p class="dq-recibo">'));
  });

  it('General, en su orden: la franja del equipo, la principal, la infografía, la agenda, los archivos, el aviso de los datasets nuevos y la caja «Correo»', () => {
    const general = panelDe(ctx.htmlDelDetalle(CON_DATASETS(), { admin: true }), 'general');
    const orden = ['<section class="dq-franja', '<div class="dq-portada"><div class="dq-la-principal">', '<div class="dq-edicion-pie">', '<figure class="dq-figura">',
      '<section class="dq-agenda"', '<section class="dq-archivos"', '<div class="dq-aviso-nuevos">', '<div class="dq-correo-de-la-edicion">']
      .map((pieza) => general.indexOf(pieza));
    assert.ok(orden.every((n) => n >= 0), String(orden));
    assert.deepEqual(orden, [...orden].sort((a, b) => a - b));
  });

  it('General: el aviso de los datasets nuevos, con los textos del servidor, solo con aviso_datasets_nuevos y la pestaña', () => {
    const general = panelDe(ctx.htmlDelDetalle(CON_DATASETS()), 'general');
    assert.ok(general.includes('<div class="dq-aviso-nuevos"><p>Datito propone 3 datasets nuevos para abrir.</p>'
      + '<button type="button" class="dq-btn dq-btn-borde" data-ir-vista="datasets">Ver los datasets nuevos</button></div>'));
    assert.ok(ctx.htmlDelDetalle({ ...CON_DATASETS(), aviso_datasets_nuevos: 'Datito propone 1 dataset nuevo para abrir.', ver_datasets_nuevos: 'Ver el dataset nuevo' })
      .includes('<p>Datito propone 1 dataset nuevo para abrir.</p><button type="button" class="dq-btn dq-btn-borde" data-ir-vista="datasets">Ver el dataset nuevo</button>'));
    // Sin el texto del botón, uno fijo
    assert.ok(ctx.htmlDelDetalle({ ...CON_DATASETS(), ver_datasets_nuevos: null }).includes('data-ir-vista="datasets">Ver los datasets nuevos</button>'));
    // Sin aviso (null, sin la clave o con []), o sin la pestaña a la que lleva, nada
    for (const detalle of [DETALLE(), VACIA(), { ...CON_DATASETS(), aviso_datasets_nuevos: null }, { ...CON_DATASETS(), aviso_datasets_nuevos: '' },
      { ...CON_DATASETS(), propuestas_datasets: null }]) {
      assert.ok(!ctx.htmlDelDetalle(detalle).includes('dq-aviso-nuevos'));
      assert.ok(!ctx.htmlDelDetalle(detalle).includes('data-ir-vista="datasets"'));
    }
  });

  it('Propuestas y Datasets nuevos, en sus paneles: el índice con la propuesta elegida y las propuestas de datasets', () => {
    const html = ctx.htmlDelDetalle(CON_DATASETS(), { vista: 'propuestas', propuesta: 2 });
    assert.ok(panelDe(html, 'propuestas').includes(ctx.htmlDelPanelPropuestas(CON_DATASETS(), { propuesta: 2 })));
    assert.equal(cuantas(panelDe(html, 'propuestas'), /<li><button type="button" class="dq-indice-item"/g), 2);
    assert.equal(cuantas(panelDe(html, 'propuestas'), /<article /g), 1);
    assert.ok(panelDe(html, 'datasets').includes(ctx.htmlDelPanelDatasets(CON_DATASETS())));
    assert.ok(panelDe(html, 'datasets').includes(ctx.htmlDeLosDatasetsNuevos(CON_DATASETS().propuestas_datasets, CON_DATASETS().matriz_de_prioridad)));
    assert.equal(panelDe(ctx.htmlDelDetalle(DETALLE()), 'datasets'), '');
    assert.ok(panelDe(html, 'general').includes(ctx.htmlDelPanelGeneral(CON_DATASETS(), { admin: false })));
  });

  it('propuestaElegida: la de ese orden si existe (sin orden, la posición); si no, null (la principal)', () => {
    const detalle = DETALLE_CON_REPETICION();
    assert.equal(ctx.propuestaElegida(detalle, 3), 3);
    assert.equal(ctx.propuestaElegida(detalle, 1), 1);
    for (const propuesta of [4, 0, -1, null, '2', 1.5]) assert.equal(ctx.propuestaElegida(detalle, propuesta), null, String(propuesta));
    const sinOrden = { ...detalle, propuestas: detalle.propuestas.map(({ orden: _, ...resto }) => resto) };
    assert.equal(ctx.propuestaElegida(sinOrden, 2), 2);
    assert.equal(ctx.propuestaElegida(sinOrden, 4), null);
    assert.equal(ctx.propuestaElegida({ propuestas: [{ orden: 5 }, { orden: 7 }] }, 2), null);
    assert.equal(ctx.propuestaElegida({ propuestas: [{ orden: 5 }, { orden: 7 }] }, 7), 7);
    assert.equal(ctx.propuestaElegida(null, 1), null);
  });

  it('todo texto del servidor va escapado: la cabecera, las pestañas, General y sus botones', () => {
    const datos = conTextos(CON_DATASETS(), XSS);
    const html = ctx.htmlDelDetalle(datos, { admin: true });
    assert.ok(!html.includes('<img'), html);
    const general = panelDe(html, 'general');
    assert.ok(html.includes(`<p class="dq-mancheta"><span>El dato de la quincena</span><span class="dq-numero">${XSS_ESCAPADO}</span></p>`));
    assert.ok(html.includes(`<h2 class="dq-ed-fecha">${XSS_ESCAPADO}</h2><p class="dq-ed-paquete">${XSS_ESCAPADO}</p>`));
    assert.ok(general.includes(`<h3 class="dq-principal-titulo">${XSS_ESCAPADO}</h3>`));
    assert.ok(general.includes(`<div class="dq-principal-cifra"><p class="dq-cifra-rotulo">La cifra clave</p><p class="dq-cifra-texto">${XSS_ESCAPADO}</p></div>`));
    assert.ok(general.includes(`data-ir-vista="propuestas">${XSS_ESCAPADO}</button>`));
    assert.ok(general.includes(`<div class="dq-aviso-nuevos"><p>${XSS_ESCAPADO}</p><button type="button" class="dq-btn dq-btn-borde" data-ir-vista="datasets">${XSS_ESCAPADO}</button></div>`));
    assert.ok(cuantas(general, /&lt;img src=x onerror=1&gt;/g) > 20);
    // La marca de un piloto, también
    assert.ok(ctx.htmlDelDetalle({ ...datos, marca: XSS }).includes(`<span class="dq-marca">${XSS_ESCAPADO}</span>`));
    // Ninguna dirección que no es de la página o https:// llega a un href
    assert.ok(!/href="(?!dato-quincena\.html|dataset\.html\?id=\d+"|https:\/\/)/.test(html), html);
  });
});

// Cada renglón del índice de Propuestas: su número (el de orden), si es la que se ve, lo que se lee, el título y las marcas
const indiceDe = (html) => html.split('<li><button type="button" class="dq-indice-item"').slice(1).map((item) => ({
  propuesta: item.match(/^ data-ver-propuesta="([^"]*)"/)?.[1] ?? null,
  actual: /^ data-ver-propuesta="[^"]*" aria-current="true">/.test(item),
  numero: item.match(/<span class="dq-indice-num"(?: aria-hidden="true")?>([^<]*)<\/span>/)?.[1] ?? null,
  oculto: item.match(/<span class="dq-indice-cuerpo"><span class="visualmente-oculto">([^<]*)<\/span>/)?.[1] ?? null,
  titulo: item.match(/<span class="dq-indice-titulo">([^<]*)<\/span>/)?.[1] ?? null,
  // Cada marca: su clase y su texto; las de las principales, lo que se ve y, entre paréntesis, lo que se lee (spec
  // 2026-11-21-dato-quincena-principal-equipo, 4)
  marcas: [...item.matchAll(/<span class="dq-im (dq-im-\w+)">(?:<svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>)?(?:<span aria-hidden="true">([^<]*)<\/span><span class="visualmente-oculto">([^<]*)<\/span>|([^<]*))<\/span>/g)]
    .map(([, clase, visible, leida, texto]) => (texto === undefined ? `${clase}: ${visible} (${leida})` : `${clase}: ${texto}`))
}));
// El título de la propuesta que se ve, los números marcados en el índice y anterior/siguiente ([sentido, número, rótulo, título])
const tituloDe = (html) => articuloDe(html).match(/<h3 class="dq-prop-titulo" id="dq-propuesta-titulo" tabindex="-1">([^<]*)<\/h3>/)?.[1] ?? null;
const actualDe = (html) => indiceDe(html).filter((i) => i.actual).map((i) => i.propuesta);
const pasosDe = (html) => [...articuloDe(html).matchAll(/<button type="button" class="dq-paso dq-paso-(anterior|siguiente)" data-ver-propuesta="(\d+)">(?:<svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>)?<span class="dq-paso-texto"><small>(Anterior|Siguiente)<\/small> <span class="dq-paso-titulo">([^<]*)<\/span><\/span>(?:<svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>)?<\/button>/g)]
  .map(([, sentido, propuesta, rotulo, titulo]) => [sentido, propuesta, rotulo, titulo]);

// spec 2026-11-18-dato-quincena-detalle-pestanas, 4: Propuestas, un índice fijo y una propuesta por vez, con anterior y siguiente
describe('dato-quincena.js: Propuestas, una por vez con índice (spec 2026-11-18-dato-quincena-detalle-pestanas, 4)', () => {
  const panel = (detalle, propuesta) => panelDe(ctx.htmlDelDetalle(detalle, { vista: 'propuestas', propuesta }), 'propuestas');

  it('la marca «Para validar» del índice sale de la etiqueta Validar o de las notas para validar', () => {
    const detalle = DETALLE_CON_REPETICION();
    const marcasDe = (propuestas) => indiceDe(ctx.htmlDelPanelPropuestas({ ...detalle, propuestas })).map((i) => i.marcas.some((m) => m.startsWith('dq-im-validar')));
    const base = detalle.propuestas.map((p) => ({ ...p, etiquetas: [], notas_validacion: [] }));
    assert.deepEqual(marcasDe(base), [false, false, false]);
    assert.deepEqual(marcasDe([{ ...base[0], notas_validacion: ['Una nota inventada'] }, base[1], base[2]]), [true, false, false]);
    assert.deepEqual(marcasDe([base[0], { ...base[1], etiquetas: ['Validar'] }, base[2]]), [false, true, false]);
  });

  it('el índice: todas las propuestas con su número de orden, su título y las marcas de principal y de «Para validar»', () => {
    const detalle = DETALLE_CON_REPETICION();
    const html = ctx.htmlDelPanelPropuestas(detalle);
    assert.match(html, /^<div class="dq-propuestas"><nav class="dq-indice" aria-label="Las propuestas"><ol><li>/);
    assert.ok(html.includes('</ol></nav><div class="dq-lectura"><article class="dq-propuesta"'));
    assert.deepEqual(indiceDe(html), [
      { propuesta: '1', actual: true, numero: '1', oculto: 'Propuesta 1: ', titulo: 'Un título inventado', marcas: ['dq-im-principal: Datito (Principal de Datito)', 'dq-im-validar: Para validar'] },
      { propuesta: '2', actual: false, numero: '2', oculto: 'Propuesta 2: ', titulo: 'Otro título inventado', marcas: [] },
      { propuesta: '3', actual: false, numero: '3', oculto: 'Propuesta 3: ', titulo: 'Un tercer título inventado', marcas: [] }
    ]);
    // El número se ve y no se lee; se lee «Propuesta 1:», el título y las marcas, separados por un espacio (la grilla no lo dibuja).
    // La marca de «Para validar», con el triangle-alert: nunca solo el color
    assert.ok(html.includes('<span class="dq-indice-num" aria-hidden="true">1</span> <span class="dq-indice-cuerpo"><span class="visualmente-oculto">Propuesta 1: </span>'
      + '<span class="dq-indice-titulo">Un título inventado</span> <span class="dq-indice-marcas"><span class="dq-im dq-im-principal"><svg aria-hidden="true"'));
    assert.ok(html.includes('<span aria-hidden="true">Datito</span><span class="visualmente-oculto">Principal de Datito</span></span> '
      + '<span class="dq-im dq-im-validar"><svg aria-hidden="true"'));
    // Sin marcas, sin su renglón
    assert.equal(cuantas(html, /dq-indice-marcas/g), 1);
    // Sin orden_texto (no llega), el número se lee
    const sinTexto = ctx.htmlDelPanelPropuestas({ ...detalle, propuestas: detalle.propuestas.map((p) => ({ ...p, orden_texto: null })) });
    assert.deepEqual(indiceDe(sinTexto).map((i) => [i.numero, i.oculto]), [['1', null], ['2', null], ['3', null]]);
    assert.ok(sinTexto.includes('<span class="dq-indice-num">1</span> <span class="dq-indice-cuerpo"><span class="dq-indice-titulo">'));
  });

  it('la que se ve por defecto es la principal (la primera, si ninguna lo es); &propuesta=K, la de orden K; una que no existe, la principal', () => {
    const detalle = DETALLE_CON_REPETICION();
    const titulos = detalle.propuestas.map((p) => p.titulo);
    assert.deepEqual([actualDe(panel(detalle, null)), tituloDe(panel(detalle, null))], [['1'], titulos[0]]);
    assert.deepEqual([actualDe(panel(detalle, 3)), tituloDe(panel(detalle, 3))], [['3'], titulos[2]]);
    assert.deepEqual([actualDe(panel(detalle, 2)), tituloDe(panel(detalle, 2))], [['2'], titulos[1]]);
    // Una que no existe (o que no es un entero positivo): la principal, también llamando al panel directo
    for (const propuesta of [4, 0, -1, '2', 1.5, null, undefined, 'constructor']) {
      assert.deepEqual(actualDe(panel(detalle, propuesta)), ['1'], String(propuesta));
      assert.deepEqual(actualDe(ctx.htmlDelPanelPropuestas(detalle, { propuesta })), ['1'], String(propuesta));
    }
    // La de Datito en otra posición (el orden lo dice el servidor); sin ninguna marcada, la primera
    const segunda = { ...detalle, principal_datito: { ...detalle.principal_datito, orden: 2 },
      propuestas: detalle.propuestas.map((p, i) => ({ ...p, principal: i === 1 })) };
    assert.deepEqual([actualDe(panel(segunda, null)), tituloDe(panel(segunda, null))], [['2'], titulos[1]]);
    assert.deepEqual(actualDe(panel(segunda, 99)), ['2']);
    const ninguna = { ...detalle, propuestas: detalle.propuestas.map((p) => ({ ...p, principal: false })) };
    assert.deepEqual(actualDe(panel(ninguna, null)), ['1']);
    // Sin principal_datito (un servidor de antes), la marcada o, si ninguna, la primera
    const { principal_datito: _pd, principal_equipo: _pe, ...deAntes } = segunda;
    assert.deepEqual(actualDe(panel(deAntes, null)), ['2']);
    assert.deepEqual(actualDe(panel({ ...deAntes, propuestas: ninguna.propuestas }, null)), ['1']);
    // Siempre una sola marcada y un solo <article>
    for (const propuesta of [null, 1, 2, 3, 9]) {
      assert.equal(actualDe(panel(detalle, propuesta)).length, 1, String(propuesta));
      assert.equal(cuantas(panel(detalle, propuesta), /<article /g), 1, String(propuesta));
    }
    // Sin propuestas (no llega: el POST pide al menos una), el panel vacío
    assert.equal(ctx.htmlDelPanelPropuestas({ ...detalle, propuestas: [] }), '');
  });

  it('sin orden (un servidor de antes), la posición: en el índice, en la elección y en anterior/siguiente', () => {
    const detalle = DETALLE_CON_REPETICION();
    const sinOrden = { ...detalle, propuestas: detalle.propuestas.map(({ orden: _, ...resto }) => resto) };
    assert.deepEqual(indiceDe(ctx.htmlDelPanelPropuestas(sinOrden)).map((i) => [i.propuesta, i.numero]), [['1', '1'], ['2', '2'], ['3', '3']]);
    assert.deepEqual(actualDe(panel(sinOrden, 2)), ['2']);
    assert.deepEqual(pasosDe(panel(sinOrden, 2)).map(([sentido, numero]) => [sentido, numero]), [['anterior', '1'], ['siguiente', '3']]);
    // Con un orden, el número es ese y no la posición; uno que no sirve, la posición
    const otros = { ...detalle, propuestas: [{ ...detalle.propuestas[0], orden: 5 }, { ...detalle.propuestas[1], orden: 7 }, { ...detalle.propuestas[2], orden: '<b>' }] };
    assert.deepEqual(indiceDe(ctx.htmlDelPanelPropuestas(otros)).map((i) => [i.propuesta, i.numero]), [['5', '5'], ['7', '7'], ['3', '3']]);
    assert.deepEqual(actualDe(panel(otros, 7)), ['7']);
    assert.deepEqual(pasosDe(panel(otros, 7)).map(([sentido, numero]) => [sentido, numero]), [['anterior', '5'], ['siguiente', '3']]);
    assert.deepEqual(actualDe(panel(otros, 2)), ['5'], 'la 2 no existe: la principal');
  });

  it('la propuesta que se ve, en el orden de la spec: arriba, la tira, la repetición, «Para validar», las dos columnas, el borrador, la placa, los plegados y el pie', () => {
    const [principal] = propuestasDe(DETALLE_CON_REPETICION());
    const piezas = ['<div class="dq-prop-arriba"><span class="dq-orden">Propuesta 1</span><span class="dq-etiqueta dq-et-principal"><svg aria-hidden="true"',
      '<h3 class="dq-prop-titulo" id="dq-propuesta-titulo" tabindex="-1">', '<div class="dq-cifra"><p class="dq-cifra-rotulo">', '<div class="dq-tira"><p class="dq-dataset">',
      '<dl class="dq-foto">', '<div class="dq-repite">', '<div class="dq-validar">', '<div class="dq-dos"><div class="dq-dos-izq">', '<h4>Por qué es noticia</h4>',
      '<h4>Ángulo</h4>', '<h4>Puntos centrales</h4>', '<div class="dq-redes">', 'aria-label="Copiar el texto para redes"', '<div class="dq-borrador">',
      'aria-label="Copiar el borrador"', '<h4>Idea de placa</h4>', '<span>Cómo se calculó</span>', '<span>Contexto histórico</span>', '<span>Fuentes</span>',
      '<footer class="dq-prop-pie">', 'aria-label="Copiar la propuesta (Propuesta 1)"', '<nav class="dq-pasos" aria-label="Otras propuestas">'];
    const lugares = piezas.map((pieza) => principal.indexOf(pieza));
    assert.ok(lugares.every((n) => n >= 0), JSON.stringify(piezas.filter((_, i) => lugares[i] < 0)));
    assert.deepEqual(lugares, [...lugares].sort((a, b) => a - b));
    assert.ok(principal.endsWith('</nav></footer></article>'));
  });

  it('anterior y siguiente: el número y el título de la vecina; sin anterior en la primera ni siguiente en la última', () => {
    const detalle = DETALLE_CON_REPETICION();
    const [uno, dos, tres] = detalle.propuestas.map((p) => p.titulo);
    assert.deepEqual(pasosDe(panel(detalle, 1)), [['siguiente', '2', 'Siguiente', dos]]);
    assert.deepEqual(pasosDe(panel(detalle, 2)), [['anterior', '1', 'Anterior', uno], ['siguiente', '3', 'Siguiente', tres]]);
    assert.deepEqual(pasosDe(panel(detalle, 3)), [['anterior', '2', 'Anterior', dos]]);
    // El ícono va antes de «Anterior» y después de «Siguiente» (los dos, decorativos); su nombre empieza con lo que se ve
    const medio = articuloDe(panel(detalle, 2));
    assert.match(medio, /<nav class="dq-pasos" aria-label="Otras propuestas"><button type="button" class="dq-paso dq-paso-anterior" data-ver-propuesta="1"><svg aria-hidden="true"[^>]*><path d="m15 18-6-6 6-6"\/><\/svg><span class="dq-paso-texto"><small>Anterior<\/small> /);
    assert.match(medio, /<span class="dq-paso-titulo">Un tercer título inventado<\/span><\/span><svg aria-hidden="true"[^>]*><path d="m9 18 6-6-6-6"\/><\/svg><\/button><\/nav>/);
    // Con una sola propuesta, sin anterior ni siguiente (ni su nav), con «Copiar la propuesta»; htmlDePropuesta sola, tampoco
    const una = { ...detalle, propuestas: [detalle.propuestas[0]] };
    assert.ok(!articuloDe(panel(una, null)).includes('dq-paso'));
    assert.ok(articuloDe(panel(una, null)).includes('<footer class="dq-prop-pie"><p class="dq-copiar-todo">'));
    assert.ok(!ctx.htmlDePropuesta(detalle.propuestas[1]).includes('dq-paso'));
  });

  it('todo texto del servidor va escapado: el índice, la propuesta, anterior y siguiente', () => {
    const datos = conTextos(DETALLE_CON_REPETICION(), XSS);
    for (const propuesta of [1, 2, 3]) {
      const html = panel(datos, propuesta);
      assert.ok(!html.includes('<img'), html);
      assert.deepEqual(indiceDe(html).map((i) => [i.oculto, i.titulo]), Array(3).fill([`${XSS_ESCAPADO}: `, XSS_ESCAPADO]));
      assert.equal(tituloDe(html), XSS_ESCAPADO);
      assert.ok(pasosDe(html).length > 0 && pasosDe(html).every(([, , , titulo]) => titulo === XSS_ESCAPADO));
      assert.ok(html.includes(`data-copiar="${XSS_ESCAPADO}"`));
      assert.ok(cuantas(html, /&lt;img src=x onerror=1&gt;/g) > 25);
      assert.ok(!/href="(?!dato-quincena\.html|dataset\.html\?id=\d+"|https:\/\/)/.test(html), html);
    }
  });

  it('un detalle sin ninguna de las claves nuevas (un servidor de antes) dibuja sus paneles sin romperse y con lo de antes', () => {
    const { cantidades: _c, ver_propuestas: _v, ver_datasets_nuevos: _vd, aviso_datasets_nuevos: _a, matriz_de_prioridad: _m, propuestas_datasets: _p, ...resto } = DETALLE_CON_REPETICION();
    const viejo = { ...resto, propuestas: resto.propuestas.map(({ orden: _, ...propuesta }) => propuesta) };
    for (const vista of [null, 'general', 'propuestas', 'datasets']) {
      for (const propuesta of [null, 2, 9]) {
        for (const admin of [false, true]) {
          let html = '';
          assert.doesNotThrow(() => { html = ctx.htmlDelDetalle(viejo, { admin, vista, propuesta }); }, `${vista} ${propuesta} ${admin}`);
          assert.deepEqual([...html.matchAll(/role="tabpanel" id="dq-panel-(\w+)"/g)].map((m) => m[1]), ['general', 'propuestas'], `${vista} ${propuesta}`);
        }
      }
    }
    const html = ctx.htmlDelDetalle(viejo, { vista: 'propuestas', propuesta: 2 });
    // Las pestañas, sin número; General, con «Ver las propuestas» y sin aviso ni Datasets nuevos
    assert.ok(!html.includes('dq-ed-cuenta'));
    assert.ok(panelDe(html, 'general').includes('data-ir-vista="propuestas">Ver las propuestas</button>'));
    assert.ok(!html.includes('dq-aviso-nuevos') && !html.includes('data-vista="datasets"'));
    // Propuestas: los números por la posición, la 2 elegida, con su anterior y su siguiente
    assert.deepEqual(indiceDe(html).map((i) => [i.propuesta, i.actual]), [['1', false], ['2', true], ['3', false]]);
    assert.deepEqual(pasosDe(html).map(([sentido, numero]) => [sentido, numero]), [['anterior', '1'], ['siguiente', '3']]);
    assert.equal(tituloDe(html), 'Otro título inventado');
  });
});

// La parte del DOM de las pestañas de la edición, con una hoja falsa: las pestañas y los paneles de `claves`, con `elegida` a la vista
const hojaFalsa = (claves = ['general', 'propuestas', 'datasets'], elegida = 'general', { arriba = 300, lugar = null } = {}) => {
  const enfocadas = [];
  const desplazamientos = [];
  const pestanas = claves.map((clave) => {
    const pestana = falso({ dataset: { vista: clave }, focus: (opciones) => enfocadas.push([clave, plano(opciones ?? null)]) });
    pestana.setAttribute('aria-selected', String(clave === elegida));
    if (clave !== elegida) pestana.setAttribute('tabindex', '-1');
    pestana.closest = (selector) => (selector === 'button[data-vista]' || selector === '[role="tab"][data-vista]' ? pestana : null);
    return pestana;
  });
  const paneles = claves.map((clave) => falso({ id: `dq-panel-${clave}`, hidden: clave !== elegida }));
  const lista = falso({
    querySelectorAll: (selector) => (selector === '[role="tab"][data-vista]' ? pestanas : []),
    getBoundingClientRect: () => ({ top: arriba }),
    scrollIntoView: (opciones) => desplazamientos.push(plano(opciones))
  });
  const contenido = falso({
    querySelector: (selector) => ({ '.dq-ed-pestanas': lista, '[data-infografia]': lugar })[selector] ?? null,
    querySelectorAll: (selector) => (selector === '.dq-ed-panel' ? paneles : [])
  });
  const estado = () => ({
    elegidas: pestanas.filter((p) => p.getAttribute('aria-selected') === 'true').map((p) => p.dataset.vista),
    enElTeclado: pestanas.filter((p) => p.getAttribute('tabindex') === null).map((p) => p.dataset.vista),
    visibles: paneles.filter((p) => !p.hidden).map((p) => p.id)
  });
  return { contenido, pestanas, paneles, lista, enfocadas, desplazamientos, estado };
};

describe('dato-quincena.js: las pestañas de la edición (la parte del DOM)', () => {
  const CON_DATASETS = () => respuesta('detalle_con_datasets').data;
  const conDetalle = (c, detalle, { vista = 'general', propuesta = null } = {}) => vm.runInContext(
    `vistaDatoQuincena.detalle = ${JSON.stringify(detalle)}; vistaDatoQuincena.vista = ${JSON.stringify(vista)}; vistaDatoQuincena.propuesta = ${JSON.stringify(propuesta)};`, c);
  const DETALLE_O = (detalle) => () => ({ success: true, data: detalle });

  it('al cargar, la vista y la propuesta salen de la dirección; una que no sirve abre General (o la principal) y la dirección se corrige', async () => {
    const casos = [
      // [search, detalle, la elegida, la propuesta que va al panel, las direcciones escritas]
      ['?id=12', DETALLE(), 'general', null, []],
      ['?id=12&vista=propuestas&propuesta=2', DETALLE(), 'propuestas', 2, []],
      ['?id=12&vista=propuestas', DETALLE(), 'propuestas', null, []],
      ['?id=12&vista=datasets', CON_DATASETS(), 'datasets', null, []],
      ['?id=12&vista=datasets', DETALLE(), 'general', null, ['dato-quincena.html?id=12']],
      ['?id=12&vista=x', DETALLE(), 'general', null, ['dato-quincena.html?id=12']],
      ['?id=12&vista=general', DETALLE(), 'general', null, ['dato-quincena.html?id=12']],
      ['?id=12&propuesta=3', DETALLE(), 'general', null, ['dato-quincena.html?id=12']],
      ['?id=12&vista=propuestas&propuesta=99', DETALLE(), 'propuestas', null, ['dato-quincena.html?id=12&vista=propuestas']],
      ['?id=12&vista=propuestas&propuesta=02', DETALLE(), 'propuestas', null, ['dato-quincena.html?id=12&vista=propuestas']]
    ];
    for (const [search, detalle, vista, propuesta, escritas] of casos) {
      const { c, pedidos, urls, todos } = paginaFalsa({ admin: false, search, responder: DETALLE_O(detalle) });
      await c.iniciarDatoQuincena();
      assert.deepEqual(pedidos, [['GET', '/dato-quincena/ediciones/12']], search);
      assert.equal(todos['dq-contenido'].innerHTML, c.htmlDelDetalle(detalle, { admin: false, vista, propuesta }), search);
      assert.deepEqual(urls, escritas, search);
      assert.deepEqual(plano(vm.runInContext('[vistaDatoQuincena.vista, vistaDatoQuincena.propuesta]', c)), [vista, propuesta], search);
    }
  });

  it('tocar una pestaña la elige: aria-selected, el orden del teclado, su panel, el foco y la dirección (sin sumar al historial)', () => {
    const hoja = hojaFalsa();
    const { c, urls } = paginaFalsa({ admin: false, search: '?id=12', lugares: { 'dq-contenido': hoja.contenido } });
    conDetalle(c, CON_DATASETS());
    c.alTocarDq({ target: hoja.pestanas[1] });
    assert.deepEqual(hoja.estado(), { elegidas: ['propuestas'], enElTeclado: ['propuestas'], visibles: ['dq-panel-propuestas'] });
    assert.deepEqual(hoja.enfocadas, [['propuestas', { preventScroll: true }]]);
    assert.deepEqual(urls, ['dato-quincena.html?id=12&vista=propuestas']);
    c.alTocarDq({ target: hoja.pestanas[2] });
    assert.deepEqual(hoja.estado(), { elegidas: ['datasets'], enElTeclado: ['datasets'], visibles: ['dq-panel-datasets'] });
    assert.equal(urls.at(-1), 'dato-quincena.html?id=12&vista=datasets');
    c.alTocarDq({ target: hoja.pestanas[0] });
    assert.deepEqual(hoja.estado(), { elegidas: ['general'], enElTeclado: ['general'], visibles: ['dq-panel-general'] });
    assert.equal(urls.at(-1), 'dato-quincena.html?id=12');
    // Con las pestañas a la vista, no se mueve la página
    assert.deepEqual(hoja.desplazamientos, []);
    // Una vista que la hoja no tiene no cambia nada
    assert.equal(c.elegirVistaDq('otra'), false);
    assert.deepEqual(hoja.estado().elegidas, ['general']);
  });

  it('al cambiar de pestaña, la fila de pestañas corre de costado hasta la enfocada si no se ve entera (sin movimiento con la preferencia)', () => {
    const hoja = hojaFalsa();
    const corridas = [];
    const fila = falso({ scrollLeft: 50, getBoundingClientRect: () => ({ left: 0, right: 300 }), scrollTo: (o) => corridas.push(plano(o)) });
    hoja.pestanas[2].getBoundingClientRect = () => ({ left: 260, right: 420 });
    const cerrar = hoja.pestanas[2].closest;
    hoja.pestanas[2].closest = (selector) => (selector === '[role="tablist"]' ? fila : cerrar(selector));
    const { c } = paginaFalsa({ admin: false, search: '?id=12', lugares: { 'dq-contenido': hoja.contenido } });
    conDetalle(c, CON_DATASETS());
    c.elegirVistaDq('datasets');
    assert.deepEqual(corridas, [{ left: 310, behavior: 'smooth' }]);
    c.window.matchMedia = () => ({ matches: true });
    c.elegirVistaDq('general');
    c.elegirVistaDq('datasets');
    assert.deepEqual(corridas.at(-1), { left: 310, behavior: 'instant' });
  });

  it('en Propuestas, la dirección lleva la propuesta que se mira; en las otras, no, y al volver vuelve', () => {
    const hoja = hojaFalsa();
    const { c, urls } = paginaFalsa({ admin: false, search: '?id=12&vista=propuestas&propuesta=2', lugares: { 'dq-contenido': hoja.contenido } });
    conDetalle(c, CON_DATASETS(), { vista: 'propuestas', propuesta: 2 });
    c.elegirVistaDq('general');
    assert.equal(urls.at(-1), 'dato-quincena.html?id=12');
    c.elegirVistaDq('propuestas');
    assert.equal(urls.at(-1), 'dato-quincena.html?id=12&vista=propuestas&propuesta=2');
  });

  it('las flechas, Inicio y Fin cambian de pestaña (y la eligen); con Alt, Ctrl o Meta, u otra tecla, nada', () => {
    const hoja = hojaFalsa();
    const { c, urls } = paginaFalsa({ admin: false, search: '?id=12', lugares: { 'dq-contenido': hoja.contenido } });
    conDetalle(c, CON_DATASETS());
    const tecla = (key, pestana, extra = {}) => {
      let prevenido = false;
      c.alTeclearDq({ key, target: pestana, preventDefault: () => { prevenido = true; }, ...extra });
      return prevenido;
    };
    assert.equal(tecla('ArrowRight', hoja.pestanas[0]), true);
    assert.deepEqual(hoja.estado().elegidas, ['propuestas']);
    assert.deepEqual(hoja.enfocadas.at(-1), ['propuestas', { preventScroll: true }]);
    tecla('ArrowRight', hoja.pestanas[1]);
    assert.deepEqual(hoja.estado().elegidas, ['datasets']);
    tecla('ArrowRight', hoja.pestanas[2]);
    assert.deepEqual(hoja.estado().elegidas, ['general'], 'da la vuelta');
    tecla('ArrowLeft', hoja.pestanas[0]);
    assert.deepEqual(hoja.estado().elegidas, ['datasets']);
    tecla('Home', hoja.pestanas[2]);
    assert.deepEqual(hoja.estado().elegidas, ['general']);
    tecla('End', hoja.pestanas[0]);
    assert.deepEqual(hoja.estado().elegidas, ['datasets']);
    assert.equal(urls.at(-1), 'dato-quincena.html?id=12&vista=datasets');
    const cuantasUrls = urls.length;
    assert.equal(tecla('ArrowLeft', hoja.pestanas[2], { altKey: true }), false);
    assert.equal(tecla('Home', hoja.pestanas[2], { ctrlKey: true }), false);
    assert.equal(tecla('End', hoja.pestanas[2], { metaKey: true }), false);
    assert.equal(tecla('Enter', hoja.pestanas[2]), false);
    assert.equal(tecla('ArrowDown', hoja.pestanas[2]), false);
    // Una tecla fuera de las pestañas (un botón de la propuesta), nada
    assert.equal(tecla('ArrowLeft', falso({ closest: () => null })), false);
    assert.deepEqual(hoja.estado().elegidas, ['datasets']);
    assert.equal(urls.length, cuantasUrls);
  });

  it('un botón de General lleva a su pestaña («Ver las N propuestas», a la principal) y, si las pestañas quedaron arriba, sube hasta ellas', () => {
    const hoja = hojaFalsa(undefined, 'general', { arriba: -400 });
    const { c, urls } = paginaFalsa({ admin: false, search: '?id=12', lugares: { 'dq-contenido': hoja.contenido } });
    conDetalle(c, CON_DATASETS(), { propuesta: 2 });
    const boton = (vista) => {
      const elemento = falso({ dataset: { irVista: vista } });
      elemento.closest = (selector) => (selector === 'button[data-ir-vista]' ? elemento : null);
      return elemento;
    };
    c.alTocarDq({ target: boton('datasets') });
    assert.deepEqual(hoja.estado().elegidas, ['datasets']);
    assert.equal(urls.at(-1), 'dato-quincena.html?id=12&vista=datasets');
    assert.deepEqual(hoja.enfocadas.at(-1), ['datasets', { preventScroll: true }]);
    assert.deepEqual(hoja.desplazamientos, [{ behavior: 'smooth', block: 'start' }]);
    c.alTocarDq({ target: boton('propuestas') });
    assert.deepEqual(hoja.estado().elegidas, ['propuestas']);
    assert.equal(urls.at(-1), 'dato-quincena.html?id=12&vista=propuestas', 'a la principal: sin &propuesta=');
    assert.equal(vm.runInContext('vistaDatoQuincena.propuesta', c), null);
  });

  it('con movimiento reducido, subir hasta las pestañas no se desliza', () => {
    const hoja = hojaFalsa(undefined, 'general', { arriba: -10 });
    const { c } = paginaFalsa({ admin: false, search: '?id=12', lugares: { 'dq-contenido': hoja.contenido } });
    c.window.matchMedia = () => ({ matches: true });
    conDetalle(c, CON_DATASETS());
    c.elegirVistaDq('propuestas');
    assert.deepEqual(hoja.desplazamientos, [{ behavior: 'instant', block: 'start' }]);
  });

  it('el #correo de la dirección queda al cambiar de pestaña', () => {
    const hoja = hojaFalsa();
    const { c, urls } = paginaFalsa({ admin: false, search: '?id=12', hash: '#correo', lugares: { 'dq-contenido': hoja.contenido } });
    conDetalle(c, CON_DATASETS());
    c.elegirVistaDq('propuestas');
    assert.deepEqual(urls, ['dato-quincena.html?id=12&vista=propuestas#correo']);
  });

  it('la infografía se pide una sola vez: cambiar de pestaña no la vuelve a pedir', async () => {
    const lugar = falso({ dataset: { infografia: '/dato-quincena/ediciones/12/archivos/infografia_png', alt: 'Infografía' } });
    const hoja = hojaFalsa(['general', 'propuestas', 'datasets'], 'general', { lugar });
    const { c } = paginaFalsa({ admin: false, search: '?id=12', lugares: { 'dq-contenido': hoja.contenido }, responder: DETALLE_O(CON_DATASETS()) });
    const archivos = [];
    vm.runInContext('API', c).pedirArchivo = async (ruta) => { archivos.push(ruta); throw new Error('sin archivos en la prueba'); };
    await c.iniciarDatoQuincena();
    assert.deepEqual(archivos, ['/dato-quincena/ediciones/12/archivos/infografia_png']);
    c.elegirVistaDq('propuestas');
    c.elegirVistaDq('datasets');
    c.elegirVistaDq('general');
    assert.equal(archivos.length, 1);
  });

  it('las teclas se escuchan en #dq-contenido, para todos los roles', async () => {
    for (const admin of [false, true]) {
      const enganchados = [];
      const contenido = falso({ addEventListener: (tipo) => enganchados.push(tipo) });
      const { c } = paginaFalsa({ admin, search: '?id=12', lugares: { 'dq-contenido': contenido, 'dq-envio-lugar': falso() },
        responder: (_m, ruta) => ({ success: true, data: ruta.endsWith('/correo') ? CAJA() : DETALLE() }) });
      await c.iniciarDatoQuincena();
      assert.ok(enganchados.includes('click') && enganchados.includes('keydown'), String(admin));
    }
  });

  it('administración: pasar a Correo y volver deja la misma pestaña y propuesta, y la caja del correo se vuelve a pedir', async () => {
    const { c, pedidos, urls, todos } = paginaFalsa({
      search: '?id=12&vista=propuestas&propuesta=2', lugares: { 'dq-envio-lugar': falso() },
      responder: (_m, ruta) => ({ success: true, data: ruta === '/dato-quincena/correo' ? CORREO() : (ruta.endsWith('/correo') ? CAJA() : DETALLE()) })
    });
    await c.iniciarDatoQuincena();
    assert.deepEqual(pedidos, [['GET', '/dato-quincena/ediciones/12'], ['GET', '/dato-quincena/ediciones/12/correo']]);
    assert.equal(todos['dq-contenido'].innerHTML, c.htmlDelDetalle(DETALLE(), { admin: true, vista: 'propuestas', propuesta: 2 }));
    assert.deepEqual(urls, []);
    await c.elegirPestanaDq('correo');
    assert.equal(urls.at(-1), 'dato-quincena.html?id=12&vista=propuestas&propuesta=2#correo');
    assert.equal(todos['dq-contenido'].innerHTML, c.htmlDelCorreo(CORREO()));
    await c.elegirPestanaDq('ediciones');
    assert.equal(urls.at(-1), 'dato-quincena.html?id=12&vista=propuestas&propuesta=2');
    assert.equal(todos['dq-contenido'].innerHTML, c.htmlDelDetalle(DETALLE(), { admin: true, vista: 'propuestas', propuesta: 2 }));
    assert.deepEqual(pedidos.slice(-2), [['GET', '/dato-quincena/ediciones/12'], ['GET', '/dato-quincena/ediciones/12/correo']]);
    assert.deepEqual(plano(vm.runInContext('[vistaDatoQuincena.vista, vistaDatoQuincena.propuesta]', c)), ['propuestas', 2]);
  });
});

// La parte del DOM de Propuestas, con un panel falso: la lectura (con el título de la propuesta que se ve) y un renglón del índice por
// propuesta, con `elegida` marcada. `fila` es la lista del índice (en el teléfono, la fila de chips)
const propuestasFalsas = (detalle, elegida = 1, { arriba = 300, fila = null } = {}) => {
  const enfocados = [];
  const desplazamientos = [];
  const titulo = falso({ focus: (opciones) => enfocados.push(plano(opciones ?? null)) });
  const lectura = falso({
    querySelector: (selector) => (selector === '.dq-prop-titulo' ? titulo : null),
    getBoundingClientRect: () => ({ top: arriba }),
    scrollIntoView: (opciones) => desplazamientos.push(plano(opciones))
  });
  const items = detalle.propuestas.map((p) => {
    const item = falso({ dataset: { verPropuesta: String(p.orden) }, getBoundingClientRect: () => ({ left: 20, right: 200 }) });
    if (p.orden === elegida) item.setAttribute('aria-current', 'true');
    item.closest = (selector) => ({ 'button[data-ver-propuesta]': item, ol: fila })[selector] ?? null;
    return item;
  });
  const contenido = falso({
    querySelector: (selector) => ({ '.dq-lectura': lectura })[selector] ?? null,
    querySelectorAll: (selector) => (selector === '.dq-indice-item' ? items : [])
  });
  const actuales = () => items.filter((i) => i.getAttribute('aria-current') === 'true').map((i) => i.dataset.verPropuesta);
  return { contenido, lectura, items, enfocados, desplazamientos, actuales };
};
// «Anterior», «Siguiente» o cualquier botón con data-ver-propuesta
const botonDePropuesta = (numero) => {
  const boton = falso({ dataset: { verPropuesta: String(numero) } });
  boton.closest = (selector) => (selector === 'button[data-ver-propuesta]' ? boton : null);
  return boton;
};

describe('dato-quincena.js: Propuestas, una por vez (la parte del DOM)', () => {
  const conDetalle = (c, detalle, { vista = 'propuestas', propuesta = null } = {}) => vm.runInContext(
    `vistaDatoQuincena.detalle = ${JSON.stringify(detalle)}; vistaDatoQuincena.vista = ${JSON.stringify(vista)}; vistaDatoQuincena.propuesta = ${JSON.stringify(propuesta)};`, c);

  it('elegir una del índice la dibuja, la marca (aria-current), pasa el foco a su título y reemplaza la dirección; «Anterior», lo mismo', () => {
    const detalle = DETALLE_CON_REPETICION();
    const hoja = propuestasFalsas(detalle);
    const { c, urls } = paginaFalsa({ admin: false, search: '?id=14&vista=propuestas', lugares: { 'dq-contenido': hoja.contenido } });
    conDetalle(c, detalle);
    c.alTocarDq({ target: hoja.items[2] });
    assert.equal(hoja.lectura.innerHTML, c.htmlDeLaPropuestaElegida(detalle, 3));
    assert.equal(tituloDe(hoja.lectura.innerHTML), 'Un tercer título inventado');
    assert.deepEqual(hoja.actuales(), ['3']);
    assert.deepEqual(hoja.enfocados, [{ preventScroll: true }]);
    assert.deepEqual(urls, ['dato-quincena.html?id=14&vista=propuestas&propuesta=3']);
    assert.equal(vm.runInContext('vistaDatoQuincena.propuesta', c), 3);
    // Con la propuesta a la vista, la página no se mueve
    assert.deepEqual(hoja.desplazamientos, []);
    c.alTocarDq({ target: botonDePropuesta(2) });
    assert.equal(hoja.lectura.innerHTML, c.htmlDeLaPropuestaElegida(detalle, 2));
    assert.deepEqual(hoja.actuales(), ['2']);
    assert.equal(hoja.enfocados.length, 2);
    assert.equal(urls.at(-1), 'dato-quincena.html?id=14&vista=propuestas&propuesta=2');
    // La principal, elegida desde el índice, también queda en la dirección
    c.alTocarDq({ target: hoja.items[0] });
    assert.deepEqual(hoja.actuales(), ['1']);
    assert.equal(urls.at(-1), 'dato-quincena.html?id=14&vista=propuestas&propuesta=1');
  });

  it('un número que la edición no tiene no cambia nada', () => {
    const detalle = DETALLE_CON_REPETICION();
    const hoja = propuestasFalsas(detalle);
    const { c, urls } = paginaFalsa({ admin: false, search: '?id=14&vista=propuestas', lugares: { 'dq-contenido': hoja.contenido } });
    conDetalle(c, detalle);
    for (const numero of [9, 0, -1, 'x', '', '1.5']) assert.equal(c.verPropuestaDq(botonDePropuesta(numero)), false, String(numero));
    assert.equal(hoja.lectura.innerHTML, '');
    assert.deepEqual([urls, hoja.actuales(), hoja.enfocados], [[], ['1'], []]);
    // Sin un detalle cargado (otra carga en camino), tampoco
    vm.runInContext('vistaDatoQuincena.detalle = null;', c);
    assert.equal(c.verPropuestaDq(botonDePropuesta(2)), false);
    assert.equal(hoja.lectura.innerHTML, '');
  });

  it('si la propuesta quedó arriba de la vista («Siguiente» al pie de una larga), la página sube hasta ella; con movimiento reducido, sin deslizarse', () => {
    const detalle = DETALLE_CON_REPETICION();
    const hoja = propuestasFalsas(detalle, 1, { arriba: -900 });
    const { c } = paginaFalsa({ admin: false, search: '?id=14&vista=propuestas', lugares: { 'dq-contenido': hoja.contenido } });
    conDetalle(c, detalle);
    c.alTocarDq({ target: botonDePropuesta(2) });
    assert.deepEqual(hoja.desplazamientos, [{ behavior: 'smooth', block: 'start' }]);
    c.window.matchMedia = () => ({ matches: true });
    c.alTocarDq({ target: botonDePropuesta(3) });
    assert.deepEqual(hoja.desplazamientos.at(-1), { behavior: 'instant', block: 'start' });
  });

  it('en el teléfono, la fila de chips corre de costado hasta la elegida si no se ve; si se ve, no se mueve', () => {
    const detalle = DETALLE_CON_REPETICION();
    const corridas = [];
    const fila = falso({ scrollLeft: 100, getBoundingClientRect: () => ({ left: 16, right: 360 }), scrollTo: (opciones) => corridas.push(plano(opciones)) });
    const hoja = propuestasFalsas(detalle, 1, { fila });
    hoja.items[2].getBoundingClientRect = () => ({ left: 400, right: 640 });
    const { c } = paginaFalsa({ admin: false, search: '?id=14&vista=propuestas', lugares: { 'dq-contenido': hoja.contenido } });
    conDetalle(c, detalle);
    c.alTocarDq({ target: hoja.items[2] });
    assert.deepEqual(corridas, [{ left: 484, behavior: 'smooth' }]);
    c.alTocarDq({ target: hoja.items[1] });
    assert.equal(corridas.length, 1);
    c.window.matchMedia = () => ({ matches: true });
    hoja.items[0].getBoundingClientRect = () => ({ left: -200, right: -20 });
    c.alTocarDq({ target: hoja.items[0] });
    assert.deepEqual(corridas.at(-1), { left: -116, behavior: 'instant' });
  });

  it('al abrir Propuestas (la página o la pestaña), la fila de chips corre de una hasta la elegida; en otra pestaña, no', async () => {
    const detalle = DETALLE_CON_REPETICION();
    const corridas = [];
    const fila = falso({ scrollLeft: 0, getBoundingClientRect: () => ({ left: 16, right: 360 }), scrollTo: (opciones) => corridas.push(plano(opciones)) });
    const elegido = falso({ getBoundingClientRect: () => ({ left: 500, right: 740 }) });
    elegido.closest = (selector) => (selector === 'ol' ? fila : null);
    const pestanas = hojaFalsa(['general', 'propuestas'], 'general');
    const contenido = falso({
      querySelector: (selector) => (selector === '.dq-indice-item[aria-current]' ? elegido : pestanas.contenido.querySelector(selector)),
      querySelectorAll: (selector) => pestanas.contenido.querySelectorAll(selector)
    });
    const { c } = paginaFalsa({ admin: false, search: '?id=14&vista=propuestas&propuesta=3', lugares: { 'dq-contenido': contenido },
      responder: () => ({ success: true, data: detalle }) });
    await c.iniciarDatoQuincena();
    assert.deepEqual(corridas, [{ left: 484, behavior: 'instant' }]);
    c.elegirVistaDq('general');
    assert.equal(corridas.length, 1);
    c.elegirVistaDq('propuestas');
    assert.deepEqual(corridas, [{ left: 484, behavior: 'instant' }, { left: 484, behavior: 'instant' }]);
  });

  it('«Ver las N propuestas» vuelve a la principal aunque se estuviera mirando otra', () => {
    const detalle = DETALLE_CON_REPETICION();
    const pestanas = hojaFalsa(['general', 'propuestas'], 'general');
    const hoja = propuestasFalsas(detalle, 3);
    const contenido = falso({
      querySelector: (selector) => hoja.contenido.querySelector(selector) ?? pestanas.contenido.querySelector(selector),
      querySelectorAll: (selector) => (selector === '.dq-indice-item' ? hoja.items : pestanas.contenido.querySelectorAll(selector))
    });
    const { c, urls } = paginaFalsa({ admin: false, search: '?id=14', lugares: { 'dq-contenido': contenido } });
    conDetalle(c, detalle, { vista: 'general', propuesta: 3 });
    const ver = falso({ dataset: { irVista: 'propuestas' } });
    ver.closest = (selector) => (selector === 'button[data-ir-vista]' ? ver : null);
    c.alTocarDq({ target: ver });
    assert.equal(hoja.lectura.innerHTML, c.htmlDeLaPropuestaElegida(detalle, null));
    assert.equal(tituloDe(hoja.lectura.innerHTML), 'Un título inventado');
    assert.deepEqual(hoja.actuales(), ['1']);
    assert.deepEqual(pestanas.estado().elegidas, ['propuestas']);
    assert.equal(urls.at(-1), 'dato-quincena.html?id=14&vista=propuestas');
    // El foco va a la pestaña, no al título
    assert.deepEqual(pestanas.enfocadas, [['propuestas', { preventScroll: true }]]);
    assert.deepEqual(hoja.enfocados, []);
  });

  it('los «Copiar» de la propuesta dibujada siguen andando: el clic llega por #dq-contenido', async () => {
    const { c } = paginaFalsa({ admin: false, search: '?id=14&vista=propuestas' });
    const copiados = [];
    c.navigator = { clipboard: { writeText: async (texto) => { copiados.push(texto); } } };
    c.setTimeout = () => {};
    const boton = falso({ textContent: 'Copiar', dataset: { copiar: 'Un texto\ncon dos renglones' } });
    boton.closest = (selector) => (selector === 'button[data-copiar]' ? boton : null);
    c.alTocarDq({ target: boton });
    await new Promise((listo) => setImmediate(listo));
    assert.deepEqual(copiados, ['Un texto\ncon dos renglones']);
    assert.equal(boton.textContent, 'Copiado');
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
    assert.ok(html.includes(`data-alt="${XSS_ESCAPADO}"`));
    assert.ok(html.includes(`aria-label="Descargar ${XSS_ESCAPADO}"`));
    assert.ok(html.includes(`data-nombre="${XSS_ESCAPADO}"`));
  });

  it('la repetición: su texto y su motivo van escapados, también con el enlace', () => {
    const datos = conTextos(DETALLE_CON_REPETICION(), XSS);
    const html = ctx.htmlDelDetalle(datos);
    assert.ok(!html.includes('<img'), html);
    assert.ok(html.includes(`<b><a href="dato-quincena.html?id=12">${XSS_ESCAPADO}</a></b></p><p class="dq-repite-motivo">${XSS_ESCAPADO}</p>`));
    assert.ok(html.includes(`<span class="dq-etiqueta">${XSS_ESCAPADO}</span>`));
    // Ninguna dirección que no es de la página o https:// llega a un href
    assert.ok(!/href="(?!dato-quincena\.html|dataset\.html\?id=\d+"|https:\/\/)/.test(html), html);
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
      ...['detalle', 'detalle_equipo_coincide', 'detalle_equipo_otra'].flatMap((nombre) => [true, false].flatMap((admin) => ['general', 'propuestas']
        .map((vista) => ctx.htmlDelDetalle(respuesta(nombre).data, { admin, vista })))),
      ...['detalle_votacion_abierta', 'detalle_votacion_abierta_con_voto', 'detalle_votacion_cerrada_puntos', 'detalle_votacion_cerrada_desempate',
        'detalle_votacion_cerrada_nadie'].flatMap((nombre) => ['general', 'propuestas'].map((vista) => ctx.htmlDelDetalle(respuesta(nombre).data, { vista }))),
      ctx.htmlDelDialogoDelVoto(respuesta('detalle_votacion_abierta').data, [2]),
      ctx.htmlDeTarjeta({ ...LISTA().ediciones[0], votacion: { texto: 'Se vota hasta el mar 03/11 a las 12:00', falta_tu_voto: true } }),
      ctx.htmlDelDetalle(DETALLE_CON_REPETICION()), ctx.htmlDelDetalle(respuesta('detalle_con_datasets').data, { admin: true, vista: 'datasets' }),
      ctx.htmlDelDetalle(respuesta('detalle_datasets_vacia').data),
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

  // spec 2026-11-23-dato-quincena-principal-votacion, 4: la otra copia, para contar «Vota» mientras se tilda
  it('textoDeLosQueVotan: la misma regla que la del servidor', () => {
    for (let n = 0; n <= 25; n++) assert.equal(ctx.textoDeLosQueVotan(n), textoDeLosQueVotan(n), String(n));
    assert.deepEqual([0, 1, 3].map((n) => ctx.textoDeLosQueVotan(n)), ['No vota nadie.', 'Vota 1 persona.', 'Votan 3 personas.']);
  });

  it('htmlDelCorreo: «Envío por correo» con el interruptor prendido, la regla y las próximas; la votación; «Las personas» con la tabla', () => {
    const html = ctx.htmlDelCorreo(CORREO());
    assert.match(html, /^<div class="dq-correo"><section class="dq-caja" aria-labelledby="dq-auto-titulo">/);
    assert.equal(cuantas(html, /<section class="dq-caja"/g), 3);
    assert.ok(html.includes('<h2 id="dq-auto-titulo">Envío por correo</h2>'));
    assert.ok(html.includes('<h2 id="dq-votacion-titulo">La votación de la principal del equipo</h2>'));
    assert.ok(html.includes('<h2 id="dq-quien-titulo">Las personas</h2>'));
    assert.ok(html.indexOf('dq-auto-titulo') < html.indexOf('dq-votacion-titulo'));
    assert.ok(html.indexOf('dq-votacion-titulo') < html.indexOf('dq-quien-titulo'));
    assert.ok(!html.includes('Quién lo recibe'));
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
    // La votación, en dos párrafos (la maqueta aprobada), con el nombre del bot de la constante de la página
    assert.ok(html.includes('<section class="dq-caja" aria-labelledby="dq-votacion-titulo"><div class="dq-caja-cabeza"><h2 id="dq-votacion-titulo">La votación de la principal del equipo</h2></div>'
      + '<p>Cada edición se vota hasta las <b>12:00 del día en que sale el mail</b>; si sale a las 14:00, hasta las 12:00 del día hábil siguiente. '
      + 'Cada persona que vota toca las propuestas de la que más quiere trabajar a la que menos: el 1.º puesto da tantos puntos como propuestas hay y el último, 1. '
      + 'Gana la que suma más; si empatan, la de Datito o, si no está entre las empatadas, la de número más bajo. Si nadie vota, queda la de Datito.</p>'
      + '<p class="dq-suave">Hasta el cierre se ve quién votó; el orden de cada persona, después. A las 14:00 del día del cierre, administración recibe un mail con la que ganó '
      + '(si ese día está de licencia, no le llega). Los pilotos se votan igual, sin ese mail.</p></section>'));
    // «Las personas»: qué es cada casilla, en dos renglones
    assert.ok(html.includes('<ul class="dq-que-es"><li><b>Recibe el mail:</b> a cada persona le llega su propio mail, a la casilla de su cuenta. Si ese día está de licencia, no le llega.</li>'
      + '<li><b>Vota:</b> ordena las propuestas de cada edición hasta el cierre. Puede ser de cualquier rol.</li></ul>'));
    // La tabla: persona y cargo (y la licencia), rol, correo, «Recibe el mail» y «Vota»
    assert.ok(html.includes('<table class="dq-tabla" aria-labelledby="dq-quien-titulo"><thead><tr><th scope="col">Persona</th><th scope="col">Rol</th>'
      + '<th scope="col" class="dq-col-correo">Correo</th><th scope="col" class="dq-col-recibe">Recibe el mail</th><th scope="col" class="dq-col-vota">Vota</th></tr></thead>'));
    assert.ok(html.includes('<tr><td>PruebaUno Ejemplo<small>Cargo inventado</small></td><td>Lector</td><td class="dq-col-correo">uno@ejemplo.test</td>'
      + '<td class="dq-col-recibe"><input type="checkbox" data-usuario="31" aria-label="PruebaUno Ejemplo recibe el mail" checked></td>'
      + '<td class="dq-col-vota"><input type="checkbox" data-vota="31" aria-label="PruebaUno Ejemplo vota"></td></tr>'));
    assert.ok(html.includes('<tr><td>PruebaDos Ejemplo<small class="dq-licencia">De licencia hasta el 30/11</small></td><td>Editor</td><td class="dq-col-correo">dos@ejemplo.test</td>'
      + '<td class="dq-col-recibe"><input type="checkbox" data-usuario="32" aria-label="PruebaDos Ejemplo recibe el mail"></td>'
      + '<td class="dq-col-vota"><input type="checkbox" data-vota="32" aria-label="PruebaDos Ejemplo vota" checked></td></tr>'));
    // El pie: los textos del servidor tal cual y un solo «Guardar»
    assert.ok(html.includes('<div class="dq-correo-pie"><p class="dq-suave"><span id="dq-cuantas-reciben">Lo recibe 1 persona.</span> '
      + '<span id="dq-cuantas-votan">Vota 1 persona.</span></p>'
      + '<button type="button" class="dq-btn dq-btn-tinta" data-guardar-lista>Guardar</button></div>'));
    assert.equal(cuantas(html, /data-guardar-lista/g), 1);
    assert.ok(!html.includes('Lo reciben 1'));
    // Solo el true literal está tildado
    const textos = ctx.htmlDelCorreo({ ...CORREO(), personas: CORREO().personas.map((p) => ({ ...p, recibe: 'true', vota: 1 })) });
    assert.equal(cuantas(textos, / checked>/g), 1, 'solo el interruptor');
  });

  it('apagado, sin checked y lo dice; sin próximas (no se pudo leer el calendario), lo dice; una persona sin un id que sirva, sin casilla', () => {
    const html = ctx.htmlDelCorreo({ ...CORREO(), envio_activo: false, proximas: [] });
    assert.ok(html.includes('<input type="checkbox" id="dq-envio-activo" role="switch" aria-label="Envío automático"><span id="dq-envio-estado">Envío automático apagado</span>'));
    assert.ok(!html.includes('dq-proximas'));
    assert.ok(html.includes('<p class="dq-suave">No se pudieron estimar las próximas ediciones. Probá de nuevo en unos minutos.</p>'));
    // Solo el true literal está prendido
    assert.ok(ctx.htmlDelCorreo({ ...CORREO(), envio_activo: 'true' }).includes('Envío automático apagado'));
    const rara = ctx.htmlDelCorreo({ ...CORREO(), personas: [{ ...CORREO().personas[0], id: '31" onclick="x' }] });
    assert.ok(!rara.includes('data-usuario') && !rara.includes('data-vota'), rara);
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

  // spec 2026-11-18-dato-quincena-detalle-pestanas, 3: la caja «Correo», al final de General, con su comportamiento de siempre
  it('el detalle de la administración tiene el lugar de la caja al final de General; el de los demás, no', () => {
    for (const nombre of ['detalle', 'detalle_con_datasets']) {
      const admin = ctx.htmlDelDetalle(respuesta(nombre).data, { admin: true, vista: 'propuestas' });
      const general = panelDe(admin, 'general');
      const caja = '<div class="dq-correo-de-la-edicion"><div id="dq-envio-lugar"><section class="dq-envio-caja" aria-label="Correo"><h3>Correo</h3>'
        + '<p>Cargando…</p></section></div></div>';
      assert.ok(general.endsWith(`${caja}</div>`), nombre);
      assert.equal(cuantas(admin, /id="dq-envio-lugar"/g), 1, nombre);
      assert.ok(general.indexOf('dq-archivos') < general.indexOf('dq-envio-lugar'), nombre);
    }
    for (const otro of [ctx.htmlDelDetalle(DETALLE()), ctx.htmlDelDetalle(DETALLE(), { admin: 'true' })]) {
      assert.ok(!otro.includes('dq-envio'), 'sin la caja');
      assert.ok(!otro.includes('dq-correo-de-la-edicion'), 'sin la caja');
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
    assert.ok(cuantas(correo, /&lt;img src=x onerror=1&gt;/g) >= 14);
    const conNombre = ctx.htmlDelCorreo({ ...CORREO(), personas: [{ ...CORREO().personas[0], nombre }] });
    assert.ok(conNombre.includes('aria-label="&lt;b&gt;Negrita&lt;/b&gt; recibe el mail"'));
    assert.ok(conNombre.includes('aria-label="&lt;b&gt;Negrita&lt;/b&gt; vota"'));
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
    setAttribute: (n, v) => { atributos[n] = String(v); }, getAttribute: (n) => atributos[n] ?? null, removeAttribute: (n) => { delete atributos[n]; }, atributos,
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
    'dq-modal-descargar': falso(), 'dq-reenvio': falso(), 'dq-reenvio-confirmar': falso(), 'dq-reenvio-cuerpo': falso(),
    'dq-voto': falso(), 'dq-voto-cuerpo': falso(), 'dq-voto-guardar': falso(), 'dq-voto-texto': falso(), 'dq-voto-anuncio': falso(), ...lugares };
  // Los oyentes del documento se suman: Escape lo escuchan los tres diálogos y cada uno mira si está abierto
  const sumarOyente = (clave, f) => {
    const antes = oyentes[clave];
    oyentes[clave] = antes ? (evento) => { antes(evento); return f(evento); } : f;
  };
  c.document = { ...documentoMinimo(), title: '', getElementById: (id) => todos[id] ?? null, addEventListener: (tipo, f) => sumarOyente(`document:${tipo}`, f) };
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

  it('tildar cuenta en vivo con las copias de las reglas; «Guardar» manda las dos listas y queda deshabilitado hasta la respuesta', async () => {
    const casillas = [falso({ checked: true, dataset: { usuario: '31' } }), falso({ checked: false, dataset: { usuario: '32' } }),
      falso({ checked: true, dataset: { usuario: '33' } })];
    const votan = [falso({ checked: false, dataset: { vota: '31' } }), falso({ checked: true, dataset: { vota: '32' } }),
      falso({ checked: false, dataset: { vota: '33' } })];
    const cuantasReciben = falso();
    const cuantasVotan = falso();
    let boton;
    const contenido = falso({ querySelectorAll: (selector) => ({ 'input[data-usuario]': casillas, 'input[data-vota]': votan })[selector] ?? [] });
    const { c, pedidos, avisos } = paginaFalsa({
      lugares: { 'dq-contenido': contenido, 'dq-cuantas-reciben': cuantasReciben, 'dq-cuantas-votan': cuantasVotan },
      responder: () => {
        assert.equal(boton.disabled, true, 'deshabilitado hasta la respuesta');
        return { success: true, data: { usuarios: [31, 33], votantes: [32] }, message: 'Guardamos la lista: lo reciben 2 personas y vota 1.' };
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
    // «Vota», con su copia: cada casilla cuenta al cambiar, por #dq-contenido
    const cambio = (casilla) => c.alCambiarDq({ target: { ...casilla, matches: (selector) => selector === 'input[data-vota]' } });
    cambio(votan[1]);
    assert.equal(cuantasVotan.textContent, 'Vota 1 persona.');
    votan[0].checked = true;
    cambio(votan[0]);
    assert.equal(cuantasVotan.textContent, 'Votan 2 personas.');
    votan[0].checked = false;
    votan[1].checked = false;
    cambio(votan[1]);
    assert.equal(cuantasVotan.textContent, 'No vota nadie.');
    assert.equal(cuantasReciben.textContent, 'Todavía no lo recibe nadie.', 'tildar «Vota» no cambia el pie de «Recibe el mail»');
    votan[1].checked = true;
    boton = falso();
    const guardando = c.guardarListaDq(boton);
    await c.guardarListaDq(boton);
    await guardando;
    assert.deepEqual(pedidos, [['PUT', '/dato-quincena/correo/destinatarios', { usuarios: [31, 33], votantes: [32] }]], 'un doble clic manda un solo pedido');
    assert.equal(boton.disabled, false);
    assert.deepEqual(avisos, [['Guardamos la lista: lo reciben 2 personas y vota 1.', 'success']]);
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
    assert.equal(c.document.title, 'Envío y votación - El dato de la quincena - RPAD');
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
    // La región viva de la página, «Cargando…» y la del diálogo «Tu orden» (aria-modal: lo de afuera no se anuncia mientras está abierto)
    assert.equal(cuantas(html, /role="status"/g), 3, 'la región viva, «Cargando…» y la del diálogo');
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

  // spec 2026-11-23-dato-quincena-principal-votacion, 4: el diálogo «Tu orden», como el de «Reenviar»; el de la principal elegida a mano
  // ya no está
  it('el diálogo «Tu orden»: el título, el texto que llena el script, la ×, el cuerpo, su región viva, «Cancelar» y «Guardar mi orden» deshabilitado', () => {
    const desde = html.indexOf('<div class="modal-overlay" id="dq-voto">');
    assert.ok(desde > html.indexOf('</footer>'), 'después del footer');
    const modal = html.slice(desde, html.indexOf('<!--', desde));
    assert.match(modal, /<div class="modal dq-modal dq-modal-chico dq-modal-voto" role="dialog" aria-modal="true" aria-labelledby="dq-voto-titulo" aria-describedby="dq-voto-texto">/);
    assert.ok(modal.includes(`<h2 class="modal-title" id="dq-voto-titulo">${constante('TEXTOS_DEL_VOTO').tuOrden}</h2>`));
    assert.match(modal, /<button type="button" class="modal-close" data-cerrar aria-label="Cerrar">&times;<\/button>/);
    // El texto es el del servidor (votacion.dialogo): el HTML lo deja vacío
    assert.match(modal, /<p class="dq-dialogo-texto" id="dq-voto-texto"><\/p>/);
    assert.match(modal, /<div id="dq-voto-cuerpo"><\/div>/);
    // La región viva del diálogo, fuera del cuerpo que se vuelve a dibujar en cada toque
    assert.match(modal, /<div id="dq-voto-cuerpo"><\/div>\s*<p class="visualmente-oculto" id="dq-voto-anuncio" role="status"><\/p>/);
    assert.match(modal, /<button type="button" class="dq-btn dq-btn-borde" data-cerrar>Cancelar<\/button>/);
    // «Guardar mi orden» empieza deshabilitado: el script lo habilita cuando todas tienen su puesto
    assert.ok(modal.includes(`<button type="button" class="dq-btn dq-btn-tinta" id="dq-voto-guardar" disabled>${constante('TEXTOS_DEL_VOTO').guardar}</button>`));
    assert.ok(!html.includes('id="dq-principal'), 'sin el diálogo de la principal elegida a mano');
    // Nada se mueve con movimiento reducido
    const estilo = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    assert.match(estilo, /@media \(prefers-reduced-motion: reduce\) \{[^@]*#dq-voto,/);
    assert.doesNotMatch(estilo, /#dq-principal/);
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
    assert.deepEqual(repetidos(html + ctx.htmlDePestanas('ediciones') + ctx.htmlDelDetalle(respuesta('detalle_con_datasets').data, { admin: true })
      + ctx.htmlDeLaCajaDelCorreo(CAJA())), []);
    // Con la franja del equipo (de antes y votada), los votos y el cuerpo del diálogo «Tu orden»
    for (const nombre of ['detalle', 'detalle_equipo_coincide', 'detalle_equipo_otra', 'detalle_votacion_abierta', 'detalle_votacion_abierta_con_voto',
      'detalle_votacion_cerrada_puntos', 'detalle_votacion_cerrada_desempate', 'detalle_votacion_cerrada_nadie']) {
      const detalle = respuesta(nombre).data;
      assert.deepEqual(repetidos(html + ctx.htmlDePestanas('ediciones') + ctx.htmlDelDetalle(detalle, { admin: true, vista: 'propuestas' })
        + ctx.htmlDelDialogoDelVoto(detalle, [1])), [], nombre);
    }
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

  // spec 2026-11-14-dato-quincena-v1-3, 4: Repite blanca con un borde de 1 px por dentro; la caja de la repetición con los márgenes
  // de .dq-validar; Efeméride no tiene clase propia
  it('el CSS de la etiqueta Repite y de la caja de la repetición', () => {
    const estilo = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    assert.match(estilo, /\.dq-et-repite \{ background: #fff; color: var\(--sg-texto\); box-shadow: inset 0 0 0 1px var\(--sg-borde-control\); \}/);
    assert.match(estilo, /\.dq-repite \{ margin: 14px 0 0; padding: 12px 14px; border-radius: 12px; background: var\(--sg-sutil\); border: 1px solid var\(--sg-linea\);/);
    assert.match(estilo, /\.dq-validar \{ margin: 14px 0 0; padding: 12px 14px; border-radius: 12px;/);
    for (const clase of ['dq-repite-texto', 'dq-repite-motivo']) assert.ok(estilo.includes(`.${clase}`), clase);
    assert.doesNotMatch(estilo, /dq-et-efemeride/);
    // El enlace a la edición previa se ve como enlace: main.css saca el subrayado a todo <a> y el texto ya es negrita y tinta, así
    // que sin subrayado no se distinguiría del texto sin enlace (el color nunca es lo único que distingue)
    assert.match(estilo, /\.dq-repite-texto a \{ color: var\(--sg-tinta\); text-decoration: underline; text-underline-offset: 3px; \}/);
    // El ícono, alineado con el primer renglón cuando el texto ocupa dos (como la maqueta)
    assert.match(estilo, /\.dq-repite-texto \{[^}]*align-items: flex-start;/);
    assert.doesNotMatch(estilo, /\.dq-repite-texto \{[^}]*align-items: center;/);
    assert.match(estilo, /\.dq-repite-texto svg \{ flex: none; margin-top: 3px; \}/);
  });

  // spec 2026-11-18-dato-quincena-detalle-pestanas, 2, 3 y 7: la maqueta A «Diario»
  it('el CSS del detalle en pestañas: la hoja, la doble línea, las pestañas como secciones, General y el teléfono', () => {
    const estilo = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    for (const clase of ['dq-hoja', 'dq-mancheta', 'dq-ed-fecha', 'dq-ed-paquete', 'dq-ed-pestanas', 'dq-ed-pestana', 'dq-ed-cuenta',
      'dq-ed-panel', 'dq-portada', 'dq-figura', 'dq-la-principal', 'dq-sobre', 'dq-principal-titulo', 'dq-principal-etiquetas', 'dq-principal-cifra',
      'dq-cifra-rotulo', 'dq-cifra-texto',
      'dq-principal-dataset', 'dq-ir', 'dq-edicion-pie', 'dq-agenda-cols', 'dq-agenda-col', 'dq-linea', 'dq-evento-titulo', 'dq-evento-detalle',
      'dq-archivos-fila', 'dq-aviso-nuevos', 'dq-correo-de-la-edicion']) assert.ok(estilo.includes(`.${clase}`), clase);
    // La doble línea arriba de las pestañas; la elegida, en tinta y con una barra gruesa debajo (no es solo el color)
    assert.match(estilo, /\.dq-ed-pestanas \{[^}]*border-top: 4px double var\(--sg-tinta\);/);
    assert.match(estilo, /\.dq-ed-pestana\[aria-selected="true"\]::after \{[^}]*height: 5px; background: var\(--sg-tinta\);/);
    // El foco de la pestaña se ve (por dentro, como las de Ediciones y Correo)
    assert.match(estilo, /\.dq-pagina \.dq-ed-pestana:focus-visible \{[^}]*outline-offset: -3px;/);
    // En la computadora, la infografía a la izquierda; en el teléfono, primero la principal (el orden del HTML)
    assert.match(estilo, /\.dq-figura \{[^}]*grid-column: 1; grid-row: 1;/);
    assert.match(estilo, /@media \(max-width: 820px\) \{[\s\S]*?\.dq-portada \{ grid-template-columns: minmax\(0, 1fr\); \}[\s\S]*?\.dq-figura, \.dq-la-principal \{ grid-column: auto; grid-row: auto; \}/);
    // En el teléfono, las tres pestañas en un renglón: el texto puede ir en dos
    assert.match(estilo, /@media \(max-width: 640px\) \{[\s\S]*?\.dq-ed-pestana \{[^}]*white-space: normal;/);
    // Lo largo no ensancha la página
    for (const clase of ['dq-ed-fecha', 'dq-principal-titulo', 'dq-principal-cifra', 'dq-principal-dataset']) {
      assert.match(estilo, new RegExp(`\\.${clase} \\{[^}]*overflow-wrap: anywhere;`), clase);
    }
    // El aviso de los datasets nuevos con el verde claro; el texto, con el verde oscuro (5,7:1)
    assert.match(estilo, /--sg-verde-claro: #EEF6F1;/);
    assert.match(estilo, /\.dq-aviso-nuevos \{[^}]*background: var\(--sg-verde-claro\);/);
    // Las pestañas, debajo del encabezado fijo cuando la página sube hasta ellas
    assert.match(estilo, /\.dq-ed-pestanas \{[^}]*scroll-margin-top: calc\(var\(--header-height\) \+ 12px\);/);
    // El costado fijo y la columna del detalle de antes ya no están
    assert.doesNotMatch(estilo, /dq-lateral|\.dq-detalle\b|\.dq-columna|\.dq-titulo-paquete|\.dq-cabecera \{|\.dq-fecha \{/);
  });

  // spec 2026-11-23-dato-quincena-detalle-visual: la cifra en una ficha celeste (también en alto contraste, por el borde), el título un
  // poco más chico, los títulos de los campos de la propuesta en Bricolage y los de Datasets nuevos y «Para validar» como estaban
  it('el CSS de la ficha, del título y de los campos (spec 2026-11-23-dato-quincena-detalle-visual)', () => {
    const estilo = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    assert.match(estilo, /\.dq-cifra, \.dq-principal-cifra \{[^}]*border: 1px solid transparent;[^}]*border-radius: 12px; background: var\(--sg-cielo\); color: var\(--sg-tinta\);[^}]*overflow-wrap: anywhere;/);
    assert.match(estilo, /\.dq-cifra-texto \{[^}]*font-family: var\(--f-titulo\); font-weight: 700; font-size: clamp\(1\.12rem, 1rem \+ 0\.4vw, 1\.3rem\);[^}]*overflow-wrap: anywhere;/);
    assert.match(estilo, /\.dq-cifra-rotulo \{[^}]*font-size: 0\.8rem; font-weight: 700;/);
    assert.match(estilo, /\.dq-prop-titulo \{[^}]*font-size: clamp\(1\.45rem, 1\.15rem \+ 0\.95vw, 1\.9rem\);/);
    assert.match(estilo, /\.dq-campo h4, \.dq-redes-cabeza h4, \.dq-borrador-cabeza h4 \{[^}]*font-family: var\(--f-titulo\); font-size: 1\.05rem; font-weight: 700;/);
    assert.match(estilo, /\.dq-campo h5 \{[^}]*font-family: var\(--f-texto\); font-size: 0\.88rem;/);
    assert.match(estilo, /\.dq-validar h4, \.dq-validar h5 \{[^}]*font-family: var\(--f-texto\);/);
    const telefono = estilo.match(/@media \(max-width: 640px\) \{([\s\S]*?)\n {8}\}/)?.[1] ?? '';
    assert.ok(telefono.includes('.dq-prop-titulo { font-size: 1.4rem; }'), 'el título en el teléfono');
    assert.ok(telefono.includes('.dq-cifra-texto, .dq-principal-cifra .dq-cifra-texto { font-size: 1.08rem; }'), 'la cifra en el teléfono');
    // La cifra grande de antes ya no está
    assert.ok(!estilo.includes('font-weight: 800; font-size: clamp(1.55rem, 1.2rem + 1vw, 2rem)'));
    assert.ok(!estilo.includes('.dq-prop-titulo, .dq-cifra { font-size: 1.5rem; }'));
    assert.ok(!estilo.includes('.dq-principal-cifra { font-size: 1.5rem; }'));
  });

  it('las pestañas de la edición corren de costado si no entran (sin barra a la vista) y el anillo del foco de la primera no tapa la «G»', () => {
    const estilo = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    assert.match(estilo, /\.dq-ed-pestanas \{[^}]*overflow-x: auto; scrollbar-width: none;/);
    assert.match(estilo, /\.dq-ed-pestanas::-webkit-scrollbar \{ display: none; \}/);
    // El anillo va por dentro (outline-offset: -3px): la primera deja lugar a la izquierda, también en el teléfono
    assert.match(estilo, /\.dq-ed-pestana:first-child \{ padding-left: 8px; \}/);
    assert.doesNotMatch(estilo, /\.dq-ed-pestana:first-child \{ padding-left: 0; \}/);
    // En el teléfono, una pestaña no se achica por debajo de sus palabras (se encimarían): la fila corre
    const telefono = estilo.match(/@media \(max-width: 640px\) \{([\s\S]*?)\n {8}\}/)?.[1] ?? '';
    assert.match(telefono, /\.dq-ed-pestana \{[^}]*white-space: normal;/);
    assert.doesNotMatch(telefono, /\.dq-ed-pestana \{[^}]*min-width: 0;/);
    // Nada sale por debajo de la fila (con overflow-x: auto se cortaría): la barra de la elegida y el filete, por dentro
    assert.match(estilo, /\.dq-ed-pestana\[aria-selected="true"\]::after \{[^}]*bottom: 0;/);
    assert.match(estilo, /\.dq-ed-pestanas \{[^}]*box-shadow: inset 0 -1px 0 var\(--sg-linea\);/);
  });

  // spec 2026-11-18-dato-quincena-detalle-pestanas, 4 y 7: Propuestas, como la maqueta A
  it('el CSS de Propuestas: el índice fijo, la elegida marcada con más que el color, nada largo ensancha, los chips en el teléfono', () => {
    const estilo = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    for (const clase of ['dq-propuestas', 'dq-indice', 'dq-indice-item', 'dq-indice-num', 'dq-indice-cuerpo', 'dq-indice-titulo', 'dq-indice-marcas',
      'dq-im-principal', 'dq-im-validar', 'dq-lectura', 'dq-propuesta', 'dq-tira', 'dq-tira-rotulo', 'dq-dos', 'dq-dos-izq', 'dq-redes', 'dq-redes-cabeza',
      'dq-redes-post', 'dq-borrador', 'dq-borrador-cabeza', 'dq-borrador-cuerpo', 'dq-placa', 'dq-plegados', 'dq-plegado', 'dq-plegado-cuerpo',
      'dq-prop-pie', 'dq-copiar-todo', 'dq-pasos', 'dq-paso', 'dq-paso-titulo']) assert.ok(estilo.includes(`.${clase}`), clase);
    // El índice, de ~280 px, fijo al bajar
    assert.match(estilo, /\.dq-propuestas \{[^}]*grid-template-columns: 272px minmax\(0, 1fr\);/);
    assert.match(estilo, /\.dq-indice \{[^}]*position: sticky;/);
    // Sin tope de alto el índice largo quedaba cortado por la ventana: con tope y su propio scroll
    assert.match(estilo, /\.dq-indice \{[^}]*max-height: calc\(100vh - var\(--header-height\) - 32px\); overflow-y: auto;/);
    // Entre 641 y 960 px, «Archivos» de a tres: el primero de cada fila sin relleno y un filete arriba desde el cuarto
    const medio = estilo.match(/@media \(min-width: 641px\) and \(max-width: 960px\) \{([\s\S]*?)\n        \}/)?.[1] ?? '';
    assert.match(medio, /\.dq-archivos-fila \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
    assert.match(medio, /\.dq-archivos-fila li:nth-child\(3n\+1\) \{[^}]*padding-left: 0;/);
    assert.match(medio, /\.dq-archivos-fila li:nth-child\(n\+4\) \{[^}]*border-top: 1px solid var\(--sg-linea\);/);
    // Lo largo sin cortes no ensancha ni el índice ni la propuesta
    assert.match(estilo, /\.dq-indice \{[^}]*overflow-wrap: anywhere;/);
    assert.match(estilo, /\.dq-propuesta \{[^}]*overflow-wrap: anywhere;/);
    assert.match(estilo, /\.dq-lectura \{[^}]*min-width: 0;/);
    assert.match(estilo, /\.dq-paso-titulo \{[^}]*text-overflow: ellipsis; white-space: nowrap;/);
    // La elegida: el fondo, el número y el título en tinta y una barra gruesa (no es solo el color). Con [aria-current] a secas:
    // tests/paginas.test.js no deja escrito «aria-current=» en una página de administración
    assert.match(estilo, /\.dq-indice-item\[aria-current\]::before \{[^}]*width: 5px; background: var\(--sg-tinta\);/);
    assert.doesNotMatch(estilo, /aria-current=/);
    // El título recibe el foco desde el código: sin anillo con el mouse, con el de la página con el teclado
    assert.match(estilo, /\.dq-prop-titulo:focus:not\(:focus-visible\) \{ outline: none; box-shadow: none; \}/);
    assert.match(estilo, /\.dq-prop-titulo \{[^}]*scroll-margin-top:/);
    // El borrador, a ancho de lectura
    assert.match(estilo, /\.dq-borrador-cuerpo \{ max-width: 68ch; \}/);
    // En el teléfono, el índice es una fila de chips que corre de costado; la elegida, con el borde grueso y la barra abajo
    const angosta = estilo.match(/@media \(max-width: 820px\) \{([\s\S]*?)\n {8}\}/)?.[1] ?? '';
    assert.match(angosta, /\.dq-indice ol \{[^}]*display: flex;[^}]*overflow-x: auto;/);
    assert.match(angosta, /\.dq-indice-item\[aria-current\]::before \{[^}]*height: 4px;/);
    // Nada se mueve con movimiento reducido: la flecha de los plegados no gira
    assert.match(estilo, /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.dq-plegado > summary svg \{ transition: none; \}/);
    // La propuesta completa de antes ya no está
    assert.doesNotMatch(estilo, /\.dq-completa|\.dq-nota \{|\.dq-nota, /);
  });

  it('el CSS de la pestaña Correo y de la caja del detalle (la maqueta aprobada): el interruptor quieto con movimiento reducido', () => {
    const estilo = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    for (const clase of ['dq-correo', 'dq-caja', 'dq-caja-cabeza', 'dq-switch', 'dq-proximas', 'dq-corrida', 'dq-tabla', 'dq-col-correo',
      'dq-col-recibe', 'dq-col-vota', 'dq-que-es', 'dq-correo-pie', 'dq-envio-caja', 'dq-mal', 'dq-envio-acciones', 'dq-opciones', 'dq-licencia']) {
      assert.ok(estilo.includes(`.${clase}`), clase);
    }
    assert.match(estilo, /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.dq-switch input, \.dq-switch input::after \{ transition: none; \}/);
    // El foco visible también en las casillas, las opciones y la lista de personas
    assert.match(estilo, /\.dq-pagina input:focus-visible, \.dq-pagina select:focus-visible/);
    // En un teléfono, la tabla sin la columna del correo
    assert.match(estilo, /@media \(max-width: 560px\) \{[\s\S]*?\.dq-tabla \.dq-col-correo \{ display: none; \}/);
  });
});

// spec 2026-11-18-dato-quincena-propuestas-datasets, 5: «Propuestas de datasets nuevos», al final de la columna
describe('dato-quincena.js: las propuestas de datasets nuevos (el detalle)', () => {
  const CON_DATASETS = () => respuesta('detalle_con_datasets').data;
  const VACIA = () => respuesta('detalle_datasets_vacia').data;
  const tarjetas = (html) => html.split(/<li class="dq-nuevo" id="dq-nuevo-\d+">/).slice(1);

  it('con null (la edición sin la clave) no hay sección', () => {
    assert.equal(DETALLE().propuestas_datasets, null);
    assert.ok(!ctx.htmlDelDetalle(DETALLE()).includes('dq-nuevos'));
    assert.equal(ctx.htmlDeLosDatasetsNuevos(null), '');
    assert.equal(ctx.htmlDeLosDatasetsNuevos(undefined), '');
    assert.equal(ctx.htmlDeLosDatasetsNuevos('texto'), '');
  });

  it('con [] va el título y una línea, en el panel de Datasets nuevos', () => {
    const html = panelDe(ctx.htmlDelDetalle(VACIA()), 'datasets');
    assert.ok(html.includes('<section class="dq-nuevos"'));
    assert.match(html, /<h3 class="dq-seccion-titulo"[^>]*>Propuestas de datasets nuevos<\/h3>/);
    assert.ok(html.includes('<p class="dq-nuevos-vacia">Esta quincena no hay propuestas de datasets.</p>'));
    assert.ok(!html.includes('class="dq-nuevo"'));
    assert.ok(!html.includes('<table') && !html.includes('dq-nuevos-indice'));
  });

  it('una tarjeta por propuesta, en orden, con las piezas en su orden', () => {
    const html = panelDe(ctx.htmlDelDetalle(CON_DATASETS()), 'datasets');
    const lista = tarjetas(html);
    assert.equal(lista.length, 3);
    lista.forEach((t, i) => assert.ok(t.includes(`Dataset nuevo ${i + 1}<`)));
    const t = lista[0];
    const orden = ['dq-orden', '<h4 class="dq-nuevo-titulo" tabindex="-1">', 'dq-prio-alta', 'Valor alto · Riesgo bajo', 'Por qué abrirlo', 'Formato sugerido',
      'Campos sugeridos', 'Datasets relacionados en el portal', 'Fuentes'].map((x) => t.indexOf(x));
    assert.ok(orden.every((n) => n >= 0), String(orden));
    assert.deepEqual(orden, [...orden].sort((a, b) => a - b));
    assert.ok(t.includes('<span class="dq-etiqueta">Agenda</span><span class="dq-etiqueta">Pedidos de acceso</span>'));
    assert.ok(t.includes('<span class="dq-formato">CSV</span>'));
    assert.ok(t.includes('<code>barrio</code>'));
    assert.ok(!t.includes('Cómo anonimizar'));
  });

  it('la prioridad lleva su clase, su ícono y su texto; la caja de anonimizar va solo si hay', () => {
    const [a, b, c] = tarjetas(ctx.htmlDelDetalle(CON_DATASETS()));
    assert.match(a, /dq-etiqueta dq-prio-alta"><svg aria-hidden="true"[^>]*>.*<\/svg>Prioridad alta</);
    assert.match(b, /dq-prio-si_hay_recursos"><svg aria-hidden="true"/);
    assert.ok(b.includes('Publicar si hay recursos'));
    assert.match(c, /dq-prio-evaluar"><svg aria-hidden="true"/);
    assert.ok(!a.includes('Cómo anonimizar'));
    assert.ok(b.includes('dq-validar dq-anonimizar') && b.includes('Cómo anonimizar'));
    assert.ok(c.includes('<p class="dq-texto">Contar por mes y por zona.\nNunca por persona.</p>'));
    assert.ok(!b.includes('Datasets relacionados en el portal'));
    assert.ok(c.includes('Datasets relacionados en el portal'));
    assert.equal(cuantas(c, /<li><a href="https:\/\/datos\.ejemplo\.gob\.ar\/\d\.csv"/g), 5);
  });

  it('una prioridad con una clave desconocida no lleva clase ni ícono, pero sí su texto', () => {
    for (const clave of ['__proto__', 'constructor', 'urgente', 7, null]) {
      const lista = CON_DATASETS().propuestas_datasets.slice(0, 1);
      lista[0].prioridad = { clave, texto: 'Texto del servidor' };
      const html = ctx.htmlDeLosDatasetsNuevos(lista);
      assert.ok(html.includes('<span class="dq-etiqueta">Texto del servidor</span>'), String(clave));
      assert.ok(!html.includes('dq-prio-'), String(clave));
    }
  });

  it('todo texto del servidor sale escapado y un enlace que no es https:// va sin enlace', () => {
    const lista = CON_DATASETS().propuestas_datasets.slice(2);
    const t = lista[0];
    Object.assign(t, { numero_texto: XSS, titulo: XSS, origenes: [XSS], justificacion: XSS, formato: XSS, campos: [XSS], anonimizacion: XSS,
      valor_y_riesgo: XSS, fuentes: ['http://x.test/a', 'javascript:alert(1)', XSS] });
    t.prioridad = { clave: 'evaluar', texto: XSS };
    t.datasets_relacionados = [{ nombre: XSS, url: 'http://x.test/b' }, { nombre: 'Seguro', url: 'https://x.test/c?a=1&b=2' }];
    const html = ctx.htmlDeLosDatasetsNuevos(lista);
    assert.ok(!html.includes('<img'));
    assert.ok(cuantas(html, new RegExp(XSS_ESCAPADO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) >= 10);
    assert.ok(!html.includes('href="http://') && !html.includes('href="javascript'));
    assert.ok(html.includes('<a href="https://x.test/c?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">Seguro</a>'));
  });

  it('tolera una propuesta sin forma', () => {
    assert.doesNotThrow(() => ctx.htmlDeLosDatasetsNuevos([null, {}, { campos: 'x', origenes: null, prioridad: null }]));
  });

  it('la matriz es una tabla con encabezados de fila y de columna y las 9 celdas del servidor, cada una con la clase de su zona', () => {
    const html = panelDe(ctx.htmlDelDetalle(CON_DATASETS()), 'datasets');
    const tabla = html.match(/<table class="dq-matriz">[\s\S]*?<\/table>/)[0];
    assert.deepEqual([...tabla.matchAll(/<th scope="col">([^<]*)</g)].map((m) => m[1]), ['Valor bajo', 'Valor medio', 'Valor alto']);
    assert.deepEqual([...tabla.matchAll(/<th scope="row">([^<]*)</g)].map((m) => m[1]), ['Riesgo alto', 'Riesgo medio', 'Riesgo bajo']);
    const celdas = tabla.split('<td class="dq-celda').slice(1);
    assert.equal(celdas.length, 9);
    const matriz = CON_DATASETS().matriz_de_prioridad;
    matriz.forEach((celda, i) => {
      const zona = { alta: 'dq-zona-alta', si_hay_recursos: 'dq-zona-si_hay_recursos', evaluar: 'dq-zona-evaluar', no_se_propone: 'dq-zona-no' }[celda.clave];
      assert.ok(celdas[i].startsWith(` ${zona}"`), `${i}: ${celdas[i].slice(0, 40)}`);
      // El texto se ve solo con con_rotulo; en las otras, oculto
      assert.ok(celdas[i].includes(`<span class="${celda.con_rotulo ? 'dq-zona-rotulo' : 'visualmente-oculto'}">${celda.texto}</span>`), String(i));
    });
    assert.equal(cuantas(tabla, /dq-zona-rotulo/g), 4);
    assert.ok(celdas[0].includes('No se propone') && celdas[0].startsWith(' dq-zona-no"'));
  });

  it('cada dataset es un marcador con su número en la celda de su valor y su riesgo', () => {
    const tabla = panelDe(ctx.htmlDelDetalle(CON_DATASETS()), 'datasets').match(/<table class="dq-matriz">[\s\S]*?<\/table>/)[0];
    const celdas = tabla.split('<td class="dq-celda').slice(1);
    // 1: valor Alto, riesgo Bajo (la última); 2: Medio y Medio (la quinta); 3: Alto y Alto (la tercera)
    assert.match(celdas[8], /<button type="button" class="dq-marcador" data-ir-nuevo="0" aria-label="Dataset nuevo 1: [^"]+">1<\/button>/);
    assert.match(celdas[4], /data-ir-nuevo="1"[^>]*>2<\/button>/);
    assert.match(celdas[2], /data-ir-nuevo="2"[^>]*>3<\/button>/);
    assert.equal(cuantas(tabla, /class="dq-marcador"/g), 3);
  });

  // Ola final de la revisión: cada celda va en su columna aunque el servidor las mande desordenadas, y la que falta es un <td> vacío
  it('la matriz busca cada celda por su riesgo y su valor: desordenadas quedan en su columna y una que falta es una celda vacía', () => {
    const detalle = CON_DATASETS();
    const original = detalle.matriz_de_prioridad;
    const desordenada = [...original].reverse().filter((c) => !(c.riesgo === 'Medio' && c.valor === 'Medio'));
    const tabla = ctx.htmlDeLaMatriz(desordenada, detalle.propuestas_datasets);
    const filas = tabla.match(/<tr><th scope="row">[\s\S]*?<\/tr>/g);
    assert.equal(filas.length, 3);
    for (const [i, riesgo] of ['Alto', 'Medio', 'Bajo'].entries()) {
      const celdas = filas[i].split(/<td class="dq-celda/).slice(1);
      assert.equal(celdas.length, 3, riesgo);
      ['Bajo', 'Medio', 'Alto'].forEach((valor, j) => {
        const esperada = original.find((c) => c.riesgo === riesgo && c.valor === valor);
        if (riesgo === 'Medio' && valor === 'Medio') assert.equal(celdas[j], '"></td>');
        else assert.ok(celdas[j].includes(`>${esperada.texto}</span>`), `${riesgo} ${valor}`);
      });
    }
  });

  it('la prioridad de la tarjeta y la de la lista salen del mismo armado, también con una clave desconocida', () => {
    const lista = CON_DATASETS().propuestas_datasets.slice(0, 1);
    lista[0].prioridad = { clave: 'urgente', texto: 'Texto del servidor' };
    const etiqueta = ctx.htmlDeLaPrioridad(lista[0].prioridad);
    assert.equal(etiqueta, '<span class="dq-etiqueta">Texto del servidor</span>');
    assert.ok(ctx.htmlDeUnDatasetNuevo(lista[0], 0).includes(etiqueta));
    assert.ok(ctx.htmlDeLaListaDeNuevos(lista).includes(etiqueta));
    lista[0].prioridad = { clave: 'alta', texto: 'Alta' };
    const conClave = ctx.htmlDeLaPrioridad(lista[0].prioridad);
    assert.ok(conClave.includes('dq-prio-alta') && conClave.includes('<svg'));
    assert.ok(ctx.htmlDeUnDatasetNuevo(lista[0], 0).includes(conClave));
  });

  it('la lista de al lado: número, título, prioridad y eje, con su botón a la tarjeta; y cada tarjeta tiene su id', () => {
    const html = panelDe(ctx.htmlDelDetalle(CON_DATASETS()), 'datasets');
    const lista = html.match(/<ol class="dq-nuevos-indice"[\s\S]*?<\/ol>/)[0];
    const renglones = lista.split('<li>').slice(1);
    assert.equal(renglones.length, 3);
    renglones.forEach((r, i) => {
      assert.ok(r.includes(`data-ir-nuevo="${i}"`));
      assert.ok(r.includes(`aria-hidden="true">${i + 1}</span>`));
      assert.ok(html.includes(`<li class="dq-nuevo" id="dq-nuevo-${i}">`));
    });
    assert.ok(renglones[0].includes('Prioridad alta') && renglones[0].includes('Valor alto · Riesgo bajo') && renglones[0].includes('dq-prio-alta'));
    assert.ok(html.indexOf('<table') < html.indexOf('dq-nuevos-indice') && html.indexOf('dq-nuevos-indice') < html.indexOf('<ol class="dq-nuevos-lista">'));
  });

  it('sin matriz_de_prioridad no hay matriz, pero sí la lista y las tarjetas; con [] solo la línea', () => {
    const detalle = { ...CON_DATASETS(), matriz_de_prioridad: undefined };
    for (const matriz of [undefined, null, []]) {
      const html = ctx.htmlDelPanelDatasets({ ...detalle, matriz_de_prioridad: matriz });
      assert.ok(!html.includes('<table') && !html.includes('dq-marcador"'));
      assert.ok(html.includes('dq-nuevos-indice') && html.includes('id="dq-nuevo-2"'));
      assert.ok(html.includes('dq-matriz-sola'));
    }
    const vacia = ctx.htmlDelPanelDatasets(VACIA());
    assert.ok(vacia.includes('Esta quincena no hay propuestas de datasets.') && !vacia.includes('<table') && !vacia.includes('dq-nuevos-indice'));
    assert.equal(ctx.htmlDelPanelDatasets({ ...CON_DATASETS(), propuestas_datasets: null }), '');
  });

  it('la matriz: clave de zona desconocida sin clase, texto escapado, un dataset sin celda no aparece y no se calcula nada', () => {
    const detalle = CON_DATASETS();
    detalle.matriz_de_prioridad[0] = { valor: 'Bajo', riesgo: 'Alto', clave: '__proto__', texto: XSS, con_rotulo: true };
    detalle.matriz_de_prioridad[1].clave = 'constructor';
    detalle.propuestas_datasets[0].numero_texto = XSS;
    detalle.propuestas_datasets[0].titulo = XSS;
    detalle.propuestas_datasets[1].valor = 'Inventado';
    const html = ctx.htmlDelPanelDatasets(detalle);
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes(`<td class="dq-celda"><span class="dq-zona-rotulo">${XSS_ESCAPADO}</span></td>`));
    assert.ok(html.includes('<td class="dq-celda"><span class="visualmente-oculto">Evaluar riesgos</span></td>'));
    assert.ok(html.includes(`aria-label="${XSS_ESCAPADO}: ${XSS_ESCAPADO}"`));
    assert.equal(cuantas(html.match(/<table[\s\S]*?<\/table>/)[0], /class="dq-marcador"/g), 2);
  });

  it('irANuevoDq lleva a la tarjeta: foco al título sin desplazar y la página sube hasta ella (sin movimiento con la preferencia)', () => {
    const eventos = [];
    const titulo = falso({ focus: (o) => eventos.push(['foco', plano(o)]) });
    const tarjeta = falso({ querySelector: (s) => (s === '.dq-nuevo-titulo' ? titulo : null), scrollIntoView: (o) => eventos.push(['sube', plano(o)]) });
    const { c } = paginaFalsa({ admin: false, search: '?id=14', lugares: { 'dq-nuevo-2': tarjeta } });
    assert.equal(c.irANuevoDq({ dataset: { irNuevo: '2' } }), true);
    assert.deepEqual(eventos, [['foco', { preventScroll: true }], ['sube', { behavior: 'smooth', block: 'start' }]]);
    c.window.matchMedia = () => ({ matches: true });
    c.irANuevoDq({ dataset: { irNuevo: '2' } });
    assert.deepEqual(eventos.at(-1), ['sube', { behavior: 'instant', block: 'start' }]);
    assert.equal(c.irANuevoDq({ dataset: { irNuevo: '9' } }), false);
    // Un clic en un marcador o en un renglón (delegado) llega ahí
    eventos.length = 0;
    c.alTocarDq({ target: { closest: (s) => (s === 'button[data-ir-nuevo]' ? { dataset: { irNuevo: '2' } } : null) } });
    assert.equal(eventos.length, 2);
  });

  it('la tarjeta: cabeza con el número grande (el del marcador), título, prioridad, «Por qué abrirlo» de entrada, ficha y enlaces; todo escapado', () => {
    const lista = CON_DATASETS().propuestas_datasets;
    lista[1].numero = 7;
    lista[1].titulo = XSS;
    const t = ctx.htmlDeLosDatasetsNuevos(lista).split(/<li class="dq-nuevo" id="dq-nuevo-\d+">/)[2];
    const orden = ['dq-nuevo-cabeza', 'dq-marcador-grande" aria-hidden="true">7<', 'dq-orden', '<h4 class="dq-nuevo-titulo" tabindex="-1">', 'dq-cuad', 'dq-nuevo-porque',
      'dq-nuevo-ficha', 'Formato sugerido', 'Campos sugeridos', 'dq-anonimizar', 'dq-nuevo-enlaces', 'Fuentes'].map((x) => t.indexOf(x));
    assert.ok(orden.every((n) => n >= 0), String(orden));
    assert.deepEqual(orden, [...orden].sort((a, b) => a - b));
    assert.ok(t.includes(`<h4 class="dq-nuevo-titulo" tabindex="-1">${XSS_ESCAPADO}</h4>`) && !t.includes('<img'));
    assert.ok(t.includes('<h5 class="visualmente-oculto">Por qué abrirlo</h5>'));
  });

  it('el <style>: la matriz y la lista pasan a una columna a 1100 px y la tarjeta tiene cabeza verde, título grande, ficha y enlaces', () => {
    const estilo = leer('dato-quincena.html').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    assert.match(estilo, /@media \(max-width: 1100px\) \{[^@]*\.dq-matriz-caja \{ grid-template-columns: minmax\(0, 1fr\); \}/);
    assert.match(estilo, /\.dq-nuevo-cabeza \{[^}]*46px[^}]*var\(--sg-verde-claro\)/);
    assert.match(estilo, /\.dq-nuevo-titulo \{[^}]*clamp\(1\.2rem, 1rem \+ 0\.6vw, 1\.45rem\)/);
    assert.match(estilo, /\.dq-nuevo-enlaces \{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(estilo, /\.dq-marcador-grande \{[^}]*46px/);
  });

  it('el <style> de la matriz: zonas, «No se propone» rayada, marcadores, la lista y sin scroll horizontal', () => {
    const estilo = leer('dato-quincena.html').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    for (const clase of ['dq-matriz', 'dq-celda', 'dq-zona-alta', 'dq-zona-si_hay_recursos', 'dq-zona-evaluar', 'dq-zona-no', 'dq-zona-rotulo', 'dq-marcador',
      'dq-marcadores', 'dq-matriz-caja', 'dq-nuevos-indice', 'dq-nuevos-item']) assert.ok(estilo.includes(`.${clase}`), clase);
    assert.match(estilo, /\.dq-zona-no \{[^}]*repeating-linear-gradient[^}]*\}/);
    assert.match(estilo, /\.dq-zona-no \{[^}]*var\(--sg-rojo\)/);
    assert.match(estilo, /\.dq-zona-alta \{[^}]*var\(--sg-verde-fondo\)[^}]*var\(--sg-verde\)/);
    assert.match(estilo, /\.dq-zona-evaluar \{[^}]*var\(--sg-sol\)[^}]*var\(--sg-ambar\)/);
    assert.match(estilo, /\.dq-nuevo-titulo:focus:not\(:focus-visible\) \{ outline: none; box-shadow: none; \}/);
    assert.doesNotMatch(estilo, /(?<![A-Za-z0-9_-])\.ad-/);
  });

  it('el <style>: tarjeta, texto con saltos, nada se desborda y los colores de la prioridad', () => {
    const estilo = leer('dato-quincena.html').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    for (const clase of ['dq-nuevos', 'dq-nuevos-lista', 'dq-nuevo', 'dq-nuevo-titulo', 'dq-cuad', 'dq-cuad-eje', 'dq-formato', 'dq-campos-min',
      'dq-anonimizar', 'dq-nuevos-vacia', 'dq-prio-alta', 'dq-prio-si_hay_recursos', 'dq-prio-evaluar']) assert.ok(estilo.includes(`.${clase}`), clase);
    assert.match(estilo, /\.dq-nuevo \{[^}]*overflow-wrap: anywhere;/);
    assert.match(estilo, /\.dq-nuevos \{[^}]*background: #EEF6F1;/);
    assert.match(estilo, /\.dq-prio-alta \{[^}]*var\(--sg-verde-fondo\)[^}]*var\(--sg-verde\)/);
    assert.match(estilo, /\.dq-prio-si_hay_recursos \{[^}]*var\(--sg-azul-fondo\)[^}]*var\(--sg-azul\)/);
    assert.match(estilo, /\.dq-prio-evaluar \{[^}]*var\(--sg-sol\)[^}]*var\(--sg-ambar\)/);
    assert.doesNotMatch(estilo, /(?<![A-Za-z0-9_-])\.ad-/);
  });
});

// spec 2026-11-21-dato-quincena-principal-equipo, 4, y spec 2026-11-23-dato-quincena-principal-votacion, 4: en una edición de antes (sin
// votación) la franja muestra lo que se eligió a mano, sin botones para nadie; las marcas, las pastillas y la que se abre en Propuestas; la
// tarjeta de la lista; y la agenda con tantas columnas como grupos
describe('dato-quincena.js: la principal del equipo en una edición de antes (spec 2026-11-23-dato-quincena-principal-votacion, 4)', () => {
  const SIN = () => DETALLE();
  const COINCIDE = () => respuesta('detalle_equipo_coincide').data;
  const OTRA = () => respuesta('detalle_equipo_otra').data;
  // El título con HTML de la Review Focus 5
  const XSS_ALERTA = '<img src=x onerror=alert(1)>';
  const XSS_ALERTA_ESCAPADO = '&lt;img src=x onerror=alert(1)&gt;';
  const ICONO = '<svg aria-hidden="true"[^>]*>[\\s\\S]*?</svg>';
  const literal = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // La franja de General ('' si no está) y sus botones y enlaces, como [etiqueta, atributos, texto]
  const franjaDe = (html) => html.match(/<section class="dq-franja[\s\S]*?<\/section>/)?.[0] ?? '';
  const franja = (detalle, admin) => franjaDe(panelDe(ctx.htmlDelDetalle(detalle, { admin }), 'general'));
  const accionesDe = (html) => [...html.matchAll(/<(button|a) ([^>]*)>([^<]*)<\/\1>/g)].map(([, etiqueta, atributos, texto]) => [etiqueta, atributos, texto]);
  const ROTULO = `<span class="dq-franja-rotulo">${ICONO}<b>Principal del equipo:</b></span>`;
  const QUIEN = '<p class="dq-franja-quien">La eligió Persona Inventada el 23/11/2026 a las 10:12.</p>';
  const VER = (orden) => ['a', `class="dq-btn dq-btn-borde dq-btn-chico" href="dato-quincena.html?id=12&amp;vista=propuestas&amp;propuesta=${orden}" data-ver-principal="${orden}"`,
    'Ver la propuesta'];

  it('sin elegir: «Principal del equipo:» en negrita y «todavía no la eligió.», sin botones para nadie (tampoco para administración)', () => {
    for (const admin of [false, true]) {
      const html = franja(SIN(), admin);
      assert.match(html, new RegExp('^<section class="dq-franja dq-franja-sin" aria-labelledby="dq-franja-titulo"><div class="dq-franja-texto">'
        + `<h3 class="dq-franja-titulo" id="dq-franja-titulo">${ROTULO} todavía no la eligió\\.</h3></div></section>$`), String(admin));
      assert.deepEqual(accionesDe(html), [], String(admin));
    }
  });

  it('con la misma de Datito: su resumen, quién y cuándo y «Ver la propuesta» (la 1), igual para todos', () => {
    const html = franja(COINCIDE(), true);
    assert.match(html, new RegExp('^<section class="dq-franja dq-franja-elegida" aria-labelledby="dq-franja-titulo"><div class="dq-franja-texto">'
      + `<h3 class="dq-franja-titulo" id="dq-franja-titulo">${ROTULO} ${literal('la misma de Datito (propuesta 1).')}</h3>${literal(QUIEN)}</div>`));
    assert.ok(!html.includes('dq-franja-cifra'), 'sin cifra');
    assert.deepEqual(accionesDe(html), [VER(1)]);
    assert.equal(franja(COINCIDE(), false), html);
  });

  it('con otra: «Propuesta 2 · título», la cifra en chico, quién y cuándo y «Ver la propuesta» (la 2), igual para todos', () => {
    const html = franja(OTRA(), true);
    assert.match(html, new RegExp(`${ROTULO} ${literal('Propuesta 2 · Otro título inventado')}</h3>`
      + `<p class="dq-franja-cifra">${literal('56 casos · septiembre de 2026')}</p>${literal(QUIEN)}</div>`));
    assert.deepEqual(accionesDe(html), [VER(2)]);
    assert.equal(franja(OTRA(), false), html);
  });

  it('la franja va solo en General, arriba de la portada; sin principal_equipo (un servidor de antes) o sin propuestas, no va', () => {
    const html = ctx.htmlDelDetalle(OTRA(), { admin: true, vista: 'propuestas' });
    assert.equal(cuantas(html, /<section class="dq-franja/g), 1);
    assert.ok(panelDe(html, 'general').startsWith('<div class="dq-ed-panel" role="tabpanel" id="dq-panel-general" aria-labelledby="dq-tab-general" '
      + 'tabindex="0" hidden><section class="dq-franja dq-franja-elegida"'));
    const { principal_equipo: _pe, ...sinEquipo } = OTRA();
    assert.ok(!ctx.htmlDelDetalle(sinEquipo, { admin: true }).includes('dq-franja'));
    for (const raro of [null, 'x', 3, []]) {
      assert.ok(!ctx.htmlDelDetalle({ ...OTRA(), principal_equipo: raro }, { admin: true }).includes('dq-franja'), JSON.stringify(raro));
    }
    assert.ok(!ctx.htmlDelDetalle({ ...OTRA(), propuestas: [] }, { admin: true }).includes('dq-franja'));
    // Un orden que la edición no tiene (no llega: la FK lo impide) se toma como sin elegir: sin «Ver la propuesta»
    const fuera = franja({ ...OTRA(), principal_equipo: { ...OTRA().principal_equipo, orden: 9 } }, true);
    assert.ok(!fuera.includes('data-ver-principal') && fuera.startsWith('<section class="dq-franja dq-franja-sin"'));
    // Una votación que no es un objeto, o con un estado que no se conoce, es la franja de antes
    for (const votacion of [null, 'abierta', [], { estado: 'otra' }]) assert.equal(franja({ ...OTRA(), votacion }, true), franja(OTRA(), true), JSON.stringify(votacion));
  });

  it('el índice: la marca de Datito («Datito») y la del equipo («Equipo»), cada una con su ícono y lo que se lee; las dos en la misma si coinciden', () => {
    const marcas = (detalle) => indiceDe(ctx.htmlDelPanelPropuestas(detalle)).map((i) => i.marcas.filter((m) => !m.startsWith('dq-im-validar')));
    const DATITO = 'dq-im-principal: Datito (Principal de Datito)';
    const EQUIPO = 'dq-im-equipo: Equipo (Principal del equipo)';
    assert.deepEqual(marcas(SIN()), [[DATITO], []]);
    assert.deepEqual(marcas(COINCIDE()), [[EQUIPO, DATITO], []]);
    assert.deepEqual(marcas(OTRA()), [[DATITO], [EQUIPO]]);
    // Cada una con su ícono, distinto del de la otra: el color no es lo único que las distingue
    const iconos = [...ctx.htmlDelPanelPropuestas(COINCIDE()).matchAll(/<span class="dq-im (dq-im-principal|dq-im-equipo)">(<svg[\s\S]*?<\/svg>)/g)].map((m) => m[2]);
    assert.equal(iconos.length, 2);
    assert.notEqual(iconos[0], iconos[1]);
    // Sin principal_datito (un servidor de antes), la marca de antes en la marcada
    const { principal_datito: _pd, principal_equipo: _pe, ...deAntes } = SIN();
    assert.deepEqual(marcas(deAntes), [['dq-im-principal: Principal (Principal)'], []]);
  });

  it('la propuesta que se ve: las pastillas de las dos principales, sin botones para nadie (la elección a mano ya no existe)', () => {
    const arriba = (detalle, propuesta, admin) => articuloDe(ctx.htmlDelDetalle(detalle, { admin, vista: 'propuestas', propuesta }))
      .match(/<div class="dq-prop-arriba">[\s\S]*?<\/div>/)?.[0] ?? '';
    const EQUIPO = `<span class="dq-etiqueta dq-et-equipo">${ICONO}Principal del equipo</span>`;
    for (const admin of [true, false]) {
      // Otra (la 2): la 2 con su pastilla; la 1, la de Datito, con la suya
      assert.match(arriba(OTRA(), 2, admin), new RegExp(`^<div class="dq-prop-arriba"><span class="dq-orden">Propuesta 2</span>${EQUIPO}`
        + '<span class="dq-etiqueta dq-et-agenda">Agenda</span></div>$'));
      assert.match(arriba(OTRA(), 1, admin), new RegExp(`^<div class="dq-prop-arriba"><span class="dq-orden">Propuesta 1</span>${PASTILLA_DE_DATITO.source}`
        + `<span class="dq-etiqueta dq-et-validar">${ICONO}Validar</span></div>$`));
      // Coincide: la 1 con las dos pastillas
      assert.match(arriba(COINCIDE(), 1, admin), new RegExp(`^<div class="dq-prop-arriba"><span class="dq-orden">Propuesta 1</span>${EQUIPO}${PASTILLA_DE_DATITO.source}`));
      for (const [detalle, propuesta] of [[SIN(), 1], [SIN(), 2], [OTRA(), 1], [OTRA(), 2], [COINCIDE(), 1], [COINCIDE(), 2]]) {
        const html = arriba(detalle, propuesta, admin);
        assert.ok(!html.includes('<button') && !html.includes('dq-es-del-equipo') && !html.includes('dq-et-tuyo'), html);
      }
    }
    // Sin principal_equipo (un servidor de antes), sin la pastilla del equipo
    const { principal_equipo: _pe, ...sinEquipo } = OTRA();
    assert.ok(!arriba(sinEquipo, 2, true).includes('dq-et-equipo'));
  });

  it('sin &propuesta=, Propuestas abre la del equipo; si no eligió, la de Datito; &propuesta= manda', () => {
    const vista = (detalle, propuesta = null) => panelDe(ctx.htmlDelDetalle(detalle, { vista: 'propuestas', propuesta }), 'propuestas');
    assert.deepEqual([actualDe(vista(OTRA())), tituloDe(vista(OTRA()))], [['2'], 'Otro título inventado']);
    assert.deepEqual(actualDe(vista(COINCIDE())), ['1']);
    assert.deepEqual(actualDe(vista(SIN())), ['1']);
    assert.deepEqual(actualDe(vista(OTRA(), 1)), ['1']);
    assert.deepEqual(actualDe(vista(OTRA(), 9)), ['2'], 'una que no existe: la del equipo');
    assert.equal(ctx.posicionDeLaPropuesta(OTRA(), null), 1);
    assert.equal(ctx.posicionDeLaPropuesta(OTRA(), 1), 0);
  });

  it('la tarjeta de la lista: el rótulo de la principal que cuenta, con su ícono, arriba del título', () => {
    const [regular] = LISTA().ediciones;
    assert.match(ctx.htmlDeTarjeta(regular), new RegExp('<p class="dq-cuantas-prop">3 propuestas</p>'
      + `<p class="dq-tarjeta-rotulo">${ICONO}Principal de Datito</p><p class="dq-principal-diario">Un título inventado</p>`));
    const delEquipo = ctx.htmlDeTarjeta({ ...regular, principal: { ...regular.principal, titulo: 'Otro', rotulo: 'Principal del equipo' } });
    assert.match(delEquipo, /Principal del equipo<\/p><p class="dq-principal-diario">Otro<\/p>/);
    // Sin rótulo (un servidor de antes), solo el título
    for (const rotulo of [undefined, null, '', 3]) {
      assert.ok(!ctx.htmlDeTarjeta({ ...regular, principal: { ...regular.principal, rotulo } }).includes('dq-tarjeta-rotulo'), String(rotulo));
    }
    // Sigue siendo un solo enlace
    assert.equal(cuantas(ctx.htmlDeTarjeta(regular), /<a /g), 1);
  });

  it('un título con HTML sale escapado en la franja, las marcas, las pastillas y la tarjeta', () => {
    const detalle = OTRA();
    detalle.propuestas = detalle.propuestas.map((p) => ({ ...p, titulo: XSS_ALERTA, orden_texto: XSS_ALERTA }));
    detalle.principal_equipo = { ...detalle.principal_equipo, resumen: `Propuesta 2 · ${XSS_ALERTA}`, cifra_clave: XSS_ALERTA, quien: XSS_ALERTA,
      rotulo: XSS_ALERTA, marca: XSS_ALERTA, pastilla: XSS_ALERTA };
    detalle.principal_datito = { ...detalle.principal_datito, rotulo: XSS_ALERTA, marca: XSS_ALERTA, pastilla: XSS_ALERTA, infografia_pie: XSS_ALERTA,
      infografia_alt: XSS_ALERTA };
    for (const vista of ['general', 'propuestas']) {
      for (const propuesta of [1, 2]) assert.ok(!ctx.htmlDelDetalle(detalle, { admin: true, vista, propuesta }).includes('<img'), `${vista} ${propuesta}`);
    }
    assert.ok(franja(detalle, true).includes(`<b>${XSS_ALERTA_ESCAPADO}:</b></span> Propuesta 2 · ${XSS_ALERTA_ESCAPADO}</h3>`
      + `<p class="dq-franja-cifra">${XSS_ALERTA_ESCAPADO}</p><p class="dq-franja-quien">${XSS_ALERTA_ESCAPADO}</p>`));
    assert.deepEqual(indiceDe(ctx.htmlDelPanelPropuestas(detalle)).map((i) => i.marcas.filter((m) => !m.startsWith('dq-im-validar'))),
      [[`dq-im-principal: ${XSS_ALERTA_ESCAPADO} (${XSS_ALERTA_ESCAPADO})`], [`dq-im-equipo: ${XSS_ALERTA_ESCAPADO} (${XSS_ALERTA_ESCAPADO})`]]);
    const articulo = (propuesta) => articuloDe(ctx.htmlDelDetalle(detalle, { admin: true, vista: 'propuestas', propuesta }));
    assert.match(articulo(2), new RegExp(`<span class="dq-etiqueta dq-et-equipo">${ICONO}${literal(XSS_ALERTA_ESCAPADO)}</span>`));
    assert.match(articulo(1), new RegExp(`<span class="dq-etiqueta dq-et-principal">${ICONO}${literal(XSS_ALERTA_ESCAPADO)}</span>`));
    const tarjeta = ctx.htmlDeTarjeta({ ...LISTA().ediciones[0], principal: { titulo: XSS_ALERTA, cifra_clave: XSS_ALERTA, rotulo: XSS_ALERTA } });
    assert.ok(!tarjeta.includes('<img'), tarjeta);
    assert.ok(tarjeta.includes(`${XSS_ALERTA_ESCAPADO}</p><p class="dq-principal-diario">${XSS_ALERTA_ESCAPADO}</p>`));
    // El texto alternativo y el pie de la infografía
    const general = panelDe(ctx.htmlDelDetalle(detalle), 'general');
    assert.ok(general.includes(`data-alt="${XSS_ALERTA_ESCAPADO}"></div><figcaption class="dq-infografia-pie">${XSS_ALERTA_ESCAPADO}</figcaption>`));
  });

  it('el <style>: la agenda con tantas columnas como grupos arriba de 820 px y una sola debajo', () => {
    const estilo = leer('dato-quincena.html').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    assert.match(estilo, /\.dq-agenda-cols \{ display: grid; grid-auto-flow: column; grid-auto-columns: minmax\(0, 1fr\);/);
    assert.doesNotMatch(estilo, /\.dq-agenda-cols \{[^}]*repeat\(3/);
    const angosta = estilo.match(/@media \(max-width: 820px\) \{([\s\S]*?)\n {8}\}/)?.[1] ?? '';
    assert.match(angosta, /\.dq-agenda-cols \{ grid-auto-flow: row; grid-template-columns: minmax\(0, 1fr\);/);
  });

  it('el <style>: la franja, las marcas, las pastillas y la tarjeta; lo de la elección a mano ya no está', () => {
    const estilo = leer('dato-quincena.html').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    for (const clase of ['dq-franja', 'dq-franja-sin', 'dq-franja-texto', 'dq-franja-titulo', 'dq-franja-rotulo', 'dq-franja-cifra', 'dq-franja-quien',
      'dq-franja-acciones', 'dq-im-equipo', 'dq-et-equipo', 'dq-tarjeta-rotulo', 'dq-dialogo-texto']) assert.ok(estilo.includes(`.${clase}`), clase);
    // La del equipo, blanca con un borde de tinta; la de Datito, en tinta: además del ícono y el texto
    assert.match(estilo, /\.dq-im-equipo, \.dq-et-equipo \{ background: #fff; color: var\(--sg-tinta\); box-shadow: inset 0 0 0 1\.5px var\(--sg-tinta\); \}/);
    // Lo largo no ensancha la franja; en el teléfono, en una columna, con los botones debajo
    assert.match(estilo, /\.dq-franja-titulo \{[^}]*overflow-wrap: anywhere;/);
    const telefono = estilo.match(/@media \(max-width: 640px\) \{([\s\S]*?)\n {8}\}/)?.[1] ?? '';
    assert.match(telefono, /\.dq-franja \{ grid-template-columns: minmax\(0, 1fr\);/);
    assert.doesNotMatch(estilo, /Datito/);
    for (const clase of ['dq-elegir-esta', 'dq-es-del-equipo', 'dq-opcion-aclara']) assert.ok(!estilo.includes(`.${clase}`), clase);
  });
});

// spec 2026-11-23-dato-quincena-principal-votacion, 4: la principal del equipo se vota. La franja abierta y cerrada, los votos, el diálogo
// «Tu orden» (la forma B de la maqueta, «Tocar en orden»), Propuestas, la tarjeta de la lista; los textos, todos del servidor
describe('dato-quincena.js: la votación de la principal del equipo (spec 2026-11-23-dato-quincena-principal-votacion, 4)', () => {
  const ABIERTA = () => respuesta('detalle_votacion_abierta').data;
  const CON_VOTO = () => respuesta('detalle_votacion_abierta_con_voto').data;
  const PUNTOS = () => respuesta('detalle_votacion_cerrada_puntos').data;
  const DESEMPATE = () => respuesta('detalle_votacion_cerrada_desempate').data;
  const NADIE = () => respuesta('detalle_votacion_cerrada_nadie').data;
  const conVotacion = (detalle, cambios) => ({ ...detalle, votacion: { ...detalle.votacion, ...cambios } });
  // Quien mira no está en la foto de la edición (spec 3): no puede votar, no le falta su voto y no tiene orden
  const FUERA = () => conVotacion(ABIERTA(), { puede_votar: false, falta_tu_voto: false, tu_orden: null, dialogo: null });
  // Sin calendario (spec 2): abierta, «se está votando.», el cierre no se sabe y nadie puede votar
  const SIN_CALENDARIO = () => {
    const detalle = conVotacion(ABIERTA(), { resumen: 'se está votando.', cierre: 'No se pudo leer el calendario: el cierre se confirma en unos minutos.',
      puede_votar: false, falta_tu_voto: false, dialogo: null });
    return { ...detalle, principal_equipo: { ...detalle.principal_equipo, resumen: 'se está votando.' } };
  };
  // Cuatro propuestas (la 3 y la 4, inventadas) y una sola (Review Focus 3)
  const CUATRO = () => {
    const detalle = ABIERTA();
    const segunda = detalle.propuestas[1];
    detalle.propuestas = [...detalle.propuestas, ...[3, 4].map((orden) => ({ ...segunda, orden, orden_texto: `Propuesta ${orden}`, titulo: `Título inventado ${orden}` }))];
    return detalle;
  };
  const UNA = () => {
    const detalle = ABIERTA();
    detalle.propuestas = detalle.propuestas.slice(0, 1);
    return detalle;
  };
  const I = { equipo: constante('ICONO_EQUIPO'), aviso: constante('ICONO_AVISO'), check: constante('ICONO_CHECK'), reloj: constante('ICONO_RELOJ'),
    datito: constante('ICONO_DATITO') };
  const franjaDe = (html) => html.match(/<section class="dq-franja[\s\S]*?<\/section>/)?.[0] ?? '';
  const franja = (detalle, admin = false) => franjaDe(panelDe(ctx.htmlDelDetalle(detalle, { admin }), 'general'));
  const ROTULO = `<span class="dq-franja-rotulo">${I.equipo}<b>Principal del equipo:</b></span>`;
  const VOTAR = '<button type="button" class="dq-btn dq-btn-tinta dq-btn-chico" data-votar aria-haspopup="dialog">Votar</button>';
  const CAMBIAR = '<button type="button" class="dq-btn dq-btn-tinta dq-btn-chico" data-votar aria-haspopup="dialog">Cambiar mi orden</button>';
  const FALTA = `<span class="dq-envio dq-envio-espera dq-falta-tu-voto">${I.aviso}Falta tu voto</span>`;
  const NO_ESTAS = '<p class="dq-franja-quien">Votan las personas de la lista que arma administración.</p>';
  // La marca de la de Datito en los votos y en el diálogo: lo que se ve y lo que se lee
  const MARCA = `<span class="dq-im dq-im-principal dq-im-chica">${I.datito}<span aria-hidden="true">Datito</span><span class="visualmente-oculto">(la de Datito)</span></span>`;
  const abiertaArriba = (resumen) => '<section class="dq-franja dq-franja-sin dq-franja-abierta" aria-labelledby="dq-franja-titulo"><div class="dq-franja-texto">'
    + `<h3 class="dq-franja-titulo" id="dq-franja-titulo">${ROTULO} ${resumen}</h3>`;
  const cerradaArriba = (resumen) => '<section class="dq-franja dq-franja-elegida dq-franja-cerrada" aria-labelledby="dq-franja-titulo"><div class="dq-franja-texto">'
    + `<h3 class="dq-franja-titulo" id="dq-franja-titulo">${ROTULO} ${resumen}</h3>`;
  const verLaPropuesta = (orden) => `<div class="dq-franja-acciones"><a class="dq-btn dq-btn-borde dq-btn-chico" href="dato-quincena.html?id=12&amp;vista=propuestas&amp;propuesta=${orden}" `
    + `data-ver-principal="${orden}">Ver la propuesta</a></div></section>`;

  it('los textos de la página', () => {
    assert.deepEqual(constante('TEXTOS_DEL_VOTO'), {
      votar: 'Votar', cambiar: 'Cambiar mi orden', guardar: 'Guardar mi orden', deNuevo: 'Empezar de nuevo', faltaTuVoto: 'Falta tu voto',
      noEstas: 'Votan las personas de la lista que arma administración.', verLosVotos: 'Ver los votos', gano: 'Ganó', tuOrden: 'Tu orden',
      primero: 'Tocá primero la que más querés trabajar.', error: 'No se pudo guardar tu orden. Probá de nuevo en unos minutos.'
    });
    assert.ok(vm.runInContext('Object.isFrozen(TEXTOS_DEL_VOTO)', ctx));
    // La elección a mano ya no está: ni sus textos, ni su diálogo, ni su ruta (que ahora contesta siempre 409)
    const script = leer('js/dato-quincena.js');
    for (const resto of ['TEXTOS_DE_LA_PRINCIPAL', 'htmlDelDialogoDeLaPrincipal', 'abrirLaPrincipalDq', 'cerrarLaPrincipalDq', 'confirmarLaPrincipalDq',
      'conectarLaPrincipalDq', 'guardarLaPrincipalDq', 'actualizarGuardarLaPrincipalDq', 'FOCO_DESPUES_DE_ELEGIR', 'guardandoPrincipal',
      'data-guardar-principal', 'data-elegir-principal', '/principal-equipo', 'dq-principal-guardar']) assert.ok(!script.includes(resto), resto);
  });

  it('abierta, sin su voto: el resumen, la participación, «Falta tu voto» (sol, con el triángulo) y «Votar», igual para cualquier rol', () => {
    const html = franja(ABIERTA());
    assert.equal(html, abiertaArriba('se vota hasta el martes 03/11 a las 12:00.')
      + '<p class="dq-franja-quien">Ya votó 1 de 3: Persona Dos. Faltan los votos de Persona Uno y Persona Tres.</p></div>'
      + `<div class="dq-franja-acciones">${FALTA}${VOTAR}</div></section>`);
    assert.equal(franja(ABIERTA(), true), html, 'votar no depende del rol: depende de estar en la foto');
  });

  it('abierta, con su voto: «Tu orden» en una lista corta y «Cambiar mi orden», sin «Falta tu voto»', () => {
    assert.equal(franja(CON_VOTO()), abiertaArriba('se vota hasta el martes 03/11 a las 12:00.')
      + '<p class="dq-franja-quien">Ya votaron 2 de 3: Persona Uno y Persona Dos. Falta el voto de Persona Tres.</p>'
      + '<div class="dq-tu-orden"><p class="dq-tu-orden-titulo" id="dq-tu-orden-titulo">Tu orden</p><ol aria-labelledby="dq-tu-orden-titulo">'
      + '<li><b>1.º</b> Propuesta 2 · Otro título inventado</li><li><b>2.º</b> Propuesta 1 · Un título inventado</li></ol></div></div>'
      + `<div class="dq-franja-acciones">${CAMBIAR}</div></section>`);
  });

  it('abierta, fuera de la foto o sin calendario: la participación y quiénes votan, sin botón ni pastilla', () => {
    assert.equal(franja(FUERA(), true), abiertaArriba('se vota hasta el martes 03/11 a las 12:00.')
      + `<p class="dq-franja-quien">Ya votó 1 de 3: Persona Dos. Faltan los votos de Persona Uno y Persona Tres.</p>${NO_ESTAS}</div></section>`);
    assert.equal(franja(SIN_CALENDARIO()), abiertaArriba('se está votando.')
      + `<p class="dq-franja-quien">Ya votó 1 de 3: Persona Dos. Faltan los votos de Persona Uno y Persona Tres.</p>${NO_ESTAS}</div></section>`);
    // Solo el true literal deja votar y muestra la pastilla
    for (const raro of ['true', 1, null]) {
      const html = franja(conVotacion(ABIERTA(), { puede_votar: raro, falta_tu_voto: raro }));
      assert.ok(!html.includes('data-votar') && !html.includes('dq-falta-tu-voto') && html.includes(NO_ESTAS), String(raro));
    }
  });

  it('cerrada por puntos: la ganadora con su cifra, cómo ganó en negrita, la participación con el cierre, «Ver los votos» plegado y «Ver la propuesta»', () => {
    const { resultado } = PUNTOS().votacion;
    assert.equal(franja(PUNTOS()), cerradaArriba('Propuesta 2 · Otro título inventado')
      + '<p class="dq-franja-cifra">56 casos · septiembre de 2026</p>'
      + '<p class="dq-resultado">Ganó por puntos: 5, contra 4 de la que siguió.</p>'
      + '<p class="dq-franja-quien">Votaron 3 de 3. La votación cerró el martes 03/11/2026 a las 12:00.</p>'
      + `<details class="dq-votos"><summary>Ver los votos</summary><p class="dq-votos-regla">${resultado.regla}</p>${ctx.htmlDeLosVotos(resultado)}</details></div>`
      + verLaPropuesta(2));
    assert.equal(franja(PUNTOS(), true), franja(PUNTOS()));
  });

  it('cerrada por desempate y sin votos: la de Datito; sin votos, sin «Ver los votos»', () => {
    const { resultado } = DESEMPATE().votacion;
    assert.equal(franja(DESEMPATE()), cerradaArriba('la misma de Datito (propuesta 1).')
      + '<p class="dq-resultado">Ganó por desempate: empató con la 2, con 3 puntos, y es la de Datito.</p>'
      + '<p class="dq-franja-quien">Votaron 2 de 3: no votó Persona Tres. La votación cerró el martes 03/11/2026 a las 12:00.</p>'
      + `<details class="dq-votos"><summary>Ver los votos</summary><p class="dq-votos-regla">${resultado.regla}</p>${ctx.htmlDeLosVotos(resultado)}</details></div>`
      + verLaPropuesta(1));
    assert.equal(franja(NADIE()), cerradaArriba('la misma de Datito (propuesta 1).')
      + '<p class="dq-resultado">Nadie votó: quedó la de Datito.</p>'
      + '<p class="dq-franja-quien">No votó nadie de 3. La votación cerró el martes 03/11/2026 a las 12:00.</p></div>'
      + verLaPropuesta(1));
  });

  it('htmlDeLosVotos: Propuesta, una columna por quien votó y Puntos; cada propuesta, encabezado de su fila; la ganadora con fondo y «Ganó» con el tilde', () => {
    assert.equal(ctx.htmlDeLosVotos(PUNTOS().votacion.resultado), '<div class="dq-tabla-caja"><table class="dq-tabla dq-tabla-votos">'
      + '<caption class="visualmente-oculto">El puesto que le dio cada persona a cada propuesta y sus puntos</caption>'
      + '<thead><tr><th scope="col">Propuesta</th><th scope="col">Persona Uno</th><th scope="col">Persona Dos</th><th scope="col">Persona Tres</th>'
      + '<th scope="col" class="dq-col-puntos">Puntos</th></tr></thead><tbody>'
      + '<tr class="dq-gana"><th scope="row">Propuesta 2 · Otro título inventado</th><td>1.º</td><td>1.º</td><td>2.º</td>'
      + `<td class="dq-col-puntos"><b>5</b> <span class="dq-gano">${I.check}Ganó</span></td></tr>`
      + `<tr><th scope="row">Propuesta 1 · Un título inventado ${MARCA}</th><td>2.º</td><td>2.º</td><td>1.º</td><td class="dq-col-puntos"><b>4</b></td></tr>`
      + '</tbody></table></div>');
    // La de Datito, ganadora: el fondo, «Ganó» y su marca
    const desempate = ctx.htmlDeLosVotos(DESEMPATE().votacion.resultado);
    assert.ok(desempate.includes(`<tr class="dq-gana"><th scope="row">Propuesta 1 · Un título inventado ${MARCA}</th><td>2.º</td><td>1.º</td>`
      + `<td class="dq-col-puntos"><b>3</b> <span class="dq-gano">${I.check}Ganó</span></td></tr>`));
    // Un número va con String (Utils.escapeHtml(0) da ''); sin tabla (nadie votó) o sin resultado, nada
    const conCero = { tabla: { votantes: ['Persona Uno'], filas: [{ orden: 1, texto: 'x', de_datito: false, puestos: ['1.º'], puntos: 0, gana: false }] } };
    assert.ok(ctx.htmlDeLosVotos(conCero).includes('<td class="dq-col-puntos"><b>0</b></td>'));
    for (const raro of [NADIE().votacion.resultado, null, undefined, { tabla: 'x' }]) assert.equal(ctx.htmlDeLosVotos(raro), '', JSON.stringify(raro));
  });

  it('todo texto de la votación va escapado (un título con <b> sale como texto); no queda nada de la elección a mano', () => {
    const NEGRITA = '<b>Negrita</b>';
    for (const fabrica of [ABIERTA, CON_VOTO, PUNTOS, DESEMPATE, NADIE, FUERA]) {
      const detalle = fabrica();
      detalle.propuestas = detalle.propuestas.map((p) => ({ ...p, titulo: NEGRITA, orden_texto: NEGRITA }));
      detalle.principal_equipo = conTextos(detalle.principal_equipo, NEGRITA);
      detalle.votacion = { ...conTextos(detalle.votacion, NEGRITA), estado: detalle.votacion.estado };
      for (const vista of ['general', 'propuestas']) {
        const html = ctx.htmlDelDetalle(detalle, { admin: true, vista });
        assert.ok(!html.includes(NEGRITA), `${fabrica.name} ${vista}`);
        assert.ok(html.includes('&lt;b&gt;Negrita&lt;/b&gt;'), `${fabrica.name} ${vista}`);
      }
      assert.ok(!ctx.htmlDelDialogoDelVoto(detalle, [1]).includes(NEGRITA));
    }
    for (const nombre of ['detalle', 'detalle_equipo_coincide', 'detalle_equipo_otra', 'detalle_votacion_abierta', 'detalle_votacion_abierta_con_voto',
      'detalle_votacion_cerrada_puntos', 'detalle_votacion_cerrada_desempate', 'detalle_votacion_cerrada_nadie']) {
      for (const admin of [true, false]) {
        for (const vista of ['general', 'propuestas']) {
          const html = ctx.htmlDelDetalle(respuesta(nombre).data, { admin, vista });
          for (const resto of ['Validar la de Datito', 'Elegir otra', '>Cambiar<', 'Elegir como principal del equipo', 'Es la principal del equipo']) {
            assert.ok(!html.includes(resto), `${nombre} ${vista} ${resto}`);
          }
        }
      }
    }
  });

  it('Propuestas: con puede_votar, «Votar» o, con su voto, «Tu N.º» y «Cambiar mi orden» en la cabecera; cerrada o sin poder votar, nada', () => {
    const arriba = (detalle, propuesta, admin = false) => articuloDe(ctx.htmlDelDetalle(detalle, { admin, vista: 'propuestas', propuesta }))
      .match(/<div class="dq-prop-arriba">[\s\S]*?<\/div>/)?.[0] ?? '';
    const boton = (texto) => `<button type="button" class="dq-btn dq-btn-borde dq-btn-chico dq-votar-esta" data-votar aria-haspopup="dialog">${texto}</button>`;
    assert.ok(arriba(ABIERTA(), 1).endsWith(`<span class="dq-etiqueta dq-et-validar">${constante('ICONO_VALIDAR')}Validar</span>${boton('Votar')}</div>`));
    assert.equal(arriba(ABIERTA(), 2), `<div class="dq-prop-arriba"><span class="dq-orden">Propuesta 2</span><span class="dq-etiqueta dq-et-agenda">Agenda</span>${boton('Votar')}</div>`);
    assert.equal(arriba(CON_VOTO(), 2), '<div class="dq-prop-arriba"><span class="dq-orden">Propuesta 2</span><span class="dq-etiqueta dq-et-agenda">Agenda</span>'
      + `<span class="dq-etiqueta dq-et-tuyo">Tu 1.º</span>${boton('Cambiar mi orden')}</div>`);
    assert.ok(arriba(CON_VOTO(), 1).endsWith(`<span class="dq-etiqueta dq-et-tuyo">Tu 2.º</span>${boton('Cambiar mi orden')}</div>`));
    assert.equal(arriba(CON_VOTO(), 1, true), arriba(CON_VOTO(), 1), 'igual para cualquier rol');
    for (const [detalle, nombre] of [[FUERA(), 'fuera'], [SIN_CALENDARIO(), 'sin calendario'], [PUNTOS(), 'puntos'], [NADIE(), 'nadie']]) {
      for (const propuesta of [1, 2]) assert.ok(!arriba(detalle, propuesta, true).includes('data-votar'), `${nombre} ${propuesta}`);
    }
    // Sin calendario, con su orden de antes: «Tu N.º» sí (es lo que guardó), el botón no
    const conOrden = conVotacion(SIN_CALENDARIO(), { tu_orden: CON_VOTO().votacion.tu_orden });
    assert.ok(arriba(conOrden, 2).endsWith('<span class="dq-etiqueta dq-et-tuyo">Tu 1.º</span></div>'));
    // Cerrada: la ganadora con la pastilla del equipo, como la elegida
    assert.ok(arriba(PUNTOS(), 2).includes(`<span class="dq-etiqueta dq-et-equipo">${I.equipo}Principal del equipo</span>`));
    assert.ok(!arriba(PUNTOS(), 1).includes('dq-et-equipo'));
  });

  it('el índice: «Tu N.º» en cada propuesta que ordenó, con el estilo de las otras marcas; la del equipo, en la ganadora al cerrar', () => {
    const marcas = (detalle) => indiceDe(ctx.htmlDelPanelPropuestas(detalle)).map((i) => i.marcas.filter((m) => !m.startsWith('dq-im-validar')));
    const DATITO = 'dq-im-principal: Datito (Principal de Datito)';
    assert.deepEqual(marcas(ABIERTA()), [[DATITO], []]);
    assert.deepEqual(marcas(CON_VOTO()), [[DATITO, 'dq-im-tuyo: Tu 2.º'], ['dq-im-tuyo: Tu 1.º']]);
    assert.deepEqual(marcas(PUNTOS()), [[DATITO], ['dq-im-equipo: Equipo (Principal del equipo)']]);
    assert.deepEqual(marcas(DESEMPATE()), [['dq-im-equipo: Equipo (Principal del equipo)', DATITO], []]);
    // Sin votar, abre la de Datito; con la ganadora, ella
    assert.deepEqual(actualDe(panelDe(ctx.htmlDelDetalle(ABIERTA(), { vista: 'propuestas' }), 'propuestas')), ['1']);
    assert.deepEqual(actualDe(panelDe(ctx.htmlDelDetalle(PUNTOS(), { vista: 'propuestas' }), 'propuestas')), ['2']);
  });

  it('htmlDelDialogoDelVoto: una fila por propuesta (el puesto o un punto, «Propuesta N», el título, la marca de Datito), lo que falta y «Empezar de nuevo»', () => {
    const fila = (orden, titulo, puesto, marca = '') => `<li><button type="button" class="dq-tocar${puesto ? ' dq-tocada' : ''}" data-tocar="${orden}" aria-pressed="${Boolean(puesto)}">`
      + (puesto ? `<span class="dq-pos">${puesto}</span>` : '<span class="dq-pos" aria-hidden="true">·</span>')
      + ` <span class="dq-tocar-tit"><b>Propuesta ${orden}</b> ${titulo}${marca ? ` ${marca}` : ''}</span></button></li>`;
    const DE_NUEVO = '<button type="button" class="dq-link dq-de-nuevo" data-de-nuevo>Empezar de nuevo</button>';
    assert.equal(ctx.htmlDelDialogoDelVoto(ABIERTA(), []), `<ul class="dq-tocar-lista">${fila(1, 'Un título inventado', null, MARCA)}${fila(2, 'Otro título inventado', null)}</ul>`
      + '<div class="dq-tocar-pie"><p class="dq-falta-tocar">Tocá primero la que más querés trabajar.</p></div>');
    assert.equal(ctx.htmlDelDialogoDelVoto(ABIERTA(), [2]), `<ul class="dq-tocar-lista">${fila(1, 'Un título inventado', null, MARCA)}${fila(2, 'Otro título inventado', '1.º')}</ul>`
      + `<div class="dq-tocar-pie"><p class="dq-falta-tocar">Te falta 1.</p>${DE_NUEVO}</div>`);
    assert.equal(ctx.htmlDelDialogoDelVoto(ABIERTA(), [2, 1]), `<ul class="dq-tocar-lista">${fila(1, 'Un título inventado', '2.º', MARCA)}${fila(2, 'Otro título inventado', '1.º')}</ul>`
      + `<div class="dq-tocar-pie"><p class="dq-falta-tocar">Listo: ya están las 2.</p>${DE_NUEVO}</div>`);
    // En el orden de la edición, con cuatro: lo que falta, en plural
    const cuatro = ctx.htmlDelDialogoDelVoto(CUATRO(), [3]);
    assert.deepEqual([...cuatro.matchAll(/data-tocar="(\d)" aria-pressed="(true|false)"/g)].map((m) => `${m[1]} ${m[2]}`), ['1 false', '2 false', '3 true', '4 false']);
    assert.ok(cuatro.includes('<p class="dq-falta-tocar">Te faltan 3.</p>'));
    // Una sola propuesta (Review Focus 3): una fila y, con ella tocada, lista
    assert.equal(ctx.htmlDelDialogoDelVoto(UNA(), [1]), `<ul class="dq-tocar-lista">${fila(1, 'Un título inventado', '1.º', MARCA)}</ul>`
      + `<div class="dq-tocar-pie"><p class="dq-falta-tocar">Listo: ya está la única.</p>${DE_NUEVO}</div>`);
    // Sin propuestas, nada
    assert.equal(ctx.htmlDelDialogoDelVoto({ ...ABIERTA(), propuestas: [] }, []), '');
    assert.equal(ctx.htmlDelDialogoDelVoto(null, []), '');
  });

  it('tocar en orden: 3, 1, 4 y 2 da [3, 1, 4, 2]; tocar una con puesto se lo saca y las de atrás suben; lo que falta, contado', () => {
    let tocadas = [];
    for (const orden of [3, 1, 4, 2]) tocadas = plano(ctx.tocadasDespuesDeTocar(tocadas, orden));
    assert.deepEqual(tocadas, [3, 1, 4, 2]);
    const antes = [3, 1, 4, 2];
    assert.deepEqual(plano(ctx.tocadasDespuesDeTocar(antes, 1)), [3, 4, 2]);
    assert.deepEqual(antes, [3, 1, 4, 2], 'no cambia la de antes');
    assert.deepEqual(plano(ctx.tocadasDespuesDeTocar([3, 4, 2], 1)), [3, 4, 2, 1], 'vuelve al final');
    // Los puestos que se ven, después de sacar la 1: la 4 sube a 2.º y la 2 a 3.º
    const html = ctx.htmlDelDialogoDelVoto(CUATRO(), [3, 4, 2]);
    assert.deepEqual([...html.matchAll(/data-tocar="(\d)" aria-pressed="(?:true|false)"><span class="dq-pos"[^>]*>([^<]*)</g)].map((m) => `${m[1]} ${m[2]}`),
      ['1 ·', '2 3.º', '3 1.º', '4 2.º']);
    // Lo que falta
    assert.deepEqual([0, 1, 2, 3, 4].map((n) => ctx.textoDeLoQueFaltaTocar(4, n)),
      ['Tocá primero la que más querés trabajar.', 'Te faltan 3.', 'Te faltan 2.', 'Te falta 1.', 'Listo: ya están las 4.']);
    assert.deepEqual([0, 1].map((n) => ctx.textoDeLoQueFaltaTocar(1, n)), ['Tocá primero la que más querés trabajar.', 'Listo: ya está la única.']);
    // Al abrir: sin voto, vacío (no empuja a dejar el orden de Datito); con voto, el suyo
    assert.deepEqual(plano(ctx.tocadasAlAbrir(ABIERTA())), []);
    assert.deepEqual(plano(ctx.tocadasAlAbrir(CON_VOTO())), [2, 1]);
    // Un orden que la edición no tiene no entra
    assert.deepEqual(plano(ctx.tocadasAlAbrir(conVotacion(CON_VOTO(), { tu_orden: [...CON_VOTO().votacion.tu_orden, { puesto: '3.º', orden: 9, texto: 'x' }] }))), [2, 1]);
  });

  it('la tarjeta: abierta, «Se vota hasta …» (cielo, con el reloj) y, si falta su voto, «Falta tu voto» (sol, con el triángulo), antes de la pastilla del envío', () => {
    const [regular] = LISTA().ediciones;
    const pie = (item) => ctx.htmlDeTarjeta(item).match(/<div class="dq-tarjeta-pie">[\s\S]*?<\/div>/)?.[0] ?? '';
    const ENVIO = `<span class="dq-envio dq-envio-enviada">${I.check}Enviada el lun 16/11</span>`;
    const SE_VOTA = `<span class="dq-envio dq-envio-programada">${I.reloj}Se vota hasta el mar 03/11 a las 12:00</span>`;
    const FALTA_EN_LA_TARJETA = `<span class="dq-envio dq-envio-espera">${I.aviso}Falta tu voto</span>`;
    assert.equal(pie({ ...regular, votacion: { texto: 'Se vota hasta el mar 03/11 a las 12:00', falta_tu_voto: true } }),
      `<div class="dq-tarjeta-pie">${SE_VOTA}${FALTA_EN_LA_TARJETA}${ENVIO}</div>`);
    assert.equal(pie({ ...regular, votacion: { texto: 'Se vota hasta el mar 03/11 a las 12:00', falta_tu_voto: false } }), `<div class="dq-tarjeta-pie">${SE_VOTA}${ENVIO}</div>`);
    assert.equal(pie({ ...regular, votacion: null }), `<div class="dq-tarjeta-pie">${ENVIO}</div>`);
    // Sin envío, solo las de la votación; sin ninguna, sin pie
    assert.equal(pie({ ...regular, envio: null, votacion: { texto: 'Se está votando', falta_tu_voto: false } }),
      `<div class="dq-tarjeta-pie"><span class="dq-envio dq-envio-programada">${I.reloj}Se está votando</span></div>`);
    assert.ok(!ctx.htmlDeTarjeta({ ...regular, envio: null, votacion: null }).includes('dq-tarjeta-pie'));
    // Solo el true literal; el texto, escapado; algo que no es un objeto, nada
    assert.ok(!pie({ ...regular, votacion: { texto: 'x', falta_tu_voto: 'true' } }).includes('Falta tu voto'));
    assert.ok(pie({ ...regular, votacion: { texto: '<b>x</b>', falta_tu_voto: false } }).includes('&lt;b&gt;x&lt;/b&gt;'));
    for (const raro of ['x', 3, []]) assert.equal(pie({ ...regular, votacion: raro }), `<div class="dq-tarjeta-pie">${ENVIO}</div>`, JSON.stringify(raro));
    // Sigue siendo un solo enlace
    assert.equal(cuantas(ctx.htmlDeTarjeta({ ...regular, votacion: { texto: 'x', falta_tu_voto: true } }), /<a /g), 1);
  });

  it('el <style>: la franja abierta y cerrada, los votos, «Tu N.º», el diálogo, la tarjeta con dos pastillas y «Las personas»; nada se mueve', () => {
    const estilo = leer('dato-quincena.html').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    for (const clase of ['dq-franja-abierta', 'dq-franja-cerrada', 'dq-tu-orden', 'dq-tu-orden-titulo', 'dq-falta-tu-voto', 'dq-resultado', 'dq-votos',
      'dq-votos-regla', 'dq-tabla-votos', 'dq-col-puntos', 'dq-gana', 'dq-gano', 'dq-im-chica', 'dq-et-tuyo', 'dq-im-tuyo', 'dq-votar-esta', 'dq-modal-voto',
      'dq-tocar-lista', 'dq-tocar', 'dq-tocada', 'dq-pos', 'dq-tocar-tit', 'dq-tocar-pie', 'dq-falta-tocar', 'dq-de-nuevo']) {
      assert.ok(estilo.includes(`.${clase}`), clase);
    }
    // La ganadora con fondo (y «Ganó» con el tilde: no es solo el color); la que se tocó, con el fondo, el borde y una barra
    assert.match(estilo, /\.dq-tabla-votos tr\.dq-gana th, \.dq-tabla-votos tr\.dq-gana td \{ background: var\(--sg-cielo\); \}/);
    assert.match(estilo, /\.dq-tocada \{[^}]*background: var\(--sg-cielo\);[^}]*box-shadow: inset 4px 0 0 var\(--sg-tinta\);/);
    // «Tu N.º», con el estilo de las otras marcas
    assert.match(estilo, /\.dq-et-tuyo, \.dq-im-tuyo \{[^}]*background: var\(--sg-cielo\); color: var\(--sg-tinta\);/);
    // Lo largo no ensancha el diálogo; la tarjeta, con sus pastillas en un renglón que se parte
    assert.match(estilo, /\.dq-tocar-tit \{[^}]*overflow-wrap: anywhere;/);
    assert.match(estilo, /\.dq-tarjeta-pie \{[^}]*display: flex; flex-wrap: wrap;/);
    // En el teléfono, el botón de la propuesta debajo de las etiquetas
    const telefono = estilo.match(/@media \(max-width: 640px\) \{([\s\S]*?)\n {8}\}/)?.[1] ?? '';
    assert.match(telefono, /\.dq-votar-esta \{ margin-left: 0; \}/);
    // «Guardar mi orden» deshabilitado se ve apagado
    assert.match(estilo, /#dq-voto-guardar:disabled \{ opacity: 0\.55; \}/);
    assert.doesNotMatch(estilo, /Datito/);
    assert.doesNotMatch(estilo, /\.mq-/);
  });
});

// La parte del DOM de la votación, con una página falsa: el diálogo «Tu orden», guardar y volver a dibujar, una por vez
describe('dato-quincena.js: votar (la parte del DOM)', () => {
  const ABIERTA = () => respuesta('detalle_votacion_abierta').data;
  const CON_VOTO = () => respuesta('detalle_votacion_abierta_con_voto').data;
  const PUNTOS = () => respuesta('detalle_votacion_cerrada_puntos').data;
  const OTRA = () => respuesta('detalle_equipo_otra').data;
  const UNA = () => {
    const detalle = ABIERTA();
    detalle.propuestas = detalle.propuestas.slice(0, 1);
    return detalle;
  };
  const MENSAJE = 'Guardamos tu orden. Lo podés cambiar hasta el martes 03/11 a las 12:00.';
  const despues = () => new Promise((listo) => setImmediate(listo));
  const conDetalle = (c, detalle, { vista = 'general', propuesta = null, caja = null, admin = false } = {}) => vm.runInContext(
    `vistaDatoQuincena.admin = ${admin}; vistaDatoQuincena.detalle = ${JSON.stringify(detalle)}; vistaDatoQuincena.vista = ${JSON.stringify(vista)};`
    + ` vistaDatoQuincena.propuesta = ${JSON.stringify(propuesta)}; vistaDatoQuincena.caja = ${JSON.stringify(caja)};`, c);
  // #dq-contenido con los elementos que se buscan después de volver a dibujar, por su selector
  const contenidoFalso = (elementos = {}) => falso({ querySelector: (selector) => elementos[selector] ?? null });
  // Un botón con un data- (el clic llega por #dq-contenido o por el diálogo)
  const botonCon = (selector, dataset) => {
    const boton = falso({ dataset });
    boton.closest = (pedido) => (pedido === selector ? boton : null);
    return boton;
  };
  const enfocable = () => {
    const elemento = falso();
    elemento.focus = () => { elemento.enfocado = true; };
    return elemento;
  };
  // El diálogo falso: el velo (con los oyentes que le engancha la página), el cuerpo (cada botón que se busca para el foco anota su
  // selector) y «Guardar mi orden»
  const dialogoFalso = () => {
    const oyentes = {};
    const enfocados = [];
    const modal = falso({ addEventListener: (tipo, f) => { oyentes[tipo] = f; } });
    const cuerpo = falso({
      querySelector: (selector) => {
        if (!selector.startsWith('button[data-tocar')) return null;
        const boton = falso();
        boton.focus = () => enfocados.push(selector);
        return boton;
      }
    });
    const guardar = falso({ addEventListener: (tipo, f) => { oyentes[`guardar:${tipo}`] = f; } });
    const lugares = { 'dq-voto': modal, 'dq-voto-cuerpo': cuerpo, 'dq-voto-guardar': guardar };
    return { modal, cuerpo, guardar, oyentes, enfocados, lugares };
  };
  const tocar = (dialogo, orden) => dialogo.oyentes.click({ target: botonCon('button[data-tocar]', { tocar: String(orden) }) });
  const tocadas = (c) => plano(vm.runInContext('vistaDatoQuincena.voto?.tocadas ?? null', c));

  it('un lector en la foto: «Votar» abre «Tu orden» vacío con el texto del servidor; tocar da el puesto y lo anuncia; con todas, «Guardar mi orden»; Escape cierra', async () => {
    const d = dialogoFalso();
    const { c, todos, oyentes } = paginaFalsa({ admin: false, search: '?id=12', lugares: d.lugares, responder: () => ({ success: true, data: ABIERTA() }) });
    c.setTimeout = (f) => f();
    // El diálogo se engancha para cualquier rol: votar no es de administración
    await c.iniciarDatoQuincena();
    assert.equal(typeof d.oyentes.click, 'function');
    const votar = botonCon('button[data-votar]', {});
    votar.focus = () => d.enfocados.push('votar');
    c.alTocarDq({ target: votar });
    assert.ok(d.modal.classList.contains('active'));
    assert.equal(todos['dq-voto-texto'].textContent, ABIERTA().votacion.dialogo);
    assert.equal(d.cuerpo.innerHTML, c.htmlDelDialogoDelVoto(ABIERTA(), []));
    assert.equal(d.guardar.disabled, true, 'sin ninguna tocada');
    assert.deepEqual(d.enfocados, ['button[data-tocar]'], 'el foco en la primera');
    tocar(d, 2);
    assert.deepEqual(tocadas(c), [2]);
    assert.equal(d.cuerpo.innerHTML, c.htmlDelDialogoDelVoto(ABIERTA(), [2]));
    assert.equal(d.guardar.disabled, true);
    assert.equal(todos['dq-voto-anuncio'].textContent, 'Te falta 1.');
    assert.equal(d.enfocados.at(-1), 'button[data-tocar="2"]', 'el foco sigue en la que se tocó');
    tocar(d, 1);
    assert.deepEqual(tocadas(c), [2, 1]);
    assert.equal(d.guardar.disabled, false, 'con todas');
    assert.equal(todos['dq-voto-anuncio'].textContent, 'Listo: ya están las 2.');
    // Tocar una con puesto se lo saca; una que la edición no tiene no cambia nada
    tocar(d, 2);
    assert.deepEqual(tocadas(c), [1]);
    assert.equal(d.guardar.disabled, true);
    tocar(d, 9);
    assert.deepEqual(tocadas(c), [1]);
    // «Empezar de nuevo» saca todos; el foco, en la primera
    d.oyentes.click({ target: botonCon('button[data-de-nuevo]', {}) });
    assert.deepEqual(tocadas(c), []);
    assert.equal(d.cuerpo.innerHTML, c.htmlDelDialogoDelVoto(ABIERTA(), []));
    assert.equal(todos['dq-voto-anuncio'].textContent, 'Tocá primero la que más querés trabajar.');
    assert.equal(d.enfocados.at(-1), 'button[data-tocar]');
    // Escape cierra y el foco vuelve a «Votar»
    oyentes['document:keydown']({ key: 'Escape', preventDefault() {} });
    assert.ok(!d.modal.classList.contains('active'));
    assert.equal(d.enfocados.at(-1), 'votar');
    assert.equal(vm.runInContext('vistaDatoQuincena.voto', c), null);
    // «Cancelar» y el velo (si el clic empezó en el velo) también cierran
    c.alTocarDq({ target: votar });
    const cancelar = falso();
    cancelar.closest = (selector) => (selector === '[data-cerrar]' ? cancelar : null);
    d.oyentes.click({ target: cancelar });
    assert.ok(!d.modal.classList.contains('active'));
    c.alTocarDq({ target: votar });
    d.oyentes.mousedown({ target: falso() });
    d.oyentes.click({ target: d.modal });
    assert.ok(d.modal.classList.contains('active'), 'una selección que termina en el velo no cierra');
    d.oyentes.mousedown({ target: d.modal });
    d.oyentes.click({ target: d.modal });
    assert.ok(!d.modal.classList.contains('active'));
  });

  it('con su voto, «Cambiar mi orden» abre con su orden; «Guardar mi orden»: PUT con { orden }, deshabilitado hasta la respuesta; cierra, avisa, vuelve a pedir la edición y el foco va al botón', async () => {
    const d = dialogoFalso();
    const cambiar = enfocable();
    const contenido = contenidoFalso({ '#dq-panel-general button[data-votar]': cambiar });
    let fase = 'cargar';
    const { c, pedidos, avisos, urls } = paginaFalsa({
      admin: false, search: '?id=12', lugares: { ...d.lugares, 'dq-contenido': contenido },
      responder: (metodo) => {
        if (metodo === 'PUT') {
          assert.equal(d.guardar.disabled, true, 'deshabilitado hasta la respuesta');
          fase = 'votado';
          return { success: true, data: { cambio: true }, message: MENSAJE };
        }
        return { success: true, data: fase === 'cargar' ? CON_VOTO() : ABIERTA() };
      }
    });
    c.setTimeout = (f) => f();
    await c.iniciarDatoQuincena();
    c.alTocarDq({ target: botonCon('button[data-votar]', {}) });
    assert.deepEqual(tocadas(c), [2, 1], 'con su orden');
    assert.equal(d.guardar.disabled, false);
    d.oyentes.click({ target: botonCon('button[data-de-nuevo]', {}) });
    tocar(d, 1);
    tocar(d, 2);
    const cuantos = pedidos.length;
    const guardando = d.oyentes['guardar:click']({ currentTarget: d.guardar });
    await d.oyentes['guardar:click']({ currentTarget: d.guardar });
    await guardando;
    assert.deepEqual(pedidos.slice(cuantos), [['PUT', '/dato-quincena/ediciones/12/voto', { orden: [1, 2] }], ['GET', '/dato-quincena/ediciones/12']],
      'un doble clic manda un solo pedido');
    assert.ok(!d.modal.classList.contains('active'), 'cerrado');
    assert.equal(vm.runInContext('vistaDatoQuincena.voto', c), null);
    assert.deepEqual(avisos, [[MENSAJE, 'success']]);
    assert.equal(contenido.innerHTML, c.htmlDelDetalle(ABIERTA(), { admin: false, vista: 'general', propuesta: null }));
    assert.equal(cambiar.enfocado, true, 'el foco en el botón de votar de General');
    assert.deepEqual(urls, []);
  });

  it('desde Propuestas: vuelve a dibujar la misma propuesta, con el foco en su botón; sin cambios (cambio: false), el aviso como información', async () => {
    const d = dialogoFalso();
    const boton = enfocable();
    const contenido = contenidoFalso({ '#dq-panel-propuestas button[data-votar]': boton });
    const { c, pedidos, avisos, urls } = paginaFalsa({
      admin: false, search: '?id=12&vista=propuestas&propuesta=2', lugares: { ...d.lugares, 'dq-contenido': contenido },
      responder: (metodo) => (metodo === 'PUT'
        ? { success: true, data: { cambio: false }, message: 'Tu orden ya era ese.' }
        : { success: true, data: CON_VOTO() })
    });
    c.conectarElVotoDq();
    conDetalle(c, CON_VOTO(), { vista: 'propuestas', propuesta: 2 });
    c.alTocarDq({ target: botonCon('button[data-votar]', {}) });
    await d.oyentes['guardar:click']({ currentTarget: d.guardar });
    assert.deepEqual(pedidos, [['PUT', '/dato-quincena/ediciones/12/voto', { orden: [2, 1] }], ['GET', '/dato-quincena/ediciones/12']]);
    assert.equal(contenido.innerHTML, c.htmlDelDetalle(CON_VOTO(), { admin: false, vista: 'propuestas', propuesta: 2 }));
    assert.equal(boton.enfocado, true);
    assert.deepEqual(avisos, [['Tu orden ya era ese.', 'info']]);
    assert.deepEqual(urls, []);
  });

  it('un error que no es 403 ni 409 (un 500, la red): su texto escapado, también en la región del diálogo; queda abierto con su orden y no vuelve a pedir la edición; un 401, al login', async () => {
    const d = dialogoFalso();
    let error = errorDelServidor(500, 'Un error <inventado>.');
    const { c, pedidos, avisos, todos } = paginaFalsa({
      admin: false, search: '?id=12', lugares: d.lugares,
      responder: (metodo) => { if (metodo === 'PUT') throw error; return { success: true, data: CON_VOTO() }; }
    });
    c.conectarElVotoDq();
    conDetalle(c, CON_VOTO());
    c.alTocarDq({ target: botonCon('button[data-votar]', {}) });
    await d.oyentes['guardar:click']({ currentTarget: d.guardar });
    assert.deepEqual(pedidos, [['PUT', '/dato-quincena/ediciones/12/voto', { orden: [2, 1] }]]);
    assert.deepEqual(avisos, [['Un error &lt;inventado&gt;.', 'error']]);
    // Con el diálogo abierto (aria-modal), la región de la página no se anuncia: va también a la del diálogo, como texto
    assert.equal(todos['dq-voto-anuncio'].textContent, 'Un error <inventado>.');
    assert.equal(todos['dq-anuncio'].textContent, 'Un error <inventado>.');
    assert.ok(d.modal.classList.contains('active'), 'abierto');
    assert.deepEqual(tocadas(c), [2, 1]);
    assert.equal(d.guardar.disabled, false, 'se puede volver a probar');
    error = new TypeError('Failed to fetch');
    await d.oyentes['guardar:click']({ currentTarget: d.guardar });
    assert.deepEqual(avisos.at(-1), ['No se pudo guardar tu orden. Probá de nuevo en unos minutos.', 'error']);
    assert.equal(todos['dq-voto-anuncio'].textContent, 'No se pudo guardar tu orden. Probá de nuevo en unos minutos.');
    assert.ok(d.modal.classList.contains('active'), 'sigue abierto');
    assert.deepEqual(pedidos.map(([metodo]) => metodo), ['PUT', 'PUT']);
    error = errorDelServidor(401, 'Sesión vencida');
    await d.oyentes['guardar:click']({ currentTarget: d.guardar });
    assert.equal(c.window.location.href, 'login.html');
  });

  it('un 409 (ya cerró, no se vota) o un 403 (no está en la lista): el aviso, también en la región del diálogo; el diálogo se cierra y la edición se vuelve a pedir y a dibujar, sin «Votar»', async () => {
    const SIN_VOTAR = () => ({ ...ABIERTA(), votacion: { ...ABIERTA().votacion, puede_votar: false, falta_tu_voto: false, dialogo: null } });
    const casos = [
      [409, 'La votación ya cerró.', PUNTOS()], [409, 'Esta edición no se vota.', OTRA()],
      [403, 'No estás en la lista de quienes votan esta edición.', SIN_VOTAR()]
    ];
    for (const [status, mensaje, despues] of casos) {
      const d = dialogoFalso();
      const pestana = enfocable();
      const contenido = contenidoFalso({ '#dq-tab-general': pestana });
      const { c, pedidos, avisos, todos, urls } = paginaFalsa({
        admin: false, search: '?id=12', lugares: { ...d.lugares, 'dq-contenido': contenido },
        responder: (metodo) => {
          if (metodo === 'PUT') throw errorDelServidor(status, mensaje);
          return { success: true, data: despues };
        }
      });
      c.conectarElVotoDq();
      conDetalle(c, CON_VOTO());
      c.alTocarDq({ target: botonCon('button[data-votar]', {}) });
      await d.oyentes['guardar:click']({ currentTarget: d.guardar });
      assert.deepEqual(pedidos, [['PUT', '/dato-quincena/ediciones/12/voto', { orden: [2, 1] }], ['GET', '/dato-quincena/ediciones/12']], mensaje);
      assert.deepEqual(avisos, [[mensaje, 'error']], mensaje);
      assert.equal(todos['dq-voto-anuncio'].textContent, mensaje);
      assert.equal(todos['dq-anuncio'].textContent, mensaje);
      assert.ok(!d.modal.classList.contains('active'), `cerrado: ${mensaje}`);
      assert.equal(vm.runInContext('vistaDatoQuincena.voto', c), null);
      assert.equal(contenido.innerHTML, c.htmlDelDetalle(despues, { admin: false, vista: 'general', propuesta: null }), mensaje);
      assert.ok(!contenido.innerHTML.includes('data-votar'), `sin «Votar»: ${mensaje}`);
      assert.equal(pestana.enfocado, true, `sin el botón de votar, el foco en su pestaña: ${mensaje}`);
      assert.deepEqual(urls, []);
    }
  });

  it('una edición de una sola propuesta (Review Focus 3): una fila; tocada, «Listo» y «Guardar mi orden» manda { orden: [1] }', async () => {
    const d = dialogoFalso();
    const { c, pedidos, todos } = paginaFalsa({
      admin: false, search: '?id=12', lugares: d.lugares,
      responder: (metodo) => (metodo === 'PUT' ? { success: true, data: { cambio: true }, message: MENSAJE } : { success: true, data: UNA() })
    });
    c.setTimeout = (f) => f();
    c.conectarElVotoDq();
    conDetalle(c, UNA());
    c.alTocarDq({ target: botonCon('button[data-votar]', {}) });
    assert.equal(d.cuerpo.innerHTML, c.htmlDelDialogoDelVoto(UNA(), []));
    assert.equal(d.guardar.disabled, true);
    tocar(d, 1);
    assert.equal(d.guardar.disabled, false);
    assert.equal(todos['dq-voto-anuncio'].textContent, 'Listo: ya está la única.');
    await d.oyentes['guardar:click']({ currentTarget: d.guardar });
    assert.deepEqual(pedidos[0], ['PUT', '/dato-quincena/ediciones/12/voto', { orden: [1] }]);
  });

  it('«Votar» no abre nada si no se puede votar (cerrada o fuera de la foto) ni sin una edición', () => {
    const d = dialogoFalso();
    const { c } = paginaFalsa({ admin: false, search: '?id=12', lugares: d.lugares });
    c.conectarElVotoDq();
    for (const detalle of [PUNTOS(), { ...ABIERTA(), votacion: { ...ABIERTA().votacion, puede_votar: false } }, OTRA(), { ...ABIERTA(), id: 0 }]) {
      conDetalle(c, detalle);
      c.alTocarDq({ target: botonCon('button[data-votar]', {}) });
      assert.ok(!d.modal.classList.contains('active'), JSON.stringify(detalle.votacion));
      assert.equal(vm.runInContext('vistaDatoQuincena.voto', c), null);
    }
  });

  it('una por vez: mientras se guarda, tocar no cambia el orden, «Votar» no vuelve a abrir y «Reenviar…» no abre su diálogo; con la respuesta, sí', async () => {
    const d = dialogoFalso();
    const reenvio = falso();
    const cambiar = botonCon('button[data-votar]', {});
    const enfocados = [];
    cambiar.focus = () => enfocados.push('cambiar');
    const contenido = contenidoFalso({ '#dq-panel-general button[data-votar]': cambiar });
    let responderElPut = null;
    const { c, pedidos, todos } = paginaFalsa({
      search: '?id=12', lugares: { ...d.lugares, 'dq-reenvio': reenvio, 'dq-envio-lugar': falso(), 'dq-contenido': contenido },
      responder: (metodo) => (metodo === 'PUT'
        ? new Promise((listo) => { responderElPut = () => listo({ success: true, data: { cambio: true }, message: MENSAJE }); })
        : { success: true, data: CON_VOTO() })
    });
    c.setTimeout = (f) => f();
    c.conectarElVotoDq();
    conDetalle(c, CON_VOTO(), { caja: CAJA(), admin: true });
    c.alTocarDq({ target: cambiar });
    const guardando = d.oyentes['guardar:click']({ currentTarget: d.guardar });
    const antes = vm.runInContext('vistaDatoQuincena.voto', c);
    tocar(d, 1);
    d.oyentes.click({ target: botonCon('button[data-de-nuevo]', {}) });
    assert.deepEqual(tocadas(c), [2, 1], 'el orden no cambia mientras se guarda');
    assert.equal(d.guardar.disabled, true);
    c.alTocarDq({ target: cambiar });
    assert.equal(vm.runInContext('vistaDatoQuincena.voto', c), antes, 'no vuelve a abrir');
    const reenviar = botonCon('button[data-reenviar]', {});
    c.alTocarDq({ target: reenviar });
    assert.ok(!reenvio.classList.contains('active'), 'no abre mientras se guarda');
    assert.equal(todos['dq-reenvio-cuerpo'].innerHTML, '');
    assert.deepEqual(pedidos, [['PUT', '/dato-quincena/ediciones/12/voto', { orden: [2, 1] }]]);
    responderElPut();
    await guardando;
    await despues();
    assert.deepEqual(pedidos, [['PUT', '/dato-quincena/ediciones/12/voto', { orden: [2, 1] }], ['GET', '/dato-quincena/ediciones/12']]);
    assert.deepEqual(enfocados, ['cambiar'], 'el foco en «Cambiar mi orden», sin un diálogo abierto encima');
    // Con la respuesta, «Reenviar…» abre con la lista de hoy y «Cambiar mi orden» vuelve a abrir «Tu orden»
    c.alTocarDq({ target: reenviar });
    assert.ok(reenvio.classList.contains('active'));
    assert.equal(todos['dq-reenvio-cuerpo'].innerHTML, c.htmlDelReenvio(CAJA().lista_de_hoy));
    c.cerrarReenvioDq();
    c.alTocarDq({ target: cambiar });
    assert.ok(d.modal.classList.contains('active'));
  });

  it('al volver a dibujar, la infografía es la misma imagen (no se vuelve a pedir); sin la caja del correo, se pide', async () => {
    const copia = falso();
    const imagen = falso({ cloneNode: () => copia });
    let puesta = null;
    const lugarDeLaImagen = falso({ dataset: { infografia: '/dato-quincena/ediciones/12/archivos/infografia_png', alt: 'Infografía de la principal de Datito: Un título inventado' },
      replaceWith: (nueva) => { puesta = nueva; } });
    const contenido = contenidoFalso({ 'img.dq-infografia': imagen, '[data-infografia]': lugarDeLaImagen });
    const { c, pedidos } = paginaFalsa({
      search: '?id=12', lugares: { 'dq-contenido': contenido, 'dq-envio-lugar': falso() },
      responder: (metodo, ruta) => {
        if (metodo === 'PUT') return { success: true, data: { cambio: true }, message: MENSAJE };
        return { success: true, data: ruta.endsWith('/correo') ? CAJA() : CON_VOTO() };
      }
    });
    const archivos = [];
    vm.runInContext('API', c).pedirArchivo = async (ruta) => { archivos.push(ruta); throw new Error('sin archivos'); };
    conDetalle(c, ABIERTA(), { admin: true });
    await c.guardarElVotoDq(falso(), [2, 1]);
    assert.equal(puesta, copia);
    assert.equal(copia.alt, 'Infografía de la principal de Datito: Un título inventado');
    assert.deepEqual(archivos, []);
    assert.deepEqual(pedidos.map(([metodo, ruta]) => `${metodo} ${ruta}`),
      ['PUT /dato-quincena/ediciones/12/voto', 'GET /dato-quincena/ediciones/12', 'GET /dato-quincena/ediciones/12/correo']);
  });

  it('si mientras tanto la página mostró otra cosa, no vuelve a dibujar (el aviso sí); sin la edición de nuevo, la carga entera', async () => {
    const contenido = contenidoFalso();
    const otra = paginaFalsa({
      search: '?id=12', lugares: { 'dq-contenido': contenido },
      responder: (metodo) => {
        vm.runInContext('vistaDatoQuincena.pedido += 1;', otra.c);
        return metodo === 'PUT' ? { success: true, data: { cambio: true }, message: 'Listo.' } : { success: true, data: CON_VOTO() };
      }
    });
    conDetalle(otra.c, ABIERTA());
    await otra.c.guardarElVotoDq(falso(), [2, 1]);
    assert.deepEqual(otra.pedidos.map(([metodo]) => metodo), ['PUT']);
    assert.equal(contenido.innerHTML, '');
    assert.deepEqual(otra.avisos, [['Listo.', 'success']]);
    // El PUT salió bien y la edición no llega: se carga entera, con su error
    let vez = 0;
    const sinDetalle = paginaFalsa({
      search: '?id=12', lugares: { 'dq-envio-lugar': falso() },
      responder: (metodo) => {
        if (metodo === 'PUT') return { success: true, data: { cambio: true }, message: 'Listo.' };
        vez += 1;
        throw errorDelServidor(500, 'Error al obtener la edición');
      }
    });
    conDetalle(sinDetalle.c, ABIERTA());
    await sinDetalle.c.guardarElVotoDq(falso(), [2, 1]);
    assert.equal(vez, 2);
    assert.equal(sinDetalle.todos['dq-contenido'].innerHTML, sinDetalle.c.htmlDelEstado('error'));
  });

  it('Tab y Mayúscula+Tab no salen de «Tu orden» (aria-modal): del último al primero y del primero al último; cerrado, Tab es del navegador', async () => {
    const d = dialogoFalso();
    const { c, oyentes } = paginaFalsa({ admin: false, search: '?id=12', lugares: d.lugares });
    c.setTimeout = () => {};
    c.conectarElVotoDq();
    conDetalle(c, ABIERTA());
    const controles = [falso(), falso(), falso(), falso(), d.guardar];
    for (const control of controles) {
      control.getClientRects = () => [{}];
      control.focus = () => { c.document.activeElement = control; };
    }
    d.modal.querySelectorAll = () => controles;
    d.modal.contains = (elemento) => controles.includes(elemento);
    // La ×, las dos propuestas, «Cancelar» y «Guardar mi orden» (deshabilitado sin todas: el último es «Cancelar»)
    const [cerrar, propuesta, , cancelar] = controles;
    const afuera = falso();
    const desde = (control, shiftKey) => {
      c.document.activeElement = control;
      let prevenido = false;
      oyentes['document:keydown']({ key: 'Tab', shiftKey, preventDefault: () => { prevenido = true; } });
      return { prevenido, enfocado: c.document.activeElement };
    };
    assert.deepEqual(desde(afuera, false), { prevenido: false, enfocado: afuera }, 'cerrado, Tab es del navegador');
    c.alTocarDq({ target: botonCon('button[data-votar]', {}) });
    assert.equal(d.guardar.disabled, true);
    assert.deepEqual(desde(cancelar, false), { prevenido: true, enfocado: cerrar });
    assert.deepEqual(desde(cerrar, true), { prevenido: true, enfocado: cancelar });
    tocar(d, 1);
    tocar(d, 2);
    assert.deepEqual(desde(d.guardar, false), { prevenido: true, enfocado: cerrar });
    assert.deepEqual(desde(cerrar, true), { prevenido: true, enfocado: d.guardar });
    assert.deepEqual(desde(propuesta, false), { prevenido: false, enfocado: propuesta }, 'entre los controles, el navegador');
    assert.deepEqual(desde(afuera, false), { prevenido: true, enfocado: cerrar }, 'con el foco afuera, vuelve al diálogo');
  });

  it('«Ver la propuesta» muestra la del equipo en Propuestas sin recargar (con &propuesta=2 en la dirección); con Ctrl, Meta, Mayúscula, Alt o la rueda, el navegador sigue el enlace', () => {
    const detalle = OTRA();
    const pestanas = hojaFalsa(['general', 'propuestas'], 'general');
    const hoja = propuestasFalsas(detalle, 1);
    const contenido = falso({
      querySelector: (selector) => hoja.contenido.querySelector(selector) ?? pestanas.contenido.querySelector(selector),
      querySelectorAll: (selector) => (selector === '.dq-indice-item' ? hoja.items : pestanas.contenido.querySelectorAll(selector))
    });
    const { c, urls } = paginaFalsa({ admin: false, search: '?id=12', lugares: { 'dq-contenido': contenido } });
    vm.runInContext(`vistaDatoQuincena.detalle = ${JSON.stringify(detalle)}; vistaDatoQuincena.vista = 'general'; vistaDatoQuincena.propuesta = null;`, c);
    const enlace = botonCon('a[data-ver-principal]', { verPrincipal: '2' });
    let prevenidos = 0;
    const clic = (extra = {}) => c.alTocarDq({ target: enlace, button: 0, preventDefault: () => { prevenidos += 1; }, ...extra });
    for (const extra of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) clic(extra);
    assert.equal(prevenidos, 0);
    assert.deepEqual(urls, []);
    clic();
    assert.equal(prevenidos, 1);
    assert.equal(hoja.lectura.innerHTML, c.htmlDeLaPropuestaElegida(detalle, 2));
    assert.deepEqual(hoja.actuales(), ['2']);
    assert.deepEqual(pestanas.estado().elegidas, ['propuestas']);
    assert.deepEqual(urls, ['dato-quincena.html?id=12&vista=propuestas&propuesta=2']);
    // Como «Ver las N propuestas», el foco va a la pestaña
    assert.deepEqual(pestanas.enfocadas, [['propuestas', { preventScroll: true }]]);
  });

  it('«Ver las N propuestas» lleva a la del equipo', () => {
    const detalle = OTRA();
    const pestanas = hojaFalsa(['general', 'propuestas'], 'general');
    const hoja = propuestasFalsas(detalle, 1);
    const contenido = falso({
      querySelector: (selector) => hoja.contenido.querySelector(selector) ?? pestanas.contenido.querySelector(selector),
      querySelectorAll: (selector) => (selector === '.dq-indice-item' ? hoja.items : pestanas.contenido.querySelectorAll(selector))
    });
    const { c } = paginaFalsa({ admin: false, search: '?id=12', lugares: { 'dq-contenido': contenido } });
    vm.runInContext(`vistaDatoQuincena.detalle = ${JSON.stringify(detalle)}; vistaDatoQuincena.vista = 'general'; vistaDatoQuincena.propuesta = 1;`, c);
    c.alTocarDq({ target: botonCon('button[data-ir-vista]', { irVista: 'propuestas' }) });
    assert.equal(tituloDe(hoja.lectura.innerHTML), 'Otro título inventado');
    assert.deepEqual(hoja.actuales(), ['2']);
  });

  it('la propuesta que se vuelve a dibujar en Propuestas lleva «Votar» para cualquier rol que puede votar', () => {
    for (const admin of [true, false]) {
      const detalle = ABIERTA();
      const hoja = propuestasFalsas(detalle, 1);
      const { c } = paginaFalsa({ admin, search: '?id=12&vista=propuestas', lugares: { 'dq-contenido': hoja.contenido } });
      vm.runInContext(`vistaDatoQuincena.admin = ${admin}; vistaDatoQuincena.detalle = ${JSON.stringify(detalle)}; vistaDatoQuincena.vista = 'propuestas';`, c);
      c.alTocarDq({ target: botonDePropuesta(2) });
      assert.equal(hoja.lectura.innerHTML, c.htmlDeLaPropuestaElegida(detalle, 2));
      assert.ok(hoja.lectura.innerHTML.includes('data-votar aria-haspopup="dialog">Votar</button>'), String(admin));
    }
  });
});
