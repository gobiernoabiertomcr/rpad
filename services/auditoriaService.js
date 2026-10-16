// Lecturas de la auditoría de cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 3, 8, 9 y 10): quiénes
// están disponibles cada día, el canal de cada cambio pendiente y los cambios de la nota de auditoría. Las reglas están
// en auditoriaReglas.js; esta es la única definición de "disponible" del sistema.
import pool from '../config/database.js';
import { obtenerConfig } from './notasDigitalesDatos.js';
import { firmaParaFecha } from './notasDigitalesFirmas.js';
import { hoyArgentina } from './notasDigitalesCalendario.js';
import { canalDelCambio, seccionDeAuditoria } from './auditoriaReglas.js';

/**
 * Superadmins, admins y editores, del nombre a la Z, con si están disponibles en la fecha (spec 3): activos, con la
 * contraseña definida y sin licencia ese día (la misma condición que licenciasService.licenciaEnFecha: no anulada,
 * desde <= fecha <= hasta). conexion: el pool o una conexión con transacción.
 * ausente_por_licencia: estaría disponible si no fuera por la licencia.
 * [{ id, username, nombre_completo, email, rol, activo, tiene_contrasena, de_licencia, ausente_por_licencia, disponible }]
 */
export const personasDeAuditoria = async (fecha, conexion = pool) => {
  const [filas] = await conexion.query(
    `SELECT u.id, u.username, u.nombre_completo, u.email, u.rol, u.activo, (u.password_hash IS NOT NULL) AS tiene_contrasena,
       EXISTS (SELECT 1 FROM usuarios_licencias l
               WHERE l.usuario_id = u.id AND l.anulada = 0 AND l.desde <= ? AND l.hasta >= ?) AS de_licencia
     FROM usuarios u
     WHERE u.rol IN ('superadmin', 'admin', 'editor')
     ORDER BY u.nombre_completo, u.id`,
    [fecha, fecha]
  );
  return filas.map((f) => {
    const activo = Boolean(Number(f.activo));
    const tieneContrasena = Boolean(Number(f.tiene_contrasena));
    const deLicencia = Boolean(Number(f.de_licencia));
    return {
      id: f.id, username: f.username, nombre_completo: f.nombre_completo, email: f.email, rol: f.rol,
      activo, tiene_contrasena: tieneContrasena, de_licencia: deLicencia,
      ausente_por_licencia: activo && tieneContrasena && deLicencia, disponible: activo && tieneContrasena && !deLicencia
    };
  });
};

/**
 * Lo que necesita canalDelCambio en la fecha (spec 9.1): { personas, titulares, hayQuienFirme }.
 * titulares: el firmante titular o, sin titular elegido, los superadmins (Decisiones del plan 6).
 * hayQuienFirme: firmaParaFecha no está en modo 'sin_autorizado' (sin titular elegido firma la configuración de Correos).
 * config: la de Notas Digitales (se lee si no viene).
 */
export const contextoDeCanal = async (fecha, config = null) => {
  const configuracion = config ?? await obtenerConfig();
  const personas = await personasDeAuditoria(fecha);
  const titulares = configuracion.firmante_usuario_id
    ? [configuracion.firmante_usuario_id]
    : personas.filter(p => p.rol === 'superadmin').map(p => p.id);
  const { modo } = await firmaParaFecha(configuracion, fecha);
  return { personas, titulares, hayQuienFirme: modo !== 'sin_autorizado' };
};

const jsonDe = (valor) => (typeof valor === 'string' ? JSON.parse(valor) : valor ?? null);

/**
 * Cambios pendientes, del más viejo al más nuevo, con su canal en la fecha (spec 9.1). Cada uno suma:
 * fecha_propuesta ('AAAA-MM-DD' en hora de Argentina), antiguedad_segundos, primer_recordatorio_fecha ('AAAA-MM-DD' o null)
 * y canal ('nota' o 'recordatorio').
 * created_at es TIMESTAMP (un instante) y la base puede estar en UTC: su texto no es la hora argentina. Por eso la fecha
 * sale de UNIX_TIMESTAMP (hoyArgentina del instante) y la antigüedad, del reloj de la base en los dos extremos
 * (TIMESTAMPDIFF con NOW(), los dos en la zona de la sesión): ninguna depende de la zona de la base ni de la de Node.
 * contexto: el de contextoDeCanal para la fecha (se lee si no viene).
 */
