/**
 * La agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, secciones 1, 5 y 7): las reglas de los eventos, puras (sin
 * pool ni Date local: las fechas son texto 'AAAA-MM-DD' y las horas 'HH:MM', y hoy y ahora llegan por parámetro,
 * `hoyArgentina()` y `ahoraArgentina()` en el servidor). Un momento es 'AAAA-MM-DD HH:MM' y se compara como texto (de
 * `ahoraArgentina()`, que trae los segundos, cuentan los 16 primeros caracteres). Ninguna función tira error: una entrada
 * rara da el error de su campo, null o un texto ('', o la raya donde iba una fecha).
 *
 * Acá están los valores y los textos de la agenda: los recordatorios, los largos, las fechas, los mensajes, quién comparte y
 * los de la corrida de los recordatorios (la ventana, el candado y los atrasados). Después, la validación de un evento
 * (`validarEvento`), el momento en que sale su recordatorio, con los feriados (`momentoDelAviso`: nunca en un día que no es
 * hábil) y los textos de cuándo es un evento y cuándo sale su aviso. Los textos son planos: escaparlos le toca a quien los
 * dibuja.
 *
 * La usan la API de los eventos, sus emails, la corrida de los recordatorios y Correos → Estado. La página
 * (`public/js/mi-espacio.js`) tiene copias de los mensajes, los largos, las fechas y los recordatorios, atadas por tests de
 * paridad: si cambia uno acá, cambia allá. El navegador no recalcula días hábiles: cuándo sale el aviso lo dice el servidor.
 * En el código, la agenda es `evento` o `mi_espacio_`, nunca «agenda» a secas: la Agenda de pedidos de Reportes es otra cosa.
 */
import { esDiaHabilCon, restarDiasHabilesCon, diaDeLaSemana } from './feriadosReglas.js';
import { esFechaIso, sumarDias, formatoCorto } from './notasDigitalesCalendario.js';
import { diaLargo } from './miEspacioResumen.js';
import { textoRango, enLista } from './miEspacioReglas.js';
import { idPositivo } from './proyectosReglas.js';

// Los recordatorios, en el orden del formulario (el enum de mi_espacio_eventos.recordatorio), y el de entrada. Sin «15
// minutos antes»: la corrida es cada media hora
export const RECORDATORIOS = Object.freeze(['1h', '2h', 'dia_anterior', 'ninguno']);
export const RECORDATORIO_POR_DEFECTO = '2h';
// Cómo se muestra cada uno: en el formulario y en el detalle, y en los próximos
export const TEXTO_RECORDATORIO = Object.freeze({
  '1h': '1 hora antes', '2h': '2 horas antes', dia_anterior: 'El día hábil anterior', ninguno: 'Sin aviso'
});
export const AVISO_CORTO = Object.freeze({
  '1h': 'Aviso 1 h antes', '2h': 'Aviso 2 h antes', dia_anterior: 'Aviso el día hábil anterior', ninguno: 'Sin aviso'
});
// Los minutos de anticipación de los que se cuentan por hora (el día hábil anterior es a la misma hora)
const ANTICIPACION = Object.freeze({ '1h': 60, '2h': 120 });

// El largo del título (varchar(150)) y del detalle, en caracteres contados con Array.from
export const LARGO_TITULO_EVENTO = 150;
export const LARGO_DETALLE_EVENTO = 1000;
// La fecha más vieja de un evento; la más nueva es la de fechaMaximaEvento
export const FECHA_MINIMA_EVENTO = '2025-01-01';
// Quienes comparten eventos, aparecen en la lista de personas y ven los «para todos»: administración (los de esAdmin de
// services/usuariosReglas.js, atados por un test)
export const ROLES_QUE_COMPARTEN = Object.freeze(['superadmin', 'admin', 'editor']);
// Los días de la lista de próximos, desde hoy
export const DIAS_DE_PROXIMOS = 30;

