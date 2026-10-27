// Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, secciones 5, 10 y 11): la API, contra una base de prueba propia.
// Todas las rutas trabajan sobre la persona de la sesión: lo de otra nunca se ve, salvo «Hoy no están» (sección 7: quién no
// está, sin el tipo) y lo que necesita el campo del firmante titular (sección 6). Sin modalidad (sin vínculo cargado), las
// lecturas responden 200 con `modalidad: null` y el mensaje que lo dice. Lo que llega de la base como texto (los DECIMAL, los
// TIME y las fechas) sale como número, 'HH:MM' y 'AAAA-MM-DD' (Review Focus 2). La lectura (services/miEspacioDatos.js) se
// prueba también directo. La API usa la fecha real: las fechas de los tests se arman desde hoy.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query, mailpit
} from './helpers.js';
import { asegurarBaseDePrueba } from './notas-fixtures.js';
import {
  hoyArgentina, sumarDias, esDiaHabil, FERIADOS_FIJOS, proximoDiaHabil, diaHabilAnterior, formatoCorto
} from '../services/notasDigitalesCalendario.js';
import {
  MENSAJES_MI_ESPACIO, DIAS_VACACIONES, camposDelSaldoInicial, textoDeLasMitades, textoSuperpuesta, textoTope,
  textoHorarioSuperpuesto, textoSaldo, mesMas, mesEnFrase,
  textoSinNoUtilizadas, textoAutorizadaSinDias, AVISO_DEL_PASO, AVISO_DEL_PASO_SUPERADMIN, AVISO_NOTAS_DE_HOY,
  AVISO_SIN_PERSONA_A_CARGO, textoSuperpuestaConConfiguracion, textoNoPaso, textoYaNoCubierta, textoEnConfiguracion,
  textoUnida, textoSigueEnConfiguracion, TEXTO_TAMBIEN_EN_CONFIGURACION, TEXTO_NO_SE_COPIA,
  TEXTO_ANULADA_POR_ADMINISTRACION, TEXTO_NO_DIA_ENTERO
} from '../services/miEspacioReglas.js';

let base, servidor, api, usuarios, dbReal, emailSoloA, datos, pool, firmas, controlador;
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
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba (firmaParaFecha, el de las Notas Digitales, para
  // ver cómo salen las notas con las licencias que pasaron a Configuración). Nada de acá manda emails: igual, sin barrera
  emailSoloA = process.env.EMAIL_SOLO_A;
  process.env.EMAIL_SOLO_A = '';
  datos = await import('../services/miEspacioDatos.js');
  firmas = await import('../services/notasDigitalesFirmas.js');
  controlador = await import('../controllers/miEspacioController.js');
  pool = (await import('../config/database.js')).default;
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await pool?.end();
  await cerrarDb();
  await servidor?.detener();
  if (emailSoloA === undefined) delete process.env.EMAIL_SOLO_A;
  else process.env.EMAIL_SOLO_A = emailSoloA;
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
const conLicencia = async (clave, { tipo, desde, hasta = desde, horas = null, nota = null, activo = 1, mostrar = 1 }) =>
  (await query(
    `INSERT INTO mi_espacio_licencias (usuario_id, tipo, desde, hasta, horas, nota, activo, mostrar)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [usuarios[clave].id, tipo, desde, hasta, horas, nota, activo, mostrar]
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
    assert.deepEqual(data.hoy_y_manana.ausentes_hoy, []);
    assert.deepEqual(data.hoy_y_manana.ausentes_manana, []);
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
      success: true, data: { error: { campo: 'tipo', mensaje: MENSAJES_MI_ESPACIO.tipo }, vista: null, paso: null }
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

// El paso a Configuración → Licencias (spec, sección 6): las ausencias de día entero de quien puede tener licencia pasan a
// usuarios_licencias en la misma transacción, solo con las fechas, con la persona como actor y sin el aviso al superadmin
// La firma con imagen (sin ella no se puede autorizar a nadie: autorizables) y el firmante titular de las Notas Digitales
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64');
const conFirma = (clave) => query(
  "INSERT INTO usuarios_firmas (usuario_id, nombre, cargo, imagen, mime) VALUES (?, 'Firma', 'Cargo', ?, 'image/png')",
  [usuarios[clave].id, PNG]
);
const comoTitular = (clave) => query('UPDATE notas_digitales_config SET firmante_usuario_id = ?', [usuarios[clave].id]);

describe('el paso a Configuración', () => {
  beforeEach(async () => {
    await query("DELETE FROM usuarios_auditoria WHERE accion IN ('licencia_cargada', 'licencia_editada', 'licencia_anulada')");
    await query('DELETE FROM usuarios_firmas');
    await query('UPDATE notas_digitales_config SET firmante_usuario_id = NULL');
  });

  // Para cargar vacaciones: el arranque, el año y 20 días de la licencia del año anterior
  const listoParaVacaciones = async (clave) => {
    await listoParaCargar(clave);
    await conSaldo(clave, 'vacaciones', ANIO - 1, '20.0');
  };
  // Las licencias de Configuración de una persona, y sus filas de Mi espacio con el vínculo
  const deConfiguracion = (clave) => query(
    `SELECT id, usuario_id, DATE_FORMAT(desde, '%Y-%m-%d') AS desde, DATE_FORMAT(hasta, '%Y-%m-%d') AS hasta, autorizado_id,
       autorizado_at, nota_autorizacion_id, anulada, creado_por, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
     FROM usuarios_licencias WHERE usuario_id = ? ORDER BY desde, id`,
    [usuarios[clave].id]
  );
  const vinculosDe = (clave) => query(
    `SELECT id, tipo, DATE_FORMAT(desde, '%Y-%m-%d') AS desde, DATE_FORMAT(hasta, '%Y-%m-%d') AS hasta, licencia_oficial_id,
       oficial, sin_pasar, activo
     FROM mi_espacio_licencias WHERE usuario_id = ? ORDER BY id`,
    [usuarios[clave].id]
  );
  const vinculoDe = ({ licencia_oficial_id: oficialId, oficial, sin_pasar: sinPasar }) => [oficialId, oficial, sinPasar];
  const historialDe = (clave, accion) => query(
    'SELECT actor_id, detalle FROM usuarios_auditoria WHERE usuario_id = ? AND accion = ? ORDER BY id', [usuarios[clave].id, accion]
  );
  // Una licencia que cargó administración en Configuración
  const deAdministracion = async (clave, desde, hasta) => (await query(
    'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, creado_por) VALUES (?, ?, ?, ?)',
    [usuarios[clave].id, desde, hasta, usuarios.adminB.id]
  )).insertId;
  const cargarMia = (clave, cuerpo) => api.post('/mi-espacio/licencias', cuerpo, como(clave));
  const corregirMia = (clave, id, cuerpo) => api.put(`/mi-espacio/licencias/${id}`, cuerpo, como(clave));
  const calcularMia = (clave, cuerpo) => api.post('/mi-espacio/licencias/calculo', cuerpo, como(clave));
  // La fila de la lista de un año (sin año, el de las fechas de los tests)
  const filaDeLaLista = async (clave, id, anio = ANIO_Q) => {
    const res = await api.get(`/mi-espacio/licencias?anio=${anio}`, como(clave));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data.licencias.find((fila) => fila.id === id);
  };
  // El lector, con vínculo para poder cargar (sin él, todo da sinModalidad)
  const conLectorConVinculo = async (prueba) => {
    await query('UPDATE usuarios SET vinculo = ? WHERE id = ?', ['contrato', usuarios.lector.id]);
    try {
      await prueba();
    } finally {
      await query("UPDATE usuarios SET vinculo = NULL, rol = 'lector' WHERE id = ?", [usuarios.lector.id]);
    }
  };

  it('alta: unas vacaciones pasan a Configuración, cargadas por la misma persona, con su historial y sin ningún email', async () => {
    await mailpit.vaciar();
    await listoParaVacaciones('adminA');
    const res = await cargarMia('adminA', { tipo: 'vacaciones', desde: q(0), hasta: q(4) });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(Object.keys(res.body).sort(), ['data', 'message', 'success']);

    const oficiales = await deConfiguracion('adminA');
    assert.equal(oficiales.length, 1);
    const [oficial] = oficiales;
    assert.deepEqual([oficial.usuario_id, oficial.creado_por, oficial.desde, oficial.hasta, oficial.autorizado_id, oficial.anulada],
      [usuarios.adminA.id, usuarios.adminA.id, q(0), q(4), null, 0]);
    const [mia] = await vinculosDe('adminA');
    assert.deepEqual(vinculoDe(mia), [oficial.id, 'creada', null]);
    const [cargada] = await historialDe('adminA', 'licencia_cargada');
    assert.equal(cargada.actor_id, usuarios.adminA.id);

    const fila = await filaDeLaLista('adminA', res.body.data.id);
    assert.deepEqual(fila.configuracion, { texto: TEXTO_TAMBIEN_EN_CONFIGURACION, insignia: 'creada' });
    assert.deepEqual([fila.puede_borrar, fila.solo_hasta, fila.fechas_fijas], [true, false, false]);

    // La del superadmin también pasa, y tampoco sale el aviso al superadmin (el cambio es suyo)
    await listoParaVacaciones('superadmin');
    const delSuperadmin = await cargarMia('superadmin', { tipo: 'vacaciones', desde: q(7), hasta: q(8) });
    assert.equal(delSuperadmin.status, 201, JSON.stringify(delSuperadmin.body));
    assert.deepEqual((await deConfiguracion('superadmin')).map((l) => [l.desde, l.hasta, l.creado_por]),
      [[q(7), q(8), usuarios.superadmin.id]]);
    await new Promise((listo) => setTimeout(listo, 500));
    assert.deepEqual(await mailpit.mensajes(), []);
  });

  it('no pasa: lo del lector, una franquicia de menos de 7 horas y lo ya terminado', async () => {
    await conLectorConVinculo(async () => {
      await listoParaCargar('lector');
      const delLector = await cargarMia('lector', { tipo: 'medica', desde: q(0), hasta: q(1) });
      assert.equal(delLector.status, 201, JSON.stringify(delLector.body));
      assert.deepEqual(await deConfiguracion('lector'), []);
      assert.equal((await filaDeLaLista('lector', delLector.body.data.id)).configuracion, null);
    });

    await listoParaCargar('adminA');
    const tres = await cargarMia('adminA', { tipo: 'franquicia', desde: q(1), horas: 3 });
    const siete = await cargarMia('adminA', { tipo: 'franquicia', desde: q(2), horas: 7 });
    const terminada = await cargarMia('adminA', { tipo: 'medica', desde: dia(-10), hasta: dia(-6) });
    assert.deepEqual([tres.status, siete.status, terminada.status], [201, 201, 201]);
    assert.deepEqual((await deConfiguracion('adminA')).map((l) => [l.desde, l.hasta]), [[q(2), q(2)]]);
    assert.deepEqual((await filaDeLaLista('adminA', tres.body.data.id)).configuracion,
      { texto: TEXTO_NO_DIA_ENTERO, insignia: 'aviso' });
    assert.deepEqual((await filaDeLaLista('adminA', siete.body.data.id)).configuracion,
      { texto: TEXTO_TAMBIEN_EN_CONFIGURACION, insignia: 'creada' });
    assert.equal((await filaDeLaLista('adminA', terminada.body.data.id, ANIO)).configuracion, null);
  });

  it('cubierta por una de administración queda unida; superpuesta en parte, se guarda sin pasar', async () => {
    await listoParaCargar('adminA');
    const deAdmin = await deAdministracion('adminA', q(0), q(9));
    const unida = await cargarMia('adminA', { tipo: 'medica', desde: q(2), hasta: q(3) });
    assert.equal(unida.status, 201, JSON.stringify(unida.body));
    assert.equal((await deConfiguracion('adminA')).length, 1);
    assert.deepEqual(vinculoDe((await vinculosDe('adminA'))[0]), [deAdmin, 'unida', null]);
    assert.deepEqual((await filaDeLaLista('adminA', unida.body.data.id)).configuracion,
      { texto: textoUnida(q(0), q(9)), insignia: 'unida' });

    const superpuesta = await cargarMia('adminA', { tipo: 'medica', desde: q(8), hasta: q(11) });
    assert.equal(superpuesta.status, 201, JSON.stringify(superpuesta.body));
    const guardada = (await vinculosDe('adminA')).find((fila) => fila.id === superpuesta.body.data.id);
    assert.deepEqual(vinculoDe(guardada), [null, null, textoSuperpuestaConConfiguracion(q(0), q(9))]);
    assert.match(guardada.sin_pasar,
      /^Se superpone con una licencia de Configuración del \d{2}\/\d{2} al \d{2}\/\d{2}: revisala con administración$/);
    assert.deepEqual((await filaDeLaLista('adminA', superpuesta.body.data.id)).configuracion,
      { texto: textoNoPaso(guardada.sin_pasar), insignia: 'aviso' });
    // Ninguna de las dos creó otra licencia en Configuración
    assert.equal((await deConfiguracion('adminA')).length, 1);
    assert.deepEqual(await historialDe('adminA', 'licencia_cargada'), []);
  });

  it('corregir antes de empezar: las fechas mueven la de Configuración; el tipo, la nota o «Mostrar», no', async () => {
    await listoParaCargar('adminA');
    const { body } = await cargarMia('adminA', { tipo: 'medica', desde: q(0), hasta: q(2) });
    const { id } = body.data;
    const [antes] = await deConfiguracion('adminA');
    // Como si ya hubiera salido la nota de autorización, y con una fecha vieja para ver si se escribe
    await query("UPDATE usuarios_licencias SET nota_autorizacion_id = 999, updated_at = '2020-01-01 00:00:00' WHERE id = ?",
      [antes.id]);

    const sinFechas = await corregirMia('adminA', id, { tipo: 'familiar', desde: q(0), hasta: q(2), nota: 'Turno', mostrar: false });
    assert.equal(sinFechas.status, 200, JSON.stringify(sinFechas.body));
    assert.deepEqual(sinFechas.body.avisos, []);
    const [igual] = await deConfiguracion('adminA');
    assert.deepEqual([igual.updated_at, igual.nota_autorizacion_id, igual.desde, igual.hasta],
      ['2020-01-01 00:00:00', 999, q(0), q(2)]);
    assert.deepEqual(await historialDe('adminA', 'licencia_editada'), []);

    const conFechas = await corregirMia('adminA', id, { tipo: 'familiar', desde: q(1), hasta: q(3) });
    assert.equal(conFechas.status, 200, JSON.stringify(conFechas.body));
    const [movida] = await deConfiguracion('adminA');
    assert.deepEqual([movida.id, movida.desde, movida.hasta, movida.nota_autorizacion_id], [antes.id, q(1), q(3), null]);
    const [editada] = await historialDe('adminA', 'licencia_editada');
    assert.equal(editada.actor_id, usuarios.adminA.id);
    assert.deepEqual((await filaDeLaLista('adminA', id)).configuracion,
      { texto: TEXTO_TAMBIEN_EN_CONFIGURACION, insignia: 'creada' });
  });

  it('cruza el arranque y ya empezó: pasa; el desde queda fijo, el hasta se copia y no se puede borrar (Review Focus 4)',
    async () => {
      await listoParaCargar('adminA');
      const res = await cargarMia('adminA', { tipo: 'medica', desde: dia(-3), hasta: dia(3) });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.deepEqual((await deConfiguracion('adminA')).map((l) => [l.desde, l.hasta]), [[dia(-3), dia(3)]]);
      const { id } = res.body.data;
      const fila = await filaDeLaLista('adminA', id, ANIO);
      assert.deepEqual([fila.puede_borrar, fila.solo_hasta, fila.fechas_fijas], [false, true, false]);

      const otroDesde = await corregirMia('adminA', id, { tipo: 'medica', desde: dia(-2), hasta: dia(3) });
      assert.equal(otroDesde.status, 400);
      assert.deepEqual(otroDesde.body, { success: false, error: MENSAJES_MI_ESPACIO.soloHasta, campo: 'desde' });
      assert.deepEqual((await vinculosDe('adminA')).map((l) => [l.desde, l.hasta]), [[dia(-3), dia(3)]]);

      const otroHasta = await corregirMia('adminA', id, { tipo: 'medica', desde: dia(-3), hasta: dia(5) });
      assert.equal(otroHasta.status, 200, JSON.stringify(otroHasta.body));
      assert.deepEqual((await deConfiguracion('adminA')).map((l) => [l.desde, l.hasta]), [[dia(-3), dia(5)]]);

      const borrar = await api.delete(`/mi-espacio/licencias/${id}`, como('adminA'));
      assert.equal(borrar.status, 409);
      assert.deepEqual(borrar.body, { success: false, error: 'Ya empezó: no se puede borrar', campo: null });
      assert.equal(Number((await vinculosDe('adminA'))[0].activo), 1);
      assert.equal((await deConfiguracion('adminA'))[0].anulada, 0);
    });

  it('borrar una que todavía no empezó anula la de Configuración', async () => {
    await listoParaCargar('adminA');
    const { body } = await cargarMia('adminA', { tipo: 'medica', desde: q(0), hasta: q(1) });
    const res = await api.delete(`/mi-espacio/licencias/${body.data.id}`, como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, message: 'Licencia borrada.' });
    assert.equal((await deConfiguracion('adminA'))[0].anulada, 1);
    const [anulada] = await historialDe('adminA', 'licencia_anulada');
    assert.equal(anulada.actor_id, usuarios.adminA.id);
    assert.equal(Number((await vinculosDe('adminA'))[0].activo), 0);
  });

  it('administración la anula en Configuración: la fila lo dice y una corrección no la toca', async () => {
    await listoParaCargar('adminA');
    const { body } = await cargarMia('adminA', { tipo: 'medica', desde: q(0), hasta: q(2) });
    const [oficial] = await deConfiguracion('adminA');
    const anular = await api.post(`/usuarios/licencias/${oficial.id}/anular`, {}, como('adminB'));
    assert.equal(anular.status, 200, JSON.stringify(anular.body));
    assert.deepEqual((await filaDeLaLista('adminA', body.data.id)).configuracion,
      { texto: TEXTO_ANULADA_POR_ADMINISTRACION, insignia: 'aviso' });

    const antes = await deConfiguracion('adminA');
    const res = await corregirMia('adminA', body.data.id, { tipo: 'medica', desde: q(1), hasta: q(3) });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(await deConfiguracion('adminA'), antes);
    assert.deepEqual((await filaDeLaLista('adminA', body.data.id)).configuracion,
      { texto: TEXTO_ANULADA_POR_ADMINISTRACION, insignia: 'aviso' });
    // Y se borra sin tocarla
    assert.equal((await api.delete(`/mi-espacio/licencias/${body.data.id}`, como('adminA'))).status, 200);
    assert.deepEqual(await deConfiguracion('adminA'), antes);
  });

  it('administración le cambia las fechas: la fila dice dónde quedó y lo que se corrige acá ya no se copia', async () => {
    await listoParaCargar('adminA');
    const { body } = await cargarMia('adminA', { tipo: 'medica', desde: q(0), hasta: q(2) });
    const [oficial] = await deConfiguracion('adminA');
    const cambio = await api.put(`/usuarios/licencias/${oficial.id}`, { desde: q(1), hasta: q(4) }, como('adminB'));
    assert.equal(cambio.status, 200, JSON.stringify(cambio.body));
    const { configuracion } = await filaDeLaLista('adminA', body.data.id);
    assert.ok(configuracion.texto.startsWith(textoEnConfiguracion(q(1), q(4))), configuracion.texto);
    assert.deepEqual(configuracion, { texto: `${textoEnConfiguracion(q(1), q(4))} ${TEXTO_NO_SE_COPIA}`, insignia: 'aviso' });

    const res = await corregirMia('adminA', body.data.id, { tipo: 'medica', desde: q(0), hasta: q(1) });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.avisos, [TEXTO_NO_SE_COPIA]);
    assert.deepEqual((await deConfiguracion('adminA')).map((l) => [l.desde, l.hasta]), [[q(1), q(4)]]);
  });

  it('administración acorta la que cubría una unida: ya no está cubierta', async () => {
    await listoParaCargar('adminA');
    const deAdmin = await deAdministracion('adminA', q(0), q(9));
    const { body } = await cargarMia('adminA', { tipo: 'medica', desde: q(2), hasta: q(3) });
    const cambio = await api.put(`/usuarios/licencias/${deAdmin}`, { desde: q(0), hasta: q(2) }, como('adminB'));
    assert.equal(cambio.status, 200, JSON.stringify(cambio.body));
    assert.deepEqual((await filaDeLaLista('adminA', body.data.id)).configuracion,
      { texto: textoYaNoCubierta(q(3), q(3)), insignia: 'aviso' });
  });

  it('la franquicia de 7 horas que pasa a 3, antes de empezar: la de Configuración se anula y el vínculo queda vacío', async () => {
    await listoParaCargar('adminA');
    const { body } = await cargarMia('adminA', { tipo: 'franquicia', desde: q(1), horas: 7 });
    const res = await corregirMia('adminA', body.data.id, { tipo: 'franquicia', desde: q(1), horas: 3 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await deConfiguracion('adminA'))[0].anulada, 1);
    assert.deepEqual(vinculoDe((await vinculosDe('adminA'))[0]), [null, null, null]);
    assert.deepEqual((await filaDeLaLista('adminA', body.data.id)).configuracion,
      { texto: TEXTO_NO_DIA_ENTERO, insignia: 'aviso' });
  });

  it('la franquicia de 7 horas que pasa a 3, si ya empezó: la de Configuración queda y la fila lo dice', async () => {
    // Las dos filas por SQL: el paso solo crea las que terminan hoy o después
    await listoParaCargar('adminA');
    const ayer = diaHabilAnterior(hoy);
    const oficial = await deAdministracion('adminA', ayer, ayer);
    const { insertId: id } = await query(
      `INSERT INTO mi_espacio_licencias (usuario_id, tipo, desde, hasta, horas, licencia_oficial_id, oficial)
       VALUES (?, 'franquicia', ?, ?, '7.0', ?, 'creada')`,
      [usuarios.adminA.id, ayer, ayer, oficial]
    );
    const res = await corregirMia('adminA', id, { tipo: 'franquicia', desde: ayer, horas: 3 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await deConfiguracion('adminA'))[0].anulada, 0);
    assert.deepEqual(vinculoDe((await vinculosDe('adminA'))[0]), [oficial, 'creada', null]);
    assert.deepEqual((await filaDeLaLista('adminA', id, Number(ayer.slice(0, 4)))).configuracion,
      { texto: textoSigueEnConfiguracion(ayer, ayer), insignia: 'aviso' });
  });

  it('el rol del momento: lo del lector no pasa; si pasa a admin, aparece en Configuración recién al corregirla', async () => {
    await conLectorConVinculo(async () => {
      await listoParaCargar('lector');
      const { body } = await cargarMia('lector', { tipo: 'medica', desde: q(0), hasta: q(1) });
      assert.deepEqual(await deConfiguracion('lector'), []);
      await query("UPDATE usuarios SET rol = 'admin' WHERE id = ?", [usuarios.lector.id]);
      // Cambiar el rol no mueve nada solo
      assert.deepEqual(await deConfiguracion('lector'), []);
      const res = await corregirMia('lector', body.data.id, { tipo: 'medica', desde: q(0), hasta: q(1), nota: 'Ahora sí' });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual((await deConfiguracion('lector')).map((l) => [l.desde, l.hasta, l.creado_por]),
        [[q(0), q(1), usuarios.lector.id]]);
      assert.equal((await vinculosDe('lector'))[0].oficial, 'creada');
    });
  });

  it('el firmante titular deja a alguien a cargo de sus vacaciones: la de Configuración lo lleva, con la hora', async () => {
    await comoTitular('adminB');
    await conFirma('adminA');
    await listoParaVacaciones('adminB');
    const res = await cargarMia('adminB', { tipo: 'vacaciones', desde: q(0), hasta: q(4), autorizado_id: usuarios.adminA.id });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const [oficial] = await deConfiguracion('adminB');
    assert.equal(oficial.autorizado_id, usuarios.adminA.id);
    assert.notEqual(oficial.autorizado_at, null);
    // Una persona que no es el titular no puede dejar a nadie a cargo (lo controla Configuración), y no se guarda nada
    await listoParaVacaciones('adminA');
    await conFirma('editor');
    const deOtra = await cargarMia('adminA', { tipo: 'vacaciones', desde: q(7), hasta: q(8), autorizado_id: usuarios.editor.id });
    assert.equal(deOtra.status, 400, JSON.stringify(deOtra.body));
    assert.deepEqual(deOtra.body, {
      success: false, error: 'Solo la licencia del firmante titular de las notas lleva una persona autorizada.', campo: 'autorizado_id'
    });
    assert.deepEqual([await vinculosDe('adminA'), await deConfiguracion('adminA')], [[], []]);
  });

  it('el caso del usuario: vacaciones con persona a cargo y una médica sin nadie dan dos licencias, y así salen las notas',
    async () => {
      await comoTitular('adminB');
      await conFirma('adminA');
      await listoParaVacaciones('adminB');
      const vacaciones = await cargarMia('adminB',
        { tipo: 'vacaciones', desde: q(0), hasta: q(8), autorizado_id: usuarios.adminA.id });
      const medica = await cargarMia('adminB', { tipo: 'medica', desde: q(9), hasta: q(10) });
      assert.deepEqual([vacaciones.status, medica.status], [201, 201], JSON.stringify([vacaciones.body, medica.body]));
      assert.deepEqual((await deConfiguracion('adminB')).map((l) => [l.desde, l.hasta, l.autorizado_id]),
        [[q(0), q(8), usuarios.adminA.id], [q(9), q(10), null]]);
      const config = { firmante_usuario_id: usuarios.adminB.id };
      assert.equal((await firmas.firmaParaFecha(config, q(3))).modo, 'autorizado');
      assert.equal((await firmas.firmaParaFecha(config, q(9))).modo, 'sin_autorizado');
    });

  it('solo las vacaciones dejan persona a cargo: en otro tipo, 400 en autorizado_id; sin el campo, pasa sin nadie', async () => {
    await comoTitular('adminB');
    await conFirma('adminA');
    await listoParaCargar('adminB');
    const sinVacaciones = { success: false, error: MENSAJES_MI_ESPACIO.autorizadoSoloVacaciones, campo: 'autorizado_id' };
    for (const cuerpo of [{ tipo: 'medica', desde: q(0), hasta: q(1) }, { tipo: 'franquicia', desde: q(2), horas: 7 }]) {
      const conPersona = await cargarMia('adminB', { ...cuerpo, autorizado_id: usuarios.adminA.id });
      assert.equal(conPersona.status, 400, JSON.stringify(cuerpo));
      assert.deepEqual(conPersona.body, sinVacaciones);
      assert.deepEqual([await vinculosDe('adminB'), await deConfiguracion('adminB')], [[], []]);
    }
    const medica = await cargarMia('adminB', { tipo: 'medica', desde: q(0), hasta: q(1) });
    const franquicia = await cargarMia('adminB', { tipo: 'franquicia', desde: q(2), horas: 7 });
    assert.deepEqual([medica.status, franquicia.status], [201, 201]);
    assert.deepEqual((await deConfiguracion('adminB')).map((l) => [l.desde, l.hasta, l.autorizado_id]),
      [[q(0), q(1), null], [q(2), q(2), null]]);
    // Al corregir, igual; null (nadie) sí se acepta
    const corregida = await corregirMia('adminB', medica.body.data.id,
      { tipo: 'medica', desde: q(0), hasta: q(1), autorizado_id: usuarios.adminA.id });
    assert.equal(corregida.status, 400);
    assert.deepEqual(corregida.body, sinVacaciones);
    const sinNadie = await corregirMia('adminB', medica.body.data.id, { tipo: 'medica', desde: q(0), hasta: q(1), autorizado_id: null });
    assert.equal(sinNadie.status, 200, JSON.stringify(sinNadie.body));
  });

  it('el cálculo previo dice qué pasa: al titular, las notas de hoy, la víspera y si queda alguien a cargo', async () => {
    await comoTitular('adminB');
    await listoParaVacaciones('adminB');
    const deHoy = await calcularMia('adminB', { tipo: 'vacaciones', desde: hoy, hasta: dia(4) });
    assert.equal(deHoy.status, 200, JSON.stringify(deHoy.body));
    assert.equal(deHoy.body.data.error, null);
    assert.deepEqual(deHoy.body.data.paso, {
      pasa: true, avisos: [AVISO_DEL_PASO, AVISO_NOTAS_DE_HOY],
      firmante: { soy_titular: true, puede_autorizar: true, vispera: diaHabilAnterior(hoy), notas_de_hoy: true },
      sin_pasar_previsto: null
    });
    const medica = await calcularMia('adminB', { tipo: 'medica', desde: q(0), hasta: q(1) });
    assert.deepEqual(medica.body.data.paso.avisos, [AVISO_DEL_PASO, AVISO_SIN_PERSONA_A_CARGO]);
    assert.equal(medica.body.data.paso.firmante.puede_autorizar, false);
    const vacaciones = await calcularMia('adminB', { tipo: 'vacaciones', desde: q(0), hasta: q(4) });
    assert.deepEqual(vacaciones.body.data.paso.avisos, [AVISO_DEL_PASO]);
    assert.deepEqual(vacaciones.body.data.paso.firmante,
      { soy_titular: true, puede_autorizar: true, vispera: diaHabilAnterior(q(0)), notas_de_hoy: false });

    await listoParaVacaciones('superadmin');
    const delSuperadmin = await calcularMia('superadmin', { tipo: 'vacaciones', desde: q(0), hasta: q(4) });
    assert.deepEqual(delSuperadmin.body.data.paso,
      { pasa: true, avisos: [AVISO_DEL_PASO, AVISO_DEL_PASO_SUPERADMIN], firmante: null, sin_pasar_previsto: null });

    await conLectorConVinculo(async () => {
      await listoParaCargar('lector');
      const delLector = await calcularMia('lector', { tipo: 'medica', desde: q(0), hasta: q(1) });
      assert.deepEqual(delLector.body.data.paso, { pasa: false, avisos: [], firmante: null, sin_pasar_previsto: null });
    });

    // Una de administración que la cubre: no pasa, y dice dónde está
    await listoParaCargar('adminA');
    await deAdministracion('adminA', q(0), q(9));
    const cubierta = await calcularMia('adminA', { tipo: 'medica', desde: q(2), hasta: q(3) });
    assert.deepEqual(cubierta.body.data.paso,
      { pasa: false, avisos: [], firmante: null, sin_pasar_previsto: textoUnida(q(0), q(9)) });
    // Nada se guardó
    assert.deepEqual([await vinculosDe('adminB'), await deConfiguracion('adminB')], [[], []]);
  });

  it('las vacaciones del titular con persona a cargo, lejos: cambiar el tipo le saca la persona a cargo', async () => {
    await comoTitular('adminB');
    await conFirma('adminA');
    await listoParaVacaciones('adminB');
    const { body } = await cargarMia('adminB', { tipo: 'vacaciones', desde: q(0), hasta: q(4), autorizado_id: usuarios.adminA.id });
    const aMedica = { tipo: 'medica', desde: q(0), hasta: q(4) };
    const calculo = await calcularMia('adminB', { ...aMedica, id: body.data.id });
    assert.equal(calculo.body.data.error, null);
    assert.ok(calculo.body.data.paso.avisos.includes(AVISO_SIN_PERSONA_A_CARGO), JSON.stringify(calculo.body.data.paso));

    const res = await corregirMia('adminB', body.data.id, aMedica);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const [oficial] = await deConfiguracion('adminB');
    assert.deepEqual([oficial.desde, oficial.hasta, oficial.autorizado_id, oficial.autorizado_at], [q(0), q(4), null, null]);
    assert.equal((await historialDe('adminB', 'licencia_editada')).length, 1);
  });

  // El formulario precarga la persona a cargo y manda autorizado_id solo si se cambió (Ruling de la Task 17): sin la clave, la
  // corrección conserva la de Configuración
  it('el titular corrige el hasta de sus vacaciones sin mandar autorizado_id: la persona a cargo sigue', async () => {
    await comoTitular('adminB');
    await conFirma('adminA');
    await listoParaVacaciones('adminB');
    const { body } = await cargarMia('adminB', { tipo: 'vacaciones', desde: q(0), hasta: q(4), autorizado_id: usuarios.adminA.id });
    assert.ok(body.success, JSON.stringify(body));
    const [antes] = await deConfiguracion('adminB');
    // La lista le da al formulario la persona a cargo y el id de la licencia de Configuración
    assert.deepEqual((await filaDeLaLista('adminB', body.data.id)).en_configuracion,
      { licencia_id: antes.id, autorizado_id: usuarios.adminA.id });

    const res = await corregirMia('adminB', body.data.id, { tipo: 'vacaciones', desde: q(0), hasta: q(8) });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const [despues] = await deConfiguracion('adminB');
    assert.deepEqual([despues.id, despues.desde, despues.hasta, despues.autorizado_id], [antes.id, q(0), q(8), usuarios.adminA.id]);
    assert.deepEqual(despues.autorizado_at, antes.autorizado_at);
    // Una creada sin persona a cargo: el id de Configuración, sin nadie
    await listoParaCargar('adminA');
    const medica = await cargarMia('adminA', { tipo: 'medica', desde: q(0), hasta: q(1) });
    const [deAdminA] = await deConfiguracion('adminA');
    assert.deepEqual((await filaDeLaLista('adminA', medica.body.data.id)).en_configuracion,
      { licencia_id: deAdminA.id, autorizado_id: null });
  });

  it('las vacaciones del titular con persona a cargo que empiezan el próximo día hábil: el tipo queda fijo', async () => {
    await comoTitular('adminB');
    await conFirma('adminA');
    await listoParaVacaciones('adminB');
    const pronto = proximoDiaHabil(sumarDias(hoy, 1));
    const fechas = { desde: pronto, hasta: sumarDias(pronto, 2) };
    const { body } = await cargarMia('adminB', { tipo: 'vacaciones', ...fechas, autorizado_id: usuarios.adminA.id });
    assert.ok(body.success, JSON.stringify(body));
    const antes = [await vinculosDe('adminB'), await deConfiguracion('adminB')];

    const res = await corregirMia('adminB', body.data.id, { tipo: 'medica', ...fechas });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { success: false, error: MENSAJES_MI_ESPACIO.tipoFijo, campo: 'tipo' });
    assert.deepEqual([await vinculosDe('adminB'), await deConfiguracion('adminB')], antes);
    const calculo = await calcularMia('adminB', { tipo: 'medica', ...fechas, id: body.data.id });
    assert.deepEqual(calculo.body.data.error, { campo: 'tipo', mensaje: MENSAJES_MI_ESPACIO.tipoFijo });
    // Siguen siendo vacaciones: se corrigen
    const nota = await corregirMia('adminB', body.data.id, { tipo: 'vacaciones', ...fechas, nota: 'Viaje' });
    assert.equal(nota.status, 200, JSON.stringify(nota.body));
  });

  it('sin persona a cargo, o de otra persona, unas vacaciones cambian de tipo cualquier día, sin tocar Configuración', async () => {
    await comoTitular('adminB');
    const pronto = proximoDiaHabil(sumarDias(hoy, 1));
    const fechas = { desde: pronto, hasta: sumarDias(pronto, 2) };
    for (const clave of ['adminB', 'adminA']) {
      await listoParaVacaciones(clave);
      const { body } = await cargarMia(clave, { tipo: 'vacaciones', ...fechas });
      assert.ok(body.success, JSON.stringify(body));
      const antes = await deConfiguracion(clave);
      const res = await corregirMia(clave, body.data.id, { tipo: 'medica', ...fechas });
      assert.equal(res.status, 200, `${clave}: ${JSON.stringify(res.body)}`);
      assert.deepEqual(await deConfiguracion(clave), antes);
      assert.deepEqual(await historialDe(clave, 'licencia_editada'), []);
    }
  });

  it('la persona autorizada que se queda sin días: no se guarda nada; con algún día libre, pasa', async () => {
    await comoTitular('adminB');
    await conFirma('adminA');
    await listoParaVacaciones('adminB');
    await listoParaCargar('adminA');
    const delTitular = await cargarMia('adminB',
      { tipo: 'vacaciones', desde: q(0), hasta: q(4), autorizado_id: usuarios.adminA.id });
    assert.equal(delTitular.status, 201, JSON.stringify(delTitular.body));

    const sinDias = await cargarMia('adminA', { tipo: 'medica', desde: q(0), hasta: q(4) });
    assert.equal(sinDias.status, 409);
    assert.deepEqual(sinDias.body, { success: false, error: textoAutorizadaSinDias(q(0), q(4)), campo: 'fechas' });
    assert.deepEqual([await vinculosDe('adminA'), await deConfiguracion('adminA')], [[], []]);

    const algunos = await cargarMia('adminA', { tipo: 'medica', desde: q(1), hasta: q(2) });
    assert.equal(algunos.status, 201, JSON.stringify(algunos.body));
    assert.deepEqual((await deConfiguracion('adminA')).map((l) => [l.desde, l.hasta]), [[q(1), q(2)]]);
    // Corregirla para cubrir todos los días también se frena, sin cambiar nada
    const antes = [await vinculosDe('adminA'), await deConfiguracion('adminA')];
    const corregida = await corregirMia('adminA', algunos.body.data.id, { tipo: 'medica', desde: q(0), hasta: q(4) });
    assert.equal(corregida.status, 409);
    assert.equal(corregida.body.campo, 'fechas');
    assert.deepEqual([await vinculosDe('adminA'), await deConfiguracion('adminA')], antes);
  });

  it('otro rechazo de Configuración se guarda igual, sin pasar y con el motivo', async () => {
    await listoParaCargar('adminA');
    const desde = sumarDias(hoy, -300);
    const res = await cargarMia('adminA', { tipo: 'medica_extraordinaria', desde, hasta: sumarDias(desde, 365) });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(vinculoDe((await vinculosDe('adminA'))[0]), [null, null, 'La licencia puede durar como máximo 365 días']);
    assert.deepEqual(await deConfiguracion('adminA'), []);
    assert.deepEqual((await filaDeLaLista('adminA', res.body.data.id, ANIO)).configuracion,
      { texto: textoNoPaso('La licencia puede durar como máximo 365 días'), insignia: 'aviso' });
  });

  it('una creada cuya copia no pasó y cuya licencia de Configuración ya terminó: la nota, el tipo y «Mostrar» se corrigen igual',
    async () => {
      // Las dos filas por SQL: la de Configuración terminó, y la de Mi espacio quedó con otro hasta y el motivo
      await listoParaCargar('adminA');
      const motivo = 'La fecha de fin tiene que ser ayer o posterior, y no anterior al inicio';
      const oficial = await deAdministracion('adminA', dia(-10), dia(-6));
      await query('UPDATE usuarios_licencias SET creado_por = ? WHERE id = ?', [usuarios.adminA.id, oficial]);
      const { insertId: id } = await query(
        `INSERT INTO mi_espacio_licencias (usuario_id, tipo, desde, hasta, licencia_oficial_id, oficial, sin_pasar)
         VALUES (?, 'medica', ?, ?, ?, 'creada', ?)`,
        [usuarios.adminA.id, dia(-10), dia(-7), oficial, motivo]
      );
      const antes = await deConfiguracion('adminA');
      const delAnio = Number(dia(-10).slice(0, 4));
      const esperada = {
        configuracion: { texto: `${textoEnConfiguracion(dia(-10), dia(-6))} ${textoNoPaso(motivo)}`, insignia: 'aviso' },
        puede_borrar: false, solo_hasta: false, fechas_fijas: true
      };
      const comoQueda = async () => {
        const { configuracion, puede_borrar: puedeBorrar, solo_hasta: soloHasta, fechas_fijas: fechasFijas } =
          await filaDeLaLista('adminA', id, delAnio);
        return { configuracion, puede_borrar: puedeBorrar, solo_hasta: soloHasta, fechas_fijas: fechasFijas };
      };
      assert.deepEqual(await comoQueda(), esperada);

      for (const cambio of [{ nota: 'Turno' }, { tipo: 'familiar' }, { tipo: 'familiar', mostrar: false }]) {
        const res = await corregirMia('adminA', id, { tipo: 'medica', desde: dia(-10), hasta: dia(-7), ...cambio });
        assert.equal(res.status, 200, `${JSON.stringify(cambio)}: ${JSON.stringify(res.body)}`);
        assert.deepEqual(res.body.avisos, []);
      }
      assert.deepEqual(await deConfiguracion('adminA'), antes);
      assert.deepEqual(vinculoDe((await vinculosDe('adminA'))[0]), [oficial, 'creada', motivo]);
      assert.deepEqual(await comoQueda(), esperada);
      // Otras fechas, no: ya terminó
      const otras = await corregirMia('adminA', id, { tipo: 'familiar', desde: dia(-10), hasta: dia(-8) });
      assert.equal(otras.status, 400);
      assert.deepEqual(otras.body, { success: false, error: MENSAJES_MI_ESPACIO.fechasFijas, campo: 'hasta' });
      // Las de Configuración, sí: vuelve a estar al día
      const alDia = await corregirMia('adminA', id, { tipo: 'familiar', desde: dia(-10), hasta: dia(-6) });
      assert.equal(alDia.status, 200, JSON.stringify(alDia.body));
      assert.deepEqual(vinculoDe((await vinculosDe('adminA'))[0]), [oficial, 'creada', null]);
      assert.deepEqual(await deConfiguracion('adminA'), antes);
    });

  it('una creada que empieza hoy: el desde queda fijo, el hasta se copia y todavía se puede borrar', async () => {
    await listoParaCargar('adminA');
    const { body } = await cargarMia('adminA', { tipo: 'medica', desde: hoy, hasta: dia(4) });
    assert.ok(body.success, JSON.stringify(body));
    const { id } = body.data;
    const fila = await filaDeLaLista('adminA', id, ANIO);
    assert.deepEqual([fila.puede_borrar, fila.solo_hasta, fila.fechas_fijas], [true, true, false]);

    const otroDesde = await corregirMia('adminA', id, { tipo: 'medica', desde: dia(1), hasta: dia(4) });
    assert.equal(otroDesde.status, 400);
    assert.deepEqual(otroDesde.body, { success: false, error: MENSAJES_MI_ESPACIO.soloHasta, campo: 'desde' });
    const otroHasta = await corregirMia('adminA', id, { tipo: 'medica', desde: hoy, hasta: dia(5) });
    assert.equal(otroHasta.status, 200, JSON.stringify(otroHasta.body));
    assert.deepEqual((await deConfiguracion('adminA')).map((l) => [l.desde, l.hasta, l.anulada]), [[hoy, dia(5), 0]]);
    assert.deepEqual(vinculoDe((await vinculosDe('adminA'))[0])[2], null);

    const borrar = await api.delete(`/mi-espacio/licencias/${id}`, como('adminA'));
    assert.equal(borrar.status, 200, JSON.stringify(borrar.body));
    assert.equal((await deConfiguracion('adminA'))[0].anulada, 1);
  });

  it('una creada que todavía no empezó, corregida toda al pasado: se anula en Configuración', async () => {
    await listoParaCargar('adminA');
    const { body } = await cargarMia('adminA', { tipo: 'medica', desde: q(0), hasta: q(2) });
    const res = await corregirMia('adminA', body.data.id, { tipo: 'medica', desde: dia(-10), hasta: dia(-8) });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await deConfiguracion('adminA'))[0].anulada, 1);
    assert.deepEqual(vinculoDe((await vinculosDe('adminA'))[0]), [null, null, null]);
    const [anulada] = await historialDe('adminA', 'licencia_anulada');
    assert.equal(anulada.actor_id, usuarios.adminA.id);
    assert.equal((await filaDeLaLista('adminA', body.data.id, Number(dia(-10).slice(0, 4)))).configuracion, null);
  });

  it('un rol que cambia entre la lectura previa y el bloqueo: la transacción vuelve a empezar con todos bloqueados', async () => {
    // El controlador en este proceso, con el pool de la base de prueba: la primera conexión que pide la transacción llega
    // después de que el lector pasó a admin, así que con lo leído bajo el bloqueo tiene que empezar de nuevo
    await conLectorConVinculo(async () => {
      await listoParaCargar('lector');
      const pedirConexion = pool.getConnection;
      const propia = Object.hasOwn(pool, 'getConnection');
      const primeras = [];
      let liberadas = 0;
      pool.getConnection = async function conRolCambiado() {
        if (primeras.length === 0) await query("UPDATE usuarios SET rol = 'admin' WHERE id = ?", [usuarios.lector.id]);
        const conexion = await pedirConexion.call(pool);
        const indice = primeras.length;
        primeras.push(null);
        const consultar = conexion.query.bind(conexion);
        conexion.query = (sql, ...resto) => {
          primeras[indice] ??= sql;
          return consultar(sql, ...resto);
        };
        const liberar = conexion.release.bind(conexion);
        conexion.release = () => {
          liberadas += 1;
          return liberar();
        };
        return conexion;
      };
      const respuesta = { status(codigo) { this.codigo = codigo; return this; }, json(cuerpo) { this.cuerpo = cuerpo; } };
      try {
        const pedido = { user: { userId: usuarios.lector.id }, body: { tipo: 'medica', desde: q(0), hasta: q(1) } };
        await controlador.cargarLicenciaMia(pedido, respuesta);
      } finally {
        if (propia) pool.getConnection = pedirConexion;
        else delete pool.getConnection;
      }
      assert.equal(respuesta.codigo, 201, JSON.stringify(respuesta.cuerpo));
      assert.equal(primeras.length, 2);
      assert.match(primeras[0], /WHERE id = \? FOR UPDATE/);
      assert.match(primeras[1], /ORDER BY id FOR UPDATE/);
      assert.equal(liberadas, 2);
      // Con el rol leído bajo el bloqueo, pasó a Configuración
      assert.deepEqual((await deConfiguracion('lector')).map((l) => [l.desde, l.hasta]), [[q(0), q(1)]]);
      assert.equal((await vinculosDe('lector')).length, 1);
    });
  });

  it('el doble envío: dos POST simultáneos iguales dejan una sola fila en cada tabla (Review Focus 3)', async () => {
    await listoParaVacaciones('adminA');
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      await query('DELETE FROM mi_espacio_licencias');
      await query('DELETE FROM usuarios_licencias');
      const cuerpo = { tipo: 'vacaciones', desde: q(0), hasta: q(4) };
      const respuestas = await Promise.all([cargarMia('adminA', cuerpo), cargarMia('adminA', cuerpo)]);
      assert.deepEqual(respuestas.map((res) => res.status).sort(), [201, 400], JSON.stringify(respuestas.map((res) => res.body)));
      const mias = await vinculosDe('adminA');
      const oficiales = await deConfiguracion('adminA');
      assert.deepEqual([mias.length, oficiales.length], [1, 1], `vuelta ${vuelta}`);
      assert.equal(mias[0].licencia_oficial_id, oficiales[0].id);
    }
  });
});

// Las horas extras (spec, 3.7 y 3.10) y «Mis vacaciones y saldos» (sección 4): nunca tocan Configuración
const NO_ENCONTRADAS = { success: false, error: MENSAJES_MI_ESPACIO.noEncontradas };
// Las horas extras de una persona como quedaron en la base, también las dadas de baja (los TIME, cortados a 'HH:MM')
const horasGuardadasDe = async (clave) => (await query(
  `SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, TIME_FORMAT(desde, '%H:%i') AS desde,
     TIME_FORMAT(hasta, '%H:%i') AS hasta, nota, activo
   FROM mi_espacio_horas_extras WHERE usuario_id = ? ORDER BY id`,
  [usuarios[clave].id]
)).map(fila => ({ ...fila, activo: Number(fila.activo) }));
// Los faltantes del Resumen (los textos)
const faltantesDe = async (clave) => {
  const res = await api.get('/mi-espacio/resumen', como(clave));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data.faltantes;
};

describe('las horas extras', () => {
  it('un POST el sábado de 22:00 a 01:30 da 201 y GET /horas-extras lo cuenta en su mes con 3,5 horas; corregirlas da 200',
    async () => {
      await listoParaCargar('adminA');
      const res = await api.post('/mi-espacio/horas-extras', { fecha: q(5), desde: '22:00', hasta: '01:30', nota: '  Evento  ' },
        como('adminA'));
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.deepEqual(Object.keys(res.body).sort(), ['data', 'message', 'success']);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'Horas extras cargadas.');
      const { id } = res.body.data;
      assert.ok(Number.isInteger(id) && id > 0);
      assert.deepEqual(await horasGuardadasDe('adminA'),
        [{ id, fecha: q(5), desde: '22:00', hasta: '01:30', nota: 'Evento', activo: 1 }]);

      // Pasa la medianoche: cuenta entera en el mes del día en que empezó
      const mes = q(5).slice(0, 7);
      const tabla = await api.get(`/mi-espacio/horas-extras?anio=${mes.slice(0, 4)}`, como('adminA'));
      assert.equal(tabla.status, 200, JSON.stringify(tabla.body));
      assert.equal(tabla.body.data.totales_por_mes[mes], '3,5 horas');
      const [fila] = tabla.body.data.dias_por_mes[mes];
      assert.deepEqual([fila.id, fila.fecha, fila.horario, fila.horas_texto, fila.nota],
        [id, q(5), '22:00 a 01:30', '3,5 horas', 'Evento']);

      // Corregirlas: no chocan consigo mismas, y sin nota queda null
      const corregida = await api.put(`/mi-espacio/horas-extras/${id}`, { fecha: q(5), desde: '21:00', hasta: '01:30' },
        como('adminA'));
      assert.equal(corregida.status, 200, JSON.stringify(corregida.body));
      assert.deepEqual(corregida.body, { success: true, data: { id }, message: 'Horas extras corregidas.' });
      assert.deepEqual(await horasGuardadasDe('adminA'),
        [{ id, fecha: q(5), desde: '21:00', hasta: '01:30', nota: null, activo: 1 }]);
    });

  it('una superpuesta y un horario que no es de a media hora dan 400 en desde; cada 400 con su campo y nada guardado',
    async () => {
      await listoParaCargar('adminA');
      const primera = await conHorasExtras('adminA', { fecha: q(5), desde: '22:00:00', hasta: '01:30:00' });
      const casos = [
        [{ fecha: q(5), desde: '21:00', hasta: '22:30' }, rechazo(textoHorarioSuperpuesto('22:00', '01:30'), 'desde')],
        [{ fecha: q(5), desde: '10:15', hasta: '11:00' }, rechazo(MENSAJES_MI_ESPACIO.horario, 'desde')],
        [{ fecha: '2026-02-30', desde: '10:00', hasta: '11:00' }, rechazo(MENSAJES_MI_ESPACIO.fecha, 'fecha')],
        [{ fecha: q(5), desde: '10:00', hasta: '11:00', nota: 'x'.repeat(201) }, rechazo(MENSAJES_MI_ESPACIO.nota, 'nota')]
      ];
      assert.equal(casos[0][1].error, 'Se superpone con las horas extras de 22:00 a 01:30 de ese día.');
      for (const [cuerpo, esperado] of casos) {
        const res = await api.post('/mi-espacio/horas-extras', cuerpo, como('adminA'));
        assert.equal(res.status, 400, JSON.stringify(cuerpo));
        assert.deepEqual(res.body, esperado, JSON.stringify(cuerpo));
      }
      // La corrección de otras del mismo día también choca
      const otra = await conHorasExtras('adminA', { fecha: q(5), desde: '10:00:00', hasta: '12:00:00' });
      const corregida = await api.put(`/mi-espacio/horas-extras/${otra}`, { fecha: q(5), desde: '20:00', hasta: '23:00' },
        como('adminA'));
      assert.equal(corregida.status, 400);
      assert.deepEqual(corregida.body, rechazo(textoHorarioSuperpuesto('22:00', '01:30'), 'desde'));
      assert.deepEqual((await horasGuardadasDe('adminA')).map(fila => [fila.id, fila.desde, fila.hasta]),
        [[primera, '22:00', '01:30'], [otra, '10:00', '12:00']]);
      // Las de otra persona no chocan
      await listoParaCargar('adminB');
      const deB = await api.post('/mi-espacio/horas-extras', { fecha: q(5), desde: '22:00', hasta: '01:30' }, como('adminB'));
      assert.equal(deB.status, 201, JSON.stringify(deB.body));
    });

  it('cargar y corregir piden la modalidad y el arranque (campo null); borrar no los pide', async () => {
    await conAnio('adminA', ANIO, 20);
    const cuerpo = { fecha: q(5), desde: '10:00', hasta: '12:00' };
    const sinArranque = await api.post('/mi-espacio/horas-extras', cuerpo, como('adminA'));
    assert.equal(sinArranque.status, 400);
    assert.deepEqual(sinArranque.body, rechazo(MENSAJES_MI_ESPACIO.sinArranque, null));
    const sinVinculo = await api.post('/mi-espacio/horas-extras', cuerpo, como('lector'));
    assert.equal(sinVinculo.status, 400);
    assert.deepEqual(sinVinculo.body, rechazo(MENSAJES_MI_ESPACIO.sinModalidad, null));
    assert.equal((await horasGuardadasDe('adminA')).length + (await horasGuardadasDe('lector')).length, 0);

    const deA = await conHorasExtras('adminA', { fecha: q(5), desde: '19:00:00', hasta: '22:00:00' });
    const delLector = await conHorasExtras('lector', { fecha: q(5), desde: '19:00:00', hasta: '22:00:00' });
    for (const [clave, id, mensaje] of [['adminA', deA, MENSAJES_MI_ESPACIO.sinArranque],
      ['lector', delLector, MENSAJES_MI_ESPACIO.sinModalidad]]) {
      const corregir = await api.put(`/mi-espacio/horas-extras/${id}`, cuerpo, como(clave));
      assert.equal(corregir.status, 400, clave);
      assert.deepEqual(corregir.body, rechazo(mensaje, null), clave);
      const borrar = await api.delete(`/mi-espacio/horas-extras/${id}`, como(clave));
      assert.equal(borrar.status, 200, `${clave} ${JSON.stringify(borrar.body)}`);
      assert.deepEqual((await horasGuardadasDe(clave)).map(fila => [fila.desde, fila.activo]), [['19:00', 0]], clave);
    }
  });

  it('lo ajeno es 404: el PUT y el DELETE sobre unas de adminB, un id que no sirve, uno que no existe y unas dadas de baja',
    async () => {
      await listoParaCargar('adminA');
      const ajenas = await conHorasExtras('adminB', { fecha: q(5), desde: '10:00:00', hasta: '12:00:00' });
      const dadasDeBaja = await conHorasExtras('adminA', { fecha: q(6), desde: '10:00:00', hasta: '12:00:00', activo: 0 });
      const cuerpo = { fecha: q(5), desde: '14:00', hasta: '15:00' };
      for (const id of [ajenas, 'abc', '1e3', '0', '-1', '1.5', 999999, dadasDeBaja]) {
        const corregir = await api.put(`/mi-espacio/horas-extras/${id}`, cuerpo, como('adminA'));
        assert.equal(corregir.status, 404, `PUT ${id}`);
        assert.deepEqual(corregir.body, NO_ENCONTRADAS, `PUT ${id}`);
        const borrar = await api.delete(`/mi-espacio/horas-extras/${id}`, como('adminA'));
        assert.equal(borrar.status, 404, `DELETE ${id}`);
        assert.deepEqual(borrar.body, NO_ENCONTRADAS, `DELETE ${id}`);
      }
      // El 404 va antes que la validación: con un cuerpo que no sirve, también
      const invalida = await api.put(`/mi-espacio/horas-extras/${ajenas}`, { fecha: 'x' }, como('adminA'));
      assert.equal(invalida.status, 404);
      assert.deepEqual((await horasGuardadasDe('adminB')).map(fila => [fila.fecha, fila.desde, fila.hasta, fila.activo]),
        [[q(5), '10:00', '12:00', 1]]);
      assert.deepEqual((await horasGuardadasDe('adminA')).map(fila => [fila.id, fila.activo]), [[dadasDeBaja, 0]]);
    });

  it('borrar unas horas extras deja un faltante, sin frenar (corregirlas, tampoco)', async () => {
    await listoParaCargar('adminA');
    // El franco del lunes q(0) sale de las 7 horas extras de dos meses antes
    const mesDeUso = q(0).slice(0, 7);
    const trabajado = `${mesMas(mesDeUso, -2)}-10`;
    const id = await conHorasExtras('adminA', { fecha: trabajado, desde: '14:00:00', hasta: '21:00:00' });
    await conLicencia('adminA', { tipo: 'franco', desde: q(0) });
    assert.deepEqual(await faltantesDe('adminA'), []);
    const faltante = `Revisá tus francos de ${mesEnFrase(mesDeUso)}: cargaste 1 y no corresponde ninguno.`;

    const corregida = await api.put(`/mi-espacio/horas-extras/${id}`, { fecha: trabajado, desde: '14:00', hasta: '20:00' },
      como('adminA'));
    assert.equal(corregida.status, 200, JSON.stringify(corregida.body));
    assert.deepEqual(await faltantesDe('adminA'), [faltante]);
    const devuelta = await api.put(`/mi-espacio/horas-extras/${id}`, { fecha: trabajado, desde: '14:00', hasta: '21:00' },
      como('adminA'));
    assert.equal(devuelta.status, 200, JSON.stringify(devuelta.body));
    assert.deepEqual(await faltantesDe('adminA'), []);

    const res = await api.delete(`/mi-espacio/horas-extras/${id}`, como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, message: 'Horas extras borradas.' });
    assert.deepEqual(await faltantesDe('adminA'), [faltante]);
    // Baja lógica: la fila queda con activo = 0 y deja de verse; ya dada de baja, 404
    assert.deepEqual((await horasGuardadasDe('adminA')).map(fila => [fila.id, fila.activo]), [[id, 0]]);
    const tabla = await api.get(`/mi-espacio/horas-extras?anio=${trabajado.slice(0, 4)}`, como('adminA'));
    assert.deepEqual(tabla.body.data.dias_por_mes, {});
    assert.equal((await api.delete(`/mi-espacio/horas-extras/${id}`, como('adminA'))).status, 404);
  });

  it('el doble envío: dos POST simultáneos que se superponen guardan uno solo (Review Focus 3)', async () => {
    await listoParaCargar('adminA');
    const cuerpos = [{ fecha: q(5), desde: '19:00', hasta: '22:00' }, { fecha: q(5), desde: '20:00', hasta: '23:00' }];
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      await query('DELETE FROM mi_espacio_horas_extras');
      const respuestas = await Promise.all(cuerpos.map(cuerpo => api.post('/mi-espacio/horas-extras', cuerpo, como('adminA'))));
      assert.deepEqual(respuestas.map(res => res.status).sort(), [201, 400], JSON.stringify(respuestas.map(res => res.body)));
      const guardadas = await horasGuardadasDe('adminA');
      assert.equal(guardadas.length, 1, `vuelta ${vuelta}`);
      // La que quedó es la del 201, y la otra choca con ella
      const [guardada] = guardadas;
      const ganadora = respuestas.findIndex(res => res.status === 201);
      assert.deepEqual([guardada.id, guardada.desde, guardada.hasta],
        [respuestas[ganadora].body.data.id, cuerpos[ganadora].desde, cuerpos[ganadora].hasta]);
      assert.deepEqual(respuestas[1 - ganadora].body, rechazo(textoHorarioSuperpuesto(guardada.desde, guardada.hasta), 'desde'));
    }
  });
});

describe('guardar el año', () => {
  const anioGuardadoDe = async (clave) => (await query(
    'SELECT anio, dias_vacaciones, estudios FROM mi_espacio_anios WHERE usuario_id = ? ORDER BY anio', [usuarios[clave].id]
  )).map(fila => [Number(fila.anio), Number(fila.dias_vacaciones), fila.estudios]);

  it('PUT /anio con 15 y secundario, y después GET; guardarlo de nuevo cambia la misma fila', async () => {
    const res = await api.put(`/mi-espacio/anio/${ANIO}`, { dias_vacaciones: 15, estudios: 'secundario' }, como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, {
      success: true, data: { anio: ANIO, dias_vacaciones: 15, estudios: 'secundario' }, message: 'Días del año guardados.'
    });
    const leido = await api.get(`/mi-espacio/anio/${ANIO}`, como('adminA'));
    assert.equal(leido.status, 200, JSON.stringify(leido.body));
    assert.deepEqual([leido.body.data.dias_vacaciones, leido.body.data.estudios, leido.body.data.heredado],
      [15, 'secundario', false]);

    // Un número como texto y «No estudio» (null): la misma fila
    const otra = await api.put(`/mi-espacio/anio/${ANIO}`, { dias_vacaciones: '25', estudios: null }, como('adminA'));
    assert.equal(otra.status, 200, JSON.stringify(otra.body));
    assert.deepEqual(otra.body.data, { anio: ANIO, dias_vacaciones: 25, estudios: null });
    assert.deepEqual(await anioGuardadoDe('adminA'), [[ANIO, 25, null]]);
  });

  it('cada 400 con su campo y nada guardado; el año va antes que nada, también sin vínculo', async () => {
    const casos = [
      [ANIO, { dias_vacaciones: 12, estudios: null }, rechazo(MENSAJES_MI_ESPACIO.diasVacaciones, 'dias_vacaciones')],
      [ANIO, { dias_vacaciones: 15, estudios: 'otro' }, rechazo(MENSAJES_MI_ESPACIO.estudios, 'estudios')],
      [ANIO, { dias_vacaciones: 15 }, rechazo(MENSAJES_MI_ESPACIO.estudios, 'estudios')],
      [ANIO + 2, { dias_vacaciones: 15, estudios: null }, rechazo(MENSAJES_MI_ESPACIO.anio, 'anio')],
      ['abc', { dias_vacaciones: 15, estudios: null }, rechazo(MENSAJES_MI_ESPACIO.anio, 'anio')]
    ];
    for (const [anio, cuerpo, esperado] of casos) {
      const res = await api.put(`/mi-espacio/anio/${anio}`, cuerpo, como('adminA'));
      assert.equal(res.status, 400, `${anio} ${JSON.stringify(cuerpo)}`);
      assert.deepEqual(res.body, esperado, `${anio} ${JSON.stringify(cuerpo)}`);
    }
    const sinVinculo = await api.put(`/mi-espacio/anio/${ANIO}`, { dias_vacaciones: 15, estudios: null }, como('lector'));
    assert.equal(sinVinculo.status, 400);
    assert.deepEqual(sinVinculo.body, rechazo(MENSAJES_MI_ESPACIO.sinModalidad, null));
    const anioSinVinculo = await api.put('/mi-espacio/anio/abc', { dias_vacaciones: 15, estudios: null }, como('lector'));
    assert.deepEqual(anioSinVinculo.body, rechazo(MENSAJES_MI_ESPACIO.anio, 'anio'));
    assert.deepEqual([...await anioGuardadoDe('adminA'), ...await anioGuardadoDe('lector')], []);
  });

  it('bajar los días no se frena: deja un faltante en el Resumen', async () => {
    await listoParaCargar('adminA', `${ANIO}-01-15`);
    // Diez días hábiles de agosto, cubiertos por la primera mitad de la licencia del año (10 de 20, el 1/7)
    const habiles = [];
    for (let fecha = `${ANIO}-08-01`; habiles.length < 10; fecha = sumarDias(fecha, 1)) {
      if (esDiaHabil(fecha)) habiles.push(fecha);
    }
    await conLicencia('adminA', { tipo: 'vacaciones', desde: habiles[0], hasta: habiles[9] });
    assert.deepEqual(await faltantesDe('adminA'), []);

    // Con 10 días, la primera mitad es de 5: los otros 5 quedan sin cubrir
    const res = await api.put(`/mi-espacio/anio/${ANIO}`, { dias_vacaciones: 10, estudios: null }, como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(await faltantesDe('adminA'),
      [`Revisá tus vacaciones: para el ${formatoCorto(habiles[5])} faltan 5 días habilitados.`]);
  });
});

describe('guardar el saldo inicial', () => {
  const arranqueDe = async (clave) => (await query(
    "SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha FROM mi_espacio_arranque WHERE usuario_id = ?", [usuarios[clave].id]
  )).map(fila => fila.fecha);
  // [concepto, anio, cantidad], por concepto y año
  const ordenados = (filas) => [...filas].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
  const saldosDe = async (clave) => ordenados((await query(
    'SELECT concepto, anio, cantidad FROM mi_espacio_saldos WHERE usuario_id = ?', [usuarios[clave].id]
  )).map(fila => [fila.concepto, Number(fila.anio), Number(fila.cantidad)]));
  // Los campos de planta con 20 días en el año de hoy y el arranque de hoy
  const camposDePlanta = () => camposDelSaldoInicial({
    modalidad: 'planta', arranque: hoy, anios: [{ anio: ANIO, dias_vacaciones: 20, estudios: null }]
  });

  it('el primer PUT crea el arranque con hoy y guarda un saldo por campo', async () => {
    await conAnio('adminA', ANIO, 20);
    const campos = camposDePlanta();
    const saldos = Object.fromEntries(campos.map((campo, i) => [campo.clave, Math.min(campo.maximo, i + 1)]));
    const res = await api.put('/mi-espacio/saldo-inicial', { saldos }, como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, data: { arranque: hoy }, message: 'Saldo inicial guardado.' });
    assert.deepEqual(await arranqueDe('adminA'), [hoy]);
    assert.deepEqual(await saldosDe('adminA'),
      ordenados(campos.map(campo => [campo.concepto, campo.anio, saldos[campo.clave]])));

    const leido = await api.get('/mi-espacio/saldo-inicial', como('adminA'));
    assert.equal(leido.body.data.arranque, hoy);
    assert.deepEqual(Object.fromEntries(leido.body.data.campos.map(campo => [campo.clave, campo.valor])), saldos);
  });

  it('una corrección cambia los valores y no la fecha: reemplaza todas las filas', async () => {
    const arranque = `${ANIO}-01-15`;
    await conArranque('editor', arranque);
    await conAnio('editor', ANIO, 20);
    await conSaldo('editor', 'vacaciones', ANIO - 1, '12.0');
    // Una fila que ya no es un campo: se borra
    await conSaldo('editor', 'vacaciones', ANIO - 5, '3.0');
    const campos = camposDelSaldoInicial({
      modalidad: 'contrato', arranque, anios: [{ anio: ANIO, dias_vacaciones: 20, estudios: null }]
    });
    assert.ok(campos.some(campo => campo.clave === 'horas_no_utilizadas'));
    // Lo que no es un campo no se guarda
    const saldos = { ...Object.fromEntries(campos.map(campo => [campo.clave, 0])), horas_no_utilizadas: '6.5', otra: 9 };
    const res = await api.put('/mi-espacio/saldo-inicial', { saldos }, como('editor'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data, { arranque });
    assert.deepEqual(await arranqueDe('editor'), [arranque]);
    assert.deepEqual(await saldosDe('editor'), ordenados(campos.map(campo =>
      [campo.concepto, campo.anio, campo.clave === 'horas_no_utilizadas' ? 6.5 : 0])));
  });

  it('una clave que falta o que no sirve da 400 con su clave, y no guarda nada', async () => {
    await conAnio('adminA', ANIO, 20);
    const campos = camposDePlanta();
    const completos = Object.fromEntries(campos.map(campo => [campo.clave, 0]));
    const { medica, ...sinMedica } = completos;
    assert.equal(medica, 0);
    const casos = [
      [{ saldos: sinMedica }, rechazo(textoSaldo(25), 'medica')],
      [{ saldos: { ...completos, franquicias: 43 } }, rechazo(textoSaldo(42), 'franquicias')],
      [{}, rechazo(textoSaldo(campos[0].maximo), campos[0].clave)]
    ];
    assert.equal(casos[0][1].error, 'Escribí un número de 0 a 25.');
    for (const [cuerpo, esperado] of casos) {
      const res = await api.put('/mi-espacio/saldo-inicial', cuerpo, como('adminA'));
      assert.equal(res.status, 400, JSON.stringify(cuerpo));
      assert.deepEqual(res.body, esperado, JSON.stringify(cuerpo));
    }
    assert.deepEqual([await arranqueDe('adminA'), await saldosDe('adminA')], [[], []]);
  });

  it('sin el año del arranque cargado da 400 en dias_vacaciones; con el arranque guardado, cuenta el de su año', async () => {
    const saldos = Object.fromEntries(camposDePlanta().map(campo => [campo.clave, 0]));
    const esperado = rechazo(MENSAJES_MI_ESPACIO.diasVacaciones, 'dias_vacaciones');
    const sinNinguno = await api.put('/mi-espacio/saldo-inicial', { saldos }, como('adminA'));
    assert.equal(sinNinguno.status, 400);
    assert.deepEqual(sinNinguno.body, esperado);
    // El de un año anterior, que valdría heredado, no alcanza: tiene que estar el del arranque
    await conAnio('adminA', ANIO - 1, 20);
    const conElAnterior = await api.put('/mi-espacio/saldo-inicial', { saldos }, como('adminA'));
    assert.deepEqual(conElAnterior.body, esperado);
    assert.deepEqual([await arranqueDe('adminA'), await saldosDe('adminA')], [[], []]);

    // Con el arranque guardado en el año anterior, alcanza con ese año (los campos, con ese arranque)
    const arranque = `${ANIO - 1}-03-10`;
    await conArranque('adminA', arranque);
    const campos = camposDelSaldoInicial({
      modalidad: 'planta', arranque, anios: [{ anio: ANIO - 1, dias_vacaciones: 20, estudios: null }]
    });
    const res = await api.put('/mi-espacio/saldo-inicial',
      { saldos: Object.fromEntries(campos.map(campo => [campo.clave, 1])) }, como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data, { arranque });
    assert.deepEqual(await saldosDe('adminA'), ordenados(campos.map(campo => [campo.concepto, campo.anio, 1])));
  });

  it('el lector sin vínculo recibe 400 sinModalidad, y no se guarda nada', async () => {
    const res = await api.put('/mi-espacio/saldo-inicial', { saldos: {} }, como('lector'));
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, rechazo(MENSAJES_MI_ESPACIO.sinModalidad, null));
    assert.deepEqual([await arranqueDe('lector'), await saldosDe('lector')], [[], []]);
  });

  it('el doble envío: dos PUT simultáneos dan 200 y dejan un solo arranque y un saldo por campo (Review Focus 3)', async () => {
    await conAnio('adminA', ANIO, 20);
    const campos = camposDePlanta();
    const saldos = Object.fromEntries(campos.map(campo => [campo.clave, 1]));
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      await query('DELETE FROM mi_espacio_saldos');
      await query('DELETE FROM mi_espacio_arranque');
      const respuestas = await Promise.all([0, 1].map(() => api.put('/mi-espacio/saldo-inicial', { saldos }, como('adminA'))));
      assert.deepEqual(respuestas.map(res => res.status), [200, 200], JSON.stringify(respuestas.map(res => res.body)));
      for (const res of respuestas) assert.deepEqual(res.body.data, { arranque: hoy });
      assert.deepEqual(await arranqueDe('adminA'), [hoy], `vuelta ${vuelta}`);
      assert.deepEqual(await saldosDe('adminA'), ordenados(campos.map(campo => [campo.concepto, campo.anio, 1])), `vuelta ${vuelta}`);
    }
  });
});

// «Hoy no están» (spec, sección 7): lo que ven los compañeros (administración) de las ausencias de día entero de los demás,
// sin el tipo, la nota ni un id
const DIAS_DE_LA_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const diaYMes = (fecha) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
const vueltaTexto = (fecha) => `Vuelve el ${DIAS_DE_LA_SEMANA[new Date(`${fecha}T12:00:00Z`).getUTCDay()]} ${diaYMes(fecha)}`;
const ausente = (nombre, desde, hasta, vuelve) =>
  ({ nombre, desde, hasta, vuelve, texto: `${nombre} no está`, vuelve_texto: vueltaTexto(vuelve) });
const CLAVES_DEL_AUSENTE = ['nombre', 'desde', 'hasta', 'vuelve', 'texto', 'vuelve_texto'];

describe('«Hoy no están»', () => {
  const ausentes = (clave, desde, hasta) => api.get(`/mi-espacio/ausentes?desde=${desde}&hasta=${hasta}`, como(clave));

  it('el tipo no sale: cada ausente trae solo el nombre, las fechas, la vuelta y sus textos (antiobjetivo)', async () => {
    assert.equal(vueltaTexto(q(7)), `Vuelve el lunes ${diaYMes(q(7))}`);
    // Unas vacaciones y una médica seguidas (separadas solo por el fin de semana): una sola ausencia
    await conLicencia('adminB', { tipo: 'vacaciones', desde: q(0), hasta: q(4), nota: 'Viaje a la costa' });
    await conLicencia('adminB', { tipo: 'medica', desde: q(7), hasta: q(8), nota: 'Turno con la doctora' });
    const res = await ausentes('adminA', q(0), q(4));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, {
      success: true, data: { puede_ver: true, ausentes: [ausente('Martín Ríos', q(0), q(8), q(9))] }
    });
    for (const cada of res.body.data.ausentes) assert.deepEqual(Object.keys(cada), CLAVES_DEL_AUSENTE);
    const texto = JSON.stringify(res.body);
    for (const nada of ['vacaciones', 'Vacaciones', 'medica', 'médica', 'Viaje', 'Turno']) assert.ok(!texto.includes(nada), nada);

    // Pedida solo por el último día, se ve entera: desde el primer día y con su vuelta
    const delFinal = await ausentes('adminA', q(8), q(8));
    assert.deepEqual(delFinal.body.data.ausentes, [ausente('Martín Ríos', q(0), q(8), q(9))]);
    // Y fuera de ella, nadie
    const despues = await ausentes('adminA', q(9), q(11));
    assert.deepEqual(despues.body.data, { puede_ver: true, ausentes: [] });
  });

  it('solo administración: el lector y el colaborador no ven a nadie; de los demás, lo de día entero que se muestra',
    async () => {
      // Lo que se ve: una médica de adminB y la franquicia de 7 horas del superadmin (el '7.0' del DECIMAL)
      await conLicencia('adminB', { tipo: 'medica', desde: q(1) });
      await conLicencia('superadmin', { tipo: 'franquicia', desde: q(2), horas: '7.0' });
      // Lo que no: las del lector y el colaborador (aunque digan mostrar = 1), la de adminB con mostrar = 0, la franquicia
      // de 3 horas del editor, una dada de baja y una fuera del rango
      await conLicencia('lector', { tipo: 'medica', desde: q(1) });
      await conLicencia('colab', { tipo: 'medica', desde: q(1) });
      await conLicencia('adminB', { tipo: 'familiar', desde: q(3), mostrar: 0 });
      await conLicencia('editor', { tipo: 'franquicia', desde: q(2), horas: '3.0' });
      await conLicencia('editor', { tipo: 'medica', desde: q(3), activo: 0 });
      await conLicencia('editor', { tipo: 'medica', desde: q(9) });
      // La de quien mira no la ve él; la ven los demás
      await conLicencia('adminA', { tipo: 'medica', desde: q(1) });

      const deA = await ausentes('adminA', q(0), q(4));
      assert.equal(deA.status, 200, JSON.stringify(deA.body));
      assert.deepEqual(deA.body.data, { puede_ver: true, ausentes: [
        ausente('Martín Ríos', q(1), q(1), q(2)), ausente('Diego Fernández', q(2), q(2), q(3))
      ] });
      const delEditor = await ausentes('editor', q(0), q(4));
      assert.deepEqual(delEditor.body.data.ausentes, [
        ausente('Laura Gómez', q(1), q(1), q(2)), ausente('Martín Ríos', q(1), q(1), q(2)),
        ausente('Diego Fernández', q(2), q(2), q(3))
      ]);
      for (const clave of ['lector', 'colab']) {
        const res = await ausentes(clave, q(0), q(4));
        assert.equal(res.status, 200, clave);
        assert.deepEqual(res.body, { success: true, data: { puede_ver: false, ausentes: [] } }, clave);
      }

      // Una persona dada de baja, o que dejó de ser de administración, no se ve
      try {
        await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [usuarios.superadmin.id]);
        await query("UPDATE usuarios SET rol = 'lector' WHERE id = ?", [usuarios.adminB.id]);
        const sinEllos = await ausentes('adminA', q(0), q(4));
        assert.deepEqual(sinEllos.body.data, { puede_ver: true, ausentes: [] });
      } finally {
        await query('UPDATE usuarios SET activo = 1 WHERE id = ?', [usuarios.superadmin.id]);
        await query("UPDATE usuarios SET rol = 'admin' WHERE id = ?", [usuarios.adminB.id]);
      }
    });

  it('la vuelta saltea un feriado de la tabla, y dos ausencias separadas solo por él son una', async () => {
    await conLicencia('adminB', { tipo: 'medica', desde: q(0), hasta: q(1) });
    const sinFeriado = await ausentes('adminA', q(0), q(1));
    assert.deepEqual(sinFeriado.body.data.ausentes, [ausente('Martín Ríos', q(0), q(1), q(2))]);

    await conFeriado({ fecha: q(2), nombre: 'Feriado de prueba' });
    const conElFeriado = await ausentes('adminA', q(0), q(1));
    assert.deepEqual(conElFeriado.body.data.ausentes, [ausente('Martín Ríos', q(0), q(1), q(3))]);
    assert.equal(conElFeriado.body.data.ausentes[0].vuelve_texto, `Vuelve el jueves ${diaYMes(q(3))}`);

    await conLicencia('adminB', { tipo: 'familiar', desde: q(3) });
    const unidas = await ausentes('adminA', q(0), q(1));
    assert.deepEqual(unidas.body.data.ausentes, [ausente('Martín Ríos', q(0), q(3), q(4))]);
  });

  it('el rango: hasta 93 días; con más, o con fechas que no sirven, 400 en fechas, también para el lector', async () => {
    const justo = await ausentes('adminA', q(0), sumarDias(q(0), 92));
    assert.equal(justo.status, 200, JSON.stringify(justo.body));
    const RANGO = rechazo('Elegí un rango de hasta 93 días.', 'fechas');
    const FECHA = rechazo(MENSAJES_MI_ESPACIO.fecha, 'fechas');
    const casos = [
      [`desde=${q(0)}&hasta=${sumarDias(q(0), 93)}`, RANGO],
      [`desde=${q(1)}&hasta=${q(0)}`, FECHA],
      [`desde=abc&hasta=${q(0)}`, FECHA],
      [`desde=${q(0)}&hasta=2026-02-30`, FECHA],
      [`desde=${q(0)}`, FECHA],
      ['', FECHA],
      [`desde=${q(0)}&desde=${q(1)}&hasta=${q(2)}`, FECHA],
      ['desde=1999-12-30&hasta=1999-12-31', FECHA]
    ];
    for (const clave of ['adminA', 'lector']) {
      for (const [consulta, esperado] of casos) {
        const res = await api.get(`/mi-espacio/ausentes?${consulta}`, como(clave));
        assert.equal(res.status, 400, `${clave} ${consulta}`);
        assert.deepEqual(res.body, esperado, `${clave} ${consulta}`);
      }
    }
  });

  // Decisión del usuario (27/10/2026): «Hoy no están» y «Mañana no están», por separado
  it('el Resumen: «Hoy y mañana» trae a los que no están hoy y, aparte, a los que empiezan mañana, para quien puede verlos',
    async () => {
      // De hoy a pasado mañana: solo en hoy, con su vuelta
      await conLicencia('adminB', { tipo: 'medica', desde: hoy, hasta: dia(2), nota: 'Turno con la doctora' });
      // Empieza mañana: solo en mañana
      await conLicencia('superadmin', { tipo: 'familiar', desde: dia(1) });
      // Ya volvió: no está
      await conLicencia('editor', { tipo: 'medica', desde: dia(-3), hasta: dia(-1) });
      const res = await api.get('/mi-espacio/resumen', como('adminA'));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const { hoy_y_manana: hoyYManana } = res.body.data;
      assert.deepEqual(Object.keys(hoyYManana), ['ausentes_hoy', 'ausentes_manana', 'proximo_feriado']);
      assert.deepEqual(hoyYManana.ausentes_hoy, [ausente('Martín Ríos', hoy, dia(2), proximoDiaHabil(dia(3)))]);
      assert.deepEqual(hoyYManana.ausentes_manana, [ausente('Diego Fernández', dia(1), dia(1), proximoDiaHabil(dia(2)))]);
      for (const cada of [...hoyYManana.ausentes_hoy, ...hoyYManana.ausentes_manana]) {
        assert.deepEqual(Object.keys(cada), CLAVES_DEL_AUSENTE);
      }
      const texto = JSON.stringify(hoyYManana);
      for (const nada of ['medica', 'familiar', 'Turno']) assert.ok(!texto.includes(nada), nada);
      const delLector = await api.get('/mi-espacio/resumen', como('lector'));
      assert.equal(delLector.status, 200, JSON.stringify(delLector.body));
      assert.deepEqual(delLector.body.data.hoy_y_manana.ausentes_hoy, []);
      assert.deepEqual(delLector.body.data.hoy_y_manana.ausentes_manana, []);
    });
});

// Lo que necesita el campo «Autorizo a presentar las notas en mi nombre a:» (spec, sección 6): al firmante titular, lo mismo
// que le da GET /usuarios/licencias a Configuración
describe('los datos del campo del firmante', () => {
  beforeEach(async () => {
    await query('DELETE FROM usuarios_firmas');
    await query('UPDATE notas_digitales_config SET firmante_usuario_id = NULL');
  });

  it('el titular recibe las personas que puede autorizar con sus licencias, como en Configuración; los demás, soy_titular false',
    async () => {
      await comoTitular('adminA');
      for (const clave of ['adminA', 'adminB', 'editor']) await conFirma(clave);
      // Una licencia de Configuración de adminB: el formulario avisa si se superpone con la del titular
      await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta, creado_por) VALUES (?, ?, ?, ?)',
        [usuarios.adminB.id, q(0), q(4), usuarios.adminB.id]);

      const res = await api.get('/mi-espacio/firmante', como('adminA'));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const { data } = res.body;
      assert.deepEqual(Object.keys(data), ['soy_titular', 'hoy', 'autorizables']);
      assert.deepEqual([data.soy_titular, data.hoy], [true, hoy]);
      // Por nombre: Carla Benítez (el editor, sin licencias) y Martín Ríos
      assert.deepEqual(data.autorizables.map(persona => persona.id), [usuarios.editor.id, usuarios.adminB.id]);
      assert.deepEqual(data.autorizables[0].ausencias, []);
      assert.deepEqual(data.autorizables[1], {
        id: usuarios.adminB.id, nombre_completo: 'Martín Ríos', licencias: [{ desde: q(0), hasta: q(4) }],
        ausencias: [{ desde: q(0), hasta: q(4), vuelve: q(7) }]
      });
      const deConfiguracion = await api.get('/usuarios/licencias', como('adminA'));
      assert.equal(deConfiguracion.status, 200, JSON.stringify(deConfiguracion.body));
      assert.deepEqual(data.autorizables, deConfiguracion.body.data.autorizables);

      for (const clave of ['adminB', 'superadmin', 'lector', 'colab']) {
        const otro = await api.get('/mi-espacio/firmante', como(clave));
        assert.equal(otro.status, 200, clave);
        assert.deepEqual(otro.body, { success: true, data: { soy_titular: false } }, clave);
      }
    });

  it('sin firmante titular elegido, nadie lo es', async () => {
    await conFirma('adminB');
    const res = await api.get('/mi-espacio/firmante', como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data, { soy_titular: false });
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

  it('ausenciasVisibles: las filas de día entero que se muestran, de administración activa, sin quien mira y sin el tipo',
    async () => {
      await conLicencia('adminB', { tipo: 'vacaciones', desde: q(0), hasta: q(4), nota: 'Viaje' });
      await conLicencia('superadmin', { tipo: 'uso_autorizado', desde: q(1), horas: '7.0' });
      await conLicencia('superadmin', { tipo: 'horas_a_favor', desde: q(2), horas: '6.5' });
      await conLicencia('adminA', { tipo: 'medica', desde: q(1) });
      await conLicencia('lector', { tipo: 'medica', desde: q(1) });
      await conLicencia('editor', { tipo: 'medica', desde: q(7) });
      const filas = await datos.ausenciasVisibles(q(1), q(4), { excluir: usuarios.adminA.id });
      assert.deepEqual(filas, [
        { usuario_id: usuarios.adminB.id, nombre: 'Martín Ríos', desde: q(0), hasta: q(4) },
        { usuario_id: usuarios.superadmin.id, nombre: 'Diego Fernández', desde: q(1), hasta: q(1) }
      ]);
      // Sin excluir a nadie, también la de adminA
      const todas = await datos.ausenciasVisibles(q(1), q(1));
      assert.deepEqual(todas.map(fila => fila.nombre), ['Martín Ríos', 'Diego Fernández', 'Laura Gómez']);
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
