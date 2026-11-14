// El POST del dato de la quincena (spec 2026-11-07-dato-quincena, 4, 6, 7, 8, 12 y 15): Datito manda cada edición como un
// multipart con su token y el RPAD la guarda inmutable en tres tablas. Contra una base de prueba propia, con un área y dos
// datasets inventados (el 2, dado de baja), y la app real: un servidor con la huella de un token generado acá y dos aparte para
// el 503 (sin la huella, '' explícito para no heredar un .env local, y con una mal formada). Cada caso manda su propio
// X-Forwarded-For (203.0.113.<n>): con trust proxy 1, el límite de 20 pedidos por hora cuenta esa IP y no cruza casos.
// El token nunca va a un mensaje de error ni a la consola.
// Las lecturas (spec 9), con una sesión de cualquier rol: la lista vacía antes del primer POST y, después, la lista, el detalle y
// las descargas de lo guardado, con la forma de tests/fixtures/dato-quincena-respuestas.json (las respuestas que lee la página).
// El SVG de la infografía (spec 2026-11-12-dato-quincena-correo, 11 y 12): la edición de prueba llega con las cinco partes (y una
// efeméride en la agenda, como la del detalle de la página); un paquete de cuatro partes sigue teniendo la huella de antes del SVG.
// El número de cada regular lo cuenta la consulta: la edición de prueba, la regular más vieja, es la N.º 1.
// El contrato v1.3 (spec 2026-11-14-dato-quincena-v1-3): un piloto con repeticiones recibe sus avisos (en el 201 y en el 200) y su
// detalle enlaza la edición previa; la coherencia entre Repite y repeticion da 422.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, cerrarDb, query, mailpit } from './helpers.js';
import {
  FECHA_DE_PRUEBA, edicionDePrueba, pilotoDePrueba, partesDePrueba, svgDePrueba, efemerideDePrueba, repeticionDePrueba
} from './dato-quincena-fixtures.js';
import { isDeepStrictEqual } from 'node:util';
import { MENSAJES_VALIDACION, TOPE_DEL_PEDIDO, TOPES } from '../services/datoQuincenaReglas.js';
import { envioDelRecibo, lineaDelCorreo, pastillaDelEnvio } from '../services/datoQuincenaCorreoReglas.js';
import { calendarioCon } from '../services/feriadosReglas.js';
import { hoyArgentina, ahoraArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';

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

// La huella del paquete calculada acá, sin la regla del servidor (spec 6): la de antes del SVG, cuatro renglones, y la de un
// paquete con el SVG, que suma su renglón al final (spec 2026-11-12-dato-quincena-correo, 11)
const renglones = (partes, nombres) => nombres.map((parte) => `${parte}:${partes[parte] ? sha256(partes[parte]) : '-'}\n`).join('');
const huellaSinSvg = (partes) => sha256(renglones(partes, ['metadata', 'infografia_png', 'correo_texto', 'calculos']));
const huellaDe = (partes) => sha256(renglones(partes, ['metadata', 'infografia_png', 'correo_texto', 'calculos',
  ...(partes.infografia_svg === undefined ? [] : ['infografia_svg'])]));

// La edición de prueba como la manda el bot ahora: con una efeméride en la agenda y, en el pedido, el SVG (las cinco partes).
// Es la del detalle de tests/fixtures/dato-quincena-respuestas.json
const edicionConEfemeride = (cambios = {}) => edicionDePrueba({
  agenda: [...edicionDePrueba().agenda, efemerideDePrueba()], ...cambios
});
const partesConSvg = (cambios = {}, otras = {}) => partesDePrueba(edicionConEfemeride(cambios), {
  infografia_svg: svgDePrueba(), ...otras
});

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
  adjuntos: await query('SELECT id, edicion_id, campo, sha256 FROM dato_quincena_adjuntos ORDER BY id'),
  correos: await query(
    `SELECT edicion_id, estado, motivo, DATE_FORMAT(creada_at, '%Y-%m-%d %H:%i:%s') AS creada_at
     FROM dato_quincena_correos ORDER BY edicion_id`
  ),
  envios: await query('SELECT id, edicion_id, usuario_id, tipo, estado FROM dato_quincena_envios ORDER BY id')
});

const CLAVES_DEL_RECIBO = [
  'id', 'clave', 'tipo', 'fecha_edicion', 'huella', 'recibida_at', 'repetida', 'adjuntos', 'url', 'avisos', 'envio'
];
// El envío del recibo de una regular que llega con el envío automático apagado, como está en la base de prueba (spec
// 2026-11-12-dato-quincena-correo, 5 y 11), y el de un piloto
const ENVIO_APAGADO = Object.freeze({
  estado: 'no_enviada', programado_at: null, texto: 'No se envía por correo: el envío automático está apagado.'
});
const ENVIO_DEL_PILOTO = Object.freeze({ estado: 'piloto', programado_at: null, texto: 'Los pilotos no se envían por correo.' });
const RECIBIDA_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/;

// La regular de enero de 2027, escrita a mano en «las lecturas» (el POST no acepta una fecha posterior a mañana). «El envío por
// correo» manda por POST regulares de hoy − 2 a hoy + 1: con la misma clave darían 409. Por eso su fecha es un lunes de enero
// que nunca es ninguna de esas, con un día de margen de cada lado por si la suite cruza la medianoche
const cercaDeHoy = (fecha) => fecha >= sumarDias(hoyArgentina(), -3) && fecha <= sumarDias(hoyArgentina(), 2);
const FECHA_DE_ENERO = ['2027-01-11', '2027-01-25'].find((fecha) => !cercaDeHoy(fecha));

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

  it('un desconocido que declara más del tope del pedido (7 MB) recibe el 401 enseguida, con Connection: close', async () => {
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

  it('un 401 con Content-Length de hasta 7 MB se responde después de leer el pedido, sin cortar la conexión', async () => {
    const res = await enviar(partesDePrueba(edicionDePrueba()), { ip: 6, token: null });
    assert.equal(res.status, 401);
    assert.notEqual(res.headers.get('connection'), 'close');
  });

  // El tope del pedido suma el del SVG: el paquete más grande que puede llegar, con cada parte en su tope, pasa de 6 MB y se lee
  it('el paquete más grande (cada una de las cinco partes en su tope) entra en el tope del pedido: el 401, después de leerlo', async () => {
    const cuerpo = multipartCrudo(Object.entries(TOPES).map(([nombre, tope]) => ({ nombre, contenido: Buffer.alloc(tope, 0x61) })));
    assert.ok(cuerpo.length > 6 * MB && cuerpo.length <= TOPE_DEL_PEDIDO, `${cuerpo.length} bytes`);
    const res = await pedirCrudo({
      ip: 9,
      token: null,
      headers: { 'Content-Type': `multipart/form-data; boundary=${LIMITE}`, 'Content-Length': String(cuerpo.length) },
      trozos: [cuerpo]
    });
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, ERROR_401);
    assert.notEqual(res.headers.connection, 'close');
  });
});

