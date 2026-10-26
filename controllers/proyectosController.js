// Proyectos (spec 2026-10-25-proyectos, secciones 7 a 9): los proyectos de la Dirección de Datos Públicos y Comunicación, sus
// hitos, los logros del área (hitos sin proyecto) y la línea de tiempo. Las rutas siguen en /api/gestion/…: leen todos los roles
// con sesión (authMiddleware) y escriben solo administración (adminOnly).
// La validación es pura (services/proyectosReglas.js); acá se chequea lo que necesita la base: que el proyecto exista y esté
// activo, que el hito exista y no sea de un proyecto dado de baja, y que las áreas existan. Lo que escribe en más de una fila
// (un proyecto con sus áreas, un hito, el borrado de un hito) va en una transacción.
// Las fechas salen como texto 'AAAA-MM-DD': las DATE con DATE_FORMAT y los TIMESTAMP de los archivos con UNIX_TIMESTAMP y
// ahoraArgentina (el día en Argentina, sea cual sea la zona de la base). Sin consultas N+1: una consulta por tabla para todos
// los proyectos o los hitos juntos.
// Los archivos (subidas, descargas y borrados) todavía están en gestionController.js.
import pool from '../config/database.js';
import { hoyArgentina, ahoraArgentina } from '../services/notasDigitalesCalendario.js';
import {
  validarProyecto, validarHito, evidenciaTipo, idPositivo, primerError, MENSAJES_PROYECTOS
} from '../services/proyectosReglas.js';

const PROYECTO_NO_ENCONTRADO = 'Proyecto no encontrado';
const HITO_NO_ENCONTRADO = 'Hito no encontrado';

// El color de un proyecto nuevo que no lo trae: el DEFAULT de la columna y el de siempre (Ruling R7). Una edición nunca lo inventa
const COLOR_POR_DEFECTO = '#3b82f6';

// Las columnas que escribe una edición, en el orden de validarProyecto y validarHito: solo las que vinieron en el pedido. Los
// nombres salen de estas listas fijas, nunca del pedido
const COLUMNAS_DEL_PROYECTO = ['nombre', 'descripcion', 'estado', 'prioridad', 'categoria', 'fecha_inicio', 'responsable',
  'enlace_externo', 'color', 'icono'];
const COLUMNAS_DEL_HITO = ['titulo', 'fecha', 'descripcion', 'evidencia_url'];

// [status, cuerpo]: lo que responde cada operación. Dentro de una transacción, un 2xx la confirma y cualquier otro la deshace
const rechazo = (status, error) => [status, { success: false, error }];
const rechazoDeValidacion = (errores) => {
  const { error, campo } = primerError(errores);
  return [400, { success: false, error, campo, errores }];
};
const rechazoDeAreas = () => rechazoDeValidacion([{ campo: 'areas', mensaje: MENSAJES_PROYECTOS.areas }]);

/**
 * Corre trabajo(conexion) en una transacción y devuelve su [status, cuerpo]: un 2xx la confirma; cualquier otro, o un error, la
 * deshace. La conexión vuelve al pool siempre.
 */
const enTransaccion = async (trabajo) => {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const [status, cuerpo] = await trabajo(conexion);
    if (status < 300) await conexion.commit();
    else await conexion.rollback();
    return [status, cuerpo];
  } catch (error) {
    await conexion.rollback().catch(() => {});
    throw error;
  } finally {
    conexion.release();
  }
};

// Responde lo que devolvió la operación, o 500 con `mensaje` si algo inesperado falló (el error completo, solo en la consola)
const responder = async (res, mensaje, operacion) => {
  try {
    const [status, cuerpo] = await operacion();
    res.status(status).json(cuerpo);
  } catch (error) {
    console.error(`${mensaje}:`, error);
    res.status(500).json({ success: false, error: mensaje });
  }
};

// Si el pedido trajo la clave (validarProyecto y validarHito con parcial solo devuelven las presentes)
const vino = (datos, clave) => Object.hasOwn(datos, clave);

// Un TIMESTAMP leído con UNIX_TIMESTAMP, como el día en Argentina ('AAAA-MM-DD'); null si no hay
const diaArgentino = (segundos) => (segundos == null ? null : ahoraArgentina(new Date(Number(segundos) * 1000)).slice(0, 10));

