// Las licencias de Configuración → Licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, sección 5, y 6.3): el alta, la
// edición y la anulación, con sus reglas. Las usan Configuración (controllers/licenciasController.js) y Mi espacio (spec
// 2026-10-26-mi-espacio-licencias-y-horas, 6). Reciben la conexión de una transacción abierta y a quien hace el cambio (el actor),
// nunca el pedido: no abren ni cierran la transacción, y quien llama bloquea antes (bloquearUsuarios). Si algo no se puede,
// devuelven { rechazo } sin escribir nada: un Rechazo es { status, error, campo, motivo }, con el status, el mensaje y el campo
// que responde Configuración y el motivo, para que Mi espacio decida qué hacer:
// - 'fechas' (fechas inválidas en un alta), 'edicion' (las que no admite la edición, con el status de validarEdicion),
//   'no_encontrada', 'solo_titular' y 'no_se_anula';
// - los de rechazoDeLaBase: 'rol', 'superpuesta', 'no_es_titular', 'no_autorizable' y 'autorizado_sin_dias'.
import pool from '../config/database.js';
import { registrarAuditoria } from './usuariosAuditoriaService.js';
import { ahoraArgentina, formatoCorto, sumarDias, proximoDiaHabil } from './notasDigitalesCalendario.js';
import { puedeTenerLicencia, validarFechasNuevas, validarEdicion, puedeAnularse, unirAusencias } from './licenciasReglas.js';
import { disponibilidadDelAutorizado } from './notasDigitalesFirmas.js';

export const MENSAJE_SOLO_TITULAR = 'La autorización para presentar las notas la da solo el firmante titular.';
const MENSAJE_NO_ENCONTRADA = 'Licencia no encontrada';

export const periodo = ({ desde, hasta }) => `del ${formatoCorto(desde)} al ${formatoCorto(hasta)}`;

const rechazar = (motivo, status, error, campo = null) => ({ status, error, campo, motivo });

// Las columnas de una licencia. desde_mi_espacio: la creó Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, 6), con
// EXISTS y no con un JOIN: varias filas unidas pueden apuntar a la misma licencia, y una unida no la hace de Mi espacio
export const COLUMNAS_LICENCIA = `
  l.id, l.usuario_id, DATE_FORMAT(l.desde, '%Y-%m-%d') AS desde, DATE_FORMAT(l.hasta, '%Y-%m-%d') AS hasta,
  l.autorizado_id, DATE_FORMAT(l.autorizado_at, '%Y-%m-%d %H:%i') AS autorizado_at, l.anulada, l.creado_por,
  u.nombre_completo AS usuario_nombre, u.username AS usuario_username, u.rol AS usuario_rol,
  au.nombre_completo AS autorizado_nombre, cr.nombre_completo AS creado_por_nombre,
  EXISTS (SELECT 1 FROM mi_espacio_licencias m WHERE m.licencia_oficial_id = l.id AND m.oficial = 'creada' AND m.activo = 1)
    AS desde_mi_espacio`;
export const DESDE_LICENCIA = `
  FROM usuarios_licencias l
  JOIN usuarios u ON u.id = l.usuario_id
  LEFT JOIN usuarios au ON au.id = l.autorizado_id
  LEFT JOIN usuarios cr ON cr.id = l.creado_por`;

export const firmanteTitular = async (conexion = pool) => {
  const [[config]] = await conexion.query('SELECT firmante_usuario_id FROM notas_digitales_config WHERE id = 1');
  return config?.firmante_usuario_id ?? null;
};

export const buscarLicenciaOficial = async (conexion, id) => {
  const [filas] = await conexion.query(`SELECT ${COLUMNAS_LICENCIA} ${DESDE_LICENCIA} WHERE l.id = ?`, [id]);
  return filas[0] ?? null;
};

// Admins y editores que el titular puede autorizar (spec 6.3): activos, con contraseña y con la imagen de su firma
export const autorizables = async (conexion, titular) => {
  const [filas] = await conexion.query(
    `SELECT u.id, u.nombre_completo FROM usuarios u JOIN usuarios_firmas f ON f.usuario_id = u.id
     WHERE u.rol IN ('admin', 'editor') AND u.activo = TRUE AND u.password_hash IS NOT NULL AND f.imagen IS NOT NULL
       AND u.id <> ?
     ORDER BY u.nombre_completo`,
    [titular ?? 0]
  );
  return filas;
};

