/**
 * El correo del dato de la quincena (spec 2026-11-12-dato-quincena-correo, 5, 6, 9, 10 y 12): las reglas puras del mail que
 * manda el RPAD, sin pool ni Date local. Hoy ('AAAA-MM-DD') y ahora ('AAAA-MM-DD HH:MM:SS', de `ahoraArgentina()`) llegan por
 * parámetro, y el calendario también (el objeto de `leerCalendario` o de `calendarioCon`): nadie acá lee la tabla de feriados ni
 * importa los días hábiles fijos.
 *
 * Las horas guardadas (los DATETIME de dato_quincena_correos, dato_quincena_envios y dato_quincena_destinatarios, escritos con
 * `ahoraArgentina()`) llegan como texto 'AAAA-MM-DD HH:MM:SS', con DATE_FORMAT en la consulta: un valor con otra forma (un Date
 * de mysql2, null) cuenta como sin hora. Los interruptores van en booleanos y, ante la duda, no sale nada: el envío automático
 * está prendido solo con `true` y una persona recibe el mail solo con `activa` y `emailValido` en true y `deLicencia` en false.
 *
 * Cuándo sale (sección 5): `envioAlLlegar` (el POST), `decidirCorrida` (las corridas de las 8:05 y las 14:00) y `proximaSalida`.
 * Lo que se muestra (sección 6): la línea del detalle, la pastilla de la tarjeta y el envío del recibo salen de una sola lectura
 * de la situación (`situacionDelEnvio`), así nunca dicen cosas distintas; las filas de cada persona mandan sobre el estado
 * guardado.
 * Para administración: la fila de cada persona al armar el envío y su texto, el resumen, si se puede reenviar y la respuesta de
 * «Reenviar», las próximas ediciones y los mensajes.
 * El mail (sección 10): `modeloDelMail` arma lo que recibe la plantilla, que no importa nada de acá.
 */
import { esFechaIso, sumarDias, formatoCorto } from './notasDigitalesCalendario.js';
import { NOMBRES_DE_LOS_FIJOS, fechaEnElAnio, diaDeLaSemana } from './feriadosReglas.js';
import { NOMBRE_DEL_BOT, horaArgentina, textoDelCorreo, textoDeCantidad } from './datoQuincenaReglas.js';
import { enLista } from './miEspacioReglas.js';
import { RPAD_URL } from './emailTemplates.js';
import { idPositivo } from './proyectosReglas.js';

// Una edición sale solo si su fecha es de los últimos 13 días (spec, 5): con la serie cada 14 días, nunca se manda una de la
// quincena anterior
export const DIAS_DE_VIGENCIA = 13;
// Los intentos de cada persona en el envío automático: el primero y dos reintentos, en las corridas siguientes de días hábiles
export const MAXIMO_DE_INTENTOS = 3;
// Las horas de las dos Tareas Cron que corren el paso del correo (lo que se guarda y se muestra de un envío es la hora real)
export const HORA_DE_LA_MANANA = '08:05';
export const HORA_DE_LA_TARDE = '14:00';
// Cada cuántos días llega una edición regular, y la primera de la serie (el lunes 09/11/2026), para las próximas sin ninguna
export const CADENCIA = 14;
export const PRIMERA_EDICION = '2026-11-09';

/**
 * Los mensajes fijos de las rutas de administración y de la corrida. Los tres últimos se guardan en dato_quincena_envios.error
 * (un texto fijo, nunca el de nodemailer): el de un envío que falló y los dos motivos de una persona omitida, que
 * `textoDeLaPersona` vuelve a leer.
 */
export const MENSAJES_CORREO = Object.freeze({
  noExiste: 'No existe esa edición.',
  listaInvalida: 'La lista de personas no es válida.',
  aQuien: 'Elegí a quién reenviarla: a todas las personas de la lista o a una de ellas.',
  noEstaEnLaLista: 'Esa persona no está en la lista: se reenvía solo a quienes lo reciben.',
  soloRegulares: 'Solo se reenvían las ediciones regulares: a un piloto se le puede mandar una prueba.',
  sinEmailPropio: 'Tu cuenta no tiene un email válido: no se puede mandar la prueba.',
  todaviaSeManda: 'Esta edición todavía se está mandando sola: se puede reenviar cuando termine.',
  ocupado: 'Ahora se está mandando el dato de la quincena. Probá de nuevo en unos minutos.',
  prueba: 'Te mandamos la prueba a tu casilla.',
  pruebaFallida: 'No se pudo mandar la prueba a tu casilla.',
  envioInvalido: 'Elegí si el envío automático queda prendido o apagado.',
  listaVacia: 'No hay nadie en la lista: las personas se suman en la pestaña Correo.',
  envioFallido: 'No se pudo enviar el mail.',
  sinEmail: 'No tenía un email válido.',
  inactiva: 'Ya no estaba activa.'
});

// Las horas y las fechas de los textos

// 'AAAA-MM-DD HH:MM' con los segundos o sin ellos: una hora guardada o una salida de proximaSalida
const MOMENTO = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})(?::\d{2})?$/;

// { fecha: 'AAAA-MM-DD', hora: '8:05' }: la hora sin el cero a la izquierda, como las de las Tareas Cron. Otra cosa, null
const momentoDe = (valor) => {
  const partes = typeof valor === 'string' ? MOMENTO.exec(valor) : null;
  return partes === null || !esFechaIso(partes[1]) ? null : { fecha: partes[1], hora: `${Number(partes[2])}:${partes[3]}` };
};

// '8:05' de '08:05'
const sinCero = (hora) => `${Number(hora.slice(0, 2))}:${hora.slice(3, 5)}`;
// '10/11' de '2026-11-10'
const diaYMes = (fecha) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
// 'martes 10/11/2026 a las 8:05'
const diaYHora = ({ fecha, hora }) => `${diaDeLaSemana(fecha)} ${formatoCorto(fecha)} a las ${hora}`;
// 'mar 10/11': las tres primeras letras del día son la abreviatura de los siete (lun, mar, mié, jue, vie, sáb, dom)
const diaCorto = (fecha) => `${diaDeLaSemana(fecha).slice(0, 3)} ${diaYMes(fecha)}`;
const personas = (n) => (n === 1 ? '1 persona' : `${n} personas`);
// Lo que no es una lista cuenta como ninguna fila
const listaDe = (valor) => (Array.isArray(valor) ? valor : []);

// Cuándo sale (sección 5)

// La fecha es de los últimos 13 días (o de hoy en adelante). Las dos, 'AAAA-MM-DD': se comparan como texto
export const estaVigente = (fecha_edicion, hoy) => fecha_edicion >= sumarDias(hoy, -DIAS_DE_VIGENCIA);

/**
 * Lo que queda al llegar el POST (el 201), en la misma transacción: una regular, programada si el envío automático está
 * prendido y es de los últimos 13 días; si no, no enviada, con su motivo. Con las dos cosas, «apagado»: manda el interruptor,
 * como en la corrida. Un piloto nunca sale solo: null (no tiene fila de correo).
 */
