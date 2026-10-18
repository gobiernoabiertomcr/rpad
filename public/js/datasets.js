// Datasets - Lógica de listado
// Al cargarse solo declara y registra su DOMContentLoaded: lo que filtra y arma la tarjeta y el CSV es puro (filtrarDatasets,
// htmlDeTarjeta, filaCsv, armarCsv...) y tests/publico-frontend.test.js lo carga en un vm. El estado es el que manda el
// servidor (d.estado) y las fechas se leen por su texto, con Utils (api.js): nunca con new Date (spec 2026-10-17-fechas-datasets, 11)
let allDatasets = [];
let temas = [];
let frecuencias = [];
// ?mes=AAAA-MM: el clic en una barra del tablero lleva acá con los que vencen ese mes. No tiene selector: se ve en un aviso
let filtroMes = null;

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
      selectTema.innerHTML += `<option value="${t.id}">${Utils.escapeHtml(t.nombre)}</option>`;
    });

    // Llenar select de frecuencias
    const selectFrec = document.getElementById('filter-frecuencia');
    frecuencias.forEach(f => {
      selectFrec.innerHTML += `<option value="${f.id}">${Utils.escapeHtml(f.nombre)}</option>`;
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
  filtroMes = mesDelParametro(params.mes);
  mostrarFiltroMes();
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

// Los filtros de la pantalla (los selectores, la búsqueda y el mes de ?mes=)
function leerFiltros() {
  return {
    busqueda: document.getElementById('search').value,
    temaId: document.getElementById('filter-tema').value,
    frecId: document.getElementById('filter-frecuencia').value,
    estado: document.getElementById('filter-estado').value,
    mes: filtroMes
  };
}

function applyFilters() {
  const filtros = leerFiltros();

  // Actualizar URL
  const params = new URLSearchParams();
  if (filtros.temaId) params.set('tema', filtros.temaId);
  if (filtros.frecId) params.set('frecuencia', filtros.frecId);
  if (filtros.estado) params.set('estado', filtros.estado);
  if (filtros.busqueda) params.set('busqueda', filtros.busqueda.toLowerCase());
  if (filtros.mes) params.set('mes', filtros.mes);

  const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
  history.replaceState(null, '', newUrl);

  paginaActual = 1;
  renderDatasets(filtrarDatasets(allDatasets, filtros));
}

function limpiarFiltros() {
  document.getElementById('search').value = '';
  document.getElementById('filter-tema').value = '';
  document.getElementById('filter-frecuencia').value = '';
  document.getElementById('filter-estado').value = '';
  filtroMes = null;
  mostrarFiltroMes();
  history.replaceState(null, '', window.location.pathname);
  paginaActual = 1;
  renderDatasets(allDatasets);
}

// Saca solo el filtro por mes y deja los demás
function quitarFiltroMes() {
  filtroMes = null;
  mostrarFiltroMes();
  applyFilters();
}

function mostrarFiltroMes() {
  const aviso = document.getElementById('filtro-mes');
  if (!aviso) return;
  aviso.classList.toggle('hidden', !filtroMes);
  document.getElementById('filtro-mes-texto').textContent = filtroMes ? textoFiltroMes(filtroMes) : '';
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

  container.innerHTML = paginaItems.map(htmlDeTarjeta).join('');
}

function renderPaginacion(totalItems) {
  const el = document.getElementById('datasets-paginacion');
  if (!el) return;
  if (totalItems <= ITEMS_POR_PAGINA) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.classList.add('paginacion--standalone');
  const totalPaginas = Math.ceil(totalItems / ITEMS_POR_PAGINA);
  const inicio = (paginaActual - 1) * ITEMS_POR_PAGINA + 1;
  const fin = Math.min(paginaActual * ITEMS_POR_PAGINA, totalItems);
  el.innerHTML = `
    <span class="pag-info">Mostrando ${inicio}–${fin} de ${totalItems}</span>
    <div class="pag-controls">
      <button class="pag-btn" ${paginaActual <= 1 ? 'disabled' : ''} onclick="cambiarPagina(-1)">&#8249; Anterior</button>
      <span class="pag-pagina">Pag. ${paginaActual} de ${totalPaginas}</span>
      <button class="pag-btn" ${paginaActual >= totalPaginas ? 'disabled' : ''} onclick="cambiarPagina(1)">Siguiente &#8250;</button>
    </div>
  `;
}

function cambiarPagina(dir) {
  paginaActual += dir;
  renderDatasets(ultimosDatosFiltrados);
  document.getElementById('datasets-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// El CSV trae lo mismo que muestra el listado, con todos sus filtros
function exportarCSV() {
  const filtered = filtrarDatasets(allDatasets, leerFiltros());
  const csvContent = armarCsv(filtered);

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `datasets-rpad-${Utils.hoyEnArgentina()}.csv`;
  link.click();

  if (typeof showToast === 'function') {
    showToast(`Exportados ${filtered.length} datasets a CSV`, 'success');
  }
}

// =====================================================
// LO PURO: filtro, tarjeta y CSV
// =====================================================

// Iconos Lucide (building-2 y refresh-cw)
const ICONO_AREA = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>';
const ICONO_FRECUENCIA = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>';

// 'AAAA-MM' de ?mes=, o null si no es un mes
function mesDelParametro(valor) {
  return typeof valor === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor) ? valor : null;
}

// "Vencen en enero de 2027"
function textoFiltroMes(mes) {
  return `Vencen en ${Utils.mesDeAnio(`${mes}-01`)}`;
}

/**
 * Los datasets que pasan los filtros { busqueda, temaId, frecId, estado, mes }. El estado es el del servidor (Actualizado
 * no incluye a los eventuales, como la tarjeta del tablero); "vencidos" junta atrasados y sin respuesta. El mes es el de la
 * próxima (Utils.mesDeVencimiento, el mismo que cuenta el gráfico del tablero).
 */
function filtrarDatasets(datasets, filtros = {}) {
  const busqueda = (filtros.busqueda || '').toLowerCase();
  const { temaId, frecId, estado, mes } = filtros;
  return datasets.filter(d => {
    if (busqueda && !(
      d.titulo.toLowerCase().includes(busqueda) ||
      (d.area_nombre && d.area_nombre.toLowerCase().includes(busqueda)) ||
      (d.descripcion && d.descripcion.toLowerCase().includes(busqueda))
    )) return false;
    if (temaId && d.tema_principal_id != temaId && d.tema_secundario_id != temaId) return false;
    if (frecId && d.frecuencia_id != frecId) return false;
    if (estado) {
      const estadoDataset = Utils.estadoDe(d);
      if (estado === 'vencidos' ? !['atrasado', 'sin-respuesta'].includes(estadoDataset) : estadoDataset !== estado) return false;
    }
    if (mes && Utils.mesDeVencimiento(d) !== mes) return false;
    return true;
  });
}

// "Datos al dic 2025"; en un presupuesto "Ejercicio 2025"; en un relevamiento "Relevamiento de jun 2026"; sin dato "Datos al —"
function textoDatosAlCorto(d) {
  const fecha = Utils.soloFecha(d?.datos_al);
  if (fecha && d.tipo_pedido === 'ejercicio') return `Ejercicio ${fecha.slice(0, 4)}`;
  if (fecha && d.tipo_pedido === 'relevamiento') return `Relevamiento de ${Utils.mesAnio(fecha)}`;
  return `Datos al ${Utils.mesAnio(fecha)}`;
}

// "Próxima: ene 2027", "Eventual" o "Próxima: sin fecha"
function textoProximaCorta(d) {
  if (Utils.estadoDe(d) === 'eventual') return 'Eventual';
  const fecha = Utils.soloFecha(d?.proxima_actualizacion);
  return fecha ? `Próxima: ${Utils.mesAnio(fecha)}` : 'Próxima: sin fecha';
}

function htmlDeTarjeta(d) {
  const estado = Utils.estadoDe(d);
  // Formatos vienen como string concatenado "CSV, XLSX, KML" desde el backend
  const formatos = d.formatos ? d.formatos.split(', ') : [];

  return `
      <div class="dataset-card">
        <div class="dataset-card-header">
          <div class="dataset-card-title">
            <h3><a href="dataset.html?id=${encodeURIComponent(d.id)}">${Utils.escapeHtml(d.titulo)}</a></h3>
            <span class="badge ${getEstadoClase(estado)}">${Utils.escapeHtml(getEstadoTexto(estado))}</span>
          </div>
          ${d.tema_principal_nombre ? `
            <div class="temas-tags">
              <span class="tema-tag">${Utils.escapeHtml(d.tema_principal_nombre)}</span>
            </div>
          ` : ''}
        </div>
        <div class="dataset-card-body">
          <p class="dataset-card-description">${Utils.escapeHtml(d.descripcion || 'Sin descripción')}</p>
          <div class="dataset-card-meta">
            <span>${ICONO_AREA} ${Utils.escapeHtml(d.area_nombre || '-')}</span>
            <span>${ICONO_FRECUENCIA} ${Utils.escapeHtml(d.frecuencia_nombre || '-')}</span>
          </div>
        </div>
        <div class="dataset-card-footer">
          <div class="dataset-formats">
            ${formatos.map(f => `<span class="format-tag">${Utils.escapeHtml(f)}</span>`).join('')}
          </div>
          <span class="dataset-card-fechas text-xs text-muted">
            <span>${Utils.escapeHtml(textoDatosAlCorto(d))}</span>
            <span>${Utils.escapeHtml(textoProximaCorta(d))}</span>
          </span>
        </div>
      </div>
    `;
}

const ENCABEZADOS_CSV = ['Título', 'Área', 'Tema', 'Frecuencia', 'Tipo Gestión', 'Estado', 'Datos al', 'Cargado en el portal', 'Próxima Actualización'];

// Una fila del CSV: las fechas como dd/mm/aaaa, cortadas del texto, o '-' si no hay
function filaCsv(d) {
  const fecha = (valor) => (Utils.soloFecha(valor) ? Utils.fechaCorta(valor) : '-');
  return [
    d.titulo,
    d.area_nombre || '',
    d.tema_principal_nombre || '',
    d.frecuencia_nombre || '',
    getTipoGestionTexto(d.tipo_gestion),
    getEstadoTexto(Utils.estadoDe(d)),
    fecha(d.datos_al),
    fecha(d.ultima_actualizacion),
    fecha(d.proxima_actualizacion)
  ];
}

// El CSV completo, con el BOM (para que Excel lea los acentos) y cada celda entre comillas
function armarCsv(datasets) {
  return '﻿' + [ENCABEZADOS_CSV, ...datasets.map(filaCsv)]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

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
