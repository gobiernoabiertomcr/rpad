// Portada (spec 2026-10-18-rediseno-publico, 6): el índice de actualización, el mosaico del registro, lo que vence en los
// próximos 12 meses, los vencidos, los próximos a vencer y las últimas cargas en el portal.
// Al cargarse solo declara y registra su DOMContentLoaded: lo que cuenta y arma el HTML es puro (textoIndice,
// gruposDelMosaico, htmlDelMosaico, htmlDeLosMeses, ultimasCargas, htmlDeFila...) y tests/publico-frontend.test.js lo carga
// en un vm. Los estados, los días y la tasa son los que manda el servidor (d.estado, d.dias_para_vencer, tasaActualizacion),
// y las fechas se leen por su texto (spec 2026-10-17-fechas-datasets, 11)

// Los conjuntos de datos del mosaico, por id: el pie del panel los busca al pasar el mouse o el foco (los pone dibujarPortada)
let datasetsDelMosaico = new Map();

document.addEventListener('DOMContentLoaded', () => {
  prepararPieDelMosaico();
  cargarPortada();
});

// =====================================================
// CARGA Y DIBUJO (tocan el DOM y la API)
// =====================================================

// Pide las estadísticas y los datasets con API.pedirJson, que tira error ante una respuesta de error (getDatasets y
// getEstadisticas devolverían [] o undefined y la portada mostraría ceros engañosos). Si falla cualquiera de los dos, o el
// dibujo (un dato raro), solo queda el aviso: nunca "Cargando…" para siempre
async function cargarPortada() {
  try {
    const [respuestaEstadisticas, respuestaDatasets] = await Promise.all([
      API.pedirJson('GET', '/datasets/estadisticas'),
      API.pedirJson('GET', '/datasets')
    ]);
    const estadisticas = respuestaEstadisticas?.data;
    const datasets = respuestaDatasets?.data;
    if (!estadisticas || !Array.isArray(datasets)) throw new Error('La respuesta no trae los datos del registro');
    dibujarPortada(estadisticas, datasets);
  } catch (error) {
    console.error('Error cargando la portada:', error);
    mostrarErrorDePortada();
  }
}

function dibujarPortada(estadisticas, datasets) {
  const hoy = Utils.hoyEnArgentina();

  const indice = textoIndice(estadisticas);
  ponerHtml('indice-frase', htmlDeLaFrase(indice));
  ponerTexto('indice-aclaracion', indice.aclaracion);
  ponerTexto('indice-situacion', textoSituacion(hoy));

  datasetsDelMosaico = new Map(datasets.map(d => [String(d.id), d]));
  ponerHtml('mosaico-grupos', htmlDelMosaico(gruposDelMosaico(datasets)));

  const meses = mesesDelGrafico(hoy);
  ponerHtml('meses-marco', htmlDeLosMeses(meses, vencimientosPorMes(datasets, meses)));

  const { vencidos, proximos } = alertasDe(datasets);
  ponerHtml('vencidos', vencidos.length
    ? vencidos.slice(0, 6).map(d => htmlDeFila(d, datoDeVencido(d))).join('')
    : htmlDeListaVacia('No hay conjuntos vencidos.'));
  const verVencidos = document.getElementById('ver-vencidos');
  if (verVencidos) {
    verVencidos.textContent = textoVerVencidos(vencidos.length);
    verVencidos.classList.toggle('hidden', vencidos.length === 0);
  }
  ponerHtml('proximos', proximos.length
    ? proximos.map(d => htmlDeFila(d, datoDeProximo(d))).join('')
    : htmlDeListaVacia('Ninguno vence en los próximos 60 días.'));

  const ultimas = ultimasCargas(datasets);
  ponerHtml('ultimas', ultimas.length
    ? ultimas.map(d => htmlDeFila(d, datoDeCarga(d))).join('')
    : htmlDeListaVacia('Todavía no hay cargas en el portal.'));

  mostrarDatosDePortada(true);
}

// El aviso en la banda, y nada dibujado con números viejos o en cero
function mostrarErrorDePortada() {
  for (const id of ['indice-frase', 'indice-aclaracion', 'indice-situacion']) ponerTexto(id, '');
  mostrarDatosDePortada(false);
}

