// El POST del dato de la quincena (spec 2026-11-07-dato-quincena, 4, 6, 7, 8, 12 y 15): Grok Bot manda cada edición como un
// multipart con su token y el RPAD la guarda inmutable en tres tablas. Contra una base de prueba propia, con un área y dos
// datasets inventados (el 2, dado de baja), y la app real: un servidor con la huella de un token generado acá y dos aparte para
// el 503 (sin la huella, '' explícito para no heredar un .env local, y con una mal formada). Cada caso manda su propio
// X-Forwarded-For (203.0.113.<n>): con trust proxy 1, el límite de 20 pedidos por hora cuenta esa IP y no cruza casos.
// El token nunca va a un mensaje de error ni a la consola.
// Las lecturas (spec 9), con una sesión de cualquier rol: la lista vacía antes del primer POST y, después, la lista, el detalle y
// las descargas de lo guardado, con la forma de tests/fixtures/dato-quincena-respuestas.json (las respuestas que lee la página).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, cerrarDb, query, mailpit } from './helpers.js';
import { FECHA_DE_PRUEBA, edicionDePrueba, pilotoDePrueba, partesDePrueba } from './dato-quincena-fixtures.js';
import { MENSAJES_VALIDACION, TOPE_DEL_PEDIDO } from '../services/datoQuincenaReglas.js';
import { hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';

const sha256 = (datos) => crypto.createHash('sha256').update(datos).digest('hex');

const TOKEN = crypto.randomBytes(32).toString('hex');
const RUTA = '/api/dato-quincena/ediciones';
const KB = 1024;
const MB = 1024 * 1024;

const ERROR_401 = { success: false, error: 'Falta el token del dato de la quincena o no es válido.' };
const ERROR_503 = { success: false, error: 'La recepción del dato de la quincena no está habilitada.' };
const ERROR_429 = { success: false, error: 'Demasiados pedidos. Probá de nuevo más tarde.' };
const ERROR_DEL_CUERPO = { success: false, error: 'Los datos enviados no tienen un formato válido.' };
const noSePudoLeer = (motivo) => ({ success: false, error: `No se pudo leer la edición: ${motivo}.` });
const supera = (parte, tope) => ({ success: false, error: `La parte ${parte} supera el tamaño permitido (${tope}).` });

// Las lecturas (spec 9)
const NO_EXISTE = { success: false, error: 'No existe esa edición.' };
const SIN_ARCHIVO = { success: false, error: 'El archivo no existe.' };
const ANIO_INVALIDO = { success: false, error: 'El año no es válido.' };
const RESPUESTAS = JSON.parse(fs.readFileSync(new URL('./fixtures/dato-quincena-respuestas.json', import.meta.url), 'utf8'));

// Las tablas que el POST no toca (spec 3 y 15): la misma cuenta antes y después
const OTRAS_TABLAS = ['datasets', 'cambios_pendientes', 'historial_actualizaciones', 'notificaciones_log', 'proyecto_hitos',
  'hito_archivos'];
const TABLAS_DEL_DATO = ['dato_quincena_ediciones', 'dato_quincena_propuestas', 'dato_quincena_adjuntos'];

let base, servidor, apagado, malFormada, api, usuarios, dbReal, cuentasAntes;

const cuenta = async (tabla) => Number((await query(`SELECT COUNT(*) AS n FROM \`${tabla}\``))[0].n);
const cuentas = async (tablas) => Object.fromEntries(await Promise.all(tablas.map(async (t) => [t, await cuenta(t)])));

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_dato_quincena_api');
  process.env.DB_NAME = base.nombre;
  const env = { DB_NAME: base.nombre };
  [servidor, apagado, malFormada] = await Promise.all([
    iniciarServidor({ env: { ...env, DATO_QUINCENA_TOKEN_SHA256: sha256(TOKEN) } }),
    iniciarServidor({ env: { ...env, DATO_QUINCENA_TOKEN_SHA256: '' } }),
    iniciarServidor({ env: { ...env, DATO_QUINCENA_TOKEN_SHA256: sha256(TOKEN).slice(1) } })
  ]);
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, { admin: 'admin', lector: 'lector', colaborador: 'colaborador' });
  await query("INSERT INTO areas (id, nombre) VALUES (1, '[TEST] Área del dato de la quincena')");
  await query(
    `INSERT INTO datasets (id, titulo, area_id, frecuencia_id, tema_principal_id, activo)
     VALUES (1, '[TEST] Dataset de prueba A', 1, 1, 1, 1), (2, '[TEST] Dataset de prueba B', 1, 1, 1, 0)`
  );
  await mailpit.vaciar();
  cuentasAntes = await cuentas(OTRAS_TABLAS);
});

