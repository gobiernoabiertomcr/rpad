// Estados y tasa de actualización en el servidor (spec 2026-10-17-fechas-datasets, sección 11): un solo cálculo de estado
// (estadoDelDataset) para el listado, las estadísticas y los reportes PDF; los eventuales van aparte y no entran en la
// tasa; los PDF suman "Datos al" donde listan la próxima. Contra una base de prueba propia, con un set controlado.
// El servidor usa siempre el hoy real (hoyArgentina): todas las fechas salen de hoy.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb } from './helpers.js';
import { crearArea, crearDataset } from './notas-fixtures.js';
import { lineasPorHoja } from './pdf-lector.js';
import { formatoCorto, hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';
import { sumarMeses, vencimientoDelMes } from '../services/fechasDatasetReglas.js';

const HOY = hoyArgentina();
const FIN_DE_MES = vencimientoDelMes(HOY);
const enMeses = (n) => sumarMeses(FIN_DE_MES, n);
const DIC_ANTERIOR = `${Number(HOY.slice(0, 4)) - 1}-12-31`;

let base, servidor, api, usuarios, dbReal, areaA, areaB;
const ids = {};

// El set controlado: 9 activos y 1 de baja.
//   actualizados (3): vencen en 3 meses o más, siempre a más de 60 días
//   próximo (1): vence a fin de este mes (entre 0 y 30 días)
//   atrasado (1, gestión interna) y sin respuesta (1, gestión externa): vencieron hace 1 y 11 días
//   sin fecha (1): mensual sin próxima
//   eventuales (2): sin frecuencia en meses
// Área A tiene siete (sin el sin-fecha ni el tercer actualizado); el área B, dos.
const DATASETS = [
  { clave: 'act1', area: 'A', frecuencia: 'Anualmente', gestion: 'externa', vencimiento: enMeses(12), datosAl: DIC_ANTERIOR },
  { clave: 'act2', area: 'A', frecuencia: 'Trimestralmente', gestion: 'interna', vencimiento: enMeses(3), datosAl: enMeses(-1) },
  { clave: 'act3', area: 'B', frecuencia: 'Cada medio año', gestion: 'externa', vencimiento: enMeses(6), datosAl: enMeses(-2) },
  { clave: 'prox1', area: 'A', frecuencia: 'Mensualmente', gestion: 'interna', vencimiento: FIN_DE_MES, datosAl: enMeses(-1) },
  { clave: 'atras1', area: 'A', frecuencia: 'Mensualmente', gestion: 'interna', vencimiento: sumarDias(HOY, -1), datosAl: enMeses(-2) },
  { clave: 'sinresp1', area: 'A', frecuencia: 'Mensualmente', gestion: 'externa', vencimiento: sumarDias(HOY, -11) },
  { clave: 'sinfecha1', area: 'B', frecuencia: 'Mensualmente', gestion: 'externa', vencimiento: null },
  { clave: 'ev1', area: 'A', frecuencia: 'Eventual', gestion: 'externa', vencimiento: null },
  { clave: 'ev2', area: 'A', frecuencia: 'Eventual', gestion: 'interna', vencimiento: null },
  { clave: 'baja', area: 'A', frecuencia: 'Eventual', gestion: 'externa', vencimiento: null, activo: 0 }
];
const titulo = (clave) => `Dataset ${clave}`;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_estados');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, { admin: 'admin' });
  areaA = await crearArea({ nombre: 'Área A' });
  areaB = await crearArea({ nombre: 'Área B' });
  for (const { clave, area, ...resto } of DATASETS) {
    ids[clave] = await crearDataset({ titulo: titulo(clave), areaId: area === 'A' ? areaA : areaB, ...resto });
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

describe('GET /datasets/estadisticas', () => {
  it('cuenta a los eventuales aparte: ya no son actualizados', async () => {
    const e = await estadisticas();
    assert.equal(e.total, 9);
    assert.equal(e.actualizados, 3);
    assert.equal(e.proximos, 1);
    assert.equal(e.atrasados, 1);
    assert.equal(e.sinRespuesta, 1);
    assert.equal(e.totalVencidos, 2);
    assert.equal(e.eventuales, 2);
    assert.equal(e.sinFecha, 1);
    // Todo dataset activo cae en una sola cuenta
    assert.equal(e.actualizados + e.proximos + e.atrasados + e.sinRespuesta + e.sinFecha + e.eventuales, e.total);
  });

  it('la tasa de actualización es (actualizados + próximos) sobre el total sin los eventuales', async () => {
    const e = await estadisticas();
    // (3 + 1) / (9 - 2) = 57 %. Contando a los eventuales como actualizados daría (3 + 1 + 2) / 9 = 67 %
    assert.equal(e.tasaActualizacion, Math.round(((3 + 1) / (9 - 2)) * 100));
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
    assert.equal((await estadisticas()).eventuales, 2);
  });
});

describe('GET /datasets?estado=', () => {
  it('eventual trae solo a los eventuales activos', async () => {
    const datasets = await lista('?estado=eventual');
    assert.deepEqual(clavesDe(datasets), ['ev1', 'ev2']);
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
    assert.equal((await lista()).length, 9);
    assert.equal((await lista('?estado=todos')).length, 9);
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
    assert.ok(lineas.some(l => /2 datasets eventuales no entran en la tasa/.test(l)));
  });

  it('las tarjetas: los eventuales no son actualizados', async () => {
    assert.equal(valorDeTarjeta(lineas, 'Total Datasets'), '9');
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
      [titulo('act1'), 'Área A', 'Anualmente', formatoCorto(DIC_ANTERIOR), formatoCorto(enMeses(12)), 'Actualizado']);
    assert.deepEqual(filaDe(lineas, 'prox1', 6),
      [titulo('prox1'), 'Área A', 'Mensualmente', formatoCorto(enMeses(-1)), formatoCorto(FIN_DE_MES), 'Próximo a vencer']);
    assert.deepEqual(filaDe(lineas, 'atras1', 6),
      [titulo('atras1'), 'Área A', 'Mensualmente', formatoCorto(enMeses(-2)), formatoCorto(sumarDias(HOY, -1)), 'Atrasado']);
  });

  it('un dataset sin "Datos al" lo muestra con un guion largo', async () => {
    assert.deepEqual(filaDe(lineas, 'sinresp1', 6),
      [titulo('sinresp1'), 'Área A', 'Mensualmente', '—', formatoCorto(sumarDias(HOY, -11)), 'Sin respuesta']);
    assert.deepEqual(filaDe(lineas, 'sinfecha1', 6),
      [titulo('sinfecha1'), 'Área B', 'Mensualmente', '—', '—', 'Sin fecha']);
  });

  it('un eventual figura como Eventual, sin próxima', async () => {
    assert.deepEqual(filaDe(lineas, 'ev1', 6), [titulo('ev1'), 'Área A', 'Eventual', '—', '—', 'Eventual']);
  });
});

describe('reporte PDF por área', () => {
  let lineas;
  before(async () => { lineas = await lineasDe(`/reportes/por-area/${areaA}`); });

  it('cada tarjeta trae "Datos al" junto a la próxima', async () => {
    assert.ok(lineas.includes(`Datos al: ${formatoCorto(DIC_ANTERIOR)} Proxima actualizacion: ${formatoCorto(enMeses(12))} Frecuencia de actualizacion: Anualmente`));
    // Sin "Datos al" sale con el guion largo
    assert.ok(lineas.includes(`Datos al: — Proxima actualizacion: ${formatoCorto(sumarDias(HOY, -11))} Frecuencia de actualizacion: Mensualmente`));
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

describe('reporte PDF de cumplimiento', () => {
  it('queda como estaba: el eventual cuenta como al día', async () => {
    const lineas = await lineasDe('/reportes/cumplimiento?periodo=mensual');
    // Al día: 3 actualizados + 1 próximo + 2 eventuales = 6 de 9
    assert.equal(valorDeTarjeta(lineas, 'Total Datasets'), '9');
    assert.equal(valorDeTarjeta(lineas, 'Al día'), '6');
    assert.equal(valorDeTarjeta(lineas, '% Cumplimiento'), '67%');
    const i = lineas.indexOf('Área A');
    assert.deepEqual(lineas.slice(i, i + 4), ['Área A', '7', '5', '71%']);
    const j = lineas.indexOf('Área B');
    assert.deepEqual(lineas.slice(j, j + 4), ['Área B', '2', '1', '50%']);
  });
});
