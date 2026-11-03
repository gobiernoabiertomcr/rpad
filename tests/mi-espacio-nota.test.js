// Mi espacio, la nota de licencia en Word (spec 2026-10-27-mi-espacio-licencia-word, secciones 2 y 4): la nota como
// estructura, su HTML y la aclaración, puras y sin base. Las personas son inventadas.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPOS_CON_NOTA, NOMBRES_DEL_ARCHIVO, MENSAJES_NOTA, enLetras, textoDeHoras, notaDeLicencia, htmlDeLaNota,
  aclaracionDeLaNota, textoDeLosAsuetos, notaDeRestitucion, aclaracionDeLaRestitucion
} from '../services/miEspacioNota.js';
import { TIPOS_LICENCIA } from '../services/miEspacioReglas.js';

const PERSONA = Object.freeze({ nombre: 'Lucía Fernández', cargo: 'Jefa de División Datos Abiertos', vinculo: 'planta_permanente' });
// El lunes 23/11/2026, feriado de la tabla (los 9 fijos ya los saca esDiaHabil)
const FERIADOS = new Set(['2026-11-23']);
const FECHA = '2026-10-27';

const PIDO = 'Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar ';
const armar = (licencia, persona = PERSONA) => notaDeLicencia(licencia, { fecha: FECHA, persona, feriados: FERIADOS });
const cuerpo = (licencia) => armar(licencia).nota.cuerpo;
const VACACIONES = Object.freeze({ tipo: 'vacaciones', desde: '2026-11-16', hasta: '2026-11-27', horas: null });

describe('las constantes', () => {
  it('los nueve tipos con nota, en el orden de TIPOS_LICENCIA: todos menos el uso autorizado (también los días restituidos)', () => {
    assert.deepEqual([...TIPOS_CON_NOTA], [
      'vacaciones', 'franquicia', 'estudios', 'medica', 'medica_extraordinaria', 'familiar', 'franco', 'horas_a_favor',
      'restituidos'
    ]);
    assert.deepEqual([...TIPOS_CON_NOTA], TIPOS_LICENCIA.filter((tipo) => tipo !== 'uso_autorizado'));
    assert.ok(Object.isFrozen(TIPOS_CON_NOTA));
  });

  it('el nombre de cada tipo en el archivo', () => {
    assert.deepEqual(NOMBRES_DEL_ARCHIVO, {
      vacaciones: 'Licencia anual ordinaria', franquicia: 'Franquicia', estudios: 'Estudios', medica: 'Atención médica',
      familiar: 'Atención del grupo familiar', medica_extraordinaria: 'Médica extraordinaria', franco: 'Franco compensatorio',
      horas_a_favor: 'Horas a favor', restituidos: 'Días restituidos'
    });
    assert.deepEqual(Object.keys(NOMBRES_DEL_ARCHIVO).sort(), [...TIPOS_CON_NOTA].sort());
    assert.ok(Object.isFrozen(NOMBRES_DEL_ARCHIVO));
  });

  it('los mensajes', () => {
    assert.deepEqual(MENSAJES_NOTA, {
      sinNota: 'Esta licencia no tiene nota.',
      sinDiasHabiles: 'Entre esas fechas ya no hay ningún día hábil: corregí la licencia para bajar la nota.',
      error: 'Error al armar la nota'
    });
    assert.ok(Object.isFrozen(MENSAJES_NOTA));
  });
});

describe('enLetras', () => {
  it('«un» y «una», «veintiún» y «veintiuna»', () => {
    assert.equal(enLetras(1, 'm'), 'un');
    assert.equal(enLetras(1, 'f'), 'una');
    assert.equal(enLetras(21, 'm'), 'veintiún');
    assert.equal(enLetras(21, 'f'), 'veintiuna');
    assert.equal(enLetras(31, 'm'), 'treinta y un');
    assert.equal(enLetras(31, 'f'), 'treinta y una');
  });

  it('las decenas, las centenas y las tildes', () => {
    assert.equal(enLetras(9, 'm'), 'nueve');
    assert.equal(enLetras(16, 'm'), 'dieciséis');
    assert.equal(enLetras(22, 'm'), 'veintidós');
    assert.equal(enLetras(30, 'm'), 'treinta');
    assert.equal(enLetras(45, 'm'), 'cuarenta y cinco');
    assert.equal(enLetras(100, 'm'), 'cien');
    assert.equal(enLetras(100, 'f'), 'cien');
    assert.equal(enLetras(101, 'm'), 'ciento un');
    assert.equal(enLetras(115, 'm'), 'ciento quince');
    assert.equal(enLetras(200, 'm'), 'doscientos');
    assert.equal(enLetras(200, 'f'), 'doscientas');
    assert.equal(enLetras(521, 'f'), 'quinientas veintiuna');
    assert.equal(enLetras(999, 'm'), 'novecientos noventa y nueve');
  });

  it('sin género, masculino', () => {
    assert.equal(enLetras(30), 'treinta');
    assert.equal(enLetras(1), 'un');
  });

  it('fuera de 1 a 999, o lo que no es un entero, da vacío', () => {
    for (const valor of [0, -1, 1000, 1.5, NaN, Infinity, '3', null, undefined]) assert.equal(enLetras(valor, 'm'), '');
  });
});

describe('textoDeHoras', () => {
  it('las enteras, en letras y en números', () => {
    assert.equal(textoDeHoras(1), 'una (1) hora');
    assert.equal(textoDeHoras(3), 'tres (3) horas');
    assert.equal(textoDeHoras(7), 'siete (7) horas');
  });

  it('las medias', () => {
    assert.equal(textoDeHoras(0.5), 'media hora (0,5)');
    assert.equal(textoDeHoras(1.5), 'una hora y media (1,5)');
    assert.equal(textoDeHoras(2.5), 'dos horas y media (2,5)');
  });

  it('lo que no son horas de a media hora da vacío', () => {
    for (const valor of [0, -1, 0.25, 1.3, NaN, null, undefined, '2', 1000]) assert.equal(textoDeHoras(valor), '');
  });
});

