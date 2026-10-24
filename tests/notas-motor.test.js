// Motor de Notas Digitales: calendario, numeración, envío, reintentos y concurrencia (base de prueba + Mailpit)
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, cerrarDb, query, mailpit, db, MAILPIT_URL } from './helpers.js';
import { crearDataset, crearNota, crearEmailViejo, limpiarBase, configurarNotas, crearArea, conFallaSimulada, asegurarBaseDePrueba } from './notas-fixtures.js';
import { pngRgba, pngRgb, pngsDanados } from './firma-fixtures.js';
import { textosPorHoja, imagenesPorHoja, lineasPorHoja, tamanosPorHoja, HOJA_A4, HOJA_OFICIO, esDelTamano } from './pdf-lector.js';
import { formatoCorto, hoyArgentina, proximoDiaHabil, sumarDias } from '../services/notasDigitalesCalendario.js';
import { esFinDeMes, sumarMeses, vencimientoDelMes } from '../services/fechasDatasetReglas.js';
import { construirNota } from '../services/notasDigitalesContenido.js';
import { seguimientoDe } from '../services/seguimientoReglas.js';
import { OPCIONES_CINTA_PDF } from '../services/seguimientoPdf.js';
import { CASOS, CATALOGOS, HOY_DE_LOS_CASOS } from './seguimiento-casos.js';

// Banner del membrete generado para los tests (la imagen institucional no se versiona)
const BANNER = pngRgb({ ancho: 1241, alto: 178 });
let base, motor, datos, seguimientoNotas, seguimientoDatos, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_notas_motor');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  motor = await import('../services/notasDigitales.js');
  datos = await import('../services/notasDigitalesDatos.js');
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba
  seguimientoNotas = await import('../services/notasDigitalesSeguimiento.js');
  seguimientoDatos = await import('../services/seguimientoDatos.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  process.env.EMAIL_SOLO_A = '';
  await limpiarBase();
  await configurarNotas();
  await mailpit.vaciar();
});

const notas = () => query('SELECT id, numero, anio, tipo, gestion, estado, intentos, asunto, html, respuesta_smtp, message_id FROM notas_digitales ORDER BY id');
const direcciones = (lista) => (lista || []).map(d => d.Address);
const ejecutar = (hoy) => motor.ejecutarNotasDigitales({ hoy });
const BLOQUEO = 'rpad_notas_digitales';
const ultimaCorrida = async () => (await query(
  `SELECT DATE_FORMAT(ultima_corrida_fecha, '%Y-%m-%d') AS fecha, DATE_FORMAT(ultima_corrida_inicio, '%Y-%m-%d %H:%i:%s') AS inicio,
          DATE_FORMAT(ultima_corrida_fin, '%Y-%m-%d %H:%i:%s') AS fin, ultima_corrida_resultado AS resultado,
          ultima_corrida_con_errores AS con_errores
   FROM notas_digitales_config WHERE id = 1`
))[0];
const FECHA_HORA = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

// Adjuntos de un mensaje de Mailpit, en orden: nombre y bytes
const adjuntos = async (id) => {
  const detalle = await (await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)).json();
  return Promise.all(detalle.Attachments.map(async a => ({
    nombre: a.FileName,
    contenido: Buffer.from(await (await fetch(`${MAILPIT_URL}/api/v1/message/${id}/part/${a.PartID}`)).arrayBuffer())
  })));
};

// Simula otra corrida (otro proceso): una conexión propia que tiene tomado el bloqueo hasta liberarlo
const tomarBloqueoAjeno = async () => {
  const conexion = await db().getConnection();
  const [[{ tomado }]] = await conexion.query('SELECT GET_LOCK(?, 0) AS tomado', [BLOQUEO]);
  assert.equal(Number(tomado), 1);
  return async () => {
    await conexion.query('SELECT RELEASE_LOCK(?)', [BLOQUEO]);
    conexion.release();
  };
};

// Deja una nota real en estado 'fallida' (el envío se bloquea con EMAIL_SOLO_A) y devuelve su id
const crearNotaFallida = async () => {
  await crearDataset({ vencimiento: '2026-12-31' });
  process.env.EMAIL_SOLO_A = 'nadie@rpad.test';
  await ejecutar('2026-11-02');
  process.env.EMAIL_SOLO_A = '';
  const [nota] = await notas();
  assert.equal(nota.estado, 'fallida');
  return nota.id;
};

describe('condiciones para ejecutar', () => {
  it('con el envío desactivado no genera nada', async () => {
    await configurarNotas({ envio_activo: 0 });
    await crearDataset({ vencimiento: '2026-12-31' });
    const resumen = await ejecutar('2026-11-02');
    assert.equal(resumen.motivo, 'Envío automático desactivado');
    assert.equal((await notas()).length, 0);
  });

  it('con la configuración incompleta no genera nada y dice qué falta', async () => {
    await configurarNotas({ firma_nombre: '', para_externa: '' });
    await crearDataset({ vencimiento: '2026-12-31' });
    const resumen = await ejecutar('2026-11-02');
    assert.match(resumen.motivo, /Configuración incompleta: .*Para \(gestión externa\).*nombre de la firma/);
    assert.equal((await notas()).length, 0);
  });

  it('en un día no hábil no genera nada', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    assert.equal((await ejecutar('2026-11-01')).motivo, 'Día no hábil');
    assert.equal((await notas()).length, 0);
  });

  it('una fecha que no es AAAA-MM-DD queda registrada como corrida con error, sin seleccionar nada', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    const resumen = await ejecutar('11/02/2026');
    assert.equal(resumen.ejecutado, false);
    assert.equal(resumen.motivo, 'Fecha de corrida inválida');
    assert.deepEqual(resumen.errores.map(e => e.tipo), ['fecha']);
    assert.equal((await notas()).length, 0);

    const corrida = await ultimaCorrida();
    assert.equal(corrida.fecha, null);
    assert.match(corrida.inicio, FECHA_HORA);
    assert.match(corrida.fin, FECHA_HORA);
    assert.equal(corrida.con_errores, 1);
    assert.match(corrida.resultado, /^Fecha de corrida inválida\. 1 error\(es\): fecha: "11\/02\/2026"/);
    const [marcas] = await query('SELECT reiteracion_evaluada_interna AS interna, reiteracion_evaluada_externa AS externa FROM notas_digitales_config WHERE id = 1');
    assert.deepEqual(marcas, { interna: null, externa: null });
  });
});

describe('avisos', () => {
  it('aviso interno: destinatarios, asunto, adjunto y registro del comprobante', async () => {
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    const resumen = await ejecutar('2026-11-02');
    assert.equal(resumen.enviadas, 1);

    const [mensaje] = await mailpit.mensajes();
    assert.equal(mensaje.From.Name, 'Dir. de Datos Públicos y Comunicación');
    assert.deepEqual(direcciones(mensaje.To), ['mit@rpad.test']);
    assert.deepEqual(direcciones(mensaje.Cc), ['geo@rpad.test']);
    assert.deepEqual(direcciones(mensaje.Bcc), ['respaldo@rpad.test']);
    assert.equal(mensaje.Subject, 'Nota Digital N° 1/26 – Ref.: Solicitud de gestión de datos para el Portal de Datos Abiertos Municipal (gestión interna – noviembre 2026)');
    const detalle = await (await fetch(`http://localhost:8025/api/v1/message/${mensaje.ID}`)).json();
    assert.deepEqual(detalle.Attachments.map(a => a.FileName), ['Nota-Digital-1-26.pdf', 'Anexo-Nota-Digital-1-26.pdf']);

    const [nota] = await notas();
    assert.equal(nota.estado, 'enviada');
    assert.match(nota.respuesta_smtp, /^250/);
    assert.ok(nota.message_id);
    const [fila] = await query('SELECT seccion, DATE_FORMAT(vencimiento, "%Y-%m-%d") AS vencimiento FROM notas_digitales_datasets WHERE dataset_id = ?', [id]);
    assert.deepEqual(fila, { seccion: 'proximo', vencimiento: '2026-12-31' });
  });

  it('aviso externo con su CC y los contactos del área', async () => {
    const area = await crearArea({ nombre: 'Área Externa', email_principal: 'externa@rpad.test' });
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-30', areaId: area });
    await ejecutar('2026-11-02');
    const [mensaje] = await mailpit.mensajes();
    assert.deepEqual(direcciones(mensaje.Cc), ['adm@rpad.test']);
    assert.ok((await mailpit.html(mensaje.ID)).includes('Email: externa@rpad.test'));
  });

  it('los a vencer llevan el antecedente de emails anteriores', async () => {
    const id = await crearDataset({ gestion: 'externa', vencimiento: '2026-11-30', ultima: '2025-11-30' });
    await crearEmailViejo({ tipo: 'externo-60', datasetIds: [id], enviado: '2026-01-01 08:00:00' });
    await crearEmailViejo({ tipo: 'externo-40', datasetIds: [id], enviado: '2026-10-01 08:00:00' });
    await ejecutar('2026-11-02');
    const [mensaje] = await mailpit.mensajes();
    const html = await mailpit.html(mensaje.ID);
    assert.ok(html.includes('Próximos a vencer'));
    assert.ok(html.includes('Antecedente: notificado a la DGMIT por correo electrónico en 2 oportunidades, entre el 01/01/2026 y el 01/10/2026.'));
  });

  it('un dataset vencido que nunca tuvo aviso no sale en el aviso', async () => {
    await crearDataset({ gestion: 'externa', vencimiento: '2026-07-31', ultima: '2025-07-31' });
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-30', titulo: 'A vencer' });
    await ejecutar('2026-11-02');
    const avisos = (await notas()).filter(n => n.tipo === 'aviso');
    assert.equal(avisos.length, 1);
    assert.ok(!avisos[0].html.includes('Plazo de actualización vencido'));
    assert.ok(avisos[0].html.includes('A vencer'));
    assert.equal((await query('SELECT COUNT(*) AS n FROM notas_digitales_datasets WHERE nota_id = ?', [avisos[0].id]))[0].n, 1);
  });

  it('un dataset recibe un solo aviso por vencimiento', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await ejecutar('2026-11-02');
    await ejecutar('2026-11-02');
    await ejecutar('2026-11-03');
    assert.equal((await notas()).length, 1);
    assert.equal((await mailpit.mensajes()).length, 1);
  });

  it('el aviso sale cuando se abre el mes y lleva todos los datasets de la gestión que vencen ese mes', async () => {
    const del30 = await crearDataset({ gestion: 'externa', vencimiento: '2027-01-30' });
    const del31 = await crearDataset({ gestion: 'externa', vencimiento: '2027-01-31' });
    await ejecutar('2026-12-18');
    assert.equal((await notas()).length, 0);

    await ejecutar('2026-12-21');
    const [nota, ...otras] = await notas();
    assert.deepEqual([nota.tipo, nota.gestion, otras.length], ['aviso', 'externa', 0]);
    const filas = await query('SELECT dataset_id FROM notas_digitales_datasets WHERE nota_id = ? ORDER BY dataset_id', [nota.id]);
    assert.deepEqual(filas.map(f => f.dataset_id), [del30, del31].sort((a, b) => a - b));
    assert.equal((await mailpit.mensajes()).length, 1);
  });

  it('si cambia el vencimiento recibe un aviso nuevo con el número siguiente', async () => {
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    await ejecutar('2026-11-02');
    await query('UPDATE datasets SET proxima_actualizacion = ? WHERE id = ?', ['2026-12-15', id]);
    await ejecutar('2026-11-03');
    assert.deepEqual((await notas()).map(n => [n.tipo, n.numero]), [['aviso', 1], ['aviso', 2]]);
  });
});

