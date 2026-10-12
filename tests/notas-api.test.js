// API de Notas Digitales (servidor real contra una base de prueba propia)
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query, mailpit, db
} from './helpers.js';
import { crearDataset, limpiarBase, configurarNotas } from './notas-fixtures.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const BLOQUEO = 'rpad_notas_digitales';
let base, servidor, api, usuarios, motor, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_notas_api');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api);
  motor = await import('../services/notasDigitales.js');
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  await servidor?.detener();
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  process.env.EMAIL_SOLO_A = '';
  await limpiarBase();
  // La firma se borra en cada prueba: una imagen guardada por una prueba no debe verse en la siguiente
  await configurarNotas({ firma_imagen: null, firma_mime: null });
  await mailpit.vaciar();
});

const comoAdmin = () => ({ token: usuarios.adminA.token });

describe('configuración', () => {
  it('devuelve la configuración sin la imagen de la firma', async () => {
    const res = await api.get('/notificaciones/notas-digitales/config', comoAdmin());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.para_interna, 'mit@rpad.test');
    assert.equal(res.body.data.tiene_firma, false);
    assert.equal('firma_imagen' in res.body.data, false);
  });

  it('normaliza listas de direcciones y rechaza las inválidas sin guardar', async () => {
    const ok = await api.put('/notificaciones/notas-digitales/config', { cc_interna: ' a@x.gov.ar; b@y.gov.ar ' }, comoAdmin());
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.cc_interna, 'a@x.gov.ar, b@y.gov.ar');

    const mal = await api.put('/notificaciones/notas-digitales/config', { para_interna: 'no-es-un-email', cco: 'c@z.gov.ar' }, comoAdmin());
    assert.equal(mal.status, 400);
    const [config] = await query('SELECT para_interna, cco FROM notas_digitales_config WHERE id = 1');
    assert.deepEqual(config, { para_interna: 'mit@rpad.test', cco: 'respaldo@rpad.test' });
  });

  it('el Para es obligatorio', async () => {
    const res = await api.put('/notificaciones/notas-digitales/config', { para_externa: '' }, comoAdmin());
    assert.equal(res.status, 400);
  });

  it('no deja activar el envío con la configuración incompleta', async () => {
    await configurarNotas({ envio_activo: 0, firma_nombre: '' });
    const res = await api.put('/notificaciones/notas-digitales/config', { envio_activo: true }, comoAdmin());
    assert.equal(res.status, 400);
    assert.match(res.body.error, /nombre de la firma/);
  });

  it('guarda una firma PNG y la devuelve', async () => {
    const res = await api.put('/notificaciones/notas-digitales/config/firma', { imagen: `data:image/png;base64,${PNG.toString('base64')}`, mime: 'image/png' }, comoAdmin());
    assert.equal(res.status, 200);
    const firma = await api.get('/notificaciones/notas-digitales/config/firma', comoAdmin());
    assert.equal(firma.status, 200);
    assert.match(firma.headers.get('content-type'), /image\/png/);
    assert.deepEqual(firma.body, PNG);
  });

  it('rechaza firmas que no son PNG o JPEG, base64 inválido o más de 500 KB', async () => {
    const enviar = (imagen, mime) => api.put('/notificaciones/notas-digitales/config/firma', { imagen, mime }, comoAdmin());
    assert.equal((await enviar(PNG.toString('base64'), 'image/gif')).status, 400);
    assert.equal((await enviar('esto no es base64!!', 'image/png')).status, 400);
    assert.equal((await enviar(Buffer.from('texto plano').toString('base64'), 'image/png')).status, 400);
    const grande = Buffer.concat([PNG, Buffer.alloc(600 * 1024)]);
    assert.equal((await enviar(grande.toString('base64'), 'image/png')).status, 400);
    assert.equal((await query('SELECT firma_imagen FROM notas_digitales_config WHERE id = 1'))[0].firma_imagen, null);
  });
});

describe('vista previa y prueba', () => {
  it('la vista previa devuelve el HTML con número XX', async () => {
    const res = await api.get('/notificaciones/notas-digitales/preview?tipo=aviso&gestion=interna', comoAdmin());
    assert.equal(res.status, 200);
    assert.ok(res.body.data.html.includes('XX'));
  });

  it('rechaza tipo o gestión inválidos', async () => {
    const res = await api.get('/notificaciones/notas-digitales/preview?tipo=otro&gestion=interna', comoAdmin());
    assert.equal(res.status, 400);
  });

  it('la prueba va a las casillas de prueba y queda oculta en el libro salvo que se pida', async () => {
    const res = await api.post('/notificaciones/notas-digitales/prueba', { tipo: 'aviso', gestion: 'externa' }, comoAdmin());
    assert.equal(res.status, 200);
    const [mensaje] = await mailpit.mensajes();
    assert.deepEqual(mensaje.To.map(t => t.Address), ['prueba@rpad.test']);
    assert.equal((await api.get('/notificaciones/notas-digitales', comoAdmin())).body.data.length, 0);
    assert.equal((await api.get('/notificaciones/notas-digitales?incluir_pruebas=1', comoAdmin())).body.data.length, 1);
  });

  it('sin casillas de prueba responde 400', async () => {
    await configurarNotas({ casillas_prueba: '' });
    const res = await api.post('/notificaciones/notas-digitales/prueba', { tipo: 'aviso', gestion: 'interna' }, comoAdmin());
    assert.equal(res.status, 400);
  });
});

