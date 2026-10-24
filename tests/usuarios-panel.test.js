// Panel de usuarios (spec 8 a 11), contra una base de prueba propia
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query,
  mailpit, paraCasilla, tokenDelLink
} from './helpers.js';

const MINIMO = 'No se puede: quedarían menos de 2 usuarios que puedan aprobar cambios.';
const PROTEGIDA = 'Esta cuenta solo la modifica su titular.';
let base, servidor, api, usuarios, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_usuarios_panel');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api);
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

// Cada prueba arranca igual: los 4 usuarios base activos, con su rol, y sesiones nuevas
// (admin A, admin B y el superadmin son 3 aprobadores activos). Los usuarios creados por otras pruebas quedan desactivados.
beforeEach(async () => {
  await mailpit.vaciar();
  const ids = Object.values(usuarios).map(u => u.id);
  await query('UPDATE usuarios SET activo = 0 WHERE id NOT IN (?)', [ids]);
  for (const u of Object.values(usuarios)) {
    await query('UPDATE usuarios SET activo = 1, rol = ? WHERE id = ?', [u.rol, u.id]);
    u.token = await api.login(u.username, u.password);
  }
});

const comoA = () => ({ token: usuarios.adminA.token });
const comoB = () => ({ token: usuarios.adminB.token });
const comoSuper = () => ({ token: usuarios.superadmin.token });
const auditoria = (usuarioId, accion) =>
  query('SELECT actor_id, detalle FROM usuarios_auditoria WHERE usuario_id = ? AND accion = ? ORDER BY id', [usuarioId, accion]);
// mysql2 + MariaDB entregan la columna JSON ya como objeto; si llegara como texto, se parsea
const detalleDe = (fila) => (typeof fila.detalle === 'string' ? JSON.parse(fila.detalle) : fila.detalle);
const nuevo = (datos) => ({ rol: 'lector', ...datos });

describe('permisos', () => {
  it('sin sesión 401, lector 403, admin y superadmin 200', async () => {
    assert.equal((await api.get('/usuarios')).status, 401);
    assert.equal((await api.get('/usuarios', { token: usuarios.lector.token })).status, 403);
    assert.equal((await api.get('/usuarios', comoA())).status, 200);
    assert.equal((await api.get('/usuarios', comoSuper())).status, 200);
  });
});

describe('lista', () => {
  it('trae a cada usuario con su estado, sin la contraseña, y el resumen de aprobadores', async () => {
    const { usuarios: lista, resumen } = (await api.get('/usuarios', comoA())).body.data;
    assert.deepEqual(resumen, { aprobadores_activos: 3, minimo: 2 });
    const a = lista.find(u => u.id === usuarios.adminA.id);
    assert.equal(a.estado, 'activo');
    assert.equal(a.email_valido, true);
    assert.equal(a.rol, 'admin');
    assert.ok(a.ultimo_ingreso);
    assert.equal('password_hash' in a, false);
  });

  it('marca la invitación pendiente y el email inválido', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await query("UPDATE usuarios SET password_hash = NULL, email = 'sin-arroba-lista' WHERE id = ?", [x.id]);
    const fila = (await api.get('/usuarios', comoA())).body.data.usuarios.find(u => u.id === x.id);
    assert.equal(fila.estado, 'invitacion_pendiente');
    assert.equal(fila.email_valido, false);
  });
});

