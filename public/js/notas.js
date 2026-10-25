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
// - Los mensajes de cada campo, el largo del número y el rango de la fecha (services/notasGeneradorReglas.js: MENSAJES_GENERADOR,
//   LARGO_NUMERO, FECHA_MINIMA y DIAS_ADELANTE)
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
const FECHA_MINIMA_NOTA = '2025-01-01';
const DIAS_ADELANTE_NOTA = 30;
// - El 403 de quien no puede usar el generador (middleware/auth.js: usaGeneradorDeNotas)
const MENSAJE_SIN_PERMISO = 'No tenés permiso para usar el generador de notas.';
// - Lo que pide un dataset sin pedido, eventual o sin fecha (services/notasGeneradorContenido.js: INFORMACION_SIN_PEDIDO)
const INFORMACION_SIN_PEDIDO = 'Información actualizada disponible';
// - Los tipos de nota DGMIT (services/notasDgmitReglas.js: TEXTO_TIPO_NOTA_DGMIT)
const TIPOS_NOTA_DGMIT = { solicitud: 'Solicitud', reiteracion: 'Reiteración' };

// El orden en que se informan los errores (el de ORDEN_DE_CAMPOS del servidor, con los campos que valida la página)
const CAMPOS_DEL_PASO_2 = ['numero', 'anteriores', 'datasets'];
// El orden en que se marcan los errores de los campos y el primero recibe el foco: el de ORDEN_DE_CAMPOS del servidor, sin el área
// (se elige en el paso 1)
const ORDEN_DE_LOS_ERRORES = ['fecha', 'numero', 'tipo', 'pedido', 'anteriores', 'datasets'];

// El ámbito de un área (areas.ambito, 'municipal' por defecto en la base), cómo se dice y qué nota le corresponde
const AMBITOS = {
  municipal: { texto: 'Municipal', enLaPista: 'municipal', tipo: 'interna' },
  externo: { texto: 'Fuera del municipio', enLaPista: 'fuera del municipio', tipo: 'externa' }
};
// Cómo se dice el tipo de nota en el resumen del paso 3 (spec 3.3)
const TIPOS_DE_NOTA = { interna: 'Interna, a la Subsecretaría', externa: 'Externa, directo al área' };

// Los pasos (spec 3)
const NOMBRES_DE_LOS_PASOS = ['Área', 'Datasets y nota', 'Revisar y descargar'];

// Los textos vacíos de la lista de áreas (spec 3.1) y de la lista de datasets (spec 3.2)
const SIN_URGENTES = 'Hoy ninguna área tiene datasets vencidos o próximos a vencer.';
const SIN_COINCIDENCIAS = 'Ninguna área coincide con la búsqueda.';
const SIN_DATOS_PARA_PEDIR = 'Hoy no hay datos para pedirle a esta área';
const TODOS_AL_DIA = `${SIN_DATOS_PARA_PEDIR}: sus datasets están al día.`;
// Si falla la carga de las áreas (spec 3.4): el mensaje, nunca una lista vacía
const MENSAJE_SIN_AREAS = 'No se pudieron cargar las áreas. Probá de nuevo en unos minutos.';
// "Siguiente" o "Ver en grande" mientras se cargan los datasets del área
const MENSAJE_CARGANDO_EL_AREA = 'Todavía se están cargando los datasets del área. Probá de nuevo en un momento.';

// La marca de agua de la hoja: el isotipo aclarado, el mismo del Word (services/notasWord.js)
const MARCA_DE_AGUA = 'img/membrete-isotipo-aclarado.png';
// El membrete llega como un data URL de un PNG o un JPEG (GET /notas/membrete); otra cosa no se dibuja
const IMAGEN_DEL_MEMBRETE = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

// El indicador de carga de siempre (main.css)
const CARGANDO = '<div class="loading"><div class="spinner"></div></div>';

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
// Los pasos
// =====================================================

