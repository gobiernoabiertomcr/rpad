// database/schema.sql debe crear la misma estructura que la base real, sin datos personales
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import mysql from 'mysql2/promise';
import { query, cerrarDb } from './helpers.js';

const BASE_TEMPORAL = 'rpad_schema_test';
let root;

const columnas = async (conexion, base) => {
  const [filas] = await conexion.query(
    `SELECT TABLE_NAME AS tabla, COLUMN_NAME AS columna, COLUMN_TYPE AS tipo,
            IS_NULLABLE AS nulo, COLUMN_DEFAULT AS defecto, COLUMN_KEY AS clave
     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [base]
  );
  return filas.map(f => `${f.tabla}.${f.columna} ${f.tipo} null=${f.nulo} default=${f.defecto} key=${f.clave}`);
};

const contar = async (tabla) => {
  const [[{ total }]] = await root.query(`SELECT COUNT(*) AS total FROM \`${BASE_TEMPORAL}\`.\`${tabla}\``);
  return total;
};

before(async () => {
  if (process.env.RPAD_TESTS_DB_LOCAL !== '1' || !process.env.DB_ROOT_PASSWORD) {
    throw new Error('Este test necesita RPAD_TESTS_DB_LOCAL=1 y DB_ROOT_PASSWORD (base Docker local)');
  }
  root = await mysql.createConnection({
    host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT), user: 'root',
    password: process.env.DB_ROOT_PASSWORD, multipleStatements: true
  });
  await root.query(`DROP DATABASE IF EXISTS \`${BASE_TEMPORAL}\``);
  await root.query(`CREATE DATABASE \`${BASE_TEMPORAL}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await root.query(`USE \`${BASE_TEMPORAL}\``);
  await root.query(fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
});

after(async () => {
  await root?.query(`DROP DATABASE IF EXISTS \`${BASE_TEMPORAL}\``);
  await root?.end();
  await cerrarDb();
});

describe('database/schema.sql', () => {
  it('crea las mismas tablas y columnas que la base actual', async () => {
    // Única diferencia buscada: un usuario nuevo es lector por defecto
    const normalizar = (lista) => lista.map(c => c.startsWith('usuarios.rol ') ? c.replace(/default=\S+/, 'default=*') : c);
    const esperado = normalizar(await columnas(root, process.env.DB_NAME));
    const obtenido = normalizar(await columnas(root, BASE_TEMPORAL));
    assert.deepEqual(obtenido, esperado);
  });

  it('crea un usuario nuevo con rol lector por defecto', async () => {
    const [[rol]] = await root.query(
      `SELECT COLUMN_DEFAULT AS defecto FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'rol'`,
      [BASE_TEMPORAL]
    );
    assert.equal(rol.defecto, "'lector'");
  });

  for (const tabla of ['usuarios', 'areas', 'datasets', 'cambios_pendientes', 'notificaciones_log', 'historial_actualizaciones', 'proyectos', 'metricas_manuales']) {
    it(`no trae datos en ${tabla}`, async () => {
      assert.equal(await contar(tabla), 0);
    });
  }

  for (const tabla of ['temas', 'frecuencias', 'formatos']) {
    it(`trae el catálogo completo de ${tabla}`, async () => {
      const [{ total }] = await query(`SELECT COUNT(*) AS total FROM \`${tabla}\``);
      assert.ok(total > 0);
      assert.equal(await contar(tabla), total);
    });
  }
});
