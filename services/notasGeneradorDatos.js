/**
 * Generador de Notas (spec 2026-10-24-generador-de-notas, secciones 3.1, 3.2, 4.5 y 7): las consultas, de solo lectura. Lo que la
 * página y la nota necesitan de las áreas y de sus datasets, calculado con las reglas de siempre, sin copiarlas:
 * - qué datasets se pueden elegir: `sePuedeElegir` (`notasDgmitReglas.js`), la misma regla que la carga de notas DGMIT;
 * - el estado y los días: `estadoDelDataset`, con hoy en la lista de áreas (paso 1) y con la fecha de la nota en un área (paso 2)
 *   y en la nota;
 * - el tipo efectivo y los "Datos solicitados": `conPedido` (`notasDigitalesDatos.js`), el mismo cálculo de las Notas Digitales:
 *   la nota de la DGMIT y la Nota Digital no pueden pedir cosas distintas sobre el mismo dataset (antiobjetivo de la spec);
 * - la frecuencia: `frecuenciaEnNota`;
 * - las notas DGMIT del ciclo abierto: `notasDgmitDelCicloAbierto` sobre las fuentes del Seguimiento (`fuentesDe`).
 * Las fechas salen de la base como texto 'AAAA-MM-DD' (DATE_FORMAT). No se guarda nada.
 */
import pool from '../config/database.js';
import { esFechaIso } from './notasDigitalesCalendario.js';
import { estadoDelDataset, frecuenciaEnNota } from './fechasDatasetReglas.js';
import { conPedido } from './notasDigitalesDatos.js';
import { sePuedeElegir } from './notasDgmitReglas.js';
import { sePuedePedir, ordenDeLosDatasets } from './notasGeneradorReglas.js';
import { notasDgmitDelCicloAbierto } from './seguimientoReglas.js';
import { fuentesDe } from './seguimientoDatos.js';

const SELECT_AREAS = 'SELECT id, nombre, ambito, area_superior, articulo, articulo_superior FROM areas';

// Lo que piden sePuedeElegir (activo, tipo_gestion y requiere_nota), estadoDelDataset y conPedido (con los nombres de las Notas
// Digitales: `vencimiento` es la próxima y `frecuencia_nombre` la frecuencia), y lo que va en la nota
const SELECT_DATASETS = `SELECT d.id, d.titulo, d.area_id, d.activo, d.tipo_gestion, d.requiere_nota, d.tipo_pedido, d.que_se_solicita,
    f.nombre AS frecuencia_nombre, f.meses, DATE_FORMAT(d.proxima_actualizacion, '%Y-%m-%d') AS vencimiento,
    DATE_FORMAT(d.datos_al, '%Y-%m-%d') AS datos_al
  FROM datasets d
  JOIN frecuencias f ON f.id = d.frecuencia_id`;

// Un dataset a una fecha: lo de la lista de áreas, { id, titulo, estado, dias, proxima }. La próxima, solo si es una fecha (una
// fecha cero de MariaDB, '0000-00-00', no lo es)
const resumenALaFecha = (fila, fecha) => {
  const { estado, dias } = estadoDelDataset({ proxima: fila.vencimiento, meses: fila.meses ?? null, tipoGestion: fila.tipo_gestion, hoy: fecha });
  return { id: fila.id, titulo: fila.titulo, estado, dias, proxima: esFechaIso(fila.vencimiento) ? fila.vencimiento : null };
};

// Un dataset a la fecha de la nota, con lo que va en ella: la frecuencia como la dicen las notas, los "Datos solicitados" (el texto
// del pedido, null sin pedido: eventual o sin fecha), el "Qué se solicita" tal cual (vacío, la nota pone el texto por defecto) y si
// se puede pedir (no está al día a esa fecha)
const datasetALaFecha = (fila, fecha) => {
  const resumen = resumenALaFecha(fila, fecha);
  const { tipo_pedido: tipo, meses, pedido } = conPedido(fila, fecha);
  return {
    ...resumen,
    frecuencia: frecuenciaEnNota({ frecuencia: fila.frecuencia_nombre, tipo, meses }),
    datos_solicitados: pedido?.texto ?? null,
    que_se_solicita: fila.que_se_solicita ?? null,
    se_puede_pedir: sePuedePedir(resumen.estado)
  };
};

