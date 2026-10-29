// La agenda de pedidos como datos (spec 2026-10-24-metricas-y-reportes, 5, punto 6; services/reportesAgenda.js): qué vence en los
// próximos 3, 6 o 12 meses, mes por mes, con los vencidos aparte y al principio, y el día aproximado del aviso del RPAD según la
// regla. Puro: los datasets se arman acá, sin base de datos (los nombres de las áreas y de los datasets son inventados).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { agendaDe, fechaDeAvisoPorRegla, opcionesDeAgenda, mesesDeLaAgenda } from '../services/reportesAgenda.js';
import { VENTANA_DIAS, proximoDiaHabil, sumarDias } from '../services/notasDigitalesCalendario.js';
import { pedido, tipoEfectivo, vencimientoDelMes } from '../services/fechasDatasetReglas.js';
import { calendarioCon } from '../services/feriadosReglas.js';
import { FILAS_PRECARGA } from './fixtures/feriados-precarga.js';

const HOY = '2026-10-25';
// El calendario con la precarga de 2026 y 2027 (spec 2026-10-27-feriados-en-notas, 5: la tanda 2): el lunes 02/11/2026 y el lunes
// 23/11/2026 son feriados de la tabla
const TABLA = calendarioCon(FILAS_PRECARGA);

// Un dataset activo como lo lee el controlador: el área por su nombre, la frecuencia con sus meses (null es eventual), la próxima
// actual, «Datos al», el tipo de pedido guardado (null: rige el sugerido) y «Requiere nota DGMIT» (1, 0 o null)
const dataset = (datos) => ({
  titulo: 'Dataset', area: 'Área de prueba', tipo_gestion: 'externa', frecuencia: 'Anualmente', frecuencia_meses: 12,
  proxima: '2027-01-31', datos_al: '2025-12-31', tipo_pedido: null, requiere_nota: 1, ...datos
});

// Vencidos: uno externo (sin respuesta del área, en el sitio) y uno interno (atrasado)
const VENCIDO_EXTERNO = dataset({ titulo: 'Comercios por rubro', area: 'Área Uno', proxima: '2026-01-31', datos_al: '2025-06-30' });
const VENCIDO_INTERNO = dataset({
  titulo: 'Paradas de colectivos', area: 'Área Dos', tipo_gestion: 'interna', frecuencia: 'Cada dos años', frecuencia_meses: 24,
  proxima: '2025-09-30', datos_al: '2023-09-30', requiere_nota: null
});
// Vence este mes (próximo a vencer): su aviso de la regla ya pasó, y se muestra igual
const DE_OCTUBRE = dataset({
  titulo: 'Empleados municipales', area: 'Área Tres', frecuencia: 'Cada medio año', frecuencia_meses: 6, proxima: '2026-10-31',
  datos_al: '2026-09-30', tipo_pedido: 'foto', requiere_nota: 0
});
// Vence en diciembre, interno: el aviso de la regla cae en domingo (01/11) y pasa al lunes
const DE_DICIEMBRE = dataset({
  titulo: 'Dependencias municipales', area: 'Área Cuatro', tipo_gestion: 'interna', proxima: '2026-12-31', requiere_nota: null
});
// Enero: tres con el mismo vencimiento, por área y después por título; uno trimestral acumulado (la frecuencia lleva «(Acumulado)»)
const ENERO_ZETA = dataset({ titulo: 'Zeta', area: 'Área A' });
const ENERO_ALFA = dataset({ titulo: 'Alfa', area: 'Área A', requiere_nota: 0 });
const ENERO_TRIMESTRAL = dataset({
  titulo: 'Pauta publicitaria', area: 'Área B', frecuencia: 'Trimestralmente', frecuencia_meses: 3, datos_al: '2026-07-31', requiere_nota: null
});
// Marzo, interno: el aviso cae en sábado (30/01/2027) y pasa al lunes
const DE_MARZO = dataset({
  titulo: 'Consulados', area: 'Área Cinco', tipo_gestion: 'interna', proxima: '2027-03-31', requiere_nota: null
});
// Abril de 2027: fuera de los 6 meses (sí entra en los 12)
const DE_ABRIL = dataset({ titulo: 'Establecimientos educativos', area: 'Área Seis', proxima: '2027-04-30', tipo_pedido: 'foto' });
// Ni los eventuales ni los sin fecha
const EVENTUAL = dataset({ titulo: 'Guía práctica', frecuencia: 'Eventual', frecuencia_meses: null, proxima: null, tipo_pedido: 'eventual' });
const SIN_FECHA = dataset({ titulo: 'Sin próxima', proxima: null });

const TODOS = [DE_ABRIL, ENERO_ZETA, VENCIDO_EXTERNO, DE_MARZO, EVENTUAL, DE_OCTUBRE, ENERO_TRIMESTRAL, SIN_FECHA, VENCIDO_INTERNO,
  DE_DICIEMBRE, ENERO_ALFA];

const titulos = (filas) => filas.map((f) => f.titulo);
const resumen = (agenda) => ({ vencidos: titulos(agenda.vencidos), meses: agenda.meses.map((m) => [m.mes, titulos(m.filas)]) });

describe('agendaDe', () => {
  it('agendaDe con 6 meses agrupa por mes y pone los vencidos aparte', () => {
    const agenda = agendaDe(TODOS, { hoy: HOY, meses: 6, gestion: 'ambas' });
    assert.deepEqual(Object.keys(agenda), ['vencidos', 'meses']);
    // Los vencidos, al principio y aparte, por vencimiento; cada mes, de octubre de 2026 a marzo de 2027, solo si tiene vencimientos
    // (noviembre y febrero no), por vencimiento, área y título; abril queda afuera y no van el eventual ni el sin fecha
    assert.deepEqual(resumen(agenda), {
      vencidos: ['Paradas de colectivos', 'Comercios por rubro'],
      meses: [
        ['2026-10', ['Empleados municipales']],
        ['2026-12', ['Dependencias municipales']],
        ['2027-01', ['Alfa', 'Zeta', 'Pauta publicitaria']],
        ['2027-03', ['Consulados']]
      ]
    });
  });

  it('cada fila: área, gestión, frecuencia de las notas, «Requiere nota DGMIT» en los externos, los datos solicitados y el aviso', () => {
    const agenda = agendaDe(TODOS, { hoy: HOY, meses: 6, gestion: 'ambas' });
    const fila = (titulo) => [...agenda.vencidos, ...agenda.meses.flatMap((m) => m.filas)].find((f) => f.titulo === titulo);
    assert.deepEqual(fila('Comercios por rubro'), {
      titulo: 'Comercios por rubro', area: 'Área Uno', gestion: 'externa', frecuencia: 'Anualmente', requiere_nota_texto: 'Sí',
      // Vencido: el pedido de hoy (R7, como la reiteración) y sin fecha de aviso (Ruling 27: el de la regla ya pasó)
      datos_solicitados: 'Del 01/01/2025 al 31/12/2025', aviso_aprox: null, vencimiento: '2026-01-31'
    });
    assert.deepEqual(fila('Paradas de colectivos'), {
      titulo: 'Paradas de colectivos', area: 'Área Dos', gestion: 'interna', frecuencia: 'Cada dos años', requiere_nota_texto: '',
      datos_solicitados: 'Relevamiento actualizado', aviso_aprox: null, vencimiento: '2025-09-30'
    });
    // Próximo a vencer: su aviso de la regla ya pasó (el 21/09/2026) y se muestra igual
    assert.deepEqual(fila('Empleados municipales'), {
      titulo: 'Empleados municipales', area: 'Área Tres', gestion: 'externa', frecuencia: 'Cada medio año', requiere_nota_texto: 'No',
      datos_solicitados: 'Vigente al 30/09/2026', aviso_aprox: '2026-09-21', vencimiento: '2026-10-31'
    });
    assert.equal(fila('Dependencias municipales').aviso_aprox, '2026-11-02');
    assert.equal(fila('Dependencias municipales').requiere_nota_texto, '');
    // Un acumulado trimestral: «(Acumulado)», como en las notas; sin dato de «Requiere nota DGMIT», la raya
    assert.deepEqual(fila('Pauta publicitaria'), {
      titulo: 'Pauta publicitaria', area: 'Área B', gestion: 'externa', frecuencia: 'Trimestralmente (Acumulado)', requiere_nota_texto: '—',
      datos_solicitados: 'Del 01/01/2026 al 31/12/2026', aviso_aprox: '2026-12-22', vencimiento: '2027-01-31'
    });
    assert.equal(fila('Consulados').aviso_aprox, '2027-02-01');
  });

  it('los datos solicitados son el pedido de GET /datasets (pedido con hoy y el tipo efectivo), también en un vencido', () => {
    const agenda = agendaDe(TODOS, { hoy: HOY, meses: 12, gestion: 'ambas' });
    const filas = [...agenda.vencidos, ...agenda.meses.flatMap((m) => m.filas)];
    for (const d of TODOS.filter((d) => d.proxima !== null && d.frecuencia_meses !== null)) {
      const tipo = tipoEfectivo({ tipo_pedido: d.tipo_pedido, tipo_gestion: d.tipo_gestion, meses: d.frecuencia_meses });
      const esperado = pedido({ vencimiento: d.proxima, tipo, datosAl: d.datos_al, meses: d.frecuencia_meses, hoy: HOY }).texto;
      assert.equal(filas.find((f) => f.titulo === d.titulo).datos_solicitados, esperado, d.titulo);
    }
  });

  it('con 3 meses llega a diciembre; con 12, a septiembre de 2027 (abril entra)', () => {
    assert.deepEqual(resumen(agendaDe(TODOS, { hoy: HOY, meses: 3, gestion: 'ambas' })).meses,
      [['2026-10', ['Empleados municipales']], ['2026-12', ['Dependencias municipales']]]);
    assert.deepEqual(resumen(agendaDe(TODOS, { hoy: HOY, meses: 12, gestion: 'ambas' })).meses.map(([mes]) => mes),
      ['2026-10', '2026-12', '2027-01', '2027-03', '2027-04']);
    assert.deepEqual(mesesDeLaAgenda(HOY, 3), ['2026-10', '2026-11', '2026-12']);
    assert.deepEqual(mesesDeLaAgenda('2026-12-31', 3), ['2026-12', '2027-01', '2027-02']);
  });

  it('con una gestión, solo los de esa gestión (también entre los vencidos)', () => {
    assert.deepEqual(resumen(agendaDe(TODOS, { hoy: HOY, meses: 6, gestion: 'externa' })), {
      vencidos: ['Comercios por rubro'],
      meses: [['2026-10', ['Empleados municipales']], ['2027-01', ['Alfa', 'Zeta', 'Pauta publicitaria']]]
    });
    assert.deepEqual(resumen(agendaDe(TODOS, { hoy: HOY, meses: 6, gestion: 'interna' })), {
      vencidos: ['Paradas de colectivos'],
      meses: [['2026-12', ['Dependencias municipales']], ['2027-03', ['Consulados']]]
    });
  });

  it('con el calendario que recibe, el aviso aproximado cuenta los feriados de la tabla; lo demás no cambia', () => {
    const filas = (opciones) => agendaDe(TODOS, { hoy: HOY, meses: 6, gestion: 'ambas', ...opciones }).meses.flatMap((m) => m.filas);
    const fila = (opciones) => filas(opciones).find((f) => f.titulo === 'Dependencias municipales');
    // Interno del 31/12/2026: la regla cae el domingo 01/11 y el lunes 02/11 es feriado de la tabla, así que el aviso sale el martes 03/11
    assert.equal(fila({ calendario: TABLA }).aviso_aprox, '2026-11-03');
    // Sin el calendario (o con null), los 9 fijos, como siempre
    assert.equal(fila({}).aviso_aprox, '2026-11-02');
    assert.equal(fila({ calendario: null }).aviso_aprox, '2026-11-02');
    const sinElAviso = (lista) => lista.map(({ aviso_aprox: _aviso, ...resto }) => resto);
    assert.deepEqual(sinElAviso(filas({ calendario: TABLA })), sinElAviso(filas({})));
  });

  it('el estado es el de estadoDelDataset: el día del vencimiento todavía es un próximo, no un vencido', () => {
    const agenda = agendaDe([DE_OCTUBRE], { hoy: '2026-10-31', meses: 6, gestion: 'ambas' });
    assert.deepEqual(resumen(agenda), { vencidos: [], meses: [['2026-10', ['Empleados municipales']]] });
    const alDiaSiguiente = agendaDe([DE_OCTUBRE], { hoy: '2026-11-01', meses: 6, gestion: 'ambas' });
    assert.deepEqual(resumen(alDiaSiguiente), { vencidos: ['Empleados municipales'], meses: [] });
    assert.equal(alDiaSiguiente.vencidos[0].aviso_aprox, null);
  });

  it('los vencidos van por vencimiento, área y título', () => {
    const vencidos = [
      dataset({ titulo: 'C', area: 'Área Z', proxima: '2026-01-31' }), dataset({ titulo: 'B', area: 'Área A', proxima: '2026-01-31' }),
      dataset({ titulo: 'A', area: 'Área A', proxima: '2026-01-31' }), dataset({ titulo: 'D', area: 'Área A', proxima: '2025-07-31' })
    ];
    assert.deepEqual(titulos(agendaDe(vencidos, { hoy: HOY, meses: 6, gestion: 'ambas' }).vencidos), ['D', 'A', 'B', 'C']);
  });

  it('sin nada que mostrar, las dos listas vacías; con datos raros o un hoy que no es una fecha, no tira', () => {
    assert.deepEqual(agendaDe([], { hoy: HOY, meses: 6, gestion: 'ambas' }), { vencidos: [], meses: [] });
    assert.deepEqual(agendaDe([EVENTUAL, SIN_FECHA, DE_ABRIL], { hoy: HOY, meses: 6, gestion: 'ambas' }), { vencidos: [], meses: [] });
    assert.deepEqual(agendaDe(TODOS, { hoy: 'ayer', meses: 6, gestion: 'ambas' }), { vencidos: [], meses: [] });
    assert.deepEqual(agendaDe(null, { hoy: HOY }), { vencidos: [], meses: [] });
    assert.deepEqual(agendaDe([null, 'x', 3, [], { proxima: '2027-02-30', frecuencia_meses: 12 }], { hoy: HOY }), { vencidos: [], meses: [] });
    // Sin las opciones, las de entrada: 6 meses y las dos gestiones
    assert.deepEqual(resumen(agendaDe(TODOS, { hoy: HOY })), resumen(agendaDe(TODOS, { hoy: HOY, meses: 6, gestion: 'ambas' })));
    assert.deepEqual(resumen(agendaDe(TODOS, { hoy: HOY, meses: 7, gestion: 'otra' })), resumen(agendaDe(TODOS, { hoy: HOY })));
  });
});

describe('fechaDeAvisoPorRegla', () => {
  // La regla del aviso: 40 días corridos antes del vencimiento en gestión externa y 60 en interna (VENTANA_DIAS del calendario, la de
  // las Notas Digitales: Ruling 30), y si ese día no es hábil, el hábil siguiente (proximoDiaHabil: el mismo día, si es hábil)
  it('fechaDeAvisoPorRegla del 31/01/2027 externo cae el 22/12/2026 (hábil: el mismo día)', () => {
    // El 22/12/2026 (31/01/2027 menos 40 días) es martes, un día hábil: es ese mismo día
    assert.equal(fechaDeAvisoPorRegla('2027-01-31', 'externa'), '2026-12-22');
    // Interna, 60 días: el 01/11/2026 es domingo y pasa al lunes 02/11
    assert.equal(fechaDeAvisoPorRegla('2026-12-31', 'interna'), '2026-11-02');
    // Un feriado fijo: el 25/12/2026 es viernes; el hábil siguiente, el lunes 28/12
    assert.equal(fechaDeAvisoPorRegla('2027-02-03', 'externa'), '2026-12-28');
  });

  it('usa la ventana del calendario, la de las Notas Digitales: cada fin de mes de 2027, en las dos gestiones', () => {
    // Sin el calendario, con los 9 fijos; con la tabla, el día hábil siguiente de la tabla
    for (const [calendario, siguienteHabil] of [[undefined, proximoDiaHabil], [TABLA, TABLA.proximoDiaHabil]]) {
      for (const gestion of ['externa', 'interna']) {
        for (let mes = 1; mes <= 12; mes += 1) {
          const vencimiento = vencimientoDelMes(`2027-${String(mes).padStart(2, '0')}-01`);
          assert.equal(fechaDeAvisoPorRegla(vencimiento, gestion, calendario), siguienteHabil(sumarDias(vencimiento, -VENTANA_DIAS[gestion])),
            `${calendario?.origen ?? 'fijos'} ${gestion} ${vencimiento}`);
        }
      }
    }
  });

  it('con el calendario que recibe: un feriado de la tabla corre el aviso al día hábil siguiente', () => {
    // Interna: el domingo 01/11/2026 pasa al martes 03/11 (el lunes 02/11 es feriado); externa: el sábado 21/11 pasa al martes 24/11 (el
    // lunes 23/11 es el Día de la Soberanía Nacional)
    assert.equal(fechaDeAvisoPorRegla('2026-12-31', 'interna', TABLA), '2026-11-03');
    assert.equal(fechaDeAvisoPorRegla('2026-12-31', 'externa', TABLA), '2026-11-24');
    // Sin el calendario, o con null, los 9 fijos
    assert.equal(fechaDeAvisoPorRegla('2026-12-31', 'interna'), '2026-11-02');
    assert.equal(fechaDeAvisoPorRegla('2026-12-31', 'externa'), '2026-11-23');
    assert.equal(fechaDeAvisoPorRegla('2026-12-31', 'interna', null), '2026-11-02');
    // Con una fecha o una gestión que no sirven, null también con la tabla
    assert.equal(fechaDeAvisoPorRegla('2026-02-30', 'interna', TABLA), null);
    assert.equal(fechaDeAvisoPorRegla('2026-12-31', 'otra', TABLA), null);
  });

  it('con una fecha o una gestión que no sirven, null', () => {
    for (const [vencimiento, gestion] of [['2027-02-30', 'externa'], [null, 'externa'], ['31/01/2027', 'externa'], ['2027-01-31', 'otra'],
      ['2027-01-31', undefined], ['2027-01-31', 'toString']]) {
      assert.equal(fechaDeAvisoPorRegla(vencimiento, gestion), null, `${vencimiento} ${gestion}`);
    }
  });
});

