/**
 * Seguimiento de datasets - RPAD (spec 2026-10-20-seguimiento-dataset, "La pantalla")
 * Dos vistas: sin id, la lista de todos los datasets con sus avisos ("Sin elegir"); con ?id=N, el seguimiento de un dataset
 * (la ficha, los avisos del ciclo abierto, la cinta de los últimos 12 meses y los movimientos).
 * La página no recalcula ninguna regla: el estado, los días, los ciclos, los avisos, la cinta (con sus x) y los textos los manda
 * el servidor (services/seguimientoReglas.js y seguimientoCinta.js); acá solo se dibujan. Las fechas se leen como texto
 * (Utils.fechaCorta), nunca con Date. Todo texto que llega del servidor pasa por Utils.escapeHtml.
 * Al cargarse el archivo solo declara: lo que arma HTML es puro (tests/seguimiento-frontend.test.js lo carga en un vm) y lo que
 * toca el DOM o la API va aparte, al final.
 */

// Todos los roles con sesión lo ven; sin sesión, al login
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }
  iniciarSeguimiento();
});

// =====================================================
// Constantes
// =====================================================

// Los filtros de "Sin elegir". "Actualizados" son los `actualizado` (en el RPAD, "Al día" incluye a los próximos)
const FILTROS_LISTA = [['vencidos', 'Vencidos'], ['proximos', 'Próximos a vencer'], ['actualizados', 'Actualizados'], ['eventuales', 'Eventuales'],
  ['sin-fecha', 'Sin fecha'], ['bajas', 'Dados de baja'], ['todos', 'Todos']];
// El filtro de cada estado del servidor (estadoDeSeguimiento: los dos vencidos ya llegan juntos como 'vencido')
const FILTRO_DEL_ESTADO = { vencido: 'vencidos', proximo: 'proximos', actualizado: 'actualizados', eventual: 'eventuales', 'sin-fecha': 'sin-fecha', baja: 'bajas' };
// Estos dos aparecen solo si tienen algo o si están elegidos
const FILTROS_SOLO_SI_HAY = ['sin-fecha', 'bajas'];

// Los filtros de los movimientos: cada movimiento trae su `filtro` del servidor
const FILTROS_MOVIMIENTOS = [['todos', 'Todos'], ['avisos', 'Avisos a DGMIT'], ['area', 'Emails al área'], ['actualizaciones', 'Actualizaciones'],
  ['cambios', 'Cambios en la ficha'], ['propuestas', 'Propuestas'], ['auditoria', 'Notas de auditoría'], ['altas', 'Alta y baja']];
// La lista muestra 10 movimientos y después tandas de 20 (los hitos no cuentan)
const FILAS_INICIALES = 10;
const FILAS_POR_TANDA = 20;

// Las marcas de la lista (clases mk-*) y las insignias del estado (clases sg-*)
const TIPOS_DE_MARCA = ['nota', 'email', 'area', 'act', 'actp', 'cambio', 'cambiop', 'rech', 'alta', 'baja', 'auditoria'];
const ESTADOS_DE_INSIGNIA = ['vencido', 'proximo', 'actualizado', 'eventual', 'sin-fecha', 'baja'];
const ESTADOS_DE_NOTA = { enviada: 'Enviada', pendiente: 'Pendiente de envío', fallida: 'No se pudo enviar' };
const SIN_DATOS_GUARDADOS = 'No quedó guardado: las notas 1/26 y 2/26 son anteriores a ese dato.';
// Copia del mensaje de descargarAnexo (controllers/notasDigitalesController.js): los avisos y las reiteraciones tienen anexo, pero
// no las reiteraciones anteriores al anexo de seguimiento (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2.4)
const NOTA_SIN_ANEXO = 'La nota no tiene anexo';

// La cinta en pantalla: las filas en unidades del espacio de 1000 × 170 (MEDIDAS.pantalla del prototipo), las líneas de los meses
// de 24 a 102 y la línea útil de 30 a 970
const MEDIDAS_CINTA = { etiqueta: 14, arriba: 34, bandaY: 54, bandaH: 22, abajo: 92, vence: 113, vence2: 126, mes: 151, anio: 164, lineaTope: 24, lineaPie: 102 };
const FIN_DE_LA_CINTA = 970;
// Un ciclo que empieza donde termina otro (ciclo o vencido) se dibuja este hueco más adentro, como en el PDF
const HUECO_ENTRE_CICLOS = 1.5;
// Cuánto mide una letra de las etiquetas (la misma medida con la que el servidor decide si entra un texto en la banda)
const LETRA_CINTA = 6.6;
// Las etiquetas se recortan: "Nota n/aa" entre 60 y 940, "vence dd/mm" hasta 940 y "hoy" hasta 956
const TOPES_CINTA = { nota: [60, 940], vence: 940, hoy: 956 };
const TRAMOS_CON_RECTANGULO = ['ciclo', 'vencido', 'futuro', 'eventual'];
// La leyenda de la pantalla: todos los tipos, y el rayado "Vencido"
const LEYENDA_CINTA = [['nota', 'Nota Digital a DGMIT'], ['email', 'Email a DGMIT'], ['area', 'Email al área'], ['act', 'Actualización'],
  ['actp', 'Actualización pendiente'], ['cambio', 'Cambio en la ficha'], ['cambiop', 'Cambio pendiente'], ['rech', 'Propuesta rechazada'],
  ['alta', 'Alta'], ['vencido', 'Vencido']];

const ICONO_DESCARGA = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>';
const ICONO_SOBRE = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>';
const ICONO_ABRIR = '<svg class="flecha-abrir" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

// =====================================================
// Ayudantes (puros)
// =====================================================

function comoLista(valor) {
  return Array.isArray(valor) ? valor : [];
}

function escaparTexto(texto) {
  return Utils.escapeHtml(texto === null || texto === undefined ? '' : String(texto));
}

function esClaveDe(objeto, clave) {
  return typeof clave === 'string' && Object.prototype.hasOwnProperty.call(objeto, clave);
}

// Un número para el HTML (Utils.escapeHtml(0) da '')
function numeroEnTexto(valor) {
  return String(Number(valor) || 0);
}

// "1 día", "81 días"
function diasEnTexto(dias) {
  return `${dias} ${dias === 1 ? 'día' : 'días'}`;
}

// 'AAAA-MM-DD HH:MM:SS' → "13/10/2026 a las 14:50"; un día solo, dd/mm/aaaa; si no es una fecha, '—'
function momentoEnTexto(momento) {
  const texto = typeof momento === 'string' ? momento : '';
  const dia = Utils.fechaCorta(texto);
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(texto) && dia !== Utils.SIN_DATO ? `${dia} a las ${texto.slice(11, 16)}` : dia;
}

