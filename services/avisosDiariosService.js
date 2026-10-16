// Avisos diarios por email que no son Notas Digitales: el aviso directo a las áreas (40 días antes) y el email de
// cambios pendientes a los administradores. Salen solo en días hábiles y la fecha se recibe como parámetro, para
// poder probarlos con cualquier día.
// Spec: docs/superpowers/specs/2026-10-15-dias-habiles-licencias-auditoria-design.md (sección 4)
import pool from '../config/database.js';
import { sendEmail, sendEmailToArea } from './emailService.js';
import * as templates from './emailTemplates.js';
import { esDiaHabil, rangoDeAviso } from './notasDigitalesCalendario.js';

export const DIAS_AVISO_AREAS = 40;

/**
 * Datasets externos que avisa en esa fecha el aviso a las áreas, agrupados por área (solo áreas con email).
 * Un día hábil avisa los vencimientos de fecha + 40 y los de los días no hábiles que siguen (spec 4.2).
 * Fuera de un día hábil no hay nada que avisar.
 */
export const datasetsExternosPorArea = async (fecha) => {
  const rango = rangoDeAviso(fecha, DIAS_AVISO_AREAS);
  if (!rango) return [];
  const [rows] = await pool.execute(
    `SELECT d.id, d.titulo, d.url_dataset, d.proxima_actualizacion, d.area_id,
            f.nombre AS frecuencia_nombre,
            a.nombre AS area_nombre, a.area_superior, a.email_principal, a.email_secundario,
            a.telefono_area, a.celular_area, a.nombre_contacto, a.telefono_contacto, a.email_contacto
     FROM datasets d
     JOIN frecuencias f ON d.frecuencia_id = f.id
     JOIN areas a ON d.area_id = a.id
     WHERE d.activo = TRUE
       AND d.tipo_gestion = 'externa'
       AND d.proxima_actualizacion BETWEEN ? AND ?
       AND f.dias IS NOT NULL
       AND (a.email_principal IS NOT NULL OR a.email_secundario IS NOT NULL)
     ORDER BY a.nombre ASC, d.titulo ASC`,
    [rango.desde, rango.hasta]
  );

  // Agrupar por área
  const porArea = {};
  rows.forEach(d => {
    if (!porArea[d.area_id]) {
      porArea[d.area_id] = {
        area_id: d.area_id,
        area_nombre: d.area_nombre,
        area_superior: d.area_superior,
        email_principal: d.email_principal,
        email_secundario: d.email_secundario,
        telefono_area: d.telefono_area,
        celular_area: d.celular_area,
        nombre_contacto: d.nombre_contacto,
        telefono_contacto: d.telefono_contacto,
        email_contacto: d.email_contacto,
        datasets: []
      };
    }
    porArea[d.area_id].datasets.push({
      id: d.id,
      titulo: d.titulo,
      url_dataset: d.url_dataset,
      proxima_actualizacion: d.proxima_actualizacion,
      frecuencia_nombre: d.frecuencia_nombre
    });
  });

  return Object.values(porArea);
};

