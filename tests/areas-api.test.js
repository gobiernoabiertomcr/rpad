// API de Áreas (spec 2026-10-24-configuracion, 5): los datos de contacto del área solo para una sesión de administración (con
// las tres cuentas y `vista: 'administracion'`), también en la API de datasets; la validación del alta y de la edición, con
// `campo`; y el borrado, que cuenta los datasets dados de baja y los cambios pendientes y nunca da 500. Las rutas GET siguen
// siendo públicas: sin sesión, con un token inválido o de una cuenta desactivada, responden la forma pública, nunca 401.
// Contra una base de prueba propia.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { crearArea, crearDataset, limpiarBase, asegurarBaseDePrueba } from './notas-fixtures.js';
import {
  CAMPOS_DE_CONTACTO_AREA, CAMPOS_DE_CONTACTO_DATASET, MENSAJES_AREA, textoNoSePuedeBorrar
} from '../services/areasReglas.js';

let base, servidor, api, usuarios, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_areas_api');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, {
    superadmin: 'superadmin', admin: 'admin', editor: 'editor', lector: 'lector', colab: 'colaborador', baja: 'admin'
  });
  // Una cuenta desactivada después de iniciar sesión: su token sigue firmado, pero la sesión ya no vale
  await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [usuarios.baja.id]);
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
  // limpiarBase no borra las altas pendientes (dataset_id NULL): acá se borran todas
  await query('DELETE FROM cambios_pendientes');
});

const como = (clave) => ({ token: usuarios[clave].token });

// Datos de contacto inventados
const CONTACTO = Object.freeze({
  email_principal: 'mesa@area.test', email_secundario: 'otra@area.test', telefono_area: '297 400-0000',
  celular_area: '297 15 400-0000', nombre_contacto: 'Contacto Inventado', telefono_contacto: '297 400-0001',
  email_contacto: 'contacto@area.test'
});

const CUENTAS = ['datasets_dados_de_baja', 'datasets_externos_con_nota', 'cambios_pendientes_que_la_usan'];

// Lo que sale en la forma pública (spec 5.1): sin los datos de contacto y sin las cuentas de administración
const CLAVES_PUBLICAS = [
  'ambito', 'area_superior', 'articulo', 'articulo_superior', 'cantidad_datasets', 'created_at', 'id', 'nombre', 'updated_at'
];

const SIN_ADMINISTRACION = [
  ['sin token', () => ({})],
  ['el lector', () => como('lector')],
  ['el colaborador', () => como('colab')],
  ['un token que no es válido', () => ({ token: 'x.y.z' })],
  ['una cuenta desactivada', () => como('baja')]
];

const CON_ADMINISTRACION = [
  ['el superadmin', () => como('superadmin')],
  ['el admin', () => como('admin')],
  ['el editor', () => como('editor')]
];

// La fila del área en GET /areas y en GET /areas/:id (las dos tienen que dar lo mismo)
const filasDelArea = async (id, opciones = como('admin')) => {
  const lista = await api.get('/areas', opciones);
  const una = await api.get(`/areas/${id}`, opciones);
  assert.equal(lista.status, 200, JSON.stringify(lista.body));
  assert.equal(una.status, 200, JSON.stringify(una.body));
  return { lista, una, deLaLista: lista.body.data.find((a) => a.id === id), sola: una.body.data };
};

const cuentasDe = async (id) => {
  const { deLaLista, sola } = await filasDelArea(id);
  const cuentas = (fila) => Object.fromEntries(['cantidad_datasets', ...CUENTAS].map((c) => [c, fila[c]]));
  assert.deepEqual(cuentas(sola), cuentas(deLaLista));
  return cuentas(sola);
};

const cambioPendiente = ({ datosNuevos, estado = 'pendiente', tipo = 'crear' }) => query(
  `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id, estado) VALUES (?, NULL, ?, ?, ?)`,
  [tipo, JSON.stringify(datosNuevos), usuarios.admin.id, estado]
);

const areaEnLaBase = async (id) => (await query('SELECT * FROM areas WHERE id = ?', [id]))[0];

