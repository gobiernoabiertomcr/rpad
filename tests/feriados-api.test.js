// API de Feriados (spec 2026-10-26-feriados, secciones 2 y 3): GET /api/feriados lo ve cualquier rol con sesión (también el
// lector y el colaborador; sin sesión, 401), con los feriados del año (los 9 fijos y los de la tabla, los que se repiten
// proyectados al año) y los años del selector; un año que no sirve da 400 en `anio`. Y la lectura (services/feriadosDatos.js):
// las filas activas con su `no_rige`, una sola fila (con FOR UPDATE en una transacción) y feriadosEntre, el Set de los días no
// hábiles de un rango. Contra una base de prueba propia, con feriados cargados por SQL.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { asegurarBaseDePrueba } from './notas-fixtures.js';
import { FERIADOS_FIJOS, hoyArgentina } from '../services/notasDigitalesCalendario.js';
import { MENSAJES_FERIADO, feriadosDelAnio } from '../services/feriadosReglas.js';

let base, servidor, api, usuarios, dbReal, datos, pool;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_feriados_api');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, {
    superadmin: 'superadmin', admin: 'admin', editor: 'editor', lector: 'lector', colab: 'colaborador'
  });
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba
  datos = await import('../services/feriadosDatos.js');
  pool = (await import('../config/database.js')).default;
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await pool?.end();
  await cerrarDb();
  await servidor?.detener();
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  await asegurarBaseDePrueba();
  // Cada test arranca sin feriados cargados: los años del selector dependen de lo que haya. feriados_no_rige se va con sus
  // feriados (ON DELETE CASCADE)
  await query('DELETE FROM feriados');
});

const como = (clave) => ({ token: usuarios[clave].token });

const insertarFeriado = async ({
  fecha, nombre, tipo = 'nacional', trasladado_de = null, se_repite = 0, hasta_anio = null, activo = 1
}) => (await query(
  'INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, hasta_anio, activo) VALUES (?, ?, ?, ?, ?, ?, ?)',
  [fecha, nombre, tipo, trasladado_de, se_repite, hasta_anio, activo]
)).insertId;

const noRige = (feriadoId, anio) => query('INSERT INTO feriados_no_rige (feriado_id, anio) VALUES (?, ?)', [feriadoId, anio]);

const enCurso = () => Number(hoyArgentina().slice(0, 4));

