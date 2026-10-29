/**
 * Los feriados (spec 2026-10-26-feriados, secciones 1 a 4): las reglas de la tabla `feriados`, puras (sin pool ni Date
 * local: las fechas son texto 'AAAA-MM-DD' y se comparan como texto, y hoy llega por parámetro, `hoyArgentina()` en el
 * servidor). Ninguna función tira error: una entrada rara da null, false, 0, una lista vacía, un Set vacío o el error de su
 * campo. Las excepciones son las derivadas del calendario que arma `calendarioCon`, que tiran como las de `CALENDARIO_FIJO`
 * (calendarioCon mismo no tira), y `exigirLaTabla`, que tira a propósito con un calendario que cayó a los 9 fijos.
 *
 * Tres partes:
 * - El calendario con la tabla (spec 2026-10-27-feriados-en-notas, 1): `calendarioCon(filas)` arma el mismo objeto que
 *   `CALENDARIO_FIJO` (`services/notasDigitalesCalendario.js`), con las derivadas sobre un predicado que además saca los
 *   feriados de la tabla. Lo leen las corridas de las 8:15 y de las 14:00 y lo que las anuncia (`leerCalendario`, en
 *   `services/feriadosDatos.js`); si la tabla no se puede leer, caen a los 9 fijos y lo dicen con `MENSAJE_CORRIDA_SIN_FERIADOS`
 *   y `MENSAJE_ESTADO_SIN_FERIADOS`. Desde la tanda 2, todo el sistema cuenta los días hábiles con él: también Métricas, el
 *   Ciclo de vida del dato, la foto del 31/12 y la Agenda de pedidos (spec 2026-10-27-feriados-en-notas, 2 y 5), que no caen a
 *   los 9 fijos: `exigirLaTabla(calendario)` lo devuelve si se leyó de la tabla y, si no, tira con
 *   `MENSAJE_METRICAS_SIN_FERIADOS` (Métricas en vivo, el Ciclo de vida y la Agenda responden su 500, y la foto no se saca con
 *   los 9 fijos: se reintenta en la corrida siguiente); `feriadosDelCalendario`, los días que la tabla sacó de los hábiles, que
 *   la foto guarda, y `calendarioDeFechas`, el calendario que se vuelve a armar con ellos al leerla.
 * - Contar días hábiles con los feriados en Mi espacio (`feriadosDelRango`, `esDiaHabilCon`, `diasHabilesDe`,
 *   `diasHabilesEntre`, `proximoDiaHabilCon`, `restarDiasHabilesCon`, `ultimoDiaHabilDelMesCon`). Envuelven a `esDiaHabil` sin
 *   cambiarlo: los feriados solo sacan días hábiles, nunca los agregan, y con un Set vacío se cuenta exactamente lo mismo que
 *   con `esDiaHabil`. Sin un día hábil dentro del tope, devuelven null (las derivadas del calendario, en cambio, tiran).
 * - Para la API de los feriados y la pestaña Feriados de Configuración: los tipos y sus nombres, los mensajes, la validación
 *   de un feriado (`validarFeriado`, y `errorDeLaCorreccion` en una corrección), de «no rige» (`validarRige`) y de la baja
 *   desde un año (`bajaDesde`), la lista de un año (`feriadosDelAnio`), los avisos al guardar (`avisosDeLaFecha`), los
 *   años del selector (`aniosDelSelector`), las fechas en que rige uno en un rango de años (`fechasDelFeriado`) y, de ellas, las
 *   que cambian un día hábil (`fechasQueCambianDiasHabiles`: con esas se cuentan las licencias de Mi espacio que lo incluyen).
 *   Los textos son planos: escaparlos le toca a quien los dibuja.
 * `FERIADOS_FIJOS` es un array que se puede modificar: acá nunca se le escribe y se recorre una copia.
 *
 * Una fila es la de `services/feriadosDatos.js`: `{ id, fecha, nombre, tipo, trasladado_de, se_repite, hasta_anio, activo,
 * no_rige }`, con las fechas como texto, el resto como números y `no_rige`, la lista de los años en que uno que se repite
 * no rige.
 */
import {
  FERIADOS_FIJOS, esFechaIso, sumarDias, diasEntre, esDiaHabil, derivadasDe, TOPE_DE_VUELTAS
} from './notasDigitalesCalendario.js';

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

