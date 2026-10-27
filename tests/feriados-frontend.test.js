// La pestaña Feriados de Configuración (spec 2026-10-26-feriados, 4), ejecutada en Node: lo puro de public/js/feriados.js (las
// copias del servidor, los filtros con sus cantidades, el selector del año y la tabla, con las aclaraciones y el escapado) y, con un
// DOM falso, la carga de cada año, los filtros, el selector y lo que se anuncia. Como areas.js, el script al cargarse solo declara:
// se carga en un vm con un document que no hace nada, junto con el api.js de verdad (Utils.escapeHtml). La lista de cada año la arma
// feriadosDelAnio del servidor, con filas inventadas.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import {
  MENSAJES_FERIADO, NOMBRES_TIPO_FERIADO, FECHA_MINIMA_FERIADO, diaDeLaSemana, feriadosDelAnio, validarFeriado
} from '../services/feriadosReglas.js';

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
// El modal del feriado y el de la baja: lo puro
// ======================================================================

// Uno que se repite desde 2026, como lo manda la lista de otro año: su fecha y su trasladado van proyectados al año que se mira, y
// fecha_guardada y trasladado_de_guardado son los de la fila
const filaQueSeRepite = (cambios = {}) => fila({
  id: 7, fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', se_repite: 1, ...cambios
});
const deLaLista = (filas, anio, id) => plano(feriadosDelAnio(filas, anio)).find((f) => f.id === id);
const EMPLEADO_2027 = deLaLista([filaQueSeRepite()], 2027, 7);
const GALESA_2027 = deLaLista([fila({ id: 16, fecha: '2026-07-27', nombre: 'Gesta galesa', tipo: 'provincial', se_repite: 1,
  trasladado_de: '2026-07-28' })], 2027, 16);
const CARNAVAL = deLaLista([fila({ id: 20, fecha: '2026-02-16', nombre: 'Carnaval' })], 2026, 20);
const MALO = '<img src=x onerror=alert(1)>';

describe('feriados.js: el modal, valoresDelFeriado', () => {
  it('la fecha y el trasladado guardados, nunca los proyectados al año que se mira', () => {
    assert.equal(GALESA_2027.fecha, '2027-07-27');
    assert.equal(GALESA_2027.trasladado_de, '2027-07-28');
    assert.deepEqual(plano(F.valoresDelFeriado(GALESA_2027)), {
      id: 16, fecha: '2026-07-27', nombre: 'Gesta galesa', tipo: 'provincial', trasladado_de: '2026-07-28', se_repite: true,
      no_rige: false, pasa_al: '', primer_anio: 2026, hasta_anio: null
    });
  });

  it('«no rige» marcado si ese año no rige; hasta_anio, el de la fila; uno que no se repite', () => {
    const sinEseAnio = deLaLista([filaQueSeRepite({ no_rige: [2027], hasta_anio: 2029 })], 2027, 7);
    assert.equal(sinEseAnio.rige, false);
    assert.deepEqual(plano(F.valoresDelFeriado(sinEseAnio)), {
      id: 7, fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', trasladado_de: '', se_repite: true,
      no_rige: true, pasa_al: '', primer_anio: 2026, hasta_anio: 2029
    });
    assert.deepEqual(plano(F.valoresDelFeriado(CARNAVAL)), {
      id: 20, fecha: '2026-02-16', nombre: 'Carnaval', tipo: 'nacional', trasladado_de: '', se_repite: false, no_rige: false,
      pasa_al: '', primer_anio: 2026, hasta_anio: null
    });
  });

  it('un alta (null), o lo que no es un feriado: todo vacío; un tipo desconocido, sin tipo', () => {
    const vacio = {
      id: null, fecha: '', nombre: '', tipo: '', trasladado_de: '', se_repite: false, no_rige: false, pasa_al: '', primer_anio: null,
      hasta_anio: null
    };
    for (const raro of [null, undefined, 'x', 3, []]) assert.deepEqual(plano(F.valoresDelFeriado(raro)), vacio, JSON.stringify(raro));
    assert.equal(F.valoresDelFeriado({ ...CARNAVAL, tipo: 'fijo' }).tipo, '');
    assert.equal(F.valoresDelFeriado({ ...CARNAVAL, tipo: '__proto__' }).tipo, '');
    assert.equal(F.valoresDelFeriado({ ...CARNAVAL, nombre: 0 }).nombre, '0');
  });
});

// Revisión final, 1: la fecha del modal de uno que se repite es la de su primer año, y corregirla cambia todos los años (el
// antiobjetivo de la spec: que corregir un año cambie los anteriores sin querer). La ayuda lo dice debajo de la fecha
describe('feriados.js: el modal, la ayuda de la fecha (ayudaDeLaFechaFeriado)', () => {
  it('uno que se repite: la fecha de su primer año y, con «no rige» a la vista, cómo correr solo el año que se mira', () => {
    assert.equal(F.ayudaDeLaFechaFeriado(EMPLEADO_2027), 'Es la fecha de su primer año (2026): corregirla cambia todos los años.');
    assert.equal(F.ayudaDeLaFechaFeriado(EMPLEADO_2027, 2027),
      'Es la fecha de su primer año (2026): corregirla cambia todos los años. Si solo en 2027 se corrió, marcá «En 2027 no rige».');
    // El primer año es el de la fecha guardada (fecha_guardada), no el de la fecha del año que se mira
    const desde2025 = deLaLista([filaQueSeRepite({ fecha: '2025-11-08' })], 2027, 7);
    assert.equal(desde2025.fecha, '2027-11-08');
    assert.equal(F.ayudaDeLaFechaFeriado(desde2025, 2027),
      'Es la fecha de su primer año (2025): corregirla cambia todos los años. Si solo en 2027 se corrió, marcá «En 2027 no rige».');
    assert.equal(F.ayudaDeLaFechaFeriado(EMPLEADO_2027, 2026),
      'Es la fecha de su primer año (2026): corregirla cambia todos los años. Si solo en 2026 se corrió, marcá «En 2026 no rige».');
    // Un año que no sirve es sin «no rige»
    for (const raro of [null, undefined, '2027', 2027.5, NaN]) {
      assert.equal(F.ayudaDeLaFechaFeriado(EMPLEADO_2027, raro), 'Es la fecha de su primer año (2026): corregirla cambia todos los años.',
        String(raro));
    }
  });

  it('sin ayuda: en un alta, en uno que no se repite (lo guardado), sin una fecha guardada o sin un id', () => {
    for (const anio of [null, 2026]) {
      assert.equal(F.ayudaDeLaFechaFeriado(null, anio), '', 'un alta');
      assert.equal(F.ayudaDeLaFechaFeriado(CARNAVAL, anio), '', 'uno que no se repite');
      assert.equal(F.ayudaDeLaFechaFeriado({ ...EMPLEADO_2027, se_repite: 0 }, anio), '', 'lo guardado, no la casilla');
      assert.equal(F.ayudaDeLaFechaFeriado({ ...EMPLEADO_2027, fecha_guardada: null }, anio), '', 'sin fecha guardada');
      assert.equal(F.ayudaDeLaFechaFeriado({ ...EMPLEADO_2027, id: null }, anio), '', 'sin id (un fijo)');
      for (const raro of [undefined, 'x', 3, []]) assert.equal(F.ayudaDeLaFechaFeriado(raro, anio), '', JSON.stringify(raro));
    }
  });

  it('describedbyDeLaFechaFeriado: suma fe-fecha-ayuda antes del error (sin repetirlo) o lo saca; los demás ids quedan', () => {
    assert.equal(F.describedbyDeLaFechaFeriado('fe-fecha-dia fe-fecha-error', true), 'fe-fecha-dia fe-fecha-ayuda fe-fecha-error');
    assert.equal(F.describedbyDeLaFechaFeriado('fe-fecha-dia fe-fecha-ayuda fe-fecha-error', true), 'fe-fecha-dia fe-fecha-ayuda fe-fecha-error');
    assert.equal(F.describedbyDeLaFechaFeriado('fe-fecha-dia fe-fecha-ayuda fe-fecha-error', false), 'fe-fecha-dia fe-fecha-error');
    assert.equal(F.describedbyDeLaFechaFeriado('fe-fecha-dia fe-fecha-error', false), 'fe-fecha-dia fe-fecha-error');
    assert.equal(F.describedbyDeLaFechaFeriado('otro', true), 'otro fe-fecha-ayuda', 'sin el error, al final');
    assert.equal(F.describedbyDeLaFechaFeriado(null, true), 'fe-fecha-ayuda');
    assert.equal(F.describedbyDeLaFechaFeriado(null, false), '');
  });

  // Las licencias afectadas van debajo de la ayuda (fe-fecha-afectadas): en el orden en que se ven, antes del error. Sin el tercer
  // parámetro, quedan como estaban (la ayuda cambia sin tocarlas)
  it('describedbyDeLaFechaFeriado: con el tercer parámetro, suma o saca fe-fecha-afectadas, después de la ayuda y antes del error', () => {
    const TODO = 'fe-fecha-dia fe-fecha-ayuda fe-fecha-afectadas fe-fecha-error';
    assert.equal(F.describedbyDeLaFechaFeriado('fe-fecha-dia fe-fecha-error', false, true), 'fe-fecha-dia fe-fecha-afectadas fe-fecha-error');
    assert.equal(F.describedbyDeLaFechaFeriado('fe-fecha-dia fe-fecha-error', true, true), TODO);
    assert.equal(F.describedbyDeLaFechaFeriado(TODO, true, true), TODO, 'sin repetirlos');
    assert.equal(F.describedbyDeLaFechaFeriado(TODO, true, false), 'fe-fecha-dia fe-fecha-ayuda fe-fecha-error');
    assert.equal(F.describedbyDeLaFechaFeriado(TODO, false, false), 'fe-fecha-dia fe-fecha-error');
    // Sin el tercero, las afectadas quedan: la ayuda va antes que ellas. Y con la ayuda undefined, la ayuda queda
    assert.equal(F.describedbyDeLaFechaFeriado('fe-fecha-dia fe-fecha-afectadas fe-fecha-error', true), TODO);
    assert.equal(F.describedbyDeLaFechaFeriado(TODO, false), 'fe-fecha-dia fe-fecha-afectadas fe-fecha-error');
    assert.equal(F.describedbyDeLaFechaFeriado('fe-fecha-dia fe-fecha-ayuda fe-fecha-error', undefined, true), TODO);
    assert.equal(F.describedbyDeLaFechaFeriado(TODO, undefined, false), 'fe-fecha-dia fe-fecha-ayuda fe-fecha-error');
    assert.equal(F.describedbyDeLaFechaFeriado('otro', false, true), 'otro fe-fecha-afectadas', 'sin el error, al final');
  });
});

describe('feriados.js: el modal, las licencias de Mi espacio que incluye la fecha', () => {
  it('textoDeAfectadasFeriado: con 0, nada; con 1, en singular; con 2 o más, en plural', () => {
    assert.equal(F.textoDeAfectadasFeriado(0), '');
    assert.equal(F.textoDeAfectadasFeriado(1), '1 licencia cargada lo incluye: sus días hábiles se recalculan.');
    assert.equal(F.textoDeAfectadasFeriado(2), '2 licencias cargadas lo incluyen: sus días hábiles se recalculan.');
    assert.equal(F.textoDeAfectadasFeriado(15), '15 licencias cargadas lo incluyen: sus días hábiles se recalculan.');
    // Lo que no es una cantidad (null: la cuenta falló), nada
    for (const raro of [null, undefined, -1, 1.5, NaN, '2', {}, []]) assert.equal(F.textoDeAfectadasFeriado(raro), '', String(raro));
  });

  it('rutaDeAfectadasFeriado: la fecha y «se repite» (1 o 0) y, al corregir, el id; sin una fecha, null', () => {
    assert.equal(F.rutaDeAfectadasFeriado('2026-12-13', true, null), '/feriados/afectadas?fecha=2026-12-13&se_repite=1');
    assert.equal(F.rutaDeAfectadasFeriado('2026-12-13', false, null), '/feriados/afectadas?fecha=2026-12-13&se_repite=0');
    assert.equal(F.rutaDeAfectadasFeriado('2026-12-13', true, 12), '/feriados/afectadas?fecha=2026-12-13&se_repite=1&id=12');
    assert.equal(F.rutaDeAfectadasFeriado('2026-12-13', false, '12'), '/feriados/afectadas?fecha=2026-12-13&se_repite=0&id=12');
    // Un id que no sirve no va
    for (const id of [undefined, 0, -3, 'abc', 1.5]) {
      assert.equal(F.rutaDeAfectadasFeriado('2026-12-13', true, id), '/feriados/afectadas?fecha=2026-12-13&se_repite=1', String(id));
    }
    // Una fecha a medias, vacía o que no existe: no se pide nada
    for (const fecha of ['', '2026-12', '2026-02-30', null, undefined]) assert.equal(F.rutaDeAfectadasFeriado(fecha, true, 12), null, String(fecha));
  });
});

describe('feriados.js: el modal, erroresDelFeriado (solo los obligatorios)', () => {
  const BIEN = { fecha: '2026-03-02', nombre: 'Asueto', tipo: 'municipal', trasladado_de: '', se_repite: false };

  it('sin errores, {}; sin fecha, nombre ni tipo, los tres, en ese orden, con los mensajes del servidor', () => {
    assert.deepEqual(plano(F.erroresDelFeriado(BIEN)), {});
    const errores = plano(F.erroresDelFeriado({ fecha: '', nombre: '   ', tipo: '' }));
    assert.deepEqual(errores, { fecha: MENSAJES_FERIADO.fecha, nombre: MENSAJES_FERIADO.nombre, tipo: MENSAJES_FERIADO.tipo });
    assert.deepEqual(Object.keys(errores), ['fecha', 'nombre', 'tipo']);
    for (const raro of [null, undefined, 'x']) assert.deepEqual(Object.keys(plano(F.erroresDelFeriado(raro))), ['fecha', 'nombre', 'tipo']);
  });

  it('paridad: cada obligatorio da el mismo campo y el mismo mensaje que validarFeriado', () => {
    const HOY = '2026-10-26';
    for (const [cambio, campo] of [[{ fecha: '' }, 'fecha'], [{ fecha: '2026-02-30' }, 'fecha'], [{ nombre: '  ' }, 'nombre'],
      [{ tipo: '' }, 'tipo'], [{ tipo: 'fijo' }, 'tipo']]) {
      const valores = { ...BIEN, ...cambio };
      assert.deepEqual(plano(F.erroresDelFeriado(valores)), { [campo]: validarFeriado(valores, HOY).error.mensaje }, JSON.stringify(cambio));
      assert.equal(validarFeriado(valores, HOY).error.campo, campo);
    }
    assert.equal(validarFeriado({ ...BIEN, se_repite: false }, HOY).error, null);
  });

  it('lo demás lo controla el servidor (el rango, el trasladado, el 29/02 que se repite): no da error acá', () => {
    for (const cambio of [{ fecha: '2024-12-31' }, { trasladado_de: '2027-01-01' }, { fecha: '2028-02-29', se_repite: true }]) {
      assert.deepEqual(plano(F.erroresDelFeriado({ ...BIEN, ...cambio })), {}, JSON.stringify(cambio));
    }
  });
});

describe('feriados.js: el modal, pedidosDelGuardadoFeriado', () => {
  const ORIGINAL = plano(F.valoresDelFeriado(EMPLEADO_2027));
  const como = (cambios) => ({ ...ORIGINAL, ...cambios });

  it('un alta da un POST /feriados con el formulario (sin «no rige», que en un alta no está)', () => {
    const valores = { fecha: '2026-03-02', nombre: '  Asueto  ', tipo: 'municipal', trasladado_de: '', se_repite: false, no_rige: true,
      pasa_al: '2026-03-03' };
    assert.deepEqual(plano(F.pedidosDelGuardadoFeriado(valores, null, 2026)), [{
      metodo: 'POST', ruta: '/feriados',
      cuerpo: { fecha: '2026-03-02', nombre: 'Asueto', tipo: 'municipal', trasladado_de: null, se_repite: false }
    }]);
  });

  it('una corrección solo del nombre da un PUT /feriados/7 con el formulario entero (la fecha guardada, no la del año)', () => {
    assert.deepEqual(plano(F.pedidosDelGuardadoFeriado(como({ nombre: 'Día del Empleado' }), ORIGINAL, 2027)), [{
      metodo: 'PUT', ruta: '/feriados/7',
      cuerpo: { fecha: '2026-11-08', nombre: 'Día del Empleado', tipo: 'municipal', trasladado_de: null, se_repite: true }
    }]);
  });

  it('marcar «no rige» sin tocar los campos da un PUT /feriados/7/rige con { anio, rige: false, pasa_al }', () => {
    assert.deepEqual(plano(F.pedidosDelGuardadoFeriado(como({ no_rige: true, pasa_al: '2027-11-09' }), ORIGINAL, 2027)), [{
      metodo: 'PUT', ruta: '/feriados/7/rige', cuerpo: { anio: 2027, rige: false, pasa_al: '2027-11-09' }
    }]);
    assert.deepEqual(plano(F.pedidosDelGuardadoFeriado(como({ no_rige: true }), ORIGINAL, 2027)), [{
      metodo: 'PUT', ruta: '/feriados/7/rige', cuerpo: { anio: 2027, rige: false, pasa_al: null }
    }]);
  });

  it('las dos cosas dan los dos pedidos, en ese orden: los campos y después «no rige»', () => {
    assert.deepEqual(plano(F.pedidosDelGuardadoFeriado(como({ tipo: 'provincial', no_rige: true }), ORIGINAL, 2027))
      .map((p) => [p.metodo, p.ruta]), [['PUT', '/feriados/7'], ['PUT', '/feriados/7/rige']]);
  });

  it('sin cambios, []: los espacios del nombre, el trasladado vacío o null y un «Se pasó al» sin «no rige» no cuentan', () => {
    assert.deepEqual(plano(F.pedidosDelGuardadoFeriado(ORIGINAL, ORIGINAL, 2027)), []);
    assert.deepEqual(plano(F.pedidosDelGuardadoFeriado(como({ nombre: ' Día del Empleado Municipal ', trasladado_de: null,
      pasa_al: '2027-11-09' }), ORIGINAL, 2027)), []);
  });

  it('«no rige» que ya estaba: sin un «Se pasó al» nuevo, nada; con uno, el pedido; desmarcarlo vuelve a regir (sin pasa_al)', () => {
    const sinEseAnio = plano(F.valoresDelFeriado(deLaLista([filaQueSeRepite({ no_rige: [2027] })], 2027, 7)));
    assert.deepEqual(plano(F.pedidosDelGuardadoFeriado(sinEseAnio, sinEseAnio, 2027)), []);
    assert.deepEqual(plano(F.pedidosDelGuardadoFeriado({ ...sinEseAnio, pasa_al: '2027-11-09' }, sinEseAnio, 2027)), [{
      metodo: 'PUT', ruta: '/feriados/7/rige', cuerpo: { anio: 2027, rige: false, pasa_al: '2027-11-09' }
    }]);
    assert.deepEqual(plano(F.pedidosDelGuardadoFeriado({ ...sinEseAnio, no_rige: false, pasa_al: '2027-11-09' }, sinEseAnio, 2027)), [{
      metodo: 'PUT', ruta: '/feriados/7/rige', cuerpo: { anio: 2027, rige: true, pasa_al: null }
    }]);
  });

  it('«no rige» solo en uno que se repite y que sigue repitiéndose, con un año que sirve', () => {
    // Destildar «Se repite» deja solo los campos
    assert.deepEqual(plano(F.pedidosDelGuardadoFeriado(como({ se_repite: false, no_rige: true }), ORIGINAL, 2027))
      .map((p) => p.ruta), ['/feriados/7']);
    // Uno que no se repite no tiene «no rige», aunque se le tilde «Se repite»
    const carnaval = plano(F.valoresDelFeriado(CARNAVAL));
    assert.deepEqual(plano(F.pedidosDelGuardadoFeriado({ ...carnaval, no_rige: true }, carnaval, 2026)), []);
    assert.deepEqual(plano(F.pedidosDelGuardadoFeriado({ ...carnaval, se_repite: true, no_rige: true }, carnaval, 2026))
      .map((p) => p.ruta), ['/feriados/20']);
    for (const anio of [null, undefined, '2027', 2027.5]) {
      assert.deepEqual(plano(F.pedidosDelGuardadoFeriado(como({ no_rige: true }), ORIGINAL, anio)), [], String(anio));
    }
  });

  it('una corrección sin un id que sirva no pide nada', () => {
    assert.deepEqual(plano(F.pedidosDelGuardadoFeriado(como({ nombre: 'X' }), { ...ORIGINAL, id: null }, 2027)), []);
  });
});

describe('feriados.js: el modal, la baja', () => {
  it('textoDeLaBajaFeriado, uno que se repite: desde un año posterior al primero, «Deja de regir desde…»; desde el primero, entero', () => {
    assert.equal(F.textoDeLaBajaFeriado(EMPLEADO_2027, 2027),
      '¿Dar de baja «Día del Empleado Municipal»? Deja de regir desde 2027. Los años anteriores no cambian.');
    assert.equal(F.textoDeLaBajaFeriado(EMPLEADO_2027, '2028'),
      '¿Dar de baja «Día del Empleado Municipal»? Deja de regir desde 2028. Los años anteriores no cambian.');
    for (const desde of [2026, '2026', 2025]) {
      assert.equal(F.textoDeLaBajaFeriado(EMPLEADO_2027, desde), '¿Dar de baja «Día del Empleado Municipal»? Se da de baja entero.', String(desde));
    }
  });

  it('textoDeLaBajaFeriado, uno que no se repite: su día y «Deja de contar como día no hábil.» (desde no cuenta)', () => {
    for (const desde of [null, 2027]) {
      assert.equal(F.textoDeLaBajaFeriado(CARNAVAL, desde), '¿Dar de baja «Carnaval» del lunes 16/02/2026? Deja de contar como día no hábil.');
    }
  });

  it('textoDeLaBajaFeriado con un nombre con HTML: texto plano, sin escapar (va con textContent)', () => {
    const malo = deLaLista([fila({ id: 21, fecha: '2026-05-04', nombre: MALO })], 2026, 21);
    assert.equal(F.textoDeLaBajaFeriado(malo, null), `¿Dar de baja «${MALO}» del lunes 04/05/2026? Deja de contar como día no hábil.`);
    const maloQueSeRepite = deLaLista([filaQueSeRepite({ nombre: `${MALO} & "x"` })], 2027, 7);
    assert.equal(F.textoDeLaBajaFeriado(maloQueSeRepite, 2027),
      `¿Dar de baja «${MALO} & "x"»? Deja de regir desde 2027. Los años anteriores no cambian.`);
    assert.ok(!F.textoDeLaBajaFeriado(malo, null).includes('&lt;'));
  });

  it('aniosDeLaBajaFeriado: del primer año (de la fecha guardada) a hasta_anio o, si sigue, al año siguiente al de hoy', () => {
    assert.deepEqual(plano(F.aniosDeLaBajaFeriado(EMPLEADO_2027, '2026-10-26')), [2026, 2027]);
    assert.deepEqual(plano(F.aniosDeLaBajaFeriado(EMPLEADO_2027, '2027-01-04')), [2026, 2027, 2028]);
    const conHasta = deLaLista([filaQueSeRepite({ fecha: '2025-11-08', hasta_anio: 2026 })], 2026, 7);
    assert.deepEqual(plano(F.aniosDeLaBajaFeriado(conHasta, '2026-10-26')), [2025, 2026]);
    // Uno que no se repite se da de baja entero: sin años
    assert.deepEqual(plano(F.aniosDeLaBajaFeriado(CARNAVAL, '2026-10-26')), []);
    assert.deepEqual(plano(F.aniosDeLaBajaFeriado(EMPLEADO_2027, 'hoy')), []);
    assert.deepEqual(plano(F.aniosDeLaBajaFeriado(null, '2026-10-26')), []);
  });

  it('anioDeLaBajaPorDefectoFeriado: el que se mira, dentro de los del selector; sin uno que sirva, el último', () => {
    assert.equal(F.anioDeLaBajaPorDefectoFeriado([2026, 2027], 2027), 2027);
    assert.equal(F.anioDeLaBajaPorDefectoFeriado([2026, 2027], 2026), 2026);
    assert.equal(F.anioDeLaBajaPorDefectoFeriado([2026, 2027], 2025), 2026);
    assert.equal(F.anioDeLaBajaPorDefectoFeriado([2025, 2026], 2027), 2026);
    assert.equal(F.anioDeLaBajaPorDefectoFeriado([2026, 2027], null), 2027);
    assert.equal(F.anioDeLaBajaPorDefectoFeriado([], 2027), null);
    assert.equal(F.anioDeLaBajaPorDefectoFeriado(null, 2027), null);
  });

  it('htmlDeAniosDeLaBajaFeriado: una opción por año, con el elegido', () => {
    assert.equal(F.htmlDeAniosDeLaBajaFeriado([2026, 2027], 2027),
      '<option value="2026">2026</option><option value="2027" selected>2027</option>');
    assert.equal(F.htmlDeAniosDeLaBajaFeriado([], null), '');
  });

  it('rutaDeLaBajaFeriado: uno que se repite, con ?desde; uno que no, sin él', () => {
    assert.equal(F.rutaDeLaBajaFeriado(EMPLEADO_2027, '2027'), '/feriados/7?desde=2027');
    assert.equal(F.rutaDeLaBajaFeriado(EMPLEADO_2027, 2026), '/feriados/7?desde=2026');
    assert.equal(F.rutaDeLaBajaFeriado(EMPLEADO_2027, ''), '/feriados/7');
    assert.equal(F.rutaDeLaBajaFeriado(CARNAVAL, '2027'), '/feriados/20');
    assert.equal(F.rutaDeLaBajaFeriado(null, '2027'), null);
  });
});

