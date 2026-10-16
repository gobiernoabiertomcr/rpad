// El editor en el panel de usuarios y en lo que ya existía para él (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.2,
// 6.1, 6.2, 6.3, 8.1 y 8.3), contra una base de prueba propia. La API usa la fecha real: las licencias se arman desde hoy.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query, mailpit, paraCasilla
} from './helpers.js';
import { pngRgba } from './firma-fixtures.js';
import { hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';

const SOLO_LECTORES = 'Un editor solo puede crear y modificar usuarios lectores.';
const SIN_ROLES = 'Un editor no puede cambiar roles.';
const PROTEGIDA = 'Esta cuenta solo la modifica su titular.';
const MINIMO = 'No se puede: quedarían menos de 2 usuarios que puedan aprobar cambios.';
const FIRMANTE = 'Es el firmante titular de las Notas Digitales: primero hay que elegir a otra persona en Correos.';
const FIRMA_B64 = pngRgba({ ancho: 40, alto: 20 }).toString('base64');
let base, servidor, api, usuarios, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_editor_panel');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, {
    adminA: 'admin', adminB: 'admin', superadmin: 'superadmin', editor: 'editor', editor2: 'editor', lector: 'lector'
  });
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

// Cada prueba arranca igual: los usuarios base activos, con su rol y su email, sesiones nuevas, sin licencias, sin
// firmas y sin firmante titular. Los usuarios creados por otras pruebas quedan desactivados.
beforeEach(async () => {
  await mailpit.vaciar();
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios_firmas');
  await query('UPDATE notas_digitales_config SET firmante_usuario_id = NULL');
  const ids = Object.values(usuarios).map(u => u.id);
  await query('UPDATE usuarios SET activo = 0 WHERE id NOT IN (?)', [ids]);
  for (const u of Object.values(usuarios)) {
    await query('UPDATE usuarios SET activo = 1, rol = ?, email = ? WHERE id = ?', [u.rol, u.email, u.id]);
    u.token = await api.login(u.username, u.password);
  }
});

const como = (clave) => ({ token: usuarios[clave].token });
const sufijo = () => crypto.randomBytes(3).toString('hex');
const nuevo = (datos = {}) => {
  const s = sufijo();
  return { nombre_completo: 'Persona Nueva', username: `PNUEVA${s.toUpperCase()}`, email: `pnueva${s}@rpad.test`, rol: 'lector', ...datos };
};
const hoy = hoyArgentina();
const dia = (n) => sumarDias(hoy, n);

describe('lo que el editor puede (spec 8.1)', () => {
  it('entra a todo el área de administración: usuarios, historial, licencias, cambios, correos y su firma', async () => {
    for (const ruta of ['/usuarios', `/usuarios/${usuarios.adminA.id}`, '/usuarios/licencias', '/cambios-pendientes/para-revisar',
      '/cambios-pendientes/contador', '/notificaciones/notas-digitales/estado', '/notificaciones/notas-digitales/config',
      '/auth/profile/firma']) {
      assert.equal((await api.get(ruta, como('editor'))).status, 200, ruta);
    }
  });

  it('crea lectores, pero no admins ni editores', async () => {
    const lector = await api.post('/usuarios', nuevo(), como('editor'));
    assert.equal(lector.status, 201, JSON.stringify(lector.body));
    for (const rol of ['admin', 'editor']) {
      const res = await api.post('/usuarios', nuevo({ rol }), como('editor'));
      assert.equal(res.status, 403, rol);
      assert.equal(res.body.error, SOLO_LECTORES);
      assert.equal(res.body.campo, 'rol');
    }
  });

  it('edita, desactiva, reactiva y envía links a lectores', async () => {
    const id = usuarios.lector.id;
    assert.equal((await api.put(`/usuarios/${id}`, { cargo: 'Cargo nuevo' }, como('editor'))).status, 200);
    assert.equal((await api.put(`/usuarios/${id}`, { rol: 'lector' }, como('editor'))).status, 200);
    assert.equal((await api.post(`/usuarios/${id}/enviar-acceso`, {}, como('editor'))).status, 200);
    assert.equal((await api.post(`/usuarios/${id}/desactivar`, {}, como('editor'))).status, 200);
    assert.equal((await api.post(`/usuarios/${id}/reactivar`, {}, como('editor'))).status, 200);
  });
});

describe('lo que el editor no puede (spec 8.1)', () => {
  it('no modifica admins, editores (tampoco a sí mismo) ni al superadmin', async () => {
    for (const clave of ['adminA', 'editor2', 'editor']) {
      const id = usuarios[clave].id;
      const edicion = await api.put(`/usuarios/${id}`, { cargo: 'Otro cargo' }, como('editor'));
      assert.equal(edicion.status, 403, clave);
      assert.equal(edicion.body.error, SOLO_LECTORES, clave);
      assert.equal((await api.post(`/usuarios/${id}/enviar-acceso`, {}, como('editor'))).body.error, SOLO_LECTORES, clave);
    }
    assert.equal((await api.post(`/usuarios/${usuarios.adminA.id}/desactivar`, {}, como('editor'))).body.error, SOLO_LECTORES);
    assert.equal((await api.put(`/usuarios/${usuarios.superadmin.id}`, { cargo: 'Otro cargo' }, como('editor'))).body.error, PROTEGIDA);
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [usuarios.editor2.id]);
    assert.equal((await api.post(`/usuarios/${usuarios.editor2.id}/reactivar`, {}, como('editor'))).body.error, SOLO_LECTORES);
    const [admin] = await query('SELECT cargo, activo FROM usuarios WHERE id = ?', [usuarios.adminA.id]);
    assert.deepEqual([admin.cargo, admin.activo], [null, 1]);
  });

  it('no cambia roles: ni el de un lector ni el suyo', async () => {
    const ascenso = await api.put(`/usuarios/${usuarios.lector.id}`, { rol: 'admin' }, como('editor'));
    assert.equal(ascenso.status, 403);
    assert.equal(ascenso.body.error, SIN_ROLES);
    assert.equal((await api.put(`/usuarios/${usuarios.editor.id}`, { rol: 'admin' }, como('editor'))).status, 403);
    const roles = await query('SELECT id, rol FROM usuarios WHERE id IN (?) ORDER BY id', [[usuarios.lector.id, usuarios.editor.id]]);
    assert.deepEqual(roles.map(r => r.rol).sort(), ['editor', 'lector']);
  });
});

