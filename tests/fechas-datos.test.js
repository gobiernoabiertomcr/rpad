// Carga inicial de "Datos al" y tipo de pedido de los 80 datasets (spec 2026-10-17-fechas-datasets, sección 12.1).
// Lee el .sql y no toca la base: comprueba que haya exactamente un UPDATE por dataset, que cada "Datos al" sea fin de mes
// (con febrero en 28) y que cada tipo sea uno de los siete del catálogo.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { esFinDeMes, TIPOS_PEDIDO } from '../services/fechasDatasetReglas.js';

const SQL = fs.readFileSync(new URL('../database/updates/migracion-fechas-datasets-datos.sql', import.meta.url), 'utf8');
const LINEAS = SQL.split(/\r?\n/);

const TOTAL_DATASETS = 80;
const FORMA = /^UPDATE datasets SET datos_al = (NULL|'(\d{4}-\d{2}-\d{2})'), tipo_pedido = '([a-z_]+)' WHERE id = (\d+);$/;

// Una entrada por UPDATE, en el orden del archivo: { id, datosAl (null o 'AAAA-MM-DD'), tipo }
const UPDATES = LINEAS.filter(l => /^\s*UPDATE\b/i.test(l)).map(l => {
  const m = FORMA.exec(l);
  assert.ok(m, `UPDATE con una forma distinta de la acordada: ${l}`);
  return { id: Number(m[4]), datosAl: m[2] ?? null, tipo: m[3] };
});
const porId = new Map(UPDATES.map(u => [u.id, u]));

describe('migracion-fechas-datasets-datos.sql: forma del archivo', () => {
  it('no tiene DELIMITER ni USE, para poder pegarlo tal cual en phpMyAdmin', () => {
    assert.doesNotMatch(SQL, /^\s*DELIMITER\b/im);
    assert.doesNotMatch(SQL, /^\s*USE\b/im);
  });

  it('solo escribe UPDATE sobre datasets (nada de DROP, DELETE, INSERT ni ALTER)', () => {
    const sentencias = LINEAS.filter(l => l.trim() && !l.trim().startsWith('--'));
    for (const l of sentencias) {
      assert.ok(/^UPDATE datasets SET /.test(l) || /^SET NAMES utf8mb4;$/.test(l), `sentencia inesperada: ${l}`);
    }
  });

  it('la cabecera dice qué es, de dónde sale y que va después de la migración de estructura', () => {
    const cabecera = LINEAS.filter(l => l.startsWith('--')).join('\n');
    assert.match(cabecera, /migracion-fechas-datasets\.sql/);
    assert.match(cabecera, /planilla/i);
    assert.match(cabecera, /17\/10\/2026/);
    assert.match(cabecera, /ANTES de subir el código/i);
  });
});

describe('migracion-fechas-datasets-datos.sql: un UPDATE por dataset', () => {
  it('hay exactamente 80 UPDATE y uno por cada id del 1 al 80', () => {
    assert.equal(UPDATES.length, TOTAL_DATASETS);
    const ids = UPDATES.map(u => u.id).sort((a, b) => a - b);
    assert.deepEqual(ids, Array.from({ length: TOTAL_DATASETS }, (_, i) => i + 1));
    assert.equal(porId.size, TOTAL_DATASETS);
  });

  it('todo "Datos al" no nulo es fin de mes, con febrero en 28', () => {
    for (const { id, datosAl } of UPDATES) {
      if (datosAl !== null) assert.ok(esFinDeMes(datosAl), `id ${id}: ${datosAl} no es fin de mes`);
    }
    assert.equal(porId.get(22).datosAl, '2025-02-28'); // 02/2025 de la planilla: febrero en 28
  });

  it('todo tipo de pedido está en el catálogo', () => {
    for (const { id, tipo } of UPDATES) assert.ok(TIPOS_PEDIDO.includes(tipo), `id ${id}: tipo ${tipo} fuera del catálogo`);
  });

  it('en los de tipo ejercicio, "Datos al" es el 31/12', () => {
    const ejercicios = UPDATES.filter(u => u.tipo === 'ejercicio');
    assert.ok(ejercicios.length > 0);
    for (const { id, datosAl } of ejercicios) assert.match(datosAl ?? '', /^\d{4}-12-31$/, `id ${id}: ejercicio sin 31/12`);
  });

  it('solo el 44 queda sin "Datos al" (el usuario lo carga después desde el formulario)', () => {
    assert.deepEqual(UPDATES.filter(u => u.datosAl === null).map(u => u.id), [44]);
  });
});

describe('migracion-fechas-datasets-datos.sql: casos conocidos', () => {
  const casos = [
    // El usuario corrigió estos tres en la planilla
    [10, '2026-07-31', 'acumulado'],
    [38, '2025-05-31', 'relevamiento'],
    [57, '2025-12-31', 'ejercicio'],
    [74, '2025-12-31', 'anio_anterior'],
    [3, '2025-12-31', 'foto'],
    [66, '2026-06-30', 'eventual'],
    // Próxima edición: el Censo 2022 lleva su fecha de referencia y no el mes de carga de la planilla
    [50, '2022-05-31', 'edicion'],
    [63, '2022-05-31', 'edicion'],
    [77, '2022-05-31', 'edicion'],
    [78, '2022-05-31', 'edicion'],
    // La elección no tiene fecha dada: queda sin "Datos al"
    [44, null, 'edicion']
  ];
  for (const [id, datosAl, tipo] of casos) {
    it(`id ${id}: ${datosAl ?? 'NULL'} y ${tipo}`, () => {
      assert.deepEqual(porId.get(id), { id, datosAl, tipo });
    });
  }
});
