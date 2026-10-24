// API del Seguimiento (spec 2026-10-20-seguimiento-dataset): la ven todos los roles con sesión, incluido el lector; sin
// sesión, 401. Un id que no es un entero positivo o que no existe da 404 en JSON, nunca 500. Contra una base de prueba propia.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { crearArea, crearDataset, crearEmailViejo, limpiarBase, asegurarBaseDePrueba } from './notas-fixtures.js';
import { lineasPorHoja } from './pdf-lector.js';
import { hoyArgentina } from '../services/notasDigitalesCalendario.js';

let base, servidor, api, usuarios, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_seguimiento_api');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, { adminA: 'admin', lector: 'lector', colab: 'colaborador', colab2: 'colaborador' });
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

let datasetId;
beforeEach(async () => {
  await limpiarBase();
  const areaId = await crearArea({ nombre: 'Área del seguimiento' });
  datasetId = await crearDataset({ titulo: 'Dataset del seguimiento', areaId, vencimiento: '2027-06-30', gestion: 'externa' });
  await crearEmailViejo({ tipo: 'externo-60', datasetIds: [datasetId], enviado: '2026-04-30 08:00:00' });
});

const como = (clave) => ({ token: usuarios[clave].token });

describe('GET /seguimiento (la lista)', () => {
  it('el lector la ve, con una fila por dataset', async () => {
    const res = await api.get('/seguimiento', como('lector'));
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    const fila = res.body.data.find((f) => f.id === datasetId);
    assert.ok(fila, 'el dataset está en la lista');
    assert.equal(fila.titulo, 'Dataset del seguimiento');
    assert.equal(fila.area, 'Área del seguimiento');
    assert.equal(fila.activo, true);
    assert.equal(fila.proxima, '2027-06-30');
    assert.equal(typeof fila.estado, 'string');
    assert.equal(typeof fila.avisos.total, 'number');
    assert.equal(typeof fila.pendiente, 'boolean');
  });

  it('también incluye a los datasets dados de baja', async () => {
    const baja = await crearDataset({ titulo: 'Dataset dado de baja', vencimiento: '2027-06-30', activo: 0 });
    const res = await api.get('/seguimiento', como('lector'));
    assert.equal(res.status, 200);
    const fila = res.body.data.find((f) => f.id === baja);
    assert.ok(fila);
    assert.equal(fila.activo, false);
  });

  it('un admin la ve igual', async () => {
    const res = await api.get('/seguimiento', como('adminA'));
    assert.equal(res.status, 200);
    assert.ok(res.body.data.some((f) => f.id === datasetId));
  });
});

describe('GET /seguimiento/:id (el detalle)', () => {
  it('el lector ve el seguimiento completo, con el registro desde el 06/12/2025', async () => {
    const res = await api.get(`/seguimiento/${datasetId}`, como('lector'));
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const data = res.body.data;
    assert.equal(data.ficha.titulo, 'Dataset del seguimiento');
    assert.equal(data.registro.envios, '2025-12-06');
    assert.equal(data.registro.cambios, '2026-01-26');
    for (const clave of ['ficha', 'circuito', 'cinta', 'movimientos', 'hitos', 'registro']) {
      assert.ok(clave in data, `trae ${clave}`);
    }
    assert.ok(Array.isArray(data.movimientos));
    assert.ok(data.movimientos.some((m) => m.tipo === 'email'), 'el email está entre los movimientos');
  });

  it('un admin lo ve igual', async () => {
    const res = await api.get(`/seguimiento/${datasetId}`, como('adminA'));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.ficha.titulo, 'Dataset del seguimiento');
  });

  it('el dataset dado de baja también se puede ver', async () => {
    const baja = await crearDataset({ titulo: 'Dataset dado de baja', vencimiento: '2027-06-30', activo: 0 });
    const res = await api.get(`/seguimiento/${baja}`, como('lector'));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.ficha.activo, false);
  });

  it('un email que no se pudo enviar: el lector no recibe el texto técnico del error y administración sí', async () => {
    for (const [tipo, enviado, error] of [['externo-40', '2026-05-20 08:00:00', 'connect ECONNREFUSED 127.0.0.1:587'],
      ['area-aviso-40', '2026-05-21 08:00:00', 'Greeting never received']]) {
      await query(`INSERT INTO notificaciones_log (tipo, area_id, destinatarios, datasets_ids, cantidad_datasets, enviado_at, success, error_message)
        VALUES (?, NULL, 'mit@rpad.test', ?, 1, ?, 0, ?)`, [tipo, String(datasetId), enviado, error]);
    }
    const fallidos = (res) => res.body.data.movimientos.filter((m) => (m.tipo === 'email' || m.tipo === 'area') && m.extra.success === false)
      .map((m) => [m.tipo, m.detalle, m.extra.error]).sort();
    const lector = await api.get(`/seguimiento/${datasetId}`, como('lector'));
    assert.equal(lector.status, 200);
    assert.deepEqual(fallidos(lector), [['area', 'No se pudo enviar.', null], ['email', 'No se pudo enviar.', null]]);
    const admin = await api.get(`/seguimiento/${datasetId}`, como('adminA'));
    assert.equal(admin.status, 200);
    assert.deepEqual(fallidos(admin), [['area', 'No se pudo enviar.', 'Greeting never received'],
      ['email', 'No se pudo enviar.', 'connect ECONNREFUSED 127.0.0.1:587']]);
  });

  // Review Focus 1: un id inválido o inexistente da 404 en JSON, nunca 500
  for (const id of ['abc', '0', '-3', '999999', '1.5', '1e3', '00', '12abc']) {
    it(`el id "${id}" da 404 con success false`, async () => {
      const res = await api.get(`/seguimiento/${id}`, como('lector'));
      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { success: false, error: 'Dataset no encontrado' });
    });
  }

  it('un id gigante (más allá de lo que entra en un número seguro) da 404, no 500', async () => {
    const res = await api.get('/seguimiento/99999999999999999999999999', como('lector'));
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { success: false, error: 'Dataset no encontrado' });
  });
});

