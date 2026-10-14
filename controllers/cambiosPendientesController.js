/**
 * Controlador para el sistema de aprobación de cambios en dos pasos
 * Versión 1.5.0
 */

import pool from '../config/database.js';

/**
 * Funcion auxiliar: Cargar catalogos para enriquecer datos
 */
const cargarCatalogos = async () => {
  const [areas] = await pool.execute('SELECT id, nombre FROM areas');
  const [frecuencias] = await pool.execute('SELECT id, nombre FROM frecuencias');
  const [temas] = await pool.execute('SELECT id, nombre FROM temas');
  const [formatos] = await pool.execute('SELECT id, nombre FROM formatos');
  
  return {
    areas: Object.fromEntries(areas.map(a => [a.id, a.nombre])),
    frecuencias: Object.fromEntries(frecuencias.map(f => [f.id, f.nombre])),
    temas: Object.fromEntries(temas.map(t => [t.id, t.nombre])),
    formatos: Object.fromEntries(formatos.map(f => [f.id, f.nombre]))
  };
};

/**
 * Funcion auxiliar: Enriquecer datos con nombres de catalogos
 */
const enriquecerDatos = (datos, catalogos) => {
  if (!datos) return null;
  
  const enriquecido = { ...datos };
  
  // Reemplazar IDs por nombres
  if (datos.area_id && catalogos.areas[datos.area_id]) {
    enriquecido.area_nombre = catalogos.areas[datos.area_id];
  }
  if (datos.frecuencia_id && catalogos.frecuencias[datos.frecuencia_id]) {
    enriquecido.frecuencia_nombre = catalogos.frecuencias[datos.frecuencia_id];
  }
  if (datos.tema_principal_id && catalogos.temas[datos.tema_principal_id]) {
    enriquecido.tema_principal_nombre = catalogos.temas[datos.tema_principal_id];
  }
  if (datos.tema_secundario_id && catalogos.temas[datos.tema_secundario_id]) {
    enriquecido.tema_secundario_nombre = catalogos.temas[datos.tema_secundario_id];
  }
  
  // Convertir array de formato IDs a nombres
  if (datos.formatos && Array.isArray(datos.formatos)) {
    enriquecido.formatos_nombres = datos.formatos
      .map(id => catalogos.formatos[id])
      .filter(Boolean)
      .join(', ');
  }
  
  return enriquecido;
};

/**
 * Funcion auxiliar: Calcular campos que cambiaron
 */
const calcularCambios = (antes, despues) => {
  if (!antes || !despues) return null;
  
  const camposComparar = [
    { key: 'titulo', label: 'Titulo' },
    { key: 'descripcion', label: 'Descripcion' },
    { key: 'area_nombre', label: 'Area Responsable', keyAntes: 'area_id', keyDespues: 'area_id' },
    { key: 'frecuencia_nombre', label: 'Frecuencia', keyAntes: 'frecuencia_id', keyDespues: 'frecuencia_id' },
    { key: 'tema_principal_nombre', label: 'Tema Principal', keyAntes: 'tema_principal_id', keyDespues: 'tema_principal_id' },
    { key: 'tema_secundario_nombre', label: 'Tema Secundario', keyAntes: 'tema_secundario_id', keyDespues: 'tema_secundario_id' },
    { key: 'tipo_gestion', label: 'Tipo de Gestion' },
    { key: 'ultima_actualizacion', label: 'Ultima Actualizacion' },
    { key: 'proxima_actualizacion', label: 'Proxima Actualizacion' },
    { key: 'url_dataset', label: 'URL en Portal' },
    { key: 'observaciones', label: 'Observaciones' },
    { key: 'que_se_solicita', label: 'Qué se solicita' },
    { key: 'formatos_nombres', label: 'Formatos', keyAntes: 'formatos', keyDespues: 'formatos' }
  ];
  
  const cambios = [];
  
  camposComparar.forEach(campo => {
    const keyA = campo.keyAntes || campo.key;
    const keyD = campo.keyDespues || campo.key;
    
    let valorAntes = antes[keyA];
    let valorDespues = despues[keyD];
    
    // Usar nombres enriquecidos si existen
    if (campo.key.includes('_nombre') || campo.key === 'formatos_nombres') {
      valorAntes = antes[campo.key] || valorAntes;
      valorDespues = despues[campo.key] || valorDespues;
    }
    
    // Normalizar para comparacion
    const antesStr = valorAntes === null || valorAntes === undefined ? '' : String(valorAntes);
    const despuesStr = valorDespues === null || valorDespues === undefined ? '' : String(valorDespues);
    
    // Comparar arrays de formatos
    if (keyA === 'formatos' && Array.isArray(antes[keyA]) && Array.isArray(despues[keyD])) {
      const antesSet = new Set(antes[keyA]);
      const despuesSet = new Set(despues[keyD]);
      const sonIguales = antesSet.size === despuesSet.size && [...antesSet].every(v => despuesSet.has(v));
      if (!sonIguales) {
        cambios.push({
          campo: campo.label,
          antes: antes.formatos_nombres || antes[keyA]?.join(', ') || '-',
          despues: despues.formatos_nombres || despues[keyD]?.join(', ') || '-'
        });
      }
      return;
    }
    
    if (antesStr !== despuesStr) {
      cambios.push({
        campo: campo.label,
        antes: antesStr || '-',
        despues: despuesStr || '-'
      });
    }
  });
  
  return cambios;
};

