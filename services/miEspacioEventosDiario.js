/**
 * El aviso diario de la agenda (spec 2026-11-04-agenda-aviso-y-dependencia, 6): la corrida. Viaja en las dos Tareas Cron que ya existen, a las
 * 14:00 (`momento` 'tarde') y a las 8:05 ('manana'), y no frena nada de ellas, ni al revés.
 * - Con su propio candado (`rpad_mi_espacio_diario`), ni el de las Notas Digitales ni el de los recordatorios: con otra corrida en marcha,
 *   termina «ocupada» sin escribir nada, y no es un error.
 * - Sin poder leer los feriados (`calendario.error`), no manda: lo sin informar de los superiores sale en la corrida siguiente. Un día que no
 *   es hábil tampoco manda. Las dos se anotan.
 * - Nunca dos veces, a lo sumo una, como los recordatorios: se reserva el mail de cada persona (`mi_espacio_diario_envios`), con un INSERT
 *   IGNORE sobre la clave única o, uno que falló y terminó, con un UPDATE que lo vuelve a tomar, y se manda solo si la reserva es de esta
 *   corrida. Una reserva sin terminar no se repite: pudo haber salido.
 * - Uno por persona, siempre con `to: [email]`: sin destinatario, sendEmail manda a las casillas por defecto de la DGMIT. El texto de
 *   nodemailer no va al resultado: puede traer la dirección.
 * - `avisoDiarioAislado` **nunca rechaza**: a las 8:05 corre sin esperarlo, y en Node 22 un rechazo sin manejar tumba el proceso, con las
 *   Notas a mitad. Anota cada corrida en `mi_espacio_eventos_corridas`, la fila 2 (la 1 es la de los recordatorios).
 * Los momentos se escriben con `ahoraArgentina()`, nunca NOW() de la base.
 */
import pool from '../config/database.js';
import { conBloqueo } from './notasDigitales.js';
import { paso14 } from './notasFirmaDigital.js';
import { sendEmail } from './emailService.js';
import { avisoDiarioTemplate } from './emailTemplates.js';
import { emailValido } from './usuariosReglas.js';
import { ahoraArgentina } from './notasDigitalesCalendario.js';
import {
  diasDelAviso, mailDeLaPersona, textoDelResultadoDelDiario, textoDeLaCorridaDelDiario, alertasDeLaCorridaDelDiario
} from './miEspacioEventosDiarioReglas.js';
import {
  usuariosDelAviso, eventosDelAviso, informadosDe, deLicenciaOficial, marcarInformados
} from './miEspacioEventosDiarioDatos.js';

export const BLOQUEO_DIARIO = 'rpad_mi_espacio_diario';
// La fila de mi_espacio_eventos_corridas (la 1 es la de los recordatorios)
const FILA_DEL_DIARIO = 2;
const MENSAJE_SIN_FERIADOS = 'No se pudieron leer los feriados: el aviso diario no salió y lo sin informar sale en la corrida siguiente.';
const MENSAJE_SIN_PREPARAR = 'No se pudo preparar el email';
const MENSAJE_SIN_ENVIAR = 'No se pudo enviar el email';

const sinNada = () => ({ ocupada: false, dia_habil: null, enviados: 0, fallidos: 0, errores: [] });
const mensajeDe = (error) => String(error?.message ?? error);

// Anota el inicio de la corrida, con el fin y el resultado vacíos. Si falla, la consola
const anotarInicio = async (ahora) => {
  try {
    await pool.query(
      `INSERT INTO mi_espacio_eventos_corridas (id, inicio_at, fin_at, resultado, con_errores) VALUES (?, ?, NULL, NULL, 0)
       ON DUPLICATE KEY UPDATE inicio_at = ?, fin_at = NULL, resultado = NULL, con_errores = 0`,
      [FILA_DEL_DIARIO, ahora, ahora]
    );
  } catch (error) {
    console.error('No se pudo anotar el inicio del aviso diario:', error?.stack ?? error);
  }
};

