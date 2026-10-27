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
import { filasDeLicencias, tablaDeHorasExtras, resumenDe, proximoFeriadoDe } from '../services/miEspacioResumen.js';
import {
  calcular, vinculosDeLaLista, MENSAJES_MI_ESPACIO, ausenciasUnidas, ausentesDelRango, ausentesDeHoyYManana, DIAS_VACACIONES,
  DIAS_ESTUDIOS,
  DIAS_POR_EXAMEN, JORNADA, LARGO_NOTA, horasDe as horasDelServidor, camposDelSaldoInicial, validarSaldoInicial, textoSaldo,
  textoDeLasMitades, evaluarLicencia, pasoPrevistoDe, AVISO_DEL_PASO, AVISO_SIN_PERSONA_A_CARGO, textoAutorizadaSinDias
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
// espera del cálculo). `auditor`: lo que contesta Auth.isAuditor(). Hoy es HOY
const montarPagina = ({ hash = '', responder = RESPUESTAS_DE_ENTRADA, cuadros = false, auditor = false } = {}) => {
  const { dom, documento } = crearDom();
  const estado = { pedidos: [], direcciones: [], sesionCerrada: false, responder, cuadros: [] };
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
      getUser: () => ({ id: 1 }),
      getAuthHeaders: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer token-de-prueba' }),
      clearSession: () => { estado.sesionCerrada = true; }
    },
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
// una carga nueva de la persona de planta (admin) que pasa a Configuración. `soyTitular`: es el firmante titular
const respuestaDelCalculo = (entrada, { soyTitular = false, estado = PLANTA.estado, rol = 'admin', editadaId = null } = {}) => {
  const { datos, error, vista } = evaluarLicencia(estado, entrada, { hoy: HOY, feriados: SIN_FERIADOS, editadaId });
  if (datos === null) return comoLlega({ error, vista, paso: null });
  const paso = pasoPrevistoDe({ paso: { accion: 'crear' }, vinculo: null, fila: datos, rol, hoy: HOY, soyTitular });
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
    // Un mes que no está en la tabla cargada, o sin tabla: solo las horas; un horario que no sirve, nada
    assert.equal(M.textoDeLaSuma({ ...valores, fecha: '2026-11-03' }, planta, 'planta'), '3,5 horas.');
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
const conFormularios = ({ soyTitular = false, extra = () => undefined } = {}) => (metodo, ruta, cuerpo) => {
  const propia = extra(metodo, ruta, cuerpo);
  if (propia !== undefined) return propia;
  if (metodo === 'POST' && ruta === '/api/mi-espacio/licencias/calculo') {
    const { id, ...entrada } = cuerpo;
    return ok(respuestaDelCalculo(entrada, { soyTitular, editadaId: id ?? null }));
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

  it('el 409 de la persona autorizada (en fechas) se ve debajo de ml-desde', async () => {
    const mensaje = textoAutorizadaSinDias('2026-10-26', '2026-11-10');
    const pagina = montarPagina({
      responder: conFormularios({
        extra: (metodo, ruta) => (metodo === 'POST' && ruta === '/api/mi-espacio/licencias'
          ? respuesta(409, { success: false, error: mensaje, campo: 'fechas' }) : undefined)
      })
    });
    await pagina.iniciar();
    await cargarLicencia(pagina, { tipo: 'medica', desde: MEDICA.desde, hasta: MEDICA.hasta });
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.equal(pagina.el('ml-desde-error').textContent, mensaje);
    assert.equal(pagina.el('ml-desde').getAttribute('aria-invalid'), 'true');
    assert.equal(pagina.documento.activeElement, pagina.el('ml-desde'));
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

  it('si GET /mi-espacio/firmante falla, el campo queda oculto y el paso no dice «Sin persona autorizada»', async () => {
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
    assert.ok(!pagina.el('ml-paso').textContent.includes('Sin persona autorizada'));
    // Y al guardar, autorizado_id no viaja
    await pagina.tocar(pagina.el('ml-guardar'));
    assert.ok(!Object.hasOwn(pagina.pedidosA('POST', '/api/mi-espacio/licencias')[0].cuerpo, 'autorizado_id'));
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
});
