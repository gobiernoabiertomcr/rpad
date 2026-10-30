/**
 * Admin, fechas de los datasets - RPAD
 *
 * Lo puro que arma la lista de datasets y la ventana "Registrar actualización": la cabecera, las opciones de "Próxima
 * actualización", la línea del ciclo, los valores por defecto, los errores y el cuerpo del POST (spec
 * 2026-10-17-fechas-datasets, sección 8). Se carga antes de admin.js.
 *
 * Al cargarse solo declara: no toca el DOM, `window` ni `Auth`, y `Utils` (api.js) solo se usa al armar HTML. Así
 * tests/admin-frontend.test.js lo carga en un `vm`, como perfil.js y correos.js.
 *
 * La aritmética de las reglas (pedido, opciones de próxima, estado) NO está acá: la hace el servidor
 * (services/fechasDatasetReglas.js) y este archivo solo muestra lo que devuelve. Lo único que se calcula acá son
 * posiciones de pantalla (la línea del ciclo), nombres de meses, fines de mes de los selectores y los topes de las fechas
 * del registro, para avisar en el momento lo mismo que después valida el servidor, con sus mismas palabras.
 *
 * Fechas: siempre 'AAAA-MM-DD'. Las que mysql2 serializa como ISO con hora ('2026-01-31T03:00:00.000Z') se leen por su
 * texto, los primeros 10 caracteres: nunca se pasan por `new Date()` ni por Utils.formatDate, que las correrían un día
 * en un navegador argentino. Febrero va siempre en 28.
 *
 * Estilos: las clases (gdat-chip, gdat-sub, gdat-fecha, gdat-acciones, gdat-btn, gdat-icono, gdat-opcion, pista, banda, marca,
 * etiqueta...) son las del mockup aprobado, docs/superpowers/specs/2026-10-17-fechas-datasets-mockup.html (allí, con el prefijo
 * de antes del 30/10/2026, que ocultaban los bloqueadores de anuncios). Las que no están
 * en el mockup (el texto del pedido y la tarjeta del celular) tienen su estilo en el <style> de admin.html.
 */

const ZONA_HORARIA_ARGENTINA = 'America/Argentina/Buenos_Aires';
const SIN_DATO = '—';
const TEXTO_BLOQUEO = 'Tiene un cambio pendiente de aprobación';
const NOMBRES_DE_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
// Febrero en 28 siempre, también en los años bisiestos
const DIAS_DE_CADA_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Íconos Lucide (check, pencil, history y trash-2). Son decorativos: el botón o el link tiene su texto o su aria-label
const ICONO_REGISTRAR = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg>';
const ICONO_EDITAR = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICONO_SEGUIMIENTO = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>';
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
  return `<span class="gdat-fecha">${textoSeguro(publicado)}</span>`
    + (cargado ? `<span class="gdat-sub">Cargado el ${fechaCorta(cargado)}</span>` : '');
}

/**
 * El texto del pedido; debajo, el tipo y "Vence el dd/mm/aaaa" si la próxima es de hoy en adelante. El texto no lleva la
 * clase de las fechas (que no se parten): "Presupuestos de los ejercicios 2026 y 2027" puede ocupar dos renglones.
 */
function htmlDeProximoPedido(d, hoy) {
  const texto = d.pedido && d.pedido.texto ? d.pedido.texto : SIN_DATO;
  const proxima = soloFecha(d.proxima_actualizacion);
  const detalle = [];
  if (d.tipo_pedido_nombre) detalle.push(d.tipo_pedido_nombre);
  if (proxima && proxima >= hoy) detalle.push(`Vence el ${fechaCorta(proxima)}`);
  return `<span class="gdat-pedido-texto">${textoSeguro(texto)}</span>`
    + (detalle.length ? `<span class="gdat-sub">${detalle.map(textoSeguro).join('. ')}</span>` : '');
}

// El título y el área. `idTitulo` (opcional): el id del título, para que la tarjeta se nombre con él (aria-labelledby)
function htmlDeTitulo(d, idTitulo) {
  return `<span class="gdat-titulo"${idTitulo ? ` id="${idTitulo}"` : ''}>${textoSeguro(d.titulo)}</span>`
    + `<span class="gdat-sub">${textoSeguro(d.area_nombre)}</span>`;
}

// El id del título de la tarjeta de un dataset: solo letras, números, guiones y guiones bajos (un id con espacios o comillas
// no serviría en aria-labelledby). La fila de la tabla no lo lleva: en la página están las dos y el id no se puede repetir
function idDelTituloDeTarjeta(d) {
  return `gdat-tarjeta-${String(d.id ?? '').replace(/[^\w-]/g, '_')}-titulo`;
}

function htmlDePastilla(estado) {
  return `<span class="gdat-chip ${estado.clase}">${textoSeguro(estado.texto)}</span><span class="gdat-sub">${textoSeguro(estado.detalle)}</span>`;
}

/**
 * Registrar, editar y eliminar, más el link "Ver seguimiento". Sin permiso de administración no hay botones ni link. Con un
 * cambio pendiente los tres botones van `disabled`, con el motivo en el `title`; el link no: ver el seguimiento no cambia
 * nada. Los botones llevan data-registrar, data-editar y data-eliminar con el id: el que los usa escucha los clics por
 * delegación, sin onclick (el link navega solo, a seguimiento.html?id=, con el id codificado). Los cuatro tienen aria-label
 * con el título (el de registrar también, porque en el celular se oculta su texto, el span "largo", y el botón se
 * quedaría sin nombre).
 */