// "a@x, b@x" a partir de la lista separada por comas del servidor
function correosEnTexto(texto) {
  return String(texto ?? '').split(',').map((correo) => correo.trim()).filter(Boolean).join(', ');
}

// Sin tildes ni mayúsculas, para buscar
function textoParaBuscar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function porTitulo(a, b) {
  return String(a?.titulo ?? '').localeCompare(String(b?.titulo ?? ''), 'es');
}

// Un botón de filtro, con su cantidad y aria-pressed (el patrón de los estados de datasets.js)
function htmlDeChip(clave, texto, cantidad, presionado) {
  return `<button type="button" class="sg-chip" data-filtro="${escaparTexto(clave)}" aria-pressed="${presionado ? 'true' : 'false'}">${escaparTexto(texto)} <b>${numeroEnTexto(cantidad)}</b></button>`;
}

// Un <dl> con pares [rótulo, HTML ya escapado, clase del dd]
function htmlDeDatos(pares) {
  return `<dl>${pares.map(([rotulo, valor, clase]) => `<dt>${rotulo}</dt><dd${clase ? ` class="${clase}"` : ''}>${valor}</dd>`).join('')}</dl>`;
}

// El nombre del PDF descargado: copia de nombreDelPdf de services/seguimientoReglas.js (si cambia allá, cambia acá)
function nombreDelPdf(titulo, hoy) {
  return `Seguimiento - ${titulo} - ${hoy}.pdf`;
}

// =====================================================
// La lista de "Sin elegir"
// =====================================================

// El filtro al que pertenece un estado del servidor, o null
function filtroDeEstado(estado) {
  return esClaveDe(FILTRO_DEL_ESTADO, estado) ? FILTRO_DEL_ESTADO[estado] : null;
}

// Las filas de un filtro con la búsqueda: "todos" son los activos; la búsqueda, sin tildes ni mayúsculas, en el título o en el área
function filasDelFiltro(filas, filtro, busqueda) {
  const buscado = textoParaBuscar(busqueda);
  return comoLista(filas).filter((fila) => {
    if (!fila || typeof fila !== 'object') return false;
    const enElFiltro = filtro === 'todos' ? fila.activo !== false : filtroDeEstado(fila.estado) === filtro;
    return enElFiltro && (!buscado || textoParaBuscar(fila.titulo).includes(buscado) || textoParaBuscar(fila.area).includes(buscado));
  });
}

// Los vencidos por días (los del servidor, negativos: el que más tiempo lleva vencido arriba); el resto por vencimiento, los sin
// vencimiento al final. A igual valor, por título
function ordenarFilas(filas, filtro) {
  const conNulosAlFinal = (a, b) => {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a < b ? -1 : 1;
  };
  const clave = filtro === 'vencidos'
    ? (fila) => (Number.isFinite(fila.dias) ? fila.dias : null)
    : (fila) => (typeof fila.proxima === 'string' && fila.proxima ? fila.proxima : null);
  return [...comoLista(filas)].sort((a, b) => conNulosAlFinal(clave(a), clave(b)) || porTitulo(a, b));
}

// { vencidos: n, proximos: n, …, todos: n } con la búsqueda aplicada
function cantidadesPorFiltro(filas, busqueda) {
  return Object.fromEntries(FILTROS_LISTA.map(([clave]) => [clave, filasDelFiltro(filas, clave, busqueda).length]));
}

function htmlDeFiltros(cantidades, elegido) {
  const cantidad = (clave) => Number(cantidades?.[clave]) || 0;
  return FILTROS_LISTA
    .filter(([clave]) => !FILTROS_SOLO_SI_HAY.includes(clave) || cantidad(clave) > 0 || clave === elegido)
    .map(([clave, texto]) => htmlDeChip(clave, texto, cantidad(clave), clave === elegido))
    .join('');
}

// La columna "Vencimiento": la fecha, o por qué no la tiene
function vencimientoDeLaFila(fila) {
  if (fila.estado === 'baja') return 'Dado de baja';
  if (fila.proxima) return Utils.fechaCorta(fila.proxima);
  return fila.estado === 'eventual' ? 'Sin vencimiento' : fila.estado === 'sin-fecha' ? 'Sin fecha' : Utils.SIN_DATO;
}

// "11 emails y 1 nota"
function desgloseDeAvisos(avisos) {
  const emails = Number(avisos?.emails) || 0;
  const notas = Number(avisos?.notas) || 0;
  const partes = [];
  if (emails > 0) partes.push(emails === 1 ? '1 email' : `${emails} emails`);
  if (notas > 0) partes.push(notas === 1 ? '1 nota' : `${notas} notas`);
  return partes.join(' y ');
}

// Los avisos a DGMIT del ciclo abierto: sin ciclos (eventual o sin fecha) no hay nada que contar
function htmlDeAvisosDeLaFila(fila) {
  if (fila.estado === 'eventual' || fila.estado === 'sin-fecha') return Utils.SIN_DATO;
  const desglose = desgloseDeAvisos(fila.avisos);
  return `<b>${numeroEnTexto(fila.avisos?.total)}</b>${desglose ? `<small>${desglose}</small>` : ''}`;
}

// Una fila de la tabla: el dataset (link a su seguimiento) y el área con sus etiquetas, el vencimiento, cuánto hace que venció,
// los avisos del ciclo y el último aviso. `pendiente` (del servidor) es cualquier cambio pendiente de aprobación
function htmlDeFilaDeLista(fila) {
  const etiquetas = [
    fila.tipo_gestion === 'interna' ? '<span class="sg-etq interna">Gestión interna</span>' : '',
    fila.pendiente ? '<span class="sg-etq pendiente">Cambio pendiente de aprobación</span>' : ''
  ].filter(Boolean).join(' ');
  const vencido = Number.isFinite(fila.dias) && fila.dias < 0;
  return `<tr>
    <td class="t"><a href="seguimiento.html?id=${escaparTexto(encodeURIComponent(fila.id))}">${escaparTexto(fila.titulo) || 'Sin título'}</a><small>${escaparTexto(fila.area)}</small>${etiquetas}</td>
    <td class="num">${vencimientoDeLaFila(fila)}</td>
    <td class="num${vencido ? ' atraso' : ''}">${vencido ? diasEnTexto(-fila.dias) : Utils.SIN_DATO}</td>
    <td class="avisos">${htmlDeAvisosDeLaFila(fila)}</td>
    <td class="num">${Utils.fechaCorta(fila.ultimo_aviso)}</td>
  </tr>`;
}

function textoSinFilas(busqueda) {
  return textoParaBuscar(busqueda) ? 'No hay datasets que coincidan con lo que buscaste.' : 'No hay datasets con este estado.';
}

