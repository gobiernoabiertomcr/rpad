/**
 * El correo del dato de la quincena (spec 2026-11-12-dato-quincena-correo, 5, 6, 7 y 12): las consultas de las cuatro tablas del
 * envío, parametrizadas. Las reglas y los textos están en `services/datoQuincenaCorreoReglas.js`.
 *
 * Las horas guardadas (DATETIME escritos con `ahoraArgentina()`) se leen como texto 'AAAA-MM-DD HH:MM:SS' con DATE_FORMAT: el
 * pool no tiene `dateStrings`, y las reglas toman por «sin hora» cualquier otra forma (un Date de mysql2). El interruptor se lee
 * como un booleano de verdad: las reglas lo dan por prendido solo con `true`, nunca con el 1 de la base.
 * Las lecturas de la lista y del detalle no traen las direcciones de correo (`email`): no las muestran. Las traen solo
 * `personasDelCorreo` (la configuración, que ve solo administración) y las de un envío (`armarElEnvio`, `personasPorMandar`,
 * `contactosDe` y `usuarioDeLaPrueba`), que las usan para mandar y no las devuelven.
 * Una lista en `IN (?)` va con `query` y solo si no está vacía.
 * `conexion`: el pool, o la de una transacción (lee lo que ella ve).
 */
import pool from '../config/database.js';
import { MAXIMO_DE_INTENTOS } from './datoQuincenaCorreoReglas.js';

/**
 * El envío automático (la fila 1 de dato_quincena_correo_config): `{ envioActivo }`, true solo si la fila existe y su
 * `envio_activo` es 1. Sin la fila, apagado: ante la duda no sale nada.
 */
export const leerConfig = async (conexion = pool) => {
  const [[fila]] = await conexion.query('SELECT envio_activo FROM dato_quincena_correo_config WHERE id = 1');
  return { envioActivo: fila !== undefined && Number(fila.envio_activo) === 1 };
};

const fechaONull = (valor) => valor ?? null;

// Una fila de dato_quincena_correos, con las horas en texto
const correoDeLaFila = (fila) => ({
  edicion_id: Number(fila.edicion_id),
  estado: fila.estado,
  motivo: fila.motivo ?? null,
  enviada_at: fechaONull(fila.enviada_at),
  creada_at: fechaONull(fila.creada_at),
  ultima_corrida_at: fechaONull(fila.ultima_corrida_at)
});

// Una fila de dato_quincena_envios sin la dirección, con las horas en texto
const envioDeLaFila = (fila) => ({
  id: Number(fila.id),
  edicion_id: Number(fila.edicion_id),
  usuario_id: Number(fila.usuario_id),
  tipo: fila.tipo,
  estado: fila.estado,
  intentos: Number(fila.intentos),
  enviado_at: fechaONull(fila.enviado_at),
  ultimo_intento_at: fechaONull(fila.ultimo_intento_at),
  error: fila.error ?? null
});

/**
 * El correo de una edición (su fila de dato_quincena_correos: `{ edicion_id, estado, motivo, enviada_at, creada_at,
 * ultima_corrida_at }`), o null si no tiene: un piloto, o una regular archivada antes de esta entrega.
 */
export const correoDe = async (edicionId, conexion = pool) => {
  const [[fila]] = await conexion.execute(
    `SELECT edicion_id, estado, motivo,
            DATE_FORMAT(enviada_at, '%Y-%m-%d %H:%i:%s') AS enviada_at,
            DATE_FORMAT(creada_at, '%Y-%m-%d %H:%i:%s') AS creada_at,
            DATE_FORMAT(ultima_corrida_at, '%Y-%m-%d %H:%i:%s') AS ultima_corrida_at
     FROM dato_quincena_correos WHERE edicion_id = ?`,
    [edicionId]
  );
  return fila === undefined ? null : correoDeLaFila(fila);
};

/**
 * Todas las filas de dato_quincena_envios de una edición (automáticas, reenvíos y pruebas, cada una con su `tipo`), por id:
 * `{ id, edicion_id, usuario_id, tipo, estado, intentos, enviado_at, ultimo_intento_at, error }`, sin la dirección. Las reglas
 * eligen las de cada tipo.
 */