describe('alta', () => {
  it('crea al usuario con la invitación pendiente, normaliza los datos y envía la invitación', async () => {
    const res = await api.post('/usuarios', nuevo({
      nombre_completo: '  Laura Inés Fernández ', username: 'lifernandez', email: 'LIF@RPAD.test',
      cargo: 'Cargo de prueba', vinculo: 'contrato'
    }), comoA());
    assert.equal(res.status, 201);
    assert.equal(res.body.data.email_enviado, true);
    assert.equal(res.body.message, 'Usuario creado. Le enviamos la invitación a lif@rpad.test.');
    const u = res.body.data.usuario;
    assert.equal(u.username, 'LIFERNANDEZ');
    assert.equal(u.email, 'lif@rpad.test');
    assert.equal(u.nombre_completo, 'Laura Inés Fernández');
    assert.equal(u.estado, 'invitacion_pendiente');
    assert.ok(u.invitacion_vence);

    const [mensaje] = await mailpit.esperar(paraCasilla('lif@rpad.test'));
    assert.equal(mensaje.Subject, 'Tu acceso al RPAD');
    const html = await mailpit.html(mensaje.ID);
    assert.match(html, /LIFERNANDEZ/);
    assert.match(html, /Lector/);
    const validacion = await api.post('/auth/link/validar', { token: tokenDelLink(html) });
    assert.equal(validacion.body.data.tipo, 'invitacion');

    const acciones = await query('SELECT accion, actor_id FROM usuarios_auditoria WHERE usuario_id = ? ORDER BY id', [u.id]);
    assert.deepEqual(acciones.map(a => [a.accion, a.actor_id]),
      [['alta', usuarios.adminA.id], ['invitacion_enviada', usuarios.adminA.id]]);
  });

  it('valida los datos e indica el campo', async () => {
    const valido = nuevo({ nombre_completo: 'Persona de Prueba', username: 'PPRUEBA', email: 'pprueba@rpad.test' });
    const casos = [
      [{ email: 'no-es-un-email' }, 400, 'email'],
      [{ nombre_completo: '' }, 400, 'nombre_completo'],
      [{ nombre_completo: 'x'.repeat(101) }, 400, 'nombre_completo'],
      [{ username: 'ab' }, 400, 'username'],
      [{ username: 'PEÑA' }, 400, 'username'],
      [{ cargo: 'x'.repeat(201) }, 400, 'cargo'],
      [{ vinculo: 'otro' }, 400, 'vinculo'],
      [{ rol: 'superadmin' }, 400, 'rol'],
      [{ rol: 'jefe' }, 400, 'rol'],
      [{ username: usuarios.adminA.username.toUpperCase() }, 409, 'username'],
      [{ email: usuarios.adminA.email.toUpperCase() }, 409, 'email']
    ];
    for (const [cambio, status, campo] of casos) {
      const res = await api.post('/usuarios', { ...valido, ...cambio }, comoA());
      assert.equal(res.status, status, JSON.stringify(cambio));
      assert.equal(res.body.campo, campo, JSON.stringify(cambio));
    }
    assert.equal((await query("SELECT COUNT(*) AS n FROM usuarios WHERE username = 'PPRUEBA'"))[0].n, 0);
  });

  it('el admin crea un colaborador', async () => {
    const res = await api.post('/usuarios', nuevo({
      nombre_completo: 'Persona Colaboradora', username: 'PCOLABORA', email: 'pcolabora@rpad.test', rol: 'colaborador'
    }), comoA());
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.usuario.rol, 'colaborador');
    const [mensaje] = await mailpit.esperar(paraCasilla('pcolabora@rpad.test'));
    assert.match(await mailpit.html(mensaje.ID), /Colaborador/);
    const [fila] = await auditoria(res.body.data.usuario.id, 'alta');
    assert.equal(detalleDe(fila).rol, 'colaborador');
  });

  it('si el email no sale, el usuario igual se crea y la respuesta lo avisa', async () => {
    const bloqueado = await iniciarServidor({ env: { DB_NAME: base.nombre, EMAIL_SOLO_A: 'nadie@rpad.test' } });
    try {
      const res = await crearCliente(bloqueado.url).post('/usuarios',
        nuevo({ nombre_completo: 'Sin Envio', username: 'SENVIO', email: 'senvio@rpad.test' }), comoA());
      assert.equal(res.status, 201);
      assert.equal(res.body.data.email_enviado, false);
      assert.equal(res.body.message, 'El usuario se guardó, pero no se pudo enviar el email. Podés reenviarlo desde Enviar link de acceso.');
      const [fila] = await auditoria(res.body.data.usuario.id, 'invitacion_enviada');
      assert.equal(detalleDe(fila).email_enviado, false);
    } finally {
      await bloqueado.detener();
    }
  });
});