// Las sugerencias del buscador: "título — área", también los dados de baja
function textoDeSugerencia(fila) {
  const titulo = String(fila?.titulo ?? '').trim();
  const area = String(fila?.area ?? '').trim();
  return area ? `${titulo} — ${area}` : titulo;
}

function htmlDeSugerencias(filas) {
  return [...comoLista(filas)].filter((fila) => fila && typeof fila === 'object').sort(porTitulo)
    .map((fila) => `<option value="${escaparTexto(textoDeSugerencia(fila))}"></option>`).join('');
}

// El id de la fila cuya sugerencia es exactamente ese texto, o null
function idDeLaSugerencia(texto, filas) {
  const buscado = String(texto ?? '').trim();
  if (!buscado) return null;
  const fila = comoLista(filas).find((f) => f && typeof f === 'object' && textoDeSugerencia(f) === buscado);
  return fila ? fila.id ?? null : null;
}

// =====================================================
// La ficha y el circuito
// =====================================================

function htmlDeDato(rotulo, valor, clase = '') {
  return `<div class="sg-dato"><dt>${rotulo}</dt><dd${clase ? ` class="${clase}"` : ''}>${valor}</dd></div>`;
}

// «Requiere nota DGMIT» como lo manda el servidor (ficha.requiere_nota: 1, 0 o null): Sí, No o Sin dato. Copia mínima de
// textoRequiereNota(valor, 'Sin dato') de services/requiereNotaReglas.js, atada por un test de paridad. El 0 es un valor (No), no
// un vacío: nunca `valor || …`.
function textoDeRequiereNota(valor) {
  if (valor === 1 || valor === true || valor === '1') return 'Sí';
  if (valor === 0 || valor === false || valor === '0') return 'No';
  return 'Sin dato';
}

// "Venció el" (en rojo, con "hace N días") o "Vence el"; sin vencimiento, por qué
function htmlDeVencimientoDeLaFicha(ficha) {
  const estado = ficha.estado ?? {};
  if (Number.isFinite(estado.dias) && estado.dias < 0 && ficha.proxima) {
    return htmlDeDato('Venció el', `${Utils.fechaCorta(ficha.proxima)}, hace ${diasEnTexto(-estado.dias)}`, 'alerta');
  }
  if (ficha.proxima && estado.estado !== 'baja') return htmlDeDato('Vence el', Utils.fechaCorta(ficha.proxima));
  return htmlDeDato('Vencimiento', estado.estado === 'sin-fecha' ? 'Sin fecha' : 'Sin vencimiento');
}

// La ficha (va adentro de section#sg-ficha): el título, la insignia, el área, la baja, los botones y la fila de datos («Requiere
// nota DGMIT» solo en la gestión externa)
function htmlDeFicha(ficha) {
  if (!ficha || typeof ficha !== 'object') return '';
  const estado = ficha.estado ?? {};
  const clase = ESTADOS_DE_INSIGNIA.includes(estado.estado) ? ` sg-${estado.estado}` : '';
  const gestion = ficha.tipo_gestion === 'interna' ? 'gestión interna' : 'gestión externa';
  const baja = ficha.activo === false || ficha.baja
    ? `<p class="sg-area">${ficha.baja ? `Dado de baja el ${Utils.fechaCorta(ficha.baja)}` : 'Dado de baja'}</p>` : '';
  // El link al portal solo si la URL es http/https: un javascript: se ejecutaría al hacer clic
  const portal = Utils.esUrlSegura(ficha.url_dataset)
    ? `<a class="sg-btn sg-btn-borde" href="${Utils.safeUrl(ficha.url_dataset)}" target="_blank" rel="noopener" aria-label="Ver en el portal (se abre en otra pestaña)">Ver en el portal</a>` : '';
  return `<div>
      <h2 class="sg-titulo" id="sg-titulo-dataset">${escaparTexto(ficha.titulo) || 'Sin título'}</h2>
      ${estado.texto ? `<span class="sg-insignia${clase}">${escaparTexto(estado.texto)}</span>` : ''}
      <p class="sg-area">Área responsable: <strong>${escaparTexto(ficha.area) || Utils.SIN_DATO}</strong>, ${gestion}</p>
      ${baja}
    </div>
    <div class="sg-acciones">
      <button type="button" class="sg-btn sg-btn-tinta" data-accion="pdf">${ICONO_DESCARGA}Descargar PDF</button>
      ${portal}
    </div>
    <dl class="sg-datos">
      ${htmlDeDato('Frecuencia', escaparTexto(ficha.frecuencia) || Utils.SIN_DATO)}
      ${htmlDeDato('Datos al', Utils.fechaCorta(ficha.datos_al))}
      ${htmlDeDato('Cargado en el portal', Utils.fechaCorta(ficha.ultima))}
      ${htmlDeVencimientoDeLaFicha(ficha)}
      ${htmlDeDato('Datos solicitados hoy', escaparTexto(ficha.pedido) || Utils.SIN_DATO)}
      ${ficha.tipo_gestion === 'interna' ? '' : htmlDeDato('Requiere nota DGMIT', textoDeRequiereNota(ficha.requiere_nota))}
    </dl>`;
}

// El encabezado del circuito: desde cuándo se cuentan los avisos y el vencimiento del ciclo abierto, con los textos del servidor
// ("Desde la actualización del 16/12/2025 · Vencimiento del 30/11/2026"); sin ciclo, vacío
function textoDeCabezaDelCircuito(circuito) {
  if (!circuito || typeof circuito !== 'object') return '';
  return [circuito.desde?.texto, circuito.vencimiento?.texto].filter((t) => typeof t === 'string' && t).join(' · ');
}

