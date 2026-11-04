// Leer el cuerpo de un pedido, con la app de verdad (spec 2026-11-03-validacion-api-publica): lo que no se puede leer es un error del
// pedido, con un texto fijo que no repite lo que llegó, y los demás errores no cambian
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, cerrarDb } from './helpers.js';
import { tieneClaveReservada } from '../middleware/cuerpo.js';

const NO_SE_PUEDE_LEER = { success: false, error: 'Los datos enviados no tienen un formato válido.' };
const DEMASIADO_GRANDE = { success: false, error: 'Los datos enviados superan el tamaño permitido.' };
const UN_MEGABYTE = 1024 * 1024;

let servidor;

before(async () => {
  servidor = await iniciarServidor();
});

after(async () => {
  await cerrarDb();
  await servidor?.detener();
});

const enviar = async (ruta, cuerpo, { tipo = 'application/json', ip = '203.0.113.200' } = {}) => {
  const res = await fetch(`${servidor.url}/api${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': tipo, 'X-Forwarded-For': ip },
    body: cuerpo
  });
  return { status: res.status, body: await res.json() };
};

describe('un cuerpo que no se puede leer', () => {
  it('un JSON roto da 400 con el formato de la API', async () => {
    const res = await enviar('/contacto', '{"nombre": roto');
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, NO_SE_PUEDE_LEER);
  });

  it('es igual en cualquier ruta, también en una que pide sesión', async () => {
    const res = await enviar('/datasets', '{roto');
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, NO_SE_PUEDE_LEER);
  });

  it('un cuerpo de más de 1 MB da 413 con el formato de la API', async () => {
    const res = await enviar('/contacto', JSON.stringify({ mensaje: 'x'.repeat(UN_MEGABYTE) }));
    assert.equal(res.status, 413);
    assert.deepEqual(res.body, DEMASIADO_GRANDE);
  });

  it('un formulario de más de 1 MB da 413', async () => {
    const res = await enviar('/contacto', `mensaje=${'x'.repeat(UN_MEGABYTE)}`, { tipo: 'application/x-www-form-urlencoded' });
    assert.equal(res.status, 413);
    assert.deepEqual(res.body, DEMASIADO_GRANDE);
  });

  it('un formulario con demasiados campos da 413', async () => {
    const campos = Array.from({ length: 1001 }, (_, i) => `c${i}=1`).join('&');
    const res = await enviar('/contacto', campos, { tipo: 'application/x-www-form-urlencoded' });
    assert.equal(res.status, 413);
    assert.deepEqual(res.body, DEMASIADO_GRANDE);
  });

  it('la respuesta y los logs no repiten lo que llegó: queda un renglón con el tipo, el método y la ruta', async () => {
    const marca = 'marca-del-cuerpo-roto-7f3a';
    const res = await enviar('/auth/login', `{"username":"nadie","password":${marca}}`);
    assert.equal(res.status, 400);
    assert.doesNotMatch(JSON.stringify(res.body), new RegExp(marca));
    const logs = servidor.logs();
    assert.doesNotMatch(logs, new RegExp(marca));
    assert.match(logs, /Pedido rechazado \(entity\.parse\.failed\): POST \/api\/auth\/login/);
  });

  it('un cuerpo de más de 1 MB tampoco queda en los logs', async () => {
    const marca = 'marca-del-cuerpo-grande-9c1d';
    const res = await enviar('/contacto', JSON.stringify({ mensaje: marca.repeat(40000) }));
    assert.equal(res.status, 413);
    assert.doesNotMatch(servidor.logs(), new RegExp(marca));
    assert.match(servidor.logs(), /Pedido rechazado \(entity\.too\.large\): POST \/api\/contacto/);
  });

  it('no cuenta como un envío del formulario de contacto', async () => {
    const ip = '203.0.113.201';
    for (let i = 0; i < 6; i++) assert.equal((await enviar('/contacto', '{roto', { ip })).status, 400);
    const res = await enviar('/contacto', JSON.stringify({}), { ip });
    assert.equal(res.status, 400);
    assert.notDeepEqual(res.body, NO_SE_PUEDE_LEER);
  });
});

describe('las claves que pisan lo que todo objeto trae de fábrica', () => {
  for (const clave of ['__proto__', 'constructor', 'toString', 'valueOf']) {
    it(`${clave} da 400, en cualquier nivel`, async () => {
      for (const cuerpo of [`{"${clave}":1}`, `{"dato":{"${clave}":1}}`, `{"lista":[{"${clave}":{"otro":1}}]}`]) {
        const res = await enviar('/contacto', cuerpo);
        assert.equal(res.status, 400, cuerpo);
        assert.deepEqual(res.body, NO_SE_PUEDE_LEER, cuerpo);
      }
    });
  }

  it('en un formulario, también', async () => {
    const res = await enviar('/contacto', 'nombre[toString]=1', { tipo: 'application/x-www-form-urlencoded' });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, NO_SE_PUEDE_LEER);
    assert.match(servidor.logs(), /Pedido rechazado \(clave reservada\): POST \/api\/contacto/);
  });

  it('escrita con escapes, también', async () => {
    const res = await enviar('/contacto', '{"dato":{"\\u0063onstructor":1}}');
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, NO_SE_PUEDE_LEER);
  });

  it('una clave o un texto parecidos llegan a la ruta', async () => {
    const res = await enviar('/contacto', JSON.stringify({ constructora: 1, nombre: 'x', email: 'constructor', tipo: 'toString', mensaje: 'valueOf' }), { ip: '203.0.113.202' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /El nombre debe tener al menos 2 caracteres/);
  });

  it('un JSON muy anidado se responde y el proceso sigue vivo', async () => {
    const hondo = 200000;
    const res = await enviar('/contacto', `${'['.repeat(hondo)}${']'.repeat(hondo)}`, { ip: '203.0.113.203' });
    assert.equal(res.status, 400);
    const salud = await fetch(`${servidor.url}/api/health`);
    assert.equal(salud.status, 200);
  });
});

describe('tieneClaveReservada', () => {
  it('lo que no es un objeto, o no trae ninguna, da false', () => {
    for (const valor of [undefined, null, 0, 'constructor', true, {}, [], { a: 1 }, ['constructor'], { a: { b: ['toString'] } }]) {
      assert.equal(tieneClaveReservada(valor), false, JSON.stringify(valor));
    }
  });

  it('la encuentra en cualquier nivel, también después de muchos niveles', () => {
    assert.equal(tieneClaveReservada(JSON.parse('{"a":[1,{"b":[{"__proto__":null}]}]}')), true);
    const hondo = 100000;
    assert.equal(tieneClaveReservada(JSON.parse(`${'{"a":['.repeat(hondo)}{"valueOf":1}${']}'.repeat(hondo)}`)), true);
    assert.equal(tieneClaveReservada(JSON.parse(`${'{"a":['.repeat(hondo)}{"valor":1}${']}'.repeat(hondo)}`)), false);
  });
});

describe('lo demás sigue como estaba', () => {
  it('un cuerpo de menos de 1 MB llega a la ruta', async () => {
    const res = await enviar('/contacto', JSON.stringify({ mensaje: 'x'.repeat(UN_MEGABYTE - 100) }), { ip: '203.0.113.204' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /El nombre debe tener al menos 2 caracteres/);
  });

  it('una ruta de la API que no existe da 404', async () => {
    const res = await fetch(`${servidor.url}/api/no-existe`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { success: false, error: 'Ruta no encontrada' });
  });

  it('un error que no es de la lectura del cuerpo sigue en 500, aunque traiga otro status', async () => {
    const res = await fetch(`${servidor.url}/api/datasets/%E0%A4%A`);
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { success: false, error: 'Error interno del servidor' });
  });

  it('un tipo de contenido que no se conoce sigue sin leerse: la ruta recibe un cuerpo vacío', async () => {
    const res = await enviar('/contacto', '{roto', { tipo: 'text/plain', ip: '203.0.113.205' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /El nombre debe tener al menos 2 caracteres/);
  });
});
