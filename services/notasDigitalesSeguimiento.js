// El anexo de la reiteración (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2): un solo PDF con la hoja del Seguimiento de
// cada dataset de la nota (services/seguimientoPdf.js), en el orden de la tabla. Lo arma generarNota (services/notasDigitales.js):
// lee las fuentes antes de abrir la transacción (fuentesDeLaNota) y dibuja adentro, ya con el número (renderAnexoDeReiteracion). El
// Seguimiento se calcula con la fecha de la nota como hoy. Con la reiteración que acompaña (seguimientosDeLaNota con `propia`; spec
// 2026-10-24-reiteracion-en-su-anexo), cada hoja la suma a una copia de las fuentes de su dataset (notaPropiaDe): es el movimiento
// más nuevo, cuenta en «Avisos del ciclo abierto» y tiene su marca en la cinta. Lleva las notas DGMIT cargadas hasta el momento en
// que se genera; sin nota, el tramo de la nota formal es neutral (spec 2026-10-24-notas-dgmit, 7).
import { fuentesDe } from './seguimientoDatos.js';
import { seguimientoDe } from './seguimientoReglas.js';
import { renderAnexoDeSeguimiento, OPCIONES_CINTA_PDF } from './seguimientoPdf.js';

// El circuito del anexo (spec 2026-10-24-notas-dgmit, 7): el anexo le llega solo a la DGMIT y a la Dirección Administrativa con cada
// reiteración, así que sin una nota DGMIT cargada el tramo de la nota formal es neutral («La manda la DGMIT al área»), nunca
// «Pendiente de carga». Con una nota cargada hasta el momento de generarlo, la muestra en violeta, como el PDF de la descarga.
const OPCIONES_CIRCUITO_ANEXO = Object.freeze({ anexo: true });

// El vencido de la tabla, con la misma comparación que construirNota (notasDigitalesContenido.js): vence antes del día de la nota
const vencido = (dataset, fecha) => dataset.vencimiento < fecha;

// Los datasets en el orden de la tabla de la nota: primero los próximos a vencer (vencimiento >= fecha) y después los vencidos.
// Estable: dentro de cada grupo, el orden en que vienen (el de la selección). Devuelve una lista nueva.
export const ordenDeLaTabla = (datasets, fecha) => [
  ...datasets.filter(d => !vencido(d, fecha)),
  ...datasets.filter(d => vencido(d, fecha))
];

/**
 * Las fuentes del Seguimiento de cada dataset de la nota: Map<id, Fuentes>. fuentesPorId: un Map ya armado (las fuentes de ejemplo
 * de la vista previa y la prueba), que se devuelve tal cual; sin él, se leen de la base con una sola llamada a fuentesDe, con todos
 * los ids. Si falta la fuente de algún dataset, tira error: la nota no puede salir anunciando una hoja que su anexo no tiene.
 */
export const fuentesDeLaNota = async (datasets, fuentesPorId = null) => {
  const fuentes = fuentesPorId ?? await fuentesDe(datasets.map(d => d.id));
  for (const dataset of datasets) {
    if (!fuentes.get(dataset.id)) throw new Error(`El anexo de la reiteración necesita el Seguimiento de cada dataset: falta el del dataset ${dataset.id}`);
  }
  return fuentes;
};

/**
 * La reiteración que acompaña al anexo, como la nota de un dataset que da fuentesDe (aNota, services/seguimientoDatos.js), con lo
 * que generarNota va a guardar: enviada (el anexo viaja en el mismo email que la nota), la sección con la regla del INSERT de
 * notas_digitales_datasets, el vencimiento del dataset (el del ciclo abierto) y su pedido. propia: { numero, anio, gestion, enviada
 * ('AAAA-MM-DD HH:MM:SS': la fecha de la nota con la hora de la generación), para, cc, creado_por, firmante (nombre_completo o
 * null) }. En la vista previa y la prueba, numero 'XX' o 'PRUEBA' y anio null.
 */
export const notaPropiaDe = (dataset, fecha, propia) => ({
  id: null, numero: propia.numero ?? null, anio: propia.anio ?? null, tipo: 'reiteracion', gestion: propia.gestion ?? null, fecha,
  estado: 'enviada', enviada: propia.enviada ?? null, para: propia.para, cc: propia.cc ?? null,
  seccion: vencido(dataset, fecha) ? 'vencido' : 'proximo', vencimiento: dataset.vencimiento ?? null,
  datos_solicitados: dataset.pedido?.texto ?? null, creado_por: propia.creado_por ?? null, firmante: propia.firmante ?? null
});

// Una copia de las fuentes de un dataset con la reiteración propia como última nota. Antes se saca la reiteración de la misma fecha
// y gestión que ya estuviera (la vista previa abierta después de la corrida del día): la nota nunca va dos veces en una hoja. Las
// de otro día quedan: se enviaron de verdad. Ni el objeto ni su lista de notas se modifican.
const conLaNotaPropia = (fuentes, dataset, fecha, propia) => ({
  ...fuentes,
  notas: [
    ...(Array.isArray(fuentes.notas) ? fuentes.notas : [])
      .filter(n => !(n?.tipo === 'reiteracion' && n.fecha === fecha && n.gestion === propia.gestion)),
    notaPropiaDe(dataset, fecha, propia)
  ]
});

/**
 * El Seguimiento de cada dataset de la nota, en el orden de la tabla, calculado con la fecha de la nota como hoy, las opciones de
 * la cinta del PDF y el circuito del anexo (OPCIONES_CIRCUITO_ANEXO). fuentesPorId: las de fuentesDeLaNota (sin él, las lee ella).
 * propia: la reiteración que acompaña (ver notaPropiaDe); con ella, cada hoja la suma a una copia de las fuentes de su dataset; sin
 * ella, las fuentes van tal cual. Si falta la fuente de algún dataset, tira error (fuentesDeLaNota).
 */
export const seguimientosDeLaNota = async (datasets, fecha, fuentesPorId = null, propia = null) => {
  const ordenados = ordenDeLaTabla(datasets, fecha);
  const fuentes = await fuentesDeLaNota(ordenados, fuentesPorId);
  return ordenados.map((dataset) => {
    const delDataset = fuentes.get(dataset.id);
    const conLaNota = propia ? conLaNotaPropia(delDataset, dataset, fecha, propia) : delDataset;
    return seguimientoDe(conLaNota, fecha, OPCIONES_CINTA_PDF, OPCIONES_CIRCUITO_ANEXO);
  });
};

/**
 * El PDF del anexo: una hoja por seguimiento, en el orden recibido. Arriba, la fecha larga de la nota; en el pie, «Generado el …»
 * sin «por» (es un envío automático; momento: 'AAAA-MM-DD HH:MM:SS', la hora de la generación) y «Anexo de la Nota Digital N°
 * <numeroTexto> · Hoja k de N», con el número como lo escribe la nota (textoNumero: 'N/AA', 'XX' o 'PRUEBA').
 */
export const renderAnexoDeReiteracion = ({ seguimientos, fecha, numeroTexto, momento }) =>
  renderAnexoDeSeguimiento(seguimientos, { hoy: fecha, generado: { momento, por: null }, numeroTexto });
