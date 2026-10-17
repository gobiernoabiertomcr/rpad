/**
 * Admin - Gestión de Datasets - RPAD
 *
 * La lista (spec 2026-10-17-fechas-datasets, 8.2): filtros por estado con su contador, búsqueda por título o área,
 * gestión y tipo de pedido, 25 por página, y en el celular una tarjeta por dataset. Además, el alta en dos pasos con la
 * importación desde el Portal de Datos Abiertos, el formulario con "Actualización y pedido" y la vista previa de la nota
 * (8.4), la eliminación y el registro de una actualización (8.3): todo cambio queda pendiente de aprobación (doble
 * verificación) y el dataset queda bloqueado hasta que se resuelva. Todas las ventanas son diálogos con Escape, el foco
 * retenido y clic afuera (8.6, arreglo 5).
 *
 * Al cargarse solo declara (tests/admin-frontend.test.js lo carga en un vm): lo que toca el DOM, Auth o la API arranca en
 * DOMContentLoaded. Lo puro que arma la fila, la tarjeta, la pastilla de estado y el cuerpo del formulario está en
 * admin-fechas.js, que se carga antes; lo puro de la lista (filtros, contadores, páginas) y de los formatos está acá,
 * arriba de lo que toca el DOM.
 */

let datasets = [];
let temas = [];
let frecuencias = [];
let areas = [];
let deleteId = null;
let andinoAreaReferencia = null; // Área de referencia importada de Andino
// Ids (como texto) de los datasets con un cambio pendiente de aprobación: quedan bloqueados
let datasetsConPendientes = new Set();
// Quien mira puede administrar (superadmin, admin o editor): ve las acciones y "Nuevo dataset". Se lee en DOMContentLoaded
let puedeAdministrar = false;
// Si la primera carga de la lista falló, el mensaje que la reemplaza
let errorDeCarga = null;

const ITEMS_POR_PAGINA = 25;

// La lista: el filtro de estado ('' = todos), la búsqueda, la gestión, el tipo de pedido y la página. Se conserva al volver a
// pedir los datos (después de crear, editar, eliminar o registrar una actualización)
const estadoDeLista = { filtro: '', busqueda: '', gestion: '', tipo: '', pagina: 1 };

// Los filtros de estado, en el orden de los botones de admin.html ('' = Todos)
const VALORES_DE_FILTRO = ['', 'vencido', 'proximo', 'al-dia', 'eventual', 'sin-fecha', 'pendiente'];

// Sistema de formatos (chips)
let formatosSeleccionados = new Set();
let formatosCatalogo = [];

// "Registrar actualización" abierta (spec 8.3):
// - dataset: el de la lista (GET /datasets), con su pedido, sus fechas y su tipo; null con la ventana cerrada;
// - hoy: la fecha de Argentina, una vez por apertura;
// - opciones: las que mandó el servidor para el "Datos al" elegido;
// - errorDatosAl: el error del paso 1 (de acá o del servidor), o null;
// - cargando, enviando: se están pidiendo las opciones o se está mandando la propuesta (el botón no se puede apretar);
// - origen: el botón que la abrió (el foco vuelve a él al cerrar);
// - secuencia: cuenta los pedidos de opciones, así una respuesta que llega tarde no pisa a la última;
// - apertura: cuenta las aperturas, así el error de un envío no cae en otra ventana.
const registro = {
  dataset: null, hoy: null, opciones: [], errorDatosAl: null, cargando: false, enviando: false, origen: null, secuencia: 0, apertura: 0
};

// =====================================================
// LISTA: lo puro (filtros, contadores, páginas)
// =====================================================

// Texto para buscar: minúsculas y sin tildes ("area" encuentra "Área")
function textoParaBuscar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Los datasets que dejan los filtros de la barra: la búsqueda (en el título o en el área), la gestión y el tipo de pedido.
 * Sin el filtro de estado: sobre esta lista se cuentan los estados, así cada contador dice cuántos va a mostrar su botón.
 */
function filtrarPorBarra(lista, filtros) {
  const { busqueda = '', gestion = '', tipo = '' } = filtros ?? {};
  const termino = textoParaBuscar(busqueda).trim();
  return (Array.isArray(lista) ? lista : []).filter((d) =>
    (!termino || textoParaBuscar(d.titulo).includes(termino) || textoParaBuscar(d.area_nombre).includes(termino))
    && (!gestion || d.tipo_gestion === gestion)
    && (!tipo || d.tipo_pedido === tipo));
}

/**
 * Una página de una lista: { total, pagina, totalPaginas, desde, hasta, items }. Una página que ya no existe (porque la
 * lista se achicó) pasa a la última; una que no es un número, a la primera.
 */
function paginar(lista, pagina, porPagina = ITEMS_POR_PAGINA) {
  const todos = Array.isArray(lista) ? lista : [];
  const total = todos.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const pedida = Number.isInteger(Number(pagina)) ? Number(pagina) : 1;
  const actual = Math.min(Math.max(1, pedida), totalPaginas);
  const inicio = (actual - 1) * porPagina;
  return {
    total,
    pagina: actual,
    totalPaginas,
    desde: total ? inicio + 1 : 0,
    hasta: Math.min(inicio + porPagina, total),
    items: todos.slice(inicio, inicio + porPagina)
  };
}

/**
 * Lo que muestra la lista con su estado (estadoDeLista): los contadores de cada filtro de estado, con la barra aplicada, y la
 * página de los datasets que además caen en el filtro de estado. `pendientes`: los ids con un cambio pendiente (lista o
 * Set; número o texto). Un dataset con cambio pendiente cuenta y se filtra solo como pendiente (Ruling 14).
 */
function vistaDeLista(lista, estado, pendientes, porPagina = ITEMS_POR_PAGINA) {
  const e = estado ?? {};
  const conPendiente = new Set(Array.from(pendientes ?? [], (id) => String(id)));
  const porBarra = filtrarPorBarra(lista, e);
  const visibles = e.filtro
    ? porBarra.filter((d) => claseDeEstado(d, conPendiente.has(String(d.id))) === e.filtro)
    : porBarra;
  return { cuentas: contarPorEstado(porBarra, conPendiente), ...paginar(visibles, e.pagina, porPagina) };
}

// "13 datasets", o "Mostrando 26–50 de 60 datasets" si hay más de una página
function textoDelResumen({ total = 0, desde = 0, hasta = 0, totalPaginas = 1 } = {}) {
  if (totalPaginas > 1) return `Mostrando ${desde}–${hasta} de ${total} datasets`;
  return `${total} ${total === 1 ? 'dataset' : 'datasets'}`;
}

// Anterior, "Pág. 2 de 3" y Siguiente; con una sola página, nada. Los botones llevan data-pagina (sin onclick)
function htmlDeControlesDePagina({ pagina = 1, totalPaginas = 1 } = {}) {
  if (totalPaginas <= 1) return '';
  const boton = (destino, direccion, deshabilitado, contenido) =>
    `<button type="button" class="pag-btn" data-pagina="${destino}" data-direccion="${direccion}"${deshabilitado ? ' disabled' : ''}>${contenido}</button>`;
  return boton(pagina - 1, 'anterior', pagina <= 1, '<span aria-hidden="true">&#8249;</span> Anterior')
    + `<span class="pag-pagina">Pág. ${pagina} de ${totalPaginas}</span>`
    + boton(pagina + 1, 'siguiente', pagina >= totalPaginas, 'Siguiente <span aria-hidden="true">&#8250;</span>');
}

/**
 * Cómo va cada botón de filtro de estado: { [valor]: { cuenta, presionado, visible } }. "Sin fecha" aparece solo si hay
 * alguno (o si es el filtro elegido, para poder salir de él). "Con un cambio pendiente" solo para quien administra: el
 * lector no conoce los pendientes.
 */
function estadoDeFiltros(cuentas, filtro, conPendientes) {
  const elegido = filtro ?? '';
  const resultado = {};
  for (const valor of VALORES_DE_FILTRO) {
    const cuenta = Number(cuentas?.[valor || 'todos']) || 0;
    let visible = true;
    if (valor === 'sin-fecha') visible = cuenta > 0 || elegido === valor;
    if (valor === 'pendiente') visible = Boolean(conPendientes);
    resultado[valor] = { cuenta, presionado: elegido === valor, visible };
  }
  return resultado;
}

/**
 * Las <option> del selector de tipo de pedido: "Todos los tipos de pedido" y los tipos que tienen los datasets, una vez cada
 * uno y ordenados por nombre. El nombre lo manda el servidor (tipo_pedido_nombre): acá no hay otra lista de tipos.
 */
function opcionesDeTipoPedido(lista, seleccionado) {
  const nombres = new Map();
  for (const d of Array.isArray(lista) ? lista : []) {
    if (d && typeof d.tipo_pedido === 'string' && d.tipo_pedido && !nombres.has(d.tipo_pedido)) {
      nombres.set(d.tipo_pedido, d.tipo_pedido_nombre || d.tipo_pedido);
    }
  }
  const tipos = [...nombres].sort(([, a], [, b]) => String(a).localeCompare(String(b), 'es'));
  return '<option value="">Todos los tipos de pedido</option>'
    + tipos.map(([valor, nombre]) =>
      `<option value="${textoSeguro(valor)}"${valor === seleccionado ? ' selected' : ''}>${textoSeguro(nombre)}</option>`).join('');
}

/**
 * Las filas de la tabla y las tarjetas del celular de una página: { filas, tarjetas }. `hoy` se calcula una vez por página
 * y se pasa a cada fila. Sin datasets, el mensaje (escapado) en los dos lugares.
 */
function htmlDeLaLista(items, { pendientes, esAdmin = false, hoy, mensajeVacio = 'No hay datasets.' } = {}) {
  const lista = Array.isArray(items) ? items : [];
  if (lista.length === 0) {
    const mensaje = textoSeguro(mensajeVacio);
    return { filas: `<tr><td colspan="5" class="ad-vacio">${mensaje}</td></tr>`, tarjetas: `<p class="ad-vacio">${mensaje}</p>` };
  }
  const conPendiente = new Set(Array.from(pendientes ?? [], (id) => String(id)));
  const fecha = soloFecha(hoy) ?? hoyEnArgentina();
  const opcionesDe = (d) => ({ pendiente: conPendiente.has(String(d.id)), esAdmin, hoy: fecha });
  return {
    filas: lista.map((d) => htmlDeFila(d, opcionesDe(d))).join(''),
    tarjetas: lista.map((d) => htmlDeTarjeta(d, opcionesDe(d))).join('')
  };
}

// ¿Faltan catálogos? Sin temas, frecuencias o formatos no se puede completar el formulario (las API dan [] si fallan)
function faltanCatalogos({ temas: deTemas, frecuencias: deFrecuencias, formatos: deFormatos } = {}) {
  return [deTemas, deFrecuencias, deFormatos].some((lista) => !Array.isArray(lista) || lista.length === 0);
}

// =====================================================
// FORMULARIO: lo puro (formatos, título, frecuencia, mensajes)
// =====================================================

