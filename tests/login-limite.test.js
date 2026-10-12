// Límite de intentos fallidos de login (fuerza bruta)
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb } from './helpers.js';

const intentarLogin = (api, username, password, headers) =>
  api.post('/auth/login', { username, password }, { headers });

describe('límite por usuario', () => {
  let servidor, api, usuarios;

  before(async () => {
    servidor = await iniciarServidor();
    api = crearCliente(servidor.url);
    usuarios = await crearUsuariosPrueba(api);
  });

  after(async () => {
    await limpiarDatosPrueba(usuarios);
    await servidor?.detener();
  });

  it('tras 10 contraseñas incorrectas bloquea al usuario, incluso con la contraseña correcta', async () => {
    const { username, password } = usuarios.adminA;
    for (let i = 1; i <= 10; i++) {
      const res = await intentarLogin(api, username, 'incorrecta');
      assert.equal(res.status, 401, `el intento ${i} todavía no debe bloquearse`);
    }
    const bloqueado = await intentarLogin(api, username, password);
    assert.equal(bloqueado.status, 429);
    assert.equal(bloqueado.body.success, false);
  });

  it('el bloqueo de un usuario no impide entrar a otro desde la misma IP', async () => {
    const res = await intentarLogin(api, usuarios.adminB.username, usuarios.adminB.password);
    assert.equal(res.status, 200);
  });

  it('los logins correctos no cuentan para el límite', async () => {
    for (let i = 1; i <= 15; i++) {
      const res = await intentarLogin(api, usuarios.lector.username, usuarios.lector.password);
      assert.equal(res.status, 200, `el login correcto ${i} no debe bloquearse`);
    }
  });
});

describe('límite por IP', () => {
  let servidor, api;

  before(async () => {
    servidor = await iniciarServidor();
    api = crearCliente(servidor.url);
  });

  after(async () => {
    await cerrarDb();
    await servidor?.detener();
  });

  it('tras 50 intentos fallidos con usuarios distintos bloquea la IP', async () => {
    for (let i = 1; i <= 50; i++) {
      const res = await intentarLogin(api, `inexistente_${i}`, 'incorrecta');
      assert.equal(res.status, 401, `el intento ${i} todavía no debe bloquearse`);
    }
    const res = await intentarLogin(api, 'inexistente_51', 'incorrecta');
    assert.equal(res.status, 429);
  });

  it('cuenta la IP real que agrega el proxy, no la que inventa el cliente', async () => {
    // En producción Apache agrega la IP real al final de X-Forwarded-For
    for (let i = 1; i <= 50; i++) {
      await intentarLogin(api, `otro_${i}`, 'incorrecta', { 'X-Forwarded-For': `10.0.0.${i}, 203.0.113.9` });
    }
    const res = await intentarLogin(api, 'otro_51', 'incorrecta', { 'X-Forwarded-For': '10.9.9.9, 203.0.113.9' });
    assert.equal(res.status, 429);
  });
});
