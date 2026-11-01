// API de Feriados (spec 2026-10-26-feriados, secciones 2 y 3): GET /api/feriados lo ve cualquier rol con sesión (también el
// lector y el colaborador; sin sesión, 401), con los feriados del año (los 9 fijos y los de la tabla, los que se repiten
// proyectados al año) y los años del selector; un año que no sirve da 400 en `anio`. La lectura (services/feriadosDatos.js):
// las filas activas con su `no_rige`, una sola fila (con FOR UPDATE en una transacción) y feriadosEntre, el Set de los días no
// hábiles de un rango. Y las escrituras, solo de administración (el lector y el colaborador, 403; sin sesión, 401): cargar y
// corregir (con los avisos), «no rige» con y sin «se pasó al» (en una sola transacción) y la baja, entera o desde un año; un id
// que no sirve, que no existe o dado de baja da 404, antes que la validación (400 con su campo). Contra una base de prueba
// propia, con feriados cargados por SQL. Desde los días restituidos (spec 2026-10-31-mi-espacio-dias-restituidos, 6), la foto:
// cargar, corregir y «Se pasó al» anotan en la misma transacción los días de las vacaciones ya cargadas que el feriado deja de
// hacer hábiles, GET /feriados/afectadas, el alta y la corrección dicen cuántas vacaciones quedan con días para restituir y desde
// cuándo corre el plazo, y las escrituras de los pedidos (services/miEspacioRestituciones.js), que todavía no llama nadie.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { asegurarBaseDePrueba } from './notas-fixtures.js';
import { FERIADOS_FIJOS, hoyArgentina } from '../services/notasDigitalesCalendario.js';
import { MENSAJES_FERIADO, feriadosDelAnio, validarFeriado, fotosDelFeriado, TIPOS_CON_FOTO } from '../services/feriadosReglas.js';
import { TIPOS_LICENCIA, TIPOS_CON_RESTITUIBLES } from '../services/miEspacioReglas.js';