after(async () => {
  await cerrarDb();
  await Promise.all([servidor?.detener(), apagado?.detener(), malFormada?.detener()]);
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

/**
 * Manda las partes como un multipart armado por fetch (con Content-Length): cada una como Blob con nombre de archivo, en el
 * orden de `orden` (un nombre repetido va dos veces), con el MIME de `tipos` o application/octet-stream. `token` null: sin
 * Authorization. `url`: el servidor (por defecto, el que tiene la huella).
 */
const enviar = async (partes, { token = TOKEN, ip, orden = Object.keys(partes), tipos = {}, url = servidor.url } = {}) => {
  const formulario = new FormData();
  for (const nombre of orden) {
    formulario.append(nombre, new Blob([partes[nombre]], { type: tipos[nombre] ?? 'application/octet-stream' }), `${nombre}.bin`);
  }
  const res = await fetch(`${url}${RUTA}`, {
    method: 'POST',
    headers: { ...(token === null ? {} : { Authorization: `Bearer ${token}` }), 'X-Forwarded-For': `203.0.113.${ip}` },
    body: formulario,
    signal: AbortSignal.timeout(30000)
  });
  return { status: res.status, headers: res.headers, body: await res.json() };
};

// Un multipart armado a mano: cada parte { nombre, contenido, archivo } (archivo false: un campo de texto, sin filename; nombre
// null: sin name, y el archivo de una parte sin nombre o con el nombre vacío se llama parte.bin)
const LIMITE = '----limite-dato-quincena-prueba';
const multipartCrudo = (partes) => Buffer.concat([
  ...partes.flatMap(({ nombre, contenido, archivo = true }) => [
    Buffer.from(`--${LIMITE}\r\nContent-Disposition: form-data${nombre === null ? '' : `; name="${nombre}"`}`
      + `${archivo ? `; filename="${nombre || 'parte'}.bin"\r\nContent-Type: application/octet-stream` : ''}\r\n\r\n`),
    contenido,
    Buffer.from('\r\n')
  ]),
  Buffer.from(`--${LIMITE}--\r\n`)
]);

/**
 * Un pedido con http.request, para lo que fetch no permite: manda los `trozos` y, con `terminar` false, deja el pedido
 * abierto (así, si llega la respuesta, el servidor no esperó a leerlo entero). Sin Content-Length en `headers`, va chunked.
 * Resuelve con la respuesta; un ECONNRESET o un EPIPE al escribir (el servidor cortó después de responder) no cuentan.
 * Sin respuesta en 20 s, rechaza: un reloj aparte y no el del socket, que se apaga con él (un servidor que se cae corta el
 * socket con un ECONNRESET, que acá no cuenta, y el pedido quedaba esperando para siempre).
 */
const pedirCrudo = ({ ip, token = TOKEN, headers = {}, trozos = [], terminar = true }) => new Promise((resolver, rechazar) => {
  const pedido = http.request(new URL(RUTA, servidor.url), {
    method: 'POST',
    headers: { 'X-Forwarded-For': `203.0.113.${ip}`, ...(token === null ? {} : { Authorization: `Bearer ${token}` }), ...headers }
  });
  const reloj = setTimeout(() => {
    rechazar(new Error('El servidor no respondió en 20 s'));
    pedido.destroy();
  }, 20000);
  pedido.on('error', (error) => {
    if (['ECONNRESET', 'EPIPE'].includes(error.code)) return;
    clearTimeout(reloj);
    rechazar(error);
  });
  pedido.on('response', (res) => {
    const recibido = [];
    res.on('data', (trozo) => recibido.push(trozo));
    res.on('error', (error) => {
      clearTimeout(reloj);
      rechazar(error);
    });
    res.on('end', () => {
      clearTimeout(reloj);
      resolver({ status: res.statusCode, headers: res.headers, body: JSON.parse(Buffer.concat(recibido).toString('utf8')) });
      if (!terminar) pedido.destroy();
    });
  });
  for (const trozo of trozos) pedido.write(trozo);
  if (terminar) pedido.end();
});

const enviarCrudo = (partes, { ip, token }) => {
  const cuerpo = multipartCrudo(partes);
  return pedirCrudo({
    ip,
    token,
    headers: { 'Content-Type': `multipart/form-data; boundary=${LIMITE}`, 'Content-Length': String(cuerpo.length) },
    trozos: [cuerpo]
  });
};

// La huella del paquete calculada acá, sin la regla del servidor (spec 6)
const huellaDe = (partes) => sha256(['metadata', 'infografia_png', 'correo_texto', 'calculos']
  .map((parte) => `${parte}:${partes[parte] ? sha256(partes[parte]) : '-'}\n`)
  .join(''));

// recibida_at desde los segundos UNIX de la base: la hora argentina (UTC-3, sin cambio de hora) con su zona
const isoArgentino = (segundos) => `${new Date((Number(segundos) - 3 * 3600) * 1000).toISOString().slice(0, 19)}-03:00`;

const edicionGuardada = async (clave) => (await query(
  `SELECT id, clave, tipo, DATE_FORMAT(fecha_edicion, '%Y-%m-%d') AS fecha_edicion, referencia_piloto, titulo,
          CAST(metadata AS BINARY) AS metadata, huella, UNIX_TIMESTAMP(recibida_at) AS recibida_ts
   FROM dato_quincena_ediciones WHERE clave = ?`,
  [clave]
))[0];
const propuestasGuardadas = (edicionId) => query(
  `SELECT orden, titulo, cifra_clave, principal, dataset_id, dataset_nombre
   FROM dato_quincena_propuestas WHERE edicion_id = ? ORDER BY orden`,
  [edicionId]
);
const adjuntosGuardados = (edicionId) => query(
  'SELECT campo, nombre, mime, bytes, sha256, contenido FROM dato_quincena_adjuntos WHERE edicion_id = ? ORDER BY id',
  [edicionId]
);

// Todo lo guardado del dato de la quincena, para comparar antes y después de un pedido que no guarda nada
const todoLoGuardado = async () => ({
  ediciones: await query('SELECT id, clave, huella, UNIX_TIMESTAMP(recibida_at) AS recibida_ts FROM dato_quincena_ediciones ORDER BY id'),
  propuestas: await query('SELECT id, edicion_id, orden, dataset_id FROM dato_quincena_propuestas ORDER BY id'),
  adjuntos: await query('SELECT id, edicion_id, campo, sha256 FROM dato_quincena_adjuntos ORDER BY id')
});

const CLAVES_DEL_RECIBO = ['id', 'clave', 'tipo', 'fecha_edicion', 'huella', 'recibida_at', 'repetida', 'adjuntos', 'url', 'avisos'];
const RECIBIDA_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/;

// Las partes de prueba con un byte distinto en el texto del correo (el último salto de línea pasa a ser un signo)
const correoConOtroByte = () => {
  const correo = Buffer.from(partesDePrueba(edicionDePrueba()).correo_texto);
  correo[correo.length - 1] = 0x21;
  return correo;
};

// Una lectura con la sesión de `clave` (el admin, si no se dice)
const leer = (ruta, clave = 'admin') => api.get(ruta, { token: usuarios[clave].token });

// Una descarga con fetch: los bytes tal como llegaron (crearCliente pasa un text/* a texto) y, en un error, su JSON
const bajar = async (id, campo, { token = usuarios.admin.token } = {}) => {
  const res = await fetch(`${servidor.url}${RUTA}/${id}/archivos/${campo}`, {
    headers: token === null ? {} : { Authorization: `Bearer ${token}` }
  });
  const bytes = Buffer.from(await res.arrayBuffer());
  return { status: res.status, headers: res.headers, bytes, body: res.status === 200 ? null : JSON.parse(bytes.toString('utf8')) };
};

describe('las lecturas con el archivo vacío', () => {
  it('la lista: sin años, sin año y sin ediciones, como la respuesta vacía de la página', async () => {
    const res = await leer('/dato-quincena/ediciones');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, RESPUESTAS.lista_vacia);
  });

  it('un año pedido (2025), 200 con la lista vacía', async () => {
    const res = await leer('/dato-quincena/ediciones?anio=2025');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, data: { anios: [], anio: 2025, ediciones: [] } });
  });

  it('el detalle y la descarga de un id que no existe, 404', async () => {
    assert.deepEqual((await leer('/dato-quincena/ediciones/1')).body, NO_EXISTE);
    assert.deepEqual((await bajar(1, 'infografia_png')).body, NO_EXISTE);
  });
});

