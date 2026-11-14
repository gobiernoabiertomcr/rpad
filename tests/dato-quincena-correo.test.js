// El correo del dato de la quincena en las corridas (spec 2026-11-12-dato-quincena-correo, 5, 6, 8, 10 y 13;
// services/datoQuincenaCorreo.js): el paso de las 8:05 y las 14:00, su candado, la reserva de cada persona, los reintentos y lo
// que muestra Correos → Estado. Contra una base de prueba propia, con la precarga de feriados tal cual (el lunes 23/11/2026 es
// feriado, el 07/12 no laborable y el 08/12 fijo) y Mailpit. Se llama al servicio con un ahora fijo y el calendario leído de la
// base, como lo hace el controlador (nunca a /api/cron/*). Las personas («PruebaUno Ejemplo») y sus casillas (@ejemplo.test) son
// inventadas y cambian en cada test; las ediciones salen de tests/dato-quincena-fixtures.js.
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { crearBaseDePrueba, correrSqlEnBaseDePrueba, cerrarDb, query, db, mailpit, paraCasilla, MAILPIT_URL } from './helpers.js';
import { asegurarBaseDePrueba } from './notas-fixtures.js';
import { edicionDePrueba, pilotoDePrueba, partesDePrueba, svgDePrueba, repeticionDePrueba } from './dato-quincena-fixtures.js';
import { claveDeEdicion, filasDeLaEdicion, huellaDelPaquete } from '../services/datoQuincenaReglas.js';
import {
  MENSAJES_CORREO, estaVigente, textoDeLaPersona, sePuedeReenviar, pastillaDelEnvio
} from '../services/datoQuincenaCorreoReglas.js';
import { CID_INFOGRAFIA, RPAD_URL } from '../services/emailTemplates.js';
import { sendEmail } from '../services/emailService.js';

const ASUNTO_23 = 'Dato de la Quincena - 23/11/2026';
const TABLAS = ['dato_quincena_envios', 'dato_quincena_correos', 'dato_quincena_destinatarios', 'dato_quincena_adjuntos',
  'dato_quincena_propuestas', 'dato_quincena_ediciones', 'usuarios_licencias', 'usuarios'];

let base, dbReal, emailSoloA, servicio, datos, feriadosDatos, controlador, correos, pool;

before(async () => {
  dbReal = process.env.DB_NAME;
  emailSoloA = process.env.EMAIL_SOLO_A;
  base = await crearBaseDePrueba('rpad_test_dato_quincena_correo');
  await correrSqlEnBaseDePrueba(base.nombre, 'database/updates/migracion-feriados-datos.sql');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba
  servicio = await import('../services/datoQuincenaCorreo.js');
  datos = await import('../services/datoQuincenaDatos.js');
  feriadosDatos = await import('../services/feriadosDatos.js');
  controlador = await import('../controllers/notificacionesController.js');
  correos = await import('../controllers/notasDigitalesController.js');
  pool = (await import('../config/database.js')).default;
});

after(async () => {
  await pool?.end();
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
  await asegurarBaseDePrueba();
  for (const tabla of TABLAS) await query(`DELETE FROM ${tabla}`);
  await query(
    `UPDATE dato_quincena_correo_config SET envio_activo = 1, cambiado_por = NULL, corrida_inicio_at = NULL, corrida_fin_at = NULL,
       corrida_resultado = NULL, corrida_con_errores = 0 WHERE id = 1`
  );
  await mailpit.vaciar();
});

const sufijo = () => crypto.randomBytes(3).toString('hex');

// Una persona activa con su casilla inventada; `clave` arma su primer nombre («PruebaUno»)
const persona = async ({ clave, email = null, activo = 1, rol = 'lector' }) => {
  const username = `t_dq_${sufijo()}`;
  const casilla = email ?? `${username}@ejemplo.test`;
  const { insertId: id } = await query(
    "INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES (?, 'x', ?, ?, ?, ?)",
    [username, `Prueba${clave} Ejemplo`, casilla, rol, activo]
  );
  return { id, email: casilla, nombre: `Prueba${clave}` };
};
const aLaLista = async (...personas) => {
  for (const quien of personas) {
    await query("INSERT INTO dato_quincena_destinatarios (usuario_id, agregado_at) VALUES (?, '2026-11-01 09:00:00')", [quien.id]);
  }
};
const licencia = (quien, desde, hasta) => query(
  'INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [quien.id, desde, hasta]
);
const prender = (activo) => query('UPDATE dato_quincena_correo_config SET envio_activo = ? WHERE id = 1', [activo ? 1 : 0]);

// Llega una edición regular por el mismo camino que el POST (guardarEdicion): queda programada si el envío está prendido. Con el
// SVG, salvo `svg: false`; `cambiar` recibe la edición antes de armar sus partes. Devuelve su id
const llega = async (fecha_edicion, ahora, { svg = true, cambiar = () => {} } = {}) => {
  const edicion = edicionDePrueba({ fecha_edicion, titulo: `El dato de la quincena del ${fecha_edicion}` });
  cambiar(edicion);
  const partes = partesDePrueba(edicion, svg ? { infografia_svg: svgDePrueba() } : {});
  const manifiesto = JSON.parse(partes.metadata.toString('utf8'));
  const { estado, id } = await datos.guardarEdicion({
    clave: claveDeEdicion(edicion),
    tipo: edicion.tipo,
    fecha_edicion,
    referencia_piloto: null,
    titulo: edicion.titulo,
    metadataTexto: partes.metadata.toString('utf8'),
    huella: huellaDelPaquete(partes),
    filas: filasDeLaEdicion(edicion),
    adjuntos: manifiesto.adjuntos.map(({ campo, nombre, mime }) => ({
      campo, nombre, mime, bytes: partes[campo].length, sha256: crypto.createHash('sha256').update(partes[campo]).digest('hex'),
      contenido: partes[campo]
    })),
    ahora
  });
  assert.equal(estado, 'creada');
  return id;
};

// Una corrida, con el calendario leído de la base (una lectura, como el controlador) y un ahora fijo de Argentina
const corrida = async (ahora, { enviar } = {}) => {
  const calendario = await feriadosDatos.leerCalendario();
  return servicio.ejecutarCorreoDelDatoQuincena({ hoy: ahora.slice(0, 10), ahora, calendario, ...(enviar ? { enviar } : {}) });
};
const resultado = (cambios = {}) => ({
  ocupada: false, edicion: null, enviados: 0, fallidos: 0, licencia: 0, omitidos: 0, errores: [], ...cambios
});

const correoDe = async (id) => (await query(
  `SELECT estado, motivo, DATE_FORMAT(enviada_at, '%Y-%m-%d %H:%i:%s') AS enviada_at,
          DATE_FORMAT(ultima_corrida_at, '%Y-%m-%d %H:%i:%s') AS ultima_corrida_at
   FROM dato_quincena_correos WHERE edicion_id = ?`, [id]
))[0];
// Las filas automáticas de una edición: [usuario_id, email, estado, intentos, error]
const filasDe = async (id) => (await query(
  `SELECT usuario_id, email, estado, intentos, error FROM dato_quincena_envios
   WHERE edicion_id = ? AND tipo = 'automatico' ORDER BY usuario_id`, [id]
)).map((fila) => [Number(fila.usuario_id), fila.email, fila.estado, Number(fila.intentos), fila.error]);
const laCorrida = async () => (await query(
  `SELECT DATE_FORMAT(corrida_inicio_at, '%Y-%m-%d %H:%i:%s') AS inicio, DATE_FORMAT(corrida_fin_at, '%Y-%m-%d %H:%i:%s') AS fin,
          corrida_resultado AS resultado, corrida_con_errores AS con_errores
   FROM dato_quincena_correo_config WHERE id = 1`
))[0];