export const envioAlLlegar = ({ tipo, fecha_edicion, envioActivo, hoy }) => {
  if (tipo !== 'regular') return null;
  if (envioActivo !== true) return { estado: 'no_enviada', motivo: 'apagado' };
  return estaVigente(fecha_edicion, hoy) ? { estado: 'programada' } : { estado: 'no_enviada', motivo: 'vieja' };
};

// De dos ediciones, la de fecha más nueva; con la misma fecha (solo un SQL a mano: la clave lo impide), la de id más alto
const esMasNueva = (una, otra) => una.fecha_edicion > otra.fecha_edicion
  || (una.fecha_edicion === otra.fecha_edicion && una.id > otra.id);

/**
 * Qué hace una corrida con las programadas (`[{ id, fecha_edicion }]`): `{ mandar: id | null, noEnviar: [{ id, motivo }] }`.
 * Apagado, todas quedan «apagado», cualquier día: apagarlo cancela lo que esperaba. Un día no hábil o con la tabla de feriados
 * caída (`calendario.error !== null`), nada: lo deja para la corrida siguiente. Si no, de las que ya llegaron a su fecha, las de
 * más de 13 días quedan «vieja» y de las vigentes sale la más nueva y las demás quedan «mas_nueva»; las de una fecha posterior
 * a hoy esperan.
 * `programadas` son las que todavía no tienen filas automáticas: una edición que ya empezó a salir sigue con sus reintentos y
 * nunca pasa a no enviada.
 */
export const decidirCorrida = ({ programadas, envioActivo, hoy, calendario }) => {
  const todas = listaDe(programadas);
  if (envioActivo !== true) return { mandar: null, noEnviar: todas.map(({ id }) => ({ id, motivo: 'apagado' })) };
  if (calendario.error !== null || !calendario.esDiaHabil(hoy)) return { mandar: null, noEnviar: [] };
  const llegadas = todas.filter((programada) => programada.fecha_edicion <= hoy);
  const vigentes = llegadas.filter((programada) => estaVigente(programada.fecha_edicion, hoy));
  const elegida = vigentes.reduce((mas, programada) => (mas === null || esMasNueva(programada, mas) ? programada : mas), null);
  return {
    mandar: elegida === null ? null : elegida.id,
    noEnviar: llegadas.filter((programada) => programada !== elegida)
      .map(({ id, fecha_edicion }) => ({ id, motivo: estaVigente(fecha_edicion, hoy) ? 'mas_nueva' : 'vieja' }))
  };
};

/**
 * La corrida en que sale una edición, 'AAAA-MM-DD HH:MM' (spec, 2 y 6), con la hora de la consulta: un día hábil, antes de las
 * 8:05 la de las 8:05 y antes de las 14:00 la de las 14:00; después, o un día no hábil, la de las 8:05 del siguiente día hábil.
 * Nunca antes de su fecha: una de mañana sale a las 8:05 del primer día hábil desde mañana. Es una estimación: lo que pasó lo
 * dicen las filas.
 */
export const proximaSalida = ({ fecha_edicion, ahora, calendario }) => {
  const hoy = ahora.slice(0, 10);
  if (fecha_edicion > hoy) return `${calendario.proximoDiaHabil(fecha_edicion)} ${HORA_DE_LA_MANANA}`;
  const hora = ahora.slice(11, 16);
  if (calendario.esDiaHabil(hoy)) {
    if (hora < HORA_DE_LA_MANANA) return `${hoy} ${HORA_DE_LA_MANANA}`;
    if (hora < HORA_DE_LA_TARDE) return `${hoy} ${HORA_DE_LA_TARDE}`;
  }
  return `${calendario.proximoDiaHabil(sumarDias(hoy, 1))} ${HORA_DE_LA_MANANA}`;
};

// El instante de una salida, con la zona de Argentina (que no cambia la hora): '2026-11-24T08:05:00-03:00', para el recibo
export const instanteDeSalida = (salida) => `${salida.slice(0, 10)}T${salida.slice(11, 16)}:00-03:00`;

// El estado de la edición (sección 6)

const intentosDe = (fila) => Number(fila.intentos) || 0;
// Sin tipo, una fila de su lista: la consulta puede traerlo o no
const esAutomatico = (fila) => (fila.tipo ?? 'automatico') === 'automatico';
const esReenvio = (fila) => (fila.tipo ?? 'reenvio') === 'reenvio';
const automaticosDe = (envios) => listaDe(envios).filter(esAutomatico);
// Ruling 9: una persona sale sola solo mientras la edición está vigente (estaVigente). Vencida, lo que quedaba abierto (pendiente
// o en reintento) es definitivo: no le llegó. Solo `false` la cierra: sin la opción, como siempre
const cerradaPor = (vigente) => vigente === false;
const enReintento = (fila, vigente) => !cerradaPor(vigente) && fila.estado === 'fallido' && intentosDe(fila) < MAXIMO_DE_INTENTOS;
const abierta = (fila, vigente) => !cerradaPor(vigente) && (fila.estado === 'pendiente' || enReintento(fila, vigente));
// Las de licencia y las omitidas (inactivas o sin email) no esperaban el mail: no cuentan para «enviada» ni para «fallida»
const correspondia = (fila) => fila.estado !== 'licencia' && fila.estado !== 'omitido';

// Las personas a las que les llegó un reenvío (solo los enviados: una prueba no cuenta)
const reenviadasDe = (reenvios) => new Set(listaDe(reenvios)
  .filter((fila) => esReenvio(fila) && fila.estado === 'enviado')
  .map((fila) => fila.usuario_id));

// Le llegó: por el envío automático o, si había fallado, por un reenvío (spec, 9: deja de contar como falla)
const leLlego = (fila, reenviadas) => fila.estado === 'enviado' || (fila.usuario_id != null && reenviadas.has(fila.usuario_id));

/**
 * El estado de una edición que salió, de sus filas automáticas (`[{ usuario_id, estado, intentos }]`) y de sus reenvíos: null
 * mientras alguna persona está pendiente o en reintento (fallido con menos de 3 intentos), o sin filas; si no, «enviada» (le
 * llegó a todas las que correspondía), «fallida» (a ninguna: también si nadie de la lista lo podía recibir) o «parcial». Una
 * que quedó «enviando» por un corte no se reintenta y cuenta como sin confirmar: parcial, aunque ninguna figure enviada (pudo
 * haber salido). Un reenvío enviado a quien había fallado deja de contar como falla.
 * `{ vigente }` (Ruling 9): con false, la edición ya no está vigente y cierra: sus pendientes y sus reintentos cuentan como que
 * no le llegó. Sin la opción, vigente.
 */