describe('notaDeLicencia: el cuerpo de cada tipo', () => {
  it('vacaciones: solo los días hábiles y desde cuándo', () => {
    assert.equal(cuerpo(VACACIONES),
      `${PIDO}el usufructo de nueve (9) días hábiles correspondientes a mi licencia anual ordinaria, a partir del día lunes 16 de noviembre de 2026.`);
  });

  it('franquicia', () => {
    assert.equal(cuerpo({ tipo: 'franquicia', desde: '2026-11-04', hasta: '2026-11-04', horas: 3 }),
      `${PIDO}el usufructo de tres (3) horas de franquicia para trámites personales el día miércoles 4 de noviembre de 2026.`);
    assert.match(cuerpo({ tipo: 'franquicia', desde: '2026-11-04', hasta: '2026-11-04', horas: 1 }),
      /el usufructo de una \(1\) hora de franquicia para trámites personales el día/);
  });

  it('estudios, atención médica, grupo familiar (un día) y médica extraordinaria', () => {
    assert.equal(cuerpo({ tipo: 'estudios', desde: '2026-11-16', hasta: '2026-11-17', horas: null }),
      `${PIDO}licencia por examen por dos (2) días hábiles, a partir del día lunes 16 de noviembre de 2026.`);
    assert.equal(cuerpo({ tipo: 'medica', desde: '2026-11-12', hasta: '2026-11-13', horas: null }),
      `${PIDO}licencia por atención médica por dos (2) días hábiles, a partir del día jueves 12 de noviembre de 2026.`);
    assert.equal(cuerpo({ tipo: 'familiar', desde: '2026-11-20', hasta: '2026-11-20', horas: null }),
      `${PIDO}licencia por atención del grupo familiar por un (1) día hábil, el día viernes 20 de noviembre de 2026.`);
    assert.equal(cuerpo({ tipo: 'medica_extraordinaria', desde: '2027-03-01', hasta: '2027-03-12', horas: null }),
      `${PIDO}licencia médica extraordinaria por diez (10) días hábiles, a partir del día lunes 1 de marzo de 2027.`);
  });

  it('franco: las horas extras de dos meses antes, también cruzando el año', () => {
    assert.equal(cuerpo({ tipo: 'franco', desde: '2026-12-14', hasta: '2026-12-14', horas: null }),
      `${PIDO}el usufructo del franco compensatorio correspondiente a las horas extras realizadas en octubre de 2026, el día lunes 14 de diciembre de 2026.`);
    assert.match(cuerpo({ tipo: 'franco', desde: '2027-01-15', hasta: '2027-01-15', horas: null }),
      /realizadas en noviembre de 2026, el día viernes 15 de enero de 2027\.$/);
  });

  it('horas a favor: el día primero, el mes anterior y la concordancia de las medias (spec '
    + '2026-10-30-mi-espacio-horas-mes-anterior, 7: el día primero en todas)', () => {
    assert.equal(cuerpo({ tipo: 'horas_a_favor', desde: '2026-10-15', hasta: '2026-10-15', horas: 2.5 }),
      `${PIDO}el usufructo de dos horas y media (2,5) a favor el día jueves 15 de octubre de 2026, correspondientes a las horas extras realizadas en septiembre de 2026.`);
    const ELDIA = 'a favor el día jueves 15 de octubre de 2026,';
    assert.ok(cuerpo({ tipo: 'horas_a_favor', desde: '2026-10-15', hasta: '2026-10-15', horas: 0.5 })
      .includes(`media hora (0,5) ${ELDIA} correspondiente a las horas`));
    assert.ok(cuerpo({ tipo: 'horas_a_favor', desde: '2026-10-15', hasta: '2026-10-15', horas: 1 })
      .includes(`una (1) hora ${ELDIA} correspondiente a las horas`));
    assert.ok(cuerpo({ tipo: 'horas_a_favor', desde: '2026-10-15', hasta: '2026-10-15', horas: 1.5 })
      .includes(`una hora y media (1,5) ${ELDIA} correspondiente a las horas`));
    assert.ok(cuerpo({ tipo: 'horas_a_favor', desde: '2026-10-15', hasta: '2026-10-15', horas: 2 })
      .includes(`dos (2) horas ${ELDIA} correspondientes a las horas`));
    assert.match(cuerpo({ tipo: 'horas_a_favor', desde: '2027-01-15', hasta: '2027-01-15', horas: 1 }),
      /a favor el día viernes 15 de enero de 2027, correspondiente a las horas extras realizadas en diciembre de 2026\.$/);
  });
});

// Las horas a favor con días tildados «Sumar a {mes anterior}» (spec 2026-10-30-mi-espacio-horas-mes-anterior, 7): la nota
// nombra entre paréntesis los días del mes de la licencia que suman al de las horas y dan horas, en orden de fecha. Inventado:
// enero y febrero de 2027, una persona de contrato con una licencia de horas a favor el viernes 05/02/2027
describe('notaDeLicencia: las horas a favor con días sumados al mes anterior', () => {
  const SIETE = Object.freeze({ tipo: 'horas_a_favor', desde: '2027-02-05', hasta: '2027-02-05', horas: 7 });
  // Una salida de la planilla, como las de estado.salidas: un día hábil cuenta solo la salida, desde las 15:00
  const salida = (fecha, horaDeSalida, alMesAnterior = true, entrada = null) =>
    ({ id: 1, fecha, entrada, salida: horaDeSalida, nota: null, al_mes_anterior: alMesAnterior });
  const conSalidas = (salidas, licencia = SIETE, feriados = FERIADOS) =>
    notaDeLicencia(licencia, { fecha: '2027-02-03', persona: PERSONA, feriados, salidas }).nota.cuerpo;
  const SIN_PARENTESIS = `${PIDO}el usufructo de siete (7) horas a favor el día viernes 5 de febrero de 2027, correspondientes a las horas extras realizadas en enero de 2027.`;

  it('un día tildado (el martes 02/02, salida 16:20: 1,5 h): «incluidas las del martes 2 de febrero de 2027, sumadas a enero»',
    () => {
      assert.equal(conSalidas([salida('2027-02-02', '16:20')]),
        `${PIDO}el usufructo de siete (7) horas a favor el día viernes 5 de febrero de 2027, correspondientes a las horas extras realizadas en enero de 2027 (incluidas las del martes 2 de febrero de 2027, sumadas a enero).`);
    });

  it('dos días: «el martes 2 y el miércoles 3»; tres: «el lunes 1, el martes 2 y el miércoles 3», en orden de fecha', () => {
    assert.ok(conSalidas([salida('2027-02-03', '15:50'), salida('2027-02-02', '16:20')])
      .endsWith('enero de 2027 (incluidas las del martes 2 y el miércoles 3 de febrero de 2027, sumadas a enero).'));
    assert.ok(conSalidas([salida('2027-02-03', '15:50'), salida('2027-02-01', '16:00'), salida('2027-02-02', '16:20')])
      .endsWith('enero de 2027 (incluidas las del lunes 1, el martes 2 y el miércoles 3 de febrero de 2027, sumadas a enero).'));
  });

  it('no se nombran: un tildado de 0 h, uno sin tildar, uno tildado de otro mes, una salida inválida ni lo que no es una salida',
    () => {
      assert.equal(conSalidas([
        salida('2027-02-01', '15:10'), // tildado, pero da 0 h
        salida('2027-02-02', '16:20', false), // sin tildar
        salida('2027-02-04', '16:20', 1), // la marca es solo el true literal
        salida('2027-03-02', '16:20'), // tildado, de marzo: suma a febrero, no a enero
        salida('2027-01-12', '16:20'), // tildado, de enero: suma a diciembre
        salida('2027-02-08', '25:00'), // una salida que no es una hora
        salida('2027-02-06', '12:00'), // un sábado sin entrada: no da horas
        salida('2027-02-10', '10:00', true, '11:00'), // la salida antes que la entrada
        { fecha: '2027-02-09', al_mes_anterior: true }, // sin salida
        { fecha: '09/02/2027', salida: '16:20', al_mes_anterior: true }, null, 'x', [], 3
      ]), SIN_PARENTESIS);
    });

  it('sin salidas, con una lista vacía o con algo que no es una lista: sin paréntesis', () => {
    assert.equal(armar(SIETE).nota.cuerpo, SIN_PARENTESIS);
    for (const salidas of [[], null, undefined, 'x', {}, 3]) assert.equal(conSalidas(salidas), SIN_PARENTESIS, String(salidas));
  });

  it('los feriados cuentan: un tildado en un feriado del Set sin entrada no da horas y no se nombra; con entrada, sí', () => {
    const feriados = new Set(['2027-02-03']);
    assert.ok(conSalidas([salida('2027-02-02', '16:20'), salida('2027-02-03', '15:50')], SIETE, feriados)
      .endsWith('(incluidas las del martes 2 de febrero de 2027, sumadas a enero).'));
    // En un feriado cuenta de la entrada a la salida: de 09:00 a 10:30 es 1,5 h
    assert.ok(conSalidas([salida('2027-02-02', '16:20'), salida('2027-02-03', '10:30', true, '09:00')], SIETE, feriados)
      .endsWith('(incluidas las del martes 2 y el miércoles 3 de febrero de 2027, sumadas a enero).'));
  });

  it('«correspondiente» con 1 h, también con el paréntesis', () => {
    assert.equal(conSalidas([salida('2027-02-02', '16:20')], { ...SIETE, horas: 1 }),
      `${PIDO}el usufructo de una (1) hora a favor el día viernes 5 de febrero de 2027, correspondiente a las horas extras realizadas en enero de 2027 (incluidas las del martes 2 de febrero de 2027, sumadas a enero).`);
  });

  it('cruzando el año: unas horas a favor de enero con un día de enero tildado suman a diciembre', () => {
    assert.equal(conSalidas([salida('2027-01-04', '16:20')], { ...SIETE, desde: '2027-01-15', hasta: '2027-01-15', horas: 2 }),
      `${PIDO}el usufructo de dos (2) horas a favor el día viernes 15 de enero de 2027, correspondientes a las horas extras realizadas en diciembre de 2026 (incluidas las del lunes 4 de enero de 2027, sumadas a diciembre).`);
  });

  it('las salidas no cambian el franco ni los demás tipos', () => {
    const salidas = [salida('2026-12-01', '16:20'), salida('2026-11-17', '16:20'), salida('2026-10-14', '16:20')];
    for (const licencia of [
      VACACIONES, { tipo: 'franco', desde: '2026-12-14', hasta: '2026-12-14', horas: null },
      { tipo: 'franquicia', desde: '2026-11-04', hasta: '2026-11-04', horas: 3 },
      { tipo: 'estudios', desde: '2026-11-16', hasta: '2026-11-17', horas: null }
    ]) {
      const conEllas = notaDeLicencia(licencia, { fecha: FECHA, persona: PERSONA, feriados: FERIADOS, salidas });
      assert.deepEqual(conEllas, armar(licencia), licencia.tipo);
    }
  });
});

