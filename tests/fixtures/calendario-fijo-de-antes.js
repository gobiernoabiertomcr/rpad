// El calendario de los 9 fijos tal como estaba antes del calendario único (spec 2026-10-27-feriados-en-notas, 1): la copia
// literal, sin imports, de services/notasDigitalesCalendario.js en main 9c653ec. tests/notas-calendario.test.js compara con
// esta copia los nombres de siempre y CALENDARIO_FIJO, también con entradas que no son fechas: tienen que dar lo mismo (el
// mismo valor, o un error de la misma clase) en toda entrada en la que esta copia termina. No se corrige ni se actualiza.

// Mediodía UTC: evita que un cambio de zona horaria mueva la fecha
const aFecha = (iso) => new Date(`${iso}T12:00:00Z`);
const aIso = (fecha) => fecha.toISOString().slice(0, 10);

export const FERIADOS_FIJOS = ['01-01', '03-24', '04-02', '05-01', '05-25', '06-20', '07-09', '12-08', '12-25'];

export const sumarDias = (iso, dias) => {
  const fecha = aFecha(iso);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return aIso(fecha);
};

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
