// La pestaña Áreas de Configuración (spec 2026-10-24-configuracion, 4 y 6), ejecutada en Node: lo puro de public/js/areas.js
// ("Así se lee", la regla del aviso de los 40 días, los filtros, la búsqueda, la tabla, el pie del modal y lo que se manda al
// guardar) y, con un DOM falso, la carga de la lista y el guardado. Como seguimiento.js, el script al cargarse solo declara: se
// carga en un vm con un document que no hace nada, junto con el api.js de verdad (Utils.escapeHtml). Los nombres de las personas
// son inventados.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import { MENSAJES_AREA } from '../services/areasReglas.js';
import { articuloDe, deArticulo } from '../services/notasGeneradorContenido.js';

const leer = (ruta) => fs.readFileSync(new URL(`../public/${ruta}`, import.meta.url), 'utf8');

// Un contexto con api.js y areas.js. `document` registra cada vez que alguien lo consulta
const cargar = (globales = {}) => {
  const consultas = [];
  const oyentes = [];
  const contexto = vm.createContext({
    CONFIG: { API_URL: '/api' },
    console,
    document: {
      addEventListener: (tipo) => oyentes.push(tipo),
      getElementById: (id) => { consultas.push(['getElementById', id]); return null; },
      querySelector: (selector) => { consultas.push(['querySelector', selector]); return null; },
      querySelectorAll: (selector) => { consultas.push(['querySelectorAll', selector]); return []; }
    },
    Auth: { isAuthenticated: () => true, isAdmin: () => true },
    window: { location: { search: '', hash: '' } },
    showToast() {},
    ...globales
  });
  vm.runInContext(leer('js/api.js'), contexto);
  vm.runInContext(leer('js/areas.js'), contexto);
  return { contexto, consultas, oyentes };
};

// Lo que devuelve una función del vm es de otro contexto: deepStrictEqual compara prototipos, así que se pasa a uno de acá
const plano = (valor) => JSON.parse(JSON.stringify(valor));
const { contexto: ctx } = cargar();
const en = (expresion) => vm.runInContext(expresion, ctx);
// Las funciones y constantes del script (las declaradas con const no son propiedades del global del vm)
const A = new Proxy({}, { get: (_, nombre) => en(nombre) });

// Un área como la manda GET /api/areas con una sesión de administración
const AREA = Object.freeze({
  id: 12, nombre: 'Dirección General de Catastro', articulo: 'la',
  area_superior: 'Subsec. de Coordinación Económica y Control de Gestión', articulo_superior: 'la', ambito: 'municipal',
  email_principal: 'catastro@rpad.test', email_secundario: null, telefono_area: '297 400 0000', celular_area: null,
  nombre_contacto: 'Persona Inventada', telefono_contacto: '297 411 1111', email_contacto: 'pinventada@rpad.test',
  cantidad_datasets: 3, datasets_dados_de_baja: 0, datasets_externos_con_nota: 2, cambios_pendientes_que_la_usan: 0
});
const area = (cambios = {}) => ({ ...AREA, ...cambios });
// Sin email y con datasets de gestión externa que piden nota: no le llega el aviso de los 40 días
const sinAviso = (id) => area({ id, nombre: `Área sin email ${id}`, email_principal: null, email_secundario: null, datasets_externos_con_nota: 1 });

// El texto que se ve de un pedazo de HTML (sin las etiquetas, con las entidades de escapeHtml resueltas)
const textoDe = (html) => html.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
// Los botones de un HTML: { atributos, texto, html }
const botonesDe = (html) => [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map(([, atributos, adentro]) => ({
  atributos: Object.fromEntries([...atributos.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, clave, valor]) => [clave, valor])),
  texto: textoDe(adentro).replace(/\s+/g, ' ').trim(),
  html: adentro
}));

describe('areas.js: al cargarse', () => {
  it('no toca el DOM: solo declara y espera el DOMContentLoaded', () => {
    const { consultas, oyentes } = cargar();
    assert.deepEqual(consultas, []);
    assert.deepEqual(oyentes, ['DOMContentLoaded']);
  });

  it('el DOMContentLoaded no hace nada si quien mira no es de administración', () => {
    let alCargar = null;
    const consultas = [];
    const contexto = vm.createContext({
      CONFIG: { API_URL: '/api' }, console, window: { location: {} }, showToast() {},
      Auth: { isAuthenticated: () => true, isAdmin: () => false },
      document: {
        addEventListener: (tipo, fn) => { if (tipo === 'DOMContentLoaded') alCargar = fn; },
        getElementById: (id) => { consultas.push(id); return null; },
        querySelector: (selector) => { consultas.push(selector); return null; },
        querySelectorAll: (selector) => { consultas.push(selector); return []; }
      }
    });
    vm.runInContext(leer('js/api.js'), contexto);
    vm.runInContext(leer('js/areas.js'), contexto);
    assert.equal(typeof alCargar, 'function');
    alCargar();
    assert.deepEqual(consultas, []);
  });
});

describe('areas.js: convive con los otros scripts de la página', () => {
  // Los nombres declarados en el nivel superior de un script
  const nombresDe = (archivo) => [...leer(`js/${archivo}`).matchAll(/^(?:const|let|var|function|async function|class) (\w+)/gm)]
    .map(([, nombre]) => nombre);

  it('api.js, usuarios.js y areas.js se cargan en el mismo vm, con los stubs del test de usuarios, sin tirar', () => {
    const elemento = (id) => ({
      id, value: '', textContent: '', hidden: true, disabled: false, oyentes: {}, setAttribute() {}, removeAttribute() {},
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      addEventListener(tipo, fn) { (this.oyentes[tipo] ??= []).push(fn); }
    });
    const contexto = vm.createContext({
      CONFIG: { API_URL: '/api' },
      document: {
        addEventListener() {}, getElementById: elemento, querySelectorAll: () => [], querySelector: (selector) => elemento(selector)
      },
      window: { location: {} },
      Auth: { getUser: () => ({ id: 1 }), getRole: () => 'admin', isAuthenticated: () => true, isAdmin: () => true },
      showToast() {},
      confirm: () => true,
      setTimeout: () => 0,
      clearTimeout() {},
      console
    });
    // Cada runInContext es como un <script> de la página: un let o const repetido tiraría en el segundo
    assert.doesNotThrow(() => vm.runInContext(leer('js/api.js'), contexto));
    assert.doesNotThrow(() => vm.runInContext(leer('js/usuarios.js'), contexto));
    assert.doesNotThrow(() => vm.runInContext(leer('js/areas.js'), contexto));
    for (const nombre of ['cargarAreas', 'pintarAreas', 'abrirModalArea', 'guardarArea', 'confirmarBorradoArea', 'guardarUsuario', 'mostrarVista']) {
      assert.equal(vm.runInContext(`typeof ${nombre}`, contexto), 'function', nombre);
    }
  });

  it('sus nombres de nivel superior no se repiten con los de config.js, auth.js, main.js, api.js ni usuarios.js', () => {
    const propios = nombresDe('areas.js');
    assert.ok(propios.length > 20, 'el regex encuentra los nombres de areas.js');
    assert.equal(new Set(propios).size, propios.length, 'areas.js no declara dos veces un nombre');
    for (const archivo of ['config.js', 'auth.js', 'main.js', 'api.js', 'usuarios.js']) {
      const ajenos = new Set(nombresDe(archivo));
      assert.ok(ajenos.size > 0, archivo);
      assert.deepEqual(propios.filter((nombre) => ajenos.has(nombre)), [], archivo);
    }
  });

  it('no usa los atributos que usuarios.js escucha en todo <main> (data-ver, data-licencia) ni data-vista', () => {
    const fuente = leer('js/areas.js');
    for (const atributo of ['data-ver', 'data-licencia', 'data-vista', 'dataset.ver', 'dataset.licencia', 'dataset.vista']) {
      assert.ok(!new RegExp(`${atributo.replace('.', '\\.')}\\b`).test(fuente), atributo);
    }
  });
});

