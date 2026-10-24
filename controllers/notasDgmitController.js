// Notas DGMIT (spec 2026-10-24-notas-dgmit, secciones 2, 3 y 8): cargar, corregir y anular una nota que la DGMIT le mandó a
// un área. Las rutas exigen authMiddleware + cargaNotasDgmit (administración y el colaborador); corregir y anular, además,
// que sea quien la cargó o administración. Se guarda directo, sin doble verificación (no es un cambio a un dataset), y cada
// operación es una transacción: cabecera, datasets e historial juntos. No manda emails.
// La validación de los campos es pura (services/notasDgmitReglas.js); acá se chequea lo que necesita la base: que la nota
// exista y se pueda tocar, que los datasets se puedan elegir y que el número no esté repetido.
import pool from '../config/database.js';
import { hoyArgentina } from '../services/notasDigitalesCalendario.js';
import { esAdmin } from '../services/usuariosReglas.js';
import {
  validarNotaDgmit, validarMotivo, textoNumeroRepetido, textoNoSePuedeElegir, TEXTO_TIPO_NOTA_DGMIT
} from '../services/notasDgmitReglas.js';

const ERROR_AL_GUARDAR = 'Error al guardar la nota DGMIT';
const NO_ENCONTRADA = 'Nota DGMIT no encontrada';
const SOLO_QUIEN_LA_CARGO = 'Solo quien cargó la nota o administración pueden corregirla o anularla.';
const NOTA_ANULADA = 'La nota está anulada: no se puede corregir ni volver a anular.';
const SIN_CAMBIOS = 'La corrección no cambia ningún dato de la nota.';

// El orden en que se informan los errores de validación: el primero va en `error` y `campo`
const ORDEN_DE_CAMPOS = ['numero', 'recibida', 'tipo', 'datasets', 'motivo'];

// [status, cuerpo]: lo que responde cada operación. Un 2xx confirma la transacción; cualquier otro la deshace
const rechazo = (status, error) => [status, { success: false, error }];
const rechazoEnCampo = (status, campo, error) => [status, { success: false, error, campo, errores: { [campo]: error } }];
const rechazoDeValidacion = (errores) => {
  const campo = ORDEN_DE_CAMPOS.find((c) => errores[c]);
  return [400, { success: false, error: errores[campo], campo, errores }];
};

// El id de la ruta: solo dígitos y un entero positivo seguro, como en el Seguimiento. null si no lo es (404)
const idDeLaNota = (texto) => {
  if (!/^\d+$/.test(texto ?? '')) return null;
  const id = Number(texto);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const ascendente = (ids) => [...ids].sort((a, b) => a - b);

const nombreDelTipo = (tipo) => TEXTO_TIPO_NOTA_DGMIT[tipo].toLowerCase();

const mensajeDeCarga = ({ numero, tipo, datasets }) =>
  `Nota DGMIT N° ${numero} (${nombreDelTipo(tipo)}) cargada en ${datasets.length === 1 ? '1 dataset' : `${datasets.length} datasets`}.`;

// La nota con sus datasets (ids, ascendentes), bloqueada hasta el fin de la transacción: dos correcciones o anulaciones de la
// misma nota se esperan y la segunda ve lo que dejó la primera. null si no existe
const notaBloqueada = async (conexion, id) => {
  const [[nota]] = await conexion.query(
    `SELECT id, numero, tipo, DATE_FORMAT(recibida, '%Y-%m-%d') AS recibida, anulada, creado_por
     FROM notas_dgmit WHERE id = ? FOR UPDATE`,
    [id]
  );
  if (!nota) return null;
  const [filas] = await conexion.query('SELECT dataset_id FROM notas_dgmit_datasets WHERE nota_id = ? ORDER BY dataset_id', [id]);
  return { ...nota, datasets: filas.map((f) => f.dataset_id) };
};

// Corregir y anular, en este orden: 404 si no existe, 403 si no la cargó quien pide y no es de administración, 409 si está
// anulada. null si se puede
const rechazoDeLaNota = (nota, usuario) => {
  if (!nota) return rechazo(404, NO_ENCONTRADA);
  if (nota.creado_por !== usuario.userId && !esAdmin(usuario.rol)) return rechazo(403, SOLO_QUIEN_LA_CARGO);
  if (nota.anulada) return rechazo(409, NOTA_ANULADA);
  return null;
};

// Se pueden elegir los datasets activos, de gestión externa y con «Requiere nota DGMIT» en Sí o sin dato (el 0 es No)
const sePuedeElegir = (dataset) =>
  Boolean(dataset.activo) && dataset.tipo_gestion === 'externa' && (dataset.requiere_nota === null || dataset.requiere_nota === 1);

// El primer dataset (en el orden recibido) que no se puede elegir da 400; los que la nota ya tenía se aceptan aunque hoy no
// se puedan elegir (una corrección no obliga a sacarlos). Un id que no existe da el mismo 400, con el id en lugar del título
const rechazoDeLosDatasets = async (conexion, ids, yaEstaban = []) => {
  const estaban = new Set(yaEstaban);
  const nuevos = ids.filter((id) => !estaban.has(id));
  if (nuevos.length === 0) return null;
  const [filas] = await conexion.query(
    'SELECT id, titulo, activo, tipo_gestion, requiere_nota FROM datasets WHERE id IN (?)', [nuevos]
  );
  const porId = new Map(filas.map((f) => [f.id, f]));
  for (const id of nuevos) {
    const dataset = porId.get(id);
    if (!dataset) return rechazoEnCampo(400, 'datasets', textoNoSePuedeElegir(String(id)));
    if (!sePuedeElegir(dataset)) return rechazoEnCampo(400, 'datasets', textoNoSePuedeElegir(dataset.titulo));
  }
  return null;
};

// Otra nota sin anular con el mismo número (la colación ignora las mayúsculas y los espacios del final; el número llega sin
// los de los extremos). Bloquea lo que lee hasta el fin de la transacción, así dos cargas simultáneas del mismo número no
// pasan las dos
const numeroRepetido = async (conexion, numero, idPropio = 0) => {
  const [filas] = await conexion.query(
    'SELECT id FROM notas_dgmit WHERE numero = ? AND anulada = 0 AND id <> ? FOR UPDATE', [numero, idPropio]
  );
  return filas.length > 0;
};

const insertarDatasets = async (conexion, notaId, ids) => {
  if (ids.length === 0) return;
  await conexion.query('INSERT INTO notas_dgmit_datasets (nota_id, dataset_id) VALUES ?', [ids.map((id) => [notaId, id])]);
};

// Cuántas veces se intenta una transacción que MariaDB cortó por un bloqueo mutuo
const INTENTOS = 3;

/**
 * Corre trabajo(conexion) en una transacción y devuelve su [status, cuerpo]: un 2xx la confirma, cualquier otro la deshace.
 * Si MariaDB la corta por un bloqueo mutuo (ER_LOCK_DEADLOCK: ya la deshizo entera), la repite desde el principio, hasta
 * INTENTOS veces. Pasa con dos escrituras simultáneas: una corrección bloquea su nota y después recorre las demás buscando el
 * número, mientras una carga las recorre todas desde la primera; y, con la tabla vacía, dos cargas del mismo número toman
 * solo el hueco del final (los bloqueos de hueco no se excluyen) y chocan en el INSERT. La que se repite ya ve lo que dejó
 * la otra y responde lo que corresponde (el 409 del número repetido), en lugar de un 500.
 */
const enTransaccion = async (trabajo) => {
  for (let intento = 1; ; intento += 1) {
    let conexion;
    try {
      conexion = await pool.getConnection();
      await conexion.beginTransaction();
      const [status, cuerpo] = await trabajo(conexion);
      if (status < 300) await conexion.commit();
      else await conexion.rollback();
      return [status, cuerpo];
    } catch (error) {
      await conexion?.rollback().catch(() => {});
      if (error?.code !== 'ER_LOCK_DEADLOCK' || intento >= INTENTOS) throw error;
    } finally {
      conexion?.release();
    }
  }
};

// Responde lo que devolvió la operación, o 500 si algo inesperado falló
const responder = async (res, etiqueta, operacion) => {
  try {
    const [status, cuerpo] = await operacion();
    res.status(status).json(cuerpo);
  } catch (error) {
    console.error(`Error al ${etiqueta} la nota DGMIT:`, error);
    res.status(500).json({ success: false, error: ERROR_AL_GUARDAR });
  }
};

// POST /api/notas-dgmit: { numero, recibida, tipo, datasets: [ids] }. 201 con { id, numero, tipo, recibida, datasets }
export const cargarNotaDgmit = (req, res) => {
  const { datos, errores } = validarNotaDgmit(req.body, hoyArgentina());
  if (Object.keys(errores).length > 0) return res.status(400).json(rechazoDeValidacion(errores)[1]);
  return responder(res, 'cargar', () => enTransaccion(async (conexion) => {
    const datasetsRechazados = await rechazoDeLosDatasets(conexion, datos.datasets);
    if (datasetsRechazados) return datasetsRechazados;
    if (await numeroRepetido(conexion, datos.numero)) return rechazoEnCampo(409, 'numero', textoNumeroRepetido(datos.numero));
    const [resultado] = await conexion.query(
      'INSERT INTO notas_dgmit (numero, tipo, recibida, creado_por) VALUES (?, ?, ?, ?)',
      [datos.numero, datos.tipo, datos.recibida, req.user.userId]
    );
    await insertarDatasets(conexion, resultado.insertId, datos.datasets);
    return [201, { success: true, data: { id: resultado.insertId, ...datos }, message: mensajeDeCarga(datos) }];
  }));
};

// ¿La corrección cambia algo? Número (el texto guardado), tipo, fecha o el conjunto de datasets (sin importar el orden)
const cambiaAlgo = (nota, datos) => {
  if (nota.numero !== datos.numero || nota.tipo !== datos.tipo || nota.recibida !== datos.recibida) return true;
  const antes = new Set(nota.datasets);
  return datos.datasets.length !== antes.size || datos.datasets.some((id) => !antes.has(id));
};

// PUT /api/notas-dgmit/:id: el cuerpo de la carga más motivo. Guarda en el historial lo que la nota tenía antes
export const corregirNotaDgmit = (req, res) => {
  const id = idDeLaNota(req.params.id);
  if (id === null) return res.status(404).json({ success: false, error: NO_ENCONTRADA });
  const hoy = hoyArgentina();
  return responder(res, 'corregir', () => enTransaccion(async (conexion) => {
    const nota = await notaBloqueada(conexion, id);
    const noSePuede = rechazoDeLaNota(nota, req.user);
    if (noSePuede) return noSePuede;
    const { datos, errores } = validarNotaDgmit(req.body, hoy);
    const { motivo, error: errorDelMotivo } = validarMotivo(req.body?.motivo);
    if (errorDelMotivo) errores.motivo = errorDelMotivo;
    if (Object.keys(errores).length > 0) return rechazoDeValidacion(errores);
    if (!cambiaAlgo(nota, datos)) return rechazo(400, SIN_CAMBIOS);
    const datasetsRechazados = await rechazoDeLosDatasets(conexion, datos.datasets, nota.datasets);
    if (datasetsRechazados) return datasetsRechazados;
    if (await numeroRepetido(conexion, datos.numero, id)) return rechazoEnCampo(409, 'numero', textoNumeroRepetido(datos.numero));

    const anteriores = { numero: nota.numero, tipo: nota.tipo, recibida: nota.recibida, datasets: ascendente(nota.datasets) };
    await conexion.query(
      'INSERT INTO notas_dgmit_historial (nota_id, accion, motivo, anteriores, usuario_id) VALUES (?, ?, ?, ?, ?)',
      [id, 'correccion', motivo, JSON.stringify(anteriores), req.user.userId]
    );
    await conexion.query(
      'UPDATE notas_dgmit SET numero = ?, tipo = ?, recibida = ? WHERE id = ?', [datos.numero, datos.tipo, datos.recibida, id]
    );
    const quedan = new Set(datos.datasets);
    const salen = nota.datasets.filter((d) => !quedan.has(d));
    if (salen.length > 0) await conexion.query('DELETE FROM notas_dgmit_datasets WHERE nota_id = ? AND dataset_id IN (?)', [id, salen]);
    const estaban = new Set(nota.datasets);
    await insertarDatasets(conexion, id, datos.datasets.filter((d) => !estaban.has(d)));
    return [200, { success: true, data: { id, ...datos }, message: `Nota DGMIT N° ${datos.numero} corregida.` }];
  }));
};

// POST /api/notas-dgmit/:id/anular: { motivo }. No borra: la nota queda con anulada = 1 y su fila en el historial
export const anularNotaDgmit = (req, res) => {
  const id = idDeLaNota(req.params.id);
  if (id === null) return res.status(404).json({ success: false, error: NO_ENCONTRADA });
  return responder(res, 'anular', () => enTransaccion(async (conexion) => {
    const nota = await notaBloqueada(conexion, id);
    const noSePuede = rechazoDeLaNota(nota, req.user);
    if (noSePuede) return noSePuede;
    const { motivo, error } = validarMotivo(req.body?.motivo);
    if (error) return rechazoDeValidacion({ motivo: error });
    await conexion.query('UPDATE notas_dgmit SET anulada = 1 WHERE id = ?', [id]);
    await conexion.query(
      'INSERT INTO notas_dgmit_historial (nota_id, accion, motivo, anteriores, usuario_id) VALUES (?, ?, ?, NULL, ?)',
      [id, 'anulacion', motivo, req.user.userId]
    );
    return [200, { success: true, message: `Nota DGMIT N° ${nota.numero} anulada.` }];
  }));
};
