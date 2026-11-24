// La votación de la principal del equipo (spec 2026-11-23-dato-quincena-principal-votacion, decisiones y 2): las reglas puras
// del cierre, los votos vigentes, los puntos y el desempate. El calendario es el de la precarga (el 23/11/2026 y el 07/12 no se
// trabaja, el 08/12 es fijo) y el ahora, fijo. Las cifras son inventadas.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HORA_DEL_CIERRE, HORA_DEL_SELLADO, NOMBRE_SIN_CUENTA, MENSAJES_VOTACION, llegadaDe, cierreDeLaVotacion, estadoDeLaVotacion,
  ordenDelVoto, ordenDeTexto, votosVigentes, resultadoDeLaVotacion, debeSellar, textoDeLosQueVotan, textoDeLasListasGuardadas,
  cierreLargo, cierreMedio, cierreCorto, votacionDelDetalle, votacionDeLaLista, itemsDeLaVotacionEnMiEspacio, modeloDelMailDeLaVotacion,
  estadoDeLaVotacionLeida, mensajeDelVoto, votacionParaElDetalle, votacionParaLaLista, cierreAnticipado
} from '../services/datoQuincenaVotacionReglas.js';
import { calendarioCon } from '../services/feriadosReglas.js';
import { FILAS_PRECARGA } from './fixtures/feriados-precarga.js';

const CALENDARIO = calendarioCon(FILAS_PRECARGA);
const CALENDARIO_CAIDO = calendarioCon([], { origen: 'fijos', error: 'No se pudo leer la tabla de feriados.' });

describe('constantes y mensajes', () => {
  it('valen lo acordado y están congeladas', () => {
    assert.equal(HORA_DEL_CIERRE, '12:00');
    assert.equal(HORA_DEL_SELLADO, '14:00');
    assert.equal(NOMBRE_SIN_CUENTA, 'Una persona que ya no está');
    assert.ok(Object.isFrozen(MENSAJES_VOTACION));
    assert.equal(MENSAJES_VOTACION.noSeVota, 'Esta edición no se vota.');
    assert.equal(MENSAJES_VOTACION.noEstas, 'No estás en la lista de quienes votan esta edición.');
    assert.equal(MENSAJES_VOTACION.cerro, 'La votación ya cerró.');
    assert.equal(MENSAJES_VOTACION.orden, 'Ordená todas las propuestas de la edición.');
    assert.equal(MENSAJES_VOTACION.alGuardar, 'No se pudo guardar tu orden. Probá de nuevo en unos minutos.');
    assert.equal(MENSAJES_VOTACION.ahoraSeVota, 'La principal del equipo ahora se vota: volvé a cargar la página.');
  });
});

describe('llegadaDe', () => {
  it('pasa los segundos UNIX a hora argentina', () => {
    // 2026-11-23 12:45 UTC = 09:45 en Argentina
    assert.equal(llegadaDe(Date.UTC(2026, 10, 23, 12, 45) / 1000), '2026-11-23 09:45');
    assert.equal(llegadaDe(Date.UTC(2026, 10, 24, 1, 5) / 1000), '2026-11-23 22:05');
  });
  it('null si no es un instante', () => {
    assert.equal(llegadaDe(null), null);
    assert.equal(llegadaDe(undefined), null);
  });
});

describe('cierreDeLaVotacion', () => {
  const cierre = (fecha_edicion, llegada) => cierreDeLaVotacion({ fecha_edicion, llegada, calendario: CALENDARIO });
  it('llegada en un feriado: el primer día hábil siguiente', () => assert.equal(cierre('2026-11-23', '2026-11-23 09:45'), '2026-11-24 12:00'));
  it('lunes hábil, después de las 8:05 pasa al día siguiente', () => {
    assert.equal(cierre('2026-11-16', '2026-11-16 10:00'), '2026-11-17 12:00');
    assert.equal(cierre('2026-11-16', '2026-11-16 08:05'), '2026-11-17 12:00');
  });
  it('antes de las 8:05 cierra ese mismo día', () => assert.equal(cierre('2026-11-16', '2026-11-16 08:04'), '2026-11-16 12:00'));
  it('llegada anterior a la fecha de la edición: cuenta la fecha', () => assert.equal(cierre('2026-11-16', '2026-11-13 11:30'), '2026-11-16 12:00'));
  it('salta el no laborable y el feriado', () => assert.equal(cierre('2026-12-07', '2026-12-07 09:00'), '2026-12-09 12:00'));
  it('una edición atrasada cuenta desde la llegada', () => assert.equal(cierre('2026-11-02', '2026-11-30 09:00'), '2026-12-01 12:00'));
});

// El estado entero: `cierre_nominal` es el cierre de siempre (las 12:00, null si no se sabe), `por_todos` y `hasta_id` dicen si cerró
// porque votaron todos y cuál fue el voto que cerró (spec 2026-11-23-dato-quincena-votacion-cierre-anticipado)
const estadoDe = (abierta, cierre, cambios = {}) => ({
  abierta, cierre, cierre_nominal: cierre, por_todos: false, hasta_id: null, sin_calendario: false, ...cambios
});
const ESTADO_SIN_CALENDARIO = estadoDe(true, null, { sin_calendario: true });

describe('estadoDeLaVotacion', () => {
  const base = { fecha_edicion: '2026-11-23', llegada: '2026-11-23 09:45', calendario: CALENDARIO };
  it('abierta hasta las 12:00 y cerrada desde ahí', () => {
    assert.deepEqual(estadoDeLaVotacion({ ...base, cierre_at: null, ahora: '2026-11-24 11:59:59' }), estadoDe(true, '2026-11-24 12:00'));
    assert.deepEqual(estadoDeLaVotacion({ ...base, cierre_at: null, ahora: '2026-11-24 12:00:00' }), estadoDe(false, '2026-11-24 12:00'));
    assert.deepEqual(Object.keys(estadoDeLaVotacion({ ...base, cierre_at: null, ahora: '2026-11-24 11:59:59' })),
      ['abierta', 'cierre', 'cierre_nominal', 'por_todos', 'hasta_id', 'sin_calendario']);
  });
  it('sellada queda cerrada aunque el calendario falle', () => {
    const r = estadoDeLaVotacion({ ...base, calendario: CALENDARIO_CAIDO, cierre_at: '2026-11-24 12:00:00', ahora: '2026-11-24 09:00:00' });
    assert.deepEqual(r, estadoDe(false, '2026-11-24 12:00', { cierre_nominal: null }));
  });
  it('sellada con el calendario: el cierre guardado, sin cierre_nominal (lo sellado no vuelve a tocar el calendario)', () => {
    const r = estadoDeLaVotacion({ ...base, cierre_at: '2026-11-24 12:00:00', ahora: '2026-11-25 09:00:00' });
    assert.deepEqual(r, estadoDe(false, '2026-11-24 12:00', { cierre_nominal: null }));
    // Un calendario que tiraría (el tope de proximoDiaHabil): sellada, no se lo llama
    const queTira = { ...CALENDARIO, proximoDiaHabil: () => { throw new RangeError('Sin día hábil en el tope'); } };
    assert.deepEqual(estadoDeLaVotacion({ ...base, calendario: queTira, cierre_at: '2026-11-24 12:00:00', ahora: '2026-11-25 09:00:00' }),
      estadoDe(false, '2026-11-24 12:00', { cierre_nominal: null }));
    assert.throws(() => estadoDeLaVotacion({ ...base, calendario: queTira, cierre_at: null, ahora: '2026-11-25 09:00:00' }), RangeError);
  });
  it('sin sellar y sin calendario: abierta y sin cierre', () => {
    const r = estadoDeLaVotacion({ ...base, calendario: CALENDARIO_CAIDO, cierre_at: null, ahora: '2026-11-24 13:00:00' });
    assert.deepEqual(r, ESTADO_SIN_CALENDARIO);
  });
});

// El cierre anticipado (spec 2026-11-23-dato-quincena-votacion-cierre-anticipado): el voto que completa la foto es el primer voto válido
// de la última persona que faltaba. Personas y horas inventadas; los votos solo se agregan y su id crece en el orden en que se guardaron
const FOTO = [
  { persona_id: 1, usuario_id: 901, nombre: 'Persona Uno' },
  { persona_id: 2, usuario_id: 902, nombre: 'Persona Dos' },
  { persona_id: 3, usuario_id: 903, nombre: 'Persona Tres' }
];
const votoCon = (id, persona_id, orden, votado_at) => ({ id, persona_id, orden, votado_at });
// Las tres votan el lunes 23/11 (feriado en la precarga): la 3 es la última y su primer voto, el 5, cierra a las 21:40; después la 1
// cambia (el 6, que ya no cuenta)
const VOTOS_DE_TODOS = [
  votoCon(1, 2, '1,2', '2026-11-23 18:05:00'),
  votoCon(2, 1, '1,2', '2026-11-23 19:30:00'),
  votoCon(3, 2, '2,1', '2026-11-23 20:10:00'),
  votoCon(4, 1, '1,2', '2026-11-23 21:00:00'),
  votoCon(5, 3, '2,1', '2026-11-23 21:40:12'),
  votoCon(6, 1, '2,1', '2026-11-23 21:55:00')
];

describe('cierreAnticipado', () => {
  const anticipado = (cambios = {}) => cierreAnticipado({ personas: FOTO, votos: VOTOS_DE_TODOS, ordenes: [1, 2], cierreNominal: '2026-11-24 12:00', ...cambios });
  it('foto vacía: nunca cierra antes', () => {
    assert.equal(anticipado({ personas: [] }), null);
    assert.equal(anticipado({ personas: [], votos: [] }), null);
  });
  it('falta una persona: null', () => {
    assert.equal(anticipado({ votos: VOTOS_DE_TODOS.filter((v) => v.persona_id !== 3) }), null);
    assert.equal(anticipado({ votos: [] }), null);
  });
  it('votaron todos: el primer voto de la última, aunque otras hayan cambiado antes o después', () => {
    assert.deepEqual(anticipado(), { id: 5, votado_at: '2026-11-23 21:40:12' });
    assert.deepEqual(Object.keys(anticipado()), ['id', 'votado_at']);
    // Si la última cambia después, cierra igual su primer voto
    assert.deepEqual(anticipado({ votos: [...VOTOS_DE_TODOS, votoCon(7, 3, '1,2', '2026-11-23 22:00:00')] }), { id: 5, votado_at: '2026-11-23 21:40:12' });
  });
  it('cierra el de mayor id, no el de hora más tardía', () => {
    const votos = [votoCon(1, 1, '1,2', '2026-11-23 10:00:00'), votoCon(2, 2, '1,2', '2026-11-23 10:00:30'), votoCon(3, 3, '1,2', '2026-11-23 10:00:10')];
    assert.deepEqual(anticipado({ votos }), { id: 3, votado_at: '2026-11-23 10:00:10' });
  });
  it('un voto inválido no cuenta: cierra el primer voto válido de esa persona', () => {
    const votos = [votoCon(1, 1, '1,2', '2026-11-23 10:00:00'), votoCon(2, 2, '1,2', '2026-11-23 10:05:00'), votoCon(3, 3, '1,2,3', '2026-11-23 10:10:00')];
    assert.equal(anticipado({ votos }), null);
    assert.deepEqual(anticipado({ votos: [...votos, votoCon(4, 3, '2,1', '2026-11-23 10:20:00')] }), { id: 4, votado_at: '2026-11-23 10:20:00' });
  });
  it('un voto desde el cierre de siempre no cuenta; sin cierre de siempre, cualquiera', () => {
    const votos = [votoCon(1, 1, '1,2', '2026-11-24 09:00:00'), votoCon(2, 2, '1,2', '2026-11-24 10:00:00'), votoCon(3, 3, '1,2', '2026-11-24 12:00:00')];
    assert.equal(anticipado({ votos }), null);
    assert.deepEqual(anticipado({ votos: votos.map((v) => (v.id === 3 ? { ...v, votado_at: '2026-11-24 11:59:59' } : v)) }), { id: 3, votado_at: '2026-11-24 11:59:59' });
    assert.deepEqual(anticipado({ votos, cierreNominal: null }), { id: 3, votado_at: '2026-11-24 12:00:00' });
    assert.deepEqual(anticipado({ votos, cierreNominal: undefined }), { id: 3, votado_at: '2026-11-24 12:00:00' });
  });
  it('los votos de alguien fuera de la foto no completan nada', () => {
    const votos = [votoCon(1, 1, '1,2', '2026-11-23 10:00:00'), votoCon(2, 2, '1,2', '2026-11-23 10:05:00'), votoCon(3, 99, '1,2', '2026-11-23 10:10:00')];
    assert.equal(anticipado({ votos }), null);
  });
  it('una sola persona: su primer voto válido cierra', () => {
    assert.deepEqual(anticipado({ personas: FOTO.slice(0, 1), votos: [votoCon(8, 1, '2,1', '2026-11-23 10:00:00')] }), { id: 8, votado_at: '2026-11-23 10:00:00' });
  });
  it('no cambia lo que recibe', () => {
    const votos = structuredClone(VOTOS_DE_TODOS);
    anticipado({ votos });
    assert.deepEqual(votos, VOTOS_DE_TODOS);
  });
});

describe('estadoDeLaVotacion: cerrada porque votaron todos', () => {
  const base = { fecha_edicion: '2026-11-23', llegada: '2026-11-23 09:45', calendario: CALENDARIO, personas: FOTO, votos: VOTOS_DE_TODOS, ordenes: [1, 2] };
  const POR_TODOS = estadoDe(false, '2026-11-23 21:40', { cierre_nominal: '2026-11-24 12:00', por_todos: true, hasta_id: 5 });
  it('antes de las 12:00: cerrada con la hora del voto que cerró, el cierre de siempre y su id', () => {
    assert.deepEqual(estadoDeLaVotacion({ ...base, cierre_at: null, ahora: '2026-11-23 21:41:00' }), POR_TODOS);
    assert.deepEqual(estadoDeLaVotacion({ ...base, cierre_at: null, ahora: '2026-11-24 15:00:00' }), POR_TODOS);
  });
  it('mientras falta alguien, abierta como siempre', () => {
    const r = estadoDeLaVotacion({ ...base, votos: VOTOS_DE_TODOS.slice(0, 4), cierre_at: null, ahora: '2026-11-23 21:30:00' });
    assert.deepEqual(r, estadoDe(true, '2026-11-24 12:00'));
  });
  it('sellada por todos (el sellado guarda la hora del voto que cerró): igual, con o sin calendario, y sin cierre_nominal', () => {
    for (const calendario of [CALENDARIO, CALENDARIO_CAIDO]) {
      const r = estadoDeLaVotacion({ ...base, calendario, cierre_at: '2026-11-23 21:40:00', ahora: '2026-11-25 09:00:00' });
      assert.deepEqual(r, { ...POR_TODOS, cierre_nominal: null });
    }
  });
  it('sellada al cierre de siempre: queda como se selló, aunque los votos completen la foto (una votación de antes de esta regla)', () => {
    const r = estadoDeLaVotacion({ ...base, cierre_at: '2026-11-24 12:00:00', ahora: '2026-11-25 09:00:00' });
    assert.deepEqual(r, estadoDe(false, '2026-11-24 12:00', { cierre_nominal: null }));
  });
  it('sin calendario: los votos alcanzan', () => {
    const r = estadoDeLaVotacion({ ...base, calendario: CALENDARIO_CAIDO, cierre_at: null, ahora: '2026-11-23 22:00:00' });
    assert.deepEqual(r, { ...POR_TODOS, cierre_nominal: null });
  });
  it('sin la foto, los votos o las propuestas (los de antes): como siempre', () => {
    const { personas, votos, ordenes, ...sinNada } = base;
    assert.deepEqual(estadoDeLaVotacion({ ...sinNada, cierre_at: null, ahora: '2026-11-24 11:00:00' }), estadoDe(true, '2026-11-24 12:00'));
    assert.deepEqual(estadoDeLaVotacion({ ...base, ordenes: [], cierre_at: null, ahora: '2026-11-24 11:00:00' }), estadoDe(true, '2026-11-24 12:00'));
  });
  it('foto vacía: cierra a las 12:00, nunca antes', () => {
    assert.deepEqual(estadoDeLaVotacion({ ...base, personas: [], votos: [], cierre_at: null, ahora: '2026-11-24 11:59:59' }), estadoDe(true, '2026-11-24 12:00'));
    assert.deepEqual(estadoDeLaVotacion({ ...base, personas: [], votos: [], cierre_at: null, ahora: '2026-11-24 12:00:00' }), estadoDe(false, '2026-11-24 12:00'));
  });
  it('alguien que nunca vota: cierra a las 12:00', () => {
    const votos = VOTOS_DE_TODOS.filter((v) => v.persona_id !== 2);
    assert.deepEqual(estadoDeLaVotacion({ ...base, votos, cierre_at: null, ahora: '2026-11-24 12:00:00' }), estadoDe(false, '2026-11-24 12:00'));
  });
});

