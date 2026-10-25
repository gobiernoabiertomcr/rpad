// El ámbito del área en la API de Áreas (spec 2026-10-24-generador-de-notas, sección 2): municipal o fuera del municipio
// ('externo'). Al crear es opcional y por defecto 'municipal'; al actualizar, si llega, se valida y se escribe tal cual (nunca
// `|| null`). Otro valor da 400 en el campo 'ambito'. Contra una base de prueba propia.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { AMBITOS, MENSAJE_AMBITO } from '../controllers/areasController.js';

let base, servidor, api, usuarios, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_areas_ambito');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, { adminA: 'admin' });
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

const comoAdmin = () => ({ token: usuarios.adminA.token });

let numero = 0;
const nombreNuevo = () => `Área del ámbito ${++numero}`;

const crear = (datos) => api.post('/areas', datos, comoAdmin());
const actualizar = (id, datos) => api.put(`/areas/${id}`, datos, comoAdmin());
const ambitoEnLaBase = async (id) => (await query('SELECT ambito FROM areas WHERE id = ?', [id]))[0].ambito;

const RECHAZO = { success: false, error: MENSAJE_AMBITO, campo: 'ambito', errores: { ambito: MENSAJE_AMBITO } };
const VALORES_INVALIDOS = ['otro', '', 'Externo', 'MUNICIPAL', ' externo', null, 1, true, ['externo'], { valor: 'externo' }];

describe('las constantes', () => {
  it('AMBITOS y MENSAJE_AMBITO', () => {
    assert.deepEqual(AMBITOS, ['municipal', 'externo']);
    assert.equal(MENSAJE_AMBITO, 'Elegí si el área es municipal o de fuera del municipio.');
  });
});

describe('POST /areas', () => {
  it('sin ambito, el área queda municipal', async () => {
    const res = await crear({ nombre: nombreNuevo() });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.ambito, 'municipal');
    assert.equal(await ambitoEnLaBase(res.body.data.id), 'municipal');
  });

  it("con 'externo', queda fuera del municipio", async () => {
    const res = await crear({ nombre: nombreNuevo(), ambito: 'externo' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.ambito, 'externo');
    assert.equal(await ambitoEnLaBase(res.body.data.id), 'externo');
  });

  it("con 'municipal', queda municipal", async () => {
    const res = await crear({ nombre: nombreNuevo(), ambito: 'municipal' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.ambito, 'municipal');
  });

  for (const valor of VALORES_INVALIDOS) {
    it(`con ${JSON.stringify(valor)}, 400 en el campo ambito y no se crea`, async () => {
      const nombre = nombreNuevo();
      const res = await crear({ nombre, ambito: valor });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, RECHAZO);
      assert.equal((await query('SELECT COUNT(*) AS n FROM areas WHERE nombre = ?', [nombre]))[0].n, 0);
    });
  }
});

describe('PUT /areas/:id', () => {
  it('actualizar solo el ambito lo cambia y no toca lo demás', async () => {
    const nombre = nombreNuevo();
    const creada = (await crear({ nombre, articulo: 'el', area_superior: 'Subsecretaría de Prueba', email_principal: 'area@ejemplo.gob.ar' })).body.data;
    assert.equal(creada.ambito, 'municipal');

    const res = await actualizar(creada.id, { ambito: 'externo' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.ambito, 'externo');
    assert.equal(res.body.data.nombre, nombre);
    assert.equal(res.body.data.articulo, 'el');
    assert.equal(res.body.data.area_superior, 'Subsecretaría de Prueba');
    assert.equal(res.body.data.email_principal, 'area@ejemplo.gob.ar');
    assert.equal(await ambitoEnLaBase(creada.id), 'externo');

    const deVuelta = await actualizar(creada.id, { ambito: 'municipal' });
    assert.equal(deVuelta.status, 200, JSON.stringify(deVuelta.body));
    assert.equal(await ambitoEnLaBase(creada.id), 'municipal');
  });

  it('actualizar el nombre sin ambito lo conserva', async () => {
    const creada = (await crear({ nombre: nombreNuevo(), ambito: 'externo' })).body.data;
    const otroNombre = nombreNuevo();
    const res = await actualizar(creada.id, { nombre: otroNombre });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.nombre, otroNombre);
    assert.equal(res.body.data.ambito, 'externo');
    assert.equal(await ambitoEnLaBase(creada.id), 'externo');
  });

  it('el formulario completo con el mismo ambito lo deja igual', async () => {
    const creada = (await crear({ nombre: nombreNuevo(), ambito: 'externo' })).body.data;
    const res = await actualizar(creada.id, {
      nombre: creada.nombre, articulo: 'la', area_superior: null, articulo_superior: null, ambito: 'externo',
      email_principal: null, email_secundario: null, telefono_area: null, celular_area: null,
      nombre_contacto: null, telefono_contacto: null, email_contacto: null
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(await ambitoEnLaBase(creada.id), 'externo');
  });

  for (const valor of VALORES_INVALIDOS) {
    it(`con ${JSON.stringify(valor)}, 400 en el campo ambito y el área no cambia`, async () => {
      const nombre = nombreNuevo();
      const creada = (await crear({ nombre, ambito: 'externo' })).body.data;
      const res = await actualizar(creada.id, { nombre: nombreNuevo(), ambito: valor });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, RECHAZO);
      const [fila] = await query('SELECT nombre, ambito FROM areas WHERE id = ?', [creada.id]);
      assert.deepEqual({ ...fila }, { nombre, ambito: 'externo' });
    });
  }

  it('un área que no existe sigue dando 404, aunque el ambito sea inválido', async () => {
    const res = await actualizar(999999, { ambito: 'otro' });
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });
});

describe('GET /areas', () => {
  it('trae el ambito de cada área', async () => {
    const municipal = (await crear({ nombre: nombreNuevo() })).body.data;
    const externa = (await crear({ nombre: nombreNuevo(), ambito: 'externo' })).body.data;
    const res = await api.get('/areas');
    assert.equal(res.status, 200);
    const porId = Object.fromEntries(res.body.data.map((a) => [a.id, a]));
    assert.equal(porId[municipal.id].ambito, 'municipal');
    assert.equal(porId[externa.id].ambito, 'externo');
    assert.ok(res.body.data.every((a) => AMBITOS.includes(a.ambito)));
  });

  it('GET /areas/:id también lo trae', async () => {
    const externa = (await crear({ nombre: nombreNuevo(), ambito: 'externo' })).body.data;
    const res = await api.get(`/areas/${externa.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.ambito, 'externo');
  });
});
