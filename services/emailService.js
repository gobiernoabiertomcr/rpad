import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Configuración del transporter SMTP
const port = parseInt(process.env.SMTP_PORT) || 465;
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.comodoro.gov.ar',
  port: port,
  secure: port === 465, // true para 465 (SSL), false para 587 (STARTTLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false // Permite certificados auto-firmados
  }
});

// Destinatarios por defecto (DGMIT)
const DEFAULT_RECIPIENTS = [
  'datospublicos@comodoro.gov.ar',
  'mit@comodoro.gov.ar',
  'investigacionterritorial@comodoro.gov.ar'
];

/**
 * Remitente de todos los emails del sistema (avisos, recordatorios, accesos y Notas Digitales): un solo nombre,
 * con la casilla de SMTP_USER
 */
export const remitente = () => `"Dir. de Datos Públicos y Comunicación" <${process.env.SMTP_USER}>`;

/**
 * Convierte "a@x, b@y; c@z" o ['a@x', ...] en una lista limpia de direcciones
 */
export const listaDeCorreos = (valor) => {
  if (!valor) return [];
  const partes = Array.isArray(valor) ? valor : String(valor).split(/[,;]/);
  return partes.map(correo => String(correo).trim()).filter(Boolean);
};

/**
 * Barrera de pruebas: si EMAIL_SOLO_A tiene direcciones, solo se puede enviar a esas casillas.
 * En producción EMAIL_SOLO_A no se define y no filtra nada.
 */
export const filtrarDestinatarios = (lista, permitidos = process.env.EMAIL_SOLO_A) => {
  const autorizados = listaDeCorreos(permitidos).map(correo => correo.toLowerCase());
  const correos = listaDeCorreos(lista);
  if (autorizados.length === 0) return correos;
  return correos.filter(correo => autorizados.includes(correo.toLowerCase()));
};

/**
 * Envía un email. to, cc y bcc aceptan un string separado por comas o un array.
 * Devuelve { success: true, messageId, response } o { success: false, error, bloqueado? }
 */
export const sendEmail = async ({ subject, html, text, to = DEFAULT_RECIPIENTS, cc, bcc, replyTo, from, attachments }) => {
  const para = filtrarDestinatarios(to);
  const copia = filtrarDestinatarios(cc);
  const oculta = filtrarDestinatarios(bcc);

  if (para.length + copia.length + oculta.length === 0) {
    const bloqueado = listaDeCorreos(process.env.EMAIL_SOLO_A).length > 0;
    const error = bloqueado ? 'Bloqueado por EMAIL_SOLO_A' : 'No hay destinatarios';
    console.warn(`⚠️ Email no enviado (${subject}): ${error}`);
    return bloqueado ? { success: false, error, bloqueado } : { success: false, error };
  }

  try {
    const info = await transporter.sendMail({
      from: from || remitente(),
      to: para.length ? para.join(', ') : undefined,
      cc: copia.length ? copia.join(', ') : undefined,
      bcc: oculta.length ? oculta.join(', ') : undefined,
      replyTo,
      subject,
      html,
      text,
      attachments
    });

    console.log(`✉️ Email enviado: ${subject} → ${info.messageId}`);
    return { success: true, messageId: info.messageId, response: info.response };
  } catch (error) {
    console.error('❌ Error enviando email:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Envía un email a un área (aviso de 40 días)
 */
export const sendEmailToArea = ({ subject, html, to }) => sendEmail({
  subject,
  html,
  to: to || [],
  from: remitente()
});

/**
 * Verifica la conexión SMTP
 */
export const verifyConnection = async () => {
  try {
    console.log('🔌 Intentando conectar a SMTP...');
    console.log(`   Host: ${process.env.SMTP_HOST}`);
    console.log(`   Port: ${process.env.SMTP_PORT}`);
    console.log(`   User: ${process.env.SMTP_USER}`);
    console.log(`   Pass: ${process.env.SMTP_PASS ? '***configurado***' : '⚠️ NO CONFIGURADO'}`);
    
    await transporter.verify();
    console.log('✅ Conexión SMTP verificada');
    return { success: true };
  } catch (error) {
    console.error('❌ Error verificando SMTP:', error.message);
    console.error('   Código:', error.code);
    console.error('   Detalle:', error);
    return { success: false, error: error.message, code: error.code };
  }
};

export default transporter;