// Registra una notificación en el log de la BD (un error acá no corta el envío)
const logNotificacion = async (tipo, areaId, destinatarios, datasetsIds, success, errorMessage = null) => {
  try {
    await pool.execute(
      `INSERT INTO notificaciones_log (tipo, area_id, destinatarios, datasets_ids, cantidad_datasets, success, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tipo, areaId, destinatarios, datasetsIds.join(','), datasetsIds.length, success ? 1 : 0, errorMessage]
    );
  } catch (error) {
    console.error('Error guardando log de notificación:', error);
  }
};

/**
 * Aviso directo a las áreas de gestión externa (spec 4.2). Devuelve qué se envió:
 * { dia_habil, enviados: [{ tipo, area, cantidad }], errores: [{ tipo, area, error }], sin_datasets }
 */
export const enviarAvisoAreas = async ({ hoy }) => {
  const resultado = { dia_habil: esDiaHabil(hoy), enviados: [], errores: [], sin_datasets: true };
  if (!resultado.dia_habil) return resultado;

  const areas = await datasetsExternosPorArea(hoy);
  resultado.sin_datasets = areas.length === 0;
  for (const areaData of areas) {
    const { subject, html } = templates.areaAviso40dias(areaData);
    const destinatarios = [areaData.email_principal, areaData.email_secundario].filter(Boolean);
    const envio = await sendEmailToArea({ subject, html, to: destinatarios });
    const datasetsIds = areaData.datasets.map(d => d.id);
    await logNotificacion('area-aviso-40', areaData.area_id, destinatarios.join(','), datasetsIds, envio.success, envio.error);
    if (envio.success) {
      resultado.enviados.push({ tipo: 'area-aviso-40', area: areaData.area_nombre, cantidad: areaData.datasets.length });
    } else {
      resultado.errores.push({ tipo: 'area-aviso-40', area: areaData.area_nombre, error: envio.error });
    }
  }
  return resultado;
};

/**
 * Cambios pendientes que puede revisar un admin (excluye los propios)
 * @param {number} adminId - ID del admin que va a revisar
 */
export const cambiosPendientesParaAdmin = async (adminId) => {
  const [rows] = await pool.execute(
    `SELECT
       cp.id,
       cp.tipo_cambio,
       cp.dataset_id,
       cp.datos_nuevos,
       cp.usuario_id,
       cp.created_at,
       d.titulo AS dataset_titulo,
       u.username AS usuario_username,
       u.nombre_completo AS usuario_nombre,
       CASE
         WHEN TIMESTAMPDIFF(MINUTE, cp.created_at, NOW()) < 60 THEN CONCAT('Hace ', TIMESTAMPDIFF(MINUTE, cp.created_at, NOW()), ' minutos')
         WHEN TIMESTAMPDIFF(HOUR, cp.created_at, NOW()) < 24 THEN CONCAT('Hace ', TIMESTAMPDIFF(HOUR, cp.created_at, NOW()), ' horas')
         ELSE CONCAT('Hace ', TIMESTAMPDIFF(DAY, cp.created_at, NOW()), ' dias')
       END AS tiempo_pendiente
     FROM cambios_pendientes cp
     JOIN usuarios u ON cp.usuario_id = u.id
     LEFT JOIN datasets d ON cp.dataset_id = d.id
     WHERE cp.estado = 'pendiente'
       AND cp.usuario_id != ?
     ORDER BY cp.created_at ASC`,
    [adminId]
  );

  // Parsear datos_nuevos JSON
  return rows.map(row => ({
    ...row,
    datos_nuevos: typeof row.datos_nuevos === 'string' ? JSON.parse(row.datos_nuevos) : row.datos_nuevos
  }));
};

// Admins activos con email que ya pueden ingresar y aprobar (con contraseña definida), y si están de licencia en la fecha
const adminsConEmail = async (hoy) => {
  const [rows] = await pool.execute(
    `SELECT u.id, u.username, u.nombre_completo, u.email,
       EXISTS (SELECT 1 FROM usuarios_licencias l
               WHERE l.usuario_id = u.id AND l.anulada = 0 AND l.desde <= ? AND l.hasta >= ?) AS de_licencia
     FROM usuarios u
     WHERE u.rol IN ('admin', 'superadmin') AND u.activo = TRUE AND u.email IS NOT NULL AND u.password_hash IS NOT NULL`,
    [hoy, hoy]
  );
  return rows.map(r => ({ ...r, de_licencia: Boolean(Number(r.de_licencia)) }));
};

/**
 * Email de cambios pendientes (spec 4.1): a cada admin, los cambios que puede revisar. Solo en días hábiles.
 * Quien está de licencia ese día no recibe el email (spec 5.3).
 * { fecha, dia_habil, enviados: [{ admin, email, cantidadPendientes }], sinPendientes: [username], deLicencia: [username],
 *   errores: [{ admin, error }] }
 */
export const enviarCambiosPendientes = async ({ hoy }) => {
  const resultados = {
    fecha: new Date().toISOString(), dia_habil: esDiaHabil(hoy), enviados: [], sinPendientes: [], deLicencia: [], errores: []
  };
  if (!resultados.dia_habil) return resultados;

  for (const admin of await adminsConEmail(hoy)) {
    // Durante la licencia no recibe emails del sistema (spec 2026-10-15, 5.3)
    if (admin.de_licencia) {
      resultados.deLicencia.push(admin.username);
      continue;
    }
    const cambiosPendientes = await cambiosPendientesParaAdmin(admin.id);
    if (cambiosPendientes.length === 0) {
      resultados.sinPendientes.push(admin.username);
      continue;
    }
    const { subject, html } = templates.cambiosPendientesTemplate(cambiosPendientes);
    const envio = await sendEmail({ subject, html, to: [admin.email] });
    if (envio.success) {
      resultados.enviados.push({ admin: admin.username, email: admin.email, cantidadPendientes: cambiosPendientes.length });
    } else {
      resultados.errores.push({ admin: admin.username, error: envio.error });
    }
  }
  return resultados;
};
