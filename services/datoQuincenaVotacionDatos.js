/**
 * La votación de la principal del equipo (spec 2026-11-23-dato-quincena-principal-votacion, 1, 3 y 6): las consultas de sus tablas,
 * parametrizadas. Las reglas y los textos están en `services/datoQuincenaVotacionReglas.js`.
 *
 * Que una edición tenga su fila en dato_quincena_votaciones es lo que dice que se vota: la crea `guardarEdicion`, en la transacción
 * del POST de Datito, con la foto de quienes votan. Los votos son una fila por cada orden guardado, nunca un UPDATE ni un DELETE.
 * Las horas se escriben con `ahoraArgentina()` (nunca NOW()) y se leen como texto 'AAAA-MM-DD HH:MM:SS' (DATE_FORMAT: el pool no
 * tiene `dateStrings`); la llegada, como segundos UNIX (UNIX_TIMESTAMP: recibida_at es un TIMESTAMP, en UTC).
 */
import pool from '../config/database.js';
import { esAdmin, emailValido } from './usuariosReglas.js';

// Una hora DATETIME como texto, o null
const horaComoTexto = (columna) => `DATE_FORMAT(${columna}, '%Y-%m-%d %H:%i:%s')`;

/**
 * La votación de una edición recién guardada (sección 3, «Al llegar la edición»), en la conexión de su transacción: la fila de
 * dato_quincena_votaciones (`creada_at` = `ahora`, 'AAAA-MM-DD HH:MM:SS' de ahoraArgentina) y la foto de la lista de quienes votan
 * en dato_quincena_votacion_personas, solo las personas activas, por nombre (el orden de la foto es el de sus ids). Regular o piloto,
 * igual; con la lista vacía, la votación existe igual, sin nadie. Si algo falla, tira: la transacción no guarda la edición.
 */
export const crearLaVotacion = async (conexion, { edicionId, ahora }) => {
  await conexion.execute('INSERT INTO dato_quincena_votaciones (edicion_id, creada_at) VALUES (?, ?)', [edicionId, ahora]);
  await conexion.execute(
    `INSERT INTO dato_quincena_votacion_personas (edicion_id, usuario_id)
     SELECT ?, v.usuario_id
     FROM dato_quincena_votantes v
     JOIN usuarios u ON u.id = v.usuario_id
     WHERE u.activo = 1
     ORDER BY u.nombre_completo, u.id`,
    [edicionId]
  );
};

/**
 * Las votaciones de unas ediciones (sección 3: el detalle, la lista, el sellado y Mi espacio): un Map del id de la edición a
 * `{ tipo, fecha_edicion, recibida_ts, cierre_at, sellada_at, aviso, ordenes, personas, votos }`, solo de las que se votan (una de
 * antes no está en el Map). `ordenes`, los `orden` de sus propuestas, de menor a mayor; `personas`, la foto en su orden,
 * `[{ persona_id, usuario_id, nombre }]` (`usuario_id` y `nombre` null si la cuenta se borró: el nombre es su nombre_completo);
 * `votos`, todas las filas de sus votos por id, `[{ id, persona_id, orden, votado_at }]` (cuáles cuentan lo deciden las reglas).
 * A lo sumo cuatro consultas con `IN (?)`, sin una por edición; con la lista vacía, un Map vacío sin consultar. `conexion`: el pool o
 * la de una transacción.
 */