describe('areas.js: las constantes', () => {
  it('el ámbito, los filtros y los mensajes', () => {
    assert.deepEqual(plano(A.TEXTO_AMBITO), { municipal: 'Municipal', externo: 'Fuera del municipio' });
    assert.deepEqual(plano(A.FILTROS_AREA.map((f) => [f.clave, f.texto])), [['todas', 'Todas'], ['municipal', 'Municipales'],
      ['externo', 'Fuera del municipio'], ['sin-email', 'Sin email'], ['sin-datasets', 'Sin datasets']]);
    assert.equal(A.MENSAJE_SESION_AREAS, 'Tu sesión ya no permite ver las áreas. Volvé a ingresar.');
    assert.equal(A.MENSAJE_ERROR_AREAS, 'No se pudieron cargar las áreas. Probá de nuevo en unos minutos.');
  });

  it('paridad: el mensaje del nombre es el del servidor', () => {
    assert.equal(A.MENSAJE_NOMBRE_AREA, MENSAJES_AREA.nombre);
  });

  // "Así se lee en las notas" y "Depende de" arman los artículos como la nota del Generador: si cambia el servidor, cambia esto
  it('paridad: articuloDelArea y deArticuloArea son copias de articuloDe y deArticulo de services/notasGeneradorContenido.js', () => {
    for (const articulo of ['el', 'la', null, undefined, '', 'los', ' el ']) {
      assert.equal(A.articuloDelArea(articulo), articuloDe(articulo), String(articulo));
      assert.equal(A.deArticuloArea(articulo), deArticulo(articulo), String(articulo));
    }
    assert.equal(A.articuloDelArea('el'), 'el');
    assert.equal(A.deArticuloArea('el'), 'del');
    assert.equal(A.articuloDelArea(null), 'la');
    assert.equal(A.deArticuloArea(null), 'de la');
  });

  it('el campo de cada error del servidor va a su input; el del ámbito, a a-ambito (y su error, a a-ambito-error)', () => {
    assert.deepEqual(plano(A.CAMPO_DEL_ERROR_AREA), {
      nombre: 'a-nombre', email_principal: 'a-email-principal', email_secundario: 'a-email-secundario',
      email_contacto: 'a-contacto-email', ambito: 'a-ambito'
    });
  });
});

describe('areas.js: comoSeNombra ("Así se lee en las notas")', () => {
  const base = { articulo: 'la', nombre: 'Dirección General de Catastro', articulo_superior: 'la', area_superior: 'Subsec. de Coordinación Económica y Control de Gestión' };

  it('con la dependencia y su artículo', () => {
    assert.equal(A.comoSeNombra(base), 'la Dirección General de Catastro, dependiente de la Subsec. de Coordinación Económica y Control de Gestión');
  });

  // El mismo armado que la nota del Generador (services/notasGeneradorContenido.js, articuloDe y deArticulo): la línea muestra
  // cómo sale la nota real
  it('la dependencia con "la": "dependiente de la …"', () => {
    assert.equal(A.comoSeNombra({ ...base, articulo_superior: 'la', area_superior: 'Intendencia' }),
      'la Dirección General de Catastro, dependiente de la Intendencia');
  });

  it('la dependencia con "el": "dependiente del …", nunca "de el"', () => {
    assert.equal(A.comoSeNombra({ ...base, articulo_superior: 'el', area_superior: 'Ministerio de Educación del Chubut' }),
      'la Dirección General de Catastro, dependiente del Ministerio de Educación del Chubut');
  });

  it('el artículo del nombre: "el" es "el" y cualquier otro valor es "la" (al principio no se contrae)', () => {
    assert.equal(A.comoSeNombra({ ...base, articulo: 'el', nombre: 'Ente Autárquico Comodoro Deportes', articulo_superior: 'la', area_superior: 'Intendencia' }),
      'el Ente Autárquico Comodoro Deportes, dependiente de la Intendencia');
    for (const otro of [null, undefined, '', 'los', ' el ']) {
      assert.equal(A.comoSeNombra({ ...base, articulo: otro, area_superior: null }), 'la Dirección General de Catastro', String(otro));
    }
  });

  it('sin dependencia', () => {
    assert.equal(A.comoSeNombra({ ...base, area_superior: undefined }), 'la Dirección General de Catastro');
    assert.equal(A.comoSeNombra({ ...base, area_superior: null }), 'la Dirección General de Catastro');
    assert.equal(A.comoSeNombra({ ...base, area_superior: '   ' }), 'la Dirección General de Catastro');
  });

  it('con la dependencia sin artículo (null, el "—" del selector): "dependiente de la …", como la nota del Generador', () => {
    assert.equal(A.comoSeNombra({ ...base, articulo_superior: null }),
      'la Dirección General de Catastro, dependiente de la Subsec. de Coordinación Económica y Control de Gestión');
    assert.equal(A.comoSeNombra({ ...base, articulo_superior: '' }),
      'la Dirección General de Catastro, dependiente de la Subsec. de Coordinación Económica y Control de Gestión');
    assert.equal(A.comoSeNombra({ ...base, articulo_superior: undefined }),
      'la Dirección General de Catastro, dependiente de la Subsec. de Coordinación Económica y Control de Gestión');
  });

  it('con el nombre vacío, «la …»; los extremos se recortan', () => {
    assert.equal(A.comoSeNombra({ ...base, nombre: '', area_superior: null }), 'la …');
    assert.equal(A.comoSeNombra({ ...base, nombre: '   ', area_superior: null }), 'la …');
    assert.equal(A.comoSeNombra({ articulo: 'la', nombre: '  Dirección X  ', area_superior: '  Secretaría Y ', articulo_superior: 'la' }),
      'la Dirección X, dependiente de la Secretaría Y');
  });

  it('un nombre con < & o comillas queda tal cual (es texto: va con textContent)', () => {
    assert.equal(A.comoSeNombra({ ...base, nombre: 'Área <b>&"x"</b>', area_superior: null }), 'la Área <b>&"x"</b>');
  });
});

describe('areas.js: la regla del aviso de los 40 días', () => {
  it('sinEmail: ni principal ni secundario (solo espacios cuenta como vacío)', () => {
    assert.equal(A.sinEmail({ email_principal: null, email_secundario: null }), true);
    assert.equal(A.sinEmail({ email_principal: '  ', email_secundario: '' }), true);
    assert.equal(A.sinEmail({ email_principal: 'a@rpad.test', email_secundario: null }), false);
    assert.equal(A.sinEmail({ email_principal: null, email_secundario: 'b@rpad.test' }), false);
  });

  it('sinAvisoDe40: sin email y con algún dataset que recibe el aviso', () => {
    assert.equal(A.sinAvisoDe40({ email_principal: null, email_secundario: null, datasets_externos_con_nota: 1 }), true);
    assert.equal(A.sinAvisoDe40({ email_principal: null, email_secundario: null, datasets_externos_con_nota: 0 }), false);
    assert.equal(A.sinAvisoDe40({ email_principal: null, email_secundario: 'b@rpad.test', datasets_externos_con_nota: 1 }), false);
  });

  it('textoAvisoSinEmail: plural, singular y vacío', () => {
    const seis = [1, 2, 3, 4, 5, 6].map(sinAviso);
    const otras = [area({ id: 20 }), area({ id: 21, email_principal: null, datasets_externos_con_nota: 0 })];
    assert.equal(A.textoAvisoSinEmail([...seis, ...otras]),
      '6 áreas con datasets de gestión externa no tienen email cargado: no les llega el aviso de los 40 días.');
    assert.equal(A.textoAvisoSinEmail([sinAviso(1), ...otras]),
      '1 área con datasets de gestión externa no tiene email cargado: no le llega el aviso de los 40 días.');
    assert.equal(A.textoAvisoSinEmail(otras), '');
    assert.equal(A.textoAvisoSinEmail([]), '');
  });

  it('datasetsEnTotal: los activos más los dados de baja', () => {
    assert.equal(A.datasetsEnTotal({ cantidad_datasets: 2, datasets_dados_de_baja: 1 }), 3);
    assert.equal(A.datasetsEnTotal({ cantidad_datasets: 0, datasets_dados_de_baja: 0 }), 0);
    assert.equal(A.datasetsEnTotal({ cantidad_datasets: 4 }), 4);
  });
});

