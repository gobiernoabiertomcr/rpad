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

// Los filtros de los movimientos: cada movimiento trae su `filtro` del servidor ('dgmit': las notas DGMIT al área, también las
// anuladas; spec 2026-10-24-notas-dgmit, 6)
const FILTROS_MOVIMIENTOS = [['todos', 'Todos'], ['avisos', 'Avisos a DGMIT'], ['area', 'Emails al área'], ['dgmit', 'Notas DGMIT'],
  ['actualizaciones', 'Actualizaciones'], ['cambios', 'Cambios en la ficha'], ['propuestas', 'Propuestas'], ['auditoria', 'Notas de auditoría'],
  ['altas', 'Alta y baja']];
// La lista muestra 10 movimientos y después tandas de 20 (los hitos no cuentan)
const FILAS_INICIALES = 10;
const FILAS_POR_TANDA = 20;

// Las marcas de la lista (clases mk-*) y las insignias del estado (clases sg-*)
const TIPOS_DE_MARCA = ['nota', 'email', 'area', 'dgmit', 'act', 'actp', 'cambio', 'cambiop', 'rech', 'alta', 'baja', 'auditoria'];
const ESTADOS_DE_INSIGNIA = ['vencido', 'proximo', 'actualizado', 'eventual', 'sin-fecha', 'baja'];
const ESTADOS_DE_NOTA = { enviada: 'Enviada', pendiente: 'Pendiente de envío', fallida: 'No se pudo enviar' };
const SIN_DATOS_GUARDADOS = 'No quedó guardado: las notas 1/26 y 2/26 son anteriores a ese dato.';
// Copia del mensaje de descargarAnexo (controllers/notasDigitalesController.js): los avisos y las reiteraciones tienen anexo, pero
// no las reiteraciones anteriores al anexo de seguimiento (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2.4)
const NOTA_SIN_ANEXO = 'La nota no tiene anexo';
// Los tipos de nota DGMIT: copia de TEXTO_TIPO_NOTA_DGMIT (services/notasDgmitReglas.js), atada por un test de paridad, y lo que
// dice cada uno al desplegar el movimiento (spec 2026-10-24-notas-dgmit, 6)
const TIPOS_NOTA_DGMIT = { solicitud: 'Solicitud', reiteracion: 'Reiteración' };
const TIPOS_NOTA_DGMIT_LARGOS = {
  solicitud: 'Solicitud: la primera vez que se le piden los datos al área',
  reiteracion: 'Reiteración: ya se le habían pedido y se le vuelven a pedir'
};
// Cada entrada del historial de una nota DGMIT, en su detalle
const ACCIONES_DE_NOTA_DGMIT = { correccion: 'Corregida', anulacion: 'Anulada' };

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
const LEYENDA_CINTA = [['nota', 'Nota Digital a DGMIT'], ['email', 'Email a DGMIT'], ['area', 'Email al área'], ['dgmit', 'Nota DGMIT al área'],
  ['act', 'Actualización'], ['actp', 'Actualización pendiente'], ['cambio', 'Cambio en la ficha'], ['cambiop', 'Cambio pendiente'],
  ['rech', 'Propuesta rechazada'], ['alta', 'Alta'], ['vencido', 'Vencido']];

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

// La columna "Última nota DGMIT al área": la nota del ciclo abierto tal como la manda el servidor (`nota_dgmit`: { numero, tipo,
// recibida } o null), con el número y abajo, más chico, el tipo y el día en que el área la recibió; sin nota, una raya
function htmlDeNotaDgmitDeLaFila(nota) {
  if (!nota || typeof nota !== 'object' || !String(nota.numero ?? '').trim()) return Utils.SIN_DATO;
  const tipo = esClaveDe(TIPOS_NOTA_DGMIT, nota.tipo) ? TIPOS_NOTA_DGMIT[nota.tipo] : '';
  return `<b>N° ${escaparTexto(nota.numero)}</b><small>${tipo ? `${tipo}, recibida` : 'Recibida'} el ${Utils.fechaCorta(nota.recibida)}</small>`;
}

// Una fila de la tabla: el dataset (link a su seguimiento) y el área con sus etiquetas, el vencimiento, cuánto hace que venció,
// los avisos del ciclo, el último aviso y la última nota DGMIT al área. `pendiente` (del servidor) es cualquier cambio pendiente de
// aprobación
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
    <td class="nota-dgmit">${htmlDeNotaDgmitDeLaFila(fila.nota_dgmit)}</td>
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
// Con una nota DGMIT cargada en el ciclo abierto (`tramoFuera.registrada`, spec 2026-10-24-notas-dgmit, 6) el tramo es una línea llena
// violeta (`sg-flecha registrada`); sin nota, la punteada gris de siempre (`sg-flecha fuera`). En alto contraste se distinguen por el
// trazo (lleno o punteado).
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
      <div class="sg-flecha ${fuera.registrada === true ? 'registrada' : 'fuera'}"><div class="n">${escaparTexto(fuera.titulo)}</div><div class="l" aria-hidden="true"></div><div class="c">${escaparTexto(fuera.texto)}</div></div>
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
// círculo verde actualización, círculo verde punteado pendiente, cuadradito azul cambio y punteado pendiente, aro alta y ✕ rechazo;
// la nota DGMIT al área, una hoja violeta (un rectángulo lleno de 10 × 13)
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
    case 'dgmit': return `<rect x="${coordenada(cx - 5)}" y="${coordenada(cy - 6.5)}" width="10" height="13" rx="1.5" class="i-dgmit"/>`;
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

// "16/10/2026 a las 09:30, por Diego Cuatro" (sin nombre, solo el momento), con el nombre escapado
function momentoConQuien(momento, por) {
  const nombre = String(por ?? '').trim();
  return `${momentoEnTexto(momento)}${nombre ? `, por ${escaparTexto(nombre)}` : ''}`;
}

