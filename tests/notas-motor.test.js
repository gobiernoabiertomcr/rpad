// Motor de Notas Digitales: calendario, numeración, envío, reintentos y concurrencia (base de prueba + Mailpit)
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, cerrarDb, query, mailpit, db } from './helpers.js';
import { crearDataset, crearNota, crearEmailViejo, limpiarBase, configurarNotas, crearArea } from './notas-fixtures.js';

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
    assert.ok(html.includes('Antecedente: notificado por correo electrónico en 2 oportunidades, entre el 01/01/2026 y el 01/10/2026.'));
  });

  it('un dataset recibe un solo aviso por vencimiento', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await ejecutar('2026-11-02');
    await ejecutar('2026-11-02');
    await ejecutar('2026-11-03');
    assert.equal((await notas()).length, 1);
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
  it('el primer día hábil reitera los avisados hace 21 días o más', async () => {
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
    await ejecutar('2026-12-11'); // ya pasaron 21 días, pero diciembre ya fue evaluado
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
});
