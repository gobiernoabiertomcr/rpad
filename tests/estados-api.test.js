// Estados y tasa de actualización en el servidor (spec 2026-10-17-fechas-datasets, sección 11 y Ruling 22): un solo cálculo
// de estado (estadoDelDataset) para el listado, las estadísticas y los reportes PDF; los eventuales van aparte y no entran en
// la tasa del tablero, del Estado General ni del Cumplimiento (los tres dan el mismo número); los PDF suman "Datos al" donde
// listan la próxima. Contra una base de prueba propia, con un set controlado.
// El servidor usa siempre el hoy real (hoyArgentina): todas las fechas salen de hoy.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb } from './helpers.js';
import { crearArea, crearDataset } from './notas-fixtures.js';
import { lineasPorHoja } from './pdf-lector.js';
import { formatoCorto, hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';
import { estadoDelDataset, sumarMeses, vencimientoDelMes } from '../services/fechasDatasetReglas.js';

const HOY = hoyArgentina();

const titulo = (clave) => `Dataset ${clave}`;

// Meses de cada frecuencia que usa el set (null es eventual)
const MESES_DE = { Mensualmente: 1, Trimestralmente: 3, 'Cada medio año': 6, Anualmente: 12, Eventual: null };

// El set controlado de un día: 10 activos y 1 de baja, cada uno con el estado que tiene que dar ese día.
//   actualizados (3): vencen en 3 meses o más (siempre a más de 60 días: entre 89 y 92 de fin de mes a fin de mes)
//   próximo (1): vence dentro de 30 días, siempre entre 0 y 60. No sirve el fin del mes actual: el 29/02 de un año bisiesto
//     el fin de mes es el 28/02 (febrero va siempre en 28), que ya pasó, y el dataset figuraría atrasado. Tampoco el fin del
//     mes siguiente: el 1° de julio y de diciembre queda a 61 días
//   atrasado (1, gestión interna) y sin respuesta (1, gestión externa): vencieron hace 1 y 11 días
//   sin fecha (1): mensual sin próxima
//   eventuales (3): sin frecuencia en meses
// Área A tiene siete (sin el sin-fecha ni el tercer actualizado); el área B, dos; el área C, un eventual y nada más.
const armarSet = (hoy) => {
  const enMeses = (n) => sumarMeses(vencimientoDelMes(hoy), n);
  return [
    { clave: 'act1', area: 'A', frecuencia: 'Anualmente', gestion: 'externa', vencimiento: enMeses(12), datosAl: `${Number(hoy.slice(0, 4)) - 1}-12-31`, estado: 'actualizado' },
    { clave: 'act2', area: 'A', frecuencia: 'Trimestralmente', gestion: 'interna', vencimiento: enMeses(3), datosAl: enMeses(-1), estado: 'actualizado' },
    { clave: 'act3', area: 'B', frecuencia: 'Cada medio año', gestion: 'externa', vencimiento: enMeses(6), datosAl: enMeses(-2), estado: 'actualizado' },
    { clave: 'prox1', area: 'A', frecuencia: 'Mensualmente', gestion: 'interna', vencimiento: sumarDias(hoy, 30), datosAl: enMeses(-1), estado: 'proximo' },
    { clave: 'atras1', area: 'A', frecuencia: 'Mensualmente', gestion: 'interna', vencimiento: sumarDias(hoy, -1), datosAl: enMeses(-2), estado: 'atrasado' },
    { clave: 'sinresp1', area: 'A', frecuencia: 'Mensualmente', gestion: 'externa', vencimiento: sumarDias(hoy, -11), estado: 'sin-respuesta' },
    { clave: 'sinfecha1', area: 'B', frecuencia: 'Mensualmente', gestion: 'externa', vencimiento: null, estado: 'sin-fecha' },
    { clave: 'ev1', area: 'A', frecuencia: 'Eventual', gestion: 'externa', vencimiento: null, estado: 'eventual' },
    { clave: 'ev2', area: 'A', frecuencia: 'Eventual', gestion: 'interna', vencimiento: null, estado: 'eventual' },
    { clave: 'ev3', area: 'C', frecuencia: 'Eventual', gestion: 'externa', vencimiento: null, estado: 'eventual' },
    { clave: 'baja', area: 'A', frecuencia: 'Eventual', gestion: 'externa', vencimiento: null, activo: 0, estado: 'eventual' }
  ];
};
const SET = Object.fromEntries(armarSet(HOY).map(d => [d.clave, d]));

let base, servidor, api, usuarios, dbReal;
const areas = {};
const ids = {};

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_estados');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, { admin: 'admin' });
  for (const letra of ['A', 'B', 'C']) areas[letra] = await crearArea({ nombre: `Área ${letra}` });
  for (const { clave, area, estado, ...resto } of Object.values(SET)) {
    ids[clave] = await crearDataset({ titulo: titulo(clave), areaId: areas[area], ...resto });
  }
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

const admin = () => ({ token: usuarios.admin.token });
const estadisticas = async () => (await api.get('/datasets/estadisticas')).body.data;
const lista = async (filtro = '') => (await api.get(`/datasets${filtro}`)).body.data;
const clavesDe = (datasets) => datasets.map(d => d.titulo.replace('Dataset ', '')).sort();
const lineasDe = async (ruta) => {
  const res = await api.get(ruta, admin());
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/pdf/);
  return lineasPorHoja(res.body).flat();
};
// El valor de una tarjeta del PDF se dibuja justo antes de su rótulo
const valorDeTarjeta = (lineas, rotulo) => lineas[lineas.indexOf(rotulo) - 1];
// Las celdas de la fila de un dataset en una tabla del PDF: arrancan en su título
const filaDe = (lineas, clave, celdas) => lineas.slice(lineas.indexOf(titulo(clave)), lineas.indexOf(titulo(clave)) + celdas);
// La fila de un área en la tabla del Cumplimiento
const filaDeArea = (lineas, nombre) => lineas.slice(lineas.indexOf(nombre), lineas.indexOf(nombre) + 5);

