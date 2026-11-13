// Las rutas de administración del correo del dato de la quincena (spec 2026-11-12-dato-quincena-correo, 9, 12 y 15;
// controllers/datoQuincenaCorreoController.js): la configuración (el envío automático, las próximas ediciones y quién lo recibe),
// la caja del correo de cada edición, «Reenviar» y «Enviarme una prueba». Contra una base de prueba propia, con la precarga de
// feriados (el lunes 23/11/2026 es feriado), la app real y Mailpit; un segundo servidor con el SMTP en un puerto cerrado para lo
// que no sale. Las ediciones llegan por guardarEdicion (el mismo camino que el POST del bot) y sus envíos se arman con SQL. Las
// personas («PruebaUno Ejemplo») y sus casillas (@ejemplo.test) son inventadas y cambian en cada test. Nunca /api/cron/*: la
// corrida, cuando hace falta, se llama al servicio con un ahora fijo.
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  crearBaseDePrueba, correrSqlEnBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, cerrarDb, query, db, mailpit,
  paraCasilla, MAILPIT_URL
} from './helpers.js';
import { edicionDePrueba, pilotoDePrueba, partesDePrueba, svgDePrueba } from './dato-quincena-fixtures.js';
import { FILAS_PRECARGA } from './fixtures/feriados-precarga.js';
import { claveDeEdicion, filasDeLaEdicion, huellaDelPaquete } from '../services/datoQuincenaReglas.js';
import {
  MENSAJES_CORREO, proximasEdiciones, lineaDelCorreo, textoDeLaLicencia, textoDelReenvio, textoDeLosQueReciben
} from '../services/datoQuincenaCorreoReglas.js';
import { calendarioCon } from '../services/feriadosReglas.js';
import { hoyArgentina, ahoraArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';
import { sendEmail } from '../services/emailService.js';

const NO_EXISTE = { success: false, error: 'No existe esa edición.' };
const RECHAZOS = Object.fromEntries(Object.entries(MENSAJES_CORREO).map(([clave, error]) => [clave, { success: false, error }]));
const TABLAS = ['dato_quincena_envios', 'dato_quincena_correos', 'dato_quincena_destinatarios', 'dato_quincena_adjuntos',
  'dato_quincena_propuestas', 'dato_quincena_ediciones', 'usuarios_licencias'];
// Las seis rutas, con un id que existe (`:id`) o no
const SEIS = (id) => [['GET', '/dato-quincena/correo'], ['PUT', '/dato-quincena/correo/envio'],
  ['PUT', '/dato-quincena/correo/destinatarios'], ['GET', `/dato-quincena/ediciones/${id}/correo`],
  ['POST', `/dato-quincena/ediciones/${id}/reenvios`], ['POST', `/dato-quincena/ediciones/${id}/prueba`]];

let base, dbReal, emailSoloA, servidor, sinCorreo, api, apiSinCorreo, usuarios, servicio, datos, feriadosDatos, pool;

before(async () => {
  dbReal = process.env.DB_NAME;
  emailSoloA = process.env.EMAIL_SOLO_A;
  base = await crearBaseDePrueba('rpad_test_dato_quincena_correo_api');
  await correrSqlEnBaseDePrueba(base.nombre, 'database/updates/migracion-feriados-datos.sql');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  // El segundo, con el SMTP en un puerto cerrado: ningún mail sale
  [servidor, sinCorreo] = await Promise.all([
    iniciarServidor({ env: { DB_NAME: base.nombre } }),
    iniciarServidor({ env: { DB_NAME: base.nombre, SMTP_PORT: '1' } })
  ]);
  api = crearCliente(servidor.url);
  apiSinCorreo = crearCliente(sinCorreo.url);
  usuarios = await crearUsuariosPrueba(api, {
    admin: 'admin', editor: 'editor', superadmin: 'superadmin', lector: 'lector', colaborador: 'colaborador'
  });
  // Usan el pool: se importan después de apuntar DB_NAME a la base de prueba
  servicio = await import('../services/datoQuincenaCorreo.js');
  datos = await import('../services/datoQuincenaDatos.js');
  feriadosDatos = await import('../services/feriadosDatos.js');
  pool = (await import('../config/database.js')).default;
});

after(async () => {
  await pool?.end();
  await cerrarDb();
  await Promise.all([servidor?.detener(), sinCorreo?.detener()]);
  if (emailSoloA === undefined) delete process.env.EMAIL_SOLO_A;
  else process.env.EMAIL_SOLO_A = emailSoloA;
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  for (const tabla of TABLAS) await query(`DELETE FROM ${tabla}`);
  await query("DELETE FROM usuarios WHERE username LIKE 't_dqc_%'");
  await query(
    `INSERT INTO dato_quincena_correo_config (id, envio_activo) VALUES (1, 0)
     ON DUPLICATE KEY UPDATE envio_activo = 0, cambiado_por = NULL, cambiado_at = NULL, corrida_inicio_at = NULL,
       corrida_fin_at = NULL, corrida_resultado = NULL, corrida_con_errores = 0`
  );
  for (const usuario of Object.values(usuarios)) {
    await query('UPDATE usuarios SET email = ? WHERE id = ?', [usuario.email, usuario.id]);
  }
  await mailpit.vaciar();
});

const pedir = (cliente, metodo, ruta, rol, body = {}) => {
  const opciones = { token: rol === null ? undefined : usuarios[rol].token };
  if (metodo === 'GET') return cliente.get(ruta, opciones);
  return metodo === 'POST' ? cliente.post(ruta, body, opciones) : cliente.put(ruta, body, opciones);
};
const leer = (ruta, rol = 'admin') => pedir(api, 'GET', ruta, rol);

const sufijo = () => crypto.randomBytes(3).toString('hex');

// Una persona con su casilla inventada; `clave` arma su nombre («PruebaUno Ejemplo»)
const persona = async ({ clave, activo = 1, rol = 'lector', cargo = null }) => {
  const username = `t_dqc_${sufijo()}`;
  const email = `${username}@ejemplo.test`;
  const { insertId: id } = await query(
    `INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, cargo, activo)
     VALUES (?, 'x', ?, ?, ?, ?, ?)`,
    [username, `Prueba${clave} Ejemplo`, email, rol, cargo, activo]
  );
  return { id, email, nombre: `Prueba${clave} Ejemplo` };
};
const aLaLista = async (...personas) => {
  for (const quien of personas) {
    await query("INSERT INTO dato_quincena_destinatarios (usuario_id, agregado_at) VALUES (?, '2026-11-01 09:00:00')", [quien.id]);
  }
};
const prender = (activo) => query('UPDATE dato_quincena_correo_config SET envio_activo = ? WHERE id = 1', [activo ? 1 : 0]);

// Llega una edición por el mismo camino que el POST (guardarEdicion), con el interruptor como esté: una regular queda
// programada o no enviada. Devuelve `{ id, tipo, fecha_edicion }`
const llega = async (fecha_edicion, { piloto = false, ahora = `${hoyArgentina()} 07:30:00` } = {}) => {
  const edicion = piloto
    ? pilotoDePrueba({ fecha_edicion, referencia_piloto: `piloto-${sufijo()}` })
    : edicionDePrueba({ fecha_edicion, titulo: `El dato de la quincena del ${fecha_edicion}` });
  const partes = partesDePrueba(edicion, { infografia_svg: svgDePrueba() });
  const manifiesto = JSON.parse(partes.metadata.toString('utf8'));
  const { estado, id } = await datos.guardarEdicion({
    clave: claveDeEdicion(edicion),
    tipo: edicion.tipo,
    fecha_edicion,
    referencia_piloto: edicion.referencia_piloto,
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
  return { id, tipo: edicion.tipo, fecha_edicion };
};

// Las filas automáticas de una edición, ya mandadas: [persona, estado, intentos, enviado_at]
const automaticas = (id, filas) => query(
  `INSERT INTO dato_quincena_envios
     (edicion_id, usuario_id, email, tipo, estado, intentos, enviado_at, ultimo_intento_at, error, creado_at) VALUES ?`,
  [filas.map(([quien, estado, intentos, enviadoAt = null]) => [id, quien.id, quien.email, 'automatico', estado, intentos,
    enviadoAt, intentos > 0 ? (enviadoAt ?? '2026-11-24 08:05:00') : null,
    estado === 'fallido' ? MENSAJES_CORREO.envioFallido : null, '2026-11-24 08:05:00'])]
);
const guardarCorreo = (id, estado, enviadaAt = null) => query(
  'UPDATE dato_quincena_correos SET estado = ?, motivo = NULL, enviada_at = ? WHERE edicion_id = ?', [estado, enviadaAt, id]
);

const correoGuardado = async (id) => (await query(
  `SELECT estado, motivo, DATE_FORMAT(enviada_at, '%Y-%m-%d %H:%i:%s') AS enviada_at,
          DATE_FORMAT(ultima_corrida_at, '%Y-%m-%d %H:%i:%s') AS ultima_corrida_at
   FROM dato_quincena_correos WHERE edicion_id = ?`, [id]
))[0] ?? null;
// Las filas que no son automáticas: [persona, email, tipo, estado, intentos, creado_por, error]
const aMano = async (id) => (await query(
  `SELECT usuario_id, email, tipo, estado, intentos, creado_por, error, unico,
          DATE_FORMAT(enviado_at, '%Y-%m-%d %H:%i:%s') AS enviado_at
   FROM dato_quincena_envios WHERE edicion_id = ? AND tipo <> 'automatico' ORDER BY id`, [id]
)).map((fila) => ({ ...fila, usuario_id: Number(fila.usuario_id), intentos: Number(fila.intentos),
  creado_por: fila.creado_por === null ? null : Number(fila.creado_por) }));
const cuantasFilas = async () => Number((await query('SELECT COUNT(*) AS n FROM dato_quincena_envios'))[0].n);
const laLista = async () => (await query(
  `SELECT usuario_id, agregado_por, DATE_FORMAT(agregado_at, '%Y-%m-%d %H:%i:%s') AS agregado_at
   FROM dato_quincena_destinatarios ORDER BY usuario_id`
)).map((fila) => ({ usuario_id: Number(fila.usuario_id), agregado_por: fila.agregado_por === null ? null : Number(fila.agregado_por),
  agregado_at: fila.agregado_at }));
const laConfig = async () => (await query(
  `SELECT envio_activo, cambiado_por, DATE_FORMAT(cambiado_at, '%Y-%m-%d %H:%i:%s') AS cambiado_at
   FROM dato_quincena_correo_config WHERE id = 1`
))[0];

const recibidos = async (email) => (await mailpit.mensajes()).filter(paraCasilla(email));
const esperarDe = async (email, cantidad = 1) => {
  let mensajes = await recibidos(email);
  for (let intento = 0; intento < 50 && mensajes.length < cantidad; intento++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    mensajes = await recibidos(email);
  }
  return mensajes;
};
// Que no llegue nada más: espera un poco y cuenta todo lo de Mailpit
const sinMasMails = async (cantidad) => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal((await mailpit.mensajes()).length, cantidad, 'los mails de Mailpit');
};
const completo = async (id) => (await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)).json();

// El valor tiene que ser lo que arman las reglas con el hoy de antes o con el de después
const unoDe = (valor, armar, antes, despues, mensaje) => {
  const posibles = [armar(antes), armar(despues)];
  assert.ok(posibles.some((posible) => isDeepStrictEqual(posible, valor)),
    `${mensaje}: ${JSON.stringify(valor)} no es ninguno de ${JSON.stringify(posibles)}`);
};
const ddmmaaaa = (fecha) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;

describe('los permisos y lo que no existe', () => {
  it('sin sesión 401; el lector y el colaborador, 403 en las seis, sin que salga ni se anote nada', async () => {
    const edicion = await llega('2026-11-16');
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    for (const [metodo, ruta] of SEIS(edicion.id)) {
      const body = ruta.endsWith('/envio') ? { activo: true } : ruta.endsWith('/destinatarios') ? { usuarios: [] } : { a: 'todas' };
      assert.equal((await pedir(api, metodo, ruta, null, body)).status, 401, `${metodo} ${ruta}`);
      for (const rol of ['lector', 'colaborador']) {
        const res = await pedir(api, metodo, ruta, rol, body);
        assert.equal(res.status, 403, `${rol}: ${metodo} ${ruta}`);
        assert.ok(!JSON.stringify(res.body).includes('@'), 'sin direcciones');
      }
    }
    assert.equal((await laConfig()).envio_activo, 0);
    assert.deepEqual((await laLista()).map((fila) => fila.usuario_id), [uno.id]);
    assert.equal(await cuantasFilas(), 0);
    await sinMasMails(0);
  });

  it('404 «No existe esa edición.» con un id que no es un entero positivo o que no existe, en las tres de una edición', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '999999']) {
      for (const [metodo, ruta] of SEIS(id).slice(3)) {
        for (const rol of ['admin', 'editor']) {
          const res = await pedir(api, metodo, ruta, rol, { a: 'todas' });
          assert.equal(res.status, 404, `${rol}: ${metodo} ${ruta}`);
          assert.deepEqual(res.body, NO_EXISTE);
        }
      }
    }
    await sinMasMails(0);
  });
});

