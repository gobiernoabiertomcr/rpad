// Permisos por rol: qué puede hacer un visitante, un lector y un admin
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';

let servidor, api, usuarios;

before(async () => {
  servidor = await iniciarServidor();
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api);
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
});

// Rutas que solo un admin puede usar. Los IDs no importan: el rol se valida antes.
const RUTAS_SOLO_ADMIN = [
  ['POST', '/datasets'],
  ['PUT', '/datasets/1'],
  ['DELETE', '/datasets/1'],
  ['POST', '/datasets/1/actualizar'],
  ['POST', '/areas'],
  ['PUT', '/areas/1'],
  ['DELETE', '/areas/1'],
  ['GET', '/cambios-pendientes/contador'],
  ['GET', '/cambios-pendientes/para-revisar'],
  ['GET', '/cambios-pendientes/mis-cambios'],
  ['GET', '/cambios-pendientes/datasets-bloqueados'],
  ['GET', '/cambios-pendientes/1'],
  ['GET', '/cambios-pendientes/verificar/1'],
  ['POST', '/cambios-pendientes/1/aprobar'],
  ['POST', '/cambios-pendientes/1/rechazar'],
  ['GET', '/notificaciones/ejecutar'],
  ['GET', '/notificaciones/verificar-smtp'],
  ['POST', '/notificaciones/prueba-area'],
  ['GET', '/notificaciones/preview/area-aviso-40'],
  ['GET', '/notificaciones/notas-digitales'],
  ['GET', '/notificaciones/notas-digitales/estado'],
  ['GET', '/notificaciones/notas-digitales/preview?tipo=aviso&gestion=interna'],
  ['GET', '/notificaciones/notas-digitales/preview?tipo=auditoria'],
  ['POST', '/notificaciones/notas-digitales/prueba'],
  ['GET', '/notificaciones/notas-digitales/config'],
  ['PUT', '/notificaciones/notas-digitales/config'],
  ['PUT', '/notificaciones/notas-digitales/config/firma'],
  ['GET', '/notificaciones/notas-digitales/config/firma'],
  ['PUT', '/notificaciones/notas-digitales/config/membrete'],
  ['GET', '/notificaciones/notas-digitales/config/membrete'],
  ['GET', '/notificaciones/notas-digitales/preview/pdf?tipo=aviso&gestion=interna'],
  ['GET', '/notificaciones/notas-digitales/preview/anexo?gestion=interna'],
  ['GET', '/notificaciones/notas-digitales/1/pdf'],
  ['GET', '/notificaciones/notas-digitales/1/anexo'],
  ['POST', '/notificaciones/notas-digitales/1/reintentar'],
  ['GET', '/notificaciones/cambios-pendientes'],
  ['GET', '/notificaciones/preview-cambios-pendientes'],
  ['GET', '/usuarios'],
  ['POST', '/usuarios'],
  ['GET', '/usuarios/1'],
  ['PUT', '/usuarios/1'],
  ['POST', '/usuarios/1/desactivar'],
  ['POST', '/usuarios/1/reactivar'],
  ['POST', '/usuarios/1/enviar-acceso'],
  ['GET', '/usuarios/licencias'],
  ['GET', '/usuarios/licencias/sin-auditor'],
  ['POST', '/usuarios/licencias'],
  ['PUT', '/usuarios/licencias/1'],
  ['POST', '/usuarios/licencias/1/anular'],
  ['GET', '/auth/profile/firma'],
  ['PUT', '/auth/profile/firma'],
  ['GET', '/auth/profile/firma/imagen'],
  ['GET', '/notificaciones/notas-digitales/config/firmantes'],
  ['PUT', '/notificaciones/notas-digitales/config/firmante']
];

const pedir = (metodo, ruta, token) => {
  const opciones = { token };
  if (metodo === 'GET') return api.get(ruta, opciones);
  if (metodo === 'DELETE') return api.delete(ruta, opciones);
  return metodo === 'POST' ? api.post(ruta, {}, opciones) : api.put(ruta, {}, opciones);
};

