// El aviso diario de la agenda (spec 2026-11-04-agenda-aviso-y-dependencia, 2, 4 y 5): las reglas puras, con hoy fijo. Las personas son
// inventadas: Micaela depende de Federico, que depende de Graciela
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CALENDARIO_FIJO } from '../services/notasDigitalesCalendario.js';
import {
  cuandoLlegaElAviso, fraseDelAviso, superioresConNombre, mensajeDelGuardado, mensajeDeLaCasilla
} from '../services/miEspacioEventosDiarioReglas.js';

const calendario = CALENDARIO_FIJO;
// El miércoles 04/11/2026
const A_LA_MANANA = '2026-11-04 10:30:00';
const A_LA_TARDE = '2026-11-04 15:00:00';
const cuando = (fecha, ahora = A_LA_MANANA, desde = null) => cuandoLlegaElAviso({ fecha, desde, ahora, calendario });

describe('cuandoLlegaElAviso (spec, 2.3 y 5.4)', () => {
  it('sin una fecha, el genérico', () => {
    for (const fecha of [undefined, null, '', 'mañana', '2026-13-01', 7]) {
      assert.deepEqual(cuando(fecha), { llega: true, cuando: 'el día hábil anterior a las 14:00' }, String(fecha));
    }
  });

  it('mañana, antes de las 14:00 de hoy: hoy a las 14:00; después, a las 8:05 de ese día', () => {
    assert.deepEqual(cuando('2026-11-05'), { llega: true, cuando: 'hoy a las 14:00' });
    assert.deepEqual(cuando('2026-11-05', A_LA_TARDE), { llega: true, cuando: 'el jueves 05/11 a las 8:05' });
    // A las 14:00 justas ya salió
    assert.deepEqual(cuando('2026-11-05', '2026-11-04 14:00:00'), { llega: true, cuando: 'el jueves 05/11 a las 8:05' });
    assert.deepEqual(cuando('2026-11-05', '2026-11-04 13:59:59'), { llega: true, cuando: 'hoy a las 14:00' });
  });

  it('más adelante, el día hábil anterior a las 14:00, también de un lunes, de un sábado y con un feriado en el medio', () => {
    assert.deepEqual(cuando('2026-11-06'), { llega: true, cuando: 'el jueves 05/11 a las 14:00' });
    assert.deepEqual(cuando('2026-11-09'), { llega: true, cuando: 'el viernes 06/11 a las 14:00' });
    assert.deepEqual(cuando('2026-11-07'), { llega: true, cuando: 'el viernes 06/11 a las 14:00' });
    // El 25/12/2026 es viernes y feriado
    assert.deepEqual(cuando('2026-12-28', '2026-12-21 10:00:00'), { llega: true, cuando: 'el jueves 24/12 a las 14:00' });
  });

  it('hoy, o una fecha que ya pasó, no llega', () => {
    assert.deepEqual(cuando('2026-11-04'), { llega: false, motivo: 'como es para hoy' });
    assert.deepEqual(cuando('2026-11-03'), { llega: false, motivo: 'como ya pasó' });
  });

  it('un sábado o un feriado con el aviso de ese día ya salido, no llega; antes de que salga, sí', () => {
    assert.deepEqual(cuando('2026-11-07', '2026-11-06 15:00:00'), { llega: false, motivo: 'como ya salió el aviso de ese día' });
    assert.deepEqual(cuando('2026-11-07', '2026-11-06 10:00:00'), { llega: true, cuando: 'hoy a las 14:00' });
    assert.deepEqual(cuando('2026-12-25', '2026-12-24 15:00:00'), { llega: false, motivo: 'como ya salió el aviso de ese día' });
  });

  it('con hoy no hábil: de un sábado para el lunes, y de un feriado para el día siguiente, a las 8:05', () => {
    assert.deepEqual(cuando('2026-11-09', '2026-11-07 11:00:00'), { llega: true, cuando: 'el lunes 09/11 a las 8:05' });
    assert.deepEqual(cuando('2026-11-09', '2026-11-08 20:00:00'), { llega: true, cuando: 'el lunes 09/11 a las 8:05' });
    assert.deepEqual(cuando('2026-12-28', '2026-12-25 11:00:00'), { llega: true, cuando: 'el lunes 28/12 a las 8:05' });
    // De un sábado para el domingo: nada lo cubre
    assert.deepEqual(cuando('2026-11-08', '2026-11-07 11:00:00'), { llega: false, motivo: 'como ya salió el aviso de ese día' });
  });

  it('el que empieza a las 8:05 o antes, cargado después del aviso de la tarde, no llega; a las 8:06, sí', () => {
    assert.deepEqual(cuando('2026-11-05', A_LA_TARDE, '07:30'), { llega: false, motivo: 'como empieza antes de las 8:05' });
    assert.deepEqual(cuando('2026-11-05', A_LA_TARDE, '08:05'), { llega: false, motivo: 'como empieza antes de las 8:05' });
    assert.deepEqual(cuando('2026-11-05', A_LA_TARDE, '08:06'), { llega: true, cuando: 'el jueves 05/11 a las 8:05' });
    assert.deepEqual(cuando('2026-11-05', A_LA_TARDE, '08:15'), { llega: true, cuando: 'el jueves 05/11 a las 8:05' });
    // Con el aviso de la tarde todavía por salir, la hora no importa
    assert.deepEqual(cuando('2026-11-05', A_LA_MANANA, '07:30'), { llega: true, cuando: 'hoy a las 14:00' });
  });
});

