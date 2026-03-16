// Admin - Lógica de administración con integración Andino
let datasets = [];
let temas = [];
let frecuencias = [];
let areas = [];
let deleteId = null;
let currentEditDataset = null;
let andinoAreaReferencia = null; // Área de referencia importada de Andino
let datasetsConPendientes = []; // IDs de datasets con cambios pendientes

// Paginación
let paginaActual = 1;
const ITEMS_POR_PAGINA = 25;
let ultimosDatosFiltrados = [];

// Sistema de formatos (chips)
let formatosSeleccionados = new Set();
let formatosCatalogo = [];

// Variables para modal de registrar actualización
let registrarActualizacionId = null;
let registrarActualizacionDataset = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Verificar autenticación
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  // Ocultar elementos de administración si es lector
  if (!Auth.isAdmin()) {
    const btnNuevo = document.getElementById('btn-nuevo-dataset');
    if (btnNuevo) btnNuevo.style.display = 'none';
  }

  await loadCatalogos();
  await loadDatasets();
  setupSearch();
  
  // Cargar indicadores de cambios pendientes (solo admin)
  if (Auth.isAdmin()) {
    await cargarIndicadoresPendientes();
  }
});

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
  } catch (error) {
    console.error('Error cargando catálogos:', error);
  }
}

function actualizarSelectAreas() {
  const areaOptions = areas.map(a => `<option value="${a.id}">${Utils.escapeHtml(a.nombre)}</option>`).join('');
  document.getElementById('area_id').innerHTML = '<option value="">Seleccionar...</option>' + areaOptions;
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

async function loadDatasets() {
  try {
    datasets = await API.getDatasets();
    // Ordenana alfabéticamente por título
    datasets.sort((a, b) => a.titulo.localeCompare(b.titulo));
    paginaActual = 1;
    renderTable(datasets);
  } catch (error) {
    console.error('Error cargando datasets:', error);
    Utils.showError('Error al cargar los datasets');
  }
}

function setupSearch() {
  const searchInput = document.getElementById('search');
  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const term = searchInput.value.toLowerCase();
      const filtered = datasets.filter(d =>
        d.titulo.toLowerCase().includes(term) ||
        (d.area_nombre && d.area_nombre.toLowerCase().includes(term))
      );
      paginaActual = 1;
      renderTable(filtered);
    }, 300);
  });
}

function renderTable(data) {
  const tbody = document.getElementById('datasets-tbody');
  ultimosDatosFiltrados = data;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding: 2rem;">No hay datasets</td></tr>';
    renderPaginacion(0);
    return;
  }

  // Paginación
  const totalPaginas = Math.ceil(data.length / ITEMS_POR_PAGINA);
  if (paginaActual > totalPaginas) paginaActual = totalPaginas || 1;
  const inicio = (paginaActual - 1) * ITEMS_POR_PAGINA;
  const pagina = data.slice(inicio, inicio + ITEMS_POR_PAGINA);

  renderPaginacion(data.length);

  tbody.innerHTML = pagina.map(d => {
    const estado = Utils.calcularEstado(d.proxima_actualizacion, d.frecuencia_dias, d.tipo_gestion);
    const estadoTexto = Utils.getEstadoTexto(estado);
    const estadoClase = Utils.getEstadoClase(estado);
    
    let proximaTexto = '-';
    if (d.frecuencia_dias === null) {
      proximaTexto = 'Eventual';
    } else if (d.proxima_actualizacion) {
      proximaTexto = Utils.formatDate(d.proxima_actualizacion);
    }

    // Mostrar tipo de gestión con icono Lucide
    const tipoGestionIcon = d.tipo_gestion === 'interna' 
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #6366f1;"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m16 8-8 8"/><path d="M16 14v-6h-6"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #f59e0b;"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 16 16 8"/><path d="M8 10V8h6"/></svg>';
    const tipoGestionTexto = d.tipo_gestion === 'interna' ? 'Interna' : 'Externa';

    // Verificar si tiene cambios pendientes
    const tienePendientes = datasetEstaBloqueado(d.id);
    const indicadorPendiente = tienePendientes ? '<span class="indicador-pendiente">🟡 Pendiente</span>' : '';
    const claseFila = tienePendientes ? 'fila-bloqueada' : '';

    return `
      <tr class="${claseFila}">
        <td>
          <div style="font-weight: 500;">${Utils.escapeHtml(d.titulo)}${indicadorPendiente}</div>
          <div class="text-small text-muted">${Utils.escapeHtml(d.area_nombre || '-')}</div>
        </td>
        <td><span class="badge ${estadoClase}">${estadoTexto}</span></td>
        <td><span title="${tipoGestionTexto}">${tipoGestionIcon} ${tipoGestionTexto}</span></td>
        <td>${proximaTexto}</td>
        <td>
            <div class="table-actions" style="display: flex; gap: 6px;">
            ${Auth.isAdmin() ? `
            <button onclick="marcarActualizado(${d.id})" class="btn btn-success btn-sm" style="${tienePendientes ? 'filter: grayscale(100%); opacity: 0.5; pointer-events: none;' : ''}" title="Marcar actualizado${tienePendientes ? ' (Bloqueado)' : ''}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>
            <button onclick="editDataset(${d.id})" class="btn btn-secondary btn-sm" style="${tienePendientes ? 'filter: grayscale(100%); opacity: 0.5; pointer-events: none;' : ''}" title="Editar${tienePendientes ? ' (Bloqueado)' : ''}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>
            <button onclick="openDeleteModal(${d.id}, '${Utils.escapeHtml(d.titulo).replace(/'/g, "\\'")}')" class="btn btn-danger btn-sm" style="${tienePendientes ? 'filter: grayscale(100%); opacity: 0.5; pointer-events: none;' : ''}" title="Eliminar${tienePendientes ? ' (Bloqueado)' : ''}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button>
            ` : '<span class="text-muted text-small">Solo lectura</span>'}
            </div>
        </td>
      </tr>
    `;
  }).join('');
}