// Lo que muestra Correos → Estado en un momento fijo (el aviso de «no le llegó» depende de si la edición sigue vigente)
const estado = (ahora = '2026-11-25 15:00:00') => servicio.estadoDelCorreoDelDatoQuincena({ ahora });

const recibidos = async (email) => (await mailpit.mensajes()).filter(paraCasilla(email));
const esperarDe = async (email, cantidad = 1) => {
  let mensajes = await recibidos(email);
  for (let intento = 0; intento < 50 && mensajes.length < cantidad; intento++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    mensajes = await recibidos(email);
  }
  return mensajes;
};
// Que no llegue nada más: espera un poco y cuenta
const sinMasDe = async (email, cantidad) => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal((await recibidos(email)).length, cantidad, email);
};
const detalle = async (id) => (await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)).json();

// Un transporte que falla para unas casillas (sin mandar nada) y manda de verdad a las demás. Cuenta los pedidos por casilla
const transporteQueFallaPara = (...casillas) => {
  const pedidos = new Map();
  const enviar = async (mail) => {
    for (const para of mail.to) pedidos.set(para, (pedidos.get(para) ?? 0) + 1);
    if (mail.to.some((para) => casillas.includes(para))) return { success: false, error: `Falla simulada para ${mail.to.join(', ')}` };
    return sendEmail(mail);
  };
  return { enviar, pedidos };
};
const callado = (metodo) => mock.method(console, metodo, () => {});
const conArroba = (consola) => consola.mock.calls.some((llamada) => llamada.arguments.some((arg) => String(arg?.stack ?? arg).includes('@')));

describe('sale en la corrida de la mañana del primer día hábil (spec, 5 y 10)', () => {
  it('el lunes 23/11 es feriado: no sale; el martes 24/11 a las 8:05, un mail por persona, con la infografía en línea, adjunta y el SVG', async () => {
    const uno = await persona({ clave: 'Uno' });
    const dos = await persona({ clave: 'Dos' });
    await aLaLista(uno, dos);
    const id = await llega('2026-11-23', '2026-11-23 07:30:00');
    assert.equal((await correoDe(id)).estado, 'programada');

    assert.deepEqual(await corrida('2026-11-23 08:05:00'), resultado());
    assert.deepEqual(await filasDe(id), []);
    assert.equal((await correoDe(id)).estado, 'programada');

    assert.deepEqual(await corrida('2026-11-24 08:05:00'), resultado({ edicion: id, enviados: 2 }));
    for (const quien of [uno, dos]) {
      const mensajes = await esperarDe(quien.email);
      assert.equal(mensajes.length, 1);
      const [mensaje] = mensajes;
      assert.equal(mensaje.Subject, ASUNTO_23);
      assert.deepEqual(mensaje.To.map((para) => para.Address), [quien.email], 'cada mail, solo a su casilla');
      assert.match(mensaje.From.Name, /Dir\. de Datos Públicos y Comunicación/);
      const completo = await detalle(mensaje.ID);
      assert.ok(completo.HTML.includes(`Buen día, ${quien.nombre}.`), 'con su nombre');
      assert.ok(completo.HTML.includes(`cid:${CID_INFOGRAFIA}`));
      assert.ok(completo.HTML.includes('Va adjunta en PNG y en SVG (para editarla).'));
      assert.deepEqual(completo.Inline.map((parte) => [parte.FileName, parte.ContentType, parte.ContentID]),
        [['infografia-prueba.png', 'image/png', CID_INFOGRAFIA]]);
      assert.deepEqual(completo.Attachments.map((parte) => [parte.FileName, parte.ContentType]),
        [['infografia-prueba.png', 'image/png'], ['infografia-prueba.svg', 'image/svg+xml']]);
      assert.ok(completo.Text.includes(`Buen día, ${quien.nombre}.`), 'con su texto plano');
    }
    const correo = await correoDe(id);
    assert.equal(correo.estado, 'enviada');
    assert.equal(correo.motivo, null);
    // enviada_at es la hora real del primer envío (spec, 5): la del reloj, no la del ahora fijo de la corrida
    assert.match(correo.enviada_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.equal(correo.ultima_corrida_at, '2026-11-24 08:05:00');
    assert.deepEqual(await filasDe(id), [[uno.id, uno.email, 'enviado', 1, null], [dos.id, dos.email, 'enviado', 1, null]]);
    // La primera hora que salió es la de la edición
    const [{ primera }] = await query(
      "SELECT DATE_FORMAT(MIN(enviado_at), '%Y-%m-%d %H:%i:%s') AS primera FROM dato_quincena_envios WHERE edicion_id = ?", [id]
    );
    assert.equal(correo.enviada_at, primera);
  });

  it('sin el SVG: el PNG en línea y adjunto, y el pie promete solo el PNG', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    const id = await llega('2026-11-24', '2026-11-24 07:30:00', { svg: false });
    assert.deepEqual(await corrida('2026-11-24 08:05:00'), resultado({ edicion: id, enviados: 1 }));
    const [mensaje] = await esperarDe(uno.email);
    const completo = await detalle(mensaje.ID);
    assert.ok(completo.HTML.includes('Va adjunta en PNG.'));
    assert.ok(!completo.HTML.includes('SVG'));
    assert.equal(completo.Inline.length, 1);
    assert.deepEqual(completo.Attachments.map((parte) => parte.FileName), ['infografia-prueba.png']);
  });

  it('la del 07/12 (no laborable, y el 08/12 feriado fijo) sale el miércoles 09/12', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    const id = await llega('2026-12-07', '2026-12-07 07:30:00');
    for (const ahora of ['2026-12-07 08:05:00', '2026-12-07 14:00:00', '2026-12-08 08:05:00', '2026-12-08 14:00:00']) {
      assert.deepEqual(await corrida(ahora), resultado(), ahora);
    }
    assert.equal((await recibidos(uno.email)).length, 0);
    assert.deepEqual(await corrida('2026-12-09 08:05:00'), resultado({ edicion: id, enviados: 1 }));
    const [mensaje] = await esperarDe(uno.email);
    assert.equal(mensaje.Subject, 'Dato de la Quincena - 07/12/2026');
  });
});

// spec 2026-11-14-dato-quincena-v1-3, 3 y 5: el mail arma el detalle con las ediciones previas, como la página
describe('la repetición en el mail (contrato v1.3)', () => {
  it('la propuesta que repite una edición archivada lleva su caja con el enlace; la que repite una que no está, sin enlace', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    // La previa llega con el envío apagado: no sale ni compite con la del 23/11
    await prender(false);
    const previa = await llega('2026-11-09', '2026-11-09 07:30:00');
    await prender(true);
    const id = await llega('2026-11-23', '2026-11-23 07:30:00', {
      cambiar: (edicion) => {
        edicion.propuestas[0].etiquetas.push('Repite');
        edicion.propuestas[0].repeticion = repeticionDePrueba({ fecha_edicion_previa: '2026-11-09' });
        edicion.propuestas[1].etiquetas = ['Efemeride', 'Repite'];
        edicion.propuestas[1].repeticion = repeticionDePrueba({
          fecha_edicion_previa: '2026-10-19', alcance: 'tema', motivo: 'hecho_actual', detalle: 'Un hecho inventado.'
        });
      }
    });
    assert.deepEqual(await corrida('2026-11-24 08:05:00'), resultado({ edicion: id, enviados: 1 }));
    const [mensaje] = await esperarDe(uno.email);
    const completo = await detalle(mensaje.ID);
    assert.ok(completo.HTML.includes(`<strong><a href="${RPAD_URL}/dato-quincena.html?id=${previa}" style="color: #3E6B96; `
      + 'text-decoration: underline;">Repite el dataset de la edición del 09/11/2026.</a></strong>'), 'con el enlace a la previa');
    assert.ok(completo.HTML.includes('<strong>Repite el tema de la edición del 19/10/2026.</strong>'), 'sin enlace');
    assert.ok(completo.HTML.includes('>Hecho actual: Un hecho inventado.</p>'));
    assert.ok(completo.HTML.includes('>Efeméride</span>') && completo.HTML.includes('>Repite</span>'));
    // El texto plano llega con los renglones de un mail (\r\n)
    const texto = completo.Text.replace(/\r\n/g, '\n');
    assert.ok(texto.includes('Repite el dataset de la edición del 09/11/2026.\nDatos nuevos: Llegaron los datos de octubre, '
      + 'que la edición anterior no tenía.\n\nPara validar antes de publicar'));
    assert.ok(texto.includes('Otro título inventado [Efeméride, Repite]'));
  });
});

