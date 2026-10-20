// Consultas de Notas Digitales: configuración, selección de datasets y fichas del anexo.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (secciones 5, 6.4 y 6.7) y
// docs/superpowers/specs/2026-10-17-fechas-datasets-design.md (sección 9, los datos solicitados)
import pool from '../config/database.js';
import { listaDeCorreos } from './emailService.js';
import { esFechaIso } from './notasDigitalesCalendario.js';
import { pedido, tipoEfectivo } from './fechasDatasetReglas.js';
import { diaDelAvisoEnSuFecha } from './licenciasReglas.js';

export const GESTIONES = ['interna', 'externa'];
// Días de anticipación del aviso, por gestión. La externa pasó de 30 a 40 (pedido del usuario el 16/10/2026): el pedido
// formal a las áreas externas lleva unos 5 días hábiles más el circuito administrativo.
export const VENTANA_DIAS = { interna: 60, externa: 40 };
export const DIAS_PARA_REITERAR = 20;
export const TIPOS_EMAIL_REEMPLAZADOS = ['interno-60', 'interno-30', 'interno-vencido', 'externo-60', 'externo-40', 'externo-5', 'externo-vencido'];

// Con lo que hace falta para el pedido (conPedido): la gestión (para el tipo sugerido), los meses, Datos al y el tipo. Y
// «Requiere nota DGMIT» (0, 1 o NULL), la columna de las tablas externas (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.5):
// llega así a la selección del aviso, a la de la reiteración y a los pendientes en su fecha
const COLUMNAS_DATASET = `
  d.id, d.titulo, d.url_dataset, d.area_id, a.nombre AS area_nombre, f.nombre AS frecuencia_nombre,
  DATE_FORMAT(d.ultima_actualizacion, '%Y-%m-%d') AS ultima_actualizacion,
  DATE_FORMAT(d.proxima_actualizacion, '%Y-%m-%d') AS vencimiento,
  d.tipo_gestion, f.meses, DATE_FORMAT(d.datos_al, '%Y-%m-%d') AS datos_al, d.tipo_pedido, d.requiere_nota`;
const DESDE_DATASETS = `
  FROM datasets d
  JOIN frecuencias f ON f.id = d.frecuencia_id
  JOIN areas a ON a.id = d.area_id`;
// Un vencimiento con la fecha cero de MariaDB ('0000-00-00', posible con sql_mode no estricto) no es una fecha: no entra
// en avisos ni en reiteraciones (saldría "Vencido hace NaN días")
const CONDICION_BASE = `d.activo = TRUE AND d.tipo_gestion = ? AND f.dias IS NOT NULL AND d.proxima_actualizacion IS NOT NULL
  AND d.proxima_actualizacion > '1900-01-01'`;
// Sin aviso (de cualquier estado, sin contar pruebas) para su vencimiento actual
const SIN_AVISO = `NOT EXISTS (
  SELECT 1 FROM notas_digitales_datasets ndd
  JOIN notas_digitales n ON n.id = ndd.nota_id
  WHERE ndd.dataset_id = d.id AND ndd.vencimiento = d.proxima_actualizacion
    AND n.tipo = 'aviso' AND n.es_prueba = 0)`;
// Primer vencimiento del mes (año-mes) de d entre los datasets de su gestión que cumplen la condición base,
// tengan o no aviso. El mes "se abre" para el aviso cuando ese vencimiento entra en la ventana (spec 5.2).
const PRIMER_VENCIMIENTO_DEL_MES = `(
  SELECT MIN(e.proxima_actualizacion) FROM datasets e
  JOIN frecuencias fe ON fe.id = e.frecuencia_id
  WHERE e.activo = TRUE AND e.tipo_gestion = d.tipo_gestion AND fe.dias IS NOT NULL AND e.proxima_actualizacion IS NOT NULL
    AND e.proxima_actualizacion > '1900-01-01'
    AND DATE_FORMAT(e.proxima_actualizacion, '%Y-%m') = DATE_FORMAT(d.proxima_actualizacion, '%Y-%m'))`;

