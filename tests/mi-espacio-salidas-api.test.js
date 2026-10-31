// Mi espacio: la planilla de horas extras de contrato (spec 2026-10-27-mi-espacio-horas, secciones 7 y 8), contra una base de
// prueba propia. GET /api/mi-espacio/salidas?mes= da un mes de la planilla y PUT /api/mi-espacio/salidas guarda sus días,
// todos o ninguno. Las rutas de horas extras de antes rechazan a contrato (cargan en la planilla) y la planilla rechaza a
// planta. La API usa la fecha real: las fechas de los tests se arman desde hoy, con la tabla `feriados` vacía (el beforeEach
// la vacía), así los días hábiles son los de lunes a viernes sin los 9 fijos. Las personas son inventadas y el vínculo se
// pone por SQL.
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query
} from './helpers.js';
import { asegurarBaseDePrueba } from './notas-fixtures.js';
import {
  hoyArgentina, sumarDias, esDiaHabil, diaHabilAnterior, proximoDiaHabil, primerDiaHabilDelMes, FERIADOS_FIJOS
} from '../services/notasDigitalesCalendario.js';
import { MENSAJES_MI_ESPACIO, MAXIMO_DIAS_POR_GUARDADO, mesMas, nombreDelMes } from '../services/miEspacioReglas.js';

let base, servidor, api, usuarios, dbReal, pool, controlador;
const hoy = hoyArgentina();
const ANIO = Number(hoy.slice(0, 4));
const MES = hoy.slice(0, 7);
const dia = (n) => sumarDias(hoy, n);
// El último día hábil hasta hoy (hoy, si es hábil) y el hábil anterior: días que ya llegaron, sin feriados de la tabla
const HABIL = esDiaHabil(hoy) ? hoy : diaHabilAnterior(hoy);
const HABIL_ANTES = diaHabilAnterior(HABIL);
const MES_HABIL = HABIL.slice(0, 7);
// El mes anterior y sus tres primeros días hábiles (todos ya pasaron): sus horas son las horas a favor de este mes
const MES_ANTERIOR = mesMas(MES, -1);
const HABILES_DEL_MES_ANTERIOR = (() => {
  const habiles = [primerDiaHabilDelMes(MES_ANTERIOR)];
  while (habiles.length < 3) habiles.push(proximoDiaHabil(sumarDias(habiles.at(-1), 1)));
  return habiles;
})();
// El último sábado hasta hoy que no es uno de los 9 feriados fijos (sería un feriado, no un sábado)
const SABADO = (() => {
  let fecha = hoy;
  while (new Date(`${fecha}T12:00:00Z`).getUTCDay() !== 6 || FERIADOS_FIJOS.includes(fecha.slice(5))) {
    fecha = sumarDias(fecha, -1);
  }
  return fecha;
})();

// Las personas (inventadas): el rol, el nombre y el vínculo, puesto por SQL. El lector no tiene vínculo
const PERSONAS = Object.freeze({
  editor: ['editor', 'Carla Benítez', 'contrato'],
  colab: ['colaborador', 'Persona de Prueba', 'contrato'],
  adminA: ['admin', 'Laura Gómez', 'planta_permanente'],
  lector: ['lector', 'Sofía Paz', null]
});

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_mi_espacio_salidas');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, Object.fromEntries(Object.entries(PERSONAS).map(([clave, [rol]]) => [clave, rol])));
  for (const [clave, [, nombre, vinculo]] of Object.entries(PERSONAS)) {
    await query('UPDATE usuarios SET nombre_completo = ?, vinculo = ? WHERE id = ?', [nombre, vinculo, usuarios[clave].id]);
  }
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba (los 500 se prueban llamando al controlador)
  controlador = await import('../controllers/miEspacioController.js');
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
  for (const tabla of [
    'mi_espacio_licencias', 'mi_espacio_horas_extras', 'mi_espacio_salidas', 'mi_espacio_saldos', 'mi_espacio_anios',
    'mi_espacio_arranque', 'mi_espacio_avisos', 'usuarios_licencias', 'feriados'
  ]) {
    await query(`DELETE FROM ${tabla}`);
  }
});

const como = (clave) => ({ token: usuarios[clave].token });

// Lo cargado por SQL
const conArranque = (clave, fecha) =>
  query('INSERT INTO mi_espacio_arranque (usuario_id, fecha) VALUES (?, ?)', [usuarios[clave].id, fecha]);
const conAnio = (clave, anio, dias) => query(
  'INSERT INTO mi_espacio_anios (usuario_id, anio, dias_vacaciones, estudios) VALUES (?, ?, ?, NULL)',
  [usuarios[clave].id, anio, dias]
);
// Con el saldo inicial cargado (el arranque, hoy, y los días de su año): lo que piden las cargas
const listoParaCargar = async (clave) => {
  await conArranque(clave, hoy);
  await conAnio(clave, ANIO, 20);
};
const conLicencia = async (clave, { tipo, desde, hasta = desde, horas = null }) => (await query(
  'INSERT INTO mi_espacio_licencias (usuario_id, tipo, desde, hasta, horas) VALUES (?, ?, ?, ?, ?)',
  [usuarios[clave].id, tipo, desde, hasta, horas]
)).insertId;
const conHorasExtras = async (clave, { fecha, desde, hasta }) => (await query(
  'INSERT INTO mi_espacio_horas_extras (usuario_id, fecha, desde, hasta) VALUES (?, ?, ?, ?)',
  [usuarios[clave].id, fecha, desde, hasta]
)).insertId;
const conSalida = async (clave, { fecha, entrada = null, salida }) => (await query(
  'INSERT INTO mi_espacio_salidas (usuario_id, fecha, entrada, salida) VALUES (?, ?, ?, ?)',
  [usuarios[clave].id, fecha, entrada, salida]
)).insertId;
const conFeriado = ({ fecha, nombre }) =>
  query("INSERT INTO feriados (fecha, nombre, tipo, se_repite) VALUES (?, ?, 'nacional', 0)", [fecha, nombre]);