describe('la configuración (GET /dato-quincena/correo)', () => {
  it('el envío, las próximas ediciones y las personas activas: nombre, cargo, rol, email, si lo reciben y hasta cuándo están de licencia', async () => {
    const hoy = hoyArgentina();
    const uno = await persona({ clave: 'Uno', cargo: 'Cargo inventado' });
    const dos = await persona({ clave: 'Dos', rol: 'editor' });
    const tres = await persona({ clave: 'Tres' });
    const inactiva = await persona({ clave: 'Cuatro', activo: 0 });
    await aLaLista(uno, inactiva);
    // Dos, de licencia hoy (dos que se pisan: la que termina más tarde); Tres, con una anulada y otra que ya terminó
    const hasta = sumarDias(hoy, 10);
    await query(
      `INSERT INTO usuarios_licencias (usuario_id, desde, hasta, anulada) VALUES (?, ?, ?, 0), (?, ?, ?, 0), (?, ?, ?, 1),
         (?, ?, ?, 0)`,
      [dos.id, sumarDias(hoy, -2), sumarDias(hoy, 3), dos.id, sumarDias(hoy, -1), hasta, tres.id, sumarDias(hoy, -1),
        sumarDias(hoy, 5), tres.id, sumarDias(hoy, -9), sumarDias(hoy, -1)]
    );
    await llega('2026-11-09');
    await llega('2026-10-26');

    for (const rol of ['admin', 'editor', 'superadmin']) {
      const antes = hoyArgentina();
      const res = await leer('/dato-quincena/correo', rol);
      const despues = hoyArgentina();
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.success, true);
      assert.deepEqual(Object.keys(res.body.data), ['envio_activo', 'proximas', 'personas', 'reciben_texto']);
      const { envio_activo, proximas, personas, reciben_texto } = res.body.data;
      assert.equal(envio_activo, false);
      // El pie de «Quién lo recibe»: cuenta las personas activas que lo reciben (la inactiva de la lista no)
      assert.equal(reciben_texto, 'Lo recibe 1 persona.');
      assert.equal(reciben_texto, textoDeLosQueReciben(personas.filter((p) => p.recibe === true).length));
      // Las próximas, cada 14 días desde la última regular (09/11), con el calendario de la tabla y sus nombres
      unoDe(proximas, (dia) => proximasEdiciones({
        ultimaRegular: '2026-11-09', hoy: dia, calendario: calendarioCon(FILAS_PRECARGA), filasDeFeriados: FILAS_PRECARGA
      }), antes, despues, 'las próximas');
      assert.equal(proximas.length, 4);

      const deLaPrueba = personas.filter((p) => p.nombre.startsWith('Prueba'));
      assert.deepEqual(deLaPrueba, [
        { id: dos.id, nombre: dos.nombre, cargo: null, rol: 'Editor', email: dos.email, recibe: false,
          licencia: textoDeLaLicencia(hasta, hoy) },
        { id: tres.id, nombre: tres.nombre, cargo: null, rol: 'Lector', email: tres.email, recibe: false, licencia: null },
        { id: uno.id, nombre: uno.nombre, cargo: 'Cargo inventado', rol: 'Lector', email: uno.email, recibe: true, licencia: null }
      ]);
      assert.match(deLaPrueba[0].licencia, /^De licencia hasta el \d{2}\/\d{2}(\/\d{4})?$/);
      // Todas las activas (también las de la sesión), por nombre; la inactiva no, aunque esté en la lista
      assert.ok(personas.some((p) => p.id === usuarios.lector.id && p.rol === 'Lector'));
      assert.ok(!personas.some((p) => p.id === inactiva.id));
      const nombres = personas.map((p) => p.nombre);
      assert.deepEqual(nombres, [...nombres].sort((a, b) => a.localeCompare(b, 'es')));
    }
  });

  it('prendido, lo dice; sin regulares, las próximas desde el 09/11/2026; sin poder leer los feriados, ninguna y lo demás igual', async () => {
    await prender(true);
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    const antes = hoyArgentina();
    const res = await leer('/dato-quincena/correo', 'editor');
    const despues = hoyArgentina();
    assert.equal(res.body.data.envio_activo, true);
    unoDe(res.body.data.proximas, (dia) => proximasEdiciones({
      ultimaRegular: null, hoy: dia, calendario: calendarioCon(FILAS_PRECARGA), filasDeFeriados: FILAS_PRECARGA
    }), antes, despues, 'las próximas sin regulares');

    await query('RENAME TABLE feriados TO feriados_fuera');
    let caida;
    try {
      caida = await leer('/dato-quincena/correo', 'admin');
    } finally {
      await query('RENAME TABLE feriados_fuera TO feriados');
    }
    assert.equal(caida.status, 200, JSON.stringify(caida.body));
    assert.deepEqual(caida.body.data.proximas, []);
    assert.equal(caida.body.data.envio_activo, true);
    assert.deepEqual(caida.body.data.personas, res.body.data.personas);
  });
});

