// Motor de Notas Digitales: calendario, numeración, envío, reintentos y concurrencia (base de prueba + Mailpit)
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, cerrarDb, query, mailpit, db } from './helpers.js';
import { crearDataset, crearNota, crearEmailViejo, limpiarBase, configurarNotas, crearArea, conFallaSimulada } from './notas-fixtures.js';
import { pngRgba, pngRgb, pngsDanados } from './firma-fixtures.js';
import { textosPorHoja, imagenesPorHoja } from './pdf-lector.js';

// Banner del membrete generado para los tests (la imagen institucional no se versiona)
const BANNER = pngRgb({ ancho: 1241, alto: 178 });
let base, motor, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_notas_motor');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  motor = await import('../services/notasDigitales.js');
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
    assert.deepEqual(direcciones(mensaje.To), ['mit@rpad.test']);
    assert.deepEqual(direcciones(mensaje.Cc), ['geo@rpad.test']);
    assert.deepEqual(direcciones(mensaje.Bcc), ['respaldo@rpad.test']);
    assert.equal(mensaje.Subject, 'Nota Digital N° 1/26 – Ref.: Solicitud de gestión de datos para el Portal de Datos Abiertos Municipal (gestión interna – noviembre 2026)');
    const detalle = await (await fetch(`http://localhost:8025/api/v1/message/${mensaje.ID}`)).json();
    assert.deepEqual(detalle.Attachments.map(a => a.FileName), ['Nota-Digital-1-26.pdf']);

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

  it('los vencidos sin aviso entran con el antecedente de emails anteriores', async () => {
    const id = await crearDataset({ gestion: 'externa', vencimiento: '2026-07-31', ultima: '2025-07-31' });
    await crearEmailViejo({ tipo: 'externo-vencido', datasetIds: [id], enviado: '2026-01-01 08:00:00' });
    await crearEmailViejo({ tipo: 'externo-vencido', datasetIds: [id], enviado: '2026-10-01 08:00:00' });
    await ejecutar('2026-11-02');
    const [mensaje] = await mailpit.mensajes();
    const html = await mailpit.html(mensaje.ID);
    assert.ok(html.includes('Plazo de actualización vencido'));
    assert.ok(html.includes('Antecedente: notificado a la DGMIT por correo electrónico en 2 oportunidades, entre el 01/01/2026 y el 01/10/2026.'));
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
    await ejecutar('2026-12-30');
    assert.equal((await notas()).length, 0);

    await ejecutar('2026-12-31');
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
    await crearDataset({ titulo: 'Avisado el 14', gestion: 'externa', vencimiento: '2026-11-13' });
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

  it('el próximo aviso del estado agrupa los datasets que vencen el mismo mes', async () => {
    await crearDataset({ gestion: 'externa', vencimiento: '2027-01-30' });
    await crearDataset({ gestion: 'externa', vencimiento: '2027-01-31' });
    await crearDataset({ gestion: 'externa', vencimiento: '2027-02-28' });
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-11-02' })).proximas.externa.aviso, { fecha: '2026-12-31', cantidad: 2 });

    // Marzo ya se abrió con el 29/03 (avisado el 28/01): el 31/03 sale en la corrida siguiente
    const avisado = await crearDataset({ vencimiento: '2027-03-29' });
    await crearNota({ fecha: '2027-01-28', numero: 1, datasets: [{ id: avisado, vencimiento: '2027-03-29' }] });
    await crearDataset({ vencimiento: '2027-03-31' });
    assert.deepEqual((await motor.estadoNotas({ hoy: '2027-01-29' })).proximas.interna.aviso, { fecha: '2027-01-29', cantidad: 1 });
  });
});
