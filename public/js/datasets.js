// Datasets (spec 2026-10-18-rediseno-publico, 7): los estados como botones con sus cantidades, las herramientas (buscar, tema,
// frecuencia, orden y vista), las tarjetas o la lista, la paginación y el CSV.
// Al cargarse solo declara y registra su DOMContentLoaded: lo que filtra, ordena, cuenta y arma el HTML, la URL y el CSV es puro
// (filtrarDatasets, ordenarDatasets, cantidadesPorEstado, htmlDeEstados, htmlDeTarjeta, htmlDeFila, leerParametros,
// armarParametros, armarCsv...) y tests/publico-frontend.test.js lo carga en un vm. El estado es el que manda el servidor
// (d.estado) y las fechas se leen por su texto, con Utils (api.js): nunca con new Date (spec 2026-10-17-fechas-datasets, 11)
let allDatasets = [];
let temas = [];
let frecuencias = [];
// Hasta que llega el listado no se dibuja nada: ni cantidades en cero ni "No hay conjuntos"
let listadoCargado = false;
// Los filtros de la página: al entrar, los de la URL (leerParametros); después, lo que elige la persona. Manda este objeto y los
// controles lo reflejan. El mes ('AAAA-MM', de ?mes=: viene de los 12 meses de la portada) no tiene selector: se ve en la pastilla
let filtrosActuales = { temaId: '', frecId: '', estado: '', busqueda: '', mes: null, orden: 'nombre', vista: 'tarjetas' };
let esperaDeBusqueda = null;

// Paginación: 24 tarjetas (múltiplo de 2 y de 3 columnas) o 50 filas
let paginaActual = 1;
const ITEMS_POR_PAGINA = { tarjetas: 24, lista: 50 };
let ultimosDatosFiltrados = [];

// El primero de cada lista es el por defecto: no se escribe en la URL
const ORDENES = ['nombre', 'proxima', 'area'];
const VISTAS = ['tarjetas', 'lista'];
// Los valores de ?estado= (los de siempre): "vencidos" junta atrasados y sin respuesta
const ESTADOS_DEL_FILTRO = ['actualizado', 'proximo', 'vencidos', 'atrasado', 'sin-respuesta', 'eventual', 'sin-fecha'];
const ESTADOS_VENCIDOS = ['vencidos', 'atrasado', 'sin-respuesta'];

document.addEventListener('DOMContentLoaded', () => {
  filtrosActuales = leerParametros(window.location.search);
  prepararControles();
  cargarListado();
});

// =====================================================
// CARGA Y DIBUJO (tocan el DOM y la API)
// =====================================================

// Los controles muestran los filtros de la URL desde el principio (tema y frecuencia, cuando llegan sus catálogos) y cada
// cambio vuelve a dibujar. Delegación en los botones de estado y en la paginación, que se vuelven a dibujar
function prepararControles() {
  const buscar = document.getElementById('search');
  buscar.value = filtrosActuales.busqueda;
  document.getElementById('filter-orden').value = filtrosActuales.orden;
  marcarVista();
  mostrarFiltroMes();

  buscar.addEventListener('input', () => {
    clearTimeout(esperaDeBusqueda);
    esperaDeBusqueda = setTimeout(() => {
      filtrosActuales.busqueda = buscar.value;
      aplicarFiltros();
    }, 300);
  });
  document.getElementById('filter-tema').addEventListener('change', (evento) => {
    filtrosActuales.temaId = evento.target.value;
    aplicarFiltros();
  });
  document.getElementById('filter-frecuencia').addEventListener('change', (evento) => {
    filtrosActuales.frecId = evento.target.value;
    aplicarFiltros();
  });
  document.getElementById('filter-orden').addEventListener('change', (evento) => {
    filtrosActuales.orden = ORDENES.includes(evento.target.value) ? evento.target.value : ORDENES[0];
    aplicarFiltros();
  });
  document.getElementById('estados').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-estado]');
    if (!boton) return;
    filtrosActuales.estado = boton.dataset.estado;
    aplicarFiltros();
  });
  document.getElementById('vista').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-vista]');
    if (boton) cambiarVista(boton.dataset.vista);
  });
  document.getElementById('datasets-paginacion').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-pagina]');
    if (boton && !boton.disabled) cambiarPagina(Number(boton.dataset.pagina));
  });
  document.getElementById('limpiar-filtros').addEventListener('click', limpiarFiltros);
  document.getElementById('vacio-limpiar').addEventListener('click', limpiarFiltros);
  document.getElementById('filtro-mes-quitar').addEventListener('click', quitarFiltroMes);
  document.getElementById('exportar-csv').addEventListener('click', exportarCSV);
}

