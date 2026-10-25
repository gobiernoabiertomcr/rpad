// Estados y tasa de actualización en el servidor (spec 2026-10-17-fechas-datasets, sección 11 y Ruling 22): un solo cálculo
// de estado (estadoDelDataset) para el listado, las estadísticas y los reportes PDF; los eventuales van aparte y no entran en
// la tasa de la portada, del Estado General ni de Métricas (las tres dan el mismo número: spec 2026-10-24-metricas-y-reportes, 5);
// los PDF suman "Datos al" donde listan la próxima, y el Por área suma una hoja del Seguimiento por dataset activo. Al final, el
// reporte Avisos del RPAD, con emails y Notas Digitales de un período fijo. Contra una base de prueba propia, con un set controlado.
// El servidor usa siempre el hoy real (hoyArgentina): todas las fechas salen de hoy.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { crearArea, crearDataset, crearNota } from './notas-fixtures.js';
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

  it('los eventuales tienen su tarjeta: con los sin fecha, las tarjetas suman el total', async () => {
    assert.equal(valorDeTarjeta(lineas, 'Eventuales'), '3');
  });

  it('los sin fecha se aclaran debajo: cuentan en la tasa como no al día', async () => {
    assert.ok(lineas.includes('1 dataset todavía no tiene fecha de próxima actualización: cuenta en la tasa como no al día.'));
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

// El reporte por área (spec 2026-10-24-metricas-y-reportes, 5): la portada, con un renglón por dataset en su grupo («Título · Datos al:
// dd/mm/aaaa · Próxima: dd/mm/aaaa»), y detrás una hoja del Seguimiento por cada dataset activo. El área A tiene siete activos y uno
// dado de baja.
describe('reporte PDF por área', () => {
  let res, hojas, portada, lineas;
  before(async () => {
    res = await api.get(`/reportes/por-area/${areas.A}`, admin());
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/pdf/);
    hojas = lineasPorHoja(res.body);
    [portada] = hojas;
    lineas = hojas.flat();
  });
  // La lista de la portada, y el orden de las hojas: los vencidos, el próximo, los actualizados y los eventuales; en cada grupo, por
  // próxima (los eventuales, sin próxima, por título)
  const ORDEN = ['sinresp1', 'atras1', 'prox1', 'act2', 'act1', 'ev1', 'ev2'];
  const renglonDe = (clave) => `${titulo(clave)} · Datos al: ${SET[clave].datosAl ? formatoCorto(SET[clave].datosAl) : '—'} · Próxima: ${SET[clave].vencimiento ? formatoCorto(SET[clave].vencimiento) : '—'}`;

  it('1 portada + N hojas, una por dataset activo; uno dado de baja no tiene hoja', () => {
    assert.equal(hojas.length, 1 + 7);
    // Cada hoja, la del Seguimiento de su dataset, en el orden de la lista
    ORDEN.forEach((clave, k) => {
      const hoja = hojas[k + 1];
      assert.ok(hoja.includes('Seguimiento del dataset') && hoja.includes(titulo(clave)), `hoja ${k + 2}: ${hoja.join(' | ')}`);
      assert.deepEqual(ORDEN.filter(otra => hoja.includes(titulo(otra))), [clave], `hoja ${k + 2}`);
    });
    // El dado de baja no está ni en la portada ni en una hoja
    assert.ok(!lineas.some(l => l.includes(titulo('baja'))));
  });

  it('el pie dice «Reporte por área · Hoja k de N» en todas, con quién lo generó', () => {
    hojas.forEach((hoja, k) => {
      assert.ok(hoja.includes(`Reporte por área · Hoja ${k + 1} de ${hojas.length}`), `hoja ${k + 1}: ${hoja.join(' | ')}`);
      assert.ok(hoja.some(l => /^Generado el \d{2}\/\d{2}\/\d{4} a las \d{2}:\d{2} por Test admin$/.test(l)), `hoja ${k + 1}`);
    });
  });

  it('la portada agrupa como antes: los eventuales van en su grupo, no entre los vencidos ni los actualizados', () => {
    assert.ok(portada.includes('Actualizados (2)'));
    assert.ok(portada.includes('Próximos a vencer (1)'));
    assert.ok(portada.includes('Vencidos (2)'));
    assert.ok(portada.includes('Eventuales (2)'));
    assert.equal(valorDeTarjeta(portada, 'Total Datasets'), '7');
    assert.equal(valorDeTarjeta(portada, 'Actualizados'), '2');
    assert.equal(valorDeTarjeta(portada, 'Próximos'), '1');
    assert.equal(valorDeTarjeta(portada, 'Vencidos'), '2');
    assert.equal(valorDeTarjeta(portada, 'Eventuales'), '2');
    // Sin datasets sin fecha no hay aclaración
    assert.ok(!lineas.some(l => /todavía no tiene/.test(l)));
  });

  it('cada renglón trae "Datos al" junto a la próxima, dd/mm/aaaa, cortadas del texto, en el orden de la lista', () => {
    assert.ok(portada.includes(`Dataset act1 · Datos al: ${formatoCorto(SET.act1.datosAl)} · Próxima: ${formatoCorto(SET.act1.vencimiento)}`), portada.join(' | '));
    // Sin "Datos al" sale con el guion largo, y un eventual, sin próxima
    assert.ok(portada.includes(`Dataset sinresp1 · Datos al: — · Próxima: ${formatoCorto(SET.sinresp1.vencimiento)}`));
    assert.ok(portada.includes('Dataset ev1 · Datos al: — · Próxima: —'));
    const posiciones = ORDEN.map(clave => portada.indexOf(renglonDe(clave)));
    assert.ok(posiciones.every(p => p !== -1), JSON.stringify(posiciones));
    assert.deepEqual([...posiciones].sort((a, b) => a - b), posiciones);
  });

  it('el archivo se llama Reporte-area-<id>-AAAA-MM-DD.pdf, con la fecha de hoy en Argentina', () => {
    const nombre = `Reporte-area-${areas.A}-${HOY}.pdf`;
    assert.equal(res.headers.get('content-disposition'), `attachment; filename="${nombre}"; filename*=UTF-8''${nombre}`);
  });
});

describe('reporte PDF por área: los sin fecha van en su grupo, no entre los vencidos', () => {
  // Área B: un actualizado (act3) y un mensual sin próxima (sinfecha1)
  let hojas, lineas;
  before(async () => {
    const res = await api.get(`/reportes/por-area/${areas.B}`, admin());
    assert.equal(res.status, 200);
    hojas = lineasPorHoja(res.body);
    [lineas] = hojas;
  });

  it('no cuentan como vencidos', async () => {
    assert.equal(valorDeTarjeta(lineas, 'Total Datasets'), '2');
    assert.equal(valorDeTarjeta(lineas, 'Actualizados'), '1');
    assert.equal(valorDeTarjeta(lineas, 'Vencidos'), '0');
    assert.equal(valorDeTarjeta(lineas, 'Eventuales'), '0');
    assert.ok(!lineas.some(l => l.startsWith('Vencidos (')));
  });

  it('van en "Sin fecha (n)", al final, y una línea lo aclara debajo de las tarjetas', async () => {
    assert.ok(lineas.includes('Sin fecha (1)'));
    assert.ok(lineas.indexOf('Actualizados (1)') < lineas.indexOf('Sin fecha (1)'));
    assert.ok(lineas.includes('1 dataset todavía no tiene fecha de próxima actualización.'));
    assert.ok(lineas.indexOf('Sin fecha (1)') < lineas.indexOf('Dataset sinfecha1 · Datos al: — · Próxima: —'));
  });

  it('el sin fecha también tiene su hoja del Seguimiento, la última', () => {
    assert.equal(hojas.length, 1 + 2);
    assert.ok(hojas[1].includes(titulo('act3')) && hojas[2].includes(titulo('sinfecha1')), hojas.slice(1).map(h => h.join(' | ')).join(' || '));
  });
});

describe('reporte PDF por área: un área que no existe', () => {
  it('área inexistente: 404 «Área no encontrada»', async () => {
    const [{ maximo }] = await query('SELECT COALESCE(MAX(id), 0) AS maximo FROM areas');
    for (const id of [maximo + 1000, 'abc']) {
      const res = await api.get(`/reportes/por-area/${id}`, admin());
      assert.equal(res.status, 404, String(id));
      assert.deepEqual(res.body, { success: false, error: 'Área no encontrada' });
    }
  });
});

// El antiobjetivo: que la tasa diga una cosa en la portada, otra en el Estado general y otra en Métricas (spec
// 2026-10-24-metricas-y-reportes, 5: el Cumplimiento ya no está; el índice de hoy de Métricas es el último punto de contexto.indice)
describe('la tasa es la misma en la portada, el Estado general y /metricas', () => {
  it('la tasa es la misma en la portada, el Estado general y /metricas', async () => {
    const portada = (await estadisticas()).tasaActualizacion;
    const general = (await lineasDe('/reportes/estado-general')).find(l => l.startsWith('Tasa de actualización: '));
    const res = await api.get('/metricas', admin());
    assert.equal(res.status, 200);
    const deHoy = res.body.data.contexto.indice.at(-1);
    assert.equal(portada, 57);
    assert.equal(general, `Tasa de actualización: ${portada}%`);
    assert.equal(deHoy.dia, HOY);
    assert.equal(deHoy.tasa, portada);
    // Los mismos al día sobre la misma base: 3 actualizados y 1 próximo, sobre los 10 activos sin los 3 eventuales
    assert.deepEqual([deHoy.al_dia, deHoy.base], [4, 7]);
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

  it('cada área: los al día sobre lo que tiene vencimiento, como en la tasa', () => {
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

// Avisos del RPAD (spec 2026-10-24-metricas-y-reportes, 5): la constancia de los emails y las Notas Digitales de aviso y de
// reiteración de un período, con los textos del Seguimiento, sin direcciones de email, sin el texto técnico de los errores, sin las
// notas de prueba y sin las de auditoría y autorización. Un período fijo, en marzo de 2026: no depende de hoy. Los emails se cargan con
// su instante (FROM_UNIXTIME, sin la zona de la sesión) y el día que cuenta es el de Argentina (UTC-3).
describe('reporte PDF Avisos del RPAD', () => {
  const PERIODO = 'desde=2026-03-01&hasta=2026-03-31';
  // Un instante en UTC, en segundos, para FROM_UNIXTIME
  const enUtc = (momento) => Date.parse(`${momento.replace(' ', 'T')}Z`) / 1000;
  const email = (tipo, claves, momentoUtc, extra = {}) => query(
    `INSERT INTO notificaciones_log (tipo, area_id, destinatarios, datasets_ids, cantidad_datasets, enviado_at, success, error_message)
     VALUES (?, ?, 'mit@rpad.test,da@rpad.test', ?, ?, FROM_UNIXTIME(?), ?, ?)`,
    [tipo, extra.area ?? null, claves.map(c => ids[c]).join(','), claves.length, enUtc(momentoUtc), extra.success ?? 1, extra.error ?? null]
  );
  const nota = (datos, claves = []) => crearNota({ anio: 2026, ...datos, datasets: claves.map(c => ({ id: ids[c], vencimiento: '2026-04-30' })) });
  let hojas, lineas;
  before(async () => {
    await email('externo-40', ['sinresp1', 'act1'], '2026-03-10 11:15:00');
    await email('area-aviso-40', ['sinresp1'], '2026-03-10 11:15:05', { area: areas.A });
    await email('externo-vencido', ['sinresp1'], '2026-03-15 11:00:00', { success: 0, error: 'Invalid login: 535 smtp@rpad.test ECONNREFUSED' });
    // El 31/03 a las 23:30 en Argentina (el 01/04 en UTC): entra. El 28/02 a las 22:00 en Argentina (el 01/03 en UTC): no
    await email('interno-30', ['prox1'], '2026-04-01 02:30:00');
    await email('externo-5', ['act3'], '2026-03-01 01:00:00');
    await nota({ tipo: 'aviso', gestion: 'externa', fecha: '2026-03-20', numero: 3 }, ['sinresp1', 'act1']);
    await nota({ tipo: 'reiteracion', gestion: 'interna', fecha: '2026-03-25', numero: 4, estado: 'pendiente' }, ['atras1']);
    await nota({ tipo: 'aviso', gestion: 'externa', fecha: '2026-03-26', numero: 5, estado: 'fallida' }, ['act3']);
    // No van: la auditoría, la autorización, la de prueba y la de otro mes
    await nota({ tipo: 'auditoria', gestion: null, fecha: '2026-03-12', numero: 6 });
    await nota({ tipo: 'autorizacion', gestion: null, fecha: '2026-03-13', numero: 7 });
    await nota({ tipo: 'aviso', gestion: 'externa', fecha: '2026-03-14', esPrueba: 1, anio: null }, ['act1']);
    await nota({ tipo: 'aviso', gestion: 'externa', fecha: '2026-04-01', numero: 8 }, ['act1']);
    const res = await api.get(`/reportes/avisos?${PERIODO}`, admin());
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/pdf/);
    hojas = lineasPorHoja(res.body);
    lineas = hojas.flat();
  });

  it('avisos: emails y notas del período, sin «@» en ninguna parte del PDF', () => {
    assert.ok(!lineas.some(l => l.includes('@')), lineas.filter(l => l.includes('@')).join(' | '));
    assert.ok(!lineas.some(l => /ECONNREFUSED|Invalid login|535/.test(l)), lineas.join(' | '));
    assert.ok(lineas.includes('AVISOS DEL RPAD · DEL 01/03/2026 AL 31/03/2026'), lineas.join(' | '));
    assert.ok(lineas.includes('7 avisos del RPAD en el período') && lineas.includes('5 de gestión externa y 2 de gestión interna'), lineas.join(' | '));
    assert.deepEqual(['Total de avisos', 'Emails a DGMIT', 'Emails al área', 'Notas Digitales', 'Sin enviar'].map(r => valorDeTarjeta(lineas, r)),
      ['7', '3', '1', '3', '3']);
    // Las filas de la tabla, del más viejo al más nuevo: fecha, qué fue, gestión, datasets (por título) y estado
    const i = lineas.indexOf('Fecha');
    assert.deepEqual(lineas.slice(i, i + 5), ['Fecha', 'Qué fue', 'Gestión', 'Datasets', 'Estado']);
    const fin = lineas.findIndex(l => l.startsWith('Generado el '));
    assert.deepEqual(lineas.slice(i + 5, fin), [
      '10/03/2026', 'Email a DGMIT: distribución de notas', 'Externa', `${titulo('act1')}, ${titulo('sinresp1')}`, 'Enviado',
      '10/03/2026', 'Email al área: anticipo de la nota formal', 'Externa', titulo('sinresp1'), 'Enviado',
      '15/03/2026', 'Email a DGMIT: resumen mensual de vencidos', 'Externa', titulo('sinresp1'), 'No se pudo enviar',
      '20/03/2026', 'Nota Digital N° 3/26 a DGMIT', 'Externa', `${titulo('act1')}, ${titulo('sinresp1')}`, 'Enviada',
      '25/03/2026', 'Nota Digital N° 4/26 a DGMIT', 'Interna', titulo('atras1'), 'Pendiente de envío',
      '26/03/2026', 'Nota Digital N° 5/26 a DGMIT', 'Externa', titulo('act3'), 'No se pudo enviar',
      '31/03/2026', 'Email a DGMIT: vence en 1 mes', 'Interna', titulo('prox1'), 'Enviado'
    ]);
  });

  it('una hoja, con el pie «Avisos del RPAD · Hoja 1 de 1» y quién lo generó', () => {
    assert.equal(hojas.length, 1);
    assert.ok(lineas.includes('Avisos del RPAD · Hoja 1 de 1'));
    assert.ok(lineas.some(l => /^Generado el \d{2}\/\d{2}\/\d{4} a las \d{2}:\d{2} por Test admin$/.test(l)), lineas.join(' | '));
  });

  it('desde > hasta da 400', async () => {
    const res = await api.get('/reportes/avisos?desde=2026-03-31&hasta=2026-03-01', admin());
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { success: false, error: 'Elegí un período válido.' });
  });
});