describe('el interruptor y el token', () => {
  it('sin la huella configurada (vacía), 503 aunque el token sea el de la prueba', async () => {
    const res = await enviar(partesDePrueba(edicionDePrueba()), { ip: 1, url: apagado.url });
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, ERROR_503);
  });

  it('con una huella mal formada (63 caracteres), 503', async () => {
    const res = await enviar(partesDePrueba(edicionDePrueba()), { ip: 2, url: malFormada.url });
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, ERROR_503);
  });

  it('sin token, con otro token y con el JWT de un admin: 401, y nada guardado', async () => {
    const partes = partesDePrueba(edicionDePrueba());
    for (const token of [null, crypto.randomBytes(32).toString('hex'), usuarios.admin.token]) {
      const res = await enviar(partes, { ip: 3, token });
      assert.equal(res.status, 401);
      assert.deepEqual(res.body, ERROR_401);
    }
    assert.deepEqual(await cuentas(TABLAS_DEL_DATO), { dato_quincena_ediciones: 0, dato_quincena_propuestas: 0, dato_quincena_adjuntos: 0 });
  });

  it('un desconocido sin Content-Length (chunked) recibe el 401 enseguida, con Connection: close, sin que el servidor lea todo', async () => {
    // El pedido nunca termina: si el servidor esperara a leerlo entero, no respondería
    const res = await pedirCrudo({
      ip: 4,
      token: null,
      headers: { 'Content-Type': `multipart/form-data; boundary=${LIMITE}` },
      trozos: [Buffer.alloc(64 * KB, 0x61)],
      terminar: false
    });
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, ERROR_401);
    assert.equal(res.headers.connection, 'close');
  });

  it('un desconocido que declara más de 6 MB recibe el 401 enseguida, con Connection: close', async () => {
    const res = await pedirCrudo({
      ip: 5,
      token: null,
      headers: { 'Content-Type': `multipart/form-data; boundary=${LIMITE}`, 'Content-Length': String(TOPE_DEL_PEDIDO + 1) },
      trozos: [Buffer.alloc(64 * KB, 0x61)],
      terminar: false
    });
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, ERROR_401);
    assert.equal(res.headers.connection, 'close');
  });

  it('un 401 con Content-Length de hasta 6 MB se responde después de leer el pedido, sin cortar la conexión', async () => {
    const res = await enviar(partesDePrueba(edicionDePrueba()), { ip: 6, token: null });
    assert.equal(res.status, 401);
    assert.notEqual(res.headers.get('connection'), 'close');
  });
});