// Revisión final (Minor 5): si la lectura de las ediciones previas falla, nada se cae. El recibo sale sin los avisos de la
// repetición (con los del dataset); el detalle y el mail, con la repetición sin enlace. En la consola, un renglón fijo con el
// código del error y nada de lo que trae su mensaje. La falla se simula en pool.query, solo para la consulta de las previas: el
// recibo, el detalle y la corrida se llaman acá mismo (el controlador con un req y un res armados a mano)
describe('si no se pueden leer las ediciones previas (revisión final, Minor 5)', () => {
  const RENGLON = 'Dato de la quincena: no se pudieron leer las ediciones previas';
  const CODIGO = 'ER_PREVIAS_DE_PRUEBA';
  // Un mensaje con datos, que nunca tiene que llegar a la consola
  const MENSAJE_CON_DATOS = "caída inventada cerca de '2026-11-02'";
  let archivo;

  before(async () => {
    archivo = await import('../controllers/datoQuincenaController.js');
  });

  // La consulta de leerEdicionesPrevias falla; las demás siguen. Devuelve la consola de errores, para mirarla
  const fallanLasPrevias = () => {
    const original = pool.query;
    mock.method(pool, 'query', function consulta(sql, ...resto) {
      if (String(sql).includes("tipo = 'regular' AND fecha_edicion IN (?)")) {
        return Promise.reject(Object.assign(new Error(MENSAJE_CON_DATOS), { code: CODIGO }));
      }
      return original.call(this, sql, ...resto);
    });
    callado('log');
    callado('warn');
    return callado('error');
  };
  const renglonesDe = (consola) => consola.mock.calls.map((llamada) => llamada.arguments.map(String).join(' '));
  const soloElRenglonFijo = (consola) => {
    assert.deepEqual(renglonesDe(consola), [`${RENGLON} ${CODIGO}`]);
    assert.ok(!renglonesDe(consola).some((renglon) => renglon.includes('2026-11-02') || renglon.includes('inventada')));
  };
  // Un res que guarda lo que se le responde
  const respuesta = () => ({
    headersSent: false,
    status(codigo) { this.codigo = codigo; return this; },
    json(cuerpo) { this.cuerpo = cuerpo; this.headersSent = true; return this; }
  });

  it('el recibo: 201 sin los avisos de la repetición, con los del dataset; el 200, con las previas de vuelta, los trae todos', async () => {
    await llega('2026-11-02', '2026-11-02 07:30:00');
    const piloto = pilotoDePrueba({ fecha_edicion: '2026-11-09', referencia_piloto: 'piloto-40' });
    const [primera, segunda] = piloto.propuestas;
    primera.dataset.rpad_id = null;
    primera.etiquetas.push('Repite');
    primera.repeticion = repeticionDePrueba({ fecha_edicion_previa: '2026-10-19', alcance: 'tema' });
    segunda.dataset.rpad_id = 999;
    segunda.etiquetas.push('Repite');
    segunda.repeticion = repeticionDePrueba({ fecha_edicion_previa: '2026-11-02' });
    const partes = partesDePrueba(piloto);
    const DEL_DATASET = 'La propuesta 2 cita el dataset 999, que no está en el RPAD: se guardó sin enlace.';
    let res = respuesta();
    try {
      const consola = fallanLasPrevias();
      await archivo.recibirEdicion({ partes }, res);
      assert.equal(res.codigo, 201, JSON.stringify(res.cuerpo));
      assert.deepEqual(res.cuerpo.data.avisos, [DEL_DATASET]);
      soloElRenglonFijo(consola);
    } finally {
      mock.restoreAll();
    }
    res = respuesta();
    callado('log');
    try {
      await archivo.recibirEdicion({ partes }, res);
    } finally {
      mock.restoreAll();
    }
    assert.equal(res.codigo, 200, JSON.stringify(res.cuerpo));
    assert.deepEqual(res.cuerpo.data.avisos, [
      'La propuesta 1 repite la edición del 19/10/2026, que no está en el RPAD: se guardó sin enlace.',
      DEL_DATASET,
      'La propuesta 2 repite el dataset 999 de la edición del 02/11/2026, pero esa edición no lo tiene.'
    ]);
  });

  it('el detalle (ver): 200 con la repetición sin enlace; con las previas de vuelta, con su enlace', async () => {
    const previa = await llega('2026-11-02', '2026-11-02 07:30:00');
    const id = await llega('2026-11-16', '2026-11-16 07:30:00', {
      cambiar: (edicion) => {
        edicion.propuestas[0].etiquetas.push('Repite');
        edicion.propuestas[0].repeticion = repeticionDePrueba();
      }
    });
    let res = respuesta();
    try {
      const consola = fallanLasPrevias();
      await archivo.ver({ params: { id: String(id) } }, res);
      assert.equal(res.codigo ?? 200, 200, JSON.stringify(res.cuerpo));
      assert.equal(res.cuerpo.success, true);
      assert.deepEqual(res.cuerpo.data.propuestas[0].repeticion, {
        texto: 'Repite el dataset de la edición del 02/11/2026.',
        motivo: 'Datos nuevos: Llegaron los datos de octubre, que la edición anterior no tenía.',
        id_edicion: null
      });
      soloElRenglonFijo(consola);
    } finally {
      mock.restoreAll();
    }
    res = respuesta();
    await archivo.ver({ params: { id: String(id) } }, res);
    assert.equal(res.cuerpo.data.propuestas[0].repeticion.id_edicion, previa);
  });

  it('el mail: sale igual en su corrida, con la caja de la repetición sin enlace y sin errores', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    await prender(false);
    await llega('2026-11-09', '2026-11-09 07:30:00');
    await prender(true);
    const id = await llega('2026-11-23', '2026-11-23 07:30:00', {
      cambiar: (edicion) => {
        edicion.propuestas[0].etiquetas.push('Repite');
        edicion.propuestas[0].repeticion = repeticionDePrueba({ fecha_edicion_previa: '2026-11-09' });
      }
    });
    try {
      const consola = fallanLasPrevias();
      assert.deepEqual(await corrida('2026-11-24 08:05:00'), resultado({ edicion: id, enviados: 1 }));
      soloElRenglonFijo(consola);
    } finally {
      mock.restoreAll();
    }
    const [mensaje] = await esperarDe(uno.email);
    const completo = await detalle(mensaje.ID);
    assert.ok(completo.HTML.includes('<strong>Repite el dataset de la edición del 09/11/2026.</strong>'), 'sin enlace');
    assert.ok(!completo.HTML.includes('text-decoration: underline'));
  });
});

