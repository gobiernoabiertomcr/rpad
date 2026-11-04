// La firma digital por la API (spec 2026-11-03-notas-firma-digital, 4.5 a 4.11): subir el PDF firmado de una nota, verlo y enviarlo, el servidor
// real contra una base de prueba propia + Mailpit. Las notas llevan los PDF de tests/fixtures/firma-digital/ (datos inventados)
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query, mailpit, db, MAILPIT_URL
} from './helpers.js';
import { crearNota, limpiarBase, configurarNotas } from './notas-fixtures.js';

const leer = (archivo) => fs.readFileSync(new URL(`./fixtures/firma-digital/${archivo}`, import.meta.url));
const ORIGINAL_A = leer('nota-a.pdf');
const ORIGINAL_B = leer('nota-b.pdf');
const FIRMADA_A = leer('nota-a-firmada.pdf');
const FIRMADA_B = leer('nota-b-firmada.pdf');
const BLOQUEO = 'rpad_notas_digitales';
const HOY = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
let base, servidor, api, usuarios, motor, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_notas_firma_api');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, { adminA: 'admin', lector: 'lector', colaborador: 'colaborador', editor: 'editor', superadmin: 'superadmin' });
  motor = await import('../services/notasDigitales.js');
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  await servidor?.detener();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

// Una nota que espera la firma, con el PDF de la fixture
const notaQueEspera = async ({ numero = 12, pdf = ORIGINAL_A, fecha = HOY, estado = 'pendiente', espera = 1 } = {}) => {
  const id = await crearNota({ tipo: 'aviso', gestion: 'interna', fecha, numero, anio: Number(fecha.slice(0, 4)), estado, intentos: 0 });
  await query('UPDATE notas_digitales SET pdf = ?, espera_firma = ?, para = ?, asunto = ?, html = ?, texto = ? WHERE id = ?', [
    pdf, espera, 'mit@rpad.test', `Nota Digital N° ${numero}`, '<p style="color:#800000">SE ADJUNTA NOTA EN PDF</p><p>Cuerpo</p>', 'SE ADJUNTA NOTA EN PDF\n\nCuerpo', id
  ]);
  return id;
};

const comoAdmin = () => ({ token: usuarios.adminA.token });

// Sube un archivo por multipart, como la página. nombre: el del archivo, que el RPAD no usa
const subir = async (id, contenido, { token = usuarios.adminA.token, nombre = 'document.pdf', soloVerificar = false } = {}) => {
  const datos = new FormData();
  if (soloVerificar) datos.append('solo_verificar', '1');
  if (contenido) datos.append('archivo', new Blob([contenido], { type: 'application/pdf' }), nombre);
  const res = await fetch(`${servidor.url}/api/notificaciones/notas-digitales/${id}/firmada`, {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: datos
  });
  return { status: res.status, body: await res.json() };
};
const enviar = (ids, opciones = comoAdmin()) => api.post('/notificaciones/notas-digitales/firmadas/enviar', { ids }, opciones);
const fila = async (id) => (await query(
  `SELECT estado, espera_firma, intentos, pdf, pdf_firmado, firmado_por, DATE_FORMAT(firmado_at, '%Y-%m-%d %H:%i:%s') AS firmado_at, firma_subida_por
   FROM notas_digitales WHERE id = ?`, [id]))[0];
const mensajes = async () => {
  await new Promise(r => setTimeout(r, 150));
  return mailpit.mensajes();
};

beforeEach(async () => {
  process.env.EMAIL_SOLO_A = '';
  await limpiarBase();
  await configurarNotas({ firma_digital_activa: 1 });
  await mailpit.vaciar();
});