let base, servidor, api, usuarios, dbReal, datos, pool, miEspacioDatos, restituciones;

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
  miEspacioDatos = await import('../services/miEspacioDatos.js');
  restituciones = await import('../services/miEspacioRestituciones.js');
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
  // feriados (ON DELETE CASCADE). Y sin licencias de Mi espacio: las cuenta licencias_afectadas
  await query('DELETE FROM feriados');
  await query('DELETE FROM mi_espacio_licencias');
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
    assert.deepEqual(Object.keys(res.body.data),
      ['id', 'licencias_afectadas', 'vacaciones_para_restituir', 'plazo_de_restitucion']);
    assert.ok(Number.isInteger(res.body.data.id) && res.body.data.id > 0);
    // Sin licencias de Mi espacio cargadas, ninguna lo incluye ni queda nada para restituir
    assert.equal(res.body.data.licencias_afectadas, 0);
    assert.equal(res.body.data.vacaciones_para_restituir, 0);
    assert.equal(res.body.data.plazo_de_restitucion, null);
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
      [carnaval({ trasladado_de: '2026-02-16' }), 'trasladado_de', MENSAJES_FERIADO.trasladado],
      [carnaval({ trasladado_de: '2026-02-30' }), 'trasladado_de', MENSAJES_FERIADO.trasladado],
      [carnaval({ trasladado_de: 'abc' }), 'trasladado_de', MENSAJES_FERIADO.trasladado]
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
    assert.deepEqual(res.body, {
      success: true, message: 'Feriado corregido.', avisos: [],
      data: { licencias_afectadas: 0, vacaciones_para_restituir: 0, plazo_de_restitucion: null }
    });
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

  it('uno que se repite y se dio de baja desde un año no pasa a una fecha de ese año o de después: 400 en fecha', async () => {
    // Dado de baja desde 2027: rige solo en 2026. Corregido a 2027, no regiría ningún año y ninguna lista lo mostraría
    const id = await insertarFeriado({ fecha: '2026-02-23', nombre: 'Aniversario de la ciudad', tipo: 'municipal', se_repite: 1,
      hasta_anio: 2026 });
    // Uno al que le sacaron «se repite» y conserva su hasta_anio: volver a marcarlo con una fecha de 2027 tampoco pasa
    const sinRepetir = await insertarFeriado({ fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal',
      se_repite: 0, hasta_anio: 2026 });
    const antes = await todoLoGuardado();
    const error = { success: false, error: MENSAJES_FERIADO.despuesDeLaBaja, campo: 'fecha' };
    const aniversario = { fecha: '2027-02-23', nombre: 'Aniversario de la ciudad', tipo: 'municipal', se_repite: true };
    const res = await api.put(`/feriados/${id}`, aniversario, como('admin'));
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.deepEqual(res.body, error);
    const otraVez = await api.put(`/feriados/${sinRepetir}`,
      { fecha: '2027-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', se_repite: true }, como('admin'));
    assert.equal(otraVez.status, 400, JSON.stringify(otraVez.body));
    assert.deepEqual(otraVez.body, error);
    assert.deepEqual(await todoLoGuardado(), antes);

    // En el mismo año sí, y sin «se repite» también (rige solo en su fecha)
    const mismoAnio = await api.put(`/feriados/${id}`, { ...aniversario, fecha: '2026-02-24' }, como('admin'));
    assert.equal(mismoAnio.status, 200, JSON.stringify(mismoAnio.body));
    const sinRepetirEn2027 = await api.put(`/feriados/${sinRepetir}`,
      { fecha: '2027-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', se_repite: false }, como('admin'));
    assert.equal(sinRepetirEn2027.status, 200, JSON.stringify(sinRepetirEn2027.body));
    assert.equal((await filaGuardada(id)).fecha, '2026-02-24');
    assert.equal((await filaGuardada(sinRepetir)).fecha, '2027-11-08');
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
    assert.deepEqual(Object.keys(res.body).sort(), ['avisos', 'data', 'message', 'success']);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'En 2027 no rige: se pasó al 09/11/2027.');
    assert.deepEqual(res.body.avisos, [], 'el martes 9/11 no cae en fin de semana ni hay otro feriado ese día');
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
    assert.deepEqual(segunda.body.avisos, [], 'el día que ya estaba no se cuenta a sí mismo');
    assert.deepEqual(await todoLoGuardado(), despues);
    assert.equal(despues.feriados.length, 2);
    assert.equal(despues.no_rige.length, 1);
  });

  // Como al cargar uno (POST): los avisos del día al que se pasó, contra la proyección completa del año y sin contarlo a él (ni
  // cuando se carga ni cuando ya estaba), que no frenan nada
  it('«Se pasó al» trae los avisos de ese día: el domingo, un fijo, otro de la tabla; sin contarse a sí mismo', async () => {
    const id = await empleadoMunicipal();
    const domingo = await api.put(`/feriados/${id}/rige`, { anio: 2027, rige: false, pasa_al: '2027-11-14' }, como('admin'));
    assert.equal(domingo.status, 200, JSON.stringify(domingo.body));
    assert.deepEqual(domingo.body.avisos, ['Cae domingo: no cambia ningún día hábil.']);
    assert.equal(domingo.body.message, 'En 2027 no rige: se pasó al 14/11/2027.');
    assert.equal((await filaGuardada(domingo.body.data.nuevo_id)).fecha, '2027-11-14', 'lo carga igual');
    const otraVez = await api.put(`/feriados/${id}/rige`, { anio: 2027, rige: false, pasa_al: '2027-11-14' }, como('admin'));
    assert.equal(otraVez.body.data.nuevo_id, domingo.body.data.nuevo_id);
    assert.deepEqual(otraVez.body.avisos, ['Cae domingo: no cambia ningún día hábil.'], 'el que ya estaba no se cuenta');

    const fijo = await api.put(`/feriados/${id}/rige`, { anio: 2026, rige: false, pasa_al: '2026-12-08' }, como('admin'));
    assert.equal(fijo.status, 200, JSON.stringify(fijo.body));
    assert.deepEqual(fijo.body.avisos, ['Ese día ya es feriado: Inmaculada Concepción de María (fijo del sistema).']);

    await insertarFeriado({ fecha: '2026-11-10', nombre: 'Asueto municipal', tipo: 'municipal' });
    const deLaTabla = await api.put(`/feriados/${id}/rige`, { anio: 2026, rige: false, pasa_al: '2026-11-10' }, como('admin'));
    assert.equal(deLaTabla.status, 200, JSON.stringify(deLaTabla.body));
    assert.deepEqual(deLaTabla.body.avisos, ['Ese día ya es feriado: Asueto municipal.']);
  });

  it('sin «se pasó al», solo marca que ese año no rige', async () => {
    const id = await empleadoMunicipal();
    for (const pasaAl of [undefined, null, '']) {
      const res = await api.put(`/feriados/${id}/rige`, { anio: 2027, rige: false, pasa_al: pasaAl }, como('admin'));
      assert.equal(res.status, 200, `${pasaAl}: ${JSON.stringify(res.body)}`);
      assert.deepEqual(res.body, { success: true, message: 'En 2027 no rige.', data: { nuevo_id: null }, avisos: [] }, String(pasaAl));
    }
    assert.deepEqual(await todoLoGuardado(), {
      feriados: [{ id, fecha: '2026-11-08', nombre: 'Día del Empleado Municipal', tipo: 'municipal', trasladado_de: null,
        se_repite: 1, hasta_anio: null, activo: 1, creado_por: null }],
      no_rige: [{ feriado_id: id, anio: 2027 }]
    });
  });

  it('rige: true lo vuelve a habilitar, sin tocar el día al que se había pasado (el mensaje lo dice)', async () => {
    const id = await empleadoMunicipal();
    await noRige(id, 2028);
    const marca = await api.put(`/feriados/${id}/rige`, { anio: 2027, rige: false, pasa_al: '2027-11-09' }, como('admin'));
    assert.equal(marca.status, 200, JSON.stringify(marca.body));

    // pasa_al no cuenta con rige: true
    const res = await api.put(`/feriados/${id}/rige`, { anio: 2027, rige: true, pasa_al: '2027-11-10' }, como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, {
      success: true,
      message: 'En 2027 vuelve a regir. El día al que se había pasado (09/11/2027) sigue cargado: si ya no corresponde, dalo de baja.',
      data: { nuevo_id: null }, avisos: []
    });
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

  it('rige: true sin un día al que se haya pasado ese año (o dado de baja, o de otro año u otro nombre): el mensaje de siempre', async () => {
    const id = await empleadoMunicipal();
    const sinPasar = await api.put(`/feriados/${id}/rige`, { anio: 2027, rige: false }, como('admin'));
    assert.equal(sinPasar.status, 200, JSON.stringify(sinPasar.body));
    // Otros que no son el día al que se pasó en 2027: de otro año, con otro nombre y uno dado de baja
    await insertarFeriado({ fecha: '2026-11-09', nombre: 'Día del Empleado Municipal', tipo: 'municipal', trasladado_de: '2026-11-08' });
    await insertarFeriado({ fecha: '2027-11-09', nombre: 'Otro feriado', tipo: 'municipal', trasladado_de: '2027-11-08' });
    await insertarFeriado({ fecha: '2027-11-10', nombre: 'Día del Empleado Municipal', tipo: 'municipal', trasladado_de: '2027-11-08',
      activo: 0 });
    const res = await api.put(`/feriados/${id}/rige`, { anio: 2027, rige: true }, como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, message: 'En 2027 vuelve a regir.', data: { nuevo_id: null }, avisos: [] });
    assert.deepEqual(await aniosQueNoRigen(id), []);
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

// Cuántas licencias de Mi espacio incluye un feriado (spec 2026-10-26-feriados, 3 y 6; la entrega 2 lo suma): GET
// /feriados/afectadas, antes de guardar, y licencias_afectadas en la respuesta del alta y de la corrección, con lo guardado. Uno que
// se repite cuenta todos los años en que rige (decisión del usuario, 26/10/2026), cada licencia una vez. Las licencias, por SQL
describe('las licencias de Mi espacio que incluye un feriado', () => {
  // Una licencia de Mi espacio de esa persona, de desde a hasta (activa, salvo que se diga)
  const insertarLicencia = async (clave, desde, hasta, activo = 1) => (await query(
    "INSERT INTO mi_espacio_licencias (usuario_id, tipo, desde, hasta, activo) VALUES (?, 'vacaciones', ?, ?, ?)",
    [usuarios[clave].id, desde, hasta, activo]
  )).insertId;
  // GET /feriados/afectadas con esa consulta, como administración: el número, con la forma de la respuesta controlada (estas
  // licencias no tienen arranque: ninguna queda para restituir)
  const afectadas = async (consulta) => {
    const res = await api.get(`/feriados/afectadas${consulta}`, como('admin'));
    assert.equal(res.status, 200, `${consulta}: ${JSON.stringify(res.body)}`);
    assert.deepEqual(Object.keys(res.body).sort(), ['data', 'success'], consulta);
    assert.equal(res.body.success, true, consulta);
    assert.deepEqual(Object.keys(res.body.data), ['licencias_afectadas', 'vacaciones_para_restituir', 'plazo_de_restitucion'],
      consulta);
    assert.equal(res.body.data.vacaciones_para_restituir, 0, consulta);
    assert.equal(res.body.data.plazo_de_restitucion, null, consulta);
    return res.body.data.licencias_afectadas;
  };

  it('dos licencias de dos personas incluyen el 16/02/2026: el GET da 2 y el alta de ese día trae licencias_afectadas: 2', async () => {
    await insertarLicencia('admin', '2026-02-16', '2026-02-20');
    await insertarLicencia('editor', '2026-02-12', '2026-02-16');
    // Las que no cuentan: una que no lo incluye y una dada de baja que sí
    await insertarLicencia('superadmin', '2026-02-17', '2026-02-18');
    await insertarLicencia('admin', '2026-02-16', '2026-02-16', 0);
    assert.equal(await afectadas('?fecha=2026-02-16'), 2);
    assert.equal(await afectadas('?fecha=2026-02-16&se_repite=0'), 2);
    assert.equal(await afectadas('?fecha=2026-02-19'), 1);
    assert.equal(await afectadas('?fecha=2026-03-02'), 0);

    const alta = await api.post('/feriados', carnaval(), como('admin'));
    assert.equal(alta.status, 201, JSON.stringify(alta.body));
    assert.equal(alta.body.data.licencias_afectadas, 2);
    // La corrección cuenta con la fecha que quedó guardada: el 13/02 solo lo incluye la del editor
    const correccion = await api.put(`/feriados/${alta.body.data.id}`, carnaval({ fecha: '2026-02-13' }), como('admin'));
    assert.equal(correccion.status, 200, JSON.stringify(correccion.body));
    assert.deepEqual(correccion.body.data, { licencias_afectadas: 1, vacaciones_para_restituir: 0, plazo_de_restitucion: null });
  });

  it('una fecha que no es una fecha da 400 en fecha', async () => {
    for (const consulta of ['', '?fecha=', '?fecha=abc', '?fecha=2026-02-30', '?fecha=2026-2-16', '?fecha=2026-02-16&fecha=2026-02-17']) {
      const res = await api.get(`/feriados/afectadas${consulta}`, como('admin'));
      assert.equal(res.status, 400, `«${consulta}»: ${JSON.stringify(res.body)}`);
      assert.deepEqual(res.body, { success: false, error: MENSAJES_FERIADO.fecha, campo: 'fecha' }, consulta);
    }
  });

  // Las fechas de los tests de «Todos los años» son el 15/12, un día hábil en 2025 (lunes), 2026 (martes) y 2027 (miércoles): así
  // cada año cuenta (desde la decisión del usuario del 27/10/2026, una fecha que no cambia un día hábil no cuenta). Los otros
  // feriados guardados van el 16/12 y el 17/12, días hábiles de esos años, para no ser «otro feriado ese día» del 15/12
  it('«Todos los años»: uno que se repite cuenta las licencias de cada año en que rige; uno que no, solo las del suyo', async () => {
    await insertarLicencia('admin', '2026-12-11', '2026-12-16');
    await insertarLicencia('editor', '2027-12-15', '2027-12-15');
    // Una de antes de su primer año no cuenta: no rige hacia atrás
    await insertarLicencia('superadmin', '2025-12-12', '2025-12-16');
    assert.equal(await afectadas('?fecha=2026-12-15&se_repite=1'), 2);
    assert.equal(await afectadas('?fecha=2026-12-15&se_repite=0'), 1);
    assert.equal(await afectadas('?fecha=2026-12-15'), 1);
    assert.equal(await afectadas('?fecha=2027-12-15&se_repite=1'), 1);
    // se_repite es '1' o '0': cualquier otro valor es '0'
    for (const valor of ['true', 'si', '2', '']) assert.equal(await afectadas(`?fecha=2026-12-15&se_repite=${valor}`), 1, valor);
  });

  it('una licencia que incluye el feriado de dos años cuenta una vez', async () => {
    await insertarLicencia('admin', '2026-12-11', '2027-12-16');
    assert.equal(await afectadas('?fecha=2026-12-15&se_repite=1'), 1);
  });

  it('con el id de uno guardado se usan su baja y sus años que no rigen; sin id, o con uno que no sirve, no', async () => {
    await insertarLicencia('admin', '2026-12-11', '2026-12-16');
    await insertarLicencia('editor', '2027-12-15', '2027-12-15');
    const sin2027 = await insertarFeriado({ fecha: '2026-12-16', nombre: 'Día del Petróleo', tipo: 'provincial', se_repite: 1 });
    await noRige(sin2027, 2027);
    const hasta2026 = await insertarFeriado({
      fecha: '2026-12-17', nombre: 'Otro que se repite', tipo: 'provincial', se_repite: 1, hasta_anio: 2026
    });
    // Dado de baja, ese mismo día: tampoco es «otro feriado»
    const deBaja = await insertarFeriado({ fecha: '2026-12-15', nombre: 'Dado de baja', se_repite: 1, hasta_anio: 2026, activo: 0 });
    // El modal los pasa al 15/12: sus años que no rigen y su baja desde un año van con ellos
    assert.equal(await afectadas(`?fecha=2026-12-15&se_repite=1&id=${sin2027}`), 1);
    assert.equal(await afectadas(`?fecha=2026-12-15&se_repite=1&id=${hasta2026}`), 1);
    // La fecha y «se repite» son los del modal, no los guardados
    assert.equal(await afectadas(`?fecha=2027-12-15&se_repite=1&id=${hasta2026}`), 0);
    assert.equal(await afectadas(`?fecha=2026-12-15&se_repite=0&id=${sin2027}`), 1);
    // En 2027 sin2027 no rige; sin «se repite», el del modal es solo de 2027 y sus años que no rigen no cuentan
    assert.equal(await afectadas(`?fecha=2027-12-15&se_repite=1&id=${sin2027}`), 0);
    assert.equal(await afectadas(`?fecha=2027-12-15&se_repite=0&id=${sin2027}`), 1);
    for (const id of [deBaja, 999999, 'abc', '0', '']) {
      assert.equal(await afectadas(`?fecha=2026-12-15&se_repite=1&id=${id}`), 2, String(id));
    }
  });

  it('el alta y la corrección de uno que se repite cuentan con lo guardado, también sus años que no rigen', async () => {
    await insertarLicencia('admin', '2026-12-11', '2026-12-16');
    await insertarLicencia('editor', '2027-12-15', '2027-12-15');
    const alta = await api.post('/feriados',
      { fecha: '2026-12-15', nombre: 'Día del Petróleo', tipo: 'provincial', se_repite: true }, como('admin'));
    assert.equal(alta.status, 201, JSON.stringify(alta.body));
    assert.equal(alta.body.data.licencias_afectadas, 2);
    await noRige(alta.body.data.id, 2027);
    const correccion = await api.put(`/feriados/${alta.body.data.id}`,
      { fecha: '2026-12-15', nombre: 'Día del Petróleo Nacional', tipo: 'provincial', se_repite: true }, como('admin'));
    assert.equal(correccion.status, 200, JSON.stringify(correccion.body));
    assert.equal(correccion.body.data.licencias_afectadas, 1);
  });

  // Decisión del usuario (27/10/2026): el 13/12 es domingo en 2026 y lunes en 2027, así que de uno que se repite solo cuenta el de
  // 2027, cada año por separado
  it('un domingo no cambia ningún día hábil: el 13/12 que se repite cuenta solo en 2027, cuando cae lunes', async () => {
    await insertarLicencia('admin', '2026-12-10', '2026-12-14');
    await insertarLicencia('editor', '2027-12-13', '2027-12-13');
    assert.equal(await afectadas('?fecha=2026-12-13&se_repite=1'), 1);
    assert.equal(await afectadas('?fecha=2026-12-13&se_repite=0'), 0);
    assert.equal(await afectadas('?fecha=2026-12-13'), 0);
    assert.equal(await afectadas('?fecha=2027-12-13&se_repite=0'), 1);
    const alta = await api.post('/feriados',
      { fecha: '2026-12-13', nombre: 'Día del Petróleo', tipo: 'provincial', se_repite: true }, como('admin'));
    assert.equal(alta.status, 201, JSON.stringify(alta.body));
    assert.equal(alta.body.data.licencias_afectadas, 1);
    await noRige(alta.body.data.id, 2027);
    const correccion = await api.put(`/feriados/${alta.body.data.id}`,
      { fecha: '2026-12-13', nombre: 'Día del Petróleo Nacional', tipo: 'provincial', se_repite: true }, como('admin'));
    assert.equal(correccion.status, 200, JSON.stringify(correccion.body));
    assert.equal(correccion.body.data.licencias_afectadas, 0);
  });

  // Solo si cambia algo (decisión del usuario, 27/10/2026): una fecha que sin el feriado ya no era un día hábil (sábado, domingo,
  // uno de los 9 fijos u otro feriado que rige ese día) no cuenta
  it('solo las fechas que cambian un día hábil: un sábado o el 25/12 dan 0, el lunes da 1 y, con otro feriado ese lunes, 0',
    async () => {
      // Del viernes 30/10 al martes 3/11/2026, y otra que incluye la Navidad
      await insertarLicencia('admin', '2026-10-30', '2026-11-03');
      await insertarLicencia('editor', '2026-12-21', '2026-12-28');
      assert.equal(await afectadas('?fecha=2026-10-31'), 0);
      assert.equal(await afectadas('?fecha=2026-11-01'), 0);
      assert.equal(await afectadas('?fecha=2026-12-25'), 0);
      assert.equal(await afectadas('?fecha=2026-11-02'), 1);
      const alta = await api.post('/feriados', carnaval({ fecha: '2026-10-31', nombre: 'Un sábado' }), como('admin'));
      assert.equal(alta.status, 201, JSON.stringify(alta.body));
      assert.equal(alta.body.data.licencias_afectadas, 0);

      await insertarFeriado({ fecha: '2026-11-02', nombre: 'Otro feriado ese lunes' });
      assert.equal(await afectadas('?fecha=2026-11-02'), 0);
      const mismoDia = await api.post('/feriados', carnaval({ fecha: '2026-11-02', nombre: 'El mismo lunes' }), como('admin'));
      assert.equal(mismoDia.status, 201, JSON.stringify(mismoDia.body));
      assert.equal(mismoDia.body.data.licencias_afectadas, 0);
    });

  it('corregir un feriado no lo cuenta a él como «otro feriado» ese día; uno que se repite en dos años hábiles cuenta una vez',
    async () => {
      // El 2/11 es lunes en 2026 y martes en 2027
      await insertarLicencia('admin', '2026-11-02', '2026-11-02');
      await insertarLicencia('editor', '2026-10-26', '2027-11-05');
      const alta = await api.post('/feriados', carnaval({ fecha: '2026-11-02', nombre: 'Feriado del 2/11', se_repite: true }),
        como('admin'));
      assert.equal(alta.status, 201, JSON.stringify(alta.body));
      const { id } = alta.body.data;
      assert.equal(alta.body.data.licencias_afectadas, 2);
      // Con su id, no se cuenta a sí mismo; sin él, ya guardado, es otro feriado ese día y no cambia nada
      assert.equal(await afectadas(`?fecha=2026-11-02&se_repite=1&id=${id}`), 2);
      assert.equal(await afectadas(`?fecha=2026-11-02&se_repite=0&id=${id}`), 2);
      assert.equal(await afectadas('?fecha=2026-11-02&se_repite=1'), 0);
      const correccion = await api.put(`/feriados/${id}`,
        carnaval({ fecha: '2026-11-02', nombre: 'Feriado del 2 de noviembre', se_repite: true }), como('admin'));
      assert.equal(correccion.status, 200, JSON.stringify(correccion.body));
      assert.equal(correccion.body.data.licencias_afectadas, 2);
    });

  // Es aislado: el feriado ya está guardado y la respuesta no cambia (la tabla, renombrada mientras tanto en la base de prueba).
  // Desde los días restituidos, la foto lee las cargas de Mi espacio dentro de la transacción del feriado: el alta y la
  // corrección que se guardan sin la tabla son las que no tienen ninguna fecha nueva que cambie un día hábil (un sábado y
  // después solo el nombre), así que no la necesitan; una que sí la necesita no se guarda (spec 2026-10-31-mi-espacio-dias-
  // restituidos, 6: la foto va en la misma transacción)
  it('si la cuenta de las licencias falla, un alta y una corrección que no necesitan las cargas se guardan igual (las cuentas, '
    + 'aisladas); una que las necesita para la foto no se guarda', async () => {
    await asegurarBaseDePrueba();
    await query('RENAME TABLE mi_espacio_licencias TO mi_espacio_licencias_fuera');
    try {
      // Cada cuenta va aislada: la de las licencias falla (null); la de restituir no necesita la tabla con un día que no cambia
      // ningún día hábil (no lee las cargas: 0 y sin plazo)
      const SIN_CUENTAS = { licencias_afectadas: null, vacaciones_para_restituir: 0, plazo_de_restitucion: null };
      const alta = await api.post('/feriados', carnaval({ fecha: '2026-02-14' }), como('admin'));
      assert.equal(alta.status, 201, JSON.stringify(alta.body));
      assert.deepEqual(Object.keys(alta.body).sort(), ['avisos', 'data', 'message', 'success']);
      assert.equal(alta.body.message, 'Feriado cargado.');
      assert.deepEqual(alta.body.data, { id: alta.body.data.id, ...SIN_CUENTAS });
      assert.equal((await filaGuardada(alta.body.data.id)).nombre, 'Carnaval');

      const correccion = await api.put(`/feriados/${alta.body.data.id}`,
        carnaval({ fecha: '2026-02-14', nombre: 'Carnaval 2026' }), como('admin'));
      assert.equal(correccion.status, 200, JSON.stringify(correccion.body));
      assert.deepEqual(correccion.body, {
        success: true, message: 'Feriado corregido.', avisos: ['Cae sábado: no cambia ningún día hábil.'], data: SIN_CUENTAS
      });
      assert.equal((await filaGuardada(alta.body.data.id)).nombre, 'Carnaval 2026');

      // Un lunes sí cambia un día hábil: la foto necesita las cargas, y sin la tabla no se guarda nada
      const antes = await todoLoGuardado();
      const lunes = await api.post('/feriados', carnaval(), como('admin'));
      assert.equal(lunes.status, 500, JSON.stringify(lunes.body));
      const aLunes = await api.put(`/feriados/${alta.body.data.id}`, carnaval({ nombre: 'Carnaval 2026' }), como('admin'));
      assert.equal(aLunes.status, 500, JSON.stringify(aLunes.body));
      assert.deepEqual(await todoLoGuardado(), antes);

      // El GET es la cuenta: si falla, 500
      const res = await api.get('/feriados/afectadas?fecha=2026-02-16', como('admin'));
      assert.equal(res.status, 500);
      assert.equal(res.body.success, false);
    } finally {
      await query('RENAME TABLE mi_espacio_licencias_fuera TO mi_espacio_licencias');
    }
  });

  it('el lector y el colaborador reciben 403; sin sesión, 401', async () => {
    for (const clave of ['lector', 'colab']) {
      assert.equal((await api.get('/feriados/afectadas?fecha=2026-02-16', como(clave))).status, 403, clave);
    }
    assert.equal((await api.get('/feriados/afectadas?fecha=2026-02-16')).status, 401);
  });
});

// La foto de los días por restituir (spec 2026-10-31-mi-espacio-dias-restituidos, 4 y 6): con Julieta Ferreyra (inventada; acá,
// el usuario de prueba con rol admin), con vacaciones del 11/12/2026 al 08/01/2027 y arranque el 02/11/2026, y los asuetos del
// jueves 24 y del jueves 31/12/2026, cargados después
describe('la foto de los días por restituir', () => {
  beforeEach(async () => {
    await query('DELETE FROM mi_espacio_arranque');
    await query('DELETE FROM mi_espacio_anios');
    await query('DELETE FROM mi_espacio_saldos');
  });

  const conArranque = (clave, fecha = '2026-11-02') => query(
    'INSERT INTO mi_espacio_arranque (usuario_id, fecha) VALUES (?, ?) ON DUPLICATE KEY UPDATE fecha = VALUES(fecha)',
    [usuarios[clave].id, fecha]
  );
  const insertarCarga = async (clave, tipo, desde, hasta, activo = 1) => (await query(
    'INSERT INTO mi_espacio_licencias (usuario_id, tipo, desde, hasta, activo) VALUES (?, ?, ?, ?, ?)',
    [usuarios[clave].id, tipo, desde, hasta, activo]
  )).insertId;
  // Las vacaciones de Julieta, con su arranque
  const vacacionesDeJulieta = async () => {
    await conArranque('admin');
    return insertarCarga('admin', 'vacaciones', '2026-12-11', '2027-01-08');
  };
  const asueto = (fecha, cambios = {}) => ({ fecha, nombre: 'Asueto', tipo: 'no_laborable', se_repite: false, ...cambios });
  const cargar = async (cuerpo) => {
    const res = await api.post('/feriados', cuerpo, como('admin'));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.data;
  };
  const corregir = async (id, cuerpo) => {
    const res = await api.put(`/feriados/${id}`, cuerpo, como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data;
  };
  // Lo que hay en la foto, con los números como números
  const laFoto = async () => (await query(
    `SELECT licencia_id, feriado_id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, tanda, restitucion_id
     FROM mi_espacio_restituibles ORDER BY licencia_id, fecha`
  )).map((fila) => ({
    licencia_id: Number(fila.licencia_id), feriado_id: Number(fila.feriado_id), fecha: fila.fecha,
    tanda: fila.tanda === null ? null : Number(fila.tanda), restitucion_id: fila.restitucion_id === null ? null : Number(fila.restitucion_id)
  }));
  const foto = (licencia_id, feriado_id, fecha, tanda = null, restitucion_id = null) =>
    ({ licencia_id, feriado_id, fecha, tanda, restitucion_id });
  // Simula una falla después del INSERT del feriado: un trigger de la base de prueba rechaza el INSERT de la foto
  const conFallaAlSacarLaFoto = async (fn) => {
    await asegurarBaseDePrueba();
    await query('DROP TRIGGER IF EXISTS falla_simulada_foto');
    await query(`CREATE TRIGGER falla_simulada_foto BEFORE INSERT ON mi_espacio_restituibles FOR EACH ROW
      BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falla simulada'; END`);
    try {
      return await fn();
    } finally {
      await query('DROP TRIGGER IF EXISTS falla_simulada_foto');
    }
  };

  it('cargar el asueto saca la foto de las vacaciones ya cargadas, y la respuesta dice cuántas y el plazo', async () => {
    const vacaciones = await vacacionesDeJulieta();
    const del24 = await cargar(asueto('2026-12-24'));
    assert.deepEqual(del24, {
      id: del24.id, licencias_afectadas: 1, vacaciones_para_restituir: 1, plazo_de_restitucion: '2027-04-30'
    });
    assert.deepEqual(await laFoto(), [foto(vacaciones, del24.id, '2026-12-24')]);
    const del31 = await cargar(asueto('2026-12-31'));
    assert.deepEqual(await laFoto(), [foto(vacaciones, del24.id, '2026-12-24'), foto(vacaciones, del31.id, '2026-12-31')]);
  });

  it('solo lo que cambió (Review Focus 2): otro feriado ese día, un sábado, otra licencia, una dada de baja o antes del arranque, no',
    async () => {
      const vacaciones = await vacacionesDeJulieta();
      await insertarCarga('superadmin', 'medica', '2026-12-22', '2026-12-28');
      await conArranque('lector', '2026-12-28');
      await insertarCarga('lector', 'vacaciones', '2026-12-21', '2026-12-30');
      await conArranque('colab');
      await insertarCarga('colab', 'vacaciones', '2026-12-21', '2026-12-30', 0);
      // Unas vacaciones sin arranque (sin saldo inicial no descuentan)
      await insertarCarga('editor', 'vacaciones', '2026-12-21', '2026-12-30');
      await insertarFeriado({ fecha: '2026-12-23', nombre: 'Otro feriado' });

      const mismoDia = await cargar(asueto('2026-12-23'));
      assert.deepEqual([mismoDia.vacaciones_para_restituir, mismoDia.plazo_de_restitucion], [0, null]);
      const sabado = await cargar(asueto('2026-12-26'));
      assert.deepEqual([sabado.vacaciones_para_restituir, sabado.plazo_de_restitucion], [0, null]);
      assert.deepEqual(await laFoto(), []);

      // El 24/12 lo incluyen cuatro licencias activas, pero solo las vacaciones de Julieta quedan con un día para restituir
      const del24 = await cargar(asueto('2026-12-24'));
      assert.deepEqual([del24.licencias_afectadas, del24.vacaciones_para_restituir, del24.plazo_de_restitucion],
        [4, 1, '2027-04-30']);
      assert.deepEqual(await laFoto(), [foto(vacaciones, del24.id, '2026-12-24')]);
    });

  it('si algo falla después del INSERT, no queda ni el feriado ni la foto (en el alta y en la corrección)', async () => {
    await vacacionesDeJulieta();
    const fuera = await insertarFeriado({ fecha: '2026-12-01', nombre: 'Asueto' });
    const antes = await todoLoGuardado();
    const alta = await conFallaAlSacarLaFoto(() => api.post('/feriados', asueto('2026-12-24'), como('admin')));
    assert.equal(alta.status, 500, JSON.stringify(alta.body));
    assert.deepEqual(alta.body, { success: false, error: 'Error al cargar el feriado' });
    const correccion = await conFallaAlSacarLaFoto(() => api.put(`/feriados/${fuera}`, asueto('2026-12-24'), como('admin')));
    assert.equal(correccion.status, 500, JSON.stringify(correccion.body));
    assert.deepEqual(correccion.body, { success: false, error: 'Error al corregir el feriado' });
    assert.deepEqual(await todoLoGuardado(), antes);
    assert.deepEqual(await laFoto(), []);
  });

  it('corregirlo a otra fecha mueve la foto: la vieja sin pedido se borra', async () => {
    const vacaciones = await vacacionesDeJulieta();
    const { id } = await cargar(asueto('2026-12-24'));
    const correccion = await corregir(id, asueto('2026-12-23'));
    assert.deepEqual(correccion, { licencias_afectadas: 1, vacaciones_para_restituir: 1, plazo_de_restitucion: '2027-04-30' });
    assert.deepEqual(await laFoto(), [foto(vacaciones, id, '2026-12-23')]);
    // Fuera de las vacaciones: no queda ninguna
    assert.deepEqual(await corregir(id, asueto('2026-12-01')),
      { licencias_afectadas: 0, vacaciones_para_restituir: 0, plazo_de_restitucion: null });
    assert.deepEqual(await laFoto(), []);
  });

  it('la de un día ya pedido queda, y la de un día en que sigue otro feriado pasa a ese feriado', async () => {
    const vacaciones = await vacacionesDeJulieta();
    const del31 = await cargar(asueto('2026-12-31'));
    // Pedida: un pedido de restitución enlazado a la foto del 31/12
    const pedido = (await query(
      `INSERT INTO mi_espacio_restituciones (usuario_id, licencia_id, anio, caso, dias, primer_asueto, tanda, fecha)
       VALUES (?, ?, 2025, 'restituir', 1, '2026-12-31', 0, '2027-01-11')`,
      [usuarios.admin.id, vacaciones]
    )).insertId;
    await query('UPDATE mi_espacio_restituibles SET tanda = 0, restitucion_id = ? WHERE licencia_id = ?', [pedido, vacaciones]);
    await corregir(del31.id, asueto('2026-12-30'));
    assert.deepEqual(await laFoto(), [
      foto(vacaciones, del31.id, '2026-12-30'), foto(vacaciones, del31.id, '2026-12-31', 0, pedido)
    ]);

    const del22 = await cargar(asueto('2026-12-22'));
    const otro = await insertarFeriado({ fecha: '2026-12-22', nombre: 'Otro asueto', tipo: 'no_laborable' });
    await corregir(del22.id, asueto('2026-12-21'));
    assert.deepEqual(await laFoto(), [
      foto(vacaciones, del22.id, '2026-12-21'), foto(vacaciones, otro, '2026-12-22'),
      foto(vacaciones, del31.id, '2026-12-30'), foto(vacaciones, del31.id, '2026-12-31', 0, pedido)
    ]);
  });

  it('renombrarlo no saca foto (Review Focus 2); pasarlo a «se repite» saca solo la de los otros años', async () => {
    await vacacionesDeJulieta();
    // Cargado antes de las vacaciones (por SQL: sin foto)
    const id = await insertarFeriado({ fecha: '2026-12-24', nombre: 'Asueto' });
    assert.deepEqual(await corregir(id, asueto('2026-12-24', { nombre: 'Asueto navideño' })),
      { licencias_afectadas: 1, vacaciones_para_restituir: 0, plazo_de_restitucion: null });
    assert.deepEqual(await laFoto(), []);

    // El 24/12/2027 cae viernes; el plazo, el último día hábil de abril de 2028 (el viernes 28)
    await conArranque('editor');
    const de2027 = await insertarCarga('editor', 'vacaciones', '2027-12-20', '2027-12-28');
    assert.deepEqual(await corregir(id, asueto('2026-12-24', { nombre: 'Asueto navideño', se_repite: true })),
      { licencias_afectadas: 2, vacaciones_para_restituir: 1, plazo_de_restitucion: '2028-04-28' });
    assert.deepEqual(await laFoto(), [foto(de2027, id, '2027-12-24')]);
  });

  it('«Se pasó al» saca la foto del día que carga; el que ya estaba cargado, no', async () => {
    const vacaciones = await vacacionesDeJulieta();
    const petroleo = await insertarFeriado({ fecha: '2026-12-14', nombre: 'Día del Petróleo', tipo: 'provincial', se_repite: 1 });
    const res = await api.put(`/feriados/${petroleo}/rige`, { anio: 2026, rige: false, pasa_al: '2026-12-15' }, como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(await laFoto(), [foto(vacaciones, res.body.data.nuevo_id, '2026-12-15')]);

    const otro = await insertarFeriado({ fecha: '2026-12-16', nombre: 'Otro que se repite', tipo: 'provincial', se_repite: 1 });
    const yaEstaba = await insertarFeriado({ fecha: '2026-12-17', nombre: 'Otro que se repite', tipo: 'provincial' });
    const otraVez = await api.put(`/feriados/${otro}/rige`, { anio: 2026, rige: false, pasa_al: '2026-12-17' }, como('admin'));
    assert.equal(otraVez.status, 200, JSON.stringify(otraVez.body));
    assert.equal(otraVez.body.data.nuevo_id, yaEstaba);
    assert.deepEqual(await laFoto(), [foto(vacaciones, res.body.data.nuevo_id, '2026-12-15')]);
  });

  it('«no rige» y la baja no tocan la foto; volver a regir, con la foto ya sacada, la deja como estaba', async () => {
    const vacaciones = await vacacionesDeJulieta();
    const { id } = await cargar(asueto('2026-12-24', { se_repite: true }));
    const laDeAntes = [foto(vacaciones, id, '2026-12-24')];
    assert.deepEqual(await laFoto(), laDeAntes);
    for (const rige of [false, true]) {
      const res = await api.put(`/feriados/${id}/rige`, { anio: 2026, rige }, como('admin'));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(await laFoto(), laDeAntes, String(rige));
    }
    const baja = await api.delete(`/feriados/${id}?desde=2026`, como('admin'));
    assert.equal(baja.status, 200, JSON.stringify(baja.body));
    assert.deepEqual(await laFoto(), laDeAntes);
  });

  // Decisión del controlador del plan, por la decisión 4 de la spec (cuenta cualquier día que deja de ser hábil)
  it('volver a regir saca la foto de ese año, como un alta de esa fecha; si la foto falla, sigue sin regir', async () => {
    // Cargado antes y sin regir en 2026; las vacaciones, cargadas mientras no regía
    const id = await insertarFeriado({ fecha: '2026-12-24', nombre: 'Asueto', tipo: 'no_laborable', se_repite: 1 });
    await noRige(id, 2026);
    const vacaciones = await vacacionesDeJulieta();
    assert.deepEqual(await laFoto(), []);

    const antes = await todoLoGuardado();
    const falla = await conFallaAlSacarLaFoto(() => api.put(`/feriados/${id}/rige`, { anio: 2026, rige: true }, como('admin')));
    assert.equal(falla.status, 500, JSON.stringify(falla.body));
    assert.deepEqual(await todoLoGuardado(), antes);
    assert.deepEqual(await aniosQueNoRigen(id), [2026]);
    assert.deepEqual(await laFoto(), []);

    const res = await api.put(`/feriados/${id}/rige`, { anio: 2026, rige: true }, como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(await laFoto(), [foto(vacaciones, id, '2026-12-24')]);
    // Volver a regir un año que ya regía no cambia nada
    assert.equal((await api.put(`/feriados/${id}/rige`, { anio: 2026, rige: true }, como('admin'))).status, 200);
    assert.deepEqual(await laFoto(), [foto(vacaciones, id, '2026-12-24')]);
  });

  it('si la foto del día de «Se pasó al» falla, no queda ni el «no rige» ni el día nuevo', async () => {
    await vacacionesDeJulieta();
    const petroleo = await insertarFeriado({ fecha: '2026-12-14', nombre: 'Día del Petróleo', tipo: 'provincial', se_repite: 1 });
    const antes = await todoLoGuardado();
    const res = await conFallaAlSacarLaFoto(() =>
      api.put(`/feriados/${petroleo}/rige`, { anio: 2026, rige: false, pasa_al: '2026-12-15' }, como('admin')));
    assert.equal(res.status, 500, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: false, error: 'Error al cambiar si rige el feriado' });
    assert.deepEqual(await todoLoGuardado(), antes);
    assert.deepEqual(await laFoto(), []);
  });

  it('corregirlo para que deje de repetirse borra la foto sin pedido de los otros años', async () => {
    const vacaciones = await vacacionesDeJulieta();
    await conArranque('editor');
    const de2027 = await insertarCarga('editor', 'vacaciones', '2027-12-20', '2027-12-28');
    const { id } = await cargar(asueto('2026-12-24', { se_repite: true }));
    assert.deepEqual(await laFoto(), [foto(vacaciones, id, '2026-12-24'), foto(de2027, id, '2027-12-24')]);
    // Las vacaciones de 2026 conservan sus días (tienen la foto del 24/12/2026): no se cuentan como recalculadas
    assert.deepEqual(await corregir(id, asueto('2026-12-24')),
      { licencias_afectadas: 0, vacaciones_para_restituir: 0, plazo_de_restitucion: null });
    assert.deepEqual(await laFoto(), [foto(vacaciones, id, '2026-12-24')]);
  });

  // Revisión de la Task 15: al corregir un asueto que ya sacó foto, las vacaciones que la tienen conservan sus días, así que el
  // modal no puede decir que se recalculan
  it('con el id de uno guardado, las licencias que ya tienen su foto en las fechas que tenía no cuentan como recalculadas',
    async () => {
      const consultar = async (consulta) => {
        const res = await api.get(`/feriados/afectadas${consulta}`, como('admin'));
        assert.equal(res.status, 200, `${consulta}: ${JSON.stringify(res.body)}`);
        return res.body.data;
      };
      await vacacionesDeJulieta();
      // Una atención médica que lo incluye: esa sí se recalcula
      await insertarCarga('superadmin', 'medica', '2026-12-22', '2026-12-28');
      const { id, ...alta } = await cargar(asueto('2026-12-24'));
      assert.deepEqual(alta, { licencias_afectadas: 2, vacaciones_para_restituir: 1, plazo_de_restitucion: '2027-04-30' });

      // La misma fecha: solo la médica
      assert.deepEqual(await consultar(`?fecha=2026-12-24&id=${id}`),
        { licencias_afectadas: 1, vacaciones_para_restituir: 0, plazo_de_restitucion: null });
      // Sin el id, el guardado es otro feriado ese día, como siempre: no cambia nada
      assert.deepEqual((await consultar('?fecha=2026-12-24')).licencias_afectadas, 0);
      // «Se repite» prendido: también las vacaciones de 2027, que no tienen foto y quedan para restituir
      await conArranque('editor');
      await insertarCarga('editor', 'vacaciones', '2027-12-20', '2027-12-28');
      assert.deepEqual(await consultar(`?fecha=2026-12-24&se_repite=1&id=${id}`),
        { licencias_afectadas: 2, vacaciones_para_restituir: 1, plazo_de_restitucion: '2028-04-28' });
      // Otra fecha: las vacaciones de 2026 cuentan por esa fecha, que no tiene foto
      assert.deepEqual(await consultar(`?fecha=2026-12-23&id=${id}`),
        { licencias_afectadas: 2, vacaciones_para_restituir: 1, plazo_de_restitucion: '2027-04-30' });

      // La respuesta del PUT, igual: renombrarlo cuenta solo la médica; moverlo al 23/12, las vacaciones por esa fecha nueva
      // (su foto se acaba de sacar, pero esa fecha no la tenía)
      assert.deepEqual(await corregir(id, asueto('2026-12-24', { nombre: 'Asueto navideño' })),
        { licencias_afectadas: 1, vacaciones_para_restituir: 0, plazo_de_restitucion: null });
      assert.deepEqual(await corregir(id, asueto('2026-12-23')),
        { licencias_afectadas: 2, vacaciones_para_restituir: 1, plazo_de_restitucion: '2027-04-30' });
    });

  it('al corregirlo, «sin pedido» es lo mismo que para la regla: la de un pedido dado de baja o de un pedido A sin su carga se borra',
    async () => {
      const vacaciones = await vacacionesDeJulieta();
      const nuevoPedido = async (caso, cargaId, activo) => (await query(
        `INSERT INTO mi_espacio_restituciones (usuario_id, licencia_id, anio, caso, dias, primer_asueto, tanda, fecha, carga_id, activo)
         VALUES (?, ?, 2024, ?, 1, '2026-12-24', 0, '2027-01-11', ?, ?)`,
        [usuarios.admin.id, vacaciones, caso, cargaId, activo]
      )).insertId;
      // Sellada, con el id de un pedido dado de baja (soltarPedido lo habría dejado en NULL)
      const del24 = await cargar(asueto('2026-12-24'));
      const deBaja = await nuevoPedido('restituir', null, 0);
      await query('UPDATE mi_espacio_restituibles SET tanda = 0, restitucion_id = ? WHERE feriado_id = ?', [deBaja, del24.id]);
      // De un pedido A activo cuya carga de días restituidos está dada de baja (la regla lo cuenta como suelto)
      const del31 = await cargar(asueto('2026-12-31'));
      const sinCarga = await nuevoPedido('tomar', await insertarCarga('admin', 'restituidos', '2027-04-12', '2027-04-12', 0), 1);
      await query('UPDATE mi_espacio_restituibles SET tanda = 0, restitucion_id = ? WHERE feriado_id = ?', [sinCarga, del31.id]);

      await corregir(del24.id, asueto('2026-12-23'));
      await corregir(del31.id, asueto('2026-12-30'));
      assert.deepEqual(await laFoto(), [foto(vacaciones, del24.id, '2026-12-23'), foto(vacaciones, del31.id, '2026-12-30')]);
    });

  it('las cargas con foto son las de TIPOS_CON_FOTO, los mismos tipos que tienen días restituibles en la regla', async () => {
    assert.deepEqual([...TIPOS_CON_FOTO].sort(), [...TIPOS_CON_RESTITUIBLES].sort());
    await conArranque('admin');
    const ids = {};
    for (const tipo of TIPOS_LICENCIA) ids[tipo] = await insertarCarga('admin', tipo, '2026-12-21', '2026-12-28');
    const cargas = await miEspacioDatos.cargasParaLaFoto(pool, '2026-12-24', '2026-12-24');
    assert.deepEqual(cargas.map((carga) => carga.tipo).sort(), [...TIPOS_CON_FOTO].sort());
    assert.deepEqual(cargas, TIPOS_CON_FOTO.map((tipo) => ({
      id: ids[tipo], tipo, desde: '2026-12-21', hasta: '2026-12-28', arranque: '2026-11-02'
    })).sort((a, b) => a.id - b.id));
  });

  it('fotosParaElFeriado, con su atajo, da lo mismo que fotosDelFeriado con todas las cargas', async () => {
    const vacaciones = await vacacionesDeJulieta();
    await conArranque('editor');
    await insertarCarga('editor', 'vacaciones', '2027-12-20', '2027-12-28');
    await insertarCarga('superadmin', 'restituidos', '2026-12-21', '2026-12-24');
    await insertarCarga('superadmin', 'medica', '2026-12-28', '2026-12-31');
    await conArranque('lector', '2026-12-28');
    await insertarCarga('lector', 'vacaciones', '2026-12-21', '2026-12-31');
    const todas = await miEspacioDatos.cargasParaLaFoto(pool, '2000-01-01', '9999-12-31');
    const base = {
      id: 99, fecha: '2026-12-24', nombre: 'Asueto', tipo: 'no_laborable', trasladado_de: null, se_repite: 0, hasta_anio: null,
      activo: 1, no_rige: []
    };
    const repite = { ...base, se_repite: 1 };
    const otroEseDia = [{ ...base, id: 98, nombre: 'Otro' }];
    const casos = [
      ['un alta', base, null, []], ['un alta que se repite', repite, null, []], ['un sábado', { ...base, fecha: '2026-12-26' }, null, []],
      ['un fijo', { ...base, fecha: '2026-12-25' }, null, []], ['otro feriado ese día', base, null, otroEseDia],
      ['el renombre', { ...base, nombre: 'Otro nombre' }, base, []], ['el renombre del que se repite', { ...repite, nombre: 'x' }, repite, []],
      ['otra fecha', { ...base, fecha: '2026-12-23' }, base, []], ['de un sábado a un lunes', { ...base, fecha: '2026-12-28' },
        { ...base, fecha: '2026-12-26' }, []],
      ['«se repite» que se prende', repite, base, []], ['«se repite» que se apaga', base, repite, []],
      ['un año que vuelve a regir', repite, { ...repite, no_rige: [2026] }, []],
      ['un año que deja de regir', { ...repite, no_rige: [2026] }, repite, []],
      ['hasta_anio distinto', repite, { ...repite, hasta_anio: 2026 }, []]
    ];
    for (const [nombre, fila, antes, otras] of casos) {
      assert.deepEqual(await miEspacioDatos.fotosParaElFeriado(fila, { otras, antes }, pool),
        fotosDelFeriado(fila, todas, otras, { antes }), nombre);
    }
    // No da todo vacío: el alta saca la de las vacaciones y la de los días restituidos
    assert.deepEqual((await miEspacioDatos.fotosParaElFeriado(base, { otras: [] }, pool)).map((f) => f.licencia_id).sort(),
      [vacaciones, todas.find((carga) => carga.tipo === 'restituidos').id].sort((a, b) => a - b));
  });

  it('GET /feriados/afectadas: cuántas licencias, cuántas vacaciones con días para restituir y el plazo, sin nombres', async () => {
    const consultar = async (consulta) => {
      const res = await api.get(`/feriados/afectadas${consulta}`, como('admin'));
      assert.equal(res.status, 200, `${consulta}: ${JSON.stringify(res.body)}`);
      // Sin nombres: ni el nombre completo, ni el usuario, ni el email de nadie
      for (const [clave, usuario] of Object.entries(usuarios)) {
        for (const dato of [`Test ${clave}`, usuario.username, usuario.email]) {
          assert.ok(!JSON.stringify(res.body).includes(dato), `${consulta}: ${dato}`);
        }
      }
      return res.body.data;
    };
    await vacacionesDeJulieta();
    assert.deepEqual(await consultar('?fecha=2026-12-24'),
      { licencias_afectadas: 1, vacaciones_para_restituir: 1, plazo_de_restitucion: '2027-04-30' });
    // Dos licencias, una de vacaciones
    await insertarCarga('superadmin', 'medica', '2026-12-22', '2026-12-28');
    assert.deepEqual(await consultar('?fecha=2026-12-24'),
      { licencias_afectadas: 2, vacaciones_para_restituir: 1, plazo_de_restitucion: '2027-04-30' });
    // Otras vacaciones con arranque: dos
    await conArranque('editor');
    await insertarCarga('editor', 'vacaciones', '2026-12-21', '2026-12-30');
    assert.deepEqual(await consultar('?fecha=2026-12-24'),
      { licencias_afectadas: 3, vacaciones_para_restituir: 2, plazo_de_restitucion: '2027-04-30' });
    assert.deepEqual(await consultar('?fecha=2026-12-26'),
      { licencias_afectadas: 0, vacaciones_para_restituir: 0, plazo_de_restitucion: null });
    // Con un feriado de la tabla el último día hábil de abril, el plazo se corre al anterior
    await insertarFeriado({ fecha: '2027-04-30', nombre: 'Feriado de abril', tipo: 'provincial' });
    assert.equal((await consultar('?fecha=2026-12-24')).plazo_de_restitucion, '2027-04-29');
    // Con el id de uno guardado, las fechas que ya tenía no cuentan para restituir
    const { id } = await cargar(asueto('2026-12-24'));
    // (las dos vacaciones ya tienen su foto en esa fecha: conservan sus días y solo se recalcula la médica)
    assert.deepEqual(await consultar(`?fecha=2026-12-24&id=${id}`),
      { licencias_afectadas: 1, vacaciones_para_restituir: 0, plazo_de_restitucion: null });
    assert.deepEqual(await consultar(`?fecha=2026-12-23&id=${id}`),
      { licencias_afectadas: 3, vacaciones_para_restituir: 2, plazo_de_restitucion: '2027-04-29' });
  });
});

// Las escrituras de los pedidos (services/miEspacioRestituciones.js; el contrato con las Tasks 10 y 11 del plan): siempre en una
// transacción ajena. Con Julieta (inventada) y un saldo de 13 días de la 2024, 15 de la 2025 y 10 de la 2026: el asueto del
// 24/12/2026 cae en la 2024 (caso A, a tomar) y el del 31/12, en la 2025 (caso B, a restituir). «Hoy» es el lunes 11/01/2027
describe('GET /feriados/afectadas con la cuenta de restituir aislada', () => {
  beforeEach(async () => {
    await query('DELETE FROM mi_espacio_arranque');
  });

  // La tabla del arranque, renombrada mientras tanto en la base de prueba: la lee solo la cuenta de restituir (las cargas para la
  // foto), no la de las licencias
  it('si falla la de restituir, va null con su plazo y la de las licencias sigue; si falla la de las licencias, el 500 de siempre',
    async () => {
      await query("INSERT INTO mi_espacio_arranque (usuario_id, fecha) VALUES (?, '2026-11-02')", [usuarios.admin.id]);
      await query(
        "INSERT INTO mi_espacio_licencias (usuario_id, tipo, desde, hasta) VALUES (?, 'vacaciones', '2026-12-11', '2027-01-08')",
        [usuarios.admin.id]
      );
      await asegurarBaseDePrueba();
      await query('RENAME TABLE mi_espacio_arranque TO mi_espacio_arranque_fuera');
      try {
        const res = await api.get('/feriados/afectadas?fecha=2026-12-24', como('admin'));
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.deepEqual(res.body, {
          success: true, data: { licencias_afectadas: 1, vacaciones_para_restituir: null, plazo_de_restitucion: null }
        });
      } finally {
        await query('RENAME TABLE mi_espacio_arranque_fuera TO mi_espacio_arranque');
      }
      const bien = await api.get('/feriados/afectadas?fecha=2026-12-24', como('admin'));
      assert.deepEqual(bien.body.data, { licencias_afectadas: 1, vacaciones_para_restituir: 1, plazo_de_restitucion: '2027-04-30' });
    });
});

describe('registrarPedido y soltarPedido', () => {
  const HOY_DEL_PEDIDO = '2027-01-11';
  let vacaciones;
  // Los ids de los asuetos, por fecha
  let asuetos;

  beforeEach(async () => {
    for (const tabla of ['mi_espacio_arranque', 'mi_espacio_anios', 'mi_espacio_saldos']) await query(`DELETE FROM ${tabla}`);
    const id = usuarios.admin.id;
    await query("UPDATE usuarios SET vinculo = 'planta_permanente' WHERE id = ?", [id]);
    await query("INSERT INTO mi_espacio_arranque (usuario_id, fecha) VALUES (?, '2026-11-02')", [id]);
    await query('INSERT INTO mi_espacio_anios (usuario_id, anio, dias_vacaciones) VALUES (?, 2026, 20)', [id]);
    await query(
      `INSERT INTO mi_espacio_saldos (usuario_id, concepto, anio, cantidad)
       VALUES (?, 'vacaciones', 2024, 13), (?, 'vacaciones', 2025, 15), (?, 'vacaciones', 2026, 10)`,
      [id, id, id]
    );
    vacaciones = (await query(
      "INSERT INTO mi_espacio_licencias (usuario_id, tipo, desde, hasta) VALUES (?, 'vacaciones', '2026-12-11', '2027-01-08')", [id]
    )).insertId;
    asuetos = {};
    for (const fecha of ['2026-12-24', '2026-12-31']) {
      const res = await api.post('/feriados', { fecha, nombre: 'Asueto', tipo: 'no_laborable' }, como('admin'));
      assert.equal(res.status, 201, JSON.stringify(res.body));
      asuetos[fecha] = res.body.data.id;
    }
  });

  // Los grupos de Julieta como los arma la regla (calcular, en contextoDe), por clave
  const losGrupos = async () => {
    const { calculo } = await miEspacioDatos.contextoDe(usuarios.admin.id, HOY_DEL_PEDIDO);
    return calculo.restituciones;
  };
  const resumen = (grupos) => grupos.map(({ clave, caso, situacion, fechas, primer_asueto: primer, plazo }) =>
    ({ clave, caso, situacion, fechas, primer, plazo }));
  // Un grupo esperado: su clave (la carga, el año y la tanda), el caso, la situación, sus fechas, el primer asueto y el plazo
  const grupo = (anio, tanda, caso, situacion, fecha, primer, plazo) =>
    ({ clave: `${vacaciones}-${anio}-${tanda}`, caso, situacion, fechas: [fecha], primer, plazo });
  // Una carga de días restituidos de un día (la del caso A)
  const cargaDeRestituidos = async (dia) => (await query(
    "INSERT INTO mi_espacio_licencias (usuario_id, tipo, desde, hasta) VALUES (?, 'restituidos', ?, ?)",
    [usuarios.admin.id, dia, dia]
  )).insertId;
  // Una transacción, como la de quien llama: se confirma, o se deshace si `confirmar` es false o si el trabajo tira
  const enTransaccion = async (trabajo, { confirmar = true } = {}) => {
    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();
      const resultado = await trabajo(conexion);
      await (confirmar ? conexion.commit() : conexion.rollback());
      return resultado;
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  };
  const laFoto = async () => (await query(
    `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, tanda, restitucion_id FROM mi_espacio_restituibles
     WHERE licencia_id = ? ORDER BY fecha`, [vacaciones]
  )).map((fila) => [fila.fecha, fila.tanda === null ? null : Number(fila.tanda),
    fila.restitucion_id === null ? null : Number(fila.restitucion_id)]);
  // El pedido como quedó guardado (los enteros llegan como números)
  const pedidoGuardado = async (id) => ({ ...(await query(
    `SELECT usuario_id, licencia_id, anio, caso, dias, DATE_FORMAT(primer_asueto, '%Y-%m-%d') AS primer_asueto, tanda,
       DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, carga_id, activo
     FROM mi_espacio_restituciones WHERE id = ?`, [id]
  ))[0] });
  const pedir = (grupo, caso, cargaId = null) => enTransaccion((conexion) => restituciones.registrarPedido(conexion, {
    usuarioId: usuarios.admin.id, grupo, caso, cargaId, hoy: HOY_DEL_PEDIDO
  }));

  it('los dos grupos de la misma tanda, antes de pedir', async () => {
    assert.deepEqual(resumen(await losGrupos()), [
      grupo(2024, 0, 'tomar', 'por_restituir', '2026-12-24', '2026-12-24', '2027-04-30'),
      grupo(2025, 0, 'restituir', 'por_restituir', '2026-12-31', '2026-12-24', '2027-04-30')
    ]);
    assert.deepEqual(await laFoto(), [['2026-12-24', null, null], ['2026-12-31', null, null]]);
  });

  it('registrarPedido sella las filas abiertas, guarda el pedido y enlaza solo las del grupo; los plazos de la tanda no cambian',
    async () => {
      const [, de2025] = await losGrupos();
      const id = await pedir(de2025, 'restituir');
      assert.ok(Number.isInteger(id) && id > 0);
      assert.deepEqual(await pedidoGuardado(id), {
        usuario_id: usuarios.admin.id, licencia_id: vacaciones, anio: 2025, caso: 'restituir', dias: 1,
        primer_asueto: '2026-12-24', tanda: 0, fecha: HOY_DEL_PEDIDO, carga_id: null, activo: 1
      });
      // Las dos filas quedan en la tanda 0; solo la del 31/12 es del pedido
      assert.deepEqual(await laFoto(), [['2026-12-24', 0, null], ['2026-12-31', 0, id]]);
      assert.deepEqual(resumen(await losGrupos()), [
        grupo(2024, 0, 'tomar', 'por_restituir', '2026-12-24', '2026-12-24', '2027-04-30'),
        grupo(2025, 0, 'restituir', 'pedida', '2026-12-31', '2026-12-24', '2027-04-30')
      ]);
    });

  it('un asueto después de pedir arma una tanda nueva, con su plazo, y pedir el otro grupo de la tanda vieja no la mueve', async () => {
    const [, de2025] = await losGrupos();
    const pedidoB = await pedir(de2025, 'restituir');
    // El martes 05/01/2027 (de la 2025: la carga ya la venía usando)
    const res = await api.post('/feriados', { fecha: '2027-01-05', nombre: 'Asueto', tipo: 'no_laborable' }, como('admin'));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(await laFoto(), [['2026-12-24', 0, null], ['2026-12-31', 0, pedidoB], ['2027-01-05', null, null]]);
    const nuevo = (await losGrupos()).find(({ clave }) => clave === `${vacaciones}-2025-1`);
    assert.deepEqual(resumen([nuevo]), [
      grupo(2025, 1, 'restituir', 'por_restituir', '2027-01-05', '2027-01-05', '2027-05-31')
    ]);

    // El grupo de la 2024 (tanda 0), cargado como días restituidos: la fila abierta del 05/01 queda sellada en la tanda 1
    const de2024 = (await losGrupos()).find(({ clave }) => clave === `${vacaciones}-2024-0`);
    const carga = await cargaDeRestituidos('2027-04-12');
    const pedidoA = await pedir(de2024, 'tomar', carga);
    assert.deepEqual(await pedidoGuardado(pedidoA), {
      usuario_id: usuarios.admin.id, licencia_id: vacaciones, anio: 2024, caso: 'tomar', dias: 1,
      primer_asueto: '2026-12-24', tanda: 0, fecha: HOY_DEL_PEDIDO, carga_id: carga, activo: 1
    });
    assert.deepEqual(await laFoto(), [['2026-12-24', 0, pedidoA], ['2026-12-31', 0, pedidoB], ['2027-01-05', 1, null]]);
    assert.deepEqual(resumen(await losGrupos()), [
      grupo(2024, 0, 'tomar', 'cargada', '2026-12-24', '2026-12-24', '2027-04-30'),
      grupo(2025, 0, 'restituir', 'pedida', '2026-12-31', '2026-12-24', '2027-04-30'),
      grupo(2025, 1, 'restituir', 'por_restituir', '2027-01-05', '2027-01-05', '2027-05-31')
    ]);
  });

  it('soltarPedido lo da de baja y deja sus filas sin pedido, con su tanda: vuelven a estar por restituir con su plazo', async () => {
    const [de2024, de2025] = await losGrupos();
    const pedidoB = await pedir(de2025, 'restituir');
    const carga = await cargaDeRestituidos('2027-04-12');
    await pedir(de2024, 'tomar', carga);
    assert.equal(await enTransaccion((conexion) => restituciones.soltarPedido(conexion, pedidoB)), true);
    assert.equal((await pedidoGuardado(pedidoB)).activo, 0);
    assert.deepEqual((await laFoto())[1], ['2026-12-31', 0, null]);
    const otraVez = (await losGrupos()).find(({ clave }) => clave === `${vacaciones}-2025-0`);
    assert.deepEqual(resumen([otraVez]), [
      grupo(2025, 0, 'restituir', 'por_restituir', '2026-12-31', '2026-12-24', '2027-04-30')
    ]);
    // Soltarlo de nuevo no cambia nada
    assert.equal(await enTransaccion((conexion) => restituciones.soltarPedido(conexion, pedidoB)), false);
    assert.deepEqual((await laFoto())[1], ['2026-12-31', 0, null]);
  });

  it('enlaza solo las filas sin pedido: las de otro pedido vigente quedan; las de un pedido A cuya carga ya no está, se enlazan',
    async () => {
      const [de2024, de2025] = await losGrupos();
      const pedidoB = await pedir(de2025, 'restituir');
      // Un grupo armado a mano que pide también el 31/12, ya pedido: no lo toma, y como el pedido quedaría con menos días de los
      // que dice, tira y quien llama lo deshace (el 31/12 sigue siendo del pedido B y el 24/12, de ninguno)
      await assert.rejects(pedir({ ...de2024, dias: 2, fechas: ['2026-12-24', '2026-12-31'] }, 'restituir'),
        /no todos los días del grupo siguen sin pedido/);
      assert.deepEqual(await laFoto(), [['2026-12-24', 0, null], ['2026-12-31', 0, pedidoB]]);
      assert.equal((await query('SELECT id FROM mi_espacio_restituciones')).length, 1);

      // Un pedido A cuya carga se dio de baja sin soltarlo (como antes del arreglo de la anulación): su fila vuelve a estar por
      // restituir y un pedido nuevo la toma
      const carga = await cargaDeRestituidos('2027-04-12');
      const pedidoA = await pedir(de2024, 'tomar', carga);
      await query('UPDATE mi_espacio_licencias SET activo = 0 WHERE id = ?', [carga]);
      const suelto = (await losGrupos())
        .find(({ clave, situacion }) => clave === `${vacaciones}-2024-0` && situacion === 'por_restituir');
      assert.ok(suelto, 'el grupo de la 2024 vuelve a estar por restituir');
      const otraCarga = await cargaDeRestituidos('2027-04-19');
      const nuevo = await pedir(suelto, 'tomar', otraCarga);
      assert.notEqual(nuevo, pedidoA);
      assert.deepEqual(await laFoto(), [['2026-12-24', 0, nuevo], ['2026-12-31', 0, pedidoB]]);
    });

  // Decisión 12 de la spec: un asueto después de un pedido arma una tanda nueva, aunque la carga ya tenga una fila vieja de ese día
  it('un asueto nuevo sobre la fila sin pedido de un feriado dado de baja la toma y la abre: queda en la tanda nueva', async () => {
    const [, de2025] = await losGrupos();
    // El pedido de la 2025 sella también la fila del 24/12 (tanda 0, sin pedido)
    const pedidoB = await pedir(de2025, 'restituir');
    const baja = await api.delete(`/feriados/${asuetos['2026-12-24']}`, como('admin'));
    assert.equal(baja.status, 200, JSON.stringify(baja.body));
    assert.deepEqual(await laFoto(), [['2026-12-24', 0, null], ['2026-12-31', 0, pedidoB]]);

    const otro = await api.post('/feriados', { fecha: '2026-12-24', nombre: 'Otro asueto', tipo: 'no_laborable' }, como('admin'));
    assert.equal(otro.status, 201, JSON.stringify(otro.body));
    assert.deepEqual(await laFoto(), [['2026-12-24', null, null], ['2026-12-31', 0, pedidoB]]);
    const [fila] = await query("SELECT feriado_id FROM mi_espacio_restituibles WHERE licencia_id = ? AND fecha = '2026-12-24'",
      [vacaciones]);
    assert.equal(Number(fila.feriado_id), otro.body.data.id);
    const nuevo = (await losGrupos()).find(({ clave }) => clave.startsWith(`${vacaciones}-2024-`));
    assert.deepEqual(resumen([nuevo]), [grupo(2024, 1, 'tomar', 'por_restituir', '2026-12-24', '2026-12-24', '2027-04-30')]);

    // Una fila con pedido no la toma: el asueto nuevo del 31/12 la deja del pedido B y del feriado de antes
    await api.delete(`/feriados/${asuetos['2026-12-31']}`, como('admin'));
    const del31 = await api.post('/feriados', { fecha: '2026-12-31', nombre: 'Otro asueto', tipo: 'no_laborable' }, como('admin'));
    assert.equal(del31.status, 201, JSON.stringify(del31.body));
    const [pedida] = await query(
      "SELECT feriado_id, tanda, restitucion_id FROM mi_espacio_restituibles WHERE licencia_id = ? AND fecha = '2026-12-31'",
      [vacaciones]
    );
    assert.deepEqual([Number(pedida.feriado_id), Number(pedida.tanda), Number(pedida.restitucion_id)],
      [asuetos['2026-12-31'], 0, pedidoB]);
  });

  it('nunca abren ni cierran la transacción: si quien llama la deshace, no queda nada', async () => {
    const [, de2025] = await losGrupos();
    const antes = { foto: await laFoto(), pedidos: await query('SELECT id FROM mi_espacio_restituciones') };
    await enTransaccion((conexion) => restituciones.registrarPedido(conexion, {
      usuarioId: usuarios.admin.id, grupo: de2025, caso: 'restituir', cargaId: null, hoy: HOY_DEL_PEDIDO
    }), { confirmar: false });
    assert.deepEqual({ foto: await laFoto(), pedidos: await query('SELECT id FROM mi_espacio_restituciones') }, antes);

    const pedidoB = await pedir(de2025, 'restituir');
    await enTransaccion((conexion) => restituciones.soltarPedido(conexion, pedidoB), { confirmar: false });
    assert.equal((await pedidoGuardado(pedidoB)).activo, 1);
    assert.deepEqual((await laFoto())[1], ['2026-12-31', 0, pedidoB]);
  });

  it('un grupo que no sirve tira sin escribir; uno cuyos días ya tienen pedido tira, y quien llama lo deshace', async () => {
    const [, de2025] = await losGrupos();
    const pedidos = async () => (await query('SELECT id FROM mi_espacio_restituciones')).length;
    const carga = await cargaDeRestituidos('2027-04-12');
    for (const [grupoRaro, caso, cargaId, hoy] of [
      [null, 'restituir', null, HOY_DEL_PEDIDO], [{ ...de2025, fechas: [] }, 'restituir', null, HOY_DEL_PEDIDO],
      [{ ...de2025, licencia_id: '1' }, 'restituir', null, HOY_DEL_PEDIDO], [de2025, 'otro', null, HOY_DEL_PEDIDO],
      [de2025, 'restituir', null, null],
      // La carga: un entero positivo en 'tomar'; null en 'restituir'
      [de2025, 'tomar', null, HOY_DEL_PEDIDO], [de2025, 'tomar', 0, HOY_DEL_PEDIDO], [de2025, 'tomar', String(carga), HOY_DEL_PEDIDO],
      [de2025, 'tomar', 1.5, HOY_DEL_PEDIDO], [de2025, 'restituir', carga, HOY_DEL_PEDIDO]
    ]) {
      await assert.rejects(enTransaccion((conexion) => restituciones.registrarPedido(conexion, {
        usuarioId: usuarios.admin.id, grupo: grupoRaro, caso, cargaId, hoy
      })), TypeError, JSON.stringify([caso, cargaId, hoy]));
    }
    assert.equal(await pedidos(), 0);
    assert.deepEqual(await laFoto(), [['2026-12-24', null, null], ['2026-12-31', null, null]]);

    const pedidoB = await pedir(de2025, 'restituir');
    // El mismo grupo otra vez (sin volver a leerlo): sus días ya son del pedido B
    await assert.rejects(pedir(de2025, 'restituir'), /no todos los días del grupo siguen sin pedido/);
    assert.equal(await pedidos(), 1);
    assert.deepEqual(await laFoto(), [['2026-12-24', 0, null], ['2026-12-31', 0, pedidoB]]);
  });
});