/**
 * Obtener cantidad de cambios pendientes para revisar (para el badge)
 * Excluye los cambios propios del usuario (no puede aprobar sus propios cambios)
 */
export const getContadorPendientes = async (req, res) => {
  try {
    const userId = req.user?.userId;

    const [rows] = await pool.execute(
      `SELECT COUNT(*) as cantidad 
       FROM cambios_pendientes 
       WHERE estado = 'pendiente' AND usuario_id != ?`,
      [userId]
    );

    res.json({
      success: true,
      data: { cantidad: rows[0].cantidad }
    });
  } catch (error) {
    console.error('Error obteniendo contador de pendientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener contador de pendientes'
    });
  }
};

/**
 * Obtener cambios pendientes para revisar (de otros usuarios)
 */
export const getCambiosPendientesParaRevisar = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { tipo, usuario, estado = 'pendiente' } = req.query;

    let query = `
      SELECT cp.*, 
             u.nombre_completo as usuario_nombre,
             u.username as usuario_username,
             d.titulo as dataset_titulo,
             r.nombre_completo as revisor_nombre
      FROM cambios_pendientes cp
      JOIN usuarios u ON cp.usuario_id = u.id
      LEFT JOIN datasets d ON cp.dataset_id = d.id
      LEFT JOIN usuarios r ON cp.revisor_id = r.id
      WHERE cp.usuario_id != ?
    `;
    const params = [userId];

    if (estado && estado !== 'todos') {
      query += ' AND cp.estado = ?';
      params.push(estado);
    }

    if (tipo) {
      query += ' AND cp.tipo_cambio = ?';
      params.push(tipo);
    }

    if (usuario) {
      query += ' AND cp.usuario_id = ?';
      params.push(usuario);
    }

    query += ' ORDER BY cp.created_at DESC';

    const [rows] = await pool.execute(query, params);

    // Parsear JSON de datos
    const cambios = rows.map(row => ({
      ...row,
      datos_nuevos: typeof row.datos_nuevos === 'string' ? JSON.parse(row.datos_nuevos) : row.datos_nuevos,
      datos_anteriores: row.datos_anteriores ? (typeof row.datos_anteriores === 'string' ? JSON.parse(row.datos_anteriores) : row.datos_anteriores) : null
    }));

    res.json({
      success: true,
      data: cambios
    });
  } catch (error) {
    console.error('Error obteniendo cambios para revisar:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener cambios pendientes'
    });
  }
};

/**
 * Obtener mis cambios propuestos (del usuario actual)
 */
