// Notas DGMIT (spec 2026-10-24-notas-dgmit, secciones 2, 3 y 8): la validación pura de la carga, la corrección y la
// anulación. Sin base ni Date local: hoy llega por parámetro como texto 'AAAA-MM-DD'.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LARGO_NUMERO, LARGO_MOTIVO, FECHA_MINIMA, TIPOS_NOTA_DGMIT, MENSAJES_NOTA_DGMIT, TEXTO_TIPO_NOTA_DGMIT,
  validarNotaDgmit, validarMotivo, textoNumeroRepetido, textoNoSePuedeElegir, sePuedeElegir, idsDeDatasets
} from '../services/notasDgmitReglas.js';

const HOY = '2026-10-24';
const VALIDA = Object.freeze({ numero: '156/26', recibida: '2026-10-22', tipo: 'solicitud', datasets: Object.freeze([12]) });
const CAMPOS = ['numero', 'recibida', 'tipo', 'datasets'];

// Solo los errores de la entrada válida con un campo cambiado
const erroresCon = (cambio, hoy = HOY) => validarNotaDgmit({ ...VALIDA, ...cambio }, hoy).errores;

describe('constantes y textos', () => {
  it('los límites, la fecha mínima y los tipos', () => {
    assert.equal(LARGO_NUMERO, 40);
    assert.equal(LARGO_MOTIVO, 500);
    assert.equal(FECHA_MINIMA, '2025-01-01');
    assert.deepEqual([...TIPOS_NOTA_DGMIT], ['solicitud', 'reiteracion']);
    assert.deepEqual({ ...TEXTO_TIPO_NOTA_DGMIT }, { solicitud: 'Solicitud', reiteracion: 'Reiteración' });
  });

  it('los mensajes de validación son los de la spec, al pie de la letra', () => {
    assert.deepEqual({ ...MENSAJES_NOTA_DGMIT }, {
      numero: 'Escribí el número de la nota.',
      numeroLargo: 'El número de la nota puede tener hasta 40 caracteres.',
      recibida: 'Elegí la fecha en que el área recibió la nota.',
      recibidaFutura: 'La fecha de recepción no puede ser posterior a hoy.',
      recibidaVieja: 'La fecha de recepción no puede ser anterior al 01/01/2025.',
      tipo: 'Elegí si es una solicitud o una reiteración.',
      datasets: 'Elegí al menos un dataset.',
      motivo: 'Escribí el motivo.',
      motivoLargo: 'El motivo puede tener hasta 500 caracteres.'
    });
  });

  it('las constantes están congeladas', () => {
    assert.ok(Object.isFrozen(TIPOS_NOTA_DGMIT));
    assert.ok(Object.isFrozen(MENSAJES_NOTA_DGMIT));
    assert.ok(Object.isFrozen(TEXTO_TIPO_NOTA_DGMIT));
  });

  it('los textos del número repetido (409) y del dataset que no se puede elegir (400)', () => {
    assert.equal(textoNumeroRepetido('156/26'),
      'Ya hay una nota DGMIT N° 156/26 cargada. Para sumarle datasets o cambiar algo, corregila.');
    assert.equal(textoNoSePuedeElegir('Áreas específicas de género'),
      '«Áreas específicas de género» no se puede elegir: solo los datasets activos de gestión externa que requieren nota DGMIT.');
  });
});

