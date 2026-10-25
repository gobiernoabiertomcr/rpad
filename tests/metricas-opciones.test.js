// Las opciones de la pestaña Métricas (spec 2026-10-24-metricas-y-reportes, 1.5 a 1.7 y 3; services/metricasOpciones.js): los
// parámetros raros caen a los de entrada (Review Focus 2), qué años se ven y cómo (Ruling 17: uno cerrado sin foto se ve en vivo con el
// aviso de la foto) y de qué año toca sacar la foto (Ruling 18: el más viejo que falta). Puro: sin base.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DIA_DE_LA_FOTO, opcionesDeMetricas, aniosDeMetricas, fotosDeMetricas, fotoQueToca } from '../services/metricasOpciones.js';

const AL = '2026-12-31';
const SE_SACA = 'La foto de 2026 se saca el 10/01/2027';
const SE_REINTENTA = 'La foto de 2026 todavía no se sacó: se reintenta en la próxima corrida.';

describe('opcionesDeMetricas', () => {
  const opciones = (query, hoy = '2026-10-24', aniosConFoto = []) => opcionesDeMetricas(query, { hoy, aniosConFoto });
  const DE_ENTRADA = { anio: 2026, al: '2026-10-24', en_vivo: true, aviso_foto: null, estadistico: 'mediana', dias: 'habiles', gestion: 'externa' };

  // Review Focus 2
  it('los valores inválidos caen a los de entrada y sin acepta solo enteros positivos, sin repetidos', () => {
    assert.deepEqual(opciones({ anio: 'abc', sin: 'x,1e3,-2,5,5', estadistico: 'foo', dias: 'bar', gestion: 'z' }), { ...DE_ENTRADA, sin: [5] });
    // Sin parámetros (o sin query), los de entrada
    assert.deepEqual(opciones({}), { ...DE_ENTRADA, sin: [] });
    assert.deepEqual(opciones(undefined), { ...DE_ENTRADA, sin: [] });
    assert.deepEqual(opciones(null), { ...DE_ENTRADA, sin: [] });
    // Un año que no son cuatro dígitos, o que no es un texto ni un número, tampoco sirve
    for (const anio of ['', '2026x', '02026', '26', '2026.0', ['2026', '2027'], { a: 1 }, 2026.5, true]) {
      assert.deepEqual(opciones({ anio }), { ...DE_ENTRADA, sin: [] }, JSON.stringify(anio));
    }
    // Un selector repetido en la URL llega como lista: no sirve
    assert.deepEqual(opciones({ estadistico: ['promedio', 'mediana'], dias: ['corridos'], gestion: ['interna'] }), { ...DE_ENTRADA, sin: [] });
  });

  it('los valores válidos pasan, y sin conserva el orden pedido', () => {
    assert.deepEqual(opciones({ anio: '2026', sin: '45,12,45', estadistico: 'promedio', dias: 'corridos', gestion: 'interna' }), {
      ...DE_ENTRADA, estadistico: 'promedio', dias: 'corridos', gestion: 'interna', sin: [45, 12]
    });
    assert.equal(opciones({ anio: 2026 }).anio, 2026);
  });

  it('sin: dígitos y nada más (con espacios alrededor), un número seguro y mayor que 0; también repetido en la URL', () => {
    const sin = (valor) => opciones({ sin: valor }).sin;
    assert.deepEqual(sin('0,00,1.5,1e3,-3,abc,,12abc, 7 ,007'), [7]);
    assert.deepEqual(sin('99999999999999999999,9007199254740991'), [9007199254740991]);
    assert.deepEqual(sin(['3', '1,3', '2']), [3, 1, 2]);
    for (const valor of ['', ',', undefined, null, 5, { 1: '2' }, [1, 2]]) assert.deepEqual(sin(valor), [], JSON.stringify(valor));
  });

  it('el año en curso va en vivo, al día de hoy; solo un año anterior a 2026 o futuro da null (el 404)', () => {
    assert.deepEqual(opciones({ anio: '2026' }, '2026-01-01'), { ...DE_ENTRADA, al: '2026-01-01', sin: [] });
    for (const anio of ['1999', '2025', '2027', 2025]) assert.equal(opciones({ anio }), null, String(anio));
    assert.equal(opciones({ anio: '2025' }, '2028-03-01'), null);
    assert.equal(opciones({ anio: '2029' }, '2028-03-01'), null);
    // Un hoy que no es una fecha
    for (const hoy of ['2026-13-01', '24/10/2026', null, undefined]) {
      assert.equal(opcionesDeMetricas({}, { hoy, aniosConFoto: [] }), null, String(hoy));
    }
    assert.equal(opcionesDeMetricas({}), null);
  });

  it('un año cerrado sin foto va en vivo «al 31/12» y se puede destildar: hasta el 10/01, «se saca el 10/01»; después, «se reintenta» (Ruling 17)', () => {
    for (const hoy of ['2027-01-01', '2027-01-05', '2027-01-10']) {
      assert.deepEqual(opciones({ anio: '2026', sin: '4,2' }, hoy), { ...DE_ENTRADA, al: AL, aviso_foto: SE_SACA, sin: [4, 2] }, hoy);
      // El de entrada sigue siendo el año en curso
      assert.deepEqual(opciones({}, hoy), { ...DE_ENTRADA, anio: 2027, al: hoy, sin: [] }, hoy);
    }
    // Desde el 11/01, si la corrida no pudo sacarla, sigue en vivo con el aviso de que se reintenta; también años después
    for (const hoy of ['2027-01-11', '2027-06-15', '2029-03-01']) {
      assert.deepEqual(opciones({ anio: '2026', sin: '4,2' }, hoy), { ...DE_ENTRADA, al: AL, aviso_foto: SE_REINTENTA, sin: [4, 2] }, hoy);
    }
    // Con varios años sin foto, cada uno con su aviso
    assert.equal(opciones({ anio: '2027' }, '2028-01-05').aviso_foto, 'La foto de 2027 se saca el 10/01/2028');
    assert.equal(opciones({ anio: '2026' }, '2028-01-05').aviso_foto, SE_REINTENTA);
    assert.equal(opciones({ anio: '2027' }, '2028-01-11').aviso_foto, 'La foto de 2027 todavía no se sacó: se reintenta en la próxima corrida.');
    // aniosConFoto que no es una lista: ninguno
    assert.equal(opcionesDeMetricas({ anio: '2026' }, { hoy: '2027-06-15', aniosConFoto: 'x' }).aviso_foto, SE_REINTENTA);
  });

  it('con foto, el año sale de la foto y sin destildar, también el mismo 10/01 una vez sacada', () => {
    for (const hoy of ['2027-01-05', '2027-01-10', '2027-01-11', '2027-06-15', '2029-03-01']) {
      assert.deepEqual(opciones({ anio: '2026', sin: '4,2' }, hoy, [2026]), { ...DE_ENTRADA, al: AL, en_vivo: false, sin: [] }, hoy);
    }
    // Los años con foto pueden llegar como texto; un año en curso con foto (no pasa: se saca el 10/01 del siguiente) sigue en vivo
    assert.equal(opciones({ anio: '2026' }, '2027-06-15', ['2026']).en_vivo, false);
    assert.deepEqual(opciones({ anio: '2026' }, '2026-10-24', [2026]), { ...DE_ENTRADA, sin: [] });
    // Uno con foto y otro sin ella
    assert.deepEqual([opciones({ anio: '2026' }, '2028-03-01', [2026]).en_vivo, opciones({ anio: '2027' }, '2028-03-01', [2026]).en_vivo], [false, true]);
  });
});

