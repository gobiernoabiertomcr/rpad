// Los feriados (spec 2026-10-26-feriados, secciones 1, 2 y 7): contar días hábiles con los feriados de la tabla, sin
// cambiar esDiaHabil ni FERIADOS_FIJOS. Puras, sin base.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPOS_FERIADO, NOMBRES_TIPO_FERIADO, NOMBRES_DE_LOS_FIJOS,
  diaDeLaSemana, fechaEnElAnio, feriadosDelRango, esDiaHabilCon, diasHabilesDe, diasHabilesEntre
} from '../services/feriadosReglas.js';
import { FERIADOS_FIJOS, esDiaHabil } from '../services/notasDigitalesCalendario.js';

// Los 9 fijos de hoy, escritos a mano: el oráculo no lee FERIADOS_FIJOS
const FIJOS_LITERALES = ['01-01', '03-24', '04-02', '05-01', '05-25', '06-20', '07-09', '12-08', '12-25'];

// Los 730 días de 2026 y 2027, armados con Date.UTC (sin las funciones del calendario), con lo que dice el oráculo
const DIAS_DE_2026_Y_2027 = (() => {
  const dias = [];
  for (let ms = Date.UTC(2026, 0, 1); ms <= Date.UTC(2027, 11, 31); ms += 86400000) {
    const fecha = new Date(ms);
    const anio = fecha.getUTCFullYear();
    const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getUTCDate()).padStart(2, '0');
    const diaSemana = fecha.getUTCDay();
    const habil = diaSemana !== 0 && diaSemana !== 6 && !FIJOS_LITERALES.includes(`${mes}-${dia}`);
    dias.push({ fecha: `${anio}-${mes}-${dia}`, anio, habil });
  }
  return dias;
})();

// Una fila de la base, como la devuelve services/feriadosDatos.js (datos inventados)
const fila = (datos) => ({
  id: 1, fecha: '2026-02-16', nombre: 'Feriado', tipo: 'nacional', trasladado_de: null, se_repite: 0, hasta_anio: null,
  activo: 1, no_rige: [], ...datos
});

const CARNAVAL_2026 = [
  fila({ id: 1, fecha: '2026-02-16', nombre: 'Carnaval' }),
  fila({ id: 2, fecha: '2026-02-17', nombre: 'Carnaval' })
];
const ANIVERSARIO = fila({ id: 3, fecha: '2026-02-23', nombre: 'Aniversario de la ciudad', tipo: 'municipal', se_repite: 1 });

const ordenado = (conjunto) => [...conjunto].sort();

describe('esDiaHabil no cambia', () => {
  it('esDiaHabil no cambia: 730 días de 2026 y 2027 contra un oráculo', () => {
    assert.equal(DIAS_DE_2026_Y_2027.length, 730);
    const totales = { 2026: 0, 2027: 0 };
    for (const { fecha, anio, habil } of DIAS_DE_2026_Y_2027) {
      assert.equal(esDiaHabil(fecha), habil, fecha);
      if (habil) totales[anio]++;
    }
    assert.deepEqual(totales, { 2026: 253, 2027: 255 });
  });

  it('con un Set vacío, esDiaHabilCon es esDiaHabil', () => {
    for (const { fecha } of DIAS_DE_2026_Y_2027) {
      assert.equal(esDiaHabilCon(fecha, new Set()), esDiaHabil(fecha), fecha);
    }
  });

  it('los feriados solo sacan días: nunca vuelven hábil un día que esDiaHabil no cuenta', () => {
    const todos = new Set(DIAS_DE_2026_Y_2027.map(({ fecha }) => fecha));
    const conLosFeriados = feriadosDelRango([...CARNAVAL_2026, ANIVERSARIO], '2026-01-01', '2027-12-31');
    for (const { fecha } of DIAS_DE_2026_Y_2027) {
      assert.equal(esDiaHabilCon(fecha, todos), false, fecha);
      if (esDiaHabilCon(fecha, conLosFeriados)) assert.equal(esDiaHabil(fecha), true, fecha);
    }
  });
});

