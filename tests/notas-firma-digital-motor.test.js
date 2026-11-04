// La firma digital en la corrida de las Notas Digitales (spec 2026-11-03-notas-firma-digital, 4): qué nota espera, el mail a quien firma, las
// 14:00 y la corrida de la mañana siguiente. Con fechas y horas fijas, sobre una base de prueba + Mailpit. Las funciones se llaman directo,
// nunca /api/cron/*. Con la firma digital apagada, el motor es el de siempre: lo prueban notas-motor, notas-licencias y notas-auditoria
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query, mailpit, db, MAILPIT_URL } from './helpers.js';
import { crearDataset, limpiarBase, configurarNotas } from './notas-fixtures.js';
import { pngRgba } from './firma-fixtures.js';
import { lineasPorHoja, tamanosPorHoja } from './pdf-lector.js';
import PDFDocument from 'pdfkit';
import { CALENDARIO_FIJO } from '../services/notasDigitalesCalendario.js';

const FIRMA = pngRgba({ ancho: 40, alto: 20 });
const BLOQUEO = 'rpad_notas_digitales';
let base, motor, dbReal, titular, autorizado;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_notas_firma_motor');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  motor = await import('../services/notasDigitales.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

const crearUsuario = async (rol, nombre) => {
  const username = `t_${rol}_${crypto.randomBytes(3).toString('hex')}`;
  const email = `${username}@rpad.test`;
  const r = await query(
    "INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo, cargo) VALUES (?, 'x', ?, ?, ?, 1, ?)",
    [username, nombre, email, rol, `Cargo ${rol}`]
  );
  await query("INSERT INTO usuarios_firmas (usuario_id, nombre, cargo, imagen, mime) VALUES (?, ?, ?, ?, 'image/png')",
    [r.insertId, nombre, `Cargo ${rol}`, FIRMA]);
  return { id: r.insertId, email };
};
const licencia = async (usuario, desde, hasta, autorizadoDe = null) => (await query(
  'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, autorizado_id, autorizado_at) VALUES (?, ?, ?, ?, ?)',
  [usuario.id, desde, hasta, autorizadoDe?.id ?? null, autorizadoDe ? '2026-11-20 10:00:00' : null]
)).insertId;

beforeEach(async () => {
  process.env.EMAIL_SOLO_A = '';
  await limpiarBase();
  await configurarNotas({ firma_digital_activa: 1, para_auditoria: 'auditoria@rpad.test', cc_auditoria: '' });
  await query('DELETE FROM cambios_pendientes');
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios_firmas');
  await query('DELETE FROM usuarios');
  titular = await crearUsuario('superadmin', 'Julieta Ferreyra');
  autorizado = await crearUsuario('admin', 'Tomás Aguirre');
  await query('UPDATE notas_digitales_config SET firmante_usuario_id = ?', [titular.id]);
  await mailpit.vaciar();
});

const notas = () => query(
  `SELECT id, numero, anio, tipo, gestion, estado, intentos, espera_firma, firmante_id, presentada_por_id, pdf, pdf_para_firmar, anexo_pdf, para,
          DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha FROM notas_digitales WHERE es_prueba = 0 ORDER BY id`
);
const MANANA = '08:05:00';
const correr = (hoy, hora = MANANA) => motor.ejecutarNotasDigitales({ hoy, ahora: `${hoy} ${hora}` });
const lasCatorce = (hoy, hora = '14:00:00') => motor.enviarLasQueEsperanFirma({ hoy, ahora: `${hoy} ${hora}`, calendario: CALENDARIO_FIJO });
const direcciones = (lista) => (lista || []).map(d => d.Address);
const adjuntos = async (id) => {
  const detalle = await (await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)).json();
  return Promise.all(detalle.Attachments.map(async a => ({
    nombre: a.FileName,
    contenido: Buffer.from(await (await fetch(`${MAILPIT_URL}/api/v1/message/${id}/part/${a.PartID}`)).arrayBuffer())
  })));
};
const ultimaCorrida = async () => (await query('SELECT ultima_corrida_resultado AS resultado, ultima_corrida_con_errores AS con_errores FROM notas_digitales_config WHERE id = 1'))[0];
// Espera a que lleguen los mensajes (Mailpit los procesa enseguida, pero no en el mismo instante)
const mensajes = async () => {
  await new Promise(r => setTimeout(r, 150));
  return mailpit.mensajes();
};
const paraTitular = (m) => direcciones(m.To).includes(titular.email);
const aDestinatarios = (m) => direcciones(m.To).includes('mit@rpad.test') || direcciones(m.To).includes('auditoria@rpad.test');

describe('con la firma digital apagada', () => {
  it('la nota sale a las 8:05, como siempre, sin mail a quien firma y sin esperar', async () => {
    await query('UPDATE notas_digitales_config SET firma_digital_activa = 0');
    await crearDataset({ vencimiento: '2026-12-31' });
    const resumen = await correr('2026-11-02');
    assert.equal(resumen.enviadas, 1);
    assert.deepEqual(resumen.para_firmar, []);
    const [nota] = await notas();
    assert.deepEqual([nota.estado, nota.espera_firma], ['enviada', 0]);
    const lista = await mensajes();
    assert.equal(lista.length, 1);
    assert.ok(!lista.some(paraTitular));
    assert.match((await ultimaCorrida()).resultado, /^1 enviada\(s\), 0 fallida\(s\)$/);
  });

  it('una nota que ya esperaba sigue su bandera: apagarla no la suelta antes de las 14:00', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    await query('UPDATE notas_digitales_config SET firma_digital_activa = 0');
    await correr('2026-11-02', '09:00:00');
    assert.equal((await notas())[0].estado, 'pendiente');
    assert.equal((await lasCatorce('2026-11-02')).enviadas, 1);
    assert.equal((await notas())[0].estado, 'enviada');
  });
});