export const estadoDeLaEdicion = (envios, reenvios = [], { vigente } = {}) => {
  const filas = automaticosDe(envios);
  if (filas.length === 0 || filas.some((fila) => abierta(fila, vigente))) return null;
  const reenviadas = reenviadasDe(reenvios);
  const esperaban = filas.filter(correspondia);
  const llegaron = esperaban.filter((fila) => leLlego(fila, reenviadas)).length;
  if (esperaban.length > 0 && llegaron === esperaban.length) return 'enviada';
  if (llegaron === 0 && !esperaban.some((fila) => fila.estado === 'enviando')) return 'fallida';
  return 'parcial';
};

// La cuenta de «Enviada a N de M» (spec, 6): M son todas las personas del envío automático, también las de licencia, y N las
// que lo recibieron
const cuentaDe = (filas, reenvios, vigente) => {
  const reenviadas = reenviadasDe(reenvios);
  return {
    total: filas.length,
    recibieron: filas.filter((fila) => leLlego(fila, reenviadas)).length,
    esperaban: filas.filter(correspondia).length,
    enReintento: filas.filter((fila) => enReintento(fila, vigente)).length,
    sinConfirmar: filas.filter((fila) => fila.estado === 'enviando' && !leLlego(fila, reenviadas)).length
  };
};

// Las ediciones que, sin filas automáticas, quedaron guardadas como salidas
const SALIDAS = Object.freeze(['enviada', 'parcial']);

/**
 * Si la edición salió sola: lo dicen los estados, nunca la hora (una hora que no se puede leer, como un Date si una consulta
 * olvida el DATE_FORMAT, cambia solo el texto). Con filas automáticas, alguna enviada; sin filas, el correo guardado como
 * enviada o parcial, o con la hora del primer envío.
 */
const salioSola = (filas, correo) => (filas.length > 0
  ? filas.some((fila) => fila.estado === 'enviado')
  : SALIDAS.includes(correo?.estado) || correo?.enviada_at != null);

// La hora del primer envío automático que salió, si se puede leer: la más vieja de las filas enviadas que la tienen o, sin
// ellas, la guardada en el correo. Si no, null: el texto va sin la hora
const primerEnvio = (filas, correo) => {
  const horas = filas.filter((fila) => fila.estado === 'enviado' && momentoDe(fila.enviado_at) !== null)
    .map((fila) => fila.enviado_at).sort();
  if (horas.length > 0) return horas[0];
  return momentoDe(correo?.enviada_at) !== null ? correo.enviada_at : null;
};

/**
 * Un reenvío que le llegó a toda la lista (spec, 6), de los reenvíos (`[{ usuario_id, estado, enviado_at }]`) y de la lista de
 * hoy (`[{ usuario_id, agregado_at }]`, la de dato_quincena_destinatarios): `{ enviado_at }`, el momento en que los reenvíos
 * enviados cubrieron a todas las personas que estaban en la lista entonces, o null. Quien se sumó después no cuenta (quien
 * salió de la lista ya no está); sin la hora en que se sumó, cuenta siempre. Con la lista vacía, null.
 * Un reenvío enviado cuya hora no se puede leer igual cuenta: como no se sabe cuándo salió, va al final y tiene que cubrir a toda
 * la lista de hoy, y entonces `enviado_at` es null (el texto va sin la hora).
 */
export const reenvioATodaLaLista = (reenvios, lista) => {
  const enLaLista = listaDe(lista);
  if (enLaLista.length === 0) return null;
  const enviados = listaDe(reenvios).filter((fila) => esReenvio(fila) && fila.estado === 'enviado');
  const conHora = enviados.filter((fila) => momentoDe(fila.enviado_at) !== null)
    .sort((una, otra) => (una.enviado_at < otra.enviado_at ? -1 : Number(una.enviado_at > otra.enviado_at)));
  const cubiertas = new Set();
  for (const { usuario_id, enviado_at } of conHora) {
    cubiertas.add(usuario_id);
    const estaban = enLaLista.filter((persona) => momentoDe(persona.agregado_at) === null || persona.agregado_at <= enviado_at);
    if (estaban.length > 0 && estaban.every((persona) => cubiertas.has(persona.usuario_id))) return { enviado_at };
  }
  const sinHora = enviados.filter((fila) => momentoDe(fila.enviado_at) === null);
  for (const { usuario_id } of sinHora) cubiertas.add(usuario_id);
  return sinHora.length > 0 && enLaLista.every((persona) => cubiertas.has(persona.usuario_id)) ? { enviado_at: null } : null;
};

// Lo que se muestra (sección 6)

const LINEAS = Object.freeze({
  piloto: 'Los pilotos no se envían por correo.',
  espera: 'En espera: el envío automático está apagado.',
  nadie: 'No se envió: nadie de la lista estaba disponible.',
  sinConfirmar: 'No se pudo confirmar el envío por correo.',
  fallida: 'No se pudo enviar.',
  sinEnvio: 'Sin envío automático: llegó antes de que el RPAD mandara el correo.'
});

// Por qué no se envió: en el detalle, en pasado; en el recibo, en presente (lo lee el bot al archivarla)
const NO_ENVIADA = Object.freeze({
  apagado: 'No se envió: el envío automático estaba apagado.',
  vieja: `No se envió: llegó con más de ${DIAS_DE_VIGENCIA} días.`,
  mas_nueva: 'No se envió: hay una edición más nueva.',
  sin_lista: 'No se envió: no había nadie en la lista.'
});
const NO_SE_ENVIA = Object.freeze({
  apagado: 'No se envía por correo: el envío automático está apagado.',
  vieja: `No se envía por correo: tiene más de ${DIAS_DE_VIGENCIA} días.`,
  mas_nueva: 'No se envía por correo: hay una edición más nueva.',
  sin_lista: 'No se envía por correo: no hay nadie en la lista.'
});
const porMotivo = (textos, motivo, otro) => (typeof motivo === 'string' && Object.hasOwn(textos, motivo) ? textos[motivo] : otro);

// Los motivos con los que una no enviada muestra el correo del bot, si salió: el de las ediciones de la transición
const MOTIVOS_CON_EL_BOT = Object.freeze(['apagado', 'vieja']);

/**
 * La situación del envío de una edición, de la que salen la línea, la pastilla y el recibo. En este orden: un piloto; una que
 * ya salió sola (alguna fila enviada: sigue «enviada» para todos mientras quedan reintentos); una que espera su corrida (sin
 * filas, o en curso sin ninguna enviada), o «en espera» con el envío apagado; una que el RPAD no mandó solo y alguien reenvió a
 * toda la lista; una sin envío (anterior a esta entrega) o no enviada por «apagado» o «vieja» con el correo del bot, que muestra
 * el del bot; las demás no enviadas, con su motivo; y una que no le llegó a nadie (nadie la esperaba, sin confirmar o fallida).
 * El estado sale de las filas cuando las hay ('en_curso' mientras estadoDeLaEdicion da null) y, si no, del guardado. Una edición
 * que ya no está vigente (su fecha y la de `ahora`, estaVigente) cierra sus filas abiertas (Ruling 9): así lo ven la lista, el
 * detalle y el recibo sin que nadie les pase nada más.
 */