export const enviosDe = async (edicionId, conexion = pool) => {
  const [filas] = await conexion.execute(
    `SELECT id, edicion_id, usuario_id, tipo, estado, intentos,
            DATE_FORMAT(enviado_at, '%Y-%m-%d %H:%i:%s') AS enviado_at,
            DATE_FORMAT(ultimo_intento_at, '%Y-%m-%d %H:%i:%s') AS ultimo_intento_at, error
     FROM dato_quincena_envios WHERE edicion_id = ? ORDER BY id`,
    [edicionId]
  );
  return filas.map(envioDeLaFila);
};

/**
 * El envío de varias ediciones, para la lista y el detalle (spec 6 y 12), con una consulta por tabla: un Map de cada id de `ids`
 * a `{ correo, envios, reenvios }`. `correo` es su fila de correoDe o null; `envios`, sus filas automáticas (las que hacen al
 * estado y a «Enviada a N de M»); `reenvios`, solo los reenvíos que salieron (`tipo` 'reenvio' y `estado` 'enviado': los que
 * pueden llevar a «Reenviada…» y hacen que a alguien le llegue). Las pruebas no cuentan para nada de eso y no se leen.
 */
export const correosDeLasEdiciones = async (ids, conexion = pool) => {
  const porEdicion = new Map(ids.map((id) => [id, { correo: null, envios: [], reenvios: [] }]));
  if (ids.length === 0) return porEdicion;
  const [correos] = await conexion.query(
    `SELECT edicion_id, estado, motivo,
            DATE_FORMAT(enviada_at, '%Y-%m-%d %H:%i:%s') AS enviada_at,
            DATE_FORMAT(creada_at, '%Y-%m-%d %H:%i:%s') AS creada_at,
            DATE_FORMAT(ultima_corrida_at, '%Y-%m-%d %H:%i:%s') AS ultima_corrida_at
     FROM dato_quincena_correos WHERE edicion_id IN (?)`,
    [ids]
  );
  for (const fila of correos) {
    const deLaEdicion = porEdicion.get(Number(fila.edicion_id));
    if (deLaEdicion) deLaEdicion.correo = correoDeLaFila(fila);
  }
  const [envios] = await conexion.query(
    `SELECT id, edicion_id, usuario_id, tipo, estado, intentos,
            DATE_FORMAT(enviado_at, '%Y-%m-%d %H:%i:%s') AS enviado_at,
            DATE_FORMAT(ultimo_intento_at, '%Y-%m-%d %H:%i:%s') AS ultimo_intento_at, error
     FROM dato_quincena_envios
     WHERE edicion_id IN (?) AND (tipo = 'automatico' OR (tipo = 'reenvio' AND estado = 'enviado'))
     ORDER BY edicion_id, id`,
    [ids]
  );
  for (const fila of envios) {
    const deLaEdicion = porEdicion.get(Number(fila.edicion_id));
    if (deLaEdicion) (fila.tipo === 'automatico' ? deLaEdicion.envios : deLaEdicion.reenvios).push(envioDeLaFila(fila));
  }
  return porEdicion;
};

/**
 * La lista de hoy (spec 9 y 6): `[{ usuario_id, nombre, agregado_at }]`, las personas de dato_quincena_destinatarios que siguen
 * activas, por usuario. Una persona desactivada queda en la tabla pero no está en la lista de hoy: no se le puede reenviar, así
 * que no cuenta para «Reenviada a toda la lista» (`reenvioATodaLaLista`). «Reenviar» (a todas y a quién se puede) y el diálogo de
 * la caja del correo usan esta misma lista.
 */
export const listaDeHoy = async (conexion = pool) => {
  const [filas] = await conexion.query(
    `SELECT d.usuario_id, u.nombre_completo AS nombre, DATE_FORMAT(d.agregado_at, '%Y-%m-%d %H:%i:%s') AS agregado_at
     FROM dato_quincena_destinatarios d
     JOIN usuarios u ON u.id = d.usuario_id
     WHERE u.activo = 1
     ORDER BY d.usuario_id`
  );
  return filas.map(({ usuario_id, nombre, agregado_at }) => ({
    usuario_id: Number(usuario_id), nombre, agregado_at: fechaONull(agregado_at)
  }));
};