describe('validarNotaDgmit', () => {
  it('una nota completa y válida: datos recortados, datasets sin repetir', () => {
    const resultado = validarNotaDgmit(
      { numero: '  N° 156 / 26  ', recibida: '2026-10-22', tipo: 'reiteracion', datasets: [12, '7', 12, '12', 3] }, HOY);
    assert.deepEqual(resultado, {
      datos: { numero: 'N° 156 / 26', recibida: '2026-10-22', tipo: 'reiteracion', datasets: [12, 7, 3] },
      errores: {}
    });
    assert.deepEqual(validarNotaDgmit(VALIDA, HOY), {
      datos: { numero: '156/26', recibida: '2026-10-22', tipo: 'solicitud', datasets: [12] },
      errores: {}
    });
  });

  it('cada campo vacío da su mensaje', () => {
    const esperado = {
      numero: MENSAJES_NOTA_DGMIT.numero,
      recibida: MENSAJES_NOTA_DGMIT.recibida,
      tipo: MENSAJES_NOTA_DGMIT.tipo,
      datasets: MENSAJES_NOTA_DGMIT.datasets
    };
    for (const entrada of [{ numero: '', recibida: '', tipo: '', datasets: [] }, { numero: '   ', recibida: null, tipo: null, datasets: null }, {}]) {
      const { datos, errores } = validarNotaDgmit(entrada, HOY);
      assert.deepEqual(errores, esperado, JSON.stringify(entrada));
      assert.deepEqual(datos, { numero: null, recibida: null, tipo: null, datasets: null }, JSON.stringify(entrada));
    }
    // Un solo campo mal: solo su error, y los demás datos quedan
    const { datos, errores } = validarNotaDgmit({ ...VALIDA, numero: '\t \n' }, HOY);
    assert.deepEqual(errores, { numero: MENSAJES_NOTA_DGMIT.numero });
    assert.deepEqual(datos, { numero: null, recibida: '2026-10-22', tipo: 'solicitud', datasets: [12] });
  });

  it('número de 40 caracteres sí; de 41, numeroLargo', () => {
    const cuarenta = 'A'.repeat(40);
    assert.deepEqual(erroresCon({ numero: cuarenta }), {});
    assert.equal(validarNotaDgmit({ ...VALIDA, numero: `   ${cuarenta}   ` }, HOY).datos.numero, cuarenta, 'los espacios de los extremos no cuentan');
    assert.deepEqual(erroresCon({ numero: 'A'.repeat(41) }), { numero: MENSAJES_NOTA_DGMIT.numeroLargo });
    assert.deepEqual(erroresCon({ numero: `A${' '.repeat(39)}B` }), { numero: MENSAJES_NOTA_DGMIT.numeroLargo }, 'los espacios del medio sí cuentan');
    // Cuenta caracteres, como el varchar(40) de la base, no unidades de UTF-16
    assert.deepEqual(erroresCon({ numero: 'Ñ°'.repeat(20) }), {});
    assert.deepEqual(erroresCon({ numero: '𝟙'.repeat(40) }), {});
    assert.deepEqual(erroresCon({ numero: '𝟙'.repeat(41) }), { numero: MENSAJES_NOTA_DGMIT.numeroLargo });
    const largo = validarNotaDgmit({ ...VALIDA, numero: 'A'.repeat(41) }, HOY);
    assert.equal(largo.datos.numero, null);
  });

  it('fecha: 2025-01-01 y hoy sí; 2024-12-31, recibidaVieja; mañana, recibidaFutura; 2026-02-30 y "22/10/2026", recibida', () => {
    assert.deepEqual(erroresCon({ recibida: '2025-01-01' }), {});
    assert.deepEqual(erroresCon({ recibida: HOY }), {});
    assert.deepEqual(erroresCon({ recibida: '2024-12-31' }), { recibida: MENSAJES_NOTA_DGMIT.recibidaVieja });
    assert.deepEqual(erroresCon({ recibida: '2026-10-25' }), { recibida: MENSAJES_NOTA_DGMIT.recibidaFutura });
    assert.deepEqual(erroresCon({ recibida: '2027-01-01' }), { recibida: MENSAJES_NOTA_DGMIT.recibidaFutura });
    for (const recibida of ['2026-02-30', '22/10/2026', '2026-10-22 ', ' 2026-10-22', '2026-10-22T00:00:00', '2026-1-5', '2026-13-01']) {
      assert.deepEqual(erroresCon({ recibida }), { recibida: MENSAJES_NOTA_DGMIT.recibida }, recibida);
    }
    // El 29/02 de un año bisiesto existe
    assert.deepEqual(erroresCon({ recibida: '2028-02-29' }, '2028-03-01'), {});
    assert.equal(validarNotaDgmit({ ...VALIDA, recibida: '2026-10-25' }, HOY).datos.recibida, null);
  });

  it('tipo fuera de la lista da el mensaje del tipo', () => {
    assert.deepEqual(erroresCon({ tipo: 'reiteracion' }), {});
    for (const tipo of ['Solicitud', 'SOLICITUD', ' solicitud', 'reiteración', 'otro', 'autorizacion', 1, true, ['solicitud'], {}]) {
      assert.deepEqual(erroresCon({ tipo }), { tipo: MENSAJES_NOTA_DGMIT.tipo }, JSON.stringify(tipo));
    }
  });

  it('datasets: [], "5", [0], [-1], ["a"] y [1.5] dan el error; ["7", 7, 8] da [7, 8]', () => {
    for (const datasets of [[], '5', [0], [-1], ['a'], [1.5]]) {
      assert.deepEqual(erroresCon({ datasets }), { datasets: MENSAJES_NOTA_DGMIT.datasets }, JSON.stringify(datasets));
    }
    assert.deepEqual(validarNotaDgmit({ ...VALIDA, datasets: ['7', 7, 8] }, HOY).datos.datasets, [7, 8]);
    // Cualquier elemento inválido invalida el campo entero (no se descarta en silencio)
    const raros = [
      [7, 'x'], ['0'], ['-1'], ['1.5'], ['1e3'], [' 7'], ['7 '], [''], [null], [undefined], [true], [NaN], [Infinity],
      [Number.MAX_SAFE_INTEGER + 1], ['9007199254740993'], [[7]], [{}], {}, { 0: 7, length: 1 }, 7, null
    ];
    for (const datasets of raros) {
      const { datos, errores } = validarNotaDgmit({ ...VALIDA, datasets }, HOY);
      assert.deepEqual(errores, { datasets: MENSAJES_NOTA_DGMIT.datasets }, String(datasets));
      assert.equal(datos.datasets, null);
    }
    // Los repetidos se sacan en tiempo lineal: un cuerpo de casi 1 MB (lo que acepta express.json) no traba el servidor
    const muchos = Array.from({ length: 100000 }, (_, i) => i + 1);
    const conRepetidos = [...muchos, ...muchos.map(String), 50000];
    const inicio = performance.now();
    const grande = validarNotaDgmit({ ...VALIDA, datasets: conRepetidos }, HOY);
    const demora = performance.now() - inicio;
    assert.deepEqual(grande.errores, {});
    assert.deepEqual(grande.datos.datasets, muchos, 'sin repetidos y en el orden recibido');
    assert.ok(demora < 1000, `100.000 ids tardaron ${Math.round(demora)} ms`);
    // Textos de solo dígitos, también con ceros a la izquierda, y el entero seguro más grande
    assert.deepEqual(validarNotaDgmit({ ...VALIDA, datasets: ['007', Number.MAX_SAFE_INTEGER] }, HOY).datos.datasets,
      [7, Number.MAX_SAFE_INTEGER]);
  });
});

