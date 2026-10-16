// Panel de usuarios (spec 8 a 11). Las rutas exigen authMiddleware + adminOnly: admin y superadmin.
import pool from '../config/database.js';
import {
  validarDatosUsuario, violaMinimoAprobadores, estadoDeUsuario, esAprobadorActivo, esAdmin, emailValido, camposCambiados,
  MINIMO_APROBADORES, TEXTO_ROL
} from '../services/usuariosReglas.js';
import { registrarAuditoria, historialDe } from '../services/usuariosAuditoriaService.js';
import { enviarLinkDeAcceso } from '../services/accesoService.js';
import { avisarAlSuperadmin } from '../services/avisosSuperadminService.js';

const MENSAJE_PROTEGIDA = 'Esta cuenta solo la modifica su titular.';
const MENSAJE_MINIMO = 'No se puede: quedarían menos de 2 usuarios que puedan aprobar cambios.';
const MENSAJE_SIN_ENVIO = 'El usuario se guardó, pero no se pudo enviar el email. Podés reenviarlo desde Enviar link de acceso.';
const MENSAJE_ERROR = 'Error interno del servidor';
const CAMPOS_EDITABLES = ['nombre_completo', 'username', 'email', 'cargo', 'vinculo'];

// Columnas del panel: nunca password_hash, solo si existe
const COLUMNAS = `
  u.id, u.username, u.nombre_completo, u.email, u.rol, u.cargo, u.vinculo, u.activo, u.ultimo_ingreso, u.created_at,
  (u.password_hash IS NOT NULL) AS tiene_contrasena,
  (SELECT MAX(t.expira_at) FROM usuarios_tokens t
    WHERE t.usuario_id = u.id AND t.tipo = 'invitacion' AND t.usado_at IS NULL AND t.anulado_at IS NULL
      AND t.expira_at > NOW()) AS invitacion_vence,
  (SELECT COUNT(*) FROM cambios_pendientes cp WHERE cp.usuario_id = u.id AND cp.estado = 'pendiente') AS cambios_pendientes_propuestos`;

const aRespuesta = (u) => ({
  id: u.id,
  username: u.username,
  nombre_completo: u.nombre_completo,
  email: u.email,
  email_valido: emailValido(u.email),
  rol: u.rol,
  cargo: u.cargo,
  vinculo: u.vinculo,
  estado: estadoDeUsuario(u),
  ultimo_ingreso: u.ultimo_ingreso,
  invitacion_vence: u.invitacion_vence,
  cambios_pendientes_propuestos: Number(u.cambios_pendientes_propuestos),
  created_at: u.created_at
});

const responderError = (res, status, error, campo) =>
  res.status(status).json({ success: false, error, ...(campo ? { campo } : {}) });

