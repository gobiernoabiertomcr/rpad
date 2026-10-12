/**
 * Plantillas de email para notificaciones RPAD
 * Colores institucionales basados en styles.css
 */

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

const RPAD_URL = 'https://rpad.mcrmodernizacion.gob.ar';

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
 * Genera el HTML base del email
 */
const baseTemplate = ({ title, subtitle, actionText, datasets, accentColor }) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${COLORS.light};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.primary} 100%); padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">📊 RPAD</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">Sistema de Notificaciones</p>
            </td>
          </tr>

          <!-- Accent Bar -->
          <tr>
            <td style="background-color: ${accentColor}; height: 4px;"></td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding: 24px 24px 16px 24px;">
              <h2 style="color: ${COLORS.dark}; margin: 0; font-size: 20px; font-weight: 600;">${title}</h2>
              <p style="color: ${COLORS.muted}; margin: 8px 0 0 0; font-size: 14px;">${subtitle}</p>
            </td>
          </tr>

          <!-- Action Box -->
          <tr>
            <td style="padding: 0 24px;">
              <table role="presentation" style="width: 100%; background-color: ${COLORS.light}; border-radius: 6px; border-left: 4px solid ${accentColor};">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: ${COLORS.dark}; font-size: 14px;"><strong>Acción recomendada:</strong></p>
                    <p style="margin: 8px 0 0 0; color: ${COLORS.muted}; font-size: 14px;">${actionText}</p>
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

          <!-- Datasets List -->
          <tr>
            <td style="padding: 0 24px;">
              <p style="margin: 0 0 16px 0; color: ${COLORS.dark}; font-size: 14px; font-weight: 600;">Datasets implicados:</p>
              ${datasets.map((d, i) => `
                <table role="presentation" style="width: 100%; margin-bottom: 12px; background-color: #ffffff; border: 1px solid ${COLORS.border}; border-radius: 6px;">
                  <tr>
                    <td style="padding: 12px;">
                      <p style="margin: 0; color: ${COLORS.dark}; font-size: 14px; font-weight: 600;">${i + 1}. ${escapeHtml(d.titulo)}</p>
                      <p style="margin: 4px 0 0 0; color: ${COLORS.muted}; font-size: 12px;">🔄 Frecuencia de actualización: ${escapeHtml(d.frecuencia_nombre || 'Sin definir')}</p>
                      <p style="margin: 6px 0 0 0; color: ${COLORS.muted}; font-size: 13px;">🏢 ${escapeHtml(d.area_nombre || d.area_responsable)}</p>
                      ${d.url_dataset ? `<p style="margin: 6px 0 0 0;"><a href="${d.url_dataset}" style="color: ${COLORS.primary}; font-size: 13px; text-decoration: none;">🔗 Ver en Portal de Datos Abiertos</a></p>` : ''}
                    </td>
                  </tr>
                </table>
              `).join('')}
            </td>
          </tr>

          <!-- RPAD Link -->
          <tr>
            <td style="padding: 24px; text-align: center;">
              <a href="${RPAD_URL}" style="display: inline-block; background-color: ${COLORS.primary}; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">Ver todos los datasets en RPAD</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${COLORS.light}; padding: 16px 24px; text-align: center; border-top: 1px solid ${COLORS.border};">
              <p style="margin: 0; color: ${COLORS.muted}; font-size: 12px;">
                Sistema de Notificaciones RPAD<br>
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
</html>
`;

/**
 * Template para externos -40 días (con datos de contacto del área)
 */
const externo40diasTemplate = (datasets) => {
  const datasetsHtml = datasets.map((d, i) => {
    // Construir líneas de contacto del área
    const contactLines = [];
    if (d.area_superior) contactLines.push(`📍 ${escapeHtml(d.area_superior)}`);
    if (d.email_principal) contactLines.push(`📧 ${escapeHtml(d.email_principal)}`);
    if (d.email_secundario) contactLines.push(`📧 ${escapeHtml(d.email_secundario)}`);
    if (d.telefono_area) contactLines.push(`📞 ${escapeHtml(d.telefono_area)}`);
    if (d.celular_area) contactLines.push(`📱 ${escapeHtml(d.celular_area)}`);
    if (d.nombre_contacto) {
      let contactoStr = `👤 ${escapeHtml(d.nombre_contacto)}`;
      if (d.telefono_contacto) contactoStr += ` - ${escapeHtml(d.telefono_contacto)}`;
      if (d.email_contacto) contactoStr += ` - ${escapeHtml(d.email_contacto)}`;
      contactLines.push(contactoStr);
    }

    return `
      <table role="presentation" style="width: 100%; margin-bottom: 16px; background-color: #ffffff; border: 1px solid ${COLORS.border}; border-radius: 6px;">
        <tr>
          <td style="padding: 16px;">
            <p style="margin: 0; color: ${COLORS.dark}; font-size: 15px; font-weight: 600;">${i + 1}. ${escapeHtml(d.titulo)}</p>
            <p style="margin: 4px 0 0 0; color: ${COLORS.muted}; font-size: 12px;">🔄 Frecuencia de actualización: ${escapeHtml(d.frecuencia_nombre || 'Sin definir')}</p>
            <p style="margin: 8px 0 4px 0; color: ${COLORS.dark}; font-size: 14px; font-weight: 500;">🏢 ${escapeHtml(d.area_nombre)}</p>
            ${contactLines.length > 0 ? `
              <div style="margin: 8px 0 0 0; padding: 10px; background-color: ${COLORS.light}; border-radius: 4px;">
                ${contactLines.map(line => `<p style="margin: 4px 0; color: ${COLORS.muted}; font-size: 13px;">${line}</p>`).join('')}
              </div>
            ` : `<p style="margin: 8px 0 0 0; color: ${COLORS.orange}; font-size: 13px;">⚠️ Sin datos de contacto configurados</p>`}
            ${d.url_dataset ? `<p style="margin: 10px 0 0 0;"><a href="${d.url_dataset}" style="color: ${COLORS.primary}; font-size: 13px; text-decoration: none;">🔗 Ver en Portal de Datos Abiertos</a></p>` : ''}
          </td>
        </tr>
      </table>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Logística: Distribución de Notas</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${COLORS.light};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px;">
        <table role="presentation" style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.primary} 100%); padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">📊 RPAD</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">Sistema de Notificaciones</p>
            </td>
          </tr>

          <!-- Accent Bar -->
          <tr>
            <td style="background-color: ${COLORS.warning}; height: 4px;"></td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding: 24px 24px 16px 24px;">
              <h2 style="color: ${COLORS.dark}; margin: 0; font-size: 20px; font-weight: 600;">Fase de distribución</h2>
              <p style="color: ${COLORS.muted}; margin: 8px 0 0 0; font-size: 14px;">Restan pocos días para que los siguientes datos pierdan vigencia. Este es el momento indicado para enviar las solicitudes: el tiempo que demora el circuito administrativo permitirá que lleguen a destino cuando la información ya esté completa y disponible.</p>
            </td>
          </tr>

          <!-- Action Box -->
          <tr>
            <td style="padding: 0 24px;">
              <table role="presentation" style="width: 100%; background-color: ${COLORS.light}; border-radius: 6px; border-left: 4px solid ${COLORS.warning};">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: ${COLORS.dark}; font-size: 14px;"><strong>Acción recomendada:</strong></p>
                    <p style="margin: 8px 0 0 0; color: ${COLORS.muted}; font-size: 14px;">Gestionar el envío de las notas a las áreas correspondientes. Debajo figuran los datos de contactos para facilitar la gestión.</p>
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

          <!-- Datasets List with Contact Info -->
          <tr>
            <td style="padding: 0 24px;">
              <p style="margin: 0 0 16px 0; color: ${COLORS.dark}; font-size: 14px; font-weight: 600;">Datasets y datos de contacto:</p>
              ${datasetsHtml}
            </td>
          </tr>

          <!-- RPAD Link -->
          <tr>
            <td style="padding: 24px; text-align: center;">
              <a href="${RPAD_URL}" style="display: inline-block; background-color: ${COLORS.primary}; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">Ver todos los datasets en RPAD</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${COLORS.light}; padding: 16px 24px; text-align: center; border-top: 1px solid ${COLORS.border};">
              <p style="margin: 0; color: ${COLORS.muted}; font-size: 12px;">
                Sistema de Notificaciones RPAD<br>
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
</html>
`;
};

/**
 * Genera HTML de datasets con datos de contacto completos
 * Reutilizable para todos los templates de gestión externa
 */
const generarDatasetsConContacto = (datasets) => {
  return datasets.map((d, i) => {
    const contactLines = [];
    if (d.area_superior) contactLines.push(`📍 ${escapeHtml(d.area_superior)}`);
    if (d.email_principal) contactLines.push(`📧 ${escapeHtml(d.email_principal)}`);
    if (d.email_secundario) contactLines.push(`📧 ${escapeHtml(d.email_secundario)}`);
    if (d.telefono_area) contactLines.push(`📞 ${escapeHtml(d.telefono_area)}`);
    if (d.celular_area) contactLines.push(`📱 ${escapeHtml(d.celular_area)}`);
    if (d.nombre_contacto) {
      let contactoStr = `👤 ${escapeHtml(d.nombre_contacto)}`;
      if (d.telefono_contacto) contactoStr += ` - ${escapeHtml(d.telefono_contacto)}`;
      if (d.email_contacto) contactoStr += ` - ${escapeHtml(d.email_contacto)}`;
      contactLines.push(contactoStr);
    }

    return `
      <table role="presentation" style="width: 100%; margin-bottom: 16px; background-color: #ffffff; border: 1px solid ${COLORS.border}; border-radius: 6px;">
        <tr>
          <td style="padding: 16px;">
            <p style="margin: 0; color: ${COLORS.dark}; font-size: 15px; font-weight: 600;">${i + 1}. ${escapeHtml(d.titulo)}</p>
            <p style="margin: 4px 0 0 0; color: ${COLORS.muted}; font-size: 12px;">🔄 Frecuencia de actualización: ${escapeHtml(d.frecuencia_nombre || 'Sin definir')}</p>
            <p style="margin: 8px 0 4px 0; color: ${COLORS.dark}; font-size: 14px; font-weight: 500;">🏢 ${escapeHtml(d.area_nombre)}</p>
            ${contactLines.length > 0 ? `
              <div style="margin: 8px 0 0 0; padding: 10px; background-color: ${COLORS.light}; border-radius: 4px;">
                ${contactLines.map(line => `<p style="margin: 4px 0; color: ${COLORS.muted}; font-size: 13px;">${line}</p>`).join('')}
              </div>
            ` : `<p style="margin: 8px 0 0 0; color: ${COLORS.orange}; font-size: 13px;">⚠️ Sin datos de contacto configurados</p>`}
            ${d.url_dataset ? `<p style="margin: 10px 0 0 0;"><a href="${d.url_dataset}" style="color: ${COLORS.primary}; font-size: 13px; text-decoration: none;">🔗 Ver en Portal de Datos Abiertos</a></p>` : ''}
          </td>
        </tr>
      </table>
    `;
  }).join('');
};

/**
 * Template base para externos con datos de contacto
 */
const baseExternoConContacto = ({ title, subtitle, actionText, datasets, accentColor }) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${COLORS.light};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px;">
        <table role="presentation" style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.primary} 100%); padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">📊 RPAD</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">Sistema de Notificaciones</p>
            </td>
          </tr>

          <!-- Accent Bar -->
          <tr>
            <td style="background-color: ${accentColor}; height: 4px;"></td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding: 24px 24px 16px 24px;">
              <h2 style="color: ${COLORS.dark}; margin: 0; font-size: 20px; font-weight: 600;">${title}</h2>
              <p style="color: ${COLORS.muted}; margin: 8px 0 0 0; font-size: 14px;">${subtitle}</p>
            </td>
          </tr>

          <!-- Action Box -->
          <tr>
            <td style="padding: 0 24px;">
              <table role="presentation" style="width: 100%; background-color: ${COLORS.light}; border-radius: 6px; border-left: 4px solid ${accentColor};">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: ${COLORS.dark}; font-size: 14px;"><strong>Acción recomendada:</strong></p>
                    <p style="margin: 8px 0 0 0; color: ${COLORS.muted}; font-size: 14px;">${actionText}</p>
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

          <!-- Datasets List con datos de contacto -->
          <tr>
            <td style="padding: 0 24px;">
              <p style="margin: 0 0 16px 0; color: ${COLORS.dark}; font-size: 14px; font-weight: 600;">Datasets y datos de contacto:</p>
              ${generarDatasetsConContacto(datasets)}
            </td>
          </tr>

          <!-- RPAD Link -->
          <tr>
            <td style="padding: 24px; text-align: center;">
              <a href="${RPAD_URL}" style="display: inline-block; background-color: ${COLORS.primary}; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">Ver todos los datasets en RPAD</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${COLORS.light}; padding: 16px 24px; text-align: center; border-top: 1px solid ${COLORS.border};">
              <p style="margin: 0; color: ${COLORS.muted}; font-size: 12px;">
                Sistema de Notificaciones RPAD<br>
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
</html>
`;

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
                      📱 Whatsapp: 297 4056894<br>
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
// PLANTILLAS PARA INTERNOS
// =====================================================