describe('el set controlado da el mismo estado todos los días', () => {
  // El servidor usa el hoy real: el set tiene que dar lo que dice cada fila cualquier día del año, también el 29/02 de un
  // bisiesto y los días en que el fin del mes siguiente queda a más de 60 días
  it('cada dataset cae en su estado entre 2026 y 2032, día por día', () => {
    let dia = '2026-01-01';
    let dias = 0;
    while (dia <= '2032-12-31') {
      for (const d of armarSet(dia)) {
        const { estado } = estadoDelDataset({ proxima: d.vencimiento, meses: MESES_DE[d.frecuencia], tipoGestion: d.gestion, hoy: dia });
        assert.equal(estado, d.estado, `${dia}: ${d.clave}`);
      }
      dia = sumarDias(dia, 1);
      dias++;
    }
    assert.equal(dias, 2557);
  });

  it('en particular el 29/02/2028, el día en que el fin de mes ya pasó', () => {
    const prox = armarSet('2028-02-29').find(d => d.clave === 'prox1');
    assert.equal(estadoDelDataset({ proxima: prox.vencimiento, meses: 1, tipoGestion: 'interna', hoy: '2028-02-29' }).estado, 'proximo');
    assert.equal(estadoDelDataset({ proxima: vencimientoDelMes('2028-02-29'), meses: 1, tipoGestion: 'interna', hoy: '2028-02-29' }).estado, 'atrasado');
  });
});

