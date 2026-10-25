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

  // Avisos del RPAD (spec 2026-10-24-metricas-y-reportes, 5), con los emails y las Notas Digitales de la base de la rama: los
  // destinatarios y los «para» tienen direcciones, y ninguna llega al PDF. Del período salen todos los emails registrados y las notas de
  // aviso y de reiteración que no son de prueba (las de prueba no tienen número: no van)
  it('avisos del RPAD, con los datos de la base: todos los del período y ninguna dirección de email', async () => {
    const res = await api.get('/reportes/avisos?desde=2025-01-01&hasta=2026-12-31', { token: usuarios.lector.token });
    esPdf(res);
    const hojas = lineasPorHoja(res.body);
    const lineas = hojas.flat();
    assert.ok(!lineas.some(l => l.includes('@')), lineas.filter(l => l.includes('@')).join(' | '));
    const [[{ emails }], [{ notas }]] = await Promise.all([
      query("SELECT COUNT(*) AS emails FROM notificaciones_log WHERE enviado_at >= '2024-12-31' AND enviado_at < '2027-01-02'"),
      query("SELECT COUNT(*) AS notas FROM notas_digitales WHERE es_prueba = 0 AND tipo IN ('aviso', 'reiteracion') AND fecha BETWEEN '2025-01-01' AND '2026-12-31'")
    ]);
    assert.equal(lineas[lineas.indexOf('Total de avisos') - 1], String(Number(emails) + Number(notas)));
    assert.ok(lineas.includes('AVISOS DEL RPAD · DEL 01/01/2025 AL 31/12/2026'), lineas.join(' | '));
    hojas.forEach((h, k) => assert.ok(h.includes(`Avisos del RPAD · Hoja ${k + 1} de ${hojas.length}`), `hoja ${k + 1}`));
  });

  it('avisos del RPAD: desde > hasta da 400, y una fecha que no existe también', async () => {
    for (const consulta of ['desde=2026-10-02&hasta=2026-10-01', 'desde=2026-02-30', 'hasta=2026-13-01', 'desde=01/01/2026', 'desde=2026-1-1',
      'desde=2026-01-01&desde=2026-02-01', `desde=${hoyArgentina().slice(0, 4)}-12-31&hasta=${hoyArgentina().slice(0, 4)}-01-01`]) {
      const res = await api.get(`/reportes/avisos?${consulta}`, { token: usuarios.lector.token });
      assert.equal(res.status, 400, consulta);
      assert.deepEqual(res.body, { success: false, error: 'Elegí un período válido.' }, consulta);
    }
  });

  it('avisos del RPAD: sin período, del 1/1 a hoy; sin sesión, 401', async () => {
    const hoy = hoyArgentina();
    const res = await api.get('/reportes/avisos', { token: usuarios.lector.token });
    esPdf(res);
    assert.ok(lineasPorHoja(res.body)[0].includes(`AVISOS DEL RPAD · DEL 01/01/${hoy.slice(0, 4)} AL ${formatoCorto(hoy)}`));
    const nombre = `Avisos-RPAD-${hoy}.pdf`;
    assert.equal(res.headers.get('content-disposition'), `attachment; filename="${nombre}"; filename*=UTF-8''${nombre}`);
    assert.equal((await api.get('/reportes/avisos')).status, 401);
  });

  it('por área', async () => {
    const [area] = await query('SELECT area_id AS id FROM datasets WHERE activo = 1 LIMIT 1');
    esPdf(await api.get(`/reportes/por-area/${area.id}`, { token: usuarios.adminA.token }));
  });

  // Salen el Cumplimiento (spec 2026-10-24-metricas-y-reportes, 5: el ranking de áreas ya está en Métricas) y el Historial de
  // notificaciones (lo reemplaza Avisos del RPAD)
  it('cumplimiento e historial-notificaciones dan 404', async () => {
    for (const ruta of ['/reportes/cumplimiento?periodo=mensual', '/reportes/cumplimiento', '/reportes/historial-notificaciones?desde=2025-01-01&hasta=2026-12-31',
      '/reportes/historial-notificaciones']) {
      const res = await api.get(ruta, { token: usuarios.adminA.token });
      assert.equal(res.status, 404, ruta);
      assert.deepEqual(res.body, { success: false, error: 'Ruta no encontrada' }, ruta);
    }
  });
});

// Spec 2026-10-17-fechas-datasets, sección 11: donde un PDF lista la próxima, suma "Datos al" (con datos de los 80 datasets
// reales; el set controlado con los valores exactos está en estados-api.test.js)
// El nombre del archivo del Estado general (y del Por área) lleva la fecha de hoy en Argentina, la misma del PDF, no la del reloj del
// servidor (en un servidor en UTC, después de las 21 decía mañana). El servidor de prueba corre en una zona en la que ahora es otro día
// que en Argentina: UTC-12 (9 horas antes; hasta las 9 de la mañana de Argentina es ayer) o UTC+14 (17 horas después; desde las 7 ya
// es mañana)
describe('reportes PDF: el nombre del Estado general y del Por área', () => {
  // Un servidor de prueba en una zona horaria en la que ahora es otro día que en Argentina
  const servidorEnOtroDia = () => {
    const hoy = hoyArgentina();
    const fechaEn = (zona) => new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return iniciarServidor({ env: { TZ: ['Etc/GMT+12', 'Etc/GMT-14'].find((z) => fechaEn(z) !== hoy) } });
  };

  it('lleva la fecha de hoy en Argentina, con el formato de siempre (estado-general-dd-mm-aaaa.pdf)', async () => {
    const otro = await servidorEnOtroDia();
    try {
      const res = await crearCliente(otro.url).get('/reportes/estado-general', { token: usuarios.lector.token });
      esPdf(res);
      assert.equal(res.headers.get('content-disposition'), `attachment; filename=estado-general-${formatoCorto(hoyArgentina()).replace(/\//g, '-')}.pdf`);
    } finally {
      await otro.detener();
    }
  });

  it('el del Por área también: Reporte-area-<id>-AAAA-MM-DD.pdf, con la fecha de hoy en Argentina', async () => {
    const [area] = await query('SELECT area_id AS id FROM datasets WHERE activo = 1 LIMIT 1');
    const otro = await servidorEnOtroDia();
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
