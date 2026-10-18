// Calendario - Lógica del calendario de vencimientos
// Al cargarse solo declara y registra sus eventos: el color de cada día y el HTML del detalle son puros y
// tests/publico-frontend.test.js los carga en un vm. El estado es el que manda el servidor (d.estado, spec
// 2026-10-17-fechas-datasets, 11)
let calendar = null;
let datasets = [];
let areas = [];
let temas = [];

document.addEventListener('DOMContentLoaded', async () => {
  // El header ahora se maneja desde main.js
  
  // Cargar datos
  await cargarDatos();
  
  // Inicializar calendario
  inicializarCalendario();
  
  // Setup filtros
  setupFiltros();
});

async function cargarDatos() {
  try {
    [datasets, areas, temas] = await Promise.all([
      API.getDatasets(),
      API.getAreas(),
      API.getTemas()
    ]);
    
    // Llenar filtros
    llenarFiltros();
  } catch (error) {
    console.error('Error cargando datos:', error);
    if (typeof showToast === 'function') {
      showToast('Error al cargar los datos', 'error');
    }
  }
}

function llenarFiltros() {
  // Filtro de áreas
  const areaSelect = document.getElementById('filter-area');
  areas.forEach(a => {
    const option = document.createElement('option');
    option.value = a.id;
    option.textContent = a.nombre;
    areaSelect.appendChild(option);
  });
  
  // Filtro de temas
  const temaSelect = document.getElementById('filter-tema');
  temas.forEach(t => {
    const option = document.createElement('option');
    option.value = t.id;
    option.textContent = t.nombre;
    temaSelect.appendChild(option);
  });
}

function setupFiltros() {
  document.getElementById('filter-area').addEventListener('change', aplicarFiltros);
  document.getElementById('filter-tema').addEventListener('change', aplicarFiltros);
}

function limpiarFiltros() {
  document.getElementById('filter-area').value = '';
  document.getElementById('filter-tema').value = '';
  aplicarFiltros();
}

function aplicarFiltros() {
  const eventos = generarEventos(obtenerDatasetsFiltrados());
  calendar.removeAllEvents();
  calendar.addEventSource(eventos);
}

function obtenerDatasetsFiltrados() {
  const areaId = document.getElementById('filter-area').value;
  const temaId = document.getElementById('filter-tema').value;
  
  return datasets.filter(d => {
    if (areaId && d.area_id != areaId) return false;
    if (temaId && d.tema_principal_id != temaId) return false;
    return true;
  });
}

function inicializarCalendario() {
  const calendarEl = document.getElementById('calendar');
  
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: ''
    },
    buttonText: {
      today: 'Hoy'
    },
    height: 'auto',
    events: generarEventos(datasets),
    eventClick: function(info) {
      mostrarModalDia(info.event.startStr, info.event.extendedProps.datasets);
    },
    eventDidMount: function(info) {
      // Tooltip con cantidad
      const count = info.event.extendedProps.count;
      if (count > 1) {
        info.el.title = `${count} datasets`;
      }
    },
    dayCellDidMount: function(info) {
      // Agregar indicador de cantidad si hay eventos
      const dateStr = formatearFecha(info.date);
      const eventosDelDia = obtenerEventosDelDia(dateStr);
      if (eventosDelDia.length > 0) {
        info.el.style.cursor = 'pointer';
      }
    },
    dateClick: function(info) {
      const eventosDelDia = obtenerEventosDelDia(info.dateStr);
      if (eventosDelDia.length > 0) {
        mostrarModalDia(info.dateStr, eventosDelDia);
      }
    }
  });
  
  calendar.render();
}

function generarEventos(datasetsList) {
  // Agrupar datasets por fecha de vencimiento
  const eventosPorFecha = {};
  
  datasetsList.forEach(d => {
    if (!d.proxima_actualizacion) return;
    
    const fecha = d.proxima_actualizacion.split('T')[0];
    if (!eventosPorFecha[fecha]) {
      eventosPorFecha[fecha] = [];
    }
    eventosPorFecha[fecha].push(d);
  });
  
  // Convertir a eventos de FullCalendar
  const eventos = [];
  
  Object.keys(eventosPorFecha).forEach(fecha => {
    const datasetsDelDia = eventosPorFecha[fecha];
    const count = datasetsDelDia.length;
    
    // Determinar color predominante
    const color = determinarColorEvento(datasetsDelDia);
    
    eventos.push({
      title: count === 1 ? datasetsDelDia[0].titulo : `${count} datasets`,
      start: fecha,
      backgroundColor: color,
      borderColor: color,
      textColor: '#fff',
      extendedProps: {
        datasets: datasetsDelDia,
        count: count
      }
    });
  });
  
  return eventos;
}

function determinarColorEvento(datasetsDelDia) {
  // Si hay al menos uno vencido, rojo
  // Si hay al menos uno próximo, amarillo
  // Si todos están actualizados, verde
  
  let tieneVencido = false;
  let tieneProximo = false;
  
  datasetsDelDia.forEach(d => {
    const estado = Utils.estadoDe(d);
    if (estado === 'sin-respuesta' || estado === 'atrasado') {
      tieneVencido = true;
    } else if (estado === 'proximo') {
      tieneProximo = true;
    }
  });
  
  if (tieneVencido) return '#ef4444'; // Rojo
  if (tieneProximo) return '#f59e0b'; // Amarillo
  return '#22c55e'; // Verde
}