// Las salidas de una persona como quedaron en la base, también las dadas de baja (los TIME, cortados a 'HH:MM')
const salidasGuardadasDe = async (clave) => (await query(
  `SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, TIME_FORMAT(entrada, '%H:%i') AS entrada,
     TIME_FORMAT(salida, '%H:%i') AS salida, nota, activo
   FROM mi_espacio_salidas WHERE usuario_id = ? ORDER BY fecha, id`,
  [usuarios[clave].id]
)).map(fila => ({ ...fila, activo: Number(fila.activo) }));
const horasGuardadasDe = async (clave) => (await query(
  'SELECT id, activo FROM mi_espacio_horas_extras WHERE usuario_id = ? ORDER BY id', [usuarios[clave].id]
)).map(fila => ({ ...fila, activo: Number(fila.activo) }));

const guardar = (clave, dias) => api.put('/mi-espacio/salidas', { dias }, como(clave));
const planilla = (clave, mes) => api.get(`/mi-espacio/salidas${mes === undefined ? '' : `?mes=${mes}`}`, como(clave));
// Un día de la planilla de un mes
const diaDeLaPlanilla = async (clave, fecha) => {
  const res = await planilla(clave, fecha.slice(0, 7));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data.dias.find(otro => otro.fecha === fecha);
};

const rechazo = (error, campo) => ({ success: false, error, campo });
// El 400 de los días de un guardado: el primero por fecha arriba, y todos en `errores`
const rechazoDeLosDias = (errores) => ({
  success: false, error: errores[0].mensaje, campo: errores[0].campo, fecha: errores[0].fecha, errores
});
const guardado = (cantidad) => ({
  success: true, data: { guardados: cantidad }, message: `Horas extras guardadas: ${cantidad} ${cantidad === 1 ? 'día' : 'días'}.`
});

describe('sin sesión', () => {
  it('GET y PUT /mi-espacio/salidas dan 401', async () => {
    const lectura = await api.get('/mi-espacio/salidas');
    assert.equal(lectura.status, 401);
    const escritura = await api.put('/mi-espacio/salidas', { dias: [{ fecha: HABIL, salida: '16:46' }] });
    assert.equal(escritura.status, 401);
    assert.deepEqual(await query('SELECT id FROM mi_espacio_salidas'), []);
  });
});

