import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pool from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import { registrarAuditoria } from '../services/usuariosAuditoriaService.js';
import { validarContrasena, emailValido, camposCambiados } from '../services/usuariosReglas.js';

// Hash de referencia: si el usuario no existe o no tiene contraseña, igual se compara contra este hash,
// para que el tiempo de respuesta no revele si la cuenta existe (spec 5.4)
const HASH_DE_REFERENCIA = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

// Login
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Usuario y contraseña son requeridos'
      });
    }

    // Buscar usuario
    const [rows] = await pool.execute(
      'SELECT * FROM usuarios WHERE username = ? AND activo = TRUE',
      [username]
    );

    const usuario = rows[0];

    // Siempre se compara, aunque el usuario no exista o tenga la invitación pendiente (password_hash NULL)
    const passwordValid = await bcrypt.compare(String(password), usuario?.password_hash || HASH_DE_REFERENCIA);

    if (!usuario || !usuario.password_hash || !passwordValid) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // updated_at = updated_at: registrar el ingreso no cuenta como modificación del usuario
    await pool.execute(
      'UPDATE usuarios SET ultimo_ingreso = CURRENT_TIMESTAMP, updated_at = updated_at WHERE id = ?',
      [usuario.id]
    );

    // Generar token (v: versión de sesión, spec 5.2)
    const token = generateToken({
      userId: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
      v: usuario.sesion_version
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: usuario.id,
          username: usuario.username,
          nombre_completo: usuario.nombre_completo,
          email: usuario.email,
          rol: usuario.rol,
          cargo: usuario.cargo,
          vinculo: usuario.vinculo
        }
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Verificar token
export const verifySession = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, nombre_completo, email, rol, cargo, vinculo FROM usuarios WHERE id = ? AND activo = TRUE',
      [req.user?.userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: { user: rows[0] }
    });
  } catch (error) {
    console.error('Error verificando sesión:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Cambiar contraseña
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Contraseña actual y nueva son requeridas'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'La nueva contraseña debe tener al menos 8 caracteres'
      });
    }

    // Máximo de bcrypt (72 bytes): lo más largo se ignoraría en silencio
    const errorContrasena = validarContrasena(newPassword);
    if (errorContrasena) {
      return res.status(400).json({ success: false, error: errorContrasena });
    }

    // Obtener usuario actual
    const [rows] = await pool.execute(
      'SELECT * FROM usuarios WHERE id = ?',
      [req.user?.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    const usuario = rows[0];

    // Verificar contraseña actual
    const passwordValid = Boolean(usuario.password_hash) && await bcrypt.compare(currentPassword, usuario.password_hash);

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: 'Contraseña actual incorrecta'
      });
    }

    // Hashear nueva contraseña
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña y cerrar las otras sesiones: cambia la versión y esta sesión recibe un token nuevo (spec 5.2)
    await pool.execute(
      'UPDATE usuarios SET password_hash = ?, sesion_version = sesion_version + 1 WHERE id = ?',
      [newPasswordHash, usuario.id]
    );
    await registrarAuditoria(pool, { usuarioId: usuario.id, actorId: usuario.id, accion: 'contrasena_cambiada' });

    const token = generateToken({
      userId: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
      v: usuario.sesion_version + 1
    });

    res.json({
      success: true,
      message: 'Contraseña actualizada correctamente',
      data: { token }
    });
  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Actualizar perfil (nombre y email)
export const updateProfile = async (req, res) => {
  try {
    const { nombre_completo, email } = req.body;
    const userId = req.user?.userId;

    if (!nombre_completo && !email) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar al menos un campo para actualizar'
      });
    }

    if (nombre_completo && String(nombre_completo).trim().length > 100) {
      return res.status(400).json({ success: false, error: 'El nombre completo admite hasta 100 caracteres' });
    }

    if (email && !emailValido(String(email).trim().toLowerCase())) {
      return res.status(400).json({ success: false, error: 'Ingresá un email válido' });
    }

    // Verificar que el usuario existe
    const [userRows] = await pool.execute(
      'SELECT * FROM usuarios WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // Si se cambia el email, verificar que no esté en uso por otro usuario
    if (email) {
      const [existingEmail] = await pool.execute(
        'SELECT id FROM usuarios WHERE email = ? AND id != ?',
        [email, userId]
      );

      if (existingEmail.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'El email ya está en uso por otro usuario'
        });
      }
    }

    // Construir query de actualización
    const updates = [];
    const values = [];
    const nuevos = {};

    if (nombre_completo) {
      updates.push('nombre_completo = ?');
      nuevos.nombre_completo = nombre_completo.trim();
      values.push(nuevos.nombre_completo);
    }

    if (email) {
      updates.push('email = ?');
      nuevos.email = email.trim().toLowerCase();
      values.push(nuevos.email);
    }

    values.push(userId);

    await pool.execute(
      `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Historial: solo lo que efectivamente cambió (spec 9)
    const campos = camposCambiados(userRows[0], nuevos, ['nombre_completo', 'email']);
    if (Object.keys(campos).length > 0) {
      await registrarAuditoria(pool, { usuarioId: userId, actorId: userId, accion: 'perfil_editado', detalle: { campos } });
    }

    // Obtener datos actualizados
    const [updatedUser] = await pool.execute(
      'SELECT id, username, nombre_completo, email, rol FROM usuarios WHERE id = ?',
      [userId]
    );

    res.json({
      success: true,
      message: 'Perfil actualizado correctamente',
      data: { user: updatedUser[0] }
    });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Obtener datos del perfil actual
export const getProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;

    const [rows] = await pool.execute(
      'SELECT id, username, nombre_completo, email, rol, cargo, vinculo, created_at FROM usuarios WHERE id = ? AND activo = TRUE',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: { user: rows[0] }
    });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};