export const getMisCambios = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { estado } = req.query;

    let query = `
      SELECT cp.*, 
             d.titulo as dataset_titulo,
             r.nombre_completo as revisor_nombre
      FROM cambios_pendientes cp
      LEFT JOIN datasets d ON cp.dataset_id = d.id
      LEFT JOIN usuarios r ON cp.revisor_id = r.id
      WHERE cp.usuario_id = ?
    `;
    const params = [userId];

    if (estado && estado !== 'todos') {
      query += ' AND cp.estado = ?';
      params.push(estado);
    }

    query += ' ORDER BY cp.created_at DESC';

    const [rows] = await pool.execute(query, params);

    // Parsear JSON de datos
    const cambios = rows.map(row => ({
      ...row,
      datos_nuevos: typeof row.datos_nuevos === 'string' ? JSON.parse(row.datos_nuevos) : row.datos_nuevos,
      datos_anteriores: row.datos_anteriores ? (typeof row.datos_anteriores === 'string' ? JSON.parse(row.datos_anteriores) : row.datos_anteriores) : null
    }));

    res.json({
      success: true,
      data: cambios
    });
  } catch (error) {
    console.error('Error obteniendo mis cambios:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener mis cambios'
    });
  }
};

/**
 * Obtener un cambio pendiente por ID con todos los detalles
 */