export const obtenerConfig = async () => {
  const [filas] = await pool.query('SELECT * FROM notas_digitales_config WHERE id = 1');
  if (!filas[0]) throw new Error('Falta la configuración de Notas Digitales (notas_digitales_config)');
  return filas[0];
};

// Qué le falta a la configuración para que las notas puedan salir. Vive acá, y no en el motor, porque también la necesita
// auditoriaService (el canal de la nota de auditoría) y el motor importa auditoriaService.
// firmaTitular: la firma del firmante titular (firmasService.firmaDeUsuario), si hay uno elegido (spec 2026-10-15, 6.2)
export const configuracionCompleta = (config, firmaTitular = null) => {
  const faltan = [];
  for (const gestion of GESTIONES) {
    if (listaDeCorreos(config[`para_${gestion}`]).length === 0) faltan.push(`Para (gestión ${gestion})`);
  }
  const firma = config.firmante_usuario_id ? firmaTitular : { nombre: config.firma_nombre, cargo: config.firma_cargo };
  if (!String(firma?.nombre ?? '').trim()) faltan.push('nombre de la firma');
  if (!String(firma?.cargo ?? '').trim()) faltan.push('cargo de la firma');
  return faltan;
};

/**
 * Suma a un dataset de una nota lo que se le pide (spec 2026-10-17-fechas-datasets, 9): meses (la frecuencia), datos_al
 * ('AAAA-MM-DD' o null: '0000-00-00' no es una fecha), tipo_pedido (el efectivo: el guardado o, si no tiene, el sugerido
 * por la gestión y los meses) y pedido, { desde, hasta, texto } o null (eventual o sin un vencimiento válido). El pedido se
 * calcula con hoy, el día de la nota: con R7 si el vencimiento ya pasó y con todo lo que falta desde Datos al. Por eso la
 * reiteración lo recalcula cada vez y no copia el del aviso. Sin hoy, es el pedido de ese vencimiento tal cual.
 */
export const conPedido = (fila, hoy = null) => {
  const meses = fila.meses ?? null;
  const datosAl = esFechaIso(fila.datos_al) ? fila.datos_al : null;
  const tipo = tipoEfectivo({ tipo_pedido: fila.tipo_pedido, tipo_gestion: fila.tipo_gestion, meses });
  return {
    ...fila, meses, datos_al: datosAl, tipo_pedido: tipo,
    pedido: pedido({ vencimiento: fila.vencimiento, tipo, datosAl, meses, hoy })
  };
};

