// Calendario de Notas Digitales (funciones puras)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as cal from '../services/notasDigitalesCalendario.js';

describe('hoyArgentina', () => {
  it('usa la fecha de Argentina aunque en UTC ya sea el día siguiente', () => {
    assert.equal(cal.hoyArgentina(new Date('2026-11-02T02:00:00Z')), '2026-11-01');
    assert.equal(cal.hoyArgentina(new Date('2026-11-02T11:00:00Z')), '2026-11-02');
  });

  it('no depende del formato de texto de un idioma (un Node con small-icu no tiene en-CA)', () => {
    // Cualquier idioma pedido se resuelve como alemán (02.11.2026): el resultado tiene que seguir siendo AAAA-MM-DD
    const Original = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function DateTimeFormat(_idioma, opciones) { return new Original('de-DE', opciones); };
    try {
      assert.equal(cal.hoyArgentina(new Date('2026-11-02T11:00:00Z')), '2026-11-02');
      assert.equal(cal.ahoraArgentina(new Date('2026-11-02T11:05:09Z')), '2026-11-02 08:05:09');
    } finally {
      Intl.DateTimeFormat = Original;
    }
  });
});

describe('esFechaIso', () => {
  it('acepta solo AAAA-MM-DD de un día que existe', () => {
    assert.equal(cal.esFechaIso('2026-11-02'), true);
    assert.equal(cal.esFechaIso('2028-02-29'), true);
    for (const valor of ['11/02/2026', '2026-11-2', '2026-13-01', '2026-02-30', '2026-11-02 08:00', '', null, undefined, 20261102]) {
      assert.equal(cal.esFechaIso(valor), false, String(valor));
    }
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

describe('rangoDeAviso (spec 2026-10-15-dias-habiles-licencias-auditoria, 4.2)', () => {
  it('un día hábil seguido de otro hábil avisa solo su día + 40', () => {
    // miércoles 14/10/2026
    assert.deepEqual(cal.rangoDeAviso('2026-10-14', 40), { desde: '2026-11-23', hasta: '2026-11-23' });
  });

  it('un viernes avisa también lo del sábado y el domingo', () => {
    assert.deepEqual(cal.rangoDeAviso('2026-10-16', 40), { desde: '2026-11-25', hasta: '2026-11-27' });
  });

  it('el día antes de un feriado avisa también el del feriado', () => {
    // lunes 07/12/2026; el martes 08/12 es feriado
    assert.deepEqual(cal.rangoDeAviso('2026-12-07', 40), { desde: '2027-01-16', hasta: '2027-01-17' });
  });

  it('antes de un feriado pegado a un fin de semana avisa los cuatro días', () => {
    // jueves 24/12/2026; viernes 25 feriado, sábado y domingo
    assert.deepEqual(cal.rangoDeAviso('2026-12-24', 40), { desde: '2027-02-02', hasta: '2027-02-05' });
  });

  it('un día no hábil no avisa nada', () => {
    for (const fecha of ['2026-10-17', '2026-10-18', '2026-12-08', '2026-12-25', '2027-01-01']) {
      assert.equal(cal.rangoDeAviso(fecha, 40), null, fecha);
    }
  });

  it('los días hábiles seguidos cubren todos los vencimientos, sin huecos ni repetidos', () => {
    let anterior = null;
    for (let fecha = '2026-10-01'; fecha <= '2027-12-31'; fecha = cal.sumarDias(fecha, 1)) {
      const rango = cal.rangoDeAviso(fecha, 40);
      if (!rango) continue;
      assert.ok(rango.desde <= rango.hasta, fecha);
      if (anterior) assert.equal(rango.desde, cal.sumarDias(anterior.hasta, 1), `${fecha} sigue a ${anterior.hasta}`);
      anterior = rango;
    }
  });
});

describe('ultimoDiaHabilHasta', () => {
  it('un día hábil es su propio último día hábil; un fin de semana o feriado va al anterior', () => {
    assert.equal(cal.ultimoDiaHabilHasta('2027-01-14'), '2027-01-14');
    assert.equal(cal.ultimoDiaHabilHasta('2027-01-24'), '2027-01-22');
    assert.equal(cal.ultimoDiaHabilHasta('2027-01-01'), '2026-12-31');
  });
});

describe('textoRangoMeses', () => {
  it('un mes, meses del mismo año y meses de dos años', () => {
    assert.equal(cal.textoRangoMeses('2027-01-20', '2027-01-31'), 'enero 2027');
    assert.equal(cal.textoRangoMeses('2027-01-20', '2027-03-31'), 'enero a marzo 2027');
    assert.equal(cal.textoRangoMeses('2026-12-15', '2027-02-10'), 'diciembre 2026 a febrero 2027');
  });
});

describe('diasHabilesTranscurridos (spec 2026-10-15-dias-habiles-licencias-auditoria, 10.3)', () => {
  it('cuenta los días hábiles después de la primera fecha, hasta la segunda inclusive', () => {
    // viernes 16/10/2026 → lunes 19/10: el fin de semana no cuenta
    assert.equal(cal.diasHabilesTranscurridos('2026-10-16', '2026-10-19'), 1);
    assert.equal(cal.diasHabilesTranscurridos('2026-10-19', '2026-10-26'), 5);
    assert.equal(cal.diasHabilesTranscurridos('2026-10-17', '2026-10-19'), 1);
    assert.equal(cal.diasHabilesTranscurridos('2026-10-16', '2026-10-16'), 0);
    assert.equal(cal.diasHabilesTranscurridos('2026-10-19', '2026-10-16'), 0);
  });

  it('los feriados fijos no cuentan; los trasladables sí', () => {
    // lunes 07/12/2026 → lunes 14/12: el martes 08/12 es feriado
    assert.equal(cal.diasHabilesTranscurridos('2026-12-07', '2026-12-14'), 4);
    // jueves 24/12/2026 → jueves 31/12: el 25/12 es feriado y el 26 y el 27, fin de semana
    assert.equal(cal.diasHabilesTranscurridos('2026-12-24', '2026-12-31'), 4);
    // miércoles 07/10/2026 → lunes 19/10: el lunes 12/10 (trasladable) cuenta
    assert.equal(cal.diasHabilesTranscurridos('2026-10-07', '2026-10-19'), 8);
  });
});

describe('sumarDiasHabiles', () => {
  it('avanza n días hábiles, salteando fines de semana y feriados fijos', () => {
    assert.equal(cal.sumarDiasHabiles('2026-10-19', 5), '2026-10-26');
    assert.equal(cal.sumarDiasHabiles('2026-10-16', 1), '2026-10-19');
    assert.equal(cal.sumarDiasHabiles('2026-12-07', 5), '2026-12-15');
    // 24/03/2027 es feriado: del lunes 22/03 son 23, 25, 26, 29 y 30
    assert.equal(cal.sumarDiasHabiles('2027-03-22', 5), '2027-03-30');
    // 25/12, el fin de semana y el 01/01: del jueves 24/12/2026, el quinto es el lunes 04/01/2027
    assert.equal(cal.sumarDiasHabiles('2026-12-24', 5), '2027-01-04');
    assert.equal(cal.sumarDiasHabiles('2026-10-17', 0), '2026-10-17');
  });

  it('es la inversa de diasHabilesTranscurridos', () => {
    for (const desde of ['2026-10-16', '2026-12-07', '2026-12-24', '2027-03-22']) {
      for (const n of [1, 5, 12]) {
        assert.equal(cal.diasHabilesTranscurridos(desde, cal.sumarDiasHabiles(desde, n)), n, `${desde} + ${n}`);
      }
    }
  });
});
