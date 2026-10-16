// Reglas de las licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.1, 5.2 y 6.3): funciones puras, sin base de datos.
// Las fechas son textos 'AAAA-MM-DD' en hora de Argentina.
import { esFechaIso, diasEntre, sumarDias, esDiaHabil, proximoDiaHabil } from './notasDigitalesCalendario.js';

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
 * haga falta la persona.
 */
export const diasHabilesLibres = (desde, hasta, licencias) => {
  let hayHabiles = false;
  for (let dia = desde; dia <= hasta; dia = sumarDias(dia, 1)) {
    if (!esDiaHabil(dia)) continue;
    hayHabiles = true;
    if (!licencias.some(l => l.desde <= dia && dia <= l.hasta)) return { primerDia: dia, cubiertos: false };
  }
  return { primerDia: null, cubiertos: hayHabiles };
};

/**
 * Une, en orden, los tramos de licencia ({ desde, hasta }) seguidos o separados solo por días no hábiles (sin ningún
 * día hábil libre entre uno y otro): para saber hasta cuándo falta la persona sin volver.
 */
export const unirAusencias = (ausencias) => [...ausencias]
  .sort((a, b) => a.desde.localeCompare(b.desde))
  .reduce((unidas, { desde, hasta }) => {
    const ultima = unidas.at(-1);
    if (ultima && proximoDiaHabil(sumarDias(ultima.hasta, 1)) >= desde) {
      if (hasta > ultima.hasta) ultima.hasta = hasta;
    } else {
      unidas.push({ desde, hasta });
    }
    return unidas;
  }, []);
