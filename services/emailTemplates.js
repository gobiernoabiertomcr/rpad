/**
 * Plantillas de email para notificaciones RPAD
 * Colores institucionales basados en styles.css
 */

import { TEXTO_ROL } from './usuariosReglas.js';
import { formatoCorto } from './notasDigitalesCalendario.js';

const COLORS = {
  primary: '#0066cc',
  success: '#28a745',
  warning: '#ffc107',
  danger: '#dc3545',
  orange: '#fd7e14',
  dark: '#1a1a2e',
  muted: '#6c757d',
  light: '#f8f9fa',
  border: '#e9ecef'
};

// URL pública del RPAD para los links de los emails. En local se configura APP_URL (spec 7.1)
export const RPAD_URL = (process.env.APP_URL || 'https://rpad.mcrmodernizacion.gob.ar').replace(/\/+$/, '');

// Fecha y hora en 24 h y en la hora de Argentina: "18 de octubre de 2026 a las 14:30" (el conector lo da el idioma de Node).
// hourCycle 'h23': es-AR usa por defecto 12 h ("02:30 p. m.") y los emails agregan " h" a continuación.
const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
export const fechaHoraArgentina = (fecha) => FORMATO_FECHA_HORA.format(fecha);

/**
 * Escapa caracteres HTML
 */
const escapeHtml = (text) => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

/**
 * Template para aviso a áreas externas (-40 días)
 * Se envía directamente al email del área
 */
