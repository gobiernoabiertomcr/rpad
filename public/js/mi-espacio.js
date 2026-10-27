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
 * Los formularios (secciones 4, 6 y 8; maqueta 2), modales que un clic en el velo no cierra: «Cargar licencia» (los tipos de la
 * modalidad con lo que queda de cada uno, el cálculo del servidor 300 ms después del último cambio, «Mostrar a mis compañeros»,
 * el aviso del paso a Configuración, la persona a cargo del firmante en sus vacaciones y los días sin auditor), «Cargar horas
 * extras» (con lo que suman en el mes), «Mis vacaciones y saldos» (se abre solo sin el saldo inicial), «Registrar un uso
 * autorizado» y la confirmación de un borrado, que se abre sobre el formulario. Los abren los botones del encabezado y los data-*
 * de las pestañas (data-cargar, data-abrir, data-editar-licencia, data-editar-horas y, en «Vence pronto», data-accion con su
 * data-tipo). Copias mínimas, para avisar en el momento (el servidor valida igual), atadas por tests de paridad: los mensajes y
 * las constantes de services/miEspacioReglas.js, horasDelHorario (horasDe), camposConLoElegido (camposDelSaldoInicial) y las de
 * Configuración (efectoEnNotas, textoSinAuditor, textoAusenciasAutorizado y parametrosSinAuditor, de usuarios.js).
 * Al cargarse el archivo solo declara (tests/mi-espacio-frontend.test.js lo carga en un vm después del api.js de verdad): lo que
 * arma HTML es puro y va primero; lo que toca el DOM o la API va aparte, al final (iniciarMiEspacio, enganchado a
 * DOMContentLoaded), con los eventos delegados en contenedores fijos: volver a dibujar no engancha nada, y el foco vuelve al control
 * que se usó. Pide los datos con API.pedirJson. Todo texto del servidor pasa por Utils.escapeHtml (también en los aria-label) y un
 * número se escribe con String (Utils.escapeHtml(0) da ''); lo que va con textContent (los títulos de los modales, la
 * confirmación), tal cual. Lo que cambia se anuncia en #me-anuncio, la única región viva de la página (en cada modal, su error sin
 * campo es role="alert"); lo que dice el servidor al guardar o borrar, y un formulario que no se pudo abrir, se ve además en un
 * aviso (avisarMiEspacio: el showToast de main.js, como en Áreas, Feriados y Proyectos).
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

// Un compañero que no está: sus iniciales, «Laura Gómez no está» y la vuelta, con los textos del servidor
const htmlDeAusente = (ausente) => '<li class="me-ausente">'
  + `<span class="me-inicial" aria-hidden="true">${esc(iniciales(ausente.nombre))}</span><span><b>${esc(ausente.texto)}</b>`
  + `${conTexto(ausente.vuelve_texto) ? `<small>${esc(ausente.vuelve_texto)}</small>` : ''}</span></li>`;

/**
 * «Hoy y mañana» (el `hoy_y_manana` del Resumen): «Hoy no están» y, aparte, «Mañana no están» (los que empiezan mañana: decisión
 * del usuario, 27/10/2026), solo para quien ve a sus compañeros (`veCompaneros`, el true literal: administración), con el texto y
 * la vuelta que manda el servidor, y el próximo feriado. Un grupo vacío no va (como «Vence pronto»): solo se ven los de
 * administración que eligieron mostrarse, así que «están todos» podría no ser cierto. Sin ninguno de los tres, no hay sección.
 */
function htmlDeHoyYManana(datos, veCompaneros) {
  const hoy = esObjeto(datos) ? datos : {};
  const grupo = (titulo, ausentes) => {
    const filas = veCompaneros === true ? listaDe(ausentes).map(htmlDeAusente) : [];
    return filas.length > 0 ? `<h3 class="me-subtitulo">${titulo}</h3><ul class="me-ausentes">${filas.join('')}</ul>` : '';
  };
  const feriado = hoy.proximo_feriado;
  const cuerpo = grupo('Hoy no están', hoy.ausentes_hoy) + grupo('Mañana no están', hoy.ausentes_manana)
    + (esObjeto(feriado)
      ? `<h3 class="me-subtitulo">Próximo feriado</h3><p class="me-feriado"><b>${esc(feriado.cuando)}</b>${esc(feriado.nombre)}</p>`
      : '');
  if (cuerpo === '') return '';
  return '<section class="me-hoy" aria-labelledby="me-hoy-titulo"><h2 class="me-titulo" id="me-hoy-titulo">Hoy y mañana</h2>'
    + `${cuerpo}</section>`;
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
// Lo puro: los formularios
// =====================================================

// ---- Copias mínimas, para avisar en el momento (el servidor valida igual), atadas por tests de paridad ----

// Las claves de MENSAJES_MI_ESPACIO (services/miEspacioReglas.js) que usan los formularios
const MENSAJES_FORMULARIOS = Object.freeze({
  tipo: 'Elegí el tipo de licencia.',
  fecha: 'Elegí una fecha válida.',
  hastaAntes: 'La licencia no puede terminar antes de empezar.',
  horasEnteras: 'Las franquicias se toman por hora entera, de 1 a 7.',
  horasMedias: 'Las horas van de a media hora, de 0,5 a 7.',
  nota: 'La nota puede tener hasta 200 caracteres.',
  horario: 'Elegí de qué hora a qué hora, de a media hora.',
  diasVacaciones: 'Elegí 10, 15, 20, 25 o 30 días.',
  estudios: 'Elegí universitaria, secundaria o «No estudio».',
  saldoMedias: 'Escribí las horas de a media hora.',
  yaEmpezo: 'Ya empezó: no se puede borrar',
  soloHasta: 'Ya empezó: solo podés cambiar hasta cuándo.',
  fechasFijas: 'Ya terminó: las fechas quedan fijas.'
});
// Los días de vacaciones que se eligen por año, los de estudios según la carrera y los de cada examen, las horas de un día entero y
// el largo de una nota (en caracteres contados con Array.from): los de services/miEspacioReglas.js
const DIAS_VACACIONES = Object.freeze([10, 15, 20, 25, 30]);
const DIAS_ESTUDIOS = Object.freeze({ universitario: 15, secundario: 10 });
const DIAS_POR_EXAMEN = 3;
const JORNADA = 7;
const LARGO_NOTA = 200;

// Un número con coma y a lo sumo un decimal, como numeroTexto del servidor: '10,5'
const numeroConComa = (valor) => {
  const numero = Math.round(Number(valor) * 10) / 10;
  return Number.isFinite(numero) ? String(numero).replace('.', ',') : '—';
};
// Copia de textoSaldo: «Escribí un número de 0 a 30.»
const textoSaldo = (maximo) => `Escribí un número de 0 a ${numeroConComa(maximo)}.`;

// Copia de horasDe: las horas de un horario 'HH:MM' de a media hora; con hasta antes que desde, pasa la medianoche (+24 h). null
// si son iguales o alguna no es una hora en punto o y media
const minutosDelDia = (hora) => {
  if (typeof hora !== 'string' || !/^([01]\d|2[0-3]):(00|30)$/.test(hora)) return null;
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));
};
const horasDelHorario = (desde, hasta) => {
  const inicio = minutosDelDia(desde);
  const fin = minutosDelDia(hasta);
  if (inicio === null || fin === null || inicio === fin) return null;
  return ((fin > inicio ? fin : fin + 24 * 60) - inicio) / 60;
};

// Copias de usuarios.js (Configuración → Licencias): el efecto de la licencia del firmante en las notas, los días sin auditor y
// las ausencias de la persona autorizada, con los mismos textos. efectoEnNotas recibe «hoy» por parámetro