describe('guardar una edición', () => {
  const partes = partesDePrueba(edicionDePrueba());
  const clave = `dq:regular:${FECHA_DE_PRUEBA}`;
  let primero;

  it('201: el recibo completo, con la hora de llegada de la base, los adjuntos y la dirección', async () => {
    const res = await enviar(partes, { ip: 10 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(Object.keys(res.body), ['success', 'data']);
    assert.equal(res.body.success, true);
    primero = res.body.data;
    assert.deepEqual(Object.keys(primero), CLAVES_DEL_RECIBO);
    assert.equal(typeof primero.id, 'number');
    assert.equal(primero.clave, clave);
    assert.equal(primero.tipo, 'regular');
    assert.equal(primero.fecha_edicion, FECHA_DE_PRUEBA);
    assert.equal(primero.huella, huellaDe(partes));
    assert.match(primero.recibida_at, RECIBIDA_AT);
    assert.ok(Math.abs(Date.parse(primero.recibida_at) - Date.now()) < 60 * 1000, 'recibida_at está a menos de un minuto de ahora');
    assert.equal(primero.repetida, false);
    assert.deepEqual(primero.adjuntos, [
      { campo: 'infografia_png', bytes: partes.infografia_png.length, sha256: sha256(partes.infografia_png) },
      { campo: 'correo_texto', bytes: partes.correo_texto.length, sha256: sha256(partes.correo_texto) },
      { campo: 'calculos', bytes: partes.calculos.length, sha256: sha256(partes.calculos) }
    ]);
    assert.ok(primero.url.endsWith(`/dato-quincena.html?id=${primero.id}`), primero.url);
    assert.deepEqual(primero.avisos, []);
  });

  it('las filas de las tres tablas, con metadata y los archivos iguales byte a byte a lo enviado', async () => {
    const edicion = await edicionGuardada(clave);
    assert.equal(edicion.id, primero.id);
    assert.equal(edicion.tipo, 'regular');
    assert.equal(edicion.fecha_edicion, FECHA_DE_PRUEBA);
    assert.equal(edicion.referencia_piloto, null);
    assert.equal(edicion.titulo, 'El dato de la quincena: edición de prueba');
    assert.equal(edicion.huella, primero.huella);
    assert.ok(Buffer.isBuffer(edicion.metadata));
    assert.ok(edicion.metadata.equals(partes.metadata), 'metadata guardada igual byte a byte');
    assert.equal(isoArgentino(edicion.recibida_ts), primero.recibida_at);

    // El dataset 2 está dado de baja: sigue enlazado (spec 5)
    assert.deepEqual(await propuestasGuardadas(edicion.id), [
      { orden: 1, titulo: 'Un título inventado', cifra_clave: '1.234 casos · septiembre de 2026', principal: 1, dataset_id: 1,
        dataset_nombre: 'Dataset de prueba A' },
      { orden: 2, titulo: 'Otro título inventado', cifra_clave: '56 casos · septiembre de 2026', principal: 0, dataset_id: 2,
        dataset_nombre: 'Dataset de prueba B' }
    ]);

    const adjuntos = await adjuntosGuardados(edicion.id);
    assert.deepEqual(adjuntos.map(({ contenido, ...resto }) => resto), [
      { campo: 'infografia_png', nombre: 'infografia-prueba.png', mime: 'image/png', bytes: partes.infografia_png.length,
        sha256: sha256(partes.infografia_png) },
      { campo: 'correo_texto', nombre: 'correo-prueba.txt', mime: 'text/plain', bytes: partes.correo_texto.length,
        sha256: sha256(partes.correo_texto) },
      { campo: 'calculos', nombre: 'calculos-prueba.md', mime: 'text/markdown', bytes: partes.calculos.length,
        sha256: sha256(partes.calculos) }
    ]);
    for (const { campo, contenido } of adjuntos) assert.ok(contenido.equals(partes[campo]), `${campo} guardado igual byte a byte`);
  });

  it('200 al repetirla: el mismo recibo (id, huella, recibida_at), con repetida, y ninguna fila nueva', async () => {
    const antes = await todoLoGuardado();
    const res = await enviar(partes, { ip: 11 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, data: { ...primero, repetida: true } });
    assert.deepEqual(await todoLoGuardado(), antes);
  });

  it('200 también con las partes en otro orden', async () => {
    const antes = await todoLoGuardado();
    const res = await enviar(partes, { ip: 12, orden: ['calculos', 'correo_texto', 'infografia_png', 'metadata'] });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, data: { ...primero, repetida: true } });
    assert.deepEqual(await todoLoGuardado(), antes);
  });

  it('409 con un byte distinto en el texto del correo: la misma clave con otro contenido, sin cambios', async () => {
    const antes = await todoLoGuardado();
    const res = await enviar(partesDePrueba(edicionDePrueba(), { correo_texto: correoConOtroByte() }), { ip: 13 });
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.deepEqual(res.body, {
      success: false, error: `Ya hay una edición con la clave ${clave} y otro contenido. No se cambió nada.`
    });
    assert.deepEqual(await todoLoGuardado(), antes);
  });

  it('dos iguales a la vez: 201 y 200, con el mismo id y una sola edición guardada', async () => {
    const otras = partesDePrueba(edicionDePrueba({ fecha_edicion: '2026-11-03' }));
    const respuestas = await Promise.all([enviar(otras, { ip: 14 }), enviar(otras, { ip: 14 })]);
    assert.deepEqual(respuestas.map((r) => r.status).sort(), [200, 201], JSON.stringify(respuestas.map((r) => r.body)));
    const [creada, repetida] = respuestas[0].status === 201 ? respuestas : [respuestas[1], respuestas[0]];
    assert.deepEqual(repetida.body.data, { ...creada.body.data, repetida: true });
    const ediciones = await query("SELECT id FROM dato_quincena_ediciones WHERE clave = 'dq:regular:2026-11-03'");
    assert.deepEqual(ediciones.map((e) => e.id), [creada.body.data.id]);
    assert.equal((await propuestasGuardadas(creada.body.data.id)).length, 2);
    assert.equal((await adjuntosGuardados(creada.body.data.id)).length, 3);
  });

  it('un piloto y una regular del mismo día, y dos pilotos del mismo día con otra referencia: tres 201', async () => {
    const dia = '2026-11-04';
    const casos = [
      [edicionDePrueba({ fecha_edicion: dia }), `dq:regular:${dia}`, null],
      [pilotoDePrueba({ fecha_edicion: dia }), `dq:piloto:${dia}:piloto-4`, 'piloto-4'],
      [pilotoDePrueba({ fecha_edicion: dia, referencia_piloto: 'piloto-5' }), `dq:piloto:${dia}:piloto-5`, 'piloto-5']
    ];
    const ids = [];
    for (const [edicion, claveEsperada, referencia] of casos) {
      const res = await enviar(partesDePrueba(edicion), { ip: 15 });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(res.body.data.clave, claveEsperada);
      assert.equal(res.body.data.tipo, edicion.tipo);
      assert.equal(res.body.data.fecha_edicion, dia);
      const guardada = await edicionGuardada(claveEsperada);
      assert.equal(guardada.id, res.body.data.id);
      assert.equal(guardada.referencia_piloto, referencia);
      ids.push(res.body.data.id);
    }
    assert.equal(new Set(ids).size, 3);
  });

  it('una edición sin cálculos: 201 con dos adjuntos', async () => {
    const edicion = edicionDePrueba({ fecha_edicion: '2026-11-07' });
    const sinCalculos = partesDePrueba(edicion, { calculos: null });
    const res = await enviar(sinCalculos, { ip: 16 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.adjuntos.map((a) => a.campo), ['infografia_png', 'correo_texto']);
    assert.equal(res.body.data.huella, huellaDe(sinCalculos));
    assert.deepEqual((await adjuntosGuardados(res.body.data.id)).map((a) => a.campo), ['infografia_png', 'correo_texto']);
  });

  it('todos los rpad_id en null: 201 sin avisos y las propuestas sin enlace', async () => {
    const edicion = edicionDePrueba({ fecha_edicion: '2026-11-05' });
    for (const propuesta of edicion.propuestas) propuesta.dataset.rpad_id = null;
    const res = await enviar(partesDePrueba(edicion), { ip: 17 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.avisos, []);
    assert.deepEqual((await propuestasGuardadas(res.body.data.id)).map((p) => p.dataset_id), [null, null]);
  });

  it('un rpad_id que no está en el RPAD: 201 con su aviso y dataset_id null; al repetirla, el 200 arma el mismo aviso', async () => {
    const edicion = edicionDePrueba({ fecha_edicion: '2026-11-06' });
    edicion.propuestas[1].dataset.rpad_id = 999;
    const otras = partesDePrueba(edicion);
    const aviso = 'La propuesta 2 cita el dataset 999, que no está en el RPAD: se guardó sin enlace.';
    const res = await enviar(otras, { ip: 18 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.avisos, [aviso]);
    assert.deepEqual((await propuestasGuardadas(res.body.data.id)).map((p) => p.dataset_id), [1, null]);
    const repetida = await enviar(otras, { ip: 18 });
    assert.equal(repetida.status, 200, JSON.stringify(repetida.body));
    assert.deepEqual(repetida.body.data, { ...res.body.data, repetida: true });
  });

  it('una edición de mañana en Argentina pasa (201); una de pasado mañana, 422', async () => {
    const hoy = hoyArgentina();
    const manana = pilotoDePrueba({ fecha_edicion: sumarDias(hoy, 1), referencia_piloto: 'piloto-900' });
    const res = await enviar(partesDePrueba(manana), { ip: 19 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.fecha_edicion, sumarDias(hoy, 1));
    const pasado = pilotoDePrueba({ fecha_edicion: sumarDias(hoy, 2), referencia_piloto: 'piloto-901' });
    const otro = await enviar(partesDePrueba(pasado), { ip: 19 });
    assert.equal(otro.status, 422, JSON.stringify(otro.body));
    assert.deepEqual(otro.body.errores, [{ campo: 'fecha_edicion', mensaje: MENSAJES_VALIDACION.fechaEdicion }]);
  });
});

describe('un pedido que no se puede leer: 400 y nada guardado', () => {
  let antes;
  const partes = () => partesDePrueba(edicionDePrueba({ fecha_edicion: '2026-11-01' }));

  before(async () => {
    antes = await todoLoGuardado();
  });

  it('un cuerpo JSON', async () => {
    const res = await api.post('/dato-quincena/ediciones', { metadata: '{}' }, {
      token: TOKEN, headers: { 'X-Forwarded-For': '203.0.113.20' }
    });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, noSePudoLeer('el pedido no es multipart/form-data'));
  });

  it('sin metadata', async () => {
    const res = await enviar(partes(), { ip: 21, orden: ['infografia_png', 'correo_texto', 'calculos'] });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, noSePudoLeer('falta la parte metadata'));
  });

  it('sin infografia_png', async () => {
    const res = await enviar(partes(), { ip: 22, orden: ['metadata', 'correo_texto', 'calculos'] });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, noSePudoLeer('falta la parte infografia_png'));
  });

  it('sin correo_texto', async () => {
    const res = await enviar(partes(), { ip: 22, orden: ['metadata', 'infografia_png', 'calculos'] });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, noSePudoLeer('falta la parte correo_texto'));
  });

  it('metadata como campo de texto', async () => {
    const { metadata, infografia_png, correo_texto } = partes();
    const res = await enviarCrudo([
      { nombre: 'metadata', contenido: metadata, archivo: false },
      { nombre: 'infografia_png', contenido: infografia_png },
      { nombre: 'correo_texto', contenido: correo_texto }
    ], { ip: 23 });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, noSePudoLeer('todas las partes van como archivo'));
  });

  it('una parte correo_html (con otro nombre)', async () => {
    const res = await enviar({ ...partes(), correo_html: Buffer.from('<p>inventado</p>') }, {
      ip: 24, orden: ['metadata', 'infografia_png', 'correo_texto', 'correo_html']
    });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, noSePudoLeer('una parte no corresponde'));
  });

  // Una parte sin name (o con name="") llega a multer sin nombre: con fieldNameSize, multer 1.4.5 lo medía dentro de busboy y el
  // TypeError tiraba el proceso entero
  it('una parte sin nombre o con el nombre vacío, y el servidor sigue contestando', async () => {
    const { metadata, infografia_png, correo_texto } = partes();
    for (const [nombre, ip] of [[null, 33], ['', 34]]) {
      const res = await enviarCrudo([
        { nombre, contenido: Buffer.from('inventado') },
        { nombre: 'metadata', contenido: metadata },
        { nombre: 'infografia_png', contenido: infografia_png },
        { nombre: 'correo_texto', contenido: correo_texto }
      ], { ip });
      assert.equal(res.status, 400, JSON.stringify(nombre));
      assert.deepEqual(res.body, noSePudoLeer('una parte no corresponde'), JSON.stringify(nombre));
      assert.equal((await leer('/dato-quincena/ediciones')).status, 200, JSON.stringify(nombre));
    }
  });

  it('una parte con un nombre de 101 caracteres', async () => {
    const { metadata, infografia_png, correo_texto } = partes();
    const res = await enviarCrudo([
      { nombre: 'metadata', contenido: metadata },
      { nombre: 'infografia_png', contenido: infografia_png },
      { nombre: 'correo_texto', contenido: correo_texto },
      { nombre: `calculos${'x'.repeat(93)}`, contenido: Buffer.from('inventado') }
    ], { ip: 35 });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, noSePudoLeer('una parte no corresponde'));
  });

  it('dos infografia_png', async () => {
    const res = await enviar(partes(), { ip: 25, orden: ['metadata', 'infografia_png', 'infografia_png', 'correo_texto'] });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, noSePudoLeer('la parte infografia_png llegó dos veces'));
  });

  it('cinco partes', async () => {
    const res = await enviar({ ...partes(), correo_html: Buffer.from('<p>inventado</p>') }, {
      ip: 26, orden: ['metadata', 'infografia_png', 'correo_texto', 'calculos', 'correo_html']
    });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, noSePudoLeer('sobran partes'));
  });

  it('un multipart cortado', async () => {
    const cuerpo = Buffer.from(`--${LIMITE}\r\nContent-Disposition: form-data; name="metadata"; filename="m.json"\r\n\r\n{"a":`);
    const res = await pedirCrudo({
      ip: 27,
      headers: { 'Content-Type': `multipart/form-data; boundary=${LIMITE}`, 'Content-Length': String(cuerpo.length) },
      trozos: [cuerpo]
    });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, noSePudoLeer('el pedido está mal armado'));
  });

  it('metadata con un JSON roto', async () => {
    const res = await enviar({ ...partes(), metadata: Buffer.from('{"schema_version": ') }, { ip: 28 });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, noSePudoLeer('metadata no es un JSON válido'));
  });

  it('metadata con un BOM al principio', async () => {
    const conBom = partes();
    conBom.metadata = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), conBom.metadata]);
    const res = await enviar(conBom, { ip: 29 });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, noSePudoLeer('metadata no es un JSON válido'));
  });

  it('metadata que no es UTF-8', async () => {
    const res = await enviar({ ...partes(), metadata: Buffer.from([0x7b, 0xff, 0x7d]) }, { ip: 30 });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, noSePudoLeer('metadata no es un JSON válido'));
  });

  it('__proto__ como clave de metadata', async () => {
    const sinProto = partes();
    const texto = sinProto.metadata.toString('utf8');
    const res = await enviar({ ...sinProto, metadata: Buffer.from(`{"__proto__":{},${texto.slice(1)}`) }, { ip: 31 });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, ERROR_DEL_CUERPO);
  });

  it('metadata con 40 niveles (antes de la validación de la edición)', async () => {
    let profundo = 'x';
    for (let i = 0; i < 40; i++) profundo = [profundo];
    const edicion = { ...edicionDePrueba({ fecha_edicion: '2026-11-01' }), profundo };
    const res = await enviar(partesDePrueba(edicion), { ip: 32 });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, ERROR_DEL_CUERPO);
  });

  it('nada quedó guardado', async () => {
    assert.deepEqual(await todoLoGuardado(), antes);
  });
});