// Solo datasets a vencer (spec 5.2): los que vencen dentro de la ventana y los demás de la gestión que vencen el mismo
// mes que alguno que ya entró en ella. Como d es parte de su mes, "el primer vencimiento del mes está en la ventana"
// cubre las dos condiciones. Los vencidos sin aviso van a la reiteración (5.3).
// horizonte: hasta qué día se mira la ventana. Es hoy, salvo en la víspera de una licencia del firmante, en que es el
// último día hábil de la licencia (spec 2026-10-15-dias-habiles-licencias-auditoria, 7.3).
// apertura_mes: el primer vencimiento del mes de cada dataset (con él se calcula su fecha normal de aviso).
// Cada dataset trae su pedido calculado con hoy, el día del aviso (conPedido), también en la víspera de una licencia.
export const seleccionarParaAviso = async (gestion, hoy, horizonte = hoy) => {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS_DATASET}, DATE_FORMAT(${PRIMER_VENCIMIENTO_DEL_MES}, '%Y-%m-%d') AS apertura_mes ${DESDE_DATASETS}
     WHERE ${CONDICION_BASE}
       AND d.proxima_actualizacion >= ?
       AND ${PRIMER_VENCIMIENTO_DEL_MES} <= DATE_ADD(?, INTERVAL ? DAY)
       AND ${SIN_AVISO}
     ORDER BY d.proxima_actualizacion, d.titulo`,
    [gestion, hoy, horizonte, VENTANA_DIAS[gestion]]
  );
  return filas.map(fila => conPedido(fila, hoy));
};

// Reiteraciones previas enviadas del mismo vencimiento (el mismo ciclo)
const REITERACIONES_PREVIAS = `(SELECT COUNT(*) FROM notas_digitales_datasets r
   JOIN notas_digitales rn ON rn.id = r.nota_id
  WHERE r.dataset_id = d.id AND r.vencimiento = d.proxima_actualizacion
    AND rn.tipo = 'reiteracion' AND rn.es_prueba = 0 AND rn.estado = 'enviada')`;

// Las dos condiciones de la spec 5.3, excluyentes entre sí (una exige un aviso enviado y la otra que no haya ninguno):
// 1. avisados (aviso enviado) hace DIAS_PARA_REITERAR días o más y que siguen con el mismo vencimiento;
// 2. vencidos que nunca tuvieron aviso, que entran sin esperar (informado: null).
// Un aviso anticipado por la licencia del firmante cuenta los 20 días desde su fecha normal (cuenta_desde, spec 2026-10-15, 7.3).
// El pedido de cada dataset se recalcula con hoy (conPedido), con aviso previo o sin él: R7 lo lleva hasta el último corte
// cerrado si pasó otro ciclo sin respuesta (spec 2026-10-17-fechas-datasets, 9).
// Una fila por dataset: con persona autorizada, un dataset puede tener dos avisos enviados del mismo vencimiento (el
// adelantado y el de su fecha, spec 2026-10-15, 7.6). Informado es el primero, por fecha y por id de nota; con más de uno,
// informado.tambien trae los demás, en orden. Con uno solo, informado no lleva esa clave.
export const seleccionarParaReiteracion = async (gestion, hoy) => {
  const [filas] = await pool.query(
    `SELECT * FROM (
       SELECT ${COLUMNAS_DATASET}, av.numero AS aviso_numero, av.anio AS aviso_anio,
              DATE_FORMAT(av.fecha, '%Y-%m-%d') AS aviso_fecha, av.id AS aviso_id, ${REITERACIONES_PREVIAS} AS reiteraciones
       ${DESDE_DATASETS}
       JOIN notas_digitales_datasets avd ON avd.dataset_id = d.id AND avd.vencimiento = d.proxima_actualizacion
       JOIN notas_digitales av ON av.id = avd.nota_id AND av.tipo = 'aviso' AND av.es_prueba = 0 AND av.estado = 'enviada'
       WHERE ${CONDICION_BASE} AND COALESCE(avd.cuenta_desde, av.fecha) <= DATE_SUB(?, INTERVAL ? DAY)
       UNION ALL
       SELECT ${COLUMNAS_DATASET}, NULL, NULL, NULL, NULL, ${REITERACIONES_PREVIAS}
       ${DESDE_DATASETS}
       WHERE ${CONDICION_BASE} AND d.proxima_actualizacion < ? AND ${SIN_AVISO}
     ) AS x
     ORDER BY x.vencimiento, x.titulo, x.id, x.aviso_fecha, x.aviso_id`,
    [gestion, hoy, DIAS_PARA_REITERAR, gestion, hoy]
  );
  const porDataset = new Map();
  for (const { aviso_numero, aviso_anio, aviso_fecha, aviso_id, reiteraciones, ...dataset } of filas) {
    const aviso = aviso_fecha ? { numero: aviso_numero, anio: aviso_anio, fecha: aviso_fecha } : null;
    const anterior = porDataset.get(dataset.id);
    if (!anterior) porDataset.set(dataset.id, { ...dataset, informado: aviso, reiteraciones: Number(reiteraciones) });
    // Los demás avisos del mismo dataset: la guarda evita que un dato inesperado (informado null) tire la reiteración de la gestión
    // entera, todos los días
    else if (anterior.informado && aviso) (anterior.informado.tambien ??= []).push(aviso);
  }
  return [...porDataset.values()].map(dataset => conPedido(dataset, hoy));
};

// Aviso en su fecha con persona autorizada (spec 2026-10-15-dias-habiles-licencias-auditoria, 7.6): los datasets de la
// gestión que se avisaron por adelantado en la víspera de la licencia del titular y todavía no tuvieron su aviso en su fecha.
// licencia: { desde, hasta } del titular; ausencias: [{ desde, hasta }] de la persona autorizada (diaDelAvisoEnSuFecha).
// Un dataset entra si tiene exactamente una fila de aviso (de cualquier estado, sin pruebas) en su vencimiento actual y su
// cuenta_desde cae dentro de la licencia; si se actualizó, o ya tuvo otro aviso, no. Cada uno trae cuenta_desde, adelantado
// (la nota que lo adelantó, solo si se envió) y dia_en_su_fecha. Solo salen los que tienen ese día. No filtra por
// dia_en_su_fecha <= hoy: lo hacen la corrida (sale hoy lo que tocaba hoy o antes) y el Estado (el próximo aviso). Con el
// pedido calculado con hoy.
// aviso_estado es el estado del aviso anticipado ('pendiente', 'enviada' o 'fallida'), arriba de todo y no dentro de
// adelantado: la corrida y el Estado lo usan para saber si a ese dataset ya le toca la reiteración (que solo toma avisos enviados).
// adelantado es null si el aviso anticipado no se envió: el dataset entra igual, pero el aviso en su fecha no cita una nota
// que el área nunca recibió (spec 2026-10-15, 7.6).
export const pendientesEnSuFecha = async (gestion, hoy, licencia, ausencias = []) => {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS_DATASET}, DATE_FORMAT(avd.cuenta_desde, '%Y-%m-%d') AS cuenta_desde,
            av.numero AS aviso_numero, av.anio AS aviso_anio, DATE_FORMAT(av.fecha, '%Y-%m-%d') AS aviso_fecha,
            av.estado AS aviso_estado
     ${DESDE_DATASETS}
     JOIN notas_digitales_datasets avd ON avd.dataset_id = d.id AND avd.vencimiento = d.proxima_actualizacion
     JOIN notas_digitales av ON av.id = avd.nota_id AND av.tipo = 'aviso' AND av.es_prueba = 0
     WHERE ${CONDICION_BASE} AND d.proxima_actualizacion >= ?
       AND avd.cuenta_desde BETWEEN ? AND ?
       AND (SELECT COUNT(*) FROM notas_digitales_datasets otro
              JOIN notas_digitales otra ON otra.id = otro.nota_id
             WHERE otro.dataset_id = d.id AND otro.vencimiento = d.proxima_actualizacion
               AND otra.tipo = 'aviso' AND otra.es_prueba = 0) = 1
     ORDER BY d.proxima_actualizacion, d.titulo, d.id`,
    [gestion, hoy, licencia.desde, licencia.hasta]
  );
  return filas
    .map(({ aviso_numero, aviso_anio, aviso_fecha, aviso_estado, ...dataset }) => ({
      ...conPedido(dataset, hoy),
      adelantado: aviso_estado === 'enviada' ? { numero: aviso_numero, anio: aviso_anio, fecha: aviso_fecha } : null,
      aviso_estado,
      dia_en_su_fecha: diaDelAvisoEnSuFecha({ cuentaDesde: dataset.cuenta_desde, licencia, ausencias })
    }))
    .filter(dataset => dataset.dia_en_su_fecha !== null);
};