// La corrida de los recordatorios (spec, sección 5): los eventos de hoy a hoy + VENTANA_DE_LA_CORRIDA días; el aviso de
// Correos → Estado si en un día hábil no corrió en MINUTOS_SIN_CORRER; su candado (GET_LOCK), otro que el de las Notas
// Digitales; y los atrasados (más de MINUTOS_A_TIEMPO desde su aviso), que salen solo de HORA_DE_LOS_ATRASADOS (inclusive) a
// HORA_DE_CIERRE_DE_LOS_ATRASADOS (exclusive) de un día hábil: un recordatorio atrasado no sale de noche ni de madrugada
export const VENTANA_DE_LA_CORRIDA = 15;
export const MINUTOS_SIN_CORRER = 60;
export const BLOQUEO_EVENTOS = 'rpad_mi_espacio_eventos';
export const MINUTOS_A_TIEMPO = 30;
export const HORA_DE_LOS_ATRASADOS = '07:00';
export const HORA_DE_CIERRE_DE_LOS_ATRASADOS = '20:00';

// Los mensajes de cada error, los mismos en el servidor y en la página. En el error, `campo` es el del pedido: tituloLargo
// va en `titulo` y personasInvalidas en `personas`. La fecha fuera del rango es textoRangoEvento
export const MENSAJES_EVENTO = Object.freeze({
  titulo: 'Escribí qué es el evento.',
  tituloLargo: 'El título puede tener hasta 150 caracteres.',
  desde: 'Elegí a qué hora empieza.',
  hasta: 'La hora de fin tiene que ser después de la de inicio, el mismo día.',
  detalle: 'El detalle puede tener hasta 1000 caracteres.',
  personas: 'Elegí con quién lo compartís, o «Todos».',
  personasInvalidas: 'Solo podés compartirlo con las personas de la lista.',
  recordatorio: 'Elegí cuándo te llega el recordatorio.',
  sinPermiso: 'No tenés permiso para compartir eventos.',
  noEncontrado: 'Evento no encontrado',
  miRecordatorio: 'Elegí si querés el recordatorio.',
  esTuyo: 'El recordatorio de tu evento se cambia en el evento.'
});

const MINUTOS_DEL_DIA = 1440;
// Una hora 'HH:MM' de 00:00 a 23:59 (sin los segundos: lo que llega de la base pasa por TIME_FORMAT(…, '%H:%i'))
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
// Un momento 'AAAA-MM-DD HH:MM', con los segundos o sin ellos
const MOMENTO = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const esHora = (valor) => typeof valor === 'string' && HORA.test(valor);
const esMomento = (valor) => typeof valor === 'string' && MOMENTO.test(valor) && esFechaIso(valor.slice(0, 10))
  && esHora(valor.slice(11, 16));
// Sin hora de fin: no vino, null o vacía
const SIN_HASTA = Object.freeze([undefined, null, '']);
const caracteres = (texto) => Array.from(texto).length;
const recortado = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const dosCifras = (numero) => String(numero).padStart(2, '0');
const minutosDe = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
const horaDe = (minutos) => `${dosCifras(Math.floor(minutos / 60))}:${dosCifras(minutos % 60)}`;
const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);
const esRecordatorio = (valor) => typeof valor === 'string' && RECORDATORIOS.includes(valor);
// 'martes 27/10/2026', de una fecha ya controlada
const diaConFecha = (fecha) => `${diaDeLaSemana(fecha)} ${formatoCorto(fecha)}`;

/**
 * La fecha más nueva de un evento: el mismo día dos años después de hoy. Un 29/02 da el 28/02 (dos años después de uno
 * bisiesto nunca lo es). null si hoy no es una fecha; después del año 9999, el 31/12/9999.
 */
export const fechaMaximaEvento = (hoy) => {
  if (!esFechaIso(hoy)) return null;
  const anio = Number(hoy.slice(0, 4)) + 2;
  if (anio > 9999) return '9999-12-31';
  const mesYDia = hoy.slice(5) === '02-29' ? '02-28' : hoy.slice(5);
  return `${String(anio).padStart(4, '0')}-${mesYDia}`;
};

// El error de una fecha fuera del rango: «La fecha tiene que ser del 01/01/2025 al 26/10/2028.» (`hasta`, el tope de
// fechaMaximaEvento; si no es una fecha, la raya)
export const textoRangoEvento = (hasta) => textoRango(FECHA_MINIMA_EVENTO, hasta);

const rechazo = (campo, mensaje) => ({ datos: null, error: { campo, mensaje } });

