// Reglas de las métricas (spec 2026-10-24-metricas-y-reportes, 1.1 a 1.3): funciones puras, probadas con los casos reales
// anonimizados del Seguimiento y con casos armados a mano (tests/metricas-casos.js)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CASOS, HOY_DE_LOS_CASOS as HOY, HOY_DE_LAS_METRICAS, fuentesDelCaso, con, mapaDe, mapaDeLosCasos, cambio, email, nota, notaDgmit, solo
} from './metricas-casos.js';
import {
  ESTADISTICOS, DIAS, VENTANA_DE_LA_REGLA, INICIO_DEL_REGISTRO, duracion, cifraDe, unidadDe, casosDe
} from '../services/metricasReglas.js';
import { ciclosDe, avisosDelCiclo } from '../services/seguimientoReglas.js';
import { diasEntre, diasHabilesTranscurridos } from '../services/notasDigitalesCalendario.js';

// Las claves de un caso, en el orden de la spec
const CLAVES = [
  'dataset_id', 'titulo', 'area', 'gestion', 'requiere_nota', 'activo', 'tema',
  'venc', 'inicio', 'cierre', 'como', 'abierto', 'aprobado',
  'aviso_regla', 'primer_aviso', 'heredado', 'inicio_tramos', 'fecha_regla', 'pudo_avisar', 'motivo_sin_aviso',
  'nota_dgmit', 'reiteraciones_dgmit',
  'recibido', 'origen', 'carga', 'cambio_id',
  'avisos_rpad', 'reiteraciones_rpad'
];

// Los casos de un dataset (por defecto, el real), en el orden de sus ciclos
const casosDel = (fuentes, hoy = HOY) => casosDe(mapaDe(fuentes), { hoy });
const casosDelCaso = (id, opciones, hoy = HOY) => casosDel(fuentesDelCaso(id, opciones), hoy);
// Lo de un caso que viene de su dataset (el 52, salvo lo que se pise)
const DEL_52 = {
  dataset_id: 52, titulo: 'Directores Generales de Planta Permanente', area: 'Dirección General de Relaciones Laborales', gestion: 'externa',
  requiere_nota: null, activo: true, tema: 'Gobierno y Gestión Pública'
};
// Lo de un caso sin aviso, sin nota DGMIT y sin el cambio que cierra (cada test pisa lo suyo)
const NADA = {
  aviso_regla: null, primer_aviso: null, heredado: false, inicio_tramos: null, fecha_regla: null, pudo_avisar: false, motivo_sin_aviso: null,
  nota_dgmit: null, reiteraciones_dgmit: 0, recibido: null, origen: null, carga: null, cambio_id: null, avisos_rpad: [], reiteraciones_rpad: null
};

describe('constantes', () => {
  it('los estadísticos, los días, la ventana de la regla y el inicio del registro', () => {
    assert.deepEqual(ESTADISTICOS, ['mediana', 'promedio']);
    assert.deepEqual(DIAS, ['habiles', 'corridos']);
    assert.deepEqual(VENTANA_DE_LA_REGLA, { externa: 40, interna: 60 });
    assert.equal(INICIO_DEL_REGISTRO, '2025-12-06');
    assert.ok(Object.isFrozen(ESTADISTICOS) && Object.isFrozen(DIAS) && Object.isFrozen(VENTANA_DE_LA_REGLA));
  });
});

describe('duracion', () => {
  it('duracion: hábiles sin contar el inicio, corridos con diasEntre, y piso 0', () => {
    // Del viernes 30/01/2026 al lunes 02/02/2026: un día hábil (el lunes) y tres corridos
    assert.equal(duracion('2026-01-30', '2026-02-02', 'habiles'), 1);
    assert.equal(duracion('2026-01-30', '2026-02-02', 'corridos'), 3);
    // El viernes 25/12/2026 es feriado: del jueves 24 al lunes 28, un día hábil y cuatro corridos
    assert.equal(duracion('2026-12-24', '2026-12-28', 'habiles'), 1);
    assert.equal(duracion('2026-12-24', '2026-12-28', 'corridos'), 4);
    // Lo mismo que el calendario en un tramo largo (del aviso de 40 al vencimiento del 52)
    assert.equal(duracion('2025-12-22', '2026-01-31', 'habiles'), diasHabilesTranscurridos('2025-12-22', '2026-01-31'));
    assert.equal(duracion('2025-12-22', '2026-01-31', 'corridos'), diasEntre('2025-12-22', '2026-01-31'));
    assert.equal(duracion('2025-12-22', '2026-01-31', 'corridos'), 40);
    // El mismo día, y un hito que llegó antes que el anterior (la nota DGMIT antes del aviso): 0, nunca negativo
    for (const dias of DIAS) {
      assert.equal(duracion('2026-03-10', '2026-03-10', dias), 0);
      assert.equal(duracion('2026-02-02', '2026-01-30', dias), 0);
      assert.equal(duracion('2026-03-31', '2025-12-01', dias), 0);
    }
    // Un momento cuenta por su día
    assert.equal(duracion('2026-01-30 08:00:06', '2026-02-02 23:59:59', 'corridos'), 3);
  });

  it('sin el tipo de días, o con uno que no existe, cuenta los hábiles (los de entrada); una fecha que no se puede leer da null', () => {
    assert.equal(duracion('2026-01-30', '2026-02-02'), 1);
    assert.equal(duracion('2026-01-30', '2026-02-02', 'foo'), 1);
    for (const [desde, hasta] of [[null, '2026-01-01'], ['2026-01-01', undefined], ['2026-02-30', '2026-03-01'], ['x', 'y'], [20260101, '2026-01-02']]) {
      assert.equal(duracion(desde, hasta, 'habiles'), null);
      assert.equal(duracion(desde, hasta, 'corridos'), null);
    }
  });
});

