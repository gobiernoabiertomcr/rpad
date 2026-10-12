// Formulario de contacto: límite por IP real y contenido seguro del email
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, crearCliente, cerrarDb, mailpit } from './helpers.js';

let servidor, api;

before(async () => {
  servidor = await iniciarServidor();
  api = crearCliente(servidor.url);
});

after(async () => {
  await cerrarDb();
  await servidor?.detener();
});

const mensaje = {
  nombre: 'Persona de prueba',
  email: 'persona@rpad.test',
  tipo: 'consulta-general',
  mensaje: 'Mensaje de prueba enviado por los tests automáticos.'
};

describe('límite de envíos del formulario de contacto', () => {
  it('cuenta la IP real que agrega el proxy, no la que inventa el cliente', async () => {
    // En producción Apache agrega la IP real al final de X-Forwarded-For
    for (let i = 1; i <= 5; i++) {
      const res = await api.post('/contacto', mensaje, { headers: { 'X-Forwarded-For': `10.0.0.${i}, 203.0.113.50` } });
      assert.equal(res.status, 200, `el envío ${i} debe aceptarse`);
    }
    const sexto = await api.post('/contacto', mensaje, { headers: { 'X-Forwarded-For': '10.0.0.99, 203.0.113.50' } });
    assert.equal(sexto.status, 429);
  });
});

describe('email que recibe datos públicos', () => {
  it('muestra la IP como texto aunque traiga HTML', async () => {
    await mailpit.vaciar();
    const res = await api.post('/contacto', mensaje, { headers: { 'X-Forwarded-For': '<b>ip-inyectada</b>' } });
    assert.equal(res.status, 200);
    const [email] = await mailpit.mensajes();
    const html = await mailpit.html(email.ID);
    assert.doesNotMatch(html, /<b>ip-inyectada<\/b>/);
  });
});