const areaAviso40diasTemplate = (areaData) => {
  const datasetsHtml = areaData.datasets.map((d, i) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid ${COLORS.border};">
        <p style="margin: 0; color: ${COLORS.dark}; font-size: 14px; font-weight: 500;">${i + 1}. ${escapeHtml(d.titulo)}</p>
        <p style="margin: 4px 0 0 0; color: ${COLORS.muted}; font-size: 12px;">🔄 Frecuencia de actualización: ${escapeHtml(d.frecuencia_nombre || 'Sin definir')}</p>
        ${d.url_dataset ? `<p style="margin: 6px 0 0 0;"><a href="${d.url_dataset}" style="color: ${COLORS.primary}; font-size: 13px; text-decoration: none;">🔗 Ver dataset en el portal</a></p>` : ''}
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aviso de Solicitud de Actualización de Datos</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${COLORS.light};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header institucional -->
          <tr>
            <td style="background: linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.primary} 100%); padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">Municipalidad de Comodoro Rivadavia</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">Dirección General de Modernización e Investigación Territorial</p>
            </td>
          </tr>

          <!-- Accent Bar -->
          <tr>
            <td style="background-color: ${COLORS.primary}; height: 4px;"></td>
          </tr>

          <!-- Saludo -->
          <tr>
            <td style="padding: 28px 24px 20px 24px;">
              <p style="margin: 0; color: ${COLORS.dark}; font-size: 15px; line-height: 1.6;">
                Estimados/as:
              </p>
              <p style="margin: 16px 0 0 0; color: ${COLORS.dark}; font-size: 15px; line-height: 1.6;">
                Nos comunicamos desde la <strong>Dirección General de Modernización e Investigación Territorial</strong> de la Municipalidad de Comodoro Rivadavia para informarles que próximamente recibirán una nota formal solicitando la actualización de los siguientes datasets publicados en el Portal de Datos Abiertos:
              </p>
            </td>
          </tr>

          <!-- Lista de datasets -->
          <tr>
            <td style="padding: 0 24px;">
              <table role="presentation" style="width: 100%; background-color: ${COLORS.light}; border-radius: 6px; border: 1px solid ${COLORS.border};">
                ${datasetsHtml}
              </table>
            </td>
          </tr>

          <!-- Cierre -->
          <tr>
            <td style="padding: 24px;">
              <p style="margin: 0; color: ${COLORS.dark}; font-size: 15px; line-height: 1.6;">
                Gracias a su colaboración, mantener estos datos al día no solo permite dar cumplimiento a las obligaciones establecidas en la Ordenanza N.º 17.662/23 de Gobierno Abierto, sino que también facilita el acceso de la ciudadanía a información actualizada y agiliza los procesos administrativos tanto del Municipio como de otras organizaciones, reduciendo la necesidad de solicitar los datos por canales tradicionales. Quedamos a disposición para cualquier consulta. ¡Muchas gracias!
              </p>
            </td>
          </tr>

          <!-- Firma -->
          <tr>
            <td style="padding: 0 24px 24px 24px;">
              <table role="presentation" style="width: 100%; background-color: ${COLORS.light}; border-radius: 6px; padding: 16px; border-left: 4px solid ${COLORS.primary};">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: ${COLORS.dark}; font-size: 14px; font-weight: 600;">Dirección de Datos Públicos y Comunicación</p>
                    <p style="margin: 4px 0 0 0; color: ${COLORS.muted}; font-size: 13px;">Dirección General de Modernización e Investigación Territorial</p>
                    <p style="margin: 12px 0 0 0; color: ${COLORS.muted}; font-size: 13px;">
                      📧 E-mail: <a href="mailto:datospublicos@comodoro.gov.ar" style="color: ${COLORS.primary}; text-decoration: none;">datospublicos@comodoro.gov.ar</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${COLORS.light}; padding: 16px 24px; text-align: center; border-top: 1px solid ${COLORS.border};">
              <p style="margin: 0; color: ${COLORS.muted}; font-size: 11px;">
                Este es un mensaje automático del sistema RPAD.<br>
                Portal de Datos Abiertos: <a href="https://datos.comodoro.gov.ar" style="color: ${COLORS.primary}; text-decoration: none;">datos.comodoro.gov.ar</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

// =====================================================
// PLANTILLA PARA AVISO A ÁREAS (-40 días)
// =====================================================

export const areaAviso40dias = (areaData) => ({
  subject: `Aviso: Solicitud próxima de actualización de datos - ${areaData.area_nombre}`,
  html: areaAviso40diasTemplate(areaData)
});

// =====================================================
// PLANTILLA PARA FORMULARIO DE CONTACTO
// =====================================================

/**
 * Template para email recibido desde el formulario de contacto público
 */
export const contactoTemplate = (datos) => ({
  subject: `[RPAD Contacto] ${datos.tipo} - ${datos.nombre}`,
  html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nueva consulta desde RPAD</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${COLORS.light};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.primary} 100%); padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">📬 Nueva Consulta</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">Formulario de Contacto RPAD</p>
            </td>
          </tr>

          <!-- Accent Bar -->
          <tr>
            <td style="background-color: ${COLORS.primary}; height: 4px;"></td>
          </tr>

          <!-- Tipo de consulta -->
          <tr>
            <td style="padding: 24px 24px 16px 24px;">
              <table role="presentation" style="width: 100%; background-color: ${COLORS.light}; border-radius: 6px; border-left: 4px solid ${COLORS.primary};">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: ${COLORS.muted}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Tipo de consulta</p>
                    <p style="margin: 4px 0 0 0; color: ${COLORS.dark}; font-size: 16px; font-weight: 600;">${escapeHtml(datos.tipo)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Datos del remitente -->
          <tr>
            <td style="padding: 0 24px;">
              <h3 style="color: ${COLORS.dark}; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">Datos del remitente</h3>
              <table role="presentation" style="width: 100%; border: 1px solid ${COLORS.border}; border-radius: 6px;">
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid ${COLORS.border};">
                    <p style="margin: 0; color: ${COLORS.muted}; font-size: 12px;">Nombre</p>
                    <p style="margin: 4px 0 0 0; color: ${COLORS.dark}; font-size: 14px; font-weight: 500;">${escapeHtml(datos.nombre)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px;">
                    <p style="margin: 0; color: ${COLORS.muted}; font-size: 12px;">Email</p>
                    <p style="margin: 4px 0 0 0; color: ${COLORS.dark}; font-size: 14px;">
                      <a href="mailto:${escapeHtml(datos.email)}" style="color: ${COLORS.primary}; text-decoration: none;">${escapeHtml(datos.email)}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Mensaje -->
          <tr>
            <td style="padding: 24px;">
              <h3 style="color: ${COLORS.dark}; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">Mensaje</h3>
              <div style="background-color: ${COLORS.light}; border-radius: 6px; padding: 16px; border: 1px solid ${COLORS.border};">
                <p style="margin: 0; color: ${COLORS.dark}; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(datos.mensaje)}</p>
              </div>
            </td>
          </tr>

          <!-- Botón responder -->
          <tr>
            <td style="padding: 0 24px 24px 24px; text-align: center;">
              <a href="mailto:${escapeHtml(datos.email)}?subject=Re: ${encodeURIComponent(datos.tipo)}" style="display: inline-block; background-color: ${COLORS.primary}; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">Responder a ${escapeHtml(datos.nombre)}</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${COLORS.light}; padding: 16px 24px; border-top: 1px solid ${COLORS.border};">
              <p style="margin: 0; color: ${COLORS.muted}; font-size: 11px; text-align: center;">
                Recibido el ${escapeHtml(datos.fecha)}<br>
                <span style="color: ${COLORS.muted};">IP: ${escapeHtml(datos.ip)}</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
});

// =====================================================
// PLANTILLA PARA CAMBIOS PENDIENTES DE APROBACIÓN
// =====================================================

// Etiqueta y color del tipo de cambio en la lista de cambios de los emails
const badgeDeTipo = (tipo) => ({
  'crear': { color: COLORS.success, texto: 'CREAR' },
  'editar': { color: COLORS.warning, texto: 'EDITAR' },
  'eliminar': { color: COLORS.danger, texto: 'ELIMINAR' }
}[tipo] || { color: COLORS.muted, texto: tipo.toUpperCase() });

// Título del conjunto de datos de un cambio: el propuesto en un alta, el del dataset en los demás
const tituloDelCambio = (c) => (c.tipo_cambio === 'crear'
  ? (c.datos_nuevos?.titulo || 'Nuevo dataset')
  : (c.dataset_titulo || 'Dataset'));

// Recordatorio de cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 9.2). respaldo: la persona lo recibe
// porque no hay auditores disponibles
export const cambiosPendientesTemplate = (cambios, { respaldo = false } = {}) => ({
  subject: cambios.length === 1 ? '[RPAD] 1 cambio espera tu auditoría' : `[RPAD] ${cambios.length} cambios esperan tu auditoría`,
  html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cambios Pendientes de Aprobacion</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${COLORS.light};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.primary} 100%); padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">RPAD</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">Sistema de Aprobaciones</p>
            </td>
          </tr>

          <!-- Accent Bar -->
          <tr>
            <td style="background-color: ${COLORS.warning}; height: 4px;"></td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding: 24px 24px 16px 24px;">
              <h2 style="color: ${COLORS.dark}; margin: 0; font-size: 20px; font-weight: 600;">Cambios pendientes de revision</h2>
              <p style="color: ${COLORS.muted}; margin: 8px 0 0 0; font-size: 14px;">Hay ${cambios.length} cambio${cambios.length > 1 ? 's' : ''} esperando tu auditoría</p>
            </td>
          </tr>

          <!-- Action Box -->
          <tr>
            <td style="padding: 0 24px;">
              <table role="presentation" style="width: 100%; background-color: ${COLORS.light}; border-radius: 6px; border-left: 4px solid ${COLORS.warning};">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: ${COLORS.dark}; font-size: 14px;"><strong>Accion requerida:</strong></p>
                    <p style="margin: 8px 0 0 0; color: ${COLORS.muted}; font-size: 14px;">Por favor, revisa y aprueba o rechaza los siguientes cambios propuestos por otras personas.</p>
                    ${respaldo ? `<p style="margin: 8px 0 0 0; color: ${COLORS.dark}; font-size: 14px;"><strong>Te llega como respaldo: no hay auditores disponibles.</strong></p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 24px;">
              <hr style="border: none; border-top: 1px solid ${COLORS.border}; margin: 0;">
            </td>
          </tr>

          <!-- Cambios List -->
          <tr>
            <td style="padding: 0 24px;">
              <p style="margin: 0 0 16px 0; color: ${COLORS.dark}; font-size: 14px; font-weight: 600;">Cambios pendientes:</p>
              ${cambios.map((c, i) => {
                const tipoBadge = badgeDeTipo(c.tipo_cambio);
                const titulo = tituloDelCambio(c);

                return `
                <table role="presentation" style="width: 100%; margin-bottom: 12px; background-color: #ffffff; border: 1px solid ${COLORS.border}; border-radius: 6px;">
                  <tr>
                    <td style="padding: 12px;">
                      <p style="margin: 0 0 8px 0;">
                        <span style="display: inline-block; background-color: ${tipoBadge.color}; color: #ffffff; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">${tipoBadge.texto}</span>
                      </p>
                      <p style="margin: 0; color: ${COLORS.dark}; font-size: 14px; font-weight: 600;">${escapeHtml(titulo)}</p>
                      <p style="margin: 4px 0 0 0; color: ${COLORS.muted}; font-size: 12px;">Propuesto por: ${escapeHtml(c.usuario_nombre || c.usuario_username)}</p>
                      <p style="margin: 2px 0 0 0; color: ${COLORS.muted}; font-size: 11px;">${escapeHtml(c.tiempo_pendiente)}</p>
                    </td>
                  </tr>
                </table>
              `}).join('')}
            </td>
          </tr>

          <!-- RPAD Link -->
          <tr>
            <td style="padding: 24px; text-align: center;">
              <a href="${RPAD_URL}/perfil.html" style="display: inline-block; background-color: ${COLORS.primary}; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">Revisar cambios en RPAD</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${COLORS.light}; padding: 16px 24px; text-align: center; border-top: 1px solid ${COLORS.border};">
              <p style="margin: 0; color: ${COLORS.muted}; font-size: 12px;">
                Sistema de Notificaciones RPAD v1.5.0<br>
                Direccion de Datos Publicos y Comunicacion<br>
                Municipalidad de Comodoro Rivadavia
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
});

/**
 * Aviso a quien propuso cambios que no tienen a nadie disponible para auditarlos (recordatorio de las 14:00).
 * cambios: los suyos, con tipo_cambio, dataset_titulo, datos_nuevos y fecha_propuesta ('AAAA-MM-DD').
 * hasta: el primer día hábil en que alguien puede auditarlos ('AAAA-MM-DD'), o null si no hay uno a la vista.
 */
export const sinAuditorTemplate = (cambios, { hasta = null } = {}) => {
  const uno = cambios.length === 1;
  const plazo = hasta ? `hasta el ${formatoCorto(hasta)}` : 'por ahora';
  const situacion = `${hasta ? `Hasta el ${formatoCorto(hasta)}` : 'Por ahora'} no hay ningún auditor disponible para revisar ${uno ? 'este cambio' : 'estos cambios'}.`;
  const cierre = 'Mientras tanto, el conjunto de datos sigue bloqueado para nuevas modificaciones. Apenas vuelva a haber un auditor disponible, le llega el recordatorio.';
  return {
    subject: uno
      ? `[RPAD] Tu cambio en ${tituloDelCambio(cambios[0])} queda sin auditor disponible ${plazo}`
      : `[RPAD] ${cambios.length} cambios tuyos quedan sin auditor disponible ${plazo}`,
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sin auditor disponible</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${COLORS.light};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.primary} 100%); padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">RPAD</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">Sistema de Aprobaciones</p>
            </td>
          </tr>

          <!-- Accent Bar -->
          <tr>
            <td style="background-color: ${COLORS.warning}; height: 4px;"></td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding: 24px 24px 16px 24px;">
              <h2 style="color: ${COLORS.dark}; margin: 0; font-size: 20px; font-weight: 600;">Sin auditor disponible</h2>
            </td>
          </tr>

          <!-- Situación -->
          <tr>
            <td style="padding: 0 24px;">
              <table role="presentation" style="width: 100%; background-color: ${COLORS.light}; border-radius: 6px; border-left: 4px solid ${COLORS.warning};">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: ${COLORS.dark}; font-size: 14px;">${escapeHtml(situacion)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 24px;">
              <hr style="border: none; border-top: 1px solid ${COLORS.border}; margin: 0;">
            </td>
          </tr>

          <!-- Cambios List -->
          <tr>
            <td style="padding: 0 24px;">
              <p style="margin: 0 0 16px 0; color: ${COLORS.dark}; font-size: 14px; font-weight: 600;">Cambios pendientes:</p>
              ${cambios.map((c) => {
                const tipoBadge = badgeDeTipo(c.tipo_cambio);
                return `
                <table role="presentation" style="width: 100%; margin-bottom: 12px; background-color: #ffffff; border: 1px solid ${COLORS.border}; border-radius: 6px;">
                  <tr>
                    <td style="padding: 12px;">
                      <p style="margin: 0 0 8px 0;">
                        <span style="display: inline-block; background-color: ${tipoBadge.color}; color: #ffffff; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">${escapeHtml(tipoBadge.texto)}</span>
                      </p>
                      <p style="margin: 0; color: ${COLORS.dark}; font-size: 14px; font-weight: 600;">${escapeHtml(tituloDelCambio(c))}</p>
                      <p style="margin: 4px 0 0 0; color: ${COLORS.muted}; font-size: 12px;">Fecha de la propuesta: ${escapeHtml(formatoCorto(c.fecha_propuesta))}</p>
                    </td>
                  </tr>
                </table>
              `;
              }).join('')}
            </td>
          </tr>

          <!-- Cierre -->
          <tr>
            <td style="padding: 12px 24px 24px 24px;">
              <p style="margin: 0; color: ${COLORS.dark}; font-size: 14px; line-height: 1.6;">${escapeHtml(cierre)}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${COLORS.light}; padding: 16px 24px; text-align: center; border-top: 1px solid ${COLORS.border};">
              <p style="margin: 0; color: ${COLORS.muted}; font-size: 12px;">
                Sistema de Notificaciones RPAD v1.5.0<br>
                Direccion de Datos Publicos y Comunicacion<br>
                Municipalidad de Comodoro Rivadavia
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
  };
};

// =====================================================
// PLANTILLAS DE USUARIOS: acceso al RPAD y avisos al superadmin (spec 10)
// =====================================================

/**
 * Email simple con el formato de los demás: encabezado, título, párrafos, botón y notas al pie.
 * parrafos y notas: HTML ya escapado (pueden traer <strong>). boton: { texto, url } o null.
 */
export const plantillaSimple = ({ titulo, parrafos, boton = null, notas = [] }) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(titulo)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${COLORS.light};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.primary} 100%); padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">RPAD</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">Registro Permanente de Actualización de Datasets</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 24px 8px 24px;">
              <h2 style="color: ${COLORS.dark}; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">${escapeHtml(titulo)}</h2>
              ${parrafos.map(p => `<p style="margin: 0 0 12px 0; color: ${COLORS.dark}; font-size: 14px; line-height: 1.6;">${p}</p>`).join('')}
            </td>
          </tr>
          ${boton ? `
          <tr>
            <td style="padding: 8px 24px 24px 24px; text-align: center;">
              <a href="${escapeHtml(boton.url)}" style="display: inline-block; background-color: ${COLORS.primary}; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">${escapeHtml(boton.texto)}</a>
            </td>
          </tr>` : ''}
          ${notas.length > 0 ? `
          <tr>
            <td style="padding: 0 24px 24px 24px;">
              ${notas.map(n => `<p style="margin: 0 0 8px 0; color: ${COLORS.muted}; font-size: 12px; line-height: 1.5;">${n}</p>`).join('')}
            </td>
          </tr>` : ''}
          <tr>
            <td style="background-color: ${COLORS.light}; padding: 16px 24px; text-align: center; border-top: 1px solid ${COLORS.border};">
              <p style="margin: 0; color: ${COLORS.muted}; font-size: 12px;">
                Dirección de Datos Públicos y Comunicación<br>
                Municipalidad de Comodoro Rivadavia
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// Invitación: el usuario elige su contraseña por primera vez (spec 10.1). vence: texto de fecha y hora
export const invitacionTemplate = ({ nombre_completo, username, rol, link, vence }) => {
  const rolTexto = TEXTO_ROL[rol] || rol;
  return {
    subject: 'Tu acceso al RPAD',
    html: plantillaSimple({
      titulo: 'Tu acceso al RPAD',
      parrafos: [
        `Hola, ${escapeHtml(nombre_completo)}.`,
        `Te dieron acceso al Registro Permanente de Actualización de Datasets (RPAD) con el usuario <strong>${escapeHtml(username)}</strong> y el rol <strong>${escapeHtml(rolTexto)}</strong>.`,
        'Para empezar, elegí tu contraseña con el botón de abajo.'
      ],
      boton: { texto: 'Elegir mi contraseña', url: link },
      notas: [
        `El link sirve una sola vez y vence el ${escapeHtml(vence)} h.`,
        'Si vence, pedí uno nuevo desde "¿Olvidaste tu contraseña?" en la pantalla de ingreso, o pedíselo a un administrador.'
      ]
    }),
    text: [
      `Hola, ${nombre_completo}.`,
      '',
      `Te dieron acceso al RPAD con el usuario ${username} y el rol ${rolTexto}.`,
      'Elegí tu contraseña en este link:',
      link,
      '',
      `El link sirve una sola vez y vence el ${vence} h.`,
      'Si vence, pedí uno nuevo desde "¿Olvidaste tu contraseña?" en la pantalla de ingreso, o pedíselo a un administrador.'
    ].join('\n')
  };
};

// Recuperación: reset desde el panel o "¿Olvidaste tu contraseña?" (spec 10.2)
export const recuperacionTemplate = ({ nombre_completo, username, link, vence }) => ({
  subject: 'Restablecé tu contraseña del RPAD',
  html: plantillaSimple({
    titulo: 'Restablecé tu contraseña',
    parrafos: [
      `Hola, ${escapeHtml(nombre_completo)}.`,
      `Recibimos un pedido para restablecer la contraseña del usuario <strong>${escapeHtml(username)}</strong> en el RPAD.`
    ],
    boton: { texto: 'Elegir una contraseña nueva', url: link },
    notas: [
      `El link sirve una sola vez y vence el ${escapeHtml(vence)} h.`,
      'Si no lo pediste, ignorá este email: tu contraseña actual sigue funcionando.'
    ]
  }),
  text: [
    `Hola, ${nombre_completo}.`,
    '',
    `Recibimos un pedido para restablecer la contraseña del usuario ${username} en el RPAD.`,
    'Elegí una contraseña nueva en este link:',
    link,
    '',
    `El link sirve una sola vez y vence el ${vence} h.`,
    'Si no lo pediste, ignorá este email: tu contraseña actual sigue funcionando.'
  ].join('\n')
});

// Aviso al superadmin cuando otro admin crea un admin, cambia un rol o desactiva a alguien (spec 10.3)
export const avisoSuperadminTemplate = ({ actor, afectado, cambio, fecha }) => {
  const cuando = fechaHoraArgentina(fecha);
  const quien = `${actor.nombre_completo} (${actor.username})`;
  const aQuien = `${afectado.nombre_completo} (${afectado.username})`;
  return {
    subject: 'RPAD: cambio en los usuarios',
    html: plantillaSimple({
      titulo: 'Cambio en los usuarios del RPAD',
      parrafos: [
        `<strong>${escapeHtml(quien)}</strong> hizo este cambio:`,
        `${escapeHtml(aQuien)}: <strong>${escapeHtml(cambio)}</strong>`,
        `Fecha: ${escapeHtml(cuando)} h`
      ],
      boton: { texto: 'Ver el panel de usuarios', url: `${RPAD_URL}/usuarios.html` },
      notas: ['Este aviso te llega porque sos superadmin y el cambio lo hizo otro administrador.']
    }),
    text: [
      `${quien} hizo este cambio:`,
      `${aQuien}: ${cambio}`,
      `Fecha: ${cuando} h`,
      '',
      `Panel de usuarios: ${RPAD_URL}/usuarios.html`
    ].join('\n')
  };
};

// Resumen de los avisos al superadmin que no se enviaron durante su licencia
// (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.4). retenidos: filas del historial con created_at, actor y afectado.
export const resumenAvisosRetenidosTemplate = (retenidos) => {
  const lineas = retenidos.map(r => ({
    cuando: fechaHoraArgentina(new Date(r.created_at)),
    quien: r.actor_nombre ? `${r.actor_nombre} (${r.actor_username})` : 'Sin registro',
    aQuien: `${r.afectado_nombre} (${r.afectado_username})`,
    cambio: r.cambio
  }));
  const cuantos = lineas.length === 1
    ? 'hubo un cambio que te habría llegado'
    : `hubo ${lineas.length} cambios que te habrían llegado`;
  return {
    subject: 'RPAD: cambios en los usuarios durante tu licencia',
    html: plantillaSimple({
      titulo: 'Cambios en los usuarios durante tu licencia',
      parrafos: [
        `Mientras estabas de licencia ${cuantos} como aviso:`,
        ...lineas.map(l => `${escapeHtml(l.cuando)} h – <strong>${escapeHtml(l.quien)}</strong>: ${escapeHtml(l.aQuien)}: <strong>${escapeHtml(l.cambio)}</strong>`)
      ],
      boton: { texto: 'Ver el panel de usuarios', url: `${RPAD_URL}/usuarios.html` },
      notas: ['Este resumen te llega porque sos superadmin y estos avisos no se enviaron durante tu licencia.']
    }),
    text: [
      `Mientras estabas de licencia ${cuantos} como aviso:`,
      ...lineas.map(l => `- ${l.cuando} h – ${l.quien}: ${l.aQuien}: ${l.cambio}`),
      '',
      `Panel de usuarios: ${RPAD_URL}/usuarios.html`
    ].join('\n')
  };
};