function mostrarDatosDePortada(hayDatos) {
  document.getElementById('portada-error')?.classList.toggle('hidden', hayDatos);
  for (const id of ['mosaico', 'seccion-meses', 'portada-listas']) {
    document.getElementById(id)?.classList.toggle('hidden', !hayDatos);
  }
  document.querySelector('.portada-banda')?.classList.toggle('portada-sin-datos', !hayDatos);
}

// Al pasar el mouse o el foco por un cuadrito, el pie del panel (aria-live) dice cuál es. Delegación sobre #mosaico: los
// cuadritos se vuelven a dibujar en cada carga
function prepararPieDelMosaico() {
  const mosaico = document.getElementById('mosaico');
  const pie = document.getElementById('mosaico-pie');
  if (!mosaico || !pie) return;
  const mostrar = (evento) => {
    const cuadro = evento.target?.closest?.('.cuadro');
    const dataset = cuadro ? datasetsDelMosaico.get(cuadro.dataset.id) : null;
    // El mismo cuadrito no se vuelve a anunciar
    if (!dataset || pie.dataset.id === cuadro.dataset.id) return;
    pie.dataset.id = cuadro.dataset.id;
    pie.innerHTML = htmlDelPie(dataset);
  };
  mosaico.addEventListener('mouseover', mostrar);
  mosaico.addEventListener('focusin', mostrar);
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
// LO PURO: el índice, el mosaico, los 12 meses y las listas
// =====================================================

// "83%": la tasa del servidor (actualizados + próximos sobre el total sin los eventuales; tasaDeActualizacion)
function textoTasa(stats) {
  return `${stats?.tasaActualizacion ?? 0}%`;
}

/**
 * Los textos del índice, con los números del servidor (/datasets/estadisticas). La base es la misma de la tasa: el total
 * sin los eventuales. { tasa: '80%', frase: 'El 80% de … están al día: 53 de 66.', aclaracion: 'El registro sigue …' }
 */
function textoIndice(stats) {
  const numero = (valor) => Number(valor) || 0;
  const total = numero(stats?.total);
  const eventuales = numero(stats?.eventuales);
  const sinFecha = numero(stats?.sinFecha);
  const tasa = textoTasa(stats);
  const alDia = numero(stats?.actualizados) + numero(stats?.proximos);
  const frase = `El ${tasa} de los conjuntos de datos con fecha de actualización están al día: ${alDia} de ${total - eventuales}.`;
  let aclaracion = `El registro sigue ${total} ${total === 1 ? 'conjunto' : 'conjuntos'}.`;
  if (eventuales === 1) aclaracion += ' El otro es eventual: se publica cuando hay novedades y no tiene vencimiento.';
  else if (eventuales > 1) aclaracion += ` Los otros ${eventuales} son eventuales: se publican cuando hay novedades y no tienen vencimiento.`;
  if (sinFecha > 0) aclaracion += ` ${sinFecha} todavía no ${sinFecha === 1 ? 'tiene' : 'tienen'} fecha de próxima actualización.`;
  return { tasa, frase, aclaracion };
}

// La frase, escapada, con la tasa destacada
function htmlDeLaFrase({ tasa, frase }) {
  const cifra = Utils.escapeHtml(tasa);
  return Utils.escapeHtml(frase).replace(cifra, `<strong class="indice-cifra">${cifra}</strong>`);
}

// 'Situación al domingo 18 de octubre de 2026.': el día de la semana sale del texto en UTC, no de la zona del navegador
function textoSituacion(hoy) {
  const fecha = Utils.soloFecha(hoy);
  if (!fecha) return '';
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const DIAS_DE_LA_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const diaDeLaSemana = DIAS_DE_LA_SEMANA[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()];
  return `Situación al ${diaDeLaSemana} ${dia} de ${Utils.nombreDeMes(mes)} de ${anio}.`;
}

function porTitulo(a, b) {
  return String(a?.titulo ?? '').localeCompare(String(b?.titulo ?? ''), 'es');
}

/**
 * Los grupos del mosaico, con el estado del servidor: Actualizados, Próximos a vencer, Vencidos (atrasados y sin respuesta),
 * Eventuales y, solo si hay, Sin fecha. Cada grupo por título. [{ etiqueta, estados, datasets }]
 */
function gruposDelMosaico(datasets) {
  return [
    { etiqueta: 'Actualizados', estados: ['actualizado'] },
    { etiqueta: 'Próximos a vencer', estados: ['proximo'] },
    { etiqueta: 'Vencidos', estados: ['atrasado', 'sin-respuesta'] },
    { etiqueta: 'Eventuales', estados: ['eventual'] },
    { etiqueta: 'Sin fecha', estados: ['sin-fecha'] }
  ]
    .map(grupo => ({ ...grupo, datasets: datasets.filter(d => grupo.estados.includes(Utils.estadoDe(d))).sort(porTitulo) }))
    .filter(grupo => grupo.etiqueta !== 'Sin fecha' || grupo.datasets.length > 0);
}

// El id de un dataset, seguro dentro de un href y de un atributo entre comillas dobles
function idDelDataset(d) {
  return encodeURIComponent(String(d?.id ?? ''));
}

function htmlDelCuadro(d) {
  const estado = Utils.estadoDe(d);
  const id = idDelDataset(d);
  return `<a class="cuadro c-${Utils.escapeHtml(estado)}" href="dataset.html?id=${id}" data-id="${id}" aria-label="${Utils.escapeHtml(d.titulo)}, ${Utils.escapeHtml(Utils.getEstadoTextoLargo(estado))}"></a>`;
}

// Cada grupo con su cantidad y un cuadrito (link al detalle) por conjunto; Vencidos, con la leyenda de sus dos colores
function htmlDelMosaico(grupos) {
  const leyendaDeVencidos = '<div class="leyenda-vencidos">'
    + '<span><span class="tile c-atrasado" aria-hidden="true"></span>Atrasado (gestión interna)</span>'
    + '<span><span class="tile c-sin-respuesta" aria-hidden="true"></span>Sin respuesta del área (gestión externa)</span>'
    + '</div>';
  return grupos.map(grupo => '<div class="mosaico-grupo">'
    + `<div class="mosaico-cabeza"><h3>${Utils.escapeHtml(grupo.etiqueta)}</h3><span class="mosaico-cuenta">${grupo.datasets.length}</span></div>`
    + `<div class="cuadros">${grupo.datasets.map(htmlDelCuadro).join('')}</div>`
    + (grupo.estados.includes('atrasado') ? leyendaDeVencidos : '')
    + '</div>').join('');
}

// El pie del mosaico: título, área y estado largo
function htmlDelPie(d) {
  const area = Utils.escapeHtml(d.area_nombre) || 'Sin área asignada';
  return `<strong>${Utils.escapeHtml(d.titulo)}</strong><br>${area}. ${Utils.escapeHtml(Utils.getEstadoTextoLargo(Utils.estadoDe(d)))}.`;
}

/**
 * Los 12 meses del gráfico, desde el mes de `hoy` ('AAAA-MM-DD', la fecha de Argentina): { clave: 'AAAA-MM', etiqueta:
 * 'oct 26', titulo: 'octubre de 2026' }. Se cuentan sobre el índice año × 12 + mes, sin new Date.
 */
function mesesDelGrafico(hoy) {
  const primero = Number(hoy.slice(0, 4)) * 12 + Number(hoy.slice(5, 7)) - 1;
  return Array.from({ length: 12 }, (_, i) => {
    const anio = Math.floor((primero + i) / 12);
    const mes = ((primero + i) % 12) + 1;
    const clave = `${anio}-${String(mes).padStart(2, '0')}`;
    return { clave, etiqueta: `${Utils.nombreDeMes(mes).slice(0, 3)} ${String(anio).slice(-2)}`, titulo: Utils.mesDeAnio(`${clave}-01`) };
  });
}

// Cuántos datasets vencen en cada mes: el mismo Utils.mesDeVencimiento que usa el filtro ?mes= del listado
function vencimientosPorMes(datasets, meses) {
  return meses.map(m => datasets.filter(d => Utils.mesDeVencimiento(d) === m.clave).length);
}

function urlDelMes(mes) {
  return `datasets.html?mes=${mes.clave}`;
}

/**
 * Qué vence en los próximos 12 meses: una columna por mes (link al listado de ese mes) con la cantidad y una marca por
 * conjunto, y abajo, en una fila aparte, las etiquetas ('oct 26'). El primero es el mes en curso. Va dentro de #meses-marco
 */
function htmlDeLosMeses(meses, conteos) {
  const columnas = meses.map((m, i) => {
    const n = conteos[i] || 0;
    const cuantos = n === 1 ? 'vence 1 conjunto' : `vencen ${n} conjuntos`;
    return `<a class="mes${i === 0 ? ' actual' : ''}" href="${Utils.escapeHtml(urlDelMes(m))}" aria-label="${Utils.escapeHtml(m.titulo)}: ${cuantos}">`
      + `<span class="mes-cuenta${n ? '' : ' cero'}">${n}</span><span class="mes-pila" aria-hidden="true">${'<i></i>'.repeat(n)}</span></a>`;
  }).join('');
  const nombres = meses.map((m, i) => `<span${i === 0 ? ' class="actual"' : ''}>${Utils.escapeHtml(m.etiqueta)}</span>`).join('');
  return `<div class="meses" id="meses">${columnas}</div><div class="meses-nombres" id="meses-nombres" aria-hidden="true">${nombres}</div>`;
}

// Los vencidos (atrasados y sin respuesta) y los próximos a vencer, con el estado y los días del servidor: primero los que
// vencieron hace más y los que vencen antes
function alertasDe(datasets) {
  const porDias = (a, b) => (a.dias_para_vencer ?? 0) - (b.dias_para_vencer ?? 0);
  return {
    vencidos: datasets.filter(d => ['atrasado', 'sin-respuesta'].includes(Utils.estadoDe(d))).sort(porDias),
    proximos: datasets.filter(d => Utils.estadoDe(d) === 'proximo').sort(porDias)
  };
}

// Las últimas cargas en el portal: por la fecha de carga (su texto), la más reciente primero, sin las que no tienen
function ultimasCargas(datasets, cantidad = 5) {
  return datasets
    .filter(d => Utils.soloFecha(d.ultima_actualizacion))
    .sort((a, b) => Utils.soloFecha(b.ultima_actualizacion).localeCompare(Utils.soloFecha(a.ultima_actualizacion)) || porTitulo(a, b))
    .slice(0, cantidad);
}

function textoDias(n) {
  return n === 1 ? '1 día' : `${n} días`;
}

// Una fila de las listas: toda la fila es el link al detalle. `dato` lo arma quien llama, ya seguro
function htmlDeFila(d, dato) {
  return `<li><a class="fila" href="dataset.html?id=${idDelDataset(d)}">`
    + `<span class="fila-titulo">${Utils.escapeHtml(d.titulo)}</span>`
    + `<span class="fila-meta">${Utils.escapeHtml(d.area_nombre) || 'Sin área asignada'}</span>`
    + `<span class="fila-dato">${dato}</span></a></li>`;
}

function htmlDeListaVacia(texto) {
  return `<li class="aviso">${Utils.escapeHtml(texto)}</li>`;
}

// "625 días de atraso" y la insignia del estado
function datoDeVencido(d) {
  const estado = Utils.estadoDe(d);
  return `<strong>${textoDias(Math.abs(d.dias_para_vencer ?? 0))}</strong> de atraso`
    + `<span class="badge ${Utils.getEstadoClase(estado)}">${Utils.escapeHtml(Utils.getEstadoTexto(estado))}</span>`;
}

// "14 días para vencer", o "Vence hoy"
function datoDeProximo(d) {
  const dias = d.dias_para_vencer ?? 0;
  return dias === 0 ? '<strong>Vence hoy</strong>' : `<strong>${textoDias(dias)}</strong> para vencer`;
}

// "16/10/2026 cargado": la fecha de carga en el portal, por su texto
function datoDeCarga(d) {
  return `<strong>${Utils.fechaCorta(d.ultima_actualizacion)}</strong> cargado`;
}

function textoVerVencidos(cantidad) {
  return cantidad === 1 ? 'Ver el vencido' : `Ver los ${cantidad} vencidos`;
}
