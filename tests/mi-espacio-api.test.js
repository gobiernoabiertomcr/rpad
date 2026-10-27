// Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, secciones 5, 10 y 11): la API, contra una base de prueba propia.
// Todas las rutas trabajan sobre la persona de la sesión: lo de otra nunca se ve. Sin modalidad (sin vínculo cargado), las
// lecturas responden 200 con `modalidad: null` y el mensaje que lo dice. Lo que llega de la base como texto (los DECIMAL, los
// TIME y las fechas) sale como número, 'HH:MM' y 'AAAA-MM-DD' (Review Focus 2). La lectura (services/miEspacioDatos.js) se
// prueba también directo. La API usa la fecha real: las fechas de los tests se arman desde hoy.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { asegurarBaseDePrueba } from './notas-fixtures.js';
import { hoyArgentina, sumarDias, esDiaHabil, FERIADOS_FIJOS } from '../services/notasDigitalesCalendario.js';
import {
  MENSAJES_MI_ESPACIO, DIAS_VACACIONES, camposDelSaldoInicial, textoDeLasMitades, textoSuperpuesta, textoTope,
  textoSinNoUtilizadas
} from '../services/miEspacioReglas.js';

let base, servidor, api, usuarios, dbReal, datos, pool;
const hoy = hoyArgentina();
const ANIO = Number(hoy.slice(0, 4));
const dia = (n) => sumarDias(hoy, n);
// Las licencias se arman sobre dos semanas sin feriados (el primer lunes desde dentro de 7 días cuyos diez días de semana son
// hábiles), para que los días hábiles no dependan de la fecha real: q(0) es ese lunes, q(4) el viernes, q(5) y q(6) el fin de
// semana, q(7) el lunes siguiente. Vale mientras la tabla `feriados` está vacía (el beforeEach la vacía)
const LUNES = (() => {
  const esLunes = (fecha) => new Date(`${fecha}T12:00:00Z`).getUTCDay() === 1;
  const habiles = (lunes) => [0, 1, 2, 3, 4, 7, 8, 9, 10, 11].every(n => esDiaHabil(sumarDias(lunes, n)));
  let lunes = dia(7);
  while (!esLunes(lunes) || !habiles(lunes)) lunes = sumarDias(lunes, 1);
  return lunes;
})();
const q = (n) => sumarDias(LUNES, n);
const ANIO_Q = Number(LUNES.slice(0, 4));

// Las personas (inventadas, las de las maquetas): el rol, el nombre y el vínculo, puesto por SQL. El lector no tiene vínculo
const PERSONAS = Object.freeze({
  superadmin: ['superadmin', 'Diego Fernández', 'planta_politica'],
  adminA: ['admin', 'Laura Gómez', 'planta_permanente'],
  adminB: ['admin', 'Martín Ríos', 'planta_permanente'],
  editor: ['editor', 'Carla Benítez', 'contrato'],
  lector: ['lector', 'Sofía Paz', null],
  colab: ['colaborador', 'Persona de Prueba', 'contrato']
});

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_mi_espacio_api');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, Object.fromEntries(Object.entries(PERSONAS).map(([clave, [rol]]) => [clave, rol])));
  for (const [clave, [, nombre, vinculo]] of Object.entries(PERSONAS)) {
    await query('UPDATE usuarios SET nombre_completo = ?, vinculo = ? WHERE id = ?', [nombre, vinculo, usuarios[clave].id]);
  }
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba
  datos = await import('../services/miEspacioDatos.js');
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
    'mi_espacio_licencias', 'mi_espacio_horas_extras', 'mi_espacio_saldos', 'mi_espacio_anios', 'mi_espacio_arranque',
    'mi_espacio_avisos', 'usuarios_licencias', 'feriados'
  ]) {
    await query(`DELETE FROM ${tabla}`);
  }
});

const como = (clave) => ({ token: usuarios[clave].token });

// Lo que cargó una persona, por SQL: los números y las horas como los escribiría cualquiera ('7.5', '8.0', '19:00:00')
const conArranque = (clave, fecha) =>
  query('INSERT INTO mi_espacio_arranque (usuario_id, fecha) VALUES (?, ?)', [usuarios[clave].id, fecha]);
const conAnio = (clave, anio, dias, estudios = null) => query(
  'INSERT INTO mi_espacio_anios (usuario_id, anio, dias_vacaciones, estudios) VALUES (?, ?, ?, ?)',
  [usuarios[clave].id, anio, dias, estudios]
);
const conSaldo = (clave, concepto, anio, cantidad) => query(
  'INSERT INTO mi_espacio_saldos (usuario_id, concepto, anio, cantidad) VALUES (?, ?, ?, ?)',
  [usuarios[clave].id, concepto, anio, cantidad]
);
const conLicencia = async (clave, { tipo, desde, hasta = desde, horas = null, nota = null, activo = 1 }) => (await query(
  'INSERT INTO mi_espacio_licencias (usuario_id, tipo, desde, hasta, horas, nota, activo) VALUES (?, ?, ?, ?, ?, ?, ?)',
  [usuarios[clave].id, tipo, desde, hasta, horas, nota, activo]
)).insertId;
const conHorasExtras = async (clave, { fecha, desde, hasta, nota = null, activo = 1 }) => (await query(
  'INSERT INTO mi_espacio_horas_extras (usuario_id, fecha, desde, hasta, nota, activo) VALUES (?, ?, ?, ?, ?, ?)',
  [usuarios[clave].id, fecha, desde, hasta, nota, activo]
)).insertId;
const conFeriado = async ({ fecha, nombre, se_repite = 0 }) => (await query(
  "INSERT INTO feriados (fecha, nombre, tipo, se_repite) VALUES (?, ?, 'nacional', ?)", [fecha, nombre, se_repite]
)).insertId;