// La fecha más vieja que se acepta (el tope es el 31/12 del año siguiente al de hoy) y el largo del nombre, el varchar(150)
export const FECHA_MINIMA_FERIADO = '2025-01-01';
export const LARGO_NOMBRE_FERIADO = 150;

// Los mensajes de cada error, los mismos en el servidor y en la página. En el error, `campo` es el del pedido: nombreLargo
// va en `nombre`, trasladado en `trasladado_de`, repite29 en `se_repite`, despuesDeLaBaja en `fecha` y pasaAl en `pasa_al`;
// noSeRepite va sin campo
export const MENSAJES_FERIADO = Object.freeze({
  fecha: 'La fecha tiene que ser del 01/01/2025 al 31/12 del año que viene.',
  nombre: 'Escribí el nombre del feriado.',
  nombreLargo: 'El nombre puede tener hasta 150 caracteres.',
  tipo: 'Elegí el tipo de feriado.',
  trasladado: 'La fecha original tiene que ser otra fecha del mismo año.',
  repite29: 'Un feriado del 29 de febrero no puede repetirse todos los años.',
  despuesDeLaBaja: 'La fecha tiene que ser anterior al año desde el que se dio de baja.',
  anio: 'Elegí un año válido.',
  rige: 'Indicá si ese año rige.',
  pasaAl: 'La fecha a la que se pasó tiene que ser del mismo año.',
  desde: 'Elegí desde qué año deja de regir.',
  noSeRepite: 'Este feriado no se repite: se corrige o se da de baja entero.',
  noEncontrado: 'Feriado no encontrado'
});

const DIAS_DE_LA_SEMANA = Object.freeze(['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']);

// Los textos de la lista de un año y de los avisos (spec, secciones 3 y 4)
const TIPO_NOMBRE_FIJO = 'Fijo del sistema';
const NO_RIGE = 'Este año no rige';
const COINCIDE_CON_UN_FIJO = 'Cae el mismo día que un feriado fijo: no cambia nada';
const textoTrasladado = (original) =>
  `Trasladado del ${diaDeLaSemana(original)} ${original.slice(8, 10)}/${original.slice(5, 7)}`;
const textoFinDeSemana = (dia) => `Cae ${dia}: no cambia ningún día hábil`;
const textoCoincide = (nombre) => `Cae el mismo día que «${nombre}»`;
const avisoYaEsFeriado = ({ nombre, fijo }) => `Ese día ya es feriado: ${nombre}${fijo ? ' (fijo del sistema)' : ''}.`;

const anioDe = (fecha) => Number(fecha.slice(0, 4));
const PRIMER_ANIO = anioDe(FECHA_MINIMA_FERIADO);
// 'AAAA-MM-DD' de un año y un 'MM-DD' (puede no existir: quien la usa la controla con esFechaIso)
const fechaDe = (anio, mesYDia) => `${String(anio).padStart(4, '0')}-${mesYDia}`;
const esFinDeSemana = (dia) => dia === 'sábado' || dia === 'domingo';
const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
// Vacío: no vino, null o un texto de espacios
const esVacio = (valor) => valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

// Un año del pedido: un número entero de 1 a 9999, o un texto de cuatro cifras (el de una dirección: ?desde=2028). null si no
const anioDeEntrada = (valor) => {
  if (typeof valor === 'number') return Number.isInteger(valor) && valor >= 1 && valor <= 9999 ? valor : null;
  if (typeof valor === 'string' && /^\d{4}$/.test(valor)) return Number(valor) || null;
  return null;
};

// El año siguiente al de hoy, el último del rango de fechas; null si hoy no es una fecha
const ultimoAnioDelRango = (hoy) => (esFechaIso(hoy) ? anioDe(hoy) + 1 : null);

// Una fecha del 01/01/2025 al 31/12 del año siguiente al de hoy. Sin un hoy válido no pasa (no hay tope)
const fechaEnElRango = (fecha, hoy) => {
  const ultimo = ultimoAnioDelRango(hoy);
  return ultimo !== null && esFechaIso(fecha) && fecha >= FECHA_MINIMA_FERIADO && anioDe(fecha) <= ultimo;
};

// 'lunes', …, 'domingo' (en minúscula y con tilde), o null si no es una fecha
export const diaDeLaSemana = (fecha) => {
  if (!esFechaIso(fecha)) return null;
  // Mediodía UTC, como el calendario (Date.UTC tomaría un año de 0 a 99 como 19xx)
  return DIAS_DE_LA_SEMANA[new Date(`${fecha}T12:00:00Z`).getUTCDay()];
};