export const leerVotaciones = async (edicionIds, conexion = pool) => {
  const votaciones = new Map();
  if (!Array.isArray(edicionIds) || edicionIds.length === 0) return votaciones;
  const [filas] = await conexion.query(
    `SELECT v.edicion_id, e.tipo, DATE_FORMAT(e.fecha_edicion, '%Y-%m-%d') AS fecha_edicion,
            UNIX_TIMESTAMP(e.recibida_at) AS recibida_ts, ${horaComoTexto('v.cierre_at')} AS cierre_at,
            ${horaComoTexto('v.sellada_at')} AS sellada_at, v.aviso
     FROM dato_quincena_votaciones v
     JOIN dato_quincena_ediciones e ON e.id = v.edicion_id
     WHERE v.edicion_id IN (?)`,
    [edicionIds]
  );
  if (filas.length === 0) return votaciones;
  for (const fila of filas) {
    votaciones.set(Number(fila.edicion_id), {
      tipo: fila.tipo,
      fecha_edicion: fila.fecha_edicion,
      recibida_ts: fila.recibida_ts === null ? null : Number(fila.recibida_ts),
      cierre_at: fila.cierre_at ?? null,
      sellada_at: fila.sellada_at ?? null,
      aviso: fila.aviso ?? null,
      ordenes: [],
      personas: [],
      votos: []
    });
  }
  const ids = [...votaciones.keys()];
  const [[propuestas], [personas], [votos]] = await Promise.all([
    conexion.query('SELECT edicion_id, orden FROM dato_quincena_propuestas WHERE edicion_id IN (?) ORDER BY edicion_id, orden', [ids]),
    conexion.query(
      `SELECT p.id AS persona_id, p.edicion_id, p.usuario_id, u.nombre_completo AS nombre
       FROM dato_quincena_votacion_personas p
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.edicion_id IN (?)
       ORDER BY p.edicion_id, p.id`,
      [ids]
    ),
    conexion.query(
      `SELECT vo.id, vo.persona_id, vo.orden, ${horaComoTexto('vo.votado_at')} AS votado_at, p.edicion_id
       FROM dato_quincena_votos vo
       JOIN dato_quincena_votacion_personas p ON p.id = vo.persona_id
       WHERE p.edicion_id IN (?)
       ORDER BY vo.id`,
      [ids]
    )
  ]);
  for (const { edicion_id, orden } of propuestas) votaciones.get(Number(edicion_id)).ordenes.push(Number(orden));
  for (const { persona_id, edicion_id, usuario_id, nombre } of personas) {
    votaciones.get(Number(edicion_id)).personas.push({
      persona_id: Number(persona_id), usuario_id: usuario_id === null ? null : Number(usuario_id), nombre: nombre ?? null
    });
  }
  for (const { id, persona_id, orden, votado_at, edicion_id } of votos) {
    votaciones.get(Number(edicion_id)).votos.push({ id: Number(id), persona_id: Number(persona_id), orden, votado_at });
  }
  return votaciones;
};

/**
 * Guarda el orden de una persona (sección 3, «Votar»), en una transacción con la fila de la votación bloqueada (FOR UPDATE, con su
 * edición): dos votos a la vez de la misma edición esperan uno al otro, así no se cruzan, gana el último y el mismo no se repite. Las
 * demás lecturas van sin candado, a propósito, como iba la elección a mano de la principal del equipo: con LOCK IN SHARE MODE, dos
 * elecciones de ediciones distintas tomaban el mismo hueco de un índice y el INSERT de cada una esperaba al otro (un deadlock y un
 * 500). El FOR UPDATE ya ordena los de la misma edición, y la FK del INSERT toma sola el candado de la fila de la foto. Con el bloqueo
 * tomado, un SELECT común ve el último voto confirmado: la foto de la transacción nace en su primera lectura sin candado.
 * `orden` es el texto de ordenDelVoto ('2,1,4,3'), ya validado contra las propuestas; `estaCerrada({ cierre_at, fecha_edicion,
 * recibida_ts })` decide con la hora de ese momento si ya cerró (y puede tirar: no se escribe nada). Sin la votación,
 * `{ votacion: false }`; si la persona no está en la foto, `persona: false`; si cerró, `cerrada: true`; si el orden ya es el de su
 * último voto, `cambio: false` sin escribir; si no, inserta una fila con `votado_at` = `ahora` ('AAAA-MM-DD HH:MM:SS' de
 * ahoraArgentina). Resuelve siempre `{ votacion, persona, cerrada, cambio }`; un error de la base, tira. La conexión se devuelve siempre.
 */