// Los tres pasos de la tarjeta: el actual con aria-current="step", los hechos con una tilde (y "(hecho)" para los lectores de
// pantalla) y los que faltan con su número
function htmlDePasos(paso) {
  return NOMBRES_DE_LOS_PASOS.map((nombre, i) => {
    const numero = i + 1;
    if (numero === paso) return `<li class="actual" aria-current="step"><span class="num" aria-hidden="true">${String(numero)}</span>${nombre}</li>`;
    if (numero < paso) return `<li class="hecho"><span class="num" aria-hidden="true">✓</span>${nombre}<span class="sr-only"> (hecho)</span></li>`;
    return `<li><span class="num" aria-hidden="true">${String(numero)}</span>${nombre}</li>`;
  }).join('');
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

// El texto de ayuda del paso 1 (spec 3.1), con la cantidad de áreas de "Todas"
function textoDeIntro(cantidad) {
  return 'Tocá el área a la que se le piden los datos. Primero están las que tienen datasets vencidos o próximos a vencer (60 días); '
    + `en "Todas", las ${String(cantidad)} áreas con datasets que requieren nota DGMIT.`;
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
// vencidos o próximos (o de todos, si no tiene) y sus insignias. Dentro de un botón solo va contenido de frase: todo en <span> (el
// CSS los pone en bloque)
function htmlDeFilaDeArea(area, elegida) {
  const datasets = datasetsDe(area);
  const urgentes = datasets.filter(esUrgente);
  const titulos = (urgentes.length ? urgentes : datasets).map((dataset) => escaparTexto(dataset.titulo)).join(', ');
  const ambito = ambitoDe(area?.ambito);
  return `<button type="button" class="area-opcion${elegida ? ' elegida' : ''}" data-area="${escaparTexto(area?.id)}">`
    + `<span class="area-texto"><span class="area-nombre">${escaparTexto(area?.nombre)}<span class="ambito ${ambito}">${AMBITOS[ambito].texto}</span></span>`
    + `<span class="area-ds">${titulos}</span></span>`
    + `<span class="area-estado">${insigniasDelArea(datasets)}</span>`
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

// "dependiente de la Secretaría…", "dependiente del Ministerio…" ("de" + "el" es "del") o "sin dependencia cargada" (spec 3.2)
function textoDeDependencia(area) {
  const superior = String(area?.area_superior ?? '').trim();
  if (!superior) return 'sin dependencia cargada';
  return `dependiente ${area.articulo_superior === 'el' ? 'del' : 'de la'} ${superior}`;
}

// El área elegida, arriba del paso 2: el nombre, la dependencia y el ámbito
function htmlDelAreaElegida(area) {
  const ambito = ambitoDe(area?.ambito);
  return `<b>${escaparTexto(area?.nombre)}</b> · <span class="text-muted">${escaparTexto(textoDeDependencia(area))}</span> · `
    + `<span class="ambito ${ambito}">${AMBITOS[ambito].texto}</span>`;
}

// La ayuda del número (spec 3.2), con el año de la fecha de la nota
function textoDeAyudaDelNumero(fecha) {
  const anio = Utils.soloFecha(fecha)?.slice(2, 4) ?? 'AA';
  return `Sin número, la nota sale con "Nota N° ____/${anio}" para completarlo después. No se guarda en ningún lado.`;
}

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
  return `<span class="ds-dgmit">Notas DGMIT del ciclo: ${textos.join(' · ')}</span>`;
}

// La fila de un dataset del área. Uno que se puede pedir: una casilla (tildada si está elegido), el título, la insignia y
// "Frecuencia · Datos solicitados: …". Uno al día: en gris, con la casilla deshabilitada y "Frecuencia · Vence el dd/mm/aaaa. Al día:
// todavía no hay datos para pedir.". Debajo, las notas DGMIT del ciclo, si tiene. Dentro de un <label> solo va contenido de frase:
// todo en <span> (el CSS pone en bloque los datos y las notas)
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
      + `<span class="ds-cuerpo">${cabeza}<span class="ds-datos">${datos}</span>${dgmit}</span>`
      + '</div>';
  }
  const pedido = String(d.datos_solicitados ?? '').trim() || INFORMACION_SIN_PEDIDO;
  const datos = [frecuencia, `Datos solicitados: <b>${escaparTexto(pedido)}</b>`].filter(Boolean).join(' · ');
  return '<label class="ds">'
    + `<input type="checkbox" name="dataset" value="${escaparTexto(d.id)}"${elegido ? ' checked' : ''}>`
    + `<span class="ds-cuerpo">${cabeza}<span class="ds-datos">${datos}</span>${dgmit}</span>`
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

// La nota que le corresponde a un área por su ámbito: interna (por la Subsecretaría) o externa (directo al organismo). No se llama
// tipoSugerido: así se llama en el servidor el tipo de pedido de un dataset (services/fechasDatasetReglas.js)
function tipoDeNotaSugerido(ambito) {
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

// El recuadro "Nota anterior (opcional)" de una reiteración: los números como etiquetas con su "×", el campo para agregar otro (su
// error va en #nt-anteriores-error, fuera del recuadro) y de dónde salieron (traídos de las notas DGMIT cargadas, editados a mano o
// sin notas cargadas para los elegidos). El campo no tiene maxlength: cuenta unidades de UTF-16 y cortaría un número con emoji a los
// 20; el largo lo controlan numerosConOtro y el servidor, con Array.from
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
    + '<input class="form-input" id="nt-anterior-nuevo" type="text" placeholder="Ej.: 124/25" aria-label="Número de otra nota anterior" aria-describedby="nt-anteriores-error">'
    + '<button type="button" class="btn btn-outline btn-sm" data-agregar-nota>Agregar</button></span></div>'
    + origen
    + '</div>';
}

// =====================================================
// El paso 3: la hoja de la vista previa y el resumen
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

// El resumen del paso 3 (spec 3.3): el área, la nota ("Interna, a la Subsecretaría · Solicitud"), la fecha y el número ("sin número
// (queda el espacio)") y los datasets que se mandan, en el orden de la lista
function htmlDelResumen(estado) {
  const e = esObjeto(estado) ? estado : {};
  const datasets = datasetsDe(e.area);
  const porIdDelDataset = new Map(datasets.map((dataset) => [Number(dataset.id), dataset]));
  const titulos = idsElegidos(datasets, e.elegidos).map((id) => escaparTexto(porIdDelDataset.get(id)?.titulo));
  const numero = typeof e.numero === 'string' ? e.numero.trim() : '';
  const nota = [TIPOS_DE_NOTA[e.tipo], TIPOS_NOTA_DGMIT[e.pedido]].filter(Boolean).join(' · ');
  return `<div><dt>Área</dt><dd>${escaparTexto(e.area?.nombre)}</dd></div>`
    + `<div><dt>Nota</dt><dd>${nota}</dd></div>`
    + `<div><dt>Fecha y número</dt><dd>${Utils.fechaCorta(e.fecha)} · ${numero ? escaparTexto(numero) : 'sin número (queda el espacio)'}</dd></div>`
    + `<div><dt>Datasets</dt><dd>${titulos.join('<br>')}</dd></div>`;
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

// La fecha de la nota, con la regla del servidor (errorDeFecha de services/notasGeneradorReglas.js): un día que existe, escrito
// 'AAAA-MM-DD', entre FECHA_MINIMA_NOTA y hoy + DIAS_ADELANTE_NOTA. Los días se cuentan sobre el texto (Utils.getDiasRestantes). El
// mensaje del error, o null
function errorDeFecha(fecha, hoy) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Utils.soloFecha(fecha)) return MENSAJES_GENERADOR.fecha;
  if (fecha < FECHA_MINIMA_NOTA) return MENSAJES_GENERADOR.fechaFuera;
  const dias = Utils.getDiasRestantes(fecha, hoy);
  if (dias === null || dias > DIAS_ADELANTE_NOTA) return MENSAJES_GENERADOR.fechaFuera;
  return null;
}

