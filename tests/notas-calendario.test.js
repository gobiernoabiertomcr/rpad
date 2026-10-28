// Calendario de Notas Digitales (funciones puras)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as cal from '../services/notasDigitalesCalendario.js';
import * as antes from './fixtures/calendario-fijo-de-antes.js';

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

// La ventana del aviso vive acá, una sola vez (Ruling 30): la reexportan las Notas Digitales y la usan Métricas y la Agenda de pedidos
describe('VENTANA_DIAS', () => {
  it('40 días corridos en gestión externa y 60 en interna, congelada', () => {
    assert.deepEqual(cal.VENTANA_DIAS, { interna: 60, externa: 40 });
    assert.ok(Object.isFrozen(cal.VENTANA_DIAS));
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

// Las derivadas se escriben una sola vez, sobre un predicado (derivadasDe), con un tope de 366 vueltas en cada búsqueda de un
// día hábil. Los nombres de siempre salen de CALENDARIO_FIJO, el calendario de los 9 fijos, y tienen que dar lo mismo que la
// copia de antes (tests/fixtures/calendario-fijo-de-antes.js) en toda entrada en la que esa copia termina
describe('las derivadas sobre un predicado (spec 2026-10-27-feriados-en-notas, 1)', () => {
  // El valor, o la clase del error que tira
  const resultado = (fn) => { try { return { valor: fn() }; } catch (e) { return { tira: e.constructor.name }; } };
  const RAROS = ['abc', '', '2026-02-30', '2026-13-01', null, undefined, 3, '2026-2-3', '9999-12-31'];
  // Con '9999-12-31', la copia de antes no termina en rangoDeAviso, en sumarDiasHabiles con n ≥ 1 ni en
  // diasHabilesTranscurridos(r, '2026-01-10'): ese borde lo fija «donde la copia de antes no termina, tira RangeError»
  const RAROS_QUE_TERMINAN = RAROS.filter((r) => r !== '9999-12-31');
  const DIAS = [];
  for (let dia = '2024-12-25'; dia <= '2029-01-07'; dia = antes.sumarDias(dia, 1)) DIAS.push(dia);
  const PERIODOS = [];
  for (let anio = 2025; anio <= 2028; anio++) {
    for (let mes = 1; mes <= 12; mes++) PERIODOS.push(`${anio}-${String(mes).padStart(2, '0')}`);
  }

  // Cada llamada de los recorridos: [nombre de la función, argumentos]
  const LLAMADAS = [];
  for (const nombre of ['esDiaHabil', 'proximoDiaHabil', 'diaHabilAnterior', 'ultimoDiaHabilHasta']) {
    for (const e of [...DIAS, ...RAROS]) LLAMADAS.push([nombre, [e]]);
  }
  for (const e of [...DIAS, ...RAROS_QUE_TERMINAN]) {
    for (const d of [0, 40, 60]) LLAMADAS.push(['rangoDeAviso', [e, d]]);
    for (const n of [1, 2, 5]) LLAMADAS.push(['sumarDiasHabiles', [e, n]]);
  }
  for (const e of [...DIAS, ...RAROS]) LLAMADAS.push(['sumarDiasHabiles', [e, 0]]);
  for (const p of [...PERIODOS, ...RAROS]) LLAMADAS.push(['primerDiaHabilDelMes', [p]]);
  for (const d of DIAS) {
    for (const k of [-1, 0, 1, 7, 30, 400]) LLAMADAS.push(['diasHabilesTranscurridos', [d, antes.sumarDias(d, k)]]);
  }
  for (const r of RAROS_QUE_TERMINAN) LLAMADAS.push(['diasHabilesTranscurridos', [r, '2026-01-10']]);
  // No con 'abc': la copia de antes no termina (un hasta mayor que toda fecha)
  for (const h of ['', null, undefined, 3, '2026-02-30', '2026-2-3']) LLAMADAS.push(['diasHabilesTranscurridos', ['2026-01-01', h]]);

  const textoDe = (nombre, argumentos) => `${nombre}(${argumentos.map((a) => JSON.stringify(a) ?? 'undefined').join(', ')})`;

  it('los nombres de siempre y CALENDARIO_FIJO dan lo mismo que la copia de antes, del 2025 al 2028 y con entradas raras', () => {
    for (const [nombre, argumentos] of LLAMADAS) {
      const esperado = resultado(() => antes[nombre](...argumentos));
      assert.deepEqual(resultado(() => cal[nombre](...argumentos)), esperado, textoDe(nombre, argumentos));
      assert.deepEqual(resultado(() => cal.CALENDARIO_FIJO[nombre](...argumentos)), esperado, `CALENDARIO_FIJO.${textoDe(nombre, argumentos)}`);
    }
  });

  it('CALENDARIO_FIJO', () => {
    assert.equal(cal.CALENDARIO_FIJO.esDiaHabil, cal.esDiaHabil);
    assert.equal(cal.CALENDARIO_FIJO.origen, 'fijos');
    assert.equal(cal.CALENDARIO_FIJO.error, null);
    assert.ok(Object.isFrozen(cal.CALENDARIO_FIJO));
    assert.equal(cal.TOPE_DE_VUELTAS, 366);
  });

  it('donde la copia de antes no termina, tira RangeError', () => {
    // Después del 31/12/9999, sumarDias da '+010000-01' y desde ahí siempre lo mismo (el 01/01/10000 es sábado)
    for (const calendario of [cal, cal.CALENDARIO_FIJO]) {
      for (const d of [0, 40, 60]) assert.throws(() => calendario.rangoDeAviso('9999-12-31', d), RangeError);
      for (const n of [1, 2, 5]) assert.throws(() => calendario.sumarDiasHabiles('9999-12-31', n), RangeError);
      // La fecha deja de ser 'AAAA-MM-DD'
      assert.throws(() => calendario.diasHabilesTranscurridos('9999-12-31', '2026-01-10'), RangeError);
      assert.throws(() => calendario.diasHabilesTranscurridos('9999-12-31', '9999-12-31'), RangeError);
      // Un hasta mayor que toda fecha
      assert.throws(() => calendario.diasHabilesTranscurridos('2026-01-01', 'abc'), RangeError);
    }
  });

  it('el tope de 366 vueltas', () => {
    const conTodo = (hasta) => {
      const todo = new Set();
      for (let dia = '2026-01-01'; dia <= hasta; dia = cal.sumarDias(dia, 1)) todo.add(dia);
      return cal.derivadasDe((f) => cal.esDiaHabil(f) && !todo.has(f));
    };
    const t = conTodo('2027-01-31');
    const delTope = (e) => e instanceof RangeError && /366/.test(e.message);
    // Del 01/01/2026, la fecha y los 365 días que siguen llegan al 01/01/2027: ninguno es hábil
    assert.throws(() => t.proximoDiaHabil('2026-01-01'), delTope);
    // Los 366 anteriores al 01/02/2027 llegan al 31/01/2026
    assert.throws(() => t.diaHabilAnterior('2027-02-01'), delTope);
    assert.throws(() => t.primerDiaHabilDelMes('2026-01'), delTope);
    assert.throws(() => t.sumarDiasHabiles('2025-12-31', 1), delTope);
    // Con todo hasta el 30/12/2026, el jueves 31/12 está a 364 días: se encuentra
    assert.equal(conTodo('2026-12-30').proximoDiaHabil('2026-01-01'), '2026-12-31');
  });
});
