// Leer el cuerpo de un pedido, con la app de verdad (spec 2026-11-03-validacion-api-publica): lo que no se puede usar es un error del
// pedido, con un texto fijo que no repite lo que llegó, y los demás errores no cambian
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, cerrarDb } from './helpers.js';
import { motivoDeRechazo, TOPE_DE_NIVELES } from '../middleware/cuerpo.js';

const NO_SE_PUEDE_LEER = { success: false, error: 'Los datos enviados no tienen un formato válido.' };
const DEMASIADO_GRANDE = { success: false, error: 'Los datos enviados superan el tamaño permitido.' };
const UN_MEGABYTE = 1024 * 1024;
const FORMULARIO = 'application/x-www-form-urlencoded';

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

// Los logs llegan por otro caño que la respuesta. Cada test usa su ruta, porque la lectura del cuerpo corre antes de las rutas
const aparecioEnLosLogs = async (texto) => {
  for (let i = 0; i < 50 && !servidor.logs().includes(texto); i++) await new Promise((resolver) => setTimeout(resolver, 20));
  return servidor.logs().includes(texto);
};

// Un JSON con tantos contenedores uno dentro del otro
const anidado = (cuantos) => JSON.parse(`${'['.repeat(cuantos)}${']'.repeat(cuantos)}`);

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
    const res = await enviar('/contacto', `mensaje=${'x'.repeat(UN_MEGABYTE)}`, { tipo: FORMULARIO });
    assert.equal(res.status, 413);
    assert.deepEqual(res.body, DEMASIADO_GRANDE);
  });

  it('un formulario con demasiados campos da 413', async () => {
    const campos = Array.from({ length: 1001 }, (_, i) => `c${i}=1`).join('&');
    const res = await enviar('/contacto', campos, { tipo: FORMULARIO });
    assert.equal(res.status, 413);
    assert.deepEqual(res.body, DEMASIADO_GRANDE);
  });

  it('la respuesta y los logs no repiten lo que llegó: queda un renglón con el tipo, el método y la ruta', async () => {
    const marca = 'marca-del-cuerpo-roto-7f3a';
    const res = await enviar('/prueba-del-json-roto', `{"dato":${marca}}`);
    assert.equal(res.status, 400);
    assert.doesNotMatch(JSON.stringify(res.body), new RegExp(marca));
    assert.ok(await aparecioEnLosLogs('Pedido rechazado (entity.parse.failed): POST /api/prueba-del-json-roto'));
    assert.doesNotMatch(servidor.logs(), new RegExp(marca));
  });

  it('un cuerpo de más de 1 MB deja su renglón en los logs', async () => {
    const res = await enviar('/prueba-del-cuerpo-grande', JSON.stringify({ mensaje: 'x'.repeat(UN_MEGABYTE) }));
    assert.equal(res.status, 413);
    assert.ok(await aparecioEnLosLogs('Pedido rechazado (entity.too.large): POST /api/prueba-del-cuerpo-grande'));
  });

  it('no cuenta como un envío del formulario de contacto', async () => {
    const ip = '203.0.113.201';
    for (let i = 0; i < 6; i++) assert.equal((await enviar('/contacto', '{roto', { ip })).status, 400);
    const res = await enviar('/contacto', JSON.stringify({}), { ip });
    assert.equal(res.status, 400);
    assert.notDeepEqual(res.body, NO_SE_PUEDE_LEER);
  });
});

describe('un cuerpo que no es un dato común', () => {
  for (const clave of ['__proto__', 'constructor', 'toString', 'valueOf']) {
    it(`la clave ${clave} da 400, en cualquier nivel`, async () => {
      for (const cuerpo of [`{"${clave}":1}`, `{"dato":{"${clave}":1}}`, `{"lista":[{"${clave}":{"otro":1}}]}`]) {
        const res = await enviar('/contacto', cuerpo);
        assert.equal(res.status, 400, cuerpo);
        assert.deepEqual(res.body, NO_SE_PUEDE_LEER, cuerpo);
      }
    });
  }

  it('en un formulario, también', async () => {
    const res = await enviar('/prueba-de-la-clave', 'dato[toString]=1', { tipo: FORMULARIO });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, NO_SE_PUEDE_LEER);
    assert.ok(await aparecioEnLosLogs('Pedido rechazado (clave reservada): POST /api/prueba-de-la-clave'));
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

  it('más niveles que el tope dan 400, y hasta el tope llegan a la ruta', async () => {
    const demasiados = await enviar('/prueba-de-los-niveles', JSON.stringify(anidado(TOPE_DE_NIVELES + 2)));
    assert.equal(demasiados.status, 400);
    assert.deepEqual(demasiados.body, NO_SE_PUEDE_LEER);
    assert.ok(await aparecioEnLosLogs('Pedido rechazado (demasiados niveles): POST /api/prueba-de-los-niveles'));

    const justo = await enviar('/contacto', JSON.stringify(anidado(TOPE_DE_NIVELES + 1)), { ip: '203.0.113.203' });
    assert.equal(justo.status, 400);
    assert.match(justo.body.error, /El nombre debe tener al menos 2 caracteres/);
  });
});

describe('motivoDeRechazo', () => {
  it('lo que no es un objeto, o es un dato común, se admite', () => {
    for (const valor of [undefined, null, 0, 'constructor', true, {}, [], { a: 1 }, ['constructor'], { a: { b: ['toString'] } }]) {
      assert.equal(motivoDeRechazo(valor), null, JSON.stringify(valor));
    }
  });

  it('encuentra una clave reservada en cualquier nivel', () => {
    assert.equal(motivoDeRechazo(JSON.parse('{"a":[1,{"b":[{"__proto__":null}]}]}')), 'clave reservada');
    assert.equal(motivoDeRechazo(JSON.parse('[[[{"valueOf":1}]]]')), 'clave reservada');
  });

  it('cuenta los niveles, en listas y en objetos', () => {
    assert.equal(motivoDeRechazo(anidado(TOPE_DE_NIVELES + 1)), null);
    assert.equal(motivoDeRechazo(anidado(TOPE_DE_NIVELES + 2)), 'demasiados niveles');
    const objetos = (cuantos) => JSON.parse(`${'{"a":'.repeat(cuantos)}1${'}'.repeat(cuantos)}`);
    assert.equal(motivoDeRechazo(objetos(TOPE_DE_NIVELES + 1)), null);
    assert.equal(motivoDeRechazo(objetos(TOPE_DE_NIVELES + 2)), 'demasiados niveles');
  });

  it('un valor suelto en el último nivel no suma uno', () => {
    let cuerpo = 'un-texto';
    for (let i = 0; i <= TOPE_DE_NIVELES; i++) cuerpo = [cuerpo];
    assert.equal(motivoDeRechazo(cuerpo), null);
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
