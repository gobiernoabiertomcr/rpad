// El PDF «Estado general de los datasets» (spec 2026-10-24-metricas-y-reportes, 5: el mismo contenido de antes, con el diseño de
// los anexos; maqueta 6-reportes-datos-reales.html): el rótulo y el título, la píldora del índice, las cinco tarjetas (Total,
// Actualizados, Próximos, Vencidos y Eventuales: con los sin fecha, suman el total), la tasa con las aclaraciones de los eventuales y
// los sin fecha y la tabla de todos los datasets activos, que corta de hoja y repite su encabezado. Pie: «Estado general · Hoja k
// de N». Dibuja con la base de los reportes (reportesPdfBase.js); los estados vienen calculados (estadoDelDataset) y la tasa es
// tasaDeActualizacion, la misma de la portada y de Métricas.
import { COLOR, IZQUIERDA, CONTENIDO, NORMAL, NEGRITA, renglon } from './notasDigitalesAnexo.js';
import { formatoCorto } from './notasDigitalesCalendario.js';
import { tasaDeActualizacion } from './fechasDatasetReglas.js';
import {
  nuevoReporte, agregarHoja, cerrarReporte, dibujarTitulo, dibujarPildora, dibujarTarjetas, prepararTabla, fechaCorta, textoSinFecha, ENTRE
} from './reportesPdfBase.js';

const TITULO = 'Estado general de los datasets';

// El texto del estado de cada fila (los de estadoDelDataset)
const TEXTO_ESTADO = {
  actualizado: 'Actualizado', proximo: 'Próximo a vencer', atrasado: 'Atrasado', 'sin-respuesta': 'Sin respuesta',
  'sin-fecha': 'Sin fecha', eventual: 'Eventual'
};

// Las columnas de la tabla: la parte del ancho útil de cada una (la frecuencia más larga, «Cuatrimestralmente», y «Próximo a vencer»
// en su insignia entran en una línea)
const COLUMNAS = [
  { titulo: 'Título', ancho: 134 }, { titulo: 'Área', ancho: 122 }, { titulo: 'Frecuencia', ancho: 78 },
  { titulo: 'Datos al', ancho: 50 }, { titulo: 'Próx. Act.', ancho: 50 }, { titulo: 'Estado', ancho: 76 }
];

// Los renglones de la tasa y sus aclaraciones, debajo de las tarjetas
const RENGLONES = { tasa: { tamano: 8.5, fuente: NEGRITA, color: COLOR.tinta }, aclaracion: { tamano: 8, fuente: NORMAL, color: COLOR.gris } };
const INTERLINEA = 1.4;

// Cuántos hay de cada estado y la tasa. Los eventuales van aparte: no son actualizados ni entran en la tasa; los sin fecha entran en
// la tasa como no al día. (actualizados + próximos) sobre el total sin los eventuales: la misma tasa que la portada y Métricas.
const resumenDe = (datasets) => {
  const cuantos = (estado) => datasets.filter(d => d.estado === estado).length;
  const r = {
    total: datasets.length, actualizados: cuantos('actualizado'), proximos: cuantos('proximo'), atrasados: cuantos('atrasado'),
    sinRespuesta: cuantos('sin-respuesta'), eventuales: cuantos('eventual'), sinFecha: cuantos('sin-fecha')
  };
  r.alDia = r.actualizados + r.proximos;
  r.conVencimiento = r.total - r.eventuales;
  r.tasa = tasaDeActualizacion({ alDia: r.alDia, total: r.total, eventuales: r.eventuales });
  return r;
};

const aclaracionesDe = (r) => [
  { texto: `Tasa de actualización: ${r.tasa ?? 0}%`, ...RENGLONES.tasa },
  ...(r.eventuales > 0 ? [{
    texto: r.eventuales === 1
      ? 'El dataset eventual no entra en la tasa: no tiene fecha de vencimiento.'
      : `Los ${r.eventuales} datasets eventuales no entran en la tasa: no tienen fecha de vencimiento.`,
    ...RENGLONES.aclaracion
  }] : []),
  ...(r.sinFecha > 0 ? [{
    texto: `${textoSinFecha(r.sinFecha)}: ${r.sinFecha === 1 ? 'cuenta' : 'cuentan'} en la tasa como no al día.`,
    ...RENGLONES.aclaracion
  }] : [])
];

// Un renglón debajo del otro; devuelve la y de lo que sigue
const dibujarRenglones = (doc, renglones, y) => {
  let yRenglon = y;
  for (const { texto, tamano, fuente, color } of renglones) {
    renglon(doc, texto, IZQUIERDA, yRenglon, { ancho: CONTENIDO, tamano, fuente, color });
    yRenglon += tamano * INTERLINEA;
  }
  return yRenglon + ENTRE;
};

// El PDF. `datasets`: los activos, en el orden de la tabla, cada uno { titulo, area, frecuencia, datos_al, proxima, estado }, con las
// fechas 'AAAA-MM-DD' (o null) y el estado de estadoDelDataset. `hoy`: 'AAAA-MM-DD'; `generado`: { momento, por } (el pie).
export const renderEstadoGeneral = async (datasets, { hoy, generado }) => {
  const lista = Array.isArray(datasets) ? datasets : [];
  const r = resumenDe(lista);
  const doc = nuevoReporte({ titulo: TITULO });
  let y = agregarHoja(doc, { derecha: TITULO, fecha: hoy });
  y = dibujarTitulo(doc, {
    rotulo: `Estado general · al ${formatoCorto(hoy)}`,
    titulo: r.total === 1 ? '1 conjunto de datos en el registro' : `${r.total} conjuntos de datos en el registro`
  }, y);
  // Sin ninguno con vencimiento no hay nada que medir: no hay píldora. «82%», sin espacio, como «Tasa de actualización: 82%» de abajo, la
  // portada, Métricas y el Informe (Ruling 38)
  if (r.tasa !== null) y = dibujarPildora(doc, `El ${r.tasa}% de los que tienen vencimiento están al día: ${r.alDia} de ${r.conVencimiento}`, y);
  y = dibujarTarjetas(doc, [
    { valor: r.total, rotulo: 'Total Datasets' },
    { valor: r.actualizados, rotulo: 'Actualizados' },
    { valor: r.proximos, rotulo: 'Próximos' },
    { valor: r.atrasados + r.sinRespuesta, rotulo: 'Vencidos' },
    { valor: r.eventuales, rotulo: 'Eventuales' }
  ], y);
  y = dibujarRenglones(doc, aclaracionesDe(r), y);
  prepararTabla(doc, {
    columnas: COLUMNAS,
    filas: lista.map(d => [
      d.titulo || '—', d.area || '—', d.frecuencia || '—', fechaCorta(d.datos_al), fechaCorta(d.proxima), TEXTO_ESTADO[d.estado] ?? d.estado ?? '—'
    ]),
    estados: lista.map(d => d.estado)
  }).dibujar(y);
  return cerrarReporte(doc, { generado, pieDe: (k, n) => `Estado general · Hoja ${k} de ${n}` });
};