// La corrida (spec 2026-11-12-dato-quincena-correo, 5 y 8; services/datoQuincenaCorreo.js). Las horas se escriben con
// `ahoraArgentina()` de la corrida, nunca NOW(). Que nadie lo reciba dos veces lo garantizan estas consultas, no el candado: cada
// persona se reserva con un UPDATE condicionado y solo se le manda si la reserva es de esta corrida (affectedRows === 1).

// Las filas automáticas de una edición que todavía se pueden mandar: pendientes o fallidas con intentos por delante (el tope,
// MAXIMO_DE_INTENTOS, va como parámetro: es el último `?` de cada consulta que lo usa)
const POR_MANDAR = "e.tipo = 'automatico' AND e.estado IN ('pendiente', 'fallido') AND e.intentos < ?";

/**
 * Las programadas que todavía no empezaron a salir (sin filas automáticas), las que decide `decidirCorrida`:
 * `[{ id, fecha_edicion }]`. Una que ya tiene filas sigue con sus reintentos y nunca pasa a no enviada.
 */
export const programadasSinEnvios = async (conexion = pool) => {
  const [filas] = await conexion.query(
    `SELECT c.edicion_id AS id, DATE_FORMAT(d.fecha_edicion, '%Y-%m-%d') AS fecha_edicion
     FROM dato_quincena_correos c
     JOIN dato_quincena_ediciones d ON d.id = c.edicion_id
     WHERE c.estado = 'programada' AND d.tipo = 'regular'
       AND NOT EXISTS (SELECT 1 FROM dato_quincena_envios e WHERE e.edicion_id = c.edicion_id AND e.tipo = 'automatico')
     ORDER BY d.fecha_edicion, c.edicion_id`
  );
  return filas.map(({ id, fecha_edicion }) => ({ id: Number(id), fecha_edicion }));
};

/**
 * Una programada que no sale (`motivo`: 'apagado', 'vieja' o 'mas_nueva'): pasa a no enviada solo si sigue programada y sin
 * filas automáticas. true si la cambió.
 */
export const marcarNoEnviada = async (edicionId, motivo, ahora, conexion = pool) => {
  const [cambio] = await conexion.query(
    `UPDATE dato_quincena_correos c SET c.estado = 'no_enviada', c.motivo = ?, c.ultima_corrida_at = ?
     WHERE c.edicion_id = ? AND c.estado = 'programada'
       AND NOT EXISTS (SELECT 1 FROM dato_quincena_envios e WHERE e.edicion_id = c.edicion_id AND e.tipo = 'automatico')`,
    [motivo, ahora, edicionId]
  );
  return cambio.affectedRows === 1;
};

/**
 * Arma el envío automático de una programada con la lista de ese momento (spec, 5): una fila por persona de
 * dato_quincena_destinatarios, con su email de ese momento y el estado que da `decidir({ usuario_id, email, activa })`
 * (`{ estado, error }`, el de `envioInicial`). Con la lista vacía, la edición queda no enviada, «sin_lista». Todo en una
 * transacción, con la fila del correo tomada: si ya no está programada o ya tiene filas (la armó otra corrida), no hace nada; y
 * si dos llegaran a insertar, la clave única de las automáticas frena a la segunda. Resuelve 'armada', 'sin_lista' o 'ya'.
 */
export const armarElEnvio = async (edicionId, { ahora, decidir }) => {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    try {
      const [[correo]] = await conexion.query(
        "SELECT estado FROM dato_quincena_correos WHERE edicion_id = ? AND estado = 'programada' FOR UPDATE", [edicionId]
      );
      const [[ya]] = await conexion.query(
        "SELECT COUNT(*) AS n FROM dato_quincena_envios WHERE edicion_id = ? AND tipo = 'automatico'", [edicionId]
      );
      if (correo === undefined || Number(ya.n) > 0) {
        await conexion.rollback();
        return 'ya';
      }
      const [personas] = await conexion.query(
        `SELECT u.id AS usuario_id, u.email, u.activo
         FROM dato_quincena_destinatarios d
         JOIN usuarios u ON u.id = d.usuario_id
         ORDER BY u.id`
      );
      if (personas.length === 0) {
        await conexion.query(
          `UPDATE dato_quincena_correos SET estado = 'no_enviada', motivo = 'sin_lista', ultima_corrida_at = ?
           WHERE edicion_id = ?`,
          [ahora, edicionId]
        );
        await conexion.commit();
        return 'sin_lista';
      }
      const filas = personas.map(({ usuario_id, email, activo }) => {
        const { estado, error } = decidir({ usuario_id: Number(usuario_id), email, activa: Number(activo) === 1 });
        return [edicionId, Number(usuario_id), email ?? '', 'automatico', estado, 0, error, ahora];
      });
      // `unico` es una columna generada: no va en el INSERT
      await conexion.query(
        'INSERT INTO dato_quincena_envios (edicion_id, usuario_id, email, tipo, estado, intentos, error, creado_at) VALUES ?',
        [filas]
      );
      await conexion.commit();
      return 'armada';
    } catch (error) {
      await conexion.rollback().catch(() => {});
      throw error;
    }
  } finally {
    conexion.release();
  }
};

