/**
 * Admin, fechas de los datasets - RPAD
 *
 * Lo puro que arma la lista de datasets, las opciones de "Próxima actualización" y la línea del ciclo de "Registrar
 * actualización" (spec 2026-10-17-fechas-datasets, sección 8). Se carga antes de admin.js.
 *
 * Al cargarse solo declara: no toca el DOM, `window` ni `Auth`, y `Utils` (api.js) solo se usa al armar HTML. Así
 * tests/admin-frontend.test.js lo carga en un `vm`, como perfil.js y correos.js.
 *
 * La aritmética de las reglas (pedido, opciones de próxima, estado) NO está acá: la hace el servidor
 * (services/fechasDatasetReglas.js) y este archivo solo muestra lo que devuelve. Lo único que se calcula acá son
 * posiciones de pantalla (la línea del ciclo) y nombres de meses.
 *
 * Fechas: siempre 'AAAA-MM-DD'. Las que mysql2 serializa como ISO con hora ('2026-01-31T03:00:00.000Z') se leen por su
 * texto, los primeros 10 caracteres: nunca se pasan por `new Date()` ni por Utils.formatDate, que las correrían un día
 * en un navegador argentino. Febrero va siempre en 28.
 *
 * Estilos: las clases (ad-chip, ad-sub, ad-fecha, ad-acciones, ad-btn, ad-icono, ad-opcion, pista, banda, marca,
 * etiqueta...) son las del mockup aprobado, docs/superpowers/specs/2026-10-17-fechas-datasets-mockup.html. Las que no están
 * en el mockup (el texto del pedido y la tarjeta del celular) tienen su estilo en el <style> de admin.html.
 */

const ZONA_HORARIA_ARGENTINA = 'America/Argentina/Buenos_Aires';
const SIN_DATO = '—';
const TEXTO_BLOQUEO = 'Tiene un cambio pendiente de aprobación';
const NOMBRES_DE_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
// Febrero en 28 siempre, también en los años bisiestos
const DIAS_DE_CADA_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Íconos Lucide (check, pencil y trash-2). Son decorativos: el botón tiene su texto o su aria-label
const ICONO_REGISTRAR = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg>';
const ICONO_EDITAR = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICONO_ELIMINAR = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

// =====================================================
// Fechas
// =====================================================

/**
 * 'AAAA-MM-DD' de hoy en Argentina, armado con formatToParts (como hoyArgentina del servidor, services/
 * notasDigitalesCalendario.js). Nunca toISOString(): entre las 21:00 y las 24:00 de Argentina ya es el día siguiente en
 * UTC y daría la fecha de mañana.
 */
function hoyEnArgentina(ahora = new Date()) {
  const formato = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA_ARGENTINA, numberingSystem: 'latn', year: 'numeric', month: 'numeric', day: 'numeric'
  });
  const partes = {};
  for (const { type, value } of formato.formatToParts(ahora)) {
    if (type !== 'literal') partes[type] = Number(value);
  }
  const dosCifras = (numero) => String(numero).padStart(2, '0');
  return `${String(partes.year).padStart(4, '0')}-${dosCifras(partes.month)}-${dosCifras(partes.day)}`;
}

// Los días que tiene de verdad un mes del calendario, con el 29 de febrero de los años bisiestos (para reconocer una fecha
// que existe; las fechas que arma el sistema, en cambio, llevan febrero en 28)
function diasDelMesEnElCalendario(anio, mes) {
  const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
  return mes === 2 && bisiesto ? 29 : DIAS_DE_CADA_MES[mes - 1];
}

/**
 * Los primeros 10 caracteres ('AAAA-MM-DD') de una fecha que viaja como texto, con o sin hora, o null si no es una fecha:
 * no es un texto, no empieza con AAAA-MM-DD o es un día que no existe ('0000-00-00', '2026-02-31', '2026-04-31').
 */
function soloFecha(valor) {
  if (typeof valor !== 'string') return null;
  const partes = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(valor);
  if (!partes) return null;
  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMesEnElCalendario(anio, mes)) return null;
  return valor.slice(0, 10);
}