// Pide los datasets con API.pedirJson, que tira error ante una respuesta de error (getDatasets devolvería [] y la página diría
// "No hay conjuntos"), y en paralelo los catálogos de los selectores. Si fallan los catálogos, los selectores quedan en
// "Todos"/"Todas"; si fallan los datasets, solo queda el aviso
async function cargarListado() {
  const pedidoDeCatalogos = Promise.all([API.getTemas(), API.getFrecuencias()]).catch((error) => {
    console.error('Error cargando los catálogos:', error);
    return [[], []];
  });
  let datasets;
  try {
    datasets = (await API.pedirJson('GET', '/datasets'))?.data;
    if (!Array.isArray(datasets)) throw new Error('La respuesta no trae los datasets');
  } catch (error) {
    console.error('Error cargando los datasets:', error);
    mostrarErrorDeCarga();
    return;
  }
  [temas, frecuencias] = await pedidoDeCatalogos;
  llenarSelector('filter-tema', temas, 'temaId');
  llenarSelector('filter-frecuencia', frecuencias, 'frecId');

  allDatasets = datasets;
  listadoCargado = true;
  ponerTexto('datasets-bajada', textoBajada(allDatasets.length));
  // La URL queda como la escribe la página (sin un ?mes= o un ?orden= que no valen)
  escribirUrl();
  dibujarListado();
}

// Las opciones del catálogo, y el valor que traía la URL. Un id que no está en el catálogo no filtra (como antes): el selector
// queda en "Todos"
function llenarSelector(id, opciones, clave) {
  const selector = document.getElementById(id);
  if (!selector) return;
  selector.insertAdjacentHTML('beforeend', (opciones || [])
    .map(o => `<option value="${Utils.escapeHtml(String(o.id))}">${Utils.escapeHtml(o.nombre)}</option>`).join(''));
  selector.value = filtrosActuales[clave];
  filtrosActuales[clave] = selector.value;
}

function mostrarErrorDeCarga() {
  document.getElementById('datasets-error')?.classList.remove('hidden');
  for (const id of ['datasets-controles', 'datasets-grid', 'datasets-paginacion', 'empty-state', 'exportar-csv']) {
    document.getElementById(id)?.classList.add('hidden');
  }
}

// Cada cambio de filtro vuelve a la primera página y deja la URL al día
function aplicarFiltros() {
  paginaActual = 1;
  escribirUrl();
  dibujarListado();
}

function escribirUrl() {
  const query = armarParametros(filtrosActuales);
  history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
}

// Las cantidades de los botones cuentan lo que dejan los otros filtros; la lista, además, el estado elegido
function dibujarListado() {
  if (!listadoCargado) return;
  dibujarEstados(cantidadesConFiltros(allDatasets, filtrosActuales));
  ultimosDatosFiltrados = ordenarDatasets(filtrarDatasets(allDatasets, filtrosActuales), filtrosActuales.orden);
  ponerHtml('resultado-cuenta', htmlDeCuenta(ultimosDatosFiltrados.length));
  dibujarResultados();
}

// Los botones se vuelven a dibujar con sus cantidades: si el foco estaba en uno, vuelve al mismo (el de la segunda fila, si
// estaba ahí: "Todos los vencidos" y "Vencidos" tienen el mismo valor)
function dibujarEstados(cantidades) {
  const enfocado = document.activeElement?.closest?.('#estados .estado-btn');
  const clave = enfocado ? { estado: enfocado.dataset.estado, enSegundaFila: !!enfocado.closest('.sub-estados') } : null;
  ponerHtml('estados', htmlDeEstados(cantidades, filtrosActuales.estado));
  if (!clave) return;
  const botones = document.querySelectorAll(clave.enSegundaFila ? '#estados .sub-estados .estado-btn' : '#estados > .estado-btn');
  [...botones].find(boton => boton.dataset.estado === clave.estado)?.focus();
}