describe('opcionesDeAgenda', () => {
  it('?meses=7 cae a 6', () => {
    assert.deepEqual(opcionesDeAgenda({ meses: '7' }), { meses: 6, gestion: 'ambas' });
    for (const meses of ['3', '6', '12']) assert.equal(opcionesDeAgenda({ meses }).meses, Number(meses), meses);
    for (const meses of [3, 6, 12]) assert.equal(opcionesDeAgenda({ meses }).meses, meses, String(meses));
    // Lo que no es 3, 6 ni 12 (también un parámetro repetido, que llega como lista), 6
    for (const meses of ['0', '-3', '03', '6.0', ' 6', '', 'doce', 7, 3.5, ['3', '12'], null, undefined, {}]) {
      assert.equal(opcionesDeAgenda({ meses }).meses, 6, JSON.stringify(meses));
    }
  });

  it('una gestión que no es externa, interna ni ambas cae a las dos', () => {
    for (const gestion of ['externa', 'interna', 'ambas']) assert.equal(opcionesDeAgenda({ gestion }).gestion, gestion);
    for (const gestion of ['EXTERNA', 'otra', '', ['externa'], null, undefined, 1, 'toString']) {
      assert.equal(opcionesDeAgenda({ gestion }).gestion, 'ambas', JSON.stringify(gestion));
    }
    assert.deepEqual(opcionesDeAgenda(undefined), { meses: 6, gestion: 'ambas' });
    assert.deepEqual(opcionesDeAgenda({ meses: '12', gestion: 'externa' }), { meses: 12, gestion: 'externa' });
  });
});