// Las horas a favor con horas acumuladas de contrato (spec 2026-11-03-mi-espacio-horas-acumuladas, 9): `horas` es el total
// del día y `horas_acumuladas`, la parte que sale de las acumuladas de meses anteriores. Con las dos, la nota dice el total y,
// después de dos puntos, cada parte; solo con acumuladas, no nombra ningún mes. Inventado: una persona de contrato con horas a
// favor en noviembre de 2026
describe('notaDeLicencia: las horas a favor con horas acumuladas', () => {
  const DEL_MES_Y_ACUMULADAS = Object.freeze({
    tipo: 'horas_a_favor', desde: '2026-11-06', hasta: '2026-11-06', horas: 7, horas_acumuladas: 0.5
  });
  const conSalidas = (licencia, salidas) =>
    notaDeLicencia(licencia, { fecha: '2026-11-03', persona: PERSONA, feriados: FERIADOS, salidas }).nota.cuerpo;

  it('7 horas con 0,5 acumuladas: el total y, después de los dos puntos, la parte del mes y la acumulada', () => {
    assert.equal(cuerpo(DEL_MES_Y_ACUMULADAS),
      `${PIDO}el usufructo de siete (7) horas a favor el día viernes 6 de noviembre de 2026: seis horas y media (6,5) correspondientes a las horas extras realizadas en octubre de 2026 y media hora (0,5) de horas extras acumuladas de meses anteriores.`);
  });

  it('solo acumuladas (1,5 de 1,5): sin mes de las horas extras, con el día al final', () => {
    assert.equal(cuerpo({ tipo: 'horas_a_favor', desde: '2026-11-09', hasta: '2026-11-09', horas: 1.5, horas_acumuladas: 1.5 }),
      `${PIDO}el usufructo de una hora y media (1,5) de horas extras acumuladas de meses anteriores el día lunes 9 de noviembre de 2026.`);
  });

  it('con un día tildado «Sumar a octubre» (el lunes 02/11, 1 h): el paréntesis de hoy va después del mes de las horas', () => {
    const salidas = [{ id: 1, fecha: '2026-11-02', entrada: null, salida: '16:00', nota: null, al_mes_anterior: true }];
    assert.equal(conSalidas(DEL_MES_Y_ACUMULADAS, salidas),
      `${PIDO}el usufructo de siete (7) horas a favor el día viernes 6 de noviembre de 2026: seis horas y media (6,5) correspondientes a las horas extras realizadas en octubre de 2026 (incluidas las del lunes 2 de noviembre de 2026, sumadas a octubre) y media hora (0,5) de horas extras acumuladas de meses anteriores.`);
  });

  it('solo acumuladas con un día tildado: no nombra ningún mes ni el paréntesis', () => {
    const salidas = [{ id: 1, fecha: '2026-11-02', entrada: null, salida: '16:00', nota: null, al_mes_anterior: true }];
    assert.equal(conSalidas({ ...DEL_MES_Y_ACUMULADAS, horas: 1.5, horas_acumuladas: 1.5 }, salidas),
      `${PIDO}el usufructo de una hora y media (1,5) de horas extras acumuladas de meses anteriores el día viernes 6 de noviembre de 2026.`);
  });

  it('«correspondiente» concuerda con la parte del mes: 1 h del mes y 0,5 acumuladas', () => {
    assert.equal(cuerpo({ ...DEL_MES_Y_ACUMULADAS, horas: 1.5, horas_acumuladas: 0.5 }),
      `${PIDO}el usufructo de una hora y media (1,5) a favor el día viernes 6 de noviembre de 2026: una (1) hora correspondiente a las horas extras realizadas en octubre de 2026 y media hora (0,5) de horas extras acumuladas de meses anteriores.`);
    // Con 2 h del mes, en plural, aunque el total sea más
    assert.ok(cuerpo({ ...DEL_MES_Y_ACUMULADAS, horas: 3, horas_acumuladas: 1 })
      .includes(': dos (2) horas correspondientes a las horas extras realizadas en octubre de 2026 y una (1) hora de horas extras acumuladas de meses anteriores.'));
  });

  it('el texto de un DECIMAL («0.5») sirve, y más acumuladas que el total cuentan como todas acumuladas', () => {
    assert.equal(cuerpo({ ...DEL_MES_Y_ACUMULADAS, horas_acumuladas: '0.5' }), cuerpo(DEL_MES_Y_ACUMULADAS));
    assert.equal(cuerpo({ ...DEL_MES_Y_ACUMULADAS, horas: 1.5, horas_acumuladas: 3 }),
      `${PIDO}el usufructo de una hora y media (1,5) de horas extras acumuladas de meses anteriores el día viernes 6 de noviembre de 2026.`);
  });

  it('sin acumuladas (null, 0, sin la clave o lo que no es un número positivo): el texto de hoy', () => {
    const deHoy = `${PIDO}el usufructo de siete (7) horas a favor el día viernes 6 de noviembre de 2026, correspondientes a las horas extras realizadas en octubre de 2026.`;
    const { horas_acumuladas: _, ...sinLaClave } = DEL_MES_Y_ACUMULADAS;
    assert.equal(cuerpo(sinLaClave), deHoy);
    for (const valor of [null, 0, '', -0.5, 'x', true, NaN]) {
      assert.equal(cuerpo({ ...DEL_MES_Y_ACUMULADAS, horas_acumuladas: valor }), deHoy, String(valor));
    }
  });

  it('en otro tipo, `horas_acumuladas` no cuenta: la franquicia sigue con su texto', () => {
    const franquicia = { tipo: 'franquicia', desde: '2026-11-04', hasta: '2026-11-04', horas: 3 };
    assert.deepEqual(armar({ ...franquicia, horas_acumuladas: 1 }), armar(franquicia));
  });

  it('el nombre del archivo, la fecha y la firma no cambian', () => {
    const { horas_acumuladas: _, ...sinAcumuladas } = DEL_MES_Y_ACUMULADAS;
    const con = armar(DEL_MES_Y_ACUMULADAS).nota;
    const sin = armar(sinAcumuladas).nota;
    assert.deepEqual({ ...con, cuerpo: null }, { ...sin, cuerpo: null });
    assert.equal(con.nombre, 'Nota de licencia - Horas a favor - 2026-11-06.docx');
  });
});