describe('nunca dos veces, a lo sumo una (spec, 8; Review Focus 1)', () => {
  it('dos corridas seguidas: un mail por persona', async () => {
    const uno = await persona({ clave: 'Uno' });
    const dos = await persona({ clave: 'Dos' });
    await aLaLista(uno, dos);
    const id = await llega('2026-11-23', '2026-11-23 07:30:00');
    assert.deepEqual(await corrida('2026-11-24 08:05:00'), resultado({ edicion: id, enviados: 2 }));
    assert.deepEqual(await corrida('2026-11-24 08:05:30'), resultado());
    assert.deepEqual(await corrida('2026-11-24 14:00:00'), resultado());
    for (const quien of [uno, dos]) {
      await esperarDe(quien.email);
      await sinMasDe(quien.email, 1);
    }
  });

  it('dos corridas a la vez: un mail por persona', async () => {
    const quienes = [];
    for (const clave of ['Uno', 'Dos', 'Tres']) quienes.push(await persona({ clave }));
    await aLaLista(...quienes);
    const id = await llega('2026-11-23', '2026-11-23 07:30:00');
    const [una, otra] = await Promise.all([corrida('2026-11-24 08:05:00'), corrida('2026-11-24 08:05:00')]);
    assert.equal(una.enviados + otra.enviados, 3);
    for (const quien of quienes) {
      await esperarDe(quien.email);
      await sinMasDe(quien.email, 1);
    }
    assert.equal((await correoDe(id)).estado, 'enviada');
  });

  it('con el candado tomado en otra conexión: «ocupada», sin mails y sin escribir nada', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    const id = await llega('2026-11-23', '2026-11-23 07:30:00');
    const conexion = await db().getConnection();
    try {
      const [[{ tomado }]] = await conexion.query('SELECT GET_LOCK(?, 5) AS tomado', [servicio.BLOQUEO_DATO_QUINCENA]);
      assert.equal(Number(tomado), 1);
      assert.equal(servicio.BLOQUEO_DATO_QUINCENA, 'rpad_dato_quincena_correo');
      assert.deepEqual(await corrida('2026-11-24 08:05:00'), resultado({ ocupada: true }));
    } finally {
      await conexion.query('SELECT RELEASE_LOCK(?)', [servicio.BLOQUEO_DATO_QUINCENA]);
      conexion.release();
    }
    await sinMasDe(uno.email, 0);
    assert.deepEqual(await filasDe(id), []);
    assert.equal((await correoDe(id)).estado, 'programada');
    assert.equal((await laCorrida()).inicio, null, 'no anota la corrida');
  });

  it('la reserva la garantiza la base, no el candado: una fila se toma una sola vez y nunca la que ya salió o se cortó', async () => {
    const correoDatos = await import('../services/datoQuincenaCorreoDatos.js');
    const uno = await persona({ clave: 'Uno' });
    const id = await llega('2026-11-23', '2026-11-23 07:30:00');
    const fila = async (estado, intentos) => (await query(
      `INSERT INTO dato_quincena_envios (edicion_id, usuario_id, email, tipo, estado, intentos, creado_at)
       VALUES (?, ?, ?, 'automatico', ?, ?, '2026-11-24 08:05:00')`, [id, uno.id, uno.email, estado, intentos]
    )).insertId;
    const reservar = (envioId) => correoDatos.reservarEnvio(envioId, uno.email, '2026-11-24 08:05:00');
    const limpiar = () => query('DELETE FROM dato_quincena_envios WHERE edicion_id = ?', [id]);

    // Dos corridas que leyeron la misma fila pendiente: solo una se la queda
    const pendiente = await fila('pendiente', 0);
    assert.deepEqual(await Promise.all([reservar(pendiente), reservar(pendiente)]).then((dos) => dos.sort()), [false, true]);
    assert.equal(await reservar(pendiente), false, 'reservada («enviando»): no se vuelve a tomar');
    await correoDatos.terminarEnvio(pendiente, { enviado: true, ahora: '2026-11-24 08:05:03' });
    assert.equal(await reservar(pendiente), false, 'enviada');
    await limpiar();
    assert.equal(await reservar(await fila('fallido', 2)), true, 'fallida con un intento por delante');
    await limpiar();
    assert.equal(await reservar(await fila('fallido', 3)), false, 'fallida con los 3 intentos');
    await limpiar();
    for (const estado of ['licencia', 'omitido']) {
      assert.equal(await reservar(await fila(estado, 0)), false, estado);
      await limpiar();
    }
    // Una de reenvío o de prueba nunca es de la corrida
    const { insertId: reenvio } = await query(
      `INSERT INTO dato_quincena_envios (edicion_id, usuario_id, email, tipo, estado, intentos, creado_at)
       VALUES (?, ?, ?, 'reenvio', 'fallido', 1, '2026-11-24 08:05:00')`, [id, uno.id, uno.email]
    );
    assert.equal(await reservar(reenvio), false, 'un reenvío');
  });

  it('una persona que quedó «enviando» por un corte no se vuelve a mandar: pudo haber salido', async () => {
    const uno = await persona({ clave: 'Uno' });
    const dos = await persona({ clave: 'Dos' });
    await aLaLista(uno, dos);
    const id = await llega('2026-11-23', '2026-11-23 07:30:00');
    await query(
      `INSERT INTO dato_quincena_envios (edicion_id, usuario_id, email, tipo, estado, intentos, ultimo_intento_at, creado_at)
       VALUES (?, ?, ?, 'automatico', 'enviando', 1, '2026-11-24 08:05:01', '2026-11-24 08:05:00'),
              (?, ?, ?, 'automatico', 'pendiente', 0, NULL, '2026-11-24 08:05:00')`,
      [id, uno.id, uno.email, id, dos.id, dos.email]
    );
    assert.deepEqual(await corrida('2026-11-24 14:00:00'), resultado({ enviados: 1 }));
    await esperarDe(dos.email);
    await sinMasDe(uno.email, 0);
    assert.deepEqual((await filasDe(id)).map((fila) => fila.slice(2, 4)), [['enviando', 1], ['enviado', 1]]);
    assert.equal((await correoDe(id)).estado, 'parcial', 'sin confirmar cuenta como parcial');
  });
});

