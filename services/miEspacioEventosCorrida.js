/**
 * La agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, secciones 3 y 5): la corrida de los recordatorios. La llama
 * una Tarea Cron cada media hora (`GET /api/cron/eventos`, controllers/notificacionesController.js).
 * - Con su propio candado (`conBloqueo` de services/notasDigitales.js con BLOQUEO_EVENTOS, nunca el de las Notas Digitales:
 *   la de las 8:30 puede coincidir con la de las 8:15). Si otra corrida lo tiene, termina «ocupada» sin escribir nada.
 * - Anota cada corrida en mi_espacio_eventos_corridas (una sola fila, id = 1), también en un día que no es hábil: así
 *   Correos → Estado sabe que la Tarea Cron llama. Si anotar falla, va a la consola y la corrida sigue.
 * - Solo manda en un día hábil, con los feriados de la tabla leídos en cada corrida (un feriado cargado después mueve el
 *   aviso: nunca se guarda). Qué sale lo decide `recordatoriosQueTocan` (services/miEspacioEventosReglas.js), con los
 *   atrasados solo de 07:00 a 20:00.
 * - Nunca dos veces: cada recordatorio se reserva antes de mandarlo (un INSERT IGNORE sobre la clave única de los
 *   recordatorios, o, si falló y terminó, un UPDATE que lo vuelve a reservar) y se sigue solo si la reserva fue de esta
 *   corrida. Uno que no salió queda con success = 0 y se reintenta en la próxima corrida, en la misma fila, mientras el
 *   evento no haya empezado; uno reservado y sin terminar (pudo haber salido) no se repite.
 * - Uno por persona, siempre con `to: [email]` (sin destinatario, sendEmail manda a las casillas por defecto de la DGMIT):
 *   `recordatoriosQueTocan` ya deja solo los emails que pasan `emailValido`.
 * - Un error con un recordatorio (armar el email, reservarlo o anotarlo) va a los errores y la corrida sigue con los demás;
 *   uno de toda la corrida (los feriados o los eventos que no se pueden leer), también, y la corrida se anota igual. En la
 *   consola, solo la pila: los errores de mysql2 traen la consulta armada con sus valores.
 * Los momentos se escriben con `ahoraArgentina()`, nunca NOW() de la base.
 */
import pool from '../config/database.js';
import { conBloqueo } from './notasDigitales.js';
import { sendEmail } from './emailService.js';
import { eventoRecordatorioTemplate } from './emailTemplates.js';
import { eventosParaLaCorrida } from './miEspacioEventosDatos.js';
import { feriadosEntre } from './feriadosDatos.js';
import { esDiaHabilCon } from './feriadosReglas.js';
import {
  recordatoriosQueTocan, textoDelResultadoDeEventos, BLOQUEO_EVENTOS, VENTANA_DE_LA_CORRIDA
} from './miEspacioEventosReglas.js';
import { ahoraArgentina, sumarDias } from './notasDigitalesCalendario.js';

// Los feriados que lee cada corrida, alrededor de hoy: hacia atrás, los del aviso de «el día hábil anterior» de un evento de
// hoy (con varios días seguidos que no son hábiles); hacia adelante, los de la ventana de los eventos y un día más
const DIAS_DE_FERIADOS_ANTES = 31;
const DIAS_DE_FERIADOS_DESPUES = VENTANA_DE_LA_CORRIDA + 1;

// Lo que devuelve una corrida antes de empezar (y una «ocupada»: `dia_habil` null, no se miró)
const sinNada = () => ({ ocupada: false, dia_habil: null, enviados: 0, fallidos: 0, errores: [] });
const mensajeDe = (error) => String(error?.message ?? error);

// Anota el inicio de la corrida: la fila 1, con el inicio y sin fin ni resultado. Si falla, la consola
const anotarInicio = async (ahora) => {
  try {
    await pool.query(
      `INSERT INTO mi_espacio_eventos_corridas (id, inicio_at, fin_at, resultado, con_errores) VALUES (1, ?, NULL, NULL, 0)
       ON DUPLICATE KEY UPDATE inicio_at = ?, fin_at = NULL, resultado = NULL, con_errores = 0`,
      [ahora, ahora]
    );
  } catch (error) {
    console.error('No se pudo anotar el inicio de la corrida de los recordatorios:', error?.stack ?? error);
  }
};