describe('el envío automático (PUT /dato-quincena/correo/envio)', () => {
  it('«true» como texto, un 1, nada o null: 400 y sigue como estaba, sin anotar a nadie', async () => {
    for (const body of [{ activo: 'true' }, { activo: 1 }, {}, { activo: null }, { activo: 'si' }]) {
      const res = await pedir(api, 'PUT', '/dato-quincena/correo/envio', 'admin', body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.deepEqual(res.body, RECHAZOS.envioInvalido);
    }
    assert.deepEqual(await laConfig(), { envio_activo: 0, cambiado_por: null, cambiado_at: null });
  });

  it('el true literal lo prende y anota quién y cuándo; false lo apaga (el editor también)', async () => {
    const antes = ahoraArgentina();
    const prendido = await pedir(api, 'PUT', '/dato-quincena/correo/envio', 'admin', { activo: true });
    const despues = ahoraArgentina();
    assert.equal(prendido.status, 200, JSON.stringify(prendido.body));
    assert.deepEqual(prendido.body, {
      success: true, data: { envio_activo: true }, message: 'El envío automático quedó prendido.'
    });
    const config = await laConfig();
    assert.equal(config.envio_activo, 1);
    assert.equal(Number(config.cambiado_por), usuarios.admin.id);
    assert.ok(config.cambiado_at >= antes && config.cambiado_at <= despues, `cambiado_at ${config.cambiado_at}: hora argentina`);
    assert.equal((await leer('/dato-quincena/correo')).body.data.envio_activo, true);

    const apagado = await pedir(api, 'PUT', '/dato-quincena/correo/envio', 'editor', { activo: false });
    assert.deepEqual(apagado.body, {
      success: true, data: { envio_activo: false }, message: 'El envío automático quedó apagado.'
    });
    assert.equal((await laConfig()).envio_activo, 0);
    assert.equal(Number((await laConfig()).cambiado_por), usuarios.editor.id);
  });

  it('sin la fila de la configuración, la crea', async () => {
    await query('DELETE FROM dato_quincena_correo_config WHERE id = 1');
    const res = await pedir(api, 'PUT', '/dato-quincena/correo/envio', 'admin', { activo: true });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await laConfig()).envio_activo, 1);
  });
});