// Ninguna fecha llega como un Date de la base (el '2026-11-02T03:00:00.000Z' de JSON), en ningún nivel de la respuesta
const sinFechasConHora = (valor, camino = 'data') => {
  if (typeof valor === 'string') assert.doesNotMatch(valor, /\d{4}-\d{2}-\d{2}T\d{2}:/, camino);
  if (valor !== null && typeof valor === 'object') {
    for (const [clave, otro] of Object.entries(valor)) sinFechasConHora(otro, `${camino}.${clave}`);
  }
};
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Las cinco lecturas, con el año de hoy
const LECTURAS = ['/mi-espacio/resumen', '/mi-espacio/licencias', '/mi-espacio/horas-extras', `/mi-espacio/anio/${ANIO}`,
  '/mi-espacio/saldo-inicial'];

describe('sin vínculo', () => {
  for (const ruta of LECTURAS) {
    it(`el lector sin vínculo recibe 200 con modalidad null y el mensaje en GET ${ruta}`, async () => {
      const res = await api.get(ruta, como('lector'));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.modalidad, null);
      assert.equal(res.body.data.mensaje, MENSAJES_MI_ESPACIO.sinModalidad);
    });
  }
});

describe('lo que llega de la base (Review Focus 2)', () => {
  it('los DECIMAL salen como números, los TIME como HH:MM y las fechas como AAAA-MM-DD', async () => {
    await conArranque('adminA', hoy);
    await conAnio('adminA', ANIO, 20);
    await conSaldo('adminA', 'franquicias', ANIO, '8.0');
    const franquicia = await conLicencia('adminA', { tipo: 'franquicia', desde: q(1), horas: '7.5' });
    await conHorasExtras('adminA', { fecha: q(2), desde: '19:00:00', hasta: '22:00:00' });

    const lista = await api.get(`/mi-espacio/licencias?anio=${ANIO_Q}`, como('adminA'));
    assert.equal(lista.status, 200, JSON.stringify(lista.body));
    assert.equal(lista.body.data.anio, ANIO_Q);
    const [fila] = lista.body.data.licencias;
    assert.equal(fila.id, franquicia);
    assert.strictEqual(fila.horas, 7.5);
    assert.equal(fila.cantidad_texto, '7,5 horas');
    assert.deepEqual([fila.desde, fila.hasta], [q(1), q(1)]);

    const tabla = await api.get(`/mi-espacio/horas-extras?anio=${ANIO_Q}`, como('adminA'));
    assert.equal(tabla.status, 200, JSON.stringify(tabla.body));
    const [extra] = tabla.body.data.dias_por_mes[q(2).slice(0, 7)];
    assert.equal(extra.horario, '19:00 a 22:00');
    assert.equal(extra.horas_texto, '3 horas');
    assert.equal(extra.fecha, q(2));

    const saldo = await api.get('/mi-espacio/saldo-inicial', como('adminA'));
    assert.equal(saldo.status, 200, JSON.stringify(saldo.body));
    assert.equal(saldo.body.data.arranque, hoy);
    assert.strictEqual(saldo.body.data.campos.find(campo => campo.clave === 'franquicias').valor, 8);

    // Las 42 horas de franquicia del año, menos las 8 del saldo y las 7,5 de la franquicia si es de este año
    const resumen = await api.get('/mi-espacio/resumen', como('adminA'));
    assert.equal(resumen.status, 200, JSON.stringify(resumen.body));
    const tanque = resumen.body.data.tanques.otros.find(otro => otro.clave === 'franquicia');
    assert.strictEqual(tanque.valor, ANIO_Q === ANIO ? 26.5 : 34);

    for (const res of [lista, tabla, saldo, resumen]) sinFechasConHora(res.body.data);
    for (const licencia of lista.body.data.licencias) assert.match(licencia.desde, FECHA);
  });
});

describe('lo ajeno no se ve', () => {
  it('las licencias y las horas extras de adminB no aparecen en las de adminA', async () => {
    const propia = await conLicencia('adminA', { tipo: 'medica', desde: q(0), hasta: q(1) });
    await conLicencia('adminB', { tipo: 'medica', desde: q(2), hasta: q(3) });
    await conLicencia('adminB', { tipo: 'familiar', desde: q(7) });
    await conHorasExtras('adminB', { fecha: q(2), desde: '19:00:00', hasta: '22:00:00' });

    const lista = await api.get(`/mi-espacio/licencias?anio=${ANIO_Q}`, como('adminA'));
    assert.equal(lista.status, 200, JSON.stringify(lista.body));
    assert.deepEqual(lista.body.data.licencias.map(fila => fila.id), [propia]);

    const tabla = await api.get(`/mi-espacio/horas-extras?anio=${ANIO_Q}`, como('adminA'));
    assert.equal(tabla.status, 200, JSON.stringify(tabla.body));
    assert.deepEqual(tabla.body.data.dias_por_mes, {});

    // Y adminB ve las suyas
    const deB = await api.get(`/mi-espacio/licencias?anio=${ANIO_Q}`, como('adminB'));
    assert.equal(deB.body.data.licencias.length, 2);
  });

  it('una licencia dada de baja no aparece', async () => {
    await conLicencia('adminA', { tipo: 'medica', desde: q(0), activo: 0 });
    const lista = await api.get(`/mi-espacio/licencias?anio=${ANIO_Q}`, como('adminA'));
    assert.deepEqual(lista.body.data.licencias, []);
  });

  it('los años y el saldo inicial de adminB no cambian lo que lee adminA en /saldo-inicial y /anio', async () => {
    await conArranque('adminA', `${ANIO}-01-15`);
    await conAnio('adminA', ANIO, 20);
    await conSaldo('adminA', 'vacaciones', ANIO - 1, '4.0');
    const leer = async () => {
      const lecturas = [];
      for (const ruta of ['/mi-espacio/saldo-inicial', `/mi-espacio/anio/${ANIO}`, `/mi-espacio/anio/${ANIO + 1}`,
        `/mi-espacio/anio/${ANIO - 1}`]) {
        const res = await api.get(ruta, como('adminA'));
        assert.equal(res.status, 200, `${ruta} ${JSON.stringify(res.body)}`);
        lecturas.push(res.body.data);
      }
      return lecturas;
    };
    const antes = await leer();

    // adminB con otro arranque, otros días y estudios (también de un año anterior, que adminA heredaría) y otros saldos
    await conArranque('adminB', `${ANIO}-03-02`);
    await conAnio('adminB', ANIO - 1, 30, 'universitario');
    await conAnio('adminB', ANIO, 25, 'secundario');
    await conAnio('adminB', ANIO + 1, 10);
    for (const [concepto, anio, cantidad] of [['vacaciones', ANIO - 1, '12.0'], ['vacaciones', ANIO - 2, '3.0'],
      ['franquicias', ANIO, '8.0'], ['medica', ANIO, '5.0'], ['familiar', ANIO, '2.0'], ['estudios', ANIO, '1.0']]) {
      await conSaldo('adminB', concepto, anio, cantidad);
    }
    const despues = await leer();
    assert.deepEqual(despues, antes);

    const [saldo, delAnio, siguiente, anterior] = despues;
    assert.equal(saldo.arranque, `${ANIO}-01-15`);
    assert.deepEqual(saldo.campos.filter(campo => campo.valor !== null).map(campo => [campo.clave, campo.valor]),
      [[`vacaciones-${ANIO - 1}`, 4]]);
    assert.deepEqual([delAnio.dias_vacaciones, delAnio.estudios, delAnio.heredado], [20, null, false]);
    assert.deepEqual([siguiente.dias_vacaciones, siguiente.heredado], [20, true]);
    assert.deepEqual([anterior.dias_vacaciones, anterior.estudios, anterior.texto_mitades], [null, null, null]);
  });
});

