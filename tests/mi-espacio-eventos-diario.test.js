// El aviso diario de la agenda (spec 2026-11-04-agenda-aviso-y-dependencia, 4 a 6; services/miEspacioEventosDiario.js): sale a las 14:00 y, a
// los superiores, a las 8:05, viaja en dos corridas que ya existen y no frena nada de ellas, ni al revés. Contra una base de prueba propia, con
// personas «Test <clave>» y casillas @rpad.test que cambian en cada test. Se llama al servicio y a los controladores (nunca a /api/cron/*), con
// un momento fijo de Argentina. Las fechas: el jueves 05/11/2026, el viernes 06/11, el sábado 07/11 y el lunes 09/11.
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { crearBaseDePrueba, cerrarDb, query, db, mailpit, paraCasilla } from './helpers.js';
import { asegurarBaseDePrueba } from './notas-fixtures.js';
import { CALENDARIO_FIJO } from '../services/notasDigitalesCalendario.js';

const JUEVES_14 = '2026-11-05 14:00:00';
const VIERNES_8 = '2026-11-06 08:05:00';
const VIERNES_14 = '2026-11-06 14:00:00';
const TABLAS = ['mi_espacio_diario_envios', 'mi_espacio_evento_informados', 'mi_espacio_evento_envios', 'mi_espacio_evento_personas', 'mi_espacio_evento_vistas',
  'mi_espacio_eventos', 'mi_espacio_eventos_corridas', 'feriados', 'usuarios_licencias', 'cambios_pendientes', 'usuarios'];
const calendario = CALENDARIO_FIJO;

let base, dbReal, emailSoloA, servicio, controlador, pool;

before(async () => {
  dbReal = process.env.DB_NAME;
  emailSoloA = process.env.EMAIL_SOLO_A;
  base = await crearBaseDePrueba('rpad_test_mi_espacio_eventos_diario');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba
  servicio = await import('../services/miEspacioEventosDiario.js');
  controlador = await import('../controllers/notificacionesController.js');
  pool = (await import('../config/database.js')).default;
});

after(async () => {
  await pool?.end();
  await cerrarDb();
  if (emailSoloA === undefined) delete process.env.EMAIL_SOLO_A;
  else process.env.EMAIL_SOLO_A = emailSoloA;
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  process.env.EMAIL_SOLO_A = '';
  await asegurarBaseDePrueba();
  await query('UPDATE usuarios SET depende_de = NULL');
  for (const tabla of TABLAS) await query(`DELETE FROM ${tabla}`);
});

const sufijo = () => crypto.randomBytes(3).toString('hex');
const persona = async ({ clave, rol = 'lector', dependeDe = null, email = null, activo = 1, porMail = 1 }) => {
  const username = `t_di_${sufijo()}`;
  const casilla = email ?? `${username}@rpad.test`;
  const { insertId: id } = await query(
    `INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo, depende_de, eventos_por_mail) VALUES (?, 'x', ?, ?, ?, ?, ?, ?)`,
    [username, `Test ${clave}`, casilla, rol, activo, dependeDe?.id ?? null, porMail]
  );
  return { id, email: casilla };
};
// Graciela arriba, Federico depende de ella y Micaela, de él; Lucía no depende de nadie
const cadena = async () => {
  const graciela = await persona({ clave: 'graciela', rol: 'admin' });
  const federico = await persona({ clave: 'federico', rol: 'superadmin', dependeDe: graciela });
  const micaela = await persona({ clave: 'micaela', rol: 'editor', dependeDe: federico });
  const lucia = await persona({ clave: 'lucia' });
  return { graciela, federico, micaela, lucia };
};
const MARCA = () => `Secreto-${sufijo()}`;
const evento = async ({
  creador, titulo = MARCA(), detalle = 'Detalle del evento', fecha = '2026-11-06', desde = '10:00', hasta = null, publico = 0, todos = 0, texto = null,
  vistas = [], publicado = null, compartido = 0, personas = [], paraTodos = 0
}) => {
  const { insertId: id } = await query(
    `INSERT INTO mi_espacio_eventos (creado_por, titulo, detalle, fecha, desde, hasta, compartido, para_todos, publico, publico_todos, texto_publico, publicado_at, recordatorio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ninguno')`,
    [creador.id, titulo, detalle, fecha, desde, hasta, compartido, paraTodos, publico, todos, texto, publicado]
  );
  for (const quien of vistas) await query('INSERT INTO mi_espacio_evento_vistas (evento_id, usuario_id) VALUES (?, ?)', [id, quien.id]);
  for (const quien of personas) await query('INSERT INTO mi_espacio_evento_personas (evento_id, usuario_id) VALUES (?, ?)', [id, quien.id]);
  return { id, titulo };
};
const publico = (datos) => evento({ publico: 1, texto: 'Fuera de la oficina', publicado: '2026-11-02 10:00:00', ...datos });

