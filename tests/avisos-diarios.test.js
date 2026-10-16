// Avisos diarios que no son Notas Digitales (spec 2026-10-15-dias-habiles-licencias-auditoria, sección 4):
// aviso a las áreas y email de cambios pendientes, con fechas fijas sobre una base de prueba + Mailpit
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query, mailpit, paraCasilla } from './helpers.js';
import { crearArea, crearDataset, asegurarBaseDePrueba, configurarNotas, conFallaSimulada } from './notas-fixtures.js';

let base, servicio, templates, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_avisos_diarios');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  servicio = await import('../services/avisosDiariosService.js');
  templates = await import('../services/emailTemplates.js');
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
  await asegurarBaseDePrueba();
  await query('DELETE FROM cambios_pendientes');
  await query('DELETE FROM notificaciones_log');
  await query('DELETE FROM datasets');
  await query('DELETE FROM areas');
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios');
  await query('UPDATE notas_digitales_config SET envio_activo = 0 WHERE id = 1');
  await mailpit.vaciar();
});

const sufijo = () => crypto.randomBytes(3).toString('hex');
const para = (mensajes, email) => mensajes.filter(m => m.To.some(t => t.Address === email));

const crearUsuario = async (rol) => {
  const username = `t_${rol}_${sufijo()}`;
  const email = `${username}@rpad.test`;
  const resultado = await query(
    `INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES (?, 'x', ?, ?, ?, 1)`,
    [username, `Prueba ${rol}`, email, rol]
  );
  return { id: resultado.insertId, username, email };
};

// Propuesto hace haceMinutos minutos según el reloj de la base (por defecto, dos horas): el recordatorio solo incluye lo
// propuesto hace una hora o más (spec 2026-10-15, 9.2). Devuelve el id del cambio.
const proponerCambio = async (usuarioId, titulo, { haceMinutos = 120 } = {}) => (await query(
  `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id, created_at)
   VALUES ('crear', NULL, ?, ?, NOW() - INTERVAL ? MINUTE)`,
  [JSON.stringify({ titulo }), usuarioId, haceMinutos]
)).insertId;

describe('aviso a las áreas (spec 4.2)', () => {
  const prepararArea = async () => {
    const email = `area_${sufijo()}@rpad.test`;
    const areaId = await crearArea({ email_principal: email });
    return { areaId, email };
  };

  it('un viernes avisa también lo que vence el sábado y el domingo + 40', async () => {
    const { areaId, email } = await prepararArea();
    // viernes 16/10/2026: avisa los vencimientos del 25 al 27/11/2026
    for (const vencimiento of ['2026-11-25', '2026-11-26', '2026-11-27']) {
      await crearDataset({ gestion: 'externa', vencimiento, areaId, titulo: `Vence ${vencimiento}` });
    }
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-28', areaId, titulo: 'Vence el lunes' });

    const resultado = await servicio.enviarAvisoAreas({ hoy: '2026-10-16' });

    assert.equal(resultado.dia_habil, true);
    assert.equal(resultado.enviados.length, 1);
    assert.equal(resultado.enviados[0].cantidad, 3);
    const mensajes = para(await mailpit.esperar(m => m.To.some(t => t.Address === email)), email);
    assert.equal(mensajes.length, 1);
    const [log] = await query("SELECT datasets_ids, success FROM notificaciones_log WHERE tipo = 'area-aviso-40'");
    assert.equal(log.datasets_ids.split(',').length, 3);
    assert.equal(Number(log.success), 1);
  });

  it('un sábado no envía nada', async () => {
    const { areaId, email } = await prepararArea();
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-26', areaId });

    const resultado = await servicio.enviarAvisoAreas({ hoy: '2026-10-17' });

    assert.deepEqual(resultado, { dia_habil: false, enviados: [], errores: [], sin_datasets: true });
    assert.equal(para(await mailpit.mensajes(), email).length, 0);
    assert.equal((await query('SELECT COUNT(*) AS n FROM notificaciones_log'))[0].n, 0);
  });

  it('un jueves común no avisa lo que vence el sábado + 40', async () => {
    const { areaId } = await prepararArea();
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-26', areaId });
    const resultado = await servicio.enviarAvisoAreas({ hoy: '2026-10-15' });
    assert.equal(resultado.enviados.length, 0);
    assert.equal(resultado.sin_datasets, true);
  });

  it('la gestión interna y las áreas sin email quedan afuera, como antes', async () => {
    const { areaId } = await prepararArea();
    const sinEmail = await crearArea();
    await crearDataset({ gestion: 'interna', vencimiento: '2026-11-25', areaId });
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-25', areaId: sinEmail });
    assert.deepEqual(await servicio.datasetsExternosPorArea('2026-10-16'), []);
  });
});

