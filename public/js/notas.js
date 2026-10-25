/**
 * Generador de Notas - RPAD (spec 2026-10-24-generador-de-notas, secciones 1 y 3)
 * La nota con la que la DGMIT le pide los datos a un área, en tres pasos: el área, los datasets y la nota, y revisar y descargar
 * el Word. La usan administración y el colaborador (Auth.puedeCargarNotasDgmit()); el lector ve el mensaje del servidor y la
 * página no pide nada. No se guarda nada.
 * La página no recalcula ninguna regla: el estado, los días, los "Datos solicitados", las notas DGMIT del ciclo, el HTML de la
 * nota y el nombre del Word los manda el servidor (controllers/notasController.js); acá solo se dibujan. Las fechas se leen como
 * texto (Utils.fechaCorta) y hoy es Utils.hoyEnArgentina(), nunca toISOString. Todo texto que llega del servidor pasa por
 * Utils.escapeHtml, salvo el HTML de la nota, que lo arma y lo escapa el servidor (renderHtmlDeBloques).
 * Al cargarse el archivo solo declara: lo que arma HTML es puro (tests/notas-frontend.test.js lo carga en un vm) y lo que toca
 * el DOM o la API va aparte, al final.
 */

// Sin sesión, al login; sin permiso, el mensaje (y ningún pedido); con permiso, el generador
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }
  if (!puedeUsarElGenerador()) {
    mostrarSinPermiso();
    return;
  }
  iniciarGenerador();
});

// =====================================================
// Constantes
// =====================================================

// Copias del servidor, atadas por un test de paridad: si cambia una regla o un mensaje allá, cambia acá. El servidor valida igual;
// acá es para avisar en el campo antes de mandar.
// - Los mensajes de cada campo y el largo del número (services/notasGeneradorReglas.js: MENSAJES_GENERADOR y LARGO_NUMERO)
const MENSAJES_GENERADOR = Object.freeze({
  fecha: 'Elegí la fecha de la nota.',
  fechaFuera: 'La fecha de la nota tiene que estar entre el 01/01/2025 y 30 días después de hoy.',
  numeroLargo: 'El número de la nota puede tener hasta 40 caracteres.',
  tipo: 'Elegí si la nota es interna o externa.',
  pedido: 'Elegí si es una solicitud o una reiteración.',
  anteriorLargo: 'Cada número de nota anterior puede tener hasta 40 caracteres.',
  area: 'Elegí el área.',
  datasets: 'Elegí al menos un dataset.'
});
const LARGO_NUMERO_NOTA = 40;
// - El 403 de quien no puede usar el generador (middleware/auth.js: usaGeneradorDeNotas)
const MENSAJE_SIN_PERMISO = 'No tenés permiso para usar el generador de notas.';
// - Lo que pide un dataset sin pedido, eventual o sin fecha (services/notasGeneradorContenido.js: INFORMACION_SIN_PEDIDO)
const INFORMACION_SIN_PEDIDO = 'Información actualizada disponible';
// - Los tipos de nota DGMIT (services/notasDgmitReglas.js: TEXTO_TIPO_NOTA_DGMIT)
const TIPOS_NOTA_DGMIT = { solicitud: 'Solicitud', reiteracion: 'Reiteración' };

// El orden en que se informan los errores (el de ORDEN_DE_CAMPOS del servidor, con los campos que valida la página)
const CAMPOS_DEL_PASO_2 = ['numero', 'anteriores', 'datasets'];

// El ámbito de un área (areas.ambito, 'municipal' por defecto en la base), cómo se dice y qué nota le corresponde
const AMBITOS = {
  municipal: { texto: 'Municipal', enLaPista: 'municipal', tipo: 'interna' },
  externo: { texto: 'Fuera del municipio', enLaPista: 'fuera del municipio', tipo: 'externa' }
};

// Los textos vacíos de la lista de áreas (spec 3.1) y de la lista de datasets (spec 3.2)
const SIN_URGENTES = 'Hoy ninguna área tiene datasets vencidos o próximos a vencer.';
const SIN_COINCIDENCIAS = 'Ninguna área coincide con la búsqueda.';
const SIN_DATOS_PARA_PEDIR = 'Hoy no hay datos para pedirle a esta área';
const TODOS_AL_DIA = `${SIN_DATOS_PARA_PEDIR}: sus datasets están al día.`;

