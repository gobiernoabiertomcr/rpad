import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

// Límites contra fuerza bruta en el login. Solo cuentan los intentos fallidos
// (skipSuccessfulRequests), así un error de tipeo no bloquea a toda una oficina
// que sale a internet por la misma IP.
// req.ip es la IP real porque app.js confía en un proxy (Apache) con 'trust proxy'.
const VENTANA_MS = 15 * 60 * 1000;

const respuestaBloqueo = {
  success: false,
  error: 'Demasiados intentos de inicio de sesión fallidos. Intente nuevamente en 15 minutos.'
};

// 10 intentos fallidos por usuario desde una misma IP
export const limiteLoginPorUsuario = rateLimit({
  windowMs: VENTANA_MS,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const usuario = String(req.body?.username ?? '').trim().toLowerCase();
    return `${ipKeyGenerator(req.ip)}|${usuario}`;
  },
  message: respuestaBloqueo
});

// 50 intentos fallidos por IP, sin importar el usuario (evita probar muchos usuarios)
export const limiteLoginPorIp = rateLimit({
  windowMs: VENTANA_MS,
  limit: 50,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: respuestaBloqueo
});
