/**
 * La agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, secciones 2, 3 y 7): las consultas de los eventos, con quién
 * ve cada uno, de solo lectura y parametrizadas. Un evento lo ve quien lo creó, las personas elegidas (una fila suya en
 * `mi_espacio_evento_personas`) y, si es para todos, la administración (`esAdmin`, con el rol de la base: quien pide ya está
 * activo, lo controla authMiddleware). Solo los activos (`activo = 1`): uno dado de baja no existe para nadie.
 *
 * Un `Evento` es `{ id, creado_por, creador, titulo, detalle, fecha, desde, hasta, compartido, para_todos, recordatorio,
 * personas }`:
 * - `creado_por`, el id de quien lo creó (null si la cuenta se borró: la clave es ON DELETE SET NULL), y `creador`, su
 *   nombre (también si está desactivada: el evento sigue para los invitados);
 * - `fecha` 'AAAA-MM-DD' (DATE_FORMAT) y `desde` y `hasta` 'HH:MM' (TIME_FORMAT: el pool no tiene `dateStrings`, y un TIME
 *   crudo, '10:00:00', deja el aviso en null), `hasta` null sin hora de fin; `detalle` null si no tiene;
 * - `compartido` y `para_todos`, booleanos; `recordatorio`, el del enum;
 * - `personas`: `[{ id, nombre, sin_recordatorio }]`, todas sus filas, por nombre (también las de cuentas desactivadas o que
 *   dejaron de ser administración: siguen en el evento). Con «Todos», las filas son solo las de quienes apagaron su
 *   recordatorio; sin compartir, ninguna.
 * Así el evento de antes de un cambio, leído de acá, tiene la misma forma que el validado (`validarEvento`): cambioQueAvisa
 * los compara con `!==`.
 *
 * Sin consultas N+1: los eventos en una consulta y las personas de todos en otra. `conexion`: el pool, o la de una
 * transacción (lee lo que ella ve). Con `{ bloquear: true }` (en una transacción), la fila del evento queda bloqueada hasta
 * el final (`SELECT … FOR UPDATE`, sola y antes de leerlo: con REPEATABLE READ, la primera lectura común fija lo que ve la
 * transacción, y así es posterior al bloqueo): un cambio de quien lo creó y el recordatorio de una invitada se ordenan.
 */
import pool from '../config/database.js';
import { ROLES_QUE_COMPARTEN, inicialesDe } from './miEspacioEventosReglas.js';
import { idPositivo } from './proyectosReglas.js';
import { esAdmin } from './usuariosReglas.js';
import { esFechaIso } from './notasDigitalesCalendario.js';

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const esSi = (valor) => valor === true || valor === 1;

const COLUMNAS_EVENTO = `e.id, e.creado_por, c.nombre_completo AS creador, e.titulo, e.detalle,
  DATE_FORMAT(e.fecha, '%Y-%m-%d') AS fecha, TIME_FORMAT(e.desde, '%H:%i') AS desde, TIME_FORMAT(e.hasta, '%H:%i') AS hasta,
  e.compartido, e.para_todos, e.recordatorio`;

// Los que ve una persona (dos parámetros: su id, dos veces): los que creó y los compartidos sin «Todos» con una fila suya; a
// administración, también los «para todos»
const ELEGIDA = `(e.compartido = 1 AND e.para_todos = 0 AND EXISTS (
    SELECT 1 FROM mi_espacio_evento_personas p WHERE p.evento_id = e.id AND p.usuario_id = ?))`;
const VISIBLES = `(e.creado_por = ? OR ${ELEGIDA})`;
const VISIBLES_CON_TODOS = `(e.creado_por = ? OR ${ELEGIDA} OR (e.compartido = 1 AND e.para_todos = 1))`;
const visiblesPara = (rol) => (esAdmin(rol) ? VISIBLES_CON_TODOS : VISIBLES);

// Las personas de varios eventos, en una consulta: un Map de cada id a sus filas, por nombre
const personasDe = async (eventoIds, conexion) => {
  const porEvento = new Map(eventoIds.map((id) => [id, []]));
  if (eventoIds.length === 0) return porEvento;
  const [filas] = await conexion.query(
    `SELECT p.evento_id, p.usuario_id, u.nombre_completo, p.sin_recordatorio
     FROM mi_espacio_evento_personas p JOIN usuarios u ON u.id = p.usuario_id
     WHERE p.evento_id IN (?)
     ORDER BY p.evento_id, u.nombre_completo, p.usuario_id`,
    [eventoIds]
  );
  for (const fila of filas) {
    porEvento.get(Number(fila.evento_id))?.push({
      id: Number(fila.usuario_id), nombre: fila.nombre_completo, sin_recordatorio: Number(fila.sin_recordatorio) === 1
    });
  }
  return porEvento;
};

// Los eventos activos que cumplen la condición (con sus parámetros), por fecha, hora y título, cada uno con sus personas
const leerEventos = async (condicion, valores, conexion) => {
  const [filas] = await conexion.query(
    `SELECT ${COLUMNAS_EVENTO}
     FROM mi_espacio_eventos e LEFT JOIN usuarios c ON c.id = e.creado_por
     WHERE e.activo = 1 AND ${condicion}
     ORDER BY e.fecha, e.desde, e.titulo, e.id`,
    valores
  );
  const personas = await personasDe(filas.map((fila) => Number(fila.id)), conexion);
  return filas.map((fila) => ({
    id: Number(fila.id),
    creado_por: fila.creado_por === null ? null : Number(fila.creado_por),
    creador: fila.creador ?? null,
    titulo: fila.titulo,
    detalle: fila.detalle ?? null,
    fecha: fila.fecha,
    desde: fila.desde,
    hasta: fila.hasta ?? null,
    compartido: Number(fila.compartido) === 1,
    para_todos: Number(fila.para_todos) === 1,
    recordatorio: fila.recordatorio,
    personas: personas.get(Number(fila.id))
  }));
};

