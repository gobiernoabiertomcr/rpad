/**
 * Generador de Notas (spec 2026-10-24-generador-de-notas, secciones 3.2 y 7): las reglas puras del pedido de una nota de la
 * DGMIT a un área. Sin pool ni Date local: hoy llega por parámetro (`hoyArgentina()` en el servidor). Las fechas son texto
 * 'AAAA-MM-DD' y se comparan como texto. Ninguna función tira error: una entrada rara da los errores de sus campos.
 *
 * - `validarPedidoDeNota`: lo que llega a la vista previa y a la descarga del Word. La API (`controllers/notasController.js`)
 *   chequea además en la base que el área exista y que cada dataset sea del área, se pueda elegir (`sePuedeElegir`, de
 *   `notasDgmitReglas.js`) y no esté al día a la fecha de la nota (`sePuedePedir`, con los textos de `textoAlDia` y
 *   `textoDeOtraArea`).
 * - `sePuedePedir` y `ordenDeLosDatasets`: qué datasets se pueden tildar y en qué orden van en la lista y en la tabla.
 *
 * La página tiene copias mínimas de los mensajes y del largo del número, atadas por un test de paridad: si cambia una regla o
 * un mensaje, cambia en los dos.
 */
import { esFechaIso, sumarDias, formatoCorto } from './notasDigitalesCalendario.js';
import { idsDeDatasets } from './notasDgmitReglas.js';

// Largo máximo del número de la nota y de cada nota anterior, sin los espacios de los extremos (el de las notas DGMIT)
export const LARGO_NUMERO = 40;
// La fecha de nota más vieja que se acepta
export const FECHA_MINIMA = '2025-01-01';
// Cuántos días después de hoy puede tener fecha la nota (se puede armar antes una que sale más adelante)
export const DIAS_ADELANTE = 30;

export const TIPOS_NOTA = Object.freeze(['interna', 'externa']);
export const PEDIDOS = Object.freeze(['solicitud', 'reiteracion']);

// El orden en que se informan los errores de validación: el primero va en `error` y `campo` del 400
export const ORDEN_DE_CAMPOS = Object.freeze(['fecha', 'numero', 'tipo', 'pedido', 'anteriores', 'area', 'datasets']);

// Los mensajes de cada campo, los mismos en el servidor y en la página
export const MENSAJES_GENERADOR = Object.freeze({
  fecha: 'Elegí la fecha de la nota.',
  fechaFuera: `La fecha de la nota tiene que estar entre el ${formatoCorto(FECHA_MINIMA)} y ${DIAS_ADELANTE} días después de hoy.`,
  numeroLargo: `El número de la nota puede tener hasta ${LARGO_NUMERO} caracteres.`,
  tipo: 'Elegí si la nota es interna o externa.',
  pedido: 'Elegí si es una solicitud o una reiteración.',
  anteriorLargo: `Cada número de nota anterior puede tener hasta ${LARGO_NUMERO} caracteres.`,
  area: 'Elegí el área.',
  datasets: 'Elegí al menos un dataset.'
});

// El 400 de un dataset al día a la fecha de la nota y el de uno de otra área
export const textoAlDia = (titulo) => `«${titulo}» está al día: todavía no hay datos para pedir.`;
export const textoDeOtraArea = (titulo) => `«${titulo}» no es del área elegida.`;

// Caracteres de un texto, como los cuenta el varchar de la base (no las unidades de UTF-16 de `length`)
const caracteres = (texto) => Array.from(texto).length;

// La fecha de la nota: 'AAAA-MM-DD' que existe, entre FECHA_MINIMA y hoy + DIAS_ADELANTE. Sin un hoy válido no pasa (no se
// puede saber si se pasa de los días; además, sumarDias tira con una fecha inválida)
const errorDeFecha = (fecha, hoy) => {
  if (!esFechaIso(fecha)) return MENSAJES_GENERADOR.fecha;
  if (fecha < FECHA_MINIMA) return MENSAJES_GENERADOR.fechaFuera;
  if (!esFechaIso(hoy) || fecha > sumarDias(hoy, DIAS_ADELANTE)) return MENSAJES_GENERADOR.fechaFuera;
  return null;
};

// El número de la nota, opcional: `{ valor, error }`. Sin número (undefined, null o solo espacios), null y sin error. Un texto,
// recortado en los extremos y de hasta LARGO_NUMERO caracteres. Cualquier otra cosa (un número JSON, un booleano, una lista)
// da el error del largo, el único mensaje del campo
const numeroDeLaNota = (valor) => {
  if (valor === undefined || valor === null) return { valor: null, error: null };
  if (typeof valor !== 'string') return { valor: null, error: MENSAJES_GENERADOR.numeroLargo };
  const recortado = valor.trim();
  if (recortado === '') return { valor: null, error: null };
  if (caracteres(recortado) > LARGO_NUMERO) return { valor: null, error: MENSAJES_GENERADOR.numeroLargo };
  return { valor: recortado, error: null };
};