// El circuito del ciclo abierto, con los textos ya armados por el servidor (circuitoDe): el RPAD avisa a DGMIT, ellas mandan la
// nota formal (o relevan) por fuera del RPAD y el área vence o no. Debajo, el email al área: solo en gestión externa y, con
// «Requiere nota DGMIT» en «No», solo si en el ciclo abierto ya se le mandó el email de los 40 días (si no, el servidor manda
// `alArea` en null y no se dibuja). Con «No» el servidor también manda el medio («No hace falta nota formal») y el tramo («Sin
// nota formal»): esta función los dibuja como vienen.
function htmlDelCircuito(circuito) {
  if (!circuito || typeof circuito !== 'object') return '';
  const avisos = circuito.avisos ?? {};
  const medio = circuito.nodoMedio ?? {};
  const fuera = circuito.tramoFuera ?? {};
  const area = circuito.area ?? {};
  const alArea = circuito.alArea?.texto
    ? `<div class="sg-directo"><span class="i">${ICONO_SOBRE}</span><span>${escaparTexto(circuito.alArea.texto)}</span></div>` : '';
  return `<div class="sg-tramos">
      <div class="sg-nodo"><div class="q">RPAD</div><div class="r">Dirección de Datos Públicos y Comunicación</div></div>
      <div class="sg-flecha"><div class="n">${escaparTexto(avisos.titulo)}</div><div class="l" aria-hidden="true"></div><div class="c">${escaparTexto(avisos.texto)}</div></div>
      <div class="sg-nodo"><div class="q">${escaparTexto(medio.nombre)}</div><div class="r">${escaparTexto(medio.rol)}</div></div>
      <div class="sg-flecha fuera"><div class="n">${escaparTexto(fuera.titulo)}</div><div class="l" aria-hidden="true"></div><div class="c">${escaparTexto(fuera.texto)}</div></div>
      <div class="sg-nodo${area.vencido ? ' area' : ''}"><div class="q">${escaparTexto(area.nombre) || Utils.SIN_DATO}</div><div class="r">Área responsable</div><div class="e">${escaparTexto(area.texto)}</div></div>
    </div>${alArea}`;
}

// =====================================================
// La cinta
// =====================================================

// Una coordenada con dos decimales (alcanza para el dibujo y achica el SVG)
function coordenada(valor) {
  return Math.round(valor * 100) / 100;
}

// El ícono de cada marca (los del prototipo, cinta.js): rombo lleno nota, rombo hueco email, círculo punteado email al área,
// círculo verde actualización, círculo verde punteado pendiente, cuadradito azul cambio y punteado pendiente, aro alta y ✕ rechazo
function iconoDeCinta(tipo, cx, cy) {
  const x = coordenada(cx);
  const y = coordenada(cy);
  const cuadrado = (lado, clase, extra = '') =>
    `<rect x="${coordenada(cx - lado / 2)}" y="${coordenada(cy - lado / 2)}" width="${lado}" height="${lado}"${extra} class="${clase}"/>`;
  const girado = ` transform="rotate(45 ${x} ${y})"`;
  switch (tipo) {
    case 'nota': return cuadrado(13, 'i-nota', girado);
    case 'email': return cuadrado(10, 'i-email', girado);
    case 'area': return `<circle cx="${x}" cy="${y}" r="5.5" class="i-area"/>`;
    case 'act': return `<circle cx="${x}" cy="${y}" r="7" class="i-act"/>`;
    case 'actp': return `<circle cx="${x}" cy="${y}" r="6" class="i-actp"/>`;
    case 'cambio': return cuadrado(11, 'i-cambio', ' rx="2"');
    case 'cambiop': return cuadrado(10, 'i-cambiop', ' rx="2"');
    case 'alta': return `<circle cx="${x}" cy="${y}" r="6" class="i-alta"/>`;
    case 'rech': return `<g class="i-rech"><line x1="${coordenada(cx - 5)}" y1="${coordenada(cy - 5)}" x2="${coordenada(cx + 5)}" y2="${coordenada(cy + 5)}"/><line x1="${coordenada(cx + 5)}" y1="${coordenada(cy - 5)}" x2="${coordenada(cx - 5)}" y2="${coordenada(cy + 5)}"/></g>`;
    default: return `<circle cx="${x}" cy="${y}" r="5" class="i-alta"/>`;
  }
}

// La cantidad de marcas que se juntaron: un circulito oscuro arriba a la derecha de la marca, más chico que en el prototipo y un
// poco más arriba, para no tapar los textos de la banda (que el servidor ubica a 11 de cada marca). En la fila de abajo, más
// cerca de la marca: así no se mete en la banda
function cuentaDeCinta(cantidad, cx, cy, fila) {
  const sube = fila === 'abajo' ? 8 : 11;
  const x = coordenada(cx + 8);
  const y = coordenada(cy - sube);
  return `<circle cx="${x}" cy="${y}" r="6.5" class="c-fondo"/><text x="${x}" y="${coordenada(cy - sube + 3.3)}" class="cuenta">${numeroEnTexto(cantidad)}</text>`;
}

// Cuánto ocupa una etiqueta de la cinta, como intervalo centrado en cx
function intervaloDeEtiqueta(texto, cx) {
  const medio = (texto.length * LETRA_CINTA + 2) / 2;
  return [cx - medio, cx + medio];
}

// Las etiquetas de las notas ("Nota 2/26"): si dos se pisan, van juntas ("Nota 2/26 y Nota 3/26"), centradas entre las dos
function etiquetasDeNotas(marcas) {
  const grupos = [];
  const [minimo, maximo] = TOPES_CINTA.nota;
  for (const marca of marcas.filter((m) => m.etiqueta).sort((a, b) => a.x - b.x)) {
    const cx = Math.min(Math.max(marca.x, minimo), maximo);
    const etiqueta = String(marca.etiqueta);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && intervaloDeEtiqueta(etiqueta, cx)[0] < intervaloDeEtiqueta(ultimo.textos.join(' y '), ultimo.cx)[1] + 3) {
      ultimo.textos.push(etiqueta);
      ultimo.cx = (ultimo.desde + cx) / 2;
    } else {
      grupos.push({ textos: [etiqueta], desde: cx, cx });
    }
  }
  return grupos.map((grupo) => ({ cx: grupo.cx, texto: grupo.textos.join(' y ') }));
}