describe('email de cambios pendientes (spec 4.1)', () => {
  it('en un día hábil le llega al otro admin y no al que propuso', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    await proponerCambio(a.id, 'Cambio de prueba en día hábil');

    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-16' });

    assert.equal(resultado.dia_habil, true);
    assert.deepEqual(resultado.enviados.map(e => e.email), [b.email]);
    assert.equal(para(await mailpit.esperar(m => m.To.some(t => t.Address === b.email)), b.email).length, 1);
    assert.equal(para(await mailpit.mensajes(), a.email).length, 0);
  });

  it('no le llega a quien está de licencia ese día (spec 5.3)', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    const c = await crearUsuario('admin');
    await proponerCambio(a.id, 'Cambio con un revisor de licencia');
    await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [b.id, '2026-10-12', '2026-10-16']);

    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-16' });

    assert.deepEqual(resultado.enviados.map(e => e.email), [c.email]);
    assert.deepEqual(resultado.deLicencia, [b.username]);
    assert.equal(para(await mailpit.mensajes(), b.email).length, 0);
  });

  for (const [fecha, descripcion] of [['2026-10-17', 'sábado'], ['2026-10-18', 'domingo'], ['2026-12-08', 'feriado fijo']]) {
    it(`un ${descripcion} no envía nada`, async () => {
      const a = await crearUsuario('admin');
      const b = await crearUsuario('admin');
      await proponerCambio(a.id, 'Cambio de prueba en día no hábil');

      const resultado = await servicio.enviarCambiosPendientes({ hoy: fecha });

      assert.equal(resultado.dia_habil, false);
      assert.deepEqual(resultado.enviados, []);
      assert.deepEqual(resultado.errores, []);
      assert.equal(para(await mailpit.mensajes(), b.email).length, 0);
    });
  }

  it('un feriado trasladable es día hábil: el email sale', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    await proponerCambio(a.id, 'Cambio en feriado trasladable');
    // lunes 12/10/2026 (Día del Respeto a la Diversidad Cultural, trasladable)
    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-12' });
    assert.deepEqual(resultado.enviados.map(e => e.email), [b.email]);
  });
});

