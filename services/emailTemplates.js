/**
 * Plantillas de los emails del sistema RPAD. Las Notas Digitales no están acá: su HTML, su texto y su PDF salen de
 * notasDigitalesContenido.js y notasDigitalesPdf.js.
 * Todas usan el mismo marco (marcoEmail), con el diseño "celeste institucional": HTML de email (tablas con
 * role="presentation" y estilos en línea), colores pastel, sin degradés, sombras ni emojis.
 */

import { TEXTO_ROL } from './usuariosReglas.js';
import { formatoCorto } from './notasDigitalesCalendario.js';
import { frecuenciaEnNota } from './fechasDatasetReglas.js';
import { cuandoDelEvento, cuandoCortoDelEvento, cuandoEsElEvento, textoDelEvento } from './miEspacioEventosReglas.js';
import { diaLargo } from './miEspacioResumen.js';

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
  eliminar: { fondo: '#F8E1E1', color: '#8A3434', texto: 'Eliminar' },
  // Un registro de actualización: una edición con la marca registro_actualizacion (esRegistroDeActualizacion)
  actualizacion: { fondo: '#DCEAF7', color: '#24507A', texto: 'Actualización' }
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

// Un registro de actualización (POST /datasets/:id/actualizar) es una edición con la marca registro_actualizacion en
// datos_nuevos: en los emails es una "Actualización", como en la nota de auditoría, el Libro y Mi Perfil (spec
// 2026-10-17-fechas-datasets, 9)
const esRegistroDeActualizacion = (c) => c.tipo_cambio === 'editar' && c.datos_nuevos?.registro_actualizacion === true;

// Etiqueta pastel del tipo de cambio en la lista de cambios de los emails (c: el cambio)
const etiquetaDeTipo = (c) => {
  const tipo = esRegistroDeActualizacion(c) ? 'actualizacion' : c.tipo_cambio;
  const { fondo, color, texto } = ETIQUETAS[tipo]
    || { fondo: COLORES.borde, color: COLORES.secundario, texto: tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase() };
  return `<span style="display: inline-block; background-color: ${fondo}; color: ${color}; font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 10px;">${escapeHtml(texto)}</span>`;
};

// Contenido de la tarjeta de un cambio: etiqueta, título y líneas en texto secundario (texto plano)
const contenidoDeCambio = (c, lineas) => `<p style="margin: 0 0 8px 0;">${etiquetaDeTipo(c)}</p>
                    <p style="margin: 0; color: ${COLORES.texto}; font-size: 14px; font-weight: 600;">${escapeHtml(tituloDelCambio(c))}</p>
                    ${lineas.map((l, i) => `<p style="margin: ${i === 0 ? '4px' : '2px'} 0 0 0; color: ${COLORES.secundario}; font-size: ${i === 0 ? 13 : 12}px;">${escapeHtml(l)}</p>`).join('')}`;

// =====================================================
// PLANTILLA PARA AVISO A ÁREAS (-40 días)
// =====================================================

// "Del 01/01/2026 al 31/10/2026" → "del 01/01/2026 al 31/10/2026": el texto del pedido sigue a "Datos que se solicitarán: "
const conMinusculaInicial = (texto) => texto.charAt(0).toLowerCase() + texto.slice(1);

// Renglones de una tarjeta del aviso a las áreas, en texto secundario: la frecuencia y los datos que se solicitarán (sin
// fecha: desde el 18/10/2026 no lleva la fecha sugerida de envío, spec 2026-10-17-fechas-datasets, 18). Cada dataset trae su
// pedido ({ texto, ... } o null), su tipo de pedido efectivo y sus meses de datasetsExternosPorArea; sin pedido, el renglón
// de los datos no aparece. La frecuencia lleva "(Acumulado)" si el pedido acumula desde el 1/1 con una frecuencia menor al año.
const renglonesDeDataset = (d) => {
  const frecuencia = frecuenciaEnNota({ frecuencia: d.frecuencia_nombre, tipo: d.tipo_pedido, meses: d.meses });
  const renglones = [`Frecuencia de actualización: ${frecuencia || 'Sin definir'}`];
  if (d.pedido?.texto) renglones.push(`Datos que se solicitarán: ${conMinusculaInicial(d.pedido.texto)}`);
  return renglones.map((renglon, i) =>
    `<p style="margin: ${i === 0 ? '4px' : '2px'} 0 0 0; color: ${COLORES.secundario}; font-size: 13px;">${escapeHtml(renglon)}</p>`).join('\n                    ');
};

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
                    ${renglonesDeDataset(d)}
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

