// El anexo de la reiteración (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2): un solo PDF con la hoja del Seguimiento de
// cada dataset de la nota (services/seguimientoPdf.js), en el orden de la tabla. Lo arma generarNota (services/notasDigitales.js):
// lee las fuentes antes de abrir la transacción (seguimientosDeLaNota) y dibuja adentro, ya con el número (renderAnexoDeReiteracion).
// El Seguimiento se calcula con la fecha de la nota como hoy: la hoja muestra todo lo anterior a la nota, no la reiteración que
// acompaña (todavía no existe).
import { fuentesDe } from './seguimientoDatos.js';
import { seguimientoDe } from './seguimientoReglas.js';
import { renderAnexoDeSeguimiento, OPCIONES_CINTA_PDF } from './seguimientoPdf.js';

// El vencido de la tabla, con la misma comparación que construirNota (notasDigitalesContenido.js): vence antes del día de la nota
const vencido = (dataset, fecha) => dataset.vencimiento < fecha;

// Los datasets en el orden de la tabla de la nota: primero los próximos a vencer (vencimiento >= fecha) y después los vencidos.
// Estable: dentro de cada grupo, el orden en que vienen (el de la selección). Devuelve una lista nueva.
export const ordenDeLaTabla = (datasets, fecha) => [
  ...datasets.filter(d => !vencido(d, fecha)),
  ...datasets.filter(d => vencido(d, fecha))
];

/**
 * El Seguimiento de cada dataset de la nota, en el orden de la tabla, calculado con la fecha de la nota como hoy y las opciones de
 * la cinta del PDF. fuentesPorId: Map<id, Fuentes> ya armado (las fuentes de ejemplo de la vista previa y la prueba); sin él, se
 * leen de la base con una sola llamada a fuentesDe, con todos los ids. Si falta la fuente de algún dataset, tira error: la nota no
 * puede salir anunciando una hoja que su anexo no tiene.
 */
export const seguimientosDeLaNota = async (datasets, fecha, fuentesPorId = null) => {
  const ordenados = ordenDeLaTabla(datasets, fecha);
  const fuentes = fuentesPorId ?? await fuentesDe(ordenados.map(d => d.id));
  return ordenados.map((dataset) => {
    const delDataset = fuentes.get(dataset.id);
    if (!delDataset) throw new Error(`El anexo de la reiteración necesita el Seguimiento de cada dataset: falta el del dataset ${dataset.id}`);
    return seguimientoDe(delDataset, fecha, OPCIONES_CINTA_PDF);
  });
};

/**
 * El PDF del anexo: una hoja por seguimiento, en el orden recibido. Arriba, la fecha larga de la nota; en el pie, «Generado el …»
 * sin «por» (es un envío automático; momento: 'AAAA-MM-DD HH:MM:SS', la hora de la generación) y «Anexo de la Nota Digital N°
 * <numeroTexto> · Hoja k de N», con el número como lo escribe la nota (textoNumero: 'N/AA', 'XX' o 'PRUEBA').
 */
export const renderAnexoDeReiteracion = ({ seguimientos, fecha, numeroTexto, momento }) =>
  renderAnexoDeSeguimiento(seguimientos, { hoy: fecha, generado: { momento, por: null }, numeroTexto });