// Ícono Lucide (check) del formato elegido: decorativo, el botón dice su estado con aria-pressed
const ICONO_ELEGIDO = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg>';

/**
 * Los formatos del formulario: { chips, opciones }. `chips`: un botón con aria-pressed por formato habitual, más los no
 * habituales elegidos, que al apretarlos desaparecen: no quedan "sin presionar", así que no llevan aria-pressed sino su
 * nombre ("Sacar ODS") y una cruz. Llevan data-formato con el id y el que los usa escucha los clics por delegación, sin
 * onclick. `opciones`: las <option> de "+ Agregar otro formato…", con los no habituales que no
 * están elegidos. `catalogo`: GET /catalogos/formatos; `seleccionados`: ids (lista o Set; número o texto).
 */
function htmlDeFormatos(catalogo, seleccionados) {
  const lista = Array.isArray(catalogo) ? catalogo : [];
  const elegidos = new Set(Array.from(seleccionados ?? [], (id) => Number(id)));
  const habitual = (f) => Number(f.habitual) === 1;
  const elegido = (f) => elegidos.has(Number(f.id));
  const boton = (f) => (habitual(f)
    ? `<button type="button" class="ad-formato" data-formato="${textoSeguro(f.id)}" aria-pressed="${elegido(f)}">${ICONO_ELEGIDO}${textoSeguro(f.nombre)}</button>`
    : `<button type="button" class="ad-formato sacar" data-formato="${textoSeguro(f.id)}" aria-label="Sacar ${textoSeguro(f.nombre)}">`
      + `${ICONO_ELEGIDO}${textoSeguro(f.nombre)}<span class="ad-quitar" aria-hidden="true">&times;</span></button>`);
  const chips = [...lista.filter(habitual), ...lista.filter((f) => !habitual(f) && elegido(f))].map(boton).join('');
  const opciones = '<option value="">+ Agregar otro formato…</option>'
    + lista.filter((f) => !habitual(f) && !elegido(f)).map((f) => `<option value="${textoSeguro(f.id)}">${textoSeguro(f.nombre)}</option>`).join('');
  return { chips, opciones };
}

/**
 * El título y el subtítulo del formulario (spec 8.4): "Editar dataset" con el título del dataset; en un alta, "Nuevo
 * dataset - Paso 2" si se vino del paso 1 con datos del portal y "Nuevo dataset" con la carga manual.
 */
function tituloDelFormulario({ dataset = null, importado = false } = {}) {
  if (dataset) return { titulo: 'Editar dataset', subtitulo: String(dataset.titulo ?? '') };
  if (importado) return { titulo: 'Nuevo dataset - Paso 2', subtitulo: 'Título, descripción y formatos importados del portal' };
  return { titulo: 'Nuevo dataset', subtitulo: 'Carga manual' };
}

/**
 * Los meses de la frecuencia `id` del catálogo (GET /catalogos/frecuencias): un número; null si es la Eventual (sin meses);
 * undefined si no hay una elegida o no está en el catálogo.
 */
function mesesDeLaFrecuencia(catalogo, id) {
  if (id === '' || id === null || id === undefined) return undefined;
  const frecuencia = (Array.isArray(catalogo) ? catalogo : []).find((f) => String(f.id) === String(id));
  if (!frecuencia) return undefined;
  return Number.isInteger(frecuencia.meses) && frecuencia.meses > 0 ? frecuencia.meses : null;
}

// El error del portal en el paso 1, con la salida: seguir con la carga manual
function textoDeErrorDelPortal(mensaje) {
  const texto = String(mensaje ?? '').trim() || 'No se pudo obtener información del portal';
  return `${texto}${/[.!?]$/.test(texto) ? '' : '.'} Podés seguir con la carga manual.`;
}

// El error de un envío del formulario: el del servidor tal cual, salvo el de "sin cambios", que dice qué hacer
function mensajeDelEnvio(error) {
  const mensaje = textoDeError(error, 'No se pudo proponer. Probá de nuevo.');
  return mensaje.includes('No se detectaron cambios')
    ? 'No realizaste ningún cambio. Modificá al menos un campo para proponer.'
    : mensaje;
}

// =====================================================
// INICIO
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Verificar autenticación
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  puedeAdministrar = Auth.isAdmin();
  prepararLista();
  prepararVentanas();
  prepararRegistro();
  prepararFormulario();
  // El lector ve la lista sin acciones y sin "Nuevo dataset"
  if (puedeAdministrar) document.getElementById('btn-nuevo-dataset').hidden = false;

  // Los catálogos solo los usa el formulario: el lector no los necesita
  await Promise.all([puedeAdministrar ? loadCatalogos() : null, recargarLista()]);
});

// Avisos flotantes (showToast, de main.js): se ven por encima de cualquier ventana abierta. showToast arma HTML: el texto va escapado
function avisarExito(texto) {
  showToast(Utils.escapeHtml(texto), 'success');
}

function avisarError(texto) {
  showToast(Utils.escapeHtml(texto || 'No se pudo completar la operación.'), 'error');
}

async function loadCatalogos() {
  try {
    [temas, frecuencias, formatosCatalogo, areas] = await Promise.all([
      API.getTemas(),
      API.getFrecuencias(),
      API.getFormatos(),
      API.getAreas()
    ]);

    // Llenar selects de temas
    const temaOptions = temas.map(t => `<option value="${t.id}">${Utils.escapeHtml(t.nombre)}</option>`).join('');
    document.getElementById('tema_principal_id').innerHTML = '<option value="">Seleccionar...</option>' + temaOptions;
    document.getElementById('tema_secundario_id').innerHTML = '<option value="">Ninguno</option>' + temaOptions;

    // Llenar select de frecuencias
    document.getElementById('frecuencia_id').innerHTML = '<option value="">Seleccionar...</option>' +
      frecuencias.map(f => `<option value="${f.id}">${Utils.escapeHtml(f.nombre)}</option>`).join('');

    // Llenar select de áreas
    actualizarSelectAreas();

    if (faltanCatalogos({ temas, frecuencias, formatos: formatosCatalogo })) avisarFallaDeCatalogos();
  } catch (error) {
    console.error('Error cargando catálogos:', error);
    avisarFallaDeCatalogos();
  }
}

// Si fallan los catálogos el formulario no sirve: se avisa arriba de la lista, y el aviso queda (spec 8.6, arreglo 8)
function avisarFallaDeCatalogos() {
  document.getElementById('message-container').innerHTML = '<div class="alert alert-error ad-aviso" role="alert">'
    + 'No se pudieron cargar los catálogos (temas, frecuencias o formatos): hasta que recargues la página no vas a poder crear ni editar datasets.'
    + '</div>';
}

function actualizarSelectAreas() {
  const areaOptions = areas.map(a => `<option value="${a.id}">${Utils.escapeHtml(a.nombre)}</option>`).join('');
  document.getElementById('area_id').innerHTML = '<option value="">Seleccionar...</option>' + areaOptions;
}

// =====================================================
// LISTA: lo que toca el DOM
// =====================================================

// Los oyentes de la barra, de los filtros de estado y de los botones de la lista (por delegación: las filas no llevan onclick)
function prepararLista() {
  // Para el lector, la columna de acciones no existe (ni a la vista ni para el lector de pantalla)
  document.getElementById('tabla-datasets').classList.toggle('ad-solo-lectura', !puedeAdministrar);

  document.getElementById('filtros-estado').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-filtro]');
    if (!boton) return;
    estadoDeLista.filtro = boton.dataset.filtro;
    estadoDeLista.pagina = 1;
    pintarLista();
  });

  // Los controles arrancan como dice el estado (el navegador puede haber restaurado lo que tenían antes de recargar)
  const buscar = document.getElementById('buscar');
  buscar.value = estadoDeLista.busqueda;
  let demora = null;
  buscar.addEventListener('input', () => {
    clearTimeout(demora);
    demora = setTimeout(() => {
      estadoDeLista.busqueda = buscar.value;
      estadoDeLista.pagina = 1;
      pintarLista();
    }, 300);
  });

  for (const [id, campo] of [['filtro-gestion', 'gestion'], ['filtro-tipo', 'tipo']]) {
    const selector = document.getElementById(id);
    selector.value = estadoDeLista[campo];
    selector.addEventListener('change', () => {
      estadoDeLista[campo] = selector.value;
      estadoDeLista.pagina = 1;
      pintarLista();
    });
  }

  document.getElementById('lista-datasets').addEventListener('click', alHacerClicEnLaLista);
}

// Registrar, editar, eliminar y cambiar de página. Un botón deshabilitado (dataset bloqueado) no hace nada
function alHacerClicEnLaLista(evento) {
  const boton = evento.target.closest('button');
  if (!boton || boton.disabled) return;
  const { registrar, editar, eliminar, pagina, direccion } = boton.dataset;
  if (pagina !== undefined) irAPagina(Number(pagina), direccion);
  else if (registrar !== undefined) marcarActualizado(Number(registrar), boton);
  else if (editar !== undefined) editDataset(Number(editar), boton);
  else if (eliminar !== undefined) openDeleteModal(Number(eliminar), tituloDelDataset(eliminar), boton);
}

function tituloDelDataset(id) {
  return datasets.find((d) => String(d.id) === String(id))?.titulo ?? '';
}

/**
 * Vuelve a pedir los datasets y los pendientes, y pinta la lista con el mismo filtro, la misma búsqueda y la misma página.
 * Se usa al abrir la página y después de cada cambio propuesto (spec 8.6, arreglo 2).
 */
async function recargarLista() {
  try {
    const [lista, pendientes] = await Promise.all([
      API.getDatasets(),
      puedeAdministrar
        ? API.getDatasetsConPendientes().catch((error) => {
          console.error('Error cargando los datasets con cambios pendientes:', error);
          return [];
        })
        : []
    ]);
    datasets = [...lista].sort((a, b) => String(a.titulo ?? '').localeCompare(String(b.titulo ?? '')));
    datasetsConPendientes = new Set(Array.from(Array.isArray(pendientes) ? pendientes : [], (id) => String(id)));
    errorDeCarga = null;
  } catch (error) {
    console.error('Error cargando datasets:', error);
    const mensaje = 'No se pudieron cargar los datasets. Recargá la página para intentar de nuevo.';
    // Si ya había una lista, queda la que estaba
    if (datasets.length) avisarError(mensaje);
    else errorDeCarga = mensaje;
  }
  pintarTiposDePedido();
  pintarLista();
}

function pintarTiposDePedido() {
  const selector = document.getElementById('filtro-tipo');
  selector.innerHTML = opcionesDeTipoPedido(datasets, estadoDeLista.tipo);
  // Si ningún dataset tiene ya el tipo elegido, el selector vuelve a "Todos" y el filtro también
  estadoDeLista.tipo = selector.value;
}

