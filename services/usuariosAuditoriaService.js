// Historial de cambios sobre usuarios (spec 9)
import pool from '../config/database.js';

/**
 * Registra una acción. conexion: el pool o la conexión con la transacción del cambio abierta.
 * detalle: objeto (se guarda como JSON) o null.
 */
export const registrarAuditoria = async (conexion, { usuarioId, actorId = null, accion, detalle = null }) => {
  await (conexion ?? pool).execute(
    'INSERT INTO usuarios_auditoria (usuario_id, actor_id, accion, detalle) VALUES (?, ?, ?, ?)',
    [usuarioId, actorId, accion, detalle === null ? null : JSON.stringify(detalle)]
  );
};

// Historial de un usuario, del más reciente al más viejo, con el nombre de quien hizo cada cambio
export const historialDe = async (usuarioId) => {
  const [filas] = await pool.execute(
    `SELECT a.id, a.accion, a.detalle, a.created_at, a.actor_id,
            ac.nombre_completo AS actor_nombre, ac.username AS actor_username
     FROM usuarios_auditoria a
     LEFT JOIN usuarios ac ON ac.id = a.actor_id
     WHERE a.usuario_id = ?
     ORDER BY a.created_at DESC, a.id DESC`,
    [usuarioId]
  );
  return filas.map(f => ({ ...f, detalle: typeof f.detalle === 'string' ? JSON.parse(f.detalle) : f.detalle }));
};