export const guardarVoto = async ({ edicionId, usuarioId, orden, ahora, estaCerrada }) => {
  const resultado = (votacion, persona, cerrada, cambio) => ({ votacion, persona, cerrada, cambio });
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    try {
      const [[fila]] = await conexion.execute(
        `SELECT ${horaComoTexto('v.cierre_at')} AS cierre_at, DATE_FORMAT(e.fecha_edicion, '%Y-%m-%d') AS fecha_edicion,
                UNIX_TIMESTAMP(e.recibida_at) AS recibida_ts
         FROM dato_quincena_votaciones v
         JOIN dato_quincena_ediciones e ON e.id = v.edicion_id
         WHERE v.edicion_id = ?
         FOR UPDATE`,
        [edicionId]
      );
      if (!fila) {
        await conexion.rollback();
        return resultado(false, false, false, false);
      }
      const [[persona]] = await conexion.execute(
        'SELECT id FROM dato_quincena_votacion_personas WHERE edicion_id = ? AND usuario_id = ?', [edicionId, usuarioId]
      );
      if (!persona) {
        await conexion.rollback();
        return resultado(true, false, false, false);
      }
      const leida = {
        cierre_at: fila.cierre_at ?? null,
        fecha_edicion: fila.fecha_edicion,
        recibida_ts: fila.recibida_ts === null ? null : Number(fila.recibida_ts)
      };
      if (estaCerrada(leida)) {
        await conexion.rollback();
        return resultado(true, true, true, false);
      }
      const [[ultimo]] = await conexion.execute(
        'SELECT orden FROM dato_quincena_votos WHERE persona_id = ? ORDER BY id DESC LIMIT 1', [persona.id]
      );
      if (ultimo && ultimo.orden === orden) {
        await conexion.commit();
        return resultado(true, true, false, false);
      }
      await conexion.execute(
        'INSERT INTO dato_quincena_votos (persona_id, orden, votado_at) VALUES (?, ?, ?)', [persona.id, orden, ahora]
      );
      await conexion.commit();
      return resultado(true, true, false, true);
    } catch (error) {
      await conexion.rollback().catch(() => {});
      throw error;
    }
  } finally {
    conexion.release();
  }
};

// ---------------------------------------------------------------------------------------------------------------------------
// El sellado y el aviso del resultado (sección 6): las consultas del paso de las corridas (services/datoQuincenaVotacion.js) y la de
// Correos → Estado. Ninguna toma la fila de la edición: el voto (guardarVoto) bloquea la votación y su edición, en ese orden, y el
// sellado solo escribe la fila de la votación (abajo), así nunca se esperan en círculo.
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * Las votaciones sin sellar, con lo que hace falta para calcular su cierre (`estadoDeLaVotacionLeida`), sin candado:
 * `[{ edicion_id, tipo, fecha_edicion, recibida_ts }]`, de la edición más vieja a la más nueva. Lo demás (la foto y los votos), con
 * leerVotaciones, solo de las que ya toca sellar.
 */
export const votacionesSinSellar = async (conexion = pool) => {
  const [filas] = await conexion.query(
    `SELECT v.edicion_id, e.tipo, DATE_FORMAT(e.fecha_edicion, '%Y-%m-%d') AS fecha_edicion,
            UNIX_TIMESTAMP(e.recibida_at) AS recibida_ts
     FROM dato_quincena_votaciones v
     JOIN dato_quincena_ediciones e ON e.id = v.edicion_id
     WHERE v.sellada_at IS NULL
     ORDER BY e.fecha_edicion, v.edicion_id`
  );
  return filas.map((fila) => ({
    edicion_id: Number(fila.edicion_id),
    tipo: fila.tipo,
    fecha_edicion: fila.fecha_edicion,
    recibida_ts: fila.recibida_ts === null ? null : Number(fila.recibida_ts)
  }));
};

/**
 * Sella una votación: guarda su cierre (`cierre`, 'AAAA-MM-DD HH:MM:SS') y el momento (`ahora`, de ahoraArgentina), solo si nadie la
 * selló antes. Es la reserva del mail del resultado, como reservarEnvio en el correo: dos corridas que la leyeron sin sellar no la sellan
 * las dos, porque el UPDATE condicionado espera el candado de la fila y, al tomarlo, vuelve a mirar `sellada_at`. true solo si la selló
 * este llamado (`affectedRows` 1). Un solo UPDATE, sin transacción y sin tocar la edición: el FOR UPDATE de guardarVoto toma la votación
 * y su edición, y este toma solo la votación (la clave foránea no cambia, así que no mira la edición), así que a lo sumo uno espera al
 * otro y nunca se esperan en círculo. Un voto que espera al sellado la encuentra sellada y cerrada.
 */
