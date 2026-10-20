// «Requiere nota DGMIT» (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.1 y 1.3): las reglas puras del dato.
// 1 = Sí (la DGMIT le manda una nota formal al área), 0 = No, NULL = sin dato; en gestión interna, siempre NULL.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MENSAJE_FALTA_REQUIERE_NOTA, normalizarRequiereNota, requiereNotaResultante, textoRequiereNota
} from '../services/requiereNotaReglas.js';

describe('MENSAJE_FALTA_REQUIERE_NOTA', () => {
  it('es el texto exacto de la validación', () => {
    assert.equal(MENSAJE_FALTA_REQUIERE_NOTA, 'Indicá si el dataset requiere nota DGMIT.');
  });
});

describe('normalizarRequiereNota', () => {
  it('undefined es "no vino"', () => {
    assert.equal(normalizarRequiereNota(undefined), undefined);
    assert.equal(normalizarRequiereNota(), undefined);
  });

  it('null y el texto vacío son null (sin dato)', () => {
    assert.equal(normalizarRequiereNota(null), null);
    assert.equal(normalizarRequiereNota(''), null);
  });

  it('1, true y "1" son 1', () => {
    for (const valor of [1, true, '1']) assert.strictEqual(normalizarRequiereNota(valor), 1, String(valor));
  });

  it('0, false y "0" son 0, y 0 no se vuelve null', () => {
    for (const valor of [0, false, '0']) assert.strictEqual(normalizarRequiereNota(valor), 0, String(valor));
  });

  it('cualquier otro valor tira TypeError', () => {
    for (const valor of ['si', 'Sí', 'no', 'true', 'false', 2, -1, 0.5, NaN, ' 1', '1 ', '01', {}, [], [1], () => 1]) {
      assert.throws(() => normalizarRequiereNota(valor), TypeError, String(valor));
    }
  });
});

describe('requiereNotaResultante', () => {
  it('en gestión interna es siempre null, venga lo que venga', () => {
    for (const valor of [1, 0, null, undefined]) {
      assert.strictEqual(requiereNotaResultante({ gestion: 'interna', valor }), null, String(valor));
    }
  });

  it('en gestión externa es el valor, y 0 sigue siendo 0', () => {
    assert.strictEqual(requiereNotaResultante({ gestion: 'externa', valor: 1 }), 1);
    assert.strictEqual(requiereNotaResultante({ gestion: 'externa', valor: 0 }), 0);
    assert.strictEqual(requiereNotaResultante({ gestion: 'externa', valor: null }), null);
    assert.strictEqual(requiereNotaResultante({ gestion: 'externa', valor: undefined }), null);
  });
});

describe('textoRequiereNota', () => {
  it('1 es Sí y 0 es No', () => {
    assert.equal(textoRequiereNota(1), 'Sí');
    assert.equal(textoRequiereNota(0), 'No');
  });

  it('sin dato devuelve el texto que se le pide (por defecto, la raya)', () => {
    for (const valor of [null, undefined, '']) {
      assert.equal(textoRequiereNota(valor), '—', String(valor));
      assert.equal(textoRequiereNota(valor, 'Sin dato'), 'Sin dato', String(valor));
    }
  });

  it('un valor que no es 0 ni 1 cuenta como sin dato y nunca tira', () => {
    for (const valor of ['si', 2, {}, NaN]) assert.equal(textoRequiereNota(valor, 'Sin dato'), 'Sin dato', String(valor));
  });

  it('el valor que viene como booleano o como texto también se lee', () => {
    assert.equal(textoRequiereNota(true), 'Sí');
    assert.equal(textoRequiereNota(false), 'No');
    assert.equal(textoRequiereNota('1'), 'Sí');
    assert.equal(textoRequiereNota('0'), 'No');
  });
});
