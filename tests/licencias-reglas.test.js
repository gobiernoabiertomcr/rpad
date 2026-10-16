// Reglas de las licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.1 y 5.2): funciones puras
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES_CON_LICENCIA, MAXIMO_DIAS_LICENCIA, puedeTenerLicencia, estadoDeLicencia, validarFechasNuevas, validarEdicion,
  puedeAnularse
} from '../services/licenciasReglas.js';

const HOY = '2026-11-10';
const licencia = (desde, hasta, anulada = 0) => ({ desde, hasta, anulada });

describe('quién puede tener licencia', () => {
  it('superadmin, admin y editor; el lector no', () => {
    assert.deepEqual(ROLES_CON_LICENCIA, ['superadmin', 'admin', 'editor']);
    assert.equal(puedeTenerLicencia('admin'), true);
    assert.equal(puedeTenerLicencia('lector'), false);
    assert.equal(puedeTenerLicencia(undefined), false);
  });
});

describe('estadoDeLicencia', () => {
  it('futura, en curso (incluidos los dos extremos), pasada y anulada', () => {
    assert.equal(estadoDeLicencia(licencia('2026-11-11', '2026-11-20'), HOY), 'futura');
    assert.equal(estadoDeLicencia(licencia('2026-11-10', '2026-11-20'), HOY), 'en_curso');
    assert.equal(estadoDeLicencia(licencia('2026-11-01', '2026-11-10'), HOY), 'en_curso');
    assert.equal(estadoDeLicencia(licencia('2026-11-01', '2026-11-09'), HOY), 'pasada');
    assert.equal(estadoDeLicencia(licencia('2026-11-11', '2026-11-20', 1), HOY), 'anulada');
  });
});

describe('validarFechasNuevas', () => {
  it('acepta una licencia que termina hoy o después, aunque haya empezado antes', () => {
    assert.equal(validarFechasNuevas({ desde: '2026-11-05', hasta: '2026-11-10' }, HOY), null);
    assert.equal(validarFechasNuevas({ desde: '2026-11-26', hasta: '2027-01-14' }, HOY), null);
  });

  it('rechaza fechas inválidas, invertidas, ya pasadas o de más de 365 días', () => {
    assert.match(validarFechasNuevas({ desde: '2026-11-31', hasta: '2026-12-01' }, HOY), /días válidos/);
    assert.match(validarFechasNuevas({ desde: '2026-12-01' }, HOY), /días válidos/);
    assert.match(validarFechasNuevas({ desde: '2026-12-10', hasta: '2026-12-01' }, HOY), /antes de empezar/);
    assert.match(validarFechasNuevas({ desde: '2026-11-01', hasta: '2026-11-09' }, HOY), /ya terminó/);
    assert.equal(validarFechasNuevas({ desde: '2026-11-10', hasta: '2027-11-09' }, HOY), null);
    assert.match(validarFechasNuevas({ desde: '2026-11-10', hasta: '2027-11-10' }, HOY), new RegExp(`${MAXIMO_DIAS_LICENCIA} días`));
  });
});

describe('validarEdicion (spec 5.2)', () => {
  it('una futura admite cambiar las dos fechas', () => {
    assert.deepEqual(validarEdicion(licencia('2026-11-20', '2026-11-30'), { desde: '2026-11-21', hasta: '2026-12-05' }, HOY),
      { datos: { desde: '2026-11-21', hasta: '2026-12-05' } });
  });

  it('una en curso solo admite cambiar el fin, a ayer o después', () => {
    const enCurso = licencia('2026-11-01', '2026-11-30');
    assert.deepEqual(validarEdicion(enCurso, { hasta: '2026-12-15' }, HOY), { datos: { desde: '2026-11-01', hasta: '2026-12-15' } });
    assert.deepEqual(validarEdicion(enCurso, { desde: '2026-11-01', hasta: '2026-11-09' }, HOY), { datos: { desde: '2026-11-01', hasta: '2026-11-09' } });
    assert.equal(validarEdicion(enCurso, { hasta: '2026-11-08' }, HOY).codigo, 400);
    assert.match(validarEdicion(enCurso, { desde: '2026-11-02' }, HOY).error, /solo se puede cambiar la fecha de fin/);
  });

  it('una pasada o anulada no admite cambios (409)', () => {
    assert.equal(validarEdicion(licencia('2026-11-01', '2026-11-09'), { hasta: '2026-11-20' }, HOY).codigo, 409);
    assert.equal(validarEdicion(licencia('2026-11-20', '2026-11-30', 1), { hasta: '2026-12-01' }, HOY).codigo, 409);
  });

  it('sin cambios devuelve las mismas fechas', () => {
    assert.deepEqual(validarEdicion(licencia('2026-11-20', '2026-11-30'), {}, HOY), { datos: { desde: '2026-11-20', hasta: '2026-11-30' } });
  });
});

describe('puedeAnularse', () => {
  it('solo si no está anulada y empieza hoy o después', () => {
    assert.equal(puedeAnularse(licencia('2026-11-10', '2026-11-20'), HOY), true);
    assert.equal(puedeAnularse(licencia('2026-11-11', '2026-11-20'), HOY), true);
    assert.equal(puedeAnularse(licencia('2026-11-09', '2026-11-20'), HOY), false);
    assert.equal(puedeAnularse(licencia('2026-11-11', '2026-11-20', 1), HOY), false);
  });
});