describe('cifraDe', () => {
  it('cifraDe: [1,2,3,10] → mediana 3 (2,5 redondeado), promedio 4; [] → nulls', () => {
    assert.deepEqual(cifraDe([1, 2, 3, 10]), { n: 4, mediana: 3, promedio: 4 });
    assert.deepEqual(cifraDe([10, 3, 1, 2]), { n: 4, mediana: 3, promedio: 4 });
    assert.deepEqual(cifraDe([]), { n: 0, mediana: null, promedio: null });
  });

  it('con un n impar, la del medio; los dos redondeados; lo que no es un número no cuenta', () => {
    assert.deepEqual(cifraDe([5]), { n: 1, mediana: 5, promedio: 5 });
    assert.deepEqual(cifraDe([4, 1, 2]), { n: 3, mediana: 2, promedio: 2 }); // 7/3 = 2,33
    assert.deepEqual(cifraDe([0, 0, 1]), { n: 3, mediana: 0, promedio: 0 }); // 0,33: «En el día» también con el promedio
    assert.deepEqual(cifraDe([1, 2]), { n: 2, mediana: 2, promedio: 2 }); // 1,5 redondea a 2
    assert.deepEqual(cifraDe([1, '2', NaN, null, undefined, Infinity, 3]), { n: 2, mediana: 2, promedio: 2 });
    for (const raro of [null, undefined, 'x', 3, {}]) assert.deepEqual(cifraDe(raro), { n: 0, mediana: null, promedio: null });
  });

  it('cifraDe no modifica la lista', () => {
    const valores = [10, 3, 1, 2];
    cifraDe(valores);
    assert.deepEqual(valores, [10, 3, 1, 2]);
  });
});

describe('unidadDe', () => {
  it('unidadDe: 1 → «1 día hábil»; 2 → «días hábiles»; corridos igual', () => {
    assert.equal(`1 ${unidadDe(1, 'habiles')}`, '1 día hábil');
    assert.equal(unidadDe(2, 'habiles'), 'días hábiles');
    assert.equal(unidadDe(27, 'habiles'), 'días hábiles');
    assert.equal(unidadDe(0, 'habiles'), 'días hábiles');
    assert.equal(`1 ${unidadDe(1, 'corridos')}`, '1 día corrido');
    assert.equal(unidadDe(2, 'corridos'), 'días corridos');
    assert.equal(unidadDe(40, 'corridos'), 'días corridos');
    // Sin el tipo de días, los de entrada
    assert.equal(unidadDe(1), 'día hábil');
    assert.equal(unidadDe(3, 'foo'), 'días hábiles');
  });
});

