// Utilidades compartidas por los tests de integración.
// Los tests levantan la app real (node app.js) en un puerto propio y usan la base
// de Docker local: crean usuarios y datasets de prueba y los borran al terminar.
import 'dotenv/config';
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MAILPIT_URL = process.env.MAILPIT_URL || 'http://localhost:8025';
export const PREFIJO_TEST = '[TEST]';

// =====================================================
// Protección: nunca correr contra producción
// =====================================================
export const verificarEntornoLocal = async () => {
  const errores = [];
  if (process.env.RPAD_TESTS_DB_LOCAL !== '1') {
    errores.push('RPAD_TESTS_DB_LOCAL=1 no está en .env (habilitarlo solo en la base Docker local)');
  }
  if (!['127.0.0.1', 'localhost'].includes(process.env.SMTP_HOST) || process.env.SMTP_PORT !== '1025') {
    errores.push('el SMTP no apunta a Mailpit (SMTP_HOST=127.0.0.1, SMTP_PORT=1025)');
  }
  try {
    const res = await fetch(`${MAILPIT_URL}/api/v1/info`);
    if (!res.ok) errores.push(`Mailpit respondió ${res.status} en ${MAILPIT_URL}`);
  } catch {
    errores.push(`Mailpit no responde en ${MAILPIT_URL} (¿docker compose up -d?)`);
  }
  if (errores.length > 0) {
    throw new Error(`Tests abortados para no tocar datos reales:\n  - ${errores.join('\n  - ')}`);
  }
};

// =====================================================
// Base de datos (solo para preparar y limpiar datos de prueba)
// =====================================================
let pool;
export const db = () => {
  pool ??= mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '3306'),
    connectionLimit: 4
  });
  return pool;
};

export const query = async (sql, params = []) => {
  const [rows] = await db().query(sql, params);
  return rows;
};

// IDs válidos de catálogos para armar datasets de prueba
export const catalogos = async () => {
  const [[area]] = await db().query('SELECT id FROM areas ORDER BY id LIMIT 1');
  const [[frecuencia]] = await db().query('SELECT id FROM frecuencias WHERE dias IS NOT NULL ORDER BY id LIMIT 1');
  const [[tema]] = await db().query('SELECT id FROM temas ORDER BY id LIMIT 1');
  const [[formato]] = await db().query('SELECT id FROM formatos WHERE activo = 1 ORDER BY id LIMIT 1');
  return { areaId: area.id, frecuenciaId: frecuencia.id, temaId: tema.id, formatoId: formato.id };
};

// Crea una base vacía a partir de database/schema.sql, para tests que necesitan datos controlados.
// El usuario de la app recibe permisos sobre ella.
const conexionRoot = () => mysql.createConnection({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: 'root',
  password: process.env.DB_ROOT_PASSWORD,
  multipleStatements: true
});

// Solo nombres rpad_test_*, nunca la base real (DB_NAME) y solo con la base en un host local.
// Se valida antes de abrir cualquier conexión, también al borrar.
const PATRON_BASE_PRUEBA = /^rpad_test_[a-z0-9_]+$/;

const validarDestinoBasePrueba = (nombre) => {
  if (!PATRON_BASE_PRUEBA.test(nombre)) {
    throw new Error(`Nombre de base de prueba inválido "${nombre}": debe coincidir con ${PATRON_BASE_PRUEBA}`);
  }
  if (nombre === process.env.DB_NAME) {
    throw new Error(`Nombre de base de prueba inválido "${nombre}": es la base real (DB_NAME)`);
  }
  if (!['127.0.0.1', 'localhost'].includes(process.env.DB_HOST)) {
    throw new Error('DB_HOST debe ser 127.0.0.1 o localhost para crear o borrar bases de prueba');
  }
};

export const crearBaseDePrueba = async (nombre) => {
  validarDestinoBasePrueba(nombre);
  await verificarEntornoLocal();
  if (!process.env.DB_ROOT_PASSWORD) throw new Error('Falta DB_ROOT_PASSWORD en .env (base Docker local)');
  const root = await conexionRoot();
  try {
    await root.query(`DROP DATABASE IF EXISTS \`${nombre}\``);
    await root.query(`CREATE DATABASE \`${nombre}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`USE \`${nombre}\``);
    await root.query(fs.readFileSync(path.join(ROOT, 'database', 'schema.sql'), 'utf8'));
    await root.query(`GRANT ALL PRIVILEGES ON \`${nombre}\`.* TO ?@'%'`, [process.env.DB_USER]);
  } finally {
    await root.end();
  }
  return {
    nombre,
    borrar: async () => {
      validarDestinoBasePrueba(nombre);
      const conexion = await conexionRoot();
      await conexion.query(`DROP DATABASE IF EXISTS \`${nombre}\``);
      await conexion.end();
    }
  };
};

