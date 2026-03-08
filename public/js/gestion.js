/**
 * RPAD - Gestión (Métricas y Proyectos)
 */

let chartActualizados = null;
let chartNotificaciones = null;
let chartTemas = null;
let chartFrecuencias = null;
let editandoProyectoId = null;
let editandoHitoId = null;
let proyectoDetalleId = null;
let vistaActual = 'lista';
let hitoDropZoneInstance = null;

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
    const btnNuevo = document.getElementById('btn-nuevo-proyecto');
    if (btnNuevo) btnNuevo.style.display = '';
  }

  // Setear año/mes actuales en el form de métricas manuales
  const now = new Date();
  const anioInput = document.getElementById('metrica-anio');
  const mesSelect = document.getElementById('metrica-mes');
  if (anioInput) anioInput.value = now.getFullYear();
  if (mesSelect) mesSelect.value = now.getMonth() + 1;

  await cargarMetricas();
  await cargarAreasSelect();
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
  const container = document.getElementById('proyectos-lista');
  if (!container) return;

  if (proyectos.length === 0) {
    container.innerHTML = '<p style="color:var(--gray-500);text-align:center;padding:40px;">No hay proyectos registrados</p>';
    return;
  }

  // Agrupar por categoría
  const grupos = {};
  for (const p of proyectos) {
    if (!grupos[p.categoria]) grupos[p.categoria] = [];
    grupos[p.categoria].push(p);
  }

  const orden = ['tecnologia', 'normativa', 'difusion'];
  let html = '';

  for (const cat of orden) {
    if (!grupos[cat]) continue;
    html += `<div class="categoria-header">${CATEGORIA_LABELS[cat]}</div>`;
    html += '<div class="proyectos-grid">';
    for (const p of grupos[cat]) {
      html += `
        <div class="proyecto-card" onclick="verProyecto(${p.id})">
          <div class="proyecto-card-top" style="background:${Utils.escapeHtml(p.color || '#3b82f6')}"></div>
          <div class="proyecto-card-body">
            <div class="proyecto-card-header">
              <h4>${Utils.escapeHtml(p.nombre)}</h4>
            </div>
            ${p.descripcion ? `<p>${Utils.escapeHtml(Utils.truncate(p.descripcion, 100))}</p>` : ''}
            <div class="proyecto-meta">
              <span class="badge badge-estado-${p.estado}">${ESTADO_LABELS[p.estado] || p.estado}</span>
              <span class="badge badge-prioridad-${p.prioridad}">${PRIORIDAD_LABELS[p.prioridad] || p.prioridad}</span>
              <span class="badge badge-hitos">${p.cantidad_hitos || 0} hitos</span>
            </div>
          </div>
        </div>`;
    }
    html += '</div>';
  }

  container.innerHTML = html;
}

async function cargarTimeline() {
  try {
    const response = await fetch(`${CONFIG.API_URL}/gestion/timeline`, {
      headers: Auth.getAuthHeaders(),
      cache: 'no-store'
    });
    const result = await response.json();
    if (!result.success) return;

    renderTimeline(result.data);
  } catch (error) {
    console.error('Error cargando timeline:', error);
  }
}

