// Reportes PDF y notas DOCX
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
// jszip llega con docx (lo usa para armar el .docx): acá abre la nota para leer su texto
import JSZip from 'jszip';
import { iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { lineasPorHoja } from './pdf-lector.js';
import { hoyArgentina, formatoCorto } from '../services/notasDigitalesCalendario.js';

let servidor, api, usuarios;

before(async () => {
  servidor = await iniciarServidor();
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api);
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
});

const esPdf = (res) => {
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/pdf/);
  assert.equal(res.body.subarray(0, 5).toString(), '%PDF-');
};

describe('reportes PDF', () => {
  it('estado general', async () => {
    esPdf(await api.get('/reportes/estado-general', { token: usuarios.lector.token }));
  });

  it('historial de notificaciones', async () => {
    esPdf(await api.get('/reportes/historial-notificaciones?desde=2025-01-01&hasta=2026-12-31', { token: usuarios.adminA.token }));
  });

  it('por área', async () => {
    const [area] = await query('SELECT area_id AS id FROM datasets WHERE activo = 1 LIMIT 1');
    esPdf(await api.get(`/reportes/por-area/${area.id}`, { token: usuarios.adminA.token }));
  });

  it('cumplimiento', async () => {
    esPdf(await api.get('/reportes/cumplimiento?periodo=mensual', { token: usuarios.adminA.token }));
  });
});

// Spec 2026-10-17-fechas-datasets, sección 11: donde un PDF lista la próxima, suma "Datos al" (con datos de los 80 datasets
// reales; el set controlado con los valores exactos está en estados-api.test.js)
// El nombre del archivo del Estado general (y del Por área) lleva la fecha de hoy en Argentina, la misma del PDF, no la del reloj del
// servidor (en un servidor en UTC, después de las 21 decía mañana). El servidor de prueba corre en una zona en la que ahora es otro día
// que en Argentina: UTC-12 (9 horas antes; hasta las 9 de la mañana de Argentina es ayer) o UTC+14 (17 horas después; desde las 7 ya
// es mañana)
describe('reportes PDF: el nombre del Estado general y del Por área', () => {
  it('lleva la fecha de hoy en Argentina, con el formato de siempre (estado-general-dd-mm-aaaa.pdf)', async () => {
    const hoy = hoyArgentina();
    const fechaEn = (zona) => new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const zona = ['Etc/GMT+12', 'Etc/GMT-14'].find((z) => fechaEn(z) !== hoy);
    const otro = await iniciarServidor({ env: { TZ: zona } });
    try {
      const res = await crearCliente(otro.url).get('/reportes/estado-general', { token: usuarios.lector.token });
      esPdf(res);
      assert.equal(res.headers.get('content-disposition'), `attachment; filename=estado-general-${formatoCorto(hoyArgentina()).replace(/\//g, '-')}.pdf`);
    } finally {
      await otro.detener();
    }
  });

  it('el del Por área también: Reporte-area-<id>-AAAA-MM-DD.pdf, con la fecha de hoy en Argentina', async () => {
    const hoy = hoyArgentina();
    const fechaEn = (zona) => new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const zona = ['Etc/GMT+12', 'Etc/GMT-14'].find((z) => fechaEn(z) !== hoy);
    const [area] = await query('SELECT area_id AS id FROM datasets WHERE activo = 1 LIMIT 1');
    const otro = await iniciarServidor({ env: { TZ: zona } });
    try {
      const res = await crearCliente(otro.url).get(`/reportes/por-area/${area.id}`, { token: usuarios.lector.token });
      esPdf(res);
      const nombre = `Reporte-area-${area.id}-${hoyArgentina()}.pdf`;
      assert.equal(res.headers.get('content-disposition'), `attachment; filename="${nombre}"; filename*=UTF-8''${nombre}`);
    } finally {
      await otro.detener();
    }
  });
});

describe('reportes PDF: "Datos al"', () => {
  it('el estado general tiene la columna Datos al y fechas dd/mm/aaaa debajo', async () => {
    const res = await api.get('/reportes/estado-general', { token: usuarios.lector.token });
    esPdf(res);
    const lineas = lineasPorHoja(res.body).flat();
    const i = lineas.indexOf('Título');
    assert.deepEqual(lineas.slice(i, i + 6), ['Título', 'Área', 'Frecuencia', 'Datos al', 'Próx. Act.', 'Estado']);
    assert.ok(lineas.some(l => /^Tasa de actualización: \d+%$/.test(l)));
    assert.ok(lineas.some(l => /^\d{2}\/\d{2}\/\d{4}$/.test(l)));
  });

  it('el reporte por área trae "Datos al" en el renglón de cada dataset, y detrás una hoja del Seguimiento por cada activo', async () => {
    const [{ id }] = await query('SELECT area_id AS id FROM datasets WHERE activo = 1 AND datos_al IS NOT NULL LIMIT 1');
    const [{ activos }] = await query('SELECT COUNT(*) AS activos FROM datasets WHERE activo = 1 AND area_id = ?', [id]);
    const res = await api.get(`/reportes/por-area/${id}`, { token: usuarios.adminA.token });
    esPdf(res);
    const hojas = lineasPorHoja(res.body);
    assert.ok(hojas[0].some(l => / · Datos al: \d{2}\/\d{2}\/\d{4} · Próxima: (\d{2}\/\d{2}\/\d{4}|—)$/.test(l)), hojas[0].join(' | '));
    // La portada (con estos datos, en una hoja) y una hoja del Seguimiento por cada dataset activo del área
    assert.equal(hojas.filter(lineas => lineas.includes('Seguimiento del dataset')).length, Number(activos));
    hojas.forEach((lineas, k) => assert.ok(lineas.includes(`Reporte por área · Hoja ${k + 1} de ${hojas.length}`), `hoja ${k + 1}`));
  });
});

describe('notas DOCX', () => {
  for (const tipo of ['interna', 'externa', 'escalonada']) {
    it(`genera la nota ${tipo}`, async () => {
      const [dataset] = await query('SELECT id, area_id FROM datasets WHERE activo = 1 LIMIT 1');
      const res = await api.post('/notas/generar', {
        fecha: '2026-10-12', numero: '123/2026', area_id: dataset.area_id, tipo,
        datasets: [{ id: dataset.id, periodo_inicial: '2025', periodo_final: '2026' }]
      }, { token: usuarios.adminA.token });
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /wordprocessingml/);
      assert.equal(res.body.subarray(0, 2).toString(), 'PK');
    });
  }

  it('ninguna nota menciona el Índice Nacional de Datos Abiertos', async () => {
    const [dataset] = await query('SELECT id, area_id FROM datasets WHERE activo = 1 LIMIT 1');
    for (const tipo of ['interna', 'externa', 'escalonada']) {
      const res = await api.post('/notas/generar', {
        fecha: '2026-10-15', numero: '124/2026', area_id: dataset.area_id, tipo,
        datasets: [{ id: dataset.id, periodo_inicial: '2025', periodo_final: '2026' }]
      }, { token: usuarios.adminA.token });
      assert.equal(res.status, 200, tipo);
      const documento = await (await JSZip.loadAsync(res.body)).file('word/document.xml').async('string');
      // El texto se lee: la Ordenanza sí está
      assert.ok(documento.includes('Ordenanza N° 17.662/23'), tipo);
      assert.ok(!documento.includes('Índice Nacional') && !documento.includes('Cabe destacar'), tipo);
    }
  });
});