/**
 * Las ediciones con filas automáticas abiertas (pendientes o en reintento), de la más vieja a la nueva: `[{ id, fecha_edicion,
 * estado }]`, con el estado guardado de su correo. Si siguen vigentes, la corrida les manda; si no, las cierra (Ruling 9).
 */
export const edicionesConEnviosAbiertos = async (conexion = pool) => {
  const [filas] = await conexion.query(
    `SELECT DISTINCT e.edicion_id AS id, DATE_FORMAT(d.fecha_edicion, '%Y-%m-%d') AS fecha_edicion, c.estado
     FROM dato_quincena_envios e
     JOIN dato_quincena_ediciones d ON d.id = e.edicion_id
     LEFT JOIN dato_quincena_correos c ON c.edicion_id = e.edicion_id
     WHERE ${POR_MANDAR}
     ORDER BY fecha_edicion, id`,
    [MAXIMO_DE_INTENTOS]
  );
  return filas.map(({ id, fecha_edicion, estado }) => ({ id: Number(id), fecha_edicion, estado: estado ?? null }));
};

/**
 * Las personas de una edición a las que todavía se les puede mandar, con lo de ese momento: `[{ id, usuario_id, nombre_completo,
 * email, activa }]` (el email y el nombre de hoy, de `usuarios`; `activa` un booleano), por fila.
 */
export const personasPorMandar = async (edicionId, conexion = pool) => {
  const [filas] = await conexion.query(
    `SELECT e.id, e.usuario_id, u.nombre_completo, u.email, u.activo
     FROM dato_quincena_envios e
     JOIN usuarios u ON u.id = e.usuario_id
     WHERE e.edicion_id = ? AND ${POR_MANDAR}
     ORDER BY e.id`,
    [edicionId, MAXIMO_DE_INTENTOS]
  );
  return filas.map(({ id, usuario_id, nombre_completo, email, activo }) => ({
    id: Number(id), usuario_id: Number(usuario_id), nombre_completo, email, activa: Number(activo) === 1
  }));
};

/**
 * Reserva el mail de una persona para esta corrida: la fila pasa a «enviando», con un intento más, la hora y la dirección que se
 * va a usar, solo si sigue pendiente o fallida con intentos por delante. true si la reserva es de esta corrida: solo entonces se
 * manda. Una que queda «enviando» (un corte entre el envío y la anotación) no se vuelve a tomar: pudo haber salido.
 */
export const reservarEnvio = async (envioId, email, ahora, conexion = pool) => {
  const [reserva] = await conexion.query(
    `UPDATE dato_quincena_envios e SET e.estado = 'enviando', e.intentos = e.intentos + 1, e.ultimo_intento_at = ?, e.email = ?
     WHERE e.id = ? AND ${POR_MANDAR}`,
    [ahora, email, envioId, MAXIMO_DE_INTENTOS]
  );
  return reserva.affectedRows === 1;
};

/**
 * Lo que pasó con un mail reservado: enviado (con su hora) o fallido (con el texto fijo, nunca el del transporte). Solo sobre
 * la reserva («enviando»).
 */
export const terminarEnvio = (envioId, { enviado, ahora, error }, conexion = pool) => conexion.query(
  enviado
    ? "UPDATE dato_quincena_envios SET estado = 'enviado', enviado_at = ?, error = NULL WHERE id = ? AND estado = 'enviando'"
    : "UPDATE dato_quincena_envios SET estado = 'fallido', error = ? WHERE id = ? AND estado = 'enviando'",
  enviado ? [ahora, envioId] : [error, envioId]
);

