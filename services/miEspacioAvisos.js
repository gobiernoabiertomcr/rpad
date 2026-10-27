/**
 * Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, sección 9): el email de lo que vence pronto, un paso aislado de la
 * corrida de las 8:15 (controllers/notificacionesController.js, después de las Notas Digitales y de la foto del año).
 * - Sale solo en días hábiles, con su propio control: `esDiaHabilCon` con los feriados de la tabla (la corrida sigue con los 9
 *   fijos, y en Carnaval da hábil).
 * - A cada persona activa, con vínculo (su modalidad) y con su saldo inicial cargado, con un email válido (`emailValido`), que
 *   ese día no está de licencia (`ausentesEn`), con lo que está en su tramo (`avisosDeVencimiento`) y todavía no se le avisó
 *   (`mi_espacio_avisos`).
 * - Un solo email por persona y por corrida, siempre con `to: [email]`: sin destinatario, sendEmail manda a las casillas por
 *   defecto de la DGMIT.
 * - Si sale, se anota cada clave; si no, no se anota nada y sale en la próxima corrida del tramo.
 * - Con el bloqueo `rpad_mi_espacio_avisos` (GET_LOCK, como las Notas Digitales): dos corridas a la vez (el cron y una a mano)
 *   no mandan el mismo email dos veces.
 */
import pool from '../config/database.js';
import { sendEmail } from './emailService.js';
import { vencimientoMiEspacioTemplate } from './emailTemplates.js';
import { emailValido } from './usuariosReglas.js';
import { calcular, avisosDeVencimiento } from './miEspacioReglas.js';
import { estadosDe, feriadosPara, ausentesEn } from './miEspacioDatos.js';
import { filasDeFeriados } from './feriadosDatos.js';
import { esDiaHabilCon, feriadosDelRango } from './feriadosReglas.js';
import { ahoraArgentina } from './notasDigitalesCalendario.js';

// Las personas que pueden recibir el aviso: activas, con vínculo, con su saldo inicial cargado y con un email válido
const personasDelAviso = async () => {
  const [filas] = await pool.query(
    `SELECT u.id, u.nombre_completo, u.email FROM usuarios u JOIN mi_espacio_arranque a ON a.usuario_id = u.id
     WHERE u.activo = 1 AND u.vinculo IS NOT NULL ORDER BY u.id`
  );
  return filas.filter((fila) => emailValido(fila.email))
    .map((fila) => ({ id: Number(fila.id), nombre_completo: fila.nombre_completo, email: fila.email }));
};

// Las claves que ya se le avisaron a cada persona: un Map de cada id a su Set
const yaAvisadas = async (ids) => {
  const [filas] = await pool.query('SELECT usuario_id, clave FROM mi_espacio_avisos WHERE usuario_id IN (?)', [ids]);
  const porPersona = new Map(ids.map((id) => [id, new Set()]));
  for (const fila of filas) porPersona.get(Number(fila.usuario_id))?.add(fila.clave);
  return porPersona;
};

// Por qué no salió (o no se anotó) el aviso de una persona: lo que va a la última corrida de Correos → Estado, un texto fijo
// (el de un envío que falla, que puede traer la dirección, queda solo en el `error` de la corrida)
const MOTIVOS = Object.freeze({
  envio: 'el email no se pudo enviar',
  anotacion: 'el email salió, pero no se pudo anotar',
  preparacion: 'no se pudo preparar el email'
});

// El bloqueo del paso, en la base: vale para todos los procesos de Passenger. Es de la conexión que lo pide
const BLOQUEO = 'rpad_mi_espacio_avisos';
const OCUPADO = 'Otra corrida en curso';

// Anota las claves de un email que salió, con el momento de Argentina. Una clave que otra corrida al mismo tiempo ya anotó no
// es un error: queda con el momento de esa corrida
const anotar = (usuarioId, claves) => {
  const enviado = ahoraArgentina();
  return pool.query(
    'INSERT INTO mi_espacio_avisos (usuario_id, clave, enviado_at) VALUES ? ON DUPLICATE KEY UPDATE enviado_at = enviado_at',
    [claves.map((clave) => [usuarioId, clave, enviado])]
  );
};

// Lo que vence pronto de una persona y todavía no se le avisó, con su email: `{ avisos, email }`, o null sin nada que mandar
const emailDe = ({ nombre_completo: nombreCompleto }, estado, { hoy, feriados, avisadas }) => {
  if (!estado?.modalidad) return null;
  const calculo = calcular(estado, { hoy, feriados });
  const avisos = avisosDeVencimiento(calculo, { hoy, feriados, modalidad: estado.modalidad })
    .filter((aviso) => !avisadas.has(aviso.clave));
  if (avisos.length === 0) return null;
  return { avisos, email: vencimientoMiEspacioTemplate({ nombre_completo: nombreCompleto, avisos }) };
};

