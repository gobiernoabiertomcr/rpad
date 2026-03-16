/**
 * RPAD - Gestión (Métricas y Proyectos)
 */

let chartActualizados = null;
let chartNotificaciones = null;
let chartTemas = null;
let chartFrecuencias = null;
let editandoProyectoId = null;
let editandoHitoId = null;
let editandoLogroId = null;
let proyectoDetalleId = null;
let vistaActual = 'lista';
let hitoDropZoneInstance = null;
let logroDropZoneInstance = null;
let timelineData = [];
let proyectosCache = [];
let paginaActual = 1;
let paginaLogros = 1;
let paginaTimeline = 1;
let logrosCache = [];
let timelineItemsCache = [];
const PROYECTOS_POR_PAGINA = 20;
const ITEMS_POR_PAGINA = 20;

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const TIPO_METRICA_LABELS = {
  notas_enviadas: 'Notas enviadas',
  reuniones_capacitaciones: 'Reuniones/Capacitaciones',
  consultas_atendidas: 'Consultas atendidas'
};

const ESTADO_LABELS = {
  en_curso: 'En curso',
  completado: 'Completado',
  suspendido: 'Suspendido',
  idea: 'Idea'
};

const CATEGORIA_LABELS = {
  tecnologia: 'Tecnología',
  normativa: 'Normativa',
  difusion: 'Difusión'
};

const PRIORIDAD_LABELS = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja'
};

const ESTADO_ICONS = {
  idea: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
  en_curso: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>',
  completado: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  suspendido: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>'
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#e11d48'];

// =====================================================
// INICIALIZACIÓN
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  // Mostrar controles admin
  if (Auth.isAdmin()) {
    const metricasSection = document.getElementById('metricas-manuales-section');
    if (metricasSection) metricasSection.style.display = '';
  }

  // Setear año/mes actuales en el form de métricas manuales
  const now = new Date();
  const anioInput = document.getElementById('metrica-anio');
  const mesSelect = document.getElementById('metrica-mes');
  if (anioInput) anioInput.value = now.getFullYear();
  if (mesSelect) mesSelect.value = now.getMonth() + 1;

  // Event listeners para filtros de repositorio
  document.getElementById('repositorio-search').addEventListener('input', () => { paginaActual = 1; filtrarYRenderizar(); });
  document.getElementById('repositorio-categoria').addEventListener('change', () => { paginaActual = 1; filtrarYRenderizar(); });

  await cargarAreasSelect();
  await cargarProyectos();
  setVistaProyectos(vistaActual);
});

// =====================================================
// TABS
// =====================================================

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');

  if (tab === 'proyectos') {
    cargarProyectos();
  } else if (tab === 'metricas') {
    cargarMetricas();
  }
}

// =====================================================
// MÉTRICAS AUTOMÁTICAS
// =====================================================