describe('quién ve los datos de contacto del área', () => {
  for (const [quien, opciones] of SIN_ADMINISTRACION) {
    it(`${quien}: 200 en /areas y /areas/:id, sin los datos de contacto, sin las cuentas y sin vista`, async () => {
      const id = await crearArea({ nombre: 'Área con contacto', ...CONTACTO });
      await crearDataset({ titulo: 'Dataset del área', areaId: id, vencimiento: '2027-06-30', gestion: 'externa' });
      const { lista, una, deLaLista, sola } = await filasDelArea(id, opciones());

      for (const res of [lista, una]) {
        assert.equal(res.body.success, true);
        assert.equal('vista' in res.body, false);
      }
      for (const fila of [...lista.body.data, sola]) {
        assert.deepEqual(Object.keys(fila).sort(), CLAVES_PUBLICAS);
        for (const campo of [...CAMPOS_DE_CONTACTO_AREA, ...CUENTAS]) assert.equal(campo in fila, false, campo);
      }
      for (const fila of [deLaLista, sola]) {
        assert.equal(fila.nombre, 'Área con contacto');
        assert.equal(fila.articulo, 'la');
        assert.equal(fila.cantidad_datasets, 1);
      }
    });
  }

  for (const [quien, opciones] of CON_ADMINISTRACION) {
    it(`${quien}: vista 'administracion', con los siete datos de contacto y las tres cuentas`, async () => {
      const id = await crearArea({ nombre: 'Área con contacto', ...CONTACTO });
      const { lista, una, deLaLista, sola } = await filasDelArea(id, opciones());

      for (const res of [lista, una]) {
        assert.equal(res.body.success, true);
        assert.equal(res.body.vista, 'administracion');
      }
      for (const fila of [deLaLista, sola]) {
        for (const campo of CAMPOS_DE_CONTACTO_AREA) assert.equal(fila[campo], CONTACTO[campo], campo);
        for (const campo of ['cantidad_datasets', ...CUENTAS]) assert.equal(fila[campo], 0, campo);
        assert.equal(fila.nombre, 'Área con contacto');
      }
    });
  }
});

describe('las cuentas de administración', () => {
  it('un dataset activo externo, sin dato de «Requiere nota» y con una frecuencia que vence, recibe el email de los 40 días', async () => {
    const id = await crearArea({ nombre: 'Área de las cuentas' });
    const dataset = await crearDataset({ areaId: id, vencimiento: '2027-06-30', gestion: 'externa', frecuencia: 'Anualmente' });
    assert.deepEqual(await cuentasDe(id), {
      cantidad_datasets: 1, datasets_dados_de_baja: 0, datasets_externos_con_nota: 1, cambios_pendientes_que_la_usan: 0
    });

    await query('UPDATE datasets SET requiere_nota = 1 WHERE id = ?', [dataset]);
    assert.equal((await cuentasDe(id)).datasets_externos_con_nota, 1);

    await query('UPDATE datasets SET requiere_nota = 0 WHERE id = ?', [dataset]);
    assert.equal((await cuentasDe(id)).datasets_externos_con_nota, 0);
  });

  it('con la frecuencia eventual (sin días), no cuenta', async () => {
    const id = await crearArea({ nombre: 'Área de las cuentas' });
    await crearDataset({ areaId: id, gestion: 'externa', frecuencia: 'Eventual' });
    const cuentas = await cuentasDe(id);
    assert.equal(cuentas.cantidad_datasets, 1);
    assert.equal(cuentas.datasets_externos_con_nota, 0);
  });

  it('uno de gestión interna no cuenta como externo con nota', async () => {
    const id = await crearArea({ nombre: 'Área de las cuentas' });
    await crearDataset({ areaId: id, vencimiento: '2027-06-30', gestion: 'interna' });
    assert.equal((await cuentasDe(id)).datasets_externos_con_nota, 0);
  });

  it('uno dado de baja suma a datasets_dados_de_baja, no a cantidad_datasets ni a los externos con nota', async () => {
    const id = await crearArea({ nombre: 'Área de las cuentas' });
    await crearDataset({ areaId: id, vencimiento: '2027-06-30', gestion: 'externa', activo: 0 });
    assert.deepEqual(await cuentasDe(id), {
      cantidad_datasets: 0, datasets_dados_de_baja: 1, datasets_externos_con_nota: 0, cambios_pendientes_que_la_usan: 0
    });
  });

  it('cuenta los cambios pendientes que la eligen, con el area_id como número o como texto; uno aprobado no', async () => {
    const id = await crearArea({ nombre: 'Área de los pendientes' });
    const otra = await crearArea({ nombre: 'Otra área' });
    await cambioPendiente({ datosNuevos: { titulo: 'Alta pendiente', area_id: id } });
    await cambioPendiente({ datosNuevos: { titulo: 'Alta pendiente en texto', area_id: String(id) }, tipo: 'editar' });
    await cambioPendiente({ datosNuevos: { titulo: 'Alta aprobada', area_id: id }, estado: 'aprobado' });
    await cambioPendiente({ datosNuevos: { titulo: 'Alta rechazada', area_id: id }, estado: 'rechazado' });
    await cambioPendiente({ datosNuevos: { titulo: 'Alta de otra área', area_id: otra } });
    await cambioPendiente({ datosNuevos: { titulo: 'Edición sin área' }, tipo: 'editar' });

    assert.equal((await cuentasDe(id)).cambios_pendientes_que_la_usan, 2);
    assert.equal((await cuentasDe(otra)).cambios_pendientes_que_la_usan, 1);
  });
});