// La página actual de los resultados, en tarjetas o en lista, con su paginación
function dibujarResultados() {
  if (!listadoCargado) return;
  const datasets = ultimosDatosFiltrados;
  const porPagina = ITEMS_POR_PAGINA[filtrosActuales.vista];
  const totalPaginas = Math.max(1, Math.ceil(datasets.length / porPagina));
  paginaActual = Math.min(Math.max(1, paginaActual), totalPaginas);
  const pagina = datasets.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);

  const contenedor = document.getElementById('datasets-grid');
  contenedor.classList.toggle('hidden', datasets.length === 0);
  document.getElementById('empty-state').classList.toggle('hidden', datasets.length > 0);
  contenedor.innerHTML = datasets.length === 0 ? ''
    : filtrosActuales.vista === 'lista' ? htmlDeLista(pagina)
      : `<div class="grilla">${pagina.map(htmlDeTarjeta).join('')}</div>`;

  const paginacion = document.getElementById('datasets-paginacion');
  paginacion.innerHTML = htmlDePaginacion(datasets.length, paginaActual, porPagina);
  paginacion.classList.toggle('hidden', paginacion.innerHTML === '');
}

// Tarjetas o lista. La página nueva arranca en el primer conjunto que se estaba viendo
function cambiarVista(vista) {
  if (!VISTAS.includes(vista) || vista === filtrosActuales.vista) return;
  const primero = (paginaActual - 1) * ITEMS_POR_PAGINA[filtrosActuales.vista];
  filtrosActuales.vista = vista;
  paginaActual = Math.floor(primero / ITEMS_POR_PAGINA[vista]) + 1;
  marcarVista();
  escribirUrl();
  dibujarResultados();
}

function marcarVista() {
  for (const boton of document.querySelectorAll('#vista [data-vista]')) {
    boton.setAttribute('aria-pressed', String(boton.dataset.vista === filtrosActuales.vista));
  }
}

// La página nueva deja el resultado debajo del encabezado fijo (scroll-margin-top en .resultado) y el foco ahí: los botones de
// la paginación se vuelven a dibujar y el siguiente Tab va a la primera tarjeta
function cambiarPagina(dir) {
  paginaActual += dir;
  dibujarResultados();
  const resultado = document.getElementById('resultado');
  if (!resultado) return;
  resultado.focus({ preventScroll: true });
  const sinMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  resultado.scrollIntoView({ behavior: sinMovimiento ? 'auto' : 'smooth', block: 'start' });
}

// Saca la búsqueda, el tema, la frecuencia, el estado y el mes; el orden y la vista quedan
function limpiarFiltros() {
  const desdeElVacio = document.activeElement?.id === 'vacio-limpiar';
  clearTimeout(esperaDeBusqueda);
  filtrosActuales = { ...filtrosActuales, temaId: '', frecId: '', estado: '', busqueda: '', mes: null };
  document.getElementById('search').value = '';
  document.getElementById('filter-tema').value = '';
  document.getElementById('filter-frecuencia').value = '';
  mostrarFiltroMes();
  aplicarFiltros();
  // El botón del vacío desaparece con el vacío: el foco va al resultado
  if (desdeElVacio) document.getElementById('resultado')?.focus();
}

// Saca solo el filtro por mes y deja los demás. La pastilla se oculta con su botón: el foco va al resultado
function quitarFiltroMes() {
  filtrosActuales.mes = null;
  mostrarFiltroMes();
  aplicarFiltros();
  document.getElementById('resultado')?.focus();
}

function mostrarFiltroMes() {
  const aviso = document.getElementById('filtro-mes');
  if (!aviso) return;
  aviso.classList.toggle('hidden', !filtrosActuales.mes);
  document.getElementById('filtro-mes-texto').textContent = filtrosActuales.mes ? textoFiltroMes(filtrosActuales.mes) : '';
}

