// Calendario de Notas Digitales (funciones puras)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as cal from '../services/notasDigitalesCalendario.js';

describe('hoyArgentina', () => {
  it('usa la fecha de Argentina aunque en UTC ya sea el día siguiente', () => {
    assert.equal(cal.hoyArgentina(new Date('2026-11-02T02:00:00Z')), '2026-11-01');
    assert.equal(cal.hoyArgentina(new Date('2026-11-02T11:00:00Z')), '2026-11-02');
  });
});

describe('días hábiles', () => {
  const casos = [
    ['2026-10-12', true, 'lunes'],
    ['2026-12-31', true, 'jueves'],
    ['2026-11-01', false, 'domingo'],
    ['2027-05-01', false, 'sábado y feriado'],
    ['2027-01-01', false, 'viernes feriado'],
    ['2027-03-24', false, 'miércoles feriado'],
    ['2026-12-25', false, 'viernes feriado']
  ];
  for (const [fecha, esperado, descripcion] of casos) {
    it(`${fecha} (${descripcion}) → ${esperado}`, () => {
      assert.equal(cal.esDiaHabil(fecha), esperado);
    });
  }

  it('primer día hábil de cada mes', () => {
    assert.equal(cal.primerDiaHabilDelMes('2026-10'), '2026-10-01');
    assert.equal(cal.primerDiaHabilDelMes('2026-11'), '2026-11-02');
    assert.equal(cal.primerDiaHabilDelMes('2026-12'), '2026-12-01');
    assert.equal(cal.primerDiaHabilDelMes('2027-01'), '2027-01-04');
    assert.equal(cal.primerDiaHabilDelMes('2027-05'), '2027-05-03');
  });

  it('próximo día hábil', () => {
    assert.equal(cal.proximoDiaHabil('2026-11-01'), '2026-11-02');
    assert.equal(cal.proximoDiaHabil('2026-11-02'), '2026-11-02');
  });

  it('último día hábil anterior (sin contar el día dado)', () => {
    assert.equal(cal.diaHabilAnterior('2026-11-03'), '2026-11-02');
    assert.equal(cal.diaHabilAnterior('2026-11-02'), '2026-10-30');
    assert.equal(cal.diaHabilAnterior('2026-11-01'), '2026-10-30');
    assert.equal(cal.diaHabilAnterior('2027-01-04'), '2026-12-31');
  });
});

describe('ahoraArgentina', () => {
  it('da fecha y hora de Argentina en formato AAAA-MM-DD HH:MM:SS', () => {
    assert.equal(cal.ahoraArgentina(new Date('2026-11-02T02:30:05Z')), '2026-11-01 23:30:05');
    assert.equal(cal.ahoraArgentina(new Date('2026-11-02T03:00:00Z')), '2026-11-02 00:00:00');
    assert.equal(cal.ahoraArgentina(new Date('2026-11-02T11:00:00Z')), '2026-11-02 08:00:00');
  });
});

describe('aritmética de fechas', () => {
  it('suma y resta días cruzando meses y años', () => {
    assert.equal(cal.sumarDias('2026-12-31', 1), '2027-01-01');
    assert.equal(cal.sumarDias('2026-10-31', -30), '2026-10-01');
  });

  it('cuenta días entre fechas', () => {
    assert.equal(cal.diasEntre('2026-10-01', '2026-10-31'), 30);
    assert.equal(cal.diasEntre('2026-11-15', '2026-11-02'), -13);
  });

  it('períodos', () => {
    assert.equal(cal.periodoDe('2026-11-02'), '2026-11');
    assert.equal(cal.periodoSiguiente('2026-12'), '2027-01');
    assert.equal(cal.periodoSiguiente('2026-03'), '2026-04');
  });
});

describe('formatos', () => {
  it('corto, largo y mes', () => {
    assert.equal(cal.formatoCorto('2026-11-02'), '02/11/2026');
    assert.equal(cal.formatoCorto(null), '—');
    assert.equal(cal.formatoLargo('2026-11-02'), '2 de noviembre de 2026');
    assert.equal(cal.mesYAnio('2026-11-02'), 'noviembre 2026');
  });
});
