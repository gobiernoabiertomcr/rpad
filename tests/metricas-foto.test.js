// La foto del 31/12 (spec 2026-10-24-metricas-y-reportes, 3; services/metricasFoto.js): la saca sola la corrida de las 8:15 desde el
// 10/01, una sola vez y al 31/12, y un error al guardarla no frena la corrida: queda en la última corrida. Contra una base de prueba
// propia, con datos inventados. Se llama al servicio, y a la corrida diaria (el controlador, nunca /api/cron/*), con un hoy fijo.
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query, mailpit } from './helpers.js';
import { crearDataset, limpiarBase, configurarNotas, conFallaSimulada } from './notas-fixtures.js';
import {
  ESTADISTICOS, DIAS, casosDe, casosQueTocanElAnio, vistaDe, duracion, indiceMesAMes, antiguedadDeVencidos, estadosAl, trabajoDelAnio,
  areasYTemas, etapasDe
} from '../services/metricasReglas.js';
import { cintaDeMetricas } from '../services/metricasCinta.js';
import { calendarioDeFechas } from '../services/feriadosReglas.js';

const MOMENTO = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const AL = '2026-12-31';
const CLAVES = ['mediana-habiles', 'mediana-corridos', 'promedio-habiles', 'promedio-corridos'];
let base, dbReal, foto, controlador, seguimientoDatos, usuarioId;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_metricas_foto');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba
  foto = await import('../services/metricasFoto.js');
  controlador = await import('../controllers/notificacionesController.js');
  seguimientoDatos = await import('../services/seguimientoDatos.js');
  const username = `t_${crypto.randomBytes(4).toString('hex')}`;
  usuarioId = (await query(
    "INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES (?, 'x', 'Persona de Prueba', ?, 'admin', 1)",
    [username, `${username}@rpad.test`]
  )).insertId;
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  process.env.EMAIL_SOLO_A = '';
  // limpiarBase comprueba que la base es de prueba; los cambios se van con sus datasets
  await limpiarBase();
  await query('DELETE FROM metricas_fotos');
  // Las notas DGMIT no se van con sus datasets (solo sus filas de notas_dgmit_datasets)
  await query('DELETE FROM notas_dgmit');
  await configurarNotas();
  await mailpit.vaciar();
});

// Instante de una fecha y hora de Argentina (UTC-3), en segundos: las columnas TIMESTAMP se cargan con FROM_UNIXTIME, que no
// depende de la zona horaria de la base (en Docker es UTC)
const instante = (texto) => Date.parse(`${texto.replace(' ', 'T')}-03:00`) / 1000;
const fijarAlta = (datasetId, momento) => query('UPDATE datasets SET created_at = FROM_UNIXTIME(?) WHERE id = ?', [instante(momento), datasetId]);

// Un cambio aprobado, como lo deja aprobarCambio (los JSON como texto)
const aprobado = ({ tipo = 'editar', datasetId, creado, revisado, nuevos = {}, anteriores = null }) => query(
  `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, datos_anteriores, usuario_id, estado, revisor_id, created_at,
     revisado_at) VALUES (?, ?, ?, ?, ?, 'aprobado', ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))`,
  [tipo, datasetId, JSON.stringify(nuevos), anteriores && JSON.stringify(anteriores), usuarioId, usuarioId, instante(creado), instante(revisado)]
);

// Una actualización registrada: la próxima pasa de `de` a `a`, la carga de `cargaAnterior` a `carga`, con su «Recibido el»
const actualizacion = ({ datasetId, creado, revisado, de, a, cargaAnterior, carga, recibido, origen }) => aprobado({
  datasetId, creado, revisado,
  anteriores: { proxima_actualizacion: de, ultima_actualizacion: cargaAnterior },
  nuevos: {
    proxima_actualizacion: a, ultima_actualizacion: carga, registro_actualizacion: true, recibido_el: recibido,
    ...(origen ? { origen_datos: origen } : {})
  }
});

// Un email viejo a la DGMIT que se envió
const emailEnviado = ({ tipo, datasetId, enviado }) => query(
  `INSERT INTO notificaciones_log (tipo, area_id, destinatarios, datasets_ids, cantidad_datasets, enviado_at, success)
   VALUES (?, NULL, 'mit@rpad.test', ?, 1, FROM_UNIXTIME(?), 1)`,
  [tipo, String(datasetId), instante(enviado)]
);