// Vencimiento que abre el próximo aviso de la gestión: el primer vencimiento del mes más próximo que tiene datasets a
// vencer (no vencidos, que van a la reiteración) sin aviso; null si no hay ninguno. El aviso sale cuando ese
// vencimiento entra en la ventana.
export const aperturaDelProximoAviso = async (gestion, hoy) => {
  const [[fila]] = await pool.query(
    `SELECT DATE_FORMAT(${PRIMER_VENCIMIENTO_DEL_MES}, '%Y-%m-%d') AS apertura ${DESDE_DATASETS}
     WHERE ${CONDICION_BASE} AND d.proxima_actualizacion >= ? AND ${SIN_AVISO}
     ORDER BY apertura LIMIT 1`,
    [gestion, hoy]
  );
  return fila?.apertura ?? null;
};

export const antecedentesDe = async (ids) => {
  if (ids.length === 0) return new Map();
  const [filas] = await pool.query(
    `SELECT d.id, COUNT(l.id) AS cantidad,
            DATE_FORMAT(MIN(l.enviado_at), '%Y-%m-%d') AS primera,
            DATE_FORMAT(MAX(l.enviado_at), '%Y-%m-%d') AS ultima
     FROM datasets d
     JOIN notificaciones_log l ON FIND_IN_SET(d.id, REPLACE(l.datasets_ids, ' ', '')) > 0
     WHERE d.id IN (?) AND l.success = 1 AND l.tipo IN (?)
       AND (d.ultima_actualizacion IS NULL OR l.enviado_at > d.ultima_actualizacion)
     GROUP BY d.id`,
    [ids, TIPOS_EMAIL_REEMPLAZADOS]
  );
  return new Map(filas.map(f => [f.id, { cantidad: Number(f.cantidad), primera: f.primera, ultima: f.ultima }]));
};