function obtenerEventosDelDia(fechaStr) {
  const datasetsFiltrados = obtenerDatasetsFiltrados();
  return datasetsFiltrados.filter(d => {
    if (!d.proxima_actualizacion) return false;
    return d.proxima_actualizacion.split('T')[0] === fechaStr;
  });
}

function formatearFecha(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mostrarModalDia(fecha, datasetsDelDia) {
  const fechaFormateada = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  document.getElementById('modal-dia-titulo').textContent = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
  
  const contenido = document.getElementById('modal-dia-contenido');
  
  contenido.innerHTML = htmlDelDia(datasetsDelDia);
  document.getElementById('modal-dia').classList.add('active');
}

// El detalle de un día: cada dataset con su estado, su área y su frecuencia
function htmlDelDia(datasetsDelDia) {
  if (!datasetsDelDia || datasetsDelDia.length === 0) {
    return '<p class="text-muted text-center">No hay datasets para este día.</p>';
  }
  return datasetsDelDia.map(d => {
    const estado = Utils.estadoDe(d);
    return `
        <div class="modal-dia-item">
          <div class="modal-dia-item-header">
            <a href="dataset.html?id=${encodeURIComponent(d.id)}" class="modal-dia-item-titulo">${Utils.escapeHtml(d.titulo)}</a>
            <span class="badge ${getBadgeClass(estado)}">${Utils.escapeHtml(getEstadoTexto(estado))}</span>
          </div>
          <div class="modal-dia-item-meta">
            <span>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline; vertical-align: middle;"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>
              ${Utils.escapeHtml(d.area_nombre || '-')}
            </span>
            <span>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline; vertical-align: middle;"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
              ${Utils.escapeHtml(d.frecuencia_nombre || '-')}
            </span>
          </div>
        </div>
      `;
  }).join('');
}

function cerrarModalDia() {
  document.getElementById('modal-dia').classList.remove('active');
}

function getBadgeClass(estado) {
  const clases = {
    'actualizado': 'badge-success',
    'proximo': 'badge-warning',
    'atrasado': 'badge-danger',
    'sin-respuesta': 'badge-sin-respuesta',
    'eventual': 'badge-secondary'
  };
  return clases[estado] || 'badge-secondary';
}

function getEstadoTexto(estado) {
  const textos = {
    'actualizado': 'Actualizado',
    'proximo': 'Próximo',
    'atrasado': 'Atrasado',
    'sin-respuesta': 'Sin respuesta',
    'sin-fecha': 'Sin fecha',
    'eventual': 'Eventual'
  };
  return textos[estado] || estado;
}

// =====================================================
// EXPORTAR iCAL
// =====================================================

function exportarIcal() {
  const datasetsFiltrados = obtenerDatasetsFiltrados();
  const datasetsConFecha = datasetsFiltrados.filter(d => d.proxima_actualizacion);
  
  if (datasetsConFecha.length === 0) {
    if (typeof showToast === 'function') {
      showToast('No hay datasets con fecha de vencimiento para exportar', 'warning');
    }
    return;
  }
  
  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RPAD//Calendario de Vencimientos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:RPAD - Vencimientos de Datasets',
    'X-WR-TIMEZONE:America/Argentina/Buenos_Aires'
  ];
  
  datasetsConFecha.forEach(d => {
    const fecha = d.proxima_actualizacion.split('T')[0].replace(/-/g, '');
    const uid = `dataset-${d.id}@rpad.comodoro.gov.ar`;
    const ahora = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    ical.push('BEGIN:VEVENT');
    ical.push(`UID:${uid}`);
    ical.push(`DTSTAMP:${ahora}`);
    ical.push(`DTSTART;VALUE=DATE:${fecha}`);
    ical.push(`DTEND;VALUE=DATE:${fecha}`);
    ical.push(`SUMMARY:📊 ${limpiarTextoIcal(d.titulo)}`);
    ical.push(`DESCRIPTION:Dataset: ${limpiarTextoIcal(d.titulo)}\\nÁrea: ${limpiarTextoIcal(d.area_nombre || '-')}\\nFrecuencia: ${limpiarTextoIcal(d.frecuencia_nombre || '-')}\\nURL: ${d.url_dataset || '-'}`);
    ical.push(`CATEGORIES:RPAD,Dataset,${d.tipo_gestion === 'interna' ? 'Gestión Interna' : 'Gestión Externa'}`);
    ical.push('STATUS:CONFIRMED');
    ical.push('END:VEVENT');
  });
  
  ical.push('END:VCALENDAR');
  
  // Descargar archivo
  const blob = new Blob([ical.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rpad-vencimientos-${Utils.hoyEnArgentina()}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  if (typeof showToast === 'function') {
    showToast(`Exportados ${datasetsConFecha.length} eventos al calendario`, 'success');
  }
}

function limpiarTextoIcal(texto) {
  if (!texto) return '';
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

// Cerrar modal con Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    cerrarModalDia();
  }
});

// Cerrar modal al hacer clic fuera
document.getElementById('modal-dia')?.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    cerrarModalDia();
  }
});