describe('las fallas y los reintentos (spec, 5 y 6)', () => {
  it('falla para una persona: fallido con 1 intento y el texto fijo; se reintenta a las 14:00 y a la mañana; al tercero, parcial y el aviso', async () => {
    const uno = await persona({ clave: 'Uno' });
    const dos = await persona({ clave: 'Dos' });
    await aLaLista(uno, dos);
    const id = await llega('2026-11-23', '2026-11-23 07:30:00');
    const { enviar, pedidos } = transporteQueFallaPara(dos.email);
    const errores = callado('error');
    const avisos = callado('warn');
    try {
      const primera = await corrida('2026-11-24 08:05:00', { enviar });
      assert.deepEqual(primera, resultado({
        edicion: id, enviados: 1, fallidos: 1, errores: [{ usuario_id: dos.id, error: MENSAJES_CORREO.envioFallido }]
      }));
      assert.ok(!JSON.stringify(primera).includes('@'), 'sin el texto del transporte');
      assert.deepEqual(await filasDe(id), [[uno.id, uno.email, 'enviado', 1, null], [dos.id, dos.email, 'fallido', 1, 'No se pudo enviar el mail.']]);
      // Mientras queda un reintento, sigue programada (lo que se muestra sale de las filas) y ya tiene la hora del primer envío
      const enCurso = await correoDe(id);
      assert.equal(enCurso.estado, 'programada');
      assert.notEqual(enCurso.enviada_at, null);
      assert.deepEqual((await estado('2026-11-24 08:10:00')).alertas, [], 'todavía quedan intentos');

      assert.deepEqual(await corrida('2026-11-24 14:00:00', { enviar }), resultado({
        fallidos: 1, errores: [{ usuario_id: dos.id, error: MENSAJES_CORREO.envioFallido }]
      }));
      assert.deepEqual((await filasDe(id))[1].slice(2, 4), ['fallido', 2]);
      assert.deepEqual(await corrida('2026-11-25 08:05:00', { enviar }), resultado({
        fallidos: 1, errores: [{ usuario_id: dos.id, error: MENSAJES_CORREO.envioFallido }]
      }));
      assert.deepEqual((await filasDe(id))[1].slice(2, 4), ['fallido', 3]);
      assert.equal((await correoDe(id)).estado, 'parcial');

      // El cuarto no sale
      assert.deepEqual(await corrida('2026-11-25 14:00:00', { enviar }), resultado());
      assert.equal(pedidos.get(dos.email), 3);
      assert.equal(pedidos.get(uno.email), 1);
      assert.ok(!conArroba(errores) && !conArroba(avisos), 'la consola no lleva direcciones');
    } finally {
      errores.mock.restore();
      avisos.mock.restore();
    }
    await esperarDe(uno.email);
    await sinMasDe(uno.email, 1);
    await sinMasDe(dos.email, 0);

    const { alertas } = await estado();
    assert.deepEqual(alertas, [{
      tipo: 'dato-quincena-no-llego', nivel: 'error',
      mensaje: 'El dato de la quincena del 23/11/2026 no le llegó a 1 persona: se le puede reenviar desde la edición.'
    }]);
    // Un reenvío que le llegó a esa persona saca el aviso
    await query(
      `INSERT INTO dato_quincena_envios (edicion_id, usuario_id, email, tipo, estado, intentos, enviado_at, creado_at)
       VALUES (?, ?, ?, 'reenvio', 'enviado', 1, '2026-11-25 15:00:00', '2026-11-25 15:00:00')`, [id, dos.id, dos.email]
    );
    assert.deepEqual((await estado()).alertas, []);
  });

  it('el aviso mira la última edición que salió: una más nueva que llegó a todos lo saca', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    const vieja = await llega('2026-11-09', '2026-11-09 07:30:00');
    const { enviar } = transporteQueFallaPara(uno.email);
    const errores = callado('error');
    try {
      for (const ahora of ['2026-11-10 08:05:00', '2026-11-10 14:00:00', '2026-11-11 08:05:00']) await corrida(ahora, { enviar });
    } finally {
      errores.mock.restore();
    }
    assert.equal((await correoDe(vieja)).estado, 'fallida');
    assert.match((await estado()).alertas[0].mensaje, /^El dato de la quincena del 09\/11\/2026 /);
    const nueva = await llega('2026-11-23', '2026-11-23 07:30:00');
    assert.deepEqual(await corrida('2026-11-24 08:05:00'), resultado({ edicion: nueva, enviados: 1 }));
    assert.deepEqual((await estado()).alertas, []);
  });

  it('vencida con una persona en reintento (el envío estuvo apagado): no sale más, la edición cierra y se puede reenviar (Ruling 9)', async () => {
    const correoDatos = await import('../services/datoQuincenaCorreoDatos.js');
    const uno = await persona({ clave: 'Uno' });
    const dos = await persona({ clave: 'Dos' });
    await aLaLista(uno, dos);
    const id = await llega('2026-11-23', '2026-11-23 07:30:00');
    const { enviar, pedidos } = transporteQueFallaPara(dos.email);
    const errores = callado('error');
    try {
      assert.equal((await corrida('2026-11-24 08:05:00', { enviar })).fallidos, 1);
      await prender(false);
      // Apagado y vigente: espera, en reintento
      assert.deepEqual(await corrida('2026-11-24 14:00:00', { enviar }), resultado());
      assert.deepEqual((await filasDe(id))[1].slice(2, 4), ['fallido', 1]);
      assert.equal((await correoDe(id)).estado, 'programada');
      assert.deepEqual((await estado('2026-11-24 14:00:00')).alertas, []);
      // 20 días después lo prenden: ya no está vigente, no sale
      await prender(true);
      assert.deepEqual(await corrida('2026-12-14 08:05:00', { enviar }), resultado());
    } finally {
      errores.mock.restore();
    }
    assert.equal(pedidos.get(dos.email), 1, 'un solo intento');
    await esperarDe(uno.email);
    await sinMasDe(uno.email, 1);
    await sinMasDe(dos.email, 0);
    assert.deepEqual((await filasDe(id))[1].slice(2, 4), ['fallido', 1], 'la fila no cambia');
    // La edición cerró: parcial, guardada por la corrida
    assert.deepEqual(await correoDe(id), {
      estado: 'parcial', motivo: null, enviada_at: (await correoDe(id)).enviada_at, ultima_corrida_at: '2026-12-14 08:05:00'
    });
    // Lo que ven la caja del correo, la pastilla y Correos → Estado, con las filas como las lee la API
    const ahora = '2026-12-14 08:05:00';
    const vigente = estaVigente('2026-11-23', ahora.slice(0, 10));
    assert.equal(vigente, false);
    const correo = await correoDatos.correoDe(id);
    const envios = await correoDatos.enviosDe(id);
    assert.deepEqual(textoDeLaPersona(envios.find((fila) => fila.usuario_id === dos.id), { vigente }),
      { texto: 'No se pudo enviar (1 intento)', mal: true });
    assert.equal(sePuedeReenviar({ tipo: 'regular', correo, envios, vigente }), true);
    const calendario = await feriadosDatos.leerCalendario();
    assert.deepEqual(pastillaDelEnvio({
      tipo: 'regular', fecha_edicion: '2026-11-23', correo, envios, reenvios: [], lista: [], correoDelBot: null, envioActivo: true,
      ahora, calendario, admin: true
    }), { tipo: 'parcial', texto: 'Enviada a 1 de 2' });
    assert.deepEqual((await estado(ahora)).alertas, [{
      tipo: 'dato-quincena-no-llego', nivel: 'error',
      mensaje: 'El dato de la quincena del 23/11/2026 no le llegó a 1 persona: se le puede reenviar desde la edición.'
    }]);
  });

  it('un transporte que tira: la persona queda sin confirmar y no se reintenta', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    const id = await llega('2026-11-23', '2026-11-23 07:30:00');
    let llamadas = 0;
    const enviar = async () => {
      llamadas += 1;
      throw new Error('Se cortó la conexión');
    };
    const errores = callado('error');
    try {
      const salida = await corrida('2026-11-24 08:05:00', { enviar });
      assert.equal(salida.enviados + salida.fallidos, 0);
      assert.deepEqual(salida.errores, [{ usuario_id: uno.id, error: 'No se pudo confirmar si el mail salió.' }]);
      assert.deepEqual(await estado(), {
        texto: 'El dato de la quincena: la última corrida fue el 24/11 a las 8:05: no se pudo completar. No se pudo confirmar si el '
          + 'mail salió.',
        alertas: [{
          tipo: 'dato-quincena-con-errores', nivel: 'error',
          mensaje: 'La última corrida del dato de la quincena (el 24/11 a las 8:05) terminó con errores: no se pudo completar. No se '
            + 'pudo confirmar si el mail salió.'
        }]
      });
      assert.deepEqual(await corrida('2026-11-24 14:00:00', { enviar }), resultado());
    } finally {
      errores.mock.restore();
    }
    assert.equal(llamadas, 1);
    assert.deepEqual((await filasDe(id)).map((fila) => fila.slice(2, 4)), [['enviando', 1]]);
    assert.equal((await correoDe(id)).estado, 'parcial');
    // La primera corrida quedó con errores; la de las 14:00, que no tenía nada para mandar, no
    assert.equal((await estado()).texto,
      'El dato de la quincena: la última corrida fue el 24/11 a las 14:00: no había nada para mandar.');
  });
});

