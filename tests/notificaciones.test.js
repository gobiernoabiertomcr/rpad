// Notificaciones por email: previews, SMTP y envío de cambios pendientes (capturado por Mailpit)
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb,
  catalogos, mailpit, PREFIJO_TEST
} from './helpers.js';

let servidor, api, usuarios, cat;

before(async () => {
  servidor = await iniciarServidor();
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api);
  cat = await catalogos();
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
});

const TIPOS = ['area-aviso-40'];

describe('previews', () => {
  for (const tipo of TIPOS) {
    it(`genera el HTML de ${tipo}`, async () => {
      const res = await api.get(`/notificaciones/preview/${tipo}`, { token: usuarios.adminA.token });
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/html/);
      assert.match(res.body, /<html/i);
    });
  }

  it('el aviso a las áreas no menciona el WhatsApp', async () => {
    const res = await api.get('/notificaciones/preview/area-aviso-40', { token: usuarios.adminA.token });
    assert.doesNotMatch(res.body, /whatsapp|405-?6894/i);
  });

  it('los siete avisos reemplazados ya no tienen vista previa', async () => {
    for (const tipo of ['interno-60', 'interno-30', 'interno-vencido', 'externo-60', 'externo-40', 'externo-5', 'externo-vencido']) {
      const res = await api.get(`/notificaciones/preview/${tipo}`, { token: usuarios.adminA.token });
      assert.equal(res.status, 400, tipo);
    }
  });

  it('rechaza un tipo inexistente', async () => {
    const res = await api.get('/notificaciones/preview/no-existe', { token: usuarios.adminA.token });
    assert.equal(res.status, 400);
  });

  it('genera el preview de cambios pendientes', async () => {
    const res = await api.get('/notificaciones/preview-cambios-pendientes', { token: usuarios.adminA.token });
    assert.equal(res.status, 200);
    assert.match(res.body, /<html/i);
  });
});

describe('SMTP', () => {
  it('verifica la conexión con el servidor de correo', async () => {
    const res = await api.get('/notificaciones/verificar-smtp', { token: usuarios.adminA.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });
});

describe('email de cambios pendientes', () => {
  it('le llega al otro admin con el cambio propuesto, y no al que lo propuso', async () => {
    const titulo = `${PREFIJO_TEST} aviso de cambio pendiente`;
    const alta = await api.post('/datasets', {
      titulo, area_id: cat.areaId, frecuencia_id: cat.frecuenciaId, tema_principal_id: cat.temaId,
      tipo_gestion: 'interna', formatos: [cat.formatoId]
    }, { token: usuarios.adminA.token });
    assert.equal(alta.status, 201);

    await mailpit.vaciar();
    const res = await api.get('/cron/cambios-pendientes', { headers: { 'x-cron-secret': process.env.CRON_SECRET } });
    assert.equal(res.status, 200);

    const mensajes = await mailpit.mensajes();
    const para = (email) => mensajes.filter(m => m.To.some(t => t.Address === email));

    const paraB = para(usuarios.adminB.email);
    assert.equal(paraB.length, 1, 'admin B debe recibir un email');
    assert.match(await mailpit.html(paraB[0].ID), /aviso de cambio pendiente/);

    // A puede recibir avisos por cambios de otros admins, pero nunca por el suyo
    for (const mensaje of para(usuarios.adminA.email)) {
      assert.doesNotMatch(await mailpit.html(mensaje.ID), /aviso de cambio pendiente/);
    }
    assert.equal(para(usuarios.lector.email).length, 0, 'el lector no recibe avisos');
  });
});