// La cinta de los últimos 12 meses como SVG (viewBox 0 0 1000 170), con los datos de cintaDe tal como llegan: meses, tramos,
// textos, vencimientos, marcas agrupadas (cada una con su <title>) y hoy. Los estilos están en el <style> de seguimiento.html
function svgDeCinta(cinta) {
  if (!cinta || typeof cinta !== 'object') return '';
  const M = MEDIDAS_CINTA;
  const yBanda = M.bandaY + M.bandaH / 2;
  const numero = (valor) => (typeof valor === 'number' && Number.isFinite(valor) ? valor : null);
  const partes = [];

  // Los meses: una línea fina al comienzo de cada uno (y al final del último), el nombre centrado y el año donde corresponde
  const meses = comoLista(cinta.meses).filter((mes) => mes && numero(mes.x0) !== null && numero(mes.x1) !== null);
  for (const mes of meses) {
    const x = coordenada(mes.x0);
    const centro = coordenada((mes.x0 + mes.x1) / 2);
    partes.push(`<line x1="${x}" y1="${M.lineaTope}" x2="${x}" y2="${M.lineaPie}" class="l-mes"/>`);
    partes.push(`<text x="${centro}" y="${M.mes}" class="mes">${escaparTexto(mes.etiqueta)}</text>`);
    if (mes.anio !== null && mes.anio !== undefined) partes.push(`<text x="${centro}" y="${M.anio}" class="anio">${escaparTexto(mes.anio)}</text>`);
  }
  if (meses.length) partes.push(`<line x1="${FIN_DE_LA_CINTA}" y1="${M.lineaTope}" x2="${FIN_DE_LA_CINTA}" y2="${M.lineaPie}" class="l-mes"/>`);

  // La banda: antes del alta, una línea punteada hasta el aro; cada ciclo, lo vencido (rayado), lo que falta hasta el vencimiento
  // y el eventual
  let anterior = null;
  for (const tramo of comoLista(cinta.tramos)) {
    if (!tramo || numero(tramo.x0) === null || numero(tramo.x1) === null) continue;
    const separa = tramo.tipo === 'ciclo' && anterior && (anterior.tipo === 'ciclo' || anterior.tipo === 'vencido') && Math.abs(anterior.x1 - tramo.x0) < 0.01;
    anterior = tramo;
    const x0 = tramo.x0 + (separa ? HUECO_ENTRE_CICLOS : 0);
    if (!(tramo.x1 - x0 > 0)) continue;
    if (tramo.tipo === 'antes') {
      partes.push(`<line x1="${coordenada(x0)}" y1="${yBanda}" x2="${coordenada(Math.max(x0, tramo.x1 - 6))}" y2="${yBanda}" class="l-antes"/>`);
    } else if (TRAMOS_CON_RECTANGULO.includes(tramo.tipo)) {
      partes.push(`<rect x="${coordenada(x0)}" y="${M.bandaY}" width="${coordenada(tramo.x1 - x0)}" height="${M.bandaH}" class="t-${tramo.tipo}"/>`);
    }
  }
  for (const texto of comoLista(cinta.textos)) {
    if (!texto || numero(texto.x) === null) continue;
    if (texto.tipo === 'antes') {
      partes.push(`<text x="${coordenada(texto.x)}" y="${M.bandaY - 5}" class="t-gris">${escaparTexto(texto.texto)}</text>`);
    } else {
      partes.push(`<text x="${coordenada(texto.x)}" y="${yBanda + 4.5}" class="en-banda ${texto.tipo === 'vencido' ? 'ambar' : 'gris'}">${escaparTexto(texto.texto)}</text>`);
    }
  }

  // Los vencimientos: una línea punteada que cruza la banda
  const vencimientos = comoLista(cinta.vencimientos).filter((v) => v && numero(v.x) !== null);
  for (const v of vencimientos) {
    const x = coordenada(v.x);
    partes.push(`<line x1="${x}" y1="${M.bandaY - 8}" x2="${x}" y2="${M.bandaY + M.bandaH + 8}" class="l-vence"/>`);
  }

  // Las marcas, en sus tres filas, cada una con un <title> con las fechas y los textos de lo que agrupa
  const marcas = comoLista(cinta.marcas).filter((m) => m && numero(m.x) !== null && (m.fila === 'banda' || m.fila === 'arriba' || m.fila === 'abajo'));
  for (const marca of marcas) {
    const cy = marca.fila === 'banda' ? yBanda : M[marca.fila];
    const titulo = comoLista(marca.detalle).map(String).join('\n');
    partes.push(`<g class="marca"><title>${escaparTexto(titulo)}</title>${iconoDeCinta(marca.tipo, marca.x, cy)}${marca.cantidad > 1 ? cuentaDeCinta(marca.cantidad, marca.x, cy, marca.fila) : ''}</g>`);
  }
  for (const { cx, texto } of etiquetasDeNotas(marcas)) {
    partes.push(`<text x="${coordenada(cx)}" y="${M.etiqueta}" class="etq-nota">${escaparTexto(texto)}</text>`);
  }

  // Hoy: una línea oscura y "hoy" en el renglón que dijo el servidor; cada "vence dd/mm", en el primer renglón libre (si los dos
  // están ocupados, la etiqueta no va: la línea punteada queda)
  const hoy = cinta.hoy && numero(cinta.hoy.x) !== null ? cinta.hoy : null;
  if (hoy) partes.push(`<line x1="${coordenada(hoy.x)}" y1="${M.bandaY - 12}" x2="${coordenada(hoy.x)}" y2="${M.bandaY + M.bandaH + 12}" class="l-hoy"/>`);
  const renglones = { vence: [], vence2: [] };
  const colocar = (texto, cx, preferidos, clase) => {
    const [a, b] = intervaloDeEtiqueta(texto, cx);
    const renglon = preferidos.find((r) => !renglones[r].some(([c, d]) => a < d + 3 && c < b + 3));
    if (!renglon) return;
    renglones[renglon].push([a, b]);
    partes.push(`<text x="${coordenada(cx)}" y="${M[renglon]}" class="${clase}">${escaparTexto(texto)}</text>`);
  };
  if (hoy) colocar('hoy', Math.min(hoy.x, TOPES_CINTA.hoy), [hoy.renglon === 2 ? 'vence2' : 'vence'], 'hoy');
  for (const v of [...vencimientos].sort((a, b) => a.x - b.x)) colocar(String(v.texto ?? ''), Math.min(v.x, TOPES_CINTA.vence), ['vence', 'vence2'], 'vence');

  return `<svg class="sg-cinta-svg" viewBox="0 0 1000 170" role="img" aria-label="Cinta de los últimos 12 meses: los avisos, las actualizaciones y los cambios. El detalle de cada uno está en la lista de movimientos." xmlns="http://www.w3.org/2000/svg">`
    + '<defs><pattern id="sg-rayado" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" class="r-fondo"/><rect width="3" height="7" class="r-raya"/></pattern></defs>'
    + `${partes.join('')}</svg>`;
}

// La leyenda de la cinta: en pantalla, todos los tipos
function htmlDeLeyenda() {
  return LEYENDA_CINTA.map(([tipo, texto]) => `<span><i class="mk mk-${tipo}" aria-hidden="true"></i>${texto}</span>`).join('');
}

// =====================================================
// Los movimientos
// =====================================================

// Los botones de los filtros: "Todos" siempre; los demás con su cantidad, solo si tienen algo (o si están elegidos)
function htmlDeFiltrosDeMovimientos(movimientos, elegido) {
  const todos = comoLista(movimientos).filter((m) => m && typeof m === 'object');
  return FILTROS_MOVIMIENTOS
    .map(([clave, texto]) => [clave, texto, clave === 'todos' ? todos.length : todos.filter((m) => m.filtro === clave).length])
    .filter(([clave, , cantidad]) => clave === 'todos' || cantidad > 0 || clave === elegido)
    .map(([clave, texto, cantidad]) => htmlDeChip(clave, texto, cantidad, clave === elegido))
    .join('');
}

