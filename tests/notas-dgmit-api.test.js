// Notas DGMIT en la API (spec 2026-10-24-notas-dgmit, secciones 2, 3 y 8): cargar, corregir y anular. Las tres rutas piden
// sesión y que el rol pueda cargar notas DGMIT (administración y el colaborador); corregir y anular, además, que sea quien la
// cargó o administración. Se guardan directo (sin doble verificación), en una transacción. El número no se repite entre las
// notas sin anular (sin importar mayúsculas ni los espacios de los extremos).
// Los datasets de prueba se cargan por SQL, con el prefijo [TEST]; el servidor es el real, sobre la base Docker local. Las
// notas de esos datasets (y las de los usuarios de prueba) se borran antes que los datasets: si no, quedarían huérfanas.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, catalogos, query, PREFIJO_TEST
} from './helpers.js';
import { hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';

let servidor, api, usuarios, cat;
const ds = {};
const creados = [];
const sufijo = crypto.randomBytes(3).toString('hex');

// Los textos, escritos a mano (los de la spec): si cambia uno en el servidor, este test lo marca
const MENSAJE = {
  numero: 'Escribí el número de la nota.',
  numeroLargo: 'El número de la nota puede tener hasta 40 caracteres.',
  recibida: 'Elegí la fecha en que el área recibió la nota.',
  recibidaFutura: 'La fecha de recepción no puede ser posterior a hoy.',
  recibidaVieja: 'La fecha de recepción no puede ser anterior al 01/01/2025.',
  tipo: 'Elegí si es una solicitud o una reiteración.',
  datasets: 'Elegí al menos un dataset.',
  motivo: 'Escribí el motivo.',
  motivoLargo: 'El motivo puede tener hasta 500 caracteres.'
};
const SIN_PERMISO = 'No tenés permiso para cargar notas DGMIT.';
const SOLO_QUIEN_LA_CARGO = 'Solo quien cargó la nota o administración pueden corregirla o anularla.';
const ANULADA = 'La nota está anulada: no se puede corregir ni volver a anular.';
const SIN_CAMBIOS = 'La corrección no cambia ningún dato de la nota.';
const NO_ENCONTRADA = 'Nota DGMIT no encontrada';
const repetido = (numero) => `Ya hay una nota DGMIT N° ${numero} cargada. Para sumarle datasets o cambiar algo, corregila.`;
const noSePuede = (titulo) =>
  `«${titulo}» no se puede elegir: solo los datasets activos de gestión externa que requieren nota DGMIT.`;

// Un dataset de prueba por SQL. requiereNota es lo que queda guardado (en gestión interna, siempre NULL)
const cargarDataset = async (nombre, { gestion = 'externa', requiereNota = 1, activo = 1 } = {}) => {
  const titulo = `${PREFIJO_TEST} nota DGMIT ${nombre} ${sufijo}`;
  const resultado = await query(
    `INSERT INTO datasets (titulo, area_id, frecuencia_id, tema_principal_id, tipo_gestion, requiere_nota, url_dataset, activo)
     VALUES (?, ?, ?, ?, ?, ?, 'https://datos.comodoro.gov.ar/dataset/test', ?)`,
    [titulo, cat.areaId, cat.frecuenciaId, cat.temaId, gestion, gestion === 'interna' ? null : requiereNota, activo]
  );
  creados.push(resultado.insertId);
  return { id: resultado.insertId, titulo };
};

before(async () => {
  servidor = await iniciarServidor();
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, {
    adminA: 'admin', editor: 'editor', colab: 'colaborador', colab2: 'colaborador', lector: 'lector'
  });
  cat = await catalogos();
  ds.si1 = await cargarDataset('externo con Sí 1');
  ds.si2 = await cargarDataset('externo con Sí 2');
  ds.sinDato = await cargarDataset('externo sin dato', { requiereNota: null });
  ds.no = await cargarDataset('externo con No', { requiereNota: 0 });
  ds.interno = await cargarDataset('interno', { gestion: 'interna' });
  ds.inactivo = await cargarDataset('externo dado de baja', { activo: 0 });
});

after(async () => {
  if (creados.length) {
    await query('DELETE FROM notas_dgmit WHERE id IN (SELECT nota_id FROM notas_dgmit_datasets WHERE dataset_id IN (?))', [creados]);
  }
  const ids = Object.values(usuarios ?? {}).map((u) => u.id);
  if (ids.length) await query('DELETE FROM notas_dgmit WHERE creado_por IN (?)', [ids]);
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
});

