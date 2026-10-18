// Calendario (spec 2026-10-18-rediseno-publico, 9): el almanaque de vencimientos. Arriba los vencidos, después una fila por
// cada uno de los 12 meses desde el actual (los mismos de la portada) y al final los que vencen más adelante; los filtros por
// área y por tema (principal o secundario) y el iCal con lo que dejan los filtros.
// Al cargarse solo declara y registra su DOMContentLoaded: lo que filtra, arma las filas y su HTML es puro (filtrarCalendario,
// mesesDelAlmanaque, filasDelAlmanaque, htmlDelAlmanaque, textoCantidad) y tests/publico-frontend.test.js lo carga en un vm.
// El estado es el que manda el servidor (d.estado) y las fechas se leen por su texto, con Utils (api.js): nunca con new Date
// (spec 2026-10-17-fechas-datasets, 11)
let datasets = [];
let areas = [];
let temas = [];
// Hasta que llegan los datasets, cambiar un filtro no dibuja nada (si no, diría "No hay conjuntos" mientras carga)
let calendarioCargado = false;

document.addEventListener('DOMContentLoaded', () => {
  prepararFiltros();
  cargarCalendario();
});

// =====================================================
// CARGA Y DIBUJO (tocan el DOM y la API)
// =====================================================

function prepararFiltros() {
  document.getElementById('filter-area').addEventListener('change', dibujarAlmanaque);
  document.getElementById('filter-tema').addEventListener('change', dibujarAlmanaque);
}

// Pide los datasets con API.pedirJson, que tira error ante una respuesta de error (getDatasets devolvería [] y el almanaque
// diría que no vence nada), y en paralelo las áreas y los temas de los filtros. Si fallan los catálogos, los filtros quedan en
// "Todas"/"Todos"; si fallan los datasets (o el dibujo), solo queda el aviso
async function cargarCalendario() {
  const pedidoDeCatalogos = Promise.all([API.getAreas(), API.getTemas()]).catch((error) => {
    console.error('Error cargando las áreas y los temas:', error);
    return [[], []];
  });
  try {
    const lista = (await API.pedirJson('GET', '/datasets'))?.data;
    if (!Array.isArray(lista)) throw new Error('La respuesta no trae los datasets');
    datasets = lista;
    [areas, temas] = await pedidoDeCatalogos;
    llenarSelector('filter-area', areas);
    llenarSelector('filter-tema', temas);
    calendarioCargado = true;
    dibujarAlmanaque();
  } catch (error) {
    console.error('Error cargando el calendario:', error);
    mostrarErrorDeCarga();
  }
}

function llenarSelector(id, opciones) {
  document.getElementById(id)?.insertAdjacentHTML('beforeend', (opciones || [])
    .map(o => `<option value="${Utils.escapeHtml(String(o.id))}">${Utils.escapeHtml(o.nombre)}</option>`).join(''));
}

function mostrarErrorDeCarga() {
  document.getElementById('calendario-error')?.classList.remove('hidden');
  for (const id of ['calendario-controles', 'almanaque', 'calendario-vacio', 'exportar-ical']) {
    document.getElementById(id)?.classList.add('hidden');
  }
}

// Las filas con lo que dejan los filtros; si ninguna tiene un conjunto, el aviso del vacío en lugar del almanaque
function dibujarAlmanaque() {
  if (!calendarioCargado) return;
  const filas = filasDelAlmanaque(filtrarCalendario(datasets, filtrosActuales()), Utils.hoyEnArgentina());
  const hayAlguno = filas.some(fila => fila.datasets.length > 0);
  const almanaque = document.getElementById('almanaque');
  almanaque.innerHTML = hayAlguno ? htmlDelAlmanaque(filas) : '';
  almanaque.classList.toggle('hidden', !hayAlguno);
  document.getElementById('calendario-vacio').classList.toggle('hidden', hayAlguno);
}

function filtrosActuales() {
  return {
    areaId: document.getElementById('filter-area')?.value || '',
    temaId: document.getElementById('filter-tema')?.value || ''
  };
}

function limpiarFiltros() {
  document.getElementById('filter-area').value = '';
  document.getElementById('filter-tema').value = '';
  dibujarAlmanaque();
}

// =====================================================
// LO PURO (sin DOM ni API)
// =====================================================