// Los movimientos del filtro (ya vienen del más nuevo al más viejo) y, solo con "todos", los hitos intercalados por fecha: cada
// hito va antes del primer movimiento de su día o anterior. Cada item: { movimiento } o { hito }
function itemsDeLaLista(movimientos, hitos, filtro) {
  const elegidos = comoLista(movimientos).filter((m) => m && typeof m === 'object' && (filtro === 'todos' || m.filtro === filtro));
  if (filtro !== 'todos') return elegidos.map((movimiento) => ({ movimiento }));
  const deMasNuevo = comoLista(hitos).filter((h) => h && typeof h.fecha === 'string')
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  const items = [];
  let siguiente = 0;
  for (const movimiento of elegidos) {
    while (siguiente < deMasNuevo.length && deMasNuevo[siguiente].fecha >= String(movimiento.fecha ?? '')) items.push({ hito: deMasNuevo[siguiente++] });
    items.push({ movimiento });
  }
  while (siguiente < deMasNuevo.length) items.push({ hito: deMasNuevo[siguiente++] });
  return items;
}

// Lo que se ve al desplegar una Nota Digital a DGMIT. "Descargar la nota y su anexo" solo para administración (los endpoints
// son adminOnly); los nombres de archivo, como en Correos
function htmlDelCuerpoDeNota(extra, esAdmin) {
  const pares = [
    ['Vencimiento informado', Utils.fechaCorta(extra.vencimiento)],
    ['Datos solicitados', escaparTexto(extra.datos_solicitados) || SIN_DATOS_GUARDADOS],
    ['Para', escaparTexto(correosEnTexto(extra.para)) || Utils.SIN_DATO]
  ];
  if (correosEnTexto(extra.cc)) pares.push(['CC', escaparTexto(correosEnTexto(extra.cc))]);
  pares.push(['Enviada', momentoEnTexto(extra.enviada)]);
  pares.push(['Estado', esClaveDe(ESTADOS_DE_NOTA, extra.estado) ? ESTADOS_DE_NOTA[extra.estado] : escaparTexto(extra.estado) || Utils.SIN_DATO]);
  let descarga = '';
  if (esAdmin && extra.nota_id !== null && extra.nota_id !== undefined) {
    const archivo = extra.numero !== null && extra.numero !== undefined && extra.anio
      ? `Nota-Digital-${extra.numero}-${String(extra.anio).slice(-2)}.pdf` : `Nota-Digital-${extra.nota_id}.pdf`;
    descarga = `<button type="button" class="sg-link" data-nota="${escaparTexto(extra.nota_id)}" data-archivo="${escaparTexto(archivo)}">Descargar la nota y su anexo</button> <span class="aclara">(solo administración)</span>`;
  }
  return htmlDeDatos(pares) + descarga;
}

// Un email (a DGMIT o al área): el asunto original (la única cita de los textos viejos), los destinatarios de ese momento, la
// hora y el resultado
function htmlDelCuerpoDeEmail(extra) {
  return htmlDeDatos([
    ['Asunto original', escaparTexto(extra.asunto) || Utils.SIN_DATO, 'sg-asunto'],
    ['Destinatarios', escaparTexto(correosEnTexto(extra.destinatarios)) || Utils.SIN_DATO],
    ['Enviado', momentoEnTexto(extra.enviado)],
    ['Resultado', extra.success ? 'Enviado' : `No se pudo enviar${extra.error ? `: ${escaparTexto(extra.error)}` : ''}`]
  ]);
}

// Un cambio: los campos que cambiaron (lo de antes tachado, lo nuevo resaltado) y cuándo se propuso y se aprobó o rechazó. Las
// actualizaciones anteriores a la doble verificación solo tienen el momento en que se registraron
function htmlDelCuerpoDeCambio(tipo, extra) {
  const pares = comoLista(extra.campos).filter((c) => c && typeof c === 'object').map((c) => [
    escaparTexto(c.campo),
    `<span class="sg-antes">${escaparTexto(c.antes) || Utils.SIN_DATO}</span> a <strong>${escaparTexto(c.despues) || Utils.SIN_DATO}</strong>`
  ]);
  if (extra.cambio_id === null || extra.cambio_id === undefined) {
    pares.push(['Registrado', momentoEnTexto(extra.creado)]);
    return htmlDeDatos(pares);
  }
  pares.push(['Propuesto', momentoEnTexto(extra.creado)]);
  if (tipo === 'actp' || tipo === 'cambiop') pares.push(['Aprobación', 'Pendiente']);
  else pares.push([tipo === 'rech' ? 'Rechazado' : 'Aprobado', momentoEnTexto(extra.revisado)]);
  return htmlDeDatos(pares);
}

function htmlDelCuerpo(m, esAdmin) {
  const extra = m.extra && typeof m.extra === 'object' ? m.extra : {};
  switch (m.tipo) {
    case 'nota': return htmlDelCuerpoDeNota(extra, esAdmin);
    case 'email':
    case 'area': return htmlDelCuerpoDeEmail(extra);
    case 'auditoria': return htmlDeDatos([['Cambio auditado', `#${numeroEnTexto(extra.cambio_id)}`], ['Fecha de la nota', Utils.fechaCorta(m.fecha)]]);
    case 'alta': return htmlDeDatos([
      ['Alta', momentoEnTexto(m.momento)],
      extra.cambio_id ? ['Cambio', `#${numeroEnTexto(extra.cambio_id)}`] : ['Origen', 'Carga inicial del registro']
    ]);
    default: return htmlDelCuerpoDeCambio(m.tipo, extra);
  }
}

// Un movimiento: la fila (un botón que despliega el cuerpo, con aria-expanded y aria-controls) con la fecha, la marca, el título,
// el detalle y quién; el cuerpo, oculto. `i`: su número en la lista, para el id del cuerpo
function htmlDeMovimiento(m, i, { esAdmin = false } = {}) {
  if (!m || typeof m !== 'object') return '';
  const idCuerpo = `sg-cuerpo-${numeroEnTexto(i)}`;
  const tipo = TIPOS_DE_MARCA.includes(m.tipo) ? m.tipo : 'cambio';
  const quien = comoLista(m.quien).map(escaparTexto).filter(Boolean).join('<br>');
  return `<li class="sg-mov"><button type="button" class="sg-fila" aria-expanded="false" aria-controls="${idCuerpo}">`
    + `<span class="f">${Utils.fechaCorta(m.fecha)}</span><i class="mk mk-${tipo}" aria-hidden="true"></i>`
    + `<span><span class="q">${escaparTexto(m.titulo)}</span>${m.detalle ? `<span class="d">${escaparTexto(m.detalle)}</span>` : ''}</span>`
    + `<span class="p">${quien}</span>${ICONO_ABRIR}</button>`
    + `<div class="sg-cuerpo" id="${idCuerpo}" hidden>${htmlDelCuerpo(m, esAdmin)}</div></li>`;
}

