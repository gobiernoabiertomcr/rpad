import pool from '../config/database.js';
import path from 'path';
import fs from 'fs/promises';
import { UPLOADS_BASE } from '../config/upload.js';

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

    // Notificaciones enviadas por mes
    const [notificaciones] = await pool.execute(
      `SELECT YEAR(enviado_at) as anio, MONTH(enviado_at) as mes,
              COUNT(*) as cantidad
       FROM notificaciones_log
       WHERE enviado_at >= ? AND success = TRUE
       GROUP BY YEAR(enviado_at), MONTH(enviado_at)
       ORDER BY anio, mes`,
      [desde]
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

    // Operador más activo
    const [operadorActivo] = await pool.execute(
      `SELECT u.nombre_completo, COUNT(*) as acciones
       FROM (
         SELECT usuario_id FROM historial_actualizaciones WHERE created_at >= ?
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

    // Tasa de cumplimiento actual
    const [cumplimiento] = await pool.execute(
      `SELECT
         COUNT(*) as total,
         SUM(CASE
           WHEN proxima_actualizacion IS NULL THEN 1
           WHEN proxima_actualizacion >= CURDATE() THEN 1
           ELSE 0
         END) as al_dia
       FROM datasets
       WHERE activo = TRUE`
    );

    // Ranking de áreas por cumplimiento
    const [rankingAreas] = await pool.execute(
      `SELECT a.nombre as area,
              COUNT(*) as total_datasets,
              SUM(CASE
                WHEN d.proxima_actualizacion IS NULL THEN 1
                WHEN d.proxima_actualizacion >= CURDATE() THEN 1
                ELSE 0
              END) as al_dia,
              ROUND(
                SUM(CASE
                  WHEN d.proxima_actualizacion IS NULL THEN 1
                  WHEN d.proxima_actualizacion >= CURDATE() THEN 1
                  ELSE 0
                END) * 100.0 / COUNT(*), 1
              ) as porcentaje
       FROM datasets d
       JOIN areas a ON a.id = d.area_id
       WHERE d.activo = TRUE
       GROUP BY a.id, a.nombre
       HAVING total_datasets > 0
       ORDER BY porcentaje DESC`
    );

    const totalDatasets = cumplimiento[0]?.total || 0;
    const alDia = cumplimiento[0]?.al_dia || 0;
    const tasaCumplimiento = totalDatasets > 0 ? Math.round((alDia / totalDatasets) * 100) : 0;

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

// =====================================================
// PROYECTOS
// =====================================================

export const getProyectos = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT p.*, u.nombre_completo as creado_por_nombre,
              (SELECT COUNT(*) FROM proyecto_hitos ph WHERE ph.proyecto_id = p.id) as cantidad_hitos
       FROM proyectos p
       JOIN usuarios u ON u.id = p.created_by
       WHERE p.activo = TRUE
       ORDER BY p.categoria, p.orden, p.nombre`
    );

    // Cargar áreas de cada proyecto
    for (const proyecto of rows) {
      const [areas] = await pool.execute(
        `SELECT a.id, a.nombre
         FROM proyecto_areas pa
         JOIN areas a ON a.id = pa.area_id
         WHERE pa.proyecto_id = ?`,
        [proyecto.id]
      );
      proyecto.areas = areas;
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error obteniendo proyectos:', error);
    res.status(500).json({ success: false, error: 'Error al obtener proyectos' });
  }
};