describe('quién la recibe: la lista y las personas de ese momento (spec, 5; Review Focus 3)', () => {
  it('de licencia oficial ese día: «licencia», sin mail ni reintento; inactiva o sin un email válido: omitida con su motivo', async () => {
    const uno = await persona({ clave: 'Uno' });
    const deLicencia = await persona({ clave: 'Dos' });
    const inactiva = await persona({ clave: 'Tres', activo: 0 });
    const sinEmail = await persona({ clave: 'Cuatro', email: `sin-arroba-${sufijo()}` });
    await aLaLista(uno, deLicencia, inactiva, sinEmail);
    await licencia(deLicencia, '2026-11-20', '2026-11-27');
    // Una anulada no cuenta
    await query("INSERT INTO usuarios_licencias (usuario_id, desde, hasta, anulada) VALUES (?, '2026-11-24', '2026-11-24', 1)", [uno.id]);
    const id = await llega('2026-11-23', '2026-11-23 07:30:00');

    assert.deepEqual(await corrida('2026-11-24 08:05:00'), resultado({ edicion: id, enviados: 1, licencia: 1, omitidos: 2 }));
    assert.deepEqual(await corrida('2026-11-24 14:00:00'), resultado());
    assert.deepEqual(await filasDe(id), [
      [uno.id, uno.email, 'enviado', 1, null],
      [deLicencia.id, deLicencia.email, 'licencia', 0, null],
      [inactiva.id, inactiva.email, 'omitido', 0, MENSAJES_CORREO.inactiva],
      [sinEmail.id, sinEmail.email, 'omitido', 0, MENSAJES_CORREO.sinEmail]
    ]);
    assert.equal((await correoDe(id)).estado, 'enviada', 'le llegó a todas las que correspondía');
    await esperarDe(uno.email);
    await sinMasDe(deLicencia.email, 0);
    await sinMasDe(inactiva.email, 0);
  });

  it('cambió el email, salió de la lista, se desactivó o se sumó antes de la primera corrida: lo de ese momento', async () => {
    const cambia = await persona({ clave: 'Uno' });
    const sale = await persona({ clave: 'Dos' });
    const seDesactiva = await persona({ clave: 'Tres' });
    const seSuma = await persona({ clave: 'Cuatro' });
    await aLaLista(cambia, sale, seDesactiva);
    const id = await llega('2026-11-23', '2026-11-23 07:30:00');

    const nuevo = `t_dq_nuevo_${sufijo()}@ejemplo.test`;
    await query('UPDATE usuarios SET email = ? WHERE id = ?', [nuevo, cambia.id]);
    await query('DELETE FROM dato_quincena_destinatarios WHERE usuario_id = ?', [sale.id]);
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [seDesactiva.id]);
    await aLaLista(seSuma);

    assert.deepEqual(await corrida('2026-11-24 08:05:00'), resultado({ edicion: id, enviados: 2, omitidos: 1 }));
    assert.deepEqual(await filasDe(id), [
      [cambia.id, nuevo, 'enviado', 1, null],
      [seDesactiva.id, seDesactiva.email, 'omitido', 0, MENSAJES_CORREO.inactiva],
      [seSuma.id, seSuma.email, 'enviado', 1, null]
    ]);
    await esperarDe(nuevo);
    await esperarDe(seSuma.email);
    await sinMasDe(cambia.email, 0);
    await sinMasDe(sale.email, 0);

    // Quien se suma después de la primera corrida no la recibe sola
    const tarde = await persona({ clave: 'Cinco' });
    await aLaLista(tarde);
    assert.deepEqual(await corrida('2026-11-24 14:00:00'), resultado());
    await sinMasDe(tarde.email, 0);
  });

  it('cada reintento usa lo de ese momento: el email de hoy, y de licencia no se le manda', async () => {
    const cambia = await persona({ clave: 'Uno' });
    const seVa = await persona({ clave: 'Dos' });
    await aLaLista(cambia, seVa);
    const id = await llega('2026-11-23', '2026-11-23 07:30:00');
    const { enviar } = transporteQueFallaPara(cambia.email, seVa.email);
    const errores = callado('error');
    try {
      assert.equal((await corrida('2026-11-24 08:05:00', { enviar })).fallidos, 2);
    } finally {
      errores.mock.restore();
    }
    const nuevo = `t_dq_nuevo_${sufijo()}@ejemplo.test`;
    await query('UPDATE usuarios SET email = ? WHERE id = ?', [nuevo, cambia.id]);
    await licencia(seVa, '2026-11-24', '2026-11-30');

    assert.deepEqual(await corrida('2026-11-24 14:00:00'), resultado({ enviados: 1, licencia: 1 }));
    assert.deepEqual(await filasDe(id), [
      [cambia.id, nuevo, 'enviado', 2, null],
      [seVa.id, seVa.email, 'licencia', 1, null]
    ]);
    await esperarDe(nuevo);
    await sinMasDe(seVa.email, 0);
    assert.equal((await correoDe(id)).estado, 'enviada');
  });

  it('todas de licencia: la edición queda fallida, sin ningún mail', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    await licencia(uno, '2026-11-23', '2026-11-30');
    const id = await llega('2026-11-23', '2026-11-23 07:30:00');
    assert.deepEqual(await corrida('2026-11-24 08:05:00'), resultado({ edicion: id, licencia: 1 }));
    assert.equal((await correoDe(id)).estado, 'fallida');
    await sinMasDe(uno.email, 0);
  });
});

