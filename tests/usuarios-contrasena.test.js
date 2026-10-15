// Links de acceso (spec 7): recuperación, invitación y "¿Olvidaste tu contraseña?". Base de prueba propia.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query,
  mailpit, paraCasilla, tokenDelLink
} from './helpers.js';

let base, servidor, api, usuarios, acceso, pool, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_usuarios_contrasena');
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
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  await mailpit.vaciar();
});

// mysql2 devuelve la columna JSON ya parseada (MariaDB la guarda como texto, pero el driver la entrega como objeto)
const detalleDe = (fila) => typeof fila.detalle === 'string' ? JSON.parse(fila.detalle) : fila.detalle;

// app.js confía en un proxy: la IP del pedido es la última de X-Forwarded-For. Cada pedido usa una IP
// distinta para no chocar con los límites, salvo en los tests de límites.
let ultimaIp = 0;
const ipNueva = () => ({ 'X-Forwarded-For': `198.51.100.${++ultimaIp}` });

const validar = (token) => api.post('/auth/link/validar', { token }, { headers: ipNueva() });
const establecer = (token, password) => api.post('/auth/establecer-contrasena', { token, password }, { headers: ipNueva() });
const recuperar = (identificador, headers = ipNueva()) => api.post('/auth/recuperar', { identificador }, { headers });
const linkPara = (usuario, tipo = 'recuperacion') => acceso.generarLink(pool, { usuarioId: usuario.id, tipo });

describe('link de recuperación', () => {
  it('se valida, sirve una sola vez y deja ingresar con la contraseña nueva', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const token = await linkPara(x);
    const validacion = await validar(token);
    assert.equal(validacion.status, 200);
    assert.deepEqual(validacion.body.data, { valido: true, tipo: 'recuperacion', username: x.username, nombre_completo: 'Test x' });

    const guardado = await establecer(token, 'ContraseñaNueva1');
    assert.equal(guardado.status, 200);
    assert.equal(guardado.body.message, 'Tu contraseña quedó guardada. Ya podés ingresar.');
    assert.ok(await api.login(x.username, 'ContraseñaNueva1'));

    const otraVez = await establecer(token, 'OtraContraseña2');
    assert.equal(otraVez.status, 400);
    assert.equal(otraVez.body.motivo, 'usado');
    assert.deepEqual((await validar(token)).body.data, { valido: false, motivo: 'usado' });
  });

  it('al establecer la contraseña se cierran las sesiones abiertas y queda en el historial', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'admin' });
    await establecer(await linkPara(x), 'ContraseñaNueva1');
    assert.equal((await api.get('/auth/verify', { token: x.token })).status, 401);
    const historial = await query('SELECT accion, actor_id FROM usuarios_auditoria WHERE usuario_id = ?', [x.id]);
    assert.deepEqual(historial.map(h => [h.accion, h.actor_id]), [['contrasena_establecida', x.id]]);
  });

  it('un link vencido no sirve', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const token = await linkPara(x);
    await query('UPDATE usuarios_tokens SET expira_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE usuario_id = ?', [x.id]);
    assert.deepEqual((await validar(token)).body.data, { valido: false, motivo: 'vencido' });
    const res = await establecer(token, 'ContraseñaNueva1');
    assert.equal(res.status, 400);
    assert.equal(res.body.motivo, 'vencido');
    assert.equal(res.body.error, 'El link venció. Pedí uno nuevo.');
  });

  it('generar un link nuevo anula el anterior', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const primero = await linkPara(x);
    const segundo = await linkPara(x);
    assert.deepEqual((await validar(primero)).body.data, { valido: false, motivo: 'invalido' });
    assert.equal((await validar(segundo)).body.data.valido, true);
  });

  it('un link inventado o mal formado no sirve', async () => {
    for (const token of [crypto.randomBytes(32).toString('base64url'), 'corto', '<script>alert(1)</script>', 123, null]) {
      assert.deepEqual((await validar(token)).body.data, { valido: false, motivo: 'invalido' }, String(token));
    }
  });

  it('el link de un usuario desactivado no sirve', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const token = await linkPara(x);
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [x.id]);
    assert.deepEqual((await validar(token)).body.data, { valido: false, motivo: 'invalido' });
  });

  it('rechaza contraseñas de menos de 8 caracteres o de más de 72 bytes, sin consumir el link', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const token = await linkPara(x);
    const corta = await establecer(token, 'corta');
    assert.equal(corta.status, 400);
    assert.equal(corta.body.error, 'La contraseña debe tener al menos 8 caracteres');
    assert.equal((await establecer(token, 'ñ'.repeat(37))).status, 400);
    assert.equal((await validar(token)).body.data.valido, true);
  });

  it('dos pedidos simultáneos con el mismo link: solo uno guarda la contraseña', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const token = await linkPara(x);
    const resultados = await Promise.all([establecer(token, 'PrimeraClave1'), establecer(token, 'SegundaClave2')]);
    assert.deepEqual(resultados.map(r => r.status).sort(), [200, 400]);
    assert.equal(resultados.find(r => r.status === 400).body.motivo, 'usado');
  });
});

