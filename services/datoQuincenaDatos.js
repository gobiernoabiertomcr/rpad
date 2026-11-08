/**
 * El dato de la quincena (spec 2026-11-07-dato-quincena, sección 8): las consultas de las tres tablas del archivo de las
 * ediciones de Grok Bot, parametrizadas. Las reglas y los textos están en `services/datoQuincenaReglas.js`.
 *
 * Los INSERT van con `execute`: los bytes viajan en binario y no en hexadecimal (el doble), y un error no trae la edición en
 * `err.sql` (como el PDF de las Notas Digitales). Una lista en `IN (?)` va con `query` y solo si no está vacía.
 * Las fechas se leen como texto 'AAAA-MM-DD' (DATE_FORMAT: el pool no tiene `dateStrings`) y la llegada como segundos UNIX
 * (UNIX_TIMESTAMP: un TIMESTAMP está en UTC y `NOW()` da UTC en el Docker local y hora argentina en producción).
 * Los bytes de los archivos (`contenido`) solo los lee `leerArchivo`, la descarga: la lista y el detalle nunca los traen.
 */
import pool from '../config/database.js';
import { ARCHIVOS, TIPO_DE_DESCARGA, nombreDeLaEdicion } from './datoQuincenaReglas.js';

// Los rpad_id que citan las filas, sin repetir y sin null
const idsCitados = (filas) => [...new Set(filas.map((fila) => fila.rpad_id).filter((id) => id !== null))];

/**
 * Guarda una edición ya validada en una sola transacción (sección 8): la edición, sus propuestas (`filas`, de
 * filasDeLaEdicion, con `dataset_id` = `rpad_id` solo si está en datasets, activo o no) y sus adjuntos
 * (`[{ campo, nombre, mime, bytes, sha256, contenido }]`). Lo decide el UNIQUE de la clave, no una consulta previa: si el INSERT
 * de la edición choca (ER_DUP_ENTRY), se deshace todo y se lee la que estaba: 'repetida' si tiene la misma huella y
 * 'conflicto' si no, con su id. Resuelve `{ estado: 'creada' | 'repetida' | 'conflicto', id }`; otro error de la base, tira.
 * La conexión se devuelve siempre.
 */