describe('subir el PDF firmado de una nota', () => {
  it('se llame como se llame: guarda la copia firmada, no envía nada y pdf queda igual', async () => {
    const id = await notaQueEspera();
    const res = await subir(id, FIRMADA_A, { nombre: 'documento raro (3).pdf' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'Guardada. Falta enviarla.');
    assert.equal(res.body.data.firmado_por, 'Julieta Ferreyra');
    assert.equal(res.body.data.archivo, 'Nota-Digital-12-' + String(HOY.slice(2, 4)) + '.pdf');
    assert.equal(res.body.data.guardada, true);
    const nota = await fila(id);
    assert.ok(nota.pdf_firmado.equals(FIRMADA_A));
    assert.ok(nota.pdf.equals(ORIGINAL_A));
    assert.equal(nota.firmado_por, 'Julieta Ferreyra');
    assert.match(nota.firmado_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.equal(nota.firma_subida_por, usuarios.adminA.id);
    assert.deepEqual([nota.estado, nota.espera_firma, nota.intentos], ['pendiente', 1, 0]);
    assert.equal((await mensajes()).length, 0, 'subir no envía nada');
  });

  it('solo_verificar dice lo mismo y no escribe nada', async () => {
    const id = await notaQueEspera();
    const res = await subir(id, FIRMADA_A, { soloVerificar: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.firmado_por, 'Julieta Ferreyra');
    assert.equal(res.body.data.guardada, false);
    const nota = await fila(id);
    assert.deepEqual([nota.pdf_firmado, nota.firmado_por, nota.firmado_at, nota.firma_subida_por], [null, null, null, null]);
    assert.equal((await mensajes()).length, 0);
  });

  it('el PDF firmado de otra nota: lo rechaza, la nombra y no guarda nada en ninguna de las dos', async () => {
    const a = await notaQueEspera({ numero: 12, pdf: ORIGINAL_A });
    const b = await notaQueEspera({ numero: 13, pdf: ORIGINAL_B });
    const anio = HOY.slice(2, 4);
    for (const soloVerificar of [true, false]) {
      const res = await subir(a, FIRMADA_B, { soloVerificar });
      assert.equal(res.status, 400);
      assert.equal(res.body.error, `Ese PDF es la Nota Digital N° 13/${anio}, no la 12/${anio}. No se guardó nada.`);
    }
    assert.equal((await fila(a)).pdf_firmado, null);
    assert.equal((await fila(b)).pdf_firmado, null);
  });

  it('la nota sin firmar, una firma que no verifica u otro PDF: el mensaje de cada uno', async () => {
    const id = await notaQueEspera();
    const sinFirma = await subir(id, ORIGINAL_A);
    assert.deepEqual([sinFirma.status, sinFirma.body.error], [400, 'Ese PDF es esta nota, pero no tiene firma digital. Firmala y volvé a subirla.']);
    const alterada = Buffer.from(FIRMADA_A);
    alterada[ORIGINAL_A.length + 3] ^= 1;
    const mala = await subir(id, alterada);
    assert.deepEqual([mala.status, mala.body.error], [400, 'La firma de ese PDF no se pudo verificar. Volvé a firmarla.']);
    const otro = await subir(id, Buffer.from('%PDF-1.3 otra cosa'));
    assert.deepEqual([otro.status, otro.body.error], [400, 'Ese PDF no es esta nota. No se guardó nada.']);
    assert.equal((await fila(id)).pdf_firmado, null);
  });

  it('volver a subirla reemplaza la copia, mientras no salió', async () => {
    const id = await notaQueEspera();
    await subir(id, FIRMADA_A);
    const otraFirma = Buffer.concat([FIRMADA_A]);
    assert.equal((await subir(id, otraFirma)).status, 200);
    assert.ok((await fila(id)).pdf_firmado.equals(otraFirma));
  });

  it('una nota que ya salió, que no espera o que no existe: nada', async () => {
    const salio = await notaQueEspera({ estado: 'enviada', espera: 0 });
    const res = await subir(salio, FIRMADA_A);
    assert.deepEqual([res.status, res.body.error], [409, 'Esta nota ya salió.']);
    assert.equal((await subir(999999, FIRMADA_A)).status, 404);
    assert.equal((await subir('abc', FIRMADA_A)).status, 404);
    const prueba = await crearNota({ tipo: 'aviso', gestion: 'interna', fecha: HOY, esPrueba: 1, estado: 'pendiente', intentos: 0 });
    assert.equal((await subir(prueba, FIRMADA_A)).status, 404);
  });

  it('sin archivo, con uno de más de 10 MB o en otro campo: 400 en español', async () => {
    const id = await notaQueEspera();
    const sinArchivo = await subir(id, null);
    assert.deepEqual([sinArchivo.status, sinArchivo.body.error], [400, 'Elegí el PDF firmado.']);
    const grande = await subir(id, Buffer.alloc(10 * 1024 * 1024 + 1));
    assert.deepEqual([grande.status, grande.body.error], [400, 'El archivo excede el tamaño máximo de 10 MB']);
    const datos = new FormData();
    datos.append('otro', new Blob([FIRMADA_A]), 'x.pdf');
    const res = await fetch(`${servidor.url}/api/notificaciones/notas-digitales/${id}/firmada`, {
      method: 'POST', headers: { Authorization: `Bearer ${usuarios.adminA.token}` }, body: datos
    });
    assert.equal(res.status, 400);
    assert.equal((await fila(id)).pdf_firmado, null);
  });

  it('un pedido que no se puede leer no rompe nada', async () => {
    const id = await notaQueEspera();
    const res = await fetch(`${servidor.url}/api/notificaciones/notas-digitales/${id}/firmada`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${usuarios.adminA.token}`, 'Content-Type': 'multipart/form-data; boundary=x' },
      body: '--x\r\nmal armado'
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).success, false);
  });

  it('con otra corrida en curso, 409 y no guarda nada; verificar sí responde', async () => {
    const id = await notaQueEspera();
    const conexion = await db().getConnection();
    await conexion.query('SELECT GET_LOCK(?, 0)', [BLOQUEO]);
    try {
      assert.equal((await subir(id, FIRMADA_A, { soloVerificar: true })).status, 200);
      const res = await subir(id, FIRMADA_A);
      assert.deepEqual([res.status, res.body.error], [409, 'Hay una corrida de Notas Digitales en curso. Probá de nuevo en unos minutos.']);
    } finally {
      await conexion.query('SELECT RELEASE_LOCK(?)', [BLOQUEO]);
      conexion.release();
    }
    assert.equal((await fila(id)).pdf_firmado, null);
  });
});

describe('enviar las firmadas', () => {
  it('sale con el nombre de siempre, con la línea, y pdf y html quedan como estaban', async () => {
    const id = await notaQueEspera();
    await subir(id, FIRMADA_A, { nombre: 'document (7).pdf' });
    const res = await enviar([id]);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.resultados.map(r => [r.nota_id, r.ok]), [[id, true]]);
    assert.match(res.body.data.resultados[0].mensaje, /enviada, firmada digitalmente\.$/);
    const nota = await fila(id);
    assert.deepEqual([nota.estado, nota.espera_firma], ['enviada', 0]);
    assert.ok(nota.pdf.equals(ORIGINAL_A));
    const [mail] = await mensajes();
    assert.deepEqual(mail.To.map(t => t.Address), ['mit@rpad.test']);
    const detalle = await (await fetch(`${MAILPIT_URL}/api/v1/message/${mail.ID}`)).json();
    assert.deepEqual(detalle.Attachments.map(a => a.FileName), [`Nota-Digital-12-${HOY.slice(2, 4)}.pdf`]);
    const adjunto = Buffer.from(await (await fetch(`${MAILPIT_URL}/api/v1/message/${mail.ID}/part/${detalle.Attachments[0].PartID}`)).arrayBuffer());
    assert.ok(adjunto.equals(FIRMADA_A));
    assert.ok(detalle.HTML.includes('La nota está firmada digitalmente por Julieta Ferreyra.'));
    const [{ html }] = await query('SELECT html FROM notas_digitales WHERE id = ?', [id]);
    assert.ok(!html.includes('firmada digitalmente'));
  });

  it('solo manda las de esa lista, firmadas y que esperan; dos veces no la manda dos veces', async () => {
    const firmada = await notaQueEspera({ numero: 12, pdf: ORIGINAL_A });
    const sinFirmar = await notaQueEspera({ numero: 13, pdf: ORIGINAL_B });
    await subir(firmada, FIRMADA_A);
    const res = await enviar([firmada, sinFirmar, 999999]);
    assert.deepEqual(res.body.data.resultados.map(r => r.nota_id), [firmada]);
    assert.equal((await fila(sinFirmar)).estado, 'pendiente');
    const otra = await enviar([firmada]);
    assert.equal(otra.status, 200);
    assert.deepEqual(otra.body.data.resultados, []);
    assert.equal((await mensajes()).length, 1);
  });

  it('una firmada que no está en la lista no sale', async () => {
    const a = await notaQueEspera({ numero: 12, pdf: ORIGINAL_A });
    const b = await notaQueEspera({ numero: 13, pdf: ORIGINAL_B });
    await subir(a, FIRMADA_A);
    await subir(b, FIRMADA_B);
    await enviar([b]);
    assert.equal((await fila(a)).estado, 'pendiente');
    assert.equal((await fila(b)).estado, 'enviada');
  });

  it('una lista vacía o que no sirve: 400', async () => {
    for (const ids of [[], null, 'x', [0], ['a']]) {
      assert.equal((await enviar(ids)).status, 400, JSON.stringify(ids));
    }
  });

  it('si el email no sale: queda fallida y firmada, «Reintentar» y las 14:00 la mandan firmada', async () => {
    const id = await notaQueEspera();
    await subir(id, FIRMADA_A);
    process.env.EMAIL_SOLO_A = 'otra-casilla@rpad.test';
    // El servidor es otro proceso: el fallo se simula en este, llamando al servicio directo
    const { resultados } = await motor.enviarNotasFirmadas({ ids: [id] });
    assert.deepEqual(resultados.map(r => r.ok), [false]);
    assert.match(resultados[0].mensaje, /quedó firmada, pero el email no salió\. Se vuelve a intentar en la próxima corrida\.$/);
    const nota = await fila(id);
    assert.deepEqual([nota.estado, nota.espera_firma], ['fallida', 0]);
    assert.ok(nota.pdf_firmado.equals(FIRMADA_A));
    process.env.EMAIL_SOLO_A = '';
    const re = await api.post(`/notificaciones/notas-digitales/${id}/reintentar`, {}, comoAdmin());
    assert.equal(re.status, 200);
    const [mail] = await mensajes();
    const detalle = await (await fetch(`${MAILPIT_URL}/api/v1/message/${mail.ID}`)).json();
    assert.ok(detalle.HTML.includes('firmada digitalmente'));
  });

  it('con otra corrida en curso, 409 y no envía', async () => {
    const id = await notaQueEspera();
    await subir(id, FIRMADA_A);
    const conexion = await db().getConnection();
    await conexion.query('SELECT GET_LOCK(?, 0)', [BLOQUEO]);
    try {
      assert.equal((await enviar([id])).status, 409);
    } finally {
      await conexion.query('SELECT RELEASE_LOCK(?)', [BLOQUEO]);
      conexion.release();
    }
    assert.equal((await fila(id)).estado, 'pendiente');
  });

  it('subida y sin confirmar: a las 14:00 sale firmada, con la línea', async () => {
    const id = await notaQueEspera();
    await subir(id, FIRMADA_A);
    const { CALENDARIO_FIJO } = await import('../services/notasDigitalesCalendario.js');
    const resumen = await motor.enviarLasQueEsperanFirma({ hoy: '2026-12-01', ahora: '2026-12-01 14:00:00', calendario: CALENDARIO_FIJO });
    assert.equal(resumen.enviadas, 1);
    const [mail] = await mensajes();
    const detalle = await (await fetch(`${MAILPIT_URL}/api/v1/message/${mail.ID}`)).json();
    assert.ok(detalle.HTML.includes('La nota está firmada digitalmente por Julieta Ferreyra.'));
  });
});

describe('lo demás de Correos', () => {
  it('«Reintentar» no sirve de atajo: 409 con una nota que espera', async () => {
    const id = await notaQueEspera();
    const res = await api.post(`/notificaciones/notas-digitales/${id}/reintentar`, {}, comoAdmin());
    assert.deepEqual([res.status, res.body.error], [409, 'Esta nota espera la firma digital: sale sola a las 14:00.']);
    assert.equal((await fila(id)).estado, 'pendiente');
  });

  it('el Libro dice quién firmó, sin los bytes; «PDF» baja la firmada si está, con el nombre de siempre', async () => {
    const id = await notaQueEspera();
    const antes = await api.get(`/notificaciones/notas-digitales/${id}/pdf`, comoAdmin());
    assert.ok(antes.body.equals(ORIGINAL_A));
    await subir(id, FIRMADA_A);
    const lista = await api.get('/notificaciones/notas-digitales', comoAdmin());
    const [nota] = lista.body.data;
    assert.equal(nota.espera_firma, true);
    assert.equal(nota.firmado_por, 'Julieta Ferreyra');
    assert.match(nota.firmado_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    assert.ok(!('pdf_firmado' in nota));
    const detalle = await api.get(`/notificaciones/notas-digitales/${id}`, comoAdmin());
    assert.equal(detalle.body.data.firmado_por, 'Julieta Ferreyra');
    assert.ok(!('pdf_firmado' in detalle.body.data));
    const pdf = await api.get(`/notificaciones/notas-digitales/${id}/pdf`, comoAdmin());
    assert.ok(pdf.body.equals(FIRMADA_A));
    assert.match(pdf.headers.get('content-disposition'), /filename="Nota-Digital-12-\d\d\.pdf"/);
  });

  it('el interruptor se guarda, se lee y no depende de la configuración completa', async () => {
    const off = await api.put('/notificaciones/notas-digitales/config', { firma_digital_activa: false }, comoAdmin());
    assert.equal(off.status, 200);
    assert.equal(off.body.data.firma_digital_activa, false);
    const on = await api.put('/notificaciones/notas-digitales/config', { firma_digital_activa: true }, comoAdmin());
    assert.equal(on.body.data.firma_digital_activa, true);
    assert.equal((await api.get('/notificaciones/notas-digitales/estado', comoAdmin())).body.data.firma_digital_activa, true);
  });

  it('solo administración: el lector y el colaborador, 403; sin sesión, 401; el editor, sí', async () => {
    const id = await notaQueEspera();
    assert.equal((await subir(id, FIRMADA_A, { token: null })).status, 401);
    assert.equal((await subir(id, FIRMADA_A, { token: usuarios.lector.token })).status, 403);
    assert.equal((await subir(id, FIRMADA_A, { token: usuarios.colaborador.token })).status, 403);
    assert.equal((await enviar([id], { token: usuarios.lector.token })).status, 403);
    assert.equal((await enviar([id], {})).status, 401);
    assert.equal((await subir(id, FIRMADA_A, { token: usuarios.editor.token })).status, 200);
  });
});