describe('vencimiento en los emails', () => {
  it('se muestra en 24 horas y en la hora de Argentina, para que "vence el … h" se lea bien', async () => {
    const { fechaHoraArgentina } = await import('../services/emailTemplates.js');
    const texto = fechaHoraArgentina(new Date('2026-10-18T17:30:00Z'));
    assert.match(texto, /^18 de octubre de 2026.* 14:30$/);
  });
});

describe('¿Olvidaste tu contraseña?', () => {
  it('responde lo mismo para una cuenta activa, una inexistente y una desactivada, y solo escribe a la activa', async () => {
    const { activa, desactivada } = await crearUsuariosPrueba(api, { activa: 'lector', desactivada: 'lector' });
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [desactivada.id]);
    const respuestas = [await recuperar(activa.username), await recuperar('no_existe_nadie'), await recuperar(desactivada.email)];
    for (const res of respuestas) {
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        success: true,
        message: 'Si los datos corresponden a una cuenta activa, te enviamos un email con un link. Revisá también la carpeta de spam.'
      });
    }
    const paraActiva = await mailpit.esperar(paraCasilla(activa.email));
    assert.equal(paraActiva.length, 1);
    assert.equal(paraActiva[0].Subject, 'Restablecé tu contraseña del RPAD');
    assert.equal((await mailpit.mensajes()).filter(paraCasilla(desactivada.email)).length, 0);
  });

  it('acepta el email en lugar del usuario; el link del email funciona y el pedido queda en el historial', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await recuperar(x.email.toUpperCase());
    const [mensaje] = await mailpit.esperar(paraCasilla(x.email));
    const token = tokenDelLink(await mailpit.html(mensaje.ID));
    assert.equal((await validar(token)).body.data.tipo, 'recuperacion');
    const [fila] = await query("SELECT actor_id, detalle FROM usuarios_auditoria WHERE usuario_id = ? AND accion = 'recuperacion_enviada'", [x.id]);
    assert.equal(fila.actor_id, null);
    assert.deepEqual(detalleDe(fila), { origen: 'login', email_enviado: true });
  });

  it('a un usuario con la invitación pendiente le reenvía la invitación', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await query('UPDATE usuarios SET password_hash = NULL WHERE id = ?', [x.id]);
    await recuperar(x.username);
    const [mensaje] = await mailpit.esperar(paraCasilla(x.email));
    assert.equal(mensaje.Subject, 'Tu acceso al RPAD');
  });

  it('limita a 3 pedidos por hora para un mismo usuario, aunque cambie la IP', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    for (let i = 0; i < 3; i++) assert.equal((await recuperar(x.username)).status, 200);
    assert.equal((await recuperar(x.username)).status, 429);
  });

  it('limita a 5 pedidos por hora desde una misma IP', async () => {
    const misma = { 'X-Forwarded-For': '192.0.2.10' };
    for (let i = 0; i < 5; i++) assert.equal((await recuperar(`nadie_${i}`, misma)).status, 200);
    assert.equal((await recuperar('nadie_6', misma)).status, 429);
  });
});