// Las licencias en curso y futuras (no anuladas) de cada persona autorizable, para que el formulario advierta una
// superposición con la licencia del titular. ausencias: esas licencias unidas como en el Estado (seguidas o separadas solo
// por días no hábiles, licenciasReglas.unirAusencias), con vuelve, el primer día hábil después de cada una
export const conSusLicencias = async (personas, hoy) => {
  if (!personas.length) return personas;
  const [filas] = await pool.query(
    `SELECT usuario_id, DATE_FORMAT(desde, '%Y-%m-%d') AS desde, DATE_FORMAT(hasta, '%Y-%m-%d') AS hasta
     FROM usuarios_licencias WHERE anulada = 0 AND hasta >= ? AND usuario_id IN (?) ORDER BY desde`,
    [hoy, personas.map(p => p.id)]
  );
  return personas.map((p) => {
    const licencias = filas.filter(f => f.usuario_id === p.id).map(({ desde, hasta }) => ({ desde, hasta }));
    const ausencias = unirAusencias(licencias).map(a => ({ ...a, vuelve: proximoDiaHabil(sumarDias(a.hasta, 1)) }));
    return { ...p, licencias, ausencias };
  });
};

/**
 * Reglas que necesitan la base (spec 5.2 y 6.3). autorizadoNuevo: la autorización se está dando o cambiando en este
 * pedido. Solo entonces se controla a la persona elegida: que sea la licencia del titular, que se la pueda autorizar y que
 * le quede algún día hábil en toda la licencia (notasDigitalesFirmas.disponibilidadDelAutorizado; el titular y ella pueden
 * faltar algunos días a la vez). Cambiar solo las fechas no la vuelve a controlar: con ella de licencia todos los días, ni el
 * titular ni administración (que no puede cambiar a la persona autorizada) podrían corregir la licencia.
 * La licencia propia de la persona autorizada no se controla (decisión del usuario, 27/10/2026): se guarda aunque no le
 * quede ningún día hábil de la del titular, y esos días son «sin autorizado» (firmaParaFecha mira cada día: no se presenta
 * ninguna nota y lo pendiente sale a la vuelta).
 * Devuelve el Rechazo si no se puede, o null.
 */
export const rechazoDeLaBase = async (conexion, { licenciaId = 0, usuarioId, desde, hasta, autorizadoId, autorizadoNuevo }) => {
  const [[usuario]] = await conexion.query('SELECT rol, activo FROM usuarios WHERE id = ?', [usuarioId]);
  if (!usuario || !usuario.activo || !puedeTenerLicencia(usuario.rol)) {
    return rechazar('rol', 400, 'Solo pueden tener licencia el superadmin, los admins y los editores activos.', 'usuario_id');
  }
  const [[propia]] = await conexion.query(
    `SELECT DATE_FORMAT(desde, '%Y-%m-%d') AS desde, DATE_FORMAT(hasta, '%Y-%m-%d') AS hasta FROM usuarios_licencias
     WHERE usuario_id = ? AND anulada = 0 AND id <> ? AND desde <= ? AND hasta >= ? LIMIT 1`,
    [usuarioId, licenciaId, hasta, desde]
  );
  if (propia) return rechazar('superpuesta', 409, `Se superpone con otra licencia de la misma persona (${periodo(propia)}).`, 'fechas');
  if (autorizadoId && autorizadoNuevo) {
    const titular = await firmanteTitular(conexion);
    if (usuarioId !== titular) return rechazar('no_es_titular', 400, 'Solo la licencia del firmante titular de las notas lleva una persona autorizada.', 'autorizado_id');
    if (!(await autorizables(conexion, titular)).some(a => a.id === autorizadoId)) {
      return rechazar('no_autorizable', 400, 'Solo se puede autorizar a un admin o editor activo, con su firma cargada en Mi Perfil.', 'autorizado_id');
    }
    const disponible = await disponibilidadDelAutorizado({ desde, hasta, autorizado_id: autorizadoId }, { conexion });
    if (!disponible) {
      return rechazar('autorizado_sin_dias', 409, 'La persona autorizada está de licencia todos los días hábiles de tu licencia: no podría presentar ninguna nota.', 'autorizado_id');
    }
  }
  return null;
};

// Bloquea las filas de usuarios (son pocas) hasta el fin de la transacción, como el panel: dos cargas simultáneas para
// la misma persona se esperan y la segunda ve la primera
export const bloquearUsuarios = (conexion) => conexion.query('SELECT id FROM usuarios ORDER BY id FOR UPDATE');

/**
 * El alta: las fechas, las reglas de la base, la licencia y su historial (licencia_cargada). autorizadoId: la persona
 * autorizada (solo en la licencia del titular, cargada por él: Configuración lo controla antes). La licencia la carga el actor.
 * Devuelve { licencia, auditoriaId } o { rechazo }.
 */
export const cargarLicencia = async (conexion, { usuarioId, desde, hasta, autorizadoId = null, actorId, hoy }) => {
  const errorFechas = validarFechasNuevas({ desde, hasta }, hoy);
  if (errorFechas) return { rechazo: rechazar('fechas', 400, errorFechas, 'fechas') };
  const rechazo = await rechazoDeLaBase(conexion, { usuarioId, desde, hasta, autorizadoId, autorizadoNuevo: Boolean(autorizadoId) });
  if (rechazo) return { rechazo };
  const [resultado] = await conexion.query(
    'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, autorizado_id, autorizado_at, creado_por) VALUES (?, ?, ?, ?, ?, ?)',
    [usuarioId, desde, hasta, autorizadoId, autorizadoId ? ahoraArgentina() : null, actorId]
  );
  const licencia = await buscarLicenciaOficial(conexion, resultado.insertId);
  const auditoriaId = await registrarAuditoria(conexion, {
    usuarioId, actorId, accion: 'licencia_cargada',
    detalle: { licencia_id: licencia.id, desde: licencia.desde, hasta: licencia.hasta, autorizado_id: licencia.autorizado_id }
  });
  return { licencia, auditoriaId };
};

