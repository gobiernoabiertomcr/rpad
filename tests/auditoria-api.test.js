// Quién aprueba o rechaza un cambio pendiente (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.2): la regla de respaldo
// del editor y, con auditores disponibles, la auditoría sin responsabilidad de los cambios de un auditor (spec
// 2026-10-20-editor-sin-responsabilidad), contra una base de prueba propia. La API usa la fecha real: las licencias se arman
// desde hoy.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { crearDataset, limpiarBase } from './notas-fixtures.js';
import { hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';
import { MENSAJE_SITUACION_CAMBIADA } from '../services/auditoriaReglas.js';

// Los auditores disponibles cuando propone adminA, por nombre: "Test adminB" y "Test superadmin"
const AVISO = 'Este cambio lo auditan Test adminB y Test superadmin. Si lo aprobás o lo rechazás vos, queda registrado sin responsabilidad por la auditoría.';
// Los auditores disponibles cuando propone un editor
const MENSAJE_CAMBIO_DE_EDITOR = 'Este cambio lo auditan Test adminA, Test adminB y Test superadmin. Podés auditarlo solo si ninguno está disponible.';
const hoy = hoyArgentina();
let base, servidor, api, usuarios, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_auditoria_api');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, {
    adminA: 'admin', adminB: 'admin', superadmin: 'superadmin', editor: 'editor', editor2: 'editor'
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

beforeEach(async () => {
  await limpiarBase();
  await query('DELETE FROM cambios_pendientes');
  await query('DELETE FROM usuarios_licencias');
});

const como = (clave) => ({ token: usuarios[clave].token });
// De licencia desde ayer hasta mañana
const deLicenciaHoy = (...claves) => Promise.all(claves.map(clave => query(
  'INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuarios[clave].id, sumarDias(hoy, -1), sumarDias(hoy, 1)]
)));
// Una baja propuesta por esa persona, sobre un dataset de prueba
const proponerBaja = async (clave) => {
  const datasetId = await crearDataset({ titulo: `Dataset auditado ${crypto.randomBytes(3).toString('hex')}`, vencimiento: '2027-06-30' });
  return (await query(
    `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, datos_anteriores, usuario_id)
     VALUES ('eliminar', ?, '{"eliminado":true}', '{"titulo":"Dataset auditado"}', ?)`,
    [datasetId, usuarios[clave].id]
  )).insertId;
};
// cuerpo: lo que la persona confirmó ({ sin_responsabilidad }); sin él, como lo manda quien no audita sin responsabilidad
const aprobar = (id, clave, cuerpo = {}) => api.post(`/cambios-pendientes/${id}/aprobar`, cuerpo, como(clave));
const rechazar = (id, clave, cuerpo = {}) =>
  api.post(`/cambios-pendientes/${id}/rechazar`, { comentario: 'No coincide con lo informado', ...cuerpo }, como(clave));
const fila = async (id) => (await query(
  'SELECT estado, revisor_id, revisado_como_respaldo, revisado_sin_responsabilidad FROM cambios_pendientes WHERE id = ?', [id]
))[0];
const PENDIENTE = { estado: 'pendiente', revisor_id: null, revisado_como_respaldo: 0, revisado_sin_responsabilidad: 0 };

describe('regla de respaldo al aprobar y rechazar (spec 8.2)', () => {
  it('el editor propone cambios como cualquier admin (spec 8.1) y los audita un auditor, sin marca de respaldo', async () => {
    const datasetId = await crearDataset({ titulo: 'Dataset que propone el editor', vencimiento: '2027-06-30' });
    const baja = await api.delete(`/datasets/${datasetId}`, como('editor'));
    assert.equal(baja.status, 200, JSON.stringify(baja.body));
    const id = baja.body.data.cambio_pendiente_id;
    assert.equal((await aprobar(id, 'adminA')).status, 200);
    assert.deepEqual(await fila(id), { estado: 'aprobado', revisor_id: usuarios.adminA.id, revisado_como_respaldo: 0, revisado_sin_responsabilidad: 0 });
  });

  it('con auditores disponibles, el editor aprueba sin responsabilidad el cambio de un auditor; Mis cambios lo muestra', async () => {
    const id = await proponerBaja('adminA');
    const res = await aprobar(id, 'editor', { sin_responsabilidad: true });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(await fila(id),
      { estado: 'aprobado', revisor_id: usuarios.editor.id, revisado_como_respaldo: 0, revisado_sin_responsabilidad: 1 });
    const mios = (await api.get('/cambios-pendientes/mis-cambios', como('adminA'))).body.data;
    assert.equal(mios.find(c => c.id === id).revisado_sin_responsabilidad, 1);
  });

  it('el rechazo sin responsabilidad también queda marcado', async () => {
    const id = await proponerBaja('adminA');
    assert.equal((await rechazar(id, 'editor2', { sin_responsabilidad: true })).status, 200);
    assert.deepEqual(await fila(id),
      { estado: 'rechazado', revisor_id: usuarios.editor2.id, revisado_como_respaldo: 0, revisado_sin_responsabilidad: 1 });
  });

  it('sin confirmar que es sin responsabilidad (sin el campo, en false o con algo que no es true), 409 y sigue pendiente', async () => {
    const id = await proponerBaja('adminA');
    for (const cuerpo of [{}, { sin_responsabilidad: false }, { sin_responsabilidad: 'true' }, { sin_responsabilidad: 1 }]) {
      for (const pedir of [aprobar, rechazar]) {
        const res = await pedir(id, 'editor', cuerpo);
        assert.equal(res.status, 409, JSON.stringify(cuerpo));
        assert.equal(res.body.error, MENSAJE_SITUACION_CAMBIADA);
      }
    }
    assert.deepEqual(await fila(id), PENDIENTE);
  });

  it('el cambio de un editor, con auditores disponibles, sigue siendo de los auditores: 403 para otro editor, con sus nombres', async () => {
    const id = await proponerBaja('editor');
    for (const pedir of [aprobar, rechazar]) {
      const res = await pedir(id, 'editor2', { sin_responsabilidad: true });
      assert.equal(res.status, 403);
      assert.equal(res.body.error, MENSAJE_CAMBIO_DE_EDITOR);
    }
    assert.deepEqual(await fila(id), PENDIENTE);
  });

  it('de respaldo, confirmar "sin responsabilidad" da 409 (quedaría con responsabilidad sin haberlo visto); sin el campo, aprueba', async () => {
    await deLicenciaHoy('adminB', 'superadmin');
    const id = await proponerBaja('adminA');
    const res = await aprobar(id, 'editor', { sin_responsabilidad: true });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, MENSAJE_SITUACION_CAMBIADA);
    assert.deepEqual(await fila(id), PENDIENTE);
    assert.equal((await aprobar(id, 'editor')).status, 200);
    assert.deepEqual(await fila(id),
      { estado: 'aprobado', revisor_id: usuarios.editor.id, revisado_como_respaldo: 1, revisado_sin_responsabilidad: 0 });
  });

  it('un auditor que manda "sin responsabilidad" recibe 409', async () => {
    const id = await proponerBaja('adminA');
    const res = await aprobar(id, 'adminB', { sin_responsabilidad: true });
    assert.equal(res.status, 409);
    assert.deepEqual(await fila(id), PENDIENTE);
  });

  it('un auditor aprueba sin marca de respaldo, también si ese día está de licencia (Decisiones del plan 1)', async () => {
    await deLicenciaHoy('adminB');
    const id = await proponerBaja('adminA');
    assert.equal((await aprobar(id, 'adminB')).status, 200);
    assert.deepEqual(await fila(id), { estado: 'aprobado', revisor_id: usuarios.adminB.id, revisado_como_respaldo: 0, revisado_sin_responsabilidad: 0 });
  });

  it('sin auditores disponibles, un editor aprueba de respaldo y queda marcado; Mis cambios lo muestra', async () => {
    await deLicenciaHoy('adminB', 'superadmin');
    const id = await proponerBaja('adminA');
    assert.equal((await aprobar(id, 'editor')).status, 200);
    assert.deepEqual(await fila(id), { estado: 'aprobado', revisor_id: usuarios.editor.id, revisado_como_respaldo: 1, revisado_sin_responsabilidad: 0 });
    const mios = (await api.get('/cambios-pendientes/mis-cambios', como('adminA'))).body.data;
    assert.equal(mios.find(c => c.id === id).revisado_como_respaldo, 1);
  });

  it('el rechazo de respaldo también queda marcado', async () => {
    await deLicenciaHoy('adminB', 'superadmin');
    const id = await proponerBaja('adminA');
    assert.equal((await rechazar(id, 'editor2')).status, 200);
    assert.deepEqual(await fila(id), { estado: 'rechazado', revisor_id: usuarios.editor2.id, revisado_como_respaldo: 1, revisado_sin_responsabilidad: 0 });
  });

  it('un editor nunca audita su propio cambio, haya o no auditores disponibles; otro editor sí', async () => {
    const id = await proponerBaja('editor');
    const propios = async () => {
      for (const [pedir, accion] of [[aprobar, 'aprobar'], [rechazar, 'rechazar']]) {
        const res = await pedir(id, 'editor');
        assert.equal(res.status, 403);
        assert.equal(res.body.error, `No puede ${accion} sus propios cambios`);
      }
    };
    // Con auditores disponibles el mensaje es el del cambio propio y no el de los nombres de los auditores: el control
    // "no el propio" va antes que la regla de respaldo
    await propios();
    await deLicenciaHoy('adminA', 'adminB', 'superadmin');
    await propios();
    assert.deepEqual(await fila(id), PENDIENTE);
    assert.equal((await aprobar(id, 'editor2')).status, 200);
    assert.equal((await fila(id)).revisado_como_respaldo, 1);
  });
});

describe('detalle del cambio para Mi Perfil (spec 8.2)', () => {
  it('dice si quien mira puede auditarlo, si es sin responsabilidad y, si no puede, por qué', async () => {
    const id = await proponerBaja('adminA');
    const auditoriaDe = async (clave) => (await api.get(`/cambios-pendientes/${id}`, como(clave))).body.data.auditoria;
    assert.deepEqual(await auditoriaDe('editor'), { puede: true, respaldo: false, sin_responsabilidad: true, mensaje: AVISO });
    assert.deepEqual(await auditoriaDe('adminB'), { puede: true, respaldo: false, sin_responsabilidad: false, mensaje: null });
    assert.deepEqual(await auditoriaDe('adminA'), { puede: false, respaldo: false, sin_responsabilidad: false, mensaje: null });
    await deLicenciaHoy('adminB', 'superadmin');
    assert.deepEqual(await auditoriaDe('editor'), { puede: true, respaldo: true, sin_responsabilidad: false, mensaje: null });
  });
});