describe('libro', () => {
  it('lista, muestra el detalle, descarga el PDF y filtra por dataset', async () => {
    const incluido = await crearDataset({ vencimiento: '2026-12-31' });
    const otro = await crearDataset({ vencimiento: '2027-10-31' });
    await motor.ejecutarNotasDigitales({ hoy: '2026-11-02' });

    const lista = await api.get('/notificaciones/notas-digitales', comoAdmin());
    assert.equal(lista.status, 200);
    assert.equal(lista.body.data.length, 1);
    const [fila] = lista.body.data;
    assert.equal(fila.numero, 1);
    assert.equal(fila.estado, 'enviada');
    assert.equal(fila.cantidad_datasets, 1);

    const detalle = await api.get(`/notificaciones/notas-digitales/${fila.id}`, comoAdmin());
    assert.ok(detalle.body.data.html.includes('Nota Digital N°</b> 1/26'));
    assert.deepEqual(detalle.body.data.datasets.map(d => d.dataset_id), [incluido]);

    const pdf = await api.get(`/notificaciones/notas-digitales/${fila.id}/pdf`, comoAdmin());
    assert.match(pdf.headers.get('content-type'), /application\/pdf/);
    assert.equal(pdf.body.subarray(0, 5).toString(), '%PDF-');

    const filtrada = await api.get(`/notificaciones/notas-digitales?dataset_id=${incluido}`, comoAdmin());
    assert.equal(filtrada.body.data[0].seccion_dataset, 'proximo');
    assert.equal((await api.get(`/notificaciones/notas-digitales?dataset_id=${otro}`, comoAdmin())).body.data.length, 0);
  });

  it('no reintenta una nota ya enviada y responde 404 para una inexistente', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await motor.ejecutarNotasDigitales({ hoy: '2026-11-02' });
    const [nota] = await query('SELECT id FROM notas_digitales');
    assert.equal((await api.post(`/notificaciones/notas-digitales/${nota.id}/reintentar`, {}, comoAdmin())).status, 400);
    assert.equal((await api.get('/notificaciones/notas-digitales/999999', comoAdmin())).status, 404);
  });

  it('el reintento manual responde 409 y no toca la nota mientras otra corrida tiene el bloqueo', async () => {
    // Deja una nota real en estado 'fallida': el envío se bloquea con EMAIL_SOLO_A
    await crearDataset({ vencimiento: '2026-12-31' });
    process.env.EMAIL_SOLO_A = 'nadie@rpad.test';
    await motor.ejecutarNotasDigitales({ hoy: '2026-11-02' });
    process.env.EMAIL_SOLO_A = '';
    const [nota] = await query('SELECT id, estado, intentos FROM notas_digitales');
    assert.equal(nota.estado, 'fallida');

    // Otra conexión (otro proceso) tiene el bloqueo de las corridas
    const ajena = await db().getConnection();
    try {
      const [[{ tomado }]] = await ajena.query('SELECT GET_LOCK(?, 0) AS tomado', [BLOQUEO]);
      assert.equal(Number(tomado), 1);

      const res = await api.post(`/notificaciones/notas-digitales/${nota.id}/reintentar`, {}, comoAdmin());
      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /corrida/);

      const [despues] = await query('SELECT estado, intentos FROM notas_digitales WHERE id = ?', [nota.id]);
      assert.equal(despues.estado, 'fallida');
      assert.equal(despues.intentos, nota.intentos);
      assert.equal((await mailpit.mensajes()).length, 0);
    } finally {
      await ajena.query('SELECT RELEASE_LOCK(?)', [BLOQUEO]);
      ajena.release();
    }
  });

  it('el indicador de Gestión cuenta las notas enviadas', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await motor.ejecutarNotasDigitales({ hoy: '2026-11-02' });
    const res = await api.get('/gestion/metricas', { token: usuarios.lector.token });
    const total = res.body.data.notificaciones_por_mes.reduce((s, r) => s + r.cantidad, 0);
    assert.equal(total, 1);
  });
});

describe('aviso a las áreas', () => {
  it('la prueba va solo a las casillas de prueba', async () => {
    const res = await api.post('/notificaciones/prueba-area', {}, comoAdmin());
    assert.equal(res.status, 200);
    const [mensaje] = await mailpit.mensajes();
    assert.deepEqual(mensaje.To.map(t => t.Address), ['prueba@rpad.test']);
    assert.match(mensaje.Subject, /^\[PRUEBA\] /);
  });
});