function htmlDeAcciones(d, pendiente, esAdmin) {
  if (!esAdmin) return '';
  const id = textoSeguro(d.id);
  const idEnLink = textoSeguro(encodeURIComponent(String(d.id ?? '')));
  const titulo = textoSeguro(d.titulo);
  const bloqueo = pendiente ? ` disabled title="${TEXTO_BLOQUEO}"` : '';
  return '<div class="gdat-acciones">'
    + `<button type="button" class="gdat-btn registrar" data-registrar="${id}" aria-label="Registrar actualización de ${titulo}"${bloqueo}>${ICONO_REGISTRAR}<span class="largo">Registrar actualización</span></button>`
    + `<a class="gdat-icono" href="seguimiento.html?id=${idEnLink}" aria-label="Ver seguimiento de ${titulo}">${ICONO_SEGUIMIENTO}</a>`
    + `<button type="button" class="gdat-icono" data-editar="${id}" aria-label="Editar ${titulo}"${bloqueo}>${ICONO_EDITAR}</button>`
    + `<button type="button" class="gdat-icono borrar" data-eliminar="${id}" aria-label="Eliminar ${titulo}"${bloqueo}>${ICONO_ELIMINAR}</button>`
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
  // La tarjeta se nombra con el título del dataset (Ruling 15)
  const idTitulo = idDelTituloDeTarjeta(d);
  return `<article class="gdat-tarjeta${pendiente ? ' bloqueada' : ''}" aria-labelledby="${idTitulo}">`
    + `<div class="gdat-tarjeta-titulo">${htmlDeTitulo(d, idTitulo)}</div>`
    + `<div class="gdat-tarjeta-estado">${htmlDePastilla(estado)}</div>`
    + '<dl class="gdat-tarjeta-datos">'
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
  return `<label class="gdat-opcion"><input type="radio" name="proxima" value="${valor}"><span>${contenido}</span></label>`;
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
      + (o.sugerida ? '<span class="gdat-sugerida">Sugerida</span>' : '')
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
 *   proxima    el vencimiento
 *   hoy        hoy en Argentina
 *   datosNuevo lo que llega con esta actualización (opcional): mueve la banda verde
 * Sin desde o sin hasta (un eventual, una edición, un relevamiento) da solo la pista vacía.
 *
 * Bandas: publicado, falta (rayada: lo pedido que todavía no llegó) y llega (verde). Marcas: Publicado, Corte pedido, Vence
 * (solo si la próxima es de hoy en adelante) y Hoy. Las posiciones son porcentajes de la pista: cada mes es un
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
  const conVencimiento = fechaProxima !== null && fechaProxima >= fechaHoy;

  // El índice de un mes es año × 12 + mes - 1. La pista cubre desde un mes antes del primero hasta un mes después del último
  const indice = (iso) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
  const todos = [fechaDesde, fechaHasta, fechaHoy, fechaPublicado, fechaNuevo, conVencimiento ? fechaProxima : null].filter(Boolean).map(indice);
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
  if (conVencimiento) marcas.push([finDe(indice(fechaProxima)), 'Vence', 'arriba', 'transform:translateX(-100%)']);
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

// =====================================================
// Registrar actualización: la ventana (spec 8.3)
// =====================================================
// Lo que muestra la ventana y lo que se manda al servidor. Lo que toca el DOM (abrir, leer los campos, pedir las opciones,
// el foco y el teclado) está en admin.js. Las opciones de la próxima las calcula el servidor; acá solo hay topes y fines de
// mes, para avisar en el momento lo mismo que después diría el servidor, con sus mismas palabras.

const PASO1_GENERAL = Object.freeze({
  pregunta: '¿A qué fecha son los datos que llegaron?', ayuda: 'Siempre es fin de mes. Por defecto, lo que se pidió.', soloAnio: false
});
const TEXTOS_DEL_PASO1 = Object.freeze({
  relevamiento: { pregunta: '¿De qué mes es el relevamiento?', ayuda: 'El mes en que se hizo el relevamiento.', soloAnio: false },
  ejercicio: { pregunta: '¿De qué ejercicio es el presupuesto que llegó?', ayuda: 'Se guarda el 31/12 de ese año. Por defecto, lo que se pidió.', soloAnio: true }
});
// Los textos del servidor (controllers/datasetController.js), sin punto final como todos sus mensajes
const ERROR_FALTA_DATOS_AL = 'Falta Datos al: la fecha a la que son los datos que llegaron';
const ERROR_FALTA_CARGA = 'Falta la fecha de carga en el portal';

// «Recibido el» y el origen de los datos (spec 2026-10-24-metricas-y-reportes, 4): la recepción es obligatoria y, en gestión
// externa, también quién entregó los datos. Copias de services/registroReglas.js (el servidor responde 400 con los mismos
// textos y valida igual); un test verifica que sean iguales
const MENSAJE_FALTA_RECIBIDO = 'Indicá cuándo se recibieron los datos.';
const MENSAJE_FALTA_ORIGEN = 'Indicá quién entregó los datos.';
// Las opciones de «¿Quién entregó los datos?», en el orden del servidor
const OPCIONES_ORIGEN = Object.freeze({
  area: 'Los entregó el área',
  fuente_publica: 'Los obtuvo Datos Públicos de una fuente pública'
});

// El origen elegido, 'area' o 'fuente_publica', o null si no es ninguno ('' sin elegir, o cualquier otra cosa)
function origenDelRegistro(valor) {
  return typeof valor === 'string' && Object.hasOwn(OPCIONES_ORIGEN, valor) ? valor : null;
}

/**
 * El origen con que viene la ventana (se puede cambiar): la fuente pública en un externo con «Requiere nota DGMIT: No»; si
 * no, ninguno. Copia deliberada de origenSugerido de services/registroReglas.js: un test verifica que las dos den lo mismo.
 * Ojo: el 0 es un valor y se compara con ===. Sin dataset no tira: no sugiere nada.
 */
function origenSugeridoDe(dataset) {
  const { tipo_gestion, requiere_nota } = dataset ?? {};
  return tipo_gestion === 'externa' && requiere_nota === 0 ? 'fuente_publica' : null;
}

// Cómo se llama la fecha del paso 2: «Obtenido el» si los datos salieron de una fuente pública; si no, «Recibido el». Copia
// de rotuloDeLaFecha de services/registroReglas.js (un test verifica que den lo mismo)
function rotuloDeLaFechaDe(origen) {
  return origen === 'fuente_publica' ? 'Obtenido el' : 'Recibido el';
}

// Las <option> de «¿Quién entregó los datos?»: primero la vacía, después las de OPCIONES_ORIGEN en su orden
function htmlDeOpcionesDeOrigen() {
  return '<option value="">Elegí una opción</option>' + Object.entries(OPCIONES_ORIGEN)
    .map(([valor, texto]) => `<option value="${valor}">${textoSeguro(texto)}</option>`)
    .join('');
}

// Es eventual el dataset sin frecuencia en meses: lo mismo que mira el servidor (esFrecuenciaEventual). No tiene paso 3
function esEventual(dataset) {
  const meses = dataset?.frecuencia_meses;
  return !(Number.isInteger(meses) && meses > 0);
}

// Hoy 'AAAA-MM-DD': el que se recibe o, si no es una fecha, el de Argentina
function hoyDe(hoy) {
  return soloFecha(hoy) ?? hoyEnArgentina();
}

// El último día del mes anterior al de una fecha 'AAAA-MM-DD' (de enero pasa a diciembre del año anterior; febrero en 28)
function finDelMesAnterior(iso) {
  const anio = Number(iso.slice(0, 4));
  const mes = Number(iso.slice(5, 7));
  return mes === 1 ? finDeMesDe(anio - 1, 12) : finDeMesDe(anio, mes - 1);
}

// El "Datos al" más adelantado que se puede registrar (topeDatosAl del servidor): el fin del mes actual o, en un ejercicio,
// el 31/12 del año siguiente, porque el presupuesto de un año se aprueba antes de que empiece
function topeDeDatosAl(tipo, hoy) {
  const fecha = hoyDe(hoy);
  const anio = Number(fecha.slice(0, 4));
  return tipo === 'ejercicio' ? finDeMesDe(anio + 1, 12) : finDeMesDe(anio, fecha.slice(5, 7));
}

/**
 * El "Datos al" con que arranca el paso 1 (spec 8.3), 'AAAA-MM-DD':
 * - lo que se pidió (pedido.hasta), pero nunca después del fin del mes anterior al actual (sin pedido, ese fin de mes);
 * - en un relevamiento, el mes actual;
 * - en un ejercicio, el 31/12 de lo que se pidió (sin pedido, el del año actual), sin pasar del tope del ejercicio.
 * `dataset` es el de GET /datasets; `hoy`, el de Argentina.
 */
function defectoDeDatosAl(dataset, hoy) {
  const d = dataset ?? {};
  const fecha = hoyDe(hoy);
  const hasta = soloFecha(d.pedido?.hasta);
  if (d.tipo_pedido === 'relevamiento') return finDeMesDe(fecha.slice(0, 4), fecha.slice(5, 7));
  if (d.tipo_pedido === 'ejercicio') {
    const ejercicio = finDeMesDe((hasta ?? fecha).slice(0, 4), 12);
    const tope = topeDeDatosAl('ejercicio', fecha);
    return ejercicio > tope ? tope : ejercicio;
  }
  const tope = finDelMesAnterior(fecha);
  const pedido = hasta ? finDeMesDe(hasta.slice(0, 4), hasta.slice(5, 7)) : null;
  return pedido && pedido < tope ? pedido : tope;
}

/**
 * El error del paso 1, o null: "Todavía no puede haber datos al dd/mm/aaaa" si pasa del tope (el fin del mes actual; en
 * un ejercicio, el 31/12 del año siguiente). Son las palabras del servidor, que lo vuelve a validar.
 */
function errorDeDatosAl(datosAl, tipo, hoy) {
  const fecha = soloFecha(datosAl);
  if (!fecha) return ERROR_FALTA_DATOS_AL;
  return fecha > topeDeDatosAl(tipo, hoy) ? `Todavía no puede haber datos al ${fechaCorta(fecha)}` : null;
}

// La pregunta y la ayuda del paso 1 de cada tipo de pedido. soloAnio: el ejercicio se elige solo con el año
function textosDelPaso1(tipo) {
  const textos = Object.prototype.hasOwnProperty.call(TEXTOS_DEL_PASO1, tipo) ? TEXTOS_DEL_PASO1[tipo] : PASO1_GENERAL;
  return { ...textos };
}

// "Datos al" según los selectores del paso 1: el fin del mes elegido o, en un ejercicio, el 31/12 del año. null si no sirven
function datosAlDelPaso1({ tipo, mes, anio } = {}) {
  return tipo === 'ejercicio' ? finDeMesDe(anio, 12) : finDeMesDe(anio, mes);
}

/**
 * El problema del paso 2, { campo, mensaje }, o null. `mensaje` lleva las palabras del servidor, en su mismo orden
 * (errorDelRegistro): la carga en el portal es obligatoria y no puede ser posterior a hoy; la recepción es obligatoria
 * (spec 2026-10-24-metricas-y-reportes, 4) y no puede ser posterior a hoy ni a la carga; y en gestión externa (`gestion`)
 * hay que decir quién entregó los datos (`origen`: 'area' o 'fuente_publica'). `campo` ('cargado', 'recibido' u 'origen')
 * es el campo al que se refiere, para marcarlo (aria-invalid).
 */
function problemaDeFechasDelRegistro({ recibido, cargado, hoy, gestion, origen } = {}) {
  const fecha = hoyDe(hoy);
  const carga = soloFecha(cargado);
  if (!carga) return { campo: 'cargado', mensaje: ERROR_FALTA_CARGA };
  if (carga > fecha) return { campo: 'cargado', mensaje: `La fecha de carga en el portal no puede ser posterior a hoy (${fechaCorta(fecha)})` };
  const recepcion = soloFecha(recibido);
  if (!recepcion) return { campo: 'recibido', mensaje: MENSAJE_FALTA_RECIBIDO };
  if (recepcion > fecha) return { campo: 'recibido', mensaje: `La fecha de recepción no puede ser posterior a hoy (${fechaCorta(fecha)})` };
  if (recepcion > carga) {
    return {
      campo: 'recibido',
      mensaje: `La fecha de recepción (${fechaCorta(recepcion)}) no puede ser posterior a la de carga en el portal (${fechaCorta(carga)})`
    };
  }
  if (gestion === 'externa' && origenDelRegistro(origen) === null) return { campo: 'origen', mensaje: MENSAJE_FALTA_ORIGEN };
  return null;
}

// El error del paso 2 (el mensaje de problemaDeFechasDelRegistro), o null
function errorDeFechasDelRegistro(fechas) {
  return problemaDeFechasDelRegistro(fechas)?.mensaje ?? null;
}

/**
 * La próxima elegida en el paso 3, 'AAAA-MM-DD', o null si todavía no hay una: la fecha de la opción elegida (`opcion` es
 * su índice en `opciones`) o, con "Otra fecha", el fin del mes elegido (si faltan el mes o el año, null). Un eventual no
 * tiene próxima. `formulario` es el de cuerpoDelRegistro.
 */
function proximaDelRegistro(formulario) {
  const f = formulario ?? {};
  if (f.eventual) return null;
  if (f.opcion === 'otra') return finDeMesDe(f.otraAnio, f.otraMes);
  const indice = enteroDe(f.opcion);
  const opciones = Array.isArray(f.opciones) ? f.opciones : [];
  if (indice === null || indice >= opciones.length) return null;
  return soloFecha(opciones[indice]?.fecha);
}

/**
 * El cuerpo de POST /datasets/:id/actualizar: { datos_al, cargado_el, recibido_el, origen_datos, proxima_actualizacion }.
 * `formulario` es lo que dicen los campos de la ventana:
 *   tipo, eventual       el tipo de pedido del dataset y si es eventual (esEventual)
 *   gestion              la gestión del dataset ('externa' o 'interna'): el origen se pregunta solo en la externa
 *   mes, anio            paso 1 (en un ejercicio el mes no cuenta: va el 31/12)
 *   origen               paso 2, «¿Quién entregó los datos?» ('area', 'fuente_publica' o '' sin elegir)
 *   recibido, cargado    paso 2 ('' si están vacíos)
 *   opcion, opciones     paso 3: el valor del radio elegido ('0', '1'... u 'otra'; null sin elegir) y las opciones del servidor
 *   otraMes, otraAnio    los selectores de "Otra fecha"
 * El origen va null en la gestión interna (no se pregunta). Lo vacío o lo que no se puede armar va null: la ventana no deja
 * proponer así, y el servidor lo rechazaría con su mensaje.
 */
function cuerpoDelRegistro(formulario) {
  const f = formulario ?? {};
  return {
    datos_al: datosAlDelPaso1(f),
    cargado_el: soloFecha(f.cargado),
    recibido_el: soloFecha(f.recibido),
    origen_datos: f.gestion === 'externa' ? origenDelRegistro(f.origen) : null,
    proxima_actualizacion: proximaDelRegistro(f)
  };
}

// Los avisos de lo que falta en el paso 2, por campo: se muestran recién cuando la persona pasó por el campo
const FALTA_EN_EL_PASO2 = Object.freeze({ recibido: MENSAJE_FALTA_RECIBIDO, origen: MENSAJE_FALTA_ORIGEN });

/**
 * Cómo queda la ventana con lo que dicen sus campos: { errorFechas, campoFechas, puedeProponer }. errorFechas es el error
 * del paso 2 (o null) para mostrar debajo de sus campos, y campoFechas el campo al que se refiere ('cargado', 'recibido' u
 * 'origen'). "Proponer actualización" se habilita solo con una próxima elegida (completa, si es "Otra fecha"; un eventual no
 * elige), sin error en "Datos al" ni en el paso 2 (que pide la recepción y, en externa, el origen), sin opciones por llegar
 * (`cargando`: la elección se acaba de borrar y el servidor todavía no revisó "Datos al") y sin un envío en curso.
 * `tocados`: los campos del paso 2 por los que ya pasó la persona ('recibido', 'origen'). Que falte uno que todavía no se
 * tocó no se muestra (la ventana recién abierta no dice nada, como con la próxima sin elegir), pero el botón sigue
 * deshabilitado. Los demás errores se muestran siempre.
 */
function revisionDelRegistro({ formulario, errorDatosAl = null, cargando = false, enviando = false, hoy, tocados = [] } = {}) {
  const f = formulario ?? {};
  const problema = problemaDeFechasDelRegistro({
    recibido: f.recibido, cargado: f.cargado, hoy, gestion: f.gestion, origen: f.origen
  });
  const falta = problema !== null && Object.hasOwn(FALTA_EN_EL_PASO2, problema.campo)
    && FALTA_EN_EL_PASO2[problema.campo] === problema.mensaje;
  const callado = falta && !(Array.isArray(tocados) && tocados.includes(problema.campo));
  const errorFechas = callado ? null : (problema?.mensaje ?? null);
  return {
    errorFechas,
    campoFechas: callado ? null : (problema?.campo ?? null),
    puedeProponer: puedeProponer({
      opcionElegida: proximaDelRegistro(f),
      errores: { datosAl: errorDatosAl, fechas: problema?.mensaje ?? null },
      enviando: Boolean(enviando || cargando),
      requiereOpcion: !f.eventual
    })
  };
}

// El texto del pedido actual, arriba de todo en "Datos solicitados" (texto plano: va con textContent)
function textoDelPedidoActual(dataset) {
  const texto = dataset?.pedido?.texto;
  if (typeof texto === 'string' && texto) return texto;
  if (dataset && esEventual(dataset)) return 'Sin pedido automático';
  return 'Sin pedido: no tiene próxima actualización';
}

/**
 * Los datos de la cabecera "Datos solicitados" (los <div><dt><dd> de su <dl>): frecuencia, tipo de pedido, "Vence" (o
 * "Vencido desde", si la próxima ya pasó; un eventual no tiene) y "Publicado hoy": "datos al dd/mm/aaaa" o
 * "ejercicio aaaa". Es la misma información que dibuja la línea del ciclo, en texto.
 */
function htmlDeDatosDelPedido(dataset, hoy) {
  const d = dataset ?? {};
  const fecha = hoyDe(hoy);
  const filas = [['Frecuencia', d.frecuencia_nombre || SIN_DATO], ['Tipo de pedido', d.tipo_pedido_nombre || SIN_DATO]];
  const proxima = soloFecha(d.proxima_actualizacion);
  if (proxima) filas.push([proxima < fecha ? 'Vencido desde' : 'Vence', fechaCorta(proxima)]);
  const datosAl = soloFecha(d.datos_al);
  let publicado = SIN_DATO;
  if (datosAl) publicado = d.tipo_pedido === 'ejercicio' ? `ejercicio ${datosAl.slice(0, 4)}` : `datos al ${fechaCorta(datosAl)}`;
  filas.push(['Publicado hoy', publicado]);
  return filas.map(([rotulo, valor]) => `<div><dt>${textoSeguro(rotulo)}:</dt><dd>${textoSeguro(valor)}</dd></div>`).join('');
}

/**
 * El texto de un error para mostrar en la ventana: el mensaje del servidor tal cual (API lo pasa como Error con el `error`
 * de la respuesta) o, si es una falla de la red (TypeError) o una respuesta que no es JSON (SyntaxError), `porDefecto`.
 */
function textoDeError(error, porDefecto) {
  const mensaje = error && error.name === 'Error' && typeof error.message === 'string' ? error.message.trim() : '';
  return mensaje || porDefecto;
}

// =====================================================
// Formulario del dataset: alta y edición (spec 8.4)
// =====================================================
// Lo que muestra la sección "Actualización y pedido" (el tipo de pedido y su sugerencia, el aviso por las frases de
// período, los selectores de "Datos al" y de la próxima, la vista previa) y el cuerpo de POST y PUT /datasets. Lo que toca
// el DOM está en admin.js. El pedido de la vista previa lo calcula el servidor (GET /datasets/calculo-pedido).

/**
 * Los tipos de pedido, en el orden del servidor, con su nombre en pantalla: [[valor, nombre], ...]. Es una copia de
 * TIPOS_PEDIDO y NOMBRES_TIPO_PEDIDO (services/fechasDatasetReglas.js), porque el formulario ofrece todos y GET /datasets
 * trae solo el nombre de los que se usan. tests/admin-frontend.test.js compara las dos listas.
 */
const TIPOS_DE_PEDIDO = Object.freeze([
  Object.freeze(['acumulado', 'Acumulado']),
  Object.freeze(['foto', 'Foto al corte']),
  Object.freeze(['anio_anterior', 'Año anterior completo']),
  Object.freeze(['ejercicio', 'Ejercicio que empieza']),
  Object.freeze(['edicion', 'Próxima edición']),
  Object.freeze(['relevamiento', 'Relevamiento interno']),
  Object.freeze(['eventual', 'Eventual'])
]);
const ERROR_FALTA_PROXIMA = 'Falta la próxima actualización: es obligatoria salvo con la frecuencia Eventual';
// El "Qué se solicita" que pone la nota cuando el dataset no lo tiene: copia de QUE_SE_SOLICITA_POR_DEFECTO de
// services/notasDigitalesContenido.js, para que la vista previa diga lo mismo. Un test verifica que sean iguales
const QUE_SE_SOLICITA_POR_DEFECTO = 'La versión actualizada del conjunto de datos publicado, con la misma estructura y el mismo nivel de detalle que el archivo disponible en el portal.';
// Lo que avisa el formulario cuando un dataset externo queda sin "Requiere nota DGMIT": copia de MENSAJE_FALTA_REQUIERE_NOTA de
// services/requiereNotaReglas.js (el servidor responde 400 con el mismo texto). Un test verifica que sean iguales
const MENSAJE_FALTA_REQUIERE_NOTA = 'Indicá si el dataset requiere nota DGMIT.';
// La edición no registra actualizaciones (spec 2026-10-24-metricas-y-reportes, 4): si cambian a la vez «Cargado en el portal» y
// la próxima, el servidor responde 400 con este texto. Copia de MENSAJE_EDICION_REGISTRA de services/registroReglas.js; un
// test verifica que sean iguales
const MENSAJE_EDICION_REGISTRA = 'Para registrar una actualización, usá «Registrar actualización».';
// Los años de "Datos al" empiezan acá (el selector se amplía si la fecha guardada es anterior)
const PRIMER_ANIO_DE_DATOS_AL = 2015;

// Una frecuencia con meses (un entero positivo); la Eventual no tiene (null)
function tieneMeses(meses) {
  return Number.isInteger(meses) && meses > 0;
}

/**
 * El tipo de pedido sugerido para una gestión y una frecuencia en meses (spec 5). Copia deliberada de tipoSugerido de
 * services/fechasDatasetReglas.js, que es la que vale (el servidor la usa para un dataset sin tipo): acá solo sirve para
 * el texto de la sugerencia del formulario. Un test verifica que las dos den lo mismo.
 */
function tipoSugeridoDe(gestion, meses) {
  if (!tieneMeses(meses)) return 'eventual';
  if (gestion === 'interna') return 'relevamiento';
  return meses <= 12 ? 'acumulado' : 'foto';
}

/**
 * La frecuencia como sale en la nota (spec 18): un acumulado con una frecuencia de menos de un año (de 1 a 11 meses) lleva
 * "(Acumulado)", porque pide desde el 1/1 del año del corte y la frecuencia sola no lo explica. Copia deliberada de
 * frecuenciaEnNota de services/fechasDatasetReglas.js, que es la que vale: acá solo sirve para la vista previa del
 * formulario. Un test verifica que las dos den lo mismo con cualquier entrada, también null y sin argumento. Sin nombre de
 * frecuencia (null, undefined o '') devuelve lo que recibió: la vista previa pone su "sin dato".
 */
function frecuenciaEnNotaDe(datos) {
  const { frecuencia, tipo, meses } = datos ?? {};
  const esAcumuladoMenorAlAnio = tipo === 'acumulado' && Number.isInteger(meses) && meses >= 1 && meses <= 11;
  return esAcumuladoMenorAlAnio && typeof frecuencia === 'string' && frecuencia.trim() !== ''
    ? `${frecuencia} (${nombreDeTipo('acumulado')})`
    : frecuencia;
}

/**
 * Los tipos que se pueden elegir con una frecuencia (spec 8.4: Eventual va siempre junto con su frecuencia):
 * - con meses, todos menos eventual;
 * - sin meses (null, la frecuencia Eventual), solo eventual;
 * - sin frecuencia elegida todavía (undefined), los mismos que con meses: eventual aparece solo con su frecuencia.
 */
function tiposPermitidos(meses) {
  const todos = TIPOS_DE_PEDIDO.map(([tipo]) => tipo);
  if (meses === undefined || tieneMeses(meses)) return todos.filter((tipo) => tipo !== 'eventual');
  return ['eventual'];
}

function nombreDeTipo(tipo) {
  return TIPOS_DE_PEDIDO.find(([valor]) => valor === tipo)?.[1] ?? '';
}

// Las <option> del selector de tipo de pedido: los permitidos con esa frecuencia, con el elegido marcado
function htmlDeTiposDePedido(meses, seleccionado) {
  return tiposPermitidos(meses)
    .map((tipo) => `<option value="${tipo}"${tipo === seleccionado ? ' selected' : ''}>${textoSeguro(nombreDeTipo(tipo))}</option>`)
    .join('');
}

/**
 * El tipo que queda con una frecuencia: el mismo, si se puede elegir con ella; si no (pasar a Eventual, dejar de serlo, o
 * un tipo que no existe), el sugerido; y si tampoco el sugerido se puede (sin frecuencia elegida), el primero.
 */
function tipoCoherente(tipo, meses, gestion) {
  const permitidos = tiposPermitidos(meses);
  if (permitidos.includes(tipo)) return tipo;
  const sugerido = tipoSugeridoDe(gestion, meses);
  return permitidos.includes(sugerido) ? sugerido : permitidos[0];
}

/**
 * La sugerencia debajo del tipo de pedido (HTML): "Es el sugerido…" o cuál se sugiere, con el botón "Usar el sugerido"
 * (data-usar-sugerido; quien lo usa escucha el clic). `sugerido` null (sin frecuencia elegida): nada.
 */
function htmlDeSugerencia(tipo, sugerido) {
  if (!sugerido) return '';
  if (sugerido === 'eventual') return 'Con la frecuencia Eventual, el tipo de pedido es siempre Eventual.';
  if (tipo === sugerido) return 'Es el sugerido para esta gestión y frecuencia.';
  return `Para esta gestión y frecuencia se sugiere "${textoSeguro(nombreDeTipo(sugerido))}". `
    + '<button type="button" data-usar-sugerido>Usar el sugerido</button>';
}

// Las frases que hablan del período (spec 8.4): en "Qué se solicita" contradirían los "Datos solicitados" de la nota
const FRASES_DE_PERIODO = Object.freeze([
  'siguiente al último', 'nuevo período', 'nuevo ejercicio', 'fecha de corte', 'posterior al último', 'desde la última actualización'
]);

// Minúsculas y sin tildes: "Nuevo Periodo" y "nuevo período" se comparan igual
function sinTildes(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Las frases de período que tiene un texto, sin distinguir mayúsculas ni tildes, en el orden de la lista y como se escriben ahí
function frasesDePeriodo(texto) {
  if (typeof texto !== 'string' || !texto) return [];
  const comparable = sinTildes(texto);
  return FRASES_DE_PERIODO.filter((frase) => comparable.includes(sinTildes(frase)));
}

// ¿Se avisa por las frases de período? Solo si el tipo pone fechas en la nota; en relevamiento, edición y eventual no contradicen nada
function avisarFrases(tipo) {
  return ['acumulado', 'foto', 'anio_anterior', 'ejercicio'].includes(tipo);
}

// "a", "a y b", "a, b y c"
function unirConY(partes) {
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : partes.join('');
}

// El aviso en ámbar (no bloquea) por las frases de período encontradas, o null si no hay ninguna
function textoDeAvisoDeFrases(frases) {
  const lista = Array.isArray(frases) ? frases : [];
  if (lista.length === 0) return null;
  const varias = lista.length > 1;
  return `${unirConY(lista.map((frase) => `"${frase}"`))} ${varias ? 'hablan' : 'habla'} del período, y eso lo agrega el sistema en `
    + `"Datos solicitados". Conviene ${varias ? 'sacarlas' : 'sacarlo'} para que la nota no se contradiga.`;
}

/**
 * La fecha de un par de selectores de mes y año (o solo de año, en un ejercicio), 'AAAA-MM-DD' o null. Ruling 18: si el mes
 * y el año siguen siendo los de la fecha guardada (`original`, 'AAAA-MM-DD' o ISO con hora), va la guardada tal cual,
 * aunque no sea fin de mes: el formulario no corrige en silencio una fecha que nadie tocó (y el servidor la rechazaría como
 * un cambio). Si cambiaron, el fin del mes elegido, con febrero en 28 (solo el año: el 31/12). Sin mes o sin año
 * ("Sin dato"), null.
 * Solo el año (Ruling 20): en un ejercicio "Datos al" es el 31/12 del ejercicio publicado, así que una guardada de otro día
 * (un dataset que pasa a ejercicio) va como el 31/12 de su año: el selector muestra solo el año y es lo que se ve.
 */
function fechaDeSelectores({ mes, anio, soloAnio = false, original } = {}) {
  const guardada = soloFecha(original);
  const elegidoAnio = enteroDe(anio);
  const elegidoMes = soloAnio ? null : enteroDe(mes);
  const mismoAnio = elegidoAnio === (guardada ? Number(guardada.slice(0, 4)) : null);
  const mismoMes = soloAnio || elegidoMes === (guardada ? Number(guardada.slice(5, 7)) : null);
  if (mismoAnio && mismoMes) return soloAnio && guardada && !guardada.endsWith('-12-31') ? finDeMesDe(elegidoAnio, 12) : guardada;
  if (elegidoAnio === null || (!soloAnio && elegidoMes === null)) return null;
  return finDeMesDe(elegidoAnio, soloAnio ? 12 : elegidoMes);
}

/**
 * Los selectores de "Datos al" del formulario: { mes, anio } (sus <option>), mesOculto y anioDeshabilitado.
 * - Con mes y año: el mes empieza con "Sin dato" (sin dato, el año queda deshabilitado mostrando el suyo o el actual).
 *   Los años van hasta el actual. Un año elegido sin mes (al dejar de ser ejercicio) pasa a diciembre.
 * - En un ejercicio (soloAnio): solo el año, que empieza con "Sin dato" y llega hasta el año siguiente. El mes queda oculto
 *   con su valor, así volver a otro tipo no lo pierde.
 * `mes` y `anio` son los valores actuales (números o el texto de un select); `sinDato`, si "Datos al" está vacío.
 */
function selectoresDeDatosAl({ mes, anio, sinDato = false, soloAnio = false, hoy } = {}) {
  const anioDeHoy = Number(hoyDe(hoy).slice(0, 4));
  const elegidoAnio = enteroDe(anio);
  if (soloAnio) {
    return {
      mes: `<option value="">Sin dato</option>${opcionesDeMes(enteroDe(mes))}`,
      anio: `<option value=""${sinDato ? ' selected' : ''}>Sin dato</option>`
        + opcionesDeAnio(PRIMER_ANIO_DE_DATOS_AL, anioDeHoy + 1, sinDato ? null : elegidoAnio),
      mesOculto: true,
      anioDeshabilitado: false
    };
  }
  return {
    mes: `<option value="">Sin dato</option>${opcionesDeMes(sinDato ? null : (enteroDe(mes) ?? 12))}`,
    anio: opcionesDeAnio(PRIMER_ANIO_DE_DATOS_AL, anioDeHoy, elegidoAnio ?? anioDeHoy),
    mesOculto: false,
    anioDeshabilitado: sinDato
  };
}

// Los selectores de la próxima: { mes, anio }, con "Mes" y "Año" primero y la fecha guardada elegida. Los años, del anterior
// al actual hasta diez años adelante (se amplían si la guardada queda afuera)
function selectoresDeProxima(proxima, hoy) {
  const fecha = soloFecha(proxima);
  const anioDeHoy = Number(hoyDe(hoy).slice(0, 4));
  return {
    mes: `<option value="">Mes</option>${opcionesDeMes(fecha ? Number(fecha.slice(5, 7)) : null)}`,
    anio: `<option value="">Año</option>${opcionesDeAnio(anioDeHoy - 1, anioDeHoy + 10, fecha ? Number(fecha.slice(0, 4)) : null)}`
  };
}

/**
 * El tipo de pedido que se manda. Ruling 18: si el selector sigue en el tipo con que abrió el formulario (el efectivo,
 * tipo_pedido de GET /datasets/:id), va el guardado (tipo_pedido_guardado), aunque sea null: un dataset sin tipo guardado
 * usa el sugerido. Pero si con la gestión y la frecuencia de ahora el sugerido ya no es el que se ve, va el que se ve: si
 * no, se guardaría otro tipo que el de la vista previa. Si se cambió, o en un alta, va el elegido.
 */
function tipoAEnviar({ tipo, gestion, meses, original } = {}) {
  const elegido = typeof tipo === 'string' && tipo ? tipo : null;
  if (!original || elegido !== original.tipo_pedido) return elegido;
  const guardado = original.tipo_pedido_guardado ?? null;
  if (TIPOS_DE_PEDIDO.some(([valor]) => valor === guardado)) return guardado;
  return tipoSugeridoDe(gestion, meses) === elegido ? guardado : elegido;
}

/**
 * "Requiere nota DGMIT" como lo guarda el servidor: 1 (Sí), 0 (No) o null (sin elegir). Lo que dice el selector es '' (sin
 * elegir), '1' o '0'; también se aceptan los números 1 y 0, que son lo que guarda la base. Ojo: el 0 es un valor, no "falta",
 * así que nada de `valor || null`.
 */
function requiereNotaDe(valor) {
  const texto = String(valor ?? '');
  if (texto === '1') return 1;
  if (texto === '0') return 0;
  return null;
}

/**
 * El aviso de un dataset externo que quedó sin elegir "Requiere nota DGMIT" (MENSAJE_FALTA_REQUIERE_NOTA), o null. Una
 * interna no lleva el dato, y sin gestión elegida todavía no hay nada que exigir. Es copia de la regla del servidor
 * (datasetController.js): el servidor valida igual.
 */
function errorDeRequiereNota({ gestion, valor } = {}) {
  return gestion === 'externa' && requiereNotaDe(valor) === null ? MENSAJE_FALTA_REQUIERE_NOTA : null;
}

// Cómo se muestra el dato en la nota: Sí, No o una raya (copia de textoRequiereNota de services/requiereNotaReglas.js)
function textoDeRequiereNota(valor) {
  const requiere = requiereNotaDe(valor);
  if (requiere === 1) return 'Sí';
  if (requiere === 0) return 'No';
  return SIN_DATO;
}

/**
 * El cuerpo de POST /datasets (alta) y PUT /datasets/:id (edición). `formulario` es lo que dicen los campos:
 *   titulo, area_id, descripcion, tema_principal_id, tema_secundario_id, frecuencia_id, formatos, url_dataset,
 *   observaciones, que_se_solicita, tipo_gestion, tipo_pedido   como en los campos (los ids, como texto)
 *   requiere_nota                 "Requiere nota DGMIT": '', '1' o '0'; va como null, 1 o 0, y siempre null con la gestión interna
 *   meses                         los de la frecuencia elegida: un número, null si es Eventual, undefined sin elegir
 *   cargado                       "Cargado en el portal el" ('AAAA-MM-DD' o ''): va como ultima_actualizacion
 *   datosMes, datosAnio           "Datos al" (en un ejercicio cuenta solo el año)
 *   proxMes, proxAnio             la próxima actualización
 *   original                      el dataset de GET /datasets/:id al editar; null en un alta
 * Las fechas que nadie tocó van como están guardadas (Ruling 18) y las cambiadas, como fin de mes. Con la frecuencia
 * Eventual la próxima va vacía.
 */
function cuerpoDelDataset(formulario) {
  const f = formulario ?? {};
  const original = f.original ?? null;
  const texto = (valor) => (typeof valor === 'string' ? valor : '');
  return {
    titulo: texto(f.titulo),
    area_id: enteroDe(f.area_id),
    descripcion: texto(f.descripcion),
    tema_principal_id: enteroDe(f.tema_principal_id),
    tema_secundario_id: enteroDe(f.tema_secundario_id),
    frecuencia_id: enteroDe(f.frecuencia_id),
    formatos: Array.isArray(f.formatos) ? [...f.formatos] : [],
    tipo_gestion: texto(f.tipo_gestion),
    requiere_nota: f.tipo_gestion === 'interna' ? null : requiereNotaDe(f.requiere_nota),
    tipo_pedido: tipoAEnviar({ tipo: f.tipo_pedido, gestion: f.tipo_gestion, meses: f.meses, original }),
    ultima_actualizacion: soloFecha(f.cargado),
    datos_al: fechaDeSelectores({
      mes: f.datosMes, anio: f.datosAnio, soloAnio: f.tipo_pedido === 'ejercicio', original: original?.datos_al
    }),
    proxima_actualizacion: f.meses === null
      ? null
      : fechaDeSelectores({ mes: f.proxMes, anio: f.proxAnio, original: original?.proxima_actualizacion }),
    url_dataset: texto(f.url_dataset) || null,
    observaciones: texto(f.observaciones) || null,
    que_se_solicita: texto(f.que_se_solicita).trim() || null
  };
}

/**
 * La huella del formulario: lo que se mandaría (cuerpoDelDataset), como texto, con los formatos ordenados (el orden en que
 * se eligieron no cambia nada). Se toma al abrir el formulario, con lo importado ya puesto, y sirve para saber si hay
 * cambios sin guardar (Ruling 19).
 */
function huellaDelFormulario(formulario) {
  const cuerpo = cuerpoDelDataset(formulario);
  return JSON.stringify({ ...cuerpo, formatos: [...cuerpo.formatos].map(String).sort() });
}

// ¿El formulario cambia lo que se mandaría respecto de la huella tomada al abrirlo? Sin huella (cerrado), no
function hayCambiosSinGuardar(huella, formulario) {
  return typeof huella === 'string' && huellaDelFormulario(formulario) !== huella;
}

/**
 * Lo que se revisa antes de proponer, con el error de cada campo o null: { formatos, requiereNota, datosAl, proxima, edicion }.
 * - formatos: al menos uno;
 * - requiereNota: un externo tiene que decir si requiere nota DGMIT (errorDeRequiereNota);
 * - datosAl: uno nuevo (distinto del guardado) no pasa del tope, con las palabras del servidor (topeDeDatosAl);
 * - proxima: fuera de la frecuencia Eventual es obligatoria (la exige el formulario; el servidor no, spec 10.1);
 * - edicion: una edición que, contra lo guardado (`original`), cambia a la vez «Cargado en el portal» y la próxima es
 *   registrar una actualización, y eso va por «Registrar actualización» (MENSAJE_EDICION_REGISTRA; spec
 *   2026-10-24-metricas-y-reportes, 4). Se compara como el servidor: por el día, y lo vacío cuenta como un valor. En un
 *   alta no hay nada guardado.
 * Lo demás lo revisan el navegador (los campos obligatorios) y el servidor. `formulario`: el de cuerpoDelDataset.
 */
function problemasDelFormulario(formulario, hoy) {
  const f = formulario ?? {};
  const cuerpo = cuerpoDelDataset(f);
  let proxima = null;
  if (tieneMeses(f.meses) && !cuerpo.proxima_actualizacion) {
    const elegidos = [f.proxMes, f.proxAnio].filter((valor) => enteroDe(valor) !== null).length;
    proxima = elegidos === 1 ? 'Elegí el mes y el año de la próxima actualización' : ERROR_FALTA_PROXIMA;
  }
  const datosAl = cuerpo.datos_al;
  const nuevo = Boolean(datosAl) && datosAl !== soloFecha(f.original?.datos_al);
  const original = f.original ?? null;
  const cambia = (campo) => (cuerpo[campo] ?? '') !== (soloFecha(original?.[campo]) ?? '');
  return {
    formatos: Array.isArray(f.formatos) && f.formatos.length > 0 ? null : 'Elegí al menos un formato',
    requiereNota: errorDeRequiereNota({ gestion: f.tipo_gestion, valor: f.requiere_nota }),
    datosAl: nuevo && datosAl > topeDeDatosAl(f.tipo_pedido, hoy) ? `Todavía no puede haber datos al ${fechaCorta(datosAl)}` : null,
    proxima,
    edicion: original && cambia('ultima_actualizacion') && cambia('proxima_actualizacion') ? MENSAJE_EDICION_REGISTRA : null
  };
}

/**
 * Los textos de la vista previa "Así va a salir en la próxima nota", menos los datos solicitados (los calcula el servidor):
 * { cabecera, titulo, frecuencia, conRequiereNota, requiereNota, solicita }. `frecuencia` es el nombre de la elegida, con
 * "(Acumulado)" si corresponde (frecuenciaEnNotaDe con el tipo y los meses de la frecuencia), o una raya si no hay una
 * elegida. `requiereNota` es lo que elige el selector ('1', '0' o ''); sale como Sí, No o una raya, y la columna "Requiere
 * nota DGMIT" (`conRequiereNota`) es solo de la gestión externa: una interna sigue con tres columnas, como su nota. Sin
 * "Qué se solicita", el texto por defecto.
 */
function textosDeVistaPrevia({ titulo, gestion, solicita, frecuencia, tipo, meses, requiereNota } = {}) {
  const limpio = (valor) => (typeof valor === 'string' ? valor.trim() : '');
  const nombre = limpio(frecuencia);
  return {
    cabecera: gestion ? `Nota Digital de gestión ${gestion} (vista previa)` : 'Nota Digital (vista previa)',
    titulo: limpio(titulo) || 'Título del dataset',
    frecuencia: nombre ? frecuenciaEnNotaDe({ frecuencia: nombre, tipo, meses }) : SIN_DATO,
    conRequiereNota: gestion === 'externa',
    requiereNota: textoDeRequiereNota(requiereNota),
    solicita: limpio(solicita) || QUE_SE_SOLICITA_POR_DEFECTO
  };
}

// El aviso debajo de la próxima con la frecuencia Eventual: si había una próxima guardada, que va a quedar vacía
function textoDeProximaEventual(proximaGuardada) {
  return soloFecha(proximaGuardada)
    ? 'Con la frecuencia Eventual, la próxima actualización queda vacía.'
    : 'Con la frecuencia Eventual no hay próxima actualización.';
}