// Los errores del paso 2 por campo, con los mensajes del servidor y en su orden: `{}` si se puede seguir. Los datasets elegidos
// cuentan solo si se pueden pedir a la fecha de la nota (idsElegidos), como en cuerpoDelPedido: lo que va a rechazar el servidor no
// deja seguir
function erroresDelPaso2({ datasets, elegidos, numero, anteriores } = {}) {
  const errores = {
    numero: numeroValido(numero) ? null : MENSAJES_GENERADOR.numeroLargo,
    anteriores: anteriores === undefined || anteriores === null || (Array.isArray(anteriores) && anteriores.every(numeroValido))
      ? null : MENSAJES_GENERADOR.anteriorLargo,
    datasets: idsElegidos(datasets, elegidos).length > 0 ? null : MENSAJES_GENERADOR.datasets
  };
  return Object.fromEntries(CAMPOS_DEL_PASO_2.filter((campo) => errores[campo]).map((campo) => [campo, errores[campo]]));
}

// Lo que falta para seguir al paso 3, a partir del estado de la página (ver `generador`): la fecha y los errores del paso 2. Las notas
// anteriores cuentan solo en una reiteración (en una solicitud no se mandan). Si no se pudo cargar el área (`errorDeArea`), no hay
// datasets para elegir: queda solo ese error, en su campo (`campoDeArea`: la fecha, si el servidor la rechazó; si no, los datasets),
// y el de la fecha escrita, si no sirve
function erroresParaSeguir(estado, hoy) {
  const e = esObjeto(estado) ? estado : {};
  const fecha = errorDeFecha(e.fecha, hoy);
  if (e.errorDeArea) {
    const campo = ORDEN_DE_LOS_ERRORES.includes(e.campoDeArea) ? e.campoDeArea : 'datasets';
    return campo === 'fecha' ? { fecha: fecha ?? e.errorDeArea } : { ...(fecha ? { fecha } : {}), [campo]: e.errorDeArea };
  }
  return {
    ...(fecha ? { fecha } : {}),
    ...erroresDelPaso2({
      datasets: e.area?.datasets, elegidos: e.elegidos, numero: e.numero, anteriores: e.pedido === 'reiteracion' ? e.anteriores : []
    })
  };
}