// Le manda a cada persona lo suyo, y lo anota en `resultado`. Cada persona va aislada: un error inesperado al preparar su
// email (un cálculo que tira) va a los errores y sigue con la siguiente. En la consola, solo la pila: los errores de mysql2
// traen la consulta armada con sus valores
const avisarATodas = async (resultado, { hoy, filas }) => {
  const candidatas = await personasDelAviso();
  if (candidatas.length === 0) return;
  const ausentes = await ausentesEn(hoy, candidatas.map((persona) => persona.id));
  const personas = candidatas.filter((persona) => !ausentes.has(persona.id));
  if (personas.length === 0) return;
  const ids = personas.map((persona) => persona.id);
  const estados = await estadosDe(ids);
  const feriados = await feriadosPara(estados, hoy, filas);
  const avisadas = await yaAvisadas(ids);

  for (const persona of personas) {
    const { id } = persona;
    let preparado;
    try {
      preparado = emailDe(persona, estados.get(id), { hoy, feriados, avisadas: avisadas.get(id) });
    } catch (error) {
      console.error('Error al preparar el aviso de Mi espacio:', error?.stack ?? error);
      resultado.errores.push({ usuario_id: id, error: 'No se pudo preparar el email', motivo: MOTIVOS.preparacion });
      continue;
    }
    if (preparado === null) continue;

    const envio = await sendEmail({ ...preparado.email, to: [persona.email] });
    if (!envio.success) {
      resultado.errores.push({ usuario_id: id, error: envio.error, motivo: MOTIVOS.envio });
      continue;
    }
    resultado.enviados += 1;
    try {
      await anotar(id, preparado.avisos.map((aviso) => aviso.clave));
    } catch (error) {
      console.error('Error al anotar el aviso de Mi espacio:', error?.stack ?? error);
      resultado.errores.push({ usuario_id: id, error: error.message, motivo: MOTIVOS.anotacion });
    }
  }
};

/**
 * El paso de la corrida: `{ dia_habil, enviados, errores: [{ usuario_id, error, motivo }] }`, con `enviados` la cantidad de
 * emails que salieron y `motivo`, el texto fijo de la última corrida (MOTIVOS). Un día no hábil no lee más que los feriados.
 * Un día hábil toma el bloqueo del paso antes de leer nada más; si lo tiene otra corrida, no manda nada y suma
 * `motivo: 'Otra corrida en curso'`. Un email que no sale, uno que salió y no se pudo anotar y una persona cuyo email no se
 * pudo preparar quedan en `errores` y no frenan a las demás; un error de la base antes de mandar (las personas, sus
 * licencias, lo cargado o lo ya avisado) tira, y no sale ninguno. El bloqueo se libera siempre.
 * @returns {Promise<{ dia_habil: boolean, enviados: number, errores: object[], motivo?: string }>}
 */
export const enviarAvisosDeVencimiento = async ({ hoy }) => {
  const resultado = { dia_habil: false, enviados: 0, errores: [] };
  const filas = await filasDeFeriados();
  resultado.dia_habil = esDiaHabilCon(hoy, feriadosDelRango(filas, hoy, hoy));
  if (!resultado.dia_habil) return resultado;

  // GET_LOCK y RELEASE_LOCK con la misma conexión, dedicada mientras dura el paso (como conBloqueo de las Notas Digitales)
  const conexion = await pool.getConnection();
  let descartar = false;
  try {
    const [[{ bloqueo }]] = await conexion.query('SELECT GET_LOCK(?, 0) AS bloqueo', [BLOQUEO]);
    // GET_LOCK devuelve 1 si lo tomó, 0 si está ocupado y NULL ante un error
    if (Number(bloqueo) !== 1) return { ...resultado, motivo: OCUPADO };
    try {
      await avisarATodas(resultado, { hoy, filas });
    } finally {
      try {
        await conexion.query('SELECT RELEASE_LOCK(?)', [BLOQUEO]);
      } catch (error) {
        // No tapa el resultado ni el error del paso. Sin RELEASE_LOCK, la conexión se cierra: al terminar la sesión, la base
        // libera el bloqueo igual
        console.error('No se pudo liberar el bloqueo de los avisos de Mi espacio:', error?.stack ?? error);
        descartar = true;
      }
    }
    return resultado;
  } finally {
    if (descartar) conexion.destroy();
    else conexion.release();
  }
};
