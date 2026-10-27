// Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, secciones 8 y 11), ejecutado en Node: lo puro de public/js/mi-espacio.js
// (las pestañas, la lista de licencias con su selector del año y sus filtros, las tablas de horas extras, el día por día y las horas
// no utilizadas previamente) con los datos que arma el servidor (services/miEspacioResumen.js) sobre los casos de
// tests/fixtures/mi-espacio-casos.js, pasados por JSON como los manda la API; y, con un DOM falso y un fetch falso, la carga de las
// pestañas. Como proyectos.js, el script al cargarse solo declara: se carga en un vm después del api.js de verdad (Utils.escapeHtml).
// Las personas son las inventadas de la maqueta.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import { filasDeLicencias, tablaDeHorasExtras } from '../services/miEspacioResumen.js';
import { calcular, vinculosDeLaLista, MENSAJES_MI_ESPACIO } from '../services/miEspacioReglas.js';
import { HOY, SIN_FERIADOS, PLANTA, CONTRATO } from './fixtures/mi-espacio-casos.js';

const leer = (ruta) => fs.readFileSync(new URL(`../public/${ruta}`, import.meta.url), 'utf8');

// Un contexto con api.js y mi-espacio.js. `document` anota cada vez que alguien lo consulta
const cargar = (globales = {}) => {
  const consultas = [];
  const oyentes = [];
  const contexto = vm.createContext({
    CONFIG: { API_URL: '/api' },
    console,
    document: {
      addEventListener: (tipo, funcion) => oyentes.push([tipo, funcion]),
      getElementById: (id) => { consultas.push(['getElementById', id]); return null; },
      querySelector: (selector) => { consultas.push(['querySelector', selector]); return null; },
      querySelectorAll: (selector) => { consultas.push(['querySelectorAll', selector]); return []; }
    },
    Auth: { isAuthenticated: () => true },
    window: { location: { search: '', hash: '', href: '/mi-espacio.html' } },
    ...globales
  });
  vm.runInContext(leer('js/api.js'), contexto);
  vm.runInContext(leer('js/mi-espacio.js'), contexto);
  return { contexto, consultas, oyentes };
};

const { contexto: ctx } = cargar();
const en = (expresion) => vm.runInContext(expresion, ctx);
// Las funciones y constantes del script (las declaradas con const no son propiedades del global del vm)
const M = new Proxy({}, { get: (_, nombre) => en(nombre) });
// Lo que devuelve una función del vm es de otro contexto: deepStrictEqual compara prototipos, así que se pasa a uno de acá
const plano = (valor) => JSON.parse(JSON.stringify(valor));

// Los datos como los manda la API: lo que arma el servidor, pasado por JSON
const comoLlega = (datos) => JSON.parse(JSON.stringify(datos));
const calculoDe = (estado) => calcular(estado, { hoy: HOY, feriados: SIN_FERIADOS });
const licenciasDe = (caso, { estado = caso.estado, anio = 2026, vinculos } = {}) =>
  comoLlega(filasDeLicencias(estado, calculoDe(estado), { anio, hoy: HOY, persona: caso.persona, vinculos, feriados: SIN_FERIADOS }));
const horasDe = (caso, { estado = caso.estado, anio = 2026 } = {}) =>
  comoLlega(tablaDeHorasExtras(estado, calculoDe(estado), { anio, hoy: HOY, feriados: SIN_FERIADOS }));
const SIN_MODALIDAD = Object.freeze({ modalidad: null, mensaje: MENSAJES_MI_ESPACIO.sinModalidad });

// El texto que se ve de un pedazo de HTML (sin las etiquetas, con las entidades de escapeHtml resueltas)
const textoDe = (html) => html.replace(/<[^>]*>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const atributosDe = (texto) => Object.fromEntries([...texto.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, clave, valor]) => [clave, valor]));
// Los botones de un HTML: { atributos, texto }
const botonesDe = (html) => [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)]
  .map(([, atributos, adentro]) => ({ atributos: atributosDe(atributos), texto: textoDe(adentro) }));
// Las filas de una lista: { clases, html, texto }
const filasDe = (html) => [...html.matchAll(/<li class="([^"]*)"[^>]*>([\s\S]*?)<\/li>/g)]
  .map(([, clases, adentro]) => ({ clases: clases.split(' '), html: adentro, texto: textoDe(adentro) }));