// Si una fila que se repite, con su fecha ya controlada, alcanza el año: desde el de su fecha (no hacia atrás) hasta
// `hasta_anio` (null: sigue). Los años de `no_rige` los alcanza: ese año va en la lista, pero no rige
const alcanzaElAnio = (fila, anio) => {
  if (anio < anioDe(fila.fecha)) return false;
  const hasta = fila.hasta_anio ?? null;
  // Escrito al revés a propósito: un hasta_anio que no es un número no lo deja regir para siempre
  return hasta === null || anio <= Number(hasta);
};

// La fila en el año `anio` (un número entero): `{ fecha, rige }` si ese año va en la lista (rige: false si es uno de su
// `no_rige`), o null si no va: dada de baja, sin una fecha válida, fuera de su rango o un día que ese año no existe (un 29/02).
// Sin `se_repite`, va solo en el año de su fecha y siempre rige (hasta_anio y no_rige no cuentan). La comparten
// fechaEnElAnio, que cuenta días, y feriadosDelAnio, que lista también los años que no rigen
const proyeccionEnElAnio = (fila, anio) => {
  if (!esObjeto(fila) || !Number.isInteger(anio)) return null;
  const { fecha } = fila;
  if (Number(fila.activo) !== 1 || !esFechaIso(fecha)) return null;
  if (Number(fila.se_repite) !== 1) return anio === anioDe(fecha) ? { fecha, rige: true } : null;
  if (!alcanzaElAnio(fila, anio)) return null;
  const enElAnio = fechaDe(anio, fecha.slice(5));
  if (!esFechaIso(enElAnio)) return null;
  const noRige = Array.isArray(fila.no_rige) && fila.no_rige.some((otro) => Number(otro) === anio);
  return { fecha: enElAnio, rige: !noRige };
};

// La fecha de la fila en el año `anio` (un número entero), solo si ese año rige; si no, null. Una dada de baja nunca rige.
// Sin `se_repite`, rige solo en el año de su fecha (hasta_anio y no_rige no cuentan). Con `se_repite`, desde el año de su
// fecha (no hacia atrás) hasta `hasta_anio` (null: sigue), salvo los años de `no_rige`. Si ese día no existe ese año (un
// 29/02), null.
export const fechaEnElAnio = (fila, anio) => {
  const proyeccion = proyeccionEnElAnio(fila, anio);
  return proyeccion !== null && proyeccion.rige ? proyeccion.fecha : null;
};

/**
 * Las fechas en que rige la fila de desdeAnio a hastaAnio (los dos incluidos, enteros), de la más vieja a la más nueva:
 * `fechaEnElAnio` de cada año del rango, sin los null. Todas, caigan o no en un día hábil: esta función no filtra nada más. Uno
 * que se repite da las de todos los años en que rige (decisión del usuario, 26/10/2026); uno que no se repite, solo su fecha, si
 * cae en el rango. Con una fila o un rango que no sirven, []. Solo recorre los años que existen (de 1 a 9999). Las licencias de
 * Mi espacio que incluye un feriado no se cuentan con estas, sino con las que deja `fechasQueCambianDiasHabiles`.
 */