describe('aniosDeMetricas', () => {
  it('siempre de 2026 al año de hoy, tengan foto o no (Ruling 17)', () => {
    assert.deepEqual(aniosDeMetricas({ hoy: '2026-10-24' }), [2026]);
    assert.deepEqual(aniosDeMetricas({ hoy: '2026-01-05' }), [2026]);
    for (const hoy of ['2027-01-05', '2027-01-10', '2027-01-11', '2027-12-31']) assert.deepEqual(aniosDeMetricas({ hoy }), [2026, 2027], hoy);
    assert.deepEqual(aniosDeMetricas({ hoy: '2029-02-01' }), [2026, 2027, 2028, 2029]);
    for (const hoy of ['2025-12-31', 'no es una fecha', null]) assert.deepEqual(aniosDeMetricas({ hoy }), [], String(hoy));
    assert.deepEqual(aniosDeMetricas(), []);
  });
});

// La tarjeta del Informe anual (spec 5, Para presentar, punto 2) sabe por el servidor qué años tienen foto y desde qué día se puede
// descargar el de los que no la tienen: el 10/01 del año siguiente, el día de la foto
describe('fotosDeMetricas', () => {
  const sinFoto = (anio) => ({ anio, con_foto: false, dia_de_la_foto: `${anio + 1}-01-10` });

  it('cada año de aniosDeMetricas con su foto y el día en que se saca, del más viejo al más nuevo', () => {
    assert.deepEqual(fotosDeMetricas({ hoy: '2026-10-24', aniosConFoto: [] }), [sinFoto(2026)]);
    assert.deepEqual(fotosDeMetricas({ hoy: '2027-01-05', aniosConFoto: [] }), [sinFoto(2026), sinFoto(2027)]);
    assert.deepEqual(fotosDeMetricas({ hoy: '2027-03-01', aniosConFoto: [2026] }), [{ ...sinFoto(2026), con_foto: true }, sinFoto(2027)]);
    assert.deepEqual(fotosDeMetricas({ hoy: '2029-02-01', aniosConFoto: [2027, 2026] }).map((f) => [f.anio, f.con_foto]),
      [[2026, true], [2027, true], [2028, false], [2029, false]]);
    // Los años con foto pueden llegar como texto; una foto anterior a 2026 no es un año de Métricas
    assert.deepEqual(fotosDeMetricas({ hoy: '2027-03-01', aniosConFoto: ['2026', 2025] }), [{ ...sinFoto(2026), con_foto: true }, sinFoto(2027)]);
    // Lo que no es una lista de años, ninguno con foto; sin hoy, ningún año
    assert.deepEqual(fotosDeMetricas({ hoy: '2027-03-01', aniosConFoto: 'x' }), [sinFoto(2026), sinFoto(2027)]);
    for (const hoy of ['2025-12-31', 'no es una fecha', null]) assert.deepEqual(fotosDeMetricas({ hoy, aniosConFoto: [2026] }), [], String(hoy));
    assert.deepEqual(fotosDeMetricas(), []);
  });

  it('el día de la foto es el de DIA_DE_LA_FOTO, el que usa la corrida (fotoQueToca)', () => {
    for (const { anio, dia_de_la_foto: dia } of fotosDeMetricas({ hoy: '2028-06-01', aniosConFoto: [] })) {
      assert.equal(dia, `${anio + 1}-${DIA_DE_LA_FOTO}`, String(anio));
      // Ese día la corrida la saca (con las de los años anteriores ya sacadas)
      assert.deepEqual(fotoQueToca({ hoy: dia, aniosConFoto: Array.from({ length: anio - 2026 }, (_, i) => 2026 + i) }), { anio, falta: true }, dia);
    }
  });
});