/**
 * Una persona que en este momento no recibe el mail (de licencia, inactiva o sin un email válido): su fila pasa a ese estado
 * (`licencia` u `omitido`, con su `error`) sin gastar un intento, solo si todavía se le podía mandar. true si la cambió.
 */
export const apartarEnvio = async (envioId, { estado, error }, conexion = pool) => {
  const [cambio] = await conexion.query(
    `UPDATE dato_quincena_envios e SET e.estado = ?, e.error = ? WHERE e.id = ? AND ${POR_MANDAR}`,
    [estado, error, envioId, MAXIMO_DE_INTENTOS]
  );
  return cambio.affectedRows === 1;
};

/**
 * Guarda el estado de una edición después de la corrida o de un reenvío: `estado` (el de estadoDeLaEdicion, o 'programada'
 * mientras sigue saliendo), `enviada_at` (el primer envío automático que salió, o null) y la hora de la corrida (`ahora`; con
 * null, la de la última corrida queda como estaba: un reenvío no es una corrida).
 */
export const guardarElEstado = (edicionId, estado, ahora, conexion = pool) => conexion.query(
  `UPDATE dato_quincena_correos SET estado = ?, motivo = NULL, ultima_corrida_at = COALESCE(?, ultima_corrida_at),
     enviada_at = (SELECT MIN(e.enviado_at) FROM dato_quincena_envios e
                   WHERE e.edicion_id = ? AND e.tipo = 'automatico' AND e.estado = 'enviado')
   WHERE edicion_id = ?`,
  [estado, ahora, edicionId, edicionId]
);

/** Anota el inicio de una corrida en la fila 1 de la configuración, con el fin y el resultado vacíos (la crea si no está). */
export const anotarInicioDeLaCorrida = (ahora, conexion = pool) => conexion.query(
  `INSERT INTO dato_quincena_correo_config (id, envio_activo, corrida_inicio_at) VALUES (1, 0, ?)
   ON DUPLICATE KEY UPDATE corrida_inicio_at = ?, corrida_fin_at = NULL, corrida_resultado = NULL, corrida_con_errores = 0`,
  [ahora, ahora]
);

/** Anota el fin de la corrida que empezó en `inicio`, con su resultado: solo si la fila sigue siendo de esa corrida. */
export const anotarFinDeLaCorrida = (inicio, { fin, resultado, conErrores }, conexion = pool) => conexion.query(
  `UPDATE dato_quincena_correo_config SET corrida_fin_at = ?, corrida_resultado = ?, corrida_con_errores = ?
   WHERE id = 1 AND corrida_inicio_at = ?`,
  [fin, resultado, conErrores ? 1 : 0, inicio]
);

/**
 * La última corrida, para Correos → Estado: `{ inicio, fin, resultado, con_errores, en_curso }`, con `inicio` y `fin`
 * 'AAAA-MM-DD HH:MM'; en curso, sin fin y con el candado `bloqueo` tomado. null si nunca corrió.
 */
export const leerLaCorrida = async (bloqueo, conexion = pool) => {
  const [[fila]] = await conexion.query(
    `SELECT DATE_FORMAT(corrida_inicio_at, '%Y-%m-%d %H:%i') AS inicio, DATE_FORMAT(corrida_fin_at, '%Y-%m-%d %H:%i') AS fin,
            corrida_resultado AS resultado, corrida_con_errores AS con_errores, IS_FREE_LOCK(?) AS libre
     FROM dato_quincena_correo_config WHERE id = 1`,
    [bloqueo]
  );
  if (!fila?.inicio) return null;
  const fin = fila.fin ?? null;
  return {
    inicio: fila.inicio, fin, resultado: fila.resultado ?? null, con_errores: Number(fila.con_errores) === 1,
    en_curso: fin === null && Number(fila.libre) !== 1
  };
};

/**
 * La última edición que salió sola (spec, 13): la más nueva con filas automáticas, `{ id, fecha_edicion }`, o null si ninguna.
 * A cuántas personas no les llegó lo cuenta `personasSinLlegar`, con sus filas (`enviosDe`).
 */