// El año 2026 de tres datasets anuales, todos dados de alta el 15/01/2026 salvo el C:
// - A, externo con «Requiere nota DGMIT» Sí: vencía el 30/11/2026 y se avisó por la regla el 21/10/2026 (el email de 40 días); los
//   datos llegaron el 29/12/2026 y se cargaron el 30/12/2026, pero la actualización se aprobó el 05/01/2027;
// - B, interno: vencía el 30/11/2026 y se avisó el 01/10/2026 (el email de 60 días); los datos llegaron el 02/01/2027 y se cargaron el
//   03/01/2027 (aprobada ese día);
// - C, externo: se actualizó el 10/06/2025 y se dio de baja el 20/11/2025, antes de vencer: no toca 2026.
const prepararElAnio = async () => {
  const a = await crearDataset({
    titulo: 'Dataset A de prueba', gestion: 'externa', requiereNota: 1, vencimiento: '2027-11-30', ultima: '2026-12-30'
  });
  await fijarAlta(a, '2026-01-15 10:00:00');
  await emailEnviado({ tipo: 'externo-40', datasetId: a, enviado: '2026-10-21 08:15:00' });
  await actualizacion({
    datasetId: a, creado: '2027-01-04 09:00:00', revisado: '2027-01-05 10:00:00', de: '2026-11-30', a: '2027-11-30',
    cargaAnterior: '2025-12-15', carga: '2026-12-30', recibido: '2026-12-29', origen: 'area'
  });

  const b = await crearDataset({ titulo: 'Dataset B de prueba', gestion: 'interna', vencimiento: '2027-11-30', ultima: '2027-01-03' });
  await fijarAlta(b, '2026-01-15 10:00:00');
  await emailEnviado({ tipo: 'interno-60', datasetId: b, enviado: '2026-10-01 08:15:00' });
  await actualizacion({
    datasetId: b, creado: '2027-01-03 09:00:00', revisado: '2027-01-03 11:00:00', de: '2026-11-30', a: '2027-11-30',
    cargaAnterior: '2025-12-10', carga: '2027-01-03', recibido: '2027-01-02'
  });

  const c = await crearDataset({
    titulo: 'Dataset C de prueba', gestion: 'externa', requiereNota: 1, vencimiento: '2025-12-31', ultima: '2025-06-10', activo: 0
  });
  await fijarAlta(c, '2025-03-01 10:00:00');
  await actualizacion({
    datasetId: c, creado: '2025-06-10 09:00:00', revisado: '2025-06-10 10:00:00', de: '2025-05-31', a: '2025-12-31',
    cargaAnterior: '2024-06-01', carga: '2025-06-10', recibido: '2025-06-05', origen: 'area'
  });
  await aprobado({ tipo: 'eliminar', datasetId: c, creado: '2025-11-20 09:00:00', revisado: '2025-11-20 10:00:00' });
  return { a, b, c };
};

const sacar = (hoy) => foto.sacarFotoSiCorresponde({ hoy });

// La corrida diaria de las 8:15 (el controlador del cron, sin pasar por /api/cron/*) en un momento fijo: el reloj se simula solo
// mientras corre. Devuelve lo que respondió
const corridaDiaria = async (momento) => {
  const res = {
    statusCode: null, body: null,
    status(codigo) { this.statusCode = codigo; return this; },
    json(cuerpo) { this.body = cuerpo; return this; }
  };
  mock.timers.enable({ apis: ['Date'], now: new Date(momento) });
  try {
    await controlador.ejecutarNotificacionesDiarias({}, res);
  } finally {
    mock.timers.reset();
  }
  return res;
};

const ultimaCorrida = async () => (await query(
  `SELECT DATE_FORMAT(ultima_corrida_fecha, '%Y-%m-%d') fecha, ultima_corrida_resultado resultado, ultima_corrida_con_errores con_errores
   FROM notas_digitales_config WHERE id = 1`
))[0];