function pintarLista() {
  const vista = vistaDeLista(datasets, estadoDeLista, datasetsConPendientes);
  estadoDeLista.pagina = vista.pagina;
  pintarFiltros(vista.cuentas);

  let mensajeVacio = 'Ningún dataset coincide con la búsqueda y los filtros.';
  if (errorDeCarga) mensajeVacio = errorDeCarga;
  else if (datasets.length === 0) mensajeVacio = 'Todavía no hay datasets.';
  const { filas, tarjetas } = htmlDeLaLista(errorDeCarga ? [] : vista.items, {
    pendientes: datasetsConPendientes, esAdmin: puedeAdministrar, hoy: hoyEnArgentina(), mensajeVacio
  });
  document.getElementById('filas-datasets').innerHTML = filas;
  document.getElementById('tarjetas-datasets').innerHTML = tarjetas;
  document.getElementById('resumen-lista').textContent = errorDeCarga ? '' : textoDelResumen(vista);
  document.getElementById('controles-pagina').innerHTML = errorDeCarga ? '' : htmlDeControlesDePagina(vista);
}

// Los botones se actualizan en su lugar (no se rearman): el que tiene el foco lo conserva
function pintarFiltros(cuentas) {
  const estados = estadoDeFiltros(cuentas, estadoDeLista.filtro, puedeAdministrar);
  for (const boton of document.querySelectorAll('#filtros-estado [data-filtro]')) {
    const estado = estados[boton.dataset.filtro];
    if (!estado) continue;
    boton.setAttribute('aria-pressed', String(estado.presionado));
    boton.hidden = !estado.visible;
    boton.querySelector('b').textContent = estado.cuenta;
  }
}

function irAPagina(pagina, direccion) {
  estadoDeLista.pagina = pagina;
  pintarLista();
  const sinMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById('lista-datasets').scrollIntoView({ behavior: sinMovimiento ? 'auto' : 'smooth', block: 'start' });
  // Los botones se rearmaron: el foco vuelve al mismo (o al otro, si este quedó deshabilitado en la punta)
  const controles = document.getElementById('controles-pagina');
  const destino = controles.querySelector(`[data-direccion="${direccion}"]:not(:disabled)`) ?? controles.querySelector('button:not(:disabled)');
  if (destino) destino.focus({ preventScroll: true });
}

// =====================================================
// VENTANAS: abrir, cerrar, Escape, Tab y clic afuera (spec 8.6, arreglo 5)
// =====================================================
// Cada ventana de la página es un velo (.ad-velo, con `hidden`) con un diálogo adentro (.ad-ventana, role="dialog"). Se
// apilan: el formulario abre encima la confirmación de "Actualizar desde portal" o "Nueva área". La de arriba recibe el
// teclado (Escape la cierra y Tab no sale de ella) y, al cerrarse, el foco vuelve a lo que lo tenía al abrirla. Un clic
// afuera cierra solo si la presión empezó en el velo (presionEnVelo y esClicAfuera, más abajo).

const ID_REGISTRO = 'modal-registrar-actualizacion';

// Las ventanas abiertas, de abajo hacia arriba: { id, origen }. "Registrar actualización" está en la pila solo para el
// teclado: el foco al cerrarla lo maneja ella (cerrarRegistro)
const pilaDeVentanas = [];

// Cómo se cierra cada ventana: la cruz y "Cancelar" (data-cerrar) la cierran siempre; Escape y el clic afuera pasan antes
// por salirDeVentana, que no deja perder los cambios del formulario (Ruling 19)
const CIERRE_DE_VENTANA = {
  'modal-step1': () => closeStep1Modal(),
  'modal-dataset': () => closeModal(),
  'modal-confirm-update': () => closeConfirmUpdateModal(),
  'modal-quick-area': () => closeQuickAreaModal(),
  'modal-delete': () => closeDeleteModal(),
  'modal-descartar': () => cerrarVentana('modal-descartar'),
  [ID_REGISTRO]: () => cerrarRegistro()
};

// Los oyentes de las ventanas (los de "Registrar actualización" los pone prepararRegistro) y del teclado. En DOMContentLoaded
function prepararVentanas() {
  for (const id of Object.keys(CIERRE_DE_VENTANA)) {
    if (id === ID_REGISTRO) continue;
    const velo = document.getElementById(id);
    velo.addEventListener('mousedown', presionEnVelo);
    velo.addEventListener('click', alHacerClicEnVelo);
  }
  document.addEventListener('keydown', teclaEnPagina);
}

// Un clic en una ventana: la cruz y "Cancelar" la cierran; un clic afuera, solo si no se pierden cambios (salirDeVentana)
function alHacerClicEnVelo(evento) {
  const { id } = evento.currentTarget;
  // esClicAfuera va primero: consume la presión anotada aunque el clic haya sido en un botón
  const afuera = esClicAfuera(evento);
  if (evento.target.closest('[data-cerrar]')) CIERRE_DE_VENTANA[id]();
  else if (afuera) salirDeVentana(id, 'afuera');
}

/**
 * Escape o un clic afuera (Ruling 19). El formulario con cambios sin guardar no se cierra así: con Escape pregunta
 * "¿Descartar los cambios?" y con un clic afuera no hace nada (un clic de más no borra lo escrito). Sin cambios, y en las
 * demás ventanas, cierra como siempre.
 */
function salirDeVentana(id, como) {
  if (id === 'modal-dataset' && formularioConCambios()) {
    if (como === 'escape') abrirVentana('modal-descartar', document.getElementById('btn-seguir-editando'));
    return;
  }
  CIERRE_DE_VENTANA[id]();
}

// "Descartar": se cierran la pregunta y el formulario, sin guardar
function descartarCambios() {
  cerrarVentana('modal-descartar');
  closeModal();
}

function apilarVentana(id, origen) {
  desapilarVentana(id);
  pilaDeVentanas.push({ id, origen: origen ?? null });
  actualizarInert();
}

function desapilarVentana(id) {
  const indice = pilaDeVentanas.findIndex((ventana) => ventana.id === id);
  if (indice === -1) return null;
  const [ventana] = pilaDeVentanas.splice(indice, 1);
  document.getElementById(id).inert = false;
  actualizarInert();
  return ventana;
}

// Solo la ventana de arriba se puede usar: las de abajo quedan inertes (ni el foco ni el lector de pantalla llegan a ellas)
function actualizarInert() {
  const arriba = pilaDeVentanas.length - 1;
  pilaDeVentanas.forEach((ventana, i) => { document.getElementById(ventana.id).inert = i !== arriba; });
}

// Lo que tenía el foco al abrir la ventana `id`, o null
function origenDe(id) {
  return pilaDeVentanas.find((ventana) => ventana.id === id)?.origen ?? null;
}

/**
 * Abre la ventana `id` y pone el foco en `foco`. `origen`: lo que recibe el foco al cerrarla (por defecto, lo que lo tiene
 * ahora; el botón de la lista se pasa aparte porque no todos los navegadores lo enfocan al hacerle clic).
 */
function abrirVentana(id, foco, origen = document.activeElement) {
  const velo = document.getElementById(id);
  apilarVentana(id, origen);
  velo.hidden = false;
  velo.scrollTop = 0;
  if (foco) foco.focus();
}

// Cierra la ventana `id` y devuelve el foco a lo que lo tenía al abrirla, si sigue en la página. false si ya estaba cerrada
function cerrarVentana(id) {
  const velo = document.getElementById(id);
  if (velo.hidden) return false;
  velo.hidden = true;
  const origen = desapilarVentana(id)?.origen;
  if (origen && origen.isConnected && typeof origen.focus === 'function') origen.focus();
  return true;
}

// La ventana abierta de más arriba, o null si no hay ninguna
function ventanaDeArriba() {
  for (let i = pilaDeVentanas.length - 1; i >= 0; i--) {
    if (!document.getElementById(pilaDeVentanas[i].id).hidden) return pilaDeVentanas[i].id;
  }
  return registroAbierto() ? ID_REGISTRO : null;
}

// ¿Hay alguna ventana abierta?
function hayUnaVentanaAbierta() {
  return ventanaDeArriba() !== null;
}

/**
 * Después de recargar la lista: si el botón que abrió una ventana ya no está (la lista se rearmó; el de la fila nueva puede
 * estar deshabilitado porque el dataset quedó bloqueado) y no hay otra ventana abierta, el foco va a la lista.
 */
function enfocarLaListaSiSeRearmo(origen) {
  if (origen && !origen.isConnected && !hayUnaVentanaAbierta()) document.getElementById('lista-datasets').focus();
}

// =====================================================
// FORMATOS DEL DATASET (botones con aria-pressed)
// =====================================================

function renderizarChipsFormatos() {
  const { chips, opciones } = htmlDeFormatos(formatosCatalogo, formatosSeleccionados);
  document.getElementById('chips-container').innerHTML = chips;
  document.getElementById('formato-dropdown').innerHTML = opciones;
}

// Un clic en un formato lo elige o lo saca. El botón se rearma: el foco vuelve al mismo formato o, si desapareció (uno no
// habitual que se sacó), al desplegable
function alHacerClicEnFormatos(boton) {
  const id = Number(boton.dataset.formato);
  if (formatosSeleccionados.has(id)) formatosSeleccionados.delete(id);
  else formatosSeleccionados.add(id);
  renderizarChipsFormatos();
  alCambiarLosFormatos();
  const mismo = [...document.querySelectorAll('#chips-container [data-formato]')].find((chip) => Number(chip.dataset.formato) === id);
  (mismo ?? document.getElementById('formato-dropdown')).focus();
}

// Se eligió un formato no habitual en el desplegable
function alAgregarFormato(desplegable) {
  if (!desplegable.value) return;
  formatosSeleccionados.add(Number(desplegable.value));
  renderizarChipsFormatos();
  alCambiarLosFormatos();
}

// Con un formato elegido, el error de "Elegí al menos un formato" ya no corresponde
function alCambiarLosFormatos() {
  if (formatosSeleccionados.size > 0) mostrarErrorDeFormatos(null);
  alCambiarElFormularioDelDataset();
}

/**
 * Pre-selecciona formatos por nombre (para importación desde Andino)
 */
function preseleccionarFormatosPorNombre(nombresFormatos) {
  if (!nombresFormatos || !Array.isArray(nombresFormatos)) return;

  nombresFormatos.forEach(nombre => {
    const formato = formatosCatalogo.find(f =>
      f.nombre.toUpperCase() === nombre.toUpperCase()
    );
    if (formato) {
      formatosSeleccionados.add(Number(formato.id));
    }
  });
}

// =====================================================
// PASO 1: importar desde el Portal de Datos Abiertos (spec 8.4: el flujo y el endpoint no cambian)
// =====================================================

// Cuenta las aperturas del paso 1: la respuesta del portal que llega después de cerrarlo (o de volver a abrirlo) se descarta
const paso1 = { apertura: 0 };

function openStep1Modal(origen) {
  paso1.apertura++;
  andinoAreaReferencia = null;
  const campo = document.getElementById('andino-url');
  campo.value = '';
  mostrarError('step1-error', null, { campos: ['andino-url'] });
  const siguiente = document.getElementById('btn-siguiente');
  siguiente.disabled = false;
  siguiente.textContent = 'Siguiente';
  abrirVentana('modal-step1', campo, origen);
}

function closeStep1Modal() {
  cerrarVentana('modal-step1');
}

