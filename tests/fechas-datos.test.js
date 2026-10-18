// Cargas de datos de las fechas de los datasets (spec 2026-10-17-fechas-datasets, sección 12).
// 1. migracion-fechas-datasets-datos.sql (12.1): "Datos al" y tipo de pedido de los 80 datasets. Lee el .sql y no toca la
//    base: comprueba que haya exactamente un UPDATE por dataset, que cada "Datos al" sea fin de mes (con febrero en 28) y
//    que cada tipo sea uno de los siete del catálogo.
// 2. migracion-fechas-datasets-textos.sql (12.2): los 26 "Qué se solicita" sin la frase del período. También lee el .sql
//    y no toca la base.
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

// ---------------------------------------------------------------------------------------------------------------------
// migracion-fechas-datasets-textos.sql (sección 12.2): los "Qué se solicita" relativos pierden la frase del período,
// que desde la entrega 2 agrega la nota ("Datos solicitados").
// ---------------------------------------------------------------------------------------------------------------------

// Los 26 que el usuario aprobó sin cambios el 17/10/2026: ids 1-11, 13, 23, 35, 36, 46, 48, 52, 57, 61 y 69-74
const IDS_DE_TEXTOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 23, 35, 36, 46, 48, 52, 57, 61, 69, 70, 71, 72, 73, 74];
// Quedan como están: la Escala salarial (relevamiento interno), las guías (14-16) y los dos eventuales (54 y 66)
const IDS_QUE_NO_SE_TOCAN = [38, 14, 15, 16, 54, 66];
// Las seis frases de período de la sección 8.4, sin distinguir mayúsculas
const FRASES_DE_PERIODO = [
  'siguiente al último', 'nuevo período', 'nuevo ejercicio', 'fecha de corte', 'posterior al último', 'desde la última actualización'
];
const CIERRE_DEL_PEDIDO = /Remitir en planillas? editables? \(Excel o CSV\) con las mismas columnas de(l| los) archivos? publicados?\.$/;

// UPDATE datasets SET que_se_solicita = '…' WHERE id = N; el literal admite solo '' (comilla) y \\ (barra) como escapes
const FORMA_TEXTO = /^UPDATE datasets SET que_se_solicita = '((?:[^'\\]|''|\\\\)*)' WHERE id = (\d+);$/;
const desescapar = literal => literal.replace(/''/g, "'").replace(/\\\\/g, '\\');