// Anota el fin, con su resultado, solo en la fila de la corrida que empezó en `inicio`. Si falla, la consola
const anotarFin = async (inicio, resultado) => {
  try {
    await pool.query(
      'UPDATE mi_espacio_eventos_corridas SET fin_at = ?, resultado = ?, con_errores = ? WHERE id = ? AND inicio_at = ?',
      [ahoraArgentina(), textoDelResultadoDelDiario(resultado), resultado.fallidos > 0 || resultado.errores.length > 0 ? 1 : 0, FILA_DEL_DIARIO, inicio]
    );
  } catch (error) {
    console.error('No se pudo anotar el fin del aviso diario:', error?.stack ?? error);
  }
};

const DE_LA_FILA = 'usuario_id = ? AND dia = ? AND momento = ?';

// Reserva el mail de una persona: true si la reserva es de esta corrida. Tira si la base falla
const reservar = async (usuarioId, dia, momento) => {
  const [nueva] = await pool.query(
    'INSERT IGNORE INTO mi_espacio_diario_envios (usuario_id, dia, momento, enviado_at, success) VALUES (?, ?, ?, NULL, 0)',
    [usuarioId, dia, momento]
  );
  if (nueva.affectedRows === 1) return true;
  const [reintento] = await pool.query(
    `UPDATE mi_espacio_diario_envios SET enviado_at = NULL WHERE ${DE_LA_FILA} AND success = 0 AND enviado_at IS NOT NULL`,
    [usuarioId, dia, momento]
  );
  return reintento.affectedRows === 1;
};

const terminar = (usuarioId, dia, momento, success) => pool.query(
  `UPDATE mi_espacio_diario_envios SET success = ?, enviado_at = ? WHERE ${DE_LA_FILA} AND enviado_at IS NULL`,
  [success ? 1 : 0, ahoraArgentina(), usuarioId, dia, momento]
);

// Manda el mail de una persona y lo anota en `resultado`. Lo informado se marca solo si salió bien
const mandarUno = async ({ persona, mail, dia, momento }, resultado) => {
  const conError = (texto, error) => {
    console.error(texto, error?.stack ?? error);
    resultado.errores.push({ usuario_id: persona.id, error: mensajeDe(error) });
  };
  let email;
  try {
    email = avisoDiarioTemplate({ persona, mail, hoy: dia });
  } catch (error) {
    console.error('Error al preparar el aviso diario:', error?.stack ?? error);
    resultado.errores.push({ usuario_id: persona.id, error: MENSAJE_SIN_PREPARAR });
    return;
  }
  let reservado;
  try {
    reservado = await reservar(persona.id, dia, momento);
  } catch (error) {
    conError('Error al reservar el aviso diario:', error);
    return;
  }
  // La tomó otra corrida, o ya salió
  if (!reservado) return;

  const envio = await sendEmail({ subject: email.subject, html: email.html, text: email.text, to: [persona.email] });
  const success = envio?.success === true;
  if (success) resultado.enviados += 1;
  else {
    resultado.fallidos += 1;
    resultado.errores.push({ usuario_id: persona.id, error: MENSAJE_SIN_ENVIAR });
  }
  try {
    await terminar(persona.id, dia, momento, success);
    if (success) await marcarInformados(persona.id, mail.informa, ahoraArgentina());
  } catch (error) {
    // Queda reservado y sin terminar: no se repite (pudo haber salido)
    conError('Error al anotar el aviso diario:', error);
  }
};

// Lo de la corrida con el candado tomado
const mandarLosQueTocan = async ({ momento, ahora, calendario }, resultado) => {
  if (calendario.error !== null) {
    resultado.errores.push({ usuario_id: null, error: MENSAJE_SIN_FERIADOS });
    return;
  }
  const hoy = ahora.slice(0, 10);
  resultado.dia_habil = calendario.esDiaHabil(hoy);
  if (!resultado.dia_habil) return;

  const hasta = momento === 'tarde' ? diasDelAviso(hoy, calendario).at(-1) : hoy;
  const [usuarios, licencias, eventos] = await Promise.all([usuariosDelAviso(), deLicenciaOficial(hoy), eventosDelAviso(hoy, hasta)]);
  const informados = await informadosDe(eventos.map((evento) => evento.id));
  for (const persona of usuarios) {
    if (!persona.activo || !emailValido(persona.email) || licencias.has(persona.id)) continue;
    let mail;
    try {
      mail = mailDeLaPersona({ persona, eventos, informados, momento, ahora, calendario, usuarios });
    } catch (error) {
      console.error('Error al armar el aviso diario:', error?.stack ?? error);
      resultado.errores.push({ usuario_id: persona.id, error: MENSAJE_SIN_PREPARAR });
      continue;
    }
    if (mail !== null) await mandarUno({ persona, mail, dia: hoy, momento }, resultado);
  }
};

