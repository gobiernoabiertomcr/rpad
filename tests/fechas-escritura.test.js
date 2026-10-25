// Escritura de las fechas de un dataset (spec 2026-10-17-fechas-datasets, sección 10.1): lo que validan POST y PUT
// /datasets y POST /datasets/:id/actualizar, lo que guarda el cambio pendiente, la aprobación (fin de mes, campos nuevos e
// historial) y el "Operador más activo" de Gestión. Los datasets de prueba se cargan por SQL, con el prefijo [TEST], para
// poder tener fechas "raras" (una próxima que no es fin de mes, un Eventual sin tipo guardado, etc.).
// El servidor usa el hoy real (hoyArgentina): las fechas que dependen del reloj (topes, "no puede ser posterior a hoy")
// salen de hoy; las que no dependen (una próxima que no es fin de mes, fechas pasadas) pueden ser fijas.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, catalogos, query, PREFIJO_TEST
} from './helpers.js';
import { formatoCorto, hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';
import { sumarMeses, vencimientoDelMes } from '../services/fechasDatasetReglas.js';

let servidor, api, usuarios, cat;

const HOY = hoyArgentina();
const FIN_DE_MES = vencimientoDelMes(HOY);
// El fin de mes que está n meses después del actual (n = 0 es el actual, n < 0 son meses pasados)
const enMeses = (n) => sumarMeses(FIN_DE_MES, n);
const ANIO = Number(HOY.slice(0, 4));

const MENSAJE_APROBAR_PROXIMA = 'La próxima actualización del cambio no es el último día de un mes. Rechazalo y proponé la fecha correcta.';
const ERROR_PROXIMA_FIN_DE_MES = 'La próxima actualización tiene que ser el último día de un mes (febrero, el 28)';
const ERROR_DATOS_AL_FIN_DE_MES = 'Datos al tiene que ser el último día de un mes (febrero, el 28)';
// «Recibido el» obligatorio, el origen de los datos y la edición que no registra (spec 2026-10-24-metricas-y-reportes, 4)
const MENSAJE_FALTA_RECIBIDO = 'Indicá cuándo se recibieron los datos.';
const MENSAJE_FALTA_ORIGEN = 'Indicá quién entregó los datos.';
const MENSAJE_ORIGEN_INVALIDO = 'El origen de los datos no es válido.';
const MENSAJE_EDICION_REGISTRA = 'Para registrar una actualización, usá «Registrar actualización».';

before(async () => {
  servidor = await iniciarServidor();
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, { adminA: 'admin', adminB: 'admin', operador: 'admin' });
  cat = await catalogos();
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
});

const como = (clave) => ({ token: usuarios[clave].token });
const idDeFrecuencia = async (nombre) => (await query('SELECT id FROM frecuencias WHERE nombre = ?', [nombre]))[0].id;

// Carga un dataset nuevo por SQL (cada test usa el suyo: un cambio pendiente lo bloquea)
let numero = 0;
const cargarDataset = async ({
  frecuencia = 'Mensualmente', gestion = 'externa', ultima = null, proxima = null, datosAl = null, tipoPedido = null
} = {}) => {
  numero += 1;
  const resultado = await query(
    `INSERT INTO datasets (titulo, area_id, frecuencia_id, ultima_actualizacion, proxima_actualizacion, datos_al, tipo_pedido,
       tema_principal_id, tipo_gestion, requiere_nota, url_dataset, activo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'https://datos.comodoro.gov.ar/dataset/test', 1)`,
    // Requiere nota DGMIT: un externo siempre tiene el dato (el servidor lo exige al editar); un interno, NULL
    [`${PREFIJO_TEST} escritura ${numero}`, cat.areaId, await idDeFrecuencia(frecuencia), ultima, proxima, datosAl, tipoPedido,
      cat.temaId, gestion, gestion === 'externa' ? 1 : null]
  );
  return resultado.insertId;
};

const fechasEnDb = async (id) => ({ ...(await query(
  `SELECT titulo, DATE_FORMAT(ultima_actualizacion, '%Y-%m-%d') AS ultima, DATE_FORMAT(datos_al, '%Y-%m-%d') AS datos_al,
          DATE_FORMAT(proxima_actualizacion, '%Y-%m-%d') AS proxima, tipo_pedido
   FROM datasets WHERE id = ?`,
  [id]
))[0] });
// El JSON llega como texto o ya parseado, según el driver
const comoObjeto = (datos) => (typeof datos === 'string' ? JSON.parse(datos) : datos);
const cambioEnDb = async (id) => {
  const [fila] = await query('SELECT estado, datos_nuevos, datos_anteriores, usuario_id FROM cambios_pendientes WHERE id = ?', [id]);
  return { ...fila, datos_nuevos: comoObjeto(fila.datos_nuevos), datos_anteriores: comoObjeto(fila.datos_anteriores) };
};
const pendientesDe = async (datasetId) =>
  (await query("SELECT id FROM cambios_pendientes WHERE dataset_id = ? AND estado = 'pendiente'", [datasetId])).length;
const historialDe = (datasetId) => query(
  `SELECT DATE_FORMAT(fecha_actualizacion, '%Y-%m-%d') AS fecha_actualizacion, usuario_id, notas, cambio_id,
          DATE_FORMAT(vencimiento, '%Y-%m-%d') AS vencimiento, DATE_FORMAT(datos_al, '%Y-%m-%d') AS datos_al,
          DATE_FORMAT(recibido_el, '%Y-%m-%d') AS recibido_el, DATE_FORMAT(proxima_nueva, '%Y-%m-%d') AS proxima_nueva
   FROM historial_actualizaciones WHERE dataset_id = ? ORDER BY id`,
  [datasetId]
).then(filas => filas.map(f => ({ ...f })));