describe('feriados.js: el modal, los textos y el tipo', () => {
  it('tituloDelModalFeriado: «Nuevo feriado» o «Editar «<nombre>»», texto plano (va con textContent)', () => {
    assert.equal(F.tituloDelModalFeriado(null), 'Nuevo feriado');
    assert.equal(F.tituloDelModalFeriado(CARNAVAL), 'Editar «Carnaval»');
    assert.equal(F.tituloDelModalFeriado({ ...CARNAVAL, nombre: MALO }), `Editar «${MALO}»`);
  });

  it('htmlDeTiposFeriado: cuatro opciones grandes (radios fe-tipo, obligatorios: required), con su nombre y su ayuda; «Nacional», con la del usuario', () => {
    const html = F.htmlDeTiposFeriado();
    const opciones = [...html.matchAll(/<label class="ar-ambito"><input type="radio" name="fe-tipo" value="([^"]+)" required aria-describedby="fe-tipo-error"><span><b>([^<]+)<\/b><small>([^<]+)<\/small><\/span><\/label>/g)]
      .map(([, valor, nombre, ayuda]) => [valor, nombre, ayuda]);
    assert.deepEqual(opciones, [
      ['nacional', 'Nacional', 'Carnaval, Semana Santa, trasladables y extraordinarios'],
      ['provincial', 'De Chubut', 'Feriado provincial'],
      ['municipal', 'De Comodoro', 'Feriado o asueto municipal'],
      ['no_laborable', 'No laborable', 'Jueves Santo, puentes y asuetos puntuales']
    ]);
    assert.equal(opciones.map(([, nombre]) => nombre).join('|'), Object.values(NOMBRES_TIPO_FERIADO).join('|'));
    assert.equal(html.match(/<label/g).length, 4);
  });

  it('textoDelGuardadoFeriado: los mensajes del servidor y sus avisos, cada uno con su punto', () => {
    assert.equal(F.textoDelGuardadoFeriado(['Feriado corregido.', 'En 2026 no rige: se pasó al 09/11/2026.'],
      ['Cae domingo: no cambia ningún día hábil.']),
    'Feriado corregido. En 2026 no rige: se pasó al 09/11/2026. Cae domingo: no cambia ningún día hábil.');
    assert.equal(F.textoDelGuardadoFeriado(['Feriado cargado'], []), 'Feriado cargado.');
    assert.equal(F.textoDelGuardadoFeriado([undefined, null, ''], [3, {}]), '');
  });

  it('textoDelGuardadoAMediasFeriado: «El feriado se guardó, pero «no rige» no: <motivo>.»', () => {
    assert.equal(F.textoDelGuardadoAMediasFeriado(MENSAJES_FERIADO.pasaAl),
      'El feriado se guardó, pero «no rige» no: La fecha a la que se pasó tiene que ser del mismo año.');
    assert.equal(F.textoDelGuardadoAMediasFeriado('Error al cambiar si rige el feriado'),
      'El feriado se guardó, pero «no rige» no: Error al cambiar si rige el feriado.');
  });

  it('vecinosDelFeriado: el que sigue y el anterior entre los que se editan (los fijos no), para el foco después de una baja', () => {
    assert.deepEqual(plano(F.vecinosDelFeriado(LISTA_2026, 11)), ['12', '10']);
    assert.deepEqual(plano(F.vecinosDelFeriado(LISTA_2026, '12')), ['11']);
    assert.deepEqual(plano(F.vecinosDelFeriado(LISTA_2026, 13)), ['10']);
    assert.deepEqual(plano(F.vecinosDelFeriado(LISTA_2026, 999)), []);
    assert.deepEqual(plano(F.vecinosDelFeriado(null, 11)), []);
  });

  it('paridad: la fecha mínima y la máxima del modal son las del servidor (validarFeriado acepta las dos y rechaza las de afuera)', () => {
    assert.equal(F.FECHA_MINIMA_FERIADO, FECHA_MINIMA_FERIADO);
    for (const hoy of ['2026-10-26', '2026-12-31', '2027-01-01']) {
      const maxima = F.fechaMaximaFeriado(hoy);
      assert.equal(maxima, `${Number(hoy.slice(0, 4)) + 1}-12-31`, hoy);
      const datos = { nombre: 'X', tipo: 'nacional' };
      assert.equal(validarFeriado({ ...datos, fecha: maxima }, hoy).error, null, hoy);
      assert.equal(validarFeriado({ ...datos, fecha: `${Number(maxima.slice(0, 4)) + 1}-01-01` }, hoy).error.campo, 'fecha', hoy);
      assert.equal(validarFeriado({ ...datos, fecha: F.FECHA_MINIMA_FERIADO }, hoy).error, null, hoy);
      assert.equal(validarFeriado({ ...datos, fecha: '2024-12-31' }, hoy).error.campo, 'fecha', hoy);
    }
    assert.equal(F.fechaMaximaFeriado('hoy'), '');
  });

  it('los mensajes del modal', () => {
    assert.equal(F.MENSAJE_YA_NO_ESTA_FERIADO, 'Ese feriado ya no está cargado: se dio de baja mientras tanto.');
    assert.equal(F.MENSAJE_SIN_CONEXION_FERIADO, 'No se pudo conectar con el servidor. Probá de nuevo en unos minutos.');
  });
});

// ======================================================================
// Con un DOM falso: la carga de cada año, el selector, los filtros y lo que se anuncia
// ======================================================================