describe('GET /datasets/estadisticas', () => {
  it('cuenta a los eventuales aparte: ya no son actualizados', async () => {
    const e = await estadisticas();
    assert.equal(e.total, 10);
    assert.equal(e.actualizados, 3);
    assert.equal(e.proximos, 1);
    assert.equal(e.atrasados, 1);
    assert.equal(e.sinRespuesta, 1);
    assert.equal(e.totalVencidos, 2);
    assert.equal(e.eventuales, 3);
    assert.equal(e.sinFecha, 1);
    // Todo dataset activo cae en una sola cuenta
    assert.equal(e.actualizados + e.proximos + e.atrasados + e.sinRespuesta + e.sinFecha + e.eventuales, e.total);
  });

  it('la tasa de actualización es (actualizados + próximos) sobre el total sin los eventuales', async () => {
    const e = await estadisticas();
    // (3 + 1) / (10 - 3) = 57 %. Contando a los eventuales como actualizados daría (3 + 1 + 3) / 10 = 70 %
    assert.equal(e.tasaActualizacion, Math.round(((3 + 1) / (10 - 3)) * 100));
    assert.equal(e.tasaActualizacion, 57);
  });

  it('el promedio de atraso sale de los días de los vencidos', async () => {
    // Venció hace 1 día el atrasado y hace 11 el sin respuesta: (1 + 11) / 2
    assert.equal((await estadisticas()).promedioAtraso, 6);
  });

  it('mantiene las demás claves de siempre', async () => {
    const e = await estadisticas();
    for (const clave of ['total', 'actualizados', 'proximos', 'atrasados', 'sinRespuesta', 'totalVencidos', 'tasaActualizacion', 'promedioAtraso', 'porTema', 'porFrecuencia']) {
      assert.ok(clave in e, clave);
    }
    assert.ok(Array.isArray(e.porTema) && Array.isArray(e.porFrecuencia));
  });

  it('no cuenta los datasets dados de baja', async () => {
    assert.equal((await estadisticas()).eventuales, 3);
  });
});

describe('GET /datasets?estado=', () => {
  it('eventual trae solo a los eventuales activos', async () => {
    const datasets = await lista('?estado=eventual');
    assert.deepEqual(clavesDe(datasets), ['ev1', 'ev2', 'ev3']);
    assert.ok(datasets.every(d => d.estado === 'eventual'));
  });

  it('actualizado ya no trae a los eventuales', async () => {
    const datasets = await lista('?estado=actualizado');
    assert.deepEqual(clavesDe(datasets), ['act1', 'act2', 'act3']);
    assert.ok(datasets.every(d => d.estado === 'actualizado'));
  });

  it('los demás estados traen lo que dice cada uno', async () => {
    assert.deepEqual(clavesDe(await lista('?estado=proximo')), ['prox1']);
    assert.deepEqual(clavesDe(await lista('?estado=atrasado')), ['atras1']);
    assert.deepEqual(clavesDe(await lista('?estado=sin-respuesta')), ['sinresp1']);
    assert.deepEqual(clavesDe(await lista('?estado=sin-fecha')), ['sinfecha1']);
  });

  it('sin filtro o con "todos" trae todos, y un estado que no existe no trae ninguno', async () => {
    assert.equal((await lista()).length, 10);
    assert.equal((await lista('?estado=todos')).length, 10);
    assert.equal((await lista('?estado=inexistente')).length, 0);
  });

  it('el filtro se combina con los otros filtros', async () => {
    assert.deepEqual(clavesDe(await lista('?estado=eventual&busqueda=ev2')), ['ev2']);
  });

  it('el estado de cada fila coincide con las estadísticas', async () => {
    const e = await estadisticas();
    const cuenta = (estado) => lista(`?estado=${estado}`).then(datasets => datasets.length);
    assert.equal(await cuenta('actualizado'), e.actualizados);
    assert.equal(await cuenta('proximo'), e.proximos);
    assert.equal(await cuenta('atrasado'), e.atrasados);
    assert.equal(await cuenta('sin-respuesta'), e.sinRespuesta);
    assert.equal(await cuenta('sin-fecha'), e.sinFecha);
    assert.equal(await cuenta('eventual'), e.eventuales);
  });
});