describe('guardar una edición', () => {
  const partes = partesConSvg();
  const clave = `dq:regular:${FECHA_DE_PRUEBA}`;
  let primero;

  it('201 con las cinco partes: el recibo completo, con la hora de llegada de la base, los adjuntos (el SVG al final) y la dirección', async () => {
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
    assert.notEqual(primero.huella, huellaSinSvg(partes), 'el renglón del SVG cuenta en la huella');
    assert.match(primero.recibida_at, RECIBIDA_AT);
    assert.ok(Math.abs(Date.parse(primero.recibida_at) - Date.now()) < 60 * 1000, 'recibida_at está a menos de un minuto de ahora');
    assert.equal(primero.repetida, false);
    assert.deepEqual(primero.adjuntos, [
      { campo: 'infografia_png', bytes: partes.infografia_png.length, sha256: sha256(partes.infografia_png) },
      { campo: 'correo_texto', bytes: partes.correo_texto.length, sha256: sha256(partes.correo_texto) },
      { campo: 'calculos', bytes: partes.calculos.length, sha256: sha256(partes.calculos) },
      { campo: 'infografia_svg', bytes: partes.infografia_svg.length, sha256: sha256(partes.infografia_svg) }
    ]);
    assert.ok(primero.url.endsWith(`/dato-quincena.html?id=${primero.id}`), primero.url);
    assert.deepEqual(primero.avisos, []);
    // El envío automático está apagado en la base de prueba (la fila 1 de la configuración nace así)
    assert.deepEqual(primero.envio, ENVIO_APAGADO);
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
        sha256: sha256(partes.calculos) },
      { campo: 'infografia_svg', nombre: 'infografia-prueba.svg', mime: 'image/svg+xml', bytes: partes.infografia_svg.length,
        sha256: sha256(partes.infografia_svg) }
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
    const res = await enviar(partes, { ip: 12, orden: ['infografia_svg', 'calculos', 'correo_texto', 'infografia_png', 'metadata'] });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, data: { ...primero, repetida: true } });
    assert.deepEqual(await todoLoGuardado(), antes);
  });

  it('409 con un byte distinto en el texto del correo: la misma clave con otro contenido, sin cambios', async () => {
    const antes = await todoLoGuardado();
    const res = await enviar(partesConSvg({}, { correo_texto: correoConOtroByte() }), { ip: 13 });
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.deepEqual(res.body, {
      success: false, error: `Ya hay una edición con la clave ${clave} y otro contenido. No se cambió nada.`
    });
    assert.deepEqual(await todoLoGuardado(), antes);
  });

  it('el paquete de cuatro partes, sin el SVG: la huella de antes del SVG, 201 y después 200 con el mismo recibo', async () => {
    const cuatro = partesDePrueba(edicionDePrueba({ fecha_edicion: '2026-11-09' }));
    assert.deepEqual(Object.keys(cuatro), ['metadata', 'infografia_png', 'correo_texto', 'calculos']);
    const res = await enviar(cuatro, { ip: 8 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.huella, huellaSinSvg(cuatro));
    assert.deepEqual(res.body.data.adjuntos.map((a) => a.campo), ['infografia_png', 'correo_texto', 'calculos']);
    const antes = await todoLoGuardado();
    const repetida = await enviar(cuatro, { ip: 8 });
    assert.equal(repetida.status, 200, JSON.stringify(repetida.body));
    assert.deepEqual(repetida.body.data, { ...res.body.data, repetida: true });
    assert.deepEqual(await todoLoGuardado(), antes);
  });

  it('el mismo paquete con un SVG agregado: otro contenido para la misma clave, 409 sin cambios', async () => {
    const antes = await todoLoGuardado();
    const res = await enviar(partesDePrueba(edicionDePrueba({ fecha_edicion: '2026-11-09' }), { infografia_svg: svgDePrueba() }),
      { ip: 8 });
    assert.equal(res.status, 409, JSON.stringify(res.body));
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
      assert.deepEqual(res.body.data.envio, edicion.tipo === 'regular' ? ENVIO_APAGADO : ENVIO_DEL_PILOTO);
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

  // El bot archiva la edición aunque su correo no haya salido. Desde el correo del RPAD (spec 2026-11-12-dato-quincena-correo,
  // 2.11 y 6), el detalle de una edición nueva habla del envío del RPAD: con el envío automático apagado y sin el correo del bot,
  // que no se envió
  it('una regular con el correo no enviado: 201 y el detalle dice que no se envió; con la hora del correo puesta, 422 y nada guardado', async () => {
    const conHora = edicionDePrueba({ fecha_edicion: '2026-11-08', correo: { estado: 'no_enviado', enviado_at: '2026-11-08T11:12:00Z' } });
    const antes = await cuentas(TABLAS_DEL_DATO);
    const mal = await enviar(partesDePrueba(conHora), { ip: 7 });
    assert.equal(mal.status, 422, JSON.stringify(mal.body));
    assert.deepEqual(mal.body.errores, [{ campo: 'correo.enviado_at', mensaje: MENSAJES_VALIDACION.enviadoAtSinCorreo }]);
    assert.deepEqual(await cuentas(TABLAS_DEL_DATO), antes);

    const sinCorreo = edicionDePrueba({ fecha_edicion: '2026-11-08', correo: { estado: 'no_enviado', enviado_at: null } });
    const res = await enviar(partesDePrueba(sinCorreo), { ip: 7 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.clave, 'dq:regular:2026-11-08');
    const detalle = await leer(`/dato-quincena/ediciones/${res.body.data.id}`);
    assert.equal(detalle.status, 200, JSON.stringify(detalle.body));
    assert.equal(detalle.body.data.correo, 'No se envió: el envío automático estaba apagado.');
  });
});

// spec 2026-11-14-dato-quincena-v1-3, 2 y 3: lo que depende de lo archivado da avisos y nunca un 422. Un piloto del 05/11 (así no
// choca con ninguna regular ni cambia los números) con cinco propuestas: la 1 vuelve sobre el dataset 1 de la edición de prueba
// (02/11, que lo cita), con enlace y sin aviso; la 2 es una efeméride sin repetición; la 3 vuelve sobre el tema de una edición del
// 19/10 que no está en el RPAD; la 4 cita un dataset que no está y vuelve sobre él en la de prueba, que no lo tiene; y la 5 dice
// repetir la de su mismo día
describe('la repetición (contrato v1.3)', () => {
  const FECHA = '2026-11-05';
  const pilotoConRepeticiones = () => {
    const piloto = pilotoDePrueba({ fecha_edicion: FECHA, referencia_piloto: 'piloto-30' });
    const [primera, segunda] = piloto.propuestas;
    primera.etiquetas.push('Repite');
    primera.repeticion = repeticionDePrueba();
    segunda.etiquetas = ['Agenda', 'Efemeride'];
    const otra = (orden, cambios) => ({ ...structuredClone(segunda), orden, etiquetas: ['Repite'], ...cambios });
    piloto.propuestas.push(
      otra(3, { repeticion: repeticionDePrueba({ fecha_edicion_previa: '2026-10-19', alcance: 'tema', motivo: 'hecho_actual' }) }),
      otra(4, { dataset: { ...segunda.dataset, rpad_id: 999 }, repeticion: repeticionDePrueba() }),
      otra(5, { repeticion: repeticionDePrueba({ fecha_edicion_previa: FECHA }) })
    );
    return piloto;
  };
  const partes = partesDePrueba(pilotoConRepeticiones());
  const AVISOS = [
    'La propuesta 3 repite la edición del 19/10/2026, que no está en el RPAD: se guardó sin enlace.',
    'La propuesta 4 cita el dataset 999, que no está en el RPAD: se guardó sin enlace.',
    'La propuesta 4 repite el dataset 999 de la edición del 02/11/2026, pero esa edición no lo tiene.',
    'La propuesta 5 repite la edición del 05/11/2026, que no es anterior a esta: se guardó sin enlace.'
  ];
  let recibo, prueba;

  before(async () => {
    prueba = (await edicionGuardada(`dq:regular:${FECHA_DE_PRUEBA}`)).id;
  });

  it('201 con sus avisos, en el orden de las propuestas (el del dataset antes que el de su repetición); nada da 422', async () => {
    const res = await enviar(partes, { ip: 70 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    recibo = res.body.data;
    assert.deepEqual(Object.keys(recibo), CLAVES_DEL_RECIBO);
    assert.equal(recibo.clave, `dq:piloto:${FECHA}:piloto-30`);
    assert.deepEqual(recibo.avisos, AVISOS);
    assert.deepEqual(recibo.envio, ENVIO_DEL_PILOTO);
    const guardada = await edicionGuardada(recibo.clave);
    assert.ok(guardada.metadata.equals(partes.metadata), 'metadata guardada igual byte a byte, con sus repeticiones');
    assert.deepEqual((await propuestasGuardadas(guardada.id)).map((p) => p.dataset_id), [1, 2, 2, null, 2]);
  });

  it('200 al repetirla, con los mismos avisos armados de nuevo desde lo guardado', async () => {
    const antes = await todoLoGuardado();
    const res = await enviar(partes, { ip: 70 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data, { ...recibo, repetida: true });
    assert.deepEqual(await todoLoGuardado(), antes);
  });

  it('el detalle: las etiquetas para mostrar y cada repetición, con el id de la edición previa solo si está y es anterior', async () => {
    const res = await leer(`/dato-quincena/ediciones/${recibo.id}`, 'lector');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { propuestas } = res.body.data;
    assert.deepEqual(propuestas.map((p) => p.etiquetas),
      [['Principal', 'Validar', 'Repite'], ['Agenda', 'Efeméride'], ['Repite'], ['Repite'], ['Repite']]);
    const datosNuevos = 'Datos nuevos: Llegaron los datos de octubre, que la edición anterior no tenía.';
    assert.deepEqual(propuestas.map((p) => p.repeticion), [
      { texto: 'Repite el dataset de la edición del 02/11/2026.', motivo: datosNuevos, id_edicion: prueba },
      null,
      { texto: 'Repite el tema de la edición del 19/10/2026.', motivo: 'Hecho actual: Llegaron los datos de octubre, que la edición '
        + 'anterior no tenía.', id_edicion: null },
      { texto: 'Repite el dataset de la edición del 02/11/2026.', motivo: datosNuevos, id_edicion: prueba },
      { texto: 'Repite el dataset de la edición del 05/11/2026.', motivo: datosNuevos, id_edicion: null }
    ]);
    assert.ok(propuestas[0].para_copiar.includes(`Próxima en 29 días.\n\nRepite el dataset de la edición del 02/11/2026.\n${datosNuevos}`
      + '\n\nPara validar antes de publicar\n'));
    // La forma, la de la respuesta con repeticiones que lee la página
    assert.deepEqual(forma(res.body), forma(RESPUESTAS.detalle_con_repeticion));
  });

  // La previa tiene que ser una regular (un piloto de esa fecha no cuenta); una metadata previa que no se puede leer no tira; y el
  // aviso 3 compara con lo que el bot citó en la previa, no con el enlace que quedó guardado (el 06/11 citó el dataset 999, que
  // no está en el RPAD y quedó sin enlace). Un piloto del 11/11 con tres propuestas
  it('la previa es una regular; una metadata previa rara no tira; el aviso 3 mira lo que citó el bot', async () => {
    // El 10/11 solo tiene un piloto
    const soloPiloto = await enviar(partesDePrueba(pilotoDePrueba({ fecha_edicion: '2026-11-10', referencia_piloto: 'piloto-31' })),
      { ip: 72 });
    assert.equal(soloPiloto.status, 201, JSON.stringify(soloPiloto.body));
    // Una regular del 30/10 escrita a mano con una metadata que no es una edición (solo un SQL a mano la deja así). Se borra al
    // final: los demás grupos cuentan las regulares y esperan que la del 02/11 sea la más vieja
    const rara = (await query(
      `INSERT INTO dato_quincena_ediciones (clave, tipo, fecha_edicion, referencia_piloto, titulo, metadata, huella)
       VALUES ('dq:regular:2026-10-30', 'regular', '2026-10-30', NULL, 'Una edición rara', 'null', ?)`,
      ['d'.repeat(64)]
    )).insertId;
    const delSeis = (await edicionGuardada('dq:regular:2026-11-06')).id;
    assert.deepEqual((await propuestasGuardadas(delSeis)).map((p) => p.dataset_id), [1, null], 'el 999 del 06/11 quedó sin enlace');
    try {
      const piloto = pilotoDePrueba({ fecha_edicion: '2026-11-11', referencia_piloto: 'piloto-32' });
      const [primera, segunda] = piloto.propuestas;
      primera.etiquetas.push('Repite');
      primera.repeticion = repeticionDePrueba({ fecha_edicion_previa: '2026-11-10' });
      segunda.etiquetas = ['Repite'];
      segunda.repeticion = repeticionDePrueba({ fecha_edicion_previa: '2026-10-30' });
      piloto.propuestas.push({
        ...structuredClone(segunda), orden: 3, dataset: { ...segunda.dataset, rpad_id: 999 },
        repeticion: repeticionDePrueba({ fecha_edicion_previa: '2026-11-06' })
      });
      const partesDelPiloto = partesDePrueba(piloto);
      const avisos = [
        'La propuesta 1 repite la edición del 10/11/2026, que no está en el RPAD: se guardó sin enlace.',
        'La propuesta 2 repite el dataset 2 de la edición del 30/10/2026, pero esa edición no lo tiene.',
        'La propuesta 3 cita el dataset 999, que no está en el RPAD: se guardó sin enlace.'
      ];
      const res = await enviar(partesDelPiloto, { ip: 72 });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.deepEqual(res.body.data.avisos, avisos);
      const repetida = await enviar(partesDelPiloto, { ip: 72 });
      assert.equal(repetida.status, 200, JSON.stringify(repetida.body));
      assert.deepEqual(repetida.body.data.avisos, avisos);
      const detalle = await leer(`/dato-quincena/ediciones/${res.body.data.id}`);
      assert.equal(detalle.status, 200, JSON.stringify(detalle.body));
      assert.deepEqual(detalle.body.data.propuestas.map((p) => p.repeticion.id_edicion), [null, rara, delSeis]);
    } finally {
      await query('DELETE FROM dato_quincena_ediciones WHERE id = ?', [rara]);
    }
  });

  it('la coherencia entre Repite y repeticion: 422 con su campo y su mensaje, y nada guardado', async () => {
    const antes = await todoLoGuardado();
    const sinRepeticion = edicionDePrueba({ fecha_edicion: '2026-11-01' });
    sinRepeticion.propuestas[1].etiquetas.push('Repite');
    const sinEtiqueta = edicionDePrueba({ fecha_edicion: '2026-11-01' });
    sinEtiqueta.propuestas[0].repeticion = repeticionDePrueba();
    const casos = [
      [sinRepeticion, { campo: 'propuestas[1].repeticion', mensaje: 'La propuesta tiene la etiqueta Repite pero no tiene repeticion.' }],
      [sinEtiqueta, { campo: 'propuestas[0].etiquetas', mensaje: 'La propuesta tiene repeticion pero no tiene la etiqueta Repite.' }]
    ];
    for (const [edicion, esperado] of casos) {
      const res = await enviar(partesDePrueba(edicion), { ip: 71 });
      assert.equal(res.status, 422, JSON.stringify(res.body));
      assert.deepEqual(res.body, { success: false, error: 'La edición tiene errores.', errores: [esperado] });
    }
    assert.deepEqual(await todoLoGuardado(), antes);
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

  it('dos infografia_svg', async () => {
    const res = await enviar(partesConSvg({ fecha_edicion: '2026-11-01' }), {
      ip: 36, orden: ['metadata', 'infografia_png', 'correo_texto', 'infografia_svg', 'infografia_svg']
    });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, noSePudoLeer('la parte infografia_svg llegó dos veces'));
  });

  // Con el SVG, cinco partes son una edición completa: una quinta con otro nombre es «otra», no una de más
  it('cinco partes, la quinta con otro nombre', async () => {
    const res = await enviar({ ...partes(), correo_html: Buffer.from('<p>inventado</p>') }, {
      ip: 26, orden: ['metadata', 'infografia_png', 'correo_texto', 'calculos', 'correo_html']
    });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, noSePudoLeer('una parte no corresponde'));
  });

  it('seis partes: las cinco de una edición y una más', async () => {
    const res = await enviar({ ...partesConSvg({ fecha_edicion: '2026-11-01' }), correo_html: Buffer.from('<p>inventado</p>') }, {
      ip: 37, orden: ['metadata', 'infografia_png', 'correo_texto', 'calculos', 'infografia_svg', 'correo_html']
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

  it('un SVG de 1 MB + 1', async () => {
    const res = await enviar(partes({ infografia_svg: Buffer.alloc(MB + 1, 0x61) }), { ip: 45 });
    assert.equal(res.status, 413);
    assert.deepEqual(res.body, supera('infografia_svg', '1 MB'));
  });

  // El tope es del SVG y no del pedido: uno válido de 1 MB justo pasa la lectura y la validación, y el 422 es por otra cosa
  it('un SVG válido de 1 MB justo no es 413: la edición sigue hasta su 422 (dos Principal)', async () => {
    const svg = svgDePrueba();
    const justo = Buffer.concat([svg, Buffer.alloc(TOPES.infografia_svg - svg.length, 0x20)]);
    assert.equal(justo.length, MB);
    const edicion = edicionDePrueba({ fecha_edicion: '2026-11-01' });
    edicion.propuestas[1].etiquetas = ['Principal'];
    const res = await enviar(partesDePrueba(edicion, { infografia_svg: justo }), { ip: 46 });
    assert.equal(res.status, 422, JSON.stringify(res.body));
    assert.deepEqual(res.body.errores, [{ campo: 'propuestas', mensaje: MENSAJES_VALIDACION.principal }]);
  });

  it('nada quedó guardado', async () => {
    assert.deepEqual(await todoLoGuardado(), antes);
  });
});

describe('una edición con errores: 422', () => {
  it('un SVG con un script o con una referencia externa: el error del SVG, y nada guardado', async () => {
    const antes = await todoLoGuardado();
    const svgs = [
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>\n',
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://ejemplo.invalid/a.png" width="10" height="10"/></svg>\n'
    ];
    for (const texto of svgs) {
      const res = await enviar(partesConSvg({ fecha_edicion: '2026-11-01' }, { infografia_svg: Buffer.from(texto, 'utf8') }), {
        ip: 51
      });
      assert.equal(res.status, 422, JSON.stringify(res.body));
      assert.deepEqual(res.body, {
        success: false,
        error: 'La edición tiene errores.',
        errores: [{ campo: 'infografia_svg', mensaje: MENSAJES_VALIDACION.svg }]
      }, texto);
    }
    assert.deepEqual(await todoLoGuardado(), antes);
  });

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
  const partes = partesConSvg();
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
    const enero = edicionDePrueba({ fecha_edicion: FECHA_DE_ENERO });
    deEnero = (await query(
      `INSERT INTO dato_quincena_ediciones (clave, tipo, fecha_edicion, referencia_piloto, titulo, metadata, huella)
       VALUES (?, 'regular', ?, NULL, ?, ?, ?)`,
      [`dq:regular:${FECHA_DE_ENERO}`, FECHA_DE_ENERO, enero.titulo, JSON.stringify(enero), 'f'.repeat(64)]
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

  // El número se cuenta al leer, por la fecha y no por la llegada (spec 2026-11-12-dato-quincena-correo, 12): la del 09/11 llegó
  // segunda, pero tiene antes todas las regulares de noviembre
  it('el número: «N.º n» en una regular, con n las regulares de esa fecha o antes (también de otro año), y null en un piloto', async () => {
    const guardadas = await query("SELECT id, tipo, DATE_FORMAT(fecha_edicion, '%Y-%m-%d') AS fecha FROM dato_quincena_ediciones");
    const fechasRegulares = guardadas.filter((e) => e.tipo === 'regular').map((e) => e.fecha);
    const esperado = new Map(guardadas.map(({ id, tipo, fecha }) => [id, tipo === 'regular'
      ? `N.º ${fechasRegulares.filter((otra) => otra <= fecha).length}`
      : null]));
    assert.ok(guardadas.some((e) => e.tipo === 'piloto'));

    const delAnio = async (anio) => (await leer(`/dato-quincena/ediciones?anio=${anio}`)).body.data.ediciones;
    const enLaLista = [...await delAnio(2026), ...await delAnio(2027)];
    assert.equal(enLaLista.length, guardadas.length);
    for (const { id, numero } of enLaLista) assert.equal(numero, esperado.get(id), `la lista, edición ${id}`);

    const delNueve = (await edicionGuardada('dq:regular:2026-11-09')).id;
    assert.equal(esperado.get(prueba), 'N.º 1');
    assert.equal(esperado.get(delNueve), `N.º ${fechasRegulares.filter((f) => f.startsWith('2026-11')).length}`);
    assert.equal(esperado.get(deEnero), `N.º ${fechasRegulares.length}`);
    for (const id of [prueba, delNueve, deEnero, piloto]) {
      assert.equal((await leer(`/dato-quincena/ediciones/${id}`)).body.data.numero, esperado.get(id), `el detalle, edición ${id}`);
    }
    assert.equal(esperado.get(piloto), null);
  });

  it('la forma de la lista, la del detalle y la del 404 son las de las respuestas que lee la página', async () => {
    const lista = await leer('/dato-quincena/ediciones?anio=2026');
    assert.deepEqual(forma(lista.body), forma(RESPUESTAS.lista));
    const deEneroLista = await leer('/dato-quincena/ediciones?anio=2027');
    assert.deepEqual(forma(deEneroLista.body), forma(RESPUESTAS.lista_de_2027));
    // El piloto, sin nota de archivo, y las que llegaron sin el SVG o sin los cálculos, con menos archivos: la misma forma
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

  // Un piloto nunca sale solo (spec 2026-11-12-dato-quincena-correo, 5 y 6): su línea lo dice, aunque el bot haya mandado su
  // correo
  it('un piloto (que no se envía por correo, sin nota de archivo) y una edición sin cálculos (tres archivos)', async () => {
    const delPiloto = (await leer(`/dato-quincena/ediciones/${piloto}`)).body.data;
    assert.equal(delPiloto.fecha_texto, 'Miércoles 4 de noviembre de 2026');
    assert.equal(delPiloto.marca, 'Piloto 4');
    assert.equal(delPiloto.titulo, 'El dato de la quincena: piloto de prueba');
    assert.equal(delPiloto.correo, 'Los pilotos no se envían por correo.');
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

  it('cada descarga, también la del SVG: los bytes enviados, su Content-Type y un Content-Disposition de adjunto con su nombre', async () => {
    const casos = [
      ['infografia_png', 'image/png', 'infografia-prueba.png', partes.infografia_png],
      ['infografia_svg', 'image/svg+xml', 'infografia-prueba.svg', partes.infografia_svg],
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

  it('404 «El archivo no existe.» con otro campo y con los cálculos o el SVG que no llegaron', async () => {
    for (const campo of ['correo_html', 'infografia', 'svg', 'contenido', 'constructor', '__proto__', 'METADATA', 'INFOGRAFIA_SVG']) {
      const res = await bajar(prueba, campo);
      assert.equal(res.status, 404, campo);
      assert.deepEqual(res.body, SIN_ARCHIVO, campo);
    }
    for (const campo of ['calculos', 'infografia_svg']) {
      const res = await bajar(sinCalculos, campo);
      assert.equal(res.status, 404, campo);
      assert.deepEqual(res.body, SIN_ARCHIVO, campo);
    }
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

// El correo del RPAD (spec 2026-11-12-dato-quincena-correo, 5, 6, 11 y 12): al llegar, en la misma transacción, una regular queda
// programada si el envío automático está prendido y es de los últimos 13 días, y si no, no enviada; un piloto no tiene envío.
// El interruptor es la fila 1 de dato_quincena_correo_config de la base de prueba: se escribe acá y queda apagado al final.
// El recibo trae el envío; la lista, la pastilla (la de administración dice si a alguien no le llegó); el detalle, la línea.
// Lo que depende de la hora se compara con las reglas, con el ahora de antes y el de después del pedido (el del servidor queda
// en el medio) y el calendario de la base de prueba, sin filas de feriados (los 9 fijos). Las personas y direcciones, inventadas.
// Va después de las lecturas: suma regulares, y el número de las de arriba se cuenta con las que había.
describe('el envío por correo', () => {
  const CALENDARIO = calendarioCon([]);
  const PROGRAMADA = Object.freeze({ estado: 'programada', motivo: null, enviada_at: null });
  const prender = (activo) => query('UPDATE dato_quincena_correo_config SET envio_activo = ? WHERE id = 1', [activo ? 1 : 0]);
  const correoGuardado = async (edicionId) => (await query(
    `SELECT estado, motivo, DATE_FORMAT(enviada_at, '%Y-%m-%d %H:%i:%s') AS enviada_at,
            DATE_FORMAT(creada_at, '%Y-%m-%d %H:%i:%s') AS creada_at, ultima_corrida_at
     FROM dato_quincena_correos WHERE edicion_id = ?`,
    [edicionId]
  ))[0] ?? null;
  const sinCreada = (fila) => ({ ...fila, creada_at: '·' });
  // El valor tiene que ser lo que arman las reglas con el ahora de antes o con el de después
  const unoDe = (valor, armar, antes, despues, mensaje) => {
    const posibles = [armar(antes), armar(despues)];
    assert.ok(posibles.some((posible) => isDeepStrictEqual(posible, valor)),
      `${mensaje}: ${JSON.stringify(valor)} no es ninguno de ${JSON.stringify(posibles)}`);
  };
  // La pastilla de una edición en la lista de su año y la línea de su detalle, con la sesión de `rol`
  const pastillaEnLaLista = async (id, fecha, rol = 'admin') => {
    const res = await leer(`/dato-quincena/ediciones?anio=${fecha.slice(0, 4)}`, rol);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const edicion = res.body.data.ediciones.find((e) => e.id === id);
    assert.ok(edicion, `la edición ${id} está en la lista de ${fecha.slice(0, 4)}`);
    return edicion.envio;
  };
  const lineaDelDetalle = async (id, rol = 'admin') => {
    const res = await leer(`/dato-quincena/ediciones/${id}`, rol);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data.correo;
  };
  const envioDeLaProgramada = (fecha_edicion) => (ahora) => envioDelRecibo({
    tipo: 'regular', fecha_edicion, correo: PROGRAMADA, envios: [], envioActivo: true, ahora, calendario: CALENDARIO
  });

  // La regular de hoy que queda programada, el ahora de antes de su POST y la persona inventada que suma el caso de «3 de 4»
  let programada, fechaDeLaProgramada, antesDeLaProgramada, cuarta;

  before(async () => {
    assert.equal(await cuenta('feriados'), 0, 'la base de prueba no tiene filas de feriados: el calendario son los 9 fijos');
  });
  after(() => prender(false));

  it('prendido, una regular de hoy: 201 programada, con el instante de su corrida y el texto; su fila, sin personas todavía', async () => {
    await prender(true);
    antesDeLaProgramada = ahoraArgentina();
    fechaDeLaProgramada = antesDeLaProgramada.slice(0, 10);
    const res = await enviar(partesDePrueba(edicionDePrueba({ fecha_edicion: fechaDeLaProgramada })), { ip: 40 });
    const despues = ahoraArgentina();
    assert.equal(res.status, 201, JSON.stringify(res.body));
    programada = res.body.data;
    assert.deepEqual(Object.keys(programada), CLAVES_DEL_RECIBO);
    assert.deepEqual(Object.keys(programada.envio), ['estado', 'programado_at', 'texto']);
    assert.equal(programada.envio.estado, 'programada');
    assert.match(programada.envio.programado_at, /^\d{4}-\d{2}-\d{2}T(08:05|14:00):00-03:00$/);
    assert.match(programada.envio.texto, /^Se envía (hoy|el [a-záéíóú]+ \d{2}\/\d{2}\/\d{4}) a las (8:05|14:00)\.$/);
    unoDe(programada.envio, envioDeLaProgramada(fechaDeLaProgramada), antesDeLaProgramada, despues, 'el envío del recibo');

    const fila = await correoGuardado(programada.id);
    assert.deepEqual(sinCreada(fila),
      { estado: 'programada', motivo: null, enviada_at: null, creada_at: '·', ultima_corrida_at: null });
    assert.ok(fila.creada_at >= antesDeLaProgramada && fila.creada_at <= despues,
      `creada_at (${fila.creada_at}): la hora argentina del POST`);
    const [{ n }] = await query('SELECT COUNT(*) AS n FROM dato_quincena_envios WHERE edicion_id = ?', [programada.id]);
    assert.equal(Number(n), 0);
  });

  it('el mismo paquete: 200 con el mismo envío; con otro contenido, 409: ninguna fila nueva ni cambiada', async () => {
    const partes = partesDePrueba(edicionDePrueba({ fecha_edicion: fechaDeLaProgramada }));
    const guardado = await todoLoGuardado();
    const antes = ahoraArgentina();
    const res = await enviar(partes, { ip: 41 });
    const despues = ahoraArgentina();
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { envio, ...resto } = res.body.data;
    const { envio: delPrimero, ...restoDelPrimero } = programada;
    assert.deepEqual(resto, { ...restoDelPrimero, repetida: true });
    // El de ese momento: el mismo del 201, salvo que entre los dos pedidos haya pasado una corrida (las 8:05 o las 14:00)
    unoDe(envio, envioDeLaProgramada(fechaDeLaProgramada), antes, despues, 'el envío del 200');
    const armar = envioDeLaProgramada(fechaDeLaProgramada);
    if (isDeepStrictEqual(armar(antesDeLaProgramada), armar(despues))) assert.deepEqual(envio, delPrimero);

    const conOtroByte = partesDePrueba(edicionDePrueba({ fecha_edicion: fechaDeLaProgramada }),
      { correo_texto: correoConOtroByte() });
    const otro = await enviar(conOtroByte, { ip: 41 });
    assert.equal(otro.status, 409, JSON.stringify(otro.body));
    assert.deepEqual(await todoLoGuardado(), guardado);
  });

  it('apagado: una regular queda no enviada por «apagado»; el recibo, el detalle y la pastilla lo dicen, a todos los roles', async () => {
    await prender(false);
    const fecha = sumarDias(hoyArgentina(), -1);
    const edicion = edicionDePrueba({ fecha_edicion: fecha, correo: { estado: 'no_enviado', enviado_at: null } });
    const res = await enviar(partesDePrueba(edicion), { ip: 42 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.envio, ENVIO_APAGADO);
    const { id } = res.body.data;
    assert.deepEqual(sinCreada(await correoGuardado(id)),
      { estado: 'no_enviada', motivo: 'apagado', enviada_at: null, creada_at: '·', ultima_corrida_at: null });
    for (const rol of ['admin', 'lector', 'colaborador']) {
      assert.equal(await lineaDelDetalle(id, rol), 'No se envió: el envío automático estaba apagado.', rol);
      assert.deepEqual(await pastillaEnLaLista(id, fecha, rol), { tipo: 'no_enviada', texto: 'No se envió' }, rol);
    }
  });

  it('sin la fila de la configuración, apagado; con el correo de Datito, su línea y su pastilla (la transición)', async () => {
    await prender(true);
    const fecha = sumarDias(hoyArgentina(), -2);
    await query('DELETE FROM dato_quincena_correo_config WHERE id = 1');
    let res;
    try {
      res = await enviar(partesDePrueba(edicionDePrueba({ fecha_edicion: fecha })), { ip: 43 });
    } finally {
      await query('INSERT INTO dato_quincena_correo_config (id, envio_activo) VALUES (1, 0)');
    }
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.envio, ENVIO_APAGADO);
    const { id } = res.body.data;
    assert.equal((await correoGuardado(id)).motivo, 'apagado');
    assert.equal(await lineaDelDetalle(id), 'Correo enviado el 02/11/2026 a las 08:12, según Datito.');
    assert.deepEqual(await pastillaEnLaLista(id, fecha), { tipo: 'enviada', texto: 'Enviada por Datito el lun 02/11' });
  });

  it('prendido, un piloto: el recibo dice que no se envía y no tiene fila de correo; el detalle y la pastilla, lo mismo', async () => {
    await prender(true);
    const fecha = hoyArgentina();
    const piloto = pilotoDePrueba({ fecha_edicion: fecha, referencia_piloto: 'piloto-950' });
    const res = await enviar(partesDePrueba(piloto), { ip: 44 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.envio, ENVIO_DEL_PILOTO);
    const { id } = res.body.data;
    assert.equal(await correoGuardado(id), null);
    assert.equal(await lineaDelDetalle(id), 'Los pilotos no se envían por correo.');
    assert.deepEqual(await pastillaEnLaLista(id, fecha), { tipo: 'piloto', texto: 'Piloto: no se envía' });
  });

  it('la programada, para cada rol: «Se envía…» y «Sale…» con la hora de la consulta; apagado, «En espera»', async () => {
    await prender(true);
    const parametros = (ahora) => ({
      tipo: 'regular', fecha_edicion: fechaDeLaProgramada, correo: PROGRAMADA, envios: [], reenvios: [], lista: [],
      correoDelBot: edicionDePrueba().correo, envioActivo: true, ahora, calendario: CALENDARIO
    });
    for (const rol of ['admin', 'lector', 'colaborador']) {
      const antes = ahoraArgentina();
      const linea = await lineaDelDetalle(programada.id, rol);
      const pastilla = await pastillaEnLaLista(programada.id, fechaDeLaProgramada, rol);
      const despues = ahoraArgentina();
      unoDe(linea, (ahora) => lineaDelCorreo(parametros(ahora)), antes, despues, `la línea (${rol})`);
      unoDe(pastilla, (ahora) => pastillaDelEnvio({ ...parametros(ahora), admin: rol === 'admin' }), antes, despues,
        `la pastilla (${rol})`);
      assert.equal(pastilla.tipo, 'programada', rol);
    }
    await prender(false);
    // El recibo de un 200 dice lo de ese momento: con el envío apagado, en espera y sin instante
    const repetida = await enviar(partesDePrueba(edicionDePrueba({ fecha_edicion: fechaDeLaProgramada })), { ip: 46 });
    assert.equal(repetida.status, 200, JSON.stringify(repetida.body));
    assert.deepEqual(repetida.body.data.envio,
      { estado: 'programada', programado_at: null, texto: 'En espera: el envío automático está apagado.' });
    for (const rol of ['admin', 'lector']) {
      assert.equal(await lineaDelDetalle(programada.id, rol), 'En espera: el envío automático está apagado.', rol);
      assert.deepEqual(await pastillaEnLaLista(programada.id, fechaDeLaProgramada, rol),
        { tipo: 'espera', texto: 'En espera' }, rol);
    }
  });

  it('una que salió y a una persona no le llegó: administración ve «Enviada a 3 de 4» y los demás roles, «Enviada el …»; sin direcciones', async () => {
    const fecha = '2026-11-05';
    const id = (await edicionGuardada(`dq:regular:${fecha}`)).id;
    cuarta = (await query(
      `INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo)
       VALUES (?, 'sin-uso', 'Persona Cuatro Ejemplo', 'persona.cuatro@ejemplo.test', 'lector', 0)`,
      [`test_cuarta_${crypto.randomBytes(4).toString('hex')}`]
    )).insertId;
    await query(
      `UPDATE dato_quincena_correos SET estado = 'parcial', motivo = NULL, enviada_at = '2026-11-05 08:05:10'
       WHERE edicion_id = ?`,
      [id]
    );
    const automatico = (usuarioId, email, estado, intentos, enviadoAt) => [id, usuarioId, email, 'automatico', estado, intentos,
      enviadoAt, enviadoAt ?? '2026-11-06 08:05:20', estado === 'fallido' ? 'No se pudo enviar el mail.' : null,
      '2026-11-05 08:05:00'];
    await query(
      `INSERT INTO dato_quincena_envios
         (edicion_id, usuario_id, email, tipo, estado, intentos, enviado_at, ultimo_intento_at, error, creado_at) VALUES ?`,
      [[
        automatico(usuarios.admin.id, 'persona.uno@ejemplo.test', 'enviado', 1, '2026-11-05 08:05:10'),
        automatico(usuarios.lector.id, 'persona.dos@ejemplo.test', 'enviado', 1, '2026-11-05 08:05:11'),
        automatico(usuarios.colaborador.id, 'persona.tres@ejemplo.test', 'enviado', 1, '2026-11-05 08:05:12'),
        automatico(cuarta, 'persona.cuatro@ejemplo.test', 'fallido', 3, null)
      ]]
    );

    assert.deepEqual(await pastillaEnLaLista(id, fecha, 'admin'), { tipo: 'parcial', texto: 'Enviada a 3 de 4' });
    for (const rol of ['lector', 'colaborador']) {
      assert.deepEqual(await pastillaEnLaLista(id, fecha, rol), { tipo: 'enviada', texto: 'Enviada el jue 05/11' }, rol);
    }
    for (const rol of ['admin', 'lector', 'colaborador']) {
      assert.equal(await lineaDelDetalle(id, rol), 'Enviada por correo el jueves 05/11/2026 a las 8:05.', rol);
    }
    // La lista y el detalle no traen las direcciones ni los nombres de quienes lo recibieron (spec 12 y 15)
    for (const rol of ['admin', 'lector']) {
      const lista = JSON.stringify((await leer('/dato-quincena/ediciones?anio=2026', rol)).body);
      const detalle = JSON.stringify((await leer(`/dato-quincena/ediciones/${id}`, rol)).body);
      for (const [nombre, texto] of [['la lista', lista], ['el detalle', detalle]]) {
        for (const dato of ['@ejemplo.test', 'Persona Cuatro', usuarios.admin.email, usuarios.lector.username]) {
          assert.ok(!texto.includes(dato), `${nombre} (${rol}) no trae «${dato}»`);
        }
      }
    }
  });

  it('una que el RPAD no mandó solo y se reenvió a toda la lista de hoy: «Reenviada…» para todos; quien está inactiva no cuenta', async () => {
    const fecha = '2026-11-06';
    const id = (await edicionGuardada(`dq:regular:${fecha}`)).id;
    assert.equal(await lineaDelDetalle(id), 'Correo enviado el 02/11/2026 a las 08:12, según Datito.', 'antes del reenvío');
    await query(
      `INSERT INTO dato_quincena_destinatarios (usuario_id, agregado_por, agregado_at)
       VALUES (?, ?, '2026-11-01 09:00:00'), (?, ?, '2026-11-01 09:00:00'), (?, ?, '2026-11-01 09:00:00')`,
      [usuarios.lector.id, usuarios.admin.id, usuarios.colaborador.id, usuarios.admin.id, cuarta, usuarios.admin.id]
    );
    const reenvio = (usuarioId, email) => [id, usuarioId, email, 'reenvio', 'enviado', 1, '2026-11-10 10:12:00',
      '2026-11-10 10:12:00', usuarios.admin.id, '2026-11-10 10:12:00'];
    await query(
      `INSERT INTO dato_quincena_envios
         (edicion_id, usuario_id, email, tipo, estado, intentos, enviado_at, ultimo_intento_at, creado_por, creado_at) VALUES ?`,
      [[reenvio(usuarios.lector.id, 'persona.dos@ejemplo.test'), reenvio(usuarios.colaborador.id, 'persona.tres@ejemplo.test')]]
    );
    for (const rol of ['admin', 'lector']) {
      assert.equal(await lineaDelDetalle(id, rol), 'Reenviada por correo el martes 10/11/2026 a las 10:12.', rol);
      assert.deepEqual(await pastillaEnLaLista(id, fecha, rol), { tipo: 'enviada', texto: 'Reenviada el mar 10/11' }, rol);
    }
    // La cuarta persona está en la lista pero inactiva: no se le puede reenviar, así que no cuenta. Activa, faltaría ella
    await query('UPDATE usuarios SET activo = 1 WHERE id = ?', [cuarta]);
    try {
      assert.equal(await lineaDelDetalle(id), 'Correo enviado el 02/11/2026 a las 08:12, según Datito.', 'con la cuarta activa');
    } finally {
      await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [cuarta]);
    }
  });

  it('las archivadas antes del correo (sin fila): la línea y la pastilla del correo de Datito; si no salió, sin pastilla', async () => {
    const deEnero = (await edicionGuardada(`dq:regular:${FECHA_DE_ENERO}`)).id;
    assert.equal(await correoGuardado(deEnero), null);
    for (const rol of ['admin', 'lector']) {
      assert.deepEqual(await pastillaEnLaLista(deEnero, FECHA_DE_ENERO, rol),
        { tipo: 'enviada', texto: 'Enviada por Datito el lun 02/11' }, rol);
      assert.equal(await lineaDelDetalle(deEnero, rol), 'Correo enviado el 02/11/2026 a las 08:12, según Datito.');
    }
    const sinCorreo = edicionDePrueba({ fecha_edicion: '2026-10-26', correo: { estado: 'no_enviado', enviado_at: null } });
    const id = (await query(
      `INSERT INTO dato_quincena_ediciones (clave, tipo, fecha_edicion, referencia_piloto, titulo, metadata, huella)
       VALUES ('dq:regular:2026-10-26', 'regular', '2026-10-26', NULL, ?, ?, ?)`,
      [sinCorreo.titulo, JSON.stringify(sinCorreo), 'e'.repeat(64)]
    )).insertId;
    assert.equal(await pastillaEnLaLista(id, '2026-10-26'), null);
    assert.equal(await lineaDelDetalle(id), 'Datito archivó esta edición sin que saliera el correo.');
  });

  it('si la fila del correo no se puede guardar, no se guarda nada: 500 «No se pudo guardar la edición.» (la misma transacción)', async () => {
    await prender(true);
    const fecha = sumarDias(hoyArgentina(), 1);
    const partes = partesDePrueba(edicionDePrueba({ fecha_edicion: fecha }));
    const guardado = await todoLoGuardado();
    await query('RENAME TABLE dato_quincena_correos TO dato_quincena_correos_fuera');
    let res;
    try {
      res = await enviar(partes, { ip: 45 });
    } finally {
      await query('RENAME TABLE dato_quincena_correos_fuera TO dato_quincena_correos');
    }
    assert.equal(res.status, 500, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: false, error: 'No se pudo guardar la edición.' });
    assert.deepEqual(await todoLoGuardado(), guardado);

    // Con la tabla de vuelta, la misma entra: programada para la mañana del primer día hábil desde su fecha
    const antes = ahoraArgentina();
    const otra = await enviar(partes, { ip: 45 });
    const despues = ahoraArgentina();
    assert.equal(otra.status, 201, JSON.stringify(otra.body));
    unoDe(otra.body.data.envio, envioDeLaProgramada(fecha), antes, despues, 'el envío de la de mañana');
    assert.match(otra.body.data.envio.programado_at, /T08:05:00-03:00$/);
    assert.equal((await correoGuardado(otra.body.data.id)).estado, 'programada');
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
    for (const recibido of ['Un título inventado', 'ñandú', 'Cálculos de prueba', 'infografia-prueba.png', 'infografia-prueba.svg',
      'Efeméride de prueba', 'inventado']) {
      assert.ok(!consola.includes(recibido), 'la consola no repite lo recibido');
    }
  });
});