// Un hito de vencimiento: no es un movimiento ni se cuenta. En verde si el ciclo se cerró con una actualización
function htmlDeHito(h) {
  if (!h || typeof h !== 'object') return '';
  return `<li class="sg-hito${h.tipo === 'actualizado' ? ' cumplido' : ''}"><span class="f">${Utils.fechaCorta(h.fecha)}</span><span class="t">${escaparTexto(h.texto)}</span></li>`;
}

// Los items de la lista con los movimientos número `desde` a `visibles` - 1. Un hito va con la tanda del movimiento que lo
// precede (los de antes del primer movimiento, con la primera): así una tanda nueva no repite ninguno
function htmlDeMovimientos(items, visibles, { esAdmin = false, desde = 0 } = {}) {
  const partes = [];
  let numero = 0;
  for (const item of comoLista(items)) {
    if (item?.hito) {
      if ((numero > desde || desde === 0) && numero <= visibles) partes.push(htmlDeHito(item.hito));
    } else if (item?.movimiento) {
      if (numero >= desde && numero < visibles) partes.push(htmlDeMovimiento(item.movimiento, numero, { esAdmin }));
      numero += 1;
    }
  }
  if (desde === 0 && numero === 0) return '<li class="sg-sin-movs">No hay movimientos para mostrar.</li>';
  return partes.join('');
}

// "Ver los N anteriores" (de a 20), "Ver el anterior" o '' si ya se ven todos
function textoDeMas(total, visibles) {
  const restantes = total - visibles;
  if (!(restantes > 0)) return '';
  const tanda = Math.min(FILAS_POR_TANDA, restantes);
  return tanda === 1 ? 'Ver el anterior' : `Ver los ${tanda} anteriores`;
}

// =====================================================
// La página (DOM y API)
// =====================================================

// El estado de la vista. `pedido` numera las cargas: una respuesta que llega después de otra más nueva se descarta
const vista = { filas: [], filtro: 'vencidos', busqueda: '', seguimiento: null, filtroMov: 'todos', visibles: FILAS_INICIALES, pedido: 0 };

const porId = (id) => document.getElementById(id);

// Deshabilita el botón mientras dura el pedido (copiado de correos.js)
const conBotonBloqueado = async (boton, tarea) => {
  boton.disabled = true;
  try {
    await tarea();
  } finally {
    boton.disabled = false;
  }
};
// Descarga un Blob con ese nombre de archivo y libera su URL (copiado de correos.js)
const descargarBlob = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Los mensajes del servidor se escapan: showToast inserta HTML
function avisarError(mensaje) {
  if (typeof showToast === 'function') showToast(Utils.escapeHtml(mensaje), 'error');
  else Utils.showError(mensaje);
}

// Sin id, la lista; con id, el dataset y, para las sugerencias del buscador, también la lista
async function iniciarSeguimiento() {
  const id = Utils.getUrlParams().id;
  conectarEventos();
  porId('sg-volver').hidden = !id;
  if (!id) {
    await cargarLista();
    return;
  }
  await Promise.all([cargarDataset(id), cargarSugerencias()]);
}

function conectarEventos() {
  porId('sg-buscar').addEventListener('input', alEscribirEnElBuscador);
  porId('sg-filtros').addEventListener('click', alElegirFiltroDeLista);
  porId('sg-ficha').addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-accion="pdf"]');
    if (boton) descargarPdf(boton);
  });
  porId('sg-filtros-mov').addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-filtro]');
    if (boton) elegirFiltroDeMovimientos(boton.dataset.filtro);
  });
  porId('sg-movimientos').addEventListener('click', alTocarUnMovimiento);
  porId('sg-mas').addEventListener('click', verMasMovimientos);
}

// Los cinco estados de la página: cargando, la lista, el dataset, no encontrado y el error. Solo se ve uno
function mostrarEstado(visibles) {
  for (const id of ['loading', 'vista-lista', 'vista-dataset', 'not-found', 'sg-error']) {
    const elemento = porId(id);
    if (elemento) elemento.hidden = !visibles.includes(id);
  }
}

function mostrarNoEncontrado() {
  mostrarEstado(['not-found']);
  document.title = 'Dataset no encontrado - Seguimiento - RPAD';
}

function mostrarError() {
  mostrarEstado(['sg-error']);
  document.title = 'No se pudo cargar el seguimiento - RPAD';
}

// GET /seguimiento: la lista de "Sin elegir". El dibujo va dentro del mismo try: si un dato raro lo rompe, queda el aviso de error
async function cargarLista() {
  const pedido = ++vista.pedido;
  mostrarEstado(['loading']);
  try {
    const filas = (await API.pedirJson('GET', '/seguimiento'))?.data;
    if (pedido !== vista.pedido) return;
    if (!Array.isArray(filas)) throw new TypeError('La respuesta no es la lista del seguimiento');
    vista.filas = filas;
    porId('sg-sugerencias').innerHTML = htmlDeSugerencias(filas);
    dibujarLista();
    mostrarEstado(['vista-lista']);
  } catch (error) {
    if (pedido !== vista.pedido) return;
    console.error('Error cargando el seguimiento:', error);
    mostrarError();
  }
}

// En la vista de un dataset, la lista solo hace falta para las sugerencias del buscador: si falla, el buscador queda sin ellas
async function cargarSugerencias() {
  try {
    const filas = (await API.pedirJson('GET', '/seguimiento'))?.data;
    if (!Array.isArray(filas)) return;
    vista.filas = filas;
    porId('sg-sugerencias').innerHTML = htmlDeSugerencias(filas);
  } catch (error) {
    console.error('Error cargando las sugerencias del buscador:', error);
  }
}

// Lo que llega es un seguimiento (con su ficha y sus movimientos), no otra respuesta
function esSeguimiento(datos) {
  return Boolean(datos) && typeof datos === 'object' && Boolean(datos.ficha) && typeof datos.ficha === 'object' && Array.isArray(datos.movimientos);
}

// GET /seguimiento/{id}, con el id codificado. Un 404 es "no encontrado"; otro error, el aviso de error. El dibujo va dentro del
// mismo try: si se rompe, el aviso de error y no "Cargando…" para siempre
async function cargarDataset(id) {
  const pedido = ++vista.pedido;
  mostrarEstado(['loading']);
  try {
    const datos = (await API.pedirJson('GET', `/seguimiento/${encodeURIComponent(id)}`))?.data;
    if (pedido !== vista.pedido) return;
    if (!esSeguimiento(datos)) throw new TypeError('La respuesta no es un seguimiento');
    vista.seguimiento = datos;
    vista.filtroMov = 'todos';
    vista.visibles = FILAS_INICIALES;
    dibujarDataset();
    mostrarEstado(['vista-dataset']);
  } catch (error) {
    if (pedido !== vista.pedido) return;
    if (error?.status === 404) {
      mostrarNoEncontrado();
      return;
    }
    console.error('Error cargando el seguimiento del dataset:', error);
    mostrarError();
  }
}