describe('edición', () => {
  it('guarda los cambios y los deja en el historial con el valor anterior y el nuevo', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const res = await api.put(`/usuarios/${x.id}`, { nombre_completo: 'Nombre Editado', cargo: 'Cargo nuevo', vinculo: 'planta_permanente' }, comoA());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.cargo, 'Cargo nuevo');
    const [fila] = await auditoria(x.id, 'edicion');
    assert.deepEqual(detalleDe(fila).campos, {
      nombre_completo: { antes: 'Test x', despues: 'Nombre Editado' },
      cargo: { antes: null, despues: 'Cargo nuevo' },
      vinculo: { antes: null, despues: 'planta_permanente' }
    });
  });

  it('sin cambios responde 200 y no escribe en el historial', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const res = await api.put(`/usuarios/${x.id}`, { nombre_completo: 'Test x' }, comoA());
    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Sin cambios');
    assert.equal((await auditoria(x.id, 'edicion')).length, 0);
  });

  it('no deja usar el usuario o el email de otro', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const usuario = await api.put(`/usuarios/${x.id}`, { username: usuarios.adminB.username }, comoA());
    assert.equal(usuario.status, 409);
    assert.equal(usuario.body.campo, 'username');
    const email = await api.put(`/usuarios/${x.id}`, { email: usuarios.adminB.email }, comoA());
    assert.equal(email.status, 409);
    assert.equal(email.body.campo, 'email');
  });

  it('un usuario sin email válido: guardar sin email responde 400 en email; editar solo otro campo funciona', async () => {
    const { x, y } = await crearUsuariosPrueba(api, { x: 'lector', y: 'lector' });
    await query("UPDATE usuarios SET email = '' WHERE id = ?", [x.id]);
    const sinEmail = await api.put(`/usuarios/${x.id}`, { nombre_completo: 'Con Email Vacío', email: '' }, comoA());
    assert.equal(sinEmail.status, 400);
    assert.equal(sinEmail.body.campo, 'email');
    assert.equal((await api.put(`/usuarios/${x.id}`, { cargo: 'Solo cargo' }, comoA())).status, 200);
    // Otro usuario editado sin tocar el email no choca con el '' del primero
    assert.equal((await api.put(`/usuarios/${y.id}`, { cargo: 'Otro cargo' }, comoA())).status, 200);
  });

  it('cambia el rol, lo registra y el usuario lo tiene en el pedido siguiente', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    assert.equal((await api.get('/usuarios', { token: x.token })).status, 403);
    assert.equal((await api.put(`/usuarios/${x.id}`, { rol: 'admin' }, comoA())).status, 200);
    assert.equal((await api.get('/usuarios', { token: x.token })).status, 200);
    const [fila] = await auditoria(x.id, 'cambio_rol');
    assert.deepEqual(detalleDe(fila), { antes: 'lector', despues: 'admin' });
  });

  const altaConInvitacion = async (username, email) => {
    const alta = await api.post('/usuarios', nuevo({ nombre_completo: 'Con Invitación', username, email }), comoA());
    assert.equal(alta.status, 201);
    const [mensaje] = await mailpit.esperar(paraCasilla(email));
    return { id: alta.body.data.usuario.id, token: tokenDelLink(await mailpit.html(mensaje.ID)) };
  };

  it('cambiar el email anula los links pendientes: el de la dirección vieja deja de servir', async () => {
    const { id, token } = await altaConInvitacion('EMAILMAL', 'mal-cargado@rpad.test');
    assert.equal((await api.post('/auth/link/validar', { token })).body.data.valido, true);

    assert.equal((await api.put(`/usuarios/${id}`, { email: 'bien-cargado@rpad.test' }, comoA())).status, 200);

    const validacion = await api.post('/auth/link/validar', { token });
    assert.equal(validacion.body.data.valido, false);
    assert.equal(validacion.body.data.motivo, 'invalido');
    const detalle = (await api.get(`/usuarios/${id}`, comoA())).body.data;
    assert.equal(detalle.estado, 'invitacion_pendiente');
    assert.equal(detalle.invitacion_vence, null);
  });

  it('una invitación vencida no muestra fecha de vencimiento: queda sin link vigente', async () => {
    const { id } = await altaConInvitacion('VENCIDA', 'invitacion-vencida@rpad.test');
    assert.ok((await api.get(`/usuarios/${id}`, comoA())).body.data.invitacion_vence);

    await query('UPDATE usuarios_tokens SET expira_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE usuario_id = ?', [id]);

    const detalle = (await api.get(`/usuarios/${id}`, comoA())).body.data;
    assert.equal(detalle.estado, 'invitacion_pendiente');
    assert.equal(detalle.invitacion_vence, null);
    const fila = (await api.get('/usuarios', comoA())).body.data.usuarios.find(u => u.id === id);
    assert.equal(fila.invitacion_vence, null);
  });

  it('editar otros datos no anula los links pendientes', async () => {
    const { id, token } = await altaConInvitacion('SIGUEVIGENTE', 'sigue-vigente@rpad.test');
    assert.equal((await api.put(`/usuarios/${id}`, { cargo: 'Cargo nuevo' }, comoA())).status, 200);
    assert.equal((await api.post('/auth/link/validar', { token })).body.data.valido, true);
    assert.ok((await api.get(`/usuarios/${id}`, comoA())).body.data.invitacion_vence);
  });
});

