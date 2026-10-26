import pool from '../config/database.js';
import path from 'path';
import fs from 'fs/promises';
import { UPLOADS_BASE } from '../config/upload.js';
import { estadoDelDataset, cumplimientoPorArea } from '../services/fechasDatasetReglas.js';
import { hoyArgentina } from '../services/notasDigitalesCalendario.js';

/**
 * La tasa de cumplimiento y el ranking de áreas (Ruling 23): la misma cuenta que el tablero, el Estado General y el
 * Cumplimiento (spec 2026-10-17-fechas-datasets, 11 y Ruling 22), con la regla de cumplimientoPorArea, la misma que usa Métricas
 * (areasYTemas). Cada dataset activo tiene el estado de estadoDelDataset con hoyArgentina(). filas: { area (null si no tiene),
 * proxima_iso, frecuencia_meses, tipo_gestion }
 */
const cumplimientoDeGestion = (filas, hoy) => cumplimientoPorArea(filas.map((fila) => ({
  area: fila.area,
  estado: estadoDelDataset({ proxima: fila.proxima_iso, meses: fila.frecuencia_meses ?? null, tipoGestion: fila.tipo_gestion, hoy }).estado
})));

// =====================================================
// MÉTRICAS AUTOMÁTICAS
// =====================================================

export const getMetricasAutomaticas = async (req, res) => {
  try {
    const mesesAtras = parseInt(req.query.meses) || 12;
    const fechaDesde = new Date();
    fechaDesde.setMonth(fechaDesde.getMonth() - mesesAtras);
    const desde = fechaDesde.toISOString().split('T')[0];

    // Datasets actualizados por mes
    const [actualizados] = await pool.execute(
      `SELECT YEAR(fecha_actualizacion) as anio, MONTH(fecha_actualizacion) as mes,
              COUNT(*) as cantidad
       FROM historial_actualizaciones
       WHERE fecha_actualizacion >= ?
       GROUP BY YEAR(fecha_actualizacion), MONTH(fecha_actualizacion)
       ORDER BY anio, mes`,
      [desde]
    );

    // Datasets creados por mes
    const [creados] = await pool.execute(
      `SELECT YEAR(created_at) as anio, MONTH(created_at) as mes,
              COUNT(*) as cantidad
       FROM datasets
       WHERE created_at >= ? AND activo = TRUE
       GROUP BY YEAR(created_at), MONTH(created_at)
       ORDER BY anio, mes`,
      [desde]
    );

    // Notificaciones enviadas por mes: emails del log + Notas Digitales enviadas (sin pruebas)
    const [notificaciones] = await pool.execute(
      `SELECT anio, mes, CAST(SUM(cantidad) AS UNSIGNED) AS cantidad FROM (
         SELECT YEAR(enviado_at) AS anio, MONTH(enviado_at) AS mes, COUNT(*) AS cantidad
         FROM notificaciones_log WHERE enviado_at >= ? AND success = TRUE
         GROUP BY YEAR(enviado_at), MONTH(enviado_at)
         UNION ALL
         SELECT YEAR(enviada_at), MONTH(enviada_at), COUNT(*)
         FROM notas_digitales WHERE enviada_at >= ? AND estado = 'enviada' AND es_prueba = 0
         GROUP BY YEAR(enviada_at), MONTH(enviada_at)
       ) t
       GROUP BY anio, mes
       ORDER BY anio, mes`,
      [desde, desde]
    );

    // Cambios aprobados/rechazados por mes
    const [cambios] = await pool.execute(
      `SELECT YEAR(revisado_at) as anio, MONTH(revisado_at) as mes,
              estado, COUNT(*) as cantidad
       FROM cambios_pendientes
       WHERE revisado_at >= ? AND estado IN ('aprobado', 'rechazado')
       GROUP BY YEAR(revisado_at), MONTH(revisado_at), estado
       ORDER BY anio, mes`,
      [desde]
    );

    // Tiempo promedio de aprobación (días)
    const [tiempoAprobacion] = await pool.execute(
      `SELECT AVG(DATEDIFF(revisado_at, created_at)) as promedio_dias
       FROM cambios_pendientes
       WHERE estado = 'aprobado' AND revisado_at IS NOT NULL AND revisado_at >= ?`,
      [desde]
    );

    // Operador más activo: los cambios que propuso y las filas del historial que no vienen de un cambio (las de antes de
    // la doble verificación). Un registro de actualización aprobado está en las dos tablas (historial con cambio_id) y
    // se cuenta una sola vez, por su cambio (spec 2026-10-17-fechas-datasets, 10.1)
    const [operadorActivo] = await pool.execute(
      `SELECT u.nombre_completo, COUNT(*) as acciones
       FROM (
         SELECT usuario_id FROM historial_actualizaciones WHERE created_at >= ? AND cambio_id IS NULL
         UNION ALL
         SELECT usuario_id FROM cambios_pendientes WHERE created_at >= ?
       ) t
       JOIN usuarios u ON u.id = t.usuario_id
       GROUP BY u.id, u.nombre_completo
       ORDER BY acciones DESC
       LIMIT 1`,
      [desde, desde]
    );

    // Distribución por tema
    const [porTema] = await pool.execute(
      `SELECT t.nombre as tema, COUNT(*) as cantidad
       FROM datasets d
       JOIN temas t ON t.id = d.tema_principal_id
       WHERE d.activo = TRUE
       GROUP BY t.id, t.nombre
       ORDER BY cantidad DESC`
    );

    // Distribución por frecuencia
    const [porFrecuencia] = await pool.execute(
      `SELECT f.nombre as frecuencia, COUNT(*) as cantidad
       FROM datasets d
       JOIN frecuencias f ON f.id = d.frecuencia_id
       WHERE d.activo = TRUE
       GROUP BY f.id, f.nombre
       ORDER BY cantidad DESC`
    );

    // Tasa de cumplimiento actual y ranking de áreas: el estado de cada dataset activo (Ruling 23, cumplimientoDeGestion)
    const [filasDeCumplimiento] = await pool.execute(
      `SELECT a.nombre AS area, d.tipo_gestion, f.meses AS frecuencia_meses,
              DATE_FORMAT(d.proxima_actualizacion, '%Y-%m-%d') AS proxima_iso
       FROM datasets d
       LEFT JOIN frecuencias f ON f.id = d.frecuencia_id
       LEFT JOIN areas a ON a.id = d.area_id
       WHERE d.activo = TRUE`
    );
    const { tasa: tasaCumplimiento, ranking: rankingAreas } = cumplimientoDeGestion(filasDeCumplimiento, hoyArgentina());

    res.json({
      success: true,
      data: {
        actualizados_por_mes: actualizados,
        creados_por_mes: creados,
        notificaciones_por_mes: notificaciones,
        cambios_por_mes: cambios,
        tiempo_promedio_aprobacion: tiempoAprobacion[0]?.promedio_dias || 0,
        operador_mas_activo: operadorActivo[0] || null,
        distribucion_por_tema: porTema,
        distribucion_por_frecuencia: porFrecuencia,
        tasa_cumplimiento: tasaCumplimiento,
        ranking_areas: rankingAreas
      }
    });
  } catch (error) {
    console.error('Error obteniendo métricas automáticas:', error);
    res.status(500).json({ success: false, error: 'Error al obtener métricas automáticas' });
  }
};

