/**
 * Admin - Gestión de Datasets - RPAD
 *
 * La lista (spec 2026-10-17-fechas-datasets, 8.2): filtros por estado con su contador, búsqueda por título o área,
 * gestión y tipo de pedido, 25 por página, y en el celular una tarjeta por dataset. Además, el alta en dos pasos con la
 * importación desde el Portal de Datos Abiertos, la edición, la eliminación y el registro de una actualización: todo cambio
 * queda pendiente de aprobación (doble verificación) y el dataset queda bloqueado hasta que se resuelva.
 *
 * Al cargarse solo declara (tests/admin-frontend.test.js lo carga en un vm): lo que toca el DOM, Auth o la API arranca en
 * DOMContentLoaded. Lo puro que arma la fila, la tarjeta y la pastilla de estado está en admin-fechas.js, que se carga antes;
 * lo puro de la lista (filtros, contadores, páginas) está acá, arriba de lo que toca el DOM.
 */

let datasets = [];
let temas = [];
let frecuencias = [];
let areas = [];
let deleteId = null;
let currentEditDataset = null;
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
// Los años del paso 1 empiezan acá (el selector se amplía si "Datos al" es anterior)
const PRIMER_ANIO_DE_DATOS = 2015;

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
// INICIO
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Verificar autenticación
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  puedeAdministrar = Auth.isAdmin();
  document.getElementById('dataset-form').addEventListener('submit', enviarFormulario);
  prepararLista();
  prepararRegistro();
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
  else if (editar !== undefined) editDataset(Number(editar));
  else if (eliminar !== undefined) openDeleteModal(Number(eliminar), tituloDelDataset(eliminar));
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
// SISTEMA DE CHIPS PARA FORMATOS
// =====================================================

/**
 * Renderiza los chips de formatos habituales y el dropdown de no habituales
 */
function renderizarChipsFormatos() {
  const container = document.getElementById('chips-container');
  const dropdown = document.getElementById('formato-dropdown');

  if (!container || !dropdown) return;

  // Separar habituales y no habituales
  const habituales = formatosCatalogo.filter(f => f.habitual === 1);
  const noHabituales = formatosCatalogo.filter(f => f.habitual === 0);

  // Renderizar chips habituales
  container.innerHTML = habituales.map(f => {
    const selected = formatosSeleccionados.has(f.id);
    return `
      <span class="chip ${selected ? 'selected' : ''}"
            data-id="${f.id}"
            data-habitual="1"
            onclick="toggleChip(${f.id})">
        <span class="check-icon">✓</span>
        ${Utils.escapeHtml(f.nombre)}
      </span>
    `;
  }).join('');

  // Agregar chips de formatos no habituales seleccionados
  noHabituales.forEach(f => {
    if (formatosSeleccionados.has(f.id)) {
      container.innerHTML += `
        <span class="chip selected"
              data-id="${f.id}"
              data-habitual="0">
          <span class="check-icon">✓</span>
          ${Utils.escapeHtml(f.nombre)}
          <span class="chip-remove" onclick="removeNoHabitual(${f.id}, event)">×</span>
        </span>
      `;
    }
  });

  // Llenar dropdown con formatos no habituales no seleccionados
  dropdown.innerHTML = '<option value="">+ Agregar otro formato...</option>';
  noHabituales.forEach(f => {
    if (!formatosSeleccionados.has(f.id)) {
      dropdown.innerHTML += `<option value="${f.id}">${Utils.escapeHtml(f.nombre)}</option>`;
    }
  });

  // Event listener para dropdown (solo agregar una vez)
  dropdown.onchange = function() {
    if (this.value) {
      formatosSeleccionados.add(parseInt(this.value));
      renderizarChipsFormatos();
      this.value = '';
    }
  };

  // Actualizar estado visual del contenedor
  actualizarEstadoContenedorFormatos();
}

/**
 * Toggle para chips habituales
 */
function toggleChip(id) {
  if (formatosSeleccionados.has(id)) {
    formatosSeleccionados.delete(id);
  } else {
    formatosSeleccionados.add(id);
  }
  renderizarChipsFormatos();
}

/**
 * Remover chip no habitual
 */
function removeNoHabitual(id, event) {
  event.stopPropagation();
  formatosSeleccionados.delete(id);
  renderizarChipsFormatos();
}

/**
 * Actualiza el borde del contenedor según si hay formatos seleccionados
 */
function actualizarEstadoContenedorFormatos() {
  const container = document.getElementById('chips-container');
  if (formatosSeleccionados.size === 0) {
    container.classList.add('error');
  } else {
    container.classList.remove('error');
  }
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
      formatosSeleccionados.add(formato.id);
    }
  });
}