describe('con la firma digital prendida, a las 8:05', () => {
  it('la nota espera, no le llega a los destinatarios y le llega a quien firma, adjunta y byte a byte', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    const resumen = await correr('2026-11-02');
    assert.equal(resumen.enviadas, 0);
    assert.equal(resumen.para_firmar.length, 1);
    const [nota] = await notas();
    assert.deepEqual([nota.estado, nota.espera_firma, nota.intentos], ['pendiente', 1, 0]);

    const lista = await mensajes();
    assert.equal(lista.length, 1);
    assert.ok(!lista.some(aDestinatarios));
    const [mail] = lista;
    assert.deepEqual(direcciones(mail.To), [titular.email]);
    assert.deepEqual(direcciones(mail.Cc), []);
    assert.deepEqual(direcciones(mail.Bcc), []);
    assert.equal(mail.Subject, 'RPAD: hoy tenés 1 nota para firmar');
    const [adjunto, ...otros] = await adjuntos(mail.ID);
    assert.equal(otros.length, 0, 'el anexo no se firma: no va');
    assert.equal(adjunto.nombre, 'Nota-Digital-1-26.pdf');
    assert.ok(adjunto.contenido.equals(nota.pdf_para_firmar));
    const html = await mailpit.html(mail.ID);
    assert.ok(html.includes('Buen día, Julieta.'));
    assert.ok(html.includes('Nota Digital N° 1/26'));
    assert.ok(html.includes('correos.html#libro'));
    assert.match((await ultimaCorrida()).resultado, /^0 enviada\(s\), 0 fallida\(s\), 1 para firmar$/);
    assert.equal((await ultimaCorrida()).con_errores, 0);
  });

  it('dos notas del día van en un solo mail, cada una adjunta', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await crearDataset({ vencimiento: '2026-12-31', gestion: 'externa', requiereNota: 1 });
    await correr('2026-11-23');
    const lista = await mensajes();
    assert.equal(lista.length, 1);
    assert.equal(lista[0].Subject, 'RPAD: hoy tenés 2 notas para firmar');
    assert.deepEqual((await adjuntos(lista[0].ID)).map(a => a.nombre).sort(), ['Nota-Digital-1-26.pdf', 'Nota-Digital-2-26.pdf']);
  });

  it('una corrida repetida no reenvía la que espera ni repite el mail', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    await mailpit.vaciar();
    const resumen = await correr('2026-11-02', '09:30:00');
    assert.deepEqual([resumen.enviadas, resumen.fallidas, resumen.para_firmar.length], [0, 0, 0]);
    assert.equal((await mensajes()).length, 0);
    const lista = await notas();
    assert.equal(lista.length, 1);
    assert.equal(lista[0].estado, 'pendiente');
  });

  it('la reiteración también espera', async () => {
    await crearDataset({ titulo: 'Avisado temprano', vencimiento: '2026-11-30' });
    await query('UPDATE notas_digitales_config SET firma_digital_activa = 0');
    await correr('2026-10-01');
    await query('UPDATE notas_digitales_config SET firma_digital_activa = 1');
    await mailpit.vaciar();
    await correr('2026-11-02');
    const reiteracion = (await notas()).find(n => n.tipo === 'reiteracion');
    assert.deepEqual([reiteracion.estado, reiteracion.espera_firma], ['pendiente', 1]);
    assert.ok(reiteracion.anexo_pdf.length > 0, 'la nota conserva su anexo');
    assert.ok(lineasPorHoja(reiteracion.pdf_para_firmar).every(hoja => hoja.includes('Documento firmado digitalmente')));
    const [mail, ...otros] = await mensajes();
    assert.equal(otros.length, 0);
    assert.deepEqual((await adjuntos(mail.ID)).map(a => a.nombre), ['Nota-Digital-2-26.pdf']);
    assert.ok((await mailpit.html(mail.ID)).includes('reiteración, gestión interna'));
    // A las 14:00 sale con la imagen y con su anexo
    await mailpit.vaciar();
    assert.equal((await lasCatorce('2026-11-02')).enviadas, 1);
    const [salio] = await mensajes();
    assert.deepEqual(direcciones(salio.To), ['mit@rpad.test']);
    assert.deepEqual((await adjuntos(salio.ID)).map(a => a.nombre), ['Nota-Digital-2-26.pdf', 'Anexo-Nota-Digital-2-26.pdf']);
  });

  it('la nota de auditoría espera, y a las 14:00 sale a sus destinatarios', async () => {
    await query(
      `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id, created_at, primer_recordatorio_at)
       VALUES ('crear', NULL, ?, ?, '2026-10-15 13:00:00', '2026-10-15 14:00:00')`,
      [JSON.stringify({ titulo: 'Dataset nuevo', tipo_gestion: 'interna' }), titular.id]);
    await crearUsuario('admin', 'Otra Persona');
    await correr('2026-10-19');
    const auditoria = (await notas()).find(n => n.tipo === 'auditoria');
    assert.deepEqual([auditoria.estado, auditoria.espera_firma], ['pendiente', 1]);
    assert.ok(lineasPorHoja(auditoria.pdf_para_firmar).every(hoja => hoja.includes('Documento firmado digitalmente')));
    await mailpit.vaciar();
    assert.equal((await lasCatorce('2026-10-19')).enviadas, 1);
    assert.deepEqual(direcciones((await mensajes())[0].To), ['auditoria@rpad.test']);
  });
});