// Las notas del día, a quien las firma, con las notas adjuntas (spec 2026-11-03-notas-firma-digital, 4.4; el texto, el de la maqueta que
// aprobó el usuario). notas: [{ numero, anio, tipo, gestion }]. El primer nombre sale de nombre_completo
const CLASE_DE_NOTA = { aviso: 'aviso', reiteracion: 'reiteración', autorizacion: 'autorización', auditoria: 'auditoría' };
export const notasParaFirmarTemplate = ({ nombre, notas, url = `${RPAD_URL}/correos.html#libro` }) => {
  const primerNombre = String(nombre ?? '').trim().split(/\s+/)[0];
  const saludo = primerNombre ? `Buen día, ${primerNombre}.` : 'Buen día.';
  const cuantas = notas.length === 1 ? '1 nota' : `${notas.length} notas`;
  const renglon = (n) => `${CLASE_DE_NOTA[n.tipo] ?? n.tipo}${n.gestion ? `, gestión ${n.gestion}` : ''}`;
  const numero = (n) => `Nota Digital N° ${n.numero}/${String(n.anio).slice(-2)}`;
  const adjuntas = notas.length === 1 ? 'Te la adjuntamos para que no tengas que bajarla:' : 'Te las adjuntamos para que no tengas que bajarlas:';
  const pasos = notas.length === 1
    ? 'Firmala en el Firmador de firmar.gob.ar y subila en su fila, en la pantalla que abre el botón de abajo. Si el archivo no es esa nota, el RPAD te avisa. Antes de enviarla vas a poder mirarla.'
    : 'Firmalas en el Firmador de firmar.gob.ar, de a una, y subí cada una en su fila, en la pantalla que abre el botón de abajo. Si un archivo no es esa nota, el RPAD te avisa. Antes de enviarlas vas a poder mirarlas.';
  const cierre = 'A las 14:00 sale lo que quede: firmada si la subiste y la confirmaste, con la leyenda al pie; si no, con la imagen de tu firma y sin la leyenda, como siempre. Si hoy no podés, no hace falta que hagas nada. ¡Gracias!';
  return {
    subject: `RPAD: hoy tenés ${cuantas} para firmar`,
    html: plantillaSimple({
      titulo: 'Notas para firmar hoy',
      parrafos: [
        escapeHtml(saludo),
        `Hoy tenés <strong>${cuantas} para firmar</strong>. ${adjuntas}`,
        notas.map(n => `<strong>${numero(n)}</strong>: ${escapeHtml(renglon(n))}.`).join('<br>'),
        pasos
      ],
      boton: { texto: notas.length === 1 ? 'Subir la nota firmada' : 'Subir las notas firmadas', url },
      notas: [cierre]
    }),
    text: [
      saludo, '', `Hoy tenés ${cuantas} para firmar. ${adjuntas}`, ...notas.map(n => `${numero(n)}: ${renglon(n)}.`), '', pasos, '', `Subirlas: ${url}`, '', cierre
    ].join('\n')
  };
};

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
      boton: { texto: 'Ver el panel de usuarios', url: `${RPAD_URL}/configuracion.html` },
      notas: ['Este aviso te llega porque sos superadmin y el cambio lo hizo otro administrador.']
    }),
    text: [
      `${quien} hizo este cambio:`,
      `${aQuien}: ${cambio}`,
      `Fecha: ${cuando} h`,
      '',
      `Panel de usuarios: ${RPAD_URL}/configuracion.html`
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
      boton: { texto: 'Ver el panel de usuarios', url: `${RPAD_URL}/configuracion.html` },
      notas: ['Este resumen te llega porque sos superadmin y estos avisos no se enviaron durante tu licencia.']
    }),
    text: [
      `Mientras estabas de licencia ${cuantos} como aviso:`,
      ...lineas.map(l => `- ${l.cuando} h – ${l.quien}: ${l.aQuien}: ${l.cambio}`),
      '',
      `Panel de usuarios: ${RPAD_URL}/configuracion.html`
    ].join('\n')
  };
};

// =====================================================
// MI ESPACIO: el aviso de vencimiento (spec 2026-10-26-mi-espacio-licencias-y-horas, 9)
// =====================================================

// La nota del pie: cuántas veces llega cada cosa y que lo cargado lo ve solo la persona. Con el primer aviso de unos días para
// restituir sin el segundo de su grupo, la primera oración dice que va a llegar otro (spec 2026-10-31-mi-espacio-dias-restituidos,
// 10, y el email de la maqueta)
const UNA_SOLA_VEZ = 'Este aviso te llega una sola vez por cada cosa.';
const OTRO_AVISO_DE_RESTITUCION = 'Te va a llegar otro aviso 5 días hábiles antes del plazo.';
const SOLO_VOS = 'Lo que cargás en Mi espacio lo ves solo vos.';

// Si un aviso es de unos días para restituir: trae `restitucion` ({ grupo, partes, primero }, de avisosDeVencimiento)
const esDeRestitucion = (aviso) => aviso?.restitucion !== null && typeof aviso?.restitucion === 'object';

// Los párrafos de un aviso de restitución, armados por partes (un texto o { negrita }, la forma de parrafoDelEvento: escapados
// ahí y con el <strong> que pone el código), cada uno `{ html, texto }`; si sus partes no sirven, o no es de restitución, null
const parrafosDeRestitucion = (aviso) => {
  const partes = esDeRestitucion(aviso) ? aviso.restitucion.partes : null;
  if (!Array.isArray(partes) || partes.length === 0 || !partes.every(Array.isArray)) return null;
  return partes.map((parrafoPorPartes) => parrafoDelEvento(...parrafoPorPartes));
};

/**
 * Lo de cada aviso en el email: los párrafos del HTML (ya escapados) y los renglones del texto plano, uno por aviso. Uno que no
 * es de restitución (o cuyas partes no sirven) va con su texto en un párrafo y un renglón. Uno de restitución va con sus
 * párrafos menos el último, el de cierre («En Mi espacio podés cargarlos y bajar la nota en Word.»): con dos grupos en el mismo
 * email, los cierres iguales irían repetidos, así que van una sola vez cada uno, en el orden de sus avisos, después de los
 * párrafos del último aviso de restitución (y en el texto plano, al final de su renglón). Con un solo grupo queda igual: sus
 * párrafos y, en el texto plano, su texto.
 */
const cuerpoDeLosAvisos = (avisos) => {
  const armados = avisos.map(parrafosDeRestitucion);
  const ultimo = armados.findLastIndex((parrafos) => parrafos !== null);
  const cierres = new Map();
  for (const parrafos of armados) {
    const cierre = parrafos?.at(-1);
    if (cierre && !cierres.has(cierre.html)) cierres.set(cierre.html, cierre);
  }
  const parrafos = [];
  const renglones = [];
  avisos.forEach((aviso, i) => {
    if (armados[i] === null) {
      parrafos.push(escapeHtml(aviso.texto));
      renglones.push(aviso.texto);
      return;
    }
    const delAviso = [...armados[i].slice(0, -1), ...(i === ultimo ? cierres.values() : [])];
    parrafos.push(...delAviso.map((parrafo) => parrafo.html));
    if (delAviso.length > 0) renglones.push(delAviso.map((parrafo) => parrafo.texto).join(' '));
  });
  return { parrafos, renglones };
};

// Si va a llegar otro aviso: va el primero de un grupo por restituir y no el segundo de ese mismo grupo
const llegaOtroAviso = (avisos) => {
  const conSegundo = new Set(avisos.filter((aviso) => esDeRestitucion(aviso) && aviso.restitucion.primero === false)
    .map((aviso) => aviso.restitucion.grupo));
  return avisos.some((aviso) => esDeRestitucion(aviso) && aviso.restitucion.primero === true
    && !conSegundo.has(aviso.restitucion.grupo));
};