// =====================================================
// PASO 1: Modal URL del Portal
// =====================================================

function openStep1Modal() {
  currentEditDataset = null;
  andinoAreaReferencia = null;
  document.getElementById('andino-url').value = '';
  document.getElementById('step1-error').classList.add('hidden');
  document.getElementById('step1-loading').classList.add('hidden');
  document.getElementById('btn-siguiente').disabled = false;
  document.getElementById('modal-step1').classList.add('active');

  // Focus en el campo URL
  setTimeout(() => document.getElementById('andino-url').focus(), 100);
}

function closeStep1Modal() {
  document.getElementById('modal-step1').classList.remove('active');
}

// Saltar al paso 2 sin importar (carga manual)
function skipToManualEntry() {
  andinoAreaReferencia = null;
  closeStep1Modal();
  openModal(null);
}

// Consultar API y continuar al paso 2
async function fetchAndContinue() {
  const url = document.getElementById('andino-url').value.trim();
  const errorDiv = document.getElementById('step1-error');
  const loadingDiv = document.getElementById('step1-loading');
  const btnSiguiente = document.getElementById('btn-siguiente');

  // Validar que hay URL
  if (!url) {
    errorDiv.textContent = 'Por favor, ingrese la URL del dataset';
    errorDiv.classList.remove('hidden');
    return;
  }

  // Mostrar loading
  errorDiv.classList.add('hidden');
  loadingDiv.classList.remove('hidden');
  btnSiguiente.disabled = true;

  try {
    const response = await fetch(`${CONFIG.API_URL}/andino/fetch?url=${encodeURIComponent(url)}`);
    const result = await response.json();

    loadingDiv.classList.add('hidden');
    btnSiguiente.disabled = false;

    if (!response.ok || !result.success) {
      // Mostrar error y permitir continuar manualmente
      errorDiv.innerHTML = `
        <strong>⚠️ Error de importación</strong><br>
        ${Utils.escapeHtml(result.error || 'No se pudo obtener información del portal')}<br>
        <span class="ad-chico">Puede continuar con la carga manual haciendo clic en "Carga manual".</span>
      `;
      errorDiv.classList.remove('hidden');
      return;
    }

    // Guardar área de referencia de Andino
    andinoAreaReferencia = result.data.area_responsable_texto || null;

    // Éxito: cerrar paso 1 y abrir paso 2 con datos pre-llenados
    closeStep1Modal();
    openModal(null, result.data);

  } catch (error) {
    console.error('Error consultando Andino:', error);
    loadingDiv.classList.add('hidden');
    btnSiguiente.disabled = false;
    errorDiv.innerHTML = `
      <strong>⚠️ Error de conexión</strong><br>
      No se pudo conectar con el servidor. Puede continuar con la carga manual.
    `;
    errorDiv.classList.remove('hidden');
  }
}

// =====================================================
// PASO 2: Modal Formulario Completo
// =====================================================

/**
 * Abre el modal del formulario
 * @param {Object|null} dataset - Dataset existente para editar, o null para nuevo
 * @param {Object|null} andinoData - Datos importados de Andino para pre-llenar
 */