describe('areas.js: los filtros', () => {
  const dos = [area({ id: 1 }), area({ id: 2, nombre: 'Dirección de Tránsito', email_principal: null, email_secundario: null })];

  it('htmlDeFiltrosArea: un botón por filtro con su cantidad del total; "Sin datasets" solo si hay alguna', () => {
    const botones = botonesDe(A.htmlDeFiltrosArea(dos, 'municipal'));
    assert.deepEqual(botones.map((b) => b.atributos['data-filtro-area']), ['todas', 'municipal', 'externo', 'sin-email']);
    assert.deepEqual(botones.map((b) => b.texto), ['Todas 2', 'Municipales 2', 'Fuera del municipio 0', 'Sin email 1']);
    assert.deepEqual(botones.map((b) => b.atributos['aria-pressed']), ['false', 'true', 'false', 'false']);
    assert.deepEqual(botones.map((b) => b.atributos.type), ['button', 'button', 'button', 'button']);
    assert.match(botones[2].html, /<b>0<\/b>/);
    assert.match(botones[3].html, /<b>1<\/b>/);
  });

  it('"Sin datasets" aparece si un área no tiene ninguno, activo o dado de baja', () => {
    const conBaja = [...dos, area({ id: 3, cantidad_datasets: 0, datasets_dados_de_baja: 1 })];
    assert.ok(!A.htmlDeFiltrosArea(conBaja, 'todas').includes('sin-datasets'));
    const vacia = [...dos, area({ id: 4, cantidad_datasets: 0, datasets_dados_de_baja: 0 })];
    const ultimo = botonesDe(A.htmlDeFiltrosArea(vacia, 'todas')).at(-1);
    assert.equal(ultimo.atributos['data-filtro-area'], 'sin-datasets');
    assert.equal(ultimo.texto, 'Sin datasets 1');
  });

  it('"Sin datasets" sigue a la vista si es el elegido, aunque ya no quede ninguna (con 0)', () => {
    const ultimo = botonesDe(A.htmlDeFiltrosArea(dos, 'sin-datasets')).at(-1);
    assert.equal(ultimo.atributos['data-filtro-area'], 'sin-datasets');
    assert.equal(ultimo.atributos['aria-pressed'], 'true');
    assert.match(ultimo.html, /<b>0<\/b>/);
  });
});

describe('areas.js: areasVisibles (filtro y búsqueda)', () => {
  const areas = [
    area({ id: 1 }),
    area({ id: 2, nombre: 'Dirección de Tránsito', ambito: 'municipal', area_superior: 'Secretaría de Gobierno', email_principal: 'transito@rpad.test', nombre_contacto: 'Otra Persona', email_contacto: 'otra@rpad.test' }),
    area({ id: 3, nombre: 'Vialidad Provincial', ambito: 'externo', area_superior: null, email_principal: null, email_secundario: null, nombre_contacto: null, email_contacto: null })
  ];
  const ids = (lista) => plano(lista.map((a) => a.id));

  it('busca por nombre sin distinguir tildes ni mayúsculas', () => {
    assert.deepEqual(ids(A.areasVisibles(areas, 'todas', 'catastro')), [1]);
    assert.deepEqual(ids(A.areasVisibles(areas, 'todas', 'CATASTRO')), [1]);
    assert.deepEqual(ids(A.areasVisibles(areas, 'todas', 'dirección general')), ids(A.areasVisibles(areas, 'todas', 'direccion general')));
    assert.deepEqual(ids(A.areasVisibles(areas, 'todas', 'direccion general')), [1]);
    assert.deepEqual(ids(A.areasVisibles(areas, 'todas', 'transito')), [2]);
  });

  it('busca también por dependencia, email y persona de contacto', () => {
    assert.deepEqual(ids(A.areasVisibles(areas, 'todas', 'secretaria de gobierno')), [2]);
    assert.deepEqual(ids(A.areasVisibles(areas, 'todas', 'transito@')), [2]);
    assert.deepEqual(ids(A.areasVisibles(areas, 'todas', 'otra persona')), [2]);
    assert.deepEqual(ids(A.areasVisibles(areas, 'todas', 'pinventada@')), [1]);
  });

  it('sin búsqueda, todas las del filtro; un filtro desconocido es "Todas"', () => {
    assert.deepEqual(ids(A.areasVisibles(areas, 'todas', '')), [1, 2, 3]);
    assert.deepEqual(ids(A.areasVisibles(areas, 'todas', '   ')), [1, 2, 3]);
    assert.deepEqual(ids(A.areasVisibles(areas, 'externo', '')), [3]);
    assert.deepEqual(ids(A.areasVisibles(areas, 'sin-email', '')), [3]);
    assert.deepEqual(ids(A.areasVisibles(areas, 'constructor', '')), [1, 2, 3]);
  });

  it('el filtro y la búsqueda se combinan', () => {
    assert.deepEqual(ids(A.areasVisibles(areas, 'municipal', 'direccion')), [1, 2]);
    assert.deepEqual(ids(A.areasVisibles(areas, 'externo', 'direccion')), []);
    assert.deepEqual(ids(A.areasVisibles(areas, 'municipal', 'vialidad')), []);
  });
});