const como = (clave) => ({ token: usuarios[clave].token });

let numeros = 0;
// Números que no chocan con otras corridas: tienen letras, así se pueden mandar con otras mayúsculas
const numeroNuevo = () => `Nota-T5-${sufijo}-${++numeros}/26`;
const cuerpo = (extra = {}) => ({ numero: numeroNuevo(), recibida: '2026-10-01', tipo: 'solicitud', datasets: [ds.si1.id], ...extra });

const cargar = (quien, extra) => api.post('/notas-dgmit', cuerpo(extra), como(quien));
const corregir = (id, datos, quien = 'colab') => api.put(`/notas-dgmit/${id}`, datos, como(quien));
const anular = (id, motivo, quien = 'colab') =>
  api.post(`/notas-dgmit/${id}/anular`, motivo === undefined ? {} : { motivo }, como(quien));

// Carga una nota y devuelve lo que respondió el servidor (data), más el cuerpo que se mandó
const cargada = async (quien, extra) => {
  const enviado = cuerpo(extra);
  const res = await api.post('/notas-dgmit', enviado, como(quien));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { ...res.body.data, enviado };
};

const notaEnDb = async (id) => {
  const [fila] = await query(
    `SELECT numero, tipo, DATE_FORMAT(recibida, '%Y-%m-%d') AS recibida, anulada, creado_por FROM notas_dgmit WHERE id = ?`, [id]
  );
  if (!fila) return null;
  const datasets = (await query('SELECT dataset_id FROM notas_dgmit_datasets WHERE nota_id = ? ORDER BY dataset_id', [id]))
    .map((f) => f.dataset_id);
  return { ...fila, datasets };
};
const historialDe = async (id) =>
  (await query('SELECT accion, motivo, anteriores, usuario_id FROM notas_dgmit_historial WHERE nota_id = ? ORDER BY id', [id]))
    .map((f) => ({ ...f, anteriores: f.anteriores === null ? null : JSON.parse(f.anteriores) }));
const vigentesConNumero = async (numero) =>
  (await query('SELECT COUNT(*) AS n FROM notas_dgmit WHERE numero = ? AND anulada = 0', [numero]))[0].n;
const ascendente = (ids) => [...ids].sort((a, b) => a - b);

const esperarRechazo = (res, status, error, campo) => {
  assert.equal(res.status, status, JSON.stringify(res.body));
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, error);
  if (campo !== undefined) assert.equal(res.body.campo, campo);
};

// Va primero: si la base no tiene ninguna nota DGMIT (la de la rama arranca vacía y cada corrida borra las suyas), la primera
// ronda corre con la tabla vacía, el caso en que el SELECT … FOR UPDATE de las dos cargas no se bloquea entre sí
describe('cargas simultáneas (el número no se repite)', () => {
  it('dos cargas simultáneas del mismo número: una da 201 y la otra 409', async () => {
    for (let ronda = 1; ronda <= 4; ronda++) {
      const numero = numeroNuevo();
      // En las rondas pares, la segunda manda el número con otras mayúsculas y espacios
      const otro = ronda % 2 === 0 ? `  ${numero.toLowerCase()} ` : numero;
      const respuestas = await Promise.all([
        cargar('colab', { numero, datasets: [ds.si1.id] }),
        cargar('colab2', { numero: otro, datasets: [ds.si2.id] })
      ]);
      const detalle = `ronda ${ronda}: ${JSON.stringify(respuestas.map((r) => [r.status, r.body]))}`;
      assert.deepEqual(respuestas.map((r) => r.status).sort(), [201, 409], detalle);
      assert.equal(respuestas.find((r) => r.status === 409).body.campo, 'numero', detalle);
      assert.equal(await vigentesConNumero(numero), 1, detalle);
    }
  });

  it('una corrección y una carga simultáneas que llevan al mismo número: pasa una sola', async () => {
    for (let ronda = 1; ronda <= 3; ronda++) {
      const { id } = await cargada('colab');
      const numero = numeroNuevo();
      const respuestas = await Promise.all([
        corregir(id, { ...cuerpo({ numero }), motivo: 'Número mal copiado' }),
        cargar('colab2', { numero, datasets: [ds.si2.id] })
      ]);
      const detalle = `ronda ${ronda}: ${JSON.stringify(respuestas.map((r) => [r.status, r.body]))}`;
      assert.equal(respuestas.filter((r) => r.status === 200 || r.status === 201).length, 1, detalle);
      assert.equal(respuestas.filter((r) => r.status === 409).length, 1, detalle);
      assert.equal(await vigentesConNumero(numero), 1, detalle);
    }
  });
});

