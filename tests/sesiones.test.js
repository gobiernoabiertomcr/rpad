// Sesiones y roles (spec 5): el rol y el estado se leen de la base en cada pedido. Base de prueba propia.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query
} from './helpers.js';

let base, servidor, api, usuarios, acceso, pool, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_sesiones');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api);
  // Se importan después de apuntar DB_NAME a la base de prueba: el pool de la app se crea al importarse
  acceso = await import('../services/accesoService.js');
  pool = (await import('../config/database.js')).default;
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await pool?.end();
  await cerrarDb();
  await servidor?.detener();
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

const verificar = (token) => api.get('/auth/verify', { token });
const rutaAdmin = (token) => api.get('/cambios-pendientes/contador', { token });
const tokenSinVersion = (usuario, rol) =>
  jwt.sign({ userId: usuario.id, username: usuario.username, rol }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('rol tomado de la base', () => {
  it('el superadmin pasa las rutas de administrador', async () => {
    assert.equal((await rutaAdmin(usuarios.superadmin.token)).status, 200);
  });

  it('un admin pasado a lector pierde el acceso de admin con el mismo token, pero sigue logueado', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'admin' });
    assert.equal((await rutaAdmin(x.token)).status, 200);
    await query("UPDATE usuarios SET rol = 'lector' WHERE id = ?", [x.id]);
    assert.equal((await rutaAdmin(x.token)).status, 403);
    assert.equal((await api.get('/auth/profile', { token: x.token })).status, 200);
  });

  it('un lector pasado a admin gana el acceso con el mismo token', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    assert.equal((await rutaAdmin(x.token)).status, 403);
    await query("UPDATE usuarios SET rol = 'admin' WHERE id = ?", [x.id]);
    assert.equal((await rutaAdmin(x.token)).status, 200);
  });

  it('una sesión abierta antes del despliegue (token sin versión y rol admin) sigue entrando y ve su rol nuevo', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'superadmin' });
    const viejo = tokenSinVersion(x, 'admin');
    assert.equal((await rutaAdmin(viejo)).status, 200);
    const res = await verificar(viejo);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.rol, 'superadmin');
  });
});

describe('cierre de sesiones', () => {
  it('un usuario desactivado recibe 401 con su token', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [x.id]);
    assert.equal((await verificar(x.token)).status, 401);
  });

  it('si cambia la versión de sesión, el token anterior deja de servir', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await query('UPDATE usuarios SET sesion_version = sesion_version + 1 WHERE id = ?', [x.id]);
    assert.equal((await verificar(x.token)).status, 401);
  });

  it('un token sin userId recibe 401', async () => {
    const raro = jwt.sign({ rol: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    assert.equal((await verificar(raro)).status, 401);
  });

  it('el token del login trae la versión de sesión', () => {
    assert.equal(jwt.decode(usuarios.lector.token).v, 0);
  });
});

describe('login', () => {
  it('devuelve cargo y vínculo y registra el último ingreso sin tocar updated_at', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await query(
      "UPDATE usuarios SET cargo = 'Cargo de prueba', vinculo = 'contrato', ultimo_ingreso = NULL, updated_at = '2026-01-01 00:00:00' WHERE id = ?",
      [x.id]
    );
    const res = await api.post('/auth/login', { username: x.username, password: x.password });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.cargo, 'Cargo de prueba');
    assert.equal(res.body.data.user.vinculo, 'contrato');
    const [fila] = await query(
      "SELECT ultimo_ingreso IS NOT NULL AS con_ingreso, updated_at = '2026-01-01 00:00:00' AS sin_tocar FROM usuarios WHERE id = ?",
      [x.id]
    );
    assert.equal(fila.con_ingreso, 1);
    assert.equal(fila.sin_tocar, 1);
  });

  it('un usuario sin contraseña (invitación pendiente) recibe la misma respuesta que uno inexistente', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await query('UPDATE usuarios SET password_hash = NULL WHERE id = ?', [x.id]);
    const sinContrasena = await api.post('/auth/login', { username: x.username, password: 'cualquier-cosa' });
    const inexistente = await api.post('/auth/login', { username: `no_existe_${x.username}`, password: 'cualquier-cosa' });
    assert.equal(sinContrasena.status, 401);
    assert.deepEqual(sinContrasena.body, inexistente.body);
    assert.deepEqual(sinContrasena.body, { success: false, error: 'Credenciales inválidas' });
  });

  it('verify y profile devuelven cargo y vínculo', async () => {
    await query("UPDATE usuarios SET cargo = 'Cargo X', vinculo = 'planta_permanente' WHERE id = ?", [usuarios.lector.id]);
    for (const ruta of ['/auth/verify', '/auth/profile']) {
      const { user } = (await api.get(ruta, { token: usuarios.lector.token })).body.data;
      assert.equal(user.cargo, 'Cargo X', ruta);
      assert.equal(user.vinculo, 'planta_permanente', ruta);
    }
  });
});

