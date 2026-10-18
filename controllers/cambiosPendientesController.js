/**
 * Controlador para el sistema de aprobación de cambios en dos pasos
 * Versión 1.5.0
 */

import pool from '../config/database.js';
import { personasDeAuditoria, catalogosParaAuditoria } from '../services/auditoriaService.js';
import { permisoParaAuditar, quienesAuditan } from '../services/auditoriaReglas.js';
import { esFechaIso, hoyArgentina } from '../services/notasDigitalesCalendario.js';
import { esFinDeMes, NOMBRES_TIPO_PEDIDO } from '../services/fechasDatasetReglas.js';

// ¿Quien pide puede aprobar o rechazar hoy este cambio? (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.2): un
// auditor siempre; un editor, solo de respaldo. conexion: la de la transacción o el pool.
// Devuelve { puede: true, respaldo } o { puede: false, mensaje }.
const permisoParaAuditarHoy = async (conexion, usuario, proponenteId) => permisoParaAuditar(
  { id: usuario.userId, rol: usuario.rol }, proponenteId, await personasDeAuditoria(hoyArgentina(), conexion)
);

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
  
  // El tipo de pedido, con su nombre en pantalla (lo guardado es la clave del enum: 'foto', 'anio_anterior', …)
  if (typeof datos.tipo_pedido === 'string' && Object.hasOwn(NOMBRES_TIPO_PEDIDO, datos.tipo_pedido)) {
    enriquecido.tipo_pedido_nombre = NOMBRES_TIPO_PEDIDO[datos.tipo_pedido];
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

// Las fechas se comparan por el día. Al proponer un cambio, las guardadas llegan con hora ("2026-03-15T03:00:00.000Z") y las
// editadas sin ella ("2026-03-15"): el día es el de los primeros 10 caracteres (igual que valorComparable de
// services/notasDigitalesContenido.js, que arma la comparación de las notas de auditoría)
const CAMPOS_DE_FECHA = ['ultima_actualizacion', 'datos_al', 'proxima_actualizacion', 'recibido_el'];
const comparable = (key, texto) => (CAMPOS_DE_FECHA.includes(key) ? texto.slice(0, 10) : texto);

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
    { key: 'tipo_pedido_nombre', label: 'Tipo de pedido', keyAntes: 'tipo_pedido', keyDespues: 'tipo_pedido' },
    { key: 'datos_al', label: 'Datos al' },
    { key: 'ultima_actualizacion', label: 'Cargado en el portal' },
    { key: 'recibido_el', label: 'Recibido el' },
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
    
    if (comparable(campo.key, antesStr) !== comparable(campo.key, despuesStr)) {
      cambios.push({
        campo: campo.label,
        antes: antesStr || '-',
        despues: despuesStr || '-'
      });
    }
  });
  
  return cambios;
};

// El JSON de datos llega como texto o ya parseado, según el driver
const parsearDatos = (datos) => (typeof datos === 'string' ? JSON.parse(datos) : datos);

// Una fecha del JSON de un cambio sin la hora: las leídas de la base quedan como '2026-03-15T03:00:00.000Z' y las que
// llegan del formulario, como '2026-03-15' (igual que comparable, más arriba)
const fechaSinHora = (valor) => (typeof valor === 'string' ? valor.slice(0, 10) : valor);
// El día 'AAAA-MM-DD' de una fecha del JSON, o null si no hay una fecha válida
const diaDe = (valor) => (esFechaIso(fechaSinHora(valor)) ? fechaSinHora(valor) : null);

// Las fechas de un cambio que tienen que ser fin de mes para aprobarlo (spec 2026-10-17-fechas-datasets, R1, R5 y 10.1)
const FECHAS_FIN_DE_MES = [
  ['proxima_actualizacion', 'La próxima actualización del cambio no es el último día de un mes. Rechazalo y proponé la fecha correcta.'],
  ['datos_al', 'Datos al del cambio no es el último día de un mes. Rechazalo y proponé la fecha correcta.']
];

