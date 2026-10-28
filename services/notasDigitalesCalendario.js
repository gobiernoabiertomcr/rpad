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

// Lunes a viernes sin los 9 feriados fijos. Es la base de todos los calendarios: calendarioCon (services/feriadosReglas.js) le
// saca además los feriados de la tabla
export const esDiaHabil = (iso) => {
  const diaSemana = aFecha(iso).getUTCDay();
  return diaSemana !== 0 && diaSemana !== 6 && !FERIADOS_FIJOS.includes(iso.slice(5));
};

// Lo más lejos que se busca un día hábil: la fecha y los 365 días que siguen, o los 366 anteriores (un año bisiesto entero).
// Con la tabla de feriados, un año entero cargado como feriado daría un bucle infinito
export const TOPE_DE_VUELTAS = 366;
const ULTIMA_FECHA = '9999-12-31';
const FORMA_DE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

const sinDiaHabil = (iso, cuando) =>
  new RangeError(`No hay ningún día hábil en los ${TOPE_DE_VUELTAS} días ${cuando} ${iso}.`);

/**
 * Las derivadas de días hábiles, escritas una sola vez sobre un predicado «¿es hábil?» (spec 2026-10-27-feriados-en-notas, 1):
 * `{ esDiaHabil, proximoDiaHabil, diaHabilAnterior, ultimoDiaHabilHasta, primerDiaHabilDelMes, rangoDeAviso,
 * diasHabilesTranscurridos, sumarDiasHabiles }`, con `esDiaHabil` = el predicado. Con `esDiaHabil` (los 9 fijos) son las de
 * siempre: dan lo mismo en toda entrada en la que antes terminaban. Las búsquedas de un día hábil tienen un tope de
 * TOPE_DE_VUELTAS: sin ninguno, tiran RangeError (con los 9 fijos solo pasa después del 31/12/9999, donde antes no terminaban).
 * @param {(fecha: string) => boolean} esHabil
 */
export const derivadasDe = (esHabil) => {
  // La fecha, si es hábil, o la primera hábil que la sigue
  const proximoDiaHabil = (iso) => {
    let fecha = iso;
    for (let vuelta = 1; !esHabil(fecha); vuelta++) {
      if (vuelta === TOPE_DE_VUELTAS) throw sinDiaHabil(iso, 'desde el');
      fecha = sumarDias(fecha, 1);
    }
    return fecha;
  };

  // Último día hábil antes de iso (sin contarlo)
  const diaHabilAnterior = (iso) => {
    let fecha = sumarDias(iso, -1);
    for (let vuelta = 1; !esHabil(fecha); vuelta++) {
      if (vuelta === TOPE_DE_VUELTAS) throw sinDiaHabil(iso, 'anteriores al');
      fecha = sumarDias(fecha, -1);
    }
    return fecha;
  };

  // Último día hábil que no pasa de iso (iso mismo si es hábil)
  const ultimoDiaHabilHasta = (iso) => (esHabil(iso) ? iso : diaHabilAnterior(iso));

  const primerDiaHabilDelMes = (periodo) => proximoDiaHabil(`${periodo}-01`);

  // Vencimientos que avisa hoy un aviso que sale `dias` días antes y solo en días hábiles (spec
  // 2026-10-15-dias-habiles-licencias-auditoria, 4.2): desde hoy + dias hasta el día anterior a (siguiente día hábil + dias).
  // Así cada día hábil avisa también lo que habría caído en los días no hábiles que siguen: se anticipa, nunca se atrasa.
  // null si hoy no es día hábil.
  const rangoDeAviso = (hoy, dias) => {
    if (!esHabil(hoy)) return null;
    const siguiente = proximoDiaHabil(sumarDias(hoy, 1));
    return { desde: sumarDias(hoy, dias), hasta: sumarDias(siguiente, dias - 1) };
  };

  // Días hábiles después de desde y hasta hasta inclusive (desde no se cuenta): la columna "días hábiles pendiente" de la
  // nota de auditoría y el plazo de sus reiteraciones (spec 2026-10-15-dias-habiles-licencias-auditoria, 9.3 y 10.3).
  // 0 si hasta no es posterior a desde. Tira RangeError donde el recorrido no terminaría: con un hasta mayor que toda fecha
  // (un texto mayor que el 31/12/9999) o si la fecha deja de ser 'AAAA-MM-DD' (después del 31/12/9999 sumarDias da
  // '+010000-01', que como texto es menor que toda fecha, y desde ahí siempre lo mismo)
  const diasHabilesTranscurridos = (desde, hasta) => {
    if (typeof hasta === 'string' && hasta > ULTIMA_FECHA) {
      throw new RangeError(`No se pueden contar los días hábiles hasta ${hasta}: no es una fecha.`);
    }
    let cantidad = 0;
    for (let fecha = sumarDias(desde, 1); fecha <= hasta; fecha = sumarDias(fecha, 1)) {
      if (!FORMA_DE_FECHA.test(fecha)) throw new RangeError(`No se pueden contar los días hábiles después del ${ULTIMA_FECHA}.`);
      if (esHabil(fecha)) cantidad++;
    }
    return cantidad;
  };

  // El n-ésimo día hábil después de iso, sin contarlo (iso si n es 0): la próxima reiteración de una nota de auditoría
  const sumarDiasHabiles = (iso, n) => {
    let fecha = iso;
    for (let i = 0; i < n; i++) fecha = proximoDiaHabil(sumarDias(fecha, 1));
    return fecha;
  };

  return {
    esDiaHabil: esHabil, proximoDiaHabil, diaHabilAnterior, ultimoDiaHabilHasta, primerDiaHabilDelMes, rangoDeAviso,
    diasHabilesTranscurridos, sumarDiasHabiles
  };
};

/**
 * El calendario de los 9 feriados fijos: las derivadas sobre esDiaHabil, con `origen: 'fijos'` y `error: null`. Es el valor por
 * defecto de las reglas puras; con la tabla de feriados, calendarioCon (services/feriadosReglas.js) arma el mismo objeto y
 * leerCalendario (services/feriadosDatos.js) lo lee de la base.
 */
export const CALENDARIO_FIJO = Object.freeze({ ...derivadasDe(esDiaHabil), origen: 'fijos', error: null });

// Los nombres de siempre, del calendario de los 9 fijos
export const proximoDiaHabil = CALENDARIO_FIJO.proximoDiaHabil;
export const diaHabilAnterior = CALENDARIO_FIJO.diaHabilAnterior;
export const ultimoDiaHabilHasta = CALENDARIO_FIJO.ultimoDiaHabilHasta;
export const primerDiaHabilDelMes = CALENDARIO_FIJO.primerDiaHabilDelMes;
export const rangoDeAviso = CALENDARIO_FIJO.rangoDeAviso;
export const diasHabilesTranscurridos = CALENDARIO_FIJO.diasHabilesTranscurridos;
export const sumarDiasHabiles = CALENDARIO_FIJO.sumarDiasHabiles;

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

// Rango de meses en minúsculas, como en el asunto de los avisos anticipados (spec 2026-10-15, 7.3):
// 'enero 2027', 'enero a marzo 2027' o 'diciembre 2026 a febrero 2027'
export const textoRangoMeses = (desde, hasta) => {
  if (periodoDe(desde) === periodoDe(hasta)) return mesYAnio(desde);
  if (desde.slice(0, 4) === hasta.slice(0, 4)) return `${MESES[Number(desde.slice(5, 7)) - 1]} a ${mesYAnio(hasta)}`;
  return `${mesYAnio(desde)} a ${mesYAnio(hasta)}`;
};
