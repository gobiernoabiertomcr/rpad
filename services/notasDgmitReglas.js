/**
 * Notas DGMIT (spec 2026-10-24-notas-dgmit, secciones 2, 3 y 8): la validación de lo que se carga, se corrige o se anula,
 * pura (sin pool ni Date local: hoy llega por parámetro, `hoyArgentina()` en el servidor). Las fechas son texto
 * 'AAAA-MM-DD' y se comparan como texto. Ninguna función tira error: una entrada rara da los errores de sus campos.
 *
 * La usa la API (`controllers/notasDgmitController.js`), que además chequea en la base que los datasets se puedan elegir
 * y que el número no esté repetido (con los textos de `textoNoSePuedeElegir` y `textoNumeroRepetido`). El formulario del
 * Seguimiento tiene una copia, atada por un test de paridad: si cambia una regla o un mensaje, cambia en los dos.
 */
import { esFechaIso } from './notasDigitalesCalendario.js';

// Largo máximo del número (varchar(40)) y del motivo (varchar(500)), sin los espacios de los extremos
export const LARGO_NUMERO = 40;
export const LARGO_MOTIVO = 500;
// La fecha de recepción más vieja que se acepta (la del Excel de la Dirección Administrativa)
export const FECHA_MINIMA = '2025-01-01';

export const TIPOS_NOTA_DGMIT = Object.freeze(['solicitud', 'reiteracion']);

// Nombre en pantalla de cada tipo
export const TEXTO_TIPO_NOTA_DGMIT = Object.freeze({ solicitud: 'Solicitud', reiteracion: 'Reiteración' });

// Los mensajes de cada campo, los mismos en el servidor y en el formulario del navegador
export const MENSAJES_NOTA_DGMIT = Object.freeze({
  numero: 'Escribí el número de la nota.',
  numeroLargo: 'El número de la nota puede tener hasta 40 caracteres.',
  recibida: 'Elegí la fecha en que el área recibió la nota.',
  recibidaFutura: 'La fecha de recepción no puede ser posterior a hoy.',
  recibidaVieja: 'La fecha de recepción no puede ser anterior al 01/01/2025.',
  tipo: 'Elegí si es una solicitud o una reiteración.',
  datasets: 'Elegí al menos un dataset.',
  motivo: 'Escribí el motivo.',
  motivoLargo: 'El motivo puede tener hasta 500 caracteres.'
});

// Caracteres de un texto, como los cuenta el varchar de la base (no las unidades de UTF-16 de `length`)
const caracteres = (texto) => Array.from(texto).length;

/**
 * Un texto obligatorio con largo máximo: `{ valor, error }`, con el valor recortado en los extremos (los espacios del
 * medio quedan). Lo que no es un texto cuenta como vacío.
 */
const textoObligatorio = (valor, largo, mensajeVacio, mensajeLargo) => {
  const recortado = typeof valor === 'string' ? valor.trim() : '';
  if (recortado === '') return { valor: null, error: mensajeVacio };
  if (caracteres(recortado) > largo) return { valor: null, error: mensajeLargo };
  return { valor: recortado, error: null };
};

// La fecha de recepción: 'AAAA-MM-DD' que existe, entre FECHA_MINIMA y hoy. Sin un hoy válido no pasa (no se puede saber
// si es posterior)
const errorDeRecibida = (recibida, hoy) => {
  if (!esFechaIso(recibida)) return MENSAJES_NOTA_DGMIT.recibida;
  if (recibida < FECHA_MINIMA) return MENSAJES_NOTA_DGMIT.recibidaVieja;
  if (!esFechaIso(hoy) || recibida > hoy) return MENSAJES_NOTA_DGMIT.recibidaFutura;
  return null;
};

// Un id de dataset: un entero positivo seguro, como número o como texto de solo dígitos. null si no lo es
const idDeDataset = (valor) => {
  const numero = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : valor;
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
};

// Los ids de los datasets, sin repetidos y en el orden recibido. null si no es un array, si está vacío o si algún
// elemento no es un id (no se descartan en silencio). Los vistos van en un Set: tiempo lineal, así un cuerpo grande no
// traba el servidor
const idsDeDatasets = (datasets) => {
  if (!Array.isArray(datasets) || datasets.length === 0) return null;
  const ids = [];
  const vistos = new Set();
  for (const valor of datasets) {
    const id = idDeDataset(valor);
    if (id === null) return null;
    if (!vistos.has(id)) {
      vistos.add(id);
      ids.push(id);
    }
  }
  return ids;
};

/**
 * Valida una nota (el cuerpo de la carga o de la corrección, sin el motivo) contra hoy ('AAAA-MM-DD').
 * Devuelve `{ datos: { numero, recibida, tipo, datasets }, errores }`:
 * - `datos`: el número recortado, la fecha y el tipo tal cual, y los ids de los datasets como números, sin repetidos y en
 *   el orden recibido. Un campo con error queda en null.
 * - `errores`: a lo sumo una clave por campo (`numero`, `recibida`, `tipo`, `datasets`), con su mensaje de
 *   MENSAJES_NOTA_DGMIT; `{}` si la nota es válida.
 * Una entrada que no es un objeto (null, undefined, un texto, un número) da los cuatro errores.
 */
export const validarNotaDgmit = (entrada, hoy) => {
  const fuente = entrada !== null && typeof entrada === 'object' ? entrada : {};
  const errores = {};

  const numero = textoObligatorio(fuente.numero, LARGO_NUMERO, MENSAJES_NOTA_DGMIT.numero, MENSAJES_NOTA_DGMIT.numeroLargo);
  if (numero.error) errores.numero = numero.error;

  const errorRecibida = errorDeRecibida(fuente.recibida, hoy);
  if (errorRecibida) errores.recibida = errorRecibida;

  const tipoValido = typeof fuente.tipo === 'string' && TIPOS_NOTA_DGMIT.includes(fuente.tipo);
  if (!tipoValido) errores.tipo = MENSAJES_NOTA_DGMIT.tipo;

  const datasets = idsDeDatasets(fuente.datasets);
  if (datasets === null) errores.datasets = MENSAJES_NOTA_DGMIT.datasets;

  return {
    datos: {
      numero: numero.valor,
      recibida: errorRecibida ? null : fuente.recibida,
      tipo: tipoValido ? fuente.tipo : null,
      datasets
    },
    errores
  };
};

/**
 * El motivo de una corrección o de una anulación: `{ motivo, error }`, con el motivo recortado (entre 1 y LARGO_MOTIVO
 * caracteres) y error null, o motivo null y el mensaje.
 */
export const validarMotivo = (valor) => {
  const { valor: motivo, error } = textoObligatorio(valor, LARGO_MOTIVO, MENSAJES_NOTA_DGMIT.motivo, MENSAJES_NOTA_DGMIT.motivoLargo);
  return { motivo, error };
};

// El 409 de un número que ya tiene otra nota sin anular
export const textoNumeroRepetido = (numero) =>
  `Ya hay una nota DGMIT N° ${numero} cargada. Para sumarle datasets o cambiar algo, corregila.`;

// El 400 de un dataset que no se puede elegir (dado de baja, interno o con «Requiere nota DGMIT» en No)
export const textoNoSePuedeElegir = (titulo) =>
  `«${titulo}» no se puede elegir: solo los datasets activos de gestión externa que requieren nota DGMIT.`;