async function cargarMetricas() {
  try {
    const meses = document.getElementById('metricas-periodo').value;
    const response = await fetch(`${CONFIG.API_URL}/gestion/metricas?meses=${meses}`, {
      headers: Auth.getAuthHeaders(),
      cache: 'no-store'
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    const data = result.data;
    renderKPIs(data);
    renderCharts(data);
    renderRanking(data.ranking_areas);
    await cargarMetricasManuales();
  } catch (error) {
    console.error('Error cargando métricas:', error);
    Utils.showError('Error al cargar métricas');
  }
}

function renderKPIs(data) {
  const grid = document.getElementById('kpi-grid');
  const totalActualizados = data.actualizados_por_mes.reduce((s, r) => s + r.cantidad, 0);
  const totalCreados = data.creados_por_mes.reduce((s, r) => s + r.cantidad, 0);
  const totalNotificaciones = data.notificaciones_por_mes.reduce((s, r) => s + r.cantidad, 0);
  const tiempoAprobacion = data.tiempo_promedio_aprobacion ? Math.round(data.tiempo_promedio_aprobacion * 10) / 10 : '-';
  const operador = data.operador_mas_activo ? data.operador_mas_activo.nombre_completo : '-';

  grid.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-value">${totalActualizados}</div>
      <div class="kpi-label">Datasets actualizados</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${totalCreados}</div>
      <div class="kpi-label">Datasets creados</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${totalNotificaciones}</div>
      <div class="kpi-label">Notificaciones enviadas</div>
    </div>
    <div class="kpi-card success">
      <div class="kpi-value">${data.tasa_cumplimiento}%</div>
      <div class="kpi-label">Tasa de cumplimiento</div>
    </div>
    <div class="kpi-card warning">
      <div class="kpi-value">${tiempoAprobacion}</div>
      <div class="kpi-label">Días prom. aprobación</div>
    </div>
  `;
}

function renderCharts(data) {
  // Actualizados por mes
  const actLabels = data.actualizados_por_mes.map(r => `${MESES[r.mes - 1]} ${r.anio}`);
  const actData = data.actualizados_por_mes.map(r => r.cantidad);
  renderBarChart('chart-actualizados', actLabels, actData, '#3b82f6', chartActualizados, c => { chartActualizados = c; });

  // Notificaciones por mes
  const notLabels = data.notificaciones_por_mes.map(r => `${MESES[r.mes - 1]} ${r.anio}`);
  const notData = data.notificaciones_por_mes.map(r => r.cantidad);
  renderBarChart('chart-notificaciones', notLabels, notData, '#10b981', chartNotificaciones, c => { chartNotificaciones = c; });

  // Distribución por tema
  const temaLabels = data.distribucion_por_tema.map(r => r.tema);
  const temaData = data.distribucion_por_tema.map(r => r.cantidad);
  renderDoughnutChart('chart-temas', temaLabels, temaData, chartTemas, c => { chartTemas = c; });

  // Distribución por frecuencia
  const freqLabels = data.distribucion_por_frecuencia.map(r => r.frecuencia);
  const freqData = data.distribucion_por_frecuencia.map(r => r.cantidad);
  renderDoughnutChart('chart-frecuencias', freqLabels, freqData, chartFrecuencias, c => { chartFrecuencias = c; });
}

function renderBarChart(canvasId, labels, data, color, existingChart, setter) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (existingChart) existingChart.destroy();

  const chart = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: color + '33',
        borderColor: color,
        borderWidth: 2,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
  setter(chart);
}

function renderDoughnutChart(canvasId, labels, data, existingChart, setter) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (existingChart) existingChart.destroy();

  const chart = new Chart(ctx.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_COLORS.slice(0, data.length),
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 12, padding: 8, font: { size: 11 } }
        }
      }
    }
  });
  setter(chart);
}

function renderRanking(areas) {
  const container = document.getElementById('ranking-container');
  if (!areas || areas.length === 0) {
    container.innerHTML = '<p style="color:var(--gray-500);font-size:0.9rem;">Sin datos de áreas</p>';
    return;
  }

  let html = `<table class="ranking-table">
    <thead><tr><th>#</th><th>Área</th><th>Datasets</th><th>Al día</th><th>Cumplimiento</th><th></th></tr></thead><tbody>`;

  areas.forEach((area, i) => {
    const color = area.porcentaje >= 80 ? '#10b981' : area.porcentaje >= 50 ? '#f59e0b' : '#ef4444';
    html += `<tr>
      <td>${i + 1}</td>
      <td>${Utils.escapeHtml(area.area)}</td>
      <td>${area.total_datasets}</td>
      <td>${area.al_dia}</td>
      <td>${area.porcentaje}%</td>
      <td style="width:120px"><div class="progress-bar-container"><div class="progress-bar" style="width:${area.porcentaje}%;background:${color}"></div></div></td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// =====================================================
// MÉTRICAS MANUALES
// =====================================================

async function cargarMetricasManuales() {
  try {
    const meses = document.getElementById('metricas-periodo').value;
    const response = await fetch(`${CONFIG.API_URL}/gestion/metricas-manuales?meses=${meses}`, {
      headers: Auth.getAuthHeaders(),
      cache: 'no-store'
    });
    const result = await response.json();
    if (!result.success) return;

    const list = document.getElementById('metricas-manuales-list');
    if (!list) return;

    if (result.data.length === 0) {
      list.innerHTML = '<p style="color:var(--gray-500);font-size:0.85rem;margin-top:8px;">No hay métricas manuales cargadas para este período</p>';
      return;
    }

    const isAdmin = Auth.isAdmin();
    list.innerHTML = result.data.map(m => `
      <div class="metrica-item">
        <span class="metrica-tipo">${TIPO_METRICA_LABELS[m.tipo] || m.tipo}</span>
        <span class="metrica-periodo">${MESES_FULL[m.mes - 1]} ${m.anio}</span>
        <span class="metrica-cantidad">${m.cantidad}</span>
        ${isAdmin ? `<button class="btn btn-secondary btn-sm" onclick="eliminarMetricaManual(${m.id})" style="margin-left:auto;padding:4px 8px;font-size:0.75rem;">&times;</button>` : ''}
      </div>
    `).join('');
  } catch (error) {
    console.error('Error cargando métricas manuales:', error);
  }
}

async function guardarMetricaManual() {
  try {
    const tipo = document.getElementById('metrica-tipo').value;
    const anio = parseInt(document.getElementById('metrica-anio').value);
    const mes = parseInt(document.getElementById('metrica-mes').value);
    const cantidad = parseInt(document.getElementById('metrica-cantidad').value);

    if (isNaN(cantidad) || cantidad < 0) {
      Utils.showError('La cantidad debe ser un número positivo');
      return;
    }

    const response = await fetch(`${CONFIG.API_URL}/gestion/metricas-manuales`, {
      method: 'POST',
      headers: Auth.getAuthHeaders(),
      body: JSON.stringify({ tipo, anio, mes, cantidad })
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    showToast(result.message || 'Métrica guardada', 'success');
    document.getElementById('metrica-cantidad').value = '0';
    await cargarMetricasManuales();
  } catch (error) {
    Utils.showError(error.message || 'Error al guardar métrica');
  }
}

async function eliminarMetricaManual(id) {
  if (!confirm('¿Eliminar esta métrica?')) return;
  try {
    const response = await fetch(`${CONFIG.API_URL}/gestion/metricas-manuales/${id}`, {
      method: 'DELETE',
      headers: Auth.getAuthHeaders()
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    showToast('Métrica eliminada', 'success');
    await cargarMetricasManuales();
  } catch (error) {
    Utils.showError(error.message || 'Error al eliminar métrica');
  }
}

// =====================================================
// EXPORTACIÓN CSV
// =====================================================

async function exportarCSV() {
  try {
    const meses = document.getElementById('metricas-periodo').value;
    const response = await fetch(`${CONFIG.API_URL}/gestion/metricas/csv?meses=${meses}`, {
      headers: Auth.getAuthHeaders()
    });

    if (!response.ok) throw new Error('Error al exportar');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metricas-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showToast('CSV exportado', 'success');
  } catch (error) {
    Utils.showError(error.message || 'Error al exportar CSV');
  }
}

// =====================================================
// PROYECTOS
// =====================================================

async function cargarAreasSelect() {
  try {
    const areas = await API.getAreas();
    const select = document.getElementById('proy-areas');
    if (!select) return;
    select.innerHTML = areas.map(a => `<option value="${a.id}">${Utils.escapeHtml(a.nombre)}</option>`).join('');
  } catch (error) {
    console.error('Error cargando áreas:', error);
  }
}

async function cargarProyectos() {
  try {
    const response = await fetch(`${CONFIG.API_URL}/gestion/proyectos`, {
      headers: Auth.getAuthHeaders(),
      cache: 'no-store'
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    renderProyectosLista(result.data);
    cargarTimeline();
  } catch (error) {
    console.error('Error cargando proyectos:', error);
    Utils.showError('Error al cargar proyectos');
  }
}

function renderProyectosLista(proyectos) {
  proyectosCache = proyectos;
  paginaActual = 1;
  filtrarYRenderizar();
}

function filtrarYRenderizar() {
  const container = document.getElementById('proyectos-lista');
  if (!container) return;

  const busqueda = (document.getElementById('repositorio-search')?.value || '').toLowerCase();
  const catFiltro = document.getElementById('repositorio-categoria')?.value || '';

  let filtrados = proyectosCache;

  if (busqueda) {
    filtrados = filtrados.filter(p =>
      (p.nombre || '').toLowerCase().includes(busqueda) ||
      (p.descripcion || '').toLowerCase().includes(busqueda)
    );
  }
  if (catFiltro) {
    filtrados = filtrados.filter(p => p.categoria === catFiltro);
  }

  if (filtrados.length === 0) {
    container.innerHTML = '<p style="color:var(--gray-500);text-align:center;padding:40px;">No hay proyectos registrados</p>';
    renderizarPaginacion(0);
    return;
  }

  const totalPaginas = Math.ceil(filtrados.length / PROYECTOS_POR_PAGINA);
  if (paginaActual > totalPaginas) paginaActual = totalPaginas;
  const inicio = (paginaActual - 1) * PROYECTOS_POR_PAGINA;
  const pagina = filtrados.slice(inicio, inicio + PROYECTOS_POR_PAGINA);

  let html = '<div class="proyectos-grid">';
  for (const p of pagina) {
    const color = Utils.escapeHtml(p.color || '#3b82f6');
    const responsableHtml = p.responsable
      ? `<div class="proyecto-card-responsable">${Icons.user.replace(/width="\d+"/, 'width="12"').replace(/height="\d+"/, 'height="12"')} ${Utils.escapeHtml(p.responsable)}</div>`
      : '';

    html += `
        <div class="proyecto-card" onclick="verProyecto(${p.id})">
          <div class="proyecto-card-header-bg" style="background:linear-gradient(135deg, ${color} 0%, ${color}dd 100%)">
            <div class="proyecto-card-header-content">
              <div class="proyecto-card-icon-lg">
                ${getIconSvg(p.icono, 22)}
              </div>
              <div class="proyecto-card-header-text">
                <h4>${Utils.escapeHtml(p.nombre)}</h4>
                <span class="proyecto-card-categoria">${CATEGORIA_LABELS[p.categoria] || p.categoria}</span>
              </div>
            </div>
            <div class="proyecto-card-estado-badge estado-${p.estado}">
              ${ESTADO_ICONS[p.estado] || ''} ${ESTADO_LABELS[p.estado] || p.estado}
            </div>
          </div>
          <div class="proyecto-card-body">
            ${p.descripcion ? `<p class="proyecto-card-desc">${Utils.escapeHtml(p.descripcion)}</p>` : ''}
            <div class="proyecto-card-footer">
              <span class="proyecto-card-prioridad prioridad-${p.prioridad}">
                <span class="prioridad-dot"></span> ${PRIORIDAD_LABELS[p.prioridad] || p.prioridad}
              </span>
              ${responsableHtml}
            </div>
          </div>
        </div>`;
  }
  html += '</div>';

  container.innerHTML = html;
  renderizarPaginacion(filtrados.length);
}

function renderizarPaginacion(totalItems) {
  const paginacionEl = document.getElementById('proyectos-paginacion');
  if (!paginacionEl) return;

  if (totalItems <= PROYECTOS_POR_PAGINA) {
    paginacionEl.style.display = 'none';
    return;
  }

  const totalPaginas = Math.ceil(totalItems / PROYECTOS_POR_PAGINA);
  const inicio = (paginaActual - 1) * PROYECTOS_POR_PAGINA + 1;
  const fin = Math.min(paginaActual * PROYECTOS_POR_PAGINA, totalItems);
  paginacionEl.style.display = '';
  paginacionEl.innerHTML = `
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
  filtrarYRenderizar();
  document.getElementById('proyectos-lista')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderPaginacionGeneral(containerId, paginaActualVal, totalItems, itemsPorPagina, onCambiarFn) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (totalItems <= itemsPorPagina) { el.style.display = 'none'; return; }
  const totalPaginas = Math.ceil(totalItems / itemsPorPagina);
  const inicio = (paginaActualVal - 1) * itemsPorPagina + 1;
  const fin = Math.min(paginaActualVal * itemsPorPagina, totalItems);
  el.style.display = '';
  el.innerHTML = `
    <span class="pag-info">Mostrando ${inicio}–${fin} de ${totalItems}</span>
    <div class="pag-controls">
      <button class="btn btn-outline btn-sm" ${paginaActualVal <= 1 ? 'disabled' : ''} onclick="${onCambiarFn}(-1)">← Anterior</button>
      <span class="pag-pagina">Página ${paginaActualVal} de ${totalPaginas}</span>
      <button class="btn btn-outline btn-sm" ${paginaActualVal >= totalPaginas ? 'disabled' : ''} onclick="${onCambiarFn}(1)">Siguiente →</button>
    </div>
  `;
}

function cambiarPaginaLogros(dir) {
  paginaLogros += dir;
  renderLogrosArea(logrosCache);
  document.getElementById('logros-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cambiarPaginaTimeline(dir) {
  paginaTimeline += dir;
  renderTimelineItems(timelineItemsCache);
  document.getElementById('proyectos-timeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function cargarTimeline() {
  try {
    const response = await fetch(`${CONFIG.API_URL}/gestion/timeline`, {
      headers: Auth.getAuthHeaders(),
      cache: 'no-store'
    });
    const result = await response.json();
    if (!result.success) return;

    timelineData = result.data;
    renderTimeline(timelineData);

    // Render logros area (hitos sin proyecto)
    const logros = timelineData.filter(h => !h.proyecto_id);
    renderLogrosArea(logros);
  } catch (error) {
    console.error('Error cargando timeline:', error);
  }
}

function filtrarTimeline(filtro) {
  paginaTimeline = 1;
  if (!filtro || filtro === 'todos') {
    renderTimelineItems(timelineData);
  } else if (filtro === 'logros') {
    renderTimelineItems(timelineData.filter(h => !h.proyecto_id));
  } else if (filtro === 'proyectos') {
    renderTimelineItems(timelineData.filter(h => h.proyecto_id));
  }
}

function renderTimeline(hitos) {
  const container = document.getElementById('proyectos-timeline');
  if (!container) return;

  if (hitos.length === 0) {
    container.innerHTML = '<p style="color:var(--gray-500);text-align:center;padding:40px;">No hay hitos registrados</p>';
    return;
  }

  let html = `
    <div class="timeline-filter">
      <label>Filtrar:</label>
      <select class="form-select" style="max-width:180px;font-size:0.85rem;" onchange="filtrarTimeline(this.value)">
        <option value="todos">Todos</option>
        <option value="proyectos">Solo proyectos</option>
        <option value="logros">Solo logros</option>
      </select>
    </div>`;
  html += '<div id="timeline-items-container"></div>';
  container.innerHTML = html;

  renderTimelineItems(hitos);
}

function renderTimelineItems(hitos) {
  const container = document.getElementById('timeline-items-container');
  if (!container) return;

  timelineItemsCache = hitos;

  if (hitos.length === 0) {
    container.innerHTML = '<p style="color:var(--gray-500);text-align:center;padding:20px;">No hay hitos para este filtro</p>';
    renderPaginacionGeneral('timeline-paginacion', 1, 0, ITEMS_POR_PAGINA, 'cambiarPaginaTimeline');
    return;
  }

  // Paginar antes de agrupar
  const inicio = (paginaTimeline - 1) * ITEMS_POR_PAGINA;
  const hitosPagina = hitos.slice(inicio, inicio + ITEMS_POR_PAGINA);

  // Agrupar por mes/año
  const grupos = {};
  for (const h of hitosPagina) {
    const d = new Date(h.fecha);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(h);
  }

  let html = '';
  const sortedKeys = Object.keys(grupos).sort().reverse();

  for (const key of sortedKeys) {
    const [anio, mes] = key.split('-');
    html += `<div class="timeline-separator">${MESES_FULL[parseInt(mes) - 1]} ${anio}</div>`;
    html += '<div class="timeline">';

    for (const h of grupos[key]) {
      const isLogro = !h.proyecto_id;
      const color = isLogro ? '#8b5cf6' : (h.proyecto_color || '#3b82f6');
      const itemClass = isLogro ? 'timeline-item-logro' : 'timeline-item-proyecto';
      const iconSvg = isLogro ? Icons.award : getIconSvg(h.proyecto_icono, 14);
      const proyectoLabel = isLogro
        ? 'Logro del Área'
        : `${Utils.escapeHtml(h.proyecto_nombre || '')} - ${CATEGORIA_LABELS[h.categoria] || h.categoria || ''}`;

      // Archivos como chips
      let archivosHtml = '';
      if (h.archivos && h.archivos.length > 0) {
        archivosHtml = '<div style="margin-top:8px;">' + h.archivos.map(a =>
          `<span class="timeline-archivo-chip" onclick="event.stopPropagation(); previewArchivo(${h.id}, ${a.id}, '${Utils.escapeHtml(a.nombre_archivo)}', ${a.tamano}, '${Utils.escapeHtml(a.mime_type || '')}')" title="${Utils.escapeHtml(a.nombre_archivo)}">
            ${getFileExtIcon(a.nombre_archivo)} ${Utils.escapeHtml(Utils.truncate(a.nombre_archivo, 20))}
          </span>`
        ).join('') + '</div>';
      }

      html += `
        <div class="timeline-item ${itemClass}" style="border-left: 3px solid ${color};">
          <div class="timeline-item-icon" style="background:${color};color:white;">
            ${iconSvg}
          </div>
          <div class="timeline-date">${formatDate(h.fecha)}</div>
          <div class="timeline-title">${Utils.escapeHtml(h.titulo)}</div>
          <div class="timeline-proyecto">${proyectoLabel}</div>
          ${h.descripcion ? `<div class="timeline-desc">${Utils.escapeHtml(h.descripcion)}</div>` : ''}
          ${h.evidencia_url ? `<a href="${Utils.escapeHtml(h.evidencia_url)}" target="_blank" style="font-size:0.8rem;margin-top:4px;display:inline-block;">Ver evidencia</a>` : ''}
          ${archivosHtml}
        </div>`;
    }
    html += '</div>';
  }

  container.innerHTML = html;
  renderPaginacionGeneral('timeline-paginacion', paginaTimeline, hitos.length, ITEMS_POR_PAGINA, 'cambiarPaginaTimeline');
}

function renderLogrosArea(logros) {
  const container = document.getElementById('logros-area');
  if (!container) return;

  logrosCache = logros;

  if (logros.length === 0) {
    container.innerHTML = '';
    renderPaginacionGeneral('logros-paginacion', 1, 0, ITEMS_POR_PAGINA, 'cambiarPaginaLogros');
    return;
  }

  const inicio = (paginaLogros - 1) * ITEMS_POR_PAGINA;
  const logrosPagina = logros.slice(inicio, inicio + ITEMS_POR_PAGINA);

  const isAdmin = Auth.isAdmin();
  let html = `
    <div class="logros-section-header">
      <h3>${Icons.award} Logros del Área</h3>
    </div>`;

  html += '<div class="timeline">';
  for (const h of logrosPagina) {
    let archivosHtml = '';
    if (h.archivos && h.archivos.length > 0) {
      archivosHtml = '<div style="margin-top:6px;">' + h.archivos.map(a =>
        `<span class="timeline-archivo-chip" onclick="event.stopPropagation(); previewArchivo(${h.id}, ${a.id}, '${Utils.escapeHtml(a.nombre_archivo)}', ${a.tamano}, '${Utils.escapeHtml(a.mime_type || '')}')" title="${Utils.escapeHtml(a.nombre_archivo)}">
          ${getFileExtIcon(a.nombre_archivo)} ${Utils.escapeHtml(Utils.truncate(a.nombre_archivo, 20))}
        </span>`
      ).join('') + '</div>';
    }

    html += `
      <div class="timeline-item timeline-item-logro" style="border-left: 3px solid #8b5cf6;">
        <div class="timeline-item-icon" style="background:#8b5cf6;color:white;">
          ${Icons.award.replace(/width="\d+"/, 'width="14"').replace(/height="\d+"/, 'height="14"')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div class="timeline-date">${formatDate(h.fecha)}</div>
            <div class="timeline-title">${Utils.escapeHtml(h.titulo)}</div>
            ${h.descripcion ? `<div class="timeline-desc">${Utils.escapeHtml(h.descripcion)}</div>` : ''}
            ${h.evidencia_url ? `<a href="${Utils.escapeHtml(h.evidencia_url)}" target="_blank" style="font-size:0.8rem;margin-top:4px;display:inline-block;">Ver evidencia</a>` : ''}
            ${archivosHtml}
          </div>
          ${isAdmin ? `
            <div style="display:flex;gap:4px;flex-shrink:0;">
              <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:0.7rem;" onclick="editarLogro(${h.id})">Editar</button>
              <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:0.7rem;color:#ef4444;" onclick="eliminarLogro(${h.id})">Eliminar</button>
            </div>
          ` : ''}
        </div>
      </div>`;
  }
  html += '</div>';
  container.innerHTML = html;
  renderPaginacionGeneral('logros-paginacion', paginaLogros, logros.length, ITEMS_POR_PAGINA, 'cambiarPaginaLogros');
}

function setVistaProyectos(vista) {
  vistaActual = vista;
  document.querySelectorAll('.vista-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.vista-btn[onclick*="${vista}"]`).classList.add('active');

  const lista = document.getElementById('proyectos-lista');
  const timeline = document.getElementById('proyectos-timeline');
  const detalle = document.getElementById('proyecto-detalle');
  const logrosArea = document.getElementById('logros-area');
  const btnNuevoProyecto = document.getElementById('btn-nuevo-proyecto');
  const btnNuevoLogro = document.getElementById('btn-nuevo-logro');
  const toolbar = document.getElementById('repositorio-toolbar');
  const paginacion = document.getElementById('proyectos-paginacion');
  const logrosPaginacion = document.getElementById('logros-paginacion');
  const timelinePaginacion = document.getElementById('timeline-paginacion');
  const isAdmin = Auth.isAdmin();

  if (vista === 'lista') {
    lista.style.display = '';
    timeline.style.display = 'none';
    if (detalle) detalle.style.display = 'none';
    if (logrosArea) logrosArea.style.display = 'none';
    if (isAdmin && btnNuevoProyecto) btnNuevoProyecto.style.display = '';
    if (btnNuevoLogro) btnNuevoLogro.style.display = 'none';
    if (toolbar) toolbar.style.display = '';
    if (logrosPaginacion) logrosPaginacion.style.display = 'none';
    if (timelinePaginacion) timelinePaginacion.style.display = 'none';
    paginaActual = 1;
    filtrarYRenderizar();
  } else if (vista === 'logros') {
    lista.style.display = 'none';
    timeline.style.display = 'none';
    if (detalle) detalle.style.display = 'none';
    if (logrosArea) logrosArea.style.display = '';
    if (btnNuevoProyecto) btnNuevoProyecto.style.display = 'none';
    if (isAdmin && btnNuevoLogro) btnNuevoLogro.style.display = '';
    if (toolbar) toolbar.style.display = 'none';
    if (paginacion) paginacion.style.display = 'none';
    if (timelinePaginacion) timelinePaginacion.style.display = 'none';
    paginaLogros = 1;
    renderLogrosArea(logrosCache);
  } else {
    lista.style.display = 'none';
    timeline.style.display = '';
    if (detalle) detalle.style.display = 'none';
    if (logrosArea) logrosArea.style.display = 'none';
    if (btnNuevoProyecto) btnNuevoProyecto.style.display = 'none';
    if (btnNuevoLogro) btnNuevoLogro.style.display = 'none';
    if (toolbar) toolbar.style.display = 'none';
    if (paginacion) paginacion.style.display = 'none';
    if (logrosPaginacion) logrosPaginacion.style.display = 'none';
    paginaTimeline = 1;
    renderTimelineItems(timelineItemsCache);
  }
}

// =====================================================
// DETALLE PROYECTO
// =====================================================

async function verProyecto(id) {
  try {
    const response = await fetch(`${CONFIG.API_URL}/gestion/proyectos/${id}`, {
      headers: Auth.getAuthHeaders(),
      cache: 'no-store'
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    proyectoDetalleId = id;
    renderProyectoDetalle(result.data);
  } catch (error) {
    Utils.showError(error.message || 'Error al cargar proyecto');
  }
}

function renderProyectoDetalle(p) {
  const container = document.getElementById('proyecto-detalle');
  const lista = document.getElementById('proyectos-lista');
  const timeline = document.getElementById('proyectos-timeline');
  const logrosArea = document.getElementById('logros-area');

  lista.style.display = 'none';
  timeline.style.display = 'none';
  if (logrosArea) logrosArea.style.display = 'none';
  container.style.display = '';

  const isAdmin = Auth.isAdmin();
  const areasText = p.areas && p.areas.length > 0 ? p.areas.map(a => a.nombre).join(', ') : '-';
  const color = Utils.escapeHtml(p.color || '#3b82f6');

  // Calcular progreso por fecha
  const hoy = new Date().toISOString().split('T')[0];
  const totalHitos = p.hitos ? p.hitos.length : 0;

  let html = `
    <div style="border-radius:var(--border-radius-lg);box-shadow:var(--shadow);overflow:hidden;margin-bottom:24px;">
      <!-- Hero Header -->
      <div class="proyecto-hero" style="background:${color};">
        <div class="proyecto-hero-overlay"></div>
        <div class="proyecto-hero-content">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div class="proyecto-hero-icon">${getIconSvg(p.icono, 28)}</div>
              <h2>${Utils.escapeHtml(p.nombre)}</h2>
              ${p.descripcion ? `<p style="margin:6px 0 0;opacity:0.9;font-size:0.9rem;">${Utils.escapeHtml(p.descripcion)}</p>` : ''}
              <div class="proyecto-hero-badges">
                <span class="badge proyecto-hero-estado-badge">
                  ${ESTADO_ICONS[p.estado] || ''} ${ESTADO_LABELS[p.estado]}
                </span>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
              <button class="btn btn-secondary btn-sm" style="background:rgba(255,255,255,0.2);color:white;border-color:rgba(255,255,255,0.3);" onclick="volverALista()">Volver</button>
              ${isAdmin ? `
                <button class="btn btn-primary btn-sm" style="background:rgba(255,255,255,0.3);border-color:rgba(255,255,255,0.3);" onclick="editarProyecto(${p.id})">Editar</button>
                <button class="btn btn-secondary btn-sm" style="background:rgba(239,68,68,0.3);color:white;border-color:rgba(239,68,68,0.3);" onclick="eliminarProyecto(${p.id})">Eliminar</button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="proyecto-tabs">
        <button class="proyecto-tab active" onclick="switchProyectoTab('info', this)">Info</button>
        <button class="proyecto-tab" onclick="switchProyectoTab('hitos', this)">Hitos (${totalHitos})</button>
        <button class="proyecto-tab" onclick="switchProyectoTab('documentos', this)">Documentos (${p.documentos ? p.documentos.length : 0})</button>
      </div>

      <!-- Tab: Info -->
      <div class="proyecto-tab-content active" id="ptab-info">
        <div class="detail-info">
          <div class="detail-field"><label>Estado</label><span class="badge badge-estado-${p.estado}">${ESTADO_LABELS[p.estado]}</span></div>
          <div class="detail-field"><label>Prioridad</label><span class="badge badge-prioridad-${p.prioridad}">${PRIORIDAD_LABELS[p.prioridad]}</span></div>
          <div class="detail-field"><label>Categoría</label><span>${CATEGORIA_LABELS[p.categoria]}</span></div>
          <div class="detail-field"><label>Fecha de elevación</label><span>${formatDate(p.fecha_inicio)}</span></div>
          <div class="detail-field"><label>Autor</label><span>${Utils.escapeHtml(p.responsable || '-')}</span></div>
          <div class="detail-field"><label>Áreas</label><span>${Utils.escapeHtml(areasText)}</span></div>
          ${p.enlace_externo ? (() => {
            const isGoogle = /drive\.google\.com|docs\.google\.com/.test(p.enlace_externo);
            if (isGoogle) {
              return `<div class="detail-field"><label>Borrador</label><span>
                <a href="${Utils.escapeHtml(p.enlace_externo)}" target="_blank" rel="noopener" class="btn-borrador-preview">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                  Ver borrador
                </a></span></div>`;
            }
            return `<div class="detail-field"><label>Enlace</label><span><a href="${Utils.escapeHtml(p.enlace_externo)}" target="_blank" rel="noopener">${Utils.escapeHtml(Utils.truncate(p.enlace_externo, 50))}</a></span></div>`;
          })() : ''}
        </div>
      </div>

      <!-- Tab: Hitos -->
      <div class="proyecto-tab-content" id="ptab-hitos">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;font-size:1rem;">Hitos del proyecto</h3>
          ${isAdmin ? `<button class="btn btn-primary btn-sm" onclick="abrirModalHito(${p.id})">Nuevo Hito</button>` : ''}
        </div>`;

  if (p.hitos && p.hitos.length > 0) {
    html += '<div class="timeline">';
    for (const h of p.hitos) {
      const completado = String(h.fecha).substring(0, 10) <= hoy;
      html += `
        <div class="timeline-item" style="border-left: 3px solid ${color};">
          <div class="timeline-item-icon" style="background:${completado ? color : 'var(--gray-300)'};color:white;">
            ${completado ? Icons.checkCircle.replace(/width="\d+"/, 'width="14"').replace(/height="\d+"/, 'height="14"') : Icons.clock.replace(/width="\d+"/, 'width="14"').replace(/height="\d+"/, 'height="14"')}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div style="flex:1;min-width:0;">
              <div class="timeline-date">${formatDate(h.fecha)} ${completado ? '<span style="color:#10b981;font-weight:600;">Completado</span>' : '<span style="color:var(--gray-400);">Pendiente</span>'}</div>
              <div class="timeline-title">${Utils.escapeHtml(h.titulo)}</div>
              ${h.descripcion ? `<div class="timeline-desc">${Utils.escapeHtml(h.descripcion)}</div>` : ''}
              ${h.evidencia_url ? `<a href="${Utils.escapeHtml(h.evidencia_url)}" target="_blank" style="font-size:0.8rem;margin-top:4px;display:inline-block;">Ver evidencia</a>` : ''}
              ${h.archivos && h.archivos.length > 0 ? `
                <div style="margin-top:8px;">
                  ${h.archivos.map(a => `
                    <span class="timeline-archivo-chip" onclick="previewArchivo(${h.id}, ${a.id}, '${Utils.escapeHtml(a.nombre_archivo)}', ${a.tamano}, '${Utils.escapeHtml(a.mime_type || '')}')" title="${Utils.escapeHtml(a.nombre_archivo)}">
                      ${getFileExtIcon(a.nombre_archivo)} ${Utils.escapeHtml(Utils.truncate(a.nombre_archivo, 25))}
                    </span>
                  `).join('')}
                </div>
              ` : ''}
            </div>
            ${isAdmin ? `
              <div style="display:flex;gap:4px;flex-shrink:0;margin-left:8px;">
                <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:0.7rem;" onclick="editarHito(${h.id}, ${p.id})">Editar</button>
                <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:0.7rem;color:#ef4444;" onclick="eliminarHito(${h.id}, ${p.id})">Eliminar</button>
              </div>
            ` : ''}
          </div>
        </div>`;
    }
    html += '</div>';
  } else {
    html += '<p style="color:var(--gray-500);font-size:0.9rem;">No hay hitos registrados</p>';
  }

  html += `</div>

      <!-- Tab: Documentos -->
      <div class="proyecto-tab-content" id="ptab-documentos">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;font-size:1rem;">Documentos del proyecto</h3>
          ${isAdmin ? `<button class="btn btn-primary btn-sm" onclick="toggleDropZoneProyecto(${p.id})">Subir Archivo</button>` : ''}
        </div>
        <div id="proyecto-drop-zone-container" style="display:none; margin-bottom: 12px;">
          <div class="file-drop-zone" id="proyecto-drop-zone">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            <p>Arrastrá archivos aquí o hacé clic para seleccionar</p>
            <p class="drop-hint">PDF, DOCX, XLSX, CSV, imágenes, ZIP (máx. 10 MB)</p>
            <input type="file" id="proyecto-file-input" multiple accept=".pdf,.docx,.xlsx,.csv,.odt,.ods,.jpg,.jpeg,.png,.gif,.webp,.zip,.rar,.7z" style="display:none;">
          </div>
          <div class="file-list-container" id="proyecto-file-list"></div>
          <div style="margin-top:8px; text-align:right;">
            <button class="btn btn-primary btn-sm" onclick="ejecutarSubidaProyecto(${p.id})">Subir</button>
            <button class="btn btn-secondary btn-sm" onclick="toggleDropZoneProyecto()">Cancelar</button>
          </div>
        </div>`;

  if (p.documentos && p.documentos.length > 0) {
    for (const doc of p.documentos) {
      html += `
      <div class="doc-item">
        <div class="file-icon">${getFileExtIcon(doc.nombre_archivo)}</div>
        <div class="file-info">
          <div class="file-name" title="${Utils.escapeHtml(doc.nombre_archivo)}">${Utils.escapeHtml(doc.nombre_archivo)}</div>
          <div class="file-size">${formatFileSize(doc.tamano)}</div>
        </div>
        <div class="file-actions" style="display:flex;gap:4px;">
          <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:0.75rem;" onclick="previewDocumentoProyecto(${p.id}, ${doc.id}, '${Utils.escapeHtml(doc.nombre_archivo)}', ${doc.tamano}, '${Utils.escapeHtml(doc.mime_type || '')}')">Ver</button>
          <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:0.75rem;" onclick="descargarDocumento(${p.id}, ${doc.id}, '${Utils.escapeHtml(doc.nombre_archivo)}')">Descargar</button>
          ${isAdmin ? `<button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:0.75rem;color:#ef4444;" onclick="eliminarDocumento(${p.id}, ${doc.id})">Eliminar</button>` : ''}
        </div>
      </div>`;
    }
  } else {
    html += '<p style="color:var(--gray-500);font-size:0.85rem;">No hay documentos adjuntos</p>';
  }

  html += '</div></div>';
  container.innerHTML = html;
}

function switchProyectoTab(tab, btn) {
  document.querySelectorAll('.proyecto-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.proyecto-tab-content').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const tabContent = document.getElementById(`ptab-${tab}`);
  if (tabContent) tabContent.classList.add('active');
}

function volverALista() {
  const container = document.getElementById('proyecto-detalle');
  container.style.display = 'none';
  proyectoDetalleId = null;
  setVistaProyectos(vistaActual);
  cargarProyectos();
}

let proyectoDropZoneInstance = null;

function toggleDropZoneProyecto(proyectoId) {
  const container = document.getElementById('proyecto-drop-zone-container');
  if (!container) return;

  if (container.style.display === 'none') {
    container.style.display = '';
    // Inicializar drop zone si no existe
    const existingDocs = document.querySelectorAll('#proyecto-detalle .doc-item').length;
    proyectoDropZoneInstance = inicializarDropZone({
      dropZoneId: 'proyecto-drop-zone',
      fileInputId: 'proyecto-file-input',
      fileListId: 'proyecto-file-list',
      maxFiles: 10,
      existingCount: existingDocs
    });
  } else {
    container.style.display = 'none';
    if (proyectoDropZoneInstance) {
      proyectoDropZoneInstance.reset();
      proyectoDropZoneInstance = null;
    }
  }
}

async function ejecutarSubidaProyecto(proyectoId) {
  if (!proyectoDropZoneInstance) return;
  const files = proyectoDropZoneInstance.getFiles();
  if (files.length === 0) {
    showToast('No hay archivos seleccionados', 'error');
    return;
  }
  const ok = await subirDocumentosProyecto(proyectoId, files);
  if (ok) {
    proyectoDropZoneInstance = null;
    await verProyecto(proyectoId);
  }
}

// =====================================================
// CRUD PROYECTOS
// =====================================================

function renderIconSelector(selectedIcon) {
  const container = document.getElementById('proy-icono-selector');
  if (!container) return;

  const icons = Object.keys(ICON_SELECTOR_MAP);
  container.innerHTML = icons.map(name => {
    const isSelected = name === selectedIcon;
    return `<div class="icon-selector-item ${isSelected ? 'selected' : ''}" onclick="seleccionarIcono('${name}')" title="${name}">
      ${getIconSvg(name, 20)}
    </div>`;
  }).join('');
}

function seleccionarIcono(name) {
  document.getElementById('proy-icono').value = name;
  document.querySelectorAll('.icon-selector-item').forEach(el => el.classList.remove('selected'));
  const items = document.querySelectorAll('.icon-selector-item');
  const icons = Object.keys(ICON_SELECTOR_MAP);
  const idx = icons.indexOf(name);
  if (idx >= 0 && items[idx]) items[idx].classList.add('selected');
}

function abrirModalProyecto(proyectoData = null) {
  editandoProyectoId = proyectoData ? proyectoData.id : null;
  document.getElementById('modal-proyecto-titulo').textContent = proyectoData ? 'Editar Proyecto' : 'Nuevo Proyecto';

  document.getElementById('proy-nombre').value = proyectoData?.nombre || '';
  document.getElementById('proy-descripcion').value = proyectoData?.descripcion || '';
  document.getElementById('proy-estado').value = proyectoData?.estado || 'idea';
  document.getElementById('proy-prioridad').value = proyectoData?.prioridad || 'media';
  document.getElementById('proy-categoria').value = proyectoData?.categoria || 'tecnologia';
  document.getElementById('proy-fecha-inicio').value = proyectoData?.fecha_inicio ? String(proyectoData.fecha_inicio).substring(0, 10) : '';
  document.getElementById('proy-responsable').value = proyectoData?.responsable || '';
  const colorVal = proyectoData?.color || '#3b82f6';
  document.getElementById('proy-color').value = colorVal;
  const colorPreview = document.getElementById('proy-color-preview');
  if (colorPreview) colorPreview.style.background = colorVal;
  document.getElementById('proy-enlace').value = proyectoData?.enlace_externo || '';
  document.getElementById('proy-icono').value = proyectoData?.icono || '';

  // Render icon selector
  renderIconSelector(proyectoData?.icono || '');

  // Seleccionar áreas
  const areasSelect = document.getElementById('proy-areas');
  const selectedIds = proyectoData?.areas ? proyectoData.areas.map(a => String(a.id)) : [];
  Array.from(areasSelect.options).forEach(opt => {
    opt.selected = selectedIds.includes(opt.value);
  });

  document.getElementById('modal-proyecto').classList.add('active');
}

function cerrarModalProyecto() {
  document.getElementById('modal-proyecto').classList.remove('active');
  editandoProyectoId = null;
}

async function editarProyecto(id) {
  try {
    const response = await fetch(`${CONFIG.API_URL}/gestion/proyectos/${id}`, {
      headers: Auth.getAuthHeaders()
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    abrirModalProyecto(result.data);
  } catch (error) {
    Utils.showError('Error al cargar proyecto para edición');
  }
}

async function guardarProyecto() {
  try {
    const nombre = document.getElementById('proy-nombre').value.trim();
    if (!nombre) {
      Utils.showError('El nombre es requerido');
      return;
    }

    const areasSelect = document.getElementById('proy-areas');
    const areas = Array.from(areasSelect.selectedOptions).map(opt => parseInt(opt.value));

    const data = {
      nombre,
      descripcion: document.getElementById('proy-descripcion').value.trim() || null,
      estado: document.getElementById('proy-estado').value,
      prioridad: document.getElementById('proy-prioridad').value,
      categoria: document.getElementById('proy-categoria').value,
      fecha_inicio: document.getElementById('proy-fecha-inicio').value || null,
      responsable: document.getElementById('proy-responsable').value.trim() || null,
      color: document.getElementById('proy-color').value,
      icono: document.getElementById('proy-icono').value || null,
      enlace_externo: document.getElementById('proy-enlace').value.trim() || null,
      areas
    };

    const url = editandoProyectoId
      ? `${CONFIG.API_URL}/gestion/proyectos/${editandoProyectoId}`
      : `${CONFIG.API_URL}/gestion/proyectos`;
    const method = editandoProyectoId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: Auth.getAuthHeaders(),
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    showToast(result.message || 'Proyecto guardado', 'success');
    cerrarModalProyecto();

    if (proyectoDetalleId) {
      await verProyecto(editandoProyectoId || result.data.id);
    }
    await cargarProyectos();
  } catch (error) {
    Utils.showError(error.message || 'Error al guardar proyecto');
  }
}

async function eliminarProyecto(id) {
  if (!confirm('¿Eliminar este proyecto y todos sus hitos?')) return;
  try {
    const response = await fetch(`${CONFIG.API_URL}/gestion/proyectos/${id}`, {
      method: 'DELETE',
      headers: Auth.getAuthHeaders()
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    showToast('Proyecto eliminado', 'success');
    volverALista();
  } catch (error) {
    Utils.showError(error.message || 'Error al eliminar proyecto');
  }
}

// =====================================================
// CRUD HITOS
// =====================================================

function abrirModalHito(proyectoId, hitoData = null) {
  editandoHitoId = hitoData ? hitoData.id : null;
  document.getElementById('modal-hito-titulo').textContent = hitoData ? 'Editar Hito' : 'Nuevo Hito';

  document.getElementById('hito-titulo').value = hitoData?.titulo || '';
  document.getElementById('hito-fecha').value = hitoData?.fecha ? String(hitoData.fecha).substring(0, 10) : '';
  document.getElementById('hito-descripcion').value = hitoData?.descripcion || '';
  document.getElementById('hito-evidencia-tipo').value = hitoData?.evidencia_tipo || 'ninguno';
  document.getElementById('hito-evidencia-url').value = hitoData?.evidencia_url || '';

  // Mostrar/ocultar sección de archivos y renderizar existentes
  const archivosSection = document.getElementById('hito-archivos-section');
  const archivosExistentes = document.getElementById('hito-archivos-existentes');
  archivosSection.style.display = '';
  archivosExistentes.innerHTML = '';

  const existingCount = hitoData?.archivos?.length || 0;
  if (hitoData && hitoData.archivos && hitoData.archivos.length > 0) {
    archivosExistentes.innerHTML = hitoData.archivos.map(a => `
      <div class="doc-item" style="margin-bottom:4px;">
        <div class="file-icon">${getFileExtIcon(a.nombre_archivo)}</div>
        <div class="file-info">
          <div class="file-name" title="${Utils.escapeHtml(a.nombre_archivo)}">${Utils.escapeHtml(a.nombre_archivo)}</div>
          <div class="file-size">${formatFileSize(a.tamano)}</div>
        </div>
        <div class="file-actions" style="display:flex;gap:4px;">
          <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:0.7rem;" type="button" onclick="descargarHitoArchivo(${hitoData.id}, ${a.id}, '${Utils.escapeHtml(a.nombre_archivo)}')">Descargar</button>
          <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:0.7rem;color:#ef4444;" type="button" onclick="eliminarHitoArchivoDesdeModal(${hitoData.id}, ${a.id}, ${proyectoId})">Eliminar</button>
        </div>
      </div>
    `).join('');
  }

  // Inicializar drop zone
  hitoDropZoneInstance = inicializarDropZone({
    dropZoneId: 'hito-drop-zone',
    fileInputId: 'hito-file-input',
    fileListId: 'hito-file-list',
    maxFiles: 3,
    existingCount
  });

  // Store proyecto_id for save
  document.getElementById('modal-hito').dataset.proyectoId = proyectoId;
  document.getElementById('modal-hito').classList.add('active');
}

function cerrarModalHito() {
  document.getElementById('modal-hito').classList.remove('active');
  editandoHitoId = null;
  hitoDropZoneInstance = null;
}

async function eliminarHitoArchivoDesdeModal(hitoId, archivoId, proyectoId) {
  if (!confirm('¿Eliminar este archivo?')) return;
  try {
    const response = await fetch(`${CONFIG.API_URL}/gestion/hitos/${hitoId}/archivos/${archivoId}`, {
      method: 'DELETE',
      headers: Auth.getAuthHeaders()
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    showToast('Archivo eliminado', 'success');
    // Recargar datos del hito y re-abrir modal
    const projResponse = await fetch(`${CONFIG.API_URL}/gestion/proyectos/${proyectoId}`, { headers: Auth.getAuthHeaders() });
    const projResult = await projResponse.json();
    if (projResult.success) {
      const hito = projResult.data.hitos.find(h => h.id === hitoId);
      if (hito) {
        // Re-open modal with updated data (preserve pending files)
        const pendingFiles = hitoDropZoneInstance ? hitoDropZoneInstance.getFiles() : [];
        abrirModalHito(proyectoId, hito);
        // Re-add pending files
        if (pendingFiles.length > 0 && hitoDropZoneInstance) {
          // No direct way to re-add, user will need to re-select
        }
      }
    }
  } catch (error) {
    Utils.showError(error.message || 'Error al eliminar archivo');
  }
}

async function editarHito(hitoId, proyectoId) {
  // Buscar el hito en el detalle actual
  try {
    const response = await fetch(`${CONFIG.API_URL}/gestion/proyectos/${proyectoId}`, {
      headers: Auth.getAuthHeaders()
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    const hito = result.data.hitos.find(h => h.id === hitoId);
    if (hito) abrirModalHito(proyectoId, hito);
  } catch (error) {
    Utils.showError('Error al cargar hito');
  }
}

async function guardarHito() {
  try {
    const titulo = document.getElementById('hito-titulo').value.trim();
    const fecha = document.getElementById('hito-fecha').value;
    if (!titulo || !fecha) {
      Utils.showError('Título y fecha son requeridos');
      return;
    }

    const proyectoId = document.getElementById('modal-hito').dataset.proyectoId;
    const data = {
      titulo,
      fecha,
      descripcion: document.getElementById('hito-descripcion').value.trim() || null,
      evidencia_tipo: document.getElementById('hito-evidencia-tipo').value,
      evidencia_url: document.getElementById('hito-evidencia-url').value.trim() || null
    };

    let url, method;
    if (editandoHitoId) {
      url = `${CONFIG.API_URL}/gestion/hitos/${editandoHitoId}`;
      method = 'PUT';
    } else {
      url = `${CONFIG.API_URL}/gestion/proyectos/${proyectoId}/hitos`;
      method = 'POST';
    }

    const response = await fetch(url, { method, headers: Auth.getAuthHeaders(), body: JSON.stringify(data) });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    // Subir archivos pendientes si hay
    const hitoId = editandoHitoId || result.data.id;
    if (hitoDropZoneInstance) {
      const pendingFiles = hitoDropZoneInstance.getFiles();
      if (pendingFiles.length > 0) {
        await subirArchivosHito(hitoId, pendingFiles);
      }
    }

    showToast(result.message || 'Hito guardado', 'success');
    cerrarModalHito();
    await verProyecto(parseInt(proyectoId));
  } catch (error) {
    Utils.showError(error.message || 'Error al guardar hito');
  }
}

async function eliminarHito(hitoId, proyectoId) {
  if (!confirm('¿Eliminar este hito?')) return;
  try {
    const response = await fetch(`${CONFIG.API_URL}/gestion/hitos/${hitoId}`, {
      method: 'DELETE',
      headers: Auth.getAuthHeaders()
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    showToast('Hito eliminado', 'success');
    await verProyecto(proyectoId);
  } catch (error) {
    Utils.showError(error.message || 'Error al eliminar hito');
  }
}

// =====================================================
// CRUD LOGROS
// =====================================================

function abrirModalLogro(logroData = null) {
  editandoLogroId = logroData ? logroData.id : null;
  document.getElementById('modal-logro-titulo').textContent = logroData ? 'Editar Logro' : 'Registrar Logro';

  document.getElementById('logro-titulo').value = logroData?.titulo || '';
  document.getElementById('logro-fecha').value = logroData?.fecha ? String(logroData.fecha).substring(0, 10) : '';
  document.getElementById('logro-descripcion').value = logroData?.descripcion || '';
  document.getElementById('logro-evidencia-tipo').value = logroData?.evidencia_tipo || 'ninguno';
  document.getElementById('logro-evidencia-url').value = logroData?.evidencia_url || '';

  // Archivos existentes
  const archivosExistentes = document.getElementById('logro-archivos-existentes');
  archivosExistentes.innerHTML = '';
  const existingCount = logroData?.archivos?.length || 0;
  if (logroData && logroData.archivos && logroData.archivos.length > 0) {
    archivosExistentes.innerHTML = logroData.archivos.map(a => `
      <div class="doc-item" style="margin-bottom:4px;">
        <div class="file-icon">${getFileExtIcon(a.nombre_archivo)}</div>
        <div class="file-info">
          <div class="file-name" title="${Utils.escapeHtml(a.nombre_archivo)}">${Utils.escapeHtml(a.nombre_archivo)}</div>
          <div class="file-size">${formatFileSize(a.tamano)}</div>
        </div>
        <div class="file-actions" style="display:flex;gap:4px;">
          <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:0.7rem;" type="button" onclick="descargarHitoArchivo(${logroData.id}, ${a.id}, '${Utils.escapeHtml(a.nombre_archivo)}')">Descargar</button>
          <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:0.7rem;color:#ef4444;" type="button" onclick="eliminarLogroArchivo(${logroData.id}, ${a.id})">Eliminar</button>
        </div>
      </div>
    `).join('');
  }

  // Inicializar drop zone
  logroDropZoneInstance = inicializarDropZone({
    dropZoneId: 'logro-drop-zone',
    fileInputId: 'logro-file-input',
    fileListId: 'logro-file-list',
    maxFiles: 3,
    existingCount
  });

  document.getElementById('modal-logro').classList.add('active');
}

function cerrarModalLogro() {
  document.getElementById('modal-logro').classList.remove('active');
  editandoLogroId = null;
  logroDropZoneInstance = null;
}

async function guardarLogro() {
  try {
    const titulo = document.getElementById('logro-titulo').value.trim();
    const fecha = document.getElementById('logro-fecha').value;
    if (!titulo || !fecha) {
      Utils.showError('Título y fecha son requeridos');
      return;
    }

    const data = {
      titulo,
      fecha,
      descripcion: document.getElementById('logro-descripcion').value.trim() || null,
      evidencia_tipo: document.getElementById('logro-evidencia-tipo').value,
      evidencia_url: document.getElementById('logro-evidencia-url').value.trim() || null
    };

    let url, method;
    if (editandoLogroId) {
      url = `${CONFIG.API_URL}/gestion/hitos/${editandoLogroId}`;
      method = 'PUT';
    } else {
      url = `${CONFIG.API_URL}/gestion/logros`;
      method = 'POST';
    }

    const response = await fetch(url, { method, headers: Auth.getAuthHeaders(), body: JSON.stringify(data) });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    // Subir archivos pendientes
    const logroId = editandoLogroId || result.data.id;
    if (logroDropZoneInstance) {
      const pendingFiles = logroDropZoneInstance.getFiles();
      if (pendingFiles.length > 0) {
        await subirArchivosHito(logroId, pendingFiles);
      }
    }

    showToast(result.message || 'Logro guardado', 'success');
    cerrarModalLogro();
    await cargarTimeline();
    await cargarProyectos();
  } catch (error) {
    Utils.showError(error.message || 'Error al guardar logro');
  }
}

async function editarLogro(hitoId) {
  // Buscar el logro en timelineData
  const logro = timelineData.find(h => h.id === hitoId && !h.proyecto_id);
  if (logro) {
    abrirModalLogro(logro);
  } else {
    Utils.showError('Logro no encontrado');
  }
}

async function eliminarLogro(hitoId) {
  if (!confirm('¿Eliminar este logro?')) return;
  try {
    const response = await fetch(`${CONFIG.API_URL}/gestion/hitos/${hitoId}`, {
      method: 'DELETE',
      headers: Auth.getAuthHeaders()
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    showToast('Logro eliminado', 'success');
    await cargarTimeline();
  } catch (error) {
    Utils.showError(error.message || 'Error al eliminar logro');
  }
}

async function eliminarLogroArchivo(hitoId, archivoId) {
  if (!confirm('¿Eliminar este archivo?')) return;
  try {
    const response = await fetch(`${CONFIG.API_URL}/gestion/hitos/${hitoId}/archivos/${archivoId}`, {
      method: 'DELETE',
      headers: Auth.getAuthHeaders()
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    showToast('Archivo eliminado', 'success');
    // Recargar timeline y re-abrir modal
    await cargarTimeline();
    const logro = timelineData.find(h => h.id === hitoId && !h.proyecto_id);
    if (logro) abrirModalLogro(logro);
  } catch (error) {
    Utils.showError(error.message || 'Error al eliminar archivo');
  }
}

// =====================================================
// FILE UPLOAD - DROP ZONE
// =====================================================

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.csv', '.odt', '.ods', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.zip', '.rar', '.7z'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileExtIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    pdf: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
    jpg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
  };
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return icons.jpg;
  return icons.pdf;
}

function inicializarDropZone(config) {
  const { dropZoneId, fileInputId, fileListId, maxFiles, existingCount = 0 } = config;
  const dropZone = document.getElementById(dropZoneId);
  const fileInput = document.getElementById(fileInputId);
  const fileList = document.getElementById(fileListId);
  if (!dropZone || !fileInput || !fileList) return null;

  let pendingFiles = [];
  let currentExisting = existingCount;

  const renderPending = () => {
    fileList.innerHTML = pendingFiles.map((f, i) => `
      <div class="file-pending-item">
        <div class="file-icon">${getFileExtIcon(f.name)}</div>
        <div class="file-info">
          <div class="file-name" title="${Utils.escapeHtml(f.name)}">${Utils.escapeHtml(f.name)}</div>
          <div class="file-size">${formatFileSize(f.size)}</div>
        </div>
        <div class="file-remove">
          <button class="file-remove-btn" onclick="event.stopPropagation(); window._dropZoneRemove_${dropZoneId}(${i})" title="Quitar">&times;</button>
        </div>
      </div>
    `).join('');
  };

  const addFiles = (files) => {
    for (const file of files) {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        showToast(`Tipo no permitido: ${ext}`, 'error');
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        showToast(`${file.name} excede 10 MB`, 'error');
        continue;
      }
      if (currentExisting + pendingFiles.length >= maxFiles) {
        showToast(`Máximo ${maxFiles} archivos permitidos`, 'error');
        break;
      }
      // Evitar duplicados
      if (!pendingFiles.some(f => f.name === file.name && f.size === file.size)) {
        pendingFiles.push(file);
      }
    }
    renderPending();
  };

  // Remove handler (global para onclick)
  window[`_dropZoneRemove_${dropZoneId}`] = (index) => {
    pendingFiles.splice(index, 1);
    renderPending();
  };

  // Click to select
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    addFiles(e.target.files);
    fileInput.value = '';
  });

  // Drag & drop
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    addFiles(e.dataTransfer.files);
  });

  return {
    getFiles: () => pendingFiles,
    reset: () => { pendingFiles = []; renderPending(); },
    setExistingCount: (count) => { currentExisting = count; }
  };
}

// =====================================================
// DOCUMENTOS DE PROYECTO (upload, download, delete)
// =====================================================

async function subirDocumentosProyecto(proyectoId, files) {
  if (!files || files.length === 0) return;

  const formData = new FormData();
  for (const file of files) {
    formData.append('archivos', file);
  }

  try {
    const token = Auth.getToken();
    const response = await fetch(`${CONFIG.API_URL}/gestion/proyectos/${proyectoId}/documentos`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    showToast(result.message, 'success');
    return true;
  } catch (error) {
    Utils.showError(error.message || 'Error al subir documentos');
    return false;
  }
}

async function descargarDocumento(proyectoId, docId, nombreArchivo) {
  try {
    const token = Auth.getToken();
    const response = await fetch(`${CONFIG.API_URL}/gestion/proyectos/${proyectoId}/documentos/${docId}/descargar`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Error al descargar');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    Utils.showError(error.message || 'Error al descargar documento');
  }
}

async function eliminarDocumento(proyectoId, docId) {
  if (!confirm('¿Eliminar este documento?')) return;
  try {
    const response = await fetch(`${CONFIG.API_URL}/gestion/proyectos/${proyectoId}/documentos/${docId}`, {
      method: 'DELETE',
      headers: Auth.getAuthHeaders()
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    showToast('Documento eliminado', 'success');
    await verProyecto(proyectoId);
  } catch (error) {
    Utils.showError(error.message || 'Error al eliminar documento');
  }
}

// =====================================================
// ARCHIVOS DE HITOS (upload, download, delete)
// =====================================================

async function subirArchivosHito(hitoId, files) {
  if (!files || files.length === 0) return true;

  const formData = new FormData();
  for (const file of files) {
    formData.append('archivos', file);
  }

  try {
    const token = Auth.getToken();
    const response = await fetch(`${CONFIG.API_URL}/gestion/hitos/${hitoId}/archivos`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    showToast(result.message, 'success');
    return true;
  } catch (error) {
    Utils.showError(error.message || 'Error al subir archivos');
    return false;
  }
}

async function descargarHitoArchivo(hitoId, archivoId, nombreArchivo) {
  try {
    const token = Auth.getToken();
    const response = await fetch(`${CONFIG.API_URL}/gestion/hitos/${hitoId}/archivos/${archivoId}/descargar`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Error al descargar');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    Utils.showError(error.message || 'Error al descargar archivo');
  }
}

async function eliminarHitoArchivo(hitoId, archivoId, proyectoId) {
  if (!confirm('¿Eliminar este archivo?')) return;
  try {
    const response = await fetch(`${CONFIG.API_URL}/gestion/hitos/${hitoId}/archivos/${archivoId}`, {
      method: 'DELETE',
      headers: Auth.getAuthHeaders()
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    showToast('Archivo eliminado', 'success');
    await verProyecto(proyectoId);
  } catch (error) {
    Utils.showError(error.message || 'Error al eliminar archivo');
  }
}

// =====================================================
// PREVIEW DE ARCHIVOS (Modal Lightbox)
// =====================================================

async function previewArchivo(hitoId, archivoId, nombre, tamano, mimeType) {
  const modal = document.getElementById('modal-preview-archivo');
  const body = document.getElementById('modal-preview-body');
  const footer = document.getElementById('modal-preview-footer');
  const titulo = document.getElementById('modal-preview-nombre');

  titulo.textContent = nombre;
  body.innerHTML = '<p style="color:var(--gray-500);">Cargando...</p>';

  const ext = nombre.split('.').pop().toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  const isPDF = ext === 'pdf';

  footer.innerHTML = `
    <span style="font-size:0.8rem;color:var(--gray-500);">${formatFileSize(tamano)} &middot; ${ext.toUpperCase()}</span>
    <button class="btn btn-primary btn-sm" onclick="descargarHitoArchivo(${hitoId}, ${archivoId}, '${Utils.escapeHtml(nombre)}')">
      ${Icons.download.replace(/width="\d+"/, 'width="16"').replace(/height="\d+"/, 'height="16"')} Descargar
    </button>`;

  modal.classList.add('active');

  if (isImage || isPDF) {
    try {
      const token = Auth.getToken();
      const response = await fetch(`${CONFIG.API_URL}/gestion/hitos/${hitoId}/archivos/${archivoId}/descargar`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al cargar archivo');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (isImage) {
        body.innerHTML = `<img src="${url}" alt="${Utils.escapeHtml(nombre)}" style="max-width:100%;max-height:70vh;border-radius:8px;">`;
      } else {
        body.innerHTML = `<iframe src="${url}" style="width:100%;height:70vh;border:none;border-radius:4px;"></iframe>`;
      }
      body.dataset.blobUrl = url;
    } catch (error) {
      body.innerHTML = `<div class="preview-placeholder">
        ${Icons.fileText.replace(/width="\d+"/, 'width="64"').replace(/height="\d+"/, 'height="64"')}
        <p style="font-weight:600;">${Utils.escapeHtml(nombre)}</p>
        <p>Error al cargar vista previa</p>
      </div>`;
    }
  } else {
    body.innerHTML = `<div class="preview-placeholder">
      ${Icons.fileText.replace(/width="\d+"/, 'width="64"').replace(/height="\d+"/, 'height="64"')}
      <p style="font-weight:600;font-size:1.1rem;">${Utils.escapeHtml(nombre)}</p>
      <p>${formatFileSize(tamano)} &middot; ${ext.toUpperCase()}</p>
      <p style="margin-top:12px;color:var(--gray-400);">Vista previa no disponible para este tipo de archivo</p>
    </div>`;
  }
}

async function previewDocumentoProyecto(proyectoId, docId, nombre, tamano, mimeType) {
  const modal = document.getElementById('modal-preview-archivo');
  const body = document.getElementById('modal-preview-body');
  const footer = document.getElementById('modal-preview-footer');
  const titulo = document.getElementById('modal-preview-nombre');

  titulo.textContent = nombre;
  body.innerHTML = '<p style="color:var(--gray-500);">Cargando...</p>';

  const ext = nombre.split('.').pop().toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  const isPDF = ext === 'pdf';

  footer.innerHTML = `
    <span style="font-size:0.8rem;color:var(--gray-500);">${formatFileSize(tamano)} &middot; ${ext.toUpperCase()}</span>
    <button class="btn btn-primary btn-sm" onclick="descargarDocumento(${proyectoId}, ${docId}, '${Utils.escapeHtml(nombre)}')">
      ${Icons.download.replace(/width="\d+"/, 'width="16"').replace(/height="\d+"/, 'height="16"')} Descargar
    </button>`;

  modal.classList.add('active');

  if (isImage || isPDF) {
    try {
      const token = Auth.getToken();
      const response = await fetch(`${CONFIG.API_URL}/gestion/proyectos/${proyectoId}/documentos/${docId}/descargar`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al cargar archivo');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (isImage) {
        body.innerHTML = `<img src="${url}" alt="${Utils.escapeHtml(nombre)}" style="max-width:100%;max-height:70vh;border-radius:8px;">`;
      } else {
        body.innerHTML = `<iframe src="${url}" style="width:100%;height:70vh;border:none;border-radius:4px;"></iframe>`;
      }
      body.dataset.blobUrl = url;
    } catch (error) {
      body.innerHTML = `<div class="preview-placeholder">
        ${Icons.fileText.replace(/width="\d+"/, 'width="64"').replace(/height="\d+"/, 'height="64"')}
        <p style="font-weight:600;">${Utils.escapeHtml(nombre)}</p>
        <p>Error al cargar vista previa</p>
      </div>`;
    }
  } else {
    body.innerHTML = `<div class="preview-placeholder">
      ${Icons.fileText.replace(/width="\d+"/, 'width="64"').replace(/height="\d+"/, 'height="64"')}
      <p style="font-weight:600;font-size:1.1rem;">${Utils.escapeHtml(nombre)}</p>
      <p>${formatFileSize(tamano)} &middot; ${ext.toUpperCase()}</p>
      <p style="margin-top:12px;color:var(--gray-400);">Vista previa no disponible para este tipo de archivo</p>
    </div>`;
  }
}

function cerrarPreviewArchivo() {
  const modal = document.getElementById('modal-preview-archivo');
  const body = document.getElementById('modal-preview-body');

  // Limpiar blob URL
  if (body.dataset.blobUrl) {
    URL.revokeObjectURL(body.dataset.blobUrl);
    delete body.dataset.blobUrl;
  }

  body.innerHTML = '';
  modal.classList.remove('active');
}