// Suma un número a la lista de notas anteriores: `{ numeros, agregado, error }`, con una lista nueva. El número va recortado; vacío o
// repetido no cambia nada; de más de LARGO_NUMERO_NOTA caracteres, el error del servidor
function numerosConOtro(numeros, texto) {
  const lista = comoLista(numeros);
  const numero = String(texto ?? '').trim();
  if (!numero || lista.includes(numero)) return { numeros: [...lista], agregado: false, error: null };
  if (!numeroValido(numero)) return { numeros: [...lista], agregado: false, error: MENSAJES_GENERADOR.anteriorLargo };
  return { numeros: [...lista, numero], agregado: true, error: null };
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

// La clave de un pedido: dos estados que mandan lo mismo tienen la misma clave. La vista previa se guarda con la suya; una respuesta
// con otra clave que la de la nota de ahora es vieja y se descarta
function claveDelPedido(estado) {
  return JSON.stringify(cuerpoDelPedido(estado));
}

/**
 * Lo que muestra la hoja de la vista previa (la chica del paso 2 y la grande del paso 3) según el estado de la página:
 * `{ html, lista, actualizando }`. `lista` es true solo si la hoja es la nota de ahora (se puede descargar el Word).
 * - Cargando el área (o sin área todavía): el indicador de carga.
 * - Si no se pudo cargar el área, o falta algo para armar la nota (la fecha, un número largo, ningún dataset): la hoja con el mensaje.
 * - La nota de ahora, si ya llegó; si falló, la hoja con el mensaje del servidor; mientras llega, la anterior marcada como
 *   `actualizando` (o el indicador de carga, si no hay ninguna).
 */
function vistaPreviaDe(estado, hoy) {
  const e = esObjeto(estado) ? estado : {};
  const membrete = esObjeto(e.membrete) ? e.membrete : {};
  const conMensaje = (mensaje) => ({ html: htmlDeHoja(`<p class="hoja-mensaje">${escaparTexto(mensaje)}</p>`, membrete), lista: false });
  if (e.cargandoArea) return { html: CARGANDO, lista: false };
  if (e.errorDeArea) return conMensaje(e.errorDeArea);
  // Sin el área y sin cargarla: la fecha escrita no sirve (el pedido que estaba en camino se descartó)
  if (!e.area) {
    const fecha = errorDeFecha(e.fecha, hoy);
    return fecha ? conMensaje(fecha) : { html: CARGANDO, lista: false };
  }
  const errores = erroresParaSeguir(e, hoy);
  const primero = ORDEN_DE_LOS_ERRORES.find((campo) => errores[campo]);
  if (primero) return conMensaje(errores[primero]);
  const clave = claveDelPedido(e);
  if (e.vistaPrevia?.clave === clave) return { html: htmlDeHoja(e.vistaPrevia.html, membrete), lista: true };
  if (e.falloDeVista?.clave === clave) return conMensaje(e.falloDeVista.mensaje);
  if (e.vistaPrevia) return { html: htmlDeHoja(e.vistaPrevia.html, membrete), lista: false, actualizando: true };
  return { html: CARGANDO, lista: false };
}

// =====================================================
// La página (DOM y API)
// =====================================================

// La espera después del último cambio antes de pedir la vista previa, o el área con la fecha nueva (que es una consulta pesada)
const ESPERA = 300;

/**
 * El estado de la página:
 * - `paso` (1, 2 o 3), `filtro` ('urgentes' o 'todas') y `busqueda` del paso 1, `areas` (GET /notas/areas, con el estado de hoy) y
 *   `errorDeAreas` (si no se pudieron cargar);
 * - `areaId` y `area` (GET /notas/areas/:id?fecha=, con sus datasets a la fecha de la nota; null mientras carga), `cargandoArea`,
 *   `errorDeArea` (el mensaje del servidor, si no se pudo cargar), `campoDeArea` (el campo de ese error: 'fecha' o 'datasets') y
 *   `avisoDeCarga` (si #nt-aviso dice que el área todavía está cargando);
 * - `tipo` ('interna' o 'externa'), `pedido` ('solicitud' o 'reiteracion'), `fecha` ('AAAA-MM-DD'), `numero` (el texto del campo),
 *   `anteriores` (los números de la nota anterior), `anterioresEditadas` (si se tocaron a mano), `elegidos` (un Set de ids) y
 *   `elegidosEditados` (si se tildó o destildó alguno a mano: si no, al cambiar la fecha vienen tildados los de esa fecha);
 * - `membrete` ({ imagen, pie }, GET /notas/membrete), `vistaPrevia` ({ clave, html, nombre }, la última que llegó) y `falloDeVista`
 *   ({ clave, mensaje, campo }, la última que falló);
 * - los temporizadores (`esperaVista`, `esperaFecha`) y la serie del último pedido del área (`serieArea`), para descartar uno viejo.
 */
const generador = {
  paso: 1, filtro: 'urgentes', busqueda: '', areas: [], errorDeAreas: null, areaId: null, area: null, cargandoArea: false, errorDeArea: null,
  campoDeArea: null, avisoDeCarga: false,
  tipo: null, pedido: 'solicitud', fecha: null, numero: '', anteriores: [], anterioresEditadas: false, elegidos: new Set(),
  elegidosEditados: false, membrete: { imagen: null, pie: '' }, vistaPrevia: null, falloDeVista: null,
  esperaVista: null, esperaFecha: null, serieArea: 0
};

// Dónde va el error de cada campo: su párrafo, los controles que quedan con aria-invalid (la ayuda y el error ya están unidos a ellos
// con aria-describedby) y el marco que se pinta. El foco va al control elegido (en un grupo de opciones) o al primero; los datasets,
// a la primera casilla que se puede tildar o, si no hay, al grupo
const LUGARES_DE_ERROR = {
  fecha: { error: 'nt-fecha-error', controles: ['nt-fecha'] },
  numero: { error: 'nt-numero-error', controles: ['nt-numero'] },
  tipo: { error: 'nt-tipo-error', controles: ['nt-tipo-interna', 'nt-tipo-externa'] },
  pedido: { error: 'nt-pedido-error', controles: ['nt-pedido-solicitud', 'nt-pedido-reiteracion'] },
  anteriores: { error: 'nt-anteriores-error', controles: ['nt-anterior-nuevo'] },
  datasets: { error: 'nt-datasets-error', marco: 'nt-datasets', grupo: 'nt-datasets-grupo' }
};

const porId = (id) => document.getElementById(id);

// Lo último que se dibujó en cada hoja: si no cambió, no se vuelve a dibujar (el membrete es una imagen grande)
const dibujosDeLaHoja = new Map();

// Descarga un Blob con ese nombre de archivo y libera su URL (copiado de correos.js)
const descargarBlob = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

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

// Un lector que entra por la URL: sin el generador, con el mensaje del servidor
function mostrarSinPermiso() {
  const tarjeta = porId('nt-generador');
  if (tarjeta) tarjeta.hidden = true;
  const aviso = porId('nt-aviso');
  if (aviso) aviso.innerHTML = `<div class="alert alert-error">${escaparTexto(MENSAJE_SIN_PERMISO)}</div>`;
}

// La sesión venció (401) en cualquier pedido: se cierra y al login (Review Focus 5)
function esSesionVencida(error) {
  return error?.status === 401;
}

function irAlLogin() {
  if (typeof Auth.clearSession === 'function') Auth.clearSession();
  window.location.href = 'login.html';
}

// El aviso de la página (#nt-aviso, role=status): un error con el mensaje del servidor
function avisar(mensaje) {
  porId('nt-aviso').innerHTML = `<div class="alert alert-error">${escaparTexto(mensaje)}</div>`;
}

function limpiarAviso() {
  porId('nt-aviso').innerHTML = '';
}

function hoy() {
  return Utils.hoyEnArgentina();
}

function claveActual() {
  return claveDelPedido(generador);
}

// La nota arranca en el paso 1, con la fecha de hoy en Argentina, como solicitud y sin área; se piden las áreas y el membrete
async function iniciarGenerador() {
  Object.assign(generador, {
    paso: 1, filtro: 'urgentes', busqueda: '', areaId: null, area: null, tipo: null, pedido: 'solicitud',
    fecha: hoy(), numero: '', anteriores: [], anterioresEditadas: false, elegidos: new Set(), elegidosEditados: false
  });
  conectarEventos();
  irAlPaso(1, { enfocar: false });
  await Promise.all([cargarAreas(), cargarMembrete()]);
}

function conectarEventos() {
  // Paso 1
  porId('nt-filtros').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-filtro]');
    if (boton) elegirFiltro(boton.dataset.filtro);
  });
  porId('nt-buscar').addEventListener('input', (evento) => buscarAreas(evento.target.value));
  porId('nt-areas').addEventListener('click', (evento) => {
    const fila = evento.target.closest('.area-opcion[data-area]');
    if (fila) elegirArea(fila.dataset.area);
  });
  // Paso 2
  porId('nt-cambiar-area').addEventListener('click', volverAlPaso1);
  porId('nt-volver-1').addEventListener('click', volverAlPaso1);
  for (const tipo of ['interna', 'externa']) porId(`nt-tipo-${tipo}`).addEventListener('change', () => elegirTipo(tipo));
  for (const pedido of ['solicitud', 'reiteracion']) porId(`nt-pedido-${pedido}`).addEventListener('change', () => elegirPedido(pedido));
  porId('nt-anterior').addEventListener('click', (evento) => {
    const quitar = evento.target.closest('[data-quitar-nota]');
    if (quitar) quitarNotaAnterior(Number(quitar.dataset.quitarNota));
    else if (evento.target.closest('[data-agregar-nota]')) agregarNotaAnterior();
    else if (evento.target.closest('[data-reponer-notas]')) reponerNotasAnteriores();
  });
  porId('nt-anterior').addEventListener('keydown', (evento) => {
    if (evento.target.id !== 'nt-anterior-nuevo' || evento.key !== 'Enter') return;
    evento.preventDefault();
    agregarNotaAnterior();
  });
  porId('nt-anterior').addEventListener('input', (evento) => {
    if (evento.target.id === 'nt-anterior-nuevo') ponerError('anteriores', null);
  });
  porId('nt-fecha').addEventListener('input', (evento) => cambiarFecha(evento.target.value));
  porId('nt-numero').addEventListener('input', (evento) => cambiarNumero(evento.target.value));
  porId('nt-datasets').addEventListener('change', (evento) => {
    if (evento.target.name === 'dataset') marcarDataset(evento.target.value, evento.target.checked);
  });
  porId('nt-ver-grande').addEventListener('click', irAlPaso3);
  porId('nt-siguiente').addEventListener('click', irAlPaso3);
  // Paso 3
  porId('nt-descargar').addEventListener('click', descargarWord);
  porId('nt-volver-2').addEventListener('click', () => {
    irAlPaso(2);
    dibujarPaso2();
  });
  porId('nt-otra').addEventListener('click', armarOtraNota);
}