describe('GET /mi-espacio/salidas', () => {
  it('a contrato (el editor y el colaborador): la planilla del mes, sin mes la de hoy, con lo cargado y sus horas', async () => {
    for (const clave of ['editor', 'colab']) {
      const res = await planilla(clave);
      assert.equal(res.status, 200, `${clave} ${JSON.stringify(res.body)}`);
      assert.equal(res.body.success, true);
      assert.deepEqual(Object.keys(res.body.data).sort(),
        ['anterior', 'dias', 'entran', 'fines_de_semana', 'hoy', 'mes', 'mes_texto', 'modalidad', 'siguiente', 'suma', 'sumar_a']);
      assert.equal(res.body.data.modalidad, 'contrato');
      assert.equal(res.body.data.mes, MES);
      assert.equal(res.body.data.hoy, hoy);
      assert.equal(res.body.data.siguiente, null);
      // Hoy, con su marca: entre los días o, un sábado o un domingo sin nada, entre los que se pueden sumar
      const marcados = [...res.body.data.dias, ...res.body.data.fines_de_semana].filter(otro => otro.hoy);
      assert.deepEqual(marcados.map(otro => otro.fecha), [hoy]);
    }

    // Con una salida guardada (sin arranque: leer no lo pide)
    await conSalida('editor', { fecha: HABIL, entrada: '08:02:00', salida: '16:46:00' });
    const res = await planilla('editor', MES_HABIL);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.mes, MES_HABIL);
    const delDia = res.body.data.dias.find(otro => otro.fecha === HABIL);
    assert.deepEqual([delDia.tipo, delDia.entrada, delDia.salida, delDia.horas, delDia.horas_texto, delDia.aviso],
      ['habil', '08:02', '16:46', 2, '2 h', null]);
    assert.equal(res.body.data.suma.horas, 2);
    // La del colaborador no la ve
    const delColab = await planilla('colab', MES_HABIL);
    assert.equal(delColab.body.data.dias.find(otro => otro.fecha === HABIL).salida, null);
  });

  it('con los feriados de la tabla: un feriado cargado después deja la salida sin entrada con su aviso y sin horas',
    async () => {
      await conSalida('editor', { fecha: HABIL, salida: '16:46:00' });
      await conFeriado({ fecha: HABIL, nombre: 'Feriado de prueba' });
      const delDia = await diaDeLaPlanilla('editor', HABIL);
      assert.deepEqual([delDia.tipo, delDia.feriado, delDia.salida, delDia.horas, delDia.aviso],
        ['feriado', 'Feriado de prueba', '16:46', null, 'Ahora es feriado: falta la entrada.']);
    });

  it('a planta: 400 con campo null; sin vínculo: 200 con modalidad null y el mensaje', async () => {
    const dePlanta = await planilla('adminA');
    assert.equal(dePlanta.status, 400);
    assert.deepEqual(dePlanta.body, rechazo(MENSAJES_MI_ESPACIO.planillaSoloContrato, null));
    const sinVinculo = await planilla('lector');
    assert.equal(sinVinculo.status, 200, JSON.stringify(sinVinculo.body));
    assert.deepEqual(sinVinculo.body,
      { success: true, data: { modalidad: null, mensaje: MENSAJES_MI_ESPACIO.sinModalidad } });
  });

  it('un mes raro da 400 en mes antes de leer nada (también sin vínculo); los bordes del rango y el vacío sirven',
    async () => {
      assert.equal(MENSAJES_MI_ESPACIO.mes, 'Elegí un mes válido.');
      const raros = [
        `${ANIO}-13`, `${ANIO}-1`, `${MES}-01`, 'a&mes=b', `${MES}&mes=${MES}`, mesMas(MES, 1), `${ANIO - 3}-${MES.slice(5)}`,
        `${ANIO - 3}-12`, 'abc', `${MES}%20`, `%20${MES}`
      ];
      for (const mes of raros) {
        for (const clave of ['editor', 'lector', 'adminA']) {
          const res = await planilla(clave, mes);
          assert.equal(res.status, 400, `${clave} ${mes} ${JSON.stringify(res.body)}`);
          assert.deepEqual(res.body, rechazo(MENSAJES_MI_ESPACIO.mes, 'mes'), `${clave} ${mes}`);
        }
      }
      // Un objeto (mes[a]=…, como lo arma el lector de la consulta de Express)
      const objeto = await api.get(`/mi-espacio/salidas?mes[a]=${MES}`, como('editor'));
      assert.equal(objeto.status, 400, JSON.stringify(objeto.body));
      assert.deepEqual(objeto.body, rechazo(MENSAJES_MI_ESPACIO.mes, 'mes'));
      const primero = await planilla('editor', `${ANIO - 2}-01`);
      assert.equal(primero.status, 200, JSON.stringify(primero.body));
      assert.deepEqual([primero.body.data.mes, primero.body.data.anterior], [`${ANIO - 2}-01`, null]);
      const vacio = await planilla('editor', '');
      assert.equal(vacio.status, 200, JSON.stringify(vacio.body));
      assert.equal(vacio.body.data.mes, MES);
    });

  it('un error inesperado al leer: 500 con su mensaje, y en la consola solo la pila', async () => {
    const log = mock.method(console, 'error', () => {});
    const falla = mock.method(pool, 'query', async () => { throw new Error('Falla simulada'); });
    const respuesta = { status(codigo) { this.codigo = codigo; return this; }, json(cuerpo) { this.cuerpo = cuerpo; } };
    try {
      await controlador.verPlanilla({ user: { userId: usuarios.editor.id }, query: {} }, respuesta);
    } finally {
      falla.mock.restore();
      log.mock.restore();
    }
    assert.equal(respuesta.codigo, 500);
    assert.deepEqual(respuesta.cuerpo, { success: false, error: 'Error al obtener la planilla' });
    assert.equal(log.mock.callCount(), 1);
    const [mensaje, detalle] = log.mock.calls[0].arguments;
    assert.equal(mensaje, 'Error al obtener la planilla:');
    assert.match(detalle, /Falla simulada/);
  });
});