/**
 * Una corrida del aviso diario, en el momento `ahora` ('AAAA-MM-DD HH:MM:SS' de Argentina). `momento`: 'tarde' o 'manana'. `calendario`: el de
 * la corrida que lo llama. Devuelve `{ ocupada, dia_habil, enviados, fallidos, errores: [{ usuario_id, error }] }`. 'tarde' no hace nada antes
 * de las 14:00: las rutas manuales se pueden llamar antes. Tira solo si no se puede tomar el candado: por eso se llama con `avisoDiarioAislado`.
 */
export const ejecutarAvisoDiarioDeEventos = async ({ momento, ahora = ahoraArgentina(), calendario }) => {
  if (momento === 'tarde' && !paso14(ahora)) return sinNada();
  const corrida = await conBloqueo(async () => {
    const resultado = sinNada();
    await anotarInicio(ahora);
    try {
      await mandarLosQueTocan({ momento, ahora, calendario }, resultado);
    } catch (error) {
      // Solo la pila: los errores de mysql2 traen la consulta armada con sus valores
      console.error('Error en el aviso diario:', error?.stack ?? error);
      resultado.errores.push({ usuario_id: null, error: mensajeDe(error) });
    }
    await anotarFin(ahora, resultado);
    return resultado;
  }, BLOQUEO_DIARIO);
  return corrida.ocupado ? { ...sinNada(), ocupada: true } : corrida.resultado;
};

/** Lo mismo, pero nunca rechaza: lo que falle va a `errores`. */
export const avisoDiarioAislado = async (momento, calendario, { ahora = ahoraArgentina() } = {}) => {
  try {
    return await ejecutarAvisoDiarioDeEventos({ momento, ahora, calendario });
  } catch (error) {
    console.error('Error en el aviso diario:', error?.stack ?? error);
    return { ...sinNada(), errores: [{ usuario_id: null, error: mensajeDe(error) }] };
  }
};

/**
 * La última corrida, para Correos → Estado: `{ inicio, fin, resultado, con_errores, en_curso }`, con `inicio` y `fin` 'AAAA-MM-DD HH:MM'. null
 * si nunca corrió. Tira si la base falla: el controlador de Correos lo convierte en una advertencia.
 */
export const leerCorridaDelDiario = async (conexion = pool) => {
  const [[fila]] = await conexion.query(
    `SELECT DATE_FORMAT(inicio_at, '%Y-%m-%d %H:%i') AS inicio, DATE_FORMAT(fin_at, '%Y-%m-%d %H:%i') AS fin, resultado,
       con_errores, IS_FREE_LOCK(?) AS bloqueo_libre
     FROM mi_espacio_eventos_corridas WHERE id = ?`,
    [BLOQUEO_DIARIO, FILA_DEL_DIARIO]
  );
  if (!fila?.inicio) return null;
  const fin = fila.fin ?? null;
  return {
    inicio: fila.inicio, fin, resultado: fila.resultado ?? null, con_errores: Number(fila.con_errores) === 1,
    en_curso: fin === null && Number(fila.bloqueo_libre) !== 1
  };
};

/**
 * Lo que muestra Correos → Estado del aviso diario, en el momento `ahora`: `{ texto, corrida, alertas }`. Sin alerta de «no corrió»: viaja en
 * corridas que ya tienen la suya. Tira si la base falla: el controlador de Correos lo convierte en una advertencia.
 */
export const estadoDelAvisoDiario = async ({ ahora = ahoraArgentina() } = {}) => {
  const corrida = await leerCorridaDelDiario();
  return { texto: textoDeLaCorridaDelDiario(corrida, ahora), corrida, alertas: alertasDeLaCorridaDelDiario(corrida, ahora) };
};
