// Reglas de las licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.1, 5.2 y 6.3): funciones puras, sin base de datos.
// Las fechas son textos 'AAAA-MM-DD' en hora de Argentina. Las que cuentan días hábiles reciben el calendario (spec
// 2026-10-27-feriados-en-notas, 1 y 3) como último parámetro, o como clave: sin él, el de los 9 feriados fijos, como siempre.
import { esFechaIso, diasEntre, sumarDias, CALENDARIO_FIJO } from './notasDigitalesCalendario.js';

export const ROLES_CON_LICENCIA = ['superadmin', 'admin', 'editor'];
export const MAXIMO_DIAS_LICENCIA = 365;

const FECHAS_INVALIDAS = 'Las fechas tienen que ser días válidos (AAAA-MM-DD)';
const DEMASIADO_LARGA = `La licencia puede durar como máximo ${MAXIMO_DIAS_LICENCIA} días`;

export const puedeTenerLicencia = (rol) => ROLES_CON_LICENCIA.includes(rol);

export const estadoDeLicencia = ({ desde, hasta, anulada }, hoy) => {
  if (Number(anulada)) return 'anulada';
  if (desde > hoy) return 'futura';
  if (hasta < hoy) return 'pasada';
  return 'en_curso';
};

const duraDeMas = ({ desde, hasta }) => diasEntre(desde, hasta) + 1 > MAXIMO_DIAS_LICENCIA;

// null si las fechas sirven para una licencia nueva o una futura editada; si no, el motivo
export const validarFechasNuevas = ({ desde, hasta }, hoy) => {
  if (!esFechaIso(desde) || !esFechaIso(hasta)) return FECHAS_INVALIDAS;
  if (desde > hasta) return 'La licencia no puede terminar antes de empezar';
  if (hasta < hoy) return 'La licencia ya terminó: no tiene efecto';
  if (duraDeMas({ desde, hasta })) return DEMASIADO_LARGA;
  return null;
};

/**
 * Qué cambios admite una licencia según su estado (spec 5.2).
 * actual: { desde, hasta, anulada }; cambios: { desde?, hasta? } (lo que no viene queda como está).
 * Devuelve { error, codigo } (400 datos inválidos, 409 la licencia no admite cambios) o { datos: { desde, hasta } }.
 */
export const validarEdicion = (actual, cambios, hoy) => {
  const estado = estadoDeLicencia(actual, hoy);
  if (estado === 'anulada') return { error: 'La licencia está anulada', codigo: 409 };
  if (estado === 'pasada') return { error: 'La licencia ya terminó: no se puede modificar', codigo: 409 };
  const datos = { desde: cambios.desde ?? actual.desde, hasta: cambios.hasta ?? actual.hasta };
  if (estado === 'futura') {
    const error = validarFechasNuevas(datos, hoy);
    return error ? { error, codigo: 400 } : { datos };
  }
  if (datos.desde !== actual.desde) return { error: 'La licencia ya empezó: solo se puede cambiar la fecha de fin', codigo: 400 };
  if (!esFechaIso(datos.hasta)) return { error: FECHAS_INVALIDAS, codigo: 400 };
  if (datos.hasta < datos.desde || datos.hasta < sumarDias(hoy, -1)) {
    return { error: 'La fecha de fin tiene que ser ayer o posterior, y no anterior al inicio', codigo: 400 };
  }
  if (duraDeMas(datos)) return { error: DEMASIADO_LARGA, codigo: 400 };
  return { datos };
};

// Se anula una licencia que todavía no empezó o que empieza hoy (una cargada por error); una en curso se corta con el fin
export const puedeAnularse = (licencia, hoy) => !Number(licencia.anulada) && licencia.desde >= hoy;

/**
 * Los días hábiles de [desde, hasta] en que una persona no está de licencia (licencias: [{ desde, hasta }]), para la
 * persona autorizada a presentar las notas (spec 6.3). { primerDia: el primero o null, cubiertos: true si el rango tiene
 * días hábiles y sus licencias los cubren todos }. Un rango sin días hábiles no queda cubierto: no hay ningún día en que
 * haga falta la persona. Los días hábiles, con el calendario.
 */
export const diasHabilesLibres = (desde, hasta, licencias, calendario = CALENDARIO_FIJO) => {
  let hayHabiles = false;
  for (let dia = desde; dia <= hasta; dia = sumarDias(dia, 1)) {
    if (!calendario.esDiaHabil(dia)) continue;
    hayHabiles = true;
    if (!licencias.some(l => l.desde <= dia && dia <= l.hasta)) return { primerDia: dia, cubiertos: false };
  }
  return { primerDia: null, cubiertos: hayHabiles };
};

/**
 * Une, en orden, los tramos de licencia ({ desde, hasta }) seguidos o separados solo por días no hábiles (sin ningún
 * día hábil libre entre uno y otro): para saber hasta cuándo falta la persona sin volver. Los días hábiles, con el
 * calendario.
 */