describe('reiteraciones', () => {
  it('el primer día hábil reitera los avisados hace 20 días o más', async () => {
    await crearDataset({ titulo: 'Avisado temprano', vencimiento: '2026-12-31' });
    await ejecutar('2026-11-02');
    await crearDataset({ titulo: 'Avisado tarde', vencimiento: '2027-01-19' });
    await ejecutar('2026-11-20');
    await mailpit.vaciar();

    await ejecutar('2026-12-01');
    const [mensaje] = await mailpit.mensajes();
    assert.match(mensaje.Subject, /^Nota Digital N° 3\/26 – Ref\.: Reiteración – /);
    const html = await mailpit.html(mensaje.ID);
    assert.ok(html.includes('Avisado temprano'));
    assert.ok(!html.includes('Avisado tarde'));
    assert.ok(html.includes('Nota Digital N° 1/26 (02/11/2026)'));
  });

  it('los avisos del 13/10/2026 se reiteran el 02/11/2026 (20 días); los del 14/10/2026, no', async () => {
    await crearDataset({ titulo: 'Avisado el 13', vencimiento: '2026-12-12' });
    // Externa a 40 días: el 23/11 se avisa el 14/10
    await crearDataset({ titulo: 'Avisado el 14', gestion: 'externa', vencimiento: '2026-11-23' });
    await ejecutar('2026-10-13');
    await ejecutar('2026-10-14');
    assert.deepEqual((await notas()).map(n => [n.tipo, n.gestion]), [['aviso', 'interna'], ['aviso', 'externa']]);
    await mailpit.vaciar();

    await ejecutar('2026-11-02');
    assert.deepEqual((await notas()).map(n => [n.tipo, n.gestion]), [['aviso', 'interna'], ['aviso', 'externa'], ['reiteracion', 'interna']]);
    const [mensaje] = await mailpit.mensajes();
    const html = await mailpit.html(mensaje.ID);
    assert.ok(html.includes('Avisado el 13'));
    assert.ok(html.includes('Nota Digital N° 1/26 (13/10/2026)'));
  });

  it('un avisado con antecedente de emails anteriores lo lleva en "Informado en" (HTML, texto y PDF), sin fila a todo el ancho', async () => {
    const id = await crearDataset({ titulo: 'Avisado con antecedente', gestion: 'externa', vencimiento: '2026-11-12', ultima: '2025-11-12' });
    await crearEmailViejo({ tipo: 'externo-40', datasetIds: [id], enviado: '2026-01-05 08:00:00' });
    await crearEmailViejo({ tipo: 'externo-5', datasetIds: [id], enviado: '2026-10-01 08:00:00' });
    await ejecutar('2026-10-13');
    await mailpit.vaciar();

    await ejecutar('2026-11-02');
    const reiteracion = (await notas()).find(n => n.tipo === 'reiteracion');
    assert.ok(reiteracion);
    const segunda = 'Anteriormente notificado DGMIT por e-mail en 2 oportunidades, entre el 05/01/2026 y el 01/10/2026';
    assert.ok(reiteracion.html.includes(`>Nota Digital N° 1/26 (13/10/2026).<br><span style="font-size:11px">${segunda}</span></td>`), reiteracion.html);
    assert.ok(!reiteracion.html.includes('Antecedente:'));
    const [{ texto, pdf }] = await query('SELECT texto, pdf FROM notas_digitales WHERE id = ?', [reiteracion.id]);
    assert.ok(texto.includes(`    Informado en: Nota Digital N° 1/26 (13/10/2026). ${segunda}\n`), texto);
    const lineas = textosPorHoja(pdf).flat();
    assert.equal(lineas.filter(t => t.tamano === 7).map(t => t.texto).join(' '), segunda);
    assert.ok(!lineas.some(t => t.texto.startsWith('Antecedente:')));
  });

  it('se evalúa una sola vez por mes y la primera de enero es N° 1 del año nuevo', async () => {
    await crearDataset({ titulo: 'Avisado temprano', vencimiento: '2026-12-31' });
    await ejecutar('2026-11-02');
    await crearDataset({ titulo: 'Avisado tarde', vencimiento: '2027-01-19' });
    await ejecutar('2026-11-20');
    await ejecutar('2026-12-01');
    await ejecutar('2026-12-02');
    await ejecutar('2026-12-11');
    assert.equal((await notas()).filter(n => n.tipo === 'reiteracion').length, 1);

    await mailpit.vaciar();
    await ejecutar('2027-01-04');
    const [mensaje] = await mailpit.mensajes();
    assert.match(mensaje.Subject, /^Nota Digital N° 1\/27 – Ref\.: Reiteración – /);
    const html = await mailpit.html(mensaje.ID);
    assert.ok(html.includes('Avisado tarde'));
    assert.ok(html.includes('Nota Digital N° 1/26 (02/11/2026) – reiterado 1 vez'));
  });

  it('si el primer día hábil no hubo corrida, la reiteración sale en la siguiente', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await ejecutar('2026-11-02');
    await ejecutar('2026-12-02');
    assert.deepEqual((await notas()).map(n => n.tipo), ['aviso', 'reiteracion']);
  });

  it('un mes sin datasets para reiterar queda evaluado: no se reitera más tarde en ese mismo mes', async () => {
    await crearDataset({ titulo: 'Avisado tarde', vencimiento: '2027-01-19' });
    await ejecutar('2026-11-20');
    await ejecutar('2026-12-01'); // solo pasaron 11 días: nada para reiterar, pero diciembre queda evaluado
    await ejecutar('2026-12-11'); // ya pasaron más de 20 días, pero diciembre ya fue evaluado
    assert.deepEqual((await notas()).map(n => n.tipo), ['aviso']);

    await ejecutar('2027-01-04');
    assert.deepEqual((await notas()).map(n => [n.tipo, n.numero, n.anio]), [['aviso', 1, 2026], ['reiteracion', 1, 2027]]);
  });

  it('nunca genera dos reiteraciones de la misma gestión en el mismo mes', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await ejecutar('2026-11-02');
    await ejecutar('2026-12-01');
    await query('UPDATE notas_digitales_config SET reiteracion_evaluada_interna = NULL WHERE id = 1');
    await ejecutar('2026-12-02');
    assert.equal((await notas()).filter(n => n.tipo === 'reiteracion').length, 1);
  });
});

describe('vencidos sin aviso (14/10/2026)', () => {
  it('no salen en ningún aviso y sí en la reiteración del primer día hábil del mes siguiente, como "Sin aviso previo"', async () => {
    await ejecutar('2026-10-01'); // octubre queda evaluado sin nada para reiterar
    const id = await crearDataset({ titulo: 'Cargado vencido', gestion: 'externa', vencimiento: '2026-09-30', ultima: '2025-09-30' });
    await crearEmailViejo({ tipo: 'externo-vencido', datasetIds: [id], enviado: '2026-01-01 08:00:00' });
    await crearEmailViejo({ tipo: 'externo-vencido', datasetIds: [id], enviado: '2026-10-01 08:00:00' });
    await mailpit.vaciar();

    await ejecutar('2026-10-14');
    assert.deepEqual(await notas(), []);
    assert.equal((await mailpit.mensajes()).length, 0);

    const resumen = await ejecutar('2026-11-02');
    assert.deepEqual((await notas()).map(n => [n.tipo, n.gestion, n.estado]), [['reiteracion', 'externa', 'enviada']]);
    assert.equal(resumen.enviadas, 1);
    const [mensaje] = await mailpit.mensajes();
    assert.match(mensaje.Subject, /Reiteración – /);
    const html = await mailpit.html(mensaje.ID);
    assert.ok(html.includes('Cargado vencido'));
    assert.ok(html.includes('Plazo de actualización vencido'));
    // El antecedente va en la celda "Informado en", en letra más chica (spec 6.4)
    assert.ok(html.includes('>Sin aviso previo.<br><span style="font-size:11px">Anteriormente notificado DGMIT por e-mail en 2 oportunidades, entre el 01/01/2026 y el 01/10/2026</span></td>'), html);
    assert.ok(!html.includes('Antecedente:'));
    const [fila] = await query('SELECT seccion, DATE_FORMAT(vencimiento, "%Y-%m-%d") AS vencimiento FROM notas_digitales_datasets WHERE dataset_id = ?', [id]);
    assert.deepEqual(fila, { seccion: 'vencido', vencimiento: '2026-09-30' });
  });

  it('se reiteran todos los meses con "Sin aviso previo – reiterado N veces", hasta que se actualiza', async () => {
    await ejecutar('2026-10-01');
    const id = await crearDataset({ gestion: 'interna', vencimiento: '2026-09-30' });
    await ejecutar('2026-11-02');
    await mailpit.vaciar();
    await ejecutar('2026-12-01');
    const [mensaje] = await mailpit.mensajes();
    const html = await mailpit.html(mensaje.ID);
    assert.ok(html.includes('Sin aviso previo – reiterado 1 vez'));
    assert.deepEqual((await notas()).map(n => n.tipo), ['reiteracion', 'reiteracion']);

    await query('UPDATE datasets SET proxima_actualizacion = ? WHERE id = ?', ['2027-10-31', id]);
    await mailpit.vaciar();
    await ejecutar('2027-01-04');
    assert.deepEqual((await notas()).map(n => n.tipo), ['reiteracion', 'reiteracion']);
    assert.equal((await mailpit.mensajes()).length, 0);
  });

  it('el estado cuenta el vencido sin aviso en la próxima reiteración y no en el próximo aviso', async () => {
    await ejecutar('2026-10-01'); // octubre ya evaluado: la próxima reiteración es la de noviembre
    await crearDataset({ gestion: 'externa', vencimiento: '2026-09-30' });
    const { proximas } = await motor.estadoNotas({ hoy: '2026-10-14' });
    assert.equal(proximas.externa.aviso, null);
    assert.deepEqual(proximas.externa.reiteracion, { fecha: '2026-11-02', cantidad: 1 });

    // Con uno a vencer, el aviso cuenta solo ese
    await crearDataset({ gestion: 'externa', vencimiento: '2026-12-31' });
    const despues = await motor.estadoNotas({ hoy: '2026-10-14' });
    // 31/12 - 40 días = sábado 21/11: el aviso sale el lunes 23/11
    assert.deepEqual(despues.proximas.externa.aviso, { fecha: '2026-11-23', cantidad: 1 });
    assert.deepEqual(despues.proximas.externa.reiteracion, { fecha: '2026-11-02', cantidad: 1 });
  });
});

describe('fallas, reintentos y concurrencia', () => {
  it('un envío fallido se reintenta con el mismo número y contenido', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    process.env.EMAIL_SOLO_A = 'nadie@rpad.test';
    await ejecutar('2026-11-02');
    const [fallida] = await notas();
    assert.equal(fallida.estado, 'fallida');
    assert.equal(fallida.intentos, 1);

    process.env.EMAIL_SOLO_A = '';
    await ejecutar('2026-11-03');
    const todas = await notas();
    assert.equal(todas.length, 1);
    assert.equal(todas[0].estado, 'enviada');
    assert.equal(todas[0].asunto, fallida.asunto);
    assert.equal(todas[0].html, fallida.html);
  });

  it('el PDF lleva el membrete configurado al generar la nota y el reintento reenvía ese mismo PDF', async () => {
    await configurarNotas({ membrete_imagen: BANNER, membrete_mime: 'image/png', membrete_pie: 'Pie del membrete de prueba' });
    await crearDataset({ vencimiento: '2026-12-31' });
    process.env.EMAIL_SOLO_A = 'nadie@rpad.test';
    await ejecutar('2026-11-02');
    const [{ id, pdf, estado }] = await query('SELECT id, pdf, estado FROM notas_digitales');
    assert.equal(estado, 'fallida');
    const textos = textosPorHoja(pdf);
    const imagenes = imagenesPorHoja(pdf);
    textos.forEach((lineas, i) => {
      assert.equal(lineas.filter(t => t.texto === 'Pie del membrete de prueba').length, 1, `hoja ${i + 1}`);
      assert.equal(imagenes[i].filter(imagen => Math.abs(imagen.y) < 0.01 && Math.abs(imagen.x) < 0.01).length, 1, `hoja ${i + 1}: falta el banner`);
    });

    // Cambia el membrete: el reintento manda el PDF congelado al generar la nota
    await configurarNotas({ membrete_imagen: null, membrete_mime: null, membrete_pie: 'Otro pie' });
    process.env.EMAIL_SOLO_A = '';
    await ejecutar('2026-11-03');
    const [despues] = await query('SELECT estado, pdf FROM notas_digitales WHERE id = ?', [id]);
    assert.equal(despues.estado, 'enviada');
    assert.deepEqual(despues.pdf, pdf);
  });

  it('después de 5 intentos no reintenta solo, pero se puede reintentar a mano', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    process.env.EMAIL_SOLO_A = 'nadie@rpad.test';
    await ejecutar('2026-11-02');
    const [nota] = await notas();
    await query('UPDATE notas_digitales SET intentos = 5 WHERE id = ?', [nota.id]);
    process.env.EMAIL_SOLO_A = '';
    await ejecutar('2026-11-03');
    assert.equal((await notas())[0].estado, 'fallida');

    const resultado = await motor.enviarNota(nota.id);
    assert.equal(resultado.success, true);
    assert.equal((await notas())[0].estado, 'enviada');
  });

  it('dos corridas simultáneas no duplican notas', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await Promise.all([ejecutar('2026-11-02'), ejecutar('2026-11-02')]);
    assert.equal((await notas()).length, 1);
    assert.equal((await mailpit.mensajes()).length, 1);
  });

  it('una corrida con el bloqueo ocupado no hace nada', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    const liberar = await tomarBloqueoAjeno();
    try {
      const resumen = await ejecutar('2026-11-02');
      assert.equal(resumen.motivo, 'Otra corrida en curso');
      assert.equal(resumen.ejecutado, false);
      assert.equal((await notas()).length, 0);
      // La corrida que tiene el bloqueo es la que registra: esta no escribe nada
      assert.equal((await ultimaCorrida()).inicio, null);
    } finally {
      await liberar();
    }
    assert.equal((await ejecutar('2026-11-02')).enviadas, 1);
  });

  it('el reintento manual no envía mientras otra corrida tiene el bloqueo y después envía una sola vez', async () => {
    const id = await crearNotaFallida();
    const liberar = await tomarBloqueoAjeno();
    try {
      const resultado = await motor.reintentarNota(id);
      assert.equal(resultado.success, false);
      assert.equal(resultado.enCurso, true);
      assert.match(resultado.error, /corrida de Notas Digitales en curso/);
      const [nota] = await notas();
      assert.equal(nota.estado, 'fallida');
      assert.equal(nota.intentos, 1);
      assert.equal((await mailpit.mensajes()).length, 0);
    } finally {
      await liberar();
    }

    const reenviada = await motor.reintentarNota(id);
    assert.equal(reenviada.success, true);
    assert.equal((await notas())[0].estado, 'enviada');
    assert.equal((await mailpit.mensajes()).length, 1);
  });

  it('dos reintentos manuales simultáneos de la misma nota envían un solo email', async () => {
    const id = await crearNotaFallida();
    const resultados = await Promise.all([motor.reintentarNota(id), motor.reintentarNota(id)]);
    assert.ok(resultados.some(r => r.success));
    assert.equal((await mailpit.mensajes()).length, 1);
    const [nota] = await notas();
    assert.equal(nota.estado, 'enviada');
    assert.equal(nota.intentos, 2);
  });

  it('un reintento manual que falla no deja el bloqueo tomado', async () => {
    await assert.rejects(motor.reintentarNota(999999), motor.ErrorDeUso);
    const [{ libre }] = await query('SELECT IS_FREE_LOCK(?) AS libre', [BLOQUEO]);
    assert.equal(Number(libre), 1);
  });
});

