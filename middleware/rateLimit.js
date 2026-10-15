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

// "¿Olvidaste tu contraseña?" (spec 7.3): cuentan todos los pedidos, no solo los fallidos
const HORA_MS = 60 * 60 * 1000;
const respuestaRecuperar = {
  success: false,
  error: 'Demasiados pedidos de recuperación. Intente nuevamente en una hora.'
};

// 5 pedidos por IP por hora
export const limiteRecuperarPorIp = rateLimit({
  windowMs: HORA_MS,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: respuestaRecuperar
});

// 3 pedidos por usuario o email por hora, desde cualquier IP
export const limiteRecuperarPorIdentificador = rateLimit({
  windowMs: HORA_MS,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `recuperar|${String(req.body?.identificador ?? '').trim().toLowerCase()}`,
  message: respuestaRecuperar
});

// Validar un link y elegir la contraseña (spec 7.4): 20 pedidos cada 15 minutos por IP, entre las dos rutas
export const limiteLinkDeAcceso = rateLimit({
  windowMs: VENTANA_MS,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Demasiados intentos. Intente nuevamente en 15 minutos.' }
});
