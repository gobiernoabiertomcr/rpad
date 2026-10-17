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

// Variables para modal de registrar actualización
let registrarActualizacionId = null;
let registrarActualizacionDataset = null;

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
  else if (registrar !== undefined) marcarActualizado(Number(registrar));
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

async function marcarActualizado(id) {
  // El bloqueo se verifica antes de abrir, no solo con el botón deshabilitado (spec 8.6, arreglo 4)
  if (datasetEstaBloqueado(id)) {
    mostrarMensajeBloqueo();
    return;
  }
  await abrirRegistrarActualizacion(id);
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
// REGISTRAR ACTUALIZACIÓN (Modal)
// =====================================================

/**
 * Abre el modal de registrar actualización
 */
async function abrirRegistrarActualizacion(id) {
  try {
    // Obtener datos completos del dataset
    const dataset = await API.getDataset(id);
    if (!dataset) {
      avisarError('No se pudo cargar el dataset');
      return;
    }

    registrarActualizacionId = id;
    registrarActualizacionDataset = dataset;

    // Obtener frecuencia del catálogo
    const frecuencia = frecuencias.find(f => f.id === dataset.frecuencia_id);
    const esEventual = frecuencia && frecuencia.dias === null;

    // Llenar datos informativos
    document.getElementById('registrar-dataset-titulo').textContent = dataset.titulo;
    document.getElementById('registrar-frecuencia').textContent = frecuencia ? frecuencia.nombre : '-';
    document.getElementById('registrar-proxima-actual').textContent = fechaCorta(dataset.proxima_actualizacion);

    // Proponer fecha de actualización = hoy (en Argentina)
    document.getElementById('registrar-ultima').value = hoyEnArgentina();

    // La próxima la elige quien registra (sin frecuencia eventual)
    const proximaGroup = document.getElementById('registrar-proxima-group');
    proximaGroup.style.display = esEventual ? 'none' : 'block';
    document.getElementById('registrar-proxima').value = '';

    // Mostrar modal
    document.getElementById('modal-registrar-actualizacion').classList.add('active');

  } catch (error) {
    console.error('Error abriendo modal:', error);
    avisarError('Error al cargar datos del dataset');
  }
}

function closeRegistrarActualizacionModal() {
  document.getElementById('modal-registrar-actualizacion').classList.remove('active');
  registrarActualizacionId = null;
  registrarActualizacionDataset = null;
}

async function confirmarRegistrarActualizacion() {
  if (!registrarActualizacionId) return;

  const btnConfirmar = document.getElementById('btn-confirmar-actualizacion');
  btnConfirmar.disabled = true;
  btnConfirmar.innerHTML = '<span>⏳</span> Guardando...';

  const fechaActualizacion = document.getElementById('registrar-ultima').value;
  const proximaActualizacion = document.getElementById('registrar-proxima').value || null;

  try {
    await API.registrarActualizacion(registrarActualizacionId, {
      fecha_actualizacion: fechaActualizacion,
      proxima_actualizacion: proximaActualizacion
    });

    avisarExito('Actualización propuesta. Queda pendiente de aprobación en Mi Perfil.');
    closeRegistrarActualizacionModal();
    // La fila pasa a "Cambio pendiente": se vuelven a pedir la lista y los pendientes (spec 8.6, arreglo 2)
    await recargarLista();
  } catch (error) {
    avisarError(error.message);
  } finally {
    btnConfirmar.disabled = false;
    btnConfirmar.innerHTML = '<span>✔</span> Registrar';
  }
}