describe('cuenta del superadmin', () => {
  it('un admin no puede editarla, desactivarla ni enviarle links', async () => {
    const id = usuarios.superadmin.id;
    for (const res of [
      await api.put(`/usuarios/${id}`, { cargo: 'Cambio de otro' }, comoA()),
      await api.post(`/usuarios/${id}/desactivar`, {}, comoA()),
      await api.post(`/usuarios/${id}/enviar-acceso`, {}, comoA())
    ]) {
      assert.equal(res.status, 403);
      assert.equal(res.body.error, PROTEGIDA);
    }
  });

  it('el superadmin edita sus propios datos pero no su rol ni su estado', async () => {
    const id = usuarios.superadmin.id;
    assert.equal((await api.put(`/usuarios/${id}`, { cargo: 'Mi cargo' }, comoSuper())).status, 200);
    assert.equal((await api.put(`/usuarios/${id}`, { rol: 'admin' }, comoSuper())).status, 403);
    assert.equal((await api.post(`/usuarios/${id}/desactivar`, {}, comoSuper())).status, 403);
    const [fila] = await query('SELECT rol, activo, cargo FROM usuarios WHERE id = ?', [id]);
    assert.deepEqual({ ...fila }, { rol: 'superadmin', activo: 1, cargo: 'Mi cargo' });
  });
});

describe('mínimo de aprobadores', () => {
  it('con 2 aprobadores activos no se puede desactivar ni pasar a lector a ninguno', async () => {
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [usuarios.superadmin.id]);
    for (const res of [
      await api.post(`/usuarios/${usuarios.adminB.id}/desactivar`, {}, comoA()),
      await api.put(`/usuarios/${usuarios.adminB.id}`, { rol: 'lector' }, comoA()),
      await api.put(`/usuarios/${usuarios.adminA.id}`, { rol: 'lector' }, comoA())
    ]) {
      assert.equal(res.status, 409);
      assert.equal(res.body.error, MINIMO);
    }
    assert.equal((await api.post(`/usuarios/${usuarios.lector.id}/desactivar`, {}, comoA())).status, 200);
  });

  it('un admin con la invitación pendiente no cuenta como aprobador', async () => {
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [usuarios.superadmin.id]);
    const alta = await api.post('/usuarios', { nombre_completo: 'Admin Pendiente', username: 'APENDIENTE', email: 'apendiente@rpad.test', rol: 'admin' }, comoA());
    assert.equal(alta.status, 201);
    assert.equal((await api.post(`/usuarios/${usuarios.adminB.id}/desactivar`, {}, comoA())).status, 409);
  });

  it('un colaborador no cuenta para el mínimo de aprobadores', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'colaborador' });
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [usuarios.superadmin.id]);
    assert.equal((await api.get('/usuarios', comoA())).body.data.resumen.aprobadores_activos, 2);
    // Pasar a un admin a colaborador saca un aprobador, como pasarlo a lector
    const res = await api.put(`/usuarios/${usuarios.adminB.id}`, { rol: 'colaborador' }, comoA());
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.equal(res.body.error, MINIMO);
    // Y desactivar a un colaborador no saca ninguno
    assert.equal((await api.post(`/usuarios/${x.id}/desactivar`, {}, comoA())).status, 200);

    await query('UPDATE usuarios SET activo = 1 WHERE id = ?', [usuarios.superadmin.id]);
    const conTres = await api.put(`/usuarios/${usuarios.adminB.id}`, { rol: 'colaborador' }, comoA());
    assert.equal(conTres.status, 200, JSON.stringify(conTres.body));
    assert.equal((await api.get('/usuarios', comoA())).body.data.resumen.aprobadores_activos, 2);
  });

  it('con 3 aprobadores se puede sacar a uno', async () => {
    assert.equal((await api.put(`/usuarios/${usuarios.adminB.id}`, { rol: 'lector' }, comoA())).status, 200);
    assert.equal((await api.get('/usuarios', comoA())).body.data.resumen.aprobadores_activos, 2);
  });

  it('dos admins que se desactivan mutuamente al mismo tiempo dejan al menos 2 aprobadores', async () => {
    const resultados = await Promise.all([
      api.post(`/usuarios/${usuarios.adminB.id}/desactivar`, {}, comoA()),
      api.post(`/usuarios/${usuarios.adminA.id}/desactivar`, {}, comoB())
    ]);
    assert.ok(resultados.some(r => r.status === 200), resultados.map(r => r.status).join(','));
    const [{ n }] = await query("SELECT COUNT(*) AS n FROM usuarios WHERE rol IN ('admin','superadmin') AND activo = 1 AND password_hash IS NOT NULL");
    assert.ok(n >= 2, `quedaron ${n} aprobadores`);
  });
});