// =====================================================
// MÉTRICAS MANUALES
// =====================================================

export const getMetricasManuales = async (req, res) => {
  try {
    const mesesAtras = parseInt(req.query.meses) || 12;
    const [rows] = await pool.execute(
      `SELECT mm.*, u.nombre_completo as creado_por_nombre
       FROM metricas_manuales mm
       JOIN usuarios u ON u.id = mm.created_by
       WHERE (mm.anio * 12 + mm.mes) >= (YEAR(CURDATE()) * 12 + MONTH(CURDATE()) - ?)
       ORDER BY mm.anio DESC, mm.mes DESC, mm.tipo`,
      [mesesAtras]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error obteniendo métricas manuales:', error);
    res.status(500).json({ success: false, error: 'Error al obtener métricas manuales' });
  }
};

export const createMetricaManual = async (req, res) => {
  try {
    const { tipo, anio, mes, cantidad } = req.body;

    if (!tipo || !anio || !mes || cantidad === undefined) {
      return res.status(400).json({ success: false, error: 'Campos requeridos: tipo, anio, mes, cantidad' });
    }

    const tiposValidos = ['notas_enviadas', 'reuniones_capacitaciones', 'consultas_atendidas'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ success: false, error: 'Tipo de métrica no válido' });
    }

    if (mes < 1 || mes > 12) {
      return res.status(400).json({ success: false, error: 'Mes debe estar entre 1 y 12' });
    }

    if (cantidad < 0) {
      return res.status(400).json({ success: false, error: 'La cantidad no puede ser negativa' });
    }

    // Upsert: si ya existe el registro para ese tipo/año/mes, actualizar
    const [existing] = await pool.execute(
      'SELECT id FROM metricas_manuales WHERE tipo = ? AND anio = ? AND mes = ?',
      [tipo, anio, mes]
    );

    if (existing.length > 0) {
      await pool.execute(
        'UPDATE metricas_manuales SET cantidad = ?, created_by = ? WHERE id = ?',
        [cantidad, req.user.userId, existing[0].id]
      );
      const [updated] = await pool.execute('SELECT * FROM metricas_manuales WHERE id = ?', [existing[0].id]);
      return res.json({ success: true, data: updated[0], message: 'Métrica actualizada' });
    }

    const [result] = await pool.execute(
      'INSERT INTO metricas_manuales (tipo, anio, mes, cantidad, created_by) VALUES (?, ?, ?, ?, ?)',
      [tipo, anio, mes, cantidad, req.user.userId]
    );

    const [rows] = await pool.execute('SELECT * FROM metricas_manuales WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0], message: 'Métrica registrada' });
  } catch (error) {
    console.error('Error creando métrica manual:', error);
    res.status(500).json({ success: false, error: 'Error al registrar métrica' });
  }
};