export const cambiosConCanal = async (fecha, contexto = null) => {
  const ctx = contexto ?? await contextoDeCanal(fecha);
  const [filas] = await pool.query(
    `SELECT cp.id, cp.tipo_cambio, cp.dataset_id, cp.datos_nuevos, cp.datos_anteriores, cp.usuario_id,
            UNIX_TIMESTAMP(cp.created_at) AS creado_ts,
            TIMESTAMPDIFF(SECOND, cp.created_at, NOW()) AS antiguedad_segundos,
            DATE_FORMAT(cp.primer_recordatorio_at, '%Y-%m-%d') AS primer_recordatorio_fecha,
            d.titulo AS dataset_titulo, u.username AS usuario_username, u.nombre_completo AS usuario_nombre,
            u.cargo AS usuario_cargo
     FROM cambios_pendientes cp
     JOIN usuarios u ON u.id = cp.usuario_id
     LEFT JOIN datasets d ON d.id = cp.dataset_id
     WHERE cp.estado = 'pendiente'
     ORDER BY cp.created_at, cp.id`
  );
  return filas.map(({ creado_ts: creado, ...fila }) => {
    const cambio = {
      ...fila,
      datos_nuevos: jsonDe(fila.datos_nuevos),
      datos_anteriores: jsonDe(fila.datos_anteriores),
      antiguedad_segundos: Number(fila.antiguedad_segundos),
      fecha_propuesta: hoyArgentina(new Date(Number(creado) * 1000))
    };
    return { ...cambio, canal: canalDelCambio({ cambio, hoy: fecha, ...ctx }) };
  });
};

// Notas de auditoría (no de prueba, en cualquier estado) que incluyeron cada cambio, de la primera a la última:
// Map cambio_id → [{ numero, anio, fecha }]
export const notasDeAuditoriaDe = async (ids) => {
  if (ids.length === 0) return new Map();
  const [filas] = await pool.query(
    `SELECT c.cambio_id, n.numero, n.anio, DATE_FORMAT(n.fecha, '%Y-%m-%d') AS fecha
     FROM notas_digitales_cambios c JOIN notas_digitales n ON n.id = c.nota_id
     WHERE c.cambio_id IN (?) AND n.es_prueba = 0
     ORDER BY n.fecha, n.id`,
    [ids]
  );
  const porCambio = new Map();
  for (const f of filas) {
    if (!porCambio.has(f.cambio_id)) porCambio.set(f.cambio_id, []);
    porCambio.get(f.cambio_id).push({ numero: f.numero, anio: f.anio, fecha: f.fecha });
  }
  return porCambio;
};

/**
 * Cambios de la nota de auditoría de la fecha (spec 9.3): los del canal nota que nunca estuvieron en una nota de auditoría
 * (nuevos) y aquellos cuya última nota es de hace 5 días hábiles o más (reiterados). Cada reiterado suma solicitado:
 * { numero, anio, fecha } de la primera nota que lo incluyó y reiteraciones, cuántas lo incluyeron después de esa
 * (Decisiones del plan 5). Devuelve { nuevos, reiterados }.
 */
export const seleccionarParaAuditoria = async (fecha, contexto = null) => {
  const delCanal = (await cambiosConCanal(fecha, contexto)).filter(c => c.canal === 'nota');
  const previas = await notasDeAuditoriaDe(delCanal.map(c => c.id));
  const nuevos = [];
  const reiterados = [];
  for (const cambio of delCanal) {
    const notas = previas.get(cambio.id) ?? [];
    const seccion = seccionDeAuditoria(notas.at(-1)?.fecha ?? null, fecha);
    if (seccion === 'nuevo') nuevos.push(cambio);
    else if (seccion === 'reiterado') reiterados.push({ ...cambio, solicitado: { ...notas[0], reiteraciones: notas.length - 1 } });
  }
  return { nuevos, reiterados };
};

// Nombres de los catálogos para el detalle de los cambios de la nota de auditoría (spec 10.3): { areas, frecuencias,
// temas, formatos }, cada uno id → nombre. Los nombres de tabla salen de una lista fija del código.
export const catalogosParaAuditoria = async () => {
  const [[areas], [frecuencias], [temas], [formatos]] = await Promise.all(
    ['areas', 'frecuencias', 'temas', 'formatos'].map(tabla => pool.query(`SELECT id, nombre FROM ${tabla}`))
  );
  const porId = (filas) => Object.fromEntries(filas.map(f => [f.id, f.nombre]));
  return { areas: porId(areas), frecuencias: porId(frecuencias), temas: porId(temas), formatos: porId(formatos) };
};