const ESTADOS_VENCIDOS = ['atrasado', 'sin-respuesta'];
// Los que no tienen vencimiento no entran nunca al almanaque
const ESTADOS_SIN_VENCIMIENTO = ['eventual', 'sin-fecha'];

/**
 * Los datasets de un área (area_id, comparado como texto) y de un tema, principal o secundario (como en Datasets). Un filtro
 * vacío no filtra.
 */
function filtrarCalendario(lista, { areaId = '', temaId = '' } = {}) {
  const comoTexto = (valor) => (valor === null || valor === undefined ? '' : String(valor));
  return (lista || []).filter(d => {
    if (areaId && comoTexto(d.area_id) !== String(areaId)) return false;
    if (temaId && comoTexto(d.tema_principal_id) !== String(temaId) && comoTexto(d.tema_secundario_id) !== String(temaId)) return false;
    return true;
  });
}

/**
 * Los 12 meses del almanaque, desde el mes de `hoy` ('AAAA-MM-DD', la fecha de Argentina): { clave: 'AAAA-MM', etiqueta:
 * 'oct 26', titulo: 'octubre de 2026' }. Es una copia de mesesDelGrafico (dashboard.js, que esta página no carga): un test
 * verifica que den lo mismo. Se cuentan sobre el índice año × 12 + mes, sin new Date.
 */
function mesesDelAlmanaque(hoy) {
  const primero = Number(hoy.slice(0, 4)) * 12 + Number(hoy.slice(5, 7)) - 1;
  return Array.from({ length: 12 }, (_, i) => {
    const anio = Math.floor((primero + i) / 12);
    const mes = ((primero + i) % 12) + 1;
    const clave = `${anio}-${String(mes).padStart(2, '0')}`;
    return { clave, etiqueta: `${Utils.nombreDeMes(mes).slice(0, 3)} ${String(anio).slice(-2)}`, titulo: Utils.mesDeAnio(`${clave}-01`) };
  });
}

function porTitulo(a, b) {
  return String(a?.titulo ?? '').localeCompare(String(b?.titulo ?? ''), 'es');
}

// Por la fecha de la próxima (su texto) y, a igual fecha, por título
function porFechaYTitulo(a, b) {
  return String(Utils.soloFecha(a.proxima_actualizacion) ?? '').localeCompare(String(Utils.soloFecha(b.proxima_actualizacion) ?? ''))
    || porTitulo(a, b);
}

/**
 * Las filas del almanaque, con el estado del servidor: [{ tipo: 'vencidos' | 'mes' | 'despues', clave, titulo, actual,
 * datasets }].
 * - 'vencidos', solo si hay: los atrasados y los sin respuesta, por fecha y título.
 * - Los 12 meses (mesesDelAlmanaque), siempre, el primero con actual: true. Cada uno con los que vencen ese mes
 *   (Utils.mesDeVencimiento, el mismo del filtro ?mes= del listado), sin los vencidos, por título.
 * - 'despues', solo si hay: los que vencen después del mes 12, por fecha y título.
 * Los eventuales y los sin fecha no entran nunca.
 */
function filasDelAlmanaque(lista, hoy) {
  const meses = mesesDelAlmanaque(hoy);
  const ultimo = meses[meses.length - 1].clave;
  const conFecha = (lista || []).filter(d => !ESTADOS_SIN_VENCIMIENTO.includes(Utils.estadoDe(d)));
  const vencidos = conFecha.filter(d => ESTADOS_VENCIDOS.includes(Utils.estadoDe(d))).sort(porFechaYTitulo);
  const porVencer = conFecha.filter(d => !ESTADOS_VENCIDOS.includes(Utils.estadoDe(d)));

  const filas = [];
  if (vencidos.length) filas.push({ tipo: 'vencidos', clave: null, titulo: 'Vencidos', actual: false, datasets: vencidos });
  meses.forEach((m, i) => filas.push({
    tipo: 'mes',
    clave: m.clave,
    titulo: m.titulo,
    actual: i === 0,
    datasets: porVencer.filter(d => Utils.mesDeVencimiento(d) === m.clave).sort(porTitulo)
  }));
  const despues = porVencer.filter(d => (Utils.mesDeVencimiento(d) ?? '') > ultimo).sort(porFechaYTitulo);
  if (despues.length) filas.push({ tipo: 'despues', clave: null, titulo: 'Más adelante', actual: false, datasets: despues });
  return filas;
}

