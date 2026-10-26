// La página de Proyectos (spec 2026-10-25-proyectos, 1, 2 y 10), ejecutada en Node: lo puro de public/js/proyectos.js (la
// dirección, la ventana de 3 años con sus flechas, los filtros con sus cantidades, el orden, los puntos de cada carril que se
// juntan según el ancho de la pista, la frase del año resaltado y el HTML de los filtros y los carriles; y, desde la Task 6, el
// detalle de un proyecto —la ficha, la cinta del recorrido (que nada se salga ni se pise), las filas de los hitos, los archivos y
// los documentos—, la línea de tiempo y los logros, con lo que ve cada rol y los vacíos de la spec) con datos inventados y
// con los 8 proyectos y los 17 hitos de la maqueta (anonimizados: docs/superpowers/specs/2026-10-25-proyectos-mockups/js/
// maqueta-datos.js, que se lee al correr, sin copiar sus nombres acá), pasados a la forma de la API (GET /gestion/proyectos y
// /gestion/timeline). Como seguimiento.js y reportes.js, el script al cargarse solo declara: se carga en un vm después del
// main.js de verdad (getIconSvg e ICON_SELECTOR_MAP) y del api.js de verdad (Utils), como en la página.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import {
  ESTADOS_PROYECTO, PRIORIDADES, CATEGORIAS, ICONOS_PROYECTO, LARGOS, FECHA_MINIMA, MENSAJES_PROYECTOS, fechaMaxima, validarProyecto,
  validarHito
} from '../services/proyectosReglas.js';
import * as subidas from '../config/upload.js';

const leer = (ruta) => fs.readFileSync(new URL(`../public/${ruta}`, import.meta.url), 'utf8');
const HOY = '2026-10-25';

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
    Auth: { isAuthenticated: () => true, isAdmin: () => false },
    window: { location: { search: '', hash: '', pathname: '/proyectos.html' } }
  });
  // En el orden de la página: main.js antes que api.js
  vm.runInContext(leer('js/main.js'), contexto);
  vm.runInContext(`${leer('js/api.js')}\n;globalThis.Utils = Utils;`, contexto);
  return contexto;
};

const cargar = () => {
  const contexto = cargarBase();
  vm.runInContext(leer('js/proyectos.js'), contexto);
  return contexto;
};

// Lo que devuelve una función del vm es de otro contexto: deepStrictEqual compara prototipos, así que se pasa a uno de acá
const plano = (valor) => JSON.parse(JSON.stringify(valor));
const ctx = cargar();
const constante = (nombre) => plano(vm.runInContext(nombre, ctx));
const cuantas = (texto, patron) => (texto.match(patron) ?? []).length;

// Los datos de la maqueta, con la forma de la API: los proyectos con sus cantidades y los hitos como los manda el timeline
const MAQUETA = (() => {
  const contexto = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(new URL('../docs/superpowers/specs/2026-10-25-proyectos-mockups/js/maqueta-datos.js', import.meta.url), 'utf8'), contexto);
  return plano(contexto.window.DATOS);
})();
const PROYECTOS = MAQUETA.proyectos.map(({ documentos, created_at: _c, updated_at: _u, ...proyecto }) => {
  const suyos = MAQUETA.hitos.filter((h) => h.proyecto_id === proyecto.id);
  return { ...proyecto, cantidad_hitos: suyos.length, hitos_completados: suyos.filter((h) => h.fecha <= HOY).length, cantidad_documentos: documentos.length };
});
const HITOS = MAQUETA.hitos.map(({ inventado: _i, archivos, ...hito }) => {
  const proyecto = MAQUETA.proyectos.find((p) => p.id === hito.proyecto_id) ?? null;
  return {
    ...hito,
    proyecto_nombre: proyecto?.nombre ?? null,
    proyecto_color: proyecto?.color ?? null,
    proyecto_icono: proyecto?.icono ?? null,
    categoria: proyecto?.categoria ?? null,
    archivos: archivos.map(({ created_at, hito_id: _h, ...archivo }) => ({ ...archivo, subido_el: created_at }))
  };
});
const hitosDe = (id) => HITOS.filter((h) => h.proyecto_id === id);
const LOGROS = HITOS.filter((h) => h.proyecto_id === null);
const INDICE = 7;
const RPAD = 6;
const DATATHON = 2;

const BOLETIN = 4;
const ANDINO = 8;
const CHARLA = 5;

// Un proyecto como lo manda GET /gestion/proyectos/:id: los campos de la lista más sus hitos (los más nuevos primero, sin los
// campos del timeline) y sus documentos (con `subido_el`)
const detalleDe = (id) => {
  const documentos = MAQUETA.proyectos.find((p) => p.id === id).documentos
    .map(({ created_at, proyecto_id: _p, ...documento }) => ({ ...documento, subido_el: created_at }));
  const hitos = hitosDe(id)
    .map(({ proyecto_nombre: _n, proyecto_color: _c, proyecto_icono: _i, categoria: _k, ...h }) => h)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  return { ...PROYECTOS.find((p) => p.id === id), hitos, documentos };
};

const DE_ENTRADA = { busqueda: '', estado: 'todos', categoria: 'todas', anios: 2026, resaltar: null };
const VENTANA = { desde: 2024, hasta: 2026, anterior: true, siguiente: false };

// Un proyecto y un hito inventados
const proyecto = (cambios = {}) => ({
  id: 900, nombre: '[TEST] Proyecto', descripcion: '', estado: 'en_curso', fecha_inicio: null, icono: 'folder', color: '#2E6B4C',
  responsable: null, enlace_externo: null, prioridad: 'media', categoria: 'tecnologia', orden: 0, areas: [],
  cantidad_hitos: 0, hitos_completados: 0, cantidad_documentos: 0, ...cambios
});
const hito = (id, proyectoId, fecha, titulo = `[TEST] Hito ${id}`) => ({
  id, proyecto_id: proyectoId, titulo, fecha, descripcion: null, evidencia_tipo: 'ninguno', evidencia_url: null,
  proyecto_nombre: null, proyecto_color: null, proyecto_icono: null, categoria: null, archivos: []
});

// El carril (el <li>) de un proyecto, por su link
const carrilDe = (html, id) => html.match(new RegExp(`<li><a class="pr-carril" href="\\?(?:[^"]*&amp;)?id=${id}">[\\s\\S]*?</a></li>`))?.[0] ?? '';
const carrilesDe = (opciones = {}, proyectos = PROYECTOS, hitos = HITOS) =>
  ctx.htmlDeCarriles(proyectos, hitos, { estado: DE_ENTRADA, hoy: HOY, anchoPx: 600, esAdmin: false, ...opciones });

describe('proyectos.js: al cargarse solo declara', () => {
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
    vm.runInContext(leer('js/proyectos.js'), contexto);
    assert.ok(enganchados.every((evento) => evento === 'DOMContentLoaded'), enganchados.join(', '));
  });
});

describe('proyectos.js: las constantes', () => {
  it('los estados, las categorías y las prioridades son los de services/proyectosReglas.js, con sus textos', () => {
    assert.deepEqual(constante('ORDEN_ESTADOS'), ['en_curso', 'idea', 'completado', 'suspendido']);
    assert.deepEqual([...constante('ORDEN_ESTADOS')].sort(), [...ESTADOS_PROYECTO].sort());
    assert.deepEqual(constante('TEXTO_ESTADO'), { en_curso: 'En curso', idea: 'Idea', completado: 'Completado', suspendido: 'Suspendido' });
    assert.deepEqual(constante('TEXTO_ESTADO_PLURAL'), { en_curso: 'En curso', idea: 'Ideas', completado: 'Completados', suspendido: 'Suspendidos' });
    assert.deepEqual(Object.keys(constante('TEXTO_CATEGORIA')), [...CATEGORIAS]);
    assert.deepEqual(constante('TEXTO_CATEGORIA'), { tecnologia: 'Tecnología', normativa: 'Normativa', difusion: 'Difusión' });
    assert.deepEqual(Object.keys(constante('TEXTO_PRIORIDAD')), [...PRIORIDADES]);
    assert.deepEqual(constante('TEXTO_PRIORIDAD'), { alta: 'Alta', media: 'Media', baja: 'Baja' });
    assert.equal(constante('ANIOS_VENTANA'), 3);
  });
});

describe('proyectos.js: la dirección guarda la vista (spec 2.4)', () => {
  it('sin parámetros, los de entrada: sin búsqueda, todos los estados y categorías, la ventana que termina hoy y sin resaltar', () => {
    assert.deepEqual(plano(ctx.estadoDeLaUrl('', HOY)), DE_ENTRADA);
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?', HOY)), DE_ENTRADA);
  });

  it('un valor que no sirve cae al de entrada', () => {
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?estado=x&anios=abc', HOY)), DE_ENTRADA);
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?estado=__proto__&categoria=constructor&anios=20255&resaltar=hoy', HOY)), DE_ENTRADA);
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?categoria=toString&anios=0999', HOY)), DE_ENTRADA);
  });

  it('lo elegido se lee de la dirección (también con el fragmento de la pestaña)', () => {
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?estado=en_curso&categoria=difusion&busqueda=indice&anios=2025&resaltar=2025#proyectos', HOY)),
      { busqueda: 'indice', estado: 'en_curso', categoria: 'difusion', anios: 2025, resaltar: '2025' });
    assert.deepEqual(plano(ctx.estadoDeLaUrl('?busqueda=%C3%ADndice+abierto&id=7', HOY)), { ...DE_ENTRADA, busqueda: 'índice abierto' });
  });

  it('un año resaltado fuera de la ventana no se resalta', () => {
    assert.equal(ctx.estadoDeLaUrl('?resaltar=2023', HOY).resaltar, null);
    assert.equal(ctx.estadoDeLaUrl('?resaltar=2024', HOY).resaltar, '2024');
    assert.equal(ctx.estadoDeLaUrl('?anios=2025&resaltar=2026', HOY).resaltar, null);
    assert.equal(ctx.estadoDeLaUrl('?anios=2025&resaltar=2023', HOY).resaltar, '2023');
  });

  it('solo se escriben los que no son los de entrada, en el orden estado, categoria, busqueda, anios y resaltar', () => {
    assert.equal(ctx.urlDeEstado(DE_ENTRADA, HOY), '');
    assert.equal(ctx.urlDeEstado({ ...DE_ENTRADA, estado: 'en_curso', resaltar: '2025' }, HOY), '?estado=en_curso&resaltar=2025');
    assert.equal(ctx.urlDeEstado({ resaltar: '2025', anios: 2025, busqueda: 'indice', categoria: 'difusion', estado: 'en_curso' }, HOY),
      '?estado=en_curso&categoria=difusion&busqueda=indice&anios=2025&resaltar=2025');
    // El año de hoy es el de entrada; una búsqueda en blanco no se escribe
    assert.equal(ctx.urlDeEstado({ ...DE_ENTRADA, anios: 2026, busqueda: '   ' }, HOY), '');
    assert.equal(ctx.urlDeEstado({ ...DE_ENTRADA, anios: 2023 }, HOY), '?anios=2023');
    // Lo que no sirve no se escribe
    assert.equal(ctx.urlDeEstado({ ...DE_ENTRADA, estado: 'x', categoria: 'constructor', anios: 'abc', resaltar: '<b>' }, HOY), '');
    assert.equal(ctx.urlDeEstado(null, HOY), '');
  });

  it('ida y vuelta: la búsqueda con tildes, espacios y símbolos vuelve igual, y la dirección no lleva nada sin codificar', () => {
    const estado = { busqueda: 'índice & "datos" #2', estado: 'idea', categoria: 'normativa', anios: 2024, resaltar: '2022' };
    const url = ctx.urlDeEstado(estado, HOY);
    assert.doesNotMatch(url.slice(1), /[ "#<>]/);
    assert.deepEqual(plano(ctx.estadoDeLaUrl(url, HOY)), estado);
  });

  it('estadoConVentana: la ventana queda dentro de los años con hitos y el resaltado que queda afuera vuelve a «Ninguno»', () => {
    const extremos = { min: 2021, max: 2026 };
    assert.deepEqual(plano(ctx.estadoConVentana({ ...DE_ENTRADA, anios: 2019 }, extremos)), { ...DE_ENTRADA, anios: 2023 });
    assert.deepEqual(plano(ctx.estadoConVentana({ ...DE_ENTRADA, anios: 2030, resaltar: '2030' }, extremos)), { ...DE_ENTRADA, anios: 2026 });
    assert.deepEqual(plano(ctx.estadoConVentana({ ...DE_ENTRADA, anios: 2025, resaltar: '2026' }, extremos)), { ...DE_ENTRADA, anios: 2025 });
    assert.deepEqual(plano(ctx.estadoConVentana({ ...DE_ENTRADA, anios: 2025, resaltar: '2024' }, extremos)), { ...DE_ENTRADA, anios: 2025, resaltar: '2024' });
  });

  it('sinFiltros: «Ver todos los proyectos» limpia la búsqueda, el estado y la categoría, y deja la ventana y el resaltado', () => {
    assert.deepEqual(plano(ctx.sinFiltros({ busqueda: 'x', estado: 'idea', categoria: 'difusion', anios: 2025, resaltar: '2024' })),
      { busqueda: '', estado: 'todos', categoria: 'todas', anios: 2025, resaltar: '2024' });
  });
});

describe('proyectos.js: la ventana de 3 años (spec 2.2)', () => {
  it('los extremos de la maqueta: el hito y la elevación más viejos (2021) y el mayor entre hoy y el último hito (2026)', () => {
    assert.deepEqual(plano(ctx.extremosDeAnios(PROYECTOS, HITOS, HOY)), { min: 2021, max: 2026 });
  });

  it('un hito previsto después de hoy estira el final; una elevación más vieja que los hitos, el principio', () => {
    assert.deepEqual(plano(ctx.extremosDeAnios(PROYECTOS, [...HITOS, hito(1, 2, '2028-03-01')], HOY)), { min: 2021, max: 2028 });
    assert.deepEqual(plano(ctx.extremosDeAnios([...PROYECTOS, proyecto({ fecha_inicio: '2019-05-01' })], HITOS, HOY)), { min: 2019, max: 2026 });
    // Una elevación posterior a hoy no estira el final (solo los hitos)
    assert.deepEqual(plano(ctx.extremosDeAnios([proyecto({ fecha_inicio: '2029-05-01' })], [], HOY)), { min: 2026, max: 2026 });
  });

  it('sin fechas, el año de hoy; las fechas que no sirven no cuentan', () => {
    assert.deepEqual(plano(ctx.extremosDeAnios([], [], HOY)), { min: 2026, max: 2026 });
    assert.deepEqual(plano(ctx.extremosDeAnios([proyecto({ fecha_inicio: '2019-02-30' })], [hito(1, 900, 'abc'), hito(2, 900, null)], HOY)), { min: 2026, max: 2026 });
  });

  it('ventanaDe: el final queda entre el primero posible y el último, y las flechas dicen si hay años hacia cada lado', () => {
    assert.deepEqual(plano(ctx.ventanaDe(2026, { min: 2021, max: 2026 })), { desde: 2024, hasta: 2026, anterior: true, siguiente: false });
    assert.deepEqual(plano(ctx.ventanaDe(2019, { min: 2021, max: 2026 })), { desde: 2021, hasta: 2023, anterior: false, siguiente: true });
    assert.deepEqual(plano(ctx.ventanaDe(2024, { min: 2021, max: 2026 })), { desde: 2022, hasta: 2024, anterior: true, siguiente: true });
    assert.deepEqual(plano(ctx.ventanaDe(2031, { min: 2021, max: 2026 })), { desde: 2024, hasta: 2026, anterior: true, siguiente: false });
    // Si todo entra en 3 años, ninguna flecha
    assert.deepEqual(plano(ctx.ventanaDe(2026, { min: 2025, max: 2026 })), { desde: 2024, hasta: 2026, anterior: false, siguiente: false });
    assert.deepEqual(plano(ctx.ventanaDe(2026, { min: 2026, max: 2026 })), { desde: 2024, hasta: 2026, anterior: false, siguiente: false });
    // Un final que no es un número es el último
    assert.deepEqual(plano(ctx.ventanaDe(NaN, { min: 2021, max: 2026 })), { desde: 2024, hasta: 2026, anterior: true, siguiente: false });
  });
});

describe('proyectos.js: los filtros y el orden (spec 2 y 2.1)', () => {
  const ids = (lista) => plano(lista.map((p) => p.id));

  it('el buscador encuentra sin tildes ni mayúsculas en el nombre, la descripción y el autor', () => {
    assert.deepEqual(ids(ctx.filtrarProyectos(PROYECTOS, { ...DE_ENTRADA, busqueda: 'INDICE' })), [INDICE]);
    assert.deepEqual(ids(ctx.filtrarProyectos(PROYECTOS, { ...DE_ENTRADA, busqueda: '  índice ' })), [INDICE]);
    const propios = [proyecto({ id: 1, nombre: '[TEST] Uno', descripcion: 'Una MIGRACIÓN del portal' }),
      proyecto({ id: 2, nombre: '[TEST] Dos', responsable: '[TEST] Ana Gómez' }), proyecto({ id: 3, nombre: '[TEST] Tres', descripcion: null })];
    assert.deepEqual(ids(ctx.filtrarProyectos(propios, { ...DE_ENTRADA, busqueda: 'migracion' })), [1]);
    assert.deepEqual(ids(ctx.filtrarProyectos(propios, { ...DE_ENTRADA, busqueda: 'GOMEZ' })), [2]);
    assert.deepEqual(ids(ctx.filtrarProyectos(propios, { ...DE_ENTRADA, busqueda: 'null' })), []);
    assert.deepEqual(ids(ctx.filtrarProyectos(propios, DE_ENTRADA)), [1, 2, 3]);
  });

  it('el estado y la categoría', () => {
    assert.deepEqual(ids(ctx.filtrarProyectos(PROYECTOS, { ...DE_ENTRADA, estado: 'en_curso' })).sort(), [3, 7]);
    assert.deepEqual(ids(ctx.filtrarProyectos(PROYECTOS, { ...DE_ENTRADA, categoria: 'difusion' })).sort(), [3, 5, 7]);
    assert.deepEqual(ids(ctx.filtrarProyectos(PROYECTOS, { ...DE_ENTRADA, estado: 'idea', categoria: 'difusion' })), [5]);
    assert.deepEqual(ids(ctx.filtrarProyectos(PROYECTOS, { ...DE_ENTRADA, estado: 'suspendido' })), []);
  });

  it('cada grupo cuenta con los otros filtros: con Difusión elegida, los estados cuentan solo los de Difusión', () => {
    const cantidades = plano(ctx.cantidadesDeFiltros(PROYECTOS, { ...DE_ENTRADA, categoria: 'difusion' }, HITOS));
    assert.deepEqual(cantidades.estado, { todos: 3, en_curso: 2, idea: 1, completado: 0, suspendido: 0 });
    assert.deepEqual(cantidades.categoria, { todas: 8, tecnologia: 5, normativa: 0, difusion: 3 });
    const enCurso = plano(ctx.cantidadesDeFiltros(PROYECTOS, { ...DE_ENTRADA, estado: 'en_curso', busqueda: 'datos' }, HITOS));
    // «datos» está en todos menos en el Boletín Oficial (una idea de tecnología)
    assert.deepEqual(enCurso.estado, { todos: 7, en_curso: 2, idea: 3, completado: 2, suspendido: 0 });
    assert.deepEqual(enCurso.categoria, { todas: 2, tecnologia: 0, normativa: 0, difusion: 2 });
  });

  it('las cantidades sin ningún filtro (qué chips aparecen) y los hitos de cada año, todos, sin los filtros', () => {
    const cantidades = plano(ctx.cantidadesDeFiltros(PROYECTOS, { ...DE_ENTRADA, busqueda: 'indice', categoria: 'difusion' }, HITOS));
    assert.deepEqual(cantidades.sinFiltros.estado, { todos: 8, en_curso: 2, idea: 4, completado: 2, suspendido: 0 });
    assert.deepEqual(cantidades.sinFiltros.categoria, { todas: 8, tecnologia: 5, normativa: 0, difusion: 3 });
    assert.deepEqual(cantidades.anio, { 2021: 1, 2022: 1, 2023: 1, 2024: 1, 2025: 7, 2026: 6 });
    assert.deepEqual(plano(ctx.cantidadesDeFiltros(PROYECTOS, DE_ENTRADA).anio), {});
  });

  it('el orden de la maqueta: en curso, ideas y completados; dentro, el del hito cumplido más nuevo primero y después por nombre', () => {
    // Las dos ideas sin hitos cumplidos, por nombre: «Datathon 2026» antes que «Datos abiertos en acción…»
    assert.deepEqual(ids(ctx.ordenarProyectos(PROYECTOS, HITOS, HOY)), [3, 7, 1, 4, 2, 5, 6, 8]);
    // No cambia la lista que recibe
    assert.equal(PROYECTOS[0].id, 4);
  });

  it('un hito previsto no cuenta como cumplido; un estado desconocido va al final', () => {
    const propios = [proyecto({ id: 1, nombre: '[TEST] B', estado: 'idea' }), proyecto({ id: 2, nombre: '[TEST] A', estado: 'idea' }),
      proyecto({ id: 3, nombre: '[TEST] C', estado: 'idea' }), proyecto({ id: 4, nombre: '[TEST] D', estado: 'otro' }), proyecto({ id: 5, nombre: '[TEST] E', estado: 'suspendido' })];
    const hitos = [hito(1, 1, '2027-01-01'), hito(2, 3, '2020-01-01'), hito(3, 2, '2026-10-25')];
    assert.deepEqual(ids(ctx.ordenarProyectos(propios, hitos, HOY)), [2, 3, 1, 5, 4]);
  });
});

describe('proyectos.js: los puntos de un carril (spec 2.1 y 2.2)', () => {
  const ventana = { desde: 2024, hasta: 2026, hoy: HOY };
  // Los días de la ventana de 2024 a 2026: 366 + 365 + 365
  const x = (fecha) => {
    const dias = (Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10)) - Date.UTC(2024, 0, 1)) / 86400000;
    return Math.round((dias / 1096) * 100 * 1000) / 1000;
  };

  it('el Índice (5 hitos de 2021 a 2025) en la ventana de 2024 a 2026: 3 antes y 2 puntos', () => {
    const r = plano(ctx.puntosDelCarril(hitosDe(INDICE), { ...ventana, anchoPx: 600 }));
    assert.equal(r.antes, 3);
    assert.equal(r.despues, 0);
    assert.equal(r.puntos.length, 2);
    assert.deepEqual(r.puntos.map((p) => p.cantidad), [1, 1]);
    assert.deepEqual(r.puntos.map((p) => p.futuro), [false, false]);
    assert.deepEqual(r.puntos.map((p) => p.x), [x('2024-09-02'), x('2025-08-14')]);
    assert.deepEqual(r.puntos[0].titulos, ['02/09/2024: 4º Puesto en Índice de Datos Abiertos 2024']);
    assert.deepEqual(r.puntos.map((p) => p.anios), [['2024'], ['2025']]);
  });

  it('la posición va en % de la pista: el 1/1 del primer año es 0 y el 31/12 del último, casi 100', () => {
    const r = plano(ctx.puntosDelCarril([hito(1, 900, '2024-01-01'), hito(2, 900, '2026-12-31')], { ...ventana, anchoPx: 4000 }));
    assert.deepEqual(r.puntos.map((p) => p.x), [0, x('2026-12-31')]);
    assert.ok(r.puntos[1].x < 100 && r.puntos[1].x > 99.8);
  });

  it('los hitos del 30/11/2025 y el 10/12/2025 se juntan en uno con 600 px de pista, y no con 4000', () => {
    const dos = hitosDe(RPAD).filter((h) => h.fecha < '2026-01-01');
    assert.equal(dos.length, 2);
    const angosta = plano(ctx.puntosDelCarril(dos, { ...ventana, anchoPx: 600 }));
    assert.equal(angosta.puntos.length, 1);
    assert.equal(angosta.puntos[0].cantidad, 2);
    assert.deepEqual(angosta.puntos[0].titulos, ['30/11/2025: RPAD v1.0.0 - Lanzamiento fundacional del sistema RPAD',
      '10/12/2025: RPAD v1.4.0 - Sistema completo con integración Andino, reportes, notificaciones y generador de notas']);
    // El punto que junta va entre los dos
    assert.ok(angosta.puntos[0].x > x('2025-11-30') && angosta.puntos[0].x < x('2025-12-10'));
    const ancha = plano(ctx.puntosDelCarril(dos, { ...ventana, anchoPx: 4000 }));
    assert.deepEqual(ancha.puntos.map((p) => p.cantidad), [1, 1]);
    // Con el del 22/01/2026, en la pista angosta quedan 2 puntos: el que junta y el de enero
    assert.deepEqual(plano(ctx.puntosDelCarril(hitosDe(RPAD), { ...ventana, anchoPx: 600 })).puntos.map((p) => p.cantidad), [2, 1]);
    // El teléfono (unos 300 px de pista) junta más: los tres, a 48 días del promedio de los dos primeros (menos de 15 px)
    assert.deepEqual(plano(ctx.puntosDelCarril(hitosDe(RPAD), { ...ventana, anchoPx: 300 })).puntos.map((p) => p.cantidad), [3]);
  });

  it('dos puntos que quedan separados están a 15 px o más', () => {
    const hitos = ['2025-01-01', '2025-01-05', '2025-01-09', '2025-01-13', '2025-01-17', '2025-01-21', '2025-02-20'].map((f, i) => hito(i + 1, 900, f));
    for (const anchoPx of [300, 600, 900, 4000]) {
      const { puntos } = plano(ctx.puntosDelCarril(hitos, { ...ventana, anchoPx }));
      assert.equal(puntos.reduce((total, p) => total + p.cantidad, 0), hitos.length, String(anchoPx));
      for (let i = 1; i < puntos.length; i += 1) assert.ok(((puntos[i].x - puntos[i - 1].x) / 100) * anchoPx >= 15, `${anchoPx}: ${i}`);
    }
  });

  it('un grupo es previsto solo si todos sus hitos lo son', () => {
    const r = plano(ctx.puntosDelCarril([hito(1, 900, '2026-10-24'), hito(2, 900, '2026-10-26'), hito(3, 900, '2026-12-01'), hito(4, 900, '2026-12-03')], { ...ventana, anchoPx: 600 }));
    assert.deepEqual(r.puntos.map((p) => [p.cantidad, p.futuro]), [[2, false], [2, true]]);
    // Hoy cuenta como cumplido
    assert.equal(plano(ctx.puntosDelCarril([hito(1, 900, HOY)], { ...ventana, anchoPx: 600 })).puntos[0].futuro, false);
    assert.equal(plano(ctx.puntosDelCarril(hitosDe(DATATHON), { ...ventana, anchoPx: 600 })).puntos[0].futuro, true);
  });

  it('el tramo va del primer al último hito que entran en la ventana, nunca de 0 a 100', () => {
    const indice = plano(ctx.puntosDelCarril(hitosDe(INDICE), { ...ventana, anchoPx: 600 }));
    assert.deepEqual(indice.tramo, { x1: x('2024-09-02'), x2: x('2025-08-14') });
    const hitos = [hito(1, 900, '2020-03-01'), hito(2, 900, '2024-06-01'), hito(3, 900, '2025-06-01'), hito(4, 900, '2030-01-01')];
    const r = plano(ctx.puntosDelCarril(hitos, { ...ventana, anchoPx: 600 }));
    assert.deepEqual([r.antes, r.despues], [1, 1]);
    assert.ok(r.tramo.x1 > 0 && r.tramo.x2 < 100, JSON.stringify(r.tramo));
    assert.deepEqual(r.tramo, { x1: x('2024-06-01'), x2: x('2025-06-01') });
    // Con uno solo adentro (o ninguno), no hay tramo
    assert.equal(plano(ctx.puntosDelCarril([hito(1, 900, '2020-03-01'), hito(2, 900, '2025-06-01'), hito(3, 900, '2030-01-01')], { ...ventana, anchoPx: 600 })).tramo, null);
    assert.deepEqual(plano(ctx.puntosDelCarril([], { ...ventana, anchoPx: 600 })), { puntos: [], antes: 0, despues: 0, tramo: null });
  });

  it('los de después de la ventana se cuentan; un hito con una fecha que no sirve no cuenta; sin ancho, el de la computadora', () => {
    const r = plano(ctx.puntosDelCarril([hito(1, 900, '2027-02-01'), hito(2, 900, '2026-02-30'), hito(3, 900, null)], { ...ventana, anchoPx: 600 }));
    assert.deepEqual([r.antes, r.despues, r.puntos.length], [0, 1, 0]);
    const dos = hitosDe(RPAD).filter((h) => h.fecha < '2026-01-01');
    for (const anchoPx of [undefined, 0, -5, NaN]) assert.equal(plano(ctx.puntosDelCarril(dos, { ...ventana, anchoPx })).puntos.length, 1, String(anchoPx));
    // Sin una ventana que sirva, nada
    const vacio = { puntos: [], antes: 0, despues: 0, tramo: null };
    assert.deepEqual(plano(ctx.puntosDelCarril(dos, { hoy: HOY, anchoPx: 600 })), vacio);
    assert.deepEqual(plano(ctx.puntosDelCarril(dos, null)), vacio);
  });
});