/**
 * Lo que vence pronto en Mi espacio, a la persona (la corrida de las 8:15, services/miEspacioAvisos.js). avisos: los de
 * avisosDeVencimiento (services/miEspacioReglas.js): vacaciones, francos y horas, nunca el tipo de una licencia médica, cada uno
 * con su `texto` (texto plano, un renglón por cosa) y, los de unos días para restituir (spec 2026-10-31-mi-espacio-dias-restituidos,
 * 10), con `restitucion` (`{ grupo, partes, primero }`): en el HTML van con sus párrafos y sus negritas, y en el texto plano en
 * su renglón, con los párrafos de cierre iguales una sola vez (cuerpoDeLosAvisos). Si todos son de restitución, el asunto y
 * el título son los suyos («RPAD: tenés días para restituir en Mi espacio» y «Días para restituir»); si no, los de siempre. El
 * botón abre el Resumen.
 */
export const vencimientoMiEspacioTemplate = ({ nombre_completo, avisos }) => {
  const url = `${RPAD_URL}/mi-espacio.html#resumen`;
  const { parrafos, renglones } = cuerpoDeLosAvisos(avisos);
  const soloRestitucion = avisos.length > 0 && avisos.every(esDeRestitucion);
  const titulo = soloRestitucion ? 'Días para restituir' : 'Lo que vence pronto';
  const nota = `${llegaOtroAviso(avisos) ? OTRO_AVISO_DE_RESTITUCION : UNA_SOLA_VEZ} ${SOLO_VOS}`;
  return {
    subject: soloRestitucion ? 'RPAD: tenés días para restituir en Mi espacio' : 'RPAD: lo que vence pronto en Mi espacio',
    html: plantillaSimple({
      titulo,
      parrafos: [`Hola, ${escapeHtml(nombre_completo)}.`, ...parrafos],
      boton: { texto: 'Ver en Mi espacio', url },
      notas: [escapeHtml(nota)]
    }),
    text: [
      `Hola, ${nombre_completo}.`,
      '',
      ...renglones,
      '',
      `Ver en Mi espacio: ${url}`,
      '',
      nota
    ].join('\n')
  };
};

// =====================================================
// MI ESPACIO: los emails de los eventos de la agenda (spec 2026-10-26-mi-espacio-agenda, 4)
// =====================================================

// Los cuatro abren la pestaña Agenda de Mi espacio
const URL_DE_LOS_EVENTOS = `${RPAD_URL}/mi-espacio.html#agenda`;
const NOTA_DE_LA_INVITACION = 'Solo quien lo creó lo puede cambiar. Si cambia o se cancela, te llega otro email.';
const NOTA_DEL_RECORDATORIO =
  'Te llega porque el evento tiene un recordatorio por email. Lo podés apagar desde el evento, en la Agenda de Mi espacio.';

// Un texto de un evento, recortado ('' si el evento o el campo no lo son: nada tira con un evento raro)
const campoDelEvento = (evento, campo) =>
  (evento !== null && typeof evento === 'object' && typeof evento[campo] === 'string' ? evento[campo].trim() : '');
// Quien lo creó; sin un nombre, la raya (como en la agenda)
const nombreDelCreador = (creador) => (typeof creador === 'string' && creador.trim() !== '' ? creador.trim() : '—');

/**
 * Un párrafo de los emails de un evento, armado por partes: un texto, `{ negrita }` o `{ tachado }`. Cada parte se escapa una
 * sola vez, acá (plantillaSimple no escapa sus párrafos), y las marcas (<strong> y <s>) las pone el código, nunca lo que
 * escribió una persona (Review Focus 2). Devuelve `{ html, texto }`: el texto plano dice lo mismo, sin las marcas. Lo usan
 * también los avisos de los días para restituir del email de vencimiento (parrafosDeRestitucion), con sus negritas.
 */
const parrafoDelEvento = (...partes) => ({
  html: partes.map((parte) => {
    if (typeof parte === 'string') return escapeHtml(parte);
    if ('negrita' in parte) return `<strong>${escapeHtml(parte.negrita)}</strong>`;
    return `<s>${escapeHtml(parte.tachado)}</s>`;
  }).join(''),
  texto: partes.map((parte) => (typeof parte === 'string' ? parte : parte.negrita ?? parte.tachado)).join('')
});

// El detalle de un evento en su párrafo: escapado y con sus saltos de línea como <br>; sin detalle, null (no va)
const parrafoDelDetalle = (evento) => {
  const detalle = campoDelEvento(evento, 'detalle');
  return detalle === '' ? null : { html: escapeHtml(detalle).replace(/\r\n|\r|\n/g, '<br>'), texto: detalle };
};

// =====================================================
// MI ESPACIO: el aviso diario de la agenda (spec 2026-11-04-agenda-aviso-y-dependencia, 8)
// =====================================================

const NOTA_DEL_AVISO_SIN_GENTE = 'Si algo no está como querías, lo podés cambiar desde el evento. Para dejar de recibir este mail, destildá «Recibir mi agenda por mail» en la Agenda de Mi espacio.';
const NOTA_DEL_AVISO_CON_GENTE = 'De quienes dependen de vos, te llega solo el texto corto de lo que publican. Lo tuyo lo podés apagar desde la Agenda de Mi espacio; lo demás te llega siempre.';
const NOTA_DEL_AVISO_SOLO_GENTE = 'De quienes dependen de vos, te llega solo el texto corto de lo que publican.';

const conMayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);
const estiloSecundario = () => `color: ${COLORES.secundario}; font-size: 13px;`;
// Un título de grupo en negrita, en el color de los títulos
const tituloDelAviso = (texto) => ({
  html: `<strong style="color: ${COLORES.titulo};">${escapeHtml(texto)}</strong>`, texto
});
// Un día, como título de un grupo: «Jueves 05/11», u «Hoy, viernes 06/11»
const diaDelAviso = (fecha, hoy) => tituloDelAviso(fecha === hoy ? `Hoy, ${diaLargo(fecha)}` : conMayuscula(diaLargo(fecha)));
// Un evento propio: la hora, el título, y debajo el detalle (con sus renglones) y la marca, en gris. Cada parte se escapa una sola vez
const renglonPropio = ({ desde, titulo, detalle, marca }) => {
  const detalleDelEvento = parrafoDelDetalle({ detalle });
  return {
    html: `<strong>${escapeHtml(desde)}</strong> · ${escapeHtml(titulo)}`
      + `${detalleDelEvento ? `<br><span style="${estiloSecundario()}">${detalleDelEvento.html}</span>` : ''}`
      + `<br><span style="${estiloSecundario()}">${escapeHtml(marca)}</span>`,
    texto: [`${desde} · ${titulo}`, ...(detalleDelEvento ? [detalleDelEvento.texto] : []), marca].join('\n')
  };
};
// Un Público de su gente: la hora, «Nuevo:» si no se le informó, nombre y texto corto, y «Hasta las 10:00» si tiene fin
const renglonDeGente = ({ desde, hasta, texto, nuevo }) => ({
  html: `<strong>${escapeHtml(desde)}</strong> · ${nuevo ? '<strong>Nuevo:</strong> ' : ''}${escapeHtml(texto)}`
    + `${hasta ? `<br><span style="${estiloSecundario()}">Hasta las ${escapeHtml(hasta)}</span>` : ''}`,
  texto: `${desde} · ${nuevo ? 'Nuevo: ' : ''}${texto}${hasta ? `\nHasta las ${hasta}` : ''}`
});

// Los párrafos de una lista de eventos, agrupados por día. Sin `conDias`, solo los renglones (todos son del mismo día)
const parrafosPorDia = (items, hoy, renglon, { conDias = true } = {}) => {
  const parrafos = [];
  let diaAnterior = null;
  for (const item of items) {
    if (conDias && item.fecha !== diaAnterior) parrafos.push(diaDelAviso(item.fecha, hoy));
    diaAnterior = item.fecha;
    parrafos.push(renglon(item));
  }
  return parrafos;
};

/**
 * El mail del aviso diario de una persona (`persona`, con `nombre_completo`; `mail`, el de `mailDeLaPersona`): `{ subject, html, text }`. Con
 * el marco único y el botón «Ver en Mi espacio». A las 14:00, con lo propio o solo lo de su gente; a las 8:05, o a las 14:00 si solo trae
 * lo rezagado de hoy, «se sumó algo». De un Público ajeno llega solo su texto: el título y el detalle ni siquiera están en `mail`.
 */
export const avisoDiarioTemplate = ({ persona, mail, hoy }) => {
  const primerNombre = String(persona?.nombre_completo ?? '').trim().split(/\s+/)[0];
  const { propios, gente, dias, soloHoy } = mail;
  const conPropios = propios.length > 0;
  const conGente = gente.length > 0;
  const ultimo = dias.at(-1);
  const cuando = dias.length === 1 ? `del ${diaLargo(ultimo)}` : `hasta el ${diaLargo(ultimo)}`;
  let titulo;
  let asunto;
  let apertura;
  if (soloHoy) {
    titulo = 'Tu agenda de hoy, actualizada';
    asunto = 'RPAD: se sumó algo a tu agenda de hoy';
    apertura = `${primerNombre}, después del último aviso se sumó algo a la agenda de hoy, ${diaLargo(hoy)}. Lo nuevo dice «Nuevo».`;
  } else if (conPropios) {
    titulo = `Tu agenda ${cuando}`;
    asunto = `RPAD: tu agenda ${cuando}`;
    apertura = `${primerNombre}, esto es lo que tenés ${dias.length === 1 ? 'para' : 'hasta'} el próximo día hábil.`;
  } else {
    titulo = `Agenda ${cuando} de quienes dependen de vos`;
    asunto = `RPAD: agenda ${cuando} de quienes dependen de vos`;
    apertura = `${primerNombre}, esto es lo que publicaron ${dias.length === 1 ? 'para' : 'hasta'} el próximo día hábil.`;
  }
  const parrafos = [
    { html: escapeHtml(apertura), texto: apertura },
    ...parrafosPorDia(propios, hoy, renglonPropio),
    ...(conGente ? [tituloDelAviso('De quienes dependen de vos'), ...parrafosPorDia(gente, hoy, renglonDeGente, { conDias: !soloHoy })] : [])
  ];
  let nota = NOTA_DEL_AVISO_SIN_GENTE;
  if (conGente) nota = conPropios ? NOTA_DEL_AVISO_CON_GENTE : NOTA_DEL_AVISO_SOLO_GENTE;
  return {
    subject: asunto,
    html: plantillaSimple({
      titulo,
      parrafos: parrafos.map((parrafoDelAviso) => parrafoDelAviso.html),
      boton: { texto: 'Ver en Mi espacio', url: URL_DE_LOS_EVENTOS },
      notas: [escapeHtml(nota)]
    }),
    text: [...parrafos.map((parrafoDelAviso) => parrafoDelAviso.texto), `Ver en Mi espacio: ${URL_DE_LOS_EVENTOS}`, nota].join('\n\n')
  };
};

// Uno de los emails de un evento: el título, los párrafos (los null no van; el detalle, después de la línea del evento, y en el
// cambio, después de «Antes: …»), el botón «Ver en Mi espacio» y, si hay, una nota. El texto alternativo dice lo mismo, con un
// renglón en blanco entre los párrafos
const emailDelEvento = ({ asunto, titulo, parrafos, nota = null }) => {
  const lista = parrafos.filter(Boolean);
  const notas = nota === null ? [] : [nota];
  return {
    subject: asunto,
    html: plantillaSimple({
      titulo,
      parrafos: lista.map((p) => p.html),
      boton: { texto: 'Ver en Mi espacio', url: URL_DE_LOS_EVENTOS },
      notas: notas.map(escapeHtml)
    }),
    text: [...lista.map((p) => p.texto), `Ver en Mi espacio: ${URL_DE_LOS_EVENTOS}`, ...notas].join('\n\n')
  };
};

/**
 * La invitación, a quien quien lo creó suma a un evento (al guardarlo; services/miEspacioEventosEmails.js). `creador`: su
 * nombre; `evento`: `{ titulo, fecha, desde, hasta, detalle }`, como queda guardado. «Laura Gómez te sumó a un evento: Reunión
 * de equipo, martes 27/10/2026 de 10:00 a 11:00.», con el detalle.
 */