describe('quién firma', () => {
  it('la víspera de una licencia firma el titular; durante ella, la persona autorizada, y el mail le llega a ella', async () => {
    await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    await crearDataset({ titulo: 'Vence en enero', vencimiento: '2027-01-20' });
    await crearDataset({ titulo: 'Vence en febrero', vencimiento: '2027-02-15' });
    await correr('2026-11-25');
    const [aviso] = await notas();
    assert.deepEqual([aviso.firmante_id, aviso.presentada_por_id, aviso.espera_firma], [titular.id, null, 1]);
    assert.deepEqual(direcciones((await mensajes())[0].To), [titular.email]);
    assert.equal((await lasCatorce('2026-11-25')).enviadas, 1);
    await mailpit.vaciar();

    // El 17/12 vuelve a salir, en su fecha, lo de febrero: la presenta ella
    await correr('2026-12-17');
    const nota = (await notas()).at(-1);
    assert.deepEqual([nota.firmante_id, nota.presentada_por_id, nota.espera_firma], [titular.id, autorizado.id, 1]);
    const lista = await mensajes();
    assert.equal(lista.length, 1);
    assert.deepEqual(direcciones(lista[0].To), [autorizado.email]);
    assert.ok((await mailpit.html(lista[0].ID)).includes('Buen día, Tomás.'));
  });

  it('una autorización tardía, con el titular ya de licencia, no espera: nadie la puede firmar; las demás del día, sí', async () => {
    await licencia(titular, '2026-10-26', '2026-11-13', autorizado);
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    const lista = await notas();
    const autorizacion = lista.find(n => n.tipo === 'autorizacion');
    assert.deepEqual([autorizacion.estado, autorizacion.espera_firma], ['enviada', 0]);
    const aviso = lista.find(n => n.tipo === 'aviso');
    assert.deepEqual([aviso.estado, aviso.espera_firma, aviso.presentada_por_id], ['pendiente', 1, autorizado.id]);
    const mails = await mensajes();
    assert.equal(mails.filter(m => direcciones(m.To).includes(autorizado.email)).length, 1);
  });

  it('la firma de Correos, sin titular elegido, no espera', async () => {
    await query('UPDATE notas_digitales_config SET firmante_usuario_id = NULL');
    await crearDataset({ vencimiento: '2026-12-31' });
    const resumen = await correr('2026-11-02');
    assert.equal(resumen.enviadas, 1);
    assert.equal((await notas())[0].espera_firma, 0);
  });

  for (const [caso, cambio] of [['desactivada', 'activo = 0'], ['sin un email válido', "email = 'sin-arroba'"]]) {
    it(`una persona ${caso} no firma: la nota sale como siempre`, async () => {
      await query(`UPDATE usuarios SET ${cambio} WHERE id = ?`, [titular.id]);
      await crearDataset({ vencimiento: '2026-12-31' });
      assert.equal((await correr('2026-11-02')).enviadas, 1);
      assert.deepEqual([(await notas())[0].estado, (await notas())[0].espera_firma], ['enviada', 0]);
    });
  }

  it('después de las 14:00 no se espera: una corrida manual a las 15:00 envía', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    assert.equal((await correr('2026-11-02', '15:00:00')).enviadas, 1);
    assert.equal((await notas())[0].espera_firma, 0);
  });

  it('a las 14:00 justas tampoco; un minuto antes, sí', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    assert.equal((await correr('2026-11-02', '14:00:00')).enviadas, 1);
    await query('DELETE FROM notas_digitales');
    assert.deepEqual((await correr('2026-11-02', '13:59:59')).enviadas, 0);
    assert.equal((await notas())[0].espera_firma, 1);
  });

  it('una nota de prueba nunca espera', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await configurarNotas({ firma_digital_activa: 1, casillas_prueba: 'prueba@rpad.test' });
    await motor.enviarPrueba({ tipo: 'aviso', gestion: 'interna', usuarioId: null, hoy: '2026-11-02' });
    const [prueba] = await query('SELECT estado, espera_firma FROM notas_digitales WHERE es_prueba = 1');
    assert.deepEqual([prueba.estado, prueba.espera_firma], ['enviada', 0]);
  });
});

describe('si el mail a quien firma no sale', () => {
  it('la nota sigue esperando y el error queda en la última corrida, sin la dirección', async () => {
    process.env.EMAIL_SOLO_A = 'otra-casilla@rpad.test';
    await crearDataset({ vencimiento: '2026-12-31' });
    const resumen = await correr('2026-11-02');
    assert.deepEqual(resumen.errores.map(e => e.tipo), ['para-firmar']);
    assert.ok(!JSON.stringify(resumen.errores).includes(titular.email));
    assert.equal((await notas())[0].espera_firma, 1);
    const corrida = await ultimaCorrida();
    assert.equal(corrida.con_errores, 1);
    assert.match(corrida.resultado, /No se pudo enviar el mail con las notas para firmar/);
    process.env.EMAIL_SOLO_A = '';
    assert.equal((await lasCatorce('2026-11-02')).enviadas, 1);
  });
});

