// La pestaña Feriados de Configuración (spec 2026-10-26-feriados, 4), ejecutada en Node: lo puro de public/js/feriados.js (las
// copias del servidor, los filtros con sus cantidades, el selector del año y la tabla, con las aclaraciones y el escapado) y, con un
// DOM falso, la carga de cada año, los filtros, el selector y lo que se anuncia. Como areas.js, el script al cargarse solo declara:
// se carga en un vm con un document que no hace nada, junto con el api.js de verdad (Utils.escapeHtml). La lista de cada año la arma
// feriadosDelAnio del servidor, con filas inventadas.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import { MENSAJES_FERIADO, NOMBRES_TIPO_FERIADO, diaDeLaSemana, feriadosDelAnio } from '../services/feriadosReglas.js';

const leer = (ruta) => fs.readFileSync(new URL(`../public/${ruta}`, import.meta.url), 'utf8');

// Un contexto con api.js y feriados.js. `document` registra cada vez que alguien lo consulta
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
  vm.runInContext(leer('js/feriados.js'), contexto);
  return { contexto, consultas, oyentes };
};

// Lo que devuelve una función del vm es de otro contexto: deepStrictEqual compara prototipos, así que se pasa a uno de acá
const plano = (valor) => JSON.parse(JSON.stringify(valor));
const { contexto: ctx } = cargar();
const en = (expresion) => vm.runInContext(expresion, ctx);
// Las funciones y constantes del script (las declaradas con const no son propiedades del global del vm)
const F = new Proxy({}, { get: (_, nombre) => en(nombre) });