// Saltar al formulario sin importar (carga manual). Una importación en curso se descarta
function skipToManualEntry() {
  paso1.apertura++;
  andinoAreaReferencia = null;
  closeStep1Modal();
  openModal(null);
}

// "Siguiente": consulta el portal (GET /andino/fetch) y abre el formulario con el título, la descripción, la URL y los
// formatos. Si falla, el error queda en el paso 1 y se puede seguir con la carga manual
async function fetchAndContinue(evento) {
  evento?.preventDefault();
  const apertura = paso1.apertura;
  const campo = document.getElementById('andino-url');
  const siguiente = document.getElementById('btn-siguiente');
  if (siguiente.disabled) return;
  const url = campo.value.trim();
  if (!url) {
    mostrarError('step1-error', 'Falta la URL del dataset. Si no está en el portal, elegí "Carga manual".', { campos: ['andino-url'] });
    campo.focus();
    return;
  }

  mostrarError('step1-error', null, { campos: ['andino-url'] });
  siguiente.disabled = true;
  siguiente.textContent = 'Buscando en el portal…';
  let importado = null;
  let error = null;
  try {
    const response = await fetch(`${CONFIG.API_URL}/andino/fetch?url=${encodeURIComponent(url)}`);
    const result = await response.json();
    if (!response.ok || !result.success) error = textoDeErrorDelPortal(result.error);
    else importado = result.data;
  } catch (falla) {
    console.error('Error consultando Andino:', falla);
    error = 'No se pudo conectar con el servidor. Podés seguir con la carga manual.';
  }
  if (apertura !== paso1.apertura || document.getElementById('modal-step1').hidden) return;

  siguiente.disabled = false;
  siguiente.textContent = 'Siguiente';
  if (error) {
    mostrarError('step1-error', error, { campos: ['andino-url'] });
    return;
  }
  // El área del portal es solo una referencia: se muestra arriba del selector de área
  andinoAreaReferencia = importado.area_responsable_texto || null;
  closeStep1Modal();
  openModal(null, importado);
}

// =====================================================
// FORMULARIO DEL DATASET: alta y edición (spec 8.4)
// =====================================================
// "Datos del dataset" como antes y "Actualización y pedido": frecuencia, gestión, tipo de pedido con su sugerencia, "Cargado
// en el portal el", "Datos al" y la próxima con mes y año, "Qué se solicita" con el aviso por las frases de período y la
// vista previa de la nota. Lo puro (el cuerpo del PUT/POST, los selectores, las sugerencias) está en admin-fechas.js.

// El formulario abierto:
// - original: el dataset de GET /datasets/:id al editar; null en un alta;
// - tipoAMano: en un alta, la persona eligió el tipo de pedido (si no, el tipo sigue al sugerido);
// - soloAnio: "Datos al" se elige solo con el año (el tipo es ejercicio);
// - hoy: la fecha de Argentina, una vez por apertura;
// - apertura: cuenta las aperturas, así la respuesta de un envío no cae en otra;
// - enviando: se está mandando la propuesta (el botón no se puede apretar);
// - secuencia, demora, clave: la vista previa (cada pedido cuenta, se espera un instante antes de pedir y uno igual al
//   último no se repite);
// - sugerencia, alerta: lo último que se escribió en la sugerencia y en el aviso (no se reescriben si no cambian);
// - huella: lo que se mandaría, tomado al abrir con lo importado ya puesto (huellaDelFormulario); null con el formulario
//   cerrado. Con ella se sabe si hay cambios sin guardar (Ruling 19).
const edicion = {
  original: null, tipoAMano: false, soloAnio: false, hoy: null, apertura: 0, enviando: false,
  secuencia: 0, demora: null, clave: null, sugerencia: null, alerta: null, huella: null
};
// La vista previa espera este tiempo (ms) después del último cambio antes de pedirle el pedido al servidor
const DEMORA_DE_VISTA_PREVIA = 250;
const CAMPOS_DE_DATOS_AL = ['form-datos-mes', 'form-datos-anio'];
const CAMPOS_DE_PROXIMA = ['form-prox-mes', 'form-prox-anio'];

// Los oyentes del paso 1, del formulario y de sus ventanas. En DOMContentLoaded
function prepararFormulario() {
  document.getElementById('btn-nuevo-dataset').addEventListener('click', (evento) => openStep1Modal(evento.currentTarget));
  document.getElementById('form-paso1').addEventListener('submit', fetchAndContinue);
  document.getElementById('btn-carga-manual').addEventListener('click', skipToManualEntry);
  document.getElementById('dataset-form').addEventListener('submit', enviarFormulario);
  const formulario = document.getElementById('dataset-form');
  formulario.addEventListener('change', alCambiarCampoDelFormulario);
  formulario.addEventListener('input', alEscribirEnElFormulario);
  formulario.addEventListener('click', alHacerClicEnElFormulario);
  document.getElementById('btn-confirm-update').addEventListener('click', confirmUpdateFromAndino);
  document.getElementById('form-area-rapida').addEventListener('submit', saveQuickArea);
  document.getElementById('btn-confirmar-eliminar').addEventListener('click', confirmDelete);
  document.getElementById('btn-descartar').addEventListener('click', descartarCambios);
}

function formularioAbierto() {
  return !document.getElementById('modal-dataset').hidden;
}

// ¿El formulario abierto tiene cambios sin guardar? (Ruling 19)
function formularioConCambios() {
  return formularioAbierto() && hayCambiosSinGuardar(edicion.huella, formularioDelDataset());
}

/**
 * Abre el formulario.
 * @param {Object|null} dataset - el de GET /datasets/:id para editarlo, o null para un alta
 * @param {Object|null} andinoData - lo importado del portal en el paso 1 (título, descripción, URL y formatos)
 * @param {Element} [origen] - lo que recibe el foco al cerrarlo
 */
function openModal(dataset = null, andinoData = null, origen = undefined) {
  document.getElementById('dataset-form').reset();
  const hoy = hoyEnArgentina();
  Object.assign(edicion, {
    original: dataset, tipoAMano: false, hoy, apertura: edicion.apertura + 1, enviando: false, clave: null, sugerencia: null, alerta: null
  });

  const { titulo, subtitulo } = tituloDelFormulario({ dataset, importado: Boolean(andinoData) });
  document.getElementById('form-titulo').textContent = titulo;
  document.getElementById('form-subtitulo').textContent = subtitulo;
  const boton = document.getElementById('submit-btn');
  boton.textContent = textoDelBotonDeProponer();
  boton.disabled = false;

  // Los errores, también el aviso de "sin cambios", son del intento anterior (spec 8.6, arreglo 6)
  limpiarErroresDelFormulario();

  // Datos del dataset: los guardados o, en un alta, lo importado del portal. "Cargado en el portal el" arranca en hoy
  const campos = dataset
    ? {
      titulo: dataset.titulo, area_id: dataset.area_id, descripcion: dataset.descripcion,
      tema_principal_id: dataset.tema_principal_id, tema_secundario_id: dataset.tema_secundario_id,
      frecuencia_id: dataset.frecuencia_id, tipo_gestion: dataset.tipo_gestion, url_dataset: dataset.url_dataset,
      observaciones: dataset.observaciones, que_se_solicita: dataset.que_se_solicita,
      ultima_actualizacion: soloFecha(dataset.ultima_actualizacion)
    }
    : { titulo: andinoData?.titulo, descripcion: andinoData?.descripcion, url_dataset: andinoData?.url_dataset, ultima_actualizacion: hoy };
  for (const [id, valor] of Object.entries(campos)) document.getElementById(id).value = valor ?? '';
  // La carga no puede ser posterior a hoy; una guardada que ya lo es (un dato viejo) no frena el envío si no se toca: el
  // servidor solo la revisa si cambia
  const cargado = soloFecha(campos.ultima_actualizacion);
  document.getElementById('ultima_actualizacion').max = cargado && cargado > hoy ? cargado : hoy;

  formatosSeleccionados.clear();
  if (dataset && Array.isArray(dataset.formatos_array)) dataset.formatos_array.forEach((f) => formatosSeleccionados.add(Number(f.id)));
  if (!dataset && andinoData) preseleccionarFormatosPorNombre(andinoData.formatos);
  renderizarChipsFormatos();

  // "Actualizar desde portal" solo al editar un dataset del portal; el área del portal, solo en un alta importada
  document.getElementById('andino-update-section').hidden = !(dataset && String(dataset.url_dataset ?? '').includes('datos.comodoro.gov.ar'));
  const referencia = !dataset && andinoData ? andinoAreaReferencia : null;
  document.getElementById('andino-area-texto').textContent = referencia ?? '';
  document.getElementById('andino-area-referencia').hidden = !referencia;

  // Actualización y pedido: el tipo guardado (o, en un alta, el sugerido), siempre coherente con la frecuencia
  const meses = mesesDeLaFrecuencia(frecuencias, valorDe('frecuencia_id'));
  const gestion = valorDe('tipo_gestion');
  const tipo = tipoCoherente(dataset ? dataset.tipo_pedido : tipoSugeridoDe(gestion, meses), meses, gestion);
  document.getElementById('tipo_pedido').innerHTML = htmlDeTiposDePedido(meses, tipo);
  const datosAl = soloFecha(dataset?.datos_al);
  pintarDatosAl({
    mes: datosAl ? Number(datosAl.slice(5, 7)) : '', anio: datosAl ? Number(datosAl.slice(0, 4)) : '',
    sinDato: !datosAl, soloAnio: tipo === 'ejercicio'
  });
  const proxima = selectoresDeProxima(dataset?.proxima_actualizacion, hoy);
  document.getElementById('form-prox-mes').innerHTML = proxima.mes;
  document.getElementById('form-prox-anio').innerHTML = proxima.anio;

  actualizarFormulario();
  edicion.huella = huellaDelFormulario(formularioDelDataset());
  abrirVentana('modal-dataset', document.getElementById('titulo'), origen);
}

function textoDelBotonDeProponer() {
  return edicion.original ? 'Proponer cambios' : 'Proponer alta';
}

// Cierra el formulario. Una vista previa en camino se descarta
function closeModal() {
  clearTimeout(edicion.demora);
  edicion.secuencia++;
  edicion.clave = null;
  edicion.huella = null;
  andinoAreaReferencia = null;
  cerrarVentana('modal-dataset');
}

async function editDataset(id, origen) {
  // Verificar bloqueo por cambios pendientes
  if (datasetEstaBloqueado(id)) {
    mostrarMensajeBloqueo();
    return;
  }

  try {
    const dataset = await API.getDataset(id);
    if (dataset) {
      openModal(dataset, null, origen);
    }
  } catch (error) {
    console.error('Error cargando dataset:', error);
    avisarError('Error al cargar el dataset');
  }
}