const situacionDelEnvio = ({
  tipo, fecha_edicion, correo, envios, reenvios, lista, correoDelBot, envioActivo, ahora, calendario
}) => {
  if (tipo !== 'regular') return { clase: 'piloto' };
  const vigente = typeof fecha_edicion !== 'string' || typeof ahora !== 'string'
    || estaVigente(fecha_edicion, ahora.slice(0, 10));
  const filas = automaticosDe(envios);
  let estado = correo?.estado ?? null;
  if (correo != null && filas.length > 0) estado = estadoDeLaEdicion(filas, reenvios, { vigente }) ?? 'en_curso';
  if (salioSola(filas, correo)) {
    return { clase: 'enviada', estado, primero: primerEnvio(filas, correo), cuenta: cuentaDe(filas, reenvios, vigente) };
  }
  if (estado === 'programada' || estado === 'en_curso') {
    return envioActivo === true
      ? { clase: 'programada', estado, hoy: ahora.slice(0, 10), salida: proximaSalida({ fecha_edicion, ahora, calendario }) }
      : { clase: 'espera', estado };
  }
  const aTodas = reenvioATodaLaLista(reenvios, lista);
  if (aTodas !== null) return { clase: 'reenviada', estado, momento: aTodas.enviado_at };
  if (correo == null) return { clase: 'del_bot', estado };
  if (estado === 'no_enviada') {
    return MOTIVOS_CON_EL_BOT.includes(correo.motivo) && correoDelBot?.estado === 'enviado'
      ? { clase: 'del_bot', estado }
      : { clase: 'no_enviada', estado, motivo: correo.motivo };
  }
  const cuenta = cuentaDe(filas, reenvios, vigente);
  if (cuenta.esperaban === 0) return { clase: 'nadie', estado };
  return { clase: cuenta.sinConfirmar > 0 ? 'sin_confirmar' : 'fallida', estado };
};

// «Enviada por correo el martes 10/11/2026 a las 8:05.» y, sin una hora que se pueda leer, «Enviada por correo.»
const conLaHora = (texto, valor) => {
  const momento = momentoDe(valor);
  return momento === null ? `${texto}.` : `${texto} el ${diaYHora(momento)}.`;
};
// «Enviada el mar 10/11» y, sin una hora que se pueda leer, «Enviada»
const conElDia = (texto, valor) => {
  const momento = momentoDe(valor);
  return momento === null ? texto : `${texto} el ${diaCorto(momento.fecha)}`;
};

// La línea de una situación, la de todos (spec, 6)
const lineaDe = (situacion, correoDelBot) => {
  switch (situacion.clase) {
    case 'piloto': return LINEAS.piloto;
    case 'espera': return LINEAS.espera;
    case 'programada': {
      const { fecha, hora } = momentoDe(situacion.salida);
      return fecha === situacion.hoy ? `Se envía hoy a las ${hora}.` : `Se envía el ${diaYHora({ fecha, hora })}.`;
    }
    case 'enviada': return conLaHora('Enviada por correo', situacion.primero);
    case 'reenviada': return conLaHora('Reenviada por correo', situacion.momento);
    case 'del_bot': return textoDelCorreo(correoDelBot?.enviado_at ?? null, correoDelBot?.estado);
    case 'no_enviada': return porMotivo(NO_ENVIADA, situacion.motivo, 'No se envió.');
    case 'nadie': return LINEAS.nadie;
    case 'sin_confirmar': return LINEAS.sinConfirmar;
    default: return LINEAS.fallida;
  }
};

// La pastilla de una edición sin envío del RPAD cuyo correo mandó el bot, con su día en Argentina; si no salió, sin pastilla
const pastillaDelBot = (correoDelBot) => {
  if (correoDelBot?.estado !== 'enviado') return null;
  const hora = horaArgentina(correoDelBot.enviado_at);
  return {
    tipo: 'enviada',
    texto: hora === null ? `Enviada por ${NOMBRE_DEL_BOT}` : `Enviada por ${NOMBRE_DEL_BOT} el ${diaCorto(hora.iso.slice(0, 10))}`
  };
};

// La pastilla de una situación (spec, 6). Administración ve además si a alguien no le llegó: las personas en reintento o,
// en una parcial, «Enviada a N de M»
const pastillaDe = (situacion, correoDelBot, admin) => {
  switch (situacion.clase) {
    case 'piloto': return { tipo: 'piloto', texto: 'Piloto: no se envía' };
    case 'espera': return { tipo: 'espera', texto: 'En espera' };
    case 'programada': {
      const { fecha, hora } = momentoDe(situacion.salida);
      return { tipo: 'programada', texto: fecha === situacion.hoy ? `Sale hoy a las ${hora}` : `Sale el ${diaCorto(fecha)}` };
    }
    case 'enviada': {
      const { cuenta } = situacion;
      if (admin === true && cuenta.enReintento > 0) {
        return { tipo: 'parcial', texto: `${personas(cuenta.enReintento)} en reintento` };
      }
      if (admin === true && situacion.estado === 'parcial' && cuenta.total > 0) {
        return { tipo: 'parcial', texto: `Enviada a ${cuenta.recibieron} de ${cuenta.total}` };
      }
      return { tipo: 'enviada', texto: conElDia('Enviada', situacion.primero) };
    }
    case 'reenviada': return { tipo: 'enviada', texto: conElDia('Reenviada', situacion.momento) };
    case 'del_bot': return pastillaDelBot(correoDelBot);
    case 'no_enviada':
    case 'nadie': return { tipo: 'no_enviada', texto: 'No se envió' };
    case 'sin_confirmar': return { tipo: 'parcial', texto: 'Sin confirmar' };
    default: return { tipo: 'fallida', texto: 'No se pudo enviar' };
  }
};

/**
 * La línea del correo del detalle, la que ven todos (spec, 6): «Enviada por correo el martes 10/11/2026 a las 8:05.», «Se envía
 * hoy a las 8:05.», «En espera: el envío automático está apagado.», «No se envió: …», la del bot en una edición sin envío…
 * Recibe la edición (`tipo`, `fecha_edicion`), su correo (la fila de dato_quincena_correos o null), sus filas automáticas
 * (`envios`), sus reenvíos y la lista de hoy (para «Reenviada por correo el …», `reenvioATodaLaLista`), el correo del JSON del
 * bot (`{ estado, enviado_at }`), el interruptor, ahora y el calendario.
 */
export const lineaDelCorreo = ({
  tipo, fecha_edicion, correo, envios = [], reenvios = [], lista = [], correoDelBot = null, envioActivo, ahora, calendario
}) => lineaDe(situacionDelEnvio({
  tipo, fecha_edicion, correo, envios, reenvios, lista, correoDelBot, envioActivo, ahora, calendario
}), correoDelBot);