describe('GET /feriados', () => {
  it('sin sesión, 401', async () => {
    const res = await api.get('/feriados');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it('el lector y el colaborador leen', async () => {
    const anio = enCurso();
    for (const clave of ['lector', 'colab']) {
      const res = await api.get('/feriados', como(clave));
      assert.equal(res.status, 200, `${clave}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.success, true);
      assert.deepEqual(Object.keys(res.body.data).sort(), ['anio', 'anios', 'feriados']);
      assert.equal(res.body.data.anio, anio, clave);
      assert.deepEqual(res.body.data.anios, [anio, anio + 1], clave);
      // Sin nada en la tabla, los 9 fijos del año, tal como los arma la lista del año
      const { feriados } = res.body.data;
      assert.equal(feriados.length, 9, clave);
      assert.ok(feriados.every((f) => f.fijo === true), clave);
      assert.deepEqual(feriados.map((f) => f.fecha), FERIADOS_FIJOS.map((mesYDia) => `${anio}-${mesYDia}`), clave);
      assert.deepEqual(feriados, feriadosDelAnio([], anio), clave);
    }
  });

  it('también lee la administración', async () => {
    for (const clave of ['superadmin', 'admin', 'editor']) {
      const res = await api.get('/feriados', como(clave));
      assert.equal(res.status, 200, `${clave}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.data.feriados.length, 9, clave);
    }
  });

  it('un feriado que se repite aparece proyectado', async () => {
    const id = await insertarFeriado({ fecha: '2026-02-23', nombre: 'Aniversario de la ciudad', tipo: 'municipal', se_repite: 1 });
    const res = await api.get('/feriados?anio=2027', como('lector'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.anio, 2027);
    const aniversario = res.body.data.feriados.filter((f) => f.id === id);
    assert.equal(aniversario.length, 1);
    assert.equal(aniversario[0].fecha, '2027-02-23');
    assert.equal(aniversario[0].dia_semana, 'martes');
    assert.equal(aniversario[0].fecha_guardada, '2026-02-23');
    assert.equal(aniversario[0].se_repite, 1);
    assert.equal(aniversario[0].rige, true);
    assert.equal(aniversario[0].tipo_nombre, 'De Comodoro');
    assert.equal(res.body.data.feriados.length, 10);
  });

  it('cada fila llega tal como la arma la lista del año: los trasladados, los que no rigen, los dados de baja', async () => {
    const repite = await insertarFeriado({ fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', se_repite: 1 });
    await noRige(repite, 2027);
    const trasladado = await insertarFeriado({ fecha: '2027-06-21', nombre: 'Paso a la Inmortalidad del General Güemes',
      trasladado_de: '2027-06-17' });
    await insertarFeriado({ fecha: '2027-03-25', nombre: 'Dado de baja', tipo: 'no_laborable', activo: 0 });

    const res = await api.get('/feriados?anio=2027', como('colab'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { feriados } = res.body.data;
    assert.deepEqual(feriados, feriadosDelAnio(await datos.filasDeFeriados(), 2027));
    assert.equal(feriados.length, 11);
    const empleado = feriados.find((f) => f.id === repite);
    assert.equal(empleado.fecha, '2027-11-08');
    assert.equal(empleado.rige, false);
    assert.deepEqual(empleado.aclaraciones, ['Este año no rige']);
    const guemes = feriados.find((f) => f.id === trasladado);
    assert.equal(guemes.trasladado_de, '2027-06-17');
    assert.deepEqual(guemes.aclaraciones, ['Trasladado del jueves 17/06']);
    assert.ok(!feriados.some((f) => f.nombre === 'Dado de baja'));
  });

  it('los años del selector suman los anteriores con feriados cargados', async () => {
    await insertarFeriado({ fecha: '2025-02-03', nombre: 'Carnaval' });
    const anio = enCurso();
    const res = await api.get('/feriados', como('lector'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.anios, [2025, anio, anio + 1]);
  });

  it('un año inválido da 400', async () => {
    for (const anio of ['abc', '1999', '2101', '2026.5', '02026', ' 2026', '-2026']) {
      const res = await api.get(`/feriados?anio=${encodeURIComponent(anio)}`, como('lector'));
      assert.equal(res.status, 400, `«${anio}»: ${JSON.stringify(res.body)}`);
      assert.deepEqual(res.body, { success: false, error: MENSAJES_FERIADO.anio, campo: 'anio' }, anio);
    }
    // Repetido en la dirección, Express lo da como una lista: tampoco es un año
    const doble = await api.get('/feriados?anio=2026&anio=2027', como('lector'));
    assert.equal(doble.status, 400);
    assert.equal(doble.body.campo, 'anio');
  });

  it('los bordes del año: 2000 y 2100 sirven, y vacío es el en curso', async () => {
    for (const anio of [2000, 2100]) {
      const res = await api.get(`/feriados?anio=${anio}`, como('lector'));
      assert.equal(res.status, 200, `${anio}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.data.anio, anio);
      assert.equal(res.body.data.feriados[0].fecha, `${anio}-01-01`);
    }
    const vacio = await api.get('/feriados?anio=', como('lector'));
    assert.equal(vacio.status, 200, JSON.stringify(vacio.body));
    assert.equal(vacio.body.data.anio, enCurso());
  });
});

describe('la lectura de los feriados (feriadosDatos)', () => {
  it('filasDeFeriados: las activas, con las fechas como texto, los números como números y su no_rige', async () => {
    const repite = await insertarFeriado({ fecha: '2026-07-28', nombre: 'Gesta galesa', tipo: 'provincial', se_repite: 1,
      hasta_anio: 2030 });
    await noRige(repite, 2029);
    await noRige(repite, 2027);
    const trasladado = await insertarFeriado({ fecha: '2026-06-15', nombre: 'Güemes', trasladado_de: '2026-06-17' });
    await insertarFeriado({ fecha: '2026-03-01', nombre: 'Dado de baja', activo: 0 });

    const filas = await datos.filasDeFeriados();
    const porId = new Map(filas.map((f) => [f.id, f]));
    assert.equal(filas.length, 2);
    assert.deepEqual(porId.get(repite), {
      id: repite, fecha: '2026-07-28', nombre: 'Gesta galesa', tipo: 'provincial', trasladado_de: null, se_repite: 1,
      hasta_anio: 2030, activo: 1, no_rige: [2027, 2029]
    });
    assert.deepEqual(porId.get(trasladado), {
      id: trasladado, fecha: '2026-06-15', nombre: 'Güemes', tipo: 'nacional', trasladado_de: '2026-06-17', se_repite: 0,
      hasta_anio: null, activo: 1, no_rige: []
    });
  });

  it('filasDeFeriados: con la tabla vacía, una lista vacía', async () => {
    assert.deepEqual(await datos.filasDeFeriados(), []);
  });

  it('filaDeFeriado: una activa, o null', async () => {
    const id = await insertarFeriado({ fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', se_repite: 1 });
    await noRige(id, 2027);
    const baja = await insertarFeriado({ fecha: '2026-03-01', nombre: 'Dado de baja', activo: 0 });

    assert.deepEqual(await datos.filaDeFeriado(id), {
      id, fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', trasladado_de: null, se_repite: 1,
      hasta_anio: null, activo: 1, no_rige: [2027]
    });
    assert.equal(await datos.filaDeFeriado(baja), null);
    assert.equal(await datos.filaDeFeriado(id + baja + 100), null);
    for (const raro of ['abc', 0, -1, 1.5, null, undefined, '1e3']) {
      assert.equal(await datos.filaDeFeriado(raro), null, String(raro));
    }
  });

  it('filaDeFeriado: en una transacción, la lee con FOR UPDATE', async () => {
    const id = await insertarFeriado({ fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', se_repite: 1 });
    const primera = await pool.getConnection();
    const segunda = await pool.getConnection();
    try {
      await primera.beginTransaction();
      assert.equal((await datos.filaDeFeriado(id, primera)).id, id);
      // La segunda transacción espera el bloqueo de la primera: con un segundo de espera, se rinde
      await segunda.query('SET SESSION innodb_lock_wait_timeout = 1');
      await segunda.beginTransaction();
      await assert.rejects(datos.filaDeFeriado(id, segunda), (error) => error.code === 'ER_LOCK_WAIT_TIMEOUT');
    } finally {
      await segunda.rollback().catch(() => {});
      await segunda.query('SET SESSION innodb_lock_wait_timeout = DEFAULT').catch(() => {});
      segunda.release();
      await primera.rollback().catch(() => {});
      primera.release();
    }
  });

  it('filaDeFeriado: la segunda transacción espera a la primera y ve lo que dejó, también en no_rige', async () => {
    const id = await insertarFeriado({ fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', se_repite: 1 });
    const primera = await pool.getConnection();
    const segunda = await pool.getConnection();
    try {
      await primera.beginTransaction();
      assert.deepEqual((await datos.filaDeFeriado(id, primera)).no_rige, []);
      await primera.query('INSERT INTO feriados_no_rige (feriado_id, anio) VALUES (?, ?)', [id, 2028]);

      await segunda.beginTransaction();
      let leyo = false;
      const leida = datos.filaDeFeriado(id, segunda).then((fila) => { leyo = true; return fila; });
      await new Promise((listo) => setTimeout(listo, 300));
      assert.equal(leyo, false, 'la segunda no esperó el bloqueo');
      await primera.commit();
      assert.deepEqual((await leida).no_rige, [2028]);
      await segunda.commit();
    } finally {
      await segunda.rollback().catch(() => {});
      segunda.release();
      await primera.rollback().catch(() => {});
      primera.release();
    }
  });

  it('feriadosEntre', async () => {
    await insertarFeriado({ fecha: '2026-02-16', nombre: 'Carnaval' });
    await insertarFeriado({ fecha: '2026-02-17', nombre: 'Carnaval' });
    const feriados = await datos.feriadosEntre('2026-02-01', '2026-02-28');
    assert.ok(feriados instanceof Set);
    assert.ok(feriados.has('2026-02-16'));
    assert.ok(feriados.has('2026-02-17'));
    assert.deepEqual([...feriados].sort(), ['2026-02-16', '2026-02-17']);
  });

  it('feriadosEntre: los fijos, los que se repiten donde rigen y sin los dados de baja', async () => {
    const repite = await insertarFeriado({ fecha: '2026-02-23', nombre: 'Aniversario de la ciudad', tipo: 'municipal', se_repite: 1 });
    await noRige(repite, 2027);
    await insertarFeriado({ fecha: '2026-02-24', nombre: 'Dado de baja', activo: 0 });
    const feriados = await datos.feriadosEntre('2026-01-01', '2028-03-31');
    assert.ok(feriados.has('2026-02-23'));
    assert.ok(!feriados.has('2027-02-23'));
    assert.ok(feriados.has('2028-02-23'));
    assert.ok(!feriados.has('2026-02-24'));
    assert.ok(feriados.has('2027-12-25'));
    assert.ok(!feriados.has('2028-04-02'));
    // Un rango que no es un rango: un Set vacío
    assert.equal((await datos.feriadosEntre('2026-03-01', '2026-02-01')).size, 0);
    assert.equal((await datos.feriadosEntre('abc', '2026-02-01')).size, 0);
  });
});