describe('una parte que pasa su tope: 413', () => {
  let antes;
  const partes = (cambios) => partesDePrueba(edicionDePrueba({ fecha_edicion: '2026-11-01' }), cambios);

  before(async () => {
    antes = await todoLoGuardado();
  });

  it('un PNG de 5 MB + 1', async () => {
    const res = await enviar(partes({ infografia_png: Buffer.alloc(5 * MB + 1) }), { ip: 40 });
    assert.equal(res.status, 413);
    assert.deepEqual(res.body, supera('infografia_png', '5 MB'));
  });

  it('un texto del correo de 256 KB + 1', async () => {
    const res = await enviar(partes({ correo_texto: Buffer.alloc(256 * KB + 1, 0x61) }), { ip: 41 });
    assert.equal(res.status, 413);
    assert.deepEqual(res.body, supera('correo_texto', '256 KB'));
  });

  it('unos cálculos de 256 KB + 1', async () => {
    const res = await enviar(partes({ calculos: Buffer.alloc(256 * KB + 1, 0x61) }), { ip: 42 });
    assert.equal(res.status, 413);
    assert.deepEqual(res.body, supera('calculos', '256 KB'));
  });

  it('metadata de 256 KB + 1, y de más de 5 MB (la corta multer): el tope de metadata', async () => {
    const grande = partes();
    const relleno = (largo) => Buffer.concat([grande.metadata.subarray(0, -1), Buffer.from(`,"x":"${'a'.repeat(largo)}"}`)]);
    for (const [metadata, ip] of [[relleno(256 * KB), 43], [relleno(5 * MB), 44]]) {
      const res = await enviar({ ...grande, metadata }, { ip });
      assert.equal(res.status, 413);
      assert.deepEqual(res.body, supera('metadata', '256 KB'));
    }
  });

  it('nada quedó guardado', async () => {
    assert.deepEqual(await todoLoGuardado(), antes);
  });
});

