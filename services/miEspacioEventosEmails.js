/**
 * La agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, sección 4): los emails que salen cuando quien creó un evento lo
 * guarda, la invitación, el cambio y la cancelación. Quién recibe qué lo decide `emailsDelGuardado`
 * (services/miEspacioEventosReglas.js); acá se mandan y se anotan.
 * - Salen después de responder el guardado, fuera de la transacción (controllers/miEspacioEventosController.js): un evento
 *   «para todos» no hace esperar a quien lo guarda. También en un día que no es hábil, y aunque la persona esté de licencia
 *   (van al mail laboral): responden a lo que hizo una persona.
 * - Uno por persona, siempre con `to: [email]` y solo con un email que pasa `emailValido`: sin destinatario, sendEmail manda a
 *   las casillas por defecto de la DGMIT. Una persona sin un email que sirva no recibe nada y no deja fila.
 * - Cada intento deja su fila en `mi_espacio_evento_envios` (`anotarEnvio`), con `success` 1 o 0: los que no salieron quedan
 *   registrados. Las invitaciones, los cambios y las cancelaciones no tienen clave única (los recordatorios, sí: los reserva la
 *   corrida, services/miEspacioEventosCorrida.js, con su propio INSERT IGNORE).
 * - Nada tira: un email que no sale, una fila que no se puede anotar o una entrada rara van a la consola o no mandan nada, y el
 *   evento ya quedó guardado.
 */
import pool from '../config/database.js';
import { sendEmail } from './emailService.js';
import { eventoInvitacionTemplate, eventoCambioTemplate, eventoCancelacionTemplate } from './emailTemplates.js';
import { emailValido } from './usuariosReglas.js';
import { idPositivo } from './proyectosReglas.js';
import { ahoraArgentina } from './notasDigitalesCalendario.js';

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const listaDe = (valor) => (Array.isArray(valor) ? valor : []);

/**
 * Anota un email de un evento en `mi_espacio_evento_envios`: `{ evento_id, usuario_id, tipo, para, success }`, con `para`, el
 * momento del evento al que se refiere ('AAAA-MM-DD HH:MM'), y `enviado_at`, ahora (`ahoraArgentina()`, nunca NOW() de la
 * base). `conexion`: el pool, o la de una transacción. Tira si la base falla: quien la llama decide.
 */
export const anotarEnvio = ({ evento_id: eventoId, usuario_id: usuarioId, tipo, para, success }, conexion = pool) =>
  conexion.query(
    'INSERT INTO mi_espacio_evento_envios (evento_id, usuario_id, tipo, para, enviado_at, success) VALUES (?, ?, ?, ?, ?, ?)',
    [eventoId, usuarioId, tipo, para, ahoraArgentina(), success ? 1 : 0]
  );

// El momento en que empieza un evento, 'AAAA-MM-DD HH:MM' (el `para` de sus envíos)
const inicioDe = (evento) => `${evento.fecha} ${evento.desde}`;

/**
 * Cada tipo, en el orden en que salen: de qué evento habla (el de después; en la cancelación, el de antes) y su plantilla. Las
 * tres son iguales para todos los que la reciben: se arman una vez por tipo.
 */
const TIPOS = Object.freeze([
  {
    tipo: 'invitacion',
    evento: ({ despues }) => despues,
    email: ({ creador, despues }) => eventoInvitacionTemplate({ creador, evento: despues })
  },
  {
    tipo: 'cambio',
    evento: ({ despues }) => despues,
    email: ({ creador, antes, despues }) => eventoCambioTemplate({ creador, antes, despues })
  },
  {
    tipo: 'cancelacion',
    evento: ({ antes }) => antes,
    email: ({ creador, antes }) => eventoCancelacionTemplate({ creador, evento: antes })
  }
]);

// Manda un email a una persona y lo anota. Devuelve si salió. Anotarlo puede fallar (la base, o un evento que ya no está): va a
// la consola, solo la pila (los errores de mysql2 traen la consulta armada con sus valores), y el email ya salió o no
const mandarYAnotar = async ({ email, tipo, evento, usuarioId, correo }) => {
  const envio = await sendEmail({ subject: email.subject, html: email.html, text: email.text, to: [correo] });
  const success = envio?.success === true;
  try {
    await anotarEnvio({ evento_id: idPositivo(evento.id), usuario_id: usuarioId, tipo, para: inicioDe(evento), success });
  } catch (error) {
    console.error('Error al anotar el email de un evento:', error?.stack ?? error);
  }
  return success;
};

/**
 * Manda los emails de un guardado, después de responder. Recibe `{ plan, antes, despues, creador, audiencia }`: el plan de
 * `emailsDelGuardado` (`{ invitacion, cambio, cancelacion }`, listas de ids), el evento antes y después de guardar (`antes` null
 * en un alta, `despues` null en una baja; con `id`, `fecha`, `desde` y lo de las plantillas), el nombre de quien lo creó y la
 * audiencia: un Map de cada id a `{ email }` (las personas de `audienciaDe`, la de antes y la de después). Uno por persona, con
 * `sendEmail({ subject, html, text, to: [email] })`, solo si su email pasa `emailValido` (si no, ni envío ni fila; una persona
 * que no está en la audiencia, tampoco); cada intento deja su fila. Sin mirar las licencias.
 * Devuelve `{ enviados, fallidos }`, la cantidad de emails que salieron y que no. Nunca tira: sin un plan, sin un Map o sin el
 * evento de un tipo, ese tipo no manda nada.
 * @returns {Promise<{ enviados: number, fallidos: number }>}
 */
export const enviarEmailsDelGuardado = async (entrada) => {
  const resultado = { enviados: 0, fallidos: 0 };
  try {
    const { plan, antes = null, despues = null, creador, audiencia } = esObjeto(entrada) ? entrada : {};
    if (!esObjeto(plan) || !(audiencia instanceof Map)) return resultado;
    for (const { tipo, evento: eventoDe, email: emailDe } of TIPOS) {
      const evento = eventoDe({ antes, despues });
      const destinatarios = listaDe(plan[tipo])
        .map((id) => ({ usuarioId: idPositivo(id), correo: audiencia.get(idPositivo(id))?.email }))
        .filter(({ usuarioId, correo }) => usuarioId !== null && emailValido(correo));
      if (!esObjeto(evento) || idPositivo(evento.id) === null || destinatarios.length === 0) continue;

      const email = emailDe({ creador, antes, despues });
      for (const { usuarioId, correo } of destinatarios) {
        if (await mandarYAnotar({ email, tipo, evento, usuarioId, correo })) resultado.enviados += 1;
        else resultado.fallidos += 1;
      }
    }
  } catch (error) {
    console.error('Error al mandar los emails de un evento:', error?.stack ?? error);
  }
  return resultado;
};
