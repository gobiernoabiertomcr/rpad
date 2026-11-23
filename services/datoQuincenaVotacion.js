/**
 * El sellado de la votación de la principal del equipo y el mail del resultado (spec 2026-11-23-dato-quincena-principal-votacion, 6): un
 * paso de las corridas de las 8:05 y de las 14:00, sin Tarea Cron propia.
 * - Con su propio candado (`rpad_dato_quincena_votacion`), ni el de las Notas, ni el del aviso diario, ni el del correo: con otra corrida
 *   del paso en marcha, termina «ocupada» sin escribir nada, y no es un error.
 * - Sella cada votación sin sellar cuyo cierre ya pasó, calculado con el calendario de la corrida (`estadoDeLaVotacionLeida`), solo si
 *   `debeSellar`: un día hábil, con el calendario leído y desde las 14:00 del día del cierre. Si no, la deja para la corrida siguiente: la
 *   de las 14:00 de ese día o, si no pudo, la de las 8:05 del siguiente día hábil. Las corridas a mano siguen la misma regla. Sellar es
 *   guardar `cierre_at` y `sellada_at`: desde ahí la votación ya no depende del calendario.
 * - En una regular, al sellar se manda el mail del resultado a administración (activa, con un email válido y sin licencia oficial ese
 *   día), salvo con el envío automático apagado («apagado»: no se manda después). Un piloto se sella sin mail («no_corresponde»).
 * - El mail sale una sola vez por edición: lo reserva el UPDATE condicionado que sella (sellarLaVotacion), y solo la corrida que la selló
 *   lo manda. A quien no le llega no se le reintenta: el aviso queda «parcial» o «fallido» y Correos → Estado lo muestra.
 * - Todo lo que hace falta para el mail se prepara antes de sellar: si la edición no se puede leer, la votación queda sin sellar y la
 *   corrida siguiente lo vuelve a intentar (si no, el mail se perdería para siempre).
 * - Un mail por persona, siempre con `to: [email]` y `from: remitente()`: sin destinatario, sendEmail manda a las casillas por defecto de
 *   la DGMIT. El texto del transporte no va al resultado ni a la consola: puede traer la dirección.
 * - `votacionDelDatoQuincenaAislada` **nunca rechaza**.
 * Los momentos se escriben con `ahora` (de `ahoraArgentina()`), nunca NOW() de la base.
 */
import { conBloqueo } from './notasDigitales.js';
import { sendEmail, remitente } from './emailService.js';
import { votacionResultadoTemplate, RPAD_URL } from './emailTemplates.js';
import { ahoraArgentina } from './notasDigitalesCalendario.js';
import { deLicenciaOficial } from './miEspacioEventosDiarioDatos.js';
import { leerConfig } from './datoQuincenaCorreoDatos.js';
import { leerEdicion } from './datoQuincenaDatos.js';
import { principalDeDatito, NOMBRE_DEL_BOT } from './datoQuincenaReglas.js';
// votacionParaElDetalle: la votación del detalle, la misma que ve la página; el mail cuenta lo mismo
import {
  estadoDeLaVotacionLeida, debeSellar, modeloDelMailDeLaVotacion, votacionParaElDetalle
} from './datoQuincenaVotacionReglas.js';
import {
  votacionesSinSellar, leerVotaciones, sellarLaVotacion, anotarElAviso, administracionParaElAviso
} from './datoQuincenaVotacionDatos.js';

export const BLOQUEO_VOTACION = 'rpad_dato_quincena_votacion';

// Los textos fijos de lo que falla: van al resultado (y de ahí a la respuesta de la corrida)
const MENSAJE_EN_LA_CORRIDA = 'No se pudo completar el sellado de la votación del dato de la quincena.';
const MENSAJE_AL_SELLAR = 'No se pudo sellar la votación de una edición.';
const MENSAJE_SIN_ENVIAR = 'No se pudo enviar el mail de la votación.';
const MENSAJE_SIN_ANOTAR = 'La votación se selló, pero no se pudo anotar cómo salió su mail.';

const sinNada = () => ({ ocupada: false, selladas: 0, mails: 0, errores: [] });

// En la consola, solo el código y el mensaje: los errores de mysql2 traen la consulta armada con sus valores
const aLaConsola = (texto, error) => console.error(texto, String(error?.code ?? ''), String(error?.message ?? error));

const falla = (resultado, edicionId, error, usuarioId = null) => resultado.errores.push({ edicion_id: edicionId, usuario_id: usuarioId, error });

