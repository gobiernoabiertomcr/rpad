/**
 * El aviso diario de la agenda (spec 2026-11-04-agenda-aviso-y-dependencia, 5 y 6): las consultas, de solo lectura y parametrizadas.
 * `conexion`: el pool, o la de una transacción.
 */
import pool from '../config/database.js';

/**
 * Todos los usuarios, también los desactivados (la cadena los salta sin cortarse): `[{ id, nombre_completo, email, activo, depende_de,
 * eventos_por_mail }]`, por id. `activo` y `eventos_por_mail`, booleanos.
 * @returns {Promise<object[]>}
 */
export const usuariosDelAviso = async (conexion = pool) => {
  const [filas] = await conexion.query(
    'SELECT id, nombre_completo, email, activo, depende_de, eventos_por_mail FROM usuarios ORDER BY id'
  );
  return filas.map((fila) => ({
    id: Number(fila.id),
    nombre_completo: fila.nombre_completo,
    email: fila.email,
    activo: Number(fila.activo) === 1,
    depende_de: fila.depende_de === null ? null : Number(fila.depende_de),
    eventos_por_mail: Number(fila.eventos_por_mail) === 1
  }));
};