const corrida = (momento, ahora, otroCalendario = calendario) => servicio.ejecutarAvisoDiarioDeEventos({ momento, ahora, calendario: otroCalendario });
const resultado = (cambios = {}) => ({ ocupada: false, dia_habil: true, enviados: 0, fallidos: 0, errores: [], ...cambios });
const recibidos = async (email) => (await mailpit.mensajes()).filter(paraCasilla(email));
const esperarDe = async (email, cantidad = 1) => {
  let mensajes = await recibidos(email);
  for (let intento = 0; intento < 50 && mensajes.length < cantidad; intento++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    mensajes = await recibidos(email);
  }
  return mensajes;
};
const informados = async () => (await query(
  "SELECT evento_id, usuario_id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha FROM mi_espacio_evento_informados ORDER BY evento_id, usuario_id"
)).map((fila) => [Number(fila.evento_id), Number(fila.usuario_id), fila.fecha]);
const envios = async () => (await query(
  "SELECT usuario_id, DATE_FORMAT(dia, '%Y-%m-%d') AS dia, momento, success, enviado_at IS NOT NULL AS terminado FROM mi_espacio_diario_envios ORDER BY usuario_id, id"
)).map((fila) => [Number(fila.usuario_id), fila.dia, fila.momento, Number(fila.success), Number(fila.terminado)]);
const corridaAnotada = async () => (await query('SELECT id, resultado, con_errores, fin_at IS NOT NULL AS termino FROM mi_espacio_eventos_corridas WHERE id = 2'))[0];
const sinBarrera = async (fn) => {
  process.env.EMAIL_SOLO_A = 'nadie@rpad.test';
  const aviso = mock.method(console, 'warn', () => {});
  try {
    return await fn();
  } finally {
    aviso.mock.restore();
    process.env.EMAIL_SOLO_A = '';
  }
};

