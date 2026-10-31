// Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, secciones 8 y 11), ejecutado en Node: lo puro de public/js/mi-espacio.js
// (las pestañas; el Resumen «Titular» de la spec 2026-10-27-mi-espacio-resumen, con los faltantes, la banda —la frase, Vence pronto y
// la regla—, el resto y Hoy y mañana en columnas; la lista de licencias con su selector del año y sus filtros, las tablas de horas
// extras, el día por día y las horas no utilizadas previamente) con los datos que arma el servidor (services/miEspacioResumen.js)
// sobre los casos de tests/fixtures/mi-espacio-casos.js, pasados por JSON como los manda la API; y, con un DOM falso y un fetch
// falso, la carga de las pestañas. Los formularios (Task 17): lo puro, las copias atadas por tests de paridad (con
// services/miEspacioReglas.js y con usuarios.js, en su propio vm) y, con el DOM falso, los modales. La planilla de horas extras de
// contrato (spec 2026-10-27-mi-espacio-horas): lo puro, con la planilla de planillaDelMes, y sus copias. Como proyectos.js, el script al
// cargarse solo declara: se carga en un vm después del api.js de verdad (Utils.escapeHtml). Las personas son las inventadas de la
// maqueta.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import {
  filasDeLicencias, filaDeUnaLicencia, tablaDeHorasExtras, resumenDe, proximoFeriadoDe, diaLargo, mesTitulo, planillaDelMes,
  textoDeLaListaDe
} from '../services/miEspacioResumen.js';
import { feriadosDelRango } from '../services/feriadosReglas.js';
import { notaDeLicencia, htmlDeLaNota, aclaracionDeLaNota } from '../services/miEspacioNota.js';
import {
  DIAS_DE_PROXIMOS, itemDeEvento, itemDeLicencia, itemDeAusencia, itemsDeFeriados, eventosDeHoyYManana, MENSAJES_EVENTO,
  LARGO_TITULO_EVENTO, LARGO_DETALLE_EVENTO, FECHA_MINIMA_EVENTO, fechaMaximaEvento, textoRangoEvento, RECORDATORIOS,
  RECORDATORIO_POR_DEFECTO, TEXTO_RECORDATORIO, validarEvento, inicialesDe, cuandoDelEvento, avisoDe, companerosPorDia, fraseDelMes,
  mesDeLaFrase, TIPOS_DE_EVENTO, TEXTOS_PUBLICOS, LARGO_TEXTO_PUBLICO
} from '../services/miEspacioEventosReglas.js';
import { idPositivo } from '../services/proyectosReglas.js';
import { disposicionDeAdjunto } from '../services/seguimientoReglas.js';
import {
  calcular, vinculosDeLaLista, MENSAJES_MI_ESPACIO, ausenciasUnidas, ausentesDelRango, ausentesDeHoyYManana, DIAS_VACACIONES,
  DIAS_ESTUDIOS,
  DIAS_POR_EXAMEN, JORNADA, LARGO_NOTA, horasDe as horasDelServidor, camposDelSaldoInicial, validarSaldoInicial, textoSaldo,
  textoSaldoDelArranque, textoDeLasMitades, evaluarLicencia, pasoPrevistoDe, AVISO_DEL_PASO, AVISO_SIN_PERSONA_A_CARGO, textoAutorizadaDelFirmante,
  TIPOS_DE_UN_DIA, TIPOS_POR_HORAS, esDiaEntero, TEXTO_NO_SE_COPIA, SALIDA_DE_LA_JORNADA, TOLERANCIA_DIA_HABIL,
  TOLERANCIA_DIA_INHABIL, MAXIMO_DIAS_POR_GUARDADO, tipoDeDia, horasDeLaSalida, enDiasDeFranco, textoDeLaSumaDelMes, validarSalida,
  repartoDelMes, textoDeLoQueSeMueve
} from '../services/miEspacioReglas.js';
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

// «Hoy y mañana» como lo arma el controlador: las ausencias unidas de los compañeros entre hoy y mañana (a quien no es de
// administración, ninguna: se pasan solo cuando hacen falta), en dos grupos (los que no están hoy y los que empiezan mañana), y el
// próximo feriado, el de la maqueta
const MANANA = '2026-10-27';
const FERIADO_SOBERANIA = Object.freeze({
  id: 1, fecha: '2026-11-23', nombre: 'Día de la Soberanía Nacional', tipo: 'nacional', trasladado_de: null,
  se_repite: 0, hasta_anio: null, activo: 1, no_rige: []
});
const AUSENCIA_DE_MARTIN = Object.freeze({ usuario_id: 3, nombre: 'Martín Ríos', desde: '2026-10-26', hasta: '2026-10-30' });
// Empieza mañana: va en «Mañana no están»
const AUSENCIA_DE_DIEGO = Object.freeze({ usuario_id: 4, nombre: 'Diego Fernández', desde: MANANA, hasta: MANANA });
// `vinculos`: los de vinculosDe (un Map del id de cada fila a lo que dice de Configuración, con su `revision`), para `para_revisar`
const resumenDel = (caso, { estado = caso.estado, persona = caso.persona, ausencias = [], vinculos } = {}) => comoLlega(resumenDe({
  persona, estado, calculo: calculoDe(estado), hoy: HOY, feriados: SIN_FERIADOS,
  hoyYManana: {
    ...ausentesDeHoyYManana(ausentesDelRango(ausenciasUnidas(ausencias, SIN_FERIADOS), HOY, MANANA), HOY),
    proximo_feriado: proximoFeriadoDe([FERIADO_SOBERANIA], HOY)
  },
  vinculos
}));
const conLicencias = (estado, ...licencias) => ({ ...estado, licencias: [...estado.licencias, ...licencias] });
const licencia = (id, tipo, desde, hasta = desde, horas = null) => ({ id, tipo, desde, hasta, horas });
// PLANTA con el franco de octubre ya cargado, los tres días de la licencia 2024 usados en diciembre y las 42 horas de
// franquicia usadas (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.6): nada vence pronto
const SIN_NADA_QUE_VENZA = {
  ...conLicencias(PLANTA.estado, licencia(100, 'franco', '2026-10-27'), licencia(101, 'vacaciones', '2026-12-14', '2026-12-16')),
  saldos: PLANTA.estado.saldos.map((saldo) => (saldo.concepto === 'franquicias' ? { ...saldo, cantidad: 42 } : saldo))
};

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
// Lo que dice la página cuando un pedido no llega al servidor
const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor. Probá de nuevo en unos minutos.';
const ESCAPADO = '&lt;img src=x onerror=alert(1)&gt;';
// En una sola palabra: pasa entera por el nombre corto del servidor (nombreCorto se queda con la primera palabra de un nombre)
const MALICIOSO_EN_UNA_PALABRA = '<img/src=x/onerror=alert(1)>';
const ESCAPADO_EN_UNA_PALABRA = '&lt;img/src=x/onerror=alert(1)&gt;';
// Con una comilla doble adelante: en un atributo, intenta cerrarlo y abrir una etiqueta
const CON_COMILLAS = '"><img src=x onerror=alert(1)>';
const CON_COMILLAS_ESCAPADO = '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;';

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
  // La cuarta, la agenda (spec 2026-10-26-mi-espacio-agenda, 6)
  it('Resumen, Licencias, Horas extras y Agenda, en ese orden', () => {
    assert.deepEqual(plano(M.PESTANAS), ['resumen', 'licencias', 'horas', 'agenda']);
  });

  it('pestanaDeHash: la del fragmento; uno desconocido, o ninguno, abre el Resumen', () => {
    assert.equal(M.pestanaDeHash('#horas'), 'horas');
    assert.equal(M.pestanaDeHash('#licencias'), 'licencias');
    assert.equal(M.pestanaDeHash('#resumen'), 'resumen');
    assert.equal(M.pestanaDeHash('#agenda'), 'agenda');
    for (const otro of ['#otra', '#eventos', '', '#', undefined, null, 'horas#', 'agenda#']) {
      assert.equal(M.pestanaDeHash(otro), 'resumen', String(otro));
    }
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

// Los links de un HTML: { atributos, adentro, texto }
const linksDe = (html) => [...html.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)]
  .map(([, atributos, adentro]) => ({ atributos: atributosDe(atributos), adentro, texto: textoDe(adentro) }));
// El Resumen «Titular» (spec 2026-10-27-mi-espacio-resumen, 2 y 5), con los textos que arma el servidor: los tramos de la regla
// ({ clase, n, demora, duracion, numero }), las filas de una lista con o sin clase ({ clases, html, texto }) y las columnas de «Hoy y
// mañana» ({ titulo, html, texto }). Un tramo de un solo día lleva además la clase un-dia (`unDia`: spec
// 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.9)
const tramosDe = (html) => [...html.matchAll(/<span class="me-tramo (\w+)( un-dia)?" style="--n:([^;"]*);--demora:([^;"]*);--duracion:([^;"]*)"><span>([^<]*)<\/span><\/span>/g)]
  .map(([, clase, unDia, n, demora, duracion, numero]) => ({ clase, unDia: unDia !== undefined, n, demora, duracion, numero }));
const itemsDe = (html) => [...html.matchAll(/<li(?: class="([^"]*)")?>([\s\S]*?)<\/li>/g)]
  .map(([, clases = '', adentro]) => ({ clases: clases.split(' ').filter(Boolean), html: adentro, texto: textoDe(adentro) }));
const columnasDe = (html) => [...html.matchAll(/<div class="me-columna"><h3>([^<]*)<\/h3>([\s\S]*?)<\/div>/g)]
  .map(([, titulo, adentro]) => ({ titulo, html: adentro, texto: textoDe(adentro) }));
// Los títulos (h2) de un HTML, como los lee un lector de pantalla: sin lo que va con aria-hidden (el de la frase, con el número una
// sola vez, el oculto a la vista)
const sinLoDecorativo = (html) => html.replace(/<(\w+)\b[^>]*\baria-hidden="true"[^>]*>[^<]*<\/\1>/g, '');
const titulosDe = (html) => [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(([, adentro]) => textoDe(sinLoDecorativo(adentro)));
// La línea de cada número del resto: [--p, --demora]
const lineasDe = (html) => [...html.matchAll(/<span class="me-linea" aria-hidden="true"><i style="--p:([^;"]*)%;--demora:([^;"]*)ms"><\/i><\/span>/g)]
  .map(([, p, demora]) => [p, demora]);
const VER_LA_AGENDA = '<a class="sg-link" href="#agenda" data-pestana="agenda">Ver la agenda</a>';
const CABEZA_DE_HOY = '<section class="me-hoy" aria-labelledby="me-hoy-titulo"><h2 id="me-hoy-titulo">Hoy y mañana</h2>';
const SIN_EVENTOS = '<p class="me-vacio">No tenés eventos hoy ni mañana.</p>';
const sinNumerosRaros = (html, mensaje) => assert.doesNotMatch(html, /NaN|Infinity|undefined|null/, mensaje);

describe('el Resumen «Titular»', () => {
  const planta = resumenDel(PLANTA, { ausencias: [AUSENCIA_DE_MARTIN] });
  const contrato = resumenDel(CONTRATO);
  // Los eventos de hoy y de mañana como los arma el servidor (Task 2: con `dia` y `quien`): «Llamar a Vialidad…» hoy a las 12:00,
  // solo vos, y «Reunión de equipo» mañana a las 10:00, con 4 personas. Se arman al correr cada caso (las ayudas de la agenda están
  // más abajo en el archivo)
  const eventosDeHoy = () => comoLlega(eventosDeHoyYManana(respuestaDeEventos({ desde: HOY, hasta: MANANA }).eventos, HOY));

  it('PLANTA: la banda (la frase, «Vence pronto» y la regla, y la ola), «El resto de 2026» y «Hoy y mañana», en ese orden; sin el renglón de la modalidad', () => {
    const html = M.htmlDelResumen(planta);
    assert.ok(html.startsWith('<section class="me-banda" aria-labelledby="me-frase"><div class="me-banda-cuerpo">'));
    assert.deepEqual(titulosDe(html), ['Te quedan 33 días de vacaciones', 'Vence pronto', 'El resto de 2026', 'Hoy y mañana']);
    const lugares = ['class="me-titular"', 'class="me-vence"', 'class="me-regla"', 'class="me-ola"', 'class="me-resto"', 'class="me-hoy"']
      .map((clase) => html.indexOf(clase));
    assert.ok(lugares.every((lugar) => lugar > 0), String(lugares));
    assert.deepEqual(lugares, [...lugares].sort((a, b) => a - b));
    assert.equal(html, M.htmlDeLaBanda(planta) + M.htmlDelResto(planta) + M.htmlDeHoyYManana(planta.hoy_y_manana, true));
    // El renglón «Planta permanente · Año 2026» se fue: el día y la modalidad van arriba de la frase, y el año, en «El resto de 2026»
    assert.ok(!html.includes('me-contexto'));
    assert.ok(!html.includes('Año 2026'));
  });

  it('la banda: una section que se nombra con la frase; adentro, la frase, «Vence pronto» y la regla, y después la ola, decorativa', () => {
    const banda = M.htmlDeLaBanda(planta);
    const cuerpo = M.htmlDeLaFrase(planta.titular) + M.htmlDeVencePronto(planta.vence_pronto) + M.htmlDeLaRegla(planta.tanques.vacaciones);
    const abre = `<section class="me-banda" aria-labelledby="me-frase"><div class="me-banda-cuerpo">${cuerpo}</div>`;
    assert.ok(banda.startsWith(abre));
    assert.match(banda.slice(abre.length), /^<svg class="me-ola" viewBox="0 0 1200 28" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="[^"]+" fill="currentColor"\/><\/svg><\/section>$/);
    // Sin la frase o sin los tanques (sin un hoy válido), no hay banda
    assert.equal(M.htmlDeLaBanda({ ...planta, titular: null }), '');
    assert.equal(M.htmlDeLaBanda({ ...planta, tanques: null }), '');
  });

  it('la banda y el resto, sin un Resumen (null, undefined, un número o un texto): nada, sin romperse', () => {
    for (const raro of [null, undefined, 42, 'x']) {
      assert.equal(M.htmlDeLaBanda(raro), '', String(raro));
      assert.equal(M.htmlDelResto(raro), '', String(raro));
    }
  });

  it('la frase: el día y la modalidad, «Te quedan 33 días de vacaciones» con el número tres veces (el final invisible, el que se ve y el oculto) y la bajada', () => {
    assert.equal(M.htmlDeLaFrase(planta.titular), '<div class="me-titular"><p class="me-banda-dia">Lunes 26 de octubre, planta permanente</p>'
      + '<h2 class="me-frase" id="me-frase">Te quedan <span class="me-cifra"><span class="me-cifra-final" aria-hidden="true">33</span>'
      + '<span aria-hidden="true" data-contar>33</span><span class="visualmente-oculto">33</span></span> días de vacaciones</h2>'
      + '<p class="me-frase-bajada"><b class="vence">3 vencen el jueves 31/12.</b> <a href="#licencias" data-pestana="licencias" '
      + 'data-anio-licencias="2026" class="me-frase-link">5 ya están cargados para noviembre.</a> '
      + 'Otros 10 se habilitan el 1/1/2027.</p></div>');
    // CONTRATO: una sola oración, que no vence
    assert.ok(M.htmlDeLaFrase(contrato.titular).startsWith('<div class="me-titular"><p class="me-banda-dia">Lunes 26 de octubre, contrato</p>'));
    assert.ok(M.htmlDeLaFrase(contrato.titular).endsWith('</h2><p class="me-frase-bajada">Otros 7 se habilitan el 1/1/2027.</p></div>'));
    // Con 1 día: «Te queda 1 día de vacaciones», y el número, también tres veces
    const uno = M.htmlDeLaFrase({ ...planta.titular, antes: 'Te queda', cifra: '1', despues: 'día de vacaciones' });
    assert.equal(titulosDe(uno)[0], 'Te queda 1 día de vacaciones');
    assert.ok(uno.includes('<span class="me-cifra"><span class="me-cifra-final" aria-hidden="true">1</span><span aria-hidden="true" data-contar>1</span>'
      + '<span class="visualmente-oculto">1</span></span>'));
    // Con 0: la frase sin el número (sin cifra, sin .me-cifra); sin oraciones, sin bajada
    const sinDias = M.htmlDeLaFrase({ ...planta.titular, antes: 'No te quedan días de vacaciones', cifra: '', despues: '', bajada: [] });
    assert.ok(sinDias.includes('<h2 class="me-frase" id="me-frase">No te quedan días de vacaciones</h2>'));
    assert.ok(!sinDias.includes('me-cifra'));
    assert.ok(!sinDias.includes('data-contar'));
    assert.ok(!sinDias.includes('me-frase-bajada'));
    assert.equal(M.htmlDeLaFrase(null), '');
  });

  it('«Vence pronto»: un aside con su título; cada cosa, una entrada con el talón decorativo, el título, su línea y el botón con su tipo', () => {
    const html = M.htmlDeVencePronto(planta.vence_pronto);
    assert.ok(html.startsWith('<aside class="me-vence" aria-labelledby="me-vence-titulo"><h2 id="me-vence-titulo">Vence pronto</h2><ol class="me-entradas">'));
    assert.ok(html.endsWith('</ol></aside>'));
    assert.deepEqual(filasDe(html).map(({ clases, texto }) => [clases.join(' '), texto]), [
      ['me-entrada', '30 oct 1 franco compensatorio de octubre Vence el viernes 30/10, en 4 días. Cargarlo'],
      ['me-entrada', '31 dic 25 horas de franquicia Vencen el jueves 31/12, en 66 días. Cargar franquicia'],
      ['me-entrada', '31 dic 3 días de la licencia 2024 Vencen el jueves 31/12, en 66 días. Cargar vacaciones']
    ]);
    // El talón es decorativo: la línea ya dice la fecha
    assert.ok(html.includes('<span class="me-talon" aria-hidden="true"><b>30</b>oct</span>'));
    assert.ok(html.includes('<b id="me-vence-0">1 franco compensatorio de octubre</b><span class="me-entrada-texto">Vence el viernes 30/10, en 4 días.</span>'));
    assert.deepEqual(botonesDe(html).map(({ atributos, texto }) => [texto, atributos['data-accion'], atributos['data-tipo'], atributos['aria-describedby']]), [
      ['Cargarlo', 'cargar-licencia', 'franco', 'me-vence-0'],
      ['Cargar franquicia', 'cargar-licencia', 'franquicia', 'me-vence-1'],
      ['Cargar vacaciones', 'cargar-licencia', 'vacaciones', 'me-vence-2']
    ]);
    // Los textos largos de «Niveles» se fueron
    assert.ok(!html.includes('Viernes 30/10'));
    assert.ok(!html.includes('Es el último día hábil'));
    // CONTRATO: las horas a favor
    assert.deepEqual(filasDe(M.htmlDeVencePronto(contrato.vence_pronto)).map(({ texto }) => texto),
      ['30 oct 1,5 horas a favor de octubre Vencen el viernes 30/10, en 4 días. Usarlas']);
    assert.equal(M.htmlDeVencePronto([]), '');
    assert.equal(M.htmlDeVencePronto(null), '');
  });

  it('sin nada que venza: sin «Vence pronto», la frase y la regla a todo el ancho (sin-vence) y sin marca', () => {
    const resumen = resumenDel(PLANTA, { estado: SIN_NADA_QUE_VENZA });
    assert.deepEqual(resumen.vence_pronto, []);
    assert.equal(resumen.marca, false);
    const html = M.htmlDelResumen(resumen);
    assert.ok(html.startsWith('<section class="me-banda" aria-labelledby="me-frase"><div class="me-banda-cuerpo sin-vence"><div class="me-titular">'));
    assert.ok(!html.includes('<aside'));
    assert.ok(!html.includes('Vence pronto'));
    assert.doesNotMatch(html, /data-accion/);
    assert.ok(M.htmlDelResumen(planta).includes('<div class="me-banda-cuerpo"><div class="me-titular">'));
    assert.equal(M.htmlDeMarca(resumen.marca), '');
  });

  it('la marca de la pestaña: con algo que vence pronto, una imagen con su nombre (no un title); si no, nada', () => {
    assert.equal(planta.marca, true);
    assert.equal(M.htmlDeMarca(planta.marca), '<span class="me-marca" role="img" aria-label="Hay algo que vence pronto"></span>');
    for (const otro of [false, 1, 'true', null, undefined, {}]) assert.equal(M.htmlDeMarca(otro), '', String(otro));
  });

  it('la regla de PLANTA: la barra decorativa, partida en un tramo por capa con sus días, y debajo la lista de cada licencia', () => {
    const html = M.htmlDeLaRegla(planta.tanques.vacaciones);
    assert.ok(html.startsWith('<div class="me-regla"><div class="me-barra" aria-hidden="true" style="grid-template-columns: '
      + 'minmax(0, 3fr) minmax(0, 20fr) minmax(0, 10fr) minmax(0, 5fr) minmax(0, 10fr)">'));
    const tramos = tramosDe(html);
    assert.deepEqual(tramos.map(({ clase, n, numero }) => [clase, n, numero]), [
      ['vence', '3', '3'], ['tinta', '20', '20'], ['medio', '10', '10'], ['cargadas', '5', '5'], ['por_habilitar', '10', '10']
    ]);
    // El movimiento (spec, 3): empiezan a los 250 ms y cada uno dura max(160, n / 48 × 1300) ms, uno detrás del otro
    assert.deepEqual(tramos.map(({ demora, duracion }) => [demora, duracion]), [
      ['250ms', '160ms'], ['410ms', '542ms'], ['952ms', '271ms'], ['1223ms', '160ms'], ['1383ms', '271ms']
    ]);
    for (let i = 1; i < tramos.length; i += 1) {
      assert.equal(parseInt(tramos[i].demora, 10), parseInt(tramos[i - 1].demora, 10) + parseInt(tramos[i - 1].duracion, 10), `tramo ${i}`);
    }
    // La lista, con su nombre (el de la maqueta aprobada): cada capa con su muestra (decorativa), «Licencia 2024: 3» y su nota; la
    // que vence, en ámbar
    const lista = html.match(/<ul class="me-regla-lista" aria-label="Tus vacaciones, por licencia">([\s\S]*?)<\/ul>/)[1];
    assert.deepEqual(itemsDe(lista).map(({ clases, texto }) => [clases.join(' '), texto]), [
      ['vence', 'Licencia 2024: 3 Vence el 31/12/2026'],
      ['', 'Licencia 2025: 20 Vence el 31/12/2027'],
      ['', 'Licencia 2026: 10 La primera mitad'],
      ['', 'Cargados: 5 Cargados para noviembre'],
      ['', 'Todavía no: 10 Se habilitan el 1/1/2027']
    ]);
    assert.ok(lista.startsWith('<li class="vence"><i class="me-muestra vence" aria-hidden="true"></i><span><b>Licencia 2024: 3</b>Vence el 31/12/2026</span></li>'));
    assert.deepEqual([...lista.matchAll(/<i class="me-muestra (\w+)" aria-hidden="true"><\/i>/g)].map(([, clase]) => clase),
      ['vence', 'tinta', 'medio', 'cargadas', 'por_habilitar']);
    assert.ok(html.endsWith('</ul></div>'));
    // CONTRATO: sin la licencia que vence, las dos licencias y lo que todavía no se habilita
    assert.deepEqual(tramosDe(M.htmlDeLaRegla(contrato.tanques.vacaciones)).map(({ clase, n }) => [clase, n]),
      [['tinta', '5'], ['medio', '8'], ['por_habilitar', '7']]);
  });

  // Review Focus 4
  it('capas raras, la capacidad en 0 y un total en 0: ningún NaN ni Infinity; una n que no es un número positivo cuenta 0', () => {
    const raras = {
      capacidad: 40,
      capas: [{ clase: 'tinta', n: 0 }, { clase: 'medio', n: null }, { clase: 'vence', n: 'x' }, { clase: 'otra', n: -2 },
        { clase: 'medio', n: 1 }, { clase: 'tinta', n: 39 }, null]
    };
    const html = M.htmlDeLaRegla(raras);
    sinNumerosRaros(html);
    assert.ok(html.includes('style="grid-template-columns: minmax(0, 0fr) minmax(0, 0fr) minmax(0, 0fr) minmax(0, 0fr) minmax(0, 1fr) minmax(0, 39fr)"'));
    // Una clase desconocida, en tinta; el tramo de 1 día entre 40 lleva su número y la clase un-dia (el <style> lo achica si no entra,
    // en lugar de ocultarlo: spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.9) y dura lo mínimo
    assert.deepEqual(tramosDe(html).map(({ clase, n, numero, duracion }) => [clase, n, numero, duracion]), [
      ['tinta', '0', '0', '160ms'], ['medio', '0', '0', '160ms'], ['vence', '0', '0', '160ms'], ['tinta', '0', '0', '160ms'],
      ['medio', '1', '1', '160ms'], ['tinta', '39', '39', '1268ms']
    ]);
    assert.deepEqual(tramosDe(html).map(({ unDia }) => unDia), [false, false, false, false, true, false]);
    assert.ok(html.includes('<b>: 0</b>'), 'una capa sin nombre, con su número');
    // La capacidad en 0, o que no es un número positivo: los tramos quietos (0 ms)
    for (const capacidad of [0, -3, NaN, Infinity, undefined, null, '48', {}]) {
      const quieta = M.htmlDeLaRegla({ capacidad, capas: [{ clase: 'tinta', n: 3 }, { clase: 'medio', n: 2 }] });
      sinNumerosRaros(quieta, String(capacidad));
      assert.deepEqual(tramosDe(quieta).map(({ demora, duracion }) => [demora, duracion]), [['0ms', '0ms'], ['0ms', '0ms']], String(capacidad));
    }
    // Sin capas, o sin el tanque de vacaciones, no hay regla
    assert.equal(M.htmlDeLaRegla({ capacidad: 10, capas: [] }), '');
    assert.equal(M.htmlDeLaRegla(null), '');
    // Un total en 0 (las horas a favor sin horas): la línea vacía
    const sinHoras = resumenDel(CONTRATO, { estado: { ...CONTRATO.estado, horasExtras: [], salidas: [], licencias: [] } });
    assert.equal(sinHoras.tanques.otros.find(({ clave }) => clave === 'horas_a_favor').total, 0);
    const resto = M.htmlDelResto(sinHoras);
    sinNumerosRaros(resto);
    assert.deepEqual(lineasDe(resto)[0], ['0', '900']);
    // Un valor que pasa el total, negativo o que no es un número: entre 0% y 100%
    const [franquicias] = planta.tanques.otros;
    const otros = [{ ...franquicias, valor: 50 }, { ...franquicias, valor: -3 }, { ...franquicias, valor: 'x', total: NaN }, { ...franquicias, total: Infinity }];
    const raro = M.htmlDelResto({ ...planta, tanques: { ...planta.tanques, otros } });
    sinNumerosRaros(raro);
    assert.deepEqual(lineasDe(raro).map(([p]) => p), ['100', '0', '0', '0']);
  });

  it('el resto: la cabeza con «El resto de 2026», el día y «Mis vacaciones y saldos»; un número con su línea por saldo, cada uno un link a su pestaña', () => {
    const html = M.htmlDelResto(planta);
    assert.ok(html.startsWith('<section class="me-resto" aria-labelledby="me-resto-titulo"><div class="me-resto-cabeza"><h2 id="me-resto-titulo">El resto de 2026</h2>'));
    const cabeza = html.match(/<div class="me-resto-cabeza">[\s\S]*?<\/div>/)[0];
    assert.equal(textoDe(cabeza), 'El resto de 2026 Al lunes 26/10/2026 Mis vacaciones y saldos');
    assert.deepEqual(botonesDe(cabeza).map(({ atributos, texto }) => [atributos['data-abrir'], texto]), [['saldos', 'Mis vacaciones y saldos']]);
    assert.ok(html.includes('<ul class="me-numeros"><li><a class="me-numero" href="#licencias"'));
    const numeros = linksDe(html);
    assert.deepEqual(numeros.map(({ atributos, texto }) => [atributos.class, atributos.href, atributos['data-pestana'], atributos['aria-label'], texto]), [
      ['me-numero', '#licencias', 'licencias', 'Franquicias: quedan 25 de 42 horas. Ver tus licencias', '25 horas Franquicias de 42 horas'],
      ['me-numero', '#licencias', 'licencias', 'Estudios: quedan 9 de 15 días. Ver tus licencias', '9 días Estudios de 15 días'],
      ['me-numero', '#licencias', 'licencias', 'Atención médica: quedan 22 de 25 días. Ver tus licencias', '22 días Atención médica de 25 días'],
      ['me-numero', '#licencias', 'licencias', 'Grupo familiar: quedan 23 de 25 días. Ver tus licencias', '23 días Grupo familiar de 25 días']
    ]);
    // El número que sube al abrir (data-contar) con su unidad al lado
    assert.ok(numeros[0].adentro.startsWith('<span class="grande"><b data-contar>25</b><small>horas</small></span>'));
    // La línea, decorativa, que se llena en la proporción valor / total (25 de 42 = 59,5%), con su demora: 900 ms + 90 ms por línea
    assert.deepEqual(lineasDe(html), [['59.5', '900'], ['60', '990'], ['88', '1080'], ['92', '1170']]);
  });

  it('CONTRATO: las horas a favor, que vencen este mes, en ámbar y con su link a #horas', () => {
    const [horas, ...resto] = linksDe(M.htmlDelResto(contrato));
    assert.equal(horas.atributos.class, 'me-numero vence');
    assert.equal(horas.atributos.href, '#horas');
    assert.equal(horas.atributos['data-pestana'], 'horas');
    assert.equal(horas.atributos['aria-label'], 'Horas a favor: quedan 1,5 de 10,5 horas en octubre. Ver tus horas extras');
    assert.equal(horas.texto, '1,5 horas Horas a favor de 10,5 en octubre');
    assert.ok(horas.adentro.includes('<b data-contar>1,5</b>'));
    assert.deepEqual(lineasDe(horas.adentro), [['14.3', '900']]);
    assert.ok(resto.every(({ atributos }) => atributos.href === '#licencias' && atributos.class === 'me-numero'));
  });

  it('los francos o las horas a favor, mes por mes, en una línea: el que vence, el disponible, el que todavía suma y lo no utilizado previamente', () => {
    const mesesDe = (html) => [...html.matchAll(/<span class="me-mes([^"]*)"><strong>([^<]*)<\/strong> ([^<]*) <span>([^<]*)<\/span><\/span>/g)]
      .map(([, clases, numero, mes, nota]) => [clases.trim(), numero, mes, nota]);
    const html = M.htmlDeLosMeses(planta.pastillas);
    assert.ok(html.startsWith('<p class="me-meses"><b>Francos compensatorios:</b><span class="me-mes vence">'));
    assert.ok(html.endsWith('</span></p>'));
    assert.deepEqual(mesesDe(html), [
      ['vence', '1', 'Octubre', 'Hasta el viernes 30/10'],
      ['', '1', 'Noviembre', 'Por las horas de septiembre'],
      ['pendiente', '1', 'Diciembre', 'Octubre sigue sumando'],
      ['previo', '1', 'Agosto', 'No utilizado previamente']
    ]);
    assert.ok(html.includes('<span class="me-mes pendiente"><strong>1</strong> Diciembre <span>Octubre sigue sumando</span></span>'));
    assert.deepEqual(mesesDe(M.htmlDeLosMeses(contrato.pastillas)), [
      ['vence', '1,5', 'Octubre', 'De 10,5, hasta el viernes 30/10'],
      ['pendiente', '4', 'Noviembre', 'Octubre sigue sumando'],
      ['previo', '6,5', 'Horas de 2026', 'No utilizadas previamente']
    ]);
    // En el resto, después de los números
    assert.ok(M.htmlDelResto(planta).includes(`</ul>${html}`));
    // Solo lo no utilizado, sin meses: la línea con eso solo
    assert.deepEqual(mesesDe(M.htmlDeLosMeses({ ...planta.pastillas, meses: [] })), [['previo', '1', 'Agosto', 'No utilizado previamente']]);
    // Sin ningún mes ni nada no utilizado, la línea no va
    const sinMeses = { titulo: 'Francos compensatorios', meses: [], previo: null };
    assert.equal(M.htmlDeLosMeses(sinMeses), '');
    assert.equal(M.htmlDeLosMeses(null), '');
    assert.ok(!M.htmlDelResto({ ...planta, pastillas: sinMeses }).includes('me-meses'));
  });

  it('la médica extraordinaria, en una línea chica al final del resto; sin tanques (sin un hoy válido), no hay resto', () => {
    assert.ok(M.htmlDelResto(planta).endsWith('<p class="me-extra">Atención médica extraordinaria: sin tope. No usaste en 2026.</p></section>'));
    assert.ok(!M.htmlDelResto({ ...planta, extraordinaria: null }).includes('me-extra'));
    assert.equal(M.htmlDelResto({ ...planta, tanques: null }), '');
    // Un Resumen sin tanques ni frase (sin un hoy válido) no se rompe: sin la banda y sin el resto, con «Hoy y mañana»
    const sinHoy = M.htmlDelResumen({ ...planta, titular: null, tanques: null, pastillas: null, extraordinaria: null, vence_pronto: [] });
    assert.ok(!sinHoy.includes('me-banda'));
    assert.ok(!sinHoy.includes('me-resto'));
    assert.ok(sinHoy.startsWith(CABEZA_DE_HOY));
  });

  it('los faltantes: un aviso ámbar arriba de todo, antes de la banda', () => {
    const resumen = resumenDel(PLANTA, { estado: conLicencias(PLANTA.estado, licencia(100, 'franco', '2027-02-01')) });
    const texto = 'Revisá tus francos de febrero de 2027: cargaste 1 y no corresponde ninguno.';
    assert.deepEqual(resumen.faltantes, [texto]);
    const html = M.htmlDelResumen(resumen);
    assert.ok(html.startsWith(`<p class="me-aviso me-aviso-ambar">${texto}</p><section class="me-banda"`));
    // Varios, en una lista; ninguno, nada
    const dos = M.htmlDeFaltantes([texto, 'Revisá tus vacaciones: para el 15/06/2027 faltan 2 días habilitados.']);
    assert.match(dos, /^<div class="me-aviso me-aviso-ambar"><ul class="me-faltantes"><li>Revisá tus francos/);
    assert.equal(itemsDe(dos).length, 2);
    assert.equal(M.htmlDeFaltantes([]), '');
    assert.equal(M.htmlDeFaltantes(undefined), '');
    assert.equal(M.htmlDelResumen(planta).includes('me-aviso-ambar'), false);
  });

  it('sin modalidad, el mensaje; sin arranque, la invitación a «Mis vacaciones y saldos»', () => {
    const sinModalidad = resumenDel(PLANTA, { estado: { ...PLANTA.estado, modalidad: null } });
    assert.equal(M.htmlDelResumen(sinModalidad), M.htmlDeMensaje(MENSAJES_MI_ESPACIO.sinModalidad));
    const sinArranque = resumenDel(PLANTA, { estado: { ...PLANTA.estado, arranque: null } });
    assert.equal(sinArranque.abrir_saldos, true);
    assert.equal(M.htmlDelResumen(sinArranque), M.htmlSinArranque());
    assert.equal(M.htmlDelResumen(null), '');
  });

  it('«Hoy y mañana»: tres columnas, Hoy (los eventos y quién no está), Mañana y Próximo feriado; «Ver la agenda» al final de la última', () => {
    const html = M.htmlDeHoyYManana({ ...planta.hoy_y_manana, eventos: eventosDeHoy() }, true);
    assert.ok(html.startsWith(`${CABEZA_DE_HOY}<div class="me-columnas">`));
    assert.ok(html.endsWith('</div></div></section>'));
    assert.deepEqual(columnasDe(html).map(({ titulo, texto }) => [titulo, texto]), [
      ['Hoy', '12:00 Llamar a Vialidad por el TMDA solo vos Martín Ríos no está Vuelve el lunes 02/11'],
      ['Mañana', '10:00 Reunión de equipo con 4 personas'],
      ['Próximo feriado', 'Lunes 23/11 Día de la Soberanía Nacional Ver la agenda']
    ]);
    // La hora, el título y debajo quién (sin el día de `detalle`); quien no está, con su vuelta debajo (nunca el tipo)
    const [hoy, manana, feriado] = columnasDe(html);
    // (con un espacio después de la hora: sin él, un lector de pantalla y lo copiado dirían «12:00Llamar…»)
    assert.equal(hoy.html, '<ul><li><time>12:00</time> Llamar a Vialidad por el TMDA<small>solo vos</small></li>'
      + '<li class="ausente">Martín Ríos no está<small>Vuelve el lunes 02/11</small></li></ul>');
    assert.equal(manana.html, '<ul><li><time>10:00</time> Reunión de equipo<small>con 4 personas</small></li></ul>');
    assert.equal(feriado.html, `<ul><li><b>Lunes 23/11</b><small>Día de la Soberanía Nacional</small></li></ul>${VER_LA_AGENDA}`);
    assert.ok(!html.includes('Hoy · '));
    // Con eventos, sin «No tenés eventos…», y «Ver la agenda» una sola vez
    assert.ok(!html.includes('me-vacio'));
    assert.equal(html.split('Ver la agenda').length - 1, 1);
    // En el Resumen
    assert.ok(M.htmlDelResumen({ ...planta, hoy_y_manana: { ...planta.hoy_y_manana, eventos: eventosDeHoy() } }).endsWith(html));
  });

  it('«Hoy y mañana»: un evento sin quién, sin el renglón de debajo', () => {
    const [primero] = eventosDeHoy();
    const html = M.htmlDeHoyYManana({ ausentes_hoy: [], ausentes_manana: [], proximo_feriado: null, eventos: [{ ...primero, quien: '' }] }, true);
    assert.equal(columnasDe(html)[0].html, '<ul><li><time>12:00</time> Llamar a Vialidad por el TMDA</li></ul>' + VER_LA_AGENDA);
  });

  it('«Hoy y mañana»: los que no están, solo para quien ve a sus compañeros (el true literal); los que empiezan mañana, en Mañana', () => {
    const conLosDos = resumenDel(PLANTA, { ausencias: [AUSENCIA_DE_DIEGO, AUSENCIA_DE_MARTIN] }).hoy_y_manana;
    assert.deepEqual(columnasDe(M.htmlDeHoyYManana(conLosDos, true)).map(({ titulo, texto }) => [titulo, texto]), [
      ['Hoy', 'Martín Ríos no está Vuelve el lunes 02/11'],
      ['Mañana', 'Diego Fernández no está Vuelve el miércoles 28/10'],
      ['Próximo feriado', 'Lunes 23/11 Día de la Soberanía Nacional']
    ]);
    for (const otro of [false, 'true', 1, undefined]) {
      const html = M.htmlDeHoyYManana(conLosDos, otro);
      assert.ok(!html.includes('ausente') && !html.includes('no está'), String(otro));
      assert.deepEqual(columnasDe(html).map(({ titulo }) => titulo), ['Próximo feriado'], String(otro));
    }
    // Quien no ve a sus compañeros ve igual sus eventos
    const conEventos = M.htmlDeHoyYManana({ ...conLosDos, eventos: eventosDeHoy() }, false);
    assert.deepEqual(columnasDe(conEventos).map(({ titulo, texto }) => [titulo, texto]), [
      ['Hoy', '12:00 Llamar a Vialidad por el TMDA solo vos'],
      ['Mañana', '10:00 Reunión de equipo con 4 personas'],
      ['Próximo feriado', 'Lunes 23/11 Día de la Soberanía Nacional Ver la agenda']
    ]);
    // CONTRATO (una lectora): solo el feriado
    assert.deepEqual(columnasDe(M.htmlDeHoyYManana(contrato.hoy_y_manana, contrato.persona.ve_companeros)).map(({ titulo }) => titulo),
      ['Próximo feriado']);
  });

  it('«Hoy y mañana» sin la lista de eventos (un Resumen anterior a la agenda): una columna vacía no va y no hay «Ver la agenda»; sin ninguna, no hay sección', () => {
    const soloElFeriado = { ausentes_hoy: [], ausentes_manana: [], proximo_feriado: planta.hoy_y_manana.proximo_feriado };
    assert.equal(M.htmlDeHoyYManana(soloElFeriado, true), `${CABEZA_DE_HOY}<div class="me-columnas"><div class="me-columna"><h3>Próximo feriado</h3>`
      + '<ul><li><b>Lunes 23/11</b><small>Día de la Soberanía Nacional</small></li></ul></div></div></section>');
    assert.ok(!M.htmlDeHoyYManana(planta.hoy_y_manana, true).includes('Ver la agenda'));
    assert.equal(M.htmlDeHoyYManana({ ausentes_hoy: [], ausentes_manana: [], proximo_feriado: null }, true), '');
    for (const raro of [undefined, null, 'x', {}]) assert.equal(M.htmlDeHoyYManana(raro, true), '', String(raro));
    const sinHoyYManana = M.htmlDelResumen({ ...planta, hoy_y_manana: { ausentes_hoy: [], ausentes_manana: [], proximo_feriado: null } });
    assert.ok(!sinHoyYManana.includes('me-hoy'));
    assert.ok(sinHoyYManana.includes('me-resto'));
  });

  // Decisión del usuario (27/10/2026): con la agenda, la sección está siempre
  it('«Hoy y mañana» con la agenda y sin eventos: la sección va siempre, con «No tenés eventos hoy ni mañana.» y «Ver la agenda»', () => {
    const nada = { ausentes_hoy: [], ausentes_manana: [], proximo_feriado: null, eventos: [] };
    assert.equal(M.htmlDeHoyYManana(nada, true), `${CABEZA_DE_HOY}${SIN_EVENTOS}${VER_LA_AGENDA}</section>`);
    assert.equal(M.htmlDeHoyYManana(nada, false), `${CABEZA_DE_HOY}${SIN_EVENTOS}${VER_LA_AGENDA}</section>`);
    // Con el feriado: la frase, la columna del feriado y «Ver la agenda» al final de esa columna
    const conFeriado = M.htmlDeHoyYManana({ ...nada, proximo_feriado: planta.hoy_y_manana.proximo_feriado }, true);
    assert.equal(conFeriado, `${CABEZA_DE_HOY}${SIN_EVENTOS}<div class="me-columnas"><div class="me-columna"><h3>Próximo feriado</h3>`
      + `<ul><li><b>Lunes 23/11</b><small>Día de la Soberanía Nacional</small></li></ul>${VER_LA_AGENDA}</div></div></section>`);
    // Con un compañero que no está: la frase y su columna, antes de la del feriado
    const conMartin = M.htmlDeHoyYManana({ ...planta.hoy_y_manana, eventos: [] }, true);
    assert.ok(conMartin.startsWith(`${CABEZA_DE_HOY}${SIN_EVENTOS}<div class="me-columnas">`));
    assert.deepEqual(columnasDe(conMartin).map(({ titulo }) => titulo), ['Hoy', 'Próximo feriado']);
    // Un evento de otro día (que el servidor no manda) no cuenta como uno de hoy ni de mañana
    const [primero] = eventosDeHoy();
    assert.equal(M.htmlDeHoyYManana({ ...nada, eventos: [{ ...primero, dia: 'otro' }] }, true), `${CABEZA_DE_HOY}${SIN_EVENTOS}${VER_LA_AGENDA}</section>`);
  });

  it('«Hoy y mañana» con eventos: sin la frase, y «Ver la agenda» al final de la última columna, sea cual sea', () => {
    const sinFeriado = { ausentes_hoy: [], ausentes_manana: [], proximo_feriado: null };
    const html = M.htmlDeHoyYManana({ ...sinFeriado, eventos: eventosDeHoy() }, true);
    assert.ok(!html.includes('No tenés eventos'));
    const columnas = columnasDe(html);
    assert.deepEqual(columnas.map(({ titulo }) => titulo), ['Hoy', 'Mañana']);
    assert.ok(columnas[1].html.endsWith(VER_LA_AGENDA));
    assert.ok(!columnas[0].html.includes('Ver la agenda'));
    // Solo los de hoy: una columna, «Hoy», con «Ver la agenda»
    const soloHoy = M.htmlDeHoyYManana({ ...sinFeriado, eventos: eventosDeHoy().filter(({ dia }) => dia === 'hoy') }, true);
    assert.deepEqual(columnasDe(soloHoy).map(({ titulo, texto }) => [titulo, texto]), [['Hoy', '12:00 Llamar a Vialidad por el TMDA solo vos Ver la agenda']]);
  });

  // Review Focus 1
  it('todo texto del servidor del Resumen se escapa: la frase y su bajada, lo que vence, la regla, el resto, los eventos y quien no está, también en los aria-label', () => {
    const conHtml = comoLlega(resumenDel(PLANTA, { ausencias: [{ ...AUSENCIA_DE_MARTIN, nombre: MALICIOSO }, { ...AUSENCIA_DE_DIEGO, nombre: '<b>x</b>' }] }));
    Object.assign(conHtml.titular, { encabezado: MALICIOSO, antes: MALICIOSO, cifra: MALICIOSO, despues: MALICIOSO });
    conHtml.titular.bajada[0].texto = MALICIOSO;
    conHtml.titular.bajada[1].texto = MALICIOSO;
    Object.assign(conHtml.vence_pronto[0], { dia: MALICIOSO, mes: MALICIOSO, titulo: MALICIOSO, texto: MALICIOSO });
    conHtml.vence_pronto[0].accion = { texto: MALICIOSO, tipo: MALICIOSO };
    Object.assign(conHtml.tanques.vacaciones.capas[0], { nombre: MALICIOSO, nota: MALICIOSO, clase: MALICIOSO });
    Object.assign(conHtml.tanques.otros[0], { nombre: MALICIOSO, numero: MALICIOSO, unidad: MALICIOSO, de: MALICIOSO, aria: MALICIOSO, pestana: MALICIOSO });
    conHtml.pastillas.titulo = MALICIOSO;
    Object.assign(conHtml.pastillas.meses[0], { numero: MALICIOSO, mes: MALICIOSO, nota: MALICIOSO, estado: MALICIOSO });
    Object.assign(conHtml.pastillas.previo, { numero: MALICIOSO, titulo: MALICIOSO, nota: MALICIOSO });
    conHtml.extraordinaria = MALICIOSO;
    conHtml.al_texto = MALICIOSO;
    conHtml.faltantes = [MALICIOSO];
    conHtml.para_revisar = [{ licencia_id: 20, anio: 2027, texto: MALICIOSO, enlace: MALICIOSO }];
    conHtml.hoy_y_manana.proximo_feriado = { fecha: '2026-11-23', cuando: MALICIOSO, nombre: MALICIOSO };
    conHtml.hoy_y_manana.eventos = comoLlega(eventosDeHoyYManana(respuestaDeEventos({ desde: HOY, hasta: MANANA }, {
      eventos: [eventoDe(71, MALICIOSO, HOY, '12:00'),
        eventoDe(72, 'Otro', MANANA, '10:00', { ...DE_MARTIN, creador: MALICIOSO_EN_UNA_PALABRA })]
    }).eventos, HOY));
    assert.equal(conHtml.hoy_y_manana.eventos[1].quien, `de ${MALICIOSO_EN_UNA_PALABRA}`);
    const html = M.htmlDelResumen(conHtml);
    assert.ok(!html.includes('<img'), 'ningún <img> de verdad');
    assert.ok(!html.includes('<b>x</b>'));
    assert.ok(html.split(ESCAPADO).length - 1 >= 30, String(html.split(ESCAPADO).length - 1));
    // La frase (el número, en los dos lugares) y su bajada
    assert.ok(html.includes(`<p class="me-banda-dia">${ESCAPADO}</p><h2 class="me-frase" id="me-frase">${ESCAPADO} <span class="me-cifra">`
      + `<span class="me-cifra-final" aria-hidden="true">${ESCAPADO}</span><span aria-hidden="true" data-contar>${ESCAPADO}</span>`
      + `<span class="visualmente-oculto">${ESCAPADO}</span></span> ${ESCAPADO}</h2>`));
    assert.ok(html.includes(`<p class="me-frase-bajada"><b class="vence">${ESCAPADO}</b> <a href="#licencias" data-pestana="licencias" `
      + `data-anio-licencias="2026" class="me-frase-link">${ESCAPADO}</a> `));
    // Los faltantes y lo que hay que revisar, con el texto de su link
    assert.ok(html.startsWith(`<div class="me-aviso me-aviso-ambar"><ul class="me-faltantes"><li>${ESCAPADO}</li><li>${ESCAPADO} `
      + `<a href="#licencias" data-pestana="licencias" data-anio-licencias="2027">${ESCAPADO}</a></li></ul></div>`));
    // Lo que vence: el título, su línea, el botón y su tipo
    assert.ok(html.includes(`<b id="me-vence-0">${ESCAPADO}</b><span class="me-entrada-texto">${ESCAPADO}</span>`));
    assert.equal(botonesDe(html).find(({ atributos }) => atributos['data-accion']).atributos['data-tipo'], ESCAPADO);
    // La regla: una clase desconocida, en tinta
    assert.equal(tramosDe(html)[0].clase, 'tinta');
    assert.ok(html.includes(`<b>${ESCAPADO}: 3</b>${ESCAPADO}`));
    // El resto: el aria-label del servidor, escapado; una pestaña desconocida, a Licencias
    const [numero] = linksDe(html).filter(({ atributos }) => atributos.class?.startsWith('me-numero'));
    assert.equal(numero.atributos['aria-label'], ESCAPADO);
    assert.equal(numero.atributos.href, '#licencias');
    assert.ok(numero.adentro.includes(`<b data-contar>${ESCAPADO}</b><small>${ESCAPADO}</small>`));
    // Los eventos (el título y quién) y quien no está
    assert.ok(html.includes(`<li><time>12:00</time> ${ESCAPADO}<small>solo vos</small></li>`));
    assert.ok(html.includes(`<small>de ${ESCAPADO_EN_UNA_PALABRA}</small>`));
    assert.ok(html.includes(`<li class="ausente">${ESCAPADO} no está<small>`));
    assert.ok(html.includes('<li class="ausente">&lt;b&gt;x&lt;/b&gt; no está<small>'));
  });

  // Review Focus 1: con una comilla doble, un texto del servidor en un atributo no lo puede cerrar
  it('una comilla doble del servidor no sale de su atributo: el aria-label de los números del resto y el data-tipo de «Vence pronto»', () => {
    const conComillas = comoLlega(planta);
    conComillas.tanques.otros = conComillas.tanques.otros.map((tanque) => ({ ...tanque, aria: CON_COMILLAS }));
    conComillas.vence_pronto = conComillas.vence_pronto.map((cosa) => ({ ...cosa, accion: { ...cosa.accion, tipo: CON_COMILLAS } }));
    const html = M.htmlDelResumen(conComillas);
    assert.ok(!html.includes('<img'), 'ningún <img> de verdad');
    assert.ok(!html.includes(CON_COMILLAS));
    // Cada link del resto conserva sus cuatro atributos, y el aria-label tiene el texto entero, escapado
    const numeros = linksDe(html).filter(({ atributos }) => atributos.class?.startsWith('me-numero'));
    assert.equal(numeros.length, 4);
    for (const { atributos, adentro } of numeros) {
      assert.deepEqual(Object.keys(atributos), ['class', 'href', 'data-pestana', 'aria-label']);
      assert.equal(atributos['aria-label'], CON_COMILLAS_ESCAPADO);
      assert.ok(adentro.startsWith('<span class="grande">'));
    }
    // Cada botón de «Vence pronto», con sus cinco atributos: el data-tipo escapado y el aria-describedby a su título
    const botones = botonesDe(html).filter(({ atributos }) => atributos['data-accion'] === 'cargar-licencia');
    assert.equal(botones.length, 3);
    botones.forEach(({ atributos }, i) => {
      assert.deepEqual(Object.keys(atributos), ['type', 'class', 'data-accion', 'data-tipo', 'aria-describedby']);
      assert.equal(atributos['data-tipo'], CON_COMILLAS_ESCAPADO);
      assert.equal(atributos['aria-describedby'], `me-vence-${String(i)}`);
    });
  });
});

// spec 2026-10-27-mi-espacio-licencia-word, 6: el nombre del Word lo da el Content-Disposition de GET …/word
describe('nombreDelAdjunto: el nombre del archivo del Content-Disposition', () => {
  const CON_TILDES = 'Nota de licencia - Atención médica - 2026-11-05.docx';

  it('el filename* en UTF-8, decodificado: con sus tildes', () => {
    assert.equal(M.nombreDelAdjunto('attachment; filename="Nota de licencia - Atencion medica - 2026-11-05.docx"; '
      + "filename*=UTF-8''Nota%20de%20licencia%20-%20Atenci%C3%B3n%20m%C3%A9dica%20-%202026-11-05.docx"), CON_TILDES);
    // El charset sin distinguir mayúsculas, y el filename* solo
    assert.equal(M.nombreDelAdjunto("attachment; filename*=utf-8''a%C3%B1o.docx"), 'año.docx');
  });

  it('el que arma el servidor (disposicionDeAdjunto) vuelve tal cual: tildes, apóstrofos, paréntesis, comillas y emojis', () => {
    for (const nombre of [CON_TILDES, "Nota de licencia - Franco compensatorio (octubre) - 2026-12-14.docx",
      'Lo de \'aquí\' y "allá" con \\barra*.docx', 'Nota 😀 ñandú.docx']) {
      assert.equal(M.nombreDelAdjunto(disposicionDeAdjunto(nombre)), nombre, nombre);
    }
  });

  it('sin filename*, el filename entre comillas', () => {
    assert.equal(M.nombreDelAdjunto('attachment; filename="a.docx"'), 'a.docx');
    assert.equal(M.nombreDelAdjunto('attachment;filename="Nota de licencia.docx"'), 'Nota de licencia.docx');
  });

  it('sin nombre: null', () => {
    for (const vacio of [null, undefined, '', 'attachment', 'attachment; filename=""', "attachment; filename*=UTF-8''", 42]) {
      assert.equal(M.nombreDelAdjunto(vacio), null, String(vacio));
    }
  });

  it('un filename* con un % roto: el filename, o null, sin tirar', () => {
    assert.equal(M.nombreDelAdjunto("attachment; filename=\"a.docx\"; filename*=UTF-8''a%E9%.docx"), 'a.docx');
    assert.equal(M.nombreDelAdjunto("attachment; filename*=UTF-8''%E0%A4%A"), null);
  });

  it('el nombre de reserva y el mensaje de una descarga que falló', () => {
    assert.equal(M.NOMBRE_DEL_WORD_POR_DEFECTO, 'Nota de licencia.docx');
    assert.equal(M.MENSAJE_SIN_DESCARGA, 'No se pudo descargar la nota. Probá de nuevo en unos minutos.');
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
      '03/11 al 09/11/2026 5 días hábiles de 7 corridos', 'Vie 23/10/2026 1 día', 'Jue 15/10/2026 2 horas', '01/10 al 02/10/2026 2 días hábiles',
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

  // spec 2026-10-27-mi-espacio-licencia-word, 6: «Word» al lado de «Editar», en un grupo a la derecha de la fila
  it('«Word» antes de «Editar», en el grupo de acciones que cierra la fila: su id y el aria-label con sus fechas', () => {
    const conLaSiete = licenciasDe(PLANTA, { estado: conLicencias(PLANTA.estado, licencia(7, 'vacaciones', '2026-11-16', '2026-11-27')) });
    assert.equal(conLaSiete.licencias[0].id, 7);
    const fila = M.htmlDeFilaDeLicencia(conLaSiete.licencias[0]);
    const acciones = fila.match(/<span class="me-fila-acciones">([\s\S]*?)<\/span><\/li>$/);
    assert.ok(acciones, 'el grupo de acciones cierra la fila');
    assert.deepEqual(botonesDe(acciones[1]).map(({ atributos, texto }) => [texto, atributos]), [
      ['Word', { type: 'button', class: 'sg-link', 'data-word-licencia': '7',
        'aria-label': 'Descargar en Word la nota de la licencia del 16/11 al 27/11/2026' }],
      ['Editar', { type: 'button', class: 'sg-link', 'data-editar-licencia': '7', 'aria-label': 'Editar la licencia del 16/11 al 27/11/2026' }]
    ]);
    // Todas las de la lista, también las que ya pasaron y las que van en gris
    const word = botonesDe(html).filter(({ atributos }) => atributos['data-word-licencia']);
    assert.deepEqual(word.map(({ atributos }) => atributos['data-word-licencia']), ['6', '5', '4', '3', '2', '1']);
    assert.equal(word[1].atributos['aria-label'], 'Descargar en Word la nota de la licencia del Vie 23/10/2026');
    // El saldo inicial sigue con su «Cambiar» suelto
    assert.doesNotMatch(filasDe(html).at(-1).html, /data-word-licencia|me-fila-acciones/);
  });

  it('el uso autorizado no lleva «Word»: solo «Editar», en su grupo', () => {
    const conUso = licenciasDe(CONTRATO, { estado: conLicencias(CONTRATO.estado, licencia(8, 'uso_autorizado', '2026-11-30', '2026-11-30', 3)) });
    const uso = conUso.licencias.find((fila) => fila.tipo === 'uso_autorizado');
    const fila = M.htmlDeFilaDeLicencia(uso);
    assert.doesNotMatch(fila, /data-word-licencia/);
    assert.ok(fila.endsWith('<span class="me-fila-acciones"><button type="button" class="sg-link" data-editar-licencia="8" '
      + 'aria-label="Editar la licencia del Lun 30/11/2026">Editar</button></span></li>'));
    // Las demás licencias de la misma lista sí lo llevan
    const lista = M.htmlDeListaDeLicencias(conUso, 'todas');
    assert.deepEqual(botonesDe(lista).filter(({ atributos }) => atributos['data-word-licencia']).map(({ atributos }) => atributos['data-word-licencia']),
      conUso.licencias.filter((una) => una.tipo !== 'uso_autorizado').map((una) => String(una.id)));
  });

  it('«Word»: un id y unas fechas con HTML o comillas no salen de su atributo', () => {
    const fila = M.htmlDeFilaDeLicencia({ ...datos.licencias[0], id: CON_COMILLAS, fechas_texto: MALICIOSO });
    assert.ok(!fila.includes('<img'));
    const [word] = botonesDe(fila);
    assert.deepEqual(Object.keys(word.atributos), ['type', 'class', 'data-word-licencia', 'aria-label']);
    assert.equal(word.atributos['data-word-licencia'], CON_COMILLAS_ESCAPADO);
    assert.equal(word.atributos['aria-label'], `Descargar en Word la nota de la licencia del ${ESCAPADO}`);
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
    // «Word» va antes que «Editar» (spec 2026-10-27-mi-espacio-licencia-word, 6)
    assert.deepEqual(botonesDe(fila.html).map(({ atributos }) => atributos['aria-label']),
      [`Descargar en Word la nota de la licencia del ${ESCAPADO}`, `Editar la licencia del ${ESCAPADO}`]);
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
    // «A favor en» dice debajo, en chico, lo mismo en días de franco (spec 2026-10-27-mi-espacio-horas, sección 5: a_favor_detalle)
    assert.deepEqual(filasDeTablaDe(tabla).map(({ celdas }) => celdas), [
      ['Octubre 2026', '4 h', 'Noviembre 2026 4 horas', '—', 'El mes sigue sumando'],
      ['Septiembre 2026', '10,5 h', 'Octubre 2026 1 día de franco y 3,5 horas', '9 h 09/10: 7 h · 20/10: 2 h', '1,5 h para usar hasta el 30/10']
    ]);
    assert.deepEqual(filasDeTablaDe(tabla).map(({ html }) => html.match(/<td>[^<]*<small>([^<]*)<\/small><\/td>/)?.[1]),
      ['4 horas', '1 día de franco y 3,5 horas']);
    assert.deepEqual(botonesDe(tabla).filter(({ atributos }) => atributos['data-cargar']).map(({ texto }) => texto), ['Cargar horas extras']);
    // Sin el detalle (un mes de una respuesta de antes), sin el <small>; con HTML, escapado
    const sinDetalle = M.htmlDeTablaDeHorasAFavor({ ...contrato, meses: contrato.meses.map((fila) => ({ ...fila, a_favor_detalle: '' })) });
    assert.deepEqual(filasDeTablaDe(sinDetalle).map(({ celdas }) => celdas[2]), ['Noviembre 2026', 'Octubre 2026']);
    const conHtml = M.htmlDeTablaDeHorasAFavor({ ...contrato, meses: [{ ...contrato.meses[0], a_favor_detalle: MALICIOSO }] });
    assert.ok(!conHtml.includes('<img') && conHtml.includes(`<small>${ESCAPADO}</small>`));
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

  it('htmlDeHorasExtras: en planta, los francos y el día por día; en contrato, el día por día de las salidas y las no utilizadas', () => {
    assert.equal(M.htmlDeHorasExtras(planta), M.htmlDeTablaDeFrancos(planta, '2026-10') + M.htmlDeDiaPorDia(planta, '2026-10'));
    assert.equal(M.htmlDeHorasExtras(planta, '2026-08'), M.htmlDeTablaDeFrancos(planta, '2026-08') + M.htmlDeDiaPorDia(planta, '2026-08'));
    // Contrato carga en la planilla (spec 2026-10-27-mi-espacio-horas, sección 5): su día por día es el de las salidas, con
    // «Editar» de cada día (data-editar-salida), nunca el de planta (data-editar-horas)
    assert.equal(M.htmlDeHorasExtras(contrato),
      M.htmlDeTablaDeHorasAFavor(contrato, '2026-10') + M.htmlDeDiaPorDiaDeSalidas(contrato, '2026-10') + M.htmlDeNoUtilizadas(contrato));
    assert.equal(M.htmlDeHorasExtras(contrato, '2026-09'),
      M.htmlDeTablaDeHorasAFavor(contrato, '2026-09') + M.htmlDeDiaPorDiaDeSalidas(contrato, '2026-09') + M.htmlDeNoUtilizadas(contrato));
    assert.match(M.htmlDeHorasExtras(contrato), /data-editar-salida="2026-10-21"/);
    assert.doesNotMatch(M.htmlDeHorasExtras(contrato), /data-editar-horas/);
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

  it('las tablas toleran una tabla que no llegó, y un año que no es un año no se escribe', () => {
    for (const tabla of [undefined, null, {}]) {
      assert.doesNotThrow(() => M.htmlDeTablaDeFrancos(tabla));
      assert.doesNotThrow(() => M.htmlDeTablaDeHorasAFavor(tabla));
    }
    assert.match(M.htmlDeTablaDeFrancos(undefined), /<h2>Horas extras al 100%<\/h2>/);
    for (const [funcion, titulo] of [['htmlDeTablaDeFrancos', 'Horas extras al 100%'], ['htmlDeTablaDeHorasAFavor', 'Horas extras y horas a favor']]) {
      const html = M[funcion]({ ...planta, anio: MALICIOSO, meses: [] });
      assert.ok(!html.includes('<img'), funcion);
      assert.ok(html.includes(`<h2>${titulo}</h2>`), funcion);
      assert.ok(html.includes('<p class="me-vacio">No hay horas extras cargadas.</p>'), funcion);
    }
    // Y la lista de licencias, igual
    const lista = M.htmlDeListaDeLicencias({ ...licenciasDe(PLANTA, { anio: 2025 }), anio: MALICIOSO }, 'todas');
    assert.ok(lista.includes('<h2>Mis licencias</h2>') && lista.includes('<p class="me-vacio">No hay licencias cargadas.</p>'));
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
// La agenda (spec 2026-10-26-mi-espacio-agenda, 6; Task 9): el mes, los próximos y los colores (los eventos de «Hoy y mañana», con
// el Resumen «Titular», más arriba), con lo que manda GET /api/mi-espacio/eventos (los ítems de services/miEspacioEventosReglas.js),
// pasado por JSON. Hoy es el lunes 26/10/2026 y quien mira es Laura Gómez (1); las personas son las inventadas de la maqueta
// =====================================================================================================================================

const AHORA = `${HOY} 09:00:00`;
// Un evento como lo lee services/miEspacioEventosDatos.js: de Laura Gómez, personal y con «2 horas antes», salvo lo que se cambie
const eventoDe = (id, titulo, fecha, desde, cambios = {}) => ({
  id, titulo, detalle: null, fecha, desde, hasta: null, creado_por: 1, creador: 'Laura Gómez', compartido: 0, para_todos: 0,
  personas: [], recordatorio: '2h', ...cambios
});
const CUATRO_PERSONAS = Object.freeze([
  { id: 3, nombre: 'Martín Ríos', sin_recordatorio: 0 }, { id: 4, nombre: 'Diego Fernández', sin_recordatorio: 0 },
  { id: 5, nombre: 'Sofía Paz', sin_recordatorio: 0 }, { id: 6, nombre: 'Carla Benítez', sin_recordatorio: 0 }
]);
// De Martín Ríos, compartido con Laura Gómez
const DE_MARTIN = Object.freeze({
  creado_por: 3, creador: 'Martín Ríos', compartido: 1, personas: [{ id: 1, nombre: 'Laura Gómez', sin_recordatorio: 0 }]
});
const EVENTOS_DE_PRUEBA = Object.freeze([
  eventoDe(11, 'Llamar a Vialidad por el TMDA', '2026-10-26', '12:00'),
  eventoDe(12, 'Reunión de equipo', '2026-10-27', '10:00', { hasta: '11:00', compartido: 1, personas: CUATRO_PERSONAS }),
  eventoDe(13, 'Turno médico', '2026-10-28', '15:30', { recordatorio: 'dia_anterior' }),
  eventoDe(14, 'Entrega del informe trimestral', '2026-10-29', '09:00', DE_MARTIN),
  eventoDe(15, 'Reunión de equipo', '2026-11-02', '10:00', { hasta: '11:00', compartido: 1, para_todos: 1 })
]);
// Tus licencias: una franquicia de 2 horas (llega como DECIMAL) y unas vacaciones
const LICENCIAS_DE_PRUEBA = Object.freeze([
  { id: 21, tipo: 'franquicia', desde: '2026-10-15', hasta: '2026-10-15', horas: '2.0' },
  { id: 22, tipo: 'vacaciones', desde: '2026-11-03', hasta: '2026-11-09', horas: null }
]);
// Los compañeros que no están: Martín, desde el viernes antes de hoy; Sofía, un día
const AUSENCIAS_DE_PRUEBA = Object.freeze([
  { nombre: 'Martín Ríos', desde: '2026-10-23', hasta: '2026-10-30' },
  { nombre: 'Sofía Paz', desde: '2026-10-30', hasta: '2026-10-30' }
]);
const FERIADO_DIVERSIDAD = Object.freeze({ ...FERIADO_SOBERANIA, id: 2, fecha: '2026-10-12', nombre: 'Día del Respeto a la Diversidad Cultural' });

// Lo que contesta GET /api/mi-espacio/eventos para un rango: lo de ese rango, armado por el servidor (los compañeros, solo a quien
// los ve: `puedeCompartir`, y por día, `companeros_por_dia`). Los días hábiles de las licencias y de los compañeros, sin feriados de
// la tabla salvo con `conFeriados`, que les saca los de `feriados` (como hace el servidor con los suyos). `miNombreCorto`: el nombre
// de quien mira como lo ven los demás (el de la vista previa de un Personal (Público))
const respuestaDeEventos = ({ desde, hasta }, {
  eventos = EVENTOS_DE_PRUEBA, licencias = LICENCIAS_DE_PRUEBA, ausencias = AUSENCIAS_DE_PRUEBA,
  feriados = [FERIADO_DIVERSIDAD, FERIADO_SOBERANIA], puedeCompartir = true, conFeriados = false, miNombreCorto = 'Laura'
} = {}) => {
  const rango = { desde, hasta, feriados: conFeriados ? feriadosDelRango(feriados, desde, hasta) : SIN_FERIADOS };
  const seTocan = (fila) => fila.desde <= hasta && fila.hasta >= desde;
  const ausentes = puedeCompartir ? ausencias.filter(seTocan).map((ausencia) => itemDeAusencia(ausencia, rango)) : [];
  return comoLlega({
    desde, hasta, hoy: HOY, puede_compartir: puedeCompartir, mi_nombre_corto: miNombreCorto,
    eventos: eventos.filter((evento) => evento.fecha >= desde && evento.fecha <= hasta)
      .map((evento) => itemDeEvento(evento, { usuarioId: 1, ahora: AHORA, feriados: SIN_FERIADOS })),
    licencias: licencias.filter(seTocan).map((fila) => itemDeLicencia(fila, rango)),
    feriados: itemsDeFeriados(feriados, desde, hasta),
    ausentes,
    companeros_por_dia: companerosPorDia(ausentes)
  });
};
// La grilla de octubre (del lunes 28/09 al domingo 01/11) y los próximos 30 días (del 26/10 al 25/11)
const DEL_MES = respuestaDeEventos({ desde: '2026-09-28', hasta: '2026-11-01' });
const PROXIMOS = respuestaDeEventos({ desde: '2026-10-26', hasta: '2026-11-25' });
// Un jueves con un feriado, una licencia, un compañero y dos eventos
const UN_DIA_LLENO = respuestaDeEventos({ desde: '2026-09-28', hasta: '2026-11-01' }, {
  eventos: [eventoDe(31, 'Revisar el informe', '2026-10-15', '16:00'), eventoDe(32, 'Café con Catastro', '2026-10-15', '09:00', DE_MARTIN)],
  licencias: [LICENCIAS_DE_PRUEBA[0]],
  ausencias: [{ nombre: 'Martín Ríos', desde: '2026-10-14', hasta: '2026-10-16' }],
  feriados: [{ ...FERIADO_SOBERANIA, id: 3, fecha: '2026-10-15', nombre: 'Feriado de prueba' }]
});

// Las celdas de un mes: { clases, atributos, html, texto }, en el orden de la grilla
const celdasDe = (html) => [...html.matchAll(/<td class="([^"]*)"([^>]*)>([\s\S]*?)<\/td>/g)]
  .map(([, clases, atributos, adentro]) => ({ clases: clases.split(' '), atributos: atributosDe(atributos), html: adentro, texto: textoDe(adentro) }));
const celdaDel = (html, mes, fecha) => celdasDe(html)[M.diasDeLaGrilla(mes).findIndex((dia) => dia.fecha === fecha)];
// Las cosas de un día, como objetos de acá
const cosasDe = (datos) => plano(Object.fromEntries([...M.cosasPorDia(datos)]));

describe('la agenda: el mes', () => {
  it('DIAS_DE_PROXIMOS es la del servidor', () => {
    assert.equal(M.DIAS_DE_PROXIMOS, DIAS_DE_PROXIMOS);
  });

  it('diasDeLaGrilla: de lunes a domingo, con los días de los meses vecinos para completar las semanas', () => {
    const octubre = plano(M.diasDeLaGrilla('2026-10'));
    assert.equal(octubre.length, 35);
    assert.equal(octubre[0].fecha, '2026-09-28');
    assert.equal(octubre.at(-1).fecha, '2026-11-01');
    assert.deepEqual(octubre[0], { fecha: '2026-09-28', dia: 28, del_mes: false, finde: false });
    assert.deepEqual(octubre[3], { fecha: '2026-10-01', dia: 1, del_mes: true, finde: false });
    assert.deepEqual(octubre[5], { fecha: '2026-10-03', dia: 3, del_mes: true, finde: true });
    assert.deepEqual(octubre[6], { fecha: '2026-10-04', dia: 4, del_mes: true, finde: true });
    // Cada semana empieza un lunes, y los sábados y domingos son finde
    octubre.forEach((dia, i) => {
      assert.equal(diaLargo(dia.fecha).split(' ')[0], ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][i % 7], dia.fecha);
      assert.equal(dia.finde, i % 7 >= 5, dia.fecha);
    });
    assert.deepEqual(octubre.filter((dia) => !dia.del_mes).map((dia) => dia.fecha), ['2026-09-28', '2026-09-29', '2026-09-30', '2026-11-01']);
    const agosto = plano(M.diasDeLaGrilla('2026-08'));
    assert.equal(agosto.length, 42);
    assert.equal(agosto[0].fecha, '2026-07-27');
    assert.equal(agosto.at(-1).fecha, '2026-09-06');
    // El cambio de año
    assert.equal(M.diasDeLaGrilla('2027-01')[0].fecha, '2026-12-28');
    assert.equal(M.diasDeLaGrilla('2027-01').at(-1).fecha, '2027-01-31');
    // Febrero de 2027 empieza un lunes y termina un domingo: cuatro semanas justas
    const febrero = plano(M.diasDeLaGrilla('2027-02'));
    assert.equal(febrero.length, 28);
    assert.ok(febrero.every((dia) => dia.del_mes));
    for (const raro of ['2026-13', '2026-00', '2026-1', '2026-10-01', '', null, undefined, 'octubre', '1999-12', '2101-01']) {
      assert.deepEqual(plano(M.diasDeLaGrilla(raro)), [], String(raro));
    }
  });

  it('mesVecino, tituloDelMes (como mesTitulo del servidor) y los rangos del mes y de los próximos', () => {
    assert.equal(M.mesVecino('2026-12', 1), '2027-01');
    assert.equal(M.mesVecino('2027-01', -1), '2026-12');
    assert.equal(M.mesVecino('2026-10', 0), '2026-10');
    assert.equal(M.mesVecino('2026-10', 14), '2027-12');
    assert.equal(M.mesVecino('2026-10', -10), '2025-12');
    for (const [mes, n] of [['2026-13', 1], [null, 1], ['2026-10', 1.5], ['2026-10', '1'], ['2100-12', 1], ['2000-01', -1]]) {
      assert.equal(M.mesVecino(mes, n), null, `${mes} ${n}`);
    }
    for (const mes of ['2026-01', '2026-10', '2027-02', '2026-12']) assert.equal(M.tituloDelMes(mes), mesTitulo(mes), mes);
    assert.equal(M.tituloDelMes('2026-10'), 'Octubre 2026');
    assert.equal(M.tituloDelMes('raro'), '');
    assert.deepEqual(plano(M.rangoDeLaGrilla('2026-10')), { desde: '2026-09-28', hasta: '2026-11-01' });
    assert.deepEqual(plano(M.rangoDeLaGrilla('2027-01')), { desde: '2026-12-28', hasta: '2027-01-31' });
    assert.equal(M.rangoDeLaGrilla('2026-13'), null);
    assert.deepEqual(plano(M.rangoDeProximos('2026-10-26')), { desde: '2026-10-26', hasta: '2026-11-25' });
    assert.deepEqual(plano(M.rangoDeProximos('2026-12-20')), { desde: '2026-12-20', hasta: '2027-01-19' });
    for (const raro of ['2026-02-30', '', null, 'hoy']) assert.equal(M.rangoDeProximos(raro), null, String(raro));
  });

  it('diaLargoDe es diaLargo del servidor: «lunes 26/10»', () => {
    for (const fecha of ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2027-01-01']) {
      assert.equal(M.diaLargoDe(fecha), diaLargo(fecha), fecha);
    }
  });

  // spec 2026-10-28-mi-espacio-agenda-onda, 3.5: lo de cada día que no es una barra (tus licencias y los compañeros van en las
  // barras: barrasDelMes)
  it('cosasPorDia: los feriados y los eventos por hora y título; tus licencias y los compañeros no (van en las barras)', () => {
    assert.deepEqual(cosasDe(DEL_MES), {
      '2026-10-12': [{ clase: 'feriado', texto: 'Feriado: Día del Respeto a la Diversidad Cultural' }],
      '2026-10-26': [{ clase: 'propio', texto: '12:00 Llamar a Vialidad por el TMDA', evento_id: 11 }],
      '2026-10-27': [{ clase: 'compartido', texto: '10:00 Reunión de equipo', evento_id: 12 }],
      '2026-10-28': [{ clase: 'propio', texto: '15:30 Turno médico', evento_id: 13 }],
      '2026-10-29': [{ clase: 'compartido', texto: '09:00 Entrega del informe trimestral', evento_id: 14 }]
    });
    // Los eventos de un día, por hora (el de las 09:00 primero, aunque llegue después), después del feriado; la franquicia y Martín
    // de ese día, no
    assert.deepEqual(cosasDe(UN_DIA_LLENO)['2026-10-15'], [
      { clase: 'feriado', texto: 'Feriado: Feriado de prueba' }, { clase: 'compartido', texto: '09:00 Café con Catastro', evento_id: 32 },
      { clase: 'propio', texto: '16:00 Revisar el informe', evento_id: 31 }
    ]);
    // Ningún día con una licencia o un compañero, aunque lleguen (en los próximos, las vacaciones del 03/11, Martín y Sofía)
    for (const datos of [DEL_MES, UN_DIA_LLENO, PROXIMOS]) {
      assert.ok(Object.values(cosasDe(datos)).flat().every((cosa) => !['licencia', 'ausente'].includes(cosa.clase)));
    }
    assert.deepEqual(Object.keys(cosasDe(PROXIMOS)).sort(), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-11-02', '2026-11-23']);
    for (const raro of [null, undefined, {}, 'x', { eventos: 'x', licencias: [null], feriados: [{ fecha: 'raro' }] }]) {
      assert.deepEqual(cosasDe(raro), {}, JSON.stringify(raro));
    }
  });
});

// El modelo del mes (spec 2026-10-28-mi-espacio-agenda-onda, 3.2, 3.4, 3.5 y 3.8): noviembre de 2026 empieza un domingo, con lo que
// manda el servidor para su grilla (del lunes 26/10 al domingo 06/12): tus vacaciones de siempre (del 03/11 al 09/11) y otras del
// 16/11 al 27/11, con el lunes 23 feriado; Julián, del 03/11 al 06/11 y del 01/12 al 02/12, y Carla, del 05/11 al 13/11 (llegan en
// ese orden: el texto del día los ordena por nombre); el feriado del domingo 8 y el del lunes 23. Los días hábiles, con esos feriados
const FERIADO_DEL_EMPLEADO = Object.freeze({ ...FERIADO_SOBERANIA, id: 4, fecha: '2026-11-08', nombre: 'Día del Empleado Municipal' });
const RANGO_DE_NOVIEMBRE = Object.freeze({ desde: '2026-10-26', hasta: '2026-12-06' });
const deNoviembre = (cambios = {}) => respuestaDeEventos(RANGO_DE_NOVIEMBRE, {
  licencias: [LICENCIAS_DE_PRUEBA[1], { id: 24, tipo: 'vacaciones', desde: '2026-11-16', hasta: '2026-11-27', horas: null }],
  ausencias: [
    { nombre: 'Julián', desde: '2026-11-03', hasta: '2026-11-06' }, { nombre: 'Carla', desde: '2026-11-05', hasta: '2026-11-13' },
    { nombre: 'Julián', desde: '2026-12-01', hasta: '2026-12-02' }
  ],
  feriados: [FERIADO_DEL_EMPLEADO, FERIADO_SOBERANIA], conFeriados: true, ...cambios
});
const DE_NOVIEMBRE = deNoviembre();
// Las fechas de las semanas, como listas de acá
const fechasDeLasSemanas = (semanas) => plano(semanas).map((semana) => semana.map((dia) => dia.fecha));
// Las barras de cada semana, como objetos de acá: { carriles, piezas: { fecha: [Pieza|null] } }
const barrasDe = (semanas, datos) => [...M.barrasDelMes(semanas, datos)]
  .map((semana) => plano({ carriles: semana.carriles, piezas: Object.fromEntries([...semana.piezas]) }));
// Las piezas de un día, de la semana que lo tiene
const piezasDel = (barras, fecha) => barras.find((semana) => Object.hasOwn(semana.piezas, fecha))?.piezas[fecha];
const pieza = (clase, texto, titulo, cambios = {}) => ({
  clase, texto, titulo, inicio: false, fin: false, largo: null, sigue_antes: false, sigue_despues: false, ...cambios
});
const VACACIONES_DEL_3 = 'Vacaciones. Hasta el lunes 09/11';
const VACACIONES_DEL_16 = 'Vacaciones. Hasta el viernes 27/11';
const JULIAN_HASTA_EL_6 = 'Julián no está. Hasta el viernes 06/11.';
const CARLA_Y_JULIAN = 'Carla no está. Hasta el viernes 13/11. Julián no está. Hasta el viernes 06/11.';
const CARLA_HASTA_EL_13 = 'Carla no está. Hasta el viernes 13/11.';

describe('la agenda: el modelo del mes', () => {
  it('el servidor manda los compañeros de cada día con el texto que ordena los nombres', () => {
    assert.deepEqual(DE_NOVIEMBRE.ausentes.map((ausente) => ausente.texto), ['Julián no está', 'Carla no está', 'Julián no está']);
    assert.deepEqual(DE_NOVIEMBRE.companeros_por_dia.filter((dia) => dia.fecha <= '2026-11-09'), [
      { fecha: '2026-11-03', texto: 'Julián no está' }, { fecha: '2026-11-04', texto: 'Julián no está' },
      { fecha: '2026-11-05', texto: 'Carla y Julián no están' }, { fecha: '2026-11-06', texto: 'Carla y Julián no están' },
      { fecha: '2026-11-09', texto: 'Carla no está' }
    ]);
    // El lunes 23 es feriado: las vacaciones del 16 no lo pintan
    assert.ok(!DE_NOVIEMBRE.licencias[1].dias.includes('2026-11-23'));
    assert.equal(DE_NOVIEMBRE.licencias[1].dias.length, 9);
  });

  it('semanasDelMes: sin sábado y domingo, de lunes a viernes y sin las semanas que no tienen días del mes', () => {
    const noviembre = M.semanasDelMes('2026-11', { finde: false });
    assert.deepEqual(fechasDeLasSemanas(noviembre), [
      ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'],
      ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'],
      ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'],
      ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'],
      ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04']
    ]);
    // Los días son los de diasDeLaGrilla, tal cual
    const grilla = new Map(plano(M.diasDeLaGrilla('2026-11')).map((dia) => [dia.fecha, dia]));
    for (const dia of plano(noviembre).flat()) assert.deepEqual(dia, grilla.get(dia.fecha), dia.fecha);
    assert.deepEqual(plano(noviembre)[4].map((dia) => dia.del_mes), [true, false, false, false, false]);
    // Agosto de 2026 empieza un sábado: la primera fila es la del lunes 3
    assert.equal(M.semanasDelMes('2026-08', { finde: false })[0][0].fecha, '2026-08-03');
    assert.equal(M.semanasDelMes('2026-08', { finde: false }).at(-1)[0].fecha, '2026-08-31');
    // Octubre termina un sábado: la última fila termina el viernes 30, y la primera trae el 1 y el 2
    assert.deepEqual(fechasDeLasSemanas(M.semanasDelMes('2026-10', { finde: false })).at(-1),
      ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']);
    assert.equal(M.semanasDelMes('2026-10', { finde: false })[0][0].fecha, '2026-09-28');
    assert.equal(M.semanasDelMes('2027-02', { finde: false }).length, 4);
    // Sin decir nada, o con algo que no es el true literal, ocultos (como de entrada)
    for (const opciones of [undefined, null, {}, { finde: 'si' }, { finde: 1 }]) {
      assert.deepEqual(fechasDeLasSemanas(M.semanasDelMes('2026-11', opciones)), fechasDeLasSemanas(noviembre), JSON.stringify(opciones));
    }
  });

  it('semanasDelMes: con sábado y domingo, las semanas enteras de diasDeLaGrilla', () => {
    const noviembre = M.semanasDelMes('2026-11', { finde: true });
    assert.equal(noviembre.length, 6);
    assert.ok(plano(noviembre).every((semana) => semana.length === 7));
    assert.deepEqual(fechasDeLasSemanas(noviembre)[0],
      ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    assert.deepEqual(plano(noviembre).flat(), plano(M.diasDeLaGrilla('2026-11')));
    assert.equal(M.semanasDelMes('2026-08', { finde: true })[0][0].fecha, '2026-07-27');
    for (const raro of ['2026-13', '', null, undefined, 'noviembre', '1999-12']) {
      assert.deepEqual(plano(M.semanasDelMes(raro, { finde: true })), [], String(raro));
      assert.deepEqual(plano(M.semanasDelMes(raro, { finde: false })), [], String(raro));
    }
  });

  it('renglonesDelDia: con lugar, una cosa hasta 3 renglones, dos hasta 2 y tres uno; si no, «y N más»', () => {
    const casos = [
      [1, 4, [3], 0], [2, 4, [2, 2], 0], [3, 4, [1, 1, 1], 0], [4, 4, [1, 1, 1], 1], [7, 4, [1, 1, 1], 4],
      [1, 3, [3], 0], [2, 3, [2, 1], 0], [3, 3, [1, 1, 1], 0], [4, 3, [1, 1], 2],
      [1, 2, [2], 0], [2, 2, [1, 1], 0], [3, 2, [1], 2], [0, 4, [], 0], [0, 2, [], 0]
    ];
    for (const [cantidad, lugares, lineas, mas] of casos) {
      assert.deepEqual(plano(M.renglonesDelDia(cantidad, lugares)), { lineas, mas }, `${cantidad} en ${lugares}`);
    }
    // Nunca menos de una a la vista, ni un «más» negativo, ni NaN
    assert.deepEqual(plano(M.renglonesDelDia(2, 1)), { lineas: [1], mas: 1 });
    assert.deepEqual(plano(M.renglonesDelDia(1, 0)), { lineas: [1], mas: 0 });
    for (const [cantidad, lugares] of [[null, 4], ['2', 4], [-1, 4], [1.5, 4], [Number.NaN, 4]]) {
      assert.deepEqual(plano(M.renglonesDelDia(cantidad, lugares)), { lineas: [], mas: 0 }, String(cantidad));
    }
    for (const lugares of [null, 'x', -2, Number.NaN]) {
      assert.deepEqual(plano(M.renglonesDelDia(2, lugares)), { lineas: [1], mas: 1 }, String(lugares));
    }
  });

  it('barrasDelMes: tus licencias en el carril 1 y los compañeros en el 2; un tramo por días seguidos con lo mismo', () => {
    const barras = barrasDe(M.semanasDelMes('2026-11', { finde: false }), DE_NOVIEMBRE);
    assert.deepEqual(barras.map((semana) => semana.carriles), [2, 2, 1, 1, 1]);
    assert.deepEqual(barras[0].piezas, {
      '2026-11-02': [null, null],
      '2026-11-03': [
        pieza('licencia', 'Vacaciones', VACACIONES_DEL_3, { inicio: true, largo: 4 }),
        pieza('ausente', 'Julián no está', JULIAN_HASTA_EL_6, { inicio: true, largo: 2 })
      ],
      '2026-11-04': [
        pieza('licencia', 'Vacaciones', VACACIONES_DEL_3),
        pieza('ausente', 'Julián no está', JULIAN_HASTA_EL_6, { fin: true })
      ],
      '2026-11-05': [
        pieza('licencia', 'Vacaciones', VACACIONES_DEL_3),
        pieza('ausente', 'Carla y Julián no están', CARLA_Y_JULIAN, { inicio: true, largo: 2 })
      ],
      // El viernes, la última columna: las vacaciones siguen el lunes 9, los compañeros no (ese día está solo Carla)
      '2026-11-06': [
        pieza('licencia', 'Vacaciones', VACACIONES_DEL_3, { fin: true, sigue_despues: true }),
        pieza('ausente', 'Carla y Julián no están', CARLA_Y_JULIAN, { fin: true })
      ]
    });
    assert.deepEqual(piezasDel(barras, '2026-11-09'), [
      pieza('licencia', 'Vacaciones', VACACIONES_DEL_3, { inicio: true, fin: true, largo: 1, sigue_antes: true }),
      pieza('ausente', 'Carla no está', CARLA_HASTA_EL_13, { inicio: true, largo: 5 })
    ]);
    assert.deepEqual(piezasDel(barras, '2026-11-10'), [null, pieza('ausente', 'Carla no está', CARLA_HASTA_EL_13)]);
    assert.deepEqual(piezasDel(barras, '2026-11-13'), [null, pieza('ausente', 'Carla no está', CARLA_HASTA_EL_13, { fin: true })]);
  });

  it('barrasDelMes: un feriado corta la barra, y la fila siguiente que no empieza igual no la sigue', () => {
    const barras = barrasDe(M.semanasDelMes('2026-11', { finde: false }), DE_NOVIEMBRE);
    // Las vacaciones del 16 al 20: un tramo de 5 que no sigue (el lunes 23 es feriado)
    assert.deepEqual(barras[2].piezas['2026-11-16'], [pieza('licencia', 'Vacaciones', VACACIONES_DEL_16, { inicio: true, largo: 5 })]);
    assert.deepEqual(barras[2].piezas['2026-11-20'], [pieza('licencia', 'Vacaciones', VACACIONES_DEL_16, { fin: true })]);
    // El lunes 23, nada; el 24 empieza otro tramo, que no viene de antes
    assert.deepEqual(barras[3].piezas['2026-11-23'], [null]);
    assert.deepEqual(barras[3].piezas['2026-11-24'], [pieza('licencia', 'Vacaciones', VACACIONES_DEL_16, { inicio: true, largo: 4 })]);
    assert.deepEqual(barras[3].piezas['2026-11-27'], [pieza('licencia', 'Vacaciones', VACACIONES_DEL_16, { fin: true })]);
    // Sin ninguna licencia en la semana, los compañeros van en el carril 1
    assert.deepEqual(barras[4].piezas, {
      '2026-11-30': [null],
      '2026-12-01': [pieza('ausente', 'Julián no está', 'Julián no está. Hasta el miércoles 02/12.', { inicio: true, largo: 2 })],
      '2026-12-02': [pieza('ausente', 'Julián no está', 'Julián no está. Hasta el miércoles 02/12.', { fin: true })],
      '2026-12-03': [null],
      '2026-12-04': [null]
    });
  });

  it('barrasDelMes: una licencia del jueves 01/10 al martes 06/10 sigue del viernes al lunes; con el fin de semana a la vista, no', () => {
    const datos = respuestaDeEventos({ desde: '2026-09-28', hasta: '2026-11-01' }, {
      licencias: [{ id: 23, tipo: 'vacaciones', desde: '2026-10-01', hasta: '2026-10-06', horas: null }], ausencias: []
    });
    const titulo = 'Vacaciones. Hasta el martes 06/10';
    const ocultos = barrasDe(M.semanasDelMes('2026-10', { finde: false }), datos);
    assert.deepEqual(ocultos.map((semana) => semana.carriles), [1, 1, 0, 0, 0]);
    assert.deepEqual(piezasDel(ocultos, '2026-10-01'), [pieza('licencia', 'Vacaciones', titulo, { inicio: true, largo: 2 })]);
    assert.deepEqual(piezasDel(ocultos, '2026-10-02'), [pieza('licencia', 'Vacaciones', titulo, { fin: true, sigue_despues: true })]);
    assert.deepEqual(piezasDel(ocultos, '2026-10-05'), [pieza('licencia', 'Vacaciones', titulo, { inicio: true, largo: 2, sigue_antes: true })]);
    assert.deepEqual(piezasDel(ocultos, '2026-10-06'), [pieza('licencia', 'Vacaciones', titulo, { fin: true })]);
    // Con sábado y domingo, el sábado y el domingo (sin licencia) la cortan: ninguna punta sigue
    const visibles = barrasDe(M.semanasDelMes('2026-10', { finde: true }), datos);
    assert.deepEqual(piezasDel(visibles, '2026-10-02'), [pieza('licencia', 'Vacaciones', titulo, { fin: true })]);
    assert.deepEqual(piezasDel(visibles, '2026-10-03'), [null]);
    assert.deepEqual(piezasDel(visibles, '2026-10-05'), [pieza('licencia', 'Vacaciones', titulo, { inicio: true, largo: 2 })]);
    // En noviembre, con sábado y domingo, las vacaciones del 03 terminan el viernes 6 sin seguir
    const noviembre = barrasDe(M.semanasDelMes('2026-11', { finde: true }), DE_NOVIEMBRE);
    assert.deepEqual(piezasDel(noviembre, '2026-11-06')[0], pieza('licencia', 'Vacaciones', VACACIONES_DEL_3, { fin: true }));
    assert.deepEqual(piezasDel(noviembre, '2026-11-08'), [null, null]);
    assert.deepEqual(piezasDel(noviembre, '2026-11-09')[0], pieza('licencia', 'Vacaciones', VACACIONES_DEL_3, { inicio: true, fin: true, largo: 1 }));
  });

  it('barrasDelMes: dos licencias seguidas con el mismo texto son dos tramos (por id); las filas de las puntas de la grilla no siguen', () => {
    const datos = deNoviembre({
      licencias: [{ id: 25, tipo: 'vacaciones', desde: '2026-11-02', hasta: '2026-11-03', horas: null },
        { id: 26, tipo: 'vacaciones', desde: '2026-11-04', hasta: '2026-11-04', horas: null },
        { id: 27, tipo: 'vacaciones', desde: '2026-11-30', hasta: '2026-12-11', horas: null }],
      ausencias: []
    });
    const barras = barrasDe(M.semanasDelMes('2026-11', { finde: false }), datos);
    assert.deepEqual(barras[0].piezas['2026-11-02'], [pieza('licencia', 'Vacaciones', 'Vacaciones. Hasta el martes 03/11', { inicio: true, largo: 2 })]);
    assert.deepEqual(barras[0].piezas['2026-11-03'], [pieza('licencia', 'Vacaciones', 'Vacaciones. Hasta el martes 03/11', { fin: true })]);
    assert.deepEqual(barras[0].piezas['2026-11-04'], [pieza('licencia', 'Vacaciones', 'Vacaciones', { inicio: true, fin: true, largo: 1 })]);
    // La última fila: el viernes 4/12 no sigue, aunque las vacaciones sigan la semana siguiente
    assert.deepEqual(barras[4].piezas['2026-12-04'], [pieza('licencia', 'Vacaciones', 'Vacaciones. Hasta el viernes 11/12', { fin: true })]);
    // Sin un id que sirva, cada licencia es la suya (por su lugar en la lista): no se juntan
    const sinId = { ...datos, licencias: datos.licencias.map((una) => ({ ...una, id: null })) };
    const deSinId = barrasDe(M.semanasDelMes('2026-11', { finde: false }), sinId);
    assert.deepEqual(['2026-11-02', '2026-11-03', '2026-11-04'].map((fecha) => [deSinId[0].piezas[fecha][0].inicio, deSinId[0].piezas[fecha][0].largo]),
      [[true, 2], [false, null], [true, 1]]);
  });

  it('barrasDelMes: sin compañeros ni licencias, ningún carril; lo que no sirve, sin barras', () => {
    const semanas = M.semanasDelMes('2026-11', { finde: false });
    const vacio = barrasDe(semanas, deNoviembre({ licencias: [], ausencias: [] }));
    assert.deepEqual(vacio.map((semana) => semana.carriles), [0, 0, 0, 0, 0]);
    assert.deepEqual(vacio[0].piezas, { '2026-11-02': [], '2026-11-03': [], '2026-11-04': [], '2026-11-05': [], '2026-11-06': [] });
    // Quien no ve a los compañeros recibe [] en los dos: solo sus licencias
    assert.deepEqual(barrasDe(semanas, deNoviembre({ puedeCompartir: false })).map((semana) => semana.carriles), [1, 1, 1, 1, 0]);
    for (const raro of [null, undefined, 'x', {}, { licencias: 'x', companeros_por_dia: [null, { fecha: 'raro', texto: 'x' }] }]) {
      assert.deepEqual(barrasDe(semanas, raro).map((semana) => semana.carriles), [0, 0, 0, 0, 0], JSON.stringify(raro));
    }
    for (const raro of [null, undefined, 'x', {}, [null, 'x']]) assert.deepEqual(barrasDe(raro, DE_NOVIEMBRE), [], JSON.stringify(raro));
  });

  it('barrasDelMes: el texto de los compañeros es el del servidor, y el title nombra a cada uno en el orden del texto', () => {
    const datos = { ...DE_NOVIEMBRE, companeros_por_dia: DE_NOVIEMBRE.companeros_por_dia.map((dia) => ({ ...dia, texto: `${dia.texto} ${MALICIOSO}` })) };
    const barras = barrasDe(M.semanasDelMes('2026-11', { finde: false }), datos);
    // Lo que no se escapa acá: lo escapa el HTML (Task 6)
    assert.equal(piezasDel(barras, '2026-11-05')[1].texto, `Carla y Julián no están ${MALICIOSO}`);
    assert.equal(piezasDel(barras, '2026-11-05')[1].titulo, CARLA_Y_JULIAN);
    // Sin `hasta_texto` (un día), solo el texto
    const deUnDia = deNoviembre({ ausencias: [{ nombre: 'Julián', desde: '2026-11-04', hasta: '2026-11-04' },
      { nombre: 'Carla', desde: '2026-11-04', hasta: '2026-11-05' }] });
    assert.deepEqual(piezasDel(barrasDe(M.semanasDelMes('2026-11', { finde: false }), deUnDia), '2026-11-04')[1],
      pieza('ausente', 'Carla y Julián no están', 'Carla no está. Hasta el jueves 05/11. Julián no está.', { inicio: true, fin: true, largo: 1 }));
    // Si el día no tiene a nadie en `ausentes` (no debería pasar), el title es el texto del día
    const sinAusentes = { ...DE_NOVIEMBRE, ausentes: [] };
    assert.equal(piezasDel(barrasDe(M.semanasDelMes('2026-11', { finde: false }), sinAusentes), '2026-11-05')[1].titulo, 'Carla y Julián no están');
  });

  it('cuantasEnElFinde: los feriados y los eventos de los sábados y domingos del mes', () => {
    assert.equal(M.cuantasEnElFinde('2026-11', DE_NOVIEMBRE), 1);
    const conGuardias = deNoviembre({
      eventos: [...EVENTOS_DE_PRUEBA, eventoDe(16, 'Guardia', '2026-11-14', '09:00'),
        // De la grilla, pero de otro mes: no cuentan
        eventoDe(17, 'Guardia', '2026-10-31', '09:00'), eventoDe(18, 'Guardia', '2026-12-06', '09:00')]
    });
    assert.equal(M.cuantasEnElFinde('2026-11', conGuardias), 2);
    assert.equal(M.cuantasEnElFinde('2026-10', conGuardias), 1);
    // Son las cosas de cosasPorDia que quedan en sábados y domingos del mes
    const delFinde = Object.entries(cosasDe(conGuardias))
      .filter(([fecha]) => fecha.startsWith('2026-11') && [0, 6].includes(new Date(`${fecha}T12:00:00Z`).getUTCDay()));
    assert.equal(delFinde.flatMap(([, cosas]) => cosas).length, 2);
    // Dos feriados el mismo domingo son dos cosas
    const dosFeriados = deNoviembre({ feriados: [FERIADO_DEL_EMPLEADO, { ...FERIADO_DEL_EMPLEADO, id: 5, nombre: 'Otro feriado' }] });
    assert.equal(M.cuantasEnElFinde('2026-11', dosFeriados), 2);
    assert.equal(M.cuantasEnElFinde('2026-11', deNoviembre({ feriados: [FERIADO_SOBERANIA] })), 0);
    for (const raro of [null, undefined, 'x', {}, { eventos: 'x', feriados: [null, { fecha: 'raro' }] }]) {
      assert.equal(M.cuantasEnElFinde('2026-11', raro), 0, JSON.stringify(raro));
    }
    for (const raro of ['2026-13', '', null, 'noviembre']) assert.equal(M.cuantasEnElFinde(raro, conGuardias), 0, String(raro));
  });

  it('diaVisibleCercano: la fecha si se ve; si no, el primer día visible que la sigue o, si no hay, el último que la precede', () => {
    const noviembre = M.semanasDelMes('2026-11', { finde: false });
    const octubre = M.semanasDelMes('2026-10', { finde: false });
    assert.equal(M.diaVisibleCercano('2026-11-01', noviembre), '2026-11-02');
    assert.equal(M.diaVisibleCercano('2026-10-31', octubre), '2026-10-30');
    assert.equal(M.diaVisibleCercano('2026-11-07', noviembre), '2026-11-09');
    assert.equal(M.diaVisibleCercano('2026-11-04', noviembre), '2026-11-04');
    assert.equal(M.diaVisibleCercano('2026-08-01', M.semanasDelMes('2026-08', { finde: false })), '2026-08-03');
    // Con sábado y domingo, la misma fecha
    assert.equal(M.diaVisibleCercano('2026-11-01', M.semanasDelMes('2026-11', { finde: true })), '2026-11-01');
    assert.equal(M.diaVisibleCercano('2026-10-31', M.semanasDelMes('2026-10', { finde: true })), '2026-10-31');
    // Fuera de la grilla, el primero o el último
    assert.equal(M.diaVisibleCercano('2026-09-15', noviembre), '2026-11-02');
    assert.equal(M.diaVisibleCercano('2027-01-01', noviembre), '2026-12-04');
    for (const raro of ['2026-02-30', '', null, 'hoy']) assert.equal(M.diaVisibleCercano(raro, noviembre), null, String(raro));
    for (const raro of [[], null, 'x', [[]], [null]]) assert.equal(M.diaVisibleCercano('2026-11-01', raro), null, JSON.stringify(raro));
  });

  // spec 3.2: apagado, el botón dice cuántas cosas quedaron escondidas el fin de semana; sin ninguna, su nombre es su texto
  it('etiquetaDelFinDeSemana: «Sábado y domingo: 1 cosa escondida», «… 3 cosas escondidas»; sin ninguna, ""', () => {
    assert.equal(M.etiquetaDelFinDeSemana(1), 'Sábado y domingo: 1 cosa escondida');
    assert.equal(M.etiquetaDelFinDeSemana(3), 'Sábado y domingo: 3 cosas escondidas');
    for (const raro of [0, -1, 1.5, '2', null, undefined, NaN]) assert.equal(M.etiquetaDelFinDeSemana(raro), '', String(raro));
  });

  // spec 4.1 y decisión 9.5: el tabindex móvil de los números (las flechas, Inicio y Fin)
  it('diaConLaTecla: las flechas de día en día y de semana en semana, Inicio y Fin en la fila; en el borde, la misma fecha', () => {
    const octubre = M.semanasDelMes('2026-10', { finde: false });
    const tecla = (fecha, nombre, semanas = octubre) => M.diaConLaTecla(fecha, nombre, semanas);
    // De día en día: del viernes al lunes (sábado y domingo ocultos), y al revés
    assert.equal(tecla('2026-10-28', 'ArrowRight'), '2026-10-29');
    assert.equal(tecla('2026-10-02', 'ArrowRight'), '2026-10-05');
    assert.equal(tecla('2026-10-05', 'ArrowLeft'), '2026-10-02');
    // De semana en semana, en la misma columna
    assert.equal(tecla('2026-10-21', 'ArrowDown'), '2026-10-28');
    assert.equal(tecla('2026-10-07', 'ArrowUp'), '2026-09-30');
    // Inicio y Fin: el primero y el último de la fila
    assert.equal(tecla('2026-10-28', 'Home'), '2026-10-26');
    assert.equal(tecla('2026-10-28', 'End'), '2026-10-30');
    assert.equal(tecla('2026-10-26', 'Home'), '2026-10-26');
    // En el borde de la grilla, no se mueve
    assert.equal(tecla('2026-10-30', 'ArrowRight'), '2026-10-30');
    assert.equal(tecla('2026-09-28', 'ArrowLeft'), '2026-09-28');
    assert.equal(tecla('2026-10-28', 'ArrowDown'), '2026-10-28');
    assert.equal(tecla('2026-09-30', 'ArrowUp'), '2026-09-30');
    // Con sábado y domingo: el viernes 30 sigue en el sábado 31 y Fin va al domingo 1/11; en noviembre, el 28/10 es de la primera
    // fila y abajo está el 04/11
    const conFinde = M.semanasDelMes('2026-10', { finde: true });
    assert.equal(tecla('2026-10-30', 'ArrowRight', conFinde), '2026-10-31');
    assert.equal(tecla('2026-10-26', 'End', conFinde), '2026-11-01');
    assert.equal(tecla('2026-10-28', 'ArrowDown', M.semanasDelMes('2026-11', { finde: true })), '2026-11-04');
    // Otra tecla, una fecha que no se ve o que no es una fecha, o unas semanas que no sirven: null
    for (const otra of ['Enter', ' ', 'a', 'PageDown', undefined]) assert.equal(tecla('2026-10-28', otra), null, String(otra));
    for (const fecha of ['2026-10-31', '2026-12-15', 'raro', null]) assert.equal(tecla(fecha, 'ArrowRight'), null, String(fecha));
    for (const raro of [[], null, 'x']) assert.equal(tecla('2026-10-28', 'ArrowRight', raro), null, JSON.stringify(raro));
  });
});

// El HTML del mes (spec 2026-10-28-mi-espacio-agenda-onda, 3.3 a 3.8 y 6): una tabla con una celda por día visible, y en cada día su
// número (un botón), su pedazo de cada barra, lo suyo con sus renglones y sus puntos (los del teléfono). Noviembre, con lo de
// DE_NOVIEMBRE; el jueves 5, con cuatro eventos (uno de Julián)
const DE_JULIAN = Object.freeze({
  creado_por: 2, creador: 'Julián Esteban Ferreyra', compartido: 1,
  personas: [{ id: 1, nombre: 'Andrea Paula Molina', sin_recordatorio: 0 }]
});
const CUATRO_EL_5 = Object.freeze([
  eventoDe(71, 'Primera', '2026-11-05', '08:00'), eventoDe(72, 'Segunda', '2026-11-05', '09:00'),
  eventoDe(73, 'Tercera', '2026-11-05', '10:00', DE_JULIAN), eventoDe(74, 'Cuarta', '2026-11-05', '11:00')
]);
const NOVIEMBRE_LLENO = deNoviembre({ eventos: [...EVENTOS_DE_PRUEBA, ...CUATRO_EL_5] });
// Un nombre y un título con HTML, en una sola palabra (el servidor deja la primera palabra del nombre)
const CON_HTML = '<b>&"';
const CON_HTML_ESCAPADO = '&lt;b&gt;&amp;&quot;';
// La celda de una fecha (por su data-fecha)
const celdaConFecha = (html, fecha) => celdasDe(html).find((celda) => celda.atributos['data-fecha'] === fecha);
// Las cabezas de las columnas: { hoy, texto }
const cabezasDe = (html) => [...html.matchAll(/<th scope="col"( class="hoy")?>([\s\S]*?)<\/th>/g)]
  .map(([, hoy, adentro]) => ({ hoy: hoy !== undefined, texto: textoDe(adentro) }));
// Los números de los días (sus botones; el elegido en el teléfono, con aria-current="true"): { fecha, tabindex, etiqueta, texto }
const numerosDe = (html) => [...html.matchAll(/<button type="button" class="me-num" data-dia="([^"]*)" tabindex="([^"]*)" aria-label="([^"]*)"(?: aria-current="true")?>([^<]*)<\/button>/g)]
  .map(([, fecha, tabindex, etiqueta, texto]) => ({ fecha, tabindex, etiqueta, texto }));
// La fecha del único número con tabindex="0"
const enFocoDe = (html) => numerosDe(html).filter((numero) => numero.tabindex === '0').map((numero) => numero.fecha);
// Los pedazos de barra de un HTML (la etiqueta que abre cada uno): { clases, atributos }
const barrasDelHtml = (html) => [...html.matchAll(/<span class="me-tira((?: [^"]*)?)"([^>]*)>/g)]
  .map(([, clases, atributos]) => ({ clases: `me-tira${clases}`.split(' '), atributos: atributosDe(atributos) }));
// Los renglones de lo que se ve en una celda (sin lo de «y N más»)
const renglonesDeLaCelda = (celda) => [...celda.html.replace(/<div class="me-resto" hidden>[\s\S]*?<\/div>/, '').matchAll(/data-lineas="([^"]*)"/g)]
  .map(([, lineas]) => lineas);
const ICONO = (clase) => M.ICONOS_DEL_MES[clase];

describe('la agenda: el HTML del mes', () => {
  // Desde el evento Personal (Público) (spec 2026-10-29-mi-espacio-evento-publico, 5.1), también el ojo (Lucide «eye»: «lo ven
  // otros»), el de un Público tuyo y el de uno de otra persona ('publico-otro', el mismo)
  it('ICONOS_DEL_MES: la bandera, el sol, la persona, las dos personas y el ojo, decorativos; lo que es solo tuyo, sin ícono', () => {
    assert.ok(Object.isFrozen(M.ICONOS_DEL_MES));
    assert.deepEqual(Object.keys(M.ICONOS_DEL_MES).sort(), ['ausente', 'compartido', 'feriado', 'licencia', 'ojo', 'propio', 'publico-otro']);
    assert.equal(M.ICONOS_DEL_MES.propio, '');
    for (const clase of ['feriado', 'licencia', 'ausente', 'compartido', 'ojo', 'publico-otro']) {
      const icono = M.ICONOS_DEL_MES[clase];
      assert.match(icono, /^<svg [^>]*>[\s\S]*<\/svg>$/, clase);
      const atributos = atributosDe(icono.match(/^<svg([^>]*)>/)[1]);
      assert.equal(atributos['aria-hidden'], 'true', clase);
      assert.equal(atributos.class, 'me-icono', clase);
      assert.equal(atributos.viewBox, '0 0 24 24', clase);
    }
    // Los de Lucide: flag, sun, user y users (el de «Todos» del formulario)
    assert.ok(M.ICONOS_DEL_MES.feriado.includes('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>'));
    assert.ok(M.ICONOS_DEL_MES.licencia.includes('<circle cx="12" cy="12" r="4"/>'));
    assert.ok(M.ICONOS_DEL_MES.ausente.includes('<circle cx="12" cy="7" r="4"/>'));
    assert.ok(M.ICONOS_DEL_MES.compartido.includes('<path d="M16 3.13a4 4 0 0 1 0 7.75"/>'));
    assert.ok(M.ICONOS_DEL_MES.ojo.includes('<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>'));
    assert.ok(M.ICONOS_DEL_MES.ojo.includes('<circle cx="12" cy="12" r="3"/>'));
    // El de un Público de otra persona es el ojo, el mismo de la vista previa del formulario
    assert.equal(M.ICONOS_DEL_MES['publico-otro'], M.ICONOS_DEL_MES.ojo);
    assert.equal(M.ICONOS_DEL_MES.ojo, M.ICONO_DEL_OJO);
    assert.equal(new Set(['feriado', 'licencia', 'ausente', 'compartido', 'ojo'].map(ICONO)).size, 5);
  });

  it('htmlDelMes: de entrada, de lunes a viernes (5 columnas); con sábado y domingo, 7; la cabeza de hoy, solo si hoy se ve', () => {
    const octubre = M.htmlDelMes('2026-10', DEL_MES, HOY);
    assert.match(octubre, /^<table class="me-mes" aria-labelledby="ag-mes-titulo"><thead><tr><th scope="col"/);
    assert.ok(octubre.endsWith('</tr></tbody></table>'));
    const largos = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    const cortos = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const cabezas = (cuantas, deHoy) => cortos.slice(0, cuantas).map((corto, i) => ({ hoy: i === deHoy, texto: `${corto} ${largos[i]}` }));
    assert.deepEqual(cabezasDe(octubre), cabezas(5, 0));
    assert.ok(octubre.includes('<th scope="col" class="hoy"><span aria-hidden="true">Lun</span><span class="visualmente-oculto">lunes</span></th>'));
    // Las filas: las de semanasDelMes, cada una con sus días
    const semanas = (mes, finde) => fechasDeLasSemanas(M.semanasDelMes(mes, { finde }));
    const filas = (html) => [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].slice(1)
      .map(([, fila]) => celdasDe(fila).map((celda) => celda.atributos['data-fecha']));
    assert.deepEqual(filas(octubre), semanas('2026-10', false));
    const conFinde = M.htmlDelMes('2026-10', DEL_MES, HOY, { finde: true });
    assert.deepEqual(cabezasDe(conFinde), cabezas(7, 0));
    assert.deepEqual(filas(conFinde), semanas('2026-10', true));
    assert.equal(celdasDe(conFinde).length, 35);
    // En noviembre, hoy (el lunes 26/10) no se ve sin sábado y domingo; con ellos, la primera fila es la suya
    assert.deepEqual(cabezasDe(M.htmlDelMes('2026-11', DE_NOVIEMBRE, HOY)), cabezas(5, null));
    assert.deepEqual(filas(M.htmlDelMes('2026-11', DE_NOVIEMBRE, HOY)), semanas('2026-11', false));
    assert.deepEqual(cabezasDe(M.htmlDelMes('2026-11', DE_NOVIEMBRE, HOY, { finde: true })), cabezas(7, 0));
    // Hoy un sábado, con sábado y domingo ocultos: ninguna cabeza; a la vista, la del sábado
    assert.deepEqual(cabezasDe(M.htmlDelMes('2026-10', DEL_MES, '2026-10-31')), cabezas(5, null));
    assert.deepEqual(cabezasDe(M.htmlDelMes('2026-10', DEL_MES, '2026-10-31', { finde: true })), cabezas(7, 5));
    // Sin datos (mientras se piden), la grilla sin nada adentro; un mes que no sirve, ''
    const vacio = M.htmlDelMes('2026-10', null, HOY);
    assert.equal(celdasDe(vacio).length, 25);
    assert.doesNotMatch(vacio, /me-ev|me-tira|me-carriles|me-mas/);
    for (const raro of ['raro', '2026-13', '', null, undefined]) assert.equal(M.htmlDelMes(raro, DEL_MES, HOY), '', String(raro));
  });

  it('htmlDelMes: cada celda con su fecha, su número y sus marcas: otro mes, finde, feriado, hoy, los días del mes que pasaron y el elegido', () => {
    const html = M.htmlDelMes('2026-10', DEL_MES, HOY, { finde: true, elegido: '2026-10-22' });
    const dias = plano(M.diasDeLaGrilla('2026-10'));
    const celdas = celdasDe(html);
    assert.equal(celdas.length, dias.length);
    celdas.forEach((celda, i) => {
      const dia = dias[i];
      assert.equal(celda.atributos['data-fecha'], dia.fecha);
      assert.ok(celda.html.startsWith(`<div class="me-celda-cuerpo"><button type="button" class="me-num" data-dia="${dia.fecha}" tabindex="`), dia.fecha);
      assert.match(celda.html, /<div class="me-cosas">[\s\S]*<\/div><span class="me-puntos" aria-hidden="true">[^]*<\/span><\/div>$/, dia.fecha);
      const marcas = ['me-celda', !dia.del_mes && 'otro-mes', dia.finde && 'finde', dia.fecha === '2026-10-12' && 'feriado', dia.fecha === HOY && 'hoy',
        dia.del_mes && dia.fecha < HOY && 'paso', dia.fecha === '2026-10-22' && 'elegido'].filter(Boolean);
      assert.deepEqual(celda.clases, marcas, dia.fecha);
      assert.equal(celda.atributos['aria-current'], dia.fecha === HOY ? 'date' : undefined, dia.fecha);
    });
    assert.deepEqual(celdaConFecha(html, HOY).clases, ['me-celda', 'hoy']);
    assert.deepEqual(celdaConFecha(html, '2026-10-12').clases, ['me-celda', 'feriado', 'paso']);
    assert.deepEqual(celdaConFecha(html, '2026-10-22').clases, ['me-celda', 'paso', 'elegido']);
    assert.deepEqual(celdaConFecha(html, '2026-09-30').clases, ['me-celda', 'otro-mes']);
    assert.deepEqual(celdaConFecha(html, '2026-10-31').clases, ['me-celda', 'finde']);
    assert.deepEqual(celdaConFecha(html, '2026-11-01').clases, ['me-celda', 'otro-mes', 'finde']);
    assert.equal([...html.matchAll(/aria-current="date"/g)].length, 1);
    // El número: un botón por día, con el día a la vista y «Nuevo evento el jueves 22/10» (diaLargo del servidor)
    const numeros = numerosDe(html);
    assert.deepEqual(numeros.map((numero) => numero.fecha), dias.map((dia) => dia.fecha));
    for (const numero of numeros) {
      assert.equal(numero.texto, String(Number(numero.fecha.slice(8, 10))), numero.fecha);
      assert.equal(numero.etiqueta, `Nuevo evento el ${diaLargo(numero.fecha)}`, numero.fecha);
    }
    assert.ok(html.includes('<button type="button" class="me-num" data-dia="2026-10-22" tabindex="-1" aria-label="Nuevo evento el jueves 22/10">22</button>'));
    // Un elegido que no se ve no marca nada; uno que no es una fecha, tampoco
    for (const elegido of ['2026-10-31', 'raro', 22]) assert.ok(!M.htmlDelMes('2026-10', DEL_MES, HOY, { elegido }).includes('elegido'), String(elegido));
    // Con un hoy que no sirve, ningún día pasó ni es hoy
    const sinHoy = M.htmlDelMes('2026-10', DEL_MES, 'raro');
    assert.doesNotMatch(sinHoy, / paso"| hoy"|aria-current|class="hoy"/);
  });

  // Ruling 4 del plan: el mes es una sola parada del tabulador
  it('htmlDelMes: un solo tabindex="0" en el mes: el del foco si se ve; si no, hoy si es del mes, o el 1 (el día visible más cercano)', () => {
    const cuantos = (html) => [...html.matchAll(/tabindex="0"/g)].length;
    const octubre = M.htmlDelMes('2026-10', DEL_MES, HOY);
    assert.deepEqual(enFocoDe(octubre), [HOY]);
    assert.equal(cuantos(octubre), 1);
    assert.ok(numerosDe(octubre).every((numero) => ['0', '-1'].includes(numero.tabindex)));
    assert.equal(numerosDe(octubre).length, celdasDe(octubre).length);
    assert.deepEqual(enFocoDe(M.htmlDelMes('2026-10', DEL_MES, HOY, { foco: '2026-10-22' })), ['2026-10-22']);
    // Un foco que no se ve (el sábado 31 con sábado y domingo ocultos, un día de otra grilla) o que no es una fecha: hoy
    for (const foco of ['2026-10-31', '2026-12-15', 'raro', 22, null]) {
      const html = M.htmlDelMes('2026-10', DEL_MES, HOY, { foco });
      assert.deepEqual(enFocoDe(html), [HOY], String(foco));
      assert.equal(cuantos(html), 1, String(foco));
    }
    assert.deepEqual(enFocoDe(M.htmlDelMes('2026-10', DEL_MES, HOY, { finde: true, foco: '2026-10-31' })), ['2026-10-31']);
    // Un foco del mes vecino que se ve en la grilla, también
    assert.deepEqual(enFocoDe(M.htmlDelMes('2026-10', DEL_MES, HOY, { foco: '2026-09-29' })), ['2026-09-29']);
    // En noviembre, hoy no es del mes: el 1, un domingo, que sin sábado y domingo no se ve: el lunes 2
    assert.deepEqual(enFocoDe(M.htmlDelMes('2026-11', DE_NOVIEMBRE, HOY)), ['2026-11-02']);
    assert.deepEqual(enFocoDe(M.htmlDelMes('2026-11', DE_NOVIEMBRE, HOY, { finde: true })), ['2026-11-01']);
    // Hoy un sábado, con sábado y domingo ocultos: el viernes 30 (no hay un día visible después en la grilla)
    assert.deepEqual(enFocoDe(M.htmlDelMes('2026-10', DEL_MES, '2026-10-31')), ['2026-10-30']);
    // Sin un hoy que sirva, el 1
    assert.deepEqual(enFocoDe(M.htmlDelMes('2026-10', DEL_MES, 'raro')), ['2026-10-01']);
  });

  it('htmlDelMes: las barras, un pedazo en cada día; el texto a la vista al principio del tramo, con su ícono y --n, y oculto en los demás', () => {
    const html = M.htmlDelMes('2026-11', DE_NOVIEMBRE, HOY);
    const carrilesDel = (fecha) => celdaConFecha(html, fecha).html.match(/<div class="me-carriles">[\s\S]*?<\/span><\/div>/)?.[0];
    const oculto = (clases, titulo, texto) => `<span class="me-tira ${clases}" title="${titulo}"><span class="visualmente-oculto">${texto}</span></span>`;
    const aLaVista = (clases, titulo, texto, largo, icono) => `<span class="me-tira ${clases}" title="${titulo}" style="--n:${largo}">`
      + `${ICONO(icono)}<span class="me-tira-texto">${texto}</span></span>`;
    const vacia = '<span class="me-tira vacia"></span>';
    // La semana del 2: dos carriles (tus vacaciones y los compañeros); el lunes 2, los dos vacíos
    assert.equal(carrilesDel('2026-11-02'), `<div class="me-carriles">${vacia}${vacia}</div>`);
    assert.equal(carrilesDel('2026-11-03'), `<div class="me-carriles">${aLaVista('licencia inicio', VACACIONES_DEL_3, 'Vacaciones', 4, 'licencia')}`
      + `${aLaVista('ausente inicio', JULIAN_HASTA_EL_6, 'Julián no está', 2, 'ausente')}</div>`);
    assert.equal(carrilesDel('2026-11-04'), `<div class="me-carriles">${oculto('licencia', VACACIONES_DEL_3, 'Vacaciones')}`
      + `${oculto('ausente fin', JULIAN_HASTA_EL_6, 'Julián no está')}</div>`);
    // El 5, «Carla y Julián no están» a la vista; el 6, el mismo texto para el lector de pantalla
    assert.equal(carrilesDel('2026-11-05'), `<div class="me-carriles">${oculto('licencia', VACACIONES_DEL_3, 'Vacaciones')}`
      + `${aLaVista('ausente inicio', CARLA_Y_JULIAN, 'Carla y Julián no están', 2, 'ausente')}</div>`);
    assert.equal(carrilesDel('2026-11-06'), `<div class="me-carriles">${oculto('licencia fin sigue-despues', VACACIONES_DEL_3, 'Vacaciones')}`
      + `${oculto('ausente fin', CARLA_Y_JULIAN, 'Carla y Julián no están')}</div>`);
    // El 9, las vacaciones que vienen del viernes (un día) y Carla, que empieza
    assert.equal(carrilesDel('2026-11-09'), `<div class="me-carriles">${aLaVista('licencia inicio fin sigue-antes', VACACIONES_DEL_3, 'Vacaciones', 1, 'licencia')}`
      + `${aLaVista('ausente inicio', CARLA_HASTA_EL_13, 'Carla no está', 5, 'ausente')}</div>`);
    // El 16, las vacaciones del 16 al 20 (5 días); el lunes 23 (feriado), su lugar vacío
    assert.equal(carrilesDel('2026-11-16'), `<div class="me-carriles">${aLaVista('licencia inicio', VACACIONES_DEL_16, 'Vacaciones', 5, 'licencia')}</div>`);
    assert.equal(carrilesDel('2026-11-23'), `<div class="me-carriles">${vacia}</div>`);
    // Cada día de una barra dice lo suyo: el texto, una vez en cada día de cada tramo
    for (const fecha of ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']) {
      assert.equal([...celdaConFecha(html, fecha).html.matchAll(/Carla no está</g)].length, 1, fecha);
    }
    // Una semana sin licencias ni compañeros no tiene carriles; sin nada en el mes, ninguna barra
    assert.ok(!celdaConFecha(M.htmlDelMes('2026-10', DEL_MES, HOY), '2026-10-05').html.includes('me-carriles'));
    const sinNada = M.htmlDelMes('2026-11', deNoviembre({ licencias: [], ausencias: [] }), HOY);
    assert.doesNotMatch(sinNada, /me-carriles|me-tira/);
    // Las clases de la regla del Resumen (me-barra y me-muestra, con estilos globales en mi-espacio.html) no van en el mes, en el día
    // elegido ni en los próximos
    for (const otro of [html, M.htmlDelMes('2026-11', NOVIEMBRE_LLENO, HOY, { finde: true, animar: true, telefono: true }),
      M.htmlDelDiaElegido('2026-11-05', NOVIEMBRE_LLENO, HOY), M.htmlDeProximos(M.gruposDeProximos(PROXIMOS, HOY))]) {
      assert.doesNotMatch(otro, /me-barra|me-muestra/);
    }
  });

  it('htmlDelMes: los renglones de cada cosa (data-lineas) con los lugares que dejan los carriles, y «y N más»', () => {
    const datos = respuestaDeEventos({ desde: '2026-09-28', hasta: '2026-11-01' }, {
      eventos: [
        eventoDe(81, 'Uno', '2026-10-07', '09:00'),
        eventoDe(82, 'Dos', '2026-10-08', '09:00'), eventoDe(83, 'Dos más', '2026-10-08', '10:00'),
        eventoDe(84, 'Tres', '2026-10-09', '09:00'), eventoDe(85, 'Tres más', '2026-10-09', '10:00'), eventoDe(86, 'Tres y más', '2026-10-09', '11:00'),
        eventoDe(87, 'Con Martín afuera', '2026-10-26', '09:00')
      ],
      licencias: [], ausencias: [AUSENCIAS_DE_PRUEBA[0]]
    });
    const html = M.htmlDelMes('2026-10', datos, HOY);
    // Sin carriles (cuatro lugares): una cosa, 3 renglones; dos, 2 y 2; tres, uno cada una
    assert.deepEqual(renglonesDeLaCelda(celdaConFecha(html, '2026-10-07')), ['3']);
    assert.deepEqual(renglonesDeLaCelda(celdaConFecha(html, '2026-10-08')), ['2', '2']);
    assert.deepEqual(renglonesDeLaCelda(celdaConFecha(html, '2026-10-09')), ['1', '1', '1']);
    // Un carril (Martín, la semana del 26): una cosa, 3 renglones
    assert.deepEqual(renglonesDeLaCelda(celdaConFecha(html, '2026-10-26')), ['3']);
    assert.ok(celdaConFecha(html, '2026-10-07').html.includes('<div class="me-cosas"><button type="button" class="me-ev propio" data-lineas="3" '
      + 'data-evento="81" title="09:00 Uno"><b>09:00</b> Uno</button></div>'));
    // Dos carriles (la semana del 2 de noviembre): una cosa, 2 renglones
    assert.deepEqual(renglonesDeLaCelda(celdaConFecha(M.htmlDelMes('2026-11', NOVIEMBRE_LLENO, HOY), '2026-11-02')), ['2']);
    // El jueves 5, dos carriles y cuatro eventos: uno a la vista, de un renglón, y «y 3 más» con el resto
    const el5 = celdaConFecha(M.htmlDelMes('2026-11', NOVIEMBRE_LLENO, HOY), '2026-11-05');
    assert.deepEqual(el5.clases, ['me-celda']);
    assert.deepEqual(renglonesDeLaCelda(el5), ['1']);
    assert.equal(el5.html, '<div class="me-celda-cuerpo">'
      + '<button type="button" class="me-num" data-dia="2026-11-05" tabindex="-1" aria-label="Nuevo evento el jueves 05/11">5</button>'
      + '<div class="me-carriles"><span class="me-tira licencia" title="Vacaciones. Hasta el lunes 09/11"><span class="visualmente-oculto">Vacaciones</span></span>'
      + `<span class="me-tira ausente inicio" title="${CARLA_Y_JULIAN}" style="--n:2">${ICONO('ausente')}<span class="me-tira-texto">Carla y Julián no están</span></span></div>`
      + '<div class="me-cosas"><button type="button" class="me-ev propio" data-lineas="1" data-evento="71" title="08:00 Primera"><b>08:00</b> Primera</button>'
      + '<div class="me-resto" hidden>'
      + '<button type="button" class="me-ev propio" data-lineas="1" data-evento="72" title="09:00 Segunda"><b>09:00</b> Segunda</button>'
      + `<button type="button" class="me-ev compartido" data-lineas="1" data-evento="73" title="10:00 Tercera">${ICONO('compartido')}<b>10:00</b> Tercera</button>`
      + '<button type="button" class="me-ev propio" data-lineas="1" data-evento="74" title="11:00 Cuarta"><b>11:00</b> Cuarta</button></div>'
      + '<button type="button" class="me-mas" data-ver-mas="2026-11-05">y 3 más</button></div>'
      + '<span class="me-puntos" aria-hidden="true"><i class="propio"></i><i class="propio"></i><i class="compartido"></i><i class="propio"></i></span></div>');
    // El feriado, con la bandera; el 15 de UN_DIA_LLENO (dos carriles: la franquicia y Martín), el feriado a la vista y «y 2 más»
    const el15 = celdaConFecha(M.htmlDelMes('2026-10', UN_DIA_LLENO, HOY), '2026-10-15');
    assert.deepEqual(el15.clases, ['me-celda', 'feriado', 'paso']);
    assert.ok(el15.html.includes('<div class="me-cosas">'
      + `<span class="me-ev feriado" data-lineas="1" title="Feriado: Feriado de prueba">${ICONO('feriado')}Feriado: Feriado de prueba</span>`
      + '<div class="me-resto" hidden><button type="button" class="me-ev compartido" data-lineas="1" data-evento="32" title="09:00 Café con Catastro">'));
    assert.ok(el15.html.endsWith('<button type="button" class="me-mas" data-ver-mas="2026-10-15">y 2 más</button></div>'
      + '<span class="me-puntos" aria-hidden="true"><i class="feriado"></i><i class="compartido"></i><i class="propio"></i></span></div>'));
    // Con tres justas y lugar para ellas, ningún «más»; un día sin nada, sus cosas y sus puntos vacíos
    assert.ok(!celdaConFecha(html, '2026-10-09').html.includes('me-mas'));
    assert.ok(celdaConFecha(html, '2026-10-05').html.endsWith('<div class="me-cosas"></div><span class="me-puntos" aria-hidden="true"></span></div>'));
  });

  // Ruling 2 del plan: --n siempre en el principio de un tramo; --demora, solo con el movimiento
  it('htmlDelMes: con animar, cada pedazo de barra (salvo los vacíos) con su --demora (semana × 0,16 s + columna × 0,05 s); sin animar, ninguna', () => {
    const animado = M.htmlDelMes('2026-11', DE_NOVIEMBRE, HOY, { animar: true });
    const piezas = barrasDelHtml(animado);
    assert.ok(piezas.length > 0);
    for (const pieza of piezas) {
      if (pieza.clases.includes('vacia')) assert.equal(pieza.atributos.style, undefined);
      else {
        const conLargo = pieza.clases.includes('inicio') ? '--n:\\d+;' : '';
        assert.match(pieza.atributos.style, new RegExp(`^${conLargo}--demora:\\d\\.\\d\\ds$`), JSON.stringify(pieza));
      }
    }
    // El 5 (semana 0, columna 3), el 9 (1, 0), el 16 (2, 0) y el 24 (3, 1)
    const estilos = (fecha) => barrasDelHtml(celdaConFecha(animado, fecha).html).map((pieza) => pieza.atributos.style);
    assert.deepEqual(estilos('2026-11-05'), ['--demora:0.15s', '--n:2;--demora:0.15s']);
    assert.deepEqual(estilos('2026-11-09'), ['--n:1;--demora:0.16s', '--n:5;--demora:0.16s']);
    assert.deepEqual(estilos('2026-11-16'), ['--n:5;--demora:0.32s']);
    assert.deepEqual(estilos('2026-11-24'), ['--n:4;--demora:0.53s']);
    assert.deepEqual(estilos('2026-11-23'), [undefined]);
    // Sin animar (o con algo que no es el true literal): ningún --demora, y --n en cada principio de tramo y en ningún otro
    for (const opciones of [{}, { animar: false }, { animar: 'si' }, { animar: 1 }]) {
      const quieto = M.htmlDelMes('2026-11', DE_NOVIEMBRE, HOY, opciones);
      assert.ok(!quieto.includes('--demora'), JSON.stringify(opciones));
      for (const pieza of barrasDelHtml(quieto)) {
        if (pieza.clases.includes('inicio')) assert.match(pieza.atributos.style, /^--n:\d+$/);
        else assert.equal(pieza.atributos.style, undefined);
      }
      assert.equal([...quieto.matchAll(/--n:/g)].length, barrasDelHtml(quieto).filter((pieza) => pieza.clases.includes('inicio')).length);
    }
  });

  it('htmlDelMes: en el teléfono, el número dice «Ver el lunes 02/11»', () => {
    const html = M.htmlDelMes('2026-11', DE_NOVIEMBRE, HOY, { telefono: true });
    assert.ok(html.includes('<button type="button" class="me-num" data-dia="2026-11-02" tabindex="0" aria-label="Ver el lunes 02/11">2</button>'));
    for (const numero of numerosDe(html)) assert.equal(numero.etiqueta, `Ver el ${diaLargo(numero.fecha)}`, numero.fecha);
    // Solo el true literal
    for (const telefono of ['si', 1]) assert.ok(!M.htmlDelMes('2026-11', DE_NOVIEMBRE, HOY, { telefono }).includes('aria-label="Ver el'), String(telefono));
  });

  // Revisión final, 3: en el teléfono, lo de cada día (.me-cosas) no se ve y los puntos van con aria-hidden: el día elegido es lo único
  // que un lector de pantalla tiene de un día, y el anillo del elegido es solo visual. Su número lo dice con aria-current="true"
  it('htmlDelMes: en el teléfono, el número del día elegido (solo ese) con aria-current="true"; en la compu, ninguno; hoy sigue con aria-current="date"', () => {
    const actuales = (html) => [...html.matchAll(/<button type="button" class="me-num" data-dia="([^"]*)"[^>]*aria-current="true"[^>]*>/g)].map(([, fecha]) => fecha);
    const telefono = M.htmlDelMes('2026-10', DEL_MES, HOY, { telefono: true, elegido: '2026-10-22' });
    assert.deepEqual(actuales(telefono), ['2026-10-22']);
    assert.equal([...telefono.matchAll(/aria-current="true"/g)].length, 1);
    assert.ok(telefono.includes('<button type="button" class="me-num" data-dia="2026-10-22" tabindex="-1" aria-label="Ver el jueves 22/10" aria-current="true">22</button>'));
    // La celda de hoy conserva el suyo (y su número no lleva el del elegido)
    assert.equal(celdaConFecha(telefono, HOY).atributos['aria-current'], 'date');
    assert.equal([...telefono.matchAll(/aria-current="date"/g)].length, 1);
    // Elegido hoy: la celda con «date» y su número con «true»
    const elegidoHoy = M.htmlDelMes('2026-10', DEL_MES, HOY, { telefono: true, elegido: HOY });
    assert.deepEqual(actuales(elegidoHoy), [HOY]);
    assert.equal(celdaConFecha(elegidoHoy, HOY).atributos['aria-current'], 'date');
    // En la compu (o con algo que no es el true literal), ninguno; sin elegido, o con uno que no se ve, tampoco
    for (const opciones of [{ elegido: '2026-10-22' }, { telefono: false, elegido: '2026-10-22' }, { telefono: 'si', elegido: '2026-10-22' },
      { telefono: true }, { telefono: true, elegido: '2026-10-31' }, { telefono: true, elegido: 'raro' }]) {
      assert.doesNotMatch(M.htmlDelMes('2026-10', DEL_MES, HOY, opciones), /aria-current="true"/, JSON.stringify(opciones));
    }
    // numerosDe los lee igual
    assert.equal(numerosDe(telefono).length, celdasDe(telefono).length);
  });

  it('htmlDelMes: con tres argumentos, lo de entrada (sin sábado y domingo, sin elegido ni foco, en la compu y quieto)', () => {
    const tres = M.htmlDelMes('2026-10', DEL_MES, HOY);
    for (const opciones of [undefined, {}, null, 'x', 5, { finde: false, elegido: null, foco: null, telefono: false, animar: false }]) {
      assert.equal(M.htmlDelMes('2026-10', DEL_MES, HOY, opciones), tres, JSON.stringify(opciones));
    }
  });

  // Review Focus 2: el HTML de un título o de un nombre es texto, también en el title y en lo oculto
  it('htmlDelMes: un título, un feriado y un nombre con HTML se ven escapados, en el texto, en el title y en lo oculto', () => {
    const datos = deNoviembre({
      eventos: [eventoDe(91, `${CON_HTML} y más`, '2026-11-04', '10:00'), eventoDe(92, MALICIOSO, '2026-11-11', '10:00')],
      licencias: [],
      ausencias: [{ nombre: CON_HTML, desde: '2026-11-03', hasta: '2026-11-04' }, { nombre: MALICIOSO_EN_UNA_PALABRA, desde: '2026-11-10', hasta: '2026-11-10' }],
      feriados: [{ ...FERIADO_DEL_EMPLEADO, fecha: '2026-11-12', nombre: CON_HTML }]
    });
    const html = M.htmlDelMes('2026-11', datos, HOY);
    assert.ok(!html.includes('<img') && !html.includes('<b>&'));
    const titulo = `title="${CON_HTML_ESCAPADO} no está. Hasta el miércoles 04/11."`;
    assert.ok(celdaConFecha(html, '2026-11-03').html.includes(`<span class="me-tira ausente inicio" ${titulo} style="--n:2">${ICONO('ausente')}`
      + `<span class="me-tira-texto">${CON_HTML_ESCAPADO} no está</span></span>`));
    assert.ok(celdaConFecha(html, '2026-11-04').html.includes(`<span class="me-tira ausente fin" ${titulo}>`
      + `<span class="visualmente-oculto">${CON_HTML_ESCAPADO} no está</span></span>`));
    assert.ok(html.includes(`<button type="button" class="me-ev propio" data-lineas="3" data-evento="91" title="10:00 ${CON_HTML_ESCAPADO} y más">`
      + `<b>10:00</b> ${CON_HTML_ESCAPADO} y más</button>`));
    assert.ok(html.includes(`data-evento="92" title="10:00 ${ESCAPADO}"><b>10:00</b> ${ESCAPADO}</button>`));
    assert.ok(html.includes(`<span class="me-ev feriado" data-lineas="3" title="Feriado: ${CON_HTML_ESCAPADO}">${ICONO('feriado')}Feriado: ${CON_HTML_ESCAPADO}</span>`));
    assert.ok(html.includes(`<span class="me-tira-texto">${ESCAPADO_EN_UNA_PALABRA} no está</span>`));
  });

  it('htmlDelMes: nada que se vuelve a dibujar es una región viva', () => {
    for (const html of [M.htmlDelMes('2026-10', DEL_MES, HOY), M.htmlDelMes('2026-11', NOVIEMBRE_LLENO, HOY, { finde: true, animar: true, telefono: true }),
      M.htmlDelDiaElegido('2026-11-05', NOVIEMBRE_LLENO, HOY)]) {
      assert.doesNotMatch(html, /aria-live|role="status"|role="alert"/);
    }
  });

  it('htmlDelDiaElegido: la fecha (hoy), «Nuevo evento» con esa fecha y la lista de ese día, con los eventos como botones', () => {
    assert.match(M.ICONO_DE_MAS, /^<svg [^>]*aria-hidden="true"[^>]*>[\s\S]*<\/svg>$/);
    assert.equal(M.htmlDelDiaElegido('2026-10-28', DE_NOVIEMBRE, '2026-10-28'),
      '<div class="me-elegido-cabeza"><h3 id="ag-elegido-titulo">Miércoles 28 de octubre (hoy)</h3>'
      + `<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-nuevo-el="2026-10-28">${M.ICONO_DE_MAS}Nuevo evento</button></div>`
      + '<ul class="me-elegido-lista"><li class="me-fila-del-dia propio"><button type="button" class="me-elegido-cosa" data-evento="13">'
      + '<span class="me-elegido-icono" aria-hidden="true"><i></i></span><span class="me-elegido-hora">15:30</span> '
      + '<span class="me-elegido-texto">Turno médico <small>Solo vos</small></span></button></li></ul>');
    // Otro día, sin «(hoy)»; sin nada, «No hay nada este día.»
    assert.equal(M.htmlDelDiaElegido('2026-11-02', deNoviembre({ eventos: [] }), HOY),
      '<div class="me-elegido-cabeza"><h3 id="ag-elegido-titulo">Lunes 2 de noviembre</h3>'
      + `<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-nuevo-el="2026-11-02">${M.ICONO_DE_MAS}Nuevo evento</button></div>`
      + '<p class="me-vacio">No hay nada este día.</p>');
  });

  it('htmlDelDiaElegido: los feriados, tu licencia y los compañeros, «Todo el día», y después los eventos por hora', () => {
    const datos = respuestaDeEventos(RANGO_DE_NOVIEMBRE, {
      eventos: [eventoDe(75, 'Revisar el informe', '2026-11-05', '16:00'), eventoDe(76, 'Café con Catastro', '2026-11-05', '09:00', DE_JULIAN)],
      licencias: [LICENCIAS_DE_PRUEBA[1]],
      ausencias: [{ nombre: 'Julián', desde: '2026-11-03', hasta: '2026-11-06' }, { nombre: 'Carla', desde: '2026-11-05', hasta: '2026-11-13' }],
      feriados: [{ ...FERIADO_DEL_EMPLEADO, fecha: '2026-11-05', nombre: 'Feriado de prueba' }]
    });
    const html = M.htmlDelDiaElegido('2026-11-05', datos, HOY);
    assert.ok(html.startsWith('<div class="me-elegido-cabeza"><h3 id="ag-elegido-titulo">Jueves 5 de noviembre</h3>'));
    assert.deepEqual(filasDe(html).map(({ clases, texto }) => ({ clases, texto })), [
      { clases: ['me-fila-del-dia', 'feriado'], texto: 'Todo el día Feriado: Feriado de prueba' },
      { clases: ['me-fila-del-dia', 'licencia'], texto: 'Todo el día Vacaciones' },
      { clases: ['me-fila-del-dia', 'ausente'], texto: 'Todo el día Carla y Julián no están' },
      { clases: ['me-fila-del-dia', 'compartido'], texto: '09:00 Café con Catastro De Julián' },
      { clases: ['me-fila-del-dia', 'propio'], texto: '16:00 Revisar el informe Solo vos' }
    ]);
    // Cada fila con su ícono (lo que es solo tuyo, un punto); lo de todo el día no es un botón
    const filas = filasDe(html);
    assert.ok(filas[0].html.startsWith(`<div class="me-elegido-cosa"><span class="me-elegido-icono" aria-hidden="true">${ICONO('feriado')}</span>`
      + '<span class="me-elegido-hora">Todo el día</span> <span class="me-elegido-texto">Feriado: Feriado de prueba</span></div>'));
    assert.ok(filas[1].html.includes(`<span class="me-elegido-icono" aria-hidden="true">${ICONO('licencia')}</span>`));
    assert.ok(filas[2].html.includes(`<span class="me-elegido-icono" aria-hidden="true">${ICONO('ausente')}</span>`));
    assert.ok(filas[3].html.startsWith('<button type="button" class="me-elegido-cosa" data-evento="76">'
      + `<span class="me-elegido-icono" aria-hidden="true">${ICONO('compartido')}</span>`));
    assert.deepEqual(botonesDe(html).map(({ atributos }) => atributos['data-evento'] ?? atributos['data-nuevo-el']), ['2026-11-05', '76', '75']);
    // Los compañeros, el texto del servidor de ese día; un día de feriado sin licencia ni compañeros (el domingo 8)
    assert.deepEqual(filasDe(M.htmlDelDiaElegido('2026-11-08', DE_NOVIEMBRE, HOY)).map((fila) => fila.texto),
      ['Todo el día Feriado: Día del Empleado Municipal']);
    assert.deepEqual(filasDe(M.htmlDelDiaElegido('2026-11-09', DE_NOVIEMBRE, HOY)).map((fila) => fila.texto),
      ['Todo el día Vacaciones', 'Todo el día Carla no está']);
  });

  it('htmlDelDiaElegido: lo del servidor, escapado; una fecha que no sirve, nada; sin datos, el día vacío', () => {
    const datos = deNoviembre({
      eventos: [eventoDe(93, MALICIOSO, '2026-11-04', '10:00', { ...DE_JULIAN, creador: MALICIOSO_EN_UNA_PALABRA })],
      ausencias: [{ nombre: CON_HTML, desde: '2026-11-04', hasta: '2026-11-04' }],
      feriados: [{ ...FERIADO_DEL_EMPLEADO, fecha: '2026-11-04', nombre: CON_HTML }], conFeriados: false
    });
    const html = M.htmlDelDiaElegido('2026-11-04', datos, HOY);
    assert.ok(!html.includes('<img') && !html.includes('<b>&'));
    assert.ok(html.includes(`<span class="me-elegido-texto">Feriado: ${CON_HTML_ESCAPADO}</span>`));
    assert.ok(html.includes(`<span class="me-elegido-texto">${CON_HTML_ESCAPADO} no está</span>`));
    assert.ok(html.includes(`<span class="me-elegido-texto">${ESCAPADO} <small>De ${ESCAPADO_EN_UNA_PALABRA}</small></span>`));
    for (const raro of ['raro', '2026-02-30', '', null, undefined, 20261104]) assert.equal(M.htmlDelDiaElegido(raro, datos, HOY), '', String(raro));
    // Con lo del mes, aunque venga raro, el día vacío
    for (const raro of [{}, { eventos: 'x', companeros_por_dia: [null] }]) {
      assert.ok(M.htmlDelDiaElegido('2026-11-04', raro, HOY).endsWith('<p class="me-vacio">No hay nada este día.</p>'), JSON.stringify(raro));
    }
  });

  // Revisión final, 2: sin lo del mes (mientras se pide, o si no se pudo cargar) no se sabe qué hay ese día: «No hay nada este día.»
  // aparecía un momento en cada cambio de mes y, si el mes fallaba, quedaba debajo de «No se pudo cargar el mes»
  it('htmlDelDiaElegido: sin lo del mes, solo el título (siempre: nombra la sección) y «Nuevo evento», sin lista ni «No hay nada este día.»', () => {
    const cabeza = '<div class="me-elegido-cabeza"><h3 id="ag-elegido-titulo">Miércoles 4 de noviembre</h3>'
      + `<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-nuevo-el="2026-11-04">${M.ICONO_DE_MAS}Nuevo evento</button></div>`;
    for (const sinDatos of [null, undefined, 'x', 5, true, ['eventos']]) {
      assert.equal(M.htmlDelDiaElegido('2026-11-04', sinDatos, HOY), cabeza, JSON.stringify(sinDatos));
    }
    assert.equal(M.htmlDelDiaElegido(HOY, null, HOY), '<div class="me-elegido-cabeza"><h3 id="ag-elegido-titulo">Lunes 26 de octubre (hoy)</h3>'
      + `<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-nuevo-el="${HOY}">${M.ICONO_DE_MAS}Nuevo evento</button></div>`);
  });

  // Revisión final, 3: el título del día elegido, solo (lo que se anuncia al elegir un día en el teléfono)
  it('tituloDelDiaElegido: «Jueves 22 de octubre», con « (hoy)» si es hoy; es el título del día elegido', () => {
    assert.equal(M.tituloDelDiaElegido('2026-10-22', HOY), 'Jueves 22 de octubre');
    assert.equal(M.tituloDelDiaElegido(HOY, HOY), 'Lunes 26 de octubre (hoy)');
    assert.equal(M.tituloDelDiaElegido('2026-11-01', HOY), 'Domingo 1 de noviembre');
    for (const raro of ['raro', '2026-02-30', '', null, undefined]) assert.equal(M.tituloDelDiaElegido(raro, HOY), '', String(raro));
    for (const fecha of ['2026-10-22', HOY, '2026-11-01']) {
      assert.ok(M.htmlDelDiaElegido(fecha, DE_NOVIEMBRE, HOY).startsWith(`<div class="me-elegido-cabeza"><h3 id="ag-elegido-titulo">${M.tituloDelDiaElegido(fecha, HOY)}</h3>`), fecha);
    }
  });
});

describe('la agenda: los próximos', () => {
  const GRUPOS = [
    { titulo: 'Hoy, lunes 26/10', items: [
      { hora: 'Todo el día', titulo: 'Martín Ríos no está', detalle: 'Hasta el viernes 30/10', clase: 'ausente' },
      { hora: '12:00', titulo: 'Llamar a Vialidad por el TMDA', detalle: 'Aviso 2 h antes', clase: 'propio', quien: 'Solo vos', evento_id: 11 }
    ] },
    { titulo: 'Mañana, martes 27/10', items: [
      { hora: '10:00', titulo: 'Reunión de equipo', detalle: 'Aviso 2 h antes', clase: 'compartido', quien: 'Con 4 personas', evento_id: 12 }
    ] },
    { titulo: 'Esta semana', items: [
      { hora: 'Mié 28', titulo: '15:30 Turno médico', detalle: 'Aviso el día hábil anterior', clase: 'propio', quien: 'Solo vos', evento_id: 13 },
      { hora: 'Jue 29', titulo: '09:00 Entrega del informe trimestral', detalle: 'Aviso 2 h antes', clase: 'compartido', quien: 'De Martín',
        evento_id: 14 },
      { hora: 'Vie 30', titulo: 'Sofía Paz no está', detalle: '', clase: 'ausente' }
    ] },
    { titulo: 'Más adelante', items: [
      { hora: 'Lun 02/11', titulo: '10:00 Reunión de equipo', detalle: 'Aviso 2 h antes', clase: 'compartido', quien: 'Con toda la administración',
        evento_id: 15 },
      { hora: 'Mar 03/11', titulo: 'Vacaciones', detalle: 'Hasta el lunes 09/11', clase: 'licencia' },
      { hora: 'Lun 23/11', titulo: 'Feriado: Día de la Soberanía Nacional', detalle: '', clase: 'feriado' }
    ] }
  ];

  it('gruposDeProximos: Hoy y Mañana con la hora (o «Todo el día»), Esta semana («Mié 28») y Más adelante («Mar 03/11»)', () => {
    assert.deepEqual(plano(M.gruposDeProximos(PROXIMOS, HOY)), GRUPOS);
  });

  it('gruposDeProximos: sin nada mañana, no hay ese grupo; sin nada, ninguno', () => {
    const sinManana = respuestaDeEventos({ desde: '2026-10-26', hasta: '2026-11-25' }, { eventos: EVENTOS_DE_PRUEBA.filter((evento) => evento.id !== 12) });
    assert.deepEqual(plano(M.gruposDeProximos(sinManana, HOY)).map((grupo) => grupo.titulo), ['Hoy, lunes 26/10', 'Esta semana', 'Más adelante']);
    assert.deepEqual(plano(M.gruposDeProximos({ eventos: [], licencias: [], feriados: [], ausentes: [] }, HOY)), []);
    for (const raro of [null, undefined, 'x', {}]) assert.deepEqual(plano(M.gruposDeProximos(raro, HOY)), [], String(raro));
    assert.deepEqual(plano(M.gruposDeProximos(PROXIMOS, 'raro')), []);
  });

  it('gruposDeProximos: un sábado, mañana es el domingo y no hay «Esta semana»; lo de antes de hoy y lo de después del rango no va', () => {
    const datos = {
      eventos: [
        { id: 51, titulo: 'Guardia', fecha: '2026-11-01', desde: '08:00', compartido: false, es_mio: true, quien_texto: 'Solo vos', aviso: { corto: 'Sin aviso' } },
        { id: 52, titulo: 'Reunión', fecha: '2026-11-02', desde: '10:00', compartido: false, es_mio: true, quien_texto: 'Solo vos', aviso: { corto: 'Aviso 1 h antes' } },
        { id: 53, titulo: 'Ya pasó', fecha: '2026-10-30', desde: '10:00', compartido: false, es_mio: true, quien_texto: 'Solo vos', aviso: { corto: '' } },
        { id: 54, titulo: 'Muy lejos', fecha: '2026-12-01', desde: '10:00', compartido: false, es_mio: true, quien_texto: 'Solo vos', aviso: { corto: '' } }
      ],
      ausentes: [{ nombre: 'Diego Fernández', desde: '2026-10-26', hasta: '2026-10-30', texto: 'Diego Fernández no está', hasta_texto: 'Hasta el viernes 30/10' }]
    };
    assert.deepEqual(plano(M.gruposDeProximos(datos, '2026-10-31')), [
      { titulo: 'Mañana, domingo 01/11', items: [
        { hora: '08:00', titulo: 'Guardia', detalle: 'Sin aviso', clase: 'propio', quien: 'Solo vos', evento_id: 51 }
      ] },
      { titulo: 'Más adelante', items: [
        { hora: 'Lun 02/11', titulo: '10:00 Reunión', detalle: 'Aviso 1 h antes', clase: 'propio', quien: 'Solo vos', evento_id: 52 }
      ] }
    ]);
  });

  it('htmlDeProximos: cada grupo con su título y cada cosa con la hora, el ícono, el título y el detalle; un evento es un botón con su id', () => {
    const html = M.htmlDeProximos(M.gruposDeProximos(PROXIMOS, HOY));
    assert.deepEqual([...html.matchAll(/<h3>([^<]*)<\/h3>/g)].map(([, titulo]) => titulo),
      ['Hoy, lunes 26/10', 'Mañana, martes 27/10', 'Esta semana', 'Más adelante']);
    assert.equal(textoDe(html), 'Hoy, lunes 26/10 Todo el día Martín Ríos no está Hasta el viernes 30/10 '
      + '12:00 Llamar a Vialidad por el TMDA Solo vos Aviso 2 h antes '
      + 'Mañana, martes 27/10 10:00 Reunión de equipo Con 4 personas Aviso 2 h antes '
      + 'Esta semana Mié 28 15:30 Turno médico Solo vos Aviso el día hábil anterior '
      + 'Jue 29 09:00 Entrega del informe trimestral De Martín Aviso 2 h antes Vie 30 Sofía Paz no está '
      + 'Más adelante Lun 02/11 10:00 Reunión de equipo Con toda la administración Aviso 2 h antes Mar 03/11 Vacaciones Hasta el lunes 09/11 '
      + 'Lun 23/11 Feriado: Día de la Soberanía Nacional');
    // El ícono de cada cosa, decorativo, adentro del título y antes del texto (lo que es solo tuyo, un punto)
    assert.ok(html.includes('<li class="me-prox propio"><span class="me-prox-hora">12:00</span>'
      + '<button type="button" class="me-prox-titulo" data-evento="11"><span class="me-prox-icono propio" aria-hidden="true"><i></i></span>'
      + 'Llamar a Vialidad por el TMDA</button>'
      + '<span class="me-prox-detalle"><span class="me-insignia azul">Solo vos</span>Aviso 2 h antes</span></li>'));
    assert.ok(html.includes('<span class="me-prox-detalle"><span class="me-insignia violeta">De Martín</span>Aviso 2 h antes</span>'));
    assert.ok(html.includes('<li class="me-prox ausente"><span class="me-prox-hora">Vie 30</span><span class="me-prox-titulo">'
      + `<span class="me-prox-icono ausente" aria-hidden="true">${ICONO('ausente')}</span>Sofía Paz no está</span></li>`));
    assert.ok(html.includes('data-evento="14"><span class="me-prox-icono compartido" aria-hidden="true">'
      + `${ICONO('compartido')}</span>09:00 Entrega del informe trimestral</button>`));
    assert.ok(html.includes(`<span class="me-prox-titulo"><span class="me-prox-icono licencia" aria-hidden="true">${ICONO('licencia')}</span>Vacaciones</span>`));
    assert.ok(html.includes('<span class="me-prox-titulo"><span class="me-prox-icono feriado" aria-hidden="true">'
      + `${ICONO('feriado')}</span>Feriado: Día de la Soberanía Nacional</span>`));
    // Uno en cada cosa, de su color
    assert.deepEqual(filasDe(html).map((fila) => [...fila.html.matchAll(/<span class="me-prox-icono ([^"]*)"/g)].map(([, clase]) => clase)),
      filasDe(html).map((fila) => [fila.clases[1]]));
    assert.deepEqual(botonesDe(html).map(({ atributos }) => atributos['data-evento']), ['11', '12', '13', '14', '15']);
    assert.doesNotMatch(html, /aria-live|role="/);
  });

  it('htmlDeProximos: sin nada, «No hay nada en los próximos 30 días.»', () => {
    for (const vacio of [[], null, undefined, [{ titulo: 'Hoy', items: [] }]]) {
      assert.equal(M.htmlDeProximos(vacio), '<p class="me-vacio">No hay nada en los próximos 30 días.</p>', String(vacio));
    }
  });

  // Review Focus 2
  it('htmlDeProximos: un título y un nombre con HTML se ven escapados', () => {
    const datos = respuestaDeEventos({ desde: '2026-10-26', hasta: '2026-11-25' }, {
      eventos: [eventoDe(61, MALICIOSO, '2026-10-26', '12:00'),
        eventoDe(62, 'Otro', '2026-10-28', '10:00', { ...DE_MARTIN, creador: MALICIOSO_EN_UNA_PALABRA })],
      ausencias: [{ nombre: MALICIOSO, desde: '2026-10-29', hasta: '2026-10-29' }], licencias: [], feriados: []
    });
    const html = M.htmlDeProximos(M.gruposDeProximos(datos, HOY));
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes(`data-evento="61"><span class="me-prox-icono propio" aria-hidden="true"><i></i></span>${ESCAPADO}</button>`));
    assert.ok(html.includes(`<span class="me-insignia violeta">De ${ESCAPADO_EN_UNA_PALABRA}</span>`));
    assert.ok(html.includes(`<span class="me-prox-titulo"><span class="me-prox-icono ausente" aria-hidden="true">${ICONO('ausente')}</span>`
      + `${ESCAPADO} no está</span>`));
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
const PIEZA_DE_SELECTOR = /#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]|:(checked)/g;
const TOKEN_HTML = /<!--[\s\S]*?-->|<![^>]*>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;

const crearDom = () => {
  const dom = { activo: null };
  const coincideCompuesto = (el, compuesto) => {
    const etiqueta = /^[a-zA-Z][\w-]*/.exec(compuesto)?.[0];
    if (etiqueta && el.tagName !== etiqueta.toLowerCase()) return false;
    const resto = etiqueta ? compuesto.slice(etiqueta.length) : compuesto;
    let leido = 0;
    for (const [pieza, id, clase, atributo, valor, marcado] of resto.matchAll(PIEZA_DE_SELECTOR)) {
      leido += pieza.length;
      if (id !== undefined && el.id !== id) return false;
      if (clase !== undefined && !el.classList.contains(clase)) return false;
      if (atributo !== undefined && (el.getAttribute(atributo) === null || (valor !== undefined && el.getAttribute(atributo) !== valor))) return false;
      if (marcado !== undefined && !el.checked) return false;
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
    const ponerClases = (conjunto) => { attrs.class = [...conjunto].join(' '); };
    const el = {
      esElemento: true, tagName: tagName.toLowerCase(), parentNode: null, hijos: [], html: '', oyentes,
      hidden: Object.hasOwn(attrs, 'hidden'), disabled: Object.hasOwn(attrs, 'disabled'), checked: Object.hasOwn(attrs, 'checked'),
      value: attrs.value ?? '', tabIndex: 0,
      get id() { return attrs.id ?? ''; },
      get name() { return attrs.name ?? ''; },
      get dataset() {
        return Object.fromEntries(Object.entries(attrs).filter(([nombre]) => nombre.startsWith('data-')).map(([nombre, valor]) => [camello(nombre.slice(5)), valor]));
      },
      classList: {
        contains: (clase) => clases().has(clase),
        add: (...nuevas) => { const conjunto = clases(); for (const c of nuevas) conjunto.add(c); ponerClases(conjunto); },
        remove: (...viejas) => { const conjunto = clases(); for (const c of viejas) conjunto.delete(c); ponerClases(conjunto); },
        toggle: (clase, forzar) => {
          const conjunto = clases();
          const poner = forzar === undefined ? !conjunto.has(clase) : Boolean(forzar);
          if (poner) conjunto.add(clase); else conjunto.delete(clase);
          ponerClases(conjunto);
          return poner;
        }
      },
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
      contains(otro) { for (let nodo = otro; nodo; nodo = nodo.parentNode) if (nodo === el) return true; return false; },
      scrollIntoView() {},
      // Como en el navegador: uno deshabilitado, suelto o dentro de algo inerte (`inert`) no recibe el foco
      focus() { if (!el.disabled && el.isConnected && !dentroDeUnInerte(el)) dom.activo = el; },
      // Como en el navegador: el que tiene el foco lo suelta (queda en ningún lado, el <body>)
      blur() { if (dom.activo === el) dom.activo = null; }
    };
    return el;
  };
  const soltar = (el) => { for (const hijo of el.hijos) if (typeof hijo !== 'string') hijo.parentNode = null; };
  const dentroDeUnInerte = (el) => { for (let nodo = el; nodo; nodo = nodo.parentNode) if (nodo.inert === true) return true; return false; };
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
    // Un elemento suelto, fuera del árbol (el <a download> de descargarBlob)
    createElement: (etiqueta) => elemento(etiqueta),
    getElementById: (id) => raiz.querySelector(`#${id}`),
    querySelector: (selector) => raiz.querySelector(selector),
    querySelectorAll: (selector) => raiz.querySelectorAll(selector),
    addEventListener: (tipo, funcion) => raiz.addEventListener(tipo, funcion),
    disparar: (tipo, extra) => raiz.disparar(tipo, extra)
  };
  // El cuerpo de mi-espacio.html, sin el <style> (no hace falta)
  raiz.innerHTML = leer('mi-espacio.html').replace(/<style>[\s\S]*?<\/style>/, '');
  return { dom, documento };
};

// Una respuesta del fetch falso
const respuesta = (status, body) => ({ status, body });
const ok = (data, message) => respuesta(200, { success: true, data, ...(message ? { message } : {}) });
// Un archivo del fetch falso (el Word de una licencia): el Blob y sus encabezados, en minúsculas (sin `disposicion`, sin
// Content-Disposition)
const archivo = (blob, disposicion) => ({
  status: 200, body: undefined, blob, headers: disposicion === undefined ? {} : { 'content-disposition': disposicion }
});
// El Blob del navegador, falso: guarda sus partes y su tipo
class BlobFalso {
  constructor(partes = [], opciones = {}) { this.partes = partes; this.type = opciones.type ?? ''; }
}
// El Resumen de la persona de planta, el de verdad (resumenDe), con un compañero que no está
const RESUMEN_DE_PLANTA = resumenDel(PLANTA, { ausencias: [AUSENCIA_DE_MARTIN] });
// Lo que contesta el servidor falso, de entrada (la persona de planta)
const RESPUESTAS_DE_ENTRADA = (metodo, ruta) => {
  if (ruta === '/api/mi-espacio/resumen') return ok(RESUMEN_DE_PLANTA);
  if (ruta === '/api/mi-espacio/licencias') return ok(licenciasDe(PLANTA));
  if (ruta === '/api/mi-espacio/licencias?anio=2025') return ok(licenciasDe(PLANTA, { anio: 2025 }));
  if (ruta === '/api/mi-espacio/horas-extras') return ok(horasDe(PLANTA));
  if (ruta === '/api/mi-espacio/horas-extras?anio=2025') return ok(horasDe(PLANTA, { anio: 2025 }));
  return respuesta(404, { success: false, error: `Sin respuesta para ${metodo} ${ruta}` });
};

// La consulta del teléfono (la de mi-espacio.js) y la de menos movimiento
const CONSULTA_DEL_TELEFONO = '(max-width: 640px)';
const CONSULTA_DE_MENOS_MOVIMIENTO = '(prefers-reduced-motion: reduce)';
// El localStorage del navegador, falso, sobre un Map (lo comparten dos montajes que reciben el mismo); con 'tira', uno que tira en
// cada lectura y escritura (el de una ventana privada o con el almacenamiento bloqueado)
const almacenamientoDe = (almacen) => (almacen === 'tira'
  ? {
    getItem: () => { throw new Error('SecurityError: el almacenamiento está bloqueado'); },
    setItem: () => { throw new Error('QuotaExceededError: no entra'); },
    removeItem: () => { throw new Error('SecurityError: el almacenamiento está bloqueado'); }
  }
  : {
    getItem: (clave) => (almacen.has(clave) ? almacen.get(clave) : null),
    setItem: (clave, valor) => { almacen.set(clave, String(valor)); },
    removeItem: (clave) => { almacen.delete(clave); }
  });

// `cuadros`: con true, la ventana tiene un requestAnimationFrame que anota las funciones en estado.cuadros (las corre el test);
// sin él, la página no anima. `reducido`: con true, la ventana tiene un matchMedia que dice que la persona pidió menos movimiento
// (prefers-reduced-motion: reduce). `telefono`: con true o false, la ventana tiene un matchMedia que dice si la pantalla es la del
// teléfono (CONSULTA_DEL_TELEFONO, 640 px o menos), y `cambiarElAncho(true|false)` la cambia y avisa a quien escucha su 'change';
// sin `reducido` ni `telefono`, no hay matchMedia. `almacen`: el Map del localStorage de la ventana (de entrada, uno nuevo; dos
// montajes con el mismo comparten lo guardado), 'tira' para uno que tira, o null para una ventana sin localStorage. Los
// temporizadores no corren solos: `correr` corre los que hay (el
// foco de los modales y la espera del cálculo). `auditor`: lo que contesta Auth.isAuditor(); `admin`, Auth.isAdmin() (la página lo
// pregunta solo al abrir el formulario del evento: compartir es de administración). Hoy es HOY. `estado.toasts`: cada showToast (el
// de main.js), [mensaje, tipo]. Cada pedido anota sus encabezados (`encabezados`). Las descargas: `estado.urls`, cada
// URL.createObjectURL (['crear', blob]) y revokeObjectURL (['soltar', url]), y `estado.descargas`, cada clic en un elemento creado
// con document.createElement (el <a download> de descargarBlob): { etiqueta, href, download }
const montarPagina = ({
  hash = '', responder = RESPUESTAS_DE_ENTRADA, cuadros = false, reducido = false, telefono = null, almacen = new Map(), auditor = false,
  admin = false
} = {}) => {
  const { dom, documento } = crearDom();
  const estado = {
    pedidos: [], direcciones: [], sesionCerrada: false, responder, cuadros: [], toasts: [], urls: [], descargas: [],
    telefono: telefono === true, medidas: []
  };
  // Cada MediaQueryList que pide la página, con sus oyentes de 'change'; `matches` se lee en el momento
  const matchMedia = (consulta) => {
    const medida = {
      consulta, oyentes: [],
      get matches() {
        if (consulta === CONSULTA_DE_MENOS_MOVIMIENTO) return reducido;
        return consulta === CONSULTA_DEL_TELEFONO ? estado.telefono : false;
      },
      addEventListener: (tipo, funcion) => { if (tipo === 'change') medida.oyentes.push(funcion); }
    };
    estado.medidas.push(medida);
    return medida;
  };
  const crearElemento = documento.createElement;
  documento.createElement = (etiqueta) => {
    const nuevo = crearElemento(etiqueta);
    nuevo.click = () => { estado.descargas.push({ etiqueta: nuevo.tagName, href: nuevo.href, download: nuevo.download }); };
    return nuevo;
  };
  // Los temporizadores pendientes, por su id: un número que solo crece (un clearTimeout viejo nunca anula uno nuevo)
  const temporizadores = new Map();
  let ultimoTemporizador = 0;
  const ventana = {
    location: { search: '', hash, pathname: '/mi-espacio.html', href: `/mi-espacio.html${hash}` },
    history: {
      replaceState: (_estado, _titulo, url) => {
        estado.direcciones.push(url);
        ventana.location.hash = url.slice(url.indexOf('#'));
      }
    },
    addEventListener() {},
    ...(cuadros ? { requestAnimationFrame: (funcion) => { estado.cuadros.push(funcion); return estado.cuadros.length; } } : {}),
    ...(reducido || telefono !== null ? { matchMedia } : {}),
    ...(almacen === null ? {} : { localStorage: almacenamientoDe(almacen) })
  };
  const contexto = vm.createContext({
    CONFIG: { API_URL: '/api' },
    console: { log() {}, warn() {}, error() {} },
    document: documento,
    window: ventana,
    Auth: {
      isAuthenticated: () => true,
      isAuditor: () => auditor,
      isAdmin: () => admin,
      getUser: () => ({ id: 1 }),
      getAuthHeaders: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer token-de-prueba' }),
      clearSession: () => { estado.sesionCerrada = true; }
    },
    showToast: (mensaje, tipo) => { estado.toasts.push([mensaje, tipo]); },
    URLSearchParams,
    Blob: BlobFalso,
    URL: {
      createObjectURL: (blob) => {
        estado.urls.push(['crear', blob]);
        return `blob:falso/${String(estado.urls.filter(([accion]) => accion === 'crear').length)}`;
      },
      revokeObjectURL: (url) => { estado.urls.push(['soltar', url]); }
    },
    setTimeout: (funcion, ms) => {
      ultimoTemporizador += 1;
      temporizadores.set(ultimoTemporizador, { funcion, ms });
      return ultimoTemporizador;
    },
    clearTimeout: (id) => { temporizadores.delete(id); },
    fetch: async (url, opciones = {}) => {
      const metodo = opciones.method ?? 'GET';
      const cuerpo = opciones.body === undefined ? undefined : JSON.parse(opciones.body);
      estado.pedidos.push({ metodo, ruta: url, cuerpo, encabezados: opciones.headers });
      const r = await estado.responder(metodo, url, cuerpo);
      return {
        ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body,
        headers: { get: (nombre) => r.headers?.[String(nombre).toLowerCase()] ?? null }, blob: async () => r.blob
      };
    }
  });
  vm.runInContext(`${leer('js/api.js')}\n;globalThis.Utils = Utils;`, contexto);
  vm.runInContext(leer('js/mi-espacio.js'), contexto);
  contexto.Utils.hoyEnArgentina = () => HOY;
  const esperar = async () => { for (let i = 0; i < 5; i += 1) await new Promise((resolver) => setImmediate(resolver)); };
  const el = (id) => documento.getElementById(id);
  const rutas = () => estado.pedidos.map((p) => p.ruta);
  // Los pedidos de un método y una ruta, con sus cuerpos
  const pedidosA = (metodo, ruta) => estado.pedidos.filter((p) => p.metodo === metodo && p.ruta === ruta);
  // Corre los temporizadores que hay (los que se programan mientras, en la próxima vuelta) y espera lo que pidan
  const correr = async () => {
    for (const id of [...temporizadores.keys()]) {
      // Uno que otro anuló mientras tanto ya no está
      const temporizador = temporizadores.get(id);
      if (!temporizador) continue;
      temporizadores.delete(id);
      temporizador.funcion();
    }
    await esperar();
  };
  const iniciar = async () => { await contexto.iniciarMiEspacio(); await esperar(); };
  // Un clic en un elemento (burbujea hasta el contenedor que lo escucha) y lo que pida después
  const tocar = async (elemento) => { assert.ok(elemento, 'el elemento existe'); elemento.disparar('click'); await esperar(); };
  // Escribir en un campo (o elegir en una lista): el valor y el evento, como en el navegador
  const escribir = async (id, valor, evento = 'input') => {
    const campo = el(id);
    assert.ok(campo, id);
    campo.value = valor;
    campo.disparar(evento);
    await esperar();
  };
  // Elegir una opción de un grupo de radios (las demás quedan sin marcar), con su change
  const elegir = async (nombre, valor) => {
    const radios = documento.querySelectorAll(`input[name="${nombre}"]`);
    const radio = radios.find((uno) => uno.getAttribute('value') === valor);
    assert.ok(radio, `${nombre}=${valor}`);
    for (const uno of radios) uno.checked = uno === radio;
    radio.disparar('change');
    await esperar();
  };
  // Una tecla en el elemento con el foco (sin foco, en el documento)
  const tecla = async (key) => { (documento.activeElement ?? documento).disparar('keydown', { key }); await esperar(); };
  // Un cuadro del navegador: corre lo que se pidió con requestAnimationFrame hasta ahora (lo que se pida adentro, en el próximo),
  // con `tiempo`, el momento del cuadro en ms (el que da requestAnimationFrame); sin él, un cuadro sin tiempo
  const cuadro = (tiempo) => { for (const funcion of estado.cuadros.splice(0)) funcion(tiempo); };
  const abierto = (id) => el(id).classList.contains('active');
  // La pantalla pasa a ser la del teléfono (true) o la de la compu (false): avisa a quien escucha el 'change' de su consulta
  const cambiarElAncho = async (enElTelefono) => {
    estado.telefono = enElTelefono;
    for (const medida of estado.medidas.filter((una) => una.consulta === CONSULTA_DEL_TELEFONO)) {
      for (const funcion of medida.oyentes) funcion({ matches: enElTelefono, media: CONSULTA_DEL_TELEFONO });
    }
    await esperar();
  };
  return {
    contexto, dom, documento, ventana, estado, el, rutas, pedidosA, iniciar, tocar, esperar, correr, escribir, elegir, tecla,
    cuadro, abierto, cambiarElAncho
  };
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

  it('el Resumen se dibuja con lo que manda el servidor, y la marca ámbar va en la pestaña', async () => {
    const pagina = montarPagina();
    await pagina.iniciar();
    assert.equal(pagina.el('vista-resumen').innerHTML, M.htmlDelResumen(RESUMEN_DE_PLANTA));
    assert.equal(pagina.el('me-marca').innerHTML, M.htmlDeMarca(true));
    const marca = pagina.el('tab-resumen').querySelector('.me-marca');
    assert.equal(marca.getAttribute('role'), 'img');
    assert.equal(marca.getAttribute('aria-label'), 'Hay algo que vence pronto');
    assert.equal(marca.getAttribute('title'), null);
  });

  it('sin nada que venza, la pestaña no tiene marca y el Resumen no tiene «Vence pronto»', async () => {
    const resumen = resumenDel(PLANTA, { estado: SIN_NADA_QUE_VENZA });
    const pagina = montarPagina({ responder: (metodo, ruta) => (ruta === '/api/mi-espacio/resumen' ? ok(resumen) : RESPUESTAS_DE_ENTRADA(metodo, ruta)) });
    await pagina.iniciar();
    assert.equal(pagina.el('me-marca').innerHTML, '');
    assert.equal(pagina.el('vista-resumen').querySelector('.me-vence'), null);
  });

  it('un número del resto lleva a su pestaña: la abre (la pide la primera vez), escribe el fragmento y el foco va a la pestaña', async () => {
    const pagina = montarPagina();
    await pagina.iniciar();
    // El primero del resto que lleva a Licencias (el link de la bajada también va ahí, en su año: está más abajo)
    const numero = pagina.el('vista-resumen').querySelectorAll('.me-numero[data-pestana]').find((link) => link.getAttribute('href') === '#licencias');
    assert.ok(numero.classList.contains('me-numero'));
    const evento = numero.disparar('click');
    await pagina.esperar();
    assert.equal(evento.defaultPrevented, true);
    assert.equal(pagina.el('tab-licencias').getAttribute('aria-selected'), 'true');
    assert.equal(pagina.el('vista-licencias').hidden, false);
    assert.equal(pagina.ventana.location.hash, '#licencias');
    assert.equal(pagina.documento.activeElement, pagina.el('tab-licencias'));
    assert.ok(pagina.rutas().includes('/api/mi-espacio/licencias'));
    // Con Ctrl (abrir en otra pestaña del navegador), el link hace lo suyo
    await pagina.tocar(pagina.el('tab-resumen'));
    const conCtrl = numero.disparar('click', { ctrlKey: true });
    assert.equal(conCtrl.defaultPrevented, false);
    assert.equal(pagina.el('tab-resumen').getAttribute('aria-selected'), 'true');
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

  // Con la cuarta pestaña, Fin y las dos vueltas llegan a la Agenda
  it('las flechas, Inicio y Fin mueven el foco entre las pestañas y las activan', async () => {
    const pagina = montarPagina();
    await pagina.iniciar();
    pagina.el('tab-resumen').disparar('keydown', { key: 'ArrowRight' });
    await pagina.esperar();
    assert.equal(pagina.el('tab-licencias').getAttribute('aria-selected'), 'true');
    assert.equal(pagina.documento.activeElement, pagina.el('tab-licencias'));
    pagina.el('tab-licencias').disparar('keydown', { key: 'End' });
    assert.equal(pagina.documento.activeElement, pagina.el('tab-agenda'));
    assert.equal(pagina.el('tab-agenda').getAttribute('aria-selected'), 'true');
    pagina.el('tab-agenda').disparar('keydown', { key: 'ArrowRight' });
    assert.equal(pagina.documento.activeElement, pagina.el('tab-resumen'));
    pagina.el('tab-resumen').disparar('keydown', { key: 'ArrowLeft' });
    assert.equal(pagina.documento.activeElement, pagina.el('tab-agenda'));
    pagina.el('tab-agenda').disparar('keydown', { key: 'ArrowLeft' });
    assert.equal(pagina.documento.activeElement, pagina.el('tab-horas'));
    pagina.el('tab-horas').disparar('keydown', { key: 'Home' });
    assert.equal(pagina.documento.activeElement, pagina.el('tab-resumen'));
    await pagina.esperar();
  });

  it('sin modalidad: el mensaje en el Resumen y en la pestaña, sin marca, y los botones de carga ocultos', async () => {
    // El Resumen de verdad sin modalidad, y la lista como la manda la API sin modalidad: { modalidad: null, mensaje }
    const resumen = resumenDel(PLANTA, { estado: { ...PLANTA.estado, modalidad: null } });
    const pagina = montarPagina({ hash: '#licencias', responder: (metodo, ruta) => ok(ruta === '/api/mi-espacio/resumen' ? resumen : SIN_MODALIDAD) });
    await pagina.iniciar();
    assert.equal(pagina.el('vista-resumen').innerHTML, M.htmlDeMensaje(MENSAJES_MI_ESPACIO.sinModalidad));
    assert.equal(pagina.el('vista-licencias').innerHTML, M.htmlDeMensaje(MENSAJES_MI_ESPACIO.sinModalidad));
    assert.equal(pagina.el('me-marca').innerHTML, '');
    assert.equal(pagina.el('btn-cargar-horas').hidden, true);
    assert.equal(pagina.el('btn-cargar-licencia').hidden, true);
  });

  it('con modalidad y sin arranque, el Resumen invita a completar «Mis vacaciones y saldos»', async () => {
    const resumen = resumenDel(PLANTA, { estado: { ...PLANTA.estado, arranque: null } });
    const pagina = montarPagina({ responder: (metodo, ruta) => (ruta === '/api/mi-espacio/resumen' ? ok(resumen) : RESPUESTAS_DE_ENTRADA(metodo, ruta)) });
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

  it('un año que no se pudo cargar lo dice, y volver a la pestaña la pide otra vez (Licencias y Horas extras)', async () => {
    for (const [pestana, ruta, texto] of [
      ['licencias', '/api/mi-espacio/licencias', 'No se pudieron cargar tus licencias. Probá de nuevo en unos minutos.'],
      ['horas', '/api/mi-espacio/horas-extras', 'No se pudieron cargar tus horas extras. Probá de nuevo en unos minutos.']
    ]) {
      const pagina = montarPagina({
        hash: `#${pestana}`,
        responder: (metodo, pedida) => (pedida === `${ruta}?anio=2025` ? respuesta(500, { success: false, error: 'Error' }) : RESPUESTAS_DE_ENTRADA(metodo, pedida))
      });
      await pagina.iniciar();
      const vista = pagina.el(`vista-${pestana}`);
      await pagina.tocar(vista.querySelector('[data-anio="2025"]'));
      assert.equal(textoDe(vista.innerHTML), texto, pestana);
      assert.equal(pagina.el('me-anuncio').textContent, texto);
      const antes = pagina.rutas().length;
      await pagina.tocar(pagina.el('tab-resumen'));
      await pagina.tocar(pagina.el(`tab-${pestana}`));
      assert.deepEqual(pagina.rutas().slice(antes), [ruta], `${pestana}: la vuelve a pedir`);
      assert.match(vista.innerHTML, /data-anio="2026" aria-pressed="true"/);
    }
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

// =====================================================================================================================================
// El movimiento del Resumen «Titular» (spec 2026-10-27-mi-espacio-resumen, 3 y 5), con el DOM falso: una sola vez por carga de la
// página, la primera vez que la banda se dibuja y se ve. La regla y las líneas del resto se mueven en el <style> (data-animar en
// #vista-resumen, que se saca dos cuadros después); los números (data-contar) los cuenta mi-espacio.js con requestAnimationFrame.
// Reemplazan los tres de los tanques de «Niveles»
// =====================================================================================================================================

// El número de la frase que sube (el que se ve, decorativo), el final invisible que le da su ancho y el oculto a la vista, y los
// números del resto, en su orden
const cifraDe = (pagina) => pagina.el('me-frase')?.querySelector('[data-contar]') ?? null;
const cifraFinalDe = (pagina) => pagina.el('me-frase')?.querySelector('.me-cifra-final') ?? null;
const cifraOcultaDe = (pagina) => pagina.el('me-frase')?.querySelector('.visualmente-oculto') ?? null;
const numerosDelRestoDe = (pagina) => pagina.el('vista-resumen').querySelectorAll('.me-numero [data-contar]');
const textosDe = (elementos) => elementos.map((elemento) => elemento.textContent);
// Los números del resto de PLANTA, como los manda el servidor
const PLANTA_EN_SU_VALOR = Object.freeze(['25', '9', '22', '23']);
// Lo que lee un lector de pantalla de un elemento del DOM falso: su texto, sin lo que va con aria-hidden
const textoParaLectores = (elemento) => elemento.hijos
  .map((hijo) => (typeof hijo === 'string' ? hijo : (hijo.getAttribute('aria-hidden') === 'true' ? '' : textoParaLectores(hijo))))
  .join('').replace(/\s+/g, ' ').trim();
// Corre cuadros con tiempo (el de requestAnimationFrame, en ms), de a 16 desde `desde`, mientras se pida alguno, y anota después de
// cada uno el texto de cada elemento: por elemento, [[ms desde el primer cuadro, texto]]
const cuadrosConTiempo = (pagina, elementos, desde = 1000) => {
  const vistos = elementos.map(() => []);
  for (let tiempo = desde; pagina.estado.cuadros.length > 0; tiempo += 16) {
    assert.ok(tiempo < desde + 10000, 'los cuadros se terminan');
    pagina.cuadro(tiempo);
    elementos.forEach((elemento, i) => vistos[i].push([tiempo - desde, elemento.textContent]));
  }
  return vistos;
};
// Un número que sube (lo anotado por cuadrosConTiempo): en 0 hasta su demora, en enteros que no bajan y no llegan al final mientras
// cuenta (pasa por alguno más que 0), y desde su demora más su duración, el texto final tal cual, que ya no cambia
const comprobarConteo = (vistos, { final, demora, duracion }, nombre) => {
  const hasta = Number(final.replace(',', '.'));
  const llega = vistos.findIndex(([, texto]) => texto === final);
  assert.ok(llega > 0, `${nombre}: llega a ${final}`);
  assert.ok(vistos.slice(llega).every(([, texto]) => texto === final), `${nombre}: termina en ${final} y ahí queda`);
  assert.ok(vistos[llega][0] >= demora + duracion, `${nombre}: llega a los ${vistos[llega][0]} ms`);
  assert.ok(vistos[llega - 1][0] < demora + duracion, `${nombre}: no llega tarde`);
  const contando = vistos.slice(0, llega);
  assert.ok(contando.filter(([ms]) => ms < demora).every(([, texto]) => texto === '0'), `${nombre}: espera su demora en 0`);
  assert.ok(contando.every(([, texto]) => /^\d+$/.test(texto) && Number(texto) < hasta), `${nombre}: en enteros, sin pasarse`);
  const numeros = contando.map(([, texto]) => Number(texto));
  assert.ok(numeros.every((numero, i) => i === 0 || numero >= numeros[i - 1]), `${nombre}: no baja`);
  assert.ok(numeros.some((numero) => numero > 0), `${nombre}: sube`);
};
const conResumen = (resumen) => (metodo, ruta) => (ruta === '/api/mi-espacio/resumen' ? ok(resumen) : RESPUESTAS_DE_ENTRADA(metodo, ruta));

describe('el movimiento del Resumen «Titular» (DOM falso)', () => {
  it('se mueve una sola vez: data-animar en el primer cuadro y no en el segundo; un Resumen que se vuelve a dibujar llega quieto y en su valor', async () => {
    const pagina = montarPagina({ cuadros: true });
    await pagina.iniciar();
    const vista = pagina.el('vista-resumen');
    assert.ok(vista.querySelector('.me-banda'), 'la banda');
    // Al verse, la regla y las líneas, vacías (data-animar), y los números, en 0
    assert.equal(vista.getAttribute('data-animar'), '');
    assert.equal(cifraDe(pagina).textContent, '0');
    assert.deepEqual(textosDe(numerosDelRestoDe(pagina)), ['0', '0', '0', '0']);
    pagina.cuadro();
    assert.equal(vista.getAttribute('data-animar'), '', 'el primer cuadro las dibuja vacías');
    pagina.cuadro();
    assert.equal(vista.getAttribute('data-animar'), null, 'en el segundo empiezan las transiciones');
    // Un cuadro sin tiempo (el DOM falso) deja cada número en su valor
    assert.equal(cifraDe(pagina).textContent, '33');
    assert.deepEqual(textosDe(numerosDelRestoDe(pagina)), PLANTA_EN_SU_VALOR);
    assert.equal(pagina.estado.cuadros.length, 0);
    assert.equal(vm.runInContext('pagina.bandaAnimada', pagina.contexto), true);
    // Se vuelve a dibujar (por ejemplo, después de guardar una licencia): ya no se mueve
    const vieja = cifraDe(pagina);
    await pagina.contexto.cargarResumen();
    assert.equal(vieja.isConnected, false);
    assert.equal(vista.getAttribute('data-animar'), null);
    assert.equal(cifraDe(pagina).textContent, '33');
    assert.deepEqual(textosDe(numerosDelRestoDe(pagina)), PLANTA_EN_SU_VALOR);
    assert.equal(pagina.estado.cuadros.length, 0);
  });

  it('con el Resumen oculto (#licencias), la banda espera quieta a que se vea; volver a la pestaña no la vuelve a mover', async () => {
    const pagina = montarPagina({ hash: '#licencias', cuadros: true });
    await pagina.iniciar();
    const vista = pagina.el('vista-resumen');
    assert.ok(vista.querySelector('.me-banda'), 'la banda, dibujada en la pestaña oculta');
    assert.equal(vista.getAttribute('data-animar'), null);
    assert.equal(cifraDe(pagina).textContent, '33');
    assert.equal(pagina.estado.cuadros.length, 0);
    await pagina.tocar(pagina.el('tab-resumen'));
    assert.equal(vista.getAttribute('data-animar'), '');
    assert.equal(cifraDe(pagina).textContent, '0');
    pagina.cuadro();
    pagina.cuadro();
    assert.equal(vista.getAttribute('data-animar'), null);
    assert.equal(cifraDe(pagina).textContent, '33');
    assert.deepEqual(textosDe(numerosDelRestoDe(pagina)), PLANTA_EN_SU_VALOR);
    assert.equal(pagina.estado.cuadros.length, 0);
    await pagina.tocar(pagina.el('tab-horas'));
    await pagina.tocar(pagina.el('tab-resumen'));
    assert.equal(vista.getAttribute('data-animar'), null);
    assert.equal(cifraDe(pagina).textContent, '33');
    assert.equal(pagina.estado.cuadros.length, 0);
  });

  it('sin requestAnimationFrame, nada se mueve: ni data-animar, y los números en su valor desde el principio', async () => {
    const pagina = montarPagina();
    await pagina.iniciar();
    const vista = pagina.el('vista-resumen');
    for (const momento of ['al abrir', 'al volver a la pestaña']) {
      assert.ok(vista.querySelector('.me-banda'), momento);
      assert.equal(vista.getAttribute('data-animar'), null, momento);
      assert.equal(cifraDe(pagina).textContent, '33', momento);
      assert.equal(cifraFinalDe(pagina).textContent, '33', momento);
      assert.equal(cifraOcultaDe(pagina).textContent, '33', momento);
      assert.deepEqual(textosDe(numerosDelRestoDe(pagina)), PLANTA_EN_SU_VALOR, momento);
      await pagina.tocar(pagina.el('tab-horas'));
      await pagina.tocar(pagina.el('tab-resumen'));
    }
  });

  it('sin el saldo inicial, el primer Resumen es la invitación: la banda aparece al guardar «Mis vacaciones y saldos» y se mueve (es la primera vez)', async () => {
    let guardado = false;
    const pagina = montarPagina({
      cuadros: true,
      responder: conSaldosParaArrancar({
        extra: (metodo, ruta) => {
          if (metodo === 'PUT' && ruta === '/api/mi-espacio/anio/2026') return ok({ anio: 2026 }, 'Días del año guardados.');
          if (metodo === 'PUT' && ruta === '/api/mi-espacio/saldo-inicial') {
            guardado = true;
            return ok({ arranque: HOY }, 'Saldo inicial guardado.');
          }
          return guardado && ruta === '/api/mi-espacio/resumen' ? ok(RESUMEN_DE_PLANTA) : undefined;
        }
      })
    });
    await pagina.iniciar();
    await pagina.correr();
    const vista = pagina.el('vista-resumen');
    assert.equal(pagina.abierto('modal-saldos'), true);
    assert.equal(vista.querySelector('.me-banda'), null, 'la invitación, sin la banda');
    assert.equal(vista.getAttribute('data-animar'), null);
    assert.equal(pagina.estado.cuadros.length, 0);
    await pagina.elegir('ms-dia', '20');
    await pagina.elegir('ms-estudio', 'universitario');
    for (const campo of pagina.el('ms-campos').querySelectorAll('input')) campo.value = '0';
    await pagina.tocar(pagina.el('ms-guardar'));
    await pagina.esperar();
    assert.equal(pagina.abierto('modal-saldos'), false);
    assert.ok(vista.querySelector('.me-banda'), 'la banda, al guardar');
    assert.equal(vista.getAttribute('data-animar'), '');
    assert.equal(cifraDe(pagina).textContent, '0');
    pagina.cuadro();
    pagina.cuadro();
    assert.equal(vista.getAttribute('data-animar'), null);
    assert.equal(cifraDe(pagina).textContent, '33');
    assert.deepEqual(textosDe(numerosDelRestoDe(pagina)), PLANTA_EN_SU_VALOR);
  });

  // Review Focus 2
  it('un lector de pantalla nunca lee un número a medio contar: el que sube va con aria-hidden y el oculto dice 33 desde el primer cuadro', async () => {
    const pagina = montarPagina({ cuadros: true });
    await pagina.iniciar();
    const visible = cifraDe(pagina);
    const final = cifraFinalDe(pagina);
    const oculto = cifraOcultaDe(pagina);
    assert.equal(visible.getAttribute('aria-hidden'), 'true');
    assert.equal(final.getAttribute('aria-hidden'), 'true');
    assert.ok(oculto.classList.contains('visualmente-oculto'));
    assert.equal(oculto.getAttribute('aria-hidden'), null);
    assert.equal(visible.textContent, '0');
    assert.equal(final.textContent, '33');
    assert.equal(oculto.textContent, '33');
    // El título de la pestaña, como lo lee un lector de pantalla, en cada cuadro: el número una sola vez, el final
    const frase = pagina.el('me-frase');
    assert.equal(textoParaLectores(frase), 'Te quedan 33 días de vacaciones');
    const titulo = { get textContent() { return textoParaLectores(frase); } };
    const [vistos, finales, ocultos, leidos] = cuadrosConTiempo(pagina, [visible, final, oculto, titulo]);
    assert.ok(vistos.some(([, texto]) => texto !== '0' && texto !== '33'), 'el que se ve pasa por números intermedios');
    assert.ok(finales.every(([, texto]) => texto === '33'), 'el final invisible (el ancho del número) dice siempre 33');
    assert.ok(ocultos.every(([, texto]) => texto === '33'), 'el oculto dice siempre 33');
    assert.ok(leidos.every(([, texto]) => texto === 'Te quedan 33 días de vacaciones'), 'el título se lee siempre entero');
  });

  // El número de la frase mide desde el primer cuadro lo que el valor final (sin hueco antes de un final de una cifra ni un salto de
  // ancho al pasar de 9 a 10): el final invisible y el que sube, en la misma celda de una grilla, el que sube a la derecha
  it('el <style>: el número de la frase, una grilla con el final invisible y el que sube en la misma celda, sin un ancho mínimo fijo', () => {
    const estilo = leer('mi-espacio.html').match(/<style>([\s\S]*?)<\/style>/)[1];
    assert.ok(estilo.includes('.me-cifra { display: inline-grid; justify-items: end; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }'));
    assert.ok(estilo.includes('.me-cifra-final, .me-cifra [data-contar] { grid-area: 1 / 1; }'));
    assert.ok(estilo.includes('.me-cifra-final { visibility: hidden; }'));
    assert.doesNotMatch(estilo, /\.me-cifra \{[^}]*min-width/);
    // El oculto a la vista es absoluto: no ocupa lugar en la grilla
    assert.match(estilo, /\.visualmente-oculto \{ position: absolute !important;/);
  });

  // Review Focus 3
  it('con cuadros con tiempo, cada número sube en enteros, con su demora y su duración, y termina en el texto del servidor: 33, 1,5 y 0', async () => {
    // PLANTA: la frase, con la regla (250 ms de demora y 1300 de duración), y las franquicias, con su línea (900 ms y 700)
    const planta = montarPagina({ cuadros: true });
    await planta.iniciar();
    const resto = numerosDelRestoDe(planta);
    const [frase, franquicias, medica] = cuadrosConTiempo(planta, [cifraDe(planta), resto[0], resto[2]]);
    comprobarConteo(frase, { final: '33', demora: 250, duracion: 1300 }, 'la frase');
    comprobarConteo(franquicias, { final: '25', demora: 900, duracion: 700 }, 'las franquicias');
    // La tercera línea empieza 180 ms después de la primera
    comprobarConteo(medica, { final: '22', demora: 1080, duracion: 700 }, 'la atención médica');
    // CONTRATO: las horas a favor, con decimales, terminan en «1,5» tal cual (antes, solo 0 y 1)
    const contrato = montarPagina({ cuadros: true, responder: conResumen(resumenDel(CONTRATO)) });
    await contrato.iniciar();
    const [horas] = cuadrosConTiempo(contrato, [numerosDelRestoDe(contrato)[0]]);
    comprobarConteo(horas, { final: '1,5', demora: 900, duracion: 700 }, 'las horas a favor');
    assert.deepEqual([...new Set(horas.map(([, texto]) => texto))], ['0', '1', '1,5']);
    // Uno en 0 (CONTRATO sin horas extras: las horas a favor) sigue en 0 en todos los cuadros
    const sinHorasExtras = resumenDel(CONTRATO, { estado: { ...CONTRATO.estado, horasExtras: [], salidas: [], licencias: [] } });
    const sinHoras = montarPagina({ cuadros: true, responder: conResumen(sinHorasExtras) });
    await sinHoras.iniciar();
    const [cero] = numerosDelRestoDe(sinHoras);
    assert.equal(cero.textContent, '0');
    const [vistosDelCero] = cuadrosConTiempo(sinHoras, [cero]);
    assert.ok(vistosDelCero.length > 0);
    assert.ok(vistosDelCero.every(([, texto]) => texto === '0'));
  });

  // Review Focus 5
  it('un Resumen que se vuelve a dibujar mientras la banda se mueve llega quieto y completo, y los cuadros que quedan del conteo viejo no lo tocan', async () => {
    // Después del primer cuadro (con data-animar todavía puesto) y a mitad del conteo (la frase va por la mitad)
    for (const tiempos of [[1000], [1000, 1016, 1900]]) {
      const pagina = montarPagina({ cuadros: true });
      await pagina.iniciar();
      const vista = pagina.el('vista-resumen');
      const vieja = cifraDe(pagina);
      for (const tiempo of tiempos) pagina.cuadro(tiempo);
      if (tiempos.length === 1) assert.equal(vista.getAttribute('data-animar'), '', 'todavía no empezaron las transiciones');
      else assert.ok(!['0', '33'].includes(vieja.textContent), `a medio contar: ${vieja.textContent}`);
      // Se guarda una licencia: el Resumen se vuelve a dibujar
      await pagina.contexto.cargarResumen();
      assert.equal(vieja.isConnected, false);
      const textoViejo = vieja.textContent;
      const nueva = cifraDe(pagina);
      const quieto = (momento) => {
        assert.equal(vista.getAttribute('data-animar'), null, momento);
        assert.equal(cifraDe(pagina), nueva, momento);
        assert.equal(nueva.textContent, '33', momento);
        assert.equal(cifraOcultaDe(pagina).textContent, '33', momento);
        assert.deepEqual(textosDe(numerosDelRestoDe(pagina)), PLANTA_EN_SU_VALOR, momento);
      };
      quieto(`${String(tiempos)}: recién dibujado`);
      // Los cuadros que quedan (el conteo viejo y el que sacaba data-animar) no tocan el nuevo, y se terminan
      for (let tiempo = tiempos.at(-1) + 16; pagina.estado.cuadros.length > 0; tiempo += 16) {
        assert.ok(tiempo < 20000, 'los cuadros se terminan');
        pagina.cuadro(tiempo);
        quieto(`${String(tiempos)}: a los ${String(tiempo)} ms`);
      }
      // El conteo viejo se detuvo: no escribió más en el número que ya no está
      assert.equal(vieja.textContent, textoViejo);
    }
  });

  it('lo puro del movimiento: el valor de un número como lo escribe el servidor (con coma) y la demora de una línea del resto', () => {
    assert.equal(M.numeroDelTexto('33'), 33);
    assert.equal(M.numeroDelTexto('1,5'), 1.5);
    assert.equal(M.numeroDelTexto('0'), 0);
    assert.equal(M.numeroDelTexto(' 10,5 '), 10.5);
    for (const raro of ['', '-3', '1.5', '1,', ',5', 'x', MALICIOSO, null, undefined, 12]) assert.equal(M.numeroDelTexto(raro), null, String(raro));
    // La de cada línea, del style que escribe htmlDelResto: 900 ms y 90 más por línea
    const demoras = [...M.htmlDelResto(resumenDel(PLANTA)).matchAll(/<i style="([^"]*)">/g)].map(([, estilo]) => M.demoraDelEstilo(estilo));
    assert.deepEqual(demoras, [900, 990, 1080, 1170]);
    for (const raro of ['', '--p:10%', null, undefined, '--demora:abc']) assert.equal(M.demoraDelEstilo(raro), 0, String(raro));
  });

  // La spec (3): con prefers-reduced-motion, nada se mueve y todo está en su valor desde el principio. La regla y las líneas, en el
  // <style> (el test de abajo); los números no cuentan
  it('con prefers-reduced-motion: reduce, los números no cuentan: están en su valor desde el principio, sin pasar por 0', async () => {
    const pagina = montarPagina({ cuadros: true, reducido: true });
    await pagina.iniciar();
    const elementos = [cifraDe(pagina), cifraFinalDe(pagina), ...numerosDelRestoDe(pagina)];
    const finales = ['33', '33', ...PLANTA_EN_SU_VALOR];
    assert.deepEqual(textosDe(elementos), finales);
    const vistos = cuadrosConTiempo(pagina, elementos);
    vistos.forEach((deUno, i) => assert.ok(deUno.every(([, texto]) => texto === finales[i]), finales[i]));
    assert.deepEqual(textosDe(elementos), finales);
  });

  it('el <style>: la regla y las líneas, vacías y sin transición con data-animar; después, cada una con su --demora y su --duracion; quietas con prefers-reduced-motion', () => {
    const estilo = leer('mi-espacio.html').match(/<style>([\s\S]*?)<\/style>/)[1];
    // Los tramos, uno detrás del otro con su demora y su duración (las del style que escribe mi-espacio.js); el número de cada
    // uno, cuando su tramo casi terminó; las líneas, de 700 ms (los mismos que cuenta el número de cada una) y con su curva: la de
    // contarHasta, 1 − (1 − x)³, que en CSS es cubic-bezier(0.33, 1, 0.68, 1) (el número sube con su línea, no se le adelanta)
    assert.ok(estilo.includes('.me-tramo { transition: transform var(--duracion) cubic-bezier(0.4, 0, 0.3, 1) var(--demora); }'));
    assert.ok(estilo.includes('.me-tramo > span { transition: opacity 200ms ease calc(var(--demora) + var(--duracion) * 0.7); }'));
    assert.ok(estilo.includes(`.me-linea i { transition: transform ${String(M.DURACION_DE_LA_LINEA)}ms cubic-bezier(0.33, 1, 0.68, 1) var(--demora); }`));
    assert.equal(M.DURACION_DE_LA_LINEA, 700);
    assert.match(leer('js/mi-espacio.js'), /Math\.floor\(hasta \* \(1 - \(1 - avance\) \*\* 3\)\)/);
    // Con data-animar, vacías y sin transición: si ya se habían dibujado llenas, se vacían de golpe
    assert.ok(estilo.includes('#vista-resumen[data-animar] .me-tramo, #vista-resumen[data-animar] .me-linea i { transform: scaleX(0); transition: none; }'));
    assert.ok(estilo.includes('#vista-resumen[data-animar] .me-tramo > span { opacity: 0; transition: none; }'));
    // Con prefers-reduced-motion, sin transiciones ni transformaciones, y el número de cada tramo a la vista, también con data-animar
    const inicio = estilo.indexOf('@media (prefers-reduced-motion: reduce) {');
    assert.ok(inicio > estilo.indexOf('#vista-resumen[data-animar] .me-tramo > span {'), 'después de las reglas que anula');
    const reducido = estilo.slice(inicio, estilo.indexOf('}', inicio) + 1);
    for (const selector of ['.me-tramo', '.me-tramo > span', '.me-linea i', '#vista-resumen[data-animar] .me-tramo',
      '#vista-resumen[data-animar] .me-tramo > span', '#vista-resumen[data-animar] .me-linea i']) {
      assert.ok(reducido.split('{')[1].split(',').map((parte) => parte.trim()).includes(selector), selector);
    }
    assert.match(reducido, /\{ transition: none; transform: none; opacity: 1; \}/);
    // Sin restos de los tanques de «Niveles»
    assert.doesNotMatch(leer('js/mi-espacio.js'), /llenarTanques|tanquesLlenos|data-llenar|me-niveles|me-tanque/);
    assert.doesNotMatch(estilo, /data-llenar|me-tanque/);
  });
});

// =====================================================================================================================================
// Los formularios (spec 2026-10-26-mi-espacio-licencias-y-horas, 4, 6 y 8; Task 17): «Cargar licencia» (con el cálculo previo,
// el aviso del paso a Configuración, el campo del firmante y el aviso de los días sin auditor), «Cargar horas extras», «Mis
// vacaciones y saldos», «Registrar un uso autorizado» y la confirmación
// =====================================================================================================================================

// usuarios.js en su propio vm (el armado de tests/usuarios-frontend.test.js: importar ese archivo registraría sus tests), para
// comparar las copias de mi-espacio.js. filaLicencia pide getInitials (de main.js)
const usuariosJs = (() => {
  const elemento = () => ({
    value: '', textContent: '', hidden: true, disabled: false, setAttribute() {}, removeAttribute() {}, addEventListener() {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false }
  });
  const contexto = vm.createContext({
    document: { addEventListener() {}, getElementById: elemento, querySelectorAll: () => [], querySelector: elemento },
    window: { location: {} },
    Utils: { escapeHtml: (texto) => texto },
    Auth: { getUser: () => ({ id: 1 }), getRole: () => 'admin', isAuthenticated: () => true, isAdmin: () => true },
    API: new Proxy({}, { get: () => async () => ({ message: '', data: {} }) }),
    getInitials: () => '',
    showToast() {},
    confirm: () => true,
    setTimeout: () => 0,
    clearTimeout() {},
    console
  });
  vm.runInContext(leer('js/usuarios.js'), contexto);
  return (expresion) => vm.runInContext(expresion, contexto);
})();

// El cálculo previo como lo arma el servidor (calcularLicencia): la vista de evaluarLicencia y el paso de pasoPrevistoDe, para
// una carga nueva de la persona de planta (admin) que pasa a Configuración. `soyTitular`: es el firmante titular;
// `comoAutorizada`: las licencias del firmante en las que es la persona autorizada
const respuestaDelCalculo = (entrada, {
  soyTitular = false, estado = PLANTA.estado, rol = 'admin', editadaId = null, comoAutorizada = []
} = {}) => {
  const { datos, error, vista } = evaluarLicencia(estado, entrada, { hoy: HOY, feriados: SIN_FERIADOS, editadaId });
  if (datos === null) return comoLlega({ error, vista, paso: null });
  const paso = pasoPrevistoDe({ paso: { accion: 'crear' }, vinculo: null, fila: datos, rol, hoy: HOY, soyTitular, comoAutorizada });
  return comoLlega({ error: null, vista, paso });
};
const VACACIONES = Object.freeze({ tipo: 'vacaciones', desde: '2026-11-16', hasta: '2026-11-20' });
const MEDICA = Object.freeze({ tipo: 'medica', desde: '2026-11-16', hasta: '2026-11-17' });
const FIRMANTE = Object.freeze({
  soy_titular: true, hoy: HOY,
  autorizables: [{ id: 3, nombre_completo: 'Martín Ríos', licencias: [{ desde: '2026-11-18', hasta: '2026-11-18' }],
    ausencias: [{ desde: '2026-11-18', hasta: '2026-11-18', vuelve: '2026-11-19' }] }]
});

describe('los formularios: las paridades', () => {
  it('cada mensaje copiado de MENSAJES_MI_ESPACIO es el del servidor, y las constantes también', () => {
    const copiados = plano(M.MENSAJES_FORMULARIOS);
    assert.ok(Object.keys(copiados).length >= 10);
    for (const [clave, texto] of Object.entries(copiados)) assert.equal(texto, MENSAJES_MI_ESPACIO[clave], clave);
    assert.deepEqual(plano(M.DIAS_VACACIONES), [...DIAS_VACACIONES]);
    assert.deepEqual(plano(M.DIAS_ESTUDIOS), { ...DIAS_ESTUDIOS });
    assert.equal(M.DIAS_POR_EXAMEN, DIAS_POR_EXAMEN);
    assert.equal(M.JORNADA, JORNADA);
    assert.equal(M.LARGO_NOTA, LARGO_NOTA);
    for (const maximo of [0, 7, 15, 25, 30, 42, 200]) assert.equal(M.textoSaldo(maximo), textoSaldo(maximo), String(maximo));
    // La ayuda del campo de la licencia del año del arranque (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.8): la única
    // que cambia con los días que se eligen en el modal
    for (const [maximo, anio] of [[5, 2026], [8, 2026], [10, 2026], [13, 2027], [15, 2025], [0, 2026]]) {
      assert.equal(M.textoSaldoDelArranque(maximo, anio), textoSaldoDelArranque(maximo, anio), `${maximo} ${anio}`);
    }
    assert.equal(M.TEXTO_SIN_ARRANQUE, MENSAJES_MI_ESPACIO.sinArranque);
    // Los tipos de un solo día y los que se cargan en horas
    assert.deepEqual(plano(M.TIPOS_DE_UN_DIA), [...TIPOS_DE_UN_DIA]);
    assert.deepEqual(plano(M.TIPOS_CON_HORAS), [...TIPOS_POR_HORAS]);
  });

  it('horasDelHorario es horasDe: diez horarios, con la medianoche y los que no sirven', () => {
    const horarios = [['18:00', '21:30'], ['19:00', '22:00'], ['09:30', '10:00'], ['22:00', '01:30'], ['23:30', '00:00'],
      ['00:00', '23:30'], ['10:00', '10:00'], ['10:15', '11:00'], ['24:00', '01:00'], ['', '10:00'], [undefined, null],
      ['7:00', '9:00'], ['19:00:00', '22:00']];
    for (const [desde, hasta] of horarios) assert.equal(M.horasDelHorario(desde, hasta), horasDelServidor(desde, hasta), `${desde} a ${hasta}`);
  });

  it('efectoEnNotas, textoSinAuditor, textoAusenciasAutorizado y parametrosSinAuditor dan lo mismo que las de usuarios.js', () => {
    const licencia = { desde: '2026-11-26', vispera: '2026-11-25' };
    for (const [lic, nombre, hoy] of [[{ vispera: '2026-11-25' }, 'Persona Autorizada', ''], [{ vispera: '2026-11-25' }, null, ''],
      [null, null, ''], [licencia, 'Persona Autorizada', '2026-12-02'], [licencia, null, '2026-12-02'], [licencia, null, '2026-11-26'],
      [licencia, null, '2026-11-10'], [licencia, 'Persona Autorizada', '2026-11-10'],
      // A continuación de otra licencia (sin anticipo) y sin días hábiles (spec 2026-10-27-feriados-en-notas, 6): solo el true
      // literal
      [{ desde: '2027-01-04', vispera: null, sin_anticipo: true }, 'Persona Autorizada', '2026-12-21'],
      [{ desde: '2027-01-04', vispera: null, sin_anticipo: true }, null, '2026-12-21'],
      [{ desde: '2027-01-04', vispera: null, sin_anticipo: true }, null, '2027-01-04'],
      [{ desde: '2027-01-04', vispera: '2026-12-31', sin_anticipo: 'true' }, null, '2026-12-21'],
      [{ sin_dias_habiles: true }, 'Persona Autorizada', '2026-10-20'], [{ sin_dias_habiles: true }, null, '2026-10-20'],
      [{ desde: '2026-12-07', vispera: null, sin_dias_habiles: true, sin_anticipo: true }, null, '2026-10-20'],
      [{ desde: '2026-12-07', vispera: '2026-12-04', sin_dias_habiles: 1 }, null, '2026-10-20']]) {
      const argumentos = `${JSON.stringify(lic)}, ${JSON.stringify(nombre)}, ${JSON.stringify(hoy)}`;
      assert.equal(en(`efectoEnNotas(${argumentos})`), usuariosJs(`efectoEnNotas(${argumentos})`), argumentos);
    }
    const periodo = { desde: '2026-12-28', hasta: '2027-01-08', vuelve: '2027-01-11', respaldo: [] };
    for (const uno of [periodo, { ...periodo, hasta: '2026-12-28', vuelve: '2026-12-29' }, { ...periodo, vuelve: null },
      { ...periodo, respaldo: ['Persona A', 'Persona B', 'Persona C'] }, { desde: '2026-12-28', hasta: '2027-01-08', vuelve: '2027-01-11' }]) {
      assert.equal(en(`textoSinAuditor(${JSON.stringify(uno)})`), usuariosJs(`textoSinAuditor(${JSON.stringify(uno)})`));
    }
    const ausencia = (desde, hasta, vuelve) => ({ desde, hasta, vuelve });
    for (const [ausencias, desde, hasta] of [[[ausencia('2027-03-08', '2027-03-12', '2027-03-15')], '2027-03-01', '2027-03-31'],
      [[ausencia('2027-02-22', '2027-03-03', '2027-03-04')], '2027-03-01', '2027-03-31'],
      [[ausencia('2027-03-25', '2027-04-10', '2027-04-12')], '2027-03-01', '2027-03-31'],
      [[ausencia('2027-03-10', '2027-03-10', '2027-03-11')], '2027-03-01', '2027-03-31'],
      [[ausencia('2027-03-22', '2027-03-24', '2027-03-25'), ausencia('2027-03-03', '2027-03-05', '2027-03-08')], '2027-03-01', '2027-03-31'],
      [[ausencia('2027-03-01', '2027-03-05', '2027-03-08')], '2027-03-01', '2027-03-07'], [[], '2027-03-01', '2027-03-31'],
      [[ausencia('2027-03-08', '2027-03-12', '2027-03-15')], '', '2027-03-31']]) {
      const argumentos = `'Persona Autorizada', ${JSON.stringify(ausencias)}, ${JSON.stringify(desde)}, ${JSON.stringify(hasta)}`;
      assert.deepEqual(plano(en(`textoAusenciasAutorizado(${argumentos})`)), plano(usuariosJs(`textoAusenciasAutorizado(${argumentos})`)));
    }
    const completo = { usuarioId: 7, desde: '2026-12-09', hasta: '2027-01-08' };
    for (const cambio of [{}, { excluir: 9 }, { desde: '' }, { desde: '2026-02-30' }, { usuarioId: 0 }, { desde: '2026-01-01', hasta: '2027-01-02' },
      { desde: '2026-01-01', hasta: '2027-01-01' }, { desde: '2026-12-01', hoy: '2026-12-09' }, { desde: '2026-12-01', hasta: '2026-12-08', hoy: '2026-12-09' }]) {
      const pedido = JSON.stringify({ ...completo, ...cambio });
      assert.deepEqual(plano(en(`parametrosSinAuditor(${pedido})`)), plano(usuariosJs(`parametrosSinAuditor(${pedido})`)), pedido);
    }
  });

  // «Mis vacaciones y saldos» muestra los campos de «Para arrancar» con lo que se elige en el modal, antes de guardarlo: el máximo
  // de las vacaciones del año (la primera mitad), su ayuda (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.8) y el campo de
  // los estudios dependen de los días y de la carrera del año. Las ayudas de los años anteriores llegan del servidor y no cambian
  it('camposConLoElegido da los campos de camposDelSaldoInicial con los días y los estudios que se eligen', () => {
    const sinValor = (campos) => plano(campos).map(({ valor, ...campo }) => campo);
    const anteriores = [{ anio: 2024, dias_vacaciones: 25, estudios: null }, { anio: 2025, dias_vacaciones: 15, estudios: 'secundario' }];
    for (const modalidad of ['planta', 'contrato']) {
      for (const arranque of ['2026-10-26', '2026-05-04']) {
        for (const inicial of [[], [{ anio: 2026, dias_vacaciones: 20, estudios: 'universitario' }], anteriores,
          [...anteriores, { anio: 2026, dias_vacaciones: 30, estudios: null }]]) {
          const delServidor = camposDelSaldoInicial({ modalidad, arranque, anios: inicial }).map((campo) => ({ ...campo, valor: null }));
          const deAntes = inicial.filter((delAnio) => delAnio.anio !== 2026);
          for (const dias of DIAS_VACACIONES) {
            for (const estudios of ['universitario', 'secundario', null]) {
              const esperados = camposDelSaldoInicial({
                modalidad, arranque, anios: [...deAntes, { anio: 2026, dias_vacaciones: dias, estudios }]
              });
              const caso = `${modalidad} ${arranque} ${dias} ${estudios} ${inicial.length}`;
              assert.deepEqual(sinValor(M.camposConLoElegido(comoLlega(delServidor), { anio: 2026, dias, estudios })), plano(esperados), caso);
            }
          }
        }
      }
    }
    // Las ayudas, a la vista: con 15 días elegidos, la del año del arranque dice 8; las de antes, sus días
    const conQuince = M.camposConLoElegido(comoLlega(camposDelSaldoInicial({ modalidad: 'planta', arranque: '2026-10-26',
      anios: [...anteriores, { anio: 2026, dias_vacaciones: 30, estudios: null }] })), { anio: 2026, dias: 15, estudios: null });
    assert.deepEqual(plano(conQuince).filter((campo) => campo.concepto === 'vacaciones').map(({ clave, ayuda }) => [clave, ayuda]), [
      ['vacaciones-2024', 'De 0 a 25: los días de la 2024.'], ['vacaciones-2025', 'De 0 a 15: los días de la 2025.'],
      ['vacaciones-2026', 'De 0 a 8: lo que se habilitó de la 2026 hasta hoy.']
    ]);
    // Sin días elegidos, como llegaron; un saldo de otro año (el arranque fue el año pasado), tampoco cambia
    const campos = comoLlega(camposDelSaldoInicial({ modalidad: 'planta', arranque: '2026-10-26', anios: [] }));
    assert.deepEqual(plano(M.camposConLoElegido(campos, { anio: 2026, dias: null, estudios: null })), campos);
    assert.deepEqual(plano(M.camposConLoElegido(campos, { anio: 2027, dias: 30, estudios: 'universitario' })), campos);
  });

  it('erroresDelSaldo: el primer error es el de validarSaldoInicial, en los casos de borde', () => {
    const delAnio = { anio: 2026, dias_vacaciones: 20, estudios: 'secundario' };
    // Sin los días de los años anteriores (sus campos dicen el máximo de una licencia), con ellos (sus días) y con los días del año
    // elegidos en el modal (la ayuda que arma camposConLoElegido): el error de un campo con ayuda es su ayuda, como en el servidor
    const listas = [
      comoLlega(camposDelSaldoInicial({ modalidad: 'contrato', arranque: '2026-10-26', anios: [delAnio] })),
      comoLlega(camposDelSaldoInicial({ modalidad: 'planta', arranque: '2026-10-26', anios: [
        { anio: 2024, dias_vacaciones: 10, estudios: null }, { anio: 2025, dias_vacaciones: 25, estudios: null }, delAnio
      ] })),
      plano(M.camposConLoElegido(comoLlega(camposDelSaldoInicial({ modalidad: 'contrato', arranque: '2026-10-26', anios: [] })),
        { anio: 2026, dias: 15, estudios: 'secundario' }))
    ];
    for (const campos of listas) {
      const llenos = Object.fromEntries(campos.map(({ clave }) => [clave, '0']));
      for (const [clave, texto] of [['vacaciones-2024', '31'], ['vacaciones-2024', '-1'], ['vacaciones-2025', '2,5'], ['vacaciones-2025', '26'],
        ['vacaciones-2026', '11'], ['vacaciones-2026', '9'], ['estudios', '10'], ['estudios', '11'], ['medica', ''], ['medica', 'x'],
        ['familiar', '25'], ['horas_no_utilizadas', '6,5'], ['horas_no_utilizadas', '6,25'], ['horas_no_utilizadas', '200.5'],
        ['vacaciones-2024', ' 8 ']]) {
        if (!campos.some((campo) => campo.clave === clave)) continue;
        const valores = { ...llenos, [clave]: texto };
        const errores = plano(M.erroresDelSaldo(valores, campos));
        const { saldos } = plano(M.cuerpoDelSaldo(valores, campos));
        const delServidor = validarSaldoInicial({ saldos: Object.fromEntries(Object.entries(saldos).filter(([, n]) => n !== null)) }, campos).error;
        const [primero] = Object.entries(errores);
        assert.deepEqual(primero ? { campo: primero[0], mensaje: primero[1] } : null, delServidor, `${clave}: ${texto}`);
      }
    }
    // Con ayuda, la ayuda; sin ella, textoSaldo
    const [campos] = listas;
    const llenos = Object.fromEntries(campos.map(({ clave }) => [clave, '0']));
    assert.deepEqual(plano(M.erroresDelSaldo({ ...llenos, 'vacaciones-2026': '11' }, campos)),
      { 'vacaciones-2026': 'De 0 a 10: lo que se habilitó de la 2026 hasta hoy.' });
    assert.deepEqual(plano(M.erroresDelSaldo({ ...llenos, 'vacaciones-2024': '31' }, campos)),
      { 'vacaciones-2024': 'De 0 a 30, el máximo de una licencia.' });
    assert.deepEqual(plano(M.erroresDelSaldo({ ...llenos, medica: '26' }, campos)), { medica: textoSaldo(25) });
    assert.deepEqual(plano(M.erroresDelSaldo({ ...llenos, 'vacaciones-2024': '31' },
      campos.map((campo) => ({ ...campo, ayuda: '  ' })))), { 'vacaciones-2024': textoSaldo(30) });
    assert.deepEqual(plano(M.erroresDelSaldo(llenos, campos)), {});
    // Lo guardado, con coma; lo que no hay, vacío
    assert.deepEqual(plano(M.valoresDelSaldo([{ clave: 'a', valor: 6.5 }, { clave: 'b', valor: 0 }, { clave: 'c', valor: null }])),
      { a: '6,5', b: '0', c: '' });
  });
});

describe('los formularios: lo puro', () => {
  const tiposDePlanta = resumenDel(PLANTA).tipos;

  // Cada tope del saldo inicial dice de dónde sale (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.8): la ayuda va debajo
  // del campo, antes de su error, y en su aria-describedby; un campo sin ayuda queda como estaba
  it('«Para arrancar»: la ayuda de cada campo, debajo y en su aria-describedby, escapada', () => {
    const campos = comoLlega(camposDelSaldoInicial({ modalidad: 'planta', arranque: '2026-10-26', anios: [
      { anio: 2025, dias_vacaciones: 20, estudios: null }, { anio: 2026, dias_vacaciones: 15, estudios: null }
    ] }));
    const html = M.htmlDeCamposDelSaldo(campos, { 'vacaciones-2025': '4' });
    assert.ok(html.includes('<input type="text" inputmode="decimal" class="form-input" id="ms-campo-vacaciones-2025" '
      + 'data-saldo="vacaciones-2025" value="4" autocomplete="off" '
      + 'aria-describedby="ms-campo-vacaciones-2025-ayuda ms-campo-vacaciones-2025-error">'
      + '<p class="form-hint" id="ms-campo-vacaciones-2025-ayuda">De 0 a 20: los días de la 2025.</p>'
      + '<p class="form-error" id="ms-campo-vacaciones-2025-error" hidden></p>'), html);
    assert.ok(html.includes('<p class="form-hint" id="ms-campo-vacaciones-2024-ayuda">De 0 a 30, el máximo de una licencia.</p>'));
    assert.ok(html.includes('<p class="form-hint" id="ms-campo-vacaciones-2026-ayuda">De 0 a 8: lo que se habilitó de la 2026 hasta hoy.</p>'));
    // Sin ayuda (la médica, o una que llega vacía o sin la clave): sin el párrafo, y el aria-describedby solo con el error
    assert.ok(html.includes('id="ms-campo-medica" data-saldo="medica" value="" autocomplete="off" aria-describedby="ms-campo-medica-error">'
      + '<p class="form-error" id="ms-campo-medica-error" hidden></p>'));
    assert.ok(!html.includes('ms-campo-medica-ayuda'));
    const sinClave = campos.map(({ ayuda, ...campo }) => campo);
    assert.ok(!M.htmlDeCamposDelSaldo(sinClave, {}).includes('-ayuda'));
    assert.ok(!M.htmlDeCamposDelSaldo(campos.map((campo) => ({ ...campo, ayuda: '  ' })), {}).includes('-ayuda'));
    // Todo texto del servidor, escapado
    const conHtml = M.htmlDeCamposDelSaldo([{ ...campos[1], ayuda: '<b>De 0 a 20</b> & "más"' }], {});
    assert.ok(conHtml.includes('>&lt;b&gt;De 0 a 20&lt;/b&gt; &amp; &quot;más&quot;</p>'), conHtml);
  });

  it('los tipos: radios grandes con lo que queda de cada uno, sin el uso autorizado', () => {
    const html = M.htmlDeTiposDeLicencia(tiposDePlanta, 'franquicia');
    assert.ok(textoDe(html).includes('Franquicia Quedan 25 h de 42'));
    assert.ok(!html.includes('Uso autorizado'));
    const radios = [...html.matchAll(/<input ([^>]*)>/g)]
      .map(([, atributos]) => ({ ...atributosDe(atributos), checked: /(^|\s)checked(\s|$)/.test(atributos) }));
    assert.deepEqual(radios.map((radio) => radio.value), tiposDePlanta.map(({ tipo }) => tipo));
    assert.ok(radios.every((radio) => radio.type === 'radio' && radio.name === 'ml-tipo'));
    assert.deepEqual(radios.filter((radio) => radio.checked).map((radio) => radio.value), ['franquicia']);
    // Uno que llega con el uso autorizado no lo ofrece; un nombre con HTML se ve escapado
    const conHtml = M.htmlDeTiposDeLicencia([...tiposDePlanta, { tipo: 'uso_autorizado', nombre: 'Uso autorizado', queda_texto: '' },
      { tipo: 'medica', nombre: MALICIOSO, queda_texto: MALICIOSO }], null);
    assert.ok(!conHtml.includes('Uso autorizado') && !conHtml.includes('<img'));
    assert.ok(conHtml.includes(ESCAPADO));
  });

  it('valoresDeLicencia: los de una fila de la lista, o los de una nueva con su tipo', () => {
    const fila = { ...licenciasDe(PLANTA).licencias[0], nota: 'Viaje', en_configuracion: { licencia_id: 40, autorizado_id: 3 } };
    assert.deepEqual(plano(M.valoresDeLicencia(fila)), {
      id: 6, tipo: 'vacaciones', desde: '2026-11-03', hasta: '2026-11-09', horas: '', nota: 'Viaje', mostrar: true,
      autorizado: '3', autorizado_inicial: '3', licencia_oficial: 40
    });
    assert.deepEqual(plano(M.valoresDeLicencia(null, 'franco')), {
      id: null, tipo: 'franco', desde: '', hasta: '', horas: '', nota: '', mostrar: true, autorizado: '', autorizado_inicial: '',
      licencia_oficial: null
    });
    assert.equal(M.valoresDeLicencia(null).tipo, '');
    assert.equal(M.valoresDeLicencia({ ...fila, tipo: 'franquicia', horas: 2 }).horas, '2');
  });

  it('erroresDeLicencia: los obligatorios, los formatos y la nota, con los mensajes del servidor', () => {
    const errores = (valores, opciones) => plano(M.erroresDeLicencia({ ...M.valoresDeLicencia(null), ...valores }, opciones));
    assert.deepEqual(errores({}), { tipo: MENSAJES_MI_ESPACIO.tipo, desde: MENSAJES_MI_ESPACIO.fecha });
    assert.deepEqual(errores({ ...VACACIONES }), {});
    assert.deepEqual(errores({ ...VACACIONES, hasta: '' }), { hasta: MENSAJES_MI_ESPACIO.fecha });
    assert.deepEqual(errores({ ...VACACIONES, hasta: '2026-11-13' }), { hasta: MENSAJES_MI_ESPACIO.hastaAntes });
    assert.deepEqual(errores({ ...VACACIONES, desde: '2026-02-30' }), { desde: MENSAJES_MI_ESPACIO.fecha });
    // Los de un día no miran el hasta
    assert.deepEqual(errores({ tipo: 'franco', desde: '2026-10-30', hasta: '' }), {});
    // Las horas: la franquicia, enteras de 1 a 7; las horas a favor y el uso autorizado de contrato, de a media hora
    for (const horas of ['', '0', '8', '2.5']) {
      assert.deepEqual(errores({ tipo: 'franquicia', desde: '2026-11-10', horas }), { horas: MENSAJES_MI_ESPACIO.horasEnteras }, horas);
    }
    assert.deepEqual(errores({ tipo: 'franquicia', desde: '2026-11-10', horas: '7' }), {});
    for (const horas of ['', '0', '7.5', '1.25']) {
      assert.deepEqual(errores({ tipo: 'horas_a_favor', desde: '2026-11-10', horas }), { horas: MENSAJES_MI_ESPACIO.horasMedias }, horas);
    }
    assert.deepEqual(errores({ tipo: 'horas_a_favor', desde: '2026-11-10', horas: '0.5' }), {});
    assert.deepEqual(errores({ tipo: 'uso_autorizado', desde: '2026-11-10', horas: '' }, { modalidad: 'contrato' }), { horas: MENSAJES_MI_ESPACIO.horasMedias });
    assert.deepEqual(errores({ tipo: 'uso_autorizado', desde: '2026-11-10', horas: '' }, { modalidad: 'planta' }), {});
    // La nota: hasta 200 caracteres contados con Array.from (un emoji es uno)
    assert.deepEqual(errores({ ...VACACIONES, nota: '😀'.repeat(200) }), {});
    assert.deepEqual(errores({ ...VACACIONES, nota: '😀'.repeat(201) }), { nota: MENSAJES_MI_ESPACIO.nota });
  });

  it('la persona a cargo, solo en vacaciones: cuerpoDeLicencia manda autorizado_id solo en las vacaciones del titular', () => {
    const medica = M.cuerpoDeLicencia({ ...M.valoresDeLicencia(null), ...MEDICA, autorizado: '3' }, { soyTitular: true });
    assert.ok(!Object.hasOwn(medica, 'autorizado_id'));
    assert.deepEqual(plano(medica), { tipo: 'medica', desde: '2026-11-16', hasta: '2026-11-17', mostrar: true, nota: '' });
    const vacaciones = M.cuerpoDeLicencia({ ...M.valoresDeLicencia(null), ...VACACIONES, autorizado: '3' }, { soyTitular: true });
    assert.equal(vacaciones.autorizado_id, 3);
    // Nueva y sin nadie elegido: null (nadie); sin ser el titular, nunca
    assert.equal(M.cuerpoDeLicencia({ ...M.valoresDeLicencia(null), ...VACACIONES }, { soyTitular: true }).autorizado_id, null);
    assert.ok(!Object.hasOwn(M.cuerpoDeLicencia({ ...M.valoresDeLicencia(null), ...VACACIONES, autorizado: '3' }, { soyTitular: false }), 'autorizado_id'));
    // Al corregir, solo si se cambió el campo: si no, el servidor conserva la de Configuración
    const guardada = { ...M.valoresDeLicencia(null), ...VACACIONES, id: 6, autorizado: '3', autorizado_inicial: '3' };
    assert.ok(!Object.hasOwn(M.cuerpoDeLicencia(guardada, { soyTitular: true }), 'autorizado_id'));
    assert.equal(M.cuerpoDeLicencia({ ...guardada, autorizado: '' }, { soyTitular: true }).autorizado_id, null);
    assert.equal(M.cuerpoDeLicencia({ ...guardada, autorizado: '5' }, { soyTitular: true }).autorizado_id, 5);
    // Los de un día van con el hasta igual al desde; las horas, como número y solo en los tipos de horas; la nota, recortada
    assert.deepEqual(plano(M.cuerpoDeLicencia({ ...M.valoresDeLicencia(null), tipo: 'franquicia', desde: '2026-11-10', horas: '3', nota: ' x ', mostrar: false }, {})),
      { tipo: 'franquicia', desde: '2026-11-10', hasta: '2026-11-10', horas: 3, mostrar: false, nota: 'x' });
    assert.ok(!Object.hasOwn(M.cuerpoDeLicencia({ ...M.valoresDeLicencia(null), tipo: 'uso_autorizado', desde: '2026-11-10' }, {}), 'horas'));
  });

  it('el cálculo: los días, de qué licencia salen y lo que queda, escapados', () => {
    const { vista } = respuestaDelCalculo(VACACIONES);
    const html = M.htmlDelCalculo({ error: null, vista, paso: null }, 'vacaciones');
    assert.ok(textoDe(html).startsWith(`${vista.texto_dias}. ${vista.texto_reparto}`));
    assert.match(html, /^<b>/);
    // El máximo por examen, en los estudios
    const estudios = respuestaDelCalculo({ tipo: 'estudios', desde: '2026-11-16', hasta: '2026-11-18' }).vista;
    assert.ok(textoDe(M.htmlDelCalculo({ vista: estudios }, 'estudios')).startsWith('3 días hábiles, el máximo por examen.'));
    assert.equal(M.htmlDelCalculo({ error: { campo: 'desde', mensaje: 'x' }, vista: null, paso: null }, 'vacaciones'), '');
    assert.equal(M.htmlDelCalculo(null, 'vacaciones'), '');
    assert.ok(!M.htmlDelCalculo({ vista: { ...vista, texto_reparto: MALICIOSO } }, 'vacaciones').includes('<img'));
  });

  it('el paso: los avisos del servidor; al titular, en unas vacaciones, el efecto en las notas y las ausencias de quien elige', () => {
    const { paso } = respuestaDelCalculo(VACACIONES, { soyTitular: true });
    assert.equal(paso.pasa, true);
    const opciones = { autorizado: 'Martín Ríos', ausencias: FIRMANTE.autorizables[0].ausencias, hoy: HOY, desde: VACACIONES.desde, hasta: VACACIONES.hasta };
    const textos = [...M.htmlDelPaso(paso, opciones).matchAll(/<p>([\s\S]*?)<\/p>/g)].map(([, texto]) => textoDe(texto));
    assert.deepEqual(textos, [
      AVISO_DEL_PASO,
      en(`efectoEnNotas(${JSON.stringify({ desde: VACACIONES.desde, vispera: paso.firmante.vispera, sin_anticipo: false, sin_dias_habiles: false })}, 'Martín Ríos', '${HOY}')`),
      'Martín Ríos va a estar de licencia el 18/11/2026: ese día no se generan notas. Desde el 19/11/2026 las presenta en tu nombre.'
    ]);
    // Sin nadie elegido, el efecto sin persona autorizada; una médica, solo los avisos del servidor (con el de sin persona a cargo)
    assert.ok(textoDe(M.htmlDelPaso(paso, { ...opciones, autorizado: null })).includes('Sin persona autorizada'));
    // Sin saber quién queda a cargo (conEfecto: false), el efecto no va: ni con nadie ni con una persona
    for (const autorizado of [null, 'Martín Ríos']) {
      assert.deepEqual([...M.htmlDelPaso(paso, { ...opciones, autorizado, conEfecto: false }).matchAll(/<p>([\s\S]*?)<\/p>/g)]
        .map(([, texto]) => texto), [AVISO_DEL_PASO], String(autorizado));
    }
    // A continuación de otra licencia (sin anticipo) o sin días hábiles: lo que dice Configuración (spec 2026-10-27-feriados-en-notas, 6)
    const sinAnticipo = { ...paso, firmante: { ...paso.firmante, vispera: null, sin_anticipo: true } };
    assert.ok(textoDe(M.htmlDelPaso(sinAnticipo, { ...opciones, autorizado: null })).includes(
      'Empieza a continuación de otra licencia: los avisos no se adelantan. Lo que toque avisar y las reiteraciones salen el primer día hábil después de la licencia.'));
    assert.ok(textoDe(M.htmlDelPaso(sinAnticipo, opciones)).includes(
      'Empieza a continuación de otra licencia: los avisos no se adelantan. Desde el primer día, Martín Ríos presenta las notas con las dos firmas, después de la nota que comunica la autorización.'));
    const sinDias = { ...paso, firmante: { ...paso.firmante, vispera: null, sin_dias_habiles: true } };
    for (const autorizado of [null, 'Martín Ríos']) {
      const textosSinDias = [...M.htmlDelPaso(sinDias, { ...opciones, autorizado, ausencias: [] }).matchAll(/<p>([\s\S]*?)<\/p>/g)]
        .map(([, texto]) => textoDe(texto));
      assert.deepEqual(textosSinDias, [AVISO_DEL_PASO, 'No tiene días hábiles: las notas no cambian.'], String(autorizado));
    }
    const medica = respuestaDelCalculo(MEDICA, { soyTitular: true }).paso;
    assert.deepEqual([...M.htmlDelPaso(medica, opciones).matchAll(/<p>([\s\S]*?)<\/p>/g)].map(([, texto]) => texto),
      [AVISO_DEL_PASO, AVISO_SIN_PERSONA_A_CARGO]);
    // Lo que no pasa: lo que dice el servidor de por qué; sin nada, ''
    const unida = { pasa: false, avisos: [], firmante: null, sin_pasar_previsto: 'Ya estaba en Configuración → Licencias, del 02/11 al 13/11.' };
    assert.equal(M.htmlDelPaso(unida, {}), '<p>Ya estaba en Configuración → Licencias, del 02/11 al 13/11.</p>');
    assert.equal(M.htmlDelPaso({ pasa: false, avisos: [], firmante: null, sin_pasar_previsto: null }, {}), '');
    assert.equal(M.htmlDelPaso(null, {}), '');
    assert.ok(!M.htmlDelPaso({ ...paso, avisos: [MALICIOSO] }, { ...opciones, autorizado: MALICIOSO }).includes('<img'));
  });

  it('la suma de las horas extras: lo del día y lo que lleva el mes, con lo que da', () => {
    const planta = horasDe(PLANTA);
    const valores = { id: null, fecha: '2026-10-28', desde: '19:00', hasta: '22:30' };
    assert.equal(M.textoDeLaSuma(valores, planta, 'planta'),
      '3,5 horas. En octubre llevás 14 horas: 2 francos compensatorios para usar en diciembre.');
    // Al corregir, la que se corrige no cuenta dos veces
    assert.equal(M.textoDeLaSuma({ ...valores, id: 13 }, planta, 'planta'),
      '3,5 horas. En octubre llevás 11 horas: 1 franco compensatorio para usar en diciembre.');
    // Sin llegar a 7 horas, sin francos
    assert.equal(M.textoDeLaSuma({ id: null, fecha: '2026-07-20', desde: '18:00', hasta: '19:00' }, planta, 'planta'),
      '1 hora. En julio llevás 6 horas.');
    // El modal de horas es solo de planta: contrato carga en la planilla (spec 2026-10-27-mi-espacio-horas, secciones 4 y 9), que
    // dice su propia suma (htmlDeLaBandaDeLaPlanilla), así que textoDeLaSuma ya no tiene la rama de contrato (Ruling 8)
    // La primera del mes (un mes sin fila en la tabla cuenta 0 horas antes de esta carga): también dice lo que lleva y lo que da
    assert.equal(M.textoDeLaSuma({ id: null, fecha: '2026-05-15', desde: '09:00', hasta: '17:00' }, planta, 'planta'),
      '8 horas. En mayo llevás 8 horas: 1 franco compensatorio para usar en julio.');
    assert.equal(M.textoDeLaSuma({ ...valores, fecha: '2026-11-03' }, planta, 'planta'), '3,5 horas. En noviembre llevás 3,5 horas.');
    // Un mes que ya tiene horas en la tabla: las 14 de agosto, más estas 8
    assert.equal(M.textoDeLaSuma({ id: null, fecha: '2026-08-15', desde: '09:00', hasta: '17:00' }, planta, 'planta'),
      '8 horas. En agosto llevás 22 horas: 3 francos compensatorios para usar en octubre.');
    // Con la tabla vacía del año (ninguna cargada), igual
    const vacia = { ...planta, meses: [], dias_por_mes: {} };
    assert.equal(M.textoDeLaSuma({ id: null, fecha: '2026-08-15', desde: '09:00', hasta: '17:00' }, vacia, 'planta'),
      '8 horas. En agosto llevás 8 horas: 1 franco compensatorio para usar en octubre.');
    // Una fecha de otro año que el de la tabla cargada, o sin tabla: solo las horas; un horario que no sirve, nada
    assert.equal(M.textoDeLaSuma({ ...valores, fecha: '2027-01-05' }, planta, 'planta'), '3,5 horas.');
    assert.equal(M.textoDeLaSuma(valores, { ...planta, anio: null }, 'planta'), '3,5 horas.');
    assert.equal(M.textoDeLaSuma(valores, null, 'planta'), '3,5 horas.');
    assert.equal(M.textoDeLaSuma({ ...valores, hasta: '19:00' }, planta, 'planta'), '');
    // Pasa la medianoche: cuenta en el día en que empezó
    assert.equal(M.textoDeLaSuma({ ...valores, desde: '22:00', hasta: '01:30' }, planta, 'planta'),
      '3,5 horas. En octubre llevás 14 horas: 2 francos compensatorios para usar en diciembre.');
  });

  it('las horas extras: los valores de un día de la tabla, los errores y el cuerpo', () => {
    const [dia] = horasDe(PLANTA).dias_por_mes['2026-10'];
    assert.deepEqual(plano(M.valoresDeHoras(dia)), { id: 13, fecha: '2026-10-22', desde: '19:00', hasta: '22:00', nota: '' });
    assert.deepEqual(plano(M.valoresDeHoras(null)), { id: null, fecha: '', desde: '', hasta: '', nota: '' });
    assert.deepEqual(plano(M.erroresDeHoras(M.valoresDeHoras(null))), { fecha: MENSAJES_MI_ESPACIO.fecha, desde: MENSAJES_MI_ESPACIO.horario });
    assert.deepEqual(plano(M.erroresDeHoras({ ...M.valoresDeHoras(dia), hasta: '22:15' })), { desde: MENSAJES_MI_ESPACIO.horario });
    assert.deepEqual(plano(M.erroresDeHoras({ ...M.valoresDeHoras(dia), nota: 'a'.repeat(201) })), { nota: MENSAJES_MI_ESPACIO.nota });
    assert.deepEqual(plano(M.cuerpoDeHoras({ ...M.valoresDeHoras(dia), nota: ' Cierre ' })),
      { fecha: '2026-10-22', desde: '19:00', hasta: '22:00', nota: 'Cierre' });
  });

  it('la confirmación, en texto plano: qué se borra y, una creada, que se anula en Configuración', () => {
    const [fila] = licenciasDe(PLANTA).licencias;
    assert.equal(M.textoDeConfirmacion(fila), 'Vacaciones del 03/11 al 09/11/2026.');
    assert.equal(M.textoDeConfirmacion({ ...fila, nota: MALICIOSO, en_configuracion: { licencia_id: 40, autorizado_id: null } }),
      `Vacaciones del 03/11 al 09/11/2026 («${MALICIOSO}»). También se anula en Configuración → Licencias.`);
    const [dia] = horasDe(PLANTA).dias_por_mes['2026-10'];
    assert.equal(M.textoDeConfirmacion({ ...dia, nota: 'Cierre' }), 'Horas extras del Jue 22/10, de 19:00 a 22:00 («Cierre»).');
  });
});

// =====================================================================================================================================
// La planilla de horas extras de contrato (spec 2026-10-27-mi-espacio-horas, secciones 4, 5 y 9; Task 7): lo puro, con la planilla
// que arma el servidor (planillaDelMes) pasada por JSON, como la manda GET /api/mi-espacio/salidas. Hoy es el martes 27/10/2026,
// como en la maqueta: el lunes 12/10 es feriado (de la tabla) y el sábado 17/10, uno inventado para los tests (un sábado que además
// es feriado). Las salidas de octubre son las de la maqueta, con las de CONTRATO (el 21/10, a las 19:00): octubre suma 16 horas
// =====================================================================================================================================

const HOY_PLANILLA = '2026-10-27';
const FERIADO_EN_SABADO = Object.freeze({
  ...FERIADO_SOBERANIA, id: 3, fecha: '2026-10-17', nombre: 'Feriado de prueba en sábado', tipo: 'municipal'
});
const FILAS_PLANILLA = Object.freeze([FERIADO_DIVERSIDAD, FERIADO_EN_SABADO]);
const feriadosDeLaPlanilla = (filas) => feriadosDelRango(filas, '2024-01-01', '2027-12-31');
const FERIADOS_PLANILLA = feriadosDeLaPlanilla(FILAS_PLANILLA);
const salidaDe = (id, fecha, salida, entrada = null, nota = null) => ({ id, fecha, entrada, salida, nota });
const SALIDAS_DE_OCTUBRE = Object.freeze([
  salidaDe(10, '2026-10-05', '16:20', '08:02'), // 1,5 h: la entrada no cuenta
  salidaDe(11, '2026-10-09', '17:16'), // 2,5 h, en un día de licencia de día entero: sigue sumando, con su aviso
  salidaDe(12, '2026-10-12', '12:10', '09:21', 'Guardia de la mesa de datos'), // feriado, de la entrada a la salida: 2,5 h
  salidaDe(13, '2026-10-16', '15:05', '07:58'), // 0: no llega a media hora
  salidaDe(14, '2026-10-20', '13:02'), // 0, un día con 2 h a favor
  salidaDe(15, '2026-10-24', '13:20', '09:00', 'Relevamiento en el barrio'), // sábado, de la entrada a la salida: 4,5 h
  salidaDe(16, '2026-10-26', '15:47') // 1 h
]);
const ESTADO_PLANILLA = Object.freeze({ ...CONTRATO.estado, salidas: [...CONTRATO.estado.salidas, ...SALIDAS_DE_OCTUBRE] });
// La planilla de un mes como la manda la API (con otro estado, otro mes u otros feriados si hace falta)
const planillaDel = (estado = ESTADO_PLANILLA, { mes = '2026-10', filas = FILAS_PLANILLA } = {}) => {
  const feriados = feriadosDeLaPlanilla(filas);
  return comoLlega(planillaDelMes(estado, calcular(estado, { hoy: HOY_PLANILLA, feriados }),
    { mes, hoy: HOY_PLANILLA, feriados, filasFeriados: filas }));
};
const OCTUBRE = planillaDel();
// Los días que manda el servidor, por fecha (los del mes y los sábados y domingos para sumar): lo guardado y el tipo de cada uno
const porFechaDe = (...planillas) => new Map(planillas.flatMap((planilla) => [...planilla.dias, ...planilla.fines_de_semana])
  .map((dia) => [dia.fecha, dia]));
const POR_FECHA = porFechaDe(OCTUBRE);
const VACIO = Object.freeze({ cambios: new Map(), agregados: new Set(), errores: new Map(), notasAbiertas: new Set() });
// Las filas de la planilla (los días y los renglones de las semanas, cada uno un <div>, sin semántica de lista: un role="group"
// dentro de un <ol> la rompía): { atributos, clases, html, texto }
const filasDeLaPlanilla = (html) => [...html.matchAll(/<div([^>]*)>([\s\S]*?)<\/div>/g)].map(([, atributos, adentro]) => ({
  atributos: atributosDe(atributos), clases: (atributosDe(atributos).class ?? '').split(' '), html: adentro, texto: textoDe(adentro)
}));
const filaDel = (html, fecha) => filasDeLaPlanilla(html).find(({ atributos }) => atributos.id === `mp-dia-${fecha}`);
const semanasDe = (html) => filasDeLaPlanilla(html).filter(({ clases }) => clases.includes('mp-semana'))
  .map(({ atributos, texto }) => [atributos['data-fechas'], texto]);
const camposDe = (html) => [...html.matchAll(/<input([^>]*)>/g)].map(([, atributos]) => atributosDe(atributos));
const planillaCon = (estado = {}) => M.htmlDeLaPlanilla(OCTUBRE, { ...VACIO, ...estado });
// Los errores de la página, como lista de acá
const erroresDe = (cambios, porFecha = POR_FECHA) => plano([...M.erroresDeLaPlanilla(cambios, porFecha)]);

describe('la planilla de horas extras: las paridades', () => {
  it('las constantes y los mensajes de la planilla son los del servidor', () => {
    assert.equal(M.SALIDA_DE_LA_JORNADA, SALIDA_DE_LA_JORNADA);
    assert.equal(M.TOLERANCIA_DIA_HABIL, TOLERANCIA_DIA_HABIL);
    assert.equal(M.TOLERANCIA_DIA_INHABIL, TOLERANCIA_DIA_INHABIL);
    assert.equal(M.MAXIMO_DIAS_POR_GUARDADO, MAXIMO_DIAS_POR_GUARDADO);
    for (const clave of ['horaSalida', 'salidaQueCuenta', 'salidaFalta', 'entradaFeriado', 'entradaFinde', 'salidaAntes', 'nota', 'muchosDias']) {
      assert.equal(M.MENSAJES_FORMULARIOS[clave], MENSAJES_MI_ESPACIO[clave], clave);
    }
  });

  it('enDiasDeFranco es la del servidor: 7 horas son un día', () => {
    for (const horas of [0, 0.5, 1, 4.5, 7, 8, 14, 18, 18.5, 20.5, 21, 22.5, 70, -3, NaN, Infinity, '18.5', null, undefined, {}]) {
      assert.equal(M.enDiasDeFranco(horas), enDiasDeFranco(horas), String(horas));
    }
    assert.equal(M.enDiasDeFranco(18.5), '2 días de franco y 4,5 horas');
    assert.equal(M.enDiasDeFranco(1), '1 hora');
  });

  it('textoDeLaSumaDelMes es la del servidor: el mes en curso y uno que pasó, con horas y sin horas', () => {
    const casos = [
      ['2026-10', 18, HOY_PLANILLA], ['2026-10', 18.5, HOY_PLANILLA], ['2026-10', 21, HOY_PLANILLA], ['2026-10', 4.5, HOY_PLANILLA],
      ['2026-10', 1, HOY_PLANILLA], ['2026-10', 0, HOY_PLANILLA], ['2026-09', 10.5, HOY_PLANILLA], ['2026-09', 7, HOY_PLANILLA],
      ['2026-09', 0, HOY_PLANILLA], ['2026-12', 21, '2026-12-10'], ['2026-12', 0.5, '2026-12-10'], ['2025-12', 3, HOY_PLANILLA],
      ['2026-10', null, HOY_PLANILLA], ['2026-10', NaN, HOY_PLANILLA], ['2026-10', -2, HOY_PLANILLA],
      // El verbo mira el mes de uso (el siguiente): ya pasó, es el de hoy o todavía no llegó
      ['2026-08', 7, HOY_PLANILLA], ['2026-11', 4, HOY_PLANILLA], ['2027-01', 7, '2027-02-03'], ['2027-01', 7, '2027-03-01'],
      ['2027-02', 1, '2027-02-03'],
      // Los bordes de los años: el mes siguiente tiene que existir
      ['9999-12', 4, HOY_PLANILLA], ['9999-12', 0, HOY_PLANILLA], ['0000-05', 4, HOY_PLANILLA], ['0000-12', 4, HOY_PLANILLA],
      // Sin un mes o un hoy válidos
      [undefined, 4, HOY_PLANILLA], ['2026-13', 4, HOY_PLANILLA], ['2026-1', 4, HOY_PLANILLA], ['2026-10-01', 4, HOY_PLANILLA],
      [202610, 4, HOY_PLANILLA], ['2026-10', 4, undefined], ['2026-10', 4, '2026-02-30'], ['2026-10', 4, '2026-10'], ['2026-10', 4, 20261027]
    ];
    for (const [mes, horas, hoy] of casos) {
      assert.equal(M.textoDeLaSumaDelMes(mes, horas, hoy), textoDeLaSumaDelMes(mes, horas, hoy), `${mes} ${horas} ${hoy}`);
    }
    assert.equal(M.textoDeLaSumaDelMes('2026-10', 18, HOY_PLANILLA), 'En noviembre vas a tener 2 días de franco y 4 horas a favor.');
    assert.equal(M.textoDeLaSumaDelMes('2026-09', 0, HOY_PLANILLA), 'En septiembre no hiciste horas extras.');
  });

  it('horasDelDiaDeLaPlanilla es horasDeLaSalida con el tipo del día: los 19 renglones del CSV, los ejemplos del feriado y los bordes', () => {
    const conFeriado = new Set(['2026-10-12']);
    const conFijos = feriadosDelRango([], '2026-01-01', '2026-12-31');
    // Los 19 renglones del CSV del usuario (mayo de 2026: todos días hábiles), más el 15:14
    const csv = [['2026-05-04', '15:15'], ['2026-05-05', '15:16'], ['2026-05-06', '15:27'], ['2026-05-07', '15:28'],
      ['2026-05-08', '15:29'], ['2026-05-11', '15:44'], ['2026-05-12', '15:45'], ['2026-05-13', '15:46'], ['2026-05-14', '15:47'],
      ['2026-05-15', '16:00'], ['2026-05-18', '16:14'], ['2026-05-19', '16:15'], ['2026-05-20', '16:16'], ['2026-05-21', '16:45'],
      ['2026-05-22', '16:46'], ['2026-05-26', '16:47'], ['2026-05-27', '17:01'], ['2026-05-28', '17:15'], ['2026-05-29', '17:16'],
      ['2026-05-04', '15:14']].map(([fecha, salida]) => [fecha, null, salida, SIN_FERIADOS]);
    // Los del feriado, sábado y domingo (de la entrada a la salida, con 10 minutos de tolerancia)
    const noHabiles = [['09:19', '12:10'], ['09:20', '12:10'], ['09:21', '12:10'], ['08:09', '15:00'], ['08:10', '15:00'],
      ['08:11', '15:00'], ['10:00', '11:19'], ['10:00', '11:20'], ['10:00', '11:49'], ['10:00', '11:50'], ['10:00', '11:21'],
      ['10:00', '11:51'], ['10:00', '10:19'], ['10:00', '10:20']].map(([entrada, salida]) => ['2026-10-24', entrada, salida, SIN_FERIADOS]);
    const bordes = [
      ['2026-10-25', '09:00', '13:20', SIN_FERIADOS], ['2026-10-12', '07:40', '09:10', conFeriado],
      ['2026-10-12', null, '16:46', conFeriado], ['2026-10-12', '', '16:46', conFeriado], ['2026-10-12', '9:05', '16:46', conFeriado],
      ['2026-10-24', '12:00', '11:00', SIN_FERIADOS], ['2026-10-24', '12:00', '12:00', SIN_FERIADOS],
      ['2026-05-25', '09:00', '10:00', conFijos], ['2026-10-12', null, '16:46', SIN_FERIADOS],
      ['2026-05-04', '07:00', '15:16', SIN_FERIADOS], ['2026-05-04', null, '13:02', SIN_FERIADOS],
      ['2026-05-04', '16:00', '16:00', SIN_FERIADOS], ['2026-05-04', '16:30', '16:20', SIN_FERIADOS],
      ['2026-05-04', '9:05', '16:46', SIN_FERIADOS], ['2026-05-04', null, '23:59', SIN_FERIADOS], ['2026-10-24', '00:00', '23:59', SIN_FERIADOS],
      ...[undefined, null, '', '16:46:00', '9:05', '25:00', '24:00', '16:60', 1646].flatMap((salida) =>
        [['2026-05-04', null, salida, SIN_FERIADOS], ['2026-10-24', '09:00', salida, SIN_FERIADOS]])
    ];
    for (const [fecha, entrada, salida, feriados] of [...csv, ...noHabiles, ...bordes]) {
      const caso = `${fecha} ${entrada} ${salida}`;
      assert.equal(M.horasDelDiaDeLaPlanilla({ tipo: tipoDeDia(fecha, feriados), entrada, salida }),
        horasDeLaSalida({ fecha, entrada, salida }, feriados), caso);
    }
    // Un tipo que no es de la planilla, o un día que no es un objeto: null
    for (const raro of [{ tipo: null, salida: '16:46' }, { tipo: 'otro', salida: '16:46' }, null, undefined, 'habil', []]) {
      assert.equal(M.horasDelDiaDeLaPlanilla(raro), null, JSON.stringify(raro));
    }
  });

  it('erroresDeLaPlanilla da el error de validarSalida (pasos 3 a 7) sobre lo que se manda: el mismo campo y el mismo mensaje', () => {
    const contexto = { hoy: HOY_PLANILLA, estado: ESTADO_PLANILLA, feriados: FERIADOS_PLANILLA };
    // El jueves 22/10 (hábil, sin nada), el feriado del 12/10 (con una salida guardada), el domingo 25/10 y el sábado 17/10, que
    // además es feriado (los dos, de los sábados y domingos para sumar)
    const dias = ['2026-10-22', '2026-10-12', '2026-10-25', '2026-10-17'];
    const casos = [
      // 3. las horas, 'HH:MM': la entrada primero (lo que da el <input type="time"> con segundos se corta y pasa)
      ['', '9:05'], ['', '25:00'], ['', '24:00'], ['', '16:60'], ['', '1646'], ['', 'x'], ['9:05', '16:46'], ['9:05', '25:00'],
      ['08:00', '16:46:00'], ['08:00:00', '16:46'], ['08:00:00.000', '16:46:00.000'], [' 08:00', ' 16:46 '],
      // 4. la salida, obligatoria si hay entrada o nota
      ['08:00', ''], ['', '', 'Cierre de mes'], ['08:00', '  '],
      // 5. la entrada, obligatoria en un día que no es hábil
      ['', '12:10'], ['', '12:10', 'Guardia'],
      // 6. la salida, después de la entrada (también en un día hábil)
      ['16:00', '15:59'], ['16:00', '16:00'], ['12:00', '11:00'], ['23:59', '00:00'],
      // 7. la nota: recortada, hasta 200 caracteres contados con Array.from
      ['09:00', '16:46', 'x'.repeat(201)], ['09:00', '16:46', '😀'.repeat(200)], ['09:00', '16:46', `  ${'x'.repeat(200)}  `],
      ['09:00', '16:46', '😀'.repeat(201)],
      // Los que están bien, y un borrado (todo vacío)
      ['', '16:46'], ['09:21', '12:10'], ['09:00', '13:20', 'Mudanza'], ['', ''], ['', '', '   ']
    ];
    let conError = 0;
    for (const fecha of dias) {
      for (const [entrada, salida, nota = ''] of casos) {
        const cambios = new Map([[fecha, { entrada, salida, nota }]]);
        const caso = `${fecha} ${JSON.stringify([entrada, salida, nota])}`;
        const [dia] = plano(M.cuerpoDeLaPlanilla(cambios, [fecha])).dias;
        const delServidor = validarSalida(dia, contexto).error;
        const [deLaPagina] = erroresDe(cambios);
        // Un día que queda como estaba no se manda (fechasCambiadas): no tiene error, ni para la página ni para el servidor
        if (deLaPagina === undefined) assert.equal(delServidor, null, caso);
        else assert.deepEqual(deLaPagina, [fecha, delServidor], caso);
        if (delServidor !== null) conError += 1;
      }
    }
    // Cada paso tiene sus casos con error
    assert.ok(conError >= 50, String(conError));
    // Los mensajes de cada paso, escritos a mano
    const errorDel = (fecha, valor) => erroresDe(new Map([[fecha, { entrada: '', salida: '', nota: '', ...valor }]]))[0]?.[1] ?? null;
    assert.deepEqual(errorDel('2026-10-22', { salida: '9:05' }), { campo: 'salida', mensaje: 'Escribí la hora como 16:45.' });
    assert.deepEqual(errorDel('2026-10-22', { entrada: '9:05', salida: '25:00' }), { campo: 'entrada', mensaje: 'Escribí la hora como 16:45.' });
    assert.deepEqual(errorDel('2026-10-22', { entrada: '08:00' }), { campo: 'salida', mensaje: 'Falta la salida: es la que cuenta.' });
    assert.deepEqual(errorDel('2026-10-25', { nota: 'Mudanza' }), { campo: 'salida', mensaje: 'Falta la salida.' });
    assert.deepEqual(errorDel('2026-10-12', { salida: '12:10' }), { campo: 'entrada', mensaje: 'En un feriado, poné también la entrada.' });
    assert.deepEqual(errorDel('2026-10-17', { salida: '12:10' }), { campo: 'entrada', mensaje: 'En un feriado, poné también la entrada.' });
    assert.deepEqual(errorDel('2026-10-25', { salida: '12:10' }), { campo: 'entrada', mensaje: 'En un sábado o domingo, poné también la entrada.' });
    assert.deepEqual(errorDel('2026-10-22', { entrada: '16:00', salida: '16:00' }), { campo: 'salida', mensaje: 'La salida tiene que ser después de la entrada.' });
    assert.deepEqual(errorDel('2026-10-22', { salida: '16:46', nota: 'x'.repeat(201) }), { campo: 'nota', mensaje: 'La nota puede tener hasta 200 caracteres.' });
    // Con segundos se corta y pasa (Review Focus 1)
    assert.equal(errorDel('2026-10-22', { salida: '16:46:00' }), null);
  });
});

describe('la planilla de horas extras: lo puro', () => {
  it('fechasCambiadas: las que cambiaron; una que volvió a como estaba no cuenta (Review Focus 5), ni un sábado sumado sin nada', () => {
    const cambiadas = (entradas, porFecha = POR_FECHA) => plano(M.fechasCambiadas(new Map(entradas), porFecha));
    assert.deepEqual(cambiadas([['2026-10-22', { entrada: '', salida: '17:00', nota: '' }]]), ['2026-10-22']);
    // Vuelta a como estaba: lo guardado (la nota null es ''), también con los segundos del <input type="time"> o con espacios en la nota
    assert.deepEqual(cambiadas([['2026-10-05', { entrada: '08:02', salida: '16:20', nota: '' }]]), []);
    assert.deepEqual(cambiadas([['2026-10-05', { entrada: '08:02:00', salida: '16:20:00', nota: '   ' }]]), []);
    assert.deepEqual(cambiadas([['2026-10-12', { entrada: '09:21', salida: '12:10', nota: ' Guardia de la mesa de datos ' }]]), []);
    assert.deepEqual(cambiadas([['2026-10-22', { entrada: '', salida: '', nota: '' }]]), []);
    // Un cambio en cada campo cuenta
    assert.deepEqual(cambiadas([['2026-10-05', { entrada: '', salida: '16:20', nota: '' }], ['2026-10-12', { entrada: '09:21', salida: '12:10', nota: 'Otra' }],
      ['2026-10-26', { entrada: '', salida: '15:48', nota: '' }]]), ['2026-10-05', '2026-10-12', '2026-10-26']);
    // Un sábado o domingo sumado sin nada (o quitado sin haber guardado nada) no cuenta; uno guardado que se quita, sí
    assert.deepEqual(cambiadas([['2026-10-25', { entrada: '', salida: '', nota: '' }], ['2026-10-17', { quitar: true }]]), []);
    assert.deepEqual(cambiadas([['2026-10-24', { quitar: true }]]), ['2026-10-24']);
    assert.deepEqual(cambiadas([['2026-10-24', { entrada: '', salida: '', nota: '' }]]), ['2026-10-24']);
    // De varios meses, en orden (uno de un mes que no se pidió se compara con nada)
    assert.deepEqual(cambiadas([['2026-10-22', { entrada: '', salida: '17:00', nota: '' }], ['2026-09-30', { entrada: '', salida: '18:00', nota: '' }],
      ['2026-09-29', { entrada: '', salida: '', nota: '' }]]), ['2026-09-30', '2026-10-22']);
    // Lo que no sirve no tira
    assert.deepEqual(plano(M.fechasCambiadas(null, POR_FECHA)), []);
    assert.deepEqual(plano(M.fechasCambiadas(new Map([['2026-10-22', { entrada: '', salida: '17:00', nota: '' }]]), null)), ['2026-10-22']);
    assert.deepEqual(cambiadas([['x', { salida: '17:00' }], ['2026-10-22', null]]), []);
  });

  it('cuerpoDeLaPlanilla: cada día con su estado completo, las horas cortadas a HH:MM y lo vacío como \'\' (Review Focus 1)', () => {
    const cambios = new Map([
      ['2026-10-22', { entrada: '08:02:00', salida: '16:46:00', nota: '  Cierre del informe  ' }],
      ['2026-10-23', { entrada: '', salida: '16:46:00.000', nota: '' }],
      ['2026-10-24', { quitar: true }],
      ['2026-10-26', { salida: '17:00' }]
    ]);
    assert.deepEqual(plano(M.cuerpoDeLaPlanilla(cambios, ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-26'])), { dias: [
      { fecha: '2026-10-22', entrada: '08:02', salida: '16:46', nota: 'Cierre del informe', al_mes_anterior: false },
      { fecha: '2026-10-23', entrada: '', salida: '16:46', nota: '', al_mes_anterior: false },
      { fecha: '2026-10-24', entrada: '', salida: '', nota: '', al_mes_anterior: false },
      { fecha: '2026-10-26', entrada: '', salida: '17:00', nota: '', al_mes_anterior: false }
    ] });
    // Solo las fechas pedidas, en su orden; sin fechas, ninguno
    assert.deepEqual(plano(M.cuerpoDeLaPlanilla(cambios, ['2026-10-23'])),
      { dias: [{ fecha: '2026-10-23', entrada: '', salida: '16:46', nota: '', al_mes_anterior: false }] });
    assert.deepEqual(plano(M.cuerpoDeLaPlanilla(cambios, [])), { dias: [] });
    assert.deepEqual(plano(M.cuerpoDeLaPlanilla(null, null)), { dias: [] });
  });

  it('textoDeLaSemana: «5 al 9 de octubre», «1 y 2 de octubre», «30 de octubre»', () => {
    assert.equal(M.textoDeLaSemana(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']), '5 al 9 de octubre');
    assert.equal(M.textoDeLaSemana(['2026-10-01', '2026-10-02']), '1 y 2 de octubre');
    assert.equal(M.textoDeLaSemana(['2026-10-30']), '30 de octubre');
    assert.equal(M.textoDeLaSemana(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-25']), '19 al 25 de octubre');
    assert.equal(M.textoDeLaSemana(['2026-05-01', '2026-05-03']), '1 al 3 de mayo');
    assert.equal(M.textoDeLaSemana([]), '');
    assert.equal(M.textoDeLaSemana(null), '');
  });

  it('textoDelPieDeLaPlanilla: «Todo guardado.» o cuántos días tienen cambios, con los meses si son más de uno', () => {
    assert.equal(M.textoDelPieDeLaPlanilla([]), 'Todo guardado.');
    assert.equal(M.textoDelPieDeLaPlanilla(['2026-10-05']), '1 día con cambios sin guardar.');
    assert.equal(M.textoDelPieDeLaPlanilla(['2026-10-05', '2026-10-06', '2026-10-22']), '3 días con cambios sin guardar.');
    assert.equal(M.textoDelPieDeLaPlanilla(['2026-10-05', '2026-09-30', '2026-10-22']), '3 días con cambios sin guardar (septiembre y octubre).');
    assert.equal(M.textoDelPieDeLaPlanilla(['2026-10-05', '2026-09-30', '2026-08-03', '2026-10-22']),
      '4 días con cambios sin guardar (agosto, septiembre y octubre).');
    // El mismo mes de dos años: con el año
    assert.equal(M.textoDelPieDeLaPlanilla(['2025-10-06', '2026-10-05']), '2 días con cambios sin guardar (octubre de 2025 y octubre de 2026).');
    assert.equal(M.textoDelPieDeLaPlanilla(null), 'Todo guardado.');
  });

  it('htmlDeLaBandaDeLaPlanilla: el total en grande y la frase, con lo que se suma en negrita; el texto es el del servidor', () => {
    const banda = M.htmlDeLaBandaDeLaPlanilla('2026-10', 18, HOY_PLANILLA);
    assert.equal(banda, '<span class="mp-suma-cifra">18<small>h</small></span><div class="mp-suma-textos"><p class="mp-suma-texto">'
      + 'En noviembre vas a tener <b>2 días de franco</b> y <b>4 horas a favor</b>.</p><p class="mp-suma-aparte"></p></div>');
    assert.match(M.htmlDeLaBandaDeLaPlanilla('2026-10', 21, HOY_PLANILLA),
      /vas a tener <b>3 días de franco<\/b>\.<\/p><p class="mp-suma-aparte"><\/p><\/div>$/);
    assert.match(M.htmlDeLaBandaDeLaPlanilla('2026-10', 4.5, HOY_PLANILLA),
      /^<span class="mp-suma-cifra">4,5<small>h<\/small><\/span>.*<b>4,5 horas a favor<\/b>\.<\/p><p class="mp-suma-aparte"><\/p><\/div>$/);
    assert.match(M.htmlDeLaBandaDeLaPlanilla('2026-09', 10.5, HOY_PLANILLA), /En octubre tenés <b>1 día de franco<\/b> y <b>3,5 horas a favor<\/b>\./);
    assert.equal(M.htmlDeLaBandaDeLaPlanilla('2026-10', 0, HOY_PLANILLA), '<span class="mp-suma-cifra">0<small>h</small></span>'
      + '<div class="mp-suma-textos"><p class="mp-suma-texto">Todavía no sumaste horas extras en octubre.</p><p class="mp-suma-aparte"></p></div>');
    // El texto de la frase es siempre el de textoDeLaSumaDelMes del servidor (sin las negritas, que no separan palabras)
    const sinNegritas = (html) => textoDe(html.replace(/<\/?b>/g, ''));
    for (const [mes, horas] of [['2026-10', 18], ['2026-10', 18.5], ['2026-10', 21], ['2026-10', 4.5], ['2026-10', 1], ['2026-10', 0],
      ['2026-09', 10.5], ['2026-09', 7], ['2026-09', 0]]) {
      const frase = M.htmlDeLaBandaDeLaPlanilla(mes, horas, HOY_PLANILLA).match(/<p class="mp-suma-texto">([\s\S]*?)<\/p>/)[1];
      assert.equal(sinNegritas(frase), textoDeLaSumaDelMes(mes, horas, HOY_PLANILLA), `${mes} ${horas}`);
    }
    // La de la planilla del servidor, con su suma
    assert.equal(sinNegritas(M.htmlDeLaBandaDeLaPlanilla(OCTUBRE.mes, OCTUBRE.suma.horas, OCTUBRE.hoy)),
      `${OCTUBRE.suma.cifra} h ${OCTUBRE.suma.texto}`);
    // Lo que no es un número: la raya, sin frase de horas
    assert.equal(M.htmlDeLaBandaDeLaPlanilla('2026-10', NaN, HOY_PLANILLA), '<span class="mp-suma-cifra">—<small>h</small></span>'
      + '<div class="mp-suma-textos"><p class="mp-suma-texto">Todavía no sumaste horas extras en octubre.</p><p class="mp-suma-aparte"></p></div>');
  });

  it('diasPorFechaDe, diasVisiblesDeLaPlanilla y horasDeLosDias: sin cambios, la suma es la del servidor', () => {
    const porFecha = M.diasPorFechaDe([OCTUBRE]);
    assert.equal(porFecha.size, 30);
    assert.equal(porFecha.get('2026-10-17').tipo, 'feriado');
    assert.equal(porFecha.get('2026-10-05').salida, '16:20');
    assert.equal(M.diasPorFechaDe([OCTUBRE, planillaDel(ESTADO_PLANILLA, { mes: '2026-09' })]).size, 30 + 30);
    assert.equal(M.diasPorFechaDe(new Map([['2026-10', OCTUBRE]]).values()).size, 30);
    assert.equal(M.diasPorFechaDe(null).size, 0);
    // Los días que se ven: los del servidor (los de lunes a viernes y el sábado 24/10, que tiene una salida)
    const visibles = M.diasVisiblesDeLaPlanilla(OCTUBRE, VACIO);
    assert.deepEqual(plano(visibles.map((dia) => dia.fecha)), OCTUBRE.dias.map((dia) => dia.fecha));
    assert.equal(M.horasDeLosDias(visibles, new Map()), OCTUBRE.suma.horas);
    assert.equal(M.horasDeLosDias(visibles, new Map()), 16);
    // Con los cambios: una salida nueva, una quitada y un domingo sumado
    const cambios = new Map([['2026-10-22', { entrada: '', salida: '16:46', nota: '' }], ['2026-10-09', { quitar: true }],
      ['2026-10-25', { entrada: '09:00', salida: '10:00', nota: '' }]]);
    const conDomingo = M.diasVisiblesDeLaPlanilla(OCTUBRE, { cambios, agregados: new Set(['2026-10-25']) });
    assert.ok(plano(conDomingo.map((dia) => dia.fecha)).includes('2026-10-25'));
    assert.equal(M.horasDeLosDias(conDomingo, cambios), 16 + 2 - 2.5 + 1);
    // Un sábado guardado que se quita no se ve, salvo que se lo vuelva a sumar
    const quitado = new Map([['2026-10-24', { quitar: true }]]);
    assert.ok(!plano(M.diasVisiblesDeLaPlanilla(OCTUBRE, { cambios: quitado }).map((dia) => dia.fecha)).includes('2026-10-24'));
    assert.ok(plano(M.diasVisiblesDeLaPlanilla(OCTUBRE, { cambios: quitado, agregados: new Set(['2026-10-24']) })
      .map((dia) => dia.fecha)).includes('2026-10-24'));
    assert.deepEqual(plano(M.diasVisiblesDeLaPlanilla(null, VACIO)), []);
  });

  it('htmlDeLasHorasDeLaFila: las horas del día mientras se escribe, o por qué todavía no hay', () => {
    const habil = { tipo: 'habil' };
    const feriado = { tipo: 'feriado' };
    const nada = '<b class="nada">—</b>';
    assert.equal(M.htmlDeLasHorasDeLaFila(habil, { entrada: '', salida: '', nota: '' }), nada);
    assert.equal(M.htmlDeLasHorasDeLaFila(habil, { entrada: '08:00', salida: '', nota: '' }), nada);
    assert.equal(M.htmlDeLasHorasDeLaFila(feriado, { entrada: '09:00', salida: '', nota: '' }), `${nada}<small>Falta la salida</small>`);
    assert.equal(M.htmlDeLasHorasDeLaFila(feriado, { entrada: '', salida: '12:10', nota: '' }), `${nada}<small>Poné la entrada</small>`);
    assert.equal(M.htmlDeLasHorasDeLaFila({ tipo: 'finde' }, { entrada: '12:00', salida: '11:00', nota: '' }), `${nada}<small>La salida va después</small>`);
    assert.equal(M.htmlDeLasHorasDeLaFila(habil, { entrada: '16:30', salida: '16:20', nota: '' }), `${nada}<small>La salida va después</small>`);
    assert.equal(M.htmlDeLasHorasDeLaFila(habil, { entrada: '', salida: '15:10', nota: '' }), '<b class="cero">0</b><small>No llega a media hora</small>');
    assert.equal(M.htmlDeLasHorasDeLaFila(habil, { entrada: '', salida: '16:46', nota: '' }), '<b>2 h</b>');
    assert.equal(M.htmlDeLasHorasDeLaFila(habil, { entrada: '', salida: '16:46:00', nota: '' }), '<b>2 h</b>');
    assert.equal(M.htmlDeLasHorasDeLaFila(feriado, { entrada: '09:21', salida: '12:10', nota: '' }), '<b>2,5 h</b>');
    // Una hora que no se puede leer: sin horas
    assert.equal(M.htmlDeLasHorasDeLaFila(habil, { entrada: '', salida: '9:05', nota: '' }), nada);
    assert.equal(M.htmlDeLasHorasDeLaFila(feriado, { entrada: '9:05', salida: '12:10', nota: '' }), nada);
    assert.equal(M.htmlDeLasHorasDeLaFila(null, null), nada);
  });
});

describe('la planilla de horas extras: htmlDeLaPlanilla', () => {
  const html = planillaCon();

  it('las semanas: un renglón con sus días y lo que suman, y después sus filas, en orden', () => {
    assert.deepEqual(semanasDe(html), [
      ['2026-10-01,2026-10-02', '1 y 2 de octubre —'],
      ['2026-10-05,2026-10-06,2026-10-07,2026-10-08,2026-10-09', '5 al 9 de octubre 4 h'],
      ['2026-10-12,2026-10-13,2026-10-14,2026-10-15,2026-10-16', '12 al 16 de octubre 2,5 h'],
      ['2026-10-19,2026-10-20,2026-10-21,2026-10-22,2026-10-23,2026-10-24', '19 al 24 de octubre 8,5 h'],
      ['2026-10-26,2026-10-27,2026-10-28,2026-10-29,2026-10-30', '26 al 30 de octubre 1 h']
    ]);
    const orden = filasDeLaPlanilla(html).map(({ atributos }) => atributos.id ?? 'semana');
    assert.deepEqual(orden.slice(0, 4), ['semana', 'mp-dia-2026-10-01', 'mp-dia-2026-10-02', 'semana']);
    assert.equal(orden.filter((uno) => uno !== 'semana').length, OCTUBRE.dias.length);
    assert.deepEqual(orden.filter((uno) => uno !== 'semana'), OCTUBRE.dias.map((dia) => `mp-dia-${dia.fecha}`));
    // Sin semántica de lista (va en un <div>): ningún <li>, y el total de cada semana en su propio span (la página lo cambia
    // mientras se escribe)
    assert.doesNotMatch(html, /<li\b|<ol\b|<ul\b/);
    assert.equal((html.match(/<span class="mp-semana-total">/g) ?? []).length, 5);
  });

  it('un día hábil: un grupo con el nombre de su fecha, la entrada opcional, la salida, las horas y «Nota»', () => {
    const fila = filaDel(html, '2026-10-05');
    assert.deepEqual(fila.clases, ['mp-dia']);
    assert.equal(fila.atributos.role, 'group');
    assert.equal(fila.atributos['aria-labelledby'], 'mp-f-2026-10-05');
    assert.ok(fila.html.includes('<b id="mp-f-2026-10-05">Lun 05/10</b>'));
    assert.equal(fila.texto, 'Lun 05/10 Entrada (opcional) Salida 1,5 h Sumar a septiembre Nota');
    assert.deepEqual(camposDe(fila.html), [
      { type: 'time', class: 'opcional', 'data-campo': 'entrada', 'data-fecha': '2026-10-05', value: '08:02', 'data-vacio': '0',
        'aria-label': 'Entrada (opcional) del lunes 05/10' },
      { type: 'time', 'data-campo': 'salida', 'data-fecha': '2026-10-05', value: '16:20', 'aria-label': 'Salida del lunes 05/10' },
      { type: 'checkbox', 'data-campo': 'al_mes_anterior', 'data-fecha': '2026-10-05', 'aria-label': 'Sumar a septiembre el lunes 05/10' }
    ]);
    assert.ok(fila.html.includes('<span class="mp-horas" id="mp-h-2026-10-05"><b>1,5 h</b></span>'));
    assert.deepEqual(botonesDe(fila.html).map(({ atributos, texto }) => [texto, atributos['data-nota'], atributos['aria-expanded'], atributos['aria-label']]),
      [['Nota', '2026-10-05', 'false', 'Agregar una nota del lunes 05/10']]);
    // Las horas son de la página, no regiones vivas
    assert.doesNotMatch(html, /aria-live|role="status"|role="alert"/);
    // Sin salida, la raya; la entrada vacía, en gris (data-vacio)
    const vacio = filaDel(html, '2026-10-06');
    assert.equal(vacio.texto, 'Mar 06/10 Entrada (opcional) Salida — Sumar a septiembre Nota');
    assert.deepEqual(camposDe(vacio.html).map((campo) => [campo.value, campo['data-vacio']]), [['', '1'], ['', undefined], [undefined, undefined]]);
    // Los que dan 0
    assert.equal(filaDel(html, '2026-10-16').texto, 'Vie 16/10 Entrada (opcional) Salida 0 No llega a media hora Sumar a septiembre Nota');
  });

  it('el feriado, con su nombre en ámbar y la entrada obligatoria; el sábado con salida, con «Quitar»; las notas', () => {
    const feriado = filaDel(html, '2026-10-12');
    assert.deepEqual(feriado.clases, ['mp-dia', 'feriado']);
    assert.ok(feriado.html.includes('<span class="mp-marcas"><span class="me-insignia ambar">Feriado: Día del Respeto a la Diversidad Cultural</span></span>'));
    assert.equal(feriado.texto,
      'Lun 12/10 Feriado: Día del Respeto a la Diversidad Cultural Entrada Salida 2,5 h Sumar a septiembre Cambiar nota Guardia de la mesa de datos');
    const [entrada] = camposDe(feriado.html);
    assert.equal(entrada.class, undefined);
    assert.equal(entrada['aria-label'], 'Entrada del lunes 12/10');
    // Con nota y cerrada: la nota en cursiva y «Cambiar nota»
    assert.ok(feriado.html.includes('<p class="mp-nota-vista">Guardia de la mesa de datos</p>'));
    assert.deepEqual(botonesDe(feriado.html).map(({ atributos, texto }) => [texto, atributos['aria-expanded'], atributos['aria-label']]),
      [['Cambiar nota', 'false', 'Cambiar la nota del lunes 12/10']]);

    const sabado = filaDel(html, '2026-10-24');
    assert.deepEqual(sabado.clases, ['mp-dia', 'finde']);
    assert.equal(sabado.texto, 'Sáb 24/10 Sábado Entrada Salida 4,5 h Sumar a septiembre Quitar Cambiar nota Relevamiento en el barrio');
    assert.ok(sabado.html.includes('<span class="me-insignia borde">Sábado</span>'));
    assert.deepEqual(botonesDe(sabado.html).map(({ atributos, texto }) => [texto, atributos['data-quitar'], atributos['aria-label']]),
      [['Quitar', '2026-10-24', 'Quitar el sábado 24/10'], ['Cambiar nota', undefined, 'Cambiar la nota del sábado 24/10']]);

    // La nota abierta: su campo debajo de la fila, sin la nota en cursiva
    const abierta = filaDel(planillaCon({ notasAbiertas: new Set(['2026-10-12']) }), '2026-10-12');
    assert.ok(!abierta.html.includes('mp-nota-vista'));
    assert.deepEqual(camposDe(abierta.html)[3], {
      type: 'text', 'data-campo': 'nota', 'data-fecha': '2026-10-12', value: 'Guardia de la mesa de datos',
      placeholder: 'Por ejemplo: cierre del informe mensual', 'aria-label': 'Nota del lunes 12/10'
    });
    assert.equal(botonesDe(abierta.html)[0].atributos['aria-expanded'], 'true');
    assert.ok(!abierta.html.includes('maxlength'));
  });

  it('las licencias: la de unas horas, con su etiqueta; la de día entero, sin campos; con una salida de antes, su aviso y «Quitar»', () => {
    // Las 2 horas a favor del 20/10 se cargan normal, con su etiqueta verde
    const del20 = filaDel(html, '2026-10-20');
    assert.deepEqual(del20.clases, ['mp-dia']);
    assert.equal(del20.texto, 'Mar 20/10 2 h a favor Entrada (opcional) Salida 0 No llega a media hora Sumar a septiembre Nota');
    assert.ok(del20.html.includes('<span class="me-insignia verde">2 h a favor</span>'));
    assert.equal(camposDe(del20.html).length, 3);
    // Los estudios del 13/10: el día entero, sin campos ni grupo
    const del13 = filaDel(html, '2026-10-13');
    assert.deepEqual(del13.clases, ['mp-dia', 'licencia']);
    assert.equal(del13.texto, 'Mar 13/10 Estudios Es un día de licencia: no se cargan horas.');
    assert.equal(del13.atributos.role, undefined);
    assert.deepEqual(camposDe(del13.html), []);
    assert.deepEqual(botonesDe(del13.html), []);
    // Las horas a favor del 9/10, el día entero, con la salida guardada de antes: como texto, sus horas, el aviso y «Quitar»
    const del9 = filaDel(html, '2026-10-09');
    assert.deepEqual(del9.clases, ['mp-dia', 'licencia']);
    assert.equal(del9.atributos.role, 'group');
    assert.equal(del9.texto, 'Vie 09/10 Horas a favor, el día entero Salida 17:16 2,5 h Quitar Ese día tenés una licencia de día entero: revisá esta salida.');
    assert.deepEqual(camposDe(del9.html), []);
    assert.ok(del9.html.includes('<p class="mp-aviso" id="mp-a-2026-10-09">Ese día tenés una licencia de día entero: revisá esta salida.</p>'));
    assert.deepEqual(botonesDe(del9.html).map(({ atributos, texto }) => [texto, atributos['data-quitar'], atributos['aria-label'], atributos['aria-describedby']]),
      [['Quitar', '2026-10-09', 'Quitar la salida del viernes 09/10', 'mp-a-2026-10-09']]);
    // Quitada: el día de licencia, con la raya de lo cambiado; ya no suma en su semana
    const quitada = planillaCon({ cambios: new Map([['2026-10-09', { quitar: true }]]) });
    assert.deepEqual(filaDel(quitada, '2026-10-09').clases, ['mp-dia', 'licencia', 'cambiado']);
    assert.equal(filaDel(quitada, '2026-10-09').texto, 'Vie 09/10 Horas a favor, el día entero Es un día de licencia: no se cargan horas.');
    assert.equal(semanasDe(quitada)[1][1], '5 al 9 de octubre 1,5 h');
    // Con la entrada guardada, también como texto
    const conEntrada = planillaDel({ ...ESTADO_PLANILLA, salidas: [...CONTRATO.estado.salidas, salidaDe(11, '2026-10-09', '17:16', '08:05')] });
    assert.equal(filaDel(M.htmlDeLaPlanilla(conEntrada, VACIO), '2026-10-09').texto,
      'Vie 09/10 Horas a favor, el día entero Salida 17:16 Entrada 08:05 2,5 h Quitar Ese día tenés una licencia de día entero: revisá esta salida.');
  });

  it('hoy lleva «Hoy» y se carga; los días que todavía no llegaron, en gris y sin campos', () => {
    const hoy = filaDel(html, '2026-10-27');
    assert.deepEqual(hoy.clases, ['mp-dia', 'hoy']);
    assert.ok(hoy.html.includes('<b id="mp-f-2026-10-27">Mar 27/10 <span class="mp-hoy">Hoy</span></b>'));
    assert.equal(camposDe(hoy.html).length, 3);
    const futuro = filaDel(html, '2026-10-28');
    assert.deepEqual(futuro.clases, ['mp-dia', 'futuro']);
    assert.equal(futuro.texto, 'Mié 28/10 Todavía no llegó.');
    assert.deepEqual(camposDe(futuro.html), []);
    assert.equal(futuro.atributos.role, undefined);
    // El grupo familiar del 30/10, que todavía no llegó: los dos
    const del30 = filaDel(html, '2026-10-30');
    assert.deepEqual(del30.clases, ['mp-dia', 'licencia', 'futuro']);
    assert.equal(del30.texto, 'Vie 30/10 Atención del grupo familiar Todavía no llegó.');
    // Ninguno de los demás días es hoy
    assert.equal(filasDeLaPlanilla(html).filter(({ clases }) => clases.includes('hoy')).length, 1);
  });

  it('los cambios: lo cambiado lleva la raya; un error, en su fila y en su campo (aria-invalid y aria-describedby)', () => {
    const cambios = new Map([['2026-10-22', { entrada: '08:00', salida: '', nota: '' }], ['2026-10-26', { entrada: '', salida: '15:47', nota: '' }],
      ['2026-10-23', { entrada: '', salida: '17:16', nota: '' }]]);
    const errores = new Map([['2026-10-22', { campo: 'salida', mensaje: MENSAJES_MI_ESPACIO.salidaQueCuenta }]]);
    const conError = planillaCon({ cambios, errores });
    const fila = filaDel(conError, '2026-10-22');
    assert.deepEqual(fila.clases, ['mp-dia', 'cambiado']);
    assert.ok(fila.html.includes('<p class="mp-error" id="mp-e-2026-10-22">Falta la salida: es la que cuenta.</p>'));
    const [entrada, salida] = camposDe(fila.html);
    assert.deepEqual([entrada.value, entrada['data-vacio'], entrada['aria-invalid'], entrada['aria-describedby']], ['08:00', '0', undefined, undefined]);
    assert.deepEqual([salida.value, salida['aria-invalid'], salida['aria-describedby']], ['', 'true', 'mp-e-2026-10-22']);
    // Vuelto a como estaba (el 26/10), sin raya; uno nuevo con sus horas (el 23/10), con raya y en el total de su semana
    assert.deepEqual(filaDel(conError, '2026-10-26').clases, ['mp-dia']);
    assert.deepEqual(filaDel(conError, '2026-10-23').clases, ['mp-dia', 'cambiado']);
    assert.ok(filaDel(conError, '2026-10-23').html.includes('<b>2,5 h</b>'));
    assert.equal(semanasDe(conError)[3][1], '19 al 24 de octubre 11 h');
    // Un error en la entrada, en la entrada; uno en la nota abre la nota; uno sin campo de la fila (del servidor), en la salida
    const enLaEntrada = filaDel(planillaCon({ cambios: new Map([['2026-10-12', { entrada: '', salida: '12:10', nota: '' }]]),
      errores: new Map([['2026-10-12', { campo: 'entrada', mensaje: MENSAJES_MI_ESPACIO.entradaFeriado }]]) }), '2026-10-12');
    assert.deepEqual(camposDe(enLaEntrada.html).map((campo) => [campo['data-campo'], campo['aria-invalid'], campo['aria-describedby']]),
      [['entrada', 'true', 'mp-e-2026-10-12'], ['salida', undefined, undefined], ['al_mes_anterior', undefined, undefined]]);
    const enLaNota = filaDel(planillaCon({ cambios: new Map([['2026-10-22', { entrada: '', salida: '16:46', nota: 'x'.repeat(201) }]]),
      errores: new Map([['2026-10-22', { campo: 'nota', mensaje: MENSAJES_MI_ESPACIO.nota }]]) }), '2026-10-22');
    assert.deepEqual(camposDe(enLaNota.html).map((campo) => [campo['data-campo'], campo['aria-invalid'], campo['aria-describedby']]),
      [['entrada', undefined, undefined], ['salida', undefined, undefined], ['al_mes_anterior', undefined, undefined],
        ['nota', 'true', 'mp-e-2026-10-22']]);
    const sinCampo = filaDel(planillaCon({ cambios: new Map([['2026-10-22', { entrada: '', salida: '16:46', nota: '' }]]),
      errores: new Map([['2026-10-22', { campo: 'fecha', mensaje: MENSAJES_MI_ESPACIO.diaDeLicencia }]]) }), '2026-10-22');
    assert.deepEqual(camposDe(sinCampo.html).map((campo) => [campo['data-campo'], campo['aria-invalid'], campo['aria-describedby']]),
      [['entrada', undefined, undefined], ['salida', 'true', 'mp-e-2026-10-22'], ['al_mes_anterior', undefined, undefined]]);
    assert.ok(sinCampo.html.includes(`<p class="mp-error" id="mp-e-2026-10-22">${MENSAJES_MI_ESPACIO.diaDeLicencia}</p>`));
  });

  it('un error del servidor en una fila sin campos queda atado a algo que recibe el foco: la fila, o «Quitar» con el aviso', () => {
    // Un día que todavía no llegó (el servidor ya cambió de día) o uno de licencia sin salida: la fila es un grupo con su nombre,
    // recibe el foco (tabindex="-1") y el error la describe
    const errores = new Map([['2026-10-28', { campo: 'fecha', mensaje: MENSAJES_MI_ESPACIO.diaQueNoLlego }],
      ['2026-10-13', { campo: 'fecha', mensaje: MENSAJES_MI_ESPACIO.diaDeLicencia }]]);
    const html = planillaCon({ errores });
    for (const fecha of ['2026-10-28', '2026-10-13']) {
      const fila = filaDel(html, fecha);
      assert.deepEqual([fila.atributos.role, fila.atributos['aria-labelledby'], fila.atributos.tabindex, fila.atributos['aria-describedby']],
        ['group', `mp-f-${fecha}`, '-1', `mp-e-${fecha}`], fecha);
      assert.ok(fila.html.includes(`<p class="mp-error" id="mp-e-${fecha}">`), fecha);
    }
    // Sin error, como siempre: ni grupo ni foco
    assert.equal(filaDel(planillaCon(), '2026-10-28').atributos.tabindex, undefined);
    // Una licencia de día entero con una salida de antes: «Quitar» la describe con el aviso y con el error
    const del9 = filaDel(planillaCon({ errores: new Map([['2026-10-09', { campo: 'fecha', mensaje: MENSAJES_MI_ESPACIO.diaDeLicencia }]]) }), '2026-10-09');
    assert.equal(botonesDe(del9.html)[0].atributos['aria-describedby'], 'mp-a-2026-10-09 mp-e-2026-10-09');
    assert.equal(del9.atributos.tabindex, undefined);
  });

  it('el pie en negrita, «Sumar el día» y los textos de la planilla', () => {
    // El pie: la cuenta en negrita, con el mismo texto que textoDelPieDeLaPlanilla
    assert.equal(M.htmlDelPieDeLaPlanilla([]), 'Todo guardado.');
    assert.equal(M.htmlDelPieDeLaPlanilla(['2026-10-05', '2026-09-30', '2026-10-22']),
      '<b>3 días</b> con cambios sin guardar (septiembre y octubre).');
    assert.equal(M.htmlDelPieDeLaPlanilla(['2026-10-05']), '<b>1 día</b> con cambios sin guardar.');
    for (const fechas of [[], ['2026-10-05'], ['2026-10-05', '2026-09-30', '2026-08-03'], ['2025-10-06', '2026-10-05'], null]) {
      assert.equal(textoDe(M.htmlDelPieDeLaPlanilla(fechas)).replace(/ \./g, '.'), M.textoDelPieDeLaPlanilla(fechas), JSON.stringify(fechas));
    }
    // «Sumar el día»: los sábados y domingos que no se ven, con su texto corto, y el botón; sin ninguno, por qué
    const sumar = M.htmlDelSumarDeLaPlanilla(OCTUBRE, VACIO);
    assert.match(sumar, /^<label class="form-label" for="mp-finde">¿Trabajaste un sábado o un domingo\?<\/label><select class="form-select" id="mp-finde">/);
    assert.deepEqual([...sumar.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map(([, valor, texto]) => [valor, texto]), [
      ['2026-10-03', 'Sáb 03/10'], ['2026-10-04', 'Dom 04/10'], ['2026-10-10', 'Sáb 10/10'], ['2026-10-11', 'Dom 11/10'],
      ['2026-10-17', 'Sáb 17/10'], ['2026-10-18', 'Dom 18/10'], ['2026-10-25', 'Dom 25/10']
    ]);
    assert.ok(sumar.endsWith('<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" id="mp-sumar-boton">Sumar el día</button>'));
    const todos = new Set(OCTUBRE.fines_de_semana.map((dia) => dia.fecha));
    assert.equal(M.htmlDelSumarDeLaPlanilla(OCTUBRE, { ...VACIO, agregados: todos }), '<p>No quedan sábados ni domingos para sumar en octubre.</p>');
    const rara = comoLlega(OCTUBRE);
    rara.fines_de_semana[0].fecha_texto = MALICIOSO;
    assert.ok(M.htmlDelSumarDeLaPlanilla(rara, VACIO).includes(`<option value="2026-10-03">${ESCAPADO}</option>`));
    for (const valor of [undefined, null, {}, 'x']) assert.equal(M.htmlDelSumarDeLaPlanilla(valor, VACIO), '', String(valor));
    // Lo que dicen el modal de salir, el aviso de los errores y «Cómo se cuentan»
    assert.equal(M.textoDeSalirSinGuardar(1), 'Los cambios de 1 día se pierden.');
    assert.equal(M.textoDeSalirSinGuardar(3), 'Los cambios de 3 días se pierden.');
    assert.equal(M.textoDeLosErroresDeLaPlanilla(1), 'Revisá el día marcado.');
    assert.equal(M.textoDeLosErroresDeLaPlanilla(2), 'Revisá los 2 días marcados.');
    assert.equal(M.textoDeComoSeCuentan('2026-10'), 'Las horas de octubre son horas a favor en noviembre.');
    assert.equal(M.textoDeComoSeCuentan('2026-12'), 'Las horas de diciembre son horas a favor en enero.');
    assert.equal(M.textoDeComoSeCuentan('x'), '');
  });

  it('un día que pasó a ser feriado: su aviso, mientras no se cambie, y «Poné la entrada»', () => {
    const filas = [...FILAS_PLANILLA, { ...FERIADO_DIVERSIDAD, id: 4, fecha: '2026-10-21', nombre: 'Feriado cargado después' }];
    const conFeriado = planillaDel(ESTADO_PLANILLA, { filas });
    const fila = filaDel(M.htmlDeLaPlanilla(conFeriado, VACIO), '2026-10-21');
    assert.deepEqual(fila.clases, ['mp-dia', 'feriado']);
    assert.equal(fila.texto,
      'Mié 21/10 Feriado: Feriado cargado después Entrada Salida — Poné la entrada Sumar a septiembre Nota Ahora es feriado: falta la entrada.');
    assert.equal(camposDe(fila.html)[1]['aria-describedby'], 'mp-a-2026-10-21');
    // Con la entrada, ya no
    const arreglada = filaDel(M.htmlDeLaPlanilla(conFeriado, { ...VACIO, cambios: new Map([['2026-10-21', { entrada: '18:00', salida: '19:00', nota: '' }]]) }), '2026-10-21');
    assert.equal(arreglada.texto, 'Mié 21/10 Feriado: Feriado cargado después Entrada Salida 1 h Sumar a septiembre Nota');
    assert.equal(camposDe(arreglada.html)[1]['aria-describedby'], undefined);
  });

  it('los sábados y domingos: uno sumado aparece en su semana, con «Quitar»; uno guardado que se quita, no', () => {
    const conDomingo = planillaCon({ agregados: new Set(['2026-10-25', '2026-10-17']) });
    const domingo = filaDel(conDomingo, '2026-10-25');
    assert.deepEqual(domingo.clases, ['mp-dia', 'finde']);
    assert.equal(domingo.texto, 'Dom 25/10 Domingo Entrada Salida — Sumar a septiembre Quitar Nota');
    assert.equal(camposDe(domingo.html)[0]['aria-label'], 'Entrada del domingo 25/10');
    assert.deepEqual(semanasDe(conDomingo).map(([, texto]) => texto), ['1 y 2 de octubre —', '5 al 9 de octubre 4 h',
      '12 al 17 de octubre 2,5 h', '19 al 25 de octubre 8,5 h', '26 al 30 de octubre 1 h']);
    // El sábado 17/10, que además es feriado: con su nombre y «Quitar»
    const sabado = filaDel(conDomingo, '2026-10-17');
    assert.deepEqual(sabado.clases, ['mp-dia', 'feriado']);
    assert.equal(sabado.texto, 'Sáb 17/10 Feriado: Feriado de prueba en sábado Entrada Salida — Sumar a septiembre Quitar Nota');
    // El sábado 24/10 guardado y quitado no se ve; vuelto a sumar, sí, vacío y cambiado
    const quitado = planillaCon({ cambios: new Map([['2026-10-24', { quitar: true }]]) });
    assert.equal(filaDel(quitado, '2026-10-24'), undefined);
    assert.equal(semanasDe(quitado)[3][1], '19 al 23 de octubre 4 h');
    const deVuelta = filaDel(planillaCon({ cambios: new Map([['2026-10-24', { quitar: true }]]), agregados: new Set(['2026-10-24']) }), '2026-10-24');
    assert.deepEqual(deVuelta.clases, ['mp-dia', 'finde', 'cambiado']);
    assert.deepEqual(camposDe(deVuelta.html).map((campo) => campo.value), ['', '', undefined]);
    // Un día de los sábados y domingos que no está sumado no se ve
    assert.equal(filaDel(html, '2026-10-25'), undefined);
    // Los que se pueden sumar: los que no se ven (hasta hoy: el 31/10 todavía no llegó), también el sábado guardado que se quitó
    const paraSumar = (estado) => plano(M.finesDeSemanaParaSumar(OCTUBRE, { ...VACIO, ...estado }).map((dia) => dia.fecha));
    assert.deepEqual(paraSumar({}), ['2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11', '2026-10-17', '2026-10-18', '2026-10-25']);
    assert.deepEqual(paraSumar({ agregados: new Set(['2026-10-25', '2026-10-17']) }),
      ['2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11', '2026-10-18']);
    assert.deepEqual(paraSumar({ cambios: new Map([['2026-10-24', { quitar: true }]]) }),
      ['2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11', '2026-10-17', '2026-10-18', '2026-10-24', '2026-10-25']);
    assert.equal(M.finesDeSemanaParaSumar(OCTUBRE, VACIO)[4].tipo, 'feriado');
    assert.deepEqual(plano(M.finesDeSemanaParaSumar(null, VACIO)), []);
  });

  it('todo texto pasa por escapeHtml, también en los atributos: un feriado con <b> en el nombre, una nota, una licencia y un aviso', () => {
    const conHtml = planillaDel(ESTADO_PLANILLA, { filas: [{ ...FERIADO_DIVERSIDAD, nombre: 'Día del <b>Respeto</b>' }, FERIADO_EN_SABADO] });
    const salida = M.htmlDeLaPlanilla(conHtml, VACIO);
    assert.ok(!salida.includes('<b>Respeto'));
    assert.ok(filaDel(salida, '2026-10-12').html.includes('Feriado: Día del &lt;b&gt;Respeto&lt;/b&gt;'));
    // Lo que llega raro del servidor y lo que se escribe en la página
    const rara = comoLlega(OCTUBRE);
    const delDia = (fecha) => rara.dias.find((dia) => dia.fecha === fecha);
    delDia('2026-10-13').licencia.texto = MALICIOSO;
    delDia('2026-10-09').aviso = MALICIOSO;
    delDia('2026-10-05').fecha_larga = CON_COMILLAS;
    delDia('2026-10-05').fecha_texto = MALICIOSO;
    const cambios = new Map([['2026-10-22', { entrada: CON_COMILLAS, salida: '16:46', nota: MALICIOSO }]]);
    const todo = M.htmlDeLaPlanilla(rara, { ...VACIO, cambios, notasAbiertas: new Set(['2026-10-22']),
      errores: new Map([['2026-10-22', { campo: 'entrada', mensaje: MALICIOSO }]]) });
    assert.ok(!todo.includes('<img'));
    assert.ok(filaDel(todo, '2026-10-13').html.includes(`<span class="me-insignia verde">${ESCAPADO}</span>`));
    assert.ok(filaDel(todo, '2026-10-09').html.includes(`>${ESCAPADO}</p>`));
    assert.ok(filaDel(todo, '2026-10-05').html.includes(`aria-label="Salida del ${CON_COMILLAS_ESCAPADO}"`));
    assert.ok(filaDel(todo, '2026-10-05').html.includes(`<b id="mp-f-2026-10-05">${ESCAPADO}</b>`));
    const del22 = filaDel(todo, '2026-10-22');
    assert.ok(del22.html.includes(`value="${CON_COMILLAS_ESCAPADO}"`));
    assert.ok(del22.html.includes(`value="${ESCAPADO}"`));
    assert.ok(del22.html.includes(`<p class="mp-error" id="mp-e-2026-10-22">${ESCAPADO}</p>`));
  });

  it('lo que no sirve no tira: una planilla que no llegó, o un estado sin lo que hace falta', () => {
    for (const planilla of [undefined, null, {}, [], 'x', { dias: null }, { dias: [null, 3, { fecha: 'x' }] }]) {
      assert.equal(M.htmlDeLaPlanilla(planilla, VACIO), '', JSON.stringify(planilla));
      assert.equal(M.htmlDeLaPlanilla(planilla), '', JSON.stringify(planilla));
    }
    assert.equal(M.htmlDeLaPlanilla(OCTUBRE), html);
    assert.equal(M.htmlDeLaPlanilla(OCTUBRE, { cambios: null, agregados: [], errores: 'x', notasAbiertas: {} }), html);
    for (const funcion of ['erroresDeLaPlanilla', 'fechasCambiadas', 'cuerpoDeLaPlanilla', 'diasVisiblesDeLaPlanilla', 'horasDeLosDias',
      'textoDeLaSemana', 'textoDelPieDeLaPlanilla', 'htmlDeLaBandaDeLaPlanilla', 'htmlDeLasHorasDeLaFila', 'diasPorFechaDe',
      'finesDeSemanaParaSumar', 'htmlDeDiaPorDiaDeSalidas']) {
      for (const valor of [undefined, null, {}, [], 'x', 3, new Map([['x', 'y']])]) {
        assert.doesNotThrow(() => M[funcion](valor, valor, valor), `${funcion}(${String(valor)})`);
      }
    }
  });
});

describe('el día por día de contrato: las salidas', () => {
  const tabla = comoLlega(tablaDeHorasExtras(ESTADO_PLANILLA, calcular(ESTADO_PLANILLA, { hoy: HOY_PLANILLA, feriados: FERIADOS_PLANILLA }),
    { anio: 2026, hoy: HOY_PLANILLA, feriados: FERIADOS_PLANILLA }));

  it('cada día con su horario, la entrada de un día hábil, sus horas, la marca del día, el aviso, la nota y «Editar»', () => {
    const html = M.htmlDeDiaPorDiaDeSalidas(tabla, '2026-10');
    assert.match(html, /<h3>Octubre 2026, día por día<\/h3><span>16 horas<\/span>/);
    assert.deepEqual(filasDe(html).map(({ texto }) => texto), [
      'Lun 26/10 Salida 15:47 1 h Editar',
      'Sáb 24/10 Sábado De 09:00 a 13:20 4,5 h Relevamiento en el barrio Editar',
      'Mié 21/10 Salida 19:00 4 h Editar',
      'Mar 20/10 Salida 13:02 0 No llega a media hora Editar',
      'Vie 16/10 Salida 15:05 Entrada 07:58 0 No llega a media hora Editar',
      'Lun 12/10 Feriado De 09:21 a 12:10 2,5 h Guardia de la mesa de datos Editar',
      'Vie 09/10 Salida 17:16 2,5 h Ese día tenés una licencia de día entero: revisá esta salida. Editar',
      'Lun 05/10 Salida 16:20 Entrada 08:02 1,5 h Editar'
    ]);
    // Los que dan 0, en gris
    assert.deepEqual(filasDe(html).map(({ clases }) => clases.includes('tenue')), [false, false, false, true, true, false, false, false]);
    // «Editar» abre la planilla en ese día: la fecha, y el nombre largo del día
    assert.deepEqual(botonesDe(html).map(({ atributos, texto }) => [texto, atributos['data-editar-salida'], atributos['aria-label']]), [
      ['Editar', '2026-10-26', 'Editar el lunes 26/10'], ['Editar', '2026-10-24', 'Editar el sábado 24/10'],
      ['Editar', '2026-10-21', 'Editar el miércoles 21/10'], ['Editar', '2026-10-20', 'Editar el martes 20/10'],
      ['Editar', '2026-10-16', 'Editar el viernes 16/10'], ['Editar', '2026-10-12', 'Editar el lunes 12/10'],
      ['Editar', '2026-10-09', 'Editar el viernes 09/10'], ['Editar', '2026-10-05', 'Editar el lunes 05/10']
    ]);
    assert.doesNotMatch(html, /data-editar-horas/);
    assert.ok(html.includes('<span class="me-dia-horas">1,5 h</span>'));
    assert.ok(html.includes('<span class="me-fila-fecha">Lun 12/10<small>Feriado</small></span>'));
    assert.ok(html.includes('<span class="me-detalle me-fila-aviso">Ese día tenés una licencia de día entero: revisá esta salida.</span>'));
    assert.ok(html.includes('<span class="me-detalle me-fila-nota">Guardia de la mesa de datos</span>'));
    // Septiembre (de CONTRATO); un mes que no está en la tabla, nada
    assert.equal(filasDe(M.htmlDeDiaPorDiaDeSalidas(tabla, '2026-09')).length, 3);
    assert.equal(M.htmlDeDiaPorDiaDeSalidas(tabla, '2026-05'), '');
    assert.equal(M.htmlDeDiaPorDiaDeSalidas(tabla, null), '');
    for (const raro of [undefined, null, {}]) assert.equal(M.htmlDeDiaPorDiaDeSalidas(raro, '2026-10'), '');
  });

  it('un día que pasó a ser feriado, sin horas y con su aviso; todo texto escapado', () => {
    const filas = [...FILAS_PLANILLA, { ...FERIADO_DIVERSIDAD, id: 4, fecha: '2026-10-21', nombre: 'Feriado cargado después' }];
    const feriados = feriadosDeLaPlanilla(filas);
    const conFeriado = comoLlega(tablaDeHorasExtras(ESTADO_PLANILLA, calcular(ESTADO_PLANILLA, { hoy: HOY_PLANILLA, feriados }),
      { anio: 2026, hoy: HOY_PLANILLA, feriados }));
    const del21 = filasDe(M.htmlDeDiaPorDiaDeSalidas(conFeriado, '2026-10')).find(({ texto }) => texto.startsWith('Mié 21/10'));
    assert.equal(del21.texto, 'Mié 21/10 Feriado Salida 19:00 Ahora es feriado: falta la entrada. Editar');
    assert.ok(!del21.html.includes('me-dia-horas'));

    const rara = comoLlega(tabla);
    Object.assign(rara.dias_por_mes['2026-10'][0], { nota: MALICIOSO, fecha_texto: MALICIOSO, tipo_texto: MALICIOSO, horario: MALICIOSO,
      entrada_texto: MALICIOSO, horas_texto: MALICIOSO, aviso: MALICIOSO, fecha: '" onclick="alerta()' });
    const html = M.htmlDeDiaPorDiaDeSalidas(rara, '2026-10');
    assert.ok(!html.includes('<img') && !html.includes('" onclick'));
    // La fecha corta (dos veces: en la fila y en el nombre del botón), la marca, el horario, la entrada, las horas, el aviso y la nota
    assert.equal(html.split(ESCAPADO).length - 1, 8);
    // Sin una fecha que sirva, el texto corto del día en el nombre del botón
    assert.deepEqual(Object.entries(botonesDe(html)[0].atributos).filter(([clave]) => clave !== 'type' && clave !== 'class'),
      [['data-editar-salida', '&quot; onclick=&quot;alerta()'], ['aria-label', `Editar el ${ESCAPADO}`]]);
  });
});

// =====================================================================================================================================
// «Sumar a {mes anterior}» en la planilla y en la pestaña (spec 2026-10-30-mi-espacio-horas-mes-anterior, secciones 4 y 5; Task 5):
// lo puro, con lo que arma el servidor (planillaDelMes y tablaDeHorasExtras) pasado por JSON. Los datos son los de la maqueta, todos
// inventados: la persona de contrato de los casos, hoy el miércoles 03/02/2027; en enero de 2027 suma 5,5 h; el martes 02/02 sale a
// las 16:20 (1,5 h) con «Sumar a enero» tildado y el miércoles 03/02 a las 15:50 (1 h), sin tildar. Enero suma 7 h y febrero, 1 h
// =====================================================================================================================================

const HOY_FEBRERO = '2027-02-03';
const FERIADOS_FEBRERO = feriadosDelRango([], '2025-01-01', '2027-12-31');
const salidaTildable = (id, fecha, salida, { entrada = null, nota = null, alMesAnterior = false } = {}) =>
  ({ id, fecha, entrada, salida, nota, al_mes_anterior: alMesAnterior });
const SALIDAS_DE_ENERO_Y_FEBRERO = Object.freeze([
  salidaTildable(51, '2027-01-05', '15:46'), // 1 h
  salidaTildable(52, '2027-01-07', '15:20', { entrada: '08:03' }), // 0,5 h
  salidaTildable(53, '2027-01-12', '16:16', { nota: 'Actualización del tablero de obras' }), // 1,5 h
  salidaTildable(54, '2027-01-18', '15:05'), // 0
  salidaTildable(55, '2027-01-20', '17:16'), // 2,5 h
  salidaTildable(56, '2027-02-02', '16:20', { alMesAnterior: true }), // 1,5 h, a enero
  salidaTildable(57, '2027-02-03', '15:50') // 1 h
]);
const ESTADO_FEBRERO = Object.freeze({ ...CONTRATO.estado, salidas: SALIDAS_DE_ENERO_Y_FEBRERO });
const planillaDeFebrero = (mes, { estado = ESTADO_FEBRERO, hoy = HOY_FEBRERO } = {}) => comoLlega(planillaDelMes(estado,
  calcular(estado, { hoy, feriados: FERIADOS_FEBRERO }), { mes, hoy, feriados: FERIADOS_FEBRERO, filasFeriados: [] }));
const tablaDeFebrero = (anio, { estado = ESTADO_FEBRERO, hoy = HOY_FEBRERO } = {}) => comoLlega(tablaDeHorasExtras(estado,
  calcular(estado, { hoy, feriados: FERIADOS_FEBRERO }), { anio, hoy, feriados: FERIADOS_FEBRERO }));
const ENERO_27 = planillaDeFebrero('2027-01');
const FEBRERO_27 = planillaDeFebrero('2027-02');
// Las listas de repartoDelMes del servidor para un mes de estas salidas (`entran` y `van`, cada día `{ fecha, horas, fila }`)
const repartoDeFebrero = (mes, salidas = SALIDAS_DE_ENERO_Y_FEBRERO) => repartoDelMes(salidas, mes, FERIADOS_FEBRERO);
const CON_B_X = '<b>"x"</b>';
const CON_B_X_ESCAPADO = '&lt;b&gt;&quot;x&quot;&lt;/b&gt;';
// Lo que dicen las listas del vm, como [fecha, horas]
const fechasYHoras = (lista) => plano(lista.map((uno) => [uno.fecha, uno.horas]));

describe('«Sumar a {mes anterior}»: las paridades', () => {
  it('el servidor manda lo de la maqueta: enero suma 7 h con el 02/02, que entra de febrero; febrero, 1 h', () => {
    assert.equal(ENERO_27.sumar_a, 'diciembre');
    assert.equal(FEBRERO_27.sumar_a, 'enero');
    assert.deepEqual(ENERO_27.entran.map((dia) => [dia.fecha, dia.horas, dia.al_mes_anterior]), [['2027-02-02', 1.5, true]]);
    assert.deepEqual(FEBRERO_27.entran, []);
    assert.deepEqual(ENERO_27.suma, { horas: 7, cifra: '7', texto: 'En febrero tenés 1 día de franco.', detalle: 'Incluye 1,5 h de febrero.' });
    assert.deepEqual(FEBRERO_27.suma, {
      horas: 1, cifra: '1', texto: 'En marzo vas a tener 1 hora a favor.', detalle: '1,5 h del martes 02/02 suman a enero.'
    });
  });

  it('textoDeLoQueSeMueve es la del servidor: lo que entra del mes siguiente y lo que se va al anterior', () => {
    const de = (fecha, horas) => ({ fecha, horas });
    const casos = [
      // Lo de la maqueta
      ['2027-01', repartoDeFebrero('2027-01').entran, repartoDeFebrero('2027-01').van],
      ['2027-02', repartoDeFebrero('2027-02').entran, repartoDeFebrero('2027-02').van],
      // Un día, dos y tres o más; «suma» con 1 h; las dos cosas a la vez
      ['2027-02', [], [de('2027-02-03', 1)]], ['2027-02', [], [de('2027-02-02', 1.5), de('2027-02-04', 2)]],
      ['2027-02', [], [de('2027-02-01', 1), de('2027-02-02', 1.5), de('2027-02-04', 1.5)]],
      ['2027-01', [de('2027-02-02', 1.5), de('2027-02-03', 1)], [de('2027-01-05', 0.5)]],
      // Solo cuentan los que dan horas: 0, null, lo que no es un número, un día sin fecha
      ['2027-02', [de('2027-03-01', 0)], [de('2027-02-02', 0), de('2027-02-03', null)]],
      ['2027-02', [de('2027-03-01', '1.5'), de('x', 2), de(undefined, 2), null, 3], [de('2027-02-02', NaN), de('2027-02-03', Infinity), de('2027-02-04', -1)]],
      ['2027-02', [], [de('2027-02-02', 0), de('2027-02-03', 1)]],
      // Cruzando el año: diciembre recibe de enero, y lo de enero va a diciembre
      ['2026-12', [de('2027-01-05', 2)], []], ['2027-01', [], [de('2027-01-05', 2)]],
      // Los bordes de los años (mesMas): sin mes siguiente o sin anterior, esa frase no va
      ['9999-12', [de('2027-02-02', 1)], []], ['0001-01', [], [de('2027-02-02', 1)]], ['0000-05', [de('2027-02-02', 1)], [de('2027-02-02', 1)]],
      // Nada que decir, o un mes que no sirve
      ['2027-02', [], []], ['2027-02', null, undefined], ['2027-02', 'x', {}],
      ['2027-13', [de('2027-02-02', 1)], []], [undefined, [], [de('2027-02-02', 1)]], ['2027-2', [], []], [202702, [], []]
    ];
    for (const [mes, entran, van] of casos) {
      assert.equal(M.textoDeLoQueSeMueve(mes, entran, van), textoDeLoQueSeMueve(mes, entran, van), `${mes} ${JSON.stringify([entran, van])}`);
    }
    // Los textos de la spec, escritos a mano
    assert.equal(M.textoDeLoQueSeMueve('2027-01', [de('2027-02-02', 1.5)], []), 'Incluye 1,5 h de febrero.');
    assert.equal(M.textoDeLoQueSeMueve('2027-02', [], [de('2027-02-02', 1.5)]), '1,5 h del martes 02/02 suman a enero.');
    assert.equal(M.textoDeLoQueSeMueve('2027-02', [], [de('2027-02-03', 1)]), '1 h del miércoles 03/02 suma a enero.');
    assert.equal(M.textoDeLoQueSeMueve('2027-02', [], [de('2027-02-02', 1), de('2027-02-04', 0.5)]),
      '1,5 h del martes 02/02 y del jueves 04/02 suman a enero.');
    assert.equal(M.textoDeLoQueSeMueve('2027-02', [], [de('2027-02-01', 1), de('2027-02-02', 1.5), de('2027-02-04', 1.5)]),
      '4 h de 3 días suman a enero.');
    assert.equal(M.textoDeLoQueSeMueve('2027-01', [de('2027-02-02', 1.5)], [de('2027-01-05', 1)]),
      'Incluye 1,5 h de febrero. 1 h del martes 05/01 suma a diciembre.');
    assert.equal(M.textoDeLoQueSeMueve('2027-02', [], []), '');
  });

  it('las listas de la página (diasQueEntran y diasQueSumanAlAnterior) dan el texto del servidor', () => {
    const visibles = M.diasVisiblesDeLaPlanilla(FEBRERO_27, VACIO);
    assert.equal(M.textoDeLoQueSeMueve('2027-02', M.diasQueEntran(FEBRERO_27, VACIO), M.diasQueSumanAlAnterior(visibles, new Map())),
      FEBRERO_27.suma.detalle);
    const visiblesDeEnero = M.diasVisiblesDeLaPlanilla(ENERO_27, VACIO);
    assert.equal(M.textoDeLoQueSeMueve('2027-01', M.diasQueEntran(ENERO_27, VACIO), M.diasQueSumanAlAnterior(visiblesDeEnero, new Map())),
      ENERO_27.suma.detalle);
    // Y la cifra: los días sin tildar del mes más los que entran es lo que suma el servidor
    const cifra = (planilla, estado = VACIO) => M.horasDeLosDias(M.diasVisiblesDeLaPlanilla(planilla, estado), estado.cambios)
      + M.diasQueEntran(planilla, estado).reduce((suma, uno) => suma + (uno.horas ?? 0), 0);
    assert.equal(cifra(ENERO_27), ENERO_27.suma.horas);
    assert.equal(cifra(FEBRERO_27), FEBRERO_27.suma.horas);
  });

  it('la frase de la banda con el verbo del mes de uso: con hoy en él, «tenés»; antes, «vas a tener»; después, «tuviste»', () => {
    const frase = (mes, horas, hoy) => textoDe(M.htmlDeLaBandaDeLaPlanilla(mes, horas, hoy).replace(/<\/?b>/g, '')
      .match(/<p class="mp-suma-texto">([\s\S]*?)<\/p>/)[1]);
    const casos = [['2027-01', 7, '2027-02-03'], ['2027-01', 7, '2027-01-20'], ['2027-01', 7, '2027-03-01'], ['2027-02', 1, '2027-02-03'],
      ['2027-02', 8.5, '2027-03-31'], ['2027-02', 1, '2027-04-01'], ['2026-12', 7, '2027-01-04'], ['2026-12', 7, '2026-12-15']];
    for (const [mes, horas, hoy] of casos) {
      assert.equal(M.textoDeLaSumaDelMes(mes, horas, hoy), textoDeLaSumaDelMes(mes, horas, hoy), `${mes} ${horas} ${hoy}`);
      assert.equal(frase(mes, horas, hoy), textoDeLaSumaDelMes(mes, horas, hoy), `${mes} ${horas} ${hoy}`);
    }
    assert.equal(M.textoDeLaSumaDelMes('2027-01', 7, '2027-02-03'), 'En febrero tenés 1 día de franco.');
    assert.equal(M.textoDeLaSumaDelMes('2027-01', 7, '2027-01-20'), 'En febrero vas a tener 1 día de franco.');
    assert.equal(M.textoDeLaSumaDelMes('2027-01', 7, '2027-03-01'), 'En febrero tuviste 1 día de franco.');
    assert.equal(M.textoDeLaSumaDelMes('2026-12', 7, '2027-01-04'), 'En enero tenés 1 día de franco.');
  });
});

describe('«Sumar a {mes anterior}»: lo de un día', () => {
  it('valoresDeLaSalida: el tilde, solo el true literal y con una salida', () => {
    assert.deepEqual(plano(M.valoresDeLaSalida({ entrada: '', salida: '16:20', nota: '', al_mes_anterior: true })),
      { entrada: '', salida: '16:20', nota: '', al_mes_anterior: true });
    assert.deepEqual(plano(M.valoresDeLaSalida({ salida: '16:20:00', al_mes_anterior: true })),
      { entrada: '', salida: '16:20', nota: '', al_mes_anterior: true });
    // Sin salida (también solo espacios), un «Quitar» o lo que no es el true literal: sin tilde
    for (const fuente of [{ entrada: '08:00', salida: '', nota: 'x', al_mes_anterior: true }, { salida: '   ', al_mes_anterior: true },
      { quitar: true, salida: '16:20', al_mes_anterior: true }, { salida: '16:20', al_mes_anterior: 'true' },
      { salida: '16:20', al_mes_anterior: 1 }, { salida: '16:20' }, null, undefined, 'x']) {
      assert.equal(M.valoresDeLaSalida(fuente).al_mes_anterior, false, JSON.stringify(fuente));
    }
  });

  it('valorDelDia: el tilde del cambio o lo guardado, como se ve; un «Quitar», sin tilde', () => {
    const del02 = FEBRERO_27.dias.find((dia) => dia.fecha === '2027-02-02');
    const del03 = FEBRERO_27.dias.find((dia) => dia.fecha === '2027-02-03');
    assert.deepEqual(plano(M.valorDelDia(del02, undefined)), { entrada: '', salida: '16:20', nota: '', al_mes_anterior: true });
    assert.deepEqual(plano(M.valorDelDia(del03, undefined)), { entrada: '', salida: '15:50', nota: '', al_mes_anterior: false });
    assert.deepEqual(plano(M.valorDelDia(del03, { entrada: '', salida: '15:50', nota: '', al_mes_anterior: true })),
      { entrada: '', salida: '15:50', nota: '', al_mes_anterior: true });
    // Como se escribió: sin salida, el tilde queda (se ve oculto); lo que se manda, sin él
    assert.deepEqual(plano(M.valorDelDia(del02, { entrada: '', salida: '', nota: '', al_mes_anterior: true })),
      { entrada: '', salida: '', nota: '', al_mes_anterior: true });
    assert.deepEqual(plano(M.valorDelDia(del02, { quitar: true })), { entrada: '', salida: '', nota: '', al_mes_anterior: false });
    assert.deepEqual(plano(M.valorDelDia(null, null)), { entrada: '', salida: '', nota: '', al_mes_anterior: false });
    assert.equal(M.valorDelDia({ salida: '16:20', al_mes_anterior: 'si' }, undefined).al_mes_anterior, false);
  });

  it('fechasCambiadas: tildar o destildar es un cambio; volver a como estaba, no', () => {
    const porFecha = porFechaDe(FEBRERO_27);
    const cambiadas = (entradas) => plano(M.fechasCambiadas(new Map(entradas), porFecha));
    assert.deepEqual(cambiadas([['2027-02-03', { entrada: '', salida: '15:50', nota: '', al_mes_anterior: true }]]), ['2027-02-03']);
    assert.deepEqual(cambiadas([['2027-02-02', { entrada: '', salida: '16:20', nota: '', al_mes_anterior: false }]]), ['2027-02-02']);
    assert.deepEqual(cambiadas([['2027-02-02', { entrada: '', salida: '16:20', nota: '', al_mes_anterior: true }],
      ['2027-02-03', { entrada: '', salida: '15:50', nota: '', al_mes_anterior: false }]]), []);
    // Un tilde sin salida no es nada: un día vacío sigue sin cambios
    assert.deepEqual(cambiadas([['2027-02-01', { entrada: '', salida: '', nota: '', al_mes_anterior: true }]]), []);
  });

  it('cuerpoDeLaPlanilla: cada día manda su tilde, un booleano; sin salida, false', () => {
    const cambios = new Map([
      ['2027-02-02', { entrada: '', salida: '16:20', nota: '', al_mes_anterior: false }],
      ['2027-02-03', { entrada: '', salida: '15:50:00', nota: ' ', al_mes_anterior: true }],
      ['2027-02-01', { entrada: '', salida: '', nota: '', al_mes_anterior: true }],
      ['2027-01-29', { quitar: true }]
    ]);
    assert.deepEqual(plano(M.cuerpoDeLaPlanilla(cambios, ['2027-01-29', '2027-02-01', '2027-02-02', '2027-02-03'])), { dias: [
      { fecha: '2027-01-29', entrada: '', salida: '', nota: '', al_mes_anterior: false },
      { fecha: '2027-02-01', entrada: '', salida: '', nota: '', al_mes_anterior: false },
      { fecha: '2027-02-02', entrada: '', salida: '16:20', nota: '', al_mes_anterior: false },
      { fecha: '2027-02-03', entrada: '', salida: '15:50', nota: '', al_mes_anterior: true }
    ] });
    // El servidor lo acepta: un booleano
    for (const dia of plano(M.cuerpoDeLaPlanilla(cambios, ['2027-02-02', '2027-02-03'])).dias) {
      assert.equal(validarSalida(dia, { hoy: HOY_FEBRERO, estado: ESTADO_FEBRERO, feriados: FERIADOS_FEBRERO }).error, null, dia.fecha);
    }
  });

  it('horasDeLosDias no suma los días tildados (la banda y el total de cada semana); diasQueSumanAlAnterior, solo ellos', () => {
    const visibles = M.diasVisiblesDeLaPlanilla(FEBRERO_27, VACIO);
    assert.equal(M.horasDeLosDias(visibles, new Map()), 1);
    assert.equal(M.horasDeLosDias(visibles, new Map()), repartoDeFebrero('2027-02').propias);
    assert.deepEqual(fechasYHoras(M.diasQueSumanAlAnterior(visibles, new Map())), [['2027-02-02', 1.5]]);
    // Tildar el 03/02 sin guardar: no suma nada en febrero; destildar el 02/02, suma los dos
    const tildados = new Map([['2027-02-03', { entrada: '', salida: '15:50', nota: '', al_mes_anterior: true }]]);
    assert.equal(M.horasDeLosDias(visibles, tildados), 0);
    assert.deepEqual(fechasYHoras(M.diasQueSumanAlAnterior(visibles, tildados)), [['2027-02-02', 1.5], ['2027-02-03', 1]]);
    const destildado = new Map([['2027-02-02', { entrada: '', salida: '16:20', nota: '', al_mes_anterior: false }]]);
    assert.equal(M.horasDeLosDias(visibles, destildado), 2.5);
    assert.deepEqual(fechasYHoras(M.diasQueSumanAlAnterior(visibles, destildado)), []);
    // Un tildado que da 0, o que todavía no tiene horas, va con 0 o null; el día viene con él
    const conCero = new Map([['2027-02-02', { entrada: '', salida: '15:10', nota: '', al_mes_anterior: true }]]);
    assert.deepEqual(fechasYHoras(M.diasQueSumanAlAnterior(visibles, conCero)), [['2027-02-02', 0]]);
    assert.equal(M.diasQueSumanAlAnterior(visibles, new Map())[0].dia.fecha, '2027-02-02');
    for (const raro of [undefined, null, {}, 'x']) assert.deepEqual(plano(M.diasQueSumanAlAnterior(raro, raro)), [], String(raro));
  });

  it('diasQueEntran: los tildados del mes siguiente, de lo que mandó el servidor o, si ya se pidió, de ese mes con los cambios', () => {
    // Sin el mes siguiente pedido: lo de `entran`
    const soloEntran = M.diasQueEntran(ENERO_27, VACIO);
    assert.deepEqual(fechasYHoras(soloEntran), [['2027-02-02', 1.5]]);
    assert.deepEqual(plano(soloEntran[0].dia), ENERO_27.entran[0]);
    assert.deepEqual(fechasYHoras(M.diasQueEntran(ENERO_27)), [['2027-02-02', 1.5]]);
    // Con los cambios encima: destildado sin guardar, ya no entra
    const destildado = new Map([['2027-02-02', { entrada: '', salida: '16:20', nota: '', al_mes_anterior: false }]]);
    assert.deepEqual(fechasYHoras(M.diasQueEntran(ENERO_27, { ...VACIO, cambios: destildado })), []);
    // Con febrero ya pedido (`meses`): sus días visibles con los cambios, también uno tildado sin guardar, por fecha
    const meses = new Map([['2027-01', ENERO_27], ['2027-02', FEBRERO_27]]);
    assert.deepEqual(fechasYHoras(M.diasQueEntran(ENERO_27, { ...VACIO, meses })), [['2027-02-02', 1.5]]);
    const tildado = new Map([['2027-02-03', { entrada: '', salida: '15:50', nota: '', al_mes_anterior: true }]]);
    assert.deepEqual(fechasYHoras(M.diasQueEntran(ENERO_27, { ...VACIO, meses, cambios: tildado })), [['2027-02-02', 1.5], ['2027-02-03', 1]]);
    assert.deepEqual(fechasYHoras(M.diasQueEntran(ENERO_27, { ...VACIO, meses, cambios: destildado })), []);
    // Con otra salida escrita sin guardar, sus horas nuevas
    const otraSalida = new Map([['2027-02-02', { entrada: '', salida: '17:16', nota: '', al_mes_anterior: true }]]);
    assert.deepEqual(fechasYHoras(M.diasQueEntran(ENERO_27, { ...VACIO, meses, cambios: otraSalida })), [['2027-02-02', 2.5]]);
    // El mes de hoy no recibe nada (el siguiente no llegó); lo que no sirve, nada
    assert.deepEqual(fechasYHoras(M.diasQueEntran(FEBRERO_27, { ...VACIO, meses })), []);
    for (const raro of [undefined, null, {}, [], 'x', { mes: 'x', entran: ENERO_27.entran }]) {
      assert.deepEqual(plano(M.diasQueEntran(raro, raro)), [], JSON.stringify(raro));
    }
    assert.deepEqual(fechasYHoras(M.diasQueEntran({ ...ENERO_27, entran: [null, 3, { fecha: 'x' }, ...ENERO_27.entran] }, VACIO)),
      [['2027-02-02', 1.5]]);
  });

  it('textoDeSumarAlAnterior: el renglón de «Cómo se cuentan las horas», con el mes anterior; sin un mes o sin él, nada', () => {
    assert.equal(M.textoDeSumarAlAnterior('2027-02', 'enero'),
      'Si te autorizan a sumar las horas de un día al mes anterior, tildá «Sumar a enero»: cuentan como horas extras de enero.');
    assert.equal(M.textoDeSumarAlAnterior('2027-01', ENERO_27.sumar_a),
      'Si te autorizan a sumar las horas de un día al mes anterior, tildá «Sumar a diciembre»: cuentan como horas extras de diciembre.');
    for (const [mes, sumarA] of [['2027-02', ''], ['2027-02', '  '], ['2027-02', null], ['2027-02', 3], [null, 'enero'], ['x', 'enero']]) {
      assert.equal(M.textoDeSumarAlAnterior(mes, sumarA), '', `${mes} ${sumarA}`);
    }
  });
});

describe('«Sumar a {mes anterior}»: la fila, la banda y el bloque del mes siguiente', () => {
  const del02 = FEBRERO_27.dias.find((dia) => dia.fecha === '2027-02-02');
  const del03 = FEBRERO_27.dias.find((dia) => dia.fecha === '2027-02-03');
  const enFebrero = (estado = {}) => M.htmlDeLaPlanilla(FEBRERO_27, { ...VACIO, ...estado });

  it('htmlDelTilde: «Sumar a enero», con su nombre que empieza con lo que se ve y la fecha', () => {
    assert.equal(M.htmlDelTilde(del02, M.valorDelDia(del02, undefined), 'enero'),
      '<label class="mp-tilde" id="mp-t-2027-02-02"><input type="checkbox" data-campo="al_mes_anterior" data-fecha="2027-02-02" '
      + 'checked aria-label="Sumar a enero el martes 02/02"><span>Sumar a enero</span></label>');
    assert.equal(M.htmlDelTilde(del03, M.valorDelDia(del03, undefined), 'enero'),
      '<label class="mp-tilde" id="mp-t-2027-02-03"><input type="checkbox" data-campo="al_mes_anterior" data-fecha="2027-02-03" '
      + 'aria-label="Sumar a enero el miércoles 03/02"><span>Sumar a enero</span></label>');
    // Sin salida: oculto sin perder su lugar (vacio) y sin el foco; tildado, como se escribió
    assert.equal(M.htmlDelTilde(del02, { entrada: '', salida: ' ', nota: '', al_mes_anterior: true }, 'enero'),
      '<label class="mp-tilde vacio" id="mp-t-2027-02-02"><input type="checkbox" data-campo="al_mes_anterior" data-fecha="2027-02-02" '
      + 'checked tabindex="-1" aria-label="Sumar a enero el martes 02/02"><span>Sumar a enero</span></label>');
    // El mes del servidor, escapado en el texto y en el nombre
    const raro = M.htmlDelTilde(del03, M.valorDelDia(del03, undefined), CON_B_X);
    assert.ok(!raro.includes('<b>'));
    assert.ok(raro.includes(`aria-label="Sumar a ${CON_B_X_ESCAPADO} el miércoles 03/02"`));
    assert.ok(raro.includes(`<span>Sumar a ${CON_B_X_ESCAPADO}</span>`));
    // Sin el mes (una planilla de antes) o sin una fecha: el lugar, vacío
    for (const [dia, sumarA] of [[del03, ''], [del03, undefined], [del03, null], [{ fecha: 'x' }, 'enero'], [null, 'enero']]) {
      assert.equal(M.htmlDelTilde(dia, M.valorDelDia(del03, undefined), sumarA), '<span class="mp-tilde vacio" aria-hidden="true"></span>',
        JSON.stringify([dia, sumarA]));
    }
    // Su clase no es la de otra cosa de la planilla: ni #mp-anterior (la flecha del mes) ni .mp-sumar («¿Trabajaste un sábado o un
    // domingo?», con su borde punteado)
    const planilla = M.htmlDeLaPlanilla(FEBRERO_27, VACIO);
    assert.doesNotMatch(planilla, /mp-anterior|class="[^"]*\bmp-sumar\b/);
  });

  it('htmlDeLasHorasDeLaFila: un día tildado con horas, la pastilla otro-mes y «→ enero» («van a enero» para el lector)', () => {
    const tildado = M.valorDelDia(del02, undefined);
    assert.equal(M.htmlDeLasHorasDeLaFila(del02, tildado, 'enero'), '<b class="otro-mes">1,5 h</b><small class="mp-va-a">'
      + '<span aria-hidden="true">→ </span><span class="visualmente-oculto">van a </span>enero</small>');
    assert.equal(textoDe(M.htmlDeLasHorasDeLaFila(del02, tildado, 'enero')), '1,5 h → van a enero');
    // Sin tildar, o tildado sin horas, como siempre
    assert.equal(M.htmlDeLasHorasDeLaFila(del03, M.valorDelDia(del03, undefined), 'enero'), '<b>1 h</b>');
    assert.equal(M.htmlDeLasHorasDeLaFila(del02, { ...tildado, salida: '15:10' }, 'enero'), '<b class="cero">0</b><small>No llega a media hora</small>');
    assert.equal(M.htmlDeLasHorasDeLaFila(del02, { ...tildado, salida: '' }, 'enero'), '<b class="nada">—</b>');
    // Sin el mes, la pastilla de siempre (no se dice adónde van); el mes, escapado
    assert.equal(M.htmlDeLasHorasDeLaFila(del02, tildado), '<b>1,5 h</b>');
    assert.equal(M.htmlDeLasHorasDeLaFila(del02, tildado, ''), '<b>1,5 h</b>');
    assert.ok(M.htmlDeLasHorasDeLaFila(del02, tildado, CON_B_X).endsWith(`<span class="visualmente-oculto">van a </span>${CON_B_X_ESCAPADO}</small>`));
  });

  it('la fila de un día con campos: el tilde entre las horas y «Nota»; sin salida, oculto; sin campos, sin tilde', () => {
    const html = enFebrero();
    const fila = filaDel(html, '2027-02-02');
    assert.equal(fila.texto, 'Mar 02/02 Entrada (opcional) Salida 1,5 h → van a enero Sumar a enero Nota');
    assert.ok(fila.html.includes('<span class="mp-horas" id="mp-h-2027-02-02"><b class="otro-mes">1,5 h</b>'));
    assert.ok(/<\/span><label class="mp-tilde" id="mp-t-2027-02-02">[\s\S]*<\/label><span class="mp-acciones">/.test(fila.html));
    assert.deepEqual(camposDe(fila.html).map((campo) => [campo.type, campo['data-campo'], campo['aria-label']]), [
      ['time', 'entrada', 'Entrada (opcional) del martes 02/02'], ['time', 'salida', 'Salida del martes 02/02'],
      ['checkbox', 'al_mes_anterior', 'Sumar a enero el martes 02/02']
    ]);
    assert.ok(fila.html.includes('data-fecha="2027-02-02" checked aria-label="Sumar a enero el martes 02/02"'));
    // El 03/02 (hoy), sin tildar
    assert.equal(filaDel(html, '2027-02-03').texto, 'Mié 03/02 Hoy Entrada (opcional) Salida 1 h Sumar a enero Nota');
    assert.ok(!filaDel(html, '2027-02-03').html.includes(' checked'));
    // El lunes 01/02, sin salida: el tilde oculto y sin el foco
    const vacio = filaDel(html, '2027-02-01');
    assert.ok(vacio.html.includes('<label class="mp-tilde vacio" id="mp-t-2027-02-01">'));
    assert.equal(camposDe(vacio.html)[2].tabindex, '-1');
    // Los que no llegaron, sin campos ni tilde
    assert.ok(!filaDel(html, '2027-02-04').html.includes('mp-tilde'));
    // Tildado sin guardar: la raya de lo cambiado, la pastilla y el tilde marcado
    const conCambio = filaDel(enFebrero({ cambios: new Map([['2027-02-03', { entrada: '', salida: '15:50', nota: '', al_mes_anterior: true }]]) }),
      '2027-02-03');
    assert.deepEqual(conCambio.clases, ['mp-dia', 'hoy', 'cambiado']);
    assert.ok(conCambio.html.includes('<b class="otro-mes">1 h</b>'));
    assert.ok(conCambio.html.includes('data-fecha="2027-02-03" checked aria-label="Sumar a enero el miércoles 03/02"'));
    // El mes de la planilla del servidor (`sumar_a`) es el del tilde: en enero, «Sumar a diciembre», también en el primer mes
    assert.ok(filaDel(M.htmlDeLaPlanilla(ENERO_27, VACIO), '2027-01-05').html.includes('<span>Sumar a diciembre</span>'));
    // Escapado
    const raro = M.htmlDeLaPlanilla({ ...FEBRERO_27, sumar_a: CON_B_X }, VACIO);
    assert.ok(!raro.includes('<b>"x"'));
    assert.ok(filaDel(raro, '2027-02-02').html.includes(`<span>Sumar a ${CON_B_X_ESCAPADO}</span>`));
  });

  it('la fila de una licencia de día entero con una salida de antes, tildada: sin tilde (no tiene campos), con adónde van sus horas', () => {
    const conLicencia = { ...ESTADO_FEBRERO, licencias: [...ESTADO_FEBRERO.licencias, { id: 90, tipo: 'horas_a_favor', desde: '2027-02-02', hasta: '2027-02-02', horas: 7 }] };
    const planilla = planillaDeFebrero('2027-02', { estado: conLicencia });
    const fila = filaDel(M.htmlDeLaPlanilla(planilla, VACIO), '2027-02-02');
    assert.ok(fila.clases.includes('licencia'));
    assert.ok(!fila.html.includes('mp-tilde'));
    assert.ok(fila.html.includes('<b class="otro-mes">1,5 h</b>'));
  });

  it('la semana no suma los días tildados', () => {
    assert.deepEqual(semanasDe(enFebrero()), [['2027-02-01,2027-02-02,2027-02-03,2027-02-04,2027-02-05', '1 al 5 de febrero 1 h'],
      ['2027-02-08,2027-02-09,2027-02-10,2027-02-11,2027-02-12', '8 al 12 de febrero —'],
      ['2027-02-15,2027-02-16,2027-02-17,2027-02-18,2027-02-19', '15 al 19 de febrero —'],
      ['2027-02-22,2027-02-23,2027-02-24,2027-02-25,2027-02-26', '22 al 26 de febrero —']]);
    const destildado = new Map([['2027-02-02', { entrada: '', salida: '16:20', nota: '', al_mes_anterior: false }]]);
    assert.equal(semanasDe(enFebrero({ cambios: destildado }))[0][1], '1 al 5 de febrero 2,5 h');
  });

  it('htmlDeLaBandaDeLaPlanilla: la segunda línea en .mp-suma-aparte, vacía sin nada que decir (la banda tiene siempre dos renglones)', () => {
    assert.equal(M.htmlDeLaBandaDeLaPlanilla('2027-01', 7, HOY_FEBRERO, ENERO_27.suma.detalle),
      '<span class="mp-suma-cifra">7<small>h</small></span><div class="mp-suma-textos"><p class="mp-suma-texto">En febrero tenés '
      + '<b>1 día de franco</b>.</p><p class="mp-suma-aparte">Incluye 1,5 h de febrero.</p></div>');
    assert.equal(M.htmlDeLaBandaDeLaPlanilla('2027-02', 1, HOY_FEBRERO, FEBRERO_27.suma.detalle),
      '<span class="mp-suma-cifra">1<small>h</small></span><div class="mp-suma-textos"><p class="mp-suma-texto">En marzo vas a tener '
      + '<b>1 hora a favor</b>.</p><p class="mp-suma-aparte">1,5 h del martes 02/02 suman a enero.</p></div>');
    // Sin detalle (o sin el parámetro), el renglón vacío
    for (const detalle of [undefined, '', null, 3, {}]) {
      assert.ok(M.htmlDeLaBandaDeLaPlanilla('2027-02', 1, HOY_FEBRERO, detalle).endsWith('<p class="mp-suma-aparte"></p></div>'), String(detalle));
    }
    assert.ok(M.htmlDeLaBandaDeLaPlanilla('2027-02', 1, HOY_FEBRERO).endsWith('<p class="mp-suma-aparte"></p></div>'));
    // Escapado
    assert.ok(M.htmlDeLaBandaDeLaPlanilla('2027-02', 1, HOY_FEBRERO, CON_B_X).endsWith(`<p class="mp-suma-aparte">${CON_B_X_ESCAPADO}</p></div>`));
    // La cifra y los dos renglones dicen lo del servidor
    const banda = M.htmlDeLaBandaDeLaPlanilla(ENERO_27.mes, ENERO_27.suma.horas, ENERO_27.hoy, ENERO_27.suma.detalle);
    assert.equal(textoDe(banda.replace(/<\/?b>/g, '')), `${ENERO_27.suma.cifra} h ${ENERO_27.suma.texto} ${ENERO_27.suma.detalle}`);
  });

  it('htmlDelBloqueDelMesSiguiente: en enero, «De febrero» con su total y el 02/02 de solo lectura, con «Ver en febrero»', () => {
    const bloque = M.htmlDelBloqueDelMesSiguiente(ENERO_27, VACIO);
    const filas = filasDeLaPlanilla(bloque);
    assert.deepEqual(filas.map(({ clases }) => clases), [['mp-semana', 'de-otro-mes'], ['mp-dia', 'de-otro-mes']]);
    assert.equal(filas[0].texto, 'De febrero 1,5 h');
    assert.ok(filas[0].html.includes('<span class="mp-semana-total">1,5 h</span>'));
    assert.equal(filas[0].atributos['data-fechas'], undefined);
    const [, dia] = filas;
    assert.deepEqual([dia.atributos.id, dia.atributos.role, dia.atributos['aria-labelledby']], ['mp-otro-2027-02-02', 'group', 'mp-of-2027-02-02']);
    assert.equal(dia.texto, 'Mar 02/02 Salida 16:20 1,5 h Ver en febrero');
    assert.ok(dia.html.includes('<b id="mp-of-2027-02-02">Mar 02/02</b>'));
    assert.deepEqual(camposDe(bloque), []);
    assert.deepEqual(botonesDe(bloque).map(({ atributos, texto }) => [texto, atributos.class, atributos['data-ver-en'], atributos['aria-label']]),
      [['Ver en febrero', 'sg-link', '2027-02-02', 'Ver en febrero el martes 02/02']]);
    // La planilla de enero lo suma al final, después de la última semana
    const enero = M.htmlDeLaPlanilla(ENERO_27, VACIO);
    assert.ok(enero.endsWith(bloque));
    assert.deepEqual(semanasDe(enero).at(-1), [undefined, 'De febrero 1,5 h']);
    // Con febrero ya pedido y otro día tildado sin guardar, con su entrada y su nota: los dos, por fecha
    const meses = new Map([['2027-01', ENERO_27], ['2027-02', FEBRERO_27]]);
    const cambios = new Map([['2027-02-03', { entrada: '08:10', salida: '15:50', nota: 'Cierre del <b>mes</b>', al_mes_anterior: true }]]);
    const conDos = filasDeLaPlanilla(M.htmlDelBloqueDelMesSiguiente(ENERO_27, { ...VACIO, meses, cambios }));
    assert.equal(conDos[0].texto, 'De febrero 2,5 h');
    assert.deepEqual(conDos.slice(1).map(({ texto }) => texto), ['Mar 02/02 Salida 16:20 1,5 h Ver en febrero',
      'Mié 03/02 Salida 15:50 Entrada 08:10 1 h Ver en febrero Cierre del <b>mes</b>']);
    assert.ok(conDos[2].html.includes('<p class="mp-nota-vista">Cierre del &lt;b&gt;mes&lt;/b&gt;</p>'));
    // Destildado sin guardar, no hay bloque; tampoco en febrero (el mes siguiente no llegó) ni en una planilla que no sirve
    const destildado = new Map([['2027-02-02', { entrada: '', salida: '16:20', nota: '', al_mes_anterior: false }]]);
    assert.equal(M.htmlDelBloqueDelMesSiguiente(ENERO_27, { ...VACIO, cambios: destildado }), '');
    assert.ok(!M.htmlDeLaPlanilla(ENERO_27, { ...VACIO, cambios: destildado }).includes('de-otro-mes'));
    assert.equal(M.htmlDelBloqueDelMesSiguiente(FEBRERO_27, VACIO), '');
    for (const raro of [undefined, null, {}, 'x']) assert.equal(M.htmlDelBloqueDelMesSiguiente(raro, raro), '', String(raro));
    // Un tildado que da 0: en el bloque, «0» con «No llega a media hora», y el total, la raya
    const conCero = new Map([['2027-02-02', { entrada: '', salida: '15:10', nota: '', al_mes_anterior: true }]]);
    const cero = filasDeLaPlanilla(M.htmlDelBloqueDelMesSiguiente(ENERO_27, { ...VACIO, cambios: conCero }));
    assert.deepEqual(cero.map(({ texto }) => texto), ['De febrero —', 'Mar 02/02 Salida 15:10 0 No llega a media hora Ver en febrero']);
  });

  it('el bloque escapa lo del servidor: la fecha y la nota', () => {
    const rara = comoLlega(ENERO_27);
    Object.assign(rara.entran[0], { fecha_texto: MALICIOSO, nota: MALICIOSO, salida: '16:20' });
    const bloque = M.htmlDelBloqueDelMesSiguiente(rara, VACIO);
    assert.ok(!bloque.includes('<img'));
    assert.ok(bloque.includes(`<b id="mp-of-2027-02-02">${ESCAPADO}</b>`));
    assert.ok(bloque.includes(`<p class="mp-nota-vista">${ESCAPADO}</p>`));
  });

  it('lo nuevo no tira con lo que no sirve', () => {
    for (const funcion of ['htmlDelTilde', 'diasQueEntran', 'diasQueSumanAlAnterior', 'textoDeLoQueSeMueve', 'htmlDelBloqueDelMesSiguiente',
      'textoDeSumarAlAnterior', 'valoresDeLaSalida', 'valorDelDia', 'htmlDeLasHorasDeLaFila', 'htmlDeLaBandaDeLaPlanilla']) {
      for (const valor of [undefined, null, {}, [], 'x', 3, new Map([['x', 'y']])]) {
        assert.doesNotThrow(() => M[funcion](valor, valor, valor, valor), `${funcion}(${String(valor)})`);
      }
    }
  });
});

describe('«Sumar a {mes anterior}»: la pestaña Horas extras', () => {
  const tabla = tablaDeFebrero(2027);

  it('la tabla: debajo de las horas, de dónde salen (horas_detalle), escapado', () => {
    const filas = filasDeTablaDe(M.htmlDeTablaDeHorasAFavor(tabla));
    assert.deepEqual(filas.map(({ celdas }) => celdas[1]), ['1 h 1,5 h suman a enero', '7 h 5,5 h + 1,5 h de febrero']);
    assert.ok(filas[1].html.includes('<td class="num">7 h<small>5,5 h + 1,5 h de febrero</small></td>'));
    assert.ok(filas[0].html.includes('<td class="num">1 h<small>1,5 h suman a enero</small></td>'));
    // Sin detalle, como siempre
    const sinDetalle = comoLlega(tabla);
    sinDetalle.meses[0].horas_detalle = '';
    assert.ok(filasDeTablaDe(M.htmlDeTablaDeHorasAFavor(sinDetalle))[0].html.includes('<td class="num">1 h</td>'));
    const rara = comoLlega(tabla);
    rara.meses[0].horas_detalle = CON_B_X;
    assert.ok(filasDeTablaDe(M.htmlDeTablaDeHorasAFavor(rara))[0].html.includes(`<td class="num">1 h<small>${CON_B_X_ESCAPADO}</small></td>`));
  });

  it('«Sin horas a favor» (sin_horas): la fila en gris, con la insignia gris', () => {
    assert.ok(M.SITUACIONES_EN_GRIS.includes('sin_horas'));
    assert.equal(M.CLASE_DE_LA_SITUACION.sin_horas, 'gris');
    // Febrero, con su único día tildado y ya terminado (hoy en marzo): suma 0
    const soloTildado = { ...ESTADO_FEBRERO, salidas: SALIDAS_DE_ENERO_Y_FEBRERO.filter((fila) => fila.fecha !== '2027-02-03') };
    const conCero = tablaDeFebrero(2027, { estado: soloTildado, hoy: '2027-03-15' });
    const febrero = conCero.meses.find((fila) => fila.mes === '2027-02');
    assert.deepEqual([febrero.horas_texto, febrero.estado, febrero.situacion], ['0 h', 'sin_horas', 'Sin horas a favor']);
    const fila = filasDeTablaDe(M.htmlDeTablaDeHorasAFavor(conCero)).find(({ celdas }) => celdas[0] === 'Febrero 2027');
    assert.deepEqual(fila.clases, ['tenue']);
    assert.ok(fila.html.includes('<span class="me-insignia gris">Sin horas a favor</span>'));
  });

  it('el día por día: un día tildado con su pastilla otro-mes y «Suma a enero»; los que entran, al final, con «De febrero»', () => {
    const febrero = M.htmlDeDiaPorDiaDeSalidas(tabla, '2027-02');
    assert.deepEqual(filasDe(febrero).map(({ texto }) => texto), ['Mié 03/02 Salida 15:50 1 h Editar',
      'Mar 02/02 Salida 16:20 1,5 h Suma a enero Editar']);
    assert.ok(febrero.includes('<span class="me-dia-horas otro-mes">1,5 h</span><span class="me-detalle me-fila-otro-mes">Suma a enero</span>'));
    assert.ok(febrero.includes('<span class="me-dia-horas">1 h</span>'));
    const enero = M.htmlDeDiaPorDiaDeSalidas(tabla, '2027-01');
    assert.match(enero, /<h3>Enero 2027, día por día<\/h3><span>7 horas<\/span>/);
    const filas = filasDe(enero);
    assert.equal(filas.at(-1).texto, 'Mar 02/02 De febrero Salida 16:20 1,5 h Editar');
    assert.deepEqual(filas.map(({ clases }) => clases.includes('de-otro-mes')), [false, false, false, false, false, true]);
    assert.ok(filas.at(-1).html.includes('<span class="me-fila-fecha">Mar 02/02<small>De febrero</small></span>'));
    assert.ok(!filas.at(-1).html.includes('otro-mes">1,5 h'));
    // Su «Editar» abre su mes (la fecha), como los demás
    assert.deepEqual(botonesDe(enero).at(-1).atributos['data-editar-salida'], '2027-02-02');
    assert.equal(botonesDe(enero).at(-1).atributos['aria-label'], 'Editar el martes 02/02');
    // de_otro_mes, solo el true literal; suma_a, escapado
    const rara = comoLlega(tabla);
    rara.dias_por_mes['2027-01'].at(-1).de_otro_mes = 'true';
    rara.dias_por_mes['2027-02'][1].suma_a = CON_B_X;
    assert.ok(!filasDe(M.htmlDeDiaPorDiaDeSalidas(rara, '2027-01')).at(-1).clases.includes('de-otro-mes'));
    const conHtml = M.htmlDeDiaPorDiaDeSalidas(rara, '2027-02');
    assert.ok(!conHtml.includes('<b>"x"'));
    assert.ok(conHtml.includes(`<span class="me-detalle me-fila-otro-mes">${CON_B_X_ESCAPADO}</span>`));
  });
});

// La página con los formularios (DOM falso)

// La respuesta de GET /api/mi-espacio/licencias/:id/nota como la arma el servidor (verNotaDeLicencia), para la licencia `id` de
// `estado`: su fila de la lista (filaDeUnaLicencia), la hoja (htmlDeLaNota, ya escapada), la fecha, la aclaración y en qué lista
// quedó (`lista`, textoDeLaListaDe: «Está en la lista de 2027.», o null en la del año en curso). La persona de planta, con un
// cargo inventado; `fecha`, el día en que se guardó
const CARGO_DE_PRUEBA = 'Analista de datos';
const respuestaDeLaNota = (estado, id, { fecha = HOY } = {}) => {
  const persona = { nombre: PLANTA.persona.nombre_completo, cargo: CARGO_DE_PRUEBA, vinculo: PLANTA.persona.vinculo };
  const guardada = estado.licencias.find((fila) => fila.id === id);
  const { nota } = notaDeLicencia(guardada, { fecha, persona, feriados: SIN_FERIADOS });
  return comoLlega({
    fila: filaDeUnaLicencia(estado, calculoDe(estado), { id, hoy: HOY, persona: PLANTA.persona, feriados: SIN_FERIADOS }),
    html: htmlDeLaNota(nota), fecha, aclaracion: aclaracionDeLaNota(fecha), lista: textoDeLaListaDe(guardada.desde, HOY)
  });
};
const RUTA_DE_LA_NOTA = /^\/api\/mi-espacio\/licencias\/(\d+)\/nota$/;

// Lo que contesta el servidor falso en los formularios, además de lo de entrada: el cálculo (de la persona de planta, con
// `soyTitular`), el firmante, la nota de la última licencia guardada (la del POST o el PUT, con el id que pide GET …/:id/nota;
// sin ninguna guardada, la de PLANTA con ese id) y lo que se pase en `extra` (que gana)
const conFormularios = ({ soyTitular = false, comoAutorizada = [], extra = () => undefined } = {}) => {
  let guardada = null;
  return (metodo, ruta, cuerpo) => {
    const corregida = /^\/api\/mi-espacio\/licencias\/(\d+)$/.exec(ruta);
    if ((metodo === 'POST' && ruta === '/api/mi-espacio/licencias') || (metodo === 'PUT' && corregida)) guardada = cuerpo;
    const propia = extra(metodo, ruta, cuerpo);
    if (propia !== undefined) return propia;
    if (metodo === 'POST' && ruta === '/api/mi-espacio/licencias/calculo') {
      const { id, ...entrada } = cuerpo;
      return ok(respuestaDelCalculo(entrada, { soyTitular, editadaId: id ?? null, comoAutorizada }));
    }
    if (ruta === '/api/mi-espacio/firmante') return ok(soyTitular ? FIRMANTE : { soy_titular: false });
    const nota = RUTA_DE_LA_NOTA.exec(ruta);
    if (metodo === 'GET' && nota) {
      const id = Number(nota[1]);
      const otras = PLANTA.estado.licencias.filter((fila) => fila.id !== id);
      const estado = guardada === null ? PLANTA.estado : conLicencias({ ...PLANTA.estado, licencias: otras },
        licencia(id, guardada.tipo, guardada.desde, guardada.hasta, typeof guardada.horas === 'number' ? guardada.horas : null));
      return ok(respuestaDeLaNota(estado, id));
    }
    return RESPUESTAS_DE_ENTRADA(metodo, ruta);
  };
};
// Abre «Cargar licencia» desde el encabezado, elige el tipo, escribe las fechas y deja que salga el cálculo
const cargarLicencia = async (pagina, { tipo = 'vacaciones', desde = VACACIONES.desde, hasta = VACACIONES.hasta, horas } = {}) => {
  await pagina.tocar(pagina.el('btn-cargar-licencia'));
  await pagina.correr();
  await pagina.elegir('ml-tipo', tipo);
  await pagina.escribir('ml-desde', desde);
  if (!pagina.el('ml-grupo-hasta').hidden) await pagina.escribir('ml-hasta', hasta);
  if (horas !== undefined) await pagina.escribir('ml-horas', horas, 'change');
  await pagina.correr();
};
const calculos = (pagina) => pagina.pedidosA('POST', '/api/mi-espacio/licencias/calculo');
// La persona de planta sin el saldo inicial: «Mis vacaciones y saldos» se abre solo, con lo que mandan GET /anio y GET /saldo-inicial;
// `extra`, como en conFormularios
const conSaldosParaArrancar = ({ extra = () => undefined } = {}) => {
  const resumen = resumenDel(PLANTA, { estado: { ...PLANTA.estado, arranque: null, anios: [], saldos: [] } });
  const campos = camposDelSaldoInicial({ modalidad: 'planta', arranque: HOY, anios: [] }).map((campo) => ({ ...campo, valor: null }));
  // Sin arranque, el servidor arma las mitades con hoy, como los campos: el 26/10 la primera mitad de 2026 es el saldo
  const anio = {
    anio: 2026, dias_vacaciones: null, estudios: null, heredado: false, texto_mitades: null,
    textos_mitades: Object.fromEntries(DIAS_VACACIONES.map((dias) => [String(dias), textoDeLasMitades(2026, dias, { arranque: HOY })]))
  };
  return conFormularios({
    extra: (metodo, ruta, cuerpo) => {
      const propia = extra(metodo, ruta, cuerpo);
      if (propia !== undefined) return propia;
      if (ruta === '/api/mi-espacio/resumen') return ok(resumen);
      if (metodo === 'GET' && ruta === '/api/mi-espacio/anio/2026') return ok(anio);
      if (metodo === 'GET' && ruta === '/api/mi-espacio/saldo-inicial') return ok({ arranque: null, modalidad: 'planta', campos });
      return undefined;
    }
  });
};

describe('los formularios en la página (DOM falso)', () => {
  it('«Cargar licencia»: los tipos del Resumen, el foco al tipo y, al cerrar, de vuelta al botón', async () => {
    const pagina = montarPagina({ responder: conFormularios() });
    await pagina.iniciar();
    const boton = pagina.el('btn-cargar-licencia');
    boton.focus();
    await pagina.tocar(boton);
    assert.equal(pagina.abierto('modal-licencia'), true);
    assert.equal(pagina.el('modal-licencia-titulo').textContent, 'Cargar licencia');
    assert.equal(pagina.el('ml-tipos-opciones').innerHTML, M.htmlDeTiposDeLicencia(RESUMEN_DE_PLANTA.tipos, ''));
    await pagina.correr();
    assert.equal(pagina.documento.activeElement, pagina.el('ml-tipos').querySelector('input'));
    await pagina.tocar(pagina.el('modal-licencia').querySelector('.modal-footer [data-cerrar]'));
    assert.equal(pagina.abierto('modal-licencia'), false);
    assert.equal(pagina.documento.activeElement, boton);
  });

  it('el cálculo se pide 300 ms después del último cambio: dos cambios seguidos, un solo cálculo, y «Guardar» espera la respuesta', async () => {
    const pagina = montarPagina({ responder: conFormularios() });
    await pagina.iniciar();
    await cargarLicencia(pagina);
    assert.equal(calculos(pagina).length, 1);
    await pagina.escribir('ml-desde', '2026-11-17');
    await pagina.escribir('ml-desde', '2026-11-18');
    assert.equal(pagina.el('ml-guardar').disabled, true, 'mientras espera');
    await pagina.correr();
    assert.equal(calculos(pagina).length, 2);
    assert.deepEqual(calculos(pagina).at(-1).cuerpo, { tipo: 'vacaciones', desde: '2026-11-18', hasta: '2026-11-20', mostrar: true, nota: '' });
    assert.equal(pagina.el('ml-guardar').disabled, false);
    const { vista } = respuestaDelCalculo({ ...VACACIONES, desde: '2026-11-18' });
    assert.equal(pagina.el('ml-calculo').innerHTML, M.htmlDelCalculo({ vista }, 'vacaciones'));
    assert.equal(pagina.el('ml-calculo').hidden, false);
  });

  it('una respuesta vieja del cálculo que llega tarde no pisa la nueva', async () => {
    let soltar;
    const demorada = new Promise((resolver) => { soltar = resolver; });
    const pagina = montarPagina({
      responder: conFormularios({
        extra: (metodo, ruta, cuerpo) => {
          if (metodo === 'POST' && ruta.endsWith('/calculo') && cuerpo.hasta === '2026-11-19') {
            return demorada.then(() => ok(respuestaDelCalculo({ ...VACACIONES, hasta: '2026-11-19' })));
          }
          return undefined;
        }
      })
    });
    await pagina.iniciar();
    await cargarLicencia(pagina, { hasta: '2026-11-19' });
    await pagina.escribir('ml-hasta', '2026-11-20');
    await pagina.correr();
    const nueva = M.htmlDelCalculo({ vista: respuestaDelCalculo(VACACIONES).vista }, 'vacaciones');
    assert.equal(pagina.el('ml-calculo').innerHTML, nueva);
    soltar();
    await pagina.esperar();
    assert.equal(pagina.el('ml-calculo').innerHTML, nueva);
    assert.equal(pagina.el('ml-guardar').disabled, false);
  });

  // Desde la nota de licencia en Word (spec 2026-10-27-mi-espacio-licencia-word, 6): al guardar, el modal pasa al segundo paso (lo
  // dice el título y #me-anuncio, sin aviso flotante) y la página vuelve a pedir todo de fondo; «Listo» lo cierra
  it('un guardado con un fetch que tarda deja «Guardar» deshabilitado y manda un solo POST; después, el segundo paso y el Resumen', async () => {
    let soltar;
    const demorado = new Promise((resolver) => { soltar = resolver; });
    const pagina = montarPagina({
      responder: conFormularios({
        extra: (metodo, ruta) => (metodo === 'POST' && ruta === '/api/mi-espacio/licencias'
          ? demorado.then(() => respuesta(201, { success: true, data: { id: 9 }, message: 'Licencia cargada.' })) : undefined)
      })
    });
    await pagina.iniciar();
    await cargarLicencia(pagina);
    const resumenes = pagina.rutas().filter((ruta) => ruta === '/api/mi-espacio/resumen').length;
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.equal(pagina.el('ml-guardar').disabled, true);
    // Mientras guarda, no se cierra
    await pagina.tecla('Escape');
    assert.equal(pagina.abierto('modal-licencia'), true);
    await pagina.tocar(pagina.el('ml-guardar'));
    pagina.el('ml-guardar').disabled = false;
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/licencias').length, 1);
    assert.deepEqual(pagina.pedidosA('POST', '/api/mi-espacio/licencias')[0].cuerpo,
      { tipo: 'vacaciones', desde: '2026-11-16', hasta: '2026-11-20', mostrar: true, nota: '' });
    soltar();
    await pagina.esperar();
    assert.equal(pagina.abierto('modal-licencia'), true);
    assert.equal(pagina.el('modal-licencia-titulo').textContent, 'Licencia cargada');
    assert.equal(pagina.el('me-anuncio').textContent, 'Licencia cargada. Podés descargar la nota en Word.');
    // Sin el aviso flotante: lo dice el título
    assert.deepEqual(pagina.estado.toasts, []);
    assert.equal(pagina.rutas().filter((ruta) => ruta === '/api/mi-espacio/resumen').length, resumenes + 1);
    assert.equal(pagina.pedidosA('GET', '/api/mi-espacio/licencias/9/nota').length, 1);
    await pagina.tocar(pagina.el('ml-paso-dos-pie').querySelector('[data-cerrar]'));
    assert.equal(pagina.abierto('modal-licencia'), false);
    assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/licencias').length, 1);
  });

  it('un 400 en horas pone aria-invalid y el mensaje en #ml-horas, con el foco; uno sin campo va a #ml-error', async () => {
    let contestar = respuesta(400, { success: false, error: MENSAJES_MI_ESPACIO.horasEnteras, campo: 'horas' });
    const pagina = montarPagina({
      responder: conFormularios({ extra: (metodo, ruta) => (metodo === 'POST' && ruta === '/api/mi-espacio/licencias' ? contestar : undefined) })
    });
    await pagina.iniciar();
    await cargarLicencia(pagina, { tipo: 'franquicia', desde: '2026-11-16', horas: '3' });
    assert.equal(pagina.el('ml-grupo-horas').hidden, false);
    assert.equal(pagina.el('ml-grupo-hasta').hidden, true);
    assert.equal(pagina.el('ml-desde-rotulo').textContent, 'Fecha');
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.equal(pagina.el('ml-horas').getAttribute('aria-invalid'), 'true');
    assert.equal(pagina.el('ml-horas-error').textContent, MENSAJES_MI_ESPACIO.horasEnteras);
    assert.equal(pagina.el('ml-horas-error').hidden, false);
    assert.equal(pagina.documento.activeElement, pagina.el('ml-horas'));
    assert.equal(pagina.abierto('modal-licencia'), true);
    contestar = respuesta(400, { success: false, error: MENSAJES_MI_ESPACIO.sinArranque, campo: null });
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.equal(pagina.el('ml-error').textContent, MENSAJES_MI_ESPACIO.sinArranque);
    assert.equal(pagina.el('ml-error').hidden, false);
    assert.equal(pagina.el('ml-horas').getAttribute('aria-invalid'), null);
  });

  // Decisión del usuario (27/10/2026): a la persona autorizada del firmante no se la frena. El aviso del servidor va en el
  // recuadro azul del paso, con los demás, y la licencia se guarda
  it('la persona autorizada del firmante: el aviso del cálculo va en el recuadro del paso y la licencia se guarda', async () => {
    const comoAutorizada = [{ desde: '2026-11-16', hasta: '2026-11-27' }];
    const pagina = montarPagina({
      responder: conFormularios({
        comoAutorizada,
        extra: (metodo, ruta) => (metodo === 'POST' && ruta === '/api/mi-espacio/licencias'
          ? respuesta(201, { success: true, data: { id: 9 }, message: 'Licencia cargada.' }) : undefined)
      })
    });
    await pagina.iniciar();
    await cargarLicencia(pagina, { tipo: 'medica', desde: MEDICA.desde, hasta: MEDICA.hasta });
    assert.equal(pagina.el('ml-paso').hidden, false);
    assert.deepEqual([...pagina.el('ml-paso').innerHTML.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(([, texto]) => texto),
      [AVISO_DEL_PASO, textoAutorizadaDelFirmante('2026-11-16', '2026-11-27')]);
    await pagina.tocar(pagina.el('ml-guardar'));
    await pagina.esperar();
    assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/licencias').length, 1);
    // Guardada: el segundo paso, y «Listo» cierra
    assert.equal(pagina.el('modal-licencia-titulo').textContent, 'Licencia cargada');
    assert.equal(pagina.el('ml-paso-dos').hidden, false);
    await pagina.tocar(pagina.el('ml-paso-dos-pie').querySelector('[data-cerrar]'));
    assert.equal(pagina.abierto('modal-licencia'), false);
  });

  it('los errores del formulario, antes de pedir nada: todos juntos y el foco al primero', async () => {
    const pagina = montarPagina({ responder: conFormularios() });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-cargar-licencia'));
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/licencias').length, 0);
    assert.equal(calculos(pagina).length, 0);
    // En un grupo de opciones, aria-invalid va en sus radios: en el fieldset no vale (ARIA 1.2)
    const radios = pagina.el('ml-tipos').querySelectorAll('input');
    assert.ok(radios.length > 0);
    assert.ok(radios.every((radio) => radio.getAttribute('aria-invalid') === 'true'));
    assert.equal(pagina.el('ml-tipos').getAttribute('aria-invalid'), null);
    assert.equal(pagina.el('ml-tipos-error').textContent, MENSAJES_MI_ESPACIO.tipo);
    assert.equal(pagina.el('ml-desde').getAttribute('aria-invalid'), 'true');
    assert.equal(pagina.el('ml-desde-error').textContent, MENSAJES_MI_ESPACIO.fecha);
    assert.equal(pagina.documento.activeElement, pagina.el('ml-tipos').querySelector('input'));
    // Al elegir el tipo, el cálculo limpia los errores: también los de los radios
    await pagina.elegir('ml-tipo', 'medica');
    await pagina.correr();
    assert.ok(radios.every((radio) => radio.getAttribute('aria-invalid') === null));
    assert.equal(pagina.el('ml-tipos-error').hidden, true);
  });

  // Sin respuesta del servidor, API.pedirJson tira el «Failed to fetch» del navegador, sin status: nunca se muestra en inglés
  it('sin conexión, los avisos dicen por qué en castellano: al guardar, al borrar y en el saldo inicial', async () => {
    const sinConexion = () => { throw new TypeError('Failed to fetch'); };
    const pagina = montarPagina({
      hash: '#licencias',
      responder: conFormularios({ extra: (metodo) => (metodo === 'PUT' || metodo === 'DELETE' ? sinConexion() : undefined) })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-licencias').querySelector('[data-editar-licencia="6"]'));
    await pagina.correr();
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.equal(pagina.el('ml-error').textContent, MENSAJE_SIN_CONEXION);
    assert.equal(pagina.el('ml-error').hidden, false);
    assert.equal(pagina.abierto('modal-licencia'), true);
    await pagina.tocar(pagina.el('ml-borrar'));
    await pagina.tocar(pagina.el('modal-confirmar-si'));
    assert.equal(pagina.el('mc-error').textContent, MENSAJE_SIN_CONEXION);
    assert.equal(pagina.abierto('modal-confirmar'), true);

    const saldos = montarPagina({
      responder: conSaldosParaArrancar({
        extra: (metodo, ruta) => {
          if (metodo === 'PUT' && ruta === '/api/mi-espacio/anio/2026') return ok({ anio: 2026 }, 'Días del año guardados.');
          return metodo === 'PUT' ? sinConexion() : undefined;
        }
      })
    });
    await saldos.iniciar();
    await saldos.correr();
    await saldos.elegir('ms-dia', '20');
    await saldos.elegir('ms-estudio', '');
    for (const campo of saldos.el('ms-campos').querySelectorAll('input')) campo.value = '0';
    await saldos.tocar(saldos.el('ms-guardar'));
    assert.equal(saldos.el('ms-error').textContent, `Los días del año se guardaron, pero el saldo inicial no. ${MENSAJE_SIN_CONEXION}`);
    assert.equal(saldos.abierto('modal-saldos'), true);
  });

  it('«Mis vacaciones y saldos»: los errores de los días y de los estudios van en sus radios, que los describen', async () => {
    const pagina = montarPagina({ responder: conSaldosParaArrancar() });
    await pagina.iniciar();
    await pagina.correr();
    assert.equal(pagina.abierto('modal-saldos'), true);
    for (const [grupo, nombre] of [['ms-dias', 'ms-dia'], ['ms-estudios', 'ms-estudio']]) {
      const radios = pagina.documento.querySelectorAll(`input[name="${nombre}"]`);
      assert.ok(radios.length > 0, nombre);
      assert.ok(radios.every((radio) => radio.getAttribute('aria-describedby') === `${grupo}-error`), nombre);
    }
    await pagina.tocar(pagina.el('ms-guardar'));
    assert.equal(pagina.pedidosA('PUT', '/api/mi-espacio/anio/2026').length, 0);
    for (const [grupo, nombre, mensaje] of [['ms-dias', 'ms-dia', MENSAJES_MI_ESPACIO.diasVacaciones],
      ['ms-estudios', 'ms-estudio', MENSAJES_MI_ESPACIO.estudios]]) {
      assert.equal(pagina.el(`${grupo}-error`).textContent, mensaje, grupo);
      assert.equal(pagina.el(grupo).getAttribute('aria-invalid'), null, grupo);
      assert.ok(pagina.documento.querySelectorAll(`input[name="${nombre}"]`).every((radio) => radio.getAttribute('aria-invalid') === 'true'),
        nombre);
    }
    assert.equal(pagina.documento.activeElement, pagina.el('ms-dias').querySelector('input'));
  });

  it('la persona a cargo, solo en vacaciones: #ml-grupo-autorizado oculto en una médica y visible en unas vacaciones del titular', async () => {
    const pagina = montarPagina({ responder: conFormularios({ soyTitular: true }) });
    await pagina.iniciar();
    await cargarLicencia(pagina, { tipo: 'medica', desde: MEDICA.desde, hasta: MEDICA.hasta });
    assert.equal(pagina.el('ml-grupo-autorizado').hidden, true);
    assert.ok(pagina.el('ml-paso').textContent.includes(AVISO_SIN_PERSONA_A_CARGO));
    assert.equal(pagina.el('ml-paso').hidden, false);
    await pagina.elegir('ml-tipo', 'vacaciones');
    await pagina.escribir('ml-hasta', VACACIONES.hasta);
    await pagina.correr();
    assert.equal(pagina.el('ml-grupo-autorizado').hidden, false);
    assert.deepEqual(pagina.el('ml-autorizado').querySelectorAll('option').map((opcion) => [opcion.getAttribute('value'), opcion.textContent]),
      [['', 'Nadie: se anticipan los avisos'], ['3', 'Martín Ríos']]);
    assert.equal(pagina.rutas().filter((ruta) => ruta === '/api/mi-espacio/firmante').length, 1);
    // Elegir a alguien cambia el efecto en las notas sin pedir otro cálculo
    const antes = calculos(pagina).length;
    await pagina.escribir('ml-autorizado', '3', 'change');
    assert.equal(calculos(pagina).length, antes);
    assert.ok(pagina.el('ml-paso').textContent.includes('Martín Ríos va a estar de licencia el 18/11/2026'));
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/licencias')[0].cuerpo.autorizado_id, 3);
  });

  it('el aviso de los días sin auditor: solo a quien audita y solo si pasa, con el id de Configuración al corregir', async () => {
    const periodos = [{ desde: '2026-11-16', hasta: '2026-11-20', vuelve: '2026-11-23', respaldo: [] }];
    const responder = conFormularios({
      extra: (metodo, ruta) => (ruta.startsWith('/api/usuarios/licencias/sin-auditor') ? ok({ periodos }) : undefined)
    });
    const sinAuditor = (pagina) => pagina.rutas().filter((ruta) => ruta.startsWith('/api/usuarios/licencias/sin-auditor'));
    const editor = montarPagina({ responder });
    await editor.iniciar();
    await cargarLicencia(editor);
    assert.deepEqual(sinAuditor(editor), []);
    assert.equal(editor.el('ml-sin-auditor').hidden, true);

    const auditora = montarPagina({ responder, auditor: true });
    await auditora.iniciar();
    await cargarLicencia(auditora);
    assert.deepEqual(sinAuditor(auditora), ['/api/usuarios/licencias/sin-auditor?desde=2026-11-16&hasta=2026-11-20&usuario_id=1']);
    assert.equal(auditora.el('ml-sin-auditor').hidden, false);
    assert.equal(auditora.el('ml-sin-auditor').innerHTML, `<p>${en(`textoSinAuditor(${JSON.stringify(periodos[0])})`)}</p>`);
    // Una franquicia de 3 horas, que no pasa: sin aviso, y vacío (está en el aria-describedby de «Guardar»: oculto, igual se leería)
    await auditora.elegir('ml-tipo', 'franquicia');
    await auditora.escribir('ml-horas', '3', 'change');
    await auditora.correr();
    assert.equal(auditora.el('ml-sin-auditor').hidden, true);
    assert.equal(auditora.el('ml-sin-auditor').innerHTML, '');
  });

  it('al corregir una creada: la fila, la persona a cargo precargada, el excluir de Configuración y autorizado_id solo si cambió', async () => {
    const lista = licenciasDe(PLANTA);
    lista.licencias[0] = { ...lista.licencias[0], desde: '2026-11-16', hasta: '2026-11-20', fechas_texto: '16/11 al 20/11/2026',
      en_configuracion: { licencia_id: 40, autorizado_id: 3 } };
    const periodos = [];
    const pagina = montarPagina({
      hash: '#licencias', auditor: true,
      responder: conFormularios({
        soyTitular: true,
        extra: (metodo, ruta) => {
          if (ruta === '/api/mi-espacio/licencias') return ok(lista);
          if (ruta.startsWith('/api/usuarios/licencias/sin-auditor')) return ok({ periodos });
          if (metodo === 'PUT' && ruta === '/api/mi-espacio/licencias/6') return ok({ id: 6 }, 'Licencia corregida.');
          return undefined;
        }
      })
    });
    await pagina.iniciar();
    const editar = pagina.el('vista-licencias').querySelector('[data-editar-licencia="6"]');
    await pagina.tocar(editar);
    await pagina.correr();
    assert.equal(pagina.el('modal-licencia-titulo').textContent, 'Corregir la licencia del 16/11 al 20/11/2026');
    assert.equal(pagina.el('ml-desde').value, '2026-11-16');
    assert.deepEqual(calculos(pagina).at(-1).cuerpo.id, 6);
    assert.equal(pagina.el('ml-autorizado').value, '3');
    assert.ok(pagina.rutas().some((ruta) => ruta.includes('sin-auditor') && ruta.includes('excluir=40')));
    assert.equal(pagina.el('ml-borrar').hidden, false);
    await pagina.escribir('ml-hasta', '2026-11-19');
    await pagina.correr();
    await pagina.tocar(pagina.el('ml-guardar'));
    const [put] = pagina.pedidosA('PUT', '/api/mi-espacio/licencias/6');
    assert.ok(!Object.hasOwn(put.cuerpo, 'autorizado_id'), 'sin cambiar la persona, no la manda');
    assert.equal(put.cuerpo.hasta, '2026-11-19');
    assert.equal(pagina.el('modal-licencia-titulo').textContent, 'Licencia corregida');
    assert.equal(pagina.el('me-anuncio').textContent, 'Licencia corregida. Podés descargar la nota en Word.');
  });

  // Sin saber quién queda a cargo, el formulario no dice «Sin persona autorizada…»: sería falso (la persona se conserva)
  it('la persona a cargo que ya no cumple las condiciones, elegida: el paso no dice «Sin persona autorizada»', async () => {
    const lista = licenciasDe(PLANTA);
    lista.licencias[0] = { ...lista.licencias[0], desde: '2026-11-16', hasta: '2026-11-20', fechas_texto: '16/11 al 20/11/2026',
      en_configuracion: { licencia_id: 40, autorizado_id: 7 } };
    const pagina = montarPagina({
      hash: '#licencias',
      responder: conFormularios({ soyTitular: true, extra: (metodo, ruta) => (ruta === '/api/mi-espacio/licencias' ? ok(lista) : undefined) })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-licencias').querySelector('[data-editar-licencia="6"]'));
    await pagina.correr();
    assert.equal(pagina.el('ml-grupo-autorizado').hidden, false);
    assert.equal(pagina.el('ml-autorizado').value, '7');
    const opcion = pagina.el('ml-autorizado').querySelectorAll('option').find((uno) => uno.getAttribute('value') === '7');
    assert.equal(opcion.textContent, 'Otro usuario (ya no cumple las condiciones)');
    assert.ok(pagina.el('ml-paso').textContent.includes(AVISO_DEL_PASO));
    assert.ok(!pagina.el('ml-paso').textContent.includes('Sin persona autorizada'));
    assert.ok(!pagina.el('ml-paso').textContent.includes('Los avisos que tocarían'));
    // «Nadie», elegido a mano, sí lo dice; Martín Ríos, su efecto
    await pagina.escribir('ml-autorizado', '', 'change');
    assert.ok(pagina.el('ml-paso').textContent.includes('Sin persona autorizada'));
    await pagina.escribir('ml-autorizado', '3', 'change');
    assert.ok(pagina.el('ml-paso').textContent.includes('una nota que comunica la autorización a Martín Ríos'));
  });

  // En unas vacaciones nuevas, sin el campo nadie queda a cargo (autorizado_id no viaja y el servidor la crea sin persona a cargo):
  // ahí «Sin persona autorizada…» es cierto y se dice
  it('si GET /mi-espacio/firmante falla en unas vacaciones nuevas, el campo queda oculto y el paso dice «Sin persona autorizada»',
    async () => {
      const pagina = montarPagina({
        responder: conFormularios({
          soyTitular: true,
          extra: (metodo, ruta) => (ruta === '/api/mi-espacio/firmante' ? respuesta(500, { success: false, error: 'Error' }) : undefined)
        })
      });
      await pagina.iniciar();
      await cargarLicencia(pagina);
      assert.equal(pagina.el('ml-grupo-autorizado').hidden, true);
      assert.ok(pagina.el('ml-paso').textContent.includes(AVISO_DEL_PASO));
      assert.ok(pagina.el('ml-paso').textContent.includes('Sin persona autorizada'));
      // Y al guardar, autorizado_id no viaja
      await pagina.tocar(pagina.el('ml-guardar'));
      assert.ok(!Object.hasOwn(pagina.pedidosA('POST', '/api/mi-espacio/licencias')[0].cuerpo, 'autorizado_id'));
    });

  // Al corregir, la persona que tenía se conserva: sin saber quién es, «Sin persona autorizada…» sería falso
  it('si GET /mi-espacio/firmante falla al corregir unas vacaciones, el paso no dice «Sin persona autorizada»', async () => {
    const lista = licenciasDe(PLANTA);
    lista.licencias[0] = { ...lista.licencias[0], desde: '2026-11-16', hasta: '2026-11-20', fechas_texto: '16/11 al 20/11/2026',
      en_configuracion: { licencia_id: 40, autorizado_id: 3 } };
    const pagina = montarPagina({
      hash: '#licencias',
      responder: conFormularios({
        soyTitular: true,
        extra: (metodo, ruta) => {
          if (ruta === '/api/mi-espacio/firmante') return respuesta(500, { success: false, error: 'Error' });
          if (ruta === '/api/mi-espacio/licencias') return ok(lista);
          if (metodo === 'PUT') return ok({ id: 6 }, 'Licencia corregida.');
          return undefined;
        }
      })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-licencias').querySelector('[data-editar-licencia="6"]'));
    await pagina.correr();
    assert.equal(pagina.el('ml-grupo-autorizado').hidden, true);
    assert.ok(pagina.el('ml-paso').textContent.includes(AVISO_DEL_PASO));
    assert.ok(!pagina.el('ml-paso').textContent.includes('Sin persona autorizada'));
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.ok(!Object.hasOwn(pagina.pedidosA('PUT', '/api/mi-espacio/licencias/6')[0].cuerpo, 'autorizado_id'));
  });

  // Sin el cálculo no se ve qué pasa con Configuración (el aviso del paso): la licencia no se guarda sin él
  it('si el cálculo falla, lo dice en el modal, sin el aviso del paso, y «Guardar» lo vuelve a pedir en lugar de guardar',
    async () => {
      let falla = respuesta(500, { success: false, error: 'Error al calcular la licencia' });
      const pagina = montarPagina({
        responder: conFormularios({
          extra: (metodo, ruta) => {
            if (metodo === 'POST' && ruta === '/api/mi-espacio/licencias/calculo' && falla !== null) {
              return typeof falla === 'function' ? falla() : falla;
            }
            if (metodo === 'POST' && ruta === '/api/mi-espacio/licencias') {
              return respuesta(201, { success: true, data: { id: 9 }, message: 'Licencia cargada.' });
            }
            return undefined;
          }
        })
      });
      await pagina.iniciar();
      await cargarLicencia(pagina);
      assert.equal(pagina.el('ml-error').textContent, 'No se pudo calcular: hubo un error en el servidor. Probá de nuevo en unos minutos.');
      assert.equal(pagina.el('ml-error').hidden, false);
      assert.equal(pagina.el('ml-paso').hidden, true);
      assert.equal(pagina.el('ml-calculo').hidden, true);
      assert.equal(pagina.el('ml-guardar').disabled, false, 'para volver a intentar');
      // «Guardar» vuelve a pedir el cálculo y no guarda; sin conexión, lo dice en castellano
      falla = () => { throw new TypeError('Failed to fetch'); };
      const antes = calculos(pagina).length;
      await pagina.tocar(pagina.el('ml-guardar'));
      assert.equal(calculos(pagina).length, antes + 1);
      assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/licencias').length, 0);
      assert.equal(pagina.el('ml-error').textContent,
        'No se pudo calcular: no se pudo conectar con el servidor. Probá de nuevo en unos minutos.');
      // Cuando sale, el aviso del paso se ve y recién el próximo «Guardar» guarda
      falla = null;
      await pagina.tocar(pagina.el('ml-guardar'));
      assert.equal(calculos(pagina).length, antes + 2);
      assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/licencias').length, 0);
      assert.equal(pagina.el('ml-error').hidden, true);
      assert.ok(pagina.el('ml-paso').textContent.includes(AVISO_DEL_PASO));
      await pagina.tocar(pagina.el('ml-guardar'));
      assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/licencias').length, 1);
      // Guardada: el segundo paso, y «Listo» cierra
      assert.equal(pagina.el('modal-licencia-titulo').textContent, 'Licencia cargada');
      await pagina.tocar(pagina.el('ml-paso-dos-pie').querySelector('[data-cerrar]'));
      assert.equal(pagina.abierto('modal-licencia'), false);
    });

  it('el cálculo del uso autorizado que falla, también: en #mu-error, y «Guardar» lo vuelve a pedir', async () => {
    let falla = true;
    const pagina = montarPagina({
      hash: '#horas',
      responder: conFormularios({
        extra: (metodo, ruta) => {
          if (metodo !== 'POST' || !ruta.endsWith('/calculo')) return undefined;
          return falla ? respuesta(500, { success: false, error: 'Error al calcular la licencia' }) : ok({ error: null, vista: null, paso: null });
        }
      })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-horas').querySelector('[data-abrir="uso"]'));
    await pagina.escribir('mu-fecha', '2026-11-16');
    await pagina.correr();
    assert.equal(pagina.el('mu-error').textContent, 'No se pudo calcular: hubo un error en el servidor. Probá de nuevo en unos minutos.');
    falla = false;
    const antes = calculos(pagina).length;
    await pagina.tocar(pagina.el('mu-guardar'));
    assert.equal(calculos(pagina).length, antes + 1);
    assert.equal(pagina.el('mu-error').hidden, true);
    assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/licencias').length, 0);
  });

  // La recarga de la lista reemplaza el «Editar» que abrió el modal: el foco va a su equivalente, nunca queda en <body>. Desde la
  // nota de licencia en Word, el guardado pasa al segundo paso (la lista se recarga detrás): al cerrarlo con «Listo», el foco va ahí
  it('después de guardar desde la lista, el foco va al «Editar» nuevo de la misma fila', async () => {
    const pagina = montarPagina({
      hash: '#licencias',
      responder: conFormularios({ extra: (metodo) => (metodo === 'PUT' ? ok({ id: 6 }, 'Licencia corregida.') : undefined) })
    });
    await pagina.iniciar();
    const viejo = pagina.el('vista-licencias').querySelector('[data-editar-licencia="6"]');
    viejo.focus();
    await pagina.tocar(viejo);
    await pagina.correr();
    await pagina.tocar(pagina.el('ml-guardar'));
    const nuevo = pagina.el('vista-licencias').querySelector('[data-editar-licencia="6"]');
    assert.notEqual(nuevo, viejo, 'la lista se volvió a dibujar');
    assert.equal(viejo.isConnected, false);
    // Mientras se ve el segundo paso, el foco está en «Descargar Word»
    assert.equal(pagina.documento.activeElement, pagina.el('ml-descargar-word'));
    await pagina.tocar(pagina.el('ml-paso-dos-pie').querySelector('[data-cerrar]'));
    assert.equal(pagina.abierto('modal-licencia'), false);
    assert.equal(pagina.documento.activeElement, nuevo);
  });

  it('después de borrar desde la lista, el foco va al «Editar» de la fila que seguía; sin ninguna fila, al título del panel',
    async () => {
      const lista = licenciasDe(PLANTA);
      let despues = { ...lista, licencias: lista.licencias.filter((fila) => fila.id !== 6) };
      let borrada = false;
      const pagina = montarPagina({
        hash: '#licencias',
        responder: conFormularios({
          extra: (metodo, ruta) => {
            if (metodo === 'DELETE') { borrada = true; return ok(undefined, 'Licencia borrada.'); }
            if (ruta === '/api/mi-espacio/licencias') return ok(borrada ? despues : lista);
            return undefined;
          }
        })
      });
      await pagina.iniciar();
      const vista = pagina.el('vista-licencias');
      vista.querySelector('[data-editar-licencia="6"]').focus();
      await pagina.tocar(vista.querySelector('[data-editar-licencia="6"]'));
      await pagina.tocar(pagina.el('ml-borrar'));
      await pagina.tocar(pagina.el('modal-confirmar-si'));
      assert.equal(vista.querySelector('[data-editar-licencia="6"]'), null);
      assert.equal(pagina.documento.activeElement, vista.querySelector('[data-editar-licencia="5"]'));

      // La última: sin filas ni saldo inicial, el título de la tarjeta, que recibe el foco con tabindex="-1"
      borrada = false;
      despues = { ...lista, licencias: [], filtros: [], saldo_inicial: null };
      vista.querySelector('[data-editar-licencia="1"]').focus();
      await pagina.tocar(vista.querySelector('[data-editar-licencia="1"]'));
      await pagina.tocar(pagina.el('ml-borrar'));
      await pagina.tocar(pagina.el('modal-confirmar-si'));
      const titulo = vista.querySelector('h2');
      assert.equal(titulo.textContent, 'Mis licencias de 2026');
      assert.equal(titulo.getAttribute('tabindex'), '-1');
      assert.equal(pagina.documento.activeElement, titulo);
    });

  it('después de guardar unas horas extras del día por día, el foco va a su «Editar» nuevo', async () => {
    const pagina = montarPagina({
      hash: '#horas',
      responder: conFormularios({ extra: (metodo) => (metodo === 'PUT' ? ok({ id: 12 }, 'Horas extras corregidas.') : undefined) })
    });
    await pagina.iniciar();
    const viejo = pagina.el('vista-horas').querySelector('[data-editar-horas="12"]');
    viejo.focus();
    await pagina.tocar(viejo);
    await pagina.tocar(pagina.el('mh-guardar'));
    assert.equal(pagina.abierto('modal-horas'), false);
    assert.equal(viejo.isConnected, false);
    assert.equal(pagina.documento.activeElement, pagina.el('vista-horas').querySelector('[data-editar-horas="12"]'));
  });

  it('un 404 al guardar cierra el modal, lo avisa y vuelve a pedir la pestaña', async () => {
    const pagina = montarPagina({
      hash: '#licencias',
      responder: conFormularios({
        extra: (metodo, ruta) => (metodo === 'PUT' ? respuesta(404, { success: false, error: MENSAJES_MI_ESPACIO.noEncontrada }) : undefined)
      })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-licencias').querySelector('[data-editar-licencia="6"]'));
    await pagina.correr();
    const antes = pagina.rutas().filter((ruta) => ruta === '/api/mi-espacio/licencias').length;
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.equal(pagina.abierto('modal-licencia'), false);
    assert.equal(pagina.el('me-anuncio').textContent, MENSAJES_MI_ESPACIO.noEncontrada);
    assert.equal(pagina.rutas().filter((ruta) => ruta === '/api/mi-espacio/licencias').length, antes + 1);
  });

  it('un clic en el velo no cierra; Escape cierra primero la confirmación y después el modal, y el foco vuelve a «Editar»', async () => {
    const pagina = montarPagina({ hash: '#licencias', responder: conFormularios() });
    await pagina.iniciar();
    const editar = () => pagina.el('vista-licencias').querySelector('[data-editar-licencia="6"]');
    editar().focus();
    await pagina.tocar(editar());
    await pagina.correr();
    pagina.el('modal-licencia').disparar('click');
    await pagina.esperar();
    assert.equal(pagina.abierto('modal-licencia'), true);
    await pagina.tocar(pagina.el('ml-borrar'));
    await pagina.correr();
    assert.equal(pagina.abierto('modal-confirmar'), true);
    assert.equal(pagina.documento.activeElement, pagina.el('modal-confirmar').querySelector('.modal-footer [data-cerrar]'));
    pagina.el('modal-confirmar').disparar('click');
    assert.equal(pagina.abierto('modal-confirmar'), true);
    await pagina.tecla('Escape');
    assert.equal(pagina.abierto('modal-confirmar'), false);
    assert.equal(pagina.abierto('modal-licencia'), true);
    assert.equal(pagina.documento.activeElement, pagina.el('ml-borrar'));
    await pagina.tecla('Escape');
    assert.equal(pagina.abierto('modal-licencia'), false);
    assert.equal(pagina.documento.activeElement, editar());
  });

  it('borrar: la confirmación y el DELETE; después cierra los dos modales y avisa', async () => {
    const pagina = montarPagina({
      hash: '#licencias',
      responder: conFormularios({
        extra: (metodo) => (metodo === 'DELETE' ? ok(undefined, 'Licencia borrada.') : undefined)
      })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-licencias').querySelector('[data-editar-licencia="6"]'));
    await pagina.tocar(pagina.el('ml-borrar'));
    assert.equal(pagina.el('modal-confirmar-texto').textContent, 'Vacaciones del 03/11 al 09/11/2026.');
    await pagina.tocar(pagina.el('modal-confirmar-si'));
    assert.deepEqual(pagina.pedidosA('DELETE', '/api/mi-espacio/licencias/6').length, 1);
    assert.equal(pagina.abierto('modal-confirmar'), false);
    assert.equal(pagina.abierto('modal-licencia'), false);
    assert.equal(pagina.el('me-anuncio').textContent, 'Licencia borrada.');
  });

  // Review Focus 5
  it('un título de modal y una confirmación con una nota <img src=x onerror=alert(1)> se ven como texto', async () => {
    const lista = licenciasDe(PLANTA);
    lista.licencias[0] = { ...lista.licencias[0], fechas_texto: MALICIOSO, nota: MALICIOSO };
    const pagina = montarPagina({ hash: '#licencias', responder: conFormularios({ extra: (m, ruta) => (ruta === '/api/mi-espacio/licencias' ? ok(lista) : undefined) }) });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-licencias').querySelector('[data-editar-licencia="6"]'));
    assert.equal(pagina.el('modal-licencia-titulo').textContent, `Corregir la licencia del ${MALICIOSO}`);
    assert.equal(pagina.el('ml-nota').value, MALICIOSO);
    await pagina.tocar(pagina.el('ml-borrar'));
    assert.ok(pagina.el('modal-confirmar-texto').textContent.includes(`(«${MALICIOSO}»)`));
    for (const id of ['modal-licencia', 'modal-confirmar']) assert.equal(pagina.el(id).querySelector('img'), null, id);
  });

  it('«Cargar horas extras»: la suma mientras se escribe, el POST y, al guardar, la pestaña y el Resumen', async () => {
    const pagina = montarPagina({
      hash: '#horas',
      responder: conFormularios({
        extra: (metodo, ruta) => (metodo === 'POST' && ruta === '/api/mi-espacio/horas-extras'
          ? respuesta(201, { success: true, data: { id: 20 }, message: 'Horas extras cargadas.' }) : undefined)
      })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-horas').querySelector('[data-cargar="horas"]'));
    assert.equal(pagina.abierto('modal-horas'), true);
    assert.equal(pagina.el('modal-horas-titulo').textContent, 'Cargar horas extras al 100%');
    await pagina.correr();
    assert.equal(pagina.documento.activeElement, pagina.el('mh-fecha'));
    await pagina.escribir('mh-fecha', '2026-10-28');
    await pagina.escribir('mh-desde', '19:00');
    await pagina.escribir('mh-hasta', '22:30');
    assert.equal(pagina.el('mh-suma').textContent, '3,5 horas. En octubre llevás 14 horas: 2 francos compensatorios para usar en diciembre.');
    const horas = pagina.pedidosA('GET', '/api/mi-espacio/horas-extras').length;
    await pagina.tocar(pagina.el('mh-guardar'));
    assert.deepEqual(pagina.pedidosA('POST', '/api/mi-espacio/horas-extras')[0].cuerpo,
      { fecha: '2026-10-28', desde: '19:00', hasta: '22:30', nota: '' });
    assert.equal(pagina.abierto('modal-horas'), false);
    assert.equal(pagina.el('me-anuncio').textContent, 'Horas extras cargadas.');
    assert.equal(pagina.pedidosA('GET', '/api/mi-espacio/horas-extras').length, horas + 1);
  });

  it('corregir unas horas extras: los valores del día, un error del servidor en su campo y «Borrar»', async () => {
    const pagina = montarPagina({
      hash: '#horas',
      responder: conFormularios({
        extra: (metodo) => (metodo === 'PUT'
          ? respuesta(400, { success: false, error: 'Se superpone con las horas extras de 19:00 a 22:00 de ese día.', campo: 'desde' }) : undefined)
      })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-horas').querySelector('[data-editar-horas="12"]'));
    assert.equal(pagina.el('modal-horas-titulo').textContent, 'Corregir las horas extras del Mié 14/10');
    assert.deepEqual(['mh-fecha', 'mh-desde', 'mh-hasta'].map((id) => pagina.el(id).value), ['2026-10-14', '17:00', '21:00']);
    assert.equal(pagina.el('mh-borrar').hidden, false);
    await pagina.tocar(pagina.el('mh-guardar'));
    assert.equal(pagina.el('mh-desde').getAttribute('aria-invalid'), 'true');
    assert.equal(pagina.el('mh-desde-error').textContent, 'Se superpone con las horas extras de 19:00 a 22:00 de ese día.');
  });

  it('«Mis vacaciones y saldos»: se abre solo sin el saldo inicial, guarda el año y después el saldo; si el saldo falla, queda abierto', async () => {
    let saldo = respuesta(400, { success: false, error: 'De 0 a 30, el máximo de una licencia.', campo: 'vacaciones-2024' });
    const pagina = montarPagina({
      responder: conSaldosParaArrancar({
        extra: (metodo, ruta) => {
          if (metodo === 'PUT' && ruta === '/api/mi-espacio/anio/2026') return ok({ anio: 2026 }, 'Días del año guardados.');
          if (metodo === 'PUT' && ruta === '/api/mi-espacio/saldo-inicial') return saldo;
          return undefined;
        }
      })
    });
    await pagina.iniciar();
    await pagina.correr();
    assert.equal(pagina.abierto('modal-saldos'), true);
    assert.equal(pagina.el('ms-modalidad').textContent, 'Modalidad: Planta permanente (la carga administración en Configuración → Usuarios)');
    assert.equal(pagina.documento.activeElement, pagina.el('ms-dias').querySelector('input'));
    // Sin estudios elegidos, sin el campo; al elegir la carrera, aparece, y la ayuda dice las mitades de los días elegidos
    assert.equal(pagina.el('ms-campos').querySelector('#ms-campo-estudios'), null);
    await pagina.elegir('ms-dia', '20');
    // Sin arranque, el de hoy (26/10): la primera mitad es lo que se pone en «De la 2026»
    assert.equal(pagina.el('ms-dias-mitades').textContent,
      'La primera mitad es lo que pongas en «De la 2026», más abajo. El 1/1/2027 se habilitan 10.');
    await pagina.elegir('ms-estudio', 'universitario');
    assert.ok(pagina.el('ms-campo-estudios'), 'el campo de los estudios');
    for (const campo of pagina.el('ms-campos').querySelectorAll('input')) campo.value = '0';
    pagina.el('ms-campo-vacaciones-2024').value = '8';
    await pagina.tocar(pagina.el('ms-guardar'));
    assert.deepEqual(pagina.pedidosA('PUT', '/api/mi-espacio/anio/2026')[0].cuerpo, { dias_vacaciones: 20, estudios: 'universitario' });
    assert.deepEqual(pagina.pedidosA('PUT', '/api/mi-espacio/saldo-inicial')[0].cuerpo.saldos,
      { 'vacaciones-2024': 8, 'vacaciones-2025': 0, 'vacaciones-2026': 0, franquicias: 0, estudios: 0, medica: 0, familiar: 0 });
    assert.equal(pagina.abierto('modal-saldos'), true);
    assert.equal(pagina.el('ms-error').textContent,
      'Los días del año se guardaron, pero el saldo inicial no. De 0 a 30, el máximo de una licencia.');
    assert.equal(pagina.el('ms-campo-vacaciones-2024').getAttribute('aria-invalid'), 'true');
    // Al reintentar, sale; el foco vuelve al botón del Resumen que lo abrió, el nuevo (el Resumen se volvió a dibujar)
    saldo = ok({ arranque: HOY }, 'Saldo inicial guardado.');
    const delResumen = pagina.el('vista-resumen').querySelector('[data-abrir="saldos"]');
    await pagina.tocar(pagina.el('ms-guardar'));
    assert.equal(pagina.abierto('modal-saldos'), false);
    assert.equal(pagina.el('me-anuncio').textContent, 'Saldo inicial guardado.');
    assert.equal(delResumen.isConnected, false);
    assert.equal(pagina.documento.activeElement, pagina.el('vista-resumen').querySelector('[data-abrir="saldos"]'));
  });

  // El guardado a medias (la revisión final de la spec 2026-10-28-mi-espacio-vacaciones-en-la-carga): la ayuda de un tope ya trae
  // sus dos puntos («De 0 a 8: …»), así que el aviso de arriba la sigue con un punto, no con otros dos puntos
  it('«Mis vacaciones y saldos»: si el saldo falla con la ayuda de un tope, el aviso no repite los dos puntos', async () => {
    const motivo = 'De 0 a 8: lo que se habilitó de la 2026 hasta hoy.';
    const pagina = montarPagina({
      responder: conSaldosParaArrancar({
        extra: (metodo, ruta) => {
          if (metodo === 'PUT' && ruta === '/api/mi-espacio/anio/2026') return ok({ anio: 2026 }, 'Días del año guardados.');
          if (metodo === 'PUT' && ruta === '/api/mi-espacio/saldo-inicial') {
            return respuesta(400, { success: false, error: motivo, campo: 'vacaciones-2026' });
          }
          return undefined;
        }
      })
    });
    await pagina.iniciar();
    await pagina.correr();
    // Con 15 días, la primera mitad de la 2026 es 8: «De 0 a 8»
    await pagina.elegir('ms-dia', '15');
    await pagina.elegir('ms-estudio', '');
    for (const campo of pagina.el('ms-campos').querySelectorAll('input')) campo.value = '0';
    await pagina.tocar(pagina.el('ms-guardar'));
    assert.equal(pagina.abierto('modal-saldos'), true);
    assert.equal(pagina.el('ms-error').textContent, `Los días del año se guardaron, pero el saldo inicial no. ${motivo}`);
    assert.doesNotMatch(pagina.el('ms-error').textContent, /:.*:/);
    // El motivo, también en su campo
    assert.equal(pagina.el('ms-campo-vacaciones-2026').getAttribute('aria-invalid'), 'true');
  });

  // Cada tope dice de dónde sale (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.8): la ayuda debajo de cada campo, que la
  // del año del arranque sigue a los días que se eligen, y el error de un campo con ayuda, que es su ayuda, sin pedir nada
  it('«Mis vacaciones y saldos»: la ayuda de cada tope sigue a los días elegidos, y es el error del campo', async () => {
    const pagina = montarPagina({ responder: conSaldosParaArrancar() });
    await pagina.iniciar();
    await pagina.correr();
    assert.equal(pagina.abierto('modal-saldos'), true);
    const ayuda = (clave) => pagina.el(`ms-campo-${clave}-ayuda`)?.textContent ?? null;
    // Sin días elegidos, los que mandó el servidor (sin ningún año cargado, 30 y la primera mitad de 30)
    assert.equal(ayuda('vacaciones-2024'), 'De 0 a 30, el máximo de una licencia.');
    assert.equal(ayuda('vacaciones-2026'), 'De 0 a 15: lo que se habilitó de la 2026 hasta hoy.');
    assert.equal(ayuda('medica'), null);
    assert.equal(pagina.el('ms-campo-vacaciones-2026').getAttribute('aria-describedby'),
      'ms-campo-vacaciones-2026-ayuda ms-campo-vacaciones-2026-error');
    assert.equal(pagina.el('ms-campo-medica').getAttribute('aria-describedby'), 'ms-campo-medica-error');
    // Al elegir los días, la del año del arranque cambia con su máximo; las de antes, no
    await pagina.elegir('ms-dia', '15');
    assert.equal(ayuda('vacaciones-2026'), 'De 0 a 8: lo que se habilitó de la 2026 hasta hoy.');
    assert.equal(ayuda('vacaciones-2025'), 'De 0 a 30, el máximo de una licencia.');
    await pagina.elegir('ms-dia', '25');
    assert.equal(ayuda('vacaciones-2026'), 'De 0 a 13: lo que se habilitó de la 2026 hasta hoy.');
    await pagina.elegir('ms-dia', '15');
    await pagina.elegir('ms-estudio', '');
    for (const campo of pagina.el('ms-campos').querySelectorAll('input')) campo.value = '0';
    pagina.el('ms-campo-vacaciones-2026').value = '9';
    pagina.el('ms-campo-medica').value = '26';
    await pagina.tocar(pagina.el('ms-guardar'));
    // No pide nada: los errores, en su campo, con la ayuda o con textoSaldo
    assert.equal(pagina.pedidosA('PUT', '/api/mi-espacio/anio/2026').length, 0);
    assert.equal(pagina.el('ms-campo-vacaciones-2026-error').textContent, 'De 0 a 8: lo que se habilitó de la 2026 hasta hoy.');
    assert.equal(pagina.el('ms-campo-vacaciones-2026').getAttribute('aria-invalid'), 'true');
    assert.equal(pagina.el('ms-campo-medica-error').textContent, 'Escribí un número de 0 a 25.');
  });

  it('«Registrar un uso autorizado» en contrato: con las horas, de a media hora', async () => {
    const pagina = montarPagina({
      hash: '#horas',
      responder: (metodo, ruta) => {
        if (ruta === '/api/mi-espacio/resumen') return ok(resumenDel(CONTRATO));
        if (ruta === '/api/mi-espacio/horas-extras') return ok(horasDe(CONTRATO));
        return RESPUESTAS_DE_ENTRADA(metodo, ruta);
      }
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-horas').querySelector('[data-abrir="uso"]'));
    assert.equal(pagina.abierto('modal-uso'), true);
    assert.equal(pagina.el('mu-grupo-horas').hidden, false);
    assert.equal(pagina.el('mu-horas').innerHTML, M.htmlDeOpcionesDeHoras('medias', ''));
    assert.deepEqual(pagina.el('mu-horas').querySelectorAll('option').map((opcion) => opcion.textContent).slice(0, 3), ['—', '0,5', '1']);
    assert.equal(pagina.el('mu-horas').querySelectorAll('option').at(-1).textContent, '7, el día entero');
    // Una lectora no tiene «Mostrar a mis compañeros»
    assert.equal(pagina.el('mu-grupo-mostrar').hidden, true);
    await pagina.tocar(pagina.el('mu-guardar'));
    assert.equal(pagina.el('mu-horas-error').textContent, MENSAJES_MI_ESPACIO.horasMedias);
    assert.equal(pagina.documento.activeElement, pagina.el('mu-fecha'));
  });

  it('«Registrar un uso autorizado» abre su modal: en planta, sin horas', async () => {
    const pagina = montarPagina({ hash: '#horas', responder: conFormularios() });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-horas').querySelector('[data-abrir="uso"]'));
    assert.equal(pagina.abierto('modal-uso'), true);
    assert.equal(pagina.el('mu-grupo-horas').hidden, true);
    await pagina.escribir('mu-fecha', '2026-11-16');
    await pagina.correr();
    assert.deepEqual(calculos(pagina).at(-1).cuerpo, { tipo: 'uso_autorizado', desde: '2026-11-16', hasta: '2026-11-16', mostrar: true, nota: '' });
  });

  it('después de una carga del Resumen que falló, volver a la pestaña la pide otra vez', async () => {
    let falla = true;
    const pagina = montarPagina({
      responder: (metodo, ruta) => (falla && ruta === '/api/mi-espacio/resumen'
        ? respuesta(500, { success: false, error: 'Error' }) : RESPUESTAS_DE_ENTRADA(metodo, ruta))
    });
    await pagina.iniciar();
    assert.equal(textoDe(pagina.el('vista-resumen').innerHTML), 'No se pudo cargar el resumen. Probá de nuevo en unos minutos.');
    falla = false;
    await pagina.tocar(pagina.el('tab-licencias'));
    await pagina.tocar(pagina.el('tab-resumen'));
    assert.equal(pagina.rutas().filter((ruta) => ruta === '/api/mi-espacio/resumen').length, 2);
    assert.equal(pagina.el('vista-resumen').innerHTML, M.htmlDelResumen(RESUMEN_DE_PLANTA));
    // Ya cargado, volver no lo pide de nuevo
    await pagina.tocar(pagina.el('tab-licencias'));
    await pagina.tocar(pagina.el('tab-resumen'));
    assert.equal(pagina.rutas().filter((ruta) => ruta === '/api/mi-espacio/resumen').length, 2);
  });

  it('«Vence pronto» abre «Cargar licencia» con su tipo elegido', async () => {
    const pagina = montarPagina({ responder: conFormularios() });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-resumen').querySelector('[data-accion="cargar-licencia"]'));
    assert.equal(pagina.abierto('modal-licencia'), true);
    assert.equal(pagina.el('ml-tipos').querySelector('input:checked').getAttribute('value'), 'franco');
    assert.equal(pagina.el('ml-grupo-hasta').hidden, true);
  });

  // Como las páginas hermanas (Áreas, Feriados, Proyectos): el toast se ve y la región viva lo anuncia. showToast inserta HTML
  it('lo que dice el servidor se ve en un aviso de la página (escapado) y se anuncia: un 404 al guardar y un borrado', async () => {
    const pagina = montarPagina({
      hash: '#licencias',
      responder: conFormularios({
        extra: (metodo) => {
          if (metodo === 'PUT') return respuesta(404, { success: false, error: MALICIOSO });
          if (metodo === 'DELETE') return ok(undefined, 'Licencia borrada.');
          return undefined;
        }
      })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-licencias').querySelector('[data-editar-licencia="6"]'));
    await pagina.correr();
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.deepEqual(pagina.estado.toasts, [[ESCAPADO, 'error']]);
    assert.equal(pagina.el('me-anuncio').textContent, MALICIOSO);
    await pagina.tocar(pagina.el('vista-licencias').querySelector('[data-editar-licencia="6"]'));
    await pagina.tocar(pagina.el('ml-borrar'));
    await pagina.tocar(pagina.el('modal-confirmar-si'));
    assert.deepEqual(pagina.estado.toasts.at(-1), ['Licencia borrada.', 'success']);
  });

  // Sin el saldo inicial, los tres botones llevan acá: una persona nueva nunca queda frente a botones que no responden
  it('si «Mis vacaciones y saldos» no se puede abrir (GET /anio o GET /saldo-inicial fallan), un aviso lo dice cada vez', async () => {
    let falla = true;
    const pagina = montarPagina({
      responder: conSaldosParaArrancar({
        extra: (metodo, ruta) => (falla && ruta === '/api/mi-espacio/saldo-inicial'
          ? respuesta(500, { success: false, error: 'Error al obtener el saldo inicial' }) : undefined)
      })
    });
    await pagina.iniciar();
    await pagina.correr();
    const texto = 'No se pudo abrir «Mis vacaciones y saldos». Probá de nuevo en unos minutos.';
    assert.equal(pagina.abierto('modal-saldos'), false);
    assert.deepEqual(pagina.estado.toasts, [[texto, 'error']]);
    assert.equal(pagina.el('me-anuncio').textContent, texto);
    await pagina.tocar(pagina.el('btn-cargar-licencia'));
    assert.equal(pagina.abierto('modal-licencia'), false);
    assert.equal(pagina.estado.toasts.length, 2);
    // Cuando responde, se abre
    falla = false;
    await pagina.tocar(pagina.el('vista-resumen').querySelector('[data-abrir="saldos"]'));
    assert.equal(pagina.abierto('modal-saldos'), true);
  });

  it('«Cargar licencia» antes de que llegue el Resumen (o si falló) lo pide; si no llega, lo avisa y no abre sin los tipos',
    async () => {
      let falla = true;
      const pagina = montarPagina({
        hash: '#licencias',
        responder: conFormularios({
          extra: (metodo, ruta) => (falla && ruta === '/api/mi-espacio/resumen' ? respuesta(500, { success: false, error: 'Error' })
            : undefined)
        })
      });
      await pagina.iniciar();
      const resumenes = () => pagina.rutas().filter((ruta) => ruta === '/api/mi-espacio/resumen').length;
      assert.equal(resumenes(), 1);
      await pagina.tocar(pagina.el('vista-licencias').querySelector('[data-cargar="licencia"]'));
      assert.equal(resumenes(), 2);
      assert.equal(pagina.abierto('modal-licencia'), false);
      assert.deepEqual(pagina.estado.toasts,
        [['No se pudo abrir el formulario: no se pudo cargar el resumen. Probá de nuevo en unos minutos.', 'error']]);
      falla = false;
      await pagina.tocar(pagina.el('vista-licencias').querySelector('[data-cargar="licencia"]'));
      assert.equal(resumenes(), 3);
      assert.equal(pagina.abierto('modal-licencia'), true);
      assert.equal(pagina.el('ml-tipos-opciones').innerHTML, M.htmlDeTiposDeLicencia(RESUMEN_DE_PLANTA.tipos, ''));
    });

  it('un error del servidor en un campo oculto (el hasta de una franquicia) va al aviso del modal, no queda invisible', async () => {
    const pagina = montarPagina({
      responder: conFormularios({
        extra: (metodo, ruta) => (metodo === 'POST' && ruta === '/api/mi-espacio/licencias'
          ? respuesta(400, { success: false, error: 'La fecha no es válida.', campo: 'hasta' }) : undefined)
      })
    });
    await pagina.iniciar();
    await cargarLicencia(pagina, { tipo: 'franquicia', desde: '2026-11-16', horas: '3' });
    assert.equal(pagina.el('ml-grupo-hasta').hidden, true);
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.equal(pagina.el('ml-error').textContent, 'La fecha no es válida.');
    assert.equal(pagina.el('ml-error').hidden, false);
    assert.equal(pagina.el('ml-hasta-error').hidden, true);
    assert.equal(pagina.el('ml-hasta').getAttribute('aria-invalid'), null);
    assert.equal(pagina.documento.activeElement, pagina.el('ml-guardar'));
  });

  it('«Mis vacaciones y saldos» guardado a medias (el año sí, el saldo no) y cerrado con «Cancelar»: vuelve a pedir la página',
    async () => {
      const pagina = montarPagina({
        responder: conSaldosParaArrancar({
          extra: (metodo, ruta) => {
            if (metodo === 'PUT' && ruta === '/api/mi-espacio/anio/2026') return ok({ anio: 2026 }, 'Días del año guardados.');
            if (metodo === 'PUT' && ruta === '/api/mi-espacio/saldo-inicial') {
              return respuesta(400, { success: false, error: 'Escribí un número de 0 a 30.', campo: 'vacaciones-2024' });
            }
            return undefined;
          }
        })
      });
      await pagina.iniciar();
      await pagina.correr();
      await pagina.elegir('ms-dia', '20');
      await pagina.elegir('ms-estudio', '');
      for (const campo of pagina.el('ms-campos').querySelectorAll('input')) campo.value = '0';
      await pagina.tocar(pagina.el('ms-guardar'));
      assert.equal(pagina.abierto('modal-saldos'), true);
      const resumenes = () => pagina.rutas().filter((ruta) => ruta === '/api/mi-espacio/resumen').length;
      const antes = resumenes();
      await pagina.tocar(pagina.el('modal-saldos').querySelector('.modal-footer [data-cerrar]'));
      assert.equal(pagina.abierto('modal-saldos'), false);
      assert.equal(resumenes(), antes + 1);
      // Sin nada guardado, cerrarlo no pide nada
      await pagina.tocar(pagina.el('vista-resumen').querySelector('[data-abrir="saldos"]'));
      assert.equal(pagina.abierto('modal-saldos'), true);
      await pagina.tocar(pagina.el('modal-saldos').querySelector('.modal-footer [data-cerrar]'));
      assert.equal(resumenes(), antes + 1);
    });

  it('después de guardar unas horas extras de un mes pasado, el día por día sigue en ese mes', async () => {
    const pagina = montarPagina({
      hash: '#horas',
      responder: conFormularios({ extra: (metodo) => (metodo === 'PUT' ? ok({ id: 5 }, 'Horas extras corregidas.') : undefined) })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-horas').querySelector('[data-mes="2026-08"]'));
    const editar = pagina.el('vista-horas').querySelector('[data-editar-horas="5"]');
    assert.ok(editar, 'el día por día de agosto');
    editar.focus();
    await pagina.tocar(editar);
    await pagina.tocar(pagina.el('mh-guardar'));
    assert.equal(pagina.abierto('modal-horas'), false);
    assert.equal(pagina.el('vista-horas').querySelector('[data-mes="2026-08"]').getAttribute('aria-pressed'), 'true');
    assert.equal(pagina.documento.activeElement, pagina.el('vista-horas').querySelector('[data-editar-horas="5"]'));
  });

  // Spec, sección 7: las franquicias y las horas de menos de 7 horas no se les muestran nunca a los compañeros
  it('«Mostrar a mis compañeros» solo en una licencia de día entero: no en una franquicia ni unas horas de menos de 7', async () => {
    const pagina = montarPagina({ responder: conFormularios() });
    await pagina.iniciar();
    await cargarLicencia(pagina, { tipo: 'franquicia', desde: '2026-11-16', horas: '3' });
    assert.equal(pagina.el('ml-grupo-mostrar').hidden, true);
    // Con la jornada entera, sí
    await pagina.escribir('ml-horas', '7', 'change');
    assert.equal(pagina.el('ml-grupo-mostrar').hidden, false);
    await pagina.escribir('ml-horas', '6', 'change');
    assert.equal(pagina.el('ml-grupo-mostrar').hidden, true);
    // Una de días enteros, sí
    await pagina.elegir('ml-tipo', 'medica');
    assert.equal(pagina.el('ml-grupo-mostrar').hidden, false);
    await pagina.tocar(pagina.el('modal-licencia').querySelector('.modal-footer [data-cerrar]'));
    // El uso autorizado de planta es un franco, el día entero
    await pagina.tocar(pagina.el('tab-horas'));
    await pagina.tocar(pagina.el('vista-horas').querySelector('[data-abrir="uso"]'));
    assert.equal(pagina.el('mu-grupo-mostrar').hidden, false);
  });

  it('esDeDiaEntero: las de horas, solo con la jornada entera; el uso autorizado de planta es el día entero', () => {
    for (const [tipo, horas, modalidad, esperado] of [['horas_a_favor', '3', 'contrato', false], ['horas_a_favor', '7', 'contrato', true],
      ['uso_autorizado', '6.5', 'contrato', false], ['uso_autorizado', '7', 'contrato', true], ['uso_autorizado', '', 'planta', true],
      ['franquicia', '', 'planta', false], ['franquicia', '7', 'planta', true], ['vacaciones', '', 'planta', true],
      ['franco', '', 'planta', true], ['', '', 'planta', true]]) {
      assert.equal(M.esDeDiaEntero(tipo, horas, modalidad), esperado, `${tipo} ${horas} ${modalidad}`);
    }
    // Lo mismo que esDiaEntero del servidor con las horas que guarda (el uso autorizado de planta, la jornada entera)
    for (const tipo of ['vacaciones', 'medica', 'franco', 'franquicia', 'horas_a_favor', 'uso_autorizado']) {
      for (const modalidad of ['planta', 'contrato']) {
        for (const horas of ['', '0.5', '3', '6.5', '7']) {
          let guardadas = null;
          if (tipo === 'uso_autorizado' && modalidad === 'planta') guardadas = JORNADA;
          else if (TIPOS_POR_HORAS.includes(tipo) && horas !== '') guardadas = Number(horas);
          assert.equal(M.esDeDiaEntero(tipo, horas, modalidad), esDiaEntero({ tipo, horas: guardadas }), `${tipo} ${horas} ${modalidad}`);
        }
      }
    }
  });
});

describe('mi-espacio.html: los estilos de los errores', () => {
  // aria-invalid va en cada radio, no en el fieldset (ARIA 1.2): el borde rojo se engancha del radio
  it('el borde rojo de un grupo de opciones con error sale del radio con aria-invalid', () => {
    const html = leer('mi-espacio.html');
    assert.ok(html.includes('.me-opcion:has(input[aria-invalid="true"])'));
    assert.ok(html.includes('.me-numero input[aria-invalid="true"] + span'));
    assert.ok(!html.includes('.me-grupo[aria-invalid="true"]'));
  });
});

// =====================================================================================================================================
// La agenda en la página (DOM falso; spec 2026-10-26-mi-espacio-agenda, 6; Task 9): la pestaña, el mes con ‹ › y «Hoy», «y N más»,
// los próximos, la leyenda, «Ver la agenda» y lo que se vuelve a pedir después de guardar. Desde la agenda con más onda (spec
// 2026-10-28-mi-espacio-agenda-onda), la página dibuja el mes con su día elegido (hoy, o el 1 de otro mes, el visible más cercano:
// en la compu no se ve) y pide el mes con su mes (mes=AAAA-MM); lo nuevo, más abajo, después del formulario del evento
// =====================================================================================================================================

// El pedido del mes lleva su mes (para la frase de la banda, spec 2026-10-28-mi-espacio-agenda-onda, 5.2); el de los próximos, no
const RUTA_DEL_MES = '/api/mi-espacio/eventos?desde=2026-09-28&hasta=2026-11-01&mes=2026-10';
const RUTA_DE_PROXIMOS = '/api/mi-espacio/eventos?desde=2026-10-26&hasta=2026-11-25';
// Lo que contesta el servidor con la frase del mes, como listarEventos: con `mes` (el mes entero dentro del rango), fraseDelMes con los
// eventos, los feriados y las licencias de la respuesta; si no, null
const conLaFrase = (datos, mes) => {
  const delMes = mesDeLaFrase(mes, datos);
  return { ...datos, frase_del_mes: delMes === null ? null : fraseDelMes({ mes: delMes, ...datos }) };
};
// El servidor falso con la agenda: el mes de octubre, los próximos y cualquier otro rango (armado igual, con la frase si el pedido
// trae el mes); `cambios`, las respuestas de algunas rutas (una función o una respuesta)
const conEventos = (cambios = {}) => async (metodo, ruta, cuerpo) => {
  if (Object.hasOwn(cambios, ruta)) return typeof cambios[ruta] === 'function' ? cambios[ruta](metodo, ruta, cuerpo) : cambios[ruta];
  if (ruta === RUTA_DEL_MES) return ok(conLaFrase(DEL_MES, '2026-10'));
  if (ruta === RUTA_DE_PROXIMOS) return ok(PROXIMOS);
  if (ruta.startsWith('/api/mi-espacio/eventos?')) {
    const parametros = new URL(ruta, 'http://rpad.test').searchParams;
    return ok(conLaFrase(respuestaDeEventos({ desde: parametros.get('desde'), hasta: parametros.get('hasta') }), parametros.get('mes')));
  }
  return RESPUESTAS_DE_ENTRADA(metodo, ruta, cuerpo);
};
const pedidosDeEventos = (pagina) => pagina.rutas().filter((ruta) => ruta.startsWith('/api/mi-espacio/eventos'));
// El mes como lo dibuja la página en la compu, con sábado y domingo ocultos: su día elegido (y el del foco), el de `elegido`
const mesEnLaPagina = (mes, datos, elegido, opciones = {}) => M.htmlDelMes(mes, datos, HOY, { elegido, foco: elegido, ...opciones });

describe('la agenda en la página (DOM falso)', () => {
  it('#agenda: pide el Resumen, la grilla del mes de hoy y los próximos, y los dibuja con el título del mes y la leyenda', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conEventos() });
    await pagina.iniciar();
    assert.deepEqual(pagina.rutas().sort(), ['/api/mi-espacio/eventos?desde=2026-09-28&hasta=2026-11-01&mes=2026-10',
      '/api/mi-espacio/eventos?desde=2026-10-26&hasta=2026-11-25', '/api/mi-espacio/resumen']);
    assert.deepEqual(pagina.estado.direcciones, ['#agenda']);
    assert.equal(pagina.el('tab-agenda').getAttribute('aria-selected'), 'true');
    assert.equal(pagina.el('tab-agenda').tabIndex, 0);
    for (const otra of ['resumen', 'licencias', 'horas']) assert.equal(pagina.el(`vista-${otra}`).hidden, true, otra);
    assert.equal(pagina.el('vista-agenda').hidden, false);
    assert.equal(pagina.el('ag-mes-titulo').textContent, 'Octubre 2026');
    assert.equal(pagina.el('ag-mes').innerHTML, mesEnLaPagina('2026-10', DEL_MES, HOY));
    assert.equal(pagina.el('ag-proximos').innerHTML, M.htmlDeProximos(M.gruposDeProximos(PROXIMOS, HOY)));
    // Quien ve a sus compañeros tiene su color en la leyenda, y también el de los Laborales (spec 2026-10-29-mi-espacio-evento-publico,
    // 5.2): administración ve los siete
    assert.equal(pagina.el('ag-leyenda-ausentes').hidden, false);
    assert.equal(pagina.el('ag-leyenda-laborales').hidden, false);
    const leyenda = pagina.el('vista-agenda').querySelector('.me-leyenda');
    assert.deepEqual(leyenda.querySelectorAll('li').filter((li) => !li.hidden).map((li) => li.textContent),
      ['Solo vos', 'Tuyos, a la vista', 'Personales de otros', 'Laborales', 'Tus licencias y francos', 'Feriados', 'Compañeros que no están']);
  });

  it('sin fragmento no pide la agenda; abrirla la pide una sola vez, y volver a ella no la pide otra vez', async () => {
    const pagina = montarPagina({ responder: conEventos() });
    await pagina.iniciar();
    assert.deepEqual(pagina.rutas(), ['/api/mi-espacio/resumen']);
    await pagina.tocar(pagina.el('tab-agenda'));
    assert.equal(pagina.ventana.location.hash, '#agenda');
    assert.deepEqual(pedidosDeEventos(pagina).sort(), [RUTA_DEL_MES, RUTA_DE_PROXIMOS]);
    await pagina.tocar(pagina.el('tab-resumen'));
    await pagina.tocar(pagina.el('tab-agenda'));
    assert.equal(pedidosDeEventos(pagina).length, 2);
  });

  it('‹ y › cambian de mes (también de año): el título y la grilla del mes, que se anuncia; «Hoy» vuelve; el mes no va en la dirección', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conEventos() });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('ag-siguiente'));
    assert.equal(pagina.el('ag-mes-titulo').textContent, 'Noviembre 2026');
    assert.equal(pedidosDeEventos(pagina).at(-1), '/api/mi-espacio/eventos?desde=2026-10-26&hasta=2026-12-06&mes=2026-11');
    const noviembre = respuestaDeEventos({ desde: '2026-10-26', hasta: '2026-12-06' });
    // El 1 es domingo: con sábado y domingo ocultos, el elegido es el lunes 2
    assert.equal(pagina.el('ag-mes').innerHTML, mesEnLaPagina('2026-11', noviembre, '2026-11-02'));
    assert.equal(pagina.el('me-anuncio').textContent, 'Noviembre 2026');
    // Los próximos no se vuelven a pedir, y el mes no va en la dirección
    assert.equal(pedidosDeEventos(pagina).filter((ruta) => ruta === RUTA_DE_PROXIMOS).length, 1);
    assert.deepEqual(pagina.estado.direcciones, ['#agenda']);
    await pagina.tocar(pagina.el('ag-anterior'));
    await pagina.tocar(pagina.el('ag-anterior'));
    assert.equal(pagina.el('ag-mes-titulo').textContent, 'Septiembre 2026');
    assert.equal(pedidosDeEventos(pagina).at(-1), '/api/mi-espacio/eventos?desde=2026-08-31&hasta=2026-10-04&mes=2026-09');
    await pagina.tocar(pagina.el('ag-hoy'));
    assert.equal(pagina.el('ag-mes-titulo').textContent, 'Octubre 2026');
    assert.equal(pagina.el('ag-mes').innerHTML, mesEnLaPagina('2026-10', DEL_MES, HOY));
    // «Hoy» en el mes de hoy no pide nada
    const antes = pagina.rutas().length;
    await pagina.tocar(pagina.el('ag-hoy'));
    assert.equal(pagina.rutas().length, antes);
    for (let i = 0; i < 3; i += 1) await pagina.tocar(pagina.el('ag-siguiente'));
    assert.equal(pagina.el('ag-mes-titulo').textContent, 'Enero 2027');
    assert.equal(pedidosDeEventos(pagina).at(-1), '/api/mi-espacio/eventos?desde=2026-12-28&hasta=2027-01-31&mes=2027-01');
  });

  it('un mes que llega tarde no pisa el que se eligió después', async () => {
    let soltarNoviembre;
    const noviembreTarda = new Promise((resolver) => { soltarNoviembre = resolver; });
    const pagina = montarPagina({
      hash: '#agenda',
      responder: conEventos({
        '/api/mi-espacio/eventos?desde=2026-10-26&hasta=2026-12-06&mes=2026-11': async () => {
          await noviembreTarda;
          return ok(respuestaDeEventos({ desde: '2026-10-26', hasta: '2026-12-06' }));
        }
      })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('ag-siguiente'));
    await pagina.tocar(pagina.el('ag-siguiente'));
    assert.equal(pagina.el('ag-mes-titulo').textContent, 'Diciembre 2026');
    const diciembre = pagina.el('ag-mes').innerHTML;
    const fraseDeDiciembre = pagina.el('ag-frase').textContent;
    const elegidoDeDiciembre = pagina.el('ag-elegido').innerHTML;
    assert.ok(fraseDeDiciembre.length > 0);
    soltarNoviembre();
    await pagina.esperar();
    assert.equal(pagina.el('ag-mes-titulo').textContent, 'Diciembre 2026');
    assert.equal(pagina.el('ag-mes').innerHTML, diciembre);
    assert.equal(pagina.el('ag-frase').textContent, fraseDeDiciembre);
    assert.equal(pagina.el('ag-elegido').innerHTML, elegidoDeDiciembre);
    assert.equal(pagina.el('me-anuncio').textContent, 'Diciembre 2026');
  });

  it('«y 2 más» muestra el resto en la celda, se va, y el foco va a lo primero que apareció', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conEventos({ [RUTA_DEL_MES]: ok(UN_DIA_LLENO) }) });
    await pagina.iniciar();
    const boton = pagina.el('ag-mes').querySelector('[data-ver-mas="2026-10-15"]');
    const celda = boton.closest('.me-celda');
    assert.equal(celda.querySelector('.me-resto').hidden, true);
    const antes = pagina.rutas().length;
    await pagina.tocar(boton);
    assert.equal(celda.querySelector('.me-resto').hidden, false);
    assert.equal(boton.hidden, true);
    assert.equal(pagina.documento.activeElement, celda.querySelector('[data-evento="32"]'));
    assert.equal(pagina.rutas().length, antes);
    // «y N más» es parte del día, pero no abre «Nuevo evento»
    assert.equal(pagina.abierto('modal-evento'), false);
  });

  // Decisión del usuario (27/10/2026): a quien no ve a los compañeros (el lector y el colaborador), la leyenda no le muestra su color.
  // Desde el evento Personal (Público) (spec 2026-10-29-mi-espacio-evento-publico, 5.2), tampoco el de los Laborales, que no puede ver
  it('la leyenda: sin puede_compartir, sin «Laborales» ni «Compañeros que no están»; las otras cinco quedan', async () => {
    const lector = (rango) => ok({ ...respuestaDeEventos(rango, { puedeCompartir: false }) });
    const pagina = montarPagina({
      hash: '#agenda',
      responder: conEventos({
        [RUTA_DEL_MES]: lector({ desde: '2026-09-28', hasta: '2026-11-01' }), [RUTA_DE_PROXIMOS]: lector({ desde: '2026-10-26', hasta: '2026-11-25' })
      })
    });
    await pagina.iniciar();
    const leyenda = pagina.el('vista-agenda').querySelector('.me-leyenda');
    assert.deepEqual(leyenda.querySelectorAll('li').filter((li) => !li.hidden).map((li) => li.textContent),
      ['Solo vos', 'Tuyos, a la vista', 'Personales de otros', 'Tus licencias y francos', 'Feriados']);
    assert.equal(pagina.el('ag-leyenda-laborales').hidden, true);
    assert.equal(pagina.el('ag-leyenda-ausentes').hidden, true);
    assert.ok(!pagina.el('ag-mes').innerHTML.includes('no está'));
  });

  it('si el mes o los próximos no llegan, lo dicen en su lugar y en #me-anuncio; volver a la pestaña pide lo que falta', async () => {
    let falla = true;
    const pagina = montarPagina({
      hash: '#agenda',
      responder: conEventos({
        [RUTA_DE_PROXIMOS]: () => (falla ? respuesta(500, { success: false, error: 'Error al obtener los eventos' }) : ok(PROXIMOS))
      })
    });
    await pagina.iniciar();
    const texto = 'No se pudieron cargar los próximos. Probá de nuevo en unos minutos.';
    assert.equal(textoDe(pagina.el('ag-proximos').innerHTML), texto);
    assert.equal(pagina.el('me-anuncio').textContent, texto);
    assert.equal(pagina.el('ag-mes').innerHTML, mesEnLaPagina('2026-10', DEL_MES, HOY));
    falla = false;
    const antes = pedidosDeEventos(pagina).length;
    await pagina.tocar(pagina.el('tab-resumen'));
    await pagina.tocar(pagina.el('tab-agenda'));
    assert.deepEqual(pedidosDeEventos(pagina).slice(antes), [RUTA_DE_PROXIMOS]);
    assert.equal(pagina.el('ag-proximos').innerHTML, M.htmlDeProximos(M.gruposDeProximos(PROXIMOS, HOY)));
    // Un mes que no llega lo dice en la grilla
    const otra = montarPagina({ hash: '#agenda', responder: conEventos({ [RUTA_DEL_MES]: respuesta(500, { success: false, error: 'Error' }) }) });
    await otra.iniciar();
    assert.equal(textoDe(otra.el('ag-mes').innerHTML), 'No se pudo cargar el mes. Probá de nuevo en unos minutos.');
    assert.equal(otra.el('ag-mes-titulo').textContent, 'Octubre 2026');
  });

  it('con la sesión vencida (401) en la agenda, cierra la sesión y va al login', async () => {
    const pagina = montarPagina({
      hash: '#agenda',
      responder: (metodo, ruta) => (ruta.startsWith('/api/mi-espacio/eventos') ? respuesta(401, { success: false, error: 'Token expirado' })
        : RESPUESTAS_DE_ENTRADA(metodo, ruta))
    });
    await pagina.iniciar();
    assert.equal(pagina.estado.sesionCerrada, true);
    assert.equal(pagina.ventana.location.href, 'login.html');
  });

  // Decisión del usuario (27/10/2026): sin modalidad, la agenda se ve igual
  it('sin modalidad, la pestaña Agenda y «Nuevo evento» se ven igual (los botones de carga, no)', async () => {
    const resumen = resumenDel(PLANTA, { estado: { ...PLANTA.estado, modalidad: null } });
    const pagina = montarPagina({ hash: '#agenda', responder: conEventos({ '/api/mi-espacio/resumen': ok(resumen) }) });
    await pagina.iniciar();
    assert.equal(pagina.el('btn-cargar-horas').hidden, true);
    assert.equal(pagina.el('btn-cargar-licencia').hidden, true);
    assert.equal(pagina.el('btn-nuevo-evento').hidden, false);
    assert.equal(pagina.el('ag-nuevo-evento').hidden, false);
    assert.equal(pagina.el('tab-agenda').hidden, false);
    assert.equal(pagina.el('ag-mes').innerHTML, mesEnLaPagina('2026-10', DEL_MES, HOY));
  });

  it('«Ver la agenda» de «Hoy y mañana» abre la pestaña Agenda (la pide) y el foco va a la pestaña', async () => {
    const resumen = { ...RESUMEN_DE_PLANTA, hoy_y_manana: { ...RESUMEN_DE_PLANTA.hoy_y_manana, eventos: [] } };
    const pagina = montarPagina({ responder: conEventos({ '/api/mi-espacio/resumen': ok(resumen) }) });
    await pagina.iniciar();
    const link = pagina.el('vista-resumen').querySelectorAll('a').find((a) => a.textContent === 'Ver la agenda');
    const evento = link.disparar('click');
    await pagina.esperar();
    assert.equal(evento.defaultPrevented, true);
    assert.equal(pagina.el('tab-agenda').getAttribute('aria-selected'), 'true');
    assert.equal(pagina.documento.activeElement, pagina.el('tab-agenda'));
    assert.equal(pagina.ventana.location.hash, '#agenda');
    assert.deepEqual(pedidosDeEventos(pagina).sort(), [RUTA_DEL_MES, RUTA_DE_PROXIMOS]);
  });

  // Riesgo 5 del preflight: volverAPedirTodo corre después de guardar o de borrar cualquier cosa (también una licencia, que se ve en
  // la agenda)
  it('después de guardar o de borrar: con la agenda a la vista, se vuelven a pedir el mes que se ve y los próximos; si no, al abrirla', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conEventos() });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('ag-siguiente'));
    const antes = pedidosDeEventos(pagina).length;
    await pagina.contexto.volverAPedirTodo();
    await pagina.esperar();
    assert.deepEqual(pedidosDeEventos(pagina).slice(antes).sort(), ['/api/mi-espacio/eventos?desde=2026-10-26&hasta=2026-11-25',
      '/api/mi-espacio/eventos?desde=2026-10-26&hasta=2026-12-06&mes=2026-11']);
    assert.equal(pagina.el('ag-mes-titulo').textContent, 'Noviembre 2026');
    // Con otra pestaña a la vista, nada; al volver a la agenda, se pide otra vez
    await pagina.tocar(pagina.el('tab-licencias'));
    const despues = pedidosDeEventos(pagina).length;
    await pagina.contexto.volverAPedirTodo();
    await pagina.esperar();
    assert.equal(pedidosDeEventos(pagina).length, despues);
    await pagina.tocar(pagina.el('tab-agenda'));
    assert.equal(pedidosDeEventos(pagina).length, despues + 2);
    assert.equal(pagina.el('ag-mes-titulo').textContent, 'Noviembre 2026');
  });

  // En el teléfono las cuatro pestañas no entran (la barra mide 453 px en 343): la elegida se lleva a la vista moviendo solo la barra
  it('en una barra angosta, la pestaña elegida se lleva a la vista, moviendo solo la barra', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conEventos() });
    const barra = pagina.el('tab-agenda').parentNode;
    const posiciones = { resumen: [16, 133], licencias: [137, 241], horas: [245, 373], agenda: [376, 468] };
    barra.scrollLeft = 0;
    barra.getBoundingClientRect = () => ({ left: 16, right: 359 });
    for (const [nombre, [left, right]] of Object.entries(posiciones)) {
      pagina.el(`tab-${nombre}`).getBoundingClientRect = () => ({ left: left - barra.scrollLeft, right: right - barra.scrollLeft });
    }
    await pagina.iniciar();
    assert.equal(barra.scrollLeft, 109, 'la Agenda, entera a la vista');
    await pagina.tocar(pagina.el('tab-licencias'));
    assert.equal(barra.scrollLeft, 109, 'Licencias ya se ve: no se mueve');
    await pagina.tocar(pagina.el('tab-resumen'));
    assert.equal(barra.scrollLeft, 0, 'el Resumen, de vuelta al principio');
  });

  // Desde la Task 10: un evento propio abre el formulario; uno ajeno, su detalle; los dos «Nuevo evento», el formulario vacío
  it('un evento propio de la grilla abre el formulario; uno ajeno de los próximos, su detalle; «Nuevo evento», el formulario vacío', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conEventos() });
    await pagina.iniciar();
    const abiertos = () => pagina.documento.querySelectorAll('.modal-overlay').filter((modal) => modal.classList.contains('active'))
      .map((modal) => modal.id);
    await pagina.tocar(pagina.el('ag-mes').querySelector('[data-evento="11"]'));
    assert.deepEqual(abiertos(), ['modal-evento']);
    assert.equal(pagina.el('modal-evento-titulo').textContent, 'Editar evento');
    await pagina.tecla('Escape');
    await pagina.tocar(pagina.el('ag-proximos').querySelector('[data-evento="14"]'));
    assert.deepEqual(abiertos(), ['modal-evento-ajeno']);
    await pagina.tecla('Escape');
    for (const id of ['ag-nuevo-evento', 'btn-nuevo-evento']) {
      await pagina.tocar(pagina.el(id));
      assert.deepEqual(abiertos(), ['modal-evento'], id);
      assert.equal(pagina.el('modal-evento-titulo').textContent, 'Nuevo evento', id);
      await pagina.tecla('Escape');
    }
    assert.deepEqual(abiertos(), []);
  });
});

// =====================================================================================================================================
// El formulario del evento y el detalle de un evento ajeno (spec 2026-10-26-mi-espacio-agenda, 1, 2 y 6; maqueta 2, #evento y
// #evento-ajeno; Task 10): las copias atadas al servidor (services/miEspacioEventosReglas.js), lo puro y, con el DOM y el fetch
// falsos, crear, cambiar, compartir, el aviso del recordatorio, borrar, «Mi recordatorio» y el foco. Hoy es el lunes 26/10/2026 a las
// 09:00 y quien mira es Laura Gómez (1); las personas son las inventadas de la maqueta
// =====================================================================================================================================

// Los textos de 150 y 151 emojis: cada uno es un caracter (Array.from) y dos unidades de UTF-16
const emojis = (n) => '😀'.repeat(n);
// Un evento válido para la validación (el martes 27/10/2026 de 10:00 a 11:00), con lo que cambia cada caso
const entradaDe = (cambios) => ({ titulo: 'Reunión de equipo', fecha: '2026-10-27', desde: '10:00', hasta: '11:00', ...cambios });
// El primer error de erroresDelEvento, como el error de validarEvento ({ campo, mensaje } o null). Con `puedeCompartir`, como lo
// llama la página para administración: el permiso de un Laboral lo controla la API, después de validarEvento
const primerError = (entrada, hoy) => {
  const [primero] = Object.entries(plano(M.erroresDelEvento(entrada, hoy, { puedeCompartir: true })));
  return primero ? { campo: primero[0], mensaje: primero[1] } : null;
};
// Cada evento de EVENTOS_DE_PRUEBA como lo manda GET /api/mi-espacio/eventos
const itemDe = (id) => comoLlega(itemDeEvento(EVENTOS_DE_PRUEBA.find((evento) => evento.id === id),
  { usuarioId: 1, ahora: AHORA, feriados: SIN_FERIADOS }));

describe('el formulario del evento: las paridades', () => {
  it('los mensajes, los largos, la fecha mínima y los recordatorios son los del servidor', () => {
    assert.deepEqual(plano(M.MENSAJES_EVENTO), { ...MENSAJES_EVENTO });
    assert.equal(M.LARGO_TITULO_EVENTO, LARGO_TITULO_EVENTO);
    assert.equal(M.LARGO_DETALLE_EVENTO, LARGO_DETALLE_EVENTO);
    assert.equal(M.FECHA_MINIMA_EVENTO, FECHA_MINIMA_EVENTO);
    assert.deepEqual(plano(M.RECORDATORIOS), [...RECORDATORIOS]);
    assert.equal(M.RECORDATORIO_POR_DEFECTO, RECORDATORIO_POR_DEFECTO);
    assert.deepEqual(plano(M.TEXTO_RECORDATORIO), { ...TEXTO_RECORDATORIO });
    // Los tres tipos y lo que ven los demás de un Público (spec 2026-10-29-mi-espacio-evento-publico, 4)
    assert.deepEqual(plano(M.TIPOS_DE_EVENTO), [...TIPOS_DE_EVENTO]);
    assert.deepEqual(plano(M.TEXTOS_PUBLICOS), [...TEXTOS_PUBLICOS]);
    assert.equal(M.LARGO_TEXTO_PUBLICO, LARGO_TEXTO_PUBLICO);
    assert.ok(Object.isFrozen(M.TIPOS_DE_EVENTO) && Object.isFrozen(M.TEXTOS_PUBLICOS));
  });

  it('fechaMaximaEvento: el mismo día dos años después (un 29/02 da el 28/02), con el tope del año 9999', () => {
    for (const hoy of ['2026-10-26', '2028-02-29', '2026-12-31', '2025-01-01', '9997-06-01', '9998-01-01', '9999-12-31', null,
      undefined, '', '2026-02-30', 20261026, '26/10/2026']) {
      assert.equal(M.fechaMaximaEvento(hoy), fechaMaximaEvento(hoy), String(hoy));
    }
    assert.equal(M.fechaMaximaEvento('2028-02-29'), '2030-02-28');
    assert.equal(M.fechaMaximaEvento('9998-01-01'), '9999-12-31');
  });

  it('el error de la fecha es textoRangoEvento, también sin un tope', () => {
    for (const hasta of ['2028-10-26', '2030-02-28', '9999-12-31', null]) {
      assert.equal(M.textoRangoDelEvento(hasta), textoRangoEvento(hasta), String(hasta));
    }
  });

  // Los bordes de la Task 2 (tests/mi-espacio-eventos-reglas.test.js): el primer error de erroresDelEvento es el de validarEvento
  it('erroresDelEvento: el primer error es el de validarEvento, en los bordes de cada campo', () => {
    const casos = [{}, { titulo: '  Turno médico  ' }];
    for (const titulo of ['', '   ', '\n\t ', undefined, null, 42, ['Reunión'], { texto: 'Reunión' }, emojis(150), `  ${emojis(150)}  `,
      emojis(151), 'a'.repeat(150), 'a'.repeat(151)]) casos.push({ titulo });
    for (const fecha of ['2024-12-31', '2026-02-30', '2028-10-27', null, undefined, '', '27/10/2026', 20261027, '2026-10-27 10:00',
      '2025-01-01', '2028-10-26', '2026-10-31', '2026-11-01', '2026-12-25', '2026-10-26']) casos.push({ fecha });
    for (const desde of ['24:00', '9:00', '10:00:00', '10:60', '', null, undefined, 1000, ['10:00'], '10h00', ' 10:00', '00:00', '23:59']) {
      casos.push({ desde, hasta: null });
    }
    for (const hasta of ['', null, undefined, '10:01', '10:00', '09:59', '00:00', '24:00', '9:30', '11:00:00', '   ', 1100, ['11:00']]) {
      casos.push({ hasta });
    }
    casos.push({ desde: '00:00', hasta: '23:59' });
    for (const detalle of ['  Sala del 2.º piso.\n', '', '   \n ', null, undefined, 42, ['texto'], emojis(1000), emojis(1001),
      'a'.repeat(1001)]) casos.push({ detalle });
    for (const personas of [[3, 3, 5], ['7', 2, '7'], [], undefined, null, 'todos', 3, [0], ['abc'], [3, -1], [1.5], ['1e3'], ['03'],
      [null], [true], [3, {}]]) {
      casos.push({ compartido: true, personas });
    }
    // «Todos»: las personas se descartan; sin compartido, para_todos no cuenta; compartido y para_todos, solo el true literal
    casos.push({ compartido: true, para_todos: true }, { compartido: true, para_todos: true, personas: [3, 5] },
      { compartido: true, para_todos: true, personas: ['abc'] }, { para_todos: true, personas: [3] },
      { compartido: true, para_todos: true, personas: [] });
    for (const compartido of ['true', 1, '1', 'si', {}, false, null]) casos.push({ compartido, para_todos: true, personas: [] });
    for (const paraTodos of ['true', 1, '1']) casos.push({ compartido: true, para_todos: paraTodos, personas: [] });
    for (const recordatorio of [undefined, null, ...RECORDATORIOS, 'otro', '15m', '', '1H', 2, ['2h'], {}]) casos.push({ recordatorio });
    // Los tres tipos (spec 2026-10-29-mi-espacio-evento-publico, 6.5): el tipo, con el de un cuerpo de antes (sin él o null); lo que
    // ven los demás de un Público y, en los otros tipos, lo que no cuenta; las personas de un Público y de un Laboral
    for (const tipo of [undefined, null, '', 'otro', 'Publico', 'PUBLICO', ' publico', 1, true, ['publico'], {}, ...TIPOS_DE_EVENTO]) {
      casos.push({ tipo }, { tipo, compartido: true, para_todos: true }, { tipo, texto_publico: 'Turno médico', para_todos: true });
    }
    for (const textoPublico of ['Turno médico', '  Turno médico  ', '', '   ', '\n\t', undefined, null, 42, ['Turno médico'],
      emojis(60), `  ${emojis(60)}  `, emojis(61), 'a'.repeat(60), 'a'.repeat(61)]) {
      casos.push({ tipo: 'publico', texto_publico: textoPublico, para_todos: true }, { tipo: 'privado', texto_publico: textoPublico },
        { tipo: 'laboral', texto_publico: textoPublico, para_todos: true });
    }
    for (const personas of [[3, 3, 5], ['7', 2, '7'], [], undefined, null, 'todos', 3, [0], ['abc'], [3, -1], [1.5], [null], [3, {}]]) {
      casos.push({ tipo: 'publico', texto_publico: 'Turno médico', personas }, { tipo: 'laboral', personas }, { tipo: 'privado', personas },
        { tipo: 'publico', texto_publico: 'Turno médico', para_todos: true, personas });
    }
    for (const paraTodos of ['true', 1, '1', false, null]) {
      casos.push({ tipo: 'publico', texto_publico: 'Turno médico', para_todos: paraTodos, personas: [] });
    }
    // Varios errores a la vez: el primero, en el orden del formulario
    casos.push({ tipo: 'publico', texto_publico: '', personas: [], recordatorio: 'otro' }, { tipo: 'otro', texto_publico: '' },
      { tipo: 'publico', texto_publico: emojis(61), personas: ['abc'] }, { tipo: 'laboral', personas: [], recordatorio: 'otro' });
    for (const caso of casos) {
      const entrada = entradaDe(caso);
      assert.deepEqual(primerError(entrada, HOY), validarEvento(entrada, HOY).error, JSON.stringify(caso) ?? String(caso));
    }
    // Lo que no es un objeto, y sin un hoy válido
    for (const entrada of [null, undefined, 'evento', 42, [], true]) {
      assert.deepEqual(primerError(entrada, HOY), validarEvento(entrada, HOY).error, String(entrada));
    }
    for (const hoy of [null, undefined, '2026-02-30']) {
      assert.deepEqual(primerError(entradaDe({}), hoy), validarEvento(entradaDe({}), hoy).error, String(hoy));
    }
  });

  // Con la hora de inicio mal, la de fin se controla solo en su forma (no se sabe si es después)
  it('erroresDelEvento da todos los errores juntos, en el orden del formulario', () => {
    const malo = {
      titulo: ' ', fecha: '2024-12-31', desde: '24:00', hasta: '25:00', detalle: emojis(1001), compartido: true, personas: [],
      recordatorio: 'otro'
    };
    const conPermiso = { puedeCompartir: true };
    assert.equal(plano(M.erroresDelEvento({ ...malo, hasta: '09:00' }, HOY, conPermiso)).hasta, undefined);
    const errores = plano(M.erroresDelEvento(malo, HOY, conPermiso));
    assert.deepEqual(Object.keys(errores), ['titulo', 'fecha', 'desde', 'hasta', 'detalle', 'personas', 'recordatorio']);
    assert.equal(errores.fecha, 'La fecha tiene que ser del 01/01/2025 al 26/10/2028.');
    assert.equal(errores.personas, MENSAJES_EVENTO.personas);
    assert.equal(plano(M.erroresDelEvento({ ...malo, compartido: true, personas: ['abc'] }, HOY, conPermiso)).personas,
      MENSAJES_EVENTO.personasInvalidas);
    assert.deepEqual(plano(M.erroresDelEvento(entradaDe({}), HOY)), {});
    // Un Público: el tipo, lo que ven los demás y sus personas, en su lugar (spec 2026-10-29-mi-espacio-evento-publico, 6.5)
    const publico = plano(M.erroresDelEvento({ ...malo, compartido: undefined, tipo: 'publico', texto_publico: ' ' }, HOY));
    assert.deepEqual(Object.keys(publico), ['titulo', 'fecha', 'desde', 'hasta', 'detalle', 'texto_publico', 'personas', 'recordatorio']);
    assert.equal(publico.texto_publico, MENSAJES_EVENTO.textoPublico);
    assert.equal(publico.personas, MENSAJES_EVENTO.personasPublico);
    const otroTipo = plano(M.erroresDelEvento({ ...malo, tipo: 'otro' }, HOY, conPermiso));
    assert.deepEqual(Object.keys(otroTipo), ['titulo', 'fecha', 'desde', 'hasta', 'detalle', 'tipo', 'recordatorio']);
    assert.equal(otroTipo.tipo, MENSAJES_EVENTO.tipo);
  });

  it('idDeLaPersona es idPositivo', () => {
    for (const valor of [1, 7, '7', 0, -1, 1.5, '1e3', '03', null, undefined, true, {}, [3], '9999999999', '12345678901', NaN,
      Infinity, ' 3', '3 ', '', 'abc']) {
      assert.equal(M.idDeLaPersona(valor), idPositivo(valor), String(valor));
    }
  });

  // Faltaba atarla: con un valor que no es un texto, la del navegador daba la primera cifra de un número
  it('iniciales es inicialesDe', () => {
    for (const nombre of ['Persona de Prueba', 'Martín Ríos', 'laura', '  Sofía   Paz  ', 'Ñandú Álvarez', '', '   ', null, undefined,
      123, 0, ['Ana Paz'], { nombre: 'Ana' }, true]) {
      assert.equal(M.iniciales(nombre), inicialesDe(nombre), String(nombre));
    }
  });

  it('cuandoDelEventoDe es cuandoDelEvento: los siete días, con y sin la hora de fin, y lo que no sirve', () => {
    const casos = [];
    for (const fecha of ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']) {
      casos.push({ fecha, desde: '10:00', hasta: '11:00' }, { fecha, desde: '09:30', hasta: null });
    }
    casos.push({ fecha: '2026-10-27', desde: '10:00', hasta: '' }, { fecha: '2026-10-27', desde: '10:00', hasta: '25:00' },
      { fecha: '2026-10-27', desde: '9:00' }, { fecha: '2026-02-30', desde: '10:00' }, {}, null, 'evento', []);
    for (const caso of casos) assert.equal(M.cuandoDelEventoDe(caso), cuandoDelEvento(caso), JSON.stringify(caso));
  });
});

// Las personas con las que se puede compartir (GET /api/mi-espacio/personas): administración, sin quien pide, con sus iniciales
const PERSONAS_PARA_COMPARTIR = Object.freeze([
  { id: 4, nombre: 'Diego Fernández' }, { id: 6, nombre: 'Carla Benítez' }, { id: 7, nombre: 'Julián Ortiz' },
  { id: 3, nombre: 'Martín Ríos' }, { id: 5, nombre: 'Sofía Paz' }
].map((persona) => ({ ...persona, iniciales: inicialesDe(persona.nombre) })));

describe('el formulario del evento: lo puro', () => {
  it('valoresDelEvento: uno nuevo, con la fecha que se le pasa y «2 horas antes»', () => {
    assert.deepEqual(plano(M.valoresDelEvento(null, { fecha: HOY })), {
      id: null, titulo: '', fecha: HOY, desde: '', hasta: '', detalle: '', tipo: 'privado', para_todos: false, personas: [],
      conocidas: [], texto_publico: '', otro: false, recordatorio: '2h'
    });
  });

  it('valoresDelEvento: uno propio, con sus personas (los ids y los nombres) y su recordatorio', () => {
    assert.deepEqual(plano(M.valoresDelEvento(itemDe(12), { fecha: HOY })), {
      id: 12, titulo: 'Reunión de equipo', fecha: '2026-10-27', desde: '10:00', hasta: '11:00', detalle: '', tipo: 'laboral',
      para_todos: false, personas: [3, 4, 5, 6], recordatorio: '2h', texto_publico: '', otro: false,
      conocidas: [{ id: 3, nombre: 'Martín Ríos' }, { id: 4, nombre: 'Diego Fernández' }, { id: 5, nombre: 'Sofía Paz' },
        { id: 6, nombre: 'Carla Benítez' }]
    });
    const turno = plano(M.valoresDelEvento(itemDe(13), { fecha: HOY }));
    assert.equal(turno.recordatorio, 'dia_anterior');
    assert.equal(turno.hasta, '');
    assert.equal(turno.tipo, 'privado');
    const paraTodos = plano(M.valoresDelEvento(itemDe(15), { fecha: HOY }));
    assert.equal(paraTodos.para_todos, true);
    assert.deepEqual(paraTodos.personas, []);
  });

  it('cuerpoDelEvento: un Personal (Privado), solo con su tipo (el lector y el colaborador, y administración)', () => {
    const valores = { ...plano(M.valoresDelEvento(null, { fecha: HOY })), titulo: '  Turno médico ', desde: '15:30', detalle: ' Llevar estudios. ' };
    for (const opciones of [{}, { puedeCompartir: false }, { puedeCompartir: true }]) {
      assert.deepEqual(plano(M.cuerpoDelEvento(valores, opciones)), {
        titulo: 'Turno médico', fecha: HOY, desde: '15:30', hasta: null, detalle: 'Llevar estudios.', recordatorio: '2h', tipo: 'privado'
      }, JSON.stringify(opciones));
    }
    // Aunque tuviera personas o «Todos» de antes, un Privado no las manda
    assert.deepEqual(Object.keys(plano(M.cuerpoDelEvento({ ...valores, para_todos: true, personas: [3] }, { puedeCompartir: true }))),
      ['titulo', 'fecha', 'desde', 'hasta', 'detalle', 'recordatorio', 'tipo']);
  });

  it('cuerpoDelEvento: un Laboral con «Toda la administración», para_todos y ninguna persona; con personas, ellas', () => {
    const base = { ...plano(M.valoresDelEvento(itemDe(12), { fecha: HOY })) };
    assert.deepEqual(plano(M.cuerpoDelEvento({ ...base, para_todos: true }, { puedeCompartir: true })), {
      titulo: 'Reunión de equipo', fecha: '2026-10-27', desde: '10:00', hasta: '11:00', detalle: '', recordatorio: '2h',
      tipo: 'laboral', compartido: true, para_todos: true, personas: []
    });
    assert.deepEqual(plano(M.cuerpoDelEvento(base, { puedeCompartir: true })).personas, [3, 4, 5, 6]);
    // Sin poder compartir, solo el tipo (erroresDelEvento no lo deja llegar acá: el servidor lo rechazaría)
    assert.deepEqual(Object.keys(plano(M.cuerpoDelEvento(base, { puedeCompartir: false }))),
      ['titulo', 'fecha', 'desde', 'hasta', 'detalle', 'recordatorio', 'tipo']);
  });

  it('htmlDePersonasDelEvento: «Toda la administración» primero (un Laboral); cada persona con sus iniciales y aria-pressed; con ella, las demás deshabilitadas', () => {
    const valores = { ...plano(M.valoresDelEvento(itemDe(12), { fecha: HOY })) };
    const botones = botonesDe(M.htmlDePersonasDelEvento(PERSONAS_PARA_COMPARTIR, valores));
    assert.deepEqual(botones.map(({ atributos, texto }) => [atributos['data-persona'], atributos['aria-pressed'], texto]), [
      ['todos', 'false', 'Toda la administración'], ['4', 'true', 'DF Diego Fernández'], ['6', 'true', 'CB Carla Benítez'], ['7', 'false', 'JO Julián Ortiz'],
      ['3', 'true', 'MR Martín Ríos'], ['5', 'true', 'SP Sofía Paz']
    ]);
    assert.ok(botones.every(({ atributos }) => atributos.type === 'button'));
    assert.ok(!M.htmlDePersonasDelEvento(PERSONAS_PARA_COMPARTIR, valores).includes(' disabled'));
    const html = M.htmlDePersonasDelEvento(PERSONAS_PARA_COMPARTIR, { ...valores, para_todos: true, personas: [] });
    const conTodos = [...html.matchAll(/<button([^>]*)>/g)].map(([, atributos]) => atributos);
    assert.match(conTodos[0], /data-persona="todos" aria-pressed="true"$/);
    assert.ok(conTodos.slice(1).every((atributos) => / aria-pressed="false" disabled$/.test(atributos)));
    // Las iniciales, decorativas
    assert.ok(M.htmlDePersonasDelEvento(PERSONAS_PARA_COMPARTIR, valores).includes('<i aria-hidden="true">DF</i>'));
  });

  it('htmlDePersonasDelEvento: un nombre con HTML, escapado; mientras llega la lista o si no llegó, lo dice', () => {
    const html = M.htmlDePersonasDelEvento([{ id: 9, nombre: MALICIOSO, iniciales: '<b>' }], { personas: [9] });
    assert.ok(html.includes(ESCAPADO));
    assert.ok(!html.includes('<img') && !html.includes('<b>'));
    assert.ok(textoDe(M.htmlDePersonasDelEvento([], { personas: [] }, { sinLista: 'cargando' })).endsWith('Cargando las personas…'));
    assert.ok(textoDe(M.htmlDePersonasDelEvento([], { personas: [] }, { sinLista: 'fallo' }))
      .endsWith('No se pudo cargar la lista de personas. Probá de nuevo en unos minutos.'));
  });

  it('htmlDePersonasDelEvento: si no llegó con un motivo del servidor (el 403), dice ese, escapado', () => {
    assert.ok(textoDe(M.htmlDePersonasDelEvento([], { personas: [] }, { sinLista: 'fallo', motivo: MENSAJES_EVENTO.sinPermiso }))
      .endsWith('No tenés permiso para compartir eventos.'));
    const html = M.htmlDePersonasDelEvento([], { personas: [] }, { sinLista: 'fallo', motivo: MALICIOSO });
    assert.ok(html.includes(ESCAPADO));
    assert.ok(!html.includes('<img'));
    // Sin motivo, o mientras llega, como siempre
    for (const motivo of ['', '   ', null, 7]) {
      assert.ok(textoDe(M.htmlDePersonasDelEvento([], { personas: [] }, { sinLista: 'fallo', motivo }))
        .endsWith('No se pudo cargar la lista de personas. Probá de nuevo en unos minutos.'), String(motivo));
    }
    assert.ok(textoDe(M.htmlDePersonasDelEvento([], { personas: [] }, { sinLista: 'cargando', motivo: MENSAJES_EVENTO.sinPermiso }))
      .endsWith('Cargando las personas…'));
  });

  it('personasParaElegir: las de la lista y, al final, las del evento que ya no están en ella (no se sacan sin querer)', () => {
    const valores = { conocidas: [{ id: 3, nombre: 'Martín Ríos' }, { id: 8, nombre: 'Persona de Prueba' }] };
    assert.deepEqual(plano(M.personasParaElegir(PERSONAS_PARA_COMPARTIR, valores)).map((persona) => persona.id), [4, 6, 7, 3, 5, 8]);
    assert.deepEqual(plano(M.personasParaElegir(null, valores)), [{ id: 3, nombre: 'Martín Ríos' }, { id: 8, nombre: 'Persona de Prueba' }]);
    assert.ok(M.htmlDePersonasDelEvento(M.personasParaElegir(null, valores), { personas: [8] }).includes('<i aria-hidden="true">PP</i>'));
  });

  it('elegirPersona: «Todos» se prende y se apaga (y saca a las elegidas); una persona se suma o se saca', () => {
    const valores = { compartido: true, para_todos: false, personas: [3, 4] };
    assert.deepEqual(plano(M.elegirPersona(valores, '5')), { ...valores, personas: [3, 4, 5] });
    assert.deepEqual(plano(M.elegirPersona(valores, '3')), { ...valores, personas: [4] });
    const conTodos = plano(M.elegirPersona(valores, 'todos'));
    assert.deepEqual(conTodos, { ...valores, para_todos: true, personas: [] });
    // Con «Todos», las demás no se tocan; un valor que no es un id, tampoco
    assert.deepEqual(plano(M.elegirPersona(conTodos, '5')), conTodos);
    assert.deepEqual(plano(M.elegirPersona(valores, 'abc')), valores);
    assert.deepEqual(plano(M.elegirPersona(conTodos, 'todos')), { ...valores, personas: [] });
  });

  it('textoDeCuantasPersonas: «(1 persona)», «(4 personas)»; sin ninguna o con «Todos», nada', () => {
    assert.equal(M.textoDeCuantasPersonas({ personas: [3] }), '(1 persona)');
    assert.equal(M.textoDeCuantasPersonas({ personas: [3, 4, 5, 6] }), '(4 personas)');
    assert.equal(M.textoDeCuantasPersonas({ personas: [] }), '');
    assert.equal(M.textoDeCuantasPersonas({ personas: [3], para_todos: true }), '');
  });

  it('htmlDeOpcionesDeRecordatorio: en el orden de RECORDATORIOS, con sus textos y el elegido (uno que no es de la lista, 2 horas)', () => {
    const opciones = (html) => [...html.matchAll(/<option value="([^"]+)"( selected)?>([^<]+)<\/option>/g)]
      .map(([, valor, elegido, texto]) => [valor, Boolean(elegido), texto]);
    assert.deepEqual(opciones(M.htmlDeOpcionesDeRecordatorio('dia_anterior')), [
      ['1h', false, '1 hora antes'], ['2h', false, '2 horas antes'], ['dia_anterior', true, 'El día hábil anterior'],
      ['ninguno', false, 'Sin aviso']
    ]);
    assert.deepEqual(opciones(M.htmlDeOpcionesDeRecordatorio('otro')).filter(([, elegido]) => elegido).map(([valor]) => valor), ['2h']);
  });

  it('pedidoDelAviso: la ruta del aviso con la fecha, la hora y el recordatorio; sin una fecha o una hora que sirvan, o sin aviso, null', () => {
    const valores = { fecha: '2026-10-27', desde: '10:00', recordatorio: '2h' };
    assert.equal(M.pedidoDelAviso(valores), '/mi-espacio/eventos/aviso?fecha=2026-10-27&desde=10%3A00&recordatorio=2h');
    assert.equal(M.pedidoDelAviso({ ...valores, recordatorio: 'dia_anterior' }),
      '/mi-espacio/eventos/aviso?fecha=2026-10-27&desde=10%3A00&recordatorio=dia_anterior');
    for (const cambio of [{ desde: '' }, { desde: '9:00' }, { desde: '24:00' }, { fecha: '' }, { fecha: '2026-02-30' },
      { recordatorio: 'ninguno' }, { recordatorio: 'otro' }]) {
      assert.equal(M.pedidoDelAviso({ ...valores, ...cambio }), null, JSON.stringify(cambio));
    }
    assert.equal(M.pedidoDelAviso(null), null);
  });

  it('htmlDelEventoAjeno: cuándo es, el detalle, quién lo creó y quiénes están, y «Mi recordatorio» con el que eligió quien lo creó', () => {
    const item = itemDe(14);
    const partes = plano(M.htmlDelEventoAjeno({ ...item, detalle: 'Revisamos el informe.\nAntes de mandarlo.' }));
    assert.equal(textoDe(partes.cuando), 'Jueves 29/10/2026 a las 09:00');
    assert.equal(partes.detalle, 'Revisamos el informe.\nAntes de mandarlo.');
    // Un Laboral: la insignia «Laboral» (era «Compartido»: spec 2026-10-29-mi-espacio-evento-publico, 5.3)
    assert.equal(textoDe(partes.quien), 'Laboral Lo creó Martín. Están: vos.');
    assert.ok(partes.quien.includes('<span class="me-insignia violeta">Laboral</span>'));
    assert.deepEqual([...partes.opciones.matchAll(/<option value="(\w+)"( selected)?>([^<]+)<\/option>/g)].map(([, valor, elegido, texto]) =>
      [valor, Boolean(elegido), texto]), [['evento', true, '2 horas antes (el que eligió Martín)'], ['ninguno', false, 'Sin aviso']]);
    assert.equal(M.miRecordatorioDe(item), 'evento');
    assert.equal(M.miRecordatorioDe({ ...item, mi_recordatorio: 'ninguno' }), 'ninguno');
    // Con el recordatorio apagado, «Sin aviso» elegido; si quien lo creó eligió «Sin aviso», solo ese texto
    assert.ok(M.htmlDelEventoAjeno({ ...item, mi_recordatorio: 'ninguno' }).opciones.includes('<option value="ninguno" selected>Sin aviso</option>'));
    const sinRecordatorio = { ...item, recordatorio: 'ninguno', recordatorio_texto: 'Sin aviso', mi_recordatorio: 'ninguno' };
    assert.equal(M.htmlDelEventoAjeno(sinRecordatorio).opciones, '<option value="ninguno" selected>Sin aviso</option>');
    assert.equal(M.miRecordatorioDe(sinRecordatorio), 'ninguno');
    // Para toda la administración: «Es para toda la administración.» (el texto del servidor); con la hora de fin, «de … a …»
    const deOtroParaTodos = { ...item, fecha: '2026-11-02', desde: '10:00', hasta: '11:00',
      quien_largo: 'Lo creó Martín. Es para toda la administración.' };
    assert.equal(textoDe(M.htmlDelEventoAjeno(deOtroParaTodos).cuando), 'Lunes 02/11/2026 de 10:00 a 11:00');
    assert.equal(textoDe(M.htmlDelEventoAjeno(deOtroParaTodos).quien), 'Laboral Lo creó Martín. Es para toda la administración.');
  });

  // Review Focus 2
  it('htmlDelEventoAjeno: el detalle, el creador y quiénes están con HTML, escapados', () => {
    const item = { ...itemDe(14), detalle: MALICIOSO, creador: MALICIOSO, quien_largo: `Lo creó ${MALICIOSO}. Están: vos.` };
    const partes = plano(M.htmlDelEventoAjeno(item));
    for (const [parte, html] of Object.entries(partes)) assert.ok(!html.includes('<img'), parte);
    assert.equal(partes.detalle, ESCAPADO);
    assert.ok(partes.quien.includes(ESCAPADO));
    assert.ok(partes.opciones.includes(`(el que eligió ${ESCAPADO})`));
  });

  it('textoDeConfirmacionDeEvento: qué se borra y cuándo; si es compartido, a quiénes les llega la cancelación', () => {
    const conHoy = { hoy: HOY };
    assert.equal(M.textoDeConfirmacionDeEvento(itemDe(13), conHoy), '¿Borrar «Turno médico» del miércoles 28/10/2026?');
    assert.equal(M.textoDeConfirmacionDeEvento(itemDe(12), conHoy),
      '¿Borrar «Reunión de equipo» del martes 27/10/2026? A las 4 personas les llega un email que dice que se canceló.');
    assert.equal(M.textoDeConfirmacionDeEvento({ ...itemDe(12), personas: ['Sofía Paz'], personas_ids: [5] }, conHoy),
      '¿Borrar «Reunión de equipo» del martes 27/10/2026? A la persona le llega un email que dice que se canceló.');
    assert.equal(M.textoDeConfirmacionDeEvento(itemDe(15), conHoy),
      '¿Borrar «Reunión de equipo» del lunes 02/11/2026? A toda la administración le llega un email que dice que se canceló.');
    // Uno que ya pasó no manda la cancelación (el servidor no avisa de un evento empezado)
    assert.equal(M.textoDeConfirmacionDeEvento({ ...itemDe(12), fecha: '2026-10-23' }, conHoy), '¿Borrar «Reunión de equipo» del viernes 23/10/2026?');
    // Texto plano (va con textContent): sin escapar
    assert.equal(M.textoDeConfirmacionDeEvento({ ...itemDe(13), titulo: MALICIOSO }, conHoy), `¿Borrar «${MALICIOSO}» del miércoles 28/10/2026?`);
  });
});

// =====================================================================================================================================
// Los tres tipos de evento en el formulario (spec 2026-10-29-mi-espacio-evento-publico, 4 y 7; la maqueta aprobada): Personal
// (Privado), Personal (Público) y Laboral. Lo puro: los valores, los errores, el cuerpo, los botones del tipo, lo que ven los demás
// con «Otro», la vista previa y las ayudas. Las personas inventadas
// =====================================================================================================================================

// Los Personales (Públicos) de Laura (1), como los lee services/miEspacioEventosDatos.js: uno con «Todos» y «Trámite personal», y uno con
// dos personas y un texto que no es de la lista (lo escribió en «Otro»). Y uno de Carla (6), que llega recortado (6.3)
const PUBLICO_CON_TODOS = eventoDe(16, 'Firma en la escribanía', '2026-10-30', '10:00',
  { publico: 1, publico_todos: 1, texto_publico: 'Trámite personal', recordatorio: '1h' });
const PUBLICO_CON_DOS = eventoDe(17, 'Mudanza', '2026-11-05', '08:00',
  { publico: 1, texto_publico: 'Ayudo a mi hermana', vistas: [{ id: 6, nombre: 'Carla Benítez' }, { id: 9, nombre: 'Tomás Herrera' }] });
const PUBLICO_DE_CARLA = eventoDe(18, 'Retirar el auto del taller', '2026-10-30', '10:00',
  { creado_por: 6, creador: 'Carla Benítez', publico: 1, publico_todos: 1, texto_publico: 'Fuera de la oficina', detalle: 'Llevar la factura.' });
const itemDel = (evento) => comoLlega(itemDeEvento(evento, { usuarioId: 1, ahora: AHORA, feriados: SIN_FERIADOS }));
// Todos los usuarios activos menos quien pide (GET /api/mi-espacio/personas/publico), de cualquier rol, por nombre
const PERSONAS_DEL_PUBLICO = Object.freeze([
  { id: 11, nombre: 'Andrea Suárez' }, { id: 6, nombre: 'Carla Benítez' }, { id: 7, nombre: 'Julián Ortiz' },
  { id: 10, nombre: 'Lucía Molina' }, { id: 9, nombre: 'Tomás Herrera' }
].map((persona) => ({ ...persona, iniciales: inicialesDe(persona.nombre) })));
const NUEVO = () => plano(M.valoresDelEvento(null, { fecha: HOY }));

describe('el formulario del evento: los tres tipos (lo puro)', () => {
  it('los textos que son solo del navegador', () => {
    assert.equal(M.MENSAJE_OTRO_VACIO, 'Escribí qué ven los demás.');
    assert.equal(M.MENSAJE_LABORAL_SIN_PERMISO, 'Ya no podés compartir eventos laborales. Elegí otro tipo para guardarlo.');
    assert.equal(M.AYUDA_DE_LAS_PERSONAS_DEL_PUBLICO, 'No les llega ningún email: lo ven en su agenda y en el Resumen.');
    assert.equal(M.AYUDA_DEL_RECORDATORIO_PUBLICO, 'Te llega solo a vos.');
    assert.equal(M.AYUDA_DE_LAS_PERSONAS_DEL_LABORAL,
      'Les llega un email cuando los sumás, y otro si cambiás o borrás el evento. Solo vos lo podés cambiar.');
    assert.equal(M.AYUDA_DEL_RECORDATORIO_COMPARTIDO, 'Les llega a todas las personas del evento.');
  });

  it('valoresDelEvento: el tipo de cada uno, con lo que ven los demás, «Otro» y las personas del Público', () => {
    assert.equal(plano(M.valoresDelEvento(itemDe(12), { fecha: HOY })).tipo, 'laboral');
    assert.equal(plano(M.valoresDelEvento(itemDe(15), { fecha: HOY })).tipo, 'laboral');
    assert.equal(plano(M.valoresDelEvento(itemDe(11), { fecha: HOY })).tipo, 'privado');
    assert.deepEqual(plano(M.valoresDelEvento(itemDel(PUBLICO_CON_TODOS), { fecha: HOY })), {
      id: 16, titulo: 'Firma en la escribanía', fecha: '2026-10-30', desde: '10:00', hasta: '', detalle: '', tipo: 'publico',
      para_todos: true, personas: [], conocidas: [], texto_publico: 'Trámite personal', otro: false, recordatorio: '1h'
    });
    // Un texto que no es de la lista viene en «Otro», con sus personas (los ids y los nombres)
    assert.deepEqual(plano(M.valoresDelEvento(itemDel(PUBLICO_CON_DOS), { fecha: HOY })), {
      id: 17, titulo: 'Mudanza', fecha: '2026-11-05', desde: '08:00', hasta: '', detalle: '', tipo: 'publico', para_todos: false,
      personas: [6, 9], conocidas: [{ id: 6, nombre: 'Carla Benítez' }, { id: 9, nombre: 'Tomás Herrera' }],
      texto_publico: 'Ayudo a mi hermana', otro: true, recordatorio: '2h'
    });
    // Cada uno de la lista, sin «Otro»; uno con espacios o en minúsculas, en «Otro» (no es el de la lista)
    for (const texto of TEXTOS_PUBLICOS) {
      assert.equal(plano(M.valoresDelEvento({ ...itemDel(PUBLICO_CON_TODOS), texto_publico: texto }, { fecha: HOY })).otro, false, texto);
    }
    assert.equal(plano(M.valoresDelEvento({ ...itemDel(PUBLICO_CON_TODOS), texto_publico: 'trámite personal' }, { fecha: HOY })).otro, true);
    // Sin texto (no pasa: el servidor lo exige), ni elegido ni «Otro»; un texto en uno que no es Público no cuenta
    assert.deepEqual(['texto_publico', 'otro'].map((clave) => plano(M.valoresDelEvento({ ...itemDel(PUBLICO_CON_TODOS), texto_publico: null },
      { fecha: HOY }))[clave]), ['', false]);
    assert.deepEqual(['texto_publico', 'otro'].map((clave) => plano(M.valoresDelEvento({ ...itemDe(11), texto_publico: 'Viaje' },
      { fecha: HOY }))[clave]), ['', false]);
  });

  it('erroresDelEvento: «Otro» vacío dice «Escribí qué ven los demás.»; sin elegir, «Elegí qué ven los demás.»; de más de 60, el largo', () => {
    const publico = { ...entradaDe({}), tipo: 'publico', para_todos: true };
    assert.deepEqual(plano(M.erroresDelEvento({ ...publico, texto_publico: '', otro: true }, HOY)), { texto_publico: M.MENSAJE_OTRO_VACIO });
    assert.deepEqual(plano(M.erroresDelEvento({ ...publico, texto_publico: '   ', otro: true }, HOY)), { texto_publico: M.MENSAJE_OTRO_VACIO });
    assert.deepEqual(plano(M.erroresDelEvento({ ...publico, texto_publico: '', otro: false }, HOY)),
      { texto_publico: MENSAJES_EVENTO.textoPublico });
    assert.deepEqual(plano(M.erroresDelEvento({ ...publico, texto_publico: emojis(61), otro: true }, HOY)),
      { texto_publico: MENSAJES_EVENTO.textoPublicoLargo });
    assert.deepEqual(plano(M.erroresDelEvento({ ...publico, texto_publico: ` ${emojis(60)} `, otro: true }, HOY)), {});
    // «Otro» solo cuenta en un Público
    assert.deepEqual(plano(M.erroresDelEvento({ ...entradaDe({}), tipo: 'privado', texto_publico: '', otro: true }, HOY)), {});
  });

  it('erroresDelEvento: un Laboral sin poder compartir (quien ya no es de administración) da el error del tipo, sin las personas', () => {
    const laboral = { ...entradaDe({}), tipo: 'laboral', personas: [] };
    for (const opciones of [undefined, {}, { puedeCompartir: false }, { puedeCompartir: 'true' }, { puedeCompartir: 1 }]) {
      assert.deepEqual(plano(M.erroresDelEvento(laboral, HOY, opciones)), { tipo: M.MENSAJE_LABORAL_SIN_PERMISO }, JSON.stringify(opciones));
    }
    // Con permiso, el Laboral sin personas pide las personas
    assert.deepEqual(plano(M.erroresDelEvento(laboral, HOY, { puedeCompartir: true })), { personas: MENSAJES_EVENTO.personas });
    // Un cuerpo de antes (compartido, sin tipo) también es Laboral
    assert.deepEqual(plano(M.erroresDelEvento({ ...entradaDe({}), compartido: true, para_todos: true }, HOY)),
      { tipo: M.MENSAJE_LABORAL_SIN_PERMISO });
    // El Privado y el Público no piden permiso
    assert.deepEqual(plano(M.erroresDelEvento({ ...entradaDe({}), tipo: 'privado' }, HOY)), {});
    assert.deepEqual(plano(M.erroresDelEvento({ ...entradaDe({}), tipo: 'publico', texto_publico: 'Turno médico', personas: [9] }, HOY)), {});
  });

  it('cuerpoDelEvento: un Público con «Todos», con personas y con «Otro»; nunca trae compartido', () => {
    const publico = { ...NUEVO(), titulo: ' Control ', desde: '10:00', tipo: 'publico', para_todos: true, personas: [9], texto_publico: ' Turno médico ' };
    for (const opciones of [{}, { puedeCompartir: true }]) {
      assert.deepEqual(plano(M.cuerpoDelEvento(publico, opciones)), {
        titulo: 'Control', fecha: HOY, desde: '10:00', hasta: null, detalle: '', recordatorio: '2h', tipo: 'publico', para_todos: true,
        personas: [], texto_publico: 'Turno médico'
      }, JSON.stringify(opciones));
    }
    const conPersonas = plano(M.cuerpoDelEvento({ ...publico, para_todos: false, personas: [9, 6], otro: true, texto_publico: 'Ayudo a mi hermana' }));
    assert.deepEqual([conPersonas.para_todos, conPersonas.personas, conPersonas.texto_publico], [false, [9, 6], 'Ayudo a mi hermana']);
    assert.ok(!Object.hasOwn(conPersonas, 'compartido'));
    assert.ok(!Object.hasOwn(plano(M.cuerpoDelEvento({ ...publico, compartido: true }, { puedeCompartir: true })), 'compartido'));
  });

  it('valoresConElTipo: cambia el tipo y empieza de nuevo con quién (el «Todos» de cada tipo es otro); al volver al del evento, el suyo', () => {
    const laboral = plano(M.valoresDelEvento(itemDe(12), { fecha: HOY }));
    const aPublico = plano(M.valoresConElTipo(laboral, 'publico', laboral));
    assert.deepEqual([aPublico.tipo, aPublico.para_todos, aPublico.personas, aPublico.conocidas], ['publico', false, [], []]);
    assert.deepEqual(plano(M.valoresConElTipo(aPublico, 'laboral', laboral)),
      { ...aPublico, tipo: 'laboral', personas: [3, 4, 5, 6], conocidas: laboral.conocidas });
    // Las personas que ya estaban en el evento son de su tipo: en otro, no se ofrecen (el servidor las rechazaría)
    assert.equal(laboral.conocidas.length, 4);
    assert.deepEqual(plano(M.personasParaElegir(null, aPublico)), []);
    const conTodos = plano(M.valoresConElTipo({ ...laboral, para_todos: true, personas: [] }, 'privado', laboral));
    assert.deepEqual([conTodos.tipo, conTodos.para_todos, conTodos.personas], ['privado', false, []]);
    // El mismo tipo no cambia nada; uno que no es un tipo, tampoco
    const elegidas = { ...laboral, personas: [7] };
    assert.deepEqual(plano(M.valoresConElTipo(elegidas, 'laboral', laboral)), elegidas);
    assert.deepEqual(plano(M.valoresConElTipo(elegidas, 'otro', laboral)), elegidas);
    // Lo que ven los demás se conserva (al volver al Público, sigue elegido)
    const publico = plano(M.valoresDelEvento(itemDel(PUBLICO_CON_DOS), { fecha: HOY }));
    const ida = plano(M.valoresConElTipo(publico, 'privado', publico));
    assert.deepEqual(plano(M.valoresConElTipo(ida, 'publico', publico)), publico);
    assert.deepEqual([ida.texto_publico, ida.otro, ida.conocidas], ['Ayudo a mi hermana', true, []]);
  });

  it('htmlDeTiposDeEvento: tres con administración, dos sin ella; un Laboral sin poder compartir, los tres con el Laboral deshabilitado', () => {
    const tipos = (html) => [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map(([, atributos, adentro]) => [
      atributosDe(atributos)['data-tipo'], atributosDe(atributos)['aria-pressed'], /\sdisabled(?:\s|$)/.test(atributos), textoDe(adentro)]);
    assert.deepEqual(tipos(M.htmlDeTiposDeEvento(NUEVO(), { puedeCompartir: true })), [
      ['privado', 'true', false, 'Personal (Privado) Nadie más lo ve'],
      ['publico', 'false', false, 'Personal (Público) Lo ven quienes elijas, con un texto corto'],
      ['laboral', 'false', false, 'Laboral Con la administración que elijas']
    ]);
    assert.deepEqual(tipos(M.htmlDeTiposDeEvento({ ...NUEVO(), tipo: 'publico' }, {})).map(([tipo, pulsado]) => [tipo, pulsado]),
      [['privado', 'false'], ['publico', 'true']]);
    const laboral = M.htmlDeTiposDeEvento({ ...NUEVO(), tipo: 'laboral' }, { puedeCompartir: false });
    assert.deepEqual(tipos(laboral).map(([tipo, pulsado, deshabilitado]) => [tipo, pulsado, deshabilitado]),
      [['privado', 'false', false], ['publico', 'false', false], ['laboral', 'true', true]]);
    assert.match(laboral, /<button type="button" class="me-opcion" data-tipo="laboral" aria-pressed="true" disabled><span><b>Laboral<\/b><small>Con la administración que elijas<\/small><\/span><\/button>/);
    assert.deepEqual(plano(M.tiposQueSeVen(NUEVO(), {})), ['privado', 'publico']);
    assert.deepEqual(plano(M.tiposQueSeVen({ tipo: 'laboral' }, {})), ['privado', 'publico', 'laboral']);
    assert.deepEqual(plano(M.tiposQueSeVen(NUEVO(), { puedeCompartir: true })), ['privado', 'publico', 'laboral']);
  });

  it('htmlDeTextosPublicos: una pastilla por cada texto de la lista y «Otro», con aria-pressed (una sola elegida)', () => {
    const pastillas = (valores) => botonesDe(M.htmlDeTextosPublicos(valores))
      .map(({ atributos, texto }) => [atributos['data-texto'], atributos['aria-pressed'], atributos.class, texto]);
    assert.deepEqual(pastillas({ ...NUEVO(), tipo: 'publico' }), [
      ['Trámite personal', 'false', 'sg-chip', 'Trámite personal'], ['Turno médico', 'false', 'sg-chip', 'Turno médico'],
      ['Asunto familiar', 'false', 'sg-chip', 'Asunto familiar'], ['Fuera de la oficina', 'false', 'sg-chip', 'Fuera de la oficina'],
      ['Capacitación o curso', 'false', 'sg-chip', 'Capacitación o curso'], ['otro', 'false', 'sg-chip', 'Otro']
    ]);
    assert.deepEqual(pastillas({ tipo: 'publico', texto_publico: 'Turno médico', otro: false }).filter(([, pulsada]) => pulsada === 'true')
      .map(([texto]) => texto), ['Turno médico']);
    // Con «Otro», solo «Otro», aunque lo escrito sea igual a uno de la lista
    assert.deepEqual(pastillas({ tipo: 'publico', texto_publico: 'Turno médico', otro: true }).filter(([, pulsada]) => pulsada === 'true')
      .map(([texto]) => texto), ['otro']);
  });

  it('elegirTextoPublico: uno de la lista o «Otro», con lo escrito en su campo', () => {
    const valores = { ...NUEVO(), tipo: 'publico' };
    assert.deepEqual(plano(M.elegirTextoPublico(valores, 'Turno médico', 'algo')), { ...valores, texto_publico: 'Turno médico', otro: false });
    assert.deepEqual(plano(M.elegirTextoPublico(valores, 'otro', 'Ayudo a mi hermana')),
      { ...valores, texto_publico: 'Ayudo a mi hermana', otro: true });
    assert.deepEqual(plano(M.elegirTextoPublico(valores, 'otro')), { ...valores, texto_publico: '', otro: true });
    // Un valor que no es de la lista no cambia nada
    assert.deepEqual(plano(M.elegirTextoPublico(valores, 'Viaje', 'algo')), valores);
  });

  it('cuentaDelTextoPublico: «0 de 60 caracteres», sin los espacios de los extremos y contados con Array.from; pasado de 60, marcado', () => {
    assert.deepEqual(plano(M.cuentaDelTextoPublico('')), { texto: '0 de 60 caracteres', pasado: false });
    assert.deepEqual(plano(M.cuentaDelTextoPublico('  Viaje  ')), { texto: '5 de 60 caracteres', pasado: false });
    assert.deepEqual(plano(M.cuentaDelTextoPublico(emojis(60))), { texto: '60 de 60 caracteres', pasado: false });
    assert.deepEqual(plano(M.cuentaDelTextoPublico(emojis(61))), { texto: '61 de 60 caracteres', pasado: true });
    assert.deepEqual(plano(M.cuentaDelTextoPublico(null)), { texto: '0 de 60 caracteres', pasado: false });
  });

  it('htmlDeLaVistaPrevia: el día corto, el ojo, la hora y «nombre: texto» escapados, en la pastilla rosada de 3 renglones', () => {
    const valores = { ...NUEVO(), fecha: '2026-11-05', desde: '10:00', tipo: 'publico', texto_publico: 'Turno médico' };
    const vista = plano(M.htmlDeLaVistaPrevia(valores, { nombre: 'Tomás' }));
    assert.equal(vista.dia, 'Jue 5');
    assert.match(vista.evento, /^<span class="me-ev publico-otro" data-lineas="3"><svg class="me-icono" aria-hidden="true" focusable="false"[^>]*>[\s\S]*?<\/svg><b>10:00<\/b> Tomás: Turno médico<\/span>$/);
    assert.equal(textoDe(vista.evento), '10:00 Tomás: Turno médico');
    assert.ok(vista.evento.includes(M.ICONO_DEL_OJO));
    // Lo escrito y el nombre, escapados
    const malo = plano(M.htmlDeLaVistaPrevia({ ...valores, texto_publico: '<b>"x"</b>' }, { nombre: MALICIOSO }));
    assert.ok(malo.evento.endsWith(`${ESCAPADO}: &lt;b&gt;&quot;x&quot;&lt;/b&gt;</span>`), malo.evento);
    assert.ok(!malo.evento.includes('<img'));
    // Sin texto, «Tomás: …»; sin hora, sin la hora; sin fecha, «Sin fecha»; sin nombre, «Tu nombre»
    assert.equal(textoDe(plano(M.htmlDeLaVistaPrevia({ ...valores, texto_publico: '  ' }, { nombre: 'Tomás' })).evento), '10:00 Tomás: …');
    assert.equal(textoDe(plano(M.htmlDeLaVistaPrevia({ ...valores, desde: '' }, { nombre: 'Tomás' })).evento), 'Tomás: Turno médico');
    assert.equal(plano(M.htmlDeLaVistaPrevia({ ...valores, fecha: '' }, { nombre: 'Tomás' })).dia, 'Sin fecha');
    for (const nombre of [null, undefined, '', '   ', 7]) {
      assert.equal(textoDe(plano(M.htmlDeLaVistaPrevia(valores, { nombre })).evento), '10:00 Tu nombre: Turno médico', String(nombre));
    }
    assert.equal(plano(M.htmlDeLaVistaPrevia({ ...valores, fecha: '2026-11-01' }, { nombre: 'Tomás' })).dia, 'Dom 1');
  });

  it('htmlDePersonasDelEvento: «Toda la administración» en un Laboral y «Todos» en un Público', () => {
    const todos = (valores) => botonesDe(M.htmlDePersonasDelEvento(PERSONAS_DEL_PUBLICO, valores))[0].texto;
    assert.equal(todos({ tipo: 'laboral', personas: [] }), 'Toda la administración');
    assert.equal(todos({ compartido: true, personas: [] }), 'Toda la administración');
    assert.equal(todos({ tipo: 'publico', personas: [] }), 'Todos');
    const conTodos = M.htmlDePersonasDelEvento(PERSONAS_DEL_PUBLICO, { tipo: 'publico', para_todos: true, personas: [] });
    assert.match(conTodos, /<button type="button" class="me-persona" data-persona="todos" aria-pressed="true"><i aria-hidden="true"><svg[\s\S]*?<\/svg><\/i>Todos<\/button>/);
  });

  it('ayudasDelEvento: la del tipo, la de las personas y la del recordatorio de cada tipo', () => {
    const sinNada = { tipo: '', personas: '', recordatorio: '' };
    assert.deepEqual(plano(M.ayudasDelEvento({ tipo: 'privado' }, { puedeCompartir: true })), sinNada);
    assert.deepEqual(plano(M.ayudasDelEvento({ tipo: 'privado' }, {})), sinNada);
    for (const opciones of [{}, { puedeCompartir: true }]) {
      assert.deepEqual(plano(M.ayudasDelEvento({ tipo: 'publico' }, opciones)), {
        tipo: '', personas: M.AYUDA_DE_LAS_PERSONAS_DEL_PUBLICO, recordatorio: M.AYUDA_DEL_RECORDATORIO_PUBLICO
      });
    }
    assert.deepEqual(plano(M.ayudasDelEvento({ tipo: 'laboral' }, { puedeCompartir: true })), {
      tipo: '', personas: M.AYUDA_DE_LAS_PERSONAS_DEL_LABORAL, recordatorio: M.AYUDA_DEL_RECORDATORIO_COMPARTIDO
    });
    assert.deepEqual(plano(M.ayudasDelEvento({ tipo: 'laboral' }, {})), { ...sinNada, tipo: M.MENSAJE_LABORAL_SIN_PERMISO });
  });

  // Ruling 5: un Público de otra persona llega recortado (sin aviso, quién está, personas ni recordatorio); lo que la agenda ya
  // dibujaba no se rompe con él (cómo se ve, en rosado y con el ojo, en «cómo se ve el evento Personal (Público)», abajo)
  it('un Público de otra persona, recortado, no rompe nada de lo que dibuja la agenda', () => {
    const ajeno = itemDel(PUBLICO_DE_CARLA);
    assert.deepEqual(Object.keys(ajeno).sort(),
      ['compartido', 'creador', 'desde', 'es_mio', 'fecha', 'hasta', 'id', 'publico', 'texto_publico', 'titulo'].sort());
    assert.ok(!JSON.stringify(ajeno).includes('taller') && !JSON.stringify(ajeno).includes('factura'));
    const datos = { ...respuestaDeEventos({ desde: '2026-09-28', hasta: '2026-11-01' }, { eventos: [] }), eventos: [ajeno] };
    const mes = M.htmlDelMes('2026-10', datos, HOY, { elegido: '2026-10-30', foco: '2026-10-30' });
    assert.ok(textoDe(mes).includes('10:00 Carla: Fuera de la oficina'));
    assert.ok(textoDe(M.htmlDelDiaElegido('2026-10-30', datos, HOY)).includes('Carla: Fuera de la oficina'));
    const proximos = M.htmlDeProximos(M.gruposDeProximos({ ...datos, desde: HOY, hasta: '2026-11-25' }, HOY));
    assert.ok(textoDe(proximos).includes('Carla: Fuera de la oficina'));
    const partes = plano(M.htmlDelEventoAjeno(ajeno));
    assert.equal(textoDe(partes.cuando), 'Viernes 30/10/2026 a las 10:00');
    assert.equal(partes.detalle, '');
    assert.equal(M.miRecordatorioDe(ajeno), 'ninguno');
  });
});

// Cómo se ve el evento Personal (Público) en la agenda (spec 2026-10-29-mi-espacio-evento-publico, 5.1 a 5.4 y 7; la maqueta aprobada):
// uno tuyo, en tinta y con el ojo («lo ven otros»), con a quiénes se lo mostrás en «Próximos» y en el día elegido; uno de otra persona,
// en rosado y con el ojo, «Carla: Fuera de la oficina» (en el teléfono, un anillo), sin nada de quién está; y su detalle, sin «Mi recordatorio».
// Con los Públicos de Laura (1) y el de Carla (6), como los manda el servidor
describe('cómo se ve el evento Personal (Público) en la agenda (lo puro)', () => {
  const OJO = () => M.ICONOS_DEL_MES.ojo;
  // La grilla de octubre o los próximos, con estos eventos y sin compañeros (así ninguna barra le saca renglones a los eventos)
  const delMesCon = (eventos) => respuestaDeEventos({ desde: '2026-09-28', hasta: '2026-11-01' }, { eventos, ausencias: [] });
  const proximosCon = (eventos) => respuestaDeEventos({ desde: HOY, hasta: '2026-11-25' }, { eventos, licencias: [], ausencias: [], feriados: [] });
  const PUBLICOS = () => [PUBLICO_CON_TODOS, PUBLICO_CON_DOS, PUBLICO_DE_CARLA];
  // Un texto público con HTML: el de un Público de Carla (en su título, «Carla: …») y el de uno de Laura (en «Lo ven todos como …»)
  const CON_HTML_PUBLICO = '<b>"x"</b>';
  const CON_HTML_PUBLICO_ESCAPADO = '&lt;b&gt;&quot;x&quot;&lt;/b&gt;';
  const conHtml = () => [{ ...PUBLICO_CON_TODOS, texto_publico: CON_HTML_PUBLICO }, { ...PUBLICO_DE_CARLA, texto_publico: CON_HTML_PUBLICO }];

  it('claseDelEvento: un Laboral, tuyo o de otra persona, compartido; un Público de otra persona, publico-otro; lo tuyo que no es Laboral, propio', () => {
    assert.equal(M.claseDelEvento(itemDe(15)), 'compartido', 'un Laboral tuyo');
    assert.equal(M.claseDelEvento(itemDe(14)), 'compartido', 'un Laboral de Martín');
    assert.equal(M.claseDelEvento(itemDel(PUBLICO_DE_CARLA)), 'publico-otro', 'un Público de Carla');
    assert.equal(M.claseDelEvento(itemDel(PUBLICO_CON_TODOS)), 'propio', 'un Público tuyo');
    assert.equal(M.claseDelEvento(itemDe(11)), 'propio', 'un Privado');
  });

  it('iconoDe e iconoOPunto: el ícono que se pide (`icono`) si es uno del mes; si no, el de la clase', () => {
    assert.equal(M.iconoDe('propio', 'ojo'), OJO());
    assert.equal(M.iconoDe('publico-otro'), OJO());
    assert.equal(M.iconoDe('propio'), '');
    assert.equal(M.iconoDe('compartido', 'otro'), M.ICONOS_DEL_MES.compartido);
    assert.equal(M.iconoDe('compartido', undefined), M.ICONOS_DEL_MES.compartido);
    assert.equal(M.iconoOPunto('propio', 'ojo'), OJO());
    assert.equal(M.iconoOPunto('propio'), '<i></i>');
  });

  it('cosasPorDia: un Público tuyo, propio con el ojo (`icono`); uno de otra persona, publico-otro con «Carla: Fuera de la oficina»', () => {
    assert.deepEqual(cosasDe(delMesCon(PUBLICOS()))['2026-10-30'], [
      { clase: 'publico-otro', texto: '10:00 Carla: Fuera de la oficina', evento_id: 18 },
      { clase: 'propio', icono: 'ojo', texto: '10:00 Firma en la escribanía', evento_id: 16 }
    ]);
    // Los demás, sin `icono` (el de su clase)
    for (const cosas of Object.values(cosasDe(DEL_MES))) for (const cosa of cosas) assert.ok(!Object.hasOwn(cosa, 'icono'), cosa.texto);
  });

  it('la grilla: uno de otra persona, una pastilla rosada con el ojo y «Carla: Fuera de la oficina» (su nombre accesible) y, en el teléfono, un anillo', () => {
    const mes = M.htmlDelMes('2026-10', delMesCon(PUBLICOS()), HOY);
    const celda = celdaConFecha(mes, '2026-10-30');
    assert.ok(celda.html.includes(`<button type="button" class="me-ev publico-otro" data-lineas="2" data-evento="18" title="10:00 Carla: Fuera de la oficina">`
      + `${OJO()}<b>10:00</b> Carla: Fuera de la oficina</button>`));
    // Uno tuyo, en tinta (propio) con el ojo y su título
    assert.ok(celda.html.includes(`<button type="button" class="me-ev propio" data-lineas="2" data-evento="16" `
      + `title="10:00 Firma en la escribanía">${OJO()}<b>10:00</b> Firma en la escribanía</button>`));
    // Los puntos del teléfono: el de otra persona es un anillo (su clase), no se distingue solo por el color
    assert.ok(celda.html.includes('<span class="me-puntos" aria-hidden="true"><i class="publico-otro"></i><i class="propio"></i></span>'));
    assert.equal(textoDe(celda.html.match(/<button type="button" class="me-ev publico-otro"[\s\S]*?<\/button>/)[0]).trim(), '10:00 Carla: Fuera de la oficina');
    // El título del Público de Carla nunca llega: no hay nada que dibujar
    assert.ok(!mes.includes('taller') && !mes.includes('factura'));
  });

  it('«Próximos»: uno tuyo, con la línea del ojo y a quiénes se lo mostrás (sin insignia); uno de otra persona, sin insignia ni aviso', () => {
    const grupos = plano(M.gruposDeProximos(proximosCon(PUBLICOS()), HOY));
    assert.deepEqual(grupos, [
      { titulo: 'Esta semana', items: [
        { hora: 'Vie 30', titulo: '10:00 Carla: Fuera de la oficina', detalle: '', clase: 'publico-otro', quien: '', evento_id: 18 },
        { hora: 'Vie 30', titulo: '10:00 Firma en la escribanía', detalle: 'Aviso 1 h antes', clase: 'propio', icono: 'ojo',
          quien: 'Lo ven todos como «Trámite personal»', evento_id: 16 }
      ] },
      { titulo: 'Más adelante', items: [
        { hora: 'Jue 05/11', titulo: '08:00 Mudanza', detalle: 'Aviso 2 h antes', clase: 'propio', icono: 'ojo',
          quien: 'Lo ven Carla y Tomás como «Ayudo a mi hermana»', evento_id: 17 }
      ] }
    ]);
    const html = M.htmlDeProximos(grupos);
    assert.ok(html.includes('<li class="me-prox publico-otro"><span class="me-prox-hora">Vie 30</span>'
      + `<button type="button" class="me-prox-titulo" data-evento="18"><span class="me-prox-icono publico-otro" aria-hidden="true">${OJO()}</span>`
      + '10:00 Carla: Fuera de la oficina</button></li>'));
    assert.ok(html.includes('<li class="me-prox propio"><span class="me-prox-hora">Vie 30</span>'
      + `<button type="button" class="me-prox-titulo" data-evento="16"><span class="me-prox-icono propio" aria-hidden="true">${OJO()}</span>`
      + '10:00 Firma en la escribanía</button>'
      + `<span class="me-prox-detalle"><span class="me-lo-ven">${OJO()}Lo ven todos como «Trámite personal»</span>Aviso 1 h antes</span></li>`));
    assert.ok(html.includes(`<span class="me-lo-ven">${OJO()}Lo ven Carla y Tomás como «Ayudo a mi hermana»</span>`));
    assert.ok(!html.includes('me-insignia'));
    // Un quién que llegara en uno de otra persona (el servidor no lo manda) no se dibuja
    const conQuien = M.htmlDeProximos([{ titulo: 'Esta semana', items: [{ ...grupos[0].items[0], quien: 'Con Carla' }] }]);
    assert.ok(!conQuien.includes('Con Carla'));
  });

  it('el día elegido: uno tuyo con el ojo y debajo a quiénes se lo mostrás; uno de otra persona, en rosado con el ojo y nada debajo', () => {
    const html = M.htmlDelDiaElegido('2026-10-30', delMesCon(PUBLICOS()), HOY);
    assert.ok(html.includes('<li class="me-fila-del-dia publico-otro"><button type="button" class="me-elegido-cosa" data-evento="18">'
      + `<span class="me-elegido-icono" aria-hidden="true">${OJO()}</span><span class="me-elegido-hora">10:00</span> `
      + '<span class="me-elegido-texto">Carla: Fuera de la oficina</span></button></li>'));
    assert.ok(html.includes('<li class="me-fila-del-dia propio"><button type="button" class="me-elegido-cosa" data-evento="16">'
      + `<span class="me-elegido-icono" aria-hidden="true">${OJO()}</span><span class="me-elegido-hora">10:00</span> `
      + '<span class="me-elegido-texto">Firma en la escribanía <small>Lo ven todos como «Trámite personal»</small></span></button></li>'));
  });

  it('un texto público con HTML sale escapado en la grilla, «Próximos», el día elegido y el detalle', () => {
    const mes = M.htmlDelMes('2026-10', delMesCon(conHtml()), HOY);
    const proximos = M.htmlDeProximos(M.gruposDeProximos(proximosCon(conHtml()), HOY));
    const elegido = M.htmlDelDiaElegido('2026-10-30', delMesCon(conHtml()), HOY);
    const ajeno = itemDel({ ...PUBLICO_DE_CARLA, texto_publico: CON_HTML_PUBLICO });
    const detalle = Object.values(plano(M.htmlDelEventoAjeno({ ...ajeno, creador: CON_HTML_PUBLICO }))).join('');
    for (const [donde, html] of [['la grilla', mes], ['«Próximos»', proximos], ['el día elegido', elegido], ['el detalle', detalle]]) {
      assert.ok(!html.includes(CON_HTML_PUBLICO), donde);
      assert.ok(html.includes(CON_HTML_PUBLICO_ESCAPADO), donde);
    }
    // El de Carla, en su título («Carla: …», también en el title) y el tuyo, en «Lo ven todos como …»
    assert.ok(mes.includes(`title="10:00 Carla: ${CON_HTML_PUBLICO_ESCAPADO}"`));
    assert.ok(proximos.includes(`Lo ven todos como «${CON_HTML_PUBLICO_ESCAPADO}»`));
    assert.ok(elegido.includes(`<small>Lo ven todos como «${CON_HTML_PUBLICO_ESCAPADO}»</small>`));
    assert.ok(detalle.includes(`Es un evento personal de ${CON_HTML_PUBLICO_ESCAPADO}: se ve solo lo que eligió mostrar.`));
  });

  it('htmlDelEventoAjeno: un Público, la insignia rosada con el ojo y por qué se ve poco, sin «Mi recordatorio»; un Laboral, «Laboral»', () => {
    assert.deepEqual(plano(M.htmlDelEventoAjeno(itemDel(PUBLICO_DE_CARLA))), {
      cuando: 'Viernes 30/10/2026 a las 10:00',
      detalle: '',
      quien: `<span class="me-insignia rosado">${OJO()}Personal (Público)</span>`
        + '<span>Es un evento personal de Carla: se ve solo lo que eligió mostrar.</span>',
      opciones: ''
    });
    // Sin el nombre de quien lo cargó (null, sin un nombre en la base)
    assert.equal(textoDe(M.htmlDelEventoAjeno({ ...itemDel(PUBLICO_DE_CARLA), creador: null }).quien).trim().replace(/\s+/g, ' '),
      'Personal (Público) Es un evento personal de otra persona: se ve solo lo que eligió mostrar.');
    // Un detalle que llegara en un Público (el servidor no lo manda) no se dibuja
    assert.equal(M.htmlDelEventoAjeno({ ...itemDel(PUBLICO_DE_CARLA), detalle: 'Llevar la factura.' }).detalle, '');
    // Un Laboral, como siempre, con la insignia «Laboral»
    const laboral = plano(M.htmlDelEventoAjeno(itemDe(14)));
    assert.ok(laboral.quien.startsWith('<span class="me-insignia violeta">Laboral</span>'));
    assert.notEqual(laboral.opciones, '');
  });

  it('«Hoy y mañana»: uno de otra persona, «10:00 Carla: Fuera de la oficina» sin nada debajo; uno tuyo, con a quiénes se lo mostrás', () => {
    const items = [PUBLICO_CON_TODOS, PUBLICO_DE_CARLA].map((evento) => itemDel({ ...evento, fecha: HOY }));
    const eventos = comoLlega(eventosDeHoyYManana(items, HOY, `${HOY} 06:00:00`));
    const html = M.htmlDeHoyYManana({ ausentes_hoy: [], ausentes_manana: [], proximo_feriado: null, eventos }, true);
    assert.equal(columnasDe(html)[0].html, '<ul><li><time>10:00</time> Firma en la escribanía<small>lo ven todos como «Trámite personal»</small></li>'
      + `<li><time>10:00</time> Carla: Fuera de la oficina</li></ul>${VER_LA_AGENDA}`);
  });
});

// El servidor falso con la agenda y el formulario del evento: las personas, el aviso (el de avisoDe, con hoy a las 09:00) y lo que se
// guarda; `extra`, primero (una respuesta, una promesa que la da o undefined), y `eventos`, los cambios de conEventos
const RUTA_DE_PERSONAS = '/api/mi-espacio/personas';
// Las de un Personal (Público): todos los usuarios activos menos quien pide, de cualquier rol
const RUTA_DE_PERSONAS_DEL_PUBLICO = '/api/mi-espacio/personas/publico';
const RUTA_DEL_AVISO = '/api/mi-espacio/eventos/aviso?';
const rutaDelAviso = (fecha, desde, recordatorio = '2h') =>
  `/api/mi-espacio/eventos/aviso?fecha=${fecha}&desde=${encodeURIComponent(desde)}&recordatorio=${recordatorio}`;
const textoDelAvisoDe = (fecha, desde, recordatorio = '2h') =>
  avisoDe({ fecha, desde, recordatorio }, { ahora: AHORA, feriados: SIN_FERIADOS }).texto;
const conElFormulario = ({ extra = () => undefined, eventos = {} } = {}) => async (metodo, ruta, cuerpo) => {
  const propia = await extra(metodo, ruta, cuerpo);
  if (propia !== undefined) return propia;
  if (ruta === RUTA_DE_PERSONAS) return ok(PERSONAS_PARA_COMPARTIR);
  if (ruta === RUTA_DE_PERSONAS_DEL_PUBLICO) return ok(PERSONAS_DEL_PUBLICO);
  if (ruta.startsWith(RUTA_DEL_AVISO)) {
    const parametros = new URL(ruta, 'http://rpad.test').searchParams;
    const { momento, texto } = avisoDe({ fecha: parametros.get('fecha'), desde: parametros.get('desde'),
      recordatorio: parametros.get('recordatorio') }, { ahora: AHORA, feriados: SIN_FERIADOS });
    return ok({ momento, texto });
  }
  if (metodo === 'POST' && ruta === '/api/mi-espacio/eventos') return respuesta(201, { success: true, data: { id: 99 }, message: 'Evento guardado.' });
  if (metodo === 'PUT' && /^\/api\/mi-espacio\/eventos\/\d+$/.test(ruta)) return ok({ id: Number(ruta.split('/').at(-1)) }, 'Evento cambiado.');
  if (metodo === 'DELETE' && /^\/api\/mi-espacio\/eventos\/\d+$/.test(ruta)) return ok(undefined, 'Evento borrado.');
  return conEventos(eventos)(metodo, ruta, cuerpo);
};
// Los GET de la agenda (el mes y los próximos), sin el aviso ni lo que se guarda
const rangosPedidos = (pagina) => pagina.estado.pedidos.filter((p) => p.metodo === 'GET' && p.ruta.startsWith('/api/mi-espacio/eventos?'))
  .map((p) => p.ruta);
const avisosPedidos = (pagina) => pagina.rutas().filter((ruta) => ruta.startsWith(RUTA_DEL_AVISO));
const abiertos = (pagina) => pagina.documento.querySelectorAll('.modal-overlay').filter((modal) => modal.classList.contains('active'))
  .map((modal) => modal.id);
// Abre un evento de la grilla o de los próximos (el botón recibe el foco antes, como con un clic) y espera el foco del modal
const abrirElEvento = async (pagina, id, donde = 'ag-mes') => {
  const boton = pagina.el(donde).querySelector(`[data-evento="${id}"]`);
  boton.focus();
  await pagina.tocar(boton);
  await pagina.correr();
  return boton;
};
const personaDel = (pagina, valor) => pagina.el('ev-personas').querySelector(`[data-persona="${valor}"]`);
// El botón de un tipo de evento («Tipo de evento»: mi-espacio.js los vuelve a dibujar al elegir uno) y una pastilla de lo que ven los
// demás
const tipoDel = (pagina, tipo) => pagina.el('ev-tipos').querySelector(`[data-tipo="${tipo}"]`);
const textoDel = (pagina, texto) => pagina.el('ev-textos').querySelectorAll('[data-texto]').find((boton) => boton.getAttribute('data-texto') === texto);
const tiposALaVista = (pagina) => pagina.el('ev-tipos').querySelectorAll('[data-tipo]').map((boton) => [boton.getAttribute('data-tipo'),
  boton.getAttribute('aria-pressed'), boton.disabled]);

describe('el formulario del evento en la página (DOM falso)', () => {
  it('«Nuevo evento»: hoy y «2 horas antes», el foco en «Qué» y, al cerrar, de vuelta al botón', async () => {
    const pagina = montarPagina({ responder: conElFormulario() });
    await pagina.iniciar();
    const boton = pagina.el('btn-nuevo-evento');
    boton.focus();
    await pagina.tocar(boton);
    assert.deepEqual(abiertos(pagina), ['modal-evento']);
    assert.equal(pagina.el('modal-evento-titulo').textContent, 'Nuevo evento');
    assert.deepEqual(['ev-titulo', 'ev-fecha', 'ev-desde', 'ev-hasta', 'ev-detalle'].map((id) => pagina.el(id).value), ['', HOY, '', '', '']);
    assert.equal(pagina.el('ev-recordatorio').value, '2h');
    assert.equal(pagina.el('ev-recordatorio').innerHTML, M.htmlDeOpcionesDeRecordatorio('2h'));
    assert.equal(pagina.el('ev-borrar').hidden, true);
    assert.equal(pagina.el('ev-aviso').hidden, true);
    await pagina.correr();
    assert.equal(pagina.documento.activeElement, pagina.el('ev-titulo'));
    await pagina.tocar(pagina.el('modal-evento').querySelector('.modal-footer [data-cerrar]'));
    assert.deepEqual(abiertos(pagina), []);
    assert.equal(pagina.documento.activeElement, boton);
  });

  // Decisión del usuario (27/10/2026): el lector y el colaborador no comparten Laborales; desde el evento Personal (Público) (spec
  // 2026-10-29-mi-espacio-evento-publico, 4) ven «Tipo de evento» con los dos personales
  it('el lector ve el tipo con los dos personales, no pide las personas de administración, y lo que guarda es un Personal (Privado)', async () => {
    const pagina = montarPagina({ responder: conElFormulario() });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    assert.equal(pagina.el('ev-grupo-tipo').hidden, false);
    assert.deepEqual(tiposALaVista(pagina), [['privado', 'true', false], ['publico', 'false', false]]);
    assert.ok(pagina.el('ev-tipos').classList.contains('dos') && !pagina.el('ev-tipos').classList.contains('tres'));
    assert.equal(pagina.el('ev-grupo-personas').hidden, true);
    assert.equal(pagina.el('ev-publico').hidden, true);
    await pagina.escribir('ev-titulo', 'Turno médico');
    await pagina.escribir('ev-desde', '15:30');
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.deepEqual(pagina.pedidosA('POST', '/api/mi-espacio/eventos').map((p) => p.cuerpo), [
      { titulo: 'Turno médico', fecha: HOY, desde: '15:30', hasta: null, detalle: '', recordatorio: '2h', tipo: 'privado' }
    ]);
    assert.equal(pagina.rutas().filter((ruta) => ruta === RUTA_DE_PERSONAS || ruta === RUTA_DE_PERSONAS_DEL_PUBLICO).length, 0);
  });

  it('administración: Personal (Privado) de entrada; Laboral muestra las personas, pedidas una sola vez', async () => {
    const pagina = montarPagina({ admin: true, responder: conElFormulario() });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    assert.equal(pagina.el('ev-grupo-tipo').hidden, false);
    assert.deepEqual(tiposALaVista(pagina), [['privado', 'true', false], ['publico', 'false', false], ['laboral', 'false', false]]);
    assert.ok(pagina.el('ev-tipos').classList.contains('tres') && !pagina.el('ev-tipos').classList.contains('dos'));
    assert.equal(pagina.el('ev-grupo-personas').hidden, true);
    assert.equal(pagina.el('ev-recordatorio-ayuda').hidden, true);
    tipoDel(pagina, 'laboral').focus();
    await pagina.tocar(tipoDel(pagina, 'laboral'));
    assert.deepEqual(tiposALaVista(pagina), [['privado', 'false', false], ['publico', 'false', false], ['laboral', 'true', false]]);
    assert.equal(pagina.el('ev-grupo-personas').hidden, false);
    assert.equal(pagina.el('ev-recordatorio-ayuda').hidden, false);
    assert.equal(pagina.documento.activeElement, tipoDel(pagina, 'laboral'));
    assert.equal(pagina.el('ev-personas').innerHTML, M.htmlDePersonasDelEvento(PERSONAS_PARA_COMPARTIR, { tipo: 'laboral', personas: [] }));
    assert.equal(pagina.el('ev-personas-ayuda').textContent, M.AYUDA_DE_LAS_PERSONAS_DEL_LABORAL);
    // Una persona se suma (el foco queda en ella) y la cantidad se ve; «Todos» deshabilita a las demás
    const martin = personaDel(pagina, '3');
    martin.focus();
    await pagina.tocar(martin);
    assert.equal(personaDel(pagina, '3').getAttribute('aria-pressed'), 'true');
    assert.equal(pagina.documento.activeElement, personaDel(pagina, '3'));
    assert.equal(pagina.el('ev-personas-cuantas').textContent, '(1 persona)');
    await pagina.tocar(personaDel(pagina, 'todos'));
    assert.equal(personaDel(pagina, 'todos').getAttribute('aria-pressed'), 'true');
    assert.ok(PERSONAS_PARA_COMPARTIR.every(({ id }) => personaDel(pagina, String(id)).disabled === true));
    assert.equal(pagina.el('ev-personas-cuantas').textContent, '');
    // Personal (Privado) vuelve a ocultarlas
    await pagina.tocar(tipoDel(pagina, 'privado'));
    assert.equal(pagina.el('ev-grupo-personas').hidden, true);
    // Cerrar y volver a abrir no vuelve a pedir las personas, y un formulario nuevo vuelve a Personal (Privado)
    await pagina.tecla('Escape');
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    assert.equal(pagina.rutas().filter((ruta) => ruta === RUTA_DE_PERSONAS).length, 1);
    assert.equal(tipoDel(pagina, 'privado').getAttribute('aria-pressed'), 'true');
    assert.equal(pagina.el('ev-grupo-personas').hidden, true);
  });

  // El select la tiene en aria-describedby, y un texto oculto con hidden igual entra en la descripción (accname 1.2, paso 2A): en un
  // Personal (Privado) tiene que estar vacía, no solo oculta. Un Laboral de quien ya no es de administración no la tiene: no se puede
  // guardar como Laboral (spec 2026-10-29-mi-espacio-evento-publico, 4)
  const AYUDA_COMPARTIDO = 'Les llega a todas las personas del evento.';
  it('en un Personal (Privado), la ayuda del recordatorio del Laboral queda vacía (el lector, Privado y uno propio sin compartir)',
    async () => {
      const lector = montarPagina({ hash: '#agenda', responder: conElFormulario() });
      await lector.iniciar();
      await lector.tocar(lector.el('btn-nuevo-evento'));
      assert.equal(lector.el('ev-recordatorio-ayuda').textContent, '');
      assert.equal(lector.el('ev-recordatorio-ayuda').hidden, true);
      // Aunque abra uno que estaba compartido (lo compartió cuando era de administración): no puede compartir
      await lector.tecla('Escape');
      await abrirElEvento(lector, '12');
      assert.equal(lector.el('ev-recordatorio-ayuda').textContent, '');
      const admin = montarPagina({ hash: '#agenda', admin: true, responder: conElFormulario() });
      await admin.iniciar();
      await admin.tocar(admin.el('btn-nuevo-evento'));
      assert.equal(admin.el('ev-recordatorio-ayuda').textContent, '');
      assert.equal(admin.el('ev-recordatorio-ayuda').hidden, true);
      await admin.tecla('Escape');
      await abrirElEvento(admin, '13');
      assert.equal(admin.el('ev-recordatorio-ayuda').textContent, '');
      // Compartido y de vuelta a «Solo yo»: se vacía otra vez
      await admin.tocar(tipoDel(admin, 'laboral'));
      await admin.tocar(tipoDel(admin, 'privado'));
      assert.equal(admin.el('ev-recordatorio-ayuda').textContent, '');
      assert.equal(admin.el('ev-recordatorio-ayuda').hidden, true);
    });

  it('en un evento compartido, la ayuda del recordatorio dice que les llega a todos (uno nuevo y uno propio con personas)', async () => {
    // Uno propio con personas, en una página recién montada: la ayuda la escribe abrirlo (en el HTML está vacía)
    const existente = montarPagina({ hash: '#agenda', admin: true, responder: conElFormulario() });
    await existente.iniciar();
    assert.equal(existente.el('ev-recordatorio-ayuda').textContent, '');
    await abrirElEvento(existente, '12');
    assert.equal(existente.el('ev-recordatorio-ayuda').textContent, AYUDA_COMPARTIDO);
    assert.equal(existente.el('ev-recordatorio-ayuda').hidden, false);
    // Uno nuevo, al elegir «Compartido»
    const nuevo = montarPagina({ hash: '#agenda', admin: true, responder: conElFormulario() });
    await nuevo.iniciar();
    await nuevo.tocar(nuevo.el('btn-nuevo-evento'));
    await nuevo.tocar(tipoDel(nuevo, 'laboral'));
    assert.equal(nuevo.el('ev-recordatorio-ayuda').textContent, AYUDA_COMPARTIDO);
    assert.equal(nuevo.el('ev-recordatorio-ayuda').hidden, false);
  });

  it('si las personas no llegan, lo dice y se vuelven a pedir la próxima vez', async () => {
    let falla = true;
    const pagina = montarPagina({
      admin: true,
      responder: conElFormulario({ extra: (metodo, ruta) => (ruta === RUTA_DE_PERSONAS && falla ? respuesta(500, { success: false, error: 'Error' }) : undefined) })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    await pagina.tocar(tipoDel(pagina, 'laboral'));
    assert.ok(textoDe(pagina.el('ev-personas').innerHTML).endsWith('No se pudo cargar la lista de personas. Probá de nuevo en unos minutos.'));
    assert.ok(personaDel(pagina, 'todos'), '«Toda la administración» se puede elegir igual');
    await pagina.tecla('Escape');
    falla = false;
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    await pagina.tocar(tipoDel(pagina, 'laboral'));
    assert.equal(pagina.rutas().filter((ruta) => ruta === RUTA_DE_PERSONAS).length, 2);
    assert.equal(pagina.el('ev-personas').innerHTML, M.htmlDePersonasDelEvento(PERSONAS_PARA_COMPARTIR, { tipo: 'laboral', personas: [] }));
  });

  it('con un 403 de las personas (un rol viejo en el navegador), dice el mensaje del servidor, no «Probá de nuevo»', async () => {
    const pagina = montarPagina({
      admin: true,
      responder: conElFormulario({
        extra: (metodo, ruta) => (ruta === RUTA_DE_PERSONAS ? respuesta(403, { success: false, error: MENSAJES_EVENTO.sinPermiso }) : undefined)
      })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    await pagina.tocar(tipoDel(pagina, 'laboral'));
    const texto = textoDe(pagina.el('ev-personas').innerHTML);
    assert.ok(texto.endsWith('No tenés permiso para compartir eventos.'), texto);
    assert.ok(!texto.includes('Probá de nuevo'), texto);
  });

  // Review Focus 5: dos eventos compartidos mandarían dos invitaciones
  it('dos clics en «Guardar» con un fetch que tarda mandan un solo POST; después se cierra, se anuncia y se vuelven a pedir la agenda y el Resumen',
    async () => {
      let soltar;
      const demorado = new Promise((resolver) => { soltar = resolver; });
      const pagina = montarPagina({
        hash: '#agenda', admin: true,
        responder: conElFormulario({
          extra: (metodo, ruta) => (metodo === 'POST' && ruta === '/api/mi-espacio/eventos'
            ? demorado.then(() => respuesta(201, { success: true, data: { id: 99 }, message: 'Evento guardado.' })) : undefined)
        })
      });
      await pagina.iniciar();
      await pagina.tocar(pagina.el('ag-nuevo-evento'));
      await pagina.correr();
      await pagina.escribir('ev-titulo', 'Reunión de equipo');
      await pagina.escribir('ev-desde', '10:00');
      await pagina.escribir('ev-hasta', '11:00');
      await pagina.escribir('ev-detalle', 'Sala de reuniones del 2.º piso.');
      await pagina.tocar(tipoDel(pagina, 'laboral'));
      await pagina.tocar(personaDel(pagina, 'todos'));
      const resumenes = pagina.rutas().filter((ruta) => ruta === '/api/mi-espacio/resumen').length;
      const rangos = rangosPedidos(pagina).length;
      await pagina.tocar(pagina.el('ev-guardar'));
      assert.equal(pagina.el('ev-guardar').disabled, true);
      await pagina.tocar(pagina.el('ev-guardar'));
      pagina.el('ev-guardar').disabled = false;
      await pagina.tocar(pagina.el('ev-guardar'));
      // Mientras guarda, el modal no se cierra
      await pagina.tecla('Escape');
      assert.deepEqual(abiertos(pagina), ['modal-evento']);
      assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/eventos').length, 1);
      assert.deepEqual(pagina.pedidosA('POST', '/api/mi-espacio/eventos')[0].cuerpo, {
        titulo: 'Reunión de equipo', fecha: HOY, desde: '10:00', hasta: '11:00', detalle: 'Sala de reuniones del 2.º piso.', recordatorio: '2h',
        tipo: 'laboral', compartido: true, para_todos: true, personas: []
      });
      soltar();
      await pagina.esperar();
      assert.deepEqual(abiertos(pagina), []);
      assert.equal(pagina.el('me-anuncio').textContent, 'Evento guardado.');
      assert.deepEqual(pagina.estado.toasts, [['Evento guardado.', 'success']]);
      assert.equal(pagina.rutas().filter((ruta) => ruta === '/api/mi-espacio/resumen').length, resumenes + 1);
      assert.deepEqual(rangosPedidos(pagina).slice(rangos).sort(), [RUTA_DEL_MES, RUTA_DE_PROXIMOS]);
      assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/eventos').length, 1);
    });

  it('los errores del formulario, antes de pedir nada: todos juntos, con aria-invalid, y el foco al primero', async () => {
    const pagina = montarPagina({ admin: true, responder: conElFormulario() });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    await pagina.escribir('ev-titulo', '   ');
    await pagina.escribir('ev-fecha', '2024-12-31');
    await pagina.escribir('ev-hasta', '09:00');
    await pagina.tocar(tipoDel(pagina, 'laboral'));
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/eventos').length, 0);
    for (const [id, mensaje] of [['ev-titulo', MENSAJES_EVENTO.titulo], ['ev-fecha', 'La fecha tiene que ser del 01/01/2025 al 26/10/2028.'],
      ['ev-desde', MENSAJES_EVENTO.desde], ['ev-personas', MENSAJES_EVENTO.personas]]) {
      assert.equal(pagina.el(`${id}-error`).textContent, mensaje, id);
      assert.equal(pagina.el(`${id}-error`).hidden, false, id);
      assert.equal(pagina.el(id).getAttribute('aria-invalid'), 'true', id);
    }
    assert.equal(pagina.documento.activeElement, pagina.el('ev-titulo'));
    // Sin el título ni la fecha mal, el primero es el de las personas: el foco va a «Todos»
    await pagina.escribir('ev-titulo', 'Reunión de equipo');
    await pagina.escribir('ev-fecha', '2026-10-27');
    await pagina.escribir('ev-desde', '10:00');
    await pagina.escribir('ev-hasta', '11:00');
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.equal(pagina.el('ev-titulo').getAttribute('aria-invalid'), null);
    assert.equal(pagina.el('ev-titulo-error').hidden, true);
    assert.equal(pagina.documento.activeElement, personaDel(pagina, 'todos'));
    assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/eventos').length, 0);
  });

  it('un 400 en titulo pone aria-invalid y el foco en #ev-titulo; uno sin campo de la página (compartido) va a #ev-error', async () => {
    let contestar = respuesta(400, { success: false, error: MENSAJES_EVENTO.tituloLargo, campo: 'titulo' });
    const pagina = montarPagina({
      admin: true, responder: conElFormulario({ extra: (metodo) => (metodo === 'POST' ? contestar : undefined) })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    await pagina.escribir('ev-titulo', 'Reunión de equipo');
    await pagina.escribir('ev-desde', '10:00');
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.deepEqual(abiertos(pagina), ['modal-evento']);
    assert.equal(pagina.el('ev-titulo').getAttribute('aria-invalid'), 'true');
    assert.equal(pagina.el('ev-titulo-error').textContent, MENSAJES_EVENTO.tituloLargo);
    assert.equal(pagina.documento.activeElement, pagina.el('ev-titulo'));
    assert.equal(pagina.el('ev-guardar').disabled, false);
    contestar = respuesta(400, { success: false, error: MENSAJES_EVENTO.sinPermiso, campo: 'compartido' });
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.equal(pagina.el('ev-titulo').getAttribute('aria-invalid'), null);
    assert.equal(pagina.el('ev-error').textContent, MENSAJES_EVENTO.sinPermiso);
    assert.equal(pagina.el('ev-error').hidden, false);
    assert.equal(pagina.documento.activeElement, pagina.el('ev-guardar'));
    // Sin conexión, en castellano
    contestar = Promise.reject(new TypeError('Failed to fetch'));
    contestar.catch(() => {});
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.equal(pagina.el('ev-error').textContent, MENSAJE_SIN_CONEXION);
  });

  it('el aviso del recordatorio: 300 ms después del último cambio, un solo pedido; una respuesta vieja no pisa la nueva', async () => {
    let soltarViejo;
    const viejo = new Promise((resolver) => { soltarViejo = resolver; });
    const pagina = montarPagina({
      responder: conElFormulario({
        extra: (metodo, ruta) => (ruta === rutaDelAviso(HOY, '10:00')
          ? viejo.then(() => ok({ momento: null, texto: 'una respuesta vieja' })) : undefined)
      })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    await pagina.correr();
    // Sin hora no hay nada que pedir
    assert.deepEqual(avisosPedidos(pagina), []);
    await pagina.escribir('ev-desde', '11:30');
    await pagina.escribir('ev-desde', '11:00');
    assert.deepEqual(avisosPedidos(pagina), [], 'espera los 300 ms');
    await pagina.correr();
    assert.deepEqual(avisosPedidos(pagina), [rutaDelAviso(HOY, '11:00')]);
    assert.equal(pagina.el('ev-aviso').textContent, textoDelAvisoDe(HOY, '11:00'));
    assert.equal(pagina.el('ev-aviso').textContent, '2 horas antes (hoy a las 09:00)');
    assert.equal(pagina.el('ev-aviso').hidden, false);
    // El que tarda (las 10:00) y después otro (el día hábil anterior): gana el último, aunque el viejo llegue después
    await pagina.escribir('ev-desde', '10:00');
    await pagina.correr();
    assert.equal(pagina.el('ev-aviso').hidden, true, 'mientras espera, sin un aviso viejo');
    await pagina.escribir('ev-recordatorio', 'dia_anterior', 'change');
    await pagina.correr();
    assert.equal(pagina.el('ev-aviso').textContent, textoDelAvisoDe(HOY, '10:00', 'dia_anterior'));
    soltarViejo();
    await pagina.esperar();
    assert.equal(pagina.el('ev-aviso').textContent, textoDelAvisoDe(HOY, '10:00', 'dia_anterior'));
    // «Sin aviso» no pide nada y no dice nada
    const antes = avisosPedidos(pagina).length;
    await pagina.escribir('ev-recordatorio', 'ninguno', 'change');
    await pagina.correr();
    assert.equal(avisosPedidos(pagina).length, antes);
    assert.equal(pagina.el('ev-aviso').hidden, true);
    // Una fecha nueva lo vuelve a pedir
    await pagina.escribir('ev-recordatorio', '1h', 'change');
    await pagina.escribir('ev-fecha', '2026-10-31');
    await pagina.correr();
    assert.equal(avisosPedidos(pagina).at(-1), rutaDelAviso('2026-10-31', '10:00', '1h'));
    assert.equal(pagina.el('ev-aviso').textContent, '1 hora antes (el viernes 30/10 a las 09:00)');
  });

  it('un evento propio de la grilla: «Editar evento» con sus datos, sus personas y su aviso; el PUT con lo cambiado', async () => {
    const pagina = montarPagina({ hash: '#agenda', admin: true, responder: conElFormulario() });
    await pagina.iniciar();
    await abrirElEvento(pagina, '12');
    assert.deepEqual(abiertos(pagina), ['modal-evento']);
    assert.equal(pagina.el('modal-evento-titulo').textContent, 'Editar evento');
    assert.deepEqual(['ev-titulo', 'ev-fecha', 'ev-desde', 'ev-hasta', 'ev-detalle', 'ev-recordatorio'].map((id) => pagina.el(id).value),
      ['Reunión de equipo', '2026-10-27', '10:00', '11:00', '', '2h']);
    assert.equal(pagina.el('ev-borrar').hidden, false);
    assert.equal(tipoDel(pagina, 'laboral').getAttribute('aria-pressed'), 'true');
    assert.equal(pagina.el('ev-grupo-personas').hidden, false);
    assert.deepEqual(PERSONAS_PARA_COMPARTIR.map(({ id }) => [id, personaDel(pagina, String(id)).getAttribute('aria-pressed')]),
      [[4, 'true'], [6, 'true'], [7, 'false'], [3, 'true'], [5, 'true']]);
    assert.equal(pagina.el('ev-personas-cuantas').textContent, '(4 personas)');
    assert.equal(pagina.el('ev-aviso').textContent, itemDe(12).aviso.texto);
    assert.equal(pagina.documento.activeElement, pagina.el('ev-titulo'));
    await pagina.tocar(personaDel(pagina, '7'));
    await pagina.tocar(personaDel(pagina, '3'));
    await pagina.escribir('ev-desde', '10:30');
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.deepEqual(pagina.pedidosA('PUT', '/api/mi-espacio/eventos/12').map((p) => p.cuerpo), [{
      titulo: 'Reunión de equipo', fecha: '2026-10-27', desde: '10:30', hasta: '11:00', detalle: '', recordatorio: '2h',
      tipo: 'laboral', compartido: true, para_todos: false, personas: [4, 5, 6, 7]
    }]);
    assert.deepEqual(abiertos(pagina), []);
    assert.equal(pagina.el('me-anuncio').textContent, 'Evento cambiado.');
  });

  // Review Focus 4: una invitada que dejó de ser administración no está en la lista, pero sigue en el evento: no se la saca sin querer
  it('una persona del evento que ya no está en la lista se ve y se guarda igual', async () => {
    const conOtra = [...EVENTOS_DE_PRUEBA.filter((evento) => evento.id !== 12), eventoDe(12, 'Reunión de equipo', '2026-10-27', '10:00',
      { hasta: '11:00', compartido: 1, personas: [...CUATRO_PERSONAS, { id: 8, nombre: 'Persona de Prueba', sin_recordatorio: 0 }] })];
    const pagina = montarPagina({
      hash: '#agenda', admin: true,
      responder: conElFormulario({ eventos: { [RUTA_DEL_MES]: ok(respuestaDeEventos({ desde: '2026-09-28', hasta: '2026-11-01' }, { eventos: conOtra })) } })
    });
    await pagina.iniciar();
    await abrirElEvento(pagina, '12');
    assert.equal(personaDel(pagina, '8').getAttribute('aria-pressed'), 'true');
    assert.equal(personaDel(pagina, '8').textContent, 'PPPersona de Prueba');
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.deepEqual(pagina.pedidosA('PUT', '/api/mi-espacio/eventos/12')[0].cuerpo.personas, [3, 4, 5, 6, 8]);
  });

  it('un 404 al guardar cierra el modal, lo avisa y vuelve a pedir la agenda', async () => {
    const pagina = montarPagina({
      hash: '#agenda',
      responder: conElFormulario({
        extra: (metodo) => (metodo === 'PUT' ? respuesta(404, { success: false, error: MENSAJES_EVENTO.noEncontrado }) : undefined)
      })
    });
    await pagina.iniciar();
    await abrirElEvento(pagina, '11');
    const rangos = rangosPedidos(pagina).length;
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.equal(pagina.pedidosA('PUT', '/api/mi-espacio/eventos/11').length, 1);
    assert.deepEqual(abiertos(pagina), []);
    assert.deepEqual(pagina.estado.toasts, [[MENSAJES_EVENTO.noEncontrado, 'error']]);
    assert.equal(pagina.el('me-anuncio').textContent, MENSAJES_EVENTO.noEncontrado);
    assert.deepEqual(rangosPedidos(pagina).slice(rangos).sort(), [RUTA_DEL_MES, RUTA_DE_PROXIMOS]);
  });

  it('un clic en el velo no cierra; Escape cierra primero la confirmación y después el formulario, y el foco vuelve al evento', async () => {
    const pagina = montarPagina({ hash: '#agenda', admin: true, responder: conElFormulario() });
    await pagina.iniciar();
    const boton = await abrirElEvento(pagina, '12');
    pagina.el('modal-evento').disparar('click');
    await pagina.esperar();
    assert.deepEqual(abiertos(pagina), ['modal-evento']);
    pagina.el('ev-borrar').focus();
    await pagina.tocar(pagina.el('ev-borrar'));
    await pagina.correr();
    assert.deepEqual(abiertos(pagina), ['modal-evento', 'modal-confirmar']);
    assert.equal(pagina.el('modal-confirmar-titulo').textContent, 'Borrar el evento');
    assert.equal(pagina.el('modal-confirmar-texto').textContent,
      '¿Borrar «Reunión de equipo» del martes 27/10/2026? A las 4 personas les llega un email que dice que se canceló.');
    assert.equal(pagina.documento.activeElement, pagina.el('modal-confirmar').querySelector('.modal-footer [data-cerrar]'));
    pagina.el('modal-confirmar').disparar('click');
    await pagina.esperar();
    assert.deepEqual(abiertos(pagina), ['modal-evento', 'modal-confirmar']);
    await pagina.tecla('Escape');
    assert.deepEqual(abiertos(pagina), ['modal-evento']);
    assert.equal(pagina.documento.activeElement, pagina.el('ev-borrar'));
    await pagina.tecla('Escape');
    assert.deepEqual(abiertos(pagina), []);
    assert.equal(pagina.documento.activeElement, boton);
    assert.equal(pagina.pedidosA('DELETE', '/api/mi-espacio/eventos/12').length, 0);
  });

  it('borrar: la confirmación y el DELETE; después cierra los dos modales, avisa y vuelve a pedir la agenda', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conElFormulario() });
    await pagina.iniciar();
    await abrirElEvento(pagina, '13');
    await pagina.tocar(pagina.el('ev-borrar'));
    assert.equal(pagina.el('modal-confirmar-texto').textContent, '¿Borrar «Turno médico» del miércoles 28/10/2026?');
    const rangos = rangosPedidos(pagina).length;
    await pagina.tocar(pagina.el('modal-confirmar-si'));
    assert.equal(pagina.pedidosA('DELETE', '/api/mi-espacio/eventos/13').length, 1);
    assert.deepEqual(abiertos(pagina), []);
    assert.equal(pagina.el('me-anuncio').textContent, 'Evento borrado.');
    assert.deepEqual(rangosPedidos(pagina).slice(rangos).sort(), [RUTA_DEL_MES, RUTA_DE_PROXIMOS]);
  });

  // Review Focus 2
  it('un título con HTML se ve como texto en el formulario, en el detalle de uno ajeno y en la confirmación', async () => {
    const eventos = [eventoDe(11, MALICIOSO, '2026-10-26', '12:00'), eventoDe(14, MALICIOSO, '2026-10-29', '09:00', DE_MARTIN)];
    const pagina = montarPagina({
      hash: '#agenda',
      responder: conElFormulario({
        eventos: {
          [RUTA_DEL_MES]: ok(respuestaDeEventos({ desde: '2026-09-28', hasta: '2026-11-01' }, { eventos })),
          [RUTA_DE_PROXIMOS]: ok(respuestaDeEventos({ desde: '2026-10-26', hasta: '2026-11-25' }, { eventos }))
        }
      })
    });
    await pagina.iniciar();
    await abrirElEvento(pagina, '14', 'ag-proximos');
    assert.equal(pagina.el('modal-evento-ajeno-titulo').textContent, MALICIOSO);
    assert.equal(pagina.el('modal-evento-ajeno').querySelector('img'), null);
    await pagina.tecla('Escape');
    await abrirElEvento(pagina, '11');
    assert.equal(pagina.el('ev-titulo').value, MALICIOSO);
    await pagina.tocar(pagina.el('ev-borrar'));
    assert.equal(pagina.el('modal-confirmar-texto').textContent, `¿Borrar «${MALICIOSO}» del lunes 26/10/2026?`);
    for (const id of ['modal-evento', 'modal-confirmar']) assert.equal(pagina.el(id).querySelector('img'), null, id);
  });

  it('sin modalidad, «Nuevo evento» abre el formulario igual (decisión del usuario)', async () => {
    const resumen = resumenDel(PLANTA, { estado: { ...PLANTA.estado, modalidad: null } });
    const pagina = montarPagina({ responder: conElFormulario({ extra: (metodo, ruta) => (ruta === '/api/mi-espacio/resumen' ? ok(resumen) : undefined) }) });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    assert.deepEqual(abiertos(pagina), ['modal-evento']);
  });
});

// Los tres tipos de evento en la página (spec 2026-10-29-mi-espacio-evento-publico, 4 y 7): el lector carga un Personal (Público),
// la vista previa, «Otro» con su cuenta y sus errores, el Laboral de administración con «Toda la administración», el Laboral de
// quien ya no es de administración, un Público propio y los errores del servidor
const conPublicos = (extra) => conElFormulario({
  extra,
  eventos: {
    [RUTA_DEL_MES]: ok(conLaFrase(respuestaDeEventos({ desde: '2026-09-28', hasta: '2026-11-01' },
      { eventos: [...EVENTOS_DE_PRUEBA, PUBLICO_CON_TODOS] }), '2026-10')),
    [RUTA_DE_PROXIMOS]: ok(respuestaDeEventos({ desde: '2026-10-26', hasta: '2026-11-25' },
      { eventos: [...EVENTOS_DE_PRUEBA, PUBLICO_CON_TODOS, PUBLICO_CON_DOS] }))
  }
});
const vistaPrevia = (pagina) => textoDe(pagina.el('ev-vista-previa-evento').innerHTML);
// El pedido del nombre de quien mira (mi_nombre_corto) cuando la agenda todavía no se cargó: lo de hoy
const RUTA_DEL_NOMBRE = `/api/mi-espacio/eventos?desde=${HOY}&hasta=${HOY}`;

describe('el formulario del evento con los tres tipos en la página (DOM falso)', () => {
  it('el lector elige Personal (Público), «Turno médico» y «Todos»: un solo POST con el tipo, «Todos» y el texto, y las personas de todos', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conElFormulario() });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('ag-nuevo-evento'));
    await pagina.correr();
    await pagina.escribir('ev-titulo', 'Control con la dermatóloga');
    await pagina.escribir('ev-fecha', '2026-11-05');
    await pagina.escribir('ev-desde', '10:00');
    tipoDel(pagina, 'publico').focus();
    await pagina.tocar(tipoDel(pagina, 'publico'));
    assert.deepEqual(tiposALaVista(pagina), [['privado', 'false', false], ['publico', 'true', false]]);
    assert.equal(pagina.documento.activeElement, tipoDel(pagina, 'publico'));
    assert.equal(pagina.el('ev-publico').hidden, false);
    assert.equal(pagina.el('ev-otro-grupo').hidden, true);
    assert.equal(pagina.el('ev-textos').innerHTML, M.htmlDeTextosPublicos({ tipo: 'publico', texto_publico: '', otro: false }));
    assert.equal(pagina.el('ev-grupo-personas').hidden, false);
    assert.equal(pagina.el('ev-personas').innerHTML, M.htmlDePersonasDelEvento(PERSONAS_DEL_PUBLICO, { tipo: 'publico', personas: [] }));
    assert.equal(personaDel(pagina, 'todos').textContent, 'Todos');
    assert.equal(pagina.el('ev-personas-ayuda').textContent, 'No les llega ningún email: lo ven en su agenda y en el Resumen.');
    assert.equal(pagina.el('ev-recordatorio-ayuda').textContent, 'Te llega solo a vos.');
    assert.equal(pagina.el('ev-recordatorio-ayuda').hidden, false);
    assert.equal(pagina.el('ev-vista-previa-dia').textContent, 'Jue 5');
    assert.equal(vistaPrevia(pagina), '10:00 Laura: …');
    const turno = textoDel(pagina, 'Turno médico');
    turno.focus();
    await pagina.tocar(turno);
    assert.equal(textoDel(pagina, 'Turno médico').getAttribute('aria-pressed'), 'true');
    assert.equal(pagina.documento.activeElement, textoDel(pagina, 'Turno médico'));
    assert.equal(vistaPrevia(pagina), '10:00 Laura: Turno médico');
    await pagina.tocar(personaDel(pagina, 'todos'));
    await pagina.tocar(pagina.el('ev-guardar'));
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.deepEqual(pagina.pedidosA('POST', '/api/mi-espacio/eventos').map((p) => p.cuerpo), [{
      titulo: 'Control con la dermatóloga', fecha: '2026-11-05', desde: '10:00', hasta: null, detalle: '', recordatorio: '2h',
      tipo: 'publico', para_todos: true, personas: [], texto_publico: 'Turno médico'
    }]);
    assert.equal(pagina.rutas().filter((ruta) => ruta === RUTA_DE_PERSONAS_DEL_PUBLICO).length, 1);
    assert.equal(pagina.rutas().filter((ruta) => ruta === RUTA_DE_PERSONAS).length, 0);
    assert.equal(pagina.rutas().filter((ruta) => ruta === RUTA_DEL_NOMBRE).length, 0, 'el nombre ya llegó con la agenda');
    assert.deepEqual(abiertos(pagina), []);
  });

  it('la vista previa cambia con la hora, la fecha, la pastilla y lo que se escribe en «Otro»; la cuenta, con cada letra y sin anunciarse', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conElFormulario() });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    await pagina.tocar(tipoDel(pagina, 'publico'));
    assert.equal(pagina.el('ev-vista-previa-dia').textContent, 'Lun 26');
    assert.equal(vistaPrevia(pagina), 'Laura: …');
    await pagina.escribir('ev-desde', '10:00');
    assert.equal(vistaPrevia(pagina), '10:00 Laura: …');
    await pagina.escribir('ev-desde', '08:30', 'change');
    assert.equal(vistaPrevia(pagina), '08:30 Laura: …');
    await pagina.escribir('ev-fecha', '2026-10-29');
    assert.equal(pagina.el('ev-vista-previa-dia').textContent, 'Jue 29');
    const anuncio = pagina.el('me-anuncio').textContent;
    await pagina.tocar(textoDel(pagina, 'otro'));
    assert.equal(pagina.el('ev-otro-grupo').hidden, false);
    assert.equal(textoDel(pagina, 'otro').getAttribute('aria-pressed'), 'true');
    assert.equal(pagina.documento.activeElement, pagina.el('ev-otro'));
    assert.equal(pagina.el('ev-otro-cuenta').textContent, '0 de 60 caracteres');
    await pagina.escribir('ev-otro', 'A');
    assert.equal(pagina.el('ev-otro-cuenta').textContent, '1 de 60 caracteres');
    await pagina.escribir('ev-otro', 'Ayudo a mi hermana');
    assert.equal(pagina.el('ev-otro-cuenta').textContent, '18 de 60 caracteres');
    assert.equal(pagina.el('ev-otro-cuenta').classList.contains('pasado'), false);
    assert.equal(vistaPrevia(pagina), '08:30 Laura: Ayudo a mi hermana');
    // La cuenta no es una región viva, y lo que se escribe no se anuncia
    for (const atributo of ['aria-live', 'role']) assert.equal(pagina.el('ev-otro-cuenta').getAttribute(atributo), null, atributo);
    assert.equal(pagina.el('me-anuncio').textContent, anuncio);
    // Otra pastilla oculta «Otro», que conserva lo escrito: volver a elegirlo lo trae
    await pagina.tocar(textoDel(pagina, 'Asunto familiar'));
    assert.equal(pagina.el('ev-otro-grupo').hidden, true);
    assert.equal(vistaPrevia(pagina), '08:30 Laura: Asunto familiar');
    await pagina.tocar(textoDel(pagina, 'otro'));
    assert.equal(vistaPrevia(pagina), '08:30 Laura: Ayudo a mi hermana');
    assert.equal(pagina.el('ev-otro').value, 'Ayudo a mi hermana');
    // Un texto con HTML, como texto
    await pagina.escribir('ev-otro', '<b>"x"</b>');
    assert.equal(pagina.el('ev-vista-previa-evento').querySelector('b').textContent, '08:30');
    assert.ok(pagina.el('ev-vista-previa-evento').innerHTML.includes('Laura: &lt;b&gt;&quot;x&quot;&lt;/b&gt;'));
  });

  it('«Otro» con 61 caracteres: «Guardar» no manda nada y el error va debajo del campo, con aria-invalid y el foco ahí', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conElFormulario() });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    await pagina.escribir('ev-titulo', 'Mudanza');
    await pagina.escribir('ev-desde', '08:00');
    await pagina.tocar(tipoDel(pagina, 'publico'));
    await pagina.tocar(personaDel(pagina, 'todos'));
    // Sin elegir qué ven los demás: el error de las pastillas, con el foco en la primera
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.equal(pagina.el('ev-texto-error').textContent, MENSAJES_EVENTO.textoPublico);
    assert.equal(pagina.el('ev-texto-error').hidden, false);
    assert.equal(pagina.el('ev-textos').getAttribute('aria-invalid'), 'true');
    assert.equal(pagina.documento.activeElement, textoDel(pagina, 'Trámite personal'));
    // «Otro» saca ese error; con 61 caracteres, el del largo, en su campo
    await pagina.tocar(textoDel(pagina, 'otro'));
    assert.equal(pagina.el('ev-texto-error').hidden, true);
    assert.equal(pagina.el('ev-textos').getAttribute('aria-invalid'), null);
    await pagina.escribir('ev-otro', 'a'.repeat(61));
    assert.equal(pagina.el('ev-otro-cuenta').textContent, '61 de 60 caracteres');
    assert.equal(pagina.el('ev-otro-cuenta').classList.contains('pasado'), true);
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/eventos').length, 0);
    assert.equal(pagina.el('ev-otro-error').textContent, 'Lo que ven los demás puede tener hasta 60 caracteres.');
    assert.equal(pagina.el('ev-otro-error').hidden, false);
    assert.equal(pagina.el('ev-otro').getAttribute('aria-invalid'), 'true');
    assert.equal(pagina.el('ev-otro').getAttribute('aria-describedby'), 'ev-otro-cuenta ev-otro-error');
    assert.equal(pagina.documento.activeElement, pagina.el('ev-otro'));
    // Vacío, «Escribí qué ven los demás.»
    await pagina.escribir('ev-otro', '   ');
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.equal(pagina.el('ev-otro-error').textContent, 'Escribí qué ven los demás.');
    assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/eventos').length, 0);
    // Con 60, se guarda
    await pagina.escribir('ev-otro', 'a'.repeat(60));
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.deepEqual(pagina.pedidosA('POST', '/api/mi-espacio/eventos').map((p) => p.cuerpo.texto_publico), ['a'.repeat(60)]);
  });

  it('administración: Laboral pide /mi-espacio/personas y dice «Toda la administración»; Público, /mi-espacio/personas/publico y «Todos»', async () => {
    const pagina = montarPagina({ admin: true, responder: conElFormulario() });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    await pagina.tocar(tipoDel(pagina, 'laboral'));
    assert.equal(personaDel(pagina, 'todos').textContent, 'Toda la administración');
    const ids = () => pagina.el('ev-personas').querySelectorAll('[data-persona]').map((boton) => boton.getAttribute('data-persona'));
    assert.deepEqual(ids(), ['todos', ...PERSONAS_PARA_COMPARTIR.map(({ id }) => String(id))]);
    assert.equal(pagina.el('ev-personas-ayuda').textContent, M.AYUDA_DE_LAS_PERSONAS_DEL_LABORAL);
    await pagina.tocar(personaDel(pagina, '7'));
    // El Público tiene su lista y su «Todos»; lo elegido en el Laboral no pasa (empieza de nuevo)
    await pagina.tocar(tipoDel(pagina, 'publico'));
    assert.equal(personaDel(pagina, 'todos').textContent, 'Todos');
    assert.deepEqual(ids(), ['todos', ...PERSONAS_DEL_PUBLICO.map(({ id }) => String(id))]);
    assert.ok(pagina.el('ev-personas').querySelectorAll('[data-persona]').every((boton) => boton.getAttribute('aria-pressed') === 'false'));
    assert.equal(pagina.el('ev-personas-ayuda').textContent, M.AYUDA_DE_LAS_PERSONAS_DEL_PUBLICO);
    await pagina.tocar(personaDel(pagina, '9'));
    assert.equal(pagina.el('ev-personas-cuantas').textContent, '(1 persona)');
    await pagina.tocar(tipoDel(pagina, 'laboral'));
    assert.equal(pagina.el('ev-personas-cuantas').textContent, '');
    assert.equal(personaDel(pagina, '9'), null, 'Tomás no es de administración');
    await pagina.tocar(tipoDel(pagina, 'publico'));
    // Cada lista se pidió una sola vez
    assert.equal(pagina.rutas().filter((ruta) => ruta === RUTA_DE_PERSONAS).length, 1);
    assert.equal(pagina.rutas().filter((ruta) => ruta === RUTA_DE_PERSONAS_DEL_PUBLICO).length, 1);
  });

  it('si las personas del Público no llegan, lo dice y se vuelven a pedir la próxima vez', async () => {
    let falla = true;
    const pagina = montarPagina({
      responder: conElFormulario({
        extra: (metodo, ruta) => (ruta === RUTA_DE_PERSONAS_DEL_PUBLICO && falla ? respuesta(500, { success: false, error: 'Error' }) : undefined)
      })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    await pagina.tocar(tipoDel(pagina, 'publico'));
    assert.ok(textoDe(pagina.el('ev-personas').innerHTML).endsWith('No se pudo cargar la lista de personas. Probá de nuevo en unos minutos.'));
    assert.ok(personaDel(pagina, 'todos'), '«Todos» se puede elegir igual');
    await pagina.tecla('Escape');
    falla = false;
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    await pagina.tocar(tipoDel(pagina, 'publico'));
    assert.equal(pagina.rutas().filter((ruta) => ruta === RUTA_DE_PERSONAS_DEL_PUBLICO).length, 2);
    assert.equal(pagina.el('ev-personas').innerHTML, M.htmlDePersonasDelEvento(PERSONAS_DEL_PUBLICO, { tipo: 'publico', personas: [] }));
  });

  it('un lector con un Laboral suyo: el Laboral elegido y deshabilitado, con su ayuda; «Guardar» no manda nada hasta elegir otro tipo', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conElFormulario() });
    await pagina.iniciar();
    await abrirElEvento(pagina, '12');
    assert.deepEqual(tiposALaVista(pagina), [['privado', 'false', false], ['publico', 'false', false], ['laboral', 'true', true]]);
    assert.ok(pagina.el('ev-tipos').classList.contains('tres'));
    assert.equal(pagina.el('ev-tipo-ayuda').textContent, 'Ya no podés compartir eventos laborales. Elegí otro tipo para guardarlo.');
    assert.equal(pagina.el('ev-tipo-ayuda').hidden, false);
    assert.equal(pagina.el('ev-grupo-tipo').getAttribute('aria-describedby'), 'ev-tipo-ayuda ev-tipo-error');
    assert.equal(pagina.el('ev-grupo-personas').hidden, true);
    // Tocar el Laboral deshabilitado no hace nada
    await pagina.tocar(tipoDel(pagina, 'laboral'));
    assert.equal(tipoDel(pagina, 'laboral').getAttribute('aria-pressed'), 'true');
    await pagina.tocar(pagina.el('ev-guardar'));
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.equal(pagina.pedidosA('PUT', '/api/mi-espacio/eventos/12').length, 0);
    assert.deepEqual(abiertos(pagina), ['modal-evento']);
    assert.equal(pagina.el('ev-tipo-error').textContent, 'Ya no podés compartir eventos laborales. Elegí otro tipo para guardarlo.');
    assert.equal(pagina.el('ev-tipo-error').hidden, false);
    assert.equal(pagina.el('ev-tipos').getAttribute('aria-invalid'), 'true');
    assert.equal(pagina.documento.activeElement, tipoDel(pagina, 'privado'));
    // Otro tipo: el Laboral se va, con su ayuda y su error, y se guarda
    await pagina.tocar(tipoDel(pagina, 'privado'));
    assert.deepEqual(tiposALaVista(pagina), [['privado', 'true', false], ['publico', 'false', false]]);
    assert.ok(pagina.el('ev-tipos').classList.contains('dos'));
    assert.equal(pagina.el('ev-tipo-ayuda').textContent, '');
    assert.equal(pagina.el('ev-tipo-ayuda').hidden, true);
    assert.equal(pagina.el('ev-tipo-error').hidden, true);
    assert.equal(pagina.el('ev-tipos').getAttribute('aria-invalid'), null);
    assert.equal(pagina.documento.activeElement, tipoDel(pagina, 'privado'));
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.deepEqual(pagina.pedidosA('PUT', '/api/mi-espacio/eventos/12').map((p) => p.cuerpo), [{
      titulo: 'Reunión de equipo', fecha: '2026-10-27', desde: '10:00', hasta: '11:00', detalle: '', recordatorio: '2h', tipo: 'privado'
    }]);
    assert.equal(pagina.rutas().filter((ruta) => ruta === RUTA_DE_PERSONAS).length, 0);
  });

  it('un Público propio: «Editar evento» con su texto, «Todos» y la vista previa; uno con «Otro» y sus personas; el PUT', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conPublicos() });
    await pagina.iniciar();
    await abrirElEvento(pagina, '16');
    assert.equal(pagina.el('modal-evento-titulo').textContent, 'Editar evento');
    assert.deepEqual(tiposALaVista(pagina), [['privado', 'false', false], ['publico', 'true', false]]);
    assert.equal(pagina.el('ev-publico').hidden, false);
    assert.equal(textoDel(pagina, 'Trámite personal').getAttribute('aria-pressed'), 'true');
    assert.equal(pagina.el('ev-otro-grupo').hidden, true);
    assert.equal(pagina.el('ev-otro').value, '');
    assert.equal(personaDel(pagina, 'todos').getAttribute('aria-pressed'), 'true');
    assert.equal(pagina.el('ev-recordatorio').value, '1h');
    assert.equal(pagina.el('ev-vista-previa-dia').textContent, 'Vie 30');
    assert.equal(vistaPrevia(pagina), '10:00 Laura: Trámite personal');
    assert.equal(pagina.rutas().filter((ruta) => ruta === RUTA_DE_PERSONAS_DEL_PUBLICO).length, 1);
    await pagina.tecla('Escape');
    await abrirElEvento(pagina, '17', 'ag-proximos');
    assert.equal(textoDel(pagina, 'otro').getAttribute('aria-pressed'), 'true');
    assert.equal(pagina.el('ev-otro-grupo').hidden, false);
    assert.equal(pagina.el('ev-otro').value, 'Ayudo a mi hermana');
    assert.equal(pagina.el('ev-otro-cuenta').textContent, '18 de 60 caracteres');
    assert.deepEqual(['6', '9', 'todos'].map((valor) => personaDel(pagina, valor).getAttribute('aria-pressed')), ['true', 'true', 'false']);
    assert.equal(pagina.el('ev-personas-cuantas').textContent, '(2 personas)');
    assert.equal(vistaPrevia(pagina), '08:00 Laura: Ayudo a mi hermana');
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.deepEqual(pagina.pedidosA('PUT', '/api/mi-espacio/eventos/17').map((p) => p.cuerpo), [{
      titulo: 'Mudanza', fecha: '2026-11-05', desde: '08:00', hasta: null, detalle: '', recordatorio: '2h', tipo: 'publico', para_todos: false,
      personas: [6, 9], texto_publico: 'Ayudo a mi hermana'
    }]);
  });

  // Revisión de la Task 4: las personas que ya estaban en el evento son de su tipo. El servidor acepta a quien ya estaba solo si el
  // evento era de ese tipo: un lector de un Público, ofrecido en un Laboral, daría 400 «Solo podés compartirlo con las personas de la
  // lista.»
  const ofrecidas = (pagina) => pagina.el('ev-personas').querySelectorAll('[data-persona]').map((boton) => [boton.getAttribute('data-persona'),
    boton.getAttribute('aria-pressed')]);
  it('administración pasa un Público con un lector a Laboral: el lector no se ofrece; de vuelta al Público, está otra vez elegido', async () => {
    const pagina = montarPagina({ hash: '#agenda', admin: true, responder: conPublicos() });
    await pagina.iniciar();
    await abrirElEvento(pagina, '17', 'ag-proximos');
    assert.equal(personaDel(pagina, '9').getAttribute('aria-pressed'), 'true', 'Tomás, en el Público');
    await pagina.tocar(tipoDel(pagina, 'laboral'));
    assert.equal(personaDel(pagina, '9'), null, 'Tomás no es de administración: no se ofrece en el Laboral');
    assert.deepEqual(ofrecidas(pagina), [['todos', 'false'], ...PERSONAS_PARA_COMPARTIR.map(({ id }) => [String(id), 'false'])]);
    await pagina.tocar(tipoDel(pagina, 'publico'));
    assert.equal(personaDel(pagina, '9').getAttribute('aria-pressed'), 'true');
    assert.equal(personaDel(pagina, '6').getAttribute('aria-pressed'), 'true');
    assert.equal(pagina.el('ev-personas-cuantas').textContent, '(2 personas)');
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.deepEqual(pagina.pedidosA('PUT', '/api/mi-espacio/eventos/17').map((p) => p.cuerpo.personas), [[6, 9]]);
  });

  it('administración pasa un Laboral con una persona que ya no está en la lista a Público: no se ofrece; de vuelta al Laboral, sí', async () => {
    const conOtra = [...EVENTOS_DE_PRUEBA.filter((evento) => evento.id !== 12), eventoDe(12, 'Reunión de equipo', '2026-10-27', '10:00',
      { hasta: '11:00', compartido: 1, personas: [...CUATRO_PERSONAS, { id: 8, nombre: 'Persona de Prueba', sin_recordatorio: 0 }] })];
    const pagina = montarPagina({
      hash: '#agenda', admin: true,
      responder: conElFormulario({ eventos: { [RUTA_DEL_MES]: ok(respuestaDeEventos({ desde: '2026-09-28', hasta: '2026-11-01' }, { eventos: conOtra })) } })
    });
    await pagina.iniciar();
    await abrirElEvento(pagina, '12');
    assert.equal(personaDel(pagina, '8').getAttribute('aria-pressed'), 'true');
    await pagina.tocar(tipoDel(pagina, 'publico'));
    assert.equal(personaDel(pagina, '8'), null, 'no está en la lista de todos los usuarios activos: no se ofrece en el Público');
    assert.deepEqual(ofrecidas(pagina), [['todos', 'false'], ...PERSONAS_DEL_PUBLICO.map(({ id }) => [String(id), 'false'])]);
    await pagina.tocar(tipoDel(pagina, 'laboral'));
    assert.equal(personaDel(pagina, '8').getAttribute('aria-pressed'), 'true');
    assert.equal(pagina.el('ev-personas-cuantas').textContent, '(5 personas)');
  });

  it('un 400 del servidor en tipo va a «Tipo de evento»; en texto_publico, a las pastillas o a «Otro», con el foco', async () => {
    let contestar = respuesta(400, { success: false, error: MENSAJES_EVENTO.tipo, campo: 'tipo' });
    const pagina = montarPagina({ hash: '#agenda', responder: conElFormulario({ extra: (metodo) => (metodo === 'POST' ? contestar : undefined) }) });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    await pagina.escribir('ev-titulo', 'Control');
    await pagina.escribir('ev-desde', '10:00');
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.equal(pagina.el('ev-tipo-error').textContent, MENSAJES_EVENTO.tipo);
    assert.equal(pagina.el('ev-tipos').getAttribute('aria-invalid'), 'true');
    assert.equal(pagina.documento.activeElement, tipoDel(pagina, 'privado'));
    contestar = respuesta(400, { success: false, error: MENSAJES_EVENTO.textoPublicoLargo, campo: 'texto_publico' });
    await pagina.tocar(tipoDel(pagina, 'publico'));
    await pagina.tocar(textoDel(pagina, 'Turno médico'));
    await pagina.tocar(personaDel(pagina, 'todos'));
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.equal(pagina.el('ev-tipo-error').hidden, true);
    assert.equal(pagina.el('ev-texto-error').textContent, MENSAJES_EVENTO.textoPublicoLargo);
    assert.equal(pagina.el('ev-textos').getAttribute('aria-invalid'), 'true');
    assert.equal(pagina.documento.activeElement, textoDel(pagina, 'Trámite personal'));
    await pagina.tocar(textoDel(pagina, 'otro'));
    await pagina.escribir('ev-otro', 'Viaje');
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.equal(pagina.el('ev-texto-error').hidden, true);
    assert.equal(pagina.el('ev-otro-error').textContent, MENSAJES_EVENTO.textoPublicoLargo);
    assert.equal(pagina.el('ev-otro').getAttribute('aria-invalid'), 'true');
    assert.equal(pagina.documento.activeElement, pagina.el('ev-otro'));
    assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/eventos').length, 3);
  });

  it('sin la agenda cargada (desde el Resumen), la vista previa pide el nombre una sola vez; si no llega, «Tu nombre»', async () => {
    let falla = true;
    const pagina = montarPagina({
      responder: conElFormulario({ extra: (metodo, ruta) => (ruta === RUTA_DEL_NOMBRE && falla ? respuesta(500, { success: false, error: 'Error' }) : undefined) })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    await pagina.escribir('ev-desde', '10:00');
    assert.equal(pagina.rutas().filter((ruta) => ruta === RUTA_DEL_NOMBRE).length, 0, 'un Privado no lo pide');
    await pagina.tocar(tipoDel(pagina, 'publico'));
    assert.equal(vistaPrevia(pagina), '10:00 Tu nombre: …');
    await pagina.tecla('Escape');
    falla = false;
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    await pagina.escribir('ev-desde', '10:00');
    await pagina.tocar(tipoDel(pagina, 'publico'));
    assert.equal(vistaPrevia(pagina), '10:00 Laura: …');
    await pagina.tecla('Escape');
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    await pagina.tocar(tipoDel(pagina, 'publico'));
    assert.equal(vistaPrevia(pagina), 'Laura: …');
    assert.equal(pagina.rutas().filter((ruta) => ruta === RUTA_DEL_NOMBRE).length, 2);
  });
});

describe('el detalle de un evento ajeno en la página (DOM falso)', () => {
  it('cuándo es, quién lo creó, «Mi recordatorio» con el foco y «Solo quien lo creó puede cambiar el evento.»', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conElFormulario() });
    await pagina.iniciar();
    await abrirElEvento(pagina, '14', 'ag-proximos');
    assert.deepEqual(abiertos(pagina), ['modal-evento-ajeno']);
    const item = itemDe(14);
    const partes = M.htmlDelEventoAjeno(item);
    assert.equal(pagina.el('modal-evento-ajeno-titulo').textContent, 'Entrega del informe trimestral');
    assert.equal(pagina.el('mea-cuando').innerHTML, partes.cuando);
    assert.equal(pagina.el('mea-quien').innerHTML, partes.quien);
    assert.equal(pagina.el('mea-detalle').hidden, true, 'sin detalle');
    assert.equal(pagina.el('mea-recordatorio').innerHTML, partes.opciones);
    assert.equal(pagina.el('mea-recordatorio').value, 'evento');
    assert.equal(pagina.el('mea-aviso').textContent, item.aviso.texto);
    assert.equal(pagina.el('mea-aviso').hidden, false);
    assert.equal(pagina.el('mea-ayuda').textContent, 'Solo quien lo creó puede cambiar el evento.');
    assert.equal(pagina.documento.activeElement, pagina.el('mea-recordatorio'));
    // «Cerrar» lo cierra, con el foco de vuelta, sin pedir nada
    const antes = pagina.rutas().length;
    await pagina.tocar(pagina.el('mea-cerrar'));
    assert.deepEqual(abiertos(pagina), []);
    assert.equal(pagina.documento.activeElement, pagina.el('ag-proximos').querySelector('[data-evento="14"]'));
    assert.equal(pagina.rutas().length, antes);
  });

  // Un Personal (Público) de otra persona (spec 2026-10-29-mi-espacio-evento-publico, 5.3): su título («Carla: Fuera de la oficina»), cuándo
  // es, la insignia rosada y por qué se ve poco; sin «Mi recordatorio» (los que lo ven no tienen), con el foco en «Cerrar», y nada que
  // mandar. Un Laboral, después, vuelve a mostrar «Mi recordatorio»
  it('un Público de otra persona: su título, cuándo, la insignia y por qué se ve poco, sin «Mi recordatorio» y sin ningún PUT', async () => {
    const conCarla = (rango, mes) => ok(conLaFrase(respuestaDeEventos(rango, { eventos: [...EVENTOS_DE_PRUEBA, PUBLICO_DE_CARLA] }), mes));
    const pagina = montarPagina({
      hash: '#agenda',
      responder: conElFormulario({
        eventos: {
          [RUTA_DEL_MES]: conCarla({ desde: '2026-09-28', hasta: '2026-11-01' }, '2026-10'),
          [RUTA_DE_PROXIMOS]: conCarla({ desde: '2026-10-26', hasta: '2026-11-25' })
        }
      })
    });
    await pagina.iniciar();
    const boton = await abrirElEvento(pagina, '18');
    assert.deepEqual(abiertos(pagina), ['modal-evento-ajeno']);
    const partes = M.htmlDelEventoAjeno(itemDel(PUBLICO_DE_CARLA));
    assert.equal(pagina.el('modal-evento-ajeno-titulo').textContent, 'Carla: Fuera de la oficina');
    assert.equal(pagina.el('mea-cuando').innerHTML, partes.cuando);
    assert.equal(pagina.el('mea-quien').innerHTML, partes.quien);
    assert.equal(pagina.el('mea-detalle').hidden, true);
    assert.equal(pagina.el('mea-grupo-recordatorio').hidden, true);
    assert.equal(pagina.el('mea-aviso').hidden, true);
    assert.equal(pagina.documento.activeElement, pagina.el('mea-cerrar'));
    // Aunque al select oculto le llegara un cambio, no se manda nada
    await pagina.escribir('mea-recordatorio', 'evento', 'change');
    assert.deepEqual(pagina.estado.pedidos.filter((p) => p.metodo !== 'GET'), []);
    await pagina.tocar(pagina.el('mea-cerrar'));
    assert.deepEqual(abiertos(pagina), []);
    assert.equal(pagina.documento.activeElement, boton);
    assert.deepEqual(pagina.estado.pedidos.filter((p) => p.metodo !== 'GET'), []);
    // Un Laboral de otra persona, después: «Mi recordatorio» vuelve, con el foco
    await abrirElEvento(pagina, '14');
    assert.equal(pagina.el('modal-evento-ajeno-titulo').textContent, 'Entrega del informe trimestral');
    assert.equal(pagina.el('mea-grupo-recordatorio').hidden, false);
    assert.equal(pagina.el('mea-recordatorio').innerHTML, M.htmlDelEventoAjeno(itemDe(14)).opciones);
    assert.equal(pagina.documento.activeElement, pagina.el('mea-recordatorio'));
  });

  it('«Mi recordatorio» manda el PUT enseguida; al cerrar, se vuelve a pedir la agenda y el foco vuelve al evento', async () => {
    const respuestaDelPut = (sinAviso) => {
      const miRecordatorio = sinAviso ? 'ninguno' : '2h';
      return ok({ mi_recordatorio: miRecordatorio, aviso: avisoDe({ fecha: '2026-10-29', desde: '09:00', recordatorio: miRecordatorio },
        { ahora: AHORA, feriados: SIN_FERIADOS }) }, sinAviso ? 'Recordatorio apagado.' : 'Recordatorio prendido.');
    };
    const pagina = montarPagina({
      hash: '#agenda',
      responder: conElFormulario({
        extra: (metodo, ruta, cuerpo) => (metodo === 'PUT' && ruta === '/api/mi-espacio/eventos/14/mi-recordatorio'
          ? respuestaDelPut(cuerpo.sin_aviso) : undefined)
      })
    });
    await pagina.iniciar();
    await abrirElEvento(pagina, '14', 'ag-proximos');
    await pagina.escribir('mea-recordatorio', 'ninguno', 'change');
    assert.deepEqual(pagina.pedidosA('PUT', '/api/mi-espacio/eventos/14/mi-recordatorio').map((p) => p.cuerpo), [{ sin_aviso: true }]);
    assert.equal(pagina.el('me-anuncio').textContent, 'Recordatorio apagado.');
    assert.deepEqual(pagina.estado.toasts, [['Recordatorio apagado.', 'success']]);
    assert.equal(pagina.el('mea-aviso').hidden, true);
    assert.equal(pagina.el('mea-recordatorio').disabled, false);
    assert.equal(pagina.documento.activeElement, pagina.el('mea-recordatorio'));
    assert.deepEqual(abiertos(pagina), ['modal-evento-ajeno']);
    await pagina.escribir('mea-recordatorio', 'evento', 'change');
    assert.deepEqual(pagina.pedidosA('PUT', '/api/mi-espacio/eventos/14/mi-recordatorio').at(-1).cuerpo, { sin_aviso: false });
    assert.equal(pagina.el('mea-aviso').textContent, textoDelAvisoDe('2026-10-29', '09:00'));
    // Mientras está abierto no se vuelve a dibujar nada; al cerrarlo, sí, y el foco va al evento nuevo de los próximos
    const rangos = rangosPedidos(pagina).length;
    await pagina.tocar(pagina.el('mea-cerrar'));
    await pagina.esperar();
    assert.deepEqual(rangosPedidos(pagina).slice(rangos).sort(), [RUTA_DEL_MES, RUTA_DE_PROXIMOS]);
    assert.equal(pagina.documento.activeElement, pagina.el('ag-proximos').querySelector('[data-evento="14"]'));
  });

  it('si el PUT falla, el select vuelve a lo de antes y el error va a #mea-error', async () => {
    const pagina = montarPagina({
      hash: '#agenda',
      responder: conElFormulario({
        extra: (metodo, ruta) => (metodo === 'PUT' && ruta.endsWith('/mi-recordatorio')
          ? respuesta(500, { success: false, error: 'Error al cambiar tu recordatorio' }) : undefined)
      })
    });
    await pagina.iniciar();
    await abrirElEvento(pagina, '14');
    await pagina.escribir('mea-recordatorio', 'ninguno', 'change');
    assert.equal(pagina.el('mea-recordatorio').value, 'evento');
    assert.equal(pagina.el('mea-error').textContent, 'Error al cambiar tu recordatorio');
    assert.equal(pagina.el('mea-error').hidden, false);
    assert.equal(pagina.el('mea-aviso').hidden, false);
    assert.equal(pagina.documento.activeElement, pagina.el('mea-recordatorio'));
    assert.deepEqual(pagina.estado.toasts, []);
    // Al cerrar, como no cambió nada, no se vuelve a pedir la agenda
    const rangos = rangosPedidos(pagina).length;
    await pagina.tocar(pagina.el('mea-cerrar'));
    await pagina.esperar();
    assert.equal(rangosPedidos(pagina).length, rangos);
  });

  it('un 404 en «Mi recordatorio» cierra el detalle, lo avisa y vuelve a pedir la agenda', async () => {
    const pagina = montarPagina({
      hash: '#agenda',
      responder: conElFormulario({
        extra: (metodo, ruta) => (metodo === 'PUT' && ruta.endsWith('/mi-recordatorio')
          ? respuesta(404, { success: false, error: MENSAJES_EVENTO.noEncontrado }) : undefined)
      })
    });
    await pagina.iniciar();
    await abrirElEvento(pagina, '14');
    const rangos = rangosPedidos(pagina).length;
    await pagina.escribir('mea-recordatorio', 'ninguno', 'change');
    assert.deepEqual(abiertos(pagina), []);
    assert.deepEqual(pagina.estado.toasts, [[MENSAJES_EVENTO.noEncontrado, 'error']]);
    assert.deepEqual(rangosPedidos(pagina).slice(rangos).sort(), [RUTA_DEL_MES, RUTA_DE_PROXIMOS]);
  });

  it('un 404 después de un cambio de «Mi recordatorio» que salió bien vuelve a pedir la agenda una sola vez', async () => {
    let puts = 0;
    const pagina = montarPagina({
      hash: '#agenda',
      responder: conElFormulario({
        extra: (metodo, ruta) => {
          if (metodo !== 'PUT' || !ruta.endsWith('/mi-recordatorio')) return undefined;
          puts += 1;
          if (puts === 1) {
            return ok({ mi_recordatorio: 'ninguno', aviso: avisoDe({ fecha: '2026-10-29', desde: '09:00', recordatorio: 'ninguno' },
              { ahora: AHORA, feriados: SIN_FERIADOS }) }, 'Recordatorio apagado.');
          }
          return respuesta(404, { success: false, error: MENSAJES_EVENTO.noEncontrado });
        }
      })
    });
    await pagina.iniciar();
    await abrirElEvento(pagina, '14');
    await pagina.escribir('mea-recordatorio', 'ninguno', 'change');
    assert.deepEqual(abiertos(pagina), ['modal-evento-ajeno']);
    const rangos = rangosPedidos(pagina).length;
    await pagina.escribir('mea-recordatorio', 'evento', 'change');
    await pagina.esperar();
    assert.equal(puts, 2);
    assert.deepEqual(abiertos(pagina), []);
    // Una sola recarga: un pedido del mes y uno de los próximos (cerrar el detalle y el 404 no la piden dos veces)
    assert.deepEqual(rangosPedidos(pagina).slice(rangos).sort(), [RUTA_DEL_MES, RUTA_DE_PROXIMOS]);
  });
});

// La revisión de la Task 9: el mismo data-evento está en la grilla y en los próximos, y el de la grilla puede estar dentro de un
// «y N más» oculto. Después de guardar, el foco vuelve al del mismo lugar, salta los ocultos y, si uno no lo toma, prueba el siguiente
describe('el foco después de guardar un evento (DOM falso)', () => {
  // El 12 es un Laboral: lo guarda administración (el lector tendría que elegir otro tipo)
  it('guardado desde los próximos, el foco vuelve al de los próximos, no al de la grilla; desde la grilla, al de la grilla', async () => {
    const pagina = montarPagina({ hash: '#agenda', admin: true, responder: conElFormulario() });
    await pagina.iniciar();
    await abrirElEvento(pagina, '12', 'ag-proximos');
    await pagina.tocar(pagina.el('ev-guardar'));
    await pagina.esperar();
    assert.equal(pagina.documento.activeElement, pagina.el('ag-proximos').querySelector('[data-evento="12"]'));
    await abrirElEvento(pagina, '12');
    await pagina.tocar(pagina.el('ev-guardar'));
    await pagina.esperar();
    assert.equal(pagina.documento.activeElement, pagina.el('ag-mes').querySelector('[data-evento="12"]'));
  });

  it('guardado desde un «y N más» de la grilla, que se vuelve a dibujar oculto, el foco va al mismo evento en los próximos', async () => {
    const cuatro = [eventoDe(41, 'Primera', '2026-10-28', '08:00'), eventoDe(42, 'Segunda', '2026-10-28', '09:00'),
      eventoDe(43, 'Tercera', '2026-10-28', '10:00'), eventoDe(44, 'Cuarta', '2026-10-28', '11:00')];
    const datos = (rango) => ok(respuestaDeEventos(rango, { eventos: cuatro, licencias: [], ausencias: [] }));
    const pagina = montarPagina({
      hash: '#agenda',
      responder: conElFormulario({
        eventos: { [RUTA_DEL_MES]: datos({ desde: '2026-09-28', hasta: '2026-11-01' }), [RUTA_DE_PROXIMOS]: datos({ desde: '2026-10-26', hasta: '2026-11-25' }) }
      })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('ag-mes').querySelector('[data-ver-mas="2026-10-28"]'));
    const cuarta = pagina.el('ag-mes').querySelector('[data-evento="44"]');
    assert.equal(pagina.documento.activeElement, cuarta);
    await pagina.tocar(cuarta);
    await pagina.correr();
    await pagina.tocar(pagina.el('ev-guardar'));
    await pagina.esperar();
    assert.ok(M.estaOculto(pagina.el('ag-mes').querySelector('[data-evento="44"]')), 'el de la grilla quedó oculto');
    assert.equal(pagina.documento.activeElement, pagina.el('ag-proximos').querySelector('[data-evento="44"]'));
  });

  it('devolverElFoco: si un control no toma el foco, prueba el siguiente (el otro lugar y después el siguiente candidato)', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conElFormulario() });
    await pagina.iniciar();
    const respaldo = {
      vista: 'vista-agenda', candidatos: [{ atributo: 'data-evento', valor: '12', dentro: 'ag-proximos' }, { titulo: 'Próximos' }]
    };
    pagina.el('ag-proximos').querySelector('[data-evento="12"]').focus = () => {};
    pagina.contexto.devolverElFoco(respaldo);
    assert.equal(pagina.documento.activeElement, pagina.el('ag-mes').querySelector('[data-evento="12"]'));
    pagina.dom.activo = null;
    pagina.el('ag-mes').querySelector('[data-evento="12"]').focus = () => {};
    pagina.contexto.devolverElFoco(respaldo);
    assert.equal(pagina.documento.activeElement, pagina.el('ag-proximos-titulo'));
  });
});

// =====================================================================================================================================
// La agenda con más onda en la página (DOM falso; spec 2026-10-28-mi-espacio-agenda-onda, 3.2, 3.7, 3.8, 4.1 y 6): «Sábado y
// domingo» (apagado de entrada y recordado en este navegador), la frase del mes, tocar un día (en la compu, «Nuevo evento» con esa
// fecha; en el teléfono, elegirlo y ver lo de ese día debajo de la grilla), el teclado (el tabindex móvil de los números) y el
// movimiento de una sola vez. Hoy es el lunes 26/10/2026; los datos, los de la agenda de más arriba (noviembre, el de DE_NOVIEMBRE,
// con el feriado del domingo 8)
// =====================================================================================================================================

const RUTA_DE_NOVIEMBRE = '/api/mi-espacio/eventos?desde=2026-10-26&hasta=2026-12-06&mes=2026-11';
// El servidor falso del formulario, con noviembre de DE_NOVIEMBRE y su frase; `eventos`, otros cambios
const conNoviembre = (eventos = {}) => conElFormulario({
  eventos: { [RUTA_DE_NOVIEMBRE]: ok(conLaFrase(DE_NOVIEMBRE, '2026-11')), ...eventos }
});
// Las columnas de la grilla que se ve, el número y la celda de un día, los números con tabindex="0" y el título del día elegido
const columnasDelMes = (pagina) => pagina.el('ag-mes').querySelectorAll('th').length;
const numeroDelDia = (pagina, fecha) => pagina.el('ag-mes').querySelector(`[data-dia="${fecha}"]`);
const celdaDelDia = (pagina, fecha) => pagina.el('ag-mes').querySelector(`[data-fecha="${fecha}"]`);
const conTabindexCero = (pagina) => pagina.el('ag-mes').querySelectorAll('[data-dia]')
  .filter((numero) => numero.getAttribute('tabindex') === '0').map((numero) => numero.getAttribute('data-dia'));
const tituloDelElegido = (pagina) => pagina.el('ag-elegido-titulo')?.textContent ?? null;
// Una tecla en lo que tiene el foco (un número del mes), con sus modificadores: devuelve el evento, para mirar si se frenó
const teclaConEvento = async (pagina, key, extra = {}) => {
  const evento = pagina.documento.activeElement.disparar('keydown', { key, ...extra });
  await pagina.esperar();
  return evento;
};

describe('la agenda con más onda en la página (DOM falso)', () => {
  it('CLAVE_DEL_FIN_DE_SEMANA, y el foco vuelve al número de un día y al «Nuevo evento» del día elegido (IDENTIDADES_DEL_FOCO)', () => {
    assert.equal(M.CLAVE_DEL_FIN_DE_SEMANA, 'rpad-mi-espacio-fin-de-semana');
    assert.ok(M.IDENTIDADES_DEL_FOCO.includes('data-dia'));
    assert.ok(M.IDENTIDADES_DEL_FOCO.includes('data-nuevo-el'));
  });

  it('al abrir: «Sábado y domingo» apagado (5 columnas), la frase del servidor y el mes pedido con su mes; en noviembre, la cuenta', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conNoviembre() });
    await pagina.iniciar();
    // El pedido del mes lleva su mes; el de los próximos, no
    assert.deepEqual(rangosPedidos(pagina).sort(), [RUTA_DEL_MES, RUTA_DE_PROXIMOS]);
    assert.ok(RUTA_DEL_MES.endsWith('&mes=2026-10'));
    assert.equal(pagina.el('ag-finde').getAttribute('aria-pressed'), 'false');
    assert.equal(columnasDelMes(pagina), 5);
    // Octubre no tiene nada el fin de semana: sin la cuenta, y el nombre del botón es su texto
    assert.equal(pagina.el('ag-finde-cuenta').hidden, true);
    assert.equal(pagina.el('ag-finde').getAttribute('aria-label'), null);
    assert.equal(pagina.el('ag-frase').textContent, '4 eventos, 1 feriado y tu franquicia el 15.');
    // El día elegido (en la compu no se ve, pero está, con su título): hoy
    assert.equal(pagina.el('ag-elegido').innerHTML, M.htmlDelDiaElegido(HOY, DEL_MES, HOY));
    // Noviembre: el feriado del domingo 8 queda escondido
    await pagina.tocar(pagina.el('ag-siguiente'));
    assert.equal(pedidosDeEventos(pagina).at(-1), RUTA_DE_NOVIEMBRE);
    assert.equal(pagina.el('ag-finde-cuenta').hidden, false);
    assert.equal(pagina.el('ag-finde-cuenta').textContent, '1');
    assert.equal(pagina.el('ag-finde').getAttribute('aria-label'), 'Sábado y domingo: 1 cosa escondida');
    assert.equal(pagina.el('ag-frase').textContent, fraseDelMes({ mes: '2026-11', ...DE_NOVIEMBRE }));
    assert.equal(pagina.el('ag-mes').innerHTML, mesEnLaPagina('2026-11', DE_NOVIEMBRE, '2026-11-02'));
    assert.equal(tituloDelElegido(pagina), 'Lunes 2 de noviembre');
  });

  it('la frase del mes va como texto (con HTML, tal cual); sin frase o mientras se pide el mes, vacía; el día elegido, siempre con su título', async () => {
    let soltar;
    const tarda = new Promise((resolver) => { soltar = resolver; });
    const pagina = montarPagina({
      hash: '#agenda',
      responder: conElFormulario({
        eventos: {
          [RUTA_DEL_MES]: ok({ ...DEL_MES, frase_del_mes: MALICIOSO }),
          [RUTA_DE_NOVIEMBRE]: async () => { await tarda; return ok({ ...DE_NOVIEMBRE, frase_del_mes: null }); }
        }
      })
    });
    await pagina.iniciar();
    assert.equal(pagina.el('ag-frase').textContent, MALICIOSO);
    assert.equal(pagina.el('ag-frase').querySelector('img'), null);
    // Mientras se pide noviembre: sin frase, sin la cuenta, y el día elegido con su título (sin datos)
    await pagina.tocar(pagina.el('ag-siguiente'));
    assert.equal(pagina.el('ag-frase').textContent, '');
    assert.equal(pagina.el('ag-finde-cuenta').hidden, true);
    assert.equal(pagina.el('ag-elegido').innerHTML, M.htmlDelDiaElegido('2026-11-02', null, HOY));
    assert.equal(tituloDelElegido(pagina), 'Lunes 2 de noviembre');
    // Todavía no se sabe qué hay ese día: sin «No hay nada este día.» (Revisión final, 2)
    assert.doesNotMatch(pagina.el('ag-elegido').innerHTML, /me-vacio|No hay nada/);
    assert.ok(pagina.el('ag-elegido').querySelector('[data-nuevo-el="2026-11-02"]'));
    soltar();
    await pagina.esperar();
    assert.equal(pagina.el('ag-mes-titulo').textContent, 'Noviembre 2026');
    assert.equal(pagina.el('ag-frase').textContent, '');
    assert.equal(pagina.el('ag-finde-cuenta').textContent, '1');
  });

  it('«Sábado y domingo»: prendido, 7 columnas, sin la cuenta y recordado en este navegador; apagado, otra vez 5 y la cuenta', async () => {
    const almacen = new Map();
    const pagina = montarPagina({ hash: '#agenda', almacen, responder: conNoviembre() });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('ag-siguiente'));
    const boton = pagina.el('ag-finde');
    boton.focus();
    const antes = pagina.rutas().length;
    await pagina.tocar(boton);
    assert.equal(boton.getAttribute('aria-pressed'), 'true');
    assert.equal(columnasDelMes(pagina), 7);
    assert.equal(pagina.el('ag-finde-cuenta').hidden, true);
    assert.equal(boton.getAttribute('aria-label'), null);
    assert.equal(almacen.get('rpad-mi-espacio-fin-de-semana'), '1');
    assert.equal(pagina.el('ag-mes').innerHTML, mesEnLaPagina('2026-11', DE_NOVIEMBRE, '2026-11-02', { finde: true }));
    // No pide nada (el mes ya se pidió entero, de lunes a domingo) y el foco queda en el botón
    assert.equal(pagina.rutas().length, antes);
    assert.equal(pagina.documento.activeElement, boton);
    // Apagado otra vez
    await pagina.tocar(boton);
    assert.equal(boton.getAttribute('aria-pressed'), 'false');
    assert.equal(columnasDelMes(pagina), 5);
    assert.equal(pagina.el('ag-finde-cuenta').hidden, false);
    assert.equal(pagina.el('ag-finde-cuenta').textContent, '1');
    assert.equal(almacen.get('rpad-mi-espacio-fin-de-semana'), '0');
    // Prendido, y la página otra vez en el mismo navegador: arranca prendido
    await pagina.tocar(boton);
    const otra = montarPagina({ hash: '#agenda', almacen, responder: conNoviembre() });
    await otra.iniciar();
    assert.equal(otra.el('ag-finde').getAttribute('aria-pressed'), 'true');
    assert.equal(columnasDelMes(otra), 7);
    assert.equal(otra.el('ag-mes').innerHTML, mesEnLaPagina('2026-10', DEL_MES, HOY, { finde: true }));
  });

  it('sin almacenamiento (uno que tira o una ventana sin localStorage), «Sábado y domingo» arranca apagado, sin error, y anda igual', async () => {
    for (const almacen of ['tira', null]) {
      const pagina = montarPagina({ hash: '#agenda', almacen, responder: conElFormulario() });
      await pagina.iniciar();
      assert.equal(pagina.el('ag-finde').getAttribute('aria-pressed'), 'false', String(almacen));
      assert.equal(columnasDelMes(pagina), 5, String(almacen));
      await pagina.tocar(pagina.el('ag-finde'));
      assert.equal(pagina.el('ag-finde').getAttribute('aria-pressed'), 'true', String(almacen));
      assert.equal(columnasDelMes(pagina), 7, String(almacen));
    }
  });

  it('si el mes no se pudo cargar, «Sábado y domingo» lo vuelve a pedir (una grilla vacía no tapa el aviso); si vuelve a fallar, lo dice', async () => {
    let falla = true;
    const pagina = montarPagina({
      hash: '#agenda',
      responder: conElFormulario({
        eventos: { [RUTA_DEL_MES]: () => (falla ? respuesta(500, { success: false, error: 'Error' }) : ok(conLaFrase(DEL_MES, '2026-10'))) }
      })
    });
    await pagina.iniciar();
    assert.equal(textoDe(pagina.el('ag-mes').innerHTML), 'No se pudo cargar el mes. Probá de nuevo en unos minutos.');
    // Debajo, el día elegido con su título (nombra la sección) y sin «No hay nada este día.»: no se sabe (Revisión final, 2)
    assert.equal(tituloDelElegido(pagina), 'Lunes 26 de octubre (hoy)');
    assert.doesNotMatch(pagina.el('ag-elegido').innerHTML, /me-vacio|No hay nada/);
    const pedidosDelMes = () => rangosPedidos(pagina).filter((ruta) => ruta === RUTA_DEL_MES).length;
    await pagina.tocar(pagina.el('ag-finde'));
    assert.equal(pedidosDelMes(), 2);
    assert.equal(textoDe(pagina.el('ag-mes').innerHTML), 'No se pudo cargar el mes. Probá de nuevo en unos minutos.');
    falla = false;
    await pagina.tocar(pagina.el('ag-finde'));
    assert.equal(pedidosDelMes(), 3);
    assert.equal(pagina.el('ag-mes').innerHTML, mesEnLaPagina('2026-10', DEL_MES, HOY));
    // Con el mes a la vista, cambiar «Sábado y domingo» no pide nada
    await pagina.tocar(pagina.el('ag-finde'));
    assert.equal(pedidosDelMes(), 3);
    assert.equal(columnasDelMes(pagina), 7);
  });

  it('en la compu, tocar un día abre «Nuevo evento» con esa fecha (su cuerpo, una barra, un feriado o su número); al cerrar, el foco va a su número', async () => {
    const pagina = montarPagina({ hash: '#agenda', telefono: false, responder: conElFormulario() });
    await pagina.iniciar();
    assert.equal(numeroDelDia(pagina, '2026-10-22').getAttribute('aria-label'), 'Nuevo evento el jueves 22/10');
    // El jueves 22, en su cuerpo; el martes 27, en el pedazo de la barra del compañero que no está; el jueves 15, en el de tu
    // franquicia; el lunes 12, en su feriado; y el miércoles 28, en su número
    const casos = [['2026-10-22', '.me-celda-cuerpo'], ['2026-10-27', '.me-tira'], ['2026-10-15', '.me-tira'], ['2026-10-12', '.me-ev'],
      ['2026-10-28', '[data-dia]']];
    for (const [fecha, selector] of casos) {
      const blanco = celdaDelDia(pagina, fecha).querySelector(selector);
      assert.ok(blanco, `${fecha} ${selector}`);
      await pagina.tocar(blanco);
      assert.deepEqual(abiertos(pagina), ['modal-evento'], fecha);
      assert.equal(pagina.el('modal-evento-titulo').textContent, 'Nuevo evento', fecha);
      assert.equal(pagina.el('ev-fecha').value, fecha, fecha);
      await pagina.tecla('Escape');
      assert.deepEqual(abiertos(pagina), [], fecha);
      assert.equal(pagina.documento.activeElement, numeroDelDia(pagina, fecha), fecha);
      // Su número queda como la parada del teclado del mes
      assert.deepEqual(conTabindexCero(pagina), [fecha], fecha);
      // En la compu no se elige: ningún número con aria-current="true" y nada que anunciar (Revisión final, 3)
      assert.equal(pagina.el('ag-mes').querySelectorAll('[aria-current="true"]').length, 0, fecha);
      assert.doesNotMatch(pagina.el('me-anuncio').textContent, /de octubre/, fecha);
    }
    // Un evento de la celda abre el suyo; el día elegido no cambia (en la compu no se ve)
    await pagina.tocar(celdaDelDia(pagina, HOY).querySelector('[data-evento="11"]'));
    assert.deepEqual(abiertos(pagina), ['modal-evento']);
    assert.equal(pagina.el('modal-evento-titulo').textContent, 'Editar evento');
    await pagina.tecla('Escape');
    assert.equal(tituloDelElegido(pagina), 'Lunes 26 de octubre (hoy)');
    // Fuera de las celdas (la leyenda, la cabeza de la tabla), nada
    await pagina.tocar(pagina.el('vista-agenda').querySelector('.me-leyenda'));
    await pagina.tocar(pagina.el('ag-mes').querySelector('th'));
    assert.deepEqual(abiertos(pagina), []);
  });

  it('en la compu, después de guardar un evento abierto desde un número, el foco vuelve al número de esa fecha', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conElFormulario() });
    await pagina.iniciar();
    const numero = numeroDelDia(pagina, '2026-10-28');
    numero.focus();
    await pagina.tocar(numero);
    await pagina.correr();
    assert.equal(pagina.documento.activeElement, pagina.el('ev-titulo'));
    await pagina.escribir('ev-titulo', 'Revisión del informe');
    await pagina.escribir('ev-desde', '10:00');
    await pagina.tocar(pagina.el('ev-guardar'));
    await pagina.esperar();
    assert.deepEqual(pagina.pedidosA('POST', '/api/mi-espacio/eventos').map((pedido) => pedido.cuerpo.fecha), ['2026-10-28']);
    const nuevo = numeroDelDia(pagina, '2026-10-28');
    assert.notEqual(nuevo, numero, 'el mes se volvió a dibujar');
    assert.equal(pagina.documento.activeElement, nuevo);
    assert.deepEqual(conTabindexCero(pagina), ['2026-10-28']);
  });

  it('en el teléfono, tocar un día lo elige: su celda marcada y, debajo de la grilla, lo de ese día; no abre nada; «Hoy» vuelve a hoy', async () => {
    const pagina = montarPagina({ hash: '#agenda', telefono: true, responder: conElFormulario() });
    await pagina.iniciar();
    // Al abrir, el elegido es hoy, y los números dicen «Ver el …»
    assert.equal(pagina.el('ag-mes').innerHTML, mesEnLaPagina('2026-10', DEL_MES, HOY, { telefono: true }));
    assert.equal(pagina.el('ag-elegido').innerHTML, M.htmlDelDiaElegido(HOY, DEL_MES, HOY));
    assert.equal(numeroDelDia(pagina, '2026-10-22').getAttribute('aria-label'), 'Ver el jueves 22/10');
    assert.equal(numeroDelDia(pagina, HOY).getAttribute('aria-current'), 'true');
    assert.equal(celdaDelDia(pagina, HOY).getAttribute('aria-current'), 'date');
    // El jueves 29, en su cuerpo: lo elige, sin abrir nada ni pedir nada
    const antes = pagina.rutas().length;
    await pagina.tocar(celdaDelDia(pagina, '2026-10-29').querySelector('.me-celda-cuerpo'));
    assert.deepEqual(abiertos(pagina), []);
    assert.equal(pagina.rutas().length, antes);
    assert.ok(celdaDelDia(pagina, '2026-10-29').classList.contains('elegido'));
    assert.ok(!celdaDelDia(pagina, HOY).classList.contains('elegido'));
    assert.equal(pagina.el('ag-elegido').innerHTML, M.htmlDelDiaElegido('2026-10-29', DEL_MES, HOY));
    assert.deepEqual(conTabindexCero(pagina), ['2026-10-29']);
    // Para el lector de pantalla (Revisión final, 3): su número con aria-current="true" (solo ese) y el título del día, anunciado
    assert.deepEqual(pagina.el('ag-mes').querySelectorAll('[aria-current="true"]').map((numero) => numero.getAttribute('data-dia')), ['2026-10-29']);
    assert.equal(pagina.el('me-anuncio').textContent, 'Jueves 29 de octubre');
    // Con el teclado (Enter o Espacio en el número son su clic): lo elige y el foco queda en su número, que se volvió a dibujar
    const numero = numeroDelDia(pagina, '2026-10-22');
    numero.focus();
    await pagina.tocar(numero);
    assert.equal(tituloDelElegido(pagina), 'Jueves 22 de octubre');
    assert.equal(pagina.el('me-anuncio').textContent, 'Jueves 22 de octubre');
    assert.equal(numeroDelDia(pagina, '2026-10-22').getAttribute('aria-current'), 'true');
    assert.equal(numeroDelDia(pagina, '2026-10-29').getAttribute('aria-current'), null);
    assert.notEqual(numeroDelDia(pagina, '2026-10-22'), numero);
    assert.equal(pagina.documento.activeElement, numeroDelDia(pagina, '2026-10-22'));
    assert.deepEqual(conTabindexCero(pagina), ['2026-10-22']);
    // Un evento de la lista del día elegido se abre como en la grilla: el del 29, de otra persona, su detalle
    await pagina.tocar(celdaDelDia(pagina, '2026-10-29').querySelector('.me-celda-cuerpo'));
    await pagina.tocar(pagina.el('ag-elegido').querySelector('[data-evento="14"]'));
    assert.deepEqual(abiertos(pagina), ['modal-evento-ajeno']);
    await pagina.tecla('Escape');
    // «Hoy», en el mes de hoy, vuelve a elegir hoy, sin pedir nada
    await pagina.tocar(pagina.el('ag-hoy'));
    assert.equal(tituloDelElegido(pagina), 'Lunes 26 de octubre (hoy)');
    assert.deepEqual(conTabindexCero(pagina), [HOY]);
    assert.equal(pagina.rutas().length, antes);
  });

  it('en el teléfono, «Nuevo evento» del día elegido lo abre con esa fecha; al guardar, el foco vuelve a ese botón', async () => {
    const pagina = montarPagina({ hash: '#agenda', telefono: true, responder: conElFormulario() });
    await pagina.iniciar();
    await pagina.tocar(celdaDelDia(pagina, '2026-10-30').querySelector('.me-celda-cuerpo'));
    const boton = pagina.el('ag-elegido').querySelector('[data-nuevo-el]');
    assert.equal(boton.getAttribute('data-nuevo-el'), '2026-10-30');
    boton.focus();
    await pagina.tocar(boton);
    assert.deepEqual(abiertos(pagina), ['modal-evento']);
    assert.equal(pagina.el('modal-evento-titulo').textContent, 'Nuevo evento');
    assert.equal(pagina.el('ev-fecha').value, '2026-10-30');
    await pagina.correr();
    await pagina.escribir('ev-titulo', 'Cierre del mes');
    await pagina.escribir('ev-desde', '12:00');
    await pagina.tocar(pagina.el('ev-guardar'));
    await pagina.esperar();
    assert.deepEqual(pagina.pedidosA('POST', '/api/mi-espacio/eventos').map((pedido) => pedido.cuerpo.fecha), ['2026-10-30']);
    const nuevo = pagina.el('ag-elegido').querySelector('[data-nuevo-el="2026-10-30"]');
    assert.notEqual(nuevo, boton, 'el día elegido se volvió a dibujar');
    assert.equal(pagina.documento.activeElement, nuevo);
  });

  it('en el teléfono, con hoy sábado 31/10 y sábado y domingo ocultos, el elegido es el viernes 30; al prender y apagar, el más cercano que se ve', async () => {
    const pagina = montarPagina({ hash: '#agenda', telefono: true, responder: conNoviembre() });
    pagina.contexto.Utils.hoyEnArgentina = () => '2026-10-31';
    await pagina.iniciar();
    assert.equal(tituloDelElegido(pagina), 'Viernes 30 de octubre');
    assert.ok(celdaDelDia(pagina, '2026-10-30').classList.contains('elegido'));
    assert.deepEqual(conTabindexCero(pagina), ['2026-10-30']);
    // Con sábado y domingo, sigue el viernes 30; tocar el sábado lo elige
    await pagina.tocar(pagina.el('ag-finde'));
    assert.equal(tituloDelElegido(pagina), 'Viernes 30 de octubre');
    await pagina.tocar(celdaDelDia(pagina, '2026-10-31').querySelector('.me-celda-cuerpo'));
    assert.equal(tituloDelElegido(pagina), 'Sábado 31 de octubre (hoy)');
    assert.deepEqual(conTabindexCero(pagina), ['2026-10-31']);
    // Apagado: el sábado no se ve y no hay un día después en la grilla: el viernes 30, también el foco
    await pagina.tocar(pagina.el('ag-finde'));
    assert.equal(tituloDelElegido(pagina), 'Viernes 30 de octubre');
    assert.deepEqual(conTabindexCero(pagina), ['2026-10-30']);
    // Otro mes: el 1 (domingo, oculto): el lunes 2
    await pagina.tocar(pagina.el('ag-siguiente'));
    assert.equal(tituloDelElegido(pagina), 'Lunes 2 de noviembre');
    assert.deepEqual(conTabindexCero(pagina), ['2026-11-02']);
  });

  it('al pasar de la compu al teléfono (y al revés), el mes se vuelve a dibujar: los números dicen lo que hacen y el foco queda en el suyo', async () => {
    const pagina = montarPagina({ hash: '#agenda', telefono: false, responder: conElFormulario() });
    await pagina.iniciar();
    assert.equal(numeroDelDia(pagina, HOY).getAttribute('aria-label'), 'Nuevo evento el lunes 26/10');
    numeroDelDia(pagina, HOY).focus();
    await pagina.cambiarElAncho(true);
    assert.equal(numeroDelDia(pagina, HOY).getAttribute('aria-label'), 'Ver el lunes 26/10');
    assert.equal(pagina.documento.activeElement, numeroDelDia(pagina, HOY));
    // Tocar el martes 27 lo elige (y el foco, que estaba en el mes, va a su número)
    await pagina.tocar(numeroDelDia(pagina, '2026-10-27'));
    assert.deepEqual(abiertos(pagina), []);
    assert.equal(tituloDelElegido(pagina), 'Martes 27 de octubre');
    assert.equal(pagina.documento.activeElement, numeroDelDia(pagina, '2026-10-27'));
    await pagina.cambiarElAncho(false);
    assert.equal(numeroDelDia(pagina, '2026-10-27').getAttribute('aria-label'), 'Nuevo evento el martes 27/10');
    await pagina.tocar(numeroDelDia(pagina, '2026-10-27'));
    assert.deepEqual(abiertos(pagina), ['modal-evento']);
    assert.equal(pagina.el('ev-fecha').value, '2026-10-27');
  });

  it('el teclado: el mes es una sola parada (hoy); las flechas, Inicio y Fin mueven el tabindex="0" y el foco; en el borde, no se mueve', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conNoviembre() });
    await pagina.iniciar();
    assert.deepEqual(conTabindexCero(pagina), [HOY]);
    numeroDelDia(pagina, '2026-10-28').focus();
    let evento = await teclaConEvento(pagina, 'ArrowRight');
    assert.equal(evento.defaultPrevented, true);
    assert.deepEqual(conTabindexCero(pagina), ['2026-10-29']);
    assert.equal(pagina.documento.activeElement, numeroDelDia(pagina, '2026-10-29'));
    // Abajo no hay otra fila: no se mueve (y la flecha no desplaza la página)
    evento = await teclaConEvento(pagina, 'ArrowDown');
    assert.equal(evento.defaultPrevented, true);
    assert.equal(pagina.documento.activeElement, numeroDelDia(pagina, '2026-10-29'));
    const pasos = [['ArrowUp', '2026-10-22'], ['Home', '2026-10-19'], ['End', '2026-10-23'], ['ArrowRight', '2026-10-26'],
      ['ArrowLeft', '2026-10-23']];
    for (const [tecla, fecha] of pasos) {
      await teclaConEvento(pagina, tecla);
      assert.equal(pagina.documento.activeElement, numeroDelDia(pagina, fecha), tecla);
      assert.deepEqual(conTabindexCero(pagina), [fecha], tecla);
    }
    // El primero de la grilla: a la izquierda no hay nada (la parada pasa a él, que tiene el foco)
    numeroDelDia(pagina, '2026-09-28').focus();
    await teclaConEvento(pagina, 'ArrowLeft');
    assert.equal(pagina.documento.activeElement, numeroDelDia(pagina, '2026-09-28'));
    assert.deepEqual(conTabindexCero(pagina), ['2026-09-28']);
    // Con Alt, Ctrl o Cmd, u otra tecla, nada
    for (const extra of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      evento = await teclaConEvento(pagina, 'ArrowRight', extra);
      assert.equal(evento.defaultPrevented, false, JSON.stringify(extra));
      assert.equal(pagina.documento.activeElement, numeroDelDia(pagina, '2026-09-28'));
    }
    evento = await teclaConEvento(pagina, 'a');
    assert.equal(evento.defaultPrevented, false);
    assert.deepEqual(conTabindexCero(pagina), ['2026-09-28']);
    // La parada sigue donde quedó cuando el mes se vuelve a dibujar (con sábado y domingo)
    await teclaConEvento(pagina, 'ArrowDown');
    await pagina.tocar(pagina.el('ag-finde'));
    assert.deepEqual(conTabindexCero(pagina), ['2026-10-05']);
    // En noviembre, con sábado y domingo, el 28/10 está en la primera fila y abajo, el 04/11
    await pagina.tocar(pagina.el('ag-siguiente'));
    assert.deepEqual(conTabindexCero(pagina), ['2026-11-01']);
    numeroDelDia(pagina, '2026-10-28').focus();
    await teclaConEvento(pagina, 'ArrowDown');
    assert.equal(pagina.documento.activeElement, numeroDelDia(pagina, '2026-11-04'));
    assert.deepEqual(conTabindexCero(pagina), ['2026-11-04']);
    // Una tecla en un evento de la celda no mueve nada
    const otro = montarPagina({ hash: '#agenda', responder: conElFormulario() });
    await otro.iniciar();
    otro.el('ag-mes').querySelector('[data-evento="11"]').focus();
    evento = await teclaConEvento(otro, 'ArrowRight');
    assert.equal(evento.defaultPrevented, false);
    assert.deepEqual(conTabindexCero(otro), [HOY]);
  });

  it('el movimiento: la primera vez que el mes se dibuja y se ve, las barras con su --demora y data-animar, que se va dos cuadros después; una sola vez', async () => {
    const pagina = montarPagina({ hash: '#agenda', cuadros: true, responder: conNoviembre() });
    await pagina.iniciar();
    const mes = pagina.el('ag-mes');
    assert.equal(mes.getAttribute('data-animar'), '');
    assert.equal(mes.innerHTML, mesEnLaPagina('2026-10', DEL_MES, HOY, { animar: true }));
    assert.match(mes.innerHTML, /--demora:/);
    pagina.cuadro();
    assert.equal(mes.getAttribute('data-animar'), '');
    pagina.cuadro();
    assert.equal(mes.getAttribute('data-animar'), null);
    assert.equal(pagina.estado.cuadros.length, 0);
    // Otro mes, sábado y domingo, volver a pedir el mes (después de guardar) y volver a la pestaña: quietos
    const quieto = (paso) => {
      assert.equal(mes.getAttribute('data-animar'), null, paso);
      assert.doesNotMatch(mes.innerHTML, /--demora/, paso);
      assert.equal(pagina.estado.cuadros.length, 0, paso);
    };
    await pagina.tocar(pagina.el('ag-siguiente'));
    quieto('otro mes');
    await pagina.tocar(pagina.el('ag-finde'));
    quieto('sábado y domingo');
    await pagina.contexto.volverAPedirTodo();
    await pagina.esperar();
    quieto('después de guardar');
    await pagina.tocar(pagina.el('tab-licencias'));
    await pagina.tocar(pagina.el('tab-agenda'));
    quieto('de vuelta en la pestaña');
  });

  it('el movimiento espera a que el mes se vea: si llega con otra pestaña a la vista, se mueve al volver a la Agenda', async () => {
    let soltar;
    const tarda = new Promise((resolver) => { soltar = resolver; });
    const pagina = montarPagina({
      hash: '#agenda',
      cuadros: true,
      responder: conElFormulario({ eventos: { [RUTA_DEL_MES]: async () => { await tarda; return ok(conLaFrase(DEL_MES, '2026-10')); } } })
    });
    const inicio = pagina.contexto.iniciarMiEspacio();
    await pagina.esperar();
    await pagina.tocar(pagina.el('tab-licencias'));
    soltar();
    await inicio;
    await pagina.esperar();
    const mes = pagina.el('ag-mes');
    assert.equal(mes.getAttribute('data-animar'), null);
    assert.doesNotMatch(mes.innerHTML, /--demora/);
    assert.equal(pagina.estado.cuadros.length, 0);
    await pagina.tocar(pagina.el('tab-agenda'));
    assert.equal(mes.getAttribute('data-animar'), '');
    assert.match(mes.innerHTML, /--demora:/);
    pagina.cuadro();
    pagina.cuadro();
    assert.equal(mes.getAttribute('data-animar'), null);
  });

  it('sin movimiento con prefers-reduced-motion o sin requestAnimationFrame: el mes llega quieto', async () => {
    for (const opciones of [{ cuadros: true, reducido: true }, { cuadros: false }, { cuadros: true, reducido: true, telefono: true }]) {
      const pagina = montarPagina({ hash: '#agenda', ...opciones, responder: conElFormulario() });
      await pagina.iniciar();
      const mes = pagina.el('ag-mes');
      assert.equal(mes.getAttribute('data-animar'), null, JSON.stringify(opciones));
      assert.doesNotMatch(mes.innerHTML, /--demora/, JSON.stringify(opciones));
      assert.equal(pagina.estado.cuadros.length, 0, JSON.stringify(opciones));
    }
  });
});

// spec 2026-10-27-mi-espacio-licencia-word, 6: «Word» en la lista baja el Word con un fetch propio (el token en el encabezado) y
// descargarBlob, con el nombre del Content-Disposition
describe('«Word» en la lista de licencias (DOM falso)', () => {
  const DISPOSICION = 'attachment; filename="Nota de licencia - Atencion medica - 2026-11-05.docx"; '
    + "filename*=UTF-8''Nota%20de%20licencia%20-%20Atenci%C3%B3n%20m%C3%A9dica%20-%202026-11-05.docx";
  const CON_LA_SIETE = licenciasDe(PLANTA, { estado: conLicencias(PLANTA.estado, licencia(7, 'vacaciones', '2026-11-16', '2026-11-27')) });
  const RUTA_DEL_WORD = '/api/mi-espacio/licencias/7/word';
  // Lo que contesta el servidor falso con la licencia 7 en la lista; `word`, lo que contesta GET …/7/word (una función: puede
  // devolver una promesa que el test resuelve después)
  const conElWord = (word) => (metodo, ruta) => {
    if (metodo === 'GET' && ruta === '/api/mi-espacio/licencias') return ok(CON_LA_SIETE);
    if (metodo === 'GET' && ruta === RUTA_DEL_WORD) return word();
    return RESPUESTAS_DE_ENTRADA(metodo, ruta);
  };
  const botonWord = (pagina) => pagina.el('vista-licencias').querySelector('[data-word-licencia="7"]');
  // Monta la página en Licencias y toca «Word» de la licencia 7
  const tocarWord = async (word) => {
    const pagina = montarPagina({ hash: '#licencias', responder: conElWord(word) });
    await pagina.iniciar();
    const toastsAntes = pagina.estado.toasts.length;
    await pagina.tocar(botonWord(pagina));
    return { pagina, toasts: () => pagina.estado.toasts.slice(toastsAntes) };
  };

  it('pide GET …/7/word con el token en el encabezado, deshabilita el botón mientras baja y lo baja con el nombre con tildes', async () => {
    let soltar = null;
    const pagina = montarPagina({ hash: '#licencias', responder: conElWord(() => new Promise((resolver) => { soltar = resolver; })) });
    await pagina.iniciar();
    const boton = botonWord(pagina);
    boton.focus();
    await pagina.tocar(boton);
    const pedidos = pagina.pedidosA('GET', RUTA_DEL_WORD);
    assert.equal(pedidos.length, 1);
    assert.equal(pedidos[0].encabezados.Authorization, 'Bearer token-de-prueba');
    assert.equal(pedidos[0].cuerpo, undefined);
    assert.equal(boton.disabled, true);
    assert.deepEqual(pagina.estado.descargas, []);

    // Un segundo clic mientras baja no pide nada
    await pagina.tocar(boton);
    assert.equal(pagina.pedidosA('GET', RUTA_DEL_WORD).length, 1);

    const blob = new BlobFalso(['el .docx'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    soltar(archivo(blob, DISPOSICION));
    await pagina.esperar();
    assert.equal(boton.disabled, false);
    assert.equal(pagina.documento.activeElement, boton);
    assert.deepEqual(pagina.estado.urls, [['crear', blob]]);
    assert.deepEqual(pagina.estado.descargas,
      [{ etiqueta: 'a', href: 'blob:falso/1', download: 'Nota de licencia - Atención médica - 2026-11-05.docx' }]);
    // La URL se suelta después (un temporizador)
    await pagina.correr();
    assert.deepEqual(pagina.estado.urls.at(-1), ['soltar', 'blob:falso/1']);
    assert.equal(pagina.estado.sesionCerrada, false);
    // Nada que avisar: el nombre de la lista no cambia y no hay aviso
    assert.ok(!pagina.estado.toasts.some(([, tipo]) => tipo === 'error'));
  });

  it('sin Content-Disposition, «Nota de licencia.docx»', async () => {
    const { pagina } = await tocarWord(() => archivo(new BlobFalso(['x'])));
    assert.deepEqual(pagina.estado.descargas.map(({ download }) => download), ['Nota de licencia.docx']);
  });

  it('con un 401, al login, sin bajar nada ni avisar', async () => {
    const { pagina, toasts } = await tocarWord(() => respuesta(401, { success: false, error: 'Token expirado' }));
    assert.equal(pagina.estado.sesionCerrada, true);
    assert.equal(pagina.ventana.location.href, 'login.html');
    assert.deepEqual(pagina.estado.descargas, []);
    assert.deepEqual(toasts(), []);
  });

  it('un 409 avisa su mensaje (escapado en el aviso, tal cual en #me-anuncio) y el botón vuelve a andar', async () => {
    const mensaje = 'Entre esas fechas ya no hay ningún día hábil: corregí la licencia para bajar la nota.';
    const { pagina, toasts } = await tocarWord(() => respuesta(409, { success: false, error: mensaje }));
    assert.deepEqual(toasts(), [[mensaje, 'error']]);
    assert.equal(pagina.el('me-anuncio').textContent, mensaje);
    assert.equal(botonWord(pagina).disabled, false);
    assert.deepEqual(pagina.estado.descargas, []);
    assert.equal(pagina.estado.sesionCerrada, false);

    const conHtml = await tocarWord(() => respuesta(404, { success: false, error: MALICIOSO }));
    assert.deepEqual(conHtml.toasts(), [[ESCAPADO, 'error']]);
  });

  it('un error sin mensaje, una respuesta que no es JSON o un pedido que no llega: el mensaje de la página', async () => {
    const fallas = [
      () => respuesta(500, { success: false }),
      () => respuesta(500, undefined),
      () => respuesta(502, { success: false, error: '' }),
      () => { throw new TypeError('Failed to fetch'); }
    ];
    for (const falla of fallas) {
      const { pagina, toasts } = await tocarWord(falla);
      assert.deepEqual(toasts(), [[M.MENSAJE_SIN_DESCARGA, 'error']], String(falla));
      assert.equal(botonWord(pagina).disabled, false);
      assert.deepEqual(pagina.estado.descargas, []);
    }
  });

  it('bajarWordDeLicencia también anda con un botón fuera de la lista (el del segundo paso)', async () => {
    const pagina = montarPagina({ hash: '#licencias', responder: conElWord(() => archivo(new BlobFalso(['x']), DISPOSICION)) });
    await pagina.iniciar();
    const boton = pagina.documento.createElement('button');
    await pagina.contexto.bajarWordDeLicencia(7, boton);
    assert.equal(pagina.pedidosA('GET', RUTA_DEL_WORD).length, 1);
    assert.equal(boton.disabled, false);
    assert.deepEqual(pagina.estado.descargas.map(({ download }) => download), ['Nota de licencia - Atención médica - 2026-11-05.docx']);
  });

  // El navegador suelta el foco de un botón que se deshabilita (queda en <body>): al terminar, vuelve a él. Pero si mientras bajaba la
  // persona llevó el foco a otro lado (otro control, o el modal que abrió), ahí queda: la descarga no se lo saca
  it('al terminar, el foco vuelve al botón solo si se perdió mientras bajaba; si la persona lo llevó a otro lado, ahí queda', async () => {
    const pendientes = [];
    const pagina = montarPagina({ hash: '#licencias', responder: conElWord(() => new Promise((resolver) => { pendientes.push(resolver); })) });
    await pagina.iniciar();
    const soltarUna = async () => {
      assert.equal(pendientes.length, 1, 'una descarga en vuelo');
      pendientes.shift()(archivo(new BlobFalso(['x']), DISPOSICION));
      await pagina.esperar();
    };

    // Se perdió: vuelve al botón
    botonWord(pagina).focus();
    await pagina.tocar(botonWord(pagina));
    pagina.dom.activo = null;
    await soltarUna();
    assert.equal(pagina.documento.activeElement, botonWord(pagina));

    // La persona lo llevó a otra pestaña: ahí queda
    await pagina.tocar(botonWord(pagina));
    const pestana = pagina.el('tab-resumen');
    pestana.focus();
    await soltarUna();
    assert.equal(pagina.documento.activeElement, pestana);
    assert.equal(botonWord(pagina).disabled, false);

    // Abrió «Cargar licencia» mientras bajaba: el foco queda en el modal
    botonWord(pagina).focus();
    await pagina.tocar(botonWord(pagina));
    await pagina.tocar(pagina.el('btn-cargar-licencia'));
    await pagina.correr();
    const enElModal = pagina.documento.activeElement;
    assert.equal(enElModal, pagina.el('ml-tipos').querySelector('input'));
    await soltarUna();
    assert.equal(pagina.documento.activeElement, enElModal);
    assert.equal(pagina.estado.descargas.length, 3);
  });
});

// =====================================================================================================================================
// El segundo paso de «Cargar licencia» (spec 2026-10-27-mi-espacio-licencia-word, 6; maqueta, versión C, «La nota a la vista»): al
// guardar una licencia, el modal no se cierra: muestra la licencia guardada, la nota a la vista (GET …/nota) y «Descargar Word»
// =====================================================================================================================================

// Las vacaciones nuevas de cargarLicencia (VACACIONES), guardadas con el id 9, y su nota como la arma el servidor
const CON_LA_NUEVE = conLicencias(PLANTA.estado, licencia(9, 'vacaciones', VACACIONES.desde, VACACIONES.hasta));
const NOTA_DE_LA_NUEVE = respuestaDeLaNota(CON_LA_NUEVE, 9);
const NOTA_DE_LA_SEIS = respuestaDeLaNota(PLANTA.estado, 6);
const RUTA_DE_LA_NUEVE = '/api/mi-espacio/licencias/9/nota';
const ALTA_DE_LA_NUEVE = respuesta(201, { success: true, data: { id: 9 }, message: 'Licencia cargada.' });
const MENSAJE_SIN_VISTA = 'La licencia quedó guardada, pero no se pudo armar la vista de la nota. Probá «Descargar Word» o bajala '
  + 'después con «Word» en la lista.';
const ANUNCIO_DEL_ALTA = 'Licencia cargada. Podés descargar la nota en Word.';
const DISPOSICION_DE_LA_NUEVE = 'attachment; filename="Nota de licencia - Licencia anual ordinaria - 2026-11-16.docx"; '
  + "filename*=UTF-8''Nota%20de%20licencia%20-%20Licencia%20anual%20ordinaria%20-%202026-11-16.docx";

describe('el segundo paso de «Cargar licencia»: lo puro', () => {
  it('los textos: el título, el anuncio con los avisos, «Armando la nota…» y el de la vista que no se pudo armar', () => {
    assert.equal(M.tituloDelSegundoPaso(false), 'Licencia cargada');
    assert.equal(M.tituloDelSegundoPaso(true), 'Licencia corregida');
    assert.equal(M.anuncioDelSegundoPaso(false, []), ANUNCIO_DEL_ALTA);
    assert.equal(M.anuncioDelSegundoPaso(false, undefined), ANUNCIO_DEL_ALTA);
    // Los avisos, después; lo que no es un texto con algo, no
    assert.equal(M.anuncioDelSegundoPaso(true, [TEXTO_NO_SE_COPIA, '', '  ', null, 3]),
      `Licencia corregida. Podés descargar la nota en Word. ${TEXTO_NO_SE_COPIA}`);
    assert.equal(M.TEXTO_ARMANDO_LA_NOTA, 'Armando la nota…');
    assert.equal(M.MENSAJE_SIN_VISTA, MENSAJE_SIN_VISTA);
  });

  it('htmlDelSegundoPaso: la licencia con su tilde, la insignia, las fechas y lo que suman, y en gris lo demás; «Así sale la nota», la aclaración y la hoja tal cual', () => {
    const { fila, html: hoja, aclaracion } = NOTA_DE_LA_NUEVE;
    const html = M.htmlDelSegundoPaso({ ...NOTA_DE_LA_NUEVE, avisos: [] });
    assert.ok(fila.de_licencias_texto && fila.mostrar_texto && !fila.configuracion, 'la fila de prueba trae los dos textos, sin Configuración');
    assert.equal(html, '<div class="me-paso-dos-hecho"><span class="me-tilde" aria-hidden="true">'
      + `${M.TILDE_DEL_SEGUNDO_PASO}</span><div class="me-paso-dos-licencia"><p class="me-paso-dos-linea">`
      + '<span class="me-insignia azul">Vacaciones</span><b class="me-paso-dos-fechas">16/11 al 20/11/2026</b>'
      + `<span class="me-paso-dos-cantidad">${fila.cantidad_texto}</span></p>`
      + `<p class="me-paso-dos-detalle"><span>${fila.de_licencias_texto}</span> <span>${fila.mostrar_texto}</span></p></div></div>`
      + '<h3 class="me-paso-dos-titulo">Así sale la nota</h3>'
      + `<p class="me-paso-dos-ayuda">${aclaracion}</p>`
      + `<div class="me-mesa">${hoja}</div>`);
    // La tilde es decorativa: lo dice el título del modal
    assert.match(M.TILDE_DEL_SEGUNDO_PASO, /^<svg [^>]*aria-hidden="true"[^>]*>/);
    // La hoja del servidor, tal cual: los renglones vacíos son <p></p>
    assert.ok(hoja.startsWith('<div class="me-hoja"><div class="me-hoja-texto"><p class="derecha">'));
    assert.ok(hoja.includes('<p></p>'));
  });

  it('htmlDelSegundoPaso: lo de Configuración va en gris, también con algo para revisar; la insignia, con el color de su tipo', () => {
    const fila = { ...NOTA_DE_LA_NUEVE.fila, tipo: 'medica', tipo_nombre: 'Médica', de_licencias_texto: '',
      configuracion: { texto: 'En Configuración: cargada.', insignia: 'aviso' }, mostrar_texto: '' };
    const html = M.htmlDelSegundoPaso({ fila, html: '<p>x</p>', aclaracion: '', avisos: [] });
    assert.ok(html.includes('<span class="me-insignia rojo">Médica</span>'));
    assert.ok(html.includes('<p class="me-paso-dos-detalle"><span>En Configuración: cargada.</span></p>'));
    assert.doesNotMatch(html, /me-detalle-aviso|ambar/);
    assert.ok(M.htmlDelSegundoPaso({ fila: { ...fila, tipo: 'otro' }, html: '' }).includes('<span class="me-insignia gris">'));
  });

  it('htmlDelSegundoPaso: los avisos, en un recuadro ámbar arriba de todo; todo texto del servidor escapado, salvo la hoja', () => {
    const fila = {
      tipo: 'vacaciones', tipo_nombre: MALICIOSO, fechas_texto: MALICIOSO, cantidad_texto: MALICIOSO, de_licencias_texto: MALICIOSO,
      configuracion: { texto: MALICIOSO, insignia: 'aviso' }, mostrar_texto: MALICIOSO
    };
    const hoja = '<div class="me-hoja"><div class="me-hoja-texto"><p>Tal cual</p><p></p></div></div>';
    const html = M.htmlDelSegundoPaso({ fila, html: hoja, aclaracion: MALICIOSO, avisos: [TEXTO_NO_SE_COPIA, MALICIOSO, ''] });
    assert.ok(html.startsWith(`<div class="me-recuadro ambar"><p>${TEXTO_NO_SE_COPIA}</p><p>${ESCAPADO}</p></div>`
      + '<div class="me-paso-dos-hecho">'));
    assert.ok(!html.includes(MALICIOSO));
    // El aviso, el tipo, las fechas, lo que suman, los tres detalles y la aclaración
    assert.equal(html.split(ESCAPADO).length - 1, 8);
    assert.ok(html.endsWith(`<div class="me-mesa">${hoja}</div>`));
  });

  it('htmlDelSegundoPaso tolera lo que falta: sin fila ni aclaración, sin avisos que sean una lista, sin hoja; nunca tira', () => {
    assert.equal(M.htmlDelSegundoPaso({ fila: null, html: '<p>x</p>', aclaracion: '', avisos: 'no es una lista' }),
      '<h3 class="me-paso-dos-titulo">Así sale la nota</h3><div class="me-mesa"><p>x</p></div>');
    assert.equal(M.htmlDelSegundoPaso({ fila: 'una fila', html: 12, aclaracion: 3 }),
      '<h3 class="me-paso-dos-titulo">Así sale la nota</h3><div class="me-mesa"></div>');
    assert.equal(M.htmlDelSegundoPaso(), '<h3 class="me-paso-dos-titulo">Así sale la nota</h3><div class="me-mesa"></div>');
    sinNumerosRaros(M.htmlDelSegundoPaso({ fila: { tipo: 'vacaciones' }, html: '' }), 'una fila sin textos');
  });
});

// Lo que contesta el servidor falso para guardar las vacaciones nuevas (la 9): el alta y, en `nota`, lo que contesta GET …/9/nota
// (una función: puede devolver una promesa que el test resuelve después; sin ella, la del servidor falso); `extra`, como en
// conFormularios
const conElAlta = ({ nota, extra = () => undefined } = {}) => conFormularios({
  extra: (metodo, ruta, cuerpo) => {
    const propia = extra(metodo, ruta, cuerpo);
    if (propia !== undefined) return propia;
    if (metodo === 'POST' && ruta === '/api/mi-espacio/licencias') return ALTA_DE_LA_NUEVE;
    if (nota && metodo === 'GET' && ruta === RUTA_DE_LA_NUEVE) return nota();
    return undefined;
  }
});
// Lo que se ve del modal de la licencia: abierto, el título y cuáles de sus partes están ocultas (el cuerpo y el pie del formulario,
// y los del segundo paso)
const delModal = (pagina) => ({
  abierto: pagina.abierto('modal-licencia'), titulo: pagina.el('modal-licencia-titulo').textContent,
  ocultos: ['ml-cuerpo', 'ml-pie-del-formulario', 'ml-paso-dos', 'ml-paso-dos-pie'].filter((id) => pagina.el(id).hidden)
});
const EN_EL_SEGUNDO_PASO = (titulo = 'Licencia cargada') => ({ abierto: true, titulo, ocultos: ['ml-cuerpo', 'ml-pie-del-formulario'] });
const listo = (pagina) => pagina.el('ml-paso-dos-pie').querySelector('[data-cerrar]');
const esperandoLaNota = (avisos = '') => `${avisos}<p class="me-aviso me-aviso-gris">Armando la nota…</p>`;
const sinVista = (avisos = '') => `${avisos}<p class="me-aviso me-aviso-error">${MENSAJE_SIN_VISTA}</p>`;
// Una promesa que el test resuelve después, con su resolver
const demorada = () => {
  let soltar;
  const promesa = new Promise((resolver) => { soltar = resolver; });
  return { promesa, soltar: (valor) => soltar(valor) };
};

describe('el segundo paso de «Cargar licencia» (DOM falso)', () => {
  it('al guardar una nueva (POST 201) el modal no se cierra: «Licencia cargada», «Armando la nota…» hasta que llega GET …/9/nota, y después la licencia y la hoja', async () => {
    const nota = demorada();
    const pagina = montarPagina({ responder: conElAlta({ nota: () => nota.promesa }) });
    await pagina.iniciar();
    await cargarLicencia(pagina);
    const resumenes = pagina.rutas().filter((ruta) => ruta === '/api/mi-espacio/resumen').length;
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.deepEqual(delModal(pagina), EN_EL_SEGUNDO_PASO());
    assert.equal(pagina.el('ml-paso-dos').innerHTML, esperandoLaNota());
    // Pide la nota, con el token en el encabezado, y la página vuelve a pedir todo de fondo
    const pedidos = pagina.pedidosA('GET', RUTA_DE_LA_NUEVE);
    assert.equal(pedidos.length, 1);
    assert.equal(pedidos[0].encabezados.Authorization, 'Bearer token-de-prueba');
    assert.equal(pagina.rutas().filter((ruta) => ruta === '/api/mi-espacio/resumen').length, resumenes + 1);
    // El foco, en «Descargar Word»; lo que se guardó se anuncia, sin aviso flotante
    assert.equal(pagina.documento.activeElement, pagina.el('ml-descargar-word'));
    assert.equal(pagina.el('me-anuncio').textContent, ANUNCIO_DEL_ALTA);
    assert.deepEqual(pagina.estado.toasts, []);

    nota.soltar(ok(NOTA_DE_LA_NUEVE));
    await pagina.esperar();
    const cuerpo = pagina.el('ml-paso-dos');
    assert.equal(cuerpo.innerHTML, M.htmlDelSegundoPaso({ ...NOTA_DE_LA_NUEVE, avisos: [] }));
    assert.equal(cuerpo.querySelector('.me-insignia').textContent, 'Vacaciones');
    assert.equal(cuerpo.querySelector('.me-paso-dos-fechas').textContent, '16/11 al 20/11/2026');
    assert.equal(cuerpo.querySelector('.me-paso-dos-ayuda').textContent, NOTA_DE_LA_NUEVE.aclaracion);
    assert.ok(cuerpo.querySelector('.me-mesa .me-hoja .me-hoja-texto'), 'la hoja del servidor');
    assert.deepEqual(delModal(pagina), EN_EL_SEGUNDO_PASO());
    assert.equal(pagina.documento.activeElement, pagina.el('ml-descargar-word'));
    assert.deepEqual(pagina.estado.toasts, []);

    // El formulario terminó: nada que siga calculando, y «Escape» no está bloqueado por un guardado
    const antes = calculos(pagina).length;
    await pagina.correr();
    assert.equal(calculos(pagina).length, antes);
    assert.equal(vm.runInContext('pagina.formulario', pagina.contexto), null);
  });

  it('la corrección (PUT 200) con un aviso: «Licencia corregida», el aviso en un recuadro ámbar (también mientras llega la nota) y en #me-anuncio', async () => {
    const nota = demorada();
    const pagina = montarPagina({
      hash: '#licencias',
      responder: conFormularios({
        extra: (metodo, ruta) => {
          if (metodo === 'PUT') {
            return respuesta(200, { success: true, data: { id: 6 }, message: 'Licencia corregida.', avisos: [TEXTO_NO_SE_COPIA] });
          }
          return metodo === 'GET' && ruta === '/api/mi-espacio/licencias/6/nota' ? nota.promesa : undefined;
        }
      })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-licencias').querySelector('[data-editar-licencia="6"]'));
    await pagina.correr();
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.deepEqual(delModal(pagina), EN_EL_SEGUNDO_PASO('Licencia corregida'));
    const recuadro = `<div class="me-recuadro ambar"><p>${TEXTO_NO_SE_COPIA}</p></div>`;
    assert.equal(pagina.el('ml-paso-dos').innerHTML, esperandoLaNota(recuadro));
    assert.equal(pagina.el('me-anuncio').textContent, `Licencia corregida. Podés descargar la nota en Word. ${TEXTO_NO_SE_COPIA}`);
    assert.deepEqual(pagina.estado.toasts, []);
    nota.soltar(ok(NOTA_DE_LA_SEIS));
    await pagina.esperar();
    assert.equal(pagina.el('ml-paso-dos').innerHTML, M.htmlDelSegundoPaso({ ...NOTA_DE_LA_SEIS, avisos: [TEXTO_NO_SE_COPIA] }));
    assert.ok(pagina.el('ml-paso-dos').innerHTML.startsWith(recuadro));
    assert.equal(pagina.pedidosA('GET', '/api/mi-espacio/licencias/6/nota').length, 1);
  });

  // Desde la licencia anulada en Configuración (spec 2026-10-28-mi-espacio-licencia-anulada, 2.3), la lista pasa a 2027 (acá el
  // servidor falso no la tiene: la lista dice que no se pudo cargar), pero el segundo paso no depende de ella
  it('otro año: una licencia de 2027 se ve igual aunque la lista no la tenga (la fila viene de …/nota), con «Está en la lista de 2027.»', async () => {
    const pagina = montarPagina({
      hash: '#licencias',
      responder: conFormularios({
        extra: (metodo, ruta) => (metodo === 'POST' && ruta === '/api/mi-espacio/licencias'
          ? respuesta(201, { success: true, data: { id: 10 }, message: 'Licencia cargada.' }) : undefined)
      })
    });
    await pagina.iniciar();
    await cargarLicencia(pagina, { desde: '2027-02-01', hasta: '2027-02-05' });
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.equal(pagina.pedidosA('GET', '/api/mi-espacio/licencias?anio=2027').length, 1, 'la lista se pide en 2027');
    assert.equal(pagina.el('vista-licencias').querySelector('[data-editar-licencia="10"]'), null, 'la lista no la tiene');
    const nota = respuestaDeLaNota(conLicencias(PLANTA.estado, licencia(10, 'vacaciones', '2027-02-01', '2027-02-05')), 10);
    assert.equal(nota.fila.fechas_texto, '01/02 al 05/02/2027');
    assert.equal(nota.lista, 'Está en la lista de 2027.');
    assert.equal(pagina.el('ml-paso-dos').innerHTML, M.htmlDelSegundoPaso({ ...nota, avisos: [] }));
    assert.equal(pagina.el('ml-paso-dos').querySelector('.me-paso-dos-fechas').textContent, '01/02 al 05/02/2027');
    assert.equal(pagina.el('ml-paso-dos').querySelector('.me-paso-dos-lista').textContent, 'Está en la lista de 2027.');
  });

  it('«Listo», la × y Escape cierran; al volver a abrir «Cargar licencia» está el formulario', async () => {
    const cerrar = {
      listo: (pagina) => pagina.tocar(listo(pagina)),
      cruz: (pagina) => pagina.tocar(pagina.el('modal-licencia').querySelector('.modal-close')),
      escape: (pagina) => pagina.tecla('Escape')
    };
    for (const [como, hacer] of Object.entries(cerrar)) {
      const pagina = montarPagina({ responder: conElAlta() });
      await pagina.iniciar();
      await cargarLicencia(pagina);
      await pagina.tocar(pagina.el('ml-guardar'));
      assert.deepEqual(delModal(pagina), EN_EL_SEGUNDO_PASO(), como);
      await hacer(pagina);
      assert.equal(pagina.abierto('modal-licencia'), false, como);
      assert.equal(pagina.el('ml-paso-dos').innerHTML, '', como);
      // Desde el encabezado: el foco vuelve a «Cargar licencia»
      assert.equal(pagina.documento.activeElement, pagina.el('btn-cargar-licencia'), como);
      await pagina.tocar(pagina.el('btn-cargar-licencia'));
      await pagina.correr();
      assert.deepEqual(delModal(pagina), { abierto: true, titulo: 'Cargar licencia', ocultos: ['ml-paso-dos', 'ml-paso-dos-pie'] }, como);
      assert.equal(pagina.el('ml-guardar').disabled, false, como);
      assert.equal(pagina.documento.activeElement, pagina.el('ml-tipos').querySelector('input'), como);
    }
  });

  it('una respuesta de …/nota que llega con el modal cerrado, o después de otro guardado, no pinta nada', async () => {
    const notas = [];
    const pagina = montarPagina({ responder: conElAlta({ nota: () => { const una = demorada(); notas.push(una); return una.promesa; } }) });
    await pagina.iniciar();
    const guardar = async () => {
      await cargarLicencia(pagina);
      await pagina.tocar(pagina.el('ml-guardar'));
      assert.equal(pagina.el('ml-paso-dos').innerHTML, esperandoLaNota());
    };

    // Con el modal cerrado: nada
    await guardar();
    await pagina.tocar(listo(pagina));
    notas[0].soltar(ok(NOTA_DE_LA_NUEVE));
    await pagina.esperar();
    assert.equal(pagina.el('ml-paso-dos').innerHTML, '');
    assert.equal(pagina.el('ml-paso-dos').hidden, true);

    // Después de otro guardado: ni la nota ni la falla de la anterior
    await guardar();
    await pagina.tocar(listo(pagina));
    await guardar();
    notas[1].soltar(respuesta(500, { success: false, error: 'Error al armar la nota' }));
    await pagina.esperar();
    assert.equal(pagina.el('ml-paso-dos').innerHTML, esperandoLaNota());
    assert.equal(pagina.el('me-anuncio').textContent.trim(), ANUNCIO_DEL_ALTA);
    notas[2].soltar(ok(NOTA_DE_LA_NUEVE));
    await pagina.esperar();
    assert.equal(pagina.el('ml-paso-dos').innerHTML, M.htmlDelSegundoPaso({ ...NOTA_DE_LA_NUEVE, avisos: [] }));
    assert.equal(notas.length, 3);
  });

  it('si …/nota falla: MENSAJE_SIN_VISTA (anunciado) y «Descargar Word» sigue andando; con un 401, al login', async () => {
    const fallas = [
      () => respuesta(500, { success: false, error: 'Error al armar la nota' }),
      () => respuesta(404, { success: false, error: 'Licencia no encontrada' }),
      () => ok({ fila: NOTA_DE_LA_NUEVE.fila, html: '', fecha: HOY, aclaracion: '' }),
      () => { throw new TypeError('Failed to fetch'); }
    ];
    for (const falla of fallas) {
      const pagina = montarPagina({
        responder: conElAlta({
          nota: falla,
          extra: (metodo, ruta) => (ruta === '/api/mi-espacio/licencias/9/word' ? archivo(new BlobFalso(['x']), DISPOSICION_DE_LA_NUEVE) : undefined)
        })
      });
      await pagina.iniciar();
      await cargarLicencia(pagina);
      await pagina.tocar(pagina.el('ml-guardar'));
      assert.deepEqual(delModal(pagina), EN_EL_SEGUNDO_PASO(), String(falla));
      assert.equal(pagina.el('ml-paso-dos').innerHTML, sinVista(), String(falla));
      assert.equal(pagina.el('me-anuncio').textContent, MENSAJE_SIN_VISTA, String(falla));
      assert.equal(pagina.estado.sesionCerrada, false);
      await pagina.tocar(pagina.el('ml-descargar-word'));
      assert.deepEqual(pagina.estado.descargas.map(({ download }) => download),
        ['Nota de licencia - Licencia anual ordinaria - 2026-11-16.docx'], String(falla));
    }

    // Una corrección con avisos: los avisos siguen arriba y se anuncian después de MENSAJE_SIN_VISTA (quien usa un lector de
    // pantalla no los pierde)
    const corregida = montarPagina({
      hash: '#licencias',
      responder: conFormularios({
        extra: (metodo, ruta) => {
          if (metodo === 'PUT') return respuesta(200, { success: true, data: { id: 6 }, avisos: [TEXTO_NO_SE_COPIA] });
          return ruta.endsWith('/nota') ? respuesta(500, { success: false, error: 'Error al armar la nota' }) : undefined;
        }
      })
    });
    await corregida.iniciar();
    await corregida.tocar(corregida.el('vista-licencias').querySelector('[data-editar-licencia="6"]'));
    await corregida.correr();
    await corregida.tocar(corregida.el('ml-guardar'));
    assert.equal(corregida.el('ml-paso-dos').innerHTML, sinVista(`<div class="me-recuadro ambar"><p>${TEXTO_NO_SE_COPIA}</p></div>`));
    assert.equal(corregida.el('me-anuncio').textContent, `${MENSAJE_SIN_VISTA} ${TEXTO_NO_SE_COPIA}`);

    const vencida = montarPagina({ responder: conElAlta({ nota: () => respuesta(401, { success: false, error: 'Token expirado' }) }) });
    await vencida.iniciar();
    await cargarLicencia(vencida);
    await vencida.tocar(vencida.el('ml-guardar'));
    assert.equal(vencida.estado.sesionCerrada, true);
    assert.equal(vencida.ventana.location.href, 'login.html');
  });

  it('«Descargar Word» baja con bajarWordDeLicencia(id, botón), el mismo camino que «Word» de la lista', async () => {
    const pagina = montarPagina({ responder: conElAlta() });
    await pagina.iniciar();
    await cargarLicencia(pagina);
    await pagina.tocar(pagina.el('ml-guardar'));
    const llamadas = [];
    const deVerdad = pagina.contexto.bajarWordDeLicencia;
    pagina.contexto.bajarWordDeLicencia = (id, boton) => { llamadas.push([id, boton]); };
    await pagina.tocar(pagina.el('ml-descargar-word'));
    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0][0], 9);
    assert.equal(llamadas[0][1], pagina.el('ml-descargar-word'));
    pagina.contexto.bajarWordDeLicencia = deVerdad;
  });

  it('«Descargar Word»: GET …/9/word con el token, el botón deshabilitado mientras baja y el nombre del servidor; si se cierra mientras, el foco no vuelve al modal', async () => {
    const word = demorada();
    const pagina = montarPagina({ responder: conElAlta({ extra: (metodo, ruta) => (ruta === '/api/mi-espacio/licencias/9/word' ? word.promesa : undefined) }) });
    await pagina.iniciar();
    await cargarLicencia(pagina);
    await pagina.tocar(pagina.el('ml-guardar'));
    const boton = pagina.el('ml-descargar-word');
    await pagina.tocar(boton);
    const pedidos = pagina.pedidosA('GET', '/api/mi-espacio/licencias/9/word');
    assert.equal(pedidos.length, 1);
    assert.equal(pedidos[0].encabezados.Authorization, 'Bearer token-de-prueba');
    assert.equal(boton.disabled, true);
    // Se cierra mientras baja: el foco va adonde va al cerrar (al botón que abrió el modal) y ahí queda
    await pagina.tecla('Escape');
    assert.equal(pagina.abierto('modal-licencia'), false);
    assert.equal(pagina.documento.activeElement, pagina.el('btn-cargar-licencia'));
    word.soltar(archivo(new BlobFalso(['x']), DISPOSICION_DE_LA_NUEVE));
    await pagina.esperar();
    assert.equal(boton.disabled, false);
    assert.deepEqual(pagina.estado.descargas.map(({ download }) => download), ['Nota de licencia - Licencia anual ordinaria - 2026-11-16.docx']);
    assert.equal(pagina.documento.activeElement, pagina.el('btn-cargar-licencia'));
  });

  it('al cerrar, el foco va adonde va después de guardar: el «Editar» nuevo de la licencia, también si la lista se recarga después de cerrar; desde la lista, «Cargar licencia» nuevo', async () => {
    const lista = demorada();
    let recargas = 0;
    const pagina = montarPagina({
      hash: '#licencias',
      responder: conFormularios({
        extra: (metodo, ruta) => {
          if (metodo === 'PUT') return ok({ id: 6 }, 'Licencia corregida.');
          if (metodo === 'POST' && ruta === '/api/mi-espacio/licencias') return ALTA_DE_LA_NUEVE;
          if (ruta === '/api/mi-espacio/licencias') { recargas += 1; return recargas === 2 ? lista.promesa : undefined; }
          return undefined;
        }
      })
    });
    await pagina.iniciar();
    // La recarga de la lista todavía no llegó al cerrar: el foco vuelve al «Editar» viejo y, cuando llega, al nuevo
    const viejo = pagina.el('vista-licencias').querySelector('[data-editar-licencia="6"]');
    viejo.focus();
    await pagina.tocar(viejo);
    await pagina.correr();
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.equal(pagina.documento.activeElement, pagina.el('ml-descargar-word'));
    await pagina.tocar(listo(pagina));
    assert.equal(pagina.documento.activeElement, viejo);
    lista.soltar(ok(licenciasDe(PLANTA)));
    await pagina.esperar();
    const nuevo = pagina.el('vista-licencias').querySelector('[data-editar-licencia="6"]');
    assert.notEqual(nuevo, viejo);
    assert.equal(pagina.documento.activeElement, nuevo);

    // «Cargar licencia» de la lista: la recarga ya llegó; al cerrar, el foco va al «Cargar licencia» nuevo
    const cargar = pagina.el('vista-licencias').querySelector('[data-cargar="licencia"]');
    cargar.focus();
    await pagina.tocar(cargar);
    await pagina.correr();
    await pagina.elegir('ml-tipo', 'vacaciones');
    await pagina.escribir('ml-desde', VACACIONES.desde);
    await pagina.escribir('ml-hasta', VACACIONES.hasta);
    await pagina.correr();
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.equal(cargar.isConnected, false, 'la lista se volvió a dibujar');
    await pagina.tocar(listo(pagina));
    assert.equal(pagina.documento.activeElement, pagina.el('vista-licencias').querySelector('[data-cargar="licencia"]'));
  });

  it('«Registrar un uso autorizado» se sigue cerrando al guardar: sin segundo paso ni GET …/nota', async () => {
    const pagina = montarPagina({
      hash: '#horas',
      responder: conFormularios({
        extra: (metodo, ruta) => (metodo === 'POST' && ruta === '/api/mi-espacio/licencias'
          ? respuesta(201, { success: true, data: { id: 11 }, message: 'Uso autorizado registrado.' }) : undefined)
      })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-horas').querySelector('[data-abrir="uso"]'));
    await pagina.escribir('mu-fecha', '2026-11-16');
    await pagina.correr();
    await pagina.tocar(pagina.el('mu-guardar'));
    assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/licencias').length, 1);
    assert.equal(pagina.abierto('modal-uso'), false);
    assert.equal(pagina.abierto('modal-licencia'), false);
    assert.deepEqual(pagina.estado.toasts, [['Uso autorizado registrado.', 'success']]);
    assert.equal(pagina.el('me-anuncio').textContent, 'Uso autorizado registrado.');
    assert.ok(!pagina.rutas().some((ruta) => ruta.endsWith('/nota')));
    assert.equal(pagina.el('ml-paso-dos').hidden, true);
  });
});

// Los estilos del segundo paso (spec 2026-10-27-mi-espacio-licencia-word, 6, «Calidad»), leídos del <style> de mi-espacio.html
const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const estiloDeLaPagina = () => leer('mi-espacio.html').match(/<style>([\s\S]*?)<\/style>/)[1];
// Lo de adentro de la regla de ese selector (sola, al principio de su línea), o null
const reglaDe = (selector) => new RegExp(`(?:^|\\n)\\s*${escaparRegex(selector)}\\s*\\{([^}]*)\\}`).exec(estiloDeLaPagina())?.[1] ?? null;
// El contraste de dos colores #RRGGBB (WCAG 2.1)
const luminancia = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (uno, otro) => {
  const [claro, oscuro] = [luminancia(uno), luminancia(otro)].sort((a, b) => b - a);
  return (claro + 0.05) / (oscuro + 0.05);
};

describe('mi-espacio.html: los estilos del segundo paso', () => {
  it('la hoja: A4 a escala de su ancho, Arial 11 con interlineado 1,15, la sangría y la firma; los renglones vacíos tienen su alto', () => {
    const hoja = reglaDe('.me-hoja');
    assert.ok(hoja, '.me-hoja');
    assert.match(hoja, /container-type: inline-size;/);
    assert.match(hoja, /aspect-ratio: 210 \/ 297;/);
    assert.match(reglaDe('.me-hoja-texto'), /padding: 11\.9cqw 14\.29cqw;/);
    assert.match(reglaDe('.me-hoja-texto'), /font: 1\.848cqw\/1\.32 Arial, Helvetica, sans-serif;/);
    // Un <p></p> sin alto mínimo se aplasta: los renglones vacíos de la nota desaparecerían
    assert.match(reglaDe('.me-hoja-texto p'), /min-height: 1\.32em;/);
    assert.match(reglaDe('.me-hoja-texto .sangria'), /text-indent: 5\.95cqw;/);
    assert.match(reglaDe('.me-hoja-texto .firma'), /margin-left: 38\.1cqw;/);
  });

  it('la mesa, gris y sin alto máximo ni su propia barra: el que se desplaza es el cuerpo del modal', () => {
    const mesa = reglaDe('.me-mesa');
    assert.match(mesa, /background: var\(--sg-gris-fondo\);/);
    // Solo lo que desplaza (overflow, overflow-x y overflow-y): overflow-wrap no da una barra
    assert.doesNotMatch(estiloDeLaPagina(), /\.me-(?:mesa|hoja)[^{]*\{[^}]*(?:max-height|overflow(?:-[xy])?\s*:)/);
  });

  it('«Word» deshabilitado mientras baja: el cursor de espera y el gris de los textos secundarios, con 4,5:1 o más sobre blanco', () => {
    const regla = reglaDe('.sg-link:disabled');
    assert.ok(regla, '.sg-link:disabled');
    assert.match(regla, /cursor: progress;/);
    assert.match(regla, /color: var\(--sg-suave\);/);
    assert.doesNotMatch(regla, /opacity/);
    const suave = /--sg-suave: (#[0-9A-Fa-f]{6});/.exec(estiloDeLaPagina())[1];
    assert.ok(contraste(suave, '#FFFFFF') >= 4.5, `${suave}: ${contraste(suave, '#FFFFFF').toFixed(2)}:1`);
  });
});

// =====================================================================================================================================
// La planilla de horas extras de contrato en la página (spec 2026-10-27-mi-espacio-horas, secciones 4 y 9; la maqueta aprobada), con
// el DOM y el fetch falsos: Sofía Paz (contrato, inventada), con las salidas de octubre de la planilla y hoy el martes 27/10/2026 (el
// de la planilla que manda el servidor)

const SEPTIEMBRE = planillaDel(ESTADO_PLANILLA, { mes: '2026-09' });
const RESUMEN_DE_CONTRATO = resumenDel(CONTRATO);
const TABLA_DE_CONTRATO = comoLlega(tablaDeHorasExtras(ESTADO_PLANILLA,
  calcular(ESTADO_PLANILLA, { hoy: HOY_PLANILLA, feriados: FERIADOS_PLANILLA }), { anio: 2026, hoy: HOY_PLANILLA, feriados: FERIADOS_PLANILLA }));
const RUTA_DE_OCTUBRE = '/api/mi-espacio/salidas?mes=2026-10';
const RUTA_DE_SEPTIEMBRE = '/api/mi-espacio/salidas?mes=2026-09';
const RUTA_DEL_GUARDADO = '/api/mi-espacio/salidas';
// El GET del mes en curso, sin `mes` (el del encabezado y el de la tarjeta: el servidor da el de hoy, octubre)
const RUTA_DEL_MES_EN_CURSO = '/api/mi-espacio/salidas';
// Un GET de octubre: con su mes (el de «Editar») o el del mes en curso
const esDeOctubre = (metodo, ruta) => metodo === 'GET' && (ruta === RUTA_DE_OCTUBRE || ruta === RUTA_DEL_MES_EN_CURSO);
// Lo que contesta el servidor falso a la persona de contrato: el Resumen, la pestaña, octubre y septiembre, y lo que se pase en
// `extra` (que gana)
const conLaPlanilla = ({ extra = () => undefined, resumen = RESUMEN_DE_CONTRATO } = {}) => (metodo, ruta, cuerpo) => {
  const propia = extra(metodo, ruta, cuerpo);
  if (propia !== undefined) return propia;
  if (ruta === '/api/mi-espacio/resumen') return ok(resumen);
  if (ruta === '/api/mi-espacio/horas-extras') return ok(TABLA_DE_CONTRATO);
  if (esDeOctubre(metodo, ruta)) return ok(OCTUBRE);
  if (metodo === 'GET' && ruta === RUTA_DE_SEPTIEMBRE) return ok(SEPTIEMBRE);
  return RESPUESTAS_DE_ENTRADA(metodo, ruta);
};
// La respuesta de PUT /mi-espacio/salidas que sale bien, como la arma el servidor
const guardadas = (n) => ok({ guardados: n }, `Horas extras guardadas: ${n} ${n === 1 ? 'día' : 'días'}.`);
// Un campo de un día de la planilla (la entrada, la salida o la nota), su fila, y escribir en él como en el navegador
const campoDel = (pagina, fecha, campo = 'salida') => pagina.el('mp-dias').querySelector(`[data-campo="${campo}"][data-fecha="${fecha}"]`);
const filaDeLaPagina = (pagina, fecha) => pagina.el(`mp-dia-${fecha}`);
const escribirEnLaPlanilla = async (pagina, fecha, campo, valor) => {
  const control = campoDel(pagina, fecha, campo);
  assert.ok(control, `${campo} del ${fecha}`);
  control.value = valor;
  control.disparar('input');
  await pagina.esperar();
};
// Abre la planilla con un botón (con el foco en él, como con un clic) y deja pasar el velo
const abrirLaPlanilla = async (pagina, boton = pagina.el('btn-cargar-horas')) => {
  boton.focus();
  await pagina.tocar(boton);
  await pagina.correr();
};
const totalesDeLasSemanas = (pagina) => pagina.el('mp-dias').querySelectorAll('.mp-semana-total').map((total) => total.textContent);
const cancelarDeLaPlanilla = (pagina) => pagina.el('modal-planilla').querySelector('.modal-footer [data-cerrar]');
const noDeLaConfirmacion = (pagina) => pagina.el('modal-confirmar').querySelector('.modal-footer [data-cerrar]');

describe('la planilla de horas extras en la página (DOM falso)', () => {
  it('«Cargar horas extras» del encabezado abre la planilla del mes en curso: un GET (sin el mes: lo da el servidor), el foco en la salida de hoy; sin cambios, cierra sin preguntar', async () => {
    const pagina = montarPagina({ responder: conLaPlanilla() });
    await pagina.iniciar();
    const boton = pagina.el('btn-cargar-horas');
    assert.equal(boton.hidden, false);
    await abrirLaPlanilla(pagina, boton);
    assert.equal(pagina.abierto('modal-planilla'), true);
    assert.equal(pagina.abierto('modal-horas'), false);
    assert.equal(pagina.pedidosA('GET', RUTA_DEL_MES_EN_CURSO).length, 1);
    assert.equal(pagina.pedidosA('GET', RUTA_DE_OCTUBRE).length, 0);
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Octubre 2026');
    assert.equal(pagina.el('mp-anterior').disabled, false);
    assert.equal(pagina.el('mp-siguiente').disabled, true);
    assert.equal(pagina.el('mp-dias').innerHTML, M.htmlDeLaPlanilla(OCTUBRE, VACIO));
    assert.equal(pagina.el('mp-dias').getAttribute('aria-busy'), null);
    assert.equal(pagina.el('mp-suma').innerHTML, M.htmlDeLaBandaDeLaPlanilla('2026-10', 16, HOY_PLANILLA));
    assert.equal(pagina.el('mp-pendientes').innerHTML, 'Todo guardado.');
    assert.equal(pagina.el('mp-sumar').innerHTML, M.htmlDelSumarDeLaPlanilla(OCTUBRE, VACIO));
    assert.equal(pagina.el('mp-como-mes').textContent, 'Las horas de octubre son horas a favor en noviembre.');
    assert.equal(pagina.el('mp-error').hidden, true);
    assert.equal(pagina.documento.activeElement, campoDel(pagina, '2026-10-27'));
    // Sin cambios, «Cancelar» cierra sin preguntar y el foco vuelve al botón
    await pagina.tocar(cancelarDeLaPlanilla(pagina));
    assert.equal(pagina.abierto('modal-planilla'), false);
    assert.equal(pagina.abierto('modal-confirmar'), false);
    assert.equal(pagina.documento.activeElement, boton);
    // Nada de las horas extras de planta
    assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/horas-extras').length, 0);
  });

  it('desde la pestaña: la tarjeta abre el mes en curso y «Editar» de un día, su mes, con el foco en su salida (o en su «Quitar»)', async () => {
    const pagina = montarPagina({ hash: '#horas', responder: conLaPlanilla() });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina, pagina.el('vista-horas').querySelector('[data-cargar="horas"]'));
    assert.equal(pagina.abierto('modal-planilla'), true);
    assert.equal(pagina.documento.activeElement, campoDel(pagina, '2026-10-27'));
    await pagina.tecla('Escape');
    assert.equal(pagina.abierto('modal-planilla'), false);
    // «Editar» del 21/10: octubre otra vez, ahora con su mes (cada apertura pide su mes), con el foco en su salida; al cerrar, de
    // vuelta a «Editar»
    const editar = pagina.el('vista-horas').querySelector('[data-editar-salida="2026-10-21"]');
    await abrirLaPlanilla(pagina, editar);
    assert.equal(pagina.pedidosA('GET', RUTA_DEL_MES_EN_CURSO).length, 1);
    assert.equal(pagina.pedidosA('GET', RUTA_DE_OCTUBRE).length, 1);
    assert.equal(pagina.documento.activeElement, campoDel(pagina, '2026-10-21'));
    await pagina.tecla('Escape');
    assert.equal(pagina.documento.activeElement, editar);
    // El 09/10, de licencia, con la salida de antes como texto: el foco en su «Quitar»
    await abrirLaPlanilla(pagina, pagina.el('vista-horas').querySelector('[data-editar-salida="2026-10-09"]'));
    assert.equal(pagina.documento.activeElement, filaDeLaPagina(pagina, '2026-10-09').querySelector('[data-quitar]'));
    await pagina.tecla('Escape');
    // Un día de septiembre (su mes de la tabla): pide septiembre
    await pagina.tocar(pagina.el('vista-horas').querySelector('[data-mes="2026-09"]'));
    await abrirLaPlanilla(pagina, pagina.el('vista-horas').querySelector('[data-editar-salida="2026-09-17"]'));
    assert.equal(pagina.pedidosA('GET', RUTA_DE_SEPTIEMBRE).length, 1);
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Septiembre 2026');
    assert.equal(pagina.documento.activeElement, campoDel(pagina, '2026-09-17'));
  });

  it('escribir una salida actualiza en el momento las horas de la fila, la semana, la banda y el pie; volver a como estaba, no cuenta', async () => {
    const pagina = montarPagina({ responder: conLaPlanilla() });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    const fila = filaDeLaPagina(pagina, '2026-10-22');
    assert.deepEqual(totalesDeLasSemanas(pagina), ['—', '4 h', '2,5 h', '8,5 h', '1 h']);
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'salida', '16:46');
    assert.equal(pagina.el('mp-h-2026-10-22').innerHTML, '<b>2 h</b>');
    assert.equal(fila.classList.contains('cambiado'), true);
    assert.deepEqual(totalesDeLasSemanas(pagina), ['—', '4 h', '2,5 h', '10,5 h', '1 h']);
    assert.equal(pagina.el('mp-suma').innerHTML, M.htmlDeLaBandaDeLaPlanilla('2026-10', 18, HOY_PLANILLA));
    assert.equal(pagina.el('mp-suma').textContent, '18hEn noviembre vas a tener 2 días de franco y 4 horas a favor.');
    assert.equal(pagina.el('mp-pendientes').innerHTML, '<b>1 día</b> con cambios sin guardar.');
    // La fila no se volvió a dibujar: el campo es el mismo (el foco y lo que se escribe no se pierden)
    assert.equal(fila.isConnected, true);
    // La entrada de un día hábil, en gris mientras está vacía
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'entrada', '08:05');
    assert.equal(campoDel(pagina, '2026-10-22', 'entrada').getAttribute('data-vacio'), '0');
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'entrada', '');
    assert.equal(campoDel(pagina, '2026-10-22', 'entrada').getAttribute('data-vacio'), '1');
    // El feriado sin la entrada: «Poné la entrada», y deja de sumar
    await escribirEnLaPlanilla(pagina, '2026-10-12', 'entrada', '');
    assert.equal(pagina.el('mp-h-2026-10-12').textContent, '—Poné la entrada');
    assert.deepEqual(totalesDeLasSemanas(pagina), ['—', '4 h', '—', '10,5 h', '1 h']);
    assert.equal(pagina.el('mp-pendientes').innerHTML, '<b>2 días</b> con cambios sin guardar.');
    // Vueltos a como estaban (Review Focus 5): sin la raya, «Todo guardado.» y la banda del servidor
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'salida', '');
    await escribirEnLaPlanilla(pagina, '2026-10-12', 'entrada', '09:21');
    assert.equal(fila.classList.contains('cambiado'), false);
    assert.equal(filaDeLaPagina(pagina, '2026-10-12').classList.contains('cambiado'), false);
    assert.equal(pagina.el('mp-pendientes').innerHTML, 'Todo guardado.');
    assert.equal(pagina.el('mp-suma').innerHTML, M.htmlDeLaBandaDeLaPlanilla('2026-10', 16, HOY_PLANILLA));
    // Lo que no es un campo de una fila no cambia nada
    pagina.el('mp-sumar').querySelector('select').disparar('input');
    await pagina.esperar();
    assert.equal(pagina.el('mp-pendientes').innerHTML, 'Todo guardado.');
  });

  it('un día con el aviso del servidor: al cambiarlo, el aviso se va de la vista y de la descripción de su salida', async () => {
    const filas = [...FILAS_PLANILLA, { ...FERIADO_DIVERSIDAD, id: 4, fecha: '2026-10-21', nombre: 'Feriado cargado después' }];
    const conFeriado = planillaDel(ESTADO_PLANILLA, { filas });
    const pagina = montarPagina({ responder: conLaPlanilla({ extra: (metodo, ruta) => (esDeOctubre(metodo, ruta) ? ok(conFeriado) : undefined) }) });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    assert.equal(campoDel(pagina, '2026-10-21').getAttribute('aria-describedby'), 'mp-a-2026-10-21');
    await escribirEnLaPlanilla(pagina, '2026-10-21', 'entrada', '18:00');
    assert.equal(pagina.el('mp-a-2026-10-21').hidden, true);
    assert.equal(campoDel(pagina, '2026-10-21').getAttribute('aria-describedby'), null);
    assert.equal(pagina.el('mp-h-2026-10-21').innerHTML, '<b>1 h</b>');
    // Vuelto a como estaba, el aviso vuelve
    await escribirEnLaPlanilla(pagina, '2026-10-21', 'entrada', '');
    assert.equal(pagina.el('mp-a-2026-10-21').hidden, false);
    assert.equal(campoDel(pagina, '2026-10-21').getAttribute('aria-describedby'), 'mp-a-2026-10-21');
  });

  it('cambiar de mes pide el otro una sola vez y conserva los cambios; volver no lo vuelve a pedir; las flechas, hasta el mes en curso', async () => {
    const pagina = montarPagina({ responder: conLaPlanilla() });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'salida', '16:46');
    const anterior = pagina.el('mp-anterior');
    const siguiente = pagina.el('mp-siguiente');
    anterior.focus();
    await pagina.tocar(anterior);
    assert.equal(pagina.pedidosA('GET', RUTA_DE_SEPTIEMBRE).length, 1);
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Septiembre 2026');
    assert.equal(pagina.el('mp-anuncio').textContent, 'Septiembre 2026');
    assert.equal(siguiente.disabled, false);
    assert.equal(anterior.disabled, false);
    assert.equal(pagina.el('mp-dias').innerHTML, M.htmlDeLaPlanilla(SEPTIEMBRE, VACIO));
    assert.equal(pagina.el('mp-como-mes').textContent, 'Las horas de septiembre son horas a favor en octubre.');
    assert.equal(pagina.el('mp-suma').innerHTML, M.htmlDeLaBandaDeLaPlanilla('2026-09', 10.5, HOY_PLANILLA));
    assert.equal(pagina.el('mp-sumar').innerHTML, M.htmlDelSumarDeLaPlanilla(SEPTIEMBRE, VACIO));
    assert.equal(pagina.documento.activeElement, anterior);
    // El cambio de octubre sigue en el pie, con el de septiembre
    await escribirEnLaPlanilla(pagina, '2026-09-15', 'salida', '17:00');
    assert.equal(pagina.el('mp-pendientes').innerHTML, '<b>2 días</b> con cambios sin guardar (septiembre y octubre).');
    // De vuelta a octubre: sin otro GET y con lo escrito; la flecha de adelante se deshabilita y el foco pasa a la otra
    siguiente.focus();
    await pagina.tocar(siguiente);
    assert.equal(pagina.pedidosA('GET', RUTA_DEL_MES_EN_CURSO).length, 1);
    assert.equal(pagina.pedidosA('GET', RUTA_DE_OCTUBRE).length, 0);
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Octubre 2026');
    assert.equal(pagina.el('mp-anuncio').textContent, 'Octubre 2026');
    assert.equal(campoDel(pagina, '2026-10-22').value, '16:46');
    assert.equal(filaDeLaPagina(pagina, '2026-10-22').classList.contains('cambiado'), true);
    assert.equal(pagina.el('mp-suma').innerHTML, M.htmlDeLaBandaDeLaPlanilla('2026-10', 18, HOY_PLANILLA));
    assert.equal(siguiente.disabled, true);
    assert.equal(pagina.documento.activeElement, anterior);
    // Y otra vez septiembre: tampoco lo vuelve a pedir, y lo escrito sigue
    await pagina.tocar(anterior);
    assert.equal(pagina.pedidosA('GET', RUTA_DE_SEPTIEMBRE).length, 1);
    assert.equal(campoDel(pagina, '2026-09-15').value, '17:00');
    // No se va a un mes que todavía no llegó
    await pagina.tocar(siguiente);
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Octubre 2026');
    siguiente.disabled = false;
    await pagina.tocar(siguiente);
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Octubre 2026');
    assert.ok(!pagina.rutas().includes('/api/mi-espacio/salidas?mes=2026-11'));
  });

  it('una respuesta que llega tarde (de una apertura anterior) no pisa la planilla nueva; mientras llega, las flechas no hacen nada', async () => {
    let soltar;
    const demorado = new Promise((resolver) => { soltar = resolver; });
    const pagina = montarPagina({
      responder: conLaPlanilla({ extra: (metodo, ruta) => (ruta === RUTA_DE_SEPTIEMBRE ? demorado.then(() => ok(SEPTIEMBRE)) : undefined) })
    });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    await pagina.tocar(pagina.el('mp-anterior'));
    // Mientras tanto, octubre sigue a la vista, ocupado
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Octubre 2026');
    assert.equal(pagina.el('mp-dias').getAttribute('aria-busy'), 'true');
    await pagina.tocar(pagina.el('mp-anterior'));
    assert.equal(pagina.pedidosA('GET', RUTA_DE_SEPTIEMBRE).length, 1);
    assert.ok(!pagina.rutas().includes('/api/mi-espacio/salidas?mes=2026-08'));
    // Se cierra (sin cambios) y se vuelve a abrir: llega septiembre, tarde, y no se dibuja
    await pagina.tecla('Escape');
    assert.equal(pagina.abierto('modal-planilla'), false);
    await abrirLaPlanilla(pagina);
    soltar();
    await pagina.esperar();
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Octubre 2026');
    assert.equal(pagina.el('mp-dias').innerHTML, M.htmlDeLaPlanilla(OCTUBRE, VACIO));
    assert.equal(pagina.el('mp-dias').getAttribute('aria-busy'), null);
  });

  it('si el mes no llega, lo dice arriba del cuerpo (role="alert") y la planilla queda vacía, con el foco dentro del diálogo', async () => {
    const pagina = montarPagina({
      responder: conLaPlanilla({
        extra: (metodo, ruta) => (esDeOctubre(metodo, ruta) ? respuesta(500, { success: false, error: 'Error al leer la planilla' }) : undefined)
      })
    });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    assert.equal(pagina.abierto('modal-planilla'), true);
    assert.equal(pagina.el('mp-error').hidden, false);
    assert.equal(pagina.el('mp-error').textContent, 'Error al leer la planilla');
    assert.equal(pagina.el('mp-dias').innerHTML, '');
    assert.equal(pagina.el('mp-dias').getAttribute('aria-busy'), null);
    assert.equal(pagina.documento.activeElement, pagina.el('modal-planilla').querySelector('.modal-close'));
    // Sin nada a la vista, «Guardar» cierra (no hay cambios)
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.equal(pagina.abierto('modal-planilla'), false);
    assert.equal(pagina.pedidosA('PUT', RUTA_DEL_GUARDADO).length, 0);
  });

  it('«Sumar el día» suma un domingo con el foco en su entrada; «Quitar» lo saca (también de los sumados) y quita un sábado guardado', async () => {
    const pagina = montarPagina({ responder: conLaPlanilla() });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    pagina.el('mp-finde').value = '2026-10-25';
    await pagina.tocar(pagina.el('mp-sumar-boton'));
    const domingo = filaDeLaPagina(pagina, '2026-10-25');
    assert.ok(domingo);
    assert.equal(pagina.documento.activeElement, campoDel(pagina, '2026-10-25', 'entrada'));
    assert.ok(!pagina.el('mp-sumar').innerHTML.includes('value="2026-10-25"'));
    assert.equal(pagina.el('mp-pendientes').innerHTML, 'Todo guardado.');
    assert.deepEqual(totalesDeLasSemanas(pagina), ['—', '4 h', '2,5 h', '8,5 h', '1 h']);
    await escribirEnLaPlanilla(pagina, '2026-10-25', 'entrada', '09:00');
    await escribirEnLaPlanilla(pagina, '2026-10-25', 'salida', '10:00');
    assert.equal(pagina.el('mp-h-2026-10-25').innerHTML, '<b>1 h</b>');
    assert.deepEqual(totalesDeLasSemanas(pagina), ['—', '4 h', '2,5 h', '9,5 h', '1 h']);
    assert.equal(pagina.el('mp-pendientes').innerHTML, '<b>1 día</b> con cambios sin guardar.');
    // «Quitar»: el domingo se va (también de los sumados: no queda en la pantalla) y vuelve a la lista para sumar
    await pagina.tocar(domingo.querySelector('[data-quitar]'));
    assert.equal(filaDeLaPagina(pagina, '2026-10-25'), null);
    assert.ok(pagina.el('mp-sumar').innerHTML.includes('<option value="2026-10-25">'));
    assert.equal(pagina.el('mp-pendientes').innerHTML, 'Todo guardado.');
    assert.equal(pagina.documento.activeElement, pagina.el('mp-guardar'));
    // El sábado 24/10, guardado: quitarlo es borrarlo al guardar (deja de sumar sus 4,5 horas)
    await pagina.tocar(filaDeLaPagina(pagina, '2026-10-24').querySelector('[data-quitar]'));
    assert.equal(filaDeLaPagina(pagina, '2026-10-24'), null);
    assert.equal(pagina.el('mp-pendientes').innerHTML, '<b>1 día</b> con cambios sin guardar.');
    assert.equal(pagina.el('mp-suma').innerHTML, M.htmlDeLaBandaDeLaPlanilla('2026-10', 11.5, HOY_PLANILLA));
    // Vuelto a sumar, vuelve con lo guardado: sumarlo deshace el «Quitar»
    pagina.el('mp-finde').value = '2026-10-24';
    await pagina.tocar(pagina.el('mp-sumar-boton'));
    assert.equal(campoDel(pagina, '2026-10-24').value, '13:20');
    assert.equal(pagina.el('mp-pendientes').innerHTML, 'Todo guardado.');
    // El de licencia con la salida de antes: «Quitar» la saca (queda el día de licencia, con la raya)
    await pagina.tocar(filaDeLaPagina(pagina, '2026-10-09').querySelector('[data-quitar]'));
    assert.equal(filaDeLaPagina(pagina, '2026-10-09').classList.contains('cambiado'), true);
    assert.equal(filaDeLaPagina(pagina, '2026-10-09').querySelector('[data-quitar]'), null);
    // Sin elegir nada en el selector, suma el primero
    pagina.el('mp-finde').value = '';
    await pagina.tocar(pagina.el('mp-sumar-boton'));
    assert.ok(filaDeLaPagina(pagina, '2026-10-03'));
  });

  it('«Nota» abre su campo debajo de la fila con el foco; cerrarla deja la nota a la vista y el foco en su botón', async () => {
    const pagina = montarPagina({ responder: conLaPlanilla() });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    const boton = () => filaDeLaPagina(pagina, '2026-10-22').querySelector('[data-nota]');
    assert.equal(boton().getAttribute('aria-expanded'), 'false');
    await pagina.tocar(boton());
    assert.equal(boton().getAttribute('aria-expanded'), 'true');
    assert.equal(pagina.documento.activeElement, campoDel(pagina, '2026-10-22', 'nota'));
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'nota', 'Cierre del informe');
    assert.equal(pagina.el('mp-pendientes').innerHTML, '<b>1 día</b> con cambios sin guardar.');
    await pagina.tocar(boton());
    assert.equal(campoDel(pagina, '2026-10-22', 'nota'), null);
    assert.equal(boton().textContent, 'Cambiar nota');
    assert.equal(boton().getAttribute('aria-expanded'), 'false');
    assert.equal(pagina.documento.activeElement, boton());
    assert.equal(filaDeLaPagina(pagina, '2026-10-22').querySelector('.mp-nota-vista').textContent, 'Cierre del informe');
    // Abierta otra vez, con lo escrito
    await pagina.tocar(boton());
    assert.equal(campoDel(pagina, '2026-10-22', 'nota').value, 'Cierre del informe');
  });

  it('Enter en una salida o en una nota lleva a la salida del día siguiente que se carga; en la última, a «Guardar»', async () => {
    const pagina = montarPagina({ responder: conLaPlanilla() });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    const activo = () => pagina.documento.activeElement;
    campoDel(pagina, '2026-10-22').focus();
    const evento = campoDel(pagina, '2026-10-22').disparar('keydown', { key: 'Enter' });
    assert.equal(evento.defaultPrevented, true);
    assert.equal(activo(), campoDel(pagina, '2026-10-23'));
    // Al sábado con salida y del sábado al lunes
    await pagina.tecla('Enter');
    assert.equal(activo(), campoDel(pagina, '2026-10-24'));
    await pagina.tecla('Enter');
    assert.equal(activo(), campoDel(pagina, '2026-10-26'));
    // Los días de licencia se saltean: del feriado del 12/10 al 16/10
    campoDel(pagina, '2026-10-12').focus();
    await pagina.tecla('Enter');
    assert.equal(activo(), campoDel(pagina, '2026-10-16'));
    // Hoy es el último que se carga (los que siguen todavía no llegaron): Enter va a «Guardar»
    campoDel(pagina, '2026-10-27').focus();
    await pagina.tecla('Enter');
    assert.equal(activo(), pagina.el('mp-guardar'));
    // En una nota abierta, también
    await pagina.tocar(filaDeLaPagina(pagina, '2026-10-22').querySelector('[data-nota]'));
    assert.equal(activo(), campoDel(pagina, '2026-10-22', 'nota'));
    await pagina.tecla('Enter');
    assert.equal(activo(), campoDel(pagina, '2026-10-23'));
    // En una entrada, Enter no mueve nada
    campoDel(pagina, '2026-10-22', 'entrada').focus();
    const enLaEntrada = campoDel(pagina, '2026-10-22', 'entrada').disparar('keydown', { key: 'Enter' });
    assert.equal(enLaEntrada.defaultPrevented, false);
    assert.equal(activo(), campoDel(pagina, '2026-10-22', 'entrada'));
  });

  it('«Guardar» con un error en la fila: no pide nada, lo marca (aria-invalid y el mensaje debajo) con el foco ahí; escribir lo saca', async () => {
    const pagina = montarPagina({ responder: conLaPlanilla() });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'entrada', '08:00');
    await escribirEnLaPlanilla(pagina, '2026-10-23', 'salida', '17:16');
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.equal(pagina.pedidosA('PUT', RUTA_DEL_GUARDADO).length, 0);
    assert.equal(pagina.abierto('modal-planilla'), true);
    assert.equal(pagina.el('mp-error').hidden, false);
    assert.equal(pagina.el('mp-error').textContent, 'Revisá el día marcado.');
    const salida = campoDel(pagina, '2026-10-22');
    assert.equal(salida.getAttribute('aria-invalid'), 'true');
    assert.equal(salida.getAttribute('aria-describedby'), 'mp-e-2026-10-22');
    assert.equal(pagina.el('mp-e-2026-10-22').textContent, MENSAJES_MI_ESPACIO.salidaQueCuenta);
    assert.equal(pagina.documento.activeElement, salida);
    // Lo escrito sigue, también en la otra fila
    assert.equal(campoDel(pagina, '2026-10-22', 'entrada').value, '08:00');
    assert.equal(campoDel(pagina, '2026-10-23').value, '17:16');
    assert.equal(pagina.el('mp-pendientes').innerHTML, '<b>2 días</b> con cambios sin guardar.');
    // Dos errores: «Revisá los 2 días marcados.», y el foco en el primero
    await escribirEnLaPlanilla(pagina, '2026-10-12', 'entrada', '13:00');
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.equal(pagina.el('mp-error').textContent, 'Revisá los 2 días marcados.');
    assert.equal(pagina.documento.activeElement, campoDel(pagina, '2026-10-12'));
    assert.equal(pagina.el('mp-e-2026-10-12').textContent, MENSAJES_MI_ESPACIO.salidaAntes);
    // Escribir saca el error de la fila, sin volver a dibujarla; sin ninguno, se va el aviso de arriba
    const delDoce = campoDel(pagina, '2026-10-12');
    await escribirEnLaPlanilla(pagina, '2026-10-12', 'entrada', '09:21');
    assert.equal(delDoce.isConnected, true);
    assert.equal(delDoce.getAttribute('aria-invalid'), null);
    assert.equal(delDoce.getAttribute('aria-describedby'), null);
    assert.equal(pagina.el('mp-e-2026-10-12').hidden, true);
    assert.equal(pagina.el('mp-error').hidden, false);
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'salida', '16:00');
    assert.equal(campoDel(pagina, '2026-10-22').getAttribute('aria-invalid'), null);
    assert.equal(pagina.el('mp-e-2026-10-22').hidden, true);
    assert.equal(pagina.el('mp-error').hidden, true);
    assert.equal(pagina.pedidosA('PUT', RUTA_DEL_GUARDADO).length, 0);
  });

  // Review Focus 4
  it('«Guardar» con el error en otro mes: pasa a ese mes y el foco va al campo del error, sin pedir nada', async () => {
    const pagina = montarPagina({ responder: conLaPlanilla() });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    await pagina.tocar(pagina.el('mp-anterior'));
    await escribirEnLaPlanilla(pagina, '2026-09-15', 'entrada', '08:00');
    await pagina.tocar(pagina.el('mp-siguiente'));
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'salida', '16:46');
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Octubre 2026');
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.equal(pagina.pedidosA('PUT', RUTA_DEL_GUARDADO).length, 0);
    assert.equal(pagina.pedidosA('GET', RUTA_DE_SEPTIEMBRE).length, 1);
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Septiembre 2026');
    assert.equal(pagina.el('mp-siguiente').disabled, false);
    const salida = campoDel(pagina, '2026-09-15');
    assert.equal(pagina.documento.activeElement, salida);
    assert.equal(salida.getAttribute('aria-invalid'), 'true');
    assert.equal(pagina.el('mp-e-2026-09-15').textContent, MENSAJES_MI_ESPACIO.salidaQueCuenta);
    assert.equal(pagina.el('mp-error').textContent, 'Revisá el día marcado.');
    // El mes al que pasó se anuncia en la región viva de la planilla
    assert.equal(pagina.el('mp-anuncio').textContent, 'Septiembre 2026');
    // Octubre sigue con lo escrito
    await pagina.tocar(pagina.el('mp-siguiente'));
    assert.equal(campoDel(pagina, '2026-10-22').value, '16:46');
  });

  it('con más de 100 días cambiados, «Guardar» lo dice arriba del cuerpo y no pide nada', async () => {
    const pagina = montarPagina({ responder: conLaPlanilla() });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'salida', '16:46');
    // Cien días más (de meses pedidos antes, en esta apertura): cada uno con una salida que no estaba guardada
    const cambios = vm.runInContext('pagina.planilla.cambios', pagina.contexto);
    for (let i = 0; i < 100; i += 1) cambios.set(`2025-${String(1 + Math.floor(i / 25)).padStart(2, '0')}-${String(1 + (i % 25)).padStart(2, '0')}`, { entrada: '', salida: '17:00', nota: '' });
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.equal(pagina.pedidosA('PUT', RUTA_DEL_GUARDADO).length, 0);
    assert.equal(pagina.el('mp-error').hidden, false);
    assert.equal(pagina.el('mp-error').textContent, MENSAJES_MI_ESPACIO.muchosDias);
    assert.equal(pagina.documento.activeElement, pagina.el('mp-guardar'));
    assert.equal(pagina.abierto('modal-planilla'), true);
  });

  it('«Guardar»: un PUT con los días cambiados de todos los meses, cierra, avisa «Horas extras guardadas: 3 días.» y vuelve a pedir el Resumen y la pestaña', async () => {
    const pagina = montarPagina({
      hash: '#horas',
      responder: conLaPlanilla({ extra: (metodo, ruta) => (metodo === 'PUT' && ruta === RUTA_DEL_GUARDADO ? guardadas(3) : undefined) })
    });
    await pagina.iniciar();
    const tarjeta = pagina.el('vista-horas').querySelector('[data-cargar="horas"]');
    await abrirLaPlanilla(pagina, tarjeta);
    // Con los segundos que da el <input type="time"> en algunos navegadores (Review Focus 1)
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'salida', '16:46:00');
    await pagina.tocar(filaDeLaPagina(pagina, '2026-10-24').querySelector('[data-quitar]'));
    await pagina.tocar(pagina.el('mp-anterior'));
    await escribirEnLaPlanilla(pagina, '2026-09-30', 'salida', '18:00');
    const cuantas = (ruta) => pagina.rutas().filter((una) => una === ruta).length;
    const resumenes = cuantas('/api/mi-espacio/resumen');
    const horas = cuantas('/api/mi-espacio/horas-extras');
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.deepEqual(pagina.pedidosA('PUT', RUTA_DEL_GUARDADO).map((pedido) => pedido.cuerpo), [{ dias: [
      { fecha: '2026-09-30', entrada: '', salida: '18:00', nota: '', al_mes_anterior: false },
      { fecha: '2026-10-22', entrada: '', salida: '16:46', nota: '', al_mes_anterior: false },
      { fecha: '2026-10-24', entrada: '', salida: '', nota: '', al_mes_anterior: false }
    ] }]);
    assert.equal(pagina.abierto('modal-planilla'), false);
    assert.deepEqual(pagina.estado.toasts, [['Horas extras guardadas: 3 días.', 'success']]);
    assert.equal(pagina.el('me-anuncio').textContent, 'Horas extras guardadas: 3 días.');
    assert.equal(cuantas('/api/mi-espacio/resumen'), resumenes + 1);
    assert.equal(cuantas('/api/mi-espacio/horas-extras'), horas + 1);
    // El foco, en la tarjeta nueva (la pestaña se volvió a dibujar)
    assert.equal(tarjeta.isConnected, false);
    assert.equal(pagina.documento.activeElement, pagina.el('vista-horas').querySelector('[data-cargar="horas"]'));
    // Se cerró: abrirla de nuevo pide otra vez el mes y arranca sin cambios
    await abrirLaPlanilla(pagina, pagina.el('vista-horas').querySelector('[data-cargar="horas"]'));
    assert.equal(pagina.pedidosA('GET', RUTA_DEL_MES_EN_CURSO).length, 2);
    assert.equal(pagina.el('mp-pendientes').innerHTML, 'Todo guardado.');
  });

  it('después de guardar desde «Editar» del día por día, el foco va a su «Editar» nuevo', async () => {
    const pagina = montarPagina({
      hash: '#horas',
      responder: conLaPlanilla({ extra: (metodo, ruta) => (metodo === 'PUT' && ruta === RUTA_DEL_GUARDADO ? guardadas(1) : undefined) })
    });
    await pagina.iniciar();
    const viejo = pagina.el('vista-horas').querySelector('[data-editar-salida="2026-10-21"]');
    await abrirLaPlanilla(pagina, viejo);
    await escribirEnLaPlanilla(pagina, '2026-10-21', 'salida', '19:30');
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.equal(pagina.abierto('modal-planilla'), false);
    assert.equal(viejo.isConnected, false);
    assert.equal(pagina.documento.activeElement, pagina.el('vista-horas').querySelector('[data-editar-salida="2026-10-21"]'));
  });

  it('un 400 del servidor con los días va a esas filas (el primero, en su mes, con el foco); sin días, arriba del cuerpo', async () => {
    // Lo que contesta el PUT: una función, así puede también no llegar (tirar, como el fetch sin conexión)
    let contestar = () => respuesta(400, {
      success: false, error: MENSAJES_MI_ESPACIO.diaDeLicencia, campo: 'fecha', fecha: '2026-09-15',
      errores: [{ fecha: '2026-09-15', campo: 'fecha', mensaje: MENSAJES_MI_ESPACIO.diaDeLicencia },
        { fecha: '2026-10-22', campo: 'salida', mensaje: MENSAJES_MI_ESPACIO.horaSalida }]
    });
    const pagina = montarPagina({
      responder: conLaPlanilla({ extra: (metodo, ruta) => (metodo === 'PUT' && ruta === RUTA_DEL_GUARDADO ? contestar() : undefined) })
    });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'salida', '16:46');
    await pagina.tocar(pagina.el('mp-anterior'));
    await escribirEnLaPlanilla(pagina, '2026-09-15', 'salida', '17:00');
    await pagina.tocar(pagina.el('mp-siguiente'));
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.equal(pagina.pedidosA('PUT', RUTA_DEL_GUARDADO).length, 1);
    assert.equal(pagina.abierto('modal-planilla'), true);
    assert.equal(pagina.el('mp-guardar').disabled, false);
    // El primero por fecha es de septiembre: pasa a ese mes, con el foco en su salida (un error de la fecha no tiene campo en la fila)
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Septiembre 2026');
    const salida = campoDel(pagina, '2026-09-15');
    assert.equal(pagina.documento.activeElement, salida);
    assert.equal(salida.getAttribute('aria-invalid'), 'true');
    assert.equal(pagina.el('mp-e-2026-09-15').textContent, MENSAJES_MI_ESPACIO.diaDeLicencia);
    assert.equal(pagina.el('mp-error').textContent, 'Revisá los 2 días marcados.');
    // El de octubre, en su fila
    await pagina.tocar(pagina.el('mp-siguiente'));
    assert.equal(campoDel(pagina, '2026-10-22').getAttribute('aria-invalid'), 'true');
    assert.equal(pagina.el('mp-e-2026-10-22').textContent, MENSAJES_MI_ESPACIO.horaSalida);
    // Un 400 sin días: arriba del cuerpo, sin marcas en las filas, con el foco en «Guardar»
    contestar = () => respuesta(400, { success: false, error: MENSAJES_MI_ESPACIO.sinArranque, campo: null });
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.equal(pagina.pedidosA('PUT', RUTA_DEL_GUARDADO).length, 2);
    assert.equal(pagina.el('mp-error').hidden, false);
    assert.equal(pagina.el('mp-error').textContent, MENSAJES_MI_ESPACIO.sinArranque);
    assert.equal(campoDel(pagina, '2026-10-22').getAttribute('aria-invalid'), null);
    assert.equal(pagina.documento.activeElement, pagina.el('mp-guardar'));
    // Sin conexión, en castellano
    contestar = () => { throw new TypeError('Failed to fetch'); };
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.equal(pagina.el('mp-error').textContent, MENSAJE_SIN_CONEXION);
    assert.equal(pagina.abierto('modal-planilla'), true);
  });

  it('mientras guarda: «Guardar» deshabilitado, un doble clic manda un solo PUT y el modal no se cierra (ni con Escape ni con «Cancelar»)', async () => {
    let soltar;
    const demorado = new Promise((resolver) => { soltar = resolver; });
    const pagina = montarPagina({
      responder: conLaPlanilla({
        extra: (metodo, ruta) => (metodo === 'PUT' && ruta === RUTA_DEL_GUARDADO ? demorado.then(() => guardadas(1)) : undefined)
      })
    });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'salida', '16:46');
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.equal(pagina.el('mp-guardar').disabled, true);
    // La planilla no acepta cambios: el cuerpo inerte, las flechas apagadas, y lo que se escribiera no cuenta
    assert.equal(pagina.el('mp-cuerpo').inert, true);
    assert.equal(pagina.el('mp-anterior').disabled, true);
    await escribirEnLaPlanilla(pagina, '2026-10-23', 'salida', '18:00');
    assert.equal(pagina.el('mp-pendientes').innerHTML, '<b>1 día</b> con cambios sin guardar.');
    await pagina.tecla('Escape');
    await pagina.tocar(cancelarDeLaPlanilla(pagina));
    assert.equal(pagina.abierto('modal-planilla'), true);
    assert.equal(pagina.abierto('modal-confirmar'), false);
    await pagina.tocar(pagina.el('mp-guardar'));
    pagina.el('mp-guardar').disabled = false;
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.equal(pagina.pedidosA('PUT', RUTA_DEL_GUARDADO).length, 1);
    soltar();
    await pagina.esperar();
    assert.equal(pagina.abierto('modal-planilla'), false);
    assert.equal(pagina.el('me-anuncio').textContent, 'Horas extras guardadas: 1 día.');
    assert.equal(pagina.pedidosA('PUT', RUTA_DEL_GUARDADO).length, 1);
    // Se cerró y el cuerpo ya no está inerte: la próxima apertura arranca como siempre
    assert.equal(pagina.el('mp-cuerpo').inert, false);
    await abrirLaPlanilla(pagina);
    assert.equal(pagina.el('mp-cuerpo').inert, false);
    assert.equal(pagina.el('mp-anterior').disabled, false);
    assert.equal(pagina.el('mp-guardar').disabled, false);
    assert.equal(pagina.documento.activeElement, campoDel(pagina, '2026-10-27'));
  });

  // Que no se pierda lo cargado sin aviso (spec, sección 2): lo que se escribiera mientras va el PUT no iría en él
  it('mientras guarda, la planilla no acepta cambios: escribir, «Quitar», «Sumar el día», «Nota» y las flechas no cambian ni piden nada; si falla, todo vuelve a andar', async () => {
    let soltar;
    const demorado = new Promise((resolver) => { soltar = resolver; });
    const pagina = montarPagina({
      responder: conLaPlanilla({
        extra: (metodo, ruta) => (metodo === 'PUT' && ruta === RUTA_DEL_GUARDADO
          ? demorado.then(() => respuesta(400, { success: false, error: MENSAJES_MI_ESPACIO.sinArranque, campo: null })) : undefined)
      })
    });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'salida', '16:46');
    const cuerpo = pagina.el('mp-cuerpo');
    const anterior = pagina.el('mp-anterior');
    const siguiente = pagina.el('mp-siguiente');
    assert.notEqual(cuerpo.inert, true);
    assert.equal(anterior.disabled, false);
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.equal(pagina.pedidosA('PUT', RUTA_DEL_GUARDADO).length, 1);
    // Mientras tanto: el cuerpo inerte (el foco no entra), las flechas y «Guardar» apagados
    assert.equal(cuerpo.inert, true);
    assert.equal(anterior.disabled, true);
    assert.equal(siguiente.disabled, true);
    assert.equal(pagina.el('mp-guardar').disabled, true);
    campoDel(pagina, '2026-10-23').focus();
    assert.notEqual(pagina.documento.activeElement, campoDel(pagina, '2026-10-23'));
    // Lo que igual llegara a la planilla (un navegador sin inert) no cambia nada. Escribir en otro día:
    const dias = pagina.el('mp-dias').innerHTML;
    const banda = pagina.el('mp-suma').innerHTML;
    const horasDel23 = pagina.el('mp-h-2026-10-23').innerHTML;
    await escribirEnLaPlanilla(pagina, '2026-10-23', 'salida', '18:00');
    assert.equal(pagina.el('mp-h-2026-10-23').innerHTML, horasDel23);
    assert.equal(filaDeLaPagina(pagina, '2026-10-23').classList.contains('cambiado'), false);
    assert.equal(pagina.el('mp-suma').innerHTML, banda);
    assert.equal(pagina.el('mp-pendientes').innerHTML, '<b>1 día</b> con cambios sin guardar.');
    // «Quitar» el sábado guardado, «Sumar el día» un domingo y «Nota»
    await pagina.tocar(filaDeLaPagina(pagina, '2026-10-24').querySelector('[data-quitar]'));
    assert.ok(filaDeLaPagina(pagina, '2026-10-24'));
    pagina.el('mp-finde').value = '2026-10-25';
    await pagina.tocar(pagina.el('mp-sumar-boton'));
    assert.equal(filaDeLaPagina(pagina, '2026-10-25'), null);
    await pagina.tocar(filaDeLaPagina(pagina, '2026-10-22').querySelector('[data-nota]'));
    assert.equal(filaDeLaPagina(pagina, '2026-10-22').querySelector('[data-nota]').getAttribute('aria-expanded'), 'false');
    assert.equal(campoDel(pagina, '2026-10-22', 'nota'), null);
    assert.equal(pagina.el('mp-dias').innerHTML, dias);
    assert.equal(pagina.el('mp-pendientes').innerHTML, '<b>1 día</b> con cambios sin guardar.');
    // Las flechas, aunque se las encendiera: no piden septiembre
    anterior.disabled = false;
    await pagina.tocar(anterior);
    assert.equal(pagina.pedidosA('GET', RUTA_DE_SEPTIEMBRE).length, 0);
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Octubre 2026');
    assert.equal(pagina.pedidosA('PUT', RUTA_DEL_GUARDADO).length, 1);
    // Falla: todo vuelve (las flechas, como las deja el mes), el aviso arriba del cuerpo y el foco en «Guardar»
    soltar();
    await pagina.esperar();
    assert.equal(pagina.abierto('modal-planilla'), true);
    assert.equal(cuerpo.inert, false);
    assert.equal(anterior.disabled, false);
    assert.equal(siguiente.disabled, true);
    assert.equal(pagina.el('mp-guardar').disabled, false);
    assert.equal(pagina.el('mp-error').textContent, MENSAJES_MI_ESPACIO.sinArranque);
    assert.equal(pagina.documento.activeElement, pagina.el('mp-guardar'));
    // Lo que se escribió mientras tanto no quedó: la planilla se volvió a dibujar con lo que hay
    assert.equal(pagina.el('mp-pendientes').innerHTML, '<b>1 día</b> con cambios sin guardar.');
    assert.equal(pagina.el('mp-h-2026-10-23').innerHTML, horasDel23);
    // Y ahora sí acepta cambios: escribir, y el próximo PUT los lleva
    await escribirEnLaPlanilla(pagina, '2026-10-23', 'salida', '18:00');
    assert.equal(pagina.el('mp-pendientes').innerHTML, '<b>2 días</b> con cambios sin guardar.');
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.deepEqual(pagina.pedidosA('PUT', RUTA_DEL_GUARDADO).map((pedido) => pedido.cuerpo.dias.map((dia) => dia.fecha)),
      [['2026-10-22'], ['2026-10-22', '2026-10-23']]);
    // Las flechas también andan
    await pagina.tocar(anterior);
    assert.equal(pagina.pedidosA('GET', RUTA_DE_SEPTIEMBRE).length, 1);
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Septiembre 2026');
  });

  it('un mes que se estaba pidiendo cuando «Guardar» marcó los errores se descarta: al llegar no cambia el mes ni se lleva el foco, y las flechas vuelven a andar', async () => {
    let soltar;
    const demorado = new Promise((resolver) => { soltar = resolver; });
    const pagina = montarPagina({
      responder: conLaPlanilla({ extra: (metodo, ruta) => (ruta === RUTA_DE_SEPTIEMBRE ? demorado.then(() => ok(SEPTIEMBRE)) : undefined) })
    });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'entrada', '08:00');
    await pagina.tocar(pagina.el('mp-anterior'));
    assert.equal(pagina.el('mp-dias').getAttribute('aria-busy'), 'true');
    await pagina.tocar(pagina.el('mp-guardar'));
    const salida = campoDel(pagina, '2026-10-22');
    assert.equal(pagina.documento.activeElement, salida);
    assert.equal(pagina.el('mp-error').textContent, 'Revisá el día marcado.');
    assert.equal(pagina.el('mp-dias').getAttribute('aria-busy'), null);
    // Llega septiembre, tarde: no se dibuja
    soltar();
    await pagina.esperar();
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Octubre 2026');
    assert.equal(salida.isConnected, true);
    assert.equal(pagina.documento.activeElement, salida);
    assert.equal(salida.getAttribute('aria-invalid'), 'true');
    assert.equal(pagina.el('mp-error').textContent, 'Revisá el día marcado.');
    // Las flechas vuelven a andar: septiembre se pide otra vez y se muestra
    await pagina.tocar(pagina.el('mp-anterior'));
    assert.equal(pagina.pedidosA('GET', RUTA_DE_SEPTIEMBRE).length, 2);
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Septiembre 2026');
    assert.equal(pagina.pedidosA('PUT', RUTA_DEL_GUARDADO).length, 0);
  });

  it('un «Guardar» que vuelve a fallar igual se vuelve a anunciar (con un espacio al final, como anunciar); volver a dibujar no lo repite', async () => {
    const pagina = montarPagina({
      responder: conLaPlanilla({
        extra: (metodo, ruta) => (metodo === 'PUT' && ruta === RUTA_DEL_GUARDADO
          ? respuesta(400, { success: false, error: MENSAJES_MI_ESPACIO.sinArranque, campo: null }) : undefined)
      })
    });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'salida', '16:46');
    const aviso = pagina.el('mp-error');
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.equal(aviso.textContent, MENSAJES_MI_ESPACIO.sinArranque);
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.equal(aviso.textContent, `${MENSAJES_MI_ESPACIO.sinArranque} `);
    assert.equal(aviso.hidden, false);
    // Volver a dibujar la planilla (abrir una nota) no lo vuelve a escribir
    await pagina.tocar(filaDeLaPagina(pagina, '2026-10-22').querySelector('[data-nota]'));
    assert.equal(aviso.textContent, `${MENSAJES_MI_ESPACIO.sinArranque} `);
    // Una tercera vez, sin el espacio: se anuncia otra vez
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.equal(aviso.textContent, MENSAJES_MI_ESPACIO.sinArranque);
    // Lo mismo con los días marcados de la página: «Revisá el día marcado.» dos veces
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'salida', '');
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'entrada', '08:00');
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.equal(aviso.textContent, 'Revisá el día marcado.');
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.equal(aviso.textContent, 'Revisá el día marcado. ');
    assert.equal(pagina.documento.activeElement, campoDel(pagina, '2026-10-22'));
    assert.equal(pagina.pedidosA('PUT', RUTA_DEL_GUARDADO).length, 3);
  });

  it('con el reloj del teléfono adelantado (ya es noviembre), la planilla pide el mes en curso sin el mes y muestra el que dice el servidor', async () => {
    const pagina = montarPagina({ responder: conLaPlanilla() });
    await pagina.iniciar();
    pagina.contexto.Utils.hoyEnArgentina = () => '2026-11-01';
    await abrirLaPlanilla(pagina);
    assert.equal(pagina.pedidosA('GET', RUTA_DEL_MES_EN_CURSO).length, 1);
    assert.ok(!pagina.rutas().some((ruta) => ruta.includes('mes=2026-11')));
    assert.equal(pagina.el('mp-error').hidden, true);
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Octubre 2026');
    assert.equal(pagina.el('mp-como-mes').textContent, 'Las horas de octubre son horas a favor en noviembre.');
    assert.equal(pagina.el('mp-dias').innerHTML, M.htmlDeLaPlanilla(OCTUBRE, VACIO));
    assert.equal(pagina.el('mp-siguiente').disabled, true);
    assert.equal(pagina.documento.activeElement, campoDel(pagina, '2026-10-27'));
    // Las flechas van con los meses del servidor: septiembre, con su mes; de vuelta a octubre, sin volver a pedirlo
    await pagina.tocar(pagina.el('mp-anterior'));
    assert.equal(pagina.pedidosA('GET', RUTA_DE_SEPTIEMBRE).length, 1);
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Septiembre 2026');
    await pagina.tocar(pagina.el('mp-siguiente'));
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Octubre 2026');
    assert.equal(pagina.pedidosA('GET', RUTA_DE_OCTUBRE).length, 0);
    assert.equal(pagina.pedidosA('GET', RUTA_DEL_MES_EN_CURSO).length, 1);
  });

  it('cerrar con cambios pregunta: «Seguir cargando» vuelve sin perder nada; «Salir sin guardar» cierra y descarta', async () => {
    const pagina = montarPagina({ responder: conLaPlanilla() });
    await pagina.iniciar();
    const boton = pagina.el('btn-cargar-horas');
    await abrirLaPlanilla(pagina, boton);
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'salida', '16:46');
    const cancelar = cancelarDeLaPlanilla(pagina);
    cancelar.focus();
    await pagina.tocar(cancelar);
    assert.equal(pagina.abierto('modal-confirmar'), true);
    assert.equal(pagina.abierto('modal-planilla'), true);
    assert.equal(pagina.el('modal-confirmar-titulo').textContent, '¿Salir sin guardar?');
    assert.equal(pagina.el('modal-confirmar-texto').textContent, 'Los cambios de 1 día se pierden.');
    assert.equal(pagina.el('modal-confirmar-si').textContent, 'Salir sin guardar');
    assert.equal(noDeLaConfirmacion(pagina).textContent, 'Seguir cargando');
    await pagina.correr();
    assert.equal(pagina.documento.activeElement, noDeLaConfirmacion(pagina));
    // «Seguir cargando»: de vuelta al modal, con lo escrito y el foco en «Cancelar»
    await pagina.tocar(noDeLaConfirmacion(pagina));
    assert.equal(pagina.abierto('modal-confirmar'), false);
    assert.equal(pagina.abierto('modal-planilla'), true);
    assert.equal(campoDel(pagina, '2026-10-22').value, '16:46');
    assert.equal(pagina.el('mp-pendientes').innerHTML, '<b>1 día</b> con cambios sin guardar.');
    assert.equal(pagina.documento.activeElement, cancelar);
    // Con tres días, la × también pregunta; «Salir sin guardar» cierra los dos, descarta y el foco vuelve al botón que la abrió
    await escribirEnLaPlanilla(pagina, '2026-10-23', 'salida', '16:46');
    await escribirEnLaPlanilla(pagina, '2026-10-26', 'salida', '16:46');
    await pagina.tocar(pagina.el('modal-planilla').querySelector('.modal-close'));
    assert.equal(pagina.el('modal-confirmar-texto').textContent, 'Los cambios de 3 días se pierden.');
    await pagina.tocar(pagina.el('modal-confirmar-si'));
    assert.equal(pagina.abierto('modal-confirmar'), false);
    assert.equal(pagina.abierto('modal-planilla'), false);
    assert.equal(pagina.documento.activeElement, boton);
    assert.equal(pagina.pedidosA('PUT', RUTA_DEL_GUARDADO).length, 0);
    // Al volver a abrirla, viene de nuevo (otro GET) y sin lo que no se guardó
    await abrirLaPlanilla(pagina, boton);
    assert.equal(pagina.pedidosA('GET', RUTA_DEL_MES_EN_CURSO).length, 2);
    assert.equal(campoDel(pagina, '2026-10-22').value, '');
    assert.equal(pagina.el('mp-pendientes').innerHTML, 'Todo guardado.');
    // La confirmación de un borrado vuelve a sus textos de siempre
    pagina.contexto.pedirConfirmacion({ titulo: '¿Borrar?', texto: 'Algo.', volverA: null, formulario: 'modal-planilla', borrar: async () => ({}) });
    assert.equal(pagina.el('modal-confirmar-si').textContent, 'Borrar');
    assert.equal(noDeLaConfirmacion(pagina).textContent, 'Cancelar');
  });

  it('Escape: con cambios pregunta (y en la confirmación, sigue cargando); sin cambios, cierra sin preguntar', async () => {
    const pagina = montarPagina({ responder: conLaPlanilla() });
    await pagina.iniciar();
    const boton = pagina.el('btn-cargar-horas');
    await abrirLaPlanilla(pagina, boton);
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'salida', '16:46');
    campoDel(pagina, '2026-10-22').focus();
    await pagina.tecla('Escape');
    assert.equal(pagina.abierto('modal-confirmar'), true);
    assert.equal(pagina.abierto('modal-planilla'), true);
    await pagina.correr();
    await pagina.tecla('Escape');
    assert.equal(pagina.abierto('modal-confirmar'), false);
    assert.equal(pagina.abierto('modal-planilla'), true);
    assert.equal(pagina.documento.activeElement, campoDel(pagina, '2026-10-22'));
    assert.equal(campoDel(pagina, '2026-10-22').value, '16:46');
    // Vuelto a como estaba, Escape cierra sin preguntar
    await escribirEnLaPlanilla(pagina, '2026-10-22', 'salida', '');
    await pagina.tecla('Escape');
    assert.equal(pagina.abierto('modal-confirmar'), false);
    assert.equal(pagina.abierto('modal-planilla'), false);
    assert.equal(pagina.documento.activeElement, boton);
  });

  it('en planta, «Cargar horas extras» (del encabezado y de la tarjeta) sigue abriendo #modal-horas, sin pedir la planilla', async () => {
    const pagina = montarPagina({ hash: '#horas', responder: conFormularios() });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-cargar-horas'));
    assert.equal(pagina.abierto('modal-horas'), true);
    assert.equal(pagina.abierto('modal-planilla'), false);
    assert.equal(pagina.el('modal-horas-titulo').textContent, 'Cargar horas extras al 100%');
    await pagina.tecla('Escape');
    await pagina.tocar(pagina.el('vista-horas').querySelector('[data-cargar="horas"]'));
    assert.equal(pagina.abierto('modal-horas'), true);
    assert.ok(!pagina.rutas().some((ruta) => ruta.includes('/salidas')));
  });

  it('sin el saldo inicial, «Cargar horas extras» de contrato abre «Mis vacaciones y saldos», como siempre, sin pedir la planilla', async () => {
    const sinArranque = resumenDel(CONTRATO, { estado: { ...CONTRATO.estado, arranque: null, anios: [], saldos: [] } });
    assert.equal(sinArranque.abrir_saldos, true);
    const pagina = montarPagina({ responder: conLaPlanilla({ resumen: sinArranque }) });
    await pagina.iniciar();
    // Se abrió solo y no pudo (el servidor falso no tiene GET /anio): lo vuelve a intentar desde el botón
    const antes = pagina.pedidosA('GET', '/api/mi-espacio/anio/2026').length;
    await pagina.tocar(pagina.el('btn-cargar-horas'));
    assert.equal(pagina.pedidosA('GET', '/api/mi-espacio/anio/2026').length, antes + 1);
    assert.equal(pagina.abierto('modal-planilla'), false);
    assert.ok(!pagina.rutas().some((ruta) => ruta.includes('/salidas')));
  });
});

// =====================================================================================================================================
// «Sumar a {mes anterior}» en la planilla (spec 2026-10-30-mi-espacio-horas-mes-anterior, sección 4; Task 6), con el DOM y el fetch
// falsos y los datos de la maqueta, todos inventados (los de «Sumar a {mes anterior}»: lo puro): la persona de contrato, hoy el
// miércoles 03/02/2027; enero suma 5,5 h; el martes 02/02 sale a las 16:20 (1,5 h), guardado con «Sumar a enero», y el miércoles 03/02
// a las 15:50 (1 h). `SIN_TILDE`: lo mismo, con el 02/02 guardado sin tildar (enero suma 5,5 h y febrero, 2,5 h)
// =====================================================================================================================================

const RUTA_DE_ENERO_27 = '/api/mi-espacio/salidas?mes=2027-01';
const RUTA_DE_FEBRERO_27 = '/api/mi-espacio/salidas?mes=2027-02';
const ESTADO_SIN_TILDE = Object.freeze({
  ...CONTRATO.estado, salidas: SALIDAS_DE_ENERO_Y_FEBRERO.map((fila) => ({ ...fila, al_mes_anterior: false }))
});
const SIN_TILDE = Object.freeze({
  enero: planillaDeFebrero('2027-01', { estado: ESTADO_SIN_TILDE }), febrero: planillaDeFebrero('2027-02', { estado: ESTADO_SIN_TILDE })
});
// Lo que contesta el servidor falso: febrero (el mes en curso, sin `mes` o con él) y enero, de `planillas`, y lo de `extra` (que gana)
const conFebrero = ({ planillas = { enero: ENERO_27, febrero: FEBRERO_27 }, extra = () => undefined } = {}) => conLaPlanilla({
  extra: (metodo, ruta, cuerpo) => {
    const propia = extra(metodo, ruta, cuerpo);
    if (propia !== undefined || metodo !== 'GET') return propia;
    if (ruta === RUTA_DEL_MES_EN_CURSO || ruta === RUTA_DE_FEBRERO_27) return ok(planillas.febrero);
    if (ruta === RUTA_DE_ENERO_27) return ok(planillas.enero);
    return undefined;
  }
});
// El tilde de un día (su casilla) y tildarlo o destildarlo como en el navegador (un clic en la casilla da input y change)
const tildeDel = (pagina, fecha) => campoDel(pagina, fecha, 'al_mes_anterior');
const tildar = async (pagina, fecha, tildado = true) => {
  const casilla = tildeDel(pagina, fecha);
  assert.ok(casilla, `el tilde del ${fecha}`);
  casilla.checked = tildado;
  casilla.disparar('input');
  casilla.disparar('change');
  await pagina.esperar();
};
const cambiosDeLaPlanilla = (pagina) => vm.runInContext('pagina.planilla.cambios', pagina.contexto);
// La banda: la cifra («7h») y la segunda línea
const cifraDeLaBanda = (pagina) => pagina.el('mp-suma').querySelector('.mp-suma-cifra').textContent;
const aparteDeLaBanda = (pagina) => pagina.el('mp-suma').querySelector('.mp-suma-aparte').textContent;
// Las filas de solo lectura del bloque «De febrero», por su id
const deOtroMes = (pagina) => pagina.el('mp-dias').querySelectorAll('.mp-dia.de-otro-mes').map((fila) => fila.id);
const VA_A_ENERO = '<small class="mp-va-a"><span aria-hidden="true">→ </span><span class="visualmente-oculto">van a </span>enero</small>';
const SUMAR_A_ENERO = 'Si te autorizan a sumar las horas de un día al mes anterior, tildá «Sumar a enero»: cuentan como horas extras de enero.';

describe('«Sumar a {mes anterior}» en la planilla (DOM falso)', () => {
  it('al abrir febrero: la banda del servidor (la cifra y su segunda línea), el 02/02 tildado y «Cómo se cuentan» con el renglón del tilde', async () => {
    const pagina = montarPagina({ responder: conFebrero() });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Febrero 2027');
    assert.equal(pagina.el('mp-dias').innerHTML, M.htmlDeLaPlanilla(FEBRERO_27, VACIO));
    assert.equal(pagina.el('mp-suma').innerHTML, M.htmlDeLaBandaDeLaPlanilla('2027-02', FEBRERO_27.suma.horas, HOY_FEBRERO, FEBRERO_27.suma.detalle));
    assert.equal(cifraDeLaBanda(pagina), '1h');
    assert.equal(aparteDeLaBanda(pagina), '1,5 h del martes 02/02 suman a enero.');
    assert.equal(tildeDel(pagina, '2027-02-02').checked, true);
    assert.equal(tildeDel(pagina, '2027-02-03').checked, false);
    // (lo dibujó htmlDeLaPlanilla: el DOM falso guarda el innerHTML solo de lo que se escribe, así que se lee del árbol)
    assert.equal(pagina.el('mp-h-2027-02-02').querySelector('b.otro-mes').textContent, '1,5 h');
    assert.equal(pagina.el('mp-h-2027-02-02').querySelector('small.mp-va-a').textContent, '→ van a enero');
    // El renglón del tilde, con el mes anterior que manda el servidor, antes del de las horas a favor
    assert.equal(pagina.el('mp-como-anterior').textContent, SUMAR_A_ENERO);
    assert.equal(pagina.el('mp-como-anterior').hidden, false);
    assert.equal(pagina.el('mp-como-mes').textContent, 'Las horas de febrero son horas a favor en marzo.');
    // El mes anterior: «Sumar a diciembre», en el tilde y en el renglón
    await pagina.tocar(pagina.el('mp-anterior'));
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Enero 2027');
    assert.equal(pagina.el('mp-como-anterior').textContent, SUMAR_A_ENERO.replaceAll('enero', 'diciembre'));
    assert.equal(filaDeLaPagina(pagina, '2027-01-05').querySelector('.mp-tilde').textContent, 'Sumar a diciembre');
  });

  it('«Cómo se cuentan»: mientras llega el mes, y con una planilla de antes (sin `sumar_a`), sin el renglón del tilde', async () => {
    const deAntes = Object.fromEntries(Object.entries(FEBRERO_27).filter(([clave]) => clave !== 'sumar_a'));
    let soltar;
    const demorado = new Promise((resolver) => { soltar = resolver; });
    const pagina = montarPagina({
      responder: conFebrero({ extra: (metodo, ruta) => (metodo === 'GET' && ruta === RUTA_DEL_MES_EN_CURSO ? demorado.then(() => ok(deAntes)) : undefined) })
    });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    assert.equal(pagina.el('mp-como-anterior').hidden, true);
    assert.equal(pagina.el('mp-como-anterior').textContent, '');
    soltar();
    await pagina.esperar();
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Febrero 2027');
    assert.equal(pagina.el('mp-como-anterior').hidden, true);
    assert.equal(pagina.el('mp-como-anterior').textContent, '');
    assert.equal(tildeDel(pagina, '2027-02-03'), null);
  });

  it('tildar un día cambia su estado, la pastilla de la fila, la semana, la banda y el pie, sin volver a dibujar la fila; destildar lo deja como estaba', async () => {
    const pagina = montarPagina({ responder: conFebrero() });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    const fila = filaDeLaPagina(pagina, '2027-02-03');
    const casilla = tildeDel(pagina, '2027-02-03');
    assert.deepEqual(totalesDeLasSemanas(pagina), ['1 h', '—', '—', '—']);
    casilla.focus();
    await tildar(pagina, '2027-02-03');
    assert.deepEqual(plano(cambiosDeLaPlanilla(pagina).get('2027-02-03')), { entrada: '', salida: '15:50', nota: '', al_mes_anterior: true });
    assert.equal(pagina.el('mp-h-2027-02-03').innerHTML, `<b class="otro-mes">1 h</b>${VA_A_ENERO}`);
    assert.equal(fila.classList.contains('cambiado'), true);
    // La semana y la banda no cuentan los días tildados; la segunda línea dice los dos que van a enero
    assert.deepEqual(totalesDeLasSemanas(pagina), ['—', '—', '—', '—']);
    assert.equal(cifraDeLaBanda(pagina), '0h');
    assert.equal(aparteDeLaBanda(pagina), '2,5 h del martes 02/02 y del miércoles 03/02 suman a enero.');
    assert.equal(pagina.el('mp-suma').innerHTML, M.htmlDeLaBandaDeLaPlanilla('2027-02', 0, HOY_FEBRERO,
      '2,5 h del martes 02/02 y del miércoles 03/02 suman a enero.'));
    assert.equal(pagina.el('mp-pendientes').innerHTML, '<b>1 día</b> con cambios sin guardar.');
    // La fila no se volvió a dibujar: la casilla es la misma y sigue con el foco (tildar no anuncia nada)
    assert.equal(fila.isConnected, true);
    assert.equal(casilla.isConnected, true);
    assert.equal(pagina.documento.activeElement, casilla);
    assert.equal(pagina.el('mp-anuncio').textContent, '');
    // Destildado, como estaba: sin la raya, la pastilla de siempre, la banda del servidor y «Todo guardado.»
    await tildar(pagina, '2027-02-03', false);
    assert.equal(fila.classList.contains('cambiado'), false);
    assert.equal(pagina.el('mp-h-2027-02-03').innerHTML, '<b>1 h</b>');
    assert.deepEqual(totalesDeLasSemanas(pagina), ['1 h', '—', '—', '—']);
    assert.equal(pagina.el('mp-suma').innerHTML, M.htmlDeLaBandaDeLaPlanilla('2027-02', 1, HOY_FEBRERO, FEBRERO_27.suma.detalle));
    assert.equal(pagina.el('mp-pendientes').innerHTML, 'Todo guardado.');
    assert.equal(pagina.documento.activeElement, casilla);
    // Destildar el 02/02 (guardado tildado): suma en febrero y la segunda línea queda vacía (el renglón sigue: la banda no se achica)
    await tildar(pagina, '2027-02-02', false);
    assert.equal(cifraDeLaBanda(pagina), '2,5h');
    assert.equal(aparteDeLaBanda(pagina), '');
    assert.equal(pagina.el('mp-h-2027-02-02').innerHTML, '<b>1,5 h</b>');
    assert.deepEqual(totalesDeLasSemanas(pagina), ['2,5 h', '—', '—', '—']);
    assert.equal(pagina.el('mp-pendientes').innerHTML, '<b>1 día</b> con cambios sin guardar.');
  });

  it('borrar la salida de un día tildado oculta el tilde (en su lugar y sin el foco); escribirla de nuevo lo vuelve a mostrar, tildado', async () => {
    const pagina = montarPagina({ responder: conFebrero() });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    const tilde = pagina.el('mp-t-2027-02-02');
    assert.equal(tilde.classList.contains('vacio'), false);
    await escribirEnLaPlanilla(pagina, '2027-02-02', 'salida', '');
    assert.equal(tilde.isConnected, true);
    assert.equal(tilde.classList.contains('vacio'), true);
    assert.equal(tildeDel(pagina, '2027-02-02').getAttribute('tabindex'), '-1');
    assert.equal(pagina.el('mp-h-2027-02-02').innerHTML, '<b class="nada">—</b>');
    assert.equal(aparteDeLaBanda(pagina), '');
    // Con otra salida, otra vez a la vista y tildado (lo que se tildó queda)
    await escribirEnLaPlanilla(pagina, '2027-02-02', 'salida', '16:50');
    assert.equal(tilde.classList.contains('vacio'), false);
    assert.equal(tildeDel(pagina, '2027-02-02').getAttribute('tabindex'), null);
    assert.equal(tildeDel(pagina, '2027-02-02').checked, true);
    assert.equal(pagina.el('mp-h-2027-02-02').innerHTML, `<b class="otro-mes">2 h</b>${VA_A_ENERO}`);
    assert.equal(aparteDeLaBanda(pagina), '2 h del martes 02/02 suman a enero.');
    // Sin salida otra vez: el día se manda sin la marca (es un borrado)
    await escribirEnLaPlanilla(pagina, '2027-02-02', 'salida', '');
    assert.equal(tilde.classList.contains('vacio'), true);
    assert.equal(M.cuerpoDeLaPlanilla(cambiosDeLaPlanilla(pagina), ['2027-02-02']).dias[0].al_mes_anterior, false);
  });

  // Review Focus 3: la planilla trabaja con los dos meses a la vez
  it('tildar el 02/02 en febrero y, sin guardar, ir a enero: la banda dice 7 h e «Incluye 1,5 h de febrero.» y el bloque lista el 02/02; destildado, 5,5 h y sin bloque', async () => {
    const pagina = montarPagina({ responder: conFebrero({ planillas: SIN_TILDE }) });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    assert.equal(aparteDeLaBanda(pagina), '');
    await tildar(pagina, '2027-02-02');
    await pagina.tocar(pagina.el('mp-anterior'));
    assert.equal(pagina.pedidosA('GET', RUTA_DE_ENERO_27).length, 1);
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Enero 2027');
    // Lo mismo que dice el servidor de enero con el 02/02 guardado tildado
    assert.equal(pagina.el('mp-suma').innerHTML, M.htmlDeLaBandaDeLaPlanilla(ENERO_27.mes, ENERO_27.suma.horas, ENERO_27.hoy, ENERO_27.suma.detalle));
    assert.equal(cifraDeLaBanda(pagina), '7h');
    assert.equal(aparteDeLaBanda(pagina), 'Incluye 1,5 h de febrero.');
    assert.deepEqual(deOtroMes(pagina), ['mp-otro-2027-02-02']);
    assert.equal(totalesDeLasSemanas(pagina).at(-1), '1,5 h');
    // Escribir en enero cambia la banda y las semanas de enero, nunca el total de «De febrero» (no es una semana de enero)
    await escribirEnLaPlanilla(pagina, '2027-01-05', 'salida', '16:16');
    assert.equal(cifraDeLaBanda(pagina), '7,5h');
    assert.equal(totalesDeLasSemanas(pagina).at(-1), '1,5 h');
    await escribirEnLaPlanilla(pagina, '2027-01-05', 'salida', '15:46');
    assert.equal(pagina.el('mp-pendientes').innerHTML, '<b>1 día</b> con cambios sin guardar.');
    // De vuelta a febrero (sin pedirlo otra vez), destildado, y otra vez a enero: 5,5 h, sin la segunda línea y sin el bloque
    await pagina.tocar(pagina.el('mp-siguiente'));
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Febrero 2027');
    assert.equal(tildeDel(pagina, '2027-02-02').checked, true);
    await tildar(pagina, '2027-02-02', false);
    await pagina.tocar(pagina.el('mp-anterior'));
    assert.equal(pagina.pedidosA('GET', RUTA_DE_ENERO_27).length, 1);
    assert.equal(pagina.pedidosA('GET', RUTA_DEL_MES_EN_CURSO).length, 1);
    assert.equal(pagina.pedidosA('GET', RUTA_DE_FEBRERO_27).length, 0);
    assert.equal(cifraDeLaBanda(pagina), '5,5h');
    assert.equal(pagina.el('mp-suma').innerHTML, M.htmlDeLaBandaDeLaPlanilla('2027-01', 5.5, HOY_FEBRERO, ''));
    assert.deepEqual(deOtroMes(pagina), []);
    assert.equal(pagina.el('mp-dias').querySelector('.de-otro-mes'), null);
    assert.equal(pagina.el('mp-pendientes').innerHTML, 'Todo guardado.');
  });

  it('«Ver en febrero» abre febrero (sin pedirlo otra vez si ya llegó) con el foco en el tilde de ese día, y lo anuncia', async () => {
    const pagina = montarPagina({ responder: conFebrero() });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    await pagina.tocar(pagina.el('mp-anterior'));
    assert.deepEqual(deOtroMes(pagina), ['mp-otro-2027-02-02']);
    const ver = pagina.el('mp-otro-2027-02-02').querySelector('[data-ver-en]');
    assert.equal(ver.getAttribute('aria-label'), 'Ver en febrero el martes 02/02');
    ver.focus();
    await pagina.tocar(ver);
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Febrero 2027');
    assert.equal(pagina.pedidosA('GET', RUTA_DEL_MES_EN_CURSO).length, 1);
    assert.equal(pagina.pedidosA('GET', RUTA_DE_FEBRERO_27).length, 0);
    assert.equal(pagina.documento.activeElement, tildeDel(pagina, '2027-02-02'));
    assert.equal(pagina.el('mp-anuncio').textContent, 'Febrero 2027');
  });

  it('«Ver en febrero» desde enero abierto con «Editar» de la pestaña: pide febrero una vez y lleva el foco a su tilde', async () => {
    const pagina = montarPagina({
      hash: '#horas',
      responder: conFebrero({ extra: (metodo, ruta) => (ruta === '/api/mi-espacio/horas-extras' ? ok(tablaDeFebrero(2027)) : undefined) })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-horas').querySelector('[data-mes="2027-01"]'));
    await abrirLaPlanilla(pagina, pagina.el('vista-horas').querySelector('[data-editar-salida="2027-01-05"]'));
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Enero 2027');
    assert.equal(pagina.pedidosA('GET', RUTA_DE_ENERO_27).length, 1);
    // El bloque, con lo que mandó el servidor (febrero todavía no se pidió)
    assert.deepEqual(deOtroMes(pagina), ['mp-otro-2027-02-02']);
    assert.equal(cifraDeLaBanda(pagina), '7h');
    await pagina.tocar(pagina.el('mp-otro-2027-02-02').querySelector('[data-ver-en]'));
    assert.equal(pagina.pedidosA('GET', RUTA_DE_FEBRERO_27).length, 1);
    assert.equal(pagina.el('mp-mes-titulo').textContent, 'Febrero 2027');
    assert.equal(pagina.documento.activeElement, tildeDel(pagina, '2027-02-02'));
    assert.equal(pagina.el('mp-anuncio').textContent, 'Febrero 2027');
    // Volver a enero no lo pide otra vez; el bloque, ahora con febrero ya pedido, dice lo mismo
    await pagina.tocar(pagina.el('mp-anterior'));
    assert.equal(pagina.pedidosA('GET', RUTA_DE_ENERO_27).length, 1);
    assert.deepEqual(deOtroMes(pagina), ['mp-otro-2027-02-02']);
  });

  it('«Ver en febrero» a un día sin tilde: el foco va a su «Quitar» o, sin él, a la fila (nunca al <body>)', async () => {
    // El 02/02, tildado y con su salida, en una fila sin tilde: un día que pasó a ser de licencia de día entero (con «Quitar») o,
    // para probar el último respaldo, uno sin campos ni «Quitar»
    const conEl02 = (cambio) => ({ ...FEBRERO_27, dias: FEBRERO_27.dias.map((dia) => (dia.fecha === '2027-02-02' ? { ...dia, ...cambio } : dia)) });
    const casos = [
      { cambio: { licencia: { texto: 'Vacaciones', entera: true } }, foco: (fila) => fila.querySelector('[data-quitar]') },
      { cambio: { futuro: true }, foco: (fila) => fila }
    ];
    for (const { cambio, foco } of casos) {
      const pagina = montarPagina({ responder: conFebrero({ planillas: { enero: ENERO_27, febrero: conEl02(cambio) } }) });
      await pagina.iniciar();
      await abrirLaPlanilla(pagina);
      assert.equal(tildeDel(pagina, '2027-02-02'), null);
      await pagina.tocar(pagina.el('mp-anterior'));
      assert.deepEqual(deOtroMes(pagina), ['mp-otro-2027-02-02']);
      const ver = pagina.el('mp-otro-2027-02-02').querySelector('[data-ver-en]');
      ver.focus();
      await pagina.tocar(ver);
      assert.equal(pagina.el('mp-mes-titulo').textContent, 'Febrero 2027');
      const fila = pagina.el('mp-dia-2027-02-02');
      const esperado = foco(fila);
      assert.ok(esperado, JSON.stringify(cambio));
      assert.notEqual(pagina.documento.activeElement, null, JSON.stringify(cambio));
      assert.notEqual(pagina.documento.activeElement, pagina.documento.body, JSON.stringify(cambio));
      assert.equal(pagina.documento.activeElement, esperado, JSON.stringify(cambio));
      if (esperado === fila) assert.equal(fila.getAttribute('tabindex'), '-1');
    }
  });

  it('«Guardar» manda un solo PUT con el tilde de cada día cambiado, de todos los meses', async () => {
    const pagina = montarPagina({
      responder: conFebrero({ extra: (metodo, ruta) => (metodo === 'PUT' && ruta === RUTA_DEL_GUARDADO ? guardadas(4) : undefined) })
    });
    await pagina.iniciar();
    await abrirLaPlanilla(pagina);
    await tildar(pagina, '2027-02-03');
    await tildar(pagina, '2027-02-02', false);
    await escribirEnLaPlanilla(pagina, '2027-02-01', 'salida', '16:00');
    await pagina.tocar(pagina.el('mp-anterior'));
    await tildar(pagina, '2027-01-12');
    assert.equal(pagina.el('mp-pendientes').innerHTML, '<b>4 días</b> con cambios sin guardar (enero y febrero).');
    await pagina.tocar(pagina.el('mp-guardar'));
    assert.deepEqual(pagina.pedidosA('PUT', RUTA_DEL_GUARDADO).map((pedido) => pedido.cuerpo), [{ dias: [
      { fecha: '2027-01-12', entrada: '', salida: '16:16', nota: 'Actualización del tablero de obras', al_mes_anterior: true },
      { fecha: '2027-02-01', entrada: '', salida: '16:00', nota: '', al_mes_anterior: false },
      { fecha: '2027-02-02', entrada: '', salida: '16:20', nota: '', al_mes_anterior: false },
      { fecha: '2027-02-03', entrada: '', salida: '15:50', nota: '', al_mes_anterior: true }
    ] }]);
    assert.equal(pagina.abierto('modal-planilla'), false);
    assert.deepEqual(pagina.estado.toasts, [['Horas extras guardadas: 4 días.', 'success']]);
  });
});

// Los estilos de la planilla (spec 2026-10-27-mi-espacio-horas, sección 9: contraste de 4,5:1 en los textos y 3:1 en los bordes de
// los controles), leídos del <style> de mi-espacio.html: el color de cada texto contra su fondo
describe('mi-espacio.html: los estilos de la planilla', () => {
  const estilo = estiloDeLaPagina();
  // Un color del <style>: un token --sg-* (su #RRGGBB de :root) o un #RGB / #RRGGBB
  const color = (valor) => {
    const token = /var\((--sg-[\w-]+)\)/.exec(valor)?.[1];
    const hex = token ? new RegExp(`${token}: (#[0-9A-Fa-f]{6});`).exec(estilo)?.[1] : /#[0-9A-Fa-f]{3,6}\b/.exec(valor)?.[0];
    assert.ok(hex, `el color de ${valor}`);
    return hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  };
  const de = (selector, propiedad) => {
    const regla = reglaDe(selector);
    assert.ok(regla, selector);
    const valor = new RegExp(`(?:^|[;{\\s])${propiedad}: ([^;]+);`).exec(regla)?.[1];
    assert.ok(valor, `${selector} { ${propiedad} }`);
    return color(valor);
  };
  const BLANCO = '#FFFFFF';

  it('los textos, con 4,5:1 o más sobre su fondo', () => {
    const feriado = de('.mp-dia.feriado', 'background');
    const licencia = de('.mp-dia.licencia', 'background');
    const pares = [
      ['las horas', de('.mp-horas b', 'color'), de('.mp-horas b', 'background')],
      ['el 0', de('.mp-horas b.cero', 'color'), de('.mp-horas b.cero', 'background')],
      ['lo que falta, en un feriado', de('.mp-horas small', 'color'), feriado],
      ['la entrada opcional vacía', de('.mp-dia input.opcional[data-vacio="1"]', 'color'), de('.mp-dia input.opcional[data-vacio="1"]', 'background')],
      ['la entrada o la salida', de('.mp-dia input[type="time"]', 'color'), BLANCO],
      ['lo de un día de licencia', de('.mp-lugar', 'color'), licencia],
      ['la salida de antes de una licencia', de('.mp-guardada', 'color'), licencia],
      ['el error, en un feriado', de('.mp-error', 'color'), feriado],
      ['el error, en una licencia', de('.mp-error', 'color'), licencia],
      ['el aviso, en un feriado', de('.mp-aviso', 'color'), feriado],
      ['el aviso, en una licencia', de('.mp-aviso', 'color'), licencia],
      ['la nota', de('.mp-nota-vista', 'color'), feriado],
      ['las columnas', de('.mp-columnas', 'color'), de('.mp-columnas', 'background')],
      ['la semana', de('.mp-semana', 'color'), BLANCO],
      ['un día que no llegó', de('.mp-dia.futuro .mp-fecha b', 'color'), BLANCO],
      ['«Hoy»', de('.mp-hoy', 'color'), de('.mp-hoy', 'background')],
      ['la frase de la banda', de('.mp-suma-texto', 'color'), de('.mp-suma', 'background')],
      ['la «h» del total', de('.mp-suma-cifra small', 'color'), de('.mp-suma', 'background')],
      ['el total', de('.mp-suma-cifra', 'color'), de('.mp-suma', 'background')],
      ['«Sumar»', de('.mp-sumar p', 'color'), BLANCO],
      ['el pie', de('.mp-pendientes', 'color'), BLANCO],
      ['las horas del día por día', de('.me-dia-horas', 'color'), de('.me-dia-horas', 'background')],
      ['el aviso del día por día', de('.me-fila-cuerpo .me-fila-aviso', 'color'), BLANCO]
    ];
    for (const [nombre, texto, fondo] of pares) {
      assert.ok(contraste(texto, fondo) >= 4.5, `${nombre}: ${texto} sobre ${fondo}, ${contraste(texto, fondo).toFixed(2)}:1`);
    }
  });

  // «Sumar a {mes anterior}» (spec 2026-10-30-mi-espacio-horas-mes-anterior, secciones 4 y 5): el tilde, la pastilla punteada de un
  // día tildado y «→ enero», la segunda línea de la banda, el bloque «De febrero» y, en la pestaña, la pastilla y «Suma a enero»
  it('«Sumar a {mes anterior}»: los textos nuevos, con 4,5:1 o más sobre su fondo, y el borde punteado, con 3:1 o más', () => {
    const feriado = de('.mp-dia.feriado', 'background');
    const licencia = de('.mp-dia.licencia', 'background');
    const hover = de('.mp-dia:hover', 'background');
    const deOtroMes = de('.mp-dia.de-otro-mes', 'background');
    const pares = [
      ['el tilde', de('.mp-tilde', 'color'), BLANCO],
      ['el tilde, en un feriado', de('.mp-tilde', 'color'), feriado],
      ['el tilde, con el puntero', de('.mp-tilde', 'color'), de('.mp-tilde:hover', 'background')],
      ['el tilde tildado', de('.mp-tilde input:checked + span', 'color'), BLANCO],
      ['el tilde tildado, en un feriado', de('.mp-tilde input:checked + span', 'color'), feriado],
      ['la pastilla de un día tildado', de('.mp-horas b.otro-mes', 'color'), de('.mp-horas b.otro-mes', 'background')],
      ['«→ enero»', de('.mp-horas small.mp-va-a', 'color'), BLANCO],
      ['«→ enero», en un feriado', de('.mp-horas small.mp-va-a', 'color'), feriado],
      ['«→ enero», en una licencia', de('.mp-horas small.mp-va-a', 'color'), licencia],
      ['«→ enero», con el puntero', de('.mp-horas small.mp-va-a', 'color'), hover],
      ['la segunda línea de la banda', de('.mp-suma-aparte', 'color'), de('.mp-suma', 'background')],
      ['un día de «De febrero»', de('.mp-fecha b', 'color'), deOtroMes],
      ['su salida', de('.mp-guardada', 'color'), deOtroMes],
      ['su entrada', de('.mp-guardada small', 'color'), deOtroMes],
      ['sus horas', de('.mp-horas b', 'color'), de('.mp-horas b', 'background')],
      ['la pastilla de la pestaña', de('.me-dia-horas.otro-mes', 'color'), de('.me-dia-horas.otro-mes', 'background')],
      ['«Suma a enero»', de('.me-fila-cuerpo .me-fila-otro-mes', 'color'), BLANCO]
    ];
    for (const [nombre, texto, fondo] of pares) {
      assert.ok(contraste(texto, fondo) >= 4.5, `${nombre}: ${texto} sobre ${fondo}, ${contraste(texto, fondo).toFixed(2)}:1`);
    }
    // El borde punteado de la pastilla (en la planilla y en la pestaña), contra el blanco de adentro y el fondo de cada fila
    for (const selector of ['.mp-horas b.otro-mes', '.me-dia-horas.otro-mes']) {
      const borde = de(selector, 'border');
      assert.match(reglaDe(selector), /border: 1\.5px dashed var\(--sg-[\w-]+\);/, selector);
      for (const fondo of [BLANCO, feriado, licencia, hover]) {
        assert.ok(contraste(borde, fondo) >= 3, `${selector}: ${borde} sobre ${fondo}, ${contraste(borde, fondo).toFixed(2)}:1`);
      }
    }
  });

  it('el borde de los campos, con 3:1 o más sobre su fondo y sobre el de cada fila', () => {
    const borde = de('.mp-dia input[type="time"]', 'border');
    for (const fondo of [BLANCO, de('.mp-dia.feriado', 'background'), de('.mp-dia.licencia', 'background'),
      de('.mp-dia input.opcional[data-vacio="1"]', 'background'), de('.mp-dia:hover', 'background')]) {
      assert.ok(contraste(borde, fondo) >= 3, `${borde} sobre ${fondo}: ${contraste(borde, fondo).toFixed(2)}:1`);
    }
    assert.equal(de('.mp-nota-campo input', 'border'), borde);
  });
});

// =====================================================================================================================================
// Una licencia de otro año y los avisos para revisar (spec 2026-10-28-mi-espacio-licencia-anulada, 2.2, 2.3 y 3.5): la persona de
// planta con sus vacaciones de noviembre pasadas a enero de 2027 (la 20, del 04/01 al 15/01/2027), que en Configuración quedaron del
// 04/01 al 08/01. Los datos, como los arma el servidor: resumenDe con los vínculos (`para_revisar` y la oración de lo cargado con su
// `anio`), filasDeLicencias (`otros_anios`) y textoDeLaListaDe (`lista` del segundo paso, en respuestaDeLaNota)
// =====================================================================================================================================

const DE_ENERO = licencia(20, 'vacaciones', '2027-01-04', '2027-01-15');
const CON_ENERO = Object.freeze({ ...PLANTA.estado, licencias: [...PLANTA.estado.licencias.filter((fila) => fila.id !== 6), DE_ENERO] });
// El vínculo de una fila con Configuración como lo da vinculosDe, con lo que hay que revisar
const conRevision = (motivo, desde = null, hasta = null) => ({ configuracion: null, revision: { motivo, desde, hasta } });
const RESUMEN_CON_ENERO = resumenDel(PLANTA, {
  estado: CON_ENERO, vinculos: new Map([[20, conRevision('fechas', '2027-01-04', '2027-01-08')]])
});
const LISTA_2026_CON_ENERO = licenciasDe(PLANTA, { estado: CON_ENERO });
const LISTA_2027_CON_ENERO = licenciasDe(PLANTA, { estado: CON_ENERO, anio: 2027 });
const [PARA_REVISAR_DE_ENERO] = RESUMEN_CON_ENERO.para_revisar;
const AVISO_AMBAR = (items) => `<div class="me-aviso me-aviso-ambar"><ul class="me-faltantes">${items}</ul></div>`;
const LINK_A_2027 = '<a href="#licencias" data-pestana="licencias" data-anio-licencias="2027">Ver en Licencias de 2027</a>';
const FALTANTE_DE_FEBRERO = 'Revisá tus francos de febrero de 2027: cargaste 1 y no corresponde ninguno.';
const OTROS_DE_2027 = '<p class="me-otros-anios">También tenés 1 licencia cargada en 2027. '
  + '<button type="button" data-anio="2027">Ver 2027</button></p>';
const NO_ENTEROS = Object.freeze(['2027', 2027.5, null, undefined, Number.NaN, MALICIOSO, {}]);

describe('otro año y para revisar: lo puro', () => {
  it('los datos de prueba son los del servidor: el aviso para revisar, la oración de lo cargado con su año y los otros años', () => {
    assert.deepEqual(RESUMEN_CON_ENERO.para_revisar, [{
      licencia_id: 20, anio: 2027, texto: 'Revisá tu licencia del 04/01 al 15/01/2027: en Configuración quedó del 04/01 al 08/01.',
      enlace: 'Ver en Licencias de 2027'
    }]);
    assert.deepEqual(RESUMEN_CON_ENERO.faltantes, []);
    assert.deepEqual(RESUMEN_CON_ENERO.titular.bajada[1], { texto: '10 ya están cargados para enero de 2027.', vence: false, anio: 2027 });
    assert.deepEqual(LISTA_2026_CON_ENERO.otros_anios, [{ anio: 2027, cantidad: 1, texto: 'También tenés 1 licencia cargada en 2027.' }]);
    assert.deepEqual(LISTA_2027_CON_ENERO.otros_anios, []);
  });

  it('htmlDeFaltantes: los faltantes como siempre y después cada aviso para revisar, con su link a Licencias de su año', () => {
    const { texto } = PARA_REVISAR_DE_ENERO;
    // Los dos
    assert.equal(M.htmlDeFaltantes([FALTANTE_DE_FEBRERO], [PARA_REVISAR_DE_ENERO]),
      AVISO_AMBAR(`<li>${FALTANTE_DE_FEBRERO}</li><li>${texto} ${LINK_A_2027}</li>`));
    // Solo el aviso para revisar: en la lista igual
    assert.equal(M.htmlDeFaltantes([], [PARA_REVISAR_DE_ENERO]), AVISO_AMBAR(`<li>${texto} ${LINK_A_2027}</li>`));
    assert.equal(M.htmlDeFaltantes(undefined, [PARA_REVISAR_DE_ENERO]), AVISO_AMBAR(`<li>${texto} ${LINK_A_2027}</li>`));
    // Solo los faltantes: como siempre (uno, un párrafo)
    assert.equal(M.htmlDeFaltantes([FALTANTE_DE_FEBRERO], []), `<p class="me-aviso me-aviso-ambar">${FALTANTE_DE_FEBRERO}</p>`);
    assert.equal(M.htmlDeFaltantes([FALTANTE_DE_FEBRERO]), `<p class="me-aviso me-aviso-ambar">${FALTANTE_DE_FEBRERO}</p>`);
    // Ninguno (o lo que no es un aviso con texto): nada
    for (const raro of [[], undefined, null, 'x', 3, [{}], [{ anio: 2027, enlace: 'Ver' }], [{ texto: '  ', anio: 2027 }], [null]]) {
      assert.equal(M.htmlDeFaltantes([], raro), '', JSON.stringify(raro));
    }
    assert.equal(M.htmlDeFaltantes(), '');
  });

  it('htmlDeFaltantes: todo texto del servidor escapado, también el del link; un año que no es entero, o sin texto del link, sin link', () => {
    const malo = M.htmlDeFaltantes([], [{ licencia_id: 20, anio: 2027, texto: '<script>alert(1)</script>', enlace: '<script>ver</script>' }]);
    assert.equal(malo, AVISO_AMBAR('<li>&lt;script&gt;alert(1)&lt;/script&gt; <a href="#licencias" data-pestana="licencias" '
      + 'data-anio-licencias="2027">&lt;script&gt;ver&lt;/script&gt;</a></li>'));
    assert.ok(!malo.includes('<script>'));
    for (const anio of NO_ENTEROS) {
      assert.equal(M.htmlDeFaltantes([], [{ ...PARA_REVISAR_DE_ENERO, anio }]), AVISO_AMBAR(`<li>${PARA_REVISAR_DE_ENERO.texto}</li>`),
        String(anio));
    }
    for (const enlace of ['', '  ', null, 3]) {
      assert.equal(M.htmlDeFaltantes([], [{ ...PARA_REVISAR_DE_ENERO, enlace }]), AVISO_AMBAR(`<li>${PARA_REVISAR_DE_ENERO.texto}</li>`),
        String(enlace));
    }
  });

  it('htmlDelResumen le pasa `para_revisar`: el aviso ámbar va arriba de todo, antes de la banda; sin ninguno, no hay aviso', () => {
    const html = M.htmlDelResumen(RESUMEN_CON_ENERO);
    assert.ok(html.startsWith(`${AVISO_AMBAR(`<li>${PARA_REVISAR_DE_ENERO.texto} ${LINK_A_2027}</li>`)}<section class="me-banda"`));
    assert.ok(!M.htmlDelResumen({ ...RESUMEN_CON_ENERO, para_revisar: [] }).includes('me-aviso-ambar'));
    // Un Resumen de antes, sin `para_revisar`, como siempre
    const deAntes = { ...RESUMEN_CON_ENERO };
    delete deAntes.para_revisar;
    assert.ok(M.htmlDelResumen(deAntes).startsWith('<section class="me-banda"'));
  });

  it('htmlDeLaFrase: la oración de lo cargado, con su año, es un link a Licencias de ese año; la que vence sigue en negrita', () => {
    assert.equal(M.htmlDeLaFrase(RESUMEN_CON_ENERO.titular).match(/<p class="me-frase-bajada">[\s\S]*?<\/p>/)[0],
      '<p class="me-frase-bajada"><b class="vence">8 vencen el jueves 31/12.</b> <a href="#licencias" data-pestana="licencias" '
      + 'data-anio-licencias="2027" class="me-frase-link">10 ya están cargados para enero de 2027.</a> '
      + 'Otros 10 se habilitan el 1/1/2027.</p>');
    // Sin año, o con uno que no es entero (un null del servidor), el texto solo
    for (const anio of NO_ENTEROS) {
      const bajada = RESUMEN_CON_ENERO.titular.bajada.map((oracion) => (Object.hasOwn(oracion, 'anio') ? { ...oracion, anio } : oracion));
      const html = M.htmlDeLaFrase({ ...RESUMEN_CON_ENERO.titular, bajada });
      assert.ok(!html.includes('me-frase-link'), String(anio));
      assert.ok(!html.includes('data-anio-licencias'), String(anio));
      assert.ok(html.includes('</b> 10 ya están cargados para enero de 2027. Otros 10'), String(anio));
    }
    // El texto, escapado también en el link
    const malo = M.htmlDeLaFrase({ ...RESUMEN_CON_ENERO.titular, bajada: [{ texto: MALICIOSO, vence: false, anio: 2027 }] });
    assert.ok(malo.includes(`<a href="#licencias" data-pestana="licencias" data-anio-licencias="2027" class="me-frase-link">${ESCAPADO}</a>`));
    assert.ok(!malo.includes(MALICIOSO));
  });

  it('la lista: debajo de la cabeza, cada otro año con su texto y «Ver AAAA» (el data-anio del selector)', () => {
    const lista = M.htmlDeListaDeLicencias(LISTA_2026_CON_ENERO, 'todas');
    assert.ok(lista.includes(`Cargar licencia</button></span></div>${OTROS_DE_2027}<div class="sg-chips"`));
    assert.equal(lista.split('me-otros-anios').length - 1, 1);
    const ver = botonesDe(lista).find((boton) => boton.texto === 'Ver 2027');
    assert.deepEqual(ver.atributos, { type: 'button', 'data-anio': '2027' });
    // Sin otros años, nada
    assert.ok(!M.htmlDeListaDeLicencias(LISTA_2027_CON_ENERO, 'todas').includes('me-otros-anios'));
    // Varios, en su orden; con otro filtro, también; sin licencias en el año que se ve, también (antes del vacío)
    const varios = {
      ...LISTA_2026_CON_ENERO,
      otros_anios: [{ anio: 2025, cantidad: 2, texto: 'También tenés 2 licencias cargadas en 2025.' }, ...LISTA_2026_CON_ENERO.otros_anios]
    };
    const de2025 = '<p class="me-otros-anios">También tenés 2 licencias cargadas en 2025. '
      + '<button type="button" data-anio="2025">Ver 2025</button></p>';
    assert.ok(M.htmlDeListaDeLicencias(varios, 'franquicia').includes(`</div>${de2025}${OTROS_DE_2027}<div class="sg-chips"`));
    const vacia = { ...LISTA_2027_CON_ENERO, licencias: [], filtros: [], otros_anios: LISTA_2026_CON_ENERO.otros_anios };
    assert.ok(M.htmlDeListaDeLicencias(vacia, 'todas').includes(`</div>${OTROS_DE_2027}<p class="me-vacio">`));
  });

  it('la lista: el texto de otros años escapado; un año que no es entero, el texto sin el botón; lo que no es un aviso con texto, nada', () => {
    const malo = M.htmlDeListaDeLicencias({ ...LISTA_2026_CON_ENERO, otros_anios: [{ anio: 2027, cantidad: 1, texto: MALICIOSO }] }, 'todas');
    assert.ok(malo.includes(`<p class="me-otros-anios">${ESCAPADO} <button type="button" data-anio="2027">Ver 2027</button></p>`));
    assert.ok(!malo.includes(MALICIOSO));
    for (const anio of NO_ENTEROS) {
      const html = M.htmlDeListaDeLicencias({ ...LISTA_2026_CON_ENERO, otros_anios: [{ anio, cantidad: 1, texto: 'También tenés 1.' }] }, 'todas');
      assert.ok(html.includes('<p class="me-otros-anios">También tenés 1.</p>'), String(anio));
    }
    for (const raro of [undefined, null, 'x', [{}], [{ anio: 2027, texto: '' }], [null]]) {
      assert.ok(!M.htmlDeListaDeLicencias({ ...LISTA_2026_CON_ENERO, otros_anios: raro }, 'todas').includes('me-otros-anios'),
        JSON.stringify(raro));
    }
    // Sin modalidad, solo el mensaje
    assert.equal(M.htmlDeListaDeLicencias({ ...SIN_MODALIDAD, otros_anios: LISTA_2026_CON_ENERO.otros_anios }, 'todas'),
      M.htmlDeMensaje(MENSAJES_MI_ESPACIO.sinModalidad));
  });

  it('htmlDelSegundoPaso: `lista`, escapada, después de la licencia guardada; sin ella (la del año en curso), nada', () => {
    const nota = respuestaDeLaNota(conLicencias(PLANTA.estado, licencia(10, 'vacaciones', '2027-02-01', '2027-02-05')), 10);
    assert.equal(nota.lista, 'Está en la lista de 2027.');
    const html = M.htmlDelSegundoPaso({ ...nota, avisos: [] });
    assert.ok(html.includes('</div></div><p class="me-paso-dos-lista">Está en la lista de 2027.</p><h3 class="me-paso-dos-titulo">'));
    // Sin la fila, después de los avisos
    assert.ok(M.htmlDelSegundoPaso({ lista: nota.lista, avisos: [TEXTO_NO_SE_COPIA] }).startsWith(
      `<div class="me-recuadro ambar"><p>${TEXTO_NO_SE_COPIA}</p></div><p class="me-paso-dos-lista">Está en la lista de 2027.</p>`));
    assert.equal(NOTA_DE_LA_NUEVE.lista, null);
    assert.ok(!M.htmlDelSegundoPaso({ ...NOTA_DE_LA_NUEVE, avisos: [] }).includes('me-paso-dos-lista'));
    for (const lista of [null, undefined, '', '  ', 3, {}]) {
      assert.ok(!M.htmlDelSegundoPaso({ ...nota, lista }).includes('me-paso-dos-lista'), String(lista));
    }
    const malo = M.htmlDelSegundoPaso({ ...nota, lista: MALICIOSO });
    assert.ok(malo.includes(`<p class="me-paso-dos-lista">${ESCAPADO}</p>`));
    assert.ok(!malo.includes(MALICIOSO));
  });

  it('anioDeLaLicencia: el año de un AAAA-MM-DD; lo demás, null', () => {
    assert.equal(M.anioDeLaLicencia('2027-01-04'), 2027);
    assert.equal(M.anioDeLaLicencia('2026-12-31'), 2026);
    for (const raro of ['2027-1-4', '2027-02-30', '2027-01-04T00:00', '', ' 2027-01-04', null, undefined, 5, 2027, {}, ['2027-01-04']]) {
      assert.equal(M.anioDeLaLicencia(raro), null, String(raro));
    }
  });
});

// Lo que contesta el servidor falso con las vacaciones de enero: el Resumen con el aviso para revisar, las listas de 2025 a 2027 y,
// con `alta`, el alta de la 20; `extra`, como en conFormularios
const ALTA_DE_LA_VEINTE = respuesta(201, { success: true, data: { id: 20 }, message: 'Licencia cargada.' });
const conEnero = ({ alta = false, extra = () => undefined } = {}) => conFormularios({
  extra: (metodo, ruta, cuerpo) => {
    const propia = extra(metodo, ruta, cuerpo);
    if (propia !== undefined) return propia;
    if (alta && metodo === 'POST' && ruta === '/api/mi-espacio/licencias') return ALTA_DE_LA_VEINTE;
    if (ruta === '/api/mi-espacio/resumen') return ok(RESUMEN_CON_ENERO);
    if (ruta === '/api/mi-espacio/licencias' || ruta === '/api/mi-espacio/licencias?anio=2026') return ok(LISTA_2026_CON_ENERO);
    if (ruta === '/api/mi-espacio/licencias?anio=2027') return ok(LISTA_2027_CON_ENERO);
    if (ruta === '/api/mi-espacio/licencias?anio=2025') return ok(licenciasDe(PLANTA, { estado: CON_ENERO, anio: 2025 }));
    return undefined;
  }
});
// Los pedidos de la lista de licencias (los GET), en orden; el título de la lista que se ve; la pestaña elegida; y el año que la
// lista tiene que mostrar la próxima vez que se pida
const pedidosDeLaLista = (pagina) => pagina.estado.pedidos
  .filter(({ metodo, ruta }) => metodo === 'GET' && /^\/api\/mi-espacio\/licencias(?:\?|$)/.test(ruta)).map(({ ruta }) => ruta);
const tituloDeLaLista = (pagina) => pagina.el('vista-licencias').querySelector('h2')?.textContent ?? null;
const pestanaElegida = (pagina) => ['resumen', 'licencias', 'horas', 'agenda']
  .find((nombre) => pagina.el(`tab-${nombre}`).getAttribute('aria-selected') === 'true');
const anioPendienteDe = (pagina) => vm.runInContext('pagina.anioDeLicencias', pagina.contexto);

describe('otro año y para revisar en la página (DOM falso)', () => {
  it('guardar una licencia de 2027 con Licencias abierta en 2026 pide la lista de 2027, y el segundo paso dice en qué lista quedó', async () => {
    const pagina = montarPagina({ hash: '#licencias', responder: conEnero({ alta: true }) });
    await pagina.iniciar();
    assert.equal(tituloDeLaLista(pagina), 'Mis licencias de 2026');
    await cargarLicencia(pagina, { desde: '2027-01-04', hasta: '2027-01-15' });
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.deepEqual(pedidosDeLaLista(pagina), ['/api/mi-espacio/licencias', '/api/mi-espacio/licencias?anio=2027']);
    assert.equal(tituloDeLaLista(pagina), 'Mis licencias de 2027');
    assert.ok(pagina.el('vista-licencias').querySelector('[data-editar-licencia="20"]'));
    assert.equal(pagina.el('ml-paso-dos').querySelector('.me-paso-dos-lista').textContent, 'Está en la lista de 2027.');
    // Se usó una sola vez: ir y volver de la pestaña no la pide de nuevo
    assert.equal(anioPendienteDe(pagina), null);
    await pagina.tocar(listo(pagina));
    await pagina.tocar(pagina.el('tab-resumen'));
    await pagina.tocar(pagina.el('tab-licencias'));
    assert.equal(pedidosDeLaLista(pagina).length, 2);
    assert.equal(tituloDeLaLista(pagina), 'Mis licencias de 2027');
  });

  it('guardarla desde el Resumen, con Licencias sin abrir: al abrirla, la lista de 2027 (Review Focus 5); también desde «Vence pronto»', async () => {
    const abrir = {
      encabezado: async (pagina) => { await cargarLicencia(pagina, { desde: '2027-01-04', hasta: '2027-01-15' }); },
      'vence pronto': async (pagina) => {
        await pagina.tocar(pagina.el('vista-resumen').querySelector('[data-accion="cargar-licencia"][data-tipo="vacaciones"]'));
        await pagina.correr();
        await pagina.escribir('ml-desde', '2027-01-04');
        await pagina.escribir('ml-hasta', '2027-01-15');
        await pagina.correr();
      }
    };
    for (const [desde, hacer] of Object.entries(abrir)) {
      const pagina = montarPagina({ responder: conEnero({ alta: true }) });
      await pagina.iniciar();
      await hacer(pagina);
      assert.equal(pagina.el('ml-tipos').querySelector('input:checked')?.getAttribute('value'), 'vacaciones', desde);
      await pagina.tocar(pagina.el('ml-guardar'));
      assert.equal(pagina.el('modal-licencia-titulo').textContent, 'Licencia cargada', desde);
      assert.deepEqual(pedidosDeLaLista(pagina), [], `${desde}: la lista no se pidió`);
      assert.equal(anioPendienteDe(pagina), 2027, desde);
      await pagina.tocar(listo(pagina));
      await pagina.tocar(pagina.el('tab-licencias'));
      assert.deepEqual(pedidosDeLaLista(pagina), ['/api/mi-espacio/licencias?anio=2027'], desde);
      assert.equal(tituloDeLaLista(pagina), 'Mis licencias de 2027', desde);
      assert.equal(anioPendienteDe(pagina), null, desde);
    }
  });

  it('una del año en curso pide la lista sin ?anio=: desde Licencias en 2025 y desde el Resumen', async () => {
    // Desde Licencias en 2025: la lista pasa al año en curso, sin ?anio=
    const enLicencias = montarPagina({ hash: '#licencias', responder: conEnero() });
    await enLicencias.iniciar();
    await enLicencias.tocar(enLicencias.el('vista-licencias').querySelector('[data-anio="2025"]'));
    assert.equal(tituloDeLaLista(enLicencias), 'Mis licencias de 2025');
    await cargarLicencia(enLicencias);
    await enLicencias.tocar(enLicencias.el('ml-guardar'));
    assert.deepEqual(pedidosDeLaLista(enLicencias),
      ['/api/mi-espacio/licencias', '/api/mi-espacio/licencias?anio=2025', '/api/mi-espacio/licencias']);
    assert.equal(tituloDeLaLista(enLicencias), 'Mis licencias de 2026');
    assert.equal(enLicencias.el('ml-paso-dos').querySelector('.me-paso-dos-lista'), null);

    // Desde el Resumen: al abrir Licencias, también sin ?anio=
    const enElResumen = montarPagina({ responder: conEnero() });
    await enElResumen.iniciar();
    await cargarLicencia(enElResumen);
    await enElResumen.tocar(enElResumen.el('ml-guardar'));
    await enElResumen.tocar(listo(enElResumen));
    await enElResumen.tocar(enElResumen.el('tab-licencias'));
    assert.deepEqual(pedidosDeLaLista(enElResumen), ['/api/mi-espacio/licencias']);
  });

  it('un uso autorizado de 2027 también: al abrir Licencias, la lista de su año', async () => {
    const pagina = montarPagina({
      hash: '#horas',
      responder: conEnero({
        extra: (metodo, ruta) => (metodo === 'POST' && ruta === '/api/mi-espacio/licencias'
          ? respuesta(201, { success: true, data: { id: 21 }, message: 'Uso autorizado registrado.' }) : undefined)
      })
    });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('vista-horas').querySelector('[data-abrir="uso"]'));
    await pagina.escribir('mu-fecha', '2027-01-04');
    await pagina.correr();
    await pagina.tocar(pagina.el('mu-guardar'));
    assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/licencias').at(-1).cuerpo.desde, '2027-01-04');
    assert.equal(pagina.abierto('modal-uso'), false);
    assert.equal(anioPendienteDe(pagina), 2027);
    await pagina.tocar(pagina.el('tab-licencias'));
    assert.deepEqual(pedidosDeLaLista(pagina), ['/api/mi-espacio/licencias?anio=2027']);
  });

  it('el link de la bajada y el del aviso para revisar abren Licencias en su año, con el foco en la pestaña; si ya lo muestra, no la piden', async () => {
    const pagina = montarPagina({ responder: conEnero() });
    await pagina.iniciar();
    const vista = pagina.el('vista-resumen');
    const bajada = vista.querySelector('.me-frase-link');
    assert.equal(bajada.getAttribute('data-anio-licencias'), '2027');
    const clic = bajada.disparar('click');
    await pagina.esperar();
    assert.equal(clic.defaultPrevented, true);
    assert.equal(pestanaElegida(pagina), 'licencias');
    assert.equal(pagina.documento.activeElement, pagina.el('tab-licencias'));
    assert.deepEqual(pedidosDeLaLista(pagina), ['/api/mi-espacio/licencias?anio=2027']);
    assert.equal(tituloDeLaLista(pagina), 'Mis licencias de 2027');
    assert.equal(pagina.el('me-anuncio').textContent, 'Mis licencias de 2027');

    // El del aviso para revisar: la lista ya muestra 2027, no la pide de nuevo
    await pagina.tocar(pagina.el('tab-resumen'));
    const aviso = vista.querySelector('.me-faltantes a');
    assert.equal(aviso.textContent, 'Ver en Licencias de 2027');
    await pagina.tocar(aviso);
    assert.equal(pestanaElegida(pagina), 'licencias');
    assert.equal(pagina.documento.activeElement, pagina.el('tab-licencias'));
    assert.equal(pedidosDeLaLista(pagina).length, 1);

    // Con la lista en 2026, la pide en 2027
    await pagina.tocar(pagina.el('vista-licencias').querySelector('[data-anio="2026"]'));
    assert.equal(tituloDeLaLista(pagina), 'Mis licencias de 2026');
    await pagina.tocar(pagina.el('tab-resumen'));
    await pagina.tocar(vista.querySelector('.me-faltantes a'));
    assert.deepEqual(pedidosDeLaLista(pagina),
      ['/api/mi-espacio/licencias?anio=2027', '/api/mi-espacio/licencias?anio=2026', '/api/mi-espacio/licencias?anio=2027']);
    assert.equal(tituloDeLaLista(pagina), 'Mis licencias de 2027');
    assert.equal(pagina.documento.activeElement, pagina.el('tab-licencias'));
  });

  it('con Ctrl, Cmd, Mayúsculas, Alt o un botón que no es el principal, el link hace lo suyo: no cambia la pestaña ni pide nada', async () => {
    for (const modificador of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      const pagina = montarPagina({ responder: conEnero() });
      await pagina.iniciar();
      const clic = pagina.el('vista-resumen').querySelector('.me-frase-link').disparar('click', modificador);
      await pagina.esperar();
      assert.equal(clic.defaultPrevented, false, JSON.stringify(modificador));
      assert.equal(pestanaElegida(pagina), 'resumen', JSON.stringify(modificador));
      assert.deepEqual(pedidosDeLaLista(pagina), [], JSON.stringify(modificador));
      assert.equal(anioPendienteDe(pagina), null, JSON.stringify(modificador));
    }
  });

  it('«Ver 2027» de otros años pide ese año, el foco va a 2027 en el selector y se anuncia el título', async () => {
    const pagina = montarPagina({ hash: '#licencias', responder: conEnero() });
    await pagina.iniciar();
    const ver = pagina.el('vista-licencias').querySelector('.me-otros-anios button');
    assert.equal(ver.textContent, 'Ver 2027');
    ver.focus();
    await pagina.tocar(ver);
    assert.deepEqual(pedidosDeLaLista(pagina), ['/api/mi-espacio/licencias', '/api/mi-espacio/licencias?anio=2027']);
    assert.equal(tituloDeLaLista(pagina), 'Mis licencias de 2027');
    const elegido = pagina.el('vista-licencias').querySelector('.me-segmento [data-anio="2027"]');
    assert.equal(elegido.getAttribute('aria-pressed'), 'true');
    assert.equal(pagina.documento.activeElement, elegido);
    assert.equal(pagina.el('me-anuncio').textContent, 'Mis licencias de 2027');
  });

  it('con Licencias abierta y sin lista (la carga falló), guardar una de 2027 la pide en 2027', async () => {
    let falla = true;
    const pagina = montarPagina({
      hash: '#licencias',
      responder: conEnero({
        alta: true,
        extra: (metodo, ruta) => (falla && ruta === '/api/mi-espacio/licencias' ? respuesta(500, { success: false, error: 'x' }) : undefined)
      })
    });
    await pagina.iniciar();
    falla = false;
    assert.ok(pagina.el('vista-licencias').textContent.includes('No se pudieron cargar tus licencias.'));
    await cargarLicencia(pagina, { desde: '2027-01-04', hasta: '2027-01-15' });
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.deepEqual(pedidosDeLaLista(pagina), ['/api/mi-espacio/licencias', '/api/mi-espacio/licencias?anio=2027']);
    assert.equal(tituloDeLaLista(pagina), 'Mis licencias de 2027');
    assert.equal(anioPendienteDe(pagina), null);
  });

  it('una lista vieja que llega después de guardar no tapa el año de lo guardado: al abrir Licencias, la pide en 2027', async () => {
    const primera = demorada();
    let pedidas = 0;
    const pagina = montarPagina({
      hash: '#licencias',
      responder: conEnero({
        alta: true,
        extra: (metodo, ruta) => {
          if (ruta !== '/api/mi-espacio/licencias') return undefined;
          pedidas += 1;
          return pedidas === 1 ? primera.promesa : undefined;
        }
      })
    });
    // La lista de entrada tarda: la página se usa mientras tanto (iniciarMiEspacio la espera, así que no se espera)
    pagina.contexto.iniciarMiEspacio();
    await pagina.esperar();
    await pagina.tocar(pagina.el('tab-resumen'));
    await cargarLicencia(pagina, { desde: '2027-01-04', hasta: '2027-01-15' });
    await pagina.tocar(pagina.el('ml-guardar'));
    await pagina.tocar(listo(pagina));
    assert.equal(anioPendienteDe(pagina), 2027);
    // Llega la de entrada (la de 2026), ya vieja
    primera.soltar(ok(LISTA_2026_CON_ENERO));
    await pagina.esperar();
    assert.equal(tituloDeLaLista(pagina), 'Mis licencias de 2026');
    await pagina.tocar(pagina.el('tab-licencias'));
    assert.deepEqual(pedidosDeLaLista(pagina), ['/api/mi-espacio/licencias', '/api/mi-espacio/licencias?anio=2027']);
    assert.equal(tituloDeLaLista(pagina), 'Mis licencias de 2027');
    assert.equal(anioPendienteDe(pagina), null);
  });
});

// Los estilos del link de la bajada, del aviso para revisar, de otros años y del segundo paso (spec
// 2026-10-28-mi-espacio-licencia-anulada), leídos del <style> de mi-espacio.html: subrayados, con 4,5:1 o más sobre su fondo, y el
// foco visible de la página
describe('mi-espacio.html: los estilos de otro año y para revisar', () => {
  const estilo = estiloDeLaPagina();
  const token = (nombre) => new RegExp(`${nombre}: (#[0-9A-Fa-f]{6});`).exec(estilo)?.[1];
  const colorDe = (selector) => {
    const regla = reglaDe(selector);
    assert.ok(regla, selector);
    const nombre = /(?:^|[;{\s])color: var\((--sg-[\w-]+)\);/.exec(regla)?.[1];
    assert.ok(nombre, `${selector} { color }`);
    return token(nombre);
  };
  const BLANCO = '#FFFFFF';

  it('los links y el botón, subrayados; los textos, con 4,5:1 o más sobre su fondo', () => {
    for (const selector of ['.me-frase-link', '.me-faltantes a', '.me-otros-anios button']) {
      assert.match(reglaDe(selector) ?? '', /text-decoration: underline;/, selector);
    }
    const pares = [
      ['el link de la bajada', colorDe('.me-frase-link'), token('--sg-cielo')],
      ['el link del aviso para revisar', colorDe('.me-faltantes a'), token('--sg-ambar-fondo')],
      ['otros años', colorDe('.me-otros-anios'), BLANCO],
      ['«Ver 2027»', colorDe('.me-otros-anios button'), BLANCO],
      ['en qué lista quedó', colorDe('.me-paso-dos-lista'), BLANCO]
    ];
    for (const [nombre, texto, fondo] of pares) {
      assert.ok(texto && fondo, nombre);
      assert.ok(contraste(texto, fondo) >= 4.5, `${nombre}: ${texto} sobre ${fondo}, ${contraste(texto, fondo).toFixed(2)}:1`);
    }
    // El de la bajada, con el color de la frase
    assert.equal(colorDe('.me-frase-link'), colorDe('.me-frase'));
  });

  it('el foco, visible como en el resto de la página (los links y los botones de .me-pagina)', () => {
    assert.match(reglaDe('.me-pagina a:focus-visible, .me-pagina button:focus-visible'), /outline: 3px solid var\(--tinta\);/);
  });
});

// Los estilos de la agenda con más onda (spec 2026-10-28-mi-espacio-agenda-onda, 3.3, 3.4, 3.8 y 6), leídos del <style> de
// mi-espacio.html: el texto con 4,5:1 o más sobre su fondo (también en los días que ya pasaron, en los de otro mes y en hoy), los
// puntos y las líneas del teléfono con 3:1 o más sobre la celda más oscura (hoy, --sg-cielo) y sobre el blanco, y la leyenda con
// los íconos del mes
describe('mi-espacio.html: los estilos de la agenda', () => {
  const estilo = estiloDeLaPagina();
  const token = (nombre) => new RegExp(`${nombre}: (#[0-9A-Fa-f]{6});`).exec(estilo)?.[1];
  // Un color de un valor: un token --sg-* (su #RRGGBB de :root) o un #RGB / #RRGGBB
  const color = (valor) => {
    const nombre = /var\((--sg-[\w-]+)\)/.exec(valor)?.[1];
    const hex = nombre ? token(nombre) : /#[0-9A-Fa-f]{3,6}\b/.exec(valor)?.[0];
    assert.ok(hex, `el color de ${valor}`);
    return (hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex).toUpperCase();
  };
  // El valor de una propiedad en la regla de un selector, del <style> entero o de un pedazo (el bloque del teléfono)
  const de = (selector, propiedad, texto = estilo) => {
    const regla = new RegExp(`(?:^|\\n)\\s*${escaparRegex(selector)}\\s*\\{([^}]*)\\}`).exec(texto)?.[1];
    assert.ok(regla, selector);
    const valor = new RegExp(`(?:^|[;{\\s])${propiedad}: ([^;]+);`).exec(regla)?.[1];
    assert.ok(valor, `${selector} { ${propiedad} }`);
    return color(valor);
  };
  // El bloque del teléfono, con sus llaves
  const telefono = (() => {
    const inicio = estilo.indexOf('@media (max-width: 640px) {');
    let nivel = 0;
    for (let i = estilo.indexOf('{', inicio); i < estilo.length; i += 1) {
      if (estilo[i] === '{') nivel += 1;
      if (estilo[i] === '}' && (nivel -= 1) === 0) return estilo.slice(inicio, i + 1);
    }
    return '';
  })();
  const BLANCO = '#FFFFFF';
  const CIELO = token('--sg-cielo');

  it('el texto, con 4,5:1 o más sobre su fondo: la pizarra, los números, las barras, el día elegido, la banda y la cuenta', () => {
    const pares = [
      ['la pizarra de los compañeros', de('.me-tira.ausente', 'color'), de('.me-tira.ausente', 'background')],
      ['tu licencia en la barra', de('.me-tira.licencia', 'color'), de('.me-tira.licencia', 'background')],
      ['el número de otro mes', de('.me-celda.otro-mes .me-num', 'color'), de('.me-celda.otro-mes', 'background')],
      ['el número de un día que pasó', de('.me-celda.paso .me-num', 'color'), BLANCO],
      ['el número de un día que pasó, feriado', de('.me-celda.paso .me-num', 'color'), de('.me-celda.feriado', 'background')],
      ['el número de un día', de('.me-num', 'color'), de('.me-celda.finde', 'background')],
      ['el número de hoy', de('.me-celda.hoy .me-num', 'color'), de('.me-celda.hoy .me-num', 'background')],
      ['«y N más», hoy', de('.me-mas', 'color'), de('.me-celda.hoy', 'background')],
      ['la cabeza de los días', de('.me-mes th', 'color'), BLANCO],
      ['la cabeza de hoy', de('.me-mes th.hoy', 'color'), BLANCO],
      ['la frase del mes', de('.me-frase-del-mes', 'color'), de('.me-banda-del-mes', 'background')],
      ['el mes', de('.me-titulo-del-mes h2', 'color'), de('.me-banda-del-mes', 'background')],
      ['«Sábado y domingo»', de('.me-finde', 'color'), de('.me-finde', 'background')],
      ['lo escondido el fin de semana', de('.me-finde-cuenta', 'color'), de('.me-finde-cuenta', 'background')],
      ['la leyenda', de('.me-leyenda', 'color'), BLANCO]
    ];
    for (const clase of ['propio', 'compartido', 'publico-otro', 'licencia', 'feriado', 'ausente']) {
      const selector = `.me-fila-del-dia.${clase} .me-elegido-cosa`;
      pares.push([`el día elegido: ${clase}`, de(selector, 'color'), de(selector, 'background')]);
    }
    assert.equal(de('.me-tira.ausente', 'background'), token('--sg-suave'));
    assert.equal(de('.me-tira.ausente', 'color'), BLANCO);
    for (const [nombre, texto, fondo] of pares) {
      assert.ok(contraste(texto, fondo) >= 4.5, `${nombre}: ${texto} sobre ${fondo}, ${contraste(texto, fondo).toFixed(2)}:1`);
    }
    // La muestra de los compañeros en la leyenda es la pizarra, como su barra
    assert.equal(de('.me-leyenda .me-color.ausente', 'background'), token('--sg-suave'));
    assert.equal(de('.me-leyenda .me-color.ausente', 'color'), BLANCO);
  });

  it('en el teléfono, los puntos (tinta, violeta y el ámbar del feriado) y las líneas (verde y pizarra), con 3:1 o más sobre la celda', () => {
    const puntos = [['propio', de('.me-puntos .propio', 'background', telefono)], ['compartido', de('.me-puntos .compartido', 'background', telefono)],
      ['feriado', de('.me-puntos .feriado', 'background', telefono)]];
    assert.deepEqual(puntos.slice(0, 2).map(([, hex]) => hex), [token('--sg-tinta'), token('--sg-violeta')]);
    const lineas = [['tu licencia', de('.me-tira.licencia', 'background', telefono)], ['los compañeros', de('.me-tira.ausente', 'background')]];
    assert.deepEqual(lineas.map(([, hex]) => hex), [token('--sg-verde'), token('--sg-suave')]);
    // En el teléfono, la de los compañeros no cambia: la de la compu
    assert.doesNotMatch(telefono, /\n\s*\.me-tira\.ausente \{/);
    // La celda más oscura es la de hoy (--sg-cielo): los otros fondos (otro mes, sábado y domingo, feriado) son más claros
    for (const fondo of [de('.me-celda.otro-mes', 'background'), de('.me-celda.finde', 'background'), de('.me-celda.feriado', 'background')]) {
      assert.ok(contraste(fondo, BLANCO) < contraste(CIELO, BLANCO), fondo);
    }
    for (const [nombre, hex] of [...puntos, ...lineas]) {
      for (const fondo of [BLANCO, CIELO]) {
        assert.ok(contraste(hex, fondo) >= 3, `${nombre}: ${hex} sobre ${fondo}, ${contraste(hex, fondo).toFixed(2)}:1`);
      }
    }
  });

  // Desde el evento Personal (Público) (spec 2026-10-29-mi-espacio-evento-publico, 5.2), siete: lo tuyo dos veces (sin ícono y, lo que
  // ven otros, con el ojo), lo de otra persona con el ojo en rosado y los Laborales (eran «Compartidos»)
  it('la leyenda lleva el ícono del mes de cada cosa (ICONOS_DEL_MES): el de lo que es solo tuyo, vacío; lo que ven otros, el ojo', () => {
    const leyenda = leer('mi-espacio.html').match(/<ul class="me-leyenda"[^>]*>([\s\S]*?)<\/ul>/)[1];
    const muestras = [...leyenda.matchAll(/<span class="me-color ([\w-]+)" aria-hidden="true">([\s\S]*?)<\/span>([^<]+)<\/li>/g)]
      .map(([, clase, icono, texto]) => ({ clase, icono, texto }));
    assert.deepEqual(muestras.map(({ clase, texto }) => [clase, texto]), [
      ['propio', 'Solo vos'], ['propio', 'Tuyos, a la vista'], ['publico-otro', 'Personales de otros'], ['compartido', 'Laborales'],
      ['licencia', 'Tus licencias y francos'], ['feriado', 'Feriados'], ['ausente', 'Compañeros que no están']
    ]);
    const iconos = ['propio', 'ojo', 'publico-otro', 'compartido', 'licencia', 'feriado', 'ausente'];
    muestras.forEach(({ icono, texto }, i) => assert.equal(icono, M.ICONOS_DEL_MES[iconos[i]], texto));
  });

  // Revisión final, 1: el texto de un tramo va en el pedazo de su primer día, a lo ancho de todo el tramo y arriba de los pedazos de
  // los días que siguen (.me-tira.inicio, z-index 2). Si tomara los clics, tocar la barra en el tercer día caería en el texto, cuyo
  // día es el primero: «Nuevo evento» con la fecha del primero (y el «+» del primero). Ni el texto ni el ícono los toman: el clic cae
  // en el pedazo de ese día, que es suyo (con su title)
  it('el texto y el ícono de una barra no toman clics (pointer-events: none): tocar un día de la barra es tocar ese día', () => {
    const valor = (selector, propiedad) => {
      const regla = reglaDe(selector);
      assert.ok(regla, selector);
      return new RegExp(`(?:^|[;{\\s])${propiedad}: ([^;]+);`).exec(regla)?.[1] ?? null;
    };
    assert.equal(valor('.me-tira-texto', 'pointer-events'), 'none');
    assert.equal(valor('.me-tira .me-icono', 'pointer-events'), 'none');
    // El pedazo sí los toma: es el que dice de qué día es
    assert.equal(valor('.me-tira', 'pointer-events'), null);
    assert.equal(valor('.me-tira.inicio', 'pointer-events'), null);
    // Ninguna regla se los devuelve, tampoco las del teléfono (ahí el texto y el ícono son de 1 px, ocultos a la vista)
    for (const [, otro] of estilo.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/pointer-events: ([^;]+);/g)) assert.equal(otro, 'none');
    assert.match(telefono, /\.me-tira-texto, \.me-tira \.me-icono \{ position: absolute; width: 1px; height: 1px;/);
  });
});

// =====================================================================================================================================
// Las vacaciones al cargar una licencia (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga): lo nuevo que manda el servidor, dibujado
// por la página sin recalcular nada (Ruling 19), con la persona de planta inventada de las maquetas: los avisos del cálculo (3.2, 3.4
// y 3.6), el error de días debajo de «Hasta» (3.3), «Vence pronto» sin el botón cuando no hay días libres (3.7), las horas de
// franquicia que se pierden en «El resto» (3.6) y el número de un tramo de un solo día en la regla (3.9)

// Octubre sin ningún día libre: las licencias que faltaban cubren todos sus días hábiles (el franco de octubre se queda sin día)
const OCTUBRE_SIN_DIAS_LIBRES = conLicencias(PLANTA.estado, licencia(100, 'medica', '2026-10-05', '2026-10-14'),
  licencia(101, 'medica', '2026-10-16', '2026-10-22'),
  licencia(102, 'familiar', '2026-10-26', '2026-10-30'), licencia(103, 'familiar', '2026-09-30'));
// De hoy al 31/12, ningún día libre: las 25 horas de franquicia que quedan no entran en ningún día
const HASTA_FIN_DE_ANIO_OCUPADO = conLicencias(PLANTA.estado, licencia(110, 'medica', '2026-10-26', '2026-11-02'),
  licencia(111, 'familiar', '2026-11-10', '2026-12-11'), licencia(112, 'medica', '2026-12-14', '2026-12-31'));
// Dos días de la licencia 2024 cargados en diciembre: queda 1, un tramo de un solo día entre 48
const UNO_DE_LA_2024 = conLicencias(PLANTA.estado, licencia(101, 'vacaciones', '2026-12-14', '2026-12-15'));
// Una médica que ocupa todos los días libres de diciembre: el franco de diciembre se queda sin días (un aviso que no frena)
const MEDICA_DE_DICIEMBRE = Object.freeze({ tipo: 'medica', desde: '2026-12-01', hasta: '2026-12-31' });
const FRANCO_SIN_DIAS = 'Tu franco de diciembre se queda sin días libres: vence el 31/12/2026.';
// Unas vacaciones que van más allá de lo que alcanza: el error es del «Hasta»
const VACACIONES_DE_MAS = Object.freeze({ tipo: 'vacaciones', desde: '2026-11-23', hasta: '2027-03-31' });
const NO_ALCANZAN = 'No te alcanzan los días habilitados: esta licencia puede llegar hasta el 25/01/2027.';

describe('las vacaciones al cargar: lo nuevo del servidor, en la página', () => {
  it('el cálculo: cada aviso del servidor en su párrafo, después del texto de hoy, escapado; sin avisos, como antes', () => {
    const { error, vista } = respuestaDelCalculo(MEDICA_DE_DICIEMBRE);
    assert.equal(error, null);
    assert.deepEqual(vista.avisos, [FRANCO_SIN_DIAS]);
    assert.equal(M.htmlDelCalculo({ error, vista, paso: null }, 'medica'),
      `<b>21 días hábiles de 31 corridos.</b> Te quedan 1 de 25.<p class="me-calculo-aviso">${FRANCO_SIN_DIAS}</p>`);
    // Varios, cada uno en el suyo y en su orden; lo que no es un texto con algo no va
    const varios = M.htmlDelCalculo({ vista: { ...vista, avisos: [FRANCO_SIN_DIAS, MALICIOSO, '', '  ', 7, null] } }, 'medica');
    assert.ok(varios.endsWith(`Te quedan 1 de 25.<p class="me-calculo-aviso">${FRANCO_SIN_DIAS}</p><p class="me-calculo-aviso">${ESCAPADO}</p>`));
    assert.ok(!varios.includes('<img'));
    // Sin avisos (la lista vacía, sin la clave o algo que no es una lista), lo de antes
    for (const avisos of [[], undefined, null, 'x', { 0: FRANCO_SIN_DIAS }]) {
      assert.equal(M.htmlDelCalculo({ vista: { ...vista, avisos } }, 'medica'), '<b>21 días hábiles de 31 corridos.</b> Te quedan 1 de 25.',
        JSON.stringify(avisos));
    }
    // Las vacaciones con su reparto: los avisos van después de todo (el reparto, lo que queda y lo de antes del arranque)
    const vacaciones = respuestaDelCalculo(VACACIONES).vista;
    const conAviso = M.htmlDelCalculo({ vista: { ...vacaciones, avisos: [MALICIOSO] } }, 'vacaciones');
    assert.equal(conAviso, `${M.htmlDelCalculo({ vista: { ...vacaciones, avisos: [] } }, 'vacaciones')}<p class="me-calculo-aviso">${ESCAPADO}</p>`);
  });

  it('el cálculo con el error de días: solo los días, sin el reparto ni avisos (lo arma así el servidor)', () => {
    const { error, vista } = respuestaDelCalculo(VACACIONES_DE_MAS);
    assert.deepEqual(error, { campo: 'hasta', mensaje: NO_ALCANZAN });
    assert.equal(M.htmlDelCalculo({ error, vista, paso: null }, 'vacaciones'), '<b>89 días hábiles de 129 corridos.</b>');
  });

  it('«Vence pronto» sin días libres: sin el botón (accion null) y con por qué en un párrafo, escapado; las demás, con el suyo', () => {
    const resumen = resumenDel(PLANTA, { estado: OCTUBRE_SIN_DIAS_LIBRES });
    const [franco] = resumen.vence_pronto;
    assert.equal(franco.accion, null);
    assert.equal(franco.sin_dias_libres, 'No te quedan días libres este mes para usarlo.');
    const html = M.htmlDeVencePronto(resumen.vence_pronto);
    const [primera] = filasDe(html);
    assert.equal(primera.html, '<span class="me-talon" aria-hidden="true"><b>30</b>oct</span><div class="me-entrada-cuerpo">'
      + '<b id="me-vence-0">1 franco compensatorio de octubre</b><span class="me-entrada-texto">Vence el viernes 30/10, en 4 días.</span>'
      + '<p class="me-entrada-sin-dias">No te quedan días libres este mes para usarlo.</p></div>');
    assert.equal(primera.texto, '30 oct 1 franco compensatorio de octubre Vence el viernes 30/10, en 4 días. No te quedan días libres este mes para usarlo.');
    // Ningún botón vacío: solo los de las otras dos, cada uno con su título
    assert.deepEqual(botonesDe(html).map(({ atributos, texto }) => [texto, atributos['data-tipo'], atributos['aria-describedby']]),
      [['Cargar franquicia', 'franquicia', 'me-vence-1'], ['Cargar vacaciones', 'vacaciones', 'me-vence-2']]);
    assert.equal((html.match(/me-entrada-sin-dias/g) ?? []).length, 1);
    // Escapado
    const malicioso = M.htmlDeVencePronto([{ ...franco, sin_dias_libres: MALICIOSO }]);
    assert.ok(malicioso.includes(`<p class="me-entrada-sin-dias">${ESCAPADO}</p>`));
    assert.ok(!malicioso.includes('<img'));
    // Sin una acción con texto, nunca un botón sin nombre; sin por qué (o vacío), sin el párrafo
    for (const accion of [null, undefined, 'Cargarlo', {}, { tipo: 'franco' }, { texto: '', tipo: 'franco' }, { texto: '  ', tipo: 'franco' }]) {
      const uno = M.htmlDeVencePronto([{ ...franco, accion, sin_dias_libres: '' }]);
      assert.ok(!uno.includes('<button'), JSON.stringify(accion));
      assert.ok(!uno.includes('<p'), JSON.stringify(accion));
    }
    // Con la acción, el botón de siempre
    assert.ok(M.htmlDeVencePronto([{ ...franco, accion: { texto: 'Cargarlo', tipo: 'franco' }, sin_dias_libres: undefined }])
      .includes('<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-accion="cargar-licencia" data-tipo="franco" '
        + 'aria-describedby="me-vence-0">Cargarlo</button></div></li>'));
  });

  it('«El resto»: las horas de franquicia que se pierden, debajo de «Franquicias» y fuera de su link (su aria-label no las diría); sin ellas, nada', () => {
    const resumen = resumenDel(PLANTA, { estado: HASTA_FIN_DE_ANIO_OCUPADO });
    const [franquicia, ...otros] = resumen.tanques.otros;
    assert.equal(franquicia.clave, 'franquicia');
    assert.equal(franquicia.perdidas_texto, 'Perdés 25 horas (vencen el 31/12/2026).');
    assert.ok(otros.every((tanque) => !Object.hasOwn(tanque, 'perdidas_texto')));
    const html = M.htmlDelResto(resumen);
    const primero = html.match(/<ul class="me-numeros"><li>([\s\S]*?)<\/li>/)[1];
    assert.ok(primero.startsWith('<a class="me-numero" href="#licencias"'));
    assert.ok(primero.endsWith('</a><p class="me-perdidas">Perdés 25 horas (vencen el 31/12/2026).</p>'));
    assert.equal((html.match(/me-perdidas/g) ?? []).length, 1);
    // El link no cambió: su aria-label es el del servidor
    assert.equal(linksDe(html)[0].atributos['aria-label'], franquicia.aria);
    // Sin horas que se pierdan (''), sin la clave o con algo que no es un texto: nada
    const planta = resumenDel(PLANTA);
    assert.equal(planta.tanques.otros[0].perdidas_texto, '');
    assert.ok(!M.htmlDelResto(planta).includes('me-perdidas'));
    for (const perdidas of [undefined, null, '  ', 8]) {
      const otro = { ...resumen, tanques: { ...resumen.tanques, otros: [{ ...franquicia, perdidas_texto: perdidas }, ...otros] } };
      assert.ok(!M.htmlDelResto(otro).includes('me-perdidas'), String(perdidas));
    }
    // Escapado
    const malicioso = M.htmlDelResto({ ...resumen, tanques: { ...resumen.tanques, otros: [{ ...franquicia, perdidas_texto: MALICIOSO }, ...otros] } });
    assert.ok(malicioso.includes(`<p class="me-perdidas">${ESCAPADO}</p>`));
    assert.ok(!malicioso.includes('<img'));
  });

  it('la regla: el tramo de un solo día (1 de la licencia 2024, entre 48) lleva su número y la clase un-dia; los demás, no', () => {
    const resumen = resumenDel(PLANTA, { estado: UNO_DE_LA_2024 });
    assert.deepEqual(resumen.tanques.vacaciones.capas.map(({ clase, n }) => [clase, n]),
      [['vence', 1], ['tinta', 20], ['medio', 10], ['cargadas', 7], ['por_habilitar', 10]]);
    const html = M.htmlDeLaRegla(resumen.tanques.vacaciones);
    assert.ok(html.includes('<span class="me-tramo vence un-dia" style="--n:1;--demora:250ms;--duracion:160ms"><span>1</span></span>'));
    assert.deepEqual(tramosDe(html).map(({ clase, unDia, numero }) => [clase, unDia, numero]), [
      ['vence', true, '1'], ['tinta', false, '20'], ['medio', false, '10'], ['cargadas', false, '7'], ['por_habilitar', false, '10']
    ]);
    // La de PLANTA no tiene ninguno de un solo día
    assert.ok(!M.htmlDeLaRegla(resumenDel(PLANTA).tanques.vacaciones).includes('un-dia'));
  });
});

describe('las vacaciones al cargar: «Cargar licencia» en la página (DOM falso)', () => {
  it('el error de días va debajo de «Hasta», con aria-invalid, y no debajo de «Desde»; el cálculo muestra solo los días', async () => {
    const pagina = montarPagina({ responder: conFormularios() });
    await pagina.iniciar();
    await cargarLicencia(pagina, VACACIONES_DE_MAS);
    assert.deepEqual(calculos(pagina).at(-1).cuerpo, { ...VACACIONES_DE_MAS, mostrar: true, nota: '' });
    assert.equal(pagina.el('ml-hasta-error').textContent, NO_ALCANZAN);
    assert.equal(pagina.el('ml-hasta-error').hidden, false);
    assert.equal(pagina.el('ml-hasta').getAttribute('aria-invalid'), 'true');
    assert.equal(pagina.el('ml-desde-error').hidden, true);
    assert.equal(pagina.el('ml-desde').getAttribute('aria-invalid'), null);
    // Ni arriba del modal
    assert.equal(pagina.el('ml-error').hidden, true);
    assert.equal(pagina.el('ml-calculo').innerHTML, '<b>89 días hábiles de 129 corridos.</b>');
    assert.equal(pagina.el('ml-calculo').hidden, false);
  });

  it('con avisos y sin error, el cálculo los muestra y «Guardar» sigue habilitado: un aviso no frena el guardado', async () => {
    const pagina = montarPagina({ responder: conFormularios() });
    await pagina.iniciar();
    await cargarLicencia(pagina, MEDICA_DE_DICIEMBRE);
    assert.equal(pagina.el('ml-calculo').innerHTML,
      `<b>21 días hábiles de 31 corridos.</b> Te quedan 1 de 25.<p class="me-calculo-aviso">${FRANCO_SIN_DIAS}</p>`);
    assert.equal(pagina.el('ml-calculo').hidden, false);
    assert.equal(pagina.el('ml-guardar').disabled, false);
    assert.equal(pagina.el('ml-error').hidden, true);
    for (const id of ['ml-desde', 'ml-hasta']) assert.equal(pagina.el(id).getAttribute('aria-invalid'), null, id);
    await pagina.tocar(pagina.el('ml-guardar'));
    await pagina.esperar();
    assert.deepEqual(pagina.pedidosA('POST', '/api/mi-espacio/licencias').map(({ cuerpo }) => cuerpo),
      [{ ...MEDICA_DE_DICIEMBRE, mostrar: true, nota: '' }]);
    assert.equal(pagina.el('modal-licencia-titulo').textContent, 'Licencia cargada');
  });
});

// Los estilos de lo nuevo, leídos del <style> de mi-espacio.html: los avisos en ámbar con 4,5:1 o más sobre su fondo, y el tramo de un
// solo día, que muestra su número
describe('mi-espacio.html: los estilos de las vacaciones al cargar', () => {
  const estilo = estiloDeLaPagina();
  const token = (nombre) => new RegExp(`${nombre}: (#[0-9A-Fa-f]{6});`).exec(estilo)?.[1];
  // El token --sg-* de una propiedad (color o background) de la regla de un selector
  const tokenDe = (selector, propiedad) => {
    const regla = reglaDe(selector);
    assert.ok(regla, selector);
    const nombre = new RegExp(`(?:^|[;{\\s])${propiedad}: var\\((--sg-[\\w-]+)\\);`).exec(regla)?.[1];
    assert.ok(nombre, `${selector} { ${propiedad} }`);
    return nombre;
  };

  it('los avisos, en ámbar y con 4,5:1 o más sobre su fondo: el del cálculo sobre el recuadro, el de «Vence pronto» y las horas que se pierden', () => {
    // «El resto» va sin tarjeta, sobre el fondo de la página (.main-content, con el --gray-100 de main.css)
    assert.match(reglaDe('.main-content'), /background: var\(--gray-100\);/);
    const gris = /--gray-100: (#[0-9A-Fa-f]{6});/.exec(leer('css/main.css'))[1];
    const pares = [
      ['el aviso del cálculo', '.me-calculo .me-calculo-aviso', token(tokenDe('.me-calculo', 'background'))],
      ['sin días libres', '.me-entrada-sin-dias', token(tokenDe('.me-entrada', 'background'))],
      ['las horas que se pierden', '.me-resto .me-perdidas', gris]
    ];
    for (const [nombre, selector, fondo] of pares) {
      assert.equal(tokenDe(selector, 'color'), '--sg-ambar', nombre);
      const texto = token('--sg-ambar');
      assert.ok(texto && fondo, nombre);
      assert.ok(contraste(texto, fondo) >= 4.5, `${nombre}: ${texto} sobre ${fondo}, ${contraste(texto, fondo).toFixed(2)}:1`);
    }
    // El del cálculo, sobre el celeste del recuadro (el de siempre)
    assert.equal(tokenDe('.me-calculo', 'background'), '--sg-azul-fondo');
  });

  it('el tramo de un solo día muestra su número (el contenedor angosto no lo oculta), centrado y más chico si no entra', () => {
    assert.match(reglaDe('.me-tramo.un-dia'), /padding: 0;/);
    assert.match(reglaDe('.me-tramo.un-dia'), /justify-content: center;/);
    const numero = reglaDe('.me-tramo.un-dia > span');
    assert.match(numero, /visibility: visible;/);
    assert.match(numero, /font-size: clamp\(0\.55rem, 150cqw, 1\.2rem\);/);
    // Los demás tramos angostos siguen sin él (está en la lista de debajo)
    assert.ok(estilo.includes('@container (max-width: 26px) { .me-tramo > span { visibility: hidden; } }'));
  });
});

// Los estilos del formulario con los tres tipos (spec 2026-10-29-mi-espacio-evento-publico, 4, 5.1 y 7; la maqueta aprobada, con me- en
// lugar de ag-): el rosado, las tres opciones del tipo, las pastillas de lo que ven los demás, «Otro» con su cuenta y la vista previa
// (en 640 px, todo en una columna); el texto con 4,5:1 o más sobre su fondo y los bordes con 3:1 o más
describe('mi-espacio.html: los estilos del formulario con los tres tipos', () => {
  const estilo = estiloDeLaPagina();
  const token = (nombre) => new RegExp(`${nombre}: (#[0-9A-Fa-f]{6});`).exec(estilo)?.[1]?.toUpperCase();
  // El color de una propiedad de un selector: un token --sg-* (su #RRGGBB) o un #RRGGBB
  const colorDe = (selector, propiedad, texto = estilo) => {
    const regla = new RegExp(`(?:^|\\n)\\s*${escaparRegex(selector)}\\s*\\{([^}]*)\\}`).exec(texto)?.[1];
    assert.ok(regla, selector);
    const valor = new RegExp(`(?:^|[;{\\s])${propiedad}: ([^;]+);`).exec(regla)?.[1];
    assert.ok(valor, `${selector} { ${propiedad} }`);
    const nombre = /var\((--sg-[\w-]+)\)/.exec(valor)?.[1];
    const hex = nombre ? token(nombre) : /#[0-9A-Fa-f]{3,6}\b/.exec(valor)?.[0]?.toUpperCase();
    assert.ok(hex, `el color de ${selector} { ${propiedad} }`);
    return hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  };
  const telefono = (() => {
    const inicio = estilo.indexOf('@media (max-width: 640px) {');
    let nivel = 0;
    for (let i = estilo.indexOf('{', inicio); i < estilo.length; i += 1) {
      if (estilo[i] === '{') nivel += 1;
      if (estilo[i] === '}' && (nivel -= 1) === 0) return estilo.slice(inicio, i + 1);
    }
    return '';
  })();
  const BLANCO = '#FFFFFF';
  // La pastilla de un Público de otra persona: la misma regla le da su color a la muestra de la leyenda
  const PASTILLA = '.me-ev.publico-otro, .me-leyenda .publico-otro';

  it('los tokens del rosado (spec 5.1) y la pastilla de un Público de otra persona, con la forma de las del mes', () => {
    assert.deepEqual([token('--sg-rosado'), token('--sg-rosado-fondo'), token('--sg-rosado-borde')], ['#8A3B5C', '#F7E3EC', '#B5577F']);
    assert.equal(colorDe(PASTILLA, 'background'), token('--sg-rosado-fondo'));
    assert.equal(colorDe(PASTILLA, 'border-color'), token('--sg-rosado-borde'));
    assert.equal(colorDe(PASTILLA, 'color'), token('--sg-rosado'));
  });

  it('el texto, con 4,5:1 o más; el borde de la pastilla, con 3:1 o más contra su fondo y contra la celda', () => {
    const pares = [
      ['el texto rosado sobre su fondo', colorDe(PASTILLA, 'color'), colorDe(PASTILLA, 'background')],
      ['el texto rosado sobre blanco', colorDe(PASTILLA, 'color'), BLANCO],
      ['«Así lo ven los demás:»', colorDe('.me-vista-previa-rotulo', 'color'), colorDe('.me-vista-previa', 'background')],
      ['la ayuda de la vista previa', colorDe('.me-vista-previa-ayuda', 'color'), colorDe('.me-vista-previa', 'background')],
      ['el día de la vista previa', colorDe('.me-vista-previa-dia', 'color'), colorDe('.me-vista-previa-celda', 'background')],
      ['la cuenta pasada de 60', colorDe('.me-cuenta.pasado', 'color'), BLANCO]
    ];
    for (const [nombre, texto, fondo] of pares) {
      assert.ok(contraste(texto, fondo) >= 4.5, `${nombre}: ${texto} sobre ${fondo}, ${contraste(texto, fondo).toFixed(2)}:1`);
    }
    const borde = colorDe(PASTILLA, 'border-color');
    for (const fondo of [colorDe(PASTILLA, 'background'), colorDe('.me-vista-previa-celda', 'background')]) {
      assert.ok(contraste(borde, fondo) >= 3, `el borde ${borde} sobre ${fondo}: ${contraste(borde, fondo).toFixed(2)}:1`);
    }
    // El borde de las pastillas de lo que ven los demás (las .sg-chip), también con un error
    assert.ok(contraste(colorDe('.sg-chip', 'border'), BLANCO) >= 3);
    assert.ok(contraste(colorDe('.me-textos[aria-invalid="true"] .sg-chip', 'border-color'), BLANCO) >= 3);
  });

  it('las tres opciones del tipo, las pastillas, «Otro», la vista previa (sin --lineas: con data-lineas) y, en 640 px, una columna', () => {
    assert.match(reglaDe('.me-opciones.tres'), /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
    assert.match(reglaDe('.me-textos'), /display: flex;/);
    assert.match(reglaDe('.me-textos'), /flex-wrap: wrap;/);
    assert.ok(reglaDe('.me-otro') !== null, '.me-otro');
    assert.match(reglaDe('.me-vista-previa'), /grid-template-areas: 'rotulo rotulo' 'celda ayuda';/);
    assert.match(reglaDe('.me-vista-previa'), /background: var\(--sg-cielo\);/);
    assert.ok(reglaDe('.me-vista-previa-celda') !== null, '.me-vista-previa-celda');
    assert.ok(reglaDe('.me-vista-previa .me-ev') !== null, '.me-vista-previa .me-ev');
    assert.doesNotMatch(estilo, /--lineas/);
    assert.match(telefono, /\n\s*\.me-opciones\.tres \{ grid-template-columns: minmax\(0, 1fr\); \}/);
    assert.match(telefono, /\n\s*\.me-vista-previa \{ grid-template-columns: minmax\(0, 1fr\); grid-template-areas: 'rotulo' 'celda' 'ayuda'; \}/);
    // El Laboral deshabilitado no se ve tocable, y no pierde contraste
    assert.match(reglaDe('button.me-opcion:disabled'), /cursor: default;/);
    assert.doesNotMatch(reglaDe('button.me-opcion:disabled'), /opacity/);
  });
});

// Los estilos del evento Personal (Público) en la agenda (spec 2026-10-29-mi-espacio-evento-publico, 5.1 a 5.3 y 7; la maqueta aprobada,
// con me- en lugar de ag-): la insignia rosada del detalle, la línea del ojo de «Próximos», el ícono y la fila del día elegido de uno de
// otra persona y, en el teléfono, su anillo. El texto con 4,5:1 o más sobre su fondo, y los bordes y el anillo con 3:1 o más contra la
// celda en la que van: la de hoy (--sg-cielo, la más oscura), la de un día que pasó (blanca, con lo de adentro desaturado por su
// filter: saturate, que se aplica acá como lo aplican los navegadores, sobre sRGB) y la de otro mes
describe('mi-espacio.html: los estilos del evento Personal (Público) en la agenda', () => {
  const estilo = estiloDeLaPagina();
  const token = (nombre) => new RegExp(`${nombre}: (#[0-9A-Fa-f]{6});`).exec(estilo)?.[1]?.toUpperCase();
  const colorDe = (selector, propiedad, texto = estilo) => {
    const regla = new RegExp(`(?:^|\\n)\\s*${escaparRegex(selector)}\\s*\\{([^}]*)\\}`).exec(texto)?.[1];
    assert.ok(regla, selector);
    const valor = new RegExp(`(?:^|[;{\\s])${propiedad}: ([^;]+);`).exec(regla)?.[1];
    assert.ok(valor, `${selector} { ${propiedad} }`);
    const nombre = /var\((--sg-[\w-]+)\)/.exec(valor)?.[1];
    const hex = nombre ? token(nombre) : /#[0-9A-Fa-f]{3,6}\b/.exec(valor)?.[0]?.toUpperCase();
    assert.ok(hex, `el color de ${selector} { ${propiedad} }`);
    return hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  };
  const telefono = (() => {
    const inicio = estilo.indexOf('@media (max-width: 640px) {');
    let nivel = 0;
    for (let i = estilo.indexOf('{', inicio); i < estilo.length; i += 1) {
      if (estilo[i] === '{') nivel += 1;
      if (estilo[i] === '}' && (nivel -= 1) === 0) return estilo.slice(inicio, i + 1);
    }
    return '';
  })();
  const BLANCO = '#FFFFFF';
  const PASTILLA = '.me-ev.publico-otro, .me-leyenda .publico-otro';
  const FILA = '.me-fila-del-dia.publico-otro .me-elegido-cosa';
  // Un color #RRGGBB con filter: saturate(s) (la matriz de Filter Effects, en sRGB)
  const saturado = (hex, s) => {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const matriz = [[0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s], [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
      [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]];
    return `#${matriz.map((fila) => Math.round(Math.min(255, Math.max(0, fila.reduce((suma, f, i) => suma + f * rgb[i], 0))))
      .toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  };
  // Lo de adentro de un día que pasó, desaturado: el número de su filter
  const DESATURADO = Number(/saturate\(([\d.]+)\)/.exec(reglaDe('.me-celda.paso .me-cosas') ?? '')?.[1]);
  // Las celdas: la de hoy, la de un día que pasó (sin fondo propio: la de siempre) y la de otro mes
  const CELDAS = () => [['hoy', colorDe('.me-celda.hoy', 'background')], ['un día que pasó', colorDe('.me-celda', 'background')],
    ['otro mes', colorDe('.me-celda.otro-mes', 'background')]];

  it('la insignia rosada del detalle, la línea del ojo de «Próximos», el ícono y la fila del día elegido: su color y su forma', () => {
    assert.equal(colorDe('.me-insignia.rosado', 'background'), token('--sg-rosado-fondo'));
    assert.equal(colorDe('.me-insignia.rosado', 'color'), token('--sg-rosado'));
    // El ojo de la insignia, sin el margen de los íconos del mes (la insignia ya separa con su gap)
    assert.match(reglaDe('.me-insignia .me-icono') ?? '', /margin-right: 0;/);
    assert.equal(colorDe('.me-lo-ven', 'color'), token('--sg-tinta'));
    assert.match(reglaDe('.me-lo-ven'), /display: inline-flex;/);
    assert.match(reglaDe('.me-lo-ven'), /font-weight: 600;/);
    assert.ok(reglaDe('.me-lo-ven .me-icono') !== null, '.me-lo-ven .me-icono');
    // El ícono de «Próximos» de uno de otra persona, en rosado; el ojo de uno tuyo, en tinta
    assert.equal(colorDe('.me-prox-icono.publico-otro', 'color'), token('--sg-rosado'));
    assert.equal(colorDe('.me-prox-icono.propio', 'color'), token('--sg-tinta'));
    // La fila del día elegido de uno de otra persona, en rosado
    assert.deepEqual([colorDe(FILA, 'background'), colorDe(FILA, 'border-color'), colorDe(FILA, 'color')],
      [token('--sg-rosado-fondo'), token('--sg-rosado-borde'), token('--sg-rosado')]);
  });

  it('el texto, con 4,5:1 o más sobre su fondo: la insignia, la línea del ojo, la fila del día elegido y la pastilla, también en un día que pasó', () => {
    assert.ok(DESATURADO > 0 && DESATURADO < 1, String(DESATURADO));
    const pares = [
      ['la insignia rosada', colorDe('.me-insignia.rosado', 'color'), colorDe('.me-insignia.rosado', 'background')],
      ['la línea del ojo', colorDe('.me-lo-ven', 'color'), BLANCO],
      ['el ícono de «Próximos»', colorDe('.me-prox-icono.publico-otro', 'color'), BLANCO],
      ['la fila del día elegido', colorDe(FILA, 'color'), colorDe(FILA, 'background')],
      ['la pastilla, en un día que pasó', saturado(colorDe(PASTILLA, 'color'), DESATURADO), saturado(colorDe(PASTILLA, 'background'), DESATURADO)]
    ];
    for (const [nombre, texto, fondo] of pares) {
      assert.ok(contraste(texto, fondo) >= 4.5, `${nombre}: ${texto} sobre ${fondo}, ${contraste(texto, fondo).toFixed(2)}:1`);
    }
  });

  it('el borde de la pastilla y de la fila, con 3:1 o más contra su fondo y contra la celda (hoy, un día que pasó y otro mes)', () => {
    const borde = colorDe(PASTILLA, 'border-color');
    for (const [nombre, celda] of CELDAS()) {
      const deEseDia = nombre === 'un día que pasó' ? saturado(borde, DESATURADO) : borde;
      assert.ok(contraste(deEseDia, celda) >= 3, `el borde, ${nombre}: ${deEseDia} sobre ${celda}, ${contraste(deEseDia, celda).toFixed(2)}:1`);
    }
    assert.ok(contraste(saturado(borde, DESATURADO), saturado(colorDe(PASTILLA, 'background'), DESATURADO)) >= 3, 'en un día que pasó');
    assert.ok(contraste(colorDe(FILA, 'border-color'), colorDe(FILA, 'background')) >= 3);
    assert.ok(contraste(colorDe(FILA, 'border-color'), BLANCO) >= 3);
  });

  it('en el teléfono, uno de otra persona es un anillo rosado (blanco por dentro), con 3:1 o más contra la celda', () => {
    const anillo = /\n\s*\.me-puntos \.publico-otro \{([^}]*)\}/.exec(telefono)?.[1] ?? '';
    assert.match(anillo, /background: #fff;/);
    assert.match(anillo, /box-shadow: inset 0 0 0 2px var\(--sg-rosado-borde\);/);
    const rosado = token('--sg-rosado-borde');
    for (const [nombre, celda] of [...CELDAS(), ['sábado y domingo', colorDe('.me-celda.finde', 'background')],
      ['un feriado', colorDe('.me-celda.feriado', 'background')]]) {
      assert.ok(contraste(rosado, celda) >= 3, `${nombre}: ${rosado} sobre ${celda}, ${contraste(rosado, celda).toFixed(2)}:1`);
    }
    // Y contra su blanco de adentro: es un anillo, no un punto lleno
    assert.ok(contraste(rosado, BLANCO) >= 3);
  });
});