// Anota el fin: el momento, el resultado (textoDelResultadoDeEventos) y si hubo fallidos o errores. Solo en la fila de la
// corrida que empezó en `inicio` (si su inicio no se pudo anotar, no completa otra). Si falla, la consola
const anotarFin = async (inicio, resultado) => {
  try {
    const conErrores = resultado.fallidos > 0 || resultado.errores.length > 0;
    await pool.query(
      'UPDATE mi_espacio_eventos_corridas SET fin_at = ?, resultado = ?, con_errores = ? WHERE id = 1 AND inicio_at = ?',
      [ahoraArgentina(), textoDelResultadoDeEventos(resultado), conErrores ? 1 : 0, inicio]
    );
  } catch (error) {
    console.error('No se pudo anotar el fin de la corrida de los recordatorios:', error?.stack ?? error);
  }
};

// La fila de un recordatorio: el evento, la persona y el inicio del evento (`para`, 'AAAA-MM-DD HH:MM')
const DE_LA_FILA = "evento_id = ? AND usuario_id = ? AND tipo = 'recordatorio' AND para = ?";
const claveDe = ({ evento_id: eventoId, usuario_id: usuarioId, para }) => [eventoId, usuarioId, para];

/**
 * Reserva un recordatorio antes de mandarlo: true si la reserva es de esta corrida (affectedRows 1), y entonces la fila queda
 * con `enviado_at` NULL. Uno nuevo, con un INSERT IGNORE (si ya hay una fila para esa persona y ese `para`, la clave única
 * lo ignora); un reintento, con un UPDATE que lo toma solo si sigue fallido y terminado. Tira si la base falla.
 */
const reservar = async (recordatorio) => {
  const [respuesta] = recordatorio.reintento
    ? await pool.query(
      `UPDATE mi_espacio_evento_envios SET enviado_at = NULL WHERE ${DE_LA_FILA} AND success = 0 AND enviado_at IS NOT NULL`,
      claveDe(recordatorio)
    )
    : await pool.query(
      `INSERT IGNORE INTO mi_espacio_evento_envios (evento_id, usuario_id, tipo, para, enviado_at, success)
       VALUES (?, ?, 'recordatorio', ?, NULL, 0)`,
      claveDe(recordatorio)
    );
  return respuesta.affectedRows === 1;
};

// Anota cómo salió un recordatorio reservado: success y enviado_at (ahora, en Argentina). Tira si la base falla
const terminar = (recordatorio, success) => pool.query(
  `UPDATE mi_espacio_evento_envios SET success = ?, enviado_at = ? WHERE ${DE_LA_FILA} AND enviado_at IS NULL`,
  [success ? 1 : 0, ahoraArgentina(), ...claveDe(recordatorio)]
);

// Manda un recordatorio y lo anota en `resultado`. `email`: el ya armado de su evento, o null si no se pudo armar
const mandarUno = async (recordatorio, email, resultado) => {
  const { evento_id: eventoId, usuario_id: usuarioId } = recordatorio;
  const conError = (texto, error) => {
    console.error(texto, error?.stack ?? error);
    resultado.errores.push({ evento_id: eventoId, usuario_id: usuarioId, error: mensajeDe(error) });
  };
  if (email === null) {
    resultado.errores.push({ evento_id: eventoId, usuario_id: usuarioId, error: 'No se pudo preparar el email' });
    return;
  }

  let reservado;
  try {
    reservado = await reservar(recordatorio);
  } catch (error) {
    conError('Error al reservar el recordatorio de un evento:', error);
    return;
  }
  // La tomó otra corrida, o ya salió: no se manda
  if (!reservado) return;

  const envio = await sendEmail({ subject: email.subject, html: email.html, text: email.text, to: [recordatorio.email] });
  const success = envio?.success === true;
  if (success) resultado.enviados += 1;
  else resultado.fallidos += 1;
  try {
    await terminar(recordatorio, success);
  } catch (error) {
    // Queda reservado y sin terminar: no se repite (pudo haber salido)
    conError('Error al anotar el recordatorio de un evento:', error);
  }
};

// El email del recordatorio de un evento, el mismo para todos los que lo reciben, contado desde hoy (el día real del envío).
// null si no se pudo armar (a la consola, con la pila)
const emailDelRecordatorio = (evento, hoy) => {
  try {
    return eventoRecordatorioTemplate({ evento, hoy });
  } catch (error) {
    console.error('Error al preparar el recordatorio de un evento:', error?.stack ?? error);
    return null;
  }
};