// El cierre de una votación sin sellar si ya toca sellarla ('AAAA-MM-DD HH:MM'), o null: sin calendario o sin una llegada que se pueda
// leer el cierre no se sabe, y antes de las 14:00 del día del cierre (o un día que no es hábil) todavía no
const cierreSiToca = (fila, { ahora, calendario }) => {
  const { cierre } = estadoDeLaVotacionLeida({ ...fila, cierre_at: null }, { ahora, calendario });
  return cierre !== null && debeSellar({ cierre, ahora, calendario }) ? cierre : null;
};

/**
 * Lo que hace falta para el mail de una edición, una vez: la edición guardada (sus propuestas en su orden, con la cifra clave) y la
 * votación como la ve el detalle, cerrada y la misma para todos (sin quien mira). Devuelve el armado del mail de una persona por su
 * nombre; lo arma una vez antes de sellar, así una votación que no se puede contar no se sella.
 */
const prepararElMail = async ({ edicionId, votacion, ahora, calendario }) => {
  const leida = await leerEdicion(edicionId);
  if (leida === null) throw new Error('La edición no existe');
  const edicion = JSON.parse(leida.fila.metadata);
  const detalle = votacionParaElDetalle({ votacion, edicion, quienMira: null, ahora, calendario });
  const deDatito = principalDeDatito(edicion.propuestas)?.orden ?? null;
  const url = `${RPAD_URL}/dato-quincena.html?id=${edicionId}`;
  const mailPara = (nombreCompleto) => votacionResultadoTemplate({
    ...modeloDelMailDeLaVotacion({
      edicion: { id: edicionId, fecha_edicion: leida.fila.fecha_edicion }, propuestas: edicion.propuestas, deDatito, votacion: detalle,
      nombreCompleto, url
    }),
    nombreDelBot: NOMBRE_DEL_BOT
  });
  mailPara(null);
  return mailPara;
};

/**
 * El mail del resultado a cada persona (`personas`, de administración y sin licencia ese día), aislada: una que falla no frena a las
 * demás y no se le reintenta (un transporte que tira cuenta como que no salió: pudo haber salido). Devuelve el aviso: 'enviado' si le
 * llegó a todas, 'parcial' si a alguna no, 'fallido' si a ninguna y 'no_corresponde' si no había a quién.
 */
const mandarElResultado = async ({ edicionId, mailPara, personas, enviar }, resultado) => {
  if (personas.length === 0) return 'no_corresponde';
  let enviados = 0;
  for (const persona of personas) {
    let salio = false;
    try {
      const mail = mailPara(persona.nombre_completo);
      const envio = await enviar({ subject: mail.subject, html: mail.html, text: mail.text, to: [persona.email], from: remitente() });
      salio = envio?.success === true;
      if (!salio) console.error(`Votación del dato de la quincena: no se pudo enviar el mail (edición ${edicionId}, persona ${persona.id}).`);
    } catch (error) {
      // En la consola, solo el código: el texto del transporte puede traer la dirección
      console.error(`Votación del dato de la quincena: no se sabe si salió el mail (edición ${edicionId}, persona ${persona.id}).`,
        String(error?.code ?? ''));
    }
    if (salio) {
      enviados += 1;
      resultado.mails += 1;
    } else {
      falla(resultado, edicionId, MENSAJE_SIN_ENVIAR, persona.id);
    }
  }
  if (enviados === personas.length) return 'enviado';
  return enviados === 0 ? 'fallido' : 'parcial';
};

/**
 * Sella una votación que ya toca sellar y, si la selló esta corrida, manda el mail (en una regular con el envío prendido) y anota el
 * aviso. `aviso` es el contexto de la corrida, leído una vez y solo si hace falta: `() => { envioActivo, personas }`.
 */
