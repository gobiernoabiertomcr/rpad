// La página de Proyectos (spec 2026-10-25-proyectos, 1, 2 y 10), ejecutada en Node: lo puro de public/js/proyectos.js (la
// dirección, la ventana de 3 años con sus flechas, los filtros con sus cantidades, el orden, los puntos de cada carril que se
// juntan según el ancho de la pista, la frase del año resaltado y el HTML de los filtros y los carriles) con datos inventados y
// con los 8 proyectos y los 17 hitos de la maqueta (anonimizados: docs/superpowers/specs/2026-10-25-proyectos-mockups/js/
// maqueta-datos.js, que se lee al correr, sin copiar sus nombres acá), pasados a la forma de la API (GET /gestion/proyectos y
// /gestion/timeline). Como seguimiento.js y reportes.js, el script al cargarse solo declara: se carga en un vm después del
// main.js de verdad (getIconSvg e ICON_SELECTOR_MAP) y del api.js de verdad (Utils), como en la página.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import { ESTADOS_PROYECTO, PRIORIDADES, CATEGORIAS } from '../services/proyectosReglas.js';

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
  it('2025 en la maqueta: 6 hitos de 4 proyectos y 1 logro, el texto de la spec', () => {
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

  it('ningún id se repite', () => {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
  });
});
