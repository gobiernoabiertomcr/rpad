import pool from '../config/database.js';
import { crearCambioPendiente, datasetTieneCambiosPendientes } from './cambiosPendientesController.js';

// Respuesta cuando el dataset ya tiene un cambio pendiente de aprobación
const responderBloqueado = (res, accion) => res.status(409).json({
  success: false,
  error: `Este dataset tiene cambios pendientes de aprobación. No se puede ${accion} hasta que sean revisados.`
});

/**
 * Funcion auxiliar: Normalizar valor para comparacion
 * Maneja fechas, nulls y strings de forma consistente
 */
const normalizarValor = (valor) => {
  if (valor === null || valor === undefined || valor === '') {
    return '';
  }
  
  // Si es un objeto Date, convertir a YYYY-MM-DD
  if (valor instanceof Date) {
    return valor.toISOString().split('T')[0];
  }
  
  // Si es string que parece fecha ISO (viene de la BD), extraer solo la parte de fecha
  if (typeof valor === 'string' && valor.match(/^\d{4}-\d{2}-\d{2}(T|$)/)) {
    return valor.split('T')[0];
  }
  
  return String(valor);
};

// Texto opcional: sin espacios en los extremos; vacío o en blanco queda en NULL
const normalizarTextoOpcional = (valor) => {
  if (valor === null || valor === undefined) return null;
  return valor.trim() || null;
};

// El texto opcional puede faltar, venir null o ser un string (cualquier otro tipo es un error del cliente)
const esTextoOpcionalValido = (valor) => valor === undefined || valor === null || typeof valor === 'string';

/**
 * Funcion auxiliar: Comparar dos objetos para detectar si hay cambios reales
 * Retorna true si hay al menos un cambio
 */
const hayCambiosReales = (antes, despues) => {
  const camposComparar = [
    'titulo', 'descripcion', 'area_id', 'frecuencia_id',
    'tema_principal_id', 'tema_secundario_id', 'tipo_gestion',
    'ultima_actualizacion', 'proxima_actualizacion', 'url_dataset', 'observaciones', 'que_se_solicita'
  ];

  // Comparar campos simples
  for (const campo of camposComparar) {
    const valorAntes = normalizarValor(antes[campo]);
    const valorDespues = normalizarValor(despues[campo]);
    if (valorAntes !== valorDespues) {
      return true;
    }
  }

  // Comparar formatos (arrays)
  const formatosAntes = new Set(antes.formatos || []);
  const formatosDespues = new Set(despues.formatos || []);
  
  if (formatosAntes.size !== formatosDespues.size) {
    return true;
  }
  
  for (const f of formatosAntes) {
    if (!formatosDespues.has(f)) {
      return true;
    }
  }

  return false;
};

// Query base para obtener datasets con datos relacionados
const DATASET_SELECT_QUERY = `
  SELECT 
    d.*,
    f.nombre AS frecuencia_nombre,
    f.dias AS frecuencia_dias,
    tp.nombre AS tema_principal_nombre,
    ts.nombre AS tema_secundario_nombre,
    a.nombre AS area_nombre,
    a.area_superior AS area_superior,
    a.email_principal AS area_email_principal,
    a.email_secundario AS area_email_secundario,
    a.telefono_area AS area_telefono,
    a.celular_area AS area_celular,
    a.nombre_contacto AS area_contacto_nombre,
    a.telefono_contacto AS area_contacto_telefono,
    a.email_contacto AS area_contacto_email,
    GROUP_CONCAT(DISTINCT fmt.nombre ORDER BY fmt.nombre SEPARATOR ', ') AS formatos
  FROM datasets d
  LEFT JOIN frecuencias f ON d.frecuencia_id = f.id
  LEFT JOIN temas tp ON d.tema_principal_id = tp.id
  LEFT JOIN temas ts ON d.tema_secundario_id = ts.id
  LEFT JOIN areas a ON d.area_id = a.id
  LEFT JOIN dataset_formatos df ON d.id = df.dataset_id
  LEFT JOIN formatos fmt ON df.formato_id = fmt.id
  WHERE d.activo = TRUE
`;

