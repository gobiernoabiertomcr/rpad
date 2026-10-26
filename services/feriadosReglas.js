/**
 * Los feriados (spec 2026-10-26-feriados, secciones 1 y 2): las reglas para contar días hábiles con los feriados de la
 * tabla `feriados`, puras (sin pool ni Date local: las fechas son texto 'AAAA-MM-DD' y se comparan como texto). Ninguna
 * función tira error: una entrada rara da null, false, 0, una lista vacía o un Set vacío.
 *
 * Envuelven a `esDiaHabil` (`services/notasDigitalesCalendario.js`) sin cambiarlo: los feriados solo sacan días hábiles,
 * nunca los agregan, y con un Set vacío se cuenta exactamente lo mismo que con `esDiaHabil`. `FERIADOS_FIJOS` es un array
 * que se puede modificar: acá nunca se le escribe y se recorre una copia.
 *
 * Una fila es la de `services/feriadosDatos.js`: `{ id, fecha, nombre, tipo, trasladado_de, se_repite, hasta_anio, activo,
 * no_rige }`, con las fechas como texto, el resto como números y `no_rige`, la lista de los años en que uno que se repite
 * no rige. Por ahora las usa solo Mi espacio: el resto del sistema sigue con `esDiaHabil` y los 9 fijos.
 */
import { FERIADOS_FIJOS, esFechaIso, sumarDias, diasEntre, esDiaHabil } from './notasDigitalesCalendario.js';

export const TIPOS_FERIADO = Object.freeze(['nacional', 'provincial', 'municipal', 'no_laborable']);

// Cómo se muestra cada tipo, en la pestaña Feriados de Configuración
export const NOMBRES_TIPO_FERIADO = Object.freeze({
  nacional: 'Nacional', provincial: 'De Chubut', municipal: 'De Comodoro', no_laborable: 'No laborable'
});

// El nombre de cada uno de los 9 fijos, por su 'MM-DD': no están en la tabla, salen de FERIADOS_FIJOS (un test ata las claves)
export const NOMBRES_DE_LOS_FIJOS = Object.freeze({
  '01-01': 'Año Nuevo',
  '03-24': 'Día Nacional de la Memoria por la Verdad y la Justicia',
  '04-02': 'Día del Veterano y de los Caídos en la Guerra de Malvinas',
  '05-01': 'Día del Trabajador',
  '05-25': 'Día de la Revolución de Mayo',
  '06-20': 'Paso a la Inmortalidad del General Manuel Belgrano',
  '07-09': 'Día de la Independencia',
  '12-08': 'Inmaculada Concepción de María',
  '12-25': 'Navidad'
});

const DIAS_DE_LA_SEMANA = Object.freeze(['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']);

const anioDe = (fecha) => Number(fecha.slice(0, 4));
// 'AAAA-MM-DD' de un año y un 'MM-DD' (puede no existir: quien la usa la controla con esFechaIso)
const fechaDe = (anio, mesYDia) => `${String(anio).padStart(4, '0')}-${mesYDia}`;

// 'lunes', …, 'domingo' (en minúscula y con tilde), o null si no es una fecha
export const diaDeLaSemana = (fecha) => {
  if (!esFechaIso(fecha)) return null;
  // Mediodía UTC, como el calendario (Date.UTC tomaría un año de 0 a 99 como 19xx)
  return DIAS_DE_LA_SEMANA[new Date(`${fecha}T12:00:00Z`).getUTCDay()];
};

// La fecha de la fila en el año `anio` (un número entero), solo si ese año rige; si no, null. Una dada de baja nunca rige.
// Sin `se_repite`, rige solo en el año de su fecha (hasta_anio y no_rige no cuentan). Con `se_repite`, desde el año de su
// fecha (no hacia atrás) hasta `hasta_anio` (null: sigue), salvo los años de `no_rige`. Si ese día no existe ese año (un
// 29/02), null.
export const fechaEnElAnio = (fila, anio) => {
  if (!fila || typeof fila !== 'object' || !Number.isInteger(anio)) return null;
  const { fecha } = fila;
  if (Number(fila.activo) !== 1 || !esFechaIso(fecha)) return null;
  const primerAnio = anioDe(fecha);
  if (Number(fila.se_repite) !== 1) return anio === primerAnio ? fecha : null;
  if (anio < primerAnio) return null;
  const hasta = fila.hasta_anio ?? null;
  // Escrito al revés a propósito: un hasta_anio que no es un número no lo deja regir para siempre
  if (hasta !== null && !(anio <= Number(hasta))) return null;
  if (Array.isArray(fila.no_rige) && fila.no_rige.some((noRige) => Number(noRige) === anio)) return null;
  const enElAnio = fechaDe(anio, fecha.slice(5));
  return esFechaIso(enElAnio) ? enElAnio : null;
};

// El Set de los días no hábiles por feriado del rango, los dos días incluidos: los 9 fijos de cada año del rango y las filas
// que rigen (fechaEnElAnio). Con una fecha que no es una fecha, o hasta anterior a desde, un Set vacío. Quien cuenta días
// pide el rango con margen: lo que queda afuera no está en el Set.
export const feriadosDelRango = (filas, desde, hasta) => {
  const feriados = new Set();
  if (!esFechaIso(desde) || !esFechaIso(hasta) || hasta < desde) return feriados;
  const fijos = [...FERIADOS_FIJOS];
  const lista = Array.isArray(filas) ? filas : [];
  const sumar = (fecha) => {
    if (fecha && fecha >= desde && fecha <= hasta) feriados.add(fecha);
  };
  for (let anio = anioDe(desde); anio <= anioDe(hasta); anio++) {
    for (const fijo of fijos) sumar(fechaDe(anio, fijo));
    for (const fila of lista) sumar(fechaEnElAnio(fila, anio));
  }
  return feriados;
};

// true si la fecha es un día hábil de esDiaHabil y no está en el Set de feriados. Un texto que no es una fecha da false
// (esDiaHabil da true); un segundo parámetro que no es un Set no saca ningún día.
export const esDiaHabilCon = (fecha, feriados) =>
  esFechaIso(fecha) && esDiaHabil(fecha) && !(feriados instanceof Set && feriados.has(fecha));

// Los días hábiles de desde a hasta, los dos incluidos (diasHabilesTranscurridos no cuenta el primero). [] si hasta es
// anterior a desde o alguna no es una fecha.
export const diasHabilesDe = (desde, hasta, feriados) => {
  if (!esFechaIso(desde) || !esFechaIso(hasta) || hasta < desde) return [];
  const dias = [];
  // Se cuentan los días, no se compara el texto: después del 9999-12-31, sumarDias da '+010000-01', que es menor
  const total = diasEntre(desde, hasta) + 1;
  for (let i = 0, fecha = desde; i < total; i++, fecha = sumarDias(fecha, 1)) {
    if (esDiaHabilCon(fecha, feriados)) dias.push(fecha);
  }
  return dias;
};

// Cuántos días hábiles hay de desde a hasta, los dos incluidos
export const diasHabilesEntre = (desde, hasta, feriados) => diasHabilesDe(desde, hasta, feriados).length;
