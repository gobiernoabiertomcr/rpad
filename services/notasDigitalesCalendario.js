// Calendario de Notas Digitales. Todas las fechas son strings 'AAAA-MM-DD' en hora de Argentina.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 5.1)

const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';
export const FERIADOS_FIJOS = ['01-01', '03-24', '04-02', '05-01', '05-25', '06-20', '07-09', '12-08', '12-25'];
// Días de anticipación del aviso, por gestión: el aviso de la regla sale tantos días corridos antes del vencimiento. La externa pasó de
// 30 a 40 (pedido del usuario el 16/10/2026): el pedido formal a las áreas externas lleva unos 5 días hábiles más el circuito
// administrativo. Una sola fuente (Ruling 30): la usan las Notas Digitales (notasDigitalesDatos.js la reexporta), Métricas
// (VENTANA_DE_LA_REGLA, services/metricasReglas.js) y la Agenda de pedidos (services/reportesAgenda.js).
export const VENTANA_DIAS = Object.freeze({ interna: 60, externa: 40 });
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

// Vencimientos que avisa hoy un aviso que sale `dias` días antes y solo en días hábiles (spec
// 2026-10-15-dias-habiles-licencias-auditoria, 4.2): desde hoy + dias hasta el día anterior a (siguiente día hábil + dias).
// Así cada día hábil avisa también lo que habría caído en los días no hábiles que siguen: se anticipa, nunca se atrasa.
// null si hoy no es día hábil.
export const rangoDeAviso = (hoy, dias) => {
  if (!esDiaHabil(hoy)) return null;
  const siguiente = proximoDiaHabil(sumarDias(hoy, 1));
  return { desde: sumarDias(hoy, dias), hasta: sumarDias(siguiente, dias - 1) };
};

// Último día hábil que no pasa de iso (iso mismo si es hábil)
export const ultimoDiaHabilHasta = (iso) => (esDiaHabil(iso) ? iso : diaHabilAnterior(iso));

// Rango de meses en minúsculas, como en el asunto de los avisos anticipados (spec 2026-10-15, 7.3):
// 'enero 2027', 'enero a marzo 2027' o 'diciembre 2026 a febrero 2027'
export const textoRangoMeses = (desde, hasta) => {
  if (periodoDe(desde) === periodoDe(hasta)) return mesYAnio(desde);
  if (desde.slice(0, 4) === hasta.slice(0, 4)) return `${MESES[Number(desde.slice(5, 7)) - 1]} a ${mesYAnio(hasta)}`;
  return `${mesYAnio(desde)} a ${mesYAnio(hasta)}`;
};

// Días hábiles después de desde y hasta hasta inclusive (desde no se cuenta): la columna "días hábiles pendiente" de la
// nota de auditoría y el plazo de sus reiteraciones (spec 2026-10-15-dias-habiles-licencias-auditoria, 9.3 y 10.3).
// 0 si hasta no es posterior a desde.
export const diasHabilesTranscurridos = (desde, hasta) => {
  let cantidad = 0;
  for (let fecha = sumarDias(desde, 1); fecha <= hasta; fecha = sumarDias(fecha, 1)) {
    if (esDiaHabil(fecha)) cantidad++;
  }
  return cantidad;
};

// El n-ésimo día hábil después de iso, sin contarlo (iso si n es 0): la próxima reiteración de una nota de auditoría
export const sumarDiasHabiles = (iso, n) => {
  let fecha = iso;
  for (let i = 0; i < n; i++) fecha = proximoDiaHabil(sumarDias(fecha, 1));
  return fecha;
};