export const ultimaEdicionQueSalio = async (conexion = pool) => {
  const [[ultima]] = await conexion.query(
    `SELECT d.id, DATE_FORMAT(d.fecha_edicion, '%Y-%m-%d') AS fecha_edicion
     FROM dato_quincena_ediciones d
     WHERE EXISTS (SELECT 1 FROM dato_quincena_envios e WHERE e.edicion_id = d.id AND e.tipo = 'automatico')
     ORDER BY d.fecha_edicion DESC, d.id DESC
     LIMIT 1`
  );
  return ultima === undefined ? null : { id: Number(ultima.id), fecha_edicion: ultima.fecha_edicion };
};

// Las rutas de administración (spec 2026-11-12-dato-quincena-correo, 9 y 12; controllers/datoQuincenaCorreoController.js)

/**
 * Las personas de la configuración del correo (spec, 12), solo para administración: las activas, `[{ id, nombre, cargo, rol,
 * email, recibe, hasta }]`, con `recibe` (si están en la lista) un booleano y `hasta` ('AAAA-MM-DD'), si `hoy` están de licencia
 * oficial sin anular, el último día (de la que termina más tarde, si se pisan), o null. Solo la fecha: el tipo de una licencia es
 * de su dueño.
 */
export const personasDelCorreo = async (hoy, conexion = pool) => {
  const [filas] = await conexion.query(
    `SELECT u.id, u.nombre_completo, u.cargo, u.rol, u.email, d.usuario_id IS NOT NULL AS recibe, l.hasta
     FROM usuarios u
     LEFT JOIN dato_quincena_destinatarios d ON d.usuario_id = u.id
     LEFT JOIN (SELECT usuario_id, DATE_FORMAT(MAX(hasta), '%Y-%m-%d') AS hasta
                FROM usuarios_licencias
                WHERE anulada = 0 AND desde <= ? AND hasta >= ?
                GROUP BY usuario_id) l ON l.usuario_id = u.id
     WHERE u.activo = 1
     ORDER BY u.nombre_completo, u.id`,
    [hoy, hoy]
  );
  return filas.map(({ id, nombre_completo, cargo, rol, email, recibe, hasta }) => ({
    id: Number(id), nombre: nombre_completo, cargo: cargo ?? null, rol, email, recibe: Number(recibe) === 1, hasta: hasta ?? null
  }));
};

/** La fecha ('AAAA-MM-DD') de la regular más nueva, de la que salen las próximas ediciones, o null si no hay ninguna. */
export const ultimaRegular = async (conexion = pool) => {
  const [[fila]] = await conexion.query(
    "SELECT DATE_FORMAT(MAX(fecha_edicion), '%Y-%m-%d') AS fecha FROM dato_quincena_ediciones WHERE tipo = 'regular'"
  );
  return fila?.fecha ?? null;
};

/** Prende o apaga el envío automático (la fila 1, que crea si no está) y anota quién y cuándo. */
export const guardarEnvioActivo = (activo, usuarioId, ahora, conexion = pool) => conexion.query(
  `INSERT INTO dato_quincena_correo_config (id, envio_activo, cambiado_por, cambiado_at) VALUES (1, ?, ?, ?)
   ON DUPLICATE KEY UPDATE envio_activo = VALUES(envio_activo), cambiado_por = VALUES(cambiado_por),
     cambiado_at = VALUES(cambiado_at)`,
  [activo ? 1 : 0, usuarioId, ahora]
);

/**
 * Reemplaza la lista de quienes reciben el correo por `ids` (ya sin repetir), en una transacción: si alguno no es un usuario
 * activo, no cambia nada y resuelve false. Quien sigue en la lista conserva quién y cuándo lo sumó (`agregado_at`: «Reenviada a
 * toda la lista» compara con esa hora, y volver a guardar no lo hace llegar de nuevo); quien entra lleva `usuarioId` y `ahora`;
 * quien no está en `ids` sale, también una persona inactiva que había quedado en la tabla. Resuelve true si la guardó.
 */
