/**
 * Mi espacio - RPAD (spec 2026-10-26-mi-espacio-licencias-y-horas, secciones 8 y 11)
 * El panel personal de cada usuario: sus licencias, sus horas extras y lo que le queda, en tres pestañas que viajan en la dirección
 * (#resumen, #licencias y #horas). Lo que se carga acá lo ve solo su dueño. Los números y los textos los arma el servidor
 * (GET /api/mi-espacio/resumen, /mi-espacio/licencias?anio= y /mi-espacio/horas-extras?anio=, con services/miEspacioResumen.js) y
 * la página los imprime tal cual: no recalcula nada (Ruling 19). Sin la modalidad cargada, cada pestaña muestra el mensaje del
 * servidor y no deja cargar nada.
 * - Resumen «Niveles»: la modalidad y el año; «Vence pronto» (cada cosa con su fecha en un bloque amarillo y el botón que la
 *   resuelve), los faltantes en un aviso ámbar, «Lo que te queda» (un tanque SVG por saldo, cada uno un link a su pestaña, y debajo
 *   las pastillas de los francos o de las horas a favor) y, al costado, «Hoy y mañana» (quién no está, solo para administración, y
 *   el próximo feriado). La pestaña lleva una marca ámbar si algo vence pronto. Los tanques se llenan una sola vez, la primera vez
 *   que se ve el Resumen: el único movimiento de la página (quieto con prefers-reduced-motion).
 * - Licencias: la lista del año, con el selector del año y los filtros por tipo (con su cantidad); al final, el saldo inicial con
 *   «Cambiar». Lo anterior al saldo inicial y lo que no corresponde a la modalidad actual se ven en gris, con su motivo.
 * - Horas extras: la tabla por mes (en planta, los francos; en contrato, las horas a favor) y el día por día de un mes (cada mes de
 *   la tabla es un botón; de entrada, el en curso) y, en contrato, las horas no utilizadas previamente.
 * Los botones de carga y de edición solo llevan data-* (data-cargar, data-abrir, data-editar-licencia, data-editar-horas, y en
 * «Vence pronto» data-accion="cargar-licencia" con su data-tipo): los conectan los formularios.
 * Al cargarse el archivo solo declara (tests/mi-espacio-frontend.test.js lo carga en un vm después del api.js de verdad): lo que
 * arma HTML es puro y va primero; lo que toca el DOM o la API va aparte, al final (iniciarMiEspacio, enganchado a
 * DOMContentLoaded), con los eventos delegados en contenedores fijos: volver a dibujar no engancha nada, y el foco vuelve al control
 * que se usó. Pide los datos con API.pedirJson. Todo texto del servidor pasa por Utils.escapeHtml (también en los aria-label) y un
 * número se escribe con String (Utils.escapeHtml(0) da ''). Lo que cambia se anuncia en #me-anuncio, la única región viva.
 */

// =====================================================
// Constantes
// =====================================================

// Las pestañas, en su orden: el fragmento de la dirección. Uno desconocido, o ninguno, abre el Resumen
const PESTANAS = Object.freeze(['resumen', 'licencias', 'horas']);

// Copia de MENSAJES_MI_ESPACIO.sinArranque (services/miEspacioReglas.js), atada por un test de paridad
const TEXTO_SIN_ARRANQUE = 'Para empezar, completá «Mis vacaciones y saldos».';

// El color de la insignia de cada tipo de licencia
const CLASE_DEL_TIPO = Object.freeze({
  vacaciones: 'azul', franquicia: 'violeta', estudios: 'ambar', medica: 'rojo', medica_extraordinaria: 'rojo', familiar: 'azul',
  franco: 'verde', horas_a_favor: 'verde', uso_autorizado: 'gris'
});
// El color de la situación de un mes de horas extras (el `estado` que manda el servidor): todavía suma, se habilita, para usar o
// usado. Lo que ya no se usa (no genera franco, no utilizado previamente, ya está en el saldo inicial) va en gris, sin insignia
const CLASE_DE_LA_SITUACION = Object.freeze({ sumando: 'gris', proximo: 'azul', en_uso: 'ambar', usados: 'verde', usadas: 'verde' });
const SITUACIONES_EN_GRIS = Object.freeze(['sin_franco', 'no_utilizado', 'no_utilizadas', 'antes_del_arranque']);

const NOTA_DE_LAS_LICENCIAS = 'Los días se cuentan hábiles: sin sábados, domingos ni feriados.';
const NOTA_DE_LOS_FRANCOS = 'Solo las horas extras al 100%. Cada 7 horas de un mes dan un franco compensatorio, que se usa dos meses '
  + 'después, en ese mes.';
const NOTA_DE_LAS_HORAS_A_FAVOR = 'Cada hora extra de un mes es una hora menos de trabajo el mes siguiente, de a media hora. 7 horas '
  + 'son el día entero.';
const NOTA_DE_LAS_NO_UTILIZADAS = 'Quedan a la vista aunque su mes ya pasó. Vuelven a cero el 1/1.';

// El Resumen: la clase de cada capa de un tanque (la `clase` del servidor; una desconocida, en tinta), las que van en gris en la
// lista del tanque de vacaciones (lo cargado a futuro y lo que todavía no se habilita) y la de cada pastilla (el `estado`; la
// disponible, sin clase)
const CLASE_DE_LA_CAPA = Object.freeze({
  vence: 'c-vence', tinta: 'c-tinta', medio: 'c-medio', cargadas: 'c-cargadas', por_habilitar: 'c-por-habilitar'
});
const CAPAS_EN_GRIS = Object.freeze(['cargadas', 'por_habilitar']);
const CLASE_DE_LA_PASTILLA = Object.freeze({ vence: 'vence', pendiente: 'pendiente' });
// Las medidas de los tanques (las de la maqueta): el de vacaciones y los demás
const TANQUE_GRANDE = Object.freeze({ ancho: 88, alto: 176 });
const TANQUE_CHICO = Object.freeze({ ancho: 52, alto: 112 });
const TEXTO_DE_LA_MARCA = 'Hay algo que vence pronto';
const TEXTO_SIN_AUSENTES = 'Hoy y mañana están todos.';

