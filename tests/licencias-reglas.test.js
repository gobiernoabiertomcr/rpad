// Reglas de las licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.1, 5.2 y 6.3): funciones puras
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES_CON_LICENCIA, MAXIMO_DIAS_LICENCIA, puedeTenerLicencia, estadoDeLicencia, validarFechasNuevas, validarEdicion,
  puedeAnularse, diasHabilesLibres
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

describe('diasHabilesLibres (la persona autorizada, spec 6.3)', () => {
  // Marzo de 2027: el 01 es lunes, el 06 y el 07 son sábado y domingo, y el 24 (miércoles) es feriado
  const tramo = (desde, hasta) => ({ desde, hasta });

  it('sin licencias, el primer día hábil del rango', () => {
    assert.deepEqual(diasHabilesLibres('2027-03-06', '2027-03-12', []), { primerDia: '2027-03-08', cubiertos: false });
  });

  it('con licencias que cubren una parte, el primer día hábil fuera de ellas', () => {
    assert.deepEqual(
      diasHabilesLibres('2027-03-01', '2027-03-31', [tramo('2027-02-22', '2027-03-03'), tramo('2027-03-04', '2027-03-04')]),
      { primerDia: '2027-03-05', cubiertos: false }
    );
  });

  it('si cubren todos los días hábiles, cubiertos (aunque quede libre un fin de semana o un feriado fijo)', () => {
    assert.deepEqual(diasHabilesLibres('2027-03-01', '2027-03-05', [tramo('2027-02-26', '2027-03-08')]), { primerDia: null, cubiertos: true });
    assert.deepEqual(
      diasHabilesLibres('2027-03-04', '2027-03-09', [tramo('2027-03-04', '2027-03-05'), tramo('2027-03-08', '2027-03-09')]),
      { primerDia: null, cubiertos: true }
    );
    assert.deepEqual(
      diasHabilesLibres('2027-03-23', '2027-03-25', [tramo('2027-03-23', '2027-03-23'), tramo('2027-03-25', '2027-03-25')]),
      { primerDia: null, cubiertos: true }
    );
  });

  it('un rango sin días hábiles no queda cubierto: no hay ningún día en que haga falta', () => {
    assert.deepEqual(diasHabilesLibres('2027-03-06', '2027-03-07', [tramo('2027-03-01', '2027-03-31')]), { primerDia: null, cubiertos: false });
    assert.deepEqual(diasHabilesLibres('2027-03-10', '2027-03-09', []), { primerDia: null, cubiertos: false });
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