describe('areas.js: htmlDeTablaAreas', () => {
  const filaDe = (html) => html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
  const celdas = (html) => [...filaDe(html).matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)].map(([, atributos, adentro]) => ({ atributos, adentro }));

  it('las columnas, en orden', () => {
    const encabezado = A.htmlDeTablaAreas([area()]).match(/<thead>([\s\S]*?)<\/thead>/)[1];
    assert.deepEqual([...encabezado.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(([, adentro]) => textoDe(adentro)),
      ['Área y dependencia', 'Ámbito', 'Emails del área', 'Persona de contacto', 'Datasets', 'Acciones']);
  });

  it('un área completa: nombre, dependencia, ámbito, emails, contacto, datasets y "Editar"', () => {
    const html = A.htmlDeTablaAreas([area({ email_secundario: 'mesa@rpad.test' })]);
    const [nombre, ambito, emails, contacto, datasets, accion] = celdas(html);
    assert.equal(textoDe(nombre.adentro), 'Dirección General de CatastroDepende de la Subsec. de Coordinación Económica y Control de Gestión');
    assert.equal(textoDe(ambito.adentro), 'Municipal');
    assert.match(ambito.adentro, /class="ar-etq municipal"/);
    assert.match(emails.adentro, /catastro@rpad\.test<br>mesa@rpad\.test/);
    assert.equal(textoDe(contacto.adentro), 'Persona Inventada297 411 1111 · pinventada@rpad.test');
    assert.equal(textoDe(datasets.adentro), '3');
    const [editar] = botonesDe(accion.adentro);
    assert.equal(editar.texto, 'Editar');
    assert.equal(editar.atributos['data-editar-area'], '12');
    assert.equal(editar.atributos['aria-label'], 'Editar Dirección General de Catastro');
    assert.equal(editar.atributos.type, 'button');
  });

  it('un nombre con < & o comillas sale escapado en la celda y en el aria-label (Review Focus 1)', () => {
    const html = A.htmlDeTablaAreas([area({ nombre: 'Área <b>&"x"</b>', nombre_contacto: '<i>Persona</i> & "Co"' })]);
    assert.ok(!html.includes('<b>&"x"</b>'));
    assert.ok(!html.includes('<i>Persona</i>'));
    assert.ok(html.includes('<b>Área &lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;</b>'));
    assert.ok(html.includes('aria-label="Editar Área &lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;"'));
    assert.ok(html.includes('&lt;i&gt;Persona&lt;/i&gt; &amp; &quot;Co&quot;'));
  });

  it('sin datasets activos muestra el 0 (no una celda vacía)', () => {
    const html = A.htmlDeTablaAreas([area({ cantidad_datasets: 0 })]);
    assert.match(html, /<td class="num">0<\/td>/);
    assert.ok(html.includes('>0<'));
  });

  it('la dependencia, como la nota del Generador: "la" o sin artículo, "Depende de la …"; "el", "Depende del …"; sin dependencia, "Sin dependencia cargada"', () => {
    assert.ok(A.htmlDeTablaAreas([area({ area_superior: null })]).includes('Sin dependencia cargada'));
    assert.ok(A.htmlDeTablaAreas([area({ articulo_superior: 'la' })]).includes('Depende de la Subsec. de Coordinación'));
    assert.ok(A.htmlDeTablaAreas([area({ articulo_superior: null })]).includes('Depende de la Subsec. de Coordinación'));
    assert.ok(!A.htmlDeTablaAreas([area({ articulo_superior: null })]).includes('Depende de Subsec.'));
    assert.ok(A.htmlDeTablaAreas([area({ articulo_superior: 'el', area_superior: 'Ministerio de Educación del Chubut' })])
      .includes('Depende del Ministerio de Educación del Chubut'));
  });

  it('el ámbito de fuera del municipio', () => {
    const [, ambito] = celdas(A.htmlDeTablaAreas([area({ ambito: 'externo' })]));
    assert.equal(textoDe(ambito.adentro), 'Fuera del municipio');
    assert.match(ambito.adentro, /class="ar-etq externo"/);
  });

  it('la persona de contacto: sin nombre pero con teléfono o email, "Sin nombre" y lo que hay (Review Focus 5)', () => {
    const [, , , contacto] = celdas(A.htmlDeTablaAreas([area({ nombre_contacto: null, telefono_contacto: '297 422 2222', email_contacto: null })]));
    assert.equal(textoDe(contacto.adentro), 'Sin nombre297 422 2222');
    const [, , , conEmail] = celdas(A.htmlDeTablaAreas([area({ nombre_contacto: '  ', telefono_contacto: null, email_contacto: 'x@rpad.test' })]));
    assert.equal(textoDe(conEmail.adentro), 'Sin nombrex@rpad.test');
  });

  it('la persona de contacto: con nombre y sin teléfono ni email; sin ningún dato, "—"', () => {
    const [, , , soloNombre] = celdas(A.htmlDeTablaAreas([area({ telefono_contacto: null, email_contacto: '' })]));
    assert.equal(textoDe(soloNombre.adentro), 'Persona InventadaSin teléfono ni email');
    const [, , , nada] = celdas(A.htmlDeTablaAreas([area({ nombre_contacto: null, telefono_contacto: null, email_contacto: null })]));
    assert.equal(textoDe(nada.adentro), '—');
  });

  it('sin email: la etiqueta roja si le toca el aviso de los 40 días y, si no, "Sin email"', () => {
    const [, , rojo] = celdas(A.htmlDeTablaAreas([sinAviso(5)]));
    assert.equal(textoDe(rojo.adentro), 'Sin email: no recibe el aviso de los 40 días');
    assert.match(rojo.adentro, /class="ar-etq sin-aviso"/);
    const [, , gris] = celdas(A.htmlDeTablaAreas([area({ email_principal: null, email_secundario: null, datasets_externos_con_nota: 0 })]));
    assert.equal(textoDe(gris.adentro), 'Sin email');
    assert.match(gris.adentro, /class="ar-etq sin-email"/);
  });

  it('una fila por área, en el orden que llegan', () => {
    const html = A.htmlDeTablaAreas([area({ id: 2, nombre: 'B' }), area({ id: 1, nombre: 'A' })]);
    assert.deepEqual(botonesDe(html).map((b) => b.atributos['data-editar-area']), ['2', '1']);
  });
});

describe('areas.js: textoPieDelArea (el pie del modal)', () => {
  const vacia = area({ cantidad_datasets: 0, datasets_dados_de_baja: 0, cambios_pendientes_que_la_usan: 0 });

  it('en un alta', () => {
    assert.deepEqual(plano(A.textoPieDelArea(null)), { borrar: false, texto: 'Se guarda al confirmar.' });
  });

  it('sin datasets ni cambios pendientes: el botón de borrar', () => {
    assert.deepEqual(plano(A.textoPieDelArea(vacia)), { borrar: true, texto: '' });
  });

  it('con datasets, activos o dados de baja', () => {
    assert.deepEqual(plano(A.textoPieDelArea({ ...vacia, cantidad_datasets: 1 })),
      { borrar: false, texto: 'Tiene 1 dataset: para borrarla, primero hay que pasarlo a otra área.' });
    assert.deepEqual(plano(A.textoPieDelArea({ ...vacia, cantidad_datasets: 0, datasets_dados_de_baja: 1 })),
      { borrar: false, texto: 'Tiene 1 dataset: para borrarla, primero hay que pasarlo a otra área.' });
    assert.deepEqual(plano(A.textoPieDelArea({ ...vacia, cantidad_datasets: 2, datasets_dados_de_baja: 1 })),
      { borrar: false, texto: 'Tiene 3 datasets: para borrarla, primero hay que pasarlos a otra área.' });
    assert.deepEqual(plano(A.textoPieDelArea({ ...vacia, cantidad_datasets: 2, cambios_pendientes_que_la_usan: 1 })),
      { borrar: false, texto: 'Tiene 2 datasets: para borrarla, primero hay que pasarlos a otra área.' });
  });

  it('sin datasets y con cambios pendientes que la usan', () => {
    assert.deepEqual(plano(A.textoPieDelArea({ ...vacia, cambios_pendientes_que_la_usan: 1 })),
      { borrar: false, texto: 'Un cambio pendiente la usa: para borrarla, primero hay que aprobarlo o rechazarlo.' });
    assert.deepEqual(plano(A.textoPieDelArea({ ...vacia, cambios_pendientes_que_la_usan: 2 })),
      { borrar: false, texto: '2 cambios pendientes la usan: para borrarla, primero hay que aprobarlos o rechazarlos.' });
  });
});

