/**
 * Mi espacio - RPAD (spec 2026-10-26-mi-espacio-licencias-y-horas, secciones 8 y 11)
 * El panel personal de cada usuario: sus licencias, sus horas extras y lo que le queda, en tres pestañas que viajan en la dirección
 * (#resumen, #licencias y #horas). Lo que se carga acá lo ve solo su dueño. Los números y los textos los arma el servidor
 * (GET /api/mi-espacio/resumen, /mi-espacio/licencias?anio= y /mi-espacio/horas-extras?anio=, con services/miEspacioResumen.js) y
 * la página los imprime tal cual: no recalcula nada (Ruling 19). Sin la modalidad cargada, cada pestaña muestra el mensaje del
 * servidor y no deja cargar nada.
 * - Licencias: la lista del año, con el selector del año y los filtros por tipo (con su cantidad); al final, el saldo inicial con
 *   «Cambiar». Lo anterior al saldo inicial y lo que no corresponde a la modalidad actual se ven en gris, con su motivo.
 * - Horas extras: la tabla por mes (en planta, los francos; en contrato, las horas a favor) y el día por día de un mes (cada mes de
 *   la tabla es un botón; de entrada, el en curso) y, en contrato, las horas no utilizadas previamente.
 * Los botones de carga y de edición solo llevan data-* (data-cargar, data-abrir, data-editar-licencia, data-editar-horas).
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
    + `<h2>Mis licencias de ${String(anio ?? '')}</h2><span class="me-acciones">${htmlDelSelectorDeAnio(datos.anios, anio)}`
    + '<button type="button" class="sg-btn sg-btn-tinta sg-btn-chico" data-cargar="licencia">Cargar licencia</button></span></div>'
    + (licencias.length > 0 ? htmlDeFiltrosDeLicencias(datos.filtros, actual) : '')
    + (visibles.length === 0 ? `<p class="me-vacio">No hay licencias cargadas en ${String(anio ?? '')}.</p>` : '')
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
const cabezaDeHoras = (titulo, tabla) => `<div class="me-cabeza"><h2>${titulo} de ${String(tabla.anio ?? '')}</h2>`
  + `<span class="me-acciones">${htmlDelSelectorDeAnio(tabla.anios, tabla.anio)}`
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
  if (filas.length === 0) return `<p class="me-vacio">No hay horas extras cargadas en ${String(tabla.anio ?? '')}.</p>`;
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
    + `<p class="me-nota">${NOTA_DE_LOS_FRANCOS}</p>${htmlDelUsoAutorizado(tabla.uso_autorizado)}</div>`;
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
// llegan). `pedidos` numera las cargas de cada pestaña: una respuesta que llega después de otra más nueva se descarta
const pagina = {
  pestana: PESTANAS[0], resumen: null, licencias: null, filtro: 'todas', horas: null, mes: null,
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
// mensaje; con ella y sin el saldo inicial, invita a completar «Mis vacaciones y saldos»
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
  let html = '';
  if (!conModalidad) html = htmlDeMensaje(resumen.mensaje);
  else if (resumen.abrir_saldos === true) html = htmlSinArranque();
  porId('vista-resumen').innerHTML = html;
}

// ---- Licencias ----

// Pide las licencias de un año (null: el en curso). Al elegir un año, se anuncia el título de la tarjeta. Devuelve si dibujó la
// lista (una respuesta vieja o una falla, no)
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
    else mostrarFalla('vista-licencias', 'No se pudieron cargar tus licencias. Probá de nuevo en unos minutos.');
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

// Pide las horas extras de un año (null: el en curso); el día por día vuelve al mes de entrada. Devuelve si dibujó la pestaña
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
    else mostrarFalla('vista-horas', 'No se pudieron cargar tus horas extras. Probá de nuevo en unos minutos.');
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