// El CSV trae lo mismo que muestra el listado, con todos sus filtros y en el mismo orden
function exportarCSV() {
  const filtered = ordenarDatasets(filtrarDatasets(allDatasets, filtrosActuales), filtrosActuales.orden);
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

function ponerHtml(id, html) {
  const elemento = document.getElementById(id);
  if (elemento) elemento.innerHTML = html;
}

function ponerTexto(id, texto) {
  const elemento = document.getElementById(id);
  if (elemento) elemento.textContent = texto;
}

// =====================================================
// LO PURO: URL, filtro, orden, cantidades, estados, tarjeta, lista, paginación y CSV
// =====================================================

// Iconos Lucide (building-2, refresh-cw, chevron-left y chevron-right), decorativos
const ICONO_AREA = '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>';
const ICONO_FRECUENCIA = '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>';
const ICONO_ANTERIOR = '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
const ICONO_SIGUIENTE = '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

/**
 * Los filtros de la URL ('?estado=vencidos&mes=2027-01&...'): los parámetros de siempre (tema, frecuencia, estado, busqueda y
 * mes) y los nuevos (orden y vista). Un estado, un orden o una vista que no existen quedan en el por defecto; el mes, solo si es
 * AAAA-MM
 */
function leerParametros(textoDeLaUrl) {
  const parametros = new URLSearchParams(textoDeLaUrl || '');
  const valor = (clave) => parametros.get(clave) || '';
  return {
    temaId: valor('tema'),
    frecId: valor('frecuencia'),
    estado: ESTADOS_DEL_FILTRO.includes(valor('estado')) ? valor('estado') : '',
    busqueda: valor('busqueda'),
    mes: mesDelParametro(parametros.get('mes')),
    orden: ORDENES.includes(valor('orden')) ? valor('orden') : ORDENES[0],
    vista: VISTAS.includes(valor('vista')) ? valor('vista') : VISTAS[0]
  };
}

// El texto de la URL (sin '?'), sin los vacíos ni los por defecto, siempre en el mismo orden
function armarParametros(filtros = {}) {
  const parametros = new URLSearchParams();
  const poner = (clave, valor, porDefecto = '') => {
    const texto = valor === null || valor === undefined ? '' : String(valor);
    if (texto && texto !== porDefecto) parametros.set(clave, texto);
  };
  poner('tema', filtros.temaId);
  poner('frecuencia', filtros.frecId);
  poner('estado', filtros.estado);
  poner('busqueda', filtros.busqueda);
  poner('mes', filtros.mes);
  poner('orden', filtros.orden, ORDENES[0]);
  poner('vista', filtros.vista, VISTAS[0]);
  return parametros.toString();
}

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
 * no incluye a los eventuales, como la portada); "vencidos" junta atrasados y sin respuesta. El mes es el de la próxima
 * (Utils.mesDeVencimiento, el mismo que cuentan los 12 meses de la portada).
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

function porTitulo(a, b) {
  return String(a.titulo ?? '').localeCompare(String(b.titulo ?? ''), 'es');
}

/**
 * Una copia ordenada. 'nombre': por título. 'proxima': por la fecha de la próxima (su texto), la más cercana primero; los
 * eventuales (aunque les haya quedado una próxima vieja) y los que no tienen fecha, al final. 'area': por el nombre del área,
 * los que no tienen área al final. El título desempata
 */
function ordenarDatasets(datasets, orden) {
  const lista = [...datasets];
  if (orden === 'proxima') {
    const fecha = (d) => (Utils.estadoDe(d) === 'eventual' ? null : Utils.soloFecha(d.proxima_actualizacion));
    return lista.sort((a, b) => {
      const fechaA = fecha(a);
      const fechaB = fecha(b);
      if (fechaA && fechaB && fechaA !== fechaB) return fechaA < fechaB ? -1 : 1;
      if (!fechaA !== !fechaB) return fechaA ? -1 : 1;
      return porTitulo(a, b);
    });
  }
  if (orden === 'area') {
    return lista.sort((a, b) => {
      if (!a.area_nombre !== !b.area_nombre) return a.area_nombre ? -1 : 1;
      return (a.area_nombre ? String(a.area_nombre).localeCompare(String(b.area_nombre), 'es') : 0) || porTitulo(a, b);
    });
  }
  return lista.sort(porTitulo);
}

// Cuántos hay de cada estado (el del servidor). "vencidos" = atrasados + sin respuesta
function cantidadesPorEstado(datasets) {
  const cantidades = { todos: datasets.length, actualizado: 0, proximo: 0, vencidos: 0, atrasado: 0, 'sin-respuesta': 0, eventual: 0, 'sin-fecha': 0 };
  for (const d of datasets) {
    const estado = Utils.estadoDe(d);
    if (ESTADOS_DEL_FILTRO.includes(estado) && estado !== 'vencidos') cantidades[estado] += 1;
    if (estado === 'atrasado' || estado === 'sin-respuesta') cantidades.vencidos += 1;
  }
  return cantidades;
}