describe('areas.js: lo que se manda al guardar', () => {
  const ID_DE_CAMPO = {
    nombre: 'a-nombre', articulo: 'a-articulo', area_superior: 'a-superior', articulo_superior: 'a-articulo-superior',
    ambito: 'a-ambito', email_principal: 'a-email-principal', email_secundario: 'a-email-secundario', telefono_area: 'a-telefono',
    celular_area: 'a-celular', nombre_contacto: 'a-contacto', telefono_contacto: 'a-contacto-telefono', email_contacto: 'a-contacto-email'
  };
  // El formulario de un área, como lo deja abrirModalArea (lo vacío, '')
  const formularioDe = (a) => Object.fromEntries(Object.entries(ID_DE_CAMPO).map(([campo, id]) => [id, a[campo] ?? '']));
  const datosDe = (valores) => A.datosDelFormularioArea((id) => valores[id]);

  it('datosDelFormularioArea: los 12 campos, recortados, y lo vacío en null', () => {
    const datos = plano(datosDe({ ...formularioDe(AREA), 'a-nombre': '  Dirección X  ', 'a-superior': '   ', 'a-articulo-superior': '',
      'a-email-principal': ' mesa@rpad.test ', 'a-celular': '' }));
    assert.deepEqual(Object.keys(datos).sort(), Object.keys(ID_DE_CAMPO).sort());
    assert.equal(datos.nombre, 'Dirección X');
    assert.equal(datos.area_superior, null);
    assert.equal(datos.articulo_superior, null);
    assert.equal(datos.email_principal, 'mesa@rpad.test');
    assert.equal(datos.celular_area, null);
    assert.equal(datos.ambito, 'municipal');
    assert.equal(datos.articulo, 'la');
  });

  it('datosDelFormularioArea: un campo que no se puede leer cuenta como vacío', () => {
    const datos = plano(A.datosDelFormularioArea(() => undefined));
    assert.equal(datos.nombre, '');
    assert.equal(datos.email_principal, null);
    assert.equal(Object.keys(datos).length, 12);
  });

  it('cambiosDelArea: el formulario igual al área no cambia nada', () => {
    assert.deepEqual(plano(A.cambiosDelArea(datosDe(formularioDe(AREA)), AREA)), {});
  });

  it('cambiosDelArea: solo espacios de más no es un cambio (Review Focus 3)', () => {
    const conMesa = area({ email_secundario: 'mesa@x.gob.ar' });
    assert.deepEqual(plano(A.cambiosDelArea({ ...datosDe(formularioDe(conMesa)), email_secundario: ' mesa@x.gob.ar ' }, conMesa)), {});
    assert.deepEqual(plano(A.cambiosDelArea(datosDe({ ...formularioDe(conMesa), 'a-email-secundario': ' mesa@x.gob.ar ' }), conMesa)), {});
    // Al revés: lo guardado con espacios en los extremos (el servidor compara igual, normalizado) y el formulario recortado
    const guardadaConEspacios = area({ email_secundario: ' mesa@x.gob.ar ', telefono_area: '' });
    assert.deepEqual(plano(A.cambiosDelArea(datosDe({ ...formularioDe(AREA), 'a-email-secundario': 'mesa@x.gob.ar', 'a-telefono': '' }), guardadaConEspacios)), {});
  });

  it("cambiosDelArea: '' contra null no es un cambio (Review Focus 3)", () => {
    assert.equal(AREA.celular_area, null);
    assert.deepEqual(plano(A.cambiosDelArea({ ...datosDe(formularioDe(AREA)), celular_area: '' }, AREA)), {});
    // Un campo que el área no trae (una vista incompleta) y el formulario vacío: tampoco
    const { celular_area: _, ...sinCelular } = AREA;
    assert.deepEqual(plano(A.cambiosDelArea(datosDe(formularioDe(AREA)), sinCelular)), {});
  });

  it('cambiosDelArea: un teléfono nuevo', () => {
    assert.deepEqual(plano(A.cambiosDelArea({ ...datosDe(formularioDe(AREA)), telefono_area: '297 1' }, AREA)), { telefono_area: '297 1' });
    assert.deepEqual(plano(A.cambiosDelArea(datosDe({ ...formularioDe(AREA), 'a-telefono': ' 297 1 ' }), AREA)), { telefono_area: '297 1' });
  });

  it("cambiosDelArea: la dependencia sin artículo ('la' → '') va en null", () => {
    assert.deepEqual(plano(A.cambiosDelArea({ ...datosDe(formularioDe(AREA)), articulo_superior: '' }, AREA)), { articulo_superior: null });
  });

  it('cambiosDelArea: varios cambios juntos, vaciar un campo y el ámbito', () => {
    const datos = datosDe({ ...formularioDe(AREA), 'a-nombre': 'Dirección de Catastro', 'a-contacto': '', 'a-ambito': 'externo' });
    assert.deepEqual(plano(A.cambiosDelArea(datos, AREA)), { nombre: 'Dirección de Catastro', ambito: 'externo', nombre_contacto: null });
  });
});

describe('areas.js: esVistaDeAdministracion', () => {
  it('solo con la marca de la vista', () => {
    assert.equal(A.esVistaDeAdministracion({ success: true, data: [], vista: 'administracion' }), true);
    assert.equal(A.esVistaDeAdministracion({ success: true, data: [] }), false);
    assert.equal(A.esVistaDeAdministracion({ success: true, data: [], vista: 'publica' }), false);
    assert.equal(A.esVistaDeAdministracion({ success: true, vista: 'administracion' }), false);
    assert.equal(A.esVistaDeAdministracion(null), false);
    assert.equal(A.esVistaDeAdministracion(undefined), false);
  });
});

// ======================================================================
// Con un DOM falso: la carga de la lista, el modal y el guardado
// ======================================================================

// Una página falsa con lo justo: cada id es un elemento (se crea al pedirlo) y los dos radios del ámbito. `responder(metodo,
// ruta, cuerpo)` contesta cada API.pedirJson (si tira, el pedido falla); `pedidos` los registra
const crearPagina = ({ responder = async () => ({ success: true, data: [], vista: 'administracion' }), admin = true } = {}) => {
  const pagina = { foco: null };
  const nuevo = (id, extra = {}) => {
    const clases = new Set();
    return {
      id, value: '', textContent: '', innerHTML: '', hidden: false, disabled: false, checked: false, isConnected: true,
      atributos: {}, dataset: {}, oyentes: {},
      setAttribute(clave, valor) { this.atributos[clave] = String(valor); },
      removeAttribute(clave) { delete this.atributos[clave]; },
      getAttribute(clave) { return this.atributos[clave] ?? null; },
      classList: {
        add: (c) => clases.add(c), remove: (c) => clases.delete(c), contains: (c) => clases.has(c),
        toggle: (c, si = !clases.has(c)) => (si ? clases.add(c) : clases.delete(c))
      },
      addEventListener(tipo, fn) { (this.oyentes[tipo] ??= []).push(fn); },
      focus() { pagina.foco = this; },
      querySelector: () => null,
      querySelectorAll: () => [],
      ...extra
    };
  };
  const elementos = new Map();
  const elemento = (id) => {
    if (!elementos.has(id)) elementos.set(id, nuevo(id));
    return elementos.get(id);
  };
  const radios = ['municipal', 'externo'].map((value) => nuevo(`a-ambito-${value}`, { value }));
  const oyentesDelDocumento = {};
  const document = {
    addEventListener(tipo, fn) { (oyentesDelDocumento[tipo] ??= []).push(fn); },
    getElementById: elemento,
    querySelectorAll: (selector) => (selector === 'input[name="a-ambito"]' ? radios : []),
    querySelector: (selector) => {
      if (selector === 'input[name="a-ambito"]:checked') return radios.find((r) => r.checked) ?? null;
      return null;
    },
    get activeElement() { return pagina.foco; }
  };
  const pedidos = [];
  const avisos = [];
  const contexto = vm.createContext({
    CONFIG: { API_URL: '/api' }, console, document, window: { location: {} },
    Auth: { isAuthenticated: () => true, isAdmin: () => admin },
    showToast: (mensaje, tipo) => avisos.push([mensaje, tipo]),
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout() {}
  });
  vm.runInContext(leer('js/api.js'), contexto);
  vm.runInContext(leer('js/areas.js'), contexto);
  contexto.__pedir = async (metodo, ruta, cuerpo) => {
    pedidos.push({ metodo, ruta, cuerpo: cuerpo === undefined ? undefined : JSON.parse(JSON.stringify(cuerpo)) });
    return responder(metodo, ruta, cuerpo);
  };
  vm.runInContext('API.pedirJson = __pedir', contexto);
  const alCargar = () => (oyentesDelDocumento.DOMContentLoaded ?? []).forEach((fn) => fn());
  const escape = () => (oyentesDelDocumento.keydown ?? []).forEach((fn) => fn({ key: 'Escape' }));
  return { contexto, elemento, radios, pedidos, avisos, pagina, alCargar, escape, oyentesDelDocumento };
};