export const fechasDelFeriado = (fila, desdeAnio, hastaAnio) => {
  if (!Number.isInteger(desdeAnio) || !Number.isInteger(hastaAnio)) return [];
  const fechas = [];
  for (let anio = Math.max(desdeAnio, 1); anio <= Math.min(hastaAnio, 9999); anio++) {
    const fecha = fechaEnElAnio(fila, anio);
    if (fecha !== null) fechas.push(fecha);
  }
  return fechas;
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

/**
 * Las fechas de `fechasDelFeriado(fila, desdeAnio, hastaAnio)` en que el feriado cambia de verdad un día hábil (decisión del
 * usuario, 27/10/2026: el modal cuenta solo las licencias de Mi espacio en las que cambia algo): las que sin él serían un día
 * hábil, o sea, que no caen sábado ni domingo, no son uno de los 9 fijos y ningún feriado de `otrasFilas` rige ese día
 * (`feriadosDelRango`: uno dado de baja o un año que no rige no cuenta). Uno que se repite, cada año por separado: el 13/12 es
 * domingo en 2026 y lunes en 2027. `otrasFilas` va sin la fila misma (la que se corrige: la saca quien llama); una que no es una
 * lista no saca ningún día.
 */
export const fechasQueCambianDiasHabiles = (fila, desdeAnio, hastaAnio, otrasFilas) => {
  const fechas = fechasDelFeriado(fila, desdeAnio, hastaAnio);
  if (fechas.length === 0) return [];
  const otros = feriadosDelRango(otrasFilas, fechas[0], fechas.at(-1));
  return fechas.filter((fecha) => esDiaHabilCon(fecha, otros));
};

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

// La fecha, si es un día hábil con los feriados, o el primero que la sigue. null si no es una fecha o si en 366 días (la
// fecha y los 365 que siguen; TOPE_DE_VUELTAS, el del calendario) no hay ninguno, y nunca pasa del 31/12/9999
export const proximoDiaHabilCon = (fecha, feriados) => {
  let dia = fecha;
  for (let vuelta = 0; vuelta < TOPE_DE_VUELTAS && esFechaIso(dia); vuelta++, dia = sumarDias(dia, 1)) {
    if (esDiaHabilCon(dia, feriados)) return dia;
  }
  return null;
};

// El n-ésimo día hábil anterior a la fecha, sin contarla (con n = 0, la fecha misma), con los feriados. null si no es una
// fecha, si n no es un entero de 0 en adelante o si en los 366 días anteriores no se juntan n
export const restarDiasHabilesCon = (fecha, n, feriados) => {
  if (!esFechaIso(fecha) || !Number.isInteger(n) || n < 0) return null;
  let dia = fecha;
  for (let vuelta = 0, contados = 0; contados < n; vuelta++) {
    if (vuelta === TOPE_DE_VUELTAS) return null;
    dia = sumarDias(dia, -1);
    if (!esFechaIso(dia)) return null;
    if (esDiaHabilCon(dia, feriados)) contados++;
  }
  return dia;
};

// El último día hábil del mes 'AAAA-MM', con los feriados. null si no es un mes o si ningún día del mes es hábil: nunca da
// un día de otro mes
export const ultimoDiaHabilDelMesCon = (mes, feriados) => {
  if (typeof mes !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return null;
  for (let dia = 31; dia >= 1; dia--) {
    const fecha = `${mes}-${String(dia).padStart(2, '0')}`;
    if (esFechaIso(fecha) && esDiaHabilCon(fecha, feriados)) return fecha;
  }
  return null;
};

// Lo que dicen la corrida y Correos → Estado cuando la tabla no se pudo leer y el calendario cayó a los 9 fijos (spec
// 2026-10-27-feriados-en-notas, 2 y 6). Esa caída se detecta con `calendario.error !== null`, nunca por `origen`
export const MENSAJE_CORRIDA_SIN_FERIADOS =
  'No se pudieron leer los feriados de Configuración → Feriados: la corrida usó solo los 9 fijos.';
export const MENSAJE_ESTADO_SIN_FERIADOS =
  'No se pudieron leer los feriados de Configuración → Feriados: las fechas de esta pantalla cuentan solo los 9 feriados fijos.';

/**
 * El calendario con los feriados de la tabla (spec 2026-10-27-feriados-en-notas, 1): el mismo objeto que `CALENDARIO_FIJO`,
 * `{ esDiaHabil, proximoDiaHabil, diaHabilAnterior, ultimoDiaHabilHasta, primerDiaHabilDelMes, rangoDeAviso,
 * diasHabilesTranscurridos, sumarDiasHabiles, origen, error }`, congelado, con las derivadas sobre un predicado que es
 * `esDiaHabil` y que la fecha no esté entre los feriados de su año (`feriadosDelRango` de ese año, armado la primera vez que se
 * pide y guardado: los recorridos no tienen un rango de antemano). El predicado no llama a esFechaIso (es mucho más lento): con
 * un texto que no es una fecha da lo mismo que esDiaHabil. Sin filas da lo mismo que CALENDARIO_FIJO.
 * Las filas se copian al armarlo: sacar o agregar filas después no lo cambia. Una que no es una lista cuenta como ninguna.
 * @param {object[]} filas las de `filasDeFeriados`
 * @param {{ origen?: 'tabla' | 'fijos', error?: string | null }} [opciones] de dónde salió: leerCalendario, al caer a los 9 fijos
 */
export const calendarioCon = (filas, { origen = 'tabla', error = null } = {}) => {
  const lista = Array.isArray(filas) ? [...filas] : [];
  const porAnio = new Map();
  const delAnio = (anio) => {
    if (!porAnio.has(anio)) porAnio.set(anio, feriadosDelRango(lista, `${anio}-01-01`, `${anio}-12-31`));
    return porAnio.get(anio);
  };
  const esHabil = (fecha) => esDiaHabil(fecha) && !delAnio(fecha.slice(0, 4)).has(fecha);
  return Object.freeze({ ...derivadasDe(esHabil), origen, error });
};

// Lo que dice la corrida cuando la foto del 31/12 no se saca porque la tabla no se pudo leer (spec 2026-10-27-feriados-en-notas,
// 2 y 6). En minúscula: la corrida lo anota detrás de «No se pudo sacar la foto del año: »
export const MENSAJE_METRICAS_SIN_FERIADOS = 'no se pudieron leer los feriados de Configuración → Feriados';

// El calendario, si se leyó de la tabla; si cayó a los 9 fijos (`error !== null`, nunca por `origen`), tira con
// MENSAJE_METRICAS_SIN_FERIADOS, a propósito: Métricas y la foto no cuentan con los 9 fijos como si fueran la tabla (spec
// 2026-10-27-feriados-en-notas, 2: la foto no se saca y se reintenta en la corrida siguiente)
export const exigirLaTabla = (calendario) => {
  if (calendario.error !== null) throw new Error(MENSAJE_METRICAS_SIN_FERIADOS);
  return calendario;
};

// Los días de desde a hasta (los dos incluidos), en orden, que son hábiles con los 9 fijos (esDiaHabil) y no con el calendario:
// los que la tabla sacó de los hábiles. Los guarda la foto del 31/12, para volver a armar su calendario al leerla
// (calendarioDeFechas). [] con una fecha que no es una fecha o desde > hasta
export const feriadosDelCalendario = (calendario, desde, hasta) => {
  if (!esFechaIso(desde) || !esFechaIso(hasta) || hasta < desde) return [];
  const fechas = [];
  // Se cuentan los días, no se compara el texto: después del 9999-12-31, sumarDias da '+010000-01', que es menor
  const total = diasEntre(desde, hasta) + 1;
  for (let i = 0, fecha = desde; i < total; i++, fecha = sumarDias(fecha, 1)) {
    if (esDiaHabil(fecha) && !calendario.esDiaHabil(fecha)) fechas.push(fecha);
  }
  return fechas;
};

// El calendario de una lista de fechas no hábiles (las de feriadosDelCalendario): una fila suelta por fecha, que no se repite y
// rige. Con la lista de feriadosDelCalendario da lo mismo que el calendario original en ese rango. Una que no es una lista
// cuenta como ninguna fecha (los 9 fijos)
export const calendarioDeFechas = (fechas) =>
  calendarioCon((Array.isArray(fechas) ? fechas : []).map((fecha) => ({ fecha, se_repite: 0, activo: 1 })));

const rechazo = (campo, mensaje) => ({ datos: null, error: { campo, mensaje } });

/**
 * Valida un feriado, el cuerpo de un alta o de una corrección (spec, sección 1). Devuelve `{ datos, error }`:
 * - `error`: null, o `{ campo, mensaje }` del primero que no sirve, en el orden fecha, nombre, tipo, trasladado_de y el
 *   29/02 que se repite (en `se_repite`); entonces `datos` es null.
 * - `datos`: `{ fecha, nombre, tipo, trasladado_de, se_repite }`, con el nombre recortado, `trasladado_de` vacío como null y
 *   `se_repite` en 1 (con true, 1 o '1') o 0.
 * La fecha va del 01/01/2025 al 31/12 del año siguiente al de hoy (sin un hoy válido, no pasa); el nombre, obligatorio y de
 * hasta 150 caracteres contados con Array.from; `trasladado_de`, otra fecha del mismo año. Una entrada que no es un objeto
 * cuenta como `{}`.
 */
export const validarFeriado = (entrada, hoy) => {
  const fuente = esObjeto(entrada) ? entrada : {};
  const { fecha, tipo } = fuente;
  if (!fechaEnElRango(fecha, hoy)) return rechazo('fecha', MENSAJES_FERIADO.fecha);

  const nombre = typeof fuente.nombre === 'string' ? fuente.nombre.trim() : '';
  if (nombre === '') return rechazo('nombre', MENSAJES_FERIADO.nombre);
  if (Array.from(nombre).length > LARGO_NOMBRE_FERIADO) return rechazo('nombre', MENSAJES_FERIADO.nombreLargo);

  if (!TIPOS_FERIADO.includes(tipo)) return rechazo('tipo', MENSAJES_FERIADO.tipo);

  const trasladado = esVacio(fuente.trasladado_de) ? null : fuente.trasladado_de;
  const trasladadoSirve = trasladado === null
    || (esFechaIso(trasladado) && trasladado !== fecha && anioDe(trasladado) === anioDe(fecha));
  if (!trasladadoSirve) return rechazo('trasladado_de', MENSAJES_FERIADO.trasladado);

  const seRepite = [true, 1, '1'].includes(fuente.se_repite) ? 1 : 0;
  if (seRepite === 1 && fecha.slice(5) === '02-29') return rechazo('se_repite', MENSAJES_FERIADO.repite29);

  return { datos: { fecha, nombre, tipo, trasladado_de: trasladado, se_repite: seRepite }, error: null };
};

/**
 * Lo que una corrección (`PUT /api/feriados/:id`) controla además de `validarFeriado`: con el «se repite» que queda después de
 * corregir (`datos.se_repite`, el de validarFeriado), una fila guardada con `hasta_anio` (dada de baja desde un año) no puede
 * pasar a una fecha de un año posterior a ese: no regiría ningún año y ninguna lista la mostraría, así que tampoco se podría
 * volver a corregir. Vale también para una a la que se le vuelve a marcar «se repite» sobre el `hasta_anio` que conservó.
 * Devuelve `{ campo: 'fecha', mensaje }` o null: sin «se repite», sin `hasta_anio` (null) o con datos que no son de
 * validarFeriado, null.
 */
export const errorDeLaCorreccion = (datos, fila) => {
  if (!esObjeto(datos) || !esObjeto(fila) || datos.se_repite !== 1 || !esFechaIso(datos.fecha)) return null;
  const hasta = fila.hasta_anio;
  if (!Number.isInteger(hasta)) return null;
  return anioDe(datos.fecha) > hasta ? { campo: 'fecha', mensaje: MENSAJES_FERIADO.despuesDeLaBaja } : null;
};

/**
 * Valida «no rige» de una fila que se repite (`PUT /api/feriados/:id/rige`): `{ anio, rige, pasa_al }`. Devuelve
 * `{ datos: { anio, rige, pasa_al }, error }`, con el error del primero que no sirve, en este orden:
 * - una fila que no se repite: noSeRepite, sin campo;
 * - `anio`: un entero (o un texto de cuatro cifras) desde el año de la fila, no mayor que su `hasta_anio` y del rango de
 *   fechas (de 2025 al año siguiente al de hoy);
 * - `rige`: true o false, nada más;
 * - `pasa_al`: solo con `rige: false`, opcional (vacío es null): una fecha de ese mismo año, distinta de la fecha de la fila
 *   ese año. Con `rige: true` se ignora y va null.
 */
export const validarRige = (entrada, fila, hoy) => {
  if (!esObjeto(fila) || Number(fila.se_repite) !== 1) return rechazo(null, MENSAJES_FERIADO.noSeRepite);
  const fuente = esObjeto(entrada) ? entrada : {};

  const anio = anioDeEntrada(fuente.anio);
  const ultimo = ultimoAnioDelRango(hoy);
  const anioSirve = anio !== null && esFechaIso(fila.fecha) && alcanzaElAnio(fila, anio)
    && ultimo !== null && anio >= PRIMER_ANIO && anio <= ultimo;
  if (!anioSirve) return rechazo('anio', MENSAJES_FERIADO.anio);

  const { rige } = fuente;
  if (rige !== true && rige !== false) return rechazo('rige', MENSAJES_FERIADO.rige);

  const pasaAl = rige === false && !esVacio(fuente.pasa_al) ? fuente.pasa_al : null;
  const pasaAlSirve = pasaAl === null
    || (esFechaIso(pasaAl) && anioDe(pasaAl) === anio && pasaAl !== fechaDe(anio, fila.fecha.slice(5)));
  if (!pasaAlSirve) return rechazo('pasa_al', MENSAJES_FERIADO.pasaAl);

  return { datos: { anio, rige, pasa_al: pasaAl }, error: null };
};

/**
 * La baja de una fila (`DELETE /api/feriados/:id?desde=AAAA`): `{ cambio, error }`, con `cambio` lo que se escribe.
 * - Sin `se_repite`, siempre la baja entera, `{ activo: 0 }` (desde no cuenta).
 * - Con `se_repite`, `desde` es el año desde el que deja de regir (un entero, o un texto de cuatro cifras; si no, el error
 *   en `desde`): si es el año de la fila, o uno anterior, la baja entera; si no, `{ hasta_anio: desde - 1 }` y los años
 *   anteriores no cambian. Nunca la hace regir más años: con un `hasta_anio` guardado menor, queda ese.
 */
export const bajaDesde = (fila, desde) => {
  const entera = { cambio: { activo: 0 }, error: null };
  if (!esObjeto(fila) || Number(fila.se_repite) !== 1) return entera;
  const anio = anioDeEntrada(desde);
  if (anio === null) return { cambio: null, error: { campo: 'desde', mensaje: MENSAJES_FERIADO.desde } };
  if (!esFechaIso(fila.fecha) || anio <= anioDe(fila.fecha)) return entera;
  const guardado = fila.hasta_anio === null || fila.hasta_anio === undefined ? null : Number(fila.hasta_anio);
  const hasta = Number.isInteger(guardado) && guardado < anio - 1 ? guardado : anio - 1;
  return { cambio: { hasta_anio: hasta }, error: null };
};

const compararTexto = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// En la lista de un año: por fecha; en el mismo día, el fijo primero y después por nombre (y por id, para que el orden no
// dependa del de la base)
const compararDeLaLista = (a, b) => compararTexto(a.fecha, b.fecha)
  || Number(b.fijo) - Number(a.fijo)
  || a.nombre.localeCompare(b.nombre, 'es')
  || (Number(a.id) || 0) - (Number(b.id) || 0);

// La fecha original de un traslado en el año: la guardada, o, en una que se repite, el mismo día y mes de ese año (null si
// no hay o ese día no existe ese año)
const trasladadoEnElAnio = (fila, anio) => {
  const { trasladado_de: original } = fila;
  if (!esFechaIso(original)) return null;
  if (Number(fila.se_repite) !== 1) return original;
  const enElAnio = fechaDe(anio, original.slice(5));
  return esFechaIso(enElAnio) ? enElAnio : null;
};

/**
 * La lista de un año, para la pestaña y para `GET /api/feriados` (spec, sección 2): los 9 fijos y las filas de la tabla que
 * van ese año (`proyeccionEnElAnio`: las que se repiten, proyectadas al año, también si ese año no rigen; ni las dadas de
 * baja ni las de fuera de su rango), ordenadas con `compararDeLaLista`. Cada una:
 * `{ id, fecha, dia_semana, nombre, tipo, tipo_nombre, fijo, se_repite, rige, trasladado_de, aclaraciones, fecha_guardada,
 * trasladado_de_guardado, hasta_anio }`.
 * - `fecha` y `trasladado_de` son las del año que se mira (en una que se repite, proyectadas); `fecha_guardada`,
 *   `trasladado_de_guardado` y `hasta_anio` son los guardados en la fila, los que usa el modal para corregirla: corregir
 *   con la fecha proyectada movería el primer año de una que se repite.
 * - Un fijo: `id` null, `tipo` 'fijo', `tipo_nombre` 'Fijo del sistema', `se_repite` 1, sin aclaraciones y con los tres
 *   guardados en null.
 * - Una de la tabla, sus aclaraciones en este orden: de qué fecha se trasladó, si cae un fin de semana y con cuáles cae el
 *   mismo día (un fijo, o «Cae el mismo día que «<nombre>»» por cada una de la tabla que también rige). Una que ese año no
 *   rige dice solo «Este año no rige» y no cuenta para las demás.
 * El año, un entero o un texto de cuatro cifras; si no, una lista vacía. Los textos van planos: los escapa la página.
 */
export const feriadosDelAnio = (filas, anio) => {
  const elAnio = anioDeEntrada(anio);
  if (elAnio === null) return [];

  const fijos = [...FERIADOS_FIJOS].map((mesYDia) => {
    const fecha = fechaDe(elAnio, mesYDia);
    return {
      id: null, fecha, dia_semana: diaDeLaSemana(fecha),
      nombre: Object.hasOwn(NOMBRES_DE_LOS_FIJOS, mesYDia) ? NOMBRES_DE_LOS_FIJOS[mesYDia] : '',
      tipo: 'fijo', tipo_nombre: TIPO_NOMBRE_FIJO, fijo: true, se_repite: 1, rige: true, trasladado_de: null, aclaraciones: [],
      fecha_guardada: null, trasladado_de_guardado: null, hasta_anio: null
    };
  });

  const deLaTabla = [];
  for (const fila of Array.isArray(filas) ? filas : []) {
    const proyeccion = proyeccionEnElAnio(fila, elAnio);
    if (proyeccion === null) continue;
    const { fecha, rige } = proyeccion;
    const tipo = fila.tipo ?? null;
    const hastaGuardado = fila.hasta_anio === null || fila.hasta_anio === undefined ? null : Number(fila.hasta_anio);
    deLaTabla.push({
      id: fila.id ?? null, fecha, dia_semana: diaDeLaSemana(fecha), nombre: String(fila.nombre ?? ''), tipo,
      tipo_nombre: Object.hasOwn(NOMBRES_TIPO_FERIADO, tipo) ? NOMBRES_TIPO_FERIADO[tipo] : String(tipo ?? ''),
      fijo: false, se_repite: Number(fila.se_repite) === 1 ? 1 : 0, rige,
      trasladado_de: trasladadoEnElAnio(fila, elAnio), aclaraciones: [],
      // Los guardados (proyeccionEnElAnio ya controló la fecha)
      fecha_guardada: fila.fecha,
      trasladado_de_guardado: esFechaIso(fila.trasladado_de) ? fila.trasladado_de : null,
      hasta_anio: Number.isInteger(hastaGuardado) ? hastaGuardado : null
    });
  }

  const lista = [...fijos, ...deLaTabla].sort(compararDeLaLista);
  // Las aclaraciones van después de ordenar: las coincidencias salen en el orden de la lista
  for (const item of deLaTabla) {
    if (!item.rige) {
      item.aclaraciones.push(NO_RIGE);
      continue;
    }
    if (item.trasladado_de !== null) item.aclaraciones.push(textoTrasladado(item.trasladado_de));
    if (esFinDeSemana(item.dia_semana)) item.aclaraciones.push(textoFinDeSemana(item.dia_semana));
    for (const otro of lista) {
      if (otro === item || otro.fecha !== item.fecha || !otro.rige) continue;
      item.aclaraciones.push(otro.fijo ? COINCIDE_CON_UN_FIJO : textoCoincide(otro.nombre));
    }
  }
  return lista;
};

/**
 * Los avisos de la API al cargar o corregir un feriado (spec, sección 3), que no frenan nada: «Cae domingo: no cambia ningún
 * día hábil.» (o sábado) y, por cada uno que ese día ya rige, «Ese día ya es feriado: <nombre> (fijo del sistema).» o «Ese
 * día ya es feriado: <nombre>.», en el orden de la lista. Se calculan con la lista del año de la fecha (`feriadosDelAnio`:
 * los fijos, las filas de ese año y las que se repiten), sin la fila `excluirId` (la que se corrige; null: ninguna). Una
 * fecha que no es una fecha no da avisos.
 */
export const avisosDeLaFecha = (fecha, filas, excluirId) => {
  if (!esFechaIso(fecha)) return [];
  const avisos = [];
  const dia = diaDeLaSemana(fecha);
  if (esFinDeSemana(dia)) avisos.push(`${textoFinDeSemana(dia)}.`);
  // La que se corrige: un id positivo, como número o como texto; cualquier otra cosa no excluye ninguna (nunca un fijo)
  const idExcluido = ['number', 'string'].includes(typeof excluirId) && /^[1-9]\d*$/.test(String(excluirId))
    ? Number(excluirId) : null;
  for (const item of feriadosDelAnio(filas, anioDe(fecha))) {
    if (item.fecha !== fecha || !item.rige) continue;
    if (!item.fijo && idExcluido !== null && Number(item.id) === idExcluido) continue;
    avisos.push(avisoYaEsFeriado(item));
  }
  return avisos;
};

/**
 * Los años del selector de la pestaña, de menor a mayor: los anteriores al en curso, desde 2025, que tienen algún feriado de
 * la tabla que rige (`fechaEnElAnio`), más el en curso y el siguiente. Sin un hoy válido, una lista vacía.
 */
export const aniosDelSelector = (filas, hoy) => {
  if (!esFechaIso(hoy)) return [];
  const enCurso = anioDe(hoy);
  const lista = Array.isArray(filas) ? filas : [];
  const anios = [];
  for (let anio = PRIMER_ANIO; anio < enCurso; anio++) {
    if (lista.some((fila) => fechaEnElAnio(fila, anio) !== null)) anios.push(anio);
  }
  return [...anios, enCurso, enCurso + 1];
};
