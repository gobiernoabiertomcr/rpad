import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { responderAntesDeLeer } from '../config/upload.js';

// Límites contra fuerza bruta en el login. Solo cuentan los intentos fallidos
// (skipSuccessfulRequests), así un error de tipeo no bloquea a toda una oficina
// que sale a internet por la misma IP.
// req.ip es la IP real porque app.js confía en un proxy (Apache) con 'trust proxy'.
const VENTANA_MS = 15 * 60 * 1000;

// La parte de la clave de un límite que manda el cliente: solo un texto (lo demás cuenta como vacío) y con un tope que no le llega a
// ninguna cuenta (usuarios.username y usuarios.email)
const TOPE_DE_LA_CLAVE = 100;
const claveDeTexto = (valor) => (typeof valor === 'string' ? valor.trim().toLowerCase().slice(0, TOPE_DE_LA_CLAVE) : '');

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
    return `${ipKeyGenerator(req.ip)}|${claveDeTexto(req.body?.username)}`;
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
  keyGenerator: (req) => `recuperar|${claveDeTexto(req.body?.identificador)}`,
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

// El POST del dato de la quincena (spec 2026-11-07-dato-quincena, 4): 20 pedidos por hora por IP, todos (también los que dan
// 401 o 400), antes del token. La ventana es fija: Retry-After (en segundos, lo pone express-rate-limit antes del handler)
// puede ser menos de una hora. El handler responde como las otras respuestas antes de leer: un desconocido no hace leer sin fin
export const limiteDatoQuincena = rateLimit({
  windowMs: HORA_MS,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn('Dato de la quincena: 429 (límite de pedidos)');
    responderAntesDeLeer(req, res, 429, { success: false, error: 'Demasiados pedidos. Probá de nuevo más tarde.' });
  }
});