describe('quién lo recibe (PUT /dato-quincena/correo/destinatarios)', () => {
  it('una lista que no sirve: 400 «La lista de personas no es válida.» y la lista sin cambios', async () => {
    const uno = await persona({ clave: 'Uno' });
    const dos = await persona({ clave: 'Dos' });
    const inactiva = await persona({ clave: 'Tres', activo: 0 });
    await aLaLista(uno);
    const antes = await laLista();
    const listas = ['todas', null, [uno.id, uno.id], [uno.id, String(uno.id)], [0], [-1], [1.5], [true], [null],
      [dos.id, inactiva.id], [dos.id, 999999]];
    for (const body of [{}, ...listas.map((lista) => ({ usuarios: lista }))]) {
      const res = await pedir(api, 'PUT', '/dato-quincena/correo/destinatarios', 'admin', body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.deepEqual(res.body, RECHAZOS.listaInvalida);
    }
    assert.deepEqual(await laLista(), antes);
  });

  it('la reemplaza: quien sigue conserva cuándo y quién lo sumó, quien entra lleva a quien guarda y la hora, quien sale (también una inactiva) sale', async () => {
    const uno = await persona({ clave: 'Uno' });
    const dos = await persona({ clave: 'Dos' });
    const tres = await persona({ clave: 'Tres' });
    const inactiva = await persona({ clave: 'Cuatro', activo: 0 });
    await aLaLista(uno, dos, inactiva);

    const antes = ahoraArgentina();
    const res = await pedir(api, 'PUT', '/dato-quincena/correo/destinatarios', 'admin', { usuarios: [tres.id, uno.id] });
    const despues = ahoraArgentina();
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, {
      success: true, data: { usuarios: [uno.id, tres.id].sort((a, b) => a - b) }, message: 'Se guardó la lista: lo reciben 2 personas.'
    });
    const lista = await laLista();
    assert.deepEqual(lista.map((fila) => fila.usuario_id), [uno.id, tres.id].sort((a, b) => a - b));
    assert.deepEqual(lista.find((fila) => fila.usuario_id === uno.id),
      { usuario_id: uno.id, agregado_por: null, agregado_at: '2026-11-01 09:00:00' }, 'quien sigue, como estaba');
    const nueva = lista.find((fila) => fila.usuario_id === tres.id);
    assert.equal(nueva.agregado_por, usuarios.admin.id);
    assert.ok(nueva.agregado_at >= antes && nueva.agregado_at <= despues, `agregado_at ${nueva.agregado_at}: hora argentina`);
    assert.deepEqual((await leer('/dato-quincena/correo')).body.data.personas.filter((p) => p.recibe).map((p) => p.id).sort(),
      [uno.id, tres.id].sort());

    const uno2 = await pedir(api, 'PUT', '/dato-quincena/correo/destinatarios', 'editor', { usuarios: [String(uno.id)] });
    assert.equal(uno2.body.message, 'Se guardó la lista: lo recibe 1 persona.');
    assert.deepEqual(await laLista(), [{ usuario_id: uno.id, agregado_por: null, agregado_at: '2026-11-01 09:00:00' }]);
    const vacia = await pedir(api, 'PUT', '/dato-quincena/correo/destinatarios', 'editor', { usuarios: [] });
    assert.deepEqual(vacia.body, { success: true, data: { usuarios: [] }, message: 'Se guardó la lista: no lo recibe nadie.' });
    assert.deepEqual(await laLista(), []);
  });
});