// La votación tal como la lee leerVotaciones (spec 3): `recibida_ts` en segundos UNIX y `cierre_at` como texto o null. Una edición
// cuya llegada no se puede leer (solo con un SQL a mano) y que no está sellada se toma como sin calendario: abierta, sin cierre y sin
// voto que se guarde
describe('estadoDeLaVotacionLeida', () => {
  // 2026-11-23 12:45 UTC = 09:45 en Argentina
  const leida = (cambios = {}) => ({ cierre_at: null, fecha_edicion: '2026-11-23', recibida_ts: Date.UTC(2026, 10, 23, 12, 45) / 1000, ...cambios });
  it('con la llegada, el cierre de estadoDeLaVotacion', () => {
    assert.deepEqual(estadoDeLaVotacionLeida(leida(), { ahora: '2026-11-24 11:59:59', calendario: CALENDARIO }), estadoDe(true, '2026-11-24 12:00'));
    assert.deepEqual(estadoDeLaVotacionLeida(leida(), { ahora: '2026-11-24 12:00:00', calendario: CALENDARIO }), estadoDe(false, '2026-11-24 12:00'));
  });
  it('sellada: cerrada con su cierre, aunque falten la llegada o el calendario', () => {
    for (const calendario of [CALENDARIO, CALENDARIO_CAIDO]) {
      assert.deepEqual(estadoDeLaVotacionLeida(leida({ cierre_at: '2026-11-24 12:00:00', recibida_ts: null }), { ahora: '2026-11-24 09:00:00', calendario }),
        estadoDe(false, '2026-11-24 12:00', { cierre_nominal: null }));
    }
  });
  it('sin una llegada que se pueda leer y sin sellar: como sin calendario', () => {
    for (const recibida_ts of [null, undefined, 'no es un instante']) {
      assert.deepEqual(estadoDeLaVotacionLeida(leida({ recibida_ts }), { ahora: '2026-11-30 13:00:00', calendario: CALENDARIO }), ESTADO_SIN_CALENDARIO);
    }
  });
  it('sin calendario y sin sellar: abierta y sin cierre', () => {
    assert.deepEqual(estadoDeLaVotacionLeida(leida(), { ahora: '2026-11-30 13:00:00', calendario: CALENDARIO_CAIDO }), ESTADO_SIN_CALENDARIO);
  });
  it('con la foto, los votos y las propuestas de la leída: cierra cuando votaron todos', () => {
    const conVotos = leida({ personas: FOTO, votos: VOTOS_DE_TODOS, ordenes: [1, 2] });
    const POR_TODOS = estadoDe(false, '2026-11-23 21:40', { cierre_nominal: '2026-11-24 12:00', por_todos: true, hasta_id: 5 });
    assert.deepEqual(estadoDeLaVotacionLeida(conVotos, { ahora: '2026-11-23 22:00:00', calendario: CALENDARIO }), POR_TODOS);
    assert.deepEqual(estadoDeLaVotacionLeida(conVotos, { ahora: '2026-11-23 22:00:00', calendario: CALENDARIO_CAIDO }), { ...POR_TODOS, cierre_nominal: null });
    // Sin una llegada que se pueda leer, también: los votos alcanzan
    assert.deepEqual(estadoDeLaVotacionLeida({ ...conVotos, recibida_ts: null }, { ahora: '2026-11-23 22:00:00', calendario: CALENDARIO }),
      { ...POR_TODOS, cierre_nominal: null });
    // Falta alguien: como siempre
    assert.deepEqual(estadoDeLaVotacionLeida({ ...conVotos, votos: VOTOS_DE_TODOS.slice(0, 4) }, { ahora: '2026-11-23 22:00:00', calendario: CALENDARIO }),
      estadoDe(true, '2026-11-24 12:00'));
  });
});

// El mensaje del PUT del voto (spec 3, «Votar»)
describe('mensajeDelVoto', () => {
  it('guardado: hasta cuándo se puede cambiar', () => {
    assert.equal(mensajeDelVoto({ cambio: true, cierre: '2026-11-24 12:00' }), 'Guardamos tu orden. Lo podés cambiar hasta el martes 24/11 a las 12:00, o hasta que voten todas las personas de la lista.');
    assert.equal(mensajeDelVoto({ cambio: true, cierre: '2026-12-09 12:00' }), 'Guardamos tu orden. Lo podés cambiar hasta el miércoles 09/12 a las 12:00, o hasta que voten todas las personas de la lista.');
  });
  it('el mismo orden: «Tu orden ya era ese.»', () => {
    assert.equal(mensajeDelVoto({ cambio: false, cierre: '2026-11-24 12:00' }), 'Tu orden ya era ese.');
  });
  it('el voto que cierra: «Votaron todos»', () => {
    assert.equal(mensajeDelVoto({ cambio: true, cierre: '2026-11-24 12:00', cerro: true }), 'Guardamos tu orden. Votaron todos: la votación cerró.');
    assert.equal(mensajeDelVoto({ cambio: true, cierre: '2026-11-24 12:00', cerro: false }), 'Guardamos tu orden. Lo podés cambiar hasta el martes 24/11 a las 12:00, o hasta que voten todas las personas de la lista.');
  });
});

describe('ordenDelVoto y ordenDeTexto', () => {
  it('una permutación exacta da el texto', () => assert.equal(ordenDelVoto([2, 1, 4, 3], [1, 2, 3, 4]), '2,1,4,3'));
  it('lo que no es una permutación da null', () => {
    for (const malo of [[1, 2, 3], [1, 1, 2, 3], [1, 2, 3, 5], ['1', 2, 3, 4], [1.5, 2, 3, 4], '2,1,4,3', null, {}, undefined]) {
      assert.equal(ordenDelVoto(malo, [1, 2, 3, 4]), null, JSON.stringify(malo));
    }
  });
  it('el texto vuelve a la lista', () => {
    assert.deepEqual(ordenDeTexto('2,1,4,3', [1, 2, 3, 4]), [2, 1, 4, 3]);
    assert.equal(ordenDeTexto('2,1,4', [1, 2, 3, 4]), null);
    assert.equal(ordenDeTexto('2,1,4,x', [1, 2, 3, 4]), null);
    assert.equal(ordenDeTexto(null, [1, 2, 3, 4]), null);
    assert.equal(ordenDeTexto('', [1, 2, 3, 4]), null);
  });
});

