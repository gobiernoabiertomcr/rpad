// Lecturas de la auditoría de cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 3, 8, 9 y 10): quiénes
// están disponibles cada día, el canal de cada cambio pendiente y los cambios de la nota de auditoría. Las reglas están
// en auditoriaReglas.js; "disponible" se calcula solo acá, con la única definición (auditoriaReglas.disponibilidad).
import pool from '../config/database.js';
import { obtenerConfig, configuracionCompleta } from './notasDigitalesDatos.js';
import { firmaParaFecha, firmaTitularDe } from './notasDigitalesFirmas.js';
import { listaDeCorreos } from './emailService.js';
import { hoyArgentina, esDiaHabil, sumarDias } from './notasDigitalesCalendario.js';
import { canalDelCambio, seccionDeAuditoria, disponibilidad, agruparDiasSinAuditor, quienesAuditan } from './auditoriaReglas.js';

// Hasta cuántos días hacia adelante se busca el día en que vuelve a haber un auditor (o alguien que audite un cambio)
export const DIAS_BUSQUEDA_AUDITOR = 366;
// Los períodos sin auditor que muestran Correos → Estado y, sin fechas, la API: de hoy a hoy + 60 días
export const DIAS_PERIODOS_SIN_AUDITOR = 60;

/**
 * Superadmins, admins y editores (del nombre a la Z) y sus licencias no anuladas que se cruzan con [desde, hasta]: dos
 * consultas para todo el rango. licenciaSimulada ({ usuario_id, desde, hasta }): cuenta como una licencia más (una que
 * todavía no se guardó). excluirLicenciaId: esa licencia guardada no cuenta (la que se está editando).
 * { usuarios: [{ id, username, nombre_completo, email, rol, activo, tiene_contrasena }], licencias: Map usuario_id → [{ desde, hasta }] }
 */
const leerPersonasYLicencias = async (desde, hasta, { licenciaSimulada = null, excluirLicenciaId = null, conexion = pool } = {}) => {
  const [filas] = await conexion.query(
    `SELECT u.id, u.username, u.nombre_completo, u.email, u.rol, u.activo, (u.password_hash IS NOT NULL) AS tiene_contrasena
     FROM usuarios u
     WHERE u.rol IN ('superadmin', 'admin', 'editor')
     ORDER BY u.nombre_completo, u.id`
  );
  const [guardadas] = await conexion.query(
    `SELECT usuario_id, DATE_FORMAT(desde, '%Y-%m-%d') AS desde, DATE_FORMAT(hasta, '%Y-%m-%d') AS hasta
     FROM usuarios_licencias
     WHERE anulada = 0 AND desde <= ? AND hasta >= ? AND id <> ?`,
    [hasta, desde, excluirLicenciaId ?? 0]
  );
  const licencias = new Map();
  for (const l of licenciaSimulada ? [...guardadas, licenciaSimulada] : guardadas) {
    if (!licencias.has(l.usuario_id)) licencias.set(l.usuario_id, []);
    licencias.get(l.usuario_id).push({ desde: l.desde, hasta: l.hasta });
  }
  const usuarios = filas.map(f => ({
    id: f.id, username: f.username, nombre_completo: f.nombre_completo, email: f.email, rol: f.rol,
    activo: Boolean(Number(f.activo)), tiene_contrasena: Boolean(Number(f.tiene_contrasena))
  }));
  return { usuarios, licencias };
};

// Las personas con su disponibilidad en la fecha (auditoriaReglas.disponibilidad, la única definición)
const personasEn = (fecha, { usuarios, licencias }) =>
  usuarios.map(u => ({ ...u, ...disponibilidad(u, licencias.get(u.id) ?? [], fecha) }));

/**
 * Superadmins, admins y editores, del nombre a la Z, con si están disponibles en la fecha (spec 3): activos, con la
 * contraseña definida y sin licencia ese día (no anulada, desde <= fecha <= hasta; ver auditoriaReglas.disponibilidad).
 * conexion: el pool o una conexión con transacción.
 * ausente_por_licencia: estaría disponible si no fuera por la licencia.
 * [{ id, username, nombre_completo, email, rol, activo, tiene_contrasena, de_licencia, ausente_por_licencia, disponible }]
 */
export const personasDeAuditoria = async (fecha, conexion = pool) =>
  personasEn(fecha, await leerPersonasYLicencias(fecha, fecha, { conexion }));

/**
 * Lo mismo que personasDeAuditoria para cada día hábil de [desde, hasta], sin una consulta por día: Map fecha → personas,
 * en orden. licenciaSimulada y excluirLicenciaId: los de leerPersonasYLicencias (para simular una licencia en el formulario).
 */
