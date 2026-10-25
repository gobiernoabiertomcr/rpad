import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/database.js';
import { esAdmin, puedeCargarNotasDgmit } from '../services/usuariosReglas.js';

// Sin JWT_SECRET cualquiera podría firmar tokens válidos: no se permite iniciar
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ Falta la variable de entorno JWT_SECRET. El servidor no puede iniciar.');
  process.exit(1);
}

export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7h' });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

/**
 * La sesión de un encabezado Authorization ('Bearer <token>'). Además de verificar el token, lee de la base el rol, si el
 * usuario sigue activo y su versión de sesión: desactivar o cambiar el rol tiene efecto en el pedido siguiente (spec 5.1).
 * Devuelve `{ ok: true, user }` (`user` = el payload del token con el rol de la base) o `{ ok: false, status, error }`, con el
 * estado y el mensaje que responde authMiddleware. Nunca tira: un error de la base se registra y da 500.
 */
export const verificarSesion = async (authorization) => {
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Token de autenticación no proporcionado' };
  }

  const token = authorization.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload || !Number.isInteger(payload.userId)) {
    return { ok: false, status: 401, error: 'Token inválido o expirado' };
  }

  let usuario;
  try {
    const [filas] = await pool.execute('SELECT rol, activo, sesion_version FROM usuarios WHERE id = ?', [payload.userId]);
    usuario = filas[0];
  } catch (error) {
    console.error('Error verificando la sesión:', error);
    return { ok: false, status: 500, error: 'Error interno del servidor' };
  }

  // Un token sin versión (emitido antes de que existiera sesion_version) cuenta como versión 0
  if (!usuario || !usuario.activo || (payload.v ?? 0) !== usuario.sesion_version) {
    return { ok: false, status: 401, error: 'La sesión ya no es válida. Iniciá sesión nuevamente.' };
  }

  return { ok: true, user: { ...payload, rol: usuario.rol } };
};

// Middleware para rutas protegidas: sin una sesión válida responde el estado y el mensaje de verificarSesion
export const authMiddleware = async (req, res, next) => {
  const sesion = await verificarSesion(req.headers.authorization);
  if (!sesion.ok) {
    return res.status(sesion.status).json({ success: false, error: sesion.error });
  }

  req.user = sesion.user;
  next();
};

// Middleware para rutas públicas que muestran más con una sesión (spec 2026-10-24-configuracion, 5.1): con una sesión válida
// pone req.user, como authMiddleware; con cualquier otra cosa (sin token, un token inválido o vencido, una cuenta desactivada
// o un error de la base, que verificarSesion registra) sigue sin req.user, como un visitante. Nunca responde
export const sesionOpcional = async (req, res, next) => {
  const sesion = await verificarSesion(req.headers.authorization);
  if (sesion.ok) req.user = sesion.user;
  next();
};

// Middleware para rutas de administración: superadmin, admin y editor (esAdmin)
export const adminOnly = (req, res, next) => {
  if (!esAdmin(req.user?.rol)) {
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado. Se requiere rol de administrador.'
    });
  }
  next();
};

// Middleware para las notas DGMIT (spec 2026-10-24-notas-dgmit, sección 8): las cargan, corrigen y anulan administración
// (esAdmin) y el colaborador. Corregir y anular, además, solo quien la cargó o administración: eso lo decide el controlador,
// que conoce la nota
export const cargaNotasDgmit = (req, res, next) => {
  if (!puedeCargarNotasDgmit(req.user?.rol)) {
    return res.status(403).json({
      success: false,
      error: 'No tenés permiso para cargar notas DGMIT.'
    });
  }
  next();
};

// Middleware para el generador de notas (spec 2026-10-24-generador-de-notas, sección 1): lo usan los mismos que cargan notas
// DGMIT, administración y el colaborador (puedeCargarNotasDgmit). El lector no
export const usaGeneradorDeNotas = (req, res, next) => {
  if (!puedeCargarNotasDgmit(req.user?.rol)) {
    return res.status(403).json({
      success: false,
      error: 'No tenés permiso para usar el generador de notas.'
    });
  }
  next();
};

// Middleware para el cron externo: clave en header x-cron-secret o query ?secret=
// Si CRON_SECRET no está configurado se rechaza todo (antes undefined === undefined dejaba pasar)
export const cronAuth = (req, res, next) => {
  const esperado = process.env.CRON_SECRET;
  const recibido = req.headers['x-cron-secret'] || req.query.secret;

  let valido = false;
  if (esperado && typeof recibido === 'string') {
    const a = Buffer.from(recibido);
    const b = Buffer.from(esperado);
    valido = a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  if (!valido) {
    return res.status(403).json({ success: false, error: 'Acceso denegado' });
  }
  next();
};