describe('notaDeLicencia: los días hábiles', () => {
  it('«a partir del día» es el primer día hábil, no el desde', () => {
    // Del sábado 31/10 al viernes 6/11: del lunes 2 al viernes 6
    assert.equal(cuerpo({ tipo: 'vacaciones', desde: '2026-10-31', hasta: '2026-11-06', horas: null }),
      `${PIDO}el usufructo de cinco (5) días hábiles correspondientes a mi licencia anual ordinaria, a partir del día lunes 2 de noviembre de 2026.`);
    // Una que arranca en el feriado de la tabla: desde el martes 24
    assert.match(cuerpo({ tipo: 'estudios', desde: '2026-11-23', hasta: '2026-11-25', horas: null }),
      /por dos \(2\) días hábiles, a partir del día martes 24 de noviembre de 2026\.$/);
  });

  it('un solo día hábil entre fechas distintas: «el día» y el singular', () => {
    // Del viernes 20 al lunes 23, el feriado
    assert.equal(cuerpo({ tipo: 'estudios', desde: '2026-11-20', hasta: '2026-11-23', horas: null }),
      `${PIDO}licencia por examen por un (1) día hábil, el día viernes 20 de noviembre de 2026.`);
    assert.equal(cuerpo({ tipo: 'vacaciones', desde: '2026-11-20', hasta: '2026-11-23', horas: null }),
      `${PIDO}el usufructo de un (1) día hábil correspondiente a mi licencia anual ordinaria, el día viernes 20 de noviembre de 2026.`);
    // Del sábado 21 al martes 24: el único hábil es el martes
    assert.match(cuerpo({ tipo: 'medica', desde: '2026-11-21', hasta: '2026-11-24', horas: null }),
      /por un \(1\) día hábil, el día martes 24 de noviembre de 2026\.$/);
  });

  it('los 9 fijos tampoco cuentan: el 8/12', () => {
    // Del lunes 7 al miércoles 9 de diciembre: el martes 8 es fijo
    assert.match(cuerpo({ tipo: 'estudios', desde: '2026-12-07', hasta: '2026-12-09', horas: null }),
      /por dos \(2\) días hábiles, a partir del día lunes 7 de diciembre de 2026\.$/);
  });

  it('ningún día hábil: sin nota, con su error', () => {
    assert.deepEqual(armar({ tipo: 'estudios', desde: '2026-11-21', hasta: '2026-11-22', horas: null }),
      { error: 'sinDiasHabiles' });
    assert.deepEqual(armar({ tipo: 'familiar', desde: '2026-11-23', hasta: '2026-11-23', horas: null }),
      { error: 'sinDiasHabiles' });
  });

  it('un franco en un día que pasó a feriado sigue teniendo nota: no cuenta días', () => {
    assert.equal(cuerpo({ tipo: 'franco', desde: '2026-11-23', hasta: '2026-11-23', horas: null }),
      `${PIDO}el usufructo del franco compensatorio correspondiente a las horas extras realizadas en septiembre de 2026, el día lunes 23 de noviembre de 2026.`);
    assert.match(cuerpo({ tipo: 'franquicia', desde: '2026-11-23', hasta: '2026-11-23', horas: 2 }),
      /el día lunes 23 de noviembre de 2026\.$/);
  });
});

describe('notaDeLicencia: sin nota', () => {
  it('el uso autorizado no tiene nota, y un tipo desconocido tampoco', () => {
    assert.deepEqual(armar({ tipo: 'uso_autorizado', desde: '2026-11-16', hasta: '2026-11-16', horas: 7 }),
      { error: 'sinNota' });
    for (const tipo of ['otro', '', null, undefined, 'toString', '__proto__']) {
      assert.deepEqual(armar({ tipo, desde: '2026-11-16', hasta: '2026-11-16', horas: null }), { error: 'sinNota' });
    }
  });
});