describe('a las 14:00', () => {
  beforeEach(async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    await mailpit.vaciar();
  });

  it('sale la que espera, con la imagen, sin la línea de la firma, y deja de esperar', async () => {
    const resumen = await lasCatorce('2026-11-02');
    assert.deepEqual([resumen.ejecutado, resumen.enviadas, resumen.fallidas], [true, 1, 0]);
    const [nota] = await notas();
    assert.deepEqual([nota.estado, nota.espera_firma, nota.intentos], ['enviada', 0, 1]);
    const [mail] = await mensajes();
    assert.deepEqual(direcciones(mail.To), ['mit@rpad.test']);
    assert.ok(!(await mailpit.html(mail.ID)).includes('firmada digitalmente'));
    assert.ok((await adjuntos(mail.ID))[0].contenido.equals(nota.pdf));
  });

  it('antes de las 14:00 no hace nada (la ruta manual de los recordatorios se puede llamar en cualquier momento)', async () => {
    const resumen = await lasCatorce('2026-11-02', '13:59:59');
    assert.equal(resumen.ejecutado, false);
    assert.equal((await notas())[0].estado, 'pendiente');
  });

  it('un día no hábil, con el envío apagado o con la configuración incompleta no hace nada', async () => {
    assert.equal((await lasCatorce('2026-11-07')).ejecutado, false);
    await query('UPDATE notas_digitales_config SET envio_activo = 0');
    assert.equal((await lasCatorce('2026-11-02')).ejecutado, false);
    await query("UPDATE notas_digitales_config SET envio_activo = 1, firma_nombre = ''");
    await query('UPDATE notas_digitales_config SET firmante_usuario_id = NULL');
    assert.equal((await lasCatorce('2026-11-02')).ejecutado, false);
    assert.equal((await notas())[0].estado, 'pendiente');
  });

  it('con otra corrida en curso no envía ni da error, y la toma la mañana siguiente', async () => {
    const conexion = await db().getConnection();
    await conexion.query('SELECT GET_LOCK(?, 0)', [BLOQUEO]);
    try {
      const resumen = await motor.enviarLasQueEsperanFirma({ hoy: '2026-11-02', ahora: '2026-11-02 14:00:00', calendario: CALENDARIO_FIJO, intentos: 2, esperaMs: 1 });
      assert.deepEqual([resumen.ocupado, resumen.enviadas, resumen.errores.length], [true, 0, 0]);
    } finally {
      await conexion.query('SELECT RELEASE_LOCK(?)', [BLOQUEO]);
      conexion.release();
    }
    await correr('2026-11-03');
    assert.deepEqual([(await notas())[0].estado, (await notas())[0].espera_firma], ['enviada', 0]);
  });

  it('si el candado se libera mientras espera, las manda', async () => {
    const conexion = await db().getConnection();
    await conexion.query('SELECT GET_LOCK(?, 0)', [BLOQUEO]);
    const pedido = motor.enviarLasQueEsperanFirma({ hoy: '2026-11-02', ahora: '2026-11-02 14:00:00', calendario: CALENDARIO_FIJO, intentos: 40, esperaMs: 25 });
    await new Promise(r => setTimeout(r, 60));
    await conexion.query('SELECT RELEASE_LOCK(?)', [BLOQUEO]);
    conexion.release();
    const resumen = await pedido;
    assert.deepEqual([resumen.ocupado, resumen.enviadas], [false, 1]);
  });

  it('el controlador de las 14:00 deja anotado un candado ocupado, y responde 207', async () => {
    const { ejecutarNotificacionCambiosPendientes } = await import('../controllers/notificacionesController.js');
    const conexion = await db().getConnection();
    await conexion.query('SELECT GET_LOCK(?, 0)', [BLOQUEO]);
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date('2026-11-02T17:00:00Z') });
    try {
      const respuesta = { status(c) { this.codigo = c; return this; }, json(c) { this.cuerpo = c; return this; } };
      const pedido = ejecutarNotificacionCambiosPendientes({ query: {}, user: undefined }, respuesta);
      // Los 5 intentos de espera, de a 5 segundos, sin esperar de verdad. El tope es de tiempo real (`performance` no está simulado), nunca de
      // vueltas: si las vueltas se acaban antes de la última espera, por una base lenta, el pedido se queda para siempre en un setTimeout simulado
      const limite = performance.now() + 30000;
      while (!respuesta.cuerpo && performance.now() < limite) {
        mock.timers.tick(5000);
        await new Promise(resolver => setImmediate(resolver));
      }
      assert.ok(respuesta.cuerpo, 'El controlador de las 14:00 no respondió en 30 segundos');
      await pedido;
      assert.equal(respuesta.codigo, 207);
      assert.equal(respuesta.cuerpo.data.firma_digital.ocupado, true);
      assert.match((await ultimaCorrida()).resultado, /No se pudieron enviar todas las notas que esperaban la firma digital/);
    } finally {
      mock.timers.reset();
      await conexion.query('SELECT RELEASE_LOCK(?)', [BLOQUEO]);
      conexion.release();
    }
  });

  it('si el email falla queda fallida, deja de esperar y la corrida siguiente la reintenta', async () => {
    process.env.EMAIL_SOLO_A = 'otra-casilla@rpad.test';
    const resumen = await lasCatorce('2026-11-02');
    assert.equal(resumen.fallidas, 1);
    assert.deepEqual([(await notas())[0].estado, (await notas())[0].espera_firma], ['fallida', 0]);
    process.env.EMAIL_SOLO_A = '';
    assert.equal((await correr('2026-11-03')).enviadas, 1);
  });

  it('el controlador de las 14:00 las manda antes de los recordatorios y lo dice en su respuesta', async () => {
    const { ejecutarNotificacionCambiosPendientes } = await import('../controllers/notificacionesController.js');
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-02T17:00:00Z') });
    try {
      const respuesta = { status(c) { this.codigo = c; return this; }, json(c) { this.cuerpo = c; return this; } };
      await ejecutarNotificacionCambiosPendientes({ query: {}, user: undefined }, respuesta);
      assert.equal(respuesta.cuerpo.data.firma_digital.enviadas, 1);
      assert.equal((await notas())[0].estado, 'enviada');
      // Sin nada que mandar, la respuesta es la de siempre
      const otra = { status(c) { this.codigo = c; return this; }, json(c) { this.cuerpo = c; return this; } };
      await ejecutarNotificacionCambiosPendientes({ query: {}, user: undefined }, otra);
      assert.ok(!('firma_digital' in otra.cuerpo.data));
    } finally {
      mock.timers.reset();
    }
  });
});

describe('la corrida de la mañana siguiente', () => {
  it('una que esperaba de ayer sale con la imagen: nunca queda colgada; la de hoy, no', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    await mailpit.vaciar();
    await crearDataset({ vencimiento: '2026-12-31', titulo: 'Otro' });
    const resumen = await correr('2026-11-03');
    const [ayer, hoy] = await notas();
    assert.equal(resumen.enviadas, 1);
    assert.deepEqual([ayer.estado, ayer.espera_firma], ['enviada', 0]);
    if (hoy) assert.deepEqual([hoy.estado, hoy.espera_firma], ['pendiente', 1]);
    assert.ok((await mensajes()).some(aDestinatarios));
  });
});