describe('reporte PDF de estado general', () => {
  let lineas;
  before(async () => { lineas = await lineasDe('/reportes/estado-general'); });

  it('la tasa deja afuera a los eventuales y lo aclara', async () => {
    assert.ok(lineas.includes('Tasa de actualización: 57%'));
    assert.ok(lineas.some(l => /3 datasets eventuales no entran en la tasa/.test(l)));
  });

  it('las tarjetas: los eventuales no son actualizados', async () => {
    assert.equal(valorDeTarjeta(lineas, 'Total Datasets'), '10');
    assert.equal(valorDeTarjeta(lineas, 'Actualizados'), '3');
    assert.equal(valorDeTarjeta(lineas, 'Próximos'), '1');
    assert.equal(valorDeTarjeta(lineas, 'Vencidos'), '2');
  });

  it('la tabla trae la columna "Datos al" junto a la próxima', async () => {
    assert.deepEqual(lineas.slice(lineas.indexOf('Título'), lineas.indexOf('Título') + 6),
      ['Título', 'Área', 'Frecuencia', 'Datos al', 'Próx. Act.', 'Estado']);
  });

  it('cada fila trae su "Datos al" y su próxima como dd/mm/aaaa, cortadas del texto', async () => {
    assert.deepEqual(filaDe(lineas, 'act1', 6),
      [titulo('act1'), 'Área A', 'Anualmente', formatoCorto(SET.act1.datosAl), formatoCorto(SET.act1.vencimiento), 'Actualizado']);
    assert.deepEqual(filaDe(lineas, 'prox1', 6),
      [titulo('prox1'), 'Área A', 'Mensualmente', formatoCorto(SET.prox1.datosAl), formatoCorto(SET.prox1.vencimiento), 'Próximo a vencer']);
    assert.deepEqual(filaDe(lineas, 'atras1', 6),
      [titulo('atras1'), 'Área A', 'Mensualmente', formatoCorto(SET.atras1.datosAl), formatoCorto(SET.atras1.vencimiento), 'Atrasado']);
  });

  it('un dataset sin "Datos al" lo muestra con un guion largo', async () => {
    assert.deepEqual(filaDe(lineas, 'sinresp1', 6),
      [titulo('sinresp1'), 'Área A', 'Mensualmente', '—', formatoCorto(SET.sinresp1.vencimiento), 'Sin respuesta']);
    assert.deepEqual(filaDe(lineas, 'sinfecha1', 6),
      [titulo('sinfecha1'), 'Área B', 'Mensualmente', '—', '—', 'Sin fecha']);
  });

  it('un eventual figura como Eventual, sin próxima', async () => {
    assert.deepEqual(filaDe(lineas, 'ev1', 6), [titulo('ev1'), 'Área A', 'Eventual', '—', '—', 'Eventual']);
  });
});

describe('reporte PDF por área', () => {
  let lineas;
  before(async () => { lineas = await lineasDe(`/reportes/por-area/${areas.A}`); });

  it('cada tarjeta trae "Datos al" junto a la próxima', async () => {
    assert.ok(lineas.includes(`Datos al: ${formatoCorto(SET.act1.datosAl)} Proxima actualizacion: ${formatoCorto(SET.act1.vencimiento)} Frecuencia de actualizacion: Anualmente`));
    // Sin "Datos al" sale con el guion largo
    assert.ok(lineas.includes(`Datos al: — Proxima actualizacion: ${formatoCorto(SET.sinresp1.vencimiento)} Frecuencia de actualizacion: Mensualmente`));
  });

  it('los eventuales van en su grupo, no entre los vencidos ni los actualizados', async () => {
    assert.ok(lineas.includes('Actualizados (2)'));
    assert.ok(lineas.includes('Próximos a vencer (1)'));
    assert.ok(lineas.includes('Vencidos (2)'));
    assert.ok(lineas.includes('Eventuales (2)'));
    assert.equal(valorDeTarjeta(lineas, 'Actualizados'), '2');
    assert.equal(valorDeTarjeta(lineas, 'Vencidos'), '2');
  });

  it('un eventual dice que no tiene fecha programada', async () => {
    assert.ok(lineas.includes('Datos al: — Sin fecha programada Frecuencia de actualizacion: Eventual'));
  });
});

