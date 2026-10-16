// Firma de cada usuario en Mi Perfil y firmante titular de las notas (spec 2026-10-15-dias-habiles-licencias-auditoria, 6.1
// y 6.2), contra una base de prueba propia
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { pngRgba } from './firma-fixtures.js';

const FIRMA = pngRgba({ ancho: 40, alto: 20 });
const FIRMA_B64 = FIRMA.toString('base64');
let base, servidor, api, usuarios, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_firmas');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api);
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
  await query('DELETE FROM usuarios_firmas');
  await query("UPDATE notas_digitales_config SET firmante_usuario_id = NULL, envio_activo = 0, firma_nombre = 'Firma de Correos', firma_cargo = 'Cargo de Correos', firma_imagen = NULL");
});

const como = (u) => ({ token: usuarios[u].token });
const guardar = (cuerpo, u = 'adminA') => api.put('/auth/profile/firma', cuerpo, como(u));

describe('Mi firma', () => {
  it('sin firma cargada propone el nombre y el cargo del usuario', async () => {
    const res = await api.get('/auth/profile/firma', como('adminA'));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { cargada: false, nombre: 'Test adminA', cargo: '', tiene_imagen: false });
  });

  it('guarda nombre, cargo e imagen; después cambia los textos sin perder la imagen', async () => {
    const res = await guardar({ nombre: 'Téc. Nombre Apellido', cargo: 'Director de Prueba', imagen: FIRMA_B64, mime: 'image/png' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await guardar({ nombre: 'Téc. Nombre Apellido', cargo: 'Otro cargo' })).status, 200);
    const firma = await api.get('/auth/profile/firma', como('adminA'));
    assert.deepEqual(firma.body.data, { cargada: true, nombre: 'Téc. Nombre Apellido', cargo: 'Otro cargo', tiene_imagen: true });
    const imagen = await api.get('/auth/profile/firma/imagen', como('adminA'));
    assert.equal(imagen.status, 200);
    assert.ok(Buffer.compare(imagen.body, FIRMA) === 0);
  });

  it('nadie ve ni cambia la firma de otro: cada uno trabaja sobre la suya', async () => {
    await guardar({ nombre: 'Firma A', cargo: 'Cargo A', imagen: FIRMA_B64, mime: 'image/png' });
    assert.equal((await api.get('/auth/profile/firma/imagen', como('adminB'))).status, 404);
  });

  it('textos obligatorios; una tilde descompuesta se guarda en NFC; un carácter que el PDF no escribe se rechaza', async () => {
    assert.equal((await guardar({ nombre: '', cargo: 'Cargo' })).body.campo, 'nombre');
    assert.equal((await guardar({ nombre: 'Nombre', cargo: '   ' })).body.campo, 'cargo');
    const nfd = 'Téc. Nombre';
    assert.equal((await guardar({ nombre: nfd, cargo: 'Cargo' })).status, 200);
    assert.equal((await query('SELECT nombre FROM usuarios_firmas WHERE usuario_id = ?', [usuarios.adminA.id]))[0].nombre, 'Téc. Nombre');
    const res = await guardar({ nombre: 'Nombre ☎', cargo: 'Cargo' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /☎/);
  });

  it('una imagen inválida responde 400 con el mismo mensaje que la firma de Correos', async () => {
    const res = await guardar({ nombre: 'N', cargo: 'C', imagen: 'no es base64!', mime: 'image/png' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'La imagen no es base64 válido');
    assert.equal((await guardar({ nombre: 'N', cargo: 'C', imagen: FIRMA_B64, mime: 'image/gif' })).body.error, 'La firma debe ser una imagen PNG o JPEG');
  });

  it('un lector no tiene firma', async () => {
    assert.equal((await api.get('/auth/profile/firma', como('lector'))).status, 403);
  });
});

describe('firmante titular (spec 6.2)', () => {
  it('solo el superadmin lo elige, entre superadmin y admins con firma', async () => {
    await guardar({ nombre: 'Firma Super', cargo: 'Cargo Super', imagen: FIRMA_B64, mime: 'image/png' }, 'superadmin');
    const candidatos = await api.get('/notificaciones/notas-digitales/config/firmantes', como('adminA'));
    assert.deepEqual(candidatos.body.data.map(c => c.id), [usuarios.superadmin.id]);

    const porAdmin = await api.put('/notificaciones/notas-digitales/config/firmante', { usuario_id: usuarios.superadmin.id }, como('adminA'));
    assert.equal(porAdmin.status, 403);
    assert.equal(porAdmin.body.error, 'Solo el superadmin elige al firmante titular.');
    assert.equal((await api.put('/notificaciones/notas-digitales/config/firmante', { usuario_id: usuarios.adminB.id }, como('superadmin'))).status, 400);

    const res = await api.put('/notificaciones/notas-digitales/config/firmante', { usuario_id: usuarios.superadmin.id }, como('superadmin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.firmante, {
      id: usuarios.superadmin.id, nombre_completo: 'Test superadmin', nombre: 'Firma Super', cargo: 'Cargo Super', tiene_imagen: true
    });
    assert.equal(res.body.data.tiene_firma, true);
  });

  it('con firmante elegido, la imagen de la firma de Correos es la suya y la de Correos ya no se carga', async () => {
    await guardar({ nombre: 'Firma Super', cargo: 'Cargo Super', imagen: FIRMA_B64, mime: 'image/png' }, 'superadmin');
    await query('UPDATE notas_digitales_config SET firmante_usuario_id = ?', [usuarios.superadmin.id]);
    const imagen = await api.get('/notificaciones/notas-digitales/config/firma', como('adminA'));
    assert.equal(imagen.status, 200);
    assert.ok(Buffer.compare(imagen.body, FIRMA) === 0);
    const subir = await api.put('/notificaciones/notas-digitales/config/firma', { imagen: FIRMA_B64, mime: 'image/png' }, como('adminA'));
    assert.equal(subir.status, 409);
    assert.equal(subir.body.error, 'Con un firmante titular elegido, la firma se carga en su Mi Perfil.');
  });

  it('sin firmante elegido, todo como antes: la firma de Correos se sube y la config no trae firmante', async () => {
    const subir = await api.put('/notificaciones/notas-digitales/config/firma', { imagen: FIRMA_B64, mime: 'image/png' }, como('adminA'));
    assert.equal(subir.status, 200);
    const config = await api.get('/notificaciones/notas-digitales/config', como('adminA'));
    assert.equal(config.body.data.firmante, null);
    assert.equal(config.body.data.tiene_firma, true);
  });

  it('volver a "nadie" se rechaza si el envío está activo y la firma de Correos está incompleta', async () => {
    await guardar({ nombre: 'Firma Super', cargo: 'Cargo Super' }, 'superadmin');
    await query("UPDATE notas_digitales_config SET firmante_usuario_id = ?, envio_activo = 1, firma_nombre = '', para_interna = 'mit@rpad.test', para_externa = 'mit@rpad.test'", [usuarios.superadmin.id]);
    const res = await api.put('/notificaciones/notas-digitales/config/firmante', { usuario_id: null }, como('superadmin'));
    assert.equal(res.status, 400);
    assert.match(res.body.error, /nombre de la firma/);
  });
});