// Muestra un paso y marca los tres; el foco va al título del paso (salvo `enfocar: false`: al abrir la página, o cuando va a un
// campo con error)
function irAlPaso(paso, { enfocar = true } = {}) {
  generador.paso = paso;
  porId('nt-pasos').innerHTML = htmlDePasos(paso);
  for (const n of [1, 2, 3]) porId(`nt-paso-${n}`).hidden = n !== paso;
  if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0 });
  if (enfocar) porId(`nt-titulo-${paso}`).focus();
}

// ---------- Paso 1 ----------

async function cargarAreas() {
  try {
    const respuesta = await API.pedirJson('GET', '/notas/areas');
    generador.areas = comoLista(respuesta?.data).filter(esObjeto);
    generador.errorDeAreas = null;
  } catch (error) {
    if (esSesionVencida(error)) {
      irAlLogin();
      return;
    }
    console.error('Error al cargar las áreas:', error);
    generador.errorDeAreas = MENSAJE_SIN_AREAS;
  }
  dibujarPaso1();
}

// El membrete de la hoja (el mismo del Word). Si no se puede traer, la hoja sale sin membrete, como el Word sin membrete
async function cargarMembrete() {
  try {
    const respuesta = await API.pedirJson('GET', '/notas/membrete');
    const datos = esObjeto(respuesta?.data) ? respuesta.data : {};
    generador.membrete = { imagen: typeof datos.imagen === 'string' ? datos.imagen : null, pie: typeof datos.pie === 'string' ? datos.pie : '' };
  } catch (error) {
    if (esSesionVencida(error)) {
      irAlLogin();
      return;
    }
    console.error('Error al cargar el membrete:', error);
  }
  dibujarVistaPrevia();
}

function dibujarPaso1() {
  const lista = porId('nt-areas');
  if (generador.errorDeAreas) {
    porId('nt-barra').hidden = true;
    porId('nt-intro').hidden = true;
    lista.classList.remove('areas');
    lista.innerHTML = `<div class="alert alert-error">${escaparTexto(generador.errorDeAreas)}</div>`;
    return;
  }
  const cantidades = cantidadesDeFiltros(generador.areas);
  porId('nt-barra').hidden = false;
  porId('nt-intro').hidden = false;
  porId('nt-intro').textContent = textoDeIntro(cantidades.todas);
  porId('nt-cant-urgentes').textContent = String(cantidades.urgentes);
  porId('nt-cant-todas').textContent = String(cantidades.todas);
  porId('nt-buscar').value = generador.busqueda;
  lista.classList.add('areas');
  dibujarFiltros();
  dibujarListaDeAreas();
}

function dibujarFiltros() {
  for (const boton of porId('nt-filtros').querySelectorAll('[data-filtro]')) {
    boton.setAttribute('aria-pressed', String(boton.dataset.filtro === generador.filtro));
  }
}

function dibujarListaDeAreas() {
  porId('nt-areas').innerHTML = htmlDeListaDeAreas(generador.areas, generador.filtro, generador.busqueda, generador.areaId);
}

function elegirFiltro(filtro) {
  generador.filtro = filtro === 'todas' ? 'todas' : 'urgentes';
  dibujarFiltros();
  dibujarListaDeAreas();
}

function buscarAreas(texto) {
  generador.busqueda = String(texto ?? '');
  dibujarListaDeAreas();
}

// "Cambiar el área" y "Volver": el paso 1 con el filtro y la búsqueda como estaban, y el área elegida marcada
function volverAlPaso1() {
  irAlPaso(1);
  dibujarPaso1();
}

// Un toque en la fila de un área: el paso 2. Otra área arranca de cero (el tipo de nota de su ámbito, sin elegidos ni nota
// anterior) y se pide con la fecha de la nota; la misma, o una que no se pudo cargar, se vuelve a pedir solo si hace falta
function elegirArea(id) {
  const area = generador.areas.find((a) => String(a.id) === String(id));
  if (!area) return Promise.resolve();
  let carga = Promise.resolve();
  if (generador.areaId !== area.id || generador.errorDeArea) {
    Object.assign(generador, {
      areaId: area.id, area: null, errorDeArea: null, campoDeArea: null, tipo: tipoDeNotaSugerido(area.ambito), anteriores: [],
      anterioresEditadas: false, elegidos: new Set(), elegidosEditados: false, vistaPrevia: null, falloDeVista: null
    });
    for (const campo of ORDEN_DE_LOS_ERRORES) ponerError(campo, null);
    carga = cargarArea();
  }
  irAlPaso(2);
  dibujarPaso2();
  return carga;
}

// ---------- Paso 2 ----------

// El área elegida: la del paso 2, ya cargada, o la de la lista mientras carga
function areaElegida() {
  return generador.area ?? generador.areas.find((a) => a.id === generador.areaId) ?? null;
}