export const sellarLaVotacion = async ({ edicionId, cierre, ahora }, conexion = pool) => {
  const [resultado] = await conexion.execute(
    'UPDATE dato_quincena_votaciones SET cierre_at = ?, sellada_at = ? WHERE edicion_id = ? AND sellada_at IS NULL',
    [cierre, ahora, edicionId]
  );
  return resultado.affectedRows === 1;
};

/**
 * Anota cómo salió el aviso del resultado de una votación sellada (`aviso`: 'enviado', 'parcial', 'fallido', 'apagado' o
 * 'no_corresponde') y cuándo (`ahora`), una sola vez: un aviso anotado no cambia.
 */
export const anotarElAviso = async ({ edicionId, aviso, ahora }, conexion = pool) => {
  await conexion.execute(
    'UPDATE dato_quincena_votaciones SET aviso = ?, aviso_at = ? WHERE edicion_id = ? AND sellada_at IS NOT NULL AND aviso IS NULL',
    [aviso, ahora, edicionId]
  );
};

/**
 * A quiénes les llega el mail del resultado: las personas activas de administración (esAdmin: superadmin, admin y editor) con un email
 * válido, `[{ id, nombre_completo, email }]`, por nombre. Quién está de licencia ese día lo saca el paso (deLicenciaOficial).
 */
export const administracionParaElAviso = async (conexion = pool) => {
  const [filas] = await conexion.query(
    'SELECT id, nombre_completo, email, rol FROM usuarios WHERE activo = 1 ORDER BY nombre_completo, id'
  );
  return filas
    .filter((fila) => esAdmin(fila.rol) && emailValido(fila.email))
    .map((fila) => ({ id: Number(fila.id), nombre_completo: fila.nombre_completo, email: fila.email }));
};

/**
 * Para Correos → Estado: la última votación de una edición regular sellada desde `desde` ('AAAA-MM-DD HH:MM:SS'), `{ fecha_edicion,
 * aviso }`, o null si no hay ninguna.
 */
export const ultimaVotacionSellada = async ({ desde }, conexion = pool) => {
  const [[fila]] = await conexion.query(
    `SELECT DATE_FORMAT(e.fecha_edicion, '%Y-%m-%d') AS fecha_edicion, v.aviso
     FROM dato_quincena_votaciones v
     JOIN dato_quincena_ediciones e ON e.id = v.edicion_id
     WHERE e.tipo = 'regular' AND v.sellada_at IS NOT NULL AND v.sellada_at >= ?
     ORDER BY v.sellada_at DESC, v.edicion_id DESC
     LIMIT 1`,
    [desde]
  );
  return fila ? { fecha_edicion: fila.fecha_edicion, aviso: fila.aviso ?? null } : null;
};

/**
 * Las votaciones abiertas en las que está una persona (sección 5, Mi espacio): los ids de las ediciones sin sellar en cuya foto de
 * quienes votan está `usuarioId`, de la más vieja a la más nueva. Si ya votó, si cerró por el calendario o si el cierre cae en el
 * rango lo deciden las reglas (`itemsDeLaVotacionEnMiEspacio`), con `leerVotaciones`.
 */
export const votacionesAbiertasDe = async (usuarioId, conexion = pool) => {
  const [filas] = await conexion.query(
    `SELECT v.edicion_id
     FROM dato_quincena_votaciones v
     JOIN dato_quincena_votacion_personas p ON p.edicion_id = v.edicion_id
     JOIN dato_quincena_ediciones e ON e.id = v.edicion_id
     WHERE v.sellada_at IS NULL AND p.usuario_id = ?
     ORDER BY e.fecha_edicion, v.edicion_id`,
    [usuarioId]
  );
  return filas.map((fila) => Number(fila.edicion_id));
};
