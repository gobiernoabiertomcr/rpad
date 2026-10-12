/**
 * Controlador para formulario de contacto público
 * Incluye rate limiting por IP para prevenir spam
 */

import { sendEmail } from '../services/emailService.js';
import { contactoTemplate } from '../services/emailTemplates.js';

// Rate limiting en memoria (máximo 5 envíos por IP por hora)
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hora en ms

/**
 * Limpia entradas expiradas del rate limit
 */
const limpiarRateLimitExpirados = () => {
  const ahora = Date.now();
  for (const [ip, data] of rateLimitMap.entries()) {
    if (ahora - data.primerIntento > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(ip);
    }
  }
};

/**
 * Verifica si una IP está dentro del límite permitido
 */
const verificarRateLimit = (ip) => {
  limpiarRateLimitExpirados();
  
  const ahora = Date.now();
  const data = rateLimitMap.get(ip);
  
  if (!data) {
    rateLimitMap.set(ip, { intentos: 1, primerIntento: ahora });
    return { permitido: true, restantes: RATE_LIMIT_MAX - 1 };
  }
  
  // Si pasó la ventana de tiempo, reiniciar contador
  if (ahora - data.primerIntento > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { intentos: 1, primerIntento: ahora });
    return { permitido: true, restantes: RATE_LIMIT_MAX - 1 };
  }
  
  // Verificar límite
  if (data.intentos >= RATE_LIMIT_MAX) {
    const tiempoRestante = Math.ceil((RATE_LIMIT_WINDOW - (ahora - data.primerIntento)) / 60000);
    return { permitido: false, tiempoRestante };
  }
  
  // Incrementar contador
  data.intentos++;
  return { permitido: true, restantes: RATE_LIMIT_MAX - data.intentos };
};

/**
 * Obtiene la IP real del cliente.
 * req.ip ya resuelve el proxy según 'trust proxy' (app.js): toma la IP que agrega
 * Apache, no la primera de X-Forwarded-For, que el cliente puede inventar.
 */
const obtenerIP = (req) => req.ip || 'unknown';

/**
 * Validaciones del formulario
 */
const validarFormulario = (data) => {
  const errores = [];
  
  // Nombre: requerido, 2-100 caracteres
  if (!data.nombre || data.nombre.trim().length < 2) {
    errores.push('El nombre debe tener al menos 2 caracteres');
  } else if (data.nombre.trim().length > 100) {
    errores.push('El nombre no puede superar los 100 caracteres');
  }
  
  // Email: requerido, formato válido
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email.trim())) {
    errores.push('Ingrese un email válido');
  }
  
  // Tipo de consulta: requerido, valor válido
  const tiposValidos = [
    'consulta-general',
    'solicitud-datos',
    'reporte-error',
    'sugerencia-dataset',
    'otro'
  ];
  if (!data.tipo || !tiposValidos.includes(data.tipo)) {
    errores.push('Seleccione un tipo de consulta válido');
  }
  
  // Mensaje: requerido, 10-2000 caracteres
  if (!data.mensaje || data.mensaje.trim().length < 10) {
    errores.push('El mensaje debe tener al menos 10 caracteres');
  } else if (data.mensaje.trim().length > 2000) {
    errores.push('El mensaje no puede superar los 2000 caracteres');
  }
  
  return errores;
};

/**
 * Endpoint principal: recibe y procesa el formulario de contacto
 */
export const enviarContacto = async (req, res) => {
  try {
    const ip = obtenerIP(req);
    
    // Verificar rate limit
    const rateCheck = verificarRateLimit(ip);
    if (!rateCheck.permitido) {
      return res.status(429).json({
        success: false,
        error: `Demasiados envíos. Intente nuevamente en ${rateCheck.tiempoRestante} minutos.`
      });
    }
    
    const { nombre, email, tipo, mensaje } = req.body;
    
    // Validar datos
    const errores = validarFormulario({ nombre, email, tipo, mensaje });
    if (errores.length > 0) {
      return res.status(400).json({
        success: false,
        error: errores.join('. ')
      });
    }
    
    // Mapear tipo a texto legible
    const tiposTexto = {
      'consulta-general': 'Consulta general',
      'solicitud-datos': 'Solicitud de datos específicos',
      'reporte-error': 'Reporte de error en un dataset',
      'sugerencia-dataset': 'Sugerencia de nuevo dataset',
      'otro': 'Otro'
    };
    
    // Preparar datos para el email
    const datosContacto = {
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      tipo: tiposTexto[tipo] || tipo,
      mensaje: mensaje.trim(),
      fecha: new Date().toLocaleString('es-AR', {
        dateStyle: 'full',
        timeStyle: 'short'
      }),
      ip: ip
    };
    
    // Generar email
    const { subject, html } = contactoTemplate(datosContacto);
    
    // Enviar solo a datospublicos@comodoro.gov.ar
    const resultado = await sendEmail({
      subject,
      html,
      to: ['datospublicos@comodoro.gov.ar']
    });
    
    if (!resultado.success) {
      console.error('Error enviando email de contacto:', resultado.error);
      return res.status(500).json({
        success: false,
        error: 'No se pudo enviar el mensaje. Intente nuevamente más tarde.'
      });
    }
    
    console.log(`✉️ Formulario de contacto recibido de ${datosContacto.email} (IP: ${ip})`);
    
    res.json({
      success: true,
      message: 'Tu consulta fue enviada correctamente. Te responderemos a la brevedad al email indicado.'
    });
    
  } catch (error) {
    console.error('Error en formulario de contacto:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno. Intente nuevamente más tarde.'
    });
  }
};