// Corre un archivo SQL del repositorio tal cual (por ejemplo, una migración de datos) en una base de prueba creada con
// crearBaseDePrueba. El nombre se valida como al crearla o borrarla, antes de abrir la conexión; la ruta va desde la raíz del
// repositorio ('database/updates/migracion-feriados-datos.sql').
export const correrSqlEnBaseDePrueba = async (nombre, rutaDesdeLaRaiz) => {
  validarDestinoBasePrueba(nombre);
  const sql = fs.readFileSync(path.join(ROOT, rutaDesdeLaRaiz), 'utf8');
  const root = await conexionRoot();
  try {
    await root.query(`USE \`${nombre}\``);
    await root.query(sql);
  } finally {
    await root.end();
  }
};

// =====================================================
// Servidor
// =====================================================
// Cada servidor de prueba escucha en un puerto que estaba libre y se da por listo solo cuando SU proceso dice que escucha. Antes se
// sorteaba un puerto entre 31000 y 31999 y bastaba con que algo contestara /api/health: si el puerto ya era de otro servidor de prueba
// (el del mismo archivo, que sigue arriba), el nuevo moría con EADDRINUSE y el test le hablaba al otro (otra base, sin su EMAIL_SOLO_A).
const ESPERA_DEL_ARRANQUE = 20000;
const INTENTOS_DE_ARRANQUE = 3;

// Un puerto libre: el sistema da uno al escuchar en el puerto 0 (en todas las interfaces, como app.listen) y se suelta enseguida
const puertoLibre = () => new Promise((resolve, reject) => {
  const sonda = net.createServer();
  sonda.unref();
  sonda.once('error', reject);
  sonda.listen(0, () => {
    const { port } = sonda.address();
    sonda.close(() => resolve(port));
  });
});