describe('fraseDelAviso (spec, 2.3)', () => {
  it('en plural y en singular, si llega', () => {
    const aviso = { llega: true, cuando: 'el jueves 05/11 a las 14:00' };
    assert.equal(fraseDelAviso(aviso, 2), 'De quienes dependés: les llega la notificación por mail el jueves 05/11 a las 14:00.');
    assert.equal(fraseDelAviso(aviso, 1), 'De quien dependés: le llega la notificación por mail el jueves 05/11 a las 14:00.');
  });

  it('en plural y en singular, si no llega', () => {
    const aviso = { llega: false, motivo: 'como es para hoy' };
    assert.equal(fraseDelAviso(aviso, 3), 'De quienes dependés: como es para hoy, no les llega ningún mail.');
    assert.equal(fraseDelAviso(aviso, 1), 'De quien dependés: como es para hoy, no le llega ningún mail.');
  });

  it('sin nadie, nada', () => {
    assert.equal(fraseDelAviso({ llega: true, cuando: 'x' }, 0), '');
    assert.equal(fraseDelAviso({ llega: true, cuando: 'x' }, undefined), '');
  });
});

describe('superioresConNombre', () => {
  const fila = (id, nombre, dependeDe = null, activo = true) => ({ id, nombre_completo: nombre, depende_de: dependeDe, activo });
  it('de la más cercana a la más lejana, con el nombre corto contra todos los activos', () => {
    const usuarios = [fila(1, 'Graciela Paz'), fila(2, 'Federico Ríos', 1), fila(3, 'Micaela Ojeda', 2), fila(4, 'Federico Soria')];
    assert.deepEqual(superioresConNombre(3, usuarios), [{ id: 2, nombre_corto: 'Federico R.' }, { id: 1, nombre_corto: 'Graciela' }]);
    assert.deepEqual(superioresConNombre(1, usuarios), []);
  });

  it('una desactivada no aparece ni cuenta para el nombre', () => {
    const usuarios = [fila(1, 'Graciela Paz'), fila(2, 'Federico Ríos', 1, false), fila(3, 'Micaela Ojeda', 2), fila(4, 'Graciela Soria', null, false)];
    assert.deepEqual(superioresConNombre(3, usuarios), [{ id: 1, nombre_corto: 'Graciela' }]);
  });
});

describe('mensajeDelGuardado (spec, 2.5)', () => {
  const quienTexto = 'Lo ven Lucía y Tomás como «Trámite personal»';
  const llega = { llega: true, cuando: 'hoy a las 14:00' };
  it('un Privado y un Laboral', () => {
    assert.equal(mensajeDelGuardado({ tipo: 'privado', verbo: 'guardado', quienTexto: 'Solo vos' }), 'Evento guardado. Solo vos lo ves.');
    assert.equal(mensajeDelGuardado({ tipo: 'privado', verbo: 'cambiado', quienTexto: 'Solo vos' }), 'Evento cambiado. Solo vos lo ves.');
    assert.equal(mensajeDelGuardado({ tipo: 'laboral', verbo: 'guardado', quienTexto: 'Con Federico' }), 'Evento guardado. Con Federico.');
    assert.equal(mensajeDelGuardado({ tipo: 'laboral', verbo: 'cambiado', quienTexto: 'Con todos' }), 'Evento cambiado. Con todos.');
  });

  it('un Público con su cadena, en plural y en singular', () => {
    assert.equal(mensajeDelGuardado({ tipo: 'publico', verbo: 'guardado', quienTexto, superiores: ['Federico', 'Graciela'], aviso: llega }),
      'Evento guardado. Lo ven Lucía y Tomás como «Trámite personal» en su agenda, y a Federico y Graciela les llega antes del evento.');
    assert.equal(mensajeDelGuardado({ tipo: 'publico', verbo: 'cambiado', quienTexto, superiores: ['Graciela'], aviso: llega }),
      'Evento cambiado. Lo ven Lucía y Tomás como «Trámite personal» en su agenda, y a Graciela le llega antes del evento.');
  });

  it('un Público sin nadie arriba, o que no llega en ningún aviso, no nombra a nadie', () => {
    const esperado = 'Evento guardado. Lo ven Lucía y Tomás como «Trámite personal» en su agenda.';
    assert.equal(mensajeDelGuardado({ tipo: 'publico', verbo: 'guardado', quienTexto, superiores: [], aviso: llega }), esperado);
    for (const motivo of ['como es para hoy', 'como ya pasó', 'como ya salió el aviso de ese día']) {
      assert.equal(mensajeDelGuardado({ tipo: 'publico', verbo: 'guardado', quienTexto, superiores: ['Federico'], aviso: { llega: false, motivo } }), esperado, motivo);
    }
  });
});

describe('mensajeDeLaCasilla (spec, 2.7)', () => {
  it('cada caso', () => {
    assert.equal(mensajeDeLaCasilla({ recibir: true, alguienDepende: true }), 'Te va a llegar tu agenda por mail.');
    assert.equal(mensajeDeLaCasilla({ recibir: true, alguienDepende: false }), 'Te va a llegar tu agenda por mail.');
    assert.equal(mensajeDeLaCasilla({ recibir: false, alguienDepende: true }), 'Ya no te llega tu agenda por mail. Lo de quienes dependen de vos te llega igual.');
    assert.equal(mensajeDeLaCasilla({ recibir: false, alguienDepende: false }), 'Ya no te llega tu agenda por mail.');
  });
});