function openModal(dataset = null, andinoData = null) {
  const modal = document.getElementById('modal-dataset');
  const form = document.getElementById('dataset-form');
  const title = document.getElementById('modal-title');
  const andinoUpdateSection = document.getElementById('andino-update-section');
  const andinoRefSection = document.getElementById('andino-area-referencia');

  form.reset();
  document.getElementById('dataset-id').value = '';
  currentEditDataset = null;

  // El aviso de "no realizaste ningún cambio" es del intento anterior: se limpia al abrir (spec 8.6, arreglo 6)
  const avisoSinCambios = document.getElementById('modal-form-error');
  if (avisoSinCambios) avisoSinCambios.style.display = 'none';

  // Resetear formatos seleccionados
  formatosSeleccionados.clear();

  // Ocultar sección de referencia de Andino por defecto
  andinoRefSection.classList.add('hidden');

  if (dataset) {
    // MODO EDICIÓN
    title.textContent = 'Editar Dataset';
    currentEditDataset = dataset;
    document.getElementById('dataset-id').value = dataset.id;
    document.getElementById('titulo').value = dataset.titulo || '';
    document.getElementById('area_id').value = dataset.area_id || '';
    document.getElementById('descripcion').value = dataset.descripcion || '';
    document.getElementById('tema_principal_id').value = dataset.tema_principal_id || '';
    document.getElementById('tema_secundario_id').value = dataset.tema_secundario_id || '';
    document.getElementById('frecuencia_id').value = dataset.frecuencia_id || '';
    document.getElementById('ultima_actualizacion').value = dataset.ultima_actualizacion ? dataset.ultima_actualizacion.split('T')[0] : '';
    document.getElementById('proxima_actualizacion').value = dataset.proxima_actualizacion ? dataset.proxima_actualizacion.split('T')[0] : '';
    document.getElementById('url_dataset').value = dataset.url_dataset || '';
    document.getElementById('observaciones').value = dataset.observaciones || '';
    document.getElementById('que_se_solicita').value = dataset.que_se_solicita || '';
    document.getElementById('tipo_gestion').value = dataset.tipo_gestion || '';

    // Cargar formatos existentes
    if (dataset.formatos_array && Array.isArray(dataset.formatos_array)) {
      dataset.formatos_array.forEach(f => formatosSeleccionados.add(f.id));
    }

    // Mostrar botón de actualizar desde portal si tiene URL
    if (dataset.url_dataset && dataset.url_dataset.includes('datos.comodoro.gov.ar')) {
      andinoUpdateSection.classList.remove('hidden');
    } else {
      andinoUpdateSection.classList.add('hidden');
    }
  } else {
    // MODO NUEVO
    title.textContent = 'Nuevo Dataset - Paso 2';
    andinoUpdateSection.classList.add('hidden');

    // Si hay datos de Andino, pre-llenar
    if (andinoData) {
      document.getElementById('titulo').value = andinoData.titulo || '';
      document.getElementById('descripcion').value = andinoData.descripcion || '';
      document.getElementById('url_dataset').value = andinoData.url_dataset || '';

      // Pre-seleccionar formatos importados de Andino
      if (andinoData.formatos && Array.isArray(andinoData.formatos)) {
        preseleccionarFormatosPorNombre(andinoData.formatos);
      }

      // Mostrar área de referencia de Andino
      if (andinoAreaReferencia) {
        document.getElementById('andino-area-texto').textContent = andinoAreaReferencia;
        andinoRefSection.classList.remove('hidden');
      }
    }
  }

  // Renderizar chips de formatos
  renderizarChipsFormatos();

  modal.classList.add('active');
}

function closeModal() {
  document.getElementById('modal-dataset').classList.remove('active');
  currentEditDataset = null;
  andinoAreaReferencia = null;
}

async function editDataset(id) {
  // Verificar bloqueo por cambios pendientes
  if (datasetEstaBloqueado(id)) {
    mostrarMensajeBloqueo();
    return;
  }

  try {
    const dataset = await API.getDataset(id);
    if (dataset) {
      openModal(dataset);
    }
  } catch (error) {
    console.error('Error cargando dataset:', error);
    avisarError('Error al cargar el dataset');
  }
}

// =====================================================
// ACTUALIZAR DESDE PORTAL (en modo edición)
// =====================================================

function updateFromAndino() {
  // Verificar que hay URL del dataset
  const url = document.getElementById('url_dataset').value.trim();
  if (!url || !url.includes('datos.comodoro.gov.ar')) {
    avisarError('No hay una URL válida del portal para actualizar');
    return;
  }

  // Abrir modal de confirmación
  document.getElementById('confirm-update-error').classList.add('hidden');
  document.getElementById('confirm-update-loading').classList.add('hidden');
  document.getElementById('btn-confirm-update').disabled = false;
  document.getElementById('modal-confirm-update').classList.add('active');
}

function closeConfirmUpdateModal() {
  document.getElementById('modal-confirm-update').classList.remove('active');
}

async function confirmUpdateFromAndino() {
  const url = document.getElementById('url_dataset').value.trim();
  const errorDiv = document.getElementById('confirm-update-error');
  const loadingDiv = document.getElementById('confirm-update-loading');
  const btnConfirm = document.getElementById('btn-confirm-update');

  loadingDiv.classList.remove('hidden');
  errorDiv.classList.add('hidden');
  btnConfirm.disabled = true;

  try {
    const response = await fetch(`${CONFIG.API_URL}/andino/fetch?url=${encodeURIComponent(url)}`);
    const result = await response.json();

    loadingDiv.classList.add('hidden');

    if (!response.ok || !result.success) {
      errorDiv.textContent = result.error || 'No se pudo obtener información del portal';
      errorDiv.classList.remove('hidden');
      btnConfirm.disabled = false;
      return;
    }

    // Actualizar título y descripción
    document.getElementById('titulo').value = result.data.titulo || '';
    document.getElementById('descripcion').value = result.data.descripcion || '';

    // Actualizar formatos si vienen del portal
    if (result.data.formatos && Array.isArray(result.data.formatos) && result.data.formatos.length > 0) {
      // Agregar los formatos importados (sin eliminar los existentes)
      preseleccionarFormatosPorNombre(result.data.formatos);
      renderizarChipsFormatos();
    }

    // Cerrar modal de confirmación
    closeConfirmUpdateModal();

    avisarExito('Datos actualizados desde el portal. Recordá guardar los cambios.');

  } catch (error) {
    console.error('Error actualizando desde Andino:', error);
    loadingDiv.classList.add('hidden');
    btnConfirm.disabled = false;
    errorDiv.textContent = 'Error de conexión. Intente nuevamente.';
    errorDiv.classList.remove('hidden');
  }
}