const idDeRuta = (req) => {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const buscarUsuario = async (conexion, id) => {
  const [filas] = await conexion.execute(`SELECT ${COLUMNAS} FROM usuarios u WHERE u.id = ?`, [id]);
  return filas[0] || null;
};

// Bloquea las filas de usuarios (son pocas) hasta el fin de la transacción y devuelve lo necesario para contar
// aprobadores. Se leen siempre todas y en el mismo orden: dos operaciones simultáneas se esperan en lugar de
// trabarse, y la segunda cuenta con lo que dejó la primera (spec 8.1).
const bloquearUsuarios = async (conexion) => {
  const [filas] = await conexion.execute(
    'SELECT id, rol, activo, (password_hash IS NOT NULL) AS tiene_contrasena FROM usuarios ORDER BY id FOR UPDATE'
  );
  return filas;
};

// Busca un usuario o email ya usado por otro. Devuelve el campo repetido o null.
const campoRepetido = async (conexion, { username, email }, exceptoId = 0) => {
  if (username === undefined && email === undefined) return null;
  const [filas] = await conexion.execute(
    'SELECT username, email FROM usuarios WHERE id <> ? AND (username = ? OR email = ?)',
    [exceptoId, username ?? null, email ?? null]
  );
  if (filas.length === 0) return null;
  return filas.some(f => username !== undefined && f.username.toUpperCase() === username) ? 'username' : 'email';
};

const MENSAJE_REPETIDO = { username: 'Ese usuario ya existe', email: 'Ese email ya lo usa otro usuario' };

// Aviso al superadmin por un cambio de este pedido (spec 10.3): lo retiene si está de licencia (spec 2026-10-15, 5.4)
const avisar = (req, afectado, cambio, auditoriaId) =>
  avisarAlSuperadmin({ actor: { id: req.user.userId, rol: req.user.rol }, afectado, cambio, auditoriaId });

// GET /usuarios
export const listarUsuarios = async (req, res) => {
  try {
    const [filas] = await pool.execute(`SELECT ${COLUMNAS} FROM usuarios u ORDER BY u.nombre_completo`);
    res.json({
      success: true,
      data: {
        usuarios: filas.map(aRespuesta),
        resumen: { aprobadores_activos: filas.filter(esAprobadorActivo).length, minimo: MINIMO_APROBADORES }
      }
    });
  } catch (error) {
    console.error('Error listando usuarios:', error);
    responderError(res, 500, MENSAJE_ERROR);
  }
};

// GET /usuarios/:id
export const obtenerUsuario = async (req, res) => {
  const id = idDeRuta(req);
  try {
    const usuario = id && await buscarUsuario(pool, id);
    if (!usuario) return responderError(res, 404, 'Usuario no encontrado');
    res.json({ success: true, data: { ...aRespuesta(usuario), historial: await historialDe(id) } });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    responderError(res, 500, MENSAJE_ERROR);
  }
};

// POST /usuarios: alta con la invitación pendiente y envío del link (spec 7.2)
export const crearUsuario = async (req, res) => {
  const entrada = req.body ?? {};
  if (entrada.rol === 'superadmin') return responderError(res, 400, 'El rol superadmin no se asigna desde el panel', 'rol');
  const { errores, datos } = validarDatosUsuario(entrada);
  if (errores.length > 0) return responderError(res, 400, errores[0].error, errores[0].campo);

  let conexion;
  let id;
  let auditoriaId;
  try {
    conexion = await pool.getConnection();
    await conexion.beginTransaction();
    const repetido = await campoRepetido(conexion, datos);
    if (repetido) {
      await conexion.rollback();
      return responderError(res, 409, MENSAJE_REPETIDO[repetido], repetido);
    }
    const [resultado] = await conexion.execute(
      `INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, cargo, vinculo, activo)
       VALUES (?, NULL, ?, ?, ?, ?, ?, TRUE)`,
      [datos.username, datos.nombre_completo, datos.email, datos.rol, datos.cargo ?? null, datos.vinculo ?? null]
    );
    id = resultado.insertId;
    auditoriaId = await registrarAuditoria(conexion, {
      usuarioId: id,
      actorId: req.user.userId,
      accion: 'alta',
      detalle: {
        username: datos.username, nombre_completo: datos.nombre_completo, email: datos.email,
        rol: datos.rol, cargo: datos.cargo ?? null, vinculo: datos.vinculo ?? null
      }
    });
    await conexion.commit();
  } catch (error) {
    await conexion?.rollback().catch(() => {});
    if (error.code === 'ER_DUP_ENTRY') return responderError(res, 409, 'Ese usuario o email ya existe');
    console.error('Error creando usuario:', error);
    return responderError(res, 500, MENSAJE_ERROR);
  } finally {
    conexion?.release();
  }

  try {
    const usuario = await buscarUsuario(pool, id);
    const envio = await enviarLinkDeAcceso({ usuario, tipo: 'invitacion', actorId: req.user.userId, origen: 'panel' });
    if (datos.rol === 'admin') await avisar(req, usuario, `Alta como ${TEXTO_ROL.admin}`, auditoriaId);
    res.status(201).json({
      success: true,
      data: { usuario: aRespuesta(await buscarUsuario(pool, id)), email_enviado: envio.email_enviado },
      message: envio.email_enviado ? `Usuario creado. Le enviamos la invitación a ${datos.email}.` : MENSAJE_SIN_ENVIO
    });
  } catch (error) {
    // El usuario ya quedó creado: se informa que falta el email
    console.error('Error enviando la invitación:', error);
    res.status(201).json({ success: true, data: { usuario: { id }, email_enviado: false }, message: MENSAJE_SIN_ENVIO });
  }
};

// PUT /usuarios/:id: datos y rol (spec 8.2 y 8.3)
export const actualizarUsuario = async (req, res) => {
  const id = idDeRuta(req);
  if (!id) return responderError(res, 404, 'Usuario no encontrado');
  const entrada = req.body ?? {};
  if (entrada.rol === 'superadmin') return responderError(res, 400, 'El rol superadmin no se asigna desde el panel', 'rol');
  const { errores, datos } = validarDatosUsuario(entrada, { parcial: true });
  if (errores.length > 0) return responderError(res, 400, errores[0].error, errores[0].campo);

  let conexion;
  let antes;
  let rolNuevo = null;
  let campos = {};
  let auditoriaId = null;
  let sinCambios = false;
  try {
    conexion = await pool.getConnection();
    await conexion.beginTransaction();
    const todos = await bloquearUsuarios(conexion);
    antes = await buscarUsuario(conexion, id);
    if (!antes) {
      await conexion.rollback();
      return responderError(res, 404, 'Usuario no encontrado');
    }
    if (antes.rol === 'superadmin') {
      if (req.user.userId !== id) {
        await conexion.rollback();
        return responderError(res, 403, MENSAJE_PROTEGIDA);
      }
      if (datos.rol !== undefined) {
        await conexion.rollback();
        return responderError(res, 403, 'El superadmin no puede cambiar su propio rol', 'rol');
      }
    }

    rolNuevo = datos.rol !== undefined && datos.rol !== antes.rol ? datos.rol : null;
    if (rolNuevo && violaMinimoAprobadores(todos, id, { rol: rolNuevo })) {
      await conexion.rollback();
      return responderError(res, 409, MENSAJE_MINIMO);
    }

    const repetido = await campoRepetido(conexion, { username: datos.username, email: datos.email }, id);
    if (repetido) {
      await conexion.rollback();
      return responderError(res, 409, MENSAJE_REPETIDO[repetido], repetido);
    }

    campos = camposCambiados(antes, datos, CAMPOS_EDITABLES);
    sinCambios = Object.keys(campos).length === 0 && !rolNuevo;
    if (sinCambios) {
      await conexion.rollback();
    } else {
      // Los nombres de columna salen de CAMPOS_EDITABLES (lista fija), nunca del pedido
      const asignaciones = Object.keys(campos).map(campo => `${campo} = ?`);
      const valores = Object.keys(campos).map(campo => datos[campo]);
      if (rolNuevo) {
        asignaciones.push('rol = ?');
        valores.push(rolNuevo);
      }
      await conexion.execute(`UPDATE usuarios SET ${asignaciones.join(', ')} WHERE id = ?`, [...valores, id]);
      // Un link mandado a un email que se corrigió no debe seguir sirviendo
      if (campos.email) {
        await conexion.execute(
          'UPDATE usuarios_tokens SET anulado_at = NOW() WHERE usuario_id = ? AND usado_at IS NULL AND anulado_at IS NULL',
          [id]
        );
      }
      if (Object.keys(campos).length > 0) {
        auditoriaId = await registrarAuditoria(conexion, { usuarioId: id, actorId: req.user.userId, accion: 'edicion', detalle: { campos } });
      }
      if (rolNuevo) {
        auditoriaId = await registrarAuditoria(conexion, {
          usuarioId: id, actorId: req.user.userId, accion: 'cambio_rol', detalle: { antes: antes.rol, despues: rolNuevo }
        });
      }
      await conexion.commit();
    }
  } catch (error) {
    await conexion?.rollback().catch(() => {});
    if (error.code === 'ER_DUP_ENTRY') return responderError(res, 409, 'Ese usuario o email ya existe');
    console.error('Error actualizando usuario:', error);
    return responderError(res, 500, MENSAJE_ERROR);
  } finally {
    conexion?.release();
  }

  try {
    const despues = await buscarUsuario(pool, id);
    // Un solo aviso por edición, con todo lo que importa: el rol y el email de quien aprueba cambios (spec 10.3)
    const avisos = [];
    if (rolNuevo) avisos.push(`${TEXTO_ROL[antes.rol]} → ${TEXTO_ROL[rolNuevo]}`);
    if (campos.email && esAdmin(despues.rol)) avisos.push(`Email: ${campos.email.antes ?? '(vacío)'} → ${campos.email.despues}`);
    if (avisos.length > 0) await avisar(req, despues, avisos.join('; '), auditoriaId);
    res.json({ success: true, data: aRespuesta(despues), message: sinCambios ? 'Sin cambios' : 'Cambios guardados' });
  } catch (error) {
    console.error('Error respondiendo la actualización del usuario:', error);
    responderError(res, 500, MENSAJE_ERROR);
  }
};

// POST /usuarios/:id/desactivar (spec 8.6)
export const desactivarUsuario = async (req, res) => {
  const id = idDeRuta(req);
  if (!id) return responderError(res, 404, 'Usuario no encontrado');
  let conexion;
  let usuario;
  let auditoriaId;
  try {
    conexion = await pool.getConnection();
    await conexion.beginTransaction();
    const todos = await bloquearUsuarios(conexion);
    usuario = await buscarUsuario(conexion, id);
    let rechazo = null;
    if (!usuario) rechazo = [404, 'Usuario no encontrado'];
    else if (usuario.rol === 'superadmin') {
      rechazo = [403, req.user.userId === id ? 'La cuenta del superadmin no se puede desactivar.' : MENSAJE_PROTEGIDA];
    } else if (!usuario.activo) rechazo = [409, 'El usuario ya está desactivado'];
    else if (violaMinimoAprobadores(todos, id, { activo: 0 })) rechazo = [409, MENSAJE_MINIMO];
    if (rechazo) {
      await conexion.rollback();
      return responderError(res, ...rechazo);
    }

    await conexion.execute('UPDATE usuarios SET activo = FALSE, sesion_version = sesion_version + 1 WHERE id = ?', [id]);
    await conexion.execute(
      'UPDATE usuarios_tokens SET anulado_at = NOW() WHERE usuario_id = ? AND usado_at IS NULL AND anulado_at IS NULL',
      [id]
    );
    auditoriaId = await registrarAuditoria(conexion, {
      usuarioId: id, actorId: req.user.userId, accion: 'desactivacion',
      detalle: { cambios_pendientes: Number(usuario.cambios_pendientes_propuestos) }
    });
    await conexion.commit();
  } catch (error) {
    await conexion?.rollback().catch(() => {});
    console.error('Error desactivando usuario:', error);
    return responderError(res, 500, MENSAJE_ERROR);
  } finally {
    conexion?.release();
  }

  try {
    await avisar(req, usuario, 'Desactivado', auditoriaId);
    res.json({ success: true, data: aRespuesta(await buscarUsuario(pool, id)), message: 'Usuario desactivado' });
  } catch (error) {
    console.error('Error respondiendo la desactivación del usuario:', error);
    responderError(res, 500, MENSAJE_ERROR);
  }
};

// POST /usuarios/:id/reactivar (spec 8.6)
export const reactivarUsuario = async (req, res) => {
  const id = idDeRuta(req);
  if (!id) return responderError(res, 404, 'Usuario no encontrado');
  let conexion;
  let auditoriaId;
  try {
    conexion = await pool.getConnection();
    await conexion.beginTransaction();
    // Se bloquean los usuarios: con dos pedidos simultáneos, el segundo encuentra al usuario ya activo
    await bloquearUsuarios(conexion);
    const usuario = await buscarUsuario(conexion, id);
    let rechazo = null;
    if (!usuario) rechazo = [404, 'Usuario no encontrado'];
    else if (usuario.rol === 'superadmin' && req.user.userId !== id) rechazo = [403, MENSAJE_PROTEGIDA];
    else if (usuario.activo) rechazo = [409, 'El usuario ya está activo'];
    if (rechazo) {
      await conexion.rollback();
      return responderError(res, ...rechazo);
    }

    await conexion.execute('UPDATE usuarios SET activo = TRUE WHERE id = ?', [id]);
    auditoriaId = await registrarAuditoria(conexion, { usuarioId: id, actorId: req.user.userId, accion: 'reactivacion' });
    await conexion.commit();
  } catch (error) {
    await conexion?.rollback().catch(() => {});
    console.error('Error reactivando usuario:', error);
    return responderError(res, 500, MENSAJE_ERROR);
  } finally {
    conexion?.release();
  }

  try {
    const reactivado = await buscarUsuario(pool, id);
    if (esAdmin(reactivado.rol)) await avisar(req, reactivado, 'Reactivado', auditoriaId);
    res.json({ success: true, data: aRespuesta(reactivado), message: 'Usuario reactivado' });
  } catch (error) {
    console.error('Error respondiendo la reactivación del usuario:', error);
    responderError(res, 500, MENSAJE_ERROR);
  }
};

// POST /usuarios/:id/enviar-acceso: invitación o recuperación según el estado (spec 7.2)
export const enviarAcceso = async (req, res) => {
  const id = idDeRuta(req);
  if (!id) return responderError(res, 404, 'Usuario no encontrado');
  try {
    const usuario = await buscarUsuario(pool, id);
    if (!usuario) return responderError(res, 404, 'Usuario no encontrado');
    if (usuario.rol === 'superadmin' && req.user.userId !== id) return responderError(res, 403, MENSAJE_PROTEGIDA);
    if (!usuario.activo) return responderError(res, 409, 'El usuario está desactivado: reactivalo antes de enviarle un link');
    if (!emailValido(usuario.email)) {
      return responderError(res, 409, 'El usuario no tiene un email válido. Cargale uno y guardá antes de enviarle el link.', 'email');
    }
    const tipo = usuario.tiene_contrasena ? 'recuperacion' : 'invitacion';
    const envio = await enviarLinkDeAcceso({ usuario, tipo, actorId: req.user.userId, origen: 'panel' });
    const message = !envio.email_enviado
      ? 'No se pudo enviar el email. Probá de nuevo en unos minutos.'
      : tipo === 'invitacion'
        ? `Le reenviamos la invitación a ${usuario.email}.`
        : `Le enviamos un link para restablecer la contraseña a ${usuario.email}.`;
    res.json({ success: true, data: { tipo, email_enviado: envio.email_enviado }, message });
  } catch (error) {
    console.error('Error enviando el link de acceso:', error);
    responderError(res, 500, MENSAJE_ERROR);
  }
};
