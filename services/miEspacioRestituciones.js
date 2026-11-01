/**
 * Los días restituidos de Mi espacio (spec 2026-10-31-mi-espacio-dias-restituidos, 4 y 6, con las decisiones del constructor
 * del plan): las escrituras de la foto (`mi_espacio_restituibles`: qué días de qué cargas dejó de hacer hábiles un feriado
 * cargado o corregido después) y de los pedidos (`mi_espacio_restituciones`: tomarlos, caso A, o pedir que vuelvan, caso B).
 * Siempre con la conexión de una transacción ajena: ninguna la abre ni la cierra, así lo que escriben se confirma o se deshace
 * con lo de quien llama (el feriado en Configuración → Feriados; la carga de los días restituidos o el pedido en Mi espacio).
 * Consultas parametrizadas. Las reglas (qué fotografiar, los grupos y sus tandas) son puras y están en
 * services/feriadosReglas.js (`fotosDelFeriado`) y services/miEspacioReglas.js (`restitucionesDe`).
 *
 * Las tandas se sellan al pedir: un pedido sobre una carga le pone a las filas abiertas de su foto (`tanda` NULL) la cantidad
 * de pedidos que esa carga ya tenía, activos o no, que es la tanda que la regla les da mientras están abiertas. Así una fila
 * conserva su tanda (y su plazo) para siempre, un asueto que llega después de un pedido arma una tanda nueva y un pedido
 * borrado sigue separando las tandas.
 */
import { fechaEnElAnio } from './feriadosReglas.js';

// Las filas de la foto (alias `r`) que no tienen un pedido que las sostenga, con el mismo criterio que `restitucionesDe`: sin
// `restitucion_id`, o con el de un pedido dado de baja o del caso A cuya carga de días restituidos está dada de baja (la regla
// lo cuenta como suelto). Lo usan el enlace de `registrarPedido` y `acomodarLaFotoDelFeriado`
const SIN_PEDIDO = `(r.restitucion_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM mi_espacio_restituciones p
  LEFT JOIN mi_espacio_licencias c ON c.id = p.carga_id AND c.activo = 1
  WHERE p.id = r.restitucion_id AND p.activo = 1 AND (p.caso = 'restituir' OR c.id IS NOT NULL)))`;

/**
 * Anota la foto de un feriado, sin tanda ni pedido. `fotos`, las de `fotosDelFeriado` (`[{ licencia_id, fecha }]`). Si la carga
 * ya tiene ese día (la clave única es la carga y el día): con un pedido, queda como estaba; sin pedido (una fila vieja de un
 * feriado dado de baja, o de este mismo en un año que no regía), pasa a este feriado y vuelve a quedar abierta (`tanda` NULL),
 * así un asueto que llega después de un pedido arma una tanda nueva con su plazo y no revive la tanda vieja (decisión 12 de la
 * spec). Sin fotos, no escribe nada.
 * @returns {Promise<void>}
 */
export const sacarLaFoto = async (conexion, feriadoId, fotos) => {
  const lista = Array.isArray(fotos) ? fotos : [];
  if (lista.length === 0) return;
  await conexion.query(
    `INSERT INTO mi_espacio_restituibles (licencia_id, feriado_id, fecha) VALUES ?
     ON DUPLICATE KEY UPDATE feriado_id = IF(restitucion_id IS NULL, VALUES(feriado_id), feriado_id),
       tanda = IF(restitucion_id IS NULL, NULL, tanda)`,
    [lista.map(({ licencia_id: licenciaId, fecha }) => [licenciaId, feriadoId, fecha])]
  );
};

// Si la fecha sigue siendo del feriado después de corregirlo: con su fecha y «se repite», sin mirar los años que no rige ni su
// baja desde un año («no rige» y la baja no tocan la foto: la regla ve que ese día volvió a ser hábil)
const sigueSiendoSuya = (feriado, fecha) => (Number(feriado.se_repite) === 1
  ? fecha.slice(5) === feriado.fecha.slice(5) && fecha.slice(0, 4) >= feriado.fecha.slice(0, 4)
  : fecha === feriado.fecha);