// La marca de agua de la hoja: el isotipo aclarado, el mismo del Word (services/notasWord.js)
const MARCA_DE_AGUA = 'img/membrete-isotipo-aclarado.png';
// El membrete llega como un data URL de un PNG o un JPEG (GET /notas/membrete); otra cosa no se dibuja
const IMAGEN_DEL_MEMBRETE = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

// El ícono del Seguimiento (el del menú lateral), en la línea de la nota anterior traída de las notas DGMIT cargadas
const ICONO_SEGUIMIENTO = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>';

// =====================================================
// Ayudantes (puros)
// =====================================================

function comoLista(valor) {
  return Array.isArray(valor) ? valor : [];
}

function esObjeto(valor) {
  return valor !== null && typeof valor === 'object';
}

// Utils.escapeHtml(0) da '': el valor se pasa a texto antes
function escaparTexto(texto) {
  return Utils.escapeHtml(texto === null || texto === undefined ? '' : String(texto));
}

// Caracteres de un texto, como los cuenta el servidor (Array.from), no las unidades de UTF-16 de `length`
function caracteres(texto) {
  return Array.from(texto).length;
}

// "1 día", "85 días"
function diasEnTexto(dias) {
  return `${dias} ${dias === 1 ? 'día' : 'días'}`;
}

// Sin tildes ni mayúsculas, para buscar (copia de la de seguimiento.js)
function textoParaBuscar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function porNombre(a, b) {
  return String(a?.nombre ?? '').localeCompare(String(b?.nombre ?? ''), 'es');
}

// Los ids como texto (llegan como número de la API y como texto de las casillas), sin repetidos. Un Set o una lista; otra cosa,
// ninguno (sin instanceof: los tests le pasan un Set de otro contexto)
function conjuntoDeIds(valor) {
  const esSet = Object.prototype.toString.call(valor) === '[object Set]';
  const lista = esSet || Array.isArray(valor) ? [...valor] : [];
  return new Set(lista.map(String));
}

// La regla de quién usa el generador la tiene auth.js (puedeCargarNotasDgmit: administración y el colaborador); solo cuenta el
// true literal, y un auth.js que no sabe decirlo falla cerrado. El servidor valida igual
function puedeUsarElGenerador() {
  return typeof Auth.puedeCargarNotasDgmit === 'function' && Auth.puedeCargarNotasDgmit() === true;
}

// =====================================================
// Las insignias
// =====================================================

function esVencido(dataset) {
  return Number.isFinite(dataset?.dias) && dataset.dias < 0;
}

// Vencido (días negativos) o próximo a vencer: los que vienen primero en el paso 1 y tildados en el paso 2
function esUrgente(dataset) {
  return esObjeto(dataset) && (esVencido(dataset) || dataset.estado === 'proximo');
}

// [clase, texto] de la insignia del estado, en lenguaje neutro (como el Seguimiento). Un estado que no conoce nunca se hace pasar
// por uno al día
function textoDeInsignia(dataset) {
  const { estado, dias } = esObjeto(dataset) ? dataset : {};
  if (esVencido(dataset)) return ['badge-atrasado', `Vencido hace ${diasEnTexto(-dias)}`];
  if (estado === 'proximo' && Number.isFinite(dias)) return ['badge-proximo', dias === 0 ? 'Vence hoy' : `Vence en ${diasEnTexto(dias)}`];
  if (estado === 'actualizado') return ['badge-actualizado', 'Al día'];
  if (estado === 'eventual') return ['badge-eventual', 'Eventual'];
  return ['badge-secondary', 'Sin fecha'];
}

function htmlDeInsignia(clase, texto) {
  return `<span class="badge ${clase}">${escaparTexto(texto)}</span>`;
}

// =====================================================
// El paso 1: el área
// =====================================================

function datasetsDe(area) {
  return comoLista(area?.datasets).filter(esObjeto);
}

function ambitoDe(valor) {
  return Object.prototype.hasOwnProperty.call(AMBITOS, valor) ? valor : 'municipal';
}

// Los días del dataset más vencido del área (de los urgentes); sin urgentes, Infinity
function peorDe(area) {
  return Math.min(...datasetsDe(area).filter(esUrgente).map((dataset) => (Number.isFinite(dataset.dias) ? dataset.dias : Infinity)));
}