describe('migracion-fechas-datasets-textos.sql', () => {
  const SQL_TEXTOS = fs.readFileSync(new URL('../database/updates/migracion-fechas-datasets-textos.sql', import.meta.url), 'utf8');
  const LINEAS_TEXTOS = SQL_TEXTOS.split(/\r?\n/);
  const FILAS = LINEAS_TEXTOS.map((linea, i) => ({ linea, i })).filter(({ linea }) => /^\s*UPDATE\b/i.test(linea));
  // Una entrada por UPDATE, en el orden del archivo: { id, texto, comentario (la línea de arriba) }
  const TEXTOS = FILAS.map(({ linea, i }) => {
    const m = FORMA_TEXTO.exec(linea);
    assert.ok(m, `UPDATE con una forma distinta de la acordada: ${linea.slice(0, 120)}`);
    return { id: Number(m[2]), texto: desescapar(m[1]), comentario: LINEAS_TEXTOS[i - 1] };
  });
  const textoDe = id => TEXTOS.find(t => t.id === id)?.texto;

  describe('forma del archivo', () => {
    it('no tiene DELIMITER ni USE, para poder pegarlo tal cual en phpMyAdmin', () => {
      assert.doesNotMatch(SQL_TEXTOS, /^\s*DELIMITER\b/im);
      assert.doesNotMatch(SQL_TEXTOS, /^\s*USE\b/im);
    });

    it('empieza con SET NAMES utf8mb4 y solo escribe UPDATE de que_se_solicita sobre datasets', () => {
      const sentencias = LINEAS_TEXTOS.filter(l => l.trim() && !l.trim().startsWith('--'));
      assert.equal(sentencias[0], 'SET NAMES utf8mb4;');
      for (const l of sentencias.slice(1)) assert.match(l, /^UPDATE datasets SET que_se_solicita = '/, `sentencia inesperada: ${l.slice(0, 80)}`);
    });

    it('la cabecera dice que va con la entrega 2 y no antes, de dónde sale y que se corre una sola vez', () => {
      const cabecera = LINEAS_TEXTOS.filter(l => l.startsWith('--')).join('\n');
      assert.match(cabecera, /entrega 2/i);
      assert.match(cabecera, /no antes/i);
      assert.match(cabecera, /Datos solicitados/);
      assert.match(cabecera, /planilla/i);
      assert.match(cabecera, /17\/10\/2026/);
      assert.match(cabecera, /UNA SOLA VEZ/);
    });

    it('cada UPDATE lleva arriba el comentario con su id y el título del dataset', () => {
      for (const { id, comentario } of TEXTOS) {
        assert.match(comentario ?? '', new RegExp(`^-- ${id}\\. \\S`), `id ${id}: sin comentario con el título`);
      }
    });
  });

  describe('un UPDATE por dataset', () => {
    it('hay exactamente 26 UPDATE, con los ids aprobados y sin repetir', () => {
      assert.equal(TEXTOS.length, 26);
      assert.deepEqual(TEXTOS.map(t => t.id).sort((a, b) => a - b), IDS_DE_TEXTOS);
      assert.equal(new Set(TEXTOS.map(t => t.id)).size, 26);
    });

    it('no toca la Escala salarial (38), las guías (14, 15 y 16) ni los eventuales 54 y 66', () => {
      for (const id of IDS_QUE_NO_SE_TOCAN) assert.equal(textoDe(id), undefined, `el id ${id} no se tiene que tocar`);
      assert.doesNotMatch(SQL_TEXTOS, /WHERE id = (38|14|15|16|54|66);/);
    });

    it('ningún texto contiene una de las seis frases de período (sin distinguir mayúsculas)', () => {
      for (const { id, texto } of TEXTOS) {
        for (const frase of FRASES_DE_PERIODO) {
          assert.ok(!texto.toLowerCase().includes(frase), `id ${id}: dice "${frase}"`);
        }
      }
    });

    it('cada texto es una sola línea, sin espacios de más y termina con el pedido de la planilla editable', () => {
      for (const { id, texto } of TEXTOS) {
        assert.ok(texto.length > 0, `id ${id}: vacío`);
        assert.equal(texto, texto.trim(), `id ${id}: espacios al borde`);
        assert.doesNotMatch(texto, /[\r\n\t]|  /, `id ${id}: saltos o espacios dobles`);
        assert.match(texto, CIERRE_DEL_PEDIDO, `id ${id}: no termina con el pedido de la planilla editable`);
      }
    });
  });

  describe('textos conocidos (idénticos a la columna D de la planilla que aprobó el usuario)', () => {
    const conocidos = [
      [10, 'Contratos de pauta publicitaria oficial difundidos en el Boletín Oficial, una fila por contrato, con fecha de emisión, razón social, características de la publicación, período o motivo facturado, monto y número de Boletín. Remitir en planilla editable (Excel o CSV) con las mismas columnas del archivo publicado.'],
      [61, 'Listado de habilitaciones comerciales otorgadas, una fila por comercio y rubro, con número de expediente, CUIT y titular, nombre de fantasía, domicilio (calle, altura y barrio), rubro habilitado y número de disposición. Remitir en planilla editable (Excel o CSV) con las mismas columnas del archivo publicado.'],
      [46, 'Consumo mensual de agua potable en la ciudad, en metros cúbicos, una fila por año y mes. Remitir en planilla editable (Excel o CSV) con las mismas columnas del archivo publicado.'],
      [8, 'Ejecución presupuestaria: ingresos por recurso (corrientes, extraordinarios y de otras jurisdicciones), con cálculo de recursos, total recaudado y porcentaje de ejecución; y egresos por jurisdicción y tipo de gasto, con presupuesto, monto comprometido y porcentaje de ejecución. Remitir en planillas editables (Excel o CSV) con las mismas columnas de los archivos publicados.']
    ];
    for (const [id, esperado] of conocidos) {
      it(`id ${id}`, () => {
        assert.equal(textoDe(id), esperado);
      });
    }
  });
});