// Lo que dicen los campos del formulario, como lo reciben cuerpoDelDataset y problemasDelFormulario (admin-fechas.js)
function formularioDelDataset() {
  return {
    titulo: valorDe('titulo'), area_id: valorDe('area_id'), descripcion: valorDe('descripcion'),
    tema_principal_id: valorDe('tema_principal_id'), tema_secundario_id: valorDe('tema_secundario_id'),
    frecuencia_id: valorDe('frecuencia_id'), formatos: Array.from(formatosSeleccionados),
    url_dataset: valorDe('url_dataset'), observaciones: valorDe('observaciones'), que_se_solicita: valorDe('que_se_solicita'),
    tipo_gestion: valorDe('tipo_gestion'), tipo_pedido: valorDe('tipo_pedido'),
    meses: mesesDeLaFrecuencia(frecuencias, valorDe('frecuencia_id')),
    cargado: valorDe('ultima_actualizacion'),
    datosMes: valorDe('form-datos-mes'), datosAnio: valorDe('form-datos-anio'),
    proxMes: valorDe('form-prox-mes'), proxAnio: valorDe('form-prox-anio'),
    original: edicion.original
  };
}

// Los cambios de los selectores y de los campos (por delegación: el formulario escucha change, input y click)
function alCambiarCampoDelFormulario(evento) {
  const { id } = evento.target;
  if (id === 'frecuencia_id' || id === 'tipo_gestion') alCambiarFrecuenciaOGestion();
  else if (id === 'tipo_pedido') alCambiarTipo();
  else if (CAMPOS_DE_DATOS_AL.includes(id)) alCambiarDatosAlDelFormulario();
  else if (CAMPOS_DE_PROXIMA.includes(id)) {
    mostrarError('form-error-proxima', null, { campos: CAMPOS_DE_PROXIMA });
    alCambiarElFormularioDelDataset();
  } else if (id === 'formato-dropdown') alAgregarFormato(evento.target);
  else alCambiarElFormularioDelDataset();
}

// Lo que se escribe (los selectores ya pasan por change)
function alEscribirEnElFormulario(evento) {
  if (evento.target.tagName !== 'SELECT') alCambiarElFormularioDelDataset();
}

function alHacerClicEnElFormulario(evento) {
  const formato = evento.target.closest('[data-formato]');
  if (formato) alHacerClicEnFormatos(formato);
  else if (evento.target.closest('[data-usar-sugerido]')) usarSugerido();
  else if (evento.target.closest('#btn-actualizar-portal')) updateFromAndino();
  else if (evento.target.closest('#btn-nueva-area')) openQuickAreaModal();
}

/**
 * Cambió la frecuencia o la gestión. El tipo queda coherente con la frecuencia (Eventual ⇔ eventual, spec 8.4); en un alta,
 * mientras la persona no elija otro, sigue al sugerido. La próxima puede haber pasado a obligatoria o a vacía.
 */
function alCambiarFrecuenciaOGestion() {
  const meses = mesesDeLaFrecuencia(frecuencias, valorDe('frecuencia_id'));
  const gestion = valorDe('tipo_gestion');
  const sigueAlSugerido = !edicion.original && !edicion.tipoAMano;
  pintarTipo(tipoCoherente(sigueAlSugerido ? tipoSugeridoDe(gestion, meses) : valorDe('tipo_pedido'), meses, gestion), meses);
  mostrarError('form-error-proxima', null, { campos: CAMPOS_DE_PROXIMA });
  alCambiarElFormularioDelDataset();
}

// La persona eligió un tipo de pedido: desde ahora el tipo no sigue al sugerido
function alCambiarTipo() {
  edicion.tipoAMano = true;
  cambiarModoDeDatosAl(valorDe('tipo_pedido'));
  alCambiarElFormularioDelDataset();
}

// "Usar el sugerido": el tipo pasa al sugerido (y en un alta lo vuelve a seguir). El botón desaparece: el foco va al tipo
function usarSugerido() {
  const meses = mesesDeLaFrecuencia(frecuencias, valorDe('frecuencia_id'));
  const gestion = valorDe('tipo_gestion');
  pintarTipo(tipoCoherente(tipoSugeridoDe(gestion, meses), meses, gestion), meses);
  edicion.tipoAMano = false;
  alCambiarElFormularioDelDataset();
  document.getElementById('tipo_pedido').focus();
}

// El selector de tipo con los tipos de esa frecuencia y `tipo` elegido; "Datos al" cambia de forma si entra o sale del ejercicio
function pintarTipo(tipo, meses) {
  document.getElementById('tipo_pedido').innerHTML = htmlDeTiposDePedido(meses, tipo);
  cambiarModoDeDatosAl(tipo);
}

// En un ejercicio "Datos al" se elige solo con el año; si el tipo entra o sale del ejercicio, los selectores se rearman sin
// perder lo elegido (ni "Sin dato")
function cambiarModoDeDatosAl(tipo) {
  const soloAnio = tipo === 'ejercicio';
  if (soloAnio === edicion.soloAnio) return;
  const mes = valorDe('form-datos-mes');
  const anio = valorDe('form-datos-anio');
  pintarDatosAl({ mes, anio, sinDato: edicion.soloAnio ? anio === '' : mes === '', soloAnio });
  mostrarError('form-error-datos', null, { campos: CAMPOS_DE_DATOS_AL });
}

// Los selectores de "Datos al" (selectoresDeDatosAl, en admin-fechas.js). En un ejercicio, la etiqueta apunta al año
function pintarDatosAl({ mes, anio, sinDato, soloAnio }) {
  const selectores = selectoresDeDatosAl({ mes, anio, sinDato, soloAnio, hoy: edicion.hoy });
  const selectorMes = document.getElementById('form-datos-mes');
  const selectorAnio = document.getElementById('form-datos-anio');
  selectorMes.innerHTML = selectores.mes;
  selectorAnio.innerHTML = selectores.anio;
  selectorMes.hidden = selectores.mesOculto;
  selectorAnio.disabled = selectores.anioDeshabilitado;
  selectorAnio.setAttribute('aria-label', soloAnio ? 'Ejercicio' : 'Año');
  document.getElementById('form-l-datos').htmlFor = soloAnio ? 'form-datos-anio' : 'form-datos-mes';
  document.getElementById('form-ayuda-datos').hidden = !soloAnio;
  edicion.soloAnio = soloAnio;
}

// Cambió "Datos al": con "Sin dato" en el mes, el año no cuenta y queda deshabilitado
function alCambiarDatosAlDelFormulario() {
  if (!edicion.soloAnio) document.getElementById('form-datos-anio').disabled = valorDe('form-datos-mes') === '';
  mostrarError('form-error-datos', null, { campos: CAMPOS_DE_DATOS_AL });
  alCambiarElFormularioDelDataset();
}

// Cualquier cambio: el error de un envío anterior ya no corresponde a lo que dice el formulario
function alCambiarElFormularioDelDataset() {
  mostrarError('form-error', null);
  actualizarFormulario();
}

/**
 * Pinta lo que depende de los campos: la sugerencia del tipo, Eventual (tipo fijo y próxima deshabilitada, con el aviso),
 * el aviso en ámbar por las frases de período (no bloquea) y la vista previa.
 */
function actualizarFormulario() {
  const f = formularioDelDataset();
  const eventual = f.meses === null;

  const sugerencia = htmlDeSugerencia(f.tipo_pedido, f.meses === undefined ? null : tipoSugeridoDe(f.tipo_gestion, f.meses));
  if (sugerencia !== edicion.sugerencia) {
    document.getElementById('form-sugerencia').innerHTML = sugerencia;
    edicion.sugerencia = sugerencia;
  }

  document.getElementById('tipo_pedido').disabled = eventual;
  for (const id of CAMPOS_DE_PROXIMA) document.getElementById(id).disabled = eventual;
  const avisoEventual = document.getElementById('form-aviso-eventual');
  avisoEventual.textContent = eventual ? textoDeProximaEventual(edicion.original?.proxima_actualizacion) : '';
  avisoEventual.hidden = !eventual;

  const alerta = avisarFrases(f.tipo_pedido) ? textoDeAvisoDeFrases(frasesDePeriodo(f.que_se_solicita)) : null;
  if (alerta !== edicion.alerta) {
    document.getElementById('form-alerta-texto').textContent = alerta ?? '';
    document.getElementById('form-alerta-frases').hidden = !alerta;
    edicion.alerta = alerta;
  }

  pintarVistaPrevia(f);
}

/**
 * La vista previa "Así va a salir en la próxima nota". El título, la fecha y "Qué se solicita" salen del formulario; los
 * datos solicitados los calcula el servidor (API.calculoPedido), un instante después del último cambio y solo si cambió
 * algo de lo que los define. Sin frecuencia con meses o sin próxima no hay pedido: "—".
 */
function pintarVistaPrevia(f) {
  const cuerpo = cuerpoDelDataset(f);
  const textos = textosDeVistaPrevia({
    titulo: f.titulo, gestion: f.tipo_gestion, proxima: cuerpo.proxima_actualizacion, solicita: f.que_se_solicita
  });
  document.getElementById('form-nota-cab').textContent = textos.cabecera;
  document.getElementById('form-nota-titulo').textContent = textos.titulo;
  document.getElementById('form-nota-fecha').textContent = textos.fecha;
  document.getElementById('form-nota-solicita').textContent = textos.solicita;

  const parametros = { tipo: f.tipo_pedido, meses: f.meses, proxima: cuerpo.proxima_actualizacion, datos_al: cuerpo.datos_al };
  const clave = JSON.stringify(parametros);
  if (clave === edicion.clave) return;
  edicion.clave = clave;
  clearTimeout(edicion.demora);
  const secuencia = ++edicion.secuencia;
  if (!f.tipo_pedido || !Number.isInteger(f.meses) || !cuerpo.proxima_actualizacion) {
    mostrarPedidoDeVistaPrevia(null, null);
    return;
  }
  document.getElementById('form-nota-periodo').setAttribute('aria-busy', 'true');
  edicion.demora = setTimeout(() => pedirVistaPrevia(parametros, secuencia), DEMORA_DE_VISTA_PREVIA);
}

// Le pide al servidor el pedido de la vista previa. Si mientras tanto se pidió otro (o se cerró el formulario), la respuesta
// se descarta. Un error (un 400) se muestra en la vista previa, sin bloquear el envío
async function pedirVistaPrevia(parametros, secuencia) {
  let pedido = null;
  let error = null;
  try {
    const respuesta = await API.calculoPedido(parametros);
    pedido = respuesta?.pedido ?? null;
  } catch (falla) {
    error = textoDeError(falla, 'No se pudo calcular la vista previa. Probá de nuevo.');
  }
  if (secuencia !== edicion.secuencia) return;
  mostrarPedidoDeVistaPrevia(pedido, error);
}

function mostrarPedidoDeVistaPrevia(pedido, error) {
  const periodo = document.getElementById('form-nota-periodo');
  periodo.removeAttribute('aria-busy');
  const texto = pedido && typeof pedido.texto === 'string' && pedido.texto ? pedido.texto : SIN_DATO;
  if (periodo.textContent !== texto) periodo.textContent = texto;
  const lugar = document.getElementById('form-nota-error');
  lugar.textContent = error ?? '';
  lugar.hidden = !error;
}