describe('el saldo inicial', () => {
  it('sin arranque, los campos se arman con hoy y sin valores', async () => {
    await conAnio('adminA', ANIO, 20, 'secundario');
    const res = await api.get('/mi-espacio/saldo-inicial', como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const esperados = camposDelSaldoInicial({
      modalidad: 'planta', arranque: hoy, anios: [{ anio: ANIO, dias_vacaciones: 20, estudios: 'secundario' }]
    });
    assert.ok(esperados.some(campo => campo.clave === 'estudios'));
    assert.deepEqual(res.body.data, {
      arranque: null, modalidad: 'planta', campos: esperados.map(campo => ({ ...campo, valor: null }))
    });
  });

  it('con arranque, cada campo trae lo guardado, en contrato con las horas no utilizadas', async () => {
    const arranque = `${ANIO}-01-15`;
    await conArranque('editor', arranque);
    await conSaldo('editor', 'vacaciones', ANIO - 1, '12.0');
    await conSaldo('editor', 'horas_no_utilizadas', ANIO, '2.5');
    const res = await api.get('/mi-espacio/saldo-inicial', como('editor'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { data } = res.body;
    assert.deepEqual([data.arranque, data.modalidad], [arranque, 'contrato']);
    const valores = Object.fromEntries(data.campos.map(campo => [campo.clave, campo.valor]));
    assert.deepEqual(valores, {
      [`vacaciones-${ANIO - 2}`]: null, [`vacaciones-${ANIO - 1}`]: 12, medica: null, familiar: null, horas_no_utilizadas: 2.5
    });
  });
});

describe('el año', () => {
  const TEXTO_CON_20 = (anio) => `Se habilitan en dos mitades: 10 el 1/7/${anio} y 10 el 1/1/${anio + 1} (con 15, 8 y 7; con 25, `
    + '13 y 12). Cada licencia vence el 31/12 de dos años después.';
  // Un texto por cada valor de DIAS_VACACIONES, para que el modal muestre el del botón elegido sin recalcular
  const textosDelAnio = (anio) => Object.fromEntries(DIAS_VACACIONES.map(dias => [String(dias), textoDeLasMitades(anio, dias)]));

  it('los días y los estudios del año, con las mitades', async () => {
    await conAnio('adminA', 2026, 20, 'universitario');
    const res = await api.get('/mi-espacio/anio/2026', como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data, {
      anio: 2026, dias_vacaciones: 20, estudios: 'universitario', heredado: false,
      texto_mitades: 'Se habilitan en dos mitades: 10 el 1/7/2026 y 10 el 1/1/2027 (con 15, 8 y 7; con 25, 13 y 12). Cada '
        + 'licencia vence el 31/12 de dos años después.',
      textos_mitades: textosDelAnio(2026)
    });
    assert.deepEqual(Object.keys(res.body.data.textos_mitades), ['10', '15', '20', '25', '30']);
    assert.equal(res.body.data.textos_mitades['20'], res.body.data.texto_mitades);
    assert.match(res.body.data.textos_mitades['25'], /^Se habilitan en dos mitades: 13 el 1\/7\/2026 y 12 el 1\/1\/2027 \(/);
  });

  it('sin los de ese año, los del anterior más cercano, heredados; con un número impar, la primera mitad es la mayor', async () => {
    await conAnio('adminA', 2024, 15, 'secundario');
    await conAnio('adminA', 2025, 20);
    const res = await api.get('/mi-espacio/anio/2027', como('adminA'));
    assert.deepEqual(res.body.data, {
      anio: 2027, dias_vacaciones: 20, estudios: null, heredado: true, texto_mitades: TEXTO_CON_20(2027),
      textos_mitades: textosDelAnio(2027)
    });
    const impar = await api.get('/mi-espacio/anio/2024', como('adminA'));
    assert.equal(impar.body.data.heredado, false);
    assert.match(impar.body.data.texto_mitades, /^Se habilitan en dos mitades: 8 el 1\/7\/2024 y 7 el 1\/1\/2025 \(/);
  });

  it('sin ningún año elegido, sin días, estudios ni texto de las mitades, pero con el de cada botón', async () => {
    const res = await api.get(`/mi-espacio/anio/${ANIO}`, como('adminA'));
    assert.deepEqual(res.body.data, {
      anio: ANIO, dias_vacaciones: null, estudios: null, heredado: false, texto_mitades: null,
      textos_mitades: textosDelAnio(ANIO)
    });
    assert.equal(res.body.data.textos_mitades['20'], TEXTO_CON_20(ANIO));
  });
});

describe('el Resumen', () => {
  it('sin arranque, pide «Mis vacaciones y saldos»', async () => {
    const res = await api.get('/mi-espacio/resumen', como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { data } = res.body;
    assert.deepEqual(data.modalidad, { clave: 'planta', texto: 'Planta permanente' });
    assert.equal(data.mensaje, MENSAJES_MI_ESPACIO.sinArranque);
    assert.equal(data.abrir_saldos, true);
    assert.deepEqual(data.persona, { nombre: 'Laura Gómez', ve_companeros: true, audita: true, es_superadmin: false });
  });

  it('con arranque, los tanques; «Hoy y mañana», sin ausentes y con el próximo feriado de la tabla', async () => {
    await conArranque('editor', hoy);
    await conAnio('editor', ANIO, 20);
    // El primer día hábil después de hoy es feriado de la tabla; si antes hay un fijo de lunes a viernes, el próximo es ese
    let proximo = sumarDias(hoy, 1);
    const esFijo = (fecha) => FERIADOS_FIJOS.includes(fecha.slice(5));
    const esFinDeSemana = (fecha) => [0, 6].includes(new Date(`${fecha}T12:00:00Z`).getUTCDay());
    while (esFinDeSemana(proximo)) proximo = sumarDias(proximo, 1);
    const deLaTabla = !esFijo(proximo);
    if (deLaTabla) await conFeriado({ fecha: proximo, nombre: 'Feriado de prueba' });

    const res = await api.get('/mi-espacio/resumen', como('editor'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { data } = res.body;
    assert.deepEqual(data.modalidad, { clave: 'contrato', texto: 'Contrato' });
    assert.equal(data.mensaje, null);
    assert.equal(data.anio, ANIO);
    assert.ok(data.tanques.vacaciones);
    assert.deepEqual(data.tanques.otros.map(otro => otro.clave), ['horas_a_favor', 'medica', 'familiar']);
    assert.deepEqual(data.hoy_y_manana.ausentes, []);
    assert.equal(data.hoy_y_manana.proximo_feriado.fecha, proximo);
    if (deLaTabla) assert.equal(data.hoy_y_manana.proximo_feriado.nombre, 'Feriado de prueba');
  });
});

describe('el año pedido', () => {
  for (const anio of ['abc', '1999', '2101', '2026.5', ' 2026']) {
    it(`?anio=${anio} da 400 en anio`, async () => {
      for (const ruta of ['/mi-espacio/licencias', '/mi-espacio/horas-extras']) {
        const res = await api.get(`${ruta}?anio=${encodeURIComponent(anio)}`, como('adminA'));
        assert.equal(res.status, 400, ruta);
        assert.deepEqual(res.body, { success: false, error: MENSAJES_MI_ESPACIO.anio, campo: 'anio' }, ruta);
      }
    });
  }

  it('/anio/abc y /anio/1999 dan 400 en anio, también sin vínculo', async () => {
    for (const [anio, clave] of [['abc', 'adminA'], ['1999', 'adminA'], ['abc', 'lector']]) {
      const res = await api.get(`/mi-espacio/anio/${anio}`, como(clave));
      assert.equal(res.status, 400, `${anio} ${clave}`);
      assert.equal(res.body.campo, 'anio');
      assert.equal(res.body.error, MENSAJES_MI_ESPACIO.anio);
    }
  });

  it('los bordes, 2000 y 2100, sirven', async () => {
    for (const anio of [2000, 2100]) {
      const res = await api.get(`/mi-espacio/licencias?anio=${anio}`, como('adminA'));
      assert.equal(res.status, 200, String(anio));
      assert.equal(res.body.data.anio, anio);
    }
  });
});

// Las licencias de una persona como quedaron en la base, también las dadas de baja
const guardadasDe = (clave) => query(
  `SELECT id, tipo, DATE_FORMAT(desde, '%Y-%m-%d') AS desde, DATE_FORMAT(hasta, '%Y-%m-%d') AS hasta, horas, mostrar, nota,
     activo
   FROM mi_espacio_licencias WHERE usuario_id = ? ORDER BY id`,
  [usuarios[clave].id]
);
// Lo mínimo para cargar: el arranque y los días del año (sin arranque, toda carga da sinArranque)
const listoParaCargar = async (clave, arranque = hoy) => {
  await conArranque(clave, arranque);
  await conAnio(clave, Number(arranque.slice(0, 4)), 20);
};
const rechazo = (error, campo) => ({ success: false, error, campo });
const NO_ENCONTRADA = { success: false, error: MENSAJES_MI_ESPACIO.noEncontrada };

describe('cargar una licencia', () => {
  it('alta y lista: la médica de adminA queda en GET /licencias, con sus días hábiles', async () => {
    await listoParaCargar('adminA');
    const res = await api.post('/mi-espacio/licencias', { tipo: 'medica', desde: q(0), hasta: q(2), nota: '  Turno  ' },
      como('adminA'));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(Object.keys(res.body).sort(), ['data', 'message', 'success']);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'Licencia cargada.');
    const { id } = res.body.data;
    assert.ok(Number.isInteger(id) && id > 0);

    const lista = await api.get(`/mi-espacio/licencias?anio=${ANIO_Q}`, como('adminA'));
    assert.equal(lista.status, 200, JSON.stringify(lista.body));
    const [fila] = lista.body.data.licencias;
    assert.deepEqual([fila.id, fila.tipo, fila.desde, fila.hasta, fila.nota], [id, 'medica', q(0), q(2), 'Turno']);
    assert.equal(fila.cantidad_texto, '3 días hábiles');

    const [guardada] = await guardadasDe('adminA');
    assert.deepEqual({ ...guardada, mostrar: Number(guardada.mostrar), activo: Number(guardada.activo) },
      { id, tipo: 'medica', desde: q(0), hasta: q(2), horas: null, mostrar: 1, nota: 'Turno', activo: 1 });
  });

  it('una franquicia guarda sus horas; un día de un solo día toma el desde como hasta', async () => {
    await listoParaCargar('adminA');
    const res = await api.post('/mi-espacio/licencias', { tipo: 'franquicia', desde: q(1), horas: 3 }, como('adminA'));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const [guardada] = await guardadasDe('adminA');
    assert.deepEqual([guardada.desde, guardada.hasta, Number(guardada.horas)], [q(1), q(1), 3]);
  });

  it('cada 400 con su campo, y ninguna fila guardada', async () => {
    await listoParaCargar('adminA');
    const casos = [
      [{ tipo: 'otro', desde: q(0), hasta: q(0) }, rechazo(MENSAJES_MI_ESPACIO.tipo, 'tipo')],
      [{ tipo: 'medica', desde: '2026-02-30', hasta: q(0) }, rechazo(MENSAJES_MI_ESPACIO.fecha, 'desde')],
      [{ tipo: 'medica', desde: q(5), hasta: q(6) }, rechazo(MENSAJES_MI_ESPACIO.sinDiasHabiles, 'desde')],
      [{ tipo: 'franquicia', desde: q(0), horas: 2.5 }, rechazo(MENSAJES_MI_ESPACIO.horasEnteras, 'horas')],
      [{ tipo: 'medica', desde: q(0), hasta: q(0), nota: 'x'.repeat(201) }, rechazo(MENSAJES_MI_ESPACIO.nota, 'nota')],
      // Las horas a favor no son de planta
      [{ tipo: 'horas_a_favor', desde: q(0), horas: 1 }, rechazo(MENSAJES_MI_ESPACIO.tipo, 'tipo')],
      // El uso autorizado va por la misma ruta (desde su formulario): el tipo pasa, y en planta es un franco que sale de lo no
      // utilizado previamente, que no hay
      [{ tipo: 'uso_autorizado', desde: q(0) }, rechazo(textoSinNoUtilizadas('planta', ANIO_Q, 0), 'desde')]
    ];
    for (const [cuerpo, esperado] of casos) {
      const res = await api.post('/mi-espacio/licencias', cuerpo, como('adminA'));
      assert.equal(res.status, 400, JSON.stringify(cuerpo));
      assert.deepEqual(res.body, esperado, JSON.stringify(cuerpo));
    }
    // Con 200 caracteres (contados con Array.from: un emoji es uno), sí
    const largo = await api.post('/mi-espacio/licencias',
      { tipo: 'medica', desde: q(0), hasta: q(0), nota: '😀'.repeat(200) }, como('adminA'));
    assert.equal(largo.status, 201, JSON.stringify(largo.body));
    assert.equal((await guardadasDe('adminA')).length, 1);
  });

  it('sin arranque, 400 con campo null; sin vínculo, también, con sinModalidad', async () => {
    await conAnio('adminA', ANIO, 20);
    const sinArranque = await api.post('/mi-espacio/licencias', { tipo: 'medica', desde: q(0), hasta: q(0) }, como('adminA'));
    assert.equal(sinArranque.status, 400);
    assert.deepEqual(sinArranque.body, rechazo(MENSAJES_MI_ESPACIO.sinArranque, null));

    const sinVinculo = await api.post('/mi-espacio/licencias', { tipo: 'medica', desde: q(0), hasta: q(0) }, como('lector'));
    assert.equal(sinVinculo.status, 400);
    assert.deepEqual(sinVinculo.body, rechazo(MENSAJES_MI_ESPACIO.sinModalidad, null));
    assert.equal((await guardadasDe('adminA')).length + (await guardadasDe('lector')).length, 0);
  });

  it('el tope frena una carga nueva: con 24 días de atención médica en el saldo, una de 2 días no se guarda', async () => {
    // El arranque en el año de las fechas de los tests, para que el saldo cuente en ese año
    await listoParaCargar('adminA', `${ANIO_Q}-01-01`);
    await conSaldo('adminA', 'medica', ANIO_Q, '24.0');
    const dos = await api.post('/mi-espacio/licencias', { tipo: 'medica', desde: q(0), hasta: q(1) }, como('adminA'));
    assert.equal(dos.status, 400);
    assert.deepEqual(dos.body, rechazo(textoTope('medica', ANIO_Q), 'desde'));
    assert.equal(dos.body.error, `Con esta licencia pasarías los 25 días de atención médica de ${ANIO_Q}.`);
    assert.equal((await guardadasDe('adminA')).length, 0);

    // Una de un día llega justo al tope
    const una = await api.post('/mi-espacio/licencias', { tipo: 'medica', desde: q(0), hasta: q(0) }, como('adminA'));
    assert.equal(una.status, 201, JSON.stringify(una.body));
  });

  it('una superpuesta no se guarda', async () => {
    await listoParaCargar('adminA');
    await conLicencia('adminA', { tipo: 'medica', desde: q(0), hasta: q(2) });
    const res = await api.post('/mi-espacio/licencias', { tipo: 'familiar', desde: q(2), hasta: q(3) }, como('adminA'));
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, rechazo(textoSuperpuesta(q(2)), 'desde'));
    assert.equal((await guardadasDe('adminA')).length, 1);
    // La de otra persona no choca
    await listoParaCargar('adminB');
    const deB = await api.post('/mi-espacio/licencias', { tipo: 'familiar', desde: q(2), hasta: q(3) }, como('adminB'));
    assert.equal(deB.status, 201, JSON.stringify(deB.body));
  });

  it('dos POST simultáneos que se superponen guardan uno solo (Review Focus 3)', async () => {
    await listoParaCargar('adminA');
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      await query('DELETE FROM mi_espacio_licencias');
      const cuerpos = [
        { tipo: 'medica', desde: q(0), hasta: q(2) },
        { tipo: 'medica', desde: q(0), hasta: q(2) },
        { tipo: 'familiar', desde: q(1), hasta: q(3) }
      ];
      const respuestas = await Promise.all(cuerpos.map(cuerpo => api.post('/mi-espacio/licencias', cuerpo, como('adminA'))));
      const estados = respuestas.map(res => res.status).sort();
      assert.deepEqual(estados, [201, 400, 400], JSON.stringify(respuestas.map(res => res.body)));
      for (const res of respuestas.filter(otra => otra.status === 400)) {
        assert.equal(res.body.campo, 'desde');
        assert.match(res.body.error, /^Ya tenés una licencia cargada el /);
      }
      assert.equal((await guardadasDe('adminA')).length, 1, `vuelta ${vuelta}`);
    }
  });

  it('lo anterior al arranque se guarda y no descuenta', async () => {
    await listoParaCargar('adminA', q(7));
    const tanqueMedico = async () => {
      const res = await api.get('/mi-espacio/resumen', como('adminA'));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      return res.body.data.tanques.otros.find(otro => otro.clave === 'medica').valor;
    };
    const antes = await tanqueMedico();
    assert.equal(antes, 25);

    const res = await api.post('/mi-espacio/licencias', { tipo: 'medica', desde: q(0), hasta: q(0) }, como('adminA'));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(await tanqueMedico(), 25);
    const lista = await api.get(`/mi-espacio/licencias?anio=${ANIO_Q}`, como('adminA'));
    const [fila] = lista.body.data.licencias;
    assert.deepEqual([fila.id, fila.antes_del_arranque], [res.body.data.id, true]);

    // Desde el arranque, sí descuenta (en el tanque del año de hoy, si las fechas de los tests son de este año)
    const desde = await api.post('/mi-espacio/licencias', { tipo: 'medica', desde: q(7), hasta: q(7) }, como('adminA'));
    assert.equal(desde.status, 201, JSON.stringify(desde.body));
    assert.equal(await tanqueMedico(), ANIO_Q === ANIO ? 24 : 25);
  });
});

describe('mostrar a mis compañeros', () => {
  it('administración guarda lo que eligió: con false, 0; sin el campo, 1', async () => {
    await listoParaCargar('editor');
    const no = await api.post('/mi-espacio/licencias', { tipo: 'medica', desde: q(0), hasta: q(0), mostrar: false },
      como('editor'));
    const si = await api.post('/mi-espacio/licencias', { tipo: 'medica', desde: q(1), hasta: q(1) }, como('editor'));
    assert.deepEqual([no.status, si.status], [201, 201]);
    assert.deepEqual((await guardadasDe('editor')).map(fila => Number(fila.mostrar)), [0, 1]);
  });

  it('el lector no guarda mostrar: su licencia queda con 0, también al corregirla; el colaborador, igual', async () => {
    await query('UPDATE usuarios SET vinculo = ? WHERE id = ?', ['contrato', usuarios.lector.id]);
    try {
      await listoParaCargar('lector');
      const res = await api.post('/mi-espacio/licencias', { tipo: 'medica', desde: q(0), hasta: q(0), mostrar: true },
        como('lector'));
      assert.equal(res.status, 201, JSON.stringify(res.body));
      const corregida = await api.put(`/mi-espacio/licencias/${res.body.data.id}`,
        { tipo: 'medica', desde: q(0), hasta: q(1), mostrar: 1 }, como('lector'));
      assert.equal(corregida.status, 200, JSON.stringify(corregida.body));
      assert.deepEqual((await guardadasDe('lector')).map(fila => [fila.hasta, Number(fila.mostrar)]), [[q(1), 0]]);
    } finally {
      await query('UPDATE usuarios SET vinculo = NULL WHERE id = ?', [usuarios.lector.id]);
    }

    await listoParaCargar('colab');
    const deColab = await api.post('/mi-espacio/licencias', { tipo: 'medica', desde: q(0), hasta: q(0) }, como('colab'));
    assert.equal(deColab.status, 201, JSON.stringify(deColab.body));
    assert.deepEqual((await guardadasDe('colab')).map(fila => Number(fila.mostrar)), [0]);
  });
});

describe('el cálculo previo', () => {
  it('el cálculo no guarda: unas vacaciones dan de qué licencia salen y lo que queda', async () => {
    await listoParaCargar('adminA');
    await conSaldo('adminA', 'vacaciones', ANIO - 1, '10.0');
    const res = await api.post('/mi-espacio/licencias/calculo', { tipo: 'vacaciones', desde: q(0), hasta: q(4) },
      como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(Object.keys(res.body).sort(), ['data', 'success']);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.error, null);
    const { vista } = res.body.data;
    assert.equal(vista.dias_habiles, 5);
    assert.equal(vista.texto_dias, '5 días hábiles');
    assert.equal(vista.texto_reparto,
      `Salen de la licencia ${ANIO - 1}, la más vieja. Te quedan 5 días, todos de la ${ANIO - 1}.`);
    assert.equal(vista.antes_del_arranque, false);
    assert.equal((await guardadasDe('adminA')).length, 0);
  });

  it('con un error, 200 y el error en data, con su campo', async () => {
    await listoParaCargar('adminA');
    const res = await api.post('/mi-espacio/licencias/calculo', { tipo: 'otro', desde: q(0) }, como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, {
      success: true, data: { error: { campo: 'tipo', mensaje: MENSAJES_MI_ESPACIO.tipo }, vista: null }
    });
    const sinArranque = await api.post('/mi-espacio/licencias/calculo', { tipo: 'medica', desde: q(0) }, como('adminB'));
    assert.deepEqual(sinArranque.body.data.error, { campo: null, mensaje: MENSAJES_MI_ESPACIO.sinArranque });
    // El tope: el error y lo que quedaría
    await conSaldo('adminA', 'medica', ANIO, '25.0');
    if (ANIO_Q === ANIO) {
      const tope = await api.post('/mi-espacio/licencias/calculo', { tipo: 'medica', desde: q(0), hasta: q(0) },
        como('adminA'));
      assert.deepEqual(tope.body.data.error, { campo: 'desde', mensaje: textoTope('medica', ANIO) });
      assert.equal(tope.body.data.vista.texto_dias, '1 día hábil');
    }
    assert.equal((await guardadasDe('adminA')).length, 0);
  });

  it('con el id de la que se corrige, no choca consigo misma; el de otra persona no cambia nada', async () => {
    await listoParaCargar('adminA');
    const propia = await conLicencia('adminA', { tipo: 'medica', desde: q(0), hasta: q(2) });
    const ajena = await conLicencia('adminB', { tipo: 'medica', desde: q(0), hasta: q(2) });
    const cuerpo = { tipo: 'medica', desde: q(1), hasta: q(3) };
    const conLaPropia = await api.post('/mi-espacio/licencias/calculo', { ...cuerpo, id: propia }, como('adminA'));
    assert.equal(conLaPropia.body.data.error, null);
    assert.equal(conLaPropia.body.data.vista.texto_dias, '3 días hábiles');
    for (const id of [undefined, ajena, 'abc']) {
      const res = await api.post('/mi-espacio/licencias/calculo', { ...cuerpo, id }, como('adminA'));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(res.body.data.error, { campo: 'desde', mensaje: textoSuperpuesta(q(1)) }, String(id));
    }
  });
});

describe('corregir y borrar una licencia', () => {
  it('corregir cambia la fila y responde sin avisos', async () => {
    await listoParaCargar('adminA');
    const id = await conLicencia('adminA', { tipo: 'medica', desde: q(0), hasta: q(2), nota: 'Antes' });
    const res = await api.put(`/mi-espacio/licencias/${id}`, { tipo: 'familiar', desde: q(1), hasta: q(3), nota: 'Después' },
      como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, data: { id }, message: 'Licencia corregida.', avisos: [] });
    const [guardada] = await guardadasDe('adminA');
    assert.deepEqual([guardada.id, guardada.tipo, guardada.desde, guardada.hasta, guardada.nota],
      [id, 'familiar', q(1), q(3), 'Después']);
  });

  it('una corrección que no cierra no cambia nada: 400 con su campo', async () => {
    await listoParaCargar('adminA');
    const id = await conLicencia('adminA', { tipo: 'medica', desde: q(0), hasta: q(2) });
    await conLicencia('adminA', { tipo: 'familiar', desde: q(7), hasta: q(8) });
    for (const [cuerpo, esperado] of [
      [{ tipo: 'otro', desde: q(0), hasta: q(2) }, rechazo(MENSAJES_MI_ESPACIO.tipo, 'tipo')],
      [{ tipo: 'medica', desde: q(0), hasta: q(7) }, rechazo(textoSuperpuesta(q(7)), 'desde')]
    ]) {
      const res = await api.put(`/mi-espacio/licencias/${id}`, cuerpo, como('adminA'));
      assert.equal(res.status, 400, JSON.stringify(cuerpo));
      assert.deepEqual(res.body, esperado);
    }
    const [guardada] = await guardadasDe('adminA');
    assert.deepEqual([guardada.tipo, guardada.desde, guardada.hasta], ['medica', q(0), q(2)]);
  });

  it('lo ajeno es 404: el PUT y el DELETE de adminA sobre una de adminB, un id que no sirve, uno que no existe y una dada de baja',
    async () => {
      await listoParaCargar('adminA');
      const ajena = await conLicencia('adminB', { tipo: 'medica', desde: q(0), hasta: q(2) });
      const dadaDeBaja = await conLicencia('adminA', { tipo: 'medica', desde: q(7), activo: 0 });
      const cuerpo = { tipo: 'familiar', desde: q(0), hasta: q(0) };
      for (const id of [ajena, 'abc', '1e3', '0', '-1', '1.5', 999999, dadaDeBaja]) {
        const corregir = await api.put(`/mi-espacio/licencias/${id}`, cuerpo, como('adminA'));
        assert.equal(corregir.status, 404, `PUT ${id}`);
        assert.deepEqual(corregir.body, NO_ENCONTRADA, `PUT ${id}`);
        const borrar = await api.delete(`/mi-espacio/licencias/${id}`, como('adminA'));
        assert.equal(borrar.status, 404, `DELETE ${id}`);
        assert.deepEqual(borrar.body, NO_ENCONTRADA, `DELETE ${id}`);
      }
      // El 404 va antes que la validación: con un cuerpo que no sirve, también
      const invalida = await api.put(`/mi-espacio/licencias/${ajena}`, { tipo: 'otro' }, como('adminA'));
      assert.equal(invalida.status, 404);
      const [deB] = await guardadasDe('adminB');
      assert.deepEqual([deB.tipo, deB.desde, deB.hasta, Number(deB.activo)], ['medica', q(0), q(2), 1]);
      assert.equal(Number((await guardadasDe('adminA'))[0].activo), 0);
    });

  it('borrar es baja lógica: la fila queda con activo = 0 y deja de verse', async () => {
    await listoParaCargar('adminA');
    const id = await conLicencia('adminA', { tipo: 'medica', desde: q(0), hasta: q(2) });
    const res = await api.delete(`/mi-espacio/licencias/${id}`, como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, message: 'Licencia borrada.' });
    const [guardada] = await guardadasDe('adminA');
    assert.deepEqual([guardada.id, Number(guardada.activo)], [id, 0]);
    const lista = await api.get(`/mi-espacio/licencias?anio=${ANIO_Q}`, como('adminA'));
    assert.deepEqual(lista.body.data.licencias, []);
    // Ya dada de baja: 404, y sus días quedan libres
    assert.equal((await api.delete(`/mi-espacio/licencias/${id}`, como('adminA'))).status, 404);
    const otra = await api.post('/mi-espacio/licencias', { tipo: 'familiar', desde: q(0), hasta: q(2) }, como('adminA'));
    assert.equal(otra.status, 201, JSON.stringify(otra.body));
  });
});

describe('la lectura (services/miEspacioDatos.js)', () => {
  it('estadoDe: solo lo activo de la persona, con los números, las fechas y las horas de la base convertidos', async () => {
    await conArranque('adminA', hoy);
    await conAnio('adminA', ANIO, 20, 'universitario');
    await conSaldo('adminA', 'franquicias', ANIO, '8.0');
    await conSaldo('adminA', 'vacaciones', ANIO - 1, '15.0');
    const franquicia = await conLicencia('adminA', { tipo: 'franquicia', desde: q(1), horas: '7.5', nota: 'Trámite' });
    const medica = await conLicencia('adminA', { tipo: 'medica', desde: q(2), hasta: q(3) });
    await conLicencia('adminA', { tipo: 'familiar', desde: q(7), activo: 0 });
    await conLicencia('adminB', { tipo: 'familiar', desde: q(8) });
    const extra = await conHorasExtras('adminA', { fecha: q(2), desde: '19:00:00', hasta: '22:30:00' });
    await conHorasExtras('adminA', { fecha: q(3), desde: '19:00:00', hasta: '22:00:00', activo: 0 });

    const estado = await datos.estadoDe(usuarios.adminA.id);
    const licencia = (id, tipo, desde, hasta, horas, nota = null) => ({
      id, tipo, desde, hasta, horas, mostrar: 1, nota, licencia_oficial_id: null, oficial: null, sin_pasar: null
    });
    assert.deepEqual(estado, {
      modalidad: 'planta',
      arranque: hoy,
      anios: [{ anio: ANIO, dias_vacaciones: 20, estudios: 'universitario' }],
      saldos: [
        { concepto: 'vacaciones', anio: ANIO - 1, cantidad: 15 },
        { concepto: 'franquicias', anio: ANIO, cantidad: 8 }
      ],
      licencias: [licencia(franquicia, 'franquicia', q(1), q(1), 7.5, 'Trámite'), licencia(medica, 'medica', q(2), q(3), null)],
      horasExtras: [{ id: extra, fecha: q(2), desde: '19:00', hasta: '22:30', nota: null }]
    });
  });

  it('estadoDe: sin nada cargado ni vínculo, un estado vacío; de un id que no existe, también', async () => {
    const vacio = { modalidad: null, arranque: null, anios: [], saldos: [], licencias: [], horasExtras: [] };
    assert.deepEqual(await datos.estadoDe(usuarios.lector.id), vacio);
    assert.deepEqual(await datos.estadoDe(999999), vacio);
  });

  it('estadosDe: varias personas en lote, cada una con lo suyo', async () => {
    await conArranque('adminB', hoy);
    await conLicencia('adminA', { tipo: 'medica', desde: q(0) });
    await conLicencia('adminB', { tipo: 'familiar', desde: q(1) });
    await conHorasExtras('editor', { fecha: q(2), desde: '08:00:00', hasta: '10:00:00' });

    const estados = await datos.estadosDe([usuarios.adminA.id, usuarios.adminB.id, usuarios.editor.id, 999999]);
    assert.deepEqual([...estados.keys()].sort((a, b) => a - b),
      [usuarios.adminA.id, usuarios.adminB.id, usuarios.editor.id].sort((a, b) => a - b));
    assert.deepEqual(estados.get(usuarios.adminA.id).licencias.map(fila => fila.tipo), ['medica']);
    assert.deepEqual([estados.get(usuarios.adminB.id).arranque, estados.get(usuarios.adminB.id).licencias.map(fila => fila.tipo)],
      [hoy, ['familiar']]);
    assert.equal(estados.get(usuarios.editor.id).modalidad, 'contrato');
    assert.deepEqual(estados.get(usuarios.editor.id).horasExtras.map(fila => [fila.desde, fila.hasta]), [['08:00', '10:00']]);
    assert.equal((await datos.estadosDe([])).size, 0);
  });

  it('personaDe: las columnas de la persona, o null', async () => {
    assert.deepEqual(await datos.personaDe(usuarios.editor.id), {
      id: usuarios.editor.id, nombre_completo: 'Carla Benítez', rol: 'editor', vinculo: 'contrato',
      email: usuarios.editor.email, activo: 1
    });
    assert.equal(await datos.personaDe(999999), null);
  });

  it('feriadosPara: de tres años antes (o lo más viejo cargado) a dos años después (o lo más nuevo)', async () => {
    await conFeriado({ fecha: '2001-03-10', nombre: 'Feriado de prueba', se_repite: 1 });
    const enElAnio = (anio) => `${anio}-03-10`;
    const solos = await datos.feriadosPara([await datos.estadoDe(usuarios.adminA.id)], hoy);
    assert.ok(solos.has(enElAnio(ANIO - 3)) && solos.has(enElAnio(ANIO + 2)) && solos.has(`${ANIO - 3}-01-01`));
    assert.ok(!solos.has(enElAnio(ANIO - 4)) && !solos.has(enElAnio(ANIO + 3)));

    // Con una licencia vieja de una persona y unas horas extras lejanas de otra, el rango llega hasta ellas
    await conLicencia('adminA', { tipo: 'medica', desde: `${ANIO - 6}-05-04` });
    await conHorasExtras('adminB', { fecha: `${ANIO + 5}-05-04`, desde: '19:00:00', hasta: '20:00:00' });
    const estados = await datos.estadosDe([usuarios.adminA.id, usuarios.adminB.id]);
    for (const deLosEstados of [estados, [...estados.values()]]) {
      const conAmbas = await datos.feriadosPara(deLosEstados, hoy);
      assert.ok(conAmbas.has(enElAnio(ANIO - 6)) && conAmbas.has(enElAnio(ANIO + 5)));
      assert.ok(!conAmbas.has(enElAnio(ANIO - 7)) && !conAmbas.has(enElAnio(ANIO + 6)));
    }

    // Con las filas ya leídas no vuelve a leer: las que recibe son las que cuentan
    const sinLaTabla = await datos.feriadosPara([], hoy, []);
    assert.ok(sinLaTabla.has(`${ANIO}-12-25`) && !sinLaTabla.has(enElAnio(ANIO)));
  });

  it('contextoDe: la persona, lo que cargó, los feriados (con sus filas) y el cálculo', async () => {
    await conArranque('adminA', hoy);
    await conAnio('adminA', ANIO, 20);
    await conFeriado({ fecha: q(9), nombre: 'Feriado de prueba' });
    await conLicencia('adminA', { tipo: 'medica', desde: q(7), hasta: q(11) });
    const contexto = await datos.contextoDe(usuarios.adminA.id, hoy);
    assert.equal(contexto.persona.nombre_completo, 'Laura Gómez');
    assert.equal(contexto.estado.modalidad, 'planta');
    assert.ok(contexto.feriados instanceof Set && contexto.feriados.has(q(9)));
    assert.ok(contexto.filasFeriados.some(fila => fila.fecha === q(9)));
    // Cinco días de semana con un feriado en el medio: 4 días hábiles de atención médica (q(7) a q(11) nunca cruzan el año: el
    // 1/1 no es hábil)
    const medica = contexto.calculo.topes.find(uso => uso.tipo === 'medica');
    assert.deepEqual([medica.anio, medica.usados], [Number(q(7).slice(0, 4)), 4]);
  });
});
