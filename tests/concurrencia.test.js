// Pedidos simultáneos sobre la doble verificación (doble click, dos admins a la vez)
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

const proponerAlta = async (titulo) => {
  const res = await api.post('/datasets', {
    titulo, area_id: cat.areaId, frecuencia_id: cat.frecuenciaId, tema_principal_id: cat.temaId,
    tipo_gestion: 'interna', formatos: [cat.formatoId]
  }, { token: usuarios.adminA.token });
  assert.equal(res.status, 201);
  return res.body.data.cambio_pendiente_id;
};

const crearDatasetAprobado = async (titulo) => {
  const cambioId = await proponerAlta(titulo);
  const res = await api.post(`/cambios-pendientes/${cambioId}/aprobar`, {}, { token: usuarios.adminB.token });
  assert.equal(res.status, 200);
  return res.body.data.dataset_id;
};

const contar = (lista, status) => lista.filter(r => r.status === status).length;

describe('aprobaciones simultáneas', () => {
  it('aprobar el mismo alta 5 veces a la vez crea un solo dataset', async () => {
    const titulo = `${PREFIJO_TEST} doble click en aprobar`;
    const cambioId = await proponerAlta(titulo);

    const respuestas = await Promise.all(Array.from({ length: 5 }, () =>
      api.post(`/cambios-pendientes/${cambioId}/aprobar`, {}, { token: usuarios.adminB.token })
    ));

    assert.equal(contar(respuestas, 200), 1, 'solo una aprobación debe tener éxito');
    assert.equal(contar(respuestas, 404), 4, 'las demás deben avisar que ya fue procesado');
    const creados = await query('SELECT id FROM datasets WHERE titulo = ?', [titulo]);
    assert.equal(creados.length, 1);
  });

  it('aprobar y rechazar a la vez deja un resultado coherente', async () => {
    for (let ronda = 1; ronda <= 5; ronda++) {
      const id = await crearDatasetAprobado(`${PREFIJO_TEST} carrera ${ronda}`);
      const nuevoTitulo = `${PREFIJO_TEST} carrera ${ronda} editado`;
      const edicion = await api.put(`/datasets/${id}`, { titulo: nuevoTitulo }, { token: usuarios.adminA.token });
      const cambioId = edicion.body.data.cambio_pendiente_id;

      const [aprobacion, rechazo] = await Promise.all([
        api.post(`/cambios-pendientes/${cambioId}/aprobar`, {}, { token: usuarios.adminB.token }),
        api.post(`/cambios-pendientes/${cambioId}/rechazar`, { comentario: 'carrera' }, { token: usuarios.adminB.token })
      ]);

      assert.equal(contar([aprobacion, rechazo], 200), 1, `ronda ${ronda}: solo una de las dos acciones debe tener éxito`);
      const [cambio] = await query('SELECT estado FROM cambios_pendientes WHERE id = ?', [cambioId]);
      const [dataset] = await query('SELECT titulo FROM datasets WHERE id = ?', [id]);
      if (aprobacion.status === 200) {
        assert.equal(cambio.estado, 'aprobado', `ronda ${ronda}`);
        assert.equal(dataset.titulo, nuevoTitulo, `ronda ${ronda}`);
      } else {
        assert.equal(cambio.estado, 'rechazado', `ronda ${ronda}`);
        assert.notEqual(dataset.titulo, nuevoTitulo, `ronda ${ronda}: un cambio rechazado no debe aplicarse`);
      }
    }
  });
});

describe('propuestas simultáneas', () => {
  it('dos admins proponiendo cambios al mismo dataset a la vez dejan un solo pendiente', async () => {
    const id = await crearDatasetAprobado(`${PREFIJO_TEST} propuestas simultáneas`);

    const respuestas = await Promise.all(Array.from({ length: 6 }, (_, i) => {
      const autor = i % 2 === 0 ? usuarios.adminA : usuarios.adminB;
      return api.put(`/datasets/${id}`, { titulo: `${PREFIJO_TEST} propuesta ${i}` }, { token: autor.token });
    }));

    const pendientes = await query(
      "SELECT id FROM cambios_pendientes WHERE dataset_id = ? AND estado = 'pendiente'", [id]
    );
    assert.equal(pendientes.length, 1, 'el dataset debe quedar con un solo cambio pendiente');
    assert.equal(contar(respuestas, 200), 1);
    assert.equal(contar(respuestas, 409), 5);
  });
});
