// Generador de Notas (spec 2026-10-24-generador-de-notas, secciones 1, 3.2, 4.5, 4.6 y 7): la API. La usan administración y el
// colaborador (sin sesión, 401; lector, 403). Las áreas y sus datasets salen con las reglas de siempre (sePuedeElegir, el estado,
// conPedido, frecuenciaEnNota y las notas DGMIT del ciclo abierto); la vista previa y el Word salen de los mismos bloques. No se
// guarda nada. Contra una base de prueba propia.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// jszip llega con docx (lo usa para armar el .docx): acá abre el Word para leer su texto
import JSZip from 'jszip';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { crearArea, crearDataset, PIE_MEMBRETE } from './notas-fixtures.js';
import { hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';
import { pedido, tipoEfectivo, estadoDelDataset, sumarMeses, vencimientoDelMes } from '../services/fechasDatasetReglas.js';
import { MENSAJES_GENERADOR, textoAlDia, textoDeOtraArea } from '../services/notasGeneradorReglas.js';
import { textoNoSePuedeElegir } from '../services/notasDgmitReglas.js';

const TIPO_WORD = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const SIN_PERMISO = 'No tenés permiso para usar el generador de notas.';
const LOGO = fs.readFileSync(new URL('../public/img/logo.png', import.meta.url));

const hoy = hoyArgentina();
// Las fechas de los datasets, a partir de hoy:
// - vencido: el fin del mes de hace dos meses;
// - próximo: el fin de este mes (faltan entre 0 y 30 días);
// - al día: dentro de 75 días. No es un fin de mes a propósito: hoy está al día (más de 60 días) y a la fecha de la nota más
//   alta que se acepta, hoy + 30, ya es próximo (45 días). Con un fin de mes, algunos días del año no hay ninguno en ese tramo.
// Y al revés: a la fecha de la nota ANTES_DEL_PROXIMO (61 días antes del vencimiento del próximo, en el pasado y dentro del rango de
// la nota) el próximo todavía estaba al día.
const VENCIDO = sumarMeses(vencimientoDelMes(hoy), -2);
const DATOS_AL_DEL_VENCIDO = sumarMeses(VENCIDO, -4);
const PROXIMO = vencimientoDelMes(hoy);
const AL_DIA = sumarDias(hoy, 75);
const EN_30_DIAS = sumarDias(hoy, 30);
const ANTES_DEL_PROXIMO = sumarDias(PROXIMO, -61);
const RECIBIDA = sumarDias(hoy, -10);
const QUE_SE_SOLICITA = 'Cantidad de trámites de prueba por mes.';

const AREA_A = 'Dirección General de Prueba del Generador';
const AREA_B = 'Instituto de Prueba del Generador';

let base, servidor, api, usuarios, dbReal;
const ids = {};

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_generador_api');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, { adminA: 'admin', lector: 'lector', colab: 'colaborador' });

  // Un área municipal "la", con dependencia; un área fuera del municipio "el", sin dependencia; y una con solo datasets internos
  ids.areaA = await crearArea({
    nombre: AREA_A, articulo: 'la', area_superior: 'Secretaría de Prueba', articulo_superior: 'la', ambito: 'municipal'
  });
  ids.areaB = await crearArea({ nombre: AREA_B, articulo: 'el', ambito: 'externo' });
  ids.areaC = await crearArea({ nombre: 'Área de prueba solo con internos', ambito: 'municipal' });

  // Del área A: los que se pueden elegir (externos con «Requiere nota DGMIT» en Sí o sin dato)
  ids.vencido = await crearDataset({
    titulo: 'Dataset vencido', areaId: ids.areaA, gestion: 'externa', frecuencia: 'Trimestralmente', vencimiento: VENCIDO,
    datosAl: DATOS_AL_DEL_VENCIDO, requiereNota: 1, queSeSolicita: QUE_SE_SOLICITA
  });
  ids.proximo = await crearDataset({
    titulo: 'Dataset próximo', areaId: ids.areaA, gestion: 'externa', frecuencia: 'Anualmente', vencimiento: PROXIMO, requiereNota: null
  });
  ids.alDia = await crearDataset({
    titulo: 'Dataset al día', areaId: ids.areaA, gestion: 'externa', frecuencia: 'Anualmente', vencimiento: AL_DIA, requiereNota: 1
  });
  // Un eventual con una próxima vieja guardada: no se ordena por ella
  ids.eventual = await crearDataset({
    titulo: 'Dataset eventual', areaId: ids.areaA, gestion: 'externa', frecuencia: 'Eventual', vencimiento: '2020-01-31', requiereNota: 1
  });
  // Uno dado de baja: externo y con «Requiere nota DGMIT» en Sí, pero no se puede elegir
  ids.deBaja = await crearDataset({
    titulo: 'Dataset dado de baja', areaId: ids.areaA, gestion: 'externa', frecuencia: 'Anualmente', vencimiento: VENCIDO,
    requiereNota: 1, activo: 0
  });
  // Del área B: uno que se puede elegir (de otra área para las notas del área A), uno con «No» y uno interno
  ids.deOtraArea = await crearDataset({
    titulo: 'Dataset de otra área', areaId: ids.areaB, gestion: 'externa', frecuencia: 'Anualmente', vencimiento: VENCIDO, requiereNota: 1
  });
  ids.sinNota = await crearDataset({
    titulo: 'Dataset que no requiere nota', areaId: ids.areaB, gestion: 'externa', frecuencia: 'Anualmente', vencimiento: VENCIDO,
    requiereNota: 0
  });
  ids.interno = await crearDataset({
    titulo: 'Dataset interno', areaId: ids.areaB, gestion: 'interna', frecuencia: 'Anualmente', vencimiento: VENCIDO
  });
  ids.soloInterno = await crearDataset({
    titulo: 'Dataset interno del área C', areaId: ids.areaC, gestion: 'interna', frecuencia: 'Anualmente', vencimiento: VENCIDO
  });

  // Una nota DGMIT en el ciclo abierto del vencido, cargada por SQL
  const nota = await query("INSERT INTO notas_dgmit (numero, tipo, recibida) VALUES ('97/26', 'solicitud', ?)", [RECIBIDA]);
  await query('INSERT INTO notas_dgmit_datasets (nota_id, dataset_id) VALUES (?, ?)', [nota.insertId, ids.vencido]);
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

const como = (clave) => ({ token: usuarios[clave].token });

// El pedido de una nota: interna, solicitud, de hoy, con el vencido y el próximo del área A
const nota = (cambios = {}) => ({
  fecha: hoy, numero: '156/26', tipo: 'interna', pedido: 'solicitud', anteriores: [], area_id: ids.areaA,
  datasets: [ids.vencido, ids.proximo], ...cambios
});

// El texto del Word (word/document.xml)
const xmlDelWord = async (res) => (await JSZip.loadAsync(res.body)).file('word/document.xml').async('string');

const esWord = (res) => {
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.headers.get('content-type'), TIPO_WORD);
  assert.equal(res.body.subarray(0, 2).toString(), 'PK');
};