const registrar = (id, body, quien = 'adminA') => api.post(`/datasets/${id}/actualizar`, body, como(quien));
const editar = (id, body, quien = 'adminA') => api.put(`/datasets/${id}`, body, como(quien));
const aprobar = (cambioId, quien = 'adminB') => api.post(`/cambios-pendientes/${cambioId}/aprobar`, {}, como(quien));
const rechazar = (cambioId, quien = 'adminB') =>
  api.post(`/cambios-pendientes/${cambioId}/rechazar`, { comentario: 'No coincide' }, como(quien));

// Un registro válido para un dataset mensual: datos al fin del mes pasado, recibidos y cargados hoy, próxima dentro de dos
// meses. Desde la spec 2026-10-24-metricas-y-reportes (4), «Recibido el» es obligatorio y, en externa, el origen (en interna
// se ignora)
const registroValido = (extra = {}) => ({
  datos_al: enMeses(-1), cargado_el: HOY, recibido_el: HOY, origen_datos: 'area', proxima_actualizacion: enMeses(2), ...extra
});

const alta = (extra = {}) => ({
  titulo: `${PREFIJO_TEST} alta de escritura`,
  area_id: cat.areaId,
  frecuencia_id: cat.frecuenciaId,
  tema_principal_id: cat.temaId,
  tipo_gestion: 'externa',
  requiere_nota: 1,
  formatos: [cat.formatoId],
  ...extra
});

// Espera un 400 con ese mensaje y que no se haya creado ningún cambio pendiente para el dataset
const esperar400 = async (res, error, datasetId) => {
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(res.body.success, false);
  if (error !== undefined) assert.equal(res.body.error, error);
  if (datasetId !== undefined) assert.equal(await pendientesDe(datasetId), 0);
};

describe('POST /datasets/:id/actualizar: lo que valida', () => {
  it('una próxima que no es fin de mes da 400', async () => {
    const id = await cargarDataset({ proxima: enMeses(1) });
    for (const proxima of ['2026-05-29', '2028-02-29']) {
      await esperar400(await registrar(id, registroValido({ proxima_actualizacion: proxima })), ERROR_PROXIMA_FIN_DE_MES, id);
    }
  });

  it('una próxima que no es una fecha da 400', async () => {
    const id = await cargarDataset({ proxima: enMeses(1) });
    for (const proxima of ['2026-02-30', 'mañana', 20260531]) {
      await esperar400(await registrar(id, registroValido({ proxima_actualizacion: proxima })),
        'La próxima actualización tiene que ser una fecha válida (AAAA-MM-DD)', id);
    }
  });

  it('Datos al posterior al fin del mes actual da 400; el fin del mes actual se acepta', async () => {
    const id = await cargarDataset({ proxima: enMeses(1) });
    for (const datosAl of [enMeses(1), enMeses(600)]) {
      await esperar400(await registrar(id, registroValido({ datos_al: datosAl })), `Todavía no puede haber datos al ${formatoCorto(datosAl)}`, id);
    }
    assert.equal((await registrar(id, registroValido({ datos_al: FIN_DE_MES }))).status, 200);
  });

  it('Datos al que no es fin de mes, que no es una fecha o que falta da 400', async () => {
    const id = await cargarDataset({ proxima: enMeses(1) });
    await esperar400(await registrar(id, registroValido({ datos_al: '2026-09-15' })), ERROR_DATOS_AL_FIN_DE_MES, id);
    await esperar400(await registrar(id, registroValido({ datos_al: '2026-13-31' })), 'Datos al tiene que ser una fecha válida (AAAA-MM-DD)', id);
    for (const datosAl of [undefined, null, '']) {
      await esperar400(await registrar(id, registroValido({ datos_al: datosAl })), 'Falta Datos al: la fecha a la que son los datos que llegaron', id);
    }
  });

  it('en un presupuesto (ejercicio), Datos al es el 31/12 de un ejercicio y puede ser el del año siguiente', async () => {
    const id = await cargarDataset({ frecuencia: 'Anualmente', proxima: enMeses(3), tipoPedido: 'ejercicio' });
    await esperar400(await registrar(id, registroValido({ datos_al: `${ANIO}-06-30` })),
      'En un presupuesto, Datos al tiene que ser el 31/12 del ejercicio publicado', id);
    await esperar400(await registrar(id, registroValido({ datos_al: `${ANIO + 2}-12-31` })),
      `Todavía no puede haber datos al 31/12/${ANIO + 2}`, id);
    assert.equal((await registrar(id, registroValido({ datos_al: `${ANIO + 1}-12-31` }))).status, 200);
  });

  it('Recibido el posterior a la carga en el portal da 400', async () => {
    const id = await cargarDataset({ proxima: enMeses(1) });
    const cargado = sumarDias(HOY, -10);
    const recibido = sumarDias(HOY, -5);
    await esperar400(await registrar(id, registroValido({ cargado_el: cargado, recibido_el: recibido })),
      `La fecha de recepción (${formatoCorto(recibido)}) no puede ser posterior a la de carga en el portal (${formatoCorto(cargado)})`, id);
  });

  it('la carga en el portal o la recepción posteriores a hoy dan 400', async () => {
    const id = await cargarDataset({ proxima: enMeses(1) });
    const manana = sumarDias(HOY, 1);
    await esperar400(await registrar(id, registroValido({ cargado_el: manana })),
      `La fecha de carga en el portal no puede ser posterior a hoy (${formatoCorto(HOY)})`, id);
    await esperar400(await registrar(id, registroValido({ fecha_actualizacion: manana, cargado_el: undefined })),
      `La fecha de carga en el portal no puede ser posterior a hoy (${formatoCorto(HOY)})`, id);
    await esperar400(await registrar(id, registroValido({ recibido_el: manana })), undefined, id);
    await esperar400(await registrar(id, registroValido({ recibido_el: 'ayer' })),
      'La fecha de recepción tiene que ser una fecha válida (AAAA-MM-DD)', id);
  });

  it('sin próxima en un dataset que no es Eventual da 400', async () => {
    const id = await cargarDataset({ proxima: enMeses(1) });
    for (const proxima of [undefined, null, '']) {
      await esperar400(await registrar(id, registroValido({ proxima_actualizacion: proxima })),
        'Falta la próxima actualización: es obligatoria salvo con la frecuencia Eventual', id);
    }
  });

  it('en un Eventual se registra sin próxima (200) y con próxima da 400', async () => {
    const id = await cargarDataset({ frecuencia: 'Eventual' });
    await esperar400(await registrar(id, registroValido()), 'Con la frecuencia Eventual, la próxima actualización tiene que ir vacía', id);
    const res = await registrar(id, registroValido({ proxima_actualizacion: undefined }));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const cambio = await cambioEnDb(res.body.data.cambio_pendiente_id);
    assert.equal(cambio.datos_nuevos.proxima_actualizacion, null);
  });

  it('un dataset que no existe da 404 y uno bloqueado da 409, aunque el pedido sea inválido', async () => {
    assert.equal((await registrar(999999999, {})).status, 404);
    const id = await cargarDataset({ proxima: enMeses(1) });
    assert.equal((await registrar(id, registroValido())).status, 200);
    for (const body of [{}, registroValido({ proxima_actualizacion: '2026-05-29' })]) {
      const res = await registrar(id, body, 'adminB');
      assert.equal(res.status, 409, JSON.stringify(body));
    }
  });
});