describe('PUT /mi-espacio/salidas', () => {
  it('alta: 200 con lo guardado, la fila en la base y el GET con sus horas', async () => {
    await listoParaCargar('editor');
    const res = await guardar('editor', [{ fecha: HABIL, entrada: '08:02', salida: '16:46', nota: '  Cierre de mes  ' }]);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, guardado(1));
    const [fila] = await salidasGuardadasDe('editor');
    assert.deepEqual(fila, { id: fila.id, fecha: HABIL, entrada: '08:02', salida: '16:46', nota: 'Cierre de mes', activo: 1 });

    const delDia = await diaDeLaPlanilla('editor', HABIL);
    assert.deepEqual([delDia.entrada, delDia.salida, delDia.nota, delDia.horas, delDia.horas_texto],
      ['08:02', '16:46', 'Cierre de mes', 2, '2 h']);
  });

  it('corregir, borrar (baja lógica) y volver a cargar un día: siempre la misma fila', async () => {
    await listoParaCargar('editor');
    assert.equal((await guardar('editor', [{ fecha: HABIL, entrada: '08:02', salida: '16:46', nota: 'Cierre' }])).status,
      200);
    const [{ id }] = await salidasGuardadasDe('editor');

    // Corregir: el día entero, con la entrada y la nota vacías
    const corregido = await guardar('editor', [{ fecha: HABIL, entrada: null, salida: '17:16', nota: '' }]);
    assert.equal(corregido.status, 200, JSON.stringify(corregido.body));
    assert.deepEqual(await salidasGuardadasDe('editor'),
      [{ id, fecha: HABIL, entrada: null, salida: '17:16', nota: null, activo: 1 }]);
    assert.equal((await diaDeLaPlanilla('editor', HABIL)).horas, 2.5);

    // Borrar: todo vacío es un borrado
    const borrado = await guardar('editor', [{ fecha: HABIL, entrada: '', salida: '', nota: '  ' }]);
    assert.equal(borrado.status, 200, JSON.stringify(borrado.body));
    assert.deepEqual(borrado.body, guardado(1));
    assert.deepEqual((await salidasGuardadasDe('editor')).map(fila => [fila.id, fila.activo]), [[id, 0]]);
    const vacio = await diaDeLaPlanilla('editor', HABIL);
    assert.deepEqual([vacio.salida, vacio.horas], [null, null]);

    // Volver a cargarlo: la misma fila, otra vez activa
    const otraVez = await guardar('editor', [{ fecha: HABIL, salida: '16:00' }]);
    assert.equal(otraVez.status, 200, JSON.stringify(otraVez.body));
    assert.deepEqual(await salidasGuardadasDe('editor'),
      [{ id, fecha: HABIL, entrada: null, salida: '16:00', nota: null, activo: 1 }]);

    // Borrar un día sin nada guardado no crea nada, y cuenta como guardado
    const sinNada = await guardar('editor', [{ fecha: HABIL_ANTES }]);
    assert.deepEqual(sinNada.body, guardado(1));
    assert.deepEqual((await salidasGuardadasDe('editor')).map(fila => fila.fecha), [HABIL]);
  });

  it('varios días juntos, de dos meses, con un sábado (de la entrada a la salida)', async () => {
    await listoParaCargar('editor');
    const dias = [
      { fecha: HABILES_DEL_MES_ANTERIOR[0], salida: '19:00' },
      { fecha: HABIL, salida: '16:46' },
      { fecha: SABADO, entrada: '09:00', salida: '13:20', nota: 'Inventario' }
    ];
    const res = await guardar('editor', dias);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, guardado(3));
    assert.deepEqual((await salidasGuardadasDe('editor')).map(fila => fila.fecha).sort(), dias.map(otro => otro.fecha).sort());
    const sabado = await diaDeLaPlanilla('editor', SABADO);
    assert.deepEqual([sabado.entrada, sabado.salida, sabado.horas, sabado.nota], ['09:00', '13:20', 4.5, 'Inventario']);
    assert.equal((await diaDeLaPlanilla('editor', HABILES_DEL_MES_ANTERIOR[0])).horas, 4);
  });

  it('todo o nada: con un día que falla no se guarda ninguno, y los errores van por fecha con el primero arriba',
    async () => {
      await listoParaCargar('editor');
      const uno = await guardar('editor', [{ fecha: HABIL, salida: '16:46' }, { fecha: dia(1), salida: '16:00' }]);
      assert.equal(uno.status, 400);
      assert.deepEqual(uno.body,
        rechazoDeLosDias([{ fecha: dia(1), campo: 'fecha', mensaje: MENSAJES_MI_ESPACIO.diaQueNoLlego }]));
      assert.deepEqual(await salidasGuardadasDe('editor'), []);

      // Dos con error, mandados al revés: el de antes va arriba; el que está bien tampoco se guarda
      const dos = await guardar('editor', [
        { fecha: dia(1), salida: '16:00' }, { fecha: HABIL, salida: '16:46:00' }, { fecha: HABIL_ANTES, salida: '17:00' }
      ]);
      assert.equal(dos.status, 400);
      assert.deepEqual(dos.body, rechazoDeLosDias([
        { fecha: HABIL, campo: 'salida', mensaje: MENSAJES_MI_ESPACIO.horaSalida },
        { fecha: dia(1), campo: 'fecha', mensaje: MENSAJES_MI_ESPACIO.diaQueNoLlego }
      ]));
      assert.deepEqual(await salidasGuardadasDe('editor'), []);
    });

  it('los frenos van primero, con campo null: sin vínculo, sin arranque y planta', async () => {
    const dias = [{ fecha: HABIL, salida: '16:46' }];
    const sinVinculo = await guardar('lector', dias);
    assert.equal(sinVinculo.status, 400);
    assert.deepEqual(sinVinculo.body, rechazo(MENSAJES_MI_ESPACIO.sinModalidad, null));
    // Sin arranque, antes que la lista (vacía) y antes que planta
    for (const [clave, cuerpo] of [['editor', dias], ['editor', []], ['adminA', dias]]) {
      const res = await guardar(clave, cuerpo);
      assert.equal(res.status, 400, clave);
      assert.deepEqual(res.body, rechazo(MENSAJES_MI_ESPACIO.sinArranque, null), clave);
    }
    await listoParaCargar('adminA');
    for (const cuerpo of [dias, []]) {
      const dePlanta = await guardar('adminA', cuerpo);
      assert.equal(dePlanta.status, 400);
      assert.deepEqual(dePlanta.body, rechazo(MENSAJES_MI_ESPACIO.planillaSoloContrato, null));
    }
    assert.deepEqual(await query('SELECT id FROM mi_espacio_salidas'), []);
  });

  it('la lista: vacía, que no es una lista o de más de 100 días da 400 en dias; de 100, se guarda', async () => {
    await listoParaCargar('editor');
    for (const cuerpo of [{}, { dias: [] }, { dias: 'x' }, { dias: { fecha: HABIL, salida: '16:46' } }, { dias: null }]) {
      const res = await api.put('/mi-espacio/salidas', cuerpo, como('editor'));
      assert.equal(res.status, 400, JSON.stringify(cuerpo));
      assert.deepEqual(res.body, rechazo(MENSAJES_MI_ESPACIO.sinDias, 'dias'), JSON.stringify(cuerpo));
    }
    assert.equal(MAXIMO_DIAS_POR_GUARDADO, 100);
    // 100 borrados, de 100 días seguidos que ya pasaron: se guardan (no crean nada); 101, no
    const cien = Array.from({ length: 100 }, (_, n) => ({ fecha: dia(-1 - n) }));
    const deCien = await guardar('editor', cien);
    assert.equal(deCien.status, 200, JSON.stringify(deCien.body));
    assert.deepEqual(deCien.body, guardado(100));
    const deCientoUno = await guardar('editor', [...cien, { fecha: dia(-101), salida: '16:46' }]);
    assert.equal(deCientoUno.status, 400);
    assert.deepEqual(deCientoUno.body, rechazo(MENSAJES_MI_ESPACIO.muchosDias, 'dias'));
    assert.deepEqual(await salidasGuardadasDe('editor'), []);
  });

  it('un día repetido da 400 con su fecha, antes que validar los días', async () => {
    await listoParaCargar('editor');
    const res = await guardar('editor', [
      { fecha: HABIL, salida: '16:46' }, { fecha: HABIL_ANTES, salida: '25:00' }, { fecha: HABIL, salida: '17:00' },
      { fecha: HABIL_ANTES }
    ]);
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, rechazoDeLosDias([
      { fecha: HABIL_ANTES, campo: 'fecha', mensaje: MENSAJES_MI_ESPACIO.diaRepetido },
      { fecha: HABIL, campo: 'fecha', mensaje: MENSAJES_MI_ESPACIO.diaRepetido }
    ]));
    assert.deepEqual(await salidasGuardadasDe('editor'), []);
  });

  it('cada 400 de un día, con su fecha y su campo, y nada guardado', async () => {
    await listoParaCargar('editor');
    const licencia = HABIL_ANTES;
    await conLicencia('editor', { tipo: 'estudios', desde: licencia });
    const unError = (fecha, campo, mensaje) => rechazoDeLosDias([{ fecha, campo, mensaje }]);
    const casos = [
      [{ fecha: dia(1), salida: '16:00' }, unError(dia(1), 'fecha', MENSAJES_MI_ESPACIO.diaQueNoLlego)],
      [{ fecha: licencia, salida: '16:46' }, unError(licencia, 'fecha', MENSAJES_MI_ESPACIO.diaDeLicencia)],
      [{ fecha: HABIL, salida: '16:46:00' }, unError(HABIL, 'salida', MENSAJES_MI_ESPACIO.horaSalida)],
      [{ fecha: HABIL, salida: '25:00' }, unError(HABIL, 'salida', MENSAJES_MI_ESPACIO.horaSalida)],
      [{ fecha: HABIL, entrada: '9:05', salida: '16:46' }, unError(HABIL, 'entrada', MENSAJES_MI_ESPACIO.horaSalida)],
      [{ fecha: HABIL, entrada: '08:00' }, unError(HABIL, 'salida', MENSAJES_MI_ESPACIO.salidaQueCuenta)],
      [{ fecha: HABIL, entrada: '17:00', salida: '16:46' }, unError(HABIL, 'salida', MENSAJES_MI_ESPACIO.salidaAntes)],
      [{ fecha: SABADO, salida: '13:00' }, unError(SABADO, 'entrada', MENSAJES_MI_ESPACIO.entradaFinde)],
      [{ fecha: HABIL, salida: '16:46', nota: 'x'.repeat(201) }, unError(HABIL, 'nota', MENSAJES_MI_ESPACIO.nota)],
      // Una fecha que no es una fecha (o un día que no es un objeto): sin fecha en la respuesta
      [{ fecha: `${ANIO}-02-30`, salida: '16:46' }, unError(null, 'fecha', MENSAJES_MI_ESPACIO.fecha)],
      [null, unError(null, 'fecha', MENSAJES_MI_ESPACIO.fecha)]
    ];
    assert.equal(MENSAJES_MI_ESPACIO.horaSalida, 'Escribí la hora como 16:45.');
    for (const [diaDelPedido, esperado] of casos) {
      const res = await guardar('editor', [diaDelPedido]);
      assert.equal(res.status, 400, JSON.stringify(diaDelPedido));
      assert.deepEqual(res.body, esperado, JSON.stringify(diaDelPedido));
    }
    assert.deepEqual(await salidasGuardadasDe('editor'), []);

    // El día de la licencia se puede vaciar (un borrado pasa siempre), y también uno que no llegó
    const borrado = await guardar('editor', [{ fecha: licencia, salida: '' }, { fecha: dia(1) }]);
    assert.equal(borrado.status, 200, JSON.stringify(borrado.body));
  });

  it('un feriado cargado en la tabla pide la entrada; con ella, cuenta de la entrada a la salida', async () => {
    await listoParaCargar('editor');
    await conFeriado({ fecha: HABIL, nombre: 'Feriado de prueba' });
    const sinEntrada = await guardar('editor', [{ fecha: HABIL, salida: '16:00' }]);
    assert.equal(sinEntrada.status, 400);
    assert.deepEqual(sinEntrada.body,
      rechazoDeLosDias([{ fecha: HABIL, campo: 'entrada', mensaje: MENSAJES_MI_ESPACIO.entradaFeriado }]));
    assert.deepEqual(await salidasGuardadasDe('editor'), []);

    const conEntrada = await guardar('editor', [{ fecha: HABIL, entrada: '09:00', salida: '16:00' }]);
    assert.equal(conEntrada.status, 200, JSON.stringify(conEntrada.body));
    const delDia = await diaDeLaPlanilla('editor', HABIL);
    assert.deepEqual([delDia.tipo, delDia.feriado, delDia.horas], ['feriado', 'Feriado de prueba', 7]);
  });

  it('el doble envío: dos PUT a la vez del mismo día dejan una sola fila, sin 500', async () => {
    await listoParaCargar('editor');
    const salidas = ['16:46', '17:16'];
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      await query('DELETE FROM mi_espacio_salidas');
      const respuestas = await Promise.all(salidas.map(salida => guardar('editor', [{ fecha: HABIL, salida }])));
      assert.deepEqual(respuestas.map(res => res.status), [200, 200], JSON.stringify(respuestas.map(res => res.body)));
      const guardadas = await salidasGuardadasDe('editor');
      assert.equal(guardadas.length, 1, `vuelta ${vuelta}`);
      assert.equal(guardadas[0].activo, 1);
      assert.ok(salidas.includes(guardadas[0].salida), guardadas[0].salida);
    }
  });

  it('un error inesperado al guardar: 500 con su mensaje, nada guardado, y en la consola solo la pila (ni la nota)',
    async () => {
      await listoParaCargar('editor');
      await query('DROP TRIGGER IF EXISTS falla_simulada_salidas');
      // Falla el segundo día: el primero tampoco queda
      await query(`CREATE TRIGGER falla_simulada_salidas BEFORE INSERT ON mi_espacio_salidas FOR EACH ROW
        BEGIN IF NEW.fecha = '${HABIL}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falla simulada'; END IF; END`);
      const log = mock.method(console, 'error', () => {});
      const respuesta = { status(codigo) { this.codigo = codigo; return this; }, json(cuerpo) { this.cuerpo = cuerpo; } };
      try {
        const pedido = {
          user: { userId: usuarios.editor.id },
          body: { dias: [{ fecha: HABIL_ANTES, salida: '17:00' }, { fecha: HABIL, salida: '16:46', nota: 'Turno con el dentista' }] }
        };
        await controlador.guardarSalidas(pedido, respuesta);
      } finally {
        log.mock.restore();
        await query('DROP TRIGGER IF EXISTS falla_simulada_salidas');
      }
      assert.equal(respuesta.codigo, 500);
      assert.deepEqual(respuesta.cuerpo, { success: false, error: 'Error al guardar las horas extras' });
      assert.equal(log.mock.callCount(), 1);
      const [mensaje, detalle] = log.mock.calls[0].arguments;
      assert.equal(mensaje, 'Error al guardar las horas extras:');
      assert.match(detalle, /Falla simulada/);
      assert.ok(!/dentista|INSERT/i.test(detalle), detalle);
      assert.deepEqual(await salidasGuardadasDe('editor'), []);
    });
});