// Un 400 de validación: { success: false, error, campo, errores }, con el error en su campo
const esRechazo = (res, campo, error) => {
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(res.body.success, false);
  assert.equal(res.body.campo, campo);
  assert.equal(res.body.error, error);
  assert.equal(res.body.errores[campo], error);
};

describe('permisos', () => {
  it('sin sesión: 401', async () => {
    const res = await api.get('/notas/areas');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it('el lector: 403 con "No tenés permiso para usar el generador de notas."', async () => {
    for (const res of [await api.get('/notas/areas', como('lector')), await api.post('/notas/generar', nota(), como('lector'))]) {
      assert.equal(res.status, 403);
      assert.deepEqual(res.body, { success: false, error: SIN_PERMISO });
    }
  });

  it('el colaborador y el admin: 200 en GET /notas/areas', async () => {
    for (const clave of ['colab', 'adminA']) {
      const res = await api.get('/notas/areas', como(clave));
      assert.equal(res.status, 200, clave);
      assert.equal(res.body.success, true, clave);
    }
  });
});

describe('GET /notas/areas', () => {
  const pedirAreas = async () => {
    const res = await api.get('/notas/areas', como('colab'));
    assert.equal(res.status, 200);
    return res.body.data;
  };

  it('el área B, solo con el dataset que se puede elegir: sin el que no requiere nota ni el interno', async () => {
    const area = (await pedirAreas()).find((a) => a.id === ids.areaB);
    assert.ok(area, 'el área B está');
    assert.deepEqual(area.datasets.map((d) => d.id), [ids.deOtraArea]);
    assert.equal(area.nombre, AREA_B);
    assert.equal(area.ambito, 'externo');
    assert.equal(area.articulo, 'el');
    assert.equal(area.area_superior, null);
  });

  it('el dado de baja no aparece entre los datasets del área A', async () => {
    const area = (await pedirAreas()).find((a) => a.id === ids.areaA);
    assert.ok(!area.datasets.some((d) => d.id === ids.deBaja));
  });

  it('ningún área con solo datasets internos', async () => {
    const areas = await pedirAreas();
    assert.ok(!areas.some((a) => a.id === ids.areaC), 'el área C no está');
    assert.deepEqual(areas.map((a) => a.id).sort((a, b) => a - b), [ids.areaA, ids.areaB].sort((a, b) => a - b));
  });

  it('el área A, con su ámbito, sus artículos, su dependencia y sus datasets con el estado de hoy, en el orden de la tabla', async () => {
    const area = (await pedirAreas()).find((a) => a.id === ids.areaA);
    assert.deepEqual(
      { ...area, datasets: undefined },
      {
        id: ids.areaA, nombre: AREA_A, ambito: 'municipal', area_superior: 'Secretaría de Prueba', articulo: 'la',
        articulo_superior: 'la', datasets: undefined
      }
    );
    // El eventual, al final: no se ordena por su próxima vieja
    assert.deepEqual(area.datasets.map((d) => [d.titulo, d.estado]), [
      ['Dataset vencido', 'sin-respuesta'], ['Dataset próximo', 'proximo'], ['Dataset al día', 'actualizado'], ['Dataset eventual', 'eventual']
    ]);
    const vencido = area.datasets[0];
    assert.deepEqual(Object.keys(vencido).sort(), ['dias', 'estado', 'id', 'proxima', 'titulo']);
    assert.equal(vencido.proxima, VENCIDO);
    assert.equal(vencido.dias, estadoDelDataset({ proxima: VENCIDO, meses: 3, tipoGestion: 'externa', hoy }).dias);
    assert.ok(vencido.dias < 0);
    assert.equal(area.datasets[3].dias, null);
  });
});

describe('GET /notas/areas/:id', () => {
  const pedirArea = async (consulta = '') => {
    const res = await api.get(`/notas/areas/${ids.areaA}${consulta}`, como('colab'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.success, true);
    return res.body.data;
  };
  const delArea = (area, id) => area.datasets.find((d) => d.id === id);

  it('el vencido trae los datos solicitados, el «Qué se solicita» y las notas DGMIT del ciclo abierto', async () => {
    const area = await pedirArea();
    assert.equal(area.nombre, AREA_A);
    assert.equal(area.ambito, 'municipal');
    const vencido = delArea(area, ids.vencido);
    const tipo = tipoEfectivo({ tipo_pedido: null, tipo_gestion: 'externa', meses: 3 });
    assert.deepEqual(vencido, {
      id: ids.vencido,
      titulo: 'Dataset vencido',
      estado: 'sin-respuesta',
      dias: estadoDelDataset({ proxima: VENCIDO, meses: 3, tipoGestion: 'externa', hoy }).dias,
      proxima: VENCIDO,
      frecuencia: 'Trimestralmente (Acumulado)',
      datos_solicitados: pedido({ vencimiento: VENCIDO, tipo, datosAl: DATOS_AL_DEL_VENCIDO, meses: 3, hoy }).texto,
      que_se_solicita: QUE_SE_SOLICITA,
      se_puede_pedir: true,
      notas_dgmit: [{ numero: '97/26', tipo: 'solicitud', recibida: RECIBIDA }]
    });
    assert.ok(vencido.dias < 0);
  });

  it('el al día trae se_puede_pedir: false; el eventual se puede pedir y no tiene datos solicitados', async () => {
    const area = await pedirArea();
    const alDia = delArea(area, ids.alDia);
    assert.equal(alDia.estado, 'actualizado');
    assert.equal(alDia.se_puede_pedir, false);
    assert.deepEqual(alDia.notas_dgmit, []);
    const eventual = delArea(area, ids.eventual);
    assert.equal(eventual.estado, 'eventual');
    assert.equal(eventual.se_puede_pedir, true);
    assert.equal(eventual.datos_solicitados, null);
    assert.equal(eventual.frecuencia, 'Eventual');
    assert.equal(eventual.que_se_solicita, null);
    assert.equal(delArea(area, ids.proximo).se_puede_pedir, true);
  });

  it('solo los datasets del área que se pueden elegir, en el orden de la tabla (el eventual, al final)', async () => {
    const area = await pedirArea();
    assert.deepEqual(area.datasets.map((d) => d.id), [ids.vencido, ids.proximo, ids.alDia, ids.eventual]);
    const areaB = await api.get(`/notas/areas/${ids.areaB}`, como('colab'));
    assert.equal(areaB.status, 200);
    assert.deepEqual(areaB.body.data.datasets.map((d) => d.id), [ids.deOtraArea]);
  });

  it('el dado de baja no aparece entre los datasets del área', async () => {
    const area = await pedirArea();
    assert.ok(!area.datasets.some((d) => d.id === ids.deBaja));
  });

  it('Review Focus 3: con ?fecha= 30 días después, el que hoy está al día y vence en ese plazo se puede pedir', async () => {
    const area = await pedirArea(`?fecha=${EN_30_DIAS}`);
    const alDia = delArea(area, ids.alDia);
    assert.equal(alDia.estado, 'proximo');
    assert.equal(alDia.dias, 45);
    assert.equal(alDia.se_puede_pedir, true);
  });

  it('Review Focus 3, al revés: a una fecha de la nota anterior, el que hoy está próximo todavía estaba al día y no se puede pedir', async () => {
    assert.equal(delArea(await pedirArea(), ids.proximo).estado, 'proximo');
    const proximo = delArea(await pedirArea(`?fecha=${ANTES_DEL_PROXIMO}`), ids.proximo);
    assert.equal(proximo.estado, 'actualizado');
    assert.equal(proximo.dias, 61);
    assert.equal(proximo.se_puede_pedir, false);
  });

  it('un área que existe y no tiene datasets que se puedan elegir: 200, sin datasets', async () => {
    const res = await api.get(`/notas/areas/${ids.areaC}`, como('colab'));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.id, ids.areaC);
    assert.deepEqual(res.body.data.datasets, []);
  });

  it('una fecha inválida: 400 en la fecha', async () => {
    for (const fecha of ['2026-02-30', 'mañana', '2026-1-05']) {
      esRechazo(await api.get(`/notas/areas/${ids.areaA}?fecha=${encodeURIComponent(fecha)}`, como('colab')), 'fecha', MENSAJES_GENERADOR.fecha);
    }
  });

  it('una fecha fuera del rango de la nota: 400 en la fecha', async () => {
    esRechazo(await api.get(`/notas/areas/${ids.areaA}?fecha=${sumarDias(hoy, 31)}`, como('colab')), 'fecha', MENSAJES_GENERADOR.fechaFuera);
  });

  it('un área que no existe o un id que no es un entero positivo: 404 "Área no encontrada"', async () => {
    for (const id of ['999999', 'abc', '0', '-3', '1.5', '1e3']) {
      const res = await api.get(`/notas/areas/${id}`, como('colab'));
      assert.equal(res.status, 404, id);
      assert.deepEqual(res.body, { success: false, error: 'Área no encontrada' }, id);
    }
  });
});

describe('GET /notas/membrete', () => {
  it('sin imagen: imagen null y el pie de la configuración', async () => {
    const res = await api.get('/notas/membrete', como('colab'));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true, data: { imagen: null, pie: PIE_MEMBRETE } });
  });

  it('con la imagen: un data URL con su tipo y sus bytes', async () => {
    await query('UPDATE notas_digitales_config SET membrete_imagen = ?, membrete_mime = ? WHERE id = 1', [LOGO, 'image/png']);
    try {
      const res = await api.get('/notas/membrete', como('colab'));
      assert.equal(res.status, 200);
      assert.equal(res.body.data.imagen, `data:image/png;base64,${LOGO.toString('base64')}`);
      assert.equal(res.body.data.pie, PIE_MEMBRETE);
    } finally {
      await query('UPDATE notas_digitales_config SET membrete_imagen = NULL, membrete_mime = NULL WHERE id = 1');
    }
  });
});

