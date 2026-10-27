// El aviso de vencimiento de Mi espacio por email (spec 2026-10-26-mi-espacio-licencias-y-horas, sección 9;
// services/miEspacioAvisos.js): un paso aislado de la corrida de las 8:15, después de las Notas Digitales y de la foto, que sale
// solo en días hábiles (con los feriados de la tabla), una sola vez por persona y por cosa, nunca a quien está de licencia ese
// día y nunca a las casillas por defecto. Contra una base de prueba propia, con personas inventadas y casillas @rpad.test.
// Mailpit se mira solo por las casillas de cada test (otras sesiones pueden compartirlo: no se vacía). Se llama al servicio y a
// la corrida diaria (el controlador, nunca /api/cron/*) con un hoy fijo (mock.timers).
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query, db, mailpit, paraCasilla } from './helpers.js';
import { limpiarBase } from './notas-fixtures.js';
import { textoVisible } from './emails-fixtures.js';

const ASUNTO = 'RPAD: lo que vence pronto en Mi espacio';
const FRANCO_DE_OCTUBRE = 'Tenés 1 franco compensatorio para usar en octubre: el último día hábil es el viernes 30/10.';
// Las casillas por defecto de sendEmail (services/emailService.js): las de la DGMIT
const CASILLAS_POR_DEFECTO = ['datospublicos@comodoro.gov.ar', 'mit@comodoro.gov.ar', 'investigacionterritorial@comodoro.gov.ar'];

let base, dbReal, emailSoloA, avisos, datos, controlador;