// Las áreas de un filtro con la búsqueda, en una lista nueva. "urgentes": las que tienen algún dataset vencido o próximo a vencer,
// primero la del más vencido; "todas": por nombre. La búsqueda, sin tildes ni mayúsculas, en el nombre del área o en los títulos de
// sus datasets
function areasDelFiltro(areas, filtro, busqueda) {
  const buscado = textoParaBuscar(busqueda);
  const enLaBusqueda = (area) => !buscado || textoParaBuscar(area.nombre).includes(buscado)
    || datasetsDe(area).some((dataset) => textoParaBuscar(dataset.titulo).includes(buscado));
  const validas = comoLista(areas).filter(esObjeto);
  const lista = filtro === 'urgentes'
    ? validas.filter((area) => datasetsDe(area).some(esUrgente)).sort((a, b) => peorDe(a) - peorDe(b) || porNombre(a, b))
    : [...validas].sort(porNombre);
  return lista.filter(enLaBusqueda);
}

// Las cantidades de los dos botones de filtro (sin la búsqueda)
function cantidadesDeFiltros(areas) {
  return { urgentes: areasDelFiltro(areas, 'urgentes', '').length, todas: areasDelFiltro(areas, 'todas', '').length };
}

// Las insignias de la fila de un área: las de sus urgentes; sin urgentes, las de los eventuales y los sin fecha, y los al día juntos
// ("Al día", o "Los N al día")
function insigniasDelArea(datasets) {
  const urgentes = datasets.filter(esUrgente);
  if (urgentes.length) return urgentes.map((dataset) => htmlDeInsignia(...textoDeInsignia(dataset))).join('');
  const alDia = datasets.filter((dataset) => dataset.estado === 'actualizado').length;
  const otros = datasets.filter((dataset) => dataset.estado !== 'actualizado').map((dataset) => htmlDeInsignia(...textoDeInsignia(dataset)));
  if (alDia > 0) otros.push(htmlDeInsignia('badge-actualizado', alDia === 1 ? 'Al día' : `Los ${alDia} al día`));
  return otros.join('');
}

// La fila de un área: un botón a todo el ancho (un toque pasa al paso 2) con el nombre, el ámbito, los títulos de sus datasets
// vencidos o próximos (o de todos, si no tiene) y sus insignias
function htmlDeFilaDeArea(area, elegida) {
  const datasets = datasetsDe(area);
  const urgentes = datasets.filter(esUrgente);
  const titulos = (urgentes.length ? urgentes : datasets).map((dataset) => escaparTexto(dataset.titulo)).join(', ');
  const ambito = ambitoDe(area?.ambito);
  return `<button type="button" class="area-opcion${elegida ? ' elegida' : ''}" data-area="${escaparTexto(area?.id)}">`
    + `<div class="area-texto"><div class="area-nombre">${escaparTexto(area?.nombre)}<span class="ambito ${ambito}">${AMBITOS[ambito].texto}</span></div>`
    + `<div class="area-ds">${titulos}</div></div>`
    + `<div class="area-estado">${insigniasDelArea(datasets)}</div>`
    + '<span class="ir" aria-hidden="true">›</span>'
    + '</button>';
}

// La lista del paso 1: las filas del filtro, con la elegida marcada, o el texto vacío. Si el filtro "urgentes" no tiene ninguna,
// lo dice aunque haya una búsqueda; si no, es la búsqueda la que no coincide
function htmlDeListaDeAreas(areas, filtro, busqueda, elegida) {
  const lista = areasDelFiltro(areas, filtro, busqueda);
  if (lista.length === 0) {
    const vacio = filtro === 'urgentes' && areasDelFiltro(areas, filtro, '').length === 0 ? SIN_URGENTES : SIN_COINCIDENCIAS;
    return `<div class="vacio">${vacio}</div>`;
  }
  const esLaElegida = (area) => elegida !== null && elegida !== undefined && String(area.id) === String(elegida);
  return lista.map((area) => htmlDeFilaDeArea(area, esLaElegida(area))).join('');
}

// =====================================================
// El paso 2: los datasets y la nota
// =====================================================

// Los que vienen tildados: los vencidos y los próximos a vencer que se pueden pedir (los ids, como número)
function elegidosIniciales(datasets) {
  return comoLista(datasets).filter((dataset) => esUrgente(dataset) && dataset.se_puede_pedir === true).map((dataset) => Number(dataset.id));
}