describe('cargar', () => {
  it('el colaborador carga una nota con dos datasets: 201, cabecera, detalle y creado_por', async () => {
    const numero = numeroNuevo();
    const res = await api.post('/notas-dgmit', {
      numero: `  ${numero}  `, recibida: '2026-09-15', tipo: 'solicitud', datasets: [ds.si2.id, ds.si1.id, ds.si2.id]
    }, como('colab'));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.success, true);
    const { data } = res.body;
    assert.ok(Number.isInteger(data.id) && data.id > 0);
    assert.deepEqual(data, { id: data.id, numero, tipo: 'solicitud', recibida: '2026-09-15', datasets: [ds.si2.id, ds.si1.id] });
    assert.deepEqual(await notaEnDb(data.id), {
      numero, tipo: 'solicitud', recibida: '2026-09-15', anulada: 0, creado_por: usuarios.colab.id,
      datasets: ascendente([ds.si1.id, ds.si2.id])
    });
    assert.deepEqual(await historialDe(data.id), [], 'una carga no deja historial');
  });

  it('el mensaje dice «cargada en 2 datasets»; con uno, «en 1 dataset»', async () => {
    const dos = await cargar('colab', { datasets: [ds.si1.id, ds.si2.id] });
    assert.equal(dos.status, 201, JSON.stringify(dos.body));
    assert.equal(dos.body.message, `Nota DGMIT N° ${dos.body.data.numero} (solicitud) cargada en 2 datasets.`);
    // Un externo sin dato de «Requiere nota DGMIT» se puede elegir (cuenta como Sí)
    const uno = await cargar('colab', { tipo: 'reiteracion', datasets: [ds.sinDato.id] });
    assert.equal(uno.status, 201, JSON.stringify(uno.body));
    assert.equal(uno.body.message, `Nota DGMIT N° ${uno.body.data.numero} (reiteración) cargada en 1 dataset.`);
  });

  it('cada campo inválido da 400 con su mensaje y su campo', async () => {
    const hoy = hoyArgentina();
    const casos = [
      [{ numero: '   ' }, 'numero', MENSAJE.numero],
      [{ numero: 'N'.repeat(41) }, 'numero', MENSAJE.numeroLargo],
      [{ recibida: '' }, 'recibida', MENSAJE.recibida],
      [{ recibida: '15/09/2026' }, 'recibida', MENSAJE.recibida],
      [{ recibida: sumarDias(hoy, 1) }, 'recibida', MENSAJE.recibidaFutura],
      [{ recibida: '2024-12-31' }, 'recibida', MENSAJE.recibidaVieja],
      [{ tipo: 'nota' }, 'tipo', MENSAJE.tipo],
      [{ datasets: [] }, 'datasets', MENSAJE.datasets],
      [{ datasets: ['abc'] }, 'datasets', MENSAJE.datasets]
    ];
    for (const [extra, campo, mensaje] of casos) {
      const enviado = cuerpo(extra);
      const res = await api.post('/notas-dgmit', enviado, como('colab'));
      esperarRechazo(res, 400, mensaje, campo);
      assert.deepEqual(res.body.errores, { [campo]: mensaje }, JSON.stringify(extra));
      if (campo !== 'numero') assert.equal(await vigentesConNumero(enviado.numero), 0, 'no se guardó nada');
    }
    // Con todo mal: el primero en el orden de los campos, y todos en errores
    const res = await api.post('/notas-dgmit', {}, como('colab'));
    esperarRechazo(res, 400, MENSAJE.numero, 'numero');
    assert.deepEqual(res.body.errores, {
      numero: MENSAJE.numero, recibida: MENSAJE.recibida, tipo: MENSAJE.tipo, datasets: MENSAJE.datasets
    });
    // Los bordes que sí pasan: 40 caracteres, el 01/01/2025 y hoy
    for (const extra of [{ numero: `${numeroNuevo()}-`.padEnd(40, 'x') }, { recibida: '2025-01-01' }, { recibida: hoy }]) {
      const ok = await cargar('colab', extra);
      assert.equal(ok.status, 201, `${JSON.stringify(extra)}: ${JSON.stringify(ok.body)}`);
    }
  });

  it('un dataset con No, interno, inactivo o que no existe da 400 con el texto de no se puede elegir', async () => {
    for (const clave of ['no', 'interno', 'inactivo']) {
      const enviado = cuerpo({ datasets: [ds.si1.id, ds[clave].id] });
      const res = await api.post('/notas-dgmit', enviado, como('colab'));
      esperarRechazo(res, 400, noSePuede(ds[clave].titulo), 'datasets');
      assert.equal(await vigentesConNumero(enviado.numero), 0, `${clave}: no se guardó nada`);
    }
    const [{ maximo }] = await query('SELECT MAX(id) AS maximo FROM datasets');
    const inexistente = maximo + 100000;
    const enviado = cuerpo({ datasets: [ds.si1.id, inexistente] });
    const res = await api.post('/notas-dgmit', enviado, como('colab'));
    esperarRechazo(res, 400, noSePuede(String(inexistente)), 'datasets');
    assert.equal(await vigentesConNumero(enviado.numero), 0);
  });

  it('el número repetido da 409, también con otras mayúsculas y espacios; una anulada no bloquea', async () => {
    const primera = await cargada('colab');
    const igual = await cargar('colab2', { numero: primera.numero, datasets: [ds.si2.id] });
    esperarRechazo(igual, 409, repetido(primera.numero), 'numero');
    const parecido = `  ${primera.numero.toUpperCase()}  `;
    const otraForma = await cargar('adminA', { numero: parecido });
    // El 409 dice el número como se mandó, sin los espacios de los extremos
    esperarRechazo(otraForma, 409, repetido(primera.numero.toUpperCase()), 'numero');
    assert.equal(await vigentesConNumero(primera.numero), 1);

    assert.equal((await anular(primera.id, 'Cargada por error')).status, 200);
    const despues = await cargar('colab2', { numero: primera.numero, datasets: [ds.si2.id] });
    assert.equal(despues.status, 201, JSON.stringify(despues.body));
    assert.equal(await vigentesConNumero(primera.numero), 1);
  });
});