describe('con la copia firmada', () => {
  it('el email la adjunta con el nombre de siempre, dice quién firmó y pdf queda igual; html, también', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    await mailpit.vaciar();
    const [antes] = await query('SELECT id, pdf, html FROM notas_digitales');
    const firmado = Buffer.concat([antes.pdf, Buffer.from('\nfirma')]);
    await query("UPDATE notas_digitales SET pdf_firmado = ?, firmado_por = '<b>José Núñez</b>'", [firmado]);
    assert.equal((await lasCatorce('2026-11-02')).enviadas, 1);
    const [mail] = await mensajes();
    const lista = await adjuntos(mail.ID);
    assert.equal(lista[0].nombre, 'Nota-Digital-1-26.pdf');
    assert.ok(lista[0].contenido.equals(firmado));
    assert.ok(lista.some(a => a.nombre === 'Anexo-Nota-Digital-1-26.pdf'));
    const html = await mailpit.html(mail.ID);
    assert.ok(html.includes('La nota está firmada digitalmente por &lt;b&gt;José Núñez&lt;/b&gt;, en conformidad con la Ordenanza N° 15.276/20.'));
    const texto = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${mail.ID}`)).json()).Text;
    assert.ok(texto.includes('La nota está firmada digitalmente por <b>José Núñez</b>, en conformidad con la Ordenanza N° 15.276/20.'));
    const [despues] = await query('SELECT pdf, html FROM notas_digitales');
    assert.ok(despues.pdf.equals(antes.pdf));
    assert.equal(despues.html, antes.html);
  });
});

describe('Correos → Estado', () => {
  it('dice las que esperan, sin los bytes, con su alerta, y el interruptor', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    let estado = await motor.estadoNotas({ hoy: '2026-11-02' });
    assert.equal(estado.firma_digital_activa, true);
    assert.deepEqual(estado.para_firmar, []);
    assert.ok(!estado.alertas.some(a => a.tipo === 'para-firmar'));

    await correr('2026-11-02');
    estado = await motor.estadoNotas({ hoy: '2026-11-02' });
    assert.equal(estado.para_firmar.length, 1);
    const [fila] = estado.para_firmar;
    assert.deepEqual(Object.keys(fila).sort(), ['anio', 'fecha', 'firma_nombre', 'firmado_at', 'firmado_por', 'gestion', 'id', 'numero', 'tipo']);
    assert.equal(fila.firma_nombre, 'Julieta Ferreyra');
    const alerta = estado.alertas.find(a => a.tipo === 'para-firmar');
    assert.equal(alerta.nivel, 'advertencia');
    assert.equal(alerta.mensaje, 'Hay 1 nota para firmar. Las que no se suban antes de las 14:00 salen con la imagen de la firma.');

    await query("UPDATE notas_digitales SET pdf_firmado = 'x', firmado_por = 'X', firmado_at = '2026-11-02 09:12:00'");
    estado = await motor.estadoNotas({ hoy: '2026-11-02' });
    assert.equal(estado.alertas.find(a => a.tipo === 'para-firmar').mensaje, 'Hay 1 nota firmada sin enviar. Sale sola a las 14:00.');
    // Con una firmada y otra sin firmar, cuenta cada una por su lado
    await crearDataset({ vencimiento: '2026-12-31', titulo: 'Otro', gestion: 'externa', requiereNota: 1 });
    await query("UPDATE notas_digitales SET fecha = '2026-11-23'");
    await correr('2026-11-23');
    estado = await motor.estadoNotas({ hoy: '2026-11-23' });
    assert.equal(estado.alertas.find(a => a.tipo === 'para-firmar').mensaje,
      'Hay 1 nota para firmar y 1 nota firmada sin enviar. Las que no se suban antes de las 14:00 salen con la imagen de la firma.');
    assert.equal(estado.para_firmar.at(-1).firmado_at, '2026-11-02 09:12');
  });
});

describe('Correos → Estado: las que ya tendrían que haber salido', () => {
  const alertas = (estado, tipo) => estado.alertas.filter(a => a.tipo === tipo);
  beforeEach(async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
  });

  it('a las 14:14 todavía es la de siempre; a las 14:15, en rojo y con la Tarea Cron', async () => {
    let estado = await motor.estadoNotas({ hoy: '2026-11-02', ahora: '2026-11-02 14:14:00' });
    assert.equal(alertas(estado, 'para-firmar').length, 1);
    assert.equal(alertas(estado, 'para-firmar-atrasada').length, 0);
    estado = await motor.estadoNotas({ hoy: '2026-11-02', ahora: '2026-11-02 14:15:00' });
    assert.equal(alertas(estado, 'para-firmar').length, 0);
    const [alerta] = alertas(estado, 'para-firmar-atrasada');
    assert.equal(alerta.nivel, 'error');
    assert.equal(alerta.mensaje, 'Hay 1 nota que sigue esperando la firma y ya pasaron las 14:00: revisá la Tarea Cron de /api/cron/cambios-pendientes. Sale en la próxima corrida de la mañana, o con «Reintentar» en el Libro.');
  });

  it('una de un día anterior también, y sale en la corrida de la mañana', async () => {
    const estado = await motor.estadoNotas({ hoy: '2026-11-03', ahora: '2026-11-03 07:00:00' });
    assert.equal(alertas(estado, 'para-firmar-atrasada')[0].nivel, 'error');
    await correr('2026-11-03');
    assert.equal((await notas())[0].estado, 'enviada');
    assert.equal(alertas(await motor.estadoNotas({ hoy: '2026-11-03', ahora: '2026-11-03 09:00:00' }), 'para-firmar-atrasada').length, 0);
  });

  it('con el envío automático apagado lo dice, y un día no hábil es una advertencia', async () => {
    await query('UPDATE notas_digitales_config SET envio_activo = 0');
    let [alerta] = alertas(await motor.estadoNotas({ hoy: '2026-11-02', ahora: '2026-11-02 15:00:00' }), 'para-firmar-atrasada');
    assert.equal(alerta.nivel, 'error');
    assert.equal(alerta.mensaje, 'Hay 1 nota que sigue esperando la firma y el envío automático está apagado: no sale hasta que se active.');
    await query('UPDATE notas_digitales_config SET envio_activo = 1');
    [alerta] = alertas(await motor.estadoNotas({ hoy: '2026-11-07', ahora: '2026-11-07 15:00:00' }), 'para-firmar-atrasada');
    assert.equal(alerta.nivel, 'advertencia');
    assert.equal(alerta.mensaje, 'Hay 1 nota que sigue esperando la firma y hoy no es día hábil: sale en la próxima corrida de la mañana.');
  });
});

describe('a las 14:00, sin nada para enviar', () => {
  it('no toma el candado: con el interruptor apagado, las 14:00 son las de siempre', async () => {
    await query('UPDATE notas_digitales_config SET firma_digital_activa = 0');
    const conexion = await db().getConnection();
    await conexion.query('SELECT GET_LOCK(?, 0)', [BLOQUEO]);
    try {
      const resumen = await motor.enviarLasQueEsperanFirma({ hoy: '2026-11-02', ahora: '2026-11-02 14:00:00', calendario: CALENDARIO_FIJO, intentos: 2, esperaMs: 1 });
      assert.deepEqual([resumen.ejecutado, resumen.ocupado, resumen.enviadas, resumen.errores.length], [false, false, 0, 0]);
    } finally {
      await conexion.query('SELECT RELEASE_LOCK(?)', [BLOQUEO]);
      conexion.release();
    }
  });
});

describe('las 14:00 por el controlador (nunca /api/cron/*)', () => {
  const corridaDeLas14 = async (momento) => {
    const controlador = await import('../controllers/notificacionesController.js');
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    mock.timers.enable({ apis: ['Date'], now: new Date(momento) });
    try {
      await controlador.ejecutarNotificacionCambiosPendientes({}, res);
    } finally {
      mock.timers.reset();
    }
    return res;
  };

  beforeEach(async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    await mailpit.vaciar();
  });

  it('envía la que espera, lo dice en data y, si ya no queda ninguna, data no lo trae', async () => {
    const res = await corridaDeLas14('2026-11-02T17:00:00.000Z');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.firma_digital.enviadas, 1);
    assert.equal((await notas())[0].estado, 'enviada');
    const otra = await corridaDeLas14('2026-11-03T17:00:00.000Z');
    assert.equal(otra.body.data.firma_digital, undefined);
  });

  it('un día no hábil la que espera no sale: la toma la mañana del próximo día hábil, y responde 200', async () => {
    const res = await corridaDeLas14('2026-11-07T17:00:00.000Z');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.firma_digital, undefined);
    assert.equal((await notas())[0].estado, 'pendiente');
    await correr('2026-11-09');
    assert.equal((await notas())[0].estado, 'enviada');
  });

  it('un día no hábil, un error al mirar las que esperan se dice igual: 207', async () => {
    await query('RENAME TABLE notas_digitales_config TO notas_digitales_config_oculta');
    let res;
    try {
      res = await corridaDeLas14('2026-11-07T17:00:00.000Z');
    } finally {
      await query('RENAME TABLE notas_digitales_config_oculta TO notas_digitales_config');
    }
    assert.equal(res.statusCode, 207);
    assert.equal(res.body.success, false);
    assert.equal(res.body.data.dia_habil, false);
  });
});

// Las dos copias (spec 2026-11-04-firma-digital-leyenda, 2.3 y 3): la que espera guarda además la copia con la leyenda, que es la que se firma; lo
// que sale sin firmar es su pdf, byte por byte
describe('la copia con la leyenda', () => {
  const LEYENDA = 'Documento firmado digitalmente';
  const conLeyenda = (pdf) => lineasPorHoja(pdf).every(hoja => hoja.includes(LEYENDA));
  const sinLeyenda = (pdf) => lineasPorHoja(pdf).every(hoja => !hoja.includes(LEYENDA));

  it('con la firma digital apagada no se arma: la nota sale sin leyenda y la columna sigue vacía', async () => {
    await configurarNotas({ firma_digital_activa: 0 });
    await crearDataset({ vencimiento: '2026-12-31' });
    assert.equal((await correr('2026-11-02')).enviadas, 1);
    const [nota] = await notas();
    assert.equal(nota.pdf_para_firmar, null);
    assert.ok(sinLeyenda(nota.pdf));
    const [mail] = await mensajes();
    assert.ok((await adjuntos(mail.ID))[0].contenido.equals(nota.pdf));
  });

  it('con la firma digital apagada ni siquiera se dibuja: un PDF menos que prendida', async () => {
    const dibujados = async (activa) => {
      await limpiarBase();
      await configurarNotas({ firma_digital_activa: activa, para_auditoria: 'auditoria@rpad.test', cc_auditoria: '' });
      await query('UPDATE notas_digitales_config SET firmante_usuario_id = ?', [titular.id]);
      await crearDataset({ vencimiento: '2026-12-31' });
      const espia = mock.method(PDFDocument.prototype, 'end');
      try {
        await correr('2026-11-02');
        return espia.mock.callCount();
      } finally {
        espia.mock.restore();
      }
    };
    const apagada = await dibujados(0);
    const prendida = await dibujados(1);
    assert.ok(prendida > apagada, `${apagada} y ${prendida}`);
  });

  it('apagar el interruptor con una nota esperando no le saca la copia: se sigue firmando sobre ella', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    await configurarNotas({ firma_digital_activa: 0, para_auditoria: 'auditoria@rpad.test', cc_auditoria: '' });
    const [nota] = await notas();
    assert.equal(nota.espera_firma, 1);
    assert.ok(conLeyenda(nota.pdf_para_firmar));
    await mailpit.vaciar();
    assert.equal((await lasCatorce('2026-11-02')).enviadas, 1);
    const [mail] = await mensajes();
    assert.ok((await adjuntos(mail.ID))[0].contenido.equals(nota.pdf), 'sin firmar, con su pdf');
  });

  it('firmada, si el email falla: el reintento manda la firmada, y la copia ya no hace falta', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    const [antes] = await notas();
    const firmado = Buffer.concat([antes.pdf_para_firmar, Buffer.from('\nfirma')]);
    await query("UPDATE notas_digitales SET pdf_firmado = ?, firmado_por = 'Julieta Ferreyra'", [firmado]);
    process.env.EMAIL_SOLO_A = 'otra-casilla@rpad.test';
    assert.equal((await lasCatorce('2026-11-02')).fallidas, 1);
    process.env.EMAIL_SOLO_A = '';
    const [fallida] = await notas();
    assert.deepEqual([fallida.estado, fallida.pdf_para_firmar], ['fallida', null]);
    await mailpit.vaciar();
    assert.equal((await motor.reintentarNota(antes.id)).success, true);
    const [mail] = await mensajes();
    assert.ok((await adjuntos(mail.ID))[0].contenido.equals(firmado));
  });

  it('la que espera tiene las dos: pdf sin la leyenda, la copia con ella, y lo demás de la hoja igual', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    const [nota] = await notas();
    assert.equal(nota.espera_firma, 1);
    assert.ok(sinLeyenda(nota.pdf));
    assert.ok(conLeyenda(nota.pdf_para_firmar));
    assert.deepEqual(tamanosPorHoja(nota.pdf_para_firmar), tamanosPorHoja(nota.pdf));
    const sinLosTextosNuevos = lineasPorHoja(nota.pdf_para_firmar).map(hoja => hoja.filter(t => t !== LEYENDA && !t.startsWith('en conformidad con la Ordenanza')));
    assert.deepEqual(sinLosTextosNuevos, lineasPorHoja(nota.pdf));
  });

  it('la nota de autorización también la tiene, la víspera de la licencia', async () => {
    await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    await correr('2026-11-25');
    const autorizacion = (await notas()).find(n => n.tipo === 'autorizacion');
    assert.equal(autorizacion.espera_firma, 1);
    assert.ok(conLeyenda(autorizacion.pdf_para_firmar));
    assert.ok(sinLeyenda(autorizacion.pdf));
  });

  it('el aviso con las dos firmas, durante la licencia, también', async () => {
    await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    await crearDataset({ titulo: 'Vence en febrero', vencimiento: '2027-02-15' });
    await correr('2026-11-25');
    await lasCatorce('2026-11-25');
    await correr('2026-12-17');
    const nota = (await notas()).at(-1);
    assert.deepEqual([nota.firmante_id, nota.presentada_por_id, nota.espera_firma], [titular.id, autorizado.id, 1]);
    assert.ok(conLeyenda(nota.pdf_para_firmar));
    assert.ok(sinLeyenda(nota.pdf));
  });

  it('sin quién firme no espera y no guarda la copia', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [titular.id]);
    await correr('2026-11-02');
    const [nota] = await notas();
    assert.deepEqual([nota.estado, nota.espera_firma, nota.pdf_para_firmar], ['enviada', 0, null]);
    assert.ok(sinLeyenda(nota.pdf));
  });

  it('a las 14:00 o después de esa hora no espera y no guarda la copia', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02', '14:00:00');
    const [nota] = await notas();
    assert.deepEqual([nota.estado, nota.espera_firma, nota.pdf_para_firmar], ['enviada', 0, null]);
  });

  it('una nota de prueba no la tiene', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await configurarNotas({ firma_digital_activa: 1, casillas_prueba: 'prueba@rpad.test' });
    await motor.enviarPrueba({ tipo: 'aviso', gestion: 'interna', usuarioId: null, hoy: '2026-11-02' });
    const [prueba] = await query('SELECT pdf, pdf_para_firmar FROM notas_digitales WHERE es_prueba = 1');
    assert.equal(prueba.pdf_para_firmar, null);
    assert.ok(sinLeyenda(prueba.pdf));
  });

  it('sale sin firmar a las 14:00: su pdf, byte por byte, sin línea, y la copia se borra', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    await mailpit.vaciar();
    const [antes] = await notas();
    assert.equal((await lasCatorce('2026-11-02')).enviadas, 1);
    const [mail] = await mensajes();
    assert.ok((await adjuntos(mail.ID))[0].contenido.equals(antes.pdf));
    assert.ok(!(await mailpit.html(mail.ID)).includes('firmada digitalmente'));
    const [nota] = await notas();
    assert.deepEqual([nota.estado, nota.pdf_para_firmar], ['enviada', null]);
    assert.ok(nota.pdf.equals(antes.pdf));
  });

  it('sale sin firmar a la mañana siguiente: lo mismo', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    const [antes] = await notas();
    await mailpit.vaciar();
    await correr('2026-11-03');
    const paraElArea = (await mensajes()).find(aDestinatarios);
    assert.ok((await adjuntos(paraElArea.ID))[0].contenido.equals(antes.pdf));
    const nota = (await notas()).find(n => n.id === antes.id);
    assert.deepEqual([nota.estado, nota.pdf_para_firmar], ['enviada', null]);
  });

  it('sale firmada: la copia firmada, con la línea, y la copia se borra', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    await mailpit.vaciar();
    const [antes] = await notas();
    const firmado = Buffer.concat([antes.pdf_para_firmar, Buffer.from('\nfirma')]);
    await query("UPDATE notas_digitales SET pdf_firmado = ?, firmado_por = 'Julieta Ferreyra'", [firmado]);
    assert.equal((await lasCatorce('2026-11-02')).enviadas, 1);
    const [mail] = await mensajes();
    assert.ok((await adjuntos(mail.ID))[0].contenido.equals(firmado));
    assert.ok((await mailpit.html(mail.ID)).includes('firmada digitalmente por Julieta Ferreyra'));
    const [nota] = await notas();
    assert.deepEqual([nota.estado, nota.pdf_para_firmar], ['enviada', null]);
  });

  it('si el email falla, la copia también se borra: el reintento manda el pdf, sin leyenda', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    await mailpit.vaciar();
    const [antes] = await notas();
    process.env.EMAIL_SOLO_A = 'otra-casilla@rpad.test';
    assert.equal((await lasCatorce('2026-11-02')).fallidas, 1);
    process.env.EMAIL_SOLO_A = '';
    const [fallida] = await notas();
    assert.deepEqual([fallida.estado, fallida.espera_firma, fallida.pdf_para_firmar], ['fallida', 0, null]);
    await mailpit.vaciar();
    assert.equal((await motor.reintentarNota(antes.id)).success, true);
    const [mail] = await mensajes();
    assert.ok((await adjuntos(mail.ID))[0].contenido.equals(antes.pdf));
  });

  it('una que espera sin copia (de antes de esta entrega) le llega a quien firma con su pdf', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    const pool = (await import('../config/database.js')).default;
    const original = pool.execute.bind(pool);
    const espia = mock.method(pool, 'execute', (sql, valores) => original(sql, sql.includes('espera_firma = 1, pdf_para_firmar') ? [null, valores[1]] : valores));
    try {
      await correr('2026-11-02');
    } finally {
      espia.mock.restore();
    }
    const [nota] = await notas();
    assert.deepEqual([nota.espera_firma, nota.pdf_para_firmar], [1, null]);
    const [mail] = await mensajes();
    assert.ok((await adjuntos(mail.ID))[0].contenido.equals(nota.pdf));
  });

  it('si no se puede marcar la espera, se anota y la nota sale: la firma digital no frena una nota', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    const pool = (await import('../config/database.js')).default;
    const espia = mock.method(pool, 'execute', async () => { throw new Error('Se cortó la base'); });
    let resumen;
    try {
      resumen = await correr('2026-11-02');
    } finally {
      espia.mock.restore();
    }
    assert.equal(resumen.enviadas, 1);
    assert.equal(resumen.errores.length, 1);
    const [nota] = await notas();
    assert.deepEqual([nota.estado, nota.espera_firma, nota.pdf_para_firmar], ['enviada', 0, null]);
  });

  it('si la copia no se puede armar, la nota se genera igual', async () => {
    const config = (await query('SELECT * FROM notas_digitales_config WHERE id = 1'))[0];
    const consola = mock.method(console, 'error', () => {});
    let id;
    try {
      id = await motor.generarNota({
        tipo: 'autorizacion', gestion: null, fecha: '2026-11-25', datasets: [], config,
        autorizacion: { nombre: 'Tomás Aguirre', cargo: 'Cargo admin', contratado: false, email: autorizado.email, desde: '2026-11-26', hasta: '2027-01-14' },
        copiasParaFirmar: { set() { throw new Error('No hay copia'); } }
      });
    } finally {
      consola.mock.restore();
    }
    assert.ok(id > 0);
    assert.equal(consola.mock.callCount(), 1);
    const [nota] = await notas();
    assert.deepEqual([nota.id, nota.tipo, nota.pdf_para_firmar], [id, 'autorizacion', null]);
  });
});

// Soltar a mano si las 14:00 no corrieron (spec 2026-11-04-firma-digital-leyenda, 2.6)
describe('soltar a mano una nota que sigue esperando', () => {
  it('condicionesParaSoltar dice el día hábil y el envío, con el calendario y la configuración', async () => {
    const lunes = { hoy: '2026-11-02', ahora: '2026-11-02 14:20:00', calendario: CALENDARIO_FIJO };
    assert.deepEqual(await motor.condicionesParaSoltar(lunes), { ...{ hoy: lunes.hoy, ahora: lunes.ahora }, envioActivo: true, diaHabil: true });
    const domingo = { hoy: '2026-11-01', ahora: '2026-11-01 14:20:00', calendario: CALENDARIO_FIJO };
    assert.equal((await motor.condicionesParaSoltar(domingo)).diaHabil, false);
    await query('UPDATE notas_digitales_config SET envio_activo = 0');
    assert.equal((await motor.condicionesParaSoltar(lunes)).envioActivo, false);
  });

  it('firmada, sale con la firmada y la línea', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    await mailpit.vaciar();
    const [antes] = await notas();
    const firmado = Buffer.concat([antes.pdf_para_firmar, Buffer.from('\nfirma')]);
    await query("UPDATE notas_digitales SET pdf_firmado = ?, firmado_por = 'Julieta Ferreyra'", [firmado]);
    assert.equal((await motor.reintentarNota(antes.id)).success, true);
    const [mail] = await mensajes();
    assert.ok((await adjuntos(mail.ID))[0].contenido.equals(firmado));
    assert.ok((await mailpit.html(mail.ID)).includes('firmada digitalmente por Julieta Ferreyra'));
    const [despues] = await notas();
    assert.deepEqual([despues.estado, despues.espera_firma, despues.pdf_para_firmar], ['enviada', 0, null]);
  });

  it('sin firmar, sale con su pdf, sin la línea, y deja de esperar', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    await mailpit.vaciar();
    const [antes] = await notas();
    assert.equal((await motor.reintentarNota(antes.id)).success, true);
    const [mail] = await mensajes();
    assert.ok((await adjuntos(mail.ID))[0].contenido.equals(antes.pdf));
    assert.ok(!(await mailpit.html(mail.ID)).includes('firmada digitalmente'));
    const [despues] = await notas();
    assert.deepEqual([despues.estado, despues.espera_firma, despues.pdf_para_firmar], ['enviada', 0, null]);
  });
});