function dibujarLista() {
  const { filas, filtro, busqueda } = vista;
  porId('sg-filtros').innerHTML = htmlDeFiltros(cantidadesPorFiltro(filas, busqueda), filtro);
  const visibles = ordenarFilas(filasDelFiltro(filas, filtro, busqueda), filtro);
  porId('sg-filas').innerHTML = visibles.map(htmlDeFilaDeLista).join('');
  const vacio = porId('sg-vacio');
  vacio.textContent = textoSinFilas(busqueda);
  vacio.hidden = visibles.length > 0;
}

function dibujarDataset() {
  const { ficha, circuito, cinta } = vista.seguimiento;
  porId('sg-ficha').innerHTML = htmlDeFicha(ficha);
  porId('sg-circuito-vencimiento').textContent = textoDeCabezaDelCircuito(circuito);
  porId('sg-circuito').innerHTML = htmlDelCircuito(circuito);
  porId('sg-cinta').innerHTML = svgDeCinta(cinta);
  porId('sg-leyenda').innerHTML = htmlDeLeyenda();
  dibujarMovimientos();
  porId('sg-buscar').value = ficha.titulo ?? '';
  document.title = `${ficha.titulo || 'Dataset'} - Seguimiento - RPAD`;
}

function itemsDeLaVista() {
  const { movimientos, hitos } = vista.seguimiento ?? {};
  return itemsDeLaLista(movimientos, hitos, vista.filtroMov);
}

function actualizarBotonMas(items) {
  const texto = textoDeMas(items.filter((item) => item.movimiento).length, vista.visibles);
  const boton = porId('sg-mas');
  boton.textContent = texto;
  boton.hidden = !texto;
}

// Los filtros, los primeros `visibles` movimientos y el botón "Ver los N anteriores"
function dibujarMovimientos() {
  const items = itemsDeLaVista();
  porId('sg-filtros-mov').innerHTML = htmlDeFiltrosDeMovimientos(vista.seguimiento?.movimientos, vista.filtroMov);
  porId('sg-movimientos').innerHTML = htmlDeMovimientos(items, vista.visibles, { esAdmin: Auth.isAdmin() });
  actualizarBotonMas(items);
}

// Al cambiar de filtro, la lista vuelve a los primeros 10. El foco queda en el botón elegido (el HTML de los filtros se rehace)
function elegirFiltroDeMovimientos(filtro) {
  if (!FILTROS_MOVIMIENTOS.some(([clave]) => clave === filtro)) return;
  vista.filtroMov = filtro;
  vista.visibles = FILAS_INICIALES;
  dibujarMovimientos();
  porId('sg-filtros-mov').querySelector(`button[data-filtro="${filtro}"]`)?.focus();
}

// "Ver los N anteriores": suma la tanda siguiente al final (las filas que ya están quedan como estaban, abiertas o cerradas) y
// lleva el foco a la primera nueva
function verMasMovimientos() {
  const items = itemsDeLaVista();
  const desde = vista.visibles;
  vista.visibles += FILAS_POR_TANDA;
  const lista = porId('sg-movimientos');
  lista.insertAdjacentHTML('beforeend', htmlDeMovimientos(items, vista.visibles, { esAdmin: Auth.isAdmin(), desde }));
  actualizarBotonMas(items);
  lista.querySelectorAll('.sg-fila')[desde]?.focus();
}

// Abre o cierra la fila cuya cabecera se tocó (clic delegado en la lista)
function alternarFila(evento) {
  const cabeza = evento.target.closest('.sg-fila');
  if (!cabeza) return;
  const abrir = cabeza.getAttribute('aria-expanded') !== 'true';
  cabeza.setAttribute('aria-expanded', String(abrir));
  const cuerpo = document.getElementById(cabeza.getAttribute('aria-controls'));
  if (cuerpo) cuerpo.hidden = !abrir;
}

function alTocarUnMovimiento(evento) {
  const descarga = evento.target.closest('button[data-nota]');
  if (descarga) {
    descargarNota(descarga);
    return;
  }
  alternarFila(evento);
}

function alElegirFiltroDeLista(evento) {
  const boton = evento.target.closest('button[data-filtro]');
  const filtro = boton?.dataset.filtro;
  if (!FILTROS_LISTA.some(([clave]) => clave === filtro)) return;
  vista.filtro = filtro;
  dibujarLista();
  porId('sg-filtros').querySelector(`button[data-filtro="${filtro}"]`)?.focus();
}

// Elegir una sugerencia que coincide exacto abre ese dataset; en la vista de lista, además, filtra en vivo
function alEscribirEnElBuscador(evento) {
  const texto = evento.target.value;
  const id = idDeLaSugerencia(texto, vista.filas);
  if (id !== null) {
    window.location.href = `seguimiento.html?id=${encodeURIComponent(id)}`;
    return;
  }
  if (Utils.getUrlParams().id) return;
  vista.busqueda = texto;
  dibujarLista();
}

// El PDF de una hoja, con el JWT en el encabezado (API.pedirArchivo), nunca en la URL
async function descargarPdf(boton) {
  const ficha = vista.seguimiento?.ficha;
  if (!ficha) return;
  await conBotonBloqueado(boton, async () => {
    try {
      const blob = await API.pedirArchivo(`/seguimiento/${encodeURIComponent(ficha.id)}/pdf`);
      descargarBlob(blob, nombreDelPdf(ficha.titulo ?? 'Dataset', Utils.hoyEnArgentina()));
    } catch (error) {
      avisarError(`No se pudo descargar el PDF: ${error.message}`);
    }
  });
}

// La nota y, si tiene (los avisos y las reiteraciones sí, salvo las reiteraciones anteriores al anexo de seguimiento), su anexo
async function descargarNota(boton) {
  const id = boton.dataset.nota;
  const archivo = boton.dataset.archivo;
  await conBotonBloqueado(boton, async () => {
    try {
      descargarBlob(await API.getNotaPdf(id), archivo);
    } catch (error) {
      avisarError(`No se pudo descargar la nota: ${error.message}`);
      return;
    }
    try {
      descargarBlob(await API.getNotaAnexo(id), `Anexo-${archivo}`);
    } catch (error) {
      if (error.message !== NOTA_SIN_ANEXO) avisarError(`Se descargó la nota, pero no su anexo: ${error.message}`);
    }
  });
}
