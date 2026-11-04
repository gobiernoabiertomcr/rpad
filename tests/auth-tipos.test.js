// Login y "¿Olvidaste tu contraseña?" con valores que no son textos (spec 2026-11-03-validacion-api-publica): el 400 o la respuesta de
// siempre, nunca un 500, y lo que guardan los límites de intentos queda acotado. Cada test con su IP: req.ip es el último valor de
// X-Forwarded-For
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';

const REQUERIDOS = { success: false, error: 'Usuario y contraseña son requeridos' };
const RESPUESTA_DE_RECUPERAR = 'Si los datos corresponden a una cuenta activa, te enviamos un email con un link. Revisá también la carpeta de spam.';
const NO_SON_TEXTOS = [12345678, true, ['un-texto'], { a: 'un-texto' }, [], {}];

let servidor, api, usuarios;
let ips = 0;
const otraIp = () => { ips += 1; return { 'X-Forwarded-For': `192.0.2.${ips}` }; };
const entrar = (body, headers = otraIp()) => api.post('/auth/login', body, { headers });
const recuperar = (body, headers = otraIp()) => api.post('/auth/recuperar', body, { headers });
const crudo = (ruta, cuerpo, tipo, headers = otraIp()) => fetch(`${servidor.url}/api${ruta}`, {
  method: 'POST', headers: { 'Content-Type': tipo, ...headers }, body: cuerpo
});

before(async () => {
  servidor = await iniciarServidor();
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, { adminA: 'admin' });
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
});

describe('login', () => {
  for (const valor of NO_SON_TEXTOS) {
    const nombre = JSON.stringify(valor);
    it(`username ${nombre}: 400 con el mensaje de siempre`, async () => {
      const res = await entrar({ username: valor, password: 'una-contrasena' });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, REQUERIDOS);
    });

    it(`password ${nombre}: 400 con el mensaje de siempre`, async () => {
      const res = await entrar({ username: usuarios.adminA.username, password: valor });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, REQUERIDOS);
    });
  }

  it('la contraseña correcta dentro de una lista no entra', async () => {
    const { username, password } = usuarios.adminA;
    const res = await entrar({ username, password: [password] });
    assert.equal(res.status, 400);
    assert.equal(res.body.data, undefined);
  });

  it('un username dentro de una lista no entra', async () => {
    const { username, password } = usuarios.adminA;
    const res = await entrar({ username: [username], password });
    assert.equal(res.status, 400);
    assert.equal(res.body.data, undefined);
  });

  it('en un formulario, igual', async () => {
    const res = await crudo('/auth/login', 'username[a]=b&password=x', 'application/x-www-form-urlencoded');
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), REQUERIDOS);
  });

  it('lo que ya andaba: con los textos correctos entra y sin ellos, 401', async () => {
    const { username, password } = usuarios.adminA;
    const bien = await entrar({ username, password });
    assert.equal(bien.status, 200);
    assert.equal(bien.body.data.user.username, username);
    assert.equal((await entrar({ username, password: 'incorrecta' })).status, 401);
    assert.equal((await entrar({ username: 'no_existe_este_usuario', password })).status, 401);
    assert.deepEqual((await entrar({ username, password: '' })).body, REQUERIDOS);
    assert.deepEqual((await entrar({ password })).body, REQUERIDOS);
  });
});

describe('el límite de intentos de login', () => {
  const headers = { 'X-Forwarded-For': '192.0.2.200' };

  it('dos usuarios que empiezan con los mismos 100 caracteres cuentan juntos', async () => {
    const comun = 'x'.repeat(100);
    for (let i = 1; i <= 10; i++) {
      const res = await entrar({ username: `${comun}${i}`, password: 'incorrecta' }, headers);
      assert.equal(res.status, 401, `el intento ${i} todavía no debe bloquearse`);
    }
    assert.equal((await entrar({ username: `${comun}11`, password: 'incorrecta' }, headers)).status, 429);
  });

  it('si difieren en el carácter 100, cuentan aparte', async () => {
    const res = await entrar({ username: `${'x'.repeat(99)}y`, password: 'incorrecta' }, headers);
    assert.equal(res.status, 401);
  });

  it('los valores que no son textos cuentan juntos', async () => {
    const otra = { 'X-Forwarded-For': '192.0.2.201' };
    for (let i = 1; i <= 10; i++) {
      const res = await entrar({ username: [`lista-${i}`], password: 'x' }, otra);
      assert.equal(res.status, 400, `el intento ${i} todavía no debe bloquearse`);
    }
    assert.equal((await entrar({ username: ['lista-11'], password: 'x' }, otra)).status, 429);
  });
});

describe('¿Olvidaste tu contraseña?', () => {
  const tokensDe = async (id) => (await query('SELECT COUNT(*) AS n FROM usuarios_tokens WHERE usuario_id = ?', [id]))[0].n;

  it('un usuario dentro de una lista: la respuesta de siempre, y no se busca ni se manda nada', async () => {
    const res = await recuperar({ identificador: [usuarios.adminA.username] });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true, message: RESPUESTA_DE_RECUPERAR });
    await new Promise((resolver) => setTimeout(resolver, 300));
    assert.equal(Number(await tokensDe(usuarios.adminA.id)), 0);
  });

  it('dos identificadores que empiezan con los mismos 100 caracteres cuentan juntos', async () => {
    const comun = 'z'.repeat(100);
    for (let i = 1; i <= 3; i++) assert.equal((await recuperar({ identificador: `${comun}${i}` })).status, 200, `el pedido ${i}`);
    assert.equal((await recuperar({ identificador: `${comun}4` })).status, 429);
  });

  it('un texto de verdad sigue buscando la cuenta', async () => {
    const res = await recuperar({ identificador: usuarios.adminA.username });
    assert.equal(res.status, 200);
    // El envío sigue después de responder: lo último que escribe es el historial
    let enviados = 0;
    for (let i = 0; i < 50 && enviados === 0; i++) {
      await new Promise((resolver) => setTimeout(resolver, 100));
      [{ enviados }] = await query(
        "SELECT COUNT(*) AS enviados FROM usuarios_auditoria WHERE usuario_id = ? AND accion = 'recuperacion_enviada'",
        [usuarios.adminA.id]
      );
      enviados = Number(enviados);
    }
    assert.equal(enviados, 1);
    assert.equal(Number(await tokensDe(usuarios.adminA.id)), 1);
  });
});
