// Reglas de las licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.1, 5.2 y 6.3): funciones puras
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES_CON_LICENCIA, MAXIMO_DIAS_LICENCIA, puedeTenerLicencia, estadoDeLicencia, validarFechasNuevas, validarEdicion,
  puedeAnularse, diasHabilesLibres, unirAusencias, diaDelAvisoEnSuFecha, visperaDeLaLicencia, mensajeDeLaAnulacion,
  TEXTO_SE_BORRA_DE_MI_ESPACIO
} from '../services/licenciasReglas.js';
import { CALENDARIO_FIJO, derivadasDe } from '../services/notasDigitalesCalendario.js';
import { calendarioCon } from '../services/feriadosReglas.js';
import { FILAS_PRECARGA } from './fixtures/feriados-precarga.js';

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

describe('unirAusencias (tramos seguidos de licencia)', () => {
  // Marzo de 2027: el 05 es viernes, el 06 y el 07 sábado y domingo, el 24 (miércoles) feriado
  const tramo = (desde, hasta) => ({ desde, hasta });

  it('une las seguidas y las separadas solo por días no hábiles (fin de semana o feriado fijo), en orden', () => {
    assert.deepEqual(unirAusencias([
      tramo('2027-03-25', '2027-03-26'), tramo('2027-03-01', '2027-03-03'), tramo('2027-03-04', '2027-03-05'),
      tramo('2027-03-08', '2027-03-10'), tramo('2027-03-22', '2027-03-23')
    ]), [tramo('2027-03-01', '2027-03-10'), tramo('2027-03-22', '2027-03-26')]);
  });

  it('no une las separadas por un día hábil', () => {
    assert.deepEqual(unirAusencias([tramo('2027-03-01', '2027-03-03'), tramo('2027-03-05', '2027-03-05')]),
      [tramo('2027-03-01', '2027-03-03'), tramo('2027-03-05', '2027-03-05')]);
    assert.deepEqual(unirAusencias([]), []);
  });
});

describe('diaDelAvisoEnSuFecha (spec 7.6)', () => {
  // Diciembre de 2026: el 08 es feriado (martes), el 10 es jueves, el 18 viernes, el 19 y el 20 sábado y domingo, el 21
  // lunes, el 22 martes y el 25 (viernes) feriado
  const lic = { desde: '2026-12-10', hasta: '2027-01-08' };

  it('es la fecha normal de aviso (cuenta_desde) si la persona autorizada está disponible ese día', () => {
    assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde: '2026-12-22', licencia: lic }), '2026-12-22');
    assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde: '2026-12-22', licencia: lic, ausencias: [{ desde: '2026-12-28', hasta: '2026-12-30' }] }), '2026-12-22');
  });

  it('si ese día falta, es el último día hábil anterior en que no falta (salteando el fin de semana)', () => {
    assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde: '2026-12-22', licencia: lic, ausencias: [{ desde: '2026-12-21', hasta: '2026-12-23' }] }), '2026-12-18');
    assert.equal(diaDelAvisoEnSuFecha({
      cuentaDesde: '2026-12-22', licencia: lic, ausencias: [{ desde: '2026-12-18', hasta: '2026-12-18' }, { desde: '2026-12-21', hasta: '2026-12-23' }]
    }), '2026-12-17');
  });

  it('no baja de la primera fecha de la licencia: sin ningún día disponible desde ahí, no hay aviso en su fecha', () => {
    assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde: '2026-12-22', licencia: lic, ausencias: [{ desde: '2026-12-10', hasta: '2026-12-23' }] }), null); // falta desde el primer día
    assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde: '2026-12-22', licencia: lic, ausencias: [{ desde: '2026-12-14', hasta: '2026-12-23' }] }), '2026-12-11');
  });

  it('null si cuenta_desde no es una fecha o cae fuera de la licencia', () => {
    assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde: '2027-01-11', licencia: lic }), null); // fuera de la licencia
    assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde: '2026-12-09', licencia: lic }), null);
    assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde: null, licencia: lic }), null);
    assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde: '2026-02-30', licencia: lic }), null);
  });
});

