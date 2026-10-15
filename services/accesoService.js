// Links de acceso de un solo uso: invitación (alta) y recuperación de contraseña (spec 7)
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { sendEmail } from './emailService.js';
import { invitacionTemplate, recuperacionTemplate, RPAD_URL, fechaHoraArgentina } from './emailTemplates.js';
import { registrarAuditoria } from './usuariosAuditoriaService.js';
import { emailValido } from './usuariosReglas.js';

export const HORAS_VIGENCIA = { invitacion: 72, recuperacion: 2 };

// Lo que ve quien abre un link que no sirve
export const MENSAJE_LINK = {
  vencido: 'El link venció. Pedí uno nuevo.',
  usado: 'Este link ya se usó. Si necesitás otro, pedilo de nuevo.',
  invalido: 'El link no es válido. Pedí uno nuevo.'
};

export class ErrorLink extends Error {
  constructor(motivo) {
    super(MENSAJE_LINK[motivo]);
    this.motivo = motivo;
  }
}

// En la base solo se guarda el SHA-256 del token
export const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// Los tokens son 32 bytes en base64url (43 caracteres); cualquier otra cosa no se busca en la base
const formatoValido = (token) => typeof token === 'string' && /^[A-Za-z0-9_-]{20,100}$/.test(token);

// Motivo por el que un link no sirve, o null si sirve
const motivoInvalidez = (fila) => {
  if (!fila || !fila.activo || fila.anulado_at) return 'invalido';
  if (fila.usado_at) return 'usado';
  if (fila.vencido) return 'vencido';
  return null;
};

const SELECT_LINK = `
  SELECT t.id, t.usuario_id, t.tipo, t.usado_at, t.anulado_at, (t.expira_at < NOW()) AS vencido,
         u.username, u.nombre_completo, u.activo
  FROM usuarios_tokens t
  JOIN usuarios u ON u.id = t.usuario_id
  WHERE t.token_hash = ?`;

/**
 * Crea un link nuevo y anula los anteriores sin usar del usuario (spec 7.1).
 * conexion: el pool o una conexión con transacción abierta. Devuelve el token en claro: solo viaja por email.
 */
export const generarLink = async (conexion, { usuarioId, tipo, creadoPor = null }) => {
  if (!HORAS_VIGENCIA[tipo]) throw new Error(`Tipo de link inválido: ${tipo}`);
  const token = crypto.randomBytes(32).toString('base64url');
  await conexion.execute(
    'UPDATE usuarios_tokens SET anulado_at = NOW() WHERE usuario_id = ? AND usado_at IS NULL AND anulado_at IS NULL',
    [usuarioId]
  );
  await conexion.execute(
    `INSERT INTO usuarios_tokens (usuario_id, tipo, token_hash, expira_at, creado_por)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?)`,
    [usuarioId, tipo, hashToken(token), HORAS_VIGENCIA[tipo], creadoPor]
  );
  return token;
};

// Estado de un link, sin consumirlo (spec 7.4)
export const validarLink = async (token) => {
  if (!formatoValido(token)) return { valido: false, motivo: 'invalido' };
  const [filas] = await pool.execute(SELECT_LINK, [hashToken(token)]);
  const motivo = motivoInvalidez(filas[0]);
  if (motivo) return { valido: false, motivo };
  const { tipo, username, nombre_completo } = filas[0];
  return { valido: true, tipo, username, nombre_completo };
};

/**
 * Consume el link y guarda la contraseña (spec 7.4): cierra las sesiones abiertas y anula los demás links.
 * El token se bloquea (FOR UPDATE): con dos pedidos simultáneos, el segundo ve el link ya usado.
 * Lanza ErrorLink si el link no sirve.
 */
export const establecerContrasena = async (token, password) => {
  if (!formatoValido(token)) throw new ErrorLink('invalido');
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const [filas] = await conexion.execute(`${SELECT_LINK} FOR UPDATE`, [hashToken(token)]);
    const motivo = motivoInvalidez(filas[0]);
    if (motivo) throw new ErrorLink(motivo);
    const { id, usuario_id: usuarioId } = filas[0];

    const hash = await bcrypt.hash(password, 10);
    await conexion.execute(
      'UPDATE usuarios SET password_hash = ?, sesion_version = sesion_version + 1 WHERE id = ?',
      [hash, usuarioId]
    );
    await conexion.execute('UPDATE usuarios_tokens SET usado_at = NOW() WHERE id = ?', [id]);
    await conexion.execute(
      'UPDATE usuarios_tokens SET anulado_at = NOW() WHERE usuario_id = ? AND id <> ? AND usado_at IS NULL AND anulado_at IS NULL',
      [usuarioId, id]
    );
    await registrarAuditoria(conexion, { usuarioId, actorId: usuarioId, accion: 'contrasena_establecida' });
    await conexion.commit();
    return { usuarioId };
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
};

/**
 * Genera el link y envía el email de invitación o de recuperación (spec 7.2 y 10).
 * usuario: { id, username, nombre_completo, email, rol }. origen: 'panel' | 'login'.
 * El link queda generado aunque el email falle; el intento queda en el historial (spec 10.4).
 * Devuelve { email_enviado, error? }.
 */
export const enviarLinkDeAcceso = async ({ usuario, tipo, actorId = null, origen }) => {
  if (!emailValido(usuario.email)) return { email_enviado: false, error: 'El usuario no tiene un email válido' };

  const token = await generarLink(pool, { usuarioId: usuario.id, tipo, creadoPor: actorId });
  const link = `${RPAD_URL}/establecer-contrasena.html#token=${token}`;
  const vence = fechaHoraArgentina(new Date(Date.now() + HORAS_VIGENCIA[tipo] * 3600 * 1000));
  const plantilla = tipo === 'invitacion' ? invitacionTemplate : recuperacionTemplate;

  const envio = await sendEmail({
    ...plantilla({ ...usuario, link, vence }),
    to: usuario.email,
    from: `"RPAD - Datos Abiertos MCR" <${process.env.SMTP_USER}>`
  });

  const resultado = envio.success ? { email_enviado: true } : { email_enviado: false, error: envio.error };
  await registrarAuditoria(pool, {
    usuarioId: usuario.id,
    actorId,
    accion: tipo === 'invitacion' ? 'invitacion_enviada' : 'recuperacion_enviada',
    detalle: { origen, ...resultado }
  });
  return resultado;
};