export const deleteMetricaManual = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.execute('DELETE FROM metricas_manuales WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Métrica no encontrada' });
    }

    res.json({ success: true, message: 'Métrica eliminada' });
  } catch (error) {
    console.error('Error eliminando métrica manual:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar métrica' });
  }
};

// Proyectos, hitos, logros y la línea de tiempo están en controllers/proyectosController.js (spec 2026-10-25-proyectos, 9).
// Sus archivos (subidas, descargas y borrados) todavía están acá.

// =====================================================
// DOCUMENTOS DE PROYECTO
// =====================================================

// Helper: validar que la ruta resuelta esté dentro de uploads/
const validarPathSeguro = (filePath) => {
  const resolved = path.resolve(filePath);
  const uploadsResolved = path.resolve(UPLOADS_BASE);
  return resolved.startsWith(uploadsResolved);
};

export const uploadProyectoDocumentos = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar proyecto activo
    const [proyecto] = await pool.execute('SELECT id FROM proyectos WHERE id = ? AND activo = TRUE', [id]);
    if (proyecto.length === 0) {
      return res.status(404).json({ success: false, error: 'Proyecto no encontrado' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No se enviaron archivos' });
    }

    // Verificar límite de 10
    const [existing] = await pool.execute('SELECT COUNT(*) as total FROM proyecto_documentos WHERE proyecto_id = ?', [id]);
    const totalActual = existing[0].total;
    if (totalActual + req.files.length > 10) {
      return res.status(400).json({ success: false, error: `Se excede el límite de 10 documentos por proyecto (actuales: ${totalActual})` });
    }

    const insertados = [];
    for (const file of req.files) {
      const [result] = await pool.execute(
        'INSERT INTO proyecto_documentos (proyecto_id, nombre_archivo, nombre_almacenado, tamano, mime_type) VALUES (?, ?, ?, ?, ?)',
        [id, file.originalname, file.filename, file.size, file.mimetype]
      );
      insertados.push({ id: result.insertId, nombre_archivo: file.originalname, tamano: file.size, mime_type: file.mimetype });
    }

    res.status(201).json({ success: true, data: insertados, message: `${insertados.length} documento(s) subido(s)` });
  } catch (error) {
    console.error('Error subiendo documentos de proyecto:', error);
    res.status(500).json({ success: false, error: 'Error al subir documentos' });
  }
};

