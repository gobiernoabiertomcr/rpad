// La subida de Proyectos (config/upload.js, spec 2026-10-25-proyectos, arreglos 2 y 12): `subida('proyecto')` y `subida('hito')` de
// verdad, en un servidor Express propio, sin base ni sesión, con UPLOADS_DIR en una carpeta temporal. Acá los archivos llegan mientras
// multer lee el pedido (en la API, la sesión y la base demoran el comienzo de la lectura y el pedido suele estar entero cuando multer
// empieza), que es cuando aparecían las dos fallas de la revisión: un archivo que llegaba después de un error se escribía igual (entero
// o a medias), y quien seguía mandando recibía un corte de la conexión en lugar del 400. Después de cualquier error, la carpeta queda
// exactamente como estaba y llega el 400 con su mensaje. Son carreras: cada caso se repite.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const REPETICIONES = 10;
const MB = 1024 * 1024;

let carpeta, servidor, base, subida;
let ultimo = 0;

before(async () => {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'rpad-subida-'));
  process.env.UPLOADS_DIR = carpeta;
  ({ subida } = await import('../config/upload.js'));
  const app = express();
  // Lo que deja prepararSubida…: la carpeta con el id y los lugares (?lugares=, por defecto el máximo)
  const preparar = (tipo, maximo) => (req, res, next) => {
    const id = Number(req.params.id);
    req.subida = { id, carpeta: `${tipo === 'proyecto' ? 'proyectos' : 'hitos'}/${id}`, lugares: Number(req.query.lugares ?? maximo) };
    next();
  };
  const listo = (req, res) => res.status(201).json({
    success: true, data: req.files.map((f) => ({ nombre: f.originalname, filename: f.filename, size: f.size }))
  });
  app.post('/proyecto/:id', preparar('proyecto', 10), subida('proyecto'), listo);
  app.post('/hito/:id', preparar('hito', 3), subida('hito'), listo);
  await new Promise((resolver) => { servidor = app.listen(0, "127.0.0.1", resolver); });
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
  await new Promise((resolver) => servidor.close(resolver));
  fs.rmSync(carpeta, { recursive: true, force: true });
});

const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));
const pdfDe = (nombre, tamano) => new File([Buffer.alloc(tamano, 0x41)], nombre, { type: 'application/pdf' });
const exe = () => new File([Buffer.from('MZ [TEST]')], 'programa.exe', { type: 'application/x-msdownload' });
// Un .pdf con un MIME que no está permitido: pasa la extensión y lo rechaza el MIME
const pdfDeWindows = () => new File([Buffer.from('MZ [TEST]')], 'falso.pdf', { type: 'application/x-msdownload' });
// Un .csv con cada MIME con que lo mandan los navegadores (Ruling R15): Windows con Excel instalado, application/vnd.ms-excel; Linux y
// Android, text/x-csv, application/csv o text/comma-separated-values
const MIMES_DE_CSV = ['text/csv', 'application/vnd.ms-excel', 'text/x-csv', 'application/csv', 'text/comma-separated-values'];
const csvCon = (mime, nombre = 'tabla.csv') => new File([Buffer.from('a,b\n1,2\n')], nombre, { type: mime });

// Sube [campo, File] (o File, al campo «archivos») a /<tipo>/<id>; un corte de la conexión falla el test
const subir = async (ruta, archivos) => {
  const formulario = new FormData();
  for (const archivo of archivos) {
    const [campo, file] = Array.isArray(archivo) ? archivo : ['archivos', archivo];
    formulario.append(campo, file);
  }
  const res = await fetch(`${base}${ruta}`, { method: 'POST', body: formulario, signal: AbortSignal.timeout(20000) });
  return { status: res.status, body: await res.json() };
};

const enCarpeta = (relativa) => {
  const dir = path.join(carpeta, relativa);
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
};

// Repite una subida que falla, cada vez a una carpeta nueva que ya tiene un archivo: el 400 con su mensaje, y la carpeta sin cambios al
// responder y un rato después de la última
const fallaSinTocarLaCarpeta = async ({ tipo = 'proyecto', archivos, mensaje, lugares, veces = REPETICIONES }) => {
  const carpetas = [];
  for (let vez = 1; vez <= veces; vez++) {
    const id = ++ultimo;
    const relativa = `${tipo === 'proyecto' ? 'proyectos' : 'hitos'}/${id}`;
    fs.mkdirSync(path.join(carpeta, relativa), { recursive: true });
    fs.writeFileSync(path.join(carpeta, relativa, 'previo.pdf'), 'previo');
    carpetas.push(relativa);
    const res = await subir(`/${tipo}/${id}${lugares ? `?lugares=${lugares}` : ''}`, archivos());
    assert.equal(res.status, 400, `vez ${vez}: ${JSON.stringify(res.body)}`);
    assert.deepEqual(res.body, { success: false, error: mensaje }, `vez ${vez}`);
    assert.deepEqual(enCarpeta(relativa), ['previo.pdf'], `vez ${vez}, al responder`);
  }
  await esperar(300);
  for (const relativa of carpetas) assert.deepEqual(enCarpeta(relativa), ['previo.pdf'], `${relativa}, un rato después`);
};