describe('los datos de contacto del área en la API de datasets', () => {
  let areaId, datasetId;
  beforeEach(async () => {
    areaId = await crearArea({ nombre: 'Área del dataset', area_superior: 'Secretaría Inventada', ...CONTACTO });
    datasetId = await crearDataset({ titulo: 'Dataset con área', areaId, vencimiento: '2027-06-30', gestion: 'externa' });
  });

  for (const [quien, opciones] of SIN_ADMINISTRACION) {
    it(`${quien}: /datasets y /datasets/:id sin los datos de contacto, con el nombre y la dependencia del área`, async () => {
      const lista = await api.get('/datasets', opciones());
      const uno = await api.get(`/datasets/${datasetId}`, opciones());
      assert.equal(lista.status, 200, JSON.stringify(lista.body));
      assert.equal(uno.status, 200, JSON.stringify(uno.body));
      const deLaLista = lista.body.data.find((d) => d.id === datasetId);
      assert.ok(deLaLista, 'el dataset está en la lista');
      for (const fila of [...lista.body.data, uno.body.data]) {
        for (const campo of CAMPOS_DE_CONTACTO_DATASET) assert.equal(campo in fila, false, campo);
      }
      for (const fila of [deLaLista, uno.body.data]) {
        assert.equal(fila.titulo, 'Dataset con área');
        assert.equal(fila.area_nombre, 'Área del dataset');
        assert.equal(fila.area_superior, 'Secretaría Inventada');
      }
      assert.ok(Array.isArray(uno.body.data.formatos_array));
    });
  }

  for (const [quien, opciones] of CON_ADMINISTRACION) {
    it(`${quien}: /datasets y /datasets/:id con los datos de contacto, como siempre`, async () => {
      const lista = await api.get('/datasets', opciones());
      const uno = await api.get(`/datasets/${datasetId}`, opciones());
      for (const fila of [lista.body.data.find((d) => d.id === datasetId), uno.body.data]) {
        assert.equal(fila.area_contacto_nombre, 'Contacto Inventado');
        assert.equal(fila.area_email_principal, 'mesa@area.test');
        assert.equal(fila.area_contacto_email, 'contacto@area.test');
      }
    });
  }
});

