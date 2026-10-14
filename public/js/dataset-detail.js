// Dataset Detail - Lógica
document.addEventListener('DOMContentLoaded', async () => {
  await loadDataset();
});

async function loadDataset() {
  const params = Utils.getUrlParams();
  const id = params.id;

  if (!id) {
    showNotFound();
    return;
  }

  try {
    const dataset = await API.getDataset(id);
    
    if (!dataset) {
      showNotFound();
      return;
    }

    renderDataset(dataset);
  } catch (error) {
    console.error('Error cargando dataset:', error);
    showNotFound();
  }
}

function showNotFound() {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('dataset-content').classList.add('hidden');
  document.getElementById('not-found').classList.remove('hidden');
}

function renderDataset(d) {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('dataset-content').classList.remove('hidden');

  // Título
  document.title = `${d.titulo} - RPAD`;
  document.getElementById('breadcrumb-title').textContent = d.titulo;
  document.getElementById('dataset-titulo').textContent = d.titulo;
  document.getElementById('dataset-area').textContent = d.area_nombre || 'Sin área asignada';

  // Estado - usar etiqueta larga en el detalle
  const estado = Utils.calcularEstado(d.proxima_actualizacion, d.frecuencia_dias, d.tipo_gestion);
  const estadoEl = document.getElementById('dataset-estado');
  estadoEl.textContent = Utils.getEstadoTextoLargo(estado);
  estadoEl.className = `badge ${Utils.getEstadoClase(estado)}`;

  // Temas - usar nombres correctos del backend
  const temasContainer = document.getElementById('dataset-temas');
  const temas = [];
  if (d.tema_principal_nombre) temas.push(d.tema_principal_nombre);
  if (d.tema_secundario_nombre) temas.push(d.tema_secundario_nombre);
  temasContainer.innerHTML = temas.map(t => `<span class="tema-tag">${Utils.escapeHtml(t)}</span>`).join('');

  // Descripción
  document.getElementById('dataset-descripcion').textContent = d.descripcion || 'Sin descripción disponible';

  // Qué se solicita (textContent: es texto cargado por los administradores)
  if (d.que_se_solicita) {
    document.getElementById('que-se-solicita-card').classList.remove('hidden');
    document.getElementById('dataset-que-se-solicita').textContent = d.que_se_solicita;
  }

  // Observaciones
  if (d.observaciones) {
    document.getElementById('observaciones-card').classList.remove('hidden');
    document.getElementById('dataset-observaciones').textContent = d.observaciones;
  }

  // URL - el backend usa url_dataset (solo http/https: un javascript: se ejecutaría al hacer click)
  if (Utils.esUrlSegura(d.url_dataset)) {
    document.getElementById('url-card').classList.remove('hidden');
    document.getElementById('dataset-url').href = d.url_dataset.trim();
  }

  // Fechas
  document.getElementById('fecha-ultima').textContent = Utils.formatDate(d.ultima_actualizacion);
  
  const proximaEl = document.getElementById('fecha-proxima');
  if (d.frecuencia_dias === null) {
    proximaEl.textContent = 'Eventual';
  } else {
    proximaEl.textContent = Utils.formatDate(d.proxima_actualizacion);
  }

  // Info técnica
  document.getElementById('info-frecuencia').textContent = d.frecuencia_nombre || '-';
  
  // Formatos vienen como string concatenado desde el backend
  document.getElementById('info-formatos').textContent = d.formatos || '-';
  
  // Tipo de gestión
  document.getElementById('info-tipo-gestion').textContent = Utils.getTipoGestionTexto(d.tipo_gestion);
}

// ====================
// FUNCIONES AUXILIARES
// ====================

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return { id: params.get('id') };
}

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
  const fechaStr = proximaActualizacion.split('T')[0];
  const [year, month, day] = fechaStr.split('-').map(Number);

  const hoyUTC = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const proximaUTC = Date.UTC(year, month - 1, day);
  const diffDias = Math.round((proximaUTC - hoyUTC) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    return tipoGestion === 'interna' ? 'atrasado' : 'sin-respuesta';
  } else if (diffDias <= 60) {
    return 'proximo';
  }
  return 'actualizado';
}

function getEstadoTextoLargo(estado) {
  const textos = {
    'actualizado': 'Actualizado',
    'proximo': 'Próximo a vencer',
    'atrasado': 'Atrasado',
    'sin-respuesta': 'Sin respuesta',
    'eventual': 'Actualización eventual'
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