describe('POST /notas/generar', () => {
  it('con el vencido y el próximo: el Word, con el texto de la nota interna y el «Qué se solicita»', async () => {
    const res = await api.post('/notas/generar', nota(), como('colab'));
    esWord(res);
    assert.equal(res.headers.get('content-disposition'),
      `attachment; filename="Nota interna - Direccion General de Prueba del Generador - ${hoy}.docx"; `
      + `filename*=UTF-8''${encodeURIComponent(`Nota interna - ${AREA_A} - ${hoy}.docx`)}`);
    const xml = await xmlDelWord(res);
    assert.ok(xml.includes('Solicito a Ud. tenga a bien gestionar ante la'));
    assert.ok(xml.includes('Qué se solicita:'));
    assert.ok(xml.includes(QUE_SE_SOLICITA));
    assert.ok(!xml.includes('Período:'));
    assert.ok(!xml.includes('Consta de'));
    // La tabla, en el orden de la tabla: el vencido antes que el próximo
    assert.ok(xml.indexOf('Dataset vencido') < xml.indexOf('Dataset próximo'));
  });

  it('el admin también lo descarga', async () => {
    esWord(await api.post('/notas/generar', nota({ tipo: 'externa' }), como('adminA')));
  });

  it('un dataset de otra área: 400 en los datasets', async () => {
    esRechazo(await api.post('/notas/generar', nota({ datasets: [ids.vencido, ids.deOtraArea] }), como('colab')),
      'datasets', textoDeOtraArea('Dataset de otra área'));
  });

  it('un dataset que no existe: 400 en los datasets', async () => {
    esRechazo(await api.post('/notas/generar', nota({ datasets: [999999] }), como('colab')), 'datasets', textoDeOtraArea('999999'));
  });

  it('Review Focus 3: el al día da 400 y el mismo dataset pasa con la fecha en la que es próximo', async () => {
    esRechazo(await api.post('/notas/generar', nota({ datasets: [ids.alDia] }), como('colab')), 'datasets', textoAlDia('Dataset al día'));
    esWord(await api.post('/notas/generar', nota({ datasets: [ids.alDia], fecha: EN_30_DIAS }), como('colab')));
  });

  it('Review Focus 3, al revés: el próximo, a una fecha de la nota en la que todavía estaba al día, da 400', async () => {
    esRechazo(await api.post('/notas/generar', nota({ datasets: [ids.proximo], fecha: ANTES_DEL_PROXIMO }), como('colab')),
      'datasets', textoAlDia('Dataset próximo'));
    esWord(await api.post('/notas/generar', nota({ datasets: [ids.proximo] }), como('colab')));
  });

  it('el dado de baja: 400 en los datasets', async () => {
    esRechazo(await api.post('/notas/generar', nota({ datasets: [ids.vencido, ids.deBaja] }), como('colab')),
      'datasets', textoNoSePuedeElegir('Dataset dado de baja'));
  });

  it('el interno: 400 en los datasets', async () => {
    esRechazo(await api.post('/notas/generar', nota({ area_id: ids.areaB, datasets: [ids.interno] }), como('colab')),
      'datasets', textoNoSePuedeElegir('Dataset interno'));
  });

  it('el que no requiere nota: 400 en los datasets', async () => {
    esRechazo(await api.post('/notas/generar', nota({ area_id: ids.areaB, datasets: [ids.sinNota] }), como('colab')),
      'datasets', textoNoSePuedeElegir('Dataset que no requiere nota'));
  });

  it('un área que no existe: 400 en el área', async () => {
    esRechazo(await api.post('/notas/generar', nota({ area_id: 999999 }), como('colab')), 'area', MENSAJES_GENERADOR.area);
  });

  it('tipo "escalonada": 400 en el tipo', async () => {
    esRechazo(await api.post('/notas/generar', nota({ tipo: 'escalonada' }), como('colab')), 'tipo', MENSAJES_GENERADOR.tipo);
  });

  it('numero: 125 (un número JSON): 400 en el número, no 500', async () => {
    esRechazo(await api.post('/notas/generar', nota({ numero: 125 }), como('colab')), 'numero', MENSAJES_GENERADOR.numeroLargo);
  });

  it('un número de 41 caracteres (contados con Array.from): 400 en el número', async () => {
    const numero = `${'N'.repeat(35)}${'😀'.repeat(6)}`;
    assert.equal(Array.from(numero).length, 41);
    esRechazo(await api.post('/notas/generar', nota({ numero }), como('colab')), 'numero', MENSAJES_GENERADOR.numeroLargo);
  });

  it('fecha: "2026-02-30": 400 en la fecha', async () => {
    esRechazo(await api.post('/notas/generar', nota({ fecha: '2026-02-30' }), como('colab')), 'fecha', MENSAJES_GENERADOR.fecha);
  });

  it('sin cuerpo: 400 en la fecha, el primer campo', async () => {
    esRechazo(await api.post('/notas/generar', {}, como('colab')), 'fecha', MENSAJES_GENERADOR.fecha);
  });

  it('Review Focus 2: un número y una nota anterior con "—", comillas tipográficas, emoji y varias "/" salen tal cual', async () => {
    const numero = '12/26/DGMIT—“x” 😀';
    // Una solicitud: el número, en el Word, y el nombre del archivo no lo lleva
    const solicitud = await api.post('/notas/generar', nota({ numero }), como('colab'));
    esWord(solicitud);
    assert.ok(solicitud.headers.get('content-disposition').startsWith('attachment; filename="Nota interna - '));
    assert.ok((await xmlDelWord(solicitud)).includes(numero));
    // Una reiteración: el número y la nota anterior que cita
    const reiteracion = await api.post('/notas/generar', nota({ numero, pedido: 'reiteracion', anteriores: ['97/26—a'] }), como('colab'));
    esWord(reiteracion);
    assert.ok(reiteracion.headers.get('content-disposition').startsWith('attachment; filename="Nota interna reiteracion - '));
    const xml = await xmlDelWord(reiteracion);
    assert.ok(xml.includes(numero));
    assert.ok(xml.includes('97/26—a'));
    // 40 caracteres con emoji (más de 40 unidades de UTF-16) también pasan
    const largo = `${'N'.repeat(34)}${'😀'.repeat(6)}`;
    assert.equal(Array.from(largo).length, 40);
    const conEmoji = await api.post('/notas/generar', nota({ numero: largo }), como('colab'));
    esWord(conEmoji);
    assert.ok((await xmlDelWord(conEmoji)).includes(largo));
  });
});