describe('POST /areas', () => {
  const crear = (datos) => api.post('/areas', datos, como('admin'));

  it('sin nombre (solo espacios), 400 en el campo nombre y no se crea', async () => {
    const res = await crear({ nombre: '   ' });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { success: false, error: 'Escribí el nombre del área.', campo: 'nombre' });
    assert.equal((await query('SELECT COUNT(*) AS n FROM areas'))[0].n, 0);
  });

  it('con el nombre de otra área en otras mayúsculas o sin tilde, 400 nombreRepetido en nombre', async () => {
    await crearArea({ nombre: 'Dirección de Tránsito' });
    for (const nombre of ['DIRECCIÓN DE TRÁNSITO', 'direccion de transito', '  Dirección de Tránsito  ']) {
      const res = await crear({ nombre });
      assert.equal(res.status, 400, nombre);
      assert.deepEqual(res.body, { success: false, error: MENSAJES_AREA.nombreRepetido, campo: 'nombre' });
    }
    assert.equal((await query('SELECT COUNT(*) AS n FROM areas'))[0].n, 1);
  });

  it("el alta rápida de admin.js ({ nombre }) sigue andando: 201, con artículo 'la' y lo demás en NULL", async () => {
    const res = await crear({ nombre: 'Nueva' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'Área creada correctamente');
    assert.equal(res.body.data.nombre, 'Nueva');
    assert.equal(res.body.data.articulo, 'la');
    assert.equal(res.body.data.ambito, 'municipal');
    const guardada = await areaEnLaBase(res.body.data.id);
    assert.equal(guardada.articulo, 'la');
    // El INSERT escribe NULL, no el DEFAULT de la columna ('la')
    assert.equal(guardada.articulo_superior, null);
    assert.equal(guardada.area_superior, null);
    for (const campo of CAMPOS_DE_CONTACTO_AREA) assert.equal(guardada[campo], null, campo);
  });

  it('guarda los textos recortados y los vacíos como NULL', async () => {
    const res = await crear({
      nombre: '  Área con espacios  ', articulo: 'el', area_superior: '  Secretaría Inventada ', articulo_superior: '',
      email_principal: ' mesa@area.test ', email_secundario: '   ', nombre_contacto: ' Contacto Inventado '
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const guardada = await areaEnLaBase(res.body.data.id);
    assert.equal(guardada.nombre, 'Área con espacios');
    assert.equal(guardada.articulo, 'el');
    assert.equal(guardada.area_superior, 'Secretaría Inventada');
    assert.equal(guardada.articulo_superior, null);
    assert.equal(guardada.email_principal, 'mesa@area.test');
    assert.equal(guardada.email_secundario, null);
    assert.equal(guardada.nombre_contacto, 'Contacto Inventado');
  });

  it('con un email que no sirve, 400 en su campo y no se crea', async () => {
    const res = await crear({ nombre: 'Área del email', email_secundario: 'x@' });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { success: false, error: MENSAJES_AREA.email, campo: 'email_secundario' });
    assert.equal((await query('SELECT COUNT(*) AS n FROM areas'))[0].n, 0);
  });

  it('dos altas simultáneas con el mismo nombre: una se crea y las demás dan 400 nombreRepetido, nunca 500', async () => {
    const respuestas = await Promise.all(Array.from({ length: 8 }, () => crear({ nombre: 'Área simultánea' })));
    const creadas = respuestas.filter((r) => r.status === 201);
    const repetidas = respuestas.filter((r) => r.status === 400);
    assert.equal(creadas.length, 1, JSON.stringify(respuestas.map((r) => r.status)));
    assert.equal(repetidas.length, respuestas.length - 1);
    for (const r of repetidas) assert.deepEqual(r.body, { success: false, error: MENSAJES_AREA.nombreRepetido, campo: 'nombre' });
  });
});

describe('PUT /areas/:id', () => {
  const actualizar = (id, datos) => api.put(`/areas/${id}`, datos, como('admin'));

  it("con { nombre: '' }, 400 en nombre y el nombre guardado no cambia", async () => {
    const id = await crearArea({ nombre: 'Área que conserva el nombre' });
    const res = await actualizar(id, { nombre: '' });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { success: false, error: MENSAJES_AREA.nombre, campo: 'nombre' });
    assert.equal((await areaEnLaBase(id)).nombre, 'Área que conserva el nombre');
  });

  it('con solo { email_contacto: "x@" }, 400 en email_contacto', async () => {
    const id = await crearArea({ nombre: 'Área del email' });
    const res = await actualizar(id, { email_contacto: 'x@' });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { success: false, error: MENSAJES_AREA.email, campo: 'email_contacto' });
    assert.equal((await areaEnLaBase(id)).email_contacto, null);
  });

  it('con un email que no sirve guardado por SQL, una edición que no lo toca se guarda', async () => {
    const id = await crearArea({ nombre: 'Área con un email viejo', email_principal: 'viejo@' });
    const res = await actualizar(id, { telefono_area: '297 1' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'Área actualizada correctamente');
    assert.equal(res.body.data.telefono_area, '297 1');
    const guardada = await areaEnLaBase(id);
    assert.equal(guardada.telefono_area, '297 1');
    assert.equal(guardada.email_principal, 'viejo@');

    // El formulario completo, con el mismo email viejo, también
    const completo = await actualizar(id, { nombre: 'Área con un email viejo', email_principal: 'viejo@', telefono_area: '297 2' });
    assert.equal(completo.status, 200, JSON.stringify(completo.body));
  });

  it('con {}, 400 "No hay datos para actualizar"', async () => {
    const id = await crearArea({ nombre: 'Área sin cambios' });
    const res = await actualizar(id, {});
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { success: false, error: 'No hay datos para actualizar' });
  });

  it('la edición es parcial: escribe solo lo que vino, recortado', async () => {
    const id = await crearArea({ nombre: 'Área parcial', articulo: 'el', ...CONTACTO });
    const res = await actualizar(id, { nombre: '  Área parcial renombrada ', celular_area: '' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const guardada = await areaEnLaBase(id);
    assert.equal(guardada.nombre, 'Área parcial renombrada');
    assert.equal(guardada.articulo, 'el');
    assert.equal(guardada.celular_area, null);
    for (const campo of CAMPOS_DE_CONTACTO_AREA.filter((c) => c !== 'celular_area')) {
      assert.equal(guardada[campo], CONTACTO[campo], campo);
    }
  });

  it('con el nombre de otra área (en otras mayúsculas), 400 nombreRepetido; el suyo propio en otras mayúsculas, se guarda', async () => {
    await crearArea({ nombre: 'Dirección de Tránsito' });
    const id = await crearArea({ nombre: 'Dirección de Obras' });
    const repetido = await actualizar(id, { nombre: 'direccion de transito' });
    assert.equal(repetido.status, 400);
    assert.deepEqual(repetido.body, { success: false, error: MENSAJES_AREA.nombreRepetido, campo: 'nombre' });
    assert.equal((await areaEnLaBase(id)).nombre, 'Dirección de Obras');

    const propio = await actualizar(id, { nombre: 'DIRECCIÓN DE OBRAS' });
    assert.equal(propio.status, 200, JSON.stringify(propio.body));
    assert.equal((await areaEnLaBase(id)).nombre, 'DIRECCIÓN DE OBRAS');
  });

  it('un id que no es un entero positivo o que no existe da 404', async () => {
    for (const id of ['abc', '0', '-3', '1.5', '999999']) {
      const res = await actualizar(id, { nombre: 'Cualquiera' });
      assert.equal(res.status, 404, id);
      assert.deepEqual(res.body, { success: false, error: 'Área no encontrada' });
    }
  });
});

describe('GET /areas/:id', () => {
  it('un id que no es un entero positivo o que no existe da 404, con sesión y sin ella', async () => {
    for (const opciones of [{}, como('admin')]) {
      for (const id of ['abc', '0', '-3', '1.5', '999999']) {
        const res = await api.get(`/areas/${id}`, opciones);
        assert.equal(res.status, 404, id);
        assert.deepEqual(res.body, { success: false, error: 'Área no encontrada' });
      }
    }
  });
});

describe('DELETE /areas/:id', () => {
  const borrar = (id) => api.delete(`/areas/${id}`, como('admin'));

  it('con un dataset dado de baja, 400 con el texto de los datasets (nunca 500) y el área sigue', async () => {
    const id = await crearArea({ nombre: 'Área con un dado de baja' });
    await crearDataset({ areaId: id, vencimiento: '2027-06-30', activo: 0 });
    const res = await borrar(id);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: false, error: textoNoSePuedeBorrar({ activos: 0, deBaja: 1, pendientes: 0 }) });
    assert.ok(await areaEnLaBase(id));
  });

  it('con datasets activos y dados de baja, el texto los cuenta a todos', async () => {
    const id = await crearArea({ nombre: 'Área con datasets' });
    await crearDataset({ areaId: id, vencimiento: '2027-06-30' });
    await crearDataset({ areaId: id, vencimiento: '2027-06-30' });
    await crearDataset({ areaId: id, vencimiento: '2027-06-30', activo: 0 });
    await cambioPendiente({ datosNuevos: { titulo: 'Alta pendiente', area_id: id } });
    const res = await borrar(id);
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { success: false, error: textoNoSePuedeBorrar({ activos: 2, deBaja: 1, pendientes: 1 }) });
    assert.ok(await areaEnLaBase(id));
  });

  it('con un alta pendiente que la elige con el area_id en texto, 400 con el texto de los pendientes', async () => {
    const id = await crearArea({ nombre: 'Área de un alta pendiente' });
    await cambioPendiente({ datosNuevos: { titulo: 'Alta pendiente', area_id: String(id) } });
    const res = await borrar(id);
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { success: false, error: textoNoSePuedeBorrar({ activos: 0, deBaja: 0, pendientes: 1 }) });
    assert.ok(await areaEnLaBase(id));
  });

  it('sin datasets ni cambios pendientes (uno aprobado no cuenta), 200 y ya no existe', async () => {
    const id = await crearArea({ nombre: 'Área para borrar' });
    await cambioPendiente({ datosNuevos: { titulo: 'Alta aprobada', area_id: id }, estado: 'aprobado' });
    const res = await borrar(id);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, message: 'Área eliminada correctamente' });
    assert.equal(await areaEnLaBase(id), undefined);
  });

  it('si igual choca con la clave foránea (una carrera), 400 con el mensaje enUso, nunca 500', async () => {
    const id = await crearArea({ nombre: 'Área de la carrera' });
    await asegurarBaseDePrueba();
    // Mientras se borra, otro pedido le suma un dataset: el trigger lo inserta antes del DELETE, que choca con fk_datasets_area
    await query('DROP TRIGGER IF EXISTS carrera_simulada');
    await query(`CREATE TRIGGER carrera_simulada BEFORE DELETE ON areas FOR EACH ROW
      INSERT INTO datasets (titulo, area_id, frecuencia_id, tema_principal_id)
      VALUES ('Dataset de la carrera', OLD.id, (SELECT id FROM frecuencias ORDER BY id LIMIT 1), (SELECT id FROM temas ORDER BY id LIMIT 1))`);
    try {
      const res = await borrar(id);
      assert.equal(res.status, 400, JSON.stringify(res.body));
      assert.deepEqual(res.body, { success: false, error: MENSAJES_AREA.enUso });
    } finally {
      await query('DROP TRIGGER IF EXISTS carrera_simulada');
    }
    assert.ok(await areaEnLaBase(id));
  });

  it('un id que no es un entero positivo o que no existe da 404', async () => {
    for (const id of ['abc', '0', '-3', '1.5', '999999']) {
      const res = await borrar(id);
      assert.equal(res.status, 404, id);
      assert.deepEqual(res.body, { success: false, error: 'Área no encontrada' });
    }
  });
});

// Las direcciones viejas llevan a Configuración (spec 2026-10-24-configuracion, 3): 302, antes del estático (mientras
// public/usuarios.html y public/areas.html existan, este test prueba también que nunca se sirven). La de usuarios.html va sin
// fragmento: el navegador conserva el del link original (usuarios.html#licencias llega a configuracion.html#licencias)
describe('las direcciones viejas', () => {
  for (const [vieja, nueva] of [['/usuarios.html', '/configuracion.html'], ['/areas.html', '/configuracion.html#areas']]) {
    it(`GET ${vieja}: 302 a ${nueva}, sin servir la página vieja`, async () => {
      const res = await fetch(`${servidor.url}${vieja}`, { redirect: 'manual' });
      assert.equal(res.status, 302);
      assert.equal(res.headers.get('location'), nueva);
      assert.ok(!(await res.text()).includes('<!DOCTYPE html>'), 'no sirve la página vieja');
    });
  }
});