// Los elegidos que se pueden pedir, como número y en el orden de la lista (el de la tabla): lo que se ve tildado es lo que se manda
function idsElegidos(datasets, elegidos) {
  const ids = conjuntoDeIds(elegidos);
  return comoLista(datasets)
    .filter((dataset) => esObjeto(dataset) && dataset.se_puede_pedir === true && ids.has(String(dataset.id)))
    .map((dataset) => Number(dataset.id));
}

// "Notas DGMIT del ciclo: N° 97/26 (solicitud, recibida el 02/07/2026) · …": las vigentes del ciclo abierto, como las manda el
// servidor (por fecha de recepción). Sin notas, nada
function htmlDeNotasDgmitDelDataset(notas) {
  const lista = comoLista(notas).filter((nota) => esObjeto(nota) && String(nota.numero ?? '').trim());
  if (lista.length === 0) return '';
  const textos = lista.map((nota) => {
    const tipo = Object.prototype.hasOwnProperty.call(TIPOS_NOTA_DGMIT, nota.tipo) ? `${TIPOS_NOTA_DGMIT[nota.tipo].toLowerCase()}, ` : '';
    return `N° ${escaparTexto(nota.numero)} (${tipo}recibida el ${Utils.fechaCorta(nota.recibida)})`;
  });
  return `<div class="ds-dgmit">Notas DGMIT del ciclo: ${textos.join(' · ')}</div>`;
}

// La fila de un dataset del área. Uno que se puede pedir: una casilla (tildada si está elegido), el título, la insignia y
// "Frecuencia · Datos solicitados: …". Uno al día: en gris, con la casilla deshabilitada y "Frecuencia · Vence el dd/mm/aaaa. Al día:
// todavía no hay datos para pedir.". Debajo, las notas DGMIT del ciclo, si tiene
function htmlDeDataset(dataset, elegido) {
  const d = esObjeto(dataset) ? dataset : {};
  const titulo = escaparTexto(d.titulo);
  const cabeza = `<span class="ds-titulo">${titulo}</span>${htmlDeInsignia(...textoDeInsignia(d))}`;
  const frecuencia = escaparTexto(d.frecuencia);
  const dgmit = htmlDeNotasDgmitDelDataset(d.notas_dgmit);
  if (d.se_puede_pedir !== true) {
    const datos = [frecuencia, `Vence el ${Utils.fechaCorta(d.proxima)}. Al día: todavía no hay datos para pedir.`].filter(Boolean).join(' · ');
    return '<div class="ds ds-off">'
      + `<input type="checkbox" disabled aria-label="${titulo}: al día, no se puede pedir">`
      + `<div>${cabeza}<div class="ds-datos">${datos}</div>${dgmit}</div>`
      + '</div>';
  }
  const pedido = String(d.datos_solicitados ?? '').trim() || INFORMACION_SIN_PEDIDO;
  const datos = [frecuencia, `Datos solicitados: <b>${escaparTexto(pedido)}</b>`].filter(Boolean).join(' · ');
  return '<label class="ds">'
    + `<input type="checkbox" name="dataset" value="${escaparTexto(d.id)}"${elegido ? ' checked' : ''}>`
    + `<div>${cabeza}<div class="ds-datos">${datos}</div>${dgmit}</div>`
    + '</label>';
}

// La lista del paso 2: las filas, tildadas las elegidas. Si ninguno se puede pedir, el aviso arriba (con la lista en gris); sin
// datasets, solo el aviso, sin decir que están al día
function htmlDeListaDeDatasets(datasets, elegidos) {
  const lista = comoLista(datasets).filter(esObjeto);
  if (lista.length === 0) return `<p class="ds-aviso">${SIN_DATOS_PARA_PEDIR}.</p>`;
  const ids = conjuntoDeIds(elegidos);
  const filas = lista.map((dataset) => htmlDeDataset(dataset, ids.has(String(dataset.id)))).join('');
  const aviso = lista.some((dataset) => dataset.se_puede_pedir === true) ? '' : `<p class="ds-aviso">${TODOS_AL_DIA}</p>`;
  return `${aviso}<div class="ds-lista">${filas}</div>`;
}

// La nota que le corresponde a un área por su ámbito: interna (por la Subsecretaría) o externa (directo al organismo)
function tipoSugerido(ambito) {
  return AMBITOS[ambitoDe(ambito)].tipo;
}