// Lo que se ve al desplegar una nota DGMIT (spec 2026-10-24-notas-dgmit, 3 y 6): el número, el tipo (el texto largo), el día en que la
// recibió el área, el área (la del dataset hoy), todos los datasets de la nota (uno por renglón), quién la cargó y cuándo, y cada
// corrección o anulación del historial (la más nueva primero, como llega). "Corregir" y "Anular" solo si el servidor dice que quien
// mira puede (`editable`: quien la cargó o administración; solo cuenta el true literal) y la nota no está anulada. Los botones llevan
// el id de la nota (los conecta la página) y un nombre accesible propio ("Corregir la nota DGMIT N° 156/26"): en la lista puede haber
// varias notas desplegadas. La fila de la anulación va en rojo y negrita (`motivo-anulacion`)
function htmlDelCuerpoDeNotaDgmit(extra) {
  const datasets = comoLista(extra.datasets).filter((d) => d && typeof d === 'object' && String(d.titulo ?? '').trim())
    .map((d) => escaparTexto(d.titulo)).join('<br>');
  const pares = [
    ['Número de nota DGMIT', escaparTexto(extra.numero) || Utils.SIN_DATO],
    ['Tipo de nota', esClaveDe(TIPOS_NOTA_DGMIT_LARGOS, extra.tipo) ? TIPOS_NOTA_DGMIT_LARGOS[extra.tipo] : escaparTexto(extra.tipo) || Utils.SIN_DATO],
    ['Recibida por el área', Utils.fechaCorta(extra.recibida)],
    ['Área', escaparTexto(extra.area) || Utils.SIN_DATO],
    ['Datasets de la nota', datasets || Utils.SIN_DATO],
    ['Cargada', momentoConQuien(extra.cargada, extra.por)]
  ];
  for (const entrada of comoLista(extra.historial)) {
    if (!entrada || typeof entrada !== 'object' || !esClaveDe(ACCIONES_DE_NOTA_DGMIT, entrada.accion)) continue;
    const motivo = String(entrada.motivo ?? '').trim();
    pares.push([ACCIONES_DE_NOTA_DGMIT[entrada.accion], `${momentoConQuien(entrada.momento, entrada.por)}${motivo ? `: ${escaparTexto(motivo)}` : ''}`,
      entrada.accion === 'anulacion' ? 'motivo-anulacion' : '']);
  }
  const id = extra.nota_id;
  if (extra.editable !== true || extra.anulada || id === null || id === undefined) return htmlDeDatos(pares);
  const numero = escaparTexto(extra.numero);
  const boton = (accion, texto) => `<button type="button" class="sg-link" data-accion="${accion}" data-nota="${escaparTexto(id)}" `
    + `aria-label="${texto} la nota DGMIT${numero ? ` N° ${numero}` : ''}">${texto}</button>`;
  return `${htmlDeDatos(pares)}<div class="sg-acciones-nota">${boton('corregir-nota', 'Corregir')}${boton('anular-nota', 'Anular')}`
    + '<span class="aclara">Lo ven quien la cargó y administración.</span></div>';
}

