// API de Feriados (spec 2026-10-26-feriados, secciones 2 y 3): GET /api/feriados lo ve cualquier rol con sesión (también el
// lector y el colaborador; sin sesión, 401), con los feriados del año (los 9 fijos y los de la tabla, los que se repiten
// proyectados al año) y los años del selector; un año que no sirve da 400 en `anio`. La lectura (services/feriadosDatos.js):
// las filas activas con su `no_rige`, una sola fila (con FOR UPDATE en una transacción) y feriadosEntre, el Set de los días no
// hábiles de un rango. Y las escrituras, solo de administración (el lector y el colaborador, 403; sin sesión, 401): cargar y
// corregir (con los avisos), «no rige» con y sin «se pasó al» (en una sola transacción) y la baja, entera o desde un año; un id
// que no sirve, que no existe o dado de baja da 404, antes que la validación (400 con su campo). Contra una base de prueba
// propia, con feriados cargados por SQL.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { asegurarBaseDePrueba } from './notas-fixtures.js';
import { FERIADOS_FIJOS, hoyArgentina } from '../services/notasDigitalesCalendario.js';
import { MENSAJES_FERIADO, feriadosDelAnio, validarFeriado } from '../services/feriadosReglas.js';

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

// El formulario de un feriado: Carnaval 2026, salvo lo que se cambie
const carnaval = (cambios = {}) => ({
  fecha: '2026-02-16', nombre: 'Carnaval', tipo: 'nacional', trasladado_de: null, se_repite: false, ...cambios
});

// La fila tal como quedó guardada, con las fechas como texto y los números como números (también una dada de baja)
const filaGuardada = async (id) => {
  const [fila] = await query(
    `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, nombre, tipo, DATE_FORMAT(trasladado_de, '%Y-%m-%d') AS trasladado_de,
       se_repite, hasta_anio, activo, creado_por
     FROM feriados WHERE id = ?`,
    [id]
  );
  if (!fila) return null;
  return {
    ...fila, se_repite: Number(fila.se_repite), activo: Number(fila.activo),
    hasta_anio: fila.hasta_anio === null ? null : Number(fila.hasta_anio),
    creado_por: fila.creado_por === null ? null : Number(fila.creado_por)
  };
};

const aniosQueNoRigen = async (id) =>
  (await query('SELECT anio FROM feriados_no_rige WHERE feriado_id = ? ORDER BY anio', [id])).map(({ anio }) => Number(anio));

// Lo que hay en las dos tablas, para comprobar que un pedido rechazado no escribió nada
const todoLoGuardado = async () => ({
  feriados: await query(
    `SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, nombre, tipo, DATE_FORMAT(trasladado_de, '%Y-%m-%d') AS trasladado_de,
       se_repite, hasta_anio, activo, creado_por
     FROM feriados ORDER BY id`
  ),
  no_rige: await query('SELECT feriado_id, anio FROM feriados_no_rige ORDER BY feriado_id, anio')
});

// Un feriado de la lista de un año, por su id
const enLaLista = async (anio, id) => {
  const res = await api.get(`/feriados?anio=${anio}`, como('lector'));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data.feriados.find((f) => f.id === id) ?? null;
};

