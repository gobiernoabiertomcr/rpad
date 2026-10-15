import pool from '../config/database.js';
import { sendEmail, sendEmailToArea, verifyConnection, listaDeCorreos } from '../services/emailService.js';
import * as templates from '../services/emailTemplates.js';
import { ejecutarNotasDigitales } from '../services/notasDigitales.js';
import { obtenerConfig } from '../services/notasDigitalesDatos.js';
import { hoyArgentina } from '../services/notasDigitalesCalendario.js';

/**
 * Obtiene datasets externos agrupados por área para el aviso de -40 días
 * Solo áreas con email configurado
 */
const getDatasetsExternosPorArea = async (dias) => {
  const query = `
    SELECT d.id, d.titulo, d.url_dataset, d.proxima_actualizacion, d.area_id,
           f.nombre AS frecuencia_nombre,
           a.nombre AS area_nombre, a.area_superior, a.email_principal, a.email_secundario,
           a.telefono_area, a.celular_area, a.nombre_contacto, a.telefono_contacto, a.email_contacto
    FROM datasets d
    JOIN frecuencias f ON d.frecuencia_id = f.id
    JOIN areas a ON d.area_id = a.id
    WHERE d.activo = TRUE 
      AND d.tipo_gestion = 'externa'
      AND d.proxima_actualizacion = DATE_ADD(CURDATE(), INTERVAL ? DAY)
      AND f.dias IS NOT NULL
      AND (a.email_principal IS NOT NULL OR a.email_secundario IS NOT NULL)
    ORDER BY a.nombre ASC, d.titulo ASC
  `;

  const [rows] = await pool.execute(query, [dias]);
  
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

// Área de ejemplo para la vista previa y la prueba del aviso a áreas cuando hoy no hay datos
const AREA_DE_EJEMPLO = {
  area_id: 0,
  area_nombre: 'Dirección de Ejemplo',
  area_superior: 'Secretaría de Ejemplo',
  email_principal: 'ejemplo@comodoro.gov.ar',
  email_secundario: null,
  telefono_area: '297 4XXXXXX',
  celular_area: null,
  nombre_contacto: 'Persona de contacto',
  telefono_contacto: null,
  email_contacto: null,
  datasets: [
    { id: 1, titulo: 'Dataset de Ejemplo 1', frecuencia_nombre: 'Anualmente', url_dataset: 'https://datos.comodoro.gov.ar/dataset/ejemplo' },
    { id: 2, titulo: 'Dataset de Ejemplo 2', frecuencia_nombre: 'Cada medio año', url_dataset: 'https://datos.comodoro.gov.ar/dataset/ejemplo-2' }
  ]
};

/**
 * Registra una notificación en el log de la BD
 */
const logNotificacion = async (tipo, areaId, destinatarios, datasetsIds, success, errorMessage = null) => {
  try {
    await pool.execute(
      `INSERT INTO notificaciones_log (tipo, area_id, destinatarios, datasets_ids, cantidad_datasets, success, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tipo,
        areaId,
        destinatarios,
        datasetsIds.join(','),
        datasetsIds.length,
        success ? 1 : 0,
        errorMessage
      ]
    );
  } catch (error) {
    console.error('Error guardando log de notificación:', error);
  }
};

/**
 * Obtiene cambios pendientes para un admin específico (excluyendo los propios)
 * @param {number} adminId - ID del admin que va a revisar
 */
const getCambiosPendientesParaAdmin = async (adminId) => {
  const query = `
    SELECT 
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
    ORDER BY cp.created_at ASC
  `;
  
  const [rows] = await pool.execute(query, [adminId]);
  
  // Parsear datos_nuevos JSON
  return rows.map(row => ({
    ...row,
    datos_nuevos: typeof row.datos_nuevos === 'string' ? JSON.parse(row.datos_nuevos) : row.datos_nuevos
  }));
};

/**
 * Obtiene todos los admins con sus emails (para notificaciones)
 */
const getAdminsConEmail = async () => {
  const [rows] = await pool.execute(
    `SELECT id, username, nombre_completo, email 
     FROM usuarios 
     WHERE rol IN ('admin', 'superadmin') AND activo = TRUE AND email IS NOT NULL`
  );
  return rows;
};

/**
 * Proceso diario (cron de las 8:00): aviso directo a las áreas y Notas Digitales
 */
export const ejecutarNotificacionesDiarias = async (req, res) => {
  const resultados = { fecha: new Date().toISOString(), enviados: [], errores: [], sinDatasets: [], notasDigitales: null };

  try {
    // Aviso directo a las áreas de gestión externa (40 días antes). Va aislado: un error acá no saltea las Notas Digitales
    try {
      const areasPorNotificar = await getDatasetsExternosPorArea(40);
      for (const areaData of areasPorNotificar) {
        const { subject, html } = templates.areaAviso40dias(areaData);
        const destinatarios = [areaData.email_principal, areaData.email_secundario].filter(Boolean);
        const result = await sendEmailToArea({ subject, html, to: destinatarios });
        const datasetsIds = areaData.datasets.map(d => d.id);
        await logNotificacion('area-aviso-40', areaData.area_id, destinatarios.join(','), datasetsIds, result.success, result.error);
        if (result.success) {
          resultados.enviados.push({ tipo: 'area-aviso-40', area: areaData.area_nombre, cantidad: areaData.datasets.length });
        } else {
          resultados.errores.push({ tipo: 'area-aviso-40', area: areaData.area_nombre, error: result.error });
        }
      }
      if (areasPorNotificar.length === 0) resultados.sinDatasets.push('area-aviso-40');
    } catch (error) {
      console.error('Error en el aviso a las áreas:', error);
      resultados.errores.push({ tipo: 'area-aviso-40', error: 'Error ejecutando el aviso a las áreas' });
    }

    // Notas Digitales (reemplazan los avisos de gestión interna y externa).
    // creado_por: el admin que pidió la corrida; el cron no tiene req.user y queda en NULL
    try {
      resultados.notasDigitales = await ejecutarNotasDigitales({ hoy: hoyArgentina(), usuarioId: req.user?.userId ?? null });
      if (resultados.notasDigitales.fallidas > 0) {
        resultados.errores.push({ tipo: 'notas-digitales', error: `${resultados.notasDigitales.fallidas} nota(s) no se pudieron enviar` });
      }
      // Pasos que fallaron con una excepción: también quedan en la última corrida que muestra Correos > Estado
      for (const fallo of resultados.notasDigitales.errores ?? []) {
        resultados.errores.push({ tipo: 'notas-digitales', paso: fallo.tipo, gestion: fallo.gestion, id: fallo.id, error: fallo.mensaje });
      }
    } catch (error) {
      console.error('Error en Notas Digitales:', error);
      resultados.errores.push({ tipo: 'notas-digitales', error: 'Error ejecutando Notas Digitales' });
    }

    const success = resultados.errores.length === 0;
    res.status(success ? 200 : 207).json({
      success,
      message: success ? 'Proceso completado.' : `Proceso completado con ${resultados.errores.length} errores.`,
      data: resultados
    });
  } catch (error) {
    console.error('Error en notificaciones:', error);
    res.status(500).json({ success: false, error: 'Error ejecutando notificaciones' });
  }
};

/**
 * Prueba del aviso a áreas: se envía solo a las casillas de prueba de Notas Digitales
 */
export const pruebaAvisoArea = async (req, res) => {
  try {
    const casillas = listaDeCorreos((await obtenerConfig()).casillas_prueba);
    if (casillas.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay casillas de prueba configuradas (Correos > Configuración)' });
    }
    const [area] = await getDatasetsExternosPorArea(40);
    const datosArea = area ?? AREA_DE_EJEMPLO;
    const { subject, html } = templates.areaAviso40dias(datosArea);
    const result = await sendEmailToArea({ subject: `[PRUEBA] ${subject}`, html, to: casillas });
    if (!result.success) return res.status(502).json({ success: false, error: `No se pudo enviar la prueba: ${result.error}` });
    res.json({
      success: true,
      message: `Prueba enviada a ${casillas.join(', ')}${area ? '' : ' (con datos de ejemplo)'}`,
      data: { area: datosArea.area_nombre, ejemplo: !area, destinatarios: casillas }
    });
  } catch (error) {
    console.error('Error en prueba de aviso a áreas:', error);
    res.status(500).json({ success: false, error: 'Error enviando la prueba' });
  }
};

/**
 * Verifica la conexión SMTP
 */
export const verificarSMTP = async (req, res) => {
  const result = await verifyConnection();
  res.json({
    success: result.success,
    message: result.success ? 'Conexión SMTP verificada' : 'Error conectando a SMTP',
    error: result.error || null,
    code: result.code || null
  });
};

/**
 * Vista previa del aviso a áreas (sin enviar)
 */
export const previewEmail = async (req, res) => {
  if (req.params.tipo !== 'area-aviso-40') {
    return res.status(400).json({ success: false, error: 'Tipo no válido', tiposDisponibles: ['area-aviso-40'] });
  }
  try {
    const [area] = await getDatasetsExternosPorArea(40);
    const { html } = templates.areaAviso40dias(area ?? AREA_DE_EJEMPLO);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error en vista previa:', error);
    res.status(500).json({ success: false, error: 'Error generando la vista previa' });
  }
};

/**
 * Ejecuta notificación de cambios pendientes
 * Llamado por cron a las 13:00
 * Envía email a cada admin con los cambios que puede revisar (excluye los propios)
 */
export const ejecutarNotificacionCambiosPendientes = async (req, res) => {
  const resultados = {
    fecha: new Date().toISOString(),
    enviados: [],
    sinPendientes: [],
    errores: []
  };

  try {
    // Obtener todos los admins
    const admins = await getAdminsConEmail();

    for (const admin of admins) {
      // Obtener cambios pendientes que este admin puede revisar
      const cambiosPendientes = await getCambiosPendientesParaAdmin(admin.id);

      if (cambiosPendientes.length === 0) {
        resultados.sinPendientes.push(admin.username);
        continue;
      }

      // Generar y enviar email
      const { subject, html } = templates.cambiosPendientesTemplate(cambiosPendientes);
      const result = await sendEmail({ subject, html, to: [admin.email] });

      if (result.success) {
        resultados.enviados.push({
          admin: admin.username,
          email: admin.email,
          cantidadPendientes: cambiosPendientes.length
        });
      } else {
        resultados.errores.push({
          admin: admin.username,
          error: result.error
        });
      }
    }

    const success = resultados.errores.length === 0;
    res.status(success ? 200 : 207).json({
      success,
      message: success
        ? `Notificaciones enviadas a ${resultados.enviados.length} admins.`
        : `Proceso completado con ${resultados.errores.length} errores.`,
      data: resultados
    });

  } catch (error) {
    console.error('Error en notificación de cambios pendientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error ejecutando notificación de cambios pendientes',
      details: error.message
    });
  }
};

/**
 * Preview de email de cambios pendientes (sin enviar)
 */
export const previewCambiosPendientes = async (req, res) => {
  try {
    // Usar el usuario actual o buscar cualquier admin para preview
    const userId = req.user?.id || 0;
    
    let cambiosPendientes = await getCambiosPendientesParaAdmin(userId);

    // Si no hay datos reales, usar ejemplo
    if (cambiosPendientes.length === 0) {
      cambiosPendientes = [
        {
          id: 1,
          tipo_cambio: 'crear',
          dataset_id: null,
          datos_nuevos: { titulo: 'Dataset de Ejemplo Nuevo' },
          usuario_username: 'usuario_ejemplo',
          usuario_nombre: 'Usuario de Ejemplo',
          tiempo_pendiente: 'Hace 2 horas'
        },
        {
          id: 2,
          tipo_cambio: 'editar',
          dataset_id: 5,
          dataset_titulo: 'Presupuesto Municipal 2025',
          datos_nuevos: { titulo: 'Presupuesto Municipal 2025 (Actualizado)' },
          usuario_username: 'otro_usuario',
          usuario_nombre: 'Otro Usuario',
          tiempo_pendiente: 'Hace 1 dia'
        },
        {
          id: 3,
          tipo_cambio: 'eliminar',
          dataset_id: 10,
          dataset_titulo: 'Dataset Obsoleto',
          datos_nuevos: null,
          usuario_username: 'tercer_usuario',
          usuario_nombre: 'Tercer Usuario',
          tiempo_pendiente: 'Hace 3 dias'
        }
      ];
    }

    const { html } = templates.cambiosPendientesTemplate(cambiosPendientes);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