export const personasPorDia = async (desde, hasta, opciones = {}) => {
  const datos = await leerPersonasYLicencias(desde, hasta, opciones);
  const porDia = new Map();
  for (let fecha = desde; fecha <= hasta; fecha = sumarDias(fecha, 1)) {
    if (esDiaHabil(fecha)) porDia.set(fecha, personasEn(fecha, datos));
  }
  return porDia;
};

/**
 * Períodos sin auditor de [desde, hasta]: días hábiles seguidos en que ningún auditor (superadmin o admin) está disponible
 * (auditoriaReglas.agruparDiasSinAuditor). Un período que sigue después de hasta se corta en hasta; vuelve se busca hasta
 * DIAS_BUSQUEDA_AUDITOR días después. licenciaSimulada y excluirLicenciaId: los de leerPersonasYLicencias.
 * [{ desde, hasta, vuelve: 'AAAA-MM-DD' | null, respaldo: [nombre_completo] }]
 */
export const periodosSinAuditor = async (desde, hasta, { licenciaSimulada = null, excluirLicenciaId = null } = {}) => {
  const porDia = await personasPorDia(desde, sumarDias(hasta, DIAS_BUSQUEDA_AUDITOR), { licenciaSimulada, excluirLicenciaId });
  return agruparDiasSinAuditor([...porDia].map(([fecha, personas]) => ({ fecha, personas })), hasta);
};

/**
 * El primer día hábil desde `desde` (incluido) en que alguien que no propuso el cambio puede auditarlo (un auditor
 * disponible o, de respaldo, un editor disponible: auditoriaReglas.quienesAuditan). null si no hay ninguno en
 * DIAS_BUSQUEDA_AUDITOR días.
 */
export const proximoDiaConQuienAudite = async (proponenteId, desde) => {
  const porDia = await personasPorDia(desde, sumarDias(desde, DIAS_BUSQUEDA_AUDITOR));
  for (const [fecha, personas] of porDia) {
    if (quienesAuditan(personas, proponenteId).personas.length > 0) return fecha;
  }
  return null;
};

/**
 * Lo que necesita canalDelCambio en la fecha (spec 9.1): { personas, titulares, hayQuienFirme }.
 * titulares: el firmante titular o, sin titular elegido, los superadmins (Decisiones del plan 6).
 * hayQuienFirme (condición 4): la nota de auditoría puede salir ese día. Se cumple si el envío automático está activo, la
 * configuración de las notas está completa, hay un Para de auditoría y hay quién firme (firmaParaFecha no está en modo
 * 'sin_autorizado'; sin titular elegido firma la configuración de Correos). Si no, el cambio sigue por recordatorio:
 * el interruptor y la configuración no pueden dejar a un cambio sin recordatorio y sin nota.
 * config: la de Notas Digitales (se lee si no viene).
 */
export const contextoDeCanal = async (fecha, config = null) => {
  const configuracion = config ?? await obtenerConfig();
  const personas = await personasDeAuditoria(fecha);
  const titulares = configuracion.firmante_usuario_id
    ? [configuracion.firmante_usuario_id]
    : personas.filter(p => p.rol === 'superadmin').map(p => p.id);
  const { modo } = await firmaParaFecha(configuracion, fecha);
  const hayQuienFirme = Boolean(configuracion.envio_activo)
    && listaDeCorreos(configuracion.para_auditoria).length > 0
    && modo !== 'sin_autorizado'
    && configuracionCompleta(configuracion, await firmaTitularDe(configuracion)).length === 0;
  return { personas, titulares, hayQuienFirme };
};

const jsonDe = (valor) => (typeof valor === 'string' ? JSON.parse(valor) : valor ?? null);

/**
 * Cambios pendientes, del más viejo al más nuevo, con su canal en la fecha (spec 9.1). Cada uno suma:
 * fecha_propuesta ('AAAA-MM-DD' en hora de Argentina), antiguedad_segundos, primer_recordatorio_fecha ('AAAA-MM-DD' o null),
 * aviso_sin_auditores_at (cuándo se avisó a quien lo propuso que no tenía auditor disponible, o null) y canal ('nota' o
 * 'recordatorio').
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
            DATE_FORMAT(cp.aviso_sin_auditores_at, '%Y-%m-%d %H:%i:%s') AS aviso_sin_auditores_at,
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
     WHERE c.cambio_id IN (?) AND n.es_prueba = 0 AND n.tipo = 'auditoria'
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