/**
 * La pastilla de la tarjeta (spec, 6): `{ tipo, texto }`, con `tipo` 'enviada', 'programada', 'parcial', 'fallida', 'espera',
 * 'no_enviada' o 'piloto' (la página le pone su color y su ícono), o null en una edición sin envío cuyo correo no salió. Los
 * mismos parámetros que `lineaDelCorreo` y `admin` (`esAdmin` de quien mira: solo con true ve si a alguien no le llegó).
 */
export const pastillaDelEnvio = ({
  tipo, fecha_edicion, correo, envios = [], reenvios = [], lista = [], correoDelBot = null, envioActivo, ahora, calendario, admin
}) => pastillaDe(situacionDelEnvio({
  tipo, fecha_edicion, correo, envios, reenvios, lista, correoDelBot, envioActivo, ahora, calendario
}), correoDelBot, admin);

/**
 * El envío del recibo, en el 201 y en el 200 (spec, 11): `{ estado, programado_at, texto }` con el estado de ese momento (una
 * que sigue con reintentos y ya salió, «enviada»; una que espera, «programada»), el instante de la corrida en que sale solo si
 * está programada con el envío prendido, y el texto de la sección 6, con el motivo de una no enviada en presente. Un piloto,
 * `{ estado: 'piloto', programado_at: null, texto: 'Los pilotos no se envían por correo.' }`: la sección 11 lo cuenta entre los
 * textos del recibo y el bot lo lee para su copia.
 */
export const envioDelRecibo = ({ tipo, fecha_edicion, correo, envios = [], envioActivo, ahora, calendario }) => {
  if (tipo !== 'regular') return { estado: 'piloto', programado_at: null, texto: LINEAS.piloto };
  // Una regular sin fila de correo no pasa después de esta entrega (toda regular la recibe al llegar, en la misma transacción):
  // solo una archivada antes, si el bot la vuelve a mandar. Por las dudas, sin envío
  if (correo == null) return null;
  const situacion = situacionDelEnvio({
    tipo, fecha_edicion, correo, envios, reenvios: [], lista: [], correoDelBot: null, envioActivo, ahora, calendario
  });
  let { estado } = situacion;
  if (estado === 'en_curso') estado = situacion.clase === 'enviada' ? 'enviada' : 'programada';
  return {
    estado,
    programado_at: situacion.clase === 'programada' ? instanteDeSalida(situacion.salida) : null,
    texto: situacion.clase === 'no_enviada'
      ? porMotivo(NO_SE_ENVIA, situacion.motivo, 'No se envía por correo.')
      : lineaDe(situacion, null)
  };
};

// Para administración (secciones 6, 9 y 12)

/**
 * La fila de una persona al armar el envío automático, con la lista de la primera corrida que lo manda (spec, 5):
 * `{ estado, error }`. Inactiva o sin un email válido, omitida (con su motivo en `error`, que lee `textoDeLaPersona`); de
 * licencia oficial ese día, «licencia», sin reintento; si no, pendiente. Ante la duda no le llega: pendiente solo con `activa` y
 * `emailValido` en true y `deLicencia` en false.
 */
export const envioInicial = ({ activa, emailValido, deLicencia }) => {
  if (activa !== true) return { estado: 'omitido', error: MENSAJES_CORREO.inactiva };
  if (emailValido !== true) return { estado: 'omitido', error: MENSAJES_CORREO.sinEmail };
  return deLicencia === false ? { estado: 'pendiente', error: null } : { estado: 'licencia', error: null };
};

const OMITIDA = new Map([
  [MENSAJES_CORREO.sinEmail, 'No se envió: no tenía un email válido'],
  [MENSAJES_CORREO.inactiva, 'No se envió: ya no estaba activa']
]);

// «No se pudo enviar (1 intento)», «… (3 intentos)»
const noSePudoCon = (intentos) => `No se pudo enviar (${intentos} ${intentos === 1 ? 'intento' : 'intentos'})`;

/**
 * El estado de una persona en la caja del correo (spec, 12): `{ texto, mal }`, con `mal` en true si no le llegó (todavía o ya
 * no): «Enviado el 10/11 a las 8:05», «No se envió: de licencia», «No se pudo enviar (3 intentos)», «En reintento (1 de 3)»,
 * «Sin confirmar», «Pendiente». Sirve para una fila automática, un reenvío o una prueba (`tipo`): un reenvío o una prueba que
 * falló no se reintenta. `{ vigente }` (Ruling 9): con false, la edición ya no está vigente y una automática pendiente o en
 * reintento ya no sale: «No se pudo enviar (N intentos)», con los que tuvo.
 */
export const textoDeLaPersona = (envio, { vigente } = {}) => {
  if (esAutomatico(envio) && cerradaPor(vigente) && (envio.estado === 'pendiente' || envio.estado === 'fallido')) {
    return { texto: noSePudoCon(intentosDe(envio)), mal: true };
  }
  switch (envio.estado) {
    case 'enviado': {
      const momento = momentoDe(envio.enviado_at);
      return { texto: momento === null ? 'Enviado' : `Enviado el ${diaYMes(momento.fecha)} a las ${momento.hora}`, mal: false };
    }
    case 'licencia': return { texto: 'No se envió: de licencia', mal: true };
    case 'omitido': return { texto: OMITIDA.get(envio.error) ?? 'No se envió', mal: true };
    case 'fallido': {
      if (!esAutomatico(envio)) return { texto: 'No se pudo enviar', mal: true };
      const intentos = intentosDe(envio);
      return intentos >= MAXIMO_DE_INTENTOS
        ? { texto: noSePudoCon(intentos), mal: true }
        : { texto: `En reintento (${intentos} de ${MAXIMO_DE_INTENTOS})`, mal: true };
    }
    case 'enviando': return { texto: 'Sin confirmar', mal: true };
    default: return { texto: 'Pendiente', mal: false };
  }
};

/**
 * La primera línea de la caja del correo de administración (spec, 6 y 12): «Enviada el martes 10/11/2026 a las 8:05, a 2 de 4
 * personas.», con las personas en reintento detrás; a nadie, por qué; sin filas, lo que espera o por qué no se envió. `tipo` es
 * opcional (sin él, una regular); `reenvios`, los de la edición (un reenvío a quien había fallado cuenta como que le llegó).
 * Como en la línea, lo que pasó lo dicen los estados: sin una hora que se pueda leer, «Enviada a 2 de 4 personas.», y «con un
 * reenvío» solo cuando ninguna fila automática salió. `vigente` (Ruling 9): con false, la edición cerró y nadie queda en
 * reintento.
 */