// 'AAAA-MM-DD' → 'dd/mm/aaaa' sin pasar por Date
const fechaCorta = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const efectoEnNotas = (licencia, autorizadoNombre, hoy) => {
  if (hoy && licencia?.desde && licencia.desde <= hoy) {
    return autorizadoNombre
      ? `Licencia en curso: ${autorizadoNombre} presenta las notas con las dos firmas, citando la nota que comunica la autorización (si todavía no salió, la próxima corrida la genera primero), y vuelve a presentar en su fecha cada aviso que se adelantó.`
      : 'Licencia en curso sin persona autorizada: no se generan notas hasta la vuelta. Lo que toque avisar y las reiteraciones salen el primer día hábil después de la licencia.';
  }
  const cuando = licencia?.vispera ? `el ${fechaCorta(licencia.vispera)}` : 'el último día hábil anterior';
  return autorizadoNombre
    ? `Los avisos que tocarían durante la licencia salen por adelantado ${cuando} (corrida de las 8:15), en una nota que comunica la autorización a ${autorizadoNombre}. Durante la licencia, ${autorizadoNombre} presenta las demás notas con las dos firmas, citando esa nota, y vuelve a presentar cada aviso en su fecha.`
    : `Sin persona autorizada: los avisos que tocarían durante la licencia salen por adelantado ${cuando} (corrida de las 8:15) y las reiteraciones se postergan a la vuelta. Cargá la licencia antes de ese día.`;
};
const listaConY = (nombres) => (nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres.join(''));
const textoSinAuditor = ({ desde, hasta, vuelve, respaldo }) => {
  const unDia = desde === hasta;
  const cuando = unDia ? `El ${fechaCorta(desde)}` : `Del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
  const hastaCuando = vuelve ? `el ${fechaCorta(vuelve)}` : 'que haya un auditor disponible';
  const texto = `${cuando} no va a haber ningún auditor disponible: los cambios que se propongan ${unDia ? 'ese día' : 'en esos días'} van a quedar pendientes hasta ${hastaCuando}.`;
  return respaldo?.length
    ? `${texto} En ${unDia ? 'ese día' : 'esos días'} solo pueden auditar de respaldo: ${listaConY(respaldo)} (nunca un cambio propio).`
    : texto;
};
const MAXIMO_DIAS_SIN_AUDITOR = 366;
const diaUtc = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
const esFechaValida = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') && new Date(diaUtc(iso)).toISOString().slice(0, 10) === iso;
const diasDelRango = (desde, hasta) => (diaUtc(hasta) - diaUtc(desde)) / 86400000 + 1;
const textoAusenciasAutorizado = (nombre, ausencias, desde, hasta) => {
  if (!nombre || !esFechaValida(desde) || !esFechaValida(hasta)) return [];
  return [...(ausencias ?? [])]
    .sort((x, y) => x.desde.localeCompare(y.desde))
    .map(({ desde: d, hasta: h, vuelve }) => ({ a: d > desde ? d : desde, b: h < hasta ? h : hasta, vuelve }))
    .filter(({ a, b }) => a <= b)
    .map(({ a, b, vuelve }) => {
      const cuando = a === b ? `el ${fechaCorta(a)}: ese día` : `del ${fechaCorta(a)} al ${fechaCorta(b)}: esos días`;
      const presenta = vuelve && vuelve <= hasta ? ` Desde el ${fechaCorta(vuelve)} las presenta en tu nombre.` : '';
      return `${nombre} va a estar de licencia ${cuando} no se generan notas.${presenta}`;
    });
};
const parametrosSinAuditor = ({ usuarioId, desde, hasta, excluir = null, hoy = '' }) => {
  if (!usuarioId || !esFechaValida(desde) || !esFechaValida(hasta)) return null;
  const inicio = hoy && desde < hoy ? hoy : desde;
  if (inicio > hasta || diasDelRango(inicio, hasta) > MAXIMO_DIAS_SIN_AUDITOR) return null;
  return { desde: inicio, hasta, usuario_id: usuarioId, ...(excluir ? { excluir } : {}) };
};

// ---- Lo de cada formulario ----

const comoTexto = (valor) => (typeof valor === 'string' ? valor : '');
// 'AAAA-MM-DD' de un día que existe (como esFechaIso del servidor, sobre el texto: sin Date local)
const esFechaDeTexto = (valor) => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) && Utils.soloFecha(valor) === valor;
// Un número escrito en un campo, con coma o con punto: '' es null; lo que no es un número, NaN
const numeroDelCampo = (texto) => {
  const limpio = String(texto ?? '').trim().replace(',', '.');
  return limpio === '' ? null : Number(limpio);
};
const largoDeLaNota = (nota) => Array.from(comoTexto(nota).trim()).length;

// Los tipos de un solo día (el campo es «Fecha»: desde y hasta son el mismo) y los que se cargan en horas: copias de
// TIPOS_DE_UN_DIA y TIPOS_POR_HORAS de services/miEspacioReglas.js, atadas por un test de paridad
const TIPOS_DE_UN_DIA = Object.freeze(['franquicia', 'franco', 'horas_a_favor', 'uso_autorizado']);
const TIPOS_CON_HORAS = Object.freeze(['franquicia', 'horas_a_favor', 'uso_autorizado']);
const deUnDia = (tipo) => TIPOS_DE_UN_DIA.includes(tipo);
// Cómo se cargan las horas de un tipo: 'enteras' (la franquicia, de 1 a 7), 'medias' (las horas a favor y el uso autorizado de
// contrato, de 0,5 a 7) o null (sin horas; el uso autorizado de planta es un franco, el día entero)
const horasDelTipo = (tipo, modalidad) => {
  if (tipo === 'franquicia') return 'enteras';
  if (tipo === 'horas_a_favor' || (tipo === 'uso_autorizado' && modalidad !== 'planta')) return 'medias';
  return null;
};
// Si una licencia es de día entero, como esDiaEntero del servidor (atada por un test de paridad): una de horas, solo con la
// jornada entera (el uso autorizado de planta es un franco, el día entero). Solo esas se les muestran a los compañeros (spec,
// sección 7): las de menos de 7 horas, nunca. `horas`, como las escribe el campo
const esDeDiaEntero = (tipo, horas, modalidad) => !TIPOS_CON_HORAS.includes(tipo) || horasDelTipo(tipo, modalidad) === null
  || numeroDelCampo(horas) === JORNADA;
// Lo que dice el formulario si el cálculo no llegó (un error del servidor, o sin conexión): sin él no se ve qué pasa con
// Configuración, así que «Guardar» lo vuelve a pedir antes de guardar
const textoSinCalculo = (falla) => `No se pudo calcular: ${falla?.status ? 'hubo un error en el servidor'
  : 'no se pudo conectar con el servidor'}. Probá de nuevo en unos minutos.`;

/**
 * Los valores de «Cargar licencia» (o del uso autorizado): los de una fila de la lista que se corrige o, sin fila, los de una
 * nueva con `tipo` (el de «Vence pronto»; sin él, ninguno). Las horas, como texto. `autorizado` es la persona a cargo elegida y
 * `autorizado_inicial`, la que ya tenía (de `en_configuracion`, solo de una creada): autorizado_id viaja solo si cambian.
 * `licencia_oficial` es el id de su licencia de Configuración (el excluir del aviso de los días sin auditor), o null.
 */
function valoresDeLicencia(fila, tipo) {
  const datos = esObjeto(fila) ? fila : {};
  const enConfiguracion = esObjeto(datos.en_configuracion) ? datos.en_configuracion : {};
  const autorizado = Number.isInteger(enConfiguracion.autorizado_id) ? String(enConfiguracion.autorizado_id) : '';
  let elTipo = '';
  if (conTexto(datos.tipo)) elTipo = datos.tipo;
  else if (conTexto(tipo)) elTipo = tipo;
  return {
    id: datos.id ?? null,
    tipo: elTipo,
    desde: comoTexto(datos.desde),
    hasta: comoTexto(datos.hasta),
    horas: typeof datos.horas === 'number' && Number.isFinite(datos.horas) ? String(datos.horas) : '',
    nota: comoTexto(datos.nota),
    mostrar: datos.mostrar !== false,
    autorizado,
    autorizado_inicial: autorizado,
    licencia_oficial: Number.isInteger(enConfiguracion.licencia_id) ? enConfiguracion.licencia_id : null
  };
}

/**
 * Los errores de una licencia antes de pedir nada (`{ campo: mensaje }`, en el orden del formulario; sin ninguno, {}): el tipo,
 * las fechas (el formato y que el hasta no sea anterior; en los de un día, solo la fecha), las horas de los tipos que se cargan
 * en horas (con `modalidad`: en planta, el uso autorizado no lleva) y el largo de la nota. Los mensajes son los del servidor, que
 * controla además el rango, los días hábiles, los topes y lo que se superpone.
 */
function erroresDeLicencia(valores, { modalidad = null } = {}) {
  const datos = esObjeto(valores) ? valores : {};
  const errores = {};
  if (!conTexto(datos.tipo)) errores.tipo = MENSAJES_FORMULARIOS.tipo;
  if (!esFechaDeTexto(datos.desde)) errores.desde = MENSAJES_FORMULARIOS.fecha;
  else if (!deUnDia(datos.tipo)) {
    if (!esFechaDeTexto(datos.hasta)) errores.hasta = MENSAJES_FORMULARIOS.fecha;
    else if (datos.hasta < datos.desde) errores.hasta = MENSAJES_FORMULARIOS.hastaAntes;
  }
  const enHoras = horasDelTipo(datos.tipo, modalidad);
  const horas = numeroDelCampo(datos.horas);
  if (enHoras === 'enteras' && !(Number.isInteger(horas) && horas >= 1 && horas <= JORNADA)) {
    errores.horas = MENSAJES_FORMULARIOS.horasEnteras;
  }
  if (enHoras === 'medias' && !(horas !== null && Number.isInteger(horas * 2) && horas >= 0.5 && horas <= JORNADA)) {
    errores.horas = MENSAJES_FORMULARIOS.horasMedias;
  }
  if (largoDeLaNota(datos.nota) > LARGO_NOTA) errores.nota = MENSAJES_FORMULARIOS.nota;
  return errores;
}

/**
 * El cuerpo de POST /licencias y PUT /licencias/:id (y del cálculo previo): el tipo, las fechas (en los de un día, el hasta es
 * el desde), las horas (solo en los tipos de horas que las llevan, como número), «Mostrar» y la nota recortada. `autorizado_id`
 * va solo en las vacaciones del firmante titular (`soyTitular`: el campo «Autorizo a…» está a la vista) y, al corregir, solo si
 * se cambió la persona: si no, el servidor conserva la de Configuración. Vacío es null (nadie).
 */
function cuerpoDeLicencia(valores, { soyTitular = false } = {}) {
  const datos = esObjeto(valores) ? valores : {};
  const cuerpo = {
    tipo: datos.tipo, desde: datos.desde, hasta: deUnDia(datos.tipo) ? datos.desde : datos.hasta, mostrar: datos.mostrar !== false,
    nota: comoTexto(datos.nota).trim()
  };
  const horas = numeroDelCampo(datos.horas);
  if (TIPOS_CON_HORAS.includes(datos.tipo) && horas !== null) cuerpo.horas = horas;
  const nueva = datos.id === null || datos.id === undefined;
  if (soyTitular === true && datos.tipo === 'vacaciones'
    && (nueva || comoTexto(datos.autorizado) !== comoTexto(datos.autorizado_inicial))) {
    cuerpo.autorizado_id = conTexto(datos.autorizado) ? Number(datos.autorizado) : null;
  }
  return cuerpo;
}

// Los tipos de «Cargar licencia» (los `tipos` del Resumen): radios grandes, cada uno con lo que queda. El uso autorizado no va:
// tiene su propio formulario
function htmlDeTiposDeLicencia(tipos, elegido) {
  return listaDe(tipos).filter((opcion) => opcion.tipo !== 'uso_autorizado').map((opcion) => '<label class="me-opcion">'
    + `<input type="radio" name="ml-tipo" value="${esc(opcion.tipo)}"${opcion.tipo === elegido ? ' checked' : ''} `
    + 'aria-describedby="ml-tipos-error">'
    + `<span><b>${esc(opcion.nombre)}</b>${conTexto(opcion.queda_texto) ? `<small>${esc(opcion.queda_texto)}</small>` : ''}`
    + '</span></label>')
    .join('');
}

// Las horas que se pueden elegir: enteras, de 1 a 7, o de a media hora, de 0,5 a 7 (7 es el día entero), con la elegida
function htmlDeOpcionesDeHoras(enHoras, elegida) {
  const paso = enHoras === 'enteras' ? 1 : 0.5;
  const opciones = ['<option value="">—</option>'];
  for (let horas = paso; horas <= JORNADA; horas += paso) {
    opciones.push(`<option value="${String(horas)}"${String(horas) === elegida ? ' selected' : ''}>`
      + `${numeroConComa(horas)}${horas === JORNADA ? ', el día entero' : ''}</option>`);
  }
  return opciones.join('');
}

// El cálculo del servidor (la `vista` de POST /licencias/calculo): los días hábiles (en los estudios, si es el máximo por
// examen), de qué licencia salen y lo que queda. Sin vista (la licencia no se puede guardar como está), ''
function htmlDelCalculo(data, tipo) {
  const vista = esObjeto(data) && esObjeto(data.vista) ? data.vista : null;
  if (vista === null || !conTexto(vista.texto_dias)) return '';
  const examen = tipo === 'estudios' && vista.dias_habiles === DIAS_POR_EXAMEN ? ', el máximo por examen' : '';
  const resto = [vista.texto_reparto, vista.queda_texto, vista.texto_antes_del_arranque].filter(conTexto).map(esc);
  return [`<b>${esc(vista.texto_dias)}${examen}.</b>`, ...resto].join(' ');
}

/**
 * Lo que dice el formulario del paso a Configuración (el `paso` del cálculo), un párrafo por texto. Si pasa, los avisos del
 * servidor y, en las vacaciones del firmante titular, el efecto en las notas con la persona a cargo elegida (`autorizado`, su
 * nombre, o null: nadie) y los días en que ella está de licencia (`ausencias`, las de GET /mi-espacio/firmante), con las fechas
 * del formulario (`desde` y `hasta`) y `hoy`. Con `conEfecto` false (no se sabe quién queda a cargo), el efecto no va. Si no
 * pasa, por qué (una de administración que la cubre o con la que se superpone); sin nada que decir, ''.
 */
function htmlDelPaso(paso, { autorizado = null, ausencias = [], hoy = '', desde = '', hasta = '', conEfecto = true } = {}) {
  if (!esObjeto(paso)) return '';
  const parrafos = [];
  if (paso.pasa === true) {
    parrafos.push(...(Array.isArray(paso.avisos) ? paso.avisos : []).filter(conTexto));
    if (conEfecto !== false && esObjeto(paso.firmante) && paso.firmante.puede_autorizar === true) {
      const nombre = conTexto(autorizado) ? autorizado : null;
      parrafos.push(efectoEnNotas({ desde, vispera: paso.firmante.vispera }, nombre, hoy));
      if (nombre !== null) parrafos.push(...textoAusenciasAutorizado(nombre, listaDe(ausencias), desde, hasta));
    }
  } else if (conTexto(paso.sin_pasar_previsto)) parrafos.push(paso.sin_pasar_previsto);
  return parrafos.map((texto) => `<p>${esc(texto)}</p>`).join('');
}

// Las personas que el firmante puede dejar a cargo (`[{ id, nombre }]`), después de «Nadie»
function htmlDeAutorizables(personas) {
  return ['<option value="">Nadie: se anticipan los avisos</option>',
    ...listaDe(personas).map((persona) => `<option value="${esc(persona.id)}">${esc(persona.nombre)}</option>`)].join('');
}

// La confirmación de un borrado, en texto plano (va con textContent): qué se borra y, de una licencia creada en Configuración, que
// también se anula allá. Una fila de horas extras (la del día por día) tiene su horario
function textoDeConfirmacion(fila) {
  const datos = esObjeto(fila) ? fila : {};
  const nota = conTexto(datos.nota) ? ` («${datos.nota}»)` : '';
  if (typeof datos.horario === 'string') return `Horas extras del ${comoTexto(datos.fecha_texto)}, de ${datos.horario}${nota}.`;
  const enConfiguracion = esObjeto(datos.en_configuracion) ? ' También se anula en Configuración → Licencias.' : '';
  return `${comoTexto(datos.tipo_nombre)} del ${comoTexto(datos.fechas_texto)}${nota}.${enConfiguracion}`;
}

// ---- Las horas extras ----

const NOMBRES_DE_LOS_MESES = Object.freeze([
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]);
// El nombre del mes de 'AAAA-MM', o del que viene `mas` meses después
const nombreDelMes = (mes, mas = 0) => NOMBRES_DE_LOS_MESES[(Number(mes.slice(5, 7)) - 1 + mas) % 12];
const textoDeHoras = (horas) => `${numeroConComa(horas)} ${horas === 1 ? 'hora' : 'horas'}`;

/**
 * Lo que suman unas horas extras mientras se cargan: «3,5 horas.» y, si la fecha es del año de la tabla cargada (la de la
 * pestaña), lo que lleva el mes con ellas (sin contar dos veces las que se corrigen, `valores.id`; un mes sin fila en la tabla,
 * la primera carga del mes, llevaba 0) y lo que da: en planta, los francos compensatorios para usar dos meses después («… En
 * octubre llevás 14 horas: 2 francos compensatorios para usar en diciembre.»; sin llegar a 7 horas, solo lo que lleva); en
 * contrato, las horas a favor del mes siguiente. Un horario que no sirve, ''.
 */
function textoDeLaSuma(valores, tabla, modalidad) {
  const datos = esObjeto(valores) ? valores : {};
  const horas = horasDelHorario(datos.desde, datos.hasta);
  if (horas === null) return '';
  const base = `${textoDeHoras(horas)}.`;
  const mes = esFechaDeTexto(datos.fecha) ? datos.fecha.slice(0, 7) : null;
  if (mes === null || !esObjeto(tabla) || tabla.anio !== Number(mes.slice(0, 4))) return base;
  const otras = listaDe(deMapa(tabla.dias_por_mes, mes, []))
    .filter((dia) => datos.id === null || datos.id === undefined || String(dia.id) !== String(datos.id))
    .reduce((suma, dia) => suma + (horasDelHorario(dia.desde, dia.hasta) ?? 0), 0);
  const total = otras + horas;
  const lleva = `En ${nombreDelMes(mes)} llevás ${textoDeHoras(total)}`;
  if (modalidad === 'planta') {
    const francos = Math.floor(total / JORNADA);
    if (francos === 0) return `${base} ${lleva}.`;
    return `${base} ${lleva}: ${francos} ${francos === 1 ? 'franco compensatorio' : 'francos compensatorios'} para usar en `
      + `${nombreDelMes(mes, 2)}.`;
  }
  if (modalidad === 'contrato') return `${base} ${lleva}: en ${nombreDelMes(mes, 1)} vas a tener ${textoDeHoras(total)} a favor.`;
  return base;
}

// Los valores de «Cargar horas extras»: los de un día del día por día que se corrige, o vacíos
function valoresDeHoras(dia) {
  const datos = esObjeto(dia) ? dia : {};
  return {
    id: datos.id ?? null, fecha: comoTexto(datos.fecha), desde: comoTexto(datos.desde), hasta: comoTexto(datos.hasta),
    nota: comoTexto(datos.nota)
  };
}

// Los errores de unas horas extras antes de pedir nada, con los mensajes y los campos del servidor (el horario va en `desde`)
function erroresDeHoras(valores) {
  const datos = esObjeto(valores) ? valores : {};
  const errores = {};
  if (!esFechaDeTexto(datos.fecha)) errores.fecha = MENSAJES_FORMULARIOS.fecha;
  if (horasDelHorario(datos.desde, datos.hasta) === null) errores.desde = MENSAJES_FORMULARIOS.horario;
  if (largoDeLaNota(datos.nota) > LARGO_NOTA) errores.nota = MENSAJES_FORMULARIOS.nota;
  return errores;
}

// El cuerpo de POST /horas-extras y PUT /horas-extras/:id
const cuerpoDeHoras = (valores) => ({
  fecha: valores.fecha, desde: valores.desde, hasta: valores.hasta, nota: comoTexto(valores.nota).trim()
});

// ---- «Mis vacaciones y saldos» ----

/**
 * Los campos de «Para arrancar» (los de GET /saldo-inicial, que arma camposDelSaldoInicial con lo guardado) con lo que se elige
 * en el modal antes de guardarlo, si el saldo es del año del modal (`anio`; el de los campos es el de su `medica`): el máximo de
 * las vacaciones del año es la primera mitad de los días elegidos (con un número impar, la mayor), y el campo de los estudios
 * está solo si estudia, hasta los días de su carrera, antes de la atención médica. Cada campo conserva su `valor`.
 */
function camposConLoElegido(campos, { anio, dias, estudios } = {}) {
  const lista = listaDe(campos);
  if (!Number.isInteger(anio) || lista.find((campo) => campo.concepto === 'medica')?.anio !== anio) return lista;
  const conDias = DIAS_VACACIONES.includes(dias)
    ? lista.map((campo) => (campo.clave === `vacaciones-${anio}` ? { ...campo, maximo: Math.ceil(dias / 2) } : campo))
    : lista;
  const sinEstudios = conDias.filter((campo) => campo.clave !== 'estudios');
  if (typeof estudios !== 'string' || !Object.hasOwn(DIAS_ESTUDIOS, estudios)) return sinEstudios;
  const antes = conDias.find((campo) => campo.clave === 'estudios');
  const delCampo = {
    clave: 'estudios', concepto: 'estudios', anio, rotulo: 'Días de estudios', maximo: DIAS_ESTUDIOS[estudios], paso: 1,
    valor: antes?.valor ?? null
  };
  const medica = sinEstudios.findIndex((campo) => campo.concepto === 'medica');
  return [...sinEstudios.slice(0, medica), delCampo, ...sinEstudios.slice(medica)];
}

// Lo que muestra cada campo al abrir: lo guardado, con coma; sin nada guardado, vacío
const valoresDelSaldo = (campos) => Object.fromEntries(listaDe(campos)
  .map((campo) => [campo.clave, campo.valor === null || campo.valor === undefined ? '' : numeroConComa(campo.valor)]));

// Los errores del saldo inicial (`{ clave: mensaje }`), como validarSaldoInicial: de 0 a su máximo, entero o, con paso 0,5, de a
// media hora
function erroresDelSaldo(valores, campos) {
  const errores = {};
  for (const campo of listaDe(campos)) {
    const maximo = Number(campo.maximo);
    if (typeof campo.clave !== 'string' || !Number.isFinite(maximo)) continue;
    const cantidad = numeroDelCampo(deMapa(valores, campo.clave, ''));
    const enMedias = campo.paso === 0.5;
    if (cantidad === null || !(cantidad >= 0 && cantidad <= maximo)) errores[campo.clave] = textoSaldo(maximo);
    else if (!Number.isInteger(enMedias ? cantidad * 2 : cantidad)) {
      errores[campo.clave] = enMedias ? MENSAJES_FORMULARIOS.saldoMedias : textoSaldo(maximo);
    }
  }
  return errores;
}

// El cuerpo de PUT /saldo-inicial: un número por campo
const cuerpoDelSaldo = (valores, campos) => ({
  saldos: Object.fromEntries(listaDe(campos).map((campo) => [campo.clave, numeroDelCampo(deMapa(valores, campo.clave, ''))]))
});

// Los días de vacaciones del año, como números para elegir (cada uno describe el error del grupo, como los tipos de licencia)
const htmlDeDiasDeVacaciones = (elegidos) => DIAS_VACACIONES.map((dias) => '<label class="me-numero">'
  + `<input type="radio" name="ms-dia" value="${String(dias)}"${dias === elegidos ? ' checked' : ''} aria-describedby="ms-dias-error">`
  + `<span>${String(dias)}</span></label>`)
  .join('');

// La licencia por estudios: universitaria, secundaria o «No estudio» (el valor vacío). `elegidos`: la carrera, '' por «No
// estudio» o undefined (todavía no eligió)
function htmlDeEstudios(elegidos) {
  const opciones = [
    ['universitario', 'Universitaria', `${String(DIAS_ESTUDIOS.universitario)} días por año`],
    ['secundario', 'Secundaria', `${String(DIAS_ESTUDIOS.secundario)} días por año`],
    ['', 'No estudio', 'Sin licencia por estudios']
  ];
  return opciones.map(([valor, nombre, detalle]) => '<label class="me-opcion">'
    + `<input type="radio" name="ms-estudio" value="${valor}"${valor === elegidos ? ' checked' : ''} aria-describedby="ms-estudios-error">`
    + `<span><b>${nombre}</b><small>${detalle}</small></span></label>`).join('');
}

// Un campo de «Para arrancar», con su error
const htmlDeCampoDelSaldo = (campo, valores) => {
  const id = `ms-campo-${String(campo.clave)}`;
  return `<div class="form-group"><label class="form-label" for="${esc(id)}">${esc(campo.rotulo)}</label>`
    + `<input type="text" inputmode="decimal" class="form-input" id="${esc(id)}" data-saldo="${esc(campo.clave)}" `
    + `value="${esc(deMapa(valores, campo.clave, ''))}" autocomplete="off" aria-describedby="${esc(id)}-error">`
    + `<p class="form-error" id="${esc(id)}-error" hidden></p></div>`;
};

// «Para arrancar»: lo que quedaba de cada licencia ordinaria; después, «Y lo que ya usaste en 2026:» y, en contrato, las horas no
// utilizadas previamente
function htmlDeCamposDelSaldo(campos, valores) {
  const lista = listaDe(campos).filter((campo) => typeof campo.clave === 'string');
  const grupo = (filtro) => {
    const delGrupo = lista.filter(filtro);
    if (delGrupo.length === 0) return '';
    return `<div class="me-campos-saldo">${delGrupo.map((campo) => htmlDeCampoDelSaldo(campo, valores)).join('')}</div>`;
  };
  const anio = lista.find((campo) => campo.concepto === 'medica')?.anio;
  return grupo((campo) => campo.concepto === 'vacaciones')
    + (Number.isInteger(anio) ? `<p class="form-hint">Y lo que ya usaste en ${String(anio)}:</p>` : '')
    + grupo((campo) => !['vacaciones', 'horas_no_utilizadas'].includes(campo.concepto))
    + grupo((campo) => campo.concepto === 'horas_no_utilizadas');
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
// más nueva se descarta. `cargandoResumen`: hay un pedido del Resumen en vuelo. `tanquesLlenos`: los tanques del Resumen ya se
// llenaron (pasa una sola vez). Los formularios: `modales`, los abiertos, del de abajo al de arriba (la confirmación se abre
// sobre el formulario); `formulario`, el de «Cargar licencia» o del uso autorizado abierto; `horasExtras`, el de las horas extras;
// `saldos`, el de «Mis vacaciones y saldos» (`saldosAbiertosSolos`: ya se abrió solo una vez); `confirmacion`, el borrado que se
// confirma; y `firmante`, el pedido de GET /mi-espacio/firmante (una sola vez)
const pagina = {
  pestana: PESTANAS[0], resumen: null, licencias: null, filtro: 'todas', horas: null, mes: null, tanquesLlenos: false,
  cargandoResumen: false, pedidos: { resumen: 0, licencias: 0, horas: 0 },
  modales: [], formulario: null, horasExtras: null, saldos: null, saldosAbiertosSolos: false, confirmacion: null, firmante: null
};

const porId = (id) => document.getElementById(id);

// La región viva de la página (#me-anuncio, fuera de lo que se vuelve a dibujar). Un texto igual al anterior se cambia apenas (un
// espacio duro al final), para que se vuelva a anunciar
function anunciar(texto) {
  const region = porId('me-anuncio');
  if (!region || !texto) return;
  region.textContent = region.textContent === texto ? `${texto} ` : texto;
}

// Un aviso de la página, como en Áreas, Feriados y Proyectos: el toast de main.js (showToast inserta HTML: se escapa) y, como el
// toast no se anuncia, lo mismo en #me-anuncio. `tipo`: 'success', 'error' o 'warning'
function avisarMiEspacio(texto, tipo) {
  if (!conTexto(texto)) return;
  if (typeof showToast === 'function') showToast(esc(texto), tipo);
  anunciar(texto);
}

// Lo que se dice cuando un formulario no se puede abrir
const MENSAJE_SIN_RESUMEN = 'No se pudo abrir el formulario: no se pudo cargar el resumen. Probá de nuevo en unos minutos.';
const MENSAJE_SIN_SALDOS = 'No se pudo abrir «Mis vacaciones y saldos». Probá de nuevo en unos minutos.';

// La sesión venció (401): se cierra y al login
function irAlLogin() {
  if (typeof Auth.clearSession === 'function') Auth.clearSession();
  window.location.href = 'login.html';
}

// Lo que no se pudo cargar, en su pestaña y, si se pide, anunciado
function mostrarFalla(vista, texto, conAnuncio = true) {
  porId(vista).innerHTML = htmlDeError(texto);
  if (conAnuncio) anunciar(texto);
}

// El control de una pestaña con ese atributo y ese valor, o null
const controlCon = (vista, atributo, valor) =>
  [...porId(vista).querySelectorAll(`[${atributo}]`)].find((uno) => uno.getAttribute(atributo) === valor) ?? null;

// Después de volver a dibujar una pestaña, el foco va al control equivalente al que se usó (el botón viejo ya no está)
function enfocar(vista, atributo, valor) {
  controlCon(vista, atributo, valor)?.focus();
}

// Abre la pestaña de la dirección y pide el Resumen (primero: la pestaña Resumen no lo pide dos veces). Devuelve las cargas, para
// quien quiera esperarlas
function iniciarMiEspacio() {
  conectarEventos();
  const resumen = cargarResumen();
  return Promise.all([mostrarPestana(pestanaDeHash(window.location.hash)), resumen]);
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
  porId('btn-cargar-licencia').addEventListener('click', (evento) => abrirLicencia({ volverA: evento.currentTarget }));
  porId('btn-cargar-horas').addEventListener('click', (evento) => abrirHorasExtras({ volverA: evento.currentTarget }));
  conectarFormularios();
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
  if (pagina.pestana === 'resumen') {
    if (pagina.resumen === null && !pagina.cargandoResumen) return cargarResumen();
    llenarTanques();
  }
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
// mensaje; con ella y sin el saldo inicial, invita a completar «Mis vacaciones y saldos» y lo abre solo (una vez); si no,
// «Niveles», con la marca en la pestaña si algo vence pronto. Si falla, volver a la pestaña lo pide otra vez
async function cargarResumen() {
  const pedido = ++pagina.pedidos.resumen;
  pagina.cargandoResumen = true;
  try {
    const { data } = await API.pedirJson('GET', '/mi-espacio/resumen');
    if (pedido !== pagina.pedidos.resumen) return;
    pagina.resumen = esObjeto(data) ? data : {};
    pintarResumen();
  } catch (error) {
    if (pedido !== pagina.pedidos.resumen) return;
    if (error?.status === 401) irAlLogin();
    else {
      pagina.resumen = null;
      mostrarFalla('vista-resumen', 'No se pudo cargar el resumen. Probá de nuevo en unos minutos.');
    }
  } finally {
    if (pedido === pagina.pedidos.resumen) pagina.cargandoResumen = false;
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
  // La primera vez, sin el saldo inicial, «Mis vacaciones y saldos» se abre solo (el foco vuelve a su botón del Resumen)
  if (conModalidad && resumen.abrir_saldos === true && !pagina.saldosAbiertosSolos && pagina.modales.length === 0) {
    pagina.saldosAbiertosSolos = true;
    abrirSaldos(vista.querySelector('[data-abrir="saldos"]'));
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

// Un clic en el Resumen: «Mis vacaciones y saldos» y los botones de «Vence pronto» abren su formulario (el de licencia, con su
// tipo); un tanque abre su pestaña y el foco va a la pestaña (con Ctrl, Cmd, Mayúsculas, Alt o un botón que no es el principal, el
// link hace lo suyo: otra pestaña del navegador)
function alTocarResumen(evento) {
  const saldos = evento.target?.closest?.('[data-abrir="saldos"]');
  if (saldos) {
    abrirSaldos(saldos);
    return;
  }
  const accion = evento.target?.closest?.('[data-accion="cargar-licencia"]');
  if (accion) {
    abrirLicencia({ tipo: accion.dataset.tipo, volverA: accion });
    return;
  }
  const tanque = evento.target?.closest?.('[data-pestana]');
  if (!tanque || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey || (evento.button ?? 0) !== 0) return;
  evento.preventDefault?.();
  mostrarPestana(tanque.dataset.pestana);
  porId(`tab-${pagina.pestana}`).focus();
}

// ---- Licencias ----

// Pide las licencias de un año (null: el en curso). Al elegir un año, se anuncia el título de la tarjeta (`conAnuncio`: después de
// guardar, no; ahí se anuncia lo que se guardó). Si falla, la pestaña lo dice y queda sin lista: volver a ella la pide otra vez (la
// del año en curso). Devuelve si dibujó la lista (una respuesta vieja o una falla, no)
async function cargarLicencias(anio, { conAnuncio = true } = {}) {
  const pedido = ++pagina.pedidos.licencias;
  try {
    const { data } = await API.pedirJson('GET', Number.isInteger(anio) ? `/mi-espacio/licencias?anio=${anio}` : '/mi-espacio/licencias');
    if (pedido !== pagina.pedidos.licencias) return false;
    pagina.licencias = esObjeto(data) ? data : {};
    pintarLicencias();
    if (conAnuncio && Number.isInteger(anio) && Number.isInteger(pagina.licencias.anio)) anunciar(`Mis licencias de ${pagina.licencias.anio}`);
    return true;
  } catch (error) {
    if (pedido !== pagina.pedidos.licencias) return false;
    if (error?.status === 401) irAlLogin();
    else {
      pagina.licencias = null;
      mostrarFalla('vista-licencias', 'No se pudieron cargar tus licencias. Probá de nuevo en unos minutos.', conAnuncio);
    }
    return false;
  }
}

function pintarLicencias() {
  porId('vista-licencias').innerHTML = htmlDeListaDeLicencias(pagina.licencias, pagina.filtro);
}

// Un clic en la pestaña: «Cargar licencia», «Editar» de una fila, «Cambiar» el saldo inicial, un año del selector (el elegido no
// pide nada) o un filtro (dibuja sin pedir nada)
async function alTocarLicencias(evento) {
  const objetivo = evento.target;
  if (objetivo?.closest?.('[data-cargar="licencia"]')) {
    abrirLicencia({ volverA: objetivo.closest('[data-cargar="licencia"]') });
    return;
  }
  const editar = objetivo?.closest?.('[data-editar-licencia]');
  if (editar) {
    const fila = listaDe(pagina.licencias?.licencias).find((una) => String(una.id) === editar.dataset.editarLicencia);
    if (fila) abrirLicencia({ fila, volverA: editar });
    return;
  }
  const saldos = objetivo?.closest?.('[data-abrir="saldos"]');
  if (saldos) {
    abrirSaldos(saldos);
    return;
  }
  const anio = objetivo?.closest?.('[data-anio]');
  if (anio) {
    if (anio.getAttribute('aria-pressed') === 'true') return;
    if (await cargarLicencias(Number(anio.dataset.anio))) enfocar('vista-licencias', 'data-anio', anio.dataset.anio);
    return;
  }
  const filtro = objetivo?.closest?.('[data-filtro-licencia]');
  if (filtro) {
    pagina.filtro = filtro.dataset.filtroLicencia;
    pintarLicencias();
    enfocar('vista-licencias', 'data-filtro-licencia', pagina.filtro);
  }
}

// ---- Horas extras ----

// Pide las horas extras de un año (null: el en curso); el día por día vuelve al mes de entrada o, con `mes` (la recarga después
// de guardar), sigue en ese mes si está en la tabla. Si falla, como las licencias: volver a la pestaña la pide otra vez.
// Devuelve si dibujó la pestaña
async function cargarHorasExtras(anio, { conAnuncio = true, mes = null } = {}) {
  const pedido = ++pagina.pedidos.horas;
  try {
    const { data } = await API.pedirJson('GET', Number.isInteger(anio) ? `/mi-espacio/horas-extras?anio=${anio}` : '/mi-espacio/horas-extras');
    if (pedido !== pagina.pedidos.horas) return false;
    pagina.horas = esObjeto(data) ? data : {};
    pagina.mes = mesDeLaTabla(pagina.horas, mes);
    pintarHoras();
    if (conAnuncio && Number.isInteger(anio) && Number.isInteger(pagina.horas.anio)) anunciar(`Horas extras de ${pagina.horas.anio}`);
    return true;
  } catch (error) {
    if (pedido !== pagina.pedidos.horas) return false;
    if (error?.status === 401) irAlLogin();
    else {
      pagina.horas = null;
      pagina.mes = null;
      mostrarFalla('vista-horas', 'No se pudieron cargar tus horas extras. Probá de nuevo en unos minutos.', conAnuncio);
    }
    return false;
  }
}

function pintarHoras() {
  porId('vista-horas').innerHTML = htmlDeHorasExtras(pagina.horas, pagina.mes);
}

// Un clic en la pestaña: «Cargar horas extras», «Editar» de un día, «Registrar un uso autorizado», un año del selector o un mes de
// la tabla (cambia el día por día sin pedir nada)
async function alTocarHoras(evento) {
  const objetivo = evento.target;
  if (objetivo?.closest?.('[data-cargar="horas"]')) {
    abrirHorasExtras({ volverA: objetivo.closest('[data-cargar="horas"]') });
    return;
  }
  const editar = objetivo?.closest?.('[data-editar-horas]');
  if (editar) {
    const dia = Object.values(esObjeto(pagina.horas?.dias_por_mes) ? pagina.horas.dias_por_mes : {}).flatMap(listaDe)
      .find((uno) => String(uno.id) === editar.dataset.editarHoras);
    if (dia) abrirHorasExtras({ dia, volverA: editar });
    return;
  }
  const uso = objetivo?.closest?.('[data-abrir="uso"]');
  if (uso) {
    abrirUso({ volverA: uso });
    return;
  }
  const anio = objetivo?.closest?.('[data-anio]');
  if (anio) {
    if (anio.getAttribute('aria-pressed') === 'true') return;
    if (await cargarHorasExtras(Number(anio.dataset.anio))) enfocar('vista-horas', 'data-anio', anio.dataset.anio);
    return;
  }
  const mes = objetivo?.closest?.('[data-mes]');
  if (mes) {
    pagina.mes = mes.dataset.mes;
    pintarHoras();
    enfocar('vista-horas', 'data-mes', pagina.mes);
  }
}

// =====================================================
// Los formularios (DOM y API)
// =====================================================

// La espera entre el último cambio y el pedido del cálculo, y la del velo antes de poner el foco (hasta que termina su transición,
// no deja enfocar)
const ESPERA_DEL_CALCULO = 300;
const ESPERA_DEL_VELO = 100;

// Cada formulario: su modal, el prefijo de sus ids (el error sin campo es <prefijo>-error) y el control de cada campo de los errores
// del servidor
const FORMULARIOS = Object.freeze({
  licencia: {
    modal: 'modal-licencia', prefijo: 'ml',
    campos: {
      tipo: 'ml-tipos', desde: 'ml-desde', hasta: 'ml-hasta', horas: 'ml-horas', nota: 'ml-nota', autorizado_id: 'ml-autorizado'
    }
  },
  uso: {
    modal: 'modal-uso', prefijo: 'mu',
    campos: { desde: 'mu-fecha', hasta: 'mu-fecha', horas: 'mu-horas', nota: 'mu-nota' }
  },
  horasExtras: {
    modal: 'modal-horas', prefijo: 'mh', campos: { fecha: 'mh-fecha', desde: 'mh-desde', hasta: 'mh-hasta', nota: 'mh-nota' }
  },
  saldos: { modal: 'modal-saldos', prefijo: 'ms', campos: { dias_vacaciones: 'ms-dias', estudios: 'ms-estudios' } },
  confirmar: { modal: 'modal-confirmar', prefijo: 'mc', campos: {} }
});

// La modalidad de la persona ('planta', 'contrato' o null), la del Resumen
const modalidadActual = () => pagina.resumen?.modalidad?.clave ?? pagina.horas?.modalidad ?? null;
const anioDeHoy = () => Number(Utils.hoyEnArgentina().slice(0, 4));

function conectarFormularios() {
  for (const { modal } of Object.values(FORMULARIOS)) {
    // Cierran la × y «Cancelar» (data-cerrar), si es el de arriba y no está guardando; un clic en el velo, nunca
    porId(modal).addEventListener('click', (evento) => {
      if (evento.target?.closest?.('[data-cerrar]') && pagina.modales.at(-1)?.id === modal && !estaOcupado(modal)) cerrarModal(modal);
    });
  }
  document.addEventListener('keydown', alApretarUnaTecla);

  porId('ml-tipos').addEventListener('change', (evento) => {
    if (evento.target?.name !== 'ml-tipo' || !pagina.formulario) return;
    pagina.formulario.tipo = evento.target.value;
    pintarCamposDelTipo();
    programarCalculo();
  });
  for (const id of ['ml-desde', 'ml-hasta', 'mu-fecha']) {
    porId(id).addEventListener('input', programarCalculo);
    porId(id).addEventListener('change', programarCalculo);
  }
  for (const id of ['ml-horas', 'mu-horas']) {
    porId(id).addEventListener('change', () => {
      pintarMostrar();
      programarCalculo();
    });
  }
  porId('ml-autorizado').addEventListener('change', () => { if (pagina.formulario) pintarPaso(pagina.formulario); });
  for (const nombre of ['licencia', 'uso']) {
    const { prefijo } = FORMULARIOS[nombre];
    porId(`${prefijo}-guardar`).addEventListener('click', () => guardarLicencia(nombre));
    porId(`${prefijo}-borrar`).addEventListener('click', () => pedirBorrarLicencia(nombre));
  }

  for (const id of ['mh-fecha', 'mh-desde', 'mh-hasta']) {
    porId(id).addEventListener('input', actualizarLaSuma);
    porId(id).addEventListener('change', actualizarLaSuma);
  }
  porId('mh-guardar').addEventListener('click', guardarHorasExtras);
  porId('mh-borrar').addEventListener('click', pedirBorrarHorasExtras);

  porId('ms-dias').addEventListener('change', alElegirEnLosSaldos);
  porId('ms-estudios').addEventListener('change', alElegirEnLosSaldos);
  porId('ms-guardar').addEventListener('click', guardarSaldos);

  porId('modal-confirmar-si').addEventListener('click', confirmarElBorrado);
}

// ---- Los modales ----

// Abre un modal sobre los que ya están: el foco va a `foco()` después de la transición del velo y, al cerrarlo, vuelve a `volverA`
// (el botón que lo abrió); `alCerrar` limpia lo del formulario
function abrirModal(id, { volverA = null, foco = null, alCerrar = null } = {}) {
  const sesion = { id, volverA, alCerrar };
  pagina.modales.push(sesion);
  porId(id).classList.add('active');
  setTimeout(() => {
    if (pagina.modales.at(-1) === sesion) foco?.()?.focus?.();
  }, ESPERA_DEL_VELO);
}

function cerrarModal(id) {
  const lugar = pagina.modales.findIndex((sesion) => sesion.id === id);
  if (lugar === -1) return;
  const [sesion] = pagina.modales.splice(lugar, 1);
  porId(id).classList.remove('active');
  sesion.alCerrar?.();
  if (sesion.volverA && sesion.volverA.isConnected !== false) sesion.volverA.focus?.();
}

// Mientras se guarda o se borra, su modal no se cierra (ni con Escape, ni con la ×, ni con «Cancelar»)
function estaOcupado(modal) {
  if (modal === 'modal-confirmar') return pagina.confirmacion?.ocupado === true;
  if (modal === 'modal-horas') return pagina.horasExtras?.guardando === true;
  if (modal === 'modal-saldos') return pagina.saldos?.guardando === true;
  return pagina.formulario?.guardando === true && FORMULARIOS[pagina.formulario.nombre].modal === modal;
}

// Escape cierra el modal de arriba: primero la confirmación, después el formulario
function alApretarUnaTecla(evento) {
  if (evento.key !== 'Escape' || pagina.modales.length === 0) return;
  const arriba = pagina.modales.at(-1).id;
  evento.preventDefault?.();
  if (!estaOcupado(arriba)) cerrarModal(arriba);
}

// ---- Los errores ----

// Un grupo de opciones: el fieldset de unos radios (ml-tipos, ms-dias, ms-estudios)
const esGrupoDeOpciones = (control) => String(control?.tagName).toLowerCase() === 'fieldset';

// Si un control está dentro de algo oculto (un grupo con hidden, como el «Hasta» de los tipos de un día): su error no se vería
const estaOculto = (control) => {
  for (let nodo = control; typeof nodo?.tagName === 'string'; nodo = nodo.parentNode) if (nodo.hidden === true) return true;
  return false;
};

// Muestra (o saca, con null) el error de un campo: su párrafo (<id>-error) y aria-invalid en el control. En un grupo de opciones,
// aria-invalid va en cada radio (en un fieldset no vale: ARIA 1.2), que ya lo describe con aria-describedby. false si el control
// no está o, al poner un error, si está oculto (quien llama lo dice arriba del modal)
function ponerError(id, mensaje) {
  const control = id ? porId(id) : null;
  if (!control || (mensaje && estaOculto(control))) return false;
  const parrafo = porId(`${id}-error`);
  if (parrafo) {
    parrafo.textContent = mensaje ?? '';
    parrafo.hidden = !mensaje;
  }
  for (const marcado of esGrupoDeOpciones(control) ? control.querySelectorAll('input') : [control]) {
    if (mensaje) marcado.setAttribute('aria-invalid', 'true');
    else marcado.removeAttribute('aria-invalid');
  }
  return true;
}

// El control que recibe el foco de un campo: en un grupo de opciones, la elegida o la primera
function controlDeFoco(id) {
  const control = porId(id);
  if (esGrupoDeOpciones(control)) return control.querySelector('input:checked') ?? control.querySelector('input') ?? control;
  return control;
}

// El error sin campo, arriba del cuerpo del modal (nunca detrás del velo)
function avisoDelModal(nombre, mensaje) {
  const aviso = porId(`${FORMULARIOS[nombre].prefijo}-error`);
  aviso.textContent = mensaje ?? '';
  aviso.hidden = !mensaje;
  if (mensaje) aviso.scrollIntoView?.({ block: 'nearest' });
}

// Los controles con error de un formulario: los de sus campos y, en «Mis vacaciones y saldos», los de «Para arrancar»
const controlesDe = (nombre) => [...new Set(Object.values(FORMULARIOS[nombre].campos)),
  ...(nombre === 'saldos' ? [...porId('ms-campos').querySelectorAll('[data-saldo]')].map((campo) => campo.id) : [])];

function limpiarErrores(nombre) {
  for (const id of controlesDe(nombre)) ponerError(id, null);
  avisoDelModal(nombre, '');
}

// Los errores (`[[id del control, mensaje]]`), todos juntos (los demás campos quedan limpios), y el foco al primero. Uno sin un
// control a la vista va arriba del modal. true si hubo
function mostrarErrores(nombre, errores) {
  limpiarErrores(nombre);
  const conControl = errores.filter(([id, mensaje]) => ponerError(id, mensaje));
  const sinControl = errores.filter((error) => !conControl.includes(error));
  if (sinControl.length > 0) avisoDelModal(nombre, sinControl.map(([, mensaje]) => mensaje).join(' '));
  if (conControl.length > 0) controlDeFoco(conControl[0][0])?.focus?.();
  return errores.length > 0;
}

// Los errores de un formulario por campo (`{ campo: mensaje }`) con su control
const conSusControles = (nombre, errores) => Object.entries(errores)
  .map(([campo, mensaje]) => [deMapa(FORMULARIOS[nombre].campos, campo, null), mensaje]);

// Un pedido que no llegó al servidor: API.pedirJson tira el error del navegador («Failed to fetch»), sin status y en inglés
const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor. Probá de nuevo en unos minutos.';
const MENSAJE_NO_SE_GUARDO = 'No se pudo guardar. Probá de nuevo en unos minutos.';
const MENSAJE_NO_SE_BORRO = 'No se pudo borrar. Probá de nuevo en unos minutos.';

// Lo que se dice de una falla: el mensaje del servidor; sin respuesta (sin status), MENSAJE_SIN_CONEXION; sin mensaje, `sinMensaje`
const motivoDeLaFalla = (falla, sinMensaje) => {
  if (!falla?.status) return MENSAJE_SIN_CONEXION;
  return conTexto(falla.message) ? falla.message : sinMensaje;
};

// Un error del servidor al guardar: con un campo del formulario a la vista, en ese campo y con el foco ahí; sin campo (o uno que
// no es del formulario o está oculto, o sin respuesta), arriba del modal, con el foco en el botón (quien llama lo habilita antes:
// uno deshabilitado no recibe el foco)
function mostrarFallaDelServidor(nombre, falla, boton) {
  limpiarErrores(nombre);
  const mensaje = motivoDeLaFalla(falla, MENSAJE_NO_SE_GUARDO);
  const id = deMapa(FORMULARIOS[nombre].campos, falla?.campo, null);
  if (ponerError(id, mensaje)) {
    controlDeFoco(id)?.focus?.();
    return;
  }
  avisoDelModal(nombre, mensaje);
  boton.focus?.();
}

// Las pestañas que se vuelven a dibujar después de guardar o de borrar, y lo que identifica a un control que abre un modal, en este
// orden: el «Editar» de una fila (por su id), «Mis vacaciones y saldos», «Cambiar» o «Registrar un uso autorizado», «Cargar
// licencia» o «Cargar horas extras» de una tarjeta y un botón de «Vence pronto» (por su tipo)
const VISTAS_QUE_SE_DIBUJAN = Object.freeze(['vista-resumen', 'vista-licencias', 'vista-horas']);
const IDENTIDADES_DEL_FOCO = Object.freeze(['data-editar-licencia', 'data-editar-horas', 'data-abrir', 'data-cargar', 'data-tipo']);

const identidadDe = (control) => {
  const atributo = IDENTIDADES_DEL_FOCO.find((uno) => typeof control?.getAttribute?.(uno) === 'string');
  return atributo ? { atributo, valor: control.getAttribute(atributo) } : null;
};

/**
 * Adónde va el foco cuando se vuelve a dibujar la pestaña del control que lo tiene (el botón que abrió el modal, al que cerrarModal
 * lo devolvió y que la recarga reemplaza), como respaldoDeLaEliminacion de proyectos.js: `{ vista, candidatos }`, del preferido al
 * último, o null si el control no está en una pestaña (los del encabezado no se vuelven a dibujar) o no abre un modal. Los
 * candidatos: el mismo control (el «Editar» de la misma fila), los de su misma lista (el que seguía, después el anterior: la fila
 * se borró), el título de su panel (por su texto), el primer título de la pestaña y la pestaña misma.
 */
function respaldoDelFoco(control) {
  const vista = VISTAS_QUE_SE_DIBUJAN.find((id) => porId(id)?.contains?.(control));
  const propia = identidadDe(control);
  if (!vista || propia === null) return null;
  const lista = control.closest('li')?.parentNode;
  const botones = lista ? [...lista.querySelectorAll('button')] : [];
  const lugar = botones.indexOf(control);
  const vecinos = lugar === -1 ? [] : [...botones.slice(lugar + 1), ...botones.slice(0, lugar).reverse()];
  const panel = control.closest('.me-tarjeta') ?? control.closest('section');
  const titulo = panel?.querySelector('h2') ?? panel?.querySelector('h3');
  return {
    vista,
    candidatos: [propia, ...vecinos.map(identidadDe).filter((identidad) => identidad !== null),
      ...(titulo ? [{ titulo: titulo.textContent }] : []), { primerTitulo: true }, { pestana: true }]
  };
}

// El control de la pestaña que corresponde a un candidato de respaldoDelFoco, o null
function controlDelCandidato(vista, candidato) {
  if (candidato.atributo) {
    const control = controlCon(vista, candidato.atributo, candidato.valor);
    return control && !control.disabled ? control : null;
  }
  const titulos = [...porId(vista).querySelectorAll('h2'), ...porId(vista).querySelectorAll('h3')];
  if (candidato.titulo !== undefined) return titulos.find((uno) => uno.textContent === candidato.titulo) ?? null;
  if (candidato.primerTitulo) return titulos[0] ?? null;
  return porId(`tab-${vista.slice('vista-'.length)}`);
}

// Si el foco se perdió (el control que lo tenía ya no está: quedó en <body>), va al primer candidato que está. Un título recibe el
// foco con tabindex="-1". Con un modal abierto, o si el foco ya está en otro lado, no se toca
function devolverElFoco(respaldo) {
  if (respaldo === null || pagina.modales.length > 0) return;
  const activo = document.activeElement;
  if (activo && activo !== document.body && activo.isConnected !== false) return;
  for (const candidato of respaldo.candidatos) {
    const control = controlDelCandidato(respaldo.vista, candidato);
    if (!control) continue;
    if (/^h[23]$/.test(String(control.tagName).toLowerCase())) control.setAttribute('tabindex', '-1');
    control.focus?.();
    return;
  }
}

// Después de guardar o de borrar: el Resumen y las pestañas que ya se cargaron (la que se ve, enseguida y con el año que tenía
// y, en Horas extras, el mes del día por día, sin anunciarlo: se anuncia lo que se guardó; las otras, cuando se vuelvan a abrir).
// El foco, que cerrarModal devolvió al botón que abrió el modal, va a su equivalente cuando terminan (respaldoDelFoco: la recarga
// reemplazó el botón)
async function volverAPedirTodo() {
  const respaldo = respaldoDelFoco(document.activeElement);
  const cargas = [cargarResumen()];
  const anioQueTenia = (datos) => (Number.isInteger(datos.anio) && datos.anio !== anioDeHoy() ? datos.anio : null);
  if (pagina.licencias !== null) {
    if (pagina.pestana === 'licencias') cargas.push(cargarLicencias(anioQueTenia(pagina.licencias), { conAnuncio: false }));
    else pagina.licencias = null;
  }
  if (pagina.horas !== null) {
    if (pagina.pestana === 'horas') {
      cargas.push(cargarHorasExtras(anioQueTenia(pagina.horas), { conAnuncio: false, mes: pagina.mes }));
    } else pagina.horas = null;
  }
  await Promise.all(cargas);
  devolverElFoco(respaldo);
}

// Lo que dice el servidor al guardar: el mensaje y sus avisos (por ejemplo, que una corrección ya no se copia a Configuración)
const textoDeLaRespuesta = (respuesta) => [respuesta?.message, ...(Array.isArray(respuesta?.avisos) ? respuesta.avisos : [])]
  .filter(conTexto).join(' ');
// …en un aviso de la página: de éxito o, con avisos, de advertencia
const avisarLaRespuesta = (respuesta) => avisarMiEspacio(textoDeLaRespuesta(respuesta),
  Array.isArray(respuesta?.avisos) && respuesta.avisos.some(conTexto) ? 'warning' : 'success');

// Un 404 (lo que se corregía o se borraba ya no está): se cierra el formulario, se avisa y se vuelve a pedir todo
function noEstaMas(modal, falla) {
  cerrarModal(modal);
  avisarMiEspacio(falla?.message, 'error');
  volverAPedirTodo();
}

// Los formularios necesitan el Resumen (los tipos de «Cargar licencia» y si falta el saldo inicial): si todavía no llegó, o
// falló, se pide antes de abrir; si no llega, se avisa. true si se puede abrir (si mientras tanto se abrió otro modal, no)
async function hayResumen() {
  if (pagina.resumen !== null) return true;
  await cargarResumen();
  if (pagina.resumen === null) {
    avisarMiEspacio(MENSAJE_SIN_RESUMEN, 'error');
    return false;
  }
  return pagina.modales.length === 0;
}

// ---- «Cargar licencia» y «Registrar un uso autorizado» ----

// Abre «Cargar licencia»: nueva (con el `tipo` de «Vence pronto») o la corrección de una fila de la lista. El uso autorizado tiene su
// formulario. Sin el saldo inicial no se puede cargar nada: abre «Mis vacaciones y saldos»
async function abrirLicencia({ fila = null, tipo = null, volverA = null } = {}) {
  if (pagina.resumen === null && !(await hayResumen())) return;
  if (pagina.resumen?.abrir_saldos === true) {
    abrirSaldos(volverA);
    return;
  }
  if (fila?.tipo === 'uso_autorizado') {
    abrirUso({ fila, volverA });
    return;
  }
  const valores = valoresDeLicencia(fila, tipo);
  // El tipo de la fila, aunque ya no esté entre los de la modalidad (o con «No estudio»): se ve elegido
  const tipos = listaDe(pagina.resumen?.tipos);
  const opciones = fila && !tipos.some((opcion) => opcion.tipo === valores.tipo)
    ? [...tipos, { tipo: valores.tipo, nombre: fila.tipo_nombre, queda_texto: '' }] : tipos;
  porId('modal-licencia-titulo').textContent = fila ? `Corregir la licencia del ${comoTexto(fila.fechas_texto)}` : 'Cargar licencia';
  porId('ml-tipos-opciones').innerHTML = htmlDeTiposDeLicencia(opciones, valores.tipo);
  porId('ml-desde').value = valores.desde;
  porId('ml-hasta').value = valores.hasta;
  porId('ml-horas').value = valores.horas;
  porId('ml-grupo-autorizado').hidden = true;
  // Una creada que ya empezó o que ya terminó: lo que se puede cambiar de sus fechas (lo controla el servidor; el desde no se
  // bloquea, así se puede volver a las fechas de Configuración)
  const fechas = porId('ml-fechas-ayuda');
  fechas.textContent = fila?.fechas_fijas === true ? MENSAJES_FORMULARIOS.fechasFijas
    : (fila?.solo_hasta === true ? MENSAJES_FORMULARIOS.soloHasta : '');
  fechas.hidden = fechas.textContent === '';
  iniciarFormulario('licencia', { fila, valores });
  pintarCamposDelTipo();
  abrirModal('modal-licencia', { volverA, foco: () => controlDeFoco('ml-tipos'), alCerrar: cerrarFormulario });
  if (Object.keys(erroresDeLicencia(valores, { modalidad: modalidadActual() })).length === 0) programarCalculo();
}

// Abre «Registrar un uso autorizado» (nuevo, o la corrección de una fila): la fecha y, en contrato, las horas
async function abrirUso({ fila = null, volverA = null } = {}) {
  if (pagina.resumen === null && !(await hayResumen())) return;
  if (pagina.resumen?.abrir_saldos === true) {
    abrirSaldos(volverA);
    return;
  }
  const valores = valoresDeLicencia(fila, 'uso_autorizado');
  porId('modal-uso-titulo').textContent = fila ? `Corregir el uso autorizado del ${comoTexto(fila.fechas_texto)}`
    : 'Registrar un uso autorizado';
  porId('mu-fecha').value = valores.desde;
  const enHoras = horasDelTipo('uso_autorizado', modalidadActual());
  porId('mu-grupo-horas').hidden = enHoras === null;
  porId('mu-horas').innerHTML = enHoras === null ? '' : htmlDeOpcionesDeHoras(enHoras, valores.horas);
  porId('mu-horas').value = enHoras === null ? '' : valores.horas;
  iniciarFormulario('uso', { fila, valores });
  abrirModal('modal-uso', { volverA, foco: () => porId('mu-fecha'), alCerrar: cerrarFormulario });
  if (Object.keys(erroresDeLicencia(valores, { modalidad: modalidadActual() })).length === 0) programarCalculo();
}

// Lo común de los dos: el estado del formulario (el pedido del cálculo numera cada uno: una respuesta vieja se descarta;
// `esperando`, hay uno programado o en vuelo, y «Guardar» espera su respuesta; `sinCalculo`, el último no llegó, y «Guardar» lo
// vuelve a pedir en lugar de guardar), la nota, «Mostrar a mis compañeros», «Borrar» (o por qué no se puede) y lo que dice el
// cálculo, vacío hasta que llega
function iniciarFormulario(nombre, { fila, valores }) {
  const { prefijo } = FORMULARIOS[nombre];
  cerrarFormulario();
  pagina.formulario = {
    nombre, fila, valores, tipo: valores.tipo, paso: null, pedido: 0, esperando: false, sinCalculo: false, temporizador: null,
    guardando: false, pedidoSinAuditor: 0, firmante: null, autorizadoListo: false
  };
  limpiarErrores(nombre);
  porId(`${prefijo}-nota`).value = valores.nota;
  porId(`${prefijo}-mostrar`).checked = valores.mostrar;
  pintarMostrar();
  const quien = comoTexto(pagina.resumen?.persona?.nombre);
  porId(`${prefijo}-mostrar-ayuda`).textContent = `Ven «${quien} no está», sin el tipo de licencia.`;
  porId(`${prefijo}-borrar`).hidden = !(fila && fila.puede_borrar !== false);
  const pie = porId(`${prefijo}-pie`);
  pie.textContent = fila && fila.puede_borrar === false ? MENSAJES_FORMULARIOS.yaEmpezo : '';
  pie.hidden = pie.textContent === '';
  for (const caja of [`${prefijo}-calculo`, `${prefijo}-paso`, `${prefijo}-sin-auditor`]) {
    porId(caja).innerHTML = '';
    porId(caja).hidden = true;
  }
  porId(`${prefijo}-guardar`).disabled = false;
}

// Al cerrar el formulario, lo que esperaba se descarta
function cerrarFormulario() {
  clearTimeout(pagina.formulario?.temporizador);
  pagina.formulario = null;
}

// Los campos del tipo elegido: «Desde» y «Hasta, inclusive», o «Fecha» en los de un día, y las horas en los que van por horas
function pintarCamposDelTipo() {
  const { tipo, valores } = pagina.formulario;
  const unDia = deUnDia(tipo);
  porId('ml-desde-rotulo').textContent = unDia ? 'Fecha' : 'Desde';
  porId('ml-grupo-hasta').hidden = unDia;
  const enHoras = horasDelTipo(tipo, modalidadActual());
  porId('ml-grupo-horas').hidden = enHoras === null;
  if (enHoras !== null) {
    const elegidas = porId('ml-horas').value || valores.horas;
    porId('ml-horas').innerHTML = htmlDeOpcionesDeHoras(enHoras, elegidas);
    porId('ml-horas').value = elegidas;
  }
  pintarMostrar();
}

// «Mostrar a mis compañeros»: solo para administración (los compañeros son administración) y solo en una licencia de día
// entero (esDeDiaEntero): una franquicia o unas horas de menos de 7 horas no se les muestran nunca (spec, sección 7). Oculta,
// no se lee: viaja lo que tenía
function pintarMostrar() {
  const formulario = pagina.formulario;
  if (!formulario) return;
  const { prefijo } = FORMULARIOS[formulario.nombre];
  const horas = porId(`${prefijo}-grupo-horas`).hidden ? '' : porId(`${prefijo}-horas`).value;
  porId(`${prefijo}-grupo-mostrar`).hidden = pagina.resumen?.persona?.ve_companeros !== true
    || !esDeDiaEntero(formulario.tipo, horas, modalidadActual());
}

// Lo que dice el formulario abierto, como lo lee valoresDeLicencia
function valoresDelFormulario(formulario) {
  const { nombre, valores, tipo } = formulario;
  const { prefijo } = FORMULARIOS[nombre];
  const desde = porId(nombre === 'licencia' ? 'ml-desde' : 'mu-fecha').value;
  const grupoDeHoras = porId(`${prefijo}-grupo-horas`);
  const leidos = {
    ...valores, tipo, desde,
    hasta: nombre === 'licencia' && !deUnDia(tipo) ? porId('ml-hasta').value : desde,
    horas: grupoDeHoras.hidden ? '' : porId(`${prefijo}-horas`).value,
    nota: porId(`${prefijo}-nota`).value
  };
  if (!porId(`${prefijo}-grupo-mostrar`).hidden) leidos.mostrar = porId(`${prefijo}-mostrar`).checked;
  if (nombre === 'licencia' && !porId('ml-grupo-autorizado').hidden) leidos.autorizado = porId('ml-autorizado').value;
  return leidos;
}

// Si el campo «Autorizo a…» está a la vista: el firmante titular, en unas vacaciones que pasan a Configuración
const conPersonaACargo = (formulario) => formulario.nombre === 'licencia' && !porId('ml-grupo-autorizado').hidden;

// Cada cambio pide el cálculo 300 ms después del último; mientras, «Guardar» espera
function programarCalculo() {
  const formulario = pagina.formulario;
  if (!formulario) return;
  clearTimeout(formulario.temporizador);
  formulario.pedido += 1;
  formulario.esperando = true;
  porId(`${FORMULARIOS[formulario.nombre].prefijo}-guardar`).disabled = true;
  formulario.temporizador = setTimeout(() => pedirCalculo(formulario), ESPERA_DEL_CALCULO);
}

// Pide el cálculo enseguida, sin la espera (desde «Guardar», cuando el anterior no llegó): mientras, «Guardar» espera
function calcularYa(formulario) {
  clearTimeout(formulario.temporizador);
  formulario.esperando = true;
  porId(`${FORMULARIOS[formulario.nombre].prefijo}-guardar`).disabled = true;
  return pedirCalculo(formulario);
}

// El cálculo del servidor (POST /licencias/calculo, sin guardar nada): los días, de qué licencia salen, lo que queda, el error si
// no se puede guardar (en su campo, sin llevarse el foco) y el paso a Configuración. Sin el tipo y las fechas (o las horas) no hay
// nada que pedir. Una respuesta vieja (el formulario cambió o se cerró mientras) se descarta. Si no llega (un error del servidor
// o sin conexión), el formulario lo dice y queda `sinCalculo`: sin él no se ve qué pasa con Configuración
async function pedirCalculo(formulario) {
  if (pagina.formulario !== formulario) return;
  const pedido = ++formulario.pedido;
  const valores = valoresDelFormulario(formulario);
  const { tipo, desde, hasta, horas } = erroresDeLicencia(valores, { modalidad: modalidadActual() });
  let data = null;
  let falla = null;
  if (!tipo && !desde && !hasta && !horas) {
    const cuerpo = cuerpoDeLicencia(valores);
    if (valores.id !== null) cuerpo.id = valores.id;
    try {
      ({ data } = await API.pedirJson('POST', '/mi-espacio/licencias/calculo', cuerpo));
    } catch (error) {
      if (pagina.formulario !== formulario || pedido !== formulario.pedido) return;
      if (error?.status === 401) {
        irAlLogin();
        return;
      }
      falla = error ?? {};
    }
    if (pagina.formulario !== formulario || pedido !== formulario.pedido) return;
  }
  formulario.sinCalculo = falla !== null;
  await pintarCalculo(formulario, esObjeto(data) ? data : null, valores, falla);
  if (pagina.formulario !== formulario || pedido !== formulario.pedido) return;
  formulario.esperando = false;
  porId(`${FORMULARIOS[formulario.nombre].prefijo}-guardar`).disabled = formulario.guardando;
}

async function pintarCalculo(formulario, data, valores, falla = null) {
  const { nombre } = formulario;
  const { prefijo } = FORMULARIOS[nombre];
  formulario.paso = esObjeto(data?.paso) ? data.paso : null;
  limpiarErrores(nombre);
  if (falla !== null) avisoDelModal(nombre, textoSinCalculo(falla));
  if (esObjeto(data?.error) && conTexto(data.error.mensaje)) {
    if (!ponerError(deMapa(FORMULARIOS[nombre].campos, data.error.campo, null), data.error.mensaje)) {
      avisoDelModal(nombre, data.error.mensaje);
    }
  }
  const calculo = porId(`${prefijo}-calculo`);
  calculo.innerHTML = htmlDelCalculo(data, valores.tipo);
  calculo.hidden = calculo.innerHTML === '';
  if (nombre === 'licencia') await prepararPersonaACargo(formulario);
  if (pagina.formulario !== formulario) return;
  pintarPaso(formulario);
  actualizarSinAuditor(formulario, valores);
}

// El campo «Autorizo a presentar las notas en mi nombre a:» (spec, sección 6): solo cuando el paso pasa y el firmante titular
// carga vacaciones, con las personas de GET /mi-espacio/firmante. Viene vacío; al corregir, con la persona a cargo que ya tiene
// (y, si ya no cumple las condiciones, igual elegida: si no, guardar otro cambio la quitaría)
async function prepararPersonaACargo(formulario) {
  const grupo = porId('ml-grupo-autorizado');
  const paso = formulario.paso;
  if (!(paso?.pasa === true && paso.firmante?.puede_autorizar === true)) {
    grupo.hidden = true;
    return;
  }
  const firmante = await datosDelFirmante();
  if (pagina.formulario !== formulario) return;
  if (firmante.soy_titular !== true) {
    grupo.hidden = true;
    return;
  }
  formulario.firmante = firmante;
  if (!formulario.autorizadoListo) {
    const actual = formulario.valores.autorizado;
    const personas = listaDe(firmante.autorizables).map((persona) => ({ id: String(persona.id), nombre: persona.nombre_completo }));
    if (conTexto(actual) && !personas.some((persona) => persona.id === actual)) {
      personas.push({ id: actual, nombre: 'Otro usuario (ya no cumple las condiciones)' });
    }
    porId('ml-autorizado').innerHTML = htmlDeAutorizables(personas);
    porId('ml-autorizado').value = actual;
    formulario.autorizadoListo = true;
  }
  grupo.hidden = false;
}

// GET /mi-espacio/firmante, una sola vez (si falla, se vuelve a pedir la próxima)
function datosDelFirmante() {
  pagina.firmante ??= API.pedirJson('GET', '/mi-espacio/firmante').then(
    ({ data }) => (esObjeto(data) ? data : {}),
    (error) => {
      pagina.firmante = null;
      if (error?.status === 401) irAlLogin();
      return {};
    }
  );
  return pagina.firmante;
}

// El aviso del paso a Configuración: azul si pasa; si no, en ámbar, por qué. En las vacaciones del titular, con el efecto en las
// notas de la persona elegida y sus días de licencia, solo si se sabe quién queda a cargo: «Nadie» o una de la lista. Con el
// campo oculto al corregir (GET /mi-espacio/firmante falló: la persona que tenía se conserva) o con «Otro usuario (ya no cumple
// las condiciones)», «Sin persona autorizada…» sería falso y el efecto no va. En unas nuevas con el campo oculto, nadie queda a
// cargo (autorizado_id no viaja): ahí sí es cierto y va
function pintarPaso(formulario) {
  const caja = porId(`${FORMULARIOS[formulario.nombre].prefijo}-paso`);
  const valores = valoresDelFormulario(formulario);
  const conCampo = conPersonaACargo(formulario);
  const elegida = conCampo
    ? listaDe(formulario.firmante?.autorizables).find((persona) => String(persona.id) === valores.autorizado) : undefined;
  const nuevaSinCampo = !conCampo && formulario.nombre === 'licencia' && formulario.fila === null;
  caja.innerHTML = htmlDelPaso(formulario.paso, {
    autorizado: elegida?.nombre_completo ?? null, ausencias: elegida?.ausencias ?? [],
    hoy: formulario.firmante?.hoy ?? Utils.hoyEnArgentina(), desde: valores.desde, hasta: valores.hasta,
    conEfecto: nuevaSinCampo || (conCampo && (elegida !== undefined || !conTexto(valores.autorizado)))
  });
  caja.hidden = caja.innerHTML === '';
  caja.classList.toggle('azul', formulario.paso?.pasa === true);
  caja.classList.toggle('ambar', formulario.paso?.pasa !== true);
}

// Los días sin auditor de las fechas del formulario (GET /usuarios/licencias/sin-auditor, como en Configuración): solo para quien
// audita y solo si el paso pasa. Al corregir una creada, sin contar su licencia de Configuración (excluir). Solo avisa
async function actualizarSinAuditor(formulario, valores) {
  const caja = porId(`${FORMULARIOS[formulario.nombre].prefijo}-sin-auditor`);
  const pedido = ++formulario.pedidoSinAuditor;
  const parametros = formulario.paso?.pasa === true && Auth.isAuditor?.() === true ? parametrosSinAuditor({
    usuarioId: Auth.getUser?.()?.id, desde: valores.desde, hasta: valores.hasta, excluir: valores.licencia_oficial,
    hoy: Utils.hoyEnArgentina()
  }) : null;
  if (parametros === null) {
    caja.hidden = true;
    return;
  }
  let periodos = [];
  try {
    periodos = listaDe(await API.getSinAuditor(parametros));
  } catch { /* sin el dato no hay aviso */ }
  if (pagina.formulario !== formulario || pedido !== formulario.pedidoSinAuditor) return;
  caja.innerHTML = periodos.map((periodo) => `<p>${esc(textoSinAuditor(periodo))}</p>`).join('');
  caja.hidden = periodos.length === 0;
}

// «Guardar»: los errores del formulario antes de pedir nada; si el último cálculo no llegó, lo vuelve a pedir y no guarda (sin él
// no se vio qué pasa con Configuración); si no, POST o PUT. Mientras, «Guardar» queda deshabilitado (un doble clic manda un solo
// pedido). Al guardar, se cierra, se avisa lo que dijo el servidor y se vuelve a pedir todo
async function guardarLicencia(nombre) {
  const formulario = pagina.formulario;
  const boton = porId(`${FORMULARIOS[nombre].prefijo}-guardar`);
  if (formulario?.nombre !== nombre || formulario.guardando || formulario.esperando) return;
  const valores = valoresDelFormulario(formulario);
  if (mostrarErrores(nombre, conSusControles(nombre, erroresDeLicencia(valores, { modalidad: modalidadActual() })))) return;
  if (formulario.sinCalculo) {
    await calcularYa(formulario);
    // Mientras esperaba quedó deshabilitado: el foco vuelve a él
    if (pagina.formulario === formulario) boton.focus?.();
    return;
  }
  const cuerpo = cuerpoDeLicencia(valores, { soyTitular: conPersonaACargo(formulario) });
  formulario.guardando = true;
  boton.disabled = true;
  try {
    const respuesta = formulario.fila
      ? await API.pedirJson('PUT', `/mi-espacio/licencias/${encodeURIComponent(formulario.fila.id)}`, cuerpo)
      : await API.pedirJson('POST', '/mi-espacio/licencias', cuerpo);
    formulario.guardando = false;
    cerrarModal(FORMULARIOS[nombre].modal);
    avisarLaRespuesta(respuesta);
    volverAPedirTodo();
  } catch (error) {
    formulario.guardando = false;
    boton.disabled = formulario.esperando;
    if (error?.status === 401) irAlLogin();
    else if (error?.status === 404) noEstaMas(FORMULARIOS[nombre].modal, error);
    else if (pagina.formulario === formulario) mostrarFallaDelServidor(nombre, error, boton);
  } finally {
    if (pagina.formulario === formulario) boton.disabled = formulario.esperando;
  }
}

// «Borrar»: la confirmación, sobre el formulario
function pedirBorrarLicencia(nombre) {
  const formulario = pagina.formulario;
  if (formulario?.nombre !== nombre || !formulario.fila || formulario.guardando) return;
  const { id } = formulario.fila;
  pedirConfirmacion({
    titulo: nombre === 'uso' ? '¿Borrar el uso autorizado?' : '¿Borrar la licencia?', texto: textoDeConfirmacion(formulario.fila),
    volverA: porId(`${FORMULARIOS[nombre].prefijo}-borrar`), formulario: FORMULARIOS[nombre].modal,
    borrar: () => API.pedirJson('DELETE', `/mi-espacio/licencias/${encodeURIComponent(id)}`)
  });
}

// ---- «Cargar horas extras» ----

// Abre «Cargar horas extras» (nuevas, o la corrección de un día del día por día), con lo que suman en el mes: si la tabla de la
// pestaña todavía no llegó, la pide, sin mostrar la pestaña
async function abrirHorasExtras({ dia = null, volverA = null } = {}) {
  if (pagina.resumen === null && !(await hayResumen())) return;
  if (pagina.resumen?.abrir_saldos === true) {
    abrirSaldos(volverA);
    return;
  }
  const valores = valoresDeHoras(dia);
  let titulo = modalidadActual() === 'planta' ? 'Cargar horas extras al 100%' : 'Cargar horas extras';
  if (dia) titulo = `Corregir las horas extras del ${comoTexto(dia.fecha_texto)}`;
  porId('modal-horas-titulo').textContent = titulo;
  for (const campo of ['fecha', 'desde', 'hasta', 'nota']) porId(`mh-${campo}`).value = valores[campo];
  pagina.horasExtras = { dia, valores, guardando: false };
  limpiarErrores('horasExtras');
  porId('mh-borrar').hidden = !dia;
  porId('mh-guardar').disabled = false;
  actualizarLaSuma();
  if (pagina.horas === null) cargarHorasExtras(null, { conAnuncio: false }).then(actualizarLaSuma);
  abrirModal('modal-horas', { volverA, foco: () => porId('mh-fecha'), alCerrar: () => { pagina.horasExtras = null; } });
}

const valoresDeLasHorasExtras = () => ({
  ...pagina.horasExtras.valores, fecha: porId('mh-fecha').value, desde: porId('mh-desde').value, hasta: porId('mh-hasta').value,
  nota: porId('mh-nota').value
});

function actualizarLaSuma() {
  if (!pagina.horasExtras) return;
  const suma = porId('mh-suma');
  suma.textContent = textoDeLaSuma(valoresDeLasHorasExtras(), pagina.horas, modalidadActual());
  suma.hidden = suma.textContent === '';
}

async function guardarHorasExtras() {
  const formulario = pagina.horasExtras;
  const boton = porId('mh-guardar');
  if (!formulario || formulario.guardando) return;
  const valores = valoresDeLasHorasExtras();
  if (mostrarErrores('horasExtras', conSusControles('horasExtras', erroresDeHoras(valores)))) return;
  formulario.guardando = true;
  boton.disabled = true;
  try {
    const respuesta = formulario.dia
      ? await API.pedirJson('PUT', `/mi-espacio/horas-extras/${encodeURIComponent(formulario.dia.id)}`, cuerpoDeHoras(valores))
      : await API.pedirJson('POST', '/mi-espacio/horas-extras', cuerpoDeHoras(valores));
    formulario.guardando = false;
    cerrarModal('modal-horas');
    avisarLaRespuesta(respuesta);
    volverAPedirTodo();
  } catch (error) {
    formulario.guardando = false;
    boton.disabled = false;
    if (error?.status === 401) irAlLogin();
    else if (error?.status === 404) noEstaMas('modal-horas', error);
    else if (pagina.horasExtras === formulario) mostrarFallaDelServidor('horasExtras', error, boton);
  } finally {
    boton.disabled = false;
  }
}

function pedirBorrarHorasExtras() {
  const formulario = pagina.horasExtras;
  if (!formulario?.dia || formulario.guardando) return;
  const { id } = formulario.dia;
  pedirConfirmacion({
    titulo: '¿Borrar las horas extras?', texto: textoDeConfirmacion(formulario.dia), volverA: porId('mh-borrar'),
    formulario: 'modal-horas', borrar: () => API.pedirJson('DELETE', `/mi-espacio/horas-extras/${encodeURIComponent(id)}`)
  });
}

// ---- «Mis vacaciones y saldos» ----

// Abre «Mis vacaciones y saldos» (spec, sección 4) con lo que vale para el año en curso (GET /anio/:anio) y los campos de «Para
// arrancar» (GET /saldo-inicial). Si no se puede, un aviso lo dice (sin el saldo inicial, los botones de carga llevan acá: nunca
// quedan sin responder). `recargarAlCerrar`: el año se guardó y el saldo no; al cerrarlo, la página se vuelve a pedir
async function abrirSaldos(volverA = null) {
  if (pagina.saldos !== null) return;
  const anio = anioDeHoy();
  pagina.saldos = { cargando: true };
  let deEseAnio;
  let saldo;
  try {
    [{ data: deEseAnio }, { data: saldo }] = await Promise.all([
      API.pedirJson('GET', `/mi-espacio/anio/${anio}`), API.pedirJson('GET', '/mi-espacio/saldo-inicial')
    ]);
  } catch (error) {
    pagina.saldos = null;
    if (error?.status === 401) irAlLogin();
    else avisarMiEspacio(MENSAJE_SIN_SALDOS, 'error');
    return;
  }
  if (!esObjeto(deEseAnio) || !esObjeto(saldo) || !Array.isArray(saldo.campos)) {
    pagina.saldos = null;
    avisarMiEspacio(comoTexto(saldo?.mensaje) || comoTexto(deEseAnio?.mensaje) || MENSAJE_SIN_SALDOS, 'warning');
    return;
  }
  const dias = DIAS_VACACIONES.includes(deEseAnio.dias_vacaciones) ? deEseAnio.dias_vacaciones : null;
  pagina.saldos = {
    anio, campos: saldo.campos, camposDelModal: saldo.campos, textos: deEseAnio.textos_mitades, guardando: false,
    recargarAlCerrar: false
  };
  const modalidad = pagina.resumen?.modalidad?.texto;
  porId('ms-modalidad').innerHTML = conTexto(modalidad)
    ? `Modalidad: <b>${esc(modalidad)}</b> <span class="me-opcional">(la carga administración en Configuración → Usuarios)</span>` : '';
  porId('ms-modalidad').hidden = !conTexto(modalidad);
  porId('ms-dias-rotulo').textContent = `Días de la licencia ${String(anio)}`;
  porId('ms-dias-opciones').innerHTML = htmlDeDiasDeVacaciones(dias);
  // Sin días elegidos todavía (la primera vez), los estudios tampoco; si no, null es «No estudio»
  porId('ms-estudios-opciones').innerHTML = htmlDeEstudios(dias === null ? undefined : (deEseAnio.estudios ?? ''));
  pintarCamposDelSaldo(valoresDelSaldo(saldo.campos));
  limpiarErrores('saldos');
  porId('ms-guardar').disabled = false;
  abrirModal('modal-saldos', { volverA, foco: () => controlDeFoco('ms-dias'), alCerrar: cerrarSaldos });
}

// Al cerrar «Mis vacaciones y saldos» guardado a medias (con «Cancelar», la × o Escape), los días del año nuevos ya están en la
// base: la página se vuelve a pedir, después de que el foco vuelva al botón que lo abrió (respaldoDelFoco lo busca)
function cerrarSaldos() {
  const recargar = pagina.saldos?.recargarAlCerrar === true;
  pagina.saldos = null;
  if (recargar) Promise.resolve().then(volverAPedirTodo);
}

// Lo elegido en el modal: los días (o null) y los estudios (la carrera, null por «No estudio» o undefined si no eligió)
const diasElegidos = () => {
  const dias = Number(porId('ms-dias').querySelector('input:checked')?.value);
  return DIAS_VACACIONES.includes(dias) ? dias : null;
};
const estudiosElegidos = () => {
  const elegido = porId('ms-estudios').querySelector('input:checked');
  if (!elegido) return undefined;
  return conTexto(elegido.value) ? elegido.value : null;
};
const valoresEscritosDelSaldo = () => Object.fromEntries([...porId('ms-campos').querySelectorAll('[data-saldo]')]
  .map((campo) => [campo.dataset.saldo, campo.value]));

// «Para arrancar» con lo elegido arriba (camposConLoElegido) y lo escrito, y la ayuda de los días: cómo se habilitan los elegidos
function pintarCamposDelSaldo(valores) {
  const saldos = pagina.saldos;
  const dias = diasElegidos();
  saldos.camposDelModal = camposConLoElegido(saldos.campos, { anio: saldos.anio, dias, estudios: estudiosElegidos() });
  porId('ms-campos').innerHTML = htmlDeCamposDelSaldo(saldos.camposDelModal, valores);
  porId('ms-dias-mitades').textContent = dias === null ? '' : comoTexto(deMapa(saldos.textos, String(dias), ''));
}

function alElegirEnLosSaldos() {
  if (pagina.saldos?.campos) pintarCamposDelSaldo(valoresEscritosDelSaldo());
}

// «Guardar»: primero los días y los estudios del año (PUT /anio/:anio) y después el saldo inicial (PUT /saldo-inicial). Si el
// segundo falla, el modal queda abierto: el año ya se guardó
async function guardarSaldos() {
  const saldos = pagina.saldos;
  const boton = porId('ms-guardar');
  if (!saldos?.campos || saldos.guardando) return;
  const dias = diasElegidos();
  const estudios = estudiosElegidos();
  const valores = valoresEscritosDelSaldo();
  const errores = [];
  if (dias === null) errores.push(['ms-dias', MENSAJES_FORMULARIOS.diasVacaciones]);
  if (estudios === undefined) errores.push(['ms-estudios', MENSAJES_FORMULARIOS.estudios]);
  for (const [clave, mensaje] of Object.entries(erroresDelSaldo(valores, saldos.camposDelModal))) {
    errores.push([`ms-campo-${clave}`, mensaje]);
  }
  if (mostrarErrores('saldos', errores)) return;
  saldos.guardando = true;
  boton.disabled = true;
  let anioGuardado = false;
  try {
    await API.pedirJson('PUT', `/mi-espacio/anio/${saldos.anio}`, { dias_vacaciones: dias, estudios });
    anioGuardado = true;
    const respuesta = await API.pedirJson('PUT', '/mi-espacio/saldo-inicial', cuerpoDelSaldo(valores, saldos.camposDelModal));
    saldos.guardando = false;
    saldos.recargarAlCerrar = false;
    cerrarModal('modal-saldos');
    avisarLaRespuesta(respuesta);
    volverAPedirTodo();
  } catch (error) {
    saldos.guardando = false;
    boton.disabled = false;
    if (error?.status === 401) irAlLogin();
    else if (pagina.saldos === saldos && !anioGuardado) mostrarFallaDelServidor('saldos', error, boton);
    else if (pagina.saldos === saldos) {
      // El año ya se guardó: el motivo del saldo, en su campo (si es de «Para arrancar» o de los días) y arriba del modal
      saldos.recargarAlCerrar = true;
      limpiarErrores('saldos');
      const id = porId(`ms-campo-${error?.campo}`) ? `ms-campo-${error.campo}` : deMapa(FORMULARIOS.saldos.campos, error?.campo, null);
      const motivo = motivoDeLaFalla(error, MENSAJE_NO_SE_GUARDO);
      ponerError(id, motivo);
      avisoDelModal('saldos', `Los días del año se guardaron, pero el saldo inicial no: ${motivo.replace(/\.$/, '')}.`);
      (id ? controlDeFoco(id) : boton)?.focus?.();
    }
  } finally {
    boton.disabled = false;
  }
}

// ---- La confirmación de un borrado ----

// Abre la confirmación sobre el formulario (`formulario`, su modal): `texto`, en texto plano; «Borrar» corre `borrar`. El foco va
// a «Cancelar», que no borra nada, y vuelve a `volverA`
function pedirConfirmacion({ titulo, texto, volverA, formulario, borrar }) {
  pagina.confirmacion = { formulario, borrar, ocupado: false };
  porId('modal-confirmar-titulo').textContent = titulo;
  porId('modal-confirmar-texto').textContent = texto;
  avisoDelModal('confirmar', '');
  porId('modal-confirmar-si').disabled = false;
  abrirModal('modal-confirmar', {
    volverA, foco: () => porId('modal-confirmar').querySelector('.modal-footer [data-cerrar]'),
    alCerrar: () => { pagina.confirmacion = null; }
  });
}

// «Borrar»: si sale bien, se cierran la confirmación y el formulario, se anuncia y se vuelve a pedir todo; si no, el error queda en
// la confirmación (un 404, como al guardar)
async function confirmarElBorrado() {
  const actual = pagina.confirmacion;
  const boton = porId('modal-confirmar-si');
  if (!actual || actual.ocupado) return;
  actual.ocupado = true;
  boton.disabled = true;
  avisoDelModal('confirmar', '');
  try {
    const respuesta = await actual.borrar();
    actual.ocupado = false;
    cerrarModal('modal-confirmar');
    cerrarModal(actual.formulario);
    avisarLaRespuesta(respuesta);
    volverAPedirTodo();
  } catch (error) {
    actual.ocupado = false;
    boton.disabled = false;
    if (error?.status === 401) irAlLogin();
    else if (error?.status === 404) {
      cerrarModal('modal-confirmar');
      noEstaMas(actual.formulario, error);
    } else if (pagina.confirmacion === actual) {
      avisoDelModal('confirmar', motivoDeLaFalla(error, MENSAJE_NO_SE_BORRO));
      boton.focus?.();
    }
  } finally {
    boton.disabled = false;
  }
}