describe('fotoQueToca', () => {
  const toca = (hoy, aniosConFoto = []) => fotoQueToca({ hoy, aniosConFoto });

  it('desde el 10/01, la del año cerrado más viejo que falta, de a una (Ruling 18)', () => {
    // Antes del 10/01/2027 no toca ninguna: en 2026 no hay foto de 2025 que sacar
    for (const hoy of ['2026-01-10', '2026-10-24', '2026-12-31', '2027-01-09']) assert.equal(toca(hoy), null, hoy);
    assert.deepEqual(toca('2027-01-10'), { anio: 2026, falta: true });
    assert.deepEqual(toca('2027-01-10', [2026]), { anio: 2026, falta: false });
    assert.deepEqual(toca('2027-06-15', [2026]), { anio: 2026, falta: false });
    // Si una corrida no pudo sacarla, la siguiente la reintenta, aunque haya pasado más de un año: primero la más vieja
    assert.deepEqual(toca('2028-03-01'), { anio: 2026, falta: true });
    assert.deepEqual(toca('2028-03-01', [2026]), { anio: 2027, falta: true });
    assert.deepEqual(toca('2028-03-01', [2027]), { anio: 2026, falta: true });
    assert.deepEqual(toca('2028-03-01', [2026, 2027]), { anio: 2027, falta: false });
    // Antes del 10/01/2028, la de 2027 todavía no toca
    assert.deepEqual(toca('2028-01-09'), { anio: 2026, falta: true });
    assert.deepEqual(toca('2028-01-09', [2026]), { anio: 2026, falta: false });
    assert.deepEqual(toca('2028-01-10', [2026]), { anio: 2027, falta: true });
    // Una foto anterior a 2026 no cuenta; los años pueden llegar como texto
    assert.deepEqual(toca('2027-03-01', [2025]), { anio: 2026, falta: true });
    assert.deepEqual(toca('2027-03-01', ['2026']), { anio: 2026, falta: false });
    for (const hoy of ['2027-13-10', '10/01/2027', null, undefined]) assert.equal(toca(hoy), null, String(hoy));
    assert.equal(fotoQueToca(), null);
  });

  it('el aviso de un año sin foto dice lo que va a hacer la corrida: hasta el 10/01, que se saca; después, que se reintenta', () => {
    for (const hoy of ['2027-01-09', '2027-01-10', '2027-01-11', '2028-03-01']) {
      const { aviso_foto: aviso } = opcionesDeMetricas({ anio: '2026' }, { hoy, aniosConFoto: [] });
      // El día en que toca, o desde que toca, fotoQueToca la intenta sacar
      const laIntenta = toca(hoy)?.anio === 2026 && toca(hoy).falta;
      assert.equal(aviso, hoy <= '2027-01-10' ? SE_SACA : SE_REINTENTA, hoy);
      assert.equal(laIntenta, hoy >= '2027-01-10', hoy);
    }
  });

  it('DIA_DE_LA_FOTO es el 10/01', () => {
    assert.equal(DIA_DE_LA_FOTO, '01-10');
  });
});
