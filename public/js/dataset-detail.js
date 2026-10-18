// Dataset Detail - Lógica
// Al cargarse solo declara y registra su DOMContentLoaded: lo que arma los textos y el HTML es puro (filasDeFechas,
// htmlDeFechas...) y tests/publico-frontend.test.js lo carga en un vm. El estado es el que manda el servidor (d.estado) y
// las fechas se leen por su texto, con Utils (api.js): nunca con new Date (spec 2026-10-17-fechas-datasets, 11)
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

  // Estado (el del servidor) - usar etiqueta larga en el detalle
  const estado = Utils.estadoDe(d);
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

  // Fechas: "Datos al", "Cargado en el portal" y "Próxima actualización prevista"
  document.getElementById('dataset-fechas').innerHTML = htmlDeFechas(d);

  // Info técnica
  document.getElementById('info-frecuencia').textContent = d.frecuencia_nombre || '-';

  // Formatos vienen como string concatenado desde el backend
  document.getElementById('info-formatos').textContent = d.formatos || '-';

  // Tipo de gestión
  document.getElementById('info-tipo-gestion').textContent = Utils.getTipoGestionTexto(d.tipo_gestion);
}

// ====================
// FECHAS (puras)
// ====================

// "Datos al": dd/mm/aaaa; "Ejercicio aaaa" en un presupuesto; "Relevamiento de {mes} {año}" en un relevamiento; "—" sin dato
function textoDatosAl(d) {
  const fecha = Utils.soloFecha(d?.datos_al);
  if (!fecha) return Utils.SIN_DATO;
  if (d.tipo_pedido === 'ejercicio') return `Ejercicio ${fecha.slice(0, 4)}`;
  if (d.tipo_pedido === 'relevamiento') return `Relevamiento de ${Utils.nombreDeMes(Number(fecha.slice(5, 7)))} ${fecha.slice(0, 4)}`;
  return Utils.fechaCorta(fecha);
}

// "Cargado en el portal": dd/mm/aaaa (ultima_actualizacion es el día de la carga, no la fecha de los datos), o "—"
function textoCargadoEnElPortal(d) {
  return Utils.fechaCorta(d?.ultima_actualizacion);
}

// "Próxima actualización prevista": "{mes} de {año}", "Eventual", o "—" si no tiene fecha
function textoProximaPrevista(d) {
  if (Utils.estadoDe(d) === 'eventual') return 'Eventual';
  return Utils.mesDeAnio(d?.proxima_actualizacion);
}

function filasDeFechas(d) {
  return [
    { rotulo: 'Datos al', valor: textoDatosAl(d) },
    { rotulo: 'Cargado en el portal', valor: textoCargadoEnElPortal(d) },
    { rotulo: 'Próxima actualización prevista', valor: textoProximaPrevista(d) }
  ];
}

function htmlDeFechas(d) {
  return filasDeFechas(d).map(({ rotulo, valor }) => `
    <div class="info-row">
      <span class="info-label">${Utils.escapeHtml(rotulo)}</span>
      <span class="info-value">${Utils.escapeHtml(valor)}</span>
    </div>`).join('');
}