/**
 * La edición: fechas según el estado (spec 5.2) y, solo el titular, la persona autorizada (6.3). autorizadoPedido: undefined si
 * no se dice nada de ella, null para "nadie" o un id. Si no cambia nada (las mismas fechas y la misma persona autorizada), no
 * escribe: así no se pierde la nota de autorización. Devuelve { antes, despues, auditoriaId, sinCambios } o { rechazo }.
 */
export const cambiarLicencia = async (conexion, { licenciaId, desde, hasta, autorizadoPedido, actorId, hoy }) => {
  const antes = await buscarLicenciaOficial(conexion, licenciaId);
  if (!antes) return { rechazo: rechazar('no_encontrada', 404, MENSAJE_NO_ENCONTRADA) };
  const { error, codigo, datos } = validarEdicion(antes, { desde, hasta }, hoy);
  if (error) return { rechazo: rechazar('edicion', codigo, error, 'fechas') };
  const autorizadoCambia = autorizadoPedido !== undefined && autorizadoPedido !== antes.autorizado_id;
  if (autorizadoCambia && actorId !== antes.usuario_id) return { rechazo: rechazar('solo_titular', 403, MENSAJE_SOLO_TITULAR, 'autorizado_id') };
  const autorizadoId = autorizadoCambia ? autorizadoPedido : antes.autorizado_id;
  const rechazo = await rechazoDeLaBase(conexion, {
    licenciaId, usuarioId: antes.usuario_id, ...datos, autorizadoId, autorizadoNuevo: autorizadoCambia
  });
  if (rechazo) return { rechazo };
  if (datos.desde === antes.desde && datos.hasta === antes.hasta && !autorizadoCambia) {
    return { antes, despues: antes, auditoriaId: null, sinCambios: true };
  }
  // Columnas fijas del código; los valores van como parámetros
  const asignaciones = ['desde = ?', 'hasta = ?'];
  const valores = [datos.desde, datos.hasta];
  if (autorizadoCambia) {
    asignaciones.push('autorizado_id = ?', 'autorizado_at = ?');
    valores.push(autorizadoId, autorizadoId ? ahoraArgentina() : null);
  }
  // La nota de autorización dice a quién y entre qué fechas: si cambia algo, deja de valer y sale otra (spec 6.3)
  asignaciones.push('nota_autorizacion_id = NULL');
  await conexion.query(`UPDATE usuarios_licencias SET ${asignaciones.join(', ')} WHERE id = ?`, [...valores, licenciaId]);
  const despues = await buscarLicenciaOficial(conexion, licenciaId);
  const auditoriaId = await registrarAuditoria(conexion, {
    usuarioId: antes.usuario_id, actorId, accion: 'licencia_editada',
    detalle: {
      licencia_id: licenciaId,
      antes: { desde: antes.desde, hasta: antes.hasta, autorizado_id: antes.autorizado_id },
      despues: { desde: despues.desde, hasta: despues.hasta, autorizado_id: despues.autorizado_id }
    }
  });
  return { antes, despues, auditoriaId, sinCambios: false };
};

/**
 * La anulación: solo si todavía no empezó o empieza hoy (spec 5.2); deja el historial (licencia_anulada).
 * Devuelve { licencia (ya anulada), auditoriaId } o { rechazo }.
 */
export const anularLicenciaDe = async (conexion, { licenciaId, actorId, hoy }) => {
  const licencia = await buscarLicenciaOficial(conexion, licenciaId);
  if (!licencia) return { rechazo: rechazar('no_encontrada', 404, MENSAJE_NO_ENCONTRADA) };
  if (!puedeAnularse(licencia, hoy)) {
    return { rechazo: rechazar('no_se_anula', 409, 'Solo se puede anular una licencia que todavía no empezó o que empieza hoy. Para cortar una licencia en curso, cambiá la fecha de fin.') };
  }
  await conexion.query('UPDATE usuarios_licencias SET anulada = 1 WHERE id = ?', [licenciaId]);
  const auditoriaId = await registrarAuditoria(conexion, {
    usuarioId: licencia.usuario_id, actorId, accion: 'licencia_anulada',
    detalle: { licencia_id: licenciaId, desde: licencia.desde, hasta: licencia.hasta }
  });
  return { licencia: await buscarLicenciaOficial(conexion, licenciaId), auditoriaId };
};