describe('desactivar y reactivar', () => {
  it('desactivar cierra la sesión en el acto, anula los links y registra los cambios pendientes', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'admin' });
    await query("INSERT INTO cambios_pendientes (tipo_cambio, datos_nuevos, usuario_id) VALUES ('crear', '{}', ?)", [x.id]);
    const fila = (await api.get('/usuarios', comoA())).body.data.usuarios.find(u => u.id === x.id);
    assert.equal(fila.cambios_pendientes_propuestos, 1);
    await api.post(`/usuarios/${x.id}/enviar-acceso`, {}, comoA());

    const res = await api.post(`/usuarios/${x.id}/desactivar`, {}, comoA());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.estado, 'desactivado');
    assert.equal((await api.get('/auth/verify', { token: x.token })).status, 401);
    const [{ vigentes }] = await query('SELECT COUNT(*) AS vigentes FROM usuarios_tokens WHERE usuario_id = ? AND usado_at IS NULL AND anulado_at IS NULL', [x.id]);
    assert.equal(vigentes, 0);
    const [registro] = await auditoria(x.id, 'desactivacion');
    assert.deepEqual(detalleDe(registro), { cambios_pendientes: 1 });
  });

  it('reactivar devuelve el acceso con la contraseña de siempre', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await api.post(`/usuarios/${x.id}/desactivar`, {}, comoA());
    const res = await api.post(`/usuarios/${x.id}/reactivar`, {}, comoA());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.estado, 'activo');
    assert.ok(await api.login(x.username, x.password));
  });

  it('reactivar a alguien que nunca eligió contraseña lo deja con la invitación pendiente', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await query('UPDATE usuarios SET password_hash = NULL, activo = 0 WHERE id = ?', [x.id]);
    assert.equal((await api.post(`/usuarios/${x.id}/reactivar`, {}, comoA())).body.data.estado, 'invitacion_pendiente');
  });

  it('dos reactivaciones simultáneas del mismo usuario: una sola se aplica y queda un solo registro', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [x.id]);
    const resultados = await Promise.all([
      api.post(`/usuarios/${x.id}/reactivar`, {}, comoA()),
      api.post(`/usuarios/${x.id}/reactivar`, {}, comoB())
    ]);
    assert.deepEqual(resultados.map(r => r.status).sort(), [200, 409]);
    assert.equal((await auditoria(x.id, 'reactivacion')).length, 1);
  });

  it('no se puede desactivar dos veces ni reactivar a alguien activo', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    assert.equal((await api.post(`/usuarios/${x.id}/reactivar`, {}, comoA())).status, 409);
    await api.post(`/usuarios/${x.id}/desactivar`, {}, comoA());
    assert.equal((await api.post(`/usuarios/${x.id}/desactivar`, {}, comoA())).status, 409);
  });
});

