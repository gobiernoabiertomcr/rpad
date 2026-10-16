/**
 * Plantillas de los emails del sistema RPAD. Las Notas Digitales no están acá: su HTML, su texto y su PDF salen de
 * notasDigitalesContenido.js y notasDigitalesPdf.js.
 * Todas usan el mismo marco (marcoEmail), con el diseño "celeste institucional": HTML de email (tablas con
 * role="presentation" y estilos en línea), colores pastel, sin degradés, sombras ni emojis.
 */

import { TEXTO_ROL } from './usuariosReglas.js';
import { formatoCorto } from './notasDigitalesCalendario.js';

// Paleta de los emails
const COLORES = {
  pagina: '#F7F9FB',
  tarjeta: '#FFFFFF',
  borde: '#E4E9EF',
  encabezado: '#E3EEF8',
  bordeEncabezado: '#CFE0F0',
  titulo: '#1F3A5F', // título del encabezado y títulos dentro del cuerpo
  subtitulo: '#5A7391',
  texto: '#2B3A4A',
  secundario: '#6B7A8C',
  recuadro: '#F4F8FC',
  bordeRecuadro: '#E1EAF3',
  acento: '#3E6B96', // botón y links
  firma: '#A9C7E4',
  pie: '#8A97A6',
  respaldo: { fondo: '#FBF1DC', borde: '#F0DDB0', texto: '#7A5A14' }
};

// Etiqueta de cada tipo de cambio; un tipo desconocido va con los colores neutros
const ETIQUETAS = {
  crear: { fondo: '#DDF1E6', color: '#2E6B4C', texto: 'Crear' },
  editar: { fondo: '#DCEAF7', color: '#24507A', texto: 'Editar' },
  eliminar: { fondo: '#F8E1E1', color: '#8A3434', texto: 'Eliminar' }
};

const FUENTE = "'Segoe UI', Arial, sans-serif";

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

// =====================================================
// MARCO COMÚN Y PIEZAS DEL CUERPO
// =====================================================

// Encabezado y pie de todos los emails, salvo el aviso a las áreas (que lleva los institucionales)
const ENCABEZADO_RPAD = 'RPAD';
const SUBTITULO_RPAD = 'Registro Permanente de Actualización de Datasets';
const PIE_DIRECCION = ['Dirección de Datos Públicos y Comunicación', 'Municipalidad de Comodoro Rivadavia'];

/**
 * Marco de todos los emails: página gris muy clara, tarjeta blanca de hasta 600px, encabezado celeste pálido y pie.
 * Outlook de escritorio ignora max-width: la tarjeta va dentro de una tabla de 600 que solo ve Outlook (comentario mso).
 * titulo: el <title>. encabezado y subtitulo: texto plano. cuerpo: bloques de HTML ya escapado, uno por fila
 * (los null o vacíos se saltean). pie: líneas de HTML ya escapado.
 */
const marcoEmail = ({ titulo, encabezado = ENCABEZADO_RPAD, subtitulo = SUBTITULO_RPAD, cuerpo, pie = PIE_DIRECCION }) => {
  const bloques = cuerpo.filter(Boolean);
  const filas = bloques.map((bloque, i) => `
          <tr>
            <td style="padding: ${i === 0 ? '24px' : '0'} 24px ${i === bloques.length - 1 ? '24px' : '16px'} 24px;">
              ${bloque}
            </td>
          </tr>`).join('');
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(titulo)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLORES.pagina}; font-family: ${FUENTE};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; background-color: ${COLORES.pagina}; font-family: ${FUENTE};">
    <tr>
      <td style="padding: 24px 12px;">
        <!--[if mso]><table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: ${COLORES.tarjeta}; border: 1px solid ${COLORES.borde}; border-radius: 8px; border-collapse: separate; border-spacing: 0; overflow: hidden; font-family: ${FUENTE};">
          <tr>
            <td style="background-color: ${COLORES.encabezado}; border-bottom: 1px solid ${COLORES.bordeEncabezado}; padding: 20px 24px; text-align: center;">
              <h1 style="margin: 0; color: ${COLORES.titulo}; font-size: 18px; font-weight: 600;">${escapeHtml(encabezado)}</h1>
              <p style="margin: 4px 0 0 0; color: ${COLORES.subtitulo}; font-size: 13px;">${escapeHtml(subtitulo)}</p>
            </td>
          </tr>${filas}
          <tr>
            <td style="background-color: ${COLORES.pagina}; border-top: 1px solid ${COLORES.borde}; padding: 16px 24px; text-align: center;">
              <p style="margin: 0; color: ${COLORES.pie}; font-size: 12px; line-height: 1.5;">${pie.join('<br>')}</p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// Título del cuerpo y, si hay, una bajada en texto secundario. Texto plano
const tituloCuerpo = (titulo, bajada = null) =>
  `<h2 style="margin: 0; color: ${COLORES.titulo}; font-size: 18px; font-weight: 600;">${escapeHtml(titulo)}</h2>${
    bajada ? `<p style="margin: 6px 0 0 0; color: ${COLORES.secundario}; font-size: 14px;">${escapeHtml(bajada)}</p>` : ''}`;

// Título de una sección del cuerpo ("Cambios pendientes:", "Mensaje"). Texto plano
const tituloSeccion = (texto) =>
  `<h3 style="margin: 0 0 10px 0; color: ${COLORES.titulo}; font-size: 14px; font-weight: 600;">${escapeHtml(texto)}</h3>`;

// Párrafo con el texto principal. html: ya escapado
const parrafo = (html, margen = '0') =>
  `<p style="margin: ${margen}; color: ${COLORES.texto}; font-size: 14px; line-height: 1.6;">${html}</p>`;

// Caja de una sola celda (recuadro, tarjeta o aviso). html: ya escapado
const caja = (estilo, html) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; ${estilo}; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td style="padding: 14px 16px;">
                    ${html}
                  </td>
                </tr>
              </table>`;

// Recuadro informativo celeste muy claro
const recuadro = (html) => caja(`background-color: ${COLORES.recuadro}; border: 1px solid ${COLORES.bordeRecuadro}; border-radius: 6px`, html);

// Tarjeta blanca de un ítem (un cambio, un dataset, los datos de quien escribe)
const tarjeta = (html) => caja(`background-color: ${COLORES.tarjeta}; border: 1px solid ${COLORES.borde}; border-radius: 6px`, html);

// Lista de tarjetas, una por fila y separadas por filas de 10px de alto (Outlook de escritorio no respeta el margin
// entre tablas)
const SEPARADOR_DE_TARJETAS = `
                <tr>
                  <td height="10" style="height: 10px; font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>`;
const tarjetas = (contenidos) => (contenidos.length === 0 ? '' : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse;">${
  contenidos.map(html => `
                <tr>
                  <td>
                    ${tarjeta(html)}
                  </td>
                </tr>`).join(SEPARADOR_DE_TARJETAS)}
              </table>`);

// Aviso ámbar pálido ("te llega como respaldo"). html: ya escapado
const avisoDestacado = (html) => caja(
  `background-color: ${COLORES.respaldo.fondo}; border: 1px solid ${COLORES.respaldo.borde}; border-radius: 6px`,
  `<p style="margin: 0; color: ${COLORES.respaldo.texto}; font-size: 14px; line-height: 1.6;">${html}</p>`
);

// Botón centrado "a prueba de balas": el color y el padding van en la celda, con el link adentro (Outlook de escritorio
// no pinta el fondo ni el padding de un <a>). texto y url: sin escapar
const boton = ({ texto, url }) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 8px 0 0 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse: separate; border-spacing: 0;">
                      <tr>
                        <td align="center" bgcolor="${COLORES.acento}" style="background-color: ${COLORES.acento}; border-radius: 6px; padding: 10px 20px; font-size: 14px;">
                          <a href="${escapeHtml(url)}" style="display: inline-block; color: #FFFFFF; font-size: 14px; font-weight: 600; text-decoration: none;">${escapeHtml(texto)}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`;

// Link del cuerpo o del pie. href y html: ya escapados
const enlace = (href, html) => `<a href="${href}" style="color: ${COLORES.acento}; text-decoration: none;">${html}</a>`;

// Etiqueta pastel del tipo de cambio en la lista de cambios de los emails
const etiquetaDeTipo = (tipo) => {
  const { fondo, color, texto } = ETIQUETAS[tipo]
    || { fondo: COLORES.borde, color: COLORES.secundario, texto: tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase() };
  return `<span style="display: inline-block; background-color: ${fondo}; color: ${color}; font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 10px;">${escapeHtml(texto)}</span>`;
};

// Contenido de la tarjeta de un cambio: etiqueta, título y líneas en texto secundario (texto plano)
const contenidoDeCambio = (c, lineas) => `<p style="margin: 0 0 8px 0;">${etiquetaDeTipo(c.tipo_cambio)}</p>
                    <p style="margin: 0; color: ${COLORES.texto}; font-size: 14px; font-weight: 600;">${escapeHtml(tituloDelCambio(c))}</p>
                    ${lineas.map((l, i) => `<p style="margin: ${i === 0 ? '4px' : '2px'} 0 0 0; color: ${COLORES.secundario}; font-size: ${i === 0 ? 13 : 12}px;">${escapeHtml(l)}</p>`).join('')}`;

// =====================================================
// PLANTILLA PARA AVISO A ÁREAS (-40 días)
// =====================================================

/**
 * Template para aviso a áreas externas (-40 días)
 * Se envía directamente al email del área
 */
const areaAviso40diasTemplate = (areaData) => marcoEmail({
  titulo: 'Aviso de Solicitud de Actualización de Datos',
  encabezado: 'Municipalidad de Comodoro Rivadavia',
  subtitulo: 'Dirección General de Modernización e Investigación Territorial',
  cuerpo: [
    parrafo('Estimados/as:')
      + parrafo('Nos comunicamos desde la <strong>Dirección General de Modernización e Investigación Territorial</strong> de la Municipalidad de Comodoro Rivadavia para informarles que próximamente recibirán una nota formal solicitando la actualización de los siguientes datasets publicados en el Portal de Datos Abiertos:', '16px 0 0 0'),
    tarjetas(areaData.datasets.map((d, i) => `<p style="margin: 0; color: ${COLORES.texto}; font-size: 14px; font-weight: 600;">${i + 1}. ${escapeHtml(d.titulo)}</p>
                    <p style="margin: 4px 0 0 0; color: ${COLORES.secundario}; font-size: 13px;">Frecuencia de actualización: ${escapeHtml(d.frecuencia_nombre || 'Sin definir')}</p>
                    ${d.url_dataset ? `<p style="margin: 6px 0 0 0; font-size: 13px;">${enlace(escapeHtml(d.url_dataset), 'Ver dataset en el portal')}</p>` : ''}`)),
    parrafo('Gracias a su colaboración, mantener estos datos al día no solo permite dar cumplimiento a las obligaciones establecidas en la Ordenanza N.º 17.662/23 de Gobierno Abierto, sino que también facilita el acceso de la ciudadanía a información actualizada y agiliza los procesos administrativos tanto del Municipio como de otras organizaciones, reduciendo la necesidad de solicitar los datos por canales tradicionales. Quedamos a disposición para cualquier consulta. ¡Muchas gracias!'),
    `<table role="presentation" width="100%" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="border-left: 3px solid ${COLORES.firma}; padding-left: 12px;">
                    <p style="margin: 0; color: ${COLORES.titulo}; font-size: 14px; font-weight: 600;">Dirección de Datos Públicos y Comunicación</p>
                    <p style="margin: 2px 0 0 0; color: ${COLORES.secundario}; font-size: 13px;">Dirección General de Modernización e Investigación Territorial</p>
                    <p style="margin: 8px 0 0 0; color: ${COLORES.secundario}; font-size: 13px;">E-mail: ${enlace('mailto:datospublicos@comodoro.gov.ar', 'datospublicos@comodoro.gov.ar')}</p>
                  </td>
                </tr>
              </table>`
  ],
  pie: [
    'Este es un mensaje automático del sistema RPAD.',
    `Portal de Datos Abiertos: ${enlace('https://datos.comodoro.gov.ar', 'datos.comodoro.gov.ar')}`
  ]
});

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
  html: marcoEmail({
    titulo: 'Nueva consulta desde RPAD',
    cuerpo: [
      tituloCuerpo('Nueva Consulta', 'Formulario de Contacto RPAD'),
      recuadro(`<p style="margin: 0; color: ${COLORES.secundario}; font-size: 12px;">Tipo de consulta</p>
                    <p style="margin: 4px 0 0 0; color: ${COLORES.titulo}; font-size: 16px; font-weight: 600;">${escapeHtml(datos.tipo)}</p>`),
      tituloSeccion('Datos del remitente')
        + tarjeta(`<p style="margin: 0; color: ${COLORES.secundario}; font-size: 12px;">Nombre</p>
                    <p style="margin: 4px 0 0 0; color: ${COLORES.texto}; font-size: 14px; font-weight: 600;">${escapeHtml(datos.nombre)}</p>
                    <p style="margin: 12px 0 0 0; color: ${COLORES.secundario}; font-size: 12px;">Email</p>
                    <p style="margin: 4px 0 0 0; font-size: 14px;">${enlace(`mailto:${escapeHtml(datos.email)}`, escapeHtml(datos.email))}</p>`),
      tituloSeccion('Mensaje')
        + recuadro(`<p style="margin: 0; color: ${COLORES.texto}; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(datos.mensaje)}</p>`),
      boton({ texto: `Responder a ${datos.nombre}`, url: `mailto:${datos.email}?subject=Re: ${encodeURIComponent(datos.tipo)}` }),
      `<p style="margin: 0; color: ${COLORES.secundario}; font-size: 12px; text-align: center;">Recibido el ${escapeHtml(datos.fecha)}<br>IP: ${escapeHtml(datos.ip)}</p>`
    ]
  })
});