/**
 * El motivo por el que no se puede aprobar un cambio con una próxima o un Datos al que no son fin de mes: cubre los
 * cambios propuestos antes del despliegue (la próxima calculada sumando días) y los cargados por SQL. Como al proponer,
 * se mira solo lo que cambia (spec, sección 4): una edición que conserva una fecha vieja mala, igual en los datos
 * anteriores, se aprueba. null si se puede aprobar.
 */
const fechaQueNoEsFinDeMes = (nuevos, anteriores) => {
  for (const [campo, mensaje] of FECHAS_FIN_DE_MES) {
    const valor = nuevos[campo];
    if (valor === undefined || valor === null || valor === '') continue;
    if (anteriores && fechaSinHora(valor) === fechaSinHora(anteriores[campo])) continue;
    if (!esFinDeMes(fechaSinHora(valor))) return mensaje;
  }
  return null;
};

/**
 * Una fila de cambios_pendientes con sus datos parseados y enriquecidos con los nombres de catálogo, y los campos que
 * cambiaron (solo en una edición; en un alta o una baja, null). La usan el detalle y las dos listas de Mi Perfil.
 */
const detallarCambio = (fila, catalogos) => {
  const datosNuevos = enriquecerDatos(parsearDatos(fila.datos_nuevos), catalogos);
  const datosAnteriores = enriquecerDatos(fila.datos_anteriores ? parsearDatos(fila.datos_anteriores) : null, catalogos);
  return {
    ...fila,
    datos_nuevos: datosNuevos,
    datos_anteriores: datosAnteriores,
    campos_modificados: fila.tipo_cambio === 'editar' && datosAnteriores && datosNuevos ? calcularCambios(datosAnteriores, datosNuevos) : null
  };
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
             d.url_dataset as dataset_url,
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

    // Datos parseados y enriquecidos, y la comparación, como en el detalle
    const catalogos = await catalogosParaAuditoria();
    // Quiénes pueden auditar hoy, una sola vez por pedido y solo si hay algún cambio pendiente
    const personas = rows.some(row => row.estado === 'pendiente') ? await personasDeAuditoria(hoyArgentina()) : [];
    const cambios = rows.map(row => {
      // Como en el detalle: si quien mira puede aprobarlo o rechazarlo hoy (auditoria) y, además, quiénes lo auditan
      let auditoria = { puede: false, respaldo: false, mensaje: null, auditan: [] };
      if (row.estado === 'pendiente') {
        const { personas: quienes, respaldo } = quienesAuditan(personas, row.usuario_id);
        auditoria = {
          respaldo: false,
          mensaje: null,
          ...permisoParaAuditar({ id: userId, rol: req.user.rol }, row.usuario_id, personas),
          auditan: respaldo ? [] : quienes.map(p => p.nombre_completo)
        };
      }
      return { ...detallarCambio(row, catalogos), auditoria };
    });

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
             d.url_dataset as dataset_url,
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

    // Datos parseados y enriquecidos, y la comparación, como en el detalle
    const catalogos = await catalogosParaAuditoria();
    const cambios = rows.map(row => detallarCambio(row, catalogos));

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

    // Datos parseados y enriquecidos con los nombres de catalogo, y solo los campos que cambiaron (para edicion)
    const cambio = detallarCambio(rows[0], await catalogosParaAuditoria());

    // Si quien mira puede aprobarlo o rechazarlo hoy (spec 2026-10-15, 8.2): Mi Perfil deshabilita los botones con el motivo
    const sinAuditar = rows[0].estado !== 'pendiente' || rows[0].usuario_id === req.user.userId;
    const auditoria = sinAuditar
      ? { puede: false, respaldo: false, mensaje: null }
      : { respaldo: false, mensaje: null, ...(await permisoParaAuditarHoy(pool, req.user, rows[0].usuario_id)) };

    res.json({
      success: true,
      data: { ...cambio, auditoria }
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

    // Regla de respaldo (spec 2026-10-15, 8.2), con la fecha de hoy en Argentina
    const permiso = await permisoParaAuditarHoy(connection, req.user, cambio.usuario_id);
    if (!permiso.puede) {
      await connection.rollback();
      return res.status(403).json({ success: false, error: permiso.mensaje });
    }

    const datosNuevos = typeof cambio.datos_nuevos === 'string'
      ? JSON.parse(cambio.datos_nuevos)
      : cambio.datos_nuevos;
    const datosAnteriores = cambio.datos_anteriores ? parsearDatos(cambio.datos_anteriores) : null;

    // Antes de aplicar nada: una próxima o un Datos al que no son fin de mes no se aprueban (el cambio sigue pendiente)
    const fechaMala = fechaQueNoEsFinDeMes(datosNuevos, datosAnteriores);
    if (fechaMala) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: fechaMala });
    }

    let datasetId = cambio.dataset_id;

    // Aplicar el cambio según el tipo
    if (cambio.tipo_cambio === 'crear') {
      // Insertar nuevo dataset
      const [result] = await connection.execute(
        `INSERT INTO datasets (
          titulo, descripcion, area_id, frecuencia_id,
          ultima_actualizacion, datos_al, proxima_actualizacion,
          tema_principal_id, tema_secundario_id,
          url_dataset, observaciones, que_se_solicita, tipo_pedido, tipo_gestion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          datosNuevos.titulo,
          datosNuevos.descripcion || null,
          datosNuevos.area_id,
          datosNuevos.frecuencia_id,
          datosNuevos.ultima_actualizacion || null,
          datosNuevos.datos_al || null,
          datosNuevos.proxima_actualizacion || null,
          datosNuevos.tema_principal_id,
          datosNuevos.tema_secundario_id || null,
          datosNuevos.url_dataset || null,
          datosNuevos.observaciones || null,
          datosNuevos.que_se_solicita || null,
          datosNuevos.tipo_pedido || null,
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
        'ultima_actualizacion', 'datos_al', 'proxima_actualizacion',
        'tema_principal_id', 'tema_secundario_id',
        'url_dataset', 'observaciones', 'que_se_solicita', 'tipo_pedido', 'tipo_gestion'
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

      // Un registro de actualización queda en el historial, con sus fechas (spec 2026-10-17-fechas-datasets, 10.1). La
      // marca solo la pone POST /datasets/:id/actualizar: los registros de la forma vieja se aprueban sin historial.
      // vencimiento es la próxima que se cumplió (la anterior del cambio) y usuario_id, quien lo propuso. La carga
      // siempre viene en un registro; si un cambio cargado por SQL no la trae, cuenta el día de la aprobación
      if (datosNuevos.registro_actualizacion === true) {
        await connection.execute(
          `INSERT INTO historial_actualizaciones
             (dataset_id, fecha_actualizacion, usuario_id, notas, cambio_id, vencimiento, datos_al, recibido_el, proxima_nueva)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cambio.dataset_id,
            diaDe(datosNuevos.ultima_actualizacion) ?? hoyArgentina(),
            cambio.usuario_id,
            datosNuevos.notas || null,
            cambio.id,
            diaDe(datosAnteriores?.proxima_actualizacion),
            diaDe(datosNuevos.datos_al),
            diaDe(datosNuevos.recibido_el),
            diaDe(datosNuevos.proxima_actualizacion)
          ]
        );
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
       SET estado = 'aprobado', revisor_id = ?, revisado_at = NOW(), revisado_como_respaldo = ?
       WHERE id = ?`,
      [revisorId, permiso.respaldo ? 1 : 0, id]
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

    // Regla de respaldo (spec 2026-10-15, 8.2), con la fecha de hoy en Argentina
    const permiso = await permisoParaAuditarHoy(connection, req.user, cambio.usuario_id);
    if (!permiso.puede) {
      await connection.rollback();
      return res.status(403).json({ success: false, error: permiso.mensaje });
    }

    // Marcar como rechazado
    await connection.execute(
      `UPDATE cambios_pendientes
       SET estado = 'rechazado', revisor_id = ?, comentario_rechazo = ?, revisado_at = NOW(), revisado_como_respaldo = ?
       WHERE id = ?`,
      [revisorId, comentario.trim(), permiso.respaldo ? 1 : 0, id]
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