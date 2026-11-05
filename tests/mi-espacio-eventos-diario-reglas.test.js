// El aviso diario de la agenda (spec 2026-11-04-agenda-aviso-y-dependencia, 2, 4 y 5): las reglas puras, con hoy fijo. Las personas son
// inventadas: Micaela depende de Federico, que depende de Graciela
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CALENDARIO_FIJO } from '../services/notasDigitalesCalendario.js';
import { avisoDiarioTemplate } from '../services/emailTemplates.js';
import {
  cuandoLlegaElAviso, fraseDelAviso, superioresConNombre, mensajeDelGuardado, mensajeDeLaCasilla, diasDelAviso, mailDeLaPersona,
  claveDeInformado, textoDelResultadoDelDiario, textoDeLaCorridaDelDiario, alertasDeLaCorridaDelDiario, alertaSinEstadoDelDiario
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

describe('diasDelAviso (spec, 5.3)', () => {
  it('un martes, mañana; un viernes, el sábado, el domingo y el lunes', () => {
    assert.deepEqual(diasDelAviso('2026-11-03', calendario), ['2026-11-04']);
    assert.deepEqual(diasDelAviso('2026-11-06', calendario), ['2026-11-07', '2026-11-08', '2026-11-09']);
  });

  it('antes de un feriado, también ese feriado', () => {
    // El 25/12/2026 es viernes y feriado
    assert.deepEqual(diasDelAviso('2026-12-24', calendario), ['2026-12-25', '2026-12-26', '2026-12-27', '2026-12-28']);
  });
});

describe('mailDeLaPersona (spec, 5.2 a 5.4)', () => {
  // Graciela (1) está arriba; Federico (2) depende de ella; Micaela (3), de Federico; Lucía (4), de Graciela; Tomás (5) no depende de nadie
  const usuario = (id, nombre, dependeDe = null, cambios = {}) => ({
    id, nombre_completo: nombre, email: `u${id}@ejemplo.test`, activo: true, depende_de: dependeDe, eventos_por_mail: true, ...cambios
  });
  const USUARIOS = [usuario(1, 'Graciela Paz'), usuario(2, 'Federico Ríos', 1), usuario(3, 'Micaela Ojeda', 2), usuario(4, 'Lucía Ortiz', 1), usuario(5, 'Tomás Vera')];
  const [GRACIELA, FEDERICO, MICAELA, LUCIA, TOMAS] = USUARIOS;
  const JUEVES_TARDE = '2026-11-05 14:00:00';
  const VIERNES_MANANA = '2026-11-06 08:05:00';
  const evento = (id, cambios = {}) => ({
    id, creado_por: 3, creador: 'Micaela Ojeda', creador_activo: true, titulo: `Título ${id}`, detalle: `Detalle ${id}`, fecha: '2026-11-06', desde: '10:00',
    hasta: null, compartido: false, para_todos: false, publico: false, publico_todos: false, texto_publico: null, publicado_at: null, personas: [], vistas: [],
    recordatorio: 'ninguno', ...cambios
  });
  const publico = (id, cambios = {}) => evento(id, { publico: true, texto_publico: 'Fuera de la oficina', publicado_at: '2026-11-02 10:00:00', ...cambios });
  const mail = (persona, eventos, { momento = 'tarde', ahora = JUEVES_TARDE, informados = new Set(), usuarios = USUARIOS } = {}) => mailDeLaPersona({
    persona, eventos, informados, momento, ahora, calendario, usuarios
  });

  describe('a las 14:00', () => {
    it('lo propio de los tres tipos, con título, detalle y su marca', () => {
      const resultado = mail(MICAELA, [
        evento(1),
        publico(2, { vistas: [{ id: 4, nombre: 'Lucía Ortiz' }, { id: 5, nombre: 'Tomás Vera' }] }),
        evento(3, { compartido: true, personas: [{ id: 2, nombre: 'Federico Ríos', sin_recordatorio: false }] }),
        evento(4, { compartido: true, para_todos: true })
      ]);
      assert.deepEqual(resultado.propios.map(({ evento_id: id, titulo, detalle, marca }) => [id, titulo, detalle, marca]), [
        [1, 'Título 1', 'Detalle 1', 'Solo vos lo ves'],
        [2, 'Título 2', 'Detalle 2', 'Lo ven Lucía y Tomás como «Fuera de la oficina»'],
        [3, 'Título 3', 'Detalle 3', 'Laboral, con Federico'],
        [4, 'Título 4', 'Detalle 4', 'Laboral, con todos']
      ]);
      assert.deepEqual(resultado.gente, []);
      assert.deepEqual(resultado.informa, []);
      assert.deepEqual(resultado.dias, ['2026-11-06']);
    });

    it('un Laboral de otra persona, con una fila suya o «Todos»: título, detalle y de quién es; con su recordatorio apagado, también', () => {
      const eventos = [
        evento(1, { compartido: true, personas: [{ id: 4, nombre: 'Lucía Ortiz', sin_recordatorio: true }] }),
        evento(2, { compartido: true, para_todos: true }),
        evento(3, { compartido: true, personas: [{ id: 5, nombre: 'Tomás Vera', sin_recordatorio: false }] })
      ];
      assert.deepEqual(mail(LUCIA, eventos).propios.map(({ evento_id: id, titulo, marca }) => [id, titulo, marca]), [
        [1, 'Título 1', 'Laboral, de Micaela'], [2, 'Título 2', 'Laboral, de Micaela']
      ]);
    });

    it('un Privado de otra persona no le llega a nadie, tampoco a sus superiores', () => {
      const eventos = [evento(1)];
      for (const persona of [FEDERICO, GRACIELA, LUCIA, TOMAS]) assert.equal(mail(persona, eventos), null, persona.nombre_completo);
    });

    it('un Público de su gente le llega a toda la cadena, aunque no lo hayan marcado', () => {
      const eventos = [publico(1, { vistas: [{ id: 5, nombre: 'Tomás Vera' }], hasta: '11:00' })];
      for (const persona of [FEDERICO, GRACIELA]) {
        const resultado = mail(persona, eventos);
        assert.deepEqual(resultado.gente, [{ evento_id: 1, fecha: '2026-11-06', desde: '10:00', hasta: '11:00', texto: 'Micaela: Fuera de la oficina', nuevo: false }], persona.nombre_completo);
        assert.deepEqual(resultado.informa, [{ evento_id: 1, fecha: '2026-11-06' }]);
        assert.deepEqual(resultado.propios, []);
      }
    });

    it('**a quien solo fue elegida no le llega nada**, aunque lo vea en su agenda', () => {
      const eventos = [publico(1, { vistas: [{ id: 4, nombre: 'Lucía Ortiz' }, { id: 5, nombre: 'Tomás Vera' }] }), publico(2, { publico_todos: true })];
      assert.equal(mail(LUCIA, eventos), null);
      assert.equal(mail(TOMAS, eventos), null);
    });

    it('**de un Público ajeno no se lee ni el título, ni el detalle, ni con quién está**', () => {
      const conTrampas = publico(1);
      for (const campo of ['titulo', 'detalle', 'personas', 'vistas']) {
        Object.defineProperty(conTrampas, campo, { get() { throw new Error(`se leyó ${campo}`); } });
      }
      for (const persona of [FEDERICO, GRACIELA, TOMAS, LUCIA]) {
        const resultado = mail(persona, [conTrampas]);
        if (resultado) assert.ok(!JSON.stringify(resultado).includes('Título'));
      }
      assert.equal(mail(FEDERICO, [conTrampas]).gente[0].texto, 'Micaela: Fuera de la oficina');
    });

    it('con publico y compartido juntos (datos mal), manda el Público: a un Laboral no entra', () => {
      const mal = publico(1, { compartido: true, para_todos: true, personas: [{ id: 5, nombre: 'Tomás Vera', sin_recordatorio: false }] });
      assert.equal(mail(TOMAS, [mal]), null);
      assert.equal(mail(FEDERICO, [mal]).gente[0].texto, 'Micaela: Fuera de la oficina');
      assert.deepEqual(mail(FEDERICO, [mal]).propios, []);
    });

    it('sin la casilla, solo lo de su gente; sin gente, nada', () => {
      const sinCasilla = { ...FEDERICO, eventos_por_mail: false };
      const eventos = [evento(1, { creado_por: 2, creador: 'Federico Ríos' }), publico(2)];
      const resultado = mail(sinCasilla, eventos);
      assert.deepEqual(resultado.propios, []);
      assert.equal(resultado.gente.length, 1);
      assert.equal(mail({ ...MICAELA, eventos_por_mail: false }, [evento(3)]), null);
    });

    it('un Público de un creador desactivado no entra', () => {
      assert.equal(mail(FEDERICO, [publico(1, { creador_activo: false })]), null);
    });

    it('un superior desactivado no corta la cadena: lo de abajo le llega al siguiente', () => {
      const usuarios = USUARIOS.map((fila) => (fila.id === 2 ? { ...fila, activo: false } : fila));
      assert.equal(mail(GRACIELA, [publico(1)], { usuarios }).gente.length, 1);
    });

    it('sin nada, null; lo de otros días no entra', () => {
      assert.equal(mail(MICAELA, []), null);
      assert.equal(mail(MICAELA, [evento(1, { fecha: '2026-11-07' })]), null);
      assert.equal(mail(FEDERICO, [publico(1, { fecha: '2026-11-10' })]), null);
    });

    it('un viernes cubre hasta el lunes', () => {
      const resultado = mail(MICAELA, [evento(1, { fecha: '2026-11-07' }), evento(2, { fecha: '2026-11-08' }), evento(3, { fecha: '2026-11-09' }), evento(4, { fecha: '2026-11-10' })],
        { ahora: '2026-11-06 14:00:00' });
      assert.deepEqual(resultado.propios.map((item) => item.evento_id), [1, 2, 3]);
      assert.deepEqual(resultado.dias, ['2026-11-07', '2026-11-08', '2026-11-09']);
      assert.equal(resultado.soloHoy, false);
    });

    it('a un superior, lo rezagado de hoy que no empezó, marcado como nuevo', () => {
      const ahora = '2026-11-06 14:00:00';
      const rezagado = publico(1, { fecha: '2026-11-06', desde: '16:00', publicado_at: '2026-11-05 15:00:00' });
      const resultado = mail(FEDERICO, [rezagado], { ahora });
      assert.deepEqual(resultado.gente.map(({ evento_id: id, nuevo }) => [id, nuevo]), [[1, true]]);
      assert.equal(resultado.soloHoy, true);
      assert.deepEqual(resultado.informa, [{ evento_id: 1, fecha: '2026-11-06' }]);
      // Ya empezó, se cargó hoy o ya se informó: no
      assert.equal(mail(FEDERICO, [{ ...rezagado, desde: '13:00' }], { ahora }), null);
      assert.equal(mail(FEDERICO, [{ ...rezagado, publicado_at: '2026-11-06 09:00:00' }], { ahora }), null);
      assert.equal(mail(FEDERICO, [rezagado], { ahora, informados: new Set([claveDeInformado(1, 2, '2026-11-06')]) }), null);
    });
  });

  describe('a las 8:05', () => {
    const opciones = (informados = new Set()) => ({ momento: 'manana', ahora: VIERNES_MANANA, informados });
    const cargadoAyer = (id = 1, cambios = {}) => publico(id, { desde: '08:15', publicado_at: '2026-11-05 14:02:00', ...cambios });

    it('el ejemplo de la spec: cargado el jueves a las 14:02 para el viernes a las 8:15, les llega a toda la cadena', () => {
      for (const persona of [FEDERICO, GRACIELA]) {
        const resultado = mail(persona, [cargadoAyer()], opciones());
        assert.deepEqual(resultado.gente.map(({ evento_id: id, nuevo }) => [id, nuevo]), [[1, true]]);
        assert.equal(resultado.soloHoy, true);
      }
      assert.equal(mail(LUCIA, [cargadoAyer()], opciones()), null);
    });

    it('**quien lo cargó no recibe el aviso de las 8:05 por su propio evento**', () => {
      assert.equal(mail(MICAELA, [cargadoAyer()], opciones()), null);
    });

    it('sin un rezagado, nada: ni lo informado, ni lo que se cargó hoy, ni lo que ya empezó', () => {
      const informados = new Set([claveDeInformado(1, 2, '2026-11-06')]);
      assert.equal(mail(FEDERICO, [cargadoAyer()], opciones(informados)), null);
      assert.equal(mail(FEDERICO, [cargadoAyer(1, { publicado_at: '2026-11-06 07:30:00' })], opciones()), null);
      assert.equal(mail(FEDERICO, [cargadoAyer(1, { desde: '07:30' })], opciones()), null);
      assert.equal(mail(FEDERICO, [cargadoAyer(1, { desde: '08:05' })], opciones()), null);
      assert.equal(mail(FEDERICO, [], opciones()), null);
    });

    it('lo que no tiene dato de cuándo se publicó (los de antes de esta entrega) cuenta como anterior', () => {
      assert.equal(mail(FEDERICO, [cargadoAyer(1, { publicado_at: null })], opciones()).gente.length, 1);
    });

    it('con un rezagado, toda la agenda de hoy, con lo propio si tiene la casilla, y «nuevo» solo en lo sin informar', () => {
      const eventos = [
        evento(5, { creado_por: 2, creador: 'Federico Ríos', fecha: '2026-11-06' }),
        cargadoAyer(1),
        publico(2, { desde: '12:00', publicado_at: '2026-11-04 10:00:00' }),
        cargadoAyer(3, { desde: '07:00' })
      ];
      const resultado = mail(FEDERICO, eventos, opciones(new Set([claveDeInformado(2, 2, '2026-11-06')])));
      assert.deepEqual(resultado.propios.map((item) => item.evento_id), [5]);
      assert.deepEqual(resultado.gente.map(({ evento_id: id, nuevo }) => [id, nuevo]), [[1, true], [2, false], [3, true]]);
      assert.deepEqual(resultado.informa.map((item) => item.evento_id), [1, 2, 3]);
      // Sin la casilla, sin lo propio
      assert.deepEqual(mail({ ...FEDERICO, eventos_por_mail: false }, eventos, opciones()).propios, []);
    });

    it('lo de otros días no entra', () => {
      const resultado = mail(FEDERICO, [cargadoAyer(), publico(2, { fecha: '2026-11-09', publicado_at: '2026-11-05 15:00:00' })], opciones());
      assert.deepEqual(resultado.gente.map((item) => item.evento_id), [1]);
    });

    it('el evento que cambió de fecha entra como no informado para la nueva, aunque ya se le haya informado la otra', () => {
      const informados = new Set([claveDeInformado(1, 2, '2026-11-09')]);
      assert.equal(mail(FEDERICO, [cargadoAyer()], opciones(informados)).gente.length, 1);
    });
  });

  it('el nombre corto de quien cargó, contra todos los activos: con dos Carlas, con inicial', () => {
    const usuarios = [usuario(1, 'Graciela Paz'), usuario(2, 'Carla Ríos', 1), usuario(9, 'Carla Benítez')];
    const carla = publico(1, { creado_por: 2, creador: 'Carla Ríos', fecha: '2026-11-06' });
    assert.equal(mail(usuarios[0], [carla], { usuarios }).gente[0].texto, 'Carla R.: Fuera de la oficina');
  });
});

describe('textoDelResultadoDelDiario', () => {
  it('cada caso', () => {
    assert.equal(textoDelResultadoDelDiario({ dia_habil: true, enviados: 3 }), 'Enviados: 3.');
    assert.equal(textoDelResultadoDelDiario({ dia_habil: false }), 'Día no hábil: no se manda.');
    assert.equal(textoDelResultadoDelDiario({ dia_habil: true, enviados: 1, fallidos: 2 }), 'Enviados: 1. Fallidos: 2.');
    assert.equal(textoDelResultadoDelDiario({ dia_habil: null, errores: [{ usuario_id: null, error: 'Sin feriados.' }, { usuario_id: 4, error: 'Falló.' }] }),
      'Enviados: 0. Errores: Sin feriados.; persona 4: Falló.');
    assert.ok(textoDelResultadoDelDiario({ dia_habil: true, errores: [{ usuario_id: null, error: 'x'.repeat(2000) }] }).length <= 1000);
  });
});

describe('Correos → Estado (spec, 6)', () => {
  const AHORA = '2026-11-05 15:00:00';
  const corrida = (cambios = {}) => ({ inicio: '2026-11-05 14:00', fin: '2026-11-05 14:01', resultado: 'Enviados: 3.', con_errores: false, en_curso: false, ...cambios });
  it('la línea, en cada caso', () => {
    assert.equal(textoDeLaCorridaDelDiario(null, AHORA), 'Aviso diario de la agenda: sin registro todavía.');
    assert.equal(textoDeLaCorridaDelDiario(corrida(), AHORA), 'Aviso diario de la agenda: última corrida hoy a las 14:00. Enviados: 3.');
    assert.equal(textoDeLaCorridaDelDiario(corrida({ en_curso: true, fin: null }), AHORA), 'Aviso diario de la agenda: corrida en curso, desde hoy a las 14:00.');
    assert.equal(textoDeLaCorridaDelDiario(corrida({ resultado: null }), AHORA), 'Aviso diario de la agenda: última corrida hoy a las 14:00.');
  });

  it('la alerta, solo con errores; y la advertencia, si no se pudo leer', () => {
    assert.deepEqual(alertasDeLaCorridaDelDiario(corrida(), AHORA), []);
    assert.deepEqual(alertasDeLaCorridaDelDiario(null, AHORA), []);
    assert.deepEqual(alertasDeLaCorridaDelDiario(corrida({ con_errores: true, resultado: 'Enviados: 1. Fallidos: 2.' }), AHORA), [{
      tipo: 'diario-con-errores', nivel: 'error',
      mensaje: 'La última corrida del aviso diario de la agenda (hoy a las 14:00) terminó con errores: Enviados: 1. Fallidos: 2.'
    }]);
    assert.equal(alertaSinEstadoDelDiario().tipo, 'diario-sin-estado');
  });
});

// Los textos de la spec, sección 8, al pie de la letra
describe('avisoDiarioTemplate (spec, 8)', () => {
  const persona = { nombre_completo: 'Micaela Inés Ojeda' };
  const propio = (cambios = {}) => ({ fecha: '2026-11-06', desde: '09:30', titulo: 'Turno con la kinesióloga', detalle: 'Llevar la orden.', marca: 'Solo vos lo ves', ...cambios });
  const deGente = (cambios = {}) => ({ fecha: '2026-11-06', desde: '08:00', hasta: null, texto: 'Micaela: Fuera de la oficina', nuevo: false, ...cambios });
  const armar = (mail, hoy = '2026-11-05') => avisoDiarioTemplate({ persona, hoy, mail: { propios: [], gente: [], dias: ['2026-11-06'], soloHoy: false, informa: [], ...mail } });
  const VARIOS = ['2026-11-07', '2026-11-08', '2026-11-09'];

  it('14:00, con lo propio', () => {
    const uno = armar({ propios: [propio()] });
    assert.equal(uno.subject, 'RPAD: tu agenda del viernes 06/11');
    assert.match(uno.html, /<title>Tu agenda del viernes 06\/11<\/title>/);
    assert.match(uno.text, /^Micaela, esto es lo que tenés para el próximo día hábil\./);
    assert.ok(uno.text.includes('Viernes 06/11\n\n09:30 · Turno con la kinesióloga\nLlevar la orden.\nSolo vos lo ves'));
    assert.ok(uno.text.includes('Si algo no está como querías, lo podés cambiar desde el evento. Para dejar de recibir este mail, destildá «Recibir mi agenda por mail» en la Agenda de Mi espacio.'));
    const varios = armar({ dias: VARIOS, propios: [propio({ fecha: '2026-11-09' })] }, '2026-11-06');
    assert.equal(varios.subject, 'RPAD: tu agenda hasta el lunes 09/11');
    assert.match(varios.text, /^Micaela, esto es lo que tenés hasta el próximo día hábil\./);
  });

  it('14:00, con lo propio y su gente, bajo su título y con la nota de los dos', () => {
    const { text, subject } = armar({ propios: [propio()], gente: [deGente({ hasta: '10:00' })] });
    assert.equal(subject, 'RPAD: tu agenda del viernes 06/11');
    assert.ok(text.indexOf('Turno con la kinesióloga') < text.indexOf('De quienes dependen de vos'));
    assert.ok(text.includes('08:00 · Micaela: Fuera de la oficina\nHasta las 10:00'));
    assert.ok(text.includes('De quienes dependen de vos, te llega solo el texto corto de lo que publican. Lo tuyo lo podés apagar desde la Agenda de Mi espacio; lo demás te llega siempre.'));
  });

  it('14:00, solo lo de su gente', () => {
    const uno = armar({ gente: [deGente()] });
    assert.equal(uno.subject, 'RPAD: agenda del viernes 06/11 de quienes dependen de vos');
    assert.match(uno.html, /<title>Agenda del viernes 06\/11 de quienes dependen de vos<\/title>/);
    assert.match(uno.text, /^Micaela, esto es lo que publicaron para el próximo día hábil\./);
    assert.ok(uno.text.endsWith('De quienes dependen de vos, te llega solo el texto corto de lo que publican.'));
    assert.equal(armar({ dias: VARIOS, gente: [deGente({ fecha: '2026-11-09' })] }, '2026-11-06').subject, 'RPAD: agenda hasta el lunes 09/11 de quienes dependen de vos');
  });

  it('8:05, y un mail de las 14:00 que solo trae lo rezagado de hoy, con lo nuevo marcado', () => {
    const { subject, html, text } = armar({ soloHoy: true, gente: [deGente({ nuevo: true, desde: '08:15' }), deGente({ desde: '10:00', texto: 'Lucía: Licencia' })] }, '2026-11-06');
    assert.equal(subject, 'RPAD: se sumó algo a tu agenda de hoy');
    assert.match(html, /<title>Tu agenda de hoy, actualizada<\/title>/);
    assert.match(text, /^Micaela, después del último aviso se sumó algo a la agenda de hoy, viernes 06\/11\. Lo nuevo dice «Nuevo»\./);
    assert.ok(text.includes('08:15 · Nuevo: Micaela: Fuera de la oficina'));
    assert.ok(text.includes('10:00 · Lucía: Licencia'));
    assert.ok(html.includes('<strong>Nuevo:</strong> Micaela: Fuera de la oficina'));
  });

  it('8:05, con lo propio: el día como «Hoy»', () => {
    const { text } = armar({ soloHoy: true, propios: [propio()], gente: [deGente({ nuevo: true })] }, '2026-11-06');
    assert.ok(text.includes('Hoy, viernes 06/11'));
  });

  it('cada parte, escapada una sola vez; los renglones del detalle, con <br>; el botón va a la agenda', () => {
    const { html } = armar({ propios: [propio({ titulo: '<b>Secreto</b> & más', detalle: 'Línea 1\nLínea <i>2</i>', marca: 'Lo ve <u>Tomás</u>' })], gente: [deGente({ texto: 'Carla: <script>' })] });
    assert.ok(html.includes('&lt;b&gt;Secreto&lt;/b&gt; &amp; más'));
    assert.ok(html.includes('Línea 1<br>Línea &lt;i&gt;2&lt;/i&gt;'));
    assert.ok(html.includes('Lo ve &lt;u&gt;Tomás&lt;/u&gt;'));
    assert.ok(html.includes('Carla: &lt;script&gt;'));
    assert.ok(!html.includes('<script>') && !html.includes('&amp;lt;'));
    assert.match(html, /Ver en Mi espacio/);
    assert.match(html, /mi-espacio\.html#agenda/);
  });
});