describe('validarMotivo', () => {
  it('validarMotivo: vacío, 500 y 501 caracteres', () => {
    for (const valor of ['', '   ', '\n\t']) {
      assert.deepEqual(validarMotivo(valor), { motivo: null, error: MENSAJES_NOTA_DGMIT.motivo }, JSON.stringify(valor));
    }
    const quinientos = 'm'.repeat(500);
    assert.deepEqual(validarMotivo(quinientos), { motivo: quinientos, error: null });
    assert.deepEqual(validarMotivo(`  ${quinientos}  `), { motivo: quinientos, error: null });
    assert.deepEqual(validarMotivo('m'.repeat(501)), { motivo: null, error: MENSAJES_NOTA_DGMIT.motivoLargo });
    assert.deepEqual(validarMotivo('  El número estaba mal  '), { motivo: 'El número estaba mal', error: null });
  });
});

describe('sePuedeElegir', () => {
  // Una fila de datasets como la devuelve mysql2: activo y requiere_nota son tinyint (1, 0 o null)
  const fila = (cambio) => ({ activo: 1, tipo_gestion: 'externa', requiere_nota: 1, ...cambio });

  it('solo los activos, de gestión externa y con «Requiere nota DGMIT» en Sí o sin dato', () => {
    assert.equal(sePuedeElegir(fila({})), true, 'activo, externo, Sí');
    assert.equal(sePuedeElegir(fila({ requiere_nota: null })), true, 'activo, externo, sin dato');
    assert.equal(sePuedeElegir(fila({ requiere_nota: 0 })), false, 'activo, externo, No (el 0 es un valor)');
    assert.equal(sePuedeElegir(fila({ activo: 0 })), false, 'dado de baja');
    assert.equal(sePuedeElegir(fila({ activo: 0, requiere_nota: null })), false, 'dado de baja, sin dato');
    assert.equal(sePuedeElegir(fila({ tipo_gestion: 'interna', requiere_nota: null })), false, 'interno');
    assert.equal(sePuedeElegir(fila({ activo: true })), true, 'activo como booleano');
    assert.equal(sePuedeElegir(fila({ activo: false })), false, 'inactivo como booleano');
  });
});