describe('la caja del correo de una edición (GET /dato-quincena/ediciones/:id/correo)', () => {
  it('una que salió: el resumen, la línea, cada persona con su texto, los reenvíos y las pruebas, si se puede reenviar y la lista de hoy; sin direcciones', async () => {
    const uno = await persona({ clave: 'Uno' });
    const dos = await persona({ clave: 'Dos' });
    const tres = await persona({ clave: 'Tres' });
    const cuatro = await persona({ clave: 'Cuatro', activo: 0 });
    await aLaLista(uno, dos, cuatro);
    const { id } = await llega('2026-11-23', { ahora: '2026-11-23 07:30:00' });
    await guardarCorreo(id, 'parcial', '2026-11-24 08:05:10');
    await automaticas(id, [[uno, 'enviado', 1, '2026-11-24 08:05:10'], [dos, 'fallido', 3], [tres, 'licencia', 0]]);
    const manual = (quien, tipo, estado, creadoAt, enviadoAt, por) => [id, quien.id, quien.email, tipo, estado, 1, enviadoAt,
      creadoAt, estado === 'fallido' ? MENSAJES_CORREO.envioFallido : null, por, creadoAt];
    await query(
      `INSERT INTO dato_quincena_envios
         (edicion_id, usuario_id, email, tipo, estado, intentos, enviado_at, ultimo_intento_at, error, creado_por, creado_at) VALUES ?`,
      [[
        manual({ id: usuarios.admin.id, email: usuarios.admin.email }, 'prueba', 'enviado', '2026-11-24 09:00:00',
          '2026-11-24 09:00:02', usuarios.admin.id),
        manual(dos, 'reenvio', 'fallido', '2026-11-24 10:00:00', null, usuarios.admin.id),
        manual(dos, 'reenvio', 'enviado', '2026-11-24 10:12:00', '2026-11-24 10:12:05', usuarios.editor.id)
      ]]
    );

    for (const rol of ['admin', 'editor']) {
      const res = await leer(`/dato-quincena/ediciones/${id}/correo`, rol);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(res.body, {
        success: true,
        data: {
          resumen: 'Enviada el martes 24/11/2026 a las 8:05, a 2 de 3 personas.',
          linea: 'Enviada por correo el martes 24/11/2026 a las 8:05.',
          personas: [
            { nombre: dos.nombre, texto: 'No se pudo enviar (3 intentos)', mal: true },
            { nombre: tres.nombre, texto: 'No se envió: de licencia', mal: true },
            { nombre: uno.nombre, texto: 'Enviado el 24/11 a las 8:05', mal: false }
          ],
          reenvios: [
            { texto: 'Prueba enviada a Test admin el 24/11 a las 9:00.' },
            { texto: `No se pudo reenviar a ${dos.nombre} el 24/11 a las 10:00.` },
            { texto: `Reenviada a ${dos.nombre} el 24/11 a las 10:12.` }
          ],
          se_puede_reenviar: true,
          lista_de_hoy: [{ id: dos.id, nombre: dos.nombre }, { id: uno.id, nombre: uno.nombre }]
        }
      });
      assert.ok(!JSON.stringify(res.body).includes('@'), 'sin direcciones');
    }
  });

  it('una programada, una con personas pendientes, un piloto y una sin envío del RPAD: lo que dice cada una y si se puede reenviar', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    await prender(true);
    const programada = await llega(hoyArgentina());
    const enCurso = await llega(sumarDias(hoyArgentina(), -1));
    await automaticas(enCurso.id, [[uno, 'pendiente', 0]]);
    const piloto = await llega(hoyArgentina(), { piloto: true });
    await prender(false);
    const apagada = await llega('2026-11-16');

    const caja = async (id) => (await leer(`/dato-quincena/ediciones/${id}/correo`)).body.data;
    const dePrograma = await caja(programada.id);
    assert.equal(dePrograma.resumen, 'Todavía no salió.');
    assert.equal(dePrograma.se_puede_reenviar, false);
    assert.deepEqual(dePrograma.personas, []);
    const deCurso = await caja(enCurso.id);
    assert.equal(deCurso.se_puede_reenviar, false);
    assert.deepEqual(deCurso.personas, [{ nombre: uno.nombre, texto: 'Pendiente', mal: false }]);
    const delPiloto = await caja(piloto.id);
    assert.equal(delPiloto.resumen, 'Los pilotos no se envían por correo.');
    assert.equal(delPiloto.linea, 'Los pilotos no se envían por correo.');
    assert.equal(delPiloto.se_puede_reenviar, false);
    const deApagada = await caja(apagada.id);
    assert.equal(deApagada.resumen, 'No se envió: el envío automático estaba apagado.');
    assert.equal(deApagada.se_puede_reenviar, true);
    assert.deepEqual(deApagada.lista_de_hoy, [{ id: uno.id, nombre: uno.nombre }]);
  });
});