describe('las horas a favor salen de las salidas', () => {
  it('el Resumen, la pestaña Horas extras y el cálculo de «Cargar licencia» del mes siguiente las usan', async () => {
    await listoParaCargar('editor');
    // Sin salidas, no hay horas a favor para usar este mes
    const diaDeUso = primerDiaHabilDelMes(MES);
    const calculo = () => api.post('/mi-espacio/licencias/calculo',
      { tipo: 'horas_a_favor', desde: diaDeUso, hasta: diaDeUso, horas: 2 }, como('editor'));
    const antes = await calculo();
    assert.equal(antes.status, 200, JSON.stringify(antes.body));
    assert.notEqual(antes.body.data.error, null);

    // 4 + 4 + 2,5 horas el mes anterior: 10,5 horas a favor en este
    const [primero, segundo, tercero] = HABILES_DEL_MES_ANTERIOR;
    const res = await guardar('editor',
      [{ fecha: primero, salida: '19:00' }, { fecha: segundo, salida: '19:00' }, { fecha: tercero, salida: '17:16' }]);
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const resumen = await api.get('/mi-espacio/resumen', como('editor'));
    assert.equal(resumen.status, 200, JSON.stringify(resumen.body));
    const tanque = resumen.body.data.tanques.otros.find(otro => otro.clave === 'horas_a_favor');
    assert.deepEqual([tanque.valor, tanque.total], [10.5, 10.5]);

    const tabla = await api.get(`/mi-espacio/horas-extras?anio=${MES_ANTERIOR.slice(0, 4)}`, como('editor'));
    assert.equal(tabla.status, 200, JSON.stringify(tabla.body));
    const mes = tabla.body.data.meses.find(otro => otro.mes === MES_ANTERIOR);
    assert.deepEqual([mes.horas_texto, mes.a_favor_detalle], ['10,5 h', '1 día de franco y 3,5 horas']);
    assert.deepEqual(tabla.body.data.dias_por_mes[MES_ANTERIOR].map(otro => [otro.fecha, otro.horario, otro.horas]),
      [[tercero, 'Salida 17:16', 2.5], [segundo, 'Salida 19:00', 4], [primero, 'Salida 19:00', 4]]);

    const despues = await calculo();
    assert.equal(despues.status, 200, JSON.stringify(despues.body));
    assert.equal(despues.body.data.error, null, JSON.stringify(despues.body.data));
    assert.match(despues.body.data.vista.queda_texto, /Te quedan 8,5\.$/);
  });
});