describe('POST /datasets/:id/actualizar: el cambio que propone', () => {
  it('respeta la próxima elegida y guarda los datos nuevos y los anteriores con la forma nueva', async () => {
    const id = await cargarDataset({ ultima: '2026-01-10', proxima: enMeses(1), datosAl: '2025-12-31' });
    const recibido = sumarDias(HOY, -2);
    const res = await registrar(id, registroValido({ recibido_el: recibido, proxima_actualizacion: enMeses(5), notas: 'Llegó por mail' }));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.match(res.body.message, /^Solicitud de actualización enviada/);

    const cambio = await cambioEnDb(res.body.data.cambio_pendiente_id);
    assert.equal(cambio.estado, 'pendiente');
    assert.equal(cambio.usuario_id, usuarios.adminA.id);
    assert.deepEqual(cambio.datos_nuevos, {
      ultima_actualizacion: HOY,
      datos_al: enMeses(-1),
      proxima_actualizacion: enMeses(5),
      recibido_el: recibido,
      origen_datos: 'area',
      notas: 'Llegó por mail',
      registro_actualizacion: true
    });
    assert.deepEqual(Object.keys(cambio.datos_anteriores).sort(), ['datos_al', 'proxima_actualizacion', 'ultima_actualizacion']);
    // Las tres fechas viajan como 'AAAA-MM-DD', sin hora ni zona: la próxima anterior es el vencimiento del historial
    assert.deepEqual(cambio.datos_anteriores, { ultima_actualizacion: '2026-01-10', datos_al: '2025-12-31', proxima_actualizacion: enMeses(1) });
    // Hasta que se apruebe, el dataset no cambia
    assert.deepEqual(await fechasEnDb(id), {
      titulo: `${PREFIJO_TEST} escritura ${numero}`, ultima: '2026-01-10', datos_al: '2025-12-31', proxima: enMeses(1), tipo_pedido: null
    });
  });

  it('con fechas guardadas en cero, los datos anteriores quedan en null y el historial, sin vencimiento', async () => {
    const id = await cargarDataset({ ultima: '0000-00-00', proxima: '0000-00-00', datosAl: '0000-00-00' });
    const res = await registrar(id, registroValido());
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const cambioId = res.body.data.cambio_pendiente_id;
    assert.deepEqual((await cambioEnDb(cambioId)).datos_anteriores, { ultima_actualizacion: null, datos_al: null, proxima_actualizacion: null });
    assert.equal((await aprobar(cambioId)).status, 200);
    assert.equal((await historialDe(id))[0].vencimiento, null);
  });

  it('sin la fecha de carga usa hoy, y acepta fecha_actualizacion como sinónimo', async () => {
    const sinCarga = await cargarDataset({ proxima: enMeses(1) });
    const res = await registrar(sinCarga, registroValido({ cargado_el: undefined }));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await cambioEnDb(res.body.data.cambio_pendiente_id)).datos_nuevos.ultima_actualizacion, HOY);

    const conSinonimo = await cargarDataset({ proxima: enMeses(1) });
    // La recepción no puede ser posterior a la carga (y desde la spec 2026-10-24-metricas-y-reportes es obligatoria)
    const otra = await registrar(conSinonimo, registroValido({ cargado_el: undefined, fecha_actualizacion: '2026-03-15', recibido_el: '2026-03-14' }));
    assert.equal(otra.status, 200, JSON.stringify(otra.body));
    const nuevos = (await cambioEnDb(otra.body.data.cambio_pendiente_id)).datos_nuevos;
    assert.equal(nuevos.ultima_actualizacion, '2026-03-15');
    assert.equal(nuevos.recibido_el, '2026-03-14');
    assert.equal(nuevos.notas, null);
  });
});

