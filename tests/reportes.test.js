// Reportes PDF y notas DOCX
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
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

const esPdf = (res) => {
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/pdf/);
  assert.equal(res.body.subarray(0, 5).toString(), '%PDF-');
};

describe('reportes PDF', () => {
  it('estado general', async () => {
    esPdf(await api.get('/reportes/estado-general', { token: usuarios.lector.token }));
  });

  it('historial de notificaciones', async () => {
    esPdf(await api.get('/reportes/historial-notificaciones?desde=2025-01-01&hasta=2026-12-31', { token: usuarios.adminA.token }));
  });

  it('por área', async () => {
    const [area] = await query('SELECT area_id AS id FROM datasets WHERE activo = 1 LIMIT 1');
    esPdf(await api.get(`/reportes/por-area/${area.id}`, { token: usuarios.adminA.token }));
  });

  it('cumplimiento', async () => {
    esPdf(await api.get('/reportes/cumplimiento?periodo=mensual', { token: usuarios.adminA.token }));
  });
});

describe('notas DOCX', () => {
  for (const tipo of ['interna', 'externa', 'escalonada']) {
    it(`genera la nota ${tipo}`, async () => {
      const [dataset] = await query('SELECT id, area_id FROM datasets WHERE activo = 1 LIMIT 1');
      const res = await api.post('/notas/generar', {
        fecha: '2026-10-12', numero: '123/2026', area_id: dataset.area_id, tipo,
        datasets: [{ id: dataset.id, periodo_inicial: '2025', periodo_final: '2026' }]
      }, { token: usuarios.adminA.token });
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /wordprocessingml/);
      assert.equal(res.body.subarray(0, 2).toString(), 'PK');
    });
  }
});