// Los números de las notas anteriores de una reiteración: `{ valor, error }`, recortados, sin vacíos ni repetidos y en el orden
// recibido. Sin lista (undefined o null), []. Un elemento null o undefined cuenta como vacío. Un número de más de LARGO_NUMERO
// caracteres, un elemento que no es un texto o algo que no es una lista invalida el campo entero (no se descarta en silencio).
// Los vistos van en un Set: tiempo lineal
const anterioresDeLaNota = (valor) => {
  const invalido = { valor: null, error: MENSAJES_GENERADOR.anteriorLargo };
  if (valor === undefined || valor === null) return { valor: [], error: null };
  if (!Array.isArray(valor)) return invalido;
  const numeros = [];
  const vistos = new Set();
  for (const elemento of valor) {
    if (elemento === undefined || elemento === null) continue;
    if (typeof elemento !== 'string') return invalido;
    const recortado = elemento.trim();
    if (recortado === '' || vistos.has(recortado)) continue;
    if (caracteres(recortado) > LARGO_NUMERO) return invalido;
    vistos.add(recortado);
    numeros.push(recortado);
  }
  return { valor: numeros, error: null };
};

/**
 * Valida el pedido de una nota (el cuerpo de la vista previa y de la descarga) contra hoy ('AAAA-MM-DD').
 * Devuelve `{ datos: { fecha, numero, tipo, pedido, anteriores, area_id, datasets }, errores }`:
 * - `datos`: la fecha, el tipo y el pedido tal cual; el número recortado (null sin número); las notas anteriores recortadas, sin
 *   vacías ni repetidas, solo con reiteración (con solicitud, o sin un pedido válido, []); el área y los datasets como enteros
 *   positivos, los datasets sin repetidos y en el orden recibido. Un campo con error queda en null.
 * - `errores`: a lo sumo una clave por campo, en el orden de ORDEN_DE_CAMPOS (`fecha`, `numero`, `tipo`, `pedido`,
 *   `anteriores`, `area`, `datasets`), con su mensaje de MENSAJES_GENERADOR; `{}` si el pedido es válido.
 * Una entrada que no es un objeto da los errores de los campos obligatorios (fecha, tipo, pedido, área y datasets).
 */
export const validarPedidoDeNota = (entrada, hoy) => {
  const fuente = entrada !== null && typeof entrada === 'object' ? entrada : {};
  const errores = {};

  const errorFecha = errorDeFecha(fuente.fecha, hoy);
  if (errorFecha) errores.fecha = errorFecha;

  const numero = numeroDeLaNota(fuente.numero);
  if (numero.error) errores.numero = numero.error;

  const tipoValido = typeof fuente.tipo === 'string' && TIPOS_NOTA.includes(fuente.tipo);
  if (!tipoValido) errores.tipo = MENSAJES_GENERADOR.tipo;

  const pedidoValido = typeof fuente.pedido === 'string' && PEDIDOS.includes(fuente.pedido);
  if (!pedidoValido) errores.pedido = MENSAJES_GENERADOR.pedido;

  const anteriores = fuente.pedido === 'reiteracion' ? anterioresDeLaNota(fuente.anteriores) : { valor: [], error: null };
  if (anteriores.error) errores.anteriores = anteriores.error;

  const area = idsDeDatasets([fuente.area_id]);
  if (area === null) errores.area = MENSAJES_GENERADOR.area;

  const datasets = idsDeDatasets(fuente.datasets);
  if (datasets === null) errores.datasets = MENSAJES_GENERADOR.datasets;

  return {
    datos: {
      fecha: errorFecha ? null : fuente.fecha,
      numero: numero.valor,
      tipo: tipoValido ? fuente.tipo : null,
      pedido: pedidoValido ? fuente.pedido : null,
      anteriores: anteriores.valor,
      area_id: area === null ? null : area[0],
      datasets
    },
    errores
  };
};

// Se puede pedir un dataset que no está al día: vencido, próximo a vencer, eventual o sin fecha (los estados de
// estadoDelDataset, calculados a la fecha de la nota). Las Notas Digitales nunca piden uno al día
export const sePuedePedir = (estado) => estado !== 'actualizado';

// En qué grupo va un dataset de la lista: 0 los vencidos, 1 los próximos a vencer, 2 el resto (al día, eventuales y sin fecha)
const grupoDe = (dataset) => {
  if (typeof dataset.dias === 'number' && dataset.dias < 0) return 0;
  if (dataset.estado === 'proximo') return 1;
  return 2;
};

// Dos próximas ('AAAA-MM-DD', como texto), con las que no hay (null) al final
const compararProximas = (a, b) => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
};

/**
 * Una copia de los datasets ([{ titulo, dias, estado, proxima }], con los días y el estado de estadoDelDataset a la fecha de la
 * nota), en el orden de la lista y de la tabla: primero los vencidos (dias < 0), el más vencido primero; después los próximos a
 * vencer, por días; después el resto, por próxima, con los que no tienen al final. Los empates, por título en castellano. La
 * lista recibida no cambia.
 */
export const ordenDeLosDatasets = (datasets) => [...datasets].sort((a, b) => {
  const grupo = grupoDe(a);
  const diferencia = grupo - grupoDe(b) || (grupo === 2
    ? compararProximas(a.proxima ?? null, b.proxima ?? null)
    : a.dias - b.dias);
  return diferencia || String(a.titulo ?? '').localeCompare(String(b.titulo ?? ''), 'es');
});