// Desde el despliegue, «Registrar actualización» pide «Recibido el» y, en gestión externa, el origen de los datos (spec
// 2026-10-24-metricas-y-reportes, 4). Los cambios pendientes de antes, sin esos datos, se aprueban como siempre
describe('POST /datasets/:id/actualizar: «Recibido el» y el origen de los datos', () => {
  const RECIBIDO = sumarDias(HOY, -2);
  const detalleDelCambio = async (cambioId) => {
    const res = await api.get(`/cambios-pendientes/${cambioId}`, como('adminB'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data;
  };

  it('registrar sin recibido_el da 400 con «Indicá cuándo se recibieron los datos.»', async () => {
    for (const gestion of ['externa', 'interna']) {
      const id = await cargarDataset({ gestion, proxima: enMeses(1) });
      for (const recibido of [undefined, null, '']) {
        await esperar400(await registrar(id, registroValido({ recibido_el: recibido, origen_datos: 'area' })), MENSAJE_FALTA_RECIBIDO, id);
      }
      // El orden: falta Datos al y la carga van antes; la recepción, antes del origen y de la próxima
      await esperar400(await registrar(id, registroValido({ datos_al: undefined, recibido_el: undefined })),
        'Falta Datos al: la fecha a la que son los datos que llegaron', id);
      await esperar400(await registrar(id, registroValido({ cargado_el: sumarDias(HOY, 1), recibido_el: undefined })),
        `La fecha de carga en el portal no puede ser posterior a hoy (${formatoCorto(HOY)})`, id);
      await esperar400(await registrar(id, registroValido({ recibido_el: undefined, origen_datos: undefined, proxima_actualizacion: undefined })),
        MENSAJE_FALTA_RECIBIDO, id);
    }
  });

  it('registrar un externo sin origen da 400 con «Indicá quién entregó los datos.»; un interno sin origen, no', async () => {
    const externo = await cargarDataset({ proxima: enMeses(1) });
    for (const origen of [undefined, null, '']) {
      await esperar400(await registrar(externo, registroValido({ recibido_el: RECIBIDO, origen_datos: origen })), MENSAJE_FALTA_ORIGEN, externo);
    }
    // El orden: la recepción posterior a hoy o a la carga va antes que el origen; el origen, antes que la próxima
    await esperar400(await registrar(externo, registroValido({ recibido_el: sumarDias(HOY, 1), origen_datos: undefined })),
      `La fecha de recepción no puede ser posterior a hoy (${formatoCorto(HOY)})`, externo);
    const cargado = sumarDias(HOY, -10);
    await esperar400(await registrar(externo, registroValido({ cargado_el: cargado, recibido_el: RECIBIDO, origen_datos: undefined })),
      `La fecha de recepción (${formatoCorto(RECIBIDO)}) no puede ser posterior a la de carga en el portal (${formatoCorto(cargado)})`, externo);
    await esperar400(await registrar(externo, registroValido({ recibido_el: RECIBIDO, origen_datos: undefined, proxima_actualizacion: undefined })),
      MENSAJE_FALTA_ORIGEN, externo);

    const interno = await cargarDataset({ gestion: 'interna', proxima: enMeses(1) });
    const res = await registrar(interno, registroValido({ recibido_el: RECIBIDO, origen_datos: undefined }));
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  it('registrar con origen_datos «otro» da 400', async () => {
    for (const gestion of ['externa', 'interna']) {
      const id = await cargarDataset({ gestion, proxima: enMeses(1) });
      for (const origen of ['otro', 'Area', 'fuente pública', 0, 1, true, {}, []]) {
        await esperar400(await registrar(id, registroValido({ recibido_el: RECIBIDO, origen_datos: origen })), MENSAJE_ORIGEN_INVALIDO, id);
      }
    }
  });

  it('el origen viaja en datos_nuevos y en interna queda null aunque llegue', async () => {
    for (const origen of ['area', 'fuente_publica']) {
      const externo = await cargarDataset({ proxima: enMeses(1) });
      const res = await registrar(externo, registroValido({ recibido_el: RECIBIDO, origen_datos: origen }));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const nuevos = (await cambioEnDb(res.body.data.cambio_pendiente_id)).datos_nuevos;
      assert.strictEqual(nuevos.origen_datos, origen);
      assert.equal(nuevos.recibido_el, RECIBIDO);
    }
    for (const origen of ['area', 'fuente_publica', null, undefined]) {
      const interno = await cargarDataset({ gestion: 'interna', proxima: enMeses(1) });
      const res = await registrar(interno, registroValido({ recibido_el: RECIBIDO, origen_datos: origen }));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const nuevos = (await cambioEnDb(res.body.data.cambio_pendiente_id)).datos_nuevos;
      assert.ok(Object.hasOwn(nuevos, 'origen_datos'), JSON.stringify(nuevos));
      assert.strictEqual(nuevos.origen_datos, null);
    }
  });

  it('un cambio pendiente creado sin recibido_el ni origen se aprueba y escribe el historial', async () => {
    // El JSON de un registro propuesto antes del despliegue: con recibido_el en null (el formulario de antes) o sin la clave
    const viejos = [
      { recibido_el: null },
      {}
    ];
    for (const sinRecibido of viejos) {
      const id = await cargarDataset({ ultima: '2026-01-10', proxima: enMeses(-1), datosAl: '2025-12-31' });
      const cargado = sumarDias(HOY, -1);
      const cambioId = (await query(
        `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, datos_anteriores, usuario_id)
         VALUES ('editar', ?, ?, ?, ?)`,
        [id,
          JSON.stringify({ ultima_actualizacion: cargado, datos_al: enMeses(-1), proxima_actualizacion: enMeses(2), ...sinRecibido, notas: 'De antes', registro_actualizacion: true }),
          JSON.stringify({ ultima_actualizacion: '2026-01-10', datos_al: '2025-12-31', proxima_actualizacion: enMeses(-1) }),
          usuarios.adminA.id]
      )).insertId;

      const aprobacion = await aprobar(cambioId);
      assert.equal(aprobacion.status, 200, JSON.stringify(aprobacion.body));
      const dataset = await fechasEnDb(id);
      assert.deepEqual([dataset.ultima, dataset.datos_al, dataset.proxima], [cargado, enMeses(-1), enMeses(2)]);
      assert.deepEqual(await historialDe(id), [{
        fecha_actualizacion: cargado,
        usuario_id: usuarios.adminA.id,
        notas: 'De antes',
        cambio_id: cambioId,
        vencimiento: enMeses(-1),
        datos_al: enMeses(-1),
        recibido_el: null,
        proxima_nueva: enMeses(2)
      }]);
      // La comparación de un cambio viejo no lista el origen
      assert.ok(!(await detalleDelCambio(cambioId)).campos_modificados.some(c => c.campo === 'Origen de los datos'));
    }
  });

  it('la comparación muestra «Origen de los datos: Fuente pública»', async () => {
    const id = await cargarDataset({ ultima: '2026-01-10', proxima: enMeses(1), datosAl: '2025-12-31' });
    const res = await registrar(id, registroValido({ recibido_el: RECIBIDO, origen_datos: 'fuente_publica' }));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const cambio = await detalleDelCambio(res.body.data.cambio_pendiente_id);
    assert.deepEqual(cambio.campos_modificados, [
      { campo: 'Datos al', antes: '2025-12-31', despues: enMeses(-1) },
      { campo: 'Cargado en el portal', antes: '2026-01-10', despues: HOY },
      { campo: 'Recibido el', antes: '-', despues: RECIBIDO },
      { campo: 'Origen de los datos', antes: '-', despues: 'Fuente pública' },
      { campo: 'Proxima Actualizacion', antes: enMeses(1), despues: enMeses(2) }
    ]);
    assert.equal(cambio.datos_nuevos.origen_datos_texto, 'Fuente pública');

    // «Los entregó el área», el otro origen
    const otro = await cargarDataset({ proxima: enMeses(1) });
    const conArea = await registrar(otro, registroValido({ recibido_el: RECIBIDO, origen_datos: 'area' }));
    const fila = (await detalleDelCambio(conArea.body.data.cambio_pendiente_id)).campos_modificados.find(c => c.campo === 'Origen de los datos');
    assert.deepEqual(fila, { campo: 'Origen de los datos', antes: '-', despues: 'Los entregó el área' });

    // En gestión interna no se pregunta: el renglón no se lista
    const interno = await cargarDataset({ gestion: 'interna', proxima: enMeses(1) });
    const sinOrigen = await registrar(interno, registroValido({ recibido_el: RECIBIDO, origen_datos: 'area' }));
    const campos = (await detalleDelCambio(sinOrigen.body.data.cambio_pendiente_id)).campos_modificados.map(c => c.campo);
    assert.deepEqual(campos, ['Datos al', 'Cargado en el portal', 'Recibido el', 'Proxima Actualizacion']);
  });
});

describe('aprobar un registro de actualización', () => {
  it('aplica las fechas y escribe el historial con la próxima anterior como vencimiento, en la misma aprobación', async () => {
    const id = await cargarDataset({ ultima: '2026-01-10', proxima: enMeses(-1), datosAl: '2025-12-31' });
    const recibido = sumarDias(HOY, -3);
    const cargado = sumarDias(HOY, -1);
    const res = await registrar(id, registroValido({ cargado_el: cargado, recibido_el: recibido, proxima_actualizacion: enMeses(4), notas: 'Completo' }));
    const cambioId = res.body.data.cambio_pendiente_id;
    assert.deepEqual(await historialDe(id), []);

    const aprobacion = await aprobar(cambioId);
    assert.equal(aprobacion.status, 200, JSON.stringify(aprobacion.body));
    const dataset = await fechasEnDb(id);
    assert.deepEqual([dataset.ultima, dataset.datos_al, dataset.proxima], [cargado, enMeses(-1), enMeses(4)]);
    assert.deepEqual(await historialDe(id), [{
      fecha_actualizacion: cargado,
      usuario_id: usuarios.adminA.id,
      notas: 'Completo',
      cambio_id: cambioId,
      vencimiento: enMeses(-1),
      datos_al: enMeses(-1),
      recibido_el: recibido,
      proxima_nueva: enMeses(4)
    }]);
    assert.equal((await cambioEnDb(cambioId)).estado, 'aprobado');
  });

  it('un Eventual sin próxima: el historial queda sin vencimiento ni próxima nueva', async () => {
    const id = await cargarDataset({ frecuencia: 'Eventual' });
    const res = await registrar(id, registroValido({ proxima_actualizacion: undefined }));
    assert.equal((await aprobar(res.body.data.cambio_pendiente_id)).status, 200);
    const [fila] = await historialDe(id);
    assert.equal(fila.vencimiento, null);
    assert.equal(fila.proxima_nueva, null);
    assert.equal(fila.datos_al, enMeses(-1));
    assert.equal((await fechasEnDb(id)).proxima, null);
  });

  it('rechazar un registro no escribe historial ni cambia el dataset', async () => {
    const id = await cargarDataset({ proxima: enMeses(1) });
    const res = await registrar(id, registroValido());
    assert.equal((await rechazar(res.body.data.cambio_pendiente_id)).status, 200);
    assert.deepEqual(await historialDe(id), []);
    assert.equal((await fechasEnDb(id)).proxima, enMeses(1));
  });

  it('una edición aprobada no escribe historial', async () => {
    const id = await cargarDataset({ proxima: enMeses(1) });
    const edicion = await editar(id, { titulo: `${PREFIJO_TEST} escritura editada` });
    assert.equal((await aprobar(edicion.body.data.cambio_pendiente_id)).status, 200);
    assert.deepEqual(await historialDe(id), []);
  });
});

describe('aprobar un cambio con fechas que no son fin de mes (cargado por SQL o propuesto antes del despliegue)', () => {
  const insertarCambio = async (datasetId, nuevos, anteriores) => (await query(
    `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, datos_anteriores, usuario_id)
     VALUES ('editar', ?, ?, ?, ?)`,
    [datasetId, JSON.stringify(nuevos), anteriores ? JSON.stringify(anteriores) : null, usuarios.adminA.id]
  )).insertId;

  it('una próxima que no es fin de mes da 400 y no toca nada; con la forma vieja y fin de mes se aprueba sin historial', async () => {
    const id = await cargarDataset({ ultima: '2026-01-10', proxima: enMeses(1), datosAl: '2025-12-31' });
    const antes = await fechasEnDb(id);
    const cambioId = await insertarCambio(id,
      { ultima_actualizacion: sumarDias(HOY, -3), datos_al: enMeses(-1), proxima_actualizacion: '2026-05-29', recibido_el: null, notas: 'x', registro_actualizacion: true },
      { ultima_actualizacion: '2026-01-10', datos_al: '2025-12-31', proxima_actualizacion: enMeses(1) });

    const res = await aprobar(cambioId);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error, MENSAJE_APROBAR_PROXIMA);
    assert.deepEqual(await fechasEnDb(id), antes);
    assert.equal((await cambioEnDb(cambioId)).estado, 'pendiente');
    assert.deepEqual(await historialDe(id), []);

    // El mismo cambio con la forma vieja (registros propuestos antes del despliegue): se aprueba como antes, sin historial
    await query('UPDATE cambios_pendientes SET datos_nuevos = ?, datos_anteriores = ? WHERE id = ?', [
      JSON.stringify({ ultima_actualizacion: '2026-03-15', proxima_actualizacion: '2026-05-31', notas: 'Forma vieja' }),
      JSON.stringify({ ultima_actualizacion: '2026-01-10T03:00:00.000Z', proxima_actualizacion: `${enMeses(1)}T03:00:00.000Z` }),
      cambioId
    ]);
    const vieja = await aprobar(cambioId);
    assert.equal(vieja.status, 200, JSON.stringify(vieja.body));
    assert.deepEqual(await fechasEnDb(id), { ...antes, ultima: '2026-03-15', proxima: '2026-05-31' });
    assert.deepEqual(await historialDe(id), []);
  });

  it('un cambio viejo con una próxima calculada por días (que no es fin de mes) da 400', async () => {
    const id = await cargarDataset({ ultima: '2026-01-10', proxima: enMeses(1) });
    const cambioId = await insertarCambio(id,
      { ultima_actualizacion: '2026-03-15', proxima_actualizacion: '2026-04-14', notas: null },
      { ultima_actualizacion: '2026-01-10T03:00:00.000Z', proxima_actualizacion: `${enMeses(1)}T03:00:00.000Z` });
    const res = await aprobar(cambioId);
    assert.equal(res.status, 400);
    assert.equal(res.body.error, MENSAJE_APROBAR_PROXIMA);
    assert.equal((await fechasEnDb(id)).proxima, enMeses(1));
  });

  it('un Datos al que no es fin de mes da 400', async () => {
    const id = await cargarDataset({ proxima: enMeses(1) });
    const cambioId = await insertarCambio(id,
      { ultima_actualizacion: HOY, datos_al: '2026-09-15', proxima_actualizacion: enMeses(3), recibido_el: null, notas: null, registro_actualizacion: true },
      { ultima_actualizacion: null, datos_al: null, proxima_actualizacion: enMeses(1) });
    const res = await aprobar(cambioId);
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Datos al del cambio no es el último día de un mes. Rechazalo y proponé la fecha correcta.');
    assert.equal((await fechasEnDb(id)).datos_al, null);
    assert.deepEqual(await historialDe(id), []);
  });

  it('un alta con una próxima que no es fin de mes da 400 y no crea el dataset', async () => {
    const titulo = `${PREFIJO_TEST} alta vieja que no es fin de mes`;
    const cambioId = (await query(
      `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id) VALUES ('crear', NULL, ?, ?)`,
      [JSON.stringify({ ...alta({ titulo }), formatos: [cat.formatoId], proxima_actualizacion: '2026-11-15' }), usuarios.adminA.id]
    )).insertId;
    const res = await aprobar(cambioId);
    assert.equal(res.status, 400);
    assert.equal(res.body.error, MENSAJE_APROBAR_PROXIMA);
    assert.equal((await query('SELECT id FROM datasets WHERE titulo = ?', [titulo])).length, 0);
  });
});

describe('PUT /datasets/:id: valida solo lo que cambia', () => {
  it('una próxima que no es fin de mes da 400', async () => {
    const id = await cargarDataset({ proxima: enMeses(1) });
    for (const proxima of ['2026-05-29', '2028-02-29']) {
      await esperar400(await editar(id, { proxima_actualizacion: proxima }), ERROR_PROXIMA_FIN_DE_MES, id);
    }
    await esperar400(await editar(id, { proxima_actualizacion: '2026-02-30' }), 'La próxima actualización tiene que ser una fecha válida (AAAA-MM-DD)', id);
  });

  it('un dataset con una próxima guardada que no es fin de mes se edita sin tocarla, y la aprobación la conserva', async () => {
    const id = await cargarDataset({ proxima: '2026-03-29' });
    const edicion = await editar(id, { titulo: `${PREFIJO_TEST} escritura con fecha mala` });
    assert.equal(edicion.status, 200, JSON.stringify(edicion.body));
    const aprobacion = await aprobar(edicion.body.data.cambio_pendiente_id);
    assert.equal(aprobacion.status, 200, JSON.stringify(aprobacion.body));
    const dataset = await fechasEnDb(id);
    assert.equal(dataset.titulo, `${PREFIJO_TEST} escritura con fecha mala`);
    assert.equal(dataset.proxima, '2026-03-29');
  });

  it('mandar la misma próxima guardada (aunque no sea fin de mes) no cuenta como cambio de la fecha', async () => {
    const id = await cargarDataset({ proxima: '2026-03-29' });
    const edicion = await editar(id, { titulo: `${PREFIJO_TEST} reenvía la fecha`, proxima_actualizacion: '2026-03-29' });
    assert.equal(edicion.status, 200, JSON.stringify(edicion.body));
  });

  it('un dataset con fechas en cero se edita sin tocarlas', async () => {
    const id = await cargarDataset({ proxima: '0000-00-00', datosAl: '0000-00-00' });
    const edicion = await editar(id, { titulo: `${PREFIJO_TEST} escritura con fechas en cero` });
    assert.equal(edicion.status, 200, JSON.stringify(edicion.body));
  });

  it('el tipo Eventual con una frecuencia que no es Eventual da 400, y un tipo que no existe también', async () => {
    const id = await cargarDataset({ proxima: enMeses(1) });
    await esperar400(await editar(id, { tipo_pedido: 'eventual' }), 'El tipo de pedido Eventual va solo con la frecuencia Eventual', id);
    await esperar400(await editar(id, { tipo_pedido: 'inventado' }), 'El tipo de pedido no es válido', id);
  });

  it('pasar a la frecuencia Eventual exige el tipo Eventual (si hay uno guardado) y la próxima vacía', async () => {
    const eventual = await idDeFrecuencia('Eventual');
    const conTipo = await cargarDataset({ proxima: enMeses(1), tipoPedido: 'acumulado' });
    await esperar400(await editar(conTipo, { frecuencia_id: eventual, proxima_actualizacion: '' }),
      'Con la frecuencia Eventual, el tipo de pedido tiene que ser Eventual', conTipo);
    await esperar400(await editar(conTipo, { frecuencia_id: eventual, tipo_pedido: 'eventual' }),
      'Con la frecuencia Eventual, la próxima actualización tiene que ir vacía', conTipo);
    const res = await editar(conTipo, { frecuencia_id: eventual, tipo_pedido: 'eventual', proxima_actualizacion: '' });
    assert.equal(res.status, 200, JSON.stringify(res.body));

    // Sin tipo guardado, el efectivo pasa solo a Eventual
    const sinTipo = await cargarDataset({ proxima: enMeses(1) });
    const otra = await editar(sinTipo, { frecuencia_id: eventual, proxima_actualizacion: null });
    assert.equal(otra.status, 200, JSON.stringify(otra.body));
  });

  it('en un Eventual, una próxima da 400', async () => {
    const id = await cargarDataset({ frecuencia: 'Eventual' });
    await esperar400(await editar(id, { proxima_actualizacion: enMeses(2) }), 'Con la frecuencia Eventual, la próxima actualización tiene que ir vacía', id);
  });

  it('Datos al futuro o que no es fin de mes, y una carga en el portal futura, dan 400', async () => {
    const id = await cargarDataset({ proxima: enMeses(1) });
    await esperar400(await editar(id, { datos_al: enMeses(1) }), `Todavía no puede haber datos al ${formatoCorto(enMeses(1))}`, id);
    await esperar400(await editar(id, { datos_al: '2026-09-15' }), ERROR_DATOS_AL_FIN_DE_MES, id);
    await esperar400(await editar(id, { ultima_actualizacion: sumarDias(HOY, 1) }),
      `La fecha de carga en el portal no puede ser posterior a hoy (${formatoCorto(HOY)})`, id);
  });

  it('Datos al y el tipo de pedido se proponen y se aplican al aprobar, y la revisión los trae', async () => {
    const id = await cargarDataset({ proxima: enMeses(1) });
    const edicion = await editar(id, { datos_al: enMeses(-1), tipo_pedido: 'foto' });
    assert.equal(edicion.status, 200, JSON.stringify(edicion.body));
    const cambio = await cambioEnDb(edicion.body.data.cambio_pendiente_id);
    assert.equal(cambio.datos_nuevos.datos_al, enMeses(-1));
    assert.equal(cambio.datos_nuevos.tipo_pedido, 'foto');
    assert.equal(cambio.datos_anteriores.datos_al, null);
    assert.equal(cambio.datos_anteriores.tipo_pedido, null);
    assert.equal((await fechasEnDb(id)).datos_al, null);

    assert.equal((await aprobar(edicion.body.data.cambio_pendiente_id)).status, 200);
    const dataset = await fechasEnDb(id);
    assert.equal(dataset.datos_al, enMeses(-1));
    assert.equal(dataset.tipo_pedido, 'foto');
    assert.equal(dataset.proxima, enMeses(1));
  });

  it('cambiar solo Datos al o solo el tipo cuenta como cambio; repetirlos no', async () => {
    const id = await cargarDataset({ proxima: enMeses(1), datosAl: enMeses(-2), tipoPedido: 'acumulado' });
    await esperar400(await editar(id, { datos_al: enMeses(-2), tipo_pedido: 'acumulado' }),
      'No se detectaron cambios. El dataset no fue modificado.', id);
    const res = await editar(id, { tipo_pedido: 'foto' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    // El Datos al guardado viaja como 'AAAA-MM-DD' en los dos lados
    const cambio = await cambioEnDb(res.body.data.cambio_pendiente_id);
    assert.equal(cambio.datos_anteriores.datos_al, enMeses(-2));
    assert.equal(cambio.datos_nuevos.datos_al, enMeses(-2));
  });

  // Mover a la vez «Cargado en el portal» y la próxima es registrar una actualización: va por «Registrar actualización», que
  // pide la recepción y el origen y escribe el historial (spec 2026-10-24-metricas-y-reportes, 4)
  it('editar cambiando a la vez la carga y la próxima da 400 con el mensaje de la edición; cambiando una sola, no', async () => {
    const guardado = { ultima: '2026-01-10', proxima: enMeses(1) };
    const id = await cargarDataset(guardado);
    await esperar400(await editar(id, { ultima_actualizacion: sumarDias(HOY, -1), proxima_actualizacion: enMeses(3) }),
      MENSAJE_EDICION_REGISTRA, id);
    await esperar400(await editar(id, {
      titulo: `${PREFIJO_TEST} edita las dos fechas`, ultima_actualizacion: sumarDias(HOY, -1), proxima_actualizacion: enMeses(3)
    }), MENSAJE_EDICION_REGISTRA, id);

    // El formulario manda las dos: si llegan iguales a las guardadas, o cambia una sola, se edita
    const sinTocarlas = await editar(id, {
      titulo: `${PREFIJO_TEST} reenvía las dos fechas`, ultima_actualizacion: guardado.ultima, proxima_actualizacion: guardado.proxima
    });
    assert.equal(sinTocarlas.status, 200, JSON.stringify(sinTocarlas.body));

    const soloLaCarga = await cargarDataset(guardado);
    const carga = await editar(soloLaCarga, { ultima_actualizacion: sumarDias(HOY, -1), proxima_actualizacion: guardado.proxima });
    assert.equal(carga.status, 200, JSON.stringify(carga.body));
    assert.equal((await cambioEnDb(carga.body.data.cambio_pendiente_id)).datos_nuevos.ultima_actualizacion, sumarDias(HOY, -1));

    const soloLaProxima = await cargarDataset(guardado);
    const proxima = await editar(soloLaProxima, { ultima_actualizacion: guardado.ultima, proxima_actualizacion: enMeses(3) });
    assert.equal(proxima.status, 200, JSON.stringify(proxima.body));
    assert.equal((await cambioEnDb(proxima.body.data.cambio_pendiente_id)).datos_nuevos.proxima_actualizacion, enMeses(3));
  });
});

describe('POST /datasets: lo que valida', () => {
  it('sin próxima se acepta (la exige el formulario, no el servidor)', async () => {
    const res = await api.post('/datasets', alta(), como('adminA'));
    assert.equal(res.status, 201, JSON.stringify(res.body));
  });

  it('una próxima que no es fin de mes o un Datos al futuro dan 400', async () => {
    let res = await api.post('/datasets', alta({ proxima_actualizacion: '2026-05-29' }), como('adminA'));
    await esperar400(res, ERROR_PROXIMA_FIN_DE_MES);
    res = await api.post('/datasets', alta({ datos_al: enMeses(1) }), como('adminA'));
    await esperar400(res, `Todavía no puede haber datos al ${formatoCorto(enMeses(1))}`);
    res = await api.post('/datasets', alta({ ultima_actualizacion: sumarDias(HOY, 1) }), como('adminA'));
    await esperar400(res, `La fecha de carga en el portal no puede ser posterior a hoy (${formatoCorto(HOY)})`);
  });

  it('el tipo y la frecuencia Eventual van juntos, y el Eventual no lleva próxima', async () => {
    const eventual = await idDeFrecuencia('Eventual');
    await esperar400(await api.post('/datasets', alta({ tipo_pedido: 'eventual' }), como('adminA')),
      'El tipo de pedido Eventual va solo con la frecuencia Eventual');
    await esperar400(await api.post('/datasets', alta({ frecuencia_id: eventual, tipo_pedido: 'acumulado' }), como('adminA')),
      'Con la frecuencia Eventual, el tipo de pedido tiene que ser Eventual');
    await esperar400(await api.post('/datasets', alta({ frecuencia_id: eventual, proxima_actualizacion: enMeses(2) }), como('adminA')),
      'Con la frecuencia Eventual, la próxima actualización tiene que ir vacía');
    await esperar400(await api.post('/datasets', alta({ tipo_pedido: 'inventado' }), como('adminA')), 'El tipo de pedido no es válido');
    await esperar400(await api.post('/datasets', alta({ frecuencia_id: 999999 }), como('adminA')), 'La frecuencia no es válida');
    const res = await api.post('/datasets', alta({ frecuencia_id: eventual }), como('adminA'));
    assert.equal(res.status, 201, JSON.stringify(res.body));
  });

  it('el alta guarda Datos al y el tipo de pedido al aprobarse', async () => {
    const titulo = `${PREFIJO_TEST} alta con Datos al`;
    const res = await api.post('/datasets', alta({ titulo, datos_al: enMeses(-1), tipo_pedido: 'foto', proxima_actualizacion: enMeses(3) }), como('adminA'));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const aprobacion = await aprobar(res.body.data.cambio_pendiente_id);
    assert.equal(aprobacion.status, 200, JSON.stringify(aprobacion.body));
    const dataset = await fechasEnDb(aprobacion.body.data.dataset_id);
    assert.deepEqual([dataset.titulo, dataset.datos_al, dataset.tipo_pedido, dataset.proxima], [titulo, enMeses(-1), 'foto', enMeses(3)]);
  });
});

describe('Gestión: "Operador más activo"', () => {
  // Cuenta los cambios propuestos y las filas del historial que no vienen de un cambio (las de antes de la doble
  // verificación). Un registro aprobado está en las dos tablas y cuenta una sola vez.
  const accionesSegunElTest = async (usuarioId) => Number((await query(
    `SELECT (SELECT COUNT(*) FROM cambios_pendientes WHERE usuario_id = ?)
          + (SELECT COUNT(*) FROM historial_actualizaciones WHERE usuario_id = ? AND cambio_id IS NULL) AS acciones`,
    [usuarioId, usuarioId]
  ))[0].acciones);

  it('no cuenta dos veces un registro de actualización aprobado', async () => {
    const metricas = () => api.get('/gestion/metricas', como('adminB'));
    const previo = (await metricas()).body.data.operador_mas_activo;
    const maximo = Number(previo?.acciones ?? 0);

    // Para que el operador de prueba sea el más activo: tantos cambios rechazados como el máximo actual, más uno
    const operador = usuarios.operador.id;
    const filas = Array.from({ length: maximo + 1 }, () => [operador]);
    await query(`INSERT INTO cambios_pendientes (tipo_cambio, datos_nuevos, usuario_id, estado) VALUES ${filas.map(() => "('crear', '{}', ?, 'rechazado')").join(', ')}`, filas.flat());

    // Un registro aprobado (un cambio y una fila de historial) y una fila de historial vieja, sin cambio
    const id = await cargarDataset({ proxima: enMeses(1) });
    const registro = await registrar(id, registroValido(), 'operador');
    assert.equal(registro.status, 200, JSON.stringify(registro.body));
    assert.equal((await aprobar(registro.body.data.cambio_pendiente_id)).status, 200);
    await query("INSERT INTO historial_actualizaciones (dataset_id, fecha_actualizacion, usuario_id) VALUES (?, '2026-03-15', ?)", [id, operador]);

    const esperado = await accionesSegunElTest(operador);
    assert.equal(esperado, maximo + 3);
    const res = await metricas();
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.operador_mas_activo, { nombre_completo: 'Test operador', acciones: esperado });
  });
});