describe('votosVigentes', () => {
  const ordenes = [1, 2, 3];
  const personas = [{ persona_id: 10 }, { persona_id: 11 }, { persona_id: 12 }];
  const voto = (id, persona_id, orden, votado_at) => ({ id, persona_id, orden, votado_at });
  it('toma el de mayor id, ignora lo tardío y lo inválido, y omite a quien no votó', () => {
    const votos = [
      voto(1, 10, '1,2,3', '2026-11-24 09:00:00'),
      voto(2, 10, '3,2,1', '2026-11-24 10:00:00'),
      voto(3, 10, '2,1,3', '2026-11-24 12:00:00'),
      voto(4, 11, '1,2,3', '2026-11-24 09:00:00'),
      voto(5, 11, '1,2', '2026-11-24 10:00:00'),
      voto(6, 99, '1,2,3', '2026-11-24 10:00:00')
    ];
    const r = votosVigentes({ personas, votos, cierre: '2026-11-24 12:00', ordenes });
    assert.deepEqual([...r.keys()], [10, 11]);
    assert.deepEqual(r.get(10), [3, 2, 1]);
    assert.deepEqual(r.get(11), [1, 2, 3]);
  });
  it('sin cierre cuentan todos', () => {
    const r = votosVigentes({ personas, votos: [voto(1, 12, '2,3,1', '2030-01-01 00:00:00')], cierre: null, ordenes });
    assert.deepEqual(r.get(12), [2, 3, 1]);
  });
  // Cerrada porque votaron todos: cuentan el voto que cerró y los anteriores (por id), sin mirar la hora
  it('con hastaId: cuentan los de id hasta ese, y un cambio de id mayor no cuenta', () => {
    const votos = [
      voto(1, 10, '1,2,3', '2026-11-23 21:00:00'),
      voto(2, 11, '2,1,3', '2026-11-23 21:30:00'),
      voto(3, 12, '3,1,2', '2026-11-23 21:40:30'),
      voto(4, 10, '3,2,1', '2026-11-23 21:40:50'),
      voto(5, 11, '1,3,2', '2026-11-23 21:41:00')
    ];
    const r = votosVigentes({ personas, votos, cierre: '2026-11-23 21:40', ordenes, hastaId: 3 });
    assert.deepEqual([...r], [[10, [1, 2, 3]], [11, [2, 1, 3]], [12, [3, 1, 2]]]);
    // Un cambio de id menor que el que cerró sí cuenta, aunque sea del mismo minuto
    const conCambio = [voto(1, 10, '1,2,3', '2026-11-23 21:00:00'), voto(2, 10, '2,3,1', '2026-11-23 21:40:05'), voto(3, 11, '1,2,3', '2026-11-23 21:40:10'),
      voto(4, 12, '1,2,3', '2026-11-23 21:40:20')];
    assert.deepEqual(votosVigentes({ personas, votos: conCambio, cierre: '2026-11-23 21:40', ordenes, hastaId: 4 }).get(10), [2, 3, 1]);
    // Sin hastaId (null o sin la clave), como siempre: por la hora
    assert.deepEqual([...votosVigentes({ personas, votos, cierre: '2026-11-23 21:40', ordenes, hastaId: null }).keys()], [10, 11]);
    assert.deepEqual([...votosVigentes({ personas, votos, cierre: '2026-11-23 21:40', ordenes }).keys()], [10, 11]);
  });
});

describe('resultadoDeLaVotacion', () => {
  const ordenes = [1, 2, 3, 4];
  it('gana por puntos', () => {
    const r = resultadoDeLaVotacion({ ordenes, deDatito: 1, votos: [[2, 1, 4, 3], [3, 2, 1, 4], [4, 2, 1, 3]] });
    assert.equal(r.orden, 2);
    assert.equal(r.como, 'puntos');
    assert.deepEqual([r.puntos.get(2), r.puntos.get(1), r.puntos.get(4), r.puntos.get(3)], [10, 7, 7, 6]);
  });
  it('el empate lo gana la de Datito si está entre las empatadas', () => {
    const r = resultadoDeLaVotacion({ ordenes, deDatito: 1, votos: [[2, 1, 4, 3], [1, 2, 3, 4]] });
    assert.equal(r.orden, 1);
    assert.equal(r.como, 'desempate');
    assert.deepEqual(r.empatadas, [1, 2]);
  });
  it('sin la de Datito entre las empatadas, la menor', () => {
    const r = resultadoDeLaVotacion({ ordenes, deDatito: 1, votos: [[2, 3, 1, 4], [3, 2, 1, 4]] });
    assert.equal(r.orden, 2);
    assert.equal(r.como, 'desempate');
  });
  it('sin votos gana la de Datito', () => {
    const r = resultadoDeLaVotacion({ ordenes, deDatito: 1, votos: [] });
    assert.equal(r.orden, 1);
    assert.equal(r.como, 'nadie');
  });
  it('una sola propuesta', () => {
    const r = resultadoDeLaVotacion({ ordenes: [1], deDatito: 1, votos: [[1]] });
    assert.equal(r.orden, 1);
    assert.equal(r.puntos.get(1), 1);
    assert.equal(r.como, 'puntos');
  });
  it('con cinco propuestas el primer puesto suma cinco', () => {
    const r = resultadoDeLaVotacion({ ordenes: [1, 2, 3, 4, 5], deDatito: 1, votos: [[3, 1, 2, 4, 5]] });
    assert.equal(r.puntos.get(3), 5);
    assert.equal(r.orden, 3);
  });
});

describe('debeSellar', () => {
  const sellar = (ahora, calendario = CALENDARIO) => debeSellar({ cierre: '2026-11-24 12:00', ahora, calendario });
  it('desde las 14:00 de un día hábil', () => {
    assert.equal(sellar('2026-11-24 13:59:00'), false);
    assert.equal(sellar('2026-11-24 14:00:00'), true);
    assert.equal(sellar('2026-11-25 08:05:00'), true);
  });
  it('no en un día no hábil ni con el calendario caído', () => {
    assert.equal(debeSellar({ cierre: '2026-11-20 12:00', ahora: '2026-11-21 15:00:00', calendario: CALENDARIO }), false);
    assert.equal(sellar('2026-11-24 15:00:00', CALENDARIO_CAIDO), false);
  });
});

describe('textos', () => {
  it('quienes votan', () => {
    assert.equal(textoDeLosQueVotan(0), 'No vota nadie.');
    assert.equal(textoDeLosQueVotan(1), 'Vota 1 persona.');
    assert.equal(textoDeLosQueVotan(3), 'Votan 3 personas.');
  });
  it('las listas guardadas', () => {
    assert.equal(textoDeLasListasGuardadas({ reciben: 4, votan: 3 }), 'Guardamos la lista: lo reciben 4 personas y votan 3.');
    assert.equal(textoDeLasListasGuardadas({ reciben: 1, votan: 1 }), 'Guardamos la lista: lo recibe 1 persona y vota 1.');
    assert.equal(textoDeLasListasGuardadas({ reciben: 0, votan: 0 }), 'Guardamos la lista: no lo recibe nadie y no vota nadie.');
  });
  it('las fechas del cierre', () => {
    assert.equal(cierreLargo('2026-11-24 12:00'), 'el martes 24/11/2026 a las 12:00');
    assert.equal(cierreMedio('2026-11-24 12:00'), 'el martes 24/11 a las 12:00');
    assert.equal(cierreCorto('2026-11-24 12:00'), 'mar 24/11 a las 12:00');
  });
});

// Los textos de la votación (spec 2026-11-23-dato-quincena-principal-votacion, 3, 5 y 6). Personas inventadas; la edición de prueba,
// con dos propuestas, la 1 de Datito.
const PROPUESTAS = [{ orden: 1, titulo: 'Un título inventado' }, { orden: 2, titulo: 'Otro título inventado' }];
const PERSONAS = [
  { persona_id: 1, usuario_id: 901, nombre: 'Persona Uno' },
  { persona_id: 2, usuario_id: 902, nombre: 'Persona Dos' },
  { persona_id: 3, usuario_id: 903, nombre: 'Persona Tres' }
];
const ABIERTA = estadoDe(true, '2026-11-24 12:00');
const CERRADA = estadoDe(false, '2026-11-24 12:00');
const SIN_CALENDARIO = ESTADO_SIN_CALENDARIO;
let siguienteId = 1;
const votoDe = (persona_id, orden, votado_at = '2026-11-24 09:00:00') => ({ id: siguienteId++, persona_id, orden: orden.join(','), votado_at });
const detalleVot = (cambios) => votacionDelDetalle({ propuestas: PROPUESTAS, deDatito: 1, estado: ABIERTA, personas: PERSONAS, votos: [], quienMira: 901, ...cambios });
const CLAVES = ['estado', 'resumen', 'cierre', 'participacion', 'puede_votar', 'falta_tu_voto', 'tu_orden', 'dialogo', 'aviso_de_cierre', 'resultado'];
const REGLA_2 = 'Cada puesto da puntos: con 2 propuestas, el 1.º da 2 y el último, 1. Si empatan, gana la de Datito; si no está entre las empatadas, la de número más bajo.';