describe('con el calendario de la tabla (spec 2026-10-27-feriados-en-notas, 3)', () => {
  // La precarga de producción: el lunes 02/11/2026, el lunes 09/11 y el lunes 07/12 son feriados de la tabla (el 08/11, domingo,
  // también); el martes 08/12 es feriado fijo. Sin el calendario, las reglas cuentan solo los 9 fijos, como siempre
  const CAL = calendarioCon(FILAS_PRECARGA);
  const tramo = (desde, hasta) => ({ desde, hasta });
  const SIN_VISPERA = { vispera: null, sin_anticipo: false, sin_dias_habiles: false };

  it('la víspera de una licencia desde el 09/12/2026 es el viernes 04/12', () => {
    const lic = { desde: '2026-12-09', hasta: '2027-01-08' };
    assert.deepEqual(visperaDeLaLicencia(lic, [], CAL), { vispera: '2026-12-04', sin_anticipo: false, sin_dias_habiles: false });
    assert.deepEqual(visperaDeLaLicencia(lic, []), { vispera: '2026-12-07', sin_anticipo: false, sin_dias_habiles: false });
  });

  it('a continuación de otra licencia: sin víspera', () => {
    // El 04/01/2027 es lunes: el día hábil anterior es el jueves 31/12/2026 (el 01/01 es feriado fijo)
    const lic = { desde: '2027-01-04', hasta: '2027-01-08' };
    const otra = { desde: '2026-12-09', hasta: '2026-12-31' };
    assert.deepEqual(visperaDeLaLicencia(lic, [otra], CAL), { vispera: null, sin_anticipo: true, sin_dias_habiles: false });
    // anulada como la trae la base (1 o 0) o como texto o booleano: la anulada no cuenta, la que no lo está sí
    for (const anulada of [1, true, '1']) {
      assert.deepEqual(visperaDeLaLicencia(lic, [{ ...otra, anulada }], CAL),
        { vispera: '2026-12-31', sin_anticipo: false, sin_dias_habiles: false }, `anulada: ${JSON.stringify(anulada)}`);
    }
    for (const anulada of [0, false, '0', null]) {
      assert.deepEqual(visperaDeLaLicencia(lic, [{ ...otra, anulada }], CAL),
        { vispera: null, sin_anticipo: true, sin_dias_habiles: false }, `anulada: ${JSON.stringify(anulada)}`);
    }
    // Una que termina antes de la víspera no la incluye
    assert.deepEqual(visperaDeLaLicencia(lic, [{ desde: '2026-12-09', hasta: '2026-12-30' }], CAL),
      { vispera: '2026-12-31', sin_anticipo: false, sin_dias_habiles: false });
  });

  it('sin días hábiles: sin víspera', () => {
    // Del sábado 07/11 al lunes 09/11/2026: con la tabla, el 08 y el 09 son feriados
    const lic = { desde: '2026-11-07', hasta: '2026-11-09' };
    assert.deepEqual(visperaDeLaLicencia(lic, [], CAL), { vispera: null, sin_anticipo: false, sin_dias_habiles: true });
    assert.deepEqual(visperaDeLaLicencia(lic, []), { vispera: '2026-11-06', sin_anticipo: false, sin_dias_habiles: false });
    // Sin días hábiles manda, aunque otra licencia incluya el día hábil anterior
    assert.deepEqual(visperaDeLaLicencia(lic, [{ desde: '2026-11-02', hasta: '2026-11-06' }], CAL),
      { vispera: null, sin_anticipo: false, sin_dias_habiles: true });
  });

  it('diasHabilesLibres con el 02/11', () => {
    const licencias = [tramo('2026-11-03', '2026-11-03')];
    assert.deepEqual(diasHabilesLibres('2026-11-02', '2026-11-03', licencias, CAL), { primerDia: null, cubiertos: true });
    assert.deepEqual(diasHabilesLibres('2026-11-02', '2026-11-03', licencias), { primerDia: '2026-11-02', cubiertos: false });
  });

  it('unirAusencias con el 02/11', () => {
    // Del lunes 26/10 al viernes 30/10 y del martes 03/11 al viernes 06/11: con la tabla no hay ningún día hábil entre las dos
    const ausencias = [tramo('2026-10-26', '2026-10-30'), tramo('2026-11-03', '2026-11-06')];
    assert.deepEqual(unirAusencias(ausencias, CAL), [tramo('2026-10-26', '2026-11-06')]);
    assert.deepEqual(unirAusencias(ausencias), [tramo('2026-10-26', '2026-10-30'), tramo('2026-11-03', '2026-11-06')]);
  });

  it('el aviso en su fecha que cae en un feriado de la tabla va al hábil anterior, dentro de la licencia', () => {
    const cuentaDesde = '2026-12-07';
    const delTres = tramo('2026-12-03', '2026-12-18');
    assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde, licencia: delTres, calendario: CAL }), '2026-12-04');
    assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde, licencia: delTres }), '2026-12-07');
    // No baja del primer día de la licencia
    assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde, licencia: tramo('2026-12-07', '2026-12-18'), calendario: CAL }), null);
    // Si la persona autorizada falta el hábil anterior, el que sigue hacia atrás
    const delUno = tramo('2026-12-01', '2026-12-18');
    const ausencias = [tramo('2026-12-04', '2026-12-04')];
    assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde, licencia: delUno, ausencias, calendario: CAL }), '2026-12-03');
    assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde, licencia: delUno, ausencias }), '2026-12-07');
  });

  it('nada tira', () => {
    const lic = { desde: '2026-12-09', hasta: '2027-01-08' };
    const raras = [
      null, undefined, {}, 'x', { desde: '2026-12-09' }, { desde: '2026-02-30', hasta: '2026-03-10' },
      { desde: 20261209, hasta: 20270108 }, { desde: '2027-01-08', hasta: '2026-12-09' }
    ];
    for (const rara of raras) {
      assert.deepEqual(visperaDeLaLicencia(rara, [], CAL), SIN_VISPERA, JSON.stringify(rara));
      assert.deepEqual(visperaDeLaLicencia(rara), SIN_VISPERA, JSON.stringify(rara));
    }
    // otras que no es una lista vale []; lo que no es una licencia dentro de ella no incluye ningún día
    for (const otras of [undefined, null, 'x', [null, 'x', { desde: 5, hasta: 9 }]]) {
      assert.deepEqual(visperaDeLaLicencia(lic, otras, CAL), { vispera: '2026-12-04', sin_anticipo: false, sin_dias_habiles: false },
        JSON.stringify(otras));
    }
    // Un calendario sin ningún día hábil: sus búsquedas tiran el RangeError del tope
    const sinHabiles = { ...CALENDARIO_FIJO, ...derivadasDe(() => false) };
    assert.throws(() => sinHabiles.diaHabilAnterior(lic.desde), RangeError);
    assert.deepEqual(visperaDeLaLicencia(lic, [], sinHabiles), SIN_VISPERA);
    // Un calendario null o mal armado es un error de programación (un olvido tira): no se vuelve «no se sabe»
    assert.throws(() => visperaDeLaLicencia(lic, [], null), TypeError);
    assert.throws(() => visperaDeLaLicencia(lic, [], {}), TypeError);
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

// Anular en Configuración da de baja también la fila de Mi espacio que la creó (spec 2026-10-28-mi-espacio-licencia-anulada,
// 2.1 y 3b): el mensaje dice qué pasó con Mi espacio
describe('mensajeDeLaAnulacion', () => {
  const SIN_MI_ESPACIO = 'Licencia anulada';
  const BORRADA = 'Licencia anulada. También se borró de Mi espacio.';
  const QUEDA = 'Licencia anulada. En Mi espacio ya había empezado: queda allá para que la persona la revise.';

  it('sin fila de Mi espacio, la de siempre; con la creada dada de baja, que se borró; si alguna ya empezó, que queda', () => {
    assert.equal(mensajeDeLaAnulacion({ borradas: 0, quedan: 0 }), SIN_MI_ESPACIO);
    assert.equal(mensajeDeLaAnulacion({ borradas: 1, quedan: 0 }), BORRADA);
    assert.equal(mensajeDeLaAnulacion({ borradas: 2, quedan: 0 }), BORRADA);
    assert.equal(mensajeDeLaAnulacion({ borradas: 0, quedan: 1 }), QUEDA);
    assert.equal(mensajeDeLaAnulacion({ borradas: 1, quedan: 1 }), QUEDA);
  });

  it('sin argumentos o con lo que no son cantidades, la de siempre: nunca tira', () => {
    for (const valor of [undefined, null, 'x', 3, [], {}, { borradas: '1', quedan: '1' }, { borradas: -1, quedan: Number.NaN },
      { borradas: 1.5, quedan: Number.POSITIVE_INFINITY }]) {
      assert.equal(mensajeDeLaAnulacion(valor), SIN_MI_ESPACIO, JSON.stringify(valor));
    }
    assert.equal(mensajeDeLaAnulacion(), SIN_MI_ESPACIO);
  });

  it('la aclaración de la confirmación de Configuración, sin el tipo', () => {
    assert.equal(TEXTO_SE_BORRA_DE_MI_ESPACIO, 'Se cargó desde Mi espacio: también se borra de ahí.');
  });
});