describe('la foto del 31/12', () => {
  it('el 09/01/2027 no saca la foto', async () => {
    await prepararElAnio();
    assert.equal(await sacar('2027-01-09'), null);
    // Antes del primer año de las métricas tampoco: en 2026 no hay foto de 2025 que sacar (la corrida de hoy no hace nada)
    for (const hoy of ['2026-01-10', '2026-10-24', '2026-12-31']) assert.equal(await sacar(hoy), null, hoy);
    // Un hoy que no es una fecha, tampoco
    for (const hoy of ['2027-13-10', '10/01/2027', null]) assert.equal(await sacar(hoy), null, String(hoy));
    assert.deepEqual(await foto.aniosConFoto(), []);
    assert.equal(await foto.leerFoto(2026), null);
    assert.equal(await foto.leerFoto(2025), null);
    // La corrida del 09/01 no la saca ni lo cuenta como error
    const res = await corridaDiaria('2027-01-09T11:15:00Z');
    assert.equal(res.body.data.foto, null);
    assert.ok(!res.body.data.errores.some((e) => e.tipo === 'foto-del-anio'), JSON.stringify(res.body.data.errores));
    assert.deepEqual(await foto.aniosConFoto(), []);
  });

  it('el 10/01/2027 la saca al 31/12/2026 y una segunda llamada devuelve ya', async () => {
    const { a, b, c } = await prepararElAnio();
    assert.deepEqual(await sacar('2027-01-10'), { anio: 2026, sacada: true });
    const guardada = await foto.leerFoto(2026);
    assert.deepEqual([guardada.anio, guardada.al], [2026, AL]);
    assert.deepEqual(Object.keys(guardada.datos), [
      'version', 'casos', 'vistas', 'cintas', 'contexto', 'trabajo', 'areas', 'etapas', 'feriados', 'generada'
    ]);
    assert.equal(guardada.datos.version, 1);
    // La tabla de esta base está vacía: la tabla no sacó ningún día hábil
    assert.deepEqual(guardada.datos.feriados, []);
    assert.match(guardada.datos.generada, MOMENTO);
    assert.deepEqual(await foto.aniosConFoto(), [2026]);

    // Lo que dan las reglas al 31/12 con todos los datasets de la base: los casos que tocan el año, las cuatro vistas y sus cintas, el
    // contexto, el trabajo con cada estadístico y las áreas
    const fuentes = await seguimientoDatos.fuentesDe(null);
    const casos = casosDe(fuentes, { hoy: AL });
    const opciones = { anio: 2026, al: AL };
    assert.deepEqual(guardada.datos.casos, casosQueTocanElAnio(casos, opciones));
    const vistasDeAhora = {};
    for (const estadistico of ESTADISTICOS) {
      for (const dias of DIAS) {
        const clave = foto.claveDeLaVista(estadistico, dias);
        const vista = vistaDe(casos, { ...opciones, estadistico, dias, sin: [] });
        vistasDeAhora[clave] = vista;
        assert.deepEqual(guardada.datos.vistas[clave], vista, clave);
        assert.deepEqual(guardada.datos.cintas[clave], {
          externa: cintaDeMetricas(vista.circuito.externa, { gestion: 'externa', dias, estadistico }),
          interna: cintaDeMetricas(vista.circuito.interna, { gestion: 'interna', dias, estadistico })
        }, clave);
      }
    }
    assert.deepEqual([Object.keys(guardada.datos.vistas), Object.keys(guardada.datos.cintas)], [CLAVES, CLAVES]);
    assert.ok(guardada.datos.cintas['mediana-habiles'].externa, 'la cinta externa se dibuja (hay aviso anticipado)');
    assert.deepEqual(guardada.datos.contexto, {
      indice: indiceMesAMes(fuentes, opciones), indice_vacio: null, antiguedad: antiguedadDeVencidos(fuentes, opciones),
      estados: estadosAl(fuentes, opciones)
    });
    assert.deepEqual(guardada.datos.trabajo, {
      mediana: trabajoDelAnio(fuentes, casos, { ...opciones, estadistico: 'mediana' }),
      promedio: trabajoDelAnio(fuentes, casos, { ...opciones, estadistico: 'promedio' })
    });
    assert.deepEqual(guardada.datos.areas, areasYTemas(fuentes, opciones));
    // Solo los casos que tocan 2026: los dos de A (el que vencía el 30/11 y el que abrió la carga del 30/12) y el de B que vencía el
    // 30/11; ni el que abrió la carga del 03/01/2027 ni los de C, de 2025
    assert.deepEqual(guardada.datos.casos.map((caso) => [caso.dataset_id, caso.venc]), [[a, '2026-11-30'], [a, '2027-11-30'], [b, '2026-11-30']]);
    assert.ok(casos.some((caso) => caso.dataset_id === c) && casos.some((caso) => caso.dataset_id === b && caso.venc === '2027-11-30'));
    // La vista de 2026 con los casos de la foto es la misma que con todos, con cualquier estadístico y días
    for (const estadistico of ['mediana', 'promedio']) {
      for (const dias of ['habiles', 'corridos']) {
        assert.deepEqual(vistaDe(guardada.datos.casos, { ...opciones, estadistico, dias }), vistaDe(casos, { ...opciones, estadistico, dias }));
      }
    }

    // Una segunda llamada, el mismo día o meses después, no la vuelve a sacar ni la pisa, aunque la base haya cambiado: A cambió de
    // título y se le cargó una nota DGMIT recibida el 10/12/2026 (con la base de hoy, la vista de 2026 ya no es la misma)
    await query('UPDATE datasets SET titulo = ? WHERE id = ?', ['Otro título', a]);
    const notaDgmit = (await query(
      "INSERT INTO notas_dgmit (numero, tipo, recibida, anulada) VALUES ('45/26', 'solicitud', '2026-12-10', 0)"
    )).insertId;
    await query('INSERT INTO notas_dgmit_datasets (nota_id, dataset_id) VALUES (?, ?)', [notaDgmit, a]);
    const casosDespues = casosDe(await seguimientoDatos.fuentesDe(null), { hoy: AL });
    for (const clave of CLAVES) {
      const [estadistico, dias] = clave.split('-');
      assert.notDeepEqual(vistaDe(casosDespues, { ...opciones, estadistico, dias, sin: [] }), vistasDeAhora[clave], clave);
    }
    assert.deepEqual(await sacar('2027-01-10'), { anio: 2026, ya: true });
    assert.deepEqual(await sacar('2027-06-15'), { anio: 2026, ya: true });
    assert.deepEqual(await foto.leerFoto(2026), guardada);
    assert.equal(guardada.datos.casos[0].titulo, 'Dataset A de prueba');
    assert.equal(guardada.datos.vistas['mediana-habiles'].circuito.externa.find((t) => t.clave === 'tramite').cifra, null);
    assert.deepEqual(await foto.aniosConFoto(), [2026]);
    // Un año sin foto, o que no es un año, no tiene foto
    for (const anio of [2027, '2026x', '', null, undefined, 2026.5]) assert.equal(await foto.leerFoto(anio), null, String(anio));
    assert.deepEqual(await foto.leerFoto('2026'), guardada);
  });

  it('una foto que no se puede leer no pasa por «todavía no hay foto» y tampoco se vuelve a sacar', async () => {
    await query("INSERT INTO metricas_fotos (anio, al, datos) VALUES (2026, '2026-12-31', '{roto')");
    await assert.rejects(foto.leerFoto(2026), { message: 'La foto de 2026 no se puede leer' });
    await query("UPDATE metricas_fotos SET datos = '{\"version\": 2, \"casos\": []}' WHERE anio = 2026");
    await assert.rejects(foto.leerFoto(2026), { message: 'La foto de 2026 no se puede leer' });
    // De la versión 1, pero sin las vistas ya calculadas
    await query('UPDATE metricas_fotos SET datos = ? WHERE anio = 2026',
      [JSON.stringify({ version: 1, casos: [], cintas: {}, contexto: {}, trabajo: {}, areas: {}, generada: '2027-01-10 08:15:00' })]);
    await assert.rejects(foto.leerFoto(2026), { message: 'La foto de 2026 no se puede leer' });
    assert.deepEqual(await foto.aniosConFoto(), [2026]);
    assert.deepEqual(await sacar('2027-01-10'), { anio: 2026, ya: true });
  });

  it('dos corridas a la vez guardan una sola foto: una la saca y la otra ve que ya está', async () => {
    await prepararElAnio();
    const resultados = await Promise.all([sacar('2027-01-10'), sacar('2027-01-10')]);
    assert.deepEqual(resultados.map((r) => JSON.stringify(r)).sort(), [
      JSON.stringify({ anio: 2026, sacada: true }), JSON.stringify({ anio: 2026, ya: true })
    ]);
    assert.equal(Number((await query('SELECT COUNT(*) n FROM metricas_fotos'))[0].n), 1);
  });

  // Ruling 18: si una corrida no pudo sacarla, la siguiente la reintenta, aunque haya pasado el año: de a una por corrida y primero la
  // más vieja, siempre al 31/12 de su año
  it('el 01/03/2028 sin fotos saca primero la de 2026 y en la llamada siguiente la de 2027, cada una al 31/12 de su año', async () => {
    await prepararElAnio();
    assert.deepEqual(await sacar('2028-03-01'), { anio: 2026, sacada: true });
    assert.deepEqual(await foto.aniosConFoto(), [2026]);
    assert.deepEqual(await sacar('2028-03-01'), { anio: 2027, sacada: true });
    assert.deepEqual(await foto.aniosConFoto(), [2026, 2027]);
    assert.deepEqual(await sacar('2028-03-01'), { anio: 2027, ya: true });
    // Cada una da lo mismo que si se hubiera sacado a tiempo: al 31/12 de su año, con todos los datasets
    const fuentes = await seguimientoDatos.fuentesDe(null);
    for (const anio of [2026, 2027]) {
      const guardada = await foto.leerFoto(anio);
      assert.equal(guardada.al, `${anio}-12-31`);
      const esperados = foto.datosDeLaFoto(fuentes, { anio, generada: guardada.datos.generada });
      assert.deepEqual(guardada.datos, JSON.parse(JSON.stringify(esperados)), String(anio));
    }
    // La de 2026 trae el año 2026 (la carga del 30/12/2026 de A) y la de 2027, el 2027 (la del 03/01/2027 de B)
    const [de2026, de2027] = [(await foto.leerFoto(2026)).datos, (await foto.leerFoto(2027)).datos];
    assert.deepEqual([de2026.trabajo.mediana.actualizaciones, de2027.trabajo.mediana.actualizaciones], [1, 1]);
    assert.equal(de2027.trabajo.mediana.por_mes.actualizaciones[0], 1);
  });

  it('con la de 2026 ya sacada, el 01/03/2028 saca la de 2027; antes del 10/01/2028, la de 2027 todavía no toca', async () => {
    await prepararElAnio();
    assert.deepEqual(await sacar('2027-01-10'), { anio: 2026, sacada: true });
    assert.deepEqual(await sacar('2028-01-09'), { anio: 2026, ya: true });
    assert.deepEqual(await foto.aniosConFoto(), [2026]);
    assert.deepEqual(await sacar('2028-03-01'), { anio: 2027, sacada: true });
    assert.deepEqual(await foto.aniosConFoto(), [2026, 2027]);
  });

  it('el 09/01/2028 sin fotos saca la de 2026, que no se sacó a tiempo; la de 2027 espera al 10/01', async () => {
    await prepararElAnio();
    assert.deepEqual(await sacar('2028-01-09'), { anio: 2026, sacada: true });
    assert.deepEqual(await sacar('2028-01-09'), { anio: 2026, ya: true });
    assert.deepEqual(await foto.aniosConFoto(), [2026]);
    assert.deepEqual(await sacar('2028-01-10'), { anio: 2027, sacada: true });
  });

  it('una carga del 05/01/2027 con fecha 30/12/2026 entra; una del 03/01/2027 queda en curso al 31/12', async () => {
    const { a, b } = await prepararElAnio();
    await sacar('2027-01-10');
    const { datos } = await foto.leerFoto(2026);
    // La vista guardada (mediana en días hábiles) es la de los casos guardados
    const v = datos.vistas['mediana-habiles'];
    assert.deepEqual(v, vistaDe(datos.casos, { anio: 2026, al: AL }));
    const filaDe = (id) => v.casos.find((f) => f.dataset_id === id && f.vencimiento === '2026-11-30');
    const tramoDe = (gestion, clave) => v.circuito[gestion].find((t) => t.clave === clave);

    // A: la carga del 30/12, aprobada el 05/01, entra en 2026: un día hábil después de los datos del 29/12, y después del vencimiento
    assert.deepEqual([filaDe(a).recibido.fecha, filaDe(a).carga], ['2026-12-29', { fecha: '2026-12-30', texto: '1' }]);
    assert.deepEqual([tramoDe('externa', 'carga').cifra.valor, tramoDe('externa', 'carga').cifra.ciclos], [1, 1]);
    assert.deepEqual([v.resultados.a_tiempo.a_tiempo, v.resultados.a_tiempo.total, v.resultados.a_tiempo.externa], [0, 1, [0, 1]]);
    assert.equal(datos.trabajo.mediana.actualizaciones, 1);
    assert.equal(datos.trabajo.mediana.por_mes.actualizaciones[11], 1);

    // B: los datos llegaron el 02/01/2027 y la carga es del 03/01/2027: al 31/12, la producción del relevamiento estaba en curso desde
    // el aviso del 01/10, y no hay carga en 2026
    const hace = duracion('2026-10-01', AL, 'habiles');
    assert.deepEqual(tramoDe('interna', 'produccion').en_curso,
      { n: 1, valor: hace, texto: `1 sin datos registrados todavía, hace ${hace} días hábiles (mediana)` });
    assert.equal(tramoDe('interna', 'produccion').cifra, null);
    assert.equal(tramoDe('interna', 'carga').cifra, null);
    assert.deepEqual([filaDe(b).recibido, filaDe(b).carga], [{ fecha: null, texto: `en curso, hace ${hace}`, origen: '' }, { fecha: null, texto: '' }]);
    assert.deepEqual([v.resultados.a_tiempo.interna], [[0, 0]]);

    // El contexto va con el reloj del RPAD (Ruling 12): al 31/12 la actualización de A todavía no estaba aprobada, así que A figuraba
    // vencido, como B; C ya se había dado de baja
    assert.deepEqual(datos.contexto.antiguedad, {
      total: 2, menos_de_3_meses: 2, de_3_a_12: 0, mas_de_un_anio: 0, al_inicio: { total: 0, actualizados: 0 },
      textos: { titulo: 'Al 31/12/2026: 2 datasets vencidos', inicio: 'Al 1/1/2026 no había datasets vencidos.' }
    });
    assert.deepEqual(datos.contexto.indice.at(-1), { dia: AL, tasa: 0, al_dia: 0, base: 2, etiqueta: '31/12', texto: 'Al 31/12/2026: 0% al día (0 de 2)' });
    assert.deepEqual(datos.contexto.estados, {
      dia: AL, total: 2, actualizado: 0, proximo: 0, atrasado: 1, sin_respuesta: 1, sin_fecha: 0, eventual: 0, desconocido: 0, vencidos: 2,
      al_dia: 0, tasa: 0
    });
    assert.deepEqual(datos.areas.ranking.map((area) => [area.total_datasets, area.al_dia, area.porcentaje]), [[1, 0, 0], [1, 0, 0]]);
  });

  // El Ciclo de vida del dato (spec 2026-10-25-ciclo-de-vida-del-dato, 3.3): la foto guarda las etapas, calculadas una sola vez con los
  // casos del año (ya traen los días hábiles y los corridos, la mediana y el promedio)
  it('la foto guarda etapas y son las de etapasDe con sus casos', async () => {
    const { a } = await prepararElAnio();
    await sacar('2027-01-10');
    const { datos } = await foto.leerFoto(2026);
    const opciones = { anio: 2026, al: AL };
    // Las de etapasDe con los casos guardados, que son las mismas que con todos los casos de la base al 31/12 (las del año en vivo)
    const casos = casosDe(await seguimientoDatos.fuentesDe(null), { hoy: AL });
    assert.deepEqual(datos.etapas, JSON.parse(JSON.stringify(etapasDe(datos.casos, opciones))));
    assert.deepEqual(datos.etapas, JSON.parse(JSON.stringify(etapasDe(casos, opciones))));
    assert.deepEqual([datos.etapas.anio, datos.etapas.al], [2026, AL]);
    assert.deepEqual(datos.etapas.externa.map((etapa) => etapa.clave), ['aviso', 'tramite', 'respuesta', 'carga']);
    assert.deepEqual(datos.etapas.interna.map((etapa) => etapa.clave), ['aviso', 'produccion', 'carga']);

    // Cada etapa coincide con su tramo en las cuatro vistas guardadas: la mediana y el promedio, en días hábiles y en corridos, de los
    // mismos ciclos
    for (const gestion of ['externa', 'interna']) {
      for (const etapa of datos.etapas[gestion]) {
        for (const estadistico of ESTADISTICOS) {
          for (const dias of DIAS) {
            const donde = `${gestion} ${etapa.clave} ${estadistico} ${dias}`;
            const tramo = datos.vistas[foto.claveDeLaVista(estadistico, dias)].circuito[gestion].find((t) => t.clave === etapa.clave);
            const cifras = dias === 'habiles' ? etapa.habiles : etapa.corridos;
            assert.equal(cifras?.[estadistico] ?? null, tramo.cifra?.valor ?? null, donde);
            if (dias === 'habiles') assert.equal(etapa.n, tramo.cifra?.ciclos ?? 0, donde);
          }
        }
      }
    }

    // A: la carga del 30/12 de los datos del 29/12 es el único caso de la carga externa, un día hábil (y uno corrido) después
    const carga = datos.etapas.externa.find((etapa) => etapa.clave === 'carga');
    assert.deepEqual([carga.n, carga.habiles, carga.corridos, carga.corto],
      [1, { mediana: 1, promedio: 1 }, { mediana: 1, promedio: 1 }, null]);
    assert.deepEqual([carga.largo.rotulo, carga.largo.dataset_id, carga.largo.dataset_texto], ['El único caso', a, 'Dataset A de prueba']);
    // B: al 31/12, la producción del relevamiento estaba en curso desde el aviso del 01/10: sin ciclos terminados, con su renglón
    const produccion = datos.etapas.interna.find((etapa) => etapa.clave === 'produccion');
    const hace = duracion('2026-10-01', AL, 'habiles');
    assert.deepEqual([produccion.n, produccion.habiles, produccion.largo], [0, null, null]);
    assert.deepEqual(produccion.textos.notas.filter((nota) => nota.tipo === 'en_curso'),
      [{ tipo: 'en_curso', texto: `En curso: 1 sin datos registrados todavía, hace ${hace} días hábiles (mediana)` }]);
  });

  // Foco 4 (spec 2026-10-25-ciclo-de-vida-del-dato, 3.3): una foto sacada antes de este despliegue no tiene etapas. Se calculan con los
  // casos que guardó (la única excepción a Ruling 16) y dan lo mismo que las que habría guardado
  it('una foto sin etapas se lee igual', async () => {
    const { a } = await prepararElAnio();
    await sacar('2027-01-10');
    const nueva = await foto.leerFoto(2026);
    // Con la clave, son las guardadas, tal cual: no se recalculan
    assert.equal(foto.etapasDeLaFoto(nueva), nueva.datos.etapas);

    // La misma foto como la dejaba el código anterior: sin etapas ni feriados (en esta base, la tabla está vacía). Se sigue leyendo
    // (la versión es la misma)
    const { etapas, feriados, ...sinEtapas } = nueva.datos;
    assert.deepEqual(feriados, []);
    await query('UPDATE metricas_fotos SET datos = ? WHERE anio = 2026', [JSON.stringify(sinEtapas)]);
    const vieja = await foto.leerFoto(2026);
    assert.deepEqual(Object.keys(vieja.datos), ['version', 'casos', 'vistas', 'cintas', 'contexto', 'trabajo', 'areas', 'generada']);
    assert.deepEqual(foto.etapasDeLaFoto(vieja), etapas);

    // Con los casos guardados, no con la base de hoy: A cambió de título y se le cargó una nota DGMIT recibida el 10/12/2026 (en
    // vivo, las etapas de 2026 ya no son las mismas)
    await query('UPDATE datasets SET titulo = ? WHERE id = ?', ['Otro título', a]);
    const notaDgmit = (await query(
      "INSERT INTO notas_dgmit (numero, tipo, recibida, anulada) VALUES ('45/26', 'solicitud', '2026-12-10', 0)"
    )).insertId;
    await query('INSERT INTO notas_dgmit_datasets (nota_id, dataset_id) VALUES (?, ?)', [notaDgmit, a]);
    const enVivo = etapasDe(casosDe(await seguimientoDatos.fuentesDe(null), { hoy: AL }), { anio: 2026, al: AL });
    assert.notDeepEqual(JSON.parse(JSON.stringify(enVivo)), etapas);
    assert.deepEqual(foto.etapasDeLaFoto(await foto.leerFoto(2026)), etapas);

    // Si no se pueden calcular (un año que no es un año) o lo guardado no son etapas, tira, como una foto que no se puede leer
    assert.throws(() => foto.etapasDeLaFoto({ anio: 'x', datos: sinEtapas }), { message: 'La foto de x no se puede leer' });
    for (const roto of [null, 'etapas', []]) {
      assert.throws(() => foto.etapasDeLaFoto({ anio: 2026, datos: { ...sinEtapas, etapas: roto } }),
        { message: 'La foto de 2026 no se puede leer' }, JSON.stringify(roto));
    }
  });

  // Los feriados de la foto (spec 2026-10-27-feriados-en-notas, 5): una foto sin etapas se recalcula con el calendario con el que se
  // sacó, el de sus `feriados` (los días que la tabla sacó de los hábiles); sin ellos, con los 9 fijos, como la sacaba el código
  // anterior. En esta base la tabla está vacía: los feriados se ponen a mano en la foto
  it('una foto sin etapas se recalcula con sus feriados', async () => {
    await prepararElAnio();
    await sacar('2027-01-10');
    const { etapas, feriados, ...sinNada } = (await foto.leerFoto(2026)).datos;
    assert.deepEqual(feriados, []);
    const opciones = { anio: 2026, al: AL };
    const avisoExterno = (calculadas) => calculadas.externa.find((etapa) => etapa.clave === 'aviso').habiles.mediana;

    // Sin feriados, con los 9 fijos: A se avisó el 21/10 y vencía el 30/11, 28 días hábiles
    assert.deepEqual(foto.etapasDeLaFoto({ anio: 2026, datos: sinNada }), etapas);
    assert.equal(avisoExterno(foto.etapasDeLaFoto({ anio: 2026, datos: sinNada })), 28);

    // Con el 02/11 entre sus feriados, uno menos
    const conElDosDeNoviembre = { ...sinNada, feriados: ['2026-11-02'] };
    const recalculadas = foto.etapasDeLaFoto({ anio: 2026, datos: conElDosDeNoviembre });
    assert.deepEqual(recalculadas,
      etapasDe(sinNada.casos, { ...opciones, calendario: calendarioDeFechas(['2026-11-02']) }));
    assert.equal(avisoExterno(recalculadas), 27);

    // Unos feriados que no son una lista de fechas: la foto no se puede leer
    for (const raros of ['x', ['no es una fecha'], ['2026-11-02', '2026-02-30'], null, {}, [null]]) {
      assert.throws(() => foto.etapasDeLaFoto({ anio: 2026, datos: { ...sinNada, feriados: raros } }),
        { message: 'La foto de 2026 no se puede leer' }, JSON.stringify(raros));
    }

    // Con las etapas guardadas, los feriados no se miran (Ruling 16: no se recalculan)
    for (const raros of ['x', ['no es una fecha'], ['2026-11-02']]) {
      const conEtapas = { ...sinNada, etapas, feriados: raros };
      assert.equal(foto.etapasDeLaFoto({ anio: 2026, datos: conEtapas }), etapas, JSON.stringify(raros));
    }
  });

  // El reporte nuevo nunca frena la foto del 31/12, que no se vuelve a sacar: si calcular las etapas tira, la parte de las etapas
  // queda vacía (la foto sale sin la clave) y el error va a console.error; al leerla, etapasDeLaFoto las calcula con sus casos
  it('si calcular las etapas tira, la foto sale igual, sin etapas', async () => {
    await prepararElAnio();
    const opciones = { anio: 2026, al: AL };
    const datos = foto.datosDeLaFoto(await seguimientoDatos.fuentesDe(null), { anio: 2026, generada: '2027-01-10 08:15:00' });
    // Sin falla, la parte trae las de etapasDe, que son las que guarda la foto
    assert.deepEqual(foto.etapasParaLaFoto(datos.casos, opciones), { etapas: etapasDe(datos.casos, opciones) });
    assert.deepEqual(datos.etapas, foto.etapasParaLaFoto(datos.casos, opciones).etapas);

    // Con una falla, la parte queda vacía y el error se registra una vez, con el año y el error
    const falla = new Error('falla simulada de etapasDe');
    const errores = mock.method(console, 'error', () => {});
    let parte;
    try {
      parte = foto.etapasParaLaFoto(datos.casos, opciones, () => { throw falla; });
    } finally {
      errores.mock.restore();
    }
    assert.deepEqual(parte, {});
    assert.equal(errores.mock.callCount(), 1);
    assert.match(String(errores.mock.calls[0].arguments[0]), /foto de 2026/);
    assert.equal(errores.mock.calls[0].arguments[1], falla);

    // La foto armada con esa parte (como la arma datosDeLaFoto) tiene todo lo demás, sin la clave, y se guarda y se lee igual: las
    // etapas salen de sus casos y son las que habría guardado
    const { etapas, generada, ...resto } = datos;
    const sinEtapas = { ...resto, ...parte, generada };
    assert.deepEqual(Object.keys(sinEtapas),
      ['version', 'casos', 'vistas', 'cintas', 'contexto', 'trabajo', 'areas', 'feriados', 'generada']);
    await query('INSERT INTO metricas_fotos (anio, al, datos) VALUES (2026, ?, ?)', [AL, JSON.stringify(sinEtapas)]);
    const leida = await foto.leerFoto(2026);
    assert.deepEqual(leida.datos, JSON.parse(JSON.stringify(sinEtapas)));
    assert.deepEqual(foto.etapasDeLaFoto(leida), JSON.parse(JSON.stringify(etapas)));
  });

  it('un error al guardar no tira: queda en la última corrida y con_errores = 1', async () => {
    await prepararElAnio();
    // El 10/01/2027 es domingo: las Notas Digitales no corren, pero la foto no depende de que sea día hábil. El error va al log: acá
    // se calla y se comprueba que se registró
    const log = mock.method(console, 'error', () => {});
    let res;
    try {
      res = await conFallaSimulada('INSERT', 'NEW.anio = 2026', () => corridaDiaria('2027-01-10T11:15:00Z'), 'metricas_fotos');
    } finally {
      log.mock.restore();
    }
    assert.deepEqual(log.mock.calls.map((llamada) => llamada.arguments[0]), ['Error en la foto del año:']);
    assert.match(String(log.mock.calls[0].arguments[1]), /Falla simulada/);
    assert.equal(res.statusCode, 207);
    assert.equal(res.body.success, false);
    assert.deepEqual(res.body.data.errores, [{ tipo: 'foto-del-anio', error: 'Falla simulada' }]);
    assert.equal(res.body.data.foto, null);
    assert.equal(res.body.data.notasDigitales.motivo, 'Día no hábil');
    assert.deepEqual(await ultimaCorrida(), {
      fecha: '2027-01-10', resultado: 'Día no hábil · No se pudo sacar la foto del año: Falla simulada', con_errores: 1
    });
    assert.deepEqual(await foto.aniosConFoto(), []);

    // La corrida del día siguiente la saca
    const otra = await corridaDiaria('2027-01-11T11:15:00Z');
    assert.deepEqual(otra.body.data.foto, { anio: 2026, sacada: true });
    assert.ok(!otra.body.data.errores.some((e) => e.tipo === 'foto-del-anio'));
    assert.deepEqual(await foto.aniosConFoto(), [2026]);
    assert.equal((await ultimaCorrida()).fecha, '2027-01-11');
  });

  it('anotar en la última corrida suma el texto a lo que ya dice, sin pasar de 1000 caracteres', async () => {
    const { anotarEnLaUltimaCorrida } = await import('../services/notasDigitales.js');
    // Sin resultado (NULL), el texto solo
    await anotarEnLaUltimaCorrida('Primero');
    assert.deepEqual(await ultimaCorrida(), { fecha: null, resultado: 'Primero', con_errores: 1 });
    await anotarEnLaUltimaCorrida('Segundo');
    assert.equal((await ultimaCorrida()).resultado, 'Primero · Segundo');
    // Lo largo se corta en 1000
    await anotarEnLaUltimaCorrida('x'.repeat(1200));
    const { resultado } = await ultimaCorrida();
    assert.equal(resultado.length, 1000);
    assert.ok(resultado.startsWith('Primero · Segundo · x'));
  });
});