// Una fila de la base, como la devuelve services/feriadosDatos.js (datos inventados)
const fila = (datos) => ({
  id: 1, fecha: '2026-02-16', nombre: 'Feriado', tipo: 'nacional', trasladado_de: null, se_repite: 0, hasta_anio: null,
  activo: 1, no_rige: [], ...datos
});
// Las de la lista de las reglas (tests/feriados-reglas.test.js): el Jueves Santo el día de Malvinas, un trasladado, uno que se
// repite y cae domingo y uno que se repite y en 2026 no rige
const JUEVES_SANTO = fila({ id: 10, fecha: '2026-04-02', nombre: 'Jueves Santo', tipo: 'no_laborable' });
const TRASLADADO = fila({ id: 11, fecha: '2026-06-15', nombre: 'Paso a la Inmortalidad de Güemes', trasladado_de: '2026-06-17' });
const EMPLEADO_MUNICIPAL = fila({ id: 12, fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', se_repite: 1 });
const ANIVERSARIO_SIN_2026 = fila({
  id: 13, fecha: '2026-02-23', nombre: 'Aniversario de la ciudad', tipo: 'municipal', se_repite: 1, no_rige: [2026]
});
const FILAS = [EMPLEADO_MUNICIPAL, TRASLADADO, ANIVERSARIO_SIN_2026, JUEVES_SANTO];
// Lo que manda GET /api/feriados de cada año: la lista de feriadosDelAnio, tal cual
const LISTA_2026 = plano(feriadosDelAnio(FILAS, 2026));
const LISTA_2027 = plano(feriadosDelAnio(FILAS, 2027));
const respuestaDe = (anio, feriados, anios = [2026, 2027]) => ({ success: true, data: { anio, anios, feriados } });
const RESPUESTA_2026 = respuestaDe(2026, LISTA_2026);
const RESPUESTA_2027 = respuestaDe(2027, LISTA_2027);

// El texto que se ve de un pedazo de HTML (sin las etiquetas, con las entidades de escapeHtml resueltas)
const textoDe = (html) => html.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const atributosDe = (texto) => Object.fromEntries([...texto.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, clave, valor]) => [clave, valor]));
// Los botones de un HTML: { atributos, texto, html }
const botonesDe = (html) => [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map(([, atributos, adentro]) => ({
  atributos: atributosDe(atributos),
  texto: textoDe(adentro).replace(/\s+/g, ' ').trim(),
  html: adentro
}));
// Las filas del cuerpo de una tabla: { atributos, celdas (el HTML de cada <td>), textos (lo que se ve de cada una) }
const filasDe = (html) => [...(html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '').matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)]
  .map(([, atributos, adentro]) => {
    const celdas = [...adentro.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    return { atributos: atributosDe(atributos), celdas, textos: celdas.map((celda) => textoDe(celda).trim()) };
  });
// La fila de la tabla de un feriado de la lista, por su fecha y su nombre
const filaDeLaTabla = (html, nombre) => filasDe(html).find((f) => f.celdas[1].includes(`>${nombre}<`));

describe('feriados.js: al cargarse', () => {
  it('no toca el DOM: solo declara y espera el DOMContentLoaded', () => {
    const { consultas, oyentes } = cargar();
    assert.deepEqual(consultas, []);
    assert.deepEqual(oyentes, ['DOMContentLoaded']);
  });

  it('el DOMContentLoaded no hace nada si Auth.isAdmin() no es true (solo el true literal)', () => {
    for (const valor of [false, undefined, 1, 'true', null]) {
      let alCargar = null;
      const consultas = [];
      const contexto = vm.createContext({
        CONFIG: { API_URL: '/api' }, console, window: { location: {} }, showToast() {},
        Auth: { isAuthenticated: () => true, isAdmin: () => valor },
        document: {
          addEventListener: (tipo, fn) => { if (tipo === 'DOMContentLoaded') alCargar = fn; },
          getElementById: (id) => { consultas.push(id); return null; },
          querySelector: (selector) => { consultas.push(selector); return null; },
          querySelectorAll: (selector) => { consultas.push(selector); return []; }
        }
      });
      vm.runInContext(leer('js/api.js'), contexto);
      vm.runInContext(leer('js/feriados.js'), contexto);
      assert.equal(typeof alCargar, 'function', String(valor));
      alCargar();
      assert.deepEqual(consultas, [], String(valor));
    }
  });
});

describe('feriados.js: convive con los otros scripts de la página', () => {
  const nombresDe = (archivo) => [...leer(`js/${archivo}`).matchAll(/^(?:const|let|var|function|async function|class) (\w+)/gm)]
    .map(([, nombre]) => nombre);

  it('todos sus nombres de nivel superior llevan Feriado o Feriados, y ninguno se declara dos veces', () => {
    const propios = nombresDe('feriados.js');
    assert.ok(propios.length > 20, 'el regex encuentra los nombres de feriados.js');
    assert.equal(new Set(propios).size, propios.length);
    assert.deepEqual(propios.filter((nombre) => !/feriado/i.test(nombre)), []);
  });

  it('no usa los atributos que escuchan usuarios.js (data-ver, data-licencia, data-vista) ni areas.js', () => {
    const fuente = leer('js/feriados.js');
    for (const atributo of ['data-ver', 'data-licencia', 'data-vista', 'dataset.ver', 'dataset.licencia', 'dataset.vista',
      'data-filtro-area', 'data-editar-area', 'data-borrar-area', 'data-cerrar-area', 'data-cerrar-borrar']) {
      assert.ok(!new RegExp(`${atributo.replace('.', '\\.')}\\b`).test(fuente), atributo);
    }
  });
});

describe('feriados.js: las constantes y las paridades', () => {
  it('paridad: MENSAJES_FERIADO es el del servidor (las 13 claves, con los mismos textos)', () => {
    assert.deepEqual(plano(F.MENSAJES_FERIADO), { ...MENSAJES_FERIADO });
    assert.equal(Object.keys(plano(F.MENSAJES_FERIADO)).length, 13);
    assert.equal(F.MENSAJES_FERIADO.despuesDeLaBaja, 'La fecha tiene que ser anterior al año desde el que se dio de baja.');
  });

  it('paridad: los rótulos de los tipos son NOMBRES_TIPO_FERIADO del servidor', () => {
    assert.deepEqual(plano(F.NOMBRES_TIPO_FERIADO), { ...NOMBRES_TIPO_FERIADO });
    assert.deepEqual(plano(F.NOMBRES_TIPO_FERIADO), {
      nacional: 'Nacional', provincial: 'De Chubut', municipal: 'De Comodoro', no_laborable: 'No laborable'
    });
  });

  it('paridad: diaDeLaSemanaFeriado da lo mismo que diaDeLaSemana en 14 días seguidos (con el cambio de año)', () => {
    const dias = [];
    for (let ms = Date.UTC(2026, 11, 25); dias.length < 14; ms += 86400000) dias.push(new Date(ms).toISOString().slice(0, 10));
    assert.equal(dias[0], '2026-12-25');
    assert.equal(dias[13], '2027-01-07');
    for (const fecha of dias) assert.equal(F.diaDeLaSemanaFeriado(fecha), diaDeLaSemana(fecha), fecha);
    assert.deepEqual(new Set(dias.map((fecha) => F.diaDeLaSemanaFeriado(fecha))).size, 7);
  });

  it('paridad: con lo que no es una fecha, null, como el servidor', () => {
    for (const raro of ['2026-02-30', '2026-2-3', '2026-02-16T00:00:00Z', 20260216, null, undefined, '', 'hola', '2027-02-29']) {
      assert.equal(F.diaDeLaSemanaFeriado(raro), diaDeLaSemana(raro), String(raro));
      assert.equal(F.diaDeLaSemanaFeriado(raro), null, String(raro));
    }
    assert.equal(F.diaDeLaSemanaFeriado('2028-02-29'), 'martes');
  });

  it('los días de la semana y los filtros', () => {
    assert.deepEqual(plano(F.DIAS_DE_LA_SEMANA_FERIADOS), ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']);
    assert.deepEqual(plano(F.FILTROS_FERIADO), [['todos', 'Todos'], ['nacional', 'Nacionales'], ['provincial', 'De Chubut'],
      ['municipal', 'De Comodoro'], ['no_laborable', 'No laborables'], ['fijo', 'Fijos del sistema']]);
  });

  it('los mensajes de la pestaña', () => {
    assert.equal(F.MENSAJE_ERROR_FERIADOS, 'No se pudieron cargar los feriados. Probá de nuevo en unos minutos.');
    assert.equal(F.MENSAJE_SESION_FERIADOS, 'Tu sesión venció. Volvé a ingresar.');
    assert.equal(F.tituloDeFeriados(2026), 'Feriados y días no laborables de 2026');
    assert.equal(F.tituloDeFeriados(null), 'Feriados y días no laborables');
    assert.equal(F.textoVacioFeriados(2027), 'No hay ninguno de este tipo cargado para 2027.');
  });
});

describe('feriados.js: los filtros', () => {
  it('cantidadesDeFiltrosFeriado con la lista de 2026: 13 en total, 9 fijos, 1 nacional, ninguno de Chubut, 2 de Comodoro y 1 no laborable', () => {
    assert.equal(LISTA_2026.length, 13);
    assert.deepEqual(plano(F.cantidadesDeFiltrosFeriado(LISTA_2026)), {
      todos: 13, nacional: 1, provincial: 0, municipal: 2, no_laborable: 1, fijo: 9
    });
  });

  it('cantidadesDeFiltrosFeriado: uno que ese año no rige cuenta igual (está en la lista); lo que no es una lista, todo en 0', () => {
    assert.deepEqual(plano(F.cantidadesDeFiltrosFeriado(LISTA_2027)), {
      todos: 11, nacional: 0, provincial: 0, municipal: 2, no_laborable: 0, fijo: 9
    });
    for (const raro of [null, undefined, 'hola', {}, [null, 3, 'x']]) {
      assert.deepEqual(plano(F.cantidadesDeFiltrosFeriado(raro)), {
        todos: 0, nacional: 0, provincial: 0, municipal: 0, no_laborable: 0, fijo: 0
      }, JSON.stringify(raro));
    }
  });

  it('feriadosVisibles: cada filtro deja los de su tipo, en el orden de la lista; uno desconocido es «Todos»', () => {
    assert.deepEqual(plano(F.feriadosVisibles(LISTA_2026, 'todos')), LISTA_2026);
    assert.deepEqual(F.feriadosVisibles(LISTA_2026, 'municipal').map((f) => f.id), [13, 12]);
    assert.deepEqual(F.feriadosVisibles(LISTA_2026, 'nacional').map((f) => f.id), [11]);
    assert.deepEqual(F.feriadosVisibles(LISTA_2026, 'no_laborable').map((f) => f.id), [10]);
    assert.deepEqual(F.feriadosVisibles(LISTA_2026, 'provincial').map((f) => f.id), []);
    const fijos = F.feriadosVisibles(LISTA_2026, 'fijo');
    assert.equal(fijos.length, 9);
    assert.ok(fijos.every((f) => f.fijo === true));
    for (const raro of ['nada', undefined, null, '', 'constructor', '__proto__']) {
      assert.equal(F.feriadosVisibles(LISTA_2026, raro).length, 13, String(raro));
    }
  });

  it('htmlDeFiltrosFeriado: seis botones con su cantidad, data-filtro-feriado y aria-pressed solo en el elegido', () => {
    const botones = botonesDe(F.htmlDeFiltrosFeriado(LISTA_2026, 'municipal'));
    assert.deepEqual(botones.map((b) => b.texto), ['Todos 13', 'Nacionales 1', 'De Chubut 0', 'De Comodoro 2', 'No laborables 1',
      'Fijos del sistema 9']);
    assert.deepEqual(botones.map((b) => b.atributos['data-filtro-feriado']), ['todos', 'nacional', 'provincial', 'municipal',
      'no_laborable', 'fijo']);
    assert.deepEqual(botones.map((b) => b.atributos['aria-pressed']), ['false', 'false', 'false', 'true', 'false', 'false']);
    for (const boton of botones) {
      assert.equal(boton.atributos.type, 'button');
      assert.equal(boton.atributos.class, 'ar-chip');
    }
  });

  it('htmlDeFiltrosFeriado: con un filtro desconocido, «Todos» elegido', () => {
    const botones = botonesDe(F.htmlDeFiltrosFeriado(LISTA_2026, 'nada'));
    assert.deepEqual(botones.filter((b) => b.atributos['aria-pressed'] === 'true').map((b) => b.texto), ['Todos 13']);
  });
});

describe('feriados.js: el selector del año', () => {
  it('un botón por año, con data-anio-feriado y aria-pressed en el que se mira', () => {
    const botones = botonesDe(F.htmlDelSelectorDeAnioFeriado([2026, 2027], 2026));
    assert.deepEqual(botones.map((b) => [b.texto, b.atributos['data-anio-feriado'], b.atributos['aria-pressed']]),
      [['2026', '2026', 'true'], ['2027', '2027', 'false']]);
    for (const boton of botones) assert.equal(boton.atributos.type, 'button');
  });

  it('los años con feriados de antes van primero; el que se mira está aunque no venga en la lista; sin repetidos ni basura', () => {
    assert.deepEqual(botonesDe(F.htmlDelSelectorDeAnioFeriado([2027, 2025, 2026], 2027)).map((b) => b.texto), ['2025', '2026', '2027']);
    assert.deepEqual(botonesDe(F.htmlDelSelectorDeAnioFeriado([2026, 2027], 2025)).map((b) => [b.texto, b.atributos['aria-pressed']]),
      [['2025', 'true'], ['2026', 'false'], ['2027', 'false']]);
    assert.deepEqual(botonesDe(F.htmlDelSelectorDeAnioFeriado([2026, 2026, '2027', 2027.5, null, 99999], 2026)).map((b) => b.texto),
      ['2026']);
    assert.equal(F.htmlDelSelectorDeAnioFeriado(null, null), '');
    assert.equal(F.htmlDelSelectorDeAnioFeriado([], null), '');
  });
});

describe('feriados.js: htmlDeTablaFeriados', () => {
  const html = F.htmlDeTablaFeriados(LISTA_2026);

  it('las columnas, en orden, y una fila por feriado, en el orden de la lista', () => {
    const encabezados = [...html.matchAll(/<th scope="col"[^>]*>([\s\S]*?)<\/th>/g)].map((m) => textoDe(m[1]));
    assert.deepEqual(encabezados, ['Fecha', 'Nombre', 'Tipo', 'Se repite', 'Acciones']);
    assert.match(html, /<th scope="col"><span class="sr-only">Acciones<\/span><\/th>/);
    assert.match(html, /^\s*<div class="ar-tabla-marco"><table class="ar-tabla fe-tabla">/);
    const filas = filasDe(html);
    assert.equal(filas.length, 13);
    const nombres = filas.map((f) => textoDe(f.celdas[1].match(/<b class="fe-nombre">([\s\S]*?)<\/b>/)?.[1] ?? ''));
    assert.deepEqual(nombres, LISTA_2026.map((f) => f.nombre));
  });

  it('un fijo va en gris (fe-fijo), con «Fijo del sistema», «Todos los años» y sin botón', () => {
    const fijo = filaDeLaTabla(html, 'Año Nuevo');
    assert.equal(fijo.atributos.class, 'fe-fijo');
    assert.equal(fijo.textos[0], 'Jue 01/01');
    assert.match(fijo.celdas[0], /<time datetime="2026-01-01">Jue 01\/01<\/time>/);
    assert.equal(fijo.textos[2], 'Fijo del sistema');
    assert.match(fijo.celdas[2], /<span class="ar-etq fe-etq-fijo">Fijo del sistema<\/span>/);
    assert.equal(fijo.textos[3], 'Todos los años');
    assert.equal(fijo.celdas[4], '');
    assert.equal(botonesDe(fijo.celdas.join('')).length, 0);
    const fijos = filasDe(html).filter((f) => f.atributos.class === 'fe-fijo');
    assert.equal(fijos.length, 9);
    assert.ok(fijos.every((f) => !f.celdas.join('').includes('<button')));
  });

  it('un trasladado: la fecha con el día, «Trasladado del miércoles 17/06» debajo del nombre, «—» y «Editar»', () => {
    const trasladado = filaDeLaTabla(html, 'Paso a la Inmortalidad de Güemes');
    assert.equal(trasladado.atributos.class, undefined, 'sin clase: rige y no es fijo');
    assert.equal(trasladado.textos[0], 'Lun 15/06');
    assert.match(trasladado.celdas[1], /<b class="fe-nombre">Paso a la Inmortalidad de Güemes<\/b><small>Trasladado del miércoles 17\/06<\/small>/);
    assert.match(trasladado.celdas[2], /<span class="ar-etq fe-etq-nacional">Nacional<\/span>/);
    assert.equal(trasladado.textos[3], '—');
    const [editar] = botonesDe(trasladado.celdas[4]);
    assert.deepEqual(editar.atributos, {
      type: 'button', class: 'ar-btn ar-btn-borde ar-btn-chico', 'data-editar-feriado': '11',
      'aria-label': 'Editar Paso a la Inmortalidad de Güemes, lunes 15/06'
    });
    assert.equal(editar.texto, 'Editar');
  });

  it('uno que se repite y ese año no rige: tachado (fe-no-rige), con «Este año no rige», «Todos los años» y «Editar»', () => {
    const noRige = filaDeLaTabla(html, 'Aniversario de la ciudad');
    assert.equal(noRige.atributos.class, 'fe-no-rige');
    assert.equal(noRige.textos[0], 'Lun 23/02');
    assert.match(noRige.celdas[1], /<small>Este año no rige<\/small>/);
    assert.match(noRige.celdas[2], /<span class="ar-etq fe-etq-municipal">De Comodoro<\/span>/);
    assert.equal(noRige.textos[3], 'Todos los años');
    assert.equal(botonesDe(noRige.celdas[4])[0].atributos['data-editar-feriado'], '13');
  });

  it('las otras aclaraciones: el domingo y el mismo día que un fijo; el no laborable', () => {
    const domingo = filaDeLaTabla(html, 'Día del Empleado Municipal');
    assert.equal(domingo.textos[0], 'Dom 08/11');
    assert.match(domingo.celdas[1], /<small>Cae domingo: no cambia ningún día hábil<\/small>/);
    const jueves = filaDeLaTabla(html, 'Jueves Santo');
    assert.equal(jueves.textos[0], 'Jue 02/04');
    assert.match(jueves.celdas[1], /<small>Cae el mismo día que un feriado fijo: no cambia nada<\/small>/);
    assert.match(jueves.celdas[2], /<span class="ar-etq fe-etq-no-laborable">No laborable<\/span>/);
  });

  it('un nombre con HTML se ve escapado en la celda, en el aria-label y en la aclaración de otro (Review Focus 4)', () => {
    const malo = '<img src=x onerror=alert(1)>';
    const lista = plano(feriadosDelAnio([
      fila({ id: 20, fecha: '2026-05-04', nombre: malo }),
      fila({ id: 21, fecha: '2026-05-04', nombre: 'Asueto "del" O\'Brien & cía.', tipo: 'municipal' })
    ], 2026));
    const tabla = F.htmlDeTablaFeriados(lista);
    assert.ok(!tabla.includes('<img'), 'ningún <img> de verdad');
    const conMalo = filasDe(tabla).find((f) => f.celdas[1].includes('&lt;img'));
    assert.match(conMalo.celdas[1], /<b class="fe-nombre">&lt;img src=x onerror=alert\(1\)&gt;<\/b>/);
    assert.equal(conMalo.textos[1].startsWith(malo), true);
    const [editar] = botonesDe(conMalo.celdas[4]);
    assert.equal(editar.atributos['aria-label'], 'Editar &lt;img src=x onerror=alert(1)&gt;, lunes 04/05');
    assert.equal(textoDe(editar.atributos['aria-label']), `Editar ${malo}, lunes 04/05`);
    const otro = filasDe(tabla).find((f) => f.celdas[4].includes('data-editar-feriado="21"'));
    assert.match(otro.celdas[1], /<small>Cae el mismo día que «&lt;img src=x onerror=alert\(1\)&gt;»<\/small>/);
    assert.match(otro.celdas[1], /Asueto &quot;del&quot; O&#39;Brien &amp; cía\./);
    assert.equal(botonesDe(otro.celdas[4])[0].atributos['aria-label'], 'Editar Asueto &quot;del&quot; O&#39;Brien &amp; cía., lunes 04/05');
  });

  // Dos feriados pueden llamarse igual: los dos días de Carnaval, o el día al que se pasó uno que se repite (copia su nombre). El
  // nombre accesible de cada «Editar» lleva su fecha del año, con el día de la semana en minúscula
  it('«Editar» lleva la fecha en su nombre accesible: dos con el mismo nombre se distinguen', () => {
    const carnaval = plano(feriadosDelAnio([
      fila({ id: 1, fecha: '2026-02-16', nombre: 'Carnaval' }),
      fila({ id: 2, fecha: '2026-02-17', nombre: 'Carnaval' })
    ], 2026));
    const rotulos = botonesDe(F.htmlDeTablaFeriados(carnaval)).map((b) => b.atributos['aria-label']);
    assert.deepEqual(rotulos, ['Editar Carnaval, lunes 16/02', 'Editar Carnaval, martes 17/02']);
    // El 8/11 que en 2027 no rige y el día al que se pasó: el mismo nombre, la fecha proyectada al año
    const empleado = plano(feriadosDelAnio([
      fila({ id: 12, fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', se_repite: 1, no_rige: [2027] }),
      fila({ id: 14, fecha: '2027-11-09', nombre: 'Día del Empleado Municipal', tipo: 'municipal', trasladado_de: '2027-11-08' })
    ], 2027));
    const deEmpleado = botonesDe(F.htmlDeTablaFeriados(empleado)).map((b) => [b.atributos['data-editar-feriado'], b.atributos['aria-label']]);
    assert.deepEqual(deEmpleado, [['12', 'Editar Día del Empleado Municipal, lunes 08/11'],
      ['14', 'Editar Día del Empleado Municipal, martes 09/11']]);
    assert.equal(new Set(deEmpleado.map(([, rotulo]) => rotulo)).size, 2);
  });

  it('rotuloDeEditarFeriado: texto plano; sin un día que sirva, solo la fecha; sin una fecha, solo el nombre', () => {
    assert.equal(F.rotuloDeEditarFeriado({ fecha: '2026-02-16', dia_semana: 'lunes', nombre: 'A & <b>' }), 'Editar A & <b>, lunes 16/02');
    assert.equal(F.rotuloDeEditarFeriado({ fecha: '2026-02-16', dia_semana: null, nombre: 'Carnaval' }), 'Editar Carnaval, 16/02');
    assert.equal(F.rotuloDeEditarFeriado({ fecha: '2026-02-16', dia_semana: 'Lunes', nombre: 'Carnaval' }), 'Editar Carnaval, 16/02');
    for (const fecha of [null, '2026-02-30', 'hola']) {
      assert.equal(F.rotuloDeEditarFeriado({ fecha, dia_semana: 'lunes', nombre: 'Carnaval' }), 'Editar Carnaval', String(fecha));
    }
    assert.equal(F.rotuloDeEditarFeriado({ fecha: '2026-02-16', dia_semana: 'lunes', nombre: 0 }), 'Editar 0, lunes 16/02');
  });

  it('lo que manda el servidor se escapa también en el tipo y en la fecha; un tipo desconocido va sin color', () => {
    const tabla = F.htmlDeTablaFeriados([{ id: 30, fecha: '2026-05-04', dia_semana: 'lunes', nombre: 'X', tipo: '"><b>',
      tipo_nombre: '<i>raro</i>', fijo: false, se_repite: 0, rige: true, aclaraciones: ['<u>a</u>'] }]);
    assert.ok(!tabla.includes('<i>') && !tabla.includes('<u>') && !tabla.includes('"><b>'));
    const [unica] = filasDe(tabla);
    assert.match(unica.celdas[2], /^<span class="ar-etq">&lt;i&gt;raro&lt;\/i&gt;<\/span>$/);
    assert.match(unica.celdas[1], /<small>&lt;u&gt;a&lt;\/u&gt;<\/small>/);
  });

  it('el botón «Editar» solo con un id entero positivo; un fijo nunca lo lleva', () => {
    const base = { fecha: '2026-05-04', dia_semana: 'lunes', nombre: 'X', tipo: 'nacional', tipo_nombre: 'Nacional', fijo: false,
      se_repite: 0, rige: true, aclaraciones: [] };
    for (const id of [null, undefined, 0, -3, 1.5, '7"', 'abc']) {
      assert.equal(botonesDe(F.htmlDeTablaFeriados([{ ...base, id }])).length, 0, String(id));
    }
    assert.equal(botonesDe(F.htmlDeTablaFeriados([{ ...base, id: 7, fijo: true }])).length, 0, 'un fijo');
    assert.equal(botonesDe(F.htmlDeTablaFeriados([{ ...base, id: 7 }]))[0].atributos['data-editar-feriado'], '7');
  });

  it('la fecha: «Lun 16/02» con el día que manda el servidor, para los siete días; sin día, solo la fecha; sin fecha, «—»', () => {
    const semana = ['2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22'];
    assert.deepEqual(semana.map((fecha) => F.fechaCortaFeriado({ fecha, dia_semana: diaDeLaSemana(fecha) })),
      ['Lun 16/02', 'Mar 17/02', 'Mié 18/02', 'Jue 19/02', 'Vie 20/02', 'Sáb 21/02', 'Dom 22/02']);
    assert.equal(F.fechaCortaFeriado({ fecha: '2026-02-16', dia_semana: null }), '16/02');
    assert.equal(F.fechaCortaFeriado({ fecha: '2026-02-16', dia_semana: 'feriado' }), '16/02');
    for (const fecha of [null, '2026-02-30', 'hola', 20260216]) {
      assert.equal(F.fechaCortaFeriado({ fecha, dia_semana: 'lunes' }), '—', String(fecha));
    }
    assert.equal(F.fechaCortaFeriado(null), '—');
  });

  it('una lista que no es una lista, o con algo que no es un feriado, no rompe la tabla', () => {
    assert.equal(filasDe(F.htmlDeTablaFeriados(null)).length, 0);
    assert.equal(filasDe(F.htmlDeTablaFeriados([null, 3, 'x', JSON.parse(JSON.stringify(LISTA_2026[0]))])).length, 1);
  });
});

describe('feriados.js: datosDeFeriados (la respuesta de GET /api/feriados)', () => {
  it('una respuesta que sirve: el año, los años del selector (con el que se mira) y la lista', () => {
    assert.deepEqual(plano(F.datosDeFeriados(RESPUESTA_2026, null)), { anio: 2026, anios: [2026, 2027], feriados: LISTA_2026 });
    assert.deepEqual(plano(F.datosDeFeriados(respuestaDe(2025, [], [2026, 2027]), 2025)).anios, [2025, 2026, 2027]);
  });

  it('una que no sirve, o de otro año que el pedido, null', () => {
    for (const raro of [null, undefined, {}, { success: false, data: RESPUESTA_2026.data }, { success: true },
      { success: true, data: { anio: '2026', anios: [], feriados: [] } }, { success: true, data: { anio: 2026, anios: [] } },
      { success: true, data: { anio: 2026, anios: [], feriados: 'x' } }]) {
      assert.equal(F.datosDeFeriados(raro, null), null, JSON.stringify(raro));
    }
    assert.equal(F.datosDeFeriados(RESPUESTA_2026, 2027), null);
  });
});

// ======================================================================
// Con un DOM falso: la carga de cada año, el selector, los filtros y lo que se anuncia
// ======================================================================

// Una página falsa con lo justo: cada id es un elemento (se crea al pedirlo). Un contenedor encuentra sus botones por un atributo
// (querySelector('[atributo="valor"]')) si su HTML lo tiene, y escribir su HTML los reemplaza (los de antes quedan afuera:
// contains da false). `responder(metodo, ruta)` contesta cada API.pedirJson (si tira, el pedido falla); `pedidos` los registra
const crearPagina = ({ responder = async () => RESPUESTA_2026, admin = true } = {}) => {
  const pagina = { foco: null };
  const nuevo = (id) => {
    const clases = new Set();
    let hijos = new Map();
    let html = '';
    const elemento = {
      id, value: '', textContent: '', hidden: false, disabled: false, escrituras: 0, atributos: {}, oyentes: {},
      get innerHTML() { return html; },
      set innerHTML(valor) { html = String(valor); elemento.escrituras++; hijos = new Map(); },
      setAttribute(clave, valor) { this.atributos[clave] = String(valor); },
      removeAttribute(clave) { delete this.atributos[clave]; },
      getAttribute(clave) { return this.atributos[clave] ?? null; },
      classList: {
        add: (c) => clases.add(c), remove: (c) => clases.delete(c), contains: (c) => clases.has(c),
        toggle: (c, si = !clases.has(c)) => (si ? clases.add(c) : clases.delete(c))
      },
      addEventListener(tipo, fn) { (this.oyentes[tipo] ??= []).push(fn); },
      focus() { pagina.foco = this; },
      contains: (otro) => otro === elemento || [...hijos.values()].includes(otro),
      querySelector(selector) {
        const partes = /^\[([\w-]+)="([^"]*)"\]$/.exec(selector);
        if (!partes || !html.includes(`${partes[1]}="${partes[2]}"`)) return null;
        if (!hijos.has(selector)) {
          hijos.set(selector, {
            dentroDe: id, atributos: { [partes[1]]: partes[2] },
            getAttribute(clave) { return this.atributos[clave] ?? null; },
            focus() { pagina.foco = this; }
          });
        }
        return hijos.get(selector);
      },
      querySelectorAll: () => []
    };
    return elemento;
  };
  const elementos = new Map();
  const elemento = (id) => {
    if (!elementos.has(id)) elementos.set(id, nuevo(id));
    return elementos.get(id);
  };
  const oyentesDelDocumento = {};
  const document = {
    addEventListener(tipo, fn) { (oyentesDelDocumento[tipo] ??= []).push(fn); },
    getElementById: elemento,
    querySelectorAll: () => [],
    querySelector: () => null,
    get activeElement() { return pagina.foco; }
  };
  const pedidos = [];
  const contexto = vm.createContext({
    CONFIG: { API_URL: '/api' }, console, document, window: { location: {} },
    Auth: { isAuthenticated: () => true, isAdmin: () => admin },
    showToast() {},
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout() {}
  });
  vm.runInContext(leer('js/api.js'), contexto);
  vm.runInContext(leer('js/feriados.js'), contexto);
  contexto.__pedir = async (metodo, ruta, cuerpo) => {
    pedidos.push({ metodo, ruta, cuerpo });
    return responder(metodo, ruta, cuerpo);
  };
  vm.runInContext('API.pedirJson = __pedir', contexto);
  const alCargar = () => (oyentesDelDocumento.DOMContentLoaded ?? []).forEach((fn) => fn());
  // Un clic delegado en #vista-feriados sobre un botón con esos atributos ({ 'data-filtro-feriado': 'nacional' })
  const clic = (atributos) => {
    const dataset = Object.fromEntries(Object.entries(atributos)
      .map(([clave, valor]) => [clave.replace(/^data-/, '').replace(/-(\w)/g, (_, letra) => letra.toUpperCase()), valor]));
    const objetivo = {
      closest: (selector) => {
        const clave = selector.match(/^\[([\w-]+)\]$/)?.[1];
        return clave && atributos[clave] !== undefined ? { dataset, atributos } : null;
      }
    };
    elemento('vista-feriados').oyentes.click.forEach((fn) => fn({ target: objetivo }));
  };
  return { contexto, elemento, pedidos, pagina, alCargar, clic, oyentesDelDocumento };
};

// Una respuesta que llega cuando el test quiere: `soltar(valor)` la contesta
const demorada = () => {
  let soltar;
  const promesa = new Promise((resolver) => { soltar = resolver; });
  return { promesa, soltar };
};
// Un error como el que tira API.pedirJson
const falla = (status, mensaje) => Object.assign(new Error(mensaje), { status });
const porAnio = async (metodo, ruta) => (ruta === '/feriados?anio=2027' ? RESPUESTA_2027 : RESPUESTA_2026);
const esperar = () => new Promise((resolver) => setImmediate(resolver));

describe('feriados.js con un DOM: cargarFeriados', () => {
  it('la primera vez pide el año en curso (sin año: el del servidor) y dibuja el título, el selector, los filtros y la tabla', async () => {
    const { contexto, elemento, pedidos } = crearPagina();
    elemento('btn-nuevo-feriado').disabled = true;
    await contexto.cargarFeriados();
    assert.deepEqual(pedidos.map((p) => [p.metodo, p.ruta]), [['GET', '/feriados']]);
    assert.equal(elemento('titulo-feriados').textContent, 'Feriados y días no laborables de 2026');
    assert.deepEqual(botonesDe(elemento('feriados-anio').innerHTML).map((b) => [b.texto, b.atributos['aria-pressed']]),
      [['2026', 'true'], ['2027', 'false']]);
    assert.deepEqual(botonesDe(elemento('feriados-filtros').innerHTML).map((b) => b.texto)[0], 'Todos 13');
    assert.equal(filasDe(elemento('feriados-lista').innerHTML).length, 13);
    assert.equal(elemento('feriados-vacio').hidden, true);
    assert.equal(elemento('btn-nuevo-feriado').disabled, false);
    assert.equal(elemento('feriados-anuncio').textContent, '', 'abrir la pestaña no anuncia nada');
  });

  it('se pide una sola vez por año; con forzar, otra', async () => {
    const { contexto, pedidos } = crearPagina();
    await contexto.cargarFeriados();
    await contexto.cargarFeriados();
    assert.equal(pedidos.length, 1);
    await contexto.cargarFeriados(true);
    assert.deepEqual(pedidos.map((p) => p.ruta), ['/feriados', '/feriados?anio=2026'], 'con forzar, el año que se mira');
  });

  it('dos aperturas seguidas, mientras llega la respuesta, hacen un solo pedido', async () => {
    const { contexto, pedidos } = crearPagina();
    await Promise.all([contexto.cargarFeriados(), contexto.cargarFeriados()]);
    assert.equal(pedidos.length, 1);
  });

  it('con forzar, la tabla que se ve queda hasta que llega la nueva (sin el spinner)', async () => {
    const respuesta = demorada();
    let primera = true;
    const { contexto, elemento } = crearPagina({
      responder: async () => { if (primera) { primera = false; return RESPUESTA_2026; } return respuesta.promesa; }
    });
    await contexto.cargarFeriados();
    const carga = contexto.cargarFeriados(true);
    assert.match(elemento('feriados-lista').innerHTML, /<table/);
    respuesta.soltar(RESPUESTA_2026);
    await carga;
    assert.equal(filasDe(elemento('feriados-lista').innerHTML).length, 13);
  });

  // Después de guardar (la Task 7) se vuelve a pedir con forzar: mientras llega, la tabla que se ve sigue andando
  it('durante una recarga con forzar, un filtro se aplica y «Editar» encuentra su feriado; al llegar, la tabla nueva con el filtro', async () => {
    const respuesta = demorada();
    let primera = true;
    const pagina = crearPagina({
      responder: async () => { if (primera) { primera = false; return RESPUESTA_2026; } return respuesta.promesa; }
    });
    pagina.alCargar();
    await pagina.contexto.cargarFeriados();
    const abiertos = [];
    pagina.contexto.abrirModalFeriado = (feriado, origen) => abiertos.push([feriado, origen]);
    const carga = pagina.contexto.cargarFeriados(true);
    pagina.clic({ 'data-filtro-feriado': 'municipal' });
    assert.equal(filasDe(pagina.elemento('feriados-lista').innerHTML).length, 2, 'el filtro se aplicó');
    assert.deepEqual(pagina.pagina.foco?.atributos, { 'data-filtro-feriado': 'municipal' });
    pagina.clic({ 'data-editar-feriado': '13' });
    assert.equal(abiertos.length, 1);
    assert.equal(abiertos[0][0].id, 13);
    // La respuesta trae un feriado más de Comodoro: la tabla nueva, con el filtro elegido
    const nueva = plano(feriadosDelAnio([...FILAS, fila({ id: 15, fecha: '2026-03-02', nombre: 'Asueto', tipo: 'municipal' })], 2026));
    respuesta.soltar(respuestaDe(2026, nueva));
    await carga;
    assert.deepEqual(filasDe(pagina.elemento('feriados-lista').innerHTML).map((f) => f.celdas[4].match(/data-editar-feriado="(\d+)"/)?.[1]),
      ['13', '15', '12']);
    pagina.clic({ 'data-editar-feriado': '15' });
    assert.equal(abiertos.at(-1)[0].id, 15);
    assert.equal(pagina.pedidos.length, 2);
  });

  it('con forzar, los otros años se descartan; si la recarga falla, el error y el año se vuelve a pedir (nada viejo queda guardado)', async () => {
    let fallar = false;
    const pagina = crearPagina({
      responder: async (metodo, ruta) => {
        if (fallar) throw falla(500, 'x');
        return porAnio(metodo, ruta);
      }
    });
    pagina.alCargar();
    await pagina.contexto.cargarFeriados();
    await pagina.contexto.elegirAnioFeriado('2027');
    await pagina.contexto.elegirAnioFeriado('2026');
    assert.equal(pagina.pedidos.length, 2);
    fallar = true;
    await pagina.contexto.cargarFeriados(true);
    assert.equal(textoDe(pagina.elemento('feriados-lista').innerHTML), 'No se pudieron cargar los feriados. Probá de nuevo en unos minutos.');
    pagina.clic({ 'data-filtro-feriado': 'municipal' });
    assert.equal(textoDe(pagina.elemento('feriados-lista').innerHTML), 'No se pudieron cargar los feriados. Probá de nuevo en unos minutos.',
      'un filtro no vuelve a dibujar la tabla vieja');
    fallar = false;
    await pagina.contexto.cargarFeriados();
    await pagina.contexto.elegirAnioFeriado('2027');
    assert.deepEqual(pagina.pedidos.map((p) => p.ruta), ['/feriados', '/feriados?anio=2027', '/feriados?anio=2026',
      '/feriados?anio=2026', '/feriados?anio=2027']);
  });

  it('si el pedido falla: el error, sin tabla ni filtros, y se anuncia', async () => {
    const { contexto, elemento } = crearPagina({ responder: async () => { throw falla(500, 'Error al obtener los feriados'); } });
    await contexto.cargarFeriados();
    const lista = elemento('feriados-lista').innerHTML;
    assert.match(lista, /^<p class="aviso aviso-error">/);
    assert.equal(textoDe(lista), 'No se pudieron cargar los feriados. Probá de nuevo en unos minutos.');
    assert.equal(elemento('feriados-filtros').innerHTML, '');
    assert.equal(elemento('feriados-vacio').hidden, true);
    assert.equal(elemento('feriados-anuncio').textContent, 'No se pudieron cargar los feriados. Probá de nuevo en unos minutos.');
  });

  it('una respuesta que no es la de la API también es un error (nunca una tabla vacía)', async () => {
    const { contexto, elemento } = crearPagina({ responder: async () => ({ success: true, data: [] }) });
    await contexto.cargarFeriados();
    assert.equal(textoDe(elemento('feriados-lista').innerHTML), 'No se pudieron cargar los feriados. Probá de nuevo en unos minutos.');
  });

  it('después de un error, volver a abrir la pestaña lo vuelve a pedir', async () => {
    let primera = true;
    const { contexto, pedidos, elemento } = crearPagina({
      responder: async () => { if (primera) { primera = false; throw falla(500, 'x'); } return RESPUESTA_2026; }
    });
    await contexto.cargarFeriados();
    await contexto.cargarFeriados();
    assert.equal(pedidos.length, 2);
    assert.match(elemento('feriados-lista').innerHTML, /<table/);
  });

  it('con la sesión vencida (401): el mensaje con un link a login.html, sin selector ni filtros, y «Nuevo feriado» deshabilitado', async () => {
    const { contexto, elemento } = crearPagina({ responder: async () => { throw falla(401, 'Token inválido'); } });
    await contexto.cargarFeriados();
    const lista = elemento('feriados-lista').innerHTML;
    assert.match(lista, /^<p class="aviso aviso-error">/);
    assert.match(lista, /<a href="login\.html">Volvé a ingresar\.<\/a>/);
    assert.equal(textoDe(lista), 'Tu sesión venció. Volvé a ingresar.');
    assert.equal(elemento('feriados-anio').innerHTML, '');
    assert.equal(elemento('feriados-filtros').innerHTML, '');
    assert.equal(elemento('btn-nuevo-feriado').disabled, true);
  });
});

describe('feriados.js con un DOM: el selector del año', () => {
  it('elegir 2027: lo pide, lo dibuja, anuncia el título y el foco queda en su botón; volver a 2026 no pide nada', async () => {
    const pagina = crearPagina({ responder: porAnio });
    pagina.alCargar();
    await pagina.contexto.cargarFeriados();
    await pagina.contexto.elegirAnioFeriado('2027');
    assert.deepEqual(pagina.pedidos.map((p) => p.ruta), ['/feriados', '/feriados?anio=2027']);
    assert.equal(pagina.elemento('titulo-feriados').textContent, 'Feriados y días no laborables de 2027');
    assert.deepEqual(botonesDe(pagina.elemento('feriados-anio').innerHTML).map((b) => b.atributos['aria-pressed']), ['false', 'true']);
    assert.equal(filasDe(pagina.elemento('feriados-lista').innerHTML).length, 11);
    assert.equal(pagina.elemento('feriados-anuncio').textContent, 'Feriados y días no laborables de 2027');
    assert.deepEqual(pagina.pagina.foco?.atributos, { 'data-anio-feriado': '2027' });
    assert.equal(pagina.elemento('feriados-anio').contains(pagina.pagina.foco), true, 'el botón que está en la página');

    await pagina.contexto.elegirAnioFeriado('2026');
    assert.equal(pagina.pedidos.length, 2, '2026 ya estaba');
    assert.equal(filasDe(pagina.elemento('feriados-lista').innerHTML).length, 13);
    assert.deepEqual(pagina.pagina.foco?.atributos, { 'data-anio-feriado': '2026' });
    // Abrir la pestaña otra vez tampoco pide nada
    await pagina.contexto.cargarFeriados();
    assert.equal(pagina.pedidos.length, 2);
  });

  it('mientras llega el año: el título y el selector con el año nuevo, el spinner y sin filtros; al llegar, el foco no se pierde', async () => {
    const respuesta = demorada();
    const pagina = crearPagina({ responder: async (metodo, ruta) => (ruta === '/feriados' ? RESPUESTA_2026 : respuesta.promesa) });
    await pagina.contexto.cargarFeriados();
    const eleccion = pagina.contexto.elegirAnioFeriado('2027');
    assert.equal(pagina.elemento('titulo-feriados').textContent, 'Feriados y días no laborables de 2027');
    assert.deepEqual(botonesDe(pagina.elemento('feriados-anio').innerHTML).map((b) => b.atributos['aria-pressed']), ['false', 'true']);
    assert.match(pagina.elemento('feriados-lista').innerHTML, /class="spinner"/);
    assert.equal(pagina.elemento('feriados-filtros').innerHTML, '');
    const foco = pagina.pagina.foco;
    assert.deepEqual(foco?.atributos, { 'data-anio-feriado': '2027' });
    const escrituras = pagina.elemento('feriados-anio').escrituras;
    respuesta.soltar(RESPUESTA_2027);
    await eleccion;
    assert.equal(pagina.elemento('feriados-anio').escrituras, escrituras, 'el selector no se vuelve a escribir: no cambió');
    assert.equal(pagina.pagina.foco, foco);
    assert.equal(pagina.elemento('feriados-anio').contains(foco), true);
    assert.equal(filasDe(pagina.elemento('feriados-lista').innerHTML).length, 11);
  });

  it('si los años del selector cambian al llegar, el foco pasa al botón nuevo del mismo año', async () => {
    const pagina = crearPagina({
      responder: async (metodo, ruta) => (ruta === '/feriados' ? RESPUESTA_2026 : respuestaDe(2027, LISTA_2027, [2025, 2026, 2027]))
    });
    await pagina.contexto.cargarFeriados();
    await pagina.contexto.elegirAnioFeriado('2027');
    assert.deepEqual(botonesDe(pagina.elemento('feriados-anio').innerHTML).map((b) => b.texto), ['2025', '2026', '2027']);
    assert.deepEqual(pagina.pagina.foco?.atributos, { 'data-anio-feriado': '2027' });
    assert.equal(pagina.elemento('feriados-anio').contains(pagina.pagina.foco), true);
  });

  it('una respuesta de un año que ya no se mira no se dibuja', async () => {
    const respuesta = demorada();
    const pagina = crearPagina({ responder: async (metodo, ruta) => (ruta === '/feriados' ? RESPUESTA_2026 : respuesta.promesa) });
    await pagina.contexto.cargarFeriados();
    const eleccion = pagina.contexto.elegirAnioFeriado('2027');
    await pagina.contexto.elegirAnioFeriado('2026');
    respuesta.soltar(RESPUESTA_2027);
    await eleccion;
    assert.equal(pagina.elemento('titulo-feriados').textContent, 'Feriados y días no laborables de 2026');
    assert.equal(filasDe(pagina.elemento('feriados-lista').innerHTML).length, 13);
    assert.equal(pagina.elemento('feriados-anuncio').textContent, 'Feriados y días no laborables de 2026');
    // Volver a 2027 lo pide otra vez: la respuesta que llegó tarde no quedó guardada
    await pagina.contexto.elegirAnioFeriado('2027');
    assert.deepEqual(pagina.pedidos.map((p) => p.ruta), ['/feriados', '/feriados?anio=2027', '/feriados?anio=2027']);
  });

  it('si el año falla: el error, que se anuncia; el selector sigue para elegir otro y el mismo año se vuelve a pedir', async () => {
    let falloUnaVez = false;
    const pagina = crearPagina({
      responder: async (metodo, ruta) => {
        if (ruta === '/feriados') return RESPUESTA_2026;
        if (!falloUnaVez) { falloUnaVez = true; throw falla(500, 'x'); }
        return RESPUESTA_2027;
      }
    });
    await pagina.contexto.cargarFeriados();
    await pagina.contexto.elegirAnioFeriado('2027');
    assert.equal(textoDe(pagina.elemento('feriados-lista').innerHTML), 'No se pudieron cargar los feriados. Probá de nuevo en unos minutos.');
    assert.equal(pagina.elemento('feriados-anuncio').textContent, 'No se pudieron cargar los feriados. Probá de nuevo en unos minutos.');
    assert.equal(botonesDe(pagina.elemento('feriados-anio').innerHTML).length, 2);
    await pagina.contexto.elegirAnioFeriado('2027');
    assert.equal(filasDe(pagina.elemento('feriados-lista').innerHTML).length, 11);
  });

  it('elegir el año que ya se ve no pide ni anuncia nada; un valor que no es un año se ignora', async () => {
    const pagina = crearPagina({ responder: porAnio });
    await pagina.contexto.cargarFeriados();
    for (const valor of ['2026', '', 'abc', '20266', undefined, '2026.5']) await pagina.contexto.elegirAnioFeriado(valor);
    assert.equal(pagina.pedidos.length, 1);
    assert.equal(pagina.elemento('feriados-anuncio').textContent, '');
  });
});

describe('feriados.js con un DOM: los filtros y los clics', () => {
  it('con administración, los oyentes van en #vista-feriados y en «Nuevo feriado», y en ningún otro lado', () => {
    const pagina = crearPagina();
    pagina.alCargar();
    assert.equal(pagina.elemento('vista-feriados').oyentes.click?.length, 1);
    assert.equal(pagina.elemento('btn-nuevo-feriado').oyentes.click?.length, 1);
    assert.deepEqual(Object.keys(pagina.oyentesDelDocumento), ['DOMContentLoaded']);
  });

  it('un clic en un filtro lo elige, deja el foco en él y la tabla con los de ese tipo; el año se mantiene al cambiarlo', async () => {
    const pagina = crearPagina({ responder: porAnio });
    pagina.alCargar();
    await pagina.contexto.cargarFeriados();
    pagina.clic({ 'data-filtro-feriado': 'municipal' });
    const botones = botonesDe(pagina.elemento('feriados-filtros').innerHTML);
    assert.deepEqual(botones.filter((b) => b.atributos['aria-pressed'] === 'true').map((b) => b.texto), ['De Comodoro 2']);
    assert.deepEqual(pagina.pagina.foco?.atributos, { 'data-filtro-feriado': 'municipal' });
    assert.equal(pagina.elemento('feriados-filtros').contains(pagina.pagina.foco), true);
    assert.equal(filasDe(pagina.elemento('feriados-lista').innerHTML).length, 2);
    assert.equal(pagina.elemento('feriados-anuncio').textContent, '', 'con resultados no se anuncia: el botón dice que está elegido');
    pagina.clic({ 'data-anio-feriado': '2027' });
    await esperar();
    await esperar();
    assert.equal(filasDe(pagina.elemento('feriados-lista').innerHTML).length, 2, 'los de Comodoro de 2027');
    assert.deepEqual(botonesDe(pagina.elemento('feriados-filtros').innerHTML).filter((b) => b.atributos['aria-pressed'] === 'true')
      .map((b) => b.texto), ['De Comodoro 2']);
  });

  it('un filtro sin ninguno: sin tabla, el vacío con el año a la vista y anunciado', async () => {
    const pagina = crearPagina();
    pagina.alCargar();
    await pagina.contexto.cargarFeriados();
    pagina.clic({ 'data-filtro-feriado': 'provincial' });
    assert.equal(pagina.elemento('feriados-lista').innerHTML, '');
    assert.equal(pagina.elemento('feriados-vacio').hidden, false);
    assert.equal(pagina.elemento('feriados-vacio').textContent, 'No hay ninguno de este tipo cargado para 2026.');
    assert.equal(pagina.elemento('feriados-anuncio').textContent, 'No hay ninguno de este tipo cargado para 2026.');
    // El mismo texto otra vez se vuelve a anunciar (cambia apenas: un espacio duro al final)
    pagina.clic({ 'data-filtro-feriado': 'todos' });
    pagina.clic({ 'data-filtro-feriado': 'provincial' });
    assert.equal(pagina.elemento('feriados-anuncio').textContent, 'No hay ninguno de este tipo cargado para 2026. ');
    pagina.clic({ 'data-filtro-feriado': 'todos' });
    assert.equal(pagina.elemento('feriados-vacio').hidden, true);
    assert.equal(filasDe(pagina.elemento('feriados-lista').innerHTML).length, 13);
  });

  it('elegir un año que deja vacío el filtro elegido anuncia el vacío en lugar del título', async () => {
    const pagina = crearPagina({ responder: porAnio });
    pagina.alCargar();
    await pagina.contexto.cargarFeriados();
    pagina.clic({ 'data-filtro-feriado': 'nacional' });
    await pagina.contexto.elegirAnioFeriado('2027');
    assert.equal(pagina.elemento('feriados-anuncio').textContent, 'No hay ninguno de este tipo cargado para 2027.');
    assert.equal(pagina.elemento('feriados-vacio').hidden, false);
  });

  it('«Editar» abre el modal del feriado de la lista con su botón; «Nuevo feriado», uno vacío; un fijo o un id ajeno, nada', async () => {
    const pagina = crearPagina();
    pagina.alCargar();
    await pagina.contexto.cargarFeriados();
    const abiertos = [];
    pagina.contexto.abrirModalFeriado = (feriado, origen) => abiertos.push([feriado, origen]);
    pagina.clic({ 'data-editar-feriado': '11' });
    assert.equal(abiertos.length, 1);
    assert.deepEqual(plano(abiertos[0][0]), LISTA_2026.find((f) => f.id === 11));
    assert.deepEqual(abiertos[0][1].atributos, { 'data-editar-feriado': '11' });
    pagina.clic({ 'data-editar-feriado': '999' });
    pagina.clic({ 'data-editar-feriado': 'null' });
    assert.equal(abiertos.length, 1);
    const boton = pagina.elemento('btn-nuevo-feriado');
    boton.oyentes.click.forEach((fn) => fn({ currentTarget: boton }));
    assert.deepEqual(abiertos.slice(1), [[null, boton]]);
  });

  it('abrirModalFeriado existe y, mientras no hay modal, no tira', () => {
    const pagina = crearPagina();
    assert.equal(typeof pagina.contexto.abrirModalFeriado, 'function');
    assert.doesNotThrow(() => pagina.contexto.abrirModalFeriado(null, null));
  });
});