describe('notaDeLicencia: las partes fijas, la firma y el nombre', () => {
  it('la fecha, el destinatario, el S / D, el saludo y el cierre', () => {
    const { nota } = armar(VACACIONES);
    assert.equal(nota.fecha, 'Comodoro Rivadavia, 27 de octubre de 2026');
    assert.deepEqual(nota.destinatario, ['Al Señor Director General de', 'Modernización e Investigación Territorial']);
    assert.equal(nota.sd, `S${' '.repeat(15)}/${' '.repeat(15)}D`);
    assert.equal(nota.sd, 'S               /               D');
    assert.equal(nota.saludo, 'De mi mayor consideración:');
    assert.equal(nota.cierre, 'Sin otro particular, saludo a Ud. atentamente.');
  });

  it('la nota tiene exactamente las claves del contrato', () => {
    const resultado = armar(VACACIONES);
    assert.deepEqual(Object.keys(resultado), ['nota']);
    assert.deepEqual(Object.keys(resultado.nota).sort(),
      ['cierre', 'cuerpo', 'destinatario', 'fecha', 'firma', 'nombre', 'saludo', 'sd']);
  });

  it('la fecha de la nota es la que llega, no hoy', () => {
    const { nota } = notaDeLicencia(VACACIONES, { fecha: '2027-01-02', persona: PERSONA, feriados: FERIADOS });
    assert.equal(nota.fecha, 'Comodoro Rivadavia, 2 de enero de 2027');
  });

  it('la firma de planta: el nombre y el cargo', () => {
    assert.deepEqual(armar(VACACIONES).nota.firma, [
      { texto: 'Lucía Fernández', chico: false }, { texto: 'Jefa de División Datos Abiertos', chico: false }
    ]);
    assert.deepEqual(armar(VACACIONES, { ...PERSONA, vinculo: 'planta_politica' }).nota.firma, [
      { texto: 'Lucía Fernández', chico: false }, { texto: 'Jefa de División Datos Abiertos', chico: false }
    ]);
  });

  it('la firma de un contratado: el renglón chico en el medio', () => {
    assert.deepEqual(armar(VACACIONES, { ...PERSONA, vinculo: 'contrato' }).nota.firma, [
      { texto: 'Lucía Fernández', chico: false },
      { texto: 'Personal contratado, cumpliendo funciones de', chico: true },
      { texto: 'Jefa de División Datos Abiertos', chico: false }
    ]);
  });

  it('sin cargo, solo el nombre, también en un contratado', () => {
    for (const cargo of [null, '', '   ', undefined]) {
      for (const vinculo of ['planta_permanente', 'contrato', null]) {
        assert.deepEqual(armar(VACACIONES, { ...PERSONA, cargo, vinculo }).nota.firma,
          [{ texto: 'Lucía Fernández', chico: false }], `cargo ${String(cargo)}, vínculo ${String(vinculo)}`);
      }
    }
  });

  it('sin vínculo, como planta', () => {
    assert.deepEqual(armar(VACACIONES, { ...PERSONA, vinculo: null }).nota.firma, [
      { texto: 'Lucía Fernández', chico: false }, { texto: 'Jefa de División Datos Abiertos', chico: false }
    ]);
  });

  it('el nombre del archivo: el tipo y el desde (no el primer día hábil)', () => {
    assert.equal(armar(VACACIONES).nota.nombre, 'Nota de licencia - Licencia anual ordinaria - 2026-11-16.docx');
    assert.equal(armar({ tipo: 'vacaciones', desde: '2026-10-31', hasta: '2026-11-06', horas: null }).nota.nombre,
      'Nota de licencia - Licencia anual ordinaria - 2026-10-31.docx');
    assert.equal(armar({ tipo: 'horas_a_favor', desde: '2026-10-15', hasta: '2026-10-15', horas: 2.5 }).nota.nombre,
      'Nota de licencia - Horas a favor - 2026-10-15.docx');
  });

  it('cada tipo con nota arma su nota y su nombre', () => {
    // Los días restituidos necesitan además los asuetos que restituyen (sin ellos, error: ver su describe)
    const restitucion = { anio: 2024, fechas: ['2026-11-04'] };
    for (const tipo of TIPOS_CON_NOTA) {
      const resultado = notaDeLicencia({ tipo, desde: '2026-11-16', hasta: '2026-11-16', horas: 2 },
        { fecha: FECHA, persona: PERSONA, feriados: FERIADOS, restitucion });
      assert.ok(resultado.nota, tipo);
      assert.ok(resultado.nota.cuerpo.startsWith(PIDO), tipo);
      assert.equal(resultado.nota.nombre, `Nota de licencia - ${NOMBRES_DEL_ARCHIVO[tipo]} - 2026-11-16.docx`);
    }
  });
});

describe('notaDeLicencia nunca tira', () => {
  it('sin licencia, sin opciones o con lo que no es un objeto: error', () => {
    for (const [licencia, opciones] of [[null, {}], [undefined, undefined], ['vacaciones', {}], [[], {}],
      [VACACIONES, null], [VACACIONES, undefined], [VACACIONES, 'x']]) {
      const resultado = notaDeLicencia(licencia, opciones);
      assert.ok(Object.hasOwn(MENSAJES_NOTA, resultado.error), JSON.stringify(resultado));
      assert.equal(resultado.nota, undefined);
    }
    assert.deepEqual(notaDeLicencia(null, {}), { error: 'error' });
  });

  it('fechas inválidas: error', () => {
    const casos = [
      { ...VACACIONES, desde: '2026-02-30' }, { ...VACACIONES, hasta: null }, { ...VACACIONES, desde: '16/11/2026' },
      { ...VACACIONES, desde: '2026-11-27', hasta: '2026-11-16' },
      { tipo: 'franco', desde: 'x', hasta: 'x', horas: null }, { tipo: 'franquicia', desde: null, hasta: null, horas: 3 }
    ];
    for (const licencia of casos) assert.deepEqual(armar(licencia), { error: 'error' }, JSON.stringify(licencia));
    // La fecha de la nota
    for (const fecha of [null, '2026-13-01', '', 20261027]) {
      assert.deepEqual(notaDeLicencia(VACACIONES, { fecha, persona: PERSONA, feriados: FERIADOS }), { error: 'error' });
    }
  });

  it('horas null o que no son de a media hora, en los tipos por horas: error', () => {
    for (const tipo of ['franquicia', 'horas_a_favor']) {
      for (const horas of [null, undefined, 0, -1, 0.3, NaN, '3']) {
        assert.deepEqual(armar({ tipo, desde: '2026-11-04', hasta: '2026-11-04', horas }), { error: 'error' },
          `${tipo} ${String(horas)}`);
      }
    }
  });

  it('sin persona o sin nombre: error', () => {
    for (const persona of [null, undefined, 'Lucía', {}, { ...PERSONA, nombre: '' }, { ...PERSONA, nombre: '  ' },
      { ...PERSONA, nombre: 3 }]) {
      assert.deepEqual(notaDeLicencia(VACACIONES, { fecha: FECHA, persona, feriados: FERIADOS }), { error: 'error' });
    }
  });

  it('feriados que no son un Set: cuenta solo con los 9 fijos', () => {
    const { nota } = notaDeLicencia(VACACIONES, { fecha: FECHA, persona: PERSONA, feriados: null });
    assert.match(nota.cuerpo, /el usufructo de diez \(10\) días hábiles/);
  });
});

describe('htmlDeLaNota', () => {
  it('la hoja con sus clases y los renglones en orden', () => {
    const html = htmlDeLaNota(armar(VACACIONES, { ...PERSONA, vinculo: 'contrato' }).nota);
    assert.ok(html.startsWith('<div class="me-hoja"><div class="me-hoja-texto">'));
    assert.ok(html.endsWith('</div></div>'));
    const posiciones = [
      '<p class="derecha">Comodoro Rivadavia, 27 de octubre de 2026</p><p></p><p></p>',
      '<p>Al Señor Director General de</p><p>Modernización e Investigación Territorial</p>',
      '<p class="sd">S               /               D</p><p></p>',
      '<p>De mi mayor consideración:</p><p></p>',
      `<p class="sangria justificado">${PIDO}el usufructo de nueve (9) días hábiles`,
      '<p class="sangria">Sin otro particular, saludo a Ud. atentamente.</p><p></p><p></p><p></p><p></p>',
      '<div class="firma"><p>______________________________</p><p>Lucía Fernández</p>'
        + '<p class="chico">Personal contratado, cumpliendo funciones de</p><p>Jefa de División Datos Abiertos</p></div>'
    ].map((parte) => html.indexOf(parte));
    for (const posicion of posiciones) assert.ok(posicion >= 0);
    assert.deepEqual(posiciones, [...posiciones].sort((a, b) => a - b));
  });

  it('todo texto sale escapado', () => {
    const html = htmlDeLaNota(armar(VACACIONES, { ...PERSONA, nombre: 'Ana <b>&</b> "Luz"', cargo: "Jefa d'Área <i>" }).nota);
    assert.ok(html.includes('<p>Ana &lt;b&gt;&amp;&lt;/b&gt; &quot;Luz&quot;</p>'));
    assert.ok(html.includes('<p>Jefa d&#39;Área &lt;i&gt;</p>'));
    assert.ok(!html.includes('<b>'));
    assert.ok(!html.includes('<i>'));
  });

  it('nunca tira: con lo que no es una nota, vacío', () => {
    for (const valor of [null, undefined, 'nota', [], 3]) assert.equal(htmlDeLaNota(valor), '');
    assert.doesNotThrow(() => htmlDeLaNota({ firma: [null, 3], destinatario: 'x' }));
  });
});