describe('reporte PDF de cumplimiento (Ruling 22: los eventuales van aparte)', () => {
  let lineas;
  before(async () => { lineas = await lineasDe('/reportes/cumplimiento?periodo=mensual'); });

  it('los eventuales no cuentan como al día ni entran en el porcentaje, y figuran aparte como Eventuales (n)', async () => {
    // Al día: 3 actualizados + 1 próximo = 4, sobre los 10 menos los 3 eventuales: 4 / 7 = 57 %
    assert.equal(valorDeTarjeta(lineas, 'Total Datasets'), '10');
    assert.equal(valorDeTarjeta(lineas, 'Al día'), '4');
    assert.equal(valorDeTarjeta(lineas, '% Cumplimiento'), '57%');
    assert.ok(lineas.includes('Eventuales (3): no entran en el porcentaje porque no tienen fecha de vencimiento.'));
  });

  it('la tabla por área saca a los eventuales del porcentaje y los muestra en su columna', async () => {
    assert.deepEqual(lineas.slice(lineas.indexOf('Cumplimiento') - 4, lineas.indexOf('Cumplimiento') + 1),
      ['Área', 'Total', 'Al día', 'Eventuales', 'Cumplimiento']);
    // Área A: 3 al día de 7 con 2 eventuales = 3 / 5. Área B: 1 al día de 2 (el sin fecha cuenta: tiene frecuencia). Área C: solo un eventual
    assert.deepEqual(filaDeArea(lineas, 'Área A'), ['Área A', '7', '3', '2', '60%']);
    assert.deepEqual(filaDeArea(lineas, 'Área B'), ['Área B', '2', '1', '0', '50%']);
  });

  it('un área con solo eventuales no figura cumplida al 100 %: no tiene vencimientos', async () => {
    assert.deepEqual(filaDeArea(lineas, 'Área C'), ['Área C', '1', '0', '1', 'Sin vencimientos']);
    assert.ok(!lineas.includes('100%'));
  });

  it('las áreas con vencimientos van primero, de mayor a menor porcentaje', async () => {
    assert.ok(lineas.indexOf('Área A') < lineas.indexOf('Área B'));
    assert.ok(lineas.indexOf('Área B') < lineas.indexOf('Área C'));
  });
});

describe('la tasa es la misma en el tablero, el Estado General y el Cumplimiento', () => {
  it('los tres dan 57 %', async () => {
    const tablero = (await estadisticas()).tasaActualizacion;
    const general = (await lineasDe('/reportes/estado-general')).find(l => l.startsWith('Tasa de actualización: '));
    const cumplimiento = valorDeTarjeta(await lineasDe('/reportes/cumplimiento?periodo=mensual'), '% Cumplimiento');
    assert.equal(tablero, 57);
    assert.equal(general, `Tasa de actualización: ${tablero}%`);
    assert.equal(cumplimiento, `${tablero}%`);
  });
});

describe('Gestión, métricas (Ruling 23): la tasa de cumplimiento y el ranking de áreas dejan afuera a los eventuales', () => {
  let metricas;
  before(async () => {
    const res = await api.get('/gestion/metricas', admin());
    assert.equal(res.status, 200);
    metricas = res.body.data;
  });
  const area = (nombre) => metricas.ranking_areas.find(a => a.area === nombre);

  it('la tasa de cumplimiento es la misma que la del tablero: 57 %', async () => {
    // Con CURDATE() y los eventuales y el sin fecha como cumplidos daba (4 + 4) / 10 = 80 %
    assert.equal(metricas.tasa_cumplimiento, 57);
    assert.equal(metricas.tasa_cumplimiento, (await estadisticas()).tasaActualizacion);
  });

  it('cada área: los al día sobre lo que tiene vencimiento, como en el Cumplimiento', () => {
    // Área A: 3 al día de 7, con 2 eventuales: 3 / 5. Antes daba 5 / 7 = 71,4. Área B: 1 de 2 (el sin fecha no está al día)
    assert.deepEqual(area('Área A'), { area: 'Área A', total_datasets: 7, al_dia: 3, porcentaje: 60 });
    assert.deepEqual(area('Área B'), { area: 'Área B', total_datasets: 2, al_dia: 1, porcentaje: 50 });
  });

  it('un área con solo eventuales no figura al 100 %: no tiene nada que medir y su porcentaje es null', () => {
    assert.deepEqual(area('Área C'), { area: 'Área C', total_datasets: 1, al_dia: 0, porcentaje: null });
    assert.ok(metricas.ranking_areas.every(a => a.porcentaje !== 100));
  });

  it('el ranking va de mayor a menor porcentaje, con las áreas sin vencimientos al final', () => {
    assert.deepEqual(metricas.ranking_areas.map(a => a.area), ['Área A', 'Área B', 'Área C']);
  });

  it('la respuesta mantiene sus claves', () => {
    for (const clave of ['actualizados_por_mes', 'creados_por_mes', 'notificaciones_por_mes', 'cambios_por_mes', 'tiempo_promedio_aprobacion',
      'operador_mas_activo', 'distribucion_por_tema', 'distribucion_por_frecuencia', 'tasa_cumplimiento', 'ranking_areas']) {
      assert.ok(clave in metricas, clave);
    }
  });
});