// Un número entero que viene de un select (texto) o de un cálculo; null si no lo es
function enteroDe(valor) {
  if (typeof valor !== 'number' && typeof valor !== 'string') return null;
  if (typeof valor === 'string' && !/^\s*\d+\s*$/.test(valor)) return null;
  const numero = Number(valor);
  return Number.isInteger(numero) ? numero : null;
}

// dd/mm/aaaa, o '—' si no hay fecha. Corta el texto: '2026-01-31T03:00:00.000Z' es el 31/01/2026
function fechaCorta(iso) {
  const fecha = soloFecha(iso);
  return fecha ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}` : SIN_DATO;
}

// 'ene 2027', o '—' si no hay fecha
function mesAnio(iso) {
  const fecha = soloFecha(iso);
  return fecha ? `${NOMBRES_DE_MES[Number(fecha.slice(5, 7)) - 1].slice(0, 3).toLowerCase()} ${fecha.slice(0, 4)}` : SIN_DATO;
}

/**
 * 'AAAA-MM-DD' del último día de un mes, con febrero siempre en 28 (R1). Acepta números o el texto de un select.
 * null si el año o el mes no sirven.
 */
function finDeMesDe(anio, mes) {
  const a = enteroDe(anio);
  const m = enteroDe(mes);
  if (a === null || m === null || a < 1000 || a > 9999 || m < 1 || m > 12) return null;
  return `${a}-${String(m).padStart(2, '0')}-${DIAS_DE_CADA_MES[m - 1]}`;
}

// =====================================================
// Selectores de mes y año
// =====================================================

// <option> de los doce meses, con mayúscula inicial y el número del mes como valor. `seleccionado`: 1 a 12
function opcionesDeMes(seleccionado) {
  const elegido = enteroDe(seleccionado);
  return NOMBRES_DE_MES
    .map((nombre, i) => `<option value="${i + 1}"${i + 1 === elegido ? ' selected' : ''}>${nombre}</option>`)
    .join('');
}

/**
 * <option> de los años de `desde` a `hasta`, del más alto al más bajo. Si `seleccionado` (un año de cuatro cifras) queda
 * fuera del rango, el rango se amplía hasta incluirlo: si no, el select mostraría otro año y, al guardar, una fecha vieja
 * cambiaría sin que nadie la toque. Un rango al revés (desde > hasta) da ''.
 */
function opcionesDeAnio(desde, hasta, seleccionado) {
  let primero = enteroDe(desde);
  let ultimo = enteroDe(hasta);
  const elegido = enteroDe(seleccionado);
  if (primero === null || ultimo === null || primero > ultimo) return '';
  if (elegido !== null && elegido >= 1000 && elegido <= 9999) {
    primero = Math.min(primero, elegido);
    ultimo = Math.max(ultimo, elegido);
  }
  let html = '';
  for (let anio = ultimo; anio >= primero; anio--) {
    html += `<option value="${anio}"${anio === elegido ? ' selected' : ''}>${anio}</option>`;
  }
  return html;
}

// =====================================================
// Estado
// =====================================================

function detalleDeProximo(dias, proxima) {
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence en 1 día';
  if (Number.isInteger(dias) && dias > 1) return `Vence en ${dias} días`;
  const cuando = mesAnio(proxima);
  return cuando === SIN_DATO ? 'Vence pronto' : `Vence en ${cuando}`;
}

/**
 * La pastilla de estado de un dataset: { clase, texto, detalle }. `clase` es la del chip (vencido, proximo, al-dia,
 * eventual, pendiente o sin-fecha) y también el valor de los filtros de la lista. `estado` y `dias` son los del
 * servidor (`estado` y `dias_para_vencer`); `proxima`, 'AAAA-MM-DD' o ISO con hora. Un cambio pendiente le gana a todos.
 */
function textoEstado(estado, dias, proxima, tipoGestion, pendiente) {
  if (pendiente) return { clase: 'pendiente', texto: 'Cambio pendiente', detalle: 'Esperando aprobación' };
  switch (estado) {
    case 'atrasado':
    case 'sin-respuesta': {
      const cuando = mesAnio(proxima);
      return {
        clase: 'vencido',
        texto: tipoGestion === 'interna' ? 'Atrasado' : 'Sin respuesta',
        detalle: cuando === SIN_DATO ? 'Vencido' : `Venció en ${cuando}`
      };
    }
    case 'proximo':
      return { clase: 'proximo', texto: 'Próximo a vencer', detalle: detalleDeProximo(dias, proxima) };
    case 'actualizado': {
      const cuando = mesAnio(proxima);
      return { clase: 'al-dia', texto: 'Actualizado', detalle: cuando === SIN_DATO ? 'Al día' : `Vence en ${cuando}` };
    }
    case 'eventual':
      return { clase: 'eventual', texto: 'Eventual', detalle: 'Sin vencimiento' };
    default:
      // 'sin-fecha' y cualquier estado que no conoce: nunca se hace pasar por uno al día
      return { clase: 'sin-fecha', texto: 'Sin fecha', detalle: 'Sin próxima actualización' };
  }
}

// El filtro de estado en que cae un dataset: la clase de su pastilla (un cambio pendiente le gana al estado)
function claseDeEstado(dataset, pendiente) {
  const d = dataset ?? {};
  return textoEstado(d.estado, d.dias_para_vencer, d.proxima_actualizacion, d.tipo_gestion, pendiente).clase;
}

/**
 * Los contadores de los filtros de la lista: { todos, vencido, proximo, 'al-dia', eventual, pendiente, 'sin-fecha' }.
 * Cada dataset cuenta una sola vez, en el estado con que se muestra: uno con cambio pendiente cuenta como pendiente y no
 * en su estado. `pendientes`: los ids de los datasets con un cambio pendiente (lista o Set; número o texto).
 */
function contarPorEstado(datasets, pendientes) {
  const cuentas = { todos: 0, vencido: 0, proximo: 0, 'al-dia': 0, eventual: 0, pendiente: 0, 'sin-fecha': 0 };
  const conPendiente = new Set(Array.from(pendientes ?? [], (id) => String(id)));
  for (const dataset of Array.isArray(datasets) ? datasets : []) {
    cuentas.todos++;
    cuentas[claseDeEstado(dataset, conPendiente.has(String(dataset?.id)))]++;
  }
  return cuentas;
}

// =====================================================
// Lista: fila y tarjeta
// =====================================================

// Todo dato que se muestra pasa por acá (Utils.escapeHtml). Un número como el id llega como texto
function textoSeguro(valor) {
  return Utils.escapeHtml(valor === null || valor === undefined ? '' : String(valor));
}

// "Al 31/07/2026" o "Ejercicio 2025" (si el tipo es ejercicio), con "Cargado el dd/mm/aaaa" debajo. Sin Datos al, una raya
function htmlDeDatosPublicados(d) {
  const datosAl = soloFecha(d.datos_al);
  let publicado = SIN_DATO;
  if (datosAl) publicado = d.tipo_pedido === 'ejercicio' ? `Ejercicio ${datosAl.slice(0, 4)}` : `Al ${fechaCorta(datosAl)}`;
  const cargado = soloFecha(d.ultima_actualizacion);
  return `<span class="ad-fecha">${textoSeguro(publicado)}</span>`
    + (cargado ? `<span class="ad-sub">Cargado el ${fechaCorta(cargado)}</span>` : '');
}

/**
 * El texto del pedido; debajo, el tipo y la fecha sugerida de envío si la próxima es de hoy en adelante. El texto no lleva la
 * clase de las fechas (que no se parten): "Presupuestos de los ejercicios 2026 y 2027" puede ocupar dos renglones.
 */
function htmlDeProximoPedido(d, hoy) {
  const texto = d.pedido && d.pedido.texto ? d.pedido.texto : SIN_DATO;
  const proxima = soloFecha(d.proxima_actualizacion);
  const detalle = [];
  if (d.tipo_pedido_nombre) detalle.push(d.tipo_pedido_nombre);
  if (proxima && proxima >= hoy) detalle.push(`Fecha sugerida de envío: ${fechaCorta(proxima)}`);
  return `<span class="ad-pedido-texto">${textoSeguro(texto)}</span>`
    + (detalle.length ? `<span class="ad-sub">${detalle.map(textoSeguro).join('. ')}</span>` : '');
}

function htmlDeTitulo(d) {
  return `<span class="ad-titulo">${textoSeguro(d.titulo)}</span><span class="ad-sub">${textoSeguro(d.area_nombre)}</span>`;
}

function htmlDePastilla(estado) {
  return `<span class="ad-chip ${estado.clase}">${textoSeguro(estado.texto)}</span><span class="ad-sub">${textoSeguro(estado.detalle)}</span>`;
}

/**
 * Registrar, editar y eliminar. Sin permiso de administración no hay botones. Con un cambio pendiente los tres van
 * `disabled`, con el motivo en el `title`. Llevan data-registrar, data-editar y data-eliminar con el id: el que los usa
 * escucha los clics por delegación, sin onclick. Los tres tienen aria-label con el título (el de registrar también, porque
 * en el celular se oculta su texto, el span "largo", y el botón se quedaría sin nombre).
 */
function htmlDeAcciones(d, pendiente, esAdmin) {
  if (!esAdmin) return '';
  const id = textoSeguro(d.id);
  const titulo = textoSeguro(d.titulo);
  const bloqueo = pendiente ? ` disabled title="${TEXTO_BLOQUEO}"` : '';
  return '<div class="ad-acciones">'
    + `<button type="button" class="ad-btn registrar" data-registrar="${id}" aria-label="Registrar actualización de ${titulo}"${bloqueo}>${ICONO_REGISTRAR}<span class="largo">Registrar actualización</span></button>`
    + `<button type="button" class="ad-icono" data-editar="${id}" aria-label="Editar ${titulo}"${bloqueo}>${ICONO_EDITAR}</button>`
    + `<button type="button" class="ad-icono borrar" data-eliminar="${id}" aria-label="Eliminar ${titulo}"${bloqueo}>${ICONO_ELIMINAR}</button>`
    + '</div>';
}

/**
 * La fila (<tr>) de un dataset de la lista, con las columnas Dataset, Estado, Datos publicados, Próximo pedido y Acciones.
 * `dataset` es el de GET /datasets. `pendiente`: tiene un cambio pendiente. `esAdmin`: ve los botones; sin ellos la última
 * celda queda vacía (la página oculta esa columna al lector). `hoy`: 'AAAA-MM-DD' (por defecto, hoy en Argentina; quien
 * arma la lista entera la calcula una vez y la pasa). Sin opciones, o con null: sin botones.
 */
function htmlDeFila(dataset, opciones) {
  const { pendiente = false, esAdmin = false, hoy } = opciones ?? {};
  const d = dataset ?? {};
  const fecha = soloFecha(hoy) ?? hoyEnArgentina();
  const estado = textoEstado(d.estado, d.dias_para_vencer, d.proxima_actualizacion, d.tipo_gestion, pendiente);
  return `<tr${pendiente ? ' class="bloqueada"' : ''}>`
    + `<td>${htmlDeTitulo(d)}</td>`
    + `<td>${htmlDePastilla(estado)}</td>`
    + `<td class="ocultable">${htmlDeDatosPublicados(d)}</td>`
    + `<td>${htmlDeProximoPedido(d, fecha)}</td>`
    + `<td>${htmlDeAcciones(d, pendiente, esAdmin)}</td>`
    + '</tr>';
}

/**
 * La versión de la fila para el celular (<article>): los mismos datos y los mismos botones. Mismos parámetros que htmlDeFila.
 */
function htmlDeTarjeta(dataset, opciones) {
  const { pendiente = false, esAdmin = false, hoy } = opciones ?? {};
  const d = dataset ?? {};
  const fecha = soloFecha(hoy) ?? hoyEnArgentina();
  const estado = textoEstado(d.estado, d.dias_para_vencer, d.proxima_actualizacion, d.tipo_gestion, pendiente);
  return `<article class="ad-tarjeta${pendiente ? ' bloqueada' : ''}">`
    + `<div class="ad-tarjeta-titulo">${htmlDeTitulo(d)}</div>`
    + `<div class="ad-tarjeta-estado">${htmlDePastilla(estado)}</div>`
    + '<dl class="ad-tarjeta-datos">'
    + `<div><dt>Datos publicados</dt><dd>${htmlDeDatosPublicados(d)}</dd></div>`
    + `<div><dt>Próximo pedido</dt><dd>${htmlDeProximoPedido(d, fecha)}</dd></div>`
    + '</dl>'
    + htmlDeAcciones(d, pendiente, esAdmin)
    + '</article>';
}

// =====================================================
// Registrar actualización
// =====================================================

function htmlDeOpcion(valor, contenido) {
  return `<label class="ad-opcion"><input type="radio" name="proxima" value="${valor}"><span>${contenido}</span></label>`;
}

// "Atención: ya pasó y pediría datos que ya llegaron." a partir de la advertencia del servidor, que viene sin punto
function textoDeAdvertencia(advertencia) {
  if (typeof advertencia !== 'string') return null;
  const frase = advertencia.trim().replace(/\.$/, '');
  return frase ? `Atención: ${frase.charAt(0).toLowerCase()}${frase.slice(1)}.` : null;
}

/**
 * Las tarjetas de radio del paso 3 (las opciones de GET /datasets/:id/opciones-proxima: { fecha, motivo, sugerida,
 * advertencia, pideDespues }), más "Otra fecha" al final. Van dentro del role="radiogroup" que arma quien las usa.
 * Ninguna viene elegida (sin `checked`): la persona tiene que elegir. Todos los radios se llaman "proxima"; el valor es el
 * índice de la opción en la lista y "otra" el de la última.
 */
function htmlDeOpciones(opciones) {
  const tarjetas = (Array.isArray(opciones) ? opciones : []).map((opcion, i) => {
    const o = opcion ?? {};
    const advertencia = textoDeAdvertencia(o.advertencia);
    return htmlDeOpcion(i,
      `<span class="fecha">${fechaCorta(o.fecha)}</span><span class="que">${textoSeguro(o.motivo)}</span>`
      + (o.sugerida ? '<span class="ad-sugerida">Sugerida</span>' : '')
      + (advertencia ? `<span class="porque aviso">${textoSeguro(advertencia)}</span>` : '')
      + (o.pideDespues ? `<span class="despues">La nota siguiente va a pedir: <b>${textoSeguro(o.pideDespues)}</b></span>` : ''));
  });
  tarjetas.push(htmlDeOpcion('otra',
    '<span class="que" style="margin-left:0">Otra fecha</span><span class="porque">Elegís el mes y el año.</span>'));
  return tarjetas.join('');
}

// Un porcentaje de la pista (0 a 1 -> '53.33%'), siempre dentro de la pista
function porcentaje(fraccion) {
  const valor = Math.min(1, Math.max(0, fraccion)) * 100;
  return `${Math.round(valor * 100) / 100}%`;
}

/**
 * Las bandas y las marcas de la línea del ciclo, para poner dentro de su contenedor (con `position: relative`). El
 * contenedor es decorativo: quien lo arma le pone aria-hidden="true", porque la misma información está en texto en la
 * cabecera de "Datos solicitados".
 *
 * Entrada, todas 'AAAA-MM-DD' (o ISO con hora):
 *   datosAl    lo que ya está publicado (opcional)
 *   desde/hasta   lo que pide el pedido (pedido.desde y pedido.hasta)
 *   proxima    el vencimiento (la fecha sugerida de envío)
 *   hoy        hoy en Argentina
 *   datosNuevo lo que llega con esta actualización (opcional): mueve la banda verde
 * Sin desde o sin hasta (un eventual, una edición, un relevamiento) da solo la pista vacía.
 *
 * Bandas: publicado, falta (rayada: lo pedido que todavía no llegó) y llega (verde). Marcas: Publicado, Corte pedido, Envío
 * sugerido (solo si la próxima es de hoy en adelante) y Hoy. Las posiciones son porcentajes de la pista: cada mes es un
 * casillero de igual ancho, con un mes de margen en cada punta, y las fechas de fin de mes caen al final de su casillero.
 */
function htmlDeCiclo({ datosAl, desde, hasta, proxima, hoy, datosNuevo } = {}) {
  const pista = '<div class="pista"></div>';
  const fechaDesde = soloFecha(desde);
  const fechaHasta = soloFecha(hasta);
  if (!fechaDesde || !fechaHasta) return pista;

  const fechaHoy = soloFecha(hoy) ?? hoyEnArgentina();
  const fechaPublicado = soloFecha(datosAl);
  const fechaNuevo = soloFecha(datosNuevo);
  const fechaProxima = soloFecha(proxima);
  const conEnvio = fechaProxima !== null && fechaProxima >= fechaHoy;

  // El índice de un mes es año × 12 + mes - 1. La pista cubre desde un mes antes del primero hasta un mes después del último
  const indice = (iso) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
  const todos = [fechaDesde, fechaHasta, fechaHoy, fechaPublicado, fechaNuevo, conEnvio ? fechaProxima : null].filter(Boolean).map(indice);
  const inicio = Math.min(...todos) - 1;
  const casilleros = Math.max(...todos) + 1 - inicio + 1;
  // Fin del casillero del mes de índice i, como fracción de la pista
  const finDe = (i) => (i + 1 - inicio) / casilleros;

  const finPublicado = fechaPublicado ? finDe(indice(fechaPublicado)) : null;
  const finHasta = finDe(indice(fechaHasta));
  // Lo que falta empieza donde termina lo publicado, o un mes antes de lo que se pide si lo publicado es anterior
  const indiceFalta = fechaPublicado && indice(fechaDesde) <= indice(fechaPublicado) ? indice(fechaPublicado) : indice(fechaDesde) - 1;
  const inicioFalta = finDe(indiceFalta);

  const partes = [pista];
  if (finPublicado !== null) partes.push(`<div class="banda publicado" style="left:0%;width:${porcentaje(finPublicado)}"></div>`);
  partes.push(`<div class="banda falta" style="left:${porcentaje(inicioFalta)};width:${porcentaje(Math.max(0, finHasta - inicioFalta))}"></div>`);
  if (fechaNuevo && indice(fechaNuevo) > indiceFalta) {
    partes.push(`<div class="banda llega" style="left:${porcentaje(inicioFalta)};width:${porcentaje(finDe(indice(fechaNuevo)) - inicioFalta)}"></div>`);
  }

  // [posición, rótulo, fila del rótulo, cómo se alinea con la marca]. Los rótulos son cortos: las fechas están en el texto
  const marcas = [];
  if (finPublicado !== null) marcas.push([finPublicado, 'Publicado', 'abajo', 'transform:none']);
  marcas.push([finHasta, 'Corte pedido', 'abajo', 'transform:translateX(-100%)']);
  if (conEnvio) marcas.push([finDe(indice(fechaProxima)), 'Envío sugerido', 'arriba', 'transform:translateX(-100%)']);
  for (const [posicion, rotulo, fila, alineacion] of marcas) {
    partes.push(`<div class="marca" style="left:${porcentaje(posicion)}"></div><div class="etiqueta ${fila}" style="left:${porcentaje(posicion)};${alineacion}">${rotulo}</div>`);
  }

  // Hoy cae dentro de su casillero según el día del mes
  const diasDelMes = DIAS_DE_CADA_MES[Number(fechaHoy.slice(5, 7)) - 1];
  const avanceDelMes = Math.min(1, Number(fechaHoy.slice(8, 10)) / diasDelMes);
  const posicionHoy = (indice(fechaHoy) + avanceDelMes - inicio) / casilleros;
  partes.push(`<div class="marca hoy" style="left:${porcentaje(posicionHoy)}"></div><div class="etiqueta hoy" style="left:${porcentaje(posicionHoy)}">Hoy</div>`);
  return partes.join('');
}

// ¿Hay algún error en el formulario? true para una lista con elementos, un objeto con algún valor o un texto
function hayErrores(errores) {
  if (Array.isArray(errores)) return errores.length > 0;
  if (errores && typeof errores === 'object') return Object.values(errores).some(Boolean);
  return Boolean(errores);
}

/**
 * ¿Se puede apretar "Proponer actualización"? Solo con una opción de próxima elegida (el índice 0 cuenta), sin errores en
 * el formulario y sin un envío en curso: así el doble clic no manda dos propuestas. `requiereOpcion: false` es para el
 * dataset eventual, que no tiene paso 3 y no elige próxima; los errores y el envío en curso lo frenan igual.
 */
function puedeProponer({ opcionElegida, errores, enviando, requiereOpcion = true } = {}) {
  if (enviando || hayErrores(errores)) return false;
  if (!requiereOpcion) return true;
  return opcionElegida !== null && opcionElegida !== undefined && opcionElegida !== '';
}