describe('enviar link de acceso', () => {
  it('a un usuario activo le envía la recuperación; a uno pendiente, la invitación', async () => {
    const { activo, pendiente } = await crearUsuariosPrueba(api, { activo: 'lector', pendiente: 'lector' });
    await query('UPDATE usuarios SET password_hash = NULL WHERE id = ?', [pendiente.id]);
    assert.equal((await api.post(`/usuarios/${activo.id}/enviar-acceso`, {}, comoA())).body.data.tipo, 'recuperacion');
    assert.equal((await api.post(`/usuarios/${pendiente.id}/enviar-acceso`, {}, comoA())).body.data.tipo, 'invitacion');
    assert.equal((await mailpit.esperar(paraCasilla(activo.email)))[0].Subject, 'Restablecé tu contraseña del RPAD');
    assert.equal((await mailpit.esperar(paraCasilla(pendiente.email)))[0].Subject, 'Tu acceso al RPAD');
  });

  it('no envía a un usuario desactivado ni a uno sin email válido', async () => {
    const { desactivado, sinEmail } = await crearUsuariosPrueba(api, { desactivado: 'lector', sinEmail: 'lector' });
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [desactivado.id]);
    await query("UPDATE usuarios SET email = 'sin-arroba-envio' WHERE id = ?", [sinEmail.id]);
    assert.equal((await api.post(`/usuarios/${desactivado.id}/enviar-acceso`, {}, comoA())).status, 409);
    const res = await api.post(`/usuarios/${sinEmail.id}/enviar-acceso`, {}, comoA());
    assert.equal(res.status, 409);
    assert.equal(res.body.campo, 'email');
  });
});