describe('votacionDelDetalle: abierta', () => {
  it('quien mira está en la foto y no votó: puede votar y le falta', () => {
    const v = detalleVot({ votos: [votoDe(2, [1, 2])] });
    assert.deepEqual(v, {
      estado: 'abierta',
      resumen: 'se vota hasta el martes 24/11 a las 12:00.',
      cierre: 'Se vota hasta el martes 24/11/2026 a las 12:00.',
      participacion: 'Ya votó 1 de 3: Persona Dos. Faltan los votos de Persona Uno y Persona Tres.',
      puede_votar: true,
      falta_tu_voto: true,
      tu_orden: null,
      dialogo: 'Tocá las propuestas en orden, de la que más querés trabajar como principal a la que menos. Lo podés cambiar hasta el martes 24/11 a las 12:00, o hasta que voten todas las personas de la lista.',
      aviso_de_cierre: null,
      resultado: null
    });
    assert.deepEqual(Object.keys(v), CLAVES);
  });

  it('quien mira ya votó: su orden vigente, con el último voto', () => {
    const v = detalleVot({ votos: [votoDe(1, [1, 2]), votoDe(1, [2, 1]), votoDe(2, [1, 2])] });
    assert.equal(v.participacion, 'Ya votaron 2 de 3: Persona Uno y Persona Dos. Falta el voto de Persona Tres.');
    assert.equal(v.falta_tu_voto, false);
    assert.equal(v.puede_votar, true);
    assert.deepEqual(v.tu_orden, [
      { puesto: '1.º', orden: 2, texto: 'Propuesta 2 · Otro título inventado' },
      { puesto: '2.º', orden: 1, texto: 'Propuesta 1 · Un título inventado' }
    ]);
  });

  it('quien mira no está en la foto: no vota ni le falta, y el texto es el mismo', () => {
    const v = detalleVot({ quienMira: 777, votos: [votoDe(2, [1, 2])] });
    assert.equal(v.puede_votar, false);
    assert.equal(v.falta_tu_voto, false);
    assert.equal(v.tu_orden, null);
    assert.equal(v.dialogo, null);
    assert.equal(v.participacion, 'Ya votó 1 de 3: Persona Dos. Faltan los votos de Persona Uno y Persona Tres.');
    assert.equal(v.resumen, 'se vota hasta el martes 24/11 a las 12:00.');
  });

  it('los plurales de la participación', () => {
    const p = (votos, personas = PERSONAS) => detalleVot({ votos, personas }).participacion;
    assert.equal(p([]), 'Todavía no votó nadie de 3.');
    assert.equal(p([votoDe(1, [1, 2])]), 'Ya votó 1 de 3: Persona Uno. Faltan los votos de Persona Dos y Persona Tres.');
    assert.equal(p([votoDe(1, [1, 2]), votoDe(2, [1, 2])]), 'Ya votaron 2 de 3: Persona Uno y Persona Dos. Falta el voto de Persona Tres.');
    assert.equal(p([votoDe(1, [1, 2]), votoDe(2, [1, 2]), votoDe(3, [2, 1])]), 'Ya votaron 3 de 3.');
    assert.equal(p([votoDe(1, [1, 2])], PERSONAS.slice(0, 1)), 'Ya votó 1 de 1.');
    assert.equal(p([], []), 'No había nadie en la lista para votar.');
  });

  it('un voto cuyo orden no es de la edición no cuenta', () => {
    assert.equal(detalleVot({ votos: [votoDe(1, [1, 2, 3])] }).participacion, 'Todavía no votó nadie de 3.');
  });

  it('la cuenta borrada se nombra «Una persona que ya no está»', () => {
    const personas = [PERSONAS[0], { persona_id: 2, usuario_id: null, nombre: null }];
    const v = detalleVot({ personas, votos: [votoDe(2, [1, 2])] });
    assert.equal(v.participacion, 'Ya votó 1 de 2: Una persona que ya no está. Falta el voto de Persona Uno.');
  });

  it('sin quien mira (null, como en el mail del resultado): no es nadie de la foto, tampoco una cuenta borrada', () => {
    const personas = [PERSONAS[0], { persona_id: 2, usuario_id: null, nombre: null }];
    for (const votos of [[], [votoDe(2, [2, 1])]]) {
      const v = detalleVot({ personas, votos, quienMira: null });
      assert.deepEqual([v.puede_votar, v.falta_tu_voto, v.tu_orden, v.dialogo], [false, false, null, null], JSON.stringify(votos));
    }
  });
});

describe('votacionDelDetalle: sin calendario', () => {
  it('abierta sin cierre: no se puede votar y no hay resultado', () => {
    assert.deepEqual(detalleVot({ estado: SIN_CALENDARIO, votos: [votoDe(2, [1, 2])] }), {
      estado: 'abierta',
      resumen: 'se está votando.',
      cierre: 'No se pudo leer el calendario: el cierre se confirma en unos minutos.',
      participacion: 'Ya votó 1 de 3: Persona Dos. Faltan los votos de Persona Uno y Persona Tres.',
      puede_votar: false,
      falta_tu_voto: false,
      tu_orden: null,
      dialogo: null,
      aviso_de_cierre: null,
      resultado: null
    });
  });
});

describe('votacionDelDetalle: cerrada', () => {
  it('por puntos: la ganadora, la tabla con los puestos y los puntos', () => {
    const votos = [votoDe(1, [2, 1]), votoDe(2, [2, 1]), votoDe(3, [1, 2])];
    const v = detalleVot({ estado: CERRADA, votos });
    assert.deepEqual(v, {
      estado: 'cerrada',
      resumen: null,
      cierre: 'La votación cerró el martes 24/11/2026 a las 12:00.',
      participacion: 'Votaron 3 de 3.',
      puede_votar: false,
      falta_tu_voto: false,
      tu_orden: null,
      dialogo: null,
      aviso_de_cierre: null,
      resultado: {
        orden: 2,
        como: 'puntos',
        texto: 'Ganó por puntos: 5, contra 4 de la que siguió.',
        regla: REGLA_2,
        tabla: {
          votantes: ['Persona Uno', 'Persona Dos', 'Persona Tres'],
          filas: [
            { orden: 2, texto: 'Propuesta 2 · Otro título inventado', de_datito: false, puestos: ['1.º', '1.º', '2.º'], puntos: 5, gana: true },
            { orden: 1, texto: 'Propuesta 1 · Un título inventado', de_datito: true, puestos: ['2.º', '2.º', '1.º'], puntos: 4, gana: false }
          ]
        }
      }
    });
    assert.deepEqual(Object.keys(v), CLAVES);
    assert.deepEqual(Object.keys(v.resultado), ['orden', 'como', 'texto', 'regla', 'tabla']);
  });

  it('el voto posterior al cierre no cuenta', () => {
    const v = detalleVot({ estado: CERRADA, votos: [votoDe(1, [2, 1]), votoDe(2, [1, 2], '2026-11-24 12:00:00')] });
    assert.equal(v.participacion, 'Votó 1 de 3: no votaron Persona Dos y Persona Tres.');
    assert.equal(v.resultado.como, 'puntos');
  });

  it('por desempate con la de Datito entre las empatadas', () => {
    const v = detalleVot({ estado: CERRADA, votos: [votoDe(1, [2, 1]), votoDe(2, [1, 2])] });
    assert.equal(v.participacion, 'Votaron 2 de 3: no votó Persona Tres.');
    assert.equal(v.resultado.orden, 1);
    assert.equal(v.resultado.como, 'desempate');
    assert.equal(v.resultado.texto, 'Ganó por desempate: empató con la 2, con 3 puntos, y es la de Datito.');
    assert.deepEqual(v.resultado.tabla.filas.map((f) => [f.orden, f.gana, f.de_datito]), [[1, true, true], [2, false, false]]);
  });

  it('por desempate sin la de Datito: la de número más bajo', () => {
    const propuestas = [{ orden: 1, titulo: 'A' }, { orden: 2, titulo: 'B' }, { orden: 3, titulo: 'C' }];
    // Dos votos: 2,3,1 y 3,2,1: la 2 y la 3 suman 5, la 1 suma 2; Datito es la 1
    const v = detalleVot({ propuestas, estado: CERRADA, personas: PERSONAS.slice(0, 2), votos: [votoDe(1, [2, 3, 1]), votoDe(2, [3, 2, 1])] });
    assert.equal(v.resultado.orden, 2);
    assert.equal(v.resultado.texto, 'Ganó por desempate: empató con la 3, con 5 puntos, y tiene el número más bajo.');
    assert.equal(v.participacion, 'Votaron 2 de 2.');
    assert.equal(v.resultado.regla, 'Cada puesto da puntos: con 3 propuestas, el 1.º da 3 y el último, 1. Si empatan, gana la de Datito; si no está entre las empatadas, la de número más bajo.');
  });

  it('empate de tres: nombra a las otras dos', () => {
    const propuestas = [{ orden: 1, titulo: 'A' }, { orden: 2, titulo: 'B' }, { orden: 3, titulo: 'C' }];
    const v = detalleVot({ propuestas, estado: CERRADA, personas: PERSONAS, votos: [votoDe(1, [1, 2, 3]), votoDe(2, [2, 3, 1]), votoDe(3, [3, 1, 2])] });
    assert.equal(v.resultado.texto, 'Ganó por desempate: empató con la 2 y la 3, con 6 puntos, y es la de Datito.');
  });

  it('nadie votó: la de Datito, sin tabla', () => {
    const v = detalleVot({ estado: CERRADA });
    assert.equal(v.participacion, 'No votó nadie de 3.');
    assert.deepEqual(v.resultado, { orden: 1, como: 'nadie', texto: 'Nadie votó: quedó la de Datito.', regla: REGLA_2, tabla: null });
  });

  it('una sola persona con la cuenta borrada: su nombre en la participación y en la tabla', () => {
    const personas = [{ persona_id: 5, usuario_id: null, nombre: null }];
    const v = detalleVot({ estado: CERRADA, personas, votos: [votoDe(5, [2, 1])] });
    assert.equal(v.participacion, 'Votó 1 de 1.');
    assert.deepEqual(v.resultado.tabla.votantes, ['Una persona que ya no está']);
  });

  it('sin personas: no había nadie para votar', () => {
    const v = detalleVot({ estado: CERRADA, personas: [] });
    assert.equal(v.participacion, 'No había nadie en la lista para votar.');
    assert.equal(v.resultado.como, 'nadie');
  });

  it('una sola propuesta: «Ganó por puntos: 1.»', () => {
    const v = detalleVot({ propuestas: [{ orden: 1, titulo: 'A' }], estado: CERRADA, personas: PERSONAS.slice(0, 1), votos: [votoDe(1, [1])] });
    assert.equal(v.resultado.texto, 'Ganó por puntos: 1.');
    assert.match(v.resultado.regla, /^Cada puesto da puntos: con 1 propuesta, el 1\.º da 1 y el último, 1\. /);
  });

  it('no cambia lo que recibe', () => {
    const personas = structuredClone(PERSONAS);
    const votos = [votoDe(1, [2, 1])];
    const antes = structuredClone({ personas, votos });
    detalleVot({ estado: CERRADA, personas, votos });
    assert.deepEqual({ personas, votos }, antes);
  });
});

