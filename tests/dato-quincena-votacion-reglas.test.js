// La votación de la principal del equipo (spec 2026-11-23-dato-quincena-principal-votacion, decisiones y 2): las reglas puras
// del cierre, los votos vigentes, los puntos y el desempate. El calendario es el de la precarga (el 23/11/2026 y el 07/12 no se
// trabaja, el 08/12 es fijo) y el ahora, fijo. Las cifras son inventadas.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HORA_DEL_CIERRE, HORA_DEL_SELLADO, NOMBRE_SIN_CUENTA, MENSAJES_VOTACION, llegadaDe, cierreDeLaVotacion, estadoDeLaVotacion,
  ordenDelVoto, ordenDeTexto, votosVigentes, resultadoDeLaVotacion, debeSellar, textoDeLosQueVotan, textoDeLasListasGuardadas,
  cierreLargo, cierreMedio, cierreCorto, votacionDelDetalle, votacionDeLaLista, itemsDeLaVotacionEnMiEspacio, modeloDelMailDeLaVotacion,
  estadoDeLaVotacionLeida, mensajeDelVoto, votacionParaElDetalle, votacionParaLaLista
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

describe('estadoDeLaVotacion', () => {
  const base = { fecha_edicion: '2026-11-23', llegada: '2026-11-23 09:45', calendario: CALENDARIO };
  it('abierta hasta las 12:00 y cerrada desde ahí', () => {
    assert.deepEqual(estadoDeLaVotacion({ ...base, cierre_at: null, ahora: '2026-11-24 11:59:59' }), { abierta: true, cierre: '2026-11-24 12:00', sin_calendario: false });
    assert.deepEqual(estadoDeLaVotacion({ ...base, cierre_at: null, ahora: '2026-11-24 12:00:00' }), { abierta: false, cierre: '2026-11-24 12:00', sin_calendario: false });
  });
  it('sellada queda cerrada aunque el calendario falle', () => {
    const r = estadoDeLaVotacion({ ...base, calendario: CALENDARIO_CAIDO, cierre_at: '2026-11-24 12:00:00', ahora: '2026-11-24 09:00:00' });
    assert.deepEqual(r, { abierta: false, cierre: '2026-11-24 12:00', sin_calendario: false });
  });
  it('sin sellar y sin calendario: abierta y sin cierre', () => {
    const r = estadoDeLaVotacion({ ...base, calendario: CALENDARIO_CAIDO, cierre_at: null, ahora: '2026-11-24 13:00:00' });
    assert.deepEqual(r, { abierta: true, cierre: null, sin_calendario: true });
  });
});

// La votación tal como la lee leerVotaciones (spec 3): `recibida_ts` en segundos UNIX y `cierre_at` como texto o null. Una edición
// cuya llegada no se puede leer (solo con un SQL a mano) y que no está sellada se toma como sin calendario: abierta, sin cierre y sin
// voto que se guarde
describe('estadoDeLaVotacionLeida', () => {
  // 2026-11-23 12:45 UTC = 09:45 en Argentina
  const leida = (cambios = {}) => ({ cierre_at: null, fecha_edicion: '2026-11-23', recibida_ts: Date.UTC(2026, 10, 23, 12, 45) / 1000, ...cambios });
  it('con la llegada, el cierre de estadoDeLaVotacion', () => {
    assert.deepEqual(estadoDeLaVotacionLeida(leida(), { ahora: '2026-11-24 11:59:59', calendario: CALENDARIO }),
      { abierta: true, cierre: '2026-11-24 12:00', sin_calendario: false });
    assert.deepEqual(estadoDeLaVotacionLeida(leida(), { ahora: '2026-11-24 12:00:00', calendario: CALENDARIO }),
      { abierta: false, cierre: '2026-11-24 12:00', sin_calendario: false });
  });
  it('sellada: cerrada con su cierre, aunque falten la llegada o el calendario', () => {
    for (const calendario of [CALENDARIO, CALENDARIO_CAIDO]) {
      assert.deepEqual(estadoDeLaVotacionLeida(leida({ cierre_at: '2026-11-24 12:00:00', recibida_ts: null }), { ahora: '2026-11-24 09:00:00', calendario }),
        { abierta: false, cierre: '2026-11-24 12:00', sin_calendario: false });
    }
  });
  it('sin una llegada que se pueda leer y sin sellar: como sin calendario', () => {
    for (const recibida_ts of [null, undefined, 'no es un instante']) {
      assert.deepEqual(estadoDeLaVotacionLeida(leida({ recibida_ts }), { ahora: '2026-11-30 13:00:00', calendario: CALENDARIO }),
        { abierta: true, cierre: null, sin_calendario: true });
    }
  });
  it('sin calendario y sin sellar: abierta y sin cierre', () => {
    assert.deepEqual(estadoDeLaVotacionLeida(leida(), { ahora: '2026-11-30 13:00:00', calendario: CALENDARIO_CAIDO }),
      { abierta: true, cierre: null, sin_calendario: true });
  });
});

