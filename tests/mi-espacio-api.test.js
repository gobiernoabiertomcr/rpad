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
import { MENSAJES_MI_ESPACIO, camposDelSaldoInicial } from '../services/miEspacioReglas.js';

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

  it('los días y los estudios del año, con las mitades', async () => {
    await conAnio('adminA', 2026, 20, 'universitario');
    const res = await api.get('/mi-espacio/anio/2026', como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data, {
      anio: 2026, dias_vacaciones: 20, estudios: 'universitario', heredado: false,
      texto_mitades: 'Se habilitan en dos mitades: 10 el 1/7/2026 y 10 el 1/1/2027 (con 15, 8 y 7; con 25, 13 y 12). Cada '
        + 'licencia vence el 31/12 de dos años después.'
    });
  });

  it('sin los de ese año, los del anterior más cercano, heredados; con un número impar, la primera mitad es la mayor', async () => {
    await conAnio('adminA', 2024, 15, 'secundario');
    await conAnio('adminA', 2025, 20);
    const res = await api.get('/mi-espacio/anio/2027', como('adminA'));
    assert.deepEqual(res.body.data, {
      anio: 2027, dias_vacaciones: 20, estudios: null, heredado: true, texto_mitades: TEXTO_CON_20(2027)
    });
    const impar = await api.get('/mi-espacio/anio/2024', como('adminA'));
    assert.equal(impar.body.data.heredado, false);
    assert.match(impar.body.data.texto_mitades, /^Se habilitan en dos mitades: 8 el 1\/7\/2024 y 7 el 1\/1\/2025 \(/);
  });

  it('sin ningún año elegido, sin días ni estudios', async () => {
    const res = await api.get(`/mi-espacio/anio/${ANIO}`, como('adminA'));
    assert.deepEqual(res.body.data, {
      anio: ANIO, dias_vacaciones: null, estudios: null, heredado: false,
      texto_mitades: `Se habilitan en dos mitades: la mitad el 1/7/${ANIO} y la otra mitad el 1/1/${ANIO + 1} (con 15, 8 y 7; `
        + 'con 25, 13 y 12). Cada licencia vence el 31/12 de dos años después.'
    });
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
