// Lecturas de licencias (services/licenciasService.js) sobre una base de prueba
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, cerrarDb, query } from './helpers.js';
import { asegurarBaseDePrueba } from './notas-fixtures.js';

let base, servicio, dbReal, usuarioId;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_licencias_datos');
  process.env.DB_NAME = base.nombre;
  servicio = await import('../services/licenciasService.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  await asegurarBaseDePrueba();
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios');
  const r = await query("INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES ('t_lic', 'x', 'Prueba', 't_lic@rpad.test', 'admin', 1)");
  usuarioId = r.insertId;
});

const cargar = (desde, hasta, anulada = 0) => query(
  'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, anulada, autorizado_at) VALUES (?, ?, ?, ?, ?)',
  [usuarioId, desde, hasta, anulada, '2026-11-20 10:30:00']
);

describe('licenciaEnFecha', () => {
  it('encuentra la licencia que incluye la fecha, con sus extremos, y devuelve las fechas como texto', async () => {
    await cargar('2026-11-26', '2027-01-14');
    for (const fecha of ['2026-11-26', '2026-12-31', '2027-01-14']) {
      const l = await servicio.licenciaEnFecha(usuarioId, fecha);
      assert.equal(l?.desde, '2026-11-26', fecha);
      assert.equal(l.hasta, '2027-01-14');
      assert.equal(l.autorizado_at, '2026-11-20 10:30:00');
    }
    assert.equal(await servicio.licenciaEnFecha(usuarioId, '2026-11-25'), null);
    assert.equal(await servicio.licenciaEnFecha(usuarioId, '2027-01-15'), null);
  });

  it('ignora las anuladas', async () => {
    await cargar('2026-11-26', '2027-01-14', 1);
    assert.equal(await servicio.licenciaEnFecha(usuarioId, '2026-12-01'), null);
  });
});

describe('proximaLicencia', () => {
  it('la primera no anulada que empieza después de la fecha', async () => {
    await cargar('2027-03-01', '2027-03-05');
    await cargar('2026-12-01', '2026-12-10', 1);
    await cargar('2027-01-25', '2027-02-05');
    assert.equal((await servicio.proximaLicencia(usuarioId, '2026-11-10')).desde, '2027-01-25');
    assert.equal((await servicio.proximaLicencia(usuarioId, '2027-01-25')).desde, '2027-03-01');
    assert.equal(await servicio.proximaLicencia(usuarioId, '2027-03-01'), null);
  });
});
