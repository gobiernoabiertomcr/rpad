// Doble verificación: un admin propone, otro admin distinto aprueba o rechaza
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb,
  catalogos, query, PREFIJO_TEST
} from './helpers.js';

let servidor, api, usuarios, cat;

before(async () => {
  servidor = await iniciarServidor();
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api);
  cat = await catalogos();
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
});

const datosAlta = (titulo) => ({
  titulo: `${PREFIJO_TEST} ${titulo}`,
  descripcion: 'Dataset creado por los tests',
  area_id: cat.areaId,
  frecuencia_id: cat.frecuenciaId,
  tema_principal_id: cat.temaId,
  tipo_gestion: 'interna',
  formatos: [cat.formatoId],
  url_dataset: 'https://datos.comodoro.gov.ar/dataset/test'
});

const aprobar = (cambioId, usuario) =>
  api.post(`/cambios-pendientes/${cambioId}/aprobar`, {}, { token: usuario.token });

const rechazar = (cambioId, usuario, comentario = 'Rechazado por los tests') =>
  api.post(`/cambios-pendientes/${cambioId}/rechazar`, { comentario }, { token: usuario.token });

// Crea un dataset de prueba pasando por el circuito completo (A propone, B aprueba)
const crearDatasetAprobado = async (titulo) => {
  const alta = await api.post('/datasets', datosAlta(titulo), { token: usuarios.adminA.token });
  assert.equal(alta.status, 201);
  const aprobacion = await aprobar(alta.body.data.cambio_pendiente_id, usuarios.adminB);
  assert.equal(aprobacion.status, 200);
  return aprobacion.body.data.dataset_id;
};

const datasetEnDb = async (id) => (await query('SELECT * FROM datasets WHERE id = ?', [id]))[0];

describe('alta de dataset', () => {
  it('queda pendiente y no crea el dataset hasta que se apruebe', async () => {
    const titulo = `${PREFIJO_TEST} alta pendiente`;
    const alta = await api.post('/datasets', datosAlta('alta pendiente'), { token: usuarios.adminA.token });
    assert.equal(alta.status, 201);
    assert.ok(alta.body.data.cambio_pendiente_id);
    const creados = await query('SELECT id FROM datasets WHERE titulo = ?', [titulo]);
    assert.equal(creados.length, 0);
  });

  it('el mismo admin que propone no puede aprobar', async () => {
    const alta = await api.post('/datasets', datosAlta('autoaprobación'), { token: usuarios.adminA.token });
    const res = await aprobar(alta.body.data.cambio_pendiente_id, usuarios.adminA);
    assert.equal(res.status, 403);
  });

  it('el mismo admin que propone no puede rechazar', async () => {
    const alta = await api.post('/datasets', datosAlta('autorrechazo'), { token: usuarios.adminA.token });
    const res = await rechazar(alta.body.data.cambio_pendiente_id, usuarios.adminA);
    assert.equal(res.status, 403);
  });

  it('el superadmin tampoco puede aprobar ni rechazar sus propios cambios', async () => {
    const alta = await api.post('/datasets', datosAlta('autoaprobación del superadmin'), { token: usuarios.superadmin.token });
    assert.equal(alta.status, 201);
    assert.equal((await aprobar(alta.body.data.cambio_pendiente_id, usuarios.superadmin)).status, 403);
    assert.equal((await rechazar(alta.body.data.cambio_pendiente_id, usuarios.superadmin)).status, 403);
  });

  it('el superadmin aprueba el cambio de otro admin', async () => {
    const alta = await api.post('/datasets', datosAlta('aprobada por el superadmin'), { token: usuarios.adminA.token });
    assert.equal((await aprobar(alta.body.data.cambio_pendiente_id, usuarios.superadmin)).status, 200);
  });

  it('otro admin aprueba y el dataset se crea con sus formatos', async () => {
    const id = await crearDatasetAprobado('alta aprobada');
    const dataset = await datasetEnDb(id);
    assert.equal(dataset.titulo, `${PREFIJO_TEST} alta aprobada`);
    assert.equal(dataset.activo, 1);
    const formatos = await query('SELECT formato_id FROM dataset_formatos WHERE dataset_id = ?', [id]);
    assert.deepEqual(formatos.map(f => f.formato_id), [cat.formatoId]);
  });

  it('un cambio ya aprobado no se puede volver a aprobar', async () => {
    const alta = await api.post('/datasets', datosAlta('doble aprobación secuencial'), { token: usuarios.adminA.token });
    const cambioId = alta.body.data.cambio_pendiente_id;
    assert.equal((await aprobar(cambioId, usuarios.adminB)).status, 200);
    assert.equal((await aprobar(cambioId, usuarios.adminB)).status, 404);
    const creados = await query('SELECT id FROM datasets WHERE titulo = ?', [`${PREFIJO_TEST} doble aprobación secuencial`]);
    assert.equal(creados.length, 1);
  });
});