function textoCantidad(n) {
  return n === 1 ? '1 conjunto' : `${n} conjuntos`;
}

// El id de un dataset, seguro dentro de un href
function idDelDataset(d) {
  return encodeURIComponent(String(d?.id ?? ''));
}

/**
 * Una ficha: link al detalle con el cuadrito del estado y el título; el área en title. En Vencidos y en Más adelante, con el
 * mes ('ene 2024'). El estado, para los lectores de pantalla (el cuadrito solo lo dice con el color)
 */
function htmlDeFicha(d, conMes) {
  const estado = Utils.estadoDe(d);
  const mes = conMes && Utils.soloFecha(d.proxima_actualizacion) ? ` <small>${Utils.escapeHtml(Utils.mesAnio(d.proxima_actualizacion))}</small>` : '';
  return `<li><a class="ficha" href="dataset.html?id=${idDelDataset(d)}" title="${Utils.escapeHtml(d.area_nombre) || 'Sin área asignada'}">`
    + `<i class="tile c-${Utils.escapeHtml(estado)}" aria-hidden="true"></i>`
    + `<span class="ficha-texto">${Utils.escapeHtml(d.titulo)}${mes}`
    + `<span class="solo-lectores">, ${Utils.escapeHtml(Utils.getEstadoTextoLargo(estado))}</span></span></a></li>`;
}

function htmlDeFichas(lista, conMes) {
  return `<ul class="almanaque-lista">${lista.map(d => htmlDeFicha(d, conMes)).join('')}</ul>`;
}

// El rótulo de un mes: link al listado de ese mes (?mes=AAAA-MM). El año se ve en el mes en curso y en cada enero; en los
// otros, solo lo leen los lectores de pantalla
function htmlDelRotuloDelMes(fila) {
  const anio = fila.clave.slice(0, 4);
  const conAnio = fila.actual || fila.clave.endsWith('-01');
  const textoAnio = conAnio ? ` <span class="anio">${anio}</span>` : `<span class="solo-lectores"> de ${anio}</span>`;
  return `<h2><a href="datasets.html?mes=${Utils.escapeHtml(fila.clave)}">${Utils.nombreDeMes(Number(fila.clave.slice(5, 7)))}${textoAnio}</a></h2>`;
}

/**
 * El almanaque (spec 9): cada fila con el rótulo a la izquierda y las fichas a la derecha. Vencidos con su fondo rosado; el
 * mes en curso con "Este mes"; un mes sin vencimientos, finito y con "Nada vence este mes."; Más adelante dice después de qué
 * mes.
 */
function htmlDelAlmanaque(filas) {
  const meses = filas.filter(fila => fila.tipo === 'mes');
  const ultimoMes = meses[meses.length - 1];
  return filas.map(fila => {
    const n = fila.datasets.length;
    if (fila.tipo === 'vencidos') {
      return '<div class="almanaque-fila vencidos"><div class="almanaque-rotulo"><h2>Vencidos</h2>'
        + `<span class="almanaque-cuenta">${textoCantidad(n)}, con el mes en que vencieron</span></div>${htmlDeFichas(fila.datasets, true)}</div>`;
    }
    if (fila.tipo === 'despues') {
      const despuesDe = ultimoMes ? `, después de ${Utils.escapeHtml(ultimoMes.titulo)}` : '';
      return '<div class="almanaque-fila"><div class="almanaque-rotulo"><h2>Más adelante</h2>'
        + `<span class="almanaque-cuenta">${textoCantidad(n)}${despuesDe}</span></div>${htmlDeFichas(fila.datasets, true)}</div>`;
    }
    const clases = `almanaque-fila${fila.actual ? ' actual' : ''}${n ? '' : ' sin-nada'}`;
    return `<div class="${clases}"><div class="almanaque-rotulo">${htmlDelRotuloDelMes(fila)}`
      + (n ? `<span class="almanaque-cuenta">${textoCantidad(n)}</span>` : '')
      + (fila.actual ? '<span class="este-mes">Este mes</span>' : '')
      + `</div>${n ? htmlDeFichas(fila.datasets, false) : '<p class="vacio">Nada vence este mes.</p>'}</div>`;
  }).join('');
}

// =====================================================
// EXPORTAR iCAL
// =====================================================

function exportarIcal() {
  const datasetsFiltrados = filtrarCalendario(datasets, filtrosActuales());
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