// El error de los formatos, unido a su grupo (aria-invalid y aria-describedby), como el de "Datos al"
function mostrarErrorDeFormatos(texto) {
  mostrarError('form-error-formatos', texto, { campos: ['chips-container'] });
}

// Los errores de cada campo (problemasDelFormulario), en su lugar y marcando sus campos
function mostrarProblemas({ formatos = null, datosAl = null, proxima = null } = {}) {
  mostrarErrorDeFormatos(formatos);
  mostrarError('form-error-datos', datosAl, { campos: CAMPOS_DE_DATOS_AL });
  mostrarError('form-error-proxima', proxima, { campos: CAMPOS_DE_PROXIMA });
}

function limpiarErroresDelFormulario() {
  mostrarProblemas();
  mostrarError('form-error', null);
  mostrarError('portal-error', null);
}

// El foco va al primer campo con error (en el orden del formulario)
function enfocarElPrimerProblema({ formatos, datosAl, proxima }) {
  let campo = null;
  if (formatos) campo = document.querySelector('#chips-container [data-formato]') ?? document.getElementById('formato-dropdown');
  else if (datosAl) campo = document.getElementById(edicion.soloAnio ? 'form-datos-anio' : 'form-datos-mes');
  else if (proxima) campo = document.getElementById(valorDe('form-prox-mes') ? 'form-prox-anio' : 'form-prox-mes');
  if (campo) campo.focus();
}

/**
 * "Proponer cambios" o "Proponer alta": revisa lo que el formulario exige (formatos, "Datos al", la próxima) y manda el
 * cuerpo armado por cuerpoDelDataset. El botón queda deshabilitado mientras tanto. Los errores, también el de "sin
 * cambios", quedan en la ventana (spec 8.6, arreglos 1 y 6). Si sale bien, avisa, cierra y vuelve a pedir la lista y los
 * pendientes: el dataset pasa a "Cambio pendiente".
 */
async function enviarFormulario(evento) {
  evento.preventDefault();
  if (edicion.enviando) return;
  const f = formularioDelDataset();
  const problemas = problemasDelFormulario(f, edicion.hoy);
  mostrarProblemas(problemas);
  mostrarError('form-error', null);
  if (problemas.formatos || problemas.datosAl || problemas.proxima) {
    enfocarElPrimerProblema(problemas);
    return;
  }

  const { apertura, original } = edicion;
  const boton = document.getElementById('submit-btn');
  edicion.enviando = true;
  boton.disabled = true;
  boton.textContent = 'Proponiendo…';
  let propuesto = false;
  try {
    const cuerpo = cuerpoDelDataset(f);
    if (original) await API.updateDataset(original.id, cuerpo);
    else await API.createDataset(cuerpo);
    propuesto = true;
  } catch (error) {
    const mensaje = mensajeDelEnvio(error);
    // Si el formulario ya se cerró (o es otra apertura), el error va en un aviso
    if (edicion.apertura === apertura && formularioAbierto()) mostrarErrorDelEnvio(mensaje);
    else avisarError(mensaje);
  } finally {
    if (edicion.apertura === apertura) {
      edicion.enviando = false;
      boton.disabled = false;
      boton.textContent = textoDelBotonDeProponer();
    }
  }
  if (propuesto) await despuesDeProponerElDataset(apertura, Boolean(original));
}

// El error del envío, al final del formulario, a la vista
function mostrarErrorDelEnvio(mensaje) {
  mostrarError('form-error', mensaje);
  const lugar = document.getElementById('form-error');
  if (typeof lugar.scrollIntoView === 'function') lugar.scrollIntoView({ block: 'nearest' });
}

/**
 * La propuesta se hizo: avisa y vuelve a pedir la lista (el dataset pasa a "Cambio pendiente"). El formulario se cierra solo
 * si sigue abierta la misma apertura. Si el botón que lo abrió ya no está (la lista se rearmó), el foco va a la lista.
 */
async function despuesDeProponerElDataset(apertura, eraUnaEdicion) {
  avisarExito(eraUnaEdicion
    ? 'Cambios propuestos. Quedan pendientes de aprobación en Mi Perfil.'
    : 'Alta propuesta. Queda pendiente de aprobación en Mi Perfil.');
  const mismaVentana = edicion.apertura === apertura && formularioAbierto();
  const origen = mismaVentana ? origenDe('modal-dataset') : null;
  if (mismaVentana) closeModal();
  try {
    await recargarLista();
  } catch (error) {
    console.error('Error recargando la lista después de proponer:', error);
    avisarError('La propuesta quedó hecha, pero no se pudo recargar la lista. Recargá la página.');
  }
  enfocarLaListaSiSeRearmo(origen);
}

// =====================================================
// ACTUALIZAR DESDE PORTAL (al editar; spec 8.4: el flujo no cambia)
// =====================================================

// Cuenta las aperturas de la confirmación: la respuesta del portal que llega después de cancelarla se descarta
const portal = { apertura: 0 };

function updateFromAndino() {
  const url = valorDe('url_dataset').trim();
  if (!url || !url.includes('datos.comodoro.gov.ar')) {
    mostrarError('portal-error', 'No hay una URL del portal (datos.comodoro.gov.ar) para actualizar');
    return;
  }
  mostrarError('portal-error', null);
  portal.apertura++;
  mostrarError('confirm-update-error', null);
  const boton = document.getElementById('btn-confirm-update');
  boton.disabled = false;
  boton.textContent = 'Actualizar';
  abrirVentana('modal-confirm-update', boton);
}

function closeConfirmUpdateModal() {
  cerrarVentana('modal-confirm-update');
}

// Trae del portal el título y la descripción (los reemplaza) y los formatos (los suma a los elegidos)
async function confirmUpdateFromAndino() {
  const apertura = portal.apertura;
  const boton = document.getElementById('btn-confirm-update');
  if (boton.disabled) return;
  const url = valorDe('url_dataset').trim();
  boton.disabled = true;
  boton.textContent = 'Actualizando…';
  mostrarError('confirm-update-error', null);

  let importado = null;
  let error = null;
  try {
    const response = await fetch(`${CONFIG.API_URL}/andino/fetch?url=${encodeURIComponent(url)}`);
    const result = await response.json();
    if (!response.ok || !result.success) error = result.error || 'No se pudo obtener información del portal';
    else importado = result.data;
  } catch (falla) {
    console.error('Error actualizando desde Andino:', falla);
    error = 'Error de conexión. Probá de nuevo.';
  }
  if (apertura !== portal.apertura || document.getElementById('modal-confirm-update').hidden) return;

  boton.disabled = false;
  boton.textContent = 'Actualizar';
  if (error) {
    mostrarError('confirm-update-error', error);
    return;
  }

  document.getElementById('titulo').value = importado.titulo || '';
  document.getElementById('descripcion').value = importado.descripcion || '';
  // Los formatos del portal se suman a los elegidos (no se saca ninguno)
  if (Array.isArray(importado.formatos) && importado.formatos.length > 0) {
    preseleccionarFormatosPorNombre(importado.formatos);
    renderizarChipsFormatos();
    if (formatosSeleccionados.size > 0) mostrarErrorDeFormatos(null);
  }
  closeConfirmUpdateModal();
  alCambiarElFormularioDelDataset();
  avisarExito('Datos actualizados desde el portal. Recordá proponer los cambios.');
}

// =====================================================
// NUEVA ÁREA (desde el formulario)
// =====================================================

function openQuickAreaModal() {
  const campo = document.getElementById('quick-area-nombre');
  campo.value = '';
  mostrarError('quick-area-error', null, { campos: ['quick-area-nombre'] });
  abrirVentana('modal-quick-area', campo);
}

function closeQuickAreaModal() {
  cerrarVentana('modal-quick-area');
}

async function saveQuickArea(evento) {
  evento?.preventDefault();
  const campo = document.getElementById('quick-area-nombre');
  const btnGuardar = document.getElementById('btn-quick-area-save');
  if (btnGuardar.disabled) return;
  const nombre = campo.value.trim();

  if (!nombre) {
    mostrarError('quick-area-error', 'El nombre del área es obligatorio', { campos: ['quick-area-nombre'] });
    campo.focus();
    return;
  }

  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando…';
  mostrarError('quick-area-error', null, { campos: ['quick-area-nombre'] });

  try {
    const nuevaArea = await API.createArea({ nombre });

    // Agregar al array local y actualizar select
    areas.push(nuevaArea);
    areas.sort((a, b) => a.nombre.localeCompare(b.nombre));
    actualizarSelectAreas();

    // Seleccionar la nueva área
    document.getElementById('area_id').value = nuevaArea.id;

    closeQuickAreaModal();
    avisarExito('Área creada correctamente');
  } catch (error) {
    mostrarError('quick-area-error', textoDeError(error, 'No se pudo crear el área. Probá de nuevo.'), { campos: ['quick-area-nombre'] });
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar';
  }
}

// =====================================================
// MARCAR ACTUALIZADO
// =====================================================

// "Registrar actualización" de un dataset. `origen`: el botón que la abre (al cerrar, el foco vuelve a él)
function marcarActualizado(id, origen = null) {
  // El bloqueo se verifica antes de abrir, no solo con el botón deshabilitado (spec 8.6, arreglo 4)
  if (datasetEstaBloqueado(id)) {
    mostrarMensajeBloqueo();
    return;
  }
  abrirRegistro(id, origen);
}

// =====================================================
// MODAL ELIMINAR
// =====================================================

function openDeleteModal(id, nombre, origen) {
  // Verificar bloqueo por cambios pendientes
  if (datasetEstaBloqueado(id)) {
    mostrarMensajeBloqueo();
    return;
  }

  deleteId = id;
  document.getElementById('delete-dataset-name').textContent = nombre;
  document.getElementById('btn-confirmar-eliminar').disabled = false;
  abrirVentana('modal-delete', document.getElementById('btn-cancelar-eliminar'), origen);
}

function closeDeleteModal() {
  deleteId = null;
  cerrarVentana('modal-delete');
}

async function confirmDelete() {
  const boton = document.getElementById('btn-confirmar-eliminar');
  if (!deleteId || boton.disabled) return;
  const origen = origenDe('modal-delete');
  boton.disabled = true;

  try {
    await API.deleteDataset(deleteId);
    avisarExito('Baja propuesta. Queda pendiente de aprobación en Mi Perfil.');
    closeDeleteModal();
    await recargarLista();
    enfocarLaListaSiSeRearmo(origen);
  } catch (error) {
    avisarError(textoDeError(error, 'No se pudo proponer la eliminación. Probá de nuevo.'));
  } finally {
    boton.disabled = false;
  }
}

// =====================================================
// SISTEMA DE CAMBIOS PENDIENTES (v1.5.0)
// =====================================================

/**
 * Verifica si un dataset está bloqueado por cambios pendientes
 */
function datasetEstaBloqueado(id) {
  return datasetsConPendientes.has(String(id));
}

/**
 * Muestra mensaje de bloqueo
 */
function mostrarMensajeBloqueo() {
  avisarError('Este dataset tiene cambios pendientes de aprobación. No se puede modificar hasta que se resuelvan.');
}