// La pista del tipo de nota (spec 3.2): por qué vino elegida, o que se cambió a mano. Texto plano
function textoDelTipo(ambito, tipo) {
  const { enLaPista, tipo: sugerido } = AMBITOS[ambitoDe(ambito)];
  return tipo === sugerido
    ? `Viene elegida porque el área figura como ${enLaPista} en Áreas.`
    : `Cambiada a mano: el área figura como ${enLaPista}, que lleva nota ${sugerido}.`;
}

// La nota anterior que se trae de las notas DGMIT cargadas: la original del ciclo abierto de cada elegido (la primera de las que
// manda el servidor, que van por fecha de recepción), con los números distintos ordenados por recepción
function numerosTraidos(datasets, elegidos) {
  const ids = new Set(idsElegidos(datasets, elegidos).map(String));
  const originales = comoLista(datasets)
    .filter((dataset) => esObjeto(dataset) && ids.has(String(dataset.id)))
    .map((dataset) => comoLista(dataset.notas_dgmit).find((nota) => esObjeto(nota) && String(nota.numero ?? '').trim()))
    .filter(Boolean)
    .sort((a, b) => String(a.recibida ?? '').localeCompare(String(b.recibida ?? '')));
  return [...new Set(originales.map((nota) => String(nota.numero).trim()))];
}

// El recuadro "Nota anterior (opcional)" de una reiteración: los números como etiquetas con su "×", el campo para agregar otro y de
// dónde salieron (traídos de las notas DGMIT cargadas, editados a mano o sin notas cargadas para los elegidos)
function htmlDeNotaAnterior({ numeros, editada, traidos } = {}) {
  const etiquetas = comoLista(numeros).map((numero, i) => {
    const texto = `N° ${escaparTexto(numero)}`;
    return `<span class="chip-nota">${texto}<button type="button" data-quitar-nota="${String(i)}" aria-label="Quitar la nota ${texto}">×</button></span>`;
  }).join('');
  let origen;
  if (editada) origen = '<div class="origen">Editada a mano. <button type="button" class="link" data-reponer-notas>Volver a traer las cargadas</button></div>';
  else if (comoLista(traidos).length) origen = `<div class="origen">${ICONO_SEGUIMIENTO}Traída de las notas DGMIT cargadas en el Seguimiento.</div>`;
  else origen = '<div class="origen gris">No hay notas DGMIT cargadas para estos datasets: escribila si la sabés.</div>';
  return '<div class="subpanel">'
    + '<div class="subpanel-titulo">Nota anterior <span class="text-muted">(opcional)</span></div>'
    + `<div class="chips">${etiquetas}<span class="chip-agregar">`
    + `<input class="form-input" id="nt-anterior-nuevo" type="text" maxlength="${String(LARGO_NUMERO_NOTA)}" placeholder="Ej.: 124/25" aria-label="Número de otra nota anterior">`
    + '<button type="button" class="btn btn-outline btn-sm" data-agregar-nota>Agregar</button></span></div>'
    + origen
    + '</div>';
}

// =====================================================
// El paso 3: la hoja de la vista previa
// =====================================================

// La hoja: el membrete (si hay uno que sirve, como en el Word), la marca de agua, el cuerpo y el pie. El cuerpo es el HTML de la
// nota que arma el servidor (POST /notas/vista-previa, ya escapado): va tal cual
function htmlDeHoja(cuerpoHtml, { imagen = null, pie = '' } = {}) {
  const membrete = typeof imagen === 'string' && IMAGEN_DEL_MEMBRETE.test(imagen) ? `<img class="enc" src="${escaparTexto(imagen)}" alt="">` : '';
  const textoDelPie = String(pie ?? '').replace(/\s+/g, ' ').trim();
  return '<div class="hoja" role="document" aria-label="Vista previa de la nota">'
    + membrete
    + `<div class="agua"><img src="${MARCA_DE_AGUA}" alt=""></div>`
    + `<div class="texto">${String(cuerpoHtml ?? '')}</div>`
    + (textoDelPie ? `<div class="pie">${escaparTexto(textoDelPie)}</div>` : '')
    + '</div>';
}

// =====================================================
// El pedido
// =====================================================

// Un número de nota (el de la nota o uno anterior), con las reglas del servidor: sin número está bien; un texto, hasta
// LARGO_NUMERO_NOTA caracteres sin los espacios de los extremos; cualquier otra cosa, no
function numeroValido(valor) {
  if (valor === undefined || valor === null) return true;
  return typeof valor === 'string' && caracteres(valor.trim()) <= LARGO_NUMERO_NOTA;
}