// Las cantidades de los botones: lo que dejan los otros filtros (búsqueda, tema, frecuencia y mes), sin el estado elegido
function cantidadesConFiltros(datasets, filtros = {}) {
  return cantidadesPorEstado(filtrarDatasets(datasets, { ...filtros, estado: '' }));
}

// [valor de ?estado=, texto, cuadrito]
const BOTONES_DE_ESTADO = [
  ['', 'Todos', null],
  ['actualizado', 'Actualizados', 'actualizado'],
  ['proximo', 'Próximos a vencer', 'proximo'],
  ['vencidos', 'Vencidos', 'vencidos'],
  ['eventual', 'Eventuales', 'eventual'],
  ['sin-fecha', 'Sin fecha', 'sin-fecha']
];
const BOTONES_DE_VENCIDOS = [
  ['vencidos', 'Todos los vencidos', 'vencidos'],
  ['atrasado', 'Atrasados', 'atrasado'],
  ['sin-respuesta', 'Sin respuesta del área', 'sin-respuesta']
];

function htmlDeBotonDeEstado([valor, texto, cuadro], cantidad, presionado) {
  const cuadrito = cuadro ? `<span class="tile c-${cuadro}" aria-hidden="true"></span>` : '';
  return `<button type="button" class="estado-btn" data-estado="${valor}" aria-pressed="${presionado}">${cuadrito}${texto} <span class="estado-n">${Number(cantidad) || 0}</span></button>`;
}

/**
 * Los botones de estado, cada uno con su cuadrito y su cantidad. Vencidos queda presionado también con atrasado o sin
 * respuesta, y entonces aparece la segunda fila (Todos los vencidos, Atrasados, Sin respuesta del área). Sin fecha va solo si
 * hay alguno o si está elegido
 */
function htmlDeEstados(cantidades, estado = '') {
  const enVencidos = ESTADOS_VENCIDOS.includes(estado);
  const principales = BOTONES_DE_ESTADO
    .filter(([valor]) => valor !== 'sin-fecha' || cantidades['sin-fecha'] > 0 || estado === 'sin-fecha')
    .map(boton => htmlDeBotonDeEstado(boton, cantidades[boton[0] || 'todos'], boton[0] === estado || (boton[0] === 'vencidos' && enVencidos)))
    .join('');
  if (!enVencidos) return principales;
  const segunda = BOTONES_DE_VENCIDOS.map(boton => htmlDeBotonDeEstado(boton, cantidades[boton[0]], boton[0] === estado)).join('');
  return `${principales}<div class="sub-estados" role="group" aria-label="Filtrar los vencidos">${segunda}</div>`;
}

// "Los 80 conjuntos de datos que sigue el registro, …"
function textoBajada(total) {
  if (total === 1) return 'El conjunto de datos que sigue el registro, con su estado y cuándo se actualiza.';
  return `Los ${total} conjuntos de datos que sigue el registro, con su estado y cuándo se actualizan.`;
}