describe('POST /notas/vista-previa', () => {
  it('el HTML de la nota, con el área en negrita y la tabla, y el nombre del Word', async () => {
    // Los datasets llegan al revés: la tabla los ordena
    const res = await api.post('/notas/vista-previa', nota({ datasets: [ids.proximo, ids.vencido] }), como('colab'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.success, true);
    const { html, nombre } = res.body.data;
    assert.ok(html.includes(`<b>${AREA_A}</b>`));
    assert.ok(html.includes('<table class="nota-tabla">'));
    assert.ok(html.indexOf('Dataset vencido') < html.indexOf('Dataset próximo'));
    assert.equal(nombre, `Nota interna - ${AREA_A} - ${hoy}.docx`);
  });

  it('valida igual que la descarga', async () => {
    esRechazo(await api.post('/notas/vista-previa', nota({ tipo: 'escalonada' }), como('colab')), 'tipo', MENSAJES_GENERADOR.tipo);
    esRechazo(await api.post('/notas/vista-previa', nota({ datasets: [ids.alDia] }), como('colab')), 'datasets', textoAlDia('Dataset al día'));
  });

  it('el lector: 403', async () => {
    const res = await api.post('/notas/vista-previa', nota(), como('lector'));
    assert.equal(res.status, 403);
    assert.equal(res.body.error, SIN_PERMISO);
  });
});
