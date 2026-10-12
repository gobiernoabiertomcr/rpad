import pool from '../config/database.js';
import { sendEmail, sendEmailToArea, verifyConnection } from '../services/emailService.js';
import * as templates from '../services/emailTemplates.js';

/**
 * Obtiene datasets por tipo de gestión y días hasta vencimiento
 * @param {string} tipoGestion - 'interna' o 'externa'
 * @param {number} dias - Días exactos hasta vencimiento (negativo para vencidos)
 * @param {boolean} vencidos - Si es true, busca todos los vencidos (ignora dias)
 */
const getDatasetsByDias = async (tipoGestion, dias, vencidos = false) => {
  let query;
  let params;

  if (vencidos) {
    // Todos los vencidos (proxima_actualizacion < hoy)
    query = `
      SELECT d.id, d.titulo, d.url_dataset, d.proxima_actualizacion, d.area_id,
             f.nombre AS frecuencia_nombre,
             a.nombre AS area_nombre, a.area_superior, a.email_principal, a.email_secundario,
             a.telefono_area, a.celular_area, a.nombre_contacto, a.telefono_contacto, a.email_contacto
      FROM datasets d
      JOIN frecuencias f ON d.frecuencia_id = f.id
      JOIN areas a ON d.area_id = a.id
      WHERE d.activo = TRUE 
        AND d.tipo_gestion = ?
        AND d.proxima_actualizacion < CURDATE()
        AND f.dias IS NOT NULL
      ORDER BY d.proxima_actualizacion ASC
    `;
    params = [tipoGestion];
  } else {
    // Exactamente X días hasta vencimiento
    query = `
      SELECT d.id, d.titulo, d.url_dataset, d.proxima_actualizacion, d.area_id,
             f.nombre AS frecuencia_nombre,
             a.nombre AS area_nombre, a.area_superior, a.email_principal, a.email_secundario,
             a.telefono_area, a.celular_area, a.nombre_contacto, a.telefono_contacto, a.email_contacto
      FROM datasets d
      JOIN frecuencias f ON d.frecuencia_id = f.id
      JOIN areas a ON d.area_id = a.id
      WHERE d.activo = TRUE 
        AND d.tipo_gestion = ?
        AND d.proxima_actualizacion = DATE_ADD(CURDATE(), INTERVAL ? DAY)
        AND f.dias IS NOT NULL
      ORDER BY d.titulo ASC
    `;
    params = [tipoGestion, dias];
  }

  const [rows] = await pool.execute(query, params);
  return rows;
};

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
     WHERE rol = 'admin' AND activo = TRUE AND email IS NOT NULL`
  );
  return rows;
};

/**
 * Ejecuta el proceso de notificaciones diarias
 * Llamado por cron a las 8:00 AM
 */
export const ejecutarNotificacionesDiarias = async (req, res) => {
  const resultados = {
    fecha: new Date().toISOString(),
    enviados: [],
    errores: [],
    sinDatasets: []
  };

  try {
    const hoy = new Date();
    const esDia1 = hoy.getDate() === 1;

    // =====================================================
    // INTERNOS
    // =====================================================

    // -60 días
    const internos60 = await getDatasetsByDias('interna', 60);
    if (internos60.length > 0) {
      const { subject, html } = templates.interno60dias(internos60);
      const result = await sendEmail({ subject, html });
      const datasetsIds = internos60.map(d => d.id);
      await logNotificacion('interno-60', null, 'datospublicos@comodoro.gov.ar,mit@comodoro.gov.ar,investigacionterritorial@comodoro.gov.ar', datasetsIds, result.success, result.error);
      if (result.success) {
        resultados.enviados.push({ tipo: 'interno-60', cantidad: internos60.length });
      } else {
        resultados.errores.push({ tipo: 'interno-60', error: result.error });
      }
    } else {
      resultados.sinDatasets.push('interno-60');
    }

    // -30 días
    const internos30 = await getDatasetsByDias('interna', 30);
    if (internos30.length > 0) {
      const { subject, html } = templates.interno30dias(internos30);
      const result = await sendEmail({ subject, html });
      const datasetsIds = internos30.map(d => d.id);
      await logNotificacion('interno-30', null, 'datospublicos@comodoro.gov.ar,mit@comodoro.gov.ar,investigacionterritorial@comodoro.gov.ar', datasetsIds, result.success, result.error);
      if (result.success) {
        resultados.enviados.push({ tipo: 'interno-30', cantidad: internos30.length });
      } else {
        resultados.errores.push({ tipo: 'interno-30', error: result.error });
      }
    } else {
      resultados.sinDatasets.push('interno-30');
    }

    // Vencidos (solo día 1)
    if (esDia1) {
      const internosVencidos = await getDatasetsByDias('interna', 0, true);
      if (internosVencidos.length > 0) {
        const { subject, html } = templates.internoVencido(internosVencidos);
        const result = await sendEmail({ subject, html });
        const datasetsIds = internosVencidos.map(d => d.id);
        await logNotificacion('interno-vencido', null, 'datospublicos@comodoro.gov.ar,mit@comodoro.gov.ar,investigacionterritorial@comodoro.gov.ar', datasetsIds, result.success, result.error);
        if (result.success) {
          resultados.enviados.push({ tipo: 'interno-vencido', cantidad: internosVencidos.length });
        } else {
          resultados.errores.push({ tipo: 'interno-vencido', error: result.error });
        }
      } else {
        resultados.sinDatasets.push('interno-vencido');
      }
    }

    // =====================================================
    // EXTERNOS
    // =====================================================

    // -60 días
    const externos60 = await getDatasetsByDias('externa', 60);
    if (externos60.length > 0) {
      const { subject, html } = templates.externo60dias(externos60);
      const result = await sendEmail({ subject, html });
      const datasetsIds = externos60.map(d => d.id);
      await logNotificacion('externo-60', null, 'datospublicos@comodoro.gov.ar,mit@comodoro.gov.ar,investigacionterritorial@comodoro.gov.ar', datasetsIds, result.success, result.error);
      if (result.success) {
        resultados.enviados.push({ tipo: 'externo-60', cantidad: externos60.length });
      } else {
        resultados.errores.push({ tipo: 'externo-60', error: result.error });
      }
    } else {
      resultados.sinDatasets.push('externo-60');
    }

    // -40 días (notificación a DGMIT)
    const externos40 = await getDatasetsByDias('externa', 40);
    if (externos40.length > 0) {
      const { subject, html } = templates.externo40dias(externos40);
      const result = await sendEmail({ subject, html });
      const datasetsIds = externos40.map(d => d.id);
      await logNotificacion('externo-40', null, 'datospublicos@comodoro.gov.ar,mit@comodoro.gov.ar,investigacionterritorial@comodoro.gov.ar', datasetsIds, result.success, result.error);
      if (result.success) {
        resultados.enviados.push({ tipo: 'externo-40', cantidad: externos40.length });
      } else {
        resultados.errores.push({ tipo: 'externo-40', error: result.error });
      }
    } else {
      resultados.sinDatasets.push('externo-40');
    }

    // =====================================================
    // -40 días: AVISO A ÁREAS EXTERNAS (nuevo)
    // =====================================================
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
    if (areasPorNotificar.length === 0) {
      resultados.sinDatasets.push('area-aviso-40');
    }

    // -5 días
    const externos5 = await getDatasetsByDias('externa', 5);
    if (externos5.length > 0) {
      const { subject, html } = templates.externo5dias(externos5);
      const result = await sendEmail({ subject, html });
      const datasetsIds = externos5.map(d => d.id);
      await logNotificacion('externo-5', null, 'datospublicos@comodoro.gov.ar,mit@comodoro.gov.ar,investigacionterritorial@comodoro.gov.ar', datasetsIds, result.success, result.error);
      if (result.success) {
        resultados.enviados.push({ tipo: 'externo-5', cantidad: externos5.length });
      } else {
        resultados.errores.push({ tipo: 'externo-5', error: result.error });
      }
    } else {
      resultados.sinDatasets.push('externo-5');
    }

    // Vencidos (solo día 1)
    if (esDia1) {
      const externosVencidos = await getDatasetsByDias('externa', 0, true);
      if (externosVencidos.length > 0) {
        const { subject, html } = templates.externoVencido(externosVencidos);
        const result = await sendEmail({ subject, html });
        const datasetsIds = externosVencidos.map(d => d.id);
        await logNotificacion('externo-vencido', null, 'datospublicos@comodoro.gov.ar,mit@comodoro.gov.ar,investigacionterritorial@comodoro.gov.ar', datasetsIds, result.success, result.error);
        if (result.success) {
          resultados.enviados.push({ tipo: 'externo-vencido', cantidad: externosVencidos.length });
        } else {
          resultados.errores.push({ tipo: 'externo-vencido', error: result.error });
        }
      } else {
        resultados.sinDatasets.push('externo-vencido');
      }
    }

    // Respuesta
    const success = resultados.errores.length === 0;
    res.status(success ? 200 : 207).json({
      success,
      message: success 
        ? `Proceso completado. ${resultados.enviados.length} emails enviados.`
        : `Proceso completado con ${resultados.errores.length} errores.`,
      data: resultados
    });

  } catch (error) {
    console.error('Error en notificaciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error ejecutando notificaciones',
      details: error.message
    });
  }
};

/**
 * Endpoint de prueba para enviar un tipo específico de notificación
 * Útil para testear sin esperar al cron
 */
export const pruebaNotificacion = async (req, res) => {
  const { tipo } = req.params;
  
  // Mapeo de tipos válidos
  const tiposValidos = {
    'interno-60': { tipoGestion: 'interna', dias: 60, template: templates.interno60dias },
    'interno-30': { tipoGestion: 'interna', dias: 30, template: templates.interno30dias },
    'interno-vencido': { tipoGestion: 'interna', vencidos: true, template: templates.internoVencido },
    'externo-60': { tipoGestion: 'externa', dias: 60, template: templates.externo60dias },
    'externo-40': { tipoGestion: 'externa', dias: 40, template: templates.externo40dias },
    'externo-5': { tipoGestion: 'externa', dias: 5, template: templates.externo5dias },
    'externo-vencido': { tipoGestion: 'externa', vencidos: true, template: templates.externoVencido },
    'area-aviso-40': { special: 'area-aviso' }
  };

  if (!tiposValidos[tipo]) {
    return res.status(400).json({
      success: false,
      error: 'Tipo no válido',
      tiposDisponibles: Object.keys(tiposValidos)
    });
  }

  try {
    const config = tiposValidos[tipo];

    // Caso especial: area-aviso-40
    if (config.special === 'area-aviso') {
      const areasPorNotificar = await getDatasetsExternosPorArea(40);
      if (areasPorNotificar.length === 0) {
        return res.json({
          success: true,
          message: 'No hay áreas con datasets que cumplan los criterios (40 días, gestión externa, con email)',
          tipo,
          areasEncontradas: 0
        });
      }

      // Enviar a todas las áreas
      const resultadosAreas = [];
      for (const areaData of areasPorNotificar) {
        const { subject, html } = templates.areaAviso40dias(areaData);
        const destinatarios = [areaData.email_principal, areaData.email_secundario].filter(Boolean);
        const result = await sendEmailToArea({ subject, html, to: destinatarios });
        const datasetsIds = areaData.datasets.map(d => d.id);
        await logNotificacion('area-aviso-40', areaData.area_id, destinatarios.join(','), datasetsIds, result.success, result.error);
        resultadosAreas.push({
          area: areaData.area_nombre,
          destinatarios,
          datasets: areaData.datasets.length,
          success: result.success,
          error: result.error
        });
      }

      return res.json({
        success: resultadosAreas.every(r => r.success),
        message: 'Emails de aviso a áreas enviados',
        tipo,
        areasNotificadas: resultadosAreas
      });
    }

    // Casos normales
    const datasets = await getDatasetsByDias(
      config.tipoGestion, 
      config.dias || 0, 
      config.vencidos || false
    );

    if (datasets.length === 0) {
      return res.json({
        success: true,
        message: 'No hay datasets que cumplan los criterios',
        tipo,
        datasetsEncontrados: 0
      });
    }

    const { subject, html } = config.template(datasets);
    const result = await sendEmail({ subject, html });
    const datasetsIds = datasets.map(d => d.id);
    await logNotificacion(tipo, null, 'datospublicos@comodoro.gov.ar,mit@comodoro.gov.ar,investigacionterritorial@comodoro.gov.ar', datasetsIds, result.success, result.error);

    res.json({
      success: result.success,
      message: result.success ? 'Email de prueba enviado' : 'Error enviando email',
      tipo,
      datasetsEncontrados: datasets.length,
      datasets: datasets.map(d => d.titulo),
      ...(result.error && { error: result.error })
    });

  } catch (error) {
    console.error('Error en prueba:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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
 * Preview de email (sin enviar)
 * Devuelve el HTML para visualizar
 */
export const previewEmail = async (req, res) => {
  const { tipo } = req.params;
  
  const tiposValidos = {
    'interno-60': { tipoGestion: 'interna', dias: 60, template: templates.interno60dias },
    'interno-30': { tipoGestion: 'interna', dias: 30, template: templates.interno30dias },
    'interno-vencido': { tipoGestion: 'interna', vencidos: true, template: templates.internoVencido },
    'externo-60': { tipoGestion: 'externa', dias: 60, template: templates.externo60dias },
    'externo-40': { tipoGestion: 'externa', dias: 40, template: templates.externo40dias },
    'externo-5': { tipoGestion: 'externa', dias: 5, template: templates.externo5dias },
    'externo-vencido': { tipoGestion: 'externa', vencidos: true, template: templates.externoVencido },
    'area-aviso-40': { special: 'area-aviso' }
  };

  if (!tiposValidos[tipo]) {
    return res.status(400).json({
      success: false,
      error: 'Tipo no válido',
      tiposDisponibles: Object.keys(tiposValidos)
    });
  }

  try {
    const config = tiposValidos[tipo];

    // Caso especial: area-aviso-40
    if (config.special === 'area-aviso') {
      let areasPorNotificar = await getDatasetsExternosPorArea(40);
      
      // Si no hay datos reales, usar ejemplo
      if (areasPorNotificar.length === 0) {
        areasPorNotificar = [{
          area_id: 0,
          area_nombre: 'Dirección de Ejemplo',
          area_superior: 'Secretaría de Ejemplo',
          email_principal: 'ejemplo@comodoro.gov.ar',
          email_secundario: 'ejemplo2@comodoro.gov.ar',
          telefono_area: '297 4XXXXXX',
          celular_area: '297 XXXXXXX',
          nombre_contacto: 'Juan Pérez',
          telefono_contacto: '297 XXXXXXX',
          email_contacto: 'juan.perez@email.com',
          datasets: [
            { id: 1, titulo: 'Dataset de Ejemplo 1', frecuencia_nombre: 'Mensual', url_dataset: 'https://datos.comodoro.gov.ar/dataset/ejemplo' },
            { id: 2, titulo: 'Dataset de Ejemplo 2', frecuencia_nombre: 'Trimestral', url_dataset: 'https://datos.comodoro.gov.ar/dataset/ejemplo-2' }
          ]
        }];
      }

      const { subject, html } = templates.areaAviso40dias(areasPorNotificar[0]);
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }

    // Casos normales
    let datasets = await getDatasetsByDias(
      config.tipoGestion, 
      config.dias || 0, 
      config.vencidos || false
    );

    // Si no hay datasets reales, usar datos de ejemplo
    if (datasets.length === 0) {
      datasets = [
        {
          id: 1,
          titulo: 'Dataset de Ejemplo 1',
          frecuencia_nombre: 'Mensual',
          area_nombre: 'Área de Ejemplo',
          area_superior: 'Secretaría de Ejemplo',
          email_principal: 'area@comodoro.gov.ar',
          email_secundario: null,
          telefono_area: '297 4XXXXXX',
          celular_area: null,
          nombre_contacto: 'Juan Pérez',
          telefono_contacto: '297 XXXXXXX',
          email_contacto: 'juan@email.com',
          url_dataset: 'https://datos.comodoro.gov.ar/dataset/ejemplo'
        },
        {
          id: 2,
          titulo: 'Dataset de Ejemplo 2',
          frecuencia_nombre: 'Trimestral',
          area_nombre: 'Otra Área de Ejemplo',
          area_superior: 'Subsecretaría de Ejemplo',
          email_principal: 'otra@comodoro.gov.ar',
          email_secundario: 'otra2@comodoro.gov.ar',
          telefono_area: null,
          celular_area: '297 XXXXXXX',
          nombre_contacto: null,
          telefono_contacto: null,
          email_contacto: null,
          url_dataset: 'https://datos.comodoro.gov.ar/dataset/ejemplo-2'
        }
      ];
    }

    const { subject, html } = config.template(datasets);

    // Devolver HTML para previsualizar en el navegador
    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
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