describe('edición, bloqueo y rechazo', () => {
  it('aprobar una edición aplica el nuevo título', async () => {
    const id = await crearDatasetAprobado('para editar');
    const edicion = await api.put(`/datasets/${id}`, { titulo: `${PREFIJO_TEST} editado` }, { token: usuarios.adminA.token });
    assert.equal(edicion.status, 200);
    assert.equal((await datasetEnDb(id)).titulo, `${PREFIJO_TEST} para editar`);
    assert.equal((await aprobar(edicion.body.data.cambio_pendiente_id, usuarios.adminB)).status, 200);
    assert.equal((await datasetEnDb(id)).titulo, `${PREFIJO_TEST} editado`);
  });

  it('con un cambio pendiente el dataset queda bloqueado para editar, actualizar y eliminar', async () => {
    const id = await crearDatasetAprobado('bloqueo');
    const edicion = await api.put(`/datasets/${id}`, { titulo: `${PREFIJO_TEST} bloqueo v2` }, { token: usuarios.adminA.token });
    assert.equal(edicion.status, 200);

    const otraEdicion = await api.put(`/datasets/${id}`, { titulo: `${PREFIJO_TEST} bloqueo v3` }, { token: usuarios.adminB.token });
    const actualizacion = await api.post(`/datasets/${id}/actualizar`, {}, { token: usuarios.adminB.token });
    const baja = await api.delete(`/datasets/${id}`, { token: usuarios.adminB.token });
    assert.deepEqual([otraEdicion.status, actualizacion.status, baja.status], [409, 409, 409]);
  });

  it('rechazar exige un motivo', async () => {
    const id = await crearDatasetAprobado('rechazo sin motivo');
    const edicion = await api.put(`/datasets/${id}`, { titulo: `${PREFIJO_TEST} x` }, { token: usuarios.adminA.token });
    const res = await rechazar(edicion.body.data.cambio_pendiente_id, usuarios.adminB, '');
    assert.equal(res.status, 400);
  });

  it('rechazar deja el dataset como estaba y lo desbloquea', async () => {
    const id = await crearDatasetAprobado('rechazo');
    const edicion = await api.put(`/datasets/${id}`, { titulo: `${PREFIJO_TEST} no debería aplicarse` }, { token: usuarios.adminA.token });
    assert.equal((await rechazar(edicion.body.data.cambio_pendiente_id, usuarios.adminB)).status, 200);
    assert.equal((await datasetEnDb(id)).titulo, `${PREFIJO_TEST} rechazo`);
    const nuevaEdicion = await api.put(`/datasets/${id}`, { titulo: `${PREFIJO_TEST} rechazo v2` }, { token: usuarios.adminA.token });
    assert.equal(nuevaEdicion.status, 200);
  });
});

describe('baja y registro de actualización', () => {
  it('aprobar una baja desactiva el dataset sin borrarlo', async () => {
    const id = await crearDatasetAprobado('baja');
    const baja = await api.delete(`/datasets/${id}`, { token: usuarios.adminA.token });
    assert.equal(baja.status, 200);
    assert.equal((await aprobar(baja.body.data.cambio_pendiente_id, usuarios.adminB)).status, 200);
    const dataset = await datasetEnDb(id);
    assert.ok(dataset, 'el registro debe seguir existiendo');
    assert.equal(dataset.activo, 0);
    assert.equal((await api.get(`/datasets/${id}`)).status, 404);
  });

  it('registrar una actualización y aprobarla mueve las fechas', async () => {
    const id = await crearDatasetAprobado('actualización');
    const res = await api.post(`/datasets/${id}/actualizar`, { fecha_actualizacion: '2026-03-15' }, { token: usuarios.adminA.token });
    assert.equal(res.status, 200);
    assert.equal((await aprobar(res.body.data.cambio_pendiente_id, usuarios.adminB)).status, 200);
    const [fechas] = await query(
      `SELECT DATE_FORMAT(ultima_actualizacion, '%Y-%m-%d') AS ultima,
              DATEDIFF(proxima_actualizacion, ultima_actualizacion) AS dias,
              (SELECT dias FROM frecuencias WHERE id = ?) AS dias_frecuencia
       FROM datasets WHERE id = ?`,
      [cat.frecuenciaId, id]
    );
    assert.equal(fechas.ultima, '2026-03-15');
    assert.equal(fechas.dias, fechas.dias_frecuencia);
  });
});

