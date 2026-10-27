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
 * Para lo demás de la agenda, las licencias de Mi espacio de quien la mira (`licenciasPropiasEntre`); los compañeros que no
 * están y los feriados se leen con lo de la entrega 2 y de la entrega 1 (`ausentesPara` y `filasDeFeriados`).
 *
 * Para la corrida de los recordatorios, los eventos de los próximos días con sus destinatarios y sus envíos
 * (`eventosParaLaCorrida`), en lote.
 *
 * Sin consultas N+1: los eventos en una consulta y las personas de todos en otra. `conexion`: el pool, o la de una
 * transacción (lee lo que ella ve). Con `{ bloquear: true }` (en una transacción), la fila del evento queda bloqueada hasta
 * el final (`SELECT … FOR UPDATE`, sola y antes de leerlo: con REPEATABLE READ, la primera lectura común fija lo que ve la
 * transacción, y así es posterior al bloqueo): un cambio de quien lo creó y el recordatorio de una invitada se ordenan.
 */
import pool from '../config/database.js';
import { ROLES_QUE_COMPARTEN, VENTANA_DE_LA_CORRIDA, inicialesDe } from './miEspacioEventosReglas.js';
import { idPositivo } from './proyectosReglas.js';
import { esAdmin } from './usuariosReglas.js';
import { esFechaIso, sumarDias } from './notasDigitalesCalendario.js';

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

// Los destinatarios de un evento en la corrida, armados con lo leído en lote (eventosParaLaCorrida): quien lo creó, si está
// activo, y su audiencia, con la regla de audienciaDe (atadas por un test). `activos`: un Map de cada id activo a
// `{ email, rol }`; `filas`: las del evento, `[{ usuario_id, email, activo, sin_recordatorio }]`
const destinatariosDe = (evento, activos, filas) => {
  const creador = evento.creado_por;
  const destinatarios = creador !== null && activos.has(creador)
    ? [{ usuario_id: creador, email: activos.get(creador).email, sin_recordatorio: false }]
    : [];
  if (!evento.compartido) return destinatarios;
  if (evento.para_todos) {
    // La administración activa, con lo que dice su fila (sin fila, con recordatorio)
    const apagados = new Set(filas.filter((fila) => fila.sin_recordatorio).map((fila) => fila.usuario_id));
    for (const [id, { email, rol }] of activos) {
      if (id !== creador && ROLES_QUE_COMPARTEN.includes(rol)) {
        destinatarios.push({ usuario_id: id, email, sin_recordatorio: apagados.has(id) });
      }
    }
  } else {
    // Las de sus filas, activas, cualquiera sea su rol de hoy
    for (const fila of filas) {
      if (fila.activo && fila.usuario_id !== creador) {
        destinatarios.push({ usuario_id: fila.usuario_id, email: fila.email, sin_recordatorio: fila.sin_recordatorio });
      }
    }
  }
  return destinatarios;
};

/**
 * Los eventos de la corrida de los recordatorios (spec, sección 5; services/miEspacioEventosCorrida.js): los activos con
 * recordatorio (no 'ninguno') de hoy a hoy + VENTANA_DE_LA_CORRIDA ('AAAA-MM-DD', los dos incluidos), por fecha, hora e id,
 * con la forma que recibe `recordatoriosQueTocan`: `{ id, creado_por, titulo, detalle, fecha, desde, hasta, recordatorio,
 * compartido, para_todos, destinatarios, envios }` (el título, el detalle y la hora de fin son los del email):
 * - `destinatarios`: `[{ usuario_id, email, sin_recordatorio }]`, quien lo creó (si está activo) primero y después su
 *   audiencia, la de `audienciaDe` (con «Todos», la administración activa; con personas, las de sus filas activas), sin
 *   repetidos y sin cuentas desactivadas;
 * - `envios`: solo los de tipo 'recordatorio' (una invitación guarda el mismo `para`), por persona: `[{ usuario_id, para,
 *   success, terminado }]`, con `para` 'AAAA-MM-DD HH:MM' (DATE_FORMAT, sin los segundos: igual a 'fecha desde'; si no, un
 *   recordatorio que falló no se reintentaría nunca) y `success` y `terminado` (`enviado_at` no es NULL) como números.
 * En lote, sin N+1 (riesgo 22): cuatro consultas para todos los eventos juntos (los eventos, las personas activas que hacen
 * falta, las filas de las personas y los envíos), nunca audienciaDe por evento. Sin un hoy válido, [] (sin consultar).
 * @returns {Promise<object[]>}
 */
