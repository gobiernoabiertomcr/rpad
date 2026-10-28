// Licencias de quienes reciben avisos (spec 2026-10-15-dias-habiles-licencias-auditoria, sección 5). Las rutas exigen
// authMiddleware + adminOnly. La autorización para presentar las notas (6.3) la da solo el firmante titular. El alta, la
// edición y la anulación con sus reglas están en services/licenciasOficialesService.js (las comparte Mi espacio): acá, lo del
// pedido (los controles del cuerpo, la transacción, la respuesta y el aviso al superadmin después de confirmarla).
// Los días hábiles, con el calendario (spec 2026-10-27-feriados-en-notas, 4): cada pedido lo lee una vez (leerCalendario) y lo
// pasa a lo que llama; si la tabla de feriados no se puede leer, sigue con los 9 fijos (lo que anuncia coincide con lo que haría
// la corrida ese día).
import pool from '../config/database.js';
import { avisarAlSuperadmin } from '../services/avisosSuperadminService.js';
import { hoyArgentina, esFechaIso, sumarDias, diasEntre } from '../services/notasDigitalesCalendario.js';
import {
  ROLES_CON_LICENCIA, estadoDeLicencia, validarFechasNuevas, visperaDeLaLicencia, SIN_VISPERA, mensajeDeLaAnulacion
} from '../services/licenciasReglas.js';
import { periodosSinAuditor, DIAS_PERIODOS_SIN_AUDITOR } from '../services/auditoriaService.js';
import { leerCalendario } from '../services/feriadosDatos.js';
import {
  MENSAJE_SOLO_TITULAR, COLUMNAS_LICENCIA, DESDE_LICENCIA, periodo, firmanteTitular, autorizables, conSusLicencias,
  bloquearUsuarios, cargarLicencia, cambiarLicencia, anularLicenciaDe, buscarLicenciaOficial
} from '../services/licenciasOficialesService.js';
import { bajaPorLaAnulacion } from '../services/miEspacioPaso.js';

const MENSAJE_ERROR = 'Error interno del servidor';
// Rango máximo de la consulta de días sin auditor, contando los dos extremos
const MAXIMO_DIAS_SIN_AUDITOR = 366;

const responderError = (res, status, error, campo) =>
  res.status(status).json({ success: false, error, ...(campo ? { campo } : {}) });

// El rechazo del servicio, con el status, el mensaje y el campo de siempre (el motivo es para Mi espacio)
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

// Las licencias sin anular del firmante titular, para la víspera de cada una. Las fechas, como texto: el pool no tiene
// dateStrings, y con Date visperaDeLaLicencia (que compara textos) no encontraría la otra licencia. Sin titular, ninguna
const licenciasDelTitular = async (titular) => {
  if (titular === null) return [];
  const [filas] = await pool.query(
    `SELECT id, DATE_FORMAT(desde, '%Y-%m-%d') AS desde, DATE_FORMAT(hasta, '%Y-%m-%d') AS hasta
     FROM usuarios_licencias WHERE usuario_id = ? AND anulada = 0`,
    [titular]
  );
  return filas;
};

/**
 * Una licencia como la responde la API. En una del firmante titular, la víspera (spec 7.3 y spec 2026-10-27-feriados-en-notas,
 * 4: el día hábil anterior, con el calendario, en que salen los avisos anticipados), sin_anticipo (esa víspera cae dentro de
 * otra licencia suya: no hay anticipo) y sin_dias_habiles (la licencia no tiene días hábiles), de visperaDeLaLicencia con las
 * demás licencias sin anular del titular (delTitular, sin la misma: se compara el id con Number); en las demás, null, false y
 * false.
 */
const aRespuesta = (fila, hoy, titular, { calendario, delTitular }) => ({
  ...fila,
  anulada: Boolean(fila.anulada),
  // La insignia «Cargada desde Mi espacio» (spec 2026-10-26-mi-espacio-licencias-y-horas, 6)
  desde_mi_espacio: Boolean(Number(fila.desde_mi_espacio)),
  estado: estadoDeLicencia(fila, hoy),
  ...(fila.usuario_id === titular
    ? visperaDeLaLicencia(fila, delTitular.filter((otra) => Number(otra.id) !== Number(fila.id)), calendario)
    : SIN_VISPERA)
});