// Un error como el que tira API.pedirJson
const falla = (status, mensaje, campo) => Object.assign(new Error(mensaje), { status, campo });
const LISTA = Object.freeze({ success: true, data: [AREA, sinAviso(30)], vista: 'administracion' });
const conLista = (otras = async () => ({ success: true, message: 'Área actualizada correctamente' })) =>
  crearPagina({ responder: async (metodo, ruta, cuerpo) => (metodo === 'GET' ? LISTA : otras(metodo, ruta, cuerpo)) });

describe('areas.js con un DOM: cargarAreas', () => {
  it('con la vista de administración pinta la tabla, el contador, los filtros y el aviso', async () => {
    const { contexto, elemento, pedidos } = conLista();
    elemento('btn-nueva-area').disabled = true;
    await contexto.cargarAreas();
    assert.deepEqual(pedidos.map((p) => [p.metodo, p.ruta]), [['GET', '/areas']]);
    assert.match(elemento('areas-lista').innerHTML, /<table class="ar-tabla">/);
    assert.equal(elemento('areas-contador').textContent, '2 áreas');
    assert.match(elemento('areas-filtros').innerHTML, /data-filtro-area="sin-email"/);
    assert.equal(elemento('areas-aviso').hidden, false);
    assert.ok(elemento('areas-aviso').innerHTML.includes('1 área con datasets de gestión externa no tiene email cargado'));
    assert.ok(elemento('areas-aviso').innerHTML.includes('Ver las áreas sin email'));
    assert.equal(elemento('areas-vacio').hidden, true);
    assert.equal(elemento('btn-nueva-area').disabled, false);
  });

  it('se pide una sola vez; con forzar, otra', async () => {
    const { contexto, pedidos } = conLista();
    await contexto.cargarAreas();
    await contexto.cargarAreas();
    assert.equal(pedidos.length, 1);
    await contexto.cargarAreas(true);
    assert.equal(pedidos.length, 2);
  });

  it('dos aperturas seguidas, mientras llega la respuesta, hacen un solo pedido', async () => {
    const { contexto, pedidos } = conLista();
    await Promise.all([contexto.cargarAreas(), contexto.cargarAreas()]);
    assert.equal(pedidos.length, 1);
  });

  it('sin la marca de la vista: el aviso de la sesión con un link a login.html, sin tabla ni aviso, y "Nueva área" deshabilitado', async () => {
    const { contexto, elemento } = crearPagina({ responder: async () => ({ success: true, data: [{ id: 1, nombre: 'X', cantidad_datasets: 0 }] }) });
    await contexto.cargarAreas();
    const lista = elemento('areas-lista').innerHTML;
    assert.match(lista, /^<p class="aviso aviso-error">/);
    assert.match(lista, /href="login\.html"/);
    assert.equal(textoDe(lista), 'Tu sesión ya no permite ver las áreas. Volvé a ingresar.');
    assert.ok(!lista.includes('<table'));
    assert.equal(elemento('areas-aviso').hidden, true);
    assert.equal(elemento('areas-vacio').hidden, true);
    assert.equal(elemento('btn-nueva-area').disabled, true);
  });

  it('si el pedido falla: el error, nunca una lista vacía', async () => {
    const { contexto, elemento } = crearPagina({ responder: async () => { throw falla(500, 'Error al obtener las áreas'); } });
    await contexto.cargarAreas();
    const lista = elemento('areas-lista').innerHTML;
    assert.match(lista, /^<p class="aviso aviso-error">/);
    assert.equal(textoDe(lista), 'No se pudieron cargar las áreas. Probá de nuevo en unos minutos.');
    assert.equal(elemento('areas-aviso').hidden, true);
    assert.equal(elemento('areas-vacio').hidden, true);
  });

  it('después de un error, volver a abrir la pestaña lo vuelve a pedir', async () => {
    let primera = true;
    const { contexto, pedidos, elemento } = crearPagina({
      responder: async () => { if (primera) { primera = false; throw falla(500, 'x'); } return LISTA; }
    });
    await contexto.cargarAreas();
    await contexto.cargarAreas();
    assert.equal(pedidos.length, 2);
    assert.match(elemento('areas-lista').innerHTML, /<table/);
  });

  it('sin coincidencias, "Ninguna área coincide con lo que buscaste." y sin tabla', async () => {
    const { contexto, elemento } = conLista();
    await contexto.cargarAreas();
    elemento('buscar-area').value = 'no existe';
    contexto.pintarAreas();
    assert.equal(elemento('areas-vacio').hidden, false);
    assert.equal(elemento('areas-lista').innerHTML, '');
    assert.equal(elemento('areas-contador').textContent, '2 áreas', 'el contador es del total');
    elemento('buscar-area').value = 'CATASTRO';
    contexto.pintarAreas();
    assert.equal(elemento('areas-vacio').hidden, true);
    assert.equal(botonesDe(elemento('areas-lista').innerHTML).length, 1);
  });
});