export const eventosParaLaCorrida = async (hoy, conexion = pool) => {
  if (!esFechaIso(hoy)) return [];
  const [filas] = await conexion.query(
    `SELECT e.id, e.creado_por, e.titulo, e.detalle, DATE_FORMAT(e.fecha, '%Y-%m-%d') AS fecha,
       TIME_FORMAT(e.desde, '%H:%i') AS desde, TIME_FORMAT(e.hasta, '%H:%i') AS hasta, e.recordatorio, e.compartido, e.para_todos
     FROM mi_espacio_eventos e
     WHERE e.activo = 1 AND e.recordatorio <> 'ninguno' AND e.fecha BETWEEN ? AND ?
     ORDER BY e.fecha, e.desde, e.id`,
    [hoy, sumarDias(hoy, VENTANA_DE_LA_CORRIDA)]
  );
  if (filas.length === 0) return [];
  const eventos = filas.map((fila) => ({
    id: Number(fila.id),
    creado_por: fila.creado_por === null ? null : Number(fila.creado_por),
    titulo: fila.titulo,
    detalle: fila.detalle ?? null,
    fecha: fila.fecha,
    desde: fila.desde,
    hasta: fila.hasta ?? null,
    recordatorio: fila.recordatorio,
    compartido: Number(fila.compartido) === 1,
    para_todos: Number(fila.para_todos) === 1
  }));
  const ids = eventos.map((evento) => evento.id);
  const creadores = [...new Set(eventos.map((evento) => evento.creado_por).filter((id) => id !== null))];

  // Las cuentas activas que pueden recibir algo además de las filas: quienes los crearon y la administración (los «Todos»)
  const [usuarios] = await conexion.query(
    'SELECT id, email, rol FROM usuarios WHERE activo = 1 AND (id IN (?) OR rol IN (?)) ORDER BY id',
    [creadores.length > 0 ? creadores : [0], ROLES_QUE_COMPARTEN]
  );
  const activos = new Map(usuarios.map((fila) => [Number(fila.id), { email: fila.email, rol: fila.rol }]));
  const [personas] = await conexion.query(
    `SELECT p.evento_id, p.usuario_id, p.sin_recordatorio, u.email, u.activo
     FROM mi_espacio_evento_personas p JOIN usuarios u ON u.id = p.usuario_id
     WHERE p.evento_id IN (?)
     ORDER BY p.evento_id, p.usuario_id`,
    [ids]
  );
  const [envios] = await conexion.query(
    `SELECT evento_id, usuario_id, DATE_FORMAT(para, '%Y-%m-%d %H:%i') AS para, success, enviado_at IS NOT NULL AS terminado
     FROM mi_espacio_evento_envios
     WHERE tipo = 'recordatorio' AND evento_id IN (?)
     ORDER BY evento_id, usuario_id, id`,
    [ids]
  );

  const filasPorEvento = new Map(ids.map((id) => [id, []]));
  for (const fila of personas) {
    filasPorEvento.get(Number(fila.evento_id))?.push({
      usuario_id: Number(fila.usuario_id), email: fila.email, activo: Number(fila.activo) === 1,
      sin_recordatorio: Number(fila.sin_recordatorio) === 1
    });
  }
  const enviosPorEvento = new Map(ids.map((id) => [id, []]));
  for (const envio of envios) {
    enviosPorEvento.get(Number(envio.evento_id))?.push({
      usuario_id: Number(envio.usuario_id), para: envio.para, success: Number(envio.success), terminado: Number(envio.terminado)
    });
  }
  return eventos.map((evento) => ({
    ...evento,
    destinatarios: destinatariosDe(evento, activos, filasPorEvento.get(evento.id)),
    envios: enviosPorEvento.get(evento.id)
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

/**
 * Las licencias de Mi espacio activas de una persona que tocan el rango (desde y hasta 'AAAA-MM-DD', los dos incluidos), para
 * su agenda: `[{ id, tipo, desde, hasta, horas }]`, por fecha, enteras (su desde y su hasta, aunque pasen del rango). `horas`,
 * un número (el DECIMAL llega como '2.0'), o null en las que no son por horas. Ni la nota, ni «Mostrar», ni lo del paso a
 * Configuración: la agenda no los muestra. Sin un id o un rango que sirvan, [] (sin consultar).
 * @returns {Promise<{ id: number, tipo: string, desde: string, hasta: string, horas: number | null }[]>}
 */
export const licenciasPropiasEntre = async (usuarioId, desde, hasta, conexion = pool) => {
  const id = idPositivo(usuarioId);
  if (id === null || !esFechaIso(desde) || !esFechaIso(hasta) || hasta < desde) return [];
  const [filas] = await conexion.query(
    `SELECT id, tipo, DATE_FORMAT(desde, '%Y-%m-%d') AS desde, DATE_FORMAT(hasta, '%Y-%m-%d') AS hasta, horas
     FROM mi_espacio_licencias
     WHERE usuario_id = ? AND activo = 1 AND desde <= ? AND hasta >= ?
     ORDER BY desde, hasta, id`,
    [id, hasta, desde]
  );
  return filas.map((fila) => ({
    id: Number(fila.id), tipo: fila.tipo, desde: fila.desde, hasta: fila.hasta,
    horas: fila.horas === null ? null : Number(fila.horas)
  }));
};