/**
 * Después de corregir un feriado (spec, sección 6): las fotos de ese feriado sin un pedido que las sostenga (`SIN_PEDIDO`, el
 * criterio de `restitucionesDe`) cuya fecha ya no es suya pasan a otro feriado activo que rija ese día (de `filas`, las de
 * `filasDeFeriados` después de corregirlo), si hay, y si no se borran. Las de un pedido quedan como están: la regla ve que ese
 * día volvió a ser hábil y el Resumen dice «Revisá…». `feriado` es la fila como quedó guardada. Si todas sus fotos siguen
 * siendo suyas (una corrección que no tocó la fecha ni «se repite»), no mira los pedidos. Devuelve `{ movidas, borradas }`.
 * @returns {Promise<{ movidas: number, borradas: number }>}
 */
export const acomodarLaFotoDelFeriado = async (conexion, feriado, filas) => {
  const [todas] = await conexion.query(
    `SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha FROM mi_espacio_restituibles WHERE feriado_id = ? ORDER BY id`,
    [feriado.id]
  );
  const ajenas = todas.filter(({ fecha }) => !sigueSiendoSuya(feriado, fecha));
  if (ajenas.length === 0) return { movidas: 0, borradas: 0 };
  const [sinPedido] = await conexion.query(
    `SELECT r.id FROM mi_espacio_restituibles r WHERE r.id IN (?) AND ${SIN_PEDIDO}`, [ajenas.map(({ id }) => id)]
  );
  const sueltas = new Set(sinPedido.map(({ id }) => Number(id)));
  const otros = (Array.isArray(filas) ? filas : []).filter((fila) => fila?.id !== feriado.id);
  const aOtro = new Map();
  const aBorrar = [];
  for (const { id, fecha } of ajenas) {
    if (!sueltas.has(Number(id))) continue;
    const otro = otros.find((fila) => fechaEnElAnio(fila, Number(fecha.slice(0, 4))) === fecha);
    if (otro === undefined) aBorrar.push(Number(id));
    else aOtro.set(otro.id, [...(aOtro.get(otro.id) ?? []), Number(id)]);
  }
  for (const [otroId, ids] of aOtro) {
    await conexion.query('UPDATE mi_espacio_restituibles SET feriado_id = ? WHERE id IN (?)', [otroId, ids]);
  }
  if (aBorrar.length > 0) await conexion.query('DELETE FROM mi_espacio_restituibles WHERE id IN (?)', [aBorrar]);
  return { movidas: [...aOtro.values()].reduce((suma, ids) => suma + ids.length, 0), borradas: aBorrar.length };
};

/**
 * Registra un pedido sobre un grupo de días por restituir (`grupo`, uno de `restitucionesDe` en 'por_restituir': su carga
 * `licencia_id`, su licencia de origen `anio`, su `tanda`, sus `dias`, sus `fechas` y el `primer_asueto` de su tanda), en la
 * transacción de quien llama, que ya validó el grupo y bloqueó la fila de la persona (así dos pedidos de la misma persona se
 * esperan y el segundo ve lo que dejó el primero). En este orden:
 * 1. sella las filas abiertas de la foto de esa carga (`tanda` NULL) con la cantidad de pedidos que ya tenía, activos o no
 *    (contados con `FOR UPDATE`: la última versión confirmada, y nadie suma otro a esa carga hasta el fin de la transacción);
 * 2. inserta el pedido: `caso` ('tomar', con su carga de días restituidos en `cargaId`; 'restituir', sin carga), la tanda del
 *    grupo, sus días, su primer asueto y `fecha` = `hoy` (el día del pedido: la fecha de la nota B y la habilitación de sus días);
 * 3. enlaza las filas del grupo (las de sus fechas y su tanda) que siguen sin pedido: sin `restitucion_id`, o con el de un
 *    pedido que ya no las sostiene (dado de baja, o del caso A con su carga dada de baja: la regla los cuenta como sueltos).
 * Devuelve el id del pedido. Con un grupo, un caso, una carga (un entero positivo en 'tomar'; null en 'restituir') o un hoy que
 * no sirven, tira (TypeError) sin escribir nada; si no enlaza todas las fechas del grupo (otro pedido tomó alguna: quien llama no
 * bloqueó o no volvió a leer el grupo), tira después de escribir, para que quien llama deshaga la transacción: un pedido nunca
 * queda con menos días de los que dice.
 * @returns {Promise<number>}
 */