// Las filas agrupadas por una columna: Map(valor → filas), en el orden en que llegaron
const agrupar = (filas, columna) => {
  const grupos = new Map();
  for (const fila of filas) {
    const grupo = grupos.get(fila[columna]);
    if (grupo) grupo.push(fila);
    else grupos.set(fila[columna], [fila]);
  }
  return grupos;
};

// Un archivo de un hito o un documento de un proyecto, como lo lee la página
const aArchivo = ({ id, nombre_archivo, tamano, mime_type, subido_ts }) => ({
  id, nombre_archivo, tamano, mime_type, subido_el: diaArgentino(subido_ts)
});

// =====================================================
// Lecturas
// =====================================================

const SQL_PROYECTOS = `SELECT p.id, p.nombre, p.descripcion, p.estado, DATE_FORMAT(p.fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
    p.icono, p.color, p.responsable, p.enlace_externo, p.prioridad, p.categoria, p.orden
  FROM proyectos p
  WHERE p.activo = TRUE`;

const SQL_HITOS = `SELECT ph.id, ph.proyecto_id, ph.titulo, DATE_FORMAT(ph.fecha, '%Y-%m-%d') AS fecha, ph.descripcion,
    ph.evidencia_tipo, ph.evidencia_url`;

const SQL_ARCHIVOS = 'SELECT id, nombre_archivo, tamano, mime_type, UNIX_TIMESTAMP(created_at) AS subido_ts';

/**
 * Los proyectos activos (todos, o solo el de `id`), cada uno con sus áreas (por nombre), la cantidad de hitos, los cumplidos
 * (fecha hasta hoy en Argentina) y la cantidad de documentos. La lista va por categoría (el orden del enum: tecnología,
 * normativa, difusión), orden y nombre. Tres consultas más para todos los proyectos juntos. `db` es el pool o la conexión de
 * una transacción (así una escritura responde lo que acaba de guardar).
 */
const leerProyectos = async (db, id = null) => {
  const [filas] = id === null
    ? await db.query(`${SQL_PROYECTOS} ORDER BY p.categoria, p.orden, p.nombre, p.id`)
    : await db.query(`${SQL_PROYECTOS} AND p.id = ?`, [id]);
  if (filas.length === 0) return [];
  const ids = filas.map((fila) => fila.id);
  const [[areas], [hitos], [documentos]] = await Promise.all([
    db.query(
      `SELECT pa.proyecto_id, a.id, a.nombre
       FROM proyecto_areas pa
       JOIN areas a ON a.id = pa.area_id
       WHERE pa.proyecto_id IN (?)
       ORDER BY a.nombre, a.id`,
      [ids]
    ),
    db.query(
      `SELECT proyecto_id, COUNT(*) AS cantidad, SUM(fecha <= ?) AS cumplidos
       FROM proyecto_hitos WHERE proyecto_id IN (?) GROUP BY proyecto_id`,
      [hoyArgentina(), ids]
    ),
    db.query('SELECT proyecto_id, COUNT(*) AS cantidad FROM proyecto_documentos WHERE proyecto_id IN (?) GROUP BY proyecto_id', [ids])
  ]);
  const areasPorProyecto = agrupar(areas, 'proyecto_id');
  const hitosPorProyecto = new Map(hitos.map((fila) => [fila.proyecto_id, fila]));
  const documentosPorProyecto = new Map(documentos.map((fila) => [fila.proyecto_id, fila]));
  return filas.map((fila) => ({
    ...fila,
    areas: (areasPorProyecto.get(fila.id) ?? []).map((area) => ({ id: area.id, nombre: area.nombre })),
    // COUNT llega como número y SUM como texto (DECIMAL): los dos pasan por Number
    cantidad_hitos: Number(hitosPorProyecto.get(fila.id)?.cantidad ?? 0),
    hitos_completados: Number(hitosPorProyecto.get(fila.id)?.cumplidos ?? 0),
    cantidad_documentos: Number(documentosPorProyecto.get(fila.id)?.cantidad ?? 0)
  }));
};