export const reemplazarDestinatarios = async (ids, usuarioId, ahora) => {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    try {
      if (ids.length > 0) {
        // Con las filas tomadas: nadie las desactiva hasta el commit
        const [activos] = await conexion.query(
          'SELECT id FROM usuarios WHERE id IN (?) AND activo = 1 LOCK IN SHARE MODE', [ids]
        );
        if (activos.length !== ids.length) {
          await conexion.rollback();
          return false;
        }
        await conexion.query('DELETE FROM dato_quincena_destinatarios WHERE usuario_id NOT IN (?)', [ids]);
        await conexion.query(
          `INSERT INTO dato_quincena_destinatarios (usuario_id, agregado_por, agregado_at) VALUES ?
           ON DUPLICATE KEY UPDATE usuario_id = usuario_id`,
          [ids.map((id) => [id, usuarioId, ahora])]
        );
      } else {
        await conexion.query('DELETE FROM dato_quincena_destinatarios');
      }
      await conexion.commit();
      return true;
    } catch (error) {
      await conexion.rollback().catch(() => {});
      throw error;
    }
  } finally {
    conexion.release();
  }
};

/**
 * Lo inmutable de una edición para el correo (su fila solo se inserta): `{ id, tipo, fecha_edicion }`, o null si no existe.
 */
export const edicionDelCorreo = async (id, conexion = pool) => {
  const [[fila]] = await conexion.execute(
    "SELECT id, tipo, DATE_FORMAT(fecha_edicion, '%Y-%m-%d') AS fecha_edicion FROM dato_quincena_ediciones WHERE id = ?", [id]
  );
  return fila === undefined ? null : { id: Number(fila.id), tipo: fila.tipo, fecha_edicion: fila.fecha_edicion };
};

/**
 * Las filas de dato_quincena_envios de una edición con el nombre de cada persona, para la caja del correo de administración
 * (spec, 12): las de enviosDe, con `nombre` y `creado_at` y sin la dirección, por id.
 */
export const enviosConNombres = async (edicionId, conexion = pool) => {
  const [filas] = await conexion.execute(
    `SELECT e.id, e.edicion_id, e.usuario_id, e.tipo, e.estado, e.intentos,
            DATE_FORMAT(e.enviado_at, '%Y-%m-%d %H:%i:%s') AS enviado_at,
            DATE_FORMAT(e.ultimo_intento_at, '%Y-%m-%d %H:%i:%s') AS ultimo_intento_at, e.error,
            DATE_FORMAT(e.creado_at, '%Y-%m-%d %H:%i:%s') AS creado_at, u.nombre_completo AS nombre
     FROM dato_quincena_envios e
     JOIN usuarios u ON u.id = e.usuario_id
     WHERE e.edicion_id = ?
     ORDER BY e.id`,
    [edicionId]
  );
  return filas.map((fila) => ({ ...envioDeLaFila(fila), creado_at: fechaONull(fila.creado_at), nombre: fila.nombre }));
};

/** El nombre y el email de hoy de unas personas, para un reenvío: `[{ usuario_id, nombre_completo, email }]`, por id. */
export const contactosDe = async (ids, conexion = pool) => {
  if (ids.length === 0) return [];
  const [filas] = await conexion.query('SELECT id, nombre_completo, email FROM usuarios WHERE id IN (?) ORDER BY id', [ids]);
  return filas.map(({ id, nombre_completo, email }) => ({ usuario_id: Number(id), nombre_completo, email }));
};

/** Quien pide una prueba: `{ id, nombre_completo, email }`, o null. */
export const usuarioDeLaPrueba = async (usuarioId, conexion = pool) => {
  const [[fila]] = await conexion.execute('SELECT id, nombre_completo, email FROM usuarios WHERE id = ?', [usuarioId]);
  return fila === undefined ? null : { id: Number(fila.id), nombre_completo: fila.nombre_completo, email: fila.email };
};

/**
 * Anota un reenvío o una prueba (`tipo` 'reenvio' o 'prueba'), antes de mandarlo: «enviando» con su intento y la hora del pedido
 * (así, si el envío no termina, queda sin confirmar y nunca se repite solo), u «omitido» con su motivo, sin intento. Lleva quién
 * lo pidió. `unico` es una columna generada: no va en el INSERT. Resuelve el id de la fila.
 */
export const anotarEnvioAMano = async ({ edicionId, usuarioId, email, tipo, estado, intentos, error, creadoPor, ahora },
  conexion = pool) => {
  const [resultado] = await conexion.execute(
    `INSERT INTO dato_quincena_envios
       (edicion_id, usuario_id, email, tipo, estado, intentos, ultimo_intento_at, error, creado_por, creado_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [edicionId, usuarioId, email, tipo, estado, intentos, intentos > 0 ? ahora : null, error, creadoPor, ahora]
  );
  return resultado.insertId;
};
