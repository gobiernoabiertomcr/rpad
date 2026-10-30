/**
 * La agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, secciones 1, 2, 5 y 7): las reglas de los eventos, puras (sin
 * pool ni Date local: las fechas son texto 'AAAA-MM-DD' y las horas 'HH:MM', y hoy y ahora llegan por parámetro,
 * `hoyArgentina()` y `ahoraArgentina()` en el servidor). Un momento es 'AAAA-MM-DD HH:MM' y se compara como texto (de
 * `ahoraArgentina()`, que trae los segundos, cuentan los 16 primeros caracteres). Ninguna función tira error: una entrada
 * rara da el error de su campo, null o un texto ('', o la raya donde iba una fecha).
 *
 * Acá están los valores y los textos de la agenda: los recordatorios, los largos, las fechas, quién comparte, los de la
 * corrida de los recordatorios (la ventana, el candado y los atrasados), los tres tipos de evento con lo que ven los demás de
 * un Personal (Público) (spec 2026-10-29-mi-espacio-evento-publico) y los mensajes. Después, la validación de un evento
 * (`validarEvento`), el momento en que sale su recordatorio, con los feriados (`momentoDelAviso`: nunca en un día que no es
 * hábil), los textos de cuándo es un evento y cuándo sale su aviso, y quién recibe qué: los recordatorios de una corrida
 * (`recordatoriosQueTocan`, con los atrasados; lo que dice la corrida, `textoDelResultadoDeEventos`, y la línea y las alertas
 * de la última en Correos → Estado: `textoDeLaCorridaDeEventos` y `alertasDeLaCorridaDeEventos`) y los emails de un guardado
 * (`emailsDelGuardado` y `cambioQueAvisa`). Al final, lo que dice la API: el pedido de cuándo sale un aviso
 * (`validarAvisoDelEvento`), las personas de un guardado (`personasDelPedido`), cuándo sale el aviso (`avisoDe`) y cada evento
 * como lo ve quien lo pide (`itemDeEvento`, que de un Público de otra persona da solo «Carla: Turno médico», y
 * `textoDeQuienVeElPublico`); lo demás de la agenda (tus licencias, los compañeros que no están y los feriados:
 * `itemDeLicencia`, `itemDeAusencia` e `itemsDeFeriados`), los compañeros de cada día y la frase del mes (`companerosPorDia`,
 * `mesDeLaFrase` y `fraseDelMes`) y los eventos de «Hoy y mañana» del Resumen (`eventosDeHoyYManana`). Los textos son planos:
 * escaparlos le toca a quien los dibuja.
 *
 * La usan la API de los eventos, sus emails, la corrida de los recordatorios y Correos → Estado. La página
 * (`public/js/mi-espacio.js`) tiene copias de los mensajes, los largos, las fechas y los recordatorios, atadas por tests de
 * paridad: si cambia uno acá, cambia allá. El navegador no recalcula días hábiles: cuándo sale el aviso lo dice el servidor.
 * En el código, la agenda es `evento` o `mi_espacio_`, nunca «agenda» a secas: la Agenda de pedidos de Reportes es otra cosa.
 */
import { esDiaHabilCon, restarDiasHabilesCon, diaDeLaSemana, diasHabilesDe, feriadosDelAnio } from './feriadosReglas.js';
import { esFechaIso, sumarDias, diasEntre, formatoCorto } from './notasDigitalesCalendario.js';
import { diaLargo } from './miEspacioResumen.js';
import {
  textoRango, enLista, NOMBRES_TIPO, numeroTexto, textoNoEsta, nombreCorto, nombreDelMes
} from './miEspacioReglas.js';
import { idPositivo, idsPositivos } from './proyectosReglas.js';
import { emailValido } from './usuariosReglas.js';

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

// Los tipos de evento (spec 2026-10-29-mi-espacio-evento-publico, 2 y 3), en el orden del formulario: Personal (Privado), que
// no ve nadie más (el «Solo yo» de antes); Personal (Público), que ven quienes elija quien lo carga, de cualquier rol, solo con
// su nombre y un texto corto («Carla: Turno médico»); y Laboral, el compartido con la administración (el «Compartido» de
// antes). Un Público se guarda como uno personal (compartido y para_todos en 0) con sus columnas propias (publico,
// publico_todos y texto_publico) y su audiencia en mi_espacio_evento_vistas: así ningún camino de los emails lo toca
export const TIPOS_DE_EVENTO = Object.freeze(['privado', 'publico', 'laboral']);
// Lo que ven los demás de un Público, de la lista del formulario (las cuatro del usuario y «Capacitación o curso»; «Otro» lo
// escribe quien lo carga), y su largo (varchar(60), en caracteres contados con Array.from)
export const TEXTOS_PUBLICOS = Object.freeze([
  'Trámite personal', 'Turno médico', 'Asunto familiar', 'Fuera de la oficina', 'Capacitación o curso'
]);
export const LARGO_TEXTO_PUBLICO = 60;