describe('registro de la corrida y aislamiento de fallas', () => {
  it('registra cada corrida con su fecha, inicio, fin y resultado, también cuando sale sin hacer nada', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await ejecutar('2026-11-01');
    const feriado = await ultimaCorrida();
    assert.equal(feriado.fecha, '2026-11-01');
    assert.match(feriado.inicio, FECHA_HORA);
    assert.match(feriado.fin, FECHA_HORA);
    assert.equal(feriado.resultado, 'Día no hábil');
    assert.equal(feriado.con_errores, 0);

    await configurarNotas({ envio_activo: 0 });
    await ejecutar('2026-11-02');
    assert.equal((await ultimaCorrida()).resultado, 'Envío automático desactivado');

    await configurarNotas({ firma_nombre: '' });
    await ejecutar('2026-11-02');
    assert.equal((await ultimaCorrida()).resultado, 'Configuración incompleta: nombre de la firma');

    await configurarNotas();
    await ejecutar('2026-11-02');
    const corrida = await ultimaCorrida();
    assert.equal(corrida.fecha, '2026-11-02');
    assert.equal(corrida.resultado, '1 enviada(s), 0 fallida(s)');
    assert.equal(corrida.con_errores, 0);
    assert.ok(corrida.fin >= corrida.inicio);
  });

  it('si falla el aviso interno igual salen el aviso externo y la reiteración, y el error queda registrado', async () => {
    const avisado = await crearDataset({ titulo: 'Avisado en octubre', vencimiento: '2026-11-30' });
    await crearNota({ fecha: '2026-10-01', numero: 1, datasets: [{ id: avisado, vencimiento: '2026-11-30' }] });
    await crearDataset({ titulo: 'Interno nuevo', vencimiento: '2026-12-31' });
    await crearDataset({ titulo: 'Externo nuevo', gestion: 'externa', vencimiento: '2026-11-30' });

    const resumen = await conFallaSimulada('INSERT', "NEW.tipo = 'aviso' AND NEW.gestion = 'interna'", () => ejecutar('2026-11-02'));
    assert.deepEqual(resumen.errores.map(e => [e.tipo, e.gestion]), [['aviso', 'interna']]);
    assert.match(resumen.errores[0].mensaje, /Falla simulada/);
    assert.equal(resumen.enviadas, 2);
    assert.deepEqual((await notas()).map(n => [n.tipo, n.gestion, n.estado]),
      [['aviso', 'interna', 'enviada'], ['aviso', 'externa', 'enviada'], ['reiteracion', 'interna', 'enviada']]);
    assert.equal((await mailpit.mensajes()).length, 2);

    const corrida = await ultimaCorrida();
    assert.equal(corrida.con_errores, 1);
    assert.match(corrida.resultado, /^2 enviada\(s\), 0 fallida\(s\)\. 1 error\(es\): aviso interna: .*Falla simulada/);
    assert.match(corrida.fin, FECHA_HORA);
  });

  it('si falla la generación de una reiteración el mes no queda evaluado y sale en la corrida siguiente', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await ejecutar('2026-11-02');

    const resumen = await conFallaSimulada('INSERT', "NEW.tipo = 'reiteracion'", () => ejecutar('2026-12-01'));
    assert.deepEqual(resumen.errores.map(e => [e.tipo, e.gestion]), [['reiteracion', 'interna']]);
    const [marcas] = await query('SELECT reiteracion_evaluada_interna AS interna, reiteracion_evaluada_externa AS externa FROM notas_digitales_config WHERE id = 1');
    assert.deepEqual(marcas, { interna: '2026-11', externa: '2026-12' });

    await ejecutar('2026-12-02');
    assert.deepEqual((await notas()).map(n => [n.tipo, n.estado]), [['aviso', 'enviada'], ['reiteracion', 'enviada']]);
    assert.equal((await ultimaCorrida()).con_errores, 0);
  });

  it('un reintento que lanza una excepción no corta la corrida', async () => {
    const id = await crearNotaFallida();
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-30' });

    const resumen = await conFallaSimulada('UPDATE', `OLD.id = ${Number(id)}`, () => ejecutar('2026-11-03'));
    assert.deepEqual(resumen.errores.map(e => [e.tipo, e.id]), [['reintento', id]]);
    assert.equal(resumen.enviadas, 1);
    assert.deepEqual((await notas()).map(n => [n.tipo, n.gestion, n.estado]), [['aviso', 'interna', 'fallida'], ['aviso', 'externa', 'enviada']]);
  });

  it('un banner del membrete dañado ya guardado deja el error registrado en cada gestión y no tumba el proceso', async () => {
    await configurarNotas({ membrete_imagen: pngsDanados()['IDAT truncado'], membrete_mime: 'image/png' });
    await crearDataset({ vencimiento: '2026-12-31' });
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-30' });

    const resumen = await ejecutar('2026-11-02');
    assert.deepEqual(resumen.errores.map(e => [e.tipo, e.gestion]), [['aviso', 'interna'], ['aviso', 'externa']]);
    assert.match(resumen.errores[0].mensaje, /imagen del membrete/);
    assert.equal((await notas()).length, 0);
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.match((await ultimaCorrida()).resultado, /imagen del membrete/);
  });

  it('una firma dañada ya guardada deja el error registrado en cada gestión y no tumba el proceso', async () => {
    await configurarNotas({ firma_imagen: pngsDanados()['IDAT con la cabecera zlib rota'], firma_mime: 'image/png' });
    await crearDataset({ vencimiento: '2026-12-31' });
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-30' });

    const resumen = await ejecutar('2026-11-02');
    assert.deepEqual(resumen.errores.map(e => [e.tipo, e.gestion]), [['aviso', 'interna'], ['aviso', 'externa']]);
    assert.match(resumen.errores[0].mensaje, /imagen de la firma/);
    assert.equal((await notas()).length, 0);
    // La descompresión de png-js es asíncrona: si la imagen hubiera llegado a PDFKit, el error aparecería ahora
    await new Promise(resolve => setTimeout(resolve, 300));
    const corrida = await ultimaCorrida();
    assert.equal(corrida.con_errores, 1);
    assert.match(corrida.resultado, /imagen de la firma/);
  });
});