// Cerrada porque votaron todos (spec 2026-11-23-dato-quincena-votacion-cierre-anticipado): el voto 5, de la Persona Tres, cerró el lunes
// 23/11 a las 21:40; el 6 (la Persona Uno cambia a 2,1) ya no cuenta. Con él ganaría la 2 por 6 a 3
const POR_TODOS = estadoDe(false, '2026-11-23 21:40', { cierre_nominal: '2026-11-24 12:00', por_todos: true, hasta_id: 5 });

describe('votacionDelDetalle: cerrada porque votaron todos', () => {
  it('el cierre con la hora del voto que cerró, «cuando votaron todos», y el resultado con los votos hasta ese', () => {
    const v = detalleVot({ estado: POR_TODOS, personas: FOTO, votos: VOTOS_DE_TODOS });
    assert.deepEqual(v, {
      estado: 'cerrada',
      resumen: null,
      cierre: 'La votación cerró el lunes 23/11/2026 a las 21:40, cuando votaron todos.',
      participacion: 'Votaron 3 de 3.',
      puede_votar: false,
      falta_tu_voto: false,
      tu_orden: null,
      dialogo: null,
      aviso_de_cierre: null,
      resultado: {
        orden: 2,
        como: 'puntos',
        texto: 'Ganó por puntos: 5, contra 4 de la que siguió.',
        regla: REGLA_2,
        tabla: {
          votantes: ['Persona Uno', 'Persona Dos', 'Persona Tres'],
          filas: [
            { orden: 2, texto: 'Propuesta 2 · Otro título inventado', de_datito: false, puestos: ['2.º', '1.º', '1.º'], puntos: 5, gana: true },
            { orden: 1, texto: 'Propuesta 1 · Un título inventado', de_datito: true, puestos: ['1.º', '2.º', '2.º'], puntos: 4, gana: false }
          ]
        }
      }
    });
    assert.deepEqual(Object.keys(v), CLAVES);
  });

  it('para quien está en la foto, lo mismo: ya no vota ni ve su orden', () => {
    for (const quienMira of [901, 903, 777, null]) {
      const v = detalleVot({ estado: POR_TODOS, personas: FOTO, votos: VOTOS_DE_TODOS, quienMira });
      assert.deepEqual([v.puede_votar, v.falta_tu_voto, v.tu_orden, v.dialogo, v.aviso_de_cierre], [false, false, null, null, null], String(quienMira));
    }
  });

  it('el cierre de las 12:00, sin «cuando votaron todos»', () => {
    assert.equal(detalleVot({ estado: CERRADA }).cierre, 'La votación cerró el martes 24/11/2026 a las 12:00.');
  });
});

// El aviso del diálogo (spec 2026-11-23-dato-quincena-votacion-cierre-anticipado, «La regla»): solo para quien es la única que falta
describe('votacionDelDetalle: aviso_de_cierre', () => {
  const AVISO = 'Sos la última persona en votar: al guardar, la votación cierra y nadie puede cambiar su orden.';
  const votaronUnoYDos = () => [votoDe(1, [1, 2]), votoDe(2, [2, 1])];
  it('quien mira es la única que falta: el aviso, después del diálogo', () => {
    const v = detalleVot({ votos: votaronUnoYDos(), quienMira: 903 });
    assert.equal(v.aviso_de_cierre, AVISO);
    assert.equal(v.puede_votar, true);
    assert.equal(v.falta_tu_voto, true);
    assert.equal(v.participacion, 'Ya votaron 2 de 3: Persona Uno y Persona Dos. Falta el voto de Persona Tres.');
    assert.deepEqual(Object.keys(v), CLAVES);
  });
  it('sola en la foto y sin votar, también: su voto cierra', () => {
    assert.equal(detalleVot({ personas: PERSONAS.slice(0, 1), quienMira: 901 }).aviso_de_cierre, AVISO);
  });
  it('un voto inválido no cuenta: sigue siendo la única que falta', () => {
    assert.equal(detalleVot({ votos: [...votaronUnoYDos(), votoDe(3, [1, 2, 3])], quienMira: 903 }).aviso_de_cierre, AVISO);
  });
  it('null para quien ya votó y cambia mientras falta otra persona', () => {
    assert.equal(detalleVot({ votos: votaronUnoYDos(), quienMira: 901 }).aviso_de_cierre, null);
    assert.equal(detalleVot({ votos: votaronUnoYDos(), quienMira: 902 }).aviso_de_cierre, null);
  });
  it('null si falta alguien más', () => {
    assert.equal(detalleVot({ votos: [votoDe(1, [1, 2])], quienMira: 903 }).aviso_de_cierre, null);
    assert.equal(detalleVot({ quienMira: 901 }).aviso_de_cierre, null);
  });
  it('null para quien no está en la foto y sin quien mira', () => {
    for (const quienMira of [777, null]) assert.equal(detalleVot({ votos: votaronUnoYDos(), quienMira }).aviso_de_cierre, null, String(quienMira));
  });
  it('null con la votación cerrada o sin calendario', () => {
    assert.equal(detalleVot({ estado: CERRADA, votos: votaronUnoYDos(), quienMira: 903 }).aviso_de_cierre, null);
    assert.equal(detalleVot({ estado: SIN_CALENDARIO, votos: votaronUnoYDos(), quienMira: 903 }).aviso_de_cierre, null);
  });
});