export const unirAusencias = (ausencias, calendario = CALENDARIO_FIJO) => [...ausencias]
  .sort((a, b) => a.desde.localeCompare(b.desde))
  .reduce((unidas, { desde, hasta }) => {
    const ultima = unidas.at(-1);
    if (ultima && calendario.proximoDiaHabil(sumarDias(ultima.hasta, 1)) >= desde) {
      if (hasta > ultima.hasta) ultima.hasta = hasta;
    } else {
      unidas.push({ desde, hasta });
    }
    return unidas;
  }, []);

/**
 * El día del aviso en su fecha de un dataset que se avisó por adelantado (spec 2026-10-15, 7.6): cuentaDesde, su fecha
 * normal de aviso, si es un día hábil y ese día la persona autorizada no falta; si no, el último día hábil anterior en que
 * no falta, sin bajar del primer día de la licencia del titular (licencia: { desde, hasta }). ausencias: [{ desde, hasta }],
 * las de la persona autorizada tal cual (sin unir). Los días hábiles, con el calendario (spec 2026-10-27-feriados-en-notas,
 * 3): un cuentaDesde que cae en un feriado de la tabla va al hábil anterior, nunca fuera de la licencia (el cuenta_desde
 * guardado no cambia). null si cuentaDesde no es una fecha o está fuera de la licencia, o si no queda ningún día en que la
 * persona autorizada pueda presentarlo: ese dataset ya salió en el aviso anticipado de la víspera.
 */
export const diaDelAvisoEnSuFecha = ({ cuentaDesde, licencia, ausencias = [], calendario = CALENDARIO_FIJO }) => {
  if (!esFechaIso(cuentaDesde) || cuentaDesde < licencia.desde || cuentaDesde > licencia.hasta) return null;
  const falta = (dia) => ausencias.some(a => a.desde <= dia && dia <= a.hasta);
  if (calendario.esDiaHabil(cuentaDesde) && !falta(cuentaDesde)) return cuentaDesde;
  for (let dia = calendario.ultimoDiaHabilHasta(cuentaDesde); dia >= licencia.desde; dia = calendario.diaHabilAnterior(dia)) {
    if (!falta(dia)) return dia;
  }
  return null;
};

const SIN_VISPERA = Object.freeze({ vispera: null, sin_anticipo: false, sin_dias_habiles: false });

// Una licencia de otras que no está anulada y tiene ese día entre sus fechas (lo que no es una licencia no incluye ninguno)
const incluyeElDia = (otra, dia) => otra !== null && typeof otra === 'object' && !Number(otra.anulada)
  && typeof otra.desde === 'string' && typeof otra.hasta === 'string' && otra.desde <= dia && dia <= otra.hasta;

/**
 * La víspera de una licencia del firmante titular (spec 2026-10-27-feriados-en-notas, 4): el día hábil anterior a su primer
 * día, con el calendario, en que salen los avisos anticipados. licencia: { desde, hasta }; otras: las demás licencias del
 * titular, [{ desde, hasta, anulada? }], sin la misma. Devuelve { vispera, sin_anticipo, sin_dias_habiles }:
 * - sin días hábiles (el último día hábil hasta su fin es anterior a su primer día): { vispera: null, sin_dias_habiles: true };
 * - si alguna de otras, sin anular, incluye el día hábil anterior (empieza a continuación de otra licencia): ese día el
 *   titular ya está de licencia y no hay anticipo, { vispera: null, sin_anticipo: true };
 * - si no, { vispera: el día hábil anterior }.
 * No tira con lo que llega de los datos: otras que no es una lista vale []; con fechas que no sirven (también invertidas) o si
 * el calendario tira el RangeError del tope (sin ningún día hábil en 366 días), { vispera: null, sin_anticipo: false,
 * sin_dias_habiles: false }: no se sabe, y quien lo muestra la nombra en general. Un calendario null o mal armado es un
 * error de programación y tira.
 */
export const visperaDeLaLicencia = (licencia, otras, calendario = CALENDARIO_FIJO) => {
  const { desde, hasta } = licencia !== null && typeof licencia === 'object' ? licencia : {};
  if (!esFechaIso(desde) || !esFechaIso(hasta) || desde > hasta) return { ...SIN_VISPERA };
  try {
    if (calendario.ultimoDiaHabilHasta(hasta) < desde) return { ...SIN_VISPERA, sin_dias_habiles: true };
    const vispera = calendario.diaHabilAnterior(desde);
    const delTitular = Array.isArray(otras) ? otras : [];
    if (delTitular.some((otra) => incluyeElDia(otra, vispera))) return { ...SIN_VISPERA, sin_anticipo: true };
    return { ...SIN_VISPERA, vispera };
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return { ...SIN_VISPERA };
  }
};