export const guardarEdicion = async ({
  clave, tipo, fecha_edicion, referencia_piloto, titulo, metadataTexto, huella, filas, adjuntos
}) => {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    try {
      const ids = idsCitados(filas);
      let existentes = new Set();
      if (ids.length > 0) {
        const [encontrados] = await conexion.query('SELECT id FROM datasets WHERE id IN (?)', [ids]);
        existentes = new Set(encontrados.map((fila) => Number(fila.id)));
      }

      let id;
      try {
        const [resultado] = await conexion.execute(
          `INSERT INTO dato_quincena_ediciones (clave, tipo, fecha_edicion, referencia_piloto, titulo, metadata, huella)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [clave, tipo, fecha_edicion, referencia_piloto, titulo, metadataTexto, huella]
        );
        id = resultado.insertId;
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') throw error;
        await conexion.rollback();
        const [[guardada]] = await conexion.execute('SELECT id, huella FROM dato_quincena_ediciones WHERE clave = ?', [clave]);
        if (!guardada) throw new Error('La clave chocó con una edición que ya no está');
        return { estado: guardada.huella === huella ? 'repetida' : 'conflicto', id: Number(guardada.id) };
      }

      for (const fila of filas) {
        await conexion.execute(
          `INSERT INTO dato_quincena_propuestas (edicion_id, orden, titulo, cifra_clave, principal, dataset_id, dataset_nombre)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, fila.orden, fila.titulo, fila.cifra_clave, fila.principal,
            fila.rpad_id !== null && existentes.has(fila.rpad_id) ? fila.rpad_id : null, fila.dataset_nombre]
        );
      }
      for (const adjunto of adjuntos) {
        await conexion.execute(
          `INSERT INTO dato_quincena_adjuntos (edicion_id, campo, nombre, mime, bytes, sha256, contenido)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, adjunto.campo, adjunto.nombre, adjunto.mime, adjunto.bytes, adjunto.sha256, adjunto.contenido]
        );
      }
      await conexion.commit();
      return { estado: 'creada', id };
    } catch (error) {
      await conexion.rollback().catch(() => {});
      throw error;
    }
  } finally {
    conexion.release();
  }
};

/**
 * Lo que hace falta para el recibo de una edición guardada (sección 7), o null si no existe: la fila (`fecha_edicion` como
 * texto, `recibida_ts` los segundos UNIX de recibida_at y `metadata`, el texto guardado), sus adjuntos (`campo`, `bytes` y
 * `sha256`) y sus propuestas guardadas (`orden` y `dataset_id`, para armar los avisos desde lo guardado).
 */
export const leerRecibo = async (id) => {
  const [[fila]] = await pool.execute(
    `SELECT id, clave, tipo, DATE_FORMAT(fecha_edicion, '%Y-%m-%d') AS fecha_edicion, huella,
            UNIX_TIMESTAMP(recibida_at) AS recibida_ts, metadata
     FROM dato_quincena_ediciones WHERE id = ?`,
    [id]
  );
  if (!fila) return null;
  const [adjuntos] = await pool.execute(
    'SELECT campo, bytes, sha256 FROM dato_quincena_adjuntos WHERE edicion_id = ? ORDER BY id', [id]
  );
  const [guardadas] = await pool.execute(
    'SELECT orden, dataset_id FROM dato_quincena_propuestas WHERE edicion_id = ? ORDER BY orden', [id]
  );
  return {
    fila: { ...fila, id: Number(fila.id) },
    adjuntos: adjuntos.map(({ campo, bytes, sha256 }) => ({ campo, bytes: Number(bytes), sha256 })),
    guardadas: guardadas.map(({ orden, dataset_id }) => ({
      orden: Number(orden), dataset_id: dataset_id === null ? null : Number(dataset_id)
    }))
  };
};

// metadata es un longtext utf8mb4: el texto, aunque el driver lo diera en bytes
const textoDe = (valor) => (Buffer.isBuffer(valor) ? valor.toString('utf8') : valor);

/**
 * La lista de las ediciones de un año (sección 9): `anios`, cada año con ediciones y su cantidad, del más nuevo al más viejo;
 * `anio`, el pedido o, sin él (null), el más reciente con ediciones (null con el archivo vacío); y `filas`, las ediciones de
 * ese año por fecha y, en el mismo día, por id descendentes, cada una con sus propuestas en su orden (`principal` booleano).
 * Un año sin ediciones da `filas` vacía. Las propuestas, con `IN (?)` solo si hay ediciones.
 */
export const listarEdiciones = async (anio) => {
  const [anios] = await pool.query(
    `SELECT YEAR(fecha_edicion) AS anio, COUNT(*) AS cantidad
     FROM dato_quincena_ediciones
     GROUP BY YEAR(fecha_edicion)
     ORDER BY anio DESC`
  );
  const lista = anios.map((fila) => ({ anio: Number(fila.anio), cantidad: Number(fila.cantidad) }));
  const elegido = anio ?? lista[0]?.anio ?? null;
  if (elegido === null) return { anios: lista, anio: null, filas: [] };

  const [ediciones] = await pool.execute(
    `SELECT e.id, e.tipo, DATE_FORMAT(e.fecha_edicion, '%Y-%m-%d') AS fecha_edicion, e.referencia_piloto
     FROM dato_quincena_ediciones e
     WHERE e.fecha_edicion BETWEEN ? AND ?
     ORDER BY e.fecha_edicion DESC, e.id DESC`,
    [`${elegido}-01-01`, `${elegido}-12-31`]
  );
  if (ediciones.length === 0) return { anios: lista, anio: elegido, filas: [] };

  const ids = ediciones.map((edicion) => Number(edicion.id));
  const [propuestas] = await pool.query(
    `SELECT edicion_id, orden, titulo, cifra_clave, principal, dataset_nombre
     FROM dato_quincena_propuestas
     WHERE edicion_id IN (?)
     ORDER BY edicion_id, orden`,
    [ids]
  );
  const porEdicion = new Map(ids.map((id) => [id, []]));
  for (const propuesta of propuestas) {
    porEdicion.get(Number(propuesta.edicion_id))?.push({
      orden: Number(propuesta.orden),
      titulo: propuesta.titulo,
      cifra_clave: propuesta.cifra_clave,
      principal: Number(propuesta.principal) === 1,
      dataset_nombre: propuesta.dataset_nombre
    });
  }
  return {
    anios: lista,
    anio: elegido,
    filas: ediciones.map((edicion) => ({
      id: Number(edicion.id),
      tipo: edicion.tipo,
      fecha_edicion: edicion.fecha_edicion,
      referencia_piloto: edicion.referencia_piloto,
      propuestas: porEdicion.get(Number(edicion.id))
    }))
  };
};

/**
 * Lo que hace falta para el detalle de una edición (sección 9), o null si no existe: la fila (`fecha_edicion` como texto,
 * `metadata` el texto guardado y `recibida_ts` los segundos UNIX de recibida_at), sus propuestas guardadas (`orden`,
 * `dataset_id` y `dataset_activo`: true solo si el dataset existe y está activo) y sus adjuntos sin los bytes (`campo`,
 * `nombre`, `mime` y `bytes`).
 */
export const leerEdicion = async (id) => {
  const [[fila]] = await pool.execute(
    `SELECT id, clave, tipo, DATE_FORMAT(fecha_edicion, '%Y-%m-%d') AS fecha_edicion, referencia_piloto, titulo, metadata,
            UNIX_TIMESTAMP(recibida_at) AS recibida_ts
     FROM dato_quincena_ediciones WHERE id = ?`,
    [id]
  );
  if (!fila) return null;
  const [guardadas] = await pool.execute(
    `SELECT p.orden, p.dataset_id, d.activo AS dataset_activo
     FROM dato_quincena_propuestas p
     LEFT JOIN datasets d ON d.id = p.dataset_id
     WHERE p.edicion_id = ?
     ORDER BY p.orden`,
    [id]
  );
  const [adjuntos] = await pool.execute(
    'SELECT campo, nombre, mime, bytes FROM dato_quincena_adjuntos WHERE edicion_id = ? ORDER BY id', [id]
  );
  return {
    fila: { ...fila, id: Number(fila.id), metadata: textoDe(fila.metadata) },
    guardadas: guardadas.map(({ orden, dataset_id, dataset_activo }) => ({
      orden: Number(orden),
      dataset_id: dataset_id === null ? null : Number(dataset_id),
      dataset_activo: dataset_id !== null && Number(dataset_activo) === 1
    })),
    adjuntos: adjuntos.map(({ campo, nombre, mime, bytes }) => ({ campo, nombre, mime, bytes: Number(bytes) }))
  };
};

/**
 * Un archivo de una edición para descargarlo (sección 9): `{ existe: false }` si la edición no existe; si existe,
 * `{ existe: true, archivo }`, con `archivo` null si `campo` no es uno de los cuatro o si ese archivo no llegó (unos
 * cálculos). `archivo` es `{ nombre, mime, contenido }`: los bytes guardados, el nombre del manifiesto y el Content-Type fijo
 * de TIPO_DE_DESCARGA; `metadata` da el texto guardado en bytes, con el nombre de nombreDeLaEdicion. El único que lee
 * `contenido`.
 */
export const leerArchivo = async (id, campo) => {
  if (campo === 'metadata') {
    const [[edicion]] = await pool.execute(
      'SELECT clave, CAST(metadata AS BINARY) AS contenido FROM dato_quincena_ediciones WHERE id = ?', [id]
    );
    if (!edicion) return { existe: false };
    return {
      existe: true,
      archivo: { nombre: nombreDeLaEdicion(edicion.clave), mime: TIPO_DE_DESCARGA.metadata, contenido: edicion.contenido }
    };
  }
  const [[edicion]] = await pool.execute('SELECT id FROM dato_quincena_ediciones WHERE id = ?', [id]);
  if (!edicion) return { existe: false };
  if (!ARCHIVOS.includes(campo)) return { existe: true, archivo: null };
  const [[adjunto]] = await pool.execute(
    'SELECT nombre, contenido FROM dato_quincena_adjuntos WHERE edicion_id = ? AND campo = ?', [id, campo]
  );
  return {
    existe: true,
    archivo: adjunto ? { nombre: adjunto.nombre, mime: TIPO_DE_DESCARGA[campo], contenido: adjunto.contenido } : null
  };
};