// =====================================================
// REGISTRAR ACTUALIZACIÓN (spec 2026-10-17-fechas-datasets, 8.3 y los arreglos 3 y 5 de 8.6)
// =====================================================
// La ventana pregunta a qué fecha son los datos que llegaron (paso 1), cuándo llegaron y cuándo se cargaron (paso 2) y
// cuál es la próxima (paso 3, salvo en un eventual). Las opciones de la próxima las calcula el servidor con cada cambio
// de "Datos al"; ninguna viene elegida. Lo puro (el cuerpo del POST, los textos, los errores) está en admin-fechas.js.

// Los oyentes de la ventana. Se registran una vez, en DOMContentLoaded
function prepararRegistro() {
  const velo = document.getElementById('modal-registrar-actualizacion');
  velo.addEventListener('mousedown', presionEnVelo);
  velo.addEventListener('click', (evento) => {
    // esClicAfuera va primero: consume la presión anotada aunque el clic haya sido en un botón
    if (esClicAfuera(evento) || evento.target.closest('[data-cerrar-registro]')) cerrarRegistro();
  });
  for (const id of ['registrar-mes', 'registrar-anio']) document.getElementById(id).addEventListener('change', alCambiarDatosAl);
  for (const id of ['registrar-recibido', 'registrar-cargado']) document.getElementById(id).addEventListener('input', alCambiarElFormulario);
  document.getElementById('registrar-opciones').addEventListener('change', alElegirOpcion);
  for (const id of ['registrar-otra-mes', 'registrar-otra-anio']) document.getElementById(id).addEventListener('change', alCambiarElFormulario);
  document.getElementById('registrar-proponer').addEventListener('click', proponerActualizacion);
}

function registroAbierto() {
  return !document.getElementById('modal-registrar-actualizacion').hidden;
}

/**
 * Abre la ventana para el dataset `id` (el de la lista, que ya trae el pedido, las fechas y el tipo). Arranca con "Datos
 * al" en lo que se pidió (defectoDeDatosAl), "Cargado en el portal el" en hoy, "Recibido el" vacío y ninguna próxima
 * elegida, y le pide las opciones al servidor. El foco va al mes del paso 1 (en un ejercicio, al año).
 */
function abrirRegistro(id, origen) {
  const dataset = datasets.find((d) => String(d.id) === String(id));
  if (!dataset) {
    avisarError('No se encontró el dataset. Recargá la página para intentar de nuevo.');
    return;
  }
  const hoy = hoyEnArgentina();
  const anioDeHoy = Number(hoy.slice(0, 4));
  Object.assign(registro, {
    dataset, hoy, opciones: [], errorDatosAl: null, cargando: false, enviando: false,
    origen: origen ?? document.activeElement, apertura: registro.apertura + 1
  });

  // Cabecera "Datos solicitados" y línea del ciclo (sin un período con desde y hasta no hay línea: queda el texto)
  document.getElementById('registrar-dataset').textContent = dataset.titulo ?? '';
  document.getElementById('registrar-periodo').textContent = textoDelPedidoActual(dataset);
  document.getElementById('registrar-datos').innerHTML = htmlDeDatosDelPedido(dataset, hoy);
  const conCiclo = Boolean(soloFecha(dataset.pedido?.desde) && soloFecha(dataset.pedido?.hasta));
  const ciclo = document.getElementById('registrar-ciclo');
  ciclo.innerHTML = '';
  ciclo.hidden = !conCiclo;
  document.getElementById('registrar-leyenda').hidden = !conCiclo;

  // Paso 1: "Datos al", con mes y año (en un ejercicio, solo el año)
  const { pregunta, ayuda, soloAnio } = textosDelPaso1(dataset.tipo_pedido);
  document.getElementById('registrar-p1').textContent = pregunta;
  document.getElementById('registrar-ayuda1').textContent = ayuda;
  const defecto = defectoDeDatosAl(dataset, hoy);
  const mes = document.getElementById('registrar-mes');
  const anio = document.getElementById('registrar-anio');
  mes.innerHTML = opcionesDeMes(Number(defecto.slice(5, 7)));
  mes.hidden = soloAnio;
  anio.innerHTML = opcionesDeAnio(PRIMER_ANIO_DE_DATOS_AL, anioDeHoy + 1, Number(defecto.slice(0, 4)));

  // Paso 2: ninguna de las dos fechas puede ser posterior a hoy
  const recibido = document.getElementById('registrar-recibido');
  const cargado = document.getElementById('registrar-cargado');
  recibido.value = '';
  cargado.value = hoy;
  recibido.max = hoy;
  cargado.max = hoy;

  // Paso 3: un eventual no elige próxima. "Otra fecha" arranca sin mes ni año: hay que elegirlos
  document.getElementById('registrar-paso3').hidden = esEventual(dataset);
  document.getElementById('registrar-opciones').innerHTML = '';
  document.getElementById('registrar-otra-mes').innerHTML = '<option value="">Mes</option>' + opcionesDeMes(null);
  document.getElementById('registrar-otra-anio').innerHTML = '<option value="">Año</option>' + opcionesDeAnio(anioDeHoy - 1, anioDeHoy + 10, null);

  mostrarError('registrar-error', null);
  document.getElementById('registrar-proponer').textContent = 'Proponer actualización';
  // En la pila de ventanas solo para el teclado: el foco al cerrar lo maneja cerrarRegistro
  apilarVentana(ID_REGISTRO, null);
  document.getElementById('modal-registrar-actualizacion').hidden = false;
  (soloAnio ? anio : mes).focus();
  alCambiarDatosAl();
}

// Cierra la ventana y devuelve el foco al botón que la abrió. Una respuesta de opciones que llegue después se descarta
function cerrarRegistro() {
  if (!registroAbierto()) return;
  document.getElementById('modal-registrar-actualizacion').hidden = true;
  desapilarVentana(ID_REGISTRO);
  registro.secuencia++;
  const { origen, dataset } = registro;
  Object.assign(registro, { dataset: null, opciones: [], errorDatosAl: null, cargando: false, origen: null });
  enfocarDespuesDeCerrar(origen, dataset?.id);
}

/**
 * El foco al cerrar: el botón que abrió la ventana. Si la lista se rearmó mientras tanto (por ejemplo, porque se recargó
 * después de otra propuesta), ese botón ya no está: va al "Registrar actualización" de ese dataset, si se ve y está
 * habilitado, o a la lista.
 */
function enfocarDespuesDeCerrar(origen, id) {
  if (!origen) return;
  if (origen.isConnected) {
    origen.focus();
    return;
  }
  const reemplazo = [...document.querySelectorAll('#lista-datasets [data-registrar]')]
    .find((boton) => boton.dataset.registrar === String(id) && !boton.disabled && boton.getClientRects().length > 0);
  (reemplazo ?? document.getElementById('lista-datasets')).focus();
}

// Los campos de cada paso, que se marcan con su error (aria-invalid y aria-describedby)
const CAMPOS_DEL_PASO1 = ['registrar-mes', 'registrar-anio'];
const CAMPOS_DEL_PASO2 = ['registrar-recibido', 'registrar-cargado'];

/**
 * Un error en su lugar de la ventana (texto, nunca HTML), o ninguno con null. El mismo texto no se vuelve a escribir: el
 * lugar es role="alert" y el lector de pantalla lo anunciaría otra vez. `campos`: los campos que puede marcar el error;
 * `invalidos`: a cuáles se refiere (por defecto, a todos). Esos llevan aria-invalid y aria-describedby con el id del error;
 * los demás, y todos cuando no hay error, quedan sin marca.
 */
function mostrarError(id, texto, { campos = [], invalidos = campos } = {}) {
  const lugar = document.getElementById(id);
  const nuevo = texto ?? '';
  if (lugar.textContent !== nuevo) lugar.textContent = nuevo;
  lugar.hidden = !nuevo;
  for (const idDelCampo of campos) {
    const campo = document.getElementById(idDelCampo);
    const conError = Boolean(nuevo) && invalidos.includes(idDelCampo);
    const descripcion = describedbyCon(campo.getAttribute('aria-describedby'), id, conError);
    if (descripcion) campo.setAttribute('aria-describedby', descripcion);
    else campo.removeAttribute('aria-describedby');
    if (conError) campo.setAttribute('aria-invalid', 'true');
    else campo.removeAttribute('aria-invalid');
  }
}

// El valor de aria-describedby con el id de un error sumado (conError) o sacado, sin tocar los demás ids. null si no queda ninguno
function describedbyCon(actual, idDelError, conError) {
  const ids = String(actual ?? '').split(/\s+/).filter((id) => id && id !== idDelError);
  if (conError) ids.push(idDelError);
  return ids.length ? ids.join(' ') : null;
}

// Lo que dicen los campos de la ventana, como lo recibe cuerpoDelRegistro. Un radio deshabilitado (mientras llegan las
// opciones nuevas) no cuenta como elegido
function formularioDelRegistro() {
  const elegido = document.querySelector('#registrar-opciones input[name="proxima"]:checked:not(:disabled)');
  return {
    tipo: registro.dataset?.tipo_pedido,
    eventual: esEventual(registro.dataset),
    mes: valorDe('registrar-mes'),
    anio: valorDe('registrar-anio'),
    recibido: valorDe('registrar-recibido'),
    cargado: valorDe('registrar-cargado'),
    opcion: elegido ? elegido.value : null,
    opciones: registro.opciones,
    otraMes: valorDe('registrar-otra-mes'),
    otraAnio: valorDe('registrar-otra-anio')
  };
}

function valorDe(id) {
  return document.getElementById(id).value;
}

/**
 * Cambió "Datos al" (y al abrir): la elección del paso 3 se borra, el error del paso 1 se revisa acá con las palabras del
 * servidor (si pasa del tope no se le pide nada) y, si no hay error, se le piden las opciones al servidor. Con error, la
 * línea del ciclo no muestra lo que llega, así la escala no salta.
 */
function alCambiarDatosAl() {
  const { dataset, hoy } = registro;
  if (!dataset) return;
  const datosAl = datosAlDelPaso1({ tipo: dataset.tipo_pedido, mes: valorDe('registrar-mes'), anio: valorDe('registrar-anio') });
  registro.opciones = [];
  registro.errorDatosAl = errorDeDatosAl(datosAl, dataset.tipo_pedido, hoy);
  mostrarError('registrar-error-datos', registro.errorDatosAl, { campos: CAMPOS_DEL_PASO1 });
  // El error de un envío anterior ya no corresponde a lo que dice la ventana
  mostrarError('registrar-error', null);
  borrarEleccion();
  pintarCicloDelRegistro(registro.errorDatosAl ? null : datosAl);
  if (registro.errorDatosAl) {
    registro.secuencia++; // la respuesta de un pedido anterior ya no sirve
    registro.cargando = false;
    pintarOpciones();
    revisarRegistro();
    return;
  }
  pedirOpciones(datosAl);
}

