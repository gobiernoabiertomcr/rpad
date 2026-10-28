// Avisos por email al superadmin cuando otro usuario hace un cambio sensible (spec usuarios 10.3), retenidos mientras
// está de licencia y resumidos a la vuelta (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.4)
import pool from '../config/database.js';
import { sendEmail } from './emailService.js';
import { avisoSuperadminTemplate, resumenAvisosRetenidosTemplate } from './emailTemplates.js';
import { emailValido } from './usuariosReglas.js';
import { hoyArgentina } from './notasDigitalesCalendario.js';
import { leerCalendario } from './feriadosDatos.js';

const LARGO_AVISO = 300;

// Superadmins activos con email válido, y si están de licencia en la fecha
const superadmins = async (fecha) => {
  const [filas] = await pool.query(
    `SELECT u.email,
       EXISTS (SELECT 1 FROM usuarios_licencias l
               WHERE l.usuario_id = u.id AND l.anulada = 0 AND l.desde <= ? AND l.hasta >= ?) AS de_licencia
     FROM usuarios u WHERE u.rol = 'superadmin' AND u.activo = TRUE`,
    [fecha, fecha]
  );
  return filas.filter(f => emailValido(f.email)).map(f => ({ email: f.email, deLicencia: Boolean(Number(f.de_licencia)) }));
};

/**
 * Avisa al superadmin un cambio que hizo otro usuario. Si todos los superadmins están de licencia no se envía: el texto
 * queda retenido en la fila del historial (auditoriaId) para el resumen de la vuelta. Nunca hace fallar la operación.
 * actor: { id, rol } de quien hizo el cambio; afectado: { nombre_completo, username }.
 */
export const avisarAlSuperadmin = async ({ actor, afectado, cambio, auditoriaId = null, hoy = hoyArgentina() }) => {
  if (actor.rol === 'superadmin') return;
  try {
    const lista = await superadmins(hoy);
    if (lista.length === 0) return;
    const disponibles = lista.filter(s => !s.deLicencia).map(s => s.email);
    if (disponibles.length === 0) {
      if (auditoriaId) {
        await pool.execute('UPDATE usuarios_auditoria SET aviso_retenido = ? WHERE id = ?', [String(cambio).slice(0, LARGO_AVISO), auditoriaId]);
      }
      return;
    }
    const [[datosActor]] = await pool.execute('SELECT nombre_completo, username FROM usuarios WHERE id = ?', [actor.id]);
    const envio = await sendEmail({ ...avisoSuperadminTemplate({ actor: datosActor, afectado, cambio, fecha: new Date() }), to: disponibles });
    if (!envio.success) console.error('No se pudo avisar al superadmin:', envio.error);
  } catch (error) {
    console.error('No se pudo avisar al superadmin:', error);
  }
};

/**
 * En un día hábil, si hay avisos retenidos y algún superadmin disponible, un solo email con todos; al enviarse dejan de
 * estar retenidos. Devuelve { enviado, cantidad }. Si el envío falla lanza un error (la corrida diaria lo registra y los
 * avisos siguen retenidos para el día hábil siguiente).
 * El día hábil, con el calendario de la corrida de las 8:15 (sin él, se lee): en un feriado de la tabla no sale y sale el
 * próximo día hábil (spec 2026-10-27-feriados-en-notas, 3).
 */
export const enviarResumenAvisosRetenidos = async ({ hoy, calendario = null }) => {
  const conElCalendario = calendario ?? await leerCalendario();
  if (!conElCalendario.esDiaHabil(hoy)) return { enviado: false, cantidad: 0 };
  const [retenidos] = await pool.query(
    `SELECT a.id, a.aviso_retenido AS cambio, a.created_at,
            af.nombre_completo AS afectado_nombre, af.username AS afectado_username,
            ac.nombre_completo AS actor_nombre, ac.username AS actor_username
     FROM usuarios_auditoria a
     JOIN usuarios af ON af.id = a.usuario_id
     LEFT JOIN usuarios ac ON ac.id = a.actor_id
     WHERE a.aviso_retenido IS NOT NULL
     ORDER BY a.created_at, a.id`
  );
  if (retenidos.length === 0) return { enviado: false, cantidad: 0 };
  const disponibles = (await superadmins(hoy)).filter(s => !s.deLicencia).map(s => s.email);
  if (disponibles.length === 0) return { enviado: false, cantidad: retenidos.length };
  const envio = await sendEmail({ ...resumenAvisosRetenidosTemplate(retenidos), to: disponibles });
  if (!envio.success) throw new Error(`No se pudo enviar el resumen de avisos retenidos: ${envio.error}`);
  await pool.query('UPDATE usuarios_auditoria SET aviso_retenido = NULL WHERE id IN (?)', [retenidos.map(r => r.id)]);
  return { enviado: true, cantidad: retenidos.length };
};