function htmlDelCuerpo(m, esAdmin) {
  const extra = m.extra && typeof m.extra === 'object' ? m.extra : {};
  switch (m.tipo) {
    case 'nota': return htmlDelCuerpoDeNota(extra, esAdmin);
    case 'dgmit': return htmlDelCuerpoDeNotaDgmit(extra);
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
// el detalle y quién; el cuerpo, oculto. `i`: su número en la lista, para el id del cuerpo. Una nota DGMIT anulada lleva la clase
// `anulada` (el título tachado y en gris, la marca hueca)
function htmlDeMovimiento(m, i, { esAdmin = false } = {}) {
  if (!m || typeof m !== 'object') return '';
  const idCuerpo = `sg-cuerpo-${numeroEnTexto(i)}`;
  const tipo = TIPOS_DE_MARCA.includes(m.tipo) ? m.tipo : 'cambio';
  const quien = comoLista(m.quien).map(escaparTexto).filter(Boolean).join('<br>');
  const clase = m.tipo === 'dgmit' && m.extra?.anulada ? 'sg-mov anulada' : 'sg-mov';
  return `<li class="${clase}"><button type="button" class="sg-fila" aria-expanded="false" aria-controls="${idCuerpo}">`
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
// Cargar, corregir y anular notas DGMIT (puro; spec 2026-10-24-notas-dgmit, 2 y 3)
// =====================================================

// Copia de services/notasDgmitReglas.js, atada por un test de paridad: los mensajes, los largos (en caracteres, sin los espacios de
// los extremos) y la fecha de recepción más vieja. El servidor valida igual; acá es para avisar en el campo antes de mandar
const MENSAJES_NOTA_DGMIT = Object.freeze({
  numero: 'Escribí el número de la nota.',
  numeroLargo: 'El número de la nota puede tener hasta 40 caracteres.',
  recibida: 'Elegí la fecha en que el área recibió la nota.',
  recibidaFutura: 'La fecha de recepción no puede ser posterior a hoy.',
  recibidaVieja: 'La fecha de recepción no puede ser anterior al 01/01/2025.',
  tipo: 'Elegí si es una solicitud o una reiteración.',
  datasets: 'Elegí al menos un dataset.',
  motivo: 'Escribí el motivo.',
  motivoLargo: 'El motivo puede tener hasta 500 caracteres.'
});
const LARGO_NUMERO_NOTA_DGMIT = 40;
const LARGO_MOTIVO_NOTA_DGMIT = 500;
const FECHA_MINIMA_NOTA_DGMIT = '2025-01-01';
// Los campos del formulario, en el orden en que se informan (el mismo con el que el servidor elige el primero)
const CAMPOS_DEL_FORMULARIO_DE_NOTA = ['numero', 'recibida', 'tipo', 'datasets', 'motivo'];
// Los dos alcances de la lista de datasets: el inicial (los que ya hacen falta) y todos
const ALCANCES_DE_NOTA = [['inicial', 'Vencidos y próximos a vencer'], ['todos', 'Todos']];
const TEXTOS_DEL_FORMULARIO_DE_NOTA = {
  cargar: { boton: 'Guardar nota', pie: 'Se guarda al confirmar y queda registrado quién la cargó y cuándo.' },
  corregir: { boton: 'Guardar corrección', pie: 'Se guarda al confirmar. Queda registrado quién la corrigió, cuándo, por qué y qué decía antes.' }
};
const PISTA_DE_REITERACION = 'Si se le vuelven a pedir los datos, es una reiteración.';

// Los ids como texto (llegan como número de la API y como texto de las casillas), sin repetidos
function conjuntoDeIds(valor) {
  const lista = valor !== null && typeof valor === 'object' && typeof valor[Symbol.iterator] === 'function' ? Array.from(valor) : [];
  return new Set(lista.filter((id) => id !== null && id !== undefined).map(String));
}

function tieneId(fila) {
  return Boolean(fila) && typeof fila === 'object' && fila.id !== null && fila.id !== undefined;
}

// El área de una fila, para agrupar
function areaDeLaFila(fila) {
  return String(fila?.area ?? '').trim() || 'Sin área';
}

// Por área y después por título, en orden alfabético en español (la Á va con la A)
function ordenarFilasDeNota(filas) {
  return [...comoLista(filas)].filter(tieneId)
    .sort((a, b) => areaDeLaFila(a).localeCompare(areaDeLaFila(b), 'es') || porTitulo(a, b));
}

// Las filas de la lista de "Sin elegir" que se pueden elegir para una nota DGMIT (las mismas que acepta el servidor: activas, de
// gestión externa y con «Requiere nota DGMIT» en Sí o sin dato; el 0 es No), más las de `incluir` aunque hoy no se puedan elegir:
// en una corrección, los datasets que la nota ya tenía siguen marcados y se pueden quitar
function datasetsParaElegir(filas, incluir = []) {
  const incluidos = conjuntoDeIds(incluir);
  return comoLista(filas).filter((fila) => tieneId(fila)
    && (incluidos.has(String(fila.id)) || (fila.activo !== false && fila.tipo_gestion === 'externa' && fila.requiere_nota !== 0)));
}

// Los datasets de la nota que se corrige que no están entre las filas (una lista vieja): se suman con lo mínimo, así la corrección
// no los saca sin que nadie lo haya pedido
function conLosDatasetsDeLaNota(filas, datasets) {
  const presentes = conjuntoDeIds(comoLista(filas).filter(tieneId).map((fila) => fila.id));
  const faltan = comoLista(datasets).filter((d) => tieneId(d) && !presentes.has(String(d.id)))
    .map((d) => ({ id: d.id, titulo: d.titulo ?? null, area: null, tipo_gestion: null, requiere_nota: null, activo: true,
      estado: null, dias: null, proxima: null, nota_dgmit: null }));
  return [...comoLista(filas), ...faltan];
}

// El alcance inicial: los vencidos y los próximos a vencer (los que ya hacen falta)
function estaEnElAlcanceInicial(fila) {
  return fila?.estado === 'vencido' || fila?.estado === 'proximo';
}

// El estado de cada opción, con los datos del servidor: [clase, texto]. La clase colorea los vencidos y los próximos
function textoDeEstadoDeOpcion(fila) {
  const dias = Number.isFinite(fila?.dias) ? fila.dias : null;
  switch (fila?.estado) {
    case 'vencido': return ['vencido', dias !== null && dias < 0 ? `Vencido hace ${diasEnTexto(-dias)}` : 'Vencido'];
    case 'proximo':
      if (dias === 0) return ['proximo', 'Vence hoy'];
      return ['proximo', dias !== null && dias > 0 ? `Vence en ${diasEnTexto(dias)}` : 'Próximo a vencer'];
    case 'actualizado': return ['', fila.proxima ? `Vence el ${Utils.fechaCorta(fila.proxima)}` : 'Actualizado'];
    case 'sin-fecha': return ['', 'Sin fecha'];
    case 'eventual': return ['', 'Sin vencimiento'];
    case 'baja': return ['', 'Dado de baja'];
    default: return ['', Utils.SIN_DATO];
  }
}

// Las filas del alcance con la búsqueda (sin tildes ni mayúsculas, en el título o en el área)
function opcionesDeNota(filas, alcance, busqueda) {
  const buscado = textoParaBuscar(busqueda);
  return comoLista(filas).filter((fila) => tieneId(fila) && (alcance === 'todos' || estaEnElAlcanceInicial(fila))
    && (!buscado || textoParaBuscar(fila.titulo).includes(buscado) || textoParaBuscar(fila.area).includes(buscado)));
}

// { inicial: n, todos: n } con la búsqueda aplicada (como los filtros de la lista)
function cantidadesDeAlcance(filas, busqueda) {
  return Object.fromEntries(ALCANCES_DE_NOTA.map(([clave]) => [clave, opcionesDeNota(filas, clave, busqueda).length]));
}

function htmlDeAlcanceDeNota(cantidades, alcance) {
  return ALCANCES_DE_NOTA.map(([clave, texto]) => `<button type="button" class="sg-chip" data-alcance="${clave}" `
    + `aria-pressed="${clave === alcance ? 'true' : 'false'}">${texto} <b>${numeroEnTexto(cantidades?.[clave])}</b></button>`).join('');
}

// Con un dataset elegido de antemano que todavía no está en el alcance inicial (o que no está en la lista), el formulario abre en
// "Todos": así se ve marcado
function alcanceInicialDeNota(filas, elegidos) {
  const filaDe = new Map(comoLista(filas).filter(tieneId).map((fila) => [String(fila.id), fila]));
  return [...conjuntoDeIds(elegidos)].some((id) => !estaEnElAlcanceInicial(filaDe.get(id))) ? 'todos' : 'inicial';
}

// Qué decir cuando no queda ninguna opción
function textoSinOpcionesDeNota(busqueda, alcance) {
  if (textoParaBuscar(busqueda)) {
    return `Ningún dataset coincide con lo que buscaste.${alcance === 'inicial' ? ' Si es uno que todavía no vence, buscalo en «Todos».' : ''}`;
  }
  return alcance === 'inicial' ? 'No hay datasets vencidos ni próximos a vencer. Los demás están en «Todos».'
    : 'No hay datasets de gestión externa que requieran nota DGMIT.';
}

// La lista de datasets del formulario: un grupo por área (las áreas y los títulos por orden alfabético), con una casilla por dataset
// (value = id), su título, su estado y la marca de alcance (`data-inicial`); los elegidos, marcados
function htmlDeOpcionesDeNota(filas, elegidos) {
  const marcados = conjuntoDeIds(elegidos);
  const grupos = new Map();
  for (const fila of ordenarFilasDeNota(filas)) {
    const area = areaDeLaFila(fila);
    if (!grupos.has(area)) grupos.set(area, []);
    grupos.get(area).push(fila);
  }
  return [...grupos].map(([area, deLaArea]) => `<div class="sg-grupo" data-area="${escaparTexto(area)}"><div class="sg-grupo-area">${escaparTexto(area)}</div>`
    + deLaArea.map((fila) => {
      const elegida = marcados.has(String(fila.id));
      const titulo = escaparTexto(fila.titulo) || 'Sin título';
      const [clase, estado] = textoDeEstadoDeOpcion(fila);
      return `<label class="sg-opcion${elegida ? ' elegida' : ''}" data-inicial="${estaEnElAlcanceInicial(fila) ? '1' : '0'}">`
        + `<input type="checkbox" value="${escaparTexto(fila.id)}" data-titulo="${titulo}"${elegida ? ' checked' : ''}>`
        + `<span class="t">${titulo}</span><span class="e${clase ? ` ${clase}` : ''}">${estado}</span></label>`;
    }).join('') + '</div>').join('');
}

// Los elegidos, como etiquetas que se pueden quitar, en el orden de la lista: "N datasets elegidos:" ("1 dataset elegido:")
function htmlDeElegidos(filas, ids) {
  const marcados = conjuntoDeIds(ids);
  const elegidas = ordenarFilasDeNota(filas).filter((fila) => marcados.has(String(fila.id)));
  if (!elegidas.length) return '<span>Todavía no elegiste ningún dataset.</span>';
  return `<span>${elegidas.length === 1 ? '1 dataset elegido:' : `${elegidas.length} datasets elegidos:`}</span>`
    + elegidas.map((fila) => {
      const titulo = escaparTexto(fila.titulo) || 'Sin título';
      return `<span class="sg-elegido">${titulo}<button type="button" data-quitar="${escaparTexto(fila.id)}" aria-label="Quitar ${titulo}">×</button></span>`;
    }).join('');
}

// Un número de nota para comparar: sin mayúsculas ni los espacios de los extremos (como el servidor busca el repetido)
function numeroParaComparar(numero) {
  return String(numero ?? '').trim().toLowerCase();
}

// El aviso de solicitud repetida (no bloquea): si el tipo es Solicitud y algún elegido ya tiene una nota DGMIT en su ciclo abierto (la
// `nota_dgmit` de su fila), un renglón por dataset y al final que eso es una reiteración. La nota que se corrige (`excluirNumero`) no
// cuenta. Texto plano: va con textContent
function textoDePistaDeSolicitud(filas, ids, tipo, excluirNumero = null) {
  if (tipo !== 'solicitud') return '';
  const marcados = conjuntoDeIds(ids);
  const excluido = numeroParaComparar(excluirNumero);
  const renglones = ordenarFilasDeNota(filas).filter((fila) => marcados.has(String(fila.id))).flatMap((fila) => {
    const nota = fila.nota_dgmit;
    const numero = nota && typeof nota === 'object' ? numeroParaComparar(nota.numero) : '';
    if (!numero || numero === excluido) return [];
    const tipoDeLaNota = esClaveDe(TIPOS_NOTA_DGMIT, nota.tipo) ? `${TIPOS_NOTA_DGMIT[nota.tipo].toLowerCase()}, ` : '';
    return [`«${String(fila.titulo ?? '').trim()}» ya tiene la nota DGMIT N° ${String(nota.numero).trim()} (${tipoDeLaNota}recibida el `
      + `${Utils.fechaCorta(nota.recibida)}) en este ciclo.`];
  });
  return renglones.length ? [...renglones, PISTA_DE_REITERACION].join('\n') : '';
}

// 'AAAA-MM-DD' de un día que existe (copia de esFechaIso de services/notasDigitalesCalendario.js, sobre el texto: sin Date local)
function esFechaDeTexto(valor) {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) && Utils.soloFecha(valor) === valor;
}

// Un texto obligatorio con largo máximo, contado en caracteres (Array.from, como el varchar de la base) y sin los espacios de los
// extremos: el mensaje del error, o null
function errorDeTextoDeNota(valor, largo, mensajeVacio, mensajeLargo) {
  const recortado = typeof valor === 'string' ? valor.trim() : '';
  if (recortado === '') return mensajeVacio;
  return Array.from(recortado).length > largo ? mensajeLargo : null;
}

// El motivo de una corrección o de una anulación (validarMotivo del servidor): el mensaje del error, o null
function errorDeMotivoDeNota(valor) {
  return errorDeTextoDeNota(valor, LARGO_MOTIVO_NOTA_DGMIT, MENSAJES_NOTA_DGMIT.motivo, MENSAJES_NOTA_DGMIT.motivoLargo);
}

// La fecha de recepción, entre el 01/01/2025 y hoy; sin un hoy válido no pasa (no se puede saber si es posterior)
function errorDeRecibidaDeNota(recibida, hoy) {
  if (!esFechaDeTexto(recibida)) return MENSAJES_NOTA_DGMIT.recibida;
  if (recibida < FECHA_MINIMA_NOTA_DGMIT) return MENSAJES_NOTA_DGMIT.recibidaVieja;
  if (!esFechaDeTexto(hoy) || recibida > hoy) return MENSAJES_NOTA_DGMIT.recibidaFutura;
  return null;
}

// Un id de dataset: un entero positivo seguro, como número o como texto de solo dígitos
function esIdDeDataset(valor) {
  const numero = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : valor;
  return Number.isSafeInteger(numero) && numero > 0;
}

// Una lista no vacía de ids (un hueco es undefined: no es un id)
function sonIdsDeDatasets(datasets) {
  if (!Array.isArray(datasets) || datasets.length === 0) return false;
  for (const valor of datasets) if (!esIdDeDataset(valor)) return false;
  return true;
}

// Los errores del formulario por campo, con las reglas y los mensajes de validarNotaDgmit (y, con `conMotivo`, de validarMotivo):
// `{}` si se puede mandar
function erroresDelFormularioDeNota(entrada, { hoy, conMotivo = false } = {}) {
  const fuente = entrada !== null && typeof entrada === 'object' ? entrada : {};
  const errores = {
    numero: errorDeTextoDeNota(fuente.numero, LARGO_NUMERO_NOTA_DGMIT, MENSAJES_NOTA_DGMIT.numero, MENSAJES_NOTA_DGMIT.numeroLargo),
    recibida: errorDeRecibidaDeNota(fuente.recibida, hoy),
    tipo: typeof fuente.tipo === 'string' && esClaveDe(TIPOS_NOTA_DGMIT, fuente.tipo) ? null : MENSAJES_NOTA_DGMIT.tipo,
    datasets: sonIdsDeDatasets(fuente.datasets) ? null : MENSAJES_NOTA_DGMIT.datasets,
    motivo: conMotivo ? errorDeMotivoDeNota(fuente.motivo) : null
  };
  return Object.fromEntries(CAMPOS_DEL_FORMULARIO_DE_NOTA.filter((campo) => errores[campo]).map((campo) => [campo, errores[campo]]));
}

// Lo que se manda (ya validado): el número y el motivo sin los espacios de los extremos, los datasets como números y sin repetir
function cuerpoDeLaNota({ numero, recibida, tipo, datasets, motivo }, conMotivo) {
  const cuerpo = { numero: String(numero ?? '').trim(), recibida, tipo, datasets: [...conjuntoDeIds(datasets)].map(Number) };
  if (conMotivo) cuerpo.motivo = String(motivo ?? '').trim();
  return cuerpo;
}

// El título, el botón y el pie del formulario, para cargar o para corregir
function textosDelFormularioDeNota(modo, numero) {
  const corrige = modo === 'corregir';
  return { titulo: corrige ? `Corregir nota DGMIT N° ${numero}` : 'Cargar nota DGMIT', ...TEXTOS_DEL_FORMULARIO_DE_NOTA[corrige ? 'corregir' : 'cargar'] };
}

// La pregunta del modal de anular: "de su dataset" con uno, "de sus N datasets" con más
function textoDeConfirmarAnulacion(numero, cantidad) {
  const donde = cantidad > 1 ? `de sus ${cantidad} datasets` : 'de su dataset';
  return `¿Anular la nota DGMIT N° ${numero}? Deja de contar en el Seguimiento ${donde}, pero no se borra: queda en los movimientos, tachada y con el motivo.`;
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
  // "Cargar nota DGMIT", solo para quien puede cargar (administración y el colaborador): el servidor valida igual
  porId('sg-cargar-nota').hidden = !puedeCargarNotas();
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
  conectarEventosDeNotas();
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

// "Descargar la nota y su anexo" se reconoce por data-archivo: "Corregir" y "Anular" de una nota DGMIT también llevan data-nota (el
// id de la nota DGMIT, no el de una Nota Digital) y abren su modal, sin descargar nada
function alTocarUnMovimiento(evento) {
  const descarga = evento.target.closest('button[data-archivo]');
  if (descarga) {
    descargarNota(descarga);
    return;
  }
  const corregir = evento.target.closest('button[data-accion="corregir-nota"]');
  if (corregir) {
    abrirFormularioDeNota(corregir, corregir.dataset.nota);
    return;
  }
  const anular = evento.target.closest('button[data-accion="anular-nota"]');
  if (anular) {
    abrirAnulacion(anular, anular.dataset.nota);
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

// =====================================================
// Cargar, corregir y anular notas DGMIT (DOM y API; spec 2026-10-24-notas-dgmit, 2 y 3)
// =====================================================

// El formulario abierto: el modo, la nota que se corrige (su id y el número que tenía), las filas que se pueden elegir, los elegidos
// (ids en texto), el alcance y el botón al que vuelve el foco al cerrar
const formularioDeNota = { modo: 'cargar', notaId: null, numeroOriginal: null, filas: [], elegidos: new Set(), alcance: 'inicial', volverA: null };
// La nota que se anula y el botón al que vuelve el foco
const anulacionDeNota = { notaId: null, volverA: null };

// Dónde va el error de cada campo: su párrafo, los controles que quedan con aria-invalid (la ayuda y el error ya están unidos a ellos
// en el HTML, con aria-describedby), el marco que se pinta y adónde va el foco
const LUGARES_DE_ERROR_DE_NOTA = {
  numero: { error: 'nd-numero-error', controles: ['nd-numero'], foco: 'nd-numero' },
  recibida: { error: 'nd-fecha-error', controles: ['nd-fecha'], foco: 'nd-fecha' },
  tipo: { error: 'nd-tipo-error', controles: ['nd-tipo-solicitud', 'nd-tipo-reiteracion'], marco: 'nd-tipos', foco: 'nd-tipo-solicitud' },
  datasets: { error: 'nd-datasets-error', controles: ['nd-buscar'], marco: 'nd-opciones', foco: 'nd-buscar' },
  motivo: { error: 'nd-motivo-error', controles: ['nd-motivo'], foco: 'nd-motivo' }
};
const TIPOS_DEL_FORMULARIO_DE_NOTA = ['nd-tipo-solicitud', 'nd-tipo-reiteracion'];

// Quién carga notas DGMIT lo dice auth.js (administración y el colaborador); solo cuenta el true literal
function puedeCargarNotas() {
  return typeof Auth.puedeCargarNotasDgmit === 'function' && Auth.puedeCargarNotasDgmit() === true;
}

// Los mensajes del servidor se escapan: showToast inserta HTML
function avisarExito(mensaje) {
  if (typeof showToast === 'function') showToast(Utils.escapeHtml(mensaje), 'success');
  else Utils.showSuccess(mensaje);
}

function conectarEventosDeNotas() {
  porId('sg-cargar-nota').addEventListener('click', () => abrirFormularioDeNota(porId('sg-cargar-nota')));
  conectarCierre(porId('modal-nota'), () => cerrarFormularioDeNota());
  conectarCierre(porId('modal-anular'), () => cerrarAnulacion());
  document.addEventListener('keydown', alApretarEscape);
  porId('nd-guardar').addEventListener('click', guardarNotaDgmit);
  porId('nd-buscar').addEventListener('input', () => dibujarOpcionesDeNota());
  porId('nd-alcance').addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-alcance]');
    if (boton) elegirAlcanceDeNota(boton.dataset.alcance);
  });
  porId('nd-opciones').addEventListener('change', alMarcarDataset);
  porId('nd-elegidos').addEventListener('click', alQuitarElegido);
  for (const id of TIPOS_DEL_FORMULARIO_DE_NOTA) porId(id).addEventListener('change', alElegirTipoDeNota);
  // Lo que se corrige deja de marcarse como error
  porId('nd-numero').addEventListener('input', () => ponerErrorDeNota('numero', null));
  porId('nd-fecha').addEventListener('input', () => ponerErrorDeNota('recibida', null));
  porId('nd-motivo').addEventListener('input', () => ponerErrorDeNota('motivo', null));
  porId('an-confirmar').addEventListener('click', confirmarAnulacion);
  porId('an-motivo').addEventListener('input', () => ponerErrorDeAnulacion(null));
}

// Cierran la × y "Cancelar" (data-cerrar) y el clic en el velo, solo si empezó en el velo: soltar ahí una selección de texto que
// empezó en un campo no cierra el modal
function conectarCierre(modal, cerrar) {
  let desdeElVelo = false;
  modal.addEventListener('mousedown', (evento) => {
    desdeElVelo = evento.target === modal;
  });
  modal.addEventListener('click', (evento) => {
    if (evento.target.closest('[data-cerrar]')) cerrar();
    else if (evento.target === modal && desdeElVelo) cerrar();
    desdeElVelo = false;
  });
}

function estaAbierto(id) {
  return porId(id).classList.contains('active');
}

// Escape cierra el modal abierto
function alApretarEscape(evento) {
  if (evento.key !== 'Escape') return;
  if (estaAbierto('modal-anular')) cerrarAnulacion();
  else if (estaAbierto('modal-nota')) cerrarFormularioDeNota();
}

// El foco vuelve al botón que abrió el modal; si ya no está en la página, al botón del encabezado
function devolverElFoco(boton) {
  const destino = boton && boton.isConnected !== false ? boton : porId('sg-cargar-nota');
  destino?.focus();
}

// Después de guardar o anular: la lista, o el dataset y las sugerencias, así la nota se ve sin recargar la página
async function recargarLaVista() {
  const id = Utils.getUrlParams().id;
  if (!id) {
    await cargarLista();
    return;
  }
  await Promise.all([cargarDataset(id), cargarSugerencias()]);
}

// El `extra` de la nota DGMIT `notaId` de la vista, si quien mira la puede corregir o anular (lo dice el servidor: `editable`) y no está
// anulada; si no, null
function notaDgmitEditable(notaId) {
  const movimiento = comoLista(vista.seguimiento?.movimientos)
    .find((m) => m?.tipo === 'dgmit' && m.extra && typeof m.extra === 'object' && String(m.extra.nota_id) === String(notaId));
  const extra = movimiento?.extra;
  return extra && extra.editable === true && !extra.anulada ? extra : null;
}

// Las filas de "Sin elegir" (las de la lista o las de las sugerencias); si todavía no están, se piden. null si no llegan (con un aviso:
// el formulario no se abre vacío)
async function filasDelSeguimiento(boton) {
  if (vista.filas.length) return vista.filas;
  let filas = null;
  const pedir = async () => {
    try {
      const datos = (await API.pedirJson('GET', '/seguimiento'))?.data;
      if (!Array.isArray(datos)) throw new TypeError('la respuesta no es la lista del seguimiento');
      vista.filas = datos;
      porId('sg-sugerencias').innerHTML = htmlDeSugerencias(datos);
      filas = datos;
    } catch (error) {
      avisarError(`No se pudo cargar la lista de datasets: ${error.message}`);
    }
  };
  if (boton) await conBotonBloqueado(boton, pedir);
  else await pedir();
  return filas;
}

// Desde la vista de un dataset, ese dataset, si se puede elegir; si no (interno, con «No» o dado de baja), ninguno
function datasetPropioElegible(elegibles) {
  const propio = Utils.getUrlParams().id ? vista.seguimiento?.ficha?.id : null;
  return propio !== null && propio !== undefined && elegibles.some((fila) => String(fila.id) === String(propio)) ? [propio] : [];
}

// Abre el formulario para cargar (sin `notaId`) o para corregir la nota `notaId` de la vista, con sus datos, el motivo y sus datasets
// marcados aunque hoy no se puedan elegir
async function abrirFormularioDeNota(boton, notaId = null) {
  if (!puedeCargarNotas()) return;
  const nota = notaId === null ? null : notaDgmitEditable(notaId);
  if (notaId !== null && !nota) return;
  const filas = await filasDelSeguimiento(boton);
  if (!filas) return;
  const deLaNota = nota ? comoLista(nota.datasets).filter(tieneId) : [];
  const elegibles = datasetsParaElegir(conLosDatasetsDeLaNota(filas, deLaNota), deLaNota.map((d) => d.id));
  const elegidos = nota ? deLaNota.map((d) => d.id) : datasetPropioElegible(elegibles);
  Object.assign(formularioDeNota, {
    modo: nota ? 'corregir' : 'cargar', notaId: nota ? notaId : null, numeroOriginal: nota ? nota.numero : null, filas: elegibles,
    elegidos: conjuntoDeIds(elegidos), alcance: alcanceInicialDeNota(elegibles, elegidos), volverA: boton
  });
  const textos = textosDelFormularioDeNota(formularioDeNota.modo, nota?.numero);
  porId('modal-nota-titulo').textContent = textos.titulo;
  porId('nd-guardar').textContent = textos.boton;
  porId('nd-pie').textContent = textos.pie;
  porId('nd-motivo-grupo').hidden = !nota;
  porId('nd-numero').value = nota?.numero ?? '';
  const fecha = porId('nd-fecha');
  fecha.value = nota?.recibida ?? '';
  fecha.max = Utils.hoyEnArgentina();
  porId('nd-tipo-solicitud').checked = nota?.tipo === 'solicitud';
  porId('nd-tipo-reiteracion').checked = nota?.tipo === 'reiteracion';
  porId('nd-motivo').value = '';
  porId('nd-buscar').value = '';
  for (const campo of CAMPOS_DEL_FORMULARIO_DE_NOTA) ponerErrorDeNota(campo, null);
  dibujarOpcionesDeNota();
  dibujarElegidosDeNota();
  marcarTipoElegido();
  porId('modal-nota').classList.add('active');
  mostrarElPrimerElegido();
  // El velo entra con una transición de visibility: hasta que termina, el campo no acepta foco (como en usuarios.js)
  setTimeout(() => porId('nd-numero').focus(), 100);
}

function cerrarFormularioDeNota(destino = formularioDeNota.volverA) {
  porId('modal-nota').classList.remove('active');
  formularioDeNota.volverA = null;
  devolverElFoco(destino);
}

// El alcance (con sus cantidades) y la lista de datasets con la búsqueda; los elegidos siguen marcados aunque no se vean
function dibujarOpcionesDeNota() {
  const { filas, alcance, elegidos } = formularioDeNota;
  const busqueda = porId('nd-buscar').value;
  porId('nd-alcance').innerHTML = htmlDeAlcanceDeNota(cantidadesDeAlcance(filas, busqueda), alcance);
  const visibles = opcionesDeNota(filas, alcance, busqueda);
  porId('nd-opciones').innerHTML = visibles.length ? htmlDeOpcionesDeNota(visibles, elegidos)
    : `<p class="sg-sin-opciones">${textoSinOpcionesDeNota(busqueda, alcance)}</p>`;
}

// Con un dataset elegido de antemano, su área va primero a la vista (la lista se desplaza)
function mostrarElPrimerElegido() {
  const opciones = porId('nd-opciones');
  const caja = opciones.querySelector('input[type="checkbox"]:checked');
  opciones.scrollTop = caja?.closest('.sg-grupo')?.offsetTop ?? 0;
}

function elegirAlcanceDeNota(alcance) {
  if (!ALCANCES_DE_NOTA.some(([clave]) => clave === alcance)) return;
  formularioDeNota.alcance = alcance;
  dibujarOpcionesDeNota();
  porId('nd-alcance').querySelector(`button[data-alcance="${alcance}"]`)?.focus();
}

// Marcar o desmarcar una casilla (clic delegado en la lista): la lista no se rehace, así el foco queda en la casilla
function alMarcarDataset(evento) {
  const caja = evento.target;
  if (!caja || caja.type !== 'checkbox') return;
  if (caja.checked) formularioDeNota.elegidos.add(String(caja.value));
  else formularioDeNota.elegidos.delete(String(caja.value));
  caja.closest('.sg-opcion')?.classList.toggle('elegida', caja.checked);
  if (formularioDeNota.elegidos.size) ponerErrorDeNota('datasets', null);
  dibujarElegidosDeNota();
}

// Quitar una etiqueta desmarca su dataset; el foco pasa a la etiqueta que quedó en su lugar (o al buscador si no quedó ninguna)
function alQuitarElegido(evento) {
  const boton = evento.target.closest('button[data-quitar]');
  if (!boton) return;
  const lugar = [...porId('nd-elegidos').querySelectorAll('button[data-quitar]')].indexOf(boton);
  formularioDeNota.elegidos.delete(String(boton.dataset.quitar));
  dibujarOpcionesDeNota();
  dibujarElegidosDeNota();
  const quedan = porId('nd-elegidos').querySelectorAll('button[data-quitar]');
  (quedan[Math.min(Math.max(lugar, 0), quedan.length - 1)] ?? porId('nd-buscar')).focus();
}

function dibujarElegidosDeNota() {
  porId('nd-elegidos').innerHTML = htmlDeElegidos(formularioDeNota.filas, formularioDeNota.elegidos);
  dibujarPistaDeNota();
}

// El aviso de solicitud repetida, que no bloquea (la nota que se corrige no se avisa a sí misma)
function dibujarPistaDeNota() {
  const { filas, elegidos, numeroOriginal } = formularioDeNota;
  const texto = textoDePistaDeSolicitud(filas, elegidos, tipoDeNotaElegido(), numeroOriginal);
  const pista = porId('nd-pista');
  pista.textContent = texto;
  pista.hidden = !texto;
}

function tipoDeNotaElegido() {
  if (porId('nd-tipo-solicitud').checked) return 'solicitud';
  return porId('nd-tipo-reiteracion').checked ? 'reiteracion' : '';
}

// La opción elegida, marcada con una clase (sin :has(), como el resto del sitio)
function marcarTipoElegido() {
  for (const id of TIPOS_DEL_FORMULARIO_DE_NOTA) {
    const radio = porId(id);
    radio.closest('.sg-tipo-opcion')?.classList.toggle('elegida', radio.checked);
  }
}

function alElegirTipoDeNota() {
  if (tipoDeNotaElegido()) ponerErrorDeNota('tipo', null);
  marcarTipoElegido();
  dibujarPistaDeNota();
}

// Muestra (o saca, con null) el error de un campo: el párrafo, aria-invalid en sus controles y el marco. false si no es un campo del
// formulario
function ponerErrorDeNota(campo, mensaje) {
  const lugar = esClaveDe(LUGARES_DE_ERROR_DE_NOTA, campo) ? LUGARES_DE_ERROR_DE_NOTA[campo] : null;
  if (!lugar) return false;
  const parrafo = porId(lugar.error);
  parrafo.textContent = mensaje ?? '';
  parrafo.hidden = !mensaje;
  for (const id of lugar.controles) {
    if (mensaje) porId(id).setAttribute('aria-invalid', 'true');
    else porId(id).removeAttribute('aria-invalid');
  }
  if (lugar.marco) porId(lugar.marco).classList.toggle('invalido', Boolean(mensaje));
  return true;
}

// Todos los errores juntos (los campos sin error quedan limpios) y el foco al primero. true si hubo alguno
function mostrarErroresDeNota(errores) {
  for (const campo of CAMPOS_DEL_FORMULARIO_DE_NOTA) ponerErrorDeNota(campo, errores[campo] ?? null);
  const primero = CAMPOS_DEL_FORMULARIO_DE_NOTA.find((campo) => errores[campo]);
  if (primero) porId(LUGARES_DE_ERROR_DE_NOTA[primero].foco).focus();
  return Boolean(primero);
}

// Los errores sin campo que dicen que la vista quedó vieja: 403 (quien mira ya no puede cargar, corregir o anular), 404 (la nota ya no
// existe) y 409 (alguien la anuló mientras tanto). El 409 del número repetido trae campo y va a ese campo
const ESTADOS_DE_VISTA_VIEJA = [403, 404, 409];

// Un error del servidor sin campo, al guardar o al anular: el aviso y, si la vista quedó vieja, se cierra el modal (`cerrar`) y se
// vuelve a pedir la vista, así desaparecen los botones que ya no sirven. Con cualquier otro (un 400 como «La corrección no cambia
// ningún dato de la nota.», un 500 o sin conexión) el modal queda abierto y el foco vuelve a `boton`: deshabilitado durante el pedido,
// lo había soltado. Se llama con el botón ya habilitado
async function avisarFallaSinCampo(falla, boton, cerrar) {
  avisarError(falla?.message);
  if (!ESTADOS_DE_VISTA_VIEJA.includes(falla?.status)) {
    boton.focus();
    return;
  }
  cerrar();
  await recargarLaVista();
}

// Guardar: valida en el navegador (con los mensajes del servidor) y manda POST /notas-dgmit o PUT /notas-dgmit/:id. Un error del
// servidor con campo (el número repetido, un dataset que no se puede elegir) va a ese campo; sin campo, un aviso (avisarFallaSinCampo).
// Si sale bien: el aviso del servidor, se cierra y se vuelve a pedir la vista
async function guardarNotaDgmit() {
  const boton = porId('nd-guardar');
  if (boton.disabled) return;
  const corrige = formularioDeNota.modo === 'corregir';
  const entrada = {
    numero: porId('nd-numero').value, recibida: porId('nd-fecha').value, tipo: tipoDeNotaElegido(),
    datasets: [...formularioDeNota.elegidos], motivo: porId('nd-motivo').value
  };
  if (mostrarErroresDeNota(erroresDelFormularioDeNota(entrada, { hoy: Utils.hoyEnArgentina(), conMotivo: corrige }))) return;
  const cuerpo = cuerpoDeLaNota(entrada, corrige);
  let respuesta = null;
  let falla = null;
  await conBotonBloqueado(boton, async () => {
    try {
      respuesta = corrige
        ? await API.pedirJson('PUT', `/notas-dgmit/${encodeURIComponent(formularioDeNota.notaId)}`, cuerpo)
        : await API.pedirJson('POST', '/notas-dgmit', cuerpo);
    } catch (error) {
      falla = error ?? new Error('');
    }
  });
  if (falla) {
    if (ponerErrorDeNota(falla.campo, falla.message)) porId(LUGARES_DE_ERROR_DE_NOTA[falla.campo].foco).focus();
    else await avisarFallaSinCampo(falla, boton, () => cerrarFormularioDeNota(porId('sg-cargar-nota')));
    return;
  }
  if (!respuesta) return;
  avisarExito(respuesta.message ?? '');
  // El botón que abrió el formulario se vuelve a dibujar con la vista: el foco va al del encabezado
  cerrarFormularioDeNota(porId('sg-cargar-nota'));
  await recargarLaVista();
}

// "Anular": el modal chico, con la pregunta ("de su dataset" o "de sus N datasets") y el motivo obligatorio
function abrirAnulacion(boton, notaId) {
  if (!puedeCargarNotas()) return;
  const nota = notaDgmitEditable(notaId);
  if (!nota) return;
  Object.assign(anulacionDeNota, { notaId, volverA: boton });
  porId('modal-anular-titulo').textContent = `Anular nota DGMIT N° ${nota.numero}`;
  porId('an-texto').textContent = textoDeConfirmarAnulacion(nota.numero, comoLista(nota.datasets).length);
  porId('an-motivo').value = '';
  ponerErrorDeAnulacion(null);
  porId('modal-anular').classList.add('active');
  setTimeout(() => porId('an-motivo').focus(), 100);
}

function cerrarAnulacion(destino = anulacionDeNota.volverA) {
  porId('modal-anular').classList.remove('active');
  anulacionDeNota.volverA = null;
  devolverElFoco(destino);
}

function ponerErrorDeAnulacion(mensaje) {
  const parrafo = porId('an-motivo-error');
  parrafo.textContent = mensaje ?? '';
  parrafo.hidden = !mensaje;
  if (mensaje) porId('an-motivo').setAttribute('aria-invalid', 'true');
  else porId('an-motivo').removeAttribute('aria-invalid');
}

// Confirmar: POST /notas-dgmit/:id/anular con el motivo. Si sale bien, el aviso del servidor, se cierra y se vuelve a pedir la vista. Un
// error en el motivo va al campo; otro, un aviso (avisarFallaSinCampo)
async function confirmarAnulacion() {
  const boton = porId('an-confirmar');
  if (boton.disabled) return;
  const motivo = porId('an-motivo').value;
  const error = errorDeMotivoDeNota(motivo);
  if (error) {
    ponerErrorDeAnulacion(error);
    porId('an-motivo').focus();
    return;
  }
  let respuesta = null;
  let falla = null;
  await conBotonBloqueado(boton, async () => {
    try {
      respuesta = await API.pedirJson('POST', `/notas-dgmit/${encodeURIComponent(anulacionDeNota.notaId)}/anular`, { motivo: motivo.trim() });
    } catch (error) {
      falla = error ?? new Error('');
    }
  });
  if (falla) {
    if (falla.campo === 'motivo') {
      ponerErrorDeAnulacion(falla.message);
      porId('an-motivo').focus();
    } else {
      await avisarFallaSinCampo(falla, boton, () => cerrarAnulacion(porId('sg-cargar-nota')));
    }
    return;
  }
  if (!respuesta) return;
  avisarExito(respuesta.message ?? '');
  cerrarAnulacion(porId('sg-cargar-nota'));
  await recargarLaVista();
}