export const getCambioPendienteById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute(
      `SELECT cp.*, 
              u.nombre_completo as usuario_nombre,
              u.username as usuario_username,
              d.titulo as dataset_titulo,
              d.url_dataset as dataset_url,
              r.nombre_completo as revisor_nombre
       FROM cambios_pendientes cp
       JOIN usuarios u ON cp.usuario_id = u.id
       LEFT JOIN datasets d ON cp.dataset_id = d.id
       LEFT JOIN usuarios r ON cp.revisor_id = r.id
       WHERE cp.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cambio pendiente no encontrado'
      });
    }

    // Parsear JSON
    const datosNuevos = typeof rows[0].datos_nuevos === 'string' 
      ? JSON.parse(rows[0].datos_nuevos) 
      : rows[0].datos_nuevos;
    const datosAnteriores = rows[0].datos_anteriores 
      ? (typeof rows[0].datos_anteriores === 'string' ? JSON.parse(rows[0].datos_anteriores) : rows[0].datos_anteriores) 
      : null;

    // Cargar catalogos y enriquecer datos
    const catalogos = await cargarCatalogos();
    const datosNuevosEnriquecidos = enriquecerDatos(datosNuevos, catalogos);
    const datosAnterioresEnriquecidos = enriquecerDatos(datosAnteriores, catalogos);

    // Calcular solo los campos que cambiaron (para edicion)
    let camposModificados = null;
    if (rows[0].tipo_cambio === 'editar' && datosAnterioresEnriquecidos && datosNuevosEnriquecidos) {
      camposModificados = calcularCambios(datosAnterioresEnriquecidos, datosNuevosEnriquecidos);
    }

    const cambio = {
      ...rows[0],
      datos_nuevos: datosNuevosEnriquecidos,
      datos_anteriores: datosAnterioresEnriquecidos,
      campos_modificados: camposModificados
    };

    res.json({
      success: true,
      data: cambio
    });
  } catch (error) {
    console.error('Error obteniendo cambio pendiente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener el cambio pendiente'
    });
  }
};

/**
 * Verificar si un dataset tiene cambios pendientes
 */
export const verificarDatasetBloqueado = async (req, res) => {
  try {
    const { datasetId } = req.params;

    const [rows] = await pool.execute(
      `SELECT cp.id, cp.tipo_cambio, cp.created_at, u.nombre_completo as usuario_nombre
       FROM cambios_pendientes cp
       JOIN usuarios u ON cp.usuario_id = u.id
       WHERE cp.dataset_id = ? AND cp.estado = 'pendiente'`,
      [datasetId]
    );

    res.json({
      success: true,
      data: {
        bloqueado: rows.length > 0,
        cambio_pendiente: rows.length > 0 ? rows[0] : null
      }
    });
  } catch (error) {
    console.error('Error verificando bloqueo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar estado del dataset'
    });
  }
};

/**
 * Aprobar un cambio pendiente
 */
export const aprobarCambio = async (req, res) => {
  let connection;

  try {
    const { id } = req.params;
    const revisorId = req.user?.userId;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Bloquear el cambio hasta el commit: un doble click o un rechazo simultáneo
    // esperan acá y después lo encuentran ya procesado
    const [cambios] = await connection.execute(
      'SELECT * FROM cambios_pendientes WHERE id = ? FOR UPDATE',
      [id]
    );

    if (cambios.length === 0 || cambios[0].estado !== 'pendiente') {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: 'Cambio pendiente no encontrado o ya fue procesado'
      });
    }

    const cambio = cambios[0];

    // Verificar que no sea su propio cambio
    if (cambio.usuario_id === revisorId) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        error: 'No puede aprobar sus propios cambios'
      });
    }

    const datosNuevos = typeof cambio.datos_nuevos === 'string'
      ? JSON.parse(cambio.datos_nuevos)
      : cambio.datos_nuevos;

    let datasetId = cambio.dataset_id;

    // Aplicar el cambio según el tipo
    if (cambio.tipo_cambio === 'crear') {
      // Insertar nuevo dataset
      const [result] = await connection.execute(
        `INSERT INTO datasets (
          titulo, descripcion, area_id, frecuencia_id, 
          ultima_actualizacion, proxima_actualizacion, 
          tema_principal_id, tema_secundario_id, 
          url_dataset, observaciones, que_se_solicita, tipo_gestion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          datosNuevos.titulo,
          datosNuevos.descripcion || null,
          datosNuevos.area_id,
          datosNuevos.frecuencia_id,
          datosNuevos.ultima_actualizacion || null,
          datosNuevos.proxima_actualizacion || null,
          datosNuevos.tema_principal_id,
          datosNuevos.tema_secundario_id || null,
          datosNuevos.url_dataset || null,
          datosNuevos.observaciones || null,
          datosNuevos.que_se_solicita || null,
          datosNuevos.tipo_gestion
        ]
      );

      datasetId = result.insertId;

      // Insertar formatos
      if (datosNuevos.formatos && Array.isArray(datosNuevos.formatos)) {
        for (const formatoId of datosNuevos.formatos) {
          await connection.execute(
            'INSERT INTO dataset_formatos (dataset_id, formato_id) VALUES (?, ?)',
            [datasetId, formatoId]
          );
        }
      }

    } else if (cambio.tipo_cambio === 'editar') {
      // Actualizar dataset existente
      const updates = [];
      const values = [];

      const campos = [
        'titulo', 'descripcion', 'area_id', 'frecuencia_id',
        'ultima_actualizacion', 'proxima_actualizacion',
        'tema_principal_id', 'tema_secundario_id',
        'url_dataset', 'observaciones', 'que_se_solicita', 'tipo_gestion'
      ];

      campos.forEach(campo => {
        if (datosNuevos[campo] !== undefined) {
          updates.push(`${campo} = ?`);
          values.push(datosNuevos[campo]);
        }
      });

      if (updates.length > 0) {
        values.push(cambio.dataset_id);
        await connection.execute(
          `UPDATE datasets SET ${updates.join(', ')} WHERE id = ?`,
          values
        );
      }

      // Actualizar formatos si se proporcionaron
      if (datosNuevos.formatos && Array.isArray(datosNuevos.formatos)) {
        await connection.execute(
          'DELETE FROM dataset_formatos WHERE dataset_id = ?',
          [cambio.dataset_id]
        );

        for (const formatoId of datosNuevos.formatos) {
          await connection.execute(
            'INSERT INTO dataset_formatos (dataset_id, formato_id) VALUES (?, ?)',
            [cambio.dataset_id, formatoId]
          );
        }
      }

    } else if (cambio.tipo_cambio === 'eliminar') {
      // Soft delete del dataset
      await connection.execute(
        'UPDATE datasets SET activo = FALSE WHERE id = ?',
        [cambio.dataset_id]
      );
    }

    // Marcar cambio como aprobado
    await connection.execute(
      `UPDATE cambios_pendientes 
       SET estado = 'aprobado', revisor_id = ?, revisado_at = NOW() 
       WHERE id = ?`,
      [revisorId, id]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Cambio aprobado correctamente',
      data: { dataset_id: datasetId }
    });

  } catch (error) {
    await connection?.rollback().catch(() => {});
    console.error('Error aprobando cambio:', error);
    res.status(500).json({
      success: false,
      error: 'Error al aprobar el cambio'
    });
  } finally {
    connection?.release();
  }
};