describe('a las 14:00', () => {
  it('a cada uno lo suyo, en un solo mail: lo propio, y a los superiores el texto corto de su gente; lo informado queda anotado', async () => {
    const { graciela, federico, micaela, lucia } = await cadena();
    const privado = await evento({ creador: micaela });
    const delPublico = await publico({ creador: micaela, vistas: [lucia], hasta: '11:00' });

    assert.deepEqual(await corrida('tarde', JUEVES_14), resultado({ enviados: 3 }));

    const [deMicaela] = await esperarDe(micaela.email);
    assert.equal(deMicaela.Subject, 'RPAD: tu agenda del viernes 06/11');
    const htmlDeMicaela = await mailpit.html(deMicaela.ID);
    assert.ok(htmlDeMicaela.includes(privado.titulo));
    assert.ok(htmlDeMicaela.includes(delPublico.titulo));
    assert.ok(htmlDeMicaela.includes('Solo vos lo ves'));

    for (const superior of [federico, graciela]) {
      const mensajes = await esperarDe(superior.email);
      assert.equal(mensajes.length, 1);
      assert.equal(mensajes[0].Subject, 'RPAD: agenda del viernes 06/11 de quienes dependen de vos');
      const html = await mailpit.html(mensajes[0].ID);
      assert.match(html, /Fuera de la oficina/);
      assert.match(html, /Hasta las 11:00/);
      // **Ni el título ni el detalle de un Público, ni nada de un Privado**
      for (const secreto of [privado.titulo, delPublico.titulo, 'Detalle del evento']) assert.ok(!html.includes(secreto), secreto);
    }
    // A quien solo fue elegida no le llega nada
    assert.deepEqual(await recibidos(lucia.email), []);
    assert.deepEqual(await informados(), [[delPublico.id, federico.id, '2026-11-06'], [delPublico.id, graciela.id, '2026-11-06']].sort((a, b) => a[1] - b[1]));
    assert.deepEqual((await corridaAnotada()).resultado, 'Enviados: 3.');
  });

  it('repetir la corrida no manda de nuevo', async () => {
    const { micaela } = await cadena();
    await publico({ creador: micaela });
    assert.equal((await corrida('tarde', JUEVES_14)).enviados, 3);
    assert.deepEqual(await corrida('tarde', JUEVES_14), resultado());
    assert.equal((await esperarDe(micaela.email)).length, 1);
  });

  it('un envío que falla queda sin marcar y la corrida siguiente lo retoma; una reserva sin terminar no se repite', async () => {
    const { federico, micaela, graciela } = await cadena();
    const delPublico = await publico({ creador: micaela });
    const fallida = await sinBarrera(() => corrida('tarde', JUEVES_14));
    assert.equal(fallida.fallidos, 3);
    assert.equal(fallida.errores.length, 3);
    assert.ok(fallida.errores.every(({ error }) => error === 'No se pudo enviar el email'), 'sin el texto de nodemailer');
    assert.deepEqual(await informados(), []);
    assert.equal(Number((await corridaAnotada()).con_errores), 1);

    // Una que quedó reservada y sin terminar pudo haber salido
    await query('UPDATE mi_espacio_diario_envios SET enviado_at = NULL WHERE usuario_id = ?', [graciela.id]);
    assert.equal((await corrida('tarde', JUEVES_14)).enviados, 2);
    assert.deepEqual(await recibidos(graciela.email), []);
    assert.equal((await esperarDe(federico.email)).length, 1);
    assert.deepEqual((await informados()).map(([id, usuario]) => [id, usuario]), [[delPublico.id, federico.id]]);
    assert.equal((await corrida('tarde', JUEVES_14)).enviados, 0);
  });

  it('no manda: sin nada, sin email válido, desactivado o de licencia oficial; y la cadena sigue', async () => {
    const { graciela, federico, micaela } = await cadena();
    assert.deepEqual(await corrida('tarde', JUEVES_14), resultado());

    await publico({ creador: micaela });
    await query("INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, '2026-11-02', '2026-11-20')", [federico.id]);
    assert.equal((await corrida('tarde', JUEVES_14)).enviados, 2);
    assert.deepEqual(await recibidos(federico.email), []);
    assert.equal((await esperarDe(graciela.email)).length, 1);

    const sinEmail = await persona({ clave: 'sinemail', email: `sin-arroba-${sufijo()}` });
    await evento({ creador: sinEmail });
    const inactiva = await persona({ clave: 'inactiva', activo: 0 });
    await evento({ creador: inactiva });
    assert.equal((await corrida('tarde', VIERNES_14, calendario)).enviados, 0, 'el viernes no hay nada para el lunes');
  });

  it('lo cargado en Mi espacio no frena el mail: solo la licencia oficial', async () => {
    const { micaela } = await cadena();
    await evento({ creador: micaela });
    await query("INSERT INTO mi_espacio_licencias (usuario_id, tipo, desde, hasta, activo) VALUES (?, 'vacaciones', '2026-11-02', '2026-11-20', 1)", [micaela.id]);
    assert.equal((await corrida('tarde', JUEVES_14)).enviados, 1);
  });

  it('sin la casilla, no le llega lo propio; lo de su gente, sí', async () => {
    const graciela = await persona({ clave: 'graciela', rol: 'admin', porMail: 0 });
    const micaela = await persona({ clave: 'micaela', dependeDe: graciela, porMail: 0 });
    await evento({ creador: graciela });
    await publico({ creador: micaela });
    assert.equal((await corrida('tarde', JUEVES_14)).enviados, 1);
    const [mensaje] = await esperarDe(graciela.email);
    assert.equal(mensaje.Subject, 'RPAD: agenda del viernes 06/11 de quienes dependen de vos');
    assert.deepEqual(await recibidos(micaela.email), []);
  });

  it('un día no hábil no manda, y se anota; antes de las 14:00 no hace nada; sin feriados no manda y lo dice', async () => {
    const { micaela } = await cadena();
    await publico({ creador: micaela, fecha: '2026-11-09' });
    assert.deepEqual(await corrida('tarde', '2026-11-07 14:00:00'), resultado({ dia_habil: false }));
    assert.equal((await corridaAnotada()).resultado, 'Día no hábil: no se manda.');

    await query('DELETE FROM mi_espacio_eventos_corridas');
    assert.deepEqual(await corrida('tarde', '2026-11-06 13:59:00'), resultado({ dia_habil: null }));
    assert.equal(await corridaAnotada(), undefined);

    const sinFeriados = await corrida('tarde', VIERNES_14, { ...calendario, error: 'sin tabla' });
    assert.equal(sinFeriados.enviados, 0);
    assert.equal(sinFeriados.dia_habil, null);
    assert.match(sinFeriados.errores[0].error, /feriados/);
    assert.deepEqual(await recibidos(micaela.email), []);
  });

  it('con otra corrida en marcha termina «ocupada», sin escribir nada', async () => {
    const { micaela } = await cadena();
    await publico({ creador: micaela });
    const conexion = await db().getConnection();
    try {
      await conexion.query('SELECT GET_LOCK(?, 5)', [servicio.BLOQUEO_DIARIO]);
      assert.deepEqual(await corrida('tarde', JUEVES_14), resultado({ ocupada: true, dia_habil: null }));
    } finally {
      await conexion.query('SELECT RELEASE_LOCK(?)', [servicio.BLOQUEO_DIARIO]);
      conexion.release();
    }
    assert.deepEqual(await envios(), []);
    assert.equal(await corridaAnotada(), undefined);
  });

  it('un Laboral le llega a quien está, con título y detalle; a quien no, nada', async () => {
    const { federico, lucia, micaela, graciela } = await cadena();
    const laboral = await evento({ creador: micaela, compartido: 1, personas: [lucia] });
    assert.equal((await corrida('tarde', JUEVES_14)).enviados, 2);
    const html = await mailpit.html((await esperarDe(lucia.email))[0].ID);
    assert.ok(html.includes(laboral.titulo));
    assert.ok(html.includes('Detalle del evento'));
    assert.match(html, /Laboral, de Test m\./);
    assert.deepEqual(await recibidos(federico.email), [], 'un superior no recibe un Laboral de su gente');
    assert.deepEqual(await recibidos(graciela.email), []);
  });
});

