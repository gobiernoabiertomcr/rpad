// Mi espacio, la nota de licencia en Word (spec 2026-10-27-mi-espacio-licencia-word, secciones 2 y 4): la nota como
// estructura, su HTML y la aclaración, puras y sin base. Las personas son inventadas.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPOS_CON_NOTA, NOMBRES_DEL_ARCHIVO, MENSAJES_NOTA, enLetras, textoDeHoras, notaDeLicencia, htmlDeLaNota,
  aclaracionDeLaNota
} from '../services/miEspacioNota.js';

const PERSONA = Object.freeze({ nombre: 'Lucía Fernández', cargo: 'Jefa de División Datos Abiertos', vinculo: 'planta_permanente' });
// El lunes 23/11/2026, feriado de la tabla (los 9 fijos ya los saca esDiaHabil)
const FERIADOS = new Set(['2026-11-23']);
const FECHA = '2026-10-27';

const PIDO = 'Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar ';
const armar = (licencia, persona = PERSONA) => notaDeLicencia(licencia, { fecha: FECHA, persona, feriados: FERIADOS });
const cuerpo = (licencia) => armar(licencia).nota.cuerpo;
const VACACIONES = Object.freeze({ tipo: 'vacaciones', desde: '2026-11-16', hasta: '2026-11-27', horas: null });

describe('las constantes', () => {
  it('los ocho tipos con nota, en el orden de TIPOS_LICENCIA y sin el uso autorizado', () => {
    assert.deepEqual([...TIPOS_CON_NOTA], [
      'vacaciones', 'franquicia', 'estudios', 'medica', 'medica_extraordinaria', 'familiar', 'franco', 'horas_a_favor'
    ]);
    assert.ok(Object.isFrozen(TIPOS_CON_NOTA));
  });

  it('el nombre de cada tipo en el archivo', () => {
    assert.deepEqual(NOMBRES_DEL_ARCHIVO, {
      vacaciones: 'Licencia anual ordinaria', franquicia: 'Franquicia', estudios: 'Estudios', medica: 'Atención médica',
      familiar: 'Atención del grupo familiar', medica_extraordinaria: 'Médica extraordinaria', franco: 'Franco compensatorio',
      horas_a_favor: 'Horas a favor'
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

  it('horas a favor: el mes anterior y la concordancia de las medias', () => {
    assert.equal(cuerpo({ tipo: 'horas_a_favor', desde: '2026-10-15', hasta: '2026-10-15', horas: 2.5 }),
      `${PIDO}el usufructo de dos horas y media (2,5) a favor, correspondientes a las horas extras realizadas en septiembre de 2026, el día jueves 15 de octubre de 2026.`);
    assert.match(cuerpo({ tipo: 'horas_a_favor', desde: '2026-10-15', hasta: '2026-10-15', horas: 0.5 }),
      /media hora \(0,5\) a favor, correspondiente a las horas/);
    assert.match(cuerpo({ tipo: 'horas_a_favor', desde: '2026-10-15', hasta: '2026-10-15', horas: 1 }),
      /una \(1\) hora a favor, correspondiente a las horas/);
    assert.match(cuerpo({ tipo: 'horas_a_favor', desde: '2026-10-15', hasta: '2026-10-15', horas: 1.5 }),
      /una hora y media \(1,5\) a favor, correspondiente a las horas/);
    assert.match(cuerpo({ tipo: 'horas_a_favor', desde: '2026-10-15', hasta: '2026-10-15', horas: 2 }),
      /dos \(2\) horas a favor, correspondientes a las horas/);
    assert.match(cuerpo({ tipo: 'horas_a_favor', desde: '2027-01-15', hasta: '2027-01-15', horas: 1 }),
      /realizadas en diciembre de 2026/);
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
    for (const tipo of TIPOS_CON_NOTA) {
      const resultado = armar({ tipo, desde: '2026-11-16', hasta: '2026-11-16', horas: 2 });
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
