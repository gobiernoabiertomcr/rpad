// Consultas de Notas Digitales: configuración, selección de datasets y fichas del anexo.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (secciones 5, 6.4 y 6.7)
import pool from '../config/database.js';
import { listaDeCorreos } from './emailService.js';

export const GESTIONES = ['interna', 'externa'];
// Días de anticipación del aviso, por gestión. La externa pasó de 30 a 40 (pedido del usuario el 16/10/2026): el pedido
// formal a las áreas externas lleva unos 5 días hábiles más el circuito administrativo.
export const VENTANA_DIAS = { interna: 60, externa: 40 };
export const DIAS_PARA_REITERAR = 20;
export const TIPOS_EMAIL_REEMPLAZADOS = ['interno-60', 'interno-30', 'interno-vencido', 'externo-60', 'externo-40', 'externo-5', 'externo-vencido'];

const COLUMNAS_DATASET = `
  d.id, d.titulo, d.url_dataset, d.area_id, a.nombre AS area_nombre, f.nombre AS frecuencia_nombre,
  DATE_FORMAT(d.ultima_actualizacion, '%Y-%m-%d') AS ultima_actualizacion,
  DATE_FORMAT(d.proxima_actualizacion, '%Y-%m-%d') AS vencimiento`;
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

// Solo datasets a vencer (spec 5.2): los que vencen dentro de la ventana y los demás de la gestión que vencen el mismo
// mes que alguno que ya entró en ella. Como d es parte de su mes, "el primer vencimiento del mes está en la ventana"
// cubre las dos condiciones. Los vencidos sin aviso van a la reiteración (5.3).
// horizonte: hasta qué día se mira la ventana. Es hoy, salvo en la víspera de una licencia del firmante, en que es el
// último día hábil de la licencia (spec 2026-10-15-dias-habiles-licencias-auditoria, 7.3).
// apertura_mes: el primer vencimiento del mes de cada dataset (con él se calcula su fecha normal de aviso).
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
  return filas;
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
export const seleccionarParaReiteracion = async (gestion, hoy) => {
  const [filas] = await pool.query(
    `SELECT * FROM (
       SELECT ${COLUMNAS_DATASET}, av.numero AS aviso_numero, av.anio AS aviso_anio,
              DATE_FORMAT(av.fecha, '%Y-%m-%d') AS aviso_fecha, ${REITERACIONES_PREVIAS} AS reiteraciones
       ${DESDE_DATASETS}
       JOIN notas_digitales_datasets avd ON avd.dataset_id = d.id AND avd.vencimiento = d.proxima_actualizacion
       JOIN notas_digitales av ON av.id = avd.nota_id AND av.tipo = 'aviso' AND av.es_prueba = 0 AND av.estado = 'enviada'
       WHERE ${CONDICION_BASE} AND COALESCE(avd.cuenta_desde, av.fecha) <= DATE_SUB(?, INTERVAL ? DAY)
       UNION ALL
       SELECT ${COLUMNAS_DATASET}, NULL, NULL, NULL, ${REITERACIONES_PREVIAS}
       ${DESDE_DATASETS}
       WHERE ${CONDICION_BASE} AND d.proxima_actualizacion < ? AND ${SIN_AVISO}
     ) AS x
     ORDER BY x.vencimiento, x.titulo`,
    [gestion, hoy, DIAS_PARA_REITERAR, gestion, hoy]
  );
  return filas.map(({ aviso_numero, aviso_anio, aviso_fecha, reiteraciones, ...dataset }) => ({
    ...dataset,
    informado: aviso_fecha ? { numero: aviso_numero, anio: aviso_anio, fecha: aviso_fecha } : null,
    reiteraciones: Number(reiteraciones)
  }));
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
export const fichasDe = async (ids) => {
  if (ids.length === 0) return new Map();
  const [filas] = await pool.query(
    `SELECT d.id, d.titulo, d.descripcion, d.observaciones, d.url_dataset, d.tipo_gestion, f.nombre AS frecuencia_nombre,
            DATE_FORMAT(d.ultima_actualizacion, '%Y-%m-%d') AS ultima_actualizacion,
            DATE_FORMAT(d.proxima_actualizacion, '%Y-%m-%d') AS vencimiento,
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
  return new Map(filas.map(f => [f.id, f]));
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
