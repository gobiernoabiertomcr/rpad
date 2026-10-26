// Feriados (spec 2026-10-26-feriados, sección 3): los días no hábiles que no son los 9 fijos, para la pestaña Feriados de
// Configuración y para Mi espacio. GET /api/feriados lo lee cualquier rol con sesión (authMiddleware); cargar, corregir, «no
// rige» y la baja, solo administración (authMiddleware + adminOnly).
// Las reglas son puras (services/feriadosReglas.js) y las consultas de lectura están en services/feriadosDatos.js; acá se
// escribe. Hoy es hoyArgentina(). Respuestas { success, data?, error?, campo?, message?, avisos? }.
// Orden de los controles en las que reciben un id: un id que no es un entero positivo, que no existe o dado de baja da 404
// (`noEncontrado`); después, la validación da 400 { success: false, error, campo }. Corregir, «no rige» y la baja leen la fila
// con filaDeFeriado dentro de su transacción, como primera lectura (la bloquea con FOR UPDATE: dos escrituras del mismo feriado
// se esperan y la segunda ve lo que dejó la primera). La baja es lógica (activo, o hasta_anio en uno que se repite).
import pool from '../config/database.js';
import { hoyArgentina, formatoCorto } from '../services/notasDigitalesCalendario.js';
import {
  MENSAJES_FERIADO, feriadosDelAnio, aniosDelSelector, validarFeriado, validarRige, bajaDesde, avisosDeLaFecha
} from '../services/feriadosReglas.js';
import { filasDeFeriados, filaDeFeriado } from '../services/feriadosDatos.js';
import { idPositivo } from '../services/proyectosReglas.js';

// Los años que se pueden pedir en GET /api/feriados
const ANIO_MINIMO = 2000;
const ANIO_MAXIMO = 2100;

// El año del pedido como número: sin `anio` (o vacío), el en curso; un texto de cuatro cifras de ANIO_MINIMO a ANIO_MAXIMO, ese
// año; cualquier otra cosa ('abc', '1999', '2026.5', ' 2026', un `anio` repetido, que Express da como lista), null (400)
const anioDelPedido = (valor, hoy) => {
  if (valor === undefined || valor === '') return Number(hoy.slice(0, 4));
  if (typeof valor !== 'string' || !/^\d{4}$/.test(valor)) return null;
  const anio = Number(valor);
  return anio >= ANIO_MINIMO && anio <= ANIO_MAXIMO ? anio : null;
};

// GET /api/feriados?anio=AAAA: los feriados del año (los 9 fijos y los de la tabla, tal como los arma feriadosDelAnio) y los años
// del selector de la pestaña
export const listarFeriados = async (req, res) => {
  const hoy = hoyArgentina();
  const anio = anioDelPedido(req.query.anio, hoy);
  if (anio === null) return res.status(400).json({ success: false, error: MENSAJES_FERIADO.anio, campo: 'anio' });
  try {
    const filas = await filasDeFeriados();
    res.json({ success: true, data: { anio, anios: aniosDelSelector(filas, hoy), feriados: feriadosDelAnio(filas, anio) } });
  } catch (error) {
    console.error('Error obteniendo los feriados:', error);
    res.status(500).json({ success: false, error: 'Error al obtener los feriados' });
  }
};

// [status, cuerpo]: lo que responde cada escritura. Dentro de una transacción, un 2xx la confirma y cualquier otro la deshace
const noEncontrado = () => [404, { success: false, error: MENSAJES_FERIADO.noEncontrado }];
// El error de una regla, { campo, mensaje } (campo null en noSeRepite)
const rechazoDeValidacion = ({ campo, mensaje }) => [400, { success: false, error: mensaje, campo }];

/**
 * Corre trabajo(conexion) en una transacción y devuelve lo que devolvió, [status, cuerpo]: un 2xx la confirma; cualquier otro, o
 * un error, la deshace. La conexión vuelve al pool siempre.
 */
const enTransaccion = async (trabajo) => {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(conexion);
    if (resultado[0] < 300) await conexion.commit();
    else await conexion.rollback();
    return resultado;
  } catch (error) {
    await conexion.rollback().catch(() => {});
    throw error;
  } finally {
    conexion.release();
  }
};

// Responde lo que devolvió la operación, o 500 con `mensaje` si algo inesperado falló (el error completo, solo en la consola)
const responder = async (res, mensaje, operacion) => {
  try {
    const [status, cuerpo] = await operacion();
    res.status(status).json(cuerpo);
  } catch (error) {
    console.error(`${mensaje}:`, error);
    res.status(500).json({ success: false, error: mensaje });
  }
};

// POST /api/feriados: carga uno. Los avisos (fin de semana, ya hay uno ese día) no frenan nada: se calculan antes de guardar,
// con lo que ya está cargado, así una falla al leerlos no deja un feriado cargado con un 500
export const crearFeriado = (req, res) => responder(res, 'Error al cargar el feriado', async () => {
  const { datos, error } = validarFeriado(req.body, hoyArgentina());
  if (error) return rechazoDeValidacion(error);
  const avisos = avisosDeLaFecha(datos.fecha, await filasDeFeriados(), null);
  const [resultado] = await pool.query(
    'INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) VALUES (?, ?, ?, ?, ?, ?)',
    [datos.fecha, datos.nombre, datos.tipo, datos.trasladado_de, datos.se_repite, req.user.userId]
  );
  return [201, { success: true, data: { id: resultado.insertId }, message: 'Feriado cargado.', avisos }];
});

// PUT /api/feriados/:id: lo corrige con el formulario entero (en uno que se repite, la fecha y el nombre corrigen todos los años).
// Los avisos no cuentan al que se corrige
export const corregirFeriado = (req, res) => responder(res, 'Error al corregir el feriado', async () => {
  const id = idPositivo(req.params.id);
  if (id === null) return noEncontrado();
  return enTransaccion(async (conexion) => {
    if (!(await filaDeFeriado(id, conexion))) return noEncontrado();
    const { datos, error } = validarFeriado(req.body, hoyArgentina());
    if (error) return rechazoDeValidacion(error);
    await conexion.query(
      'UPDATE feriados SET fecha = ?, nombre = ?, tipo = ?, trasladado_de = ?, se_repite = ? WHERE id = ?',
      [datos.fecha, datos.nombre, datos.tipo, datos.trasladado_de, datos.se_repite, id]
    );
    const avisos = avisosDeLaFecha(datos.fecha, await filasDeFeriados(conexion), id);
    return [200, { success: true, message: 'Feriado corregido.', avisos }];
  });
});

// El día al que se pasó uno que se repite: el que ya hay activo con esa fecha y ese nombre (repetir el pedido no lo duplica) o
// uno nuevo, con el mismo nombre y tipo, sin «se repite» y trasladado del día que no rige. Devuelve su id
const cargarElDiaAlQueSePaso = async (conexion, fila, { anio, pasa_al: pasaAl }, creadoPor) => {
  const [[existente]] = await conexion.query(
    'SELECT id FROM feriados WHERE fecha = ? AND nombre = ? AND activo = 1 ORDER BY id LIMIT 1',
    [pasaAl, fila.nombre]
  );
  if (existente) return Number(existente.id);
  const [resultado] = await conexion.query(
    'INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) VALUES (?, ?, ?, ?, 0, ?)',
    [pasaAl, fila.nombre, fila.tipo, `${anio}-${fila.fecha.slice(5)}`, creadoPor]
  );
  return resultado.insertId;
};

const textoDeRige = ({ anio, rige, pasa_al: pasaAl }) => {
  if (rige) return `En ${anio} vuelve a regir.`;
  return pasaAl === null ? `En ${anio} no rige.` : `En ${anio} no rige: se pasó al ${formatoCorto(pasaAl)}.`;
};

// PUT /api/feriados/:id/rige: en uno que se repite, { anio, rige, pasa_al } marca (rige: false) o desmarca (rige: true) que ese
// año no rige; con pasa_al, en la misma transacción carga el día al que se pasó. Una sola escritura en feriados_no_rige, la de
// ese año (INSERT IGNORE o DELETE): repetir el pedido no cambia nada. Volver a regir no toca el día al que se había pasado (es un
// feriado más). nuevo_id: el id del día al que se pasó, o null
export const cambiarRige = (req, res) => responder(res, 'Error al cambiar si rige el feriado', async () => {
  const id = idPositivo(req.params.id);
  if (id === null) return noEncontrado();
  return enTransaccion(async (conexion) => {
    const fila = await filaDeFeriado(id, conexion);
    if (!fila) return noEncontrado();
    const { datos, error } = validarRige(req.body, fila, hoyArgentina());
    if (error) return rechazoDeValidacion(error);
    if (datos.rige) {
      await conexion.query('DELETE FROM feriados_no_rige WHERE feriado_id = ? AND anio = ?', [id, datos.anio]);
    } else {
      await conexion.query('INSERT IGNORE INTO feriados_no_rige (feriado_id, anio) VALUES (?, ?)', [id, datos.anio]);
    }
    const nuevoId = datos.pasa_al === null ? null : await cargarElDiaAlQueSePaso(conexion, fila, datos, req.user.userId);
    return [200, { success: true, message: textoDeRige(datos), data: { nuevo_id: nuevoId } }];
  });
});

// DELETE /api/feriados/:id?desde=AAAA: la baja de bajaDesde. Sin «se repite», la baja entera (desde no cuenta); con «se repite»,
// desde el año elegido (hasta_anio = desde - 1, los anteriores no cambian) o entera si es su primer año o uno anterior
export const darDeBajaFeriado = (req, res) => responder(res, 'Error al dar de baja el feriado', async () => {
  const id = idPositivo(req.params.id);
  if (id === null) return noEncontrado();
  return enTransaccion(async (conexion) => {
    const fila = await filaDeFeriado(id, conexion);
    if (!fila) return noEncontrado();
    const { cambio, error } = bajaDesde(fila, req.query.desde);
    if (error) return rechazoDeValidacion(error);
    if (Object.hasOwn(cambio, 'hasta_anio')) {
      await conexion.query('UPDATE feriados SET hasta_anio = ? WHERE id = ?', [cambio.hasta_anio, id]);
    } else {
      await conexion.query('UPDATE feriados SET activo = 0 WHERE id = ?', [id]);
    }
    return [200, { success: true, message: 'Feriado dado de baja.' }];
  });
});