// Las filas de una licencia (las que tienen «Editar»), sin la del saldo inicial
const filasDeLicenciaDe = (html) => filasDe(html).filter((fila) => fila.html.includes('data-editar-licencia='));
// Las filas del cuerpo de una tabla: { clases, celdas: [texto] , html }
const filasDeTablaDe = (html) => [...(html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '').matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)]
  .map(([, atributos, adentro]) => ({
    clases: (atributosDe(atributos).class ?? '').split(' ').filter(Boolean),
    celdas: [...adentro.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(([, celda]) => textoDe(celda)),
    html: adentro
  }));

const MALICIOSO = '<img src=x onerror=alert(1)>';
const ESCAPADO = '&lt;img src=x onerror=alert(1)&gt;';

describe('mi-espacio.js: al cargarse', () => {
  it('no toca el DOM: solo declara y espera el DOMContentLoaded', () => {
    const { consultas, oyentes } = cargar();
    assert.deepEqual(consultas, []);
    assert.deepEqual(oyentes.map(([tipo]) => tipo), ['DOMContentLoaded']);
  });

  it('sin sesión, el DOMContentLoaded manda al login sin consultar el DOM ni pedir nada', () => {
    const pedidos = [];
    const ventana = { location: { search: '', hash: '', href: '/mi-espacio.html' } };
    const { consultas, oyentes } = cargar({
      Auth: { isAuthenticated: () => false }, window: ventana, fetch: async (url) => { pedidos.push(url); }
    });
    oyentes[0][1]();
    assert.equal(ventana.location.href, 'login.html');
    assert.deepEqual(consultas, []);
    assert.deepEqual(pedidos, []);
  });

  // La página carga config.js, auth.js, main.js, api.js y mi-espacio.js: un let o un const repetido rompería el script entero, y una
  // function repetida pisaría la otra
  it('ningún nombre de nivel superior se repite con los de config.js, auth.js, main.js y api.js', () => {
    const nombresDe = (archivo) => [...leer(`js/${archivo}`).matchAll(/^(?:const|let|var|function|async function|class) (\w+)/gm)]
      .map(([, nombre]) => nombre);
    const compartidos = new Set(['config.js', 'auth.js', 'main.js', 'api.js'].flatMap(nombresDe));
    const propios = nombresDe('mi-espacio.js');
    assert.ok(propios.length > 10);
    assert.deepEqual(propios.filter((nombre) => compartidos.has(nombre)), []);
  });
});

describe('las pestañas', () => {
  it('Resumen, Licencias y Horas extras, en ese orden', () => {
    assert.deepEqual(plano(M.PESTANAS), ['resumen', 'licencias', 'horas']);
  });

  it('pestanaDeHash: la del fragmento; uno desconocido, o ninguno, abre el Resumen', () => {
    assert.equal(M.pestanaDeHash('#horas'), 'horas');
    assert.equal(M.pestanaDeHash('#licencias'), 'licencias');
    assert.equal(M.pestanaDeHash('#resumen'), 'resumen');
    for (const otro of ['#otra', '#agenda', '', '#', undefined, null, 'horas#']) assert.equal(M.pestanaDeHash(otro), 'resumen', String(otro));
  });
});

describe('sin modalidad y sin arranque', () => {
  it('sin modalidad, las pestañas muestran solo el mensaje del servidor y ningún botón de carga', () => {
    const licencias = M.htmlDeListaDeLicencias(SIN_MODALIDAD, 'todas');
    const horas = M.htmlDeHorasExtras(SIN_MODALIDAD);
    for (const html of [licencias, horas]) {
      assert.equal(html, M.htmlDeMensaje(MENSAJES_MI_ESPACIO.sinModalidad));
      assert.equal(textoDe(html), MENSAJES_MI_ESPACIO.sinModalidad);
      assert.doesNotMatch(html, /<button|data-cargar|data-abrir/);
    }
  });

  it('htmlDeMensaje escapa el texto', () => {
    assert.ok(M.htmlDeMensaje(MALICIOSO).includes(ESCAPADO));
    assert.ok(!M.htmlDeMensaje(MALICIOSO).includes(MALICIOSO));
  });

  it('htmlSinArranque: «Para empezar…» y el botón que abre «Mis vacaciones y saldos»', () => {
    const html = M.htmlSinArranque();
    assert.ok(textoDe(html).startsWith(MENSAJES_MI_ESPACIO.sinArranque));
    assert.deepEqual(botonesDe(html).map(({ atributos, texto }) => [atributos['data-abrir'], texto]), [['saldos', 'Mis vacaciones y saldos']]);
  });

  it('la copia de sinArranque es la del servidor', () => {
    assert.equal(M.TEXTO_SIN_ARRANQUE, MENSAJES_MI_ESPACIO.sinArranque);
  });
});

describe('la lista de licencias', () => {
  const datos = licenciasDe(PLANTA);
  const html = M.htmlDeListaDeLicencias(datos, 'todas');

  it('el selector del año: un botón por año, con aria-pressed solo en el elegido', () => {
    const selector = M.htmlDelSelectorDeAnio([2024, 2025, 2026, 2027], 2026);
    assert.match(selector, /^<span class="me-segmento" role="group" aria-label="Año">/);
    assert.deepEqual(botonesDe(selector).map(({ atributos, texto }) => [atributos['data-anio'], atributos['aria-pressed'], texto]),
      [['2024', 'false', '2024'], ['2025', 'false', '2025'], ['2026', 'true', '2026'], ['2027', 'false', '2027']]);
    assert.equal(M.htmlDelSelectorDeAnio([], 2026), '');
  });

  it('los filtros: Todas y cada tipo con su cantidad, con aria-pressed en el elegido; uno que no está elige Todas', () => {
    const filtros = (elegido) => botonesDe(M.htmlDeFiltrosDeLicencias(datos.filtros, elegido))
      .map(({ atributos, texto }) => [atributos['data-filtro-licencia'], atributos['aria-pressed'], texto]);
    assert.deepEqual(filtros('todas'), [['todas', 'true', 'Todas 6'], ['vacaciones', 'false', 'Vacaciones 1'],
      ['franquicia', 'false', 'Franquicias 2'], ['estudios', 'false', 'Estudios 1'], ['medica', 'false', 'Atención médica 1'],
      ['franco', 'false', 'Francos 1']]);
    assert.deepEqual(filtros('franquicia').filter(([, elegido]) => elegido === 'true').map(([tipo]) => tipo), ['franquicia']);
    assert.deepEqual(filtros('horas_a_favor').filter(([, elegido]) => elegido === 'true').map(([tipo]) => tipo), ['todas']);
    assert.match(M.htmlDeFiltrosDeLicencias(datos.filtros, 'todas'), /^<div class="sg-chips" role="group" aria-label="Filtrar las licencias por tipo">/);
  });

  it('la tarjeta: «Mis licencias de 2026», el selector del año, «Cargar licencia» y los filtros', () => {
    assert.match(html, /<h2>Mis licencias de 2026<\/h2>/);
    assert.ok(html.includes(M.htmlDelSelectorDeAnio(datos.anios, 2026)));
    assert.ok(html.includes(M.htmlDeFiltrosDeLicencias(datos.filtros, 'todas')));
    assert.deepEqual(botonesDe(html).filter(({ atributos }) => atributos['data-cargar']).map(({ atributos, texto }) => [atributos['data-cargar'], texto]),
      [['licencia', 'Cargar licencia']]);
  });

  it('PLANTA: seis filas, de la más nueva a la más vieja, con sus fechas y lo que suman', () => {
    const filas = filasDeLicenciaDe(html);
    assert.equal(filas.length, 6);
    assert.deepEqual(filas.map(({ html: fila }) => textoDe(fila.match(/<span class="me-fila-fecha">([\s\S]*?)<\/span>/)[1])), [
      '03/11 al 09/11/2026 7 días corridos, 5 hábiles', 'Vie 23/10/2026 1 día', 'Jue 15/10/2026 2 horas', '01/10 al 02/10/2026 2 días hábiles',
      '21/09 al 23/09/2026 3 días hábiles', 'Lun 14/09/2026 7 horas, el día entero'
    ]);
    assert.deepEqual(filas.map(({ html: fila }) => textoDe(fila.match(/<span class="me-insignia [^"]+">([^<]*)<\/span>/)[1])),
      ['Vacaciones', 'Franco compensatorio', 'Franquicia', 'Estudios', 'Atención médica', 'Franquicia']);
  });

  it('cada fila con «Editar»: su id y el aria-label con sus fechas', () => {
    const editar = botonesDe(html).filter(({ atributos }) => atributos['data-editar-licencia']);
    assert.deepEqual(editar.map(({ atributos }) => atributos['data-editar-licencia']), ['6', '5', '4', '3', '2', '1']);
    assert.ok(editar.every(({ texto }) => texto === 'Editar'));
    assert.equal(editar[0].atributos['aria-label'], 'Editar la licencia del 03/11 al 09/11/2026');
    assert.equal(editar[1].atributos['aria-label'], 'Editar la licencia del Vie 23/10/2026');
  });

  it('«Próxima» solo en la de noviembre, que dice de qué licencia salen y que los compañeros ven que no está', () => {
    const filas = filasDeLicenciaDe(html);
    assert.deepEqual(filas.map(({ texto }) => texto.includes('Próxima')), [true, false, false, false, false, false]);
    assert.ok(filas[0].texto.includes('De la licencia 2024.'));
    assert.ok(filas[0].texto.includes('Tus compañeros ven «Laura Gómez no está».'));
  });

  it('lo anterior al saldo inicial va en gris, con «Antes del saldo inicial: no descuenta»', () => {
    const filas = filasDeLicenciaDe(html);
    assert.deepEqual(filas.map(({ clases }) => clases.includes('tenue')), [false, false, true, true, true, true]);
    assert.deepEqual(filas.map(({ texto }) => texto.includes('Antes del saldo inicial: no descuenta')), [false, false, true, true, true, true]);
  });

  it('al final, el saldo inicial con «Cambiar», y la nota de los días hábiles', () => {
    const filas = filasDe(html);
    const saldo = filas.at(-1);
    assert.ok(!saldo.html.includes('data-editar-licencia'));
    assert.ok(saldo.clases.includes('tenue'));
    assert.ok(saldo.texto.startsWith(`Saldo inicial 2026 Cargado el 26/10/2026 ${datos.saldo_inicial.texto}`));
    assert.deepEqual(botonesDe(saldo.html).map(({ atributos, texto }) => [atributos['data-abrir'], atributos['aria-label'], texto]),
      [['saldos', 'Cambiar el saldo inicial', 'Cambiar']]);
    assert.ok(html.endsWith('<p class="me-nota">Los días se cuentan hábiles: sin sábados, domingos ni feriados.</p></div>'));
  });

  it('un filtro deja solo sus filas, sin el saldo inicial', () => {
    const conFiltro = M.htmlDeListaDeLicencias(datos, 'franquicia');
    assert.deepEqual(filasDeLicenciaDe(conFiltro).map(({ html: fila }) => fila.match(/data-editar-licencia="(\d+)"/)[1]), ['4', '1']);
    assert.equal(filasDe(conFiltro).length, 2);
    assert.ok(conFiltro.includes('Los días se cuentan hábiles'));
    // Un filtro que no está en el año (el elegido en otro año): todas
    assert.equal(filasDeLicenciaDe(M.htmlDeListaDeLicencias(datos, 'horas_a_favor')).length, 6);
  });

  it('un año sin licencias: el vacío, sin filtros ni saldo inicial', () => {
    const vacio = M.htmlDeListaDeLicencias(licenciasDe(PLANTA, { anio: 2025 }), 'todas');
    assert.match(vacio, /<h2>Mis licencias de 2025<\/h2>/);
    assert.ok(vacio.includes('<p class="me-vacio">No hay licencias cargadas en 2025.</p>'));
    assert.equal(filasDe(vacio).length, 0);
    assert.doesNotMatch(vacio, /data-filtro-licencia/);
    assert.ok(vacio.includes('Los días se cuentan hábiles'));
  });

  it('CONTRATO: la familiar próxima, las horas a favor y los estudios anteriores al saldo inicial', () => {
    const filas = filasDeLicenciaDe(M.htmlDeListaDeLicencias(licenciasDe(CONTRATO), 'todas'));
    assert.equal(filas.length, 4);
    assert.ok(filas[0].texto.includes('Atención del grupo familiar') && filas[0].texto.includes('Próxima'));
    assert.deepEqual(filas.map(({ clases }) => clases.includes('tenue')), [false, false, true, false]);
    // Una lectora no tiene la casilla «Mostrar a mis compañeros»: el servidor no manda el texto
    assert.ok(filas.every(({ texto }) => !texto.includes('Tus compañeros ven')));
  });

  // Review Focus 1: una persona de contrato que pasa a planta
  it('lo que no corresponde a la modalidad actual va en gris, con su motivo', () => {
    const filas = filasDeLicenciaDe(M.htmlDeListaDeLicencias(licenciasDe(CONTRATO, { estado: { ...CONTRATO.estado, modalidad: 'planta' } }), 'todas'));
    const deHoras = filas.filter(({ texto }) => texto.includes('Horas a favor'));
    assert.equal(deHoras.length, 2);
    for (const fila of deHoras) {
      assert.ok(fila.clases.includes('tenue'));
      assert.ok(fila.texto.includes('No corresponde a tu modalidad actual: no cuenta.'));
    }
  });

  it('lo de Configuración: el texto del vínculo, y en ámbar si hay algo para revisar', () => {
    const estado = { ...PLANTA.estado, licencias: PLANTA.estado.licencias.map((fila) => (fila.id === 6
      ? { ...fila, sin_pasar: 'Se superpone con una licencia de Configuración del 03/11 al 05/11: revisala con administración' } : fila)) };
    const vinculos = vinculosDeLaLista(estado.licencias, { oficiales: new Map(), tocadas: new Set(), hoy: HOY, puedeTener: true });
    const datosConVinculo = licenciasDe(PLANTA, { estado, vinculos });
    assert.equal(datosConVinculo.licencias[0].configuracion.insignia, 'aviso');
    const [fila] = filasDeLicenciaDe(M.htmlDeListaDeLicencias(datosConVinculo, 'todas'));
    assert.ok(fila.html.includes(`<span class="me-detalle me-detalle-aviso">${datosConVinculo.licencias[0].configuracion.texto}</span>`));
    // Una que pasó como corresponde, sin el ámbar
    const creada = { ...datos, licencias: [{ ...datos.licencias[0], configuracion: { texto: 'También en Configuración → Licencias.', insignia: 'creada' } }] };
    assert.ok(M.htmlDeListaDeLicencias(creada, 'todas').includes('<span class="me-detalle">También en Configuración → Licencias.</span>'));
  });

  // Review Focus 5: HTML en una nota o en el motivo de Configuración se ve como texto, en la fila y en el aria-label
  it('una nota y un motivo de Configuración con HTML se ven escapados, en la fila y en el aria-label', () => {
    const estado = { ...PLANTA.estado, licencias: PLANTA.estado.licencias.map((fila) => (fila.id === 6
      ? { ...fila, nota: MALICIOSO, sin_pasar: MALICIOSO } : fila)) };
    const vinculos = vinculosDeLaLista(estado.licencias, { oficiales: new Map(), tocadas: new Set(), hoy: HOY, puedeTener: true });
    const conHtml = licenciasDe(PLANTA, { estado, vinculos });
    assert.equal(conHtml.licencias[0].nota, MALICIOSO);
    assert.ok(conHtml.licencias[0].configuracion.texto.includes(MALICIOSO));
    // Y unas fechas con HTML (todo lo que llega del servidor se escapa, también lo que va en el aria-label)
    conHtml.licencias[0].fechas_texto = MALICIOSO;
    const lista = M.htmlDeListaDeLicencias(conHtml, 'todas');
    assert.ok(!lista.includes('<img'), 'ningún <img> de verdad');
    const [fila] = filasDeLicenciaDe(lista);
    assert.ok(fila.html.includes(`<span class="me-detalle me-fila-nota">${ESCAPADO}</span>`), 'la nota');
    assert.ok(fila.html.includes(`No pasó a Configuración: ${ESCAPADO}`), 'el motivo');
    assert.ok(fila.html.includes(`aria-label="Editar la licencia del ${ESCAPADO}"`), 'el aria-label');
    assert.equal(botonesDe(fila.html)[0].atributos['aria-label'], `Editar la licencia del ${ESCAPADO}`);
  });

  it('un saldo inicial y unos filtros con HTML se ven escapados', () => {
    const conHtml = { ...datos, filtros: [{ tipo: 'todas', nombre: MALICIOSO, cantidad: 6 }],
      saldo_inicial: { ...datos.saldo_inicial, titulo: MALICIOSO, texto: MALICIOSO } };
    const lista = M.htmlDeListaDeLicencias(conHtml, 'todas');
    assert.ok(!lista.includes('<img'));
    assert.equal(lista.split(ESCAPADO).length - 1, 3);
  });
});

describe('las horas extras', () => {
  const planta = horasDe(PLANTA);
  const contrato = horasDe(CONTRATO);

  it('planta: la tabla de francos, mes por mes, con los textos del servidor', () => {
    const tabla = M.htmlDeTablaDeFrancos(planta);
    assert.match(tabla, /<h2>Horas extras al 100% de 2026<\/h2>/);
    assert.deepEqual([...tabla.matchAll(/<th>([^<]*)<\/th>/g)].map(([, th]) => th), ['Mes trabajado', 'Horas', 'Francos', 'Para usar en', 'Situación']);
    assert.deepEqual(filasDeTablaDe(tabla).map(({ celdas }) => celdas), [
      ['Octubre 2026', '10,5 h 3 días', '1', 'Diciembre 2026', 'El mes sigue sumando'],
      ['Septiembre 2026', '7,5 h 2 días', '1', 'Noviembre 2026', 'Disponible desde el 02/11'],
      ['Agosto 2026', '14 h 4 días', '2', 'Octubre 2026', '1 usado el 23/10 · 1 para usar hasta el 30/10'],
      ['Julio 2026', '5 h 2 días', '0', '—', 'No llega a 7 horas: no genera franco'],
      ['Junio 2026', '7 h 2 días', '1', 'Agosto 2026', 'No utilizado previamente']
    ]);
    assert.ok(tabla.includes('Solo las horas extras al 100%.'));
  });

  it('planta: la situación con el color de su estado; lo que ya no se usa, en gris y sin insignia', () => {
    const filas = filasDeTablaDe(M.htmlDeTablaDeFrancos(planta));
    assert.deepEqual(filas.map(({ clases }) => clases.includes('tenue')), [false, false, false, true, true]);
    assert.deepEqual(filas.map(({ html }) => html.match(/<span class="me-insignia (\w+)">/)?.[1] ?? null), ['gris', 'azul', 'ambar', null, null]);
  });

  it('cada mes de la tabla es un botón data-mes; de entrada, el en curso', () => {
    const botones = botonesDe(M.htmlDeTablaDeFrancos(planta)).filter(({ atributos }) => atributos['data-mes']);
    assert.deepEqual(botones.map(({ atributos, texto }) => [atributos['data-mes'], atributos['aria-pressed'], texto]), [
      ['2026-10', 'true', 'Octubre 2026'], ['2026-09', 'false', 'Septiembre 2026'], ['2026-08', 'false', 'Agosto 2026'],
      ['2026-07', 'false', 'Julio 2026'], ['2026-06', 'false', 'Junio 2026']
    ]);
    const elegido = botonesDe(M.htmlDeTablaDeFrancos(planta, '2026-08'))
      .filter(({ atributos }) => atributos['data-mes'] && atributos['aria-pressed'] === 'true');
    assert.deepEqual(elegido.map(({ atributos }) => atributos['data-mes']), ['2026-08']);
  });

  it('planta: el uso autorizado, con el texto del servidor y su botón', () => {
    const tabla = M.htmlDeTablaDeFrancos(planta);
    assert.ok(tabla.includes(planta.uso_autorizado.texto));
    assert.deepEqual(botonesDe(tabla).filter(({ atributos }) => atributos['data-abrir']).map(({ atributos, texto }) => [atributos['data-abrir'], texto]),
      [['uso', 'Registrar un uso autorizado']]);
    const sinUso = M.htmlDeTablaDeFrancos({ ...planta, uso_autorizado: { puede: false, texto: 'En 2026 no tenés francos no utilizados previamente.' } });
    assert.ok(sinUso.includes('En 2026 no tenés francos no utilizados previamente.'));
    assert.doesNotMatch(sinUso, /data-abrir="uso"/);
  });

  it('el día por día de un mes: el título, el total y cada día con su horario, sus horas y «Editar»', () => {
    const html = M.htmlDeDiaPorDia(planta, '2026-10');
    assert.match(html, /<h3>Octubre 2026, día por día<\/h3><span>10,5 horas<\/span>/);
    assert.deepEqual(filasDe(html).map(({ texto }) => texto), [
      'Jue 22/10 19:00 a 22:00 3 horas Editar', 'Mié 14/10 17:00 a 21:00 4 horas Editar', 'Mar 06/10 18:00 a 21:30 3,5 horas Editar'
    ]);
    assert.deepEqual(botonesDe(html).map(({ atributos }) => [atributos['data-editar-horas'], atributos['aria-label']]), [
      ['13', 'Editar las horas extras del Jue 22/10 de 19:00 a 22:00'], ['12', 'Editar las horas extras del Mié 14/10 de 17:00 a 21:00'],
      ['11', 'Editar las horas extras del Mar 06/10 de 18:00 a 21:30']
    ]);
    assert.equal(filasDe(M.htmlDeDiaPorDia(planta, '2026-08')).length, 4);
    // Un mes que no está en la tabla no tiene día por día
    assert.equal(M.htmlDeDiaPorDia(planta, '2026-05'), '');
    assert.equal(M.htmlDeDiaPorDia(planta, null), '');
  });

  it('contrato: la tabla de horas a favor, con lo usado y su detalle', () => {
    const tabla = M.htmlDeTablaDeHorasAFavor(contrato);
    assert.match(tabla, /<h2>Horas extras y horas a favor de 2026<\/h2>/);
    assert.deepEqual([...tabla.matchAll(/<th>([^<]*)<\/th>/g)].map(([, th]) => th), ['Mes trabajado', 'Horas extras', 'A favor en', 'Usadas', 'Situación']);
    assert.deepEqual(filasDeTablaDe(tabla).map(({ celdas }) => celdas), [
      ['Octubre 2026', '4 h', 'Noviembre 2026', '—', 'El mes sigue sumando'],
      ['Septiembre 2026', '10,5 h', 'Octubre 2026', '9 h 09/10: 7 h · 20/10: 2 h', '1,5 h para usar hasta el 30/10']
    ]);
    assert.deepEqual(botonesDe(tabla).filter(({ atributos }) => atributos['data-cargar']).map(({ texto }) => texto), ['Cargar horas extras']);
  });

  it('contrato: «Horas no utilizadas previamente», con su total, cada fila y «Registrar un uso autorizado»', () => {
    const html = M.htmlDeNoUtilizadas(contrato);
    assert.match(html, /<h3>Horas no utilizadas previamente<\/h3><span>6,5 horas en 2026<\/span>/);
    assert.deepEqual(filasDe(html).map(({ texto }) => texto), ['Del saldo inicial 6,5 horas']);
    assert.ok(html.includes(contrato.no_utilizadas.uso_autorizado.texto));
    assert.deepEqual(botonesDe(html).map(({ atributos, texto }) => [atributos['data-abrir'], texto]), [['uso', 'Registrar un uso autorizado']]);
    // Con el mes de origen, debajo
    const conMes = { ...contrato, no_utilizadas: { ...contrato.no_utilizadas, filas: [{ titulo: 'Septiembre 2026', texto: '1,5 horas', detalle: 'de las extras de agosto' }] } };
    assert.deepEqual(filasDe(M.htmlDeNoUtilizadas(conMes)).map(({ texto }) => texto), ['Septiembre 2026 1,5 horas de las extras de agosto']);
    assert.equal(M.htmlDeNoUtilizadas(planta), '');
  });

  it('htmlDeHorasExtras: en planta, los francos y el día por día; en contrato, además, las no utilizadas', () => {
    assert.equal(M.htmlDeHorasExtras(planta), M.htmlDeTablaDeFrancos(planta, '2026-10') + M.htmlDeDiaPorDia(planta, '2026-10'));
    assert.equal(M.htmlDeHorasExtras(planta, '2026-08'), M.htmlDeTablaDeFrancos(planta, '2026-08') + M.htmlDeDiaPorDia(planta, '2026-08'));
    assert.equal(M.htmlDeHorasExtras(contrato),
      M.htmlDeTablaDeHorasAFavor(contrato, '2026-10') + M.htmlDeDiaPorDia(contrato, '2026-10') + M.htmlDeNoUtilizadas(contrato));
    // Un mes que no está en la tabla: el en curso
    assert.equal(M.htmlDeHorasExtras(planta, '2026-01'), M.htmlDeHorasExtras(planta));
  });

  it('un año sin horas extras: el vacío y sin día por día; uno pasado abre el más nuevo', () => {
    const vacio = M.htmlDeHorasExtras(horasDe(PLANTA, { anio: 2025 }));
    assert.ok(vacio.includes('<p class="me-vacio">No hay horas extras cargadas en 2025.</p>'));
    assert.doesNotMatch(vacio, /<table|día por día/);
    assert.ok(vacio.includes('Cargar horas extras'));
    // Sin el mes en curso (otro año), el más nuevo de la tabla
    const otroAnio = { ...planta, mes_en_curso: null };
    assert.equal(M.mesInicialDe(otroAnio), '2026-10');
    assert.equal(M.mesInicialDe({ ...planta, mes_en_curso: '2026-11' }), '2026-10');
    assert.equal(M.mesInicialDe({ ...planta, meses: [] }), null);
  });

  // Review Focus 5
  it('una nota de unas horas extras con HTML se ve escapada', () => {
    const conNota = comoLlega(planta);
    conNota.dias_por_mes['2026-10'][0].nota = MALICIOSO;
    conNota.dias_por_mes['2026-10'][0].fecha_texto = MALICIOSO;
    const html = M.htmlDeDiaPorDia(conNota, '2026-10');
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes(`<span class="me-detalle me-fila-nota">${ESCAPADO}</span>`));
    assert.equal(botonesDe(html)[0].atributos['aria-label'], `Editar las horas extras del ${ESCAPADO} de 19:00 a 22:00`);
  });
});

// =====================================================================================================================================
// La página con un DOM falso: un árbol de elementos armado con el HTML de mi-espacio.html y con lo que la página escribe en innerHTML
// (con sus atributos, el foco y los eventos, que burbujean como en el navegador; el de tests/proyectos-frontend.test.js) y un fetch
// falso que anota los pedidos y puede tardar
// =====================================================================================================================================

const VACIOS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const desescapar = (texto) => texto.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&times;/g, '×').replace(/&amp;/g, '&');
const camello = (nombre) => nombre.replace(/-([a-z])/g, (_, letra) => letra.toUpperCase());
const PIEZA_DE_SELECTOR = /#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g;
const TOKEN_HTML = /<!--[\s\S]*?-->|<![^>]*>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;

const crearDom = () => {
  const dom = { activo: null };
  const coincideCompuesto = (el, compuesto) => {
    const etiqueta = /^[a-zA-Z][\w-]*/.exec(compuesto)?.[0];
    if (etiqueta && el.tagName !== etiqueta.toLowerCase()) return false;
    const resto = etiqueta ? compuesto.slice(etiqueta.length) : compuesto;
    let leido = 0;
    for (const [pieza, id, clase, atributo, valor] of resto.matchAll(PIEZA_DE_SELECTOR)) {
      leido += pieza.length;
      if (id !== undefined && el.id !== id) return false;
      if (clase !== undefined && !el.classList.contains(clase)) return false;
      if (atributo !== undefined && (el.getAttribute(atributo) === null || (valor !== undefined && el.getAttribute(atributo) !== valor))) return false;
    }
    if (leido !== resto.length) throw new Error(`Selector que el DOM falso no entiende: ${compuesto}`);
    return true;
  };
  const coincide = (el, selector) => {
    const compuestos = selector.trim().split(/\s+/);
    if (!coincideCompuesto(el, compuestos.at(-1))) return false;
    let actual = el.parentNode;
    for (let i = compuestos.length - 2; i >= 0; i -= 1) {
      while (actual?.esElemento && !coincideCompuesto(actual, compuestos[i])) actual = actual.parentNode;
      if (!actual?.esElemento) return false;
      actual = actual.parentNode;
    }
    return true;
  };
  const elemento = (tagName, atributos = {}) => {
    const attrs = { ...atributos };
    const oyentes = {};
    const clases = () => new Set(String(attrs.class ?? '').split(/\s+/).filter(Boolean));
    const el = {
      esElemento: true, tagName: tagName.toLowerCase(), parentNode: null, hijos: [], html: '', oyentes,
      hidden: Object.hasOwn(attrs, 'hidden'), disabled: Object.hasOwn(attrs, 'disabled'), tabIndex: 0,
      get id() { return attrs.id ?? ''; },
      get dataset() {
        return Object.fromEntries(Object.entries(attrs).filter(([nombre]) => nombre.startsWith('data-')).map(([nombre, valor]) => [camello(nombre.slice(5)), valor]));
      },
      classList: { contains: (clase) => clases().has(clase) },
      getAttribute: (nombre) => (Object.hasOwn(attrs, nombre) ? attrs[nombre] : null),
      setAttribute: (nombre, valor) => { attrs[nombre] = String(valor); },
      removeAttribute: (nombre) => { delete attrs[nombre]; },
      get textContent() { return el.hijos.map((hijo) => (typeof hijo === 'string' ? hijo : hijo.textContent)).join(''); },
      set textContent(valor) { soltar(el); el.hijos = [String(valor ?? '')]; },
      get innerHTML() { return el.html; },
      set innerHTML(html) { soltar(el); el.hijos = []; el.html = String(html); parsear(el.html, el); },
      appendChild(hijo) { if (typeof hijo !== 'string') hijo.parentNode = el; el.hijos.push(hijo); return hijo; },
      get isConnected() { let nodo = el; while (nodo.parentNode) nodo = nodo.parentNode; return nodo === raiz; },
      closest(selector) { for (let nodo = el; nodo?.esElemento && nodo !== raiz; nodo = nodo.parentNode) if (coincide(nodo, selector)) return nodo; return null; },
      querySelectorAll(selector) {
        const lista = [];
        const recorrer = (nodo) => { for (const hijo of nodo.hijos) if (typeof hijo !== 'string') { if (coincide(hijo, selector)) lista.push(hijo); recorrer(hijo); } };
        recorrer(el);
        return lista;
      },
      querySelector(selector) { return el.querySelectorAll(selector)[0] ?? null; },
      addEventListener: (tipo, funcion) => { (oyentes[tipo] ??= []).push(funcion); },
      // Un evento que burbujea desde el elemento hasta el documento
      disparar(tipo, extra = {}) {
        const evento = { type: tipo, target: el, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
        for (let nodo = el; nodo; nodo = nodo.parentNode) {
          evento.currentTarget = nodo;
          for (const funcion of nodo.oyentes?.[tipo] ?? []) funcion(evento);
        }
        return evento;
      },
      focus() { if (!el.disabled && el.isConnected) dom.activo = el; }
    };
    return el;
  };
  const soltar = (el) => { for (const hijo of el.hijos) if (typeof hijo !== 'string') hijo.parentNode = null; };
  const parsear = (html, padre) => {
    const pila = [padre];
    for (const [, cierre, etiqueta, atributos, solo, texto] of html.matchAll(TOKEN_HTML)) {
      if (texto !== undefined) pila.at(-1).appendChild(desescapar(texto));
      else if (etiqueta !== undefined) {
        const atributosLeidos = {};
        for (const [, nombre, valor] of (atributos ?? '').matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) atributosLeidos[nombre] = valor === undefined ? '' : desescapar(valor);
        const nuevo = pila.at(-1).appendChild(elemento(etiqueta, atributosLeidos));
        if (!solo && !VACIOS.has(etiqueta.toLowerCase())) pila.push(nuevo);
      } else if (cierre !== undefined) {
        const lugar = pila.map((nodo) => nodo.tagName).lastIndexOf(cierre.toLowerCase());
        if (lugar > 0) pila.length = lugar;
      }
    }
  };
  const raiz = elemento('#document');
  const documento = {
    get activeElement() { return dom.activo?.isConnected ? dom.activo : null; },
    getElementById: (id) => raiz.querySelector(`#${id}`),
    querySelector: (selector) => raiz.querySelector(selector),
    querySelectorAll: (selector) => raiz.querySelectorAll(selector),
    addEventListener: (tipo, funcion) => raiz.addEventListener(tipo, funcion)
  };
  // El cuerpo de mi-espacio.html, sin el <style> (no hace falta)
  raiz.innerHTML = leer('mi-espacio.html').replace(/<style>[\s\S]*?<\/style>/, '');
  return { dom, documento };
};

// Una respuesta del fetch falso
const respuesta = (status, body) => ({ status, body });
const ok = (data) => respuesta(200, { success: true, data });
const RESUMEN_CON_MODALIDAD = Object.freeze({ modalidad: { clave: 'planta', texto: 'Planta permanente' }, mensaje: null, abrir_saldos: false, marca: true });
// Lo que contesta el servidor falso, de entrada (la persona de planta)
const RESPUESTAS_DE_ENTRADA = (metodo, ruta) => {
  if (ruta === '/api/mi-espacio/resumen') return ok(RESUMEN_CON_MODALIDAD);
  if (ruta === '/api/mi-espacio/licencias') return ok(licenciasDe(PLANTA));
  if (ruta === '/api/mi-espacio/licencias?anio=2025') return ok(licenciasDe(PLANTA, { anio: 2025 }));
  if (ruta === '/api/mi-espacio/horas-extras') return ok(horasDe(PLANTA));
  if (ruta === '/api/mi-espacio/horas-extras?anio=2025') return ok(horasDe(PLANTA, { anio: 2025 }));
  return respuesta(404, { success: false, error: `Sin respuesta para ${metodo} ${ruta}` });
};

const montarPagina = ({ hash = '', responder = RESPUESTAS_DE_ENTRADA } = {}) => {
  const { dom, documento } = crearDom();
  const estado = { pedidos: [], direcciones: [], sesionCerrada: false, responder };
  const ventana = {
    location: { search: '', hash, pathname: '/mi-espacio.html', href: `/mi-espacio.html${hash}` },
    history: {
      replaceState: (_estado, _titulo, url) => {
        estado.direcciones.push(url);
        ventana.location.hash = url.slice(url.indexOf('#'));
      }
    },
    addEventListener() {}
  };
  const contexto = vm.createContext({
    CONFIG: { API_URL: '/api' },
    console: { log() {}, warn() {}, error() {} },
    document: documento,
    window: ventana,
    Auth: {
      isAuthenticated: () => true,
      getAuthHeaders: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer token-de-prueba' }),
      clearSession: () => { estado.sesionCerrada = true; }
    },
    fetch: async (url, opciones = {}) => {
      const metodo = opciones.method ?? 'GET';
      estado.pedidos.push({ metodo, ruta: url });
      const r = await estado.responder(metodo, url, opciones);
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
    }
  });
  vm.runInContext(`${leer('js/api.js')}\n;globalThis.Utils = Utils;`, contexto);
  vm.runInContext(leer('js/mi-espacio.js'), contexto);
  const esperar = async () => { for (let i = 0; i < 5; i += 1) await new Promise((resolver) => setImmediate(resolver)); };
  const el = (id) => documento.getElementById(id);
  const rutas = () => estado.pedidos.map((p) => p.ruta);
  const iniciar = async () => { await contexto.iniciarMiEspacio(); await esperar(); };
  // Un clic en un elemento (burbujea hasta el contenedor que lo escucha) y lo que pida después
  const tocar = async (elemento) => { assert.ok(elemento, 'el elemento existe'); elemento.disparar('click'); await esperar(); };
  return { contexto, dom, documento, ventana, estado, el, rutas, iniciar, tocar, esperar };
};

describe('mi-espacio.js: la página (DOM falso)', () => {
  it('sin fragmento abre el Resumen: pide el Resumen y nada más, escribe #resumen y, con modalidad, muestra los botones de carga', async () => {
    const pagina = montarPagina();
    await pagina.iniciar();
    assert.deepEqual(pagina.rutas(), ['/api/mi-espacio/resumen']);
    assert.deepEqual(pagina.estado.direcciones, ['#resumen']);
    assert.equal(pagina.el('tab-resumen').getAttribute('aria-selected'), 'true');
    assert.equal(pagina.el('tab-licencias').getAttribute('aria-selected'), 'false');
    assert.equal(pagina.el('vista-resumen').hidden, false);
    assert.equal(pagina.el('vista-licencias').hidden, true);
    assert.equal(pagina.el('vista-horas').hidden, true);
    assert.equal(pagina.el('btn-cargar-horas').hidden, false);
    assert.equal(pagina.el('btn-cargar-licencia').hidden, false);
  });

  it('#licencias: pide el Resumen y las licencias del año en curso, y dibuja la lista', async () => {
    const pagina = montarPagina({ hash: '#licencias' });
    await pagina.iniciar();
    assert.deepEqual(pagina.rutas().sort(), ['/api/mi-espacio/licencias', '/api/mi-espacio/resumen']);
    assert.equal(pagina.el('tab-licencias').getAttribute('aria-selected'), 'true');
    assert.equal(pagina.el('tab-licencias').tabIndex, 0);
    assert.equal(pagina.el('tab-resumen').tabIndex, -1);
    assert.equal(pagina.el('vista-licencias').hidden, false);
    assert.equal(pagina.el('vista-licencias').innerHTML, M.htmlDeListaDeLicencias(licenciasDe(PLANTA), 'todas'));
  });

  it('un año del selector pide ese año, lo anuncia y el foco vuelve a su botón; el que ya está elegido no pide nada', async () => {
    const pagina = montarPagina({ hash: '#licencias' });
    await pagina.iniciar();
    const vista = pagina.el('vista-licencias');
    await pagina.tocar(vista.querySelector('[data-anio="2026"]'));
    assert.equal(pagina.rutas().length, 2);
    await pagina.tocar(vista.querySelector('[data-anio="2025"]'));
    assert.equal(pagina.rutas().at(-1), '/api/mi-espacio/licencias?anio=2025');
    assert.ok(vista.innerHTML.includes('No hay licencias cargadas en 2025.'));
    assert.equal(pagina.documento.activeElement, vista.querySelector('[data-anio="2025"]'));
    assert.equal(pagina.el('me-anuncio').textContent, 'Mis licencias de 2025');
  });

  it('un filtro dibuja solo sus filas, sin pedir nada, y el foco vuelve a su botón', async () => {
    const pagina = montarPagina({ hash: '#licencias' });
    await pagina.iniciar();
    const vista = pagina.el('vista-licencias');
    const antes = pagina.rutas().length;
    await pagina.tocar(vista.querySelector('[data-filtro-licencia="franquicia"]'));
    assert.equal(pagina.rutas().length, antes);
    assert.equal(vista.innerHTML, M.htmlDeListaDeLicencias(licenciasDe(PLANTA), 'franquicia'));
    assert.equal(pagina.documento.activeElement, vista.querySelector('[data-filtro-licencia="franquicia"]'));
  });

  it('#horas: la tabla y el día por día del mes en curso; un mes de la tabla cambia el día por día sin pedir nada', async () => {
    const pagina = montarPagina({ hash: '#horas' });
    await pagina.iniciar();
    const vista = pagina.el('vista-horas');
    assert.equal(vista.innerHTML, M.htmlDeHorasExtras(horasDe(PLANTA)));
    const antes = pagina.rutas().length;
    await pagina.tocar(vista.querySelector('[data-mes="2026-08"]'));
    assert.equal(pagina.rutas().length, antes);
    assert.equal(vista.innerHTML, M.htmlDeHorasExtras(horasDe(PLANTA), '2026-08'));
    assert.equal(pagina.documento.activeElement, vista.querySelector('[data-mes="2026-08"]'));
    await pagina.tocar(vista.querySelector('[data-anio="2025"]'));
    assert.equal(pagina.rutas().at(-1), '/api/mi-espacio/horas-extras?anio=2025');
    assert.ok(vista.innerHTML.includes('No hay horas extras cargadas en 2025.'));
  });

  it('cambiar de pestaña escribe el fragmento y pide la pestaña solo la primera vez', async () => {
    const pagina = montarPagina();
    await pagina.iniciar();
    await pagina.tocar(pagina.el('tab-horas'));
    assert.equal(pagina.ventana.location.hash, '#horas');
    assert.equal(pagina.el('vista-horas').hidden, false);
    assert.equal(pagina.el('vista-resumen').hidden, true);
    await pagina.tocar(pagina.el('tab-resumen'));
    await pagina.tocar(pagina.el('tab-horas'));
    assert.equal(pagina.rutas().filter((ruta) => ruta.startsWith('/api/mi-espacio/horas-extras')).length, 1);
  });

  it('las flechas, Inicio y Fin mueven el foco entre las pestañas y las activan', async () => {
    const pagina = montarPagina();
    await pagina.iniciar();
    pagina.el('tab-resumen').disparar('keydown', { key: 'ArrowRight' });
    await pagina.esperar();
    assert.equal(pagina.el('tab-licencias').getAttribute('aria-selected'), 'true');
    assert.equal(pagina.documento.activeElement, pagina.el('tab-licencias'));
    pagina.el('tab-licencias').disparar('keydown', { key: 'End' });
    assert.equal(pagina.documento.activeElement, pagina.el('tab-horas'));
    pagina.el('tab-horas').disparar('keydown', { key: 'ArrowRight' });
    assert.equal(pagina.documento.activeElement, pagina.el('tab-resumen'));
    pagina.el('tab-resumen').disparar('keydown', { key: 'ArrowLeft' });
    assert.equal(pagina.documento.activeElement, pagina.el('tab-horas'));
    pagina.el('tab-horas').disparar('keydown', { key: 'Home' });
    assert.equal(pagina.documento.activeElement, pagina.el('tab-resumen'));
  });

  it('sin modalidad: el mensaje en el Resumen y en la pestaña, y los botones de carga ocultos', async () => {
    // Las tres rutas responden lo mismo: { modalidad: null, mensaje } (el Resumen trae además lo demás vacío)
    const pagina = montarPagina({ hash: '#licencias', responder: () => ok({ ...SIN_MODALIDAD, abrir_saldos: false, marca: false }) });
    await pagina.iniciar();
    assert.equal(pagina.el('vista-resumen').innerHTML, M.htmlDeMensaje(MENSAJES_MI_ESPACIO.sinModalidad));
    assert.equal(pagina.el('vista-licencias').innerHTML, M.htmlDeMensaje(MENSAJES_MI_ESPACIO.sinModalidad));
    assert.equal(pagina.el('btn-cargar-horas').hidden, true);
    assert.equal(pagina.el('btn-cargar-licencia').hidden, true);
  });

  it('con modalidad y sin arranque, el Resumen invita a completar «Mis vacaciones y saldos»', async () => {
    const pagina = montarPagina({
      responder: (metodo, ruta) => ok({ ...RESUMEN_CON_MODALIDAD, mensaje: MENSAJES_MI_ESPACIO.sinArranque, abrir_saldos: true })
    });
    await pagina.iniciar();
    assert.equal(pagina.el('vista-resumen').innerHTML, M.htmlSinArranque());
    assert.equal(pagina.el('btn-cargar-licencia').hidden, false);
  });

  it('una carga que falla lo dice en su pestaña y en #me-anuncio; volver a la pestaña la pide otra vez', async () => {
    let falla = true;
    const pagina = montarPagina({
      hash: '#licencias',
      responder: (metodo, ruta) => (falla && ruta.startsWith('/api/mi-espacio/licencias') ? respuesta(500, { success: false, error: 'Error al obtener las licencias' })
        : RESPUESTAS_DE_ENTRADA(metodo, ruta))
    });
    await pagina.iniciar();
    const texto = 'No se pudieron cargar tus licencias. Probá de nuevo en unos minutos.';
    assert.equal(textoDe(pagina.el('vista-licencias').innerHTML), texto);
    assert.equal(pagina.el('me-anuncio').textContent, texto);
    falla = false;
    await pagina.tocar(pagina.el('tab-resumen'));
    await pagina.tocar(pagina.el('tab-licencias'));
    assert.equal(filasDeLicenciaDe(pagina.el('vista-licencias').innerHTML).length, 6);
  });

  it('con la sesión vencida (401), cierra la sesión y va al login', async () => {
    const pagina = montarPagina({ responder: () => respuesta(401, { success: false, error: 'Token expirado' }) });
    await pagina.iniciar();
    assert.equal(pagina.estado.sesionCerrada, true);
    assert.equal(pagina.ventana.location.href, 'login.html');
  });

  it('una respuesta vieja que llega tarde no pisa la nueva', async () => {
    let soltarVieja;
    const vieja = new Promise((resolver) => { soltarVieja = resolver; });
    const pagina = montarPagina({
      hash: '#licencias',
      responder: async (metodo, ruta) => {
        if (ruta === '/api/mi-espacio/licencias?anio=2025') await vieja;
        if (ruta === '/api/mi-espacio/licencias?anio=2027') return ok(licenciasDe(PLANTA, { anio: 2027 }));
        return RESPUESTAS_DE_ENTRADA(metodo, ruta);
      }
    });
    await pagina.iniciar();
    const vista = pagina.el('vista-licencias');
    await pagina.tocar(vista.querySelector('[data-anio="2025"]'));
    // Mientras 2025 tarda, se elige 2027, que llega primero
    await pagina.tocar(vista.querySelector('[data-anio="2027"]'));
    assert.match(vista.innerHTML, /<h2>Mis licencias de 2027<\/h2>/);
    soltarVieja();
    await pagina.esperar();
    assert.match(vista.innerHTML, /<h2>Mis licencias de 2027<\/h2>/);
    assert.equal(pagina.el('me-anuncio').textContent, 'Mis licencias de 2027');
    // Y la vieja no se lleva el foco
    assert.equal(pagina.documento.activeElement, vista.querySelector('[data-anio="2027"]'));
  });
});
