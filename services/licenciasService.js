// Lecturas de licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, sección 5). Las fechas salen como texto
// 'AAAA-MM-DD' (y autorizado_at como 'AAAA-MM-DD HH:MM:SS', en hora de Argentina, como se guardó).
import pool from '../config/database.js';

const COLUMNAS = `l.id, l.usuario_id, DATE_FORMAT(l.desde, '%Y-%m-%d') AS desde, DATE_FORMAT(l.hasta, '%Y-%m-%d') AS hasta,
  l.autorizado_id, DATE_FORMAT(l.autorizado_at, '%Y-%m-%d %H:%i:%s') AS autorizado_at, l.nota_autorizacion_id, l.anulada`;

// Licencia no anulada del usuario que incluye la fecha, o null. conexion: el pool o una conexión con transacción.
export const licenciaEnFecha = async (usuarioId, fecha, conexion = pool) => {
  const [filas] = await conexion.query(
    `SELECT ${COLUMNAS} FROM usuarios_licencias l
     WHERE l.usuario_id = ? AND l.anulada = 0 AND l.desde <= ? AND l.hasta >= ?
     ORDER BY l.desde LIMIT 1`,
    [usuarioId, fecha, fecha]
  );
  return filas[0] ?? null;
};

// Primera licencia no anulada del usuario que empieza después de la fecha, o null
export const proximaLicencia = async (usuarioId, fecha) => {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS} FROM usuarios_licencias l
     WHERE l.usuario_id = ? AND l.anulada = 0 AND l.desde > ?
     ORDER BY l.desde LIMIT 1`,
    [usuarioId, fecha]
  );
  return filas[0] ?? null;
};