describe('aviso al superadmin', () => {
  const avisos = () => mailpit.esperar(m => m.Subject === 'RPAD: cambio en los usuarios' && paraCasilla(usuarios.superadmin.email)(m), { intentos: 20 });

  it('le llega cuando un admin cambia un rol, desactiva a alguien o crea un admin', async () => {
    const { x, y } = await crearUsuariosPrueba(api, { x: 'lector', y: 'lector' });
    await api.put(`/usuarios/${x.id}`, { rol: 'admin' }, comoA());
    const [aviso] = await avisos();
    const html = await mailpit.html(aviso.ID);
    assert.match(html, /Test adminA/);
    assert.match(html, /Test x/);
    assert.match(html, /Lector → Administrador/);

    await mailpit.vaciar();
    await api.post(`/usuarios/${y.id}/desactivar`, {}, comoA());
    assert.equal((await avisos()).length, 1);

    await mailpit.vaciar();
    await api.post('/usuarios', { nombre_completo: 'Admin Nuevo', username: 'ANUEVO', email: 'anuevo@rpad.test', rol: 'admin' }, comoA());
    assert.equal((await avisos()).length, 1);
  });

  it('no le llega cuando el cambio lo hace el propio superadmin, ni por cambios de datos', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await api.put(`/usuarios/${x.id}`, { rol: 'admin' }, comoSuper());
    await api.put(`/usuarios/${x.id}`, { cargo: 'Otro cargo' }, comoA());
    await new Promise(r => setTimeout(r, 300));
    assert.equal((await mailpit.mensajes()).filter(m => m.Subject === 'RPAD: cambio en los usuarios').length, 0);
  });

  const avisosRecibidos = async () => {
    await new Promise(r => setTimeout(r, 300));
    return (await mailpit.mensajes()).filter(m => m.Subject === 'RPAD: cambio en los usuarios' && paraCasilla(usuarios.superadmin.email)(m));
  };

  it('le llega cuando un admin cambia el email de otro admin, con el email nuevo', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'admin' });
    const res = await api.put(`/usuarios/${x.id}`, { email: 'email-nuevo-x@rpad.test' }, comoA());
    assert.equal(res.status, 200);
    const [aviso, ...otros] = await avisos();
    assert.equal(otros.length, 0);
    const html = await mailpit.html(aviso.ID);
    assert.match(html, /Email:/);
    assert.match(html, /email-nuevo-x@rpad\.test/);
    assert.match(html, new RegExp(x.email.replace(/\./g, '\\.')));
  });

  it('si en la misma edición cambia el rol y el email de un admin, llega un solo aviso con los dos cambios', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const res = await api.put(`/usuarios/${x.id}`, { rol: 'admin', email: 'email-y-rol-x@rpad.test' }, comoA());
    assert.equal(res.status, 200);
    const recibidos = await avisosRecibidos();
    assert.equal(recibidos.length, 1);
    const html = await mailpit.html(recibidos[0].ID);
    assert.match(html, /Lector → Administrador; Email: .+ → email-y-rol-x@rpad\.test/);
  });

  it('no le llega cuando un admin cambia el email de un lector', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    assert.equal((await api.put(`/usuarios/${x.id}`, { email: 'email-nuevo-lector@rpad.test' }, comoA())).status, 200);
    assert.equal((await avisosRecibidos()).length, 0);
  });

  it('le llega cuando un admin reactiva a un admin desactivado', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'admin' });
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [x.id]);
    const res = await api.post(`/usuarios/${x.id}/reactivar`, {}, comoA());
    assert.equal(res.status, 200);
    const [aviso, ...otros] = await avisos();
    assert.equal(otros.length, 0);
    assert.match(await mailpit.html(aviso.ID), /Reactivado/);
  });

  it('no le llega cuando un admin reactiva a un lector', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [x.id]);
    assert.equal((await api.post(`/usuarios/${x.id}/reactivar`, {}, comoA())).status, 200);
    assert.equal((await avisosRecibidos()).length, 0);
  });

  it('pasar un lector a colaborador avisa al superadmin y queda en el historial', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const res = await api.put(`/usuarios/${x.id}`, { rol: 'colaborador' }, comoA());
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const [aviso, ...otros] = await avisos();
    assert.equal(otros.length, 0);
    const html = await mailpit.html(aviso.ID);
    assert.match(html, /Test x/);
    assert.match(html, /Lector → Colaborador/);
    const [fila] = await auditoria(x.id, 'cambio_rol');
    assert.deepEqual(detalleDe(fila), { antes: 'lector', despues: 'colaborador' });
    const historial = (await api.get(`/usuarios/${x.id}`, comoA())).body.data.historial;
    assert.equal(historial[0].accion, 'cambio_rol');
  });

  it('crear un colaborador no avisa al superadmin', async () => {
    const res = await api.post('/usuarios', nuevo({
      nombre_completo: 'Colaborador Sin Aviso', username: 'CSINAVISO', email: 'csinaviso@rpad.test', rol: 'colaborador'
    }), comoA());
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal((await avisosRecibidos()).length, 0);
  });
});

describe('historial y detalle', () => {
  it('GET /usuarios/:id devuelve el historial del más reciente al más viejo, con quién hizo cada cambio', async () => {
    const alta = await api.post('/usuarios', nuevo({ nombre_completo: 'Con Historial', username: 'HISTORIAL', email: 'historial@rpad.test' }), comoA());
    const id = alta.body.data.usuario.id;
    await api.put(`/usuarios/${id}`, { cargo: 'Cargo' }, comoB());
    const res = await api.get(`/usuarios/${id}`, comoA());
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.historial.map(h => [h.accion, h.actor_username]), [
      ['edicion', usuarios.adminB.username],
      ['invitacion_enviada', usuarios.adminA.username],
      ['alta', usuarios.adminA.username]
    ]);
  });

  it('un id inexistente responde 404', async () => {
    assert.equal((await api.get('/usuarios/999999', comoA())).status, 404);
    assert.equal((await api.put('/usuarios/999999', { cargo: 'x' }, comoA())).status, 404);
    assert.equal((await api.post('/usuarios/999999/desactivar', {}, comoA())).status, 404);
    assert.equal((await api.get('/usuarios/abc', comoA())).status, 404);
  });
});