describe('mínimo de auditores y firmante titular (spec 6.2 y 8.3)', () => {
  it('un admin pasa a alguien a editor, y eso cuenta como quitar un auditor', async () => {
    const res = await api.put(`/usuarios/${usuarios.adminB.id}`, { rol: 'editor' }, como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.rol, 'editor');
    assert.equal((await api.get('/usuarios', como('adminA'))).body.data.resumen.aprobadores_activos, 2);
    const otro = await api.put(`/usuarios/${usuarios.adminA.id}`, { rol: 'editor' }, como('superadmin'));
    assert.equal(otro.status, 409);
    assert.equal(otro.body.error, MINIMO);
  });

  it('el firmante titular no pasa a editor ni a lector', async () => {
    await query('UPDATE notas_digitales_config SET firmante_usuario_id = ?', [usuarios.adminA.id]);
    for (const rol of ['editor', 'lector']) {
      const res = await api.put(`/usuarios/${usuarios.adminA.id}`, { rol }, como('superadmin'));
      assert.equal(res.status, 409, rol);
      assert.equal(res.body.error, FIRMANTE);
    }
    assert.equal((await query('SELECT rol FROM usuarios WHERE id = ?', [usuarios.adminA.id]))[0].rol, 'admin');
  });
});

describe('avisos al superadmin (spec 8.1, último punto)', () => {
  const avisos = () => mailpit.esperar(
    m => m.Subject === 'RPAD: cambio en los usuarios' && paraCasilla(usuarios.superadmin.email)(m), { intentos: 20 }
  );

  it('cubren a los editores: alta, cambio de email y reactivación', async () => {
    assert.equal((await api.post('/usuarios', nuevo({ rol: 'editor' }), como('adminA'))).status, 201);
    assert.match(await mailpit.html((await avisos())[0].ID), /Alta como Editor/);

    await mailpit.vaciar();
    assert.equal((await api.put(`/usuarios/${usuarios.editor2.id}`, { email: `editor2-${sufijo()}@rpad.test` }, como('adminA'))).status, 200);
    assert.match(await mailpit.html((await avisos())[0].ID), /Email:/);

    await mailpit.vaciar();
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [usuarios.editor2.id]);
    assert.equal((await api.post(`/usuarios/${usuarios.editor2.id}/reactivar`, {}, como('adminA'))).status, 200);
    assert.match(await mailpit.html((await avisos())[0].ID), /Reactivado/);
  });
});

describe('licencias y firma del editor (spec 5.2, 6.1, 6.2 y 6.3, "desde la entrega 3")', () => {
  it('carga licencias, puede tener una, carga su firma y puede ser la persona autorizada, pero no firmante titular', async () => {
    const deOtro = await api.post('/usuarios/licencias', { usuario_id: usuarios.adminB.id, desde: dia(5), hasta: dia(10) }, como('editor'));
    assert.equal(deOtro.status, 201, JSON.stringify(deOtro.body));
    const propia = await api.post('/usuarios/licencias', { usuario_id: usuarios.editor.id, desde: dia(5), hasta: dia(10) }, como('adminA'));
    assert.equal(propia.status, 201, JSON.stringify(propia.body));

    const firma = await api.put('/auth/profile/firma', { nombre: 'Firma Editora', cargo: 'Cargo Editora', imagen: FIRMA_B64, mime: 'image/png' }, como('editor2'));
    assert.equal(firma.status, 200, JSON.stringify(firma.body));
    await api.put('/auth/profile/firma', { nombre: 'Firma Super', cargo: 'Cargo Super', imagen: FIRMA_B64, mime: 'image/png' }, como('superadmin'));
    await query('UPDATE notas_digitales_config SET firmante_usuario_id = ?', [usuarios.superadmin.id]);
    const autorizada = await api.post('/usuarios/licencias',
      { usuario_id: usuarios.superadmin.id, desde: dia(20), hasta: dia(25), autorizado_id: usuarios.editor2.id }, como('superadmin'));
    assert.equal(autorizada.status, 201, JSON.stringify(autorizada.body));
    assert.equal(autorizada.body.data.autorizado_id, usuarios.editor2.id);

    const firmantes = (await api.get('/notificaciones/notas-digitales/config/firmantes', como('superadmin'))).body.data;
    assert.ok(!firmantes.some(f => f.id === usuarios.editor2.id));
    assert.equal((await api.put('/notificaciones/notas-digitales/config/firmante', { usuario_id: usuarios.editor2.id }, como('superadmin'))).status, 400);
  });
});