describe('las constantes', () => {
  it('TIPOS_FERIADO son los 4 tipos, congelados', () => {
    assert.deepEqual([...TIPOS_FERIADO], ['nacional', 'provincial', 'municipal', 'no_laborable']);
    assert.equal(Object.isFrozen(TIPOS_FERIADO), true);
  });

  it('NOMBRES_TIPO_FERIADO dice cómo se muestra cada tipo', () => {
    assert.deepEqual({ ...NOMBRES_TIPO_FERIADO }, {
      nacional: 'Nacional', provincial: 'De Chubut', municipal: 'De Comodoro', no_laborable: 'No laborable'
    });
    assert.deepEqual(Object.keys(NOMBRES_TIPO_FERIADO), [...TIPOS_FERIADO]);
    assert.equal(Object.isFrozen(NOMBRES_TIPO_FERIADO), true);
  });

  it('NOMBRES_DE_LOS_FIJOS tiene las claves de FERIADOS_FIJOS', () => {
    assert.deepEqual(Object.keys(NOMBRES_DE_LOS_FIJOS), [...FERIADOS_FIJOS]);
    assert.deepEqual({ ...NOMBRES_DE_LOS_FIJOS }, {
      '01-01': 'Año Nuevo',
      '03-24': 'Día Nacional de la Memoria por la Verdad y la Justicia',
      '04-02': 'Día del Veterano y de los Caídos en la Guerra de Malvinas',
      '05-01': 'Día del Trabajador',
      '05-25': 'Día de la Revolución de Mayo',
      '06-20': 'Paso a la Inmortalidad del General Manuel Belgrano',
      '07-09': 'Día de la Independencia',
      '12-08': 'Inmaculada Concepción de María',
      '12-25': 'Navidad'
    });
    assert.equal(Object.isFrozen(NOMBRES_DE_LOS_FIJOS), true);
  });
});