/**
 * Una copia de los datasets ({ estado, dias, proxima, titulo }, calculados a una fecha) en el orden de la lista y de la tabla
 * (ordenDeLosDatasets). Un eventual no tiene vencimiento: se ordena sin su próxima, que puede ser una fecha vieja guardada, y no
 * entre los demás por ella.
 * @template T
 * @param {T[]} datasets
 * @returns {T[]}
 */
export const enElOrdenDeLaTabla = (datasets) => ordenDeLosDatasets(
  datasets.map((dataset) => ({ ...dataset, proxima: dataset.estado === 'eventual' ? null : dataset.proxima, dataset }))
).map(({ dataset }) => dataset);

/**
 * Las áreas del paso 1: las que tienen algún dataset que se puede elegir (sePuedeElegir), cada una solo con esos datasets, con el
 * estado de hoy y en el orden de la tabla. Las áreas, por nombre. Dos consultas: las áreas y los datasets.
 * @param {string} hoy 'AAAA-MM-DD'
 * @returns {Promise<{ id, nombre, ambito, area_superior, articulo, articulo_superior,
 *   datasets: { id, titulo, estado, dias, proxima }[] }[]>}
 */
export const areasParaElGenerador = async (hoy) => {
  const [[areas], [filas]] = await Promise.all([
    pool.query(`${SELECT_AREAS} ORDER BY nombre`),
    pool.query(`${SELECT_DATASETS} ORDER BY d.id`)
  ]);
  const porArea = new Map();
  for (const fila of filas.filter(sePuedeElegir)) {
    if (!porArea.has(fila.area_id)) porArea.set(fila.area_id, []);
    porArea.get(fila.area_id).push(resumenALaFecha(fila, hoy));
  }
  return areas
    .filter((area) => porArea.has(area.id))
    .map((area) => ({ ...area, datasets: enElOrdenDeLaTabla(porArea.get(area.id)) }));
};

/**
 * Un área (sin sus datasets): { id, nombre, ambito, area_superior, articulo, articulo_superior }, o null si no existe.
 * @param {number} areaId
 */
export const areaDelGenerador = async (areaId) => {
  const [[area]] = await pool.query(`${SELECT_AREAS} WHERE id = ?`, [areaId]);
  return area ?? null;
};

/**
 * Un área del paso 2, con sus datasets que se pueden elegir (sePuedeElegir) calculados a la fecha de la nota: el estado, la
 * frecuencia, los "Datos solicitados", el "Qué se solicita", si se puede pedir y las notas DGMIT del ciclo abierto (una sola
 * llamada a fuentesDe), en el orden de la tabla. Un área sin datasets que se puedan elegir sale con la lista vacía.
 * @param {number} areaId
 * @param {string} fecha 'AAAA-MM-DD', la fecha de la nota
 * @returns {Promise<null|{ id, nombre, ambito, area_superior, articulo, articulo_superior,
 *   datasets: { id, titulo, estado, dias, proxima, frecuencia, datos_solicitados, que_se_solicita, se_puede_pedir,
 *   notas_dgmit: { numero, tipo, recibida }[] }[] }>} null si el área no existe.
 */
export const areaParaElGenerador = async (areaId, fecha) => {
  const area = await areaDelGenerador(areaId);
  if (!area) return null;
  const [filas] = await pool.query(`${SELECT_DATASETS} WHERE d.area_id = ? ORDER BY d.id`, [areaId]);
  const elegibles = filas.filter(sePuedeElegir);
  const fuentes = await fuentesDe(elegibles.map((fila) => fila.id));
  const datasets = elegibles.map((fila) => ({
    ...datasetALaFecha(fila, fecha),
    notas_dgmit: notasDgmitDelCicloAbierto(fuentes.get(fila.id), fecha)
  }));
  return { ...area, datasets: enElOrdenDeLaTabla(datasets) };
};

/**
 * Los datasets de una nota, calculados a su fecha: Map<id, dataset>, con lo de areaParaElGenerador (sin las notas DGMIT) más
 * `area_id` y `se_puede_elegir` (sePuedeElegir), para validar el pedido. Un id que no existe no figura.
 * @param {number[]} ids
 * @param {string} fecha 'AAAA-MM-DD', la fecha de la nota
 */
export const datasetsDeLaNota = async (ids, fecha) => {
  if (ids.length === 0) return new Map();
  const [filas] = await pool.query(`${SELECT_DATASETS} WHERE d.id IN (?)`, [ids]);
  return new Map(filas.map((fila) => [fila.id, {
    ...datasetALaFecha(fila, fecha), area_id: fila.area_id, se_puede_elegir: sePuedeElegir(fila)
  }]));
};
