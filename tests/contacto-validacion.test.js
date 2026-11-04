// La validación del formulario de contacto, sin servidor ni base (spec 2026-11-03-validacion-api-publica): cada campo, en este orden,
// que sea un texto, su largo y su formato. EMAIL_SOLO_A frena cualquier envío antes de tocar el SMTP: un 500 de envío quiere decir
// que el pedido pasó la validación
import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.EMAIL_SOLO_A = 'nadie@rpad.test';
const { enviarContacto } = await import('../controllers/contactoController.js');

const VALIDO = {
  nombre: 'Persona de prueba',
  email: 'persona@rpad.test',
  tipo: 'consulta-general',
  mensaje: 'Mensaje de prueba enviado por los tests automáticos.'
};
const MENSAJE_DEL_NOMBRE = 'El nombre debe tener al menos 2 caracteres';
const MENSAJE_DEL_EMAIL = 'Ingrese un email válido';
const MENSAJE_DEL_MENSAJE = 'El mensaje debe tener al menos 10 caracteres';
const NO_SE_PUDO_ENVIAR = 'No se pudo enviar el mensaje. Intente nuevamente más tarde.';
const NO_SON_TEXTOS = [12345678901, 0, true, null, ['Persona de prueba'], { a: 'Persona de prueba' }, [], {}];

// Cada pedido con su IP: el límite de 5 envíos por hora se cuenta antes de validar
let pedidos = 0;
const enviar = async (body) => {
  pedidos += 1;
  const respuesta = {};
  const res = {
    status(codigo) { respuesta.status = codigo; return this; },
    json(cuerpo) { respuesta.body = cuerpo; return this; }
  };
  await enviarContacto({ ip: `198.51.100.${pedidos}`, body }, res);
  respuesta.status ??= 200;
  return respuesta;
};

// De tan largo como se pida, con un formato que sirve
const emailDeLargo = (largo) => {
  const dominio = '@rpad.test';
  return `${'a'.repeat(largo - dominio.length)}${dominio}`;
};

before(() => {
  mock.method(console, 'warn', () => {});
  mock.method(console, 'error', () => {});
});

after(() => {
  mock.restoreAll();
  delete process.env.EMAIL_SOLO_A;
});

describe('un campo que no es un texto', () => {
  for (const valor of NO_SON_TEXTOS) {
    const nombre = JSON.stringify(valor);
    it(`nombre ${nombre}: 400 con su mensaje`, async () => {
      const res = await enviar({ ...VALIDO, nombre: valor });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, { success: false, error: MENSAJE_DEL_NOMBRE });
    });

    it(`email ${nombre}: 400 con su mensaje`, async () => {
      const res = await enviar({ ...VALIDO, email: valor });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, { success: false, error: MENSAJE_DEL_EMAIL });
    });

    it(`mensaje ${nombre}: 400 con su mensaje`, async () => {
      const res = await enviar({ ...VALIDO, mensaje: valor });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, { success: false, error: MENSAJE_DEL_MENSAJE });
    });
  }

  it('sin ningún campo, los errores de todos, en su orden', async () => {
    const res = await enviar({});
    assert.equal(res.status, 400);
    assert.equal(res.body.error, `${MENSAJE_DEL_NOMBRE}. ${MENSAJE_DEL_EMAIL}. Seleccione un tipo de consulta válido. ${MENSAJE_DEL_MENSAJE}`);
  });

  it('un tipo que no es un texto: 400', async () => {
    const res = await enviar({ ...VALIDO, tipo: ['consulta-general'] });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Seleccione un tipo de consulta válido');
  });
});

describe('el email', () => {
  it('de 100 caracteres pasa la validación', async () => {
    const res = await enviar({ ...VALIDO, email: emailDeLargo(100) });
    assert.equal(res.status, 500);
    assert.equal(res.body.error, NO_SE_PUDO_ENVIAR);
  });

  it('de 101 caracteres, aunque tenga un formato que sirve: 400', async () => {
    const res = await enviar({ ...VALIDO, email: emailDeLargo(101) });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, MENSAJE_DEL_EMAIL);
  });

  it('los espacios de los extremos no cuentan', async () => {
    const res = await enviar({ ...VALIDO, email: `   ${emailDeLargo(100)}   ` });
    assert.equal(res.status, 500);
    assert.equal(res.body.error, NO_SE_PUDO_ENVIAR);
  });

  it('el largo se mira antes que el formato', async () => {
    const espia = mock.method(RegExp.prototype, 'test');
    let res;
    let largos;
    let conFormato;
    try {
      await enviar(VALIDO);
      conFormato = espia.mock.callCount();
      espia.mock.resetCalls();
      res = await enviar({ ...VALIDO, email: emailDeLargo(101) });
      largos = espia.mock.calls.map((llamada) => String(llamada.arguments[0]).length);
    } finally {
      espia.mock.restore();
    }
    assert.ok(conFormato >= 1, 'un email que sirve pasa por el formato');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, MENSAJE_DEL_EMAIL);
    assert.ok(largos.every((largo) => largo <= 100), `largos: ${largos.join(', ')}`);
  });

  for (const email of ['persona', 'persona@', '@rpad.test', 'persona@rpad', 'per sona@rpad.test', 'per@sona@rpad.test', '   ']) {
    it(`"${email}": 400`, async () => {
      const res = await enviar({ ...VALIDO, email });
      assert.equal(res.status, 400);
      assert.equal(res.body.error, MENSAJE_DEL_EMAIL);
    });
  }
});

describe('lo que ya andaba', () => {
  it('un pedido que sirve llega al envío', async () => {
    const res = await enviar(VALIDO);
    assert.equal(res.status, 500);
    assert.equal(res.body.error, NO_SE_PUDO_ENVIAR);
  });

  it('los bordes del nombre y del mensaje siguen', async () => {
    assert.equal((await enviar({ ...VALIDO, nombre: 'ab' })).body.error, NO_SE_PUDO_ENVIAR);
    assert.equal((await enviar({ ...VALIDO, nombre: ' a ' })).body.error, MENSAJE_DEL_NOMBRE);
    assert.equal((await enviar({ ...VALIDO, nombre: 'a'.repeat(100) })).body.error, NO_SE_PUDO_ENVIAR);
    assert.equal((await enviar({ ...VALIDO, nombre: 'a'.repeat(101) })).body.error, 'El nombre no puede superar los 100 caracteres');
    assert.equal((await enviar({ ...VALIDO, mensaje: 'a'.repeat(10) })).body.error, NO_SE_PUDO_ENVIAR);
    assert.equal((await enviar({ ...VALIDO, mensaje: 'a'.repeat(2000) })).body.error, NO_SE_PUDO_ENVIAR);
    assert.equal((await enviar({ ...VALIDO, mensaje: 'a'.repeat(2001) })).body.error, 'El mensaje no puede superar los 2000 caracteres');
  });

  it('el sexto envío de una misma IP en la hora da 429, también si los anteriores eran inválidos', async () => {
    const res = {};
    const respuesta = { status(codigo) { res.status = codigo; return this; }, json(cuerpo) { res.body = cuerpo; return this; } };
    for (let i = 0; i < 6; i++) await enviarContacto({ ip: '198.51.100.250', body: {} }, respuesta);
    assert.equal(res.status, 429);
  });
});