describe('diaDeLaSemana', () => {
  it('da el día de la semana, en minúscula y con tilde', () => {
    assert.equal(diaDeLaSemana('2026-10-26'), 'lunes');
    assert.equal(diaDeLaSemana('2026-11-08'), 'domingo');
    const semana = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
    assert.deepEqual(semana.map(diaDeLaSemana), ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']);
  });

  it('un año de 0 a 99 no se toma como 19xx: el calendario se repite cada 400 años', () => {
    assert.equal(diaDeLaSemana('2050-01-01'), 'sábado');
    assert.equal(diaDeLaSemana('0050-01-01'), diaDeLaSemana('2050-01-01'));
    assert.equal(diaDeLaSemana('0026-10-26'), diaDeLaSemana('2426-10-26'));
  });

  it('una fecha que no existe o que no es un texto AAAA-MM-DD da null', () => {
    assert.equal(diaDeLaSemana('2026-02-30'), null);
    for (const valor of ['2026-2-3', 20260203, null, undefined, '', 'hola', {}, []]) {
      assert.equal(diaDeLaSemana(valor), null, String(valor));
    }
  });
});

describe('fechaEnElAnio', () => {
  const QUE_SE_REPITE = fila({ fecha: '2026-02-23', se_repite: 1, hasta_anio: null, no_rige: [2027], activo: 1 });

  it('uno que se repite rige desde su año, sin los años en que no rige', () => {
    assert.equal(fechaEnElAnio(QUE_SE_REPITE, 2026), '2026-02-23');
    assert.equal(fechaEnElAnio(QUE_SE_REPITE, 2028), '2028-02-23');
    assert.equal(fechaEnElAnio(QUE_SE_REPITE, 2027), null);
    assert.equal(fechaEnElAnio(QUE_SE_REPITE, 2025), null);
  });

  it('con hasta_anio, no rige después de ese año', () => {
    const hasta2027 = { ...QUE_SE_REPITE, hasta_anio: 2027, no_rige: [] };
    assert.equal(fechaEnElAnio(hasta2027, 2027), '2027-02-23');
    assert.equal(fechaEnElAnio(hasta2027, 2028), null);
  });

  it('una fila dada de baja nunca rige', () => {
    assert.equal(fechaEnElAnio({ ...QUE_SE_REPITE, activo: 0 }, 2026), null);
    assert.equal(fechaEnElAnio({ ...QUE_SE_REPITE, activo: 0 }, 2028), null);
    assert.equal(fechaEnElAnio(fila({ fecha: '2026-02-16', activo: 0 }), 2026), null);
  });

  it('sin se_repite, da la fecha solo en su año', () => {
    const carnaval = fila({ fecha: '2026-02-16', se_repite: 0 });
    assert.equal(fechaEnElAnio(carnaval, 2026), '2026-02-16');
    assert.equal(fechaEnElAnio(carnaval, 2027), null);
    assert.equal(fechaEnElAnio(carnaval, 2025), null);
    // hasta_anio y no_rige son solo de los que se repiten
    assert.equal(fechaEnElAnio({ ...carnaval, no_rige: [2026], hasta_anio: 2020 }, 2026), '2026-02-16');
  });

  it('si el día no existe ese año, da null', () => {
    const del29 = fila({ fecha: '2028-02-29', se_repite: 1 });
    assert.equal(fechaEnElAnio(del29, 2028), '2028-02-29');
    assert.equal(fechaEnElAnio(del29, 2029), null);
    assert.equal(fechaEnElAnio(del29, 2032), '2032-02-29');
  });

  it('una fila o un año que no sirven dan null', () => {
    for (const malo of [null, undefined, 'hola', 20260223, [], fila({ fecha: '2026-02-30' }), fila({ fecha: null })]) {
      assert.equal(fechaEnElAnio(malo, 2026), null, JSON.stringify(malo));
    }
    for (const anio of ['2026', 2026.5, NaN, null, undefined, -2026, 20260]) {
      assert.equal(fechaEnElAnio(QUE_SE_REPITE, anio), null, String(anio));
    }
  });
});

describe('feriadosDelRango', () => {
  it('suma los fijos, los de un año y los que se repiten, recortados al rango', () => {
    const feriados = feriadosDelRango([...CARNAVAL_2026, ANIVERSARIO], '2026-02-01', '2026-03-31');
    assert.equal(feriados instanceof Set, true);
    assert.deepEqual(ordenado(feriados), ['2026-02-16', '2026-02-17', '2026-02-23', '2026-03-24']);
  });

  it('un rango que cruza el año suma los fijos de los dos años', () => {
    assert.deepEqual(ordenado(feriadosDelRango([], '2026-12-01', '2027-01-31')), ['2026-12-08', '2026-12-25', '2027-01-01']);
    assert.deepEqual(
      ordenado(feriadosDelRango([ANIVERSARIO], '2026-12-20', '2027-02-28')),
      ['2026-12-25', '2027-01-01', '2027-02-23']
    );
  });

  it('los bordes del rango cuentan', () => {
    assert.deepEqual(ordenado(feriadosDelRango(CARNAVAL_2026, '2026-02-16', '2026-02-16')), ['2026-02-16']);
    assert.deepEqual(ordenado(feriadosDelRango(CARNAVAL_2026, '2026-02-17', '2026-03-24')), ['2026-02-17', '2026-03-24']);
  });

  it('uno que se repite no va hacia atrás, para en hasta_anio y salta los años en que no rige', () => {
    const repite = fila({ fecha: '2027-02-23', se_repite: 1, hasta_anio: 2030, no_rige: [2028] });
    assert.deepEqual(
      ordenado(feriadosDelRango([repite], '2026-02-01', '2031-02-28')).filter((f) => f.endsWith('-02-23')),
      ['2027-02-23', '2029-02-23', '2030-02-23']
    );
  });

  it('un dado de baja no cuenta', () => {
    const deBaja = CARNAVAL_2026.map((f) => ({ ...f, activo: 0 }));
    assert.deepEqual(ordenado(feriadosDelRango([...deBaja, { ...ANIVERSARIO, activo: 0 }], '2026-02-01', '2026-03-31')),
      ['2026-03-24']);
  });

  it('dos feriados el mismo día cuentan una vez', () => {
    // El Jueves Santo de 2026 cae el 2/4, el mismo día que Malvinas
    const juevesSanto = fila({ fecha: '2026-04-02', nombre: 'Jueves Santo', tipo: 'no_laborable' });
    const viernesSanto = fila({ fecha: '2026-04-03', nombre: 'Viernes Santo' });
    const feriados = feriadosDelRango([juevesSanto, viernesSanto, { ...viernesSanto, id: 9 }], '2026-03-30', '2026-04-05');
    assert.deepEqual(ordenado(feriados), ['2026-04-02', '2026-04-03']);
    assert.equal(diasHabilesEntre('2026-03-30', '2026-04-03', feriados), 3);
  });

  it('con una fecha inválida o el rango al revés, un Set vacío', () => {
    for (const [desde, hasta] of [
      ['2026-02-30', '2026-03-31'], ['2026-02-01', '2026-2-3'], [null, '2026-03-31'], ['2026-02-01', 20260331],
      [undefined, undefined], ['2026-03-31', '2026-02-01']
    ]) {
      const feriados = feriadosDelRango(CARNAVAL_2026, desde, hasta);
      assert.equal(feriados instanceof Set, true);
      assert.equal(feriados.size, 0, `${desde} ${hasta}`);
    }
  });

  it('sin una lista de filas, solo los fijos; una fila que no sirve se saltea', () => {
    for (const filas of [null, undefined, 'hola', {}]) {
      assert.deepEqual(ordenado(feriadosDelRango(filas, '2026-02-01', '2026-03-31')), ['2026-03-24']);
    }
    assert.deepEqual(ordenado(feriadosDelRango([null, 'hola', 3, CARNAVAL_2026[0]], '2026-02-01', '2026-03-31')),
      ['2026-02-16', '2026-03-24']);
  });
});

describe('diasHabilesEntre y diasHabilesDe', () => {
  it('del lunes 16/02/2026 al viernes 20/02/2026, con Carnaval, da 3', () => {
    const feriados = feriadosDelRango(CARNAVAL_2026, '2026-02-16', '2026-02-20');
    assert.equal(diasHabilesEntre('2026-02-16', '2026-02-20', feriados), 3);
    assert.deepEqual(diasHabilesDe('2026-02-16', '2026-02-20', feriados), ['2026-02-18', '2026-02-19', '2026-02-20']);
  });

  it('del lunes 26/10/2026 al lunes 02/11/2026, sin feriados, da 6', () => {
    assert.equal(diasHabilesEntre('2026-10-26', '2026-11-02', new Set()), 6);
    assert.equal(diasHabilesEntre('2026-10-26', '2026-11-02', undefined), 6);
  });

  it('del sábado 31/10 al domingo 01/11, da 0', () => {
    assert.equal(diasHabilesEntre('2026-10-31', '2026-11-01', new Set()), 0);
    assert.deepEqual(diasHabilesDe('2026-10-31', '2026-11-01', new Set()), []);
  });

  it('del 30/12/2026 al 04/01/2027 da 3 (el 01/01 es fijo)', () => {
    assert.equal(diasHabilesEntre('2026-12-30', '2027-01-04', new Set()), 3);
    assert.deepEqual(diasHabilesDe('2026-12-30', '2027-01-04', new Set()), ['2026-12-30', '2026-12-31', '2027-01-04']);
    const feriados = feriadosDelRango([], '2026-12-30', '2027-01-04');
    assert.deepEqual(diasHabilesDe('2026-12-30', '2027-01-04', feriados), ['2026-12-30', '2026-12-31', '2027-01-04']);
  });

  it('cuentan los dos días: el mismo día hábil da 1', () => {
    assert.equal(diasHabilesEntre('2026-10-26', '2026-10-26', new Set()), 1);
    assert.equal(diasHabilesEntre('2026-10-26', '2026-10-26', new Set(['2026-10-26'])), 0);
  });

  it('con hasta anterior a desde, [] y 0', () => {
    assert.deepEqual(diasHabilesDe('2026-11-02', '2026-10-26', new Set()), []);
    assert.equal(diasHabilesEntre('2026-11-02', '2026-10-26', new Set()), 0);
  });

  it('un rango que llega al 31/12/9999 termina', () => {
    // El 31/12/9999 es viernes: del lunes 27 al viernes 31 son 5 (el 25 queda afuera)
    assert.deepEqual(diasHabilesDe('9999-12-27', '9999-12-31', new Set()),
      ['9999-12-27', '9999-12-28', '9999-12-29', '9999-12-30', '9999-12-31']);
    assert.deepEqual(ordenado(feriadosDelRango([], '9999-12-01', '9999-12-31')), ['9999-12-08', '9999-12-25']);
  });

  it('en 2026 y 2027, sin feriados, son los 253 y 255 de esDiaHabil', () => {
    assert.equal(diasHabilesEntre('2026-01-01', '2026-12-31', new Set()), 253);
    assert.equal(diasHabilesEntre('2027-01-01', '2027-12-31', new Set()), 255);
    assert.equal(diasHabilesEntre('2026-01-01', '2026-12-31', feriadosDelRango([], '2026-01-01', '2026-12-31')), 253);
  });
});

describe('fechas que no son fechas', () => {
  it('fechas que no son fechas', () => {
    assert.equal(esDiaHabilCon('hola', new Set()), false);
    assert.equal(diasHabilesEntre('2026-02-30', '2026-03-02', new Set()), 0);
    const malas = ['hola', '2026-02-30', '2026-2-3', 20260203, null, undefined, '', {}, []];
    for (const mala of malas) {
      assert.doesNotThrow(() => {
        assert.equal(esDiaHabilCon(mala, new Set()), false, String(mala));
        assert.equal(esDiaHabilCon(mala, undefined), false, String(mala));
        assert.deepEqual(diasHabilesDe(mala, '2026-03-02', new Set()), []);
        assert.deepEqual(diasHabilesDe('2026-03-02', mala, new Set()), []);
        assert.equal(diasHabilesEntre(mala, '2026-03-02', new Set()), 0);
        assert.equal(diasHabilesEntre('2026-03-02', mala, null), 0);
        assert.equal(feriadosDelRango([mala], mala, mala).size, 0);
        assert.equal(diaDeLaSemana(mala), null);
        assert.equal(fechaEnElAnio(fila({ fecha: mala }), 2026), null);
      }, String(mala));
    }
  });

  it('un segundo parámetro que no es un Set no saca días', () => {
    for (const feriados of [null, undefined, ['2026-10-26'], { '2026-10-26': true }, '2026-10-26']) {
      assert.equal(esDiaHabilCon('2026-10-26', feriados), true, String(feriados));
    }
  });
});

describe('FERIADOS_FIJOS', () => {
  it('FERIADOS_FIJOS sigue igual', () => {
    // Todo lo del módulo, una vez más, antes de mirarlo
    const filas = [...CARNAVAL_2026, ANIVERSARIO];
    const feriados = feriadosDelRango(filas, '2025-01-01', '2027-12-31');
    feriados.add('2026-10-26');
    feriados.clear();
    diasHabilesDe('2025-01-01', '2027-12-31', feriadosDelRango(filas, '2025-01-01', '2027-12-31'));
    diasHabilesEntre('2026-01-01', '2026-12-31', new Set());
    esDiaHabilCon('2026-10-26', new Set());
    fechaEnElAnio(ANIVERSARIO, 2027);
    diaDeLaSemana('2026-10-26');
    assert.deepEqual(FERIADOS_FIJOS, ['01-01', '03-24', '04-02', '05-01', '05-25', '06-20', '07-09', '12-08', '12-25']);
    assert.deepEqual(FERIADOS_FIJOS, FIJOS_LITERALES);
  });
});