// GET /notas/areas/:id?fecha=: los datasets del área a la fecha de la nota. Si la fecha cambió mientras tanto, o se eligió otra
// área, la respuesta se descarta. Con los datasets: vienen tildados los vencidos y los próximos (si no se tocó ninguno a mano), la
// nota anterior se completa (si no se editó) y se pide la vista previa
async function cargarArea() {
  clearTimeout(generador.esperaFecha);
  clearTimeout(generador.esperaVista);
  const serie = ++generador.serieArea;
  generador.cargandoArea = true;
  if (generador.campoDeArea) ponerError(generador.campoDeArea, null);
  generador.errorDeArea = null;
  generador.campoDeArea = null;
  ponerError('datasets', null);
  dibujarDatasets();
  dibujarVistaPrevia();
  let falla = null;
  let respuesta = null;
  try {
    respuesta = await API.pedirJson('GET', `/notas/areas/${encodeURIComponent(generador.areaId)}?fecha=${encodeURIComponent(generador.fecha)}`);
  } catch (error) {
    falla = error ?? new Error('');
  }
  if (falla && esSesionVencida(falla)) {
    irAlLogin();
    return;
  }
  if (serie !== generador.serieArea) return;
  generador.cargandoArea = false;
  if (generador.avisoDeCarga) {
    generador.avisoDeCarga = false;
    limpiarAviso();
  }
  if (falla) {
    // El error queda en un solo lugar: en su campo (la fecha, si el servidor la rechazó) o junto a la lista de datasets
    generador.area = null;
    generador.errorDeArea = falla.message || 'No se pudo cargar el área.';
    generador.campoDeArea = falla.campo === 'fecha' ? 'fecha' : 'datasets';
    ponerError(generador.campoDeArea, generador.errorDeArea);
  } else {
    generador.area = esObjeto(respuesta?.data) ? { ...respuesta.data, datasets: datasetsDe(respuesta.data) } : { datasets: [] };
    if (!generador.elegidosEditados) generador.elegidos = new Set(elegidosIniciales(generador.area.datasets));
    completarNotaAnterior();
  }
  dibujarDatasets();
  dibujarNotaAnterior();
  await pedirVistaPrevia();
}

// Marca la opción elegida de un grupo (la tarjeta de la opción también, con .elegida)
function marcarOpcion(id, elegida) {
  const opcion = porId(id);
  opcion.checked = elegida;
  opcion.closest('.opcion')?.classList.toggle('elegida', elegida);
}

function dibujarPaso2() {
  const area = areaElegida();
  porId('nt-area-elegida').innerHTML = htmlDelAreaElegida(area);
  for (const tipo of ['interna', 'externa']) marcarOpcion(`nt-tipo-${tipo}`, generador.tipo === tipo);
  dibujarPistaDelTipo();
  for (const pedido of ['solicitud', 'reiteracion']) marcarOpcion(`nt-pedido-${pedido}`, generador.pedido === pedido);
  dibujarNotaAnterior();
  porId('nt-fecha').value = generador.fecha ?? '';
  porId('nt-numero').value = generador.numero;
  porId('nt-numero-ayuda').textContent = textoDeAyudaDelNumero(generador.fecha);
  dibujarDatasets();
  dibujarVistaPrevia();
}

function dibujarPistaDelTipo() {
  porId('nt-pista-tipo').textContent = textoDelTipo(areaElegida()?.ambito, generador.tipo);
}

function dibujarDatasets() {
  const contenedor = porId('nt-datasets');
  if (generador.cargandoArea) contenedor.innerHTML = CARGANDO;
  // Sin el área, la lista queda vacía: su error está en #nt-datasets-error o en el de la fecha (también si la fecha escrita no sirve y el
  // pedido que estaba en camino se descartó)
  else if (generador.errorDeArea || !generador.area) contenedor.innerHTML = '';
  else contenedor.innerHTML = htmlDeListaDeDatasets(generador.area.datasets, generador.elegidos);
}

// La nota anterior se completa con las notas DGMIT cargadas de los elegidos, mientras no se haya editado a mano
function completarNotaAnterior() {
  if (!generador.anterioresEditadas) generador.anteriores = numerosTraidos(generador.area?.datasets, generador.elegidos);
}

// El recuadro de la nota anterior, solo en una reiteración
function dibujarNotaAnterior() {
  const contenedor = porId('nt-anterior');
  const reiteracion = generador.pedido === 'reiteracion';
  contenedor.hidden = !reiteracion;
  contenedor.innerHTML = reiteracion
    ? htmlDeNotaAnterior({
      numeros: generador.anteriores,
      editada: generador.anterioresEditadas,
      traidos: numerosTraidos(generador.area?.datasets, generador.elegidos)
    })
    : '';
  if (!reiteracion) ponerError('anteriores', null);
}

function elegirTipo(tipo) {
  generador.tipo = tipo;
  for (const t of ['interna', 'externa']) marcarOpcion(`nt-tipo-${t}`, t === tipo);
  dibujarPistaDelTipo();
  ponerError('tipo', null);
  programarVistaPrevia();
}

function elegirPedido(pedido) {
  generador.pedido = pedido;
  for (const p of ['solicitud', 'reiteracion']) marcarOpcion(`nt-pedido-${p}`, p === pedido);
  if (pedido === 'reiteracion') completarNotaAnterior();
  dibujarNotaAnterior();
  ponerError('pedido', null);
  programarVistaPrevia();
}

// "Agregar" (o Enter en el campo): suma el número escrito; el foco vuelve al campo, vacío
function agregarNotaAnterior() {
  const { numeros, agregado, error } = numerosConOtro(generador.anteriores, porId('nt-anterior-nuevo')?.value);
  if (error) {
    ponerError('anteriores', error);
    porId('nt-anterior-nuevo')?.focus();
    return;
  }
  if (agregado) {
    generador.anteriores = numeros;
    generador.anterioresEditadas = true;
    programarVistaPrevia();
  }
  dibujarNotaAnterior();
  porId('nt-anterior-nuevo')?.focus();
}

// La "×" de una nota anterior: la quita; el foco va a la "×" que queda en su lugar o, si no queda ninguna, al campo
function quitarNotaAnterior(indice) {
  if (!Number.isInteger(indice) || indice < 0 || indice >= generador.anteriores.length) return;
  generador.anteriores = generador.anteriores.filter((_, i) => i !== indice);
  generador.anterioresEditadas = true;
  dibujarNotaAnterior();
  const quedan = generador.anteriores.length;
  const siguiente = quedan ? porId('nt-anterior').querySelector(`[data-quitar-nota="${String(Math.min(indice, quedan - 1))}"]`) : null;
  (siguiente ?? porId('nt-anterior-nuevo'))?.focus();
  programarVistaPrevia();
}