describe('las rutas de horas extras de antes, a contrato', () => {
  it('POST y PUT dan 400 (después del 404 de la corrección y de los frenos); DELETE de una fila vieja, 200', async () => {
    const cuerpo = { fecha: HABIL, desde: '16:00', hasta: '18:00' };
    // Sin arranque, el freno de siempre
    const sinArranque = await api.post('/mi-espacio/horas-extras', cuerpo, como('editor'));
    assert.equal(sinArranque.status, 400);
    assert.deepEqual(sinArranque.body, rechazo(MENSAJES_MI_ESPACIO.sinArranque, null));
    const vieja = await conHorasExtras('editor', { fecha: HABIL, desde: '16:00:00', hasta: '18:00:00' });
    const corregirSinArranque = await api.put(`/mi-espacio/horas-extras/${vieja}`, cuerpo, como('editor'));
    assert.deepEqual(corregirSinArranque.body, rechazo(MENSAJES_MI_ESPACIO.sinArranque, null));

    await listoParaCargar('editor');
    const cargar = await api.post('/mi-espacio/horas-extras', cuerpo, como('editor'));
    assert.equal(cargar.status, 400);
    assert.deepEqual(cargar.body, rechazo(MENSAJES_MI_ESPACIO.contratoEnLaPlanilla, null));
    const corregir = await api.put(`/mi-espacio/horas-extras/${vieja}`, cuerpo, como('editor'));
    assert.equal(corregir.status, 400);
    assert.deepEqual(corregir.body, rechazo(MENSAJES_MI_ESPACIO.contratoEnLaPlanilla, null));
    // Lo ajeno, antes: 404
    await listoParaCargar('adminA');
    const ajena = await conHorasExtras('adminA', { fecha: HABIL, desde: '16:00:00', hasta: '18:00:00' });
    const corregirAjena = await api.put(`/mi-espacio/horas-extras/${ajena}`, cuerpo, como('editor'));
    assert.equal(corregirAjena.status, 404);
    assert.deepEqual(corregirAjena.body, { success: false, error: MENSAJES_MI_ESPACIO.noEncontradas });
    assert.deepEqual(await horasGuardadasDe('editor'), [{ id: vieja, activo: 1 }]);

    // Borrar nunca se frena
    const borrar = await api.delete(`/mi-espacio/horas-extras/${vieja}`, como('editor'));
    assert.equal(borrar.status, 200, JSON.stringify(borrar.body));
    assert.deepEqual(await horasGuardadasDe('editor'), [{ id: vieja, activo: 0 }]);

    // Planta sigue cargando como siempre (en otro horario: el de antes es suyo)
    const dePlanta = await api.post('/mi-espacio/horas-extras', { ...cuerpo, desde: '19:00', hasta: '21:00' }, como('adminA'));
    assert.equal(dePlanta.status, 201, JSON.stringify(dePlanta.body));
  });
});