// Ficha completa de cada dataset para el anexo de los avisos (spec 6.7). Las fechas salen como 'AAAA-MM-DD'.
// Cada ficha trae su pedido (conPedido) calculado con hoy, el día de la nota; sin hoy, el de su vencimiento tal cual.
export const fichasDe = async (ids, hoy = null) => {
  if (ids.length === 0) return new Map();
  const [filas] = await pool.query(
    `SELECT d.id, d.titulo, d.descripcion, d.observaciones, d.url_dataset, d.tipo_gestion, f.nombre AS frecuencia_nombre,
            DATE_FORMAT(d.ultima_actualizacion, '%Y-%m-%d') AS ultima_actualizacion,
            DATE_FORMAT(d.proxima_actualizacion, '%Y-%m-%d') AS vencimiento,
            f.meses, DATE_FORMAT(d.datos_al, '%Y-%m-%d') AS datos_al, d.tipo_pedido,
            tp.nombre AS tema_principal, ts.nombre AS tema_secundario,
            (SELECT GROUP_CONCAT(fo.nombre ORDER BY fo.nombre SEPARATOR ', ')
               FROM dataset_formatos df JOIN formatos fo ON fo.id = df.formato_id WHERE df.dataset_id = d.id) AS formatos,
            d.que_se_solicita,
            a.nombre AS area_nombre, a.area_superior, a.email_principal, a.email_secundario, a.telefono_area, a.celular_area,
            a.nombre_contacto, a.telefono_contacto, a.email_contacto
     FROM datasets d
     JOIN frecuencias f ON f.id = d.frecuencia_id
     JOIN areas a ON a.id = d.area_id
     LEFT JOIN temas tp ON tp.id = d.tema_principal_id
     LEFT JOIN temas ts ON ts.id = d.tema_secundario_id
     WHERE d.id IN (?)`,
    [ids]
  );
  return new Map(filas.map(f => [f.id, conPedido(f, hoy)]));
};

export const areasDe = async (ids) => {
  if (ids.length === 0) return [];
  const [filas] = await pool.query(
    `SELECT id, nombre, area_superior, email_principal, email_secundario, telefono_area, celular_area,
            nombre_contacto, telefono_contacto, email_contacto
     FROM areas WHERE id IN (?) ORDER BY nombre`,
    [ids]
  );
  return filas;
};