describe('a las 8:05', () => {
  it('el ejemplo de la spec: cargado el jueves a las 14:02 para el viernes a las 8:15, les llega a los superiores, una vez', async () => {
    const { graciela, federico, micaela } = await cadena();
    const delTurno = await publico({ creador: micaela, desde: '08:15', publicado: '2026-11-05 14:02:00' });
    assert.deepEqual(await corrida('manana', VIERNES_8), resultado({ enviados: 2 }));
    for (const superior of [federico, graciela]) {
      const [mensaje] = await esperarDe(superior.email);
      assert.equal(mensaje.Subject, 'RPAD: se sumó algo a tu agenda de hoy');
      const html = await mailpit.html(mensaje.ID);
      assert.match(html, /<strong>Nuevo:<\/strong> Test m[^<]*: Fuera de la oficina/);
      assert.ok(!html.includes(delTurno.titulo));
    }
    assert.deepEqual(await recibidos(micaela.email), [], 'quien lo cargó ya lo sabe');
    assert.deepEqual(await corrida('manana', VIERNES_8), resultado());
    assert.equal((await corrida('tarde', VIERNES_14)).enviados, 0, 'a las 14:00 ya no es nuevo');
  });

  it('lo informado a las 14:00 no vuelve a salir a las 8:05', async () => {
    const { federico, micaela } = await cadena();
    await publico({ creador: micaela, desde: '08:15' });
    assert.equal((await corrida('tarde', JUEVES_14)).enviados, 3);
    assert.deepEqual(await corrida('manana', VIERNES_8), resultado());
    assert.equal((await esperarDe(federico.email)).length, 1);
  });

  it('lo que se carga y se realiza en el día no se avisa, ni a las 8:05 ni a las 14:00', async () => {
    const { federico, micaela } = await cadena();
    await publico({ creador: micaela, desde: '16:00', publicado: '2026-11-06 07:00:00' });
    assert.deepEqual(await corrida('manana', VIERNES_8), resultado());
    assert.deepEqual(await corrida('tarde', VIERNES_14), resultado());
    assert.deepEqual(await recibidos(federico.email), []);
  });

  it('un mail de las 8:05 que falló sale a las 14:00, solo si no empezó', async () => {
    const { federico, micaela } = await cadena();
    await publico({ creador: micaela, desde: '16:00', publicado: '2026-11-05 15:00:00' });
    const fallida = await sinBarrera(() => corrida('manana', VIERNES_8));
    assert.equal(fallida.fallidos, 2);
    assert.equal((await corrida('tarde', VIERNES_14)).enviados, 2);
    const [mensaje] = await esperarDe(federico.email);
    assert.equal(mensaje.Subject, 'RPAD: se sumó algo a tu agenda de hoy');
  });

  it('un día no hábil no manda nada: lo cargado para el sábado no se avisa nunca', async () => {
    const { federico, micaela } = await cadena();
    await publico({ creador: micaela, fecha: '2026-11-07', desde: '10:00', publicado: '2026-11-06 15:00:00' });
    assert.deepEqual(await corrida('manana', '2026-11-07 08:05:00'), resultado({ dia_habil: false }));
    assert.deepEqual(await corrida('manana', '2026-11-09 08:05:00'), resultado());
    assert.deepEqual(await recibidos(federico.email), []);
  });

  it('cargado el viernes a la tarde para el lunes: sale el lunes a las 8:05', async () => {
    const { federico, micaela } = await cadena();
    await publico({ creador: micaela, fecha: '2026-11-09', desde: '09:00', publicado: '2026-11-06 15:00:00' });
    assert.equal((await corrida('manana', '2026-11-09 08:05:00')).enviados, 2);
    assert.equal((await esperarDe(federico.email)).length, 1);
  });
});