describe('recordatorio de cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 9.2)', () => {
  const asunto = (n) => (n === 1 ? '[RPAD] 1 cambio espera tu auditoría' : `[RPAD] ${n} cambios esperan tu auditoría`);
  const primerRecordatorio = async (id) => (await query(
    "SELECT DATE_FORMAT(primer_recordatorio_at, '%Y-%m-%d %H:%i:%s') AS f FROM cambios_pendientes WHERE id = ?", [id]
  ))[0].f;

  it('solo incluye lo propuesto hace una hora o más, medido con el reloj de la base, y guarda el primer recordatorio', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    const viejo = await proponerCambio(a.id, 'Propuesto hace 61 minutos', { haceMinutos: 61 });
    const reciente = await proponerCambio(a.id, 'Propuesto hace 59 minutos', { haceMinutos: 59 });

    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-16', ahora: '2026-10-16 14:00:00' });

    assert.deepEqual(resultado.enviados.map(e => [e.email, e.cantidadPendientes, e.respaldo]), [[b.email, 1, false]]);
    const [mensaje] = para(await mailpit.esperar(m => m.To.some(t => t.Address === b.email)), b.email);
    assert.equal(mensaje.Subject, asunto(1));
    const html = await mailpit.html(mensaje.ID);
    assert.match(html, /Propuesto hace 61 minutos/);
    assert.doesNotMatch(html, /Propuesto hace 59 minutos/);
    assert.doesNotMatch(html, /Hace Hace/);
    // 61 minutos son "1 hora", no "1 horas"
    assert.match(html, /Hace 1 hora(?!s)/);
    // El cuerpo concuerda con el asunto y con el rol editor: se audita, y lo proponen otras personas (no solo administradores)
    assert.match(html, /Hay 1 cambio esperando tu auditoría/);
    assert.match(html, /cambios propuestos por otras personas\./);
    assert.doesNotMatch(html, /esperando tu aprobacion|otros administradores/);
    assert.equal(await primerRecordatorio(viejo), '2026-10-16 14:00:00');
    assert.equal(await primerRecordatorio(reciente), null);
  });

  it('se repite cada día hábil mientras sigue en el canal recordatorio, sin pisar la fecha del primero', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    // Un superadmin disponible que no lo propuso: sin firmante titular elegido, el cambio no pasa al canal nota (9.1)
    await crearUsuario('superadmin');
    const id = await proponerCambio(a.id, 'Cambio que sigue pendiente');
    await servicio.enviarCambiosPendientes({ hoy: '2026-10-16', ahora: '2026-10-16 14:00:00' });
    await mailpit.vaciar();
    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-19', ahora: '2026-10-19 14:00:00' });
    assert.ok(resultado.enviados.some(e => e.email === b.email));
    assert.equal(await primerRecordatorio(id), '2026-10-16 14:00:00');
  });

  it('a los editores no les llega mientras haya auditores disponibles; sin ellos, les llega de respaldo y lo dice', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    const editor = await crearUsuario('editor');
    await proponerCambio(a.id, 'Cambio para el respaldo');
    let resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-16' });
    assert.deepEqual(resultado.enviados.map(e => e.email), [b.email]);
    assert.ok(resultado.sinPendientes.includes(editor.username));

    await mailpit.vaciar();
    await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [b.id, '2026-10-19', '2026-10-23']);
    resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-19' });
    assert.deepEqual(resultado.enviados.map(e => [e.email, e.respaldo]), [[editor.email, true]]);
    assert.deepEqual(resultado.deLicencia, [b.username]);
    const [mensaje] = await mailpit.esperar(m => m.To.some(t => t.Address === editor.email));
    assert.match(await mailpit.html(mensaje.ID), /Te llega como respaldo: no hay auditores disponibles\./);
    assert.equal(para(await mailpit.mensajes(), b.email).length, 0);
  });

  // El cambio que propuso el titular (sin firmante elegido, el superadmin) y que ya tuvo su primer recordatorio el viernes:
  // el lunes lo puede auditar otro admin, pero no el titular (9.1). Devuelve al otro admin, que es quien lo recibiría.
  const cambioDelTitularYaRecordado = async () => {
    const titular = await crearUsuario('superadmin');
    const otro = await crearUsuario('admin');
    const id = await proponerCambio(titular.id, 'Cambio del titular');
    await query("UPDATE cambios_pendientes SET primer_recordatorio_at = '2026-10-16 14:00:00' WHERE id = ?", [id]);
    return otro;
  };

  it('un cambio en el canal nota no recibe recordatorio', async () => {
    await configurarNotas({ para_auditoria: 'auditoria@rpad.test' });
    const otro = await cambioDelTitularYaRecordado();
    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-19' });
    assert.equal(resultado.canal_nota, 1);
    assert.deepEqual(resultado.enviados, []);
    assert.equal(para(await mailpit.mensajes(), otro.email).length, 0);
  });

  // La nota de auditoría solo puede salir con el envío automático activo, la configuración completa y un Para de auditoría:
  // si no, el cambio sigue por recordatorio en lugar de quedar sin canal (9.1, condición 4)
  for (const [descripcion, configuracion] of [
    ['el envío automático está desactivado', { envio_activo: 0 }],
    ['no hay Para de auditoría', { para_auditoria: '' }],
    ['la configuración de las notas está incompleta', { para_externa: '' }]
  ]) {
    it(`si ${descripcion}, el cambio del titular sigue recibiendo el recordatorio`, async () => {
      await configurarNotas({ para_auditoria: 'auditoria@rpad.test', ...configuracion });
      const otro = await cambioDelTitularYaRecordado();
      const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-19' });
      assert.equal(resultado.canal_nota, 0);
      assert.deepEqual(resultado.enviados.map(e => e.email), [otro.email]);
      assert.equal(para(await mailpit.esperar(m => m.To.some(t => t.Address === otro.email)), otro.email).length, 1);
    });
  }

  it('si no se puede guardar el primer recordatorio de una persona, queda como error y siguen las demás', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    const c = await crearUsuario('admin');
    // a recibe el de b, b el de a y c los dos. La falla simulada rechaza el UPDATE que alcanza al cambio de b
    // (el de a y el de c); el de b (el email de b) se guarda bien
    const deA = await proponerCambio(a.id, 'Cambio de la primera persona');
    const deB = await proponerCambio(b.id, 'Cambio de la segunda persona');

    const resultado = await conFallaSimulada('UPDATE', `NEW.id = ${deB}`, () =>
      servicio.enviarCambiosPendientes({ hoy: '2026-10-16', ahora: '2026-10-16 14:00:00' }), 'cambios_pendientes');

    assert.deepEqual(resultado.enviados.map(e => e.email), [a.email, b.email, c.email]);
    assert.deepEqual(resultado.errores.map(e => e.admin), [a.username, c.username]);
    for (const e of resultado.errores) assert.match(e.error, /primer recordatorio.*Falla simulada/);
    // Los tres emails salieron, también el de c, que va después de la primera falla
    for (const persona of [a, b, c]) assert.equal(para(await mailpit.esperar(paraCasilla(persona.email)), persona.email).length, 1);
    assert.equal(await primerRecordatorio(deA), '2026-10-16 14:00:00');
    assert.equal(await primerRecordatorio(deB), null);
  });

  it('cuánto hace que está pendiente: singular con 1, plural con el resto, sin tilde en "dias" como el email anterior', () => {
    const casos = [
      [0, 'Hace 0 minutos'], [60, 'Hace 1 minuto'], [119, 'Hace 1 minuto'], [120, 'Hace 2 minutos'], [59 * 60, 'Hace 59 minutos'],
      [3600, 'Hace 1 hora'], [7199, 'Hace 1 hora'], [7200, 'Hace 2 horas'], [23 * 3600, 'Hace 23 horas'],
      [86400, 'Hace 1 dia'], [47 * 3600, 'Hace 1 dia'], [48 * 3600, 'Hace 2 dias'], [10 * 86400, 'Hace 10 dias']
    ];
    for (const [segundos, esperado] of casos) assert.equal(servicio.tiempoPendiente(segundos), esperado, `${segundos} segundos`);
  });

  it('el asunto cuenta los cambios de cada persona', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    await proponerCambio(a.id, 'Primer cambio');
    await proponerCambio(a.id, 'Segundo cambio');
    await servicio.enviarCambiosPendientes({ hoy: '2026-10-16' });
    const [mensaje] = await mailpit.esperar(m => m.To.some(t => t.Address === b.email));
    assert.equal(mensaje.Subject, asunto(2));
  });
});