// Los hitos con sus archivos (los más nuevos primero), en una sola consulta para todos
const conArchivos = async (db, hitos) => {
  if (hitos.length === 0) return [];
  const [archivos] = await db.query(
    `${SQL_ARCHIVOS}, hito_id FROM hito_archivos WHERE hito_id IN (?) ORDER BY created_at DESC, id DESC`,
    [hitos.map((hito) => hito.id)]
  );
  const porHito = agrupar(archivos, 'hito_id');
  return hitos.map((hito) => ({ ...hito, archivos: (porHito.get(hito.id) ?? []).map(aArchivo) }));
};

// Un hito con sus archivos, como lo responde una escritura (null si no existe)
const leerHito = async (db, id) => {
  const [filas] = await db.query(`${SQL_HITOS} FROM proyecto_hitos ph WHERE ph.id = ?`, [id]);
  const [hito] = await conArchivos(db, filas);
  return hito ?? null;
};

// GET /gestion/proyectos: los proyectos activos
export const getProyectos = (req, res) => responder(res, 'Error al obtener proyectos', async () =>
  [200, { success: true, data: await leerProyectos(pool) }]);

// GET /gestion/proyectos/:id: el proyecto activo con sus hitos (por fecha, los más nuevos primero) y sus documentos
export const getProyectoById = (req, res) => responder(res, 'Error al obtener proyecto', async () => {
  const id = idPositivo(req.params.id);
  if (id === null) return rechazo(404, PROYECTO_NO_ENCONTRADO);
  const [proyecto] = await leerProyectos(pool, id);
  if (!proyecto) return rechazo(404, PROYECTO_NO_ENCONTRADO);
  const [[hitos], [documentos]] = await Promise.all([
    pool.query(`${SQL_HITOS} FROM proyecto_hitos ph WHERE ph.proyecto_id = ? ORDER BY ph.fecha DESC, ph.id DESC`, [id]),
    pool.query(`${SQL_ARCHIVOS} FROM proyecto_documentos WHERE proyecto_id = ? ORDER BY created_at DESC, id DESC`, [id])
  ]);
  return [200, {
    success: true,
    data: { ...proyecto, hitos: await conArchivos(pool, hitos), documentos: documentos.map(aArchivo) }
  }];
});

// GET /gestion/timeline: los hitos de los proyectos activos y los logros del área, por fecha (los más nuevos primero)
export const getTimeline = (req, res) => responder(res, 'Error al obtener timeline', async () => {
  const [hitos] = await pool.query(
    `${SQL_HITOS}, p.nombre AS proyecto_nombre, p.color AS proyecto_color, p.icono AS proyecto_icono, p.categoria
     FROM proyecto_hitos ph
     LEFT JOIN proyectos p ON p.id = ph.proyecto_id
     WHERE ph.proyecto_id IS NULL OR p.activo = TRUE
     ORDER BY ph.fecha DESC, ph.id DESC`
  );
  return [200, { success: true, data: await conArchivos(pool, hitos) }];
});

// =====================================================
// Proyectos
// =====================================================

// Que existan todas las áreas (los ids llegan sin repetir). Las bloquea hasta el fin de la transacción: no se borran a mitad
const existenLasAreas = async (conexion, ids) => {
  if (ids.length === 0) return true;
  const [filas] = await conexion.query('SELECT id FROM areas WHERE id IN (?) LOCK IN SHARE MODE', [ids]);
  return filas.length === ids.length;
};

const insertarAreas = async (conexion, proyectoId, ids) => {
  if (ids.length === 0) return;
  await conexion.query('INSERT INTO proyecto_areas (proyecto_id, area_id) VALUES ?', [ids.map((areaId) => [proyectoId, areaId])]);
};

// El proyecto activo, bloqueado hasta el fin de la transacción: `para` es 'editar' (FOR UPDATE) o 'colgar' (un hito nuevo:
// LOCK IN SHARE MODE, así no lo dan de baja a mitad). null si no existe o está dado de baja
const SQL_PROYECTO_ACTIVO = {
  editar: 'SELECT id FROM proyectos WHERE id = ? AND activo = TRUE FOR UPDATE',
  colgar: 'SELECT id FROM proyectos WHERE id = ? AND activo = TRUE LOCK IN SHARE MODE'
};
const proyectoActivo = async (conexion, id, para) => {
  const [[fila]] = await conexion.query(SQL_PROYECTO_ACTIVO[para], [id]);
  return fila ?? null;
};

