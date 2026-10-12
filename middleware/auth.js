import jwt from 'jsonwebtoken';
import crypto from 'crypto';

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

// Middleware para rutas protegidas
export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Token de autenticación no proporcionado'
    });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      success: false,
      error: 'Token inválido o expirado'
    });
  }

  req.user = payload;
  next();
};

// Middleware para rutas solo de administradores
export const adminOnly = (req, res, next) => {
  if (req.user?.rol !== 'admin') {
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