describe('aviso a quien propone cuando ningún auditor está disponible (recordatorio de las 14:00)', () => {
  const licencia = (usuario, desde, hasta) =>
    query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuario.id, desde, hasta]);
  const avisoSinAuditores = async (id) => (await query(
    "SELECT DATE_FORMAT(aviso_sin_auditores_at, '%Y-%m-%d %H:%i:%s') AS f FROM cambios_pendientes WHERE id = ?", [id]
  ))[0].f;
  // El caso de la simulación, con fechas inventadas: el superadmin de licencia del 09/12 al 08/01 y el admin del 28/12 al
  // 13/01. Del lunes 28/12 al viernes 08/01 no hay ningún auditor disponible; el lunes 11/01 vuelve el superadmin
  const auditoresDeLicencia = async () => {
    const superadmin = await crearUsuario('superadmin');
    const admin = await crearUsuario('admin');
    await licencia(superadmin, '2026-12-09', '2027-01-08');
    await licencia(admin, '2026-12-28', '2027-01-13');
    return { superadmin, admin };
  };
  const CIERRE = 'Mientras tanto, el conjunto de datos sigue bloqueado para nuevas modificaciones. Apenas vuelva a haber un auditor disponible, le llega el recordatorio.';

  it('a la editora le llega un email y queda la fecha del aviso; al día siguiente no se repite', async () => {
    const { superadmin, admin } = await auditoresDeLicencia();
    const editora = await crearUsuario('editor');
    const id = await proponerCambio(editora.id, 'Alta sin auditor');

    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-12-28', ahora: '2026-12-28 14:00:00' });

    assert.deepEqual(resultado.sin_auditor, [{ usuario: editora.username, cambios: 1, hasta: '2027-01-11' }]);
    assert.deepEqual([resultado.enviados, resultado.errores], [[], []]);
    const mensajes = para(await mailpit.esperar(paraCasilla(editora.email)), editora.email);
    assert.equal(mensajes.length, 1);
    assert.equal(mensajes[0].Subject, '[RPAD] Tu cambio en Alta sin auditor queda sin auditor disponible hasta el 11/01/2027');
    const html = await mailpit.html(mensajes[0].ID);
    assert.ok(html.includes('Hasta el 11/01/2027 no hay ningún auditor disponible para revisar este cambio (los auditores están de licencia).'), html);
    assert.ok(html.includes(CIERRE), html);
    assert.match(html, /Alta sin auditor/);
    assert.equal(await avisoSinAuditores(id), '2026-12-28 14:00:00');
    for (const auditor of [superadmin, admin]) assert.equal(para(await mailpit.mensajes(), auditor.email).length, 0);

    await mailpit.vaciar();
    const siguiente = await servicio.enviarCambiosPendientes({ hoy: '2026-12-29', ahora: '2026-12-29 14:00:00' });
    assert.deepEqual([siguiente.sin_auditor, siguiente.errores], [[], []]);
    assert.equal(para(await mailpit.mensajes(), editora.email).length, 0);
    assert.equal(await avisoSinAuditores(id), '2026-12-28 14:00:00');
  });

  it('con varios cambios, un solo email con todos: el tipo, el conjunto de datos y la fecha de la propuesta', async () => {
    await auditoresDeLicencia();
    const editora = await crearUsuario('editor');
    const alta = await proponerCambio(editora.id, 'Primer alta sin auditor');
    const otra = await proponerCambio(editora.id, 'Segunda alta sin auditor');
    // Propuesta el 01/10/2026 a las 10:00 de Argentina
    await query('UPDATE cambios_pendientes SET created_at = FROM_UNIXTIME(?) WHERE id = ?', [Date.parse('2026-10-01T10:00:00-03:00') / 1000, alta]);
    // Un cambio reciente (menos de una hora) todavía no entra, como en el recordatorio
    await proponerCambio(editora.id, 'Alta recién propuesta', { haceMinutos: 10 });

    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-12-28', ahora: '2026-12-28 14:00:00' });

    assert.deepEqual(resultado.sin_auditor, [{ usuario: editora.username, cambios: 2, hasta: '2027-01-11' }]);
    const mensajes = para(await mailpit.esperar(paraCasilla(editora.email)), editora.email);
    assert.equal(mensajes.length, 1);
    assert.equal(mensajes[0].Subject, '[RPAD] 2 cambios tuyos quedan sin auditor disponible hasta el 11/01/2027');
    const html = await mailpit.html(mensajes[0].ID);
    assert.ok(html.includes('Hasta el 11/01/2027 no hay ningún auditor disponible para revisar estos cambios (los auditores están de licencia).'), html);
    assert.match(html, /Primer alta sin auditor[\s\S]*Segunda alta sin auditor/);
    assert.match(html, /CREAR/);
    assert.match(html, /Fecha de la propuesta: 01\/10\/2026/);
    assert.doesNotMatch(html, /Alta recién propuesta/);
    for (const id of [alta, otra]) assert.equal(await avisoSinAuditores(id), '2026-12-28 14:00:00');
  });

  it('si hay otro editor disponible, no hay aviso: el recordatorio le llega a ese editor, de respaldo', async () => {
    await auditoresDeLicencia();
    const editora = await crearUsuario('editor');
    const otro = await crearUsuario('editor');
    const id = await proponerCambio(editora.id, 'Alta con respaldo');

    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-12-28' });

    assert.deepEqual(resultado.enviados.map(e => [e.email, e.respaldo]), [[otro.email, true]]);
    assert.deepEqual(resultado.sin_auditor, []);
    assert.equal(para(await mailpit.esperar(paraCasilla(otro.email)), otro.email).length, 1);
    assert.equal(para(await mailpit.mensajes(), editora.email).length, 0);
    assert.equal(await avisoSinAuditores(id), null);
  });

  it('si quien propone está de licencia no se manda y queda sin fecha; le llega a su vuelta si sigue sin auditor', async () => {
    await auditoresDeLicencia();
    const editora = await crearUsuario('editor');
    await licencia(editora, '2026-12-28', '2026-12-30');
    const id = await proponerCambio(editora.id, 'Alta de quien está de licencia');

    let resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-12-28', ahora: '2026-12-28 14:00:00' });
    assert.deepEqual([resultado.sin_auditor, resultado.errores], [[], []]);
    assert.equal(para(await mailpit.mensajes(), editora.email).length, 0);
    assert.equal(await avisoSinAuditores(id), null);

    resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-12-31', ahora: '2026-12-31 14:00:00' });
    assert.deepEqual(resultado.sin_auditor, [{ usuario: editora.username, cambios: 1, hasta: '2027-01-11' }]);
    assert.equal(para(await mailpit.esperar(paraCasilla(editora.email)), editora.email).length, 1);
    assert.equal(await avisoSinAuditores(id), '2026-12-31 14:00:00');
  });

  it('si quien propone está inactivo o ya no tiene rol de auditoría o edición, no se manda', async () => {
    await auditoresDeLicencia();
    const inactiva = await crearUsuario('editor');
    const lectora = await crearUsuario('editor');
    const deInactiva = await proponerCambio(inactiva.id, 'Alta de una inactiva');
    const deLectora = await proponerCambio(lectora.id, 'Alta de una lectora');
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [inactiva.id]);
    await query("UPDATE usuarios SET rol = 'lector' WHERE id = ?", [lectora.id]);

    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-12-28' });

    assert.deepEqual([resultado.sin_auditor, resultado.errores], [[], []]);
    assert.equal(para(await mailpit.mensajes(), inactiva.email).length + para(await mailpit.mensajes(), lectora.email).length, 0);
    for (const id of [deInactiva, deLectora]) assert.equal(await avisoSinAuditores(id), null);
  });

  it('con un auditor disponible nada cambia: el recordatorio le llega a él y no hay aviso', async () => {
    const superadmin = await crearUsuario('superadmin');
    const admin = await crearUsuario('admin');
    await licencia(superadmin, '2026-12-09', '2027-01-08');
    const editora = await crearUsuario('editor');
    const id = await proponerCambio(editora.id, 'Alta con auditor');

    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-12-28' });

    assert.deepEqual(resultado.enviados.map(e => [e.email, e.respaldo]), [[admin.email, false]]);
    assert.deepEqual(resultado.sin_auditor, []);
    assert.equal(para(await mailpit.esperar(paraCasilla(admin.email)), admin.email).length, 1);
    assert.equal(para(await mailpit.mensajes(), editora.email).length, 0);
    assert.equal(await avisoSinAuditores(id), null);
  });

  it('errores: sin un email válido no se manda; si no se puede guardar la fecha, el email ya salió y queda el error', async () => {
    await auditoresDeLicencia();
    const sinEmail = await crearUsuario('editor');
    const editora = await crearUsuario('editor');
    await query("UPDATE usuarios SET email = 'no-es-un-email' WHERE id = ?", [sinEmail.id]);
    // Las dos editoras se respaldan entre sí: para que ninguna tenga quién audite, la otra está de licencia ese día
    const deSinEmail = await proponerCambio(sinEmail.id, 'Alta de quien no tiene email');
    await licencia(editora, '2026-12-28', '2026-12-28');
    let resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-12-28', ahora: '2026-12-28 14:00:00' });
    assert.deepEqual(resultado.errores, [{ admin: sinEmail.username, error: 'No tiene un email válido' }]);
    assert.deepEqual(resultado.sin_auditor, []);
    assert.equal(await avisoSinAuditores(deSinEmail), null);

    await query('DELETE FROM cambios_pendientes');
    await query('DELETE FROM usuarios_licencias WHERE usuario_id = ?', [editora.id]);
    await licencia(sinEmail, '2026-12-29', '2026-12-29');
    const deEditora = await proponerCambio(editora.id, 'Alta cuya fecha no se guarda');
    resultado = await conFallaSimulada('UPDATE', `NEW.id = ${deEditora}`, () =>
      servicio.enviarCambiosPendientes({ hoy: '2026-12-29', ahora: '2026-12-29 14:00:00' }), 'cambios_pendientes');
    assert.deepEqual(resultado.sin_auditor, [{ usuario: editora.username, cambios: 1, hasta: '2026-12-30' }]);
    assert.deepEqual(resultado.errores.map(e => e.admin), [editora.username]);
    assert.match(resultado.errores[0].error, /aviso.*Falla simulada/);
    assert.equal(para(await mailpit.esperar(paraCasilla(editora.email)), editora.email).length, 1);
    assert.equal(await avisoSinAuditores(deEditora), null);
  });

  it('si falla el cálculo del aviso, queda el error, los recordatorios ya salieron y el aviso se reintenta al día siguiente', async () => {
    await auditoresDeLicencia();
    const editora = await crearUsuario('editor');
    // Un cambio de alguien que ya no está activo: lo recibe la editora como respaldo, en el recordatorio
    const inactivo = await crearUsuario('admin');
    await proponerCambio(inactivo.id, 'Alta para el respaldo');
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [inactivo.id]);
    const id = await proponerCambio(editora.id, 'Alta cuyo aviso falla');
    // Falla la lectura de licencias desde mañana (el 29/12): la que hace proximoDiaConQuienAudite para el "hasta" del aviso
    const pool = (await import('../config/database.js')).default;
    const consultaOriginal = pool.query;
    const falla = mock.method(pool, 'query', function (sql, params) {
      if (String(sql).includes('usuarios_licencias') && params?.[1] === '2026-12-29') {
        return Promise.reject(new Error('Falla simulada'));
      }
      return consultaOriginal.call(this, sql, params);
    });
    let resultado;
    try {
      resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-12-28', ahora: '2026-12-28 14:00:00' });
    } finally {
      falla.mock.restore();
    }

    assert.deepEqual(resultado.enviados.map(e => [e.email, e.respaldo]), [[editora.email, true]]);
    assert.deepEqual(resultado.sin_auditor, []);
    assert.deepEqual(resultado.errores.map(e => e.admin), [editora.username]);
    assert.match(resultado.errores[0].error, /aviso sin auditor.*Falla simulada/);
    const recibidos = para(await mailpit.esperar(paraCasilla(editora.email)), editora.email);
    assert.deepEqual(recibidos.map(m => m.Subject), ['[RPAD] 1 cambio espera tu auditoría']);
    assert.equal(await avisoSinAuditores(id), null);

    // Al día siguiente, sin la falla, el aviso sale
    const siguiente = await servicio.enviarCambiosPendientes({ hoy: '2026-12-29', ahora: '2026-12-29 14:00:00' });
    assert.deepEqual(siguiente.sin_auditor, [{ usuario: editora.username, cambios: 1, hasta: '2027-01-11' }]);
    assert.equal(await avisoSinAuditores(id), '2026-12-29 14:00:00');
  });

  it('la plantilla: sin fecha de vuelta dice "por ahora", y todo dato va escapado', () => {
    const edicion = { tipo_cambio: 'editar', dataset_titulo: 'Padrón <b>raro</b>', datos_nuevos: { titulo: 'Otro título' }, fecha_propuesta: '2026-10-01' };
    const uno = templates.sinAuditorTemplate([edicion], { hasta: null });
    assert.equal(uno.subject, '[RPAD] Tu cambio en Padrón <b>raro</b> queda sin auditor disponible por ahora');
    assert.ok(uno.html.includes('Por ahora no hay ningún auditor disponible para revisar este cambio (los auditores están de licencia).'));
    assert.ok(uno.html.includes('Padrón &lt;b&gt;raro&lt;/b&gt;'));
    assert.ok(!uno.html.includes('<b>raro'));
    assert.ok(!uno.html.includes('Otro título'));
    const alta = { tipo_cambio: 'crear', dataset_titulo: null, datos_nuevos: { titulo: 'Alta nueva' }, fecha_propuesta: '2026-10-02' };
    const dos = templates.sinAuditorTemplate([edicion, alta], { hasta: null });
    assert.equal(dos.subject, '[RPAD] 2 cambios tuyos quedan sin auditor disponible por ahora');
    assert.ok(dos.html.includes('Por ahora no hay ningún auditor disponible para revisar estos cambios (los auditores están de licencia).'));
    assert.match(dos.html, /EDITAR[\s\S]*Fecha de la propuesta: 01\/10\/2026[\s\S]*CREAR[\s\S]*Alta nueva[\s\S]*Fecha de la propuesta: 02\/10\/2026/);
  });
});