export const descargarProyectoDocumento = async (req, res) => {
  try {
    const { id, docId } = req.params;
    const [rows] = await pool.execute(
      'SELECT nombre_archivo, nombre_almacenado FROM proyecto_documentos WHERE id = ? AND proyecto_id = ?',
      [docId, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Documento no encontrado' });
    }

    const filePath = path.join(UPLOADS_BASE, 'proyectos', String(id), rows[0].nombre_almacenado);
    if (!validarPathSeguro(filePath)) {
      return res.status(400).json({ success: false, error: 'Ruta de archivo inválida' });
    }

    res.download(filePath, rows[0].nombre_archivo);
  } catch (error) {
    console.error('Error descargando documento:', error);
    res.status(500).json({ success: false, error: 'Error al descargar documento' });
  }
};

export const deleteProyectoDocumento = async (req, res) => {
  try {
    const { id, docId } = req.params;
    const [rows] = await pool.execute(
      'SELECT nombre_almacenado FROM proyecto_documentos WHERE id = ? AND proyecto_id = ?',
      [docId, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Documento no encontrado' });
    }

    // Eliminar archivo del disco (ignorar si no existe)
    const filePath = path.join(UPLOADS_BASE, 'proyectos', String(id), rows[0].nombre_almacenado);
    if (validarPathSeguro(filePath)) {
      await fs.unlink(filePath).catch(() => {});
    }

    await pool.execute('DELETE FROM proyecto_documentos WHERE id = ?', [docId]);
    res.json({ success: true, message: 'Documento eliminado' });
  } catch (error) {
    console.error('Error eliminando documento:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar documento' });
  }
};

// =====================================================
// ARCHIVOS DE HITOS
// =====================================================

export const uploadHitoArchivos = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar hito existe y proyecto activo (o hito sin proyecto)
    const [hito] = await pool.execute(
      `SELECT ph.id, ph.proyecto_id FROM proyecto_hitos ph
       LEFT JOIN proyectos p ON p.id = ph.proyecto_id
       WHERE ph.id = ? AND (ph.proyecto_id IS NULL OR p.activo = TRUE)`,
      [id]
    );
    if (hito.length === 0) {
      return res.status(404).json({ success: false, error: 'Hito no encontrado' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No se enviaron archivos' });
    }

    // Verificar límite de 3
    const [existing] = await pool.execute('SELECT COUNT(*) as total FROM hito_archivos WHERE hito_id = ?', [id]);
    const totalActual = existing[0].total;
    if (totalActual + req.files.length > 3) {
      return res.status(400).json({ success: false, error: `Se excede el límite de 3 archivos por hito (actuales: ${totalActual})` });
    }

    const insertados = [];
    for (const file of req.files) {
      const [result] = await pool.execute(
        'INSERT INTO hito_archivos (hito_id, nombre_archivo, nombre_almacenado, tamano, mime_type) VALUES (?, ?, ?, ?, ?)',
        [id, file.originalname, file.filename, file.size, file.mimetype]
      );
      insertados.push({ id: result.insertId, nombre_archivo: file.originalname, tamano: file.size, mime_type: file.mimetype });
    }

    res.status(201).json({ success: true, data: insertados, message: `${insertados.length} archivo(s) subido(s)` });
  } catch (error) {
    console.error('Error subiendo archivos de hito:', error);
    res.status(500).json({ success: false, error: 'Error al subir archivos' });
  }
};

export const descargarHitoArchivo = async (req, res) => {
  try {
    const { id, archivoId } = req.params;
    const [rows] = await pool.execute(
      'SELECT nombre_archivo, nombre_almacenado FROM hito_archivos WHERE id = ? AND hito_id = ?',
      [archivoId, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Archivo no encontrado' });
    }

    const filePath = path.join(UPLOADS_BASE, 'hitos', String(id), rows[0].nombre_almacenado);
    if (!validarPathSeguro(filePath)) {
      return res.status(400).json({ success: false, error: 'Ruta de archivo inválida' });
    }

    res.download(filePath, rows[0].nombre_archivo);
  } catch (error) {
    console.error('Error descargando archivo de hito:', error);
    res.status(500).json({ success: false, error: 'Error al descargar archivo' });
  }
};

export const deleteHitoArchivo = async (req, res) => {
  try {
    const { id, archivoId } = req.params;
    const [rows] = await pool.execute(
      'SELECT nombre_almacenado FROM hito_archivos WHERE id = ? AND hito_id = ?',
      [archivoId, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Archivo no encontrado' });
    }

    const filePath = path.join(UPLOADS_BASE, 'hitos', String(id), rows[0].nombre_almacenado);
    if (validarPathSeguro(filePath)) {
      await fs.unlink(filePath).catch(() => {});
    }

    await pool.execute('DELETE FROM hito_archivos WHERE id = ?', [archivoId]);
    res.json({ success: true, message: 'Archivo eliminado' });
  } catch (error) {
    console.error('Error eliminando archivo de hito:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar archivo' });
  }
};

// =====================================================
// EXPORTACIÓN CSV
// =====================================================

export const exportarMetricasCSV = async (req, res) => {
  try {
    const mesesAtras = parseInt(req.query.meses) || 12;
    const fechaDesde = new Date();
    fechaDesde.setMonth(fechaDesde.getMonth() - mesesAtras);
    const desde = fechaDesde.toISOString().split('T')[0];

    // Actualizaciones por mes
    const [actualizados] = await pool.execute(
      `SELECT YEAR(fecha_actualizacion) as anio, MONTH(fecha_actualizacion) as mes,
              COUNT(*) as cantidad, 'datasets_actualizados' as tipo
       FROM historial_actualizaciones
       WHERE fecha_actualizacion >= ?
       GROUP BY YEAR(fecha_actualizacion), MONTH(fecha_actualizacion)`,
      [desde]
    );

    // Creados por mes
    const [creados] = await pool.execute(
      `SELECT YEAR(created_at) as anio, MONTH(created_at) as mes,
              COUNT(*) as cantidad, 'datasets_creados' as tipo
       FROM datasets
       WHERE created_at >= ? AND activo = TRUE
       GROUP BY YEAR(created_at), MONTH(created_at)`,
      [desde]
    );

    // Notificaciones por mes: emails del log + Notas Digitales enviadas (sin pruebas)
    const [notificaciones] = await pool.execute(
      `SELECT anio, mes, CAST(SUM(cantidad) AS UNSIGNED) AS cantidad, 'notificaciones_enviadas' AS tipo FROM (
         SELECT YEAR(enviado_at) AS anio, MONTH(enviado_at) AS mes, COUNT(*) AS cantidad
         FROM notificaciones_log WHERE enviado_at >= ? AND success = TRUE
         GROUP BY YEAR(enviado_at), MONTH(enviado_at)
         UNION ALL
         SELECT YEAR(enviada_at), MONTH(enviada_at), COUNT(*)
         FROM notas_digitales WHERE enviada_at >= ? AND estado = 'enviada' AND es_prueba = 0
         GROUP BY YEAR(enviada_at), MONTH(enviada_at)
       ) t
       GROUP BY anio, mes`,
      [desde, desde]
    );

    // Métricas manuales
    const [manuales] = await pool.execute(
      `SELECT anio, mes, cantidad, tipo
       FROM metricas_manuales
       WHERE (anio * 12 + mes) >= (YEAR(CURDATE()) * 12 + MONTH(CURDATE()) - ?)`,
      [mesesAtras]
    );

    const allData = [...actualizados, ...creados, ...notificaciones, ...manuales];
    allData.sort((a, b) => (a.anio * 12 + a.mes) - (b.anio * 12 + b.mes));

    // Generar CSV
    let csv = 'Tipo,Año,Mes,Cantidad\n';
    for (const row of allData) {
      csv += `${row.tipo},${row.anio},${row.mes},${row.cantidad}\n`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="metricas-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\uFEFF' + csv); // BOM for Excel
  } catch (error) {
    console.error('Error exportando CSV:', error);
    res.status(500).json({ success: false, error: 'Error al exportar CSV' });
  }
};