// =====================================================
// MODAL CREAR ÁREA RÁPIDA
// =====================================================

function openQuickAreaModal() {
  document.getElementById('quick-area-nombre').value = '';
  document.getElementById('quick-area-error').classList.add('hidden');
  document.getElementById('modal-quick-area').classList.add('active');
  setTimeout(() => document.getElementById('quick-area-nombre').focus(), 100);
}

function closeQuickAreaModal() {
  document.getElementById('modal-quick-area').classList.remove('active');
}

async function saveQuickArea() {
  const nombre = document.getElementById('quick-area-nombre').value.trim();
  const errorDiv = document.getElementById('quick-area-error');
  const btnGuardar = document.getElementById('btn-quick-area-save');

  if (!nombre) {
    errorDiv.textContent = 'El nombre del área es obligatorio';
    errorDiv.classList.remove('hidden');
    return;
  }

  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando...';
  errorDiv.classList.add('hidden');

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
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('hidden');
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar';
  }
}

// =====================================================
// SUBMIT FORMULARIO (se registra en DOMContentLoaded)
// =====================================================

async function enviarFormulario(e) {
  e.preventDefault();

  // Validar que hay al menos un formato seleccionado
  if (formatosSeleccionados.size === 0) {
    avisarError('Debe seleccionar al menos un formato');
    actualizarEstadoContenedorFormatos();
    return;
  }

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Guardando...';

  const id = document.getElementById('dataset-id').value;
  const data = {
    titulo: document.getElementById('titulo').value,
    area_id: parseInt(document.getElementById('area_id').value),
    descripcion: document.getElementById('descripcion').value,
    tema_principal_id: parseInt(document.getElementById('tema_principal_id').value),
    tema_secundario_id: document.getElementById('tema_secundario_id').value ? parseInt(document.getElementById('tema_secundario_id').value) : null,
    frecuencia_id: parseInt(document.getElementById('frecuencia_id').value),
    formatos: Array.from(formatosSeleccionados),
    ultima_actualizacion: document.getElementById('ultima_actualizacion').value || null,
    proxima_actualizacion: document.getElementById('proxima_actualizacion').value || null,
    url_dataset: document.getElementById('url_dataset').value || null,
    observaciones: document.getElementById('observaciones').value || null,
    que_se_solicita: document.getElementById('que_se_solicita').value.trim() || null,
    tipo_gestion: document.getElementById('tipo_gestion').value
  };

  try {
    if (id) {
      await API.updateDataset(id, data);
      avisarExito('Cambios enviados para aprobación');
    } else {
      await API.createDataset(data);
      avisarExito('Dataset enviado para aprobación');
    }
    closeModal();
    // La lista y los pendientes se vuelven a pedir, con el mismo filtro, búsqueda y página
    await recargarLista();
  } catch (error) {
    // Mensaje especial si no hubo cambios reales - mostrar dentro del modal
    if (error.message && error.message.includes('No se detectaron cambios')) {
      // Mostrar error dentro del modal
      let errorDiv = document.getElementById('modal-form-error');
      if (!errorDiv) {
        // Crear div de error si no existe
        errorDiv = document.createElement('div');
        errorDiv.id = 'modal-form-error';
        errorDiv.style.cssText = 'background: #fee2e2; color: #dc2626; padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.875rem; display: flex; align-items: center; gap: 0.5rem;';
        const form = document.getElementById('dataset-form');
        form.insertBefore(errorDiv, form.firstChild);
      }
      errorDiv.innerHTML = '⚠️ No realizaste ningún cambio. Modificá al menos un campo para guardar.';
      errorDiv.style.display = 'flex';
      // Scroll al inicio del modal para ver el error
      document.querySelector('#modal-dataset .modal-body').scrollTop = 0;
    } else {
      avisarError(error.message);
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Guardar';
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

function openDeleteModal(id, nombre) {
  // Verificar bloqueo por cambios pendientes
  if (datasetEstaBloqueado(id)) {
    mostrarMensajeBloqueo();
    return;
  }

  deleteId = id;
  document.getElementById('delete-dataset-name').textContent = nombre;
  document.getElementById('modal-delete').classList.add('active');
}

function closeDeleteModal() {
  deleteId = null;
  document.getElementById('modal-delete').classList.remove('active');
}

async function confirmDelete() {
  if (!deleteId) return;

  try {
    await API.deleteDataset(deleteId);
    avisarExito('Solicitud de eliminación enviada para aprobación');
    closeDeleteModal();
    await recargarLista();
  } catch (error) {
    avisarError(error.message);
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
  for (const id of ['registrar-recibido', 'registrar-cargado']) document.getElementById(id).addEventListener('input', revisarRegistro);
  document.getElementById('registrar-opciones').addEventListener('change', alElegirOpcion);
  for (const id of ['registrar-otra-mes', 'registrar-otra-anio']) document.getElementById(id).addEventListener('change', revisarRegistro);
  document.getElementById('registrar-proponer').addEventListener('click', proponerActualizacion);
  document.addEventListener('keydown', teclaEnPagina);
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
  anio.innerHTML = opcionesDeAnio(PRIMER_ANIO_DE_DATOS, anioDeHoy + 1, Number(defecto.slice(0, 4)));

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
  document.getElementById('modal-registrar-actualizacion').hidden = false;
  (soloAnio ? anio : mes).focus();
  alCambiarDatosAl();
}

// Cierra la ventana y devuelve el foco al botón que la abrió. Una respuesta de opciones que llegue después se descarta
function cerrarRegistro() {
  if (!registroAbierto()) return;
  document.getElementById('modal-registrar-actualizacion').hidden = true;
  registro.secuencia++;
  const { origen } = registro;
  Object.assign(registro, { dataset: null, opciones: [], errorDatosAl: null, cargando: false, origen: null });
  if (origen?.isConnected) origen.focus();
}

// Un error en su lugar de la ventana (texto, nunca HTML), o ninguno con null
function mostrarError(id, texto) {
  const lugar = document.getElementById(id);
  lugar.textContent = texto ?? '';
  lugar.hidden = !texto;
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
  mostrarError('registrar-error-datos', registro.errorDatosAl);
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
  mostrarError('registrar-error-datos', error);
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
  revisarRegistro();
}

/**
 * Muestra el error del paso 2 (con las palabras del servidor) y habilita "Proponer actualización" solo con una próxima
 * elegida, sin errores, sin opciones por llegar y sin un envío en curso (revisionDelRegistro, en admin-fechas.js).
 */
function revisarRegistro() {
  if (!registro.dataset) return;
  const { errorFechas, puedeProponer: sePuede } = revisionDelRegistro({
    formulario: formularioDelRegistro(), errorDatosAl: registro.errorDatosAl, cargando: registro.cargando,
    enviando: registro.enviando, hoy: registro.hoy
  });
  mostrarError('registrar-error-fechas', errorFechas);
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
  try {
    await API.registrarActualizacion(dataset.id, cuerpoDelRegistro(formularioDelRegistro()));
    avisarExito('Actualización propuesta. Queda pendiente de aprobación en Mi Perfil.');
    const { origen } = registro;
    cerrarRegistro();
    await recargarLista();
    // La lista se rearmó: el botón que abrió la ventana ya no está, y el de la fila nueva está deshabilitado porque el
    // dataset quedó bloqueado. El foco va a la lista, para no perderse al principio de la página
    if (origen && !origen.isConnected) document.getElementById('lista-datasets').focus();
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
}

// El teclado con la ventana abierta: Escape la cierra y Tab no sale de ella
function teclaEnPagina(evento) {
  if (!registroAbierto()) return;
  if (evento.key === 'Escape') {
    evento.preventDefault();
    cerrarRegistro();
  } else if (evento.key === 'Tab') {
    retenerFocoEnRegistro(evento);
  }
}

// Mantiene el foco dentro de la ventana. Entre sus controles Tab se deja (el navegador sabe moverse, también entre los
// radios); solo se interviene en los bordes (Shift+Tab en el primero, Tab en el último) y si el foco quedó afuera
function retenerFocoEnRegistro(evento) {
  const ventana = document.querySelector('#modal-registrar-actualizacion .ad-ventana');
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