// =====================================================
// PAGINACIÓN
// =====================================================

function renderPaginacion(totalItems) {
  const el = document.getElementById('datasets-paginacion');
  if (!el) return;
  if (totalItems <= ITEMS_POR_PAGINA) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const totalPaginas = Math.ceil(totalItems / ITEMS_POR_PAGINA);
  const inicio = (paginaActual - 1) * ITEMS_POR_PAGINA + 1;
  const fin = Math.min(paginaActual * ITEMS_POR_PAGINA, totalItems);
  el.innerHTML = `
    <span class="pag-info">Mostrando ${inicio}–${fin} de ${totalItems}</span>
    <div class="pag-controls">
      <button class="btn btn-outline btn-sm" ${paginaActual <= 1 ? 'disabled' : ''} onclick="cambiarPagina(-1)">← Anterior</button>
      <span class="pag-pagina">Página ${paginaActual} de ${totalPaginas}</span>
      <button class="btn btn-outline btn-sm" ${paginaActual >= totalPaginas ? 'disabled' : ''} onclick="cambiarPagina(1)">Siguiente →</button>
    </div>
  `;
}

function cambiarPagina(dir) {
  paginaActual += dir;
  renderTable(ultimosDatosFiltrados);
  document.querySelector('.table-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        <span class="text-small">Puede continuar con la carga manual haciendo clic en "Carga manual".</span>
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
    Utils.showError('Error al cargar el dataset');
  }
}

// =====================================================
// ACTUALIZAR DESDE PORTAL (en modo edición)
// =====================================================

function updateFromAndino() {
  // Verificar que hay URL del dataset
  const url = document.getElementById('url_dataset').value.trim();
  if (!url || !url.includes('datos.comodoro.gov.ar')) {
    Utils.showError('No hay una URL válida del portal para actualizar');
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
    
    Utils.showSuccess('Datos actualizados desde el portal. Recuerde guardar los cambios.');

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
    Utils.showSuccess('Área creada correctamente');
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('hidden');
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar';
  }
}

// =====================================================
// SUBMIT FORMULARIO
// =====================================================

document.getElementById('dataset-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Validar que hay al menos un formato seleccionado
  if (formatosSeleccionados.size === 0) {
    Utils.showError('Debe seleccionar al menos un formato');
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
    tipo_gestion: document.getElementById('tipo_gestion').value
  };

  try {
    if (id) {
      await API.updateDataset(id, data);
      Utils.showSuccess('Cambios enviados para aprobación');
    } else {
      await API.createDataset(data);
      Utils.showSuccess('Dataset enviado para aprobación');
    }
    closeModal();
    await loadDatasets();
    await cargarIndicadoresPendientes();
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
      document.querySelector('.modal-body').scrollTop = 0;
    } else {
      Utils.showError(error.message);
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Guardar';
  }
});