// Una página falsa con lo justo: cada id es un elemento (se crea al pedirlo). Un contenedor encuentra sus botones por un atributo
// (querySelector('[atributo="valor"]')) si su HTML lo tiene, y escribir su HTML los reemplaza (los de antes quedan afuera:
// contains e isConnected dan false). document.querySelectorAll('input[name="x"]') da los radios de ese nombre que están en el
// HTML de algún elemento (uno por valor). `responder(metodo, ruta)` contesta cada API.pedirJson (si tira, el pedido falla); con
// `servidor(metodo, ruta, cuerpo)`, en cambio, va el API.pedirJson de verdad sobre un fetch falso que contesta { status, body } (así
// los errores llegan como los arma api.js: el mensaje, status y campo). `pedidos` los registra; `toasts`, cada showToast. «Hoy» es
// `hoy` (Utils.hoyEnArgentina). Cada setTimeout corre enseguida; con `temporizadores`, en cambio, queda pendiente (en el Map
// `temporizadores`, id → { fn, ms }) hasta que el test llama a `vencer()`, y clearTimeout lo saca
const crearPagina = ({
  responder = async () => RESPUESTA_2026, servidor = null, admin = true, hoy = '2026-10-26', temporizadores: aMano = false
} = {}) => {
  const pagina = { foco: null };
  const nuevo = (id) => {
    const clases = new Set();
    let hijos = new Map();
    let html = '';
    const elemento = {
      id, value: '', textContent: '', hidden: false, disabled: false, checked: false, escrituras: 0, atributos: {}, oyentes: {},
      get innerHTML() { return html; },
      set innerHTML(valor) {
        html = String(valor);
        elemento.escrituras++;
        for (const hijo of hijos.values()) hijo.isConnected = false;
        hijos = new Map();
      },
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
            dentroDe: id, isConnected: true, atributos: { [partes[1]]: partes[2] },
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
  // Los radios de un nombre, en el orden del HTML; cada uno se crea una vez por valor
  const radiosPorClave = new Map();
  const radios = (nombre) => [...elementos.values()].flatMap((cada) =>
    [...cada.innerHTML.matchAll(new RegExp(`<input type="radio" name="${nombre}" value="([^"]+)"`, 'g'))].map(([, valor]) => {
      const clave = `${nombre}:${valor}`;
      if (!radiosPorClave.has(clave)) {
        radiosPorClave.set(clave, {
          name: nombre, value: valor, checked: false, atributos: {},
          setAttribute(c, v) { this.atributos[c] = String(v); }, removeAttribute(c) { delete this.atributos[c]; },
          getAttribute(c) { return this.atributos[c] ?? null; }, focus() { pagina.foco = this; }
        });
      }
      return radiosPorClave.get(clave);
    }));
  const oyentesDelDocumento = {};
  const document = {
    addEventListener(tipo, fn) { (oyentesDelDocumento[tipo] ??= []).push(fn); },
    getElementById: elemento,
    querySelectorAll: (selector) => {
      const nombre = /^input\[name="([\w-]+)"\]$/.exec(selector)?.[1];
      return nombre ? radios(nombre) : [];
    },
    querySelector: () => null,
    get activeElement() { return pagina.foco; }
  };
  const pedidos = [];
  const toasts = [];
  const temporizadores = new Map();
  let ultimoTemporizador = 0;
  // Corre los pendientes, en el orden en que se programaron (uno que otro sacó mientras tanto ya no corre)
  const vencer = () => {
    for (const id of [...temporizadores.keys()]) {
      const temporizador = temporizadores.get(id);
      if (!temporizador) continue;
      temporizadores.delete(id);
      temporizador.fn();
    }
  };
  const contexto = vm.createContext({
    CONFIG: { API_URL: '/api' }, console, document, window: { location: {} },
    Auth: { isAuthenticated: () => true, isAdmin: () => admin, getAuthHeaders: () => ({ 'Content-Type': 'application/json' }) },
    showToast(mensaje, tipo) { toasts.push([mensaje, tipo]); },
    setTimeout: aMano
      ? (fn, ms) => { temporizadores.set(++ultimoTemporizador, { fn, ms }); return ultimoTemporizador; }
      : (fn) => { fn(); return 0; },
    clearTimeout: aMano ? (id) => { temporizadores.delete(id); } : () => {}
  });
  vm.runInContext(leer('js/api.js'), contexto);
  vm.runInContext(leer('js/feriados.js'), contexto);
  vm.runInContext(`Utils.hoyEnArgentina = () => ${JSON.stringify(hoy)};`, contexto);
  if (servidor) {
    contexto.fetch = async (url, opciones = {}) => {
      const metodo = opciones.method ?? 'GET';
      const ruta = String(url).replace(/^\/api/, '');
      const cuerpo = opciones.body === undefined ? undefined : JSON.parse(opciones.body);
      pedidos.push({ metodo, ruta, cuerpo });
      const { status = 200, body = {} } = (await servidor(metodo, ruta, cuerpo)) ?? {};
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    };
  } else {
    contexto.__pedir = async (metodo, ruta, cuerpo) => {
      pedidos.push({ metodo, ruta, cuerpo });
      return responder(metodo, ruta, cuerpo);
    };
    vm.runInContext('API.pedirJson = __pedir', contexto);
  }
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
  // Los elementos con oyentes: [id, [tipos]], en el orden en que se pidieron
  const conOyentes = () => [...elementos.values()].filter((cada) => Object.keys(cada.oyentes).length > 0)
    .map((cada) => [cada.id, Object.keys(cada.oyentes)]);
  return { contexto, elemento, pedidos, toasts, pagina, alCargar, clic, oyentesDelDocumento, radios, conOyentes, temporizadores, vencer };
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

  // Después de guardar (la Task 7) se vuelve a pedir con forzar: mientras llega, la tabla que se ve sigue andando (sus filtros). Su
  // «Editar» espera la lista nueva: la que se ve tiene los datos de antes, y abrir el modal con ellos desharía lo guardado
  it('durante una recarga con forzar, un filtro se aplica y «Editar» espera la lista nueva y abre con su fila; al llegar, la tabla nueva con el filtro', async () => {
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
    assert.equal(abiertos.length, 0, 'todavía no: espera la lista nueva');
    // La respuesta trae un feriado más de Comodoro y el 13 con otro nombre: la tabla nueva, con el filtro elegido, y el modal con el 13
    // de la lista nueva
    const nueva = plano(feriadosDelAnio([...FILAS.map((f) => (f.id === 13 ? { ...f, nombre: 'Aniversario de Comodoro' } : f)),
      fila({ id: 15, fecha: '2026-03-02', nombre: 'Asueto', tipo: 'municipal' })], 2026));
    respuesta.soltar(respuestaDe(2026, nueva));
    await carga;
    await esperar();
    assert.deepEqual(filasDe(pagina.elemento('feriados-lista').innerHTML).map((f) => f.celdas[4].match(/data-editar-feriado="(\d+)"/)?.[1]),
      ['13', '15', '12']);
    assert.equal(abiertos.length, 1);
    assert.equal(abiertos[0][0].id, 13);
    assert.equal(abiertos[0][0].nombre, 'Aniversario de Comodoro', 'la fila de la lista nueva');
    assert.equal(abiertos[0][1], pagina.elemento('feriados-lista').querySelector('[data-editar-feriado="13"]'), 'su «Editar» nuevo');
    // Sin una recarga en camino, «Editar» abre enseguida
    pagina.clic({ 'data-editar-feriado': '15' });
    assert.equal(abiertos.at(-1)[0].id, 15);
    assert.equal(pagina.pedidos.length, 2);
  });

  it('si la recarga con forzar falla, el «Editar» que esperaba no abre nada (la tabla vieja ya no está)', async () => {
    let primera = true;
    const respuesta = demorada();
    const pagina = crearPagina({
      responder: async () => { if (primera) { primera = false; return RESPUESTA_2026; } return respuesta.promesa; }
    });
    pagina.alCargar();
    await pagina.contexto.cargarFeriados();
    const abiertos = [];
    pagina.contexto.abrirModalFeriado = (feriado, origen) => abiertos.push([feriado, origen]);
    const carga = pagina.contexto.cargarFeriados(true);
    pagina.clic({ 'data-editar-feriado': '13' });
    respuesta.soltar({ success: false });
    await carga;
    await esperar();
    assert.equal(abiertos.length, 0);
  });

  // Revisión final, 6: el «Editar» que espera la lista nueva no abre el modal si mientras tanto se eligió otro año u otra pestaña
  it('si mientras espera la lista nueva se elige otro año, el «Editar» que esperaba no abre nada (tampoco con la fila de ese año)', async () => {
    let llamadas = 0;
    const respuesta = demorada();
    const pagina = crearPagina({
      responder: async (metodo, ruta) => {
        llamadas++;
        if (llamadas === 1) return RESPUESTA_2026;
        return ruta === '/feriados?anio=2027' ? RESPUESTA_2027 : respuesta.promesa;
      }
    });
    pagina.alCargar();
    await pagina.contexto.cargarFeriados();
    const abiertos = [];
    pagina.contexto.abrirModalFeriado = (feriado, origen) => abiertos.push([feriado, origen]);
    const carga = pagina.contexto.cargarFeriados(true);
    // El 12 se repite: también está en la lista de 2027
    pagina.clic({ 'data-editar-feriado': '12' });
    await pagina.contexto.elegirAnioFeriado('2027');
    assert.equal(pagina.elemento('titulo-feriados').textContent, 'Feriados y días no laborables de 2027');
    respuesta.soltar(RESPUESTA_2026);
    await carga;
    await esperar();
    assert.equal(abiertos.length, 0);
    // Sin una recarga en camino, «Editar» de 2027 abre enseguida, con la fila de 2027
    pagina.clic({ 'data-editar-feriado': '12' });
    assert.equal(abiertos.length, 1);
    assert.equal(abiertos[0][0].fecha, '2027-11-08');
  });

  it('si mientras espera la lista nueva se pasa a otra pestaña (#vista-feriados oculta), el «Editar» que esperaba no abre nada', async () => {
    let primera = true;
    const respuesta = demorada();
    const pagina = crearPagina({
      responder: async () => { if (primera) { primera = false; return RESPUESTA_2026; } return respuesta.promesa; }
    });
    pagina.alCargar();
    await pagina.contexto.cargarFeriados();
    const abiertos = [];
    pagina.contexto.abrirModalFeriado = (feriado, origen) => abiertos.push([feriado, origen]);
    const carga = pagina.contexto.cargarFeriados(true);
    pagina.clic({ 'data-editar-feriado': '13' });
    // usuarios.js (mostrarVista) oculta la vista al elegir otra pestaña
    pagina.elemento('vista-feriados').hidden = true;
    respuesta.soltar(RESPUESTA_2026);
    await carga;
    await esperar();
    assert.equal(abiertos.length, 0);
    assert.equal(filasDe(pagina.elemento('feriados-lista').innerHTML).length, 13, 'la lista nueva llegó igual');
    // De vuelta en Feriados, «Editar» abre enseguida
    pagina.elemento('vista-feriados').hidden = false;
    pagina.clic({ 'data-editar-feriado': '13' });
    assert.equal(abiertos.length, 1);
    assert.equal(abiertos[0][0].id, 13);
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
  // Los clics, delegados en la vista y en cada modal (un clic en el velo no cierra: no hay oyente en el velo que lo mire), los
  // campos que cambian algo al escribir y el Escape de sus dos modales; en ningún otro lado
  it('con administración, los oyentes van en #vista-feriados, en «Nuevo feriado», en sus dos modales y en el documento (Escape)', () => {
    const pagina = crearPagina();
    pagina.alCargar();
    assert.deepEqual(pagina.conOyentes(), [
      ['vista-feriados', ['click']], ['btn-nuevo-feriado', ['click']], ['modal-feriado', ['click']], ['modal-baja-feriado', ['click']],
      ['fe-fecha', ['input', 'change']], ['fe-se-repite', ['change']], ['fe-no-rige', ['change']], ['fe-guardar', ['click']],
      ['fe-baja', ['click']], ['baja-feriado-desde', ['change']], ['baja-feriado-confirmar', ['click']]
    ]);
    for (const [id] of pagina.conOyentes()) {
      for (const lista of Object.values(pagina.elemento(id).oyentes)) assert.equal(lista.length, 1, id);
    }
    assert.deepEqual(Object.keys(pagina.oyentesDelDocumento), ['DOMContentLoaded', 'keydown']);
    assert.equal(pagina.oyentesDelDocumento.keydown.length, 1);
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

  it('abrirModalFeriado existe y, en una página sin los modales, no tira', () => {
    const { contexto, consultas } = cargar();
    assert.equal(typeof contexto.abrirModalFeriado, 'function');
    assert.doesNotThrow(() => contexto.abrirModalFeriado(null, null));
    assert.deepEqual(consultas, [['getElementById', 'modal-feriado']]);
  });
});

// ======================================================================
// Con un DOM falso y un fetch falso (el API.pedirJson de verdad): el modal del feriado y el de la baja
// ======================================================================

const OK_CORREGIDO = { status: 200, body: { success: true, message: 'Feriado corregido.', avisos: [] } };
const error400 = (campo, mensaje) => ({ status: 400, body: { success: false, error: mensaje, campo } });
const NO_ENCONTRADO = { status: 404, body: { success: false, error: 'Feriado no encontrado' } };

// La pestaña cargada con 2026. `escribir(metodo, ruta, cuerpo)` contesta cada escritura ({ status, body }, o una promesa; sin
// respuesta, la de una corrección) y `listas`, la lista que devuelve cada GET por año (si no está, la de siempre)
const conModal = async ({ escribir = () => null, listas = {} } = {}) => {
  const pagina = crearPagina({
    servidor: async (metodo, ruta, cuerpo) => {
      if (metodo === 'GET') {
        const anio = ruta === '/feriados?anio=2027' ? 2027 : 2026;
        return { status: 200, body: respuestaDe(anio, listas[anio] ?? (anio === 2027 ? LISTA_2027 : LISTA_2026)) };
      }
      return (await escribir(metodo, ruta, cuerpo)) ?? OK_CORREGIDO;
    }
  });
  pagina.alCargar();
  await pagina.contexto.cargarFeriados();
  return pagina;
};

// «Editar» de la tabla: el botón que está en la página (el que recibe el foco al cerrar)
const editarFeriado = (pagina, id) => {
  const boton = pagina.elemento('feriados-lista').querySelector(`[data-editar-feriado="${id}"]`);
  assert.ok(boton, `el «Editar» de ${id}`);
  pagina.contexto.abrirModalFeriado(pagina.contexto.feriadoDeLaLista(String(id)), boton);
  return boton;
};
const apretar = (pagina, id) => (pagina.elemento(id).oyentes.click ?? [])
  .forEach((fn) => fn({ currentTarget: pagina.elemento(id), target: { closest: () => null } }));
const disparar = (pagina, id, tipo) => (pagina.elemento(id).oyentes[tipo] ?? [])
  .forEach((fn) => fn({ currentTarget: pagina.elemento(id), target: pagina.elemento(id) }));
const escape = (pagina) => pagina.oyentesDelDocumento.keydown.forEach((fn) => fn({ key: 'Escape', preventDefault() {} }));
// Un clic dentro de un modal: en algo con `atributo` (la × o «Cancelar») o, sin él, en el velo
const clicEnModal = (pagina, idModal, atributo = null) => pagina.elemento(idModal).oyentes.click
  .forEach((fn) => fn({ target: { closest: (selector) => (atributo && selector === `[${atributo}]` ? {} : null) } }));
const abierto = (pagina, id) => pagina.elemento(id).classList.contains('active');
const escriturasDe = (pagina) => pagina.pedidos.filter((p) => p.metodo !== 'GET').map((p) => [p.metodo, p.ruta]);
const elegirTipo = (pagina, valor) => pagina.radios('fe-tipo').forEach((radio) => { radio.checked = radio.value === valor; });
const tiposElegidos = (pagina) => pagina.radios('fe-tipo').filter((radio) => radio.checked).map((radio) => radio.value);
const enPagina = (pagina, expresion) => vm.runInContext(expresion, pagina.contexto);

describe('feriados.js con un DOM: el modal del feriado', () => {
  it('al cargar se dibujan los cuatro tipos (htmlDeTiposFeriado), una sola vez', async () => {
    const pagina = await conModal();
    assert.equal(pagina.elemento('fe-tipo-opciones').innerHTML, enPagina(pagina, 'htmlDeTiposFeriado()'));
    assert.deepEqual(pagina.radios('fe-tipo').map((radio) => radio.value), ['nacional', 'provincial', 'municipal', 'no_laborable']);
    editarFeriado(pagina, 12);
    assert.equal(pagina.elemento('fe-tipo-opciones').escrituras, 1);
  });

  it('«Editar» de uno que se repite, mirando 2027: la fecha guardada (no la del año), «En 2027 no rige», «Dar de baja» y el foco en la fecha', async () => {
    const pagina = await conModal();
    await pagina.contexto.elegirAnioFeriado('2027');
    editarFeriado(pagina, 12);
    const el = pagina.elemento;
    assert.equal(abierto(pagina, 'modal-feriado'), true);
    assert.equal(el('modal-feriado-titulo').textContent, 'Editar «Día del Empleado Municipal»');
    assert.equal(el('fe-fecha').value, '2026-11-08', 'la guardada: la del año sería 2027-11-08');
    assert.equal(el('fe-fecha-dia').textContent, 'domingo');
    assert.equal(el('fe-nombre').value, 'Día del Empleado Municipal');
    assert.deepEqual(tiposElegidos(pagina), ['municipal']);
    assert.equal(el('fe-trasladado').value, '');
    assert.equal(el('fe-se-repite').checked, true);
    assert.equal(el('fe-anio').hidden, false);
    assert.equal(el('fe-no-rige-texto').textContent, 'En 2027 no rige');
    assert.equal(el('fe-no-rige').checked, false);
    assert.equal(el('fe-pasa-al-grupo').hidden, true);
    assert.deepEqual([el('fe-pasa-al').value, el('fe-pasa-al').min, el('fe-pasa-al').max], ['', '2027-01-01', '2027-12-31']);
    assert.deepEqual([el('fe-fecha').min, el('fe-fecha').max], ['2025-01-01', '2027-12-31'], 'hasta el 31/12 del año que viene');
    assert.deepEqual([el('fe-trasladado').min, el('fe-trasladado').max], ['2025-01-01', '2027-12-31']);
    assert.equal(el('fe-baja').hidden, false);
    assert.equal(el('fe-guardar').disabled, false);
    assert.equal(el('feriado-error').hidden, true);
    assert.equal(pagina.pagina.foco, el('fe-fecha'));
  });

  it('uno que ese año no rige viene con «En 2026 no rige» marcado y «Se pasó al» a la vista', async () => {
    const pagina = await conModal();
    editarFeriado(pagina, 13);
    assert.equal(pagina.elemento('fe-no-rige').checked, true);
    assert.equal(pagina.elemento('fe-pasa-al-grupo').hidden, false);
    assert.equal(pagina.elemento('fe-no-rige-texto').textContent, 'En 2026 no rige');
  });

  it('un nombre con HTML va como texto (textContent) en el título y en la confirmación de la baja (Review Focus 4)', async () => {
    const lista = plano(feriadosDelAnio([fila({ id: 21, fecha: '2026-05-04', nombre: MALO })], 2026));
    const pagina = crearPagina({ servidor: async () => ({ status: 200, body: respuestaDe(2026, lista) }) });
    pagina.alCargar();
    await pagina.contexto.cargarFeriados();
    editarFeriado(pagina, 21);
    assert.equal(pagina.elemento('modal-feriado-titulo').textContent, `Editar «${MALO}»`);
    assert.equal(pagina.elemento('modal-feriado-titulo').escrituras, 0, 'nunca como HTML');
    assert.equal(pagina.elemento('fe-nombre').value, MALO);
    apretar(pagina, 'fe-baja');
    assert.equal(pagina.elemento('baja-feriado-texto').textContent,
      `¿Dar de baja «${MALO}» del lunes 04/05/2026? Deja de contar como día no hábil.`);
    assert.equal(pagina.elemento('baja-feriado-texto').escrituras, 0, 'nunca como HTML');
  });

  it('«Nuevo feriado», después de una edición: todo vacío, sin «no rige» ni «Dar de baja», y el foco en la fecha', async () => {
    const pagina = await conModal();
    editarFeriado(pagina, 13);
    clicEnModal(pagina, 'modal-feriado', 'data-cerrar-feriado');
    apretar(pagina, 'btn-nuevo-feriado');
    const el = pagina.elemento;
    assert.equal(abierto(pagina, 'modal-feriado'), true);
    assert.equal(el('modal-feriado-titulo').textContent, 'Nuevo feriado');
    assert.deepEqual([el('fe-fecha').value, el('fe-nombre').value, el('fe-trasladado').value, el('fe-fecha-dia').textContent],
      ['', '', '', '']);
    assert.deepEqual(tiposElegidos(pagina), []);
    assert.equal(el('fe-se-repite').checked, false);
    assert.equal(el('fe-no-rige').checked, false);
    assert.equal(el('fe-anio').hidden, true);
    assert.equal(el('fe-baja').hidden, true);
    assert.equal(pagina.pagina.foco, el('fe-fecha'));
  });

  it('la fecha muestra su día al cambiar; «Se repite» destildado esconde «no rige» y «no rige», «Se pasó al»', async () => {
    const pagina = await conModal();
    editarFeriado(pagina, 12);
    const el = pagina.elemento;
    el('fe-fecha').value = '2026-11-09';
    disparar(pagina, 'fe-fecha', 'input');
    assert.equal(el('fe-fecha-dia').textContent, 'lunes');
    el('fe-fecha').value = '';
    disparar(pagina, 'fe-fecha', 'change');
    assert.equal(el('fe-fecha-dia').textContent, '', 'una fecha a medias, sin día');
    el('fe-no-rige').checked = true;
    disparar(pagina, 'fe-no-rige', 'change');
    assert.equal(el('fe-pasa-al-grupo').hidden, false);
    el('fe-se-repite').checked = false;
    disparar(pagina, 'fe-se-repite', 'change');
    assert.equal(el('fe-anio').hidden, true);
    el('fe-se-repite').checked = true;
    disparar(pagina, 'fe-se-repite', 'change');
    assert.equal(el('fe-anio').hidden, false);
    el('fe-no-rige').checked = false;
    disparar(pagina, 'fe-no-rige', 'change');
    assert.equal(el('fe-pasa-al-grupo').hidden, true);
  });

  it('«Se repite» tildado en uno que no se repite no muestra «no rige» (todavía no se guardó como uno que se repite)', async () => {
    const pagina = await conModal();
    editarFeriado(pagina, 11);
    assert.equal(pagina.elemento('fe-anio').hidden, true);
    pagina.elemento('fe-se-repite').checked = true;
    disparar(pagina, 'fe-se-repite', 'change');
    assert.equal(pagina.elemento('fe-anio').hidden, true);
  });

  // Revisión final, 1: la fecha de uno que se repite es la de su primer año; la ayuda lo dice debajo, atada a la fecha por su
  // aria-describedby (con los ids que ya tenía, los del HTML), y solo al corregir uno que se repite
  it('la ayuda de la fecha: al corregir uno que se repite, su primer año y «no rige» del que se mira; en un alta o uno que no se repite, nada', async () => {
    const pagina = await conModal();
    const el = pagina.elemento;
    const DEL_HTML = 'fe-fecha-dia fe-fecha-error';
    el('fe-fecha').setAttribute('aria-describedby', DEL_HTML);
    const ayuda = () => [el('fe-fecha-ayuda').hidden, el('fe-fecha-ayuda').textContent, el('fe-fecha').getAttribute('aria-describedby')];
    const PRIMERO = 'Es la fecha de su primer año (2026): corregirla cambia todos los años.';
    const CON_AYUDA = 'fe-fecha-dia fe-fecha-ayuda fe-fecha-error';

    await pagina.contexto.elegirAnioFeriado('2027');
    editarFeriado(pagina, 12);
    assert.deepEqual(ayuda(), [false, `${PRIMERO} Si solo en 2027 se corrió, marcá «En 2027 no rige».`, CON_AYUDA]);
    assert.equal(el('fe-fecha-ayuda').escrituras, 0, 'texto plano: nunca como HTML');
    // Destildar «Se repite» esconde «no rige»: queda la primera frase (lo guardado sigue repitiéndose)
    el('fe-se-repite').checked = false;
    disparar(pagina, 'fe-se-repite', 'change');
    assert.deepEqual(ayuda(), [false, PRIMERO, CON_AYUDA]);
    el('fe-se-repite').checked = true;
    disparar(pagina, 'fe-se-repite', 'change');
    assert.deepEqual(ayuda(), [false, `${PRIMERO} Si solo en 2027 se corrió, marcá «En 2027 no rige».`, CON_AYUDA], 'sin repetir el id');
    clicEnModal(pagina, 'modal-feriado', 'data-cerrar-feriado');

    // Mirando 2026: el año que no rige es el que se mira
    await pagina.contexto.elegirAnioFeriado('2026');
    editarFeriado(pagina, 13);
    assert.deepEqual(ayuda(), [false, `${PRIMERO} Si solo en 2026 se corrió, marcá «En 2026 no rige».`, CON_AYUDA]);
    clicEnModal(pagina, 'modal-feriado', 'data-cerrar-feriado');

    // Uno que no se repite (aunque se le tilde «Se repite»: todavía no se guardó así) y un alta: sin ayuda ni el id
    editarFeriado(pagina, 11);
    assert.deepEqual(ayuda(), [true, '', DEL_HTML]);
    el('fe-se-repite').checked = true;
    disparar(pagina, 'fe-se-repite', 'change');
    assert.deepEqual(ayuda(), [true, '', DEL_HTML]);
    clicEnModal(pagina, 'modal-feriado', 'data-cerrar-feriado');
    editarFeriado(pagina, 12);
    assert.equal(el('fe-fecha-ayuda').hidden, false);
    clicEnModal(pagina, 'modal-feriado', 'data-cerrar-feriado');
    apretar(pagina, 'btn-nuevo-feriado');
    assert.deepEqual(ayuda(), [true, '', DEL_HTML]);
  });

  // Revisión final, 3 y 4: «Se pasó al» trae los avisos del día que carga, como el alta y la corrección, y se anuncian igual, en un
  // toast de advertencia; sin avisos, el de éxito
  it('los avisos de «Se pasó al» (PUT …/rige) se anuncian como los del alta, en un toast de advertencia', async () => {
    let avisos = ['Cae domingo: no cambia ningún día hábil.'];
    const pagina = await conModal({
      escribir: (metodo, ruta) => (ruta.endsWith('/rige')
        ? { status: 200, body: { success: true, message: 'En 2026 no rige: se pasó al 15/11/2026.', data: { nuevo_id: 30 }, avisos } }
        : null)
    });
    const el = pagina.elemento;
    editarFeriado(pagina, 12);
    el('fe-no-rige').checked = true;
    disparar(pagina, 'fe-no-rige', 'change');
    el('fe-pasa-al').value = '2026-11-15';
    await pagina.contexto.guardarFeriado();
    assert.deepEqual(escriturasDe(pagina), [['PUT', '/feriados/12/rige']]);
    const texto = 'En 2026 no rige: se pasó al 15/11/2026. Cae domingo: no cambia ningún día hábil.';
    assert.deepEqual(pagina.toasts, [[texto, 'warning']]);
    assert.equal(el('feriados-anuncio').textContent, texto);

    avisos = [];
    editarFeriado(pagina, 12);
    el('fe-no-rige').checked = true;
    disparar(pagina, 'fe-no-rige', 'change');
    el('fe-pasa-al').value = '2026-11-10';
    await pagina.contexto.guardarFeriado();
    assert.deepEqual(pagina.toasts.at(-1), ['En 2026 no rige: se pasó al 15/11/2026.', 'success'], 'sin avisos, el de éxito');
  });

  it('Guardar sin los obligatorios: cada error debajo de su campo, aria-invalid, el foco en el primero y ningún pedido', async () => {
    const pagina = await conModal();
    apretar(pagina, 'btn-nuevo-feriado');
    pagina.elemento('fe-nombre').value = '   ';
    await pagina.contexto.guardarFeriado();
    const el = pagina.elemento;
    assert.deepEqual(escriturasDe(pagina), []);
    for (const [id, mensaje] of [['fe-fecha', MENSAJES_FERIADO.fecha], ['fe-nombre', MENSAJES_FERIADO.nombre], ['fe-tipo', MENSAJES_FERIADO.tipo]]) {
      assert.equal(el(`${id}-error`).textContent, mensaje, id);
      assert.equal(el(`${id}-error`).hidden, false, id);
    }
    assert.equal(el('fe-fecha').atributos['aria-invalid'], 'true');
    assert.equal(el('fe-nombre').atributos['aria-invalid'], 'true');
    assert.ok(pagina.radios('fe-tipo').every((radio) => radio.atributos['aria-invalid'] === 'true'), 'los cuatro radios');
    assert.equal(pagina.pagina.foco, el('fe-fecha'));
    assert.equal(abierto(pagina, 'modal-feriado'), true);
    // Con los tres bien, los errores se limpian y sale el pedido
    el('fe-fecha').value = '2026-03-02';
    el('fe-nombre').value = 'Asueto';
    elegirTipo(pagina, 'municipal');
    await pagina.contexto.guardarFeriado();
    assert.equal(el('fe-fecha-error').hidden, true);
    assert.equal(el('fe-fecha').atributos['aria-invalid'], undefined);
    assert.ok(pagina.radios('fe-tipo').every((radio) => radio.atributos['aria-invalid'] === undefined));
    assert.deepEqual(escriturasDe(pagina), [['POST', '/feriados']]);
  });

  it('con un fetch que tarda: «Guardar» deshabilitado hasta la respuesta, un solo POST, y el modal no se cierra mientras tanto', async () => {
    const respuesta = demorada();
    const pagina = await conModal({ escribir: (metodo) => (metodo === 'POST' ? respuesta.promesa : null) });
    apretar(pagina, 'btn-nuevo-feriado');
    const el = pagina.elemento;
    el('fe-fecha').value = '2026-03-02';
    el('fe-nombre').value = '  Asueto  ';
    elegirTipo(pagina, 'municipal');
    const guardado = pagina.contexto.guardarFeriado();
    assert.equal(el('fe-guardar').disabled, true);
    assert.equal(el('fe-baja').disabled, true);
    apretar(pagina, 'fe-guardar');
    await pagina.contexto.guardarFeriado();
    escape(pagina);
    clicEnModal(pagina, 'modal-feriado', 'data-cerrar-feriado');
    assert.equal(abierto(pagina, 'modal-feriado'), true, 'ni Escape ni «Cancelar» lo cierran mientras se guarda');
    assert.deepEqual(escriturasDe(pagina), [['POST', '/feriados']]);
    assert.deepEqual(pagina.pedidos.find((p) => p.metodo === 'POST').cuerpo,
      { fecha: '2026-03-02', nombre: 'Asueto', tipo: 'municipal', trasladado_de: null, se_repite: false });
    respuesta.soltar({ status: 201, body: { success: true, data: { id: 40 }, message: 'Feriado cargado.',
      avisos: ['Ese día ya es feriado: Carnaval.'] } });
    await guardado;
    assert.equal(abierto(pagina, 'modal-feriado'), false);
    assert.equal(el('fe-guardar').disabled, false);
    assert.deepEqual(escriturasDe(pagina), [['POST', '/feriados']], 'un solo POST');
    // El aviso con los avisos del servidor (sin taparlo), en un toast de advertencia (en uno verde se perderían: revisión final, 4) y,
    // anunciado, lo mismo
    assert.deepEqual(pagina.toasts, [['Feriado cargado. Ese día ya es feriado: Carnaval.', 'warning']]);
    assert.equal(el('feriados-anuncio').textContent, 'Feriado cargado. Ese día ya es feriado: Carnaval.');
    assert.deepEqual(pagina.pedidos.map((p) => [p.metodo, p.ruta]), [['GET', '/feriados'], ['POST', '/feriados'], ['GET', '/feriados?anio=2026']]);
    assert.equal(pagina.pagina.foco, el('btn-nuevo-feriado'), 'el foco, de vuelta en «Nuevo feriado»');
  });

  it('una corrección: PUT con el formulario entero, la lista con forzar y el foco en el «Editar» nuevo del mismo feriado (la tabla se volvió a dibujar)', async () => {
    const pagina = await conModal();
    const boton = editarFeriado(pagina, 11);
    pagina.elemento('fe-nombre').value = 'Paso a la Inmortalidad del General Güemes';
    await pagina.contexto.guardarFeriado();
    const put = pagina.pedidos.find((p) => p.metodo === 'PUT');
    assert.deepEqual([put.ruta, put.cuerpo], ['/feriados/11', { fecha: '2026-06-15', nombre: 'Paso a la Inmortalidad del General Güemes',
      tipo: 'nacional', trasladado_de: '2026-06-17', se_repite: false }]);
    assert.equal(abierto(pagina, 'modal-feriado'), false);
    assert.deepEqual(pagina.toasts, [['Feriado corregido.', 'success']]);
    assert.equal(pagina.pedidos.at(-1).ruta, '/feriados?anio=2026');
    const nuevo = pagina.elemento('feriados-lista').querySelector('[data-editar-feriado="11"]');
    assert.equal(boton.isConnected, false, 'el «Editar» que abrió el modal ya no está');
    assert.notEqual(nuevo, boton);
    assert.equal(pagina.pagina.foco, nuevo);
  });

  it('sin cambios, «Guardar» cierra sin pedir nada y el foco vuelve a «Editar»', async () => {
    const pagina = await conModal();
    const boton = editarFeriado(pagina, 12);
    await pagina.contexto.guardarFeriado();
    assert.equal(abierto(pagina, 'modal-feriado'), false);
    assert.deepEqual(escriturasDe(pagina), []);
    assert.equal(pagina.pedidos.length, 1, 'tampoco vuelve a pedir la lista');
    assert.equal(pagina.pagina.foco, boton);
  });

  it('el 400 en fecha pone aria-invalid="true" en #fe-fecha, el mensaje debajo y el foco ahí; el modal sigue abierto', async () => {
    const pagina = await conModal({ escribir: () => error400('fecha', MENSAJES_FERIADO.despuesDeLaBaja) });
    editarFeriado(pagina, 12);
    pagina.elemento('fe-fecha').value = '2027-11-08';
    await pagina.contexto.guardarFeriado();
    assert.equal(pagina.elemento('fe-fecha').atributos['aria-invalid'], 'true');
    assert.equal(pagina.elemento('fe-fecha-error').textContent, MENSAJES_FERIADO.despuesDeLaBaja);
    assert.equal(pagina.elemento('fe-fecha-error').hidden, false);
    assert.equal(pagina.elemento('feriado-error').hidden, true);
    assert.equal(pagina.pagina.foco, pagina.elemento('fe-fecha'));
    assert.equal(abierto(pagina, 'modal-feriado'), true);
    assert.deepEqual(pagina.toasts, []);
    assert.equal(pagina.pedidos.filter((p) => p.metodo === 'GET').length, 1, 'no vuelve a pedir la lista');
  });

  it('cada 400 con campo va a su campo (los radios del tipo, la casilla, «Se pasó al»); sin campo, o en anio, al aviso de arriba', async () => {
    const casos = [
      ['nombre', MENSAJES_FERIADO.nombreLargo, 'fe-nombre'], ['trasladado_de', MENSAJES_FERIADO.trasladado, 'fe-trasladado'],
      ['se_repite', MENSAJES_FERIADO.repite29, 'fe-se-repite']
    ];
    for (const [campo, mensaje, id] of casos) {
      const pagina = await conModal({ escribir: () => error400(campo, mensaje) });
      editarFeriado(pagina, 12);
      pagina.elemento('fe-nombre').value = 'Otro';
      await pagina.contexto.guardarFeriado();
      assert.equal(pagina.elemento(id).atributos['aria-invalid'], 'true', campo);
      assert.equal(pagina.elemento(`${id}-error`).textContent, mensaje, campo);
      assert.equal(pagina.pagina.foco, pagina.elemento(id), campo);
    }
    // El tipo: los cuatro radios, y el foco en el elegido
    const conTipo = await conModal({ escribir: () => error400('tipo', MENSAJES_FERIADO.tipo) });
    editarFeriado(conTipo, 12);
    conTipo.elemento('fe-nombre').value = 'Otro';
    await conTipo.contexto.guardarFeriado();
    assert.ok(conTipo.radios('fe-tipo').every((radio) => radio.atributos['aria-invalid'] === 'true'));
    assert.equal(conTipo.elemento('fe-tipo-error').textContent, MENSAJES_FERIADO.tipo);
    assert.equal(conTipo.pagina.foco?.value, 'municipal');
    // «Se pasó al», solo «no rige»
    const conPasaAl = await conModal({ escribir: () => error400('pasa_al', MENSAJES_FERIADO.pasaAl) });
    editarFeriado(conPasaAl, 12);
    conPasaAl.elemento('fe-no-rige').checked = true;
    disparar(conPasaAl, 'fe-no-rige', 'change');
    conPasaAl.elemento('fe-pasa-al').value = '2027-01-04';
    await conPasaAl.contexto.guardarFeriado();
    assert.equal(conPasaAl.elemento('fe-pasa-al').atributos['aria-invalid'], 'true');
    assert.equal(conPasaAl.pagina.foco, conPasaAl.elemento('fe-pasa-al'));
    // Sin campo (noSeRepite) o en anio: al aviso de arriba, con el foco en «Guardar»
    for (const [campo, mensaje] of [[null, MENSAJES_FERIADO.noSeRepite], ['anio', MENSAJES_FERIADO.anio], ['rige', MENSAJES_FERIADO.rige]]) {
      const pagina = await conModal({ escribir: () => error400(campo, mensaje) });
      editarFeriado(pagina, 12);
      pagina.elemento('fe-no-rige').checked = true;
      await pagina.contexto.guardarFeriado();
      assert.equal(pagina.elemento('feriado-error').textContent, mensaje, String(campo));
      assert.equal(pagina.elemento('feriado-error').hidden, false, String(campo));
      assert.equal(pagina.pagina.foco, pagina.elemento('fe-guardar'), String(campo));
      assert.equal(abierto(pagina, 'modal-feriado'), true);
    }
  });

  it('un 401 al guardar: el mensaje de la sesión, con el link a login.html, dentro del modal', async () => {
    const pagina = await conModal({ escribir: () => ({ status: 401, body: { success: false, error: 'Token inválido' } }) });
    editarFeriado(pagina, 12);
    pagina.elemento('fe-nombre').value = 'Otro';
    await pagina.contexto.guardarFeriado();
    assert.equal(pagina.elemento('feriado-error').hidden, false);
    assert.match(pagina.elemento('feriado-error').innerHTML, /<a href="login\.html">Volvé a ingresar\.<\/a>/);
    assert.equal(textoDe(pagina.elemento('feriado-error').innerHTML), 'Tu sesión venció. Volvé a ingresar.');
    assert.equal(abierto(pagina, 'modal-feriado'), true);
  });

  it('si el primer pedido sale bien y el segundo no: abierto, con el mensaje; el próximo «Guardar» manda solo «no rige»', async () => {
    let rigeFalla = true;
    const pagina = await conModal({
      escribir: (metodo, ruta) => {
        if (!ruta.endsWith('/rige')) {
          return { status: 200, body: { success: true, message: 'Feriado corregido.', avisos: ['Cae domingo: no cambia ningún día hábil.'] } };
        }
        return rigeFalla ? error400('pasa_al', MENSAJES_FERIADO.pasaAl)
          : { status: 200, body: { success: true, message: 'En 2026 no rige: se pasó al 09/11/2026.', data: { nuevo_id: 30 } } };
      }
    });
    editarFeriado(pagina, 12);
    const el = pagina.elemento;
    el('fe-nombre').value = 'Día del Empleado';
    el('fe-no-rige').checked = true;
    disparar(pagina, 'fe-no-rige', 'change');
    el('fe-pasa-al').value = '2027-11-09';
    await pagina.contexto.guardarFeriado();
    assert.equal(abierto(pagina, 'modal-feriado'), true);
    assert.equal(el('feriado-error').hidden, false);
    assert.equal(el('feriado-error').textContent,
      'El feriado se guardó, pero «no rige» no: La fecha a la que se pasó tiene que ser del mismo año.');
    // El 400 en pasa_al marca además «Se pasó al», con el foco ahí
    assert.equal(el('fe-pasa-al').atributos['aria-invalid'], 'true');
    assert.equal(el('fe-pasa-al-error').textContent, MENSAJES_FERIADO.pasaAl);
    assert.equal(el('fe-pasa-al-error').hidden, false);
    assert.equal(pagina.pagina.foco, el('fe-pasa-al'));
    assert.equal(el('fe-guardar').disabled, false);
    assert.deepEqual(escriturasDe(pagina), [['PUT', '/feriados/12'], ['PUT', '/feriados/12/rige']]);
    assert.deepEqual(pagina.pedidos.at(-1).cuerpo, { anio: 2026, rige: false, pasa_al: '2027-11-09' });
    assert.deepEqual(pagina.toasts, [], 'nunca dice «guardado» si algo falló');
    // Corregido «Se pasó al», el próximo «Guardar» no vuelve a mandar el PUT de los campos
    rigeFalla = false;
    el('fe-pasa-al').value = '2026-11-09';
    await pagina.contexto.guardarFeriado();
    assert.deepEqual(escriturasDe(pagina), [['PUT', '/feriados/12'], ['PUT', '/feriados/12/rige'], ['PUT', '/feriados/12/rige']]);
    assert.equal(abierto(pagina, 'modal-feriado'), false);
    assert.equal(el('fe-pasa-al').atributos['aria-invalid'], undefined, 'el error de antes se limpió');
    assert.deepEqual(pagina.toasts, [['Feriado corregido. En 2026 no rige: se pasó al 09/11/2026. Cae domingo: no cambia ningún día hábil.',
      'warning']]);
    assert.equal(pagina.pedidos.at(-1).ruta, '/feriados?anio=2026');
  });

  it('cerrar después de un guardado a medias vuelve a pedir la lista (el feriado ya cambió) y el foco va al «Editar» nuevo', async () => {
    const pagina = await conModal({ escribir: (metodo, ruta) => (ruta.endsWith('/rige') ? { status: 500, body: { success: false,
      error: 'Error al cambiar si rige el feriado' } } : null) });
    editarFeriado(pagina, 12);
    pagina.elemento('fe-nombre').value = 'Día del Empleado';
    pagina.elemento('fe-no-rige').checked = true;
    await pagina.contexto.guardarFeriado();
    assert.equal(pagina.elemento('feriado-error').textContent, 'El feriado se guardó, pero «no rige» no: Error al cambiar si rige el feriado.');
    clicEnModal(pagina, 'modal-feriado', 'data-cerrar-feriado');
    assert.equal(abierto(pagina, 'modal-feriado'), false);
    await esperar();
    await esperar();
    assert.equal(pagina.pedidos.at(-1).ruta, '/feriados?anio=2026');
    assert.equal(pagina.pagina.foco, pagina.elemento('feriados-lista').querySelector('[data-editar-feriado="12"]'));
    assert.equal(pagina.pagina.foco.isConnected, true);
  });

  it('un 404 (se dio de baja mientras el modal estaba abierto) en el PUT y en «no rige»: se cierra, avisa y vuelve a pedir la lista con forzar', async () => {
    for (const enRige of [false, true]) {
      const listas = {};
      const pagina = await conModal({
        listas,
        escribir: () => {
          listas[2026] = LISTA_2026.filter((f) => f.id !== 12);
          return NO_ENCONTRADO;
        }
      });
      editarFeriado(pagina, 12);
      if (enRige) pagina.elemento('fe-no-rige').checked = true;
      else pagina.elemento('fe-nombre').value = 'Otro';
      await pagina.contexto.guardarFeriado();
      assert.deepEqual(escriturasDe(pagina), [['PUT', enRige ? '/feriados/12/rige' : '/feriados/12']]);
      assert.equal(abierto(pagina, 'modal-feriado'), false, String(enRige));
      assert.deepEqual(pagina.toasts, [['Ese feriado ya no está cargado: se dio de baja mientras tanto.', 'error']]);
      assert.equal(pagina.elemento('feriados-anuncio').textContent, 'Ese feriado ya no está cargado: se dio de baja mientras tanto.');
      assert.equal(pagina.pedidos.at(-1).ruta, '/feriados?anio=2026', 'la lista, otra vez');
      assert.equal(filasDe(pagina.elemento('feriados-lista').innerHTML).length, 12);
      // El «Editar» que lo abrió ya no está: el foco va al del que estaba antes (el 11)
      assert.equal(pagina.pagina.foco, pagina.elemento('feriados-lista').querySelector('[data-editar-feriado="11"]'));
    }
  });

  it('un clic en el velo no cierra; la × y «Cancelar» sí, con el foco de vuelta en «Editar» y sin volver a pedir la lista', async () => {
    const pagina = await conModal();
    const boton = editarFeriado(pagina, 12);
    pagina.elemento('fe-nombre').value = 'Algo escrito';
    clicEnModal(pagina, 'modal-feriado');
    assert.equal(abierto(pagina, 'modal-feriado'), true, 'el velo no cierra');
    clicEnModal(pagina, 'modal-feriado', 'data-cerrar-feriado');
    assert.equal(abierto(pagina, 'modal-feriado'), false);
    assert.equal(pagina.pagina.foco, boton);
    assert.equal(pagina.pedidos.length, 1);
  });
});

describe('feriados.js con un DOM: la baja', () => {
  it('Escape cierra primero la baja (el foco vuelve a «Dar de baja») y después el modal (el foco, a «Editar»)', async () => {
    const pagina = await conModal();
    const boton = editarFeriado(pagina, 12);
    apretar(pagina, 'fe-baja');
    assert.equal(abierto(pagina, 'modal-baja-feriado'), true);
    assert.equal(abierto(pagina, 'modal-feriado'), true);
    escape(pagina);
    assert.equal(abierto(pagina, 'modal-baja-feriado'), false);
    assert.equal(abierto(pagina, 'modal-feriado'), true);
    assert.equal(pagina.pagina.foco, pagina.elemento('fe-baja'));
    escape(pagina);
    assert.equal(abierto(pagina, 'modal-feriado'), false);
    assert.equal(pagina.pagina.foco, boton);
    escape(pagina);
    assert.deepEqual(escriturasDe(pagina), []);
  });

  it('el velo de la baja no la cierra; su × y «Cancelar» sí', async () => {
    const pagina = await conModal();
    editarFeriado(pagina, 12);
    apretar(pagina, 'fe-baja');
    clicEnModal(pagina, 'modal-baja-feriado');
    assert.equal(abierto(pagina, 'modal-baja-feriado'), true);
    clicEnModal(pagina, 'modal-baja-feriado', 'data-cerrar-baja-feriado');
    assert.equal(abierto(pagina, 'modal-baja-feriado'), false);
    assert.equal(abierto(pagina, 'modal-feriado'), true);
  });

  it('uno que se repite, mirando 2027: desde qué año (el que se mira, elegido), el texto que cambia con el año, DELETE ?desde= y el foco al de al lado', async () => {
    const listas = {};
    const pagina = await conModal({
      listas,
      escribir: (metodo) => {
        listas[2027] = LISTA_2027.filter((f) => f.id !== 12);
        return metodo === 'DELETE' ? { status: 200, body: { success: true, message: 'Feriado dado de baja.' } } : null;
      }
    });
    await pagina.contexto.elegirAnioFeriado('2027');
    editarFeriado(pagina, 12);
    apretar(pagina, 'fe-baja');
    const el = pagina.elemento;
    assert.equal(el('baja-feriado-desde-grupo').hidden, false);
    assert.equal(el('baja-feriado-desde').innerHTML, '<option value="2026">2026</option><option value="2027" selected>2027</option>');
    assert.equal(el('baja-feriado-desde').value, '2027');
    assert.equal(el('baja-feriado-texto').textContent,
      '¿Dar de baja «Día del Empleado Municipal»? Deja de regir desde 2027. Los años anteriores no cambian.');
    assert.equal(el('baja-feriado-error').hidden, true);
    assert.equal(pagina.pagina.foco, el('baja-feriado-desde'));
    el('baja-feriado-desde').value = '2026';
    disparar(pagina, 'baja-feriado-desde', 'change');
    assert.equal(el('baja-feriado-texto').textContent, '¿Dar de baja «Día del Empleado Municipal»? Se da de baja entero.');
    el('baja-feriado-desde').value = '2027';
    disparar(pagina, 'baja-feriado-desde', 'change');
    await pagina.contexto.confirmarBajaFeriado();
    assert.deepEqual(escriturasDe(pagina), [['DELETE', '/feriados/12?desde=2027']]);
    assert.equal(abierto(pagina, 'modal-baja-feriado'), false);
    assert.equal(abierto(pagina, 'modal-feriado'), false);
    assert.deepEqual(pagina.toasts, [['Feriado dado de baja.', 'success']]);
    assert.equal(el('feriados-anuncio').textContent, 'Feriado dado de baja.');
    assert.equal(pagina.pedidos.at(-1).ruta, '/feriados?anio=2027');
    assert.equal(pagina.pagina.foco, el('feriados-lista').querySelector('[data-editar-feriado="13"]'), 'el de al lado');
  });

  it('uno que no se repite: sin selector, el foco en «Cancelar» y DELETE sin desde', async () => {
    const pagina = await conModal({ escribir: () => ({ status: 200, body: { success: true, message: 'Feriado dado de baja.' } }) });
    editarFeriado(pagina, 11);
    apretar(pagina, 'fe-baja');
    assert.equal(pagina.elemento('baja-feriado-desde-grupo').hidden, true);
    assert.equal(pagina.elemento('baja-feriado-texto').textContent,
      '¿Dar de baja «Paso a la Inmortalidad de Güemes» del lunes 15/06/2026? Deja de contar como día no hábil.');
    assert.equal(pagina.pagina.foco, pagina.elemento('baja-feriado-cancelar'));
    await pagina.contexto.confirmarBajaFeriado();
    assert.deepEqual(escriturasDe(pagina), [['DELETE', '/feriados/11']]);
    assert.equal(abierto(pagina, 'modal-feriado'), false);
  });

  it('un 400 de la baja queda en la confirmación, con el foco en «Dar de baja»; los dos modales siguen abiertos', async () => {
    const pagina = await conModal({ escribir: () => error400('desde', MENSAJES_FERIADO.desde) });
    editarFeriado(pagina, 12);
    apretar(pagina, 'fe-baja');
    await pagina.contexto.confirmarBajaFeriado();
    assert.equal(pagina.elemento('baja-feriado-error').textContent, MENSAJES_FERIADO.desde);
    assert.equal(pagina.elemento('baja-feriado-error').hidden, false);
    assert.equal(pagina.pagina.foco, pagina.elemento('baja-feriado-confirmar'));
    assert.equal(abierto(pagina, 'modal-baja-feriado'), true);
    assert.equal(abierto(pagina, 'modal-feriado'), true);
    assert.deepEqual(pagina.toasts, []);
  });

  it('un 404 en la baja: se cierran los dos, avisa y vuelve a pedir la lista', async () => {
    const pagina = await conModal({ escribir: () => NO_ENCONTRADO });
    editarFeriado(pagina, 11);
    apretar(pagina, 'fe-baja');
    await pagina.contexto.confirmarBajaFeriado();
    assert.equal(abierto(pagina, 'modal-baja-feriado'), false);
    assert.equal(abierto(pagina, 'modal-feriado'), false);
    assert.deepEqual(pagina.toasts, [['Ese feriado ya no está cargado: se dio de baja mientras tanto.', 'error']]);
    assert.equal(pagina.pedidos.at(-1).ruta, '/feriados?anio=2026');
  });

  it('mientras se da de baja: «Dar de baja» deshabilitado, Escape no cierra nada y sale un solo DELETE', async () => {
    const respuesta = demorada();
    const pagina = await conModal({ escribir: () => respuesta.promesa });
    editarFeriado(pagina, 11);
    apretar(pagina, 'fe-baja');
    const baja = pagina.contexto.confirmarBajaFeriado();
    assert.equal(pagina.elemento('baja-feriado-confirmar').disabled, true);
    apretar(pagina, 'baja-feriado-confirmar');
    escape(pagina);
    clicEnModal(pagina, 'modal-baja-feriado', 'data-cerrar-baja-feriado');
    assert.equal(abierto(pagina, 'modal-baja-feriado'), true);
    assert.equal(abierto(pagina, 'modal-feriado'), true);
    respuesta.soltar({ status: 200, body: { success: true, message: 'Feriado dado de baja.' } });
    await baja;
    assert.deepEqual(escriturasDe(pagina), [['DELETE', '/feriados/11']]);
    assert.equal(abierto(pagina, 'modal-feriado'), false);
  });
});

// ======================================================================
// Lo que llega mientras tanto (revisión de la Task 7): «Editar» durante la recarga después de guardar, otro modal mientras se guarda o
// se da de baja, el feriado del modal después de un guardado a medias y el 401 de «no rige»
// ======================================================================

describe('feriados.js: conLoGuardadoFeriado', () => {
  it('una copia con lo guardado (la fecha, el nombre recortado, el tipo, «se repite» y el trasladado); el feriado de la lista no cambia', () => {
    const copia = F.conLoGuardadoFeriado(EMPLEADO_2027,
      { fecha: '2025-11-09', nombre: ' Otro ', tipo: 'provincial', trasladado_de: '2025-11-08', se_repite: false });
    assert.deepEqual(plano(copia), {
      ...EMPLEADO_2027, fecha_guardada: '2025-11-09', nombre: 'Otro', tipo: 'provincial', se_repite: 0, trasladado_de_guardado: '2025-11-08'
    });
    assert.equal(EMPLEADO_2027.nombre, 'Día del Empleado Municipal');
    assert.equal(EMPLEADO_2027.fecha_guardada, '2026-11-08');
    assert.equal(F.conLoGuardadoFeriado(EMPLEADO_2027, { ...F.valoresDelFeriado(EMPLEADO_2027), trasladado_de: '' }).trasladado_de_guardado, null);
    assert.equal(F.conLoGuardadoFeriado(null, {}), null);
  });
});

describe('feriados.js con un DOM: lo que llega mientras tanto', () => {
  it('«Editar» del mismo feriado justo después de guardar, antes de que llegue la lista: espera y abre con lo guardado (no lo deshace)', async () => {
    let getDemorado = null;
    const pagina = crearPagina({
      servidor: async (metodo) => {
        if (metodo === 'GET') return getDemorado ? getDemorado.promesa : { status: 200, body: RESPUESTA_2026 };
        return OK_CORREGIDO;
      }
    });
    pagina.alCargar();
    await pagina.contexto.cargarFeriados();
    editarFeriado(pagina, 11);
    pagina.elemento('fe-nombre').value = 'Paso a la Inmortalidad del General Güemes';
    getDemorado = demorada();
    const guardado = pagina.contexto.guardarFeriado();
    await esperar();
    assert.equal(abierto(pagina, 'modal-feriado'), false, 'se cerró; la lista se está volviendo a pedir');
    assert.match(pagina.elemento('feriados-lista').innerHTML, /<table/, 'la tabla de antes sigue a la vista');
    // El foco quedó en «Editar» de la tabla de antes: Enter vuelve a abrirlo
    pagina.clic({ 'data-editar-feriado': '11' });
    assert.equal(abierto(pagina, 'modal-feriado'), false, 'espera la lista nueva');
    const nueva = plano(feriadosDelAnio(FILAS.map((f) => (f.id === 11 ? { ...f, nombre: 'Paso a la Inmortalidad del General Güemes' } : f)), 2026));
    getDemorado.soltar({ status: 200, body: respuestaDe(2026, nueva) });
    await guardado;
    await esperar();
    assert.equal(abierto(pagina, 'modal-feriado'), true);
    assert.equal(pagina.elemento('fe-nombre').value, 'Paso a la Inmortalidad del General Güemes');
    assert.equal(pagina.elemento('modal-feriado-titulo').textContent, 'Editar «Paso a la Inmortalidad del General Güemes»');
    assert.equal(pagina.pagina.foco, pagina.elemento('fe-fecha'), 'la recarga no le saca el foco al modal');
    // Guardar sin tocar nada no pide nada: no manda los datos de antes
    await pagina.contexto.guardarFeriado();
    assert.deepEqual(escriturasDe(pagina), [['PUT', '/feriados/11']]);
  });

  it('mientras se guarda, no se abre otro modal ni la baja: la respuesta queda en el modal que la pidió', async () => {
    const respuesta = demorada();
    const pagina = await conModal({ escribir: () => respuesta.promesa });
    editarFeriado(pagina, 12);
    pagina.elemento('fe-nombre').value = 'Otro';
    const guardado = pagina.contexto.guardarFeriado();
    const sesion = enPagina(pagina, 'modalDelFeriado');
    apretar(pagina, 'btn-nuevo-feriado');
    pagina.clic({ 'data-editar-feriado': '11' });
    pagina.contexto.abrirModalFeriado(pagina.contexto.feriadoDeLaLista('13'), null);
    pagina.contexto.abrirModalBajaFeriado(null);
    assert.equal(enPagina(pagina, 'modalDelFeriado'), sesion);
    assert.equal(pagina.elemento('modal-feriado-titulo').textContent, 'Editar «Día del Empleado Municipal»');
    assert.equal(pagina.elemento('fe-nombre').value, 'Otro');
    assert.equal(abierto(pagina, 'modal-baja-feriado'), false);
    respuesta.soltar(error400('fecha', MENSAJES_FERIADO.fecha));
    await guardado;
    assert.equal(abierto(pagina, 'modal-feriado'), true);
    assert.equal(pagina.elemento('fe-fecha').atributos['aria-invalid'], 'true', 'el error, en el formulario que lo pidió');
    assert.equal(pagina.elemento('modal-feriado-titulo').textContent, 'Editar «Día del Empleado Municipal»');
  });

  it('mientras se da de baja, no se abre otro modal ni se vuelve a armar la confirmación', async () => {
    const respuesta = demorada();
    const pagina = await conModal({ escribir: () => respuesta.promesa });
    editarFeriado(pagina, 12);
    apretar(pagina, 'fe-baja');
    const baja = pagina.contexto.confirmarBajaFeriado();
    const sesion = enPagina(pagina, 'modalDelFeriado');
    const confirmacion = enPagina(pagina, 'bajaDelFeriado');
    apretar(pagina, 'btn-nuevo-feriado');
    pagina.clic({ 'data-editar-feriado': '11' });
    pagina.contexto.abrirModalBajaFeriado(null);
    assert.equal(enPagina(pagina, 'modalDelFeriado'), sesion);
    assert.equal(enPagina(pagina, 'bajaDelFeriado'), confirmacion);
    assert.equal(pagina.elemento('baja-feriado-confirmar').disabled, true, 'sigue esperando');
    respuesta.soltar({ status: 200, body: { success: true, message: 'Feriado dado de baja.' } });
    await baja;
    assert.equal(abierto(pagina, 'modal-feriado'), false);
    assert.equal(abierto(pagina, 'modal-baja-feriado'), false);
    assert.deepEqual(escriturasDe(pagina), [['DELETE', '/feriados/12?desde=2026']]);
  });

  it('después de un guardado a medias, el título, la pregunta de la baja y sus años son los de lo guardado', async () => {
    const pagina = await conModal({
      escribir: (metodo, ruta) => (ruta.endsWith('/rige') ? error400('pasa_al', MENSAJES_FERIADO.pasaAl) : null)
    });
    editarFeriado(pagina, 12);
    const el = pagina.elemento;
    el('fe-nombre').value = 'Día del Trabajador Municipal';
    el('fe-fecha').value = '2025-11-08';
    el('fe-no-rige').checked = true;
    disparar(pagina, 'fe-no-rige', 'change');
    el('fe-pasa-al').value = '2027-11-09';
    await pagina.contexto.guardarFeriado();
    assert.deepEqual(escriturasDe(pagina), [['PUT', '/feriados/12'], ['PUT', '/feriados/12/rige']]);
    assert.equal(el('modal-feriado-titulo').textContent, 'Editar «Día del Trabajador Municipal»');
    assert.equal(el('fe-fecha-ayuda').textContent,
      'Es la fecha de su primer año (2025): corregirla cambia todos los años. Si solo en 2026 se corrió, marcá «En 2026 no rige».',
      'la ayuda de la fecha, con el primer año nuevo');
    apretar(pagina, 'fe-baja');
    assert.equal(el('baja-feriado-desde').innerHTML,
      '<option value="2025">2025</option><option value="2026" selected>2026</option><option value="2027">2027</option>', 'desde su primer año nuevo');
    assert.equal(el('baja-feriado-texto').textContent,
      '¿Dar de baja «Día del Trabajador Municipal»? Deja de regir desde 2026. Los años anteriores no cambian.');
  });

  it('un 401 en «no rige» después de guardar los campos: el aviso a medias, con el link a login.html', async () => {
    const pagina = await conModal({
      escribir: (metodo, ruta) => (ruta.endsWith('/rige') ? { status: 401, body: { success: false, error: 'Token inválido' } } : null)
    });
    editarFeriado(pagina, 12);
    pagina.elemento('fe-nombre').value = 'Otro';
    pagina.elemento('fe-no-rige').checked = true;
    await pagina.contexto.guardarFeriado();
    const caja = pagina.elemento('feriado-error');
    assert.equal(caja.hidden, false);
    assert.equal(textoDe(caja.innerHTML), 'El feriado se guardó, pero «no rige» no: Tu sesión venció. Volvé a ingresar.');
    assert.match(caja.innerHTML, /<a href="login\.html">Volvé a ingresar\.<\/a>/);
    assert.equal(pagina.pagina.foco, pagina.elemento('fe-guardar'));
    assert.equal(abierto(pagina, 'modal-feriado'), true);
  });
});

// Cuántas licencias de Mi espacio incluye la fecha (spec 2026-10-26-feriados, 4: desde la entrega 2, antes de guardar): solo un
// cambio de la fecha o de «Se repite» hecho por quien usa el modal la pide, 300 ms después del último, con temporizadores que vence
// el test; abrir el modal no pide nada
describe('feriados.js con un DOM: las licencias que incluye la fecha', () => {
  const DEL_HTML = 'fe-fecha-dia fe-fecha-error';
  // La pestaña cargada con 2026 y temporizadores a mano. `afectadas(ruta)` contesta GET /feriados/afectadas (un número, o una
  // promesa de uno)
  const conAfectadas = async (afectadas) => {
    const pagina = crearPagina({
      temporizadores: true,
      servidor: async (metodo, ruta) => (ruta.startsWith('/feriados/afectadas?')
        ? { status: 200, body: { success: true, data: { licencias_afectadas: await afectadas(ruta) } } }
        : { status: 200, body: RESPUESTA_2026 })
    });
    pagina.alCargar();
    await pagina.contexto.cargarFeriados();
    pagina.elemento('fe-fecha').setAttribute('aria-describedby', DEL_HTML);
    return pagina;
  };
  const pedidasDe = (pagina) => pagina.pedidos.filter((p) => p.ruta.startsWith('/feriados/afectadas')).map((p) => p.ruta);
  const leyenda = (pagina) => [pagina.elemento('fe-fecha-afectadas').hidden, pagina.elemento('fe-fecha-afectadas').textContent,
    pagina.elemento('fe-fecha').getAttribute('aria-describedby')];
  const cambiarFecha = (pagina, valor, tipo = 'input') => {
    pagina.elemento('fe-fecha').value = valor;
    disparar(pagina, 'fe-fecha', tipo);
  };
  const DOS = '2 licencias cargadas lo incluyen: sus días hábiles se recalculan.';
  const UNA = '1 licencia cargada lo incluye: sus días hábiles se recalculan.';

  it('dos cambios seguidos de la fecha: un solo pedido, 300 ms después del último, y la cantidad debajo de la fecha', async () => {
    const pagina = await conAfectadas(() => 2);
    apretar(pagina, 'btn-nuevo-feriado');
    pagina.vencer();
    assert.equal(pagina.pagina.foco, pagina.elemento('fe-fecha'));
    assert.deepEqual(pedidasDe(pagina), [], 'abrir el modal no pide nada');
    assert.deepEqual(leyenda(pagina), [true, '', DEL_HTML]);

    cambiarFecha(pagina, '2026-12-12');
    cambiarFecha(pagina, '2026-12-13', 'change');
    assert.deepEqual(pedidasDe(pagina), [], 'todavía no');
    assert.deepEqual([...pagina.temporizadores.values()].map((t) => t.ms), [300], 'un solo temporizador, el del último cambio');
    pagina.vencer();
    await esperar();
    assert.deepEqual(pedidasDe(pagina), ['/feriados/afectadas?fecha=2026-12-13&se_repite=0'], 'una sola vez, con la última fecha');
    assert.deepEqual(leyenda(pagina), [false, DOS, 'fe-fecha-dia fe-fecha-afectadas fe-fecha-error']);
    assert.equal(pagina.elemento('fe-fecha-afectadas').escrituras, 0, 'texto plano: nunca como HTML');

    // «Se repite» también la pide, con se_repite=1
    pagina.elemento('fe-se-repite').checked = true;
    disparar(pagina, 'fe-se-repite', 'change');
    pagina.vencer();
    await esperar();
    assert.deepEqual(pedidasDe(pagina).at(-1), '/feriados/afectadas?fecha=2026-12-13&se_repite=1');
    assert.equal(pedidasDe(pagina).length, 2);
  });

  it('al corregir, con el id; con 0, nada; una fecha a medias no pide nada', async () => {
    const pagina = await conAfectadas((ruta) => (ruta.includes('fecha=2026-11-09') ? 1 : 0));
    // Uno que se repite: la ayuda de la fecha también está, y va antes que las licencias
    const CON_AYUDA = 'fe-fecha-dia fe-fecha-ayuda fe-fecha-error';
    editarFeriado(pagina, 12);
    pagina.vencer();
    assert.deepEqual(pedidasDe(pagina), [], 'abrir el modal no pide nada');
    assert.deepEqual(leyenda(pagina), [true, '', CON_AYUDA]);
    cambiarFecha(pagina, '2026-11-09');
    pagina.vencer();
    await esperar();
    assert.deepEqual(pedidasDe(pagina), ['/feriados/afectadas?fecha=2026-11-09&se_repite=1&id=12']);
    assert.deepEqual(leyenda(pagina), [false, UNA, 'fe-fecha-dia fe-fecha-ayuda fe-fecha-afectadas fe-fecha-error']);

    cambiarFecha(pagina, '2026-11-10');
    assert.deepEqual(leyenda(pagina), [true, '', CON_AYUDA], 'al cambiar la fecha, la cantidad vieja se va');
    pagina.vencer();
    await esperar();
    assert.equal(pedidasDe(pagina).length, 2);
    assert.deepEqual(leyenda(pagina), [true, '', CON_AYUDA], 'con 0, nada');

    cambiarFecha(pagina, '', 'change');
    pagina.vencer();
    await esperar();
    assert.equal(pedidasDe(pagina).length, 2, 'sin una fecha, no se pide');
    assert.deepEqual(leyenda(pagina), [true, '', CON_AYUDA]);
  });

  it('la respuesta vieja se descarta, y cerrar el modal descarta lo pendiente', async () => {
    const respuestas = new Map([['2026-12-13', demorada()], ['2026-12-14', demorada()]]);
    const pagina = await conAfectadas((ruta) => respuestas.get(ruta.match(/fecha=([\d-]+)/)[1]).promesa);
    apretar(pagina, 'btn-nuevo-feriado');
    pagina.vencer();
    cambiarFecha(pagina, '2026-12-13');
    pagina.vencer();
    cambiarFecha(pagina, '2026-12-14');
    pagina.vencer();
    assert.equal(pedidasDe(pagina).length, 2);
    respuestas.get('2026-12-14').soltar(1);
    await esperar();
    assert.deepEqual(leyenda(pagina), [false, UNA, 'fe-fecha-dia fe-fecha-afectadas fe-fecha-error']);
    respuestas.get('2026-12-13').soltar(2);
    await esperar();
    assert.deepEqual(leyenda(pagina), [false, UNA, 'fe-fecha-dia fe-fecha-afectadas fe-fecha-error'], 'la vieja no pisa la nueva');

    // Cerrar con un cambio sin vencer: no se pide; abrir otra vez, sin la cantidad
    cambiarFecha(pagina, '2026-12-15');
    clicEnModal(pagina, 'modal-feriado', 'data-cerrar-feriado');
    assert.equal(pagina.temporizadores.size, 0, 'el pendiente se cancela al cerrar');
    apretar(pagina, 'btn-nuevo-feriado');
    pagina.vencer();
    assert.equal(pedidasDe(pagina).length, 2);
    assert.deepEqual(leyenda(pagina), [true, '', DEL_HTML]);
  });
});