// Los errores del paso 2 por campo, con los mensajes del servidor y en su orden: `{}` si se puede seguir
function erroresDelPaso2({ elegidos, numero, anteriores } = {}) {
  const errores = {
    numero: numeroValido(numero) ? null : MENSAJES_GENERADOR.numeroLargo,
    anteriores: anteriores === undefined || anteriores === null || (Array.isArray(anteriores) && anteriores.every(numeroValido))
      ? null : MENSAJES_GENERADOR.anteriorLargo,
    datasets: conjuntoDeIds(elegidos).size > 0 ? null : MENSAJES_GENERADOR.datasets
  };
  return Object.fromEntries(CAMPOS_DEL_PASO_2.filter((campo) => errores[campo]).map((campo) => [campo, errores[campo]]));
}

// Lo que va a POST /notas/vista-previa y a POST /notas/generar, a partir del estado de la página (ver `generador`): el número sin
// los espacios de los extremos (sin número, null), las notas anteriores solo en una reiteración y los datasets elegidos que se
// pueden pedir, en el orden de la lista
function cuerpoDelPedido(estado) {
  const e = esObjeto(estado) ? estado : {};
  const numero = typeof e.numero === 'string' ? e.numero.trim() : '';
  return {
    fecha: e.fecha ?? null,
    numero: numero || null,
    tipo: e.tipo ?? null,
    pedido: e.pedido ?? null,
    anteriores: e.pedido === 'reiteracion' ? comoLista(e.anteriores).filter((n) => typeof n === 'string') : [],
    area_id: e.areaId ?? null,
    datasets: idsElegidos(e.area?.datasets, e.elegidos)
  };
}

// El Word (POST /notas/generar), con el token en el encabezado. Es local porque API.pedirArchivo es solo GET (api.js no cambia).
// Si falla, tira un Error con el mensaje del servidor, su `status` (401: la sesión venció) y su `campo`
async function pedirWord(cuerpo) {
  const response = await fetch(`${CONFIG.API_URL}/notas/generar`, {
    method: 'POST',
    headers: Auth.getAuthHeaders(),
    body: JSON.stringify(cuerpo)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error || `Error ${response.status}`);
    error.status = response.status;
    error.campo = data.campo;
    throw error;
  }
  return response.blob();
}

// =====================================================
// La página (DOM y API)
// =====================================================

/**
 * El estado de la página:
 * - `paso` (1, 2 o 3), `filtro` ('urgentes' o 'todas') y `busqueda` del paso 1, y `areas` (GET /notas/areas);
 * - `areaId` y `area` (GET /notas/areas/:id?fecha=, con sus datasets a la fecha de la nota);
 * - `tipo` ('interna' o 'externa'), `pedido` ('solicitud' o 'reiteracion'), `fecha` ('AAAA-MM-DD'), `numero` (el texto del campo),
 *   `anteriores` (los números de la nota anterior), `anterioresEditadas` (si se tocaron a mano) y `elegidos` (un Set de ids).
 */
const generador = {
  paso: 1, filtro: 'urgentes', busqueda: '', areas: [], areaId: null, area: null,
  tipo: null, pedido: 'solicitud', fecha: null, numero: '', anteriores: [], anterioresEditadas: false, elegidos: new Set()
};

const porId = (id) => document.getElementById(id);

// Descarga un Blob con ese nombre de archivo y libera su URL (copiado de correos.js)
const descargarBlob = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Un lector que entra por la URL: sin el generador, con el mensaje del servidor
function mostrarSinPermiso() {
  const tarjeta = porId('nt-generador');
  if (tarjeta) tarjeta.hidden = true;
  const aviso = porId('nt-aviso');
  if (aviso) aviso.innerHTML = `<div class="alert alert-error">${escaparTexto(MENSAJE_SIN_PERMISO)}</div>`;
}

// La nota arranca en el paso 1, con la fecha de hoy en Argentina, como solicitud y sin área
async function iniciarGenerador() {
  Object.assign(generador, {
    paso: 1, filtro: 'urgentes', busqueda: '', areaId: null, area: null, tipo: null, pedido: 'solicitud',
    fecha: Utils.hoyEnArgentina(), numero: '', anteriores: [], anterioresEditadas: false, elegidos: new Set()
  });
}