describe('lector', () => {
  for (const [metodo, ruta] of RUTAS_SOLO_ADMIN) {
    it(`recibe 403 en ${metodo} ${ruta}`, async () => {
      const res = await pedir(metodo, ruta, usuarios.lector.token);
      assert.equal(res.status, 403);
    });
  }

  for (const ruta of ['/auth/profile', '/datasets', '/reportes/estado-general', '/gestion/metricas', '/gestion/proyectos', '/seguimiento']) {
    it(`puede usar GET ${ruta}`, async () => {
      const res = await api.get(ruta, { token: usuarios.lector.token });
      assert.equal(res.status, 200);
    });
  }

  // El Seguimiento de un dataset lo ve cualquier rol con sesión (spec 2026-10-20-seguimiento-dataset)
  it('puede usar GET /seguimiento/:id', async () => {
    const [{ id }] = await query('SELECT id FROM datasets LIMIT 1');
    const res = await api.get(`/seguimiento/${id}`, { token: usuarios.lector.token });
    assert.equal(res.status, 200);
  });
});

describe('visitante sin sesión', () => {
  for (const [metodo, ruta] of RUTAS_SOLO_ADMIN) {
    it(`recibe 401 en ${metodo} ${ruta}`, async () => {
      const res = await pedir(metodo, ruta, undefined);
      assert.equal(res.status, 401);
    });
  }

  it('recibe 401 en las rutas del Seguimiento', async () => {
    const [{ id }] = await query('SELECT id FROM datasets LIMIT 1');
    for (const ruta of ['/seguimiento', `/seguimiento/${id}`, `/seguimiento/${id}/pdf`]) {
      assert.equal((await api.get(ruta)).status, 401, ruta);
    }
  });

  it('no puede usar un token firmado con la clave por defecto que tenía el código', async () => {
    const falso = jwt.sign({ userId: usuarios.adminA.id, rol: 'admin' }, 'rpad-secret-key-cambiar-en-produccion');
    const res = await api.get('/auth/verify', { token: falso });
    assert.equal(res.status, 401);
  });
});

// GET de administración que se pueden llamar sin efectos sobre la base local
const RUTAS_GET_ADMIN = [
  '/cambios-pendientes/contador',
  '/cambios-pendientes/para-revisar',
  '/cambios-pendientes/mis-cambios',
  '/cambios-pendientes/datasets-bloqueados',
  '/notificaciones/verificar-smtp',
  '/notificaciones/preview/area-aviso-40',
  '/notificaciones/notas-digitales',
  '/notificaciones/notas-digitales/estado',
  '/notificaciones/preview-cambios-pendientes',
  '/usuarios',
  '/usuarios/licencias',
  '/usuarios/licencias/sin-auditor',
  '/auth/profile/firma',
  '/notificaciones/notas-digitales/config/firmantes'
];

for (const clave of ['adminA', 'superadmin']) {
  describe(clave === 'adminA' ? 'admin' : 'superadmin', () => {
    for (const ruta of RUTAS_GET_ADMIN) {
      it(`puede usar GET ${ruta}`, async () => {
        const res = await api.get(ruta, { token: usuarios[clave].token });
        assert.equal(res.status, 200);
      });
    }
  });
}

describe('cron', () => {
  it('rechaza sin clave', async () => {
    assert.equal((await api.get('/cron/cambios-pendientes')).status, 403);
  });

  it('rechaza clave incorrecta', async () => {
    const res = await api.get('/cron/cambios-pendientes', { headers: { 'x-cron-secret': 'incorrecta' } });
    assert.equal(res.status, 403);
  });

  it('rechaza clave vacía por query', async () => {
    assert.equal((await api.get('/cron/cambios-pendientes?secret=')).status, 403);
  });

  it('acepta la clave correcta por header', async () => {
    const res = await api.get('/cron/cambios-pendientes', { headers: { 'x-cron-secret': process.env.CRON_SECRET } });
    assert.equal(res.status, 200);
  });

  it('acepta la clave correcta por query (como la llama el cron de cPanel)', async () => {
    const res = await api.get(`/cron/cambios-pendientes?secret=${encodeURIComponent(process.env.CRON_SECRET)}`);
    assert.equal(res.status, 200);
  });
});