describe('casosDe', () => {
  it('un caso por ciclo de cada dataset, con la forma de la spec; también los de venc null, nunca los eventuales ni los sin fecha', () => {
    const casos = casosDe(mapaDeLosCasos(), { hoy: HOY });
    for (const caso of casos) assert.deepEqual(Object.keys(caso), CLAVES);
    for (const id of Object.keys(CASOS)) {
      const ciclos = ciclosDe(fuentesDelCaso(id), HOY) ?? [];
      const delDataset = casos.filter((c) => c.dataset_id === Number(id));
      assert.equal(delDataset.length, ciclos.length, `caso ${id}`);
      delDataset.forEach((caso, i) => {
        assert.deepEqual([caso.venc, caso.inicio, caso.cierre, caso.como, caso.aprobado],
          [ciclos[i].venc, ciclos[i].inicio, ciclos[i].cierre, ciclos[i].como, ciclos[i].hasta], `caso ${id}, ciclo ${i}`);
        assert.equal(caso.abierto, ciclos[i].como === null);
      });
    }
    // El 66 es eventual: ningún caso. Uno sin próxima, tampoco
    assert.equal(casos.filter((c) => c.dataset_id === 66).length, 0);
    assert.deepEqual(casosDel(solo({ id: 900, proxima: null })), []);
    assert.equal(casos.length, 26);
    // Los ciclos cerrados por las actualizaciones simples de diciembre de 2025 (52, 58 y 25) están, con venc null
    assert.deepEqual(casos.filter((c) => c.venc === null).map((c) => c.dataset_id), [25, 52, 58]);
  });

  it('un ciclo externo completo: aviso de 40, nota DGMIT, recibido, carga', () => {
    const fuentes = con(fuentesDelCaso(52, { importados: { 7: { recibido_el: '2026-02-02', origen_datos: 'area' } } }), {
      notasDgmit: [
        notaDgmit({ id: 2, numero: '60/26', tipo: 'reiteracion', recibida: '2026-01-20' }),
        notaDgmit({ id: 1, numero: '45/26', tipo: 'solicitud', recibida: '2026-01-05' })
      ]
    });
    const [, caso] = casosDel(fuentes);
    assert.deepEqual(caso, {
      ...DEL_52,
      venc: '2026-01-31', inicio: '2025-12-17', cierre: '2026-02-04', como: 'actualizacion', abierto: false, aprobado: '2026-02-04 09:58:15',
      aviso_regla: '2025-12-22', primer_aviso: '2025-12-22', heredado: false, inicio_tramos: '2025-12-22', fecha_regla: '2025-12-22',
      pudo_avisar: true, motivo_sin_aviso: null,
      nota_dgmit: { numero: '45/26', tipo: 'solicitud', recibida: '2026-01-05' }, reiteraciones_dgmit: 1,
      recibido: '2026-02-02', origen: 'area', carga: '2026-02-04', cambio_id: 7,
      // El externo-40, el externo-5 y el de vencidos (el email al área no es un aviso a la DGMIT)
      avisos_rpad: ['2025-12-22', '2026-01-26', '2026-02-01'], reiteraciones_rpad: 2
    });
    // La anticipación del aviso de la regla es justo la ventana
    assert.equal(duracion(caso.aviso_regla, caso.venc, 'corridos'), VENTANA_DE_LA_REGLA.externa);
  });

  it('un ciclo interno: el aviso de 60 días y la carga, sin origen', () => {
    // Lo importado del 12 trae un origen: en gestión interna no se pregunta, así que no cuenta
    const casos = casosDelCaso(38, { importados: { 12: { recibido_el: '2026-02-10', origen_datos: 'area' } } });
    assert.equal(casos.length, 3);
    const del38 = { dataset_id: 38, gestion: 'interna', requiere_nota: null, tema: 'Gobierno y Gestión Pública' };
    assert.deepEqual(casos[0], {
      ...casos[0], ...del38,
      venc: '2026-03-31', inicio: '2025-12-01', cierre: '2026-02-12', como: 'actualizacion', abierto: false, aprobado: '2026-02-12 11:44:21',
      aviso_regla: '2026-01-30', primer_aviso: '2026-01-30', heredado: false, inicio_tramos: '2026-01-30', fecha_regla: '2026-01-30',
      pudo_avisar: true, motivo_sin_aviso: null, nota_dgmit: null, reiteraciones_dgmit: 0,
      recibido: '2026-02-10', origen: null, carga: '2026-02-12', cambio_id: 12, avisos_rpad: ['2026-01-30'], reiteraciones_rpad: 0
    });
    assert.deepEqual(casos[1], {
      ...casos[1], ...del38,
      venc: '2026-09-30', inicio: '2026-02-12', cierre: '2026-10-02', como: 'actualizacion', abierto: false, aprobado: '2026-10-02 13:02:02',
      aviso_regla: '2026-08-01', primer_aviso: '2026-08-01', heredado: false, inicio_tramos: '2026-08-01', fecha_regla: '2026-08-01',
      pudo_avisar: true, motivo_sin_aviso: null, recibido: null, origen: null, carga: '2026-10-02', cambio_id: 46,
      avisos_rpad: ['2026-08-01', '2026-08-31', '2026-10-01'], reiteraciones_rpad: 2
    });
    // El abierto vence el 31/03/2027: la fecha de la regla (30/01/2027) todavía no llegó, así que no hay motivo
    assert.deepEqual(casos[2], {
      ...casos[2], ...del38, ...NADA,
      venc: '2027-03-31', inicio: '2026-10-02', cierre: null, como: null, abierto: true, aprobado: null,
      fecha_regla: '2027-01-30', pudo_avisar: true
    });
  });

  it('la Nota Digital de aviso, en próximos a vencer, también es el aviso de la regla; la de vencidos y la reiteración, no', () => {
    // El 10: el ciclo del 31/10/2026 lo avisó la Nota Digital 2/26 del 13/10 (la de los emails ya no existía)
    const diez = casosDelCaso(10)[3];
    assert.deepEqual([diez.venc, diez.aviso_regla, diez.fecha_regla, diez.pudo_avisar, diez.avisos_rpad, diez.reiteraciones_rpad],
      ['2026-10-31', '2026-10-13', '2026-09-21', true, ['2026-10-13'], 0]);
    // El 81 se dio de alta el 19/10/2026, después de la fecha de la regla (21/09): no pudo avisarse a tiempo, pero la nota 3/26 del
    // 20/10 lo avisó antes del vencimiento
    const [ochenta] = casosDelCaso(81);
    assert.deepEqual(ochenta, {
      ...ochenta, ...NADA, dataset_id: 81, venc: '2026-10-31', inicio: '2026-10-19', abierto: true,
      aviso_regla: '2026-10-20', primer_aviso: '2026-10-20', inicio_tramos: '2026-10-20', fecha_regla: '2026-09-21', pudo_avisar: false,
      avisos_rpad: ['2026-10-20'], reiteraciones_rpad: 0
    });
    // El abierto del 52: la nota 2/26 es de la sección de vencidos (no es la regla) y el aviso de la regla es el email de 40 días
    const abierto = casosDelCaso(52)[2];
    assert.equal(abierto.aviso_regla, '2026-06-21');
    assert.deepEqual(abierto.avisos_rpad, ['2026-06-21', '2026-07-26', '2026-08-01', '2026-09-01', '2026-10-01', '2026-10-13']);
    // Sin el email de 40, ni la de vencidos ni una reiteración son el aviso de la regla
    const sinElDe40 = fuentesDelCaso(52);
    sinElDe40.emails = sinElDe40.emails.filter((e) => e.id !== 42);
    sinElDe40.notas.push(
      nota({ id: 901, numero: 6, tipo: 'reiteracion', fecha: '2026-07-15', enviada: '2026-07-15 08:15:00', seccion: 'proximo', vencimiento: '2026-07-31' }),
      nota({ id: 902, numero: 7, tipo: 'aviso', fecha: '2026-07-16', enviada: '2026-07-16 08:15:00', seccion: 'vencido', vencimiento: '2026-07-31' })
    );
    const sinRegla = casosDel(sinElDe40)[2];
    assert.deepEqual([sinRegla.aviso_regla, sinRegla.primer_aviso, sinRegla.avisos_rpad.slice(0, 3)], [null, '2026-07-15', ['2026-07-15', '2026-07-16', '2026-07-26']]);
    // Una nota pendiente o fallida no es un aviso
    const pendiente = con(fuentesDelCaso(52), { notas: [
      nota({ id: 902, fecha: '2026-06-20', enviada: null, estado: 'pendiente', vencimiento: '2026-07-31' }),
      nota({ id: 903, fecha: '2026-06-20', enviada: null, estado: 'fallida', vencimiento: '2026-07-31' })
    ] });
    assert.deepEqual(casosDel(pendiente)[2], abierto);
  });

  it('un ciclo avisado ya vencido es heredado y empieza en su primer aviso', () => {
    // El 11 (Parque Automotor) venció el 31/01/2024: la fecha de la regla (22/12/2023) es anterior al registro de los envíos y al alta
    // (01/12/2025), que es el motivo de que no tuviera el aviso de la regla
    const [once] = casosDelCaso(11);
    assert.deepEqual(once, {
      ...once, ...NADA, dataset_id: 11, venc: '2024-01-31', inicio: '2025-12-01', abierto: true,
      primer_aviso: '2025-12-06', heredado: true, inicio_tramos: '2025-12-06', fecha_regla: '2023-12-22', pudo_avisar: false,
      motivo_sin_aviso: 'alta-cercana',
      avisos_rpad: ['2025-12-06', '2025-12-10', '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-07-01',
        '2026-08-01', '2026-09-01', '2026-10-01', '2026-10-13'],
      reiteraciones_rpad: 11
    });
    // El primer ciclo del 9 (venció el 31/01/2025): su primer aviso es un email de 40 días, pero llegó después del vencimiento, así
    // que no es el aviso de la regla
    const [nueve] = casosDelCaso(9);
    assert.deepEqual([nueve.aviso_regla, nueve.primer_aviso, nueve.heredado, nueve.inicio_tramos, nueve.pudo_avisar, nueve.reiteraciones_rpad, nueve.motivo_sin_aviso],
      [null, '2025-12-22', true, '2025-12-22', false, 2, 'alta-cercana']);
    // Interna: el 26 venció el 31/03/2025
    const [veintiseis] = casosDelCaso(26);
    assert.deepEqual([veintiseis.gestion, veintiseis.fecha_regla, veintiseis.heredado, veintiseis.inicio_tramos, veintiseis.reiteraciones_rpad, veintiseis.motivo_sin_aviso],
      ['interna', '2025-01-30', true, '2026-01-01', 10, 'alta-cercana']);
    // Por el alta: dado de alta después de la fecha de la regla (19/02/2026) y avisado recién vencido
    const [porElAlta] = casosDel(solo({ id: 900, alta: '2026-02-20 09:00:00', proxima: '2026-03-31', ultima: '2026-02-20' },
      { emails: [email({ tipo: 'externo-vencido', enviado: '2026-04-01 08:00:00' }), email({ id: 901, tipo: 'externo-vencido', enviado: '2026-05-01 08:00:00' })] }));
    assert.deepEqual([porElAlta.pudo_avisar, porElAlta.heredado, porElAlta.inicio_tramos, porElAlta.motivo_sin_aviso, porElAlta.reiteraciones_rpad],
      [false, true, '2026-04-01', 'alta-cercana', 1]);
    // Por el registro: un interno dado de alta en noviembre de 2025 que vencía el 31/01/2026 (su regla, el 02/12/2025, es anterior
    // al 06/12/2025, aunque posterior al alta)
    const [porElRegistro] = casosDel(solo({ id: 900, tipo_gestion: 'interna', alta: '2025-11-01 09:00:00', proxima: '2026-01-31', ultima: '2025-11-01' },
      { emails: [email({ tipo: 'interno-vencido', enviado: '2026-02-01 08:00:00' })] }));
    assert.deepEqual([porElRegistro.fecha_regla, porElRegistro.pudo_avisar, porElRegistro.heredado, porElRegistro.inicio_tramos, porElRegistro.motivo_sin_aviso],
      ['2025-12-02', false, true, '2026-02-01', 'ya-vencido']);
    // Un ciclo que no se pudo avisar a tiempo pero se avisó antes de vencer no es heredado
    const [antes] = casosDel(solo({ id: 900, alta: '2026-02-20 09:00:00', proxima: '2026-03-31', ultima: '2026-02-20' },
      { emails: [email({ enviado: '2026-03-26 08:00:00' })] }));
    assert.deepEqual([antes.pudo_avisar, antes.primer_aviso, antes.heredado, antes.inicio_tramos, antes.reiteraciones_rpad, antes.motivo_sin_aviso],
      [false, '2026-03-26', false, null, null, 'alta-cercana']);
  });

  it('sin el email de 40 porque falló: no es heredado y el motivo es email-fallido', () => {
    const fallido = fuentesDelCaso(52);
    fallido.emails.find((e) => e.id === 42).success = false;
    const abierto = casosDel(fallido)[2];
    assert.deepEqual(abierto, {
      ...abierto, ...DEL_52, ...NADA, venc: '2026-07-31', inicio: '2026-02-04', abierto: true, aprobado: null,
      primer_aviso: '2026-07-26', fecha_regla: '2026-06-21', pudo_avisar: true, motivo_sin_aviso: 'email-fallido',
      // El email que falló no es un aviso
      avisos_rpad: ['2026-07-26', '2026-08-01', '2026-09-01', '2026-10-01', '2026-10-13']
    });
    // Aunque fallaran también los de antes del vencimiento y el primer aviso llegara vencido: se podía avisar a tiempo, y el email que
    // falló pesa más que «ya vencido»
    fallido.emails.find((e) => e.id === 49).success = false;
    const vencido = casosDel(fallido)[2];
    assert.deepEqual([vencido.primer_aviso, vencido.heredado, vencido.inicio_tramos, vencido.motivo_sin_aviso, vencido.reiteraciones_rpad],
      ['2026-08-01', false, null, 'email-fallido', null]);
  });

  it('sin aviso de la regla: alta-cercana si el alta es de un día posterior a la regla; si no, sin-aviso; antes de la fecha de la regla, ninguno', () => {
    const conAlta = (alta) => casosDel(solo({ id: 900, alta, proxima: '2026-03-31', ultima: alta.slice(0, 10) },
      { emails: [email({ enviado: '2026-03-26 08:00:00' })] }))[0];
    // La fecha de la regla del 31/03/2026 es el 19/02/2026; el primer aviso (26/03) es de antes del vencimiento
    const mismoDia = conAlta('2026-02-19 10:00:00');
    assert.deepEqual([mismoDia.fecha_regla, mismoDia.pudo_avisar, mismoDia.motivo_sin_aviso, mismoDia.heredado], ['2026-02-19', true, 'sin-aviso', false]);
    const antes = conAlta('2026-02-18 10:00:00');
    assert.deepEqual([antes.pudo_avisar, antes.motivo_sin_aviso], [true, 'sin-aviso']);
    // Un alta posterior a la fecha de la regla: no se podía avisar a tiempo, y ese es el motivo
    const despues = conAlta('2026-02-20 10:00:00');
    assert.deepEqual([despues.pudo_avisar, despues.motivo_sin_aviso], [false, 'alta-cercana']);
    // Antes de la fecha de la regla todavía no hay motivo (el abierto del 58 vence el 30/11/2026: su regla es el 21/10)
    const abierto58 = casosDelCaso(58)[1];
    assert.deepEqual([abierto58.fecha_regla, abierto58.pudo_avisar, abierto58.aviso_regla, abierto58.motivo_sin_aviso, abierto58.avisos_rpad],
      ['2026-10-21', true, null, null, ['2026-10-01']]);
    assert.equal(casosDelCaso(58, {}, '2026-10-21')[1].motivo_sin_aviso, 'sin-aviso');
    // Con venc null no hay fecha de la regla ni motivo, aunque el ciclo haya tenido avisos (el que cerró la simple del 16/12/2025)
    const [simple58] = casosDelCaso(58);
    assert.deepEqual([simple58.venc, simple58.fecha_regla, simple58.avisos_rpad.length, simple58.motivo_sin_aviso], [null, null, 2, null]);
  });

  it('ya-vencido: sin aviso de la regla, con el alta antes de la regla y el primer aviso después del vencimiento', () => {
    // El 33 (real): vence el 31/01/2026, se dio de alta el 01/12/2025 (antes de su regla, el 22/12/2025) y su primer aviso es de junio.
    // Se podía avisar a tiempo, así que no es heredado
    const [treinta] = casosDelCaso(33);
    assert.deepEqual([treinta.aviso_regla, treinta.primer_aviso, treinta.pudo_avisar, treinta.heredado, treinta.motivo_sin_aviso, treinta.inicio_tramos],
      [null, '2026-06-21', true, false, 'ya-vencido', null]);
    // Armado: alta el 18/02/2026, regla el 19/02 y el primer aviso, el de vencidos del 01/04
    const [armado] = casosDel(solo({ id: 900, alta: '2026-02-18 10:00:00', proxima: '2026-03-31', ultima: '2026-02-18' },
      { emails: [email({ tipo: 'externo-vencido', enviado: '2026-04-01 08:00:00' })] }));
    assert.deepEqual([armado.pudo_avisar, armado.heredado, armado.motivo_sin_aviso], [true, false, 'ya-vencido']);
    // Sin ningún aviso, no es «ya vencido»: sin-aviso
    const [sinNada] = casosDel(solo({ id: 900, alta: '2026-02-18 10:00:00', proxima: '2026-03-31', ultima: '2026-02-18' }));
    assert.deepEqual([sinNada.primer_aviso, sinNada.motivo_sin_aviso], [null, 'sin-aviso']);
    // El día del vencimiento todavía no venció: un primer aviso ese día no es «ya vencido»
    const [elDia] = casosDel(solo({ id: 900, alta: '2026-02-18 10:00:00', proxima: '2026-03-31', ultima: '2026-02-18' },
      { emails: [email({ enviado: '2026-03-31 08:00:00' })] }));
    assert.deepEqual([elDia.primer_aviso, elDia.motivo_sin_aviso], ['2026-03-31', 'sin-aviso']);
  });

  it('el orden de los motivos: email-fallido, después alta-cercana, después ya-vencido', () => {
    // La fecha de la regla del 31/03/2026 es el 19/02/2026; el primer aviso, el de vencidos del 01/04, llega después del vencimiento
    const motivo = (alta, emails) => casosDel(solo({ id: 900, alta, proxima: '2026-03-31', ultima: alta.slice(0, 10) },
      { emails: [email({ tipo: 'externo-vencido', enviado: '2026-04-01 08:00:00' }), ...emails] }))[0].motivo_sin_aviso;
    // alta-cercana pesa más que ya-vencido (también en los reales 9, 11 y 26, arriba)
    assert.equal(motivo('2026-02-20 09:00:00', []), 'alta-cercana');
    assert.equal(motivo('2026-02-18 09:00:00', []), 'ya-vencido');
    // email-fallido pesa más que los dos
    const fallido = [email({ id: 901, tipo: 'externo-40', enviado: '2026-02-21 08:00:00', success: false })];
    assert.equal(motivo('2026-02-20 06:00:00', fallido), 'email-fallido');
    assert.equal(motivo('2026-02-18 09:00:00', fallido), 'email-fallido');
    // Un email que falló y no es de la regla no es el motivo, ni uno de la regla que falló después del vencimiento
    assert.equal(motivo('2026-02-18 09:00:00', [email({ id: 902, tipo: 'externo-5', enviado: '2026-03-26 08:00:00', success: false })]), 'ya-vencido');
    assert.equal(motivo('2026-02-18 09:00:00', [email({ id: 903, tipo: 'externo-40', enviado: '2026-04-05 08:00:00', success: false })]), 'ya-vencido');
  });

  it('la nota DGMIT anulada no cuenta', () => {
    const fuentes = con(fuentesDelCaso(52), {
      notasDgmit: [
        notaDgmit({ id: 3, numero: '40/26', tipo: 'solicitud', recibida: '2026-01-02', anulada: true }),
        notaDgmit({ id: 4, numero: '41/26', tipo: 'solicitud', recibida: '2026-01-10' }),
        notaDgmit({ id: 5, numero: '50/26', tipo: 'reiteracion', recibida: '2026-01-15', anulada: true })
      ]
    });
    const caso = casosDel(fuentes)[1];
    assert.deepEqual([caso.nota_dgmit, caso.reiteraciones_dgmit], [{ numero: '41/26', tipo: 'solicitud', recibida: '2026-01-10' }, 0]);
    // Todas anuladas: ninguna
    const anuladas = con(fuentesDelCaso(52), { notasDgmit: [notaDgmit({ id: 3, recibida: '2026-01-02', anulada: true })] });
    assert.deepEqual([casosDel(anuladas)[1].nota_dgmit, casosDel(anuladas)[1].reiteraciones_dgmit], [null, 0]);
    // Tampoco la que el área recibió después de hoy
    const despues = con(fuentesDelCaso(52), { notasDgmit: [notaDgmit({ id: 6, recibida: '2026-10-25' })] });
    assert.equal(casosDel(despues)[2].nota_dgmit, null);
    assert.deepEqual(casosDel(despues, '2026-10-25')[2].nota_dgmit, { numero: '156/26', tipo: 'solicitud', recibida: '2026-10-25' });
  });

  it('un cierre por reprogramación no tiene recibido ni carga', () => {
    // El 42 venció el 31/03/2026 y se reprogramó el 06/04/2026 al 30/04/2027. Aunque el cambio trajera una fecha y un origen, no
    // son datos recibidos: la reprogramación no actualizó nada
    const [reprogramado, abierto] = casosDelCaso(42, { importados: { 29: { recibido_el: '2026-04-01', origen_datos: 'area' } } });
    assert.deepEqual(reprogramado, {
      ...reprogramado, dataset_id: 42, gestion: 'externa',
      venc: '2026-03-31', inicio: '2025-12-01', cierre: '2026-04-06', como: 'reprogramacion', abierto: false, aprobado: '2026-04-06 08:16:23',
      aviso_regla: '2026-02-19', primer_aviso: '2026-01-30', heredado: false, inicio_tramos: '2026-02-19', fecha_regla: '2026-02-19',
      pudo_avisar: true, motivo_sin_aviso: null, nota_dgmit: null, reiteraciones_dgmit: 0,
      recibido: null, origen: null, carga: null, cambio_id: 29,
      // El de 60, el de 40 y el de vencidos (el de 5 días no se pudo enviar)
      avisos_rpad: ['2026-01-30', '2026-02-19', '2026-04-01'], reiteraciones_rpad: 1
    });
    assert.deepEqual([abierto.venc, abierto.inicio, abierto.abierto], ['2027-04-30', '2026-04-06', true]);
  });

  it('la actualización simple de diciembre de 2025 deja venc null en su ciclo', () => {
    const [simple, abierto] = casosDelCaso(58);
    assert.deepEqual(simple, {
      ...simple, ...NADA, dataset_id: 58, gestion: 'externa',
      venc: null, inicio: '2025-12-02', cierre: '2025-12-16', como: 'actualizacion', abierto: false, aprobado: '2025-12-16 11:47:48',
      // Sin vencimiento no hay aviso de la regla ni fecha de la regla; los avisos sí existieron
      primer_aviso: '2025-12-06', carga: '2025-12-16', avisos_rpad: ['2025-12-06', '2025-12-10']
    });
    assert.equal(abierto.venc, '2026-11-30');
    // En el 52, el ciclo de antes de la actualización simple del 17/12/2025 no tuvo avisos
    const [del52] = casosDelCaso(52);
    assert.deepEqual(del52, {
      ...del52, ...DEL_52, ...NADA, venc: null, inicio: '2025-12-01', cierre: '2025-12-17', como: 'actualizacion', abierto: false,
      aprobado: '2025-12-17 08:54:29', carga: '2025-12-17'
    });
  });

  it('un dataset dado de baja tiene ciclos hasta la baja', () => {
    // El 52 dado de baja el 02/09/2026 (después no recibe avisos)
    const baja = fuentesDelCaso(52, { dataset: { activo: false } });
    baja.cambios.push(cambio({ id: 95, tipo: 'eliminar', creado: '2026-09-01 10:00:00', revisado: '2026-09-02 11:00:00' }));
    baja.emails = baja.emails.filter((e) => e.enviado < '2026-09-02');
    baja.notas = [];
    const casos = casosDel(baja);
    assert.equal(casos.length, 3);
    assert.ok(casos.every((c) => c.activo === false));
    assert.deepEqual(casos[2], {
      ...casos[2], ...DEL_52, activo: false,
      venc: '2026-07-31', inicio: '2026-02-04', cierre: '2026-09-02', como: 'baja', abierto: false, aprobado: '2026-09-02 11:00:00',
      aviso_regla: '2026-06-21', primer_aviso: '2026-06-21', heredado: false, inicio_tramos: '2026-06-21', fecha_regla: '2026-06-21',
      pudo_avisar: true, motivo_sin_aviso: null, recibido: null, origen: null, carga: null, cambio_id: null,
      avisos_rpad: ['2026-06-21', '2026-07-26', '2026-08-01', '2026-09-01'], reiteraciones_rpad: 3
    });
    // Los de antes siguen como siempre
    assert.deepEqual(casos.slice(0, 2), casosDelCaso(52).slice(0, 2).map((c) => ({ ...c, activo: false })));
    // La baja no tiene un cambio que la cierre, aunque en el mismo segundo se haya aprobado una edición de la ficha
    baja.cambios.push(cambio({ id: 96, revisado: '2026-09-02 11:00:00', nuevos: { titulo: 'Otro título' }, anteriores: { titulo: CASOS[52].dataset.titulo } }));
    assert.equal(casosDel(baja)[2].cambio_id, null);
  });

  it('un dataset con varios ciclos en el año: uno por vencimiento, cada uno con su aviso, su carga y su cambio', () => {
    const casos = casosDelCaso(10);
    assert.deepEqual(casos.map((c) => [c.venc, c.como, c.carga, c.cambio_id, c.aviso_regla, c.reiteraciones_rpad]), [
      ['2026-01-31', 'actualizacion', '2026-02-18', 13, '2025-12-22', 2],
      ['2026-05-31', 'actualizacion', '2026-05-22', 37, '2026-04-21', 0],
      ['2026-07-31', 'actualizacion', '2026-09-25', 45, '2026-06-21', 3],
      ['2026-10-31', 'actualizacion', '2026-10-13', 48, '2026-10-13', 0],
      ['2027-01-31', null, null, null, null, null]
    ]);
    // El segundo ciclo tuvo antes el email de 60 días: no es una reiteración del de 40
    assert.deepEqual(casos[1].avisos_rpad, ['2026-04-01', '2026-04-21']);
    assert.equal(casos[1].primer_aviso, '2026-04-01');
  });

  it('los avisos del RPAD son los del Seguimiento (avisosDelCiclo), y las reiteraciones, los de días posteriores al inicio de los tramos', () => {
    for (const id of Object.keys(CASOS)) {
      const fuentes = fuentesDelCaso(id);
      const ciclos = ciclosDe(fuentes, HOY) ?? [];
      casosDel(fuentes).forEach((caso, i) => {
        const avisos = avisosDelCiclo(fuentes, ciclos, i);
        assert.equal(caso.avisos_rpad.length, avisos.total, `caso ${id}, ciclo ${i}`);
        assert.deepEqual(caso.avisos_rpad, [...caso.avisos_rpad].sort());
        if (caso.avisos_rpad.length) assert.equal(caso.avisos_rpad.at(-1), avisos.ultimo);
        const esperadas = caso.inicio_tramos === null ? null : caso.avisos_rpad.filter((dia) => dia > caso.inicio_tramos).length;
        assert.equal(caso.reiteraciones_rpad, esperadas);
      });
    }
    // Dos emails el mismo día del aviso de la regla (una corrida manual): los dos son avisos, ninguno es una reiteración
    const doble = con(fuentesDelCaso(52), { emails: [email({ id: 901, tipo: 'externo-40', enviado: '2026-06-21 11:00:00' })] });
    const abierto = casosDel(doble)[2];
    assert.deepEqual([abierto.avisos_rpad.slice(0, 2), abierto.reiteraciones_rpad], [['2026-06-21', '2026-06-21'], 5]);
  });

  it('lo que pasa después de hoy todavía no es un aviso', () => {
    const fuentes = con(fuentesDelCaso(52), {
      emails: [email({ id: 901, tipo: 'externo-vencido', enviado: '2026-10-22 08:00:00' })],
      notas: [nota({ id: 901, numero: 9, tipo: 'reiteracion', fecha: '2026-10-23', enviada: '2026-10-23 08:15:00', seccion: 'vencido', vencimiento: '2026-07-31' })]
    });
    assert.equal(casosDel(fuentes, HOY)[2].avisos_rpad.length, 6);
    assert.deepEqual(casosDel(fuentes, '2026-10-22')[2].avisos_rpad.slice(-2), ['2026-10-13', '2026-10-22']);
    assert.deepEqual(casosDel(fuentes, HOY_DE_LAS_METRICAS)[2].avisos_rpad.slice(-3), ['2026-10-13', '2026-10-22', '2026-10-23']);
  });

  it('«Requiere nota DGMIT», la gestión, el tema y el origen de los datos', () => {
    const conRequiere = (valor, dataset = {}) => casosDel(fuentesDelCaso(52, { dataset: { requiere_nota: valor, ...dataset } }));
    // El 0 es un valor: «No»
    assert.ok(conRequiere(0).every((c) => c.requiere_nota === 0));
    assert.ok(conRequiere(1).every((c) => c.requiere_nota === 1));
    assert.ok(conRequiere('1').every((c) => c.requiere_nota === 1));
    assert.ok(conRequiere(false).every((c) => c.requiere_nota === 0));
    assert.ok(conRequiere('x').every((c) => c.requiere_nota === null));
    // En gestión interna, siempre null, y la regla es la de 60 días
    const interna = conRequiere(1, { tipo_gestion: 'interna' });
    assert.ok(interna.every((c) => c.requiere_nota === null && c.gestion === 'interna'));
    assert.deepEqual([interna[1].fecha_regla, interna[1].origen, interna[1].recibido], ['2025-12-02', null, '2026-02-04']);
    // Una gestión rara cuenta como externa (como en el Seguimiento)
    assert.ok(conRequiere(null, { tipo_gestion: null }).every((c) => c.gestion === 'externa'));
    // El origen, solo si es uno de los dos
    const origen = (valor) => casosDelCaso(52, { importados: { 7: { recibido_el: '2026-02-04', origen_datos: valor } } })[1].origen;
    assert.equal(origen('fuente_publica'), 'fuente_publica');
    assert.equal(origen('area'), 'area');
    assert.equal(origen('otro'), null);
    assert.equal(origen(null), null);
    // Sin tema, null
    assert.ok(casosDel(fuentesDelCaso(52, { dataset: { tema_principal: undefined } })).every((c) => c.tema === null));
  });

  it('con datos raros no tira: devuelve una lista vacía o ignora lo que no puede leer', () => {
    const fuentes = fuentesDelCaso(52);
    for (const [mapa, opciones] of [[null, { hoy: HOY }], [undefined, { hoy: HOY }], [[fuentes], { hoy: HOY }], [{ 52: fuentes }, { hoy: HOY }],
      [mapaDe(fuentes), null], [mapaDe(fuentes), undefined], [mapaDe(fuentes), {}], [mapaDe(fuentes), { hoy: 'x' }], [mapaDe(fuentes), { hoy: '2026-02-30' }]]) {
      assert.deepEqual(casosDe(mapa, opciones), []);
    }
    assert.deepEqual(casosDe(new Map(), { hoy: HOY }), []);
    assert.deepEqual(casosDe(new Map([[1, null], [2, {}], [3, { dataset: null }], [4, { dataset: 'x' }], [5, 'x']]), { hoy: HOY }), []);
    // Avisos, notas, cambios y notas DGMIT que no se pueden leer no cambian nada
    const raros = con(fuentesDelCaso(52), {
      emails: [null, 'x', {}, email({ id: 901, tipo: 'externo-40', enviado: 'mal' }), email({ id: 902, tipo: 'otro', enviado: '2026-06-22 08:00:00' }),
        email({ id: 903, tipo: 'area-aviso-40', enviado: '2026-06-22 08:00:00' })],
      notas: [null, 'x', nota({ id: 901, fecha: 'mal', enviada: null }), nota({ id: 902, tipo: 'auditoria', fecha: '2026-06-22', enviada: '2026-06-22 08:15:00' })],
      cambios: [null, 'x', cambio({ id: 901, revisado: null, estado: 'aprobado' })],
      notasDgmit: [null, 'x', notaDgmit({ id: 9, numero: '', recibida: '2026-01-05' })]
    });
    raros.emails = raros.emails.concat([{ tipo: 'externo-40' }]);
    assert.deepEqual(casosDel(raros), casosDelCaso(52));
    // Una nota enviada sin el momento del envío cuenta el día de la nota
    const sinMomento = con(solo({ id: 900, alta: '2026-02-01 09:00:00', proxima: '2026-03-31', ultima: '2026-02-01' }),
      { notas: [nota({ fecha: '2026-02-19', enviada: null, vencimiento: '2026-03-31' })] });
    assert.equal(casosDel(sinMomento)[0].aviso_regla, '2026-02-19');
  });

  it('casosDe no modifica las fuentes', () => {
    const mapa = mapaDeLosCasos();
    const antes = structuredClone([...mapa.values()]);
    casosDe(mapa, { hoy: HOY });
    assert.deepEqual([...mapa.values()], antes);
  });

  it('con los casos reales al 24/10/2026, el externo 52 (31/01/2026) da aviso 22/12/2025, recibido y carga 04/02/2026, origen área', () => {
    const casos = casosDe(mapaDeLosCasos(), { hoy: HOY_DE_LAS_METRICAS });
    const caso = casos.find((c) => c.dataset_id === 52 && c.venc === '2026-01-31');
    assert.deepEqual([caso.aviso_regla, caso.recibido, caso.carga, caso.origen], ['2025-12-22', '2026-02-04', '2026-02-04', 'area']);
    assert.deepEqual([caso.heredado, caso.inicio_tramos, caso.cambio_id, caso.como], [false, '2025-12-22', 7, 'actualizacion']);
    // La anticipación y la preparación y carga (el mismo día: 0), contadas como las cuenta la página
    assert.equal(duracion(caso.aviso_regla, caso.venc, 'habiles'), diasHabilesTranscurridos('2025-12-22', '2026-01-31'));
    assert.equal(duracion(caso.recibido, caso.carga, 'habiles'), 0);
  });
});