describe('una edición con errores: 422', () => {
  it('dos Principal y un manifiesto que no coincide con el texto del correo: los errores, y nada guardado', async () => {
    const antes = await todoLoGuardado();
    const edicion = edicionDePrueba({ fecha_edicion: '2026-11-01' });
    edicion.propuestas[1].etiquetas = ['Principal'];
    const partes = partesDePrueba(edicion);
    partes.correo_texto = Buffer.from('Otro correo inventado.\n');
    const res = await enviar(partes, { ip: 50 });
    assert.equal(res.status, 422, JSON.stringify(res.body));
    assert.deepEqual(res.body, {
      success: false,
      error: 'La edición tiene errores.',
      errores: [
        { campo: 'propuestas', mensaje: MENSAJES_VALIDACION.principal },
        { campo: 'adjuntos[1].bytes', mensaje: MENSAJES_VALIDACION.bytesDistintos },
        { campo: 'adjuntos[1].sha256', mensaje: MENSAJES_VALIDACION.sha256Distinto }
      ]
    });
    assert.deepEqual(await todoLoGuardado(), antes);
  });
});

describe('el límite de pedidos', () => {
  it('el pedido 21 de una misma IP es 429 con Retry-After, aunque traiga el token y una edición válida', async () => {
    const antes = await todoLoGuardado();
    const partes = partesDePrueba(edicionDePrueba({ fecha_edicion: '2026-11-01' }));
    for (let i = 1; i <= 20; i++) {
      const res = await enviar(partes, { ip: 60, token: null });
      assert.equal(res.status, 401, `pedido ${i}`);
    }
    const res = await enviar(partes, { ip: 60 });
    assert.equal(res.status, 429);
    assert.deepEqual(res.body, ERROR_429);
    const espera = res.headers.get('retry-after');
    assert.match(espera ?? '', /^\d+$/);
    assert.ok(Number(espera) > 0 && Number(espera) <= 3600, `Retry-After de ${espera} segundos`);
    assert.deepEqual(await todoLoGuardado(), antes);
    // Otra IP sigue pudiendo
    const otra = await enviar(partes, { ip: 61, token: null });
    assert.equal(otra.status, 401);
  });
});

// La forma de una respuesta, para compararla con la de la página: de cada objeto, sus claves en orden con la forma de cada valor;
// de cada lista, las formas distintas de sus objetos (una sola, si todos tienen las mismas claves); de lo demás, '·'
const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const forma = (valor) => {
  if (Array.isArray(valor)) {
    return [...new Set(valor.filter(esObjeto).map((elemento) => JSON.stringify(forma(elemento))))].map((f) => JSON.parse(f));
  }
  if (esObjeto(valor)) return Object.entries(valor).map(([clave, hijo]) => [clave, forma(hijo)]);
  return '·';
};

