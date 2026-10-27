// Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, secciones 8 y 11), ejecutado en Node: lo puro de public/js/mi-espacio.js
// (las pestañas; el Resumen «Niveles», con Vence pronto, los faltantes, los tanques, las pastillas y Hoy y mañana; la lista de
// licencias con su selector del año y sus filtros, las tablas de horas extras, el día por día y las horas no utilizadas previamente)
// con los datos que arma el servidor (services/miEspacioResumen.js) sobre los casos de tests/fixtures/mi-espacio-casos.js, pasados
// por JSON como los manda la API; y, con un DOM falso y un fetch falso, la carga de las pestañas. Los formularios (Task 17): lo puro,
// las copias atadas por tests de paridad (con services/miEspacioReglas.js y con usuarios.js, en su propio vm) y, con el DOM falso,
// los modales. Como proyectos.js, el script al cargarse solo declara: se carga en un vm después del api.js de verdad
// (Utils.escapeHtml). Las personas son las inventadas de la maqueta.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import { filasDeLicencias, tablaDeHorasExtras, resumenDe, proximoFeriadoDe, diaLargo, mesTitulo } from '../services/miEspacioResumen.js';
import {
  DIAS_DE_PROXIMOS, itemDeEvento, itemDeLicencia, itemDeAusencia, itemsDeFeriados, eventosDeHoyYManana, MENSAJES_EVENTO,
  LARGO_TITULO_EVENTO, LARGO_DETALLE_EVENTO, FECHA_MINIMA_EVENTO, fechaMaximaEvento, textoRangoEvento, RECORDATORIOS,
  RECORDATORIO_POR_DEFECTO, TEXTO_RECORDATORIO, validarEvento, inicialesDe, cuandoDelEvento, avisoDe
} from '../services/miEspacioEventosReglas.js';
import { idPositivo } from '../services/proyectosReglas.js';
import {
  calcular, vinculosDeLaLista, MENSAJES_MI_ESPACIO, ausenciasUnidas, ausentesDelRango, ausentesDeHoyYManana, DIAS_VACACIONES,
  DIAS_ESTUDIOS,
  DIAS_POR_EXAMEN, JORNADA, LARGO_NOTA, horasDe as horasDelServidor, camposDelSaldoInicial, validarSaldoInicial, textoSaldo,
  textoDeLasMitades, evaluarLicencia, pasoPrevistoDe, AVISO_DEL_PASO, AVISO_SIN_PERSONA_A_CARGO, textoAutorizadaDelFirmante,
  TIPOS_DE_UN_DIA, TIPOS_POR_HORAS, esDiaEntero
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
const resumenDel = (caso, { estado = caso.estado, persona = caso.persona, ausencias = [] } = {}) => comoLlega(resumenDe({
  persona, estado, calculo: calculoDe(estado), hoy: HOY, feriados: SIN_FERIADOS,
  hoyYManana: {
    ...ausentesDeHoyYManana(ausentesDelRango(ausenciasUnidas(ausencias, SIN_FERIADOS), HOY, MANANA), HOY),
    proximo_feriado: proximoFeriadoDe([FERIADO_SOBERANIA], HOY)
  }
}));
const conLicencias = (estado, ...licencias) => ({ ...estado, licencias: [...estado.licencias, ...licencias] });
const licencia = (id, tipo, desde, hasta = desde, horas = null) => ({ id, tipo, desde, hasta, horas });
// PLANTA con el franco de octubre ya cargado y los tres días de la licencia 2024 usados en diciembre: nada vence pronto
const SIN_NADA_QUE_VENZA = conLicencias(PLANTA.estado, licencia(100, 'franco', '2026-10-27'),
  licencia(101, 'vacaciones', '2026-12-14', '2026-12-16'));

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
// Las capas de un tanque (los rect con la clase de una capa), con sus números: { clase, y, alto }
const capasDelSvg = (svg) => [...svg.matchAll(/<rect class="(c-[\w-]+)"([^>]*)\/>/g)].map(([, clase, atributos]) => {
  const leidos = atributosDe(atributos);
  return { clase, y: Number(leidos.y), alto: Number(leidos.height) };
});
const casi = (a, b, tolerancia = 0.11) => Math.abs(a - b) <= tolerancia;

describe('el Resumen «Niveles»', () => {
  const planta = resumenDel(PLANTA, { ausencias: [AUSENCIA_DE_MARTIN] });
  const contrato = resumenDel(CONTRATO);

  it('PLANTA: arriba la modalidad y el año; después Vence pronto, Lo que te queda y Hoy y mañana, en ese orden', () => {
    const html = M.htmlDelResumen(planta);
    assert.ok(html.startsWith('<p class="me-contexto"><span><b>Planta permanente</b></span><span>Año 2026</span></p>'));
    assert.deepEqual([...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map(([, titulo]) => titulo), ['Vence pronto', 'Lo que te queda', 'Hoy y mañana']);
    // «Lo que te queda» dice el día y abre «Mis vacaciones y saldos»
    const cabeza = html.match(/<div class="me-panel-cabeza">[\s\S]*?<\/div>/)[0];
    assert.ok(textoDe(cabeza).startsWith('Lo que te queda Al lunes 26/10/2026'));
    assert.deepEqual(botonesDe(cabeza).map(({ atributos, texto }) => [atributos['data-abrir'], texto]), [['saldos', 'Mis vacaciones y saldos']]);
    // Las pastillas y la médica extraordinaria, dentro de «Lo que te queda»
    assert.ok(html.includes(M.htmlDePastillas(planta.pastillas)));
    assert.ok(html.includes('<p class="me-previos">Atención médica extraordinaria: sin tope y aparte de los 25 días. No usaste en 2026.</p>'));
    assert.ok(html.indexOf('me-previos') < html.indexOf('Hoy y mañana'));
  });

  it('Vence pronto: cada cosa con su fecha en el bloque amarillo, qué vence y el botón que la resuelve, con su tipo', () => {
    const html = M.htmlDeVencePronto(planta.vence_pronto);
    assert.match(html, /^<section class="me-vence" aria-labelledby="me-vence-titulo"><h2 class="me-titulo" id="me-vence-titulo">Vence pronto<\/h2>/);
    assert.deepEqual(filasDe(html).map(({ clases, texto }) => [clases.join(' '), texto]), [
      ['me-vence-item', '30 oct Viernes 30/10 1 franco compensatorio de octubre Es el último día hábil del mes. Si no lo usás, queda como '
        + 'no utilizado previamente. Cargarlo'],
      ['me-vence-item', '31 dic Jueves 31/12 3 días de la licencia 2024 Ese día vence la licencia 2024. Cargar vacaciones']
    ]);
    // El bloque de la fecha es decorativo: «Viernes 30/10» ya la dice
    assert.ok(html.includes('<span class="me-fecha" aria-hidden="true"><b>30</b>oct</span>'));
    assert.deepEqual(botonesDe(html).map(({ atributos, texto }) => [texto, atributos['data-accion'], atributos['data-tipo'], atributos['aria-describedby']]), [
      ['Cargarlo', 'cargar-licencia', 'franco', 'me-vence-0'], ['Cargar vacaciones', 'cargar-licencia', 'vacaciones', 'me-vence-1']
    ]);
    assert.ok(html.includes('<b id="me-vence-0">1 franco compensatorio de octubre</b>'));
    assert.equal(M.htmlDeVencePronto([]), '');
    assert.equal(M.htmlDeVencePronto(null), '');
  });

  it('el tanque de vacaciones es un link a #licencias con el aria-label del servidor, y su SVG es decorativo', () => {
    const [vacaciones] = linksDe(M.htmlDeTanques(planta.tanques));
    assert.equal(vacaciones.atributos.href, '#licencias');
    assert.equal(vacaciones.atributos['data-pestana'], 'licencias');
    assert.equal(vacaciones.atributos['aria-label'], 'Vacaciones: 33 días hábiles disponibles. Ver tus licencias');
    assert.match(vacaciones.adentro, /<svg class="me-tanque" [^>]*aria-hidden="true"/);
    assert.equal(vacaciones.texto, '33 días Vacaciones de 3 licencias');
  });

  it('el tanque de vacaciones: cinco capas de abajo hacia arriba, cada una n / capacidad × alto, que suman el tanque y ninguna sale', () => {
    const { vacaciones } = planta.tanques;
    assert.equal(vacaciones.capacidad, 48);
    const svg = M.svgDeTanque({ capas: vacaciones.capas, capacidad: vacaciones.capacidad, ancho: 88, alto: 176, id: 'me-tanque-0' });
    assert.match(svg, /^<svg class="me-tanque" viewBox="0 0 88 176" width="88" height="176" aria-hidden="true" focusable="false">/);
    const capas = capasDelSvg(svg);
    assert.deepEqual(capas.map(({ clase }) => clase), ['c-vence', 'c-tinta', 'c-medio', 'c-cargadas', 'c-por-habilitar']);
    capas.forEach(({ alto }, i) => assert.ok(casi(alto, (vacaciones.capas[i].n / 48) * 176), `capa ${i}: ${alto}`));
    // La primera apoya en el fondo, cada una sobre la anterior, y la última llega arriba de todo
    assert.ok(casi(capas[0].y + capas[0].alto, 176));
    for (let i = 1; i < capas.length; i += 1) assert.ok(casi(capas[i].y + capas[i].alto, capas[i - 1].y), `capa ${i} sobre la anterior`);
    assert.ok(casi(capas.at(-1).y, 0));
    assert.ok(casi(capas.reduce((suma, { alto }) => suma + alto, 0), 176));
    assert.ok(capas.every(({ y, alto }) => y >= 0 && alto >= 0 && y + alto <= 176.0001));
    // Las cargadas, rayadas (el patrón del propio tanque); las por habilitar, con su clase (punteadas en el <style>)
    assert.ok(svg.includes('<pattern id="me-tanque-0-rayas"'));
    assert.match(svg, /<rect class="c-cargadas" fill="url\(#me-tanque-0-rayas\)"/);
    assert.ok(svg.includes('<clipPath id="me-tanque-0">') && svg.includes('clip-path="url(#me-tanque-0)"'));
    // El nivel que se llena al abrir
    assert.ok(svg.includes('<g class="me-tanque-nivel" style="--alto:176px">'));
  });

  it('al lado del tanque de vacaciones, la lista de cada capa con su número: lo que vence en ámbar; lo cargado y lo que no se habilita, en gris', () => {
    const html = M.htmlDeTanques(planta.tanques);
    const leyenda = html.match(/<ul class="me-leyenda-vac">[\s\S]*?<\/ul>/)[0];
    assert.deepEqual(filasDe(leyenda).map(({ clases, texto }) => [clases.join(' '), texto]), [
      ['me-capa vence', 'Licencia 2024 Vence el 31/12/2026 3'],
      ['me-capa', 'Licencia 2025 Vence el 31/12/2027 20'],
      ['me-capa', 'Licencia 2026 La primera mitad 10'],
      ['me-capa tenue', 'Cargados Cargados para noviembre 5'],
      ['me-capa tenue', 'Todavía no Se habilitan el 1/1/2027 10']
    ]);
    assert.deepEqual([...leyenda.matchAll(/<i class="me-muestra (c-[\w-]+)" aria-hidden="true"><\/i>/g)].map(([, clase]) => clase),
      ['c-vence', 'c-tinta', 'c-medio', 'c-cargadas', 'c-por-habilitar']);
  });

  it('los demás tanques: cada uno un link a su pestaña, con el número arriba y el nombre con su total debajo', () => {
    const [, ...otros] = linksDe(M.htmlDeTanques(planta.tanques));
    assert.deepEqual(otros.map(({ atributos, texto }) => [atributos.href, atributos['aria-label'], texto]), [
      ['#licencias', 'Franquicias: quedan 25 de 42 horas. Ver tus licencias', '25 horas Franquicias de 42 horas'],
      ['#licencias', 'Estudios: quedan 9 de 15 días. Ver tus licencias', '9 días Estudios de 15 días'],
      ['#licencias', 'Atención médica: quedan 22 de 25 días. Ver tus licencias', '22 días Atención médica de 25 días'],
      ['#licencias', 'Grupo familiar: quedan 23 de 25 días. Ver tus licencias', '23 días Grupo familiar de 25 días']
    ]);
    // Ninguno vence: tinta, sin ámbar; el de franquicias, 25 de 42 del alto
    assert.ok(otros.every(({ atributos }) => atributos.class === 'me-nivel'));
    const [franquicias] = capasDelSvg(otros[0].adentro);
    assert.equal(franquicias.clase, 'c-tinta');
    assert.ok(casi(franquicias.alto, (25 / 42) * 112));
  });

  it('CONTRATO: el tanque de horas a favor, que vence este mes, en ámbar y con su link a #horas', () => {
    const [vacaciones, horas, ...resto] = linksDe(M.htmlDeTanques(contrato.tanques));
    assert.equal(vacaciones.atributos['aria-label'], 'Vacaciones: 13 días hábiles disponibles. Ver tus licencias');
    assert.equal(horas.atributos.href, '#horas');
    assert.equal(horas.atributos['data-pestana'], 'horas');
    assert.equal(horas.atributos.class, 'me-nivel vence');
    assert.equal(horas.atributos['aria-label'], 'Horas a favor: quedan 1,5 de 10,5 horas en octubre. Ver tus horas extras');
    assert.equal(horas.texto, '1,5 horas Horas a favor de 10,5 en octubre');
    assert.deepEqual(capasDelSvg(horas.adentro).map(({ clase }) => clase), ['c-vence']);
    assert.ok(resto.every(({ atributos }) => atributos.href === '#licencias' && atributos.class === 'me-nivel'));
    // Sin la licencia que vence, tres capas: las dos licencias y lo que no se habilita
    assert.deepEqual(capasDelSvg(vacaciones.adentro).map(({ clase }) => clase), ['c-tinta', 'c-medio', 'c-por-habilitar']);
  });

  it('las pastillas: el mes que vence, el disponible, el que todavía suma y lo no utilizado previamente', () => {
    const html = M.htmlDePastillas(planta.pastillas);
    assert.match(html, /^<h3 class="me-subtitulo">Francos compensatorios<\/h3><ol class="me-pastillas">/);
    assert.deepEqual(filasDe(html).map(({ clases, texto }) => [clases.join(' '), texto]), [
      ['me-pastilla vence', '1 Octubre Hasta el viernes 30/10'],
      ['me-pastilla', '1 Noviembre Por las horas de septiembre'],
      ['me-pastilla pendiente', '1 Diciembre Octubre sigue sumando'],
      ['me-pastilla previo', '1 Agosto No utilizado previamente']
    ]);
    assert.deepEqual(filasDe(M.htmlDePastillas(contrato.pastillas)).map(({ clases, texto }) => [clases.join(' '), texto]), [
      ['me-pastilla vence', '1,5 Octubre De 10,5, hasta el viernes 30/10'],
      ['me-pastilla pendiente', '4 Noviembre Octubre sigue sumando'],
      ['me-pastilla previo', '6,5 Horas de 2026 No utilizadas previamente']
    ]);
    // Sin ningún mes ni nada no utilizado, nada
    assert.equal(M.htmlDePastillas({ titulo: 'Francos compensatorios', meses: [], previo: null }), '');
    assert.equal(M.htmlDePastillas(null), '');
  });

  it('sin nada que venza: sin «Vence pronto» y sin marca', () => {
    const resumen = resumenDel(PLANTA, { estado: SIN_NADA_QUE_VENZA });
    assert.deepEqual(resumen.vence_pronto, []);
    assert.equal(resumen.marca, false);
    const html = M.htmlDelResumen(resumen);
    assert.ok(!html.includes('Vence pronto'));
    assert.doesNotMatch(html, /data-accion/);
    assert.equal(M.htmlDeMarca(resumen.marca), '');
  });

  it('la marca de la pestaña: con algo que vence pronto, una imagen con su nombre (no un title); si no, nada', () => {
    assert.equal(planta.marca, true);
    assert.equal(M.htmlDeMarca(planta.marca), '<span class="me-marca" role="img" aria-label="Hay algo que vence pronto"></span>');
    for (const otro of [false, 1, 'true', null, undefined, {}]) assert.equal(M.htmlDeMarca(otro), '', String(otro));
  });

  it('los faltantes: un aviso ámbar arriba de «Lo que te queda»', () => {
    const resumen = resumenDel(PLANTA, { estado: conLicencias(PLANTA.estado, licencia(100, 'franco', '2027-02-01')) });
    const texto = 'Revisá tus francos de febrero de 2027: cargaste 1 y no corresponde ninguno.';
    assert.deepEqual(resumen.faltantes, [texto]);
    const html = M.htmlDelResumen(resumen);
    assert.ok(html.includes(`<p class="me-aviso me-aviso-ambar">${texto}</p>`));
    assert.ok(html.indexOf('Vence pronto') >= 0, 'con «Vence pronto»');
    assert.ok(html.indexOf('Vence pronto') < html.indexOf('me-aviso-ambar'));
    assert.ok(html.indexOf('me-aviso-ambar') < html.indexOf('Lo que te queda'));
    // Varios, en una lista; ninguno, nada
    const dos = M.htmlDeFaltantes([texto, 'Revisá tus vacaciones: para el 15/06/2027 faltan 2 días habilitados.']);
    assert.match(dos, /^<div class="me-aviso me-aviso-ambar"><ul class="me-faltantes"><li>Revisá tus francos/);
    assert.equal(filasDe(dos.replace(/<li>/g, '<li class="">')).length, 2);
    assert.equal(M.htmlDeFaltantes([]), '');
    assert.equal(M.htmlDeFaltantes(undefined), '');
    assert.equal(M.htmlDelResumen(planta).includes('me-aviso-ambar'), false);
  });

  it('Hoy y mañana: los compañeros que no están hoy, con su vuelta, y el próximo feriado «Lunes 23/11»', () => {
    const html = M.htmlDeHoyYManana(planta.hoy_y_manana, planta.persona.ve_companeros);
    assert.match(html, /^<section class="me-hoy" aria-labelledby="me-hoy-titulo"><h2 class="me-titulo" id="me-hoy-titulo">Hoy y mañana<\/h2>/);
    assert.equal(textoDe(html), 'Hoy y mañana Hoy no están MR Martín Ríos no está Vuelve el lunes 02/11 Próximo feriado Lunes 23/11 Día de la Soberanía Nacional');
    // Las iniciales son decorativas
    assert.ok(html.includes('<span class="me-inicial" aria-hidden="true">MR</span>'));
    assert.ok(html.includes('<p class="me-feriado"><b>Lunes 23/11</b>Día de la Soberanía Nacional</p>'));
  });

  // Decisión del usuario (27/10/2026): «Hoy no están» y «Mañana no están», por separado y en ese orden, antes del feriado
  it('Hoy y mañana: «Hoy no están» y, aparte, «Mañana no están», cada uno con su título, antes del próximo feriado', () => {
    const resumen = resumenDel(PLANTA, { ausencias: [AUSENCIA_DE_DIEGO, AUSENCIA_DE_MARTIN] });
    const html = M.htmlDeHoyYManana(resumen.hoy_y_manana, true);
    assert.equal(textoDe(html), 'Hoy y mañana Hoy no están MR Martín Ríos no está Vuelve el lunes 02/11 '
      + 'Mañana no están DF Diego Fernández no está Vuelve el miércoles 28/10 Próximo feriado Lunes 23/11 Día de la Soberanía Nacional');
    assert.deepEqual([...html.matchAll(/<h3 class="me-subtitulo">([^<]*)<\/h3>/g)].map(([, titulo]) => titulo),
      ['Hoy no están', 'Mañana no están', 'Próximo feriado']);
    assert.equal([...html.matchAll(/<ul class="me-ausentes">/g)].length, 2);
    // Un grupo vacío no aparece: con solo el de mañana, sin «Hoy no están»
    const soloManana = M.htmlDeHoyYManana(resumenDel(PLANTA, { ausencias: [AUSENCIA_DE_DIEGO] }).hoy_y_manana, true);
    assert.equal(textoDe(soloManana), 'Hoy y mañana Mañana no están DF Diego Fernández no está Vuelve el miércoles 28/10 '
      + 'Próximo feriado Lunes 23/11 Día de la Soberanía Nacional');
  });

  // Review Focus 5
  it('Hoy y mañana: un ausente con HTML en el nombre se ve escapado, en los dos grupos', () => {
    const resumen = resumenDel(PLANTA, {
      ausencias: [{ ...AUSENCIA_DE_MARTIN, nombre: '<b>x</b>' }, { ...AUSENCIA_DE_DIEGO, nombre: MALICIOSO }]
    });
    const html = M.htmlDeHoyYManana(resumen.hoy_y_manana, true);
    assert.ok(!html.includes('<b>x</b>'));
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('<b>&lt;b&gt;x&lt;/b&gt; no está</b>'));
    assert.ok(html.includes(`<b>${ESCAPADO} no está</b>`));
    assert.ok(M.htmlDelResumen(resumen).includes('&lt;b&gt;x&lt;/b&gt; no está'));
  });

  it('Hoy y mañana: quien no ve a sus compañeros no tiene los grupos; sin ausentes, tampoco; sin nada, no hay sección', () => {
    const conLosDos = resumenDel(PLANTA, { ausencias: [AUSENCIA_DE_DIEGO, AUSENCIA_DE_MARTIN] }).hoy_y_manana;
    const lectora = M.htmlDeHoyYManana(contrato.hoy_y_manana, contrato.persona.ve_companeros);
    assert.equal(textoDe(lectora), 'Hoy y mañana Próximo feriado Lunes 23/11 Día de la Soberanía Nacional');
    assert.equal(textoDe(M.htmlDeHoyYManana(conLosDos, false)), 'Hoy y mañana Próximo feriado Lunes 23/11 Día de la Soberanía Nacional');
    // Solo el true literal
    assert.ok(!M.htmlDeHoyYManana(conLosDos, 'true').includes('no están'));
    // Sin nadie que no esté, los grupos no aparecen (como «Vence pronto» vacío): solo se ven los de administración que eligieron
    // mostrarse, así que «están todos» podría no ser cierto
    const soloElFeriado = { ausentes_hoy: [], ausentes_manana: [], proximo_feriado: planta.hoy_y_manana.proximo_feriado };
    assert.equal(textoDe(M.htmlDeHoyYManana(soloElFeriado, true)), 'Hoy y mañana Próximo feriado Lunes 23/11 Día de la Soberanía Nacional');
    // Sin ausentes y sin próximo feriado, la sección no se dibuja
    assert.equal(M.htmlDeHoyYManana({ ausentes_hoy: [], ausentes_manana: [], proximo_feriado: null }, true), '');
    assert.equal(M.htmlDeHoyYManana(conLosDos, false).includes('me-ausentes'), false);
    assert.equal(M.htmlDeHoyYManana({ ...conLosDos, proximo_feriado: null }, false), '');
    for (const raro of [undefined, null, 'x', {}]) assert.equal(M.htmlDeHoyYManana(raro, true), '', String(raro));
    const sinHoyYManana = M.htmlDelResumen({ ...planta, hoy_y_manana: { ausentes_hoy: [], ausentes_manana: [], proximo_feriado: null } });
    assert.equal(sinHoyYManana.includes('me-hoy'), false);
    assert.ok(sinHoyYManana.includes('Lo que te queda'));
  });

  it('sin modalidad, el mensaje; sin arranque, la invitación a «Mis vacaciones y saldos»', () => {
    const sinModalidad = resumenDel(PLANTA, { estado: { ...PLANTA.estado, modalidad: null } });
    assert.equal(M.htmlDelResumen(sinModalidad), M.htmlDeMensaje(MENSAJES_MI_ESPACIO.sinModalidad));
    const sinArranque = resumenDel(PLANTA, { estado: { ...PLANTA.estado, arranque: null } });
    assert.equal(sinArranque.abrir_saldos, true);
    assert.equal(M.htmlDelResumen(sinArranque), M.htmlSinArranque());
    assert.equal(M.htmlDelResumen(null), '');
  });

  it('un Resumen sin tanques ni pastillas (sin un hoy válido) no se rompe: sin «Lo que te queda»', () => {
    const html = M.htmlDelResumen({ ...planta, tanques: null, pastillas: null, extraordinaria: null, vence_pronto: [] });
    assert.ok(!html.includes('Lo que te queda'));
    assert.ok(html.includes('Hoy y mañana'));
  });

  it('svgDeTanque: con la capacidad en 0 o rara, o con capas raras, ningún NaN ni Infinity, y nada sale del tanque', () => {
    const sinNumeros = (svg) => assert.doesNotMatch(svg, /NaN|Infinity|undefined|null/);
    for (const capacidad of [0, -3, NaN, Infinity, undefined, null, '48', {}]) {
      const svg = M.svgDeTanque({ capas: [{ clase: 'tinta', n: 3 }], capacidad, ancho: 52, alto: 112, id: 'me-tanque-1' });
      sinNumeros(svg);
      assert.deepEqual(capasDelSvg(svg).map(({ y, alto }) => [y, alto]), [[112, 0]], String(capacidad));
    }
    // Capas que pasan la capacidad se cortan en el borde de arriba; una n negativa, rara o que no es un número cuenta 0
    const desbordado = capasDelSvg(M.svgDeTanque({
      capas: [{ clase: 'tinta', n: 30 }, { clase: 'medio', n: -5 }, { clase: 'vence', n: '7' }, { clase: 'otra', n: 30 }, null],
      capacidad: 40, ancho: 52, alto: 112, id: 'x'
    }));
    assert.deepEqual(desbordado.map(({ clase }) => clase), ['c-tinta', 'c-medio', 'c-vence', 'c-tinta']);
    assert.ok(casi(desbordado[0].alto, 84));
    assert.deepEqual(desbordado.slice(1, 3).map(({ alto }) => alto), [0, 0]);
    assert.ok(casi(desbordado[3].alto, 28) && casi(desbordado[3].y, 0));
    // Sin capas, el tanque vacío; sin medidas, las de los tanques chicos
    sinNumeros(M.svgDeTanque({ capas: undefined, capacidad: 10, id: 'y' }));
    assert.match(M.svgDeTanque({ capas: [], capacidad: 10, id: 'y' }), /viewBox="0 0 52 112"/);
    // El id va solo con letras, números y guiones
    assert.ok(M.svgDeTanque({ capas: [], capacidad: 1, id: '"><img src=x>' }).includes('<clipPath id="imgsrcx">'));
  });

  it('un tanque de horas a favor sin horas (el total en 0) se dibuja vacío, sin NaN', () => {
    const resumen = resumenDel(CONTRATO, { estado: { ...CONTRATO.estado, horasExtras: [], licencias: [] } });
    const horas = resumen.tanques.otros.find(({ clave }) => clave === 'horas_a_favor');
    assert.equal(horas.total, 0);
    const html = M.htmlDeTanques(resumen.tanques);
    assert.doesNotMatch(html, /NaN|Infinity/);
    assert.ok(capasDelSvg(linksDe(html)[1].adentro).every(({ alto }) => alto === 0));
  });

  // Review Focus 5
  it('todo texto del servidor del Resumen se escapa: Vence pronto, los tanques, la lista, las pastillas y la modalidad', () => {
    const conHtml = comoLlega(planta);
    conHtml.modalidad.texto = MALICIOSO;
    Object.assign(conHtml.vence_pronto[0], { dia: MALICIOSO, mes: MALICIOSO, cuando: MALICIOSO, titulo: MALICIOSO, detalle: MALICIOSO });
    conHtml.vence_pronto[0].accion = { texto: MALICIOSO, tipo: MALICIOSO };
    Object.assign(conHtml.tanques.vacaciones, { numero: MALICIOSO, unidad: MALICIOSO, pie: MALICIOSO, aria: MALICIOSO });
    Object.assign(conHtml.tanques.vacaciones.capas[0], { nombre: MALICIOSO, nota: MALICIOSO, clase: MALICIOSO });
    Object.assign(conHtml.tanques.otros[0], { nombre: MALICIOSO, numero: MALICIOSO, unidad: MALICIOSO, de: MALICIOSO, aria: MALICIOSO, pestana: MALICIOSO });
    conHtml.pastillas.titulo = MALICIOSO;
    Object.assign(conHtml.pastillas.meses[0], { numero: MALICIOSO, mes: MALICIOSO, nota: MALICIOSO, estado: MALICIOSO });
    Object.assign(conHtml.pastillas.previo, { numero: MALICIOSO, titulo: MALICIOSO, nota: MALICIOSO });
    conHtml.extraordinaria = MALICIOSO;
    conHtml.al_texto = MALICIOSO;
    conHtml.faltantes = [MALICIOSO];
    conHtml.hoy_y_manana.proximo_feriado = { fecha: '2026-11-23', cuando: MALICIOSO, nombre: MALICIOSO };
    const html = M.htmlDelResumen(conHtml);
    assert.ok(!html.includes('<img'), 'ningún <img> de verdad');
    assert.ok(html.split(ESCAPADO).length - 1 >= 30);
    // Un aria-label del servidor, escapado; una pestaña desconocida, a Licencias; una clase desconocida, en tinta
    assert.equal(linksDe(html)[0].atributos['aria-label'], ESCAPADO);
    assert.equal(linksDe(html)[1].atributos.href, '#licencias');
    assert.equal(capasDelSvg(linksDe(html)[0].adentro)[0].clase, 'c-tinta');
    assert.equal(botonesDe(html).find(({ atributos }) => atributos['data-accion']).atributos['data-tipo'], ESCAPADO);
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
// La agenda (spec 2026-10-26-mi-espacio-agenda, 6; Task 9): el mes, los próximos, los colores y los eventos de «Hoy y mañana», con lo
// que manda GET /api/mi-espacio/eventos armado por el servidor (itemDeEvento, itemDeLicencia, itemDeAusencia e itemsDeFeriados de
// services/miEspacioEventosReglas.js), pasado por JSON. Hoy es el lunes 26/10/2026 y quien mira es Laura Gómez (1); las personas son
// las inventadas de la maqueta
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
// los ve: `puedeCompartir`)
const respuestaDeEventos = ({ desde, hasta }, {
  eventos = EVENTOS_DE_PRUEBA, licencias = LICENCIAS_DE_PRUEBA, ausencias = AUSENCIAS_DE_PRUEBA,
  feriados = [FERIADO_DIVERSIDAD, FERIADO_SOBERANIA], puedeCompartir = true
} = {}) => {
  const rango = { desde, hasta, feriados: SIN_FERIADOS };
  const seTocan = (fila) => fila.desde <= hasta && fila.hasta >= desde;
  return comoLlega({
    desde, hasta, hoy: HOY, puede_compartir: puedeCompartir,
    eventos: eventos.filter((evento) => evento.fecha >= desde && evento.fecha <= hasta)
      .map((evento) => itemDeEvento(evento, { usuarioId: 1, ahora: AHORA, feriados: SIN_FERIADOS })),
    licencias: licencias.filter(seTocan).map((fila) => itemDeLicencia(fila, rango)),
    feriados: itemsDeFeriados(feriados, desde, hasta),
    ausentes: puedeCompartir ? ausencias.filter(seTocan).map((ausencia) => itemDeAusencia(ausencia, rango)) : []
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

  it('cosasPorDia: el feriado, tus licencias, los compañeros y los eventos por hora y título; licencias y compañeros, en sus días', () => {
    assert.deepEqual(cosasDe(DEL_MES), {
      '2026-10-12': [{ clase: 'feriado', texto: 'Feriado: Día del Respeto a la Diversidad Cultural' }],
      '2026-10-15': [{ clase: 'licencia', texto: 'Franquicia, 2 h' }],
      '2026-10-23': [{ clase: 'ausente', texto: 'Martín Ríos no está' }],
      '2026-10-26': [{ clase: 'ausente', texto: 'Martín Ríos no está' },
        { clase: 'propio', texto: '12:00 Llamar a Vialidad por el TMDA', evento_id: 11 }],
      '2026-10-27': [{ clase: 'ausente', texto: 'Martín Ríos no está' }, { clase: 'compartido', texto: '10:00 Reunión de equipo', evento_id: 12 }],
      '2026-10-28': [{ clase: 'ausente', texto: 'Martín Ríos no está' }, { clase: 'propio', texto: '15:30 Turno médico', evento_id: 13 }],
      '2026-10-29': [{ clase: 'ausente', texto: 'Martín Ríos no está' },
        { clase: 'compartido', texto: '09:00 Entrega del informe trimestral', evento_id: 14 }],
      '2026-10-30': [{ clase: 'ausente', texto: 'Martín Ríos no está' }, { clase: 'ausente', texto: 'Sofía Paz no está' }]
    });
    // Los eventos de un día, por hora (el de las 09:00 primero, aunque llegue después)
    assert.deepEqual(cosasDe(UN_DIA_LLENO)['2026-10-15'], [
      { clase: 'feriado', texto: 'Feriado: Feriado de prueba' }, { clase: 'licencia', texto: 'Franquicia, 2 h' },
      { clase: 'ausente', texto: 'Martín Ríos no está' }, { clase: 'compartido', texto: '09:00 Café con Catastro', evento_id: 32 },
      { clase: 'propio', texto: '16:00 Revisar el informe', evento_id: 31 }
    ]);
    for (const raro of [null, undefined, {}, 'x', { eventos: 'x', licencias: [null], feriados: [{ fecha: 'raro' }] }]) {
      assert.deepEqual(cosasDe(raro), {}, JSON.stringify(raro));
    }
  });

  it('htmlDelMes: la cabeza de lunes a domingo y una celda por día; hoy marcado, los fines de semana, los feriados y los otros meses', () => {
    const html = M.htmlDelMes('2026-10', DEL_MES, HOY);
    assert.match(html, /^<table class="me-mes" aria-labelledby="ag-mes-titulo"><thead><tr>/);
    assert.deepEqual([...html.matchAll(/<th scope="col">([\s\S]*?)<\/th>/g)].map(([, th]) => th), [
      ['Lun', 'lunes'], ['Mar', 'martes'], ['Mié', 'miércoles'], ['Jue', 'jueves'], ['Vie', 'viernes'], ['Sáb', 'sábado'], ['Dom', 'domingo']
    ].map(([corto, largo]) => `<span aria-hidden="true">${corto}</span><span class="visualmente-oculto">${largo}</span>`));
    const celdas = celdasDe(html);
    assert.equal(celdas.length, 35);
    assert.equal([...html.matchAll(/<tr>/g)].length, 6, 'la cabeza y cinco semanas');
    const dias = plano(M.diasDeLaGrilla('2026-10'));
    celdas.forEach((celda, i) => {
      assert.ok(celda.html.startsWith(`<div class="me-celda-cuerpo"><span class="me-num">${dias[i].dia}</span>`), dias[i].fecha);
      assert.equal(celda.clases.includes('finde'), dias[i].finde, dias[i].fecha);
      assert.equal(celda.clases.includes('otro-mes'), !dias[i].del_mes, dias[i].fecha);
      assert.equal(celda.clases.includes('hoy'), dias[i].fecha === HOY, dias[i].fecha);
      assert.equal(celda.clases.includes('feriado'), dias[i].fecha === '2026-10-12', dias[i].fecha);
      assert.equal(celda.atributos['aria-current'], dias[i].fecha === HOY ? 'date' : undefined, dias[i].fecha);
    });
    assert.deepEqual(celdaDel(html, '2026-10', HOY).clases, ['me-celda', 'hoy']);
    assert.deepEqual(celdaDel(html, '2026-10', '2026-10-03').clases, ['me-celda', 'finde']);
    assert.equal([...html.matchAll(/aria-current="date"/g)].length, 1);
    // Sin datos (mientras se piden), la grilla sin nada adentro
    assert.equal(celdasDe(M.htmlDelMes('2026-10', null, HOY)).filter((celda) => celda.html.includes('me-ev')).length, 0);
    assert.equal(M.htmlDelMes('raro', DEL_MES, HOY), '');
  });

  it('htmlDelMes: los colores; un evento es un botón con su id y su title, y lo demás un span con su title', () => {
    const html = M.htmlDelMes('2026-10', DEL_MES, HOY);
    assert.ok(celdaDel(html, '2026-10', HOY).html.endsWith('<span class="me-ev ausente" title="Martín Ríos no está">Martín Ríos no está</span>'
      + '<button type="button" class="me-ev propio" data-evento="11" title="12:00 Llamar a Vialidad por el TMDA">12:00 Llamar a Vialidad por el TMDA</button></div>'));
    // Uno compartido por vos y uno de otra persona, en violeta
    assert.ok(celdaDel(html, '2026-10', '2026-10-27').html.includes('<button type="button" class="me-ev compartido" data-evento="12" title="10:00 Reunión de equipo">'));
    assert.ok(celdaDel(html, '2026-10', '2026-10-29').html.includes('<button type="button" class="me-ev compartido" data-evento="14" '));
    assert.ok(celdaDel(html, '2026-10', '2026-10-15').html.includes('<span class="me-ev licencia" title="Franquicia, 2 h">Franquicia, 2 h</span>'));
    assert.ok(celdaDel(html, '2026-10', '2026-10-12').html.includes(
      '<span class="me-ev feriado" title="Feriado: Día del Respeto a la Diversidad Cultural">Feriado: Día del Respeto a la Diversidad Cultural</span>'));
    // Un evento de otra persona que no dice compartido (no debería pasar) va igual en violeta
    const ajeno = { ...DEL_MES, eventos: [{ ...DEL_MES.eventos.find((evento) => evento.id === 14), compartido: false }] };
    assert.ok(M.htmlDelMes('2026-10', ajeno, HOY).includes('class="me-ev compartido" data-evento="14"'));
    assert.doesNotMatch(html, /aria-live|role="status"/);
  });

  it('htmlDelMes: con más de tres cosas, las tres primeras y «y 2 más», que muestra el resto en la celda', () => {
    const celda = celdaDel(M.htmlDelMes('2026-10', UN_DIA_LLENO, HOY), '2026-10', '2026-10-15');
    assert.deepEqual(celda.clases, ['me-celda', 'feriado']);
    assert.equal(celda.html, '<div class="me-celda-cuerpo"><span class="me-num">15</span>'
      + '<span class="me-ev feriado" title="Feriado: Feriado de prueba">Feriado: Feriado de prueba</span>'
      + '<span class="me-ev licencia" title="Franquicia, 2 h">Franquicia, 2 h</span>'
      + '<span class="me-ev ausente" title="Martín Ríos no está">Martín Ríos no está</span>'
      + '<div class="me-resto" hidden>'
      + '<button type="button" class="me-ev compartido" data-evento="32" title="09:00 Café con Catastro">09:00 Café con Catastro</button>'
      + '<button type="button" class="me-ev propio" data-evento="31" title="16:00 Revisar el informe">16:00 Revisar el informe</button></div>'
      + '<button type="button" class="me-mas" data-ver-mas="2026-10-15">y 2 más</button></div>');
    // Con tres justas, ningún «más»
    assert.ok(!celdaDel(M.htmlDelMes('2026-10', UN_DIA_LLENO, HOY), '2026-10', '2026-10-14').html.includes('me-mas'));
  });

  // Review Focus 2: el HTML de un título o de un nombre es texto, también en el title
  it('htmlDelMes: un título y un nombre con HTML se ven escapados, en el texto y en el title', () => {
    const titulo = `${MALICIOSO} "comillas"`;
    const datos = respuestaDeEventos({ desde: '2026-09-28', hasta: '2026-11-01' }, {
      eventos: [eventoDe(41, titulo, '2026-10-26', '12:00')], ausencias: [{ nombre: MALICIOSO, desde: '2026-10-26', hasta: '2026-10-26' }],
      licencias: [], feriados: [{ ...FERIADO_SOBERANIA, fecha: '2026-10-27', nombre: MALICIOSO }]
    });
    const html = M.htmlDelMes('2026-10', datos, HOY);
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes(`<button type="button" class="me-ev propio" data-evento="41" title="12:00 ${ESCAPADO} &quot;comillas&quot;">12:00 ${ESCAPADO} &quot;comillas&quot;</button>`));
    assert.ok(html.includes(`<span class="me-ev ausente" title="${ESCAPADO} no está">${ESCAPADO} no está</span>`));
    assert.ok(html.includes(`<span class="me-ev feriado" title="Feriado: ${ESCAPADO}">Feriado: ${ESCAPADO}</span>`));
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
      { hora: 'Jue 29', titulo: '09:00 Entrega del informe trimestral', detalle: 'Aviso 2 h antes', clase: 'compartido', quien: 'De Martín Ríos',
        evento_id: 14 },
      { hora: 'Vie 30', titulo: 'Sofía Paz no está', detalle: '', clase: 'ausente' }
    ] },
    { titulo: 'Más adelante', items: [
      { hora: 'Lun 02/11', titulo: '10:00 Reunión de equipo', detalle: 'Aviso 2 h antes', clase: 'compartido', quien: 'Con todos', evento_id: 15 },
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

  it('htmlDeProximos: cada grupo con su título y cada cosa con la hora, el título y el detalle; un evento es un botón con su id', () => {
    const html = M.htmlDeProximos(M.gruposDeProximos(PROXIMOS, HOY));
    assert.deepEqual([...html.matchAll(/<h3>([^<]*)<\/h3>/g)].map(([, titulo]) => titulo),
      ['Hoy, lunes 26/10', 'Mañana, martes 27/10', 'Esta semana', 'Más adelante']);
    assert.equal(textoDe(html), 'Hoy, lunes 26/10 Todo el día Martín Ríos no está Hasta el viernes 30/10 '
      + '12:00 Llamar a Vialidad por el TMDA Solo vos Aviso 2 h antes '
      + 'Mañana, martes 27/10 10:00 Reunión de equipo Con 4 personas Aviso 2 h antes '
      + 'Esta semana Mié 28 15:30 Turno médico Solo vos Aviso el día hábil anterior '
      + 'Jue 29 09:00 Entrega del informe trimestral De Martín Ríos Aviso 2 h antes Vie 30 Sofía Paz no está '
      + 'Más adelante Lun 02/11 10:00 Reunión de equipo Con todos Aviso 2 h antes Mar 03/11 Vacaciones Hasta el lunes 09/11 '
      + 'Lun 23/11 Feriado: Día de la Soberanía Nacional');
    assert.ok(html.includes('<li class="me-prox propio"><span class="me-prox-hora">12:00</span>'
      + '<button type="button" class="me-prox-titulo" data-evento="11">Llamar a Vialidad por el TMDA</button>'
      + '<span class="me-prox-detalle"><span class="me-insignia azul">Solo vos</span>Aviso 2 h antes</span></li>'));
    assert.ok(html.includes('<span class="me-prox-detalle"><span class="me-insignia violeta">De Martín Ríos</span>Aviso 2 h antes</span>'));
    assert.ok(html.includes('<li class="me-prox ausente"><span class="me-prox-hora">Vie 30</span><span class="me-prox-titulo">Sofía Paz no está</span></li>'));
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
      eventos: [eventoDe(61, MALICIOSO, '2026-10-26', '12:00'), eventoDe(62, 'Otro', '2026-10-28', '10:00', { ...DE_MARTIN, creador: MALICIOSO })],
      ausencias: [{ nombre: MALICIOSO, desde: '2026-10-29', hasta: '2026-10-29' }], licencias: [], feriados: []
    });
    const html = M.htmlDeProximos(M.gruposDeProximos(datos, HOY));
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes(`data-evento="61">${ESCAPADO}</button>`));
    assert.ok(html.includes(`<span class="me-insignia violeta">De ${ESCAPADO}</span>`));
    assert.ok(html.includes(`<span class="me-prox-titulo">${ESCAPADO} no está</span>`));
  });
});

describe('la agenda: los eventos de «Hoy y mañana»', () => {
  const planta = resumenDel(PLANTA, { ausencias: [AUSENCIA_DE_MARTIN] });
  const items = respuestaDeEventos({ desde: HOY, hasta: MANANA }).eventos;
  const EVENTOS_DE_HOY = comoLlega(eventosDeHoyYManana(items, HOY));

  it('los eventos de hoy y mañana con su hora, su título y quién; después, «Ver la agenda», y los compañeros y el feriado', () => {
    const html = M.htmlDeHoyYManana({ ...planta.hoy_y_manana, eventos: EVENTOS_DE_HOY }, true);
    assert.equal(textoDe(html), 'Hoy y mañana 12:00 Llamar a Vialidad por el TMDA Hoy · solo vos 10:00 Reunión de equipo Mañana · con 4 personas '
      + 'Ver la agenda Hoy no están MR Martín Ríos no está Vuelve el lunes 02/11 Próximo feriado Lunes 23/11 Día de la Soberanía Nacional');
    assert.ok(html.includes('<ol class="me-eventos-hoy"><li><span class="me-evento-hora">12:00</span><span><b>Llamar a Vialidad por el TMDA</b>'
      + '<small>Hoy · solo vos</small></span></li><li class="compartido"><span class="me-evento-hora">10:00</span>'));
    assert.deepEqual(linksDe(html).map(({ atributos, texto }) => [atributos.href, atributos['data-pestana'], texto]), [['#agenda', 'agenda', 'Ver la agenda']]);
    assert.ok(M.htmlDelResumen({ ...planta, hoy_y_manana: { ...planta.hoy_y_manana, eventos: EVENTOS_DE_HOY } }).includes('Ver la agenda'));
  });

  it('sin eventos, «No tenés eventos hoy ni mañana.» y «Ver la agenda», aunque no haya nadie que no esté ni feriado', () => {
    const html = M.htmlDeHoyYManana({ ausentes_hoy: [], ausentes_manana: [], proximo_feriado: null, eventos: [] }, true);
    assert.equal(textoDe(html), 'Hoy y mañana No tenés eventos hoy ni mañana. Ver la agenda');
    assert.ok(html.includes('<p class="me-vacio">No tenés eventos hoy ni mañana.</p>'));
    // Quien no ve a sus compañeros ve igual sus eventos
    assert.equal(textoDe(M.htmlDeHoyYManana({ ...planta.hoy_y_manana, eventos: EVENTOS_DE_HOY }, false)),
      'Hoy y mañana 12:00 Llamar a Vialidad por el TMDA Hoy · solo vos 10:00 Reunión de equipo Mañana · con 4 personas Ver la agenda '
      + 'Próximo feriado Lunes 23/11 Día de la Soberanía Nacional');
    // Sin la clave (un Resumen anterior a la agenda), como antes
    assert.equal(M.htmlDeHoyYManana({ ausentes_hoy: [], ausentes_manana: [], proximo_feriado: null }, true), '');
    assert.ok(!M.htmlDeHoyYManana(planta.hoy_y_manana, true).includes('Ver la agenda'));
  });

  // Review Focus 2
  it('un título y un nombre con HTML se ven escapados en «Hoy y mañana»', () => {
    const conHtml = comoLlega(eventosDeHoyYManana(respuestaDeEventos({ desde: HOY, hasta: MANANA }, {
      eventos: [eventoDe(71, MALICIOSO, HOY, '12:00'), eventoDe(72, 'Otro', MANANA, '10:00', { ...DE_MARTIN, creador: MALICIOSO })]
    }).eventos, HOY));
    const html = M.htmlDeHoyYManana({ ausentes_hoy: [], ausentes_manana: [], proximo_feriado: null, eventos: conHtml }, true);
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes(`<b>${ESCAPADO}</b>`));
    assert.ok(html.includes(`<small>Mañana · de ${ESCAPADO}</small>`));
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

// `cuadros`: con true, la ventana tiene un requestAnimationFrame que anota las funciones en estado.cuadros (las corre el test);
// sin él, la página no anima. Los temporizadores no corren solos: `correr` corre los que hay (el foco de los modales y la
// espera del cálculo). `auditor`: lo que contesta Auth.isAuditor(); `admin`, Auth.isAdmin() (la página lo pregunta solo al abrir el
// formulario del evento: compartir es de administración). Hoy es HOY. `estado.toasts`: cada showToast (el de main.js), [mensaje, tipo]
const montarPagina = ({ hash = '', responder = RESPUESTAS_DE_ENTRADA, cuadros = false, auditor = false, admin = false } = {}) => {
  const { dom, documento } = crearDom();
  const estado = { pedidos: [], direcciones: [], sesionCerrada: false, responder, cuadros: [], toasts: [] };
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
    ...(cuadros ? { requestAnimationFrame: (funcion) => { estado.cuadros.push(funcion); return estado.cuadros.length; } } : {})
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
    setTimeout: (funcion, ms) => {
      ultimoTemporizador += 1;
      temporizadores.set(ultimoTemporizador, { funcion, ms });
      return ultimoTemporizador;
    },
    clearTimeout: (id) => { temporizadores.delete(id); },
    fetch: async (url, opciones = {}) => {
      const metodo = opciones.method ?? 'GET';
      const cuerpo = opciones.body === undefined ? undefined : JSON.parse(opciones.body);
      estado.pedidos.push({ metodo, ruta: url, cuerpo });
      const r = await estado.responder(metodo, url, cuerpo);
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
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
  // Un cuadro del navegador: corre lo que se pidió con requestAnimationFrame hasta ahora (lo que se pida adentro, en el próximo)
  const cuadro = () => { for (const funcion of estado.cuadros.splice(0)) funcion(0); };
  const abierto = (id) => el(id).classList.contains('active');
  return {
    contexto, dom, documento, ventana, estado, el, rutas, pedidosA, iniciar, tocar, esperar, correr, escribir, elegir, tecla,
    cuadro, abierto
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

  it('un tanque lleva a su pestaña: la abre (la pide la primera vez), escribe el fragmento y el foco va a la pestaña', async () => {
    const pagina = montarPagina();
    await pagina.iniciar();
    const tanque = pagina.el('vista-resumen').querySelectorAll('[data-pestana]').find((link) => link.getAttribute('href') === '#licencias');
    const evento = tanque.disparar('click');
    await pagina.esperar();
    assert.equal(evento.defaultPrevented, true);
    assert.equal(pagina.el('tab-licencias').getAttribute('aria-selected'), 'true');
    assert.equal(pagina.el('vista-licencias').hidden, false);
    assert.equal(pagina.ventana.location.hash, '#licencias');
    assert.equal(pagina.documento.activeElement, pagina.el('tab-licencias'));
    assert.ok(pagina.rutas().includes('/api/mi-espacio/licencias'));
    // Con Ctrl (abrir en otra pestaña del navegador), el link hace lo suyo
    await pagina.tocar(pagina.el('tab-resumen'));
    const conCtrl = tanque.disparar('click', { ctrlKey: true });
    assert.equal(conCtrl.defaultPrevented, false);
    assert.equal(pagina.el('tab-resumen').getAttribute('aria-selected'), 'true');
  });

  it('los tanques se llenan una sola vez, dos cuadros después de verse el Resumen; un Resumen que se vuelve a dibujar ya no se mueve', async () => {
    const pagina = montarPagina({ cuadros: true });
    await pagina.iniciar();
    const fila = pagina.el('vista-resumen').querySelector('.me-niveles-fila');
    assert.equal(fila.getAttribute('data-llenar'), '');
    pagina.cuadro();
    assert.equal(fila.getAttribute('data-llenar'), '', 'el primer cuadro los dibuja vacíos');
    pagina.cuadro();
    assert.equal(fila.getAttribute('data-llenar'), null, 'el segundo los llena');
    await pagina.contexto.cargarResumen();
    assert.equal(pagina.el('vista-resumen').querySelector('.me-niveles-fila').getAttribute('data-llenar'), null);
    assert.equal(pagina.estado.cuadros.length, 0);
  });

  it('con el Resumen oculto (#licencias), los tanques esperan vacíos a que se vea la pestaña', async () => {
    const pagina = montarPagina({ hash: '#licencias', cuadros: true });
    await pagina.iniciar();
    const fila = pagina.el('vista-resumen').querySelector('.me-niveles-fila');
    assert.equal(fila.getAttribute('data-llenar'), '');
    assert.equal(pagina.estado.cuadros.length, 0);
    await pagina.tocar(pagina.el('tab-resumen'));
    pagina.cuadro();
    pagina.cuadro();
    assert.equal(fila.getAttribute('data-llenar'), null);
    // Volver a la pestaña no los vuelve a llenar
    await pagina.tocar(pagina.el('tab-horas'));
    await pagina.tocar(pagina.el('tab-resumen'));
    assert.equal(pagina.estado.cuadros.length, 0);
  });

  it('sin requestAnimationFrame, los tanques se ven llenos enseguida', async () => {
    const pagina = montarPagina();
    await pagina.iniciar();
    assert.equal(pagina.el('vista-resumen').querySelector('.me-niveles-fila').getAttribute('data-llenar'), null);
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
      [licencia, null, '2026-11-10'], [licencia, 'Persona Autorizada', '2026-11-10']]) {
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
  // de las vacaciones del año (la primera mitad) y el campo de los estudios dependen de los días y de la carrera del año
  it('camposConLoElegido da los campos de camposDelSaldoInicial con los días y los estudios que se eligen', () => {
    const sinValor = (campos) => plano(campos).map(({ valor, ...campo }) => campo);
    for (const modalidad of ['planta', 'contrato']) {
      for (const arranque of ['2026-10-26', '2026-05-04']) {
        for (const inicial of [[], [{ anio: 2026, dias_vacaciones: 20, estudios: 'universitario' }]]) {
          const delServidor = camposDelSaldoInicial({ modalidad, arranque, anios: inicial }).map((campo) => ({ ...campo, valor: null }));
          for (const dias of DIAS_VACACIONES) {
            for (const estudios of ['universitario', 'secundario', null]) {
              const esperados = camposDelSaldoInicial({ modalidad, arranque, anios: [{ anio: 2026, dias_vacaciones: dias, estudios }] });
              const caso = `${modalidad} ${arranque} ${dias} ${estudios} ${inicial.length}`;
              assert.deepEqual(sinValor(M.camposConLoElegido(comoLlega(delServidor), { anio: 2026, dias, estudios })), plano(esperados), caso);
            }
          }
        }
      }
    }
    // Sin días elegidos, como llegaron; un saldo de otro año (el arranque fue el año pasado), tampoco cambia
    const campos = comoLlega(camposDelSaldoInicial({ modalidad: 'planta', arranque: '2026-10-26', anios: [] }));
    assert.deepEqual(plano(M.camposConLoElegido(campos, { anio: 2026, dias: null, estudios: null })), campos);
    assert.deepEqual(plano(M.camposConLoElegido(campos, { anio: 2027, dias: 30, estudios: 'universitario' })), campos);
  });

  it('erroresDelSaldo: el primer error es el de validarSaldoInicial, en los casos de borde', () => {
    const campos = comoLlega(camposDelSaldoInicial({ modalidad: 'contrato', arranque: '2026-10-26',
      anios: [{ anio: 2026, dias_vacaciones: 20, estudios: 'secundario' }] }));
    const llenos = Object.fromEntries(campos.map(({ clave }) => [clave, '0']));
    for (const [clave, texto] of [['vacaciones-2024', '31'], ['vacaciones-2024', '-1'], ['vacaciones-2025', '2,5'], ['vacaciones-2026', '11'],
      ['estudios', '10'], ['estudios', '11'], ['medica', ''], ['medica', 'x'], ['familiar', '25'], ['horas_no_utilizadas', '6,5'],
      ['horas_no_utilizadas', '6,25'], ['horas_no_utilizadas', '200.5'], ['vacaciones-2024', ' 8 ']]) {
      const valores = { ...llenos, [clave]: texto };
      const errores = plano(M.erroresDelSaldo(valores, campos));
      const { saldos } = plano(M.cuerpoDelSaldo(valores, campos));
      const delServidor = validarSaldoInicial({ saldos: Object.fromEntries(Object.entries(saldos).filter(([, n]) => n !== null)) }, campos).error;
      const [primero] = Object.entries(errores);
      assert.deepEqual(primero ? { campo: primero[0], mensaje: primero[1] } : null, delServidor, `${clave}: ${texto}`);
    }
    assert.deepEqual(plano(M.erroresDelSaldo(llenos, campos)), {});
    // Lo guardado, con coma; lo que no hay, vacío
    assert.deepEqual(plano(M.valoresDelSaldo([{ clave: 'a', valor: 6.5 }, { clave: 'b', valor: 0 }, { clave: 'c', valor: null }])),
      { a: '6,5', b: '0', c: '' });
  });
});

describe('los formularios: lo puro', () => {
  const tiposDePlanta = resumenDel(PLANTA).tipos;

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
      en(`efectoEnNotas(${JSON.stringify({ desde: VACACIONES.desde, vispera: paso.firmante.vispera })}, 'Martín Ríos', '${HOY}')`),
      'Martín Ríos va a estar de licencia el 18/11/2026: ese día no se generan notas. Desde el 19/11/2026 las presenta en tu nombre.'
    ]);
    // Sin nadie elegido, el efecto sin persona autorizada; una médica, solo los avisos del servidor (con el de sin persona a cargo)
    assert.ok(textoDe(M.htmlDelPaso(paso, { ...opciones, autorizado: null })).includes('Sin persona autorizada'));
    // Sin saber quién queda a cargo (conEfecto: false), el efecto no va: ni con nadie ni con una persona
    for (const autorizado of [null, 'Martín Ríos']) {
      assert.deepEqual([...M.htmlDelPaso(paso, { ...opciones, autorizado, conEfecto: false }).matchAll(/<p>([\s\S]*?)<\/p>/g)]
        .map(([, texto]) => texto), [AVISO_DEL_PASO], String(autorizado));
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
    // Contrato: las horas a favor del mes siguiente
    const contrato = horasDe(CONTRATO);
    assert.equal(M.textoDeLaSuma({ id: null, fecha: '2026-10-28', desde: '19:00', hasta: '22:30' }, contrato, 'contrato'),
      '3,5 horas. En octubre llevás 7,5 horas: en noviembre vas a tener 7,5 horas a favor.');
    // La primera del mes (un mes sin fila en la tabla cuenta 0 horas antes de esta carga): también dice lo que lleva y lo que da
    assert.equal(M.textoDeLaSuma({ id: null, fecha: '2026-05-15', desde: '09:00', hasta: '17:00' }, planta, 'planta'),
      '8 horas. En mayo llevás 8 horas: 1 franco compensatorio para usar en julio.');
    assert.equal(M.textoDeLaSuma({ ...valores, fecha: '2026-11-03' }, planta, 'planta'), '3,5 horas. En noviembre llevás 3,5 horas.');
    assert.equal(M.textoDeLaSuma({ id: null, fecha: '2026-08-15', desde: '09:00', hasta: '17:00' }, contrato, 'contrato'),
      '8 horas. En agosto llevás 8 horas: en septiembre vas a tener 8 horas a favor.');
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

// La página con los formularios (DOM falso)

// Lo que contesta el servidor falso en los formularios, además de lo de entrada: el cálculo (de la persona de planta, con
// `soyTitular`), el firmante y lo que se pase en `extra` (que gana)
const conFormularios = ({ soyTitular = false, comoAutorizada = [], extra = () => undefined } = {}) => (metodo, ruta, cuerpo) => {
  const propia = extra(metodo, ruta, cuerpo);
  if (propia !== undefined) return propia;
  if (metodo === 'POST' && ruta === '/api/mi-espacio/licencias/calculo') {
    const { id, ...entrada } = cuerpo;
    return ok(respuestaDelCalculo(entrada, { soyTitular, editadaId: id ?? null, comoAutorizada }));
  }
  if (ruta === '/api/mi-espacio/firmante') return ok(soyTitular ? FIRMANTE : { soy_titular: false });
  return RESPUESTAS_DE_ENTRADA(metodo, ruta);
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
  const anio = {
    anio: 2026, dias_vacaciones: null, estudios: null, heredado: false, texto_mitades: null,
    textos_mitades: Object.fromEntries(DIAS_VACACIONES.map((dias) => [String(dias), textoDeLasMitades(2026, dias)]))
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

  it('un guardado con un fetch que tarda deja «Guardar» deshabilitado y manda un solo POST; después, el Resumen y el aviso', async () => {
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
    await pagina.tocar(pagina.el('ml-guardar'));
    pagina.el('ml-guardar').disabled = false;
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.equal(pagina.pedidosA('POST', '/api/mi-espacio/licencias').length, 1);
    assert.deepEqual(pagina.pedidosA('POST', '/api/mi-espacio/licencias')[0].cuerpo,
      { tipo: 'vacaciones', desde: '2026-11-16', hasta: '2026-11-20', mostrar: true, nota: '' });
    soltar();
    await pagina.esperar();
    assert.equal(pagina.abierto('modal-licencia'), false);
    assert.equal(pagina.el('me-anuncio').textContent, 'Licencia cargada.');
    // Y se ve: el aviso de la página (el toast), además de la región viva
    assert.deepEqual(pagina.estado.toasts, [['Licencia cargada.', 'success']]);
    assert.equal(pagina.rutas().filter((ruta) => ruta === '/api/mi-espacio/resumen').length, resumenes + 1);
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
    assert.equal(saldos.el('ms-error').textContent, `Los días del año se guardaron, pero el saldo inicial no: ${MENSAJE_SIN_CONEXION}`);
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
    // Una franquicia de 3 horas, que no pasa: sin aviso
    await auditora.elegir('ml-tipo', 'franquicia');
    await auditora.escribir('ml-horas', '3', 'change');
    await auditora.correr();
    assert.equal(auditora.el('ml-sin-auditor').hidden, true);
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
    assert.equal(pagina.el('me-anuncio').textContent, 'Licencia corregida.');
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

  // La recarga de la lista reemplaza el «Editar» que abrió el modal: el foco va a su equivalente, nunca queda en <body>
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
    let saldo = respuesta(400, { success: false, error: 'Escribí un número de 0 a 30.', campo: 'vacaciones-2024' });
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
    assert.equal(pagina.el('ms-dias-mitades').textContent, textoDeLasMitades(2026, 20));
    await pagina.elegir('ms-estudio', 'universitario');
    assert.ok(pagina.el('ms-campo-estudios'), 'el campo de los estudios');
    for (const campo of pagina.el('ms-campos').querySelectorAll('input')) campo.value = '0';
    pagina.el('ms-campo-vacaciones-2024').value = '8';
    await pagina.tocar(pagina.el('ms-guardar'));
    assert.deepEqual(pagina.pedidosA('PUT', '/api/mi-espacio/anio/2026')[0].cuerpo, { dias_vacaciones: 20, estudios: 'universitario' });
    assert.deepEqual(pagina.pedidosA('PUT', '/api/mi-espacio/saldo-inicial')[0].cuerpo.saldos,
      { 'vacaciones-2024': 8, 'vacaciones-2025': 0, 'vacaciones-2026': 0, franquicias: 0, estudios: 0, medica: 0, familiar: 0 });
    assert.equal(pagina.abierto('modal-saldos'), true);
    assert.equal(pagina.el('ms-error').textContent, 'Los días del año se guardaron, pero el saldo inicial no: Escribí un número de 0 a 30.');
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
// los próximos, la leyenda, «Ver la agenda» y lo que se vuelve a pedir después de guardar. El formulario del evento llega con la
// Task 10: un clic en un evento o en «Nuevo evento» todavía no abre nada
// =====================================================================================================================================

const RUTA_DEL_MES = '/api/mi-espacio/eventos?desde=2026-09-28&hasta=2026-11-01';
const RUTA_DE_PROXIMOS = '/api/mi-espacio/eventos?desde=2026-10-26&hasta=2026-11-25';
// El servidor falso con la agenda: el mes de octubre, los próximos y cualquier otro rango (armado igual); `cambios`, las respuestas
// de algunas rutas (una función o una respuesta)
const conEventos = (cambios = {}) => async (metodo, ruta, cuerpo) => {
  if (Object.hasOwn(cambios, ruta)) return typeof cambios[ruta] === 'function' ? cambios[ruta](metodo, ruta, cuerpo) : cambios[ruta];
  if (ruta === RUTA_DEL_MES) return ok(DEL_MES);
  if (ruta === RUTA_DE_PROXIMOS) return ok(PROXIMOS);
  if (ruta.startsWith('/api/mi-espacio/eventos?')) {
    const parametros = new URL(ruta, 'http://rpad.test').searchParams;
    return ok(respuestaDeEventos({ desde: parametros.get('desde'), hasta: parametros.get('hasta') }));
  }
  return RESPUESTAS_DE_ENTRADA(metodo, ruta, cuerpo);
};
const pedidosDeEventos = (pagina) => pagina.rutas().filter((ruta) => ruta.startsWith('/api/mi-espacio/eventos'));

describe('la agenda en la página (DOM falso)', () => {
  it('#agenda: pide el Resumen, la grilla del mes de hoy y los próximos, y los dibuja con el título del mes y la leyenda', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conEventos() });
    await pagina.iniciar();
    assert.deepEqual(pagina.rutas().sort(), ['/api/mi-espacio/eventos?desde=2026-09-28&hasta=2026-11-01',
      '/api/mi-espacio/eventos?desde=2026-10-26&hasta=2026-11-25', '/api/mi-espacio/resumen']);
    assert.deepEqual(pagina.estado.direcciones, ['#agenda']);
    assert.equal(pagina.el('tab-agenda').getAttribute('aria-selected'), 'true');
    assert.equal(pagina.el('tab-agenda').tabIndex, 0);
    for (const otra of ['resumen', 'licencias', 'horas']) assert.equal(pagina.el(`vista-${otra}`).hidden, true, otra);
    assert.equal(pagina.el('vista-agenda').hidden, false);
    assert.equal(pagina.el('ag-mes-titulo').textContent, 'Octubre 2026');
    assert.equal(pagina.el('ag-mes').innerHTML, M.htmlDelMes('2026-10', DEL_MES, HOY));
    assert.equal(pagina.el('ag-proximos').innerHTML, M.htmlDeProximos(M.gruposDeProximos(PROXIMOS, HOY)));
    // Quien ve a sus compañeros tiene su color en la leyenda
    assert.equal(pagina.el('ag-leyenda-ausentes').hidden, false);
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
    assert.equal(pedidosDeEventos(pagina).at(-1), '/api/mi-espacio/eventos?desde=2026-10-26&hasta=2026-12-06');
    const noviembre = respuestaDeEventos({ desde: '2026-10-26', hasta: '2026-12-06' });
    assert.equal(pagina.el('ag-mes').innerHTML, M.htmlDelMes('2026-11', noviembre, HOY));
    assert.equal(pagina.el('me-anuncio').textContent, 'Noviembre 2026');
    // Los próximos no se vuelven a pedir, y el mes no va en la dirección
    assert.equal(pedidosDeEventos(pagina).filter((ruta) => ruta === RUTA_DE_PROXIMOS).length, 1);
    assert.deepEqual(pagina.estado.direcciones, ['#agenda']);
    await pagina.tocar(pagina.el('ag-anterior'));
    await pagina.tocar(pagina.el('ag-anterior'));
    assert.equal(pagina.el('ag-mes-titulo').textContent, 'Septiembre 2026');
    assert.equal(pedidosDeEventos(pagina).at(-1), '/api/mi-espacio/eventos?desde=2026-08-31&hasta=2026-10-04');
    await pagina.tocar(pagina.el('ag-hoy'));
    assert.equal(pagina.el('ag-mes-titulo').textContent, 'Octubre 2026');
    assert.equal(pagina.el('ag-mes').innerHTML, M.htmlDelMes('2026-10', DEL_MES, HOY));
    // «Hoy» en el mes de hoy no pide nada
    const antes = pagina.rutas().length;
    await pagina.tocar(pagina.el('ag-hoy'));
    assert.equal(pagina.rutas().length, antes);
    for (let i = 0; i < 3; i += 1) await pagina.tocar(pagina.el('ag-siguiente'));
    assert.equal(pagina.el('ag-mes-titulo').textContent, 'Enero 2027');
    assert.equal(pedidosDeEventos(pagina).at(-1), '/api/mi-espacio/eventos?desde=2026-12-28&hasta=2027-01-31');
  });

  it('un mes que llega tarde no pisa el que se eligió después', async () => {
    let soltarNoviembre;
    const noviembreTarda = new Promise((resolver) => { soltarNoviembre = resolver; });
    const pagina = montarPagina({
      hash: '#agenda',
      responder: conEventos({
        '/api/mi-espacio/eventos?desde=2026-10-26&hasta=2026-12-06': async () => {
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
    soltarNoviembre();
    await pagina.esperar();
    assert.equal(pagina.el('ag-mes-titulo').textContent, 'Diciembre 2026');
    assert.equal(pagina.el('ag-mes').innerHTML, diciembre);
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
  });

  // Decisión del usuario (27/10/2026): a quien no ve a los compañeros (el lector y el colaborador), la leyenda no le muestra su color
  it('la leyenda: sin puede_compartir, sin «Compañeros que no están»; las otras cuatro quedan', async () => {
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
      ['Solo vos', 'Compartidos', 'Tus licencias y francos', 'Feriados']);
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
    assert.equal(pagina.el('ag-mes').innerHTML, M.htmlDelMes('2026-10', DEL_MES, HOY));
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
    assert.equal(pagina.el('ag-mes').innerHTML, M.htmlDelMes('2026-10', DEL_MES, HOY));
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
      '/api/mi-espacio/eventos?desde=2026-10-26&hasta=2026-12-06']);
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
// El primer error de erroresDelEvento, como el error de validarEvento ({ campo, mensaje } o null)
const primerError = (entrada, hoy) => {
  const [primero] = Object.entries(plano(M.erroresDelEvento(entrada, hoy)));
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
    assert.equal(plano(M.erroresDelEvento({ ...malo, hasta: '09:00' }, HOY)).hasta, undefined);
    const errores = plano(M.erroresDelEvento(malo, HOY));
    assert.deepEqual(Object.keys(errores), ['titulo', 'fecha', 'desde', 'hasta', 'detalle', 'personas', 'recordatorio']);
    assert.equal(errores.fecha, 'La fecha tiene que ser del 01/01/2025 al 26/10/2028.');
    assert.equal(errores.personas, MENSAJES_EVENTO.personas);
    assert.equal(plano(M.erroresDelEvento({ ...malo, compartido: true, personas: ['abc'] }, HOY)).personas, MENSAJES_EVENTO.personasInvalidas);
    assert.deepEqual(plano(M.erroresDelEvento(entradaDe({}), HOY)), {});
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
      id: null, titulo: '', fecha: HOY, desde: '', hasta: '', detalle: '', compartido: false, para_todos: false, personas: [],
      conocidas: [], recordatorio: '2h'
    });
  });

  it('valoresDelEvento: uno propio, con sus personas (los ids y los nombres) y su recordatorio', () => {
    assert.deepEqual(plano(M.valoresDelEvento(itemDe(12), { fecha: HOY })), {
      id: 12, titulo: 'Reunión de equipo', fecha: '2026-10-27', desde: '10:00', hasta: '11:00', detalle: '', compartido: true,
      para_todos: false, personas: [3, 4, 5, 6], recordatorio: '2h',
      conocidas: [{ id: 3, nombre: 'Martín Ríos' }, { id: 4, nombre: 'Diego Fernández' }, { id: 5, nombre: 'Sofía Paz' },
        { id: 6, nombre: 'Carla Benítez' }]
    });
    const turno = plano(M.valoresDelEvento(itemDe(13), { fecha: HOY }));
    assert.equal(turno.recordatorio, 'dia_anterior');
    assert.equal(turno.hasta, '');
    assert.equal(turno.compartido, false);
    const paraTodos = plano(M.valoresDelEvento(itemDe(15), { fecha: HOY }));
    assert.equal(paraTodos.para_todos, true);
    assert.deepEqual(paraTodos.personas, []);
  });

  it('cuerpoDelEvento: sin poder compartir (el lector y el colaborador), sin compartido, para_todos ni personas', () => {
    const valores = { ...plano(M.valoresDelEvento(null, { fecha: HOY })), titulo: '  Turno médico ', desde: '15:30', detalle: ' Llevar estudios. ' };
    assert.deepEqual(plano(M.cuerpoDelEvento(valores, {})), {
      titulo: 'Turno médico', fecha: HOY, desde: '15:30', hasta: null, detalle: 'Llevar estudios.', recordatorio: '2h'
    });
    // Aunque el evento estuviera compartido (lo creó cuando era de administración)
    assert.deepEqual(Object.keys(plano(M.cuerpoDelEvento({ ...valores, compartido: true, personas: [3] }, { puedeCompartir: false }))),
      ['titulo', 'fecha', 'desde', 'hasta', 'detalle', 'recordatorio']);
  });

  it('cuerpoDelEvento: con «Todos», para_todos y ninguna persona; con personas, ellas; «Solo yo», ninguna', () => {
    const base = { ...plano(M.valoresDelEvento(itemDe(12), { fecha: HOY })) };
    assert.deepEqual(plano(M.cuerpoDelEvento({ ...base, para_todos: true }, { puedeCompartir: true })), {
      titulo: 'Reunión de equipo', fecha: '2026-10-27', desde: '10:00', hasta: '11:00', detalle: '', recordatorio: '2h',
      compartido: true, para_todos: true, personas: []
    });
    assert.deepEqual(plano(M.cuerpoDelEvento(base, { puedeCompartir: true })).personas, [3, 4, 5, 6]);
    const soloYo = plano(M.cuerpoDelEvento({ ...base, compartido: false }, { puedeCompartir: true }));
    assert.deepEqual([soloYo.compartido, soloYo.para_todos, soloYo.personas], [false, false, []]);
  });

  it('htmlDePersonasDelEvento: «Todos» primero; cada persona con sus iniciales y aria-pressed; con «Todos», las demás deshabilitadas', () => {
    const valores = { ...plano(M.valoresDelEvento(itemDe(12), { fecha: HOY })) };
    const botones = botonesDe(M.htmlDePersonasDelEvento(PERSONAS_PARA_COMPARTIR, valores));
    assert.deepEqual(botones.map(({ atributos, texto }) => [atributos['data-persona'], atributos['aria-pressed'], texto]), [
      ['todos', 'false', 'Todos'], ['4', 'true', 'DF Diego Fernández'], ['6', 'true', 'CB Carla Benítez'], ['7', 'false', 'JO Julián Ortiz'],
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
    assert.equal(textoDe(partes.quien), 'Compartido Lo creó Martín Ríos. Están: vos.');
    assert.ok(partes.quien.includes('<span class="me-insignia violeta">Compartido</span>'));
    assert.deepEqual([...partes.opciones.matchAll(/<option value="(\w+)"( selected)?>([^<]+)<\/option>/g)].map(([, valor, elegido, texto]) =>
      [valor, Boolean(elegido), texto]), [['evento', true, '2 horas antes (el que eligió Martín Ríos)'], ['ninguno', false, 'Sin aviso']]);
    assert.equal(M.miRecordatorioDe(item), 'evento');
    assert.equal(M.miRecordatorioDe({ ...item, mi_recordatorio: 'ninguno' }), 'ninguno');
    // Con el recordatorio apagado, «Sin aviso» elegido; si quien lo creó eligió «Sin aviso», solo ese texto
    assert.ok(M.htmlDelEventoAjeno({ ...item, mi_recordatorio: 'ninguno' }).opciones.includes('<option value="ninguno" selected>Sin aviso</option>'));
    const sinRecordatorio = { ...item, recordatorio: 'ninguno', recordatorio_texto: 'Sin aviso', mi_recordatorio: 'ninguno' };
    assert.equal(M.htmlDelEventoAjeno(sinRecordatorio).opciones, '<option value="ninguno" selected>Sin aviso</option>');
    assert.equal(M.miRecordatorioDe(sinRecordatorio), 'ninguno');
    // Para todos: «Es para todos»; con la hora de fin, «de … a …»
    const deOtroParaTodos = { ...item, fecha: '2026-11-02', desde: '10:00', hasta: '11:00', quien_largo: 'Lo creó Martín Ríos. Es para todos.' };
    assert.equal(textoDe(M.htmlDelEventoAjeno(deOtroParaTodos).cuando), 'Lunes 02/11/2026 de 10:00 a 11:00');
    assert.equal(textoDe(M.htmlDelEventoAjeno(deOtroParaTodos).quien), 'Compartido Lo creó Martín Ríos. Es para todos.');
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

// El servidor falso con la agenda y el formulario del evento: las personas, el aviso (el de avisoDe, con hoy a las 09:00) y lo que se
// guarda; `extra`, primero (una respuesta, una promesa que la da o undefined), y `eventos`, los cambios de conEventos
const RUTA_DE_PERSONAS = '/api/mi-espacio/personas';
const RUTA_DEL_AVISO = '/api/mi-espacio/eventos/aviso?';
const rutaDelAviso = (fecha, desde, recordatorio = '2h') =>
  `/api/mi-espacio/eventos/aviso?fecha=${fecha}&desde=${encodeURIComponent(desde)}&recordatorio=${recordatorio}`;
const textoDelAvisoDe = (fecha, desde, recordatorio = '2h') =>
  avisoDe({ fecha, desde, recordatorio }, { ahora: AHORA, feriados: SIN_FERIADOS }).texto;
const conElFormulario = ({ extra = () => undefined, eventos = {} } = {}) => async (metodo, ruta, cuerpo) => {
  const propia = await extra(metodo, ruta, cuerpo);
  if (propia !== undefined) return propia;
  if (ruta === RUTA_DE_PERSONAS) return ok(PERSONAS_PARA_COMPARTIR);
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

  // Decisión del usuario (27/10/2026): el lector y el colaborador tienen solo eventos personales
  it('el lector no ve «¿Quién lo ve?» ni pide las personas, y lo que guarda no trae compartido', async () => {
    const pagina = montarPagina({ responder: conElFormulario() });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    assert.equal(pagina.el('ev-grupo-quien').hidden, true);
    assert.equal(pagina.el('ev-grupo-personas').hidden, true);
    await pagina.escribir('ev-titulo', 'Turno médico');
    await pagina.escribir('ev-desde', '15:30');
    await pagina.tocar(pagina.el('ev-guardar'));
    assert.deepEqual(pagina.pedidosA('POST', '/api/mi-espacio/eventos').map((p) => p.cuerpo), [
      { titulo: 'Turno médico', fecha: HOY, desde: '15:30', hasta: null, detalle: '', recordatorio: '2h' }
    ]);
    assert.equal(pagina.rutas().filter((ruta) => ruta === RUTA_DE_PERSONAS).length, 0);
  });

  it('administración: «Solo yo» de entrada; «Compartido» muestra las personas, pedidas una sola vez', async () => {
    const pagina = montarPagina({ admin: true, responder: conElFormulario() });
    await pagina.iniciar();
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    assert.equal(pagina.el('ev-grupo-quien').hidden, false);
    assert.equal(pagina.el('ev-solo').getAttribute('aria-pressed'), 'true');
    assert.equal(pagina.el('ev-compartido').getAttribute('aria-pressed'), 'false');
    assert.equal(pagina.el('ev-grupo-personas').hidden, true);
    assert.equal(pagina.el('ev-recordatorio-ayuda').hidden, true);
    pagina.el('ev-compartido').focus();
    await pagina.tocar(pagina.el('ev-compartido'));
    assert.equal(pagina.el('ev-compartido').getAttribute('aria-pressed'), 'true');
    assert.equal(pagina.el('ev-solo').getAttribute('aria-pressed'), 'false');
    assert.equal(pagina.el('ev-grupo-personas').hidden, false);
    assert.equal(pagina.el('ev-recordatorio-ayuda').hidden, false);
    assert.equal(pagina.documento.activeElement, pagina.el('ev-compartido'));
    assert.equal(pagina.el('ev-personas').innerHTML, M.htmlDePersonasDelEvento(PERSONAS_PARA_COMPARTIR, { personas: [] }));
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
    // «Solo yo» vuelve a ocultarlas
    await pagina.tocar(pagina.el('ev-solo'));
    assert.equal(pagina.el('ev-grupo-personas').hidden, true);
    // Cerrar y volver a abrir no vuelve a pedir las personas, y un formulario nuevo vuelve a «Solo yo»
    await pagina.tecla('Escape');
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    assert.equal(pagina.rutas().filter((ruta) => ruta === RUTA_DE_PERSONAS).length, 1);
    assert.equal(pagina.el('ev-solo').getAttribute('aria-pressed'), 'true');
    assert.equal(pagina.el('ev-grupo-personas').hidden, true);
  });

  // El select la tiene en aria-describedby, y un texto oculto con hidden igual entra en la descripción (accname 1.2, paso 2A): en un
  // evento personal tiene que estar vacía, no solo oculta
  const AYUDA_COMPARTIDO = 'Les llega a todas las personas del evento.';
  it('en un evento personal, la ayuda del recordatorio compartido queda vacía (el lector, «Solo yo» y uno propio sin compartir)',
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
      await admin.tocar(admin.el('ev-compartido'));
      await admin.tocar(admin.el('ev-solo'));
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
    await nuevo.tocar(nuevo.el('ev-compartido'));
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
    await pagina.tocar(pagina.el('ev-compartido'));
    assert.ok(textoDe(pagina.el('ev-personas').innerHTML).endsWith('No se pudo cargar la lista de personas. Probá de nuevo en unos minutos.'));
    assert.ok(personaDel(pagina, 'todos'), '«Todos» se puede elegir igual');
    await pagina.tecla('Escape');
    falla = false;
    await pagina.tocar(pagina.el('btn-nuevo-evento'));
    await pagina.tocar(pagina.el('ev-compartido'));
    assert.equal(pagina.rutas().filter((ruta) => ruta === RUTA_DE_PERSONAS).length, 2);
    assert.equal(pagina.el('ev-personas').innerHTML, M.htmlDePersonasDelEvento(PERSONAS_PARA_COMPARTIR, { personas: [] }));
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
    await pagina.tocar(pagina.el('ev-compartido'));
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
      await pagina.tocar(pagina.el('ev-compartido'));
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
        compartido: true, para_todos: true, personas: []
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
    await pagina.tocar(pagina.el('ev-compartido'));
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
    assert.equal(pagina.el('ev-compartido').getAttribute('aria-pressed'), 'true');
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
      compartido: true, para_todos: false, personas: [4, 5, 6, 7]
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
  it('guardado desde los próximos, el foco vuelve al de los próximos, no al de la grilla; desde la grilla, al de la grilla', async () => {
    const pagina = montarPagina({ hash: '#agenda', responder: conElFormulario() });
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