// Bloquea la fila de un evento hasta el final de la transacción (sola, antes de leerlo: ver la cabecera); false si no existe
const bloquearEvento = async (id, conexion) => {
  const [filas] = await conexion.query('SELECT id FROM mi_espacio_eventos WHERE id = ? FOR UPDATE', [id]);
  return filas.length > 0;
};

/**
 * Los eventos que ve una persona (`{ id, rol }`) de desde a hasta ('AAAA-MM-DD', los dos incluidos), por fecha, hora y
 * título. Sin un id o un rango que sirvan, [] (sin consultar).
 * @returns {Promise<object[]>}
 */
export const eventosVisibles = async (usuario, desde, hasta, conexion = pool) => {
  const id = idPositivo(usuario?.id);
  if (id === null || !esFechaIso(desde) || !esFechaIso(hasta) || hasta < desde) return [];
  return leerEventos(`e.fecha BETWEEN ? AND ? AND ${visiblesPara(usuario.rol)}`, [desde, hasta, id, id], conexion);
};

/**
 * Un evento activo que ve la persona (`{ id, rol }`), o null (un id que no sirve, que no existe, dado de baja o que no ve):
 * para «mi recordatorio».
 * @returns {Promise<object | null>}
 */
export const eventoVisible = async (id, usuario, conexion = pool, { bloquear = false } = {}) => {
  const eventoId = idPositivo(id);
  const usuarioId = idPositivo(usuario?.id);
  if (eventoId === null || usuarioId === null) return null;
  if (bloquear && !(await bloquearEvento(eventoId, conexion))) return null;
  const [evento] = await leerEventos(`e.id = ? AND ${visiblesPara(usuario.rol)}`, [eventoId, usuarioId, usuarioId], conexion);
  return evento ?? null;
};

/**
 * Un evento activo que creó la persona, o null (un id que no sirve, que no existe, dado de baja o de otra persona): lo que
 * se puede cambiar y borrar.
 * @returns {Promise<object | null>}
 */
export const eventoPropio = async (id, usuarioId, conexion = pool, { bloquear = false } = {}) => {
  const eventoId = idPositivo(id);
  const creador = idPositivo(usuarioId);
  if (eventoId === null || creador === null) return null;
  if (bloquear && !(await bloquearEvento(eventoId, conexion))) return null;
  const [evento] = await leerEventos('e.id = ? AND e.creado_por = ?', [eventoId, creador], conexion);
  return evento ?? null;
};

/**
 * A quiénes les llegan los emails de un evento (`{ id, creado_por, compartido, para_todos }`, el de eventoPropio o el
 * guardado): `[{ id, nombre, email, sin_recordatorio }]`, por nombre, sin quien lo creó y solo las cuentas activas. Con
 * «Todos», la administración activa (ROLES_QUE_COMPARTEN), cada una con lo que dice su fila (sin fila, con recordatorio);
 * con personas, las de sus filas (cualquiera sea su rol de hoy: siguen en el evento); sin compartir, ninguna. Lee las filas
 * de la base: después de guardar, ya son las nuevas. `compartido` y `para_todos`, booleanos o el 1 de un tinyint. Sin un
 * evento que sirva, [] (sin consultar).
 * @returns {Promise<object[]>}
 */
export const audienciaDe = async (evento, conexion = pool) => {
  const id = esObjeto(evento) ? idPositivo(evento.id) : null;
  if (id === null || !esSi(evento.compartido)) return [];
  const creador = idPositivo(evento.creado_por) ?? 0;
  const [filas] = esSi(evento.para_todos)
    ? await conexion.query(
      `SELECT u.id, u.nombre_completo, u.email, COALESCE(p.sin_recordatorio, 0) AS sin_recordatorio
       FROM usuarios u LEFT JOIN mi_espacio_evento_personas p ON p.usuario_id = u.id AND p.evento_id = ?
       WHERE u.activo = 1 AND u.rol IN (?) AND u.id <> ?
       ORDER BY u.nombre_completo, u.id`,
      [id, ROLES_QUE_COMPARTEN, creador]
    )
    : await conexion.query(
      `SELECT u.id, u.nombre_completo, u.email, p.sin_recordatorio
       FROM mi_espacio_evento_personas p JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.evento_id = ? AND u.activo = 1 AND u.id <> ?
       ORDER BY u.nombre_completo, u.id`,
      [id, creador]
    );
  return filas.map((fila) => ({
    id: Number(fila.id), nombre: fila.nombre_completo, email: fila.email,
    sin_recordatorio: Number(fila.sin_recordatorio) === 1
  }));
};

/**
 * Las personas con quienes se puede compartir un evento: la administración activa (ROLES_QUE_COMPARTEN), por nombre, sin
 * `excluirId` (quien pide). Solo el id, el nombre y las iniciales: ni el email ni el rol.
 * @returns {Promise<{ id: number, nombre: string, iniciales: string }[]>}
 */
export const personasParaCompartir = async (excluirId, conexion = pool) => {
  const [filas] = await conexion.query(
    `SELECT id, nombre_completo FROM usuarios
     WHERE activo = 1 AND rol IN (?) AND id <> ?
     ORDER BY nombre_completo, id`,
    [ROLES_QUE_COMPARTEN, idPositivo(excluirId) ?? 0]
  );
  return filas.map((fila) => ({ id: Number(fila.id), nombre: fila.nombre_completo, iniciales: inicialesDe(fila.nombre_completo) }));
};
