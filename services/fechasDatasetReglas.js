// Reglas de las fechas de un dataset (spec 2026-10-17-fechas-datasets, secciones 2, 5 y 7): qué datos se piden para un
// vencimiento, qué próximas se ofrecen al registrar una actualización y en qué estado está el dataset. Funciones puras,
// sin base de datos ni Date local: las fechas son strings 'AAAA-MM-DD' y los meses se suman sobre el índice
// año × 12 + mes − 1. Febrero va siempre en 28, también en los años bisiestos (R1). Ninguna función tira error: con una
// entrada inválida devuelven null, false o una lista vacía.
import { diasEntre, esFechaIso, formatoCorto } from './notasDigitalesCalendario.js';

export const TIPOS_PEDIDO = Object.freeze(['acumulado', 'foto', 'anio_anterior', 'ejercicio', 'edicion', 'relevamiento', 'eventual']);

// Nombre en pantalla de cada tipo de pedido (spec, sección 5)
export const NOMBRES_TIPO_PEDIDO = Object.freeze({
  acumulado: 'Acumulado',
  foto: 'Foto al corte',
  anio_anterior: 'Año anterior completo',
  ejercicio: 'Ejercicio que empieza',
  edicion: 'Próxima edición',
  relevamiento: 'Relevamiento interno',
  eventual: 'Eventual'
});

// "Próximo a vencer": hasta 60 días corridos antes del vencimiento, con el día del vencimiento incluido
const DIAS_PROXIMO_A_VENCER = 60;
// Febrero en 28 siempre (R1)
const DIAS_DEL_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const MOTIVO_SIGUIENTE = 'Siguiente período';
const MOTIVO_PRIMERO_SIN_LLEGAR = 'Primer pedido que todavía no llegó';
const MOTIVO_MANTENER = 'Mantener: se siguen debiendo datos de lo que se pidió';
const MOTIVO_RELEVAMIENTO = 'Relevamiento más la frecuencia';

const anioDe = (iso) => Number(iso.slice(0, 4));
const primeroDeEnero = (anio) => `${String(anio).padStart(4, '0')}-01-01`;
const finDeAnio = (anio) => `${String(anio).padStart(4, '0')}-12-31`;
// Índice del mes de una fecha: año × 12 + mes − 1
const indiceDeMes = (iso) => anioDe(iso) * 12 + Number(iso.slice(5, 7)) - 1;
// Una frecuencia en meses es un entero positivo; la Eventual no tiene (null)
const esMeses = (meses) => Number.isInteger(meses) && meses > 0;