// Ninguna próxima elegida: los radios sin marcar y "Otra fecha" cerrada y vacía
function borrarEleccion() {
  for (const radio of document.querySelectorAll('#registrar-opciones input[name="proxima"]')) radio.checked = false;
  for (const tarjeta of document.querySelectorAll('#registrar-opciones .ad-opcion')) tarjeta.classList.remove('elegida');
  document.getElementById('registrar-otra').hidden = true;
  document.getElementById('registrar-otra-mes').value = '';
  document.getElementById('registrar-otra-anio').value = '';
}

/**
 * Le pide al servidor las opciones de la próxima para este "Datos al". Mientras tanto, el paso 3 no salta: quedan las
 * tarjetas de antes, apagadas y sin elegir (o un aviso, si no había). Si el servidor contesta con un error (un 400 de
 * "Datos al"), el mensaje va tal cual debajo del paso 1 y no hay opciones. Si ya se pidió otra cosa, la respuesta se descarta.
 */
async function pedirOpciones(datosAl) {
  const secuencia = ++registro.secuencia;
  const { dataset } = registro;
  registro.cargando = true;
  const caja = document.getElementById('registrar-opciones');
  caja.setAttribute('aria-busy', 'true');
  const radios = caja.querySelectorAll('input[name="proxima"]');
  if (radios.length) radios.forEach((radio) => { radio.disabled = true; });
  else if (!esEventual(dataset)) caja.innerHTML = '<p class="ad-ayuda">Calculando las opciones…</p>';
  revisarRegistro();

  let opciones = [];
  let error = null;
  try {
    const respuesta = await API.opcionesDeProxima(dataset.id, datosAl);
    opciones = Array.isArray(respuesta?.opciones) ? respuesta.opciones : [];
  } catch (falla) {
    error = textoDeError(falla, 'No se pudieron calcular las opciones de la próxima actualización. Probá de nuevo.');
  }
  if (secuencia !== registro.secuencia) return;

  registro.cargando = false;
  registro.opciones = error ? [] : opciones;
  registro.errorDatosAl = error;
  mostrarError('registrar-error-datos', error, { campos: CAMPOS_DEL_PASO1 });
  if (error) pintarCicloDelRegistro(null);
  pintarOpciones();
  revisarRegistro();
}

// Las tarjetas del paso 3 (ninguna elegida) más "Otra fecha". Sin opciones si hay un error en "Datos al" o es eventual
function pintarOpciones() {
  const caja = document.getElementById('registrar-opciones');
  caja.removeAttribute('aria-busy');
  caja.innerHTML = registro.errorDatosAl || esEventual(registro.dataset) ? '' : htmlDeOpciones(registro.opciones);
}

// Se eligió una próxima: se marca su tarjeta y, si es "Otra fecha", se abren el mes y el año
function alElegirOpcion(evento) {
  const radio = evento.target.closest('input[name="proxima"]');
  if (!radio) return;
  for (const tarjeta of document.querySelectorAll('#registrar-opciones .ad-opcion')) {
    tarjeta.classList.toggle('elegida', tarjeta.contains(radio) && radio.checked);
  }
  document.getElementById('registrar-otra').hidden = radio.value !== 'otra';
  mostrarError('registrar-error', null);
  revisarRegistro();
}

// La persona cambió las fechas del paso 2 o la "Otra fecha": el error de un envío anterior ya no corresponde
function alCambiarElFormulario() {
  mostrarError('registrar-error', null);
  revisarRegistro();
}

/**
 * Muestra el error del paso 2 (con las palabras del servidor) y habilita "Proponer actualización" solo con una próxima
 * elegida, sin errores, sin opciones por llegar y sin un envío en curso (revisionDelRegistro, en admin-fechas.js).
 */
function revisarRegistro() {
  if (!registro.dataset) return;
  const { errorFechas, campoFechas, puedeProponer: sePuede } = revisionDelRegistro({
    formulario: formularioDelRegistro(), errorDatosAl: registro.errorDatosAl, cargando: registro.cargando,
    enviando: registro.enviando, hoy: registro.hoy
  });
  mostrarError('registrar-error-fechas', errorFechas, {
    campos: CAMPOS_DEL_PASO2, invalidos: campoFechas ? [`registrar-${campoFechas}`] : []
  });
  document.getElementById('registrar-proponer').disabled = !sePuede;
}

/**
 * La línea del ciclo con lo que llega (`datosNuevo`, o null). La banda verde se mueve desde donde estaba: el HTML nuevo la
 * crea con su ancho final, así que arranca con el anterior y pasa al nuevo en el cuadro siguiente (la transición está en el
 * CSS, que la apaga si se pide menos movimiento).
 */
function pintarCicloDelRegistro(datosNuevo) {
  const { dataset, hoy } = registro;
  const caja = document.getElementById('registrar-ciclo');
  if (!dataset || caja.hidden) return;
  const anterior = caja.querySelector('.banda.llega')?.style.width || '0%';
  caja.innerHTML = htmlDeCiclo({
    datosAl: dataset.datos_al, desde: dataset.pedido?.desde, hasta: dataset.pedido?.hasta,
    proxima: dataset.proxima_actualizacion, hoy, datosNuevo
  });
  separarRotulosDeArriba(caja);
  const llega = caja.querySelector('.banda.llega');
  if (!llega) return;
  const destino = llega.style.width;
  llega.style.width = anterior;
  void llega.offsetWidth; // el navegador toma el ancho anterior antes del cambio
  llega.style.width = destino;
}

// "Envío sugerido" y "Hoy" van arriba de la línea: si quedan tan cerca que se pisan (pasa cuando la próxima está a uno o dos
// meses, o en una ventana angosta), "Hoy" sube un renglón
function separarRotulosDeArriba(caja) {
  caja.classList.remove('con-alto');
  const hoy = caja.querySelector('.etiqueta.hoy');
  const envio = caja.querySelector('.etiqueta.arriba');
  if (!hoy || !envio) return;
  const a = hoy.getBoundingClientRect();
  const b = envio.getBoundingClientRect();
  if (a.width === 0 || b.width === 0) return; // la línea no se ve (pantalla angosta)
  if (a.left < b.right + 4 && b.left < a.right + 4) {
    hoy.classList.add('alto');
    caja.classList.add('con-alto');
  }
}

/**
 * Manda la propuesta (POST /datasets/:id/actualizar). El botón queda deshabilitado mientras tanto: un doble clic no manda
 * dos. Si sale bien, avisa, cierra y vuelve a pedir la lista y los pendientes (la fila pasa a "Cambio pendiente"); si no,
 * el error del servidor queda en la ventana y el botón se vuelve a habilitar.
 */
async function proponerActualizacion() {
  const boton = document.getElementById('registrar-proponer');
  const { dataset, apertura } = registro;
  if (!dataset || registro.enviando || boton.disabled) return;
  registro.enviando = true;
  boton.textContent = 'Proponiendo…';
  mostrarError('registrar-error', null);
  revisarRegistro();
  let propuesta = false;
  try {
    await API.registrarActualizacion(dataset.id, cuerpoDelRegistro(formularioDelRegistro()));
    propuesta = true;
  } catch (error) {
    const mensaje = textoDeError(error, 'No se pudo proponer la actualización. Probá de nuevo.');
    // Si la ventana ya se cerró (o es otra apertura), el error va en un aviso
    if (registro.apertura === apertura && registro.dataset) mostrarError('registrar-error', mensaje);
    else avisarError(mensaje);
  } finally {
    if (registro.apertura === apertura) {
      registro.enviando = false;
      boton.textContent = 'Proponer actualización';
      revisarRegistro();
    }
  }
  if (propuesta) await despuesDeProponer(apertura);
}

/**
 * La propuesta se hizo: siempre avisa y vuelve a pedir la lista (la fila pasa a "Cambio pendiente"). La ventana se cierra y
 * el foco se mueve solo si sigue abierta la misma apertura: si mientras se enviaba la persona la cerró y abrió otra, esa
 * otra no se toca. Si falla la recarga, se avisa aparte: la propuesta ya está hecha.
 */
async function despuesDeProponer(apertura) {
  avisarExito('Actualización propuesta. Queda pendiente de aprobación en Mi Perfil.');
  const mismaVentana = registro.apertura === apertura && registroAbierto();
  const origen = mismaVentana ? registro.origen : null;
  if (mismaVentana) cerrarRegistro();
  try {
    await recargarLista();
  } catch (error) {
    console.error('Error recargando la lista después de proponer:', error);
    avisarError('La actualización quedó propuesta, pero no se pudo recargar la lista. Recargá la página.');
  }
  // La lista se rearmó: el botón que abrió la ventana ya no está, y el de la fila nueva está deshabilitado porque el
  // dataset quedó bloqueado. El foco va a la lista, salvo que mientras tanto se haya abierto otra ventana
  if (mismaVentana && origen && !origen.isConnected && !hayUnaVentanaAbierta()) {
    document.getElementById('lista-datasets').focus();
  }
}

// El teclado con una ventana abierta (la de más arriba): Escape la cierra y Tab no sale de ella
function teclaEnPagina(evento) {
  const id = ventanaDeArriba();
  if (!id) return;
  if (evento.key === 'Escape') {
    evento.preventDefault();
    salirDeVentana(id, 'escape');
  } else if (evento.key === 'Tab') {
    retenerFoco(evento, document.querySelector(`#${id} .ad-ventana`));
  }
}

// Mantiene el foco dentro de la ventana. Entre sus controles Tab se deja (el navegador sabe moverse, también entre los
// radios); solo se interviene en los bordes (Shift+Tab en el primero, Tab en el último) y si el foco quedó afuera
function retenerFoco(evento, ventana) {
  if (!ventana) return;
  const enfocables = [...ventana.querySelectorAll('button, select, input, textarea, a[href], [tabindex]:not([tabindex="-1"])')]
    .filter((elemento) => !elemento.disabled && elemento.getClientRects().length > 0);
  if (enfocables.length === 0) return;
  const primero = enfocables[0];
  const ultimo = enfocables[enfocables.length - 1];
  const enfocado = document.activeElement;
  if (!ventana.contains(enfocado)) (evento.shiftKey ? ultimo : primero).focus();
  else if (evento.shiftKey && enfocado === primero) ultimo.focus();
  else if (!evento.shiftKey && enfocado === ultimo) primero.focus();
  else return;
  evento.preventDefault();
}

// El velo donde empezó la última presión del mouse, o null si empezó en otro lado (como en correos.js). Si se aprieta adentro
// de la ventana y se suelta sobre el velo (por ejemplo, al elegir texto), el navegador manda el clic al velo: no es un clic afuera
let veloPresionado = null;

// mousedown del velo: anota si la presión empezó en el propio velo
function presionEnVelo(evento) {
  veloPresionado = evento.target === evento.currentTarget ? evento.currentTarget : null;
}

// ¿Es un clic afuera de verdad? Solo si la presión empezó en este velo, el clic cae en el propio velo y no es el segundo clic
// de un doble clic. Consume la presión anotada: cada presión vale para un solo clic
function esClicAfuera(evento) {
  const empezoEnElVelo = veloPresionado !== null && veloPresionado === evento.currentTarget;
  veloPresionado = null;
  return empezoEnElVelo && evento.target === evento.currentTarget && !(evento.detail > 1);
}