describe('qué decide la corrida (spec, 5 y 8)', () => {
  it('apagado: la programada queda no enviada, «apagado», también en un día no hábil; prenderlo no la manda', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    const id = await llega('2026-11-23', '2026-11-23 07:30:00');
    await prender(false);
    assert.deepEqual(await corrida('2026-11-23 08:05:00'), resultado());
    assert.deepEqual(await correoDe(id), { estado: 'no_enviada', motivo: 'apagado', enviada_at: null, ultima_corrida_at: '2026-11-23 08:05:00' });
    await prender(true);
    assert.deepEqual(await corrida('2026-11-24 08:05:00'), resultado());
    await sinMasDe(uno.email, 0);
  });

  it('dos programadas: sale la más nueva y la otra queda «mas_nueva»', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    const anterior = await llega('2026-11-16', '2026-11-16 07:30:00');
    const nueva = await llega('2026-11-23', '2026-11-23 07:30:00');
    assert.deepEqual(await corrida('2026-11-24 08:05:00'), resultado({ edicion: nueva, enviados: 1 }));
    assert.deepEqual([(await correoDe(anterior)).estado, (await correoDe(anterior)).motivo], ['no_enviada', 'mas_nueva']);
    assert.equal((await correoDe(nueva)).estado, 'enviada');
    const [mensaje] = await esperarDe(uno.email);
    assert.equal(mensaje.Subject, ASUNTO_23);
    await sinMasDe(uno.email, 1);
  });

  it('de hace 14 días: «vieja», sin mail', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    const id = await llega('2026-11-10', '2026-11-10 07:30:00');
    assert.deepEqual(await corrida('2026-11-24 08:05:00'), resultado());
    assert.deepEqual([(await correoDe(id)).estado, (await correoDe(id)).motivo], ['no_enviada', 'vieja']);
    await sinMasDe(uno.email, 0);
  });

  it('nadie en la lista: no enviada, «sin_lista»', async () => {
    const id = await llega('2026-11-23', '2026-11-23 07:30:00');
    assert.deepEqual(await corrida('2026-11-24 08:05:00'), resultado({ edicion: id }));
    assert.deepEqual([(await correoDe(id)).estado, (await correoDe(id)).motivo], ['no_enviada', 'sin_lista']);
    assert.deepEqual(await filasDe(id), []);
  });

  it('una de mañana espera su fecha', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    const id = await llega('2026-11-25', '2026-11-24 15:00:00');
    assert.deepEqual(await corrida('2026-11-24 15:00:00'), resultado());
    assert.equal((await correoDe(id)).estado, 'programada');
    assert.deepEqual(await corrida('2026-11-25 08:05:00'), resultado({ edicion: id, enviados: 1 }));
  });

  it('llega mientras corre la de las 8:05, después de que leyó las programadas: sale a las 14:00, una sola vez (Review Focus 2)', async () => {
    const uno = await persona({ clave: 'Uno' });
    const dos = await persona({ clave: 'Dos' });
    await aLaLista(uno, dos);
    const primera = await llega('2026-11-23', '2026-11-23 07:30:00');
    let otra = null;
    const enviar = async (mail) => {
      otra ??= await llega('2026-11-24', '2026-11-24 08:05:30');
      return sendEmail(mail);
    };
    assert.deepEqual(await corrida('2026-11-24 08:05:00', { enviar }), resultado({ edicion: primera, enviados: 2 }));
    assert.notEqual(otra, null);
    assert.equal((await correoDe(otra)).estado, 'programada');
    assert.deepEqual(await filasDe(otra), []);

    assert.deepEqual(await corrida('2026-11-24 14:00:00'), resultado({ edicion: otra, enviados: 2 }));
    for (const quien of [uno, dos]) {
      const mensajes = await esperarDe(quien.email, 2);
      assert.deepEqual(mensajes.map((mensaje) => mensaje.Subject).sort(), [ASUNTO_23, 'Dato de la Quincena - 24/11/2026']);
      await sinMasDe(quien.email, 2);
    }
  });

  it('sin poder leer la tabla de feriados: no sale; con la tabla de vuelta, sale el día hábil siguiente (Review Focus 4)', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    const id = await llega('2026-11-24', '2026-11-24 07:30:00');
    const errores = callado('error');
    let sinTabla;
    try {
      await query('RENAME TABLE feriados TO feriados_sin_leer');
      try {
        sinTabla = await corrida('2026-11-24 08:05:00');
      } finally {
        await query('RENAME TABLE feriados_sin_leer TO feriados');
      }
    } finally {
      errores.mock.restore();
    }
    assert.deepEqual(sinTabla, resultado({
      errores: [{ usuario_id: null, error: 'No se pudieron leer los feriados: el dato de la quincena no salió y sale en la corrida siguiente.' }]
    }));
    assert.equal((await correoDe(id)).estado, 'programada');
    await sinMasDe(uno.email, 0);
    const anotada = await laCorrida();
    assert.equal(Number(anotada.con_errores), 1);

    assert.deepEqual(await corrida('2026-11-25 08:05:00'), resultado({ edicion: id, enviados: 1 }));
    await esperarDe(uno.email);
  });

  it('una falla de la base no rechaza: va a los errores con un texto fijo y queda anotada', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    await llega('2026-11-23', '2026-11-23 07:30:00');
    const errores = callado('error');
    await query('RENAME TABLE dato_quincena_envios TO dato_quincena_envios_aparte');
    try {
      const salida = await corrida('2026-11-24 08:05:00');
      assert.deepEqual(salida.errores, [{ usuario_id: null, error: 'No se pudo completar el envío del dato de la quincena.' }]);
      assert.equal(salida.enviados, 0);
    } finally {
      await query('RENAME TABLE dato_quincena_envios_aparte TO dato_quincena_envios');
      errores.mock.restore();
    }
    const anotada = await laCorrida();
    assert.equal(Number(anotada.con_errores), 1);
    assert.ok(anotada.fin);
    await sinMasDe(uno.email, 0);
  });

  it('correoDelDatoQuincenaAislado nunca rechaza, aunque no se pueda tomar el candado', async () => {
    const calendario = await feriadosDatos.leerCalendario();
    const errores = callado('error');
    const original = pool.getConnection;
    pool.getConnection = () => Promise.reject(new Error('Sin base'));
    try {
      const salida = await servicio.correoDelDatoQuincenaAislado(calendario, { ahora: '2026-11-24 08:05:00' });
      assert.deepEqual(salida, resultado({ errores: [{ usuario_id: null, error: 'No se pudo completar el envío del dato de la quincena.' }] }));
    } finally {
      pool.getConnection = original;
      errores.mock.restore();
    }
  });
});

describe('Correos → Estado (spec, 13)', () => {
  it('la línea de la última corrida, armada por el servidor', async () => {
    assert.deepEqual(await estado(),
      { texto: 'El dato de la quincena: sin registro de corridas todavía.', alertas: [] });
    const quienes = [];
    for (const clave of ['Uno', 'Dos', 'Tres', 'Cuatro']) quienes.push(await persona({ clave }));
    await aLaLista(...quienes);
    await llega('2026-11-23', '2026-11-23 07:30:00');
    await corrida('2026-11-24 08:05:00');
    assert.deepEqual(await estado(),
      { texto: 'El dato de la quincena: la última corrida fue el 24/11 a las 8:05: mandó 4 mails.', alertas: [] });
    await corrida('2026-11-24 14:00:00');
    assert.equal((await estado()).texto,
      'El dato de la quincena: la última corrida fue el 24/11 a las 14:00: no había nada para mandar.');
    await corrida('2026-11-28 08:05:00');
    assert.equal((await estado()).texto,
      'El dato de la quincena: la última corrida fue el 28/11 a las 8:05: no salió nada, porque no era día hábil.');
    await prender(false);
    await corrida('2026-11-30 08:05:00');
    assert.equal((await estado()).texto,
      'El dato de la quincena: la última corrida fue el 30/11 a las 8:05: no salió nada, porque el envío automático está apagado.');
  });

  it('una corrida en curso (sin fin y con el candado tomado) y una que no terminó', async () => {
    await query("UPDATE dato_quincena_correo_config SET corrida_inicio_at = '2026-11-24 08:05:02', corrida_fin_at = NULL WHERE id = 1");
    assert.equal((await estado()).texto,
      'El dato de la quincena: la última corrida, el 24/11 a las 8:05, no terminó.');
    const conexion = await db().getConnection();
    try {
      await conexion.query('SELECT GET_LOCK(?, 5)', [servicio.BLOQUEO_DATO_QUINCENA]);
      assert.equal((await estado()).texto,
        'El dato de la quincena: hay una corrida en curso, desde el 24/11 a las 8:05.');
    } finally {
      await conexion.query('SELECT RELEASE_LOCK(?)', [servicio.BLOQUEO_DATO_QUINCENA]);
      conexion.release();
    }
  });

  it('una corrida con errores de la corrida (no de un envío que se reintenta) suma su alerta', async () => {
    const errores = callado('error');
    try {
      await query('RENAME TABLE feriados TO feriados_sin_leer');
      try {
        await corrida('2026-11-24 08:05:00');
      } finally {
        await query('RENAME TABLE feriados_sin_leer TO feriados');
      }
    } finally {
      errores.mock.restore();
    }
    const texto = 'El dato de la quincena: la última corrida fue el 24/11 a las 8:05: no salió nada, porque no se pudieron leer los '
      + 'feriados: lo que esperaba sale en la corrida siguiente.';
    assert.deepEqual(await estado(), {
      texto,
      alertas: [{
        tipo: 'dato-quincena-con-errores', nivel: 'error',
        mensaje: 'La última corrida del dato de la quincena (el 24/11 a las 8:05) terminó con errores: no salió nada, porque no se '
          + 'pudieron leer los feriados: lo que esperaba sale en la corrida siguiente.'
      }]
    });
  });

  const respuestaFalsa = () => ({ statusCode: 200, body: null, status(codigo) { this.statusCode = codigo; return this; }, json(cuerpo) { this.body = cuerpo; return this; } });

  it('verEstado suma dato_quincena: { texto } y sus alertas al final; si no se puede leer, null y una advertencia', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    await llega('2026-11-23', '2026-11-23 07:30:00');
    await corrida('2026-11-24 08:05:00');
    const res = respuestaFalsa();
    await correos.verEstado({}, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.dato_quincena, { texto: 'El dato de la quincena: la última corrida fue el 24/11 a las 8:05: mandó 1 mail.' });
    assert.ok(!res.body.data.alertas.some((alerta) => alerta.tipo.startsWith('dato-quincena')));

    const errores = callado('error');
    await query('RENAME TABLE dato_quincena_correo_config TO dato_quincena_correo_config_aparte');
    try {
      const sinLeer = respuestaFalsa();
      await correos.verEstado({}, sinLeer);
      assert.equal(sinLeer.statusCode, 200);
      assert.equal(sinLeer.body.data.dato_quincena, null);
      assert.deepEqual(sinLeer.body.data.alertas.at(-1), {
        tipo: 'dato-quincena-sin-estado', nivel: 'advertencia', mensaje: 'No se pudo leer la última corrida del dato de la quincena.'
      });
    } finally {
      await query('RENAME TABLE dato_quincena_correo_config_aparte TO dato_quincena_correo_config');
      errores.mock.restore();
    }
  });
});