export const resumenDelCorreo = ({ tipo, correo, envios = [], reenvios = [], vigente }) => {
  if (tipo === 'piloto') return LINEAS.piloto;
  if (correo == null) return LINEAS.sinEnvio;
  const filas = automaticosDe(envios);
  if (filas.length === 0) {
    if (correo.estado === 'programada') return 'Todavía no salió.';
    if (salioSola(filas, correo)) return conLaHora('Enviada por correo', correo.enviada_at);
    return porMotivo(NO_ENVIADA, correo.motivo, 'No se envió.');
  }
  const cuenta = cuentaDe(filas, reenvios, vigente);
  const reintento = cuenta.enReintento > 0 ? ` ${personas(cuenta.enReintento)} en reintento.` : '';
  if (cuenta.recibieron > 0) {
    const a = cuenta.recibieron === cuenta.total ? personas(cuenta.total) : `${cuenta.recibieron} de ${personas(cuenta.total)}`;
    if (!salioSola(filas, correo)) return `Le llegó a ${a} con un reenvío.${reintento}`;
    const primero = primerEnvio(filas, correo);
    return primero === null ? `Enviada a ${a}.${reintento}` : `Enviada el ${diaYHora(momentoDe(primero))}, a ${a}.${reintento}`;
  }
  if (estadoDeLaEdicion(filas, reenvios, { vigente }) === null) return `Todavía no le llegó a nadie.${reintento}`;
  if (cuenta.esperaban === 0) return LINEAS.nadie;
  return cuenta.sinConfirmar > 0 ? 'No se pudo confirmar a quién le llegó.' : 'No se pudo enviar: no le llegó a nadie.';
};

/**
 * Si administración puede «Reenviar» una edición (spec, 9): solo una regular cuyo envío automático terminó, así un reenvío nunca
 * se cruza con un envío automático. No se puede mientras está programada sin filas ni mientras alguna persona está pendiente o
 * en reintento (estadoDeLaEdicion da null). Una que quedó «enviando» por un corte sí: no se reintenta nunca, y reenviarla es la
 * forma de que le llegue (mientras corre una corrida, el candado ya responde 409). La página muestra el botón con esto mismo.
 * `vigente` (Ruling 9): con false, la edición ya no está vigente y no sale sola (lo que quedaba abierto cerró, y una programada
 * sin filas queda «vieja» en la corrida): se puede.
 */
export const sePuedeReenviar = ({ tipo, correo, envios = [], vigente }) => {
  if (tipo !== 'regular') return false;
  const filas = automaticosDe(envios);
  if (filas.length > 0) return estadoDeLaEdicion(filas, [], { vigente }) !== null;
  return correo?.estado !== 'programada' || cerradaPor(vigente);
};

// La respuesta de «Reenviar» (spec, 9): a cuántas personas salió y a cuántas no, sin el texto de nodemailer
export const textoDelReenvio = ({ enviados, fallidos }) => {
  if (enviados === 0) return 'No se pudo reenviar: no le llegó a nadie.';
  if (fallidos === 0) return `Se reenvió a ${personas(enviados)}.`;
  const noLlego = fallidos === 1 ? 'no le llegó' : 'no les llegó';
  return `Se reenvió a ${enviados} de ${personas(enviados + fallidos)}: a ${fallidos} ${noLlego}.`;
};

// Lo que validan y lo que contestan las rutas de administración (secciones 9 y 12)

/**
 * La lista de `PUT …/correo/destinatarios` (`usuarios`): los ids (idPositivo: un número o un texto de dígitos), en el orden
 * recibido, o null si no es un array, si algún elemento no es un id o si uno se repite (no se descarta en silencio: la página
 * manda cada persona una vez). Que sean usuarios activos lo mira la base, en la transacción que la guarda.
 */
export const listaDePersonas = (valor) => {
  if (!Array.isArray(valor)) return null;
  const ids = [];
  const vistos = new Set();
  for (const elemento of valor) {
    const id = idPositivo(elemento);
    if (id === null || vistos.has(id)) return null;
    vistos.add(id);
    ids.push(id);
  }
  return ids;
};

// A quién se reenvía (`a` de `POST …/reenvios`): 'todas', el id de una persona (idPositivo) o null
export const aQuienReenviar = (valor) => (valor === 'todas' ? 'todas' : idPositivo(valor));

/**
 * Hasta cuándo está de licencia una persona, en la configuración del correo: «De licencia hasta el 30/11» (con el año si no es
 * el de hoy: «… hasta el 05/01/2027»), o null sin una fecha. Solo la fecha: el tipo de una licencia es de su dueño.
 */
export const textoDeLaLicencia = (hasta, hoy) => {
  if (!esFechaIso(hasta)) return null;
  return `De licencia hasta el ${hasta.slice(0, 4) === String(hoy).slice(0, 4) ? diaYMes(hasta) : formatoCorto(hasta)}`;
};

// Por qué no salió un reenvío omitido (sin un email válido)
const OMITIDO_A_MANO = new Map([[MENSAJES_CORREO.sinEmail, 'no tenía un email válido']]);

/**
 * Un reenvío o una prueba en la caja del correo (spec, 12), de su fila (`{ tipo, estado, nombre, enviado_at, creado_at, error
 * }`): «Reenviada a PruebaDos Ejemplo el 25/11 a las 10:12.», «Prueba enviada a …», «No se pudo reenviar a … el …», «No se pudo
 * enviar la prueba a …», «No se pudo confirmar el reenvío a … del …». La hora es la del envío si salió y, si no, la del pedido;
 * sin una que se pueda leer, sin la hora.
 */
export const textoDelEnvioAMano = ({ tipo, estado, nombre, enviado_at, creado_at, error }) => {
  const prueba = tipo === 'prueba';
  const momento = momentoDe(estado === 'enviado' && momentoDe(enviado_at) !== null ? enviado_at : creado_at);
  // ' el 25/11 a las 10:12' (o ' del …'); sin la hora, nada
  const cuando = (articulo) => (momento === null ? '' : ` ${articulo} ${diaYMes(momento.fecha)} a las ${momento.hora}`);
  if (estado === 'enviado') return `${prueba ? 'Prueba enviada' : 'Reenviada'} a ${nombre}${cuando('el')}.`;
  if (estado === 'enviando') return `No se pudo confirmar ${prueba ? 'la prueba' : 'el reenvío'} a ${nombre}${cuando('del')}.`;
  const motivo = estado === 'omitido' && OMITIDO_A_MANO.has(error) ? `: ${OMITIDO_A_MANO.get(error)}` : '';
  return `No se pudo ${prueba ? 'enviar la prueba' : 'reenviar'} a ${nombre}${cuando('el')}${motivo}.`;
};

// La respuesta de `PUT …/correo/envio`
export const textoDelInterruptor = (activo) => `El envío automático quedó ${activo === true ? 'prendido' : 'apagado'}.`;

// La respuesta de `PUT …/correo/destinatarios`, con cuántas personas quedaron
export const textoDeLaListaGuardada = (cantidad) => (cantidad === 0
  ? 'Se guardó la lista: no lo recibe nadie.'
  : `Se guardó la lista: lo ${cantidad === 1 ? 'recibe' : 'reciben'} ${personas(cantidad)}.`);

// El pie de «Quién lo recibe» (sección 13), con cuántas personas activas lo reciben. La página tiene una copia para contar
// mientras se tilda, atada por un test de paridad (tests/dato-quincena-frontend.test.js)
export const textoDeLosQueReciben = (cantidad) => (cantidad === 0
  ? 'Todavía no lo recibe nadie.'
  : `Lo ${cantidad === 1 ? 'recibe' : 'reciben'} ${personas(cantidad)}.`);