export const getProyectoById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      `SELECT p.*, u.nombre_completo as creado_por_nombre
       FROM proyectos p
       JOIN usuarios u ON u.id = p.created_by
       WHERE p.id = ? AND p.activo = TRUE`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Proyecto no encontrado' });
    }

    const proyecto = rows[0];

    // Cargar áreas
    const [areas] = await pool.execute(
      `SELECT a.id, a.nombre FROM proyecto_areas pa JOIN areas a ON a.id = pa.area_id WHERE pa.proyecto_id = ?`,
      [id]
    );
    proyecto.areas = areas;

    // Cargar hitos
    const [hitos] = await pool.execute(
      'SELECT * FROM proyecto_hitos WHERE proyecto_id = ? ORDER BY fecha DESC',
      [id]
    );
    // Cargar archivos de cada hito
    for (const hito of hitos) {
      const [archivos] = await pool.execute(
        'SELECT id, nombre_archivo, tamano, mime_type, created_at FROM hito_archivos WHERE hito_id = ? ORDER BY created_at DESC',
        [hito.id]
      );
      hito.archivos = archivos;
    }
    proyecto.hitos = hitos;

    // Cargar documentos
    const [documentos] = await pool.execute(
      'SELECT id, nombre_archivo, tamano, mime_type, created_at FROM proyecto_documentos WHERE proyecto_id = ? ORDER BY created_at DESC',
      [id]
    );
    proyecto.documentos = documentos;

    res.json({ success: true, data: proyecto });
  } catch (error) {
    console.error('Error obteniendo proyecto:', error);
    res.status(500).json({ success: false, error: 'Error al obtener proyecto' });
  }
};

export const createProyecto = async (req, res) => {
  try {
    const { nombre, descripcion, estado, fecha_inicio, icono, color, responsable,
            enlace_externo, prioridad, categoria, orden, areas } = req.body;

    if (!nombre) {
      return res.status(400).json({ success: false, error: 'El nombre del proyecto es requerido' });
    }

    const [result] = await pool.execute(
      `INSERT INTO proyectos (nombre, descripcion, estado, fecha_inicio, icono, color,
       responsable, enlace_externo, prioridad, categoria, orden, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, descripcion || null, estado || 'idea', fecha_inicio || null,
       icono || null, color || '#3b82f6', responsable || null, enlace_externo || null,
       prioridad || 'media', categoria || 'tecnologia', orden || 0, req.user.userId]
    );

    // Asociar áreas
    if (areas && Array.isArray(areas) && areas.length > 0) {
      for (const areaId of areas) {
        await pool.execute(
          'INSERT INTO proyecto_areas (proyecto_id, area_id) VALUES (?, ?)',
          [result.insertId, areaId]
        );
      }
    }

    const [rows] = await pool.execute('SELECT * FROM proyectos WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0], message: 'Proyecto creado' });
  } catch (error) {
    console.error('Error creando proyecto:', error);
    res.status(500).json({ success: false, error: 'Error al crear proyecto' });
  }
};

export const updateProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const [existing] = await pool.execute('SELECT id FROM proyectos WHERE id = ? AND activo = TRUE', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Proyecto no encontrado' });
    }

    const fields = ['nombre', 'descripcion', 'estado', 'fecha_inicio', 'icono', 'color',
                     'responsable', 'enlace_externo', 'prioridad', 'categoria', 'orden'];
    const updates = [];
    const values = [];

    fields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field] === '' ? null : data[field]);
      }
    });

    if (updates.length === 0 && !data.areas) {
      return res.status(400).json({ success: false, error: 'No se proporcionaron datos para actualizar' });
    }

    if (updates.length > 0) {
      values.push(Number(id));
      await pool.execute(`UPDATE proyectos SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    // Actualizar áreas si se proporcionaron
    if (data.areas !== undefined && Array.isArray(data.areas)) {
      await pool.execute('DELETE FROM proyecto_areas WHERE proyecto_id = ?', [id]);
      for (const areaId of data.areas) {
        await pool.execute(
          'INSERT INTO proyecto_areas (proyecto_id, area_id) VALUES (?, ?)',
          [id, areaId]
        );
      }
    }

    const [rows] = await pool.execute('SELECT * FROM proyectos WHERE id = ?', [id]);
    res.json({ success: true, data: rows[0], message: 'Proyecto actualizado' });
  } catch (error) {
    console.error('Error actualizando proyecto:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar proyecto' });
  }
};

export const deleteProyecto = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      'UPDATE proyectos SET activo = FALSE WHERE id = ? AND activo = TRUE',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Proyecto no encontrado' });
    }

    res.json({ success: true, message: 'Proyecto eliminado' });
  } catch (error) {
    console.error('Error eliminando proyecto:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar proyecto' });
  }
};