export const interno60dias = (datasets) => ({
  subject: 'Planificación: Datasets Internos (60 días)',
  html: baseTemplate({
    title: 'Hola, equipo',
    subtitle: 'Es momento de iniciar la planificación',
    actionText: 'Los siguientes datasets gestionados por nuestra dirección vencen en dos meses. Recomendamos revisar las fuentes de datos y verificar disponibilidad técnica.',
    datasets,
    accentColor: COLORS.primary
  })
});

export const interno30dias = (datasets) => ({
  subject: 'Atención: Vencimiento en 1 mes (Internos)',
  html: baseTemplate({
    title: 'Aviso de actualización',
    subtitle: 'Restan 30 días para la fecha límite',
    actionText: 'Los siguientes datasets gestionados por nuestra dirección requieren actualización. Por favor, es importante priorizar su procesamiento para evitar atrasos.',
    datasets,
    accentColor: COLORS.warning
  })
});

export const internoVencido = (datasets) => ({
  subject: 'Resumen Mensual: Datasets Atrasados (Internos)',
  html: baseTemplate({
    title: 'Reporte de estado: Atrasado',
    subtitle: 'Resumen de relevamientos/datos dependientes de nuestra área que se encuentran atrasados',
    actionText: 'Los siguientes datasets gestionados por nuestra dirección figuran como vencidos en el sistema. Es necesario regularizar su situación a la brevedad para mantener el cumplimiento de la Ordenanza N° 17.662/23.',
    datasets,
    accentColor: COLORS.danger
  })
});

// =====================================================
// PLANTILLAS PARA EXTERNOS
// =====================================================

export const externo60dias = (datasets) => ({
  subject: 'Gestión Administrativa: Redacción de Notas',
  html: baseExternoConContacto({
    title: 'Inicio del proceso administrativo',
    subtitle: 'Los siguientes datos caducan en aproximadamente 30 días. Este es el momento para comenzar a gestionar su actualización.',
    actionText: 'Se sugiere iniciar la redacción de las notas de solicitud dirigidas a las áreas responsables. Debajo encontrarán los contactos de contacto.',
    datasets,
    accentColor: COLORS.primary
  })
});

export const externo40dias = (datasets) => ({
  subject: 'Logística: Distribución de Notas',
  html: externo40diasTemplate(datasets)
});

export const externo5dias = (datasets) => ({
  subject: 'Seguimiento: Vencimiento Inminente',
  html: baseExternoConContacto({
    title: 'Alerta de plazo',
    subtitle: 'Los siguientes datatasets perdieron vigencia hace aproximadamente un mes.',
    actionText: 'Se recomienda contactar telefónicamente o vía email al área responsable para agilizar el envío de los datos. Debajo encontrará la información de contacto.',
    datasets,
    accentColor: COLORS.orange
  })
});

export const externoVencido = (datasets) => ({
  subject: 'Resumen Mensual: Sin Respuesta (Externos)',
  html: baseExternoConContacto({
    title: 'Reporte de estado: Sin Respuesta',
    subtitle: 'Resumen de solicitudes enviadas que aún no recibieron respuesta',
    actionText: 'Aún aguardamos respuesta de las siguientes áreas externas. Se recomienda iniciar las acciones de reclamo o reiteración de solicitud',
    datasets,
    accentColor: COLORS.danger
  })
});

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

export const cambiosPendientesTemplate = (cambios) => ({
  subject: `[RPAD] Hay ${cambios.length} cambio${cambios.length > 1 ? 's' : ''} pendiente${cambios.length > 1 ? 's' : ''} de aprobacion`,
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
              <p style="color: ${COLORS.muted}; margin: 8px 0 0 0; font-size: 14px;">Hay ${cambios.length} cambio${cambios.length > 1 ? 's' : ''} esperando tu aprobacion</p>
            </td>
          </tr>

          <!-- Action Box -->
          <tr>
            <td style="padding: 0 24px;">
              <table role="presentation" style="width: 100%; background-color: ${COLORS.light}; border-radius: 6px; border-left: 4px solid ${COLORS.warning};">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: ${COLORS.dark}; font-size: 14px;"><strong>Accion requerida:</strong></p>
                    <p style="margin: 8px 0 0 0; color: ${COLORS.muted}; font-size: 14px;">Por favor, revisa y aprueba o rechaza los siguientes cambios propuestos por otros administradores.</p>
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
                const tipoBadge = {
                  'crear': { color: COLORS.success, texto: 'CREAR' },
                  'editar': { color: COLORS.warning, texto: 'EDITAR' },
                  'eliminar': { color: COLORS.danger, texto: 'ELIMINAR' }
                }[c.tipo_cambio] || { color: COLORS.muted, texto: c.tipo_cambio.toUpperCase() };
                
                const titulo = c.tipo_cambio === 'crear' 
                  ? (c.datos_nuevos?.titulo || 'Nuevo dataset')
                  : (c.dataset_titulo || 'Dataset');

                return `
                <table role="presentation" style="width: 100%; margin-bottom: 12px; background-color: #ffffff; border: 1px solid ${COLORS.border}; border-radius: 6px;">
                  <tr>
                    <td style="padding: 12px;">
                      <p style="margin: 0 0 8px 0;">
                        <span style="display: inline-block; background-color: ${tipoBadge.color}; color: #ffffff; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">${tipoBadge.texto}</span>
                      </p>
                      <p style="margin: 0; color: ${COLORS.dark}; font-size: 14px; font-weight: 600;">${escapeHtml(titulo)}</p>
                      <p style="margin: 4px 0 0 0; color: ${COLORS.muted}; font-size: 12px;">Propuesto por: ${escapeHtml(c.usuario_nombre || c.usuario_username)}</p>
                      <p style="margin: 2px 0 0 0; color: ${COLORS.muted}; font-size: 11px;">Hace ${c.tiempo_pendiente}</p>
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