// "Volver a traer las cargadas": la nota anterior vuelve a completarse sola
function reponerNotasAnteriores() {
  generador.anterioresEditadas = false;
  completarNotaAnterior();
  ponerError('anteriores', null);
  dibujarNotaAnterior();
  porId('nt-anterior-nuevo')?.focus();
  programarVistaPrevia();
}

// La fecha de la nota: la ayuda del número cambia enseguida; si es una fecha que sirve, el área se vuelve a pedir con ella 300 ms
// después del último cambio (el estado de cada dataset y sus "Datos solicitados" son a esa fecha); si no, el error en el campo y no se
// pide nada
function cambiarFecha(valor) {
  generador.fecha = String(valor ?? '');
  porId('nt-numero-ayuda').textContent = textoDeAyudaDelNumero(generador.fecha);
  clearTimeout(generador.esperaFecha);
  clearTimeout(generador.esperaVista);
  // Un pedido del área en camino (el de la fecha anterior, o la carga inicial) ya no sirve: si contestara durante la espera, dejaría los
  // datasets de otra fecha
  generador.serieArea += 1;
  const error = errorDeFecha(generador.fecha, hoy());
  ponerError('fecha', error);
  if (error || !generador.areaId) {
    generador.cargandoArea = false;
    dibujarDatasets();
    dibujarVistaPrevia();
    return;
  }
  generador.cargandoArea = true;
  dibujarDatasets();
  dibujarVistaPrevia();
  generador.esperaFecha = setTimeout(() => {
    cargarArea();
  }, ESPERA);
}

function cambiarNumero(valor) {
  generador.numero = String(valor ?? '');
  ponerError('numero', null);
  programarVistaPrevia();
}

// Tildar o destildar un dataset; la nota anterior se vuelve a completar si no se editó a mano
function marcarDataset(id, marcado) {
  const numero = Number(id);
  const elegidos = new Set([...generador.elegidos].map(Number));
  if (marcado) elegidos.add(numero);
  else elegidos.delete(numero);
  generador.elegidos = elegidos;
  generador.elegidosEditados = true;
  ponerError('datasets', null);
  completarNotaAnterior();
  if (generador.pedido === 'reiteracion') dibujarNotaAnterior();
  programarVistaPrevia();
}

// ---------- La vista previa ----------

// Cada cambio del paso 2 pide la vista previa 300 ms después del último; mientras tanto, la hoja de antes queda marcada
function programarVistaPrevia() {
  clearTimeout(generador.esperaVista);
  dibujarVistaPrevia();
  generador.esperaVista = setTimeout(() => {
    pedirVistaPrevia();
  }, ESPERA);
}

/**
 * POST /notas/vista-previa con la nota de ahora (sin esperar). No se pide mientras carga el área, si falta algo para armar la nota o si
 * ya está la de esta clave. Una respuesta que llega cuando la nota ya cambió se descarta. Si falla con un campo, el error va a ese
 * campo (en el paso 3, de vuelta al paso 2 y con el foco en el campo); sin campo, el aviso con el mensaje del servidor; un 401, al
 * login.
 */
async function pedirVistaPrevia() {
  clearTimeout(generador.esperaVista);
  generador.esperaVista = null;
  if (!generador.area || generador.cargandoArea || Object.keys(erroresParaSeguir(generador, hoy())).length > 0) {
    dibujarVistaPrevia();
    return;
  }
  const cuerpo = cuerpoDelPedido(generador);
  const clave = JSON.stringify(cuerpo);
  if (generador.vistaPrevia?.clave === clave) {
    dibujarVistaPrevia();
    return;
  }
  dibujarVistaPrevia();
  let respuesta = null;
  let falla = null;
  try {
    respuesta = await API.pedirJson('POST', '/notas/vista-previa', cuerpo);
  } catch (error) {
    falla = error ?? new Error('');
  }
  if (falla && esSesionVencida(falla)) {
    irAlLogin();
    return;
  }
  // La nota cambió mientras tanto: lo que llegó no corresponde
  if (clave !== claveActual()) return;
  if (falla) {
    generador.falloDeVista = { clave, mensaje: falla.message || 'No se pudo armar la vista previa.', campo: falla.campo };
    mostrarFallaDelServidor(falla);
  } else {
    const datos = esObjeto(respuesta?.data) ? respuesta.data : {};
    generador.vistaPrevia = { clave, html: String(datos.html ?? ''), nombre: String(datos.nombre ?? '') };
    generador.falloDeVista = null;
    limpiarAviso();
  }
  dibujarVistaPrevia();
}

// Un error del servidor (de la vista previa o del Word): con un campo del paso 2, el error en ese campo; desde el paso 3, de vuelta
// al paso 2 con el foco en el campo. Sin campo, el aviso con el mensaje
function mostrarFallaDelServidor(falla) {
  if (!Object.prototype.hasOwnProperty.call(LUGARES_DE_ERROR, falla.campo)) {
    avisar(falla.message || 'No se pudo armar la nota.');
    return;
  }
  if (generador.paso === 3) {
    irAlPaso(2, { enfocar: false });
    dibujarPaso2();
    mostrarErrores({ [falla.campo]: falla.message });
    return;
  }
  ponerError(falla.campo, falla.message);
}

// La hoja de la vista previa del paso que se ve (la chica del paso 2 o la grande del paso 3) y, en el paso 3, el botón y el nombre
// del Word: solo con la nota de ahora
function dibujarVistaPrevia() {
  const { html, lista, actualizando } = vistaPreviaDe(generador, hoy());
  const id = generador.paso === 3 ? 'nt-grande' : 'nt-mini';
  const contenedor = porId(id);
  if (dibujosDeLaHoja.get(id) !== html) {
    contenedor.innerHTML = html;
    dibujosDeLaHoja.set(id, html);
  }
  contenedor.classList.toggle('actualizando', Boolean(actualizando));
  if (generador.paso !== 3) return;
  porId('nt-descargar').disabled = !lista;
  porId('nt-archivo').textContent = lista ? generador.vistaPrevia.nombre : '';
}

