// «Requiere nota DGMIT» en la API y la doble verificación (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.1 y 1.3):
// lo que validan POST y PUT /datasets, lo que guarda el cambio pendiente (datos_nuevos y datos_anteriores), lo que aplica la
// aprobación y cómo se muestra la comparación. 1 = Sí, 0 = No, NULL = sin dato; en gestión interna, siempre NULL.
// Los datasets de prueba se cargan por SQL, con el prefijo [TEST]; el servidor es el real, sobre la base Docker local.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, catalogos, query, PREFIJO_TEST
} from './helpers.js';
import { MENSAJE_FALTA_REQUIERE_NOTA } from '../services/requiereNotaReglas.js';

let servidor, api, usuarios, cat;

const MENSAJE_FALTA = 'Indicá si el dataset requiere nota DGMIT.';
const MENSAJE_INVALIDO = 'requiere_nota debe ser 1 (Sí) o 0 (No)';
const SIN_CAMBIOS = 'No se detectaron cambios. El dataset no fue modificado.';

before(async () => {
  servidor = await iniciarServidor();
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, { adminA: 'admin', adminB: 'admin' });
  cat = await catalogos();
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
});

const como = (clave) => ({ token: usuarios[clave].token });

// Carga un dataset nuevo por SQL (cada test usa el suyo: un cambio pendiente lo bloquea). requiereNota es lo que queda
// guardado: 1, 0 o null
let numero = 0;
const cargarDataset = async ({ gestion = 'externa', requiereNota = null } = {}) => {
  numero += 1;
  const resultado = await query(
    `INSERT INTO datasets (titulo, area_id, frecuencia_id, tema_principal_id, tipo_gestion, requiere_nota, url_dataset, activo)
     VALUES (?, ?, ?, ?, ?, ?, 'https://datos.comodoro.gov.ar/dataset/test', 1)`,
    [`${PREFIJO_TEST} requiere nota ${numero}`, cat.areaId, cat.frecuenciaId, cat.temaId, gestion, requiereNota]
  );
  return resultado.insertId;
};

const requiereNotaEnDb = async (id) => (await query('SELECT requiere_nota FROM datasets WHERE id = ?', [id]))[0].requiere_nota;
const datasetPorTitulo = async (titulo) => (await query('SELECT id, requiere_nota, tipo_gestion FROM datasets WHERE titulo = ?', [titulo]))[0];
// El JSON llega como texto o ya parseado, según el driver
const comoObjeto = (datos) => (typeof datos === 'string' ? JSON.parse(datos) : datos);
const cambioEnDb = async (id) => {
  const [fila] = await query('SELECT estado, datos_nuevos, datos_anteriores FROM cambios_pendientes WHERE id = ?', [id]);
  return { ...fila, datos_nuevos: comoObjeto(fila.datos_nuevos), datos_anteriores: comoObjeto(fila.datos_anteriores) };
};
const pendientesDe = async (datasetId) =>
  (await query("SELECT id FROM cambios_pendientes WHERE dataset_id = ? AND estado = 'pendiente'", [datasetId])).length;

const editar = (id, body, quien = 'adminA') => api.put(`/datasets/${id}`, body, como(quien));
const crear = (body, quien = 'adminA') => api.post('/datasets', body, como(quien));
const aprobar = (cambioId, quien = 'adminB') => api.post(`/cambios-pendientes/${cambioId}/aprobar`, {}, como(quien));

let altas = 0;
const alta = (extra = {}) => {
  altas += 1;
  return {
    titulo: `${PREFIJO_TEST} alta requiere nota ${altas}`,
    area_id: cat.areaId,
    frecuencia_id: cat.frecuenciaId,
    tema_principal_id: cat.temaId,
    tipo_gestion: 'externa',
    formatos: [cat.formatoId],
    ...extra
  };
};

// Espera un 400 con ese mensaje y, si se da el dataset, que no se haya creado ningún cambio pendiente para él
const esperar400 = async (res, error, datasetId) => {
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(res.body.success, false);
  if (error !== undefined) assert.equal(res.body.error, error);
  if (datasetId !== undefined) assert.equal(await pendientesDe(datasetId), 0);
};