describe('idsDeDatasets', () => {
  it('los ids sin repetidos y en el orden recibido; null si la lista está vacía o trae algo que no es un id', () => {
    assert.deepEqual(idsDeDatasets([12, '7', 12, '12', 3]), [12, 7, 3]);
    for (const valor of [[], [7, 'x'], [0], null, undefined, '7', 7, {}]) {
      assert.equal(idsDeDatasets(valor), null, JSON.stringify(valor));
    }
  });
});

describe('entradas raras', () => {
  it('nunca tira error con entradas raras (null, undefined, números en lugar de texto)', () => {
    const todos = {
      numero: MENSAJES_NOTA_DGMIT.numero,
      recibida: MENSAJES_NOTA_DGMIT.recibida,
      tipo: MENSAJES_NOTA_DGMIT.tipo,
      datasets: MENSAJES_NOTA_DGMIT.datasets
    };
    for (const entrada of [null, undefined, 'texto', 5, true, [], () => VALIDA]) {
      const resultado = validarNotaDgmit(entrada, HOY);
      assert.deepEqual(resultado.errores, todos, String(entrada));
      for (const campo of CAMPOS) assert.equal(resultado.datos[campo], null, `${campo} de ${String(entrada)}`);
    }
    assert.deepEqual(validarNotaDgmit().errores, todos);
    // Números en lugar de texto: no son un número de nota, una fecha ni un tipo
    assert.deepEqual(validarNotaDgmit({ numero: 156, recibida: 20261022, tipo: 1, datasets: 'abc' }, HOY).errores, todos);
    // Sin un hoy válido no se puede saber si la fecha es posterior: no pasa
    for (const hoy of [undefined, null, '', '24/10/2026', 20261024]) {
      assert.deepEqual(validarNotaDgmit(VALIDA, hoy).errores, { recibida: MENSAJES_NOTA_DGMIT.recibidaFutura }, String(hoy));
    }
    for (const valor of [null, undefined, 5, true, {}, ['motivo']]) {
      assert.deepEqual(validarMotivo(valor), { motivo: null, error: MENSAJES_NOTA_DGMIT.motivo }, String(valor));
    }
    assert.deepEqual(validarMotivo(), { motivo: null, error: MENSAJES_NOTA_DGMIT.motivo });
  });
});