function renderTimeline(hitos) {
  const container = document.getElementById('proyectos-timeline');
  if (!container) return;

  if (hitos.length === 0) {
    container.innerHTML = '<p style="color:var(--gray-500);text-align:center;padding:40px;">No hay hitos registrados</p>';
    return;
  }

  let html = '<div class="timeline">';
  for (const h of hitos) {
    const color = h.proyecto_color || '#3b82f6';
    html += `
      <div class="timeline-item">
        <style>.timeline-item::before { background: ${color} !important; }</style>
        <div class="timeline-date">${formatDate(h.fecha)}</div>
        <div class="timeline-title">${Utils.escapeHtml(h.titulo)}</div>
        <div class="timeline-proyecto">${Utils.escapeHtml(h.proyecto_nombre)} - ${CATEGORIA_LABELS[h.categoria] || h.categoria}</div>
        ${h.descripcion ? `<div class="timeline-desc">${Utils.escapeHtml(h.descripcion)}</div>` : ''}
      </div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

function setVistaProyectos(vista) {
  vistaActual = vista;
  document.querySelectorAll('.vista-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.vista-btn[onclick*="${vista}"]`).classList.add('active');

  const lista = document.getElementById('proyectos-lista');
  const timeline = document.getElementById('proyectos-timeline');
  const detalle = document.getElementById('proyecto-detalle');

  if (vista === 'lista') {
    lista.style.display = '';
    timeline.style.display = 'none';
    if (detalle) detalle.style.display = 'none';
  } else {
    lista.style.display = 'none';
    timeline.style.display = '';
    if (detalle) detalle.style.display = 'none';
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

  lista.style.display = 'none';
  timeline.style.display = 'none';
  container.style.display = '';

  const isAdmin = Auth.isAdmin();
  const areasText = p.areas && p.areas.length > 0 ? p.areas.map(a => a.nombre).join(', ') : '-';

  let html = `
    <div class="detail-panel">
      <div class="detail-header">
        <h2 style="display:flex;align-items:center;gap:8px;">
          <span style="width:12px;height:12px;border-radius:50%;background:${Utils.escapeHtml(p.color || '#3b82f6')};display:inline-block;"></span>
          ${Utils.escapeHtml(p.nombre)}
        </h2>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="volverALista()">Volver</button>
          ${isAdmin ? `
            <button class="btn btn-primary btn-sm" onclick="editarProyecto(${p.id})">Editar</button>
            <button class="btn btn-secondary btn-sm" style="color:#ef4444;" onclick="eliminarProyecto(${p.id})">Eliminar</button>
          ` : ''}
        </div>
      </div>
      ${p.descripcion ? `<p style="color:var(--gray-600);margin-bottom:16px;">${Utils.escapeHtml(p.descripcion)}</p>` : ''}
      <div class="detail-info">
        <div class="detail-field"><label>Estado</label><span class="badge badge-estado-${p.estado}">${ESTADO_LABELS[p.estado]}</span></div>
        <div class="detail-field"><label>Prioridad</label><span class="badge badge-prioridad-${p.prioridad}">${PRIORIDAD_LABELS[p.prioridad]}</span></div>
        <div class="detail-field"><label>Categoría</label><span>${CATEGORIA_LABELS[p.categoria]}</span></div>
        <div class="detail-field"><label>Fecha inicio</label><span>${formatDate(p.fecha_inicio)}</span></div>
        <div class="detail-field"><label>Responsable</label><span>${Utils.escapeHtml(p.responsable || '-')}</span></div>
        <div class="detail-field"><label>Áreas</label><span>${Utils.escapeHtml(areasText)}</span></div>
        ${p.enlace_externo ? `<div class="detail-field"><label>Enlace</label><span><a href="${Utils.escapeHtml(p.enlace_externo)}" target="_blank">${Utils.escapeHtml(Utils.truncate(p.enlace_externo, 50))}</a></span></div>` : ''}
      </div>
    </div>

    <!-- Panel de Documentos -->
    <div class="detail-panel">
      <div class="detail-header">
        <h3 style="margin:0;">Documentos</h3>
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

  // Documentos existentes
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
          <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:0.75rem;" onclick="descargarDocumento(${p.id}, ${doc.id}, '${Utils.escapeHtml(doc.nombre_archivo)}')">Descargar</button>
          ${isAdmin ? `<button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:0.75rem;color:#ef4444;" onclick="eliminarDocumento(${p.id}, ${doc.id})">Eliminar</button>` : ''}
        </div>
      </div>`;
    }
  } else {
    html += '<p style="color:var(--gray-500);font-size:0.85rem;">No hay documentos adjuntos</p>';
  }

  html += `</div>

    <div class="detail-panel">
      <div class="detail-header">
        <h3 style="margin:0;">Hitos</h3>
        ${isAdmin ? `<button class="btn btn-primary btn-sm" onclick="abrirModalHito(${p.id})">Nuevo Hito</button>` : ''}
      </div>`;

  if (p.hitos && p.hitos.length > 0) {
    html += '<div class="timeline">';
    for (const h of p.hitos) {
      html += `
        <div class="timeline-item" style="border-left: 3px solid ${Utils.escapeHtml(p.color || '#3b82f6')};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div class="timeline-date">${formatDate(h.fecha)}</div>
              <div class="timeline-title">${Utils.escapeHtml(h.titulo)}</div>
              ${h.descripcion ? `<div class="timeline-desc">${Utils.escapeHtml(h.descripcion)}</div>` : ''}
              ${h.evidencia_url ? `<a href="${Utils.escapeHtml(h.evidencia_url)}" target="_blank" style="font-size:0.8rem;margin-top:4px;display:inline-block;">Ver evidencia</a>` : ''}
              ${h.archivos && h.archivos.length > 0 ? `
                <div style="margin-top:8px;">
                  ${h.archivos.map(a => `
                    <div class="doc-item" style="margin-bottom:4px;">
                      <div class="file-icon">${getFileExtIcon(a.nombre_archivo)}</div>
                      <div class="file-info">
                        <div class="file-name" title="${Utils.escapeHtml(a.nombre_archivo)}">${Utils.escapeHtml(a.nombre_archivo)}</div>
                        <div class="file-size">${formatFileSize(a.tamano)}</div>
                      </div>
                      <div class="file-actions" style="display:flex;gap:4px;">
                        <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:0.7rem;" onclick="descargarHitoArchivo(${h.id}, ${a.id}, '${Utils.escapeHtml(a.nombre_archivo)}')">Descargar</button>
                        ${isAdmin ? `<button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:0.7rem;color:#ef4444;" onclick="eliminarHitoArchivo(${h.id}, ${a.id}, ${p.id})">Eliminar</button>` : ''}
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
            ${isAdmin ? `
              <div style="display:flex;gap:4px;">
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

  html += '</div>';
  container.innerHTML = html;
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
  document.getElementById('proy-color').value = proyectoData?.color || '#3b82f6';
  document.getElementById('proy-enlace').value = proyectoData?.enlace_externo || '';

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