describe('areas.js con un DOM: el modal y guardar', () => {
  const abrir = async (pagina, a = AREA) => {
    await pagina.contexto.cargarAreas();
    const boton = pagina.elemento('boton-editar');
    pagina.contexto.abrirModalArea(a, boton);
    return boton;
  };

  it('abrir para editar: los campos del área, "Así se lee", el pie y el foco al nombre', async () => {
    const pagina = conLista();
    await abrir(pagina, area({ nombre: 'Área <b>&"x"</b>' }));
    const { elemento, radios } = pagina;
    assert.equal(elemento('modal-area').classList.contains('active'), true);
    assert.equal(elemento('modal-area-titulo').textContent, 'Editar área');
    assert.equal(elemento('a-nombre').value, 'Área <b>&"x"</b>');
    assert.equal(elemento('a-celular').value, '');
    assert.equal(elemento('a-articulo-superior').value, 'la');
    assert.deepEqual(radios.map((r) => r.checked), [true, false]);
    assert.equal(elemento('a-lectura').textContent, 'la Área <b>&"x"</b>, dependiente de la Subsec. de Coordinación Económica y Control de Gestión');
    assert.equal(textoDe(elemento('area-pie-izquierda').innerHTML), 'Tiene 3 datasets: para borrarla, primero hay que pasarlos a otra área.');
    assert.equal(pagina.pagina.foco, elemento('a-nombre'));
  });

  it('abrir un alta: vacío, "la", Municipal y "Se guarda al confirmar."', async () => {
    const pagina = conLista();
    await pagina.contexto.cargarAreas();
    pagina.contexto.abrirModalArea(null, pagina.elemento('btn-nueva-area'));
    assert.equal(pagina.elemento('modal-area-titulo').textContent, 'Nueva área');
    assert.equal(pagina.elemento('a-nombre').value, '');
    assert.equal(pagina.elemento('a-articulo').value, 'la');
    assert.equal(pagina.elemento('a-articulo-superior').value, '');
    assert.deepEqual(pagina.radios.map((r) => r.checked), [true, false]);
    assert.equal(pagina.elemento('a-lectura').textContent, 'la …');
    assert.equal(textoDe(pagina.elemento('area-pie-izquierda').innerHTML), 'Se guarda al confirmar.');
  });

  it('un área sin datasets ni cambios pendientes: el botón "Borrar el área"', async () => {
    const pagina = conLista();
    await abrir(pagina, area({ cantidad_datasets: 0, datasets_dados_de_baja: 0 }));
    const [borrar] = botonesDe(pagina.elemento('area-pie-izquierda').innerHTML);
    assert.equal(borrar.texto, 'Borrar el área');
    assert.equal(borrar.atributos['data-borrar-area'], '12');
  });

  it('editar sin cambiar nada: se cierra sin pedir nada y el foco vuelve al botón', async () => {
    const pagina = conLista();
    const boton = await abrir(pagina);
    await pagina.contexto.guardarArea();
    assert.deepEqual(pagina.pedidos.map((p) => p.metodo), ['GET']);
    assert.equal(pagina.elemento('modal-area').classList.contains('active'), false);
    assert.equal(pagina.pagina.foco, boton);
  });

  it('editar solo agregando espacios o vaciando lo que era NULL: tampoco pide nada (Review Focus 3)', async () => {
    const pagina = conLista();
    await abrir(pagina);
    pagina.elemento('a-email-principal').value = '  catastro@rpad.test  ';
    pagina.elemento('a-celular').value = '   ';
    await pagina.contexto.guardarArea();
    assert.deepEqual(pagina.pedidos.map((p) => p.metodo), ['GET']);
  });

  it('editar un campo: PUT con solo lo que cambió, el aviso del servidor y la lista otra vez', async () => {
    const pagina = conLista();
    await abrir(pagina);
    pagina.elemento('a-telefono').value = ' 297 1 ';
    await pagina.contexto.guardarArea();
    assert.deepEqual(pagina.pedidos.map((p) => [p.metodo, p.ruta]), [['GET', '/areas'], ['PUT', '/areas/12'], ['GET', '/areas']]);
    assert.deepEqual(pagina.pedidos[1].cuerpo, { telefono_area: '297 1' });
    assert.deepEqual(pagina.avisos, [['Área actualizada correctamente', 'success']]);
    assert.equal(pagina.elemento('modal-area').classList.contains('active'), false);
  });

  it('el aviso del servidor se escapa (showToast inserta HTML)', async () => {
    const pagina = conLista(async () => ({ success: true, message: '<b>listo</b>' }));
    await abrir(pagina);
    pagina.elemento('a-telefono').value = '297 1';
    await pagina.contexto.guardarArea();
    assert.deepEqual(pagina.avisos, [['&lt;b&gt;listo&lt;/b&gt;', 'success']]);
  });

  it('un alta: POST con los 12 campos', async () => {
    const pagina = conLista(async () => ({ success: true, message: 'Área creada correctamente' }));
    await pagina.contexto.cargarAreas();
    pagina.contexto.abrirModalArea(null, pagina.elemento('btn-nueva-area'));
    pagina.elemento('a-nombre').value = '  Dirección Nueva ';
    pagina.radios[1].checked = true;
    pagina.radios[0].checked = false;
    await pagina.contexto.guardarArea();
    assert.deepEqual(pagina.pedidos.map((p) => [p.metodo, p.ruta]), [['GET', '/areas'], ['POST', '/areas'], ['GET', '/areas']]);
    assert.deepEqual(pagina.pedidos[1].cuerpo, {
      nombre: 'Dirección Nueva', articulo: 'la', area_superior: null, articulo_superior: null, ambito: 'externo',
      email_principal: null, email_secundario: null, telefono_area: null, celular_area: null, nombre_contacto: null,
      telefono_contacto: null, email_contacto: null
    });
  });

  it('el nombre vacío: el error debajo del nombre, con el mensaje del servidor, y no se pide nada', async () => {
    const pagina = conLista();
    await abrir(pagina);
    pagina.elemento('a-nombre').value = '   ';
    await pagina.contexto.guardarArea();
    assert.deepEqual(pagina.pedidos.map((p) => p.metodo), ['GET']);
    assert.equal(pagina.elemento('a-nombre-error').textContent, MENSAJES_AREA.nombre);
    assert.equal(pagina.elemento('a-nombre-error').hidden, false);
    assert.equal(pagina.elemento('a-nombre').atributos['aria-invalid'], 'true');
    assert.equal(pagina.pagina.foco, pagina.elemento('a-nombre'));
    assert.equal(pagina.elemento('modal-area').classList.contains('active'), true);
  });

  it('un error con campo va a ese campo; el del ámbito, debajo de las dos opciones', async () => {
    const pagina = conLista(async () => { throw falla(400, 'Elegí si el área es municipal o de fuera del municipio.', 'ambito'); });
    await abrir(pagina);
    pagina.radios[0].checked = false;
    await pagina.contexto.guardarArea();
    assert.equal(pagina.elemento('a-ambito-error').textContent, 'Elegí si el área es municipal o de fuera del municipio.');
    assert.equal(pagina.elemento('a-ambito-error').hidden, false);
    assert.deepEqual(pagina.radios.map((r) => r.atributos['aria-invalid']), ['true', 'true']);
    assert.equal(pagina.pagina.foco, pagina.radios[0]);
    assert.equal(pagina.elemento('area-error').hidden, true);
    assert.equal(pagina.elemento('area-guardar').disabled, false);
  });

  it('un email que no sirve va a su campo', async () => {
    const pagina = conLista(async () => { throw falla(400, MENSAJES_AREA.email, 'email_principal'); });
    await abrir(pagina);
    pagina.elemento('a-email-principal').value = 'no-es-un-email';
    await pagina.contexto.guardarArea();
    assert.equal(pagina.elemento('a-email-principal-error').textContent, MENSAJES_AREA.email);
    assert.equal(pagina.elemento('a-email-principal').atributos['aria-invalid'], 'true');
    assert.equal(pagina.pagina.foco, pagina.elemento('a-email-principal'));
    assert.deepEqual(pagina.pedidos.map((p) => p.metodo), ['GET', 'PUT']);
  });

  it('un error sin campo (o de un campo sin lugar propio) va al aviso de arriba del cuerpo', async () => {
    const pagina = conLista(async () => { throw falla(400, MENSAJES_AREA.largo(50), 'telefono_area'); });
    await abrir(pagina);
    pagina.elemento('a-telefono').value = '297 1';
    await pagina.contexto.guardarArea();
    assert.equal(pagina.elemento('area-error').textContent, 'Puede tener hasta 50 caracteres.');
    assert.equal(pagina.elemento('area-error').hidden, false);
    assert.equal(pagina.elemento('modal-area').classList.contains('active'), true);
  });

  it('el siguiente intento limpia los errores anteriores', async () => {
    let vez = 0;
    const pagina = conLista(async () => { vez += 1; if (vez === 1) throw falla(400, MENSAJES_AREA.email, 'email_principal'); return { success: true, message: 'ok' }; });
    await abrir(pagina);
    pagina.elemento('a-email-principal').value = 'no-es-un-email';
    await pagina.contexto.guardarArea();
    pagina.elemento('a-email-principal').value = 'bien@rpad.test';
    await pagina.contexto.guardarArea();
    assert.equal(pagina.elemento('a-email-principal-error').hidden, true);
    assert.equal(pagina.elemento('a-email-principal').atributos['aria-invalid'], undefined);
  });

  for (const status of [401, 403]) {
    it(`un guardado que responde ${status}: el mensaje de la sesión en el modal y la lista no se vuelve a pedir`, async () => {
      const pagina = conLista(async () => { throw falla(status, 'La sesión ya no es válida. Iniciá sesión nuevamente.'); });
      await abrir(pagina);
      pagina.elemento('a-telefono').value = '297 1';
      await pagina.contexto.guardarArea();
      assert.deepEqual(pagina.pedidos.map((p) => p.metodo), ['GET', 'PUT']);
      assert.equal(pagina.elemento('area-error').hidden, false);
      assert.equal(textoDe(pagina.elemento('area-error').innerHTML), 'Tu sesión ya no permite ver las áreas. Volvé a ingresar.');
      assert.match(pagina.elemento('area-error').innerHTML, /href="login\.html"/);
      assert.equal(pagina.elemento('modal-area').classList.contains('active'), true);
    });
  }
});