/**
 * Rechazar un cambio pendiente
 */
export const rechazarCambio = async (req, res) => {
  let connection;

  try {
    const { id } = req.params;
    const { comentario } = req.body;
    const revisorId = req.user?.userId;

    if (!comentario || comentario.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar un motivo de rechazo'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Mismo bloqueo que aprobarCambio: no se puede rechazar algo que se está aprobando
    const [cambios] = await connection.execute(
      'SELECT * FROM cambios_pendientes WHERE id = ? FOR UPDATE',
      [id]
    );

    if (cambios.length === 0 || cambios[0].estado !== 'pendiente') {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: 'Cambio pendiente no encontrado o ya fue procesado'
      });
    }

    const cambio = cambios[0];

    // Verificar que no sea su propio cambio
    if (cambio.usuario_id === revisorId) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        error: 'No puede rechazar sus propios cambios'
      });
    }

    // Marcar como rechazado
    await connection.execute(
      `UPDATE cambios_pendientes
       SET estado = 'rechazado', revisor_id = ?, comentario_rechazo = ?, revisado_at = NOW()
       WHERE id = ?`,
      [revisorId, comentario.trim(), id]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Cambio rechazado correctamente'
    });

  } catch (error) {
    await connection?.rollback().catch(() => {});
    console.error('Error rechazando cambio:', error);
    res.status(500).json({
      success: false,
      error: 'Error al rechazar el cambio'
    });
  } finally {
    connection?.release();
  }
};

/**
 * Función auxiliar: Verificar si un dataset está bloqueado (para usar desde otros controladores)
 * Retorna true si tiene cambios pendientes
 */
export const datasetTieneCambiosPendientes = async (datasetId) => {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) as count FROM cambios_pendientes WHERE dataset_id = ? AND estado = ?',
    [datasetId, 'pendiente']
  );
  return rows[0].count > 0;
};

/**
 * Función auxiliar: Crear un cambio pendiente (para usar desde datasetController)
 * Devuelve el id del cambio, o null si el dataset ya tiene un cambio pendiente.
 * La fila del dataset queda bloqueada mientras se verifica, así dos propuestas
 * simultáneas no pueden pasar las dos el control de bloqueo.
 */
export const crearCambioPendiente = async (tipoCambio, datasetId, datosNuevos, datosAnteriores, usuarioId) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (datasetId) {
      await connection.execute('SELECT id FROM datasets WHERE id = ? FOR UPDATE', [datasetId]);
      const [pendientes] = await connection.execute(
        'SELECT COUNT(*) as count FROM cambios_pendientes WHERE dataset_id = ? AND estado = ?',
        [datasetId, 'pendiente']
      );
      if (pendientes[0].count > 0) {
        await connection.rollback();
        return null;
      }
    }

    const [result] = await connection.execute(
      `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, datos_anteriores, usuario_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        tipoCambio,
        datasetId,
        JSON.stringify(datosNuevos),
        datosAnteriores ? JSON.stringify(datosAnteriores) : null,
        usuarioId
      ]
    );

    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Obtener datasets con cambios pendientes (para mostrar indicador en admin)
 */
export const getDatasetsConPendientes = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT dataset_id 
       FROM cambios_pendientes 
       WHERE estado = 'pendiente' AND dataset_id IS NOT NULL`
    );

    const datasetIds = rows.map(r => r.dataset_id);

    res.json({
      success: true,
      data: datasetIds
    });
  } catch (error) {
    console.error('Error obteniendo datasets con pendientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener datasets con cambios pendientes'
    });
  }
};