// Calendario de Notas Digitales. Todas las fechas son strings 'AAAA-MM-DD' en hora de Argentina.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 5.1)

const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';
export const FERIADOS_FIJOS = ['01-01', '03-24', '04-02', '05-01', '05-25', '06-20', '07-09', '12-08', '12-25'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Mediodía UTC: evita que un cambio de zona horaria mueva la fecha
const aFecha = (iso) => new Date(`${iso}T12:00:00Z`);
const aIso = (fecha) => fecha.toISOString().slice(0, 10);

// Partes numéricas de la fecha y la hora de Argentina, sin depender del formato de texto de un idioma
const partesArgentina = (ahora) => {
  const partes = {};
  const formato = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA, numberingSystem: 'latn', hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'
  });
  for (const { type, value } of formato.formatToParts(ahora)) {
    if (type !== 'literal') partes[type] = Number(value);
  }
  return partes;
};
const dosCifras = (numero) => String(numero).padStart(2, '0');

// 'AAAA-MM-DD HH:MM:SS' en hora de Argentina (registro de la corrida diaria)
export const ahoraArgentina = (ahora = new Date()) => {
  const { year, month, day, hour, minute, second } = partesArgentina(ahora);
  return `${year}-${dosCifras(month)}-${dosCifras(day)} ${dosCifras(hour % 24)}:${dosCifras(minute)}:${dosCifras(second)}`;
};

// 'AAAA-MM-DD' de hoy en Argentina, armado con formatToParts (antes dependía de que 'en-CA' existiera en el ICU de Node)
export const hoyArgentina = (ahora = new Date()) => ahoraArgentina(ahora).slice(0, 10);

// true si es un string 'AAAA-MM-DD' de un día que existe
export const esFechaIso = (valor) => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)
  && !Number.isNaN(aFecha(valor).getTime()) && aIso(aFecha(valor)) === valor;

export const sumarDias = (iso, dias) => {
  const fecha = aFecha(iso);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return aIso(fecha);
};

export const diasEntre = (desde, hasta) => Math.round((aFecha(hasta) - aFecha(desde)) / 86400000);

export const esDiaHabil = (iso) => {
  const diaSemana = aFecha(iso).getUTCDay();
  return diaSemana !== 0 && diaSemana !== 6 && !FERIADOS_FIJOS.includes(iso.slice(5));
};

export const proximoDiaHabil = (iso) => {
  let fecha = iso;
  while (!esDiaHabil(fecha)) fecha = sumarDias(fecha, 1);
  return fecha;
};

// Último día hábil antes de iso (sin contarlo)
export const diaHabilAnterior = (iso) => {
  let fecha = sumarDias(iso, -1);
  while (!esDiaHabil(fecha)) fecha = sumarDias(fecha, -1);
  return fecha;
};

export const primerDiaHabilDelMes = (periodo) => proximoDiaHabil(`${periodo}-01`);

export const periodoDe = (iso) => iso.slice(0, 7);

export const periodoSiguiente = (periodo) => {
  const [anio, mes] = periodo.split('-').map(Number);
  return mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, '0')}`;
};

export const formatoCorto = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');

export const formatoLargo = (iso) => {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
};

export const mesYAnio = (iso) => {
  const [anio, mes] = iso.split('-').map(Number);
  return `${MESES[mes - 1]} ${anio}`;
};