describe('sin frenar nada, ni al revés', () => {
  const respuestaFalsa = () => ({ statusCode: 200, body: null, status(codigo) { this.statusCode = codigo; return this; }, json(cuerpo) { this.body = cuerpo; return this; } });
  const conReloj = async (momento, fn) => {
    mock.timers.enable({ apis: ['Date'], now: new Date(`${momento.replace(' ', 'T')}-03:00`) });
    try {
      return await fn();
    } finally {
      mock.timers.reset();
    }
  };
  const lasDe14 = async (momento = JUEVES_14) => {
    const res = respuestaFalsa();
    await conReloj(momento, () => controlador.ejecutarNotificacionCambiosPendientes({}, res));
    return res;
  };
  const lasDe8 = async (momento = VIERNES_8) => {
    const res = respuestaFalsa();
    await conReloj(momento, () => controlador.ejecutarNotificacionesDiarias({}, res));
    return res;
  };

  it('a las 14:00, el controlador lo manda y lo devuelve en `data.diario`, sin cambiar el mensaje', async () => {
    const { micaela } = await cadena();
    await publico({ creador: micaela });
    const res = await lasDe14();
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.diario.enviados, 3);
    assert.match(res.body.message, /^Recordatorios enviados a /);
  });

  it('si los recordatorios tiran, el aviso corre igual y el 500 se sigue respondiendo', async () => {
    const { micaela, federico } = await cadena();
    await publico({ creador: micaela });
    const errorEnConsola = mock.method(console, 'error', () => {});
    await query('RENAME TABLE cambios_pendientes TO cambios_pendientes_aparte');
    try {
      const res = await lasDe14();
      assert.equal(res.statusCode, 500);
      assert.equal(res.body.error, 'Error ejecutando notificación de cambios pendientes');
    } finally {
      await query('RENAME TABLE cambios_pendientes_aparte TO cambios_pendientes');
      errorEnConsola.mock.restore();
    }
    assert.equal((await esperarDe(federico.email)).length, 1);
  });

  it('si el paso falla, salen los recordatorios y la respuesta es 207, con el mensaje de siempre', async () => {
    const { micaela } = await cadena();
    await publico({ creador: micaela });
    const errorEnConsola = mock.method(console, 'error', () => {});
    await query('RENAME TABLE mi_espacio_diario_envios TO mi_espacio_diario_envios_aparte');
    try {
      const res = await lasDe14();
      assert.equal(res.statusCode, 207);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /^Recordatorios enviados a /);
      assert.equal(res.body.data.diario.enviados, 0);
      assert.ok(res.body.data.diario.errores.length > 0);
    } finally {
      await query('RENAME TABLE mi_espacio_diario_envios_aparte TO mi_espacio_diario_envios');
      errorEnConsola.mock.restore();
    }
  });

  it('«ocupada» no es un error: a las 14:00 sigue en 200', async () => {
    await cadena();
    const conexion = await db().getConnection();
    try {
      await conexion.query('SELECT GET_LOCK(?, 5)', [servicio.BLOQUEO_DIARIO]);
      const res = await lasDe14();
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      assert.equal(res.body.data.diario.ocupada, true);
    } finally {
      await conexion.query('SELECT RELEASE_LOCK(?)', [servicio.BLOQUEO_DIARIO]);
      conexion.release();
    }
  });

  it('a las 8:05 sale antes que lo demás y va en la respuesta; un error suyo da 207, con su tipo', async () => {
    const { micaela, federico } = await cadena();
    await publico({ creador: micaela, desde: '08:15', publicado: '2026-11-05 14:02:00' });
    const res = await lasDe8();
    assert.equal(res.body.data.diario.enviados, 2);
    assert.equal((await esperarDe(federico.email)).length, 1);

    await publico({ creador: micaela, fecha: '2026-11-09', desde: '09:00', publicado: '2026-11-06 15:00:00' });
    const errorEnConsola = mock.method(console, 'error', () => {});
    await query('RENAME TABLE mi_espacio_evento_informados TO mi_espacio_evento_informados_aparte');
    try {
      const conFalla = await lasDe8('2026-11-09 08:05:00');
      assert.equal(conFalla.statusCode, 207);
      assert.ok(conFalla.body.data.errores.some((fallo) => fallo.tipo === 'mi-espacio-diario'));
      // Lo demás de la corrida siguió: las Notas Digitales respondieron
      assert.notEqual(conFalla.body.data.notasDigitales, null);
    } finally {
      await query('RENAME TABLE mi_espacio_evento_informados_aparte TO mi_espacio_evento_informados');
      errorEnConsola.mock.restore();
    }
  });

  it('avisoDiarioAislado nunca rechaza, aunque no se pueda tomar el candado', async () => {
    const errorEnConsola = mock.method(console, 'error', () => {});
    const original = pool.getConnection;
    pool.getConnection = () => Promise.reject(new Error('Sin base'));
    try {
      const salida = await servicio.avisoDiarioAislado('manana', calendario, { ahora: VIERNES_8 });
      assert.equal(salida.enviados, 0);
      assert.equal(salida.errores[0].error, 'Sin base');
    } finally {
      pool.getConnection = original;
      errorEnConsola.mock.restore();
    }
  });

  it('a las 8:05 se dispara antes de los demás pasos y sin esperarlo; se espera recién antes de responder', () => {
    const fuente = readFileSync(new URL('../controllers/notificacionesController.js', import.meta.url), 'utf8');
    const corridaDe8 = fuente.slice(fuente.indexOf('export const ejecutarNotificacionesDiarias'), fuente.indexOf('export const pruebaAvisoArea'));
    const disparo = corridaDe8.indexOf("const diario = avisoDiarioAislado('manana', calendario)");
    assert.ok(disparo > -1, 'sin await');
    assert.ok(disparo < corridaDe8.indexOf('await enviarAvisoAreas('));
    assert.ok(disparo < corridaDe8.indexOf('await ejecutarNotasDigitales('));
    assert.ok(corridaDe8.indexOf('resultados.diario = await diario') > corridaDe8.indexOf('await enviarAvisosDeVencimiento('));
    assert.doesNotMatch(corridaDe8.slice(corridaDe8.indexOf('resultados.diario = await diario')), /anotarEnLaUltimaCorrida/);
  });
});