describe('Mi Perfil', () => {
  it('cambiar la contraseña devuelve un token nuevo, invalida el anterior y queda en el historial', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const res = await api.post('/auth/change-password', { currentPassword: x.password, newPassword: 'NuevaClave123' }, { token: x.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Contraseña actualizada correctamente');
    assert.equal((await verificar(x.token)).status, 401);
    assert.equal((await verificar(res.body.data.token)).status, 200);
    const historial = await query('SELECT accion, actor_id FROM usuarios_auditoria WHERE usuario_id = ?', [x.id]);
    assert.deepEqual(historial.map(h => [h.accion, h.actor_id]), [['contrasena_cambiada', x.id]]);
  });

  it('rechaza una contraseña nueva corta (mismo mensaje de siempre) o de más de 72 bytes', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const corta = await api.post('/auth/change-password', { currentPassword: x.password, newPassword: 'corta' }, { token: x.token });
    assert.equal(corta.status, 400);
    assert.equal(corta.body.error, 'La nueva contraseña debe tener al menos 8 caracteres');
    const larga = await api.post('/auth/change-password', { currentPassword: x.password, newPassword: 'ñ'.repeat(40) }, { token: x.token });
    assert.equal(larga.status, 400);
  });

  it('rechaza un email con formato inválido o un nombre de más de 100 caracteres', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    assert.equal((await api.put('/auth/profile', { email: 'no-es-email' }, { token: x.token })).status, 400);
    assert.equal((await api.put('/auth/profile', { nombre_completo: 'x'.repeat(101) }, { token: x.token })).status, 400);
  });

  it('editar nombre y email queda en el historial con los valores anteriores y nuevos', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const res = await api.put('/auth/profile', { nombre_completo: 'Nombre Nuevo', email: `nuevo_${x.email}` }, { token: x.token });
    assert.equal(res.status, 200);
    const [fila] = await query("SELECT detalle FROM usuarios_auditoria WHERE usuario_id = ? AND accion = 'perfil_editado'", [x.id]);
    // mysql2 ya devuelve las columnas JSON de MariaDB como objeto (el servicio contempla las dos formas)
    const detalle = typeof fila.detalle === 'string' ? JSON.parse(fila.detalle) : fila.detalle;
    assert.deepEqual(detalle.campos, {
      nombre_completo: { antes: 'Test x', despues: 'Nombre Nuevo' },
      email: { antes: x.email, despues: `nuevo_${x.email}` }
    });
  });

  const linkVigente = async (usuario) => {
    const token = await acceso.generarLink(pool, { usuarioId: usuario.id, tipo: 'recuperacion' });
    assert.equal((await api.post('/auth/link/validar', { token })).body.data.valido, true);
    return token;
  };

  it('cambiar el email anula los links pendientes: el de la dirección vieja deja de servir', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const token = await linkVigente(x);
    const res = await api.put('/auth/profile', { email: `otro_${x.email}` }, { token: x.token });
    assert.equal(res.status, 200);
    const validacion = await api.post('/auth/link/validar', { token });
    assert.equal(validacion.body.data.valido, false);
    assert.equal(validacion.body.data.motivo, 'invalido');
    const [{ vigentes }] = await query('SELECT COUNT(*) AS vigentes FROM usuarios_tokens WHERE usuario_id = ? AND usado_at IS NULL AND anulado_at IS NULL', [x.id]);
    assert.equal(vigentes, 0);
  });

  it('editar solo el nombre, o guardar el mismo email, no anula los links pendientes', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const token = await linkVigente(x);
    assert.equal((await api.put('/auth/profile', { nombre_completo: 'Solo El Nombre' }, { token: x.token })).status, 200);
    assert.equal((await api.put('/auth/profile', { email: `  ${x.email.toUpperCase()} ` }, { token: x.token })).status, 200);
    assert.equal((await api.post('/auth/link/validar', { token })).body.data.valido, true);
  });

  it('un email con espacios que coincide con el de otro usuario responde 400, no 500', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const res = await api.put('/auth/profile', { email: `   ${usuarios.lector.email}` }, { token: x.token });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El email ya está en uso por otro usuario');
    const [fila] = await query('SELECT email FROM usuarios WHERE id = ?', [x.id]);
    assert.equal(fila.email, x.email);
  });
});