describe('proyectos.js: la frase del año resaltado (spec 2.3)', () => {
  it('2025 en la maqueta: 7 hitos de 4 proyectos y 1 logro, el texto de la spec', () => {
    assert.equal(ctx.fraseDelAnio('2025', HITOS), 'En 2025: 7 hitos de 4 proyectos y 1 logro del área. Son los que salen en el Informe anual de 2025.');
  });

  it('sin logros, la primera oración termina en «de 4 proyectos.»', () => {
    assert.equal(ctx.fraseDelAnio('2025', HITOS.filter((h) => h.proyecto_id !== null)), 'En 2025: 6 hitos de 4 proyectos. Son los que salen en el Informe anual de 2025.');
  });

  it('los singulares, solo logros y ningún hito', () => {
    assert.equal(ctx.fraseDelAnio('2024', [hito(1, 900, '2024-03-01'), hito(2, null, '2024-05-01')]),
      'En 2024: 2 hitos de 1 proyecto y 1 logro del área. Son los que salen en el Informe anual de 2024.');
    assert.equal(ctx.fraseDelAnio(2024, [hito(1, 900, '2024-03-01')]), 'En 2024: 1 hito de 1 proyecto. Son los que salen en el Informe anual de 2024.');
    assert.equal(ctx.fraseDelAnio('2026', [hito(1, null, '2026-03-01'), hito(2, null, '2026-05-01')]),
      'En 2026: 2 logros del área. Son los que salen en el Informe anual de 2026.');
    assert.equal(ctx.fraseDelAnio('2020', HITOS), 'En 2020 no hay hitos.');
    assert.equal(ctx.fraseDelAnio('abc', HITOS), '');
  });
});