describe('el mensaje de la validación', () => {
  it('el servidor responde con el mismo texto que exporta el módulo de reglas', () => {
    assert.equal(MENSAJE_FALTA_REQUIERE_NOTA, MENSAJE_FALTA);
  });
});

describe('POST /datasets: requiere_nota en el alta', () => {
  it('alta de un externo sin requiere_nota → 400 con MENSAJE_FALTA_REQUIERE_NOTA', async () => {
    const titulo = `${PREFIJO_TEST} alta externa sin el dato`;
    await esperar400(await crear(alta({ titulo })), MENSAJE_FALTA_REQUIERE_NOTA);
    // null y el texto vacío son "sin dato": tampoco valen
    await esperar400(await crear(alta({ titulo, requiere_nota: null })), MENSAJE_FALTA_REQUIERE_NOTA);
    await esperar400(await crear(alta({ titulo, requiere_nota: '' })), MENSAJE_FALTA_REQUIERE_NOTA);
    assert.equal((await query('SELECT id FROM cambios_pendientes WHERE datos_nuevos LIKE ?', [`%${titulo}%`])).length, 0);
  });

  it('alta de un externo con "0" → cambio pendiente con datos_nuevos.requiere_nota === 0; al aprobar, datasets.requiere_nota === 0', async () => {
    const titulo = `${PREFIJO_TEST} alta externa con cero`;
    const res = await crear(alta({ titulo, requiere_nota: '0' }));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const cambio = await cambioEnDb(res.body.data.cambio_pendiente_id);
    assert.strictEqual(cambio.datos_nuevos.requiere_nota, 0);
    assert.equal(await datasetPorTitulo(titulo), undefined);

    const aprobacion = await aprobar(res.body.data.cambio_pendiente_id);
    assert.equal(aprobacion.status, 200, JSON.stringify(aprobacion.body));
    const dataset = await datasetPorTitulo(titulo);
    assert.strictEqual(dataset.requiere_nota, 0);
    assert.equal(dataset.tipo_gestion, 'externa');
  });

  it('alta de un externo con 1, true o "1" guarda 1; con 0 o false guarda 0', async () => {
    for (const [valor, esperado] of [[1, 1], [true, 1], ['1', 1], [0, 0], [false, 0]]) {
      const titulo = `${PREFIJO_TEST} alta externa con ${JSON.stringify(valor)}`;
      const res = await crear(alta({ titulo, requiere_nota: valor }));
      assert.equal(res.status, 201, `${JSON.stringify(valor)}: ${JSON.stringify(res.body)}`);
      assert.strictEqual((await cambioEnDb(res.body.data.cambio_pendiente_id)).datos_nuevos.requiere_nota, esperado, JSON.stringify(valor));
      assert.equal((await aprobar(res.body.data.cambio_pendiente_id)).status, 200);
      assert.strictEqual((await datasetPorTitulo(titulo)).requiere_nota, esperado, JSON.stringify(valor));
    }
  });

  it('alta de un interno con 1 → se guarda NULL', async () => {
    const titulo = `${PREFIJO_TEST} alta interna con uno`;
    const res = await crear(alta({ titulo, tipo_gestion: 'interna', requiere_nota: 1 }));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.strictEqual((await cambioEnDb(res.body.data.cambio_pendiente_id)).datos_nuevos.requiere_nota, null);
    assert.equal((await aprobar(res.body.data.cambio_pendiente_id)).status, 200);
    assert.strictEqual((await datasetPorTitulo(titulo)).requiere_nota, null);
  });

  it('alta de un interno sin el campo se acepta y queda NULL', async () => {
    const titulo = `${PREFIJO_TEST} alta interna sin el dato`;
    const res = await crear(alta({ titulo, tipo_gestion: 'interna' }));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.strictEqual((await cambioEnDb(res.body.data.cambio_pendiente_id)).datos_nuevos.requiere_nota, null);
    assert.equal((await aprobar(res.body.data.cambio_pendiente_id)).status, 200);
    assert.strictEqual((await datasetPorTitulo(titulo)).requiere_nota, null);
  });

  it('requiere_nota "si" → 400, también en un interno', async () => {
    for (const valor of ['si', 'Sí', 'true', 2, -1, 0.5, {}, []]) {
      await esperar400(await crear(alta({ requiere_nota: valor })), MENSAJE_INVALIDO);
      await esperar400(await crear(alta({ tipo_gestion: 'interna', requiere_nota: valor })), MENSAJE_INVALIDO);
    }
  });
});

