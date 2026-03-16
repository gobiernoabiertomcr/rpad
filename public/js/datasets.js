// Datasets - Lógica de listado
let allDatasets = [];
let temas = [];
let frecuencias = [];

// Paginación
let paginaActual = 1;
const ITEMS_POR_PAGINA = 25;
let ultimosDatosFiltrados = [];

document.addEventListener('DOMContentLoaded', async () => {
  // El header ahora se maneja desde main.js
  await loadCatalogos();
  await loadDatasets();
  setupFilters();
  applyUrlParams();
});

async function loadCatalogos() {
  try {
    [temas, frecuencias] = await Promise.all([
      API.getTemas(),
      API.getFrecuencias()
    ]);

    // Llenar select de temas
    const selectTema = document.getElementById('filter-tema');
    temas.forEach(t => {
      selectTema.innerHTML += `<option value="${t.id}">${escapeHtml(t.nombre)}</option>`;
    });

    // Llenar select de frecuencias
    const selectFrec = document.getElementById('filter-frecuencia');
    frecuencias.forEach(f => {
      selectFrec.innerHTML += `<option value="${f.id}">${escapeHtml(f.nombre)}</option>`;
    });
  } catch (error) {
    console.error('Error cargando catálogos:', error);
  }
}

async function loadDatasets() {
  try {
    allDatasets = await API.getDatasets();
    // Ordenar alfabéticamente por título
    allDatasets.sort((a, b) => a.titulo.localeCompare(b.titulo));
    renderDatasets(allDatasets);
  } catch (error) {
    console.error('Error cargando datasets:', error);
    if (typeof showToast === 'function') {
      showToast('Error al cargar los datasets', 'error');
    }
  }
}

function setupFilters() {
  const searchInput = document.getElementById('search');
  const temaSelect = document.getElementById('filter-tema');
  const frecSelect = document.getElementById('filter-frecuencia');
  const estadoSelect = document.getElementById('filter-estado');

  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyFilters, 300);
  });

  temaSelect.addEventListener('change', applyFilters);
  frecSelect.addEventListener('change', applyFilters);
  estadoSelect.addEventListener('change', applyFilters);
}

function applyUrlParams() {
  const params = getUrlParams();
  if (params.tema) document.getElementById('filter-tema').value = params.tema;
  if (params.frecuencia) document.getElementById('filter-frecuencia').value = params.frecuencia;
  if (params.estado) document.getElementById('filter-estado').value = params.estado;
  if (params.busqueda) document.getElementById('search').value = params.busqueda;
  applyFilters();
}

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    tema: params.get('tema'),
    frecuencia: params.get('frecuencia'),
    estado: params.get('estado'),
    busqueda: params.get('busqueda'),
    mes: params.get('mes')
  };
}

function applyFilters() {
  const busqueda = document.getElementById('search').value.toLowerCase();
  const temaId = document.getElementById('filter-tema').value;
  const frecId = document.getElementById('filter-frecuencia').value;
  const estado = document.getElementById('filter-estado').value;

  let filtered = allDatasets;

  if (busqueda) {
    filtered = filtered.filter(d =>
      d.titulo.toLowerCase().includes(busqueda) ||
      (d.area_responsable && d.area_responsable.toLowerCase().includes(busqueda)) ||
      (d.descripcion && d.descripcion.toLowerCase().includes(busqueda))
    );
  }

  if (temaId) {
    filtered = filtered.filter(d => 
      d.tema_principal_id == temaId || d.tema_secundario_id == temaId
    );
  }

  if (frecId) {
    filtered = filtered.filter(d => d.frecuencia_id == frecId);
  }

  if (estado) {
    filtered = filtered.filter(d => {
      const estadoDataset = calcularEstado(d.proxima_actualizacion, d.frecuencia_dias, d.tipo_gestion);
      
      // Filtro especial "vencidos" incluye tanto atrasados como sin-respuesta
      if (estado === 'vencidos') {
        return estadoDataset === 'atrasado' || estadoDataset === 'sin-respuesta';
      }
      
      return estadoDataset === estado;
    });
  }

  // Actualizar URL
  const params = new URLSearchParams();
  if (temaId) params.set('tema', temaId);
  if (frecId) params.set('frecuencia', frecId);
  if (estado) params.set('estado', estado);
  if (busqueda) params.set('busqueda', busqueda);
  
  const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
  history.replaceState(null, '', newUrl);

  paginaActual = 1;
  renderDatasets(filtered);
}

function limpiarFiltros() {
  document.getElementById('search').value = '';
  document.getElementById('filter-tema').value = '';
  document.getElementById('filter-frecuencia').value = '';
  document.getElementById('filter-estado').value = '';
  history.replaceState(null, '', window.location.pathname);
  paginaActual = 1;
  renderDatasets(allDatasets);
}