describe('votacionDeLaLista', () => {
  const lista = (cambios) => votacionDeLaLista({ estado: ABIERTA, personas: PERSONAS, votos: [], quienMira: 901, ordenes: [1, 2], ...cambios });
  it('abierta: hasta cuándo y, si no votó, que le falta', () => {
    assert.deepEqual(lista(), { texto: 'Se vota hasta el mar 24/11 a las 12:00', falta_tu_voto: true });
    assert.deepEqual(Object.keys(lista()), ['texto', 'falta_tu_voto']);
  });
  it('ya votó, o no está en la foto: no le falta', () => {
    assert.equal(lista({ votos: [votoDe(1, [2, 1])] }).falta_tu_voto, false);
    assert.equal(lista({ quienMira: 777 }).falta_tu_voto, false);
  });
  it('abierta sin calendario: «Se está votando»', () => {
    assert.deepEqual(lista({ estado: SIN_CALENDARIO }), { texto: 'Se está votando', falta_tu_voto: false });
  });
  it('sin quien mira (null): no le falta, aunque haya una cuenta borrada que no votó', () => {
    const personas = [PERSONAS[0], { persona_id: 2, usuario_id: null, nombre: null }];
    assert.equal(lista({ personas, quienMira: null }).falta_tu_voto, false);
  });
  it('cerrada: null', () => assert.equal(lista({ estado: CERRADA }), null));
  it('cerrada porque votaron todos: null, sin «Se vota hasta…»', () => {
    assert.equal(lista({ estado: POR_TODOS, personas: FOTO, votos: VOTOS_DE_TODOS }), null);
  });
});

// Lo que leen el detalle y la lista (datoQuincenaController.js) y el mail del sellado: la votación como la lee leerVotaciones (la llegada
// en segundos UNIX: el lunes 23/11 a las 9:45, que cierra el martes 24/11 a las 12:00), la edición guardada y quien mira
describe('votacionParaElDetalle y votacionParaLaLista', () => {
  const LLEGADA = Date.UTC(2026, 10, 23, 12, 45) / 1000;
  const leida = (cambios = {}) => ({
    tipo: 'regular', fecha_edicion: '2026-11-23', recibida_ts: LLEGADA, cierre_at: null, sellada_at: null, aviso: null, ordenes: [1, 2],
    personas: PERSONAS, votos: [], ...cambios
  });
  // La de Datito es la que lleva la etiqueta Principal en el JSON (la 2), y en las filas guardadas, la marcada `principal`
  const EDICION = { propuestas: [
    { orden: 1, titulo: 'Un título inventado', etiquetas: ['Agenda'], cifra_clave: '1.234 casos' },
    { orden: 2, titulo: 'Otro título inventado', etiquetas: ['Principal'], cifra_clave: '56 casos' }
  ] };
  const GUARDADAS = [{ orden: 1, principal: 0 }, { orden: 2, principal: 1 }];
  const ANTES = { ahora: '2026-11-24 10:00:00', calendario: CALENDARIO };
  const DESPUES = { ahora: '2026-11-24 12:00:00', calendario: CALENDARIO };
  const detalle = (votacion, extra = {}) => votacionParaElDetalle({ votacion, edicion: EDICION, quienMira: 901, ...ANTES, ...extra });
  const enLaLista = (votacion, extra = {}) => votacionParaLaLista({ votacion, propuestas: GUARDADAS, quienMira: 901, ...ANTES, ...extra });

  it('una edición de antes (sin votación): null en las dos', () => {
    for (const votacion of [undefined, null]) {
      assert.equal(detalle(votacion), null);
      assert.equal(enLaLista(votacion), null);
    }
  });

  it('el detalle: votacionDelDetalle con las propuestas de la edición, la de Datito de su JSON y el estado de la leída', () => {
    const votos = [votoDe(2, [1, 2])];
    assert.deepEqual(detalle(leida({ votos })), votacionDelDetalle({
      propuestas: [{ orden: 1, titulo: 'Un título inventado' }, { orden: 2, titulo: 'Otro título inventado' }], deDatito: 2,
      estado: estadoDe(true, '2026-11-24 12:00'), personas: PERSONAS, votos, quienMira: 901
    }));
    // Cerrada sin votos queda la de Datito; sellada, su cierre guardado manda, aunque el calendario no se pueda leer
    assert.equal(detalle(leida(), DESPUES).resultado.orden, 2);
    const sellada = detalle(leida({ cierre_at: '2026-11-24 12:00:00' }), { calendario: CALENDARIO_CAIDO });
    assert.deepEqual([sellada.estado, sellada.cierre], ['cerrada', 'La votación cerró el martes 24/11/2026 a las 12:00.']);
  });

  it('la lista abierta: sin ganadora y lo de votacionDeLaLista, para quien mira', () => {
    assert.deepEqual(enLaLista(leida()), {
      abierta: true, orden_ganadora: null, de_la_lista: { texto: 'Se vota hasta el mar 24/11 a las 12:00', falta_tu_voto: true }
    });
    assert.equal(enLaLista(leida({ votos: [votoDe(1, [1, 2])] })).de_la_lista.falta_tu_voto, false);
    assert.equal(enLaLista(leida(), { quienMira: 777 }).de_la_lista.falta_tu_voto, false);
  });

  it('la lista cerrada: la ganadora de los votos vigentes, como el detalle; sin votos, la de Datito de las filas guardadas', () => {
    const votos = [votoDe(1, [1, 2]), votoDe(2, [1, 2]), votoDe(3, [2, 1]), votoDe(3, [1, 2], '2026-11-24 12:00:00')];
    assert.deepEqual(enLaLista(leida({ votos }), DESPUES), { abierta: false, orden_ganadora: 1, de_la_lista: null });
    assert.equal(detalle(leida({ votos }), DESPUES).resultado.orden, 1);
    assert.deepEqual(enLaLista(leida(), DESPUES), { abierta: false, orden_ganadora: 2, de_la_lista: null });
    // Un voto de las 12:00 ya no cuenta: sin él empatan y gana la de Datito (con él ganaría la 1)
    const tardio = [votoDe(1, [2, 1]), votoDe(2, [1, 2]), votoDe(3, [1, 2], '2026-11-24 12:00:00')];
    assert.equal(enLaLista(leida({ votos: tardio }), DESPUES).orden_ganadora, 2);
  });

  // Votaron todos el lunes 23/11: la 3 cerró a las 21:40 (el voto 3) y los cambios de después (4 y 5) no cuentan. Hasta el 3 gana la 1
  // por 5 a 4; con los cambios ganaría la 2, la de Datito
  const VOTOS_QUE_CIERRAN = [
    votoCon(1, 1, '1,2', '2026-11-23 21:00:00'),
    votoCon(2, 2, '1,2', '2026-11-23 21:10:00'),
    votoCon(3, 3, '2,1', '2026-11-23 21:40:12'),
    votoCon(4, 1, '2,1', '2026-11-23 21:50:00'),
    votoCon(5, 2, '2,1', '2026-11-23 21:55:00')
  ];

  it('cerrada porque votaron todos: el detalle y la lista lo toman de los votos de la leída, antes de las 12:00', () => {
    const votacion = leida({ votos: VOTOS_QUE_CIERRAN });
    const d = detalle(votacion);
    assert.deepEqual([d.estado, d.cierre, d.resultado.orden, d.resultado.texto],
      ['cerrada', 'La votación cerró el lunes 23/11/2026 a las 21:40, cuando votaron todos.', 1, 'Ganó por puntos: 5, contra 4 de la que siguió.']);
    assert.deepEqual(enLaLista(votacion), { abierta: false, orden_ganadora: 1, de_la_lista: null });
    // Pasadas las 12:00, igual; y sellada con la hora del voto que cerró, aunque el calendario no se pueda leer
    assert.deepEqual(enLaLista(votacion, DESPUES), { abierta: false, orden_ganadora: 1, de_la_lista: null });
    const sellada = leida({ votos: VOTOS_QUE_CIERRAN, cierre_at: '2026-11-23 21:40:00' });
    assert.deepEqual(enLaLista(sellada, { calendario: CALENDARIO_CAIDO }), { abierta: false, orden_ganadora: 1, de_la_lista: null });
    assert.equal(detalle(sellada, { calendario: CALENDARIO_CAIDO }).cierre, 'La votación cerró el lunes 23/11/2026 a las 21:40, cuando votaron todos.');
  });

  it('sellada al cierre de las 12:00 (antes de esta regla): cuenta como se selló, con todos los votos anteriores', () => {
    const sellada = leida({ votos: VOTOS_QUE_CIERRAN, cierre_at: '2026-11-24 12:00:00' });
    assert.deepEqual(enLaLista(sellada, DESPUES), { abierta: false, orden_ganadora: 2, de_la_lista: null });
    const d = detalle(sellada, DESPUES);
    assert.deepEqual([d.cierre, d.resultado.orden], ['La votación cerró el martes 24/11/2026 a las 12:00.', 2]);
  });
});

