// Consultas de Notas Digitales: configuración y selección de datasets.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (secciones 5 y 6.4)
import pool from '../config/database.js';

export const VENTANA_DIAS = { interna: 60, externa: 30 };
export const DIAS_PARA_REITERAR = 21;
export const TIPOS_EMAIL_REEMPLAZADOS = ['interno-60', 'interno-30', 'interno-vencido', 'externo-60', 'externo-40', 'externo-5', 'externo-vencido'];

const COLUMNAS_DATASET = `
  d.id, d.titulo, d.url_dataset, d.area_id, a.nombre AS area_nombre, f.nombre AS frecuencia_nombre,
  DATE_FORMAT(d.ultima_actualizacion, '%Y-%m-%d') AS ultima_actualizacion,
  DATE_FORMAT(d.proxima_actualizacion, '%Y-%m-%d') AS vencimiento`;
const DESDE_DATASETS = `
  FROM datasets d
  JOIN frecuencias f ON f.id = d.frecuencia_id
  JOIN areas a ON a.id = d.area_id`;
const CONDICION_BASE = 'd.activo = TRUE AND d.tipo_gestion = ? AND f.dias IS NOT NULL AND d.proxima_actualizacion IS NOT NULL';
// Sin aviso (de cualquier estado, sin contar pruebas) para su vencimiento actual
const SIN_AVISO = `NOT EXISTS (
  SELECT 1 FROM notas_digitales_datasets ndd
  JOIN notas_digitales n ON n.id = ndd.nota_id
  WHERE ndd.dataset_id = d.id AND ndd.vencimiento = d.proxima_actualizacion
    AND n.tipo = 'aviso' AND n.es_prueba = 0)`;

export const obtenerConfig = async () => {
  const [filas] = await pool.query('SELECT * FROM notas_digitales_config WHERE id = 1');
  if (!filas[0]) throw new Error('Falta la configuración de Notas Digitales (notas_digitales_config)');
  return filas[0];
};

export const seleccionarParaAviso = async (gestion, hoy) => {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS_DATASET} ${DESDE_DATASETS}
     WHERE ${CONDICION_BASE}
       AND d.proxima_actualizacion <= DATE_ADD(?, INTERVAL ? DAY)
       AND ${SIN_AVISO}
     ORDER BY d.proxima_actualizacion, d.titulo`,
    [gestion, hoy, VENTANA_DIAS[gestion]]
  );
  return filas;
};

export const seleccionarParaReiteracion = async (gestion, hoy) => {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS_DATASET},
            av.numero AS aviso_numero, av.anio AS aviso_anio, DATE_FORMAT(av.fecha, '%Y-%m-%d') AS aviso_fecha,
            (SELECT COUNT(*) FROM notas_digitales_datasets r
               JOIN notas_digitales rn ON rn.id = r.nota_id
              WHERE r.dataset_id = d.id AND r.vencimiento = d.proxima_actualizacion
                AND rn.tipo = 'reiteracion' AND rn.es_prueba = 0 AND rn.estado = 'enviada') AS reiteraciones
     ${DESDE_DATASETS}
     JOIN notas_digitales_datasets avd ON avd.dataset_id = d.id AND avd.vencimiento = d.proxima_actualizacion
     JOIN notas_digitales av ON av.id = avd.nota_id AND av.tipo = 'aviso' AND av.es_prueba = 0 AND av.estado = 'enviada'
     WHERE ${CONDICION_BASE}
       AND av.fecha <= DATE_SUB(?, INTERVAL ? DAY)
     ORDER BY d.proxima_actualizacion, d.titulo`,
    [gestion, hoy, DIAS_PARA_REITERAR]
  );
  return filas.map(({ aviso_numero, aviso_anio, aviso_fecha, reiteraciones, ...dataset }) => ({
    ...dataset,
    informado: { numero: aviso_numero, anio: aviso_anio, fecha: aviso_fecha },
    reiteraciones: Number(reiteraciones)
  }));
};

export const pendientesDeAviso = async (gestion) => {
  const [filas] = await pool.query(
    `SELECT DATE_FORMAT(d.proxima_actualizacion, '%Y-%m-%d') AS vencimiento ${DESDE_DATASETS}
     WHERE ${CONDICION_BASE} AND ${SIN_AVISO}
     ORDER BY d.proxima_actualizacion`,
    [gestion]
  );
  return filas.map(f => f.vencimiento);
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
