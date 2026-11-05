/**
 * El aviso diario de la agenda (spec 2026-11-04-agenda-aviso-y-dependencia, 5 y 6): las consultas, de solo lectura y parametrizadas.
 * `conexion`: el pool, o la de una transacción.
 */
import pool from '../config/database.js';
import { esFechaIso } from './notasDigitalesCalendario.js';
import { personasDe, vistasDe } from './miEspacioEventosDatos.js';
import { claveDeInformado } from './miEspacioEventosDiarioReglas.js';

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

/**
 * Los eventos activos de desde a hasta ('AAAA-MM-DD', los dos incluidos), por fecha, hora e id, con sus personas y sus vistas, en lote: tres
 * consultas para todos, sin N+1. La forma que recibe `mailDeLaPersona`. Las fechas y las horas, como texto (DATE_FORMAT y TIME_FORMAT: el pool
 * no tiene `dateStrings`, y un Date crudo no coincidiría nunca con lo informado, y repetiría el mail cada día). Trae el título y el detalle
 * también de un Público: es `mailDeLaPersona` la que no los lee para quien no lo creó. Sin un rango que sirva, [].
 * @returns {Promise<object[]>}
 */
export const eventosDelAviso = async (desde, hasta, conexion = pool) => {
  if (!esFechaIso(desde) || !esFechaIso(hasta) || hasta < desde) return [];
  const [filas] = await conexion.query(
    `SELECT e.id, e.creado_por, c.nombre_completo AS creador, c.activo AS creador_activo, e.titulo, e.detalle,
       DATE_FORMAT(e.fecha, '%Y-%m-%d') AS fecha, TIME_FORMAT(e.desde, '%H:%i') AS desde, TIME_FORMAT(e.hasta, '%H:%i') AS hasta,
       e.compartido, e.para_todos, e.publico, e.publico_todos, e.texto_publico, e.recordatorio,
       DATE_FORMAT(e.publicado_at, '%Y-%m-%d %H:%i:%s') AS publicado_at
     FROM mi_espacio_eventos e LEFT JOIN usuarios c ON c.id = e.creado_por
     WHERE e.activo = 1 AND e.fecha BETWEEN ? AND ?
     ORDER BY e.fecha, e.desde, e.id`,
    [desde, hasta]
  );
  const ids = filas.map((fila) => Number(fila.id));
  const [personas, vistas] = await Promise.all([personasDe(ids, conexion), vistasDe(ids, conexion)]);
  return filas.map((fila) => ({
    id: Number(fila.id),
    creado_por: fila.creado_por === null ? null : Number(fila.creado_por),
    creador: fila.creador ?? null,
    creador_activo: Number(fila.creador_activo) === 1,
    titulo: fila.titulo,
    detalle: fila.detalle ?? null,
    fecha: fila.fecha,
    desde: fila.desde,
    hasta: fila.hasta ?? null,
    compartido: Number(fila.compartido) === 1,
    para_todos: Number(fila.para_todos) === 1,
    publico: Number(fila.publico) === 1,
    publico_todos: Number(fila.publico_todos) === 1,
    texto_publico: fila.texto_publico ?? null,
    recordatorio: fila.recordatorio,
    publicado_at: fila.publicado_at ?? null,
    personas: personas.get(Number(fila.id)),
    vistas: vistas.get(Number(fila.id))
  }));
};

/**
 * Lo ya informado de esos eventos: un Set de `claveDeInformado`, con la fecha como texto. Sin ids, vacío (sin consultar).
 * @returns {Promise<Set<string>>}
 */
export const informadosDe = async (eventoIds, conexion = pool) => {
  if (!Array.isArray(eventoIds) || eventoIds.length === 0) return new Set();
  const [filas] = await conexion.query(
    "SELECT evento_id, usuario_id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha FROM mi_espacio_evento_informados WHERE evento_id IN (?)",
    [eventoIds]
  );
  return new Set(filas.map((fila) => claveDeInformado(Number(fila.evento_id), Number(fila.usuario_id), fila.fecha)));
};

/**
 * Quienes están de licencia oficial ese día: un Set de ids. Es la regla de «no recibe emails durante una licencia» (`usuarios_licencias`,
 * sin anular). Lo cargado en Mi espacio no cuenta (spec 2026-11-04-agenda-aviso-y-dependencia, 5.2): por eso no se usa `ausentesEn`.
 * @returns {Promise<Set<number>>}
 */
export const deLicenciaOficial = async (dia, conexion = pool) => {
  const [filas] = await conexion.query(
    'SELECT DISTINCT usuario_id FROM usuarios_licencias WHERE anulada = 0 AND desde <= ? AND hasta >= ?',
    [dia, dia]
  );
  return new Set(filas.map((fila) => Number(fila.usuario_id)));
};

/** Anota lo que se le informó a una persona (`informa`: `[{ evento_id, fecha }]`); lo que ya estaba, se saltea. */
export const marcarInformados = async (usuarioId, informa, ahora, conexion = pool) => {
  if (!Array.isArray(informa) || informa.length === 0) return;
  await conexion.query(
    'INSERT IGNORE INTO mi_espacio_evento_informados (evento_id, usuario_id, fecha, informado_at) VALUES ?',
    [informa.map(({ evento_id: eventoId, fecha }) => [eventoId, usuarioId, fecha, ahora])]
  );
};