// Lo de la corrida con el candado tomado: los feriados, si hoy es hábil y, si lo es, los recordatorios que tocan
const mandarLosQueTocan = async (ahora, resultado) => {
  const hoy = ahora.slice(0, 10);
  const feriados = await feriadosEntre(sumarDias(hoy, -DIAS_DE_FERIADOS_ANTES), sumarDias(hoy, DIAS_DE_FERIADOS_DESPUES));
  resultado.dia_habil = esDiaHabilCon(hoy, feriados);
  if (!resultado.dia_habil) return;

  const eventos = await eventosParaLaCorrida(hoy);
  const porId = new Map(eventos.map((evento) => [evento.id, evento]));
  const emails = new Map();
  for (const recordatorio of recordatoriosQueTocan(eventos, { ahora, feriados })) {
    const eventoId = recordatorio.evento_id;
    if (!emails.has(eventoId)) emails.set(eventoId, emailDelRecordatorio(porId.get(eventoId), hoy));
    await mandarUno(recordatorio, emails.get(eventoId), resultado);
  }
};

/**
 * Una corrida de los recordatorios, en el momento `ahora` ('AAAA-MM-DD HH:MM:SS' de Argentina; de entrada,
 * `ahoraArgentina()`). Devuelve `{ ocupada, dia_habil, enviados, fallidos, errores: [{ evento_id, usuario_id, error }] }`:
 * - con el candado de otra corrida: `ocupada: true`, `dia_habil` null y nada más, sin escribir nada (ni el inicio);
 * - si no: anota el inicio (`inicio_at` = ahora), lee los feriados de hoy − 31 a hoy + 16 y, en un día hábil, manda los
 *   recordatorios que tocan (`enviados`: los que salieron; `fallidos`: los que sendEmail no pudo mandar, que se reintentan) y
 *   anota el fin, con su resultado. Un error con un recordatorio (sin evento ni persona, uno de toda la corrida, con
 *   `dia_habil` null si fue antes de saber si era hábil) va a `errores`.
 * Tira solo si no se puede tomar el candado (la base no responde): lo demás va a los errores o a la consola.
 * @returns {Promise<{ ocupada: boolean, dia_habil: boolean | null, enviados: number, fallidos: number, errores: object[] }>}
 */
export const ejecutarRecordatoriosDeEventos = async ({ ahora = ahoraArgentina() } = {}) => {
  const corrida = await conBloqueo(async () => {
    const resultado = sinNada();
    await anotarInicio(ahora);
    try {
      await mandarLosQueTocan(ahora, resultado);
    } catch (error) {
      console.error('Error en la corrida de los recordatorios:', error?.stack ?? error);
      resultado.errores.push({ evento_id: null, usuario_id: null, error: mensajeDe(error) });
    }
    await anotarFin(ahora, resultado);
    return resultado;
  }, BLOQUEO_EVENTOS);
  return corrida.ocupado ? { ...sinNada(), ocupada: true } : corrida.resultado;
};

/**
 * La última corrida de los recordatorios, para Correos → Estado: `{ inicio, fin, resultado, con_errores, en_curso }`, con
 * `inicio` y `fin` 'AAAA-MM-DD HH:MM' (sin los segundos; `fin` null si no terminó), `con_errores` booleano y `en_curso` si
 * no terminó y el candado está tomado (si no, se interrumpió). null si nunca corrió. `conexion`: el pool, u otra.
 * @returns {Promise<{ inicio: string, fin: string | null, resultado: string | null, con_errores: boolean,
 *   en_curso: boolean } | null>}
 */
export const leerCorridaDeEventos = async (conexion = pool) => {
  const [[fila]] = await conexion.query(
    `SELECT DATE_FORMAT(inicio_at, '%Y-%m-%d %H:%i') AS inicio, DATE_FORMAT(fin_at, '%Y-%m-%d %H:%i') AS fin, resultado,
       con_errores, IS_FREE_LOCK(?) AS bloqueo_libre
     FROM mi_espacio_eventos_corridas WHERE id = 1`,
    [BLOQUEO_EVENTOS]
  );
  if (!fila?.inicio) return null;
  const fin = fila.fin ?? null;
  return {
    inicio: fila.inicio,
    fin,
    resultado: fila.resultado ?? null,
    con_errores: Number(fila.con_errores) === 1,
    en_curso: fin === null && Number(fila.bloqueo_libre) !== 1
  };
};