// =====================================================
// Lo puro: lo que arma el HTML
// =====================================================

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const listaDe = (valor) => (Array.isArray(valor) ? valor.filter(esObjeto) : []);
// Un texto o un número del servidor, escapado (un número también: Utils.escapeHtml(0) da '')
const esc = (valor) => Utils.escapeHtml(String(valor ?? ''));
// El valor de un mapa del servidor, o el de reserva (sin heredar nada de Object.prototype)
const deMapa = (mapa, clave, reserva) => (esObjeto(mapa) && Object.hasOwn(mapa, clave) ? mapa[clave] : reserva);
const conTexto = (valor) => typeof valor === 'string' && valor.trim() !== '';
// Un año del servidor en un título o en un vacío («de 2026», «en 2026»); uno que no es un año, nada
const delAnio = (anio) => (Number.isInteger(anio) ? ` de ${String(anio)}` : '');
const enElAnio = (anio) => (Number.isInteger(anio) ? ` en ${String(anio)}` : '');

function pestanaDeHash(hash) {
  const nombre = String(hash ?? '').replace(/^#/, '');
  return PESTANAS.includes(nombre) ? nombre : PESTANAS[0];
}

// El mensaje del servidor en lugar de una pestaña (sin modalidad cargada)
function htmlDeMensaje(texto) {
  return `<p class="me-aviso me-aviso-gris">${esc(texto)}</p>`;
}

// Con la modalidad y sin el saldo inicial: el botón abre «Mis vacaciones y saldos»
function htmlSinArranque() {
  return `<div class="me-aviso me-aviso-azul"><p>${esc(TEXTO_SIN_ARRANQUE)}</p>`
    + '<button type="button" class="sg-btn sg-btn-tinta sg-btn-chico" data-abrir="saldos">Mis vacaciones y saldos</button></div>';
}

// Un error de una carga, en la pestaña
function htmlDeError(texto) {
  return `<p class="me-aviso me-aviso-error">${esc(texto)}</p>`;
}

// ---- El Resumen «Niveles» ----

// La marca ámbar de la pestaña Resumen cuando algo vence pronto (como la del Estado en Correos: una imagen con su nombre, no un
// title). Solo con el true literal
function htmlDeMarca(marca) {
  return marca === true ? `<span class="me-marca" role="img" aria-label="${TEXTO_DE_LA_MARCA}"></span>` : '';
}

// «Vence pronto»: cada cosa con su fecha en un bloque amarillo (decorativo: «Viernes 30/10» ya la dice), qué vence y el botón que
// la resuelve, que abre «Cargar licencia» con su tipo (data-accion y data-tipo) y se describe con lo que vence. Sin nada, ''
function htmlDeVencePronto(lista) {
  const cosas = listaDe(lista);
  if (cosas.length === 0) return '';
  const filas = cosas.map((cosa, i) => {
    const accion = esObjeto(cosa.accion) ? cosa.accion : {};
    return `<li class="me-vence-item"><span class="me-fecha" aria-hidden="true"><b>${esc(cosa.dia)}</b>${esc(cosa.mes)}</span>`
      + `<span class="me-vence-texto"><span class="me-vence-cuando">${esc(cosa.cuando)}</span><b id="me-vence-${i}">${esc(cosa.titulo)}</b>`
      + `<span>${esc(cosa.detalle)}</span></span>`
      + `<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-accion="cargar-licencia" data-tipo="${esc(accion.tipo)}" `
      + `aria-describedby="me-vence-${i}">${esc(accion.texto)}</button></li>`;
  });
  return '<section class="me-vence" aria-labelledby="me-vence-titulo"><h2 class="me-titulo" id="me-vence-titulo">Vence pronto</h2>'
    + `<ol class="me-vence-lista">${filas.join('')}</ol></section>`;
}

// Los faltantes (lo guardado que dejó de cerrar), con su texto neutro, en un aviso ámbar arriba de «Lo que te queda». Sin
// ninguno, ''
function htmlDeFaltantes(faltantes) {
  const textos = (Array.isArray(faltantes) ? faltantes : []).filter(conTexto);
  if (textos.length === 0) return '';
  if (textos.length === 1) return `<p class="me-aviso me-aviso-ambar">${esc(textos[0])}</p>`;
  return `<div class="me-aviso me-aviso-ambar"><ul class="me-faltantes">${textos.map((texto) => `<li>${esc(texto)}</li>`).join('')}</ul></div>`;
}

// Una cantidad de una capa: un número positivo; lo demás, 0
const cantidadDeLaCapa = (capa) => (typeof capa.n === 'number' && Number.isFinite(capa.n) && capa.n > 0 ? capa.n : 0);

/**
 * El SVG de un tanque (decorativo: el link que lo envuelve dice lo que muestra). Las capas van de abajo hacia arriba, cada una de
 * n / capacidad × alto, en el color de su clase; las cargadas, rayadas (el patrón del tanque), y las por habilitar, punteadas (el
 * <style>). Lo que pasa la capacidad se corta en el borde de arriba, y una capacidad que no es un número positivo deja el tanque
 * vacío: nunca un NaN. `id` nombra el recorte y el patrón (uno por tanque; solo letras, números y guiones). El nivel
 * (.me-tanque-nivel, con su alto en --alto) es lo que se llena al abrir.
 */
function svgDeTanque({ capas, capacidad, ancho = TANQUE_CHICO.ancho, alto = TANQUE_CHICO.alto, id } = {}) {
  const tope = typeof capacidad === 'number' && Number.isFinite(capacidad) && capacidad > 0 ? capacidad : 0;
  const nombre = String(id ?? '').replace(/[^\w-]/g, '') || 'me-tanque';
  // La altura (y) a la que llega lo acumulado, redondeada a un decimal: cada capa va de la de la anterior a la suya, así que
  // ninguna se pisa ni deja un hueco
  const nivel = (acumulado) => (tope === 0 ? alto : Math.round((alto - (Math.min(acumulado, tope) / tope) * alto) * 10) / 10);
  let acumulado = 0;
  const rects = listaDe(capas).map((capa) => {
    const abajo = nivel(acumulado);
    acumulado += cantidadDeLaCapa(capa);
    const arriba = nivel(acumulado);
    const clase = deMapa(CLASE_DE_LA_CAPA, capa.clase, 'c-tinta');
    const relleno = clase === 'c-cargadas' ? ` fill="url(#${nombre}-rayas)"` : '';
    return `<rect class="${clase}"${relleno} x="0" y="${arriba.toFixed(1)}" width="${ancho}" height="${(abajo - arriba).toFixed(1)}"/>`;
  });
  return `<svg class="me-tanque" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" aria-hidden="true" focusable="false">`
    + `<defs><clipPath id="${nombre}"><rect width="${ancho}" height="${alto}" rx="16"/></clipPath>`
    + `<pattern id="${nombre}-rayas" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    + '<rect width="6" height="6" fill="#fff"/><rect width="3" height="6" fill="#1A365D"/></pattern></defs>'
    + `<rect class="t-fondo" width="${ancho}" height="${alto}" rx="16"/>`
    + `<g clip-path="url(#${nombre})"><g class="me-tanque-nivel" style="--alto:${alto}px">${rects.join('')}</g></g>`
    + `<rect class="t-borde" x="1" y="1" width="${ancho - 2}" height="${alto - 2}" rx="15"/></svg>`;
}

// Un tanque: un link a su pestaña (Horas extras o, si no, Licencias) con el aria-label del servidor; el número arriba, el tanque
// y, debajo, el nombre con su total
const htmlDeNivel = (tanque, { nombre, pie, svg, vence = false, chico = false }) => {
  const pestana = tanque.pestana === 'horas' ? 'horas' : 'licencias';
  return `<a class="me-nivel${vence ? ' vence' : ''}" href="#${pestana}" data-pestana="${pestana}" aria-label="${esc(tanque.aria)}">`
    + `<span class="me-nivel-num${chico ? ' chico' : ''}"><b>${esc(tanque.numero)}</b><span>${esc(tanque.unidad)}</span></span>${svg}`
    + `<span class="me-nivel-pie"><b>${esc(nombre)}</b><span>${esc(pie)}</span></span></a>`;
};

// Al lado del tanque de vacaciones, cada capa con su número: la licencia que vence en el año, en ámbar; lo cargado a futuro y lo
// que todavía no se habilita, en gris
function htmlDeLeyendaDeVacaciones(capas) {
  if (capas.length === 0) return '';
  const filas = capas.map((capa) => {
    let extra = '';
    if (capa.clase === 'vence') extra = ' vence';
    else if (CAPAS_EN_GRIS.includes(capa.clase)) extra = ' tenue';
    return `<li class="me-capa${extra}"><i class="me-muestra ${deMapa(CLASE_DE_LA_CAPA, capa.clase, 'c-tinta')}" aria-hidden="true"></i>`
      + `<span><b>${esc(capa.nombre)}</b>${esc(capa.nota)}</span><b class="me-n">${esc(capa.n)}</b></li>`;
  });
  return `<ul class="me-leyenda-vac">${filas.join('')}</ul>`;
}

/**
 * «Lo que te queda» (los `tanques` del Resumen): el de vacaciones, por capas y con su lista al lado, y los demás (franquicias u
 * horas a favor, estudios, atención médica y grupo familiar), uno que vence este mes en ámbar. Todos apoyan sobre la misma línea.
 */
function htmlDeTanques(tanques) {
  if (!esObjeto(tanques)) return '';
  const partes = [];
  if (esObjeto(tanques.vacaciones)) {
    const { vacaciones } = tanques;
    const capas = listaDe(vacaciones.capas);
    const svg = svgDeTanque({ capas, capacidad: vacaciones.capacidad, ...TANQUE_GRANDE, id: 'me-tanque-0' });
    partes.push(`<div class="me-nivel-vac">${htmlDeNivel(vacaciones, { nombre: 'Vacaciones', pie: vacaciones.pie, svg })}`
      + `${htmlDeLeyendaDeVacaciones(capas)}</div>`);
  }
  const otros = listaDe(tanques.otros).map((tanque, i) => {
    const vence = tanque.vence === true;
    const svg = svgDeTanque({
      capas: [{ clase: vence ? 'vence' : 'tinta', n: tanque.valor }], capacidad: tanque.total, ...TANQUE_CHICO, id: `me-tanque-${i + 1}`
    });
    return htmlDeNivel(tanque, { nombre: tanque.nombre, pie: tanque.de, svg, vence, chico: true });
  });
  if (otros.length > 0) partes.push(`<div class="me-niveles-resto">${otros.join('')}</div>`);
  return `<div class="me-niveles-fila">${partes.join('')}</div>`;
}

// Debajo de los tanques, los francos (o las horas a favor) mes por mes: el del mes que vence en amarillo, el que todavía suma
// punteado y lo no utilizado previamente en gris. Sin ningún mes ni nada no utilizado, ''
function htmlDePastillas(pastillas) {
  if (!esObjeto(pastillas)) return '';
  const pastilla = (clase, numero, titulo, nota) => `<li class="me-pastilla${clase ? ` ${clase}` : ''}"><b>${esc(numero)}</b>`
    + `<span><b>${esc(titulo)}</b>${esc(nota)}</span></li>`;
  const filas = listaDe(pastillas.meses).map((mes) => pastilla(deMapa(CLASE_DE_LA_PASTILLA, mes.estado, ''), mes.numero, mes.mes, mes.nota));
  const { previo } = pastillas;
  if (esObjeto(previo)) filas.push(pastilla('previo', previo.numero, previo.titulo, previo.nota));
  if (filas.length === 0) return '';
  return `<h3 class="me-subtitulo">${esc(pastillas.titulo)}</h3><ol class="me-pastillas">${filas.join('')}</ol>`;
}

// «Lo que te queda»: el día, «Mis vacaciones y saldos», los tanques, las pastillas y la médica extraordinaria. Sin tanques (sin un
// hoy válido), nada
function htmlDeLoQueTeQueda(resumen) {
  if (!esObjeto(resumen.tanques)) return '';
  return '<section class="me-panel me-niveles" aria-labelledby="me-niveles-titulo"><div class="me-panel-cabeza">'
    + '<h2 class="me-titulo" id="me-niveles-titulo">Lo que te queda</h2>'
    + `<span class="me-panel-al">${esc(resumen.al_texto)}</span>`
    + '<button type="button" class="sg-link" data-abrir="saldos">Mis vacaciones y saldos</button></div>'
    + htmlDeTanques(resumen.tanques)
    + `<div class="me-niveles-pie">${htmlDePastillas(resumen.pastillas)}`
    + `${conTexto(resumen.extraordinaria) ? `<p class="me-previos">${esc(resumen.extraordinaria)}</p>` : ''}</div></section>`;
}

// Las iniciales de un nombre, decorativas: la primera letra del primero y del último
const iniciales = (nombre) => {
  const palabras = String(nombre ?? '').trim().split(/\s+/).filter(Boolean);
  const inicial = (palabra) => Array.from(palabra)[0].toUpperCase();
  if (palabras.length === 0) return '';
  return palabras.length === 1 ? inicial(palabras[0]) : inicial(palabras[0]) + inicial(palabras.at(-1));
};

/**
 * «Hoy y mañana» (el `hoy_y_manana` del Resumen): «No están», solo para quien ve a sus compañeros (`veCompaneros`, el true
 * literal: administración), con el texto y la vuelta que manda el servidor, y el próximo feriado.
 */
function htmlDeHoyYManana(datos, veCompaneros) {
  const hoy = esObjeto(datos) ? datos : {};
  let html = '<section class="me-hoy" aria-labelledby="me-hoy-titulo"><h2 class="me-titulo" id="me-hoy-titulo">Hoy y mañana</h2>';
  if (veCompaneros === true) {
    const ausentes = listaDe(hoy.ausentes).map((ausente) => '<li class="me-ausente">'
      + `<span class="me-inicial" aria-hidden="true">${esc(iniciales(ausente.nombre))}</span><span><b>${esc(ausente.texto)}</b>`
      + `${conTexto(ausente.vuelve_texto) ? `<small>${esc(ausente.vuelve_texto)}</small>` : ''}</span></li>`);
    html += '<h3 class="me-subtitulo">No están</h3>'
      + (ausentes.length > 0 ? `<ul class="me-ausentes">${ausentes.join('')}</ul>` : `<p class="me-vacio">${TEXTO_SIN_AUSENTES}</p>`);
  }
  const feriado = hoy.proximo_feriado;
  if (esObjeto(feriado)) {
    html += `<h3 class="me-subtitulo">Próximo feriado</h3><p class="me-feriado"><b>${esc(feriado.cuando)}</b>${esc(feriado.nombre)}</p>`;
  }
  return `${html}</section>`;
}

/**
 * La pestaña Resumen (lo que manda GET /api/mi-espacio/resumen). Sin modalidad, el mensaje del servidor; sin el saldo inicial,
 * la invitación a «Mis vacaciones y saldos»; si no, la modalidad y el año, «Vence pronto» (si hay algo), los faltantes y, en la
 * grilla, «Lo que te queda» y «Hoy y mañana».
 */
function htmlDelResumen(resumen) {
  if (!esObjeto(resumen)) return '';
  if (!esObjeto(resumen.modalidad)) return htmlDeMensaje(resumen.mensaje);
  if (resumen.abrir_saldos === true) return htmlSinArranque();
  const contexto = `<p class="me-contexto"><span><b>${esc(resumen.modalidad.texto)}</b></span>`
    + `${Number.isInteger(resumen.anio) ? `<span>Año ${String(resumen.anio)}</span>` : ''}</p>`;
  return contexto + htmlDeVencePronto(resumen.vence_pronto) + htmlDeFaltantes(resumen.faltantes)
    + `<div class="me-resumen-grilla">${htmlDeLoQueTeQueda(resumen)}`
    + `${htmlDeHoyYManana(resumen.hoy_y_manana, esObjeto(resumen.persona) ? resumen.persona.ve_companeros : false)}</div>`;
}

// Los años del selector (los que manda el servidor), con aria-pressed en el elegido
function htmlDelSelectorDeAnio(anios, anio) {
  const botones = (Array.isArray(anios) ? anios : []).filter(Number.isInteger)
    .map((uno) => `<button type="button" data-anio="${String(uno)}" aria-pressed="${String(uno === anio)}">${String(uno)}</button>`)
    .join('');
  return botones ? `<span class="me-segmento" role="group" aria-label="Año">${botones}</span>` : '';
}

// El filtro elegido, si está entre los del año; si no (el elegido en otro año), Todas
const filtroElegido = (filtros, elegido) => (listaDe(filtros).some((filtro) => filtro.tipo === elegido) ? elegido : 'todas');

// «Todas» y cada tipo con filas en el año, con su cantidad
function htmlDeFiltrosDeLicencias(filtros, elegido) {
  const actual = filtroElegido(filtros, elegido);
  const botones = listaDe(filtros).map((filtro) => `<button type="button" class="sg-chip" data-filtro-licencia="${esc(filtro.tipo)}" `
    + `aria-pressed="${String(filtro.tipo === actual)}">${esc(filtro.nombre)} <b>${esc(filtro.cantidad)}</b></button>`).join('');
  return `<div class="sg-chips" role="group" aria-label="Filtrar las licencias por tipo">${botones}</div>`;
}

// Una licencia: las fechas con lo que suman, la insignia del tipo, «Próxima» si no empezó, por qué no cuenta (en gris), de qué
// licencia salen las vacaciones, cómo está en Configuración (en ámbar si hay algo para revisar), si la ven los compañeros, la nota
// y «Editar»
function htmlDeFilaDeLicencia(fila) {
  const gris = conTexto(fila.no_cuenta_texto);
  const cantidad = conTexto(fila.cantidad_texto) ? `<small>${esc(fila.cantidad_texto)}</small>` : '';
  const partes = [`<span class="me-insignia ${deMapa(CLASE_DEL_TIPO, fila.tipo, 'gris')}">${esc(fila.tipo_nombre)}</span>`];
  if (fila.proxima === true) partes.push('<span class="me-insignia borde">Próxima</span>');
  const detalle = (texto, clase = 'me-detalle') => { if (conTexto(texto)) partes.push(`<span class="${clase}">${esc(texto)}</span>`); };
  detalle(fila.no_cuenta_texto);
  detalle(fila.de_licencias_texto);
  if (esObjeto(fila.configuracion)) {
    detalle(fila.configuracion.texto, fila.configuracion.insignia === 'aviso' ? 'me-detalle me-detalle-aviso' : 'me-detalle');
  }
  detalle(fila.mostrar_texto);
  detalle(fila.nota, 'me-detalle me-fila-nota');
  return `<li class="me-fila${gris ? ' tenue' : ''}"><span class="me-fila-fecha">${esc(fila.fechas_texto)}${cantidad}</span>`
    + `<span class="me-fila-cuerpo">${partes.join('')}</span>`
    + `<button type="button" class="sg-link" data-editar-licencia="${esc(fila.id)}" aria-label="Editar la licencia del ${esc(fila.fechas_texto)}">`
    + 'Editar</button></li>';
}

// El saldo inicial, al final de la lista del año del arranque
function htmlDelSaldoInicial(saldo) {
  return `<li class="me-fila tenue"><span class="me-fila-fecha">${esc(saldo.titulo)}<small>${esc(saldo.cargado_texto)}</small></span>`
    + `<span class="me-fila-cuerpo">${esc(saldo.texto)}</span>`
    + '<button type="button" class="sg-link" data-abrir="saldos" aria-label="Cambiar el saldo inicial">Cambiar</button></li>';
}

/**
 * La pestaña Licencias (lo que manda GET /api/mi-espacio/licencias): la tarjeta del año, con el selector del año y «Cargar
 * licencia», los filtros, las filas del tipo elegido (`filtro`: 'todas' o un tipo; uno que no está en el año es Todas), el saldo
 * inicial (con Todas) y la nota de los días hábiles. Sin modalidad, solo el mensaje del servidor.
 */
function htmlDeListaDeLicencias(datos, filtro) {
  if (!esObjeto(datos)) return '';
  if (datos.modalidad === null) return htmlDeMensaje(datos.mensaje);
  const anio = Number.isInteger(datos.anio) ? datos.anio : null;
  const licencias = listaDe(datos.licencias);
  const actual = filtroElegido(datos.filtros, filtro);
  const visibles = actual === 'todas' ? licencias : licencias.filter((fila) => fila.tipo === actual);
  const filas = visibles.map(htmlDeFilaDeLicencia);
  if (actual === 'todas' && esObjeto(datos.saldo_inicial)) filas.push(htmlDelSaldoInicial(datos.saldo_inicial));
  return '<div class="me-tarjeta"><div class="me-cabeza">'
    + `<h2>Mis licencias${delAnio(anio)}</h2><span class="me-acciones">${htmlDelSelectorDeAnio(datos.anios, anio)}`
    + '<button type="button" class="sg-btn sg-btn-tinta sg-btn-chico" data-cargar="licencia">Cargar licencia</button></span></div>'
    + (licencias.length > 0 ? htmlDeFiltrosDeLicencias(datos.filtros, actual) : '')
    + (visibles.length === 0 ? `<p class="me-vacio">No hay licencias cargadas${enElAnio(anio)}.</p>` : '')
    + (filas.length > 0 ? `<ul class="me-lista">${filas.join('')}</ul>` : '')
    + `<p class="me-nota">${NOTA_DE_LAS_LICENCIAS}</p></div>`;
}

// El mes del día por día de entrada: el en curso, si está en la tabla; si no, el más nuevo de la tabla; sin meses, null
function mesInicialDe(tabla) {
  const meses = listaDe(tabla?.meses).map((fila) => fila.mes);
  if (meses.includes(tabla?.mes_en_curso)) return tabla.mes_en_curso;
  return meses[0] ?? null;
}

// El mes pedido, si está en la tabla; si no, el de entrada
const mesDeLaTabla = (tabla, mes) => (listaDe(tabla?.meses).some((fila) => fila.mes === mes) ? mes : mesInicialDe(tabla));

// La cabeza de la tarjeta de las horas extras: el título, el selector del año y «Cargar horas extras»
const cabezaDeHoras = (titulo, tabla) => `<div class="me-cabeza"><h2>${titulo}${delAnio(tabla?.anio)}</h2>`
  + `<span class="me-acciones">${htmlDelSelectorDeAnio(tabla?.anios, tabla?.anio)}`
  + '<button type="button" class="sg-btn sg-btn-tinta sg-btn-chico" data-cargar="horas">Cargar horas extras</button></span></div>';

// El mes trabajado de una fila de la tabla: un botón que elige el día por día de ese mes
const botonDelMes = (fila, elegido) => `<button type="button" class="me-mes-boton" data-mes="${esc(fila.mes)}" `
  + `aria-pressed="${String(fila.mes === elegido)}">${esc(fila.mes_texto)}</button>`;

// La situación de un mes, con el color de su estado; la que ya no se usa, como texto (la fila va en gris)
function htmlDeSituacion(fila) {
  const clase = deMapa(CLASE_DE_LA_SITUACION, fila.estado, null);
  return clase === null ? esc(fila.situacion) : `<span class="me-insignia ${clase}">${esc(fila.situacion)}</span>`;
}
const claseDeLaFila = (fila) => (SITUACIONES_EN_GRIS.includes(fila.estado) ? ' class="tenue"' : '');

// La tabla de una modalidad, o el vacío del año
function htmlDeTabla(tabla, columnas, filas) {
  if (filas.length === 0) return `<p class="me-vacio">No hay horas extras cargadas${enElAnio(tabla?.anio)}.</p>`;
  return `<div class="me-tabla-marco"><table class="me-tabla"><thead><tr>${columnas.map((columna) => `<th>${columna}</th>`).join('')}`
    + `</tr></thead><tbody>${filas.join('')}</tbody></table></div>`;
}

// «Registrar un uso autorizado»: el texto del servidor y, si queda algo no utilizado previamente, el botón
function htmlDelUsoAutorizado(uso) {
  if (!esObjeto(uso)) return '';
  const boton = uso.puede === true
    ? '<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-abrir="uso">Registrar un uso autorizado</button>' : '';
  return `<div class="me-uso"><p class="me-nota">${esc(uso.texto)}</p>${boton}</div>`;
}

/**
 * Planta: las horas extras al 100% de cada mes trabajado, los francos que dan, en qué mes se usan y su situación, con el uso
 * autorizado debajo. `mes` es el mes del día por día (de entrada, el en curso), que se marca en la tabla.
 */
function htmlDeTablaDeFrancos(tabla, mes = mesInicialDe(tabla)) {
  const filas = listaDe(tabla?.meses).map((fila) => `<tr${claseDeLaFila(fila)}><td>${botonDelMes(fila, mes)}</td>`
    + `<td class="num">${esc(fila.horas_texto)}<small>${esc(fila.dias_texto)}</small></td><td class="num">${esc(fila.francos)}</td>`
    + `<td>${esc(fila.uso_texto)}</td><td>${htmlDeSituacion(fila)}</td></tr>`);
  return `<div class="me-tarjeta">${cabezaDeHoras('Horas extras al 100%', tabla)}`
    + htmlDeTabla(tabla, ['Mes trabajado', 'Horas', 'Francos', 'Para usar en', 'Situación'], filas)
    + `<p class="me-nota">${NOTA_DE_LOS_FRANCOS}</p>${htmlDelUsoAutorizado(tabla?.uso_autorizado)}</div>`;
}

/**
 * Contrato: las horas extras de cada mes trabajado, el mes en que quedan a favor, lo que se usó (con cada uso debajo) y su
 * situación. `mes`, como en la de francos.
 */
function htmlDeTablaDeHorasAFavor(tabla, mes = mesInicialDe(tabla)) {
  const filas = listaDe(tabla?.meses).map((fila) => `<tr${claseDeLaFila(fila)}><td>${botonDelMes(fila, mes)}</td>`
    + `<td class="num">${esc(fila.horas_texto)}</td><td>${esc(fila.a_favor_texto)}</td>`
    + `<td class="num">${esc(fila.usadas_texto)}${conTexto(fila.usadas_detalle) ? `<small>${esc(fila.usadas_detalle)}</small>` : ''}</td>`
    + `<td>${htmlDeSituacion(fila)}</td></tr>`);
  return `<div class="me-tarjeta">${cabezaDeHoras('Horas extras y horas a favor', tabla)}`
    + htmlDeTabla(tabla, ['Mes trabajado', 'Horas extras', 'A favor en', 'Usadas', 'Situación'], filas)
    + `<p class="me-nota">${NOTA_DE_LAS_HORAS_A_FAVOR}</p></div>`;
}

// Las horas extras de un mes de la tabla, día por día, cada una con «Editar»; un mes que no está en la tabla, nada
function htmlDeDiaPorDia(tabla, mes) {
  const fila = listaDe(tabla?.meses).find((uno) => uno.mes === mes);
  const dias = listaDe(deMapa(tabla?.dias_por_mes, mes, []));
  if (fila === undefined || dias.length === 0) return '';
  const filas = dias.map((dia) => `<li class="me-fila"><span class="me-fila-fecha">${esc(dia.fecha_texto)}</span>`
    + `<span class="me-fila-cuerpo">${esc(dia.horario)}<span class="me-detalle">${esc(dia.horas_texto)}</span>`
    + `${conTexto(dia.nota) ? `<span class="me-detalle me-fila-nota">${esc(dia.nota)}</span>` : ''}</span>`
    + `<button type="button" class="sg-link" data-editar-horas="${esc(dia.id)}" `
    + `aria-label="Editar las horas extras del ${esc(dia.fecha_texto)} de ${esc(dia.horario)}">Editar</button></li>`);
  return `<div class="me-tarjeta"><div class="me-cabeza"><h3>${esc(fila.mes_texto)}, día por día</h3>`
    + `<span>${esc(deMapa(tabla.totales_por_mes, mes, ''))}</span></div><ul class="me-lista">${filas.join('')}</ul></div>`;
}

// Contrato: «Horas no utilizadas previamente», cada mes con su origen (y lo del saldo inicial), con el uso autorizado debajo
function htmlDeNoUtilizadas(tabla) {
  const noUtilizadas = tabla?.no_utilizadas;
  if (!esObjeto(noUtilizadas)) return '';
  const filas = listaDe(noUtilizadas.filas).map((fila) => `<li class="me-fila me-fila-dos"><span class="me-fila-fecha">${esc(fila.titulo)}</span>`
    + `<span class="me-fila-cuerpo">${esc(fila.texto)}${conTexto(fila.detalle) ? `<span class="me-detalle">${esc(fila.detalle)}</span>` : ''}`
    + '</span></li>');
  return '<div class="me-tarjeta"><div class="me-cabeza"><h3>Horas no utilizadas previamente</h3>'
    + `<span>${esc(noUtilizadas.total_texto)}</span></div>`
    + (filas.length > 0 ? `<ul class="me-lista">${filas.join('')}</ul>` : '')
    + `<p class="me-nota">${NOTA_DE_LAS_NO_UTILIZADAS}</p>${htmlDelUsoAutorizado(noUtilizadas.uso_autorizado)}</div>`;
}

/**
 * La pestaña Horas extras (lo que manda GET /api/mi-espacio/horas-extras): en planta, la tabla de francos y el día por día; en
 * contrato, la de horas a favor, el día por día y las horas no utilizadas previamente. `mes` es el del día por día (uno que no está
 * en la tabla, el de entrada). Sin modalidad, solo el mensaje del servidor.
 */
function htmlDeHorasExtras(tabla, mes) {
  if (!esObjeto(tabla)) return '';
  const elegido = mesDeLaTabla(tabla, mes);
  if (tabla.modalidad === 'planta') return htmlDeTablaDeFrancos(tabla, elegido) + htmlDeDiaPorDia(tabla, elegido);
  if (tabla.modalidad === 'contrato') {
    return htmlDeTablaDeHorasAFavor(tabla, elegido) + htmlDeDiaPorDia(tabla, elegido) + htmlDeNoUtilizadas(tabla);
  }
  return htmlDeMensaje(tabla.mensaje);
}

// =====================================================
// La página (DOM y API)
// =====================================================

// Todos los roles con sesión la ven; sin sesión, al login
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }
  iniciarMiEspacio();
});

// El estado de la página: el Resumen, la lista de licencias con su filtro y la tabla de horas extras con su mes (null hasta que
// llegan, y después de una carga que falló). `pedidos` numera las cargas de cada pestaña: una respuesta que llega después de otra
// más nueva se descarta. `tanquesLlenos`: los tanques del Resumen ya se llenaron (pasa una sola vez)
const pagina = {
  pestana: PESTANAS[0], resumen: null, licencias: null, filtro: 'todas', horas: null, mes: null, tanquesLlenos: false,
  pedidos: { resumen: 0, licencias: 0, horas: 0 }
};

const porId = (id) => document.getElementById(id);

// La región viva de la página (#me-anuncio, fuera de lo que se vuelve a dibujar). Un texto igual al anterior se cambia apenas (un
// espacio duro al final), para que se vuelva a anunciar
function anunciar(texto) {
  const region = porId('me-anuncio');
  if (!region || !texto) return;
  region.textContent = region.textContent === texto ? `${texto} ` : texto;
}

// La sesión venció (401): se cierra y al login
function irAlLogin() {
  if (typeof Auth.clearSession === 'function') Auth.clearSession();
  window.location.href = 'login.html';
}

// Lo que no se pudo cargar, en su pestaña y anunciado
function mostrarFalla(vista, texto) {
  porId(vista).innerHTML = htmlDeError(texto);
  anunciar(texto);
}

// Después de volver a dibujar una pestaña, el foco va al control equivalente al que se usó (el botón viejo ya no está)
function enfocar(vista, atributo, valor) {
  const control = [...porId(vista).querySelectorAll(`[${atributo}]`)].find((uno) => uno.getAttribute(atributo) === valor);
  control?.focus();
}

// Abre la pestaña de la dirección y pide el Resumen. Devuelve las cargas, para quien quiera esperarlas
function iniciarMiEspacio() {
  conectarEventos();
  return Promise.all([mostrarPestana(pestanaDeHash(window.location.hash)), cargarResumen()]);
}

function conectarEventos() {
  for (const nombre of PESTANAS) {
    const pestana = porId(`tab-${nombre}`);
    pestana.addEventListener('click', () => mostrarPestana(nombre));
    pestana.addEventListener('keydown', teclaEnPestanas);
  }
  window.addEventListener?.('hashchange', () => mostrarPestana(pestanaDeHash(window.location.hash)));
  porId('vista-resumen').addEventListener('click', alTocarResumen);
  porId('vista-licencias').addEventListener('click', alTocarLicencias);
  porId('vista-horas').addEventListener('click', alTocarHoras);
}

// ---- Las pestañas ----

// Muestra una pestaña, la escribe en la dirección (replaceState: no suma pasos al botón Atrás) y, la primera vez (o después de una
// carga que falló), pide sus datos. Devuelve la carga
function mostrarPestana(nombre) {
  pagina.pestana = PESTANAS.includes(nombre) ? nombre : PESTANAS[0];
  for (const otra of PESTANAS) {
    const activa = otra === pagina.pestana;
    const pestana = porId(`tab-${otra}`);
    pestana.setAttribute('aria-selected', String(activa));
    pestana.tabIndex = activa ? 0 : -1;
    porId(`vista-${otra}`).hidden = !activa;
  }
  window.history?.replaceState?.(null, '', `#${pagina.pestana}`);
  if (pagina.pestana === 'resumen') llenarTanques();
  if (pagina.pestana === 'licencias' && pagina.licencias === null) return cargarLicencias(null);
  if (pagina.pestana === 'horas' && pagina.horas === null) return cargarHorasExtras(null);
  return Promise.resolve();
}

// Teclado en la barra: flechas (con vuelta), Inicio y Fin. Mueven el foco y activan la pestaña. Con Alt, Ctrl o Cmd son atajos del
// navegador: no se tocan
function teclaEnPestanas(evento) {
  if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
  const actual = PESTANAS.indexOf(evento.target?.dataset?.pestana);
  if (actual === -1) return;
  const ultima = PESTANAS.length - 1;
  let destino;
  if (evento.key === 'ArrowRight') destino = actual === ultima ? 0 : actual + 1;
  else if (evento.key === 'ArrowLeft') destino = actual === 0 ? ultima : actual - 1;
  else if (evento.key === 'Home') destino = 0;
  else if (evento.key === 'End') destino = ultima;
  else return;
  evento.preventDefault?.();
  mostrarPestana(PESTANAS[destino]);
  porId(`tab-${PESTANAS[destino]}`).focus();
}

// ---- El Resumen ----

// El Resumen dice la modalidad: sin ella, no se carga nada (los botones del encabezado quedan ocultos) y la pestaña muestra el
// mensaje; con ella y sin el saldo inicial, invita a completar «Mis vacaciones y saldos»; si no, «Niveles», con la marca en la
// pestaña si algo vence pronto
async function cargarResumen() {
  const pedido = ++pagina.pedidos.resumen;
  try {
    const { data } = await API.pedirJson('GET', '/mi-espacio/resumen');
    if (pedido !== pagina.pedidos.resumen) return;
    pagina.resumen = esObjeto(data) ? data : {};
    pintarResumen();
  } catch (error) {
    if (pedido !== pagina.pedidos.resumen) return;
    if (error?.status === 401) irAlLogin();
    else mostrarFalla('vista-resumen', 'No se pudo cargar el resumen. Probá de nuevo en unos minutos.');
  }
}

function pintarResumen() {
  const { resumen } = pagina;
  const conModalidad = esObjeto(resumen.modalidad);
  porId('btn-cargar-horas').hidden = !conModalidad;
  porId('btn-cargar-licencia').hidden = !conModalidad;
  const vista = porId('vista-resumen');
  vista.innerHTML = htmlDelResumen(resumen);
  porId('me-marca').innerHTML = htmlDeMarca(resumen.marca);
  // Hasta que se llenan (una sola vez), los tanques se dibujan vacíos
  const fila = vista.querySelector('.me-niveles-fila');
  if (fila && !pagina.tanquesLlenos) {
    fila.setAttribute('data-llenar', '');
    llenarTanques();
  }
}

// El único movimiento de la página: la primera vez que se ve el Resumen con sus tanques, se llenan desde abajo (la transición de
// .me-tanque-nivel en el <style>, quieta con prefers-reduced-motion). Se les saca data-llenar dos cuadros después: en el primero
// el navegador los dibuja vacíos y en el segundo empieza la transición. Con el Resumen oculto (se abrió otra pestaña), esperan a
// que se vea (mostrarPestana); sin requestAnimationFrame, se llenan enseguida
function llenarTanques() {
  const vista = porId('vista-resumen');
  const fila = vista.querySelector('[data-llenar]');
  if (!fila || vista.hidden) return;
  pagina.tanquesLlenos = true;
  const enElProximoCuadro = typeof window.requestAnimationFrame === 'function'
    ? (funcion) => window.requestAnimationFrame(funcion) : (funcion) => funcion();
  enElProximoCuadro(() => enElProximoCuadro(() => fila.removeAttribute('data-llenar')));
}

// Un clic en el Resumen: un tanque abre su pestaña y el foco va a la pestaña (con Ctrl, Cmd, Mayúsculas, Alt o un botón que no
// es el principal, el link hace lo suyo: otra pestaña del navegador). Los botones de «Vence pronto» (data-accion) y «Mis
// vacaciones y saldos» (data-abrir) los conectan los formularios
function alTocarResumen(evento) {
  const tanque = evento.target?.closest?.('[data-pestana]');
  if (!tanque || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey || (evento.button ?? 0) !== 0) return;
  evento.preventDefault?.();
  mostrarPestana(tanque.dataset.pestana);
  porId(`tab-${pagina.pestana}`).focus();
}

// ---- Licencias ----

// Pide las licencias de un año (null: el en curso). Al elegir un año, se anuncia el título de la tarjeta. Si falla, la pestaña lo
// dice y queda sin lista: volver a ella la pide otra vez (la del año en curso). Devuelve si dibujó la lista (una respuesta vieja o
// una falla, no)
async function cargarLicencias(anio) {
  const pedido = ++pagina.pedidos.licencias;
  try {
    const { data } = await API.pedirJson('GET', Number.isInteger(anio) ? `/mi-espacio/licencias?anio=${anio}` : '/mi-espacio/licencias');
    if (pedido !== pagina.pedidos.licencias) return false;
    pagina.licencias = esObjeto(data) ? data : {};
    pintarLicencias();
    if (Number.isInteger(anio) && Number.isInteger(pagina.licencias.anio)) anunciar(`Mis licencias de ${pagina.licencias.anio}`);
    return true;
  } catch (error) {
    if (pedido !== pagina.pedidos.licencias) return false;
    if (error?.status === 401) irAlLogin();
    else {
      pagina.licencias = null;
      mostrarFalla('vista-licencias', 'No se pudieron cargar tus licencias. Probá de nuevo en unos minutos.');
    }
    return false;
  }
}

function pintarLicencias() {
  porId('vista-licencias').innerHTML = htmlDeListaDeLicencias(pagina.licencias, pagina.filtro);
}

// Un clic en la pestaña: un año del selector (el elegido no pide nada) o un filtro (dibuja sin pedir nada)
async function alTocarLicencias(evento) {
  const anio = evento.target?.closest?.('[data-anio]');
  if (anio) {
    if (anio.getAttribute('aria-pressed') === 'true') return;
    if (await cargarLicencias(Number(anio.dataset.anio))) enfocar('vista-licencias', 'data-anio', anio.dataset.anio);
    return;
  }
  const filtro = evento.target?.closest?.('[data-filtro-licencia]');
  if (filtro) {
    pagina.filtro = filtro.dataset.filtroLicencia;
    pintarLicencias();
    enfocar('vista-licencias', 'data-filtro-licencia', pagina.filtro);
  }
}

// ---- Horas extras ----

// Pide las horas extras de un año (null: el en curso); el día por día vuelve al mes de entrada. Si falla, como las licencias:
// volver a la pestaña la pide otra vez. Devuelve si dibujó la pestaña
async function cargarHorasExtras(anio) {
  const pedido = ++pagina.pedidos.horas;
  try {
    const { data } = await API.pedirJson('GET', Number.isInteger(anio) ? `/mi-espacio/horas-extras?anio=${anio}` : '/mi-espacio/horas-extras');
    if (pedido !== pagina.pedidos.horas) return false;
    pagina.horas = esObjeto(data) ? data : {};
    pagina.mes = mesInicialDe(pagina.horas);
    pintarHoras();
    if (Number.isInteger(anio) && Number.isInteger(pagina.horas.anio)) anunciar(`Horas extras de ${pagina.horas.anio}`);
    return true;
  } catch (error) {
    if (pedido !== pagina.pedidos.horas) return false;
    if (error?.status === 401) irAlLogin();
    else {
      pagina.horas = null;
      pagina.mes = null;
      mostrarFalla('vista-horas', 'No se pudieron cargar tus horas extras. Probá de nuevo en unos minutos.');
    }
    return false;
  }
}

function pintarHoras() {
  porId('vista-horas').innerHTML = htmlDeHorasExtras(pagina.horas, pagina.mes);
}

// Un clic en la pestaña: un año del selector o un mes de la tabla (cambia el día por día sin pedir nada)
async function alTocarHoras(evento) {
  const anio = evento.target?.closest?.('[data-anio]');
  if (anio) {
    if (anio.getAttribute('aria-pressed') === 'true') return;
    if (await cargarHorasExtras(Number(anio.dataset.anio))) enfocar('vista-horas', 'data-anio', anio.dataset.anio);
    return;
  }
  const mes = evento.target?.closest?.('[data-mes]');
  if (mes) {
    pagina.mes = mes.dataset.mes;
    pintarHoras();
    enfocar('vista-horas', 'data-mes', pagina.mes);
  }
}