describe('reenviar (POST /dato-quincena/ediciones/:id/reenvios)', () => {
  it('a quién: sin «a», con otra palabra, con alguien que no está en la lista o que está pero inactiva, 400; nada sale ni se anota', async () => {
    const uno = await persona({ clave: 'Uno' });
    const fuera = await persona({ clave: 'Dos' });
    const inactiva = await persona({ clave: 'Tres', activo: 0 });
    await aLaLista(uno, inactiva);
    const { id } = await llega('2026-11-16');
    for (const body of [{}, { a: 'todos' }, { a: 0 }, { a: [uno.id] }, { a: null }]) {
      const res = await pedir(api, 'POST', `/dato-quincena/ediciones/${id}/reenvios`, 'admin', body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.deepEqual(res.body, RECHAZOS.aQuien);
    }
    for (const a of [fuera.id, inactiva.id, 999999]) {
      const res = await pedir(api, 'POST', `/dato-quincena/ediciones/${id}/reenvios`, 'admin', { a });
      assert.equal(res.status, 400, String(a));
      assert.deepEqual(res.body, RECHAZOS.noEstaEnLaLista);
    }
    await query('DELETE FROM dato_quincena_destinatarios');
    const vacia = await pedir(api, 'POST', `/dato-quincena/ediciones/${id}/reenvios`, 'admin', { a: 'todas' });
    assert.equal(vacia.status, 400);
    assert.deepEqual(vacia.body, RECHAZOS.listaVacia);
    assert.equal(await cuantasFilas(), 0);
    await sinMasMails(0);
  });

  it('una programada o con personas pendientes: 409 «todavía se está mandando sola»; un piloto: 409 «solo regulares»; nada sale', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    await prender(true);
    const programada = await llega(hoyArgentina());
    const enCurso = await llega(sumarDias(hoyArgentina(), -1));
    await automaticas(enCurso.id, [[uno, 'fallido', 1]]);
    const piloto = await llega(hoyArgentina(), { piloto: true });
    for (const { id } of [programada, enCurso]) {
      for (const a of ['todas', uno.id]) {
        const res = await pedir(api, 'POST', `/dato-quincena/ediciones/${id}/reenvios`, 'admin', { a });
        assert.equal(res.status, 409, JSON.stringify(res.body));
        assert.deepEqual(res.body, RECHAZOS.todaviaSeManda);
      }
    }
    const delPiloto = await pedir(api, 'POST', `/dato-quincena/ediciones/${piloto.id}/reenvios`, 'editor', { a: 'todas' });
    assert.equal(delPiloto.status, 409);
    assert.deepEqual(delPiloto.body, RECHAZOS.soloRegulares);
    assert.equal(await cuantasFilas(), 1, 'solo la automática del caso');
    assert.equal((await correoGuardado(programada.id)).estado, 'programada');
    await sinMasMails(0);
  });

  // A todas: un mail por persona de la lista de hoy, también de licencia, en el momento; la línea «Reenviada…»; el estado
  // guardado no cambia y la corrida no la manda
  it('a todas, una que el RPAD no mandó sola (apagado): «Reenviada…», y sigue no enviada', async () => {
    const uno = await persona({ clave: 'Uno' });
    const dos = await persona({ clave: 'Dos' });
    const inactiva = await persona({ clave: 'Tres', activo: 0 });
    await aLaLista(uno, dos, inactiva);
    await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)',
      [dos.id, sumarDias(hoyArgentina(), -1), sumarDias(hoyArgentina(), 1)]);
    const edicion = await llega('2026-11-16');
    const NO_ENVIADA = { estado: 'no_enviada', motivo: 'apagado', enviada_at: null, ultima_corrida_at: null };
    assert.deepEqual(await correoGuardado(edicion.id), NO_ENVIADA);
    const lineaAntes = (await leer(`/dato-quincena/ediciones/${edicion.id}`, 'lector')).body.data.correo;

    const res = await pedir(api, 'POST', `/dato-quincena/ediciones/${edicion.id}/reenvios`, 'admin', { a: 'todas' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, data: { enviados: 2, fallidos: 0 }, message: 'Se reenvió a 2 personas.' });

    for (const quien of [uno, dos]) {
      const mensajes = await esperarDe(quien.email);
      assert.equal(mensajes.length, 1, quien.nombre);
      assert.equal(mensajes[0].Subject, 'Dato de la Quincena - 16/11/2026');
      assert.deepEqual(mensajes[0].To.map((para) => para.Address), [quien.email]);
      const mail = await completo(mensajes[0].ID);
      assert.ok(mail.HTML.includes(`Buen día, Prueba${quien === uno ? 'Uno' : 'Dos'}.`));
      assert.deepEqual(mail.Attachments.map((parte) => [parte.FileName, parte.ContentType]),
        [['infografia-prueba.png', 'image/png'], ['infografia-prueba.svg', 'image/svg+xml']]);
    }
    await sinMasMails(2);

    const filas = await aMano(edicion.id);
    assert.deepEqual(filas.map(({ usuario_id, email, tipo, estado, intentos, creado_por, error, unico }) => (
      { usuario_id, email, tipo, estado, intentos, creado_por, error, unico })), [uno, dos].map((quien) => ({
      usuario_id: quien.id, email: quien.email, tipo: 'reenvio', estado: 'enviado', intentos: 1, creado_por: usuarios.admin.id,
      error: null, unico: null
    })));
    assert.ok(filas.every((fila) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(fila.enviado_at)));
    assert.deepEqual(await correoGuardado(edicion.id), NO_ENVIADA, 'el estado guardado no cambia');

    // La línea que ven todos: «Reenviada por correo el …» con la hora del último que completó la lista
    const linea = (await leer(`/dato-quincena/ediciones/${edicion.id}`, 'lector')).body.data.correo;
    assert.notEqual(linea, lineaAntes);
    const ultima = filas.map((fila) => fila.enviado_at).sort().at(-1);
    assert.equal(linea, lineaDelCorreo({
      tipo: 'regular', fecha_edicion: '2026-11-16', correo: { estado: 'no_enviada', motivo: 'apagado', enviada_at: null },
      reenvios: filas, lista: [{ usuario_id: uno.id, agregado_at: '2026-11-01 09:00:00' },
        { usuario_id: dos.id, agregado_at: '2026-11-01 09:00:00' }],
      envioActivo: false, ahora: ahoraArgentina(), calendario: calendarioCon(FILAS_PRECARGA)
    }));
    assert.match(linea, /^Reenviada por correo el [a-záéíóú]+ \d{2}\/\d{2}\/\d{4} a las \d{1,2}:\d{2}\.$/);
    assert.ok(linea.includes(ddmmaaaa(ultima.slice(0, 10))));
    const caja = (await leer(`/dato-quincena/ediciones/${edicion.id}/correo`)).body.data;
    assert.equal(caja.reenvios.length, 2);
    assert.ok(caja.reenvios.every(({ texto }) => texto.startsWith('Reenviada a Prueba')));
    assert.equal(caja.se_puede_reenviar, true);

    // Con el envío prendido, una corrida de un día hábil no la manda sola
    await prender(true);
    const calendario = await feriadosDatos.leerCalendario();
    const corrida = await servicio.ejecutarCorreoDelDatoQuincena({ ahora: '2026-11-24 08:05:00', calendario });
    assert.equal(corrida.enviados, 0);
    assert.equal((await correoGuardado(edicion.id)).estado, 'no_enviada');
    await sinMasMails(2);
  });

  // A quien no le había llegado deja de contar como falla; la línea sigue «Enviada por correo…» y la última corrida no cambia
  it('una que salió sola: un reenvío a quien no le llegó la pasa de parcial a enviada', async () => {
    const uno = await persona({ clave: 'Uno' });
    const dos = await persona({ clave: 'Dos' });
    await aLaLista(uno, dos);
    const { id } = await llega('2026-11-23', { ahora: '2026-11-23 07:30:00' });
    await automaticas(id, [[uno, 'enviado', 1, '2026-11-24 08:05:10'], [dos, 'fallido', 3]]);
    await query(
      `UPDATE dato_quincena_correos SET estado = 'parcial', enviada_at = '2026-11-24 08:05:10',
         ultima_corrida_at = '2026-11-25 08:05:00' WHERE edicion_id = ?`, [id]
    );

    const res = await pedir(api, 'POST', `/dato-quincena/ediciones/${id}/reenvios`, 'editor', { a: dos.id });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, data: { enviados: 1, fallidos: 0 }, message: 'Se reenvió a 1 persona.' });
    assert.equal((await esperarDe(dos.email)).length, 1);
    await sinMasMails(1);
    assert.deepEqual(await correoGuardado(id), {
      estado: 'enviada', motivo: null, enviada_at: '2026-11-24 08:05:10', ultima_corrida_at: '2026-11-25 08:05:00'
    });
    const enviada = 'Enviada por correo el martes 24/11/2026 a las 8:05.';
    assert.equal((await leer(`/dato-quincena/ediciones/${id}`, 'lector')).body.data.correo, enviada);
    assert.equal((await leer(`/dato-quincena/ediciones/${id}/correo`)).body.data.resumen,
      'Enviada el martes 24/11/2026 a las 8:05, a 2 personas.');

    const aTodas = await pedir(api, 'POST', `/dato-quincena/ediciones/${id}/reenvios`, 'admin', { a: 'todas' });
    assert.deepEqual(aTodas.body.data, { enviados: 2, fallidos: 0 });
    assert.equal((await esperarDe(uno.email)).length, 1);
    assert.equal((await esperarDe(dos.email, 2)).length, 2);
    assert.equal((await leer(`/dato-quincena/ediciones/${id}`, 'lector')).body.data.correo, enviada, 'no pasa a «Reenviada…»');
    assert.equal((await aMano(id)).length, 3);
  });

  it('una que ya no está vigente, con reintentos abiertos: se puede reenviar, queda cerrada y la corrida no la manda', async () => {
    const uno = await persona({ clave: 'Uno' });
    const dos = await persona({ clave: 'Dos' });
    await aLaLista(uno, dos);
    await prender(true);
    const { id } = await llega('2026-10-26', { ahora: '2026-10-26 07:30:00' });
    await automaticas(id, [[uno, 'fallido', 1], [dos, 'fallido', 1]]);
    assert.equal((await correoGuardado(id)).estado, 'programada');
    assert.equal((await leer(`/dato-quincena/ediciones/${id}/correo`)).body.data.se_puede_reenviar, true);

    const res = await pedir(api, 'POST', `/dato-quincena/ediciones/${id}/reenvios`, 'admin', { a: uno.id });
    assert.deepEqual(res.body.data, { enviados: 1, fallidos: 0 });
    assert.equal((await correoGuardado(id)).estado, 'parcial', 'cerrada: a dos no le llegó');
    const caja = (await leer(`/dato-quincena/ediciones/${id}/correo`)).body.data;
    assert.deepEqual(caja.personas.map(({ texto }) => texto), ['No se pudo enviar (1 intento)', 'No se pudo enviar (1 intento)']);

    const enviar = mock.fn(sendEmail);
    const calendario = await feriadosDatos.leerCalendario();
    const corrida = await servicio.ejecutarCorreoDelDatoQuincena({ ahora: '2026-11-24 08:05:00', calendario, enviar });
    assert.equal(enviar.mock.callCount(), 0);
    assert.equal(corrida.enviados + corrida.fallidos, 0);
    await sinMasMails(1);
  });

  it('con el candado de la corrida tomado: 409 «Ahora se está mandando…» en el reenvío y en la prueba; nada sale ni se anota', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    const { id } = await llega('2026-11-16');
    const conexion = await db().getConnection();
    try {
      await conexion.query("SELECT GET_LOCK('rpad_dato_quincena_correo', 10)");
      for (const ruta of [`/dato-quincena/ediciones/${id}/reenvios`, `/dato-quincena/ediciones/${id}/prueba`]) {
        const res = await pedir(api, 'POST', ruta, 'admin', { a: 'todas' });
        assert.equal(res.status, 409, ruta);
        assert.deepEqual(res.body, RECHAZOS.ocupado);
      }
    } finally {
      await conexion.query("SELECT RELEASE_LOCK('rpad_dato_quincena_correo')");
      conexion.release();
    }
    assert.equal(await cuantasFilas(), 0);
    await sinMasMails(0);
  });

  it('si a una persona no le llega: «Se reenvió a 1 de 2 personas: a 1 no le llegó.», su fila fallida con el texto fijo, sin direcciones', async () => {
    const uno = await persona({ clave: 'Uno' });
    const dos = await persona({ clave: 'Dos' });
    await aLaLista(uno, dos);
    const edicion = await llega('2026-11-16');
    const enviar = async (mail) => (mail.to.includes(dos.email)
      ? { success: false, error: `Falla simulada para ${dos.email}` }
      : sendEmail(mail));
    const errores = mock.method(console, 'error', () => {});
    let resultado;
    try {
      resultado = await servicio.reenviar({ edicion, a: 'todas', creadoPor: usuarios.admin.id, enviar });
    } finally {
      errores.mock.restore();
    }
    assert.deepEqual(resultado, { estado: 'hecho', enviados: 1, fallidos: 1 });
    assert.equal(textoDelReenvio(resultado), 'Se reenvió a 1 de 2 personas: a 1 no le llegó.');
    const conArroba = errores.mock.calls.some((llamada) => llamada.arguments.some((arg) => String(arg).includes('@')));
    assert.ok(!conArroba, 'la consola, sin direcciones');
    assert.deepEqual((await aMano(edicion.id)).map(({ usuario_id, estado, error }) => [usuario_id, estado, error]),
      [[uno.id, 'enviado', null], [dos.id, 'fallido', MENSAJES_CORREO.envioFallido]]);
    const caja = (await leer(`/dato-quincena/ediciones/${edicion.id}/correo`)).body.data;
    assert.ok(caja.reenvios[1].texto.startsWith(`No se pudo reenviar a ${dos.nombre}`));
    // Sin uno de los dos, no es «a toda la lista»
    assert.notEqual((await leer(`/dato-quincena/ediciones/${edicion.id}`)).body.data.correo.slice(0, 9), 'Reenviada');
  });

  // Un reenvío cortado a mitad de camino no da 500: si con 500 se repitiera, a la primera persona le llegaría dos veces. La base
  // rechaza la fila de la segunda (un trigger: no se puede anotar antes de mandarlo, así que a ella no sale); las otras dos lo
  // reciben, la respuesta cuenta 2 de 3 y el estado de la edición se recalcula igual
  it('si a mitad del reenvío no se puede anotar a una persona: 200 «a 2 de 3», a las otras dos les llega y el estado se recalcula', async () => {
    const uno = await persona({ clave: 'Uno' });
    const dos = await persona({ clave: 'Dos' });
    const tres = await persona({ clave: 'Tres' });
    await aLaLista(uno, dos, tres);
    const { id } = await llega('2026-11-23', { ahora: '2026-11-23 07:30:00' });
    await automaticas(id, [[uno, 'enviado', 1, '2026-11-24 08:05:10'], [dos, 'enviado', 1, '2026-11-24 08:05:11'],
      [tres, 'fallido', 3]]);
    await query(
      `UPDATE dato_quincena_correos SET estado = 'parcial', enviada_at = '2026-11-24 08:05:10',
         ultima_corrida_at = '2026-11-25 08:05:00' WHERE edicion_id = ?`, [id]
    );
    await query('DROP TRIGGER IF EXISTS falla_simulada_dato_quincena_envios');
    await query(`CREATE TRIGGER falla_simulada_dato_quincena_envios BEFORE INSERT ON dato_quincena_envios FOR EACH ROW
      BEGIN
        IF NEW.usuario_id = ${Number(dos.id)} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falla simulada'; END IF;
      END`);
    let res;
    try {
      res = await pedir(api, 'POST', `/dato-quincena/ediciones/${id}/reenvios`, 'admin', { a: 'todas' });
    } finally {
      await query('DROP TRIGGER IF EXISTS falla_simulada_dato_quincena_envios');
    }
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, {
      success: true, data: { enviados: 2, fallidos: 1 }, message: 'Se reenvió a 2 de 3 personas: a 1 no le llegó.'
    });
    assert.equal((await esperarDe(uno.email)).length, 1);
    assert.equal((await esperarDe(tres.email)).length, 1);
    assert.equal((await recibidos(dos.email)).length, 0);
    await sinMasMails(2);
    assert.deepEqual((await aMano(id)).map(({ usuario_id, estado }) => [usuario_id, estado]),
      [[uno.id, 'enviado'], [tres.id, 'enviado']]);
    // A la tercera ahora le llegó: el recálculo corrió después de la falla y la edición pasa de parcial a enviada
    assert.equal((await correoGuardado(id)).estado, 'enviada');
    for (const quien of [uno, dos, tres]) assert.ok(!servidor.logs().includes(quien.email), 'la consola no trae la dirección');
  });

  it('sin SMTP: 502 «No se pudo reenviar: no le llegó a nadie.» con la cuenta, las filas fallidas y la consola sin direcciones', async () => {
    const uno = await persona({ clave: 'Uno' });
    const dos = await persona({ clave: 'Dos' });
    await aLaLista(uno, dos);
    const { id } = await llega('2026-11-16');
    const res = await pedir(apiSinCorreo, 'POST', `/dato-quincena/ediciones/${id}/reenvios`, 'admin', { a: 'todas' });
    assert.equal(res.status, 502, JSON.stringify(res.body));
    assert.deepEqual(res.body, {
      success: false, error: 'No se pudo reenviar: no le llegó a nadie.', data: { enviados: 0, fallidos: 2 }
    });
    assert.deepEqual((await aMano(id)).map(({ estado }) => estado), ['fallido', 'fallido']);
    for (const quien of [uno, dos]) assert.ok(!sinCorreo.logs().includes(quien.email), 'la consola no trae la dirección');
    await sinMasMails(0);
  });
});