// Función auxiliar para calcular estado
// Ahora considera tipo_gestion para diferenciar 'atrasado' de 'sin-respuesta'
function calcularEstado(proximaActualizacion, frecuenciaDias, tipoGestion = 'externa') {
  // Si es frecuencia eventual (sin días definidos), siempre está actualizado
  if (frecuenciaDias === null) {
    return 'actualizado';
  }

  if (!proximaActualizacion) {
    return 'sin-fecha';
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  const proxima = new Date(proximaActualizacion);
  proxima.setHours(0, 0, 0, 0);
  
  const diffDias = Math.floor((proxima.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    // Dataset vencido: diferenciar según tipo de gestión
    return tipoGestion === 'interna' ? 'atrasado' : 'sin-respuesta';
  }
  if (diffDias <= 60) return 'proximo';
  return 'actualizado';
}

// Obtener todos los datasets
export const getDatasets = async (req, res) => {
  try {
    const { tema, frecuencia, estado, busqueda } = req.query;

    let query = DATASET_SELECT_QUERY;
    const params = [];

    // Filtro por tema
    if (tema && tema !== 'todos') {
      query += ' AND tp.nombre = ?';
      params.push(tema);
    }

    // Filtro por frecuencia
    if (frecuencia && frecuencia !== 'todas') {
      query += ' AND f.nombre = ?';
      params.push(frecuencia);
    }

    // Filtro por búsqueda
    if (busqueda) {
      query += ' AND (d.titulo LIKE ? OR a.nombre LIKE ? OR d.descripcion LIKE ?)';
      const searchTerm = `%${busqueda}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' GROUP BY d.id ORDER BY d.proxima_actualizacion ASC, d.titulo ASC';

    const [rows] = await pool.execute(query, params);
    let datasets = rows;

    // Filtro por estado (se hace en memoria porque depende de la fecha actual)
    if (estado && estado !== 'todos') {
      datasets = datasets.filter(d => {
        const estadoDataset = calcularEstado(d.proxima_actualizacion, d.frecuencia_dias, d.tipo_gestion);
        return estadoDataset === estado;
      });
    }

    res.json({
      success: true,
      data: datasets
    });
  } catch (error) {
    console.error('Error obteniendo datasets:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los datasets'
    });
  }
};

// Obtener un dataset por ID
export const getDatasetById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute(
      DATASET_SELECT_QUERY + ' AND d.id = ? GROUP BY d.id',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dataset no encontrado'
      });
    }

    const dataset = rows[0];
    
    // Obtener formatos como array de objetos (para edición)
    const [formatosRows] = await pool.execute(
      `SELECT f.id, f.nombre 
       FROM dataset_formatos df
       JOIN formatos f ON df.formato_id = f.id
       WHERE df.dataset_id = ?
       ORDER BY f.nombre`,
      [id]
    );
    
    dataset.formatos_array = formatosRows;

    res.json({
      success: true,
      data: dataset
    });
  } catch (error) {
    console.error('Error obteniendo dataset:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener el dataset'
    });
  }
};

// Crear nuevo dataset (crea cambio pendiente para aprobación)
export const createDataset = async (req, res) => {
  try {
    const data = req.body;
    const usuarioId = req.user?.userId;

    // Validaciones básicas
    if (!data.titulo || !data.area_id || !data.frecuencia_id || 
        !data.formatos || !Array.isArray(data.formatos) || data.formatos.length === 0 ||
        !data.tema_principal_id || !data.tipo_gestion) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos obligatorios: titulo, area_id, frecuencia_id, formatos (array con al menos 1), tema_principal_id, tipo_gestion'
      });
    }

    // Validar que tipo_gestion sea válido
    if (!['interna', 'externa'].includes(data.tipo_gestion)) {
      return res.status(400).json({
        success: false,
        error: 'tipo_gestion debe ser "interna" o "externa"'
      });
    }

    if (!esTextoOpcionalValido(data.que_se_solicita)) {
      return res.status(400).json({
        success: false,
        error: 'que_se_solicita debe ser un texto'
      });
    }

    // Extraer IDs de formatos (pueden venir como objetos o números)
    const formatoIds = data.formatos.map(f => typeof f === 'object' ? f.id : f);
    
    // Validar que los formatos existan
    const [formatosExistentes] = await pool.execute(
      `SELECT id FROM formatos WHERE id IN (${formatoIds.map(() => '?').join(',')}) AND activo = 1`,
      formatoIds
    );
    
    if (formatosExistentes.length !== formatoIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Uno o más formatos no son válidos'
      });
    }

    // Preparar datos para el cambio pendiente
    const datosNuevos = {
      titulo: data.titulo,
      descripcion: data.descripcion || null,
      area_id: data.area_id,
      frecuencia_id: data.frecuencia_id,
      ultima_actualizacion: data.ultima_actualizacion || null,
      proxima_actualizacion: data.proxima_actualizacion || null,
      tema_principal_id: data.tema_principal_id,
      tema_secundario_id: data.tema_secundario_id || null,
      url_dataset: data.url_dataset || null,
      observaciones: data.observaciones || null,
      que_se_solicita: normalizarTextoOpcional(data.que_se_solicita),
      tipo_gestion: data.tipo_gestion,
      formatos: formatoIds
    };

    // Crear cambio pendiente (dataset_id es null porque aún no existe)
    const cambioId = await crearCambioPendiente('crear', null, datosNuevos, null, usuarioId);

    res.status(201).json({
      success: true,
      data: { cambio_pendiente_id: cambioId },
      message: 'Solicitud de creación enviada. Pendiente de aprobación por otro administrador.'
    });
  } catch (error) {
    console.error('Error creando solicitud de dataset:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear la solicitud'
    });
  }
};

// Actualizar dataset (crea cambio pendiente para aprobación)
export const updateDataset = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const usuarioId = req.user?.userId;

    // Verificar que el dataset existe
    const [existing] = await pool.execute(
      'SELECT * FROM datasets WHERE id = ? AND activo = TRUE',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dataset no encontrado'
      });
    }

    // Verificar si el dataset tiene cambios pendientes (bloqueado)
    const bloqueado = await datasetTieneCambiosPendientes(id);
    if (bloqueado) {
      return responderBloqueado(res, 'editar');
    }

    // Validar tipo_gestion si se proporciona
    if (data.tipo_gestion !== undefined && !['interna', 'externa'].includes(data.tipo_gestion)) {
      return res.status(400).json({
        success: false,
        error: 'tipo_gestion debe ser "interna" o "externa"'
      });
    }

    if (!esTextoOpcionalValido(data.que_se_solicita)) {
      return res.status(400).json({
        success: false,
        error: 'que_se_solicita debe ser un texto'
      });
    }

    // Validar formatos si se proporcionan
    let formatoIds = null;
    if (data.formatos !== undefined) {
      if (!Array.isArray(data.formatos) || data.formatos.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'formatos debe ser un array con al menos 1 elemento'
        });
      }
      
      formatoIds = data.formatos.map(f => typeof f === 'object' ? f.id : f);
      
      // Validar que los formatos existan
      const [formatosExistentes] = await pool.execute(
        `SELECT id FROM formatos WHERE id IN (${formatoIds.map(() => '?').join(',')}) AND activo = 1`,
        formatoIds
      );
      
      if (formatosExistentes.length !== formatoIds.length) {
        return res.status(400).json({
          success: false,
          error: 'Uno o más formatos no son válidos'
        });
      }
    }

    // Obtener datos actuales del dataset para guardar como "datos_anteriores"
    const datasetActual = existing[0];
    
    // Obtener formatos actuales
    const [formatosActuales] = await pool.execute(
      'SELECT formato_id FROM dataset_formatos WHERE dataset_id = ?',
      [id]
    );

    const datosAnteriores = {
      titulo: datasetActual.titulo,
      descripcion: datasetActual.descripcion,
      area_id: datasetActual.area_id,
      frecuencia_id: datasetActual.frecuencia_id,
      ultima_actualizacion: datasetActual.ultima_actualizacion,
      proxima_actualizacion: datasetActual.proxima_actualizacion,
      tema_principal_id: datasetActual.tema_principal_id,
      tema_secundario_id: datasetActual.tema_secundario_id,
      url_dataset: datasetActual.url_dataset,
      observaciones: datasetActual.observaciones,
      que_se_solicita: datasetActual.que_se_solicita,
      tipo_gestion: datasetActual.tipo_gestion,
      formatos: formatosActuales.map(f => f.formato_id)
    };

    // Construir datos nuevos (merge de actuales con los cambios)
    const datosNuevos = {
      titulo: data.titulo !== undefined ? data.titulo : datasetActual.titulo,
      descripcion: data.descripcion !== undefined ? (data.descripcion || null) : datasetActual.descripcion,
      area_id: data.area_id !== undefined ? data.area_id : datasetActual.area_id,
      frecuencia_id: data.frecuencia_id !== undefined ? data.frecuencia_id : datasetActual.frecuencia_id,
      ultima_actualizacion: data.ultima_actualizacion !== undefined ? (data.ultima_actualizacion || null) : datasetActual.ultima_actualizacion,
      proxima_actualizacion: data.proxima_actualizacion !== undefined ? (data.proxima_actualizacion || null) : datasetActual.proxima_actualizacion,
      tema_principal_id: data.tema_principal_id !== undefined ? data.tema_principal_id : datasetActual.tema_principal_id,
      tema_secundario_id: data.tema_secundario_id !== undefined ? (data.tema_secundario_id || null) : datasetActual.tema_secundario_id,
      url_dataset: data.url_dataset !== undefined ? (data.url_dataset || null) : datasetActual.url_dataset,
      observaciones: data.observaciones !== undefined ? (data.observaciones || null) : datasetActual.observaciones,
      que_se_solicita: data.que_se_solicita !== undefined ? normalizarTextoOpcional(data.que_se_solicita) : datasetActual.que_se_solicita,
      tipo_gestion: data.tipo_gestion !== undefined ? data.tipo_gestion : datasetActual.tipo_gestion,
      formatos: formatoIds !== null ? formatoIds : formatosActuales.map(f => f.formato_id)
    };

    // Verificar si hay cambios reales
    if (!hayCambiosReales(datosAnteriores, datosNuevos)) {
      return res.status(400).json({
        success: false,
        error: 'No se detectaron cambios. El dataset no fue modificado.'
      });
    }

    // Crear cambio pendiente
    const cambioId = await crearCambioPendiente('editar', Number(id), datosNuevos, datosAnteriores, usuarioId);
    if (!cambioId) {
      return responderBloqueado(res, 'editar');
    }

    res.json({
      success: true,
      data: { cambio_pendiente_id: cambioId },
      message: 'Solicitud de edición enviada. Pendiente de aprobación por otro administrador.'
    });
  } catch (error) {
    console.error('Error creando solicitud de edición:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear la solicitud de edición'
    });
  }
};

// Eliminar dataset (crea cambio pendiente para aprobación)
export const deleteDataset = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user?.userId;

    // Verificar que el dataset existe
    const [existing] = await pool.execute(
      'SELECT * FROM datasets WHERE id = ? AND activo = TRUE',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dataset no encontrado'
      });
    }

    // Verificar si el dataset tiene cambios pendientes (bloqueado)
    const bloqueado = await datasetTieneCambiosPendientes(id);
    if (bloqueado) {
      return responderBloqueado(res, 'eliminar');
    }

    const datasetActual = existing[0];

    // Guardar datos actuales para el registro
    const datosAnteriores = {
      titulo: datasetActual.titulo,
      descripcion: datasetActual.descripcion,
      area_id: datasetActual.area_id,
      frecuencia_id: datasetActual.frecuencia_id,
      tipo_gestion: datasetActual.tipo_gestion
    };

    // Crear cambio pendiente de eliminación
    const cambioId = await crearCambioPendiente('eliminar', Number(id), { eliminado: true }, datosAnteriores, usuarioId);
    if (!cambioId) {
      return responderBloqueado(res, 'eliminar');
    }

    res.json({
      success: true,
      data: { cambio_pendiente_id: cambioId },
      message: 'Solicitud de eliminación enviada. Pendiente de aprobación por otro administrador.'
    });
  } catch (error) {
    console.error('Error creando solicitud de eliminación:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear la solicitud de eliminación'
    });
  }
};

// Obtener estadísticas para el dashboard
export const getEstadisticas = async (req, res) => {
  try {
    const [datasets] = await pool.execute(DATASET_SELECT_QUERY + ' GROUP BY d.id');
    const data = datasets;

    const hoy = new Date();
    let actualizados = 0;
    let proximos = 0;
    let atrasados = 0;      // Gestión interna
    let sinRespuesta = 0;   // Gestión externa
    let totalDiasAtraso = 0;

    data.forEach(d => {
      const estado = calcularEstado(d.proxima_actualizacion, d.frecuencia_dias, d.tipo_gestion);
      if (estado === 'actualizado') actualizados++;
      else if (estado === 'proximo') proximos++;
      else if (estado === 'atrasado') {
        atrasados++;
        if (d.proxima_actualizacion) {
          const proxima = new Date(d.proxima_actualizacion);
          const diasAtraso = Math.floor((hoy.getTime() - proxima.getTime()) / (1000 * 60 * 60 * 24));
          totalDiasAtraso += diasAtraso;
        }
      } else if (estado === 'sin-respuesta') {
        sinRespuesta++;
        if (d.proxima_actualizacion) {
          const proxima = new Date(d.proxima_actualizacion);
          const diasAtraso = Math.floor((hoy.getTime() - proxima.getTime()) / (1000 * 60 * 60 * 24));
          totalDiasAtraso += diasAtraso;
        }
      }
    });

    // Total de vencidos (atrasados + sin respuesta)
    const totalVencidos = atrasados + sinRespuesta;

    // Datasets por tema
    const [porTema] = await pool.execute(`
      SELECT t.nombre AS tema, COUNT(*) AS cantidad
      FROM datasets d
      JOIN temas t ON d.tema_principal_id = t.id
      WHERE d.activo = TRUE
      GROUP BY t.nombre
      ORDER BY cantidad DESC
    `);

    // Datasets por frecuencia
    const [porFrecuencia] = await pool.execute(`
      SELECT f.nombre AS frecuencia, COUNT(*) AS cantidad
      FROM datasets d
      JOIN frecuencias f ON d.frecuencia_id = f.id
      WHERE d.activo = TRUE
      GROUP BY f.nombre
      ORDER BY f.orden ASC
    `);

    const estadisticas = {
      total: data.length,
      actualizados,
      proximos,
      atrasados,         // Solo gestión interna
      sinRespuesta,      // Solo gestión externa
      totalVencidos,     // Suma de ambos
      tasaActualizacion: data.length > 0 ? Math.round(((actualizados + proximos) / data.length) * 100) : 0,
      promedioAtraso: totalVencidos > 0 ? Math.round(totalDiasAtraso / totalVencidos) : 0,
      porTema,
      porFrecuencia
    };

    res.json({
      success: true,
      data: estadisticas
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener las estadísticas'
    });
  }
};

// Registrar actualización de dataset (crea cambio pendiente para aprobación)
export const registrarActualizacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_actualizacion, notas } = req.body;
    const usuarioId = req.user?.userId;

    // Obtener el dataset y su frecuencia
    const [datasetRows] = await pool.execute(
      `SELECT d.*, f.dias AS frecuencia_dias 
       FROM datasets d 
       JOIN frecuencias f ON d.frecuencia_id = f.id 
       WHERE d.id = ? AND d.activo = TRUE`,
      [id]
    );

    if (datasetRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dataset no encontrado'
      });
    }

    // Verificar si el dataset tiene cambios pendientes (bloqueado)
    const bloqueado = await datasetTieneCambiosPendientes(id);
    if (bloqueado) {
      return responderBloqueado(res, 'marcar como actualizado');
    }

    const dataset = datasetRows[0];
    const fechaActualizacion = fecha_actualizacion || new Date().toISOString().split('T')[0];

    // Calcular próxima actualización si la frecuencia tiene días definidos
    let proximaActualizacion = null;
    if (dataset.frecuencia_dias) {
      const fecha = new Date(fechaActualizacion);
      fecha.setDate(fecha.getDate() + dataset.frecuencia_dias);
      proximaActualizacion = fecha.toISOString().split('T')[0];
    }

    // Datos anteriores
    const datosAnteriores = {
      ultima_actualizacion: dataset.ultima_actualizacion,
      proxima_actualizacion: dataset.proxima_actualizacion
    };

    // Datos nuevos
    const datosNuevos = {
      ultima_actualizacion: fechaActualizacion,
      proxima_actualizacion: proximaActualizacion,
      notas: notas || null
    };

    // Crear cambio pendiente
    const cambioId = await crearCambioPendiente('editar', Number(id), datosNuevos, datosAnteriores, usuarioId);
    if (!cambioId) {
      return responderBloqueado(res, 'marcar como actualizado');
    }

    res.json({
      success: true,
      data: { cambio_pendiente_id: cambioId },
      message: 'Solicitud de actualización enviada. Pendiente de aprobación por otro administrador.'
    });
  } catch (error) {
    console.error('Error creando solicitud de actualización:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear la solicitud de actualización'
    });
  }
};