// =====================================================
// PLANTILLA PARA CAMBIOS PENDIENTES DE APROBACIÓN
// =====================================================

// Título del conjunto de datos de un cambio: el propuesto en un alta, el del dataset en los demás
const tituloDelCambio = (c) => (c.tipo_cambio === 'crear'
  ? (c.datos_nuevos?.titulo || 'Nuevo dataset')
  : (c.dataset_titulo || 'Dataset'));

// Recordatorio de cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 9.2). respaldo: la persona lo recibe
// porque no hay auditores disponibles
export const cambiosPendientesTemplate = (cambios, { respaldo = false } = {}) => ({
  subject: cambios.length === 1 ? '[RPAD] 1 cambio espera tu auditoría' : `[RPAD] ${cambios.length} cambios esperan tu auditoría`,
  html: marcoEmail({
    titulo: 'Cambios Pendientes de Aprobación',
    cuerpo: [
      tituloCuerpo('Cambios pendientes de revisión', `Hay ${cambios.length} cambio${cambios.length > 1 ? 's' : ''} esperando tu auditoría`),
      recuadro(`<p style="margin: 0; color: ${COLORES.texto}; font-size: 14px;"><strong>Acción requerida:</strong></p>
                    <p style="margin: 6px 0 0 0; color: ${COLORES.secundario}; font-size: 14px;">Por favor, revisa y aprueba o rechaza los siguientes cambios propuestos por otras personas.</p>`),
      respaldo ? avisoDestacado('<strong>Te llega como respaldo: no hay auditores disponibles.</strong>') : null,
      tituloSeccion('Cambios pendientes:')
        + tarjetas(cambios.map(c => contenidoDeCambio(c, [`Propuesto por: ${c.usuario_nombre || c.usuario_username || ''}`, c.tiempo_pendiente]))),
      boton({ texto: 'Revisar cambios en RPAD', url: `${RPAD_URL}/perfil.html#para-revisar` })
    ]
  })
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
    html: marcoEmail({
      titulo: 'Sin auditor disponible',
      cuerpo: [
        tituloCuerpo('Sin auditor disponible'),
        recuadro(`<p style="margin: 0; color: ${COLORES.texto}; font-size: 14px;">${escapeHtml(situacion)}</p>`),
        tituloSeccion('Cambios pendientes:')
          + tarjetas(cambios.map(c => contenidoDeCambio(c, [`Fecha de la propuesta: ${formatoCorto(c.fecha_propuesta)}`]))),
        parrafo(escapeHtml(cierre))
      ]
    })
  };
};

// =====================================================
// PLANTILLAS DE USUARIOS: acceso al RPAD y avisos al superadmin (spec 10)
// =====================================================

/**
 * Email simple con el marco de los demás: título, párrafos, botón y notas al pie.
 * parrafos y notas: HTML ya escapado (pueden traer <strong>). boton: { texto, url } o null.
 */
export const plantillaSimple = ({ titulo, parrafos, boton: botonDelEmail = null, notas = [] }) => marcoEmail({
  titulo,
  cuerpo: [
    tituloCuerpo(titulo) + parrafos.map((p, i) => parrafo(p, `${i === 0 ? '16px' : '12px'} 0 0 0`)).join(''),
    botonDelEmail ? boton(botonDelEmail) : null,
    notas.map((n, i) => `<p style="margin: ${i === 0 ? '0' : '8px'} 0 0 0; color: ${COLORES.secundario}; font-size: 12px; line-height: 1.5;">${n}</p>`).join('')
  ]
});

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