describe('proyectos.js: los filtros (htmlDeFiltros)', () => {
  const cantidades = (estado = DE_ENTRADA) => ctx.cantidadesDeFiltros(PROYECTOS, estado, HITOS);
  const chips = (html, grupo) => [...html.matchAll(new RegExp(`<button type="button" class="sg-chip" data-grupo="${grupo}" data-valor="([^"]*)" aria-pressed="(true|false)">([^<]*)(?: <b>(\\d+)</b>)?</button>`, 'g'))]
    .map(([, valor, pulsado, texto, cantidad]) => [valor, pulsado, texto, cantidad ?? null]);

  it('el buscador, con su rótulo para lectores de pantalla y lo buscado escapado', () => {
    const html = ctx.htmlDeFiltros({ ...DE_ENTRADA, busqueda: '"><img src=x onerror=alert(1)>' }, cantidades(), VENTANA);
    assert.match(html, /<input type="search" id="pr-buscar" [^>]*aria-label="Buscar un proyecto por nombre, descripción o autor"/);
    assert.ok(html.includes('value="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"'));
    assert.ok(!html.includes('<img src=x'));
  });

  it('los estados con su cantidad: Todos y los que tienen algún proyecto o están elegidos', () => {
    const html = ctx.htmlDeFiltros(DE_ENTRADA, cantidades(), VENTANA);
    assert.deepEqual(chips(html, 'estado'), [['todos', 'true', 'Todos', '8'], ['en_curso', 'false', 'En curso', '2'], ['idea', 'false', 'Ideas', '4'],
      ['completado', 'false', 'Completados', '2']]);
    const elegido = ctx.htmlDeFiltros({ ...DE_ENTRADA, estado: 'suspendido' }, cantidades({ ...DE_ENTRADA, estado: 'suspendido' }), VENTANA);
    assert.deepEqual(chips(elegido, 'estado').at(-1), ['suspendido', 'true', 'Suspendidos', '0']);
    assert.match(html, /<div class="sg-chips" role="group" aria-label="Estado">/);
  });

  it('las categorías, con la misma regla y su rótulo', () => {
    const html = ctx.htmlDeFiltros(DE_ENTRADA, cantidades(), VENTANA);
    assert.deepEqual(chips(html, 'categoria'), [['todas', 'true', 'Todas', '8'], ['tecnologia', 'false', 'Tecnología', '5'], ['difusion', 'false', 'Difusión', '3']]);
    const elegida = ctx.htmlDeFiltros({ ...DE_ENTRADA, categoria: 'normativa' }, cantidades({ ...DE_ENTRADA, categoria: 'normativa' }), VENTANA);
    assert.deepEqual(chips(elegida, 'categoria')[2], ['normativa', 'true', 'Normativa', '0']);
    assert.match(html, /<div class="pr-grupo-filtro" role="group" aria-label="Categoría"><span class="pr-filtro-rotulo" aria-hidden="true">Categoría<\/span>/);
  });

  it('las flechas de la ventana: cada una con su aria-label, la que no tiene años hacia su lado deshabilitada y el texto con aria-live', () => {
    const html = ctx.htmlDeFiltros(DE_ENTRADA, cantidades(), VENTANA);
    assert.match(html, /<div class="pr-flechas" role="group" aria-label="Años que se ven">/);
    assert.match(html, /<button type="button" class="pr-flecha" data-correr="-1" aria-label="Ver 2023 a 2025">/);
    assert.match(html, /<button type="button" class="pr-flecha" data-correr="1" aria-label="Ver 2025 a 2027" disabled>/);
    assert.ok(html.includes('<span class="pr-flechas-texto" aria-live="polite">2024 a 2026</span>'));
    const medio = ctx.htmlDeFiltros(DE_ENTRADA, cantidades(), { desde: 2022, hasta: 2024, anterior: true, siguiente: true });
    assert.equal(cuantas(medio, /disabled/g), 0);
    assert.ok(medio.includes('aria-label="Ver 2021 a 2023"') && medio.includes('aria-label="Ver 2023 a 2025"'));
  });

  it('si todo entra en 3 años, las flechas no aparecen, pero los años siguen escritos (en el teléfono no hay fila de años)', () => {
    const html = ctx.htmlDeFiltros(DE_ENTRADA, cantidades(), { desde: 2024, hasta: 2026, anterior: false, siguiente: false });
    assert.doesNotMatch(html, /data-correr|pr-flecha"/);
    assert.ok(html.includes('<span class="pr-flechas-texto solo">2024 a 2026</span>'));
  });

  it('«Resaltar un año»: Ninguno y los 3 años de la ventana, cada uno con todos sus hitos', () => {
    const html = ctx.htmlDeFiltros(DE_ENTRADA, cantidades(), VENTANA);
    assert.deepEqual(chips(html, 'resaltar'), [['ninguno', 'true', 'Ninguno', null], ['2024', 'false', '2024', '1'], ['2025', 'false', '2025', '7'], ['2026', 'false', '2026', '6']]);
    assert.match(html, /<div class="pr-grupo-filtro" role="group" aria-label="Resaltar un año"><span class="pr-filtro-rotulo" aria-hidden="true">Resaltar un año<\/span>/);
    const resaltado = ctx.htmlDeFiltros({ ...DE_ENTRADA, resaltar: '2025' }, cantidades(), VENTANA);
    assert.deepEqual(chips(resaltado, 'resaltar').map(([valor, pulsado]) => [valor, pulsado]), [['ninguno', 'false'], ['2024', 'false'], ['2025', 'true'], ['2026', 'false']]);
    // Un año sin hitos dice 0; sin cantidades, todo en 0
    assert.deepEqual(chips(ctx.htmlDeFiltros(DE_ENTRADA, undefined, VENTANA), 'resaltar').map((c) => c[3]), [null, '0', '0', '0']);
    // Sin ventana, la que termina en el año elegido, sin flechas
    assert.ok(ctx.htmlDeFiltros(DE_ENTRADA, undefined, undefined).includes('<span class="pr-flechas-texto solo">2024 a 2026</span>'));
  });
});

describe('proyectos.js: los carriles (htmlDeCarriles)', () => {
  it('un carril por proyecto, en el orden de la maqueta, cada uno un link a su dirección', () => {
    const html = carrilesDe();
    const links = [...html.matchAll(/<a class="pr-carril" href="([^"]*)">/g)].map((m) => m[1]);
    assert.deepEqual(links, ['?id=3', '?id=7', '?id=1', '?id=4', '?id=2', '?id=5', '?id=6', '?id=8']);
    assert.match(html, /<ul class="pr-lista-carriles" role="list" aria-label="Proyectos">/);
  });

  it('el link conserva los filtros de la lista, así «Ver todos los proyectos» y Atrás la dejan como estaba', () => {
    const html = carrilesDe({ estado: { ...DE_ENTRADA, estado: 'en_curso', anios: 2025 } });
    assert.deepEqual([...html.matchAll(/<a class="pr-carril" href="([^"]*)">/g)].map((m) => m[1]), ['?estado=en_curso&amp;anios=2025&amp;id=3', '?estado=en_curso&amp;anios=2025&amp;id=7']);
  });

  it('la columna del proyecto: el cuadrado con su color y su ícono (decorativo), el nombre y debajo la insignia y la categoría', () => {
    const fila = carrilDe(carrilesDe(), INDICE);
    assert.match(fila, /<span class="pr-tile" style="--c:#cc0066"><svg aria-hidden="true" focusable="false" [^>]*>/);
    assert.ok(fila.includes('<b class="pr-nombre">Índice de Datos Abiertos de Ciudades Argentinas (Open Data Index)</b>'));
    assert.ok(fila.includes('<small><span class="pr-insignia pr-en-curso">En curso</span><span>Difusión</span></small>'));
  });

  it('el nombre lleva la clase que lo corta en cualquier lugar (un nombre largo sin espacios no rompe el carril)', () => {
    const largo = 'A'.repeat(200);
    const fila = carrilDe(carrilesDe({}, [proyecto({ nombre: largo })], []), 900);
    assert.ok(fila.includes(`<b class="pr-nombre">${largo}</b>`));
    const estilo = leer('proyectos.html').match(/<style>[\s\S]*?<\/style>/)[0];
    assert.match(estilo, /\.pr-nombre \{[^}]*overflow-wrap: anywhere;/);
  });

  it('los hitos fuera de la ventana: la píldora «3 antes» con su title, y el texto oculto con todos los hitos', () => {
    const fila = carrilDe(carrilesDe(), INDICE);
    assert.ok(fila.includes('<span class="fuera izq" title="3 hitos antes de 2024">3 antes</span>'));
    assert.ok(fila.includes('<span class="visualmente-oculto">: 5 hitos, del 01/08/2021 al 14/08/2025</span>'));
    assert.equal(cuantas(fila, /class="punto/g), 2);
    // Con un hito previsto en 2027 la ventana puede llegar a 2027, pero la elegida termina en 2026
    const despues = carrilDe(carrilesDe({}, [proyecto()], [hito(1, 900, '2024-05-01'), hito(2, 900, '2027-03-01')]), 900);
    assert.ok(despues.includes('<span class="fuera der" title="1 hito después de 2026">1 después</span>'));
    assert.ok(despues.includes('<span class="visualmente-oculto">: 2 hitos, del 01/05/2024 al 01/03/2027</span>'));
    const uno = carrilDe(carrilesDe({}, [proyecto()], [hito(1, 900, '2025-03-10')]), 900);
    assert.ok(uno.includes('<span class="visualmente-oculto">: 1 hito, el 10/03/2025</span>'));
  });

  it('sin hitos, «Sin hitos todavía» en gris y en el texto oculto', () => {
    const fila = carrilDe(carrilesDe(), 5);
    assert.ok(fila.includes('<span class="sin">Sin hitos todavía</span>'));
    assert.ok(fila.includes('<span class="visualmente-oculto">: sin hitos todavía</span>'));
    assert.equal(cuantas(fila, /class="punto/g), 0);
  });

  it('cada punto con su title «dd/mm/aaaa: título»; cumplido con el color del proyecto o hueco si está previsto; los que se pisan, juntos con la cantidad', () => {
    const html = carrilesDe();
    const datathon = carrilDe(html, DATATHON);
    assert.match(datathon, /<span class="punto futuro" style="left:[\d.]+%" title="20\/11\/2026: Realización del Datathon 2026"><\/span>/);
    const rpad = carrilDe(html, RPAD);
    assert.match(rpad, /<span class="punto grupo" style="left:[\d.]+%" title="30\/11\/2025: RPAD v1\.0\.0 - Lanzamiento fundacional del sistema RPAD\n10\/12\/2025: RPAD v1\.4\.0 - [^"]+"><b>2<\/b><\/span>/);
    assert.match(rpad, /<span class="punto" style="left:[\d.]+%" title="22\/01\/2026: RPAD v1\.5\.0 - Sistema de doble verificación de cambios"><\/span>/);
    assert.ok(rpad.includes('<span class="pr-pista" aria-hidden="true" style="--c:#3b82f6">'), 'la pista lleva el color del proyecto');
    // Con una pista ancha no se juntan
    assert.equal(cuantas(carrilDe(carrilesDe({ anchoPx: 4000 }), RPAD), /class="punto"/g), 3);
  });

  it('las líneas de cada 1 de enero, la de hoy y el tramo del proyecto', () => {
    const fila = carrilDe(carrilesDe(), INDICE);
    assert.equal(cuantas(fila, /<span class="anio" style="left:[\d.]+%"><\/span>/g), 3);
    assert.equal(cuantas(fila, /<span class="linea-hoy" style="left:[\d.]+%"><\/span>/g), 1);
    assert.match(fila, /<span class="tramo" style="left:[\d.]+%;width:[\d.]+%"><\/span>/);
    // En una ventana que no llega a hoy, no hay línea de hoy
    assert.doesNotMatch(carrilDe(carrilesDe({ estado: { ...DE_ENTRADA, anios: 2023 } }), INDICE), /linea-hoy/);
  });

  it('arriba, los años de la ventana (el de hoy marcado), y abajo la leyenda', () => {
    const html = carrilesDe();
    const eje = html.match(/<div class="pr-eje" aria-hidden="true">[\s\S]*?<\/div>/)?.[0] ?? '';
    assert.deepEqual([...eje.matchAll(/<span(?: class="(hoy)")? style="left:[\d.]+%">(\d{4})<\/span>/g)].map((m) => [m[2], m[1] ?? '']), [['2024', ''], ['2025', ''], ['2026', 'hoy']]);
    const leyenda = html.match(/<div class="pr-leyenda" aria-hidden="true">[\s\S]*?<\/div>/)?.[0] ?? '';
    assert.deepEqual([...leyenda.matchAll(/<span>(?:<i class="[^"]*"><\/i>|<b class="[^"]*">[^<]*<\/b>)([^<]+)<\/span>/g)].map((m) => m[1]),
      ['Hito cumplido (con el color del proyecto)', 'Hito previsto', 'Logro del área', 'Hoy', 'Hitos fuera de los años elegidos']);
    assert.ok(leyenda.includes('<b class="pr-mk-fuera">1 antes</b>'));
  });

  it('al final, el renglón «Logros del área», con la marca de logro y sus logros como rombos, que lleva a la pestaña Logros', () => {
    const html = carrilesDe();
    const logros = html.match(/<li><a class="pr-carril logros" href="#logros" data-ir-a="logros">[\s\S]*?<\/a><\/li>/)?.[0] ?? '';
    assert.ok(logros, 'el renglón de los logros');
    assert.ok(html.indexOf(logros) > html.indexOf(carrilDe(html, 8)), 'después del último proyecto');
    assert.match(logros, /<span class="pr-tile logro"><svg aria-hidden="true" focusable="false" [^>]*>/);
    assert.ok(logros.includes('<b class="pr-nombre">Logros del área</b><small><span>Hitos que no son de un proyecto</span></small>'));
    assert.equal(cuantas(logros, /<span class="punto logro"/g), LOGROS.length);
    assert.ok(logros.includes('<span class="visualmente-oculto">: 2 logros, del 18/09/2025 al 12/06/2026</span>'));
    const sinLogros = carrilesDe({}, PROYECTOS, HITOS.filter((h) => h.proyecto_id !== null));
    assert.ok(sinLogros.includes('<span class="sin">Sin logros todavía</span>'));
    assert.ok(sinLogros.includes('<span class="visualmente-oculto">: sin logros todavía</span>'));
  });

  it('un año resaltado: la frase arriba, su columna amarilla en todos los renglones, los puntos de los otros años apagados y en la leyenda', () => {
    const html = carrilesDe({ estado: { ...DE_ENTRADA, resaltar: '2025' } });
    assert.ok(html.startsWith('<p class="pr-resumen-anio" role="status">En 2025: 7 hitos de 4 proyectos y 1 logro del área. Son los que salen en el Informe anual de 2025.</p>'));
    assert.equal(cuantas(html, /<span class="resalta" style="left:[\d.]+%;width:[\d.]+%"><\/span>/g), PROYECTOS.length + 1);
    const indice = carrilDe(html, INDICE);
    assert.deepEqual([...indice.matchAll(/<span class="(punto[^"]*)"/g)].map((m) => m[1]), ['punto apagado', 'punto']);
    assert.ok(html.includes('<span><i class="pr-mk resalta"></i>2025</span>'));
    // Sin resaltar, ni frase, ni columna, ni puntos apagados
    const sin = carrilesDe();
    assert.doesNotMatch(sin, /pr-resumen-anio|class="resalta"|apagado|pr-mk resalta/);
  });

  it('el resaltado cuenta todos los hitos del año, aunque los filtros dejen solo algunos proyectos', () => {
    const html = carrilesDe({ estado: { ...DE_ENTRADA, categoria: 'difusion', resaltar: '2025' } });
    assert.ok(html.includes('En 2025: 7 hitos de 4 proyectos y 1 logro del área.'));
  });

  it('un color que no es #RRGGBB (o que falta) usa el azul tinta; nunca llega otra cosa al style', () => {
    const proyectos = [proyecto({ id: 1, color: null }), proyecto({ id: 2, color: 'red;background:url(x)' }), proyecto({ id: 3, color: '#6CA3C6' }), proyecto({ id: 4, color: '"><script>' })];
    const html = carrilesDe({}, proyectos, []);
    const colores = [...html.matchAll(/style="--c:([^"]*)"/g)].map((m) => m[1]);
    assert.ok(colores.every((c) => /^#[0-9a-fA-F]{6}$/.test(c)), colores.join(' '));
    assert.ok(carrilDe(html, 1).includes('style="--c:#1A365D"'));
    assert.ok(carrilDe(html, 2).includes('style="--c:#1A365D"'));
    assert.ok(carrilDe(html, 3).includes('style="--c:#6CA3C6"'));
    assert.ok(!html.includes('<script>'));
  });

  it('un nombre o un título con HTML se ve como texto, también en los title', () => {
    const malo = '<img src=x onerror=alert(1)>';
    const html = carrilesDe({}, [proyecto({ nombre: malo, responsable: malo })], [hito(1, 900, '2026-02-01', malo), hito(2, null, '2026-03-01', malo)]);
    assert.ok(!html.includes('<img'), 'ninguna etiqueta img');
    assert.ok(html.includes('<b class="pr-nombre">&lt;img src=x onerror=alert(1)&gt;</b>'));
    assert.ok(html.includes('title="01/02/2026: &lt;img src=x onerror=alert(1)&gt;"'));
    assert.ok(html.includes('title="01/03/2026: &lt;img src=x onerror=alert(1)&gt;"'));
  });

  it('un estado, una categoría o un ícono desconocidos no rompen el carril ni dejan pasar nada de más', () => {
    const html = carrilesDe({}, [proyecto({ estado: 'constructor', categoria: '__proto__', icono: 'toString' }), proyecto({ id: 901, estado: '<b>x</b>', categoria: null, icono: null })], []);
    assert.ok(!html.includes('function'), 'ningún código de Object.prototype');
    assert.ok(carrilDe(html, 900).includes('<span class="pr-insignia">constructor</span>'));
    assert.ok(carrilDe(html, 901).includes('<span class="pr-insignia">&lt;b&gt;x&lt;/b&gt;</span>'));
    assert.match(carrilDe(html, 900), /<span class="pr-tile" style="--c:#2E6B4C"><svg aria-hidden="true" focusable="false" /);
  });

  it('la ventana sale de los años con hitos: un año de la dirección que no está se corrige', () => {
    const html = carrilesDe({ estado: { ...DE_ENTRADA, anios: 2015 } });
    assert.ok(carrilDe(html, INDICE).includes('href="?anios=2023&amp;id=7"'));
    assert.ok(html.includes('>2021</span>') && html.includes('>2023</span>'));
  });
});

describe('proyectos.js: los vacíos (spec 2.5)', () => {
  it('ninguno coincide con los filtros: lo dice, con «Ver todos los proyectos», y sin carriles', () => {
    const html = carrilesDe({ estado: { ...DE_ENTRADA, busqueda: 'zzz' } });
    assert.ok(html.includes('<p role="status">Ningún proyecto coincide con lo que buscaste.</p>'));
    assert.match(html, /<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-limpiar>Ver todos los proyectos<\/button>/);
    assert.doesNotMatch(html, /pr-carril|pr-leyenda/);
  });

  it('sin ningún proyecto: el lector lee «Todavía no hay proyectos.» y administración, además, la invitación', () => {
    const lector = carrilesDe({ esAdmin: false }, [], HITOS);
    assert.ok(lector.includes('Todavía no hay proyectos.'));
    assert.ok(!lector.includes('Cargá el primero'));
    assert.doesNotMatch(lector, /pr-carril|data-limpiar/);
    const admin = carrilesDe({ esAdmin: true }, [], []);
    assert.ok(admin.includes('<p>Todavía no hay proyectos. Cargá el primero con «Nuevo proyecto».</p>'));
    // Solo el true literal es administración
    assert.ok(!carrilesDe({ esAdmin: 'true' }, [], []).includes('Cargá el primero'));
  });
});

describe('proyectos.js: el enlace del proyecto (textoDelEnlace, spec 3)', () => {
  it('el texto sale de la dirección: GitHub, el borrador de Google o cualquier otra web', () => {
    assert.equal(ctx.textoDelEnlace('https://github.com/datospublicosmcr/boletin-oficial'), 'Abrir en GitHub');
    assert.equal(ctx.textoDelEnlace('HTTPS://GitHub.com/x'), 'Abrir en GitHub');
    assert.equal(ctx.textoDelEnlace('https://www.github.com/x'), 'Abrir en GitHub');
    assert.equal(ctx.textoDelEnlace('https://docs.google.com/document/d/EJEMPLO-2/edit'), 'Abrir el borrador');
    assert.equal(ctx.textoDelEnlace('https://drive.google.com/file/d/EJEMPLO/view'), 'Abrir el borrador');
    assert.equal(ctx.textoDelEnlace('https://datos.comodoro.gov.ar/'), 'Abrir el enlace');
    assert.equal(ctx.textoDelEnlace('http://ejemplo.gob.ar'), 'Abrir el enlace');
  });

  it('mira el dominio, no el resto de la dirección', () => {
    assert.equal(ctx.textoDelEnlace('https://ejemplo.gob.ar/?ref=github.com'), 'Abrir el enlace');
    assert.equal(ctx.textoDelEnlace('https://github.com.ejemplo.gob.ar/x'), 'Abrir el enlace');
    assert.equal(ctx.textoDelEnlace('https://usuario@github.com/x'), 'Abrir en GitHub');
    assert.equal(ctx.textoDelEnlace('https://docs.google.com:443/x'), 'Abrir el borrador');
  });

  it('null si no es http o https', () => {
    for (const url of ['javascript:alert(1)', 'ftp://github.com/x', 'data:text/html,x', '', '   ', null, undefined, 42]) {
      assert.equal(ctx.textoDelEnlace(url), null, String(url));
    }
  });
});

describe('proyectos.js: la ficha de un proyecto (htmlDeFicha, spec 3)', () => {
  const datos = (html) => [...html.matchAll(/<div class="pr-dato"><dt>([^<]+)<\/dt><dd>([^<]*)<\/dd><\/div>/g)].map((m) => [m[1], m[2]]);

  it('el título: el cuadrado grande, el nombre y debajo la insignia del estado y la categoría; la descripción completa', () => {
    const html = ctx.htmlDeFicha(detalleDe(INDICE), { esAdmin: false });
    assert.match(html, /^<div class="pr-tarjeta"><div class="pr-ficha">/);
    assert.match(html, /<span class="pr-tile grande" style="--c:#cc0066"><svg aria-hidden="true" focusable="false" /);
    assert.ok(html.includes('<h2 class="pr-titulo">Índice de Datos Abiertos de Ciudades Argentinas (Open Data Index)</h2>'));
    assert.ok(html.includes('<div class="etiquetas"><span class="pr-insignia pr-en-curso">En curso</span><span class="pr-etq">Difusión</span></div>'));
    assert.ok(html.includes(`<p class="desc">${MAQUETA.proyectos.find((p) => p.id === INDICE).descripcion}</p>`));
  });

  it('la fila de datos: Prioridad, Fecha de elevación, Autor o responsable, Áreas, Hitos y Documentos', () => {
    assert.deepEqual(datos(ctx.htmlDeFicha(detalleDe(INDICE), { esAdmin: false })), [['Prioridad', 'Alta'], ['Fecha de elevación', '01/08/2021'],
      ['Autor o responsable', MAQUETA.proyectos.find((p) => p.id === INDICE).responsable], ['Áreas', 'Dirección de Datos Públicos y Comunicación'],
      ['Hitos', '5'], ['Documentos', '0']]);
    assert.deepEqual(datos(ctx.htmlDeFicha(detalleDe(BOLETIN), { esAdmin: false })).slice(4), [['Hitos', '2'], ['Documentos', '2']]);
  });

  it('un dato vacío es «—»: sin fecha de elevación, sin autor, sin áreas o con una prioridad que no existe', () => {
    assert.deepEqual(datos(ctx.htmlDeFicha(detalleDe(ANDINO), { esAdmin: false }))[1], ['Fecha de elevación', '—']);
    const vacio = proyecto({ prioridad: 'urgente', responsable: '  ', areas: [], fecha_inicio: '2026-02-30', hitos: [], documentos: [] });
    assert.deepEqual(datos(ctx.htmlDeFicha(vacio, { esAdmin: false })), [['Prioridad', '—'], ['Fecha de elevación', '—'],
      ['Autor o responsable', '—'], ['Áreas', '—'], ['Hitos', '0'], ['Documentos', '0']]);
    // Sin las listas, cuentan cantidad_hitos y cantidad_documentos
    const sinListas = proyecto({ cantidad_hitos: 3, cantidad_documentos: 1 });
    assert.deepEqual(datos(ctx.htmlDeFicha(sinListas, { esAdmin: false })).slice(4), [['Hitos', '3'], ['Documentos', '1']]);
    // Sin descripción, no hay párrafo
    assert.doesNotMatch(ctx.htmlDeFicha(proyecto({ descripcion: '' }), { esAdmin: false }), /class="desc"/);
  });

  it('el lector ve el enlace del proyecto y no «Editar el proyecto» ni «Eliminar»', () => {
    const html = ctx.htmlDeFicha(detalleDe(BOLETIN), { esAdmin: false });
    assert.match(html, /<a class="sg-btn sg-btn-borde" href="https:\/\/github\.com\/datospublicosmcr\/boletin-oficial" target="_blank" rel="noopener"><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>Abrir en GitHub<\/a>/);
    assert.ok(!html.includes('Editar el proyecto'));
    assert.ok(!html.includes('Eliminar'));
    assert.ok(ctx.htmlDeFicha(detalleDe(DATATHON), { esAdmin: false }).includes('Abrir el borrador</a>'));
  });

  it('administración ve el enlace, «Editar el proyecto» y «Eliminar» (con el borde rojo); solo el true literal', () => {
    const html = ctx.htmlDeFicha(detalleDe(BOLETIN), { esAdmin: true });
    assert.ok(html.includes('Abrir en GitHub</a>'));
    assert.ok(html.includes('<button type="button" class="sg-btn sg-btn-borde" data-editar-proyecto="4">Editar el proyecto</button>'));
    assert.ok(html.includes('<button type="button" class="sg-btn sg-btn-rojo-borde" data-eliminar-proyecto="4">Eliminar</button>'));
    assert.ok(!ctx.htmlDeFicha(detalleDe(BOLETIN), { esAdmin: 'true' }).includes('Editar el proyecto'));
  });

  it('sin enlace, o con uno que no es http o https, no hay botón de enlace (y sin acciones, no hay columna)', () => {
    assert.doesNotMatch(ctx.htmlDeFicha(detalleDe(ANDINO), { esAdmin: false }), /Abrir|pr-acciones/);
    const malo = ctx.htmlDeFicha(proyecto({ enlace_externo: 'javascript:alert(1)' }), { esAdmin: false });
    assert.ok(!malo.includes('javascript:') && !malo.includes('Abrir'));
  });

  it('un nombre, una descripción, un autor o un área con HTML se ven como texto; un nombre largo lleva la clase que lo corta', () => {
    const x = '<img src=x onerror=alert(1)>';
    const html = ctx.htmlDeFicha(proyecto({ nombre: x, descripcion: x, responsable: x, areas: [{ id: 1, nombre: x }], enlace_externo: 'https://ejemplo.gob.ar/"><script>' }), { esAdmin: true });
    assert.ok(!html.includes('<img') && !html.includes('<script'));
    assert.ok(html.includes('<h2 class="pr-titulo">&lt;img src=x onerror=alert(1)&gt;</h2>'));
    assert.ok(html.includes('href="https://ejemplo.gob.ar/&quot;&gt;&lt;script&gt;"'));
    const estilo = leer('proyectos.html').match(/<style>[\s\S]*?<\/style>/)[0];
    assert.match(estilo, /\.pr-ficha h2\.pr-titulo \{[^}]*overflow-wrap: anywhere;/);
  });
});

describe('proyectos.js: la cinta del recorrido (cintaDelProyecto, spec 3)', () => {
  const dentro = (x) => typeof x === 'number' && x >= 30 && x <= 970;
  const todasLasX = (cinta) => [...cinta.eventos.map((e) => e.x), ...cinta.anios.map((a) => a.x), cinta.hoyX, cinta.banda.x1, cinta.banda.x2, cinta.banda.x3]
    .filter((x) => x !== null);
  // Ninguna etiqueta con fila se pisa con otra de su fila (con 10 de aire), ni se sale del dibujo; el ancho es 6,3 por letra (10 como mínimo)
  const sinPisarse = (cinta, nombre) => {
    for (const evento of cinta.eventos) {
      if (evento.fila === null) {
        assert.equal(evento.xTexto, null, nombre);
        continue;
      }
      assert.ok([0, 1, 2].includes(evento.fila), nombre);
      assert.equal(evento.ancho, Math.round(Math.max(Array.from(evento.etiqueta).length, 10) * 6.3 * 100) / 100, nombre);
      assert.ok(evento.xTexto >= 0 && evento.xTexto + evento.ancho <= 1000, `${nombre}: ${evento.etiqueta}`);
    }
    for (const fila of [0, 1, 2]) {
      const deLaFila = cinta.eventos.filter((e) => e.fila === fila).sort((a, b) => a.xTexto - b.xTexto);
      for (let i = 1; i < deLaFila.length; i += 1) {
        assert.ok(deLaFila[i].xTexto >= deLaFila[i - 1].xTexto + deLaFila[i - 1].ancho + 10, `${nombre}: fila ${fila}, ${deLaFila[i - 1].etiqueta} y ${deLaFila[i].etiqueta}`);
      }
    }
  };

  it('el Índice: de 2021 a 2026, sin meses, con 6 eventos (los 5 hitos y la elevación) y toda x entre 30 y 970', () => {
    const cinta = plano(ctx.cintaDelProyecto(detalleDe(INDICE), HOY));
    assert.equal(cinta.desde, 2021);
    assert.equal(cinta.hasta, 2026);
    assert.equal(cinta.meses, false);
    assert.equal(cinta.eventos.length, 6);
    assert.deepEqual(cinta.eventos.map((e) => e.tipo).sort(), ['elev', 'hecho', 'hecho', 'hecho', 'hecho', 'hecho']);
    assert.ok(todasLasX(cinta).every(dentro), JSON.stringify(todasLasX(cinta)));
    assert.deepEqual(cinta.anios.map((a) => a.anio), [2021, 2022, 2023, 2024, 2025, 2026]);
    assert.equal(cinta.anios[0].x, 30);
    assert.ok(cinta.anios.every((a, i) => i === 0 || a.x > cinta.anios[i - 1].x));
  });

  it('los eventos van por fecha, con su fecha, su texto (la elevación dice «Elevación») y la etiqueta', () => {
    const cinta = plano(ctx.cintaDelProyecto(detalleDe(INDICE), HOY));
    assert.deepEqual(cinta.eventos.map((e) => e.fecha), ['2021-08-01', '2021-08-01', '2022-08-01', '2023-07-25', '2024-09-02', '2025-08-14']);
    const elevacion = cinta.eventos.find((e) => e.tipo === 'elev');
    assert.equal(elevacion.texto, 'Elevación');
    assert.equal(cinta.eventos.at(-1).texto, '3º Puesto en Índice de Datos Abiertos 2025');
    assert.ok(cinta.eventos.every((e, i) => i === 0 || e.x >= cinta.eventos[i - 1].x));
  });

  it('la banda va del primer evento al último (si ya pasó) y la línea de hoy, en su día', () => {
    const cinta = plano(ctx.cintaDelProyecto(detalleDe(INDICE), HOY));
    assert.equal(cinta.banda.x1, cinta.eventos[0].x);
    assert.equal(cinta.banda.x2, cinta.eventos.at(-1).x);
    assert.equal(cinta.banda.x3, null);
    // El 25/10/2026 en un eje de 2021 a 2026
    const dias = (Date.UTC(2026, 9, 25) - Date.UTC(2021, 0, 1)) / 86400000;
    const total = (Date.UTC(2027, 0, 1) - Date.UTC(2021, 0, 1)) / 86400000;
    assert.ok(Math.abs(cinta.hoyX - (30 + (dias / total) * 940)) < 0.01, String(cinta.hoyX));
  });

  it('un hito futuro da «futuro»; un proyecto de un solo año se dibuja en 2 años, con los meses', () => {
    const cinta = plano(ctx.cintaDelProyecto(detalleDe(DATATHON), HOY));
    assert.deepEqual(cinta.eventos.map((e) => [e.fecha, e.tipo]), [['2026-02-05', 'elev'], ['2026-11-20', 'futuro']]);
    assert.equal(cinta.hasta - cinta.desde, 1);
    assert.deepEqual([cinta.desde, cinta.hasta, cinta.meses], [2025, 2026, true]);
    // La banda celeste llega a hoy y la clara, de hoy al último hito previsto
    assert.equal(cinta.banda.x2, cinta.hoyX);
    assert.equal(cinta.banda.x3, cinta.eventos.at(-1).x);
    // Un hito de hoy ya se cumplió
    assert.equal(ctx.cintaDelProyecto(proyecto({ hitos: [hito(1, 900, HOY)] }), HOY).eventos[0].tipo, 'hecho');
    // Con 3 años todavía van los meses; con 4, no
    assert.equal(ctx.cintaDelProyecto(proyecto({ hitos: [hito(1, 900, '2024-05-01')] }), HOY).meses, true);
    assert.equal(ctx.cintaDelProyecto(proyecto({ hitos: [hito(1, 900, '2023-05-01')] }), HOY).meses, false);
  });

  it('ninguna etiqueta con fila se pisa con otra de su fila ni se sale del dibujo, en todos los proyectos de la maqueta', () => {
    for (const { id } of PROYECTOS) {
      const cinta = ctx.cintaDelProyecto(detalleDe(id), HOY);
      if (cinta) sinPisarse(plano(cinta), String(id));
    }
    // El Índice: la elevación y el primer hito, el mismo día, en dos filas
    const indice = plano(ctx.cintaDelProyecto(detalleDe(INDICE), HOY));
    assert.ok(indice.eventos.every((e) => e.fila !== null));
    assert.notEqual(indice.eventos[0].fila, indice.eventos[1].fila);
  });

  it('con muchos hitos juntos, las etiquetas que no entran en 3 filas no van (fila null), y el resto no se pisa', () => {
    const hitos = Array.from({ length: 12 }, (_, i) => hito(i + 1, 900, `2025-06-${String(i + 1).padStart(2, '0')}`, `[TEST] Hito número ${i + 1} con un título largo`));
    const cinta = plano(ctx.cintaDelProyecto(proyecto({ hitos }), HOY));
    assert.equal(cinta.eventos.length, 12);
    assert.equal(cinta.eventos.filter((e) => e.fila !== null).length, 3);
    sinPisarse(cinta, 'juntos');
    // Al final del eje, la etiqueta va a la izquierda de su marca
    const ultimo = plano(ctx.cintaDelProyecto(proyecto({ hitos: [hito(1, 900, '2025-01-10'), hito(2, 900, '2026-12-28', '[TEST] Un hito del final del año')] }), HOY));
    sinPisarse(ultimo, 'final');
    assert.ok(ultimo.eventos[1].xTexto < ultimo.eventos[1].x);
  });

  it('la etiqueta se corta a 34 caracteres con «…» (contados con Array.from)', () => {
    const largo = '[TEST] ' + 'Ñandú '.repeat(10);
    const justo = 'x'.repeat(34);
    const emojis = '🎉'.repeat(40);
    const cinta = plano(ctx.cintaDelProyecto(proyecto({ hitos: [hito(1, 900, '2024-01-10', largo), hito(2, 900, '2025-01-10', justo), hito(3, 900, '2026-01-10', emojis)] }), HOY));
    const [a, b, c] = cinta.eventos;
    assert.equal(a.etiqueta, `${Array.from(largo).slice(0, 33).join('')}…`);
    assert.equal(Array.from(a.etiqueta).length, 34);
    assert.equal(a.texto, largo);
    assert.equal(b.etiqueta, justo);
    assert.equal(Array.from(c.etiqueta).length, 34);
    assert.ok(c.etiqueta.endsWith('🎉…'));
  });

  it('sin hitos ni fecha de elevación da null (también con fechas que no sirven)', () => {
    assert.equal(ctx.cintaDelProyecto(detalleDe(CHARLA), HOY), null);
    assert.equal(ctx.cintaDelProyecto(proyecto({ hitos: [hito(1, 900, '2026-02-30'), hito(2, 900, null)], fecha_inicio: 'abc' }), HOY), null);
    assert.equal(ctx.cintaDelProyecto(null, HOY), null);
    // Solo con la fecha de elevación, hay cinta
    const solo = plano(ctx.cintaDelProyecto(proyecto({ fecha_inicio: '2025-04-30' }), HOY));
    assert.deepEqual(solo.eventos.map((e) => e.tipo), ['elev']);
  });

  it('un proyecto que empieza después del año que viene: el eje empieza en su año (sin hoy) y toda x sigue entre 30 y 970', () => {
    const cinta = plano(ctx.cintaDelProyecto(proyecto({ fecha_inicio: '2029-03-31', hitos: [hito(1, 900, '2030-06-01')] }), HOY));
    assert.deepEqual([cinta.desde, cinta.hasta], [2029, 2030]);
    assert.equal(cinta.hoyX, null);
    assert.ok(todasLasX(cinta).every(dentro), JSON.stringify(todasLasX(cinta)));
    assert.ok(cinta.banda.x2 >= cinta.banda.x1);
  });
});

describe('proyectos.js: el SVG de la cinta (svgDeCinta, spec 3)', () => {
  const svgDe = (id, titulo = PROYECTOS.find((p) => p.id === id).nombre) => ctx.svgDeCinta(ctx.cintaDelProyecto(detalleDe(id), HOY), titulo);

  it('sin hitos ni fecha de elevación, el texto de la spec', () => {
    assert.equal(ctx.svgDeCinta(null, 'x'), '<p class="pr-vacio">Sin hitos ni fecha de elevación: la cinta se dibuja cuando haya alguno.</p>');
  });

  it('el SVG en su marco con desplazamiento, con su rótulo, los rombos de los hitos, el círculo de la elevación y la línea de hoy', () => {
    const html = svgDe(INDICE);
    assert.match(html, /^<div class="pr-cinta-marco"><svg class="pr-cinta" viewBox="0 0 1000 186" role="img" aria-label="Recorrido de Índice de Datos Abiertos de Ciudades Argentinas \(Open Data Index\): 5 hitos">/);
    assert.equal(cuantas(html, /<rect class="h-hecho" /g), 5);
    assert.equal(cuantas(html, /<circle class="h-elev" /g), 1);
    assert.ok(html.includes('<title>01/08/2021: Elevación</title>'));
    assert.ok(html.includes('<title>14/08/2025: 3º Puesto en Índice de Datos Abiertos 2025</title>'));
    assert.equal(cuantas(html, /<line class="l-hoy" /g), 1);
    assert.ok(html.includes('>Hoy</text>'));
    assert.deepEqual([...html.matchAll(/<text class="anio" [^>]*>(\d{4})<\/text>/g)].map((m) => m[1]), ['2021', '2022', '2023', '2024', '2025', '2026']);
    // Sin marcas de mes con 6 años
    assert.equal(cuantas(html, /<line class="eje mes" /g), 0);
  });

  it('la leyenda: Hito cumplido, Hito previsto, Elevación y Hoy', () => {
    const leyenda = svgDe(INDICE).match(/<div class="pr-leyenda" aria-hidden="true">[\s\S]*?<\/div>/)?.[0] ?? '';
    assert.deepEqual([...leyenda.matchAll(/<span><i class="[^"]*"><\/i>([^<]+)<\/span>/g)].map((m) => m[1]), ['Hito cumplido', 'Hito previsto', 'Elevación', 'Hoy']);
  });

  it('un proyecto de 2 años lleva las marcas de los meses y el hito previsto, hueco; la banda clara llega al previsto', () => {
    const html = svgDe(DATATHON);
    assert.equal(cuantas(html, /<line class="eje mes" /g), 22);
    assert.equal(cuantas(html, /<rect class="h-futuro" /g), 1);
    assert.equal(cuantas(html, /<rect class="porvenir" /g), 1);
    assert.equal(cuantas(svgDe(INDICE), /<rect class="porvenir" /g), 0);
    assert.equal(cuantas(html, /<rect class="vida" /g), 1);
  });

  it('cada etiqueta que entra va con su fecha y su guía; la que no entra no va, pero su marca sigue con su title', () => {
    const hitos = Array.from({ length: 12 }, (_, i) => hito(i + 1, 900, `2025-06-${String(i + 1).padStart(2, '0')}`, `[TEST] Hito ${i + 1}`));
    const html = ctx.svgDeCinta(ctx.cintaDelProyecto(proyecto({ hitos }), HOY), '[TEST] Proyecto');
    assert.equal(cuantas(html, /<title>/g), 12);
    assert.equal(cuantas(html, /<text class="etq" /g), 3);
    assert.equal(cuantas(html, /<text class="etq-f" /g), 3);
    assert.equal(cuantas(html, /<line class="guia" /g), 3);
    assert.ok(html.includes('>01/06/2025</text>'));
  });

  it('un título o un nombre con HTML salen escapados en la etiqueta, en el title y en el aria-label', () => {
    const x = '<script>alert(1)</script>';
    const html = ctx.svgDeCinta(ctx.cintaDelProyecto(proyecto({ hitos: [hito(1, 900, '2025-05-01', x)] }), HOY), `"${x}`);
    assert.ok(!html.includes('<script'));
    assert.ok(html.includes('<title>01/05/2025: &lt;script&gt;alert(1)&lt;/script&gt;</title>'));
    assert.ok(html.includes('>&lt;script&gt;alert(1)&lt;/script&gt;</text>'));
    assert.ok(html.includes('aria-label="Recorrido de &quot;&lt;script&gt;alert(1)&lt;/script&gt;: 1 hito"'));
  });

  it('las guías van antes que las etiquetas (con su halo blanco) y la elevación, encima de los rombos: el mismo día que un hito se ve', () => {
    const html = svgDe(INDICE);
    const ultimaGuia = html.lastIndexOf('<line class="guia" ');
    assert.ok(ultimaGuia !== -1 && ultimaGuia < html.indexOf('<text class="etq" '));
    assert.ok(html.indexOf('<circle class="h-elev" ') > html.lastIndexOf('<rect class="h-hecho" '));
    const estilo = leer('proyectos.html').match(/<style>[\s\S]*?<\/style>/)[0];
    assert.match(estilo, /\.pr-cinta \.etq, \.pr-cinta \.etq-f \{[^}]*paint-order: stroke; stroke: #fff;/);
  });

  it('con muchos años, una marca por año y el número solo cada tantos: los años no se pisan', () => {
    const html = ctx.svgDeCinta(ctx.cintaDelProyecto(proyecto({ hitos: [hito(1, 900, '2000-03-01')] }), HOY), '[TEST] Proyecto');
    assert.equal(cuantas(html, /<line class="eje" /g), 27);
    const anios = [...html.matchAll(/<text class="anio" x="([\d.]+)"[^>]*>(\d{4})<\/text>/g)].map((m) => [Number(m[1]), m[2]]);
    assert.equal(anios[0][1], '2000');
    assert.ok(anios.length < 27 && anios.length > 1, String(anios.length));
    for (let i = 1; i < anios.length; i += 1) assert.ok(anios[i][0] - anios[i - 1][0] >= 36, `${anios[i - 1][1]} y ${anios[i][1]}`);
    // Con pocos años, todos
    assert.equal(cuantas(svgDe(INDICE), /<text class="anio" /g), 6);
  });

  it('toda coordenada del SVG queda dentro del dibujo', () => {
    for (const { id } of PROYECTOS) {
      const html = svgDe(id);
      for (const [, valor] of html.matchAll(/\s(?:x|x1|x2|cx)="(-?[\d.]+)"/g)) assert.ok(Number(valor) >= 0 && Number(valor) <= 1000, `${id}: ${valor}`);
    }
  });
});

describe('proyectos.js: las filas de los hitos (htmlDeHito, spec 3, 4 y 5)', () => {
  const del = (id) => HITOS.find((h) => h.id === id);
  const enElDetalle = (h, opciones = {}) => ctx.htmlDeHito(h, { conProyecto: false, esAdmin: false, hoy: HOY, ...opciones });

  it('la fila que se despliega: un botón con aria-expanded y aria-controls, y el cuerpo oculto con ese id', () => {
    const html = enElDetalle(del(10));
    assert.match(html, /^<li class="pr-mov"><button type="button" class="pr-fila" aria-expanded="false" aria-controls="hito-d-10">/);
    assert.ok(html.includes('<div class="pr-cuerpo" id="hito-d-10" hidden>'));
    assert.match(html, /<svg aria-hidden="true" focusable="false" class="abrir"/);
    // En la línea de tiempo y en los logros, otro id (las dos pestañas están en la misma página)
    assert.ok(ctx.htmlDeHito(del(10), { conProyecto: true, esAdmin: false, hoy: HOY }).includes('aria-controls="hito-l-10"'));
    assert.ok(enElDetalle(del(902), { prefijo: 'g' }).includes('aria-controls="hito-g-902"'));
  });

  it('la fecha, la marca, el título y la primera línea de la descripción; «Previsto» con la fecha futura', () => {
    const pasado = enElDetalle({ ...del(10), descripcion: 'Primera línea\nSegunda línea' });
    assert.ok(pasado.includes('<span class="f">10/04/2026</span><i class="pr-mk-hito marca" aria-hidden="true"></i>'));
    assert.ok(pasado.includes('<span class="q">Borrador de proyecto de ordenanza sobre blockchain</span><span class="d">Primera línea</span>'));
    assert.ok(pasado.includes('<p class="desc">Primera línea\nSegunda línea</p>'));
    assert.ok(!pasado.includes('Previsto'));
    const futuro = enElDetalle(del(901));
    assert.ok(futuro.includes('<i class="pr-mk-hito marca futuro" aria-hidden="true"></i>'));
    assert.ok(futuro.includes('<span class="q">Realización del Datathon 2026</span><span class="pr-futuro-etq">Previsto</span>'));
    // Hoy ya no es previsto
    assert.ok(!enElDetalle(hito(1, 900, HOY)).includes('Previsto'));
  });

  it('«Ver la evidencia» solo con un enlace http o https, con su dominio; un javascript: no se dibuja', () => {
    const conEnlace = enElDetalle(del(13));
    assert.ok(conEnlace.includes('<p><a class="sg-link" href="https://github.com/gobiernoabiertomcr/rpad/releases/tag/v1.5.0" target="_blank" rel="noopener">Ver la evidencia</a> <small class="pr-host">(github.com)</small></p>'));
    for (const url of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://ejemplo.gob.ar']) {
      const html = enElDetalle({ ...hito(1, 900, '2025-01-01'), evidencia_tipo: 'url', evidencia_url: url });
      assert.ok(!html.includes('Ver la evidencia') && !html.includes(url) && !html.includes('Enlace'), url);
    }
    assert.ok(enElDetalle({ ...hito(1, 900, '2025-01-01'), evidencia_url: 'https://usuario@ejemplo.gob.ar:8080/x' }).includes('(ejemplo.gob.ar:8080)'));
  });

  it('a la derecha, «Enlace» o «N archivos»', () => {
    const p = (h) => ctx.htmlDeHito(h, { conProyecto: true, esAdmin: false, hoy: HOY }).match(/<span class="p">([^<]*)<\/span>/)?.[1];
    assert.equal(p(del(13)), 'Enlace');
    assert.equal(p(del(1)), '1 archivo');
    assert.equal(p(del(7)), '');
    const archivo = { id: 1, nombre_archivo: 'a.pdf', tamano: 10, mime_type: 'application/pdf', subido_el: '2026-01-01' };
    assert.equal(p({ ...del(13), archivos: [archivo, { ...archivo, id: 2 }] }), 'Enlace y 2 archivos');
  });

  it('en la línea de tiempo: el cuadradito del color del proyecto, su nombre y el link al proyecto; un logro, su marca y «Logro del área»', () => {
    const delProyecto = ctx.htmlDeHito(del(13), { conProyecto: true, esAdmin: false, hoy: HOY });
    assert.ok(delProyecto.includes('<span class="pr-tile chico marca" style="--c:#3b82f6" aria-hidden="true"></span>'));
    assert.ok(delProyecto.includes('<span class="d">Registro Permanente de Actualización de Datasets (RPAD)</span>'));
    assert.ok(delProyecto.includes('<p><a class="sg-link" href="?id=6">Registro Permanente de Actualización de Datasets (RPAD)</a></p>'));
    const logro = ctx.htmlDeHito(del(902), { conProyecto: true, esAdmin: false, hoy: HOY });
    assert.ok(logro.includes('<span class="pr-tile chico logro marca" aria-hidden="true"></span>'));
    assert.ok(logro.includes('<span class="d">Logro del área</span>'));
    assert.doesNotMatch(logro, /href="\?id=/);
    // El link conserva los filtros de la lista
    assert.ok(ctx.htmlDeHito(del(13), { conProyecto: true, esAdmin: false, hoy: HOY, estado: { ...DE_ENTRADA, estado: 'completado' } }).includes('href="?estado=completado&amp;id=6"'));
  });

  it('las acciones de administración: «Editar el hito», «Subir archivos» y «Eliminar» (en un logro, «Editar el logro»); el lector no las ve', () => {
    const admin = enElDetalle(del(10), { esAdmin: true });
    assert.ok(admin.includes('<button type="button" class="sg-link" data-editar-hito="10" aria-label="Editar el hito Borrador de proyecto de ordenanza sobre blockchain">Editar el hito</button>'));
    assert.ok(admin.includes('<button type="button" class="sg-link" data-subir-archivos="10" aria-label="Subir archivos al hito Borrador de proyecto de ordenanza sobre blockchain">Subir archivos</button>'));
    assert.ok(admin.includes('<button type="button" class="sg-link rojo" data-eliminar-hito="10" aria-label="Eliminar el hito Borrador de proyecto de ordenanza sobre blockchain">Eliminar</button>'));
    const logro = enElDetalle(del(902), { esAdmin: true });
    assert.ok(logro.includes('>Editar el logro</button>') && logro.includes('aria-label="Eliminar el logro Mención en el Encuentro Federal de Gobierno Abierto"'));
    const lector = enElDetalle(del(10));
    assert.doesNotMatch(lector, /Editar el|Subir archivos|Eliminar|data-editar|data-eliminar/);
    assert.ok(lector.includes('Descargar'));
    assert.doesNotMatch(enElDetalle(del(10), { esAdmin: 'true' }), /Editar el hito/);
  });

  it('un título o una descripción con HTML salen escapados en la fila y en los aria-label', () => {
    const x = '<script>alert(1)</script>';
    const html = enElDetalle({ ...hito(5, 900, '2025-01-01', x), descripcion: x }, { esAdmin: true });
    assert.ok(!html.includes('<script'));
    assert.ok(html.includes('<span class="q">&lt;script&gt;alert(1)&lt;/script&gt;</span>'));
    assert.ok(html.includes('aria-label="Editar el hito &lt;script&gt;alert(1)&lt;/script&gt;"'));
  });
});

describe('proyectos.js: los archivos (htmlDeArchivos, spec 3 y 6)', () => {
  const ARCHIVOS = [
    { id: 8, nombre_archivo: 'informe-bo-10-mar-25.pdf', tamano: 92102, mime_type: 'application/pdf', subido_el: '2026-03-18' },
    { id: 9, nombre_archivo: 'sellado-bfa.jpg', tamano: 1486110, mime_type: 'image/jpeg', subido_el: '2026-02-06' },
    { id: 10, nombre_archivo: 'proyecto-ord.docx', tamano: 300, mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', subido_el: '2026-04-10' }
  ];
  const BASE = '/gestion/hitos/10/archivos';

  it('cada archivo: el recuadro con la extensión, el nombre, el tamaño y «Subido el dd/mm/aaaa»', () => {
    const html = ctx.htmlDeArchivos(ARCHIVOS, { esAdmin: false, base: BASE });
    assert.match(html, /^<ul class="pr-archivos">/);
    assert.deepEqual([...html.matchAll(/<span class="pr-ext" aria-hidden="true">([^<]*)<\/span>/g)].map((m) => m[1]), ['PDF', 'JPG', 'DOCX']);
    assert.deepEqual([...html.matchAll(/<small>([^<]*)<\/small>/g)].map((m) => m[1]), ['90 KB. Subido el 18/03/2026', '1,4 MB. Subido el 06/02/2026', '1 KB. Subido el 10/04/2026']);
    assert.ok(html.includes('<span class="n">informe-bo-10-mar-25.pdf</span>'));
  });

  it('el lector ve «Descargar» y no «Eliminar»; «Ver» solo en el PDF y en las imágenes', () => {
    const html = ctx.htmlDeArchivos(ARCHIVOS, { esAdmin: false, base: BASE });
    assert.equal(cuantas(html, />Descargar<\/button>/g), 3);
    assert.equal(cuantas(html, />Ver<\/button>/g), 2);
    assert.ok(!html.includes('Eliminar'));
    const docx = html.match(/<li class="pr-archivo">(?:(?!<\/li>)[\s\S])*proyecto-ord\.docx[\s\S]*?<\/li>/)[0];
    assert.ok(!docx.includes('>Ver<'));
  });

  it('administración ve también «Eliminar»; los botones llevan lo que necesita la parte del DOM en data-*', () => {
    const html = ctx.htmlDeArchivos(ARCHIVOS, { esAdmin: true, base: BASE });
    assert.equal(cuantas(html, />Eliminar<\/button>/g), 3);
    assert.ok(html.includes('<button type="button" class="sg-link" data-archivo="ver" data-base="/gestion/hitos/10/archivos" data-id="8" data-nombre="informe-bo-10-mar-25.pdf" data-mime="application/pdf" aria-label="Ver informe-bo-10-mar-25.pdf">Ver</button>'));
    assert.ok(html.includes('<button type="button" class="sg-link" data-archivo="descargar" data-base="/gestion/hitos/10/archivos" data-id="9" data-nombre="sellado-bfa.jpg" data-mime="image/jpeg" aria-label="Descargar sellado-bfa.jpg">Descargar</button>'));
    assert.ok(html.includes('<button type="button" class="sg-link rojo" data-archivo="eliminar" data-base="/gestion/hitos/10/archivos" data-id="10" data-nombre="proyecto-ord.docx" data-mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document" aria-label="Eliminar proyecto-ord.docx">Eliminar</button>'));
  });

  it('un nombre con tildes, espacios o HTML se ve como texto, también en los atributos', () => {
    const html = ctx.htmlDeArchivos([{ id: 1, nombre_archivo: 'presentación final "<img src=x>".pdf', tamano: 2048, mime_type: 'application/pdf', subido_el: '2026-10-25' }], { esAdmin: true, base: BASE });
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('<span class="n">presentación final &quot;&lt;img src=x&gt;&quot;.pdf</span>'));
    assert.ok(html.includes('data-nombre="presentación final &quot;&lt;img src=x&gt;&quot;.pdf"'));
  });

  it('sin archivos, nada; sin fecha o sin tamaño, lo que haya; sin un id que sirva, sin botones', () => {
    assert.equal(ctx.htmlDeArchivos([], { esAdmin: true, base: BASE }), '');
    assert.equal(ctx.htmlDeArchivos(undefined, { esAdmin: true, base: BASE }), '');
    const html = ctx.htmlDeArchivos([{ id: 'x', nombre_archivo: 'sin-extension', tamano: null, mime_type: null, subido_el: null }], { esAdmin: true, base: BASE });
    assert.ok(html.includes('<span class="pr-ext" aria-hidden="true"></span>'));
    assert.doesNotMatch(html, /<small>|<button/);
  });
});

describe('proyectos.js: los documentos (htmlDeDocumentos, spec 3)', () => {
  it('el lector: «N documentos» y la lista, sin «Subir documentos» ni el límite', () => {
    const html = ctx.htmlDeDocumentos(detalleDe(BOLETIN), { esAdmin: false });
    assert.match(html, /^<div class="pr-tarjeta"><div class="pr-cabeza"><h3 class="pr-h">Documentos<\/h3><span>2 documentos<\/span><\/div>/);
    assert.equal(cuantas(html, /<li class="pr-archivo">/g), 2);
    assert.ok(html.includes('data-base="/gestion/proyectos/4/documentos"'));
    assert.doesNotMatch(html, /Subir documentos|Hasta 10 documentos|Eliminar/);
    assert.ok(ctx.htmlDeDocumentos(detalleDe(DATATHON), { esAdmin: false }).includes('<span>1 documento</span>'));
  });

  it('administración: «Subir documentos» y, debajo, el límite', () => {
    const html = ctx.htmlDeDocumentos(detalleDe(BOLETIN), { esAdmin: true });
    assert.match(html, /<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-subir-documentos="4"><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>Subir documentos<\/button>/);
    assert.ok(html.includes('<p class="pr-vacio pr-nota">Hasta 10 documentos de 10 MB cada uno.</p>'));
    assert.equal(cuantas(html, />Eliminar<\/button>/g), 2);
  });

  it('sin documentos: «Este proyecto no tiene documentos.»', () => {
    assert.ok(ctx.htmlDeDocumentos(detalleDe(INDICE), { esAdmin: false }).includes('<p class="pr-vacio">Este proyecto no tiene documentos.</p>'));
    assert.ok(ctx.htmlDeDocumentos(detalleDe(INDICE), { esAdmin: true }).includes('<p class="pr-vacio">Este proyecto no tiene documentos.</p>'));
  });
});

describe('proyectos.js: el detalle de un proyecto (htmlDeDetalle, spec 3)', () => {
  it('el link de vuelta, la ficha, el Recorrido con la cantidad de hitos y la cinta, y las dos columnas', () => {
    const html = ctx.htmlDeDetalle(detalleDe(INDICE), { esAdmin: false, hoy: HOY });
    assert.ok(html.startsWith('<a class="pr-volver" href="proyectos.html">Ver todos los proyectos</a><div class="pr-tarjeta"><div class="pr-ficha">'));
    assert.ok(html.includes('<div class="pr-tarjeta"><div class="pr-cabeza"><h3 class="pr-h">Recorrido</h3><span>5 hitos</span></div><div class="pr-cinta-marco">'));
    assert.match(html, /<div class="pr-dos"><div class="pr-tarjeta"><div class="pr-cabeza"><h3 class="pr-h">Hitos<\/h3><span>5 hitos<\/span><\/div><ul class="pr-movs pr-compacta">/);
    assert.ok(html.includes('<h3 class="pr-h">Documentos</h3>'));
  });

  it('«Ver todos los proyectos» vuelve a la lista con sus filtros', () => {
    const html = ctx.htmlDeDetalle(detalleDe(INDICE), { esAdmin: false, hoy: HOY, estado: { ...DE_ENTRADA, estado: 'en_curso', anios: 2025 } });
    assert.ok(html.startsWith('<a class="pr-volver" href="proyectos.html?estado=en_curso&amp;anios=2025">Ver todos los proyectos</a>'));
  });

  it('los hitos, del más nuevo al más viejo', () => {
    const html = ctx.htmlDeDetalle({ ...detalleDe(INDICE), hitos: detalleDe(INDICE).hitos.slice().reverse() }, { esAdmin: false, hoy: HOY });
    assert.deepEqual([...html.matchAll(/aria-controls="hito-d-(\d+)"/g)].map((m) => Number(m[1])), [18, 17, 16, 15, 14]);
  });

  it('administración: «Nuevo hito» en lugar de la cantidad', () => {
    const html = ctx.htmlDeDetalle(detalleDe(INDICE), { esAdmin: true, hoy: HOY });
    assert.match(html, /<h3 class="pr-h">Hitos<\/h3><button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-nuevo-hito="7"><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>Nuevo hito<\/button>/);
  });

  it('sin hitos: la explicación de la spec y, para administración, «Cargar el primer hito»; la cinta sin eventos, su texto', () => {
    const texto = '<p>Este proyecto todavía no tiene hitos. Un hito es un paso cumplido o previsto: una elevación, un lanzamiento, una presentación.</p>';
    const lector = ctx.htmlDeDetalle(detalleDe(CHARLA), { esAdmin: false, hoy: HOY });
    assert.ok(lector.includes(`<div class="pr-vacio-caja">${texto}</div>`));
    assert.ok(lector.includes('<span>0 hitos</span>'));
    assert.ok(lector.includes('Sin hitos ni fecha de elevación: la cinta se dibuja cuando haya alguno.'));
    const admin = ctx.htmlDeDetalle(detalleDe(CHARLA), { esAdmin: true, hoy: HOY });
    assert.match(admin, new RegExp(`<div class="pr-vacio-caja">${texto.replace(/[.()]/g, '\\$&')}<button type="button" class="sg-btn sg-btn-tinta sg-btn-chico" data-nuevo-hito="5"><svg aria-hidden="true"[^>]*>[\\s\\S]*?</svg>Cargar el primer hito</button></div>`));
  });

  it('el lector no ve ningún botón que el servidor le niega', () => {
    const html = ctx.htmlDeDetalle(detalleDe(BOLETIN), { esAdmin: false, hoy: HOY });
    assert.doesNotMatch(html, /Eliminar|Editar|Subir|Nuevo hito|Cargar el primer|data-eliminar|data-editar|data-subir|data-nuevo/);
    assert.ok(html.includes('>Descargar</button>'));
  });

  it('un nombre con HTML se ve como texto en la ficha y en el rótulo de la cinta', () => {
    const x = '<img src=x onerror=alert(1)>';
    const html = ctx.htmlDeDetalle(proyecto({ nombre: x, hitos: [hito(1, 900, '2025-01-01', x)], documentos: [] }), { esAdmin: true, hoy: HOY });
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('aria-label="Recorrido de &lt;img src=x onerror=alert(1)&gt;: 1 hito"'));
  });
});

describe('proyectos.js: la línea de tiempo (htmlDeLinea, spec 4)', () => {
  const anios = (html) => [...html.matchAll(/<div class="pr-anio"><h2 id="linea-(\d{4})">\1<\/h2><small>([^<]*)<\/small><\/div>/g)].map((m) => [m[1], m[2]]);
  const chipsDe = (html) => [...html.matchAll(/<button type="button" class="sg-chip" data-grupo="linea" data-valor="(\w+)" aria-pressed="(true|false)">([^<]+) <b>(\d+)<\/b><\/button>/g)]
    .map(([, valor, pulsado, texto, cantidad]) => [valor, pulsado, texto, cantidad]);

  it('los filtros: Todos, De los proyectos y Logros del área, con su cantidad', () => {
    const html = ctx.htmlDeLinea(HITOS, { filtro: 'todos', hoy: HOY, esAdmin: false });
    assert.deepEqual(chipsDe(html), [['todos', 'true', 'Todos', '17'], ['proyectos', 'false', 'De los proyectos', '15'], ['logros', 'false', 'Logros del área', '2']]);
    assert.match(html, /<div class="sg-chips" role="group" aria-label="Qué hitos">/);
    // Un filtro que no sirve es Todos
    assert.deepEqual(chipsDe(ctx.htmlDeLinea(HITOS, { filtro: 'x', hoy: HOY, esAdmin: false })).map((c) => c[1]), ['true', 'false', 'false']);
  });

  it('los hitos agrupados por año, del más nuevo al más viejo, con «N hitos, hasta hoy y lo previsto» en el año de hoy', () => {
    const html = ctx.htmlDeLinea(HITOS, { filtro: 'todos', hoy: HOY, esAdmin: false });
    assert.deepEqual(anios(html), [['2026', '6 hitos, hasta hoy y lo previsto'], ['2025', '7 hitos'], ['2024', '1 hito'], ['2023', '1 hito'], ['2022', '1 hito'], ['2021', '1 hito']]);
    assert.ok(html.includes('<ul class="pr-movs" aria-labelledby="linea-2026">'));
    // Dentro de cada año, del más nuevo al más viejo
    const ids = [...html.matchAll(/aria-controls="hito-l-(\d+)"/g)].map((m) => Number(m[1]));
    assert.deepEqual(ids, HITOS.map((h) => h.id));
    assert.equal(cuantas(html, /<li class="pr-mov">/g), 17);
  });

  it('el filtro «Logros del área» deja solo los sin proyecto; «De los proyectos», el resto', () => {
    const logros = ctx.htmlDeLinea(HITOS, { filtro: 'logros', hoy: HOY, esAdmin: false });
    assert.deepEqual([...logros.matchAll(/aria-controls="hito-l-(\d+)"/g)].map((m) => Number(m[1])), [902, 903]);
    assert.deepEqual(anios(logros), [['2026', '1 hito, hasta hoy y lo previsto'], ['2025', '1 hito']]);
    assert.equal(cuantas(logros, /<span class="d">Logro del área<\/span>/g), 2);
    assert.deepEqual(chipsDe(logros).map((c) => c[1]), ['false', 'false', 'true']);
    const deProyectos = ctx.htmlDeLinea(HITOS, { filtro: 'proyectos', hoy: HOY, esAdmin: false });
    assert.equal(cuantas(deProyectos, /<li class="pr-mov">/g), 15);
    assert.doesNotMatch(deProyectos, /Logro del área<\/span>/);
  });

  it('sin hitos con el filtro: «No hay hitos con este filtro.»', () => {
    const html = ctx.htmlDeLinea(HITOS.filter((h) => h.proyecto_id !== null), { filtro: 'logros', hoy: HOY, esAdmin: false });
    assert.ok(html.includes('<p class="pr-vacio">No hay hitos con este filtro.</p>'));
    assert.doesNotMatch(html, /pr-anio|pr-mov/);
    assert.ok(ctx.htmlDeLinea([], { filtro: 'todos', hoy: HOY, esAdmin: false }).includes('No hay hitos con este filtro.'));
  });

  it('administración ve las acciones de cada hito; el lector, no', () => {
    assert.ok(ctx.htmlDeLinea(HITOS, { filtro: 'todos', hoy: HOY, esAdmin: true }).includes('data-editar-hito="901"'));
    assert.doesNotMatch(ctx.htmlDeLinea(HITOS, { filtro: 'todos', hoy: HOY, esAdmin: false }), /data-editar-hito|Eliminar/);
  });
});

describe('proyectos.js: los logros del área (htmlDeLogros, spec 5)', () => {
  const EXPLICACION = '<p class="pr-explica">Los logros que no son parte de un proyecto: un premio, una presentación, un convenio. Salen en el Informe anual, al final de los logros del año.</p>';

  it('el título, la explicación y los logros del más nuevo al más viejo; el lector, sin «Registrar un logro»', () => {
    const html = ctx.htmlDeLogros(HITOS, { esAdmin: false, hoy: HOY });
    assert.ok(html.startsWith(`<div class="pr-tarjeta"><div class="pr-cabeza"><div><h2 class="pr-h">Logros del área</h2>${EXPLICACION}</div></div>`));
    assert.deepEqual([...html.matchAll(/aria-controls="hito-g-(\d+)"/g)].map((m) => Number(m[1])), [902, 903]);
    assert.ok(!html.includes('Registrar un logro'));
    // Filas como las de los hitos: con la descripción y la evidencia
    assert.ok(html.includes('<span class="p">Enlace</span>') && html.includes('<span class="p">1 archivo</span>'));
  });

  it('administración: «Registrar un logro»', () => {
    const html = ctx.htmlDeLogros(HITOS, { esAdmin: true, hoy: HOY });
    assert.match(html, /<button type="button" class="sg-btn sg-btn-tinta sg-btn-chico" data-nuevo-logro><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>Registrar un logro<\/button><\/div>/);
    assert.ok(html.includes('>Editar el logro</button>'));
  });

  it('sin logros: «Todavía no hay logros del área.»', () => {
    const html = ctx.htmlDeLogros(HITOS.filter((h) => h.proyecto_id !== null), { esAdmin: false, hoy: HOY });
    assert.ok(html.includes('<div class="pr-vacio-caja"><p>Todavía no hay logros del área.</p></div>'));
    assert.doesNotMatch(html, /pr-mov/);
  });
});

// =====================================================
// Task 7: formularios, archivos y confirmaciones (spec 6, 9 y 10)
// =====================================================

// Un texto de n caracteres contados con Array.from, con tildes y emojis (cada emoji son dos unidades de UTF-16: un .length daría más)
const largo = (n) => Array.from({ length: n }, (_, i) => (i % 2 ? 'é' : '😀')).join('');
const MB = 1024 * 1024;

describe('proyectos.js: las copias del servidor (paridad)', () => {
  it('los mensajes, los largos y la fecha mínima son los de services/proyectosReglas.js', () => {
    assert.deepEqual(constante('MENSAJES_PROYECTOS'), { ...MENSAJES_PROYECTOS });
    assert.deepEqual(constante('LARGOS_PROYECTOS'), { ...LARGOS });
    assert.equal(constante('FECHA_MINIMA_PROYECTOS'), FECHA_MINIMA);
  });

  it('los estados, las prioridades, las categorías y los íconos son los del servidor (y los íconos, los de ICON_SELECTOR_MAP de main.js)', () => {
    assert.deepEqual(constante('ESTADOS'), [...ESTADOS_PROYECTO]);
    assert.deepEqual(constante('PRIORIDADES'), [...PRIORIDADES]);
    assert.deepEqual(constante('CATEGORIAS'), [...CATEGORIAS]);
    assert.deepEqual(constante('ICONOS'), [...ICONOS_PROYECTO]);
    assert.deepEqual(constante('ICONOS'), constante('Object.keys(ICON_SELECTOR_MAP)'));
    // Cada ícono con su nombre en castellano (el rótulo de su opción)
    assert.deepEqual(Object.keys(constante('NOMBRE_DEL_ICONO')), [...ICONOS_PROYECTO]);
    for (const nombre of Object.values(constante('NOMBRE_DEL_ICONO'))) assert.match(nombre, /^[A-ZÁÉÍÓÚ][a-záéíóúñ ]+$/, nombre);
  });

  it('las extensiones, los 10 MB, los máximos y los mensajes de los archivos son los de config/upload.js', () => {
    assert.deepEqual(constante('EXTENSIONES_PERMITIDAS'), [...subidas.EXTENSIONES_PERMITIDAS]);
    assert.equal(constante('TAMANO_MAXIMO'), subidas.TAMANO_MAXIMO);
    assert.equal(constante('MAXIMO_POR_HITO'), subidas.MAXIMO_POR_HITO);
    assert.equal(constante('MAXIMO_POR_PROYECTO'), subidas.MAXIMO_POR_PROYECTO);
    assert.equal(constante('MENSAJE_MAXIMO_POR_HITO'), subidas.MENSAJE_MAXIMO_POR_HITO);
    assert.equal(constante('MENSAJE_MAXIMO_POR_PROYECTO'), subidas.MENSAJE_MAXIMO_POR_PROYECTO);
    assert.equal(constante('MENSAJE_TAMANO_MAXIMO'), subidas.MENSAJE_TAMANO_MAXIMO);
    for (const extension of ['.exe', '', '.', '.PDF', '.tar']) {
      assert.equal(vm.runInContext(`mensajeTipoNoPermitido(${JSON.stringify(extension)})`, ctx), subidas.mensajeTipoNoPermitido(extension));
    }
  });

  it('fechaMaxima: el 31/12 de cinco años después; null si hoy no es una fecha (como la del servidor)', () => {
    for (const hoy of [HOY, '2026-01-01', '2024-02-29', '9994-06-01', '9996-01-01', '2026-02-29', '2026-10-25T10:00', ' 2026-10-25', '', null, undefined, 20261025]) {
      assert.equal(ctx.fechaMaxima(hoy), fechaMaxima(hoy), String(hoy));
    }
    assert.equal(ctx.fechaMaxima(HOY), '2031-12-31');
    assert.equal(ctx.fechaMaxima('2026-02-30'), null);
  });

  it('la paleta: los 10 colores de la spec, en su orden', () => {
    assert.deepEqual(constante('PALETA'), [
      { color: '#1A365D', nombre: 'Azul tinta' }, { color: '#0950C6', nombre: 'Azul oscuro' }, { color: '#3B82F6', nombre: 'Azul' },
      { color: '#2B7AB8', nombre: 'Celeste' }, { color: '#0E7490', nombre: 'Petróleo' }, { color: '#2E6B4C', nombre: 'Verde' },
      { color: '#F45000', nombre: 'Naranja' }, { color: '#CC0066', nombre: 'Magenta' }, { color: '#6D4BA8', nombre: 'Violeta' },
      { color: '#56677F', nombre: 'Gris' }
    ]);
  });

  it('los campos de cada formulario son los que valida el servidor (los mismos nombres que el campo de sus errores)', () => {
    const campos = constante('CAMPOS_DEL_FORMULARIO');
    assert.deepEqual(Object.keys(campos.proyecto), Object.keys(validarProyecto({}, { hoy: HOY }).datos));
    assert.deepEqual(Object.keys(campos.hito), Object.keys(validarHito({}, { hoy: HOY }).datos));
  });
});

describe('proyectos.js: erroresDelProyecto da lo mismo que validarProyecto (spec 9)', () => {
  const BASE = {
    nombre: '[TEST] Proyecto', descripcion: '', estado: 'idea', prioridad: 'media', categoria: 'tecnologia', fecha_inicio: '',
    responsable: '', enlace_externo: '', color: '#1A365D', icono: 'folder', areas: []
  };
  // Sin el segundo argumento, HOY; con él, el que llega (también undefined: sin un hoy que sirva)
  const iguales = (valores, ...otro) => {
    const hoy = otro.length ? otro[0] : HOY;
    const esperado = validarProyecto(valores, { hoy }).errores;
    assert.deepEqual(plano(ctx.erroresDelProyecto(valores, hoy)), esperado, JSON.stringify(valores));
    return esperado;
  };

  it('los casos de la spec: el nombre vacío, de 200 y de 201 caracteres (con tildes y emojis), el 29/02/2026, un ftp:// y un #ABCDEF', () => {
    assert.deepEqual(iguales({ ...BASE, nombre: '' }), [{ campo: 'nombre', mensaje: 'Escribí el nombre del proyecto.' }]);
    assert.deepEqual(iguales({ ...BASE, nombre: largo(200) }), []);
    assert.ok(largo(200).length > 200, 'el texto de 200 caracteres tiene más de 200 unidades de UTF-16');
    assert.deepEqual(iguales({ ...BASE, nombre: largo(201) }), [{ campo: 'nombre', mensaje: 'El nombre puede tener hasta 200 caracteres.' }]);
    assert.deepEqual(iguales({ ...BASE, fecha_inicio: '2026-02-29' }), [{ campo: 'fecha_inicio', mensaje: 'La fecha de elevación no es válida.' }]);
    assert.deepEqual(iguales({ ...BASE, enlace_externo: 'ftp://x' }), [{ campo: 'enlace_externo', mensaje: 'El enlace tiene que empezar con http:// o https://.' }]);
    // Cualquier #RRGGBB vale, no solo los de la paleta: un proyecto conserva su color actual
    assert.deepEqual(iguales({ ...BASE, color: '#ABCDEF' }), []);
  });

  it('los bordes: espacios, vacíos que toman el valor por defecto, listas, fechas, largos, enlaces, color, ícono y áreas', () => {
    const casos = [
      {}, null, 'texto', [], { ...BASE },
      { ...BASE, nombre: '   ' }, { ...BASE, nombre: `  ${largo(200)}  ` }, { ...BASE, nombre: 123 }, { ...BASE, nombre: null },
      { ...BASE, estado: '' }, { ...BASE, estado: null }, { ...BASE, estado: undefined }, { ...BASE, estado: 'otro' }, { ...BASE, estado: ' en_curso ' },
      { ...BASE, prioridad: 'urgente' }, { ...BASE, prioridad: '' }, { ...BASE, categoria: 'deporte' }, { ...BASE, categoria: 7 },
      { ...BASE, fecha_inicio: '1999-12-31' }, { ...BASE, fecha_inicio: '2000-01-01' }, { ...BASE, fecha_inicio: '2031-12-31' },
      { ...BASE, fecha_inicio: '2032-01-01' }, { ...BASE, fecha_inicio: '2026-1-5' }, { ...BASE, fecha_inicio: 20260105 },
      { ...BASE, fecha_inicio: ' 2026-01-05 ' }, { ...BASE, fecha_inicio: '2026-01-05T00:00' },
      { ...BASE, responsable: largo(150) }, { ...BASE, responsable: largo(151) }, { ...BASE, responsable: 5 },
      { ...BASE, enlace_externo: `https://${'a'.repeat(492)}` }, { ...BASE, enlace_externo: `https://${'a'.repeat(493)}` },
      { ...BASE, enlace_externo: ' HTTPS://ejemplo.gob.ar ' }, { ...BASE, enlace_externo: 'javascript:alert(1)' }, { ...BASE, enlace_externo: 42 },
      { ...BASE, color: '#abc' }, { ...BASE, color: 'red' }, { ...BASE, color: '' }, { ...BASE, color: '#6CA3C6' }, { ...BASE, color: ' #6ca3c6 ' },
      { ...BASE, icono: 'x' }, { ...BASE, icono: '' }, { ...BASE, icono: 'award' },
      { ...BASE, areas: ['1', '2'] }, { ...BASE, areas: [3, 3] }, { ...BASE, areas: ['1', 'x'] }, { ...BASE, areas: 'abc' }, { ...BASE, areas: null },
      { ...BASE, areas: [0] }, { ...BASE, areas: ['01'] }, { ...BASE, areas: [1.5] }, { ...BASE, areas: [12345678901] },
      { nombre: '', estado: 'x', prioridad: 'y', categoria: 'z', fecha_inicio: 'w', responsable: largo(151), enlace_externo: 'v', color: 'u', icono: 't', areas: 's' }
    ];
    for (const caso of casos) iguales(caso);
  });

  it('sin un hoy que sirva, una fecha cargada no pasa (sin tope no hay rango); sin fecha, no hay error', () => {
    for (const hoy of ['2026-02-30', '', undefined, null]) {
      assert.deepEqual(iguales({ ...BASE, fecha_inicio: '2026-01-01' }, hoy), [{ campo: 'fecha_inicio', mensaje: 'La fecha de elevación no es válida.' }]);
      assert.deepEqual(iguales({ ...BASE }, hoy), []);
    }
  });

  it('el orden de los errores es el del servidor', () => {
    const todos = iguales({ nombre: '', estado: 'x', prioridad: 'y', categoria: 'z', fecha_inicio: 'w', responsable: largo(151), enlace_externo: 'v', color: 'u', icono: 't', areas: 's' });
    assert.deepEqual(todos.map((e) => e.campo), ['nombre', 'estado', 'prioridad', 'categoria', 'fecha_inicio', 'responsable', 'enlace_externo', 'color', 'icono', 'areas']);
  });
});

describe('proyectos.js: erroresDelHito da lo mismo que validarHito (spec 9)', () => {
  const BASE = { titulo: '[TEST] Hito', fecha: HOY, descripcion: '', evidencia_url: '' };
  // Sin el segundo argumento, HOY; con él, el que llega (también undefined: sin un hoy que sirva)
  const iguales = (valores, ...otro) => {
    const hoy = otro.length ? otro[0] : HOY;
    const esperado = validarHito(valores, { hoy }).errores;
    assert.deepEqual(plano(ctx.erroresDelHito(valores, hoy)), esperado, JSON.stringify(valores));
    return esperado;
  };

  it('los casos de la spec: el título vacío, de 200 y de 201 caracteres, el 29/02/2026 y un ftp://', () => {
    assert.deepEqual(iguales({ ...BASE, titulo: '' }), [{ campo: 'titulo', mensaje: 'Escribí el título del hito.' }]);
    assert.deepEqual(iguales({ ...BASE, titulo: largo(200) }), []);
    assert.deepEqual(iguales({ ...BASE, titulo: largo(201) }), [{ campo: 'titulo', mensaje: 'El título puede tener hasta 200 caracteres.' }]);
    assert.deepEqual(iguales({ ...BASE, fecha: '2026-02-29' }), [{ campo: 'fecha', mensaje: 'La fecha del hito no es válida.' }]);
    assert.deepEqual(iguales({ ...BASE, evidencia_url: 'ftp://x' }), [{ campo: 'evidencia_url', mensaje: 'El enlace de la evidencia tiene que empezar con http:// o https://.' }]);
  });

  it('los bordes: la fecha que falta, fuera de rango o mal escrita; un hito previsto; la evidencia larga; lo que no es un texto', () => {
    const casos = [
      {}, null, { ...BASE }, { ...BASE, titulo: '   ' }, { ...BASE, titulo: 9 }, { ...BASE, fecha: '' }, { ...BASE, fecha: null }, { ...BASE, fecha: '   ' },
      { ...BASE, fecha: '1999-12-31' }, { ...BASE, fecha: '2000-01-01' }, { ...BASE, fecha: '2031-12-31' }, { ...BASE, fecha: '2032-01-01' },
      { ...BASE, fecha: '2027-03-01' }, { ...BASE, fecha: '25/10/2026' }, { ...BASE, fecha: 20261025 },
      { ...BASE, evidencia_url: `https://${'a'.repeat(492)}` }, { ...BASE, evidencia_url: `https://${'a'.repeat(493)}` },
      { ...BASE, evidencia_url: 'javascript:alert(1)' }, { ...BASE, evidencia_url: '  ' }, { ...BASE, evidencia_url: 7 },
      { titulo: '', fecha: 'x', evidencia_url: 'y' }
    ];
    for (const caso of casos) iguales(caso);
    assert.deepEqual(iguales({ ...BASE, fecha: '' }), [{ campo: 'fecha', mensaje: 'Elegí la fecha del hito.' }]);
  });

  it('sin un hoy que sirva, ninguna fecha pasa', () => {
    for (const hoy of ['2026-13-01', undefined]) {
      assert.deepEqual(iguales({ ...BASE, fecha: '2026-01-01' }, hoy), [{ campo: 'fecha', mensaje: 'La fecha del hito no es válida.' }]);
    }
  });
});

describe('proyectos.js: los archivos antes de enviarlos (problemaDeArchivo, spec 6)', () => {
  const deHito = (existentes = [], elegidos = []) => ({ tipo: 'hito', existentes, elegidos });
  const deProyecto = (existentes = [], elegidos = []) => ({ tipo: 'proyecto', existentes, elegidos });
  const nombres = (n, prefijo = 'doc') => Array.from({ length: n }, (_, i) => `${prefijo}-${i + 1}.pdf`);

  it('un .exe no se suma, con el mensaje del servidor', () => {
    assert.equal(ctx.problemaDeArchivo({ name: 'instalador.EXE', size: 1000 }, deHito()), 'Tipo de archivo no permitido: .exe');
    assert.equal(ctx.problemaDeArchivo({ name: 'instalador.exe', size: 1000 }, deHito()), subidas.mensajeTipoNoPermitido('.exe'));
  });

  it('la extensión se lee como la lee el servidor (path.extname, en minúsculas)', () => {
    for (const nombre of ['a.pdf', 'A.PDF', 'informe.final.docx', '.pdf', 'sin-extension', 'punto.', 'a..pdf', '..pdf', '...', '..', 'x.tar.gz', 'foto.JPEG', 'archivo.7Z', 'planilla.Xlsx']) {
      const extension = path.posix.extname(nombre).toLowerCase();
      const esperado = subidas.EXTENSIONES_PERMITIDAS.includes(extension) ? null : subidas.mensajeTipoNoPermitido(extension);
      assert.equal(ctx.problemaDeArchivo({ name: nombre, size: 10 }, deHito()), esperado, nombre);
    }
  });

  it('10 MB entra; 10 MB y un byte, no', () => {
    assert.equal(ctx.problemaDeArchivo({ name: 'grande.pdf', size: 10 * MB }, deHito()), null);
    assert.equal(ctx.problemaDeArchivo({ name: 'grande.pdf', size: 10 * MB + 1 }, deHito()), 'El archivo excede el tamaño máximo de 10 MB');
  });

  it('el cuarto archivo de un hito, contando los que ya tiene y los elegidos', () => {
    assert.equal(ctx.problemaDeArchivo({ name: 'c.pdf', size: 10 }, deHito(['a.pdf'], ['b.pdf'])), null);
    assert.equal(ctx.problemaDeArchivo({ name: 'd.pdf', size: 10 }, deHito(['a.pdf', 'b.pdf'], ['c.pdf'])), 'Podés subir hasta 3 archivos por hito.');
    assert.equal(ctx.problemaDeArchivo({ name: 'd.pdf', size: 10 }, deHito(['a.pdf', 'b.pdf', 'c.pdf'])), 'Podés subir hasta 3 archivos por hito.');
    assert.equal(ctx.problemaDeArchivo({ name: 'd.pdf', size: 10 }, deHito([], ['a.pdf', 'b.pdf', 'c.pdf'])), 'Podés subir hasta 3 archivos por hito.');
  });

  it('el undécimo documento de un proyecto', () => {
    assert.equal(ctx.problemaDeArchivo({ name: 'nuevo.pdf', size: 10 }, deProyecto(nombres(8), ['otro.pdf'])), null);
    assert.equal(ctx.problemaDeArchivo({ name: 'nuevo.pdf', size: 10 }, deProyecto(nombres(9), ['otro.pdf'])), 'Podés subir hasta 10 documentos por proyecto.');
    assert.equal(ctx.problemaDeArchivo({ name: 'nuevo.pdf', size: 10 }, deProyecto(nombres(10))), 'Podés subir hasta 10 documentos por proyecto.');
  });

  it('un nombre repetido, en la misma tanda o entre los que ya tiene (con tildes y espacios, también escrito con otra normalización)', () => {
    const nombre = 'presentación final.pdf';
    assert.equal(ctx.problemaDeArchivo({ name: nombre, size: 10 }, deHito([], [nombre])), 'Ya hay un archivo llamado presentación final.pdf.');
    assert.equal(ctx.problemaDeArchivo({ name: nombre, size: 10 }, deProyecto([nombre])), 'Ya hay un archivo llamado presentación final.pdf.');
    assert.equal(ctx.problemaDeArchivo({ name: nombre.normalize('NFD'), size: 10 }, deHito([nombre])), `Ya hay un archivo llamado ${nombre.normalize('NFD')}.`);
    assert.equal(ctx.problemaDeArchivo({ name: 'Presentación final.pdf', size: 10 }, deHito([nombre])), null);
  });

  it('el orden: la extensión, el tamaño, la cantidad y el repetido; lo que no es un archivo no pasa', () => {
    assert.equal(ctx.problemaDeArchivo({ name: 'a.exe', size: 11 * MB }, deHito(['a.exe', 'b.pdf', 'c.pdf'])), 'Tipo de archivo no permitido: .exe');
    assert.equal(ctx.problemaDeArchivo({ name: 'a.pdf', size: 11 * MB }, deHito(['a.pdf', 'b.pdf', 'c.pdf'])), 'El archivo excede el tamaño máximo de 10 MB');
    assert.equal(ctx.problemaDeArchivo({ name: 'a.pdf', size: 1 }, deHito(['a.pdf', 'b.pdf', 'c.pdf'])), 'Podés subir hasta 3 archivos por hito.');
    assert.equal(ctx.problemaDeArchivo(null, deHito()), 'Tipo de archivo no permitido: ');
    assert.equal(ctx.problemaDeArchivo({ name: 'a.pdf' }, deHito()), 'El archivo excede el tamaño máximo de 10 MB');
    // Un tipo desconocido cuenta como un hito (el límite más chico); sin listas, ninguno
    assert.equal(ctx.problemaDeArchivo({ name: 'd.pdf', size: 1 }, { tipo: 'otro', existentes: ['a.pdf', 'b.pdf', 'c.pdf'] }), 'Podés subir hasta 3 archivos por hito.');
    assert.equal(ctx.problemaDeArchivo({ name: 'd.pdf', size: 1 }, { tipo: 'proyecto', existentes: 'x', elegidos: null }), null);
  });
});

describe('proyectos.js: el color y el ícono (htmlDeColores y htmlDeIconos, spec 6)', () => {
  const opciones = (html) => [...html.matchAll(/<label class="pr-color" style="--c:([^"]*)" title="([^"]*)"><input type="radio" name="p-color" value="([^"]*)" aria-label="([^"]*)" aria-describedby="p-color-error"( checked)?><\/label>/g)]
    .map(([, estilo, titulo, valor, rotulo, elegido]) => ({ estilo, titulo, valor, rotulo, elegido: Boolean(elegido) }));

  it('un color que no está en la paleta va primero, como «Color actual», elegido; después, los 10 sin elegir', () => {
    const html = ctx.htmlDeColores('#6CA3C6');
    const lista = opciones(html);
    assert.equal(cuantas(html, /<label /g), 11);
    assert.equal(lista.length, 11);
    assert.deepEqual(lista[0], { estilo: '#6CA3C6', titulo: 'Color actual', valor: '#6CA3C6', rotulo: 'Color actual', elegido: true });
    assert.deepEqual(lista.slice(1).map((o) => [o.valor, o.titulo, o.elegido]), constante('PALETA').map(({ color, nombre }) => [color, nombre, false]));
    assert.equal(cuantas(html, / checked/g), 1);
  });

  it('un color de la paleta no suma «Color actual» y queda elegido (Azul)', () => {
    const html = ctx.htmlDeColores('#3B82F6');
    assert.doesNotMatch(html, /Color actual/);
    assert.equal(cuantas(html, /<label /g), 10);
    assert.deepEqual(opciones(html).filter((o) => o.elegido).map((o) => o.titulo), ['Azul']);
  });

  it('el mismo color en minúsculas es el de la paleta y conserva su escritura: guardar sin tocarlo no cambia nada', () => {
    const elegido = opciones(ctx.htmlDeColores('#cc0066')).filter((o) => o.elegido);
    assert.deepEqual(elegido, [{ estilo: '#cc0066', titulo: 'Magenta', valor: '#cc0066', rotulo: 'Magenta', elegido: true }]);
    assert.doesNotMatch(ctx.htmlDeColores('#cc0066'), /Color actual/);
  });

  it('lo que no es #RRGGBB nunca llega al style: queda el azul tinta, sin «Color actual»', () => {
    for (const raro of ['red', '#abc', null, undefined, '"><img src=x onerror=alert(1)>', '#6CA3C6;background:url(x)']) {
      const html = ctx.htmlDeColores(raro);
      assert.doesNotMatch(html, /Color actual|onerror|url\(/, String(raro));
      assert.deepEqual(opciones(html).filter((o) => o.elegido).map((o) => o.titulo), ['Azul tinta'], String(raro));
    }
  });

  it('los 25 íconos de ICON_SELECTOR_MAP como opciones de radio, cada uno con su nombre y su dibujo decorativo; el actual, elegido', () => {
    const html = ctx.htmlDeIconos('award');
    const lista = [...html.matchAll(/<label class="pr-icono" title="([^"]+)"><input type="radio" name="p-icono" value="([^"]+)" aria-label="([^"]+)" aria-describedby="p-icono-error"( checked)?><svg aria-hidden="true" focusable="false" [^>]*>[\s\S]*?<\/svg><\/label>/g)]
      .map(([, titulo, valor, rotulo, elegido]) => ({ titulo, valor, rotulo, elegido: Boolean(elegido) }));
    assert.deepEqual(lista.map((o) => o.valor), [...ICONOS_PROYECTO]);
    const nombres = constante('NOMBRE_DEL_ICONO');
    assert.ok(lista.every((o) => o.titulo === nombres[o.valor] && o.rotulo === nombres[o.valor]));
    assert.deepEqual(lista.filter((o) => o.elegido).map((o) => o.valor), ['award']);
    assert.equal(nombres.award, 'Premio');
  });

  it('un ícono que no está queda en el que dibuja la lista para él (clipboard-list); nada pasa de más', () => {
    for (const raro of [null, 'x', '"><img src=x onerror=alert(1)>']) {
      const html = ctx.htmlDeIconos(raro);
      assert.equal(cuantas(html, / checked/g), 1);
      assert.match(html, /value="clipboard-list" aria-label="[^"]+" aria-describedby="p-icono-error" checked>/);
      assert.doesNotMatch(html, /onerror/);
    }
  });
});

describe('proyectos.js: lo que precarga cada formulario (valoresDelProyecto y valoresDelHito, spec 6)', () => {
  it('un proyecto nuevo: vacío, Idea, Tecnología, Media, el azul tinta y la carpeta', () => {
    assert.deepEqual(plano(ctx.valoresDelProyecto(null)), {
      nombre: '', descripcion: '', estado: 'idea', prioridad: 'media', categoria: 'tecnologia', fecha_inicio: '', responsable: '',
      enlace_externo: '', color: '#1A365D', icono: 'folder', areas: []
    });
  });

  it('un proyecto que se edita: sus datos, la fecha como texto y las áreas como ids', () => {
    const p = proyecto({
      nombre: '[TEST] Editado', descripcion: 'Una\nlínea', estado: 'completado', prioridad: 'alta', categoria: 'difusion', fecha_inicio: '2025-03-10',
      responsable: '[TEST] Responsable', enlace_externo: 'https://ejemplo.gob.ar', color: '#0E7490', icono: 'award', areas: [{ id: 3, nombre: 'A' }, { id: 5, nombre: 'B' }]
    });
    assert.deepEqual(plano(ctx.valoresDelProyecto(p)), {
      nombre: '[TEST] Editado', descripcion: 'Una\nlínea', estado: 'completado', prioridad: 'alta', categoria: 'difusion', fecha_inicio: '2025-03-10',
      responsable: '[TEST] Responsable', enlace_externo: 'https://ejemplo.gob.ar', color: '#0E7490', icono: 'award', areas: ['3', '5']
    });
  });

  it('un color fuera de la paleta se conserva: aparece «Color actual» elegido y guardar sin tocarlo no da errores ni cambia el color', () => {
    const valores = ctx.valoresDelProyecto(proyecto({ color: '#6CA3C6' }));
    assert.equal(valores.color, '#6CA3C6');
    assert.match(ctx.htmlDeColores(valores.color), /^<label class="pr-color" style="--c:#6CA3C6" title="Color actual"><input type="radio" name="p-color" value="#6CA3C6" aria-label="Color actual" aria-describedby="p-color-error" checked>/);
    assert.deepEqual(plano(ctx.erroresDelProyecto(valores, HOY)), []);
  });

  it('lo que no sirve cae a lo que se ve en la lista: el estado, la categoría y la prioridad de entrada, el azul tinta y el ícono de siempre', () => {
    const valores = plano(ctx.valoresDelProyecto(proyecto({
      nombre: null, estado: 'otro', prioridad: null, categoria: 'x', fecha_inicio: '2026-02-30', color: 'rojo', icono: 'x', responsable: null, areas: [{ id: 'x' }, { id: 4 }, 4, '7']
    })));
    assert.deepEqual(valores, {
      nombre: '', descripcion: '', estado: 'idea', prioridad: 'media', categoria: 'tecnologia', fecha_inicio: '', responsable: '', enlace_externo: '',
      color: '#1A365D', icono: 'clipboard-list', areas: ['4', '7']
    });
  });

  it('un hito nuevo: vacío, con la fecha de hoy; uno que se edita, sus datos', () => {
    assert.deepEqual(plano(ctx.valoresDelHito(null, HOY)), { titulo: '', fecha: HOY, descripcion: '', evidencia_url: '' });
    const h = { ...hito(5, 900, '2025-06-30T00:00:00.000Z', '[TEST] Lanzamiento'), descripcion: 'Detalle', evidencia_url: 'https://ejemplo.gob.ar/nota' };
    assert.deepEqual(plano(ctx.valoresDelHito(h, HOY)), { titulo: '[TEST] Lanzamiento', fecha: '2025-06-30', descripcion: 'Detalle', evidencia_url: 'https://ejemplo.gob.ar/nota' });
    // Sin un hoy que sirva, el de hoy en Argentina
    assert.equal(ctx.valoresDelHito(null, 'ayer').fecha, vm.runInContext('Utils.hoyEnArgentina()', ctx));
  });

  it('los textos de cada modal: el título, de quién es el hito y el botón', () => {
    const p = proyecto({ nombre: '[TEST] Índice' });
    assert.deepEqual(plano(ctx.textosDelModalDeProyecto(null)), { titulo: 'Nuevo proyecto', boton: 'Guardar el proyecto' });
    assert.deepEqual(plano(ctx.textosDelModalDeProyecto(p)), { titulo: 'Editar [TEST] Índice', boton: 'Guardar el proyecto' });
    assert.deepEqual(plano(ctx.textosDelModalDeHito({ proyecto: p })), {
      titulo: 'Nuevo hito', de: 'Del proyecto [TEST] Índice. Sale en el Informe anual del año de su fecha.', boton: 'Guardar el hito', logro: false
    });
    assert.equal(ctx.textosDelModalDeHito({ proyecto: p, hito: hito(1, 900, HOY) }).titulo, 'Editar el hito');
    // En la línea de tiempo, el hito trae el nombre de su proyecto
    assert.equal(ctx.textosDelModalDeHito({ hito: { ...hito(1, 900, HOY), proyecto_nombre: '[TEST] Otro' } }).de, 'Del proyecto [TEST] Otro. Sale en el Informe anual del año de su fecha.');
    assert.deepEqual(plano(ctx.textosDelModalDeHito({})), {
      titulo: 'Registrar un logro del área', de: 'Un logro que no es parte de un proyecto. Sale en el Informe anual del año de su fecha.', boton: 'Guardar el logro', logro: true
    });
    assert.deepEqual(plano(ctx.textosDelModalDeHito({ hito: hito(2, null, HOY) })), {
      titulo: 'Editar el logro', de: 'Un logro que no es parte de un proyecto. Sale en el Informe anual del año de su fecha.', boton: 'Guardar el logro', logro: true
    });
  });
});

describe('proyectos.js: las confirmaciones (textoDeConfirmacion, spec 6)', () => {
  it('eliminar un proyecto: con hitos y documentos, con uno solo de los dos o sin ninguno', () => {
    assert.equal(ctx.textoDeConfirmacion('proyecto', { nombre: '[TEST] Índice', hitos: 5, documentos: 2 }),
      '¿Eliminar el proyecto [TEST] Índice? Deja de verse en la lista, en la línea de tiempo y en el Informe anual, con 5 hitos y 2 documentos.');
    assert.equal(ctx.textoDeConfirmacion('proyecto', { nombre: '[TEST] Índice', hitos: 1, documentos: 0 }),
      '¿Eliminar el proyecto [TEST] Índice? Deja de verse en la lista, en la línea de tiempo y en el Informe anual, con 1 hito.');
    assert.equal(ctx.textoDeConfirmacion('proyecto', { nombre: '[TEST] Índice', hitos: 0, documentos: 1 }),
      '¿Eliminar el proyecto [TEST] Índice? Deja de verse en la lista, en la línea de tiempo y en el Informe anual, con 1 documento.');
    assert.equal(ctx.textoDeConfirmacion('proyecto', { nombre: '[TEST] Índice', hitos: 0, documentos: 0 }),
      '¿Eliminar el proyecto [TEST] Índice? Deja de verse en la lista, en la línea de tiempo y en el Informe anual.');
    // El detalle de un proyecto sirve tal cual: cuenta sus listas
    assert.equal(ctx.textoDeConfirmacion('proyecto', { ...detalleDe(BOLETIN), nombre: '[TEST] Boletín' }),
      '¿Eliminar el proyecto [TEST] Boletín? Deja de verse en la lista, en la línea de tiempo y en el Informe anual, con 2 hitos y 2 documentos.');
  });

  it('eliminar un hito: sin archivos, solo la pregunta; con uno, «su archivo»; con más, «sus N archivos»', () => {
    assert.equal(ctx.textoDeConfirmacion('hito', { titulo: '[TEST] Lanzamiento', archivos: [] }), '¿Eliminar el hito [TEST] Lanzamiento?');
    assert.equal(ctx.textoDeConfirmacion('hito', { titulo: '[TEST] Lanzamiento', archivos: [{ id: 1 }] }), '¿Eliminar el hito [TEST] Lanzamiento? Se borra también su archivo.');
    assert.equal(ctx.textoDeConfirmacion('hito', { titulo: '[TEST] Lanzamiento', archivos: 3 }), '¿Eliminar el hito [TEST] Lanzamiento? Se borran también sus 3 archivos.');
  });

  it('eliminar un logro: el mismo texto, con «logro»; eliminar un archivo, solo su nombre', () => {
    assert.equal(ctx.textoDeConfirmacion('logro', { titulo: '[TEST] Premio', archivos: [{ id: 1 }, { id: 2 }] }), '¿Eliminar el logro [TEST] Premio? Se borran también sus 2 archivos.');
    assert.equal(ctx.textoDeConfirmacion('logro', { titulo: '[TEST] Premio' }), '¿Eliminar el logro [TEST] Premio?');
    assert.equal(ctx.textoDeConfirmacion('archivo', { nombre: 'presentación final.pdf' }), '¿Eliminar presentación final.pdf?');
  });

  it('es texto, no HTML: un nombre con HTML vuelve tal cual (la página lo pone con textContent); un tipo desconocido da ""', () => {
    assert.equal(ctx.textoDeConfirmacion('archivo', { nombre: '<img src=x onerror=alert(1)>.pdf' }), '¿Eliminar <img src=x onerror=alert(1)>.pdf?');
    assert.equal(ctx.textoDeConfirmacion('otro', { nombre: 'x' }), '');
  });
});

describe('proyectos.js: las áreas, los pendientes, la muestra y la vista previa (spec 6)', () => {
  it('htmlDeAreas: una casilla por área, las del proyecto marcadas; los nombres escapados; sin áreas, lo dice', () => {
    const html = ctx.htmlDeAreas([{ id: 3, nombre: 'Dirección de <b>Datos</b>' }, { id: 5, nombre: 'Hacienda' }, { id: 'x', nombre: 'Rara' }], ['5']);
    assert.equal(html, '<label class="pr-area"><input type="checkbox" name="p-areas" value="3" aria-describedby="p-areas-error">Dirección de &lt;b&gt;Datos&lt;/b&gt;</label>'
      + '<label class="pr-area"><input type="checkbox" name="p-areas" value="5" aria-describedby="p-areas-error" checked>Hacienda</label>');
    assert.match(ctx.htmlDeAreas([], []), /No hay áreas cargadas\./);
  });

  it('htmlDePendientes: cada archivo elegido con su extensión, su nombre, su tamaño y su ×, que lo nombra; los nombres escapados', () => {
    const html = ctx.htmlDePendientes([{ name: 'presentación final.pdf', size: 2.5 * MB }, { name: '<img src=x onerror=alert(1)>.png', size: 2048 }]);
    assert.match(html, /^<ul class="pr-archivos pr-pendientes" aria-label="Archivos para subir">/);
    assert.ok(html.includes('<span class="pr-ext" aria-hidden="true">PDF</span><span><span class="n">presentación final.pdf</span><small>2,5 MB</small></span>'));
    assert.ok(html.includes('<button type="button" class="pr-quitar" data-quitar="0" aria-label="Quitar presentación final.pdf">&times;</button>'));
    assert.ok(html.includes('data-quitar="1" aria-label="Quitar &lt;img src=x onerror=alert(1)&gt;.png"'));
    assert.doesNotMatch(html, /<img/);
    assert.equal(ctx.htmlDePendientes([]), '');
  });

  it('htmlDeMuestra: el cuadrado grande con el color y el ícono elegidos y el nombre (o, sin nombre, «Así se ve en la lista»)', () => {
    const html = ctx.htmlDeMuestra({ nombre: '  <b>[TEST]</b> ', color: '#6CA3C6', icono: 'award' });
    assert.match(html, /^<span class="pr-tile grande" style="--c:#6CA3C6"><svg aria-hidden="true" focusable="false" /);
    assert.ok(html.includes('<b>&lt;b&gt;[TEST]&lt;/b&gt;</b>'));
    assert.ok(html.includes('El color y el ícono identifican al proyecto en la lista y en la línea de tiempo.'));
    assert.ok(ctx.htmlDeMuestra({ nombre: '', color: 'x' }).includes('<b>Así se ve en la lista</b>'));
    assert.match(ctx.htmlDeMuestra({ color: 'x' }), /style="--c:#1A365D"/);
  });

  it('htmlDeVistaPrevia: la imagen en un <img> y el PDF en un <iframe>, solo desde un blob:; el nombre escapado', () => {
    assert.equal(ctx.htmlDeVistaPrevia('blob:http://localhost/abc', { nombre: 'foto "1".png', mime: 'image/png' }), '<img src="blob:http://localhost/abc" alt="foto &quot;1&quot;.png">');
    assert.equal(ctx.htmlDeVistaPrevia('blob:http://localhost/abc', { nombre: 'informe.pdf', mime: 'application/pdf' }), '<iframe src="blob:http://localhost/abc" title="informe.pdf"></iframe>');
    assert.equal(ctx.htmlDeVistaPrevia('javascript:alert(1)', { nombre: 'x.pdf', mime: 'application/pdf' }), '');
    assert.equal(ctx.htmlDeVistaPrevia('https://otro.sitio/x.pdf', { nombre: 'x.pdf', mime: 'application/pdf' }), '');
    assert.equal(ctx.htmlDeVistaPrevia('blob:http://localhost/abc', { nombre: 'x.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), '');
  });
});

describe('proyectos.html: la página (spec 1)', () => {
  const html = leer('proyectos.html');
  const bloque = (patron) => html.match(patron)?.[0] ?? '';

  it('el título, la descripción y el h1 «Proyectos» con la carpeta con tablero decorativa', () => {
    assert.ok(html.includes('<title>Proyectos - RPAD</title>'));
    assert.match(html, /<meta name="description" content="[^"]+">/);
    const h1 = bloque(/<h1 class="page-title">[\s\S]*?<\/h1>/);
    const svg = h1.match(/<svg[^>]*>[\s\S]*?<\/svg>/)?.[0] ?? '';
    assert.match(svg, /^<svg aria-hidden="true" /);
    assert.ok(svg.includes('<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><path d="M8 10v4"/><path d="M12 10v2"/><path d="M16 10v6"/>'));
    assert.equal(h1.replace(/<svg[\s\S]*?<\/svg>/, '').replace(/<[^>]+>/g, '').trim(), 'Proyectos');
  });

  it('«Nuevo proyecto» oculto (solo para administración), la bajada y el aviso de las métricas oculto', () => {
    assert.match(html, /<button type="button" class="sg-btn sg-btn-tinta" id="pr-nuevo" hidden><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>Nuevo proyecto<\/button>/);
    assert.ok(html.includes('<p class="pr-bajada" id="pr-bajada">Los proyectos de la Dirección de Datos Públicos y Comunicación, con sus hitos y documentos, y los logros del área. Los hitos de cada año salen en el Informe anual.</p>'));
    assert.ok(html.includes('<p class="pr-aviso" id="pr-aviso-metricas" hidden>Las métricas de Gestión ahora están en <a href="reportes.html#metricas">Herramientas → Métricas y Reportes</a>.</p>'));
    assert.ok(html.includes('<div id="message-container"></div>'));
  });

  it('las tres pestañas con su cantidad y sus paneles; Proyectos, la inicial', () => {
    const pestanas = [...bloque(/<div class="pr-pestanas" role="tablist"[^>]*>[\s\S]*?<\/div>/)
      .matchAll(/<button type="button" class="pr-pestana[^"]*" role="tab" id="tab-(\w+)" aria-selected="(true|false)" aria-controls="panel-(\w+)" data-hash="(\w+)"(?: tabindex="-1")?>([^<]+) <b id="cnt-(\w+)"><\/b><\/button>/g)]
      .map(([, id, elegida, panel, hash, texto, cantidad]) => [id, elegida, panel, hash, texto, cantidad]);
    assert.deepEqual(pestanas, [['proyectos', 'true', 'proyectos', 'proyectos', 'Proyectos', 'proyectos'],
      ['linea', 'false', 'linea', 'linea', 'Línea de tiempo', 'linea'], ['logros', 'false', 'logros', 'logros', 'Logros del área', 'logros']]);
    assert.match(html, /<section id="panel-proyectos" role="tabpanel" aria-labelledby="tab-proyectos"><\/section>/);
    assert.match(html, /<section id="panel-linea" role="tabpanel" aria-labelledby="tab-linea" hidden><\/section>/);
    assert.match(html, /<section id="panel-logros" role="tabpanel" aria-labelledby="tab-logros" hidden><\/section>/);
    assert.match(html, /<div id="pr-vista-lista" hidden>/);
    assert.match(html, /<div id="pr-vista-detalle" hidden><\/div>/);
  });

  it('los estados de la página: cargando (status), el error (alert, oculto) y sin JavaScript', () => {
    assert.match(html, /<p class="pr-estado" id="pr-cargando" role="status">Cargando los proyectos…<\/p>/);
    assert.match(html, /<div class="pr-estado pr-error" id="pr-error" role="alert" hidden>\s*<p>No se pudieron cargar los proyectos\. Probá de nuevo en unos minutos\.<\/p>\s*<\/div>/);
    assert.match(html, /<noscript><p class="pr-estado">Para ver los proyectos hace falta JavaScript\.<\/p><\/noscript>/);
  });

  it('los scripts, en el orden de siempre y a secas', () => {
    const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
    assert.deepEqual(scripts, ['js/config.js', 'js/auth.js?v=20261204', 'js/main.js?v=20261204', 'js/api.js?v=20261204', 'js/proyectos.js?v=20261206']);
    assert.equal(html.match(/<script\b/g).length, scripts.length);
  });

  it('su <style>: los tokens del Seguimiento, el reparto 40/60 (50/50 y apilado en el teléfono), el amarillo del año y el foco visible', () => {
    const estilo = bloque(/<style>[\s\S]*?<\/style>/);
    for (const token of ['--sg-tinta: #1A365D', '--sg-texto: #22324A', '--sg-suave: #56677F', '--sg-linea: #DAE3ED', '--sg-borde-control: #76879F']) assert.ok(estilo.includes(token), token);
    assert.ok(estilo.includes('.pr-eje, .pr-carril { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);'));
    assert.match(estilo, /@media \(max-width: 960px\) \{[\s\S]*?\.pr-eje, \.pr-carril \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\); \}/);
    assert.match(estilo, /@media \(max-width: 760px\) \{[\s\S]*?\.pr-eje \{ display: none; \}[\s\S]*?\.pr-carril \{ grid-template-columns: 1fr;/);
    assert.match(estilo, /\.pr-pista \.resalta \{[^}]*background: #FFF6D6;/);
    assert.ok(estilo.includes('outline: 3px solid var(--tinta); outline-offset: 2px; box-shadow: 0 0 0 5px var(--sol-fuerte);'));
    assert.match(estilo, /\.pr-flechas-texto \{[^}]*font-variant-numeric: tabular-nums;/);
    // Toda var(--sg-…) que usa está definida
    const definidas = new Set([...estilo.matchAll(/(--sg-[\w-]+):/g)].map((m) => m[1]));
    for (const [, usada] of estilo.matchAll(/var\((--sg-[\w-]+)\)/g)) assert.ok(definidas.has(usada), usada);
  });

  it('un logro previsto se ve hueco, como los otros hitos previstos, y la cantidad de un grupo de logros previstos se lee', () => {
    const estilo = bloque(/<style>[\s\S]*?<\/style>/);
    const logro = estilo.indexOf('.pr-pista .punto.logro {');
    const futuro = estilo.indexOf('.pr-pista .punto.logro.futuro {');
    assert.ok(logro !== -1 && futuro > logro, 'la regla del logro previsto va después de la del logro');
    assert.match(estilo, /\.pr-pista \.punto\.logro\.futuro \{[^}]*background: #fff;[^}]*border: 2\.5px solid var\(--sg-tinta\);[^}]*box-shadow: none;/);
    const numero = estilo.indexOf('.pr-pista .punto.logro.futuro b {');
    assert.ok(numero > estilo.indexOf('.pr-pista .punto.futuro b {'));
    assert.match(estilo, /\.pr-pista \.punto\.logro\.futuro b \{[^}]*color: var\(--sg-tinta\);/);
  });

  it('el detalle: la descripción respeta sus renglones y los títulos de los años de la línea de tiempo son h2', () => {
    const estilo = bloque(/<style>[\s\S]*?<\/style>/);
    assert.match(estilo, /\.pr-ficha \.desc \{[^}]*white-space: pre-line;/);
    assert.match(estilo, /\.pr-cuerpo \.desc \{[^}]*white-space: pre-line;/);
    assert.match(estilo, /\.pr-anio h2 \{[^}]*font-size: 1\.3rem;/);
    for (const clase of ['.pr-explica', '.pr-nota', '.pr-host']) assert.ok(estilo.includes(`${clase} {`), clase);
  });

  it('ningún id se repite', () => {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
  });
});

describe('proyectos.html: los modales (spec 6)', () => {
  const html = leer('proyectos.html');
  const estilo = html.match(/<style>[\s\S]*?<\/style>/)?.[0] ?? '';
  // El HTML de un modal: desde su velo hasta el comentario del siguiente o los scripts
  const modal = (id) => html.match(new RegExp(`<div class="modal-overlay" id="${id}">[\\s\\S]*?(?=\\n    <!--|\\n    <script)`))?.[0] ?? '';
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const MODALES = ['modal-proyecto', 'modal-hito', 'modal-confirmar', 'modal-vista-previa'];

  it('los cuatro modales, después del contenido: role="dialog", aria-modal y aria-labelledby a su título, con la × «Cerrar»', () => {
    for (const id of MODALES) {
      const bloque = modal(id);
      assert.ok(bloque, id);
      assert.match(bloque, new RegExp(`^<div class="modal-overlay" id="${id}">\\s*<div class="modal pr-modal[^"]*" role="dialog" aria-modal="true" aria-labelledby="${id}-titulo"`), id);
      assert.match(bloque, new RegExp(`<h2 class="modal-title" id="${id}-titulo">[^<]+</h2>`), id);
      assert.match(bloque, /<button type="button" class="modal-close" data-cerrar aria-label="Cerrar">&times;<\/button>/, id);
      // Un lugar para el error sin campo, dentro del modal (nunca detrás del velo)
      assert.match(bloque, new RegExp(`<p class="pr-modal-aviso" id="${id}-aviso" role="alert" hidden></p>`), id);
      assert.ok(html.indexOf(bloque) > html.indexOf('</main>'), `${id} va después del contenido`);
    }
    assert.match(modal('modal-confirmar'), /class="modal pr-modal pr-modal-chico"[^>]*aria-describedby="modal-confirmar-texto"/);
  });

  it('cada <label for> apunta a un id que existe (y cada aria-describedby, aria-labelledby y aria-controls)', () => {
    const fors = [...html.matchAll(/<label\b[^>]*\sfor="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(fors.length >= 9);
    for (const destino of fors) assert.ok(ids.has(destino), destino);
    // Y cada aria-describedby, aria-labelledby y aria-controls, también
    for (const [, lista] of html.matchAll(/\saria-(?:describedby|labelledby|controls)="([^"]+)"/g)) {
      for (const destino of lista.split(/\s+/)) assert.ok(ids.has(destino), destino);
    }
  });

  it('el formulario envuelve el cuerpo y el pie y es una columna flexible (los botones quedan siempre a la vista)', () => {
    assert.match(estilo, /\.pr-form \{[^}]*display: flex;[^}]*\}/);
    assert.match(estilo, /\.pr-form \{[^}]*flex-direction: column;[^}]*\}/);
    assert.match(estilo, /\.pr-form \{[^}]*min-height: 0;[^}]*\}/);
    for (const [id, formulario] of [['modal-proyecto', 'form-proyecto'], ['modal-hito', 'form-hito']]) {
      const bloque = modal(id);
      const form = bloque.match(new RegExp(`<form class="pr-form" id="${formulario}" novalidate>[\\s\\S]*?</form>`))?.[0] ?? '';
      assert.ok(form, formulario);
      assert.match(form, /<div class="modal-body">[\s\S]*<div class="modal-footer">[\s\S]*<button type="submit" class="sg-btn sg-btn-tinta" id="[ph]-guardar">/, formulario);
      assert.match(form, /<button type="button" class="sg-btn sg-btn-borde" data-cerrar>Cancelar<\/button>/, formulario);
    }
  });

  it('cada campo tiene su control, su error (aria-describedby) y, si es obligatorio, aria-required', () => {
    const campos = constante('CAMPOS_DEL_FORMULARIO');
    for (const grupo of ['proyecto', 'hito']) {
      for (const [campo, id] of Object.entries(campos[grupo])) {
        assert.ok(ids.has(id), `${grupo}.${campo}: ${id}`);
        assert.match(html, new RegExp(`<p class="form-error" id="${id}-error" hidden></p>`), `${id}-error`);
        // El control (o el grupo) apunta a su error
        assert.match(html, new RegExp(`id="${id}"[^>]*aria-describedby="[^"]*\\b${id}-error\\b`), `${id} → ${id}-error`);
      }
    }
    for (const id of ['p-nombre', 'h-titulo', 'h-fecha']) assert.match(html, new RegExp(`id="${id}"[^>]*aria-required="true"`), id);
    // Ningún otro campo dice que es obligatorio
    assert.equal(cuantas(html, /aria-required="true"/g), 3);
    // Los textos largos no tienen maxlength (cuenta unidades de UTF-16: un emoji cuenta dos); el largo lo controla erroresDelProyecto
    for (const id of ['p-nombre', 'p-responsable', 'p-enlace-externo', 'h-titulo', 'h-evidencia-url']) {
      assert.doesNotMatch(html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0] ?? 'x maxlength', /maxlength/, id);
    }
  });

  it('el proyecto: los campos de la spec, el estado con sus insignias, las listas del servidor y la ayuda del enlace', () => {
    const bloque = modal('modal-proyecto');
    const rotulos = [...bloque.matchAll(/<label class="form-label" for="[^"]+">([^<]+)/g)].map((m) => m[1].trim());
    assert.deepEqual(rotulos, ['Nombre', 'Descripción', 'Categoría', 'Prioridad', 'Fecha de elevación', 'Autor o responsable', 'Enlace']);
    const leyendas = [...bloque.matchAll(/<legend class="form-label">([^<]+)<\/legend>/g)].map((m) => m[1]);
    assert.deepEqual(leyendas, ['Estado', 'Áreas', 'Color', 'Ícono']);
    const estados = [...bloque.matchAll(/<label class="pr-opcion"><input type="radio" name="p-estado" value="(\w+)" aria-describedby="p-estado-error"( checked)?><span class="pr-insignia (pr-[\w-]+)">([^<]+)<\/span><\/label>/g)]
      .map(([, valor, elegido, clase, texto]) => [valor, Boolean(elegido), clase, texto]);
    assert.deepEqual(estados, [['idea', true, 'pr-idea', 'Idea'], ['en_curso', false, 'pr-en-curso', 'En curso'],
      ['completado', false, 'pr-completado', 'Completado'], ['suspendido', false, 'pr-suspendido', 'Suspendido']]);
    const opcionesDe = (id) => [...(bloque.match(new RegExp(`<select class="form-select" id="${id}"[^>]*>[\\s\\S]*?</select>`))?.[0] ?? '')
      .matchAll(/<option value="(\w+)"( selected)?>([^<]+)<\/option>/g)].map(([, valor, elegido, texto]) => [valor, Boolean(elegido), texto]);
    assert.deepEqual(opcionesDe('p-categoria'), [['tecnologia', false, 'Tecnología'], ['normativa', false, 'Normativa'], ['difusion', false, 'Difusión']]);
    assert.deepEqual(opcionesDe('p-categoria').map(([valor]) => valor), [...CATEGORIAS]);
    assert.deepEqual(opcionesDe('p-prioridad'), [['alta', false, 'Alta'], ['media', true, 'Media'], ['baja', false, 'Baja']]);
    assert.deepEqual(opcionesDe('p-prioridad').map(([valor]) => valor), [...PRIORIDADES]);
    assert.match(bloque, /<input type="url" class="form-input" id="p-enlace-externo" placeholder="https:\/\/" autocomplete="off" aria-describedby="p-enlace-externo-ayuda p-enlace-externo-error">/);
    assert.ok(bloque.includes('<p class="form-hint" id="p-enlace-externo-ayuda">El repositorio, el borrador o la página del proyecto.</p>'));
    assert.match(bloque, /<input type="date" class="form-input" id="p-fecha-inicio" min="2000-01-01"/);
    // Las áreas, los colores, los íconos y la muestra los arma proyectos.js
    for (const id of ['p-areas-lista', 'p-colores', 'p-iconos', 'p-muestra']) assert.match(bloque, new RegExp(`id="${id}"`), id);
    assert.match(bloque, /<div class="pr-muestra" id="p-muestra" aria-hidden="true"><\/div>/);
    assert.match(bloque, /<button type="submit" class="sg-btn sg-btn-tinta" id="p-guardar">Guardar el proyecto<\/button>/);
  });

  it('el hito: de quién es, título, fecha, descripción, evidencia y los archivos con la zona para soltar (un botón y un input oculto)', () => {
    const bloque = modal('modal-hito');
    assert.match(bloque, /aria-labelledby="modal-hito-titulo" aria-describedby="h-de"/);
    assert.match(bloque, /<p class="pr-modal-de" id="h-de"><\/p>/);
    const rotulos = [...bloque.matchAll(/<label class="form-label" for="[^"]+">([^<]+)/g)].map((m) => m[1].trim());
    assert.deepEqual(rotulos, ['Título', 'Fecha', 'Descripción', 'Enlace de la evidencia']);
    assert.match(bloque, /<input type="date" class="form-input" id="h-fecha" min="2000-01-01" aria-required="true" aria-describedby="h-fecha-error">/);
    assert.match(bloque, /<input type="url" class="form-input" id="h-evidencia-url" placeholder="https:\/\/" autocomplete="off" aria-describedby="h-evidencia-url-ayuda h-evidencia-url-error">/);
    assert.match(bloque, /<button type="button" class="sg-link" id="h-elegir" aria-describedby="h-archivos-ayuda h-archivos-error">elegilos<\/button>/);
    assert.ok(bloque.includes('<small id="h-archivos-ayuda">Hasta 3 archivos de 10 MB cada uno: PDF, Word, Excel, CSV, ODT, ODS, imágenes, ZIP, RAR o 7Z.</small>'));
    assert.match(bloque, /<input type="file" id="h-archivos" multiple hidden accept="([^"]+)">/);
    // El error de un archivo y la lista de los elegidos, en una región viva (se anuncian al cambiar)
    assert.match(bloque, /<div aria-live="polite">\s*<p class="form-error" id="h-archivos-error" hidden><\/p>\s*<div id="h-pendientes"><\/div>\s*<\/div>/);
    assert.match(bloque, /<div class="pr-soltar" id="h-soltar" role="group" aria-labelledby="h-archivos-rotulo">/);
    assert.match(bloque, /<button type="submit" class="sg-btn sg-btn-tinta" id="h-guardar">Guardar el hito<\/button>/);
  });

  it('los selectores de archivos ofrecen solo las extensiones de config/upload.js', () => {
    const accepts = [...html.matchAll(/<input type="file" id="([^"]+)" multiple hidden accept="([^"]+)">/g)].map(([, id, lista]) => [id, lista]);
    assert.deepEqual(accepts.map(([id]) => id), ['pr-elegir-archivos', 'h-archivos']);
    for (const [, lista] of accepts) assert.deepEqual(lista.split(','), [...subidas.EXTENSIONES_PERMITIDAS]);
  });

  it('la confirmación: el texto (lo arma textoDeConfirmacion) y «Eliminar» en rojo; la vista previa: su cuerpo y «Cerrar»', () => {
    const confirmar = modal('modal-confirmar');
    assert.match(confirmar, /<p class="pr-confirmar-texto" id="modal-confirmar-texto"><\/p>/);
    assert.match(confirmar, /<button type="button" class="sg-btn sg-btn-borde" data-cerrar>Cancelar<\/button>\s*<button type="button" class="sg-btn sg-btn-rojo" id="modal-confirmar-si">Eliminar<\/button>/);
    assert.match(estilo, /\.sg-btn-rojo \{[^}]*background: var\(--sg-rojo\);/);
    const vista = modal('modal-vista-previa');
    assert.match(vista, /class="modal pr-modal pr-modal-vista"/);
    assert.match(vista, /<div class="pr-vista-previa" id="modal-vista-previa-cuerpo"><\/div>/);
    assert.match(vista, /<button type="button" class="sg-btn sg-btn-borde" data-cerrar>Cerrar<\/button>/);
  });

  it('el estilo de los errores (aria-invalid y el aviso dentro del modal) y de los pendientes', () => {
    assert.match(estilo, /\.pr-modal \.form-input\[aria-invalid="true"\][^{]*\{[^}]*border-color: var\(--sg-rojo\);/);
    assert.match(estilo, /\.pr-modal \.form-error \{[^}]*color: var\(--sg-rojo\);/);
    assert.match(estilo, /\.pr-modal-aviso \{/);
    assert.match(estilo, /\.pr-quitar \{/);
    assert.match(estilo, /\.pr-vista-previa iframe \{/);
  });
});
