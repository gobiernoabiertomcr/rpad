// Licencias de quienes reciben avisos (spec 2026-10-15-dias-habiles-licencias-auditoria, sección 5). Las rutas exigen
// authMiddleware + adminOnly. La autorización para presentar las notas (6.3) la da solo el firmante titular.
import pool from '../config/database.js';
import { registrarAuditoria } from '../services/usuariosAuditoriaService.js';
import { avisarAlSuperadmin } from '../services/avisosSuperadminService.js';
import {
  hoyArgentina, ahoraArgentina, formatoCorto, diaHabilAnterior, esFechaIso, sumarDias, diasEntre, proximoDiaHabil
} from '../services/notasDigitalesCalendario.js';
import {
  ROLES_CON_LICENCIA, puedeTenerLicencia, estadoDeLicencia, validarFechasNuevas, validarEdicion, puedeAnularse, unirAusencias
} from '../services/licenciasReglas.js';
import { periodosSinAuditor, DIAS_PERIODOS_SIN_AUDITOR } from '../services/auditoriaService.js';
import { disponibilidadDelAutorizado } from '../services/notasDigitalesFirmas.js';

const MENSAJE_ERROR = 'Error interno del servidor';
const MENSAJE_SOLO_TITULAR = 'La autorización para presentar las notas la da solo el firmante titular.';
// Rango máximo de la consulta de días sin auditor, contando los dos extremos
const MAXIMO_DIAS_SIN_AUDITOR = 366;

const responderError = (res, status, error, campo) =>
  res.status(status).json({ success: false, error, ...(campo ? { campo } : {}) });

