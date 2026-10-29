// Reglas de las métricas (spec 2026-10-24-metricas-y-reportes, 1.1 a 1.7 y 2.2): funciones puras, probadas con los casos reales
// anonimizados del Seguimiento y con casos armados a mano (tests/metricas-casos.js y, para la vista, los de este archivo)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CASOS, HOY_DE_LOS_CASOS as HOY, HOY_DE_LAS_METRICAS, fuentesDelCaso, con, mapaDe, mapaDeLosCasos, cambio, email, nota, notaDgmit, solo
} from './metricas-casos.js';
import {
  ESTADISTICOS, DIAS, VENTANA_DE_LA_REGLA, INICIO_DEL_REGISTRO, PRIMER_ANIO, duracion, cifraDe, unidadDe, casosDe, vistaDe,
  casosQueTocanElAnio, indiceMesAMes, estadosAl, antiguedadDeVencidos, contextoDelAnio, trabajoDelAnio, areasYTemas, etapasDe, conAnterior
} from '../services/metricasReglas.js';
import { cintasDeLaVista } from '../services/metricasCinta.js';
import { ciclosDe, avisosDelCiclo } from '../services/seguimientoReglas.js';
import { estadoDelDataset, tasaDeActualizacion, cumplimientoPorArea } from '../services/fechasDatasetReglas.js';
import { diasEntre, diasHabilesTranscurridos, sumarDias, VENTANA_DIAS } from '../services/notasDigitalesCalendario.js';
import { fechaDeAvisoPorRegla } from '../services/reportesAgenda.js';

