/**
 * Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, secciones 5 y 10): las consultas de lo que cargó cada persona, de
 * solo lectura y parametrizadas. Devuelven el `Estado` de las reglas (services/miEspacioReglas.js), solo con las filas
 * activas. Lo que llega de la base como texto se convierte acá (el pool no tiene `dateStrings` ni `decimalNumbers`): las
 * fechas se leen con DATE_FORMAT ('AAAA-MM-DD'), los DECIMAL, tinyint y smallint pasan por Number() (el '7.5' de unas
 * horas, el '8.0' de un saldo) y los TIME ('19:00:00') se cortan a 'HH:MM'.
 * Sin consultas N+1: las tablas se leen una vez para todas las personas (`estadosDe`). `conexion`: el pool, o la de una
 * transacción (lee lo que ella ve).
 */
import pool from '../config/database.js';
import { calcular, modalidadDe } from './miEspacioReglas.js';
import { filasDeFeriados } from './feriadosDatos.js';
import { feriadosDelRango } from './feriadosReglas.js';
import { idPositivo } from './proyectosReglas.js';

// Un número de la base que puede faltar (las horas de una licencia que no es por horas): NULL sigue siendo null, no 0
const numeroONulo = (valor) => (valor === null || valor === undefined ? null : Number(valor));
// '19:00:00' → '19:00'
const horaDe = (valor) => String(valor).slice(0, 5);

const estadoVacio = (modalidad = null) =>
  ({ modalidad, arranque: null, anios: [], saldos: [], licencias: [], horasExtras: [] });

/**
 * La persona: `{ id, nombre_completo, rol, vinculo, email, activo }`, o null (un id que no es un entero positivo o que no
 * existe).
 * @returns {Promise<object | null>}
 */
export const personaDe = async (usuarioId, conexion = pool) => {
  const id = idPositivo(usuarioId);
  if (id === null) return null;
  const [[fila]] = await conexion.query(
    'SELECT id, nombre_completo, rol, vinculo, email, activo FROM usuarios WHERE id = ?', [id]
  );
  if (!fila) return null;
  return {
    id: Number(fila.id), nombre_completo: fila.nombre_completo, rol: fila.rol, vinculo: fila.vinculo ?? null,
    email: fila.email ?? null, activo: Number(fila.activo)
  };
};

/**
 * El `Estado` de varias personas: un Map de cada id (número) que existe en `usuarios` a lo que cargó, con seis consultas para
 * todas. La modalidad sale del vínculo (`modalidadDe`); de cada tabla, solo lo activo:
 * - `anios`: `[{ anio, dias_vacaciones, estudios }]`, por año;
 * - `saldos`: `[{ concepto, anio, cantidad }]`, por año y concepto;
 * - `licencias`: `[{ id, tipo, desde, hasta, horas, mostrar, nota, licencia_oficial_id, oficial, sin_pasar }]`, por fecha
 *   (`horas` es null en las que no son por horas);
 * - `horasExtras`: `[{ id, fecha, desde, hasta, nota }]`, por fecha y horario.
 * Los ids que no sirven o que no existen no están; sin ninguno, un Map vacío (sin consultar).
 * @returns {Promise<Map<number, object>>}
 */
export const estadosDe = async (usuarioIds, conexion = pool) => {
  const ids = [...new Set((Array.isArray(usuarioIds) ? usuarioIds : []).map(idPositivo).filter((id) => id !== null))];
  const estados = new Map();
  if (ids.length === 0) return estados;

  const [usuarios] = await conexion.query('SELECT id, vinculo FROM usuarios WHERE id IN (?)', [ids]);
  for (const { id, vinculo } of usuarios) estados.set(Number(id), estadoVacio(modalidadDe(vinculo)));
  if (estados.size === 0) return estados;
  const deLaPersona = (usuarioId) => estados.get(Number(usuarioId));
  const encontrados = [...estados.keys()];

  const [arranques] = await conexion.query(
    "SELECT usuario_id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha FROM mi_espacio_arranque WHERE usuario_id IN (?)",
    [encontrados]
  );
  for (const fila of arranques) deLaPersona(fila.usuario_id).arranque = fila.fecha;

  const [anios] = await conexion.query(
    `SELECT usuario_id, anio, dias_vacaciones, estudios FROM mi_espacio_anios
     WHERE usuario_id IN (?) ORDER BY usuario_id, anio`,
    [encontrados]
  );
  for (const fila of anios) {
    deLaPersona(fila.usuario_id).anios.push({
      anio: Number(fila.anio), dias_vacaciones: Number(fila.dias_vacaciones), estudios: fila.estudios ?? null
    });
  }

  const [saldos] = await conexion.query(
    `SELECT usuario_id, concepto, anio, cantidad FROM mi_espacio_saldos
     WHERE usuario_id IN (?) ORDER BY usuario_id, anio, concepto`,
    [encontrados]
  );
  for (const fila of saldos) {
    deLaPersona(fila.usuario_id).saldos.push({ concepto: fila.concepto, anio: Number(fila.anio), cantidad: Number(fila.cantidad) });
  }

  const [licencias] = await conexion.query(
    `SELECT id, usuario_id, tipo, DATE_FORMAT(desde, '%Y-%m-%d') AS desde, DATE_FORMAT(hasta, '%Y-%m-%d') AS hasta, horas,
       mostrar, nota, licencia_oficial_id, oficial, sin_pasar
     FROM mi_espacio_licencias
     WHERE usuario_id IN (?) AND activo = 1
     ORDER BY usuario_id, desde, hasta, id`,
    [encontrados]
  );
  for (const fila of licencias) {
    deLaPersona(fila.usuario_id).licencias.push({
      id: Number(fila.id), tipo: fila.tipo, desde: fila.desde, hasta: fila.hasta, horas: numeroONulo(fila.horas),
      mostrar: Number(fila.mostrar), nota: fila.nota ?? null, licencia_oficial_id: numeroONulo(fila.licencia_oficial_id),
      oficial: fila.oficial ?? null, sin_pasar: fila.sin_pasar ?? null
    });
  }

  const [horasExtras] = await conexion.query(
    `SELECT id, usuario_id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, desde, hasta, nota
     FROM mi_espacio_horas_extras
     WHERE usuario_id IN (?) AND activo = 1
     ORDER BY usuario_id, fecha, desde, id`,
    [encontrados]
  );
  for (const fila of horasExtras) {
    deLaPersona(fila.usuario_id).horasExtras.push({
      id: Number(fila.id), fecha: fila.fecha, desde: horaDe(fila.desde), hasta: horaDe(fila.hasta), nota: fila.nota ?? null
    });
  }
  return estados;
};

