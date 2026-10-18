// Dataset Detail - Lógica
// Al cargarse solo declara y registra su DOMContentLoaded: lo que arma los textos y el HTML es puro (filasDeFechas,
// htmlDeFechas, htmlDeTemas, filasTecnicas...) y tests/publico-frontend.test.js lo carga en un vm. El estado es el que manda el
// servidor (d.estado) y las fechas se leen por su texto, con Utils (api.js): nunca con new Date (spec 2026-10-17-fechas-datasets,
// 11). La página: spec 2026-10-18-rediseno-publico, 8
document.addEventListener('DOMContentLoaded', async () => {
  await loadDataset();
});

// GET /datasets/{id} con API.pedirJson, que tira un Error con .status si el servidor responde con un error: así un 404 ("no
// encontrado") se distingue de una caída (el aviso de error). El id va codificado: ?id=estadisticas pide
// /datasets/estadisticas, que responde 200 con otra cosa, y por eso también se mira que lo que llega sea un dataset
async function loadDataset() {
  const id = Utils.getUrlParams().id;
  if (!id) {
    showNotFound();
    return;
  }

  let dataset;
  try {
    dataset = (await API.pedirJson('GET', `/datasets/${encodeURIComponent(id)}`))?.data;
  } catch (error) {
    if (error?.status === 404) {
      showNotFound();
      return;
    }
    console.error('Error cargando el dataset:', error);
    showError();
    return;
  }

  if (!esDataset(dataset)) {
    showNotFound();
    return;
  }
  renderDataset(dataset);
}

// Lo que llega es un dataset (un objeto con su id y su título), no las estadísticas ni otra respuesta
function esDataset(d) {
  return Boolean(d) && typeof d === 'object' && d.id !== undefined && d.id !== null && typeof d.titulo === 'string';
}

// Los cuatro estados de la página: cargando, el dataset, no encontrado y el error. Solo se ve uno
function mostrarEstado(visibles) {
  for (const id of ['loading', 'dataset-cabeza', 'url-card', 'dataset-content', 'not-found', 'dataset-error']) {
    document.getElementById(id)?.classList.toggle('hidden', !visibles.includes(id));
  }
}

function showNotFound() {
  mostrarEstado(['not-found']);
  document.title = 'Conjunto de datos no encontrado - RPAD';
  ponerTexto('breadcrumb-title', 'No encontrado');
}

function showError() {
  mostrarEstado(['dataset-error']);
}

function ponerTexto(id, texto) {
  const elemento = document.getElementById(id);
  if (elemento) elemento.textContent = texto;
}

function renderDataset(d) {
  // El link al portal solo si la URL es http/https: un javascript: se ejecutaría al hacer clic
  const conPortal = Utils.esUrlSegura(d.url_dataset);
  mostrarEstado(conPortal ? ['dataset-cabeza', 'url-card', 'dataset-content'] : ['dataset-cabeza', 'dataset-content']);
  if (conPortal) document.getElementById('dataset-url').href = d.url_dataset.trim();

  // Título
  document.title = `${d.titulo} - RPAD`;
  ponerTexto('breadcrumb-title', d.titulo);
  ponerTexto('dataset-titulo', d.titulo);
  // El área va en su <span>: el <p> lleva también el ícono
  ponerTexto('dataset-area-text', d.area_nombre || 'Sin área asignada');

  // Estado (el del servidor), con la etiqueta larga
  const estado = Utils.estadoDe(d);
  const estadoEl = document.getElementById('dataset-estado');
  estadoEl.textContent = Utils.getEstadoTextoLargo(estado);
  estadoEl.className = `badge ${Utils.getEstadoClase(estado)}`;

  document.getElementById('dataset-temas').innerHTML = htmlDeTemas(d);

  // Los textos largos, con textContent (son textos cargados por los administradores); el CSS respeta los saltos de línea.
  // Qué se solicita y Observaciones, solo si tienen algo
  ponerTexto('dataset-descripcion', d.descripcion || 'Sin descripción disponible');
  document.getElementById('que-se-solicita-card').classList.toggle('hidden', !d.que_se_solicita);
  ponerTexto('dataset-que-se-solicita', d.que_se_solicita || '');
  document.getElementById('observaciones-card').classList.toggle('hidden', !d.observaciones);
  ponerTexto('dataset-observaciones', d.observaciones || '');

  // Fechas: "Datos al", "Cargado en el portal" y "Próxima actualización prevista"
  document.getElementById('dataset-fechas').innerHTML = htmlDeFechas(d);

  // Información técnica, en el orden de filasTecnicas
  const [frecuencia, formatos, gestion] = filasTecnicas(d);
  ponerTexto('info-frecuencia', frecuencia.valor);
  ponerTexto('info-formatos', formatos.valor);
  ponerTexto('info-tipo-gestion', gestion.valor);
}

// ====================
// BANDA E INFORMACIÓN TÉCNICA (puras)
// ====================

// El tema principal y el secundario, cada uno en su etiqueta; nada si no tiene
function htmlDeTemas(d) {
  return [d?.tema_principal_nombre, d?.tema_secundario_nombre]
    .filter(Boolean)
    .map(tema => `<span class="tema">${Utils.escapeHtml(tema)}</span>`)
    .join('');
}

// Frecuencia, formatos (vienen como texto, "CSV, XLSX") y tipo de gestión; '-' si falta
function filasTecnicas(d) {
  return [
    { rotulo: 'Frecuencia', valor: d?.frecuencia_nombre || '-' },
    { rotulo: 'Formatos', valor: d?.formatos || '-' },
    { rotulo: 'Tipo de gestión', valor: Utils.getTipoGestionTexto(d?.tipo_gestion) || '-' }
  ];
}

// ====================
// FECHAS (puras)
// ====================

// "Datos al": dd/mm/aaaa; "Ejercicio aaaa" en un presupuesto; "Relevamiento de {mes} de {año}" en un relevamiento (como
// "julio de 2026" en la próxima; Ruling 24); "—" sin dato
function textoDatosAl(d) {
  const fecha = Utils.soloFecha(d?.datos_al);
  if (!fecha) return Utils.SIN_DATO;
  if (d.tipo_pedido === 'ejercicio') return `Ejercicio ${fecha.slice(0, 4)}`;
  if (d.tipo_pedido === 'relevamiento') return `Relevamiento de ${Utils.mesDeAnio(fecha)}`;
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