// El mensaje del PUT del voto (spec 3, «Votar»)
describe('mensajeDelVoto', () => {
  it('guardado: hasta cuándo se puede cambiar', () => {
    assert.equal(mensajeDelVoto({ cambio: true, cierre: '2026-11-24 12:00' }), 'Guardamos tu orden. Lo podés cambiar hasta el martes 24/11 a las 12:00.');
    assert.equal(mensajeDelVoto({ cambio: true, cierre: '2026-12-09 12:00' }), 'Guardamos tu orden. Lo podés cambiar hasta el miércoles 09/12 a las 12:00.');
  });
  it('el mismo orden: «Tu orden ya era ese.»', () => {
    assert.equal(mensajeDelVoto({ cambio: false, cierre: '2026-11-24 12:00' }), 'Tu orden ya era ese.');
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
const ABIERTA = { abierta: true, cierre: '2026-11-24 12:00', sin_calendario: false };
const CERRADA = { abierta: false, cierre: '2026-11-24 12:00', sin_calendario: false };
const SIN_CALENDARIO = { abierta: true, cierre: null, sin_calendario: true };
let siguienteId = 1;
const votoDe = (persona_id, orden, votado_at = '2026-11-24 09:00:00') => ({ id: siguienteId++, persona_id, orden: orden.join(','), votado_at });
const detalleVot = (cambios) => votacionDelDetalle({ propuestas: PROPUESTAS, deDatito: 1, estado: ABIERTA, personas: PERSONAS, votos: [], quienMira: 901, ...cambios });
const CLAVES = ['estado', 'resumen', 'cierre', 'participacion', 'puede_votar', 'falta_tu_voto', 'tu_orden', 'dialogo', 'resultado'];
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
      dialogo: 'Tocá las propuestas en orden, de la que más querés trabajar como principal a la que menos. Lo podés cambiar hasta el martes 24/11 a las 12:00.',
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
      estado: { abierta: true, cierre: '2026-11-24 12:00', sin_calendario: false }, personas: PERSONAS, votos, quienMira: 901
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
  it('no aparece fuera del rango, y el rango es inclusivo', () => {
    assert.deepEqual(items({}, { desde: '2026-11-25', hasta: '2026-11-30' }), []);
    assert.deepEqual(items({}, { desde: '2026-11-01', hasta: '2026-11-23' }), []);
    assert.equal(items({}, { desde: '2026-11-24', hasta: '2026-11-24' }).length, 1);
  });
  it('una por votación', () => {
    const r = itemsDeLaVotacionEnMiEspacio({
      votaciones: [votacion(), votacion({ edicion_id: 26, fecha_edicion: '2026-11-30', estado: { abierta: true, cierre: '2026-12-01 12:00', sin_calendario: false } })],
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
