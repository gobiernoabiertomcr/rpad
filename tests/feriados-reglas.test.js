// Los feriados (spec 2026-10-26-feriados, secciones 1 a 4 y 7): contar días hábiles con los feriados de la tabla, sin
// cambiar esDiaHabil ni FERIADOS_FIJOS, y validar y listar los feriados de un año para la pestaña y la API. Puras, sin base.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPOS_FERIADO, NOMBRES_TIPO_FERIADO, NOMBRES_DE_LOS_FIJOS,
  diaDeLaSemana, fechaEnElAnio, feriadosDelRango, esDiaHabilCon, diasHabilesDe, diasHabilesEntre,
  proximoDiaHabilCon, restarDiasHabilesCon, ultimoDiaHabilDelMesCon, fechasDelFeriado, fechasQueCambianDiasHabiles,
  MENSAJES_FERIADO, FECHA_MINIMA_FERIADO, LARGO_NOMBRE_FERIADO,
  validarFeriado, validarRige, bajaDesde, errorDeLaCorreccion, feriadosDelAnio, avisosDeLaFecha, aniosDelSelector,
  calendarioCon, MENSAJE_CORRIDA_SIN_FERIADOS, MENSAJE_ESTADO_SIN_FERIADOS,
  MENSAJE_METRICAS_SIN_FERIADOS, exigirLaTabla, feriadosDelCalendario, calendarioDeFechas
} from '../services/feriadosReglas.js';
import { FERIADOS_FIJOS, esDiaHabil, CALENDARIO_FIJO, sumarDias } from '../services/notasDigitalesCalendario.js';
import { FILAS_PRECARGA } from './fixtures/feriados-precarga.js';

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

// Las fechas en que rige un feriado en un rango de años, para contar las licencias de Mi espacio que lo incluyen (decisión del
// usuario, 26/10/2026: uno que se repite cuenta todos los años en que rige)
describe('fechasDelFeriado', () => {
  const DESDE_2026 = fila({ fecha: '2026-12-13', se_repite: 1 });

  it('uno que se repite desde 2026, de 2024 a 2027: las de 2026 y 2027 (no hacia atrás)', () => {
    assert.deepEqual(fechasDelFeriado(DESDE_2026, 2024, 2027), ['2026-12-13', '2027-12-13']);
    assert.deepEqual(fechasDelFeriado(DESDE_2026, 2027, 2029), ['2027-12-13', '2028-12-13', '2029-12-13']);
    assert.deepEqual(fechasDelFeriado(DESDE_2026, 2024, 2025), []);
  });

  it('con hasta_anio 2026, solo la de 2026; con no_rige [2027], tampoco la de 2027', () => {
    assert.deepEqual(fechasDelFeriado({ ...DESDE_2026, hasta_anio: 2026 }, 2024, 2027), ['2026-12-13']);
    assert.deepEqual(fechasDelFeriado({ ...DESDE_2026, no_rige: [2027] }, 2024, 2027), ['2026-12-13']);
    assert.deepEqual(fechasDelFeriado({ ...DESDE_2026, no_rige: [2027] }, 2024, 2028), ['2026-12-13', '2028-12-13']);
  });

  it('uno que no se repite: su fecha, si cae en el rango', () => {
    const deUnAnio = { ...DESDE_2026, se_repite: 0 };
    assert.deepEqual(fechasDelFeriado(deUnAnio, 2024, 2027), ['2026-12-13']);
    assert.deepEqual(fechasDelFeriado(deUnAnio, 2026, 2026), ['2026-12-13']);
    assert.deepEqual(fechasDelFeriado(deUnAnio, 2027, 2028), []);
    assert.deepEqual(fechasDelFeriado(deUnAnio, 2024, 2025), []);
  });

  it('un 29/02 que se repite saltea los años sin 29/02', () => {
    assert.deepEqual(fechasDelFeriado(fila({ fecha: '2028-02-29', se_repite: 1 }), 2027, 2033), ['2028-02-29', '2032-02-29']);
  });

  it('una dada de baja no rige ningún año', () => {
    assert.deepEqual(fechasDelFeriado({ ...DESDE_2026, activo: 0 }, 2024, 2027), []);
  });

  it('con una entrada inválida, []', () => {
    for (const mala of [null, undefined, 'hola', 3, [], {}, fila({ fecha: '2026-02-30' })]) {
      assert.deepEqual(fechasDelFeriado(mala, 2024, 2027), [], JSON.stringify(mala));
    }
    for (const [desde, hasta] of [[2027, 2026], ['2024', 2027], [2024, '2027'], [2024.5, 2027], [null, 2027], [2024, NaN],
      [undefined, undefined]]) {
      assert.deepEqual(fechasDelFeriado(DESDE_2026, desde, hasta), [], `${desde} ${hasta}`);
    }
  });

  it('un rango enorme no se recorre fuera de los años que existen', () => {
    assert.deepEqual(fechasDelFeriado({ ...DESDE_2026, se_repite: 0 }, -1e9, 1e9), ['2026-12-13']);
    assert.deepEqual(fechasDelFeriado(fila({ fecha: '9998-12-13', se_repite: 1 }), 9990, 1e9), ['9998-12-13', '9999-12-13']);
  });
});