describe('en las dos corridas, sin frenar nada ni al revés (spec, 8)', () => {
  const respuestaFalsa = () => ({ statusCode: 200, body: null, status(codigo) { this.statusCode = codigo; return this; }, json(cuerpo) { this.body = cuerpo; return this; } });
  const conReloj = async (momento, fn) => {
    mock.timers.enable({ apis: ['Date'], now: new Date(`${momento.replace(' ', 'T')}-03:00`) });
    try {
      return await fn();
    } finally {
      mock.timers.reset();
    }
  };
  const lasDe14 = async (momento) => {
    const res = respuestaFalsa();
    await conReloj(momento, () => controlador.ejecutarNotificacionCambiosPendientes({}, res));
    return res;
  };
  const lasDe8 = async (momento) => {
    const res = respuestaFalsa();
    await conReloj(momento, () => controlador.ejecutarNotificacionesDiarias({}, res));
    return res;
  };

  it('a las 8:05 sale y va en `dato_quincena`; a las 14:00 no repite nada', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    const id = await llega('2026-11-23', '2026-11-23 07:30:00');
    const deMañana = await lasDe8('2026-11-24 08:05:00');
    assert.equal(deMañana.statusCode, 200, JSON.stringify(deMañana.body));
    assert.deepEqual(deMañana.body.data.dato_quincena, resultado({ edicion: id, enviados: 1 }));
    const deTarde = await lasDe14('2026-11-24 14:00:00');
    assert.equal(deTarde.statusCode, 200, JSON.stringify(deTarde.body));
    assert.deepEqual(deTarde.body.data.dato_quincena, resultado());
    await esperarDe(uno.email);
    await sinMasDe(uno.email, 1);
  });

  it('a las 14:00 manda lo que llegó después de las 8:05', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    const id = await llega('2026-11-24', '2026-11-24 09:12:00');
    const res = await lasDe14('2026-11-24 14:00:00');
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.dato_quincena, resultado({ edicion: id, enviados: 1 }));
    await esperarDe(uno.email);
  });

  it('«ocupada» no es un error: las dos corridas siguen en 200', async () => {
    const conexion = await db().getConnection();
    try {
      await conexion.query('SELECT GET_LOCK(?, 5)', [servicio.BLOQUEO_DATO_QUINCENA]);
      const deTarde = await lasDe14('2026-11-24 14:00:00');
      assert.equal(deTarde.statusCode, 200, JSON.stringify(deTarde.body));
      assert.equal(deTarde.body.data.dato_quincena.ocupada, true);
      const deMañana = await lasDe8('2026-11-25 08:05:00');
      assert.equal(deMañana.statusCode, 200, JSON.stringify(deMañana.body));
      assert.equal(deMañana.body.data.dato_quincena.ocupada, true);
    } finally {
      await conexion.query('SELECT RELEASE_LOCK(?)', [servicio.BLOQUEO_DATO_QUINCENA]);
      conexion.release();
    }
  });

  it('un error suyo da 207, con su tipo, y lo demás de la corrida sigue', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    await llega('2026-11-23', '2026-11-23 07:30:00');
    const errores = callado('error');
    await query('RENAME TABLE dato_quincena_envios TO dato_quincena_envios_aparte');
    try {
      const deMañana = await lasDe8('2026-11-24 08:05:00');
      assert.equal(deMañana.statusCode, 207);
      assert.deepEqual(deMañana.body.data.errores.filter((fallo) => fallo.tipo === 'dato-quincena'),
        [{ tipo: 'dato-quincena', usuario_id: null, error: 'No se pudo completar el envío del dato de la quincena.' }]);
      assert.notEqual(deMañana.body.data.notasDigitales, null);
      const deTarde = await lasDe14('2026-11-24 14:00:00');
      assert.equal(deTarde.statusCode, 207);
      assert.equal(deTarde.body.success, false);
      assert.match(deTarde.body.message, /^Recordatorios enviados a /);
      assert.equal(deTarde.body.data.dato_quincena.errores.length, 1);
    } finally {
      await query('RENAME TABLE dato_quincena_envios_aparte TO dato_quincena_envios');
      errores.mock.restore();
    }
  });

  it('el orden del código: a las 8:05, después del vencimiento de Mi espacio y antes de esperar al diario; a las 14:00, después del diario', () => {
    const fuente = readFileSync(new URL('../controllers/notificacionesController.js', import.meta.url), 'utf8');
    const corridaDe8 = fuente.slice(fuente.indexOf('export const ejecutarNotificacionesDiarias'), fuente.indexOf('export const pruebaAvisoArea'));
    const paso8 = corridaDe8.indexOf('await correoDelDatoQuincenaAislado(calendario)');
    assert.ok(paso8 > -1);
    assert.ok(paso8 > corridaDe8.indexOf('await enviarAvisosDeVencimiento('));
    assert.ok(paso8 < corridaDe8.indexOf('resultados.diario = await diario'));
    const corridaDe14 = fuente.slice(fuente.indexOf('export const ejecutarNotificacionCambiosPendientes'),
      fuente.indexOf('export const ejecutarRecordatoriosDeEventos'));
    const paso14 = corridaDe14.indexOf('await correoDelDatoQuincenaAislado(calendario)');
    assert.ok(paso14 > corridaDe14.indexOf("await avisoDiarioAislado('tarde', calendario)"));
    assert.ok(paso14 < corridaDe14.indexOf('if (fallaDeLosRecordatorios) throw'), 'corre aunque los recordatorios tiren');
  });
});
