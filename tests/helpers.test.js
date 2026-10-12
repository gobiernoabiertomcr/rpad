// crearBaseDePrueba nunca debe tocar la base real: los nombres inválidos se rechazan antes de conectar.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, query, cerrarDb } from './helpers.js';

after(async () => {
  await cerrarDb();
});

describe('crearBaseDePrueba', () => {
  const casos = [
    ['DB_NAME (la base real)', process.env.DB_NAME],
    ['datospublicos_mcr_rpad (no es de prueba)', 'datospublicos_mcr_rpad'],
    ['un nombre con inyección SQL', 'rpad_test_x; DROP DATABASE y']
  ];
  for (const [etiqueta, nombre] of casos) {
    it(`rechaza ${etiqueta} sin tocar la base real`, async () => {
      await assert.rejects(() => crearBaseDePrueba(nombre), /Nombre de base de prueba inválido/);
    });
  }

  it('rechaza el nombre de la base real aunque empiece con rpad_test_', async () => {
    const original = process.env.DB_NAME;
    process.env.DB_NAME = 'rpad_test_protegida';
    try {
      await assert.rejects(() => crearBaseDePrueba('rpad_test_protegida'), /es la base real/);
    } finally {
      if (original === undefined) delete process.env.DB_NAME;
      else process.env.DB_NAME = original;
    }
  });

  it('la base real sigue existiendo después de los intentos', async () => {
    const [{ total }] = await query('SELECT COUNT(*) AS total FROM datasets');
    assert.ok(total >= 0);
  });
});