// "80 conjuntos", "1 conjunto"
function htmlDeCuenta(cantidad) {
  return `<strong>${Number(cantidad) || 0}</strong> ${cantidad === 1 ? 'conjunto' : 'conjuntos'}`;
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

function htmlDeInsignia(d) {
  const estado = Utils.estadoDe(d);
  return `<span class="badge ${getEstadoClase(estado)}">${Utils.escapeHtml(getEstadoTexto(estado))}</span>`;
}

// La tarjeta: el link del título cubre toda la tarjeta (::after en publico.css)
function htmlDeTarjeta(d) {
  // Formatos vienen como string concatenado "CSV, XLSX, KML" desde el backend
  const formatos = d.formatos ? d.formatos.split(', ') : [];

  return `
      <article class="tarjeta">
        <div class="tarjeta-cabeza">
          <h2 class="tarjeta-titulo"><a href="dataset.html?id=${encodeURIComponent(d.id)}">${Utils.escapeHtml(d.titulo)}</a></h2>
          ${htmlDeInsignia(d)}
        </div>
        <p class="tarjeta-desc">${Utils.escapeHtml(d.descripcion || 'Sin descripción')}</p>
        <div class="tarjeta-meta">
          <span>${ICONO_AREA} ${Utils.escapeHtml(d.area_nombre || '-')}</span>
          <span>${ICONO_FRECUENCIA} ${Utils.escapeHtml(d.frecuencia_nombre || '-')}</span>
        </div>
        ${d.tema_principal_nombre ? `<p class="tarjeta-tema"><span class="tema">${Utils.escapeHtml(d.tema_principal_nombre)}</span></p>` : ''}
        <div class="tarjeta-pie">
          ${formatos.length ? `<ul class="formatos" aria-label="Formatos">${formatos.map(f => `<li class="formato">${Utils.escapeHtml(f)}</li>`).join('')}</ul>` : ''}
          <p class="tarjeta-fechas">
            <span class="tarjeta-datos-al">${Utils.escapeHtml(textoDatosAlCorto(d))}</span>
            <span>${Utils.escapeHtml(textoProximaCorta(d))}</span>
          </p>
        </div>
      </article>
    `;
}

/**
 * Una fila de la lista: el título (link al detalle) con el área debajo, el tema principal, la frecuencia, los datos, la próxima
 * (sin "Próxima: ": la dice el encabezado; en el celular la pone el CSS, salvo en un eventual) y la insignia
 */
function htmlDeFila(d) {
  const eventual = Utils.estadoDe(d) === 'eventual';
  const proxima = textoProximaCorta(d).replace(/^Próxima: /, '');
  return '<tr>'
    + `<td class="t-titulo"><a href="dataset.html?id=${encodeURIComponent(d.id)}">${Utils.escapeHtml(d.titulo)}</a>`
    + `<span class="t-area">${Utils.escapeHtml(d.area_nombre || 'Sin área asignada')}</span></td>`
    + `<td class="t-col-tema">${Utils.escapeHtml(d.tema_principal_nombre || Utils.SIN_DATO)}</td>`
    + `<td class="t-col-frec">${Utils.escapeHtml(d.frecuencia_nombre || Utils.SIN_DATO)}</td>`
    + `<td class="t-fecha t-datos">${Utils.escapeHtml(textoDatosAlCorto(d))}</td>`
    + `<td class="t-fecha${eventual ? '' : ' t-proxima'}">${Utils.escapeHtml(proxima)}</td>`
    + `<td class="t-estado">${htmlDeInsignia(d)}</td>`
    + '</tr>';
}

// La tabla de la vista de lista, en su panel. Tema y Frecuencia se ocultan en el celular
function htmlDeLista(datasets) {
  return '<div class="tabla-marco"><table class="tabla" aria-label="Conjuntos de datos">'
    + '<thead><tr><th scope="col">Conjunto de datos</th><th scope="col" class="t-col-tema">Tema</th>'
    + '<th scope="col" class="t-col-frec">Frecuencia</th><th scope="col">Datos</th><th scope="col">Próxima</th><th scope="col">Estado</th></tr></thead>'
    + `<tbody>${datasets.map(htmlDeFila).join('')}</tbody></table></div>`;
}

// "Mostrando 1–24 de 80", Anterior, "Página 1 de 4" y Siguiente; con una sola página, nada
function htmlDePaginacion(total, pagina, porPagina) {
  if (total <= porPagina) return '';
  const totalPaginas = Math.ceil(total / porPagina);
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  return `<p class="paginado-info">Mostrando ${desde}–${hasta} de ${total}</p>`
    + '<div class="paginado-controles">'
    + `<button type="button" class="btn-borde btn-chico" data-pagina="-1"${pagina <= 1 ? ' disabled' : ''}>${ICONO_ANTERIOR}Anterior</button>`
    + `<span class="paginado-pagina">Página ${pagina} de ${totalPaginas}</span>`
    + `<button type="button" class="btn-borde btn-chico" data-pagina="1"${pagina >= totalPaginas ? ' disabled' : ''}>Siguiente${ICONO_SIGUIENTE}</button>`
    + '</div>';
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
  return '\uFEFF' + [ENCABEZADOS_CSV, ...datasets.map(filaCsv)]
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