describe('Correos → Estado', () => {
  it('la última corrida, leída de la fila 2, sin mezclarse con la de los recordatorios', async () => {
    assert.equal(await servicio.leerCorridaDelDiario(), null);
    assert.equal((await servicio.estadoDelAvisoDiario({ ahora: JUEVES_14 })).texto, 'Aviso diario de la agenda: sin registro todavía.');
    await query("INSERT INTO mi_espacio_eventos_corridas (id, inicio_at, fin_at, resultado, con_errores) VALUES (1, '2026-11-05 13:30:00', '2026-11-05 13:30:01', 'Recordatorios enviados: 9.', 0)");
    const { micaela } = await cadena();
    await publico({ creador: micaela });
    await corrida('tarde', JUEVES_14);
    const estado = await servicio.estadoDelAvisoDiario({ ahora: JUEVES_14 });
    assert.equal(estado.texto, 'Aviso diario de la agenda: última corrida hoy a las 14:00. Enviados: 3.');
    assert.deepEqual(estado.alertas, []);
    assert.equal((await query('SELECT resultado FROM mi_espacio_eventos_corridas WHERE id = 1'))[0].resultado, 'Recordatorios enviados: 9.');
  });

  it('con errores, su alerta', async () => {
    const { micaela } = await cadena();
    await publico({ creador: micaela });
    await sinBarrera(() => corrida('tarde', JUEVES_14));
    const { alertas } = await servicio.estadoDelAvisoDiario({ ahora: JUEVES_14 });
    assert.equal(alertas[0].tipo, 'diario-con-errores');
    assert.match(alertas[0].mensaje, /Fallidos: 3\./);
  });
});