// Arranca la app en `puerto` y resuelve cuando ese proceso escribe que escucha (app.js lo escribe en el callback de app.listen:
// "Servidor corriendo en puerto: N"). Si el proceso termina antes, rechaza enseguida con su salida (`enUso`: si fue porque el puerto
// ya estaba tomado); si en ESPERA_DEL_ARRANQUE no escuchó, lo termina y rechaza.
const arrancarEn = (puerto, env) => new Promise((resolve, reject) => {
  const salida = [];
  // EMAIL_SOLO_A vacío: los tests verifican los destinatarios reales en Mailpit
  const proceso = spawn(process.execPath, ['app.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(puerto), EMAIL_SOLO_A: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let escucha = false;
  const fallar = (mensaje, extra = {}) => {
    clearTimeout(reloj);
    reject(Object.assign(new Error(`${mensaje}:\n${salida.join('')}`), extra));
  };
  const reloj = setTimeout(() => {
    proceso.kill();
    fallar(`El servidor no escuchó en el puerto ${puerto} en ${ESPERA_DEL_ARRANQUE / 1000} s`);
  }, ESPERA_DEL_ARRANQUE);
  proceso.stdout.on('data', (d) => {
    salida.push(d.toString());
    if (escucha || !new RegExp(`puerto: ${puerto}\\b`).test(salida.join(''))) return;
    escucha = true;
    clearTimeout(reloj);
    resolve({ proceso, salida });
  });
  proceso.stderr.on('data', d => salida.push(d.toString()));
  // 'close', no 'exit': llega cuando stdout y stderr ya se cerraron, así el EADDRINUSE de stderr ya está en la salida y el reintento lo ve
  proceso.once('close', (codigo) => {
    if (!escucha) fallar(`El servidor terminó (código ${codigo}) antes de escuchar en el puerto ${puerto}`, { enUso: /EADDRINUSE/.test(salida.join('')) });
  });
});

export const iniciarServidor = async ({ env = {} } = {}) => {
  await verificarEntornoLocal();

  // Si entre la sonda y el arranque otro proceso tomó el puerto, se prueba con otro
  for (let intento = 1; ; intento++) {
    const puerto = await puertoLibre();
    try {
      const { proceso, salida } = await arrancarEn(puerto, env);
      return {
        url: `http://127.0.0.1:${puerto}`,
        logs: () => salida.join(''),
        detener: () => new Promise(resolve => {
          if (proceso.exitCode !== null || proceso.signalCode !== null) return resolve();
          proceso.once('exit', resolve);
          proceso.kill();
        })
      };
    } catch (error) {
      if (!error.enUso || intento >= INTENTOS_DE_ARRANQUE) throw error;
    }
  }
};

// =====================================================
// Cliente HTTP
// =====================================================
export const crearCliente = (baseUrl) => {
  const pedir = async (metodo, ruta, { token, body, headers = {} } = {}) => {
    const res = await fetch(`${baseUrl}/api${ruta}`, {
      method: metodo,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const tipo = res.headers.get('content-type') || '';
    let datos;
    if (tipo.includes('application/json')) datos = await res.json();
    else if (tipo.startsWith('text/')) datos = await res.text();
    else datos = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, body: datos };
  };

  return {
    get: (ruta, opciones) => pedir('GET', ruta, opciones),
    post: (ruta, body, opciones = {}) => pedir('POST', ruta, { ...opciones, body }),
    put: (ruta, body, opciones = {}) => pedir('PUT', ruta, { ...opciones, body }),
    delete: (ruta, opciones) => pedir('DELETE', ruta, opciones),
    login: async (username, password) => {
      const res = await pedir('POST', '/auth/login', { body: { username, password } });
      if (res.status !== 200) throw new Error(`Login de ${username} falló: ${res.status} ${JSON.stringify(res.body)}`);
      return res.body.data.token;
    }
  };
};

// =====================================================
// Usuarios de prueba
// =====================================================
// Crea usuarios de prueba con contraseñas aleatorias. Por defecto: admin A, admin B, un lector y un superadmin.
// Devuelve sus datos y tokens.
export const crearUsuariosPrueba = async (
  cliente,
  definiciones = { adminA: 'admin', adminB: 'admin', lector: 'lector', superadmin: 'superadmin' }
) => {
  const sufijo = crypto.randomBytes(4).toString('hex');
  const usuarios = {};

  for (const [clave, rol] of Object.entries(definiciones)) {
    const username = `test_${clave}_${sufijo}`;
    const password = crypto.randomBytes(12).toString('base64url');
    const [resultado] = await db().query(
      `INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [username, bcrypt.hashSync(password, 4), `Test ${clave}`, `${username}@rpad.test`, rol]
    );
    usuarios[clave] = { id: resultado.insertId, username, password, rol, email: `${username}@rpad.test` };
  }

  for (const usuario of Object.values(usuarios)) {
    usuario.token = await cliente.login(usuario.username, usuario.password);
  }
  return usuarios;
};

// Borra todo lo creado por los tests (cambios pendientes caen en cascada)
export const limpiarDatosPrueba = async (usuarios = {}) => {
  await db().query('DELETE FROM datasets WHERE titulo LIKE ?', [`${PREFIJO_TEST}%`]);
  const ids = Object.values(usuarios).map(u => u.id);
  if (ids.length > 0) {
    // Historial y links de acceso de los usuarios de prueba (sus FK no borran en cascada)
    await db().query('DELETE FROM usuarios_auditoria WHERE usuario_id IN (?)', [ids]);
    await db().query('DELETE FROM usuarios_tokens WHERE usuario_id IN (?)', [ids]);
    await db().query('DELETE FROM cambios_pendientes WHERE usuario_id IN (?)', [ids]);
    await db().query('DELETE FROM usuarios WHERE id IN (?)', [ids]);
  }
};

export const cerrarDb = async () => {
  if (pool) await pool.end();
  pool = undefined;
};

// =====================================================
// Mailpit
// =====================================================
export const mailpit = {
  vaciar: () => fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' }),
  mensajes: async () => (await (await fetch(`${MAILPIT_URL}/api/v1/messages`)).json()).messages,
  html: async (id) => (await (await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)).json()).HTML,
  // Espera (hasta ~5 s) a que llegue algún mensaje que cumpla la condición; devuelve los que la cumplen
  esperar: async (condicion, { intentos = 50, ms = 100 } = {}) => {
    for (let i = 0; i < intentos; i++) {
      const encontrados = (await mailpit.mensajes()).filter(condicion);
      if (encontrados.length > 0) return encontrados;
      await new Promise(r => setTimeout(r, ms));
    }
    return [];
  }
};

// Filtro de mensajes de Mailpit por destinatario
export const paraCasilla = (email) => (mensaje) => mensaje.To.some(t => t.Address === email);

// Token de un link de acceso dentro del HTML de un email
export const tokenDelLink = (html) => html.match(/establecer-contrasena\.html#token=([A-Za-z0-9_-]+)/)?.[1];