describe('PUT /datasets/:id: requiere_nota en la edición', () => {
  it('edición que solo cambia requiere_nota de 1 a 0 → crea el cambio (no 400 «No se detectaron cambios»); al aprobar queda 0', async () => {
    const id = await cargarDataset({ requiereNota: 1 });
    const res = await editar(id, { requiere_nota: 0 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const cambio = await cambioEnDb(res.body.data.cambio_pendiente_id);
    assert.strictEqual(cambio.datos_anteriores.requiere_nota, 1);
    assert.strictEqual(cambio.datos_nuevos.requiere_nota, 0);
    // Hasta que se apruebe, el dataset no cambia
    assert.strictEqual(await requiereNotaEnDb(id), 1);

    const aprobacion = await aprobar(res.body.data.cambio_pendiente_id);
    assert.equal(aprobacion.status, 200, JSON.stringify(aprobacion.body));
    assert.strictEqual(await requiereNotaEnDb(id), 0);
  });

  it('edición que solo cambia requiere_nota de 0 a 1 también es un cambio, y 0 no se pierde al aprobar', async () => {
    const id = await cargarDataset({ requiereNota: 0 });
    const res = await editar(id, { requiere_nota: 1 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await aprobar(res.body.data.cambio_pendiente_id)).status, 200);
    assert.strictEqual(await requiereNotaEnDb(id), 1);
  });

  it('repetir el valor guardado no es un cambio, aunque llegue como false, "0" o true, "1"', async () => {
    const conCero = await cargarDataset({ requiereNota: 0 });
    for (const valor of [0, false, '0']) {
      await esperar400(await editar(conCero, { requiere_nota: valor }), SIN_CAMBIOS, conCero);
    }
    const conUno = await cargarDataset({ requiereNota: 1 });
    for (const valor of [1, true, '1']) {
      await esperar400(await editar(conUno, { requiere_nota: valor }), SIN_CAMBIOS, conUno);
    }
  });

  it('edición externa → interna con requiere_nota 1 → datos_nuevos.requiere_nota === null', async () => {
    const id = await cargarDataset({ requiereNota: 1 });
    const res = await editar(id, { tipo_gestion: 'interna', requiere_nota: 1 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const cambio = await cambioEnDb(res.body.data.cambio_pendiente_id);
    assert.strictEqual(cambio.datos_nuevos.requiere_nota, null);
    assert.strictEqual(cambio.datos_anteriores.requiere_nota, 1);
    assert.equal((await aprobar(res.body.data.cambio_pendiente_id)).status, 200);
    assert.strictEqual(await requiereNotaEnDb(id), null);
  });

  it('pasar un externo a interno sin mandar el campo también lo deja en NULL', async () => {
    const id = await cargarDataset({ requiereNota: 0 });
    const res = await editar(id, { tipo_gestion: 'interna' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual((await cambioEnDb(res.body.data.cambio_pendiente_id)).datos_nuevos.requiere_nota, null);
    assert.equal((await aprobar(res.body.data.cambio_pendiente_id)).status, 200);
    assert.strictEqual(await requiereNotaEnDb(id), null);
  });

  it('edición interna → externa sin el dato → 400', async () => {
    const id = await cargarDataset({ gestion: 'interna' });
    await esperar400(await editar(id, { tipo_gestion: 'externa' }), MENSAJE_FALTA_REQUIERE_NOTA, id);
    await esperar400(await editar(id, { tipo_gestion: 'externa', requiere_nota: null }), MENSAJE_FALTA_REQUIERE_NOTA, id);
    await esperar400(await editar(id, { tipo_gestion: 'externa', requiere_nota: '' }), MENSAJE_FALTA_REQUIERE_NOTA, id);
  });

  it('edición interna → externa con el dato lo guarda', async () => {
    const id = await cargarDataset({ gestion: 'interna' });
    const res = await editar(id, { tipo_gestion: 'externa', requiere_nota: 0 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const cambio = await cambioEnDb(res.body.data.cambio_pendiente_id);
    assert.strictEqual(cambio.datos_anteriores.requiere_nota, null);
    assert.strictEqual(cambio.datos_nuevos.requiere_nota, 0);
    assert.equal((await aprobar(res.body.data.cambio_pendiente_id)).status, 200);
    assert.strictEqual(await requiereNotaEnDb(id), 0);
  });

  it('edición de un externo sin mandar el campo conserva el valor', async () => {
    for (const guardado of [0, 1]) {
      const id = await cargarDataset({ requiereNota: guardado });
      const res = await editar(id, { titulo: `${PREFIJO_TEST} requiere nota conserva ${guardado}` });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const cambio = await cambioEnDb(res.body.data.cambio_pendiente_id);
      assert.strictEqual(cambio.datos_anteriores.requiere_nota, guardado);
      assert.strictEqual(cambio.datos_nuevos.requiere_nota, guardado);
      assert.equal((await aprobar(res.body.data.cambio_pendiente_id)).status, 200);
      assert.strictEqual(await requiereNotaEnDb(id), guardado);
    }
  });

  it('un externo sin dato guardado no se edita sin completarlo (400), y con el dato se edita', async () => {
    const id = await cargarDataset({ requiereNota: null });
    await esperar400(await editar(id, { titulo: `${PREFIJO_TEST} requiere nota sin dato` }), MENSAJE_FALTA_REQUIERE_NOTA, id);
    const res = await editar(id, { titulo: `${PREFIJO_TEST} requiere nota completado`, requiere_nota: 1 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await aprobar(res.body.data.cambio_pendiente_id)).status, 200);
    assert.strictEqual(await requiereNotaEnDb(id), 1);
  });

  it('mandar null o vacío a un externo es pedir "sin dato": 400', async () => {
    const id = await cargarDataset({ requiereNota: 1 });
    for (const valor of [null, '']) {
      await esperar400(await editar(id, { requiere_nota: valor }), MENSAJE_FALTA_REQUIERE_NOTA, id);
    }
    assert.strictEqual(await requiereNotaEnDb(id), 1);
  });

  it('un interno se edita sin mandar el campo y su NULL no cuenta como cambio', async () => {
    const id = await cargarDataset({ gestion: 'interna' });
    await esperar400(await editar(id, { requiere_nota: 1 }), SIN_CAMBIOS, id);
    const res = await editar(id, { titulo: `${PREFIJO_TEST} requiere nota interno` });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const cambio = await cambioEnDb(res.body.data.cambio_pendiente_id);
    assert.strictEqual(cambio.datos_anteriores.requiere_nota, null);
    assert.strictEqual(cambio.datos_nuevos.requiere_nota, null);
  });

  it('requiere_nota "si" → 400', async () => {
    const externo = await cargarDataset({ requiereNota: 1 });
    const interno = await cargarDataset({ gestion: 'interna' });
    for (const valor of ['si', 'Sí', 'true', 2, -1, 0.5, {}, []]) {
      await esperar400(await editar(externo, { requiere_nota: valor }), MENSAJE_INVALIDO, externo);
      await esperar400(await editar(interno, { requiere_nota: valor }), MENSAJE_INVALIDO, interno);
    }
  });
});

describe('la comparación de un cambio (calcularCambios y enriquecerDatos)', () => {
  const comparacionDe = async (cambioId) => {
    const res = await api.get(`/cambios-pendientes/${cambioId}`, como('adminB'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data;
  };

  it('calcularCambios rotula «Requiere nota DGMIT» con Sí → No', async () => {
    const id = await cargarDataset({ requiereNota: 1 });
    const res = await editar(id, { requiere_nota: 0 });
    const cambio = await comparacionDe(res.body.data.cambio_pendiente_id);
    assert.deepEqual(cambio.campos_modificados, [{ campo: 'Requiere nota DGMIT', antes: 'Sí', despues: 'No' }]);
    assert.equal(cambio.datos_anteriores.requiere_nota_texto, 'Sí');
    assert.equal(cambio.datos_nuevos.requiere_nota_texto, 'No');
  });

  it('pasar de interna a externa muestra — → Sí junto con el tipo de gestión', async () => {
    const id = await cargarDataset({ gestion: 'interna' });
    const res = await editar(id, { tipo_gestion: 'externa', requiere_nota: 1 });
    const cambio = await comparacionDe(res.body.data.cambio_pendiente_id);
    assert.deepEqual(cambio.campos_modificados, [
      { campo: 'Tipo de Gestion', antes: 'interna', despues: 'externa' },
      { campo: 'Requiere nota DGMIT', antes: '—', despues: 'Sí' }
    ]);
  });

  it('una edición que no toca el dato no lo lista como modificado', async () => {
    const id = await cargarDataset({ requiereNota: 0 });
    const res = await editar(id, { titulo: `${PREFIJO_TEST} requiere nota sin tocar` });
    const cambio = await comparacionDe(res.body.data.cambio_pendiente_id);
    assert.deepEqual(cambio.campos_modificados.map(c => c.campo), ['Titulo']);
    assert.equal(cambio.datos_nuevos.requiere_nota_texto, 'No');
  });

  it('un cambio viejo, sin la clave, no trae el texto ni lo lista', async () => {
    const id = await cargarDataset({ requiereNota: 1 });
    const cambioId = (await query(
      `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, datos_anteriores, usuario_id)
       VALUES ('editar', ?, ?, ?, ?)`,
      [id, JSON.stringify({ titulo: `${PREFIJO_TEST} requiere nota vieja` }), JSON.stringify({ titulo: `${PREFIJO_TEST} requiere nota anterior` }), usuarios.adminA.id]
    )).insertId;
    const cambio = await comparacionDe(cambioId);
    assert.equal('requiere_nota_texto' in cambio.datos_nuevos, false);
    assert.deepEqual(cambio.campos_modificados.map(c => c.campo), ['Titulo']);
  });
});

describe('aprobar un cambio propuesto antes del despliegue (sin la clave requiere_nota)', () => {
  const insertarCambio = async (tipo, datasetId, nuevos) => (await query(
    `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id) VALUES (?, ?, ?, ?)`,
    [tipo, datasetId, JSON.stringify(nuevos), usuarios.adminA.id]
  )).insertId;

  it('aprobar un cambio viejo sin la clave no toca requiere_nota', async () => {
    for (const guardado of [0, 1, null]) {
      const id = await cargarDataset({ requiereNota: guardado });
      const cambioId = await insertarCambio('editar', id, { observaciones: 'Cambio de antes del despliegue.' });
      const aprobacion = await aprobar(cambioId);
      assert.equal(aprobacion.status, 200, JSON.stringify(aprobacion.body));
      assert.strictEqual(await requiereNotaEnDb(id), guardado);
      assert.equal((await query('SELECT observaciones FROM datasets WHERE id = ?', [id]))[0].observaciones, 'Cambio de antes del despliegue.');
    }
  });

  it('aprobar un alta vieja sin la clave lo deja NULL', async () => {
    const titulo = `${PREFIJO_TEST} alta vieja sin requiere nota`;
    const cambioId = await insertarCambio('crear', null, { ...alta({ titulo }), formatos: [cat.formatoId] });
    const aprobacion = await aprobar(cambioId);
    assert.equal(aprobacion.status, 200, JSON.stringify(aprobacion.body));
    assert.strictEqual((await datasetPorTitulo(titulo)).requiere_nota, null);
  });

  it('un cambio con la clave en null la deja NULL, y con 0 la deja en 0', async () => {
    const id = await cargarDataset({ requiereNota: 1 });
    assert.equal((await aprobar(await insertarCambio('editar', id, { requiere_nota: null }))).status, 200);
    assert.strictEqual(await requiereNotaEnDb(id), null);

    const titulo = `${PREFIJO_TEST} alta vieja con cero`;
    const aprobacion = await aprobar(await insertarCambio('crear', null, { ...alta({ titulo }), requiere_nota: 0, formatos: [cat.formatoId] }));
    assert.equal(aprobacion.status, 200, JSON.stringify(aprobacion.body));
    assert.strictEqual((await datasetPorTitulo(titulo)).requiere_nota, 0);
  });
});

describe('GET /datasets: el dato viaja en la ficha', () => {
  it('trae requiere_nota (0, 1 o null) tal como está guardado', async () => {
    for (const guardado of [0, 1, null]) {
      const id = await cargarDataset({ requiereNota: guardado });
      const res = await api.get(`/datasets/${id}`);
      assert.equal(res.status, 200);
      assert.strictEqual(res.body.data.requiere_nota, guardado);
    }
  });
});