// Los ids de las personas con quienes se comparte, sin repetidos y en el orden recibido (idPositivo: un número o un texto
// de solo dígitos). null si alguno no es un id (no se descartan en silencio). Los vistos van en un Set: tiempo lineal
const idsDePersonas = (personas) => {
  const ids = [];
  const vistos = new Set();
  for (const valor of personas) {
    const id = idPositivo(valor);
    if (id === null) return null;
    if (!vistos.has(id)) {
      vistos.add(id);
      ids.push(id);
    }
  }
  return ids;
};

/**
 * Valida un evento, el cuerpo de un alta o de un cambio (el formulario entero), contra hoy ('AAAA-MM-DD'). Devuelve
 * `{ datos, error }`: `error` es null, o `{ campo, mensaje }` del primero que no sirve, y entonces `datos` es null; si no,
 * `datos` es `{ titulo, detalle, fecha, desde, hasta, compartido, para_todos, personas, recordatorio }`. Los controles, en
 * este orden:
 * 1. el título, recortado: vacío (o lo que no es un texto), `titulo`; de más de 150 caracteres, `tituloLargo`;
 * 2. la fecha: una que existe, del 01/01/2025 a fechaMaximaEvento(hoy), cualquier día (también un fin de semana o un
 *    feriado); si no, textoRangoEvento. Sin un hoy válido no pasa ninguna;
 * 3. desde: 'HH:MM' de 00:00 a 23:59 (ni '9:00' ni '10:00:00');
 * 4. hasta: sin ella ('', null o que no venga) es null; si viene, 'HH:MM' y después de desde (el evento termina el mismo
 *    día);
 * 5. el detalle: recortado, vacío (o lo que no es un texto) es null, de hasta 1000 caracteres;
 * 6. compartido y para_todos: solo el `true` literal, y para_todos solo con compartido. «Todos» es una marca, no una lista:
 *    con para_todos, personas es []. Compartido sin para_todos exige personas: sin una lista o vacía, `personas`; con
 *    algo que no es un id, `personasInvalidas` (los dos en `personas`); los ids sin repetidos. Sin compartir, [];
 * 7. el recordatorio: sin él (o null), '2h'; fuera de RECORDATORIOS, `recordatorio`.
 * Los caracteres se cuentan con Array.from. Una entrada que no es un objeto cuenta como `{}`. Quién puede compartir y que
 * las personas sean de la lista los controla la API (`sinPermiso` y `personasInvalidas`), con la base.
 */
export const validarEvento = (entrada, hoy) => {
  const fuente = esObjeto(entrada) ? entrada : {};

  const titulo = recortado(fuente.titulo);
  if (titulo === '') return rechazo('titulo', MENSAJES_EVENTO.titulo);
  if (caracteres(titulo) > LARGO_TITULO_EVENTO) return rechazo('titulo', MENSAJES_EVENTO.tituloLargo);

  const { fecha, desde } = fuente;
  const maxima = fechaMaximaEvento(hoy);
  if (!esFechaIso(fecha) || maxima === null || fecha < FECHA_MINIMA_EVENTO || fecha > maxima) {
    return rechazo('fecha', textoRangoEvento(maxima));
  }

  if (!esHora(desde)) return rechazo('desde', MENSAJES_EVENTO.desde);

  const hasta = SIN_HASTA.includes(fuente.hasta) ? null : fuente.hasta;
  if (hasta !== null && (!esHora(hasta) || hasta <= desde)) return rechazo('hasta', MENSAJES_EVENTO.hasta);

  const detalle = recortado(fuente.detalle);
  if (caracteres(detalle) > LARGO_DETALLE_EVENTO) return rechazo('detalle', MENSAJES_EVENTO.detalle);

  const compartido = fuente.compartido === true;
  const paraTodos = compartido && fuente.para_todos === true;
  let personas = [];
  if (compartido && !paraTodos) {
    if (!Array.isArray(fuente.personas) || fuente.personas.length === 0) {
      return rechazo('personas', MENSAJES_EVENTO.personas);
    }
    personas = idsDePersonas(fuente.personas);
    if (personas === null) return rechazo('personas', MENSAJES_EVENTO.personasInvalidas);
  }

  const recordatorio = fuente.recordatorio ?? RECORDATORIO_POR_DEFECTO;
  if (!esRecordatorio(recordatorio)) return rechazo('recordatorio', MENSAJES_EVENTO.recordatorio);

  return {
    datos: {
      titulo, detalle: detalle === '' ? null : detalle, fecha, desde, hasta, compartido, para_todos: paraTodos, personas,
      recordatorio
    },
    error: null
  };
};

