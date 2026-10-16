// Avisos al superadmin durante su licencia (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.3 y 5.4),
// con fechas fijas sobre una base de prueba + Mailpit
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query, mailpit } from './helpers.js';
import { asegurarBaseDePrueba } from './notas-fixtures.js';

let base, servicio, dbReal, superadmin, admin, lector;
const ASUNTO_AVISO = 'RPAD: cambio en los usuarios';
const ASUNTO_RESUMEN = 'RPAD: cambios en los usuarios durante tu licencia';

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_avisos_superadmin');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  servicio = await import('../services/avisosSuperadminService.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

const crearUsuario = async (rol) => {
  const username = `t_${rol}_${crypto.randomBytes(3).toString('hex')}`;
  const r = await query(
    "INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES (?, 'x', ?, ?, ?, 1)",
    [username, `Persona ${rol}`, `${username}@rpad.test`, rol]
  );
  return { id: r.insertId, username, email: `${username}@rpad.test`, nombre_completo: `Persona ${rol}`, rol };
};

beforeEach(async () => {
  await asegurarBaseDePrueba();
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios_auditoria');
  await query('DELETE FROM usuarios');
  superadmin = await crearUsuario('superadmin');
  admin = await crearUsuario('admin');
  lector = await crearUsuario('lector');
  await mailpit.vaciar();
});

const deLicencia = (usuario, desde, hasta) =>
  query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuario.id, desde, hasta]);
const filaDeAuditoria = async () => (await query(
  "INSERT INTO usuarios_auditoria (usuario_id, actor_id, accion, detalle) VALUES (?, ?, 'desactivacion', NULL)", [lector.id, admin.id]
)).insertId;
const avisos = async (asunto) => (await mailpit.mensajes()).filter(m => m.Subject === asunto);
const esperarUnPoco = () => new Promise(r => setTimeout(r, 300));

describe('aviso al superadmin', () => {
  it('sin licencia le llega como siempre y no queda nada retenido', async () => {
    const auditoriaId = await filaDeAuditoria();
    await servicio.avisarAlSuperadmin({ actor: admin, afectado: lector, cambio: 'Desactivado', auditoriaId, hoy: '2026-11-10' });
    const [aviso] = await mailpit.esperar(m => m.Subject === ASUNTO_AVISO);
    assert.deepEqual(aviso.To.map(t => t.Address), [superadmin.email]);
    const [fila] = await query('SELECT aviso_retenido FROM usuarios_auditoria WHERE id = ?', [auditoriaId]);
    assert.equal(fila.aviso_retenido, null);
  });

  it('de licencia no le llega: el texto queda retenido en la fila del historial', async () => {
    await deLicencia(superadmin, '2026-11-01', '2026-11-20');
    const auditoriaId = await filaDeAuditoria();
    await servicio.avisarAlSuperadmin({ actor: admin, afectado: lector, cambio: 'Desactivado', auditoriaId, hoy: '2026-11-10' });
    await esperarUnPoco();
    assert.equal((await avisos(ASUNTO_AVISO)).length, 0);
    const [fila] = await query('SELECT aviso_retenido FROM usuarios_auditoria WHERE id = ?', [auditoriaId]);
    assert.equal(fila.aviso_retenido, 'Desactivado');
  });

  it('un cambio del propio superadmin no genera aviso ni retención', async () => {
    await deLicencia(superadmin, '2026-11-01', '2026-11-20');
    const auditoriaId = await filaDeAuditoria();
    await servicio.avisarAlSuperadmin({ actor: superadmin, afectado: lector, cambio: 'Desactivado', auditoriaId, hoy: '2026-11-10' });
    const [fila] = await query('SELECT aviso_retenido FROM usuarios_auditoria WHERE id = ?', [auditoriaId]);
    assert.equal(fila.aviso_retenido, null);
  });
});

describe('resumen de avisos retenidos (spec 5.4)', () => {
  const retener = async (cambio) => {
    const auditoriaId = await filaDeAuditoria();
    await query('UPDATE usuarios_auditoria SET aviso_retenido = ? WHERE id = ?', [cambio, auditoriaId]);
    return auditoriaId;
  };

  it('a la vuelta, en un día hábil, llega un solo email con todos y dejan de estar retenidos', async () => {
    await deLicencia(superadmin, '2026-11-01', '2026-11-20');
    await retener('Desactivado');
    await retener('Lector → Administrador');
    const resultado = await servicio.enviarResumenAvisosRetenidos({ hoy: '2026-11-23' });
    assert.deepEqual(resultado, { enviado: true, cantidad: 2 });
    const [resumen, ...otros] = await mailpit.esperar(m => m.Subject === ASUNTO_RESUMEN);
    assert.equal(otros.length, 0);
    assert.deepEqual(resumen.To.map(t => t.Address), [superadmin.email]);
    const html = await mailpit.html(resumen.ID);
    assert.match(html, /Desactivado/);
    assert.match(html, /Lector → Administrador/);
    assert.match(html, /Persona admin/);
    assert.equal((await query('SELECT COUNT(*) AS n FROM usuarios_auditoria WHERE aviso_retenido IS NOT NULL'))[0].n, 0);
    assert.deepEqual(await servicio.enviarResumenAvisosRetenidos({ hoy: '2026-11-24' }), { enviado: false, cantidad: 0 });
  });

  it('el texto concuerda con la cantidad: "te habría llegado" con un cambio, "te habrían llegado" con varios', async () => {
    const { resumenAvisosRetenidosTemplate } = await import('../services/emailTemplates.js');
    const fila = { created_at: '2026-11-10T13:00:00Z', actor_nombre: 'Persona admin', actor_username: 'padmin', afectado_nombre: 'Persona lector', afectado_username: 'plector', cambio: 'Desactivado' };
    const uno = resumenAvisosRetenidosTemplate([fila]);
    for (const texto of [uno.html, uno.text]) assert.ok(texto.includes('hubo un cambio que te habría llegado como aviso:'));
    const dos = resumenAvisosRetenidosTemplate([fila, fila]);
    for (const texto of [dos.html, dos.text]) assert.ok(texto.includes('hubo 2 cambios que te habrían llegado como aviso:'));
  });

  it('mientras sigue de licencia, o en un día no hábil, no se envía y quedan retenidos', async () => {
    await deLicencia(superadmin, '2026-11-01', '2026-11-20');
    await retener('Desactivado');
    assert.deepEqual(await servicio.enviarResumenAvisosRetenidos({ hoy: '2026-11-19' }), { enviado: false, cantidad: 1 });
    assert.deepEqual(await servicio.enviarResumenAvisosRetenidos({ hoy: '2026-11-21' }), { enviado: false, cantidad: 0 });
    await esperarUnPoco();
    assert.equal((await avisos(ASUNTO_RESUMEN)).length, 0);
    assert.equal((await query('SELECT COUNT(*) AS n FROM usuarios_auditoria WHERE aviso_retenido IS NOT NULL'))[0].n, 1);
  });
});