describe('subida: una que anda', () => {
  it('guarda los archivos con un nombre único y el nombre original arreglado (tildes)', async () => {
    const id = ++ultimo;
    const res = await subir(`/proyecto/${id}`, [pdfDe('presentación final.pdf', 1000), pdfDe('dos.pdf', 2000)]);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.map((f) => f.nombre), ['presentación final.pdf', 'dos.pdf']);
    assert.deepEqual(res.body.data.map((f) => f.size), [1000, 2000]);
    for (const f of res.body.data) assert.match(f.filename, /^[0-9a-f-]{36}\.pdf$/);
    assert.deepEqual(enCarpeta(`proyectos/${id}`), res.body.data.map((f) => f.filename).sort());
  });

  it('un .csv se guarda con cualquiera de los MIME con que lo mandan Windows (Excel), Linux y Android (Ruling R15)', async () => {
    const id = ++ultimo;
    const archivos = MIMES_DE_CSV.map((mime, i) => csvCon(mime, `tabla-${i}.csv`));
    const res = await subir(`/proyecto/${id}`, archivos);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.map((f) => f.nombre), archivos.map((a) => a.name));
    assert.equal(enCarpeta(`proyectos/${id}`).length, MIMES_DE_CSV.length);
  });

  it('[pdf, csv con el MIME de Excel, pdf, pdf]: se guardan los cuatro', async () => {
    const id = ++ultimo;
    const res = await subir(`/proyecto/${id}`, [pdfDe('a.pdf', 50_000), csvCon('application/vnd.ms-excel'), pdfDe('c.pdf', 50_000), pdfDe('d.pdf', 50_000)]);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.map((f) => f.nombre), ['a.pdf', 'tabla.csv', 'c.pdf', 'd.pdf']);
    assert.equal(enCarpeta(`proyectos/${id}`).length, 4);
  });
});

describe('subida: un pedido que no se puede leer', () => {
  it('un multipart cortado: 400 con el mensaje en español y nada escrito', async () => {
    const id = ++ultimo;
    const res = await fetch(`${base}/proyecto/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=----limite' },
      body: '------limite\r\nContent-Disposition: form-data; name="archivos"; filename="a.pdf"\r\nContent-Type: application/pdf\r\n\r\n[TEST]',
      signal: AbortSignal.timeout(20000)
    });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { success: false, error: 'No se pudo leer la subida. Probá de nuevo.' });
    assert.deepEqual(enCarpeta(`proyectos/${id}`), []);
  });
});

describe('subida: una que falla deja la carpeta como estaba y responde el 400', () => {
  it('[pdf, exe, pdf]', () => fallaSinTocarLaCarpeta({
    archivos: () => [pdfDe('a.pdf', 200_000), exe(), pdfDe('c.pdf', 200_000)],
    mensaje: 'Tipo de archivo no permitido: .exe'
  }));

  it('[pdf, exe] (el rechazado al final)', () => fallaSinTocarLaCarpeta({
    archivos: () => [pdfDe('a.pdf', 200_000), exe()],
    mensaje: 'Tipo de archivo no permitido: .exe'
  }));

  it('[exe, pdf grande]', () => fallaSinTocarLaCarpeta({
    archivos: () => [exe(), pdfDe('grande.pdf', 300_000)],
    mensaje: 'Tipo de archivo no permitido: .exe'
  }));

  it('[pdf, pdf con un MIME no permitido, pdf, pdf]', () => fallaSinTocarLaCarpeta({
    archivos: () => [pdfDe('a.pdf', 50_000), pdfDeWindows(), pdfDe('c.pdf', 50_000), pdfDe('d.pdf', 50_000)],
    mensaje: 'El tipo de archivo de falso.pdf no está permitido.'
  }));

  it('[pdf de más de 10 MB, pdf]', () => fallaSinTocarLaCarpeta({
    archivos: () => [pdfDe('grande.pdf', 10 * MB + 1), pdfDe('c.pdf', 1000)],
    mensaje: 'El archivo excede el tamaño máximo de 10 MB',
    veces: 4
  }));

  it('[pdf, pdf de más de 10 MB, pdf]', () => fallaSinTocarLaCarpeta({
    archivos: () => [pdfDe('a.pdf', 200_000), pdfDe('grande.pdf', 10 * MB + 1), pdfDe('c.pdf', 1000)],
    mensaje: 'El archivo excede el tamaño máximo de 10 MB',
    veces: 4
  }));

  it('más archivos que lugares, grandes (a un hito con 1 lugar)', () => fallaSinTocarLaCarpeta({
    tipo: 'hito',
    lugares: 1,
    archivos: () => [pdfDe('a.pdf', 300_000), pdfDe('b.pdf', 300_000), pdfDe('c.pdf', 300_000)],
    mensaje: 'Podés subir hasta 3 archivos por hito.'
  }));

  it('un archivo con otro nombre de campo entre los PDF', () => fallaSinTocarLaCarpeta({
    archivos: () => [pdfDe('a.pdf', 200_000), ['otro', pdfDe('b.pdf', 1000)], pdfDe('c.pdf', 200_000)],
    mensaje: 'Podés subir hasta 10 documentos por proyecto.'
  }));
});