// ---------- Los errores de los campos ----------

// Los controles de un campo (los datasets: las casillas que se pueden tildar de la lista)
function controlesDe(campo) {
  if (campo === 'datasets') return [...porId('nt-datasets').querySelectorAll('input[name="dataset"]:not(:disabled)')];
  return LUGARES_DE_ERROR[campo].controles.map(porId).filter(Boolean);
}

// Muestra (o saca, con null) el error de un campo: el párrafo, aria-invalid en sus controles y el marco. false si no es un campo de
// la página
function ponerError(campo, mensaje) {
  if (!Object.prototype.hasOwnProperty.call(LUGARES_DE_ERROR, campo)) return false;
  const lugar = LUGARES_DE_ERROR[campo];
  const parrafo = porId(lugar.error);
  parrafo.textContent = mensaje ?? '';
  parrafo.hidden = !mensaje;
  for (const control of controlesDe(campo)) {
    if (mensaje) control.setAttribute('aria-invalid', 'true');
    else control.removeAttribute('aria-invalid');
  }
  if (lugar.marco) porId(lugar.marco).classList.toggle('invalido', Boolean(mensaje));
  return true;
}

// El foco de un campo con error: la opción elegida de un grupo (o la primera), la primera casilla que se puede tildar (o el grupo
// de los datasets) o el control
function enfocarCampo(campo) {
  const controles = controlesDe(campo);
  const destino = controles.find((control) => control.checked) ?? controles[0] ?? porId(LUGARES_DE_ERROR[campo].grupo ?? '');
  destino?.focus();
}

// Todos los errores juntos (los campos sin error quedan limpios) y el foco al primero. true si hubo alguno
function mostrarErrores(errores) {
  for (const campo of ORDEN_DE_LOS_ERRORES) ponerError(campo, errores[campo] ?? null);
  const primero = ORDEN_DE_LOS_ERRORES.find((campo) => errores[campo]);
  if (primero) enfocarCampo(primero);
  return Boolean(primero);
}

// ---------- Paso 3 ----------

// "Siguiente: revisar la nota" y "Ver en grande": si falta algo (o el servidor ya dijo que un campo de esta misma nota no sirve), los
// errores en sus campos y el foco al primero, sin pasar; si no, el paso 3, con la vista previa de ahora (si todavía no llegó, se pide
// sin esperar)
function irAlPaso3() {
  if (generador.cargandoArea || (!generador.area && !generador.errorDeArea)) {
    // Sin el área y sin cargarla, lo único que falta es una fecha que sirva
    const fecha = generador.cargandoArea ? null : errorDeFecha(generador.fecha, hoy());
    if (fecha) mostrarErrores({ fecha });
    else avisarQueCarga();
    return;
  }
  const errores = erroresParaSeguir(generador, hoy());
  const fallo = generador.falloDeVista;
  if (fallo?.clave === claveActual() && Object.prototype.hasOwnProperty.call(LUGARES_DE_ERROR, fallo.campo) && !errores[fallo.campo]) {
    errores[fallo.campo] = fallo.mensaje;
  }
  if (mostrarErrores(errores)) return;
  limpiarAviso();
  irAlPaso(3);
  dibujarPaso3();
  if (generador.vistaPrevia?.clave !== claveActual()) pedirVistaPrevia();
}

// "Siguiente" o "Ver en grande" mientras se cargan los datasets del área: un aviso, sin marcar ningún campo. Se saca cuando termina la
// carga
function avisarQueCarga() {
  porId('nt-aviso').innerHTML = `<div class="alert">${MENSAJE_CARGANDO_EL_AREA}</div>`;
  generador.avisoDeCarga = true;
}

function dibujarPaso3() {
  porId('nt-resumen').innerHTML = htmlDelResumen(generador);
  dibujarVistaPrevia();
}

// "Descargar Word": el Word de la nota de ahora (la de la vista previa), con el nombre que dio la vista previa. Un error con un campo
// vuelve al paso 2 con el foco en el campo; sin campo, el aviso; un 401, al login
async function descargarWord() {
  const boton = porId('nt-descargar');
  if (boton.disabled) return;
  const cuerpo = cuerpoDelPedido(generador);
  const vista = generador.vistaPrevia;
  if (vista?.clave !== JSON.stringify(cuerpo)) return;
  limpiarAviso();
  // Deshabilitado durante el pedido, el botón suelta el foco: si lo tenía, se lo devuelve
  const teniaElFoco = document.activeElement === boton;
  boton.disabled = true;
  let falla = null;
  try {
    descargarBlob(await pedirWord(cuerpo), vista.nombre || 'Nota.docx');
  } catch (error) {
    falla = error ?? new Error('');
  }
  boton.disabled = false;
  if (teniaElFoco && (!falla || !Object.prototype.hasOwnProperty.call(LUGARES_DE_ERROR, falla.campo))) boton.focus();
  if (!falla) return;
  if (esSesionVencida(falla)) {
    irAlLogin();
    return;
  }
  mostrarFallaDelServidor(falla);
}

// "Armar otra nota": el paso 1 sin área, número ni nota anterior, como solicitud. La fecha, el filtro y la búsqueda quedan
function armarOtraNota() {
  clearTimeout(generador.esperaVista);
  clearTimeout(generador.esperaFecha);
  generador.serieArea += 1;
  Object.assign(generador, {
    areaId: null, area: null, cargandoArea: false, errorDeArea: null, campoDeArea: null, avisoDeCarga: false, tipo: null, pedido: 'solicitud',
    numero: '', anteriores: [], anterioresEditadas: false, elegidos: new Set(), elegidosEditados: false, vistaPrevia: null, falloDeVista: null
  });
  porId('nt-numero').value = '';
  for (const campo of ORDEN_DE_LOS_ERRORES) ponerError(campo, null);
  limpiarAviso();
  irAlPaso(1);
  dibujarPaso1();
}