// Los mensajes de cada error, los mismos en el servidor y en la página. En el error, `campo` es el del pedido: tituloLargo
// va en `titulo`, textoPublico y textoPublicoLargo en `texto_publico`, y personasPublico (el de un Público sin personas, con
// el «Todos» de todos los usuarios) y personasInvalidas en `personas` (personas es el de un Laboral, con el «Toda la
// administración» de su botón). sinRecordatorio, sin campo: «mi recordatorio» de un Público de otra persona. La fecha fuera del
// rango es textoRangoEvento
export const MENSAJES_EVENTO = Object.freeze({
  titulo: 'Escribí qué es el evento.',
  tituloLargo: 'El título puede tener hasta 150 caracteres.',
  desde: 'Elegí a qué hora empieza.',
  hasta: 'La hora de fin tiene que ser después de la de inicio, el mismo día.',
  detalle: 'El detalle puede tener hasta 1000 caracteres.',
  tipo: 'Elegí el tipo de evento.',
  textoPublico: 'Elegí qué ven los demás.',
  textoPublicoLargo: 'Lo que ven los demás puede tener hasta 60 caracteres.',
  personas: 'Elegí con quién lo compartís, o «Toda la administración».',
  personasPublico: 'Elegí con quién lo compartís, o «Todos».',
  personasInvalidas: 'Solo podés compartirlo con las personas de la lista.',
  recordatorio: 'Elegí cuándo te llega el recordatorio.',
  sinPermiso: 'No tenés permiso para compartir eventos.',
  noEncontrado: 'Evento no encontrado',
  miRecordatorio: 'Elegí si querés el recordatorio.',
  esTuyo: 'El recordatorio de tu evento se cambia en el evento.',
  sinRecordatorio: 'Este evento no tiene recordatorio para vos.'
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

// Cuándo empieza (los pasos 2 y 3 de validarEvento): el rechazo de la fecha o de la hora de inicio, o null si las dos sirven
const rechazoDelInicio = ({ fecha, desde }, hoy) => {
  const maxima = fechaMaximaEvento(hoy);
  if (!esFechaIso(fecha) || maxima === null || fecha < FECHA_MINIMA_EVENTO || fecha > maxima) {
    return rechazo('fecha', textoRangoEvento(maxima));
  }
  return esHora(desde) ? null : rechazo('desde', MENSAJES_EVENTO.desde);
};

// El recordatorio pedido (el paso 9 de validarEvento): sin él (o null), el de entrada; fuera de RECORDATORIOS, null
const recordatorioPedido = (valor) => {
  const recordatorio = valor ?? RECORDATORIO_POR_DEFECTO;
  return esRecordatorio(recordatorio) ? recordatorio : null;
};

// El tipo pedido (el paso 6 de validarEvento): el de TIPOS_DE_EVENTO que dice el cuerpo. Sin él (o null: un cuerpo de antes,
// de una pestaña que quedó abierta con la página anterior), como antes: con `compartido` en el true literal, 'laboral', y si
// no, 'privado'. Cualquier otro valor, null
const tipoPedido = (fuente) => {
  if (fuente.tipo === undefined || fuente.tipo === null) return fuente.compartido === true ? 'laboral' : 'privado';
  return typeof fuente.tipo === 'string' && TIPOS_DE_EVENTO.includes(fuente.tipo) ? fuente.tipo : null;
};

// Las personas elegidas (el paso 8 de validarEvento): sin una lista o vacía, `{ error: ninguna }` (el mensaje del tipo); con
// algo que no es un id, personasInvalidas; si no, `{ personas }`, los ids sin repetidos (idsPositivos)
const personasElegidas = (valor, ninguna) => {
  if (!Array.isArray(valor) || valor.length === 0) return { error: ninguna };
  const personas = idsPositivos(valor);
  return personas === null ? { error: MENSAJES_EVENTO.personasInvalidas } : { personas };
};

/**
 * Valida un evento, el cuerpo de un alta o de un cambio (el formulario entero), contra hoy ('AAAA-MM-DD'). Devuelve
 * `{ datos, error }`: `error` es null, o `{ campo, mensaje }` del primero que no sirve, y entonces `datos` es null; si no,
 * `datos` es `{ titulo, detalle, fecha, desde, hasta, tipo, compartido, para_todos, publico, publico_todos, personas,
 * texto_publico, recordatorio }`. El cuerpo es `{ titulo, fecha, desde, hasta, detalle, recordatorio, tipo, para_todos,
 * personas, texto_publico }`: `para_todos` y `personas` son el «Todos» y las personas del tipo que corresponda (spec
 * 2026-10-29-mi-espacio-evento-publico, 6.5). Los controles, en este orden (el del formulario):
 * 1. el título, recortado: vacío (o lo que no es un texto), `titulo`; de más de 150 caracteres, `tituloLargo`;
 * 2. la fecha: una que existe, del 01/01/2025 a fechaMaximaEvento(hoy), cualquier día (también un fin de semana o un
 *    feriado); si no, textoRangoEvento. Sin un hoy válido no pasa ninguna;
 * 3. desde: 'HH:MM' de 00:00 a 23:59 (ni '9:00' ni '10:00:00');
 * 4. hasta: sin ella ('', null o que no venga) es null; si viene, 'HH:MM' y después de desde (el evento termina el mismo
 *    día);
 * 5. el detalle: recortado, vacío (o lo que no es un texto) es null, de hasta 1000 caracteres;
 * 6. el tipo, uno de TIPOS_DE_EVENTO; si no, `tipo`. Sin él (o null), el de un cuerpo de antes: Laboral con `compartido` en
 *    el true literal y si no Personal (Privado), y así una pestaña abierta con la página anterior guarda como hasta ahora;
 * 7. el texto público, solo en un Público: recortado, vacío (o lo que no es un texto), `textoPublico`; de más de 60
 *    caracteres, `textoPublicoLargo` (los dos en `texto_publico`). En los otros tipos es null, venga lo que venga;
 * 8. las personas, en un Público o un Laboral: `para_todos`, solo el `true` literal, es «Todos» (una marca, no una lista:
 *    con él, personas es []); sin «Todos», sin una lista o vacía, `personasPublico` en un Público y `personas` en un
 *    Laboral; con algo que no es un id, `personasInvalidas` (todos en `personas`); los ids sin repetidos. En un Privado, [];
 * 9. el recordatorio: sin él (o null), '2h'; fuera de RECORDATORIOS, `recordatorio`.
 * Lo que se guarda de cada tipo: un Laboral, `compartido` en true y `para_todos` con su «Todos» (`publico` y
 * `publico_todos` en false, `texto_publico` null); un Público, `compartido` y `para_todos` en false (se guarda como uno
 * personal: ningún camino de los emails lo toca), `publico` en true, `publico_todos` con su «Todos» y el texto; un Privado,
 * todo lo de compartir en false, [] y null. Los caracteres se cuentan con Array.from. Una entrada que no es un objeto
 * cuenta como `{}`. Quién puede compartir un Laboral y que las personas sean de la lista los controla la API (`sinPermiso`
 * y `personasInvalidas`), con la base.
 */
export const validarEvento = (entrada, hoy) => {
  const fuente = esObjeto(entrada) ? entrada : {};

  const titulo = recortado(fuente.titulo);
  if (titulo === '') return rechazo('titulo', MENSAJES_EVENTO.titulo);
  if (caracteres(titulo) > LARGO_TITULO_EVENTO) return rechazo('titulo', MENSAJES_EVENTO.tituloLargo);

  const { fecha, desde } = fuente;
  const delInicio = rechazoDelInicio(fuente, hoy);
  if (delInicio !== null) return delInicio;

  const hasta = SIN_HASTA.includes(fuente.hasta) ? null : fuente.hasta;
  if (hasta !== null && (!esHora(hasta) || hasta <= desde)) return rechazo('hasta', MENSAJES_EVENTO.hasta);

  const detalle = recortado(fuente.detalle);
  if (caracteres(detalle) > LARGO_DETALLE_EVENTO) return rechazo('detalle', MENSAJES_EVENTO.detalle);

  const tipo = tipoPedido(fuente);
  if (tipo === null) return rechazo('tipo', MENSAJES_EVENTO.tipo);
  const publico = tipo === 'publico';
  const laboral = tipo === 'laboral';

  let textoPublico = null;
  if (publico) {
    textoPublico = recortado(fuente.texto_publico);
    if (textoPublico === '') return rechazo('texto_publico', MENSAJES_EVENTO.textoPublico);
    if (caracteres(textoPublico) > LARGO_TEXTO_PUBLICO) return rechazo('texto_publico', MENSAJES_EVENTO.textoPublicoLargo);
  }

  const todos = (publico || laboral) && fuente.para_todos === true;
  let personas = [];
  if ((publico || laboral) && !todos) {
    const elegidas = personasElegidas(fuente.personas, publico ? MENSAJES_EVENTO.personasPublico : MENSAJES_EVENTO.personas);
    if (elegidas.error) return rechazo('personas', elegidas.error);
    personas = elegidas.personas;
  }

  const recordatorio = recordatorioPedido(fuente.recordatorio);
  if (recordatorio === null) return rechazo('recordatorio', MENSAJES_EVENTO.recordatorio);

  return {
    datos: {
      titulo, detalle: detalle === '' ? null : detalle, fecha, desde, hasta, tipo, compartido: laboral,
      para_todos: laboral && todos, publico, publico_todos: publico && todos, personas, texto_publico: textoPublico,
      recordatorio
    },
    error: null
  };
};

/**
 * Valida el pedido de cuándo saldría el recordatorio (`GET /api/mi-espacio/eventos/aviso`, el texto del formulario): solo la
 * fecha, la hora de inicio y el recordatorio, con los controles y los mensajes de validarEvento, en su orden (la fecha, la
 * hora y el recordatorio; sin él, o null, '2h'). Devuelve `{ datos: { fecha, desde, recordatorio }, error }`, como
 * validarEvento. Una entrada que no es un objeto cuenta como `{}`.
 */
export const validarAvisoDelEvento = (entrada, hoy) => {
  const fuente = esObjeto(entrada) ? entrada : {};
  const delInicio = rechazoDelInicio(fuente, hoy);
  if (delInicio !== null) return delInicio;
  const recordatorio = recordatorioPedido(fuente.recordatorio);
  if (recordatorio === null) return rechazo('recordatorio', MENSAJES_EVENTO.recordatorio);
  return { datos: { fecha: fuente.fecha, desde: fuente.desde, recordatorio }, error: null };
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

// Quién recibe qué (spec, secciones 4 y 5): los recordatorios de una corrida y los emails de un guardado

const listaDe = (valor) => (Array.isArray(valor) ? valor : []);
// Un tinyint de la base (con Number()) o un booleano: sí es 1, '1' o true; no, 0, '0' o false. Otro valor no es ni sí ni no
const esSi = (valor) => valor === true || valor === 1 || valor === '1';
const esNo = (valor) => valor === false || valor === 0 || valor === '0';

// El momento en que empieza un evento, 'AAAA-MM-DD HH:MM' (el `para` de sus envíos), si la fecha y la hora sirven; si no,
// null. Como todo momento, se compara como texto con los 16 primeros caracteres de ahora
const inicioDe = (evento) => {
  const horario = horarioDe(evento);
  return horario === null ? null : `${horario.fecha} ${horario.desde}`;
};

// Los minutos de un momento 'AAAA-MM-DD HH:MM' a otro, contando los días que cruzan (diasEntre, sobre las fechas de texto:
// nunca un Date local)
const minutosEntre = (desde, hasta) => diasEntre(desde.slice(0, 10), hasta.slice(0, 10)) * MINUTOS_DEL_DIA
  + minutosDe(hasta.slice(11, 16)) - minutosDe(desde.slice(11, 16));

// Si el recordatorio sale ahora (los tres, 'AAAA-MM-DD HH:MM'; `aviso`, el de momentoDelAviso, o null): el aviso ya llegó y
// el evento todavía no empezó. Hasta MINUTOS_A_TIEMPO después del aviso (30 justos, también), a tiempo, a cualquier hora; uno
// atrasado, solo de HORA_DE_LOS_ATRASADOS (inclusive) a HORA_DE_CIERRE_DE_LOS_ATRASADOS (exclusive). Que el día sea hábil lo
// mira recordatoriosQueTocan
const avisoQueSale = (aviso, inicio, ahoraCorto) => {
  if (aviso === null || aviso > ahoraCorto || ahoraCorto >= inicio) return false;
  if (minutosEntre(aviso, ahoraCorto) <= MINUTOS_A_TIEMPO) return true;
  const hora = ahoraCorto.slice(11, 16);
  return hora >= HORA_DE_LOS_ATRASADOS && hora < HORA_DE_CIERRE_DE_LOS_ATRASADOS;
};

/**
 * Los recordatorios que salen en una corrida (spec, sección 5), con el contexto `{ ahora, feriados }` (`ahora`,
 * 'AAAA-MM-DD HH:MM:SS' de `ahoraArgentina()`, o sin los segundos; `feriados`, el Set de `feriadosDelRango`). Cada evento es
 * `{ id, fecha, desde, recordatorio, destinatarios, envios }`, el de `eventosParaLaCorrida`:
 * - `destinatarios`: `[{ usuario_id, email, sin_recordatorio }]`, quien lo creó y su audiencia;
 * - `envios`: sus recordatorios, `[{ usuario_id, para, success, terminado }]` (`para`, 'AAAA-MM-DD HH:MM'; `terminado`, que
 *   `enviado_at` no es NULL). Uno con un `tipo` que no es 'recordatorio' no cuenta: una invitación tiene el mismo `para`.
 * Devuelve `[{ evento_id, usuario_id, email, para, reintento }]`, por evento y por persona, con `para` = 'fecha desde', el
 * inicio del evento (si cambia de hora, el recordatorio vuelve a salir). A una persona le toca si:
 * 1. hoy es hábil (`esDiaHabilCon`, con los feriados): en un día que no es hábil no sale ninguno;
 * 2. el aviso (`momentoDelAviso`) ya llegó y el evento todavía no empezó: aviso <= ahora < inicio;
 * 3. si pasaron más de MINUTOS_A_TIEMPO desde el aviso (un atrasado), ahora es de las 07:00 (inclusive) a las 20:00
 *    (exclusive): fuera de esa franja espera a las 07:00 del día hábil siguiente (o de hoy, si todavía no son las 07:00),
 *    siempre antes del inicio. Uno a tiempo sale a su hora, aunque sea antes de las 07:00 («2 horas antes» de un evento a las
 *    08:00, a las 06:00). Los minutos cruzan días: un aviso del viernes, el lunes está atrasado;
 * 4. no lo apagó (`sin_recordatorio` 1 o true) y su email pasa `emailValido` (nunca un envío sin destinatario);
 * 5. no tiene un envío con ese `para`, o el que tiene falló y terminó (`success` 0 o false y `terminado`): `reintento: true`.
 *    Uno que salió, o una reserva sin terminar (pudo haber salido), no se repite; un `success` raro tampoco.
 * Una persona repetida en un evento cuenta una vez. Nada tira: lo que no sirve no toca (sin una lista o un ahora, []).
 */
export const recordatoriosQueTocan = (eventos, contexto) => {
  const { ahora, feriados } = esObjeto(contexto) ? contexto : {};
  if (!Array.isArray(eventos) || !esMomento(ahora)) return [];
  const ahoraCorto = ahora.slice(0, 16);
  if (!esDiaHabilCon(ahoraCorto.slice(0, 10), feriados)) return [];

  const tocan = [];
  for (const evento of eventos) {
    const eventoId = esObjeto(evento) ? idPositivo(evento.id) : null;
    const para = inicioDe(evento);
    if (eventoId === null || para === null || !avisoQueSale(momentoDelAviso(evento, feriados), para, ahoraCorto)) continue;

    const envios = listaDe(evento.envios).filter((envio) => esObjeto(envio) && envio.para === para
      && (envio.tipo ?? 'recordatorio') === 'recordatorio');
    const vistos = new Set();
    for (const destinatario of listaDe(evento.destinatarios)) {
      const usuarioId = esObjeto(destinatario) ? idPositivo(destinatario.usuario_id) : null;
      if (usuarioId === null || vistos.has(usuarioId)) continue;
      vistos.add(usuarioId);
      if (esSi(destinatario.sin_recordatorio) || !emailValido(destinatario.email)) continue;

      const previos = envios.filter((envio) => idPositivo(envio.usuario_id) === usuarioId);
      const reintento = previos.length > 0;
      if (reintento && !previos.every((envio) => esNo(envio.success) && esSi(envio.terminado))) continue;
      tocan.push({ evento_id: eventoId, usuario_id: usuarioId, email: destinatario.email, para, reintento });
    }
  }
  return tocan.sort((a, b) => a.evento_id - b.evento_id || a.usuario_id - b.usuario_id);
};

// El largo de mi_espacio_eventos_corridas.resultado (varchar(1000): caracteres, contados con Array.from)
const LARGO_DEL_RESULTADO = 1000;
// Una cantidad de la corrida: un entero de 0 en adelante; lo demás, 0
const cantidadDe = (valor) => (Number.isInteger(valor) && valor > 0 ? valor : 0);

// Un error de la corrida en una línea: 'evento 12, persona 4: <error>' (sin evento ni persona, solo el error; sin un error
// que sea un texto, 'sin detalle')
const textoDelError = ({ evento_id: eventoId, usuario_id: usuarioId, error }) => {
  const quien = [
    idPositivo(eventoId) === null ? null : `evento ${idPositivo(eventoId)}`,
    idPositivo(usuarioId) === null ? null : `persona ${idPositivo(usuarioId)}`
  ].filter(Boolean).join(', ');
  const mensaje = typeof error === 'string' && error.trim() !== '' ? error.trim() : 'sin detalle';
  return quien === '' ? mensaje : `${quien}: ${mensaje}`;
};

/**
 * Lo que dice una corrida de los recordatorios (spec, sección 5), de lo que devuelve `ejecutarRecordatoriosDeEventos`
 * (`{ dia_habil, enviados, fallidos, errores: [{ evento_id, usuario_id, error }] }`): lo que se anota como su resultado en
 * mi_espacio_eventos_corridas (Correos → Estado) y el mensaje de la respuesta del cron.
 * - un día que no es hábil (`dia_habil` false): «Día no hábil: no se mandan recordatorios.»;
 * - si no (también sin saber si era hábil: la corrida falló antes de leer los feriados): «Recordatorios enviados: 2.» y, si
 *   hubo, « Fallidos: 1.» (emails que no salieron: se reintentan en la corrida siguiente);
 * - con errores, « Errores: evento 12, persona 4: <error>; <error>» (uno de toda la corrida, sin evento ni persona).
 * Cortado a 1000 caracteres (Array.from). Nada tira: lo que no es un resultado cuenta como sin nada, una cantidad rara como 0
 * y un error que no es un objeto no cuenta.
 */
export const textoDelResultadoDeEventos = (resultado) => {
  const { dia_habil: diaHabil, enviados, fallidos, errores } = esObjeto(resultado) ? resultado : {};
  let texto = 'Día no hábil: no se mandan recordatorios.';
  if (diaHabil !== false) {
    texto = `Recordatorios enviados: ${cantidadDe(enviados)}.`;
    if (cantidadDe(fallidos) > 0) texto += ` Fallidos: ${cantidadDe(fallidos)}.`;
  }
  const lineas = listaDe(errores).filter(esObjeto).map(textoDelError);
  if (lineas.length > 0) texto += ` Errores: ${lineas.join('; ')}`;
  return Array.from(texto).slice(0, LARGO_DEL_RESULTADO).join('');
};

// Correos → Estado (spec, sección 5): la línea de la última corrida de los recordatorios y sus alertas. La corrida es la de
// leerCorridaDeEventos (services/miEspacioEventosCorrida.js): `{ inicio, fin, resultado, con_errores, en_curso }`, con los
// momentos 'AAAA-MM-DD HH:MM'. Todo se cuenta desde su inicio, el momento en que la llamó la Tarea Cron

const REVISA_LA_TAREA_CRON = 'revisá la Tarea Cron de /api/cron/eventos.';

// La corrida, si tiene un inicio que sirve; si no, null (como si nunca hubiera corrido)
const corridaLeida = (corrida) => (esObjeto(corrida) && esMomento(corrida.inicio) ? corrida : null);
// Un texto que dice algo, sin los espacios de los extremos; si no, null
const textoQueDice = (valor) => (typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null);

/**
 * La línea de los recordatorios en Correos → Estado, contada desde ahora ('AAAA-MM-DD HH:MM', con los segundos o sin ellos):
 * - sin corrida: «Recordatorios de la agenda: sin registro todavía.»;
 * - en curso: «Recordatorios de la agenda: corrida en curso, desde hoy a las 10:30.»;
 * - si no: «Recordatorios de la agenda: última corrida hoy a las 10:30.» («ayer a las …», «el 23/10/2026 a las …»: cuandoFue)
 *   y, si lo tiene, lo que dijo (textoDelResultadoDeEventos): «… 10:30. Recordatorios enviados: 2.». Una que no terminó no
 *   tiene resultado: la alerta eventos-interrumpida dice lo demás.
 * Nada tira: una corrida sin un inicio que sirva es «sin registro»; sin un ahora válido, la fecha.
 */
export const textoDeLaCorridaDeEventos = (corrida, ahora) => {
  const leida = corridaLeida(corrida);
  if (leida === null) return 'Recordatorios de la agenda: sin registro todavía.';
  const cuando = cuandoFue(leida.inicio, ahora);
  if (esSi(leida.en_curso)) return `Recordatorios de la agenda: corrida en curso, desde ${cuando}.`;
  const linea = `Recordatorios de la agenda: última corrida ${cuando}.`;
  const resultado = textoQueDice(leida.resultado);
  return resultado === null ? linea : `${linea} ${resultado}`;
};

/**
 * Las alertas de la corrida de los recordatorios para Correos → Estado, con el contexto `{ ahora, feriados }` (`ahora`,
 * 'AAAA-MM-DD HH:MM:SS' de `ahoraArgentina()`, o sin los segundos; `feriados`, el Set de `feriadosEntre` que incluya hoy).
 * Devuelve `[{ tipo, nivel, mensaje }]`, todas `error`, en este orden:
 * 1. `eventos-con-errores`, si terminó con errores (fallidos o errores): «La última corrida de los recordatorios de la agenda
 *    (hoy a las 10:30) terminó con errores: <resultado>», cualquier día;
 * 2. `eventos-interrumpida`, si no terminó y no está en curso: «La corrida de los recordatorios de la agenda que empezó hoy a
 *    las 10:30 no terminó.», cualquier día;
 * 3. `eventos-sin-corrida`, solo en un día hábil (`esDiaHabilCon`, con los feriados), si no hay ninguna corrida («No hay
 *    registro de ninguna corrida …») o si pasaron más de MINUTOS_SIN_CORRER desde el inicio de la última («Los recordatorios de
 *    la agenda no corren desde hoy a las 08:30: …»; 60 justos, todavía no). Es la manera de notar que la Tarea Cron no quedó
 *    configurada: la corrida se anota todos los días, también los que no son hábiles. Una corrida en curso desde hace más de
 *    una hora también cuenta (las que siguen terminan «ocupadas», sin anotar nada).
 * Nada tira: sin un ahora válido no se sabe si hoy es hábil y no va la tercera; unos feriados que no son un Set no sacan días.
 */
export const alertasDeLaCorridaDeEventos = (corrida, contexto) => {
  const { ahora, feriados } = esObjeto(contexto) ? contexto : {};
  const leida = corridaLeida(corrida);
  const alertas = [];
  if (leida !== null) {
    const cuando = cuandoFue(leida.inicio, ahora);
    if (esSi(leida.con_errores)) {
      alertas.push({
        tipo: 'eventos-con-errores', nivel: 'error',
        mensaje: `La última corrida de los recordatorios de la agenda (${cuando}) terminó con errores: `
          + (textoQueDice(leida.resultado) ?? 'sin detalle')
      });
    }
    if (!esMomento(leida.fin) && !esSi(leida.en_curso)) {
      alertas.push({
        tipo: 'eventos-interrumpida', nivel: 'error',
        mensaje: `La corrida de los recordatorios de la agenda que empezó ${cuando} no terminó.`
      });
    }
  }
  if (esMomento(ahora) && esDiaHabilCon(ahora.slice(0, 10), feriados)) {
    if (leida === null) {
      alertas.push({
        tipo: 'eventos-sin-corrida', nivel: 'error',
        mensaje: `No hay registro de ninguna corrida de los recordatorios de la agenda: ${REVISA_LA_TAREA_CRON}`
      });
    } else if (minutosEntre(leida.inicio, ahora) > MINUTOS_SIN_CORRER) {
      alertas.push({
        tipo: 'eventos-sin-corrida', nivel: 'error',
        mensaje: `Los recordatorios de la agenda no corren desde ${cuandoFue(leida.inicio, ahora)}: ${REVISA_LA_TAREA_CRON}`
      });
    }
  }
  return alertas;
};

// La advertencia de Correos → Estado cuando no se pudo leer la última corrida (la base falló): una nueva en cada llamada
export const alertaSinEstadoDeEventos = () => ({
  tipo: 'eventos-sin-estado', nivel: 'advertencia', mensaje: 'No se pudo leer la última corrida de los recordatorios de la agenda.'
});

/**
 * Si un cambio les avisa a los que siguen en el evento (spec, sección 4): cambió el título, la fecha, la hora de inicio o la
 * de fin (sin hora de fin —'', null o que no venga— es lo mismo). Si cambió solo el detalle, el recordatorio o las personas,
 * no. Si alguno no es un objeto, false.
 */
export const cambioQueAvisa = (antes, despues) => {
  if (!esObjeto(antes) || !esObjeto(despues)) return false;
  const hastaDe = (evento) => (SIN_HASTA.includes(evento.hasta) ? null : evento.hasta);
  return ['titulo', 'fecha', 'desde'].some((campo) => antes[campo] !== despues[campo]) || hastaDe(antes) !== hastaDe(despues);
};

// Los ids de una audiencia: una lista de ids o de personas con su `id` (las de audienciaDe), sin repetidos y de menor a
// mayor. Lo que no es un id no cuenta; lo que no es una lista es nadie
const idsDeLaAudiencia = (audiencia) => {
  const ids = listaDe(audiencia).map((persona) => idPositivo(esObjeto(persona) ? persona.id : persona));
  return [...new Set(ids.filter((id) => id !== null))].sort((a, b) => a - b);
};

const sinEmails = () => ({ invitacion: [], cambio: [], cancelacion: [] });

/**
 * Quién recibe qué email cuando quien creó un evento lo guarda (spec, sección 4): `{ invitacion, cambio, cancelacion }`,
 * cada uno una lista de ids de menor a mayor. Recibe `{ antes, despues, audienciaAntes, audienciaDespues, ahora }`: el
 * evento antes y después de guardar (`antes` null en un alta, `despues` null en una baja), su audiencia antes y después (una
 * lista de ids o de personas con su `id`, las de `audienciaDe`) y `ahora` ('AAAA-MM-DD HH:MM:SS' de `ahoraArgentina()`, o
 * sin los segundos):
 * - el alta invita a la audiencia;
 * - la baja le avisa a la audiencia que se canceló;
 * - un cambio invita a los que entran y, solo si cambió el título, la fecha o la hora (`cambioQueAvisa`), les avisa a los
 *   que siguen. A los que salen, también si pasa a «Solo yo», no les llega nada (decisión del usuario, Pregunta 1:
 *   «Estamos todos en el mismo espacio físico.»).
 * Si el evento ya empezó (el de después; en una baja, el de antes), nadie recibe nada. Quien lo creó (`creado_por`) nunca
 * está. Salen también en un día que no es hábil: responden a lo que hizo una persona. Nada tira: sin un ahora, o con un
 * evento sin una fecha o una hora que sirvan, nadie (no se sabe si empezó).
 */
export const emailsDelGuardado = (entrada) => {
  const { antes, despues, audienciaAntes, audienciaDespues, ahora } = esObjeto(entrada) ? entrada : {};
  const anterior = esObjeto(antes) ? antes : null;
  const nuevo = esObjeto(despues) ? despues : null;
  const evento = nuevo ?? anterior;
  const inicio = inicioDe(evento);
  if (inicio === null || !esMomento(ahora) || ahora.slice(0, 16) >= inicio) return sinEmails();

  const creador = idPositivo(evento.creado_por);
  const sinCreador = (audiencia) => idsDeLaAudiencia(audiencia).filter((id) => id !== creador);
  const estaban = anterior === null ? [] : sinCreador(audienciaAntes);
  const estan = nuevo === null ? [] : sinCreador(audienciaDespues);
  if (anterior === null) return { invitacion: estan, cambio: [], cancelacion: [] };
  if (nuevo === null) return { invitacion: [], cambio: [], cancelacion: estaban };

  const yaEstaban = new Set(estaban);
  return {
    invitacion: estan.filter((id) => !yaEstaban.has(id)),
    cambio: cambioQueAvisa(anterior, nuevo) ? estan.filter((id) => yaEstaban.has(id)) : [],
    cancelacion: []
  };
};

// Lo que dice la API de los eventos (spec, secciones 2 y 7): las personas de un guardado, cuándo sale un aviso y cada evento
// como lo ve quien lo pide

/**
 * Las personas de un Laboral o un Personal (Público) sin «Todos», al guardarlo (las de `validarEvento`, ya ids sin
 * repetidos), contra las que se pueden elegir (`permitidas`: una lista o un Set de ids; en un Laboral, las de
 * `personasParaCompartir`, la administración, y en un Público, todos los usuarios activos, más las que ya estaban en el
 * evento). `tipo`, 'laboral' (el de entrada) o 'publico': dice el mensaje de «ninguna». Devuelve `{ personas, error }`: el id
 * de quien lo guarda (`usuarioId`) se saca sin error; si no queda ninguna (también sin una lista), el error `personas` en un
 * Laboral (o con otro tipo) y `personasPublico` en un Público; si alguna no es un id o no está entre las permitidas,
 * `personasInvalidas` (todos en `personas`). Si no, `personas` son las que quedan, en su orden, y `error` es null.
 */
export const personasDelPedido = (pedidas, { usuarioId, permitidas, tipo = 'laboral' } = {}) => {
  const yo = idPositivo(usuarioId);
  const ids = listaDe(pedidas).map(idPositivo);
  const sinMi = [...new Set(ids)].filter((id) => id !== yo);
  const invalidas = { personas: null, error: { campo: 'personas', mensaje: MENSAJES_EVENTO.personasInvalidas } };
  if (ids.includes(null)) return invalidas;
  if (sinMi.length === 0) {
    const ninguna = tipo === 'publico' ? MENSAJES_EVENTO.personasPublico : MENSAJES_EVENTO.personas;
    return { personas: null, error: { campo: 'personas', mensaje: ninguna } };
  }
  const validas = permitidas instanceof Set ? permitidas : new Set(listaDe(permitidas).map(idPositivo));
  return sinMi.every((id) => validas.has(id)) ? { personas: sinMi, error: null } : invalidas;
};

/**
 * Cuándo sale el recordatorio de un evento (`{ fecha, desde, recordatorio }`), con el contexto `{ ahora, feriados }` de
 * textoDelAviso: `{ momento, texto, corto }` (`momento`, el de momentoDelAviso, o null; `texto`, el de textoDelAviso; `corto`,
 * el de AVISO_CORTO). Con un recordatorio que no es de la lista, momento null y los textos vacíos.
 */
export const avisoDe = (evento, contexto) => {
  const { fecha, desde, recordatorio } = esObjeto(evento) ? evento : {};
  const { feriados } = esObjeto(contexto) ? contexto : {};
  return {
    momento: momentoDelAviso({ fecha, desde, recordatorio }, feriados),
    texto: textoDelAviso({ fecha, desde, recordatorio }, contexto),
    corto: esRecordatorio(recordatorio) ? AVISO_CORTO[recordatorio] : ''
  };
};

// «Con Carla» (una sola persona, con su nombre corto; sin nombre, «Con 1 persona»), «Con 4 personas»
const conPersonas = (nombres) => (nombres.length === 1 && nombres[0] !== ''
  ? `Con ${nombres[0]}`
  : `Con ${nombres.length} ${nombres.length === 1 ? 'persona' : 'personas'}`);
// Una oración con su punto al final: si termina en una inicial («Carla R.»), ese punto ya la cierra
const conPunto = (texto) => (texto.endsWith('.') ? texto : `${texto}.`);
// Las personas de un evento (sus filas, o las `vistas` de un Público) que tienen un id que sirve
const conId = (lista) => listaDe(lista).filter((persona) => esObjeto(persona) && idPositivo(persona.id) !== null);
// Lo que ven los demás de un Público, o null si no es un texto con algo (los datos siempre lo traen: es obligatorio)
const textoPublicoDe = (valor) => (typeof valor === 'string' && valor.trim() !== '' ? valor : null);

/**
 * Quién ve un Personal (Público) de quien lo creó (spec 2026-10-29-mi-espacio-evento-publico, 5.1), del `Evento` de los datos
 * (`publico_todos`, `texto_publico` y `vistas`, `[{ id, nombre }]`), con los nombres cortos de las vistas contra `usuarios`
 * (todos los usuarios activos, de cualquier rol: `nombreCorto`; sin la lista, el primer nombre): «Lo ven todos como «Turno
 * médico»» (con `publico_todos`: las vistas que hubiera no cuentan), «Lo ve Julián como «…»», «Lo ven Julián y Tomás como
 * «…»» y, desde 3, «Lo ven 3 personas como «…»». Con 1 o 2 y alguna sin nombre, la cantidad («Lo ve 1 persona como «…»»); sin
 * texto, la raya. Sin nadie (los datos no lo dan: un Público tiene «Todos» o alguna persona), «Solo vos», que es lo cierto.
 * Texto plano; nada tira.
 */
export const textoDeQuienVeElPublico = (evento, usuarios) => {
  const fuente = esObjeto(evento) ? evento : {};
  const como = `como «${textoPublicoDe(fuente.texto_publico) ?? '—'}»`;
  if (esSi(fuente.publico_todos)) return `Lo ven todos ${como}`;
  const nombres = conId(fuente.vistas).map((persona) => nombreCorto({ id: persona.id, nombre: persona.nombre }, usuarios));
  if (nombres.length === 0) return 'Solo vos';
  const verbo = nombres.length === 1 ? 'Lo ve' : 'Lo ven';
  if (nombres.length <= 2 && nombres.every((nombre) => nombre !== '')) return `${verbo} ${listaConY(nombres)} ${como}`;
  return `${verbo} ${nombres.length} ${nombres.length === 1 ? 'persona' : 'personas'} ${como}`;
};

// Un Personal (Público) de otra persona (spec 2026-10-29-mi-espacio-evento-publico, 6.3): solo cuándo es, quién lo cargó (su
// nombre corto contra todos los usuarios activos) y lo que eligió mostrar, con «Carla: Turno médico» como título. No lee el
// título, el detalle, el recordatorio ni con quién más está: no tienen que salir del servidor (los datos ya se los sacan)
const itemDelPublicoAjeno = (fuente, usuarios) => {
  const creador = nombreCorto({ id: fuente.creado_por, nombre: fuente.creador }, usuarios) || null;
  const textoPublico = textoPublicoDe(fuente.texto_publico);
  return {
    id: idPositivo(fuente.id),
    fecha: fuente.fecha ?? null,
    desde: fuente.desde ?? null,
    hasta: fuente.hasta ?? null,
    es_mio: false,
    compartido: false,
    publico: true,
    creador,
    titulo: `${creador ?? '—'}: ${textoPublico ?? '—'}`,
    texto_publico: textoPublico
  };
};

/**
 * Un evento como lo ve quien lo pide (`GET /api/mi-espacio/eventos`), del `Evento` de services/miEspacioEventosDatos.js, con
 * el contexto `{ usuarioId, ahora, feriados, administracion, usuarios }` (`ahora`, el de `ahoraArgentina()`; `feriados`, el
 * Set de `feriadosEntre`; `administracion`, la administración activa de `administracionActiva`, services/miEspacioDatos.js,
 * contra la que se arma el nombre corto en un Privado o un Laboral, y `usuarios`, todos los usuarios activos, `{ id, nombre }`,
 * contra los que se arma el de un Personal (Público), que puede crear y ver cualquier rol: sin ellas, el primer nombre de cada
 * uno). Hay dos formas (spec 2026-10-29-mi-espacio-evento-publico, 6.3):
 * - un Personal (Público) de otra persona (`publico`, y no lo creó quien lo pide; sin quien pide, nunca es suyo): solo
 *   `{ id, fecha, desde, hasta, es_mio, compartido, publico, creador, titulo, texto_publico }`, con `es_mio` y `compartido`
 *   en false, `publico` en true, `creador` el nombre corto de quien lo cargó (o null sin un nombre) y `titulo` «Carla: Turno
 *   médico» (sin nombre o sin texto, la raya en su lugar). Se arma sin leer el título, el detalle, el recordatorio ni con
 *   quién más está: no salen del servidor hacia otra persona;
 * - todos los demás: `{ id, titulo, detalle, fecha, desde, hasta, es_mio, compartido, para_todos, publico, creador,
 *   personas, personas_ids, recordatorio, recordatorio_texto, mi_recordatorio, aviso, quien_texto, quien_largo }`, y un
 *   Público (de quien lo pide) suma `publico_todos` y `texto_publico` después de `publico`. Ahí:
 *   - `es_mio`: lo creó quien lo pide; `publico`: es un Personal (Público). Un Público nunca es compartido (con los datos
 *     mal, publico y compartido a la vez, manda el Público: `compartido` y `para_todos` en false);
 *   - `creador`: el nombre corto de quien lo creó, como lo ven los compañeros (`nombreCorto`: «Julián», o «Carla B.» si hay
 *     otra Carla; spec 2026-10-28-mi-espacio-agenda-onda, 5.1), o null sin un nombre;
 *   - `personas`: los nombres completos de las elegidas (el formulario los muestra al lado de los de la lista para
 *     compartir: spec, decisión 9.13), en el orden de los datos (por nombre): las de un Laboral sin «Todos» o las `vistas` de
 *     un Público sin «Todos»; con «Todos» o en un Privado, [] (en un Laboral con «Todos», las filas son solo las de quienes
 *     apagaron su recordatorio). `personas_ids`, sus ids, solo si es suyo (el formulario);
 *   - `recordatorio` y `recordatorio_texto`: los del evento, los que eligió quien lo creó; `mi_recordatorio`: 'ninguno' si
 *     quien lo pide (y no lo creó) lo apagó en su fila, y si no, el del evento; `aviso` (`avisoDe`) va sobre
 *     `mi_recordatorio`;
 *   - `quien_texto`: si es suyo, «Solo vos» (Privado), «Con toda la administración», «Con Carla» (una sola persona: spec,
 *     decisión 9.4) o «Con 4 personas» (Laboral) o el de `textoDeQuienVeElPublico` (Público: «Lo ven todos como «Turno
 *     médico»»); si no, «De <creador>». `quien_largo`, solo si no es suyo: «Lo creó Julián. Están: vos, Carla B. y Carla R.»
 *     (vos primero, si está) o «Lo creó Julián. Es para toda la administración.». Los nombres de los dos, cortos (el punto de
 *     una inicial cierra también la oración: «Lo creó Carla R. Es para toda la administración.»). Sin quien lo creó (un
 *     creado_por en NULL, o sin nombre), la raya en su lugar.
 * Nada tira: lo que no es un objeto cuenta como `{}`, y una persona sin un id que sirva no cuenta.
 */
export const itemDeEvento = (evento, contexto) => {
  const fuente = esObjeto(evento) ? evento : {};
  const { usuarioId, ahora, feriados, administracion = [], usuarios = [] } = esObjeto(contexto) ? contexto : {};
  const yo = idPositivo(usuarioId);
  const esMio = yo !== null && idPositivo(fuente.creado_por) === yo;
  const publico = esSi(fuente.publico);
  // Antes de leer nada más del evento: de un Público de otra persona no se lee el título ni el detalle
  if (publico && !esMio) return itemDelPublicoAjeno(fuente, usuarios);

  // Desde acá, un Público es de quien lo pide: los nombres, contra todos los usuarios
  const nombresContra = publico ? usuarios : administracion;
  const compartido = !publico && esSi(fuente.compartido);
  const paraTodos = compartido && esSi(fuente.para_todos);
  const publicoTodos = publico && esSi(fuente.publico_todos);
  const filas = conId(fuente.personas);
  let elegidas = [];
  if (publico) elegidas = publicoTodos ? [] : conId(fuente.vistas);
  else if (compartido && !paraTodos) elegidas = filas;
  const creador = nombreCorto({ id: fuente.creado_por, nombre: fuente.creador }, nombresContra) || null;
  const nombreDelCreador = creador ?? '—';
  const nombre = (persona) => (typeof persona.nombre === 'string' ? persona.nombre : '');
  const corto = (persona) => nombreCorto({ id: persona.id, nombre: persona.nombre }, nombresContra);
  const esYo = (persona) => idPositivo(persona.id) === yo;

  const recordatorio = esRecordatorio(fuente.recordatorio) ? fuente.recordatorio : null;
  const miFila = esMio ? undefined : filas.find(esYo);
  const miRecordatorio = miFila !== undefined && esSi(miFila.sin_recordatorio) ? 'ninguno' : recordatorio;

  let quienTexto = `De ${nombreDelCreador}`;
  if (esMio && publico) quienTexto = textoDeQuienVeElPublico(fuente, usuarios);
  else if (esMio && !compartido) quienTexto = 'Solo vos';
  else if (esMio && paraTodos) quienTexto = 'Con toda la administración';
  else if (esMio) quienTexto = conPersonas(elegidas.map(corto));

  const item = {
    id: idPositivo(fuente.id),
    titulo: typeof fuente.titulo === 'string' ? fuente.titulo : '',
    detalle: typeof fuente.detalle === 'string' ? fuente.detalle : null,
    fecha: fuente.fecha ?? null,
    desde: fuente.desde ?? null,
    hasta: fuente.hasta ?? null,
    es_mio: esMio,
    compartido,
    para_todos: paraTodos,
    publico
  };
  if (publico) Object.assign(item, { publico_todos: publicoTodos, texto_publico: textoPublicoDe(fuente.texto_publico) });
  Object.assign(item, { creador, personas: elegidas.map(nombre) });
  if (esMio) item.personas_ids = elegidas.map((persona) => idPositivo(persona.id));
  Object.assign(item, {
    recordatorio,
    recordatorio_texto: recordatorio === null ? '' : TEXTO_RECORDATORIO[recordatorio],
    mi_recordatorio: miRecordatorio,
    aviso: avisoDe({ fecha: fuente.fecha, desde: fuente.desde, recordatorio: miRecordatorio }, { ahora, feriados }),
    quien_texto: quienTexto
  });
  if (!esMio) {
    const nombres = [...(elegidas.some(esYo) ? ['vos'] : []), ...elegidas.filter((persona) => !esYo(persona)).map(corto)];
    const loCreo = conPunto(`Lo creó ${nombreDelCreador}`);
    if (paraTodos) item.quien_largo = `${loCreo} Es para toda la administración.`;
    else if (nombres.length > 0) item.quien_largo = `${loCreo} Están: ${conPunto(listaConY(nombres))}`;
    else item.quien_largo = loCreo;
  }
  return item;
};

// Lo demás de la agenda (spec, secciones 6 y 7): lo que se ve en el mes y en Próximos además de los eventos. Cada cosa de
// varios días va entera (su desde y su hasta, aunque pasen del rango pedido) y con `dias`, sus días hábiles dentro del rango
// (con los feriados): los que pinta el mes

const compararTexto = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Las fechas de una licencia o una ausencia (o del rango), si las dos son fechas y en orden: `{ desde, hasta }`; si no, null
const fechasDe = (fuente) => (esObjeto(fuente) && esFechaIso(fuente.desde) && esFechaIso(fuente.hasta)
  && fuente.desde <= fuente.hasta ? { desde: fuente.desde, hasta: fuente.hasta } : null);

// Los días hábiles de `fechas` dentro del rango `{ desde, hasta, feriados }` (los dos días incluidos; `feriados`, el Set de
// feriadosDelRango): [] sin unas fechas o un rango que sirvan, o si no se tocan
const diasEnElRango = (fechas, rango) => {
  const delRango = fechasDe(rango);
  if (fechas === null || delRango === null) return [];
  const desde = fechas.desde > delRango.desde ? fechas.desde : delRango.desde;
  const hasta = fechas.hasta < delRango.hasta ? fechas.hasta : delRango.hasta;
  return diasHabilesDe(desde, hasta, rango.feriados);
};

// «Hasta el viernes 06/11» de lo que dura más de un día; '' si dura uno, o sin fechas
const hastaTextoDe = (fechas) => (fechas !== null && fechas.hasta > fechas.desde ? `Hasta el ${diaLargo(fechas.hasta)}` : '');

// Las horas de una licencia por horas como número positivo (el DECIMAL de la base llega como '2.0'); si no, null
const horasDeLaLicencia = (valor) => {
  const horas = typeof valor === 'number' || (typeof valor === 'string' && valor.trim() !== '') ? Number(valor) : NaN;
  return Number.isFinite(horas) && horas > 0 ? horas : null;
};

/**
 * Una licencia de Mi espacio en la agenda de quien la cargó (la de `licenciasPropiasEntre`, services/miEspacioEventosDatos.js:
 * `{ id, tipo, desde, hasta, horas }`), con el rango pedido `{ desde, hasta, feriados }`: `{ id, tipo, desde, hasta, texto,
 * hasta_texto, dias }`. `texto` es el nombre del tipo (`NOMBRES_TIPO`: es suya, va con el tipo) y, con horas, «, 2 h»
 * («Franquicia, 2 h», «Franquicia, 7,5 h»); `hasta_texto`, «Hasta el viernes 06/11», o '' si dura un día; `dias`, sus días
 * hábiles dentro del rango. Va entera: su desde y su hasta, aunque pasen del rango. Nunca la nota. Nada tira: un tipo que no es
 * de la lista da null y el texto vacío; unas fechas que no sirven, null y sin días.
 */
export const itemDeLicencia = (fila, rango) => {
  const fuente = esObjeto(fila) ? fila : {};
  const fechas = fechasDe(fuente);
  const tipo = typeof fuente.tipo === 'string' && Object.hasOwn(NOMBRES_TIPO, fuente.tipo) ? fuente.tipo : null;
  const nombre = tipo === null ? '' : NOMBRES_TIPO[tipo];
  const horas = horasDeLaLicencia(fuente.horas);
  return {
    id: idPositivo(fuente.id),
    tipo,
    desde: fechas?.desde ?? null,
    hasta: fechas?.hasta ?? null,
    texto: nombre === '' || horas === null ? nombre : `${nombre}, ${numeroTexto(horas)} h`,
    hasta_texto: hastaTextoDe(fechas),
    dias: diasEnElRango(fechas, rango)
  };
};

/**
 * Un compañero que no está, en la agenda de quien mira (las ausencias de `ausentesPara`, controllers/miEspacioController.js:
 * unidas con las seguidas y enteras), con el rango pedido `{ desde, hasta, feriados }`: exactamente `{ nombre, desde, hasta,
 * texto, hasta_texto, dias }`, con «<nombre> no está» (`textoNoEsta`), «Hasta el viernes 30/10» (o '' si es un día) y sus
 * días hábiles dentro del rango. Nunca el tipo, la nota ni un id (antiobjetivo de la spec: aunque vengan, no pasan). Nada
 * tira.
 */
export const itemDeAusencia = (ausencia, rango) => {
  const fuente = esObjeto(ausencia) ? ausencia : {};
  const fechas = fechasDe(fuente);
  const nombre = typeof fuente.nombre === 'string' ? fuente.nombre : '';
  return {
    nombre,
    desde: fechas?.desde ?? null,
    hasta: fechas?.hasta ?? null,
    texto: textoNoEsta(nombre),
    hasta_texto: hastaTextoDe(fechas),
    dias: diasEnElRango(fechas, rango)
  };
};

/**
 * Los feriados de desde a hasta ('AAAA-MM-DD', los dos incluidos) en la agenda: `[{ fecha, nombre, texto }]`, con «Feriado:
 * <nombre>», por fecha. `lista` son las filas de `filasDeFeriados` (services/feriadosDatos.js), recorridas con
 * `feriadosDelAnio` de cada año del rango: los 9 fijos y los de la tabla que ese año rigen (los de `rige: false` no van),
 * también en un fin de semana. Un día lleva un ítem por cada nombre distinto (decisión del controlador, riesgo 21 del
 * preflight): un fijo y una fila de la tabla con el mismo nombre ese día son uno; con otro nombre, los dos, en el orden de la
 * lista del año (el fijo primero). Sin filas, los fijos; con un rango que no es un rango, [].
 */
export const itemsDeFeriados = (lista, desde, hasta) => {
  if (!esFechaIso(desde) || !esFechaIso(hasta) || hasta < desde) return [];
  const items = [];
  const vistos = new Set();
  for (let anio = Number(desde.slice(0, 4)); anio <= Number(hasta.slice(0, 4)); anio++) {
    for (const { fecha, nombre, rige } of feriadosDelAnio(lista, anio)) {
      // La fecha tiene siempre diez caracteres: con ella delante, la clave no confunde dos nombres
      const clave = `${fecha} ${nombre}`;
      if (!rige || fecha < desde || fecha > hasta || vistos.has(clave)) continue;
      vistos.add(clave);
      items.push({ fecha, nombre, texto: `Feriado: ${nombre}` });
    }
  }
  return items;
};

// Lo nuevo de GET /mi-espacio/eventos (spec 2026-10-28-mi-espacio-agenda-onda, 5.2): los compañeros de cada día, para la
// barra agrupada del mes, y la frase de la banda del mes

/**
 * Los compañeros que no están, día por día, de los ítems de `itemDeAusencia` (los de `ausentes`, con el nombre corto y sus
 * `dias`, los días hábiles del rango): `[{ fecha, texto }]`, por fecha, uno por cada fecha que aparece en algún `dias`, con
 * los nombres de ese día por orden alfabético en castellano (`localeCompare(…, 'es')`) y «Carla no está» o «Carla y Julián no
 * están» («A, B y C no están»). La página arma los tramos de la barra comparando el `texto` de días seguidos. Sale solo de
 * `ausentes`: a quien no ve a los compañeros (que recibe []), []. Nada tira: lo que no es un ítem, un `dias` que no es una
 * lista y lo que no es una fecha no cuentan; un nombre que no es un texto cuenta como '' (como en `itemDeAusencia`).
 */
export const companerosPorDia = (ausentes) => {
  const porFecha = new Map();
  for (const ausente of listaDe(ausentes)) {
    if (!esObjeto(ausente)) continue;
    const nombre = typeof ausente.nombre === 'string' ? ausente.nombre : '';
    // Cada fecha una vez por compañero, aunque su `dias` la repita
    for (const fecha of new Set(listaDe(ausente.dias))) {
      if (!esFechaIso(fecha)) continue;
      if (!porFecha.has(fecha)) porFecha.set(fecha, []);
      porFecha.get(fecha).push(nombre);
    }
  }
  return [...porFecha.keys()].sort(compararTexto).map((fecha) => {
    const nombres = porFecha.get(fecha).sort((a, b) => a.localeCompare(b, 'es'));
    return { fecha, texto: `${listaConY(nombres)} ${nombres.length === 1 ? 'no está' : 'no están'}` };
  });
};

// Cómo nombra la frase del mes cada licencia de Mi espacio, por tipo (los de `TIPOS_LICENCIA`), con su artículo: las
// vacaciones y las horas a favor, «tus»; las demás, «tu»
export const FRASE_DE_LA_LICENCIA = Object.freeze({
  vacaciones: 'tus vacaciones',
  horas_a_favor: 'tus horas a favor',
  franquicia: 'tu franquicia',
  estudios: 'tu licencia por estudios',
  medica: 'tu licencia médica',
  medica_extraordinaria: 'tu licencia médica extraordinaria',
  familiar: 'tu licencia por el grupo familiar',
  franco: 'tu franco compensatorio',
  uso_autorizado: 'tu uso autorizado'
});

// Un mes 'AAAA-MM' (el mes del 01 al 12)
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
// El primer y el último día de un mes 'AAAA-MM' (`{ primero, ultimo }`), o null si no es un mes. El último, el primero de
// 31, 30, 29 y 28 que existe (el 28 existe siempre): febrero de un año bisiesto termina el 29
const diasDelMes = (mes) => {
  if (typeof mes !== 'string' || !MES.test(mes) || !esFechaIso(`${mes}-01`)) return null;
  return { primero: `${mes}-01`, ultimo: ['31', '30', '29', '28'].map((dia) => `${mes}-${dia}`).find(esFechaIso) };
};

/**
 * El mes de la frase de un pedido (`mes` de `GET /mi-espacio/eventos`, el que muestra la página) con el rango pedido
 * `{ desde, hasta }`: el mes, si es un texto 'AAAA-MM' y cae entero en el rango (su primer y su último día incluidos); si no
 * (una lista, de un parámetro repetido; un texto que no es un mes; un mes que no es del rango, o sin un rango que sirva), null:
 * el pedido sigue igual, sin la frase. Nada tira.
 */
export const mesDeLaFrase = (valor, rango) => {
  const dias = diasDelMes(valor);
  const delRango = fechasDe(rango);
  if (dias === null || delRango === null) return null;
  return dias.primero >= delRango.desde && dias.ultimo <= delRango.hasta ? valor : null;
};

// 'tus vacaciones del 16 al 27' o 'tu franquicia el 4': la licencia con sus fechas recortadas al mes `{ primero, ultimo }`
const licenciaEnLaFrase = ({ tipo, desde, hasta }, { primero, ultimo }) => {
  const delDia = (fecha) => String(Number(fecha.slice(8, 10)));
  const inicio = desde > primero ? desde : primero;
  const fin = hasta < ultimo ? hasta : ultimo;
  return inicio === fin
    ? `${FRASE_DE_LA_LICENCIA[tipo]} el ${delDia(inicio)}`
    : `${FRASE_DE_LA_LICENCIA[tipo]} del ${delDia(inicio)} al ${delDia(fin)}`;
};

/**
 * La frase de la banda del mes de la agenda, con lo que ve quien pide (los ítems de la respuesta): `mes` ('AAAA-MM'),
 * `eventos` (los de `itemDeEvento`: cuenta su `fecha`), `feriados` (los de `itemsDeFeriados`) y `licencias` (las de
 * `itemDeLicencia`). Dice, en este orden y solo lo que hay: «N eventos» (los eventos con fecha del mes, cualquier día; «1
 * evento»), «N feriados» (las fechas distintas del mes con algún feriado, también en un fin de semana; «1 feriado») y cada una
 * de tus licencias que toca el mes, por desde, con su nombre y su artículo (`FRASE_DE_LA_LICENCIA`) y sus fechas recortadas
 * al mes: «tu franquicia el 4», «tus vacaciones del 16 al 27». Todo junto con comas y «y», con mayúscula al principio y punto
 * al final: «8 eventos, 4 feriados, tu franquicia el 4 y tus vacaciones del 16 al 27.». Sin nada, «Nada cargado en
 * noviembre. Tocá un día para agendar algo.». Los compañeros no van. null si `mes` no es un mes 'AAAA-MM'. Nada tira: lo que
 * no es una lista o un ítem, una licencia de un tipo que no es de la lista o sin unas fechas en orden, no cuentan.
 */
export const fraseDelMes = (entrada) => {
  const { mes, eventos, feriados, licencias } = esObjeto(entrada) ? entrada : {};
  const dias = diasDelMes(mes);
  if (dias === null) return null;
  const delMes = (fecha) => esFechaIso(fecha) && fecha >= dias.primero && fecha <= dias.ultimo;
  const fechaDe = (item) => (esObjeto(item) ? item.fecha : null);

  const cuantosEventos = listaDe(eventos).filter((item) => delMes(fechaDe(item))).length;
  const cuantosFeriados = new Set(listaDe(feriados).map(fechaDe).filter(delMes)).size;
  const deLicencias = listaDe(licencias)
    .map((item) => ({ item, fechas: fechasDe(item) }))
    .filter(({ item, fechas }) => fechas !== null && typeof item.tipo === 'string'
      && Object.hasOwn(FRASE_DE_LA_LICENCIA, item.tipo) && fechas.desde <= dias.ultimo && fechas.hasta >= dias.primero)
    .sort((a, b) => compararTexto(a.fechas.desde, b.fechas.desde) || compararTexto(a.fechas.hasta, b.fechas.hasta))
    .map(({ item, fechas }) => licenciaEnLaFrase({ tipo: item.tipo, ...fechas }, dias));

  const partes = [
    ...(cuantosEventos > 0 ? [`${cuantosEventos} ${cuantosEventos === 1 ? 'evento' : 'eventos'}`] : []),
    ...(cuantosFeriados > 0 ? [`${cuantosFeriados} ${cuantosFeriados === 1 ? 'feriado' : 'feriados'}`] : []),
    ...deLicencias
  ];
  if (partes.length === 0) return `Nada cargado en ${nombreDelMes(mes)}. Tocá un día para agendar algo.`;
  return `${mayuscula(listaConY(partes))}.`;
};

// En «Hoy y mañana», quién está va con minúscula al principio: «solo vos», «con 4 personas», «de Julián», «lo ven todos como
// «Turno médico»»
const minuscula = (texto) => texto.charAt(0).toLowerCase() + texto.slice(1);

/**
 * Los eventos de «Hoy y mañana» del Resumen (spec, sección 6, y spec 2026-10-27-mi-espacio-resumen, 4.4), de los ítems de
 * `itemDeEvento` (los que ve la persona), hoy ('AAAA-MM-DD') y ahora ('AAAA-MM-DD HH:MM:SS' de `ahoraArgentina()`, o sin los
 * segundos): los de hoy y los de mañana (el día siguiente corrido), por día y hora (los de la misma hora, en el orden
 * recibido), cada uno `{ id, hora, titulo, compartido, publico, detalle, dia, quien }`. `detalle` es «Hoy · solo vos», «Mañana
 * · con 4 personas», «Hoy · de <creador>» o «Hoy · lo ven todos como «Turno médico»» (el `quien_texto` del ítem, en
 * minúscula; sin él, «Hoy» o «Mañana»); `dia`, 'hoy' o 'manana', y `quien`, lo que va después de « · » («solo vos»; sin
 * `quien_texto`, ''), para las columnas de la página, que no corta `detalle`; `compartido`, si el evento es un Laboral (el
 * violeta de la página), y `publico`, si es un Personal (Público) (spec 2026-10-29-mi-espacio-evento-publico, 5.4): el de otra
 * persona va con su título, «Carla: Turno médico», y sin nada de quién está (`quien` '' y `detalle` «Hoy» o «Mañana», aunque
 * el ítem trajera un `quien_texto`, que no trae). Ni los de antes ni los de pasado
 * mañana, ni los de hoy que ya terminaron (decisión del usuario, 27/10/2026): los que tienen su fin (`hasta` si es una hora;
 * si no, `desde`) antes de la hora y el minuto de ahora (a las 10:00, uno de 09:00 a 10:00 todavía va; a las 10:01, ya no).
 * Sin un ahora que sirva o con uno de otro día, no saca ninguno; uno sin ninguna hora, tampoco (no se sabe si terminó). Los de
 * mañana van todos. Nada tira: sin una lista o un hoy válido, []; lo que no es un evento de esos dos días no cuenta.
 */
export const eventosDeHoyYManana = (items, hoy, ahora) => {
  if (!Array.isArray(items) || !esFechaIso(hoy)) return [];
  const manana = sumarDias(hoy, 1);
  const hora = (item) => (esHora(item.desde) ? item.desde : '');
  const horaDeAhora = esMomento(ahora) && ahora.slice(0, 10) === hoy ? ahora.slice(11, 16) : null;
  const yaTermino = (item) => {
    if (horaDeAhora === null || item.fecha !== hoy) return false;
    const fin = esHora(item.hasta) ? item.hasta : hora(item);
    return fin !== '' && fin < horaDeAhora;
  };
  return items
    .filter((item) => esObjeto(item) && (item.fecha === hoy || item.fecha === manana) && !yaTermino(item))
    .sort((a, b) => compararTexto(a.fecha, b.fecha) || compararTexto(hora(a), hora(b)))
    .map((item) => {
      const dia = item.fecha === hoy ? 'Hoy' : 'Mañana';
      const publico = esSi(item.publico);
      const deOtro = publico && item.es_mio !== true;
      const quien = !deOtro && typeof item.quien_texto === 'string' ? minuscula(item.quien_texto.trim()) : '';
      return {
        id: idPositivo(item.id),
        hora: hora(item),
        titulo: typeof item.titulo === 'string' ? item.titulo : '',
        compartido: esSi(item.compartido),
        publico,
        detalle: quien === '' ? dia : `${dia} · ${quien}`,
        dia: item.fecha === hoy ? 'hoy' : 'manana',
        quien
      };
    });
};
