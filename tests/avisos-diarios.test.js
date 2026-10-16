// Avisos diarios que no son Notas Digitales (spec 2026-10-15-dias-habiles-licencias-auditoria, sección 4):
// aviso a las áreas y email de cambios pendientes, con fechas fijas sobre una base de prueba + Mailpit
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query, mailpit } from './helpers.js';
import { crearArea, crearDataset, asegurarBaseDePrueba } from './notas-fixtures.js';

let base, servicio, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_avisos_diarios');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  servicio = await import('../services/avisosDiariosService.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  await asegurarBaseDePrueba();
  await query('DELETE FROM cambios_pendientes');
  await query('DELETE FROM notificaciones_log');
  await query('DELETE FROM datasets');
  await query('DELETE FROM areas');
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios');
  await mailpit.vaciar();
});

const sufijo = () => crypto.randomBytes(3).toString('hex');
const para = (mensajes, email) => mensajes.filter(m => m.To.some(t => t.Address === email));

const crearUsuario = async (rol) => {
  const username = `t_${rol}_${sufijo()}`;
  const email = `${username}@rpad.test`;
  const resultado = await query(
    `INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES (?, 'x', ?, ?, ?, 1)`,
    [username, `Prueba ${rol}`, email, rol]
  );
  return { id: resultado.insertId, username, email };
};

const proponerCambio = (usuarioId, titulo) => query(
  "INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id) VALUES ('crear', NULL, ?, ?)",
  [JSON.stringify({ titulo }), usuarioId]
);

describe('aviso a las áreas (spec 4.2)', () => {
  const prepararArea = async () => {
    const email = `area_${sufijo()}@rpad.test`;
    const areaId = await crearArea({ email_principal: email });
    return { areaId, email };
  };

  it('un viernes avisa también lo que vence el sábado y el domingo + 40', async () => {
    const { areaId, email } = await prepararArea();
    // viernes 16/10/2026: avisa los vencimientos del 25 al 27/11/2026
    for (const vencimiento of ['2026-11-25', '2026-11-26', '2026-11-27']) {
      await crearDataset({ gestion: 'externa', vencimiento, areaId, titulo: `Vence ${vencimiento}` });
    }
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-28', areaId, titulo: 'Vence el lunes' });

    const resultado = await servicio.enviarAvisoAreas({ hoy: '2026-10-16' });

    assert.equal(resultado.dia_habil, true);
    assert.equal(resultado.enviados.length, 1);
    assert.equal(resultado.enviados[0].cantidad, 3);
    const mensajes = para(await mailpit.esperar(m => m.To.some(t => t.Address === email)), email);
    assert.equal(mensajes.length, 1);
    const [log] = await query("SELECT datasets_ids, success FROM notificaciones_log WHERE tipo = 'area-aviso-40'");
    assert.equal(log.datasets_ids.split(',').length, 3);
    assert.equal(Number(log.success), 1);
  });

  it('un sábado no envía nada', async () => {
    const { areaId, email } = await prepararArea();
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-26', areaId });

    const resultado = await servicio.enviarAvisoAreas({ hoy: '2026-10-17' });

    assert.deepEqual(resultado, { dia_habil: false, enviados: [], errores: [], sin_datasets: true });
    assert.equal(para(await mailpit.mensajes(), email).length, 0);
    assert.equal((await query('SELECT COUNT(*) AS n FROM notificaciones_log'))[0].n, 0);
  });

  it('un jueves común no avisa lo que vence el sábado + 40', async () => {
    const { areaId } = await prepararArea();
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-26', areaId });
    const resultado = await servicio.enviarAvisoAreas({ hoy: '2026-10-15' });
    assert.equal(resultado.enviados.length, 0);
    assert.equal(resultado.sin_datasets, true);
  });

  it('la gestión interna y las áreas sin email quedan afuera, como antes', async () => {
    const { areaId } = await prepararArea();
    const sinEmail = await crearArea();
    await crearDataset({ gestion: 'interna', vencimiento: '2026-11-25', areaId });
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-25', areaId: sinEmail });
    assert.deepEqual(await servicio.datasetsExternosPorArea('2026-10-16'), []);
  });
});

describe('email de cambios pendientes (spec 4.1)', () => {
  it('en un día hábil le llega al otro admin y no al que propuso', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    await proponerCambio(a.id, 'Cambio de prueba en día hábil');

    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-16' });

    assert.equal(resultado.dia_habil, true);
    assert.deepEqual(resultado.enviados.map(e => e.email), [b.email]);
    assert.equal(para(await mailpit.esperar(m => m.To.some(t => t.Address === b.email)), b.email).length, 1);
    assert.equal(para(await mailpit.mensajes(), a.email).length, 0);
  });

  it('no le llega a quien está de licencia ese día (spec 5.3)', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    const c = await crearUsuario('admin');
    await proponerCambio(a.id, 'Cambio con un revisor de licencia');
    await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [b.id, '2026-10-12', '2026-10-16']);

    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-16' });

    assert.deepEqual(resultado.enviados.map(e => e.email), [c.email]);
    assert.deepEqual(resultado.deLicencia, [b.username]);
    assert.equal(para(await mailpit.mensajes(), b.email).length, 0);
  });

  for (const [fecha, descripcion] of [['2026-10-17', 'sábado'], ['2026-10-18', 'domingo'], ['2026-12-08', 'feriado fijo']]) {
    it(`un ${descripcion} no envía nada`, async () => {
      const a = await crearUsuario('admin');
      const b = await crearUsuario('admin');
      await proponerCambio(a.id, 'Cambio de prueba en día no hábil');

      const resultado = await servicio.enviarCambiosPendientes({ hoy: fecha });

      assert.equal(resultado.dia_habil, false);
      assert.deepEqual(resultado.enviados, []);
      assert.deepEqual(resultado.errores, []);
      assert.equal(para(await mailpit.mensajes(), b.email).length, 0);
    });
  }

  it('un feriado trasladable es día hábil: el email sale', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    await proponerCambio(a.id, 'Cambio en feriado trasladable');
    // lunes 12/10/2026 (Día del Respeto a la Diversidad Cultural, trasladable)
    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-12' });
    assert.deepEqual(resultado.enviados.map(e => e.email), [b.email]);
  });
});
