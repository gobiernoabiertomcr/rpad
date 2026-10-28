// Los feriados de la tabla en las Notas Digitales y los recordatorios (spec 2026-10-27-feriados-en-notas), sobre una base de
// prueba con la precarga de database/updates/migracion-feriados-datos.sql tal cual, más Mailpit. Ningún test escribe en
// `feriados`: la precarga es la de producción, y conLaTablaRenombrada la devuelve igual.
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, correrSqlEnBaseDePrueba, cerrarDb, query, mailpit } from './helpers.js';
import { limpiarBase, configurarNotas, asegurarBaseDePrueba } from './notas-fixtures.js';
import { pngRgba } from './firma-fixtures.js';
import { FILAS_PRECARGA } from './fixtures/feriados-precarga.js';

const FIRMA = pngRgba({ ancho: 40, alto: 20 });
let base, dbReal, feriadosDatos;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_feriados_en_notas');
  await correrSqlEnBaseDePrueba(base.nombre, 'database/updates/migracion-feriados-datos.sql');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba
  feriadosDatos = await import('../services/feriadosDatos.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

// usuarios_auditoria va antes que usuarios: su clave foránea a usuarios no tiene ON DELETE
beforeEach(async () => {
  process.env.EMAIL_SOLO_A = '';
  await limpiarBase();
  await configurarNotas();
  await query('DELETE FROM usuarios_auditoria');
  await query('DELETE FROM cambios_pendientes');
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios_firmas');
  await query('DELETE FROM usuarios');
  await mailpit.vaciar();
});

// Un usuario de prueba con su firma (como en tests/notas-licencias.test.js)
const crearUsuario = async (rol, { conFirma = true } = {}) => {
  const username = `t_${rol}_${crypto.randomBytes(3).toString('hex')}`;
  const email = `${username}@rpad.test`;
  const r = await query(
    "INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES (?, 'x', ?, ?, ?, 1)",
    [username, `Persona ${rol}`, email, rol]
  );
  if (conFirma) {
    await query("INSERT INTO usuarios_firmas (usuario_id, nombre, cargo, imagen, mime) VALUES (?, ?, ?, ?, 'image/png')",
      [r.insertId, `Firma ${rol}`, `Cargo ${rol}`, FIRMA]);
  }
  return { id: r.insertId, email };
};

// Una licencia de Configuración, con o sin persona autorizada (como en tests/notas-licencias.test.js)
const licencia = async (usuario, desde, hasta, autorizadoDe = null) => (await query(
  'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, autorizado_id, autorizado_at) VALUES (?, ?, ?, ?, ?)',
  [usuario.id, desde, hasta, autorizadoDe?.id ?? null, autorizadoDe ? '2026-11-20 10:00:00' : null]
)).insertId;

// Un cambio pendiente propuesto hace `haceMinutos` minutos (como en tests/avisos-diarios.test.js) o, con `creado`
// ('AAAA-MM-DD HH:MM:SS'), en ese momento
const proponerCambio = async (usuarioId, titulo, { haceMinutos = 120, creado } = {}) => {
  const datos = JSON.stringify({ titulo });
  const resultado = creado === undefined
    ? await query(
      `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id, created_at)
       VALUES ('crear', NULL, ?, ?, NOW() - INTERVAL ? MINUTE)`,
      [datos, usuarioId, haceMinutos]
    )
    : await query(
      `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id, created_at)
       VALUES ('crear', NULL, ?, ?, ?)`,
      [datos, usuarioId, creado]
    );
  return resultado.insertId;
};

// Mientras corre fn, la tabla `feriados` no se puede leer (se renombra); al terminar vuelve, también si fn tira
const conLaTablaRenombrada = async (fn) => {
  await asegurarBaseDePrueba();
  await query('RENAME TABLE feriados TO feriados_sin_leer');
  try {
    return await fn();
  } finally {
    await query('RENAME TABLE feriados_sin_leer TO feriados');
  }
};

describe('la precarga de las fixtures es la de migracion-feriados-datos.sql', () => {
  it('las 28 filas, en orden, con id de 1 a 28, activas, sin baja desde un año y sin años que no rigen', async () => {
    assert.deepEqual(await feriadosDatos.filasDeFeriados(), FILAS_PRECARGA);
  });
});

describe('leerCalendario con la precarga', () => {
  it('lee la tabla: el 02/11/2026 no es hábil y el 03/11 sí', async () => {
    const calendario = await feriadosDatos.leerCalendario();
    assert.equal(calendario.origen, 'tabla');
    assert.equal(calendario.error, null);
    assert.equal(calendario.esDiaHabil('2026-11-02'), false);
    assert.equal(calendario.esDiaHabil('2026-11-03'), true);
    assert.ok(Object.isFrozen(calendario));
  });

  it('con la tabla renombrada cae a los 9 fijos, con el error, sin tirar', async () => {
    const consola = mock.method(console, 'error', () => {});
    try {
      const calendario = await conLaTablaRenombrada(() => feriadosDatos.leerCalendario());
      assert.equal(calendario.origen, 'fijos');
      assert.match(calendario.error, /feriados/);
      assert.equal(calendario.esDiaHabil('2026-11-02'), true);
      assert.ok(Object.isFrozen(calendario));
      // El error queda en la consola
      assert.equal(consola.mock.callCount(), 1);
      assert.match(consola.mock.calls[0].arguments.map(String).join(' '), /feriados/);
    } finally {
      consola.mock.restore();
    }
    // La tabla volvió: se lee otra vez
    assert.equal((await feriadosDatos.leerCalendario()).origen, 'tabla');
  });
});