/**
 * El momento en que sale el recordatorio de un evento, 'AAAA-MM-DD HH:MM', con los feriados (un Set de 'AAAA-MM-DD', el de
 * `feriadosDelRango`; otra cosa no saca ningún día). Nunca cae en un día que no es hábil (spec, sección 1):
 * - '1h' y '2h': la hora del evento menos la anticipación, en minutos; si da negativo, el día anterior (+ 1440);
 * - 'dia_anterior': el día hábil anterior al del evento (`restarDiasHabilesCon`), a la misma hora;
 * - si el día que queda no es hábil, el día hábil anterior a él, a la misma hora (el lunes a las 00:30 con «1 hora antes»
 *   da el domingo a las 23:30, que pasa al viernes a las 23:30).
 * null con 'ninguno', con un recordatorio que no es de la lista, con una fecha o una hora que no sirven, o si en los 366
 * días anteriores no hay un día hábil. Se calcula cada vez, nunca se guarda: un feriado cargado después mueve el aviso.
 */
export const momentoDelAviso = (evento, feriados) => {
  if (!esObjeto(evento)) return null;
  const { fecha, desde, recordatorio } = evento;
  if (!esFechaIso(fecha) || !esHora(desde) || typeof recordatorio !== 'string') return null;

  let dia;
  let minutos = minutosDe(desde);
  if (recordatorio === 'dia_anterior') {
    dia = restarDiasHabilesCon(fecha, 1, feriados);
  } else if (Object.hasOwn(ANTICIPACION, recordatorio)) {
    minutos -= ANTICIPACION[recordatorio];
    dia = fecha;
    if (minutos < 0) {
      minutos += MINUTOS_DEL_DIA;
      dia = sumarDias(fecha, -1);
    }
  } else {
    return null;
  }

  if (dia !== null && !esDiaHabilCon(dia, feriados)) dia = restarDiasHabilesCon(dia, 1, feriados);
  return dia === null ? null : `${dia} ${horaDe(minutos)}`;
};

// Un día y una hora contados desde hoy, en minúscula: 'hoy a las 08:00', 'mañana a las 08:00' o 'el viernes 30/10 a las
// 10:00' (fecha ya controlada; sin un hoy válido, siempre el día)
const cuandoDesdeHoy = (fecha, hora, hoy) => {
  if (esFechaIso(hoy)) {
    if (fecha === hoy) return `hoy a las ${hora}`;
    if (fecha === sumarDias(hoy, 1)) return `mañana a las ${hora}`;
  }
  return `el ${diaLargo(fecha)} a las ${hora}`;
};

/**
 * Cuándo sale el recordatorio, para el formulario y el detalle del evento (spec, sección 1), con el contexto
 * `{ ahora, feriados }` (`ahora`, 'AAAA-MM-DD HH:MM:SS' de `ahoraArgentina()`, o sin los segundos):
 * - «2 horas antes (hoy a las 08:00)», «… (mañana a las 08:00)» o «El día hábil anterior (el viernes 30/10 a las 10:00)»;
 *   justo a esa hora todavía lo dice así;
 * - pasada la hora del aviso, «2 horas antes (ya pasó esa hora: sale con el próximo envío, si es antes del evento)»;
 * - con el evento empezado, «2 horas antes (el evento ya empezó)»;
 * - 'ninguno', «Sin aviso».
 * Sin un `ahora` que sirva, o con una fecha o una hora que no sirven, el texto del recordatorio solo («2 horas antes»); con
 * un recordatorio que no es de la lista, ''.
 */
export const textoDelAviso = (evento, contexto) => {
  const { fecha, desde, recordatorio } = esObjeto(evento) ? evento : {};
  if (!esRecordatorio(recordatorio)) return '';
  const texto = TEXTO_RECORDATORIO[recordatorio];
  if (recordatorio === 'ninguno') return texto;

  const { ahora, feriados } = esObjeto(contexto) ? contexto : {};
  const momento = momentoDelAviso({ fecha, desde, recordatorio }, feriados);
  if (momento === null || !esMomento(ahora)) return texto;

  const ahoraCorto = ahora.slice(0, 16);
  if (ahoraCorto >= `${fecha} ${desde}`) return `${texto} (el evento ya empezó)`;
  if (momento < ahoraCorto) return `${texto} (ya pasó esa hora: sale con el próximo envío, si es antes del evento)`;
  return `${texto} (${cuandoDesdeHoy(momento.slice(0, 10), momento.slice(11, 16), ahoraCorto.slice(0, 10))})`;
};