const idDe = (valor) => {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const periodo = ({ desde, hasta }) => `del ${formatoCorto(desde)} al ${formatoCorto(hasta)}`;

// autorizado_id del cuerpo: undefined si no vino, null para "nadie", un id o NaN si es inválido
const autorizadoDelCuerpo = (cuerpo) => {
  if (!Object.hasOwn(cuerpo, 'autorizado_id')) return undefined;
  const valor = cuerpo.autorizado_id;
  if (valor === null || valor === '') return null;
  return idDe(valor) ?? Number.NaN;
};

const COLUMNAS = `
  l.id, l.usuario_id, DATE_FORMAT(l.desde, '%Y-%m-%d') AS desde, DATE_FORMAT(l.hasta, '%Y-%m-%d') AS hasta,
  l.autorizado_id, DATE_FORMAT(l.autorizado_at, '%Y-%m-%d %H:%i') AS autorizado_at, l.anulada, l.creado_por,
  u.nombre_completo AS usuario_nombre, u.username AS usuario_username, u.rol AS usuario_rol,
  au.nombre_completo AS autorizado_nombre, cr.nombre_completo AS creado_por_nombre`;
const DESDE = `
  FROM usuarios_licencias l
  JOIN usuarios u ON u.id = l.usuario_id
  LEFT JOIN usuarios au ON au.id = l.autorizado_id
  LEFT JOIN usuarios cr ON cr.id = l.creado_por`;

const firmanteTitular = async (conexion = pool) => {
  const [[config]] = await conexion.query('SELECT firmante_usuario_id FROM notas_digitales_config WHERE id = 1');
  return config?.firmante_usuario_id ?? null;
};

const aRespuesta = (fila, hoy, titular) => ({
  ...fila,
  anulada: Boolean(fila.anulada),
  estado: estadoDeLicencia(fila, hoy),
  // Del firmante titular: el día en que saldrían los avisos anticipados si no hay autorizado (spec 7.3)
  vispera: fila.usuario_id === titular ? diaHabilAnterior(fila.desde) : null
});

const buscarLicencia = async (conexion, id) => {
  const [filas] = await conexion.query(`SELECT ${COLUMNAS} ${DESDE} WHERE l.id = ?`, [id]);
  return filas[0] ?? null;
};

// Admins y editores que el titular puede autorizar (spec 6.3): activos, con contraseña y con la imagen de su firma
const autorizables = async (conexion, titular) => {
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
const conSusLicencias = async (personas, hoy) => {
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
 * pedido (si no, solo se revisa que a la persona ya autorizada le quede algún día hábil con las fechas nuevas).
 * La persona autorizada y el titular pueden faltar algunos días a la vez: se rechaza solo si a ella no le queda ningún día
 * hábil en toda la licencia del titular (notasDigitalesFirmas.disponibilidadDelAutorizado). Cuentan todos sus días, no
 * solo desde hoy: si no, con ella de licencia hasta el final no se podría ni acortar una licencia en curso.
 * Devuelve [status, mensaje, campo] si no se puede, o null.
 */
const rechazoDeLaBase = async (conexion, { licenciaId = 0, usuarioId, desde, hasta, autorizadoId, autorizadoNuevo }) => {
  const [[usuario]] = await conexion.query('SELECT rol, activo FROM usuarios WHERE id = ?', [usuarioId]);
  if (!usuario || !usuario.activo || !puedeTenerLicencia(usuario.rol)) {
    return [400, 'Solo pueden tener licencia el superadmin, los admins y los editores activos.', 'usuario_id'];
  }
  const [[propia]] = await conexion.query(
    `SELECT DATE_FORMAT(desde, '%Y-%m-%d') AS desde, DATE_FORMAT(hasta, '%Y-%m-%d') AS hasta FROM usuarios_licencias
     WHERE usuario_id = ? AND anulada = 0 AND id <> ? AND desde <= ? AND hasta >= ? LIMIT 1`,
    [usuarioId, licenciaId, hasta, desde]
  );
  if (propia) return [409, `Se superpone con otra licencia de la misma persona (${periodo(propia)}).`, 'fechas'];
  // Las licencias en las que esta persona es la autorizada, superpuestas con la que se guarda (contándola, sin la versión
  // guardada si se edita)
  const [autorizaciones] = await conexion.query(
    `SELECT l.autorizado_id, u.nombre_completo, DATE_FORMAT(l.desde, '%Y-%m-%d') AS desde, DATE_FORMAT(l.hasta, '%Y-%m-%d') AS hasta
     FROM usuarios_licencias l JOIN usuarios u ON u.id = l.usuario_id
     WHERE l.autorizado_id = ? AND l.anulada = 0 AND l.id <> ? AND l.desde <= ? AND l.hasta >= ? ORDER BY l.desde`,
    [usuarioId, licenciaId, hasta, desde]
  );
  for (const comoAutorizada of autorizaciones) {
    const disponible = await disponibilidadDelAutorizado(comoAutorizada, {
      licenciaExtra: { desde, hasta }, excluirLicenciaId: licenciaId, conexion
    });
    if (!disponible) {
      return [409, `Es la persona autorizada a presentar las notas durante la licencia de ${comoAutorizada.nombre_completo} (${periodo(comoAutorizada)}) y con esta licencia no le quedaría ningún día hábil para hacerlo: primero hay que cambiar esa autorización.`, 'fechas'];
    }
  }
  if (autorizadoId && autorizadoNuevo) {
    const titular = await firmanteTitular(conexion);
    if (usuarioId !== titular) return [400, 'Solo la licencia del firmante titular de las notas lleva una persona autorizada.', 'autorizado_id'];
    if (!(await autorizables(conexion, titular)).some(a => a.id === autorizadoId)) {
      return [400, 'Solo se puede autorizar a un admin o editor activo, con su firma cargada en Mi Perfil.', 'autorizado_id'];
    }
  }
  if (autorizadoId) {
    const disponible = await disponibilidadDelAutorizado({ desde, hasta, autorizado_id: autorizadoId }, { conexion });
    if (!disponible) {
      return [409, 'La persona autorizada está de licencia todos los días hábiles de tu licencia: no podría presentar ninguna nota.', 'autorizado_id'];
    }
  }
  return null;
};

// Aviso al superadmin si la licencia es suya y el cambio lo hizo otro (spec 5.2); lo retiene si ya está de licencia
const avisarSiEsDelSuperadmin = (req, licencia, cambio, auditoriaId, hoy) => (licencia.usuario_rol === 'superadmin'
  ? avisarAlSuperadmin({
    actor: { id: req.user.userId, rol: req.user.rol },
    afectado: { nombre_completo: licencia.usuario_nombre, username: licencia.usuario_username },
    cambio, auditoriaId, hoy
  })
  : Promise.resolve());

// Bloquea las filas de usuarios (son pocas) hasta el fin de la transacción, como el panel: dos cargas simultáneas para
// la misma persona se esperan y la segunda ve la primera
const bloquearUsuarios = (conexion) => conexion.query('SELECT id FROM usuarios ORDER BY id FOR UPDATE');

// GET /usuarios/licencias
export const listarLicencias = async (req, res) => {
  try {
    const hoy = hoyArgentina();
    const todas = req.query.incluir_pasadas === '1';
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} ${DESDE} ${todas ? '' : 'WHERE l.anulada = 0 AND l.hasta >= ?'} ORDER BY l.desde, u.nombre_completo`,
      todas ? [] : [hoy]
    );
    const titular = await firmanteTitular();
    const [conLicencia] = await pool.query(
      'SELECT id, nombre_completo, rol FROM usuarios WHERE activo = TRUE AND rol IN (?) ORDER BY nombre_completo', [ROLES_CON_LICENCIA]
    );
    const soyTitular = titular !== null && titular === req.user.userId;
    res.json({
      success: true,
      data: {
        hoy,
        firmante_titular_id: titular,
        soy_titular: soyTitular,
        licencias: filas.map(f => aRespuesta(f, hoy, titular)),
        usuarios: conLicencia,
        autorizables: soyTitular ? await conSusLicencias(await autorizables(pool, titular), hoy) : []
      }
    });
  } catch (error) {
    console.error('Error listando licencias:', error);
    responderError(res, 500, MENSAJE_ERROR);
  }
};

/**
 * GET /usuarios/licencias/sin-auditor: los períodos sin auditor (días hábiles sin ningún superadmin ni admin disponible)
 * entre desde y hasta ('AAAA-MM-DD'; sin ninguna de las dos, de hoy a hoy + 60 días). Para que el formulario de licencias
 * advierta los que dejaría la licencia que se carga: usuario_id simula una licencia de esa persona con las mismas fechas,
 * y excluir es la licencia guardada que se está editando (no cuenta, para no contarla dos veces). Los dos piden desde y hasta.
 * { periodos: [{ desde, hasta, vuelve, respaldo }] }
 */
export const listarDiasSinAuditor = async (req, res) => {
  const hoy = hoyArgentina();
  const { usuario_id: usuarioPedido, excluir: excluirPedido } = req.query;
  const sinFechas = req.query.desde === undefined && req.query.hasta === undefined;
  // Simular o excluir una licencia necesita sus fechas: hoy a hoy + 60 es solo la consulta general
  if (sinFechas && (usuarioPedido !== undefined || excluirPedido !== undefined)) {
    return responderError(res, 400, 'Para simular o excluir una licencia hacen falta las dos fechas.', 'fechas');
  }
  const desde = sinFechas ? hoy : req.query.desde;
  const hasta = sinFechas ? sumarDias(hoy, DIAS_PERIODOS_SIN_AUDITOR) : req.query.hasta;
  if (!esFechaIso(desde) || !esFechaIso(hasta)) {
    return responderError(res, 400, 'Las fechas tienen que ser días válidos (AAAA-MM-DD).', 'fechas');
  }
  if (desde > hasta) return responderError(res, 400, 'La fecha de inicio no puede ser posterior a la de fin.', 'fechas');
  if (diasEntre(desde, hasta) + 1 > MAXIMO_DIAS_SIN_AUDITOR) {
    return responderError(res, 400, `El rango puede abarcar como máximo ${MAXIMO_DIAS_SIN_AUDITOR} días.`, 'fechas');
  }
  const usuarioId = usuarioPedido === undefined ? null : idDe(usuarioPedido);
  if (usuarioPedido !== undefined && !usuarioId) return responderError(res, 400, 'La persona no es válida.', 'usuario_id');
  const excluirId = excluirPedido === undefined ? null : idDe(excluirPedido);
  if (excluirPedido !== undefined && !excluirId) return responderError(res, 400, 'La licencia a excluir no es válida.', 'excluir');

  try {
    const periodos = await periodosSinAuditor(desde, hasta, {
      licenciaSimulada: usuarioId ? { usuario_id: usuarioId, desde, hasta } : null,
      excluirLicenciaId: excluirId
    });
    res.json({ success: true, data: { periodos } });
  } catch (error) {
    console.error('Error calculando los días sin auditor:', error);
    responderError(res, 500, MENSAJE_ERROR);
  }
};

// POST /usuarios/licencias
export const crearLicencia = async (req, res) => {
  const hoy = hoyArgentina();
  const cuerpo = req.body ?? {};
  const usuarioId = idDe(cuerpo.usuario_id);
  if (!usuarioId) return responderError(res, 400, 'Elegí a quién corresponde la licencia.', 'usuario_id');
  const errorFechas = validarFechasNuevas(cuerpo, hoy);
  if (errorFechas) return responderError(res, 400, errorFechas, 'fechas');
  const autorizadoId = autorizadoDelCuerpo(cuerpo) ?? null;
  if (Number.isNaN(autorizadoId)) return responderError(res, 400, 'La persona autorizada no es válida.', 'autorizado_id');
  if (autorizadoId && req.user.userId !== usuarioId) return responderError(res, 403, MENSAJE_SOLO_TITULAR, 'autorizado_id');

  let conexion;
  let licencia;
  let auditoriaId;
  try {
    conexion = await pool.getConnection();
    await conexion.beginTransaction();
    await bloquearUsuarios(conexion);
    const rechazo = await rechazoDeLaBase(conexion, {
      usuarioId, desde: cuerpo.desde, hasta: cuerpo.hasta, autorizadoId, autorizadoNuevo: Boolean(autorizadoId)
    });
    if (rechazo) {
      await conexion.rollback();
      return responderError(res, ...rechazo);
    }
    const [resultado] = await conexion.query(
      'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, autorizado_id, autorizado_at, creado_por) VALUES (?, ?, ?, ?, ?, ?)',
      [usuarioId, cuerpo.desde, cuerpo.hasta, autorizadoId, autorizadoId ? ahoraArgentina() : null, req.user.userId]
    );
    licencia = await buscarLicencia(conexion, resultado.insertId);
    auditoriaId = await registrarAuditoria(conexion, {
      usuarioId, actorId: req.user.userId, accion: 'licencia_cargada',
      detalle: { licencia_id: licencia.id, desde: licencia.desde, hasta: licencia.hasta, autorizado_id: licencia.autorizado_id }
    });
    await conexion.commit();
  } catch (error) {
    await conexion?.rollback().catch(() => {});
    console.error('Error cargando la licencia:', error);
    return responderError(res, 500, MENSAJE_ERROR);
  } finally {
    conexion?.release();
  }

  try {
    await avisarSiEsDelSuperadmin(req, licencia, `Licencia cargada ${periodo(licencia)}`, auditoriaId, hoy);
    res.status(201).json({ success: true, data: aRespuesta(licencia, hoy, await firmanteTitular()), message: 'Licencia cargada' });
  } catch (error) {
    console.error('Error respondiendo la carga de la licencia:', error);
    responderError(res, 500, MENSAJE_ERROR);
  }
};

// PUT /usuarios/licencias/:id: fechas según el estado (spec 5.2) y, solo el titular, la persona autorizada (6.3)
export const editarLicencia = async (req, res) => {
  const id = idDe(req.params.id);
  if (!id) return responderError(res, 404, 'Licencia no encontrada');
  const hoy = hoyArgentina();
  const cuerpo = req.body ?? {};
  const autorizadoPedido = autorizadoDelCuerpo(cuerpo);
  if (Number.isNaN(autorizadoPedido)) return responderError(res, 400, 'La persona autorizada no es válida.', 'autorizado_id');

  let conexion;
  let antes;
  let despues;
  let auditoriaId = null;
  let sinCambios = false;
  try {
    conexion = await pool.getConnection();
    await conexion.beginTransaction();
    await bloquearUsuarios(conexion);
    antes = await buscarLicencia(conexion, id);
    if (!antes) {
      await conexion.rollback();
      return responderError(res, 404, 'Licencia no encontrada');
    }
    const { error, codigo, datos } = validarEdicion(antes, { desde: cuerpo.desde, hasta: cuerpo.hasta }, hoy);
    if (error) {
      await conexion.rollback();
      return responderError(res, codigo, error, 'fechas');
    }
    const autorizadoCambia = autorizadoPedido !== undefined && autorizadoPedido !== antes.autorizado_id;
    if (autorizadoCambia && req.user.userId !== antes.usuario_id) {
      await conexion.rollback();
      return responderError(res, 403, MENSAJE_SOLO_TITULAR, 'autorizado_id');
    }
    const autorizadoId = autorizadoCambia ? autorizadoPedido : antes.autorizado_id;
    const rechazo = await rechazoDeLaBase(conexion, {
      licenciaId: id, usuarioId: antes.usuario_id, ...datos, autorizadoId, autorizadoNuevo: autorizadoCambia
    });
    if (rechazo) {
      await conexion.rollback();
      return responderError(res, ...rechazo);
    }
    sinCambios = datos.desde === antes.desde && datos.hasta === antes.hasta && !autorizadoCambia;
    if (sinCambios) {
      await conexion.rollback();
      despues = antes;
    } else {
      // Columnas fijas del código; los valores van como parámetros
      const asignaciones = ['desde = ?', 'hasta = ?'];
      const valores = [datos.desde, datos.hasta];
      if (autorizadoCambia) {
        asignaciones.push('autorizado_id = ?', 'autorizado_at = ?');
        valores.push(autorizadoId, autorizadoId ? ahoraArgentina() : null);
      }
      // La nota de autorización dice a quién y entre qué fechas: si cambia algo, deja de valer y sale otra (spec 6.3)
      asignaciones.push('nota_autorizacion_id = NULL');
      await conexion.query(`UPDATE usuarios_licencias SET ${asignaciones.join(', ')} WHERE id = ?`, [...valores, id]);
      despues = await buscarLicencia(conexion, id);
      auditoriaId = await registrarAuditoria(conexion, {
        usuarioId: antes.usuario_id, actorId: req.user.userId, accion: 'licencia_editada',
        detalle: {
          licencia_id: id,
          antes: { desde: antes.desde, hasta: antes.hasta, autorizado_id: antes.autorizado_id },
          despues: { desde: despues.desde, hasta: despues.hasta, autorizado_id: despues.autorizado_id }
        }
      });
      await conexion.commit();
    }
  } catch (error) {
    await conexion?.rollback().catch(() => {});
    console.error('Error editando la licencia:', error);
    return responderError(res, 500, MENSAJE_ERROR);
  } finally {
    conexion?.release();
  }

  try {
    if (!sinCambios) {
      await avisarSiEsDelSuperadmin(req, despues, `Licencia modificada: ${periodo(despues)} (antes: ${periodo(antes)})`, auditoriaId, hoy);
    }
    res.json({ success: true, data: aRespuesta(despues, hoy, await firmanteTitular()), message: sinCambios ? 'Sin cambios' : 'Licencia modificada' });
  } catch (error) {
    console.error('Error respondiendo la edición de la licencia:', error);
    responderError(res, 500, MENSAJE_ERROR);
  }
};

// POST /usuarios/licencias/:id/anular: solo si todavía no empezó o empieza hoy (spec 5.2)
export const anularLicencia = async (req, res) => {
  const id = idDe(req.params.id);
  if (!id) return responderError(res, 404, 'Licencia no encontrada');
  const hoy = hoyArgentina();
  let conexion;
  let licencia;
  let auditoriaId;
  try {
    conexion = await pool.getConnection();
    await conexion.beginTransaction();
    await bloquearUsuarios(conexion);
    licencia = await buscarLicencia(conexion, id);
    let rechazo = null;
    if (!licencia) rechazo = [404, 'Licencia no encontrada'];
    else if (!puedeAnularse(licencia, hoy)) {
      rechazo = [409, 'Solo se puede anular una licencia que todavía no empezó o que empieza hoy. Para cortar una licencia en curso, cambiá la fecha de fin.'];
    }
    if (rechazo) {
      await conexion.rollback();
      return responderError(res, ...rechazo);
    }
    await conexion.query('UPDATE usuarios_licencias SET anulada = 1 WHERE id = ?', [id]);
    auditoriaId = await registrarAuditoria(conexion, {
      usuarioId: licencia.usuario_id, actorId: req.user.userId, accion: 'licencia_anulada',
      detalle: { licencia_id: id, desde: licencia.desde, hasta: licencia.hasta }
    });
    licencia = await buscarLicencia(conexion, id);
    await conexion.commit();
  } catch (error) {
    await conexion?.rollback().catch(() => {});
    console.error('Error anulando la licencia:', error);
    return responderError(res, 500, MENSAJE_ERROR);
  } finally {
    conexion?.release();
  }

  try {
    await avisarSiEsDelSuperadmin(req, licencia, `Licencia anulada (${periodo(licencia)})`, auditoriaId, hoy);
    res.json({ success: true, data: aRespuesta(licencia, hoy, await firmanteTitular()), message: 'Licencia anulada' });
  } catch (error) {
    console.error('Error respondiendo la anulación de la licencia:', error);
    responderError(res, 500, MENSAJE_ERROR);
  }
};