// Las claves de un caso, en el orden de la spec
const CLAVES = [
  'dataset_id', 'titulo', 'area', 'gestion', 'requiere_nota', 'activo', 'tema',
  'venc', 'inicio', 'cierre', 'como', 'abierto', 'aprobado',
  'aviso_regla', 'primer_aviso', 'heredado', 'inicio_tramos', 'fecha_regla', 'pudo_avisar', 'motivo_sin_aviso',
  'nota_dgmit', 'reiteraciones_dgmit',
  'recibido', 'origen', 'carga', 'cambio_id',
  'avisos_rpad', 'reiteraciones_rpad',
  'alta', 'aviso_que', 'emails_rpad'
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
// Revisión final (A-1): un externo con la próxima del 30/06/2026 (su regla, el 21/05/2026) que dejó de regir en el RPAD antes de esa
// fecha, sin avisos: dado de baja el 10/03/2026, o actualizado (la carga del 05/04/2026, con la aprobación en `revisado`) con la próxima
// nueva del 31/03/2027 (su regla todavía no llegó)
const dadoDeBaja = () => solo({ id: 900, titulo: 'Dado de baja', alta: '2026-01-05 09:00:00', proxima: '2026-06-30', ultima: '2026-01-05', activo: false },
  { cambios: [cambio({ id: 61, tipo: 'eliminar', creado: '2026-03-10 10:00:00', revisado: '2026-03-10 11:00:00', dataset_id: 900 })] });
const actualizadoEl = (revisado, { id = 901, titulo = 'Actualizado temprano' } = {}) => solo(
  { id, titulo, alta: '2026-01-05 09:00:00', proxima: '2027-03-31', ultima: '2026-04-05' },
  {
    cambios: [cambio({
      id: 62, creado: '2026-04-05 10:00:00', revisado, dataset_id: id,
      nuevos: { proxima_actualizacion: '2027-03-31', ultima_actualizacion: '2026-04-05', recibido_el: '2026-04-03', origen_datos: 'area', registro_actualizacion: true },
      anteriores: { proxima_actualizacion: '2026-06-30', ultima_actualizacion: '2026-01-05' }
    })]
  }
);

describe('constantes', () => {
  it('los estadísticos, los días, la ventana de la regla, el inicio del registro y el primer año', () => {
    assert.deepEqual(ESTADISTICOS, ['mediana', 'promedio']);
    assert.deepEqual(DIAS, ['habiles', 'corridos']);
    // La ventana de la regla es la de las Notas Digitales, la del calendario (Ruling 30: una sola fuente; sus valores, en
    // notas-calendario.test.js)
    assert.equal(VENTANA_DE_LA_REGLA, VENTANA_DIAS);
    assert.equal(INICIO_DEL_REGISTRO, '2025-12-06');
    assert.equal(PRIMER_ANIO, 2026);
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
      avisos_rpad: ['2025-12-22', '2026-01-26', '2026-02-01'], reiteraciones_rpad: 2,
      alta: '2025-12-01', aviso_que: 'email de 40 días', emails_rpad: ['2025-12-22', '2026-01-26', '2026-02-01']
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
    // Antes de la fecha de la regla todavía no hay motivo (el abierto del 58 vence el 30/11/2026: su regla es el 21/10). El día del aviso
    // cuenta recién al día siguiente (revisión final, A-2: la corrida de las 8:15 puede no haber salido)
    const abierto58 = casosDelCaso(58)[1];
    assert.deepEqual([abierto58.fecha_regla, abierto58.pudo_avisar, abierto58.aviso_regla, abierto58.motivo_sin_aviso, abierto58.avisos_rpad],
      ['2026-10-21', true, null, null, ['2026-10-01']]);
    assert.equal(casosDelCaso(58, {}, '2026-10-21')[1].motivo_sin_aviso, null);
    assert.equal(casosDelCaso(58, {}, '2026-10-22')[1].motivo_sin_aviso, 'sin-aviso');
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

  // Revisión final (A-1 y A-2): el motivo es de un ciclo que esperaba el aviso de la regla. El aviso sale el día hábil desde la fecha de
  // la regla (proximoDiaHabil, la regla de la Agenda) y ese día cuenta recién al siguiente (la corrida de las 8:15 puede no haber
  // salido); un ciclo que dejó de regir en el RPAD antes del día del aviso (por su aprobación, no por la carga) no lo esperaba
  it('sin motivo si el ciclo dejó de regir antes del día del aviso, o si ese día todavía no terminó', () => {
    const hoy = HOY_DE_LAS_METRICAS;
    // Dado de baja el 10/03/2026, con la próxima del 30/06/2026 (su regla, el jueves 21/05)
    const [baja] = casosDel(dadoDeBaja(), hoy);
    assert.deepEqual([baja.como, baja.fecha_regla, baja.aviso_regla, baja.motivo_sin_aviso], ['baja', '2026-05-21', null, null]);
    // Actualizado el 05/04, antes del día de la regla: tampoco lo esperaba
    const [temprano] = casosDel(actualizadoEl('2026-04-05 11:00:00'), hoy);
    assert.deepEqual([temprano.como, temprano.carga, temprano.fecha_regla, temprano.motivo_sin_aviso], ['actualizacion', '2026-04-05', '2026-05-21', null]);
    // Cargado el 05/04 pero aprobado el 25/05, después del día de la regla: hasta la aprobación regía la próxima del 30/06 y lo esperaba
    const [tarde] = casosDel(actualizadoEl('2026-05-25 11:00:00'), hoy);
    assert.deepEqual([tarde.carga, tarde.aprobado, tarde.motivo_sin_aviso], ['2026-04-05', '2026-05-25 11:00:00', 'sin-aviso']);
    // Aprobado el mismo día del aviso, sin el aviso: no lo esperaba (pudo aprobarse antes de las 8:15)
    assert.equal(casosDel(actualizadoEl('2026-05-21 07:00:00'), hoy)[0].motivo_sin_aviso, null);
    assert.equal(casosDel(actualizadoEl('2026-05-22 07:00:00'), hoy)[0].motivo_sin_aviso, 'sin-aviso');
    // El vencimiento del 30/04/2027: su regla cae el domingo 21/03/2027 y el aviso sale el lunes 22/03
    const venceEnAbril = solo({ id: 900, alta: '2027-01-04 09:00:00', proxima: '2027-04-30', ultima: '2027-01-04' });
    assert.deepEqual(['2027-03-21', '2027-03-22', '2027-03-23'].map((dia) => casosDel(venceEnAbril, dia)[0].motivo_sin_aviso), [null, null, 'sin-aviso']);
    // Interna: la regla del 30/06/2026 cae el viernes 01/05/2026, feriado, y el aviso sale el lunes 04/05
    const interna = solo({ id: 900, tipo_gestion: 'interna', alta: '2026-01-05 09:00:00', proxima: '2026-06-30', ultima: '2026-01-05' });
    assert.equal(casosDel(interna, '2026-05-04')[0].fecha_regla, '2026-05-01');
    assert.deepEqual(['2026-05-03', '2026-05-04', '2026-05-05'].map((dia) => casosDel(interna, dia)[0].motivo_sin_aviso), [null, null, 'sin-aviso']);
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

  it('emails_rpad: los días de los avisos del ciclo que fueron emails a la DGMIT (no las Notas Digitales)', () => {
    const casos = casosDe(mapaDeLosCasos(), { hoy: HOY_DE_LAS_METRICAS });
    const del = (id, venc) => casos.find((c) => c.dataset_id === id && c.venc === venc);
    // Los del 52 del 31/01/2026 fueron emails (de 40 días, de 5 y el de vencidos); el ciclo del 31/10/2026 del 10 tuvo solo Notas
    // Digitales
    assert.deepEqual(del(52, '2026-01-31').emails_rpad, del(52, '2026-01-31').avisos_rpad);
    assert.deepEqual(del(10, '2026-10-31').emails_rpad, []);
    assert.ok(del(10, '2026-10-31').avisos_rpad.length > 0);
    // Siempre un subconjunto de los avisos del ciclo, en su orden
    for (const caso of casos) assert.ok(caso.emails_rpad.every((dia) => caso.avisos_rpad.includes(dia)), `${caso.dataset_id} ${caso.venc}`);
    // Un email que no se pudo enviar no es un aviso
    const [fallido] = casosDel(solo({ id: 900, alta: '2026-01-02 09:00:00', proxima: '2026-03-31', ultima: '2026-01-02' },
      { emails: [email({ tipo: 'externo-40', enviado: '2026-02-19 08:00:00', success: false })] }));
    assert.deepEqual([fallido.avisos_rpad, fallido.emails_rpad], [[], []]);
  });

  it('alta y aviso_que: el día del alta y qué fue el aviso desde el que se cuentan los tramos (o, sin él, el primero)', () => {
    const casos = casosDe(mapaDeLosCasos(), { hoy: HOY_DE_LAS_METRICAS });
    const del = (id, venc) => casos.find((c) => c.dataset_id === id && c.venc === venc);
    // El aviso de la regla: el email de 40 días (el 52) o de 60 (el 38, interno), o la Nota Digital de aviso (el 10 y el 81)
    assert.deepEqual([del(52, '2026-01-31').alta, del(52, '2026-01-31').aviso_que], ['2025-12-01', 'email de 40 días']);
    assert.equal(del(38, '2026-03-31').aviso_que, 'email de 60 días');
    assert.equal(del(10, '2026-10-31').aviso_que, 'Nota Digital 2/26');
    assert.deepEqual([del(81, '2026-10-31').alta, del(81, '2026-10-31').aviso_que], ['2026-10-19', 'Nota Digital 3/26']);
    // El ciclo del 31/05/2026 del 10 tuvo antes el email de 60 días: el que cuenta es el de la regla
    assert.deepEqual([del(10, '2026-05-31').primer_aviso, del(10, '2026-05-31').aviso_que], ['2026-04-01', 'email de 40 días']);
    // Avisado ya vencido (el 11, el 26) o sin aviso de la regla (el 33): el primero del ciclo
    assert.equal(del(11, '2024-01-31').aviso_que, 'email mensual de vencidos');
    assert.equal(del(26, '2025-03-31').aviso_que, 'email mensual de vencidos');
    assert.equal(del(33, '2026-01-31').aviso_que, 'email de 40 días');
    // Sin avisos, null; los demás emails dicen sus días
    assert.equal(del(9, '2027-01-31').aviso_que, null);
    const [cinco] = casosDel(solo({ id: 900, alta: '2026-02-20 09:00:00', proxima: '2026-03-31', ultima: '2026-02-20' },
      { emails: [email({ tipo: 'externo-5', enviado: '2026-03-26 08:00:00' })] }));
    assert.deepEqual([cinco.alta, cinco.aviso_que], ['2026-02-20', 'email de 5 días']);
    // Una Nota Digital enviada sin número o sin año (los dos pueden ser NULL en la tabla): 'Nota Digital', nunca 'Nota Digital null/ll'
    for (const falta of [{ numero: null }, { anio: null }, { numero: '' }, { numero: undefined, anio: undefined }]) {
      const [sinNumero] = casosDel(solo({ id: 900, alta: '2026-02-01 09:00:00', proxima: '2026-03-31', ultima: '2026-02-01' },
        { notas: [nota({ fecha: '2026-02-19', enviada: '2026-02-19 08:15:00', vencimiento: '2026-03-31', ...falta })] }));
      assert.deepEqual([sinNumero.aviso_regla, sinNumero.aviso_que], ['2026-02-19', 'Nota Digital'], JSON.stringify(falta));
    }
    // Sin alta conocida, null
    assert.ok(casosDel(fuentesDelCaso(52, { dataset: { alta: null } })).every((c) => c.alta === null));
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

// ---------------------------------------------------------------------------------------------------------------------
// La vista (spec, 1.3 a 1.5, 1.7 y 2.2)
// ---------------------------------------------------------------------------------------------------------------------

// Las opciones de la página al entrar, al 24/10/2026: el año en curso, mediana y días hábiles, con todos los datasets
const AL = HOY_DE_LAS_METRICAS;
const OPCIONES = Object.freeze({ anio: 2026, al: AL, estadistico: 'mediana', dias: 'habiles' });
const vista = (casos, opciones = {}) => vistaDe(casos, { ...OPCIONES, ...opciones });
const casosReales = (opciones) => casosDe(mapaDeLosCasos(opciones), { hoy: AL });
const tramoDe = (v, gestion, clave) => v.circuito[gestion].find((t) => t.clave === clave);
const cifraDel = (v, gestion, clave) => tramoDe(v, gestion, clave).cifra;
const filasDe = (v, id) => v.casos.filter((f) => f.dataset_id === id);

// Un caso armado a mano, con la forma de casosDe: un externo con «Requiere nota» Sí que vence el 31/03/2026, avisado por la regla el
// 19/02/2026 (27 días hábiles y 40 corridos antes), abierto y sin nota DGMIT
const caso = (datos = {}) => ({
  dataset_id: 900, titulo: 'Dataset de prueba', area: 'Área de prueba', gestion: 'externa', requiere_nota: 1, activo: true, tema: null,
  venc: '2026-03-31', inicio: '2026-01-02', cierre: null, como: null, abierto: true, aprobado: null,
  aviso_regla: '2026-02-19', primer_aviso: '2026-02-19', heredado: false, inicio_tramos: '2026-02-19', fecha_regla: '2026-02-19',
  pudo_avisar: true, motivo_sin_aviso: null, nota_dgmit: null, reiteraciones_dgmit: 0, recibido: null, origen: null, carga: null,
  cambio_id: null, avisos_rpad: ['2026-02-19'], reiteraciones_rpad: 0, alta: '2026-01-02', aviso_que: 'email de 40 días', ...datos
});
// El mismo, cerrado por una actualización: los datos llegaron el 06/04/2026 y se cargaron el 08/04/2026 (2 días hábiles)
const cerrado = (datos = {}) => caso({
  cierre: '2026-04-08', como: 'actualizacion', abierto: false, aprobado: '2026-04-08 10:00:00', recibido: '2026-04-06', origen: 'area',
  carga: '2026-04-08', cambio_id: 500, ...datos
});
const notaDe = (recibida, datos = {}) => ({ numero: '45/26', tipo: 'solicitud', recibida, ...datos });
// Qué dice la cobertura del aviso de los que sí lo tuvieron (con los días de la regla: 40 en externa y 60 en interna)
const REGLA_DEL_AVISO = 'El RPAD avisó con la anticipación de la regla (40 días en externa, 60 en interna).';
// La aclaración de las reiteraciones del RPAD, la de la maqueta 4 (Ruling 21)
const ACLARACION_DE_LOS_EMAILS = 'Hasta el 12/10, el email de los 5 días y el resumen mensual de vencidos se sumaban a cada ciclo.';

// Los textos que muestra la vista nunca son null; ningún string dice null, undefined, NaN o Infinity, y ningún número es NaN
const CLAVES_DE_TEXTO = new Set(['nombre', 'desde_hasta', 'responsable', 'texto', 'unidad', 'debajo', 'ciclos_texto', 'que', 'motivo']);
const recorrer = (valor, ruta, visitar) => {
  if (Array.isArray(valor)) valor.forEach((v, i) => recorrer(v, `${ruta}[${i}]`, visitar));
  else if (valor && typeof valor === 'object') {
    for (const [clave, v] of Object.entries(valor)) {
      visitar(`${ruta}.${clave}`, clave, v);
      recorrer(v, `${ruta}.${clave}`, visitar);
    }
  }
};
const sinNadaNulo = (v) => {
  recorrer(v, 'vista', (ruta, clave, valor) => {
    if (CLAVES_DE_TEXTO.has(clave) || ruta.endsWith('vacio.titulo')) assert.equal(typeof valor, 'string', ruta);
    if (typeof valor === 'string') assert.doesNotMatch(valor, /null|undefined|NaN|Infinity/, ruta);
    if (typeof valor === 'number') assert.ok(Number.isFinite(valor), ruta);
  });
};

describe('vistaDe', () => {
  it('el circuito de cada gestión: sus tramos en orden, con nombre, desde y hasta, responsable y si es de la DGMIT', () => {
    const v = vista(casosReales());
    assert.deepEqual(Object.keys(v), ['circuito', 'resultados', 'casos', 'para_completar']);
    const sinCifras = (t) => [t.clave, t.nombre, t.desde_hasta, t.responsable, t.dgmit];
    assert.deepEqual(v.circuito.externa.map(sinCifras), [
      ['aviso', 'Aviso anticipado', 'Del aviso al vencimiento', 'DDPC', false],
      ['tramite', 'Redacción y entrega de nota', 'Del aviso a la nota en el área', 'DGMIT y DA', true],
      ['respuesta', 'Respuesta del área', 'De la nota a la entrega', 'Área', false],
      ['carga', 'Preparación y carga', 'De la entrega a la carga', 'DDPC', false]
    ]);
    assert.deepEqual(v.circuito.interna.map(sinCifras), [
      ['aviso', 'Aviso anticipado', 'Del aviso al vencimiento', 'DDPC', false],
      ['produccion', 'Producción del relevamiento', 'Del aviso a la entrega', 'DGMIT y DIT', true],
      ['carga', 'Preparación y carga', 'De la entrega a la carga', 'DDPC', false]
    ]);
    for (const t of [...v.circuito.externa, ...v.circuito.interna]) {
      assert.deepEqual(Object.keys(t), ['clave', 'nombre', 'desde_hasta', 'responsable', 'dgmit', 'cifra', 'vacio', 'en_curso', 'pendientes', 'pendientes_texto']);
    }
    // El aviso anticipado: del aviso de la regla al vencimiento, en los ciclos que vencen en el año, también los que vencen después de
    // al (se conoce entero cuando sale el aviso): el 1, el 9, el 10 (cuatro), el 42, el 52 (dos), el 61 y el 81 en externa; el 38 (dos)
    // en interna
    assert.equal(cifraDel(v, 'externa', 'aviso').ciclos, 11);
    assert.equal(cifraDel(v, 'interna', 'aviso').ciclos, 2);
    const anticipaciones = casosReales()
      .filter((c) => c.gestion === 'externa' && c.aviso_regla && c.venc >= '2026-01-01' && c.venc <= '2026-12-31')
      .map((c) => duracion(c.aviso_regla, c.venc, 'habiles'));
    assert.equal(cifraDel(v, 'externa', 'aviso').valor, cifraDe(anticipaciones).mediana);
    // Avisados ya vencidos: no cuentan en la anticipación (el 9 del 31/01/2025 y el 11 en externa, el 26 en interna)
    assert.deepEqual(v.circuito.aclaraciones, {
      externa: {
        ya_vencidos: {
          n: 2,
          texto: '2 ciclos se avisaron cuando ya estaban vencidos (vencieron antes de que existiera el aviso): no cuentan en la anticipación, y el resto de sus tramos se cuenta desde ese primer aviso.'
        },
        fuente_publica: { n: 0, texto: '' },
        no_requieren_nota: { n: 0, texto: '' }
      },
      interna: {
        ya_vencidos: {
          n: 1,
          texto: '1 ciclo se avisó cuando ya estaba vencido (venció antes de que existiera el aviso): no cuenta en la anticipación, y el resto de sus tramos se cuenta desde ese primer aviso.'
        }
      }
    });
  });

  it('sin notas DGMIT, la DGMIT y el área van vacías y la DGMIT cuenta los pendientes sin días', () => {
    const v = vista(casosReales());
    // Los ciclos abiertos de externos con algún aviso y sin nota DGMIT: el 1, el 11, el 33, el 52, el 58, el 61 y el 81 (los abiertos
    // del 9, el 10, el 25 y el 42 todavía no tuvieron avisos)
    assert.deepEqual(tramoDe(v, 'externa', 'tramite'), {
      clave: 'tramite', nombre: 'Redacción y entrega de nota', desde_hasta: 'Del aviso a la nota en el área', responsable: 'DGMIT y DA', dgmit: true,
      cifra: null, vacio: { titulo: 'Todavía no hay notas DGMIT cargadas', texto: '7 notas pendientes de carga' }, en_curso: null, pendientes: 7,
      pendientes_texto: '7 notas pendientes de carga'
    });
    assert.deepEqual(tramoDe(v, 'externa', 'respuesta'), {
      clave: 'respuesta', nombre: 'Respuesta del área', desde_hasta: 'De la nota a la entrega', responsable: 'Área', dgmit: false,
      cifra: null, vacio: { titulo: 'Sin datos todavía', texto: 'Se empieza a contar cuando haya notas DGMIT cargadas' }, en_curso: null,
      pendientes: null, pendientes_texto: null
    });
    // Solo el tramo de la DGMIT tiene pendientes; los demás no dependen de las notas DGMIT
    for (const t of [...v.circuito.externa, ...v.circuito.interna]) {
      if (t.clave !== 'tramite') assert.deepEqual([t.pendientes, t.pendientes_texto], [null, null], t.clave);
    }
    assert.notEqual(cifraDel(v, 'externa', 'aviso'), null);
    // Uno solo: en singular
    const uno = vista(casosDe(mapaDe(fuentesDelCaso(81)), { hoy: AL }));
    assert.deepEqual(tramoDe(uno, 'externa', 'tramite').vacio, { titulo: 'Todavía no hay notas DGMIT cargadas', texto: '1 nota pendiente de carga' });
    assert.equal(tramoDe(uno, 'externa', 'tramite').pendientes_texto, '1 nota pendiente de carga');
    // No son pendientes: un externo con «Requiere nota» No, un abierto sin avisos, uno cerrado, uno interno y uno con el aviso después de al
    const otros = [
      caso({ requiere_nota: 0 }), caso({ aviso_regla: null, primer_aviso: null, inicio_tramos: null, avisos_rpad: [] }), cerrado(),
      caso({ gestion: 'interna', requiere_nota: null }), caso({ avisos_rpad: ['2026-10-26'], aviso_regla: '2026-10-26', primer_aviso: '2026-10-26' })
    ];
    assert.equal(tramoDe(vista(otros), 'externa', 'tramite').pendientes, 0);
    assert.equal(tramoDe(vista(otros), 'externa', 'tramite').vacio.texto, '0 notas pendientes de carga');
    // Sin ninguno, la página no tiene un texto de pendientes que escribir (el vacío ya lo dice)
    assert.equal(tramoDe(vista(otros), 'externa', 'tramite').pendientes_texto, null);
    // «Requiere nota» sin dato se comporta como Sí
    assert.equal(tramoDe(vista([caso({ requiere_nota: null })]), 'externa', 'tramite').pendientes, 1);
  });

  it('con una nota DGMIT, la redacción cuenta desde el aviso y la respuesta desde la nota', () => {
    const fuentes = con(fuentesDelCaso(52, { importados: { 7: { recibido_el: '2026-02-02', origen_datos: 'area' } } }), {
      notasDgmit: [notaDgmit({ recibida: '2026-01-05' })]
    });
    const v = vista(casosDe(mapaDe(fuentes), { hoy: AL }));
    // Del aviso de 40 días (22/12/2025) a la nota (05/01/2026), 8 días hábiles; de la nota a la entrega (02/02/2026), 20
    const uno = { unidad: 'días hábiles', debajo: 'mediana de 1 ciclo', ciclos: 1, ciclos_texto: '1 ciclo', en_el_dia: false, orientativo: true };
    assert.deepEqual(cifraDel(v, 'externa', 'tramite'), { valor: 8, texto: '8', ...uno });
    assert.deepEqual(cifraDel(v, 'externa', 'respuesta'), { valor: 20, texto: '20', ...uno });
    assert.equal(tramoDe(v, 'externa', 'tramite').vacio, null);
    assert.equal(tramoDe(v, 'externa', 'respuesta').vacio, null);
    // El ciclo abierto (vence el 31/07/2026) tuvo avisos y no tiene nota: sigue pendiente de carga; con notas cargadas, el texto de los
    // pendientes lo arma el servidor (la página no lo escribe)
    assert.equal(tramoDe(v, 'externa', 'tramite').pendientes, 1);
    assert.equal(tramoDe(v, 'externa', 'tramite').pendientes_texto, '1 nota pendiente de carga');
    assert.equal(tramoDe(v, 'externa', 'respuesta').en_curso, null);
    // Con una nota en el ciclo abierto: la redacción suma ese ciclo (del aviso del 21/06/2026 a la nota del 10/07/2026), no quedan
    // pendientes y la respuesta está en curso hasta al
    const abierta = con(fuentes, { notasDgmit: [notaDgmit({ id: 2, numero: '90/26', tipo: 'reiteracion', recibida: '2026-07-10' })] });
    const w = vista(casosDe(mapaDe(abierta), { hoy: AL }));
    assert.equal(cifraDel(w, 'externa', 'tramite').ciclos, 2);
    assert.equal(cifraDel(w, 'externa', 'tramite').valor, cifraDe([8, duracion('2026-06-21', '2026-07-10', 'habiles')]).mediana);
    assert.equal(tramoDe(w, 'externa', 'tramite').pendientes, 0);
    assert.equal(tramoDe(w, 'externa', 'tramite').pendientes_texto, null);
    const hace = duracion('2026-07-10', AL, 'habiles');
    assert.deepEqual(tramoDe(w, 'externa', 'respuesta').en_curso, { n: 1, valor: hace, texto: `1 sin datos registrados todavía, hace ${hace} días hábiles (mediana)` });
    // La respuesta se cuenta desde la primera nota del ciclo, aunque después llegue una reiteración
    const reiterada = con(fuentes, { notasDgmit: [notaDgmit({ id: 3, numero: '50/26', tipo: 'reiteracion', recibida: '2026-01-20' })] });
    assert.equal(cifraDel(vista(casosDe(mapaDe(reiterada), { hoy: AL })), 'externa', 'respuesta').valor, 20);
    // Una nota recibida después de al todavía no llegó (la foto al 31/12 con los casos de enero)
    const despues = vista([cerrado({ nota_dgmit: notaDe('2026-11-02') })], { al: '2026-10-31' });
    assert.equal(cifraDel(despues, 'externa', 'tramite'), null);
    assert.equal(tramoDe(despues, 'externa', 'tramite').vacio.titulo, 'Todavía no hay notas DGMIT cargadas');
  });

  it('la nota antes del aviso da 0 y se escribe «En el día»', () => {
    // El abierto del 52: la nota DGMIT del 15/06/2026 llegó antes del aviso de 40 días (21/06/2026), porque la DGMIT ya había actuado.
    // En el ciclo del 31/01/2026, los datos llegaron el mismo día de la carga (04/02/2026)
    const fuentes = con(fuentesDelCaso(52), { notasDgmit: [notaDgmit({ recibida: '2026-06-15' })] });
    const casos = casosDe(mapaDe(fuentes), { hoy: AL });
    for (const dias of DIAS) {
      for (const estadistico of ESTADISTICOS) {
        const v = vista(casos, { dias, estadistico });
        const cero = {
          valor: 0, texto: 'En el día', unidad: '', debajo: `${estadistico} en ${dias === 'habiles' ? 'días hábiles' : 'días corridos'}`,
          ciclos: 1, ciclos_texto: '1 ciclo', en_el_dia: true, orientativo: true
        };
        assert.deepEqual(cifraDel(v, 'externa', 'tramite'), cero, `${estadistico}, ${dias}`);
        assert.deepEqual(cifraDel(v, 'externa', 'carga'), cero, `${estadistico}, ${dias}`);
      }
    }
    // Los datos antes de la nota: la respuesta también da 0; en la lista de casos, «en el día» debajo de la fecha
    const antes = vista([cerrado({ nota_dgmit: notaDe('2026-04-07'), recibido: '2026-04-06', carga: '2026-04-06', cierre: '2026-04-06' })]);
    assert.equal(cifraDel(antes, 'externa', 'respuesta').texto, 'En el día');
    const [fila] = antes.casos;
    assert.deepEqual([fila.recibido.texto, fila.carga.texto], ['en el día', 'en el día']);
    // Con el promedio, un valor que redondea a 0 también es «En el día» (0, 0 y 1: 0,33)
    const tres = [0, 1, 2].map((i) => cerrado({ dataset_id: 901 + i, recibido: '2026-04-08', carga: i === 2 ? '2026-04-09' : '2026-04-08' }));
    assert.equal(cifraDel(vista(tres, { estadistico: 'promedio' }), 'externa', 'carga').texto, 'En el día');
  });

  it('fuente pública: no cuenta en la respuesta y suma en la aclaración', () => {
    const area = cerrado({ dataset_id: 901, nota_dgmit: notaDe('2026-03-02') });
    const publica = cerrado({ dataset_id: 902, nota_dgmit: notaDe('2026-03-02'), origen: 'fuente_publica', recibido: '2026-04-01' });
    const v = vista([area, publica]);
    assert.equal(cifraDel(v, 'externa', 'respuesta').ciclos, 1);
    assert.equal(cifraDel(v, 'externa', 'respuesta').valor, duracion('2026-03-02', '2026-04-06', 'habiles'));
    // La redacción y entrega de nota se cuenta igual, y la preparación y carga, desde el día en que se obtuvo la fuente
    assert.equal(cifraDel(v, 'externa', 'tramite').ciclos, 2);
    assert.equal(cifraDel(v, 'externa', 'carga').ciclos, 2);
    assert.equal(cifraDel(v, 'externa', 'carga').valor, cifraDe([2, duracion('2026-04-01', '2026-04-08', 'habiles')]).mediana);
    assert.deepEqual(v.circuito.aclaraciones.externa.fuente_publica,
      { n: 1, texto: '1 ciclo se resolvió con datos de una fuente pública: no cuenta en la respuesta del área.' });
    const dos = vista([area, publica, { ...publica, dataset_id: 903 }]);
    assert.deepEqual(dos.circuito.aclaraciones.externa.fuente_publica,
      { n: 2, texto: '2 ciclos se resolvieron con datos de una fuente pública: no cuentan en la respuesta del área.' });
    assert.deepEqual(vista([area]).circuito.aclaraciones.externa.fuente_publica, { n: 0, texto: '' });
    // En un dataset con «Requiere nota» No es lo normal (y no tiene respuesta del área): no va en la aclaración
    assert.equal(vista([area, { ...publica, requiere_nota: 0, nota_dgmit: null }]).circuito.aclaraciones.externa.fuente_publica.n, 0);
    // Un ciclo resuelto con una fuente pública puede no haber tenido nota: no es una nota pendiente de carga
    assert.deepEqual(vista([{ ...publica, nota_dgmit: null }]).para_completar.notas, []);
    assert.equal(vista([{ ...area, nota_dgmit: null }]).para_completar.notas.length, 1);
  });

  it('requiere nota No: solo aviso y carga', () => {
    const v = vista([cerrado({ requiere_nota: 0 }), caso({ dataset_id: 901, requiere_nota: 0 })]);
    assert.equal(cifraDel(v, 'externa', 'aviso').ciclos, 2);
    assert.equal(cifraDel(v, 'externa', 'carga').ciclos, 1);
    assert.equal(cifraDel(v, 'externa', 'tramite'), null);
    assert.equal(cifraDel(v, 'externa', 'respuesta'), null);
    assert.equal(tramoDe(v, 'externa', 'tramite').pendientes, 0);
    assert.equal(tramoDe(v, 'externa', 'respuesta').en_curso, null);
    assert.deepEqual(v.para_completar.notas, []);
    assert.deepEqual(v.casos.map((f) => f.nota.texto), ['', '']);
    // La aclaración la arma el servidor, con su singular; los de «Requiere nota» Sí o sin dato, y los internos, no van
    assert.deepEqual(v.circuito.aclaraciones.externa.no_requieren_nota,
      { n: 2, texto: '2 ciclos son de datasets que no requieren nota DGMIT: cuentan solo en el aviso anticipado y en la carga.' });
    assert.deepEqual(vista([caso({ requiere_nota: 0 }), caso({ dataset_id: 901, requiere_nota: null }), caso({ dataset_id: 902, gestion: 'interna', requiere_nota: null })])
      .circuito.aclaraciones.externa.no_requieren_nota,
    { n: 1, texto: '1 ciclo es de un dataset que no requiere nota DGMIT: cuenta solo en el aviso anticipado y en la carga.' });
    // Destildado, no cuenta
    assert.equal(vista([caso({ requiere_nota: 0 })], { sin: [900] }).circuito.aclaraciones.externa.no_requieren_nota.n, 0);
    // Con una nota DGMIT, los tramos de la DGMIT y del área le corresponden
    const conNota = vista([
      cerrado({ requiere_nota: 0, nota_dgmit: notaDe('2026-03-02') }), caso({ dataset_id: 901, requiere_nota: 0, nota_dgmit: notaDe('2026-03-05') })
    ]);
    assert.equal(cifraDel(conNota, 'externa', 'tramite').ciclos, 2);
    assert.equal(cifraDel(conNota, 'externa', 'respuesta').ciclos, 1);
    assert.equal(tramoDe(conNota, 'externa', 'respuesta').en_curso.n, 1);
    // …y no van en la aclaración de los que no requieren nota
    assert.deepEqual(conNota.circuito.aclaraciones.externa.no_requieren_nota, { n: 0, texto: '' });
    // Sin aviso de la regla y sin avisarse ya vencido, la redacción (que empieza en el aviso) no cuenta; la respuesta (desde la nota), sí
    const sinAviso = vista([cerrado({ aviso_regla: null, inicio_tramos: null, nota_dgmit: notaDe('2026-03-02') })]);
    assert.equal(cifraDel(sinAviso, 'externa', 'tramite'), null);
    assert.equal(cifraDel(sinAviso, 'externa', 'respuesta').ciclos, 1);
  });

  it('la carga nunca está en curso; la producción en curso cuenta hasta al', () => {
    const v = vista(casosReales());
    // El 26 (interno, avisado ya vencido el 01/01/2026) sigue sin datos: la producción está en curso desde ese primer aviso hasta al
    const hace = (al) => duracion('2026-01-01', al, 'habiles');
    assert.deepEqual(tramoDe(v, 'interna', 'produccion').en_curso,
      { n: 1, valor: hace(AL), texto: `1 sin datos registrados todavía, hace ${hace(AL)} días hábiles (mediana)` });
    assert.equal(tramoDe(vista(casosReales(), { al: '2026-06-30' }), 'interna', 'produccion').en_curso.valor, hace('2026-06-30'));
    // La producción terminada va del aviso a la entrega, y la carga, de la entrega a la carga (el 38 del 31/03/2026: aviso de 60 días
    // el 30/01, datos el 10/02 y carga el 12/02)
    const conEntrega = vista(casosReales({ importados: { 12: { recibido_el: '2026-02-10' } } }));
    assert.equal(cifraDel(conEntrega, 'interna', 'produccion').valor, duracion('2026-01-30', '2026-02-10', 'habiles'));
    assert.equal(cifraDel(conEntrega, 'interna', 'carga').valor, duracion('2026-02-10', '2026-02-12', 'habiles'));
    // La carga y el aviso nunca están en curso
    for (const cada of [v, conEntrega, vista([caso({ recibido: '2026-04-06' })])]) {
      for (const gestion of ['externa', 'interna']) {
        assert.equal(tramoDe(cada, gestion, 'carga').en_curso, null);
        assert.equal(tramoDe(cada, gestion, 'aviso').en_curso, null);
      }
    }
    // Un abierto sin aviso de la regla que no se avisó ya vencido no cuenta en la producción; uno cerrado, tampoco en curso
    const interno = { gestion: 'interna', requiere_nota: null };
    assert.equal(tramoDe(vista([caso({ ...interno, aviso_regla: null, inicio_tramos: null })]), 'interna', 'produccion').en_curso, null);
    assert.equal(tramoDe(vista([cerrado({ ...interno, recibido: null })]), 'interna', 'produccion').en_curso, null);
    // Avisado hoy: lleva menos de un día
    const hoy = caso({ ...interno, venc: '2026-12-31', aviso_regla: AL, primer_aviso: AL, inicio_tramos: AL, avisos_rpad: [AL] });
    assert.equal(tramoDe(vista([hoy]), 'interna', 'produccion').en_curso.texto, '1 sin datos registrados todavía, hace menos de 1 día hábil (mediana)');
    // La preparación y carga no necesita el vencimiento
    assert.equal(cifraDel(vista([cerrado({ venc: null })]), 'externa', 'carga').ciclos, 1);
  });

  it('destildar saca al dataset de todos los números', () => {
    const mapa = mapaDeLosCasos();
    mapa.set(52, con(mapa.get(52), { notasDgmit: [notaDgmit({ recibida: '2026-01-05' })] }));
    mapa.set(10, con(mapa.get(10), { notasDgmit: [notaDgmit({ id: 2, numero: '46/26', recibida: '2026-01-12' })] }));
    const casos = casosDe(mapa, { hoy: AL });
    const todos = vista(casos);
    const sin52 = vista(casos, { sin: [52] });
    const sinElDataset = vista(casos.filter((c) => c.dataset_id !== 52));
    assert.deepEqual(sin52.circuito, sinElDataset.circuito);
    assert.deepEqual(sin52.resultados, sinElDataset.resultados);
    // Cambia de verdad: con todos, la respuesta del área tiene el ciclo del 52 y hay más avisos
    assert.equal(cifraDel(todos, 'externa', 'respuesta').ciclos, 1);
    assert.equal(cifraDel(sin52, 'externa', 'respuesta'), null);
    assert.equal(tramoDe(sin52, 'externa', 'respuesta').vacio.titulo, 'Sin casos en 2026');
    assert.equal(cifraDel(todos, 'externa', 'aviso').ciclos - cifraDel(sin52, 'externa', 'aviso').ciclos, 2);
    assert.notDeepEqual(sin52.resultados, todos.resultados);
    // En la lista sigue, sin contar (la página lo tacha); lo demás, igual
    assert.ok(filasDe(sin52, 52).length === 2 && filasDe(sin52, 52).every((f) => f.contar === false));
    assert.ok(todos.casos.every((f) => f.contar === true));
    assert.deepEqual(sin52.casos.filter((f) => f.dataset_id !== 52), sinElDataset.casos);
    assert.deepEqual(sin52.casos.map((f) => ({ ...f, contar: true })), todos.casos);
    // «Para completar» no es una cuenta: lo que falta cargar sigue en la lista
    assert.deepEqual(sin52.para_completar, todos.para_completar);
    // Varios, y con lo que no es un dataset de la lista: los mismos números
    const varios = vista(casos, { sin: [52, 10, 9999] });
    const sinLosDos = vista(casos.filter((c) => c.dataset_id !== 52 && c.dataset_id !== 10));
    const numeros = (v) => [...v.circuito.externa, ...v.circuito.interna].map((t) => [t.cifra, t.en_curso, t.pendientes]);
    assert.deepEqual(numeros(varios), numeros(sinLosDos));
    assert.deepEqual(varios.resultados.reiteraciones.rpad, sinLosDos.resultados.reiteraciones.rpad);
    // Las notas DGMIT siguen existiendo en el RPAD aunque estén en datasets destildados: el tramo dice «Sin casos en 2026», no
    // «Todavía no hay notas DGMIT cargadas»
    assert.equal(tramoDe(varios, 'externa', 'tramite').vacio.titulo, 'Sin casos en 2026');
    assert.equal(tramoDe(sinLosDos, 'externa', 'tramite').vacio.titulo, 'Todavía no hay notas DGMIT cargadas');
  });

  it('estadístico y días cambian cifra, unidad y debajo; 1 da singular', () => {
    // Tres avisos para el 31/03/2026: el 19/02 (27 días hábiles y 40 corridos), el 02/03 (20 y 29) y el 30/03 (1 y 1)
    const casos = [['2026-02-19', 901], ['2026-03-02', 902], ['2026-03-30', 903]]
      .map(([aviso, id]) => caso({ dataset_id: id, aviso_regla: aviso, primer_aviso: aviso, inicio_tramos: aviso, avisos_rpad: [aviso] }));
    const cifra = (estadistico, dias, lista = casos) => cifraDel(vista(lista, { estadistico, dias }), 'externa', 'aviso');
    const tres = { ciclos: 3, ciclos_texto: '3 ciclos', en_el_dia: false, orientativo: true };
    assert.deepEqual(cifra('mediana', 'habiles'), { valor: 20, texto: '20', unidad: 'días hábiles', debajo: 'mediana de 3 ciclos', ...tres });
    assert.deepEqual(cifra('promedio', 'habiles'), { valor: 16, texto: '16', unidad: 'días hábiles', debajo: 'promedio de 3 ciclos', ...tres });
    assert.deepEqual(cifra('mediana', 'corridos'), { valor: 29, texto: '29', unidad: 'días corridos', debajo: 'mediana de 3 ciclos', ...tres });
    assert.deepEqual(cifra('promedio', 'corridos'), { valor: 23, texto: '23', unidad: 'días corridos', debajo: 'promedio de 3 ciclos', ...tres });
    // Uno solo, de 1 día: en singular
    const uno = { valor: 1, texto: '1', debajo: 'mediana de 1 ciclo', ciclos: 1, ciclos_texto: '1 ciclo', en_el_dia: false, orientativo: true };
    assert.deepEqual(cifra('mediana', 'habiles', [casos[2]]), { ...uno, unidad: 'día hábil' });
    assert.deepEqual(cifra('mediana', 'corridos', [casos[2]]), { ...uno, unidad: 'día corrido' });
    // Sin selectores, o con valores que no existen: mediana en días hábiles (los de entrada)
    assert.deepEqual(cifraDel(vistaDe(casos, { anio: 2026, al: AL }), 'externa', 'aviso'), cifra('mediana', 'habiles'));
    assert.deepEqual(cifraDel(vista(casos, { estadistico: 'moda', dias: 'semanas' }), 'externa', 'aviso'), cifra('mediana', 'habiles'));
    // Lo que está en curso, lo de «Actualizados a tiempo» y los días de la lista de casos también siguen a los selectores
    const interno = caso({ dataset_id: 904, gestion: 'interna', requiere_nota: null });
    const corridos = duracion('2026-02-19', AL, 'corridos');
    assert.equal(tramoDe(vista([interno], { estadistico: 'promedio', dias: 'corridos' }), 'interna', 'produccion').en_curso.texto,
      `1 sin datos registrados todavía, hace ${corridos} días corridos (promedio)`);
    // En curso desde hace 1 día, en singular (el 24/10/2026 es sábado: del jueves 22 hay 1 día hábil; del viernes 23, 1 corrido y 0 hábiles)
    const desde = (dia) => caso({ dataset_id: 907, gestion: 'interna', requiere_nota: null, aviso_regla: dia, primer_aviso: dia, inicio_tramos: dia, avisos_rpad: [dia] });
    const enCurso = (dia, opciones) => tramoDe(vista([desde(dia)], opciones), 'interna', 'produccion').en_curso.texto;
    assert.equal(enCurso('2026-10-22'), '1 sin datos registrados todavía, hace 1 día hábil (mediana)');
    assert.equal(enCurso('2026-10-23', { estadistico: 'promedio', dias: 'corridos' }), '1 sin datos registrados todavía, hace 1 día corrido (promedio)');
    assert.equal(enCurso('2026-10-23'), '1 sin datos registrados todavía, hace menos de 1 día hábil (mediana)');
    const tarde = [cerrado({ dataset_id: 905 }), cerrado({ dataset_id: 906, carga: '2026-04-30', cierre: '2026-04-30' })];
    assert.equal(vista(tarde, { estadistico: 'promedio', dias: 'corridos' }).resultados.a_tiempo.despues.texto,
      `Los 2 se cargaron un promedio de ${cifraDe([8, 30]).promedio} días corridos después.`);
    assert.equal(vista([casos[0]], { dias: 'corridos' }).casos[0].aviso.texto, '40 antes');
    assert.equal(vista([casos[0]]).casos[0].aviso.texto, '27 antes');
  });

  it('con 4 casos, orientativo; con 0, «Sin casos en 2026» y nada null en los textos', () => {
    const casos = (n) => Array.from({ length: n }, (_, i) => cerrado({ dataset_id: 901 + i }));
    assert.equal(cifraDel(vista(casos(4)), 'externa', 'aviso').orientativo, true);
    assert.equal(cifraDel(vista(casos(4)), 'externa', 'carga').orientativo, true);
    assert.equal(cifraDel(vista(casos(5)), 'externa', 'aviso').orientativo, false);
    // Sin ningún caso: ninguna cifra, ningún en curso, y los textos de lo vacío
    const vacia = vista([]);
    const sinCasos = { cifra: null, vacio: { titulo: 'Sin casos en 2026', texto: '' }, en_curso: null, pendientes: null };
    const resto = (t) => ({ cifra: t.cifra, vacio: t.vacio, en_curso: t.en_curso, pendientes: t.pendientes });
    assert.deepEqual(vacia.circuito.externa.map(resto), [
      sinCasos,
      { cifra: null, vacio: { titulo: 'Todavía no hay notas DGMIT cargadas', texto: '0 notas pendientes de carga' }, en_curso: null, pendientes: 0 },
      { cifra: null, vacio: { titulo: 'Sin datos todavía', texto: 'Se empieza a contar cuando haya notas DGMIT cargadas' }, en_curso: null, pendientes: null },
      sinCasos
    ]);
    assert.deepEqual(vacia.circuito.interna.map(resto), [sinCasos, sinCasos, sinCasos]);
    assert.deepEqual(vacia.circuito.aclaraciones, {
      externa: { ya_vencidos: { n: 0, texto: '' }, fuente_publica: { n: 0, texto: '' }, no_requieren_nota: { n: 0, texto: '' } },
      interna: { ya_vencidos: { n: 0, texto: '' } }
    });
    assert.deepEqual(vacia.resultados, {
      a_tiempo: { a_tiempo: 0, total: 0, externa: [0, 0], interna: [0, 0], despues: { valor: null, texto: '' } },
      cobertura: { si: 0, total: 0, faltan: [] },
      reiteraciones: { rpad: { ninguna: 0, una: 0, dos_o_mas: 0, total: 0 }, dgmit: null },
      textos: {
        a_tiempo: { de: 'de 0 ciclos', medidor: null, vacio: 'Sin actualizaciones registradas en 2026.' },
        cobertura: { de: 'de 0 vencimientos', medidor: null, regla: REGLA_DEL_AVISO, faltan: '', vacio: 'Sin vencimientos de 2026 con la fecha del aviso ya cumplida.' },
        reiteraciones: {
          rpad: 'Del RPAD a la DGMIT (0 ciclos)', rpad_vacio: 'Sin ciclos en 2026.', dgmit: 'De la DGMIT al área', dgmit_vacio: 'Todavía no hay notas DGMIT cargadas.',
          aclaracion: null
        }
      }
    });
    assert.deepEqual([vacia.casos, vacia.para_completar], [[], {
      notas: [], recibido: [], total: 0,
      textos: {
        notas: 'Notas DGMIT pendientes de carga (0)', notas_vacio: 'No hay notas DGMIT pendientes de carga.',
        recibido: 'Actualizaciones sin «Recibido el» o sin el origen de los datos (0)',
        recibido_vacio: 'No hay actualizaciones sin «Recibido el» ni sin el origen de los datos.'
      }
    }]);
    // Con notas DGMIT y todo destildado, también los tramos de la DGMIT y del área dicen «Sin casos en 2026»
    const conNotas = [cerrado({ nota_dgmit: notaDe('2026-03-02') }), caso({ dataset_id: 901, nota_dgmit: notaDe('2026-03-05') })];
    const destildada = vista(conNotas, { sin: [900, 901] });
    for (const t of [...destildada.circuito.externa, ...destildada.circuito.interna]) {
      assert.deepEqual([t.cifra, t.vacio, t.en_curso], [null, { titulo: 'Sin casos en 2026', texto: '' }, null], t.clave);
    }
    assert.deepEqual(destildada.resultados.reiteraciones.dgmit, { ninguna: 0, una_o_mas: 0, total: 0 });
    // El año va en el texto
    assert.equal(tramoDe(vistaDe([], { anio: 2027, al: '2027-03-01' }), 'externa', 'aviso').vacio.titulo, 'Sin casos en 2027');
    // Ningún texto es null ni dice null, undefined o NaN, en ninguna combinación
    const heredado = caso({ dataset_id: 950, heredado: true, aviso_regla: null, primer_aviso: '2026-04-02', inicio_tramos: '2026-04-02' });
    for (const [lista, opciones] of [[[], {}], [conNotas, { sin: [900, 901] }], [casosReales(), {}], [casosReales(), { anio: 2025, al: '2025-12-31' }],
      [conNotas, {}], [[...casos(3), heredado], {}]]) {
      for (const estadistico of ESTADISTICOS) for (const dias of DIAS) sinNadaNulo(vista(lista, { estadistico, dias, ...opciones }));
    }
  });

  it('un tramo que termina después de al está en curso al 31/12', () => {
    // Avisado el 21/10/2026 para el 30/11/2026, la nota DGMIT llegó el 01/12/2026, los datos el 04/01/2027 y se cargaron el 05/01/2027:
    // la foto de 2026 (al 31/12, con los casos del 10/01/2027) lo ve en curso
    const venc = {
      venc: '2026-11-30', aviso_regla: '2026-10-21', primer_aviso: '2026-10-21', inicio_tramos: '2026-10-21', fecha_regla: '2026-10-21',
      avisos_rpad: ['2026-10-21']
    };
    const despues = { cierre: '2027-01-05', aprobado: '2027-01-05 10:00:00', recibido: '2027-01-04', carga: '2027-01-05' };
    const externo = cerrado({ ...venc, ...despues, nota_dgmit: notaDe('2026-12-01') });
    const foto = vista([externo], { al: '2026-12-31' });
    const hace = duracion('2026-12-01', '2026-12-31', 'habiles');
    assert.deepEqual(tramoDe(foto, 'externa', 'respuesta').en_curso, { n: 1, valor: hace, texto: `1 sin datos registrados todavía, hace ${hace} días hábiles (mediana)` });
    assert.equal(cifraDel(foto, 'externa', 'respuesta'), null);
    assert.equal(cifraDel(foto, 'externa', 'tramite').ciclos, 1);
    assert.equal(cifraDel(foto, 'externa', 'aviso').ciclos, 1);
    assert.deepEqual([cifraDel(foto, 'externa', 'carga'), tramoDe(foto, 'externa', 'carga').en_curso], [null, null]);
    assert.equal(foto.resultados.a_tiempo.total, 0);
    assert.deepEqual(foto.para_completar.recibido, []);
    const [fila] = foto.casos;
    assert.deepEqual([fila.recibido, fila.carga], [{ fecha: null, texto: `en curso, hace ${hace}`, origen: '' }, { fecha: null, texto: '' }]);
    // En las reiteraciones cuenta abierto al 31/12, como en el circuito (en curso)
    assert.deepEqual(foto.resultados.reiteraciones.rpad, { ninguna: 1, una: 0, dos_o_mas: 0, total: 1 });
    // En 2027 terminó: la respuesta y la carga cuentan ahí
    const enero = vistaDe([externo], { ...OPCIONES, anio: 2027, al: '2027-01-10' });
    assert.equal(cifraDel(enero, 'externa', 'respuesta').valor, duracion('2026-12-01', '2027-01-04', 'habiles'));
    assert.equal(cifraDel(enero, 'externa', 'carga').ciclos, 1);
    assert.deepEqual([enero.resultados.a_tiempo.a_tiempo, enero.resultados.a_tiempo.total], [0, 1]);
    assert.equal(enero.resultados.reiteraciones.rpad.total, 1);
    // Interna: la producción
    const interno = cerrado({ ...venc, ...despues, gestion: 'interna', requiere_nota: null, origen: null });
    const produccion = duracion('2026-10-21', '2026-12-31', 'habiles');
    assert.deepEqual(tramoDe(vista([interno], { al: '2026-12-31' }), 'interna', 'produccion').en_curso,
      { n: 1, valor: produccion, texto: `1 sin datos registrados todavía, hace ${produccion} días hábiles (mediana)` });
    // Reprogramado después de al: al 31/12 estaba abierto y sin nota, así que era una nota pendiente de carga
    const reprogramado = caso({ ...venc, como: 'reprogramacion', abierto: false, cierre: '2027-01-08', aprobado: '2027-01-08 09:00:00' });
    assert.equal(tramoDe(vista([reprogramado], { al: '2026-12-31' }), 'externa', 'tramite').pendientes, 1);
    assert.equal(vista([reprogramado], { al: '2026-12-31' }).para_completar.notas[0].abierto, true);
    // Un ciclo que empezó después de al todavía no estaba abierto (avisado el 28/12/2026 por una nota con su vencimiento)
    const posterior = caso({
      inicio: '2027-01-05', venc: '2027-02-28', aviso_regla: '2026-12-28', primer_aviso: '2026-12-28', inicio_tramos: '2026-12-28',
      fecha_regla: '2027-01-19', avisos_rpad: ['2026-12-28']
    });
    assert.equal(tramoDe(vista([posterior], { al: '2026-12-31' }), 'externa', 'tramite').pendientes, 0);
    // Pedir un al posterior al año es pedir el 31/12: lo de 2027 no entra
    assert.deepEqual(vistaDe([externo], { anio: 2026, al: '2027-01-10' }), foto);
  });

  it('actualizados a tiempo: los cerrados por actualización con la carga en el año y vencimiento; los otros, cuánto después', () => {
    // Los reales: en externa, el 10 del 31/05 y el del 31/10, de 7 (los otros: el 9 dos veces, el 10 dos veces y el 52); en interna, el
    // 38 del 31/03, de 2
    const reales = casosReales();
    const { a_tiempo: aTiempo } = vista(reales).resultados;
    const tarde = reales.filter((c) => c.como === 'actualizacion' && c.venc && c.carga >= '2026-01-01' && c.carga > c.venc);
    const mediana = cifraDe(tarde.map((c) => duracion(c.venc, c.carga, 'habiles'))).mediana;
    assert.deepEqual(aTiempo, {
      a_tiempo: 3, total: 9, externa: [2, 7], interna: [1, 2],
      despues: { valor: mediana, texto: `Los otros 6 se cargaron una mediana de ${mediana} días hábiles después.` }
    });
    // El día del vencimiento todavía es a tiempo; una reprogramación, una baja, un ciclo sin vencimiento o una carga de otro año no
    // cuentan
    const lista = [
      cerrado({ dataset_id: 901, carga: '2026-03-31', cierre: '2026-03-31', recibido: '2026-03-30' }),
      cerrado({ dataset_id: 902 }),
      caso({ dataset_id: 903, como: 'reprogramacion', abierto: false, cierre: '2026-04-06' }),
      caso({ dataset_id: 904, como: 'baja', abierto: false, cierre: '2026-04-06' }),
      cerrado({ dataset_id: 905, venc: null }),
      cerrado({ dataset_id: 906, venc: '2025-11-30', carga: '2025-12-16', cierre: '2025-12-16', recibido: '2025-12-15' })
    ];
    assert.deepEqual(vista(lista).resultados.a_tiempo,
      { a_tiempo: 1, total: 2, externa: [1, 2], interna: [0, 0], despues: { valor: 5, texto: 'El otro se cargó 5 días hábiles después.' } });
    // Ninguno a tiempo
    assert.equal(vista([cerrado()]).resultados.a_tiempo.despues.texto, 'Se cargó 5 días hábiles después.');
    assert.equal(vista([cerrado(), cerrado({ dataset_id: 902 })]).resultados.a_tiempo.despues.texto,
      'Los 2 se cargaron una mediana de 5 días hábiles después.');
    // Uno que se cargó después del vencimiento sin que pasara un día hábil (sábado 31/01/2026 y domingo 01/02/2026)
    const finDeSemana = cerrado({ venc: '2026-01-31', carga: '2026-02-01', cierre: '2026-02-01', recibido: '2026-02-01' });
    assert.equal(vista([finDeSemana]).resultados.a_tiempo.despues.texto, 'Se cargó menos de 1 día hábil después.');
    assert.equal(vista([finDeSemana], { dias: 'corridos' }).resultados.a_tiempo.despues.texto, 'Se cargó 1 día corrido después.');
    // Todos a tiempo: sin texto
    assert.deepEqual(vista([lista[0]]).resultados.a_tiempo.despues, { valor: null, texto: '' });
  });

  it('cobertura del aviso: los vencimientos del año con la fecha de la regla ya pasada, desde que hay registro; los que faltan, con su motivo', () => {
    // Los reales: 15 vencimientos, 13 avisados por la regla. El 81 se dio de alta después de su fecha de la regla y la nota 3/26 lo
    // avisó antes de vencer: cuenta, y está avisado (Ruling 5: no se filtra por pudo_avisar)
    assert.deepEqual(vista(casosReales()).resultados.cobertura, {
      si: 13, total: 15,
      faltan: [
        { titulo: CASOS[33].dataset.titulo, venc: '2026-01-31', motivo: 'se avisó ya vencido' },
        { titulo: CASOS[58].dataset.titulo, venc: '2026-11-30', motivo: 'sin el aviso de la regla' }
      ]
    });
    // Afuera: una fecha de la regla anterior al registro de los avisos (06/12/2025), una que todavía no llegó, uno de otro año
    const afuera = [
      caso({ dataset_id: 901, venc: '2026-01-14', fecha_regla: '2025-12-05', aviso_regla: null }),
      caso({ dataset_id: 902, venc: '2026-12-31', fecha_regla: '2026-11-21', aviso_regla: null }),
      caso({ dataset_id: 903, venc: '2025-12-31', fecha_regla: '2025-12-06' }),
      caso({ dataset_id: 904, venc: null, fecha_regla: null })
    ];
    assert.deepEqual(vista(afuera).resultados.cobertura, { si: 0, total: 0, faltan: [] });
    // Los motivos (Ruling 7)
    const sinAviso = (motivo, datos = {}) => caso({ aviso_regla: null, inicio_tramos: null, motivo_sin_aviso: motivo, ...datos });
    const motivos = (lista) => vista(lista).resultados.cobertura.faltan.map((f) => f.motivo);
    assert.deepEqual(motivos([
      sinAviso('email-fallido', { dataset_id: 901, titulo: 'A' }),
      sinAviso('alta-cercana', { dataset_id: 902, titulo: 'B', alta: '2026-03-10' }),
      sinAviso('alta-cercana', { dataset_id: 903, titulo: 'C', alta: '2026-04-02' }),
      sinAviso('ya-vencido', { dataset_id: 904, titulo: 'D' }),
      sinAviso('sin-aviso', { dataset_id: 905, titulo: 'E' }),
      sinAviso(null, { dataset_id: 906, titulo: 'F' })
    ]), ['el email no se pudo enviar', 'se dio de alta con el vencimiento ya cerca', 'se dio de alta ya vencido', 'se avisó ya vencido',
      'sin el aviso de la regla', 'sin el aviso de la regla']);
    // Con casosDe: dado de alta el 10/03/2026 con el vencimiento del 28/02/2026 ya pasado
    const [yaVencido] = casosDel(solo({ id: 900, alta: '2026-03-10 09:00:00', proxima: '2026-02-28', ultima: '2026-03-10' },
      { emails: [email({ tipo: 'externo-vencido', enviado: '2026-04-01 08:00:00' })] }), AL);
    assert.deepEqual(vista([yaVencido]).resultados.cobertura.faltan,
      [{ titulo: CASOS[52].dataset.titulo, venc: '2026-02-28', motivo: 'se dio de alta ya vencido' }]);
    // Los que faltan, por vencimiento y después por título
    const orden = [
      sinAviso('sin-aviso', { dataset_id: 901, titulo: 'B' }), sinAviso('sin-aviso', { dataset_id: 902, titulo: 'A', venc: '2026-04-30', fecha_regla: '2026-03-21' }),
      sinAviso('sin-aviso', { dataset_id: 903, titulo: 'Á' })
    ];
    assert.deepEqual(vista(orden).resultados.cobertura.faltan.map((f) => f.titulo), ['Á', 'B', 'A']);
  });

  // Revisión final (A-1): un ciclo que dejó de regir en el RPAD antes del día del aviso (por su aprobación, no por la carga) no lo
  // esperaba: no está en el denominador ni en «Los N que faltan». La foto lo guardaría para siempre como una falla del RPAD
  it('cobertura: sin los ciclos que dejaron de regir antes del día del aviso, y «a tiempo» no la contradice', () => {
    const casosDeLos = (...fuentes) => casosDe(mapaDe(...fuentes), { hoy: AL });
    // El ejemplo de la revisión: el dado de baja el 10/03 y el actualizado el 05/04, los dos con la regla del 21/05
    const ejemplo = vista(casosDeLos(dadoDeBaja(), actualizadoEl('2026-04-05 11:00:00')));
    assert.deepEqual(ejemplo.resultados.cobertura, { si: 0, total: 0, faltan: [] });
    assert.equal(ejemplo.resultados.textos.cobertura.faltan, '');
    // El actualizado se cargó antes de vencer: a tiempo, y en la lista de casos sin motivo
    assert.deepEqual([ejemplo.resultados.a_tiempo.a_tiempo, ejemplo.resultados.a_tiempo.total], [1, 1]);
    assert.deepEqual(ejemplo.casos.map((f) => [f.dataset_id, f.aviso.texto]), [[901, '']]);
    // Uno cargado el 05/04 pero aprobado el 25/05 regía en el RPAD el día del aviso: lo esperaba y falta (y se cargó a tiempo)
    const conElTardio = vista(casosDeLos(dadoDeBaja(), actualizadoEl('2026-04-05 11:00:00'),
      actualizadoEl('2026-05-25 11:00:00', { id: 902, titulo: 'Aprobado después' })));
    assert.deepEqual(conElTardio.resultados.cobertura,
      { si: 0, total: 1, faltan: [{ titulo: 'Aprobado después', venc: '2026-06-30', motivo: 'sin el aviso de la regla' }] });
    assert.deepEqual([conElTardio.resultados.a_tiempo.a_tiempo, conElTardio.resultados.a_tiempo.total], [2, 2]);
    assert.deepEqual(conElTardio.casos.map((f) => [f.dataset_id, f.aviso.texto]), [[901, ''], [902, 'sin el aviso de la regla']]);
    // Con casos armados: aprobado el mismo día del aviso, cuenta solo si lo tuvo; con un aviso anticipado, cuenta y está cubierto
    const cerroElDia = (datos = {}) => cerrado({ venc: '2026-06-30', fecha_regla: '2026-05-21', aviso_regla: null, primer_aviso: null,
      inicio_tramos: null, avisos_rpad: [], reiteraciones_rpad: null, cierre: '2026-05-21', aprobado: '2026-05-21 07:00:00', carga: '2026-05-21', ...datos });
    assert.deepEqual(vista([cerroElDia()]).resultados.cobertura, { si: 0, total: 0, faltan: [] });
    assert.deepEqual(vista([cerroElDia({ aprobado: '2026-05-22 07:00:00', motivo_sin_aviso: 'sin-aviso' })]).resultados.cobertura.total, 1);
    const anticipado = { aviso_regla: '2026-03-01', primer_aviso: '2026-03-01', inicio_tramos: '2026-03-01', avisos_rpad: ['2026-03-01'] };
    assert.deepEqual(vista([cerroElDia({ ...anticipado, cierre: '2026-04-05', aprobado: '2026-04-05 11:00:00', carga: '2026-04-05' })]).resultados.cobertura,
      { si: 1, total: 1, faltan: [] });
  });

  // Revisión final (A-2): el aviso de la regla sale el día hábil desde su fecha (proximoDiaHabil, el día de la Agenda de pedidos:
  // fechaDeAvisoPorRegla), y ese día cuenta recién cuando el aviso existe (la corrida de las 8:15 puede no haber salido) o al día
  // siguiente. Un vencimiento cuyo aviso todavía no tenía que salir no figura entre los que faltan
  it('cobertura en fines de semana y feriados: cuenta desde el día hábil en que sale el aviso', () => {
    // El 30/04/2027: su regla cae el domingo 21/03/2027 y el aviso sale el lunes 22/03
    const abril = (datos = {}) => caso({
      venc: '2027-04-30', inicio: '2027-01-04', fecha_regla: '2027-03-21', aviso_regla: null, primer_aviso: null, inicio_tramos: null,
      avisos_rpad: [], reiteraciones_rpad: null, alta: '2027-01-04', ...datos
    });
    const avisado = { aviso_regla: '2027-03-22', primer_aviso: '2027-03-22', inicio_tramos: '2027-03-22', avisos_rpad: ['2027-03-22'] };
    const cobertura = (lista, al) => vistaDe(lista, { anio: 2027, al }).resultados.cobertura;
    assert.deepEqual(cobertura([abril()], '2027-03-21'), { si: 0, total: 0, faltan: [] });
    // El lunes 22/03: sin el aviso todavía no falta; con el aviso, cubierto
    assert.deepEqual(cobertura([abril({ motivo_sin_aviso: 'sin-aviso' })], '2027-03-22'), { si: 0, total: 0, faltan: [] });
    assert.deepEqual(cobertura([abril(avisado)], '2027-03-22'), { si: 1, total: 1, faltan: [] });
    // Desde el martes 23/03, sin el aviso, falta
    assert.deepEqual(cobertura([abril({ motivo_sin_aviso: 'sin-aviso' })], '2027-03-23'),
      { si: 0, total: 1, faltan: [{ titulo: 'Dataset de prueba', venc: '2027-04-30', motivo: 'sin el aviso de la regla' }] });
    // En la lista de casos, el motivo aparece recién entonces
    const textoDelAviso = (al) => vistaDe([abril({ motivo_sin_aviso: 'sin-aviso', avisos_rpad: ['2027-01-20'], primer_aviso: '2027-01-20' })],
      { anio: 2027, al }).casos[0].aviso.texto;
    assert.deepEqual([textoDelAviso('2027-03-22'), textoDelAviso('2027-03-23')], ['', 'sin el aviso de la regla']);
    // Con los fines de mes de 2027 y las dos gestiones (los que tienen el aviso en 2027), el día que cuenta es el de la Agenda
    // (fechaDeAvisoPorRegla): ese día, sin el aviso, todavía no; el siguiente, sí
    for (const gestion of ['externa', 'interna']) {
      for (let mes = 1; mes <= 12; mes++) {
        const vencimiento = sumarDias(mes === 12 ? '2028-01-01' : `2027-${String(mes + 1).padStart(2, '0')}-01`, -1);
        const dia = fechaDeAvisoPorRegla(vencimiento, gestion);
        if (!dia.startsWith('2027-')) continue;
        const delMes = caso({
          gestion, requiere_nota: gestion === 'interna' ? null : 1, venc: vencimiento, inicio: '2026-12-01', alta: '2026-12-01',
          fecha_regla: sumarDias(vencimiento, -VENTANA_DIAS[gestion]), aviso_regla: null, primer_aviso: null, inicio_tramos: null, avisos_rpad: [],
          reiteraciones_rpad: null, motivo_sin_aviso: 'sin-aviso'
        });
        assert.equal(cobertura([delMes], dia).total, 0, `${gestion} ${vencimiento}: el día del aviso (${dia})`);
        assert.equal(cobertura([delMes], sumarDias(dia, 1)).total, 1, `${gestion} ${vencimiento}: el día siguiente`);
      }
    }
  });

  it('reiteraciones por ciclo: las de los ciclos que terminaron en el año y las de los abiertos a al, también al 31/12', () => {
    // Los reales: 16 ciclos (los abiertos sin aviso de la regla ni avisados ya vencidos, como el 33 o el 58, no cuentan: Ruling 6)
    assert.deepEqual(vista(casosReales()).resultados.reiteraciones, { rpad: { ninguna: 4, una: 1, dos_o_mas: 11, total: 16 }, dgmit: null });
    // Los avisos de un día posterior al inicio de los tramos y hasta al
    const reiterado = (avisos, datos = {}) => cerrado({ avisos_rpad: ['2026-02-19', ...avisos], ...datos });
    const grupos = (lista, opciones) => vista(lista, opciones).resultados.reiteraciones.rpad;
    assert.deepEqual(grupos([
      reiterado([]), reiterado(['2026-02-19'], { dataset_id: 901 }), reiterado(['2026-03-26'], { dataset_id: 902 }),
      reiterado(['2026-03-26', '2026-04-01'], { dataset_id: 903 }), reiterado(['2026-03-26', '2026-04-01', '2026-05-01'], { dataset_id: 904 })
    ]), { ninguna: 2, una: 1, dos_o_mas: 2, total: 5 });
    assert.deepEqual(grupos([caso({ avisos_rpad: ['2026-02-19', '2026-03-26', '2026-11-02'] })], { al: '2026-10-31' }),
      { ninguna: 0, una: 1, dos_o_mas: 0, total: 1 });
    // Sin inicio de los tramos no cuentan; un ciclo cerrado en otro año, tampoco
    assert.equal(grupos([caso({ aviso_regla: null, inicio_tramos: null, reiteraciones_rpad: null })]).total, 0);
    assert.equal(grupos([cerrado({ cierre: '2025-12-16', carga: '2025-12-16' })]).total, 0);
    // Los abiertos a al cuentan siempre: el 30/12, el 31/12 y en la foto; uno que se abrió después de al, no
    assert.deepEqual([grupos([caso()]).total, grupos([caso()], { al: '2026-12-30' }).total, grupos([caso()], { al: '2026-12-31' }).total], [1, 1, 1]);
    assert.equal(grupos([caso({ inicio: '2027-01-05' })], { al: '2026-12-31' }).total, 0);
    // De la DGMIT al área: las reiteraciones de los ciclos con nota DGMIT, solo cuando hay notas cargadas
    const conNotas = [
      cerrado({ nota_dgmit: notaDe('2026-03-02') }), cerrado({ dataset_id: 901, nota_dgmit: notaDe('2026-03-02'), reiteraciones_dgmit: 1 }),
      caso({ dataset_id: 902, nota_dgmit: notaDe('2026-03-02', { tipo: 'reiteracion' }), reiteraciones_dgmit: 2 }), cerrado({ dataset_id: 903 }),
      caso({ dataset_id: 904, gestion: 'interna', requiere_nota: null })
    ];
    assert.deepEqual(vista(conNotas).resultados.reiteraciones.dgmit, { ninguna: 1, una_o_mas: 2, total: 3 });
  });

  it('los textos de los resultados los arma el servidor: «de 9 ciclos», el medidor, la regla, los que faltan y las reiteraciones', () => {
    // Los reales: 3 de 9 a tiempo (33 %), 13 de 15 vencimientos avisados (87 %) y 16 ciclos con reiteraciones del RPAD; sin notas DGMIT
    assert.deepEqual(vista(casosReales()).resultados.textos, {
      a_tiempo: { de: 'de 9 ciclos', medidor: 33, vacio: '' },
      cobertura: { de: 'de 15 vencimientos', medidor: 87, regla: REGLA_DEL_AVISO, faltan: 'Los 2 que faltan:', vacio: '' },
      reiteraciones: {
        rpad: 'Del RPAD a la DGMIT (16 ciclos)', rpad_vacio: '', dgmit: 'De la DGMIT al área', dgmit_vacio: 'Todavía no hay notas DGMIT cargadas.',
        aclaracion: ACLARACION_DE_LOS_EMAILS
      }
    });
    // En singular: uno cargado tarde (0 de 1, el medidor en 0), un vencimiento avisado y un ciclo
    assert.deepEqual(vista([cerrado()]).resultados.textos, {
      a_tiempo: { de: 'de 1 ciclo', medidor: 0, vacio: '' },
      cobertura: { de: 'de 1 vencimiento', medidor: 100, regla: REGLA_DEL_AVISO, faltan: '', vacio: '' },
      reiteraciones: {
        rpad: 'Del RPAD a la DGMIT (1 ciclo)', rpad_vacio: '', dgmit: 'De la DGMIT al área', dgmit_vacio: 'Todavía no hay notas DGMIT cargadas.',
        aclaracion: null
      }
    });
    // Uno solo que falta
    const sinAviso = caso({ aviso_regla: null, inicio_tramos: null, motivo_sin_aviso: 'sin-aviso', reiteraciones_rpad: null });
    assert.equal(vista([sinAviso]).resultados.textos.cobertura.faltan, 'El que falta:');
    // Con notas DGMIT: los ciclos con nota de la DGMIT al área; si hay notas pero ninguna de estos ciclos, lo dice
    const conNotas = [cerrado({ nota_dgmit: notaDe('2026-03-02') }), caso({ dataset_id: 901, nota_dgmit: notaDe('2026-03-05'), reiteraciones_dgmit: 1 })];
    const dgmit = (lista, opciones) => {
      const { dgmit: titulo, dgmit_vacio: vacio } = vista(lista, opciones).resultados.textos.reiteraciones;
      return [titulo, vacio];
    };
    assert.deepEqual(dgmit(conNotas), ['De la DGMIT al área (2 ciclos)', '']);
    assert.deepEqual(dgmit(conNotas.slice(0, 1)), ['De la DGMIT al área (1 ciclo)', '']);
    assert.deepEqual(dgmit(conNotas, { sin: [900, 901] }), ['De la DGMIT al área (0 ciclos)', 'Sin ciclos con nota DGMIT en 2026.']);
    // El año va en los textos de lo vacío
    assert.equal(vistaDe([], { anio: 2027, al: '2027-03-01' }).resultados.textos.a_tiempo.vacio, 'Sin actualizaciones registradas en 2027.');
  });

  it('la aclaración de las reiteraciones (Ruling 21): solo si algún ciclo que cuenta del RPAD a la DGMIT tuvo un email a la DGMIT después del aviso', () => {
    const aclaracion = (lista, opciones) => vista(lista, opciones).resultados.textos.reiteraciones.aclaracion;
    // Con un email posterior al aviso de la regla (el de 5 días o el de vencidos: una reiteración por email), va
    assert.equal(aclaracion([cerrado({ avisos_rpad: ['2026-02-19', '2026-03-26'], emails_rpad: ['2026-02-19', '2026-03-26'] })]), ACLARACION_DE_LOS_EMAILS);
    assert.equal(aclaracion([caso(), caso({ dataset_id: 901, avisos_rpad: ['2026-02-19', '2026-03-26'], emails_rpad: ['2026-03-26'] })]),
      ACLARACION_DE_LOS_EMAILS);
    // Revisión final (A-4): un ciclo cuyo único email es el de la regla (el de 40 o 60 días, que no es una reiteración) no la muestra, ni
    // uno con otro email del mismo día
    assert.equal(aclaracion([cerrado({ emails_rpad: ['2026-02-19'] })]), null);
    assert.equal(aclaracion([cerrado({ avisos_rpad: ['2026-02-19', '2026-02-19'], emails_rpad: ['2026-02-19', '2026-02-19'] })]), null);
    // Ni uno con una reiteración por Nota Digital, que no es un email
    assert.equal(aclaracion([cerrado({ avisos_rpad: ['2026-02-19', '2026-03-26'], emails_rpad: ['2026-02-19'] })]), null);
    // Solo con Notas Digitales (sin emails), no
    assert.equal(aclaracion([cerrado(), caso({ dataset_id: 901 })]), null);
    // El email es de un ciclo que no cuenta del RPAD a la DGMIT (sin inicio de los tramos, o cerrado en otro año): no
    assert.equal(aclaracion([caso({ aviso_regla: null, inicio_tramos: null, reiteraciones_rpad: null, emails_rpad: ['2026-02-19'] })]), null);
    assert.equal(aclaracion([cerrado({ cierre: '2025-12-16', carga: '2025-12-16', emails_rpad: ['2025-10-22'] })]), null);
    // Un destildado no cuenta; un email posterior a al todavía no pasó
    const reiteradoPorEmail = cerrado({ avisos_rpad: ['2026-02-19', '2026-03-26'], emails_rpad: ['2026-02-19', '2026-03-26'] });
    assert.equal(aclaracion([reiteradoPorEmail, cerrado({ dataset_id: 901 })]), ACLARACION_DE_LOS_EMAILS);
    assert.equal(aclaracion([reiteradoPorEmail, cerrado({ dataset_id: 901 })], { sin: [900] }), null);
    assert.equal(aclaracion([caso({ emails_rpad: ['2026-11-02'] })], { al: '2026-10-31' }), null);
    // Con los casos reales (los ciclos de 2026 tuvieron emails hasta el 12/10)
    assert.equal(aclaracion(casosReales()), ACLARACION_DE_LOS_EMAILS);
  });

  it('los casos: los de aviso o carga en el año, por vencimiento, con los días o el estado debajo de cada fecha', () => {
    const v = vista(casosReales());
    // 15 externos y 3 internos (los ciclos de diciembre de 2025 y los abiertos todavía sin avisos no van)
    assert.deepEqual([v.casos.length, v.casos.filter((f) => f.gestion === 'externa').length], [18, 15]);
    assert.ok(v.casos.every((f, i) => i === 0 || (f.vencimiento ?? '9999') >= (v.casos[i - 1].vencimiento ?? '9999')));
    for (const f of v.casos) {
      assert.deepEqual(Object.keys(f), ['dataset_id', 'titulo', 'area', 'gestion', 'contar', 'vencimiento', 'aviso', 'nota', 'recibido', 'carga']);
    }
    // El 52 del 31/01/2026: aviso de 40 días, nota DGMIT pendiente de carga, los datos el día de la carga
    const d = (desde, hasta) => String(duracion(desde, hasta, 'habiles'));
    assert.deepEqual(filasDe(v, 52)[0], {
      dataset_id: 52, titulo: DEL_52.titulo, area: DEL_52.area, gestion: 'externa', contar: true, vencimiento: '2026-01-31',
      aviso: { fecha: '2025-12-22', texto: `${d('2025-12-22', '2026-01-31')} antes`, que: 'email de 40 días' },
      nota: { numero: null, tipo: '', texto: 'pendiente de carga' },
      recibido: { fecha: '2026-02-04', texto: '', origen: 'Los entregó el área' },
      carga: { fecha: '2026-02-04', texto: 'en el día' }
    });
    // El abierto del 52: sin datos, en curso desde el aviso
    assert.deepEqual(filasDe(v, 52)[1].recibido, { fecha: null, texto: `en curso, hace ${d('2026-06-21', AL)}`, origen: '' });
    // Avisado ya vencido (el 11) y sin el aviso de la regla (el 33, que se avisó ya vencido)
    assert.deepEqual(filasDe(v, 11)[0].aviso, { fecha: '2025-12-06', texto: 'avisado ya vencido', que: 'email mensual de vencidos' });
    assert.equal(filasDe(v, 11)[0].recibido.texto, `en curso, hace ${d('2025-12-06', AL)}`);
    assert.deepEqual(filasDe(v, 33)[0].aviso, { fecha: '2026-06-21', texto: 'se avisó ya vencido', que: 'email de 40 días' });
    // Con nota DGMIT: su número y su tipo, los días de la redacción, y los de la respuesta debajo de «Recibido el»
    const conNota = vista([cerrado({ nota_dgmit: notaDe('2026-03-02', { tipo: 'reiteracion' }) })]).casos[0];
    assert.deepEqual([conNota.nota, conNota.recibido], [
      { numero: '45/26', tipo: 'Reiteración', texto: d('2026-02-19', '2026-03-02') },
      { fecha: '2026-04-06', texto: d('2026-03-02', '2026-04-06'), origen: 'Los entregó el área' }
    ]);
    // Interna: sin nota DGMIT, y la producción debajo de «Recibido el» (el 38 del 31/03/2026, con los datos del 10/02/2026)
    const interno = filasDe(vista(casosReales({ importados: { 12: { recibido_el: '2026-02-10' } } })), 38)[0];
    assert.deepEqual([interno.nota, interno.recibido, interno.carga], [
      { numero: null, tipo: '', texto: '' }, { fecha: '2026-02-10', texto: d('2026-01-30', '2026-02-10'), origen: '' },
      { fecha: '2026-02-12', texto: d('2026-02-10', '2026-02-12') }
    ]);
    // Fuente pública: el origen, y sin días de respuesta
    assert.deepEqual(vista([cerrado({ nota_dgmit: notaDe('2026-03-02'), origen: 'fuente_publica' })]).casos[0].recibido,
      { fecha: '2026-04-06', texto: '', origen: 'Fuente pública' });
    // Lo que pasó después de al todavía no está (la foto al 31/12 con los casos de enero)
    const [antes] = vista([cerrado()], { al: '2026-04-07' }).casos;
    assert.deepEqual([antes.recibido.fecha, antes.carga, antes.nota.texto], ['2026-04-06', { fecha: null, texto: '' }, 'pendiente de carga']);
    // Un ciclo sin nada en el año no va (avisado y cargado en 2025), y tampoco cuenta como avisado ya vencido; uno sin vencimiento, al
    // final
    const de2025 = { venc: '2025-11-30', aviso_regla: '2025-10-21', primer_aviso: '2025-10-21', inicio_tramos: '2025-10-21', avisos_rpad: ['2025-10-21'] };
    assert.deepEqual(vista([cerrado({ ...de2025, recibido: '2025-12-15', carga: '2025-12-16', cierre: '2025-12-16' })]).casos, []);
    const heredadoDe2025 = cerrado({
      ...de2025, aviso_regla: null, primer_aviso: '2025-12-06', inicio_tramos: '2025-12-06', avisos_rpad: ['2025-12-06'], heredado: true,
      recibido: '2025-12-15', carga: '2025-12-16', cierre: '2025-12-16'
    });
    assert.equal(vista([heredadoDe2025]).circuito.aclaraciones.externa.ya_vencidos.n, 0);
    // Va con solo la carga en el año (avisado en 2025, sin vencimiento conocido ni «Recibido el»), o con solo un tramo (el aviso
    // anticipado del 31/01/2026, avisado en 2025 y reprogramado en enero)
    const soloLaCarga = cerrado({ venc: null, aviso_regla: null, inicio_tramos: null, avisos_rpad: ['2025-12-10'], recibido: null, carga: '2026-01-21', cierre: '2026-01-21' });
    const soloUnTramo = caso({
      venc: '2026-01-31', aviso_regla: '2025-12-22', primer_aviso: '2025-12-22', inicio_tramos: '2025-12-22', fecha_regla: '2025-12-22',
      avisos_rpad: ['2025-12-22'], como: 'reprogramacion', abierto: false, cierre: '2026-01-05'
    });
    assert.equal(vista([soloLaCarga]).casos.length, 1);
    assert.equal(vista([soloUnTramo]).casos.length, 1);
    const orden = vista([
      cerrado({ dataset_id: 901, venc: null }), cerrado({ dataset_id: 902, titulo: 'B' }), cerrado({ dataset_id: 903, titulo: 'A' }),
      cerrado({ dataset_id: 904, venc: '2026-02-28' })
    ]).casos.map((f) => f.dataset_id);
    assert.deepEqual(orden, [904, 903, 902, 901]);
  });

  it('para completar: las notas DGMIT pendientes de carga y las actualizaciones sin «Recibido el» o sin origen', () => {
    const v = vista(casosReales());
    // Notas: los 7 abiertos con avisos y sin nota, y los 8 cerrados en el año: por actualización (el 9 dos veces, el 10 cuatro y el
    // 52) y la reprogramación del 42 (no tiene origen, y su redacción cuenta igual: spec 1.2). Primero los abiertos, cada grupo por
    // vencimiento
    const notas = v.para_completar.notas;
    assert.equal(notas.length, 15);
    assert.deepEqual(notas.filter((n) => n.abierto).map((n) => n.dataset_id), [11, 61, 33, 1, 52, 81, 58]);
    assert.deepEqual(notas.filter((n) => !n.abierto).map((n) => n.dataset_id), [9, 52, 10, 42, 9, 10, 10, 10]);
    assert.ok(notas.every((n, i) => i === 0 || n.abierto <= notas[i - 1].abierto));
    // Cada una dice cómo está su ciclo: abierto, actualizado (con la carga) o reprogramado (con la aprobación)
    assert.deepEqual(notas.find((n) => n.dataset_id === 42), {
      dataset_id: 42, titulo: CASOS[42].dataset.titulo, area: CASOS[42].dataset.area, abierto: false, aviso: '2026-02-19', que: 'email de 40 días', carga: null,
      situacion: 'reprogramado el 06/04/2026'
    });
    assert.equal(filasDe(v, 42)[0].nota.texto, 'pendiente de carga');
    assert.deepEqual(notas.find((n) => n.dataset_id === 81), {
      dataset_id: 81, titulo: CASOS[81].dataset.titulo, area: CASOS[81].dataset.area, abierto: true, aviso: '2026-10-20', que: 'Nota Digital 3/26',
      carga: null, situacion: 'ciclo abierto'
    });
    assert.deepEqual(notas.find((n) => n.dataset_id === 52 && !n.abierto), {
      dataset_id: 52, titulo: DEL_52.titulo, area: DEL_52.area, abierto: false, aviso: '2025-12-22', que: 'email de 40 días', carga: '2026-02-04',
      situacion: 'actualizado el 04/02/2026'
    });
    // Recibido: las actualizaciones del año sin «Recibido el» (todas menos la del 52, que vino del Excel), por fecha de carga
    const recibido = v.para_completar.recibido;
    assert.deepEqual(recibido.map((r) => [r.dataset_id, r.carga, r.falta]), [
      [38, '2026-02-12', 'recibido'], [10, '2026-02-18', 'recibido'], [9, '2026-03-13', 'recibido'], [10, '2026-05-22', 'recibido'],
      [10, '2026-09-25', 'recibido'], [38, '2026-10-02', 'recibido'], [9, '2026-10-09', 'recibido'], [10, '2026-10-13', 'recibido']
    ]);
    assert.deepEqual(Object.keys(recibido[0]), ['dataset_id', 'titulo', 'gestion', 'carga', 'falta', 'falta_texto']);
    assert.ok(recibido.every((r) => r.falta_texto === 'Falta «Recibido el»'));
    // El total (el del índice de la página, «Para completar (23)») y el título de cada grupo
    assert.equal(v.para_completar.total, 23);
    assert.deepEqual(v.para_completar.textos, {
      notas: 'Notas DGMIT pendientes de carga (15: 7 de ciclos abiertos y 8 de ciclos cerrados en 2026)', notas_vacio: '',
      recibido: 'Actualizaciones sin «Recibido el» o sin el origen de los datos (8)', recibido_vacio: ''
    });
    // En externa, sin origen; en interna el origen no se pregunta; una actualización simple (sin cambio) no se puede completar
    const lista = [
      cerrado({ dataset_id: 901, origen: null }), cerrado({ dataset_id: 902, gestion: 'interna', requiere_nota: null, origen: null }),
      cerrado({ dataset_id: 903, recibido: null, cambio_id: null }), cerrado({ dataset_id: 904, recibido: null, origen: null, carga: '2026-04-07', cierre: '2026-04-07' })
    ];
    assert.deepEqual(vista(lista).para_completar.recibido.map((r) => [r.dataset_id, r.gestion, r.falta, r.falta_texto]),
      [[904, 'externa', 'recibido', 'Falta «Recibido el»'], [901, 'externa', 'origen', 'Falta el origen de los datos']]);
    // Un solo grupo de notas, o una sola de cada uno: el título lo dice
    const titulo = (lista) => vista(lista).para_completar.textos.notas;
    assert.equal(titulo([caso()]), 'Notas DGMIT pendientes de carga (1, de un ciclo abierto)');
    assert.equal(titulo([caso(), caso({ dataset_id: 901 })]), 'Notas DGMIT pendientes de carga (2, de ciclos abiertos)');
    assert.equal(titulo([cerrado({ origen: null })]), 'Notas DGMIT pendientes de carga (1, de un ciclo cerrado en 2026)');
    assert.equal(titulo([cerrado({ origen: null }), cerrado({ dataset_id: 901, origen: null })]),
      'Notas DGMIT pendientes de carga (2, de ciclos cerrados en 2026)');
    assert.equal(titulo([caso(), cerrado({ dataset_id: 901, origen: null })]),
      'Notas DGMIT pendientes de carga (2: 1 de un ciclo abierto y 1 de un ciclo cerrado en 2026)');
    assert.deepEqual(vista([caso()]).para_completar.textos.recibido_vacio, 'No hay actualizaciones sin «Recibido el» ni sin el origen de los datos.');
    // Notas: sin avisos, no; interna, no
    assert.deepEqual(vista([caso({ avisos_rpad: [], aviso_regla: null, primer_aviso: null, inicio_tramos: null }),
      caso({ dataset_id: 901, gestion: 'interna', requiere_nota: null })]).para_completar.notas, []);
    // Cerrados: una reprogramación del año entra; una del año anterior, la baja o un dataset dado de baja, no (la nota DGMIT solo se
    // carga en los activos). La marca «pendiente de carga» de la lista de casos sigue la misma regla
    const reprogramado = (datos) => caso({ como: 'reprogramacion', abierto: false, cierre: '2026-04-06', aprobado: '2026-04-06 08:00:00', ...datos });
    const cerrados = vista([
      reprogramado({ dataset_id: 901 }), reprogramado({ dataset_id: 902, cierre: '2025-12-20', venc: '2025-11-30', avisos_rpad: ['2025-10-21'] }),
      caso({ dataset_id: 903, como: 'baja', abierto: false, activo: false, cierre: '2026-04-06' }),
      cerrado({ dataset_id: 904, activo: false }), reprogramado({ dataset_id: 905, activo: false }),
      // La baja cierra el ciclo aunque el dataset figure activo hoy (se reactivó)
      caso({ dataset_id: 906, como: 'baja', abierto: false, cierre: '2026-04-06' })
    ]);
    assert.deepEqual(cerrados.para_completar.notas.map((n) => [n.dataset_id, n.abierto, n.carga]), [[901, false, null]]);
    assert.deepEqual(cerrados.casos.map((f) => [f.dataset_id, f.nota.texto]),
      [[901, 'pendiente de carga'], [903, ''], [904, ''], [905, ''], [906, '']]);
    // Una reprogramación posterior a al: el ciclo estaba abierto
    assert.deepEqual(vista([reprogramado({ dataset_id: 901 })], { al: '2026-04-05' }).para_completar.notas.map((n) => n.abierto), [true]);
  });

  it('con datos raros no tira', () => {
    for (const casos of [null, undefined, 'x', 3, {}, [null, 'x', 3, []]]) {
      const v = vista(casos);
      assert.deepEqual(v.resultados.cobertura, { si: 0, total: 0, faltan: [] });
      sinNadaNulo(v);
    }
    // Un año y un al que no sirven: null. El año sale del al y el al del año; un al posterior al año es el 31/12; uno anterior, null
    for (const opciones of [null, undefined, {}, { anio: 'x' }, { al: 'x' }, { anio: 2026, al: '2025-12-31' }, { anio: 1e6 }]) {
      assert.equal(vistaDe([], opciones), null, JSON.stringify(opciones));
    }
    assert.deepEqual(vistaDe([cerrado()], { al: AL }), vista([cerrado()]));
    assert.deepEqual(vistaDe([cerrado()], { anio: 2026 }), vista([cerrado()], { al: '2026-12-31' }));
    assert.deepEqual(vistaDe([cerrado()], { anio: '2026', al: '2027-01-10' }), vista([cerrado()], { al: '2026-12-31' }));
    // Casos con fechas que no se pueden leer o listas que no son listas
    const raro = cerrado({ recibido: 'mal', carga: '2026-02-30', avisos_rpad: null, nota_dgmit: { numero: '1/26', tipo: 'otra', recibida: 'x' }, venc: 20260331 });
    sinNadaNulo(vista([raro, cerrado({ dataset_id: 901 })]));
    assert.equal(cifraDel(vista([raro, cerrado({ dataset_id: 901 })]), 'externa', 'carga').ciclos, 1);
    // Un sin que no es una lista no destilda nada
    assert.deepEqual(vista([cerrado()], { sin: 'x' }), vista([cerrado()]));
  });

  it('vistaDe no modifica los casos', () => {
    const casos = casosReales();
    const antes = structuredClone(casos);
    vista(casos, { sin: [52] });
    assert.deepEqual(casos, antes);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Los casos que guarda la foto del 31/12 (spec, 3)
// ---------------------------------------------------------------------------------------------------------------------

describe('casosQueTocanElAnio', () => {
  const ANIO = Object.freeze({ anio: 2026, al: '2026-12-31' });
  const combinaciones = (opciones) => ESTADISTICOS.flatMap((estadistico) => DIAS.map((dias) => ({ ...opciones, estadistico, dias })));

  it('con los casos reales al 31/12: guarda menos que todos, en su orden, y la vista del año es la misma', () => {
    for (const { anio, al } of [ANIO, { anio: 2025, al: '2025-12-31' }]) {
      const todos = casosDe(mapaDeLosCasos(), { hoy: al });
      const delAnio = casosQueTocanElAnio(todos, { anio, al });
      assert.ok(delAnio.length > 0 && delAnio.length < todos.length, `${anio}: ${delAnio.length} de ${todos.length}`);
      assert.deepEqual(delAnio, todos.filter((c) => delAnio.includes(c)));
      for (const opciones of [...combinaciones({ anio, al }), { anio, al, sin: [52, 38] }]) {
        assert.deepEqual(vistaDe(delAnio, opciones), vistaDe(todos, opciones), JSON.stringify(opciones));
      }
    }
  });

  it('toca el año un ciclo que vence, está abierto, cierra o tiene un aviso en el año, o una nota DGMIT hasta al', () => {
    // Un ciclo de 2025: vencía el 31/03/2025, se avisó el 19/02/2025 y se cargó el 08/04/2025
    const de2025 = {
      venc: '2025-03-31', inicio: '2025-01-02', aviso_regla: '2025-02-19', primer_aviso: '2025-02-19', inicio_tramos: '2025-02-19',
      fecha_regla: '2025-02-19', avisos_rpad: ['2025-02-19'], cierre: '2025-04-08', aprobado: '2025-04-08 10:00:00',
      recibido: '2025-04-06', carga: '2025-04-08', alta: '2025-01-02'
    };
    const viejo = cerrado({ ...de2025, dataset_id: 901 });
    const conNota = cerrado({ ...de2025, dataset_id: 902, nota_dgmit: notaDe('2025-03-10') });
    const abierto = caso({ dataset_id: 903 });
    const cerradoEnEnero = cerrado({ ...de2025, dataset_id: 904, cierre: '2026-01-08', aprobado: '2026-01-08 10:00:00', recibido: '2026-01-06', carga: '2026-01-08' });
    // Actualizado en diciembre de 2025, antes de su vencimiento del 31/01/2026: vence en 2026 (en la cobertura no cuenta: dejó de regir
    // en el RPAD antes del día de su aviso, el 22/12/2025)
    const venceEnElAnio = cerrado({
      ...de2025, dataset_id: 905, venc: '2026-01-31', fecha_regla: '2025-12-22', aviso_regla: null, primer_aviso: null, inicio_tramos: null,
      avisos_rpad: [], motivo_sin_aviso: 'sin-aviso', cierre: '2025-12-20', aprobado: '2025-12-20 10:00:00', recibido: '2025-12-19', carga: '2025-12-20'
    });
    // Abierto después de al: sin avisos en el año no toca 2026; avisado el 28/12/2026 por una nota con su vencimiento, sí
    const posterior = { inicio: '2027-01-05', venc: '2027-02-28', fecha_regla: '2027-01-19' };
    const despues = caso({ ...posterior, dataset_id: 906, aviso_regla: null, primer_aviso: null, inicio_tramos: null, avisos_rpad: [] });
    const avisadoEnDiciembre = caso({ ...posterior, dataset_id: 907, aviso_regla: '2026-12-28', primer_aviso: '2026-12-28', inicio_tramos: '2026-12-28', avisos_rpad: ['2026-12-28'] });
    // Lo de después de al todavía no pasó: una nota DGMIT de enero de 2027 en un ciclo de 2025 no lo trae
    const notaDeEnero = cerrado({ ...de2025, dataset_id: 908, nota_dgmit: notaDe('2027-01-04') });
    // Vencido desde el 31/12/2025 y avisado el 15/12/2025, sin nota DGMIT: abierto todo 2026 es una nota pendiente de carga, y
    // reprogramado en enero también (cerró en el año)
    const vencidoDe2025 = {
      venc: '2025-12-31', inicio: '2025-01-02', fecha_regla: '2025-11-21', aviso_regla: null, primer_aviso: '2025-12-15', inicio_tramos: null,
      avisos_rpad: ['2025-12-15'], reiteraciones_rpad: null, motivo_sin_aviso: 'sin-aviso', alta: '2025-01-02'
    };
    const sigueVencido = caso({ ...vencidoDe2025, dataset_id: 909 });
    const reprogramadoEnEnero = caso({ ...vencidoDe2025, dataset_id: 910, abierto: false, como: 'reprogramacion', cierre: '2026-01-20', aprobado: '2026-01-20 10:00:00' });
    const todos = [viejo, conNota, abierto, cerradoEnEnero, venceEnElAnio, despues, avisadoEnDiciembre, notaDeEnero, sigueVencido, reprogramadoEnEnero];
    const delAnio = casosQueTocanElAnio(todos, ANIO);
    assert.deepEqual(delAnio.map((c) => c.dataset_id), [902, 903, 904, 905, 907, 909, 910]);
    assert.deepEqual(vistaDe(todos, ANIO).para_completar.notas.map((n) => n.dataset_id).sort(), [903, 904, 909, 910]);
    for (const opciones of combinaciones(ANIO)) assert.deepEqual(vistaDe(delAnio, opciones), vistaDe(todos, opciones));
    // La de 2025 con nota DGMIT queda porque la vista mira si hay notas DGMIT en todos los casos: sin ella, la redacción diría «Todavía
    // no hay notas DGMIT cargadas»
    const sinLaNota = delAnio.filter((c) => c.dataset_id !== 902);
    assert.notDeepEqual(vistaDe(sinLaNota, ANIO), vistaDe(todos, ANIO));
    // Lo que no es un caso no va; sin año, ninguno
    assert.deepEqual(casosQueTocanElAnio([null, 'x', [], abierto], ANIO), [abierto]);
    for (const opciones of [null, undefined, {}, { anio: 'x' }, { anio: 2026, al: '2025-12-31' }]) {
      assert.deepEqual(casosQueTocanElAnio(todos, opciones), [], JSON.stringify(opciones));
    }
    for (const casos of [null, undefined, 'x', {}]) assert.deepEqual(casosQueTocanElAnio(casos, ANIO), []);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Contexto, el trabajo del RPAD y áreas y temas (spec, 2.2)
// ---------------------------------------------------------------------------------------------------------------------

// Un dataset armado a mano (sobre el del 52): un externo cada medio año dado de alta el 01/11/2025, sin cambios ni avisos
const ds = (id, datos = {}, extra = {}) => solo({ id, titulo: `Dataset ${id}`, alta: '2025-11-01 10:00:00', ...datos }, extra);
// Una actualización aprobada en `revisado`: pasa la carga a `carga` y la próxima de `de` a `a`
const actualizacion = (id, datasetId, { revisado, carga, de, a }) => cambio({
  id, dataset_id: datasetId, creado: `${revisado.slice(0, 10)} 08:00:00`, revisado,
  anteriores: { proxima_actualizacion: de, ultima_actualizacion: '2025-10-15' },
  nuevos: { proxima_actualizacion: a, ultima_actualizacion: carga, registro_actualizacion: true }
});
// Una reprogramación aprobada en `revisado`: solo mueve la próxima de `de` a `a`
const reprogramacion = (id, datasetId, { revisado, de, a }) => cambio({
  id, dataset_id: datasetId, creado: `${revisado.slice(0, 10)} 08:00:00`, revisado,
  anteriores: { proxima_actualizacion: de }, nuevos: { proxima_actualizacion: a }
});
// Una baja aprobada en `revisado`
const baja = (id, datasetId, revisado) => cambio({ id, tipo: 'eliminar', dataset_id: datasetId, creado: `${revisado.slice(0, 10)} 08:00:00`, revisado });
// Lo que dicen los puntos del índice: [día, tasa] o [día, tasa, al día, base]
const tasas = (puntos) => puntos.map((p) => [p.dia, p.tasa]);
const conCuentas = (puntos) => puntos.map((p) => [p.dia, p.tasa, p.al_dia, p.base]);
// Los números de un punto del índice, sin sus textos
const numerosDelPunto = ({ dia, tasa, al_dia: alDia, base }) => ({ dia, tasa, al_dia: alDia, base });

// La portada hoy: estadoDelDataset con la próxima de hoy, de los datasets activos (lo que cuentan la portada y el Estado general)
const comoLaPortada = (mapa, hoy) => {
  const estados = [...mapa.values()].filter((f) => f.dataset.activo)
    .map((f) => estadoDelDataset({ proxima: f.dataset.proxima, meses: f.dataset.meses, tipoGestion: f.dataset.tipo_gestion, hoy }).estado);
  const alDia = estados.filter((e) => e === 'actualizado' || e === 'proximo').length;
  const eventuales = estados.filter((e) => e === 'eventual').length;
  return {
    tasa: tasaDeActualizacion({ alDia, total: estados.length, eventuales }), alDia, base: estados.length - eventuales,
    vencidos: estados.filter((e) => e === 'atrasado' || e === 'sin-respuesta').length
  };
};

describe('indiceMesAMes', () => {
  it('el punto de hoy del índice es igual a tasaDeActualizacion con los mismos datasets', () => {
    const hoy = HOY_DE_LAS_METRICAS;
    const mapa = mapaDe(
      ds(901, { proxima: '2027-03-31' }), // actualizado
      ds(902, { proxima: '2026-11-30' }), // próximo a vencer
      ds(903, { proxima: hoy }), // vence hoy: todavía al día
      ds(904, { proxima: '2026-09-30' }), // vencido, externo: sin respuesta
      ds(905, { proxima: '2026-06-30', tipo_gestion: 'interna' }), // vencido, interno: atrasado
      ds(906, { proxima: null }), // sin fecha: en la base, no al día
      ds(907, { proxima: null, meses: null, frecuencia: 'Eventual' }), // eventual: no cuenta
      ds(908, { proxima: '2027-01-31', alta: `${hoy} 09:00:00` }), // dado de alta hoy
      // Actualizado hoy: el ciclo abierto empieza hoy
      ds(909, { proxima: '2027-04-30', ultima: hoy }, {
        cambios: [actualizacion(70, 909, { revisado: `${hoy} 10:00:00`, carga: hoy, de: '2026-04-30', a: '2027-04-30' })]
      }),
      // Dado de baja en agosto: hoy no cuenta
      ds(910, { proxima: '2027-01-31', activo: false }, { cambios: [baja(71, 910, '2026-08-03 10:00:00')] })
    );
    const portada = comoLaPortada(mapa, hoy);
    assert.deepEqual(numerosDelPunto(indiceMesAMes(mapa, { anio: 2026, al: hoy }).at(-1)), { dia: hoy, tasa: portada.tasa, al_dia: portada.alDia, base: portada.base });
    // 901, 902, 903, 908 y 909 al día, de 8 (los activos sin el eventual)
    assert.deepEqual([portada.tasa, portada.alDia, portada.base], [63, 5, 8]);
    // Con los casos reales, en el día de los casos, en el de las métricas y al 31/12
    for (const al of [HOY, HOY_DE_LAS_METRICAS, '2026-12-31']) {
      const reales = comoLaPortada(mapaDeLosCasos(), al);
      assert.deepEqual(numerosDelPunto(indiceMesAMes(mapaDeLosCasos(), { anio: 2026, al }).at(-1)), { dia: al, tasa: reales.tasa, al_dia: reales.alDia, base: reales.base }, al);
    }
  });

  it('el índice se toma el primer día de cada mes: un vencimiento del 31/01 aparece en el punto del 1/2', () => {
    const mapa = mapaDe(ds(901, { proxima: '2026-01-31' }), ds(902, { proxima: '2026-12-31' }));
    assert.deepEqual(conCuentas(indiceMesAMes(mapa, { anio: 2026, al: '2026-03-15' })), [
      ['2026-01-01', 100, 2, 2], ['2026-02-01', 50, 1, 2], ['2026-03-01', 50, 1, 2], ['2026-03-15', 50, 1, 2]
    ]);
    // El día del vencimiento todavía está al día: tomado a fin de mes, el vencimiento del 31/01 no se vería en enero
    assert.deepEqual(tasas(indiceMesAMes(mapa, { anio: 2026, al: '2026-01-31' })), [['2026-01-01', 100], ['2026-01-31', 100]]);
    // Con al en el primer día de un mes, ese punto va una sola vez; en un año cerrado, los doce primeros días y el 31/12
    assert.deepEqual(tasas(indiceMesAMes(mapa, { anio: 2026, al: '2026-02-01' })), [['2026-01-01', 100], ['2026-02-01', 50]]);
    assert.deepEqual(indiceMesAMes(mapa, { anio: 2026, al: '2026-01-01' }).map((p) => p.dia), ['2026-01-01']);
    const anio = indiceMesAMes(mapa, { anio: 2026 });
    assert.deepEqual(anio.map((p) => p.dia), [
      '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01',
      '2026-10-01', '2026-11-01', '2026-12-01', '2026-12-31'
    ]);
    assert.deepEqual(anio.map((p) => p.tasa), [100, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50]);
    assert.deepEqual(indiceMesAMes(mapa, { anio: 2026, al: '2027-03-01' }), anio);

    // Cada día cuenta el ciclo que regía en el RPAD al terminar el día: el 901 se actualiza el 10/02 (la carga, el 09/02) hasta el
    // 30/04, y vuelve a vencer el 1/5
    const actualizado = mapaDe(
      ds(901, { proxima: '2026-04-30', ultima: '2026-02-09' }, {
        cambios: [actualizacion(70, 901, { revisado: '2026-02-10 10:00:00', carga: '2026-02-09', de: '2026-01-31', a: '2026-04-30' })]
      }),
      ds(902, { proxima: '2026-12-31' })
    );
    assert.deepEqual(tasas(indiceMesAMes(actualizado, { anio: 2026, al: '2026-06-15' })), [
      ['2026-01-01', 100], ['2026-02-01', 50], ['2026-03-01', 100], ['2026-04-01', 100], ['2026-05-01', 50], ['2026-06-01', 50],
      ['2026-06-15', 50]
    ]);
    // Aprobada el mismo día del punto, ese punto ya la ve
    const delDia = mapaDe(ds(901, { proxima: '2026-04-30', ultima: '2026-02-01' }, {
      cambios: [actualizacion(70, 901, { revisado: '2026-02-01 18:00:00', carga: '2026-02-01', de: '2026-01-31', a: '2026-04-30' })]
    }));
    assert.deepEqual(tasas(indiceMesAMes(delDia, { anio: 2026, al: '2026-02-01' })), [['2026-01-01', 100], ['2026-02-01', 100]]);
  });

  it('un dataset dado de baja no cuenta después de la baja', () => {
    // El 901 vence el 31/01 y se da de baja el 01/04 a las 10:00: el punto del 1/4 ya no lo cuenta
    const mapa = mapaDe(
      ds(901, { proxima: '2026-01-31', activo: false }, { cambios: [baja(71, 901, '2026-04-01 10:00:00')] }),
      ds(902, { proxima: '2026-12-31' })
    );
    assert.deepEqual(conCuentas(indiceMesAMes(mapa, { anio: 2026, al: '2026-05-10' })), [
      ['2026-01-01', 100, 2, 2], ['2026-02-01', 50, 1, 2], ['2026-03-01', 50, 1, 2], ['2026-04-01', 100, 1, 1], ['2026-05-01', 100, 1, 1],
      ['2026-05-10', 100, 1, 1]
    ]);
    // Uno sin fecha también deja de contar con la baja; uno inactivo sin la baja registrada no cuenta nunca (no se sabe desde cuándo)
    const otros = mapaDe(
      ds(901, { proxima: null, activo: false }, { cambios: [baja(71, 901, '2026-03-02 10:00:00')] }),
      ds(902, { proxima: '2026-12-31' }),
      ds(903, { proxima: '2026-12-31', activo: false })
    );
    assert.deepEqual(conCuentas(indiceMesAMes(otros, { anio: 2026, al: '2026-04-01' })), [
      ['2026-01-01', 50, 1, 2], ['2026-02-01', 50, 1, 2], ['2026-03-01', 50, 1, 2], ['2026-04-01', 100, 1, 1]
    ]);
    // Un dataset que figura activo aunque tenga una baja (se reactivó por fuera del sistema) cuenta, con la próxima de hoy
    const reactivado = mapaDe(ds(901, { proxima: '2026-12-31' }, { cambios: [baja(71, 901, '2026-03-02 10:00:00')] }));
    assert.deepEqual(tasas(indiceMesAMes(reactivado, { anio: 2026, al: '2026-04-01' })).at(-1), ['2026-04-01', 100]);
    // Ni la antigüedad de los vencidos ni el ranking lo cuentan después de la baja
    assert.equal(antiguedadDeVencidos(mapa, { anio: 2026, al: '2026-03-31' }).total, 1);
    assert.equal(antiguedadDeVencidos(mapa, { anio: 2026, al: '2026-04-01' }).total, 0);
    assert.deepEqual(areasYTemas(mapa, { al: '2026-03-31' }).ranking.map((a) => a.total_datasets), [2]);
    assert.deepEqual(areasYTemas(mapa, { al: '2026-04-01' }).ranking.map((a) => a.total_datasets), [1]);
  });

  it('un dataset entra el día de su alta; los sin fecha están en la base sin estar al día; los eventuales no cuentan', () => {
    const mapa = mapaDe(
      ds(901, { proxima: '2026-12-31' }),
      ds(902, { proxima: '2026-12-31', alta: '2026-02-15 12:00:00' }),
      ds(903, { proxima: null }),
      ds(904, { proxima: null, meses: null, frecuencia: 'Eventual' })
    );
    assert.deepEqual(conCuentas(indiceMesAMes(mapa, { anio: 2026, al: '2026-03-01' })), [
      ['2026-01-01', 50, 1, 2], ['2026-02-01', 50, 1, 2], ['2026-03-01', 67, 2, 3]
    ]);
    // Sin ninguno con vencimiento, no hay tasa
    assert.deepEqual(conCuentas(indiceMesAMes(mapaDe(ds(904, { proxima: null, meses: null })), { anio: 2026, al: '2026-01-01' })),
      [['2026-01-01', null, 0, 0]]);
  });

  it('un mes en el que no se sabe el estado de más del 10 % de la base (ciclo con venc null) no tiene tasa', () => {
    // Una actualización simple del 10/02/2026 (sin cambio): la próxima que cumplía no quedó guardada, así que hasta ese día no se
    // sabe si estaba al día
    const simple = (id) => ds(id, { proxima: '2026-08-31', ultima: '2026-02-10' }, {
      historial: [{ fecha: '2026-02-10', creado: '2026-02-10 09:00:00', usuario: null, cambio_id: null }]
    });
    const conocidos = (n) => Array.from({ length: n }, (_, i) => ds(910 + i, { proxima: '2026-12-31' }));
    // 1 de 10: el 10 %, todavía se dibuja, con los que se conocen
    assert.deepEqual(conCuentas(indiceMesAMes(mapaDe(simple(901), ...conocidos(9)), { anio: 2026, al: '2026-03-01' })), [
      ['2026-01-01', 100, 9, 9], ['2026-02-01', 100, 9, 9], ['2026-03-01', 100, 10, 10]
    ]);
    // 2 de 10: más del 10 %, no se dibuja; después de la actualización, sí
    assert.deepEqual(conCuentas(indiceMesAMes(mapaDe(simple(901), simple(902), ...conocidos(8)), { anio: 2026, al: '2026-03-01' })), [
      ['2026-01-01', null, null, null], ['2026-02-01', null, null, null], ['2026-03-01', 100, 10, 10]
    ]);
    // El punto sin tasa lo dice en palabras
    assert.deepEqual(indiceMesAMes(mapaDe(simple(901), simple(902), ...conocidos(8)), { anio: 2026, al: '2026-03-01' }).map((p) => p.texto), [
      'Al 1/1/2026: sin datos suficientes para calcularlo', 'Al 1/2/2026: sin datos suficientes para calcularlo', 'Hoy: 100% al día (10 de 10)'
    ]);
  });

  it('destildar saca al dataset del índice', () => {
    const mapa = mapaDe(ds(901, { proxima: '2026-01-31' }), ds(902, { proxima: '2026-12-31' }));
    assert.deepEqual(indiceMesAMes(mapa, { anio: 2026, al: '2026-03-01', sin: [901] }),
      indiceMesAMes(mapaDe(ds(902, { proxima: '2026-12-31' })), { anio: 2026, al: '2026-03-01' }));
    assert.deepEqual(indiceMesAMes(mapa, { anio: 2026, al: '2026-03-01', sin: new Set([901]) }).map((p) => p.tasa), [100, 100, 100]);
  });

  it('cada punto dice su mes (o «hoy», o el 31/12) y su valor en palabras', () => {
    // Con los casos reales al 24/10/2026: un punto por mes y el de hoy
    const reales = indiceMesAMes(mapaDeLosCasos(), { anio: 2026, al: HOY_DE_LAS_METRICAS });
    assert.deepEqual(reales.map((p) => p.etiqueta), ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'hoy']);
    assert.deepEqual([reales[0].texto, reales[1].texto, reales.at(-1).texto],
      ['Al 1/1/2026: 75% al día (9 de 12)', 'Al 1/2/2026: 33% al día (4 de 12)', 'Hoy: 54% al día (7 de 13)']);
    // Un año cerrado termina en el 31/12; con hoy en el primer día de un mes, ese punto es el de hoy y lleva el nombre del mes
    const mapa = mapaDe(ds(901, { proxima: '2026-01-31' }), ds(902, { proxima: '2026-12-31' }));
    const anio = indiceMesAMes(mapa, { anio: 2026 });
    assert.deepEqual([anio.at(-2).etiqueta, anio.at(-1).etiqueta, anio.at(-1).texto], ['dic', '31/12', 'Al 31/12/2026: 50% al día (1 de 2)']);
    const primero = indiceMesAMes(mapa, { anio: 2026, al: '2026-03-01' });
    assert.deepEqual(primero.map((p) => [p.etiqueta, p.texto]), [
      ['ene', 'Al 1/1/2026: 100% al día (2 de 2)'], ['feb', 'Al 1/2/2026: 50% al día (1 de 2)'], ['mar', 'Hoy: 50% al día (1 de 2)']
    ]);
    // Sin ninguno con vencimiento, o sin saber el estado de más del 10 %, lo dice en lugar del número
    assert.deepEqual(indiceMesAMes(mapaDe(ds(904, { proxima: null, meses: null })), { anio: 2026, al: '2026-01-01' }).map((p) => p.texto),
      ['Hoy: sin datasets con vencimiento']);
  });
});

describe('estadosAl', () => {
  // Las claves de los siete estados, que suman el total
  const SIETE = ['actualizado', 'proximo', 'atrasado', 'sin_respuesta', 'sin_fecha', 'eventual', 'desconocido'];
  const suma = (estados) => SIETE.reduce((total, clave) => total + estados[clave], 0);

  it('cuántos hay en cada estado: suman el total, y la tasa es la de la portada y la del punto del índice de ese día', () => {
    const hoy = HOY_DE_LAS_METRICAS;
    const mapa = mapaDe(
      ds(901, { proxima: '2027-03-31' }), // actualizado
      ds(902, { proxima: '2026-11-30' }), // próximo a vencer
      ds(903, { proxima: hoy }), // vence hoy: todavía al día
      ds(904, { proxima: '2026-09-30' }), // vencido, externo: sin respuesta
      ds(905, { proxima: '2026-06-30', tipo_gestion: 'interna' }), // vencido, interno: atrasado
      ds(906, { proxima: null }), // sin fecha
      ds(907, { proxima: null, meses: null, frecuencia: 'Eventual' }), // eventual
      ds(908, { proxima: '2027-01-31', alta: `${hoy} 09:00:00` }), // dado de alta hoy: actualizado
      ds(909, { proxima: '2027-01-31', alta: '2026-10-25 09:00:00' }), // dado de alta mañana: todavía no cuenta
      ds(910, { proxima: '2027-01-31', activo: false }, { cambios: [baja(71, 910, '2026-08-03 10:00:00')] }) // dado de baja en agosto
    );
    const estados = estadosAl(mapa, { anio: 2026, al: hoy });
    assert.deepEqual(estados, {
      dia: hoy, total: 8, actualizado: 2, proximo: 2, atrasado: 1, sin_respuesta: 1, sin_fecha: 1, eventual: 1, desconocido: 0,
      vencidos: 2, al_dia: 4, tasa: 57
    });
    assert.equal(suma(estados), estados.total);
    const portada = comoLaPortada(mapaDe(...[...mapa.values()].filter((f) => f.dataset.id !== 909)), hoy);
    assert.deepEqual([estados.tasa, estados.al_dia, estados.vencidos], [portada.tasa, portada.alDia, portada.vencidos]);
    assert.deepEqual(numerosDelPunto(indiceMesAMes(mapa, { anio: 2026, al: hoy }).at(-1)), { dia: hoy, tasa: estados.tasa, al_dia: estados.al_dia, base: 7 });
    assert.equal(estados.vencidos, antiguedadDeVencidos(mapa, { anio: 2026, al: hoy }).total);
    // Con los casos reales, en el día de los casos, en el de las métricas y al 31/12
    for (const al of [HOY, HOY_DE_LAS_METRICAS, '2026-12-31']) {
      const reales = estadosAl(mapaDeLosCasos(), { anio: 2026, al });
      const punto = indiceMesAMes(mapaDeLosCasos(), { anio: 2026, al }).at(-1);
      assert.deepEqual([reales.tasa, reales.al_dia], [punto.tasa, punto.al_dia], al);
      assert.deepEqual([reales.tasa, reales.al_dia, reales.vencidos], [comoLaPortada(mapaDeLosCasos(), al).tasa,
        comoLaPortada(mapaDeLosCasos(), al).alDia, comoLaPortada(mapaDeLosCasos(), al).vencidos], al);
      assert.equal(suma(reales), reales.total, al);
      assert.equal(reales.vencidos, antiguedadDeVencidos(mapaDeLosCasos(), { anio: 2026, al }).total, al);
    }
    // Destildados, no cuentan
    assert.deepEqual(estadosAl(mapa, { anio: 2026, al: hoy, sin: [901, 907] }),
      { ...estados, total: 6, actualizado: 1, eventual: 0, al_dia: 3, tasa: 50 });
  });

  it('los de estado desconocido (un ciclo con venc null) cuentan en el total; con más del 10 %, sin tasa', () => {
    // Una actualización simple del 10/02/2026 (sin cambio): hasta ese día no se sabe qué próxima regía
    const simple = (id) => ds(id, { proxima: '2026-08-31', ultima: '2026-02-10' }, {
      historial: [{ fecha: '2026-02-10', creado: '2026-02-10 09:00:00', usuario: null, cambio_id: null }]
    });
    const conocidos = (n) => Array.from({ length: n }, (_, i) => ds(910 + i, { proxima: '2026-12-31' }));
    const uno = estadosAl(mapaDe(simple(901), ...conocidos(9)), { anio: 2026, al: '2026-02-01' });
    assert.deepEqual([uno.total, uno.actualizado, uno.desconocido, uno.al_dia, uno.tasa], [10, 9, 1, 9, 100]);
    const dos = estadosAl(mapaDe(simple(901), simple(902), ...conocidos(8)), { anio: 2026, al: '2026-02-01' });
    assert.deepEqual([dos.total, dos.actualizado, dos.desconocido, dos.al_dia, dos.tasa], [10, 8, 2, null, null]);
    assert.equal(suma(dos), dos.total);
  });

  it('sin año, null; sin datasets o con datos raros, todo en 0', () => {
    for (const opciones of [null, undefined, {}, { anio: 'x' }, { anio: 2026, al: '2025-12-31' }]) {
      assert.equal(estadosAl(mapaDeLosCasos(), opciones), null, JSON.stringify(opciones));
    }
    const vacio = {
      dia: '2026-12-31', total: 0, actualizado: 0, proximo: 0, atrasado: 0, sin_respuesta: 0, sin_fecha: 0, eventual: 0, desconocido: 0,
      vencidos: 0, al_dia: 0, tasa: null
    };
    for (const mapa of [new Map(), null, 'x', new Map([[1, null], [2, { dataset: 'x' }]])]) {
      assert.deepEqual(estadosAl(mapa, { anio: 2026 }), vacio);
    }
  });
});

describe('antiguedadDeVencidos', () => {
  it('antigüedad: 89, 90 y 366 días caen en los tres grupos', () => {
    const al = HOY_DE_LAS_METRICAS;
    const vencidoHace = (id, dias, datos = {}) => ds(id, { proxima: sumarDias(al, -dias), alta: '2024-01-01 10:00:00', ...datos });
    const mapa = mapaDe(
      vencidoHace(901, 89), vencidoHace(902, 90), vencidoHace(903, 365, { tipo_gestion: 'interna' }), vencidoHace(904, 366),
      vencidoHace(905, 1),
      ds(906, { proxima: al }), // vence hoy: al día
      ds(907, { proxima: null }), // sin fecha: no tiene vencimiento
      ds(908, { proxima: null, meses: null }) // eventual
    );
    assert.deepEqual(antiguedadDeVencidos(mapa, { anio: 2026, al }), {
      total: 5, menos_de_3_meses: 2, de_3_a_12: 2, mas_de_un_anio: 1, al_inicio: { total: 2, actualizados: 0 },
      textos: { titulo: 'Hoy: 5 datasets vencidos', inicio: 'Al 1/1/2026 eran 2: todavía no se actualizó ninguno.' }
    });
    // Hoy, los mismos vencidos que la portada
    assert.equal(antiguedadDeVencidos(mapa, { anio: 2026, al }).total, comoLaPortada(mapa, al).vencidos);
    // Destildados, no cuentan
    assert.deepEqual(antiguedadDeVencidos(mapa, { anio: 2026, al, sin: [901, 904] }), {
      total: 3, menos_de_3_meses: 1, de_3_a_12: 2, mas_de_un_anio: 0, al_inicio: { total: 1, actualizados: 0 },
      textos: { titulo: 'Hoy: 3 datasets vencidos', inicio: 'Al 1/1/2026 era 1: todavía no se actualizó.' }
    });
  });

  it('al 1/1: los vencidos ese día y cuántos de esos ya se actualizaron (no una reprogramación)', () => {
    const al = HOY_DE_LAS_METRICAS;
    const mapa = mapaDe(
      // Vencido desde el 30/11/2025, actualizado el 10/03 (la carga, el 09/03) hasta el 30/11/2026
      ds(901, { proxima: '2026-11-30', ultima: '2026-03-09' }, {
        cambios: [actualizacion(70, 901, { revisado: '2026-03-10 10:00:00', carga: '2026-03-09', de: '2025-11-30', a: '2026-11-30' })]
      }),
      // Vencido desde el 31/12/2025 y reprogramado el 02/02 al 31/12/2026: no se actualizó
      ds(902, { proxima: '2026-12-31' }, { cambios: [reprogramacion(71, 902, { revisado: '2026-02-02 10:00:00', de: '2025-12-31', a: '2026-12-31' })] }),
      // Vencido desde el 31/10/2025, una reprogramación y después la actualización: se actualizó
      ds(903, { proxima: '2027-01-31', ultima: '2026-06-01' }, {
        cambios: [
          reprogramacion(72, 903, { revisado: '2026-02-02 10:00:00', de: '2025-10-31', a: '2026-03-31' }),
          actualizacion(73, 903, { revisado: '2026-06-02 10:00:00', carga: '2026-06-01', de: '2026-03-31', a: '2027-01-31' })
        ]
      }),
      // Vencido desde el 30/09/2025 y sigue así
      ds(904, { proxima: '2025-09-30' }),
      // Vencía el 31/01/2026: al 1/1 estaba al día
      ds(905, { proxima: '2026-01-31' })
    );
    const antiguedad = antiguedadDeVencidos(mapa, { anio: 2026, al });
    assert.deepEqual(antiguedad.al_inicio, { total: 4, actualizados: 2 });
    assert.deepEqual([antiguedad.total, antiguedad.menos_de_3_meses, antiguedad.de_3_a_12, antiguedad.mas_de_un_anio], [2, 0, 1, 1]);
    // Una actualización aprobada después de al todavía no pasó: el 901 se cargó el 09/03, pero se aprobó el 10/03 (con el reloj del
    // RPAD, como el estado: Ruling 12)
    assert.deepEqual(antiguedadDeVencidos(mapa, { anio: 2026, al: '2026-03-08' }).al_inicio, { total: 4, actualizados: 0 });
    assert.deepEqual(antiguedadDeVencidos(mapa, { anio: 2026, al: '2026-03-09' }).al_inicio, { total: 4, actualizados: 0 });
    assert.deepEqual(antiguedadDeVencidos(mapa, { anio: 2026, al: '2026-03-10' }).al_inicio, { total: 4, actualizados: 1 });
    // Los textos: hoy, y los del 1/1 con los que ya se actualizaron
    assert.deepEqual(antiguedad.textos, { titulo: 'Hoy: 2 datasets vencidos', inicio: 'Al 1/1/2026 eran 4: de esos, 2 ya se actualizaron.' });
    assert.equal(antiguedadDeVencidos(mapa, { anio: 2026, al: '2026-03-10' }).textos.inicio, 'Al 1/1/2026 eran 4: de esos, 1 ya se actualizó.');
  });

  it('los textos de la antigüedad: hoy (o al 31/12), en singular, y sin vencidos', () => {
    // Con los casos reales al 24/10/2026
    assert.deepEqual(antiguedadDeVencidos(mapaDeLosCasos(), { anio: 2026, al: HOY_DE_LAS_METRICAS }).textos,
      { titulo: 'Hoy: 6 datasets vencidos', inicio: 'Al 1/1/2026 eran 3: de esos, 1 ya se actualizó.' });
    // Uno vencido desde el 30/11/2025 y actualizado el 10/03: al 1/1 era 1 y ya se actualizó; uno solo vencido hoy
    const uno = mapaDe(
      ds(901, { proxima: '2026-11-30', ultima: '2026-03-09' }, {
        cambios: [actualizacion(70, 901, { revisado: '2026-03-10 10:00:00', carga: '2026-03-09', de: '2025-11-30', a: '2026-11-30' })]
      }),
      ds(902, { proxima: '2026-09-30' })
    );
    assert.deepEqual(antiguedadDeVencidos(uno, { anio: 2026, al: HOY_DE_LAS_METRICAS }).textos,
      { titulo: 'Hoy: 1 dataset vencido', inicio: 'Al 1/1/2026 era 1: ya se actualizó.' });
    // Un año cerrado dice el 31/12; sin vencidos, lo dice
    assert.equal(antiguedadDeVencidos(uno, { anio: 2026 }).textos.titulo, 'Al 31/12/2026: 2 datasets vencidos');
    const ninguno = mapaDe(ds(903, { proxima: '2027-03-31' }));
    assert.deepEqual(antiguedadDeVencidos(ninguno, { anio: 2026, al: HOY_DE_LAS_METRICAS }).textos,
      { titulo: 'Hoy: ningún dataset vencido', inicio: 'Al 1/1/2026 no había datasets vencidos.' });
  });

  it('al 31/12, una carga del 30/12 aprobada el 05/01 todavía no se actualizó; aprobada el 30/12, sí (Ruling 12)', () => {
    // Los cuatro vencían el 30/11/2025 (al 1/1/2026 estaban vencidos) y se cargaron el 30/12/2026, hasta el 30/11/2027; cambia cuándo
    // se aprobó la actualización
    const cargadoEl3012 = (id, revisado) => ds(id, { proxima: '2027-11-30', ultima: '2026-12-30' }, {
      cambios: [actualizacion(id - 830, id, { revisado, carga: '2026-12-30', de: '2025-11-30', a: '2027-11-30' })]
    });
    const mapa = mapaDe(
      cargadoEl3012(901, '2027-01-05 10:00:00'), cargadoEl3012(902, '2026-12-30 18:00:00'), cargadoEl3012(903, '2026-12-31 23:59:59'),
      cargadoEl3012(904, '2027-01-01 00:00:00')
    );
    const foto = antiguedadDeVencidos(mapa, { anio: 2026, al: '2026-12-31' });
    assert.deepEqual(foto.al_inicio, { total: 4, actualizados: 2 });
    // Con el mismo reloj, los de enero todavía figuraban vencidos al 31/12, desde el 30/11/2025 (más de un año)
    assert.deepEqual([foto.total, foto.menos_de_3_meses, foto.de_3_a_12, foto.mas_de_un_anio], [2, 0, 0, 2]);
    assert.deepEqual(numerosDelPunto(indiceMesAMes(mapa, { anio: 2026, al: '2026-12-31' }).at(-1)), { dia: '2026-12-31', tasa: 50, al_dia: 2, base: 4 });
    // En enero de 2027 ya se habían aprobado las cuatro
    assert.equal(antiguedadDeVencidos(mapa, { anio: 2027, al: '2027-01-05' }).total, 0);
  });
});

describe('contextoDelAnio', () => {
  it('el índice, la antigüedad y los estados juntos, y «No hay datos para dibujar el índice.» solo si ningún punto tiene tasa', () => {
    const opciones = { anio: 2026, al: HOY_DE_LAS_METRICAS };
    const mapa = mapaDeLosCasos();
    assert.deepEqual(contextoDelAnio(mapa, opciones), {
      indice: indiceMesAMes(mapa, opciones), indice_vacio: null, antiguedad: antiguedadDeVencidos(mapa, opciones), estados: estadosAl(mapa, opciones)
    });
    assert.deepEqual(Object.keys(contextoDelAnio(mapa, opciones)), ['indice', 'indice_vacio', 'antiguedad', 'estados']);
    // Solo un eventual (ningún punto con tasa), o sin datasets: lo dice el servidor, y la página lo imprime (Ruling 19)
    const vacio = 'No hay datos para dibujar el índice.';
    assert.equal(contextoDelAnio(mapaDe(ds(904, { proxima: null, meses: null })), opciones).indice_vacio, vacio);
    assert.equal(contextoDelAnio(new Map(), opciones).indice_vacio, vacio);
    assert.equal(contextoDelAnio(null, {}).indice_vacio, vacio);
    // Con un punto con tasa, aunque otro no la tenga, se dibuja
    assert.equal(contextoDelAnio(mapaDe(ds(901, { proxima: '2026-12-31' })), opciones).indice_vacio, null);
  });
});

describe('trabajoDelAnio', () => {
  const trabajo = (mapa, casos = [], opciones = {}) => trabajoDelAnio(mapa, casos, { anio: 2026, al: HOY_DE_LAS_METRICAS, ...opciones });
  const ceros = () => Array(12).fill(0);
  // Qué es cada total, con 0 o con más de 1
  const TOTALES_EN_PLURAL = {
    avisos: 'avisos y notas a la DGMIT', actualizaciones: 'actualizaciones registradas', auditados: 'cambios auditados (doble verificación)',
    nuevos: 'datasets nuevos', fuente_publica: 'pedidos resueltos con una fuente pública'
  };

  it('trabajo: un email con tres datasets cuenta una vez y no cuenta si se destildan los tres', () => {
    const delAviso = email({ id: 950, tipo: 'externo-40', enviado: '2026-03-02 08:00:00' });
    const mapa = mapaDe(...[901, 902, 903].map((id) => ds(id, { proxima: '2026-04-30' }, { emails: [{ ...delAviso }] })));
    assert.equal(trabajo(mapa).avisos, 1);
    assert.deepEqual(trabajo(mapa).por_mes.avisos, [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(trabajo(mapa, [], { sin: [901, 902] }).avisos, 1);
    assert.equal(trabajo(mapa, [], { sin: [901, 902, 903] }).avisos, 0);
    assert.deepEqual(trabajo(mapa, [], { sin: [901, 902, 903] }).por_mes.avisos, ceros());
  });

  it('los avisos: emails a la DGMIT enviados y Notas Digitales de aviso y de reiteración enviadas, del año hasta al', () => {
    const avisos = [
      email({ id: 950, tipo: 'externo-vencido', enviado: '2026-01-02 08:00:00' }),
      email({ id: 951, tipo: 'interno-60', enviado: '2026-01-20 08:00:00' }),
      email({ id: 952, tipo: 'externo-40', enviado: '2026-02-10 08:00:00', success: false }), // no se pudo enviar
      email({ id: 953, tipo: 'area-aviso-40', enviado: '2026-02-11 08:00:00' }), // al área, no a la DGMIT
      email({ id: 954, tipo: 'externo-40', enviado: '2025-12-22 08:00:00' }), // del año anterior
      email({ id: 955, tipo: 'externo-5', enviado: '2026-10-25 08:00:00' }) // después de al
    ];
    const notas = [
      nota({ id: 960, tipo: 'aviso', fecha: '2026-10-15', enviada: '2026-10-15 08:15:00' }),
      nota({ id: 961, tipo: 'reiteracion', fecha: '2026-10-20', enviada: null, seccion: 'vencido' }), // sin el momento: el día de la nota
      nota({ id: 962, tipo: 'aviso', fecha: '2026-10-21', estado: 'fallida', enviada: null }), // no salió
      nota({ id: 963, tipo: 'aviso', fecha: '2026-10-22', estado: 'pendiente', enviada: null })
    ];
    // El mismo email y la misma nota en dos datasets cuentan una vez (también con el id en texto); un email y una nota con el mismo id
    // son dos avisos
    const mapa = mapaDe(
      ds(901, {}, { emails: avisos, notas }),
      ds(902, {}, { emails: [{ ...avisos[0], id: '950' }], notas: [{ ...notas[0], id: 950 }, { ...notas[1] }] })
    );
    const t = trabajo(mapa);
    assert.equal(t.avisos, 5);
    assert.deepEqual(t.por_mes.avisos, [2, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0]);
  });

  it('las actualizaciones, los pedidos resueltos con una fuente pública, los cambios auditados y los datasets nuevos', () => {
    const casos = [
      cerrado({ dataset_id: 901 }), // carga el 08/04
      cerrado({ dataset_id: 902, carga: '2026-04-20', cierre: '2026-04-20', origen: 'fuente_publica' }),
      cerrado({ dataset_id: 903, carga: '2026-05-04', cierre: '2026-05-04', origen: 'fuente_publica', requiere_nota: 0 }), // con «No», es lo normal
      cerrado({ dataset_id: 904, carga: '2026-05-04', cierre: '2026-05-04', origen: 'fuente_publica', requiere_nota: null }),
      cerrado({ dataset_id: 905, carga: '2025-12-17', cierre: '2025-12-17' }), // del año anterior
      cerrado({ dataset_id: 906, carga: '2026-10-25', cierre: '2026-10-25' }), // después de al
      caso({ dataset_id: 907, como: 'reprogramacion', abierto: false, cierre: '2026-04-06' }), // no es una actualización
      caso({ dataset_id: 908 }) // abierto
    ];
    const revisado = (id, datasetId, creado, revisadoEl, datos = {}) => cambio({ id, dataset_id: datasetId, creado, revisado: revisadoEl, ...datos });
    const mapa = mapaDe(
      ds(901, { alta: '2026-02-03 10:00:00' }, {
        cambios: [
          revisado(80, 901, '2026-03-02 10:00:00', '2026-03-02 10:03:00'),
          revisado(81, 901, '2026-03-05 10:00:00', '2026-03-05 10:05:00', { estado: 'rechazado' }), // rechazado: también se auditó
          revisado(82, 901, '2026-03-06 10:00:00', null, { estado: 'pendiente' }), // todavía no
          revisado(83, 901, '2025-12-30 10:00:00', '2025-12-30 10:01:00') // del año anterior
        ],
        // El alta, unida al dataset por la hora de la aprobación
        altasSinDataset: [revisado(84, null, '2026-02-03 09:58:00', '2026-02-03 10:00:02', { tipo: 'crear', nuevos: { titulo: 'Dataset 901' } })]
      }),
      ds(902, { alta: '2025-12-31 23:59:59' }, { cambios: [revisado(85, 902, '2026-01-31 23:00:00', '2026-02-01 00:30:00')] }),
      ds(903, { alta: '2026-10-25 10:00:00', activo: false }) // después de al
    );
    const t = trabajo(mapa, casos);
    assert.deepEqual([t.actualizaciones, t.fuente_publica, t.auditados, t.nuevos], [4, 2, 4, 1]);
    assert.deepEqual(t.por_mes.actualizaciones, [0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(t.por_mes.auditados, [0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(t.auditoria.n, 4);
    // Destildados, no cuentan
    const sin = trabajo(mapa, casos, { sin: [901, 902] });
    assert.deepEqual([sin.actualizaciones, sin.fuente_publica, sin.auditados, sin.nuevos], [2, 1, 0, 0]);
    assert.deepEqual(sin.auditoria, { valor: null, texto: '', n: 0 });
    // Un dataset dado de alta y de baja en el año también fue trabajo del año
    assert.equal(trabajo(mapa, [], { al: '2026-12-31' }).nuevos, 2);
  });

  it('auditoría en minutos y en horas', () => {
    // Cambios propuestos el 02/03/2026 a las 10:00 y revisados `m` minutos después
    const revisadoA = (m) => {
      const total = 600 + m;
      const dos = (n) => String(n).padStart(2, '0');
      return `2026-03-${dos(2 + Math.floor(total / 1440))} ${dos(Math.floor((total % 1440) / 60))}:${dos(total % 60)}:00`;
    };
    const conCambios = (minutos) => mapaDe(ds(901, {}, {
      cambios: minutos.map((m, i) => cambio({ id: 80 + i, dataset_id: 901, creado: '2026-03-02 10:00:00', revisado: revisadoA(m) }))
    }));
    const auditoria = (minutos, estadistico) => trabajo(conCambios(minutos), [], { estadistico }).auditoria;
    assert.deepEqual(auditoria([2, 3, 10]), { valor: 3, texto: 'mediana de 3 minutos', n: 3 });
    assert.deepEqual(auditoria([2, 3, 10], 'promedio'), { valor: 5, texto: 'promedio de 5 minutos', n: 3 });
    // Desde 120 minutos, en horas redondeadas: la mediana de 600 minutos son 10 horas; el promedio, 553, son 9
    assert.deepEqual(auditoria([60, 600, 1000]), { valor: 600, texto: 'mediana de 10 horas', n: 3 });
    assert.deepEqual(auditoria([60, 600, 1000], 'promedio'), { valor: 553, texto: 'promedio de 9 horas', n: 3 });
    assert.equal(auditoria([119]).texto, 'mediana de 119 minutos');
    assert.equal(auditoria([120]).texto, 'mediana de 2 horas');
    // De un día para el otro: 24 horas
    assert.equal(auditoria([1440]).texto, 'mediana de 24 horas');
    // Singular y menos de un minuto
    assert.equal(auditoria([1]).texto, 'mediana de 1 minuto');
    assert.equal(auditoria([0]).texto, 'mediana de menos de 1 minuto');
    // Con n par, el promedio de las dos del medio, como en el circuito
    assert.deepEqual(auditoria([2, 3]), { valor: 3, texto: 'mediana de 3 minutos', n: 2 });
    // Los segundos cuentan: 30 y 90 segundos dan una mediana de 1 minuto
    const segundos = mapaDe(ds(901, {}, {
      cambios: [
        cambio({ id: 80, dataset_id: 901, creado: '2026-03-02 10:00:00', revisado: '2026-03-02 10:00:30' }),
        cambio({ id: 81, dataset_id: 901, creado: '2026-03-02 10:00:00', revisado: '2026-03-02 10:01:30' })
      ]
    }));
    assert.deepEqual(trabajo(segundos).auditoria, { valor: 1, texto: 'mediana de 1 minuto', n: 2 });
    // Sin cambios auditados, sin valor
    assert.deepEqual(trabajo(mapaDe(ds(901))).auditoria, { valor: null, texto: '', n: 0 });
  });

  it('los textos del trabajo: cada total en singular o en plural, los meses hasta al y la doble verificación en una oración', () => {
    // Con los casos reales al 24/10/2026: 35 avisos, 9 actualizaciones, 19 auditados, 1 dataset nuevo y ninguna fuente pública
    const mapa = mapaDeLosCasos();
    const casos = casosDe(mapa, { hoy: HOY_DE_LAS_METRICAS });
    const real = trabajo(mapa, casos);
    assert.deepEqual(real.textos, {
      totales: { ...TOTALES_EN_PLURAL, nuevos: 'dataset nuevo' },
      meses: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct'],
      auditoria: 'Un cambio propuesto se audita en una mediana de 69 minutos (19 cambios).'
    });
    const promedio = trabajo(mapa, casos, { estadistico: 'promedio' });
    assert.equal(promedio.textos.auditoria, `Un cambio propuesto se audita en un ${promedio.auditoria.texto} (19 cambios).`);
    assert.match(promedio.auditoria.texto, /^promedio de \d+ (minutos|horas)$/);
    // Uno de cada uno: todo en singular
    const unoDeCada = mapaDe(ds(901, { alta: '2026-03-01 10:00:00' }, {
      emails: [email({ id: 950, tipo: 'externo-40', enviado: '2026-03-02 08:00:00' })],
      cambios: [cambio({ id: 80, dataset_id: 901, creado: '2026-03-02 10:00:00', revisado: '2026-03-02 10:03:00' })]
    }));
    const uno = trabajo(unoDeCada, [cerrado({ dataset_id: 901, origen: 'fuente_publica' })]);
    assert.deepEqual([uno.avisos, uno.actualizaciones, uno.auditados, uno.nuevos, uno.fuente_publica], [1, 1, 1, 1, 1]);
    assert.deepEqual(uno.textos.totales, {
      avisos: 'aviso o nota a la DGMIT', actualizaciones: 'actualización registrada', auditados: 'cambio auditado (doble verificación)',
      nuevos: 'dataset nuevo', fuente_publica: 'pedido resuelto con una fuente pública'
    });
    assert.equal(uno.textos.auditoria, 'Un cambio propuesto se audita en una mediana de 3 minutos (1 cambio).');
    // Sin cambios auditados, lo dice; los meses van hasta el de al (todo el año en uno cerrado)
    assert.equal(trabajo(mapaDe(ds(901))).textos.auditoria, 'Sin cambios auditados en 2026.');
    assert.equal(trabajo(mapaDe(ds(901)), [], { al: '2026-12-31' }).textos.meses.length, 12);
    assert.deepEqual(trabajo(mapaDe(ds(901)), [], { al: '2026-01-01' }).textos.meses, ['ene']);
  });

  it('con datos raros no tira, y no modifica las fuentes ni los casos', () => {
    const vacio = {
      avisos: 0, actualizaciones: 0, auditados: 0, nuevos: 0, fuente_publica: 0,
      por_mes: { avisos: ceros(), actualizaciones: ceros(), auditados: ceros() }, auditoria: { valor: null, texto: '', n: 0 },
      textos: {
        totales: TOTALES_EN_PLURAL, meses: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct'],
        auditoria: 'Sin cambios auditados en 2026.'
      }
    };
    for (const mapa of [null, undefined, 'x', {}, new Map([[1, null], [2, 'x'], [3, { dataset: null }]])]) {
      assert.deepEqual(trabajo(mapa, 'x'), vacio);
    }
    // Sin año, sin meses ni oración
    assert.deepEqual(trabajoDelAnio(mapaDe(ds(901)), [], {}), { ...vacio, textos: { totales: TOTALES_EN_PLURAL, meses: [], auditoria: '' } });
    // Lo que no se puede leer no cuenta: un email sin id, un envío sin fecha, una revisión en un mes que no existe; un cambio sin la
    // fecha de la propuesta se auditó, pero no se sabe cuánto tardó
    const raro = mapaDe(ds(901, { alta: 'x' }, {
      emails: [null, 'x', email({ id: 'x' }), email({ enviado: 'mal' })], notas: [null, nota({ fecha: 'x', enviada: null })],
      cambios: [null, cambio({ creado: 'x' }), cambio({ id: 81, revisado: '2026-13-01 10:00:00' })], altasSinDataset: 'x'
    }));
    const t = trabajo(raro, [null, 'x', cerrado({ carga: 'x' })]);
    assert.deepEqual([t.avisos, t.actualizaciones, t.auditados, t.nuevos, t.auditoria.n], [0, 0, 1, 0, 0]);
    const mapa = mapaDeLosCasos();
    const casos = casosDe(mapa, { hoy: HOY_DE_LAS_METRICAS });
    const antes = [structuredClone([...mapa.values()]), structuredClone(casos)];
    trabajo(mapa, casos, { sin: [52] });
    indiceMesAMes(mapa, { anio: 2026, al: HOY_DE_LAS_METRICAS });
    antiguedadDeVencidos(mapa, { anio: 2026, al: HOY_DE_LAS_METRICAS });
    areasYTemas(mapa, { al: HOY_DE_LAS_METRICAS });
    assert.deepEqual([[...mapa.values()], casos], antes);
  });
});

describe('areasYTemas', () => {
  it('el ranking usa la misma regla que Gestión: al día sobre los que tienen vencimiento, por área, con el null al final', () => {
    const al = HOY_DE_LAS_METRICAS;
    const mapa = mapaDe(
      ds(901, { area: 'Área Uno', proxima: '2027-03-31', tema_principal: 'Economía y Finanzas', frecuencia: 'Anualmente', meses: 12 }),
      ds(902, { area: 'Área Uno', proxima: '2026-11-30', tema_principal: 'Economía y Finanzas' }),
      ds(903, { area: 'Área Uno', proxima: '2026-09-30', tema_principal: 'Turismo y Deportes' }),
      ds(904, { area: 'Área Uno', proxima: null, meses: null, frecuencia: 'Eventual', tema_principal: 'Turismo y Deportes' }),
      ds(905, { area: 'Área Dos', proxima: null, tema_principal: null }),
      ds(906, { area: 'Área Tres', proxima: null, meses: null, frecuencia: 'Eventual', tema_principal: 'Economía y Finanzas' }),
      ds(907, { area: 'Área Cuatro', proxima: '2027-03-31', tema_principal: 'Economía y Finanzas' }),
      ds(908, { area: 'Área Cinco', proxima: '2026-12-31', tema_principal: 'Geografía y Territorio', frecuencia: 'Anualmente', meses: 12 }),
      ds(909, { area: 'Área Cinco', proxima: '2027-01-31', activo: false }), // inactivo: no cuenta
      ds(910, { area: 'Área Seis', proxima: '2027-01-31' }) // destildado
    );
    assert.deepEqual(areasYTemas(mapa, { al, sin: [910] }), {
      ranking: [
        { area: 'Área Cinco', total_datasets: 1, al_dia: 1, porcentaje: 100 },
        { area: 'Área Cuatro', total_datasets: 1, al_dia: 1, porcentaje: 100 },
        { area: 'Área Uno', total_datasets: 4, al_dia: 2, porcentaje: 67 },
        { area: 'Área Dos', total_datasets: 1, al_dia: 0, porcentaje: 0 },
        { area: 'Área Tres', total_datasets: 1, al_dia: 0, porcentaje: null }
      ],
      // Por cantidad y, en un empate, por nombre; los que no tienen tema no van
      temas: [['Economía y Finanzas', 4], ['Turismo y Deportes', 2], ['Geografía y Territorio', 1]],
      frecuencias: [['Cada medio año', 4], ['Anualmente', 2], ['Eventual', 2]],
      vacios: { temas: null, frecuencias: null }
    });
    // Sin temas (ninguno lo tiene), lo dice el servidor; la página lo imprime (Ruling 19)
    assert.deepEqual(areasYTemas(mapaDe(ds(905, { tema_principal: null })), { al }).vacios, { temas: 'Sin datasets.', frecuencias: null });
    assert.deepEqual(areasYTemas(mapa, { al }).ranking.map((a) => a.area),
      ['Área Cinco', 'Área Cuatro', 'Área Seis', 'Área Uno', 'Área Dos', 'Área Tres']);
    // Es la regla de Gestión (una sola: cumplimientoPorArea), con el estado de cada dataset que cuenta
    const filas = [...mapa.values()].filter((f) => f.dataset.activo !== false && f.dataset.id !== 910)
      .map((f) => ({ area: f.dataset.area, estado: estadoDelDataset({ proxima: f.dataset.proxima, meses: f.dataset.meses, tipoGestion: f.dataset.tipo_gestion, hoy: al }).estado }));
    assert.deepEqual(areasYTemas(mapa, { al, sin: [910] }).ranking, cumplimientoPorArea(filas).ranking);
  });

  it('con los casos reales, el ranking da lo mismo que la portada en cada área', () => {
    const al = HOY_DE_LAS_METRICAS;
    const mapa = mapaDeLosCasos();
    const { ranking } = areasYTemas(mapa, { al });
    assert.equal(ranking.length, new Set([...mapa.values()].map((f) => f.dataset.area)).size);
    for (const fila of ranking) {
      const delArea = new Map([...mapa].filter(([, f]) => f.dataset.area === fila.area));
      const portada = comoLaPortada(delArea, al);
      assert.deepEqual([fila.total_datasets, fila.al_dia, fila.porcentaje], [delArea.size, portada.alDia, portada.tasa], fila.area);
    }
    assert.ok(ranking.every((a, i) => i === 0 || (a.porcentaje ?? -1) <= (ranking[i - 1].porcentaje ?? -1)));
  });

  it('con datos raros no tira', () => {
    const nada = { ranking: [], temas: [], frecuencias: [], vacios: { temas: 'Sin datasets.', frecuencias: 'Sin datasets.' } };
    for (const mapa of [null, undefined, 'x', {}, new Map([[1, null], [2, { dataset: 'x' }]])]) {
      assert.deepEqual(areasYTemas(mapa, { al: HOY_DE_LAS_METRICAS }), nada);
      assert.deepEqual(indiceMesAMes(mapa, { anio: 2026, al: HOY_DE_LAS_METRICAS }).map((p) => p.base), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    }
    assert.deepEqual(areasYTemas(mapaDe(ds(901)), {}), nada);
    assert.deepEqual(indiceMesAMes(mapaDe(ds(901)), {}), []);
    assert.deepEqual(antiguedadDeVencidos(null, { anio: 2026 }), {
      total: 0, menos_de_3_meses: 0, de_3_a_12: 0, mas_de_un_anio: 0, al_inicio: { total: 0, actualizados: 0 },
      textos: { titulo: 'Al 31/12/2026: ningún dataset vencido', inicio: 'Al 1/1/2026 no había datasets vencidos.' }
    });
    assert.deepEqual(antiguedadDeVencidos(null, {}).textos, { titulo: '', inicio: '' });
    // Fechas que no se pueden leer: el dataset sin alta cuenta desde siempre; uno con la próxima mal escrita es sin fecha
    const raros = mapaDe(ds(901, { alta: null, proxima: '2026-12-31' }), ds(902, { proxima: '2026-02-30' }));
    assert.deepEqual(conCuentas(indiceMesAMes(raros, { anio: 2026, al: '2026-01-01' })), [['2026-01-01', 50, 1, 2]]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// etapasDe y conAnterior: el Ciclo de vida del dato (spec 2026-10-25-ciclo-de-vida-del-dato, 1 y 3.1)
// ---------------------------------------------------------------------------------------------------------------------

const etapas = (casos, opciones = {}) => etapasDe(casos, { anio: 2026, al: AL, ...opciones });
const etapaDe = (e, gestion, clave) => e[gestion].find((etapa) => etapa.clave === clave);
const todasLasEtapas = (e) => [...e.externa, ...e.interna];
// Los casos reales con dos notas DGMIT en el 52: una en su ciclo cerrado del 31/01/2026 (los datos llegaron el 02/02/2026) y otra en
// el abierto (con la respuesta en curso). Así la redacción y la respuesta tienen cifras
const casosConNotas = () => {
  const del52 = con(fuentesDelCaso(52, { importados: { 7: { recibido_el: '2026-02-02', origen_datos: 'area' } } }), {
    notasDgmit: [notaDgmit({ recibida: '2026-01-05' }), notaDgmit({ id: 2, numero: '90/26', tipo: 'reiteracion', recibida: '2026-07-10' })]
  });
  const otros = Object.keys(CASOS).filter((id) => Number(id) !== 52).map((id) => fuentesDelCaso(id));
  return casosDe(mapaDe(...otros, del52), { hoy: AL });
};
// Un caso cerrado con los datos recibidos y la carga que se pidan (la preparación y carga, de `recibido` a `carga`)
const conCarga = (titulo, id, recibido, carga) => cerrado({ titulo, dataset_id: id, recibido, carga, cierre: carga, aprobado: `${carga} 10:00:00` });
// Cinco ciclos con 0, 0, 0, 5 y 9 días hábiles en la carga
const CINCO = () => [
  conCarga('Zeta', 901, '2026-04-08', '2026-04-08'), // 0 hábiles y 0 corridos
  conCarga('Alfa', 902, '2026-04-10', '2026-04-12'), // del viernes al domingo: 0 hábiles y 2 corridos
  conCarga('Beta', 903, '2026-04-15', '2026-04-15'), // 0 y 0
  conCarga('Gama', 904, '2026-04-06', '2026-04-13'), // de lunes a lunes: 5 hábiles y 7 corridos
  conCarga('Delta', 905, '2026-04-06', '2026-04-17') // 9 hábiles y 11 corridos
];
const YA_VENCIDOS_DE_LA_ETAPA = {
  1: '1 ciclo se avisó cuando ya estaba vencido: no cuenta en esta etapa, y sus etapas siguientes se cuentan desde ese primer aviso.',
  2: '2 ciclos se avisaron cuando ya estaban vencidos: no cuentan en esta etapa, y sus etapas siguientes se cuentan desde ese primer aviso.'
};
// Los renglones de las notas de una etapa, cada uno con su tipo (el PDF pinta cada tipo a su modo)
const renglon = (tipo, texto) => ({ tipo, texto });
const ORIENTATIVO = renglon('orientativo', 'Con tan pocos casos, es orientativo.');
const enCursoDe = (texto) => renglon('en_curso', `En curso: ${texto}`);
const pendientesDe = (texto) => renglon('pendientes', texto);
const aclaracionDe = (texto) => renglon('aclaracion', texto);
// Ningún string dice null, undefined, NaN o Infinity, y ningún número es NaN ni infinito
const sinTextosRaros = (valor) => {
  recorrer(valor, 'etapas', (ruta, clave, v) => {
    if (typeof v === 'string') assert.doesNotMatch(v, /null|undefined|NaN|Infinity/, ruta);
    if (typeof v === 'number') assert.ok(Number.isFinite(v), ruta);
  });
};

describe('etapasDe: el Ciclo de vida del dato', () => {
  it('la forma: las dos gestiones con sus etapas en el orden del circuito, el número, los nodos y los datos del tramo', () => {
    const e = etapas(casosReales());
    assert.deepEqual(Object.keys(e), ['anio', 'al', 'externa', 'interna', 'aclaracion_de_la_hoja']);
    assert.deepEqual([e.anio, e.al], [2026, AL]);
    const datos = (etapa) => [etapa.clave, etapa.numero, etapa.nombre, etapa.desde_hasta, etapa.responsable, etapa.dgmit, etapa.nodos];
    assert.deepEqual(e.externa.map(datos), [
      ['aviso', 1, 'Aviso anticipado', 'Del aviso al vencimiento', 'DDPC', false, ['rpad', 'da']],
      ['tramite', 2, 'Redacción y entrega de nota', 'Del aviso a la nota en el área', 'DGMIT y DA', true, ['da', 'area']],
      ['respuesta', 3, 'Respuesta del área', 'De la nota a la entrega', 'Área', false, ['area', 'ddpc']],
      ['carga', 4, 'Preparación y carga', 'De la entrega a la carga', 'DDPC', false, ['ddpc', 'portal']]
    ]);
    assert.deepEqual(e.interna.map(datos), [
      ['aviso', 1, 'Aviso anticipado', 'Del aviso al vencimiento', 'DDPC', false, ['rpad', 'dit']],
      ['produccion', 2, 'Producción del relevamiento', 'Del aviso a la entrega', 'DGMIT y DIT', true, ['dit', 'ddpc']],
      ['carga', 3, 'Preparación y carga', 'De la entrega a la carga', 'DDPC', false, ['ddpc', 'portal']]
    ]);
    // Lo mismo que el circuito de Métricas
    const v = vista(casosReales());
    for (const gestion of ['externa', 'interna']) {
      assert.deepEqual(e[gestion].map((etapa) => [etapa.clave, etapa.nombre, etapa.desde_hasta, etapa.responsable, etapa.dgmit]),
        v.circuito[gestion].map((t) => [t.clave, t.nombre, t.desde_hasta, t.responsable, t.dgmit]));
    }
    for (const etapa of todasLasEtapas(e)) {
      assert.deepEqual(Object.keys(etapa), [
        'clave', 'numero', 'nombre', 'desde_hasta', 'responsable', 'dgmit', 'nodos', 'n', 'habiles', 'corridos', 'largo', 'corto', 'vacio', 'textos'
      ], etapa.clave);
      assert.deepEqual(Object.keys(etapa.textos), ['indice', 'mediana', 'promedio', 'ciclos', 'notas'], etapa.clave);
      if (etapa.largo !== null) {
        assert.deepEqual(Object.keys(etapa.largo), [
          'rotulo', 'habiles', 'corridos', 'dataset_id', 'titulo', 'mas', 'numero', 'unidad', 'corridos_texto', 'dataset_texto', 'mas_texto'
        ], etapa.clave);
      }
      // Cada renglón de las notas, con su tipo
      for (const nota of etapa.textos.notas) {
        assert.deepEqual(Object.keys(nota), ['tipo', 'texto'], etapa.clave);
        assert.ok(['orientativo', 'en_curso', 'pendientes', 'aclaracion'].includes(nota.tipo), etapa.clave);
        assert.notEqual(nota.texto, '', etapa.clave);
      }
    }
    // Con cifras: el aviso de las dos gestiones y la carga de la externa (la mediana de la carga es 0: «En el día», sin unidad ni corridos)
    const aviso = etapaDe(e, 'externa', 'aviso');
    assert.equal(aviso.n, 11);
    assert.deepEqual(aviso.habiles, { mediana: 27, promedio: aviso.habiles.promedio });
    assert.deepEqual(aviso.textos.indice, '27');
    assert.deepEqual(aviso.textos.mediana, { numero: '27', unidad: 'días hábiles', corridos: `${aviso.corridos.mediana} días corridos` });
    assert.deepEqual(aviso.textos.promedio, {
      numero: String(aviso.habiles.promedio), unidad: 'días hábiles', corridos: `(${aviso.corridos.promedio} días corridos)`
    });
    assert.equal(aviso.textos.ciclos, 'de 11 ciclos');
    const carga = etapaDe(e, 'externa', 'carga');
    assert.deepEqual([carga.n, carga.textos.indice, carga.textos.mediana, carga.textos.ciclos],
      [1, 'En el día', { numero: 'En el día', unidad: '', corridos: '' }, 'de 1 ciclo']);
    // Sin cifras: la raya en el índice
    const produccion = etapaDe(e, 'interna', 'produccion');
    assert.deepEqual([produccion.n, produccion.habiles, produccion.corridos, produccion.largo, produccion.corto, produccion.textos.indice],
      [0, null, null, null, null, '—']);
    assert.equal(produccion.textos.ciclos, '');
  });

  it('paridad con vistaDe: la mediana y el promedio de cada etapa, en hábiles y en corridos, son la cifra del tramo con todos los ciclos', () => {
    const juegos = [casosReales(), casosConNotas(), [...CINCO(), caso({ dataset_id: 906, nota_dgmit: notaDe('2026-03-10') })], []];
    // El segundo juego tiene cifras en las cuatro etapas de la externa: la paridad también se prueba en la redacción y en la respuesta
    assert.ok(etapas(juegos[1]).externa.every((etapa) => etapa.n > 0));
    for (const casos of juegos) {
      const e = etapas(casos);
      for (const dias of DIAS) {
        for (const estadistico of ESTADISTICOS) {
          const v = vistaDe(casos, { anio: 2026, al: AL, estadistico, dias, sin: [] });
          for (const gestion of ['externa', 'interna']) {
            assert.deepEqual(e[gestion].map((etapa) => etapa.clave), v.circuito[gestion].map((t) => t.clave));
            for (const etapa of e[gestion]) {
              const { cifra } = tramoDe(v, gestion, etapa.clave);
              const donde = `${gestion}, ${etapa.clave}, ${estadistico}, ${dias}`;
              if (cifra === null) {
                assert.equal(etapa.n, 0, donde);
                assert.equal(etapa.habiles, null, donde);
                assert.equal(etapa.corridos, null, donde);
              } else {
                assert.equal(etapa[dias][estadistico], cifra.valor, donde);
                assert.equal(etapa.n, cifra.ciclos, donde);
              }
            }
          }
        }
      }
    }
  });

  it('extremos y empates: el más largo y el más corto por días hábiles, con «y N más» y el desempate por corridos y por título', () => {
    const carga = etapaDe(etapas(CINCO()), 'externa', 'carga');
    assert.equal(carga.n, 5);
    assert.deepEqual(carga.habiles, { mediana: 0, promedio: 3 }); // [0, 0, 0, 5, 9]: 14 / 5 = 2,8
    assert.deepEqual(carga.corridos, { mediana: 2, promedio: 4 }); // [0, 0, 2, 7, 11]
    assert.deepEqual(carga.largo, {
      rotulo: 'El caso más largo', habiles: 9, corridos: 11, dataset_id: 905, titulo: 'Delta', mas: 0, numero: '9', unidad: 'días hábiles',
      corridos_texto: '11 días corridos', dataset_texto: 'Delta', mas_texto: ''
    });
    // Tres empatan en 0 días hábiles: se nombra el de menos corridos (Zeta y Beta, con 0) y, con empate, el primero por título (Beta)
    assert.deepEqual(carga.corto, {
      rotulo: 'El caso más corto', habiles: 0, corridos: 0, dataset_id: 903, titulo: 'Beta', mas: 2, numero: 'En el día', unidad: '',
      corridos_texto: '', dataset_texto: 'Beta y 2 más', mas_texto: ' y 2 más'
    });
    assert.ok(carga.corto.dataset_texto.endsWith(' y 2 más'));
    // El sufijo, aparte: el título y el sufijo son el texto del dataset (el PDF corta el título con «…» sin perder el sufijo)
    for (const extremo of [carga.largo, carga.corto]) assert.equal(`${extremo.titulo}${extremo.mas_texto}`, extremo.dataset_texto);
    assert.deepEqual(carga.textos.mediana, { numero: 'En el día', unidad: '', corridos: '' });
    assert.deepEqual(carga.textos.promedio, { numero: '3', unidad: 'días hábiles', corridos: '(4 días corridos)' });
    assert.equal(carga.textos.indice, 'En el día');
    assert.equal(carga.textos.ciclos, 'de 5 ciclos');
    // El más largo, con un empate en días hábiles, nombra el de más corridos: Épsilon tiene 9 hábiles y 12 corridos
    const conEmpate = etapaDe(etapas([...CINCO(), conCarga('Épsilon', 906, '2026-04-04', '2026-04-16')]), 'externa', 'carga');
    assert.deepEqual([conEmpate.largo.habiles, conEmpate.largo.corridos, conEmpate.largo.titulo, conEmpate.largo.mas, conEmpate.largo.dataset_texto],
      [9, 12, 'Épsilon', 1, 'Épsilon y 1 más']);
    assert.equal(conEmpate.largo.mas_texto, ' y 1 más');
    // Con los mismos días hábiles y corridos, el primero por título; el mismo dataset puede estar en dos ciclos
    const iguales = etapaDe(etapas([conCarga('Uno', 907, '2026-04-06', '2026-04-13'), conCarga('Dos', 908, '2026-04-06', '2026-04-13'),
      conCarga('Dos', 908, '2026-05-04', '2026-05-11')]), 'externa', 'carga');
    assert.deepEqual([iguales.largo.titulo, iguales.largo.mas, iguales.largo.dataset_texto, iguales.largo.mas_texto], ['Dos', 2, 'Dos y 2 más', ' y 2 más']);
    assert.deepEqual([iguales.corto.titulo, iguales.corto.mas, iguales.corto.dataset_texto, iguales.corto.mas_texto], ['Dos', 2, 'Dos y 2 más', ' y 2 más']);
  });

  it('el sufijo de los empates va aparte: « y N más» con un empate, vacío sin empate', () => {
    // Con un empate: los 15 ciclos de 0 días hábiles del ejemplo de la spec dan « y 14 más»
    const quince = Array.from({ length: 15 }, (_, i) => conCarga(`Dataset ${String(i + 1).padStart(2, '0')}`, 901 + i, '2026-04-08', '2026-04-08'));
    const corto = etapaDe(etapas([...quince, conCarga('Largo', 950, '2026-04-06', '2026-04-17')]), 'externa', 'carga').corto;
    assert.deepEqual([corto.titulo, corto.mas, corto.mas_texto, corto.dataset_texto], ['Dataset 01', 14, ' y 14 más', 'Dataset 01 y 14 más']);
    // Sin empate: vacío, y el texto del dataset es el título solo
    const largo = etapaDe(etapas([...quince, conCarga('Largo', 950, '2026-04-06', '2026-04-17')]), 'externa', 'carga').largo;
    assert.deepEqual([largo.titulo, largo.mas, largo.mas_texto, largo.dataset_texto], ['Largo', 0, '', 'Largo']);
    // El único caso, sin empate
    assert.equal(etapaDe(etapas([conCarga('Solo', 901, '2026-04-06', '2026-04-07')]), 'externa', 'carga').largo.mas_texto, '');
    // Un caso sin título: el sufijo no cambia
    const sinTitulo = etapaDe(etapas([conCarga(null, 901, '2026-04-08', '2026-04-08'), conCarga(null, 902, '2026-04-08', '2026-04-08')]), 'externa', 'carga');
    assert.deepEqual([sinTitulo.largo.titulo, sinTitulo.largo.mas_texto, sinTitulo.largo.dataset_texto], [null, ' y 1 más', 'Sin título y 1 más']);
  });

  it('nombres de los extremos: en el aviso, la anticipación; en las demás, el caso más largo y el más corto; con uno solo, «El único caso»', () => {
    const e = etapas(casosReales());
    const aviso = etapaDe(e, 'externa', 'aviso');
    assert.deepEqual([aviso.largo.rotulo, aviso.corto.rotulo], ['Con más anticipación', 'Con menos anticipación']);
    assert.ok(aviso.largo.habiles >= aviso.habiles.mediana && aviso.corto.habiles <= aviso.habiles.mediana);
    assert.deepEqual([etapaDe(e, 'interna', 'aviso').largo.rotulo, etapaDe(e, 'interna', 'aviso').corto.rotulo],
      ['Con más anticipación', 'Con menos anticipación']);
    const carga = etapaDe(etapas(CINCO()), 'externa', 'carga');
    assert.deepEqual([carga.largo.rotulo, carga.corto.rotulo], ['El caso más largo', 'El caso más corto']);
    // Un solo ciclo, en todas las etapas que lo cuentan: el aviso (27 días hábiles, 40 corridos) y la carga (1 día hábil, 1 corrido)
    const uno = etapas([conCarga('Solo', 901, '2026-04-06', '2026-04-07')]);
    assert.deepEqual(etapaDe(uno, 'externa', 'aviso').largo, {
      rotulo: 'El único caso', habiles: 27, corridos: 40, dataset_id: 901, titulo: 'Solo', mas: 0, numero: '27', unidad: 'días hábiles',
      corridos_texto: '40 días corridos', dataset_texto: 'Solo', mas_texto: ''
    });
    assert.equal(etapaDe(uno, 'externa', 'aviso').corto, null);
    const unaCarga = etapaDe(uno, 'externa', 'carga');
    assert.deepEqual(unaCarga.largo, {
      rotulo: 'El único caso', habiles: 1, corridos: 1, dataset_id: 901, titulo: 'Solo', mas: 0, numero: '1', unidad: 'día hábil',
      corridos_texto: '1 día corrido', dataset_texto: 'Solo', mas_texto: ''
    });
    assert.equal(unaCarga.corto, null);
    assert.deepEqual(unaCarga.textos.mediana, { numero: '1', unidad: 'día hábil', corridos: '1 día corrido' });
    assert.deepEqual(unaCarga.textos.promedio, { numero: '1', unidad: 'día hábil', corridos: '(1 día corrido)' });
    assert.equal(unaCarga.textos.ciclos, 'de 1 ciclo');
  });

  it('vacío: sin notas DGMIT, la redacción y la respuesta lo dicen; con notas y sin casos, «Sin casos en 2026»', () => {
    const casos = casosReales();
    const e = etapas(casos);
    const pendientes = tramoDe(vista(casos), 'externa', 'tramite').pendientes;
    assert.equal(pendientes, 7);
    const tramite = etapaDe(e, 'externa', 'tramite');
    assert.deepEqual(tramite.vacio, {
      titulo: 'Todavía no hay notas DGMIT cargadas', texto: `${pendientes} notas pendientes de carga`,
      pie: 'Se empieza a contar cuando se carguen en el Seguimiento.'
    });
    // Decisión del Ciclo de vida del dato: el vacío ya dice los pendientes, las notas no los repiten
    assert.deepEqual(tramite.textos.notas, []);
    assert.deepEqual(etapaDe(e, 'externa', 'respuesta').vacio, {
      titulo: 'Sin datos todavía', texto: 'Se empieza a contar cuando haya notas DGMIT cargadas.', pie: ''
    });
    assert.deepEqual(etapaDe(e, 'interna', 'carga').vacio, { titulo: 'Sin casos en 2026', texto: '', pie: '' });
    // Con cifras, sin vacío
    for (const etapa of todasLasEtapas(e)) assert.equal(etapa.vacio === null, etapa.n > 0, etapa.clave);
    // Con una nota DGMIT y sin casos terminados en la respuesta (está en curso), ni en las etapas de la interna
    const conNota = etapas([caso({ nota_dgmit: notaDe('2026-03-10') })]);
    assert.deepEqual(etapaDe(conNota, 'externa', 'respuesta').vacio, { titulo: 'Sin casos en 2026', texto: '', pie: '' });
    assert.deepEqual(etapaDe(conNota, 'externa', 'carga').vacio, { titulo: 'Sin casos en 2026', texto: '', pie: '' });
    for (const etapa of conNota.interna) assert.deepEqual(etapa.vacio, { titulo: 'Sin casos en 2026', texto: '', pie: '' });
    assert.equal(etapaDe(conNota, 'externa', 'tramite').vacio, null);
    // En otro año, su año
    assert.deepEqual(etapaDe(etapasDe([], { anio: 2027, al: '2027-03-01' }), 'interna', 'aviso').vacio, { titulo: 'Sin casos en 2027', texto: '', pie: '' });
  });

  it('vacío: sin ninguna nota pendiente, la redacción no dice «0 notas pendientes de carga» (Métricas sí, y no cambia)', () => {
    const sinNotasPendientes = { titulo: 'Todavía no hay notas DGMIT cargadas', texto: '', pie: 'Se empieza a contar cuando se carguen en el Seguimiento.' };
    const tramite = etapaDe(etapasDe([], { anio: 2026, al: AL }), 'externa', 'tramite');
    assert.deepEqual(tramite.vacio, sinNotasPendientes);
    assert.deepEqual(tramite.textos.notas, []);
    // Con casos que no son pendientes (un cerrado y uno con «Requiere nota» No): lo mismo
    assert.deepEqual(etapaDe(etapas([cerrado(), caso({ dataset_id: 901, requiere_nota: 0 })]), 'externa', 'tramite').vacio, sinNotasPendientes);
    // El circuito de Métricas sigue diciendo «0 notas pendientes de carga»
    assert.deepEqual(tramoDe(vista([]), 'externa', 'tramite').vacio, { titulo: 'Todavía no hay notas DGMIT cargadas', texto: '0 notas pendientes de carga' });
    // Con una, en singular
    assert.deepEqual(etapaDe(etapas([caso()]), 'externa', 'tramite').vacio,
      { ...sinNotasPendientes, texto: '1 nota pendiente de carga' });
  });

  it('nada desaparece: un bloque sin cifras lleva los en curso y las notas pendientes', () => {
    const casos = [caso({ nota_dgmit: notaDe('2026-03-10') })];
    const respuesta = etapaDe(etapas(casos), 'externa', 'respuesta');
    assert.equal(respuesta.n, 0);
    const enCurso = tramoDe(vista(casos), 'externa', 'respuesta').en_curso.texto;
    assert.match(enCurso, /^1 sin datos registrados todavía, hace \d+ días hábiles \(mediana\)$/);
    assert.deepEqual(respuesta.textos.notas, [enCursoDe(enCurso)]);
    assert.deepEqual(respuesta.textos.notas, [{ tipo: 'en_curso', texto: `En curso: ${enCurso}` }]);
    // El en curso es siempre el de días hábiles y mediana, el de tramoDelCircuito
    assert.equal(enCurso, `1 sin datos registrados todavía, hace ${duracion('2026-03-10', AL, 'habiles')} días hábiles (mediana)`);
    // La producción de la interna, con solo ciclos en curso (la de los casos reales)
    const produccion = etapaDe(etapas(casosReales()), 'interna', 'produccion');
    assert.deepEqual([produccion.n, produccion.textos.notas],
      [0, [{ tipo: 'en_curso', texto: 'En curso: 1 sin datos registrados todavía, hace 206 días hábiles (mediana)' }]]);
    // Con notas DGMIT cargadas, una redacción sin casos terminados en el año igual dice sus pendientes: uno con nota y sin el aviso que
    // empieza el tramo, y otro avisado y sin nota
    const sinCasos = etapas([
      caso({ dataset_id: 901, nota_dgmit: notaDe('2026-03-10'), aviso_regla: null, primer_aviso: null, inicio_tramos: null, avisos_rpad: [] }),
      caso({ dataset_id: 902 })
    ]);
    const tramite = etapaDe(sinCasos, 'externa', 'tramite');
    assert.deepEqual([tramite.n, tramite.vacio, tramite.textos.notas],
      [0, { titulo: 'Sin casos en 2026', texto: '', pie: '' }, [{ tipo: 'pendientes', texto: '1 nota pendiente de carga' }]]);
  });

  it('notas en orden: el orientativo, el en curso, los pendientes y la aclaración de la etapa', () => {
    const e = etapas(casosReales());
    // Los avisados ya vencidos van en el aviso anticipado de cada gestión (en la externa son 11 ciclos: no es orientativo)
    assert.deepEqual(etapaDe(e, 'externa', 'aviso').textos.notas, [aclaracionDe(YA_VENCIDOS_DE_LA_ETAPA[2])]);
    assert.deepEqual(etapaDe(e, 'interna', 'aviso').textos.notas, [ORIENTATIVO, aclaracionDe(YA_VENCIDOS_DE_LA_ETAPA[1])]);
    // Con su tipo, escrito a mano
    assert.deepEqual(etapaDe(e, 'interna', 'aviso').textos.notas, [
      { tipo: 'orientativo', texto: 'Con tan pocos casos, es orientativo.' },
      { tipo: 'aclaracion', texto: '1 ciclo se avisó cuando ya estaba vencido: no cuenta en esta etapa, y sus etapas siguientes se cuentan desde ese primer aviso.' }
    ]);
    // La misma cuenta que la aclaración de Métricas
    const v = vista(casosReales());
    assert.equal(v.circuito.aclaraciones.externa.ya_vencidos.n, 2);
    assert.equal(v.circuito.aclaraciones.interna.ya_vencidos.n, 1);
    assert.deepEqual(etapaDe(e, 'externa', 'carga').textos.notas, [ORIENTATIVO]);
    for (const etapa of todasLasEtapas(e)) {
      if (etapa.clave !== 'aviso' && etapa.clave !== 'produccion' && etapa.n === 0) assert.deepEqual(etapa.textos.notas, [], etapa.clave);
    }
    // Los resueltos con una fuente pública van en la respuesta, después del orientativo y del en curso
    const respuesta = (casos) => etapaDe(etapas(casos), 'externa', 'respuesta');
    const conTodo = [
      cerrado({ dataset_id: 901, nota_dgmit: notaDe('2026-03-10') }),
      caso({ dataset_id: 902, nota_dgmit: notaDe('2026-03-12') }),
      cerrado({ dataset_id: 903, nota_dgmit: notaDe('2026-03-10'), origen: 'fuente_publica' })
    ];
    const enCurso = tramoDe(vista(conTodo), 'externa', 'respuesta').en_curso.texto;
    assert.deepEqual(respuesta(conTodo).textos.notas, [
      ORIENTATIVO, enCursoDe(enCurso), aclaracionDe('1 ciclo se resolvió con datos de una fuente pública: no cuenta en esta etapa.')
    ]);
    const dos = [...conTodo, cerrado({ dataset_id: 904, nota_dgmit: notaDe('2026-03-11'), origen: 'fuente_publica' })];
    assert.deepEqual(respuesta(dos).textos.notas, [
      ORIENTATIVO, enCursoDe(enCurso), aclaracionDe('2 ciclos se resolvieron con datos de una fuente pública: no cuentan en esta etapa.')
    ]);
    assert.deepEqual(respuesta(dos).textos.notas.map((nota) => nota.tipo), ['orientativo', 'en_curso', 'aclaracion']);
    assert.equal(vista(dos).circuito.aclaraciones.externa.fuente_publica.n, 2);
    // Los pendientes van en la redacción con cifras, después del orientativo
    const conNotas = etapas(casosConNotas());
    const pendientes = tramoDe(vista(casosConNotas()), 'externa', 'tramite').pendientes_texto;
    assert.equal(pendientes, '6 notas pendientes de carga');
    assert.deepEqual(etapaDe(conNotas, 'externa', 'tramite').textos.notas, [ORIENTATIVO, pendientesDe(pendientes)]);
    assert.deepEqual(etapaDe(conNotas, 'externa', 'tramite').textos.notas,
      [{ tipo: 'orientativo', texto: 'Con tan pocos casos, es orientativo.' }, { tipo: 'pendientes', texto: '6 notas pendientes de carga' }]);
    // Con 5 ciclos o más, sin el orientativo
    assert.deepEqual(etapaDe(etapas(CINCO()), 'externa', 'carga').textos.notas, []);
  });

  it('aclaración de la hoja: la de los datasets que no requieren nota DGMIT, en la externa; la interna, vacía', () => {
    assert.deepEqual(etapas(casosReales()).aclaracion_de_la_hoja, { externa: '', interna: '' });
    for (const casos of [[caso({ requiere_nota: 0 }), cerrado()], [caso({ requiere_nota: 0 }), caso({ dataset_id: 901, requiere_nota: 0 })]]) {
      const texto = vista(casos).circuito.aclaraciones.externa.no_requieren_nota.texto;
      assert.notEqual(texto, '');
      assert.deepEqual(etapas(casos).aclaracion_de_la_hoja, { externa: texto, interna: '' });
    }
    assert.equal(etapas([caso({ requiere_nota: 0 })]).aclaracion_de_la_hoja.externa,
      '1 ciclo es de un dataset que no requiere nota DGMIT: cuenta solo en el aviso anticipado y en la carga.');
  });

  it('conAnterior: la mediana en días hábiles de la misma etapa del año anterior, o «Año anterior: no hay»', () => {
    const actual = etapas(casosConNotas());
    const copia = structuredClone(actual);
    const anteriores = {
      externa: [
        { clave: 'aviso', habiles: { mediana: 29, promedio: 31 } }, { clave: 'tramite', habiles: null },
        { clave: 'carga', habiles: { mediana: 0, promedio: 1 } }
      ],
      interna: [{ clave: 'aviso', habiles: { mediana: 1, promedio: 1 } }, { clave: 'carga', habiles: { mediana: 12, promedio: 12 } }]
    };
    const conElAnterior = conAnterior(actual, anteriores);
    const anterior = (gestion, clave) => etapaDe(conElAnterior, gestion, clave).textos.anterior;
    assert.equal(anterior('externa', 'aviso'), 'Año anterior: mediana de 29 días hábiles');
    assert.equal(anterior('externa', 'tramite'), 'Año anterior: no hay'); // sin cifra
    assert.equal(anterior('externa', 'respuesta'), 'Año anterior: no hay'); // la etapa no está
    assert.equal(anterior('externa', 'carga'), 'Año anterior: mediana en el día');
    assert.equal(anterior('interna', 'aviso'), 'Año anterior: mediana de 1 día hábil');
    assert.equal(anterior('interna', 'produccion'), 'Año anterior: no hay');
    // La comparación es por gestión: la carga interna no toma la externa
    assert.equal(anterior('interna', 'carga'), 'Año anterior: mediana de 12 días hábiles');
    // Puro: no cambia las etapas que recibe, y lo demás queda igual
    assert.deepEqual(actual, copia);
    for (const gestion of ['externa', 'interna']) {
      conElAnterior[gestion].forEach((etapa, i) => {
        const { anterior: _anterior, ...textos } = etapa.textos;
        assert.deepEqual({ ...etapa, textos }, copia[gestion][i]);
      });
    }
    assert.equal(conElAnterior.aclaracion_de_la_hoja, actual.aclaracion_de_la_hoja);
    // Sin año anterior, o con uno que no se puede leer, «no hay» en todas
    for (const nada of [null, undefined, 'x', {}, { externa: 'x', interna: [null, 3] }]) {
      for (const etapa of todasLasEtapas(conAnterior(actual, nada))) assert.equal(etapa.textos.anterior, 'Año anterior: no hay');
    }
    // Con otro resultado de etapasDe: la mediana de cada etapa con cifra
    for (const etapa of todasLasEtapas(conAnterior(actual, actual))) {
      const { habiles } = etapa;
      let esperado = 'Año anterior: no hay';
      if (habiles !== null) esperado = habiles.mediana === 0 ? 'Año anterior: mediana en el día' : `Año anterior: mediana de ${habiles.mediana} ${unidadDe(habiles.mediana)}`;
      assert.equal(etapa.textos.anterior, esperado, etapa.clave);
    }
    // Sin etapas, null; con algo raro, no tira
    assert.equal(conAnterior(null, anteriores), null);
    for (const raro of [undefined, 'x', 3, {}, { externa: [null, 'x'] }]) assert.doesNotThrow(() => conAnterior(raro, anteriores));
  });

  it('no tira: con casos raros da etapas vacías, sin año da null, y ningún texto dice undefined, null ni NaN', () => {
    for (const raro of [null, undefined, [], [{}], [null, 3, 'x', [], {}], 'x', {}, [{ gestion: 'interna', titulo: 3, venc: 'x', nota_dgmit: 'x' }]]) {
      const e = etapas(raro);
      assert.notEqual(e, null);
      assert.deepEqual(e.externa.map((etapa) => etapa.clave), ['aviso', 'tramite', 'respuesta', 'carga']);
      assert.deepEqual(e.interna.map((etapa) => etapa.clave), ['aviso', 'produccion', 'carga']);
      for (const etapa of todasLasEtapas(e)) {
        assert.deepEqual([etapa.n, etapa.habiles, etapa.corridos, etapa.largo, etapa.corto], [0, null, null, null, null]);
        assert.notEqual(etapa.vacio, null);
      }
      assert.deepEqual(e.aclaracion_de_la_hoja, { externa: '', interna: '' });
      sinTextosRaros(e);
      sinTextosRaros(conAnterior(e, e));
    }
    for (const opciones of [undefined, null, {}, 'x', 3, { anio: 'x' }, { anio: 2026, al: '2025-06-30' }]) {
      assert.equal(etapasDe(casosReales(), opciones), null);
    }
    assert.equal(etapasDe(), null);
    // Con un caso sin título, el extremo no dice null
    const sinTitulo = etapas([conCarga(null, 901, '2026-04-06', '2026-04-07')]);
    assert.equal(etapaDe(sinTitulo, 'externa', 'carga').largo.titulo, null);
    sinTextosRaros(sinTitulo);
    for (const casos of [casosReales(), casosConNotas(), CINCO()]) {
      sinTextosRaros(etapas(casos));
      sinTextosRaros(conAnterior(etapas(casos), etapas(casos)));
    }
  });
});

// El nombre de la etapa de la DGMIT y la Dirección Administrativa (28/10/2026): «Redacción y entrega de nota». La clave interna sigue
// siendo `tramite` (la foto del 31/12 y las cintas la usan), pero ningún texto que arma el servidor dice «trámite» (con tilde: así no se
// confunde con la clave)
describe('el nombre de la etapa de la DGMIT y la Dirección Administrativa', () => {
  it('ninguna etapa se llama «trámite»: el circuito, las cintas y el Ciclo de vida dicen «Redacción y entrega de nota»', () => {
    const NOMBRE = 'Redacción y entrega de nota';
    // Con notas DGMIT la etapa tiene cifras, y su segmento y su rótulo van en la cinta externa; sin notas, la cinta se corta antes
    for (const [casos, enLaCinta] of [[casosConNotas(), true], [casosReales(), false]]) {
      for (const dias of DIAS) {
        for (const estadistico of ESTADISTICOS) {
          const v = vistaDe(casos, { anio: 2026, al: AL, estadistico, dias, sin: [] });
          const donde = `${estadistico}, ${dias}`;
          const deLaVista = JSON.stringify(v);
          assert.doesNotMatch(deLaVista, /trámite/i, `la vista, ${donde}`);
          assert.ok(deLaVista.includes(NOMBRE), `la vista, ${donde}`);
          const cintas = cintasDeLaVista(v, { estadistico, dias });
          const deLasCintas = JSON.stringify(cintas);
          assert.doesNotMatch(deLasCintas, /trámite/i, `las cintas, ${donde}`);
          assert.equal(deLasCintas.includes(NOMBRE), enLaCinta, `las cintas, ${donde}`);
          if (enLaCinta) assert.ok(cintas.externa.segmentos.some((s) => s.texto.startsWith(`${NOMBRE} · `)), `${donde}: ${deLasCintas}`);
        }
      }
      const deLasEtapas = JSON.stringify(etapas(casos));
      assert.doesNotMatch(deLasEtapas, /trámite/i, 'las etapas');
      assert.ok(deLasEtapas.includes(NOMBRE), 'las etapas');
    }
    // Con la mediana en días hábiles, el rótulo también entra en el dibujo
    const cintas = cintasDeLaVista(vista(casosConNotas()), { estadistico: 'mediana', dias: 'habiles' });
    assert.ok(cintas.externa.rotulos.some((r) => r.texto.startsWith(`${NOMBRE} · `)), JSON.stringify(cintas.externa.rotulos));
  });
});