describe('aclaracionDeLaNota', () => {
  it('el texto con la fecha corta', () => {
    assert.equal(aclaracionDeLaNota('2026-10-27'),
      'Lleva la fecha del 27/10/2026, la última vez que guardaste un cambio en la licencia. Se baja en Word, para imprimir y firmar.');
  });

  it('con lo que no es una fecha, vacío', () => {
    for (const valor of [null, undefined, '', '2026-02-30', 20261027]) assert.equal(aclaracionDeLaNota(valor), '');
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Los días restituidos por un asueto (spec 2026-10-31-mi-espacio-dias-restituidos, 12): la nota A (la carga de los días
// restituidos, un tipo de licencia más) y la nota B (el pedido de restitución), con los textos aprobados. La persona es la de
// la maqueta, inventada: Julieta Ferreyra, con vacaciones del 11/12/2026 al 08/01/2027 y asuetos el jueves 24 y el jueves
// 31/12/2026, cargados después
// ---------------------------------------------------------------------------------------------------------------------------

const JULIETA = Object.freeze({ nombre: 'Julieta Ferreyra', cargo: 'Coordinadora de Estadística', vinculo: 'planta_permanente' });
const ASUETOS = new Set(['2026-12-24', '2026-12-31']);
const LAS_VACACIONES = Object.freeze({ tipo: 'vacaciones', desde: '2026-12-11', hasta: '2027-01-08', horas: null });
const LOS_RESTITUIDOS = Object.freeze({ tipo: 'restituidos', desde: '2027-04-12', hasta: '2027-04-13', horas: null });
const DE_LA_2024 = Object.freeze({ anio: 2024, fechas: Object.freeze(['2026-12-24', '2026-12-31']) });
const A_LA_2025 = Object.freeze({ anio: 2025, dias: 2, fechas: Object.freeze(['2026-12-24', '2026-12-31']) });
// La nota A lleva la fecha de la carga (la última vez que se guardó) y la nota B, la del pedido
const DIA_DE_LA_CARGA = '2027-04-01';
const DIA_DEL_PEDIDO = '2027-04-01';

const restituidos = (licencia = LOS_RESTITUIDOS, opciones = {}) => notaDeLicencia(licencia,
  { fecha: DIA_DE_LA_CARGA, persona: JULIETA, feriados: ASUETOS, restitucion: DE_LA_2024, ...opciones });
const restitucion = (pedido = A_LA_2025, opciones = {}) =>
  notaDeRestitucion(pedido, { fecha: DIA_DEL_PEDIDO, persona: JULIETA, ...opciones });

// Las hojas de la maqueta (MQ.MODAL_A.segundo y MQ.MODAL_B.cuerpo), copiadas: lo que se ve en el segundo paso
const HOJA = (cuerpoDeLaNota) => '<div class="me-hoja"><div class="me-hoja-texto">'
  + '<p class="derecha">Comodoro Rivadavia, 1 de abril de 2027</p><p></p><p></p>'
  + '<p>Al Señor Director General de</p><p>Modernización e Investigación Territorial</p>'
  + '<p class="sd">S               /               D</p><p></p><p>De mi mayor consideración:</p><p></p>'
  + `<p class="sangria justificado">${cuerpoDeLaNota}</p><p></p>`
  + '<p class="sangria">Sin otro particular, saludo a Ud. atentamente.</p><p></p><p></p><p></p><p></p>'
  + '<div class="firma"><p>______________________________</p><p>Julieta Ferreyra</p><p>Coordinadora de Estadística</p></div>'
  + '</div></div>';
const CUERPO_A = `${PIDO}el usufructo de dos (2) días hábiles de mi licencia anual ordinaria 2024, restituidos por los asuetos de los días jueves 24 y jueves 31 de diciembre de 2026, declarados durante mis vacaciones, a partir del día lunes 12 de abril de 2027.`;
const CUERPO_B = `${PIDO}la restitución a mi licencia anual ordinaria 2025 de dos (2) días hábiles, correspondientes a los asuetos de los días jueves 24 y jueves 31 de diciembre de 2026, declarados durante mis vacaciones.`;

describe('textoDeLosAsuetos', () => {
  it('un mes: «de los días jueves 24 y jueves 31 de diciembre de 2026», por fecha y sin repetir', () => {
    assert.equal(textoDeLosAsuetos(['2026-12-24', '2026-12-31']), 'de los días jueves 24 y jueves 31 de diciembre de 2026');
    assert.equal(textoDeLosAsuetos(['2026-12-31', '2026-12-24', '2026-12-31']),
      'de los días jueves 24 y jueves 31 de diciembre de 2026');
    assert.equal(textoDeLosAsuetos(['2026-12-31', '2026-12-28', '2026-12-24']),
      'de los días jueves 24, lunes 28 y jueves 31 de diciembre de 2026');
  });

  it('dos meses y dos años: cada mes con sus días y el año al final de cada año', () => {
    assert.equal(textoDeLosAsuetos(['2025-12-24', '2025-12-26', '2025-12-31', '2026-01-02']),
      'de los días miércoles 24, viernes 26 y miércoles 31 de diciembre de 2025 y viernes 2 de enero de 2026');
    // Dos meses del mismo año: el año una sola vez
    assert.equal(textoDeLosAsuetos(['2026-11-30', '2026-12-24']),
      'de los días lunes 30 de noviembre y jueves 24 de diciembre de 2026');
    assert.equal(textoDeLosAsuetos(['2026-11-30', '2026-12-24', '2026-12-31', '2027-01-04']),
      'de los días lunes 30 de noviembre, jueves 24 y jueves 31 de diciembre de 2026 y lunes 4 de enero de 2027');
  });

  it('un día: «del día jueves 24 de diciembre de 2026»', () => {
    assert.equal(textoDeLosAsuetos(['2026-12-24']), 'del día jueves 24 de diciembre de 2026');
    assert.equal(textoDeLosAsuetos(['2026-12-24', '2026-12-24']), 'del día jueves 24 de diciembre de 2026');
  });

  it('lo que no es una fecha no va; sin ninguna, o con lo que no es una lista, vacío', () => {
    assert.equal(textoDeLosAsuetos(['2026-12-24', 'x', null, '2026-02-30', 3, '24/12/2026']),
      'del día jueves 24 de diciembre de 2026');
    for (const valor of [[], ['x'], null, undefined, '2026-12-24', {}, 3]) assert.equal(textoDeLosAsuetos(valor), '');
  });
});

describe('notaDeLicencia: los días restituidos (la nota A)', () => {
  it('el cuerpo al pie de la letra, la hoja de la maqueta y el nombre del archivo, con el «Desde»', () => {
    const { nota } = restituidos();
    assert.equal(nota.cuerpo, CUERPO_A);
    assert.equal(nota.fecha, 'Comodoro Rivadavia, 1 de abril de 2027');
    assert.equal(nota.nombre, 'Nota de licencia - Días restituidos - 2027-04-12.docx');
    assert.equal(htmlDeLaNota(nota), HOJA(CUERPO_A));
    assert.deepEqual(Object.keys(nota).sort(), ['cierre', 'cuerpo', 'destinatario', 'fecha', 'firma', 'nombre', 'saludo', 'sd']);
  });

  it('un solo día: «un (1) día hábil», «restituido por el asueto del día …, declarado» y «el día»', () => {
    const { nota } = restituidos({ ...LOS_RESTITUIDOS, hasta: '2027-04-12' }, { restitucion: { anio: 2024, fechas: ['2026-12-24'] } });
    assert.equal(nota.cuerpo,
      `${PIDO}el usufructo de un (1) día hábil de mi licencia anual ordinaria 2024, restituido por el asueto del día jueves 24 de diciembre de 2026, declarado durante mis vacaciones, el día lunes 12 de abril de 2027.`);
  });

  it('los asuetos de varios meses, desordenados: «de los días …» con textoDeLosAsuetos', () => {
    const { nota } = restituidos({ ...LOS_RESTITUIDOS, hasta: '2027-04-15' },
      { restitucion: { anio: 2025, fechas: ['2027-01-04', '2026-12-31', '2026-12-24'] } });
    assert.equal(nota.cuerpo,
      `${PIDO}el usufructo de cuatro (4) días hábiles de mi licencia anual ordinaria 2025, restituidos por los asuetos de los días jueves 24 y jueves 31 de diciembre de 2026 y lunes 4 de enero de 2027, declarados durante mis vacaciones, a partir del día lunes 12 de abril de 2027.`);
  });

  it('«a partir del día» es su primer día hábil; los días se cuentan con los feriados', () => {
    // Desde el sábado 10/04: del lunes 12 al martes 13
    assert.equal(restituidos({ ...LOS_RESTITUIDOS, desde: '2027-04-10' }).nota.cuerpo, CUERPO_A);
    // Un feriado de la tabla el martes 13 (cargado antes de la carga): un solo día hábil
    assert.match(restituidos(LOS_RESTITUIDOS, { feriados: new Set(['2027-04-13']) }).nota.cuerpo,
      /el usufructo de un \(1\) día hábil de mi licencia anual ordinaria 2024, restituido por los asuetos de los días jueves 24 y jueves 31 de diciembre de 2026, declarados durante mis vacaciones, el día lunes 12 de abril de 2027\.$/);
  });

  it('la recursión: un asueto cargado después sobre la carga de los días restituidos no le saca el día (sus restituibles)',
    () => {
      const feriados = new Set([...ASUETOS, '2027-04-13']);
      assert.equal(restituidos(LOS_RESTITUIDOS, { feriados, restituibles: ['2027-04-13'] }).nota.cuerpo, CUERPO_A);
    });

  it('la recursión: los días que se toman de un asueto que cayó en unos días restituidos, «declarado(s) durante mis días '
    + 'restituidos» (`durante`, el tipo de la carga de la que salen)', () => {
    const deLosRestituidos = { anio: 2024, fechas: ['2027-04-13'], durante: 'restituidos' };
    const unDia = restituidos({ ...LOS_RESTITUIDOS, desde: '2027-04-19', hasta: '2027-04-19' }, { restitucion: deLosRestituidos });
    assert.equal(unDia.nota.cuerpo,
      `${PIDO}el usufructo de un (1) día hábil de mi licencia anual ordinaria 2024, restituido por el asueto del día martes 13 de abril de 2027, declarado durante mis días restituidos, el día lunes 19 de abril de 2027.`);
    const dosDias = restituidos({ ...LOS_RESTITUIDOS, desde: '2027-04-19', hasta: '2027-04-20' },
      { restitucion: { ...deLosRestituidos, fechas: ['2027-04-13', '2027-04-14'] } });
    assert.equal(dosDias.nota.cuerpo,
      `${PIDO}el usufructo de dos (2) días hábiles de mi licencia anual ordinaria 2024, restituidos por los asuetos de los días martes 13 y miércoles 14 de abril de 2027, declarados durante mis días restituidos, a partir del día lunes 19 de abril de 2027.`);
    // «vacaciones» o sin el dato, o con otro valor, como siempre: «durante mis vacaciones»
    for (const durante of ['vacaciones', undefined, null, 'medica', 'x', 3]) {
      assert.equal(restituidos(LOS_RESTITUIDOS, { restitucion: { ...DE_LA_2024, durante } }).nota.cuerpo, CUERPO_A, String(durante));
    }
  });

  it('sin ningún día hábil ni restituible: sin nota, con su error', () => {
    assert.deepEqual(restituidos(LOS_RESTITUIDOS, { feriados: new Set(['2027-04-12', '2027-04-13']) }),
      { error: 'sinDiasHabiles' });
  });

  it('sin los asuetos que restituye, o con unos que no sirven: error', () => {
    for (const valor of [undefined, null, 'x', [], {}, { anio: 2024 }, { fechas: ['2026-12-24'] },
      { anio: 2024, fechas: [] }, { anio: 2024, fechas: ['x', null] }, { anio: 2024, fechas: '2026-12-24' },
      { anio: '2024', fechas: ['2026-12-24'] }, { anio: 2024.5, fechas: ['2026-12-24'] }, { anio: 0, fechas: ['2026-12-24'] },
      { anio: null, fechas: ['2026-12-24'] }]) {
      assert.deepEqual(restituidos(LOS_RESTITUIDOS, { restitucion: valor }), { error: 'error' }, JSON.stringify(valor));
    }
  });

  it('los demás tipos no miran los asuetos que restituye una carga', () => {
    assert.deepEqual(armar(VACACIONES), notaDeLicencia(VACACIONES,
      { fecha: FECHA, persona: PERSONA, feriados: FERIADOS, restitucion: DE_LA_2024 }));
  });
});

describe('notaDeLicencia: los días restituibles cuentan en la carga (las vacaciones conservan sus días)', () => {
  const vacaciones = (opciones = {}) =>
    notaDeLicencia(LAS_VACACIONES, { fecha: '2026-11-27', persona: JULIETA, feriados: ASUETOS, ...opciones });
  const DIECINUEVE = `${PIDO}el usufructo de diecinueve (19) días hábiles correspondientes a mi licencia anual ordinaria, a partir del día viernes 11 de diciembre de 2026.`;

  it('con los asuetos cargados después y sus restituibles, sigue diciendo «diecinueve (19)», como la nota que se presentó', () => {
    assert.equal(vacaciones({ restituibles: ['2026-12-24', '2026-12-31'] }).nota.cuerpo, DIECINUEVE);
    // Sin los asuetos, 19 de por sí; con los asuetos y sin foto (el asueto ya estaba), 17, como hoy
    assert.equal(vacaciones({ feriados: new Set() }).nota.cuerpo, DIECINUEVE);
    assert.match(vacaciones().nota.cuerpo, /el usufructo de diecisiete \(17\) días hábiles/);
    assert.match(vacaciones({ restituibles: [] }).nota.cuerpo, /el usufructo de diecisiete \(17\) días hábiles/);
  });

  it('cada día una vez: un restituible repetido o que ya es hábil no suma; uno fuera de las fechas o que no es una fecha, '
    + 'tampoco', () => {
    assert.equal(vacaciones({
      restituibles: ['2026-12-31', '2026-12-24', '2026-12-24', '2026-12-14', '2026-12-10', '2027-01-11', 'x', null, 3]
    }).nota.cuerpo, DIECINUEVE);
    for (const restituibles of [null, undefined, 'x', {}, 3]) {
      assert.match(vacaciones({ restituibles }).nota.cuerpo, /diecisiete \(17\)/, String(restituibles));
    }
  });

  it('un restituible en el primer día lo vuelve «a partir del día»', () => {
    const { nota } = notaDeLicencia({ tipo: 'vacaciones', desde: '2026-12-24', hasta: '2027-01-08', horas: null },
      { fecha: '2026-11-27', persona: JULIETA, feriados: ASUETOS, restituibles: ['2026-12-24', '2026-12-31'] });
    assert.ok(nota.cuerpo.endsWith('a partir del día jueves 24 de diciembre de 2026.'), nota.cuerpo);
    // Del 24/12 al 08/01: el 28, el 29 y el 30/12 y del 4 al 8/01 son hábiles (el 25/12 y el 1/01 son fijos), más los dos
    assert.match(nota.cuerpo, /el usufructo de diez \(10\) días hábiles/);
  });

  it('los demás tipos no los suman: solo las vacaciones y los días restituidos tienen restituibles', () => {
    const estudios = { tipo: 'estudios', desde: '2026-12-23', hasta: '2026-12-24', horas: null };
    assert.deepEqual(notaDeLicencia(estudios, { fecha: FECHA, persona: JULIETA, feriados: ASUETOS, restituibles: ['2026-12-24'] }),
      notaDeLicencia(estudios, { fecha: FECHA, persona: JULIETA, feriados: ASUETOS }));
  });
});

describe('notaDeRestitucion (la nota B)', () => {
  it('el cuerpo al pie de la letra, la hoja de la maqueta y el nombre del archivo, con el día del pedido', () => {
    const { nota } = restitucion();
    assert.equal(nota.cuerpo, CUERPO_B);
    assert.equal(nota.fecha, 'Comodoro Rivadavia, 1 de abril de 2027');
    assert.equal(nota.nombre, 'Nota de restitución - Licencia 2025 - 2027-04-01.docx');
    assert.equal(htmlDeLaNota(nota), HOJA(CUERPO_B));
  });

  it('la misma estructura que la nota de una licencia: las mismas claves, las partes fijas y la firma', () => {
    const resultado = restitucion();
    assert.deepEqual(Object.keys(resultado), ['nota']);
    const { nota } = resultado;
    const deLaLicencia = restituidos().nota;
    assert.deepEqual(Object.keys(nota).sort(), Object.keys(deLaLicencia).sort());
    for (const clave of ['destinatario', 'sd', 'saludo', 'cierre', 'firma']) assert.deepEqual(nota[clave], deLaLicencia[clave], clave);
  });

  it('un solo día: «un (1) día hábil, correspondiente al asueto del día …, declarado durante mis vacaciones»', () => {
    assert.equal(restitucion({ anio: 2025, dias: 1, fechas: ['2026-12-24'] }).nota.cuerpo,
      `${PIDO}la restitución a mi licencia anual ordinaria 2025 de un (1) día hábil, correspondiente al asueto del día jueves 24 de diciembre de 2026, declarado durante mis vacaciones.`);
  });

  it('los asuetos de dos años, desordenados', () => {
    assert.equal(restitucion({ anio: 2025, dias: 4, fechas: ['2026-01-02', '2025-12-31', '2025-12-26', '2025-12-24'] }).nota.cuerpo,
      `${PIDO}la restitución a mi licencia anual ordinaria 2025 de cuatro (4) días hábiles, correspondientes a los asuetos de los días miércoles 24, viernes 26 y miércoles 31 de diciembre de 2025 y viernes 2 de enero de 2026, declarados durante mis vacaciones.`);
  });

  it('la firma de un contratado y sin cargo, como la nota de una licencia', () => {
    assert.deepEqual(restitucion(A_LA_2025, { persona: { ...JULIETA, vinculo: 'contrato' } }).nota.firma, [
      { texto: 'Julieta Ferreyra', chico: false },
      { texto: 'Personal contratado, cumpliendo funciones de', chico: true },
      { texto: 'Coordinadora de Estadística', chico: false }
    ]);
    assert.deepEqual(restitucion(A_LA_2025, { persona: { ...JULIETA, cargo: null } }).nota.firma,
      [{ texto: 'Julieta Ferreyra', chico: false }]);
  });

  it('nunca tira: un pedido, una fecha o una persona que no sirven dan error', () => {
    for (const [pedido, opciones] of [[null, {}], [undefined, undefined], ['pedido', {}], [[], {}], [A_LA_2025, null],
      [A_LA_2025, 'x']]) {
      assert.deepEqual(notaDeRestitucion(pedido, opciones), { error: 'error' }, JSON.stringify([pedido, opciones]));
    }
    for (const pedido of [
      { ...A_LA_2025, anio: '2025' }, { ...A_LA_2025, anio: null }, { ...A_LA_2025, anio: 25.5 }, { ...A_LA_2025, anio: 0 },
      { ...A_LA_2025, dias: 0 }, { ...A_LA_2025, dias: -1 }, { ...A_LA_2025, dias: 1.5 }, { ...A_LA_2025, dias: '2' },
      { ...A_LA_2025, dias: 1000 }, { ...A_LA_2025, dias: null }, { ...A_LA_2025, fechas: [] },
      { ...A_LA_2025, fechas: ['x'] }, { ...A_LA_2025, fechas: null }, { ...A_LA_2025, fechas: '2026-12-24' }
    ]) {
      assert.deepEqual(restitucion(pedido), { error: 'error' }, JSON.stringify(pedido));
    }
    for (const fecha of [null, '', '2027-02-30', 20270401]) {
      assert.deepEqual(restitucion(A_LA_2025, { fecha }), { error: 'error' }, String(fecha));
    }
    for (const persona of [null, 'Julieta', {}, { ...JULIETA, nombre: '  ' }, { ...JULIETA, nombre: 3 }]) {
      assert.deepEqual(restitucion(A_LA_2025, { persona }), { error: 'error' }, JSON.stringify(persona));
    }
  });
});

describe('aclaracionDeLaRestitucion', () => {
  it('el texto con la fecha corta del pedido', () => {
    assert.equal(aclaracionDeLaRestitucion('2027-04-01'),
      'Lleva la fecha del 01/04/2027, el día en que pediste la restitución. Se baja en Word, para imprimir y firmar.');
  });

  it('con lo que no es una fecha, vacío', () => {
    for (const valor of [null, undefined, '', '2027-02-30', 20270401]) assert.equal(aclaracionDeLaRestitucion(valor), '');
  });
});