describe('revisión de un cambio de Observaciones', () => {
  it('muestra el antes y el después aunque sea el único campo que cambió', async () => {
    const id = await crearDatasetAprobado('revisión de observaciones');
    const edicion = await api.put(`/datasets/${id}`, { observaciones: 'Observación nueva.' }, { token: usuarios.adminA.token });
    assert.equal(edicion.status, 200);

    const detalle = await api.get(`/cambios-pendientes/${edicion.body.data.cambio_pendiente_id}`, { token: usuarios.adminB.token });
    assert.equal(detalle.status, 200);
    assert.deepEqual(detalle.body.data.campos_modificados, [{ campo: 'Observaciones', antes: '-', despues: 'Observación nueva.' }]);
  });
});

describe('campo "Qué se solicita"', () => {
  const TEXTO = 'El listado completo de registros del período, con las mismas columnas que el archivo del portal, en CSV.';
  const solicitaEnDb = async (id) => (await datasetEnDb(id)).que_se_solicita;

  // Crea un dataset de prueba ya aprobado, con el texto indicado en el alta
  const crearConTexto = async (titulo, texto) => {
    const alta = await api.post('/datasets', { ...datosAlta(titulo), que_se_solicita: texto }, { token: usuarios.adminA.token });
    assert.equal(alta.status, 201);
    const aprobacion = await aprobar(alta.body.data.cambio_pendiente_id, usuarios.adminB);
    assert.equal(aprobacion.status, 200);
    return aprobacion.body.data.dataset_id;
  };

  it('crear un dataset con el campo lo guarda al aprobarse, no antes', async () => {
    const titulo = `${PREFIJO_TEST} alta con qué se solicita`;
    const alta = await api.post('/datasets', { ...datosAlta('alta con qué se solicita'), que_se_solicita: TEXTO }, { token: usuarios.adminA.token });
    assert.equal(alta.status, 201);
    assert.equal((await query('SELECT id FROM datasets WHERE titulo = ?', [titulo])).length, 0);

    const aprobacion = await aprobar(alta.body.data.cambio_pendiente_id, usuarios.adminB);
    assert.equal(aprobacion.status, 200);
    assert.equal(await solicitaEnDb(aprobacion.body.data.dataset_id), TEXTO);
  });

  it('un dataset sin el campo queda con NULL', async () => {
    const id = await crearDatasetAprobado('alta sin qué se solicita');
    assert.equal(await solicitaEnDb(id), null);
  });

  it('un texto vacío o solo de espacios queda en NULL al crear y se guarda sin espacios sobrantes', async () => {
    assert.equal(await solicitaEnDb(await crearConTexto('alta vacía', '')), null);
    assert.equal(await solicitaEnDb(await crearConTexto('alta en blanco', ' \n\t  ')), null);
    assert.equal(await solicitaEnDb(await crearConTexto('alta con márgenes', `  ${TEXTO}\n`)), TEXTO);
  });

  it('proponer una edición no modifica el dataset hasta que otro admin la aprueba', async () => {
    const id = await crearDatasetAprobado('edición de qué se solicita');
    const edicion = await api.put(`/datasets/${id}`, { que_se_solicita: TEXTO }, { token: usuarios.adminA.token });
    assert.equal(edicion.status, 200);
    assert.equal(await solicitaEnDb(id), null);

    // Mientras está pendiente, el detalle público sigue sin el texto
    assert.equal((await api.get(`/datasets/${id}`)).body.data.que_se_solicita, null);

    assert.equal((await aprobar(edicion.body.data.cambio_pendiente_id, usuarios.adminB)).status, 200);
    assert.equal(await solicitaEnDb(id), TEXTO);
  });

  it('la revisión muestra el cambio de "Qué se solicita" con el antes y el después', async () => {
    const id = await crearConTexto('revisión de qué se solicita', 'Texto anterior.');
    const edicion = await api.put(`/datasets/${id}`, { que_se_solicita: TEXTO }, { token: usuarios.adminA.token });
    assert.equal(edicion.status, 200);

    const detalle = await api.get(`/cambios-pendientes/${edicion.body.data.cambio_pendiente_id}`, { token: usuarios.adminB.token });
    assert.equal(detalle.status, 200);
    assert.deepEqual(detalle.body.data.campos_modificados, [{ campo: 'Qué se solicita', antes: 'Texto anterior.', despues: TEXTO }]);
  });

  it('rechazar la edición deja el texto como estaba', async () => {
    const id = await crearConTexto('rechazo de qué se solicita', 'Texto vigente.');
    const edicion = await api.put(`/datasets/${id}`, { que_se_solicita: TEXTO }, { token: usuarios.adminA.token });
    assert.equal((await rechazar(edicion.body.data.cambio_pendiente_id, usuarios.adminB)).status, 200);
    assert.equal(await solicitaEnDb(id), 'Texto vigente.');
  });

  it('editar otros campos conserva el texto', async () => {
    const id = await crearConTexto('conserva qué se solicita', TEXTO);
    const edicion = await api.put(`/datasets/${id}`, { titulo: `${PREFIJO_TEST} conserva v2` }, { token: usuarios.adminA.token });
    assert.equal((await aprobar(edicion.body.data.cambio_pendiente_id, usuarios.adminB)).status, 200);
    assert.equal(await solicitaEnDb(id), TEXTO);
  });

  it('vaciar el texto en una edición lo deja en NULL al aprobarse', async () => {
    for (const [nombre, vacio] of [['cadena vacía', ''], ['solo espacios', '   \n '], ['null', null]]) {
      const id = await crearConTexto(`vaciado ${nombre}`, TEXTO);
      const edicion = await api.put(`/datasets/${id}`, { que_se_solicita: vacio }, { token: usuarios.adminA.token });
      assert.equal(edicion.status, 200, nombre);
      assert.equal(await solicitaEnDb(id), TEXTO, `${nombre}: no cambia antes de aprobar`);
      assert.equal((await aprobar(edicion.body.data.cambio_pendiente_id, usuarios.adminB)).status, 200, nombre);
      assert.equal(await solicitaEnDb(id), null, nombre);
    }
  });

  it('un texto en blanco sobre un dataset sin texto no cuenta como cambio', async () => {
    const id = await crearDatasetAprobado('en blanco sin cambio');
    const edicion = await api.put(`/datasets/${id}`, { que_se_solicita: '  ' }, { token: usuarios.adminA.token });
    assert.equal(edicion.status, 400);
    assert.equal((await query('SELECT id FROM cambios_pendientes WHERE dataset_id = ? AND estado = ?', [id, 'pendiente'])).length, 0);
  });

  it('con una edición pendiente el dataset sigue bloqueado y el texto no se pisa', async () => {
    const id = await crearConTexto('bloqueo de qué se solicita', 'Texto vigente.');
    const edicion = await api.put(`/datasets/${id}`, { que_se_solicita: TEXTO }, { token: usuarios.adminA.token });
    assert.equal(edicion.status, 200);
    const otra = await api.put(`/datasets/${id}`, { que_se_solicita: 'Otro texto.' }, { token: usuarios.adminB.token });
    assert.equal(otra.status, 409);
    assert.equal(await solicitaEnDb(id), 'Texto vigente.');
  });

  it('rechaza un valor que no es texto', async () => {
    const alta = await api.post('/datasets', { ...datosAlta('alta inválida'), que_se_solicita: { a: 1 } }, { token: usuarios.adminA.token });
    assert.equal(alta.status, 400);
    const id = await crearDatasetAprobado('edición inválida');
    const edicion = await api.put(`/datasets/${id}`, { que_se_solicita: 42 }, { token: usuarios.adminA.token });
    assert.equal(edicion.status, 400);
  });

  it('"Qué se solicita" y "Observaciones" de más de 4000 caracteres se rechazan al proponer (alta y edición), con un mensaje claro', async () => {
    const largo = 'á'.repeat(4001);
    const casos = [['que_se_solicita', 'Qué se solicita'], ['observaciones', 'Observaciones']];
    for (const [campo, etiqueta] of casos) {
      const alta = await api.post('/datasets', { ...datosAlta(`alta larga ${campo}`), [campo]: largo }, { token: usuarios.adminA.token });
      assert.equal(alta.status, 400, campo);
      assert.equal(alta.body.error, `${etiqueta} no puede tener más de 4000 caracteres (tiene 4001)`);
    }
    const id = await crearDatasetAprobado('edición con textos largos');
    for (const [campo, etiqueta] of casos) {
      const edicion = await api.put(`/datasets/${id}`, { [campo]: largo }, { token: usuarios.adminA.token });
      assert.equal(edicion.status, 400, campo);
      assert.equal(edicion.body.error, `${etiqueta} no puede tener más de 4000 caracteres (tiene 4001)`);
    }
    assert.equal((await query('SELECT id FROM cambios_pendientes WHERE dataset_id = ? AND estado = ?', [id, 'pendiente'])).length, 0);

    // 4000 justos (sin contar los espacios de los extremos de "Qué se solicita") se aceptan y se guardan al aprobarse
    const justo = 'á'.repeat(4000);
    const edicion = await api.put(`/datasets/${id}`, { que_se_solicita: `  ${justo}  `, observaciones: justo }, { token: usuarios.adminA.token });
    assert.equal(edicion.status, 200, edicion.body.error);
    assert.equal((await aprobar(edicion.body.data.cambio_pendiente_id, usuarios.adminB)).status, 200);
    const guardado = await datasetEnDb(id);
    assert.equal(guardado.que_se_solicita, justo);
    assert.equal(guardado.observaciones, justo);
  });

  it('el detalle público del dataset lo devuelve, sin iniciar sesión', async () => {
    const id = await crearConTexto('público con qué se solicita', TEXTO);
    const res = await api.get(`/datasets/${id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.que_se_solicita, TEXTO);
  });
});