describe('corregir', () => {
  it('el colaborador corrige la suya: historial con los anteriores, datasets que entran y salen', async () => {
    const original = await cargada('colab', { recibida: '2026-05-04', datasets: [ds.si2.id, ds.si1.id] });
    const numero = numeroNuevo();
    const res = await corregir(original.id, {
      numero: ` ${numero} `, recibida: '2026-05-05', tipo: 'reiteracion', datasets: [ds.si1.id, ds.sinDato.id],
      motivo: '  Número y fecha mal copiados  '
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, `Nota DGMIT N° ${numero} corregida.`);
    assert.deepEqual(res.body.data, {
      id: original.id, numero, tipo: 'reiteracion', recibida: '2026-05-05', datasets: [ds.si1.id, ds.sinDato.id]
    });
    assert.deepEqual(await notaEnDb(original.id), {
      numero, tipo: 'reiteracion', recibida: '2026-05-05', anulada: 0, creado_por: usuarios.colab.id,
      datasets: ascendente([ds.si1.id, ds.sinDato.id])
    });
    assert.deepEqual(await historialDe(original.id), [{
      accion: 'correccion',
      motivo: 'Número y fecha mal copiados',
      anteriores: { numero: original.numero, tipo: 'solicitud', recibida: '2026-05-04', datasets: ascendente([ds.si1.id, ds.si2.id]) },
      usuario_id: usuarios.colab.id
    }]);
  });

  it('corregir conservando el número no choca consigo misma', async () => {
    const original = await cargada('colab');
    const res = await corregir(original.id, { ...original.enviado, tipo: 'reiteracion', motivo: 'Era una reiteración' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    // También con otras mayúsculas: cambia el texto guardado, y sigue siendo la misma nota
    const mayusculas = await corregir(original.id, {
      ...original.enviado, numero: original.numero.toUpperCase(), tipo: 'reiteracion', motivo: 'Como figura en la nota'
    });
    assert.equal(mayusculas.status, 200, JSON.stringify(mayusculas.body));
    assert.equal((await notaEnDb(original.id)).numero, original.numero.toUpperCase());
  });

  it('una corrección sin cambios da 400', async () => {
    const original = await cargada('colab', { datasets: [ds.si1.id, ds.si2.id] });
    // Los mismos datasets en otro orden y el número con espacios: nada cambia
    const res = await corregir(original.id, {
      ...original.enviado, numero: ` ${original.numero} `, datasets: [ds.si2.id, ds.si1.id], motivo: 'Por las dudas'
    });
    esperarRechazo(res, 400, SIN_CAMBIOS);
    assert.deepEqual(await historialDe(original.id), []);
  });

  it('la corrección pide motivo, después de los demás campos', async () => {
    const original = await cargada('colab');
    const sinMotivo = await corregir(original.id, { ...original.enviado, tipo: 'reiteracion' });
    esperarRechazo(sinMotivo, 400, MENSAJE.motivo, 'motivo');
    assert.deepEqual(sinMotivo.body.errores, { motivo: MENSAJE.motivo });
    const largo = await corregir(original.id, { ...original.enviado, tipo: 'reiteracion', motivo: 'm'.repeat(501) });
    esperarRechazo(largo, 400, MENSAJE.motivoLargo, 'motivo');
    const conOtro = await corregir(original.id, { ...original.enviado, tipo: 'otro' });
    esperarRechazo(conOtro, 400, MENSAJE.tipo, 'tipo');
    assert.deepEqual(conOtro.body.errores, { tipo: MENSAJE.tipo, motivo: MENSAJE.motivo });
    assert.equal((await notaEnDb(original.id)).tipo, 'solicitud', 'no cambió nada');
  });

  it('en una corrección se acepta un dataset que ya estaba aunque hoy tenga No; uno nuevo con No da 400', async () => {
    const pasaANo = await cargarDataset('pasa a No');
    const original = await cargada('colab', { datasets: [ds.si1.id, pasaANo.id] });
    await query('UPDATE datasets SET requiere_nota = 0 WHERE id = ?', [pasaANo.id]);

    const conservando = await corregir(original.id, { ...original.enviado, recibida: '2026-09-30', motivo: 'Fecha mal copiada' });
    assert.equal(conservando.status, 200, JSON.stringify(conservando.body));
    assert.deepEqual((await notaEnDb(original.id)).datasets, ascendente([ds.si1.id, pasaANo.id]));

    const sumandoUnNo = await corregir(original.id, {
      ...original.enviado, datasets: [ds.si1.id, pasaANo.id, ds.no.id], motivo: 'Faltaba un dataset'
    });
    esperarRechazo(sumandoUnNo, 400, noSePuede(ds.no.titulo), 'datasets');
    assert.deepEqual((await notaEnDb(original.id)).datasets, ascendente([ds.si1.id, pasaANo.id]));
    assert.equal((await historialDe(original.id)).length, 1, 'solo la corrección que pasó');
  });

  it('una corrección no puede llevarse el número de otra nota vigente', async () => {
    const otra = await cargada('colab');
    const original = await cargada('colab');
    const res = await corregir(original.id, { ...original.enviado, numero: otra.numero, motivo: 'Número mal copiado' });
    esperarRechazo(res, 409, repetido(otra.numero), 'numero');
    assert.equal((await notaEnDb(original.id)).numero, original.numero);
  });
});

describe('permisos', () => {
  it('otro colaborador no corrige ni anula la nota ajena (403); el admin y el editor sí', async () => {
    const original = await cargada('colab');
    const corregida = { ...original.enviado, tipo: 'reiteracion', motivo: 'Era una reiteración' };
    esperarRechazo(await corregir(original.id, corregida, 'colab2'), 403, SOLO_QUIEN_LA_CARGO);
    esperarRechazo(await anular(original.id, 'No va', 'colab2'), 403, SOLO_QUIEN_LA_CARGO);
    assert.deepEqual(await historialDe(original.id), []);

    const porAdmin = await corregir(original.id, corregida, 'adminA');
    assert.equal(porAdmin.status, 200, JSON.stringify(porAdmin.body));
    const porEditor = await anular(original.id, 'Cargada dos veces', 'editor');
    assert.equal(porEditor.status, 200, JSON.stringify(porEditor.body));
    const historial = await historialDe(original.id);
    assert.deepEqual(historial.map((h) => [h.accion, h.usuario_id]), [
      ['correccion', usuarios.adminA.id], ['anulacion', usuarios.editor.id]
    ]);
    // Quien la cargó sigue siendo el colaborador
    assert.equal((await notaEnDb(original.id)).creado_por, usuarios.colab.id);
  });

  it('el lector recibe 403 en las tres rutas', async () => {
    const original = await cargada('colab');
    esperarRechazo(await cargar('lector'), 403, SIN_PERMISO);
    esperarRechazo(await corregir(original.id, { ...original.enviado, tipo: 'reiteracion', motivo: 'x' }, 'lector'), 403, SIN_PERMISO);
    esperarRechazo(await anular(original.id, 'x', 'lector'), 403, SIN_PERMISO);
    assert.equal((await notaEnDb(original.id)).anulada, 0);
  });
});

describe('anular', () => {
  it('anular pide motivo; anula, deja historial y no borra', async () => {
    const original = await cargada('colab', { datasets: [ds.si1.id, ds.si2.id] });
    const sinMotivo = await anular(original.id);
    esperarRechazo(sinMotivo, 400, MENSAJE.motivo, 'motivo');
    assert.deepEqual(sinMotivo.body.errores, { motivo: MENSAJE.motivo });
    esperarRechazo(await anular(original.id, '   '), 400, MENSAJE.motivo, 'motivo');
    esperarRechazo(await anular(original.id, 'm'.repeat(501)), 400, MENSAJE.motivoLargo, 'motivo');
    assert.equal((await notaEnDb(original.id)).anulada, 0);

    const res = await anular(original.id, '  Cargada dos veces  ');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, message: `Nota DGMIT N° ${original.numero} anulada.` });
    assert.deepEqual(await notaEnDb(original.id), {
      numero: original.numero, tipo: 'solicitud', recibida: '2026-10-01', anulada: 1, creado_por: usuarios.colab.id,
      datasets: ascendente([ds.si1.id, ds.si2.id])
    });
    assert.deepEqual(await historialDe(original.id), [
      { accion: 'anulacion', motivo: 'Cargada dos veces', anteriores: null, usuario_id: usuarios.colab.id }
    ]);
  });

  it('corregir o anular una anulada da 409', async () => {
    const original = await cargada('colab');
    assert.equal((await anular(original.id, 'Cargada por error')).status, 200);
    esperarRechazo(await corregir(original.id, { ...original.enviado, tipo: 'reiteracion', motivo: 'x' }), 409, ANULADA);
    esperarRechazo(await anular(original.id, 'Otra vez'), 409, ANULADA);
    // También para administración
    esperarRechazo(await anular(original.id, 'Otra vez', 'adminA'), 409, ANULADA);
    assert.equal((await historialDe(original.id)).length, 1);
  });
});

describe('otros', () => {
  it('un id que no es un entero positivo o no existe da 404', async () => {
    const [{ maximo }] = await query('SELECT COALESCE(MAX(id), 0) AS maximo FROM notas_dgmit');
    const datos = { ...cuerpo(), motivo: 'x' };
    for (const id of ['abc', '0', '-3', '1.5', '1e3', ' 7', String(maximo + 1000)]) {
      const ruta = encodeURIComponent(id);
      esperarRechazo(await corregir(ruta, datos), 404, NO_ENCONTRADA);
      esperarRechazo(await anular(ruta, 'x'), 404, NO_ENCONTRADA);
    }
  });

  it('las fechas se guardan como se mandan (sin correrse un día)', async () => {
    // El 1 de enero: si la fecha se leyera como un instante en UTC, en Argentina sería el 31 de diciembre
    const original = await cargada('colab', { recibida: '2026-01-01' });
    assert.equal(original.recibida, '2026-01-01');
    assert.equal((await notaEnDb(original.id)).recibida, '2026-01-01');
    const res = await corregir(original.id, { ...original.enviado, recibida: '2025-01-01', motivo: 'Fecha mal copiada' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.recibida, '2025-01-01');
    assert.equal((await notaEnDb(original.id)).recibida, '2025-01-01');
    assert.equal((await historialDe(original.id))[0].anteriores.recibida, '2026-01-01');
  });
});