// Notas DGMIT según quién mira (spec 2026-10-24-notas-dgmit, 3 y 8): en el detalle, cada movimiento de una nota DGMIT dice si quien
// mira puede corregirla o anularla (extra.editable: quien la cargó o administración) y la respuesta no trae el id de quien la cargó
// (por_id). Las notas se cargan por la API, con la sesión de cada usuario: así creado_por es el de verdad.
describe('notas DGMIT según quién mira', () => {
  beforeEach(async () => {
    // limpiarBase borra los datasets (y, en cascada, sus filas de notas_dgmit_datasets), pero no las notas: sin esto, el número
    // de una nota de un test chocaría con el del siguiente
    await asegurarBaseDePrueba();
    await query('DELETE FROM notas_dgmit');
  });

  const cargarNota = async (quien, datos) => {
    const res = await api.post('/notas-dgmit', { recibida: '2026-10-01', tipo: 'solicitud', datasets: [datasetId], ...datos }, como(quien));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.data.id;
  };
  const verDetalle = async (quien) => {
    const res = await api.get(`/seguimiento/${datasetId}`, como(quien));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res;
  };
  const notasDgmitDe = (res) => res.body.data.movimientos.filter((m) => m.tipo === 'dgmit');
  const editables = async (quien) => notasDgmitDe(await verDetalle(quien)).map((m) => [m.extra.numero, m.extra.editable]).sort();

  it('el colaborador que la cargó ve editable: true; otro colaborador y el lector, false; el admin, true', async () => {
    const delColaborador = await cargarNota('colab', { numero: '156/26' });
    await cargarNota('adminA', { numero: '157/26', tipo: 'reiteracion', recibida: '2026-10-05' });
    assert.deepEqual(await editables('colab'), [['156/26', true], ['157/26', false]]);
    assert.deepEqual(await editables('colab2'), [['156/26', false], ['157/26', false]]);
    assert.deepEqual(await editables('lector'), [['156/26', false], ['157/26', false]]);
    assert.deepEqual(await editables('adminA'), [['156/26', true], ['157/26', true]]);
    // Si se borró el usuario que la cargó (creado_por queda NULL), solo la corrige administración
    await query('UPDATE notas_dgmit SET creado_por = NULL WHERE id = ?', [delColaborador]);
    assert.deepEqual(await editables('colab'), [['156/26', false], ['157/26', false]]);
    assert.deepEqual(await editables('adminA'), [['156/26', true], ['157/26', true]]);
  });

  it('la respuesta no trae por_id', async () => {
    await cargarNota('colab', { numero: '156/26' });
    for (const quien of ['colab', 'colab2', 'lector', 'adminA']) {
      const res = await verDetalle(quien);
      const notas = notasDgmitDe(res);
      assert.equal(notas.length, 1, quien);
      assert.ok(!Object.hasOwn(notas[0].extra, 'por_id'), quien);
      // En ningún lugar de la respuesta (ni en el circuito ni en la cinta) va el id de quien la cargó
      const texto = JSON.stringify(res.body);
      assert.ok(!texto.includes('por_id') && !texto.includes('creado_por'), `${quien}: ${texto}`);
      // Quién la cargó se sigue viendo, por su nombre corto
      assert.equal(notas[0].extra.por, 'Test colab', quien);
      assert.deepEqual(notas[0].quien, ['Cargó Test colab'], quien);
    }
  });

  it('la lista trae requiere_nota y nota_dgmit', async () => {
    const conSi = await crearDataset({ titulo: 'Externo con Sí', vencimiento: '2027-06-30', gestion: 'externa', requiereNota: 1 });
    const conNo = await crearDataset({ titulo: 'Externo con No', vencimiento: '2027-06-30', gestion: 'externa', requiereNota: 0 });
    const interno = await crearDataset({ titulo: 'Interno', vencimiento: '2027-06-30', gestion: 'interna' });
    await cargarNota('colab', { numero: '156/26', datasets: [conSi] });
    const res = await api.get('/seguimiento', como('lector'));
    assert.equal(res.status, 200);
    const fila = (id) => {
      const encontrada = res.body.data.find((f) => f.id === id);
      return [encontrada.requiere_nota, encontrada.nota_dgmit];
    };
    assert.deepEqual(fila(conSi), [1, { numero: '156/26', tipo: 'solicitud', recibida: '2026-10-01' }]);
    assert.deepEqual(fila(conNo), [0, null]);
    assert.deepEqual(fila(datasetId), [null, null]);
    assert.deepEqual(fila(interno), [null, null]);
    assert.ok(!JSON.stringify(res.body).includes('por_id'));
  });
});