export const eventoInvitacionTemplate = ({ creador, evento }) => emailDelEvento({
  asunto: 'RPAD: te sumaron a un evento',
  titulo: 'Te sumaron a un evento',
  parrafos: [
    parrafoDelEvento({ negrita: nombreDelCreador(creador) }, ' te sumó a un evento: ',
      { negrita: campoDelEvento(evento, 'titulo') }, `, ${cuandoDelEvento(evento)}.`),
    parrafoDelDetalle(evento)
  ],
  nota: NOTA_DE_LA_INVITACION
});

/**
 * El cambio, a los que siguen en un evento cuando quien lo creó le cambia el título, la fecha o la hora (cambioQueAvisa).
 * `antes` y `despues`: el evento antes y después de guardar. «Cambió un evento: Reunión de equipo, miércoles 28/10/2026 de 10:00
 * a 11:00.», lo de antes tachado («Antes: …», con <s> dentro del párrafo, justo debajo: la comparación va junta), el detalle de
 * ahora y quién lo cambió.
 */
export const eventoCambioTemplate = ({ creador, antes, despues }) => emailDelEvento({
  asunto: 'RPAD: cambió un evento',
  titulo: 'Cambió un evento',
  parrafos: [
    parrafoDelEvento('Cambió un evento: ', { negrita: campoDelEvento(despues, 'titulo') }, `, ${cuandoDelEvento(despues)}.`),
    parrafoDelEvento('Antes: ', { tachado: textoDelEvento(antes) }),
    parrafoDelDetalle(despues),
    parrafoDelEvento(`Lo cambió ${nombreDelCreador(creador)}.`)
  ]
});

/**
 * La cancelación, a los que estaban en un evento cuando quien lo creó lo borra. «Se canceló: Reunión de equipo, martes
 * 27/10/2026 a las 10:00.» (cuándo empezaba, sin la hora de fin), el detalle y quién lo canceló.
 */
export const eventoCancelacionTemplate = ({ creador, evento }) => emailDelEvento({
  asunto: 'RPAD: se canceló un evento',
  titulo: 'Se canceló un evento',
  parrafos: [
    parrafoDelEvento('Se canceló: ', { negrita: campoDelEvento(evento, 'titulo') }, `, ${cuandoCortoDelEvento(evento)}.`),
    parrafoDelDetalle(evento),
    parrafoDelEvento(`Lo canceló ${nombreDelCreador(creador)}.`)
  ]
});

/**
 * El recordatorio de un evento (la corrida de los recordatorios), contado desde `hoy` ('AAAA-MM-DD', el día real del envío):
 * «Hoy a las 10:00: Reunión de equipo», «Mañana a las 10:00: …» o «El lunes 02/11 a las 10:00: …» (cuandoEsElEvento), con el
 * detalle. El asunto lo dice en minúscula: «RPAD: Reunión de equipo, hoy a las 10:00».
 */
export const eventoRecordatorioTemplate = ({ evento, hoy }) => {
  const titulo = campoDelEvento(evento, 'titulo');
  const cuando = cuandoEsElEvento(evento, hoy);
  return emailDelEvento({
    asunto: `RPAD: ${titulo}, ${conMinusculaInicial(cuando)}`,
    titulo: 'Recordatorio',
    parrafos: [parrafoDelEvento(`${cuando}: `, { negrita: titulo }), parrafoDelDetalle(evento)],
    nota: NOTA_DEL_RECORDATORIO
  });
};

// =====================================================
// EL DATO DE LA QUINCENA (spec 2026-11-12-dato-quincena-correo, 2.8 y 10)
// =====================================================

// El Content-ID de la infografía en línea: el servicio adjunta el PNG con este cid y el HTML lo muestra con <img src="cid:…">
export const CID_INFOGRAFIA = 'infografia-dato-quincena';

// La nota del pie, con el nombre del bot que trae el modelo (`nombreDelBot`, el de NOMBRE_DEL_BOT: acá no se nombra, spec 2.10);
// sin un nombre, «del bot»
const notaDelDatoQuincena = (nombreDelBot) => {
  const nombre = typeof nombreDelBot === 'string' ? nombreDelBot.trim() : '';
  return `En el RPAD también están el texto del correo ${nombre === '' ? 'del bot' : `de ${nombre}`}, los cálculos y la edición `
    + 'completa. Te llega porque estás en la lista del dato de la quincena; para dejar de recibirlo, avisale a la Dirección.';
};
const PIE_DE_LA_INFOGRAFIA = 'La infografía de la propuesta principal.';
const BOTON_DEL_DATO_QUINCENA = 'Ver la edición en el RPAD';
const PARA_VALIDAR = 'Para validar antes de publicar';

// Las pastillas de las etiquetas de una propuesta (Principal va en la franja) y la de la agenda, la suave «Efeméride», que usan
// también las propuestas; «Repite», blanca con un borde (spec 2026-11-14-dato-quincena-v1-3, 5); otra, con los colores neutros.
// Siempre con su texto: el color nunca es lo único que las distingue
const PASTILLAS_DEL_DATO_QUINCENA = Object.freeze({
  Validar: { fondo: COLORES.respaldo.fondo, color: COLORES.respaldo.texto },
  Agenda: { fondo: COLORES.encabezado, color: COLORES.titulo },
  Efeméride: { fondo: COLORES.borde, color: COLORES.texto },
  Repite: { fondo: COLORES.tarjeta, color: COLORES.texto, borde: '#76879F' }
});
// La caja de la repetición de una propuesta: un recuadro neutro, gris azulado, distinto del celeste de los campos
const CAJA_DE_LA_REPETICION = Object.freeze({ fondo: '#F4F7FA', borde: '#DAE3ED' });

