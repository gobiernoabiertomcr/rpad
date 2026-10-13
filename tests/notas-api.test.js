// API de Notas Digitales (servidor real contra una base de prueba propia)
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query, mailpit, db
} from './helpers.js';
import { crearDataset, limpiarBase, configurarNotas, asegurarBaseDePrueba, PIE_MEMBRETE } from './notas-fixtures.js';
import { pngRgba, pngRgb, pngsDanados } from './firma-fixtures.js';
import { textosPorHoja, imagenesPorHoja, imagenesGuardadas } from './pdf-lector.js';
import { esDiaHabil, hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
// Banner del membrete generado para los tests (la imagen institucional no se versiona)
const BANNER = pngRgb({ ancho: 1241, alto: 178 });
const RUTA_MEMBRETE = '/notificaciones/notas-digitales/config/membrete';
// Cada hoja del PDF lleva el banner arriba (x = 0, y = 0) y el pie del membrete
const conMembreteEnCadaHoja = (pdf, pie) => {
  const imagenes = imagenesPorHoja(pdf);
  return textosPorHoja(pdf).every((lineas, i) => lineas.filter(t => t.texto === pie).length === 1
    && imagenes[i].filter(imagen => Math.abs(imagen.x) < 0.01 && Math.abs(imagen.y) < 0.01).length === 1);
};
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

  it('devuelve el pie del membrete y si hay banner, sin la imagen del banner', async () => {
    const res = await api.get('/notificaciones/notas-digitales/config', comoAdmin());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.membrete_pie, PIE_MEMBRETE);
    assert.equal(res.body.data.tiene_membrete, false);
    assert.equal('membrete_imagen' in res.body.data, false);
  });

  it('guarda un banner PNG, lo devuelve y la configuración indica que hay membrete', async () => {
    assert.equal((await api.get(RUTA_MEMBRETE, comoAdmin())).status, 404);
    const res = await api.put(RUTA_MEMBRETE, { imagen: `data:image/png;base64,${BANNER.toString('base64')}`, mime: 'image/png' }, comoAdmin());
    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Membrete guardado');

    const banner = await api.get(RUTA_MEMBRETE, comoAdmin());
    assert.equal(banner.status, 200);
    assert.match(banner.headers.get('content-type'), /image\/png/);
    assert.deepEqual(banner.body, BANNER);
    const config = (await api.get('/notificaciones/notas-digitales/config', comoAdmin())).body.data;
    assert.equal(config.tiene_membrete, true);
    assert.equal('membrete_imagen' in config, false);
    // El banner no toca la firma
    assert.equal(config.tiene_firma, false);
    assert.equal((await api.get('/notificaciones/notas-digitales/config/firma', comoAdmin())).status, 404);
  });

  it('un banner dañado, que no es PNG o JPEG o que pesa más de 500 KB da 400, no se guarda y el servidor sigue en pie', async () => {
    const enviar = (imagen, mime = 'image/png') => api.put(RUTA_MEMBRETE, { imagen, mime }, comoAdmin());
    for (const [caso, imagen] of Object.entries(pngsDanados())) {
      const res = await enviar(imagen.toString('base64'));
      assert.equal(res.status, 400, caso);
      assert.match(res.body.error, /^La imagen del membrete no es válida: /, caso);
    }
    assert.match((await enviar(BANNER.toString('base64'), 'image/gif')).body.error, /membrete debe ser una imagen PNG o JPEG/);
    for (const mime of ['constructor', '__proto__', ['image/png'], null]) {
      assert.equal((await enviar(BANNER.toString('base64'), mime)).status, 400, String(mime));
    }
    assert.equal((await api.put(RUTA_MEMBRETE, { imagen: BANNER.toString('base64') }, comoAdmin())).status, 400);
    assert.equal((await enviar('esto no es base64!!')).status, 400);
    assert.equal((await enviar(Buffer.from('texto plano').toString('base64'))).status, 400);
    assert.equal((await enviar(Buffer.concat([BANNER, Buffer.alloc(600 * 1024)]).toString('base64'))).status, 400);
    assert.equal((await enviar({ a: 1 })).status, 400);

    assert.equal((await api.get('/notificaciones/notas-digitales/config', comoAdmin())).status, 200);
    assert.deepEqual(await query('SELECT membrete_imagen, membrete_mime FROM notas_digitales_config WHERE id = 1'),
      [{ membrete_imagen: null, membrete_mime: null }]);
  });

  it('guarda el pie del membrete recortado ("" o null = sin pie) y valida el largo y el tipo', async () => {
    const ruta = '/notificaciones/notas-digitales/config';
    const pieGuardado = async () => (await query('SELECT membrete_pie FROM notas_digitales_config WHERE id = 1'))[0].membrete_pie;

    const res = await api.put(ruta, { membrete_pie: '  Comodoro Rivadavia – Pie nuevo  ' }, comoAdmin());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.membrete_pie, 'Comodoro Rivadavia – Pie nuevo');

    for (const vacio of ['', '   ', null]) {
      assert.equal((await api.put(ruta, { membrete_pie: vacio }, comoAdmin())).status, 200, JSON.stringify(vacio));
      assert.equal(await pieGuardado(), '', JSON.stringify(vacio));
    }

    assert.equal((await api.put(ruta, { membrete_pie: 'x'.repeat(300) }, comoAdmin())).status, 200);
    const largo = await api.put(ruta, { membrete_pie: 'y'.repeat(301) }, comoAdmin());
    assert.equal(largo.status, 400);
    assert.match(largo.body.error, /membrete_pie: máximo 300 caracteres/);
    for (const valor of [5, true, { a: 1 }, ['x']]) {
      assert.equal((await api.put(ruta, { membrete_pie: valor }, comoAdmin())).status, 400, JSON.stringify(valor));
    }
    assert.equal(await pieGuardado(), 'x'.repeat(300));
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

  it('un mime que es una propiedad heredada de Object o no es texto da 400 y el servidor sigue en pie', async () => {
    const enviar = (imagen, mime) => api.put('/notificaciones/notas-digitales/config/firma', { imagen, mime }, comoAdmin());
    for (const mime of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      assert.equal((await enviar('AAAA', mime)).status, 400, mime);
    }
    // Un array o un objeto no deben pasar por un mime válido ('image/png' se convierte a texto al usarlo como clave)
    assert.equal((await enviar(PNG.toString('base64'), ['image/png'])).status, 400);
    assert.equal((await enviar(PNG.toString('base64'), { a: 1 })).status, 400);
    assert.equal((await enviar(PNG.toString('base64'))).status, 400);
    assert.equal((await enviar({ a: 1 }, 'image/png')).status, 400);

    // El proceso del servidor no se cayó
    assert.equal((await api.get('/notificaciones/notas-digitales/config', comoAdmin())).status, 200);
    assert.equal((await query('SELECT firma_imagen FROM notas_digitales_config WHERE id = 1'))[0].firma_imagen, null);
  });

  it('una firma PNG RGBA con los datos dañados da 400, no se guarda y el servidor sigue en pie', async () => {
    const enviar = (imagen) => api.put('/notificaciones/notas-digitales/config/firma', { imagen: imagen.toString('base64'), mime: 'image/png' }, comoAdmin());
    for (const [caso, imagen] of Object.entries(pngsDanados())) {
      const res = await enviar(imagen);
      assert.equal(res.status, 400, caso);
      assert.match(res.body.error, /imagen de la firma/, caso);
    }
    assert.equal((await api.get('/notificaciones/notas-digitales/config', comoAdmin())).status, 200);
    assert.equal((await query('SELECT firma_imagen FROM notas_digitales_config WHERE id = 1'))[0].firma_imagen, null);

    // Una firma RGBA sana se guarda y la prueba genera su PDF
    assert.equal((await enviar(pngRgba())).status, 200);
    assert.equal((await api.post('/notificaciones/notas-digitales/prueba', { tipo: 'aviso', gestion: 'interna' }, comoAdmin())).status, 200);
  });

  it('con una firma dañada ya guardada la prueba responde 400 y el servidor sigue en pie', async () => {
    await configurarNotas({ firma_imagen: pngsDanados()['IDAT con la cabecera zlib rota'], firma_mime: 'image/png' });
    const res = await api.post('/notificaciones/notas-digitales/prueba', { tipo: 'aviso', gestion: 'interna' }, comoAdmin());
    assert.equal(res.status, 400);
    assert.match(res.body.error, /imagen de la firma/);
    // Esperar a la descompresión asíncrona de png-js: si la imagen hubiera llegado a PDFKit, el proceso se caería
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.equal((await api.get('/notificaciones/notas-digitales/config', comoAdmin())).status, 200);
    assert.equal((await mailpit.mensajes()).length, 0);
  });

  it('un texto en null no se guarda como la palabra "null" ni deja activar el envío', async () => {
    const config = () => api.get('/notificaciones/notas-digitales/config', comoAdmin());

    // Con el envío activo, vaciar la firma deja la configuración incompleta: se rechaza y no se guarda nada
    const activo = await api.put('/notificaciones/notas-digitales/config', { firma_nombre: null }, comoAdmin());
    assert.equal(activo.status, 400);
    assert.match(activo.body.error, /nombre de la firma/);
    assert.equal((await config()).body.data.firma_nombre, 'Firma de Prueba');

    // Con el envío apagado, null se guarda como texto vacío (nunca como "null")
    await configurarNotas({ envio_activo: 0 });
    const vacio = await api.put('/notificaciones/notas-digitales/config', { firma_nombre: null, linea_cc_interna: null }, comoAdmin());
    assert.equal(vacio.status, 200);
    const guardada = (await config()).body.data;
    assert.equal(guardada.firma_nombre, '');
    assert.equal(guardada.linea_cc_interna, '');

    // y con la firma vacía no se puede activar el envío
    const activar = await api.put('/notificaciones/notas-digitales/config', { envio_activo: true }, comoAdmin());
    assert.equal(activar.status, 400);
    assert.match(activar.body.error, /nombre de la firma/);
  });

  it('un texto que no es string se rechaza sin guardar nada', async () => {
    await configurarNotas({ envio_activo: 0 });
    for (const valor of [{ a: 1 }, 5, true, ['x']]) {
      const res = await api.put('/notificaciones/notas-digitales/config', { firma_cargo: valor, firma_nombre: 'Otro nombre' }, comoAdmin());
      assert.equal(res.status, 400, JSON.stringify(valor));
    }
    const [fila] = await query('SELECT firma_nombre, firma_cargo FROM notas_digitales_config WHERE id = 1');
    assert.deepEqual(fila, { firma_nombre: 'Firma de Prueba', firma_cargo: 'Cargo de Prueba' });
  });

  it('las listas de direcciones aceptan null (vacío) y arrays de texto, y rechazan otros tipos', async () => {
    const ruta = '/notificaciones/notas-digitales/config';
    const vacia = await api.put(ruta, { cc_interna: null }, comoAdmin());
    assert.equal(vacia.status, 200);
    assert.equal(vacia.body.data.cc_interna, '');

    const array = await api.put(ruta, { cc_interna: ['a@x.gov.ar', ' b@y.gov.ar '] }, comoAdmin());
    assert.equal(array.status, 200);
    assert.equal(array.body.data.cc_interna, 'a@x.gov.ar, b@y.gov.ar');

    for (const valor of [5, true, { a: 1 }, [1], [{ a: 1 }], [['a@x.gov.ar']]]) {
      assert.equal((await api.put(ruta, { cc_externa: valor }, comoAdmin())).status, 400, JSON.stringify(valor));
    }
    // El Para obligatorio sigue fallando con null
    assert.equal((await api.put(ruta, { para_interna: null }, comoAdmin())).status, 400);
    const [fila] = await query('SELECT para_interna, cc_externa FROM notas_digitales_config WHERE id = 1');
    assert.deepEqual(fila, { para_interna: 'mit@rpad.test', cc_externa: 'adm@rpad.test' });
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

  it('la prueba lleva en su PDF el banner y el pie del membrete cargados desde la pantalla', async () => {
    assert.equal((await api.put(RUTA_MEMBRETE, { imagen: BANNER.toString('base64'), mime: 'image/png' }, comoAdmin())).status, 200);
    assert.equal((await api.put('/notificaciones/notas-digitales/config', { membrete_pie: 'Pie de la prueba' }, comoAdmin())).status, 200);
    const res = await api.post('/notificaciones/notas-digitales/prueba', { tipo: 'aviso', gestion: 'externa' }, comoAdmin());
    assert.equal(res.status, 200);
    const [{ pdf }] = await query('SELECT pdf FROM notas_digitales WHERE es_prueba = 1');
    assert.ok(conMembreteEnCadaHoja(pdf, 'Pie de la prueba'));
  });

  it('el PDF de la vista previa tiene el contenido de la vista previa, con N° XX, membrete y firma, y no guarda ni envía nada', async () => {
    await configurarNotas({ firma_imagen: pngRgba(), firma_mime: 'image/png', membrete_imagen: BANNER, membrete_mime: 'image/png' });
    const res = await api.get('/notificaciones/notas-digitales/preview/pdf?tipo=reiteracion&gestion=externa', comoAdmin());
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/pdf/);
    assert.equal(res.body.subarray(0, 5).toString(), '%PDF-');

    const lineas = textosPorHoja(res.body).flat().map(t => t.texto);
    assert.ok(lineas.includes('Nota Digital N° XX'), lineas.join(' | '));
    // Los mismos datos (de ejemplo, porque no hay datasets para reiterar) que la vista previa HTML
    const vista = (await api.get('/notificaciones/notas-digitales/preview?tipo=reiteracion&gestion=externa', comoAdmin())).body.data;
    assert.equal(vista.ejemplo, true);
    assert.ok(vista.html.includes('Dataset de ejemplo vencido'));
    assert.ok(lineas.join(' ').includes('Dataset de ejemplo vencido'), lineas.join(' | '));
    assert.ok(lineas.includes('Firma de Prueba'));
    assert.ok(conMembreteEnCadaHoja(res.body, PIE_MEMBRETE));
    // Banner y firma (con su máscara de transparencia)
    assert.deepEqual(imagenesGuardadas(res.body).map(i => `${i.ancho}x${i.alto}`).sort(), ['1241x178', '40x20', '40x20']);

    assert.equal((await query('SELECT COUNT(*) AS n FROM notas_digitales'))[0].n, 0);
    assert.equal((await mailpit.mensajes()).length, 0);
  });

  it('el PDF de la vista previa rechaza tipo o gestión inválidos', async () => {
    for (const consulta of ['tipo=otro&gestion=interna', 'tipo=aviso&gestion=otra', 'tipo=aviso', '']) {
      const res = await api.get(`/notificaciones/notas-digitales/preview/pdf?${consulta}`, comoAdmin());
      assert.equal(res.status, 400, consulta);
      assert.equal(res.body.success, false);
    }
  });

  it('con un banner dañado ya guardado la prueba y el PDF de la vista previa responden 400 y el servidor sigue en pie', async () => {
    await configurarNotas({ membrete_imagen: pngsDanados()['IDAT con la cabecera zlib rota'], membrete_mime: 'image/png' });
    const prueba = await api.post('/notificaciones/notas-digitales/prueba', { tipo: 'aviso', gestion: 'interna' }, comoAdmin());
    assert.equal(prueba.status, 400);
    assert.match(prueba.body.error, /imagen del membrete/);
    const vista = await api.get('/notificaciones/notas-digitales/preview/pdf?tipo=aviso&gestion=interna', comoAdmin());
    assert.equal(vista.status, 400);
    assert.match(vista.body.error, /imagen del membrete/);
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.equal((await api.get('/notificaciones/notas-digitales/config', comoAdmin())).status, 200);
    assert.equal((await mailpit.mensajes()).length, 0);
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

describe('corrida diaria', () => {
  // La corrida usa la fecha real: en un día no hábil el motor no genera nada y no hay qué comprobar
  const hoy = hoyArgentina();

  it('una corrida pedida por un admin deja su id como creado_por de la nota', async (t) => {
    if (!esDiaHabil(hoy)) return t.skip('hoy no es día hábil');
    await crearDataset({ vencimiento: sumarDias(hoy, -10) });

    const res = await api.get('/notificaciones/ejecutar', comoAdmin());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.notasDigitales.generadas.length, 1);

    const notas = await query('SELECT creado_por, estado FROM notas_digitales WHERE es_prueba = 0');
    assert.equal(notas.length, 1);
    assert.equal(notas[0].estado, 'enviada');
    assert.equal(notas[0].creado_por, usuarios.adminA.id);
  });

  it('una corrida del cron deja creado_por vacío', async (t) => {
    if (!esDiaHabil(hoy)) return t.skip('hoy no es día hábil');
    await crearDataset({ vencimiento: sumarDias(hoy, -10) });

    const res = await api.get('/cron/notificaciones', { headers: { 'x-cron-secret': process.env.CRON_SECRET } });
    assert.equal(res.status, 200);

    const notas = await query('SELECT creado_por FROM notas_digitales WHERE es_prueba = 0');
    assert.equal(notas.length, 1);
    assert.equal(notas[0].creado_por, null);
  });

  // Vale cualquier día: la corrida queda registrada también cuando sale por "Día no hábil"
  it('un error en el aviso a las áreas no saltea las Notas Digitales, que dejan registrada la corrida', async () => {
    await asegurarBaseDePrueba();
    await query('ALTER TABLE areas RENAME COLUMN celular_area TO celular_area_oculta');
    try {
      const res = await api.get('/cron/notificaciones', { headers: { 'x-cron-secret': process.env.CRON_SECRET } });
      assert.equal(res.status, 207);
      assert.ok(res.body.data.errores.some(e => e.tipo === 'area-aviso-40'), JSON.stringify(res.body.data.errores));
      assert.ok(res.body.data.notasDigitales);
    } finally {
      await query('ALTER TABLE areas RENAME COLUMN celular_area_oculta TO celular_area');
    }
    const [corrida] = await query(
      "SELECT DATE_FORMAT(ultima_corrida_fecha, '%Y-%m-%d') AS fecha, ultima_corrida_fin AS fin FROM notas_digitales_config WHERE id = 1"
    );
    assert.equal(corrida.fecha, hoy);
    assert.ok(corrida.fin);
  });

  it('el estado devuelve la última corrida y las alertas', async () => {
    const res = await api.get('/notificaciones/notas-digitales/estado', comoAdmin());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.ultima_corrida, null);
    assert.ok(res.body.data.alertas.some(a => a.tipo === 'sin-corrida'));
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