// La fecha y la hora de un evento, si las dos sirven: `{ fecha, desde, hasta }` (hasta, null si no es una hora); si no, null
const horarioDe = (evento) => {
  if (!esObjeto(evento) || !esFechaIso(evento.fecha) || !esHora(evento.desde)) return null;
  return { fecha: evento.fecha, desde: evento.desde, hasta: esHora(evento.hasta) ? evento.hasta : null };
};

// Cuándo es un evento, con su fecha completa: «martes 27/10/2026 de 10:00 a 11:00», o «martes 27/10/2026 a las 10:00» sin
// hora de fin. Con una fecha o una hora que no sirven, la raya
export const cuandoDelEvento = (evento) => {
  const horario = horarioDe(evento);
  if (horario === null) return '—';
  const { fecha, desde, hasta } = horario;
  return hasta === null ? `${diaConFecha(fecha)} a las ${desde}` : `${diaConFecha(fecha)} de ${desde} a ${hasta}`;
};

// Cuándo empieza, con su fecha completa: «martes 27/10/2026 a las 10:00» (el de la cancelación). Si no sirve, la raya
export const cuandoCortoDelEvento = (evento) => {
  const horario = horarioDe(evento);
  return horario === null ? '—' : `${diaConFecha(horario.fecha)} a las ${horario.desde}`;
};

// Cuándo es, contado desde hoy (el recordatorio, con el día real del envío): «Hoy a las 10:00», «Mañana a las 10:00» o «El
// lunes 02/11 a las 10:00». Sin un hoy válido, el día; si el evento no sirve, la raya
export const cuandoEsElEvento = (evento, hoy) => {
  const horario = horarioDe(evento);
  return horario === null ? '—' : mayuscula(cuandoDesdeHoy(horario.fecha, horario.desde, hoy));
};

// Cuándo pasó un momento ('AAAA-MM-DD HH:MM', con los segundos o sin ellos), contado desde ahora: «hoy a las 10:30», «ayer
// a las 23:30» o «el 23/10/2026 a las 10:30». Sin un ahora válido, la fecha; si el momento no sirve, la raya
export const cuandoFue = (momento, ahora) => {
  if (!esMomento(momento)) return '—';
  const fecha = momento.slice(0, 10);
  const hora = momento.slice(11, 16);
  if (esMomento(ahora)) {
    const hoy = ahora.slice(0, 10);
    if (fecha === hoy) return `hoy a las ${hora}`;
    if (fecha === sumarDias(hoy, -1)) return `ayer a las ${hora}`;
  }
  return `el ${formatoCorto(fecha)} a las ${hora}`;
};

// El evento en una línea, con su título: «Reunión de equipo, martes 27/10/2026 de 10:00 a 11:00» (el de antes, en el email
// del cambio). Sin un título, solo cuándo
export const textoDelEvento = (evento) => {
  const titulo = esObjeto(evento) ? recortado(evento.titulo) : '';
  const cuando = cuandoDelEvento(evento);
  return titulo === '' ? cuando : `${titulo}, ${cuando}`;
};

// 'a', 'a y b' o 'a, b y c' (enLista de services/miEspacioReglas.js); lo que no es una lista, ''
export const listaConY = (nombres) => (Array.isArray(nombres) ? enLista(nombres) : '');

// Las iniciales de un nombre, para la lista de personas: la primera letra de la primera y de la última palabra, en
// mayúscula ('Persona de Prueba' da 'PP'; una palabra, una letra), como `iniciales` de public/js/mi-espacio.js. Lo que no
// es un texto, o un texto vacío, ''
export const inicialesDe = (nombre) => {
  const palabras = typeof nombre === 'string' ? nombre.trim().split(/\s+/).filter(Boolean) : [];
  if (palabras.length === 0) return '';
  const inicial = (palabra) => Array.from(palabra)[0].toUpperCase();
  return palabras.length === 1 ? inicial(palabras[0]) : inicial(palabras[0]) + inicial(palabras.at(-1));
};