// «Sumar a {mes anterior}» (spec 2026-10-30-mi-espacio-horas-mes-anterior, 8): cada día del PUT puede traer al_mes_anterior.
// Si viene, es true o false (otro valor, 400 en al_mes_anterior); si no viene, se conserva lo guardado (una página vieja que no
// conoce el tilde no lo borra) y un día nuevo queda en 0; un borrado lo deja en 0. Con el tilde, las horas del día suman al
// mes anterior al de su fecha: el día es HABIL (el último hábil hasta hoy) y sus horas van a MES_DEL_TILDE
describe('sumar al mes anterior', () => {
  const MES_DEL_TILDE = mesMas(MES_HABIL, -1);
  // 16:20 en un día hábil da 1,5 h; 15:50, 1 h
  const TILDADO = Object.freeze({ fecha: HABIL, salida: '16:20', al_mes_anterior: true });
  // Las salidas de una persona con su marca, también las dadas de baja
  const marcasDe = async (clave) => (await query(
    `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, TIME_FORMAT(salida, '%H:%i') AS salida, al_mes_anterior, activo
     FROM mi_espacio_salidas WHERE usuario_id = ? ORDER BY fecha, id`,
    [usuarios[clave].id]
  )).map(fila => ({ ...fila, al_mes_anterior: Number(fila.al_mes_anterior), activo: Number(fila.activo) }));
  // Las horas de cada fila de la pestaña Horas extras ('AAAA-MM' → horas, de su `horas_texto`, «1,5 h»), del año del mes del
  // tilde y del de HABIL (en enero, son dos)
  const horasDeLaPestana = async (clave) => {
    const porMes = new Map();
    for (const anio of new Set([MES_DEL_TILDE.slice(0, 4), MES_HABIL.slice(0, 4)])) {
      const res = await api.get(`/mi-espacio/horas-extras?anio=${anio}`, como(clave));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      for (const fila of res.body.data.meses) {
        porMes.set(fila.mes, Number(fila.horas_texto.replace(/ h$/, '').replace(',', '.')));
      }
    }
    return porMes;
  };
  // Las horas del día cuentan una sola vez, en el mes que toca
  const horasEn = async (clave, mes, horas) => {
    const porMes = await horasDeLaPestana(clave);
    assert.equal(porMes.get(mes), horas, JSON.stringify([...porMes]));
    assert.equal([...porMes.values()].reduce((suma, otras) => suma + otras, 0), horas, JSON.stringify([...porMes]));
  };

  it('con al_mes_anterior en true: 200, la fila con 1 y las horas en la fila del mes anterior de la pestaña', async () => {
    await listoParaCargar('editor');
    const res = await guardar('editor', [TILDADO]);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, guardado(1));
    assert.deepEqual(await marcasDe('editor'), [{ fecha: HABIL, salida: '16:20', al_mes_anterior: 1, activo: 1 }]);
    await horasEn('editor', MES_DEL_TILDE, 1.5);
  });

  it('sin el campo se conserva lo guardado: otra salida del mismo día sigue tildada, y un día nuevo queda en 0', async () => {
    await listoParaCargar('editor');
    assert.equal((await guardar('editor', [TILDADO])).status, 200);
    const res = await guardar('editor', [{ fecha: HABIL, salida: '15:50' }, { fecha: HABIL_ANTES, salida: '16:20' }]);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(await marcasDe('editor'), [
      { fecha: HABIL_ANTES, salida: '16:20', al_mes_anterior: 0, activo: 1 },
      { fecha: HABIL, salida: '15:50', al_mes_anterior: 1, activo: 1 }
    ]);
    // Solo el de HABIL, con su hora nueva, en el mes del tilde
    const porMes = await horasDeLaPestana('editor');
    assert.equal(porMes.get(MES_DEL_TILDE), HABIL_ANTES.slice(0, 7) === MES_DEL_TILDE ? 2.5 : 1, JSON.stringify([...porMes]));
  });

  it('con al_mes_anterior en false, la marca vuelve a 0 y las horas, a su mes', async () => {
    await listoParaCargar('editor');
    assert.equal((await guardar('editor', [TILDADO])).status, 200);
    assert.deepEqual((await marcasDe('editor')).map(fila => fila.al_mes_anterior), [1]);
    const res = await guardar('editor', [{ ...TILDADO, al_mes_anterior: false }]);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(await marcasDe('editor'), [{ fecha: HABIL, salida: '16:20', al_mes_anterior: 0, activo: 1 }]);
    await horasEn('editor', MES_HABIL, 1.5);
  });

  it('el borrado deja la marca en 0 (aunque traiga el tilde); vuelto a cargar sin el campo, activo y en 0', async () => {
    await listoParaCargar('editor');
    for (const borrado of [{ fecha: HABIL, entrada: '', salida: '', nota: '' }, { fecha: HABIL, salida: '', al_mes_anterior: true }]) {
      await query('DELETE FROM mi_espacio_salidas');
      assert.equal((await guardar('editor', [TILDADO])).status, 200);
      assert.deepEqual((await marcasDe('editor')).map(fila => fila.al_mes_anterior), [1]);
      const res = await guardar('editor', [borrado]);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(res.body, guardado(1));
      assert.deepEqual(await marcasDe('editor'), [{ fecha: HABIL, salida: '16:20', al_mes_anterior: 0, activo: 0 }],
        JSON.stringify(borrado));
    }
    const otraVez = await guardar('editor', [{ fecha: HABIL, salida: '15:50' }]);
    assert.equal(otraVez.status, 200, JSON.stringify(otraVez.body));
    assert.deepEqual(await marcasDe('editor'), [{ fecha: HABIL, salida: '15:50', al_mes_anterior: 0, activo: 1 }]);
    await horasEn('editor', MES_HABIL, 1);
  });

  it('GET del mes anterior: trae en entran el día tildado del mes siguiente, y la suma lo cuenta y lo dice', async () => {
    await listoParaCargar('editor');
    assert.equal((await guardar('editor', [TILDADO])).status, 200);
    const anterior = await planilla('editor', MES_DEL_TILDE);
    assert.equal(anterior.status, 200, JSON.stringify(anterior.body));
    const { data } = anterior.body;
    assert.equal(data.sumar_a, nombreDelMes(mesMas(MES_DEL_TILDE, -1)));
    assert.deepEqual(data.entran.map(otro => [otro.fecha, otro.salida, otro.al_mes_anterior, otro.horas, otro.horas_texto]),
      [[HABIL, '16:20', true, 1.5, '1,5 h']]);
    assert.deepEqual([data.suma.horas, data.suma.cifra, data.suma.detalle],
      [1.5, '1,5', `Incluye 1,5 h de ${nombreDelMes(MES_HABIL)}.`]);
    // En su propio mes, el día va tildado, con sus horas, y la suma no lo cuenta
    const propio = await planilla('editor', MES_HABIL);
    assert.equal(propio.status, 200, JSON.stringify(propio.body));
    const delDia = propio.body.data.dias.find(otro => otro.fecha === HABIL);
    assert.deepEqual([delDia.al_mes_anterior, delDia.horas], [true, 1.5]);
    assert.equal(propio.body.data.suma.horas, 0);
    assert.match(propio.body.data.suma.detalle, new RegExp(`^1,5 h del .+ suman a ${nombreDelMes(MES_DEL_TILDE)}\\.$`));
    assert.deepEqual(propio.body.data.entran, []);
  });

  it('un al_mes_anterior que no es true ni false da 400 en al_mes_anterior, con su fecha, y no se guarda ningún día', async () => {
    assert.equal(MENSAJES_MI_ESPACIO.alMesAnterior, 'Elegí si este día suma al mes anterior.');
    await listoParaCargar('editor');
    for (const valor of ['si', null, 1, 0, 'true', {}]) {
      const res = await guardar('editor', [
        { fecha: HABIL_ANTES, salida: '16:20', al_mes_anterior: true }, { fecha: HABIL, salida: '15:50', al_mes_anterior: valor }
      ]);
      assert.equal(res.status, 400, JSON.stringify(valor));
      assert.deepEqual(res.body,
        rechazoDeLosDias([{ fecha: HABIL, campo: 'al_mes_anterior', mensaje: MENSAJES_MI_ESPACIO.alMesAnterior }]),
        JSON.stringify(valor));
      assert.deepEqual(await marcasDe('editor'), [], JSON.stringify(valor));
    }
  });
});
