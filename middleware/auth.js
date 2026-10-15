import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/database.js';
import { esAdmin } from '../services/usuariosReglas.js';

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

// Middleware para rutas protegidas. Además de verificar el token, lee de la base el rol, si el usuario
// sigue activo y su versión de sesión: desactivar o cambiar el rol tiene efecto en el pedido siguiente (spec 5.1)
export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Token de autenticación no proporcionado'
    });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload || !Number.isInteger(payload.userId)) {
    return res.status(401).json({
      success: false,
      error: 'Token inválido o expirado'
    });
  }

  let usuario;
  try {
    const [filas] = await pool.execute('SELECT rol, activo, sesion_version FROM usuarios WHERE id = ?', [payload.userId]);
    usuario = filas[0];
  } catch (error) {
    console.error('Error verificando la sesión:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }

  // Un token sin versión (emitido antes de que existiera sesion_version) cuenta como versión 0
  if (!usuario || !usuario.activo || (payload.v ?? 0) !== usuario.sesion_version) {
    return res.status(401).json({
      success: false,
      error: 'La sesión ya no es válida. Iniciá sesión nuevamente.'
    });
  }

  req.user = { ...payload, rol: usuario.rol };
  next();
};

// Middleware para rutas de administración: admin y superadmin
export const adminOnly = (req, res, next) => {
  if (!esAdmin(req.user?.rol)) {
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado. Se requiere rol de administrador.'
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