before(async () => {
  dbReal = process.env.DB_NAME;
  emailSoloA = process.env.EMAIL_SOLO_A;
  base = await crearBaseDePrueba('rpad_test_mi_espacio_avisos');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba
  avisos = await import('../services/miEspacioAvisos.js');
  datos = await import('../services/miEspacioDatos.js');
  controlador = await import('../controllers/notificacionesController.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  if (emailSoloA === undefined) delete process.env.EMAIL_SOLO_A;
  else process.env.EMAIL_SOLO_A = emailSoloA;
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  process.env.EMAIL_SOLO_A = '';
  // limpiarBase comprueba que la base es de prueba y deja la última corrida en blanco
  await limpiarBase();
  for (const tabla of ['mi_espacio_avisos', 'mi_espacio_licencias', 'mi_espacio_horas_extras', 'mi_espacio_arranque',
    'usuarios_licencias', 'feriados', 'usuarios']) {
    await query(`DELETE FROM ${tabla}`);
  }
});

const sufijo = () => crypto.randomBytes(3).toString('hex');

// Una persona inventada: activa, de planta, «Laura Gómez» y con una casilla propia, salvo lo que se pida
const persona = async ({ vinculo = 'planta_permanente', activo = 1, email = null, nombre = 'Laura Gómez' } = {}) => {
  const username = `t_me_${sufijo()}`;
  const casilla = email ?? `${username}@rpad.test`;
  const { insertId: id } = await query(
    `INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, vinculo, activo)
     VALUES (?, 'x', ?, ?, 'admin', ?, ?)`,
    [username, nombre, casilla, vinculo, activo]
  );
  return { id, email: casilla };
};

// 7 horas extras en agosto de 2026: en planta, un franco para usar en octubre
const horasExtrasDeAgosto = (usuarioId) => query(
  `INSERT INTO mi_espacio_horas_extras (usuario_id, fecha, desde, hasta)
   VALUES (?, '2026-08-04', '18:00', '22:00'), (?, '2026-08-11', '18:00', '21:00')`,
  [usuarioId, usuarioId]
);

// Una persona con el saldo inicial cargado y el franco de octubre sin usar. En octubre el último día hábil es el viernes 30/10
// y el tramo del aviso arranca el viernes 23/10
const conFrancoDeOctubre = async (opciones) => {
  const quien = await persona(opciones);
  await query("INSERT INTO mi_espacio_arranque (usuario_id, fecha) VALUES (?, '2026-08-03')", [quien.id]);
  await horasExtrasDeAgosto(quien.id);
  return quien;
};

const licenciaDeConfiguracion = (usuarioId, desde, hasta, anulada = 0) => query(
  'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, anulada) VALUES (?, ?, ?, ?)', [usuarioId, desde, hasta, anulada]
);
const licenciaDeMiEspacio = (usuarioId, tipo, desde, hasta, { horas = null, activo = 1, mostrar = 1 } = {}) => query(
  'INSERT INTO mi_espacio_licencias (usuario_id, tipo, desde, hasta, horas, activo, mostrar) VALUES (?, ?, ?, ?, ?, ?, ?)',
  [usuarioId, tipo, desde, hasta, horas, activo, mostrar]
);

// El paso llamado directo, con el reloj en las 8:15 de Argentina de ese día (el momento que se anota en mi_espacio_avisos)
const pasoDel = async (fecha) => {
  mock.timers.enable({ apis: ['Date'], now: new Date(`${fecha}T11:15:00Z`) });
  try {
    return await avisos.enviarAvisosDeVencimiento({ hoy: fecha });
  } finally {
    mock.timers.reset();
  }
};

// La corrida diaria de las 8:15 (el controlador del cron, sin pasar por /api/cron/*) en un momento fijo. Devuelve lo que respondió
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

// Lo anotado de una persona, por clave
const anotados = (usuarioId) => query(
  `SELECT clave, DATE_FORMAT(enviado_at, '%Y-%m-%d %H:%i:%s') AS enviado_at FROM mi_espacio_avisos
   WHERE usuario_id = ? ORDER BY clave`,
  [usuarioId]
);
// Los emails de Mailpit a una casilla (solo los suyos: Mailpit puede tener los de otras sesiones)
const recibidos = async (email) => (await mailpit.mensajes()).filter(paraCasilla(email));

// El bloqueo del paso (GET_LOCK, de toda la base): si está libre
const BLOQUEO = 'rpad_mi_espacio_avisos';
const bloqueoLibre = async () => Number((await query('SELECT IS_FREE_LOCK(?) AS libre', [BLOQUEO]))[0].libre) === 1;

// Corre fn con la anotación de una persona en mi_espacio_avisos rota (un trigger la rechaza: el email sale y no se anota) y la
// consola de errores callada. Devuelve lo que devolvió fn y lo que se escribió en la consola
const conAnotacionQueFalla = async (usuarioId, fn) => {
  await query('DROP TRIGGER IF EXISTS falla_simulada_mi_espacio_avisos');
  await query(`CREATE TRIGGER falla_simulada_mi_espacio_avisos BEFORE INSERT ON mi_espacio_avisos FOR EACH ROW
    BEGIN
      IF NEW.usuario_id = ${Number(usuarioId)} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falla simulada'; END IF;
    END`);
  const log = mock.method(console, 'error', () => {});
  try {
    const resultado = await fn();
    return { resultado, consola: log.mock.calls.map((llamada) => llamada.arguments) };
  } finally {
    log.mock.restore();
    await query('DROP TRIGGER IF EXISTS falla_simulada_mi_espacio_avisos');
  }
};

// El nombre de una persona con la que armar su email falla (un error inesperado simulado: ver «una persona que falla»)
const NOMBRE_QUE_FALLA = 'Persona de Prueba Que Falla';

describe('ausentesEn: quién está de licencia ese día', () => {
  it('una licencia de Configuración sin anular, o una de Mi espacio activa de día entero; solo de los ids pedidos', async () => {
    const [enConfiguracion, anulada, medica, borrada, franquiciaCorta, franquiciaEntera, otraFecha, oculta, sinPedir] =
      await Promise.all(Array.from({ length: 9 }, () => persona()));
    await licenciaDeConfiguracion(enConfiguracion.id, '2026-10-22', '2026-10-23');
    await licenciaDeConfiguracion(anulada.id, '2026-10-23', '2026-10-23', 1);
    await licenciaDeMiEspacio(medica.id, 'medica', '2026-10-23', '2026-10-23');
    await licenciaDeMiEspacio(borrada.id, 'medica', '2026-10-23', '2026-10-23', { activo: 0 });
    await licenciaDeMiEspacio(franquiciaCorta.id, 'franquicia', '2026-10-23', '2026-10-23', { horas: 3 });
    await licenciaDeMiEspacio(franquiciaEntera.id, 'franquicia', '2026-10-23', '2026-10-23', { horas: 7 });
    await licenciaDeMiEspacio(otraFecha.id, 'vacaciones', '2026-10-26', '2026-10-30');
    // «Mostrar» es para los compañeros: quien la cargó está de licencia igual
    await licenciaDeMiEspacio(oculta.id, 'familiar', '2026-10-21', '2026-10-27', { mostrar: 0 });
    await licenciaDeConfiguracion(sinPedir.id, '2026-10-23', '2026-10-23');

    const pedidos = [enConfiguracion, anulada, medica, borrada, franquiciaCorta, franquiciaEntera, otraFecha, oculta]
      .map((quien) => quien.id);
    // Un id como texto es el mismo
    pedidos.push(String(medica.id));
    const ausentes = await datos.ausentesEn('2026-10-23', pedidos);
    assert.deepEqual([...ausentes].sort((a, b) => a - b),
      [enConfiguracion.id, medica.id, franquiciaEntera.id, oculta.id].sort((a, b) => a - b));
    assert.deepEqual([...await datos.ausentesEn('2026-10-24', pedidos)], [oculta.id]);
    // Sin ids que sirvan, o sin una fecha, un Set vacío
    assert.equal((await datos.ausentesEn('2026-10-23', [])).size, 0);
    assert.equal((await datos.ausentesEn('2026-10-23', [0, -1, 'x', null])).size, 0);
    assert.equal((await datos.ausentesEn('2026-02-30', pedidos)).size, 0);
  });
});

describe('enviarAvisosDeVencimiento', () => {
  it('el tramo: el 22/10 no manda nada, el 23/10 manda un email a su casilla y el 26/10 no lo repite', async () => {
    const laura = await conFrancoDeOctubre();

    assert.deepEqual(await pasoDel('2026-10-22'), { dia_habil: true, enviados: 0, errores: [] });
    assert.deepEqual(await anotados(laura.id), []);
    assert.deepEqual(await recibidos(laura.email), []);

    assert.deepEqual(await pasoDel('2026-10-23'), { dia_habil: true, enviados: 1, errores: [] });
    assert.deepEqual(await anotados(laura.id), [{ clave: 'franco-2026-10', enviado_at: '2026-10-23 08:15:00' }]);
    const [mensaje] = await mailpit.esperar(paraCasilla(laura.email));
    assert.equal(mensaje.Subject, ASUNTO);
    assert.deepEqual(mensaje.To.map((t) => t.Address), [laura.email]);
    assert.deepEqual([...mensaje.Cc ?? [], ...mensaje.Bcc ?? []], []);
    assert.equal(mensaje.From.Name, 'Dir. de Datos Públicos y Comunicación');
    const texto = textoVisible(await mailpit.html(mensaje.ID));
    assert.ok(texto.includes(`Lo que vence pronto Hola, Laura Gómez. ${FRANCO_DE_OCTUBRE} Ver en Mi espacio`), texto);

    assert.deepEqual(await pasoDel('2026-10-26'), { dia_habil: true, enviados: 0, errores: [] });
    assert.equal((await recibidos(laura.email)).length, 1);
    assert.deepEqual((await anotados(laura.id)).map((fila) => fila.clave), ['franco-2026-10']);
  });

  it('de licencia ese día: con una de Configuración el 23/10, sale el 26/10; con una médica de Mi espacio, lo mismo', async () => {
    const enConfiguracion = await conFrancoDeOctubre();
    await licenciaDeConfiguracion(enConfiguracion.id, '2026-10-23', '2026-10-23');
    const conMedica = await conFrancoDeOctubre();
    await licenciaDeMiEspacio(conMedica.id, 'medica', '2026-10-23', '2026-10-23');

    assert.deepEqual(await pasoDel('2026-10-23'), { dia_habil: true, enviados: 0, errores: [] });
    for (const quien of [enConfiguracion, conMedica]) {
      assert.deepEqual(await anotados(quien.id), []);
      assert.deepEqual(await recibidos(quien.email), []);
    }

    assert.deepEqual(await pasoDel('2026-10-26'), { dia_habil: true, enviados: 2, errores: [] });
    for (const quien of [enConfiguracion, conMedica]) {
      assert.deepEqual(await anotados(quien.id), [{ clave: 'franco-2026-10', enviado_at: '2026-10-26 08:15:00' }]);
      const [mensaje] = await mailpit.esperar(paraCasilla(quien.email));
      // El email no dice el tipo de ninguna licencia médica
      assert.ok(!/m[eé]dica/i.test(textoVisible(await mailpit.html(mensaje.ID))));
    }
  });

  it('el que falla sale al siguiente: el 23/10, bloqueado, no sale ni se anota; el 26/10 sale', async () => {
    const laura = await conFrancoDeOctubre();
    process.env.EMAIL_SOLO_A = `otra-${sufijo()}@rpad.test`;
    // sendEmail avisa en la consola que la barrera lo bloqueó: acá se calla
    const aviso = mock.method(console, 'warn', () => {});
    let resultado;
    try {
      resultado = await pasoDel('2026-10-23');
    } finally {
      aviso.mock.restore();
      process.env.EMAIL_SOLO_A = '';
    }
    assert.deepEqual(resultado, {
      dia_habil: true, enviados: 0,
      errores: [{ usuario_id: laura.id, error: 'Bloqueado por EMAIL_SOLO_A', motivo: 'el email no se pudo enviar' }]
    });
    assert.deepEqual(await anotados(laura.id), []);
    assert.deepEqual(await recibidos(laura.email), []);

    assert.deepEqual(await pasoDel('2026-10-26'), { dia_habil: true, enviados: 1, errores: [] });
    assert.deepEqual(await anotados(laura.id), [{ clave: 'franco-2026-10', enviado_at: '2026-10-26 08:15:00' }]);
    assert.equal((await mailpit.esperar(paraCasilla(laura.email))).length, 1);
  });

  it('un día no hábil: con un feriado cargado el 23/10, ese día no sale nada', async () => {
    const laura = await conFrancoDeOctubre();
    await query("INSERT INTO feriados (fecha, nombre, tipo) VALUES ('2026-10-23', 'Feriado de prueba', 'municipal')");
    assert.deepEqual(await pasoDel('2026-10-23'), { dia_habil: false, enviados: 0, errores: [] });
    assert.deepEqual(await anotados(laura.id), []);
    assert.deepEqual(await recibidos(laura.email), []);
    // Un sábado tampoco
    assert.deepEqual(await pasoDel('2026-10-24'), { dia_habil: false, enviados: 0, errores: [] });
  });

  it('nunca a las casillas por defecto: solo a las personas activas, con vínculo, saldo inicial y un email válido', async () => {
    const desde = Date.now();
    await conFrancoDeOctubre({ email: `sin-arroba-${sufijo()}` });
    const inactiva = await conFrancoDeOctubre({ activo: 0 });
    const sinVinculo = await conFrancoDeOctubre({ vinculo: null });
    const sinArranque = await persona();
    await horasExtrasDeAgosto(sinArranque.id);

    assert.deepEqual(await pasoDel('2026-10-23'), { dia_habil: true, enviados: 0, errores: [] });
    assert.deepEqual(await query('SELECT * FROM mi_espacio_avisos'), []);
    for (const quien of [inactiva, sinVinculo, sinArranque]) assert.deepEqual(await recibidos(quien.email), []);
    const aLasDeFabrica = (await mailpit.mensajes()).filter((m) => m.Subject === ASUNTO && Date.parse(m.Created) >= desde - 1000
      && m.To.some((t) => CASILLAS_POR_DEFECTO.includes(t.Address)));
    assert.deepEqual(aLasDeFabrica, []);
  });

  it('una persona que falla no frena a las demás: va a los errores, con la pila en la consola, y las otras reciben el suyo',
    async () => {
      // La primera de la lista (por id) es la que falla: armar su email tira un error inesperado (escapar su nombre, simulado)
      const rota = await conFrancoDeOctubre({ nombre: NOMBRE_QUE_FALLA });
      const laura = await conFrancoDeOctubre();
      const reemplazar = String.prototype.replace;
      const roto = mock.method(String.prototype, 'replace', function reemplazo(...argumentos) {
        if (String(this) === NOMBRE_QUE_FALLA) throw new Error('Falla simulada');
        return reemplazar.apply(this, argumentos);
      });
      const log = mock.method(console, 'error', () => {});
      let resultado;
      try {
        resultado = await pasoDel('2026-10-23');
      } finally {
        roto.mock.restore();
        log.mock.restore();
      }
      assert.deepEqual(resultado, {
        dia_habil: true, enviados: 1,
        errores: [{ usuario_id: rota.id, error: 'No se pudo preparar el email', motivo: 'no se pudo preparar el email' }]
      });
      assert.equal(log.mock.callCount(), 1);
      const [mensaje, detalle] = log.mock.calls[0].arguments;
      assert.equal(mensaje, 'Error al preparar el aviso de Mi espacio:');
      assert.equal(typeof detalle, 'string');
      assert.match(detalle, /Falla simulada/);
      assert.deepEqual(await recibidos(rota.email), []);
      assert.deepEqual(await anotados(rota.id), []);
      assert.equal((await mailpit.esperar(paraCasilla(laura.email))).length, 1);
      assert.deepEqual((await anotados(laura.id)).map((fila) => fila.clave), ['franco-2026-10']);
    });

  it('si el email salió y no se pudo anotar: cuenta como enviado, va a los errores y a la consola solo la pila', async () => {
    const laura = await conFrancoDeOctubre();
    const { resultado, consola } = await conAnotacionQueFalla(laura.id, () => pasoDel('2026-10-23'));
    assert.deepEqual(resultado, {
      dia_habil: true, enviados: 1,
      errores: [{ usuario_id: laura.id, error: 'Falla simulada', motivo: 'el email salió, pero no se pudo anotar' }]
    });
    assert.equal(consola.length, 1);
    assert.equal(consola[0][0], 'Error al anotar el aviso de Mi espacio:');
    assert.equal(typeof consola[0][1], 'string');
    assert.match(consola[0][1], /Falla simulada/);
    assert.ok(!consola[0][1].includes('INSERT'), consola[0][1]);
    assert.equal((await mailpit.esperar(paraCasilla(laura.email))).length, 1);
    assert.deepEqual(await anotados(laura.id), []);
  });

  it('con otra corrida en curso (el bloqueo tomado) no manda nada y lo dice; la siguiente manda y deja el bloqueo libre',
    async () => {
      const laura = await conFrancoDeOctubre();
      const otra = await db().getConnection();
      try {
        const [[{ tomado }]] = await otra.query('SELECT GET_LOCK(?, 0) AS tomado', [BLOQUEO]);
        assert.equal(Number(tomado), 1);
        assert.deepEqual(await pasoDel('2026-10-23'),
          { dia_habil: true, enviados: 0, errores: [], motivo: 'Otra corrida en curso' });
      } finally {
        await otra.query('SELECT RELEASE_LOCK(?)', [BLOQUEO]);
        otra.release();
      }
      assert.deepEqual(await anotados(laura.id), []);
      assert.deepEqual(await recibidos(laura.email), []);

      assert.equal(await bloqueoLibre(), true);
      assert.deepEqual(await pasoDel('2026-10-23'), { dia_habil: true, enviados: 1, errores: [] });
      assert.equal(await bloqueoLibre(), true);
      assert.deepEqual((await anotados(laura.id)).map((fila) => fila.clave), ['franco-2026-10']);
    });
});

describe('en la corrida de las 8:15', () => {
  const ultimaCorrida = async () => (await query(
    `SELECT ultima_corrida_resultado AS resultado, ultima_corrida_con_errores AS con_errores
     FROM notas_digitales_config WHERE id = 1`
  ))[0];

  it('el 23/10 a las 8:15 trae miEspacio con un email enviado', async () => {
    const laura = await conFrancoDeOctubre();
    const res = await corridaDiaria('2026-10-23T11:15:00Z');
    assert.deepEqual(res.body.data.miEspacio, { dia_habil: true, enviados: 1, errores: [] }, JSON.stringify(res.body));
    assert.ok(!res.body.data.errores.some((error) => error.tipo === 'mi-espacio'), JSON.stringify(res.body.data.errores));
    assert.equal((await mailpit.esperar(paraCasilla(laura.email))).length, 1);
    assert.deepEqual((await anotados(laura.id)).map((fila) => fila.clave), ['franco-2026-10']);
  });

  it('con mi_espacio_avisos renombrada, el error queda en la respuesta y en la última corrida, sin ningún email', async () => {
    const laura = await conFrancoDeOctubre();
    const log = mock.method(console, 'error', () => {});
    let res;
    await query('RENAME TABLE mi_espacio_avisos TO mi_espacio_avisos_aparte');
    try {
      res = await corridaDiaria('2026-10-23T11:15:00Z');
    } finally {
      await query('RENAME TABLE mi_espacio_avisos_aparte TO mi_espacio_avisos');
      log.mock.restore();
    }
    // La respuesta llega igual, con el resto de la corrida
    assert.equal(res.statusCode, 207);
    assert.ok(res.body.data.notasDigitales);
    assert.equal(res.body.data.miEspacio, null);
    const deMiEspacio = res.body.data.errores.filter((error) => error.tipo === 'mi-espacio');
    assert.equal(deMiEspacio.length, 1, JSON.stringify(res.body.data.errores));
    assert.match(deMiEspacio[0].error, /mi_espacio_avisos/);
    assert.deepEqual(log.mock.calls.map((llamada) => llamada.arguments[0]), ['Error en los avisos de Mi espacio:']);
    const { resultado, con_errores: conErrores } = await ultimaCorrida();
    assert.ok(resultado.includes(`No se pudieron enviar los avisos de Mi espacio: ${deMiEspacio[0].error}`), resultado);
    assert.equal(conErrores, 1);
    assert.deepEqual(await recibidos(laura.email), []);
    assert.deepEqual(await anotados(laura.id), []);
    // El bloqueo del paso se liberó igual
    assert.equal(await bloqueoLibre(), true);
  });

  it('un email que no sale queda en los errores de la corrida y en la última corrida', async () => {
    const laura = await conFrancoDeOctubre();
    process.env.EMAIL_SOLO_A = `otra-${sufijo()}@rpad.test`;
    const aviso = mock.method(console, 'warn', () => {});
    let res;
    try {
      res = await corridaDiaria('2026-10-23T11:15:00Z');
    } finally {
      aviso.mock.restore();
      process.env.EMAIL_SOLO_A = '';
    }
    assert.equal(res.statusCode, 207);
    // El texto del envío (el de nodemailer puede traer la dirección) queda solo en los errores de la corrida
    assert.deepEqual(res.body.data.errores.filter((error) => error.tipo === 'mi-espacio'), [
      { tipo: 'mi-espacio', usuario_id: laura.id, error: 'Bloqueado por EMAIL_SOLO_A', motivo: 'el email no se pudo enviar' }
    ]);
    const { resultado } = await ultimaCorrida();
    assert.ok(resultado.includes('No se pudieron enviar los avisos de Mi espacio: el email no se pudo enviar'), resultado);
    assert.ok(!resultado.includes('Bloqueado por EMAIL_SOLO_A'), resultado);
    assert.deepEqual(await anotados(laura.id), []);
  });

  it('dos que fallan por motivos distintos: la última corrida dice cada motivo una vez', async () => {
    const [ana, beto, carla] = [await conFrancoDeOctubre(), await conFrancoDeOctubre(), await conFrancoDeOctubre()];
    process.env.EMAIL_SOLO_A = carla.email;
    const aviso = mock.method(console, 'warn', () => {});
    let res;
    try {
      ({ resultado: res } = await conAnotacionQueFalla(carla.id, () => corridaDiaria('2026-10-23T11:15:00Z')));
    } finally {
      aviso.mock.restore();
      process.env.EMAIL_SOLO_A = '';
    }
    assert.deepEqual(res.body.data.errores.filter((error) => error.tipo === 'mi-espacio').map((error) => error.usuario_id),
      [ana.id, beto.id, carla.id]);
    const { resultado } = await ultimaCorrida();
    assert.ok(resultado.includes('No se pudieron enviar los avisos de Mi espacio: el email no se pudo enviar; el email salió, '
      + 'pero no se pudo anotar'), resultado);
  });
});
