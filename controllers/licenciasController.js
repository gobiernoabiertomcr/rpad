// Licencias de quienes reciben avisos (spec 2026-10-15-dias-habiles-licencias-auditoria, sección 5). Las rutas exigen
// authMiddleware + adminOnly. La autorización para presentar las notas (6.3) la da solo el firmante titular. El alta, la
// edición y la anulación con sus reglas están en services/licenciasOficialesService.js (las comparte Mi espacio): acá, lo del
// pedido (los controles del cuerpo, la transacción, la respuesta y el aviso al superadmin después de confirmarla).
import pool from '../config/database.js';
import { avisarAlSuperadmin } from '../services/avisosSuperadminService.js';
import { hoyArgentina, diaHabilAnterior, esFechaIso, sumarDias, diasEntre } from '../services/notasDigitalesCalendario.js';
import { ROLES_CON_LICENCIA, estadoDeLicencia, validarFechasNuevas } from '../services/licenciasReglas.js';
import { periodosSinAuditor, DIAS_PERIODOS_SIN_AUDITOR } from '../services/auditoriaService.js';
import {
  MENSAJE_SOLO_TITULAR, COLUMNAS_LICENCIA, DESDE_LICENCIA, periodo, firmanteTitular, autorizables, conSusLicencias,
  bloquearUsuarios, cargarLicencia, cambiarLicencia, anularLicenciaDe
} from '../services/licenciasOficialesService.js';

const MENSAJE_ERROR = 'Error interno del servidor';
// Rango máximo de la consulta de días sin auditor, contando los dos extremos
const MAXIMO_DIAS_SIN_AUDITOR = 366;

const responderError = (res, status, error, campo) =>
  res.status(status).json({ success: false, error, ...(campo ? { campo } : {}) });

const responderRechazo = (res, { status, error, campo }) => responderError(res, status, error, campo);

const idDe = (valor) => {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// autorizado_id del cuerpo: undefined si no vino, null para "nadie", un id o NaN si es inválido
const autorizadoDelCuerpo = (cuerpo) => {
  if (!Object.hasOwn(cuerpo, 'autorizado_id')) return undefined;
  const valor = cuerpo.autorizado_id;
  if (valor === null || valor === '') return null;
  return idDe(valor) ?? Number.NaN;
};

const aRespuesta = (fila, hoy, titular) => ({
  ...fila,
  anulada: Boolean(fila.anulada),
  estado: estadoDeLicencia(fila, hoy),
  // Del firmante titular: el día en que saldrían los avisos anticipados si no hay autorizado (spec 7.3)
  vispera: fila.usuario_id === titular ? diaHabilAnterior(fila.desde) : null
});

// Aviso al superadmin si la licencia es suya y el cambio lo hizo otro (spec 5.2); lo retiene si ya está de licencia
const avisarSiEsDelSuperadmin = (req, licencia, cambio, auditoriaId, hoy) => (licencia.usuario_rol === 'superadmin'
  ? avisarAlSuperadmin({
    actor: { id: req.user.userId, rol: req.user.rol },
    afectado: { nombre_completo: licencia.usuario_nombre, username: licencia.usuario_username },
    cambio, auditoriaId, hoy
  })
  : Promise.resolve());

// GET /usuarios/licencias
export const listarLicencias = async (req, res) => {
  try {
    const hoy = hoyArgentina();
    const todas = req.query.incluir_pasadas === '1';
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS_LICENCIA} ${DESDE_LICENCIA} ${todas ? '' : 'WHERE l.anulada = 0 AND l.hasta >= ?'} ORDER BY l.desde, u.nombre_completo`,
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
    const resultado = await cargarLicencia(conexion, {
      usuarioId, desde: cuerpo.desde, hasta: cuerpo.hasta, autorizadoId, actorId: req.user.userId, hoy
    });
    if (resultado.rechazo) {
      await conexion.rollback();
      return responderRechazo(res, resultado.rechazo);
    }
    ({ licencia, auditoriaId } = resultado);
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
    const resultado = await cambiarLicencia(conexion, {
      licenciaId: id, desde: cuerpo.desde, hasta: cuerpo.hasta, autorizadoPedido, actorId: req.user.userId, hoy
    });
    if (resultado.rechazo) {
      await conexion.rollback();
      return responderRechazo(res, resultado.rechazo);
    }
    ({ antes, despues, auditoriaId, sinCambios } = resultado);
    // Sin cambios no se escribió nada
    await (sinCambios ? conexion.rollback() : conexion.commit());
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
    const resultado = await anularLicenciaDe(conexion, { licenciaId: id, actorId: req.user.userId, hoy });
    if (resultado.rechazo) {
      await conexion.rollback();
      return responderRechazo(res, resultado.rechazo);
    }
    ({ licencia, auditoriaId } = resultado);
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