// Último día del mes, con febrero en 28. null si el año (1 a 9999) o el mes (1 a 12) no son válidos
export const finDeMes = (anio, mes) => {
  if (!Number.isInteger(anio) || anio < 1 || anio > 9999 || !Number.isInteger(mes) || mes < 1 || mes > 12) return null;
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${DIAS_DEL_MES[mes - 1]}`;
};

const finDeMesDelIndice = (indice) => {
  const anio = Math.floor(indice / 12);
  return finDeMes(anio, indice - anio * 12 + 1);
};

// El último día del mes de iso: el vencimiento que le corresponde a ese mes (R1)
export const vencimientoDelMes = (iso) => (esFechaIso(iso) ? finDeMesDelIndice(indiceDeMes(iso)) : null);

// '2028-02-28' sí; '2028-02-29' no, porque febrero va siempre en 28
export const esFinDeMes = (iso) => esFechaIso(iso) && iso === vencimientoDelMes(iso);

// El último día del mes que está n meses después (o antes, con n negativo) del mes de iso
export const sumarMeses = (iso, n) => (esFechaIso(iso) && Number.isInteger(n) ? finDeMesDelIndice(indiceDeMes(iso) + n) : null);

// R2: los datos se piden al último día del mes anterior al del vencimiento
export const corteDe = (vencimiento) => sumarMeses(vencimiento, -1);

/**
 * R7: el último vencimiento del ciclo que ya pasó, sumando la frecuencia al vencimiento mientras siga en el pasado. Un
 * vencimiento del ciclo que cae hoy ya cuenta. Devuelve el vencimiento tal cual si todavía no pasó o si no hay
 * frecuencia en meses (Eventual), y null si el vencimiento o hoy no son fechas válidas.
 */
export const ultimoVencimientoPasado = (vencimiento, meses, hoy) => {
  if (!esFechaIso(vencimiento) || !esFechaIso(hoy)) return null;
  if (!esMeses(meses)) return vencimiento;
  let ultimo = vencimiento;
  let siguiente = sumarMeses(ultimo, meses);
  while (siguiente !== null && siguiente <= hoy) {
    ultimo = siguiente;
    siguiente = sumarMeses(ultimo, meses);
  }
  return ultimo;
};

// Tipo de pedido que corresponde por la gestión y la frecuencia (spec, sección 5)
export const tipoSugerido = (gestion, meses) => {
  if (!esMeses(meses)) return 'eventual';
  if (gestion === 'interna') return 'relevamiento';
  return meses <= 12 ? 'acumulado' : 'foto';
};

// El tipo guardado en el dataset o, si no tiene uno válido, el sugerido: un dataset sin cargar nunca falla
export const tipoEfectivo = (dataset) => {
  const { tipo_pedido: tipoPedido, tipo_gestion: tipoGestion, meses } = dataset ?? {};
  return TIPOS_PEDIDO.includes(tipoPedido) ? tipoPedido : tipoSugerido(tipoGestion, meses);
};

// El 1° del mes siguiente al de iso. null si iso no es válida o si pasaría del año 9999
const primeroDelMesSiguiente = (iso) => {
  const finDelMesSiguiente = sumarMeses(iso, 1);
  return finDelMesSiguiente === null ? null : `${finDelMesSiguiente.slice(0, 8)}01`;
};

// R3, "se pide siempre todo lo que falta": si el mes siguiente al de "Datos al" empieza antes de inicio, el pedido
// arranca ahí. Es el 1° de ese mes, no datosAl + 1 día: por R5, '2028-02-28' es el fin de febrero de 2028 y lo que
// falta empieza el 01/03, nunca el 29/02. Sin datos publicados, desde inicio
const inicioConLoQueFalta = (inicio, datosAl) => {
  const siguiente = primeroDelMesSiguiente(datosAl);
  return siguiente !== null && siguiente < inicio ? siguiente : inicio;
};

const periodo = (inicio, hasta, datosAl) => {
  const desde = inicioConLoQueFalta(inicio, datosAl);
  return { desde, hasta, texto: `Del ${formatoCorto(desde)} al ${formatoCorto(hasta)}` };
};

// El presupuesto del ejercicio del vencimiento y, si faltan, los anteriores: el primer ejercicio que falta es el del año
// siguiente al de "Datos al" (en los presupuestos, "Datos al" es el 31/12 del ejercicio publicado)
const ejercicios = (anio, datosAl) => {
  const primero = esFechaIso(datosAl) ? Math.min(anio, anioDe(datosAl) + 1) : anio;
  let texto = `Presupuesto del ejercicio ${anio}`;
  if (primero < anio) texto = `Presupuestos de los ejercicios ${primero} ${anio - primero === 1 ? 'y' : 'a'} ${anio}`;
  return { desde: primeroDeEnero(primero), hasta: finDeAnio(anio), texto };
};

/**
 * Qué datos se piden para un vencimiento (spec, secciones 5 y 7): { desde, hasta, texto }. hasta es lo que hay que
 * recibir para dar el pedido por cubierto (null en edicion y relevamiento, que no tienen período). Con hoy y meses
 * aplica R7 si el vencimiento ya pasó; sin hoy, es el pedido de ese vencimiento tal cual. datosAl (los datos publicados)
 * solo sirve para pedir todo lo que falta. Un vencimiento viejo que no es fin de mes cuenta como el fin de su mes.
 * null si es eventual, si el tipo no existe o si el vencimiento no es una fecha válida.
 */
export const pedido = (datos) => {
  const { vencimiento, tipo, datosAl = null, meses = null, hoy = null } = datos ?? {};
  const delMes = vencimientoDelMes(vencimiento);
  if (delMes === null || !TIPOS_PEDIDO.includes(tipo) || tipo === 'eventual') return null;
  if (tipo === 'edicion') return { desde: null, hasta: null, texto: 'Próxima edición disponible' };
  if (tipo === 'relevamiento') return { desde: null, hasta: null, texto: 'Relevamiento actualizado' };

  const efectivo = esFechaIso(hoy) ? ultimoVencimientoPasado(delMes, meses, hoy) : delMes;
  if (tipo === 'ejercicio') return ejercicios(anioDe(efectivo), datosAl);
  const corte = corteDe(efectivo);
  if (corte === null) return null; // enero del año 1: no hay mes anterior
  if (tipo === 'foto') return { desde: corte, hasta: corte, texto: `Vigente al ${formatoCorto(corte)}` };
  if (tipo === 'acumulado') return periodo(primeroDeEnero(anioDe(corte)), corte, datosAl);
  // anio_anterior: el último año calendario cerrado al corte
  const anio = corte.endsWith('-12-31') ? anioDe(corte) : anioDe(corte) - 1;
  return periodo(primeroDeEnero(anio), finDeAnio(anio), datosAl);
};

/**
 * Si los datos al datosAl cubren el pedido de ese vencimiento. Mira lo que se pidió para esa fecha, sin R7 (no lo que
 * se pediría hoy): por eso no recibe hoy. false si el pedido no tiene hasta (edicion, relevamiento, eventual) o si
 * alguna fecha no es válida.
 */
export const cubre = (datosAl, vencimiento, tipo, meses) => {
  const hasta = pedido({ vencimiento, tipo, meses })?.hasta ?? null;
  return esFechaIso(datosAl) && hasta !== null && datosAl >= hasta;
};

// Por qué conviene revisar una opción antes de elegirla: ya pasó (el dataset queda vencido) o pediría datos que ya llegaron
const advertenciaDe = (yaPaso, pideLoQueLlego) => {
  if (yaPaso && pideLoQueLlego) return 'Ya pasó y pediría datos que ya llegaron';
  if (yaPaso) return 'Ya pasó';
  return pideLoQueLlego ? 'Pediría datos que ya llegaron' : null;
};

/**
 * Las próximas que se ofrecen al registrar una actualización con datos al datosNuevo (spec, sección 7), en orden: la
 * sugerida primero, después "Mantener" y el siguiente período si no es el sugerido. Nunca elige: "Otra fecha" la agrega
 * la interfaz. pideDespues es lo que pediría la nota si se elige esa fecha, con R7 y lo que falta.
 * [{ fecha, motivo, sugerida, advertencia, pideDespues }]. Lista vacía si es eventual o si falta una entrada válida.
 */
export const opcionesDeProxima = (datos) => {
  const { vencimiento, tipo, meses, datosNuevo, hoy } = datos ?? {};
  if (!TIPOS_PEDIDO.includes(tipo) || tipo === 'eventual' || !esMeses(meses) || !esFechaIso(datosNuevo) || !esFechaIso(hoy)) {
    return [];
  }
  const opcion = (fecha, motivo, sugerida = false) => ({
    fecha,
    motivo,
    sugerida,
    advertencia: advertenciaDe(fecha < hoy, cubre(datosNuevo, fecha, tipo, meses)),
    pideDespues: pedido({ vencimiento: fecha, tipo, datosAl: datosNuevo, meses, hoy })?.texto ?? null
  });

  // Un relevamiento se repite a partir del mes en que se hizo, no del vencimiento anterior
  if (tipo === 'relevamiento') {
    const fecha = sumarMeses(datosNuevo, meses);
    return fecha === null ? [] : [opcion(fecha, MOTIVO_RELEVAMIENTO, true)];
  }

  const actual = vencimientoDelMes(vencimiento);
  const siguiente = sumarMeses(actual, meses);
  if (siguiente === null) return []; // sin un vencimiento válido no hay ciclo
  if (tipo === 'edicion') return [opcion(siguiente, MOTIVO_SIGUIENTE, true)];

  // El primer vencimiento del ciclo, empezando por el actual, que no queda cubierto con esta actualización
  let primero = actual;
  while (cubre(datosNuevo, primero, tipo, meses)) primero = sumarMeses(primero, meses);
  if (primero === null) return []; // pasaría del año 9999
  const sugerida = siguiente > primero ? siguiente : primero;

  const opciones = [opcion(sugerida, sugerida === siguiente ? MOTIVO_SIGUIENTE : MOTIVO_PRIMERO_SIN_LLEGAR, true)];
  if (!cubre(datosNuevo, actual, tipo, meses)) opciones.push(opcion(actual, MOTIVO_MANTENER));
  if (siguiente !== sugerida) opciones.push(opcion(siguiente, MOTIVO_SIGUIENTE));
  return opciones;
};

/**
 * Estado de un dataset según su próxima actualización: { estado, dias }. dias son los días corridos hasta la próxima,
 * negativos si ya venció. Sin frecuencia en meses es eventual; sin próxima válida (o sin hoy), sin-fecha. Vencido es
 * atrasado si la gestión es interna y sin-respuesta si es externa.
 */
export const estadoDelDataset = (datos) => {
  const { proxima, meses, tipoGestion, hoy } = datos ?? {};
  if (!esMeses(meses)) return { estado: 'eventual', dias: null };
  if (!esFechaIso(proxima) || !esFechaIso(hoy)) return { estado: 'sin-fecha', dias: null };
  const dias = diasEntre(hoy, proxima);
  if (dias < 0) return { estado: tipoGestion === 'interna' ? 'atrasado' : 'sin-respuesta', dias };
  return { estado: dias <= DIAS_PROXIMO_A_VENCER ? 'proximo' : 'actualizado', dias };
};

// La fecha más adelantada que puede tener "Datos al": el fin del mes actual. En ejercicio, el 31/12 del año siguiente,
// porque el presupuesto de un año se aprueba antes de que empiece. null si hoy no es una fecha válida
export const topeDatosAl = (tipo, hoy) => {
  if (!esFechaIso(hoy)) return null;
  return tipo === 'ejercicio' ? finDeAnio(anioDe(hoy) + 1) : vencimientoDelMes(hoy);
};