describe('la prueba (POST /dato-quincena/ediciones/:id/prueba)', () => {
  it('a la casilla de quien la pide, con «[PRUEBA] » en el asunto, aunque el envío esté apagado; una fila prueba que no cambia el estado', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    const { id } = await llega('2026-11-16');
    const res = await pedir(api, 'POST', `/dato-quincena/ediciones/${id}/prueba`, 'admin');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, message: 'Te mandamos la prueba a tu casilla.' });
    const [mensaje] = await esperarDe(usuarios.admin.email);
    assert.equal(mensaje.Subject, '[PRUEBA] Dato de la Quincena - 16/11/2026');
    assert.deepEqual(mensaje.To.map((para) => para.Address), [usuarios.admin.email]);
    assert.ok((await completo(mensaje.ID)).HTML.includes('Buen día, Test.'));
    await sinMasMails(1);
    const [fila] = await aMano(id);
    assert.deepEqual({ ...fila, enviado_at: '·' }, {
      usuario_id: usuarios.admin.id, email: usuarios.admin.email, tipo: 'prueba', estado: 'enviado', intentos: 1,
      creado_por: usuarios.admin.id, error: null, unico: null, enviado_at: '·'
    });
    assert.equal((await aMano(id)).length, 1);
    assert.deepEqual(await correoGuardado(id), { estado: 'no_enviada', motivo: 'apagado', enviada_at: null, ultima_corrida_at: null });
    // La prueba no es un reenvío: la línea sigue igual
    assert.equal((await leer(`/dato-quincena/ediciones/${id}`)).body.data.correo,
      'Correo enviado el 02/11/2026 a las 08:12, según Datito.');
  });

  it('también de un piloto, a la casilla del editor', async () => {
    const { id } = await llega(hoyArgentina(), { piloto: true });
    const res = await pedir(api, 'POST', `/dato-quincena/ediciones/${id}/prueba`, 'editor');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const [mensaje] = await esperarDe(usuarios.editor.email);
    assert.equal(mensaje.Subject, `[PRUEBA] Dato de la Quincena - ${ddmmaaaa(hoyArgentina())}`);
    await sinMasMails(1);
  });

  it('sin un email válido en la cuenta: 400 y nada sale; sin SMTP, 502 con un texto fijo', async () => {
    const { id } = await llega('2026-11-16');
    await query('UPDATE usuarios SET email = ? WHERE id = ?', [`sin-arroba-${sufijo()}`, usuarios.superadmin.id]);
    const res = await pedir(api, 'POST', `/dato-quincena/ediciones/${id}/prueba`, 'superadmin');
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, RECHAZOS.sinEmailPropio);
    assert.equal(await cuantasFilas(), 0);

    const sinSmtp = await pedir(apiSinCorreo, 'POST', `/dato-quincena/ediciones/${id}/prueba`, 'admin');
    assert.equal(sinSmtp.status, 502);
    assert.deepEqual(sinSmtp.body, RECHAZOS.pruebaFallida);
    assert.deepEqual((await aMano(id)).map(({ tipo, estado }) => [tipo, estado]), [['prueba', 'fallido']]);
    await sinMasMails(0);
  });
});