describe('estado: última corrida y alertas', () => {
  const tipos = async (hoy) => (await motor.estadoNotas({ hoy })).alertas.map(a => a.tipo);
  const corrida = (fecha, cambios = {}) => configurarNotas({
    ultima_corrida_fecha: fecha, ultima_corrida_inicio: `${fecha} 08:00:00`, ultima_corrida_fin: `${fecha} 08:00:05`,
    ultima_corrida_resultado: '0 enviada(s), 0 fallida(s)', ultima_corrida_con_errores: 0, ...cambios
  });

  it('devuelve la última corrida', async () => {
    assert.equal((await motor.estadoNotas({ hoy: '2026-11-02' })).ultima_corrida, null);
    await ejecutar('2026-11-02');
    const { ultima_corrida: ultima } = await motor.estadoNotas({ hoy: '2026-11-02' });
    assert.equal(ultima.fecha, '2026-11-02');
    assert.match(ultima.inicio, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    assert.match(ultima.fin, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    assert.equal(ultima.resultado, '0 enviada(s), 0 fallida(s)');
    assert.equal(ultima.con_errores, false);
    assert.equal(ultima.en_curso, false);
  });

  it('avisa si la última corrida terminó con errores, con su resultado', async () => {
    await corrida('2026-11-02', { ultima_corrida_con_errores: 1, ultima_corrida_resultado: '0 enviada(s), 0 fallida(s). 1 error(es): aviso interna: algo' });
    const { alertas } = await motor.estadoNotas({ hoy: '2026-11-03' });
    const alerta = alertas.find(a => a.tipo === 'corrida-con-errores');
    assert.equal(alerta.nivel, 'error');
    assert.match(alerta.mensaje, /02\/11\/2026.*aviso interna: algo/);
  });

  it('avisa si la última corrida empezó y no terminó, salvo que siga en curso', async () => {
    await corrida('2026-11-02', { ultima_corrida_fin: null, ultima_corrida_resultado: null });
    assert.ok((await tipos('2026-11-03')).includes('corrida-interrumpida'));

    const liberar = await tomarBloqueoAjeno();
    try {
      const estado = await motor.estadoNotas({ hoy: '2026-11-03' });
      assert.ok(!estado.alertas.some(a => a.tipo === 'corrida-interrumpida'));
      assert.equal(estado.ultima_corrida.en_curso, true);
    } finally {
      await liberar();
    }
  });

  it('con el envío activado avisa si no hubo corrida en el último día hábil anterior a hoy', async () => {
    assert.ok((await tipos('2026-11-03')).includes('sin-corrida'), 'nunca hubo corrida');

    await corrida('2026-11-02');
    assert.ok(!(await tipos('2026-11-03')).includes('sin-corrida'), 'corrió el lunes y hoy es martes');
    assert.ok(!(await tipos('2026-11-02')).includes('sin-corrida'), 'corrió hoy');

    await corrida('2026-10-30');
    assert.ok(!(await tipos('2026-11-02')).includes('sin-corrida'), 'corrió el viernes y hoy es lunes');
    assert.ok((await tipos('2026-11-03')).includes('sin-corrida'), 'no corrió el lunes');

    await corrida('2026-10-31');
    assert.ok(!(await tipos('2026-11-02')).includes('sin-corrida'), 'corrió el sábado (día no hábil)');

    await configurarNotas({ envio_activo: 0 });
    assert.ok(!(await tipos('2026-12-15')).includes('sin-corrida'), 'con el envío desactivado no se espera corrida');
  });

  it('advierte, sin bloquear el envío, si no hay imagen de la firma', async () => {
    const estado = await motor.estadoNotas({ hoy: '2026-11-02' });
    assert.deepEqual(estado.alertas.find(a => a.tipo === 'sin-firma'),
      { tipo: 'sin-firma', nivel: 'advertencia', mensaje: 'No hay imagen de la firma: las notas saldrían sin la firma escaneada.' });
    assert.deepEqual(estado.configuracion_faltante, []);

    await configurarNotas({ firma_imagen: pngRgba(), firma_mime: 'image/png' });
    assert.ok(!(await tipos('2026-11-02')).includes('sin-firma'));
  });

  it('advierte, sin bloquear el envío, si no hay imagen del membrete', async () => {
    const estado = await motor.estadoNotas({ hoy: '2026-11-02' });
    assert.deepEqual(estado.alertas.find(a => a.tipo === 'sin-membrete'), {
      tipo: 'sin-membrete', nivel: 'advertencia',
      mensaje: 'No hay imagen del membrete: las notas saldrían sin el encabezado institucional.'
    });
    assert.deepEqual(estado.configuracion_faltante, []);

    await configurarNotas({ membrete_imagen: BANNER, membrete_mime: 'image/png' });
    assert.ok(!(await tipos('2026-11-02')).includes('sin-membrete'));
  });
});

describe('pruebas, vista previa y estado', () => {
  it('una prueba va solo a las casillas de prueba, sin número y sin contar como aviso', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    const resultado = await motor.enviarPrueba({ tipo: 'aviso', gestion: 'interna', hoy: '2026-11-02' });
    assert.equal(resultado.success, true);
    const [mensaje] = await mailpit.mensajes();
    assert.deepEqual(direcciones(mensaje.To), ['prueba@rpad.test']);
    assert.deepEqual(direcciones(mensaje.Cc), []);
    assert.match(mensaje.Subject, /^\[PRUEBA\] Nota Digital N° PRUEBA – /);
    assert.equal((await query('SELECT COUNT(*) AS n FROM notas_digitales_datasets'))[0].n, 0);

    await ejecutar('2026-11-02');
    const reales = (await notas()).filter(n => n.numero !== null);
    assert.deepEqual(reales.map(n => n.numero), [1]);
  });

  it('sin casillas de prueba la prueba se rechaza', async () => {
    await configurarNotas({ casillas_prueba: '' });
    await assert.rejects(motor.enviarPrueba({ tipo: 'aviso', gestion: 'interna', hoy: '2026-11-02' }), motor.ErrorDeUso);
  });

  it('la vista previa sin datos usa ejemplos y no escribe nada', async () => {
    const vista = await motor.previewNota({ tipo: 'reiteracion', gestion: 'externa', hoy: '2026-11-02' });
    assert.equal(vista.ejemplo, true);
    assert.ok(vista.html.includes('Nota Digital N°</b> XX'));
    assert.equal((await notas()).length, 0);
  });

  it('la vista previa del aviso sin datos reales usa un solo ejemplo, a vencer, con su antecedente y sin sección de vencidos', async () => {
    const vista = await motor.previewNota({ tipo: 'aviso', gestion: 'interna', hoy: '2026-11-02' });
    assert.equal(vista.ejemplo, true);
    assert.ok(vista.html.includes('Dataset de ejemplo próximo a vencer'));
    assert.ok(vista.html.includes('Próximos a vencer'));
    assert.ok(!vista.html.includes('Plazo de actualización vencido'));
    assert.ok(!vista.html.includes('Dataset de ejemplo vencido'));
    assert.ok(vista.html.includes('Anexo: reporte de los conjuntos de datos (1 hoja).'));
    assert.ok(vista.html.includes('Antecedente: notificado a la DGMIT por correo electrónico en 3 oportunidades'));
  });

  it('la vista previa de la reiteración sin datos reales conserva el ejemplo a vencer y el vencido, ambos con su aviso', async () => {
    const vista = await motor.previewNota({ tipo: 'reiteracion', gestion: 'interna', hoy: '2026-11-02' });
    assert.equal(vista.ejemplo, true);
    assert.ok(vista.html.includes('Dataset de ejemplo próximo a vencer'));
    assert.ok(vista.html.includes('Dataset de ejemplo vencido'));
    assert.ok(vista.html.includes('Plazo de actualización vencido'));
    assert.ok(!vista.html.includes('Sin aviso previo'));
    // El a vencer muestra cómo sale el antecedente de los emails anteriores en una reiteración
    assert.ok(vista.html.includes('<br><span style="font-size:11px">Anteriormente notificado DGMIT por e-mail en 3 oportunidades, entre el 04/08/2026 y el 03/10/2026</span>'), vista.html);
    // Los dos vencen a fin de mes (spec 2026-10-17-fechas-datasets, 9): el a vencer el 31/12 y el vencido el fin del mes pasado
    assert.ok(vista.html.includes('31/12/2026'), vista.html);
    assert.ok(vista.html.includes('31/10/2026'), vista.html);
  });

  it('los ejemplos vencen a fin de mes y traen Datos al, el tipo de pedido y el pedido del día (spec 2026-10-17-fechas-datasets, 9)', () => {
    for (const hoy of ['2026-11-01', '2026-11-02', '2026-11-30', '2027-01-29', '2027-12-31', '2028-02-28', '2028-02-29']) {
      for (const gestion of ['interna', 'externa']) {
        const { datasets: [proximo, vencido] } = motor.ejemplo('reiteracion', gestion, hoy);
        const { datasets: [delAviso], fichas: [ficha] } = motor.ejemplo('aviso', gestion, hoy);
        for (const d of [proximo, vencido, delAviso, ficha]) {
          assert.ok(esFinDeMes(d.vencimiento) && esFinDeMes(d.datos_al), `${hoy} ${gestion}: ${d.vencimiento} ${d.datos_al}`);
          // Se cargó en el portal después de la fecha de sus datos
          assert.ok(d.datos_al <= d.ultima_actualizacion, `${hoy} ${gestion}: ${d.datos_al} ${d.ultima_actualizacion}`);
          assert.equal(d.tipo_pedido, gestion === 'externa' ? 'acumulado' : 'relevamiento');
          assert.ok(d.pedido?.texto, `${hoy} ${gestion}`);
        }
        assert.ok(proximo.vencimiento > hoy && vencido.vencimiento < hoy, `${hoy}: ${proximo.vencimiento} ${vencido.vencimiento}`);
        assert.deepEqual(ficha, delAviso);
      }
    }
    // El 02/11/2026 el fin del mes de los 30 días (31/12) queda a 59 días, fuera de la ventana externa de 40: el externo
    // vence a fin de este mes (spec 2026-10-17-fechas-datasets, 9; revisión de la Task 11)
    const externa = motor.ejemplo('reiteracion', 'externa', '2026-11-02').datasets;
    assert.deepEqual(externa.map(d => [d.vencimiento, d.meses, d.datos_al, d.pedido]), [
      ['2026-11-30', 12, '2025-10-31', { desde: '2025-11-01', hasta: '2026-10-31', texto: 'Del 01/11/2025 al 31/10/2026' }],
      ['2026-10-31', 12, '2025-09-30', { desde: '2025-10-01', hasta: '2026-09-30', texto: 'Del 01/10/2025 al 30/09/2026' }]
    ]);
    assert.deepEqual(motor.ejemplo('aviso', 'interna', '2026-11-02').fichas[0].pedido,
      { desde: null, hasta: null, texto: 'Relevamiento actualizado' });
    // El interno sigue con el fin del mes de los 30 días: está dentro de su ventana de 60
    assert.equal(motor.ejemplo('aviso', 'interna', '2026-11-02').datasets[0].vencimiento, '2026-12-31');
    assert.equal(motor.ejemplo('aviso', 'externa', '2026-11-21').datasets[0].vencimiento, '2026-12-31');
    assert.equal(motor.ejemplo('aviso', 'externa', '2026-11-20').datasets[0].vencimiento, '2026-11-30');
  });

  // Spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.5: los ejemplos externos traen «Requiere nota DGMIT», uno en Sí y otro
  // en No; los internos, sin el dato
  it('los ejemplos externos traen requiere_nota: el a vencer en Sí (1) y el vencido en No (0); los internos, null', async () => {
    const [proximo, vencido] = motor.ejemplo('reiteracion', 'externa', '2026-11-02').datasets;
    assert.equal(proximo.requiere_nota, 1);
    assert.equal(vencido.requiere_nota, 0);
    assert.equal(motor.ejemplo('aviso', 'externa', '2026-11-02').datasets[0].requiere_nota, 1);
    for (const tipo of ['aviso', 'reiteracion']) {
      assert.ok(motor.ejemplo(tipo, 'interna', '2026-11-02').datasets.every(d => d.requiere_nota === null), tipo);
    }
    // En la vista previa de la reiteración externa de ejemplo, la columna con los dos valores
    const vista = await motor.previewNota({ tipo: 'reiteracion', gestion: 'externa', hoy: '2026-11-02' });
    assert.equal(vista.ejemplo, true);
    assert.ok(vista.html.includes('>Requiere nota DGMIT</th>'));
    assert.ok(vista.html.includes('>Sí</td>') && vista.html.includes('>No</td>'), vista.html);
  });

  it('el ejemplo a vencer cae en la ventana del aviso de su gestión (40 días la externa, 60 la interna), a fin de mes', () => {
    const VENTANA = { externa: 40, interna: 60 };
    const diasHasta = (hoy, fecha) => (Date.parse(fecha) - Date.parse(hoy)) / 86400000;
    const casos = { regla: { interna: 0, externa: 0 }, anterior: { interna: 0, externa: 0 } };
    for (let hoy = '2026-01-01'; hoy <= '2028-12-31'; hoy = sumarDias(hoy, 1)) {
      for (const gestion of ['interna', 'externa']) {
        const { datasets: [proximo] } = motor.ejemplo('aviso', gestion, hoy);
        const dias = diasHasta(hoy, proximo.vencimiento);
        assert.ok(esFinDeMes(proximo.vencimiento), `${hoy} ${gestion}: ${proximo.vencimiento}`);
        assert.ok(dias > 0 && dias <= VENTANA[gestion], `${hoy} ${gestion}: vence ${proximo.vencimiento}, a ${dias} días`);
        // El fin del mes en que caen los 30 días, si entra en la ventana; si no, el fin del mes anterior a ese (casi siempre,
        // el de este mes; el 31/01, el 28/02: los 30 días caen en marzo)
        const regla = vencimientoDelMes(sumarDias(hoy, 30));
        const caso = diasHasta(hoy, regla) <= VENTANA[gestion] ? 'regla' : 'anterior';
        assert.equal(proximo.vencimiento, caso === 'regla' ? regla : sumarMeses(regla, -1), `${hoy} ${gestion}`);
        casos[caso][gestion]++;
        // El mismo dataset en el ejemplo de la reiteración
        assert.equal(motor.ejemplo('reiteracion', gestion, hoy).datasets[0].vencimiento, proximo.vencimiento);
      }
    }
    // La interna siempre entra con la regla; la externa usa las dos
    assert.equal(casos.anterior.interna, 0);
    assert.ok(casos.regla.externa > 100 && casos.anterior.externa > 100, JSON.stringify(casos));
    assert.equal(motor.ejemplo('aviso', 'externa', '2027-01-31').datasets[0].vencimiento, '2027-02-28');
  });

  // Spec 2026-10-17-fechas-datasets, 9 y 18: la vista previa muestra la columna con el pedido de los ejemplos, y el aviso ya no
  // lleva la fecha sugerida de envío
  it('la vista previa muestra "Datos solicitados" y no "Fecha sugerida de envío"; la frase del período, solo en el aviso externo', async () => {
    const FRASE = 'con los datos del período que se indica en cada caso';
    const externo = await motor.previewNota({ tipo: 'aviso', gestion: 'externa', hoy: '2026-11-02' });
    for (const texto of ['>Datos solicitados</th>', '>Del 01/11/2025 al 31/10/2026</td>', `${FRASE}.`]) {
      assert.ok(externo.html.includes(texto), texto);
    }
    assert.ok(!externo.html.includes('Última actualización') && !externo.html.includes('>Situación</th>'));
    assert.ok(!externo.html.includes('Fecha sugerida de envío') && !externo.html.includes('>30/11/2026</td>'), externo.html);
    const interno = await motor.previewNota({ tipo: 'aviso', gestion: 'interna', hoy: '2026-11-02' });
    assert.ok(interno.html.includes('>Relevamiento actualizado</td>'), interno.html);
    assert.ok(!interno.html.includes('Fecha sugerida de envío') && !interno.html.includes('>31/12/2026</td>'), interno.html);
    assert.ok(!interno.html.includes(FRASE));
    const reiteracion = await motor.previewNota({ tipo: 'reiteracion', gestion: 'externa', hoy: '2026-11-02' });
    // (la externa no tiene columna "Situación": va debajo de la fecha, spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.5)
    for (const texto of ['>Datos solicitados</th>', '>Requiere nota DGMIT</th>', '>Informado en</th>', '>Del 01/10/2025 al 30/09/2026</td>', '>31/10/2026<br>Vencido hace 2 días</td>']) {
      assert.ok(reiteracion.html.includes(texto), texto);
    }
    assert.ok(!reiteracion.html.includes('>Situación</th>'));
    assert.ok(!reiteracion.html.includes(FRASE) && !reiteracion.html.includes('Fecha sugerida de envío'));
  });

  it('la prueba de un aviso sin datos reales tampoco manda vencidos de ejemplo', async () => {
    const resultado = await motor.enviarPrueba({ tipo: 'aviso', gestion: 'externa', hoy: '2026-11-02' });
    assert.equal(resultado.ejemplo, true);
    const [mensaje] = await mailpit.mensajes();
    const html = await mailpit.html(mensaje.ID);
    assert.ok(html.includes('Dataset de ejemplo próximo a vencer'));
    assert.ok(!html.includes('Plazo de actualización vencido'));
  });

  it('el estado informa la configuración, las fallidas y los próximos envíos', async () => {
    await crearDataset({ vencimiento: '2027-01-31' });
    await crearNota({ fecha: '2026-10-01', numero: 9, estado: 'fallida', intentos: 5 });
    const estado = await motor.estadoNotas({ hoy: '2026-11-02' });
    assert.equal(estado.envio_activo, true);
    assert.deepEqual(estado.configuracion_faltante, []);
    assert.equal(estado.fallidas, 1);
    assert.deepEqual(estado.proximas.interna.aviso, { fecha: '2026-12-02', cantidad: 1 });
    assert.deepEqual(estado.proximas.interna.reiteracion, { fecha: '2026-11-02', cantidad: 0 });
    assert.equal(estado.proximas.externa.aviso, null);
  });

  it('un sábado, el próximo aviso no cuenta un dataset que vence ese fin de semana (el lunes ya estaría vencido)', async () => {
    // Sábado 31/10/2026: la próxima corrida es el lunes 02/11, cuando el que vence hoy ya va a la reiteración
    await crearDataset({ gestion: 'externa', vencimiento: '2026-10-31' });
    assert.equal((await motor.estadoNotas({ hoy: '2026-10-31' })).proximas.externa.aviso, null);
    await crearDataset({ gestion: 'externa', vencimiento: '2026-12-31' });
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-10-31' })).proximas.externa.aviso, { fecha: '2026-11-23', cantidad: 1 });
  });

  it('el próximo aviso del estado agrupa los datasets que vencen el mismo mes', async () => {
    await crearDataset({ gestion: 'externa', vencimiento: '2027-01-30' });
    await crearDataset({ gestion: 'externa', vencimiento: '2027-01-31' });
    await crearDataset({ gestion: 'externa', vencimiento: '2027-02-28' });
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-11-02' })).proximas.externa.aviso, { fecha: '2026-12-21', cantidad: 2 });

    // Marzo ya se abrió con el 29/03 (avisado el 28/01): el 31/03 sale en la corrida siguiente
    const avisado = await crearDataset({ vencimiento: '2027-03-29' });
    await crearNota({ fecha: '2027-01-28', numero: 1, datasets: [{ id: avisado, vencimiento: '2027-03-29' }] });
    await crearDataset({ vencimiento: '2027-03-31' });
    assert.deepEqual((await motor.estadoNotas({ hoy: '2027-01-29' })).proximas.interna.aviso, { fecha: '2027-01-29', cantidad: 1 });
  });
});

describe('anexo de los avisos (spec 6.7)', () => {
  const SOLICITA_POR_DEFECTO = 'La versión actualizada del conjunto de datos publicado, con la misma estructura y el mismo nivel de detalle que el archivo disponible en el portal.';
  const anexos = async () => query('SELECT id, tipo, es_prueba, anexo_pdf FROM notas_digitales ORDER BY id');

  it('el aviso de la corrida adjunta la nota y el anexo guardado, con una hoja por dataset en el orden de la tabla', async () => {
    await crearDataset({ titulo: 'Segundo en vencer', gestion: 'externa', vencimiento: '2026-11-30' });
    await crearDataset({ titulo: 'Primero en vencer', gestion: 'externa', vencimiento: '2026-11-20' });
    await ejecutar('2026-11-02');

    const [mensaje] = await mailpit.mensajes();
    const archivos = await adjuntos(mensaje.ID);
    assert.deepEqual(archivos.map(a => a.nombre), ['Nota-Digital-1-26.pdf', 'Anexo-Nota-Digital-1-26.pdf']);
    const [{ pdf, anexo_pdf: anexo }] = await query('SELECT pdf, anexo_pdf FROM notas_digitales');
    assert.deepEqual(archivos[0].contenido, pdf);
    assert.deepEqual(archivos[1].contenido, anexo);
    // La nota sale en hoja oficio y el anexo sigue en A4 (spec 2026-10-24-notas-hoja-oficio)
    assert.ok(tamanosPorHoja(pdf).every(t => esDelTamano(t, HOJA_OFICIO)), JSON.stringify(tamanosPorHoja(pdf)));
    assert.ok(tamanosPorHoja(anexo).every(t => esDelTamano(t, HOJA_A4)), JSON.stringify(tamanosPorHoja(anexo)));

    assert.equal(anexo.subarray(0, 5).toString(), '%PDF-');
    const hojas = lineasPorHoja(anexo);
    assert.equal(hojas.length, 2);
    assert.ok(hojas[0].includes('Primero en vencer'), hojas[0].join(' | '));
    assert.ok(hojas[1].includes('Segundo en vencer'), hojas[1].join(' | '));
    assert.ok(hojas[0].includes('Anexo – Nota Digital N° 1/26 · Hoja 1 de 2'), hojas[0].join(' | '));
    assert.ok(hojas[1].includes('Anexo – Nota Digital N° 1/26 · Hoja 2 de 2'), hojas[1].join(' | '));
  });

  it('el reintento de un aviso fallido reenvía el mismo anexo, aunque el dataset haya cambiado', async () => {
    const id = await crearNotaFallida();
    const [{ anexo_pdf: anexo }] = await query('SELECT anexo_pdf FROM notas_digitales WHERE id = ?', [id]);
    assert.ok(anexo);
    await query("UPDATE datasets SET titulo = 'Título cambiado después de generar la nota', descripcion = 'Otra descripción'");

    await ejecutar('2026-11-03');
    const [mensaje] = await mailpit.mensajes();
    const archivos = await adjuntos(mensaje.ID);
    assert.deepEqual(archivos.map(a => a.nombre), ['Nota-Digital-1-26.pdf', 'Anexo-Nota-Digital-1-26.pdf']);
    assert.deepEqual(archivos[1].contenido, anexo);
    const [despues] = await query('SELECT estado, anexo_pdf FROM notas_digitales WHERE id = ?', [id]);
    assert.equal(despues.estado, 'enviada');
    assert.deepEqual(despues.anexo_pdf, anexo);
  });

  it('la prueba de un aviso adjunta Anexo-Nota-Digital-PRUEBA.pdf con los datasets de hoy', async () => {
    await crearDataset({ titulo: 'Real B', vencimiento: '2026-12-31' });
    await crearDataset({ titulo: 'Real A', vencimiento: '2026-12-15' });
    await motor.enviarPrueba({ tipo: 'aviso', gestion: 'interna', hoy: '2026-11-02' });
    const [aviso] = await mailpit.mensajes();
    const archivos = await adjuntos(aviso.ID);
    assert.deepEqual(archivos.map(a => a.nombre), ['Nota-Digital-PRUEBA.pdf', 'Anexo-Nota-Digital-PRUEBA.pdf']);
    // La nota de prueba, en hoja oficio; su anexo, en A4
    const [deLaNota, delAnexo] = archivos.map(a => tamanosPorHoja(a.contenido));
    assert.ok(deLaNota.every(t => esDelTamano(t, HOJA_OFICIO)), JSON.stringify(deLaNota));
    assert.ok(delAnexo.every(t => esDelTamano(t, HOJA_A4)), JSON.stringify(delAnexo));
    const hojas = lineasPorHoja(archivos[1].contenido);
    assert.equal(hojas.length, 2);
    assert.ok(hojas[0].includes('Real A'));
    assert.ok(hojas[1].includes('Real B'));
    assert.ok(hojas[0].includes('Anexo – Nota Digital N° PRUEBA · Hoja 1 de 2'), hojas[0].join(' | '));
    assert.deepEqual((await anexos()).map(n => [n.tipo, n.es_prueba, Boolean(n.anexo_pdf)]), [['aviso', 1, true]]);
  });

  it('la prueba de un aviso sin datos reales adjunta el anexo del ejemplo', async () => {
    await motor.enviarPrueba({ tipo: 'aviso', gestion: 'externa', hoy: '2026-11-02' });
    const [mensaje] = await mailpit.mensajes();
    const archivos = await adjuntos(mensaje.ID);
    assert.deepEqual(archivos.map(a => a.nombre), ['Nota-Digital-PRUEBA.pdf', 'Anexo-Nota-Digital-PRUEBA.pdf']);
    const hojas = lineasPorHoja(archivos[1].contenido);
    assert.equal(hojas.length, 1);
    assert.ok(hojas[0].includes('Dataset de ejemplo próximo a vencer'));
  });

  it('previewAnexo arma el anexo del aviso de hoy con N° XX y no guarda nada', async () => {
    await crearDataset({ titulo: 'Real a vencer', gestion: 'externa', vencimiento: '2026-11-30' });
    await crearDataset({ titulo: 'Real de la otra gestión', gestion: 'interna', vencimiento: '2026-11-30' });
    const pdf = await motor.previewAnexo({ gestion: 'externa', hoy: '2026-11-02' });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const hojas = lineasPorHoja(pdf);
    assert.equal(hojas.length, 1);
    assert.ok(hojas[0].includes('Real a vencer'));
    assert.ok(hojas[0].includes('Anexo – Nota Digital N° XX · Hoja 1 de 1'), hojas[0].join(' | '));
    assert.equal((await notas()).length, 0);
    assert.equal((await mailpit.mensajes()).length, 0);
  });

  it('previewAnexo sin datasets reales usa el ejemplo: una hoja, a vencer, con la gestión y el "qué se solicita" por defecto', async () => {
    const pdf = await motor.previewAnexo({ gestion: 'interna', hoy: '2026-11-02' });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const hojas = lineasPorHoja(pdf);
    assert.equal(hojas.length, 1);
    const texto = hojas[0].join(' ');
    assert.ok(hojas[0].includes('Dataset de ejemplo próximo a vencer'), texto);
    // El ejemplo vence a fin de mes (spec 2026-10-17-fechas-datasets, R1 y 9): el del mes en que caen los 30 días. Es el
    // vencimiento del estado; el pedido (un relevamiento, el sugerido de la interna) va en "Datos solicitados" y la línea
    // de tiempo arranca en sus datos publicados (Datos al: el corte del ciclo anterior, el 30/11/2025)
    assert.ok(texto.includes('Vence el 31/12/2026 · faltan 59 días'), texto);
    assert.ok(hojas[0].includes('DATOS SOLICITADOS') && hojas[0].includes('Relevamiento actualizado'), texto);
    assert.ok(hojas[0].includes('DATOS PUBLICADOS AL') && hojas[0].includes('30/11/2025'), texto);
    assert.ok(hojas[0].includes('Interna'), texto);
    assert.ok(texto.includes(SOLICITA_POR_DEFECTO), texto);
    assert.ok(texto.includes('Área de ejemplo'), texto);
    assert.equal((await notas()).length, 0);
  });

  it('el anexo lleva las fechas de la nota: un dataset que pierde las suyas durante la generación no deja una ficha sin vencimiento', async () => {
    const id = await crearDataset({ titulo: 'Cambia en el medio', vencimiento: '2026-12-31', ultima: '2025-12-31' });
    const seleccion = await datos.seleccionarParaAviso('interna', '2026-11-02');
    // Entre la selección y la ficha del anexo, el dataset se queda sin fechas
    await query('UPDATE datasets SET proxima_actualizacion = NULL, ultima_actualizacion = NULL WHERE id = ?', [id]);
    const notaId = await motor.generarNota({
      tipo: 'aviso', gestion: 'interna', fecha: '2026-11-02', datasets: seleccion, config: await datos.obtenerConfig()
    });
    const [{ anexo_pdf: anexo }] = await query('SELECT anexo_pdf FROM notas_digitales WHERE id = ?', [notaId]);
    const [hoja] = lineasPorHoja(anexo);
    const texto = hoja.join(' ');
    assert.ok(texto.includes('Vence el 31/12/2026'), texto);
    // Sin Datos al, la línea de tiempo arranca en la carga en el portal: la de la nota
    assert.ok(hoja.includes('CARGADO EN EL PORTAL') && hoja.includes('31/12/2025'), texto);
    assert.ok(!texto.includes('Sin registro'), texto);
  });

  it('el anexo de un dataset externo trimestral sin tipo guardado (el sugerido es acumulado) dice "(Acumulado)"; el anual, no (spec 18)', async () => {
    await crearDataset({ titulo: 'Trimestral sin tipo', gestion: 'externa', frecuencia: 'Trimestralmente', vencimiento: '2026-12-02', ultima: '2025-12-31' });
    await crearDataset({ titulo: 'Anual sin tipo', gestion: 'externa', frecuencia: 'Anualmente', vencimiento: '2026-12-02', ultima: '2025-12-31' });
    const seleccion = await datos.seleccionarParaAviso('externa', '2026-11-02');
    assert.equal(seleccion.length, 2);
    const notaId = await motor.generarNota({
      tipo: 'aviso', gestion: 'externa', fecha: '2026-11-02', datasets: seleccion, config: await datos.obtenerConfig()
    });
    const [{ anexo_pdf: anexo }] = await query('SELECT anexo_pdf FROM notas_digitales WHERE id = ?', [notaId]);
    const hojas = Object.fromEntries(lineasPorHoja(anexo).map(hoja => [hoja.find(l => l.startsWith('Trimestral sin') || l.startsWith('Anual sin')), hoja]));
    assert.ok(hojas['Trimestral sin tipo'].includes('Trimestralmente (Acumulado)'), hojas['Trimestral sin tipo'].join(' | '));
    assert.ok(hojas['Anual sin tipo'].includes('Anualmente'), hojas['Anual sin tipo'].join(' | '));
    assert.ok(!hojas['Anual sin tipo'].some(l => l.includes('Acumulado')), hojas['Anual sin tipo'].join(' | '));
  });

  // La tabla y el anexo salen de la misma selección: la frecuencia, el tipo y los meses son los de la selección, no los de una
  // segunda lectura. Si el dataset cambia de frecuencia mientras se genera, los dos dicen lo mismo
  it('el anexo toma la frecuencia de la selección, como la tabla: si el dataset cambia de frecuencia mientras se genera, no discrepan', async () => {
    const id = await crearDataset({ titulo: 'Cambia de frecuencia', gestion: 'externa', frecuencia: 'Trimestralmente', vencimiento: '2026-12-02', ultima: '2025-12-31' });
    const seleccion = await datos.seleccionarParaAviso('externa', '2026-11-02');
    assert.equal(seleccion.length, 1);
    // Entre la selección y la ficha del anexo, el dataset pasa a anual
    await query('UPDATE datasets SET frecuencia_id = (SELECT id FROM frecuencias WHERE nombre = ?) WHERE id = ?', ['Anualmente', id]);
    const notaId = await motor.generarNota({
      tipo: 'aviso', gestion: 'externa', fecha: '2026-11-02', datasets: seleccion, config: await datos.obtenerConfig()
    });
    const [{ html, anexo_pdf: anexo }] = await query('SELECT html, anexo_pdf FROM notas_digitales WHERE id = ?', [notaId]);
    assert.ok(html.includes('>Trimestralmente (Acumulado)</td>'), 'la tabla dice la frecuencia de la selección');
    const [hoja] = lineasPorHoja(anexo);
    assert.ok(hoja.includes('Trimestralmente (Acumulado)'), hoja.join(' | '));
    assert.ok(!hoja.some(l => l.includes('Anualmente')), hoja.join(' | '));
  });

  it('un anexo que falla al dibujarse (dentro de la transacción) no deja la nota ni sus datasets y no consume el número', async () => {
    const id = await crearDataset({ titulo: 'Anexo que falla', vencimiento: '2026-12-31', ultima: '2025-12-31' });
    const [dataset] = await datos.seleccionarParaAviso('interna', '2026-11-02');
    const ficha = (await datos.fichasDe([id])).get(id);
    // Una ficha con la fecha cero de MariaDB pasa validarFichas (tiene vencimiento) y hace fallar a renderAnexo
    await assert.rejects(motor.generarNota({
      tipo: 'aviso', gestion: 'interna', fecha: '2026-11-02', datasets: [dataset], config: await datos.obtenerConfig(),
      preparado: { datasets: [dataset], areas: [], fichas: [{ ...ficha, vencimiento: '0000-00-00' }] }
    }), /NaN/);
    assert.equal((await notas()).length, 0);
    assert.equal((await query('SELECT COUNT(*) AS n FROM notas_digitales_datasets'))[0].n, 0);

    // El aviso siguiente toma el N° 1
    await ejecutar('2026-11-02');
    assert.deepEqual((await notas()).map(n => [n.tipo, n.numero, n.estado]), [['aviso', 1, 'enviada']]);
  });

  it('un aviso con un dataset sin vencimiento no se genera ni toma número: el anexo nunca recibe una ficha sin vencimiento', async () => {
    const area = await crearArea({ nombre: 'Área sin fechas' });
    const id = await crearDataset({ titulo: 'Sin vencimiento', vencimiento: null, areaId: area });
    const dataset = {
      id, titulo: 'Sin vencimiento', url_dataset: null, area_id: area, area_nombre: 'Área sin fechas',
      frecuencia_nombre: 'Anualmente', ultima_actualizacion: null, vencimiento: null
    };
    await assert.rejects(
      motor.generarNota({ tipo: 'aviso', gestion: 'interna', fecha: '2026-11-02', datasets: [dataset], config: await datos.obtenerConfig() }),
      /El anexo del aviso necesita una ficha con vencimiento por cada dataset/
    );
    assert.equal((await notas()).length, 0);
  });
});

// El anexo de la reiteración (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2): un solo PDF con la hoja del Seguimiento de
// cada dataset de la nota, en el orden de la tabla, calculado con la fecha de la nota y guardado al generarla
describe('anexo de la reiteración (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2)', () => {
  const GENERADO = /^Generado el \d{2}\/\d{2}\/\d{4} a las \d{2}:\d{2}$/;
  const fuentesDelCaso = (id) => ({ ...CASOS[id], catalogos: CATALOGOS });
  // Los datasets de la nota de los casos reales, en el orden de la selección (por vencimiento): el 52 venció el 31/07, el 81
  // vence el 31/10 y el 38 el 31/03/2027
  const DE_LOS_CASOS = [52, 81, 38].map(id => ({ id, titulo: CASOS[id].dataset.titulo, vencimiento: CASOS[id].dataset.proxima }));
  // Las opciones del circuito en el anexo: sin nota DGMIT, el tramo de la nota formal es neutral (spec 2026-10-24-notas-dgmit, 7)
  const ANEXO = { anexo: true };

  // Un vencido que nunca tuvo aviso y un próximo a vencer avisado el 01/10 (N° 1/26): los dos van en la reiteración interna del
  // 02/11, que toma el N° 2/26. La selección los trae por vencimiento (primero el vencido); la tabla, al revés
  const reiteracionDel0211 = async () => {
    const vencido = await crearDataset({ titulo: 'Vencido sin aviso', vencimiento: '2026-10-31' });
    const proximo = await crearDataset({ titulo: 'Próximo avisado', vencimiento: '2026-11-30' });
    await crearNota({ fecha: '2026-10-01', numero: 1, datasets: [{ id: proximo, vencimiento: '2026-11-30' }] });
    return { vencido, proximo };
  };
  const laReiteracion = async () => (await query(
    "SELECT id, numero, anio, estado, es_prueba, html, texto, pdf, anexo_pdf FROM notas_digitales WHERE tipo = 'reiteracion' ORDER BY id"
  ));

  it('ordenDeLaTabla deja primero los que vencen desde la fecha de la nota y después los vencidos, sin cambiar el orden dentro de cada grupo', () => {
    const d = (id, vencimiento) => ({ id, titulo: `Dataset ${id}`, area_nombre: 'Área', frecuencia_nombre: 'Anualmente', vencimiento });
    const lista = [d(1, '2026-10-31'), d(2, '2026-11-30'), d(3, '2026-09-30'), d(4, '2026-11-02'), d(5, '2026-12-31'), d(6, '2026-11-01')];
    const ordenada = seguimientoNotas.ordenDeLaTabla(lista, '2026-11-02');
    assert.deepEqual(ordenada.map(x => x.id), [2, 4, 5, 1, 3, 6]);
    assert.deepEqual(lista.map(x => x.id), [1, 2, 3, 4, 5, 6], 'no cambia la lista que recibe');
    // Es el orden de las filas de la nota: los próximos a vencer (el que vence ese día también) y después los vencidos
    for (const gestion of ['interna', 'externa']) {
      const nota = construirNota({ tipo: 'reiteracion', gestion, fecha: '2026-11-02', datasets: lista, config: {} });
      const filas = nota.secciones.flatMap(s => s.filas.map(f => f.valores[0]));
      assert.deepEqual(filas, ordenada.map(x => x.titulo), gestion);
    }
  });

  it('seguimientosDeLaNota usa las fuentes que recibe: una hoja por dataset, en el orden de la tabla, con la fecha de la nota como hoy y la cinta del PDF', async () => {
    const fuentesPorId = new Map([52, 81, 38].map(id => [id, fuentesDelCaso(id)]));
    const lista = await seguimientoNotas.seguimientosDeLaNota(DE_LOS_CASOS, HOY_DE_LOS_CASOS, fuentesPorId);
    assert.deepEqual(lista, [81, 38, 52].map(id => seguimientoDe(fuentesDelCaso(id), HOY_DE_LOS_CASOS, OPCIONES_CINTA_PDF, ANEXO)));
    // Con otra fecha, otro Seguimiento: el 81 todavía no venció el 20/10 y el 02/11 ya está vencido
    const despues = await seguimientoNotas.seguimientosDeLaNota(DE_LOS_CASOS, '2026-11-02', fuentesPorId);
    assert.deepEqual(despues.map(s => s.ficha.id), [38, 52, 81]);
    assert.deepEqual(despues, [38, 52, 81].map(id => seguimientoDe(fuentesDelCaso(id), '2026-11-02', OPCIONES_CINTA_PDF, ANEXO)));
  });

  it('seguimientosDeLaNota tira error si falta la fuente de un dataset', async () => {
    const sinEl81 = new Map([52, 38].map(id => [id, fuentesDelCaso(id)]));
    await assert.rejects(seguimientoNotas.seguimientosDeLaNota(DE_LOS_CASOS, HOY_DE_LOS_CASOS, sinEl81), /dataset 81/);
  });

  it('seguimientosDeLaNota sin fuentes las lee de la base: las mismas que da fuentesDe', async () => {
    const { vencido, proximo } = await reiteracionDel0211();
    const datasets = await datos.seleccionarParaReiteracion('interna', '2026-11-02');
    assert.deepEqual(datasets.map(d => d.id), [vencido, proximo]);
    const lista = await seguimientoNotas.seguimientosDeLaNota(datasets, '2026-11-02');
    const fuentes = await seguimientoDatos.fuentesDe([vencido, proximo]);
    assert.deepEqual(lista, [proximo, vencido].map(id => seguimientoDe(fuentes.get(id), '2026-11-02', OPCIONES_CINTA_PDF, ANEXO)));
  });

  it('generarNota de una reiteración guarda anexo_pdf con una hoja por dataset en el orden de la tabla y el pie con su número', async () => {
    await reiteracionDel0211();
    await ejecutar('2026-11-02');
    const [reiteracion] = await laReiteracion();
    assert.equal(reiteracion.numero, 2);
    assert.ok(reiteracion.anexo_pdf);
    assert.equal(reiteracion.anexo_pdf.subarray(0, 5).toString(), '%PDF-');
    // La reiteración sale en hoja oficio y su anexo de seguimiento sigue en A4
    assert.ok(tamanosPorHoja(reiteracion.pdf).every(t => esDelTamano(t, HOJA_OFICIO)), JSON.stringify(tamanosPorHoja(reiteracion.pdf)));
    assert.ok(tamanosPorHoja(reiteracion.anexo_pdf).every(t => esDelTamano(t, HOJA_A4)), JSON.stringify(tamanosPorHoja(reiteracion.anexo_pdf)));

    const hojas = lineasPorHoja(reiteracion.anexo_pdf);
    assert.equal(hojas.length, 2);
    // Primero el próximo a vencer y después el vencido, como la tabla (la selección los trae al revés)
    assert.ok(hojas[0].includes('Próximo avisado'), hojas[0].join(' | '));
    assert.ok(hojas[1].includes('Vencido sin aviso'), hojas[1].join(' | '));
    hojas.forEach((lineas, k) => {
      assert.ok(lineas.includes(`Anexo de la Nota Digital N° 2/26 · Hoja ${k + 1} de 2`), lineas.join(' | '));
      // Arriba, «Seguimiento del dataset» con la fecha larga de la nota; abajo, la hora de generación, sin «por»
      assert.ok(lineas.includes('Seguimiento del dataset') && lineas.includes('2 de noviembre de 2026'), lineas.join(' | '));
      assert.equal(lineas.filter(l => GENERADO.test(l)).length, 1, lineas.join(' | '));
      assert.ok(!lineas.some(l => /^Generado.* por /.test(l)), lineas.join(' | '));
    });
    // El Seguimiento es el del día de la nota: el vencido venció hace 2 días
    assert.ok(hojas[1].includes('31/10/2026, hace 2 días'), hojas[1].join(' | '));

    // La nota lo anuncia, en el HTML y en el texto
    assert.ok(reiteracion.html.includes('>Anexo: seguimiento de los conjuntos de datos (2 hojas).</p>'));
    assert.ok(reiteracion.texto.startsWith('SE ADJUNTAN NOTA Y ANEXO EN PDF\n\n'));
    assert.ok(reiteracion.texto.includes('\nAnexo: seguimiento de los conjuntos de datos (2 hojas).\n'));
    // Lo de siempre: la reiteración guarda sus datasets
    assert.equal((await query('SELECT COUNT(*) AS n FROM notas_digitales_datasets WHERE nota_id = ?', [reiteracion.id]))[0].n, 2);
  });

  it('enviarNota de una reiteración adjunta Nota y Anexo', async () => {
    await reiteracionDel0211();
    await ejecutar('2026-11-02');
    const mensaje = (await mailpit.mensajes()).find(m => /Reiteración – /.test(m.Subject));
    assert.ok(mensaje);
    const archivos = await adjuntos(mensaje.ID);
    assert.deepEqual(archivos.map(a => a.nombre), ['Nota-Digital-2-26.pdf', 'Anexo-Nota-Digital-2-26.pdf']);
    const [reiteracion] = await laReiteracion();
    assert.equal(reiteracion.estado, 'enviada');
    assert.deepEqual(archivos[0].contenido, reiteracion.pdf);
    assert.deepEqual(archivos[1].contenido, reiteracion.anexo_pdf);
    assert.ok((await mailpit.html(mensaje.ID)).includes('>SE ADJUNTAN NOTA Y ANEXO EN PDF</p>'));
  });

  it('el reintento de una reiteración fallida reenvía el mismo anexo, aunque los datasets hayan cambiado', async () => {
    await reiteracionDel0211();
    process.env.EMAIL_SOLO_A = 'nadie@rpad.test';
    await ejecutar('2026-11-02');
    process.env.EMAIL_SOLO_A = '';
    const [fallida] = await laReiteracion();
    assert.equal(fallida.estado, 'fallida');
    assert.ok(fallida.anexo_pdf);
    await query("UPDATE datasets SET titulo = CONCAT('Cambiado: ', titulo), proxima_actualizacion = '2027-06-30'");

    await ejecutar('2026-11-03');
    const mensaje = (await mailpit.mensajes()).find(m => /Reiteración – /.test(m.Subject));
    const archivos = await adjuntos(mensaje.ID);
    assert.deepEqual(archivos.map(a => a.nombre), ['Nota-Digital-2-26.pdf', 'Anexo-Nota-Digital-2-26.pdf']);
    assert.deepEqual(archivos[1].contenido, fallida.anexo_pdf);
    const [despues] = await laReiteracion();
    assert.equal(despues.estado, 'enviada');
    assert.deepEqual(despues.anexo_pdf, fallida.anexo_pdf);
  });

  it('si el anexo de la reiteración falla, no queda nota ni número usado', async () => {
    const { vencido, proximo } = await reiteracionDel0211();
    const config = await datos.obtenerConfig();
    const datasets = await datos.seleccionarParaReiteracion('interna', '2026-11-02');
    const reiterar = (preparado) => motor.generarNota({
      tipo: 'reiteracion', gestion: 'interna', fecha: '2026-11-02', datasets, config, preparado: { areas: [], fichas: [], ...preparado }
    });
    // Falta el Seguimiento de un dataset (se lee antes de abrir la transacción): la nota no se genera
    const soloDelProximo = await seguimientoDatos.fuentesDe([proximo]);
    await assert.rejects(reiterar({ datasets, fuentesPorId: soloDelProximo }), new RegExp(`dataset ${vencido}`));
    // El anexo falla al dibujarse, dentro de la transacción y ya con el número asignado (sin hojas que dibujar)
    await assert.rejects(reiterar({ datasets: [], fuentesPorId: new Map() }), /al menos un seguimiento/);
    assert.equal((await query("SELECT COUNT(*) AS n FROM notas_digitales WHERE tipo = 'reiteracion'"))[0].n, 0);
    assert.equal((await query('SELECT COUNT(*) AS n FROM notas_digitales_datasets'))[0].n, 1, 'solo el aviso del 01/10');

    // La reiteración de la corrida toma el N° 2: los intentos fallidos no gastaron números
    await ejecutar('2026-11-02');
    const [reiteracion] = await laReiteracion();
    assert.equal(reiteracion.numero, 2);
    assert.ok(reiteracion.anexo_pdf);
  });

  it('una prueba de reiteración lleva anexo con N° PRUEBA', async () => {
    await reiteracionDel0211();
    const resultado = await motor.enviarPrueba({ tipo: 'reiteracion', gestion: 'interna', hoy: '2026-11-02' });
    assert.equal(resultado.ejemplo, false);
    const [mensaje] = await mailpit.mensajes();
    const archivos = await adjuntos(mensaje.ID);
    assert.deepEqual(archivos.map(a => a.nombre), ['Nota-Digital-PRUEBA.pdf', 'Anexo-Nota-Digital-PRUEBA.pdf']);
    const hojas = lineasPorHoja(archivos[1].contenido);
    assert.equal(hojas.length, 2);
    assert.ok(hojas[0].includes('Próximo avisado'), hojas[0].join(' | '));
    assert.ok(hojas[1].includes('Vencido sin aviso'), hojas[1].join(' | '));
    hojas.forEach((lineas, k) => {
      assert.ok(lineas.includes(`Anexo de la Nota Digital N° PRUEBA · Hoja ${k + 1} de 2`), lineas.join(' | '));
    });
    const [prueba] = await laReiteracion();
    assert.equal(prueba.es_prueba, 1);
    assert.deepEqual(prueba.anexo_pdf, archivos[1].contenido);
    assert.ok(prueba.html.includes('>Anexo: seguimiento de los conjuntos de datos (2 hojas).</p>'));
  });

  // Spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2.5: vista previa y prueba del anexo en Correos
  it('la prueba de una reiteración de ejemplo adjunta el anexo', async () => {
    const resultado = await motor.enviarPrueba({ tipo: 'reiteracion', gestion: 'externa', hoy: '2026-11-02' });
    assert.equal(resultado.ejemplo, true);
    assert.equal(resultado.success, true);
    const [mensaje] = await mailpit.mensajes();
    assert.deepEqual(direcciones(mensaje.To), ['prueba@rpad.test']);
    const archivos = await adjuntos(mensaje.ID);
    assert.deepEqual(archivos.map(a => a.nombre), ['Nota-Digital-PRUEBA.pdf', 'Anexo-Nota-Digital-PRUEBA.pdf']);
    // Los dos datasets de ejemplo, en el orden de la tabla: el a vencer y después el vencido; el pie con el número de la prueba
    const hojas = lineasPorHoja(archivos[1].contenido);
    assert.equal(hojas.length, 2);
    assert.ok(hojas[0].includes('Dataset de ejemplo próximo a vencer'), hojas[0].join(' | '));
    assert.ok(hojas[1].includes('Dataset de ejemplo vencido'), hojas[1].join(' | '));
    hojas.forEach((lineas, k) => {
      assert.ok(lineas.includes(`Anexo de la Nota Digital N° PRUEBA · Hoja ${k + 1} de 2`), lineas.join(' | '));
    });
    // La nota anuncia las dos hojas y la prueba guarda el anexo; no queda registro de datasets ni de números usados
    const [prueba] = await laReiteracion();
    assert.equal(prueba.es_prueba, 1);
    assert.deepEqual(prueba.anexo_pdf, archivos[1].contenido);
    assert.ok(prueba.html.includes('>Anexo: seguimiento de los conjuntos de datos (2 hojas).</p>'));
    assert.equal((await query('SELECT COUNT(*) AS n FROM notas_digitales_datasets'))[0].n, 0);
  });

  it('fuentesDeEjemplo da las fuentes de cada dataset de ejemplo, con su ficha y sin movimientos: seguimientoDe no falla con los ids 0 y -1', () => {
    for (const gestion of ['interna', 'externa']) {
      const { datasets } = motor.ejemplo('reiteracion', gestion, '2026-11-02');
      const fuentes = motor.fuentesDeEjemplo(datasets, '2026-11-02');
      assert.ok(fuentes instanceof Map);
      assert.deepEqual([...fuentes.keys()], [0, -1]);
      for (const d of datasets) {
        const delDataset = fuentes.get(d.id);
        // Lo mismo que devuelve fuentesDe: el dataset, las listas vacías y los catálogos
        assert.deepEqual(Object.keys(delDataset).sort(), ['altasSinDataset', 'auditorias', 'cambios', 'catalogos', 'dataset', 'emails', 'historial', 'notas', 'notasDgmit']);
        for (const lista of ['altasSinDataset', 'cambios', 'historial', 'emails', 'notas', 'auditorias', 'notasDgmit']) assert.deepEqual(delDataset[lista], [], lista);
        assert.deepEqual(delDataset.dataset, {
          id: d.id, titulo: d.titulo, area: 'Área de ejemplo', area_superior: 'Secretaría de ejemplo', area_id: 0, tipo_gestion: gestion,
          requiere_nota: d.requiere_nota, frecuencia: 'Anualmente', meses: 12, proxima: d.vencimiento, datos_al: d.datos_al,
          ultima: d.ultima_actualizacion, tipo_pedido: d.tipo_pedido, url_dataset: 'https://datos.comodoro.gov.ar', activo: true, alta: null
        });
        const seguimiento = seguimientoDe(delDataset, '2026-11-02', OPCIONES_CINTA_PDF);
        assert.equal(seguimiento.ficha.titulo, d.titulo);
        assert.equal(seguimiento.ficha.requiere_nota, d.requiere_nota);
        assert.deepEqual(seguimiento.movimientos, []);
      }
    }
  });

  it('seguimientosDeLaNota con las fuentes de ejemplo no consulta la base: el próximo y después el vencido', async () => {
    const { datasets } = motor.ejemplo('reiteracion', 'externa', '2026-11-02');
    const fuentesPorId = motor.fuentesDeEjemplo(datasets, '2026-11-02');
    const lista = await seguimientoNotas.seguimientosDeLaNota(datasets, '2026-11-02', fuentesPorId);
    assert.deepEqual(lista.map(s => s.ficha.id), [0, -1]);
    // Sin ellas lee la base (fuentesDe descarta los ids de ejemplo) y no encuentra el dataset
    await assert.rejects(seguimientoNotas.seguimientosDeLaNota(datasets, '2026-11-02'), /dataset 0/);
  });

  it('previewAnexo de una reiteración: una hoja por dataset, en el orden de la tabla, con N° XX; es el de la próxima corrida y no guarda nada', async () => {
    await reiteracionDel0211();
    const pdf = await motor.previewAnexo({ tipo: 'reiteracion', gestion: 'interna', hoy: '2026-11-02' });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const hojas = lineasPorHoja(pdf);
    assert.equal(hojas.length, 2);
    // Los mismos que la vista previa de la nota
    const vista = await motor.previewNota({ tipo: 'reiteracion', gestion: 'interna', hoy: '2026-11-02' });
    assert.equal(vista.cantidad, 2);
    assert.ok(hojas[0].includes('Próximo avisado') && hojas[1].includes('Vencido sin aviso'), hojas.map(h => h.join(' | ')).join('\n'));
    hojas.forEach((lineas, k) => {
      assert.ok(lineas.includes(`Anexo de la Nota Digital N° XX · Hoja ${k + 1} de 2`), lineas.join(' | '));
      assert.ok(lineas.some(l => GENERADO.test(l)), lineas.join(' | '));
    });
    // Es el que saldría en la corrida: las mismas hojas que el anexo guardado de la reiteración del día
    await ejecutar('2026-11-02');
    const [reiteracion] = await laReiteracion();
    assert.deepEqual(lineasPorHoja(reiteracion.anexo_pdf).map(h => h.map(l => l.replace('N° 2/26', 'N° XX')).filter(l => !GENERADO.test(l))),
      hojas.map(h => h.filter(l => !GENERADO.test(l))));
    assert.equal((await notas()).filter(n => n.tipo === 'reiteracion').length, 1, 'solo la de la corrida');
  });

  it('previewAnexo de una reiteración sin datasets reales usa el ejemplo: dos hojas, sin leer la base', async () => {
    const pdf = await motor.previewAnexo({ tipo: 'reiteracion', gestion: 'externa', hoy: '2026-11-02' });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const hojas = lineasPorHoja(pdf);
    assert.equal(hojas.length, 2);
    assert.ok(hojas[0].includes('Dataset de ejemplo próximo a vencer'), hojas[0].join(' | '));
    assert.ok(hojas[1].includes('Dataset de ejemplo vencido'), hojas[1].join(' | '));
    assert.ok(hojas[1].includes('Anexo de la Nota Digital N° XX · Hoja 2 de 2'), hojas[1].join(' | '));
    assert.equal((await notas()).length, 0);
    assert.equal((await mailpit.mensajes()).length, 0);
  });

  it('previewAnexo sin tipo es el del aviso; con un tipo que no lleva anexo, se rechaza', async () => {
    await crearDataset({ titulo: 'Real a vencer', gestion: 'externa', vencimiento: '2026-11-30' });
    const sinTipo = lineasPorHoja(await motor.previewAnexo({ gestion: 'externa', hoy: '2026-11-02' }));
    const deAviso = lineasPorHoja(await motor.previewAnexo({ tipo: 'aviso', gestion: 'externa', hoy: '2026-11-02' }));
    assert.equal(sinTipo.length, 1);
    assert.ok(sinTipo[0].includes('Anexo – Nota Digital N° XX · Hoja 1 de 1'), sinTipo[0].join(' | '));
    assert.deepEqual(sinTipo.map(h => h.filter(l => !GENERADO.test(l))), deAviso.map(h => h.filter(l => !GENERADO.test(l))));
    for (const tipo of ['auditoria', 'autorizacion', 'otro']) {
      await assert.rejects(motor.previewAnexo({ tipo, gestion: 'externa', hoy: '2026-11-02' }), motor.ErrorDeUso, tipo);
    }
  });

  // Notas DGMIT (spec 2026-10-24-notas-dgmit, 7): el anexo le llega solo a la DGMIT y a la Dirección Administrativa con cada
  // reiteración y la tabla de notas DGMIT arranca vacía. Sin nota, el tramo de la nota formal es neutral («La manda la DGMIT al
  // área»), nunca «Pendiente de carga». La reiteración externa del 02/11: un vencido sin aviso y un próximo avisado el 01/10
  const reiteracionExternaDel0211 = async () => {
    const vencido = await crearDataset({ titulo: 'Externo vencido sin aviso', gestion: 'externa', requiereNota: 1, vencimiento: '2026-10-31' });
    const proximo = await crearDataset({ titulo: 'Externo próximo avisado', gestion: 'externa', requiereNota: 1, vencimiento: '2026-11-30' });
    await crearNota({ gestion: 'externa', fecha: '2026-10-01', numero: 1, datasets: [{ id: proximo, vencimiento: '2026-11-30' }] });
    return { vencido, proximo };
  };

  it('el anexo de una reiteración real sin notas DGMIT no dice Pendiente de carga en ninguna hoja', async () => {
    const { vencido, proximo } = await reiteracionExternaDel0211();
    // Fuera del anexo (la pantalla y la descarga del Seguimiento) los dos dirían «Pendiente de carga»: el vencido ya venció y el
    // próximo ya tuvo un aviso del RPAD en su ciclo
    const fuentes = await seguimientoDatos.fuentesDe([vencido, proximo]);
    for (const id of [vencido, proximo]) {
      assert.equal(seguimientoDe(fuentes.get(id), '2026-11-02', OPCIONES_CINTA_PDF).circuito.tramoFuera.texto, 'Pendiente de carga', `dataset ${id}`);
    }
    const resumen = await ejecutar('2026-11-02');
    assert.deepEqual(resumen.errores, []);
    const [reiteracion] = await laReiteracion();
    assert.ok(reiteracion?.anexo_pdf, 'la reiteración externa, con su anexo');
    const hojas = lineasPorHoja(reiteracion.anexo_pdf);
    assert.equal(hojas.length, 2);
    assert.ok(hojas[0].includes('Externo próximo avisado') && hojas[1].includes('Externo vencido sin aviso'), hojas.map(h => h.join(' | ')).join('\n'));
    for (const lineas of hojas) {
      assert.ok(lineas.includes('CONJUNTO DE DATOS · GESTIÓN EXTERNA'), lineas.join(' | '));
      assert.ok(lineas.includes('Nota formal'), lineas.join(' | '));
      assert.ok(lineas.join(' ').includes('La manda la DGMIT al área'), lineas.join(' | '));
      for (const t of ['Pendiente de carga', 'Todavía no hizo falta', 'Ya no se pide']) assert.ok(!lineas.join(' ').includes(t), `sobra "${t}": ${lineas.join(' | ')}`);
    }
  });

  // fuentesDe también arma el anexo, y si el anexo falla la reiteración no se genera: la consulta de las notas DGMIT va aislada. Se
  // renombra la tabla solo en la base de prueba de este archivo (rpad_test_notas_motor) y se vuelve a su nombre pase lo que pase;
  // el console.error esperado se captura para no ensuciar la salida
  it('si la tabla de notas DGMIT falta, la reiteración se genera con su anexo', async () => {
    await reiteracionExternaDel0211();
    await asegurarBaseDePrueba();
    const errores = [];
    const consoleError = console.error;
    let resumen;
    await query('RENAME TABLE notas_dgmit TO notas_dgmit_x');
    try {
      console.error = (...args) => { errores.push(args); };
      resumen = await ejecutar('2026-11-02');
    } finally {
      console.error = consoleError;
      await query('RENAME TABLE notas_dgmit_x TO notas_dgmit');
    }
    assert.deepEqual(resumen.errores, []);
    const [reiteracion] = await laReiteracion();
    assert.equal(reiteracion?.estado, 'enviada');
    assert.ok(reiteracion.anexo_pdf);
    const hojas = lineasPorHoja(reiteracion.anexo_pdf);
    assert.equal(hojas.length, 2);
    hojas.forEach((lineas, k) => {
      assert.ok(lineas.includes(`Anexo de la Nota Digital N° ${reiteracion.numero}/26 · Hoja ${k + 1} de 2`), lineas.join(' | '));
      assert.ok(lineas.join(' ').includes('La manda la DGMIT al área'), lineas.join(' | '));
    });
    assert.ok(reiteracion.html.includes('>Anexo: seguimiento de los conjuntos de datos (2 hojas).</p>'));
    // Lo único que se registró: que no se pudieron leer las notas DGMIT (la tabla no existe)
    assert.ok(errores.length >= 1);
    for (const [mensaje, error] of errores) {
      assert.equal(mensaje, 'No se pudieron leer las notas DGMIT:');
      assert.equal(error?.code, 'ER_NO_SUCH_TABLE');
    }
    // La tabla volvió a su nombre
    assert.equal((await query("SHOW TABLES LIKE 'notas_dgmit'")).length, 1);
  });
});

// Lo que pidió cada nota, congelado en notas_digitales_datasets (spec 2026-10-17-fechas-datasets, 6 y 9). El pedido depende
// del día (R7): las fechas se arman desde el hoy real y los textos esperados, con formatoCorto (Ruling 7)
describe('datos solicitados guardados con cada nota (spec 2026-10-17-fechas-datasets, 6 y 9)', () => {
  const HOY = proximoDiaHabil(hoyArgentina());
  // Vence a fin del mes del día siguiente a la corrida, entre ese día y 31 días después: entra en el aviso de las dos
  // gestiones. Con el mes de la corrida, un 29/02 vencería el 28/02 (febrero va siempre en 28) y ya estaría vencido
  const VENCE = vencimientoDelMes(sumarDias(HOY, 1));
  // Trimestral vencido hace dos ciclos: el último vencimiento que ya pasó es el fin del mes pasado (R7)
  const VENCIDO = sumarMeses(HOY, -7);
  const primeroDelMes = (iso) => `${iso.slice(0, 8)}01`;
  const periodo = (desde, hasta) => ({ desde, hasta, texto: `Del ${formatoCorto(desde)} al ${formatoCorto(hasta)}` });
  // Un trimestral acumulado con los datos publicados muy atrás: se pide desde el mes siguiente a Datos al
  const trimestral = (titulo, vencimiento) => crearDataset({
    titulo, gestion: 'externa', frecuencia: 'Trimestralmente', vencimiento, tipoPedido: 'acumulado', datosAl: sumarMeses(vencimiento, -16)
  });
  // Lo guardado de un dataset en cada nota, en orden
  const guardado = (datasetId) => query(
    `SELECT n.tipo, DATE_FORMAT(x.datos_desde, '%Y-%m-%d') AS desde, DATE_FORMAT(x.datos_hasta, '%Y-%m-%d') AS hasta,
            x.datos_solicitados AS texto
     FROM notas_digitales_datasets x JOIN notas_digitales n ON n.id = x.nota_id
     WHERE x.dataset_id = ? ORDER BY n.id`, [datasetId]
  );

  it('un aviso guarda en cada dataset desde, hasta y el texto de su pedido; sin pedido, los tres en NULL', async () => {
    const acumulado = await trimestral('Acumulado', VENCE);
    const foto = await crearDataset({ titulo: 'Foto sugerida', gestion: 'externa', frecuencia: 'Cada dos años', vencimiento: VENCE });
    const sinPedido = await crearDataset({ titulo: 'Eventual', gestion: 'externa', vencimiento: VENCE, tipoPedido: 'eventual' });
    const relevamiento = await crearDataset({ titulo: 'Relevamiento sugerido', vencimiento: VENCE });
    const resumen = await ejecutar(HOY);
    assert.deepEqual(resumen.generadas.map(g => [g.tipo, g.gestion, g.datasets]), [['aviso', 'interna', 1], ['aviso', 'externa', 3]]);

    const corte = sumarMeses(VENCE, -1);
    assert.deepEqual(await guardado(acumulado), [{ tipo: 'aviso', ...periodo(primeroDelMes(sumarMeses(VENCE, -15)), corte) }]);
    assert.deepEqual(await guardado(foto), [{ tipo: 'aviso', desde: corte, hasta: corte, texto: `Vigente al ${formatoCorto(corte)}` }]);
    // Sin período, igual queda lo que se pidió
    assert.deepEqual(await guardado(relevamiento), [{ tipo: 'aviso', desde: null, hasta: null, texto: 'Relevamiento actualizado' }]);
    assert.deepEqual(await guardado(sinPedido), [{ tipo: 'aviso', desde: null, hasta: null, texto: null }]);
  });

  it('la reiteración de un vencido hace dos ciclos pide hasta el último corte cerrado (R7) y lo guarda; el aviso conserva lo que pidió', async () => {
    const id = await trimestral('Vencido hace dos ciclos', VENCIDO);
    // El aviso salió unos 30 días antes del vencimiento y pidió hasta el corte de ese vencimiento
    const fechaAviso = proximoDiaHabil(sumarDias(VENCIDO, -30));
    await ejecutar(fechaAviso);
    await ejecutar(HOY);

    const desde = primeroDelMes(sumarMeses(VENCIDO, -15));
    assert.deepEqual(await guardado(id), [
      { tipo: 'aviso', ...periodo(desde, sumarMeses(VENCIDO, -1)) },
      // Recalculado con el hoy de la reiteración: Datos al no cambió, así que el inicio es el mismo y el final avanzó dos ciclos
      { tipo: 'reiteracion', ...periodo(desde, sumarMeses(HOY, -2)) }
    ]);
  });

  // Revisión de la Task 11: el pedido de un dataset que no lo trae se calcula una sola vez, al preparar el contenido; la
  // tabla de la nota, el anexo y lo guardado salen de ese mismo cálculo
  it('un dataset armado a mano, sin su pedido, lo calcula una vez: la nota muestra lo mismo que se guarda', async () => {
    const id = await trimestral('Armado a mano', VENCE);
    const [seleccionado] = await datos.seleccionarParaAviso('externa', HOY);
    const { pedido, ...aMano } = seleccionado;
    assert.ok(pedido && !('pedido' in aMano));
    const notaId = await motor.generarNota({ tipo: 'aviso', gestion: 'externa', fecha: HOY, datasets: [aMano], config: await datos.obtenerConfig() });
    const esperado = periodo(primeroDelMes(sumarMeses(VENCE, -15)), sumarMeses(VENCE, -1));
    assert.deepEqual(await guardado(id), [{ tipo: 'aviso', ...esperado }]);
    const [{ html, texto, anexo_pdf: anexo }] = await query('SELECT html, texto, anexo_pdf FROM notas_digitales WHERE id = ?', [notaId]);
    assert.ok(html.includes(`>${esperado.texto}</td>`), html);
    assert.ok(texto.includes(`    Datos solicitados: ${esperado.texto}\n`), texto);
    // El anexo, en su recuadro "Datos solicitados", con la línea de tiempo desde los datos publicados
    const [hoja] = lineasPorHoja(anexo);
    assert.ok(hoja.includes('DATOS SOLICITADOS') && hoja.includes(esperado.texto), hoja.join(' | '));
    assert.ok(hoja.includes('DATOS PUBLICADOS AL') && hoja.includes(formatoCorto(sumarMeses(VENCE, -16))), hoja.join(' | '));
  });

  // Spec 18: la frecuencia lleva "(Acumulado)" con el tipo efectivo (conPedido): también si el dataset no tiene tipo guardado y
  // el sugerido para su gestión y frecuencia es acumulado. Es lo que queda guardado en el HTML y el texto de la nota
  it('la frecuencia de un acumulado de menos de un año dice "(Acumulado)" en el aviso y la reiteración guardados, con el tipo guardado o el sugerido', async () => {
    await trimestral('Trimestral con tipo guardado', VENCE);
    await crearDataset({ titulo: 'Trimestral sin tipo guardado', gestion: 'externa', frecuencia: 'Trimestralmente', vencimiento: VENCE });
    await crearDataset({ titulo: 'Trimestral vencido sin tipo guardado', gestion: 'externa', frecuencia: 'Trimestralmente', vencimiento: VENCIDO });
    await crearDataset({ titulo: 'Anual sin tipo guardado', gestion: 'externa', vencimiento: VENCE });
    await crearDataset({ titulo: 'Foto sugerida', gestion: 'externa', frecuencia: 'Cada dos años', vencimiento: VENCE });
    await crearDataset({ titulo: 'Trimestral con tipo foto', gestion: 'externa', frecuencia: 'Trimestralmente', vencimiento: VENCE, tipoPedido: 'foto' });
    const resumen = await ejecutar(HOY);
    assert.deepEqual(resumen.errores, []);
    const guardadas = await query("SELECT tipo, html, texto FROM notas_digitales WHERE gestion = 'externa' ORDER BY id");
    assert.deepEqual(guardadas.map(n => n.tipo), ['aviso', 'reiteracion']);
    const [aviso, reiteracion] = guardadas;
    const cuantas = (texto, buscado) => texto.split(buscado).length - 1;

    // Aviso: los dos trimestrales de tipo acumulado (el guardado y el sugerido); el anual, el de dos años y el trimestral
    // de tipo foto, sin cambio
    assert.equal(cuantas(aviso.html, '>Trimestralmente (Acumulado)</td>'), 2, aviso.html);
    assert.equal(cuantas(aviso.html, '(Acumulado)'), 2);
    assert.equal(cuantas(aviso.texto, '    Frecuencia: Trimestralmente (Acumulado)\n'), 2, aviso.texto);
    assert.equal(cuantas(aviso.html, '>Trimestralmente</td>'), 1);
    for (const sinCambio of ['>Anualmente</td>', '>Cada dos años</td>']) assert.equal(cuantas(aviso.html, sinCambio), 1, sinCambio);

    // Reiteración: el trimestral vencido sin aviso previo, con el tipo sugerido
    assert.equal(cuantas(reiteracion.html, '>Trimestralmente (Acumulado)</td>'), 1, reiteracion.html);
    assert.equal(cuantas(reiteracion.texto, '    Frecuencia: Trimestralmente (Acumulado)\n'), 1, reiteracion.texto);
  });

  it('una nota vieja, guardada sin los datos solicitados, sigue contando como aviso y no se completa', async () => {
    const id = await trimestral('Avisado antes de esta etapa', VENCIDO);
    const fechaAviso = sumarDias(VENCIDO, -30);
    await crearNota({ gestion: 'externa', fecha: fechaAviso, numero: 1, datasets: [{ id, vencimiento: VENCIDO }] });
    const resumen = await ejecutar(HOY);
    assert.deepEqual(resumen.generadas.map(g => [g.tipo, g.gestion]), [['reiteracion', 'externa']]);

    const reiteracion = (await notas()).find(n => n.tipo === 'reiteracion');
    assert.ok(reiteracion.html.includes(`Nota Digital N° 1/${fechaAviso.slice(2, 4)} (${formatoCorto(fechaAviso)})`), reiteracion.html);
    assert.deepEqual(await guardado(id), [
      { tipo: 'aviso', desde: null, hasta: null, texto: null },
      { tipo: 'reiteracion', ...periodo(primeroDelMes(sumarMeses(VENCIDO, -15)), sumarMeses(HOY, -2)) }
    ]);
  });
});