// POST /gestion/proyectos: el proyecto y sus áreas, en una transacción. El orden no se edita: queda en 0
export const createProyecto = (req, res) => responder(res, 'Error al crear proyecto', async () => {
  const { datos, errores } = validarProyecto(req.body, { hoy: hoyArgentina() });
  if (errores.length > 0) return rechazoDeValidacion(errores);
  return enTransaccion(async (conexion) => {
    if (!(await existenLasAreas(conexion, datos.areas))) return rechazoDeAreas();
    const [resultado] = await conexion.query(
      `INSERT INTO proyectos (nombre, descripcion, estado, prioridad, categoria, fecha_inicio, responsable, enlace_externo, color,
         icono, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [datos.nombre, datos.descripcion, datos.estado, datos.prioridad, datos.categoria, datos.fecha_inicio, datos.responsable,
        datos.enlace_externo, datos.color ?? COLOR_POR_DEFECTO, datos.icono, req.user.userId]
    );
    await insertarAreas(conexion, resultado.insertId, datos.areas);
    const [proyecto] = await leerProyectos(conexion, resultado.insertId);
    return [201, { success: true, data: proyecto, message: 'Proyecto creado' }];
  });
});

// PUT /gestion/proyectos/:id: solo lo que viene; las áreas, si vienen, se reemplazan todas. En una transacción: 404 si no
// existe o está dado de baja, después los 400
export const updateProyecto = (req, res) => responder(res, 'Error al actualizar proyecto', async () => {
  const id = idPositivo(req.params.id);
  if (id === null) return rechazo(404, PROYECTO_NO_ENCONTRADO);
  const { datos, errores } = validarProyecto(req.body, { hoy: hoyArgentina(), parcial: true });
  return enTransaccion(async (conexion) => {
    if (!(await proyectoActivo(conexion, id, 'editar'))) return rechazo(404, PROYECTO_NO_ENCONTRADO);
    if (errores.length > 0) return rechazoDeValidacion(errores);
    if (vino(datos, 'areas') && !(await existenLasAreas(conexion, datos.areas))) return rechazoDeAreas();
    const columnas = COLUMNAS_DEL_PROYECTO.filter((columna) => vino(datos, columna));
    if (columnas.length > 0) {
      await conexion.query(
        `UPDATE proyectos SET ${columnas.map((columna) => `${columna} = ?`).join(', ')} WHERE id = ?`,
        [...columnas.map((columna) => datos[columna]), id]
      );
    }
    if (vino(datos, 'areas')) {
      await conexion.query('DELETE FROM proyecto_areas WHERE proyecto_id = ?', [id]);
      await insertarAreas(conexion, id, datos.areas);
    }
    const [proyecto] = await leerProyectos(conexion, id);
    return [200, { success: true, data: proyecto, message: 'Proyecto actualizado' }];
  });
});

// DELETE /gestion/proyectos/:id: lo da de baja (activo = FALSE); sus hitos dejan de verse
export const deleteProyecto = (req, res) => responder(res, 'Error al eliminar proyecto', async () => {
  const id = idPositivo(req.params.id);
  if (id === null) return rechazo(404, PROYECTO_NO_ENCONTRADO);
  const [resultado] = await pool.query('UPDATE proyectos SET activo = FALSE WHERE id = ? AND activo = TRUE', [id]);
  if (resultado.affectedRows === 0) return rechazo(404, PROYECTO_NO_ENCONTRADO);
  return [200, { success: true, message: 'Proyecto eliminado' }];
});

// =====================================================
// Hitos y logros
// =====================================================

const insertarHito = (db, proyectoId, datos) => db.query(
  `INSERT INTO proyecto_hitos (proyecto_id, titulo, fecha, descripcion, evidencia_tipo, evidencia_url)
   VALUES (?, ?, ?, ?, ?, ?)`,
  [proyectoId, datos.titulo, datos.fecha, datos.descripcion,
    evidenciaTipo({ evidencia_url: datos.evidencia_url, cantidadArchivos: 0 }), datos.evidencia_url]
);

// El hito, si existe y es un logro o es de un proyecto activo, bloqueado hasta el fin de la transacción. null si no
const hitoVigente = async (conexion, id) => {
  const [[hito]] = await conexion.query(
    `SELECT ph.id, ph.evidencia_url
     FROM proyecto_hitos ph
     LEFT JOIN proyectos p ON p.id = ph.proyecto_id
     WHERE ph.id = ? AND (ph.proyecto_id IS NULL OR p.activo = TRUE)
     FOR UPDATE`,
    [id]
  );
  return hito ?? null;
};

// POST /gestion/logros: un hito sin proyecto. evidencia_tipo lo deriva el servidor (se ignora el que llegue)
export const createLogro = (req, res) => responder(res, 'Error al registrar logro', async () => {
  const { datos, errores } = validarHito(req.body, { hoy: hoyArgentina() });
  if (errores.length > 0) return rechazoDeValidacion(errores);
  const [resultado] = await insertarHito(pool, null, datos);
  return [201, { success: true, data: await leerHito(pool, resultado.insertId), message: 'Logro registrado' }];
});

// POST /gestion/proyectos/:proyecto_id/hitos: en una transacción, con el proyecto bloqueado. 404 si el proyecto no existe o
// está dado de baja, después los 400
export const createHito = (req, res) => responder(res, 'Error al crear hito', async () => {
  const proyectoId = idPositivo(req.params.proyecto_id);
  if (proyectoId === null) return rechazo(404, PROYECTO_NO_ENCONTRADO);
  const { datos, errores } = validarHito(req.body, { hoy: hoyArgentina() });
  return enTransaccion(async (conexion) => {
    if (!(await proyectoActivo(conexion, proyectoId, 'colgar'))) return rechazo(404, PROYECTO_NO_ENCONTRADO);
    if (errores.length > 0) return rechazoDeValidacion(errores);
    const [resultado] = await insertarHito(conexion, proyectoId, datos);
    return [201, { success: true, data: await leerHito(conexion, resultado.insertId), message: 'Hito creado' }];
  });
});

// PUT /gestion/hitos/:id (también un logro): solo lo que viene. evidencia_tipo se vuelve a derivar con el enlace que queda y
// los archivos que tiene. 404 si no existe o es de un proyecto dado de baja, después los 400
export const updateHito = (req, res) => responder(res, 'Error al actualizar hito', async () => {
  const id = idPositivo(req.params.id);
  if (id === null) return rechazo(404, HITO_NO_ENCONTRADO);
  const { datos, errores } = validarHito(req.body, { hoy: hoyArgentina(), parcial: true });
  return enTransaccion(async (conexion) => {
    const hito = await hitoVigente(conexion, id);
    if (!hito) return rechazo(404, HITO_NO_ENCONTRADO);
    if (errores.length > 0) return rechazoDeValidacion(errores);
    const [[{ cantidad }]] = await conexion.query('SELECT COUNT(*) AS cantidad FROM hito_archivos WHERE hito_id = ?', [id]);
    const enlace = vino(datos, 'evidencia_url') ? datos.evidencia_url : hito.evidencia_url;
    // Sin errores, la validación parcial trajo al menos una columna
    const columnas = COLUMNAS_DEL_HITO.filter((columna) => vino(datos, columna));
    await conexion.query(
      `UPDATE proyecto_hitos SET ${columnas.map((columna) => `${columna} = ?`).join(', ')}, evidencia_tipo = ? WHERE id = ?`,
      [...columnas.map((columna) => datos[columna]), evidenciaTipo({ evidencia_url: enlace, cantidadArchivos: Number(cantidad) }), id]
    );
    return [200, { success: true, data: await leerHito(conexion, id), message: 'Hito actualizado' }];
  });
});

// DELETE /gestion/hitos/:id (también un logro): borra las filas del hito y de sus archivos, en una transacción. 404 si no existe
// o es de un proyecto dado de baja. Todavía no borra los archivos del disco
export const deleteHito = (req, res) => responder(res, 'Error al eliminar hito', async () => {
  const id = idPositivo(req.params.id);
  if (id === null) return rechazo(404, HITO_NO_ENCONTRADO);
  return enTransaccion(async (conexion) => {
    if (!(await hitoVigente(conexion, id))) return rechazo(404, HITO_NO_ENCONTRADO);
    await conexion.query('DELETE FROM hito_archivos WHERE hito_id = ?', [id]);
    await conexion.query('DELETE FROM proyecto_hitos WHERE id = ?', [id]);
    return [200, { success: true, message: 'Hito eliminado' }];
  });
});