export const registrarPedido = async (conexion, { usuarioId, grupo, caso, cargaId = null, hoy }) => {
  const valido = grupo !== null && typeof grupo === 'object' && Number.isInteger(grupo.licencia_id) && grupo.licencia_id > 0
    && Number.isInteger(grupo.anio) && Number.isInteger(grupo.tanda) && Number.isInteger(grupo.dias)
    && Array.isArray(grupo.fechas) && grupo.fechas.length > 0 && typeof grupo.primer_asueto === 'string';
  const cargaValida = caso === 'tomar' ? Number.isInteger(cargaId) && cargaId > 0 : caso === 'restituir' && cargaId === null;
  if (!valido || !cargaValida || typeof hoy !== 'string') {
    throw new TypeError('registrarPedido: el grupo, el caso, la carga o el día del pedido no sirven');
  }
  const [[{ cantidad }]] = await conexion.query(
    'SELECT COUNT(*) AS cantidad FROM mi_espacio_restituciones WHERE licencia_id = ? FOR UPDATE', [grupo.licencia_id]
  );
  await conexion.query(
    'UPDATE mi_espacio_restituibles SET tanda = ? WHERE licencia_id = ? AND tanda IS NULL', [Number(cantidad), grupo.licencia_id]
  );
  const [pedido] = await conexion.query(
    `INSERT INTO mi_espacio_restituciones (usuario_id, licencia_id, anio, caso, dias, primer_asueto, tanda, fecha, carga_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [usuarioId, grupo.licencia_id, grupo.anio, caso, grupo.dias, grupo.primer_asueto, grupo.tanda, hoy, cargaId]
  );
  const id = pedido.insertId;
  const [enlace] = await conexion.query(
    `UPDATE mi_espacio_restituibles r SET r.restitucion_id = ?
     WHERE r.licencia_id = ? AND r.tanda = ? AND r.fecha IN (?) AND ${SIN_PEDIDO}`,
    [id, grupo.licencia_id, grupo.tanda, grupo.fechas]
  );
  if (enlace.affectedRows < new Set(grupo.fechas).size) {
    throw new Error('registrarPedido: no todos los días del grupo siguen sin pedido');
  }
  return id;
};

/**
 * Suelta un pedido (al borrar el pedido B o la carga de días restituidos del caso A, o al anular esa carga en Configuración):
 * lo da de baja y deja sus filas de la foto sin `restitucion_id`, con su tanda (así vuelven a estar por restituir con el plazo
 * de siempre, o quedan perdidas si ya pasó). En la transacción de quien llama. true si dio de baja un pedido activo; si ya
 * estaba dado de baja o no existe, false (y sus filas quedan sin pedido igual).
 * @returns {Promise<boolean>}
 */
export const soltarPedido = async (conexion, pedidoId) => {
  const [baja] = await conexion.query(
    'UPDATE mi_espacio_restituciones SET activo = 0 WHERE id = ? AND activo = 1', [pedidoId]
  );
  await conexion.query('UPDATE mi_espacio_restituibles SET restitucion_id = NULL WHERE restitucion_id = ?', [pedidoId]);
  return baja.affectedRows === 1;
};

/**
 * Suelta (`soltarPedido`) los pedidos activos del caso A de unas cargas de días restituidos que se dan de baja (`cargaIds`: al
 * borrarlas desde Mi espacio o cuando Configuración → Licencias anula la licencia que crearon), en la transacción de quien
 * llama: sus días vuelven a estar por restituir hasta el plazo y, después, quedan perdidos (spec
 * 2026-10-31-mi-espacio-dias-restituidos, 4: «Deshacer»). Los pedidos se leen con `FOR UPDATE` (la última versión confirmada).
 * Lo que no es un id positivo no cuenta; sin ninguno, no lee nada. Devuelve cuántos soltó.
 * @returns {Promise<number>}
 */
export const soltarLosPedidosDeLasCargas = async (conexion, cargaIds) => {
  const ids = (Array.isArray(cargaIds) ? cargaIds : []).filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return 0;
  const [pedidos] = await conexion.query(
    `SELECT id FROM mi_espacio_restituciones WHERE carga_id IN (?) AND caso = 'tomar' AND activo = 1 ORDER BY id FOR UPDATE`,
    [ids]
  );
  for (const { id } of pedidos) await soltarPedido(conexion, Number(id));
  return pedidos.length;
};
