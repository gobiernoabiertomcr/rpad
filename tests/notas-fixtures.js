// Datos de prueba para los tests de Notas Digitales. Solo se usan sobre bases creadas con crearBaseDePrueba.
import crypto from 'crypto';
import { query } from './helpers.js';

const sufijo = () => crypto.randomBytes(3).toString('hex');

// Guarda: query() usa DB_NAME, que en .env apunta a la copia local de producción.
// Lo que borra o reescribe datos solo corre si la base activa es de prueba.
export const asegurarBaseDePrueba = async () => {
  const [{ base }] = await query('SELECT DATABASE() AS base');
  if (!/^rpad_test_[a-z0-9_]+$/.test(base ?? '')) {
    throw new Error('Los fixtures de Notas Digitales solo pueden borrar o modificar datos en una base rpad_test_* (la base activa no lo es)');
  }
};

export const crearArea = async (datos = {}) => {
  const fila = {
    nombre: `Área de prueba ${sufijo()}`, area_superior: null, email_principal: null, email_secundario: null,
    telefono_area: null, celular_area: null, nombre_contacto: null, telefono_contacto: null, email_contacto: null,
    ...datos
  };
  const columnas = Object.keys(fila);
  const resultado = await query(
    `INSERT INTO areas (${columnas.join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`,
    Object.values(fila)
  );
  return resultado.insertId;
};

// datosAl y tipoPedido (spec 2026-10-17-fechas-datasets, 6): sin ellos quedan en NULL, como un dataset sin cargar
export const crearDataset = async ({
  titulo = `Dataset de prueba ${sufijo()}`, gestion = 'interna', vencimiento, ultima = null, areaId,
  frecuencia = 'Anualmente', activo = 1, url = 'https://datos.comodoro.gov.ar/dataset/prueba', datosAl = null, tipoPedido = null
}) => {
  const [f] = await query('SELECT id FROM frecuencias WHERE nombre = ?', [frecuencia]);
  if (!f) throw new Error(`No existe la frecuencia ${frecuencia}`);
  const [tema] = await query('SELECT id FROM temas ORDER BY id LIMIT 1');
  const area = areaId ?? await crearArea();
  const resultado = await query(
    `INSERT INTO datasets (titulo, area_id, frecuencia_id, ultima_actualizacion, proxima_actualizacion,
       tema_principal_id, url_dataset, tipo_gestion, activo, datos_al, tipo_pedido)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [titulo, area, f.id, ultima, vencimiento ?? null, tema.id, url, gestion, activo, datosAl, tipoPedido]
  );
  return resultado.insertId;
};

export const crearNota = async ({
  tipo = 'aviso', gestion = 'interna', fecha, numero = null, anio, estado = 'enviada', esPrueba = 0, intentos = 1, datasets = []
}) => {
  const resultado = await query(
    `INSERT INTO notas_digitales (numero, anio, tipo, gestion, periodo, fecha, es_prueba, asunto, para, html, texto, pdf, estado, intentos)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Nota de prueba', 'prueba@rpad.test', '', '', '', ?, ?)`,
    [numero, anio ?? (esPrueba ? null : Number(fecha.slice(0, 4))), tipo, gestion,
      tipo === 'reiteracion' ? fecha.slice(0, 7) : null, fecha, esPrueba, estado, intentos]
  );
  for (const d of datasets) {
    await query('INSERT INTO notas_digitales_datasets (nota_id, dataset_id, seccion, vencimiento, cuenta_desde) VALUES (?, ?, ?, ?, ?)',
      [resultado.insertId, d.id, d.seccion ?? 'proximo', d.vencimiento, d.cuentaDesde ?? null]);
  }
  return resultado.insertId;
};

export const crearEmailViejo = ({ tipo, datasetIds, enviado, success = 1 }) => query(
  `INSERT INTO notificaciones_log (tipo, area_id, destinatarios, datasets_ids, cantidad_datasets, enviado_at, success)
   VALUES (?, NULL, 'mit@rpad.test', ?, ?, ?, ?)`,
  [tipo, datasetIds.join(','), datasetIds.length, enviado, success]
);

export const limpiarBase = async () => {
  await asegurarBaseDePrueba();
  await query('DELETE FROM notas_digitales');
  await query('DELETE FROM notificaciones_log');
  await query('DELETE FROM datasets');
  await query('DELETE FROM areas');
  await query(`UPDATE notas_digitales_config SET reiteracion_evaluada_interna = NULL, reiteracion_evaluada_externa = NULL,
    firma_imagen = NULL, firma_mime = NULL, membrete_imagen = NULL, membrete_mime = NULL, ultima_corrida_fecha = NULL, ultima_corrida_inicio = NULL, ultima_corrida_fin = NULL,
    ultima_corrida_resultado = NULL, ultima_corrida_con_errores = 0 WHERE id = 1`);
};

// Simula una falla de la base en un paso de la corrida: mientras corre fn, un trigger de la base de prueba
// rechaza el INSERT o UPDATE de la tabla (notas_digitales; usuarios_licencias para el registro de la nota de
// autorización; cambios_pendientes para el primer recordatorio) que cumpla la condición (texto fijo escrito en el test)
const TABLAS_CON_FALLA = ['notas_digitales', 'usuarios_licencias', 'cambios_pendientes'];
export const conFallaSimulada = async (evento, condicion, fn, tabla = 'notas_digitales') => {
  await asegurarBaseDePrueba();
  if (!['INSERT', 'UPDATE'].includes(evento)) throw new Error(`Evento inválido: ${evento}`);
  if (!TABLAS_CON_FALLA.includes(tabla)) throw new Error(`Tabla inválida: ${tabla}`);
  await query('DROP TRIGGER IF EXISTS falla_simulada');
  await query(`CREATE TRIGGER falla_simulada BEFORE ${evento} ON ${tabla} FOR EACH ROW
    BEGIN
      IF ${condicion} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falla simulada'; END IF;
    END`);
  try {
    return await fn();
  } finally {
    await query('DROP TRIGGER IF EXISTS falla_simulada');
  }
};

// Simula un cambio que otra persona hace mientras corre fn: después de cada INSERT de notas_digitales que cumpla la
// condición, un trigger de la base de prueba ejecuta la sentencia (texto fijo escrito en el test, sobre otra tabla)
export const conCambioSimulado = async (condicion, sentencia, fn) => {
  await asegurarBaseDePrueba();
  await query('DROP TRIGGER IF EXISTS cambio_simulado');
  await query(`CREATE TRIGGER cambio_simulado AFTER INSERT ON notas_digitales FOR EACH ROW
    BEGIN
      IF ${condicion} THEN ${sentencia}; END IF;
    END`);
  try {
    return await fn();
  } finally {
    await query('DROP TRIGGER IF EXISTS cambio_simulado');
  }
};

// Texto del pie del membrete que carga la migración (información pública)
export const PIE_MEMBRETE = 'www.comodoroweb.gov.ar – Moreno 815, Comodoro Rivadavia, Chubut.';

export const configurarNotas = async (cambios = {}) => {
  await asegurarBaseDePrueba();
  const valores = {
    envio_activo: 1, para_interna: 'mit@rpad.test', cc_interna: 'geo@rpad.test', para_externa: 'mit@rpad.test',
    cc_externa: 'adm@rpad.test', cco: 'respaldo@rpad.test', firma_nombre: 'Firma de Prueba',
    firma_cargo: 'Cargo de Prueba', casillas_prueba: 'prueba@rpad.test', membrete_pie: PIE_MEMBRETE, ...cambios
  };
  const columnas = Object.keys(valores);
  await query(`UPDATE notas_digitales_config SET ${columnas.map(c => `${c} = ?`).join(', ')} WHERE id = 1`, Object.values(valores));
};
