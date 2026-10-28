/**
 * Los feriados (spec 2026-10-26-feriados, secciones 2 y 3): las consultas de las tablas `feriados` y `feriados_no_rige`, de
 * solo lectura y parametrizadas. Devuelven las filas con la forma que usan las reglas (`services/feriadosReglas.js`):
 * `{ id, fecha, nombre, tipo, trasladado_de, se_repite, hasta_anio, activo, no_rige }`, con las fechas como texto
 * 'AAAA-MM-DD' (DATE_FORMAT: el pool no tiene `dateStrings`), el resto como números (Number) y `no_rige`, los años en que
 * una que se repite no rige, de menor a mayor.
 * Solo las activas, pero `activo` va igual en la fila: las reglas toman por dada de baja a una fila sin él.
 * Sin consultas N+1: una consulta para las filas y otra para todos sus `no_rige`.
 */
import pool from '../config/database.js';
import { feriadosDelRango, calendarioCon } from './feriadosReglas.js';
import { CALENDARIO_FIJO } from './notasDigitalesCalendario.js';
import { idPositivo } from './proyectosReglas.js';

const SELECT_FERIADOS = `SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, nombre, tipo,
    DATE_FORMAT(trasladado_de, '%Y-%m-%d') AS trasladado_de, se_repite, hasta_anio, activo
  FROM feriados`;

// Una fila de la base con la forma de las reglas
const aFila = (fila, noRige) => ({
  id: Number(fila.id),
  fecha: fila.fecha,
  nombre: fila.nombre,
  tipo: fila.tipo,
  trasladado_de: fila.trasladado_de ?? null,
  se_repite: Number(fila.se_repite),
  hasta_anio: fila.hasta_anio === null ? null : Number(fila.hasta_anio),
  activo: Number(fila.activo),
  no_rige: noRige
});

/**
 * Las filas activas, por fecha y por id, cada una con su `no_rige`. `conexion`: el pool, o la de una transacción (lee lo que
 * ella ve).
 * @returns {Promise<object[]>}
 */
export const filasDeFeriados = async (conexion = pool) => {
  const [filas] = await conexion.query(`${SELECT_FERIADOS} WHERE activo = 1 ORDER BY fecha, id`);
  if (filas.length === 0) return [];
  const [anios] = await conexion.query(
    `SELECT n.feriado_id, n.anio FROM feriados_no_rige n
       JOIN feriados f ON f.id = n.feriado_id
     WHERE f.activo = 1
     ORDER BY n.feriado_id, n.anio`
  );
  const noRige = new Map();
  for (const { feriado_id: id, anio } of anios) {
    if (!noRige.has(id)) noRige.set(id, []);
    noRige.get(id).push(Number(anio));
  }
  return filas.map((fila) => aFila(fila, noRige.get(fila.id) ?? []));
};

/**
 * Una fila activa con su `no_rige`, o null (un id que no es un entero positivo, que no existe o que está dado de baja). Con la
 * conexión de una transacción (cualquiera que no sea el pool) lee la fila con FOR UPDATE: queda bloqueada hasta el fin de la
 * transacción, así dos escrituras del mismo feriado se esperan y la segunda ve lo que dejó la primera.
 * Sus `no_rige` van con una lectura común, sin bloqueo: los escribe solo quien tiene bloqueada la fila, y un FOR UPDATE sobre
 * `feriados_no_rige` bloquearía también los huecos de la clave, que comparten feriados distintos (dos escrituras de feriados
 * distintos chocarían en un bloqueo mutuo). Por eso, en una transacción, esta tiene que ser la primera lectura: con
 * REPEATABLE READ, la primera lectura común fija lo que ve la transacción, y acá eso pasa después de tomar el bloqueo.
 * @returns {Promise<object | null>}
 */
export const filaDeFeriado = async (id, conexion = pool) => {
  const elId = idPositivo(id);
  if (elId === null) return null;
  const bloqueo = conexion === pool ? '' : ' FOR UPDATE';
  const [[fila]] = await conexion.query(`${SELECT_FERIADOS} WHERE id = ? AND activo = 1${bloqueo}`, [elId]);
  if (!fila) return null;
  const [anios] = await conexion.query('SELECT anio FROM feriados_no_rige WHERE feriado_id = ? ORDER BY anio', [elId]);
  return aFila(fila, anios.map(({ anio }) => Number(anio)));
};

/**
 * El Set de los días no hábiles por feriado de desde a hasta, los dos incluidos: los 9 fijos y los de la tabla que rigen
 * (`feriadosDelRango`). Con un rango que no es un rango, un Set vacío. Quien cuenta días hábiles lo pide con margen.
 * @returns {Promise<Set<string>>}
 */
export const feriadosEntre = async (desde, hasta) => feriadosDelRango(await filasDeFeriados(), desde, hasta);

/**
 * El calendario de días hábiles con los feriados de la tabla (spec 2026-10-27-feriados-en-notas, 1 y 2): `calendarioCon` de las
 * filas activas. Se lee una vez por corrida o por pedido, y lo reciben las funciones que llama ese punto de entrada.
 * Nunca tira: si la tabla no se puede leer, anota el error en la consola y devuelve el calendario de los 9 fijos con
 * `origen: 'fijos'` y el motivo en `error` (quien lo usa lo detecta con `error !== null`). `conexion`: el pool, o la de una
 * transacción (lee lo que ella ve).
 * @returns {Promise<object>} el calendario, congelado
 */
export const leerCalendario = async (conexion = pool) => {
  try {
    return calendarioCon(await filasDeFeriados(conexion));
  } catch (error) {
    console.error('No se pudieron leer los feriados: el calendario cuenta solo los 9 fijos.', error);
    return Object.freeze({ ...CALENDARIO_FIJO, origen: 'fijos', error: String(error?.message ?? error) });
  }
};