// Las próximas ediciones (sección 12)

const FIN_DE_SEMANA = Object.freeze(['sábado', 'domingo']);

// El nombre del feriado de una fecha: uno de los 9 fijos o una fila de la tabla que rige ese año. Sin ninguno, null
const nombreDelFeriado = (fecha, filas) => {
  const mesYDia = fecha.slice(5);
  if (Object.hasOwn(NOMBRES_DE_LOS_FIJOS, mesYDia)) return NOMBRES_DE_LOS_FIJOS[mesYDia];
  const anio = Number(fecha.slice(0, 4));
  const fila = listaDe(filas).find((otra) => fechaEnElAnio(otra, anio) === fecha);
  return typeof fila?.nombre === 'string' ? fila.nombre : null;
};

// 'el lunes 23/11, Día de la Soberanía Nacional' (sin nombre, 'el lunes 23/11')
const diaConNombre = (fecha, filas) => {
  const dia = `el ${diaDeLaSemana(fecha)} ${diaYMes(fecha)}`;
  const nombre = nombreDelFeriado(fecha, filas);
  return nombre === null ? dia : `${dia}, ${nombre}`;
};

// Por qué se corre: los días de semana no hábiles desde la edición hasta la víspera de la salida (el fin de semana no hace
// falta decirlo, salvo que la edición caiga en uno)
const motivoDelCorrimiento = (edicion, sale, filas) => {
  const dias = [];
  for (let fecha = edicion; fecha < sale; fecha = sumarDias(fecha, 1)) {
    if (!FIN_DE_SEMANA.includes(diaDeLaSemana(fecha))) dias.push(fecha);
  }
  const nombrados = (dias.length > 0 ? dias : [edicion]).map((fecha) => diaConNombre(fecha, filas));
  return `${nombrados.length === 1 ? 'no es hábil' : 'no son hábiles'} ${enLista(nombrados)}`;
};

const proximaEdicion = (edicion, calendario, filas) => {
  const sale = calendario.proximoDiaHabil(edicion);
  const motivo = sale === edicion ? null : motivoDelCorrimiento(edicion, sale, filas);
  const manana = sinCero(HORA_DE_LA_MANANA);
  return {
    edicion,
    sale,
    motivo,
    edicion_texto: `${diaDeLaSemana(edicion)} ${formatoCorto(edicion)}`,
    texto: motivo === null
      ? `Sale ese día a las ${manana}.`
      : `Sale el ${diaYHora({ fecha: sale, hora: manana })}: ${motivo}.`
  };
};

/**
 * Las próximas ediciones de la serie (spec, 12), cada 14 días desde la última regular (sin ninguna, desde el 09/11/2026, que
 * entra): las `cantidad` primeras de hoy en adelante, cada una con `{ edicion, sale, motivo, edicion_texto, texto }`. `sale` es
 * el primer día hábil desde su fecha (a las 8:05: el bot la archiva antes) y `motivo`, por qué se corre, con el nombre de cada
 * feriado (`filasDeFeriados`, las de `filasDeFeriados()`, y los 9 fijos), o null si sale ese día. Con la tabla caída
 * (`calendario.error !== null`), ninguna: no se estima con los 9 fijos.
 */
export const proximasEdiciones = ({ ultimaRegular, hoy, calendario, filasDeFeriados, cantidad = 4 }) => {
  if (calendario.error !== null) return [];
  let edicion = esFechaIso(ultimaRegular) ? sumarDias(ultimaRegular, CADENCIA) : PRIMERA_EDICION;
  while (edicion < hoy) edicion = sumarDias(edicion, CADENCIA);
  const proximas = [];
  for (let i = 0; i < cantidad; i++, edicion = sumarDias(edicion, CADENCIA)) {
    proximas.push(proximaEdicion(edicion, calendario, filasDeFeriados));
  }
  return proximas;
};

// La corrida y Correos → Estado (secciones 8 y 13)

// El largo de dato_quincena_correo_config.corrida_resultado
const LARGO_DEL_RESULTADO = 500;
const mails = (n) => (n === 1 ? '1 mail' : `${n} mails`);

// Por qué una corrida no mandó nada antes de mirar a quién: en el orden en que lo decide la corrida
const SIN_SALIR = Object.freeze({
  apagado: 'el envío automático está apagado',
  sin_feriados: 'no se pudieron leer los feriados: lo que esperaba sale en la corrida siguiente',
  no_habil: 'no era día hábil',
  sin_lista: 'no había nadie en la lista'
});

/**
 * Lo que anota una corrida (corrida_resultado), la frase que sigue a «la última corrida fue el 24/11 a las 8:05: »: «mandó 4
 * mails.», «mandó 3 mails y 1 no se pudo enviar.», «no había nada para mandar.» o, si no salió nada por algo de antes de mirar
 * a quién (`motivo`: 'apagado', 'sin_feriados', 'no_habil' o 'sin_lista'), «no salió nada, porque …». `problemas`: los textos
 * fijos de lo que falló en la corrida (no un envío, que se cuenta en `fallidos`), detrás y una vez cada uno; sin nada enviado,
 * «no se pudo completar.» delante. Cabe en la columna.
 */
export const textoDelResultadoDelCorreo = ({ motivo = null, enviados = 0, fallidos = 0, problemas = [] }) => {
  const unicos = [...new Set(listaDe(problemas))];
  let frase;
  if (typeof motivo === 'string' && Object.hasOwn(SIN_SALIR, motivo)) frase = `no salió nada, porque ${SIN_SALIR[motivo]}.`;
  else if (enviados > 0) {
    const noSalieron = fallidos === 1 ? ' y 1 no se pudo enviar' : ` y ${fallidos} no se pudieron enviar`;
    frase = `mandó ${mails(enviados)}${fallidos > 0 ? noSalieron : ''}.`;
  } else if (fallidos > 0) frase = fallidos === 1 ? 'no se pudo enviar 1 mail.' : `no se pudieron enviar ${mails(fallidos)}.`;
  else frase = unicos.length > 0 ? 'no se pudo completar.' : 'no había nada para mandar.';
  return [frase, ...unicos].join(' ').slice(0, LARGO_DEL_RESULTADO);
};

// '24/11 a las 8:05' de '2026-11-24 08:05' (con los segundos o sin ellos); si no se puede leer, la raya
const diaYHoraCortos = (valor) => {
  const momento = momentoDe(valor);
  return momento === null ? '—' : `${diaYMes(momento.fecha)} a las ${momento.hora}`;
};

const ENCABEZADO = 'El dato de la quincena:';