describe('itemsDeLaVotacionEnMiEspacio', () => {
  const votacion = (cambios = {}) => ({ edicion_id: 25, fecha_edicion: '2026-11-23', estado: ABIERTA, personas: PERSONAS, votos: [], ordenes: [1, 2], ...cambios });
  const items = (cambios, extra = {}) => itemsDeLaVotacionEnMiEspacio({ votaciones: [votacion(cambios)], usuarioId: 901, desde: '2026-11-01', hasta: '2026-11-30', ...extra });
  it('el día del cierre, para quien está en la foto y no votó', () => {
    const r = items();
    assert.deepEqual(r, [{
      fecha: '2026-11-24',
      hora: 'Hasta 12:00',
      texto: 'Votá la principal del dato de la quincena',
      nombre: 'Votá la principal del dato de la quincena',
      titulo: 'Votá la principal del dato de la quincena. Edición del lunes 23/11. Cierra a las 12:00.',
      detalle: 'Edición del lunes 23/11.',
      enlace: 'dato-quincena.html?id=25'
    }]);
    assert.deepEqual(Object.keys(r[0]), ['fecha', 'hora', 'texto', 'nombre', 'titulo', 'detalle', 'enlace']);
  });
  it('no aparece si ya votó', () => assert.deepEqual(items({ votos: [votoDe(1, [1, 2])] }), []));
  it('no aparece si no está en la foto', () => assert.deepEqual(items({}, { usuarioId: 777 }), []));
  it('sin usuario (null), ninguno: tampoco por una cuenta borrada', () => {
    assert.deepEqual(items({ personas: [{ persona_id: 2, usuario_id: null, nombre: null }] }, { usuarioId: null }), []);
  });
  it('no aparece si está cerrada ni sin calendario', () => {
    assert.deepEqual(items({ estado: CERRADA }), []);
    assert.deepEqual(items({ estado: SIN_CALENDARIO }), []);
  });
  it('no aparece si cerró porque votaron todos', () => {
    assert.deepEqual(items({ estado: POR_TODOS, personas: FOTO, votos: VOTOS_DE_TODOS }), []);
    // Con el estado de la leída, como lo arma Mi espacio: el mismo día del cierre de siempre, sin ítem
    const estado = estadoDeLaVotacionLeida({
      cierre_at: null, fecha_edicion: '2026-11-23', recibida_ts: Date.UTC(2026, 10, 23, 12, 45) / 1000, personas: FOTO, votos: VOTOS_DE_TODOS, ordenes: [1, 2]
    }, { ahora: '2026-11-23 22:00:00', calendario: CALENDARIO });
    assert.deepEqual(items({ estado, personas: FOTO, votos: VOTOS_DE_TODOS }), []);
  });
  it('no aparece fuera del rango, y el rango es inclusivo', () => {
    assert.deepEqual(items({}, { desde: '2026-11-25', hasta: '2026-11-30' }), []);
    assert.deepEqual(items({}, { desde: '2026-11-01', hasta: '2026-11-23' }), []);
    assert.equal(items({}, { desde: '2026-11-24', hasta: '2026-11-24' }).length, 1);
  });
  it('una por votación', () => {
    const r = itemsDeLaVotacionEnMiEspacio({
      votaciones: [votacion(), votacion({ edicion_id: 26, fecha_edicion: '2026-11-30', estado: estadoDe(true, '2026-12-01 12:00') })],
      usuarioId: 902, desde: '2026-11-01', hasta: '2026-12-31'
    });
    assert.deepEqual(r.map((i) => [i.fecha, i.enlace, i.detalle]), [
      ['2026-11-24', 'dato-quincena.html?id=25', 'Edición del lunes 23/11.'],
      ['2026-12-01', 'dato-quincena.html?id=26', 'Edición del lunes 30/11.']
    ]);
  });
});

describe('modeloDelMailDeLaVotacion', () => {
  const PROPUESTAS_MAIL = [
    { orden: 1, titulo: 'Un título inventado', cifra_clave: '1.234 casos · septiembre de 2026' },
    { orden: 2, titulo: 'Otro título inventado', cifra_clave: '56 casos · septiembre de 2026' }
  ];
  const modelo = (votos, nombreCompleto = 'Carla Ejemplo Inventada') => {
    const votacion = detalleVot({ estado: CERRADA, votos });
    return { votacion, modelo: modeloDelMailDeLaVotacion({
      edicion: { id: 25, fecha_edicion: '2026-11-23' }, propuestas: PROPUESTAS_MAIL, deDatito: 1, votacion, nombreCompleto,
      url: 'https://rpad.ejemplo.test/dato-quincena.html?id=25'
    }) };
  };
  it('gana otra: el asunto (con el año), el título del cuerpo (sin el año), el saludo, la ganadora con su cifra, los textos y la tabla', () => {
    const { votacion, modelo: m } = modelo([votoDe(1, [2, 1]), votoDe(2, [2, 1]), votoDe(3, [1, 2])]);
    assert.deepEqual(m, {
      asunto: 'La principal del equipo del lunes 23/11/2026',
      titulo: 'La principal del equipo del lunes 23/11',
      saludo: 'Hola, Carla:',
      edicion: 'El dato de la quincena del lunes 23/11/2026',
      intro: 'Cerró la votación de El dato de la quincena del lunes 23/11/2026. La principal del equipo es esta:',
      ganadora: { orden: 2, titulo: 'Otro título inventado', cifra_clave: '56 casos · septiembre de 2026', de_datito: false },
      resultado: 'Ganó por puntos: 5, contra 4 de la que siguió.',
      participacion: 'Votaron 3 de 3.',
      cierre: 'La votación cerró el martes 24/11/2026 a las 12:00.',
      tabla: votacion.resultado.tabla,
      regla: REGLA_2,
      boton: { texto: 'Ver la edición en el RPAD', url: 'https://rpad.ejemplo.test/dato-quincena.html?id=25' },
      nota: 'Te llega porque sos de administración del RPAD. Votan las personas con «Vota» tildado en la pestaña Envío y votación.'
    });
    assert.deepEqual(Object.keys(m), ['asunto', 'titulo', 'saludo', 'edicion', 'intro', 'ganadora', 'resultado', 'participacion', 'cierre', 'tabla', 'regla', 'boton', 'nota']);
  });
  it('nadie votó: la de Datito y sin tabla', () => {
    const { modelo: m } = modelo([]);
    assert.deepEqual(m.ganadora, { orden: 1, titulo: 'Un título inventado', cifra_clave: '1.234 casos · septiembre de 2026', de_datito: true });
    assert.equal(m.tabla, null);
    assert.equal(m.resultado, 'Nadie votó: quedó la de Datito.');
  });
  it('sin nombre, el saludo no lleva coma', () => {
    for (const n of [null, '', '   ']) assert.equal(modelo([], n).modelo.saludo, 'Hola:');
  });
  it('si la votación no cerró, tira', () => {
    assert.throws(() => modeloDelMailDeLaVotacion({
      edicion: { id: 25, fecha_edicion: '2026-11-23' }, propuestas: PROPUESTAS_MAIL, deDatito: 1, votacion: detalleVot(), nombreCompleto: 'X', url: 'u'
    }), /no cerró/);
  });
});