describe('las lecturas', () => {
  const partes = partesDePrueba(edicionDePrueba());
  const clave = `dq:regular:${FECHA_DE_PRUEBA}`;
  // Las ediciones que guardaron los grupos de arriba y una de enero de 2027, escrita a mano: el POST no acepta una fecha posterior
  // a mañana
  let prueba, sinCalculos, piloto, sinEnlace, deEnero;

  before(async () => {
    const idDe = async (claveGuardada) => (await edicionGuardada(claveGuardada)).id;
    prueba = await idDe(clave);
    sinCalculos = await idDe('dq:regular:2026-11-07');
    piloto = await idDe('dq:piloto:2026-11-04:piloto-4');
    sinEnlace = await idDe('dq:regular:2026-11-06');
    const enero = edicionDePrueba({ fecha_edicion: '2027-01-11' });
    deEnero = (await query(
      `INSERT INTO dato_quincena_ediciones (clave, tipo, fecha_edicion, referencia_piloto, titulo, metadata, huella)
       VALUES ('dq:regular:2027-01-11', 'regular', '2027-01-11', NULL, ?, ?, ?)`,
      [enero.titulo, JSON.stringify(enero), 'f'.repeat(64)]
    )).insertId;
    await query(
      `INSERT INTO dato_quincena_propuestas (edicion_id, orden, titulo, cifra_clave, principal, dataset_id, dataset_nombre)
       VALUES (?, 1, 'Un título inventado', '1.234 casos · septiembre de 2026', 1, 1, 'Dataset de prueba A'),
              (?, 2, 'Otro título inventado', '56 casos · septiembre de 2026', 0, 2, 'Dataset de prueba B')`,
      [deEnero, deEnero]
    );
  });

  // Los ids guardados de cada año, del año más nuevo al más viejo y, en cada uno, por fecha y por id descendentes (ordenados acá,
  // no en SQL)
  const idsPorAnio = async () => {
    const filas = await query("SELECT id, DATE_FORMAT(fecha_edicion, '%Y-%m-%d') AS fecha FROM dato_quincena_ediciones");
    filas.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
    const porAnio = new Map();
    for (const { id, fecha } of filas) {
      const anio = Number(fecha.slice(0, 4));
      porAnio.set(anio, [...(porAnio.get(anio) ?? []), id]);
    }
    return porAnio;
  };

  it('la lista sin año: la del más reciente, con cada año y su cantidad, del más nuevo al más viejo', async () => {
    const porAnio = await idsPorAnio();
    assert.ok(porAnio.get(2027).includes(deEnero));
    assert.ok(porAnio.get(2026).length >= 8);
    const [masReciente] = porAnio.keys();
    const res = await leer('/dato-quincena/ediciones');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.anios, [...porAnio].map(([anio, ids]) => ({ anio, cantidad: ids.length })));
    assert.equal(res.body.data.anio, masReciente);
    assert.deepEqual(res.body.data.ediciones.map((e) => e.id), porAnio.get(masReciente));
  });

  it('la lista de 2026: por fecha y, en el mismo día, por id descendente, con los textos de cada edición', async () => {
    const porAnio = await idsPorAnio();
    const res = await leer('/dato-quincena/ediciones?anio=2026');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { anio, ediciones } = res.body.data;
    assert.equal(anio, 2026);
    assert.deepEqual(ediciones.map((e) => e.id), porAnio.get(2026));

    // Las tres del 04/11 (una regular y los pilotos 4 y 5, guardados en ese orden), seguidas y la última guardada primero
    const ids = ediciones.map((e) => e.id);
    const delCuatro = ediciones.filter((e) => e.fecha_texto === 'Miércoles 4 de noviembre de 2026');
    assert.deepEqual(delCuatro.map((e) => e.marca), ['Piloto 5', 'Piloto 4', null]);
    const posiciones = delCuatro.map((e) => ids.indexOf(e.id));
    assert.deepEqual(posiciones, [posiciones[0], posiciones[0] + 1, posiciones[0] + 2]);
    assert.ok(delCuatro[0].id > delCuatro[1].id && delCuatro[1].id > delCuatro[2].id);

    // La edición de prueba, con los textos de la respuesta de la página
    assert.deepEqual(ediciones.find((e) => e.id === prueba), { ...RESPUESTAS.lista.data.ediciones[2], id: prueba });
    assert.equal(ediciones.at(-1).id, prueba, 'la del 02/11 es la más vieja');
  });

  it('la forma de la lista, la del detalle y la del 404 son las de las respuestas que lee la página', async () => {
    const lista = await leer('/dato-quincena/ediciones?anio=2026');
    assert.deepEqual(forma(lista.body), forma(RESPUESTAS.lista));
    const deEneroLista = await leer('/dato-quincena/ediciones?anio=2027');
    assert.deepEqual(forma(deEneroLista.body), forma(RESPUESTAS.lista_de_2027));
    // El piloto, sin nota de archivo, y la de los cálculos que no llegaron, con un archivo menos: la misma forma
    for (const id of [prueba, piloto, sinCalculos, sinEnlace]) {
      const detalle = await leer(`/dato-quincena/ediciones/${id}`);
      assert.deepEqual(forma(detalle.body), forma(RESPUESTAS.detalle), `la forma del detalle ${id}`);
    }
    assert.deepEqual((await leer('/dato-quincena/ediciones/999999')).body, RESPUESTAS.no_existe);
  });

  it('un año sin ediciones (2025): 200 con la lista vacía y los años que sí tienen', async () => {
    const porAnio = await idsPorAnio();
    const res = await leer('/dato-quincena/ediciones?anio=2025');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data, {
      anios: [...porAnio].map(([anio, ids]) => ({ anio, cantidad: ids.length })), anio: 2025, ediciones: []
    });
  });

  it('un año que no es un entero de 2000 a 2100: 400', async () => {
    for (const consulta of ['anio=1999', 'anio=abc', 'anio=2101', 'anio=', 'anio=2026.5', 'anio=%202026', 'anio=2026&anio=2027',
      'anio[x]=2026']) {
      const res = await leer(`/dato-quincena/ediciones?${consulta}`);
      assert.equal(res.status, 400, consulta);
      assert.deepEqual(res.body, ANIO_INVALIDO, consulta);
    }
  });

  it('el detalle de la edición de prueba: los textos de la página, con la llegada desde recibida_at y el correo en hora argentina', async () => {
    const res = await leer(`/dato-quincena/ediciones/${prueba}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.id, prueba);
    const iso = isoArgentino((await edicionGuardada(clave)).recibida_ts);
    assert.equal(res.body.data.llegada, `Llegó al RPAD el ${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} a las ${iso.slice(11, 16)}.`);
    // El resto, igual a la respuesta de la página (armada con las mismas funciones sobre la misma edición): el dataset 2, dado de
    // baja, sin enlace; el correo de las 11:12 Z, a las 08:12
    assert.deepEqual(
      { ...res.body, data: { ...res.body.data, id: 12, llegada: RESPUESTAS.detalle.data.llegada } },
      RESPUESTAS.detalle
    );
  });

  it('un piloto (sin la hora del correo ni nota de archivo) y una edición sin cálculos (tres archivos)', async () => {
    const delPiloto = (await leer(`/dato-quincena/ediciones/${piloto}`)).body.data;
    assert.equal(delPiloto.fecha_texto, 'Miércoles 4 de noviembre de 2026');
    assert.equal(delPiloto.marca, 'Piloto 4');
    assert.equal(delPiloto.titulo, 'El dato de la quincena: piloto de prueba');
    assert.equal(delPiloto.correo, 'Correo enviado según Grok Bot, sin la hora.');
    assert.equal(delPiloto.nota_archivo, null);
    assert.equal(delPiloto.archivos.at(-1).nombre, 'dato-quincena-piloto-2026-11-04-piloto-4.json');

    const sin = (await leer(`/dato-quincena/ediciones/${sinCalculos}`)).body.data;
    assert.deepEqual(sin.archivos.map(({ campo, rotulo, se_puede_ver }) => [campo, rotulo, se_puede_ver]), [
      ['infografia_png', 'Infografía', false], ['correo_texto', 'Texto del correo', true], ['metadata', 'La edición completa', false]
    ]);
  });

  it('un dataset citado que no está en el RPAD: sin enlace, con el nombre y la dirección como llegaron', async () => {
    const { propuestas } = (await leer(`/dato-quincena/ediciones/${sinEnlace}`)).body.data;
    assert.deepEqual(propuestas.map((p) => p.dataset), [
      { nombre: 'Dataset de prueba A', id_enlace: 1, url: 'https://datos.ejemplo.gob.ar/dataset/prueba-a' },
      { nombre: 'Dataset de prueba B', id_enlace: null, url: 'https://datos.ejemplo.gob.ar/dataset/prueba-b' }
    ]);
  });

  it('cada descarga: los bytes enviados, su Content-Type y un Content-Disposition de adjunto con su nombre', async () => {
    const casos = [
      ['infografia_png', 'image/png', 'infografia-prueba.png', partes.infografia_png],
      ['correo_texto', 'text/plain; charset=utf-8', 'correo-prueba.txt', partes.correo_texto],
      ['calculos', 'text/plain; charset=utf-8', 'calculos-prueba.md', partes.calculos],
      ['metadata', 'application/json; charset=utf-8', `dato-quincena-regular-${FECHA_DE_PRUEBA}.json`, partes.metadata]
    ];
    const { archivos } = (await leer(`/dato-quincena/ediciones/${prueba}`)).body.data;
    for (const [campo, tipo, nombre, enviado] of casos) {
      const res = await bajar(prueba, campo);
      assert.equal(res.status, 200, `${campo}: ${JSON.stringify(res.body)}`);
      assert.ok(res.bytes.equals(enviado), `${campo}: los mismos bytes que se enviaron`);
      assert.equal(res.headers.get('content-type'), tipo, campo);
      assert.equal(res.headers.get('content-disposition'), `attachment; filename="${nombre}"; filename*=UTF-8''${nombre}`, campo);
      assert.match(res.headers.get('cache-control') ?? '', /no-store/, campo);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff', campo);
      // El detalle nombra el archivo como la descarga: la página guarda con ese nombre
      assert.equal(archivos.find((a) => a.campo === campo).nombre, nombre, campo);
    }
  });

  it('404 «No existe esa edición.» con un id que no es un entero positivo o que no existe, en el detalle y en la descarga', async () => {
    for (const id of ['0', 'abc', '-1', '1.5', '01', '999999', '9999999999', '99999999999']) {
      const detalle = await leer(`/dato-quincena/ediciones/${id}`);
      assert.equal(detalle.status, 404, id);
      assert.deepEqual(detalle.body, NO_EXISTE, id);
      for (const campo of ['infografia_png', 'metadata', 'correo_html']) {
        const archivo = await bajar(id, campo);
        assert.equal(archivo.status, 404, `${id} ${campo}`);
        assert.deepEqual(archivo.body, NO_EXISTE, `${id} ${campo}`);
      }
    }
  });

  it('404 «El archivo no existe.» con otro campo y con los cálculos que no llegaron', async () => {
    for (const campo of ['correo_html', 'infografia_svg', 'contenido', 'constructor', '__proto__', 'METADATA']) {
      const res = await bajar(prueba, campo);
      assert.equal(res.status, 404, campo);
      assert.deepEqual(res.body, SIN_ARCHIVO, campo);
    }
    const res = await bajar(sinCalculos, 'calculos');
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, SIN_ARCHIVO);
  });

  it('401 sin sesión y con el token del bot (no es un JWT), en las tres', async () => {
    for (const token of [null, TOKEN]) {
      for (const ruta of ['/dato-quincena/ediciones', `/dato-quincena/ediciones/${prueba}`]) {
        const res = await api.get(ruta, token === null ? {} : { token });
        assert.equal(res.status, 401, ruta);
        assert.equal(res.body.success, false, ruta);
      }
      const archivo = await bajar(prueba, 'infografia_png', { token });
      assert.equal(archivo.status, 401);
      assert.equal(archivo.body.success, false);
    }
  });

  it('el lector y el colaborador: 200 en la lista, el detalle y la descarga, con lo mismo que ve el admin', async () => {
    const delAdmin = (await leer(`/dato-quincena/ediciones/${prueba}`)).body;
    for (const rol of ['lector', 'colaborador']) {
      const lista = await leer('/dato-quincena/ediciones', rol);
      assert.equal(lista.status, 200, rol);
      const detalle = await leer(`/dato-quincena/ediciones/${prueba}`, rol);
      assert.equal(detalle.status, 200, rol);
      assert.deepEqual(detalle.body, delAdmin, rol);
      const archivo = await bajar(prueba, 'correo_texto', { token: usuarios[rol].token });
      assert.equal(archivo.status, 200, rol);
      assert.ok(archivo.bytes.equals(partes.correo_texto), rol);
    }
  });

  it('si falla la base, 500 con un mensaje fijo por operación y, en la consola, solo el código y el mensaje del error', async () => {
    await query('RENAME TABLE dato_quincena_ediciones TO dato_quincena_ediciones_fuera');
    try {
      const casos = [
        [() => leer('/dato-quincena/ediciones'), 'Error al obtener las ediciones'],
        [() => leer(`/dato-quincena/ediciones/${prueba}`), 'Error al obtener la edición'],
        [() => bajar(prueba, 'infografia_png'), 'Error al descargar el archivo']
      ];
      for (const [pedir, error] of casos) {
        const res = await pedir();
        assert.equal(res.status, 500, error);
        assert.deepEqual(res.body, { success: false, error }, error);
      }
    } finally {
      await query('RENAME TABLE dato_quincena_ediciones_fuera TO dato_quincena_ediciones');
    }
    const esperadas = ['Error al obtener las ediciones ER_NO_SUCH_TABLE', 'Error al obtener la edición ER_NO_SUCH_TABLE',
      'Error al descargar el archivo ER_NO_SUCH_TABLE'];
    for (let i = 0; i < 20 && !esperadas.every((linea) => servidor.logs().includes(linea)); i++) {
      await new Promise((listo) => setTimeout(listo, 100));
    }
    const lineas = servidor.logs().split('\n').filter((linea) => linea.startsWith('Error al '));
    for (const linea of esperadas) assert.ok(lineas.some((l) => l.startsWith(linea)), `la consola registra «${linea}»`);
    for (const linea of lineas) assert.ok(!/SELECT|FROM|WHERE/.test(linea), 'la consola no trae la consulta');
    // Y todo vuelve a andar
    assert.equal((await leer(`/dato-quincena/ediciones/${prueba}`)).status, 200);
  });
});

describe('nada más cambió', () => {
  it('ningún mail, las mismas filas en las otras tablas y la consola sin el token ni lo recibido', async () => {
    assert.deepEqual(await mailpit.mensajes(), []);
    assert.deepEqual(await cuentas(OTRAS_TABLAS), cuentasAntes);

    const esperadas = [`Dato de la quincena: dq:regular:${FECHA_DE_PRUEBA} 201`, `Dato de la quincena: dq:regular:${FECHA_DE_PRUEBA} 200`,
      `Dato de la quincena: dq:regular:${FECHA_DE_PRUEBA} 409`, 'Dato de la quincena: 401 (', 'Dato de la quincena: 422 (',
      'Dato de la quincena: 400 (', 'Dato de la quincena: 413 (', 'Dato de la quincena: 429 ('];
    // La salida del proceso llega por un pipe: se espera un poco a que esté entera
    for (let i = 0; i < 20 && !esperadas.every((linea) => servidor.logs().includes(linea)); i++) {
      await new Promise((listo) => setTimeout(listo, 100));
    }
    const consola = servidor.logs();
    for (const linea of esperadas) assert.ok(consola.includes(linea), `la consola registra «${linea}»`);
    assert.ok(!consola.includes(TOKEN), 'el token no aparece en la consola');
    assert.ok(!consola.includes(sha256(TOKEN)), 'la huella del token no aparece en la consola');
    for (const recibido of ['Un título inventado', 'ñandú', 'Cálculos de prueba', 'infografia-prueba.png', 'inventado']) {
      assert.ok(!consola.includes(recibido), 'la consola no repite lo recibido');
    }
  });
});
