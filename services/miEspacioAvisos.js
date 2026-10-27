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

// Anota las claves de un email que salió, con el momento de Argentina. Una clave que otra corrida al mismo tiempo ya anotó no
// es un error: queda con el momento de esa corrida
const anotar = (usuarioId, claves) => {
  const enviado = ahoraArgentina();
  return pool.query(
    'INSERT INTO mi_espacio_avisos (usuario_id, clave, enviado_at) VALUES ? ON DUPLICATE KEY UPDATE enviado_at = enviado_at',
    [claves.map((clave) => [usuarioId, clave, enviado])]
  );
};

/**
 * El paso de la corrida: `{ dia_habil, enviados, errores: [{ usuario_id, error }] }`, con `enviados` la cantidad de emails que
 * salieron. Un día no hábil no lee más que los feriados. Un email que no sale, o que salió y no se pudo anotar, queda en
 * `errores` y no frena a los demás; un error de la base antes de mandar (las personas, sus licencias, lo cargado o lo ya
 * avisado) tira, y no sale ninguno.
 * @returns {Promise<{ dia_habil: boolean, enviados: number, errores: object[] }>}
 */
export const enviarAvisosDeVencimiento = async ({ hoy }) => {
  const resultado = { dia_habil: false, enviados: 0, errores: [] };
  const filas = await filasDeFeriados();
  resultado.dia_habil = esDiaHabilCon(hoy, feriadosDelRango(filas, hoy, hoy));
  if (!resultado.dia_habil) return resultado;

  const candidatas = await personasDelAviso();
  if (candidatas.length === 0) return resultado;
  const ausentes = await ausentesEn(hoy, candidatas.map((persona) => persona.id));
  const personas = candidatas.filter((persona) => !ausentes.has(persona.id));
  if (personas.length === 0) return resultado;
  const ids = personas.map((persona) => persona.id);
  const estados = await estadosDe(ids);
  const feriados = await feriadosPara(estados, hoy, filas);
  const avisadas = await yaAvisadas(ids);

  for (const { id, nombre_completo: nombreCompleto, email } of personas) {
    const estado = estados.get(id);
    if (!estado?.modalidad) continue;
    const calculo = calcular(estado, { hoy, feriados });
    const avisos = avisosDeVencimiento(calculo, { hoy, feriados, modalidad: estado.modalidad })
      .filter((aviso) => !avisadas.get(id).has(aviso.clave));
    if (avisos.length === 0) continue;

    const envio = await sendEmail({ ...vencimientoMiEspacioTemplate({ nombre_completo: nombreCompleto, avisos }), to: [email] });
    if (!envio.success) {
      resultado.errores.push({ usuario_id: id, error: envio.error });
      continue;
    }
    resultado.enviados += 1;
    try {
      await anotar(id, avisos.map((aviso) => aviso.clave));
    } catch (error) {
      resultado.errores.push({ usuario_id: id, error: error.message });
    }
  }
  return resultado;
};