describe('si falla la base', () => {
  it('500 con un mensaje fijo por operación, sin direcciones; nada sale', async () => {
    const uno = await persona({ clave: 'Uno' });
    await aLaLista(uno);
    const { id } = await llega('2026-11-16');
    const casos = [
      ['dato_quincena_destinatarios', 'GET', '/dato-quincena/correo', {}, 'Error al obtener el correo del dato de la quincena'],
      ['dato_quincena_correo_config', 'PUT', '/dato-quincena/correo/envio', { activo: true }, 'Error al cambiar el envío automático'],
      ['dato_quincena_destinatarios', 'PUT', '/dato-quincena/correo/destinatarios', { usuarios: [uno.id] }, 'Error al guardar la lista'],
      ['dato_quincena_envios', 'GET', `/dato-quincena/ediciones/${id}/correo`, {}, 'Error al obtener el correo de la edición'],
      ['dato_quincena_envios', 'POST', `/dato-quincena/ediciones/${id}/reenvios`, { a: 'todas' }, 'Error al reenviar la edición'],
      ['dato_quincena_envios', 'POST', `/dato-quincena/ediciones/${id}/prueba`, {}, 'Error al mandar la prueba']
    ];
    for (const [tabla, metodo, ruta, body, mensaje] of casos) {
      await query(`RENAME TABLE ${tabla} TO ${tabla}_fuera`);
      let res;
      try {
        res = await pedir(api, metodo, ruta, 'admin', body);
      } finally {
        await query(`RENAME TABLE ${tabla}_fuera TO ${tabla}`);
      }
      assert.equal(res.status, 500, `${metodo} ${ruta}`);
      assert.deepEqual(res.body, { success: false, error: mensaje });
    }
    await sinMasMails(0);
    for (const linea of servidor.logs().split('\n').filter((texto) => texto.startsWith('Error al '))) {
      assert.ok(!linea.includes(uno.email), linea);
    }
  });
});