describe('areas.js con un DOM: borrar', () => {
  const VACIA = area({ id: 40, nombre: 'Área «vacía»', cantidad_datasets: 0, datasets_dados_de_baja: 0 });
  const conVacia = (borrar) => crearPagina({
    responder: async (metodo) => (metodo === 'GET' ? { success: true, data: [AREA, VACIA], vista: 'administracion' } : borrar())
  });
  const pedirBorrado = async (pagina) => {
    await pagina.contexto.cargarAreas();
    pagina.contexto.abrirModalArea(VACIA, pagina.elemento('boton-editar'));
    const origen = pagina.elemento('boton-borrar');
    pagina.contexto.pedirBorradoArea(40, origen);
    return origen;
  };

  it('pedir el borrado: la pregunta, el foco a "Cancelar"; cancelar devuelve el foco y deja abierto el del área', async () => {
    const pagina = conVacia(async () => ({ success: true }));
    const cancelar = pagina.elemento('cancelar-borrado');
    pagina.elemento('modal-borrar-area').querySelector = (selector) => (selector.includes('data-cerrar-borrar') ? cancelar : null);
    const origen = await pedirBorrado(pagina);
    assert.equal(pagina.elemento('borrar-area-texto').textContent,
      '¿Borrar el área «Área «vacía»»? No tiene datasets. Se borra del todo y no se puede deshacer.');
    assert.equal(pagina.elemento('modal-borrar-area').classList.contains('active'), true);
    assert.equal(pagina.pagina.foco, cancelar);
    pagina.contexto.cerrarModalBorrarArea();
    assert.equal(pagina.elemento('modal-borrar-area').classList.contains('active'), false);
    assert.equal(pagina.elemento('modal-area').classList.contains('active'), true);
    assert.equal(pagina.pagina.foco, origen);
  });

  it('confirmar: DELETE, se cierran los dos modales y se vuelve a pedir la lista', async () => {
    const pagina = conVacia(async () => ({ success: true, message: 'Área eliminada correctamente' }));
    await pedirBorrado(pagina);
    await pagina.contexto.confirmarBorradoArea();
    assert.deepEqual(pagina.pedidos.map((p) => [p.metodo, p.ruta]), [['GET', '/areas'], ['DELETE', '/areas/40'], ['GET', '/areas']]);
    assert.equal(pagina.elemento('modal-borrar-area').classList.contains('active'), false);
    assert.equal(pagina.elemento('modal-area').classList.contains('active'), false);
    assert.deepEqual(pagina.avisos, [['Área eliminada correctamente', 'success']]);
  });

  it('si el servidor lo rechaza, el mensaje en el modal de borrar', async () => {
    const mensaje = 'No se puede borrar el área: un cambio pendiente la usa. Primero hay que aprobarlo o rechazarlo.';
    const pagina = conVacia(async () => { throw falla(400, mensaje); });
    await pedirBorrado(pagina);
    await pagina.contexto.confirmarBorradoArea();
    assert.equal(pagina.elemento('borrar-area-error').textContent, mensaje);
    assert.equal(pagina.elemento('borrar-area-error').hidden, false);
    assert.equal(pagina.elemento('modal-borrar-area').classList.contains('active'), true);
    assert.deepEqual(pagina.pedidos.map((p) => p.metodo), ['GET', 'DELETE']);
    assert.equal(pagina.elemento('borrar-area-confirmar').disabled, false);
  });

  it('un borrado que responde 401: el mensaje de la sesión y la lista no se vuelve a pedir', async () => {
    const pagina = conVacia(async () => { throw falla(401, 'Token inválido o expirado'); });
    await pedirBorrado(pagina);
    await pagina.contexto.confirmarBorradoArea();
    assert.equal(textoDe(pagina.elemento('borrar-area-error').innerHTML), 'Tu sesión ya no permite ver las áreas. Volvé a ingresar.');
    assert.deepEqual(pagina.pedidos.map((p) => p.metodo), ['GET', 'DELETE']);
  });
});

describe('areas.js con un DOM: los oyentes y Escape', () => {
  it('con administración, los oyentes se registran en el DOMContentLoaded', () => {
    const pagina = crearPagina();
    pagina.alCargar();
    for (const [id, tipo] of [['vista-areas', 'click'], ['modal-area', 'click'], ['modal-borrar-area', 'click'], ['buscar-area', 'input'],
      ['btn-nueva-area', 'click'], ['area-guardar', 'click'], ['borrar-area-confirmar', 'click'], ['a-nombre', 'input']]) {
      assert.ok(pagina.elemento(id).oyentes[tipo]?.length, `${id} ${tipo}`);
    }
    assert.equal(pagina.oyentesDelDocumento.keydown?.length, 1);
  });

  it('Escape cierra primero el de borrar y después el del área', async () => {
    const pagina = crearPagina({
      responder: async () => ({ success: true, data: [area({ cantidad_datasets: 0, datasets_dados_de_baja: 0 })], vista: 'administracion' })
    });
    pagina.alCargar();
    await pagina.contexto.cargarAreas();
    pagina.contexto.abrirModalArea(area({ cantidad_datasets: 0, datasets_dados_de_baja: 0 }), pagina.elemento('boton-editar'));
    pagina.contexto.pedirBorradoArea(12, pagina.elemento('boton-borrar'));
    pagina.escape();
    assert.equal(pagina.elemento('modal-borrar-area').classList.contains('active'), false);
    assert.equal(pagina.elemento('modal-area').classList.contains('active'), true);
    pagina.escape();
    assert.equal(pagina.elemento('modal-area').classList.contains('active'), false);
    assert.equal(pagina.pagina.foco, pagina.elemento('boton-editar'));
  });

  it('un clic en un filtro lo elige y deja el foco en él; el botón del aviso elige "Sin email"', async () => {
    const pagina = conLista();
    pagina.alCargar();
    await pagina.contexto.cargarAreas();
    const clic = (atributos) => {
      const objetivo = { closest: (selector) => {
        const clave = selector.match(/^\[([\w-]+)\]$/)?.[1];
        return clave && atributos[clave] !== undefined ? { dataset: { filtroArea: atributos[clave] } } : null;
      } };
      pagina.elemento('vista-areas').oyentes.click.forEach((fn) => fn({ target: objetivo }));
    };
    clic({ 'data-filtro-area': 'sin-email' });
    assert.match(pagina.elemento('areas-filtros').innerHTML, /data-filtro-area="sin-email" aria-pressed="true"|aria-pressed="true"[^>]*data-filtro-area="sin-email"/);
    assert.equal(botonesDe(pagina.elemento('areas-lista').innerHTML).length, 1, 'una sola área sin email');
    clic({ 'data-filtro-area': 'todas' });
    assert.equal(botonesDe(pagina.elemento('areas-lista').innerHTML).length, 2);
  });
});