// Simula una falla de la base mientras corre fn: un trigger de la base de prueba rechaza el INSERT de un feriado que cumpla la
// condición (texto fijo escrito en el test), como conFallaSimulada de notas-fixtures.js
const conFallaAlCargarUnFeriado = async (condicion, fn) => {
  await asegurarBaseDePrueba();
  await query('DROP TRIGGER IF EXISTS falla_simulada_feriados');
  await query(`CREATE TRIGGER falla_simulada_feriados BEFORE INSERT ON feriados FOR EACH ROW
    BEGIN
      IF ${condicion} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falla simulada'; END IF;
    END`);
  try {
    return await fn();
  } finally {
    await query('DROP TRIGGER IF EXISTS falla_simulada_feriados');
  }
};

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
      // Si una comprobación falla antes de esperarla, su rechazo no queda sin atender
      leida.catch(() => {});
      await new Promise((listo) => setTimeout(listo, 300));
      assert.equal(leyo, false, 'la segunda no esperó el bloqueo');
      await primera.commit();
      assert.deepEqual((await leida).no_rige, [2028]);
      await segunda.commit();
    } finally {
      // Primero la que tiene el bloqueo: si una comprobación falló, la lectura de la segunda sigue esperándolo, y su rollback
      // iría detrás de ella (unos 50 segundos, hasta que se rinda)
      await primera.rollback().catch(() => {});
      primera.release();
      await segunda.rollback().catch(() => {});
      segunda.release();
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

describe('escribir feriados: permisos', () => {
  // Las cuatro escrituras, cada una con un cuerpo que la administración podría guardar
  const escrituras = (id) => [
    ['POST', '/feriados', carnaval({ fecha: '2026-02-17' })],
    ['PUT', `/feriados/${id}`, carnaval({ nombre: 'Corregido' })],
    ['PUT', `/feriados/${id}/rige`, { anio: 2027, rige: false, pasa_al: '2027-11-09' }],
    ['DELETE', `/feriados/${id}?desde=2028`]
  ];
  const pedir = (metodo, ruta, cuerpo, opciones) => {
    if (metodo === 'POST') return api.post(ruta, cuerpo, opciones);
    if (metodo === 'PUT') return api.put(ruta, cuerpo, opciones);
    return api.delete(ruta, opciones);
  };

  it('el lector y el colaborador reciben 403 al escribir', async () => {
    const id = await insertarFeriado({ fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', se_repite: 1 });
    const antes = await todoLoGuardado();
    for (const clave of ['lector', 'colab']) {
      for (const [metodo, ruta, cuerpo] of escrituras(id)) {
        const res = await pedir(metodo, ruta, cuerpo, como(clave));
        assert.equal(res.status, 403, `${clave} ${metodo} ${ruta}: ${JSON.stringify(res.body)}`);
        assert.equal(res.body.success, false);
      }
    }
    assert.deepEqual(await todoLoGuardado(), antes);
  });

  it('sin sesión, 401', async () => {
    const id = await insertarFeriado({ fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', se_repite: 1 });
    const antes = await todoLoGuardado();
    for (const [metodo, ruta, cuerpo] of escrituras(id)) {
      const res = await pedir(metodo, ruta, cuerpo, {});
      assert.equal(res.status, 401, `${metodo} ${ruta}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.success, false);
    }
    assert.deepEqual(await todoLoGuardado(), antes);
  });

  it('el superadmin, el admin y el editor cargan', async () => {
    for (const [i, clave] of ['superadmin', 'admin', 'editor'].entries()) {
      const res = await api.post('/feriados', carnaval({ fecha: `2026-03-0${i + 2}` }), como(clave));
      assert.equal(res.status, 201, `${clave}: ${JSON.stringify(res.body)}`);
      assert.equal((await filaGuardada(res.body.data.id)).creado_por, usuarios[clave].id, clave);
    }
  });
});

describe('POST /feriados (alta)', () => {
  it('Carnaval 2026 da 201, y la fila queda con creado_por', async () => {
    const res = await api.post('/feriados', carnaval(), como('admin'));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(Object.keys(res.body).sort(), ['avisos', 'data', 'message', 'success']);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'Feriado cargado.');
    assert.deepEqual(res.body.avisos, []);
    assert.deepEqual(Object.keys(res.body.data), ['id']);
    assert.ok(Number.isInteger(res.body.data.id) && res.body.data.id > 0);
    assert.deepEqual(await filaGuardada(res.body.data.id), {
      fecha: '2026-02-16', nombre: 'Carnaval', tipo: 'nacional', trasladado_de: null, se_repite: 0, hasta_anio: null, activo: 1,
      creado_por: usuarios.admin.id
    });
    // Y ya está en la lista del año
    assert.equal((await enLaLista(2026, res.body.data.id)).nombre, 'Carnaval');
  });

  it('guarda lo que dejó la validación: el nombre recortado, «se repite», el trasladado y un trasladado vacío como null', async () => {
    const repite = await api.post('/feriados',
      { fecha: '2026-07-28', nombre: '  Gesta galesa  ', tipo: 'provincial', se_repite: true }, como('admin'));
    assert.equal(repite.status, 201, JSON.stringify(repite.body));
    assert.deepEqual(await filaGuardada(repite.body.data.id), {
      fecha: '2026-07-28', nombre: 'Gesta galesa', tipo: 'provincial', trasladado_de: null, se_repite: 1, hasta_anio: null,
      activo: 1, creado_por: usuarios.admin.id
    });

    const trasladado = await api.post('/feriados',
      carnaval({ fecha: '2026-06-15', nombre: 'Paso a la Inmortalidad del General Güemes', trasladado_de: '2026-06-17' }),
      como('admin'));
    assert.equal(trasladado.status, 201, JSON.stringify(trasladado.body));
    assert.equal((await filaGuardada(trasladado.body.data.id)).trasladado_de, '2026-06-17');

    // trasladado_de es opcional: vacío no es un error
    const vacio = await api.post('/feriados', carnaval({ fecha: '2026-02-17', trasladado_de: '' }), como('admin'));
    assert.equal(vacio.status, 201, JSON.stringify(vacio.body));
    assert.equal((await filaGuardada(vacio.body.data.id)).trasladado_de, null);
  });

  it('el 2/4/2026 trae el aviso del fijo', async () => {
    const res = await api.post('/feriados', { fecha: '2026-04-02', nombre: 'Jueves Santo', tipo: 'no_laborable' }, como('admin'));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.avisos,
      ['Ese día ya es feriado: Día del Veterano y de los Caídos en la Guerra de Malvinas (fijo del sistema).']);
  });

  it('el domingo 8/11 trae «Cae domingo: no cambia ningún día hábil.»', async () => {
    const res = await api.post('/feriados',
      { fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', se_repite: true }, como('admin'));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.avisos, ['Cae domingo: no cambia ningún día hábil.']);
  });

  it('avisa si ese día ya hay uno de la tabla, también uno que se repite, pero lo carga igual', async () => {
    await insertarFeriado({ fecha: '2026-02-16', nombre: 'Carnaval' });
    await insertarFeriado({ fecha: '2025-02-23', nombre: 'Aniversario de la ciudad', tipo: 'municipal', se_repite: 1 });
    const mismoDia = await api.post('/feriados', carnaval({ nombre: 'Asueto' }), como('admin'));
    assert.equal(mismoDia.status, 201, JSON.stringify(mismoDia.body));
    assert.deepEqual(mismoDia.body.avisos, ['Ese día ya es feriado: Carnaval.']);
    const repetido = await api.post('/feriados', carnaval({ fecha: '2026-02-23', nombre: 'Asueto' }), como('admin'));
    assert.equal(repetido.status, 201, JSON.stringify(repetido.body));
    assert.deepEqual(repetido.body.avisos, ['Ese día ya es feriado: Aniversario de la ciudad.']);
  });

  it('cada 400 con su campo, sin guardar nada', async () => {
    const casos = [
      [carnaval({ fecha: '2026-02-30' }), 'fecha', MENSAJES_FERIADO.fecha],
      [carnaval({ fecha: null }), 'fecha', MENSAJES_FERIADO.fecha],
      [carnaval({ fecha: '2024-12-31' }), 'fecha', MENSAJES_FERIADO.fecha],
      [carnaval({ nombre: '' }), 'nombre', MENSAJES_FERIADO.nombre],
      [carnaval({ nombre: '   ' }), 'nombre', MENSAJES_FERIADO.nombre],
      [carnaval({ nombre: 'x'.repeat(151) }), 'nombre', MENSAJES_FERIADO.nombreLargo],
      [carnaval({ tipo: 'otro' }), 'tipo', MENSAJES_FERIADO.tipo],
      [carnaval({ trasladado_de: '2025-02-16' }), 'trasladado_de', MENSAJES_FERIADO.trasladado],
      [carnaval({ trasladado_de: '2026-02-16' }), 'trasladado_de', MENSAJES_FERIADO.trasladado]
    ];
    for (const [entrada, campo, mensaje] of casos) {
      const res = await api.post('/feriados', entrada, como('admin'));
      assert.equal(res.status, 400, `${JSON.stringify(entrada)}: ${JSON.stringify(res.body)}`);
      assert.deepEqual(res.body, { success: false, error: mensaje, campo }, JSON.stringify(entrada));
    }

    // El 29/02 que se repite: con hoy en 2026 no hay ningún 29/02 en el rango y da la fecha (el servidor no tiene un reloj
    // falso); con hoy en 2027, el 29/02/2028 entra y da `se_repite`. Lo que diga la validación con el hoy de verdad
    const del29 = { fecha: '2028-02-29', nombre: 'Un 29 de febrero', tipo: 'municipal', se_repite: true };
    const { error } = validarFeriado(del29, hoyArgentina());
    assert.ok(error, 'el 29/02 que se repite no pasa la validación');
    const res = await api.post('/feriados', del29, como('admin'));
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: false, error: error.mensaje, campo: error.campo });

    assert.deepEqual(await todoLoGuardado(), { feriados: [], no_rige: [] });
  });
});

describe('PUT /feriados/:id (corregir)', () => {
  it('cambia el nombre y la fecha', async () => {
    const id = await insertarFeriado({ fecha: '2026-02-16', nombre: 'Carnava' });
    const res = await api.put(`/feriados/${id}`, carnaval({ fecha: '2026-02-17', nombre: 'Carnaval' }), como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, message: 'Feriado corregido.', avisos: [] });
    assert.deepEqual(await filaGuardada(id), {
      fecha: '2026-02-17', nombre: 'Carnaval', tipo: 'nacional', trasladado_de: null, se_repite: 0, hasta_anio: null, activo: 1,
      creado_por: null
    });
  });

  it('recibe el formulario entero: el tipo, el trasladado y «se repite»', async () => {
    const id = await insertarFeriado({ fecha: '2026-06-15', nombre: 'Güemes', trasladado_de: '2026-06-17' });
    const res = await api.put(`/feriados/${id}`,
      { fecha: '2026-07-28', nombre: 'Gesta galesa', tipo: 'provincial', trasladado_de: '', se_repite: true }, como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const fila = await filaGuardada(id);
    assert.equal(fila.tipo, 'provincial');
    assert.equal(fila.trasladado_de, null);
    assert.equal(fila.se_repite, 1);
  });

  it('trae los avisos, sin contarse a sí mismo', async () => {
    const id = await insertarFeriado({ fecha: '2026-04-02', nombre: 'Jueves Santo', tipo: 'no_laborable' });
    await insertarFeriado({ fecha: '2026-04-02', nombre: 'Asueto', tipo: 'municipal' });
    const res = await api.put(`/feriados/${id}`, { fecha: '2026-04-02', nombre: 'Jueves Santo', tipo: 'no_laborable' },
      como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.avisos, [
      'Ese día ya es feriado: Día del Veterano y de los Caídos en la Guerra de Malvinas (fijo del sistema).',
      'Ese día ya es feriado: Asueto.'
    ]);
    // Uno solo, el de la fecha nueva: un domingo
    const otro = await api.put(`/feriados/${id}`, { fecha: '2026-11-08', nombre: 'Jueves Santo', tipo: 'no_laborable' },
      como('admin'));
    assert.equal(otro.status, 200, JSON.stringify(otro.body));
    assert.deepEqual(otro.body.avisos, ['Cae domingo: no cambia ningún día hábil.']);
  });

  it('valida como el alta: 400 con su campo, sin tocar la fila', async () => {
    const id = await insertarFeriado({ fecha: '2026-02-16', nombre: 'Carnaval' });
    const antes = await todoLoGuardado();
    for (const [entrada, campo] of [[carnaval({ fecha: '2026-02-30' }), 'fecha'], [carnaval({ nombre: '' }), 'nombre'],
      [carnaval({ tipo: 'otro' }), 'tipo'], [carnaval({ trasladado_de: '2027-02-16' }), 'trasladado_de']]) {
      const res = await api.put(`/feriados/${id}`, entrada, como('admin'));
      assert.equal(res.status, 400, `${JSON.stringify(entrada)}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.campo, campo);
      assert.equal(res.body.success, false);
    }
    assert.deepEqual(await todoLoGuardado(), antes);
  });

  it('sobre un id dado de baja, que no existe, «abc» o «1e3», el PUT, el PUT …/rige y el DELETE dan 404', async () => {
    const baja = await insertarFeriado({ fecha: '2026-11-08', nombre: 'Dado de baja', tipo: 'municipal', se_repite: 1, activo: 0 });
    const antes = await todoLoGuardado();
    const noEncontrado = { success: false, error: MENSAJES_FERIADO.noEncontrado };
    for (const id of [baja, baja + 1000, 'abc', '1e3', '0', '-1', '1.5']) {
      // Con un cuerpo válido y con uno que no lo es: el 404 va antes que la validación
      for (const cuerpo of [carnaval(), carnaval({ fecha: '2026-02-30' })]) {
        const res = await api.put(`/feriados/${id}`, cuerpo, como('admin'));
        assert.equal(res.status, 404, `PUT ${id}: ${JSON.stringify(res.body)}`);
        assert.deepEqual(res.body, noEncontrado, `PUT ${id}`);
      }
      for (const cuerpo of [{ anio: 2027, rige: false }, { anio: 'abc' }]) {
        const res = await api.put(`/feriados/${id}/rige`, cuerpo, como('admin'));
        assert.equal(res.status, 404, `PUT ${id}/rige: ${JSON.stringify(res.body)}`);
        assert.deepEqual(res.body, noEncontrado, `PUT ${id}/rige`);
      }
      for (const consulta of ['?desde=2028', '']) {
        const res = await api.delete(`/feriados/${id}${consulta}`, como('admin'));
        assert.equal(res.status, 404, `DELETE ${id}${consulta}: ${JSON.stringify(res.body)}`);
        assert.deepEqual(res.body, noEncontrado, `DELETE ${id}${consulta}`);
      }
    }
    assert.deepEqual(await todoLoGuardado(), antes);
  });
});

describe('PUT /feriados/:id/rige («no rige»)', () => {
  const empleadoMunicipal = () =>
    insertarFeriado({ fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', se_repite: 1 });

  it('el 8/11 que se repite: en 2027 no rige y se pasó al 9/11', async () => {
    const id = await empleadoMunicipal();
    const res = await api.put(`/feriados/${id}/rige`, { anio: 2027, rige: false, pasa_al: '2027-11-09' }, como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(Object.keys(res.body).sort(), ['data', 'message', 'success']);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'En 2027 no rige: se pasó al 09/11/2027.');
    assert.deepEqual(Object.keys(res.body.data), ['nuevo_id']);
    const nuevo = res.body.data.nuevo_id;
    assert.ok(Number.isInteger(nuevo) && nuevo > 0 && nuevo !== id);

    assert.deepEqual(await aniosQueNoRigen(id), [2027]);
    // El día nuevo: el mismo nombre y tipo, sin «se repite» y trasladado del 8/11 de ese año
    assert.deepEqual(await filaGuardada(nuevo), {
      fecha: '2027-11-09', nombre: 'Día del Empleado Municipal', tipo: 'municipal', trasladado_de: '2027-11-08', se_repite: 0,
      hasta_anio: null, activo: 1, creado_por: usuarios.admin.id
    });
    // El que se repite no cambió
    assert.deepEqual(await filaGuardada(id), {
      fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', trasladado_de: null, se_repite: 1,
      hasta_anio: null, activo: 1, creado_por: null
    });
  });

  it('GET ?anio=2027 muestra el 8/11 con «Este año no rige» y el 9/11 con «Trasladado del lunes 08/11»; los otros años no cambian', async () => {
    const id = await empleadoMunicipal();
    const res = await api.put(`/feriados/${id}/rige`, { anio: 2027, rige: false, pasa_al: '2027-11-09' }, como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const del8 = await enLaLista(2027, id);
    assert.equal(del8.fecha, '2027-11-08');
    assert.equal(del8.rige, false);
    assert.deepEqual(del8.aclaraciones, ['Este año no rige']);
    const del9 = await enLaLista(2027, res.body.data.nuevo_id);
    assert.equal(del9.fecha, '2027-11-09');
    assert.equal(del9.rige, true);
    assert.equal(del9.trasladado_de, '2027-11-08');
    assert.deepEqual(del9.aclaraciones, ['Trasladado del lunes 08/11']);

    for (const anio of [2026, 2028]) {
      const otro = await enLaLista(anio, id);
      assert.equal(otro.rige, true, String(anio));
      assert.deepEqual(otro.aclaraciones, anio === 2026 ? ['Cae domingo: no cambia ningún día hábil'] : [], String(anio));
      assert.equal(await enLaLista(anio, res.body.data.nuevo_id), null, String(anio));
    }
  });

  it('repetirlo no duplica nada', async () => {
    const id = await empleadoMunicipal();
    const pedido = { anio: 2027, rige: false, pasa_al: '2027-11-09' };
    const primera = await api.put(`/feriados/${id}/rige`, pedido, como('admin'));
    assert.equal(primera.status, 200, JSON.stringify(primera.body));
    const despues = await todoLoGuardado();
    const segunda = await api.put(`/feriados/${id}/rige`, pedido, como('editor'));
    assert.equal(segunda.status, 200, JSON.stringify(segunda.body));
    assert.equal(segunda.body.data.nuevo_id, primera.body.data.nuevo_id);
    assert.deepEqual(await todoLoGuardado(), despues);
    assert.equal(despues.feriados.length, 2);
    assert.equal(despues.no_rige.length, 1);
  });

  it('sin «se pasó al», solo marca que ese año no rige', async () => {
    const id = await empleadoMunicipal();
    for (const pasaAl of [undefined, null, '']) {
      const res = await api.put(`/feriados/${id}/rige`, { anio: 2027, rige: false, pasa_al: pasaAl }, como('admin'));
      assert.equal(res.status, 200, `${pasaAl}: ${JSON.stringify(res.body)}`);
      assert.deepEqual(res.body, { success: true, message: 'En 2027 no rige.', data: { nuevo_id: null } }, String(pasaAl));
    }
    assert.deepEqual(await todoLoGuardado(), {
      feriados: [{ id, fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', trasladado_de: null,
        se_repite: 1, hasta_anio: null, activo: 1, creado_por: null }],
      no_rige: [{ feriado_id: id, anio: 2027 }]
    });
  });

  it('rige: true lo vuelve a habilitar, sin tocar el día al que se había pasado', async () => {
    const id = await empleadoMunicipal();
    await noRige(id, 2028);
    const marca = await api.put(`/feriados/${id}/rige`, { anio: 2027, rige: false, pasa_al: '2027-11-09' }, como('admin'));
    assert.equal(marca.status, 200, JSON.stringify(marca.body));

    // pasa_al no cuenta con rige: true
    const res = await api.put(`/feriados/${id}/rige`, { anio: 2027, rige: true, pasa_al: '2027-11-10' }, como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, message: 'En 2027 vuelve a regir.', data: { nuevo_id: null } });
    // Solo ese año: el 2028 sigue sin regir
    assert.deepEqual(await aniosQueNoRigen(id), [2028]);
    assert.equal((await enLaLista(2027, id)).rige, true);
    // El 9/11 es un feriado más: queda, y no se cargó ningún 10/11
    assert.equal((await filaGuardada(marca.body.data.nuevo_id)).activo, 1);
    assert.equal((await todoLoGuardado()).feriados.length, 2);

    // Volver a habilitar uno que ya rige no hace nada
    const otraVez = await api.put(`/feriados/${id}/rige`, { anio: 2027, rige: true }, como('admin'));
    assert.equal(otraVez.status, 200, JSON.stringify(otraVez.body));
    assert.deepEqual(await aniosQueNoRigen(id), [2028]);
  });

  it('sobre uno que no se repite da 400, sin campo', async () => {
    const id = await insertarFeriado({ fecha: '2026-02-16', nombre: 'Carnaval' });
    const res = await api.put(`/feriados/${id}/rige`, { anio: 2026, rige: false }, como('admin'));
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: false, error: MENSAJES_FERIADO.noSeRepite, campo: null });
    assert.deepEqual(await aniosQueNoRigen(id), []);
  });

  it('cada 400 con su campo, sin guardar nada', async () => {
    const id = await insertarFeriado({ fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', se_repite: 1,
      hasta_anio: 2027 });
    const antes = await todoLoGuardado();
    const casos = [
      [{ anio: 2025, rige: false }, 'anio', MENSAJES_FERIADO.anio],
      [{ anio: 2028, rige: false }, 'anio', MENSAJES_FERIADO.anio],
      [{ anio: 'abc', rige: false }, 'anio', MENSAJES_FERIADO.anio],
      [{ rige: false }, 'anio', MENSAJES_FERIADO.anio],
      [{ anio: 2027 }, 'rige', MENSAJES_FERIADO.rige],
      [{ anio: 2027, rige: 'no' }, 'rige', MENSAJES_FERIADO.rige],
      [{ anio: 2027, rige: false, pasa_al: '2028-11-09' }, 'pasa_al', MENSAJES_FERIADO.pasaAl],
      [{ anio: 2027, rige: false, pasa_al: '2027-11-08' }, 'pasa_al', MENSAJES_FERIADO.pasaAl],
      [{ anio: 2027, rige: false, pasa_al: '2027-02-30' }, 'pasa_al', MENSAJES_FERIADO.pasaAl]
    ];
    for (const [entrada, campo, mensaje] of casos) {
      const res = await api.put(`/feriados/${id}/rige`, entrada, como('admin'));
      assert.equal(res.status, 400, `${JSON.stringify(entrada)}: ${JSON.stringify(res.body)}`);
      assert.deepEqual(res.body, { success: false, error: mensaje, campo }, JSON.stringify(entrada));
    }
    assert.deepEqual(await todoLoGuardado(), antes);
  });
});

describe('«Se pasó al» va en una sola transacción', () => {
  it('con un «se pasó al» inválido, feriados_no_rige no cambia', async () => {
    const id = await insertarFeriado({ fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', se_repite: 1 });
    await noRige(id, 2028);
    const antes = await todoLoGuardado();
    const res = await api.put(`/feriados/${id}/rige`, { anio: 2027, rige: false, pasa_al: '2028-11-09' }, como('admin'));
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body.campo, 'pasa_al');
    assert.deepEqual(await todoLoGuardado(), antes);
    assert.deepEqual(await aniosQueNoRigen(id), [2028]);
  });

  it('si falla la carga del día nuevo, tampoco queda el «no rige»', async () => {
    const id = await insertarFeriado({ fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', se_repite: 1 });
    const antes = await todoLoGuardado();
    const res = await conFallaAlCargarUnFeriado("NEW.fecha = '2027-11-09'", () =>
      api.put(`/feriados/${id}/rige`, { anio: 2027, rige: false, pasa_al: '2027-11-09' }, como('admin')));
    assert.equal(res.status, 500, JSON.stringify(res.body));
    assert.equal(res.body.success, false);
    assert.deepEqual(await todoLoGuardado(), antes);
  });
});

describe('DELETE /feriados/:id (baja)', () => {
  it('uno que no se repite queda con activo = 0, y desde no cuenta', async () => {
    const id = await insertarFeriado({ fecha: '2026-02-16', nombre: 'Carnaval' });
    const otro = await insertarFeriado({ fecha: '2026-02-17', nombre: 'Carnaval' });
    const res = await api.delete(`/feriados/${id}`, como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, message: 'Feriado dado de baja.' });
    assert.equal((await filaGuardada(id)).activo, 0);
    assert.equal(await enLaLista(2026, id), null);
    // Baja lógica: la fila queda. Y una segunda vez, ya no lo encuentra
    assert.equal((await api.delete(`/feriados/${id}`, como('admin'))).status, 404);

    // Sin «se repite», desde no cuenta: tampoco uno que no sirve
    const conDesde = await api.delete(`/feriados/${otro}?desde=abc`, como('admin'));
    assert.equal(conDesde.status, 200, JSON.stringify(conDesde.body));
    assert.deepEqual(await filaGuardada(otro), {
      fecha: '2026-02-17', nombre: 'Carnaval', tipo: 'nacional', trasladado_de: null, se_repite: 0, hasta_anio: null, activo: 0,
      creado_por: null
    });
  });

  it('uno que se repite desde 2026, con ?desde=2028, queda con hasta_anio = 2027: sigue en 2027, pero no en 2028', async () => {
    const id = await insertarFeriado({ fecha: '2026-02-23', nombre: 'Aniversario de la ciudad', tipo: 'municipal', se_repite: 1 });
    const res = await api.delete(`/feriados/${id}?desde=2028`, como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, message: 'Feriado dado de baja.' });
    const fila = await filaGuardada(id);
    assert.equal(fila.activo, 1);
    assert.equal(fila.hasta_anio, 2027);
    assert.equal((await enLaLista(2026, id)).rige, true);
    assert.equal((await enLaLista(2027, id)).rige, true);
    assert.equal(await enLaLista(2028, id), null);
  });

  it('uno que se repite, desde su primer año o uno anterior, queda con activo = 0', async () => {
    for (const desde of ['2026', '2025']) {
      const id = await insertarFeriado({ fecha: '2026-02-23', nombre: 'Aniversario de la ciudad', tipo: 'municipal', se_repite: 1 });
      const res = await api.delete(`/feriados/${id}?desde=${desde}`, como('admin'));
      assert.equal(res.status, 200, `${desde}: ${JSON.stringify(res.body)}`);
      const fila = await filaGuardada(id);
      assert.equal(fila.activo, 0, desde);
      assert.equal(fila.hasta_anio, null, desde);
    }
  });

  it('uno que se repite, sin desde, da 400 en desde, sin tocar la fila', async () => {
    const id = await insertarFeriado({ fecha: '2026-02-23', nombre: 'Aniversario de la ciudad', tipo: 'municipal', se_repite: 1 });
    const antes = await todoLoGuardado();
    for (const consulta of ['', '?desde=', '?desde=abc', '?desde=2028.5', '?desde=2027&desde=2028']) {
      const res = await api.delete(`/feriados/${id}${consulta}`, como('admin'));
      assert.equal(res.status, 400, `«${consulta}»: ${JSON.stringify(res.body)}`);
      assert.deepEqual(res.body, { success: false, error: MENSAJES_FERIADO.desde, campo: 'desde' }, consulta);
    }
    assert.deepEqual(await todoLoGuardado(), antes);
  });
});