// Las fechas en que un feriado cambia de verdad un día hábil (decisión del usuario, 27/10/2026): solo por ellas el modal cuenta
// las licencias de Mi espacio que lo incluyen
describe('fechasQueCambianDiasHabiles', () => {
  it('un sábado o un domingo no cambia ningún día hábil; un lunes, sí', () => {
    assert.deepEqual(fechasQueCambianDiasHabiles(fila({ fecha: '2026-10-31' }), 2026, 2026, []), []);
    assert.deepEqual(fechasQueCambianDiasHabiles(fila({ fecha: '2026-11-01' }), 2026, 2026, []), []);
    assert.deepEqual(fechasQueCambianDiasHabiles(fila({ fecha: '2026-11-02' }), 2026, 2026, []), ['2026-11-02']);
  });

  it('el mismo día que uno de los 9 fijos (el viernes 25/12/2026) no cambia nada', () => {
    assert.deepEqual(fechasQueCambianDiasHabiles(fila({ fecha: '2026-12-25' }), 2026, 2026, []), []);
  });

  it('otro feriado que ese día rige: no cambia nada; uno dado de baja, uno que ese año no rige o de otro día, no cuenta', () => {
    const lunes = fila({ id: 1, fecha: '2026-11-02' });
    assert.deepEqual(fechasQueCambianDiasHabiles(lunes, 2026, 2026, [fila({ id: 2, fecha: '2026-11-02' })]), []);
    // Uno que se repite desde antes, proyectado a ese año
    assert.deepEqual(fechasQueCambianDiasHabiles(lunes, 2026, 2026, [fila({ id: 2, fecha: '2025-11-02', se_repite: 1 })]), []);
    for (const otra of [
      fila({ id: 2, fecha: '2026-11-02', activo: 0 }),
      fila({ id: 2, fecha: '2025-11-02', se_repite: 1, no_rige: [2026] }),
      fila({ id: 2, fecha: '2025-11-02', se_repite: 1, hasta_anio: 2025 }),
      fila({ id: 2, fecha: '2026-11-03' })
    ]) {
      assert.deepEqual(fechasQueCambianDiasHabiles(lunes, 2026, 2026, [otra]), ['2026-11-02'], JSON.stringify(otra));
    }
  });

  it('uno que se repite en dos años hábiles (el 15/12 es martes en 2026 y miércoles en 2027): las dos fechas', () => {
    const delQuince = fila({ fecha: '2026-12-15', se_repite: 1 });
    assert.deepEqual(fechasQueCambianDiasHabiles(delQuince, 2026, 2027, []), ['2026-12-15', '2027-12-15']);
    // Otro feriado el 16/12 no le saca nada; uno que no se repite, solo su año
    assert.deepEqual(fechasQueCambianDiasHabiles(delQuince, 2025, 2028, [fila({ id: 2, fecha: '2026-12-16', se_repite: 1 })]),
      ['2026-12-15', '2027-12-15', '2028-12-15']);
    assert.deepEqual(fechasQueCambianDiasHabiles({ ...delQuince, se_repite: 0 }, 2026, 2027, []), ['2026-12-15']);
  });

  it('uno que se repite, cada año por separado: el 13/12 es domingo en 2026 y lunes en 2027', () => {
    const petroleo = fila({ fecha: '2026-12-13', se_repite: 1 });
    assert.deepEqual(fechasDelFeriado(petroleo, 2026, 2027), ['2026-12-13', '2027-12-13']);
    assert.deepEqual(fechasQueCambianDiasHabiles(petroleo, 2026, 2027, []), ['2027-12-13']);
    // Otro feriado que rige solo en 2027 ese día: ya ningún año cambia nada
    assert.deepEqual(fechasQueCambianDiasHabiles(petroleo, 2026, 2027, [fila({ id: 2, fecha: '2027-12-13' })]), []);
    // Con el 2027 que no rige, tampoco
    assert.deepEqual(fechasQueCambianDiasHabiles({ ...petroleo, no_rige: [2027] }, 2026, 2027, []), []);
  });

  it('las fechas son las de fechasDelFeriado: un año fuera del rango, uno dado de baja o una entrada que no sirve, []', () => {
    assert.deepEqual(fechasQueCambianDiasHabiles(fila({ fecha: '2026-11-02' }), 2027, 2028, []), []);
    assert.deepEqual(fechasQueCambianDiasHabiles(fila({ fecha: '2026-11-02', activo: 0 }), 2026, 2026, []), []);
    for (const mala of [null, undefined, 'hola', 3, [], {}, fila({ fecha: '2026-02-30' })]) {
      assert.deepEqual(fechasQueCambianDiasHabiles(mala, 2026, 2027, []), [], JSON.stringify(mala));
    }
    assert.deepEqual(fechasQueCambianDiasHabiles(fila({ fecha: '2026-11-02' }), '2026', 2026, []), []);
    // Unas otras que no son una lista, o con filas raras, no sacan nada
    for (const otras of [undefined, null, 'x', 3, {}, [null, 'x', 3, {}, []]]) {
      assert.deepEqual(fechasQueCambianDiasHabiles(fila({ fecha: '2026-11-02' }), 2026, 2026, otras), ['2026-11-02'],
        JSON.stringify(otras));
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

// Un feriado bien cargado, como llega en el cuerpo del pedido
const PEDIDO = Object.freeze({ fecha: '2026-11-09', nombre: 'Feriado extraordinario', tipo: 'nacional' });
const HOY = '2026-10-26';

// El error de un campo: el campo del pedido y el mensaje de MENSAJES_FERIADO
const errorEn = (campo, clave) => ({ datos: null, error: { campo, mensaje: MENSAJES_FERIADO[clave] } });

describe('MENSAJES_FERIADO y los límites', () => {
  it('los mensajes son los de la spec, congelados', () => {
    assert.deepEqual({ ...MENSAJES_FERIADO }, {
      fecha: 'La fecha tiene que ser del 01/01/2025 al 31/12 del año que viene.',
      nombre: 'Escribí el nombre del feriado.',
      nombreLargo: 'El nombre puede tener hasta 150 caracteres.',
      tipo: 'Elegí el tipo de feriado.',
      trasladado: 'La fecha original tiene que ser otra fecha del mismo año.',
      repite29: 'Un feriado del 29 de febrero no puede repetirse todos los años.',
      despuesDeLaBaja: 'La fecha tiene que ser anterior al año desde el que se dio de baja.',
      anio: 'Elegí un año válido.',
      rige: 'Indicá si ese año rige.',
      pasaAl: 'La fecha a la que se pasó tiene que ser del mismo año.',
      desde: 'Elegí desde qué año deja de regir.',
      noSeRepite: 'Este feriado no se repite: se corrige o se da de baja entero.',
      noEncontrado: 'Feriado no encontrado'
    });
    assert.equal(Object.isFrozen(MENSAJES_FERIADO), true);
  });

  it('la fecha mínima y el largo del nombre', () => {
    assert.equal(FECHA_MINIMA_FERIADO, '2025-01-01');
    assert.equal(LARGO_NOMBRE_FERIADO, 150);
  });
});

describe('validarFeriado', () => {
  it('un feriado bien cargado da sus datos, con el nombre recortado', () => {
    assert.deepEqual(validarFeriado({ ...PEDIDO, nombre: '  Feriado extraordinario  ' }, HOY), {
      datos: { fecha: '2026-11-09', nombre: 'Feriado extraordinario', tipo: 'nacional', trasladado_de: null, se_repite: 0 },
      error: null
    });
  });

  it('la fecha va del 01/01/2025 al 31/12 del año siguiente al de hoy', () => {
    assert.equal(validarFeriado({ ...PEDIDO, fecha: '2027-12-31' }, '2026-12-31').error, null);
    assert.deepEqual(validarFeriado({ ...PEDIDO, fecha: '2028-01-01' }, '2026-12-31'), errorEn('fecha', 'fecha'));
    assert.equal(validarFeriado({ ...PEDIDO, fecha: '2025-01-01' }, HOY).error, null);
    assert.equal(validarFeriado({ ...PEDIDO, fecha: '2027-12-31' }, '2026-01-01').error, null);
  });

  it('una fecha fuera del rango, que no existe o que no es un texto AAAA-MM-DD da error en fecha', () => {
    for (const fecha of ['2024-12-31', '2026-02-30', '2026-2-3', 20260203, null, undefined, '', ' 2026-11-09', {}]) {
      assert.deepEqual(validarFeriado({ ...PEDIDO, fecha }, HOY), errorEn('fecha', 'fecha'), String(fecha));
    }
  });

  it('sin un hoy válido no hay tope: la fecha da error', () => {
    for (const hoy of [undefined, null, 'hola', '2026-02-30', 20261026]) {
      assert.deepEqual(validarFeriado(PEDIDO, hoy), errorEn('fecha', 'fecha'), String(hoy));
    }
  });

  it('el nombre es obligatorio y tiene hasta 150 caracteres, contados con Array.from', () => {
    for (const nombre of ['', '   ', undefined, null, 150, ['Carnaval']]) {
      assert.deepEqual(validarFeriado({ ...PEDIDO, nombre }, HOY), errorEn('nombre', 'nombre'), String(nombre));
    }
    // Un emoji son dos unidades de UTF-16: 150 emojis son 300 de length, pero 150 caracteres
    assert.equal(validarFeriado({ ...PEDIDO, nombre: '😀'.repeat(150) }, HOY).error, null);
    assert.equal(validarFeriado({ ...PEDIDO, nombre: ` ${'a'.repeat(150)} ` }, HOY).datos.nombre, 'a'.repeat(150));
    assert.deepEqual(validarFeriado({ ...PEDIDO, nombre: '😀'.repeat(151) }, HOY), errorEn('nombre', 'nombreLargo'));
  });

  it('el tipo es uno de los cuatro', () => {
    for (const tipo of TIPOS_FERIADO) assert.equal(validarFeriado({ ...PEDIDO, tipo }, HOY).datos.tipo, tipo);
    for (const tipo of ['otro', 'Nacional', 'fijo', 'nacional_movil', '', undefined, null, 'constructor', ['nacional']]) {
      assert.deepEqual(validarFeriado({ ...PEDIDO, tipo }, HOY), errorEn('tipo', 'tipo'), String(tipo));
    }
  });

  it('trasladado_de es opcional: vacío es null; si viene, otra fecha del mismo año', () => {
    for (const trasladado_de of [undefined, null, '', '   ']) {
      assert.equal(validarFeriado({ ...PEDIDO, trasladado_de }, HOY).datos.trasladado_de, null, String(trasladado_de));
    }
    assert.equal(validarFeriado({ ...PEDIDO, fecha: '2026-06-15', trasladado_de: '2026-06-17' }, HOY).datos.trasladado_de,
      '2026-06-17');
    for (const trasladado_de of ['2026-11-09', '2027-11-09', '2025-11-09', '2026-06-31', '2026-6-17', 20260617, {}]) {
      assert.deepEqual(validarFeriado({ ...PEDIDO, trasladado_de }, HOY), errorEn('trasladado_de', 'trasladado'),
        String(trasladado_de));
    }
  });

  it('se_repite es 1 con true, 1 o «1», y 0 con lo demás', () => {
    for (const se_repite of [true, 1, '1']) {
      assert.equal(validarFeriado({ ...PEDIDO, se_repite }, HOY).datos.se_repite, 1, String(se_repite));
    }
    for (const se_repite of [false, 0, '0', 'true', 'sí', 2, null, undefined, [1]]) {
      assert.equal(validarFeriado({ ...PEDIDO, se_repite }, HOY).datos.se_repite, 0, String(se_repite));
    }
  });

  it('un 29 de febrero no se repite', () => {
    const del29 = { ...PEDIDO, fecha: '2028-02-29', se_repite: true };
    // Con un hoy de 2027, el 2028 está en el rango
    assert.deepEqual(validarFeriado(del29, '2027-03-01'), errorEn('se_repite', 'repite29'));
    // Con uno de 2026, el 2028 está fuera del rango y gana la fecha
    assert.deepEqual(validarFeriado(del29, HOY), errorEn('fecha', 'fecha'));
    // Sin repetirse, el 29/02 se carga
    assert.equal(validarFeriado({ ...del29, se_repite: false }, '2027-03-01').datos.fecha, '2028-02-29');
  });

  it('los errores van en el orden fecha, nombre, tipo, trasladado y 29 de febrero', () => {
    const todoMal = { fecha: '2028-02-29', nombre: ' ', tipo: 'otro', trasladado_de: '2027-01-01', se_repite: 1 };
    const hoy = '2027-03-01';
    assert.deepEqual(validarFeriado({ ...todoMal, fecha: '2024-02-29' }, hoy), errorEn('fecha', 'fecha'));
    assert.deepEqual(validarFeriado(todoMal, hoy), errorEn('nombre', 'nombre'));
    assert.deepEqual(validarFeriado({ ...todoMal, nombre: 'X' }, hoy), errorEn('tipo', 'tipo'));
    assert.deepEqual(validarFeriado({ ...todoMal, nombre: 'X', tipo: 'nacional' }, hoy), errorEn('trasladado_de', 'trasladado'));
    assert.deepEqual(validarFeriado({ ...todoMal, nombre: 'X', tipo: 'nacional', trasladado_de: null }, hoy),
      errorEn('se_repite', 'repite29'));
  });

  it('una entrada que no es un objeto da el error de la fecha', () => {
    for (const entrada of [null, undefined, 'hola', 3, [], [PEDIDO]]) {
      assert.deepEqual(validarFeriado(entrada, HOY), errorEn('fecha', 'fecha'), String(entrada));
    }
  });
});

describe('validarRige', () => {
  const QUE_SE_REPITE = fila({ id: 13, fecha: '2026-02-23', nombre: 'Aniversario de la ciudad', se_repite: 1 });

  it('marca o desmarca que un año no rige', () => {
    assert.deepEqual(validarRige({ anio: 2026, rige: false }, QUE_SE_REPITE, HOY),
      { datos: { anio: 2026, rige: false, pasa_al: null }, error: null });
    assert.deepEqual(validarRige({ anio: 2027, rige: true }, QUE_SE_REPITE, HOY),
      { datos: { anio: 2027, rige: true, pasa_al: null }, error: null });
  });

  it('con «no rige», pasa_al es el día al que se pasó: una fecha de ese año, otra que la de ese año', () => {
    assert.deepEqual(validarRige({ anio: 2026, rige: false, pasa_al: '2026-02-24' }, QUE_SE_REPITE, HOY),
      { datos: { anio: 2026, rige: false, pasa_al: '2026-02-24' }, error: null });
    assert.equal(validarRige({ anio: 2027, rige: false, pasa_al: '2027-02-22' }, QUE_SE_REPITE, HOY).datos.pasa_al,
      '2027-02-22');
    for (const pasa_al of [undefined, null, '', '  ']) {
      assert.equal(validarRige({ anio: 2026, rige: false, pasa_al }, QUE_SE_REPITE, HOY).datos.pasa_al, null, String(pasa_al));
    }
  });

  it('pasa_al de otro año, igual a la fecha de ese año o que no es una fecha da error en pasa_al', () => {
    const casos = [
      [2026, '2027-02-24'], [2026, '2025-02-24'], [2026, '2026-02-23'], [2027, '2027-02-23'], [2027, '2026-02-24'],
      [2026, '2026-02-30'], [2026, '2026-2-24'], [2026, 20260224], [2026, {}]
    ];
    for (const [anio, pasa_al] of casos) {
      assert.deepEqual(validarRige({ anio, rige: false, pasa_al }, QUE_SE_REPITE, HOY), errorEn('pasa_al', 'pasaAl'),
        `${anio} ${pasa_al}`);
    }
  });

  it('con rige: true, pasa_al se ignora', () => {
    assert.deepEqual(validarRige({ anio: 2026, rige: true, pasa_al: '2027-01-01' }, QUE_SE_REPITE, HOY),
      { datos: { anio: 2026, rige: true, pasa_al: null }, error: null });
    assert.equal(validarRige({ anio: 2026, rige: true, pasa_al: '2026-02-24' }, QUE_SE_REPITE, HOY).datos.pasa_al, null);
  });

  it('una fila que no se repite da noSeRepite, sin campo', () => {
    const noRepite = { datos: null, error: { campo: null, mensaje: MENSAJES_FERIADO.noSeRepite } };
    assert.deepEqual(validarRige({ anio: 2026, rige: false }, { ...QUE_SE_REPITE, se_repite: 0 }, HOY), noRepite);
    for (const malo of [null, undefined, 'hola', [], [QUE_SE_REPITE]]) {
      assert.deepEqual(validarRige({ anio: 2026, rige: false }, malo, HOY), noRepite, String(malo));
    }
  });

  it('el año: un entero desde el de la fila, hasta su hasta_anio y dentro del rango', () => {
    // Anterior al primero
    assert.deepEqual(validarRige({ anio: 2025, rige: false }, QUE_SE_REPITE, HOY), errorEn('anio', 'anio'));
    // Mayor que hasta_anio
    const hasta2026 = { ...QUE_SE_REPITE, hasta_anio: 2026 };
    assert.equal(validarRige({ anio: 2026, rige: false }, hasta2026, HOY).error, null);
    assert.deepEqual(validarRige({ anio: 2027, rige: false }, hasta2026, HOY), errorEn('anio', 'anio'));
    // Fuera del rango: con hoy en 2026, 2028 todavía no
    assert.deepEqual(validarRige({ anio: 2028, rige: false }, QUE_SE_REPITE, HOY), errorEn('anio', 'anio'));
    assert.equal(validarRige({ anio: 2028, rige: false }, QUE_SE_REPITE, '2027-01-04').error, null);
    // Un texto de cuatro cifras se lee como el año
    assert.equal(validarRige({ anio: '2027', rige: false }, QUE_SE_REPITE, HOY).datos.anio, 2027);
    for (const anio of [undefined, null, 2026.5, NaN, '2026.0', ' 2026', '', 'hola', [2026], -2026]) {
      assert.deepEqual(validarRige({ anio, rige: false }, QUE_SE_REPITE, HOY), errorEn('anio', 'anio'), String(anio));
    }
  });

  it('sin un hoy válido, el año da error', () => {
    assert.deepEqual(validarRige({ anio: 2026, rige: false }, QUE_SE_REPITE, 'hola'), errorEn('anio', 'anio'));
  });

  it('rige es un booleano: true o false', () => {
    for (const rige of ['false', 'true', 0, 1, null, undefined, '']) {
      assert.deepEqual(validarRige({ anio: 2026, rige }, QUE_SE_REPITE, HOY), errorEn('rige', 'rige'), String(rige));
    }
  });

  it('los errores van en el orden noSeRepite, año, rige y pasa_al', () => {
    const todoMal = { anio: 2025, rige: 'false', pasa_al: '2027-01-01' };
    assert.equal(validarRige(todoMal, { ...QUE_SE_REPITE, se_repite: 0 }, HOY).error.mensaje, MENSAJES_FERIADO.noSeRepite);
    assert.deepEqual(validarRige(todoMal, QUE_SE_REPITE, HOY), errorEn('anio', 'anio'));
    assert.deepEqual(validarRige({ ...todoMal, anio: 2026 }, QUE_SE_REPITE, HOY), errorEn('rige', 'rige'));
    assert.deepEqual(validarRige({ ...todoMal, anio: 2026, rige: false }, QUE_SE_REPITE, HOY), errorEn('pasa_al', 'pasaAl'));
  });

  it('una entrada que no es un objeto da el error del año', () => {
    for (const entrada of [null, undefined, 'hola', 3, []]) {
      assert.deepEqual(validarRige(entrada, QUE_SE_REPITE, HOY), errorEn('anio', 'anio'), String(entrada));
    }
  });
});

describe('bajaDesde', () => {
  const DESDE_2026 = fila({ id: 13, fecha: '2026-02-23', se_repite: 1 });

  it('en una que se repite desde 2026, 2026 y 2025 dan la baja entera y 2028, hasta 2027', () => {
    assert.deepEqual(bajaDesde(DESDE_2026, 2026), { cambio: { activo: 0 }, error: null });
    assert.deepEqual(bajaDesde(DESDE_2026, 2025), { cambio: { activo: 0 }, error: null });
    assert.deepEqual(bajaDesde(DESDE_2026, 2028), { cambio: { hasta_anio: 2027 }, error: null });
    assert.deepEqual(bajaDesde(DESDE_2026, 2027), { cambio: { hasta_anio: 2026 }, error: null });
  });

  it('desde es un año obligatorio: también como texto de cuatro cifras (el de ?desde=)', () => {
    assert.deepEqual(bajaDesde(DESDE_2026, '2028'), { cambio: { hasta_anio: 2027 }, error: null });
    for (const desde of [undefined, null, '', 'hola', 2028.5, NaN, '2028.0', ' 2028', [2028]]) {
      assert.deepEqual(bajaDesde(DESDE_2026, desde),
        { cambio: null, error: { campo: 'desde', mensaje: MENSAJES_FERIADO.desde } }, String(desde));
    }
  });

  it('una que no se repite se da de baja entera, con o sin desde', () => {
    const deUnAnio = fila({ id: 1, fecha: '2026-02-16', se_repite: 0 });
    for (const desde of [undefined, 2026, 2028, 'hola']) {
      assert.deepEqual(bajaDesde(deUnAnio, desde), { cambio: { activo: 0 }, error: null }, String(desde));
    }
  });

  it('nunca la hace regir más años: con un hasta_anio guardado, se queda con el menor', () => {
    const hasta2027 = { ...DESDE_2026, hasta_anio: 2027 };
    assert.deepEqual(bajaDesde(hasta2027, 2030), { cambio: { hasta_anio: 2027 }, error: null });
    assert.deepEqual(bajaDesde(hasta2027, 2027), { cambio: { hasta_anio: 2026 }, error: null });
    assert.deepEqual(bajaDesde(hasta2027, 2026), { cambio: { activo: 0 }, error: null });
  });
});

describe('errorDeLaCorreccion', () => {
  const ERROR = { campo: 'fecha', mensaje: MENSAJES_FERIADO.despuesDeLaBaja };
  // Una que se repite desde 2026, dada de baja desde 2027 (hasta_anio 2026)
  const BAJA_DESDE_2027 = fila({ id: 13, fecha: '2026-02-23', se_repite: 1, hasta_anio: 2026 });
  // Los datos de validarFeriado para una corrección
  const corregida = (cambios) => ({ fecha: '2026-02-23', nombre: 'Aniversario', tipo: 'municipal', trasladado_de: null,
    se_repite: 1, ...cambios });

  it('con «se repite», una fecha de un año posterior a su hasta_anio es un error en fecha; de ese año o de antes, no', () => {
    assert.deepEqual(errorDeLaCorreccion(corregida({ fecha: '2027-02-23' }), BAJA_DESDE_2027), ERROR);
    assert.deepEqual(errorDeLaCorreccion(corregida({ fecha: '2027-01-01' }), BAJA_DESDE_2027), ERROR);
    assert.equal(errorDeLaCorreccion(corregida({ fecha: '2026-12-31' }), BAJA_DESDE_2027), null);
    assert.equal(errorDeLaCorreccion(corregida({ fecha: '2026-02-24' }), BAJA_DESDE_2027), null);
    assert.equal(errorDeLaCorreccion(corregida({ fecha: '2025-02-23' }), BAJA_DESDE_2027), null);
  });

  it('mira el «se repite» que queda: volver a marcarlo sobre un hasta_anio guardado también es un error; sacarlo, no', () => {
    const yaNoSeRepite = { ...BAJA_DESDE_2027, se_repite: 0 };
    assert.deepEqual(errorDeLaCorreccion(corregida({ fecha: '2027-02-23' }), yaNoSeRepite), ERROR);
    assert.equal(errorDeLaCorreccion(corregida({ fecha: '2027-02-23', se_repite: 0 }), BAJA_DESDE_2027), null);
  });

  it('sin hasta_anio no hay tope', () => {
    const sigue = { ...BAJA_DESDE_2027, hasta_anio: null };
    assert.equal(errorDeLaCorreccion(corregida({ fecha: '2027-02-23' }), sigue), null);
    assert.equal(errorDeLaCorreccion(corregida({ fecha: '2027-02-23' }), { ...BAJA_DESDE_2027, hasta_anio: undefined }), null);
  });

  it('con datos que no son de validarFeriado, null', () => {
    for (const raro of [undefined, null, 'hola', 3, [], {}, { fecha: 'hola', se_repite: 1 }, { fecha: '2027-02-23', se_repite: '1' }]) {
      assert.equal(errorDeLaCorreccion(raro, BAJA_DESDE_2027), null, JSON.stringify(raro));
    }
    for (const raro of [undefined, null, 'hola', 3, [], { hasta_anio: '2026' }, { hasta_anio: 2026.5 }]) {
      assert.equal(errorDeLaCorreccion(corregida({ fecha: '2027-02-23' }), raro), null, JSON.stringify(raro));
    }
  });
});

// La lista de 2026, con datos inventados: el Jueves Santo el día de Malvinas, un trasladado, uno que se repite y cae domingo y
// uno que se repite y en 2026 no rige. Desordenadas a propósito
const JUEVES_SANTO = fila({ id: 10, fecha: '2026-04-02', nombre: 'Jueves Santo', tipo: 'no_laborable' });
const TRASLADADO = fila({ id: 11, fecha: '2026-06-15', nombre: 'Paso a la Inmortalidad de Güemes', trasladado_de: '2026-06-17' });
const EMPLEADO_MUNICIPAL = fila({ id: 12, fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', se_repite: 1 });
const ANIVERSARIO_SIN_2026 = fila({
  id: 13, fecha: '2026-02-23', nombre: 'Aniversario de la ciudad', tipo: 'municipal', se_repite: 1, no_rige: [2026]
});
const FILAS_2026 = [EMPLEADO_MUNICIPAL, TRASLADADO, ANIVERSARIO_SIN_2026, JUEVES_SANTO];

describe('feriadosDelAnio', () => {
  const lista = feriadosDelAnio(FILAS_2026, 2026);
  const elDe = (id) => lista.find((item) => item.id === id);

  it('hay 9 fijos, con su nombre y «Fijo del sistema»', () => {
    const fijos = lista.filter((item) => item.fijo);
    assert.equal(fijos.length, 9);
    assert.deepEqual(fijos.map((item) => item.fecha), FIJOS_LITERALES.map((mesYDia) => `2026-${mesYDia}`));
    for (const fijo of fijos) {
      assert.equal(fijo.tipo_nombre, 'Fijo del sistema');
      assert.equal(fijo.nombre, NOMBRES_DE_LOS_FIJOS[fijo.fecha.slice(5)]);
    }
    assert.deepEqual(fijos.find((item) => item.fecha === '2026-04-02'), {
      id: null, fecha: '2026-04-02', dia_semana: 'jueves', nombre: 'Día del Veterano y de los Caídos en la Guerra de Malvinas',
      tipo: 'fijo', tipo_nombre: 'Fijo del sistema', fijo: true, se_repite: 1, rige: true, trasladado_de: null, aclaraciones: [],
      fecha_guardada: null, trasladado_de_guardado: null, hasta_anio: null
    });
    for (const fijo of fijos) {
      assert.deepEqual([fijo.fecha_guardada, fijo.trasladado_de_guardado, fijo.hasta_anio], [null, null, null], fijo.fecha);
    }
  });

  it('el orden es por fecha, y en el mismo día el fijo va primero', () => {
    assert.equal(lista.length, 13);
    assert.deepEqual(lista.map((item) => item.fecha), lista.map((item) => item.fecha).sort());
    assert.deepEqual(lista.map((item) => [item.fecha.slice(5), item.id]), [
      ['01-01', null], ['02-23', 13], ['03-24', null], ['04-02', null], ['04-02', 10], ['05-01', null], ['05-25', null],
      ['06-15', 11], ['06-20', null], ['07-09', null], ['11-08', 12], ['12-08', null], ['12-25', null]
    ]);
  });

  it('el Jueves Santo va después del fijo del 2/4 y dice que cae el mismo día que un fijo', () => {
    const [primero, segundo] = lista.filter((item) => item.fecha === '2026-04-02');
    assert.equal(primero.fijo, true);
    assert.deepEqual(segundo, {
      id: 10, fecha: '2026-04-02', dia_semana: 'jueves', nombre: 'Jueves Santo', tipo: 'no_laborable',
      tipo_nombre: 'No laborable', fijo: false, se_repite: 0, rige: true, trasladado_de: null,
      aclaraciones: ['Cae el mismo día que un feriado fijo: no cambia nada'],
      fecha_guardada: '2026-04-02', trasladado_de_guardado: null, hasta_anio: null
    });
  });

  it('el 15/6 dice de qué fecha se trasladó', () => {
    assert.deepEqual(elDe(11), {
      id: 11, fecha: '2026-06-15', dia_semana: 'lunes', nombre: 'Paso a la Inmortalidad de Güemes', tipo: 'nacional',
      tipo_nombre: 'Nacional', fijo: false, se_repite: 0, rige: true, trasladado_de: '2026-06-17',
      aclaraciones: ['Trasladado del miércoles 17/06'],
      fecha_guardada: '2026-06-15', trasladado_de_guardado: '2026-06-17', hasta_anio: null
    });
  });

  it('el 8/11 cae domingo; un sábado también se aclara', () => {
    assert.equal(elDe(12).dia_semana, 'domingo');
    assert.equal(elDe(12).se_repite, 1);
    assert.deepEqual(elDe(12).aclaraciones, ['Cae domingo: no cambia ningún día hábil']);
    const sabado = feriadosDelAnio([fila({ id: 20, fecha: '2026-11-07' })], 2026).find((item) => item.id === 20);
    assert.deepEqual(sabado.aclaraciones, ['Cae sábado: no cambia ningún día hábil']);
  });

  it('el 23/2 que en 2026 no rige va igual, con rige: false y «Este año no rige»', () => {
    assert.deepEqual(elDe(13), {
      id: 13, fecha: '2026-02-23', dia_semana: 'lunes', nombre: 'Aniversario de la ciudad', tipo: 'municipal',
      tipo_nombre: 'De Comodoro', fijo: false, se_repite: 1, rige: false, trasladado_de: null,
      aclaraciones: ['Este año no rige'],
      fecha_guardada: '2026-02-23', trasladado_de_guardado: null, hasta_anio: null
    });
  });

  it('una que se repite, mirada en otro año: la fecha proyectada y, aparte, lo guardado en la fila', () => {
    // Para el modal: corregir con la fecha proyectada movería el primer año
    const repite = fila({
      id: 70, fecha: '2026-06-15', nombre: 'Repetido', se_repite: 1, hasta_anio: 2030, trasladado_de: '2026-06-17'
    });
    const item = feriadosDelAnio([repite], 2027).find((elemento) => elemento.id === 70);
    assert.equal(item.fecha, '2027-06-15');
    assert.equal(item.fecha_guardada, '2026-06-15');
    assert.equal(item.trasladado_de, '2027-06-17');
    assert.equal(item.trasladado_de_guardado, '2026-06-17');
    assert.equal(item.hasta_anio, 2030);
    // hasta_anio pasa como número; lo que no es un entero, como null
    const conTexto = feriadosDelAnio([{ ...repite, hasta_anio: '2030' }], 2027).find((elemento) => elemento.id === 70);
    assert.equal(conTexto.hasta_anio, 2030);
    const conBasura = feriadosDelAnio([{ ...repite, hasta_anio: undefined }], 2027).find((elemento) => elemento.id === 70);
    assert.equal(conBasura.hasta_anio, null);
  });

  it('los que se repiten se proyectan al año; los de un año, solo en el suyo', () => {
    const de2027 = feriadosDelAnio(FILAS_2026, 2027).filter((item) => !item.fijo);
    assert.deepEqual(de2027.map((item) => [item.id, item.fecha, item.dia_semana, item.rige, item.aclaraciones]), [
      [13, '2027-02-23', 'martes', true, []],
      [12, '2027-11-08', 'lunes', true, []]
    ]);
    assert.deepEqual(feriadosDelAnio(FILAS_2026, 2025).filter((item) => !item.fijo), []);
  });

  it('no van los dados de baja ni los años fuera de su rango', () => {
    const filas = [
      { ...JUEVES_SANTO, activo: 0 }, { ...EMPLEADO_MUNICIPAL, activo: 0 },
      { ...ANIVERSARIO_SIN_2026, hasta_anio: 2026, no_rige: [] }
    ];
    assert.deepEqual(feriadosDelAnio(filas, 2026).filter((item) => !item.fijo).map((item) => item.id), [13]);
    assert.deepEqual(feriadosDelAnio(filas, 2027).filter((item) => !item.fijo), []);
  });

  it('dos de la tabla el mismo día: cada uno dice con cuál cae, y van por nombre', () => {
    const viernesSanto = fila({ id: 30, fecha: '2026-04-03', nombre: 'Viernes Santo' });
    const asueto = fila({ id: 31, fecha: '2026-04-03', nombre: 'Asueto administrativo', tipo: 'no_laborable' });
    const del3 = feriadosDelAnio([viernesSanto, asueto], 2026).filter((item) => item.fecha === '2026-04-03');
    assert.deepEqual(del3.map((item) => [item.id, item.aclaraciones]), [
      [31, ['Cae el mismo día que «Viernes Santo»']],
      [30, ['Cae el mismo día que «Asueto administrativo»']]
    ]);
  });

  it('uno que ese año no rige no cuenta para los demás ni suma otras aclaraciones', () => {
    // El 8/11/2026 cae domingo y el mismo día hay otro: el que no rige solo dice «Este año no rige»
    const sinRegir = { ...EMPLEADO_MUNICIPAL, no_rige: [2026] };
    const otro = fila({ id: 40, fecha: '2026-11-08', nombre: 'Otro feriado' });
    const del8 = feriadosDelAnio([sinRegir, otro], 2026).filter((item) => item.fecha === '2026-11-08');
    assert.deepEqual(del8.map((item) => [item.id, item.rige, item.aclaraciones]), [
      [12, false, ['Este año no rige']],
      [40, true, ['Cae domingo: no cambia ningún día hábil']]
    ]);
  });

  it('las aclaraciones van en el orden trasladado, fin de semana y coincidencia', () => {
    // El 25/12/2027 cae sábado y es fijo
    const trasladado = fila({ id: 50, fecha: '2027-12-25', nombre: 'Asueto', tipo: 'no_laborable', trasladado_de: '2027-12-24' });
    const otro = fila({ id: 51, fecha: '2027-12-25', nombre: 'Otro feriado' });
    const item = feriadosDelAnio([trasladado, otro], 2027).find((elemento) => elemento.id === 50);
    assert.deepEqual(item.aclaraciones, [
      'Trasladado del viernes 24/12',
      'Cae sábado: no cambia ningún día hábil',
      'Cae el mismo día que un feriado fijo: no cambia nada',
      'Cae el mismo día que «Otro feriado»'
    ]);
  });

  it('en uno que se repite, la fecha original del traslado se proyecta con él', () => {
    const repite = fila({ id: 60, fecha: '2026-06-15', se_repite: 1, trasladado_de: '2026-06-17' });
    const item = feriadosDelAnio([repite], 2027).find((elemento) => elemento.id === 60);
    assert.equal(item.trasladado_de, '2027-06-17');
    assert.deepEqual(item.aclaraciones, ['Trasladado del jueves 17/06']);
  });

  it('el año puede llegar como texto de cuatro cifras; un año que no sirve da una lista vacía', () => {
    assert.deepEqual(feriadosDelAnio(FILAS_2026, '2026'), lista);
    for (const anio of [undefined, null, 'hola', 2026.5, NaN, '2026.0', -2026, [2026]]) {
      assert.deepEqual(feriadosDelAnio(FILAS_2026, anio), [], String(anio));
    }
  });

  it('sin una lista de filas, solo los fijos; una fila que no sirve se saltea', () => {
    for (const filas of [null, undefined, 'hola', {}]) {
      assert.deepEqual(feriadosDelAnio(filas, 2026).map((item) => item.fijo), Array(9).fill(true));
    }
    const conBasura = feriadosDelAnio([null, 'hola', 3, fila({ fecha: '2026-02-30' }), JUEVES_SANTO], 2026);
    assert.deepEqual(conBasura.filter((item) => !item.fijo).map((item) => item.id), [10]);
  });
});

describe('avisosDeLaFecha', () => {
  it('un fijo: «Ese día ya es feriado: … (fijo del sistema).»', () => {
    assert.deepEqual(avisosDeLaFecha('2026-04-02', [], null), [
      'Ese día ya es feriado: Día del Veterano y de los Caídos en la Guerra de Malvinas (fijo del sistema).'
    ]);
  });

  it('una fila de la tabla cuenta, salvo la que se excluye por su id', () => {
    assert.deepEqual(avisosDeLaFecha('2026-04-02', [JUEVES_SANTO], null), [
      'Ese día ya es feriado: Día del Veterano y de los Caídos en la Guerra de Malvinas (fijo del sistema).',
      'Ese día ya es feriado: Jueves Santo.'
    ]);
    assert.deepEqual(avisosDeLaFecha('2026-04-02', [JUEVES_SANTO], 10), [
      'Ese día ya es feriado: Día del Veterano y de los Caídos en la Guerra de Malvinas (fijo del sistema).'
    ]);
    // El id también como texto; excluir no saca nunca un fijo, y lo que no es un id no excluye nada
    assert.equal(avisosDeLaFecha('2026-04-02', [JUEVES_SANTO], '10').length, 1);
    for (const excluirId of [undefined, '', 0, '0', -10, 10.5, 'hola', [10], { id: 10 }]) {
      assert.equal(avisosDeLaFecha('2026-04-02', [JUEVES_SANTO], excluirId).length, 2, String(excluirId));
    }
    assert.equal(avisosDeLaFecha('2026-04-02', [{ ...JUEVES_SANTO, id: null }], '').length, 2);
  });

  it('un fin de semana: «Cae domingo: no cambia ningún día hábil.»', () => {
    assert.deepEqual(avisosDeLaFecha('2026-11-08', [], null), ['Cae domingo: no cambia ningún día hábil.']);
    assert.deepEqual(avisosDeLaFecha('2026-11-07', [], null), ['Cae sábado: no cambia ningún día hábil.']);
    assert.deepEqual(avisosDeLaFecha('2026-11-09', [], null), []);
  });

  it('se calculan con la proyección del año: también los que se repiten, sin los que ese año no rigen', () => {
    // El Día del Empleado Municipal se repite desde 2026: en 2027 cae lunes
    assert.deepEqual(avisosDeLaFecha('2027-11-08', [EMPLEADO_MUNICIPAL], null), ['Ese día ya es feriado: Día del Empleado Municipal.']);
    assert.deepEqual(avisosDeLaFecha('2026-11-08', [EMPLEADO_MUNICIPAL], 12), ['Cae domingo: no cambia ningún día hábil.']);
    assert.deepEqual(avisosDeLaFecha('2026-11-08', [EMPLEADO_MUNICIPAL], null), [
      'Cae domingo: no cambia ningún día hábil.',
      'Ese día ya es feriado: Día del Empleado Municipal.'
    ]);
    assert.deepEqual(avisosDeLaFecha('2026-02-23', [ANIVERSARIO_SIN_2026], null), []);
    assert.deepEqual(avisosDeLaFecha('2027-02-23', [ANIVERSARIO_SIN_2026], null), ['Ese día ya es feriado: Aniversario de la ciudad.']);
    assert.deepEqual(avisosDeLaFecha('2026-04-02', [{ ...JUEVES_SANTO, activo: 0 }], null).length, 1);
  });

  it('una fecha que no es una fecha no da avisos', () => {
    for (const fecha of ['2026-02-30', '2026-2-3', 20260203, null, undefined, '', {}]) {
      assert.deepEqual(avisosDeLaFecha(fecha, FILAS_2026, null), [], String(fecha));
    }
  });
});

describe('aniosDelSelector', () => {
  it('sin filas: el año en curso y el siguiente', () => {
    assert.deepEqual(aniosDelSelector([], '2026-10-26'), [2026, 2027]);
    assert.deepEqual(aniosDelSelector(null, '2026-10-26'), [2026, 2027]);
  });

  it('con una fila de 2025, también 2025', () => {
    assert.deepEqual(aniosDelSelector([fila({ fecha: '2025-11-21' })], '2026-10-26'), [2025, 2026, 2027]);
  });

  it('los anteriores al en curso, desde 2025, solo si tienen alguno que rige', () => {
    const hoy = '2027-03-01';
    assert.deepEqual(aniosDelSelector([], hoy), [2027, 2028]);
    assert.deepEqual(aniosDelSelector(FILAS_2026, hoy), [2026, 2027, 2028]);
    // Uno que se repite desde 2025 rige todos los años; dado de baja o sin regir en 2025, no
    const desde2025 = fila({ fecha: '2025-07-28', se_repite: 1 });
    assert.deepEqual(aniosDelSelector([desde2025], hoy), [2025, 2026, 2027, 2028]);
    assert.deepEqual(aniosDelSelector([{ ...desde2025, no_rige: [2025] }], hoy), [2026, 2027, 2028]);
    assert.deepEqual(aniosDelSelector([{ ...desde2025, activo: 0 }], hoy), [2027, 2028]);
    // Uno de antes de 2025 no suma su año
    assert.deepEqual(aniosDelSelector([fila({ fecha: '2024-11-21' })], hoy), [2027, 2028]);
  });

  it('sin un hoy válido, una lista vacía', () => {
    for (const hoy of [undefined, null, 'hola', '2026-02-30', 20261026]) {
      assert.deepEqual(aniosDelSelector(FILAS_2026, hoy), [], String(hoy));
    }
  });
});

describe('ninguna función tira', () => {
  it('con entradas raras no tira', () => {
    const raras = [undefined, null, 'hola', 3, NaN, {}, [], [null], { fecha: 3, se_repite: 1, no_rige: 'x', hasta_anio: 'x' }];
    for (const a of raras) {
      for (const b of raras) {
        assert.doesNotThrow(() => {
          validarFeriado(a, b);
          validarRige(a, b, HOY);
          validarRige({ anio: 2026, rige: false, pasa_al: '2026-02-24' }, a, b);
          bajaDesde(a, b);
          errorDeLaCorreccion(a, b);
          feriadosDelAnio(a, b);
          feriadosDelAnio([a, b], 2026);
          avisosDeLaFecha(a, b, a);
          avisosDeLaFecha('2026-04-02', [a, b], b);
          aniosDelSelector(a, b);
          aniosDelSelector([a, b], HOY);
          fechasDelFeriado(a, b, b);
          fechasDelFeriado(a, 2026, 2027);
        }, `${JSON.stringify(a)} ${JSON.stringify(b)}`);
      }
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
    const deLaLista = feriadosDelAnio([...FILAS_2026, ...filas], 2026);
    deLaLista.forEach((item) => item.aclaraciones.push('cambiada'));
    deLaLista.length = 0;
    avisosDeLaFecha('2026-04-02', FILAS_2026, null);
    aniosDelSelector(FILAS_2026, HOY);
    validarFeriado(PEDIDO, HOY);
    assert.equal(feriadosDelAnio([], 2026).every((item) => item.aclaraciones.length === 0), true);
    assert.deepEqual(FERIADOS_FIJOS, ['01-01', '03-24', '04-02', '05-01', '05-25', '06-20', '07-09', '12-08', '12-25']);
    assert.deepEqual(FERIADOS_FIJOS, FIJOS_LITERALES);
  });
});

describe('proximoDiaHabilCon, restarDiasHabilesCon y ultimoDiaHabilDelMesCon', () => {
  // Todos los días de 2026, como feriados: ningún día hábil en todo el año
  const TODO_2026 = new Set(DIAS_DE_2026_Y_2027.filter((dia) => dia.anio === 2026).map((dia) => dia.fecha));

  it('ultimoDiaHabilDelMesCon: el último día hábil del mes, con los feriados', () => {
    assert.equal(ultimoDiaHabilDelMesCon('2026-10', new Set()), '2026-10-30');
    assert.equal(ultimoDiaHabilDelMesCon('2026-10', new Set(['2026-10-30'])), '2026-10-29');
    // Diciembre de 2026 termina un jueves; febrero de 2027, un domingo; el 29/02/2028 es martes
    assert.equal(ultimoDiaHabilDelMesCon('2026-12', new Set()), '2026-12-31');
    assert.equal(ultimoDiaHabilDelMesCon('2027-02', new Set()), '2027-02-26');
    assert.equal(ultimoDiaHabilDelMesCon('2028-02', new Set()), '2028-02-29');
    // Sin un Set, solo los fijos
    assert.equal(ultimoDiaHabilDelMesCon('2026-10', undefined), '2026-10-30');
  });

  it('ultimoDiaHabilDelMesCon: un mes sin ningún día hábil da null, nunca un día de otro mes', () => {
    assert.equal(ultimoDiaHabilDelMesCon('2026-10', TODO_2026), null);
  });

  it('restarDiasHabilesCon: el n-ésimo día hábil anterior, sin contar la fecha', () => {
    assert.equal(restarDiasHabilesCon('2026-10-30', 5, new Set()), '2026-10-23');
    assert.equal(restarDiasHabilesCon('2026-10-30', 5, new Set(['2026-10-26'])), '2026-10-22');
    // El 01/01 es fijo y el 02 y el 03 de enero de 2027, fin de semana
    assert.equal(restarDiasHabilesCon('2027-01-04', 1, new Set()), '2026-12-31');
    // Desde un sábado, el anterior es el viernes; con 0, la fecha misma
    assert.equal(restarDiasHabilesCon('2026-10-31', 1, new Set()), '2026-10-30');
    assert.equal(restarDiasHabilesCon('2026-10-31', 0, new Set()), '2026-10-31');
  });

  it('restarDiasHabilesCon: un tope de 366 vueltas', () => {
    // 2026 tiene 253 días hábiles: el 253° antes del 01/01/2027 es el primero del año, el 02/01/2026
    assert.equal(restarDiasHabilesCon('2027-01-01', 253, new Set()), '2026-01-02');
    // El 254° es el 31/12/2025, a 366 días; el 255°, el 30/12/2025, ya no se busca
    assert.equal(restarDiasHabilesCon('2027-01-01', 254, new Set()), '2025-12-31');
    assert.equal(restarDiasHabilesCon('2027-01-01', 255, new Set()), null);
  });

  it('proximoDiaHabilCon: la fecha, si es hábil, o la siguiente que lo es', () => {
    assert.equal(proximoDiaHabilCon('2026-10-31', new Set()), '2026-11-02');
    assert.equal(proximoDiaHabilCon('2026-10-31', new Set(['2026-11-02'])), '2026-11-03');
    assert.equal(proximoDiaHabilCon('2026-10-30', new Set()), '2026-10-30');
    assert.equal(proximoDiaHabilCon('2026-10-30', new Set(['2026-10-30'])), '2026-11-02');
    assert.equal(proximoDiaHabilCon('2027-01-01', new Set()), '2027-01-04');
  });

  it('proximoDiaHabilCon: un tope de 366 vueltas', () => {
    // Desde el domingo 04/01/2026, con todo 2026 feriado: el lunes 04/01/2027 está a 365 días
    assert.equal(proximoDiaHabilCon('2026-01-04', TODO_2026), '2027-01-04');
    // Desde el sábado 03/01/2026, el 04/01/2027 queda a 366: ya no se busca
    assert.equal(proximoDiaHabilCon('2026-01-03', TODO_2026), null);
  });

  it('null con una entrada inválida, y nunca pasan del 31/12/9999', () => {
    const malas = ['hola', '2026-02-30', '2026-2-3', 20260203, null, undefined, '', {}, [], Object.create(null), Symbol('x')];
    for (const mala of malas) {
      assert.doesNotThrow(() => {
        assert.equal(proximoDiaHabilCon(mala, new Set()), null);
        assert.equal(restarDiasHabilesCon(mala, 1, new Set()), null);
        assert.equal(restarDiasHabilesCon('2026-10-30', mala, new Set()), null);
        assert.equal(ultimoDiaHabilDelMesCon(mala, new Set()), null);
        proximoDiaHabilCon('2026-10-31', mala);
        restarDiasHabilesCon('2026-10-30', 5, mala);
        ultimoDiaHabilDelMesCon('2026-10', mala);
      });
    }
    for (const n of [-1, 1.5, NaN, Infinity, '5']) assert.equal(restarDiasHabilesCon('2026-10-30', n, new Set()), null);
    for (const mes of ['2026-13', '2026-00', '2026-1', '202610', '2026-10-01']) {
      assert.equal(ultimoDiaHabilDelMesCon(mes, new Set()), null, mes);
    }
    assert.equal(proximoDiaHabilCon('9999-12-31', new Set()), '9999-12-31');
    assert.equal(proximoDiaHabilCon('9999-12-31', new Set(['9999-12-31'])), null);
    assert.equal(ultimoDiaHabilDelMesCon('9999-12', new Set()), '9999-12-31');
  });

  it('no cambian el Set ni FERIADOS_FIJOS', () => {
    const feriados = new Set(['2026-10-30']);
    proximoDiaHabilCon('2026-10-30', feriados);
    restarDiasHabilesCon('2026-11-02', 3, feriados);
    ultimoDiaHabilDelMesCon('2026-10', feriados);
    assert.deepEqual([...feriados], ['2026-10-30']);
    assert.deepEqual(FERIADOS_FIJOS, FIJOS_LITERALES);
  });
});

// El calendario con la tabla (spec 2026-10-27-feriados-en-notas, 1): las mismas derivadas que CALENDARIO_FIJO, sobre un
// predicado que además saca los feriados de la tabla. Sin filas da lo mismo que los 9 fijos
describe('calendarioCon (spec 2026-10-27-feriados-en-notas, 1)', () => {
  // El valor, o la clase del error que tira
  const resultado = (fn) => { try { return { valor: fn() }; } catch (e) { return { tira: e.constructor.name }; } };
  const RAROS = ['abc', '', '2026-02-30', '2026-13-01', null, undefined, 3, '2026-2-3', '9999-12-31'];
  // Con '9999-12-31' tiran RangeError (lo fija «donde los fijos tiran RangeError, también»)
  const RAROS_QUE_TERMINAN = RAROS.filter((r) => r !== '9999-12-31');
  const DIAS = [];
  for (let dia = '2024-12-25'; dia <= '2029-01-07'; dia = sumarDias(dia, 1)) DIAS.push(dia);
  const PERIODOS = [];
  for (let anio = 2025; anio <= 2028; anio++) {
    for (let mes = 1; mes <= 12; mes++) PERIODOS.push(`${anio}-${String(mes).padStart(2, '0')}`);
  }

  // Los recorridos de tests/notas-calendario.test.js: [nombre de la función, argumentos]
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
    for (const k of [-1, 0, 1, 7, 30, 400]) LLAMADAS.push(['diasHabilesTranscurridos', [d, sumarDias(d, k)]]);
  }
  for (const r of RAROS_QUE_TERMINAN) LLAMADAS.push(['diasHabilesTranscurridos', [r, '2026-01-10']]);
  for (const h of ['', null, undefined, 3, '2026-02-30', '2026-2-3']) LLAMADAS.push(['diasHabilesTranscurridos', ['2026-01-01', h]]);

  const textoDe = (nombre, argumentos) => `${nombre}(${argumentos.map((a) => JSON.stringify(a) ?? 'undefined').join(', ')})`;

  it('sin filas da lo mismo que CALENDARIO_FIJO', () => {
    const esperados = LLAMADAS.map(([nombre, argumentos]) => resultado(() => CALENDARIO_FIJO[nombre](...argumentos)));
    for (const filas of [[], null, [null], [{}]]) {
      const calendario = calendarioCon(filas);
      LLAMADAS.forEach(([nombre, argumentos], i) => {
        assert.deepEqual(resultado(() => calendario[nombre](...argumentos)), esperados[i],
          `calendarioCon(${JSON.stringify(filas)}).${textoDe(nombre, argumentos)}`);
      });
    }
  });

  it('donde los fijos tiran RangeError, también', () => {
    for (const calendario of [calendarioCon([]), calendarioCon(FILAS_PRECARGA)]) {
      for (const d of [0, 40, 60]) assert.throws(() => calendario.rangoDeAviso('9999-12-31', d), RangeError);
      for (const n of [1, 2, 5]) assert.throws(() => calendario.sumarDiasHabiles('9999-12-31', n), RangeError);
      assert.throws(() => calendario.diasHabilesTranscurridos('9999-12-31', '2026-01-10'), RangeError);
      assert.throws(() => calendario.diasHabilesTranscurridos('9999-12-31', '9999-12-31'), RangeError);
      assert.throws(() => calendario.diasHabilesTranscurridos('2026-01-01', 'abc'), RangeError);
    }
  });

  it('con la precarga', () => {
    const c = calendarioCon(FILAS_PRECARGA);
    // La Jura de la Bandera (trasladada al lunes 02/11), la visita del Papa, la Soberanía, el no laborable del 07/12, Carnaval
    // de 2027, el aniversario de 2027 (se repite) y la Semana Santa de 2027
    for (const fecha of ['2026-11-02', '2026-11-09', '2026-11-23', '2026-12-07', '2027-02-08', '2027-02-09', '2027-02-23',
      '2027-03-25', '2027-03-26']) {
      assert.equal(c.esDiaHabil(fecha), false, fecha);
    }
    for (const fecha of ['2026-11-03', '2026-11-10', '2026-11-24', '2026-12-04']) assert.equal(c.esDiaHabil(fecha), true, fecha);
    // El 07/12 es no laborable y el 08/12, fijo
    assert.equal(c.diaHabilAnterior('2026-12-09'), '2026-12-04');
    assert.equal(c.primerDiaHabilDelMes('2026-11'), '2026-11-03');
    // El sábado 21/11: el lunes 23/11 es la Soberanía
    assert.equal(c.proximoDiaHabil('2026-11-21'), '2026-11-24');
    // El viernes 06/11 avisa también lo del sábado, el domingo y el lunes 09/11: el siguiente hábil es el martes 10/11
    assert.deepEqual(c.rangoDeAviso('2026-11-06', 40), { desde: '2026-12-16', hasta: '2026-12-19' });
    assert.equal(c.rangoDeAviso('2026-11-02', 40), null);
    assert.equal(c.diasHabilesTranscurridos('2026-10-30', '2026-11-03'), 1);
    // 05, 06, 10, 11 y 12/11
    assert.equal(c.sumarDiasHabiles('2026-11-04', 5), '2026-11-12');
    let habilesDe2026 = 0;
    for (let dia = '2026-01-01'; dia <= '2026-12-31'; dia = sumarDias(dia, 1)) if (c.esDiaHabil(dia)) habilesDe2026++;
    // Los 253 de los 9 fijos, menos los 16 de la precarga que caen de lunes a viernes
    assert.equal(habilesDe2026, 237);
    assert.equal(c.origen, 'tabla');
    assert.equal(c.error, null);
    assert.ok(Object.isFrozen(c));
  });

  it('las filas que cambian después no lo cambian', () => {
    const copia = [...FILAS_PRECARGA];
    const c = calendarioCon(copia);
    copia.splice(copia.findIndex((f) => f.fecha === '2026-11-02'), 1);
    assert.equal(c.esDiaHabil('2026-11-02'), false);
    // La copia sin el 02/11 sí lo tiene hábil
    assert.equal(calendarioCon(copia).esDiaHabil('2026-11-02'), true);
  });

  it('origen y error se pasan', () => {
    const c = calendarioCon([], { origen: 'fijos', error: 'x' });
    assert.equal(c.origen, 'fijos');
    assert.equal(c.error, 'x');
  });
});

describe('los mensajes de la caída a los 9 fijos', () => {
  it('los de la corrida y de Correos → Estado (spec 2026-10-27-feriados-en-notas, 6)', () => {
    assert.equal(MENSAJE_CORRIDA_SIN_FERIADOS,
      'No se pudieron leer los feriados de Configuración → Feriados: la corrida usó solo los 9 fijos.');
    assert.equal(MENSAJE_ESTADO_SIN_FERIADOS,
      'No se pudieron leer los feriados de Configuración → Feriados: las fechas de esta pantalla cuentan solo los 9 feriados fijos.');
  });

  it('el de Métricas va en minúscula: la corrida lo anota detrás de «No se pudo sacar la foto del año: »', () => {
    assert.equal(MENSAJE_METRICAS_SIN_FERIADOS, 'no se pudieron leer los feriados de Configuración → Feriados');
  });
});

// La foto del 31/12 con sus feriados (spec 2026-10-27-feriados-en-notas, 2 y 5): Métricas exige la tabla, la foto guarda los
// días que la tabla sacó de los hábiles y, al leerla, vuelve a armar el mismo calendario con ellos
describe('exigirLaTabla, feriadosDelCalendario y calendarioDeFechas', () => {
  const TABLA = calendarioCon(FILAS_PRECARGA);
  // Los días que la precarga saca de los hábiles de 2025 a 2027: los de lunes a viernes que no son de los 9 fijos (el Jueves
  // Santo de 2026, el 02/04, es fijo; el Empleado Municipal de 2026 cae domingo y el de 2027, lunes)
  const DE_LA_PRECARGA = [
    '2026-01-02', '2026-02-16', '2026-02-17', '2026-02-23', '2026-03-23', '2026-04-03', '2026-04-30', '2026-06-15', '2026-07-10',
    '2026-07-28', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-09', '2026-11-23', '2026-12-07', '2027-02-08', '2027-02-09',
    '2027-02-23', '2027-03-25', '2027-03-26', '2027-06-21', '2027-07-28', '2027-08-16', '2027-10-11', '2027-11-01', '2027-11-08',
    '2027-12-13'
  ];
  const DIAS = [];
  for (let dia = '2025-01-01'; dia <= '2027-12-31'; dia = sumarDias(dia, 1)) DIAS.push(dia);

  it('exigirLaTabla devuelve el mismo calendario si se leyó; si cayó a los 9 fijos, tira', () => {
    assert.equal(exigirLaTabla(CALENDARIO_FIJO), CALENDARIO_FIJO);
    assert.equal(exigirLaTabla(TABLA), TABLA);
    assert.equal(exigirLaTabla(calendarioCon([])).origen, 'tabla');
    assert.throws(() => exigirLaTabla(calendarioCon([], { origen: 'fijos', error: 'falla' })),
      { message: MENSAJE_METRICAS_SIN_FERIADOS });
    // La caída se detecta por el error, nunca por el origen
    assert.throws(() => exigirLaTabla(calendarioCon(FILAS_PRECARGA, { origen: 'tabla', error: 'falla' })),
      { message: MENSAJE_METRICAS_SIN_FERIADOS });
  });

  it('feriadosDelCalendario: los días hábiles con los 9 fijos que no lo son con el calendario, en orden', () => {
    assert.deepEqual(feriadosDelCalendario(CALENDARIO_FIJO, '2025-01-01', '2027-12-31'), []);
    assert.deepEqual(feriadosDelCalendario(TABLA, '2025-01-01', '2027-12-31'), DE_LA_PRECARGA);
    // Los dos extremos van incluidos
    assert.deepEqual(feriadosDelCalendario(TABLA, '2026-11-02', '2026-11-09'), ['2026-11-02', '2026-11-09']);
    assert.deepEqual(feriadosDelCalendario(TABLA, '2026-11-02', '2026-11-02'), ['2026-11-02']);
    // Un día de los 9 fijos, un sábado o un domingo no van, aunque la tabla también los tenga
    assert.deepEqual(feriadosDelCalendario(TABLA, '2026-04-02', '2026-04-02'), []);
    assert.deepEqual(feriadosDelCalendario(TABLA, '2026-11-07', '2026-11-08'), []);
    // desde > hasta, o una fecha que no es una fecha, []
    assert.deepEqual(feriadosDelCalendario(TABLA, '2026-11-09', '2026-11-02'), []);
    for (const raro of ['abc', '', '2026-02-30', '2026-2-3', null, undefined, 3]) {
      assert.deepEqual(feriadosDelCalendario(TABLA, raro, '2026-12-31'), [], String(raro));
      assert.deepEqual(feriadosDelCalendario(TABLA, '2026-01-01', raro), [], String(raro));
    }
    // Se cuentan los días, no se compara el texto: termina en el 31/12/9999
    assert.deepEqual(feriadosDelCalendario(TABLA, '9999-12-25', '9999-12-31'), []);
  });

  it('calendarioDeFechas con esa lista da lo mismo que el calendario de la tabla en ese rango', () => {
    const deLasFechas = calendarioDeFechas(DE_LA_PRECARGA);
    for (const dia of DIAS) assert.equal(deLasFechas.esDiaHabil(dia), TABLA.esDiaHabil(dia), dia);
    assert.equal(deLasFechas.diasHabilesTranscurridos('2025-12-31', '2026-12-31'), 237);
    assert.equal(TABLA.diasHabilesTranscurridos('2025-12-31', '2026-12-31'), 237);
    assert.deepEqual([deLasFechas.origen, deLasFechas.error], ['tabla', null]);
    assert.ok(Object.isFrozen(deLasFechas));
    // Sin fechas, lo mismo que los 9 fijos
    const sinFechas = calendarioDeFechas([]);
    for (const dia of DIAS) assert.equal(sinFechas.esDiaHabil(dia), CALENDARIO_FIJO.esDiaHabil(dia), dia);
    assert.equal(sinFechas.diasHabilesTranscurridos('2025-12-31', '2026-12-31'), 253);
  });
});
