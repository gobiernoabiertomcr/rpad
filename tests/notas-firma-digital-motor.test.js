// La firma digital en la corrida de las Notas Digitales (spec 2026-11-03-notas-firma-digital, 4): qué nota espera, el mail a quien firma, las
// 14:00 y la corrida de la mañana siguiente. Con fechas y horas fijas, sobre una base de prueba + Mailpit. Las funciones se llaman directo,
// nunca /api/cron/*. Con la firma digital apagada, el motor es el de siempre: lo prueban notas-motor, notas-licencias y notas-auditoria
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query, mailpit, db, MAILPIT_URL } from './helpers.js';
import { crearDataset, limpiarBase, configurarNotas } from './notas-fixtures.js';
import { pngRgba } from './firma-fixtures.js';
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
  `SELECT id, numero, anio, tipo, gestion, estado, intentos, espera_firma, firmante_id, presentada_por_id, pdf, anexo_pdf, para,
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
    assert.ok(adjunto.contenido.equals(nota.pdf));
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
      // Los 5 intentos de espera, de a 5 segundos, sin esperar de verdad
      for (let i = 0; i < 200 && !respuesta.cuerpo; i++) {
        mock.timers.tick(5000);
        await new Promise(resolver => setImmediate(resolver));
      }
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
    assert.ok(html.includes('La nota está firmada digitalmente por &lt;b&gt;José Núñez&lt;/b&gt;.'));
    const texto = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${mail.ID}`)).json()).Text;
    assert.ok(texto.includes('La nota está firmada digitalmente por <b>José Núñez</b>.'));
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
    assert.equal(alerta.mensaje, 'Hay 1 nota que sigue esperando la firma y ya pasaron las 14:00: revisá la Tarea Cron de /api/cron/cambios-pendientes. Sale en la próxima corrida de la mañana.');
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