// Un texto de la edición: los que no son texto, vacíos (nada tira con un modelo raro)
const textoDelDato = (valor) => (typeof valor === 'string' ? valor : '');
// Escapado y con sus saltos de línea como <br>
const conRenglones = (valor) => escapeHtml(textoDelDato(valor)).replace(/\r\n|\r|\n/g, '<br>');
// Una dirección es enlace solo si es https:// (nunca javascript:, http: ni una relativa)
const esHttps = (url) => typeof url === 'string' && url.startsWith('https://');
const listaDelDato = (valor) => (Array.isArray(valor) ? valor : []);
// La propuesta principal (la primera, si ninguna lo es), para el texto alternativo de la infografía
const principalDe = (propuestas) => propuestas.find((propuesta) => propuesta?.principal === true) ?? propuestas[0] ?? null;
// La foto del RPAD en un renglón: «En el RPAD ese día: Actualizado. Datos al 30/09/2026. …»
const fotoEnUnRenglon = (foto) => `${foto.map((fila) => `${textoDelDato(fila?.rotulo)} ${textoDelDato(fila?.valor)}`).join('. ')}.`;
// Las etiquetas que van en pastillas: todas menos Principal
const etiquetasDelDato = (propuesta) => listaDelDato(propuesta?.etiquetas).filter((etiqueta) => etiqueta !== 'Principal');
const pieDeLaInfografia = (conSvg) => `${PIE_DE_LA_INFOGRAFIA} ${conSvg ? 'Va adjunta en PNG y en SVG (para editarla).' : 'Va adjunta en PNG.'}`;

// Una pastilla, con el estilo de la etiqueta del tipo de cambio (etiquetaDeTipo) y su margen. Una con borde lleva un píxel menos
// de relleno de cada lado: así mide lo mismo que las otras
const pastillaDelDato = (texto, margen) => {
  const { fondo, color, borde } = Object.hasOwn(PASTILLAS_DEL_DATO_QUINCENA, texto)
    ? PASTILLAS_DEL_DATO_QUINCENA[texto]
    : { fondo: COLORES.borde, color: COLORES.texto };
  const conBorde = typeof borde === 'string' ? ` border: 1px solid ${borde};` : '';
  return `<span style="display: inline-block; margin: ${margen}; background-color: ${fondo}; color: ${color};${conBorde} font-size: 12px; font-weight: 600; padding: ${conBorde === '' ? '2px 10px' : '1px 9px'}; border-radius: 10px;">${escapeHtml(textoDelDato(texto))}</span>`;
};

// Un bloque con aire arriba, en una celda (Outlook de escritorio no respeta el margin de una tabla)
const conAireArriba = (alto, html) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: ${alto}px 0 0 0;">
                          ${html}
                        </td>
                      </tr>
                    </table>`;

// La repetición de una propuesta (spec 2026-11-14-dato-quincena-v1-3, 5), si es un objeto; si no, null
const repeticionDelModelo = (propuesta) => {
  const repeticion = propuesta?.repeticion;
  return repeticion !== null && typeof repeticion === 'object' && !Array.isArray(repeticion) ? repeticion : null;
};
// El enlace a la edición que repite, solo con un id entero positivo
const idDeLaEdicionPrevia = (repeticion) => (Number.isSafeInteger(repeticion.id_edicion) && repeticion.id_edicion > 0
  ? repeticion.id_edicion
  : null);

// La caja de la repetición, con aire arriba: el texto en negrita (enlace a la edición previa, si hay id) y abajo el motivo. Sin
// repetición, nada. El enlace va subrayado, a diferencia de los otros del mail: el texto sin enlace también es negrita y el color
// solo no los distingue
const repeticionDelDato = (propuesta) => {
  const repeticion = repeticionDelModelo(propuesta);
  if (repeticion === null) return '';
  const id = idDeLaEdicionPrevia(repeticion);
  const texto = conRenglones(repeticion.texto);
  const conEnlace = id === null
    ? texto
    : `<a href="${escapeHtml(`${RPAD_URL}/dato-quincena.html?id=${id}`)}" style="color: ${COLORES.acento}; text-decoration: underline;">${texto}</a>`;
  return conAireArriba(12, caja(
    `background-color: ${CAJA_DE_LA_REPETICION.fondo}; border: 1px solid ${CAJA_DE_LA_REPETICION.borde}; border-radius: 6px`,
    `<p style="margin: 0; color: ${COLORES.texto}; font-size: 14px; line-height: 1.6;"><strong>${conEnlace}</strong></p>`
      + `<p style="margin: 4px 0 0 0; color: ${COLORES.texto}; font-size: 14px; line-height: 1.6;">${conRenglones(repeticion.motivo)}</p>`
  ));
};

// Un campo de una propuesta: su título y su contenido (html: ya escapado)
const campoDelDato = (titulo, html) =>
  `<h3 style="margin: 14px 0 4px 0; color: ${COLORES.titulo}; font-size: 14px; font-weight: 600;">${escapeHtml(titulo)}</h3>${html}`;

// Un evento de la agenda: la fecha en su columna; el título, la etiqueta, el detalle y «Ver» si la dirección es https://
const eventoDelDato = (evento) => {
  const etiqueta = typeof evento?.etiqueta === 'string' && evento.etiqueta !== '' ? ` ${pastillaDelDato(evento.etiqueta, '0')}` : '';
  const detalle = textoDelDato(evento?.detalle).trim() === '' ? '' : `<br>${conRenglones(evento.detalle)}`;
  const ver = esHttps(evento?.url) ? ` ${enlace(escapeHtml(evento.url), 'Ver')}` : '';
  return `
                      <tr>
                        <td valign="top" style="padding: 4px 12px 4px 0; width: 84px; color: ${COLORES.titulo}; font-size: 13px; font-weight: 600; white-space: nowrap;">${escapeHtml(textoDelDato(evento?.fecha_texto))}</td>
                        <td valign="top" style="padding: 4px 0; color: ${COLORES.texto}; font-size: 13px; line-height: 1.5;"><strong>${conRenglones(evento?.titulo)}</strong>${etiqueta}${detalle}${ver}</td>
                      </tr>`;
};

const agendaDelDato = (agenda) => (agenda.length === 0 ? null : recuadro(`${tituloSeccion('Agenda de la quincena')}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse;">${agenda.map(eventoDelDato).join('')}
                    </table>`));

// La franja de una propuesta: «Propuesta N de M»; la principal, en el color del título, con «Principal»
const franjaDelDato = (propuesta) => {
  const principal = propuesta?.principal === true;
  const fondo = principal ? COLORES.titulo : COLORES.encabezado;
  return `<td bgcolor="${fondo}" style="padding: 10px 16px; background-color: ${fondo}; border-bottom: 1px solid ${principal ? COLORES.titulo : COLORES.bordeEncabezado};">`
    + `<span style="color: ${principal ? '#FFFFFF' : COLORES.titulo}; font-size: 13px; font-weight: 700;">${escapeHtml(textoDelDato(propuesta?.franja))}</span>`
    + `${principal ? '<span style="color: #FFFFFF; font-size: 13px;">&nbsp;&nbsp;Principal</span>' : ''}</td>`;
};

// Lo de adentro de la tarjeta de una propuesta, en el orden de la maqueta. Las listas vacías no van
const contenidoDelDato = (propuesta) => {
  const etiquetas = etiquetasDelDato(propuesta);
  const { dataset, borrador_nota: borrador } = propuesta ?? {};
  const nombre = conRenglones(dataset?.nombre);
  const foto = listaDelDato(propuesta?.foto);
  const notas = listaDelDato(propuesta?.notas_validacion);
  const puntos = listaDelDato(propuesta?.puntos_centrales);
  const parrafos = listaDelDato(borrador?.parrafos);
  const fuentes = listaDelDato(propuesta?.fuentes);
  return [
    etiquetas.length > 0 ? `<p style="margin: 0 0 6px 0;">${etiquetas.map((etiqueta) => pastillaDelDato(etiqueta, '0 6px 6px 0')).join('')}</p>` : '',
    `<h2 style="margin: 0; color: ${COLORES.titulo}; font-size: 17px; font-weight: 600; line-height: 1.3;">${conRenglones(propuesta?.titulo)}</h2>`,
    `<p style="margin: 8px 0 0 0; color: ${COLORES.texto}; font-size: 16px; font-weight: 600; line-height: 1.4;">${conRenglones(propuesta?.cifra_clave)}</p>`,
    parrafo(`Dataset: ${esHttps(dataset?.url) ? enlace(escapeHtml(dataset.url), nombre) : nombre}`, '10px 0 0 0'),
    foto.length > 0 ? `<p style="margin: 4px 0 0 0; color: ${COLORES.secundario}; font-size: 12px; line-height: 1.5;">${conRenglones(fotoEnUnRenglon(foto))}</p>` : '',
    repeticionDelDato(propuesta),
    notas.length > 0
      ? conAireArriba(12, avisoDestacado(`<strong>${PARA_VALIDAR}</strong>${notas.map((nota) => `<br>• ${conRenglones(nota)}`).join('')}`))
      : '',
    campoDelDato('Por qué hoy', parrafo(conRenglones(propuesta?.por_que_hoy))),
    campoDelDato('Ángulo', parrafo(conRenglones(propuesta?.angulo))),
    campoDelDato('Idea de placa', parrafo(conRenglones(propuesta?.idea_placa))),
    campoDelDato('Texto para redes', recuadro(parrafo(conRenglones(propuesta?.texto_redes)))),
    puntos.length > 0
      ? campoDelDato('Puntos centrales', `<ul style="margin: 0; padding-left: 18px; color: ${COLORES.texto}; font-size: 14px; line-height: 1.6;">${puntos.map((punto) => `<li>${conRenglones(punto)}</li>`).join('')}</ul>`)
      : '',
    campoDelDato('Borrador de nota', recuadro(`<p style="margin: 0 0 6px 0; color: ${COLORES.titulo}; font-size: 14px; font-weight: 600;">${conRenglones(borrador?.titulo)}</p>${parrafos.map((texto, i) => parrafo(conRenglones(texto), i === 0 ? '0' : '8px 0 0 0')).join('')}`)),
    fuentes.length > 0
      ? campoDelDato('Fuentes', `<p style="margin: 0; color: ${COLORES.texto}; font-size: 13px; line-height: 1.6; word-break: break-all;">${fuentes.map((fuente) => (esHttps(fuente) ? enlace(escapeHtml(fuente), escapeHtml(fuente)) : conRenglones(fuente))).join('<br>')}</p>`)
      : ''
  ].join('');
};

// La tarjeta de una propuesta: la franja arriba y el contenido; la principal, con borde de 2 px en el color del título
const tarjetaDelDato = (propuesta) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; background-color: ${COLORES.tarjeta}; border: ${propuesta?.principal === true ? `2px solid ${COLORES.titulo}` : `1px solid ${COLORES.bordeRecuadro}`}; border-radius: 6px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
                      <tr>
                        ${franjaDelDato(propuesta)}
                      </tr>
                      <tr>
                        <td style="padding: 14px 16px 16px 16px;">
                          ${contenidoDelDato(propuesta)}
                        </td>
                      </tr>
                    </table>`;