describe('GET /seguimiento/:id/pdf', () => {
  it('el lector lo descarga: 200, application/pdf, una hoja y el pie con su nombre corto', async () => {
    const res = await api.get(`/seguimiento/${datasetId}/pdf`, como('lector'));
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /^application\/pdf/);
    assert.equal(res.body.subarray(0, 5).toString(), '%PDF-');
    const hojas = lineasPorHoja(res.body);
    assert.equal(hojas.length, 1);
    assert.ok(hojas[0].includes('Dataset del seguimiento'), hojas[0].join(' | '));
    // El nombre sale de la base (usuarios.nombre_completo, "Test lector") y la hora, de ahoraArgentina()
    assert.ok(hojas[0].some(l => /^Generado el \d{2}\/\d{2}\/\d{4} a las \d{2}:\d{2} por Test lector$/.test(l)), hojas[0].join(' | '));
    assert.ok(hojas[0].includes('Seguimiento del dataset · Hoja 1 de 1'), hojas[0].join(' | '));
    // El nombre del archivo: "Seguimiento - <título> - <hoy>.pdf"
    assert.equal(res.headers.get('content-disposition'),
      `attachment; filename="Seguimiento - Dataset del seguimiento - ${hoyArgentina()}.pdf"; filename*=UTF-8''${encodeURIComponent(`Seguimiento - Dataset del seguimiento - ${hoyArgentina()}.pdf`)}`);
  });

  it('un admin lo descarga igual', async () => {
    const res = await api.get(`/seguimiento/${datasetId}/pdf`, como('adminA'));
    assert.equal(res.status, 200);
    assert.equal(res.body.subarray(0, 5).toString(), '%PDF-');
  });

  // Review Focus 2: un título con raya y comillas no rompe el encabezado (ERR_INVALID_CHAR)
  it('un título con raya y comillas se descarga, con el nombre completo en filename*', async () => {
    const id = await crearDataset({ titulo: 'Áreas – "género"', vencimiento: '2027-06-30', gestion: 'externa' });
    const res = await api.get(`/seguimiento/${id}/pdf`, como('lector'));
    assert.equal(res.status, 200);
    assert.equal(res.body.subarray(0, 5).toString(), '%PDF-');
    const disposicion = res.headers.get('content-disposition');
    assert.ok(disposicion.includes("filename*=UTF-8''"), disposicion);
    assert.ok(disposicion.includes(encodeURIComponent('Áreas – ')), disposicion);
  });

  it('el dataset dado de baja también se descarga', async () => {
    const baja = await crearDataset({ titulo: 'Dataset dado de baja', vencimiento: '2027-06-30', activo: 0 });
    const res = await api.get(`/seguimiento/${baja}/pdf`, como('lector'));
    assert.equal(res.status, 200);
    assert.equal(res.body.subarray(0, 5).toString(), '%PDF-');
  });

  // Review Focus 1: la misma regla que el detalle
  for (const id of ['abc', '0', '-3', '999999', '1.5', '99999999999999999999999999']) {
    it(`el id "${id}" da 404 en JSON`, async () => {
      const res = await api.get(`/seguimiento/${id}/pdf`, como('lector'));
      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { success: false, error: 'Dataset no encontrado' });
    });
  }
});

describe('sin sesión', () => {
  for (const ruta of ['/seguimiento', '/seguimiento/1', '/seguimiento/1/pdf']) {
    it(`GET ${ruta} da 401`, async () => {
      const res = await api.get(ruta);
      assert.equal(res.status, 401);
    });
  }

  it('un token inválido también da 401', async () => {
    const res = await api.get('/seguimiento', { token: 'no-es-un-token' });
    assert.equal(res.status, 401);
  });
});
