// API de Notas Digitales (servidor real contra una base de prueba propia)
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query, mailpit, db
} from './helpers.js';
import { crearArea, crearDataset, crearNota, limpiarBase, configurarNotas, asegurarBaseDePrueba, PIE_MEMBRETE } from './notas-fixtures.js';
import { pngRgba, pngRgb, pngsDanados } from './firma-fixtures.js';
import { textosPorHoja, imagenesPorHoja, imagenesGuardadas, lineasPorHoja, tamanosPorHoja, HOJA_OFICIO, todasDelTamano } from './pdf-lector.js';
import { esDiaHabil, formatoCorto, hoyArgentina, proximoDiaHabil, rangoDeAviso, sumarDias } from '../services/notasDigitalesCalendario.js';
import { vencimientoDelMes } from '../services/fechasDatasetReglas.js';
import { textoVisible } from './emails-fixtures.js';

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
// La vista previa usa la fecha real de hoy: los datasets de estos tests vencen en 5 días (dentro de cualquier ventana)
const hoyMasDias = (dias) => sumarDias(hoyArgentina(), dias);

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
    assert.match((await enviar(BANNER.toString('base64'), 'image/gif')).body.error, /^El banner del membrete debe ser una imagen PNG o JPEG$/);
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

    // Un pie largo que entra en una línea achicando la letra (entre 10 y 7 puntos) se guarda
    const largoQueEntra = 'Texto institucional del pie '.repeat(4).trim();
    assert.equal((await api.put(ruta, { membrete_pie: largoQueEntra }, comoAdmin())).status, 200);
    const largo = await api.put(ruta, { membrete_pie: 'y'.repeat(301) }, comoAdmin());
    assert.equal(largo.status, 400);
    assert.match(largo.body.error, /membrete_pie: máximo 300 caracteres/);
    for (const valor of [5, true, { a: 1 }, ['x']]) {
      assert.equal((await api.put(ruta, { membrete_pie: valor }, comoAdmin())).status, 400, JSON.stringify(valor));
    }
    assert.equal(await pieGuardado(), largoQueEntra);
  });

  it('rechaza un pie del membrete que no entra en una línea ni con la letra de 7 puntos', async () => {
    const ruta = '/notificaciones/notas-digitales/config';
    for (const pie of ['x'.repeat(200), 'Comodoro Rivadavia '.repeat(10).trim()]) {
      const res = await api.put(ruta, { membrete_pie: pie }, comoAdmin());
      assert.equal(res.status, 400, pie);
      assert.equal(res.body.error, 'membrete_pie: no entra en una línea al pie del PDF ni con la letra más chica (7 puntos); acortalo');
    }
    assert.equal((await query('SELECT membrete_pie FROM notas_digitales_config WHERE id = 1'))[0].membrete_pie, PIE_MEMBRETE);
  });

  it('guarda en NFC los textos que van al PDF y rechaza los caracteres que el PDF no puede escribir', async () => {
    const ruta = '/notificaciones/notas-digitales/config';
    const NFD = (texto) => texto.normalize('NFD');
    const columnas = 'SELECT membrete_pie, firma_nombre, firma_cargo, linea_cc_interna, linea_cc_externa FROM notas_digitales_config WHERE id = 1';
    const nfc = {
      membrete_pie: 'Gestión Comodoro Rivadavia – Atención al vecino', firma_nombre: 'Nombre de la Firma Pública', firma_cargo: 'Dirección de Datos',
      linea_cc_interna: 'CC. Dirección de Investigación', linea_cc_externa: 'CC. Dirección Administrativa'
    };
    const enviado = Object.fromEntries(Object.entries(nfc).map(([campo, texto]) => [campo, NFD(texto)]));
    assert.ok(Object.keys(nfc).every(campo => enviado[campo] !== nfc[campo]), 'el texto de prueba no tenía acentos descompuestos');
    const res = await api.put(ruta, enviado, comoAdmin());
    assert.equal(res.status, 200);
    assert.deepEqual((await query(columnas))[0], nfc);

    const mal = await api.put(ruta, {
      membrete_pie: 'Tel. ☎ 297 400-0000 → www.x.gov.ar ☎', firma_nombre: 'Otro nombre', firma_cargo: 'Director 😀',
      linea_cc_externa: 'CC. q́'
    }, comoAdmin());
    assert.equal(mal.status, 400);
    assert.match(mal.body.error, /membrete_pie: caracteres que el PDF no puede escribir: ☎ →(\.|$)/);
    assert.match(mal.body.error, /firma_cargo: caracteres que el PDF no puede escribir: 😀(\.|$)/);
    assert.match(mal.body.error, /linea_cc_externa: caracteres que el PDF no puede escribir: U\+0301(\.|$)/);
    assert.doesNotMatch(mal.body.error, /firma_nombre/);
    // No se guardó nada, tampoco el campo válido
    assert.deepEqual((await query(columnas))[0], nfc);

    // Tabuladores y saltos de línea siguen como antes: no se rechazan
    assert.equal((await api.put(ruta, { firma_cargo: 'Director\tGeneral', linea_cc_interna: 'CC.\nDirección' }, comoAdmin())).status, 200);
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

  it('si hoy no se generan notas, la vista previa y la prueba dicen qué día muestran (spec 2026-10-15, 7.7)', async () => {
    const hoy = hoyArgentina();
    const titular = usuarios.adminA.id;
    const rutas = { vista: '/notificaciones/notas-digitales/preview?tipo=aviso&gestion=interna', prueba: '/notificaciones/notas-digitales/prueba' };
    const pedir = async () => ({
      vista: (await api.get(rutas.vista, comoAdmin())).body.data,
      prueba: (await api.post(rutas.prueba, { tipo: 'aviso', gestion: 'interna' }, comoAdmin())).body
    });
    try {
      // Sin licencia: hoy si es día hábil; si no, el próximo día hábil
      const sinLicencia = await pedir();
      const fechaSinLicencia = proximoDiaHabil(hoy);
      assert.deepEqual([sinLicencia.vista.fecha, sinLicencia.vista.motivo], [fechaSinLicencia, esDiaHabil(hoy) ? null : 'día no hábil']);
      assert.equal(sinLicencia.prueba.message.includes('como saldría'), !esDiaHabil(hoy));

      // El firmante titular de licencia desde ayer hasta dentro de 3 días, sin persona autorizada: ni hoy ni esos días hay notas
      await query('INSERT INTO usuarios_firmas (usuario_id, nombre, cargo, imagen, mime) VALUES (?, ?, ?, ?, ?)',
        [titular, 'Titular de prueba', 'Cargo de prueba', pngRgba(), 'image/png']);
      await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [titular, sumarDias(hoy, -1), sumarDias(hoy, 3)]);
      await query('UPDATE notas_digitales_config SET firmante_usuario_id = ?', [titular]);
      const esperada = proximoDiaHabil(sumarDias(hoy, 4));
      const motivo = esDiaHabil(hoy) ? 'licencia del firmante sin persona autorizada' : 'día no hábil';
      const conLicencia = await pedir();
      assert.deepEqual([conLicencia.vista.fecha, conLicencia.vista.motivo], [esperada, motivo]);
      assert.equal(conLicencia.prueba.success, true);
      assert.deepEqual([conLicencia.prueba.data.fecha, conLicencia.prueba.data.motivo], [esperada, motivo]);
      assert.ok(conLicencia.prueba.message.endsWith(` (con datos de ejemplo, como saldría el ${formatoCorto(esperada)})`), conLicencia.prueba.message);
    } finally {
      await query('UPDATE notas_digitales_config SET firmante_usuario_id = NULL');
      await query('DELETE FROM usuarios_licencias WHERE usuario_id = ?', [titular]);
      await query('DELETE FROM usuarios_firmas WHERE usuario_id = ?', [titular]);
    }
  });

  it('el mensaje de la prueba junta lo que aclara en un solo paréntesis (spec 2026-10-15, 7.7)', () => {
    const base = { destinatarios: ['uno@rpad.test', 'dos@rpad.test'], fecha: '2026-12-21' };
    assert.equal(motor.mensajeDePrueba({ ...base, ejemplo: false, motivo: null }), 'Prueba enviada a uno@rpad.test, dos@rpad.test');
    assert.equal(motor.mensajeDePrueba({ ...base, ejemplo: true, motivo: null }), 'Prueba enviada a uno@rpad.test, dos@rpad.test (con datos de ejemplo)');
    assert.equal(motor.mensajeDePrueba({ ...base, ejemplo: false, motivo: 'día no hábil' }), 'Prueba enviada a uno@rpad.test, dos@rpad.test (como saldría el 21/12/2026)');
    assert.equal(motor.mensajeDePrueba({ ...base, ejemplo: true, motivo: 'día no hábil' }),
      'Prueba enviada a uno@rpad.test, dos@rpad.test (con datos de ejemplo, como saldría el 21/12/2026)');
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
    // En hoja oficio, como la nota que se envía (spec 2026-10-24-notas-hoja-oficio)
    assert.ok(todasDelTamano(res.body, HOJA_OFICIO), JSON.stringify(tamanosPorHoja(res.body)));

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

  it('el anexo de la vista previa es un PDF del aviso de hoy con N° XX y no guarda ni envía nada', async () => {
    await crearDataset({ titulo: 'Real externo a vencer', gestion: 'externa', vencimiento: hoyMasDias(5) });
    await crearDataset({ titulo: 'Real interno', gestion: 'interna', vencimiento: hoyMasDias(5) });
    const res = await api.get('/notificaciones/notas-digitales/preview/anexo?gestion=externa', comoAdmin());
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/pdf/);
    assert.equal(res.headers.get('content-disposition'), 'inline; filename="Anexo-vista-previa-externa.pdf"');
    assert.equal(res.body.subarray(0, 5).toString(), '%PDF-');

    const hojas = lineasPorHoja(res.body);
    assert.equal(hojas.length, 1);
    assert.ok(hojas[0].includes('Real externo a vencer'), hojas[0].join(' | '));
    assert.ok(hojas[0].includes('Anexo – Nota Digital N° XX · Hoja 1 de 1'), hojas[0].join(' | '));
    assert.equal((await query('SELECT COUNT(*) AS n FROM notas_digitales'))[0].n, 0);
    assert.equal((await mailpit.mensajes()).length, 0);
  });

  it('el anexo de la vista previa sin datasets reales usa el ejemplo', async () => {
    const res = await api.get('/notificaciones/notas-digitales/preview/anexo?gestion=interna', comoAdmin());
    assert.equal(res.status, 200);
    const hojas = lineasPorHoja(res.body);
    assert.equal(hojas.length, 1);
    assert.ok(hojas[0].includes('Dataset de ejemplo próximo a vencer'), hojas[0].join(' | '));
  });

  it('el anexo de la vista previa rechaza una gestión inválida o ausente', async () => {
    for (const consulta of ['gestion=otra', 'gestion=', 'tipo=aviso', 'tipo=reiteracion', '']) {
      const res = await api.get(`/notificaciones/notas-digitales/preview/anexo?${consulta}`, comoAdmin());
      assert.equal(res.status, 400, consulta);
      assert.equal(res.body.success, false);
    }
    assert.equal((await query('SELECT COUNT(*) AS n FROM notas_digitales'))[0].n, 0);
  });

  // Spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2.5: «Ver anexo» también para la reiteración
  it('GET preview/anexo?tipo=reiteracion devuelve un PDF con una hoja por dataset', async () => {
    // Un próximo a vencer avisado hace más de 20 días y un vencido sin aviso (más uno de la otra gestión, que no entra)
    const proximo = await crearDataset({ titulo: 'Real avisado', gestion: 'externa', vencimiento: hoyMasDias(20) });
    await crearDataset({ titulo: 'Real vencido', gestion: 'externa', vencimiento: hoyMasDias(-10) });
    await crearDataset({ titulo: 'Real interno vencido', gestion: 'interna', vencimiento: hoyMasDias(-10) });
    await crearNota({
      tipo: 'aviso', gestion: 'externa', fecha: hoyMasDias(-25), numero: 1, datasets: [{ id: proximo, vencimiento: hoyMasDias(20) }]
    });
    const res = await api.get('/notificaciones/notas-digitales/preview/anexo?gestion=externa&tipo=reiteracion', comoAdmin());
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/pdf/);
    assert.equal(res.headers.get('content-disposition'), 'inline; filename="Anexo-vista-previa-reiteracion-externa.pdf"');
    assert.equal(res.body.subarray(0, 5).toString(), '%PDF-');

    // Una hoja por dataset de la nota, en el orden de la tabla (primero el próximo a vencer), con el pie de la vista previa
    const hojas = lineasPorHoja(res.body);
    assert.equal(hojas.length, 2);
    assert.ok(hojas[0].includes('Real avisado'), hojas[0].join(' | '));
    assert.ok(hojas[1].includes('Real vencido'), hojas[1].join(' | '));
    hojas.forEach((lineas, k) => assert.ok(lineas.includes(`Anexo de la Nota Digital N° XX · Hoja ${k + 1} de 2`), lineas.join(' | ')));
    // Los mismos datasets que la vista previa de la nota
    const vista = (await api.get('/notificaciones/notas-digitales/preview?tipo=reiteracion&gestion=externa', comoAdmin())).body.data;
    assert.equal(vista.ejemplo, false);
    assert.equal(vista.cantidad, 2);
    assert.equal((await query('SELECT COUNT(*) AS n FROM notas_digitales'))[0].n, 1, 'solo el aviso de antes: no guarda nada');
    assert.equal((await mailpit.mensajes()).length, 0);
  });

  it('GET preview/anexo?tipo=reiteracion con datos de ejemplo devuelve un PDF sin consultar fuentes', async () => {
    // Un dataset real de la otra gestión no cambia nada: la reiteración externa no tiene datos y usa los de ejemplo
    await crearDataset({ titulo: 'Real interno vencido', gestion: 'interna', vencimiento: hoyMasDias(-10) });
    const res = await api.get('/notificaciones/notas-digitales/preview/anexo?gestion=externa&tipo=reiteracion', comoAdmin());
    assert.equal(res.status, 200);
    assert.equal(res.body.subarray(0, 5).toString(), '%PDF-');
    const hojas = lineasPorHoja(res.body);
    assert.equal(hojas.length, 2);
    assert.ok(hojas[0].includes('Dataset de ejemplo próximo a vencer'), hojas[0].join(' | '));
    assert.ok(hojas[1].includes('Dataset de ejemplo vencido'), hojas[1].join(' | '));
    assert.ok(!hojas.flat().some(l => l.includes('Real interno vencido')));
    assert.equal((await mailpit.mensajes()).length, 0);
  });

  it('tipo inválido → 400', async () => {
    for (const tipo of ['auditoria', 'autorizacion', 'otro', 'Aviso', '', 'aviso&tipo=reiteracion']) {
      const res = await api.get(`/notificaciones/notas-digitales/preview/anexo?gestion=externa&tipo=${tipo}`, comoAdmin());
      assert.equal(res.status, 400, tipo);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, 'Tipo inválido', tipo);
    }
    assert.equal((await query('SELECT COUNT(*) AS n FROM notas_digitales'))[0].n, 0);
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
    // Con el filtro por dataset la columna opcional va después de tiene_anexo: sigue llegando
    assert.strictEqual(filtrada.body.data[0].tiene_anexo, true);
    assert.equal((await api.get(`/notificaciones/notas-digitales?dataset_id=${otro}`, comoAdmin())).body.data.length, 0);
  });

  it('el detalle devuelve los datos solicitados de cada dataset; los de una nota vieja, en null (spec 2026-10-17-fechas-datasets, 9)', async () => {
    const conPedido = await crearDataset({ titulo: 'A con el pedido guardado', vencimiento: '2026-12-31' });
    const viejo = await crearDataset({ titulo: 'B de una nota vieja', vencimiento: '2026-12-31' });
    // crearNota guarda las filas como las de antes de esta etapa, sin los datos solicitados
    const nota = await crearNota({ fecha: '2026-11-02', numero: 1, datasets: [{ id: conPedido, vencimiento: '2026-12-31' }, { id: viejo, vencimiento: '2026-12-31' }] });
    await query(
      `UPDATE notas_digitales_datasets SET datos_desde = '2026-01-01', datos_hasta = '2026-11-30', datos_solicitados = 'Del 01/01/2026 al 30/11/2026'
       WHERE nota_id = ? AND dataset_id = ?`, [nota, conPedido]
    );

    const detalle = await api.get(`/notificaciones/notas-digitales/${nota}`, comoAdmin());
    assert.equal(detalle.status, 200);
    assert.deepEqual(detalle.body.data.datasets.map(({ dataset_id: id, datos_desde: desde, datos_hasta: hasta, datos_solicitados: texto }) => ({ id, desde, hasta, texto })), [
      { id: conPedido, desde: '2026-01-01', hasta: '2026-11-30', texto: 'Del 01/01/2026 al 30/11/2026' },
      { id: viejo, desde: null, hasta: null, texto: null }
    ]);
  });

  it('el libro filtra por tipo, incluida la nota de autorización (sin gestión); la vista previa y la prueba no la aceptan', async () => {
    const aviso = await crearNota({ tipo: 'aviso', gestion: 'interna', fecha: '2026-11-02', numero: 1 });
    const autorizacion = await crearNota({ tipo: 'autorizacion', gestion: null, fecha: '2026-11-25', numero: 2 });
    const ids = async (consulta) => (await api.get(`/notificaciones/notas-digitales${consulta}`, comoAdmin())).body.data.map(n => n.id).sort((a, b) => a - b);

    assert.deepEqual(await ids('?tipo=autorizacion'), [autorizacion]);
    assert.deepEqual(await ids('?tipo=aviso'), [aviso]);
    assert.deepEqual(await ids(''), [aviso, autorizacion]);
    const [fila] = (await api.get('/notificaciones/notas-digitales?tipo=autorizacion', comoAdmin())).body.data;
    assert.equal(fila.gestion, null);
    assert.equal(fila.cantidad_datasets, 0);

    assert.equal((await api.get('/notificaciones/notas-digitales/preview?tipo=autorizacion&gestion=interna', comoAdmin())).status, 400);
    assert.equal((await api.post('/notificaciones/notas-digitales/prueba', { tipo: 'autorizacion', gestion: 'interna' }, comoAdmin())).status, 400);
  });

  // Un aviso y, un mes después, su reiteración, generados por el motor: los dos con su anexo (el de la reiteración, con el
  // Seguimiento de cada dataset: spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2)
  const avisoYReiteracion = async () => {
    await crearDataset({ titulo: 'Dataset avisado', vencimiento: '2026-12-31' });
    await motor.ejecutarNotasDigitales({ hoy: '2026-11-02' });
    await motor.ejecutarNotasDigitales({ hoy: '2026-12-01' });
    const [aviso, reiteracion] = await query('SELECT id, tipo, anexo_pdf FROM notas_digitales ORDER BY id');
    assert.equal(aviso.tipo, 'aviso');
    assert.ok(aviso.anexo_pdf);
    assert.equal(reiteracion.tipo, 'reiteracion');
    assert.ok(reiteracion.anexo_pdf);
    return { aviso, reiteracion };
  };

  it('el libro y el detalle indican si la nota tiene anexo (true en el aviso y la reiteración, false en una nota sin anexo) sin traer el PDF', async () => {
    const { aviso, reiteracion } = await avisoYReiteracion();
    // Una nota sin anexo: como las reiteraciones anteriores al anexo de seguimiento
    const vieja = { id: await crearNota({ tipo: 'reiteracion', fecha: '2026-10-01', numero: 9 }) };

    const lista = await api.get('/notificaciones/notas-digitales', comoAdmin());
    assert.equal(lista.status, 200);
    const filas = Object.fromEntries(lista.body.data.map(n => [n.id, n]));
    assert.strictEqual(filas[aviso.id].tiene_anexo, true);
    assert.strictEqual(filas[reiteracion.id].tiene_anexo, true);
    assert.strictEqual(filas[vieja.id].tiene_anexo, false);
    for (const fila of lista.body.data) assert.equal('anexo_pdf' in fila, false);

    for (const [nota, esperado] of [[aviso, true], [reiteracion, true], [vieja, false]]) {
      const detalle = await api.get(`/notificaciones/notas-digitales/${nota.id}`, comoAdmin());
      assert.equal(detalle.status, 200);
      assert.strictEqual(detalle.body.data.tiene_anexo, esperado);
      assert.equal('anexo_pdf' in detalle.body.data, false);
      assert.equal('pdf' in detalle.body.data, false);
    }
  });

  it('descarga el anexo guardado de un aviso como Anexo-Nota-Digital-{n}-{aa}.pdf', async () => {
    const { aviso } = await avisoYReiteracion();
    const res = await api.get(`/notificaciones/notas-digitales/${aviso.id}/anexo`, comoAdmin());
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/pdf/);
    assert.equal(res.headers.get('content-disposition'), 'attachment; filename="Anexo-Nota-Digital-1-26.pdf"');
    assert.equal(res.body.subarray(0, 5).toString(), '%PDF-');
    assert.deepEqual(res.body, aviso.anexo_pdf);
    const hojas = lineasPorHoja(res.body);
    assert.ok(hojas[0].includes('Anexo – Nota Digital N° 1/26 · Hoja 1 de 1'), hojas[0].join(' | '));
  });

  it('el anexo de una prueba se descarga como Anexo-Nota-Digital-PRUEBA-{id}.pdf y figura con anexo en el libro', async () => {
    assert.equal((await api.post('/notificaciones/notas-digitales/prueba', { tipo: 'aviso', gestion: 'externa' }, comoAdmin())).status, 200);
    const [prueba] = await query('SELECT id, anexo_pdf FROM notas_digitales WHERE es_prueba = 1');
    assert.ok(prueba.anexo_pdf);

    const res = await api.get(`/notificaciones/notas-digitales/${prueba.id}/anexo`, comoAdmin());
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-disposition'), `attachment; filename="Anexo-Nota-Digital-PRUEBA-${prueba.id}.pdf"`);
    assert.deepEqual(res.body, prueba.anexo_pdf);

    const lista = await api.get('/notificaciones/notas-digitales?incluir_pruebas=1', comoAdmin());
    assert.strictEqual(lista.body.data.find(n => n.id === prueba.id).tiene_anexo, true);
  });

  it('una reiteración tiene tiene_anexo y descargarAnexo la entrega', async () => {
    const { reiteracion } = await avisoYReiteracion();
    const detalle = await api.get(`/notificaciones/notas-digitales/${reiteracion.id}`, comoAdmin());
    assert.strictEqual(detalle.body.data.tiene_anexo, true);

    const res = await api.get(`/notificaciones/notas-digitales/${reiteracion.id}/anexo`, comoAdmin());
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/pdf/);
    assert.equal(res.headers.get('content-disposition'), 'attachment; filename="Anexo-Nota-Digital-2-26.pdf"');
    assert.deepEqual(res.body, reiteracion.anexo_pdf);
    const [hoja] = lineasPorHoja(res.body);
    assert.ok(hoja.includes('Dataset avisado'), hoja.join(' | '));
    assert.ok(hoja.includes('Anexo de la Nota Digital N° 2/26 · Hoja 1 de 1'), hoja.join(' | '));
    assert.ok(hoja.includes('1 de diciembre de 2026'), hoja.join(' | '));
  });

  it('una nota sin anexo (anterior al anexo de la reiteración): 404 con el mensaje "La nota no tiene anexo"', async () => {
    const id = await crearNota({ tipo: 'reiteracion', fecha: '2026-10-01', numero: 9 });
    const res = await api.get(`/notificaciones/notas-digitales/${id}/anexo`, comoAdmin());
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { success: false, error: 'La nota no tiene anexo' });
  });

  it('el anexo de una nota inexistente o con un id inválido responde 404', async () => {
    for (const id of ['999999', '0', 'abc']) {
      const res = await api.get(`/notificaciones/notas-digitales/${id}/anexo`, comoAdmin());
      assert.equal(res.status, 404, id);
      assert.deepEqual(res.body, { success: false, error: 'Nota no encontrada' });
    }
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
    await crearDataset({ vencimiento: sumarDias(hoy, 10) });

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
    await crearDataset({ vencimiento: sumarDias(hoy, 10) });

    const res = await api.get('/cron/notificaciones', { headers: { 'x-cron-secret': process.env.CRON_SECRET } });
    assert.equal(res.status, 200);

    const notas = await query('SELECT creado_por FROM notas_digitales WHERE es_prueba = 0');
    assert.equal(notas.length, 1);
    assert.equal(notas[0].creado_por, null);
  });

  // Solo en días hábiles: en un día no hábil el aviso a las áreas no consulta la base (spec 2026-10-15, 4.2)
  it('un error en el aviso a las áreas no saltea las Notas Digitales, que dejan registrada la corrida', async (t) => {
    if (!esDiaHabil(hoy)) return t.skip('hoy no es día hábil');
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

  // Vale cualquier día: la base de prueba está vacía y no se genera ninguna nota
  it('la respuesta conserva sus campos y suma dia_habil (spec 2026-10-15, 4.2)', async () => {
    const res = await api.get('/cron/notificaciones', { headers: { 'x-cron-secret': process.env.CRON_SECRET } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    for (const campo of ['fecha', 'enviados', 'errores', 'sinDatasets', 'notasDigitales', 'dia_habil']) {
      assert.ok(campo in res.body.data, `falta ${campo}`);
    }
    assert.equal(res.body.data.dia_habil, esDiaHabil(hoy));
    assert.deepEqual(res.body.data.sinDatasets, ['area-aviso-40']);
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

  it('la vista previa responde cualquier día: usa la selección del próximo día hábil o el ejemplo', async () => {
    const res = await api.get('/notificaciones/preview/area-aviso-40', comoAdmin());
    assert.equal(res.status, 200);
    // El HTML del aviso no trae el nombre del área (solo el asunto): el área de ejemplo se reconoce por sus datasets
    assert.match(res.body, /Dataset de Ejemplo 1/);
  });

  // El ejemplo muestra la frecuencia y los datos solicitados (spec 2026-10-17-fechas-datasets, 9; desde el 18/10/2026, sin la
  // fecha sugerida de envío): el pedido de un trimestral acumulado (Dataset 1, "Trimestralmente (Acumulado)": spec 18, pedido del
  // usuario en la revisión final) y el de una foto al corte (Dataset 2)
  it('el ejemplo de la vista previa muestra la frecuencia y los datos solicitados de cada dataset, sin fecha sugerida de envío', async () => {
    const fecha = proximoDiaHabil(hoyArgentina());
    const vencimiento = formatoCorto(vencimientoDelMes(sumarDias(fecha, 40)));
    const res = await api.get('/notificaciones/preview/area-aviso-40', comoAdmin());
    assert.equal(res.status, 200);
    const texto = textoVisible(res.body);
    assert.match(texto, /Dataset de Ejemplo 1 Frecuencia de actualización: Trimestralmente \(Acumulado\) Datos que se solicitarán: del \d{2}\/\d{2}\/\d{4} al \d{2}\/\d{2}\/\d{4} Ver dataset/);
    assert.match(texto, /Dataset de Ejemplo 2 Frecuencia de actualización: Cada dos años Datos que se solicitarán: vigente al \d{2}\/\d{2}\/\d{4} Ver dataset/);
    assert.ok(!texto.includes('Fecha sugerida') && !texto.includes(vencimiento), texto);
  });

  it('la prueba con el ejemplo también lleva la frecuencia y los datos solicitados, sin fecha', async () => {
    const res = await api.post('/notificaciones/prueba-area', {}, comoAdmin());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.ejemplo, true);
    const [mensaje] = await mailpit.esperar(m => m.Subject.startsWith('[PRUEBA] '));
    const texto = textoVisible(await mailpit.html(mensaje.ID));
    assert.equal(texto.split('Datos que se solicitarán:').length - 1, 2);
    assert.ok(texto.includes('Frecuencia de actualización: Trimestralmente (Acumulado)'), texto);
    assert.ok(!texto.includes('Fecha sugerida'), texto);
  });

  // Un sábado, hoyArgentina() no tiene rango y mostraría el ejemplo: la selección tiene que salir del próximo día hábil
  it('la vista previa muestra los datasets que vencen en la ventana del próximo día hábil, no el ejemplo', async () => {
    const proximo = proximoDiaHabil(hoyArgentina());
    const areaId = await crearArea({ email_principal: 'area-vista-previa@rpad.test' });
    await crearDataset({
      gestion: 'externa', vencimiento: rangoDeAviso(proximo, 40).desde, areaId, titulo: 'Dataset de la vista previa del próximo aviso'
    });
    const res = await api.get('/notificaciones/preview/area-aviso-40', comoAdmin());
    assert.equal(res.status, 200);
    assert.match(res.body, /Dataset de la vista previa del próximo aviso/);
    assert.doesNotMatch(res.body, /Dataset de Ejemplo 1/);
  });
});

describe('nota de auditoría en Correos (spec 2026-10-15-dias-habiles-licencias-auditoria, 10.1 y 10.4)', () => {
  it('la vista previa, su PDF y la prueba aceptan tipo=auditoria sin gestión', async () => {
    const vista = await api.get('/notificaciones/notas-digitales/preview?tipo=auditoria', comoAdmin());
    assert.equal(vista.status, 200, JSON.stringify(vista.body));
    assert.equal(vista.body.data.ejemplo, true);
    assert.match(vista.body.data.asunto, /Solicitud de auditoría de cambios/);
    const pdf = await api.get('/notificaciones/notas-digitales/preview/pdf?tipo=auditoria', comoAdmin());
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers.get('content-disposition'), /Nota-Digital-vista-previa-auditoria\.pdf/);
    const prueba = await api.post('/notificaciones/notas-digitales/prueba', { tipo: 'auditoria' }, comoAdmin());
    assert.equal(prueba.status, 200, JSON.stringify(prueba.body));
    const [nota] = await query('SELECT tipo, es_prueba FROM notas_digitales WHERE id = ?', [prueba.body.data.id]);
    assert.deepEqual([nota.tipo, nota.es_prueba], ['auditoria', 1]);
  });

  it('el libro filtra por Auditoría (sin gestión, con la cantidad de cambios) y el detalle lista los cambios incluidos', async () => {
    const auditoria = await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-10-19', numero: 4 });
    await crearNota({ tipo: 'aviso', gestion: 'interna', fecha: '2026-10-19', numero: 3 });
    const { insertId: cambioId } = await query(
      `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id)
       VALUES ('crear', NULL, '{"titulo":"Alta auditada"}', ?)`,
      [usuarios.adminA.id]
    );
    try {
      await query("INSERT INTO notas_digitales_cambios (nota_id, cambio_id, seccion) VALUES (?, ?, 'nuevo')", [auditoria, cambioId]);
      const libro = (await api.get('/notificaciones/notas-digitales?tipo=auditoria', comoAdmin())).body.data;
      assert.deepEqual(libro.map(n => [n.id, n.gestion, n.cantidad_cambios]), [[auditoria, null, 1]]);
      const detalle = (await api.get(`/notificaciones/notas-digitales/${auditoria}`, comoAdmin())).body.data;
      assert.deepEqual(detalle.cambios, [{
        cambio_id: cambioId, seccion: 'nuevo', tipo_cambio: 'crear', estado: 'pendiente', titulo: 'Alta auditada', registro_actualizacion: false
      }]);
    } finally {
      await query('DELETE FROM cambios_pendientes WHERE id = ?', [cambioId]);
    }
  });

  // Para que el Libro diga "Actualización" como la nota (spec 2026-10-17-fechas-datasets, 9): cada cambio trae la marca
  it('el detalle de una nota de auditoría marca los registros de actualización (registro_actualizacion)', async () => {
    const auditoria = await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-10-20', numero: 5 });
    const datasetId = await crearDataset({ titulo: 'Dataset con registro en la nota' });
    const ids = [];
    try {
      for (const datos of [{ datos_al: '2026-09-30', registro_actualizacion: true }, { titulo: 'Otro título' }]) {
        const { insertId } = await query(
          `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id, created_at)
           VALUES ('editar', ?, ?, ?, NOW() - INTERVAL ? MINUTE)`,
          [datasetId, JSON.stringify(datos), usuarios.adminA.id, 10 - ids.length]
        );
        ids.push(insertId);
        await query("INSERT INTO notas_digitales_cambios (nota_id, cambio_id, seccion) VALUES (?, ?, 'nuevo')", [auditoria, insertId]);
      }
      const detalle = (await api.get(`/notificaciones/notas-digitales/${auditoria}`, comoAdmin())).body.data;
      assert.deepEqual(detalle.cambios.map(c => [c.cambio_id, c.tipo_cambio, c.registro_actualizacion, c.titulo]), [
        [ids[0], 'editar', true, 'Dataset con registro en la nota'],
        [ids[1], 'editar', false, 'Dataset con registro en la nota']
      ]);
    } finally {
      await query('DELETE FROM cambios_pendientes WHERE id IN (?)', [ids.length ? ids : [0]]);
    }
  });

  it('configuración: el Para de auditoría es obligatorio y el CC, opcional', async () => {
    const ruta = '/notificaciones/notas-digitales/config';
    assert.equal((await api.get(ruta, comoAdmin())).body.data.para_auditoria, 'mit@comodoro.gov.ar');
    assert.equal((await api.put(ruta, { para_auditoria: '' }, comoAdmin())).status, 400);
    const res = await api.put(ruta, { para_auditoria: 'auditoria@rpad.test', cc_auditoria: '' }, comoAdmin());
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual([res.body.data.para_auditoria, res.body.data.cc_auditoria], ['auditoria@rpad.test', '']);
  });
});