const sellarUna = async ({ fila, votacion, cierre }, { ahora, calendario, enviar, aviso }, resultado) => {
  const edicionId = fila.edicion_id;
  let mailPara = null;
  let personas = [];
  let comoSale = 'no_corresponde';
  if (fila.tipo === 'regular') {
    const contexto = await aviso();
    if (contexto.envioActivo) {
      mailPara = await prepararElMail({ edicionId, votacion, ahora, calendario });
      personas = contexto.personas;
    } else {
      comoSale = 'apagado';
    }
  }
  // La reserva: si otra corrida la selló primero, esta no manda nada
  if (!(await sellarLaVotacion({ edicionId, cierre: `${cierre}:00`, ahora }))) return;
  resultado.selladas += 1;
  if (mailPara !== null) comoSale = await mandarElResultado({ edicionId, mailPara, personas, enviar }, resultado);
  try {
    await anotarElAviso({ edicionId, aviso: comoSale, ahora });
  } catch (error) {
    // La votación quedó sellada y el mail ya salió (o no correspondía): no se repite
    aLaConsola(`Votación del dato de la quincena: no se pudo anotar el aviso de la edición ${edicionId}:`, error);
    falla(resultado, edicionId, MENSAJE_SIN_ANOTAR);
  }
};

// Lo de la corrida con el candado tomado. Las consultas pesadas (la foto y los votos), solo de las que ya toca sellar
const correr = async ({ ahora, calendario, enviar }, resultado) => {
  const sinSellar = await votacionesSinSellar();
  const tocan = [];
  for (const fila of sinSellar) {
    try {
      const cierre = cierreSiToca(fila, { ahora, calendario });
      if (cierre !== null) tocan.push({ fila, cierre });
    } catch (error) {
      aLaConsola(`Votación del dato de la quincena: no se pudo calcular el cierre de la edición ${fila.edicion_id}:`, error);
      falla(resultado, fila.edicion_id, MENSAJE_AL_SELLAR);
    }
  }
  if (tocan.length === 0) return;
  const votaciones = await leerVotaciones(tocan.map(({ fila }) => fila.edicion_id));
  let contexto = null;
  const aviso = async () => {
    if (contexto === null) {
      const { envioActivo } = await leerConfig();
      if (!envioActivo) contexto = { envioActivo, personas: [] };
      else {
        const [administracion, licencias] = await Promise.all([administracionParaElAviso(), deLicenciaOficial(ahora.slice(0, 10))]);
        contexto = { envioActivo, personas: administracion.filter((persona) => !licencias.has(persona.id)) };
      }
    }
    return contexto;
  };
  for (const { fila, cierre } of tocan) {
    const votacion = votaciones.get(fila.edicion_id);
    if (votacion === undefined) continue;
    try {
      await sellarUna({ fila, votacion, cierre }, { ahora, calendario, enviar, aviso }, resultado);
    } catch (error) {
      aLaConsola(`Votación del dato de la quincena: no se pudo sellar la edición ${fila.edicion_id}:`, error);
      falla(resultado, fila.edicion_id, MENSAJE_AL_SELLAR);
    }
  }
};

/**
 * Una corrida del sellado en el momento `ahora` ('AAAA-MM-DD HH:MM:SS' de Argentina), con el `calendario` de la corrida que la llama (una
 * sola lectura de la tabla). `enviar`: sendEmail (los tests le pasan uno falso). Devuelve `{ ocupada, selladas, mails, errores }`:
 * `selladas`, las votaciones que selló esta corrida; `mails`, los que salieron; `errores`, `[{ edicion_id, usuario_id, error }]` con
 * textos fijos (un mail que no salió es uno, con su persona). Tira solo si no se puede tomar el candado: por eso se llama con
 * `votacionDelDatoQuincenaAislada`.
 */
export const ejecutarLaVotacionDelDatoQuincena = async ({ ahora = ahoraArgentina(), calendario, enviar = sendEmail }) => {
  const corrida = await conBloqueo(async () => {
    const resultado = sinNada();
    try {
      await correr({ ahora, calendario, enviar }, resultado);
    } catch (error) {
      aLaConsola('Error en el sellado de la votación del dato de la quincena:', error);
      falla(resultado, null, MENSAJE_EN_LA_CORRIDA);
    }
    return resultado;
  }, BLOQUEO_VOTACION);
  return corrida.ocupado ? { ...sinNada(), ocupada: true } : corrida.resultado;
};

/** Lo mismo, en el momento de la llamada (o `ahora`), pero nunca rechaza: lo que falle va a `errores`, con un texto fijo. */
export const votacionDelDatoQuincenaAislada = async (calendario, { ahora = ahoraArgentina() } = {}) => {
  try {
    return await ejecutarLaVotacionDelDatoQuincena({ ahora, calendario });
  } catch (error) {
    aLaConsola('Error en el sellado de la votación del dato de la quincena:', error);
    return { ...sinNada(), errores: [{ edicion_id: null, usuario_id: null, error: MENSAJE_EN_LA_CORRIDA }] };
  }
};