/**
 * La línea de Correos → Estado (spec, 13), de la última corrida (`{ inicio, fin, resultado, con_errores, en_curso }`, con
 * `inicio` y `fin` 'AAAA-MM-DD HH:MM', o null si nunca corrió): «El dato de la quincena: la última corrida fue el 24/11 a las
 * 8:05: mandó 4 mails.», «… hay una corrida en curso, desde el 24/11 a las 8:05.», «… la última corrida, el 24/11 a las 8:05,
 * no terminó.» (sin fin y sin el candado tomado: se cortó) o «… sin registro de corridas todavía.».
 */
export const textoDeLaCorridaDelCorreo = (corrida) => {
  if (corrida == null) return `${ENCABEZADO} sin registro de corridas todavía.`;
  const cuando = diaYHoraCortos(corrida.inicio);
  if (corrida.en_curso === true) return `${ENCABEZADO} hay una corrida en curso, desde el ${cuando}.`;
  if (corrida.fin == null) return `${ENCABEZADO} la última corrida, el ${cuando}, no terminó.`;
  const linea = `${ENCABEZADO} la última corrida fue el ${cuando}`;
  return typeof corrida.resultado === 'string' && corrida.resultado !== '' ? `${linea}: ${corrida.resultado}` : `${linea}.`;
};

/**
 * Los avisos de Correos → Estado (spec, 13), de la última corrida y de `sinLlegar` (`{ fecha_edicion, personas }`: las de la
 * última edición que salió sola que no la recibieron, ni con un reenvío, después de los 3 intentos o porque la edición dejó de
 * estar vigente, Ruling 9; `personasSinLlegar`), o null. El texto no dice cuántos intentos: con el Ruling 9 pueden ser menos:
 * `dato-quincena-con-errores` si la última corrida terminada falló en algo de la corrida (un envío que se reintenta no cuenta:
 * el aviso de la persona llega recién después del tercer intento, decisión 5 del usuario) y `dato-quincena-no-llego` mientras
 * a alguien no le llegó, que no depende de la última corrida: se va con un reenvío que le llega o con una edición más nueva.
 */
export const alertasDelCorreo = ({ corrida, sinLlegar }) => {
  const alertas = [];
  if (corrida?.con_errores === true && corrida.en_curso !== true) {
    alertas.push({
      tipo: 'dato-quincena-con-errores', nivel: 'error',
      mensaje: `La última corrida del dato de la quincena (el ${diaYHoraCortos(corrida.inicio)}) terminó con errores: `
        + `${corrida.resultado ?? 'sin detalle'}`
    });
  }
  if (sinLlegar != null && sinLlegar.personas > 0) {
    // «no le llegó a 1 persona: se le puede…» y «no les llegó a 2 personas: se les puede…»
    const les = sinLlegar.personas === 1 ? 'le' : 'les';
    alertas.push({
      tipo: 'dato-quincena-no-llego', nivel: 'error',
      mensaje: `El dato de la quincena del ${formatoCorto(sinLlegar.fecha_edicion)} no ${les} llegó a `
        + `${personas(sinLlegar.personas)}: se ${les} puede reenviar desde la edición.`
    });
  }
  return alertas;
};

/**
 * A cuántas personas no les llegó una edición que salió sola (spec, 13), de todas sus filas (`enviosDe`: automáticas, reenvíos y
 * pruebas, con su `id` y su `tipo`), su fecha y hoy: las automáticas que fallaron para siempre (fallidas con los 3 intentos o, si
 * la edición ya no está vigente, también las que quedaron en reintento o pendientes: Ruling 9) sin un reenvío posterior que le
 * haya llegado a esa persona. De licencia, omitida o sin confirmar no cuentan: no son fallas que reenviar resuelva sola.
 */
export const personasSinLlegar = ({ fecha_edicion, envios = [], hoy }) => {
  const vigente = estaVigente(fecha_edicion, hoy);
  const filas = listaDe(envios);
  const reenviosQueLlegaron = filas.filter((fila) => fila.tipo === 'reenvio' && fila.estado === 'enviado');
  const fallaParaSiempre = (fila) => (fila.estado === 'fallido' && intentosDe(fila) >= MAXIMO_DE_INTENTOS)
    || ((fila.estado === 'fallido' || fila.estado === 'pendiente') && !vigente);
  return automaticosDe(filas)
    .filter((fila) => fallaParaSiempre(fila)
      && !reenviosQueLlegaron.some((otra) => otra.usuario_id === fila.usuario_id && Number(otra.id) > Number(fila.id)))
    .length;
};

// La advertencia de Correos → Estado cuando no se pudo leer lo del dato de la quincena: el resto del Estado responde igual
export const alertaSinEstadoDelCorreo = () => ({
  tipo: 'dato-quincena-sin-estado', nivel: 'advertencia', mensaje: 'No se pudo leer la última corrida del dato de la quincena.'
});

// El mail (sección 10)

// Lo que el detalle trae para la página y el mail no usa: la franja reemplaza al rótulo de la propuesta
const FUERA_DEL_MAIL = Object.freeze(['orden_texto', 'para_copiar', 'borrador_para_copiar']);

/**
 * Lo que recibe la plantilla del mail (spec, 10), de `detalleDeLaEdicion` y la fecha de la edición: el asunto «Dato de la
 * Quincena - DD/MM/AAAA» (con «[PRUEBA] » delante en una prueba), el primer nombre de `nombreCompleto` (null sin nombre), el
 * título (el asunto sin la marca de la prueba), «Edición N.º N» (en un piloto, su marca), la bajada con la cantidad, la agenda
 * del detalle (con su etiqueta) y las propuestas en su orden con su franja «Propuesta N de M», la dirección de la edición y el
 * nombre del bot para la nota del pie (la plantilla no lo nombra: vive solo en NOMBRE_DEL_BOT, spec 2.10).
 * Copia todo: el detalle no cambia.
 */
export const modeloDelMail = ({ detalle, fecha_edicion, nombreCompleto, url, prueba }) => {
  const titulo = `Dato de la Quincena - ${formatoCorto(fecha_edicion)}`;
  const primerNombre = String(nombreCompleto ?? '').trim().split(/\s+/)[0];
  const total = detalle.propuestas.length;
  return {
    asunto: prueba === true ? `[PRUEBA] ${titulo}` : titulo,
    primerNombre: primerNombre === '' ? null : primerNombre,
    titulo,
    numero: detalle.numero != null ? `Edición ${detalle.numero}` : (detalle.marca ?? null),
    bajada: `${textoDeCantidad(total)} de comunicación que armó ${NOMBRE_DEL_BOT}. Son internas: todavía no están aprobadas ni `
      + 'publicadas.',
    agenda: structuredClone(detalle.agenda),
    propuestas: detalle.propuestas.map((propuesta, i) => ({
      franja: `Propuesta ${i + 1} de ${total}`,
      ...structuredClone(Object.fromEntries(Object.entries(propuesta).filter(([clave]) => !FUERA_DEL_MAIL.includes(clave))))
    })),
    url: url ?? `${RPAD_URL}/dato-quincena.html?id=${detalle.id}`,
    nombreDelBot: NOMBRE_DEL_BOT
  };
};