function renderDatasets(datasets) {
  const container = document.getElementById('datasets-grid');
  const emptyState = document.getElementById('empty-state');
  ultimosDatosFiltrados = datasets;

  if (!datasets.length) {
    container.classList.add('hidden');
    emptyState.classList.remove('hidden');
    renderPaginacion(0);
    return;
  }

  container.classList.remove('hidden');
  emptyState.classList.add('hidden');

  // Paginación
  const totalPaginas = Math.ceil(datasets.length / ITEMS_POR_PAGINA);
  if (paginaActual > totalPaginas) paginaActual = totalPaginas || 1;
  const inicio = (paginaActual - 1) * ITEMS_POR_PAGINA;
  const paginaItems = datasets.slice(inicio, inicio + ITEMS_POR_PAGINA);

  renderPaginacion(datasets.length);

  // Iconos Lucide
  const iconArea = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>';
  const iconFrecuencia = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>';

  container.innerHTML = paginaItems.map(d => {
    const estado = calcularEstado(d.proxima_actualizacion, d.frecuencia_dias, d.tipo_gestion);
    const estadoTexto = getEstadoTexto(estado);
    const estadoClase = getEstadoClase(estado);
    
    // Formatos vienen como string concatenado "CSV, XLSX, KML" desde el backend
    const formatos = d.formatos ? d.formatos.split(', ') : [];

    return `
      <div class="dataset-card">
        <div class="dataset-card-header">
          <div class="dataset-card-title">
            <h3><a href="dataset.html?id=${d.id}">${escapeHtml(d.titulo)}</a></h3>
            <span class="badge ${estadoClase}">${estadoTexto}</span>
          </div>
          ${d.tema_principal_nombre ? `
            <div class="temas-tags">
              <span class="tema-tag">${escapeHtml(d.tema_principal_nombre)}</span>
            </div>
          ` : ''}
        </div>
        <div class="dataset-card-body">
          <p class="dataset-card-description">${escapeHtml(d.descripcion || 'Sin descripción')}</p>
          <div class="dataset-card-meta">
            <span>${iconArea} ${escapeHtml(d.area_responsable || '-')}</span>
            <span>${iconFrecuencia} ${escapeHtml(d.frecuencia_nombre || '-')}</span>
          </div>
        </div>
        <div class="dataset-card-footer">
          <div class="dataset-formats">
            ${formatos.map(f => `<span class="format-tag">${f}</span>`).join('')}
          </div>
          <span class="text-xs text-muted">
            ${d.proxima_actualizacion ? `Próx: ${formatDate(d.proxima_actualizacion)}` : 'Sin fecha'}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

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
  renderDatasets(ultimosDatosFiltrados);
  document.getElementById('datasets-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exportarCSV() {
  const busqueda = document.getElementById('search').value.toLowerCase();
  const temaId = document.getElementById('filter-tema').value;
  const frecId = document.getElementById('filter-frecuencia').value;
  const estado = document.getElementById('filter-estado').value;

  let filtered = allDatasets;
  if (busqueda) filtered = filtered.filter(d => d.titulo.toLowerCase().includes(busqueda));
  if (temaId) filtered = filtered.filter(d => d.tema_principal_id == temaId);
  if (frecId) filtered = filtered.filter(d => d.frecuencia_id == frecId);
  if (estado) {
    filtered = filtered.filter(d => {
      const estadoDataset = calcularEstado(d.proxima_actualizacion, d.frecuencia_dias, d.tipo_gestion);
      if (estado === 'vencidos') {
        return estadoDataset === 'atrasado' || estadoDataset === 'sin-respuesta';
      }
      return estadoDataset === estado;
    });
  }

  const headers = ['Título', 'Área', 'Tema', 'Frecuencia', 'Tipo Gestión', 'Estado', 'Última Actualización', 'Próxima Actualización'];
  const rows = filtered.map(d => [
    d.titulo,
    d.area_responsable || '',
    d.tema_principal_nombre || '',
    d.frecuencia_nombre || '',
    getTipoGestionTexto(d.tipo_gestion),
    getEstadoTexto(calcularEstado(d.proxima_actualizacion, d.frecuencia_dias, d.tipo_gestion)),
    formatDate(d.ultima_actualizacion),
    formatDate(d.proxima_actualizacion)
  ]);

  const csvContent = '\uFEFF' + [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `datasets-rpad-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();

  if (typeof showToast === 'function') {
    showToast(`Exportados ${filtered.length} datasets a CSV`, 'success');
  }
}

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function calcularEstado(proximaActualizacion, frecuenciaDias, tipoGestion) {
  if (!proximaActualizacion) return 'eventual';
  if (frecuenciaDias === null) return 'eventual';

  const hoy = new Date();
  const hoyYear = hoy.getFullYear();
  const hoyMonth = hoy.getMonth();
  const hoyDay = hoy.getDate();

  const fechaStr = proximaActualizacion.split('T')[0];
  const [year, month, day] = fechaStr.split('-').map(Number);

  const hoyUTC = Date.UTC(hoyYear, hoyMonth, hoyDay);
  const proximaUTC = Date.UTC(year, month - 1, day);

  const diffDias = Math.round((proximaUTC - hoyUTC) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    return tipoGestion === 'interna' ? 'atrasado' : 'sin-respuesta';
  } else if (diffDias <= 60) {
    return 'proximo';
  }
  return 'actualizado';
}

function getEstadoTexto(estado) {
  const textos = {
    'actualizado': 'Actualizado',
    'proximo': 'Próximo',
    'atrasado': 'Atrasado',
    'sin-respuesta': 'Sin respuesta',
    'eventual': 'Eventual'
  };
  return textos[estado] || estado;
}

function getEstadoClase(estado) {
  const clases = {
    'actualizado': 'badge-success',
    'proximo': 'badge-warning',
    'atrasado': 'badge-danger',
    'sin-respuesta': 'badge-sin-respuesta',
    'eventual': 'badge-secondary'
  };
  return clases[estado] || 'badge-secondary';
}

function getTipoGestionTexto(tipo) {
  const tipos = {
    'interna': 'Gestión Interna',
    'externa': 'Gestión Externa'
  };
  return tipos[tipo] || tipo;
}