// =====================================================
// MARCAR ACTUALIZADO
// =====================================================

async function marcarActualizado(id) {
  // Abrir modal en lugar de registrar directamente
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
    Utils.showSuccess('Solicitud de eliminación enviada para aprobación');
    closeDeleteModal();
    await loadDatasets();
    await cargarIndicadoresPendientes();
  } catch (error) {
    Utils.showError(error.message);
  }
}

// =====================================================
// SISTEMA DE CAMBIOS PENDIENTES (v1.5.0)
// =====================================================

/**
 * Carga indicadores de cambios pendientes
 */
async function cargarIndicadoresPendientes() {
  try {
    // Obtener contador para badge
    const { cantidad } = await API.getContadorPendientes();
    const badge = document.getElementById('nav-badge-pendientes');
    if (badge) {
      if (cantidad > 0) {
        badge.textContent = cantidad;
        badge.style.display = 'inline';
      } else {
        badge.style.display = 'none';
      }
    }

    // Obtener datasets bloqueados
    datasetsConPendientes = await API.getDatasetsConPendientes();
    
    // Re-renderizar tabla si ya hay datos
    if (datasets.length > 0) {
      const searchTerm = document.getElementById('search').value.toLowerCase();
      const filtered = searchTerm 
        ? datasets.filter(d => d.titulo.toLowerCase().includes(searchTerm) || (d.area_nombre && d.area_nombre.toLowerCase().includes(searchTerm)))
        : datasets;
      renderTable(filtered);
    }
  } catch (error) {
    console.error('Error cargando indicadores de pendientes:', error);
  }
}

/**
 * Verifica si un dataset está bloqueado por cambios pendientes
 */
function datasetEstaBloqueado(id) {
  return datasetsConPendientes.includes(id);
}

/**
 * Muestra mensaje de bloqueo
 */
function mostrarMensajeBloqueo() {
  Utils.showError('Este dataset tiene cambios pendientes de aprobación. No se puede modificar hasta que se resuelvan.');
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
      Utils.showError('No se pudo cargar el dataset');
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
    document.getElementById('registrar-proxima-actual').textContent = 
      dataset.proxima_actualizacion ? Utils.formatDate(dataset.proxima_actualizacion) : '-';

    // Proponer fecha de actualización = hoy
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('registrar-ultima').value = hoy;

    // Calcular próxima propuesta
    const proximaGroup = document.getElementById('registrar-proxima-group');
    if (esEventual) {
      // Frecuencia eventual: ocultar campo de próxima
      proximaGroup.style.display = 'none';
      document.getElementById('registrar-proxima').value = '';
    } else {
      proximaGroup.style.display = 'block';
      const proximaPropuesta = calcularProximaPropuesta(dataset.proxima_actualizacion, frecuencia.dias);
      document.getElementById('registrar-proxima').value = proximaPropuesta;
    }

    // Mostrar modal
    document.getElementById('modal-registrar-actualizacion').classList.add('active');

  } catch (error) {
    console.error('Error abriendo modal:', error);
    Utils.showError('Error al cargar datos del dataset');
  }
}

/**
 * Calcula la próxima fecha propuesta sumando días de frecuencia a la próxima actual
 */
function calcularProximaPropuesta(proximaActual, diasFrecuencia) {
  if (!proximaActual || !diasFrecuencia) return '';
  
  // Parsear fecha evitando problemas de timezone
  const partes = proximaActual.split('T')[0].split('-');
  const proxima = new Date(partes[0], partes[1] - 1, partes[2]);
  proxima.setDate(proxima.getDate() + diasFrecuencia);
  
  // Formatear como YYYY-MM-DD
  const anio = proxima.getFullYear();
  const mes = String(proxima.getMonth() + 1).padStart(2, '0');
  const dia = String(proxima.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
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
    
    Utils.showSuccess('Actualización registrada correctamente');
    closeRegistrarActualizacionModal();
    await loadDatasets();
  } catch (error) {
    Utils.showError(error.message);
  } finally {
    btnConfirmar.disabled = false;
    btnConfirmar.innerHTML = '<span>✔</span> Registrar';
  }
}
