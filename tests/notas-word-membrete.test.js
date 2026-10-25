// Generador de Notas (spec 2026-10-24-generador-de-notas, sección 4.1): el membrete y el pie del Word salen de la configuración
// de las Notas Digitales (notas_digitales_config). membreteParaWord nunca tira: un Word sin membrete es mejor que un error. La
// vista previa usa el mismo (membreteParaLaVistaPrevia), con la imagen como data URL. Base de prueba propia.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { crearBaseDePrueba, cerrarDb, query } from './helpers.js';
import { validarImagenMembrete } from '../services/notasDigitalesPdf.js';
import { jpegMinimo } from './firma-fixtures.js';

const LOGO = fs.readFileSync(new URL('../public/img/logo.png', import.meta.url));
const PIE = 'www.comodoroweb.gov.ar – Moreno 815, Comodoro Rivadavia, Chubut.';

let base, word, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_notas_word');
  process.env.DB_NAME = base.nombre;
  word = await import('../services/notasWord.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

// La fila de la configuración como la deja schema.sql: sin imagen y con el pie de la hoja membretada
beforeEach(async () => {
  await query('DELETE FROM notas_digitales_config');
  await query('INSERT INTO notas_digitales_config (id, membrete_pie) VALUES (1, ?)', [PIE]);
});

// Corre `accion` con console.error capturado (los errores esperados no ensucian la salida) y devuelve lo registrado
const conErroresCapturados = async (accion) => {
  const consoleError = console.error;
  const errores = [];
  console.error = (...args) => { errores.push(args); };
  try {
    return { resultado: await accion(), errores };
  } finally {
    console.error = consoleError;
  }
};

describe('membreteParaWord', () => {
  it('sin imagen del membrete: membrete null y el pie de la configuración', async () => {
    assert.deepEqual(await word.membreteParaWord(), { membrete: null, pie: PIE });
  });

  it('con la imagen y su mime: los bytes y el tamaño de validarImagenMembrete', async () => {
    await query('UPDATE notas_digitales_config SET membrete_imagen = ?, membrete_mime = ? WHERE id = 1', [LOGO, 'image/png']);
    const { membrete, pie } = await word.membreteParaWord();
    assert.equal(pie, PIE);
    assert.ok(Buffer.isBuffer(membrete.datos));
    assert.ok(membrete.datos.equals(LOGO));
    const { ancho, alto } = validarImagenMembrete(LOGO, 'image/png');
    assert.equal(membrete.ancho, ancho);
    assert.equal(membrete.alto, alto);
  });

  it('una imagen sin mime guardado se reconoce por sus bytes', async () => {
    await query('UPDATE notas_digitales_config SET membrete_imagen = ?, membrete_mime = NULL WHERE id = 1', [LOGO]);
    const { membrete } = await word.membreteParaWord();
    assert.ok(membrete?.datos.equals(LOGO));
  });

  it('una imagen dañada no tira: membrete null, el pie de la configuración y el error registrado', async () => {
    await query('UPDATE notas_digitales_config SET membrete_imagen = ?, membrete_mime = ? WHERE id = 1', [LOGO.subarray(0, 100), 'image/png']);
    const { resultado, errores } = await conErroresCapturados(() => word.membreteParaWord());
    assert.deepEqual(resultado, { membrete: null, pie: PIE });
    assert.equal(errores.length, 1);
    assert.match(String(errores[0][1]?.message), /La imagen del membrete no es válida/);
  });

  it('sin pie: un texto vacío', async () => {
    await query('UPDATE notas_digitales_config SET membrete_pie = NULL WHERE id = 1');
    assert.deepEqual(await word.membreteParaWord(), { membrete: null, pie: '' });
  });

  it('sin la fila de la configuración no tira: membrete null, pie vacío y el error registrado', async () => {
    await query('DELETE FROM notas_digitales_config');
    const { resultado, errores } = await conErroresCapturados(() => word.membreteParaWord());
    assert.deepEqual(resultado, { membrete: null, pie: '' });
    assert.equal(errores.length, 1);
  });

  it('lo que devuelve sirve tal cual para renderDocx', async () => {
    await query('UPDATE notas_digitales_config SET membrete_imagen = ?, membrete_mime = ? WHERE id = 1', [LOGO, 'image/png']);
    const buffer = await word.renderDocx([{ tipo: 'firma', columnas: 1 }], await word.membreteParaWord());
    assert.equal(buffer.subarray(0, 2).toString('latin1'), 'PK');
  });
});

// La vista previa del generador: el mismo membrete que el Word, con la imagen como data URL (vive en notasWord.js, junto a
// membreteParaWord: no consulta nada propio)
describe('membreteParaLaVistaPrevia', () => {
  it('sin imagen del membrete: imagen null y el pie de la configuración', async () => {
    assert.deepEqual(await word.membreteParaLaVistaPrevia(), { imagen: null, pie: PIE });
  });

  it('con un PNG o un JPEG: el data URL con su tipo y sus bytes, y el pie', async () => {
    await query('UPDATE notas_digitales_config SET membrete_imagen = ?, membrete_mime = ? WHERE id = 1', [LOGO, 'image/png']);
    assert.deepEqual(await word.membreteParaLaVistaPrevia(), { imagen: `data:image/png;base64,${LOGO.toString('base64')}`, pie: PIE });
    const jpeg = jpegMinimo({ ancho: 200, alto: 40 });
    await query('UPDATE notas_digitales_config SET membrete_imagen = ?, membrete_mime = ? WHERE id = 1', [jpeg, 'image/jpeg']);
    assert.deepEqual(await word.membreteParaLaVistaPrevia(), { imagen: `data:image/jpeg;base64,${jpeg.toString('base64')}`, pie: PIE });
  });

  it('si el Word sale sin membrete (una imagen dañada), la vista previa tampoco lo muestra', async () => {
    await query('UPDATE notas_digitales_config SET membrete_imagen = ?, membrete_mime = ? WHERE id = 1', [LOGO.subarray(0, 100), 'image/png']);
    const { resultado } = await conErroresCapturados(() => word.membreteParaLaVistaPrevia());
    assert.deepEqual(resultado, { imagen: null, pie: PIE });
  });
});