/**
 * El `Estado` de una persona (el de `estadosDe`). Sin la persona, uno vacío y sin modalidad.
 * @returns {Promise<object>}
 */
export const estadoDe = async (usuarioId, conexion = pool) =>
  (await estadosDe([usuarioId], conexion)).get(idPositivo(usuarioId)) ?? estadoVacio();

// El año de una fecha 'AAAA-MM-DD' como número; lo que no lo es, null
const anioDe = (fecha) => (typeof fecha === 'string' && /^\d{4}-/.test(fecha) ? Number(fecha.slice(0, 4)) : null);

/**
 * El Set de los días no hábiles por feriado (`feriadosDelRango`: los 9 fijos y los de la tabla que rigen) que necesitan las
 * reglas para los estados (el Map de `estadosDe` o cualquier iterable de `Estado`): del 01/01 del año más viejo entre hoy − 3
 * y lo cargado (el arranque, las licencias y las horas extras) al 31/12 del más nuevo entre hoy + 2 y lo cargado. El margen
 * cubre lo que se camina fuera de las fechas cargadas (el último día hábil del mes de uso de un franco, la vuelta, el próximo
 * feriado del año siguiente). `filas`: las filas de los feriados si ya se leyeron (`filasDeFeriados`); si no, se leen. Sin un
 * hoy válido ni nada cargado, un Set vacío.
 * @returns {Promise<Set<string>>}
 */
export const feriadosPara = async (estados, hoy, filas = null) => {
  const deHoy = anioDe(hoy);
  let desde = deHoy === null ? null : deHoy - 3;
  let hasta = deHoy === null ? null : deHoy + 2;
  for (const estado of estados instanceof Map ? estados.values() : (estados ?? [])) {
    const fechas = [
      estado?.arranque,
      ...(estado?.licencias ?? []).flatMap((fila) => [fila.desde, fila.hasta]),
      ...(estado?.horasExtras ?? []).map((fila) => fila.fecha)
    ];
    for (const anio of fechas.map(anioDe)) {
      if (anio === null) continue;
      desde = desde === null ? anio : Math.min(desde, anio);
      hasta = hasta === null ? anio : Math.max(hasta, anio);
    }
  }
  if (desde === null) return new Set();
  return feriadosDelRango(filas ?? await filasDeFeriados(), `${desde}-01-01`, `${hasta}-12-31`);
};

/**
 * Todo lo de una persona para una lectura o una carga: `{ persona, estado, feriados, filasFeriados, calculo }`. Las filas de
 * los feriados se leen una vez: arman el Set del cálculo (`feriadosPara`) y quedan en `filasFeriados` para el próximo
 * feriado del Resumen. El cálculo es el de `calcular`, con ese hoy y esos feriados.
 * @returns {Promise<object>}
 */
export const contextoDe = async (usuarioId, hoy, conexion = pool) => {
  const persona = await personaDe(usuarioId, conexion);
  const estado = await estadoDe(usuarioId, conexion);
  const filasFeriados = await filasDeFeriados(conexion);
  const feriados = await feriadosPara([estado], hoy, filasFeriados);
  return { persona, estado, feriados, filasFeriados, calculo: calcular(estado, { hoy, feriados }) };
};
