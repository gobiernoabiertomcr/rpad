// crearBaseDePrueba nunca debe tocar la base real: los nombres inválidos se rechazan antes de conectar.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, query, cerrarDb } from './helpers.js';
import { limpiarBase, configurarNotas } from './notas-fixtures.js';

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

// Los fixtures de Notas Digitales borran y reescriben datos. Esta prueba corre sobre la base local real:
// la guarda tiene que rechazar antes de cualquier DELETE o UPDATE. Solo lee antes y después.
// Sin la guarda, limpiarBase borraría la copia local de producción; por eso no hubo paso RED.
describe('guarda de los fixtures de Notas Digitales', () => {
  const resumen = async () => {
    const [conteos] = await query(`SELECT
      (SELECT COUNT(*) FROM datasets) AS datasets,
      (SELECT COUNT(*) FROM areas) AS areas,
      (SELECT COUNT(*) FROM notas_digitales) AS notas,
      (SELECT COUNT(*) FROM notificaciones_log) AS emails`);
    const config = await query(`SELECT envio_activo, para_interna, casillas_prueba,
      reiteracion_evaluada_interna, reiteracion_evaluada_externa FROM notas_digitales_config WHERE id = 1`);
    return { conteos, config };
  };

  it('limpiarBase y configurarNotas rechazan una base que no es rpad_test_* y no tocan datos', async () => {
    const [{ base }] = await query('SELECT DATABASE() AS base');
    assert.doesNotMatch(base, /^rpad_test_/, 'esta prueba corre sobre la base real, no sobre una de prueba');
    const antes = await resumen();
    await assert.rejects(() => limpiarBase(), /rpad_test_/);
    await assert.rejects(() => configurarNotas(), /rpad_test_/);
    assert.deepEqual(await resumen(), antes);
  });
});