// Una licencia recién cargada, cambiada o anulada, como la responde la API (después de confirmar la transacción): con el
// titular y, si es suya, sus demás licencias
const respuestaDe = async (licencia, hoy, calendario) => {
  const titular = await firmanteTitular();
  const delTitular = licencia.usuario_id === titular ? await licenciasDelTitular(titular) : [];
  return aRespuesta(licencia, hoy, titular, { calendario, delTitular });
};

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
    const calendario = await leerCalendario();
    const delTitular = await licenciasDelTitular(titular);
    res.json({
      success: true,
      data: {
        hoy,
        firmante_titular_id: titular,
        soy_titular: soyTitular,
        licencias: filas.map(f => aRespuesta(f, hoy, titular, { calendario, delTitular })),
        usuarios: conLicencia,
        autorizables: soyTitular ? await conSusLicencias(await autorizables(pool, titular), hoy, calendario) : []
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
  let calendario;
  try {
    conexion = await pool.getConnection();
    await conexion.beginTransaction();
    await bloquearUsuarios(conexion);
    // Una vez por pedido, dentro de la transacción y después del bloqueo (una lectura común, sin bloqueos): para la persona
    // autorizada (rechazoDeLaBase) y para la víspera de la respuesta
    calendario = await leerCalendario(conexion);
    const resultado = await cargarLicencia(conexion, {
      usuarioId, desde: cuerpo.desde, hasta: cuerpo.hasta, autorizadoId, actorId: req.user.userId, hoy, calendario
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
    res.status(201).json({ success: true, data: await respuestaDe(licencia, hoy, calendario), message: 'Licencia cargada' });
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
  let calendario;
  try {
    conexion = await pool.getConnection();
    await conexion.beginTransaction();
    await bloquearUsuarios(conexion);
    // Una vez por pedido, como en el alta
    calendario = await leerCalendario(conexion);
    const resultado = await cambiarLicencia(conexion, {
      licenciaId: id, desde: cuerpo.desde, hasta: cuerpo.hasta, autorizadoPedido, actorId: req.user.userId, hoy, calendario
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
    res.json({ success: true, data: await respuestaDe(despues, hoy, calendario), message: sinCambios ? 'Sin cambios' : 'Licencia modificada' });
  } catch (error) {
    console.error('Error respondiendo la edición de la licencia:', error);
    responderError(res, 500, MENSAJE_ERROR);
  }
};

// POST /usuarios/licencias/:id/anular: solo si todavía no empezó o empieza hoy (spec 5.2). Si se cargó desde Mi espacio, la
// fila de Mi espacio que la creó se da de baja en la misma transacción (spec 2026-10-28-mi-espacio-licencia-anulada, 2.1 y 3b:
// salvo que en Mi espacio haya empezado antes de hoy), y el mensaje lo dice
export const anularLicencia = async (req, res) => {
  const id = idDe(req.params.id);
  if (!id) return responderError(res, 404, 'Licencia no encontrada');
  const hoy = hoyArgentina();
  let conexion;
  let licencia;
  let auditoriaId;
  let mensaje;
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
    const enMiEspacio = await bajaPorLaAnulacion(conexion, { licenciaOficialId: id, hoy });
    mensaje = mensajeDeLaAnulacion(enMiEspacio);
    // Con la fila dada de baja, la insignia «Cargada desde Mi espacio» se apaga: se vuelve a leer
    if (enMiEspacio.borradas > 0) licencia = await buscarLicenciaOficial(conexion, id);
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
    // La anulación no cuenta días hábiles: el calendario se lee solo para la víspera de la respuesta
    res.json({ success: true, data: await respuestaDe(licencia, hoy, await leerCalendario()), message: mensaje });
  } catch (error) {
    console.error('Error respondiendo la anulación de la licencia:', error);
    responderError(res, 500, MENSAJE_ERROR);
  }
};