// =====================================================
// HITOS
// =====================================================

export const createHito = async (req, res) => {
  try {
    const { proyecto_id } = req.params;
    const { titulo, fecha, descripcion, evidencia_tipo, evidencia_url } = req.body;

    if (!titulo || !fecha) {
      return res.status(400).json({ success: false, error: 'Título y fecha son requeridos' });
    }

    // Verificar que el proyecto existe
    const [proyecto] = await pool.execute('SELECT id FROM proyectos WHERE id = ? AND activo = TRUE', [proyecto_id]);
    if (proyecto.length === 0) {
      return res.status(404).json({ success: false, error: 'Proyecto no encontrado' });
    }

    const [result] = await pool.execute(
      `INSERT INTO proyecto_hitos (proyecto_id, titulo, fecha, descripcion, evidencia_tipo, evidencia_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [proyecto_id, titulo, fecha, descripcion || null,
       evidencia_tipo || 'ninguno', evidencia_url || null]
    );

    const [rows] = await pool.execute('SELECT * FROM proyecto_hitos WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0], message: 'Hito creado' });
  } catch (error) {
    console.error('Error creando hito:', error);
    res.status(500).json({ success: false, error: 'Error al crear hito' });
  }
};

export const updateHito = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, fecha, descripcion, evidencia_tipo, evidencia_url } = req.body;

    const [existing] = await pool.execute('SELECT id FROM proyecto_hitos WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Hito no encontrado' });
    }

    const updates = [];
    const values = [];

    if (titulo !== undefined) { updates.push('titulo = ?'); values.push(titulo); }
    if (fecha !== undefined) { updates.push('fecha = ?'); values.push(fecha); }
    if (descripcion !== undefined) { updates.push('descripcion = ?'); values.push(descripcion || null); }
    if (evidencia_tipo !== undefined) { updates.push('evidencia_tipo = ?'); values.push(evidencia_tipo); }
    if (evidencia_url !== undefined) { updates.push('evidencia_url = ?'); values.push(evidencia_url || null); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No se proporcionaron datos para actualizar' });
    }

    values.push(Number(id));
    await pool.execute(`UPDATE proyecto_hitos SET ${updates.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.execute('SELECT * FROM proyecto_hitos WHERE id = ?', [id]);
    res.json({ success: true, data: rows[0], message: 'Hito actualizado' });
  } catch (error) {
    console.error('Error actualizando hito:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar hito' });
  }
};

export const deleteHito = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.execute('DELETE FROM proyecto_hitos WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Hito no encontrado' });
    }

    res.json({ success: true, message: 'Hito eliminado' });
  } catch (error) {
    console.error('Error eliminando hito:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar hito' });
  }
};

// =====================================================
// TIMELINE (todos los hitos)
// =====================================================

export const getTimeline = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ph.*, p.nombre as proyecto_nombre, p.color as proyecto_color, p.categoria
       FROM proyecto_hitos ph
       JOIN proyectos p ON p.id = ph.proyecto_id
       WHERE p.activo = TRUE
       ORDER BY ph.fecha DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error obteniendo timeline:', error);
    res.status(500).json({ success: false, error: 'Error al obtener timeline' });
  }
};

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

    // Verificar hito existe y proyecto activo
    const [hito] = await pool.execute(
      `SELECT ph.id, ph.proyecto_id FROM proyecto_hitos ph
       JOIN proyectos p ON p.id = ph.proyecto_id
       WHERE ph.id = ? AND p.activo = TRUE`,
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

    // Notificaciones por mes
    const [notificaciones] = await pool.execute(
      `SELECT YEAR(enviado_at) as anio, MONTH(enviado_at) as mes,
              COUNT(*) as cantidad, 'notificaciones_enviadas' as tipo
       FROM notificaciones_log
       WHERE enviado_at >= ? AND success = TRUE
       GROUP BY YEAR(enviado_at), MONTH(enviado_at)`,
      [desde]
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