// Las propuestas, una por fila, con 28 px de aire entre una y otra (filas de alto fijo, como SEPARADOR_DE_TARJETAS)
const SEPARADOR_DE_PROPUESTAS = `
                <tr>
                  <td height="28" style="height: 28px; font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>`;
const propuestasDelDato = (propuestas) => (propuestas.length === 0 ? null : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse;">${
  propuestas.map((propuesta) => `
                <tr>
                  <td>
                    ${tarjetaDelDato(propuesta)}
                  </td>
                </tr>`).join(SEPARADOR_DE_PROPUESTAS)}
              </table>`);

// La infografía en línea (cid), a lo ancho del cuerpo (600 menos 24 de cada lado), con su pie
const infografiaDelDato = (propuestas, conSvg) => {
  const principal = principalDe(propuestas);
  const titulo = textoDelDato(principal?.titulo).replace(/\s+/g, ' ').trim();
  const alternativo = titulo === '' ? PIE_DE_LA_INFOGRAFIA.slice(0, -1) : `Infografía de la propuesta principal: ${titulo}`;
  return `<img src="cid:${CID_INFOGRAFIA}" width="552" alt="${escapeHtml(alternativo)}" style="display: block; width: 100%; max-width: 552px; height: auto; border: 1px solid ${COLORES.borde}; border-radius: 6px;">`
    + `<p style="margin: 6px 0 0 0; color: ${COLORES.secundario}; font-size: 12px;">${escapeHtml(pieDeLaInfografia(conSvg))}</p>`;
};

// El texto plano de una propuesta, en bloques separados por un renglón en blanco: la franja (con «(principal)»), el título con
// sus etiquetas y la cifra; el dataset (la dirección, solo si es https://) y la foto; la repetición, si hay («<texto>\n<motivo>»,
// sin el enlace); cada campo con su título
const textoDeLaPropuesta = (propuesta) => {
  const etiquetas = etiquetasDelDato(propuesta);
  const { dataset, borrador_nota: borrador } = propuesta ?? {};
  const repeticion = repeticionDelModelo(propuesta);
  const foto = listaDelDato(propuesta?.foto);
  const notas = listaDelDato(propuesta?.notas_validacion);
  const puntos = listaDelDato(propuesta?.puntos_centrales);
  const fuentes = listaDelDato(propuesta?.fuentes);
  const conGuiones = (titulo, elementos) => [titulo, ...elementos.map((elemento) => `- ${textoDelDato(elemento)}`)].join('\n');
  return [
    [
      `${textoDelDato(propuesta?.franja)}${propuesta?.principal === true ? ' (principal)' : ''}`,
      `${textoDelDato(propuesta?.titulo)}${etiquetas.length > 0 ? ` [${etiquetas.map(textoDelDato).join(', ')}]` : ''}`,
      textoDelDato(propuesta?.cifra_clave)
    ].join('\n'),
    [
      `Dataset: ${textoDelDato(dataset?.nombre)}`, ...(esHttps(dataset?.url) ? [dataset.url] : []),
      ...(foto.length > 0 ? [fotoEnUnRenglon(foto)] : [])
    ].join('\n'),
    ...(repeticion === null ? [] : [`${textoDelDato(repeticion.texto)}\n${textoDelDato(repeticion.motivo)}`]),
    ...(notas.length > 0 ? [conGuiones(PARA_VALIDAR, notas)] : []),
    `Por qué hoy\n${textoDelDato(propuesta?.por_que_hoy)}`,
    `Ángulo\n${textoDelDato(propuesta?.angulo)}`,
    `Idea de placa\n${textoDelDato(propuesta?.idea_placa)}`,
    `Texto para redes\n${textoDelDato(propuesta?.texto_redes)}`,
    ...(puntos.length > 0 ? [conGuiones('Puntos centrales', puntos)] : []),
    ['Borrador de nota', [textoDelDato(borrador?.titulo), ...listaDelDato(borrador?.parrafos).map(textoDelDato)].join('\n\n')].join('\n'),
    ...(fuentes.length > 0 ? [['Fuentes', ...fuentes.map(textoDelDato)].join('\n')] : [])
  ].join('\n\n');
};

// Un evento de la agenda en el texto plano: «10/11/2026 · Título (Efeméride)», el detalle y la dirección, si es https://
const eventoEnTexto = (evento) => [
  `${textoDelDato(evento?.fecha_texto)} · ${textoDelDato(evento?.titulo)}${typeof evento?.etiqueta === 'string' && evento.etiqueta !== '' ? ` (${evento.etiqueta})` : ''}`,
  ...(textoDelDato(evento?.detalle).trim() === '' ? [] : [evento.detalle]),
  ...(esHttps(evento?.url) ? [evento.url] : [])
].join('\n');

/**
 * El mail del dato de la quincena, a una persona (spec 2026-11-12-dato-quincena-correo, 10; la forma, la de la maqueta
 * aprobada): `{ subject, html, text }`. `modelo`: el de `modeloDelMail` (services/datoQuincenaCorreoReglas.js), que esta
 * plantilla no importa. `conSvg`: solo con true el pie de la infografía dice que va también en SVG (el servicio lo pasa si
 * la edición lo trajo; ante la duda, no lo promete).
 * Con el marco único: el título, el número y la bajada; «Buen día, <primer nombre>.»; la infografía en línea (CID_INFOGRAFIA);
 * la agenda, si hay; una tarjeta por propuesta, en su orden, con su franja (y, si repite otra edición, la caja de la repetición
 * después de la foto: spec 2026-11-14-dato-quincena-v1-3, 5); el botón «Ver la edición en el RPAD» y la nota, con el nombre del
 * bot del modelo.
 * Todo texto de la edición va escapado y con sus saltos de línea como <br>; una dirección es enlace solo si es https://. El
 * texto plano dice lo mismo, con los textos tal como llegaron.
 */
export const datoQuincenaTemplate = (modelo, { conSvg = false } = {}) => {
  const conElSvg = conSvg === true;
  const primerNombre = textoDelDato(modelo?.primerNombre);
  const saludo = primerNombre === '' ? 'Buen día.' : `Buen día, ${primerNombre}.`;
  const numero = textoDelDato(modelo?.numero);
  const agenda = listaDelDato(modelo?.agenda);
  const propuestas = listaDelDato(modelo?.propuestas);
  const url = textoDelDato(modelo?.url);
  const nota = notaDelDatoQuincena(modelo?.nombreDelBot);
  return {
    subject: textoDelDato(modelo?.asunto),
    html: marcoEmail({
      titulo: textoDelDato(modelo?.titulo),
      cuerpo: [
        tituloCuerpo(textoDelDato(modelo?.titulo))
          + (numero === '' ? '' : `<p style="margin: 4px 0 0 0; color: ${COLORES.subtitulo}; font-size: 13px; font-weight: 600;">${escapeHtml(numero)}</p>`)
          + `<p style="margin: 6px 0 0 0; color: ${COLORES.secundario}; font-size: 14px;">${escapeHtml(textoDelDato(modelo?.bajada))}</p>`
          + parrafo(escapeHtml(saludo), '16px 0 0 0'),
        infografiaDelDato(propuestas, conElSvg),
        agendaDelDato(agenda),
        propuestasDelDato(propuestas),
        boton({ texto: BOTON_DEL_DATO_QUINCENA, url }),
        `<p style="margin: 0; color: ${COLORES.secundario}; font-size: 12px; line-height: 1.5;">${escapeHtml(nota)}</p>`
      ]
    }),
    text: [
      saludo,
      [textoDelDato(modelo?.titulo), ...(numero === '' ? [] : [numero]), textoDelDato(modelo?.bajada)].join('\n'),
      pieDeLaInfografia(conElSvg),
      ...(agenda.length > 0 ? [`Agenda de la quincena\n${agenda.map(eventoEnTexto).join('\n\n')}`] : []),
      ...propuestas.map(textoDeLaPropuesta),
      `${BOTON_DEL_DATO_QUINCENA}: ${url}`,
      nota
    ].join('\n\n')
  };
};
