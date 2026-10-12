# Notas Digitales – Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los siete emails de gestión interna y externa por Notas Digitales numeradas, con PDF firmado, libro de notas, calendario de avisos y reiteraciones, y pantalla de administración.

**Architecture:** Funciones puras (calendario, contenido, PDF) separadas del acceso a datos (selección de datasets) y del motor (numeración, envío, reintentos, bloqueo), que se dispara desde el cron existente. Una API solo para admins expone el libro, la configuración, la vista previa y las pruebas; la pantalla de Correos la consume. Una barrera por variable de entorno (`EMAIL_SOLO_A`) impide enviar a casillas reales durante las pruebas.

**Tech Stack:** Node 24 en desarrollo y Node 22.23 en producción (cPanel, Passenger), ES Modules, Express 4, MariaDB 10.11 (mysql2/promise), nodemailer 6, PDFKit 0.15, `node:test`, Docker (MariaDB + Mailpit) para pruebas.

**Spec:** `docs/superpowers/specs/2026-10-12-notas-digitales-design.md`

## Global Constraints

- ES Modules, `async/await`, nombres y comentarios en español; respuestas de API `{ success, data?, error?, message? }`.
- SQL siempre parametrizado (`?`). Las únicas interpolaciones permitidas son nombres de columna tomados de listas fijas del código.
- Sin dependencias npm nuevas. El código de la app no puede usar APIs que no existan en Node 22.
- Producción corre bajo Passenger, que puede levantar más de un proceso: la exclusión entre corridas tiene que estar en la base (`GET_LOCK`), no en memoria.
- El cron de cPanel no cambia: `GET /api/cron/notificaciones` a las 8:00 y `GET /api/cron/cambios-pendientes` a las 13:00.
- Ventanas: gestión interna **60** días, gestión externa **30** días. Reiteración: aviso enviado hace **21** días o más.
- Días hábiles: lunes a viernes, salvo los feriados fijos `01-01, 03-24, 04-02, 05-01, 05-25, 06-20, 07-09, 12-08, 12-25`.
- "Hoy" se calcula en `America/Argentina/Buenos_Aires`. Las fechas viajan como strings `AAAA-MM-DD`.
- Textos de las notas: copiar literalmente las secciones 6.1 a 6.5 de la especificación (están transcriptos en la Tarea 4).
- PDF: hoja **216 × 330 mm** (612.28 × 935.43 pt), márgenes **25 mm** arriba y abajo y **30 mm** a los costados, Helvetica.
- Reintentos automáticos: máximo **5** intentos por nota.
- `EMAIL_SOLO_A`: si tiene direcciones, todo email del sistema solo puede salir hacia esas casillas.
- El repositorio es público: no versionar la imagen de la firma, casillas personales, contraseñas ni nombres de personas.
- `npm test` corre contra la base Docker local y Mailpit; no puede tocar producción. Debe terminar en verde al final de cada tarea.

## Review Focus

1. **Configuración incompleta con el envío activado** (sin Para, sin nombre o sin cargo de firma): el motor no genera notas y el estado lo informa; activar el envío con la configuración incompleta devuelve 400. Tests en las Tareas 7 y 8.
2. **Nota muy larga** (60 datasets con títulos largos): el PDF sale en varias hojas, sin errores y con pie de página. Test en la Tarea 5.
3. **Direcciones mal cargadas en la configuración** (separadas por `;`, con espacios o inválidas): se normalizan, o se rechazan con 400 sin guardar. Test en la Tarea 8.
4. **Imagen de firma inválida** (no es PNG/JPEG, base64 corrupto, más de 500 KB): 400 sin guardar. Test en la Tarea 8.
5. **Cambio de año**: la primera nota de enero es N° 1 del año nuevo, aunque el año anterior termine en otro número. Test en la Tarea 7.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `database/updates/migracion-notas-digitales.sql` (nuevo) | Tablas `notas_digitales`, `notas_digitales_datasets`, `notas_digitales_config` y fila inicial |
| `database/schema.sql` | Mismas tablas al final del archivo |
| `services/emailService.js` | Barrera `EMAIL_SOLO_A`, CC, CCO, Reply-To, texto, adjuntos |
| `services/notasDigitalesCalendario.js` (nuevo) | Fechas puras: hoy en Argentina, días hábiles, formatos |
| `services/notasDigitalesContenido.js` (nuevo) | Textos fijos, estructura de la nota, HTML y texto plano |
| `services/notasDigitalesPdf.js` (nuevo) | PDF oficio con firma |
| `services/notasDigitalesDatos.js` (nuevo) | Consultas: configuración, selección para aviso y reiteración, antecedentes, áreas |
| `services/notasDigitales.js` (nuevo) | Motor: generar, numerar, enviar, reintentar, corrida diaria, vista previa, prueba, estado |
| `controllers/notasDigitalesController.js` (nuevo) | API de la sección 9 |
| `controllers/notificacionesController.js` | Quita los siete avisos, llama al motor, prueba del aviso a áreas |
| `services/emailTemplates.js` | Elimina las plantillas de los siete avisos |
| `controllers/gestionController.js` | Indicador mensual suma las notas enviadas |
| `routes/index.js` | Rutas nuevas, quita las viejas |
| `public/correos.html`, `public/js/correos.js`, `public/js/api.js` | Pantalla de Correos |
| `tests/helpers.js`, `tests/notas-fixtures.js` (nuevo) | Base de prueba propia y fixtures |
| `tests/*.test.js` | Tests de cada tarea |

---

### Task 1: Esquema de datos y base de prueba

**Files:**
- Create: `database/updates/migracion-notas-digitales.sql`
- Modify: `database/schema.sql` (agregar al final)
- Modify: `tests/schema.test.js`
- Modify: `tests/helpers.js`

**Interfaces:**
- Produces: tablas `notas_digitales`, `notas_digitales_datasets`, `notas_digitales_config` (columnas de la spec 7.1–7.3).
- Produces (tests): `verificarEntornoLocal(): Promise<void>` (exportada), `iniciarServidor({ env?: object } = {})`, `crearBaseDePrueba(nombre: string): Promise<{ nombre, borrar(): Promise<void> }>`.

- [ ] **Step 1: Escribir los tests que fallan en `tests/schema.test.js`**

Agregar `'notas_digitales', 'notas_digitales_datasets'` a la lista de tablas sin datos y un test para la configuración inicial. Reemplazar el bloque `for (const tabla of ['usuarios', ...` por:

```js
  for (const tabla of ['usuarios', 'areas', 'datasets', 'cambios_pendientes', 'notificaciones_log', 'historial_actualizaciones', 'proyectos', 'metricas_manuales', 'notas_digitales', 'notas_digitales_datasets']) {
    it(`no trae datos en ${tabla}`, async () => {
      assert.equal(await contar(tabla), 0);
    });
  }

  it('trae la configuración inicial de Notas Digitales, sin firma ni casillas de prueba', async () => {
    const [[config]] = await root.query(`SELECT * FROM \`${BASE_TEMPORAL}\`.notas_digitales_config`);
    assert.equal(config.id, 1);
    assert.equal(config.envio_activo, 0);
    assert.equal(config.para_interna, 'mit@comodoro.gov.ar');
    assert.equal(config.cc_interna, 'geoestadisticas@comodoro.gov.ar');
    assert.equal(config.para_externa, 'mit@comodoro.gov.ar');
    assert.equal(config.cc_externa, 'investigacionterritorial@comodoro.gov.ar');
    assert.equal(config.cco, 'datospublicos@comodoro.gov.ar');
    assert.equal(config.linea_cc_interna, 'CC. Dir. de Investigación Territorial');
    assert.equal(config.linea_cc_externa, 'CC. Dir. Administrativa');
    assert.equal(config.firma_nombre, '');
    assert.equal(config.firma_imagen, null);
    assert.equal(config.casillas_prueba, '');
  });
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --test tests/schema.test.js`
Expected: FAIL. `no trae datos en notas_digitales` y el test de configuración fallan con `Table 'rpad_schema_test.notas_digitales' doesn't exist`.

- [ ] **Step 3: Crear la migración `database/updates/migracion-notas-digitales.sql`**

```sql
-- =====================================================
-- RPAD - Notas Digitales
-- =====================================================
-- Libro de notas, datasets incluidos en cada nota y configuración.
-- Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 7)
-- Ejecutar: mysql -u USUARIO -p NOMBRE_BASE < migracion-notas-digitales.sql
-- =====================================================

CREATE TABLE `notas_digitales` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `numero` int(11) DEFAULT NULL,
  `anio` smallint(6) DEFAULT NULL,
  `tipo` enum('aviso','reiteracion') NOT NULL,
  `gestion` enum('interna','externa') NOT NULL,
  `periodo` char(7) DEFAULT NULL,
  `fecha` date NOT NULL,
  `es_prueba` tinyint(1) NOT NULL DEFAULT 0,
  `asunto` varchar(300) NOT NULL,
  `para` varchar(500) NOT NULL,
  `cc` varchar(500) DEFAULT NULL,
  `cco` varchar(500) DEFAULT NULL,
  `html` mediumtext NOT NULL,
  `texto` mediumtext NOT NULL,
  `pdf` mediumblob NOT NULL,
  `estado` enum('pendiente','enviada','fallida') NOT NULL DEFAULT 'pendiente',
  `intentos` int(11) NOT NULL DEFAULT 0,
  `ultimo_error` text DEFAULT NULL,
  `message_id` varchar(255) DEFAULT NULL,
  `respuesta_smtp` varchar(500) DEFAULT NULL,
  `enviada_at` datetime DEFAULT NULL,
  `creado_por` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notas_numero` (`anio`,`numero`),
  KEY `idx_notas_tipo_periodo` (`tipo`,`gestion`,`periodo`),
  KEY `idx_notas_estado` (`estado`),
  KEY `fk_notas_creado_por` (`creado_por`),
  CONSTRAINT `fk_notas_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notas_digitales_datasets` (
  `nota_id` int(11) NOT NULL,
  `dataset_id` int(11) NOT NULL,
  `seccion` enum('proximo','vencido') NOT NULL,
  `vencimiento` date NOT NULL,
  PRIMARY KEY (`nota_id`,`dataset_id`),
  KEY `idx_ndd_dataset_vencimiento` (`dataset_id`,`vencimiento`),
  CONSTRAINT `fk_ndd_nota` FOREIGN KEY (`nota_id`) REFERENCES `notas_digitales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ndd_dataset` FOREIGN KEY (`dataset_id`) REFERENCES `datasets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notas_digitales_config` (
  `id` tinyint(4) NOT NULL,
  `envio_activo` tinyint(1) NOT NULL DEFAULT 0,
  `para_interna` varchar(500) NOT NULL DEFAULT '',
  `cc_interna` varchar(500) NOT NULL DEFAULT '',
  `para_externa` varchar(500) NOT NULL DEFAULT '',
  `cc_externa` varchar(500) NOT NULL DEFAULT '',
  `cco` varchar(500) NOT NULL DEFAULT '',
  `linea_cc_interna` varchar(200) NOT NULL DEFAULT '',
  `linea_cc_externa` varchar(200) NOT NULL DEFAULT '',
  `firma_nombre` varchar(150) NOT NULL DEFAULT '',
  `firma_cargo` varchar(200) NOT NULL DEFAULT '',
  `firma_imagen` mediumblob DEFAULT NULL,
  `firma_mime` varchar(50) DEFAULT NULL,
  `casillas_prueba` varchar(500) NOT NULL DEFAULT '',
  `reiteracion_evaluada_interna` char(7) DEFAULT NULL,
  `reiteracion_evaluada_externa` char(7) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `notas_digitales_config`
  (`id`, `para_interna`, `cc_interna`, `para_externa`, `cc_externa`, `cco`, `linea_cc_interna`, `linea_cc_externa`)
VALUES
  (1, 'mit@comodoro.gov.ar', 'geoestadisticas@comodoro.gov.ar', 'mit@comodoro.gov.ar',
   'investigacionterritorial@comodoro.gov.ar', 'datospublicos@comodoro.gov.ar',
   'CC. Dir. de Investigación Territorial', 'CC. Dir. Administrativa');
```

- [ ] **Step 4: Agregar las mismas tablas al final de `database/schema.sql`**

Agregar al final del archivo una sección con el encabezado siguiente, seguida del contenido completo de la migración desde el primer `CREATE TABLE` hasta el `INSERT` inclusive (copiar literal; no tiene datos personales):

```sql

-- =====================================================
-- Notas Digitales (database/updates/migracion-notas-digitales.sql)
-- =====================================================

```

- [ ] **Step 5: Aplicar la migración a la base Docker local**

Run: `docker exec -i rpad-db sh -c 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE"' < database/updates/migracion-notas-digitales.sql`
Expected: sin salida. Verificar con `docker exec rpad-db sh -c 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE" -e "SELECT id, envio_activo FROM notas_digitales_config"'`, que debe devolver `1 0`.

- [ ] **Step 6: Ampliar `tests/helpers.js`**

1. Agregar `import fs from 'fs';` junto a los imports.
2. Cambiar `const verificarEntornoLocal = async () => {` por `export const verificarEntornoLocal = async () => {`.
3. Reemplazar la firma y el `spawn` de `iniciarServidor`:

```js
export const iniciarServidor = async ({ env = {} } = {}) => {
  await verificarEntornoLocal();

  const puerto = 31000 + crypto.randomInt(0, 999);
  const salida = [];
  // EMAIL_SOLO_A vacío: los tests verifican los destinatarios reales en Mailpit
  const proceso = spawn(process.execPath, ['app.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(puerto), EMAIL_SOLO_A: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
```

(el resto de la función queda igual).

4. Agregar al final de la sección "Base de datos":

```js
// Crea una base vacía a partir de database/schema.sql, para tests que necesitan datos controlados.
// El usuario de la app recibe permisos sobre ella.
const conexionRoot = () => mysql.createConnection({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: 'root',
  password: process.env.DB_ROOT_PASSWORD,
  multipleStatements: true
});

export const crearBaseDePrueba = async (nombre) => {
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
      const conexion = await conexionRoot();
      await conexion.query(`DROP DATABASE IF EXISTS \`${nombre}\``);
      await conexion.end();
    }
  };
};
```

- [ ] **Step 7: Correr y ver que pasa**

Run: `node --test tests/schema.test.js`
Expected: PASS (16 tests).
Run: `npm test`
Expected: todos en verde.

- [ ] **Step 8: Commit**

```bash
git add database/updates/migracion-notas-digitales.sql database/schema.sql tests/schema.test.js tests/helpers.js
git commit -m "feat: tablas de Notas Digitales y base de prueba para tests"
```

---

### Task 2: Barrera de destinatarios y opciones de envío en `emailService`

**Files:**
- Modify: `services/emailService.js`
- Test: `tests/email-barrera.test.js` (nuevo)

**Interfaces:**
- Consumes: `verificarEntornoLocal`, `mailpit` de `tests/helpers.js`.
- Produces: `listaDeCorreos(valor: string|string[]|null): string[]`; `filtrarDestinatarios(lista, permitidos = process.env.EMAIL_SOLO_A): string[]`; `sendEmail({ subject, html, text?, to?, cc?, bcc?, replyTo?, from?, attachments? }) → Promise<{ success: true, messageId, response } | { success: false, error, bloqueado? }>`. `to`, `cc` y `bcc` aceptan string separado por comas o array. `sendEmailToArea` y `verifyConnection` no cambian de firma.

- [ ] **Step 1: Escribir el test que falla `tests/email-barrera.test.js`**

```js
// Barrera EMAIL_SOLO_A y opciones de envío del servicio de email (contra Mailpit)
import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { verificarEntornoLocal, mailpit } from './helpers.js';

let email;

before(async () => {
  await verificarEntornoLocal();
  email = await import('../services/emailService.js');
});

beforeEach(async () => {
  process.env.EMAIL_SOLO_A = '';
  await mailpit.vaciar();
});

const direcciones = (lista) => (lista || []).map(d => d.Address);

describe('listaDeCorreos', () => {
  it('separa por coma o punto y coma y quita espacios', () => {
    assert.deepEqual(email.listaDeCorreos(' a@x.gov.ar, b@y.gov.ar;c@z.gov.ar '), ['a@x.gov.ar', 'b@y.gov.ar', 'c@z.gov.ar']);
  });

  it('acepta arrays y valores vacíos', () => {
    assert.deepEqual(email.listaDeCorreos([' a@x.gov.ar ', '']), ['a@x.gov.ar']);
    assert.deepEqual(email.listaDeCorreos(null), []);
    assert.deepEqual(email.listaDeCorreos(''), []);
  });
});

describe('filtrarDestinatarios', () => {
  it('sin barrera deja pasar todo', () => {
    assert.deepEqual(email.filtrarDestinatarios('a@x.gov.ar, b@y.gov.ar', ''), ['a@x.gov.ar', 'b@y.gov.ar']);
  });

  it('con barrera deja solo las casillas permitidas, sin distinguir mayúsculas', () => {
    assert.deepEqual(
      email.filtrarDestinatarios(['Permitida@Rpad.test', 'otra@rpad.test'], 'permitida@rpad.test, segunda@rpad.test'),
      ['Permitida@Rpad.test']
    );
  });
});

describe('sendEmail', () => {
  it('envía con CC, CCO, Reply-To, texto plano y adjunto', async () => {
    const resultado = await email.sendEmail({
      subject: 'Prueba de opciones',
      html: '<p>hola</p>',
      text: 'hola',
      to: 'para@rpad.test',
      cc: ['cc@rpad.test'],
      bcc: 'cco@rpad.test',
      replyTo: 'responder@rpad.test',
      attachments: [{ filename: 'nota.pdf', content: Buffer.from('%PDF-1.4'), contentType: 'application/pdf' }]
    });
    assert.equal(resultado.success, true);
    assert.match(resultado.response, /^250/);
    assert.ok(resultado.messageId);

    const [mensaje] = await mailpit.mensajes();
    assert.deepEqual(direcciones(mensaje.To), ['para@rpad.test']);
    assert.deepEqual(direcciones(mensaje.Cc), ['cc@rpad.test']);
    assert.deepEqual(direcciones(mensaje.Bcc), ['cco@rpad.test']);
    assert.equal(mensaje.Attachments, 1);
    const detalle = await (await fetch(`http://localhost:8025/api/v1/message/${mensaje.ID}`)).json();
    assert.deepEqual(direcciones(detalle.ReplyTo), ['responder@rpad.test']);
    assert.equal(detalle.Text.trim(), 'hola');
  });

  it('con EMAIL_SOLO_A quita de Para, CC y CCO las casillas no permitidas', async () => {
    process.env.EMAIL_SOLO_A = 'permitida@rpad.test,segunda@rpad.test';
    const resultado = await email.sendEmail({
      subject: 'Barrera', html: '<p>x</p>',
      to: ['permitida@rpad.test', 'real@comodoro.gov.ar'], cc: 'otra@comodoro.gov.ar', bcc: 'segunda@rpad.test'
    });
    assert.equal(resultado.success, true);
    const [mensaje] = await mailpit.mensajes();
    assert.deepEqual(direcciones(mensaje.To), ['permitida@rpad.test']);
    assert.deepEqual(direcciones(mensaje.Cc), []);
    assert.deepEqual(direcciones(mensaje.Bcc), ['segunda@rpad.test']);
  });

  it('con EMAIL_SOLO_A no envía nada si ningún destinatario está permitido', async () => {
    process.env.EMAIL_SOLO_A = 'permitida@rpad.test';
    const resultado = await email.sendEmail({ subject: 'Bloqueado', html: '<p>x</p>', to: 'real@comodoro.gov.ar' });
    assert.deepEqual(resultado, { success: false, error: 'Bloqueado por EMAIL_SOLO_A', bloqueado: true });
    assert.equal((await mailpit.mensajes()).length, 0);
  });

  it('también filtra los emails a áreas', async () => {
    process.env.EMAIL_SOLO_A = 'permitida@rpad.test';
    const resultado = await email.sendEmailToArea({ subject: 'Área', html: '<p>x</p>', to: ['area@comodoro.gov.ar'] });
    assert.equal(resultado.success, false);
    assert.equal((await mailpit.mensajes()).length, 0);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --test tests/email-barrera.test.js`
Expected: FAIL. `email.listaDeCorreos is not a function` y similares.

- [ ] **Step 3: Reemplazar `sendEmail` y `sendEmailToArea` en `services/emailService.js`**

Dejar intactos el transporter, `DEFAULT_RECIPIENTS`, `verifyConnection` y el `export default`. Reemplazar desde el comentario `/**` que precede a `export const sendEmail` hasta el final de `sendEmailToArea` por:

```js
/**
 * Convierte "a@x, b@y; c@z" o ['a@x', ...] en una lista limpia de direcciones
 */
export const listaDeCorreos = (valor) => {
  if (!valor) return [];
  const partes = Array.isArray(valor) ? valor : String(valor).split(/[,;]/);
  return partes.map(correo => String(correo).trim()).filter(Boolean);
};

/**
 * Barrera de pruebas: si EMAIL_SOLO_A tiene direcciones, solo se puede enviar a esas casillas.
 * En producción EMAIL_SOLO_A no se define y no filtra nada.
 */
export const filtrarDestinatarios = (lista, permitidos = process.env.EMAIL_SOLO_A) => {
  const autorizados = listaDeCorreos(permitidos).map(correo => correo.toLowerCase());
  const correos = listaDeCorreos(lista);
  if (autorizados.length === 0) return correos;
  return correos.filter(correo => autorizados.includes(correo.toLowerCase()));
};

/**
 * Envía un email. to, cc y bcc aceptan un string separado por comas o un array.
 * Devuelve { success: true, messageId, response } o { success: false, error, bloqueado? }
 */
export const sendEmail = async ({ subject, html, text, to = DEFAULT_RECIPIENTS, cc, bcc, replyTo, from, attachments }) => {
  const para = filtrarDestinatarios(to);
  const copia = filtrarDestinatarios(cc);
  const oculta = filtrarDestinatarios(bcc);

  if (para.length + copia.length + oculta.length === 0) {
    const bloqueado = listaDeCorreos(process.env.EMAIL_SOLO_A).length > 0;
    const error = bloqueado ? 'Bloqueado por EMAIL_SOLO_A' : 'No hay destinatarios';
    console.warn(`⚠️ Email no enviado (${subject}): ${error}`);
    return bloqueado ? { success: false, error, bloqueado } : { success: false, error };
  }

  try {
    const info = await transporter.sendMail({
      from: from || `"RPAD - Notificaciones" <${process.env.SMTP_USER}>`,
      to: para.length ? para.join(', ') : undefined,
      cc: copia.length ? copia.join(', ') : undefined,
      bcc: oculta.length ? oculta.join(', ') : undefined,
      replyTo,
      subject,
      html,
      text,
      attachments
    });

    console.log(`✉️ Email enviado: ${subject} → ${info.messageId}`);
    return { success: true, messageId: info.messageId, response: info.response };
  } catch (error) {
    console.error('❌ Error enviando email:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Envía un email a un área (aviso de 40 días)
 */
export const sendEmailToArea = ({ subject, html, to }) => sendEmail({
  subject,
  html,
  to: to || [],
  from: `"RPAD - Datos Abiertos MCR" <${process.env.SMTP_USER}>`
});
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `node --test tests/email-barrera.test.js`
Expected: PASS (8 tests).
Run: `npm test`
Expected: todos en verde (los tests con servidor corren con `EMAIL_SOLO_A` vacío desde la Tarea 1).

- [ ] **Step 5: Commit**

```bash
git add services/emailService.js tests/email-barrera.test.js
git commit -m "feat: barrera EMAIL_SOLO_A y CC/CCO/adjuntos en el servicio de email"
```

---

### Task 3: Calendario

**Files:**
- Create: `services/notasDigitalesCalendario.js`
- Test: `tests/notas-calendario.test.js`

**Interfaces:**
- Produces: `FERIADOS_FIJOS: string[]`; `hoyArgentina(ahora?: Date): string`; `sumarDias(iso, dias): string`; `diasEntre(desde, hasta): number` (hasta − desde); `esDiaHabil(iso): boolean`; `proximoDiaHabil(iso): string` (el mismo día si es hábil); `primerDiaHabilDelMes(periodo 'AAAA-MM'): string`; `periodoDe(iso): string`; `periodoSiguiente(periodo): string`; `formatoCorto(iso|null): string` (`dd/mm/aaaa` o `—`); `formatoLargo(iso): string`; `mesYAnio(iso): string`.

- [ ] **Step 1: Escribir el test que falla `tests/notas-calendario.test.js`**

```js
// Calendario de Notas Digitales (funciones puras)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as cal from '../services/notasDigitalesCalendario.js';

describe('hoyArgentina', () => {
  it('usa la fecha de Argentina aunque en UTC ya sea el día siguiente', () => {
    assert.equal(cal.hoyArgentina(new Date('2026-11-02T02:00:00Z')), '2026-11-01');
    assert.equal(cal.hoyArgentina(new Date('2026-11-02T11:00:00Z')), '2026-11-02');
  });
});

describe('días hábiles', () => {
  const casos = [
    ['2026-10-12', true, 'lunes'],
    ['2026-12-31', true, 'jueves'],
    ['2026-11-01', false, 'domingo'],
    ['2027-05-01', false, 'sábado y feriado'],
    ['2027-01-01', false, 'viernes feriado'],
    ['2027-03-24', false, 'miércoles feriado'],
    ['2026-12-25', false, 'viernes feriado']
  ];
  for (const [fecha, esperado, descripcion] of casos) {
    it(`${fecha} (${descripcion}) → ${esperado}`, () => {
      assert.equal(cal.esDiaHabil(fecha), esperado);
    });
  }

  it('primer día hábil de cada mes', () => {
    assert.equal(cal.primerDiaHabilDelMes('2026-10'), '2026-10-01');
    assert.equal(cal.primerDiaHabilDelMes('2026-11'), '2026-11-02');
    assert.equal(cal.primerDiaHabilDelMes('2026-12'), '2026-12-01');
    assert.equal(cal.primerDiaHabilDelMes('2027-01'), '2027-01-04');
    assert.equal(cal.primerDiaHabilDelMes('2027-05'), '2027-05-03');
  });

  it('próximo día hábil', () => {
    assert.equal(cal.proximoDiaHabil('2026-11-01'), '2026-11-02');
    assert.equal(cal.proximoDiaHabil('2026-11-02'), '2026-11-02');
  });
});

describe('aritmética de fechas', () => {
  it('suma y resta días cruzando meses y años', () => {
    assert.equal(cal.sumarDias('2026-12-31', 1), '2027-01-01');
    assert.equal(cal.sumarDias('2026-10-31', -30), '2026-10-01');
  });

  it('cuenta días entre fechas', () => {
    assert.equal(cal.diasEntre('2026-10-01', '2026-10-31'), 30);
    assert.equal(cal.diasEntre('2026-11-15', '2026-11-02'), -13);
  });

  it('períodos', () => {
    assert.equal(cal.periodoDe('2026-11-02'), '2026-11');
    assert.equal(cal.periodoSiguiente('2026-12'), '2027-01');
    assert.equal(cal.periodoSiguiente('2026-03'), '2026-04');
  });
});

describe('formatos', () => {
  it('corto, largo y mes', () => {
    assert.equal(cal.formatoCorto('2026-11-02'), '02/11/2026');
    assert.equal(cal.formatoCorto(null), '—');
    assert.equal(cal.formatoLargo('2026-11-02'), '2 de noviembre de 2026');
    assert.equal(cal.mesYAnio('2026-11-02'), 'noviembre 2026');
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --test tests/notas-calendario.test.js`
Expected: FAIL con `Cannot find module '.../services/notasDigitalesCalendario.js'`.

- [ ] **Step 3: Crear `services/notasDigitalesCalendario.js`**

```js
// Calendario de Notas Digitales. Todas las fechas son strings 'AAAA-MM-DD' en hora de Argentina.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 5.1)

const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';
export const FERIADOS_FIJOS = ['01-01', '03-24', '04-02', '05-01', '05-25', '06-20', '07-09', '12-08', '12-25'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Mediodía UTC: evita que un cambio de zona horaria mueva la fecha
const aFecha = (iso) => new Date(`${iso}T12:00:00Z`);
const aIso = (fecha) => fecha.toISOString().slice(0, 10);

export const hoyArgentina = (ahora = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit'
}).format(ahora);

export const sumarDias = (iso, dias) => {
  const fecha = aFecha(iso);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return aIso(fecha);
};

export const diasEntre = (desde, hasta) => Math.round((aFecha(hasta) - aFecha(desde)) / 86400000);

export const esDiaHabil = (iso) => {
  const diaSemana = aFecha(iso).getUTCDay();
  return diaSemana !== 0 && diaSemana !== 6 && !FERIADOS_FIJOS.includes(iso.slice(5));
};

export const proximoDiaHabil = (iso) => {
  let fecha = iso;
  while (!esDiaHabil(fecha)) fecha = sumarDias(fecha, 1);
  return fecha;
};

export const primerDiaHabilDelMes = (periodo) => proximoDiaHabil(`${periodo}-01`);

export const periodoDe = (iso) => iso.slice(0, 7);

export const periodoSiguiente = (periodo) => {
  const [anio, mes] = periodo.split('-').map(Number);
  return mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, '0')}`;
};

export const formatoCorto = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');

export const formatoLargo = (iso) => {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
};

export const mesYAnio = (iso) => {
  const [anio, mes] = iso.split('-').map(Number);
  return `${MESES[mes - 1]} ${anio}`;
};
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `node --test tests/notas-calendario.test.js`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add services/notasDigitalesCalendario.js tests/notas-calendario.test.js
git commit -m "feat: calendario de Notas Digitales (días hábiles y formatos)"
```

---

### Task 4: Contenido de la nota (estructura, HTML y texto plano)

**Files:**
- Create: `services/notasDigitalesContenido.js`
- Test: `tests/notas-contenido.test.js`

**Interfaces:**
- Consumes: `formatoCorto`, `formatoLargo`, `mesYAnio`, `diasEntre` (Tarea 3).
- Produces:
  - `DatasetNota`: `{ id, titulo, url_dataset, area_id, area_nombre, frecuencia_nombre, ultima_actualizacion: 'AAAA-MM-DD'|null, vencimiento: 'AAAA-MM-DD', informado: { numero, anio, fecha }|null, reiteraciones: number, antecedente: { cantidad, primera, ultima }|null }`.
  - `AreaContacto`: `{ id, nombre, area_superior, email_principal, email_secundario, telefono_area, celular_area, nombre_contacto, telefono_contacto, email_contacto }`.
  - `construirNota({ tipo: 'aviso'|'reiteracion', gestion: 'interna'|'externa', numero: number|null, anio: number|null, esPrueba: boolean, fecha, datasets: DatasetNota[], areas: AreaContacto[], config: { linea_cc_interna, linea_cc_externa, firma_nombre, firma_cargo } }) → Nota`. `Nota` = `{ tipo, gestion, esPrueba, fecha, numeroTexto, asunto, ref, destinatario, parrafoInicial, secciones: [{ clave, titulo, introduccion, columnas: string[], filas: [{ valores: string[], url: string|null, antecedente: string|null }] }], contactos: [{ nombre, lineas: string[] }], justificacion: string[], remitente, fechaLarga, firma: { nombre, cargo }, lineaCc }`.
  - `renderHtml(nota): string`, `renderTexto(nota): string`, `escapeHtml(texto): string`.

- [ ] **Step 1: Escribir el test que falla `tests/notas-contenido.test.js`**

```js
// Contenido de las Notas Digitales (funciones puras)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { construirNota, renderHtml, renderTexto } from '../services/notasDigitalesContenido.js';

const config = {
  linea_cc_interna: 'CC. Dir. de Investigación Territorial',
  linea_cc_externa: 'CC. Dir. Administrativa',
  firma_nombre: 'Nombre de Firma',
  firma_cargo: 'Cargo de Firma'
};

const dataset = (cambios = {}) => ({
  id: 1, titulo: 'Dataset A', url_dataset: 'https://datos.comodoro.gov.ar/dataset/a', area_id: 10,
  area_nombre: 'Área Uno', frecuencia_nombre: 'Anualmente', ultima_actualizacion: '2025-12-31',
  vencimiento: '2026-12-31', informado: null, reiteraciones: 0, antecedente: null, ...cambios
});

const nota = (cambios = {}) => construirNota({
  tipo: 'aviso', gestion: 'interna', numero: 12, anio: 2026, esPrueba: false, fecha: '2026-11-02',
  datasets: [dataset()], areas: [], config, ...cambios
});

const REF = 'Solicitud de gestión de datos para el Portal de Datos Abiertos Municipal';

describe('asunto y número', () => {
  it('aviso interno', () => {
    assert.equal(nota().asunto, `Nota Digital N° 12/26 – Ref.: ${REF} (gestión interna – noviembre 2026)`);
  });

  it('reiteración externa', () => {
    assert.equal(nota({ tipo: 'reiteracion', gestion: 'externa' }).asunto,
      `Nota Digital N° 12/26 – Ref.: Reiteración – ${REF} (gestión externa – noviembre 2026)`);
  });

  it('prueba y vista previa', () => {
    assert.equal(nota({ numero: null, anio: null, esPrueba: true }).asunto,
      `[PRUEBA] Nota Digital N° PRUEBA – Ref.: ${REF} (gestión interna – noviembre 2026)`);
    assert.equal(nota({ numero: null, anio: null }).numeroTexto, 'XX');
  });
});

describe('secciones', () => {
  it('separa próximos y vencidos y omite las vacías', () => {
    const soloProximo = nota();
    assert.deepEqual(soloProximo.secciones.map(s => s.clave), ['proximo']);
    const ambas = nota({ datasets: [dataset(), dataset({ id: 2, titulo: 'Dataset B', vencimiento: '2026-10-31' })] });
    assert.deepEqual(ambas.secciones.map(s => s.clave), ['proximo', 'vencido']);
    assert.equal(ambas.secciones[1].titulo, 'Plazo de actualización vencido');
    assert.equal(ambas.secciones[1].introduccion, 'Los siguientes conjuntos de datos se encuentran con su plazo de actualización vencido:');
  });

  it('calcula la situación al día de la nota', () => {
    const situacion = (vencimiento) => {
      const s = nota({ datasets: [dataset({ vencimiento })] }).secciones[0];
      return s.filas[0].valores[5];
    };
    assert.equal(situacion('2026-12-31'), 'Faltan 59 días');
    assert.equal(situacion('2026-11-03'), 'Faltan 1 día');
    assert.equal(situacion('2026-11-02'), 'Vence hoy');
    assert.equal(situacion('2026-10-31'), 'Vencido hace 2 días');
  });

  it('un dataset que vence el día de la nota va en próximos', () => {
    assert.equal(nota({ datasets: [dataset({ vencimiento: '2026-11-02' })] }).secciones[0].clave, 'proximo');
  });

  it('columnas de aviso interno y de reiteración externa vencida', () => {
    assert.deepEqual(nota().secciones[0].columnas,
      ['Conjunto de datos', 'Área', 'Frecuencia', 'Última actualización', 'Vence', 'Situación']);
    const reiteracion = nota({ tipo: 'reiteracion', gestion: 'externa', datasets: [dataset({ vencimiento: '2026-10-31' })] });
    assert.deepEqual(reiteracion.secciones[0].columnas,
      ['Conjunto de datos', 'Área responsable', 'Frecuencia', 'Última actualización', 'Venció', 'Situación', 'Informado en']);
  });

  it('informado en, con la cantidad de reiteraciones', () => {
    const informado = (reiteraciones) => nota({
      tipo: 'reiteracion',
      datasets: [dataset({ informado: { numero: 9, anio: 2026, fecha: '2026-10-01' }, reiteraciones })]
    }).secciones[0].filas[0].valores[6];
    assert.equal(informado(0), 'Nota Digital N° 9/26 (01/10/2026)');
    assert.equal(informado(1), 'Nota Digital N° 9/26 (01/10/2026) – reiterado 1 vez');
    assert.equal(informado(2), 'Nota Digital N° 9/26 (01/10/2026) – reiterado 2 veces');
  });

  it('antecedente de emails anteriores, solo en avisos', () => {
    const antecedente = (datos, tipo = 'aviso') => nota({ tipo, datasets: [dataset({ antecedente: datos })] }).secciones[0].filas[0].antecedente;
    assert.equal(antecedente({ cantidad: 10, primera: '2026-01-01', ultima: '2026-10-01' }),
      'Antecedente: notificado por correo electrónico en 10 oportunidades, entre el 01/01/2026 y el 01/10/2026.');
    assert.equal(antecedente({ cantidad: 1, primera: '2026-10-01', ultima: '2026-10-01' }),
      'Antecedente: notificado por correo electrónico el 01/10/2026.');
    assert.equal(antecedente({ cantidad: 1, primera: '2026-10-01', ultima: '2026-10-01' }, 'reiteracion'), null);
  });
});

describe('contactos', () => {
  const area = { id: 10, nombre: 'Área Uno', area_superior: 'Secretaría X', email_principal: 'uno@comodoro.gov.ar',
    email_secundario: null, telefono_area: '', celular_area: null, nombre_contacto: 'Persona', telefono_contacto: null, email_contacto: null };

  it('una entrada por área en la gestión externa, sin campos vacíos', () => {
    const externa = nota({ gestion: 'externa', datasets: [dataset(), dataset({ id: 2 })], areas: [area] });
    assert.deepEqual(externa.contactos, [{
      nombre: 'Área Uno',
      lineas: ['Depende de: Secretaría X', 'Email: uno@comodoro.gov.ar', 'Persona de contacto: Persona']
    }]);
  });

  it('área sin datos de contacto', () => {
    const vacia = { id: 11, nombre: 'Área Dos' };
    assert.deepEqual(nota({ gestion: 'externa', areas: [vacia] }).contactos,
      [{ nombre: 'Área Dos', lineas: ['Sin datos de contacto registrados'] }]);
  });

  it('la gestión interna no lleva contactos', () => {
    assert.deepEqual(nota({ areas: [area] }).contactos, []);
  });
});

describe('HTML', () => {
  it('escapa los datos y no deja links que no sean http/https', () => {
    const html = renderHtml(nota({ datasets: [dataset({ titulo: '<script>alert(1)</script>', url_dataset: 'javascript:alert(1)' })] }));
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(!html.includes('javascript:'));
  });

  it('enlaza el título cuando la URL es http/https', () => {
    assert.ok(renderHtml(nota()).includes('<a href="https://datos.comodoro.gov.ar/dataset/a"'));
  });

  it('incluye los textos del aviso interno', () => {
    const html = renderHtml(nota());
    assert.ok(html.includes('Informo a Ud. que los conjuntos de datos de gestión interna detallados a continuación'));
    assert.ok(html.includes('<b><u>DIRECCIÓN GENERAL DE MODERNIZACIÓN E INVESTIGACIÓN TERRITORIAL</u></b>'));
    assert.ok(html.includes('Ordenanza N° 17.662/23'));
    assert.ok(html.includes('Índice Nacional de Datos Abiertos'));
    assert.ok(html.includes('<b><u>DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN</u></b>, 2 de noviembre de 2026.'));
    assert.ok(html.includes('Nombre de Firma<br>Cargo de Firma'));
    assert.ok(html.includes('CC. Dir. de Investigación Territorial'));
  });

  it('la reiteración usa la justificación abreviada', () => {
    const html = renderHtml(nota({ tipo: 'reiteracion' }));
    assert.ok(html.includes('Informo a Ud. el estado, al día de la fecha'));
    assert.ok(!html.includes('Índice Nacional'));
  });
});

describe('texto plano', () => {
  it('lleva los mismos datos que el HTML', () => {
    const texto = renderTexto(nota({ gestion: 'externa', areas: [{ id: 10, nombre: 'Área Uno', email_principal: 'uno@comodoro.gov.ar' }] }));
    assert.ok(texto.includes(`REF.: "${REF}"`));
    assert.ok(texto.includes('Nota Digital N° 12/26'));
    assert.ok(texto.includes('- Dataset A (https://datos.comodoro.gov.ar/dataset/a)'));
    assert.ok(texto.includes('    Situación: Faltan 59 días'));
    assert.ok(texto.includes('    Email: uno@comodoro.gov.ar'));
    assert.ok(texto.trimEnd().endsWith('CC. Dir. Administrativa'));
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --test tests/notas-contenido.test.js`
Expected: FAIL con `Cannot find module '.../services/notasDigitalesContenido.js'`.

- [ ] **Step 3: Crear `services/notasDigitalesContenido.js`**

```js
// Contenido de las Notas Digitales: textos fijos, estructura de la nota y versiones HTML y texto plano.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 6)
import { formatoCorto, formatoLargo, mesYAnio, diasEntre } from './notasDigitalesCalendario.js';

const REF = 'Solicitud de gestión de datos para el Portal de Datos Abiertos Municipal';
const DESTINATARIO = 'DIRECCIÓN GENERAL DE MODERNIZACIÓN E INVESTIGACIÓN TERRITORIAL';
const REMITENTE = 'DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN';

const PARRAFO_INICIAL = {
  aviso: {
    interna: 'Informo a Ud. que los conjuntos de datos de gestión interna detallados a continuación, publicados en el Portal de Datos Abiertos Municipal, requieren ser actualizados. Solicito tenga a bien gestionar su actualización ante las áreas de esta Dirección General responsables de su producción.',
    externa: 'Informo a Ud. que los conjuntos de datos detallados a continuación, publicados en el Portal de Datos Abiertos Municipal y provistos por otras áreas municipales y organismos, requieren ser actualizados. Solicito tenga a bien gestionar, por las vías administrativas correspondientes, ante las áreas responsables, la remisión de la información actualizada en formato digital editable (Excel, CSV, etc.).'
  },
  reiteracion: {
    interna: 'Informo a Ud. el estado, al día de la fecha, de los conjuntos de datos de gestión interna informados oportunamente que continúan pendientes de actualización en el Portal de Datos Abiertos Municipal. Solicito tenga a bien gestionar su actualización ante las áreas de esta Dirección General responsables de su producción.',
    externa: 'Informo a Ud. el estado, al día de la fecha, de los conjuntos de datos informados oportunamente que continúan pendientes de actualización en el Portal de Datos Abiertos Municipal. Solicito tenga a bien gestionar, por las vías administrativas correspondientes, ante las áreas responsables, la remisión de la información actualizada en formato digital editable (Excel, CSV, etc.).'
  }
};

const SECCIONES = {
  proximo: {
    titulo: 'Próximos a vencer',
    introduccion: 'Los siguientes conjuntos de datos se encuentran próximos a cumplir su plazo de actualización:'
  },
  vencido: {
    titulo: 'Plazo de actualización vencido',
    introduccion: 'Los siguientes conjuntos de datos se encuentran con su plazo de actualización vencido:'
  }
};

const JUSTIFICACION = {
  aviso: [
    'La presente se enmarca en la Ordenanza N° 17.662/23, que promueve mantener actualizados los datos, tanto de áreas municipales como de organismos externos, en el Portal de Datos Abiertos Municipal (datos.comodoro.gov.ar).',
    'Cabe destacar que Comodoro Rivadavia se encuentra entre los primeros puestos del Índice Nacional de Datos Abiertos. En este marco, mantener la información actualizada contribuye directamente a sostener y fortalecer este posicionamiento.',
    'La información actualizada puede ser remitida a los correos electrónicos datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar, o vía WhatsApp al +54 9 2974 05-6894. Una vez recibida, será publicada en el Portal de Datos Abiertos Municipal en cumplimiento del Artículo 9° de la mencionada ordenanza.'
  ],
  reiteracion: [
    'La presente se enmarca en la Ordenanza N° 17.662/23, que promueve mantener actualizados los datos en el Portal de Datos Abiertos Municipal (datos.comodoro.gov.ar). La información actualizada puede ser remitida a datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar, o vía WhatsApp al +54 9 2974 05-6894, y será publicada en cumplimiento del Artículo 9° de la mencionada ordenanza.'
  ]
};

const CAMPOS_CONTACTO = [
  ['area_superior', 'Depende de'],
  ['email_principal', 'Email'],
  ['email_secundario', 'Email alternativo'],
  ['telefono_area', 'Teléfono'],
  ['celular_area', 'Celular'],
  ['nombre_contacto', 'Persona de contacto'],
  ['telefono_contacto', 'Teléfono de contacto'],
  ['email_contacto', 'Email de contacto']
];

export const escapeHtml = (texto) => String(texto ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const urlSegura = (url) => (typeof url === 'string' && /^https?:\/\//i.test(url.trim()) ? url.trim() : null);
const cantidad = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

const textoNumero = ({ numero, anio, esPrueba = false }) => {
  if (esPrueba) return 'PRUEBA';
  if (numero == null) return 'XX';
  return `${numero}/${String(anio).slice(-2)}`;
};

const situacion = (vencimiento, fecha) => {
  const dias = diasEntre(fecha, vencimiento);
  if (dias > 0) return `Faltan ${cantidad(dias, 'día', 'días')}`;
  if (dias === 0) return 'Vence hoy';
  return `Vencido hace ${cantidad(-dias, 'día', 'días')}`;
};

const textoInformado = (dataset) => {
  if (!dataset.informado) return '—';
  const { numero, anio, fecha } = dataset.informado;
  const base = `Nota Digital N° ${textoNumero({ numero, anio })} (${formatoCorto(fecha)})`;
  return dataset.reiteraciones > 0 ? `${base} – reiterado ${cantidad(dataset.reiteraciones, 'vez', 'veces')}` : base;
};

const textoAntecedente = (antecedente) => {
  if (!antecedente) return null;
  if (antecedente.cantidad === 1) {
    return `Antecedente: notificado por correo electrónico el ${formatoCorto(antecedente.primera)}.`;
  }
  return `Antecedente: notificado por correo electrónico en ${antecedente.cantidad} oportunidades, entre el ${formatoCorto(antecedente.primera)} y el ${formatoCorto(antecedente.ultima)}.`;
};

export const construirNota = ({ tipo, gestion, numero = null, anio = null, esPrueba = false, fecha, datasets, areas = [], config }) => {
  const numeroTexto = textoNumero({ numero, anio, esPrueba });
  const ref = `${tipo === 'reiteracion' ? 'Reiteración – ' : ''}${REF}`;
  const asunto = `${esPrueba ? '[PRUEBA] ' : ''}Nota Digital N° ${numeroTexto} – Ref.: ${ref} (gestión ${gestion} – ${mesYAnio(fecha)})`;

  const secciones = ['proximo', 'vencido'].map((clave) => {
    const incluidos = datasets.filter(d => (d.vencimiento < fecha ? 'vencido' : 'proximo') === clave);
    const columnas = ['Conjunto de datos', gestion === 'externa' ? 'Área responsable' : 'Área', 'Frecuencia',
      'Última actualización', clave === 'vencido' ? 'Venció' : 'Vence', 'Situación'];
    if (tipo === 'reiteracion') columnas.push('Informado en');
    const filas = incluidos.map((d) => {
      const valores = [d.titulo, d.area_nombre, d.frecuencia_nombre, formatoCorto(d.ultima_actualizacion),
        formatoCorto(d.vencimiento), situacion(d.vencimiento, fecha)];
      if (tipo === 'reiteracion') valores.push(textoInformado(d));
      return {
        valores,
        url: urlSegura(d.url_dataset),
        antecedente: tipo === 'aviso' ? textoAntecedente(d.antecedente) : null
      };
    });
    return { clave, ...SECCIONES[clave], columnas, filas };
  }).filter(seccion => seccion.filas.length > 0);

  const contactos = gestion === 'externa'
    ? areas.map((area) => {
      const lineas = CAMPOS_CONTACTO
        .filter(([campo]) => String(area[campo] ?? '').trim())
        .map(([campo, etiqueta]) => `${etiqueta}: ${area[campo]}`);
      return { nombre: area.nombre, lineas: lineas.length ? lineas : ['Sin datos de contacto registrados'] };
    })
    : [];

  return {
    tipo,
    gestion,
    esPrueba,
    fecha,
    numeroTexto,
    asunto,
    ref,
    destinatario: DESTINATARIO,
    parrafoInicial: PARRAFO_INICIAL[tipo][gestion],
    secciones,
    contactos,
    justificacion: JUSTIFICACION[tipo],
    remitente: REMITENTE,
    fechaLarga: formatoLargo(fecha),
    firma: { nombre: config.firma_nombre ?? '', cargo: config.firma_cargo ?? '' },
    lineaCc: (gestion === 'externa' ? config.linea_cc_externa : config.linea_cc_interna) ?? ''
  };
};

const ESTILO_CELDA = 'border:1px solid #000000;padding:5px 6px;vertical-align:top;text-align:left;';

export const renderHtml = (nota) => {
  const parrafo = (texto) => `<p style="margin:0 0 12px;text-align:justify;">${escapeHtml(texto)}</p>`;

  const tabla = (seccion) => {
    const encabezado = seccion.columnas.map(c => `<th style="${ESTILO_CELDA}font-weight:bold;">${escapeHtml(c)}</th>`).join('');
    const filas = seccion.filas.map((fila) => {
      const [titulo, ...resto] = fila.valores;
      const celdaTitulo = fila.url
        ? `<a href="${escapeHtml(fila.url)}" style="color:#000000;">${escapeHtml(titulo)}</a>`
        : escapeHtml(titulo);
      const principal = `<tr><td style="${ESTILO_CELDA}">${celdaTitulo}</td>${resto.map(v => `<td style="${ESTILO_CELDA}">${escapeHtml(v)}</td>`).join('')}</tr>`;
      const antecedente = fila.antecedente
        ? `<tr><td colspan="${seccion.columnas.length}" style="${ESTILO_CELDA}font-style:italic;font-size:12px;">${escapeHtml(fila.antecedente)}</td></tr>`
        : '';
      return principal + antecedente;
    }).join('');
    return `<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 16px;"><tr>${encabezado}</tr>${filas}</table>`;
  };

  const secciones = nota.secciones
    .map(s => `<p style="margin:16px 0 6px;"><b>${escapeHtml(s.titulo)}</b></p>${parrafo(s.introduccion)}${tabla(s)}`)
    .join('\n');

  const contactos = nota.contactos.length
    ? `<p style="margin:16px 0 6px;"><b>Datos de contacto de las áreas responsables</b></p>${nota.contactos
      .map(c => `<p style="margin:0 0 10px;"><b>${escapeHtml(c.nombre)}</b><br>${c.lineas.map(escapeHtml).join('<br>')}</p>`)
      .join('')}`
    : '';

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${escapeHtml(nota.asunto)}</title></head>
<body style="margin:0;padding:24px;background:#ffffff;">
<div style="max-width:760px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45;color:#000000;">
<p style="margin:0 0 4px;"><b><u>REF.:</u></b> "${escapeHtml(nota.ref)}"</p>
<p style="margin:0 0 24px;text-align:right;"><b>Nota Digital N°</b> ${escapeHtml(nota.numeroTexto)}</p>
<p style="margin:0 0 16px;"><b><u>${escapeHtml(nota.destinatario)}</u></b></p>
${parrafo(nota.parrafoInicial)}
${secciones}
${contactos}
<p style="margin:16px 0 6px;"><b>Justificación:</b></p>
${nota.justificacion.map(parrafo).join('\n')}
<p style="margin:24px 0 0;"><b><u>${escapeHtml(nota.remitente)}</u></b>, ${escapeHtml(nota.fechaLarga)}.</p>
<p style="margin:32px 0 0;text-align:right;">${escapeHtml(nota.firma.nombre)}<br>${escapeHtml(nota.firma.cargo)}</p>
<p style="margin:24px 0 0;">${escapeHtml(nota.lineaCc)}</p>
</div></body></html>`;
};

export const renderTexto = (nota) => {
  const lineas = [`REF.: "${nota.ref}"`, `Nota Digital N° ${nota.numeroTexto}`, '', nota.destinatario, '', nota.parrafoInicial, ''];
  for (const seccion of nota.secciones) {
    lineas.push(seccion.titulo, seccion.introduccion, '');
    for (const fila of seccion.filas) {
      lineas.push(`- ${fila.valores[0]}${fila.url ? ` (${fila.url})` : ''}`);
      seccion.columnas.slice(1).forEach((columna, i) => lineas.push(`    ${columna}: ${fila.valores[i + 1]}`));
      if (fila.antecedente) lineas.push(`    ${fila.antecedente}`);
    }
    lineas.push('');
  }
  if (nota.contactos.length) {
    lineas.push('Datos de contacto de las áreas responsables');
    for (const contacto of nota.contactos) lineas.push(contacto.nombre, ...contacto.lineas.map(l => `    ${l}`));
    lineas.push('');
  }
  lineas.push('Justificación:', ...nota.justificacion, '', `${nota.remitente}, ${nota.fechaLarga}.`, '',
    nota.firma.nombre, nota.firma.cargo, '', nota.lineaCc);
  return lineas.join('\n');
};
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `node --test tests/notas-contenido.test.js`
Expected: PASS (17 tests).

- [ ] **Step 5: Commit**

```bash
git add services/notasDigitalesContenido.js tests/notas-contenido.test.js
git commit -m "feat: contenido de las Notas Digitales (textos, HTML y texto plano)"
```

---

### Task 5: PDF de la nota

**Files:**
- Create: `services/notasDigitalesPdf.js`
- Test: `tests/notas-pdf.test.js`

**Interfaces:**
- Consumes: `construirNota` (Tarea 4) para armar notas en el test.
- Produces: `renderPdf(nota: Nota, { firmaImagen?: Buffer|null } = {}) → Promise<Buffer>`. El PDF lleva `Title` = `Nota Digital ${nota.numeroTexto}`.

- [ ] **Step 1: Escribir el test que falla `tests/notas-pdf.test.js`**

```js
// PDF de las Notas Digitales
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { construirNota } from '../services/notasDigitalesContenido.js';
import { renderPdf } from '../services/notasDigitalesPdf.js';

// PNG válido de 1x1 píxel
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const config = { linea_cc_interna: 'CC. Dir. de Investigación Territorial', linea_cc_externa: 'CC. Dir. Administrativa', firma_nombre: 'Nombre', firma_cargo: 'Cargo' };

const dataset = (i) => ({
  id: i, titulo: `Dataset ${i} con un título bastante largo para que ocupe más de una línea en la tabla del PDF`,
  url_dataset: 'https://datos.comodoro.gov.ar/dataset/x', area_id: 1, area_nombre: 'Área de prueba',
  frecuencia_nombre: 'Anualmente', ultima_actualizacion: '2025-12-31', vencimiento: i % 2 ? '2026-12-31' : '2026-10-31',
  informado: null, reiteraciones: 0, antecedente: i % 3 ? null : { cantidad: 4, primera: '2026-01-01', ultima: '2026-10-01' }
});

const nota = (cantidad, cambios = {}) => construirNota({
  tipo: 'aviso', gestion: 'externa', numero: 12, anio: 2026, esPrueba: false, fecha: '2026-11-02',
  datasets: Array.from({ length: cantidad }, (_, i) => dataset(i + 1)),
  areas: [{ id: 1, nombre: 'Área de prueba', email_principal: 'area@rpad.test' }], config, ...cambios
});

const texto = (pdf) => pdf.toString('latin1');
const paginas = (pdf) => (texto(pdf).match(/\/Type \/Page[^s]/g) || []).length;

describe('renderPdf', () => {
  it('genera un PDF oficio con el número en el título', async () => {
    const pdf = await renderPdf(nota(2));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.match(texto(pdf), /\/MediaBox \[0 0 612\.28\d* 935\.43\d*\]/);
    assert.ok(texto(pdf).includes('(Nota Digital 12/26)'));
  });

  it('incluye la imagen de la firma solo si está cargada', async () => {
    assert.ok(texto(await renderPdf(nota(1), { firmaImagen: PNG })).includes('/Subtype /Image'));
    assert.ok(!texto(await renderPdf(nota(1))).includes('/Subtype /Image'));
  });

  it('una nota con 60 datasets ocupa varias hojas sin errores', async () => {
    const pdf = await renderPdf(nota(60), { firmaImagen: PNG });
    assert.ok(paginas(pdf) >= 2, `páginas: ${paginas(pdf)}`);
  });

  it('una nota corta ocupa una sola hoja', async () => {
    assert.equal(paginas(await renderPdf(nota(1))), 1);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --test tests/notas-pdf.test.js`
Expected: FAIL con `Cannot find module '.../services/notasDigitalesPdf.js'`.

- [ ] **Step 3: Crear `services/notasDigitalesPdf.js`**

```js
// PDF de la Nota Digital con el formato de la Resolución 2820/2022: hoja oficio, Helvetica 12.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 6.6)
import PDFDocument from 'pdfkit';

const MM = 72 / 25.4;
const PAGINA = [216 * MM, 330 * MM];
const MARGENES = { top: 25 * MM, bottom: 25 * MM, left: 30 * MM, right: 30 * MM };
const NORMAL = 'Helvetica';
const NEGRITA = 'Helvetica-Bold';
const CURSIVA = 'Helvetica-Oblique';
// Proporción del ancho de cada columna: 6 columnas en avisos, 7 en reiteraciones
const PROPORCIONES = { 6: [32, 17, 12, 13, 11, 15], 7: [26, 14, 10, 11, 10, 13, 16] };
const TAMANO_TABLA = 8.5;
const RELLENO = 3;

const dibujarTabla = (doc, seccion, ancho) => {
  const anchos = PROPORCIONES[seccion.columnas.length].map(p => (p / 100) * ancho);
  const limite = () => doc.page.height - MARGENES.bottom;
  const izquierda = MARGENES.left;

  const altoDe = (valores, fuente) => {
    doc.font(fuente).fontSize(TAMANO_TABLA);
    return Math.max(...valores.map((v, i) => doc.heightOfString(String(v), { width: anchos[i] - 2 * RELLENO }))) + 2 * RELLENO;
  };

  const fila = (valores, fuente, url = null) => {
    const alto = altoDe(valores, fuente);
    if (doc.y + alto > limite()) {
      doc.addPage();
      if (fuente !== NEGRITA) encabezado();
    }
    const y = doc.y;
    let x = izquierda;
    valores.forEach((valor, i) => {
      doc.lineWidth(0.5).rect(x, y, anchos[i], alto).stroke();
      doc.font(fuente).fontSize(TAMANO_TABLA)
        .text(String(valor), x + RELLENO, y + RELLENO, { width: anchos[i] - 2 * RELLENO, link: i === 0 && url ? url : null });
      x += anchos[i];
    });
    doc.x = izquierda;
    doc.y = y + alto;
  };

  const encabezado = () => fila(seccion.columnas, NEGRITA);

  const filaAncha = (texto) => {
    doc.font(CURSIVA).fontSize(TAMANO_TABLA);
    const alto = doc.heightOfString(texto, { width: ancho - 2 * RELLENO }) + 2 * RELLENO;
    if (doc.y + alto > limite()) {
      doc.addPage();
      encabezado();
    }
    const y = doc.y;
    doc.lineWidth(0.5).rect(izquierda, y, ancho, alto).stroke();
    doc.font(CURSIVA).fontSize(TAMANO_TABLA).text(texto, izquierda + RELLENO, y + RELLENO, { width: ancho - 2 * RELLENO });
    doc.x = izquierda;
    doc.y = y + alto;
  };

  encabezado();
  for (const f of seccion.filas) {
    fila(f.valores, NORMAL, f.url);
    if (f.antecedente) filaAncha(f.antecedente);
  }
};

const agregarPies = (doc, nota, ancho) => {
  const { start, count } = doc.bufferedPageRange();
  if (count < 2) return;
  for (let i = 0; i < count; i++) {
    doc.switchToPage(start + i);
    // Sin margen inferior temporalmente: escribir debajo del margen agregaría una hoja
    const inferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font(NORMAL).fontSize(8).text(`Nota Digital N° ${nota.numeroTexto} – Página ${i + 1} de ${count}`,
      MARGENES.left, doc.page.height - inferior / 2, { width: ancho, align: 'center', lineBreak: false });
    doc.page.margins.bottom = inferior;
  }
};

export const renderPdf = (nota, { firmaImagen = null } = {}) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({
    size: PAGINA,
    margins: MARGENES,
    bufferPages: true,
    info: { Title: `Nota Digital ${nota.numeroTexto}`, Author: 'Dirección de Datos Públicos y Comunicación', Subject: nota.asunto }
  });
  const partes = [];
  doc.on('data', parte => partes.push(parte));
  doc.on('end', () => resolve(Buffer.concat(partes)));
  doc.on('error', reject);

  try {
    const ancho = doc.page.width - MARGENES.left - MARGENES.right;
    const asegurarEspacio = (alto) => {
      if (doc.y + alto > doc.page.height - MARGENES.bottom) doc.addPage();
    };
    const parrafo = (texto, { fuente = NORMAL, tamano = 12, align = 'justify', underline = false, espacio = 0.6 } = {}) => {
      doc.font(fuente).fontSize(tamano).text(texto, MARGENES.left, doc.y, { width: ancho, align, underline });
      doc.moveDown(espacio);
    };

    // REF., número y destinatario
    doc.font(NEGRITA).fontSize(12).text('REF.:', MARGENES.left, MARGENES.top, { underline: true, continued: true })
      .font(NORMAL).text(` "${nota.ref}"`, { underline: false });
    doc.moveDown(0.3);
    parrafo(`Nota Digital N° ${nota.numeroTexto}`, { fuente: NEGRITA, align: 'right', espacio: 1.2 });
    parrafo(nota.destinatario, { fuente: NEGRITA, underline: true, align: 'left', espacio: 1 });
    parrafo(nota.parrafoInicial);

    for (const seccion of nota.secciones) {
      asegurarEspacio(60);
      parrafo(seccion.titulo, { fuente: NEGRITA, align: 'left', espacio: 0.3 });
      parrafo(seccion.introduccion, { espacio: 0.4 });
      dibujarTabla(doc, seccion, ancho);
      doc.moveDown(0.8);
    }

    if (nota.contactos.length) {
      asegurarEspacio(40);
      parrafo('Datos de contacto de las áreas responsables', { fuente: NEGRITA, align: 'left', espacio: 0.4 });
      for (const contacto of nota.contactos) {
        asegurarEspacio(14 * (contacto.lineas.length + 1));
        parrafo(contacto.nombre, { fuente: NEGRITA, tamano: 10, align: 'left', espacio: 0.1 });
        parrafo(contacto.lineas.join('\n'), { tamano: 10, align: 'left', espacio: 0.5 });
      }
    }

    asegurarEspacio(40);
    parrafo('Justificación:', { fuente: NEGRITA, align: 'left', espacio: 0.3 });
    nota.justificacion.forEach(texto => parrafo(texto));

    asegurarEspacio(30);
    doc.moveDown(0.6);
    doc.font(NEGRITA).fontSize(12).text(nota.remitente, MARGENES.left, doc.y, { underline: true, continued: true })
      .font(NORMAL).text(`, ${nota.fechaLarga}.`, { underline: false });

    // Firma a la derecha: imagen (si está cargada), nombre y cargo
    const anchoFirma = 200;
    const xFirma = MARGENES.left + ancho - anchoFirma;
    asegurarEspacio(120);
    doc.moveDown(1.5);
    let y = doc.y;
    if (firmaImagen) {
      doc.image(firmaImagen, xFirma + (anchoFirma - 140) / 2, y, { fit: [140, 60], align: 'center', valign: 'bottom' });
      y += 64;
    } else {
      y += 30;
    }
    doc.font(NORMAL).fontSize(11).text(nota.firma.nombre, xFirma, y, { width: anchoFirma, align: 'center' });
    doc.text(nota.firma.cargo, xFirma, doc.y, { width: anchoFirma, align: 'center' });

    doc.moveDown(1.5);
    parrafo(nota.lineaCc, { tamano: 11, align: 'left' });

    agregarPies(doc, nota, ancho);
    doc.end();
  } catch (error) {
    reject(error);
  }
});
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `node --test tests/notas-pdf.test.js`
Expected: PASS (4 tests). Si "una nota corta ocupa una sola hoja" falla, revisar que `asegurarEspacio` de la firma no agregue una hoja de más (el alto disponible en oficio es ~795 pt).

- [ ] **Step 5: Inspección visual**

Run: `node --input-type=module -e "import('./services/notasDigitalesContenido.js').then(async c=>{const {renderPdf}=await import('./services/notasDigitalesPdf.js');const fs=await import('fs');const n=c.construirNota({tipo:'aviso',gestion:'externa',numero:1,anio:2026,fecha:'2026-11-02',datasets:[{id:1,titulo:'Dataset de prueba',url_dataset:'https://datos.comodoro.gov.ar',area_id:1,area_nombre:'Área',frecuencia_nombre:'Anualmente',ultima_actualizacion:'2025-10-31',vencimiento:'2026-10-31',informado:null,reiteraciones:0,antecedente:{cantidad:3,primera:'2026-01-01',ultima:'2026-10-01'}}],areas:[{id:1,nombre:'Área',email_principal:'area@rpad.test'}],config:{linea_cc_interna:'CC. Dir. de Investigación Territorial',linea_cc_externa:'CC. Dir. Administrativa',firma_nombre:'Nombre',firma_cargo:'Cargo'}});const firma=fs.existsSync('database/dump-local/firma.png')?fs.readFileSync('database/dump-local/firma.png'):null;fs.writeFileSync(process.env.TEMP+'/nota-prueba.pdf',await renderPdf(n,{firmaImagen:firma}));console.log('ok');})"`
Expected: `ok`. Abrir el PDF en `%TEMP%/nota-prueba.pdf` y comprobar visualmente: REF. arriba, número a la derecha, tabla con bordes, antecedente en cursiva, firma a la derecha sobre nombre y cargo, CC al final.

- [ ] **Step 6: Commit**

```bash
git add services/notasDigitalesPdf.js tests/notas-pdf.test.js
git commit -m "feat: PDF oficio de las Notas Digitales con firma"
```

---

### Task 6: Selección de datasets y consultas

**Files:**
- Create: `services/notasDigitalesDatos.js`
- Create: `tests/notas-fixtures.js`
- Test: `tests/notas-datos.test.js`

**Interfaces:**
- Consumes: `crearBaseDePrueba`, `query`, `cerrarDb` (Tarea 1).
- Produces:
  - `VENTANA_DIAS = { interna: 60, externa: 30 }`, `DIAS_PARA_REITERAR = 21`, `TIPOS_EMAIL_REEMPLAZADOS: string[]`.
  - `obtenerConfig() → Promise<object>`: la fila de `notas_digitales_config`.
  - `seleccionarParaAviso(gestion, hoy) → Promise<DatasetNota[]>`, sin `informado`, `reiteraciones` ni `antecedente`.
  - `seleccionarParaReiteracion(gestion, hoy) → Promise<DatasetNota[]>`, con `informado` y `reiteraciones`.
  - `pendientesDeAviso(gestion) → Promise<string[]>`: vencimientos de los datasets sin aviso para su vencimiento actual, sin límite de ventana.
  - `antecedentesDe(ids) → Promise<Map<id, { cantidad, primera, ultima }>>`.
  - `areasDe(ids) → Promise<AreaContacto[]>`, ordenadas por nombre.
  - Fixtures (`tests/notas-fixtures.js`): `crearArea(datos?) → id`, `crearDataset({ titulo?, gestion?, vencimiento, ultima?, areaId?, frecuencia?, activo?, url? }) → id`, `crearNota({ tipo?, gestion?, fecha, numero?, anio?, estado?, esPrueba?, intentos?, datasets?: [{ id, vencimiento, seccion? }] }) → id`, `crearEmailViejo({ tipo, datasetIds, enviado, success? })`, `limpiarBase()`, `configurarNotas(cambios?)`.

- [ ] **Step 1: Crear `tests/notas-fixtures.js`**

```js
// Datos de prueba para los tests de Notas Digitales. Solo se usan sobre bases creadas con crearBaseDePrueba.
import crypto from 'crypto';
import { query } from './helpers.js';

const sufijo = () => crypto.randomBytes(3).toString('hex');

export const crearArea = async (datos = {}) => {
  const fila = {
    nombre: `Área de prueba ${sufijo()}`, area_superior: null, email_principal: null, email_secundario: null,
    telefono_area: null, celular_area: null, nombre_contacto: null, telefono_contacto: null, email_contacto: null,
    ...datos
  };
  const columnas = Object.keys(fila);
  const resultado = await query(
    `INSERT INTO areas (${columnas.join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`,
    Object.values(fila)
  );
  return resultado.insertId;
};

export const crearDataset = async ({
  titulo = `Dataset de prueba ${sufijo()}`, gestion = 'interna', vencimiento, ultima = null, areaId,
  frecuencia = 'Anualmente', activo = 1, url = 'https://datos.comodoro.gov.ar/dataset/prueba'
}) => {
  const [f] = await query('SELECT id FROM frecuencias WHERE nombre = ?', [frecuencia]);
  if (!f) throw new Error(`No existe la frecuencia ${frecuencia}`);
  const [tema] = await query('SELECT id FROM temas ORDER BY id LIMIT 1');
  const area = areaId ?? await crearArea();
  const resultado = await query(
    `INSERT INTO datasets (titulo, area_id, frecuencia_id, ultima_actualizacion, proxima_actualizacion,
       tema_principal_id, url_dataset, tipo_gestion, activo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [titulo, area, f.id, ultima, vencimiento ?? null, tema.id, url, gestion, activo]
  );
  return resultado.insertId;
};

export const crearNota = async ({
  tipo = 'aviso', gestion = 'interna', fecha, numero = null, anio, estado = 'enviada', esPrueba = 0, intentos = 1, datasets = []
}) => {
  const resultado = await query(
    `INSERT INTO notas_digitales (numero, anio, tipo, gestion, periodo, fecha, es_prueba, asunto, para, html, texto, pdf, estado, intentos)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Nota de prueba', 'prueba@rpad.test', '', '', '', ?, ?)`,
    [numero, anio ?? (esPrueba ? null : Number(fecha.slice(0, 4))), tipo, gestion,
      tipo === 'reiteracion' ? fecha.slice(0, 7) : null, fecha, esPrueba, estado, intentos]
  );
  for (const d of datasets) {
    await query('INSERT INTO notas_digitales_datasets (nota_id, dataset_id, seccion, vencimiento) VALUES (?, ?, ?, ?)',
      [resultado.insertId, d.id, d.seccion ?? 'proximo', d.vencimiento]);
  }
  return resultado.insertId;
};

export const crearEmailViejo = ({ tipo, datasetIds, enviado, success = 1 }) => query(
  `INSERT INTO notificaciones_log (tipo, area_id, destinatarios, datasets_ids, cantidad_datasets, enviado_at, success)
   VALUES (?, NULL, 'mit@rpad.test', ?, ?, ?, ?)`,
  [tipo, datasetIds.join(','), datasetIds.length, enviado, success]
);

export const limpiarBase = async () => {
  await query('DELETE FROM notas_digitales');
  await query('DELETE FROM notificaciones_log');
  await query('DELETE FROM datasets');
  await query('DELETE FROM areas');
  await query('UPDATE notas_digitales_config SET reiteracion_evaluada_interna = NULL, reiteracion_evaluada_externa = NULL WHERE id = 1');
};

export const configurarNotas = async (cambios = {}) => {
  const valores = {
    envio_activo: 1, para_interna: 'mit@rpad.test', cc_interna: 'geo@rpad.test', para_externa: 'mit@rpad.test',
    cc_externa: 'adm@rpad.test', cco: 'respaldo@rpad.test', firma_nombre: 'Firma de Prueba',
    firma_cargo: 'Cargo de Prueba', casillas_prueba: 'prueba@rpad.test', ...cambios
  };
  const columnas = Object.keys(valores);
  await query(`UPDATE notas_digitales_config SET ${columnas.map(c => `${c} = ?`).join(', ')} WHERE id = 1`, Object.values(valores));
};
```

- [ ] **Step 2: Escribir el test que falla `tests/notas-datos.test.js`**

```js
// Selección de datasets para avisos y reiteraciones (base de prueba propia)
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, cerrarDb } from './helpers.js';
import { crearDataset, crearNota, crearEmailViejo, limpiarBase, crearArea } from './notas-fixtures.js';

let base, datos;

before(async () => {
  base = await crearBaseDePrueba('rpad_test_notas_datos');
  process.env.DB_NAME = base.nombre;
  datos = await import('../services/notasDigitalesDatos.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  await base?.borrar();
});

beforeEach(() => limpiarBase());

const ids = (lista) => lista.map(d => d.id);

describe('seleccionarParaAviso', () => {
  it('toma los que vencen dentro de la ventana y los vencidos, ordenados por vencimiento', async () => {
    const enVentana = await crearDataset({ vencimiento: '2026-12-31' });
    const justo60 = await crearDataset({ vencimiento: '2027-01-01' });
    await crearDataset({ vencimiento: '2027-01-02' });
    const vencido = await crearDataset({ vencimiento: '2026-09-30' });
    const resultado = await datos.seleccionarParaAviso('interna', '2026-11-02');
    assert.deepEqual(ids(resultado), [vencido, enVentana, justo60]);
    assert.equal(resultado[0].vencimiento, '2026-09-30');
  });

  it('respeta la ventana de 30 días de la gestión externa y separa por gestión', async () => {
    const externa = await crearDataset({ gestion: 'externa', vencimiento: '2026-11-30' });
    await crearDataset({ gestion: 'externa', vencimiento: '2026-12-31' });
    await crearDataset({ gestion: 'interna', vencimiento: '2026-11-30' });
    assert.deepEqual(ids(await datos.seleccionarParaAviso('externa', '2026-11-02')), [externa]);
  });

  it('excluye eventuales, inactivos y sin fecha', async () => {
    await crearDataset({ vencimiento: '2026-11-30', frecuencia: 'Eventual' });
    await crearDataset({ vencimiento: '2026-11-30', activo: 0 });
    await crearDataset({ vencimiento: null });
    assert.deepEqual(await datos.seleccionarParaAviso('interna', '2026-11-02'), []);
  });

  it('un aviso (aunque haya fallado) bloquea un segundo aviso del mismo vencimiento; una prueba no', async () => {
    const avisado = await crearDataset({ vencimiento: '2026-12-31' });
    const fallido = await crearDataset({ vencimiento: '2026-12-31' });
    const conPrueba = await crearDataset({ vencimiento: '2026-12-31' });
    await crearNota({ fecha: '2026-11-02', numero: 1, datasets: [{ id: avisado, vencimiento: '2026-12-31' }] });
    await crearNota({ fecha: '2026-11-02', numero: 2, estado: 'fallida', datasets: [{ id: fallido, vencimiento: '2026-12-31' }] });
    await crearNota({ fecha: '2026-11-02', esPrueba: 1, datasets: [{ id: conPrueba, vencimiento: '2026-12-31' }] });
    assert.deepEqual(ids(await datos.seleccionarParaAviso('interna', '2026-11-03')), [conPrueba]);
  });

  it('si cambia el vencimiento, vuelve a estar disponible para aviso', async () => {
    const id = await crearDataset({ vencimiento: '2026-12-15' });
    await crearNota({ fecha: '2026-11-02', numero: 1, datasets: [{ id, vencimiento: '2026-11-30' }] });
    assert.deepEqual(ids(await datos.seleccionarParaAviso('interna', '2026-11-03')), [id]);
  });
});

describe('seleccionarParaReiteracion', () => {
  it('toma los avisados hace 21 días o más que siguen con el mismo vencimiento', async () => {
    const hace29 = await crearDataset({ vencimiento: '2026-12-31' });
    const hace21 = await crearDataset({ vencimiento: '2026-12-31' });
    const hace11 = await crearDataset({ vencimiento: '2027-01-19' });
    const avisoFallido = await crearDataset({ vencimiento: '2026-11-30' });
    const actualizado = await crearDataset({ vencimiento: '2027-10-31' });
    await crearNota({ fecha: '2026-11-02', numero: 1, datasets: [{ id: hace29, vencimiento: '2026-12-31' }] });
    await crearNota({ fecha: '2026-11-10', numero: 2, datasets: [{ id: hace21, vencimiento: '2026-12-31' }] });
    await crearNota({ fecha: '2026-11-20', numero: 3, datasets: [{ id: hace11, vencimiento: '2027-01-19' }] });
    await crearNota({ fecha: '2026-10-01', numero: 4, estado: 'fallida', datasets: [{ id: avisoFallido, vencimiento: '2026-11-30' }] });
    await crearNota({ fecha: '2026-10-01', numero: 5, datasets: [{ id: actualizado, vencimiento: '2026-10-31' }] });

    const resultado = await datos.seleccionarParaReiteracion('interna', '2026-12-01');
    assert.deepEqual(ids(resultado).sort(), [hace29, hace21].sort());
    const primero = resultado.find(d => d.id === hace29);
    assert.deepEqual(primero.informado, { numero: 1, anio: 2026, fecha: '2026-11-02' });
    assert.equal(primero.reiteraciones, 0);
  });

  it('cuenta solo las reiteraciones enviadas del mismo ciclo', async () => {
    const id = await crearDataset({ vencimiento: '2026-10-31' });
    await crearNota({ fecha: '2026-09-01', numero: 1, datasets: [{ id, vencimiento: '2026-10-31' }] });
    await crearNota({ tipo: 'reiteracion', fecha: '2026-10-01', numero: 2, datasets: [{ id, vencimiento: '2026-10-31' }] });
    await crearNota({ tipo: 'reiteracion', fecha: '2026-11-02', numero: 3, estado: 'fallida', datasets: [{ id, vencimiento: '2026-10-31', seccion: 'vencido' }] });
    const [dataset] = await datos.seleccionarParaReiteracion('interna', '2026-12-01');
    assert.equal(dataset.reiteraciones, 1);
  });
});

describe('pendientesDeAviso', () => {
  it('devuelve los vencimientos sin aviso, sin límite de ventana', async () => {
    await crearDataset({ gestion: 'externa', vencimiento: '2027-06-30' });
    const avisado = await crearDataset({ gestion: 'externa', vencimiento: '2026-11-30' });
    await crearNota({ gestion: 'externa', fecha: '2026-11-02', numero: 1, datasets: [{ id: avisado, vencimiento: '2026-11-30' }] });
    assert.deepEqual(await datos.pendientesDeAviso('externa'), ['2027-06-30']);
  });
});

describe('antecedentesDe', () => {
  it('cuenta los emails viejos exitosos del ciclo actual de los tipos reemplazados', async () => {
    const id = await crearDataset({ gestion: 'externa', vencimiento: '2026-07-31', ultima: '2025-12-31' });
    const otro = await crearDataset({ gestion: 'externa', vencimiento: '2026-07-31' });
    await crearEmailViejo({ tipo: 'externo-vencido', datasetIds: [otro, id], enviado: '2026-01-01 08:00:00' });
    await crearEmailViejo({ tipo: 'interno-60', datasetIds: [id], enviado: '2026-10-01 08:00:00' });
    await crearEmailViejo({ tipo: 'area-aviso-40', datasetIds: [id], enviado: '2026-05-01 08:00:00' });
    await crearEmailViejo({ tipo: 'externo-5', datasetIds: [id], enviado: '2025-11-01 08:00:00' });
    await crearEmailViejo({ tipo: 'externo-40', datasetIds: [id], enviado: '2026-03-01 08:00:00', success: 0 });

    const antecedentes = await datos.antecedentesDe([id, otro]);
    assert.deepEqual(antecedentes.get(id), { cantidad: 2, primera: '2026-01-01', ultima: '2026-10-01' });
    assert.deepEqual(antecedentes.get(otro), { cantidad: 1, primera: '2026-01-01', ultima: '2026-01-01' });
  });

  it('sin datasets devuelve un mapa vacío', async () => {
    assert.equal((await datos.antecedentesDe([])).size, 0);
  });
});

describe('areasDe', () => {
  it('devuelve las áreas pedidas ordenadas por nombre', async () => {
    const b = await crearArea({ nombre: 'B Área', email_principal: 'b@rpad.test' });
    const a = await crearArea({ nombre: 'A Área' });
    const resultado = await datos.areasDe([b, a]);
    assert.deepEqual(resultado.map(r => r.nombre), ['A Área', 'B Área']);
    assert.equal(resultado[1].email_principal, 'b@rpad.test');
  });
});
```

- [ ] **Step 3: Correr y ver que falla**

Run: `node --test tests/notas-datos.test.js`
Expected: FAIL con `Cannot find module '.../services/notasDigitalesDatos.js'`.

- [ ] **Step 4: Crear `services/notasDigitalesDatos.js`**

```js
// Consultas de Notas Digitales: configuración y selección de datasets.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (secciones 5 y 6.4)
import pool from '../config/database.js';

export const VENTANA_DIAS = { interna: 60, externa: 30 };
export const DIAS_PARA_REITERAR = 21;
export const TIPOS_EMAIL_REEMPLAZADOS = ['interno-60', 'interno-30', 'interno-vencido', 'externo-60', 'externo-40', 'externo-5', 'externo-vencido'];

const COLUMNAS_DATASET = `
  d.id, d.titulo, d.url_dataset, d.area_id, a.nombre AS area_nombre, f.nombre AS frecuencia_nombre,
  DATE_FORMAT(d.ultima_actualizacion, '%Y-%m-%d') AS ultima_actualizacion,
  DATE_FORMAT(d.proxima_actualizacion, '%Y-%m-%d') AS vencimiento`;
const DESDE_DATASETS = `
  FROM datasets d
  JOIN frecuencias f ON f.id = d.frecuencia_id
  JOIN areas a ON a.id = d.area_id`;
const CONDICION_BASE = 'd.activo = TRUE AND d.tipo_gestion = ? AND f.dias IS NOT NULL AND d.proxima_actualizacion IS NOT NULL';
// Sin aviso (de cualquier estado, sin contar pruebas) para su vencimiento actual
const SIN_AVISO = `NOT EXISTS (
  SELECT 1 FROM notas_digitales_datasets ndd
  JOIN notas_digitales n ON n.id = ndd.nota_id
  WHERE ndd.dataset_id = d.id AND ndd.vencimiento = d.proxima_actualizacion
    AND n.tipo = 'aviso' AND n.es_prueba = 0)`;

export const obtenerConfig = async () => {
  const [filas] = await pool.query('SELECT * FROM notas_digitales_config WHERE id = 1');
  if (!filas[0]) throw new Error('Falta la configuración de Notas Digitales (notas_digitales_config)');
  return filas[0];
};

export const seleccionarParaAviso = async (gestion, hoy) => {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS_DATASET} ${DESDE_DATASETS}
     WHERE ${CONDICION_BASE}
       AND d.proxima_actualizacion <= DATE_ADD(?, INTERVAL ? DAY)
       AND ${SIN_AVISO}
     ORDER BY d.proxima_actualizacion, d.titulo`,
    [gestion, hoy, VENTANA_DIAS[gestion]]
  );
  return filas;
};

export const seleccionarParaReiteracion = async (gestion, hoy) => {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS_DATASET},
            av.numero AS aviso_numero, av.anio AS aviso_anio, DATE_FORMAT(av.fecha, '%Y-%m-%d') AS aviso_fecha,
            (SELECT COUNT(*) FROM notas_digitales_datasets r
               JOIN notas_digitales rn ON rn.id = r.nota_id
              WHERE r.dataset_id = d.id AND r.vencimiento = d.proxima_actualizacion
                AND rn.tipo = 'reiteracion' AND rn.es_prueba = 0 AND rn.estado = 'enviada') AS reiteraciones
     ${DESDE_DATASETS}
     JOIN notas_digitales_datasets avd ON avd.dataset_id = d.id AND avd.vencimiento = d.proxima_actualizacion
     JOIN notas_digitales av ON av.id = avd.nota_id AND av.tipo = 'aviso' AND av.es_prueba = 0 AND av.estado = 'enviada'
     WHERE ${CONDICION_BASE}
       AND av.fecha <= DATE_SUB(?, INTERVAL ? DAY)
     ORDER BY d.proxima_actualizacion, d.titulo`,
    [gestion, hoy, DIAS_PARA_REITERAR]
  );
  return filas.map(({ aviso_numero, aviso_anio, aviso_fecha, reiteraciones, ...dataset }) => ({
    ...dataset,
    informado: { numero: aviso_numero, anio: aviso_anio, fecha: aviso_fecha },
    reiteraciones: Number(reiteraciones)
  }));
};

export const pendientesDeAviso = async (gestion) => {
  const [filas] = await pool.query(
    `SELECT DATE_FORMAT(d.proxima_actualizacion, '%Y-%m-%d') AS vencimiento ${DESDE_DATASETS}
     WHERE ${CONDICION_BASE} AND ${SIN_AVISO}
     ORDER BY d.proxima_actualizacion`,
    [gestion]
  );
  return filas.map(f => f.vencimiento);
};

export const antecedentesDe = async (ids) => {
  if (ids.length === 0) return new Map();
  const [filas] = await pool.query(
    `SELECT d.id, COUNT(l.id) AS cantidad,
            DATE_FORMAT(MIN(l.enviado_at), '%Y-%m-%d') AS primera,
            DATE_FORMAT(MAX(l.enviado_at), '%Y-%m-%d') AS ultima
     FROM datasets d
     JOIN notificaciones_log l ON FIND_IN_SET(d.id, REPLACE(l.datasets_ids, ' ', '')) > 0
     WHERE d.id IN (?) AND l.success = 1 AND l.tipo IN (?)
       AND (d.ultima_actualizacion IS NULL OR l.enviado_at > d.ultima_actualizacion)
     GROUP BY d.id`,
    [ids, TIPOS_EMAIL_REEMPLAZADOS]
  );
  return new Map(filas.map(f => [f.id, { cantidad: Number(f.cantidad), primera: f.primera, ultima: f.ultima }]));
};

export const areasDe = async (ids) => {
  if (ids.length === 0) return [];
  const [filas] = await pool.query(
    `SELECT id, nombre, area_superior, email_principal, email_secundario, telefono_area, celular_area,
            nombre_contacto, telefono_contacto, email_contacto
     FROM areas WHERE id IN (?) ORDER BY nombre`,
    [ids]
  );
  return filas;
};
```

- [ ] **Step 5: Correr y ver que pasa**

Run: `node --test tests/notas-datos.test.js`
Expected: PASS (11 tests).
Run: `npm test`
Expected: todos en verde.

- [ ] **Step 6: Commit**

```bash
git add services/notasDigitalesDatos.js tests/notas-fixtures.js tests/notas-datos.test.js
git commit -m "feat: selección de datasets para avisos y reiteraciones"
```

---

### Task 7: Motor de Notas Digitales

**Files:**
- Create: `services/notasDigitales.js`
- Test: `tests/notas-motor.test.js`

**Interfaces:**
- Consumes: `sendEmail`, `listaDeCorreos` (Tarea 2); `esDiaHabil`, `periodoDe`, `periodoSiguiente`, `primerDiaHabilDelMes`, `proximoDiaHabil`, `sumarDias`, `hoyArgentina` (Tarea 3); `construirNota`, `renderHtml`, `renderTexto` (Tarea 4); `renderPdf` (Tarea 5); todas las funciones de la Tarea 6.
- Produces:
  - `MAX_INTENTOS = 5`; `class ErrorDeUso extends Error`.
  - `configuracionCompleta(config) → string[]`: lo que falta, vacío si está completa.
  - `generarNota({ tipo, gestion, fecha, datasets, config, esPrueba?, usuarioId?, preparado? }) → Promise<number>` (id).
  - `enviarNota(id) → Promise<{ success, error?, messageId?, response? }>`.
  - `ejecutarNotasDigitales({ hoy?, usuarioId? }) → Promise<{ fecha, ejecutado, motivo, generadas: [{ id, tipo, gestion, datasets }], enviadas, fallidas }>`.
  - `previewNota({ tipo, gestion, hoy? }) → Promise<{ html, asunto, ejemplo: boolean, cantidad }>`.
  - `enviarPrueba({ tipo, gestion, hoy?, usuarioId? }) → Promise<{ id, ejemplo, success, error?, destinatarios }>`; lanza `ErrorDeUso` si no hay casillas de prueba.
  - `estadoNotas({ hoy? }) → Promise<{ envio_activo, configuracion_faltante: string[], fallidas, proximas: { interna: { aviso: { fecha, cantidad }|null, reiteracion: { fecha, cantidad } }, externa: {…} } }>`.

- [ ] **Step 1: Escribir el test que falla `tests/notas-motor.test.js`**

```js
// Motor de Notas Digitales: calendario, numeración, envío, reintentos y concurrencia (base de prueba + Mailpit)
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, cerrarDb, query, mailpit } from './helpers.js';
import { crearDataset, crearNota, crearEmailViejo, limpiarBase, configurarNotas, crearArea } from './notas-fixtures.js';

let base, motor;

before(async () => {
  base = await crearBaseDePrueba('rpad_test_notas_motor');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  motor = await import('../services/notasDigitales.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  await base?.borrar();
});

beforeEach(async () => {
  process.env.EMAIL_SOLO_A = '';
  await limpiarBase();
  await configurarNotas();
  await mailpit.vaciar();
});

const notas = () => query('SELECT id, numero, anio, tipo, gestion, estado, intentos, asunto, html, respuesta_smtp, message_id FROM notas_digitales ORDER BY id');
const direcciones = (lista) => (lista || []).map(d => d.Address);
const ejecutar = (hoy) => motor.ejecutarNotasDigitales({ hoy });

describe('condiciones para ejecutar', () => {
  it('con el envío desactivado no genera nada', async () => {
    await configurarNotas({ envio_activo: 0 });
    await crearDataset({ vencimiento: '2026-12-31' });
    const resumen = await ejecutar('2026-11-02');
    assert.equal(resumen.motivo, 'Envío automático desactivado');
    assert.equal((await notas()).length, 0);
  });

  it('con la configuración incompleta no genera nada y dice qué falta', async () => {
    await configurarNotas({ firma_nombre: '', para_externa: '' });
    await crearDataset({ vencimiento: '2026-12-31' });
    const resumen = await ejecutar('2026-11-02');
    assert.match(resumen.motivo, /Configuración incompleta: .*Para \(gestión externa\).*nombre de la firma/);
    assert.equal((await notas()).length, 0);
  });

  it('en un día no hábil no genera nada', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    assert.equal((await ejecutar('2026-11-01')).motivo, 'Día no hábil');
    assert.equal((await notas()).length, 0);
  });
});

describe('avisos', () => {
  it('aviso interno: destinatarios, asunto, adjunto y registro del comprobante', async () => {
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    const resumen = await ejecutar('2026-11-02');
    assert.equal(resumen.enviadas, 1);

    const [mensaje] = await mailpit.mensajes();
    assert.deepEqual(direcciones(mensaje.To), ['mit@rpad.test']);
    assert.deepEqual(direcciones(mensaje.Cc), ['geo@rpad.test']);
    assert.deepEqual(direcciones(mensaje.Bcc), ['respaldo@rpad.test']);
    assert.equal(mensaje.Subject, 'Nota Digital N° 1/26 – Ref.: Solicitud de gestión de datos para el Portal de Datos Abiertos Municipal (gestión interna – noviembre 2026)');
    const detalle = await (await fetch(`http://localhost:8025/api/v1/message/${mensaje.ID}`)).json();
    assert.deepEqual(detalle.Attachments.map(a => a.FileName), ['Nota-Digital-1-26.pdf']);

    const [nota] = await notas();
    assert.equal(nota.estado, 'enviada');
    assert.match(nota.respuesta_smtp, /^250/);
    assert.ok(nota.message_id);
    const [fila] = await query('SELECT seccion, DATE_FORMAT(vencimiento, "%Y-%m-%d") AS vencimiento FROM notas_digitales_datasets WHERE dataset_id = ?', [id]);
    assert.deepEqual(fila, { seccion: 'proximo', vencimiento: '2026-12-31' });
  });

  it('aviso externo con su CC y los contactos del área', async () => {
    const area = await crearArea({ nombre: 'Área Externa', email_principal: 'externa@rpad.test' });
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-30', areaId: area });
    await ejecutar('2026-11-02');
    const [mensaje] = await mailpit.mensajes();
    assert.deepEqual(direcciones(mensaje.Cc), ['adm@rpad.test']);
    assert.ok((await mailpit.html(mensaje.ID)).includes('Email: externa@rpad.test'));
  });

  it('los vencidos sin aviso entran con el antecedente de emails anteriores', async () => {
    const id = await crearDataset({ gestion: 'externa', vencimiento: '2026-07-31', ultima: '2025-07-31' });
    await crearEmailViejo({ tipo: 'externo-vencido', datasetIds: [id], enviado: '2026-01-01 08:00:00' });
    await crearEmailViejo({ tipo: 'externo-vencido', datasetIds: [id], enviado: '2026-10-01 08:00:00' });
    await ejecutar('2026-11-02');
    const [mensaje] = await mailpit.mensajes();
    const html = await mailpit.html(mensaje.ID);
    assert.ok(html.includes('Plazo de actualización vencido'));
    assert.ok(html.includes('Antecedente: notificado por correo electrónico en 2 oportunidades, entre el 01/01/2026 y el 01/10/2026.'));
  });

  it('un dataset recibe un solo aviso por vencimiento', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await ejecutar('2026-11-02');
    await ejecutar('2026-11-02');
    await ejecutar('2026-11-03');
    assert.equal((await notas()).length, 1);
    assert.equal((await mailpit.mensajes()).length, 1);
  });

  it('si cambia el vencimiento recibe un aviso nuevo con el número siguiente', async () => {
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    await ejecutar('2026-11-02');
    await query('UPDATE datasets SET proxima_actualizacion = ? WHERE id = ?', ['2026-12-15', id]);
    await ejecutar('2026-11-03');
    assert.deepEqual((await notas()).map(n => [n.tipo, n.numero]), [['aviso', 1], ['aviso', 2]]);
  });
});

describe('reiteraciones', () => {
  it('el primer día hábil reitera los avisados hace 21 días o más', async () => {
    await crearDataset({ titulo: 'Avisado temprano', vencimiento: '2026-12-31' });
    await ejecutar('2026-11-02');
    await crearDataset({ titulo: 'Avisado tarde', vencimiento: '2027-01-19' });
    await ejecutar('2026-11-20');
    await mailpit.vaciar();

    await ejecutar('2026-12-01');
    const [mensaje] = await mailpit.mensajes();
    assert.match(mensaje.Subject, /^Nota Digital N° 3\/26 – Ref\.: Reiteración – /);
    const html = await mailpit.html(mensaje.ID);
    assert.ok(html.includes('Avisado temprano'));
    assert.ok(!html.includes('Avisado tarde'));
    assert.ok(html.includes('Nota Digital N° 1/26 (02/11/2026)'));
  });

  it('se evalúa una sola vez por mes y la primera de enero es N° 1 del año nuevo', async () => {
    await crearDataset({ titulo: 'Avisado temprano', vencimiento: '2026-12-31' });
    await ejecutar('2026-11-02');
    await crearDataset({ titulo: 'Avisado tarde', vencimiento: '2027-01-19' });
    await ejecutar('2026-11-20');
    await ejecutar('2026-12-01');
    await ejecutar('2026-12-02');
    await ejecutar('2026-12-11');
    assert.equal((await notas()).filter(n => n.tipo === 'reiteracion').length, 1);

    await mailpit.vaciar();
    await ejecutar('2027-01-04');
    const [mensaje] = await mailpit.mensajes();
    assert.match(mensaje.Subject, /^Nota Digital N° 1\/27 – Ref\.: Reiteración – /);
    const html = await mailpit.html(mensaje.ID);
    assert.ok(html.includes('Avisado tarde'));
    assert.ok(html.includes('Nota Digital N° 1/26 (02/11/2026) – reiterado 1 vez'));
  });

  it('si el primer día hábil no hubo corrida, la reiteración sale en la siguiente', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await ejecutar('2026-11-02');
    await ejecutar('2026-12-02');
    assert.deepEqual((await notas()).map(n => n.tipo), ['aviso', 'reiteracion']);
  });

  it('nunca genera dos reiteraciones de la misma gestión en el mismo mes', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await ejecutar('2026-11-02');
    await ejecutar('2026-12-01');
    await query('UPDATE notas_digitales_config SET reiteracion_evaluada_interna = NULL WHERE id = 1');
    await ejecutar('2026-12-02');
    assert.equal((await notas()).filter(n => n.tipo === 'reiteracion').length, 1);
  });
});

describe('fallas, reintentos y concurrencia', () => {
  it('un envío fallido se reintenta con el mismo número y contenido', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    process.env.EMAIL_SOLO_A = 'nadie@rpad.test';
    await ejecutar('2026-11-02');
    const [fallida] = await notas();
    assert.equal(fallida.estado, 'fallida');
    assert.equal(fallida.intentos, 1);

    process.env.EMAIL_SOLO_A = '';
    await ejecutar('2026-11-03');
    const todas = await notas();
    assert.equal(todas.length, 1);
    assert.equal(todas[0].estado, 'enviada');
    assert.equal(todas[0].asunto, fallida.asunto);
    assert.equal(todas[0].html, fallida.html);
  });

  it('después de 5 intentos no reintenta solo, pero se puede reintentar a mano', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    process.env.EMAIL_SOLO_A = 'nadie@rpad.test';
    await ejecutar('2026-11-02');
    const [nota] = await notas();
    await query('UPDATE notas_digitales SET intentos = 5 WHERE id = ?', [nota.id]);
    process.env.EMAIL_SOLO_A = '';
    await ejecutar('2026-11-03');
    assert.equal((await notas())[0].estado, 'fallida');

    const resultado = await motor.enviarNota(nota.id);
    assert.equal(resultado.success, true);
    assert.equal((await notas())[0].estado, 'enviada');
  });

  it('dos corridas simultáneas no duplican notas', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await Promise.all([ejecutar('2026-11-02'), ejecutar('2026-11-02')]);
    assert.equal((await notas()).length, 1);
    assert.equal((await mailpit.mensajes()).length, 1);
  });
});

describe('pruebas, vista previa y estado', () => {
  it('una prueba va solo a las casillas de prueba, sin número y sin contar como aviso', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    const resultado = await motor.enviarPrueba({ tipo: 'aviso', gestion: 'interna', hoy: '2026-11-02' });
    assert.equal(resultado.success, true);
    const [mensaje] = await mailpit.mensajes();
    assert.deepEqual(direcciones(mensaje.To), ['prueba@rpad.test']);
    assert.deepEqual(direcciones(mensaje.Cc), []);
    assert.match(mensaje.Subject, /^\[PRUEBA\] Nota Digital N° PRUEBA – /);
    assert.equal((await query('SELECT COUNT(*) AS n FROM notas_digitales_datasets'))[0].n, 0);

    await ejecutar('2026-11-02');
    const reales = (await notas()).filter(n => n.numero !== null);
    assert.deepEqual(reales.map(n => n.numero), [1]);
  });

  it('sin casillas de prueba la prueba se rechaza', async () => {
    await configurarNotas({ casillas_prueba: '' });
    await assert.rejects(motor.enviarPrueba({ tipo: 'aviso', gestion: 'interna', hoy: '2026-11-02' }), motor.ErrorDeUso);
  });

  it('la vista previa sin datos usa ejemplos y no escribe nada', async () => {
    const vista = await motor.previewNota({ tipo: 'reiteracion', gestion: 'externa', hoy: '2026-11-02' });
    assert.equal(vista.ejemplo, true);
    assert.ok(vista.html.includes('Nota Digital N°</b> XX'));
    assert.equal((await notas()).length, 0);
  });

  it('el estado informa la configuración, las fallidas y los próximos envíos', async () => {
    await crearDataset({ vencimiento: '2027-01-31' });
    await crearNota({ fecha: '2026-10-01', numero: 9, estado: 'fallida', intentos: 5 });
    const estado = await motor.estadoNotas({ hoy: '2026-11-02' });
    assert.equal(estado.envio_activo, true);
    assert.deepEqual(estado.configuracion_faltante, []);
    assert.equal(estado.fallidas, 1);
    assert.deepEqual(estado.proximas.interna.aviso, { fecha: '2026-12-02', cantidad: 1 });
    assert.deepEqual(estado.proximas.interna.reiteracion, { fecha: '2026-11-02', cantidad: 0 });
    assert.equal(estado.proximas.externa.aviso, null);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --test tests/notas-motor.test.js`
Expected: FAIL con `Cannot find module '.../services/notasDigitales.js'`.

- [ ] **Step 3: Crear `services/notasDigitales.js`**

```js
// Motor de Notas Digitales: genera, numera, envía y reintenta los avisos y reiteraciones.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (secciones 5, 7.4 y 8)
import pool from '../config/database.js';
import { sendEmail, listaDeCorreos } from './emailService.js';
import { construirNota, renderHtml, renderTexto } from './notasDigitalesContenido.js';
import { renderPdf } from './notasDigitalesPdf.js';
import {
  hoyArgentina, esDiaHabil, proximoDiaHabil, primerDiaHabilDelMes, periodoDe, periodoSiguiente, sumarDias
} from './notasDigitalesCalendario.js';
import {
  VENTANA_DIAS, obtenerConfig, seleccionarParaAviso, seleccionarParaReiteracion, pendientesDeAviso, antecedentesDe, areasDe
} from './notasDigitalesDatos.js';

export const MAX_INTENTOS = 5;
const GESTIONES = ['interna', 'externa'];
const BLOQUEO = 'rpad_notas_digitales';

export class ErrorDeUso extends Error {}

const remitente = () => `"Dirección de Datos Públicos y Comunicación" <${process.env.SMTP_USER}>`;

export const configuracionCompleta = (config) => {
  const faltan = [];
  for (const gestion of GESTIONES) {
    if (listaDeCorreos(config[`para_${gestion}`]).length === 0) faltan.push(`Para (gestión ${gestion})`);
  }
  if (!String(config.firma_nombre ?? '').trim()) faltan.push('nombre de la firma');
  if (!String(config.firma_cargo ?? '').trim()) faltan.push('cargo de la firma');
  return faltan;
};

// Agrega a cada dataset lo que la nota muestra: antecedentes (avisos) y contactos (externa)
const prepararContenido = async ({ tipo, gestion, datasets }) => {
  const antecedentes = tipo === 'aviso' ? await antecedentesDe(datasets.map(d => d.id)) : new Map();
  const conDatos = datasets.map(d => ({ informado: null, reiteraciones: 0, ...d, antecedente: antecedentes.get(d.id) ?? null }));
  const areas = gestion === 'externa' ? await areasDe([...new Set(datasets.map(d => d.area_id))]) : [];
  return { datasets: conDatos, areas };
};

const destinatarios = (config, gestion, esPrueba) => (esPrueba
  ? { para: listaDeCorreos(config.casillas_prueba), cc: [], cco: [] }
  : {
    para: listaDeCorreos(config[`para_${gestion}`]),
    cc: listaDeCorreos(config[`cc_${gestion}`]),
    cco: listaDeCorreos(config.cco)
  });

// Asigna el número, renderiza HTML, texto y PDF y deja la nota registrada como pendiente
export const generarNota = async ({ tipo, gestion, fecha, datasets, config, esPrueba = false, usuarioId = null, preparado = null }) => {
  const contenido = preparado ?? await prepararContenido({ tipo, gestion, datasets });
  const { para, cc, cco } = destinatarios(config, gestion, esPrueba);
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const anio = esPrueba ? null : Number(fecha.slice(0, 4));
    let numero = null;
    if (!esPrueba) {
      const [[fila]] = await conexion.query(
        'SELECT COALESCE(MAX(numero), 0) + 1 AS siguiente FROM notas_digitales WHERE anio = ? FOR UPDATE', [anio]
      );
      numero = Number(fila.siguiente);
    }
    const nota = construirNota({ tipo, gestion, numero, anio, esPrueba, fecha, datasets: contenido.datasets, areas: contenido.areas, config });
    const pdf = await renderPdf(nota, { firmaImagen: config.firma_imagen });
    const [resultado] = await conexion.query(
      `INSERT INTO notas_digitales
         (numero, anio, tipo, gestion, periodo, fecha, es_prueba, asunto, para, cc, cco, html, texto, pdf, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero, anio, tipo, gestion, tipo === 'reiteracion' ? periodoDe(fecha) : null, fecha, esPrueba ? 1 : 0,
        nota.asunto, para.join(', '), cc.join(', '), cco.join(', '), renderHtml(nota), renderTexto(nota), pdf, usuarioId]
    );
    if (!esPrueba) {
      for (const d of contenido.datasets) {
        await conexion.query(
          'INSERT INTO notas_digitales_datasets (nota_id, dataset_id, seccion, vencimiento) VALUES (?, ?, ?, ?)',
          [resultado.insertId, d.id, d.vencimiento < fecha ? 'vencido' : 'proximo', d.vencimiento]
        );
      }
    }
    await conexion.commit();
    return resultado.insertId;
  } catch (error) {
    await conexion.rollback().catch(() => {});
    throw error;
  } finally {
    conexion.release();
  }
};

// Envía el contenido guardado de la nota (un reintento manda exactamente lo mismo)
export const enviarNota = async (id) => {
  const [[nota]] = await pool.query(
    'SELECT id, numero, anio, es_prueba, asunto, para, cc, cco, html, texto, pdf, estado FROM notas_digitales WHERE id = ?', [id]
  );
  if (!nota) throw new ErrorDeUso(`No existe la nota ${id}`);
  if (nota.estado === 'enviada') return { success: true, yaEnviada: true };

  const archivo = nota.es_prueba ? 'Nota-Digital-PRUEBA.pdf' : `Nota-Digital-${nota.numero}-${String(nota.anio).slice(-2)}.pdf`;
  const resultado = await sendEmail({
    from: remitente(),
    replyTo: process.env.SMTP_USER,
    to: nota.para,
    cc: nota.cc,
    bcc: nota.cco,
    subject: nota.asunto,
    html: nota.html,
    text: nota.texto,
    attachments: [{ filename: archivo, content: nota.pdf, contentType: 'application/pdf' }]
  });

  if (resultado.success) {
    await pool.query(
      `UPDATE notas_digitales SET estado = 'enviada', intentos = intentos + 1, enviada_at = NOW(),
         message_id = ?, respuesta_smtp = ?, ultimo_error = NULL WHERE id = ?`,
      [resultado.messageId ?? null, String(resultado.response ?? '').slice(0, 500), id]
    );
  } else {
    await pool.query(
      "UPDATE notas_digitales SET estado = 'fallida', intentos = intentos + 1, ultimo_error = ? WHERE id = ?",
      [resultado.error, id]
    );
  }
  return resultado;
};

export const ejecutarNotasDigitales = async ({ hoy = hoyArgentina(), usuarioId = null } = {}) => {
  const resumen = { fecha: hoy, ejecutado: false, motivo: null, generadas: [], enviadas: 0, fallidas: 0 };
  const conexionBloqueo = await pool.getConnection();
  try {
    const [[{ bloqueo }]] = await conexionBloqueo.query('SELECT GET_LOCK(?, 0) AS bloqueo', [BLOQUEO]);
    if (Number(bloqueo) !== 1) return { ...resumen, motivo: 'Otra corrida en curso' };
    try {
      const config = await obtenerConfig();
      if (!config.envio_activo) return { ...resumen, motivo: 'Envío automático desactivado' };
      const faltan = configuracionCompleta(config);
      if (faltan.length) return { ...resumen, motivo: `Configuración incompleta: ${faltan.join(', ')}` };
      if (!esDiaHabil(hoy)) return { ...resumen, motivo: 'Día no hábil' };

      resumen.ejecutado = true;
      const contar = (resultado) => {
        if (resultado.success) resumen.enviadas++;
        else resumen.fallidas++;
      };

      // 1. Reintentos de notas pendientes o fallidas
      const [pendientes] = await pool.query(
        "SELECT id FROM notas_digitales WHERE estado IN ('pendiente', 'fallida') AND es_prueba = 0 AND intentos < ? ORDER BY id",
        [MAX_INTENTOS]
      );
      for (const { id } of pendientes) contar(await enviarNota(id));

      // 2. Avisos
      for (const gestion of GESTIONES) {
        const datasets = await seleccionarParaAviso(gestion, hoy);
        if (!datasets.length) continue;
        const id = await generarNota({ tipo: 'aviso', gestion, fecha: hoy, datasets, config, usuarioId });
        resumen.generadas.push({ id, tipo: 'aviso', gestion, datasets: datasets.length });
        contar(await enviarNota(id));
      }

      // 3. Reiteraciones: una evaluación por mes y gestión
      const periodo = periodoDe(hoy);
      for (const gestion of GESTIONES) {
        if (config[`reiteracion_evaluada_${gestion}`] === periodo) continue;
        const [[existente]] = await pool.query(
          "SELECT COUNT(*) AS cantidad FROM notas_digitales WHERE tipo = 'reiteracion' AND gestion = ? AND periodo = ? AND es_prueba = 0",
          [gestion, periodo]
        );
        if (Number(existente.cantidad) === 0) {
          const datasets = await seleccionarParaReiteracion(gestion, hoy);
          if (datasets.length) {
            const id = await generarNota({ tipo: 'reiteracion', gestion, fecha: hoy, datasets, config, usuarioId });
            resumen.generadas.push({ id, tipo: 'reiteracion', gestion, datasets: datasets.length });
            contar(await enviarNota(id));
          }
        }
        // El nombre de columna sale de GESTIONES, una lista fija del código
        await pool.query(`UPDATE notas_digitales_config SET reiteracion_evaluada_${gestion} = ? WHERE id = 1`, [periodo]);
      }
      return resumen;
    } finally {
      await conexionBloqueo.query('SELECT RELEASE_LOCK(?)', [BLOQUEO]);
    }
  } finally {
    conexionBloqueo.release();
  }
};

// Datos de ejemplo para la vista previa y las pruebas cuando hoy no hay datasets para esa nota
const ejemplo = (tipo, hoy) => {
  const informado = tipo === 'reiteracion' ? { numero: 1, anio: Number(hoy.slice(0, 4)), fecha: sumarDias(hoy, -30) } : null;
  const comun = {
    url_dataset: 'https://datos.comodoro.gov.ar', area_id: 0, area_nombre: 'Área de ejemplo',
    frecuencia_nombre: 'Anualmente', informado
  };
  return {
    datasets: [
      { ...comun, id: 0, titulo: 'Dataset de ejemplo próximo a vencer', ultima_actualizacion: sumarDias(hoy, -335), vencimiento: sumarDias(hoy, 30), reiteraciones: 0, antecedente: null },
      {
        ...comun, id: -1, titulo: 'Dataset de ejemplo vencido', ultima_actualizacion: sumarDias(hoy, -380), vencimiento: sumarDias(hoy, -15),
        reiteraciones: tipo === 'reiteracion' ? 1 : 0,
        antecedente: tipo === 'aviso' ? { cantidad: 3, primera: sumarDias(hoy, -90), ultima: sumarDias(hoy, -30) } : null
      }
    ],
    areas: [{
      id: 0, nombre: 'Área de ejemplo', area_superior: 'Secretaría de ejemplo', email_principal: 'area@ejemplo.gov.ar',
      email_secundario: null, telefono_area: '297 400-0000', celular_area: null, nombre_contacto: 'Persona de contacto',
      telefono_contacto: null, email_contacto: null
    }]
  };
};

const contenidoParaMostrar = async (tipo, gestion, hoy) => {
  const reales = tipo === 'aviso' ? await seleccionarParaAviso(gestion, hoy) : await seleccionarParaReiteracion(gestion, hoy);
  if (reales.length) return { ...(await prepararContenido({ tipo, gestion, datasets: reales })), ejemplo: false };
  return { ...ejemplo(tipo, hoy), ejemplo: true };
};

export const previewNota = async ({ tipo, gestion, hoy = hoyArgentina() }) => {
  const config = await obtenerConfig();
  const { datasets, areas, ejemplo: esEjemplo } = await contenidoParaMostrar(tipo, gestion, hoy);
  const nota = construirNota({ tipo, gestion, numero: null, anio: null, esPrueba: false, fecha: hoy, datasets, areas, config });
  return { html: renderHtml(nota), asunto: nota.asunto, ejemplo: esEjemplo, cantidad: esEjemplo ? 0 : datasets.length };
};

export const enviarPrueba = async ({ tipo, gestion, hoy = hoyArgentina(), usuarioId = null }) => {
  const config = await obtenerConfig();
  const casillas = listaDeCorreos(config.casillas_prueba);
  if (casillas.length === 0) throw new ErrorDeUso('No hay casillas de prueba configuradas');
  const { datasets, areas, ejemplo: esEjemplo } = await contenidoParaMostrar(tipo, gestion, hoy);
  const id = await generarNota({
    tipo, gestion, fecha: hoy, datasets, config, esPrueba: true, usuarioId, preparado: { datasets, areas }
  });
  const resultado = await enviarNota(id);
  return { id, ejemplo: esEjemplo, destinatarios: casillas, ...resultado };
};

export const estadoNotas = async ({ hoy = hoyArgentina() } = {}) => {
  const config = await obtenerConfig();
  const [[{ fallidas }]] = await pool.query(
    "SELECT COUNT(*) AS fallidas FROM notas_digitales WHERE estado = 'fallida' AND es_prueba = 0"
  );
  const periodoActual = periodoDe(hoy);
  const proximas = {};
  for (const gestion of GESTIONES) {
    const fechasAviso = (await pendientesDeAviso(gestion))
      .map(vencimiento => {
        const desde = sumarDias(vencimiento, -VENTANA_DIAS[gestion]);
        return proximoDiaHabil(desde > hoy ? desde : hoy);
      })
      .sort();
    const fechaAviso = fechasAviso[0] ?? null;

    const evaluado = config[`reiteracion_evaluada_${gestion}`] === periodoActual;
    const fechaReiteracion = evaluado
      ? primerDiaHabilDelMes(periodoSiguiente(periodoActual))
      : proximoDiaHabil(primerDiaHabilDelMes(periodoActual) > hoy ? primerDiaHabilDelMes(periodoActual) : hoy);

    proximas[gestion] = {
      aviso: fechaAviso ? { fecha: fechaAviso, cantidad: fechasAviso.filter(f => f === fechaAviso).length } : null,
      reiteracion: { fecha: fechaReiteracion, cantidad: (await seleccionarParaReiteracion(gestion, fechaReiteracion)).length }
    };
  }
  return {
    envio_activo: Boolean(config.envio_activo),
    configuracion_faltante: configuracionCompleta(config),
    fallidas: Number(fallidas),
    proximas
  };
};
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `node --test tests/notas-motor.test.js`
Expected: PASS (19 tests). Si "dos corridas simultáneas" falla, verificar que `GET_LOCK` se pida sobre una conexión dedicada que se mantiene hasta `RELEASE_LOCK`.

- [ ] **Step 5: Correr la batería completa**

Run: `npm test`
Expected: todos en verde.

- [ ] **Step 6: Commit**

```bash
git add services/notasDigitales.js tests/notas-motor.test.js
git commit -m "feat: motor de Notas Digitales (avisos, reiteraciones, numeración y reintentos)"
```

---

### Task 8: API, integración con el cron y retiro de los siete avisos

**Files:**
- Create: `controllers/notasDigitalesController.js`
- Modify: `routes/index.js`
- Modify: `controllers/notificacionesController.js`
- Modify: `services/emailTemplates.js`
- Modify: `controllers/gestionController.js:40-48` y `:809-816`
- Modify: `tests/permisos.test.js`, `tests/notificaciones.test.js`
- Test: `tests/notas-api.test.js`

**Interfaces:**
- Consumes: todo el motor (Tarea 7); `obtenerConfig` (Tarea 6); `listaDeCorreos` (Tarea 2); fixtures (Tarea 6); `iniciarServidor({ env })`, `crearUsuariosPrueba`, `crearCliente` (Tarea 1).
- Produces: rutas de la spec sección 9 bajo `/api/notificaciones/notas-digitales` y `POST /api/notificaciones/prueba-area`. Respuestas:
  - `GET /` → `{ success, data: Fila[] }` con `id, numero, anio, tipo, gestion, fecha, es_prueba, asunto, para, cc, cco, estado, intentos, ultimo_error, respuesta_smtp, enviada_at, cantidad_datasets` y `seccion_dataset` si se filtra por dataset.
  - `GET /estado` → `{ success, data: estadoNotas() }`.
  - `GET /preview?tipo&gestion` → `{ success, data: { html, asunto, ejemplo, cantidad } }`.
  - `POST /prueba` `{ tipo, gestion }` → `{ success, message, data: { id, ejemplo, destinatarios } }`, 400 sin casillas, 502 si falla el envío.
  - `GET /config` → `{ success, data }` sin `firma_imagen`, con `tiene_firma`. `PUT /config` (actualización parcial) → `{ success, message, data }`. `PUT /config/firma` `{ imagen, mime }`. `GET /config/firma` → imagen.
  - `GET /:id` → `{ success, data: { ...fila, html, datasets: [{ dataset_id, titulo, seccion, vencimiento }] } }`. `GET /:id/pdf` → PDF. `POST /:id/reintentar` → `{ success, message, data: { estado } }`.

- [ ] **Step 1: Escribir el test que falla `tests/notas-api.test.js`**

```js
// API de Notas Digitales (servidor real contra una base de prueba propia)
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query, mailpit
} from './helpers.js';
import { crearDataset, limpiarBase, configurarNotas } from './notas-fixtures.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
let base, servidor, api, usuarios, motor;

before(async () => {
  base = await crearBaseDePrueba('rpad_test_notas_api');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api);
  motor = await import('../services/notasDigitales.js');
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  await servidor?.detener();
  await base?.borrar();
});

beforeEach(async () => {
  await limpiarBase();
  await configurarNotas();
  await mailpit.vaciar();
});

const comoAdmin = () => ({ token: usuarios.adminA.token });

describe('configuración', () => {
  it('devuelve la configuración sin la imagen de la firma', async () => {
    const res = await api.get('/notificaciones/notas-digitales/config', comoAdmin());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.para_interna, 'mit@rpad.test');
    assert.equal(res.body.data.tiene_firma, false);
    assert.equal('firma_imagen' in res.body.data, false);
  });

  it('normaliza listas de direcciones y rechaza las inválidas sin guardar', async () => {
    const ok = await api.put('/notificaciones/notas-digitales/config', { cc_interna: ' a@x.gov.ar; b@y.gov.ar ' }, comoAdmin());
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.cc_interna, 'a@x.gov.ar, b@y.gov.ar');

    const mal = await api.put('/notificaciones/notas-digitales/config', { para_interna: 'no-es-un-email', cco: 'c@z.gov.ar' }, comoAdmin());
    assert.equal(mal.status, 400);
    const [config] = await query('SELECT para_interna, cco FROM notas_digitales_config WHERE id = 1');
    assert.deepEqual(config, { para_interna: 'mit@rpad.test', cco: 'respaldo@rpad.test' });
  });

  it('el Para es obligatorio', async () => {
    const res = await api.put('/notificaciones/notas-digitales/config', { para_externa: '' }, comoAdmin());
    assert.equal(res.status, 400);
  });

  it('no deja activar el envío con la configuración incompleta', async () => {
    await configurarNotas({ envio_activo: 0, firma_nombre: '' });
    const res = await api.put('/notificaciones/notas-digitales/config', { envio_activo: true }, comoAdmin());
    assert.equal(res.status, 400);
    assert.match(res.body.error, /nombre de la firma/);
  });

  it('guarda una firma PNG y la devuelve', async () => {
    const res = await api.put('/notificaciones/notas-digitales/config/firma', { imagen: `data:image/png;base64,${PNG.toString('base64')}`, mime: 'image/png' }, comoAdmin());
    assert.equal(res.status, 200);
    const firma = await api.get('/notificaciones/notas-digitales/config/firma', comoAdmin());
    assert.equal(firma.status, 200);
    assert.match(firma.headers.get('content-type'), /image\/png/);
    assert.deepEqual(firma.body, PNG);
  });

  it('rechaza firmas que no son PNG o JPEG, base64 inválido o más de 500 KB', async () => {
    const enviar = (imagen, mime) => api.put('/notificaciones/notas-digitales/config/firma', { imagen, mime }, comoAdmin());
    assert.equal((await enviar(PNG.toString('base64'), 'image/gif')).status, 400);
    assert.equal((await enviar('esto no es base64!!', 'image/png')).status, 400);
    assert.equal((await enviar(Buffer.from('texto plano').toString('base64'), 'image/png')).status, 400);
    const grande = Buffer.concat([PNG, Buffer.alloc(600 * 1024)]);
    assert.equal((await enviar(grande.toString('base64'), 'image/png')).status, 400);
    assert.equal((await query('SELECT firma_imagen FROM notas_digitales_config WHERE id = 1'))[0].firma_imagen, null);
  });
});

describe('vista previa y prueba', () => {
  it('la vista previa devuelve el HTML con número XX', async () => {
    const res = await api.get('/notificaciones/notas-digitales/preview?tipo=aviso&gestion=interna', comoAdmin());
    assert.equal(res.status, 200);
    assert.ok(res.body.data.html.includes('XX'));
  });

  it('rechaza tipo o gestión inválidos', async () => {
    const res = await api.get('/notificaciones/notas-digitales/preview?tipo=otro&gestion=interna', comoAdmin());
    assert.equal(res.status, 400);
  });

  it('la prueba va a las casillas de prueba y queda oculta en el libro salvo que se pida', async () => {
    const res = await api.post('/notificaciones/notas-digitales/prueba', { tipo: 'aviso', gestion: 'externa' }, comoAdmin());
    assert.equal(res.status, 200);
    const [mensaje] = await mailpit.mensajes();
    assert.deepEqual(mensaje.To.map(t => t.Address), ['prueba@rpad.test']);
    assert.equal((await api.get('/notificaciones/notas-digitales', comoAdmin())).body.data.length, 0);
    assert.equal((await api.get('/notificaciones/notas-digitales?incluir_pruebas=1', comoAdmin())).body.data.length, 1);
  });

  it('sin casillas de prueba responde 400', async () => {
    await configurarNotas({ casillas_prueba: '' });
    const res = await api.post('/notificaciones/notas-digitales/prueba', { tipo: 'aviso', gestion: 'interna' }, comoAdmin());
    assert.equal(res.status, 400);
  });
});

describe('libro', () => {
  it('lista, muestra el detalle, descarga el PDF y filtra por dataset', async () => {
    const incluido = await crearDataset({ vencimiento: '2026-12-31' });
    const otro = await crearDataset({ vencimiento: '2027-10-31' });
    await motor.ejecutarNotasDigitales({ hoy: '2026-11-02' });

    const lista = await api.get('/notificaciones/notas-digitales', comoAdmin());
    assert.equal(lista.status, 200);
    assert.equal(lista.body.data.length, 1);
    const [fila] = lista.body.data;
    assert.equal(fila.numero, 1);
    assert.equal(fila.estado, 'enviada');
    assert.equal(fila.cantidad_datasets, 1);

    const detalle = await api.get(`/notificaciones/notas-digitales/${fila.id}`, comoAdmin());
    assert.ok(detalle.body.data.html.includes('Nota Digital N°</b> 1/26'));
    assert.deepEqual(detalle.body.data.datasets.map(d => d.dataset_id), [incluido]);

    const pdf = await api.get(`/notificaciones/notas-digitales/${fila.id}/pdf`, comoAdmin());
    assert.match(pdf.headers.get('content-type'), /application\/pdf/);
    assert.equal(pdf.body.subarray(0, 5).toString(), '%PDF-');

    const filtrada = await api.get(`/notificaciones/notas-digitales?dataset_id=${incluido}`, comoAdmin());
    assert.equal(filtrada.body.data[0].seccion_dataset, 'proximo');
    assert.equal((await api.get(`/notificaciones/notas-digitales?dataset_id=${otro}`, comoAdmin())).body.data.length, 0);
  });

  it('no reintenta una nota ya enviada y responde 404 para una inexistente', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await motor.ejecutarNotasDigitales({ hoy: '2026-11-02' });
    const [nota] = await query('SELECT id FROM notas_digitales');
    assert.equal((await api.post(`/notificaciones/notas-digitales/${nota.id}/reintentar`, {}, comoAdmin())).status, 400);
    assert.equal((await api.get('/notificaciones/notas-digitales/999999', comoAdmin())).status, 404);
  });

  it('el indicador de Gestión cuenta las notas enviadas', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await motor.ejecutarNotasDigitales({ hoy: '2026-11-02' });
    const res = await api.get('/gestion/metricas', { token: usuarios.lector.token });
    const total = res.body.data.notificaciones_por_mes.reduce((s, r) => s + r.cantidad, 0);
    assert.equal(total, 1);
  });
});

describe('aviso a las áreas', () => {
  it('la prueba va solo a las casillas de prueba', async () => {
    const res = await api.post('/notificaciones/prueba-area', {}, comoAdmin());
    assert.equal(res.status, 200);
    const [mensaje] = await mailpit.mensajes();
    assert.deepEqual(mensaje.To.map(t => t.Address), ['prueba@rpad.test']);
    assert.match(mensaje.Subject, /^\[PRUEBA\] /);
  });
});
```

- [ ] **Step 2: Actualizar `tests/permisos.test.js` y `tests/notificaciones.test.js` (también fallan hasta implementar)**

En `tests/permisos.test.js`, reemplazar en `RUTAS_SOLO_ADMIN` las dos líneas `['GET', '/notificaciones/prueba/interno-60']` y `['GET', '/notificaciones/preview/interno-60']` por:

```js
  ['POST', '/notificaciones/prueba-area'],
  ['GET', '/notificaciones/preview/area-aviso-40'],
  ['GET', '/notificaciones/notas-digitales'],
  ['GET', '/notificaciones/notas-digitales/estado'],
  ['GET', '/notificaciones/notas-digitales/preview?tipo=aviso&gestion=interna'],
  ['POST', '/notificaciones/notas-digitales/prueba'],
  ['GET', '/notificaciones/notas-digitales/config'],
  ['PUT', '/notificaciones/notas-digitales/config'],
  ['PUT', '/notificaciones/notas-digitales/config/firma'],
  ['GET', '/notificaciones/notas-digitales/1/pdf'],
  ['POST', '/notificaciones/notas-digitales/1/reintentar'],
```

y en la lista del `describe('admin', ...)` reemplazar `'/notificaciones/preview/interno-60'` por `'/notificaciones/preview/area-aviso-40'` y agregar `'/notificaciones/notas-digitales'` y `'/notificaciones/notas-digitales/estado'`.

En `tests/notificaciones.test.js`, reemplazar la constante `TIPOS` por `const TIPOS = ['area-aviso-40'];` y agregar dentro de `describe('previews', ...)`:

```js
  it('los siete avisos reemplazados ya no tienen vista previa', async () => {
    for (const tipo of ['interno-60', 'interno-30', 'interno-vencido', 'externo-60', 'externo-40', 'externo-5', 'externo-vencido']) {
      const res = await api.get(`/notificaciones/preview/${tipo}`, { token: usuarios.adminA.token });
      assert.equal(res.status, 400, tipo);
    }
  });
```

- [ ] **Step 3: Correr y ver que falla**

Run: `node --test tests/notas-api.test.js tests/permisos.test.js tests/notificaciones.test.js`
Expected: FAIL. Las rutas nuevas devuelven 404 (sirve el fallback del frontend) y los previews viejos todavía responden 200.

- [ ] **Step 4: Crear `controllers/notasDigitalesController.js`**

```js
// API de Notas Digitales para la pantalla de Correos (solo admins).
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 9)
import pool from '../config/database.js';
import * as notas from '../services/notasDigitales.js';
import { obtenerConfig } from '../services/notasDigitalesDatos.js';
import { listaDeCorreos } from '../services/emailService.js';

const TIPOS = ['aviso', 'reiteracion'];
const GESTIONES = ['interna', 'externa'];
const ESTADOS = ['pendiente', 'enviada', 'fallida'];
const EMAIL_VALIDO = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const FIRMA_MAX_BYTES = 500 * 1024;
const FIRMAS = { 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/jpeg': [0xff, 0xd8, 0xff] };
// Listas de direcciones: true = obligatoria
const LISTAS = { para_interna: true, para_externa: true, cc_interna: false, cc_externa: false, cco: false, casillas_prueba: false };
const TEXTOS = { linea_cc_interna: 200, linea_cc_externa: 200, firma_nombre: 150, firma_cargo: 200 };

const errorInterno = (res, mensaje, error) => {
  console.error(`${mensaje}:`, error);
  res.status(500).json({ success: false, error: mensaje });
};

const idDe = (valor) => {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const configPublica = ({ firma_imagen, ...resto }) => ({
  ...resto, envio_activo: Boolean(resto.envio_activo), tiene_firma: Boolean(firma_imagen)
});

export const listarNotas = async (req, res) => {
  try {
    const { anio, tipo, gestion, estado, dataset_id, incluir_pruebas } = req.query;
    const condiciones = [];
    const parametros = [];
    if (incluir_pruebas !== '1') condiciones.push('n.es_prueba = 0');
    if (idDe(anio)) { condiciones.push('YEAR(n.fecha) = ?'); parametros.push(Number(anio)); }
    if (TIPOS.includes(tipo)) { condiciones.push('n.tipo = ?'); parametros.push(tipo); }
    if (GESTIONES.includes(gestion)) { condiciones.push('n.gestion = ?'); parametros.push(gestion); }
    if (ESTADOS.includes(estado)) { condiciones.push('n.estado = ?'); parametros.push(estado); }
    const datasetId = idDe(dataset_id);
    if (datasetId) {
      condiciones.push('EXISTS (SELECT 1 FROM notas_digitales_datasets x WHERE x.nota_id = n.id AND x.dataset_id = ?)');
      parametros.push(datasetId);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const [filas] = await pool.query(
      `SELECT n.id, n.numero, n.anio, n.tipo, n.gestion, DATE_FORMAT(n.fecha, '%Y-%m-%d') AS fecha, n.es_prueba,
              n.asunto, n.para, n.cc, n.cco, n.estado, n.intentos, n.ultimo_error, n.respuesta_smtp,
              DATE_FORMAT(n.enviada_at, '%Y-%m-%d %H:%i') AS enviada_at,
              (SELECT COUNT(*) FROM notas_digitales_datasets c WHERE c.nota_id = n.id) AS cantidad_datasets
              ${datasetId ? ', (SELECT s.seccion FROM notas_digitales_datasets s WHERE s.nota_id = n.id AND s.dataset_id = ?) AS seccion_dataset' : ''}
       FROM notas_digitales n ${where}
       ORDER BY n.fecha DESC, n.id DESC
       LIMIT 500`,
      datasetId ? [datasetId, ...parametros] : parametros
    );
    res.json({ success: true, data: filas });
  } catch (error) {
    errorInterno(res, 'Error al obtener el libro de notas', error);
  }
};

export const obtenerNota = async (req, res) => {
  try {
    const id = idDe(req.params.id);
    const [[nota]] = await pool.query(
      `SELECT id, numero, anio, tipo, gestion, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, es_prueba, asunto, para, cc, cco,
              html, estado, intentos, ultimo_error, message_id, respuesta_smtp, DATE_FORMAT(enviada_at, '%Y-%m-%d %H:%i') AS enviada_at
       FROM notas_digitales WHERE id = ?`, [id]
    );
    if (!nota) return res.status(404).json({ success: false, error: 'Nota no encontrada' });
    const [datasets] = await pool.query(
      `SELECT x.dataset_id, d.titulo, x.seccion, DATE_FORMAT(x.vencimiento, '%Y-%m-%d') AS vencimiento
       FROM notas_digitales_datasets x JOIN datasets d ON d.id = x.dataset_id
       WHERE x.nota_id = ? ORDER BY x.vencimiento, d.titulo`, [id]
    );
    res.json({ success: true, data: { ...nota, datasets } });
  } catch (error) {
    errorInterno(res, 'Error al obtener la nota', error);
  }
};

export const descargarPdf = async (req, res) => {
  try {
    const [[nota]] = await pool.query('SELECT numero, anio, es_prueba, pdf FROM notas_digitales WHERE id = ?', [idDe(req.params.id)]);
    if (!nota) return res.status(404).json({ success: false, error: 'Nota no encontrada' });
    const archivo = nota.es_prueba ? 'Nota-Digital-PRUEBA.pdf' : `Nota-Digital-${nota.numero}-${String(nota.anio).slice(-2)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${archivo}"`);
    res.send(nota.pdf);
  } catch (error) {
    errorInterno(res, 'Error al descargar el PDF', error);
  }
};

export const reintentarNota = async (req, res) => {
  try {
    const [[nota]] = await pool.query('SELECT id, estado FROM notas_digitales WHERE id = ?', [idDe(req.params.id)]);
    if (!nota) return res.status(404).json({ success: false, error: 'Nota no encontrada' });
    if (nota.estado === 'enviada') return res.status(400).json({ success: false, error: 'La nota ya fue enviada' });
    const resultado = await notas.enviarNota(nota.id);
    if (!resultado.success) return res.status(502).json({ success: false, error: `No se pudo enviar: ${resultado.error}` });
    res.json({ success: true, message: 'Nota enviada', data: { estado: 'enviada' } });
  } catch (error) {
    errorInterno(res, 'Error al reintentar la nota', error);
  }
};

export const verEstado = async (req, res) => {
  try {
    res.json({ success: true, data: await notas.estadoNotas() });
  } catch (error) {
    errorInterno(res, 'Error al obtener el estado de las notas', error);
  }
};

export const verPreview = async (req, res) => {
  const { tipo, gestion } = req.query;
  if (!TIPOS.includes(tipo) || !GESTIONES.includes(gestion)) {
    return res.status(400).json({ success: false, error: 'Tipo o gestión inválidos' });
  }
  try {
    res.json({ success: true, data: await notas.previewNota({ tipo, gestion }) });
  } catch (error) {
    errorInterno(res, 'Error al generar la vista previa', error);
  }
};

export const enviarPrueba = async (req, res) => {
  const { tipo, gestion } = req.body ?? {};
  if (!TIPOS.includes(tipo) || !GESTIONES.includes(gestion)) {
    return res.status(400).json({ success: false, error: 'Tipo o gestión inválidos' });
  }
  try {
    const resultado = await notas.enviarPrueba({ tipo, gestion, usuarioId: req.user?.userId ?? null });
    if (!resultado.success) return res.status(502).json({ success: false, error: `No se pudo enviar la prueba: ${resultado.error}` });
    res.json({
      success: true,
      message: `Prueba enviada a ${resultado.destinatarios.join(', ')}${resultado.ejemplo ? ' (con datos de ejemplo)' : ''}`,
      data: { id: resultado.id, ejemplo: resultado.ejemplo, destinatarios: resultado.destinatarios }
    });
  } catch (error) {
    if (error instanceof notas.ErrorDeUso) return res.status(400).json({ success: false, error: error.message });
    errorInterno(res, 'Error al enviar la prueba', error);
  }
};

export const verConfig = async (req, res) => {
  try {
    res.json({ success: true, data: configPublica(await obtenerConfig()) });
  } catch (error) {
    errorInterno(res, 'Error al obtener la configuración', error);
  }
};

export const guardarConfig = async (req, res) => {
  try {
    const cuerpo = req.body ?? {};
    const cambios = {};
    const errores = [];

    for (const [campo, obligatoria] of Object.entries(LISTAS)) {
      if (cuerpo[campo] === undefined) continue;
      const correos = listaDeCorreos(cuerpo[campo]);
      const invalidos = correos.filter(c => !EMAIL_VALIDO.test(c));
      if (invalidos.length) errores.push(`${campo}: direcciones inválidas (${invalidos.join(', ')})`);
      else if (obligatoria && correos.length === 0) errores.push(`${campo}: debe tener al menos una dirección`);
      else if (correos.join(', ').length > 500) errores.push(`${campo}: demasiadas direcciones`);
      else cambios[campo] = correos.join(', ');
    }
    for (const [campo, maximo] of Object.entries(TEXTOS)) {
      if (cuerpo[campo] === undefined) continue;
      const texto = String(cuerpo[campo]).trim();
      if (texto.length > maximo) errores.push(`${campo}: máximo ${maximo} caracteres`);
      else cambios[campo] = texto;
    }
    if (cuerpo.envio_activo !== undefined) {
      cambios.envio_activo = [true, 1, '1', 'true'].includes(cuerpo.envio_activo) ? 1 : 0;
    }

    if (errores.length) return res.status(400).json({ success: false, error: errores.join('. ') });
    if (Object.keys(cambios).length === 0) return res.status(400).json({ success: false, error: 'No hay cambios para guardar' });

    const resultante = { ...(await obtenerConfig()), ...cambios };
    const faltan = notas.configuracionCompleta(resultante);
    if (resultante.envio_activo && faltan.length) {
      return res.status(400).json({ success: false, error: `No se puede activar el envío automático: falta ${faltan.join(', ')}` });
    }

    // Las columnas salen de LISTAS, TEXTOS y envio_activo: listas fijas del código
    const columnas = Object.keys(cambios);
    await pool.query(
      `UPDATE notas_digitales_config SET ${columnas.map(c => `${c} = ?`).join(', ')}, updated_by = ? WHERE id = 1`,
      [...Object.values(cambios), req.user?.userId ?? null]
    );
    res.json({ success: true, message: 'Configuración guardada', data: configPublica(await obtenerConfig()) });
  } catch (error) {
    errorInterno(res, 'Error al guardar la configuración', error);
  }
};

export const subirFirma = async (req, res) => {
  const { imagen, mime } = req.body ?? {};
  const cabecera = FIRMAS[mime];
  if (!cabecera || typeof imagen !== 'string') {
    return res.status(400).json({ success: false, error: 'La firma debe ser una imagen PNG o JPEG' });
  }
  const base64 = imagen.replace(/^data:[^;]+;base64,/, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    return res.status(400).json({ success: false, error: 'La imagen no es base64 válido' });
  }
  const datos = Buffer.from(base64, 'base64');
  if (datos.length === 0 || datos.length > FIRMA_MAX_BYTES) {
    return res.status(400).json({ success: false, error: 'La imagen debe pesar como máximo 500 KB' });
  }
  if (!cabecera.every((byte, i) => datos[i] === byte)) {
    return res.status(400).json({ success: false, error: 'El contenido no corresponde a una imagen PNG o JPEG' });
  }
  try {
    await pool.query('UPDATE notas_digitales_config SET firma_imagen = ?, firma_mime = ?, updated_by = ? WHERE id = 1',
      [datos, mime, req.user?.userId ?? null]);
    res.json({ success: true, message: 'Firma guardada' });
  } catch (error) {
    errorInterno(res, 'Error al guardar la firma', error);
  }
};

export const verFirma = async (req, res) => {
  try {
    const config = await obtenerConfig();
    if (!config.firma_imagen) return res.status(404).json({ success: false, error: 'No hay firma cargada' });
    res.setHeader('Content-Type', config.firma_mime || 'image/png');
    res.send(config.firma_imagen);
  } catch (error) {
    errorInterno(res, 'Error al obtener la firma', error);
  }
};
```

- [ ] **Step 5: Modificar `controllers/notificacionesController.js`**

1. Reemplazar los imports del principio por:

```js
import pool from '../config/database.js';
import { sendEmail, sendEmailToArea, verifyConnection, listaDeCorreos } from '../services/emailService.js';
import * as templates from '../services/emailTemplates.js';
import { ejecutarNotasDigitales } from '../services/notasDigitales.js';
import { obtenerConfig } from '../services/notasDigitalesDatos.js';
import { hoyArgentina } from '../services/notasDigitalesCalendario.js';
```

2. Borrar la función `getDatasetsByDias`, desde su comentario `/**\n * Obtiene datasets por tipo de gestión y días hasta vencimiento` hasta su cierre `};`.

3. Agregar, inmediatamente después del cierre de `getDatasetsExternosPorArea`:

```js
// Área de ejemplo para la vista previa y la prueba del aviso a áreas cuando hoy no hay datos
const AREA_DE_EJEMPLO = {
  area_id: 0,
  area_nombre: 'Dirección de Ejemplo',
  area_superior: 'Secretaría de Ejemplo',
  email_principal: 'ejemplo@comodoro.gov.ar',
  email_secundario: null,
  telefono_area: '297 4XXXXXX',
  celular_area: null,
  nombre_contacto: 'Persona de contacto',
  telefono_contacto: null,
  email_contacto: null,
  datasets: [
    { id: 1, titulo: 'Dataset de Ejemplo 1', frecuencia_nombre: 'Anualmente', url_dataset: 'https://datos.comodoro.gov.ar/dataset/ejemplo' },
    { id: 2, titulo: 'Dataset de Ejemplo 2', frecuencia_nombre: 'Cada medio año', url_dataset: 'https://datos.comodoro.gov.ar/dataset/ejemplo-2' }
  ]
};
```

4. Reemplazar las funciones completas `ejecutarNotificacionesDiarias`, `pruebaNotificacion` y `previewEmail` (con sus comentarios `/** ... */`) por las siguientes. `verificarSMTP`, que está entre `pruebaNotificacion` y `previewEmail`, queda igual:

```js
/**
 * Proceso diario (cron de las 8:00): aviso directo a las áreas y Notas Digitales
 */
export const ejecutarNotificacionesDiarias = async (req, res) => {
  const resultados = { fecha: new Date().toISOString(), enviados: [], errores: [], sinDatasets: [], notasDigitales: null };

  try {
    // Aviso directo a las áreas de gestión externa (40 días antes)
    const areasPorNotificar = await getDatasetsExternosPorArea(40);
    for (const areaData of areasPorNotificar) {
      const { subject, html } = templates.areaAviso40dias(areaData);
      const destinatarios = [areaData.email_principal, areaData.email_secundario].filter(Boolean);
      const result = await sendEmailToArea({ subject, html, to: destinatarios });
      const datasetsIds = areaData.datasets.map(d => d.id);
      await logNotificacion('area-aviso-40', areaData.area_id, destinatarios.join(','), datasetsIds, result.success, result.error);
      if (result.success) {
        resultados.enviados.push({ tipo: 'area-aviso-40', area: areaData.area_nombre, cantidad: areaData.datasets.length });
      } else {
        resultados.errores.push({ tipo: 'area-aviso-40', area: areaData.area_nombre, error: result.error });
      }
    }
    if (areasPorNotificar.length === 0) resultados.sinDatasets.push('area-aviso-40');

    // Notas Digitales (reemplazan los avisos de gestión interna y externa)
    try {
      resultados.notasDigitales = await ejecutarNotasDigitales({ hoy: hoyArgentina() });
      if (resultados.notasDigitales.fallidas > 0) {
        resultados.errores.push({ tipo: 'notas-digitales', error: `${resultados.notasDigitales.fallidas} nota(s) no se pudieron enviar` });
      }
    } catch (error) {
      console.error('Error en Notas Digitales:', error);
      resultados.errores.push({ tipo: 'notas-digitales', error: 'Error ejecutando Notas Digitales' });
    }

    const success = resultados.errores.length === 0;
    res.status(success ? 200 : 207).json({
      success,
      message: success ? 'Proceso completado.' : `Proceso completado con ${resultados.errores.length} errores.`,
      data: resultados
    });
  } catch (error) {
    console.error('Error en notificaciones:', error);
    res.status(500).json({ success: false, error: 'Error ejecutando notificaciones' });
  }
};

/**
 * Prueba del aviso a áreas: se envía solo a las casillas de prueba de Notas Digitales
 */
export const pruebaAvisoArea = async (req, res) => {
  try {
    const casillas = listaDeCorreos((await obtenerConfig()).casillas_prueba);
    if (casillas.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay casillas de prueba configuradas (Correos > Configuración)' });
    }
    const [area] = await getDatasetsExternosPorArea(40);
    const datosArea = area ?? AREA_DE_EJEMPLO;
    const { subject, html } = templates.areaAviso40dias(datosArea);
    const result = await sendEmailToArea({ subject: `[PRUEBA] ${subject}`, html, to: casillas });
    if (!result.success) return res.status(502).json({ success: false, error: `No se pudo enviar la prueba: ${result.error}` });
    res.json({
      success: true,
      message: `Prueba enviada a ${casillas.join(', ')}${area ? '' : ' (con datos de ejemplo)'}`,
      data: { area: datosArea.area_nombre, ejemplo: !area, destinatarios: casillas }
    });
  } catch (error) {
    console.error('Error en prueba de aviso a áreas:', error);
    res.status(500).json({ success: false, error: 'Error enviando la prueba' });
  }
};
```

```js
/**
 * Vista previa del aviso a áreas (sin enviar)
 */
export const previewEmail = async (req, res) => {
  if (req.params.tipo !== 'area-aviso-40') {
    return res.status(400).json({ success: false, error: 'Tipo no válido', tiposDisponibles: ['area-aviso-40'] });
  }
  try {
    const [area] = await getDatasetsExternosPorArea(40);
    const { html } = templates.areaAviso40dias(area ?? AREA_DE_EJEMPLO);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error en vista previa:', error);
    res.status(500).json({ success: false, error: 'Error generando la vista previa' });
  }
};
```

- [ ] **Step 6: Quitar las plantillas de los siete avisos de `services/emailTemplates.js`**

Borrar:
- las funciones `baseTemplate`, `externo40diasTemplate`, `generarDatasetsConContacto` y `baseExternoConContacto`, cada una con su comentario `/** ... */`. Ocupan desde el comentario de `baseTemplate` hasta el cierre de `baseExternoConContacto`, justo antes del comentario de `areaAviso40diasTemplate`;
- los bloques de exports `interno60dias`, `interno30dias`, `internoVencido`, `externo60dias`, `externo40dias`, `externo5dias` y `externoVencido`, con sus separadores `// =====`.

Conservar `COLORS`, `RPAD_URL`, `escapeHtml`, `areaAviso40diasTemplate`, `areaAviso40dias`, `contactoTemplate` y `cambiosPendientesTemplate`.

Verificar: `node --input-type=module -e "import('./services/emailTemplates.js').then(m=>console.log(Object.keys(m).sort().join(',')))"`
Expected: `areaAviso40dias,cambiosPendientesTemplate,contactoTemplate`

- [ ] **Step 7: Indicador de Gestión en `controllers/gestionController.js`**

Reemplazar la consulta de notificaciones de `getMetricasAutomaticas` (la que empieza en `// Notificaciones enviadas por mes`) por:

```js
    // Notificaciones enviadas por mes: emails del log + Notas Digitales enviadas (sin pruebas)
    const [notificaciones] = await pool.execute(
      `SELECT anio, mes, CAST(SUM(cantidad) AS UNSIGNED) AS cantidad FROM (
         SELECT YEAR(enviado_at) AS anio, MONTH(enviado_at) AS mes, COUNT(*) AS cantidad
         FROM notificaciones_log WHERE enviado_at >= ? AND success = TRUE
         GROUP BY YEAR(enviado_at), MONTH(enviado_at)
         UNION ALL
         SELECT YEAR(enviada_at), MONTH(enviada_at), COUNT(*)
         FROM notas_digitales WHERE enviada_at >= ? AND estado = 'enviada' AND es_prueba = 0
         GROUP BY YEAR(enviada_at), MONTH(enviada_at)
       ) t
       GROUP BY anio, mes
       ORDER BY anio, mes`,
      [desde, desde]
    );
```

y la de `exportarMetricasCSV` (la que empieza en `// Notificaciones por mes`) por:

```js
    // Notificaciones por mes: emails del log + Notas Digitales enviadas (sin pruebas)
    const [notificaciones] = await pool.execute(
      `SELECT anio, mes, CAST(SUM(cantidad) AS UNSIGNED) AS cantidad, 'notificaciones_enviadas' AS tipo FROM (
         SELECT YEAR(enviado_at) AS anio, MONTH(enviado_at) AS mes, COUNT(*) AS cantidad
         FROM notificaciones_log WHERE enviado_at >= ? AND success = TRUE
         GROUP BY YEAR(enviado_at), MONTH(enviado_at)
         UNION ALL
         SELECT YEAR(enviada_at), MONTH(enviada_at), COUNT(*)
         FROM notas_digitales WHERE enviada_at >= ? AND estado = 'enviada' AND es_prueba = 0
         GROUP BY YEAR(enviada_at), MONTH(enviada_at)
       ) t
       GROUP BY anio, mes`,
      [desde, desde]
    );
```

- [ ] **Step 8: Rutas en `routes/index.js`**

1. En el import de `notificacionesController`, reemplazar `pruebaNotificacion,` por `pruebaAvisoArea,`.
2. Agregar después de ese import:

```js
import {
  listarNotas,
  obtenerNota,
  descargarPdf,
  reintentarNota,
  verEstado,
  verPreview,
  enviarPrueba,
  verConfig,
  guardarConfig,
  subirFirma,
  verFirma
} from '../controllers/notasDigitalesController.js';
```

3. En el bloque de Notificaciones, reemplazar la línea `router.get('/notificaciones/prueba/:tipo', ...)` por `router.post('/notificaciones/prueba-area', authMiddleware, adminOnly, pruebaAvisoArea);` y agregar al final del bloque (las rutas fijas antes que `/:id`):

```js
// Notas Digitales (solo admin)
router.get('/notificaciones/notas-digitales', authMiddleware, adminOnly, listarNotas);
router.get('/notificaciones/notas-digitales/estado', authMiddleware, adminOnly, verEstado);
router.get('/notificaciones/notas-digitales/preview', authMiddleware, adminOnly, verPreview);
router.post('/notificaciones/notas-digitales/prueba', authMiddleware, adminOnly, enviarPrueba);
router.get('/notificaciones/notas-digitales/config', authMiddleware, adminOnly, verConfig);
router.put('/notificaciones/notas-digitales/config', authMiddleware, adminOnly, guardarConfig);
router.get('/notificaciones/notas-digitales/config/firma', authMiddleware, adminOnly, verFirma);
router.put('/notificaciones/notas-digitales/config/firma', authMiddleware, adminOnly, subirFirma);
router.get('/notificaciones/notas-digitales/:id', authMiddleware, adminOnly, obtenerNota);
router.get('/notificaciones/notas-digitales/:id/pdf', authMiddleware, adminOnly, descargarPdf);
router.post('/notificaciones/notas-digitales/:id/reintentar', authMiddleware, adminOnly, reintentarNota);
```

- [ ] **Step 9: Correr y ver que pasa**

Run: `node --test tests/notas-api.test.js tests/permisos.test.js tests/notificaciones.test.js`
Expected: PASS.
Run: `npm test`
Expected: todos en verde.

- [ ] **Step 10: Commit**

```bash
git add controllers/notasDigitalesController.js controllers/notificacionesController.js services/emailTemplates.js controllers/gestionController.js routes/index.js tests/notas-api.test.js tests/permisos.test.js tests/notificaciones.test.js
git commit -m "feat: API de Notas Digitales y retiro de los siete avisos por email"
```

---

### Task 9: Pantalla de Correos

**Files:**
- Modify: `public/js/api.js` (sección `// === NOTIFICACIONES ===`)
- Modify: `public/correos.html`
- Modify: `public/js/correos.js` (reescritura completa)
- Modify: todos los `public/*.html` que cargan `api.js?v=20261012` (versión nueva)

**Interfaces:**
- Consumes: API de la Tarea 8.
- Produces: métodos de `API`: `pedirJson(metodo, ruta, body?)`, `pedirArchivo(ruta) → Blob`, `enviarPruebaAvisoArea()`, `getEstadoNotas()`, `getLibroNotas(filtros)`, `getNota(id)`, `getNotaPdf(id)`, `reintentarNota(id)`, `previewNota(tipo, gestion)`, `enviarPruebaNota(tipo, gestion)`, `getConfigNotas()`, `guardarConfigNotas(datos)`, `subirFirmaNotas(imagen, mime)`, `getFirmaNotas()`.

- [ ] **Step 1: `public/js/api.js`**

Reemplazar el método `enviarNotificacionPrueba(tipo) { ... }` completo por:

```js
  // Pedido JSON autenticado: lanza un Error con el mensaje del servidor si falla
  async pedirJson(metodo, ruta, body) {
    const response = await fetch(`${CONFIG.API_URL}${ruta}`, {
      method: metodo,
      headers: Auth.getAuthHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
    return data;
  },

  async pedirArchivo(ruta) {
    const response = await fetch(`${CONFIG.API_URL}${ruta}`, { headers: Auth.getAuthHeaders() });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Error ${response.status}`);
    }
    return response.blob();
  },

  async enviarPruebaAvisoArea() {
    return this.pedirJson('POST', '/notificaciones/prueba-area');
  },

  // === NOTAS DIGITALES ===
  async getEstadoNotas() {
    return (await this.pedirJson('GET', '/notificaciones/notas-digitales/estado')).data;
  },

  async getLibroNotas(filtros = {}) {
    const params = new URLSearchParams(Object.entries(filtros).filter(([, valor]) => valor !== '' && valor != null));
    const query = params.toString();
    return (await this.pedirJson('GET', `/notificaciones/notas-digitales${query ? `?${query}` : ''}`)).data;
  },

  async getNota(id) {
    return (await this.pedirJson('GET', `/notificaciones/notas-digitales/${id}`)).data;
  },

  async getNotaPdf(id) {
    return this.pedirArchivo(`/notificaciones/notas-digitales/${id}/pdf`);
  },

  async reintentarNota(id) {
    return this.pedirJson('POST', `/notificaciones/notas-digitales/${id}/reintentar`);
  },

  async previewNota(tipo, gestion) {
    const query = new URLSearchParams({ tipo, gestion }).toString();
    return (await this.pedirJson('GET', `/notificaciones/notas-digitales/preview?${query}`)).data;
  },

  async enviarPruebaNota(tipo, gestion) {
    return this.pedirJson('POST', '/notificaciones/notas-digitales/prueba', { tipo, gestion });
  },

  async getConfigNotas() {
    return (await this.pedirJson('GET', '/notificaciones/notas-digitales/config')).data;
  },

  async guardarConfigNotas(datos) {
    return this.pedirJson('PUT', '/notificaciones/notas-digitales/config', datos);
  },

  async subirFirmaNotas(imagen, mime) {
    return this.pedirJson('PUT', '/notificaciones/notas-digitales/config/firma', { imagen, mime });
  },

  async getFirmaNotas() {
    return this.pedirArchivo('/notificaciones/notas-digitales/config/firma');
  },
```

- [ ] **Step 2: `public/correos.html`: estilos**

Agregar al final del bloque `<style>` existente:

```css
        .nd-switch-row { display: flex; align-items: center; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
        .nd-switch { display: flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer; }
        .nd-proximas { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 12px; }
        .nd-proxima { border: 1px solid var(--gray-200); border-radius: 8px; padding: 10px 12px; font-size: 0.875rem; }
        .nd-alerta { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 8px; padding: 10px 12px; margin-top: 12px; font-size: 0.875rem; }
        .nd-filtros { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; align-items: center; }
        .nd-filtros .form-select { width: auto; min-width: 150px; }
        .nd-check { display: flex; align-items: center; gap: 6px; font-size: 0.875rem; }
        .nd-marco { width: 100%; height: 560px; border: 1px solid var(--gray-200); border-radius: 8px; margin-top: 12px; background: #ffffff; }
        .nd-config fieldset { border: 1px solid var(--gray-200); border-radius: 8px; padding: 12px 16px; margin: 0 0 12px; }
        .nd-config legend { font-weight: 600; padding: 0 6px; }
        .nd-firma { display: block; max-width: 220px; max-height: 90px; margin-top: 8px; border: 1px dashed var(--gray-300); padding: 4px; background: #ffffff; }
        .nd-modal { max-width: 900px; width: 95%; }
        .nd-acciones { display: flex; gap: 6px; flex-wrap: wrap; }
```

- [ ] **Step 3: `public/correos.html`: contenido**

Reemplazar todo lo que hay entre `<div id="message-container"></div>` y `<!-- Footer -->` (las tarjetas "Estado del Servidor SMTP" y "Probar Alertas por Email") por:

```html
            <!-- Estado -->
            <div class="smtp-card">
                <div class="smtp-card-header">
                    <div class="smtp-card-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
                    </div>
                    <h3>Estado</h3>
                </div>
                <div class="smtp-status-row">
                    <button type="button" id="btn-verificar-smtp" class="btn btn-secondary">Verificar conexión SMTP</button>
                    <span id="smtp-status" class="smtp-status">Sin verificar</span>
                </div>
                <div class="nd-switch-row">
                    <label class="nd-switch" for="envio-activo">
                        <input type="checkbox" id="envio-activo">
                        <span>Envío automático de Notas Digitales</span>
                    </label>
                    <span id="envio-activo-texto" class="badge badge-secondary">Desactivado</span>
                </div>
                <div id="nd-alertas"></div>
                <div id="nd-proximas" class="nd-proximas"></div>
                <p class="test-hint">Aviso de gestión interna 60 días antes del vencimiento y de gestión externa 30 días antes. Reiteración el primer día hábil de cada mes para los datasets avisados hace 21 días o más que siguen pendientes. Solo en días hábiles.</p>
            </div>

            <!-- Libro de Notas Digitales -->
            <div class="smtp-card">
                <div class="smtp-card-header">
                    <div class="smtp-card-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                    </div>
                    <h3>Libro de Notas Digitales</h3>
                </div>
                <div class="nd-filtros">
                    <select id="filtro-anio" class="form-select" aria-label="Año"><option value="">Todos los años</option></select>
                    <select id="filtro-tipo" class="form-select" aria-label="Tipo">
                        <option value="">Aviso y reiteración</option>
                        <option value="aviso">Aviso</option>
                        <option value="reiteracion">Reiteración</option>
                    </select>
                    <select id="filtro-gestion" class="form-select" aria-label="Gestión">
                        <option value="">Interna y externa</option>
                        <option value="interna">Interna</option>
                        <option value="externa">Externa</option>
                    </select>
                    <select id="filtro-estado" class="form-select" aria-label="Estado">
                        <option value="">Todos los estados</option>
                        <option value="enviada">Enviada</option>
                        <option value="fallida">Fallida</option>
                        <option value="pendiente">Pendiente</option>
                    </select>
                    <select id="filtro-dataset" class="form-select" aria-label="Dataset"><option value="">Todos los datasets</option></select>
                    <label class="nd-check"><input type="checkbox" id="filtro-pruebas"> Incluir pruebas</label>
                </div>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr><th>N°</th><th>Fecha</th><th>Tipo</th><th>Gestión</th><th>Datasets</th><th>Para / CC</th><th>Estado</th><th></th></tr>
                        </thead>
                        <tbody id="libro-cuerpo"><tr><td colspan="8">Cargando…</td></tr></tbody>
                    </table>
                </div>
            </div>

            <!-- Vista previa y prueba -->
            <div class="smtp-card">
                <div class="smtp-card-header">
                    <div class="smtp-card-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </div>
                    <h3>Vista previa y prueba</h3>
                </div>
                <div class="test-controls">
                    <select id="preview-tipo" class="form-select" aria-label="Tipo de nota">
                        <option value="aviso">Aviso</option>
                        <option value="reiteracion">Reiteración</option>
                    </select>
                    <select id="preview-gestion" class="form-select" aria-label="Gestión">
                        <option value="interna">Gestión interna</option>
                        <option value="externa">Gestión externa</option>
                    </select>
                    <button type="button" id="btn-preview" class="btn btn-primary">Vista previa</button>
                    <button type="button" id="btn-prueba" class="btn btn-outline">Enviarme una prueba</button>
                </div>
                <p id="preview-aviso" class="test-hint" hidden></p>
                <iframe id="preview-marco" class="nd-marco" sandbox="" title="Vista previa de la nota" hidden></iframe>
            </div>

            <!-- Configuración -->
            <div class="smtp-card">
                <div class="smtp-card-header">
                    <div class="smtp-card-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    </div>
                    <h3>Configuración</h3>
                </div>
                <form id="form-config" class="nd-config">
                    <fieldset>
                        <legend>Gestión interna</legend>
                        <div class="form-group"><label class="form-label" for="para_interna">Para</label><input id="para_interna" class="form-input" autocomplete="off"></div>
                        <div class="form-group"><label class="form-label" for="cc_interna">CC</label><input id="cc_interna" class="form-input" autocomplete="off"></div>
                        <div class="form-group"><label class="form-label" for="linea_cc_interna">Línea de CC al pie de la nota</label><input id="linea_cc_interna" class="form-input" maxlength="200"></div>
                    </fieldset>
                    <fieldset>
                        <legend>Gestión externa</legend>
                        <div class="form-group"><label class="form-label" for="para_externa">Para</label><input id="para_externa" class="form-input" autocomplete="off"></div>
                        <div class="form-group"><label class="form-label" for="cc_externa">CC</label><input id="cc_externa" class="form-input" autocomplete="off"></div>
                        <div class="form-group"><label class="form-label" for="linea_cc_externa">Línea de CC al pie de la nota</label><input id="linea_cc_externa" class="form-input" maxlength="200"></div>
                    </fieldset>
                    <fieldset>
                        <legend>Respaldo y pruebas</legend>
                        <div class="form-group"><label class="form-label" for="cco">Copia oculta (CCO) de respaldo</label><input id="cco" class="form-input" autocomplete="off"></div>
                        <div class="form-group"><label class="form-label" for="casillas_prueba">Casillas de prueba</label><input id="casillas_prueba" class="form-input" autocomplete="off"></div>
                    </fieldset>
                    <fieldset>
                        <legend>Firma</legend>
                        <div class="form-group"><label class="form-label" for="firma_nombre">Nombre</label><input id="firma_nombre" class="form-input" maxlength="150"></div>
                        <div class="form-group"><label class="form-label" for="firma_cargo">Cargo</label><input id="firma_cargo" class="form-input" maxlength="200"></div>
                        <div class="form-group">
                            <label class="form-label" for="firma-archivo">Imagen de la firma (PNG o JPEG, máximo 500 KB)</label>
                            <input type="file" id="firma-archivo" class="form-input" accept="image/png,image/jpeg">
                            <img id="firma-vista" class="nd-firma" alt="Firma cargada" hidden>
                        </div>
                    </fieldset>
                    <p class="form-hint">Separá varias direcciones con coma.</p>
                    <button type="submit" class="btn btn-primary">Guardar configuración</button>
                </form>
            </div>

            <!-- Aviso a las áreas -->
            <div class="smtp-card">
                <div class="smtp-card-header">
                    <div class="smtp-card-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    </div>
                    <h3>Aviso a las áreas (40 días)</h3>
                </div>
                <p class="test-hint">Email directo a las áreas de gestión externa 40 días antes del vencimiento. La prueba se envía solo a las casillas de prueba.</p>
                <div class="test-controls">
                    <button type="button" id="btn-preview-area" class="btn btn-primary">Vista previa</button>
                    <button type="button" id="btn-prueba-area" class="btn btn-outline">Enviarme una prueba</button>
                </div>
                <iframe id="preview-area-marco" class="nd-marco" sandbox="" title="Vista previa del aviso a áreas" hidden></iframe>
            </div>

            <!-- Modal: nota enviada -->
            <div class="modal-overlay" id="modal-nota">
                <div class="modal nd-modal" role="dialog" aria-modal="true" aria-labelledby="modal-nota-titulo">
                    <div class="modal-header">
                        <h3 class="modal-title" id="modal-nota-titulo">Nota</h3>
                        <button type="button" class="modal-close" id="modal-nota-cerrar" aria-label="Cerrar">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p id="modal-nota-datos" class="test-hint"></p>
                        <iframe id="modal-nota-marco" class="nd-marco" sandbox="" title="Nota enviada"></iframe>
                    </div>
                </div>
            </div>
```

- [ ] **Step 4: Reescribir `public/js/correos.js` completo**

```js
// Correos: estado, libro de Notas Digitales, vista previa, configuración y aviso a las áreas
let configActual = null;

const CAMPOS_CONFIG = ['para_interna', 'cc_interna', 'linea_cc_interna', 'para_externa', 'cc_externa', 'linea_cc_externa',
  'cco', 'casillas_prueba', 'firma_nombre', 'firma_cargo'];
const ETIQUETAS = { aviso: 'Aviso', reiteracion: 'Reiteración', interna: 'Interna', externa: 'Externa', enviada: 'Enviada', fallida: 'Fallida', pendiente: 'Pendiente' };
const CLASE_ESTADO = { enviada: 'badge-success', fallida: 'badge-danger', pendiente: 'badge-warning' };

// Los mensajes del servidor se escapan: showToast inserta HTML
const avisar = (mensaje, tipo = 'info') => showToast(Utils.escapeHtml(mensaje), tipo);
// 'AAAA-MM-DD' → 'dd/mm/aaaa' sin pasar por Date (evita corrimientos de zona horaria)
const fecha = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }
  if (!Auth.isAdmin()) {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('btn-verificar-smtp').addEventListener('click', verificarConexionSMTP);
  document.getElementById('envio-activo').addEventListener('change', cambiarEnvioAutomatico);
  ['filtro-anio', 'filtro-tipo', 'filtro-gestion', 'filtro-estado', 'filtro-dataset', 'filtro-pruebas']
    .forEach(id => document.getElementById(id).addEventListener('change', cargarLibro));
  document.getElementById('libro-cuerpo').addEventListener('click', accionDelLibro);
  document.getElementById('btn-preview').addEventListener('click', verVistaPrevia);
  document.getElementById('btn-prueba').addEventListener('click', enviarmePrueba);
  document.getElementById('form-config').addEventListener('submit', guardarConfiguracion);
  document.getElementById('firma-archivo').addEventListener('change', subirFirma);
  document.getElementById('btn-preview-area').addEventListener('click', verVistaPreviaArea);
  document.getElementById('btn-prueba-area').addEventListener('click', enviarmePruebaArea);
  document.getElementById('modal-nota-cerrar').addEventListener('click', cerrarModalNota);

  inicializarFiltros();
  cargarEstado();
  cargarConfiguracion();
  cargarLibro();
});

// =====================================================
// ESTADO
// =====================================================
async function verificarConexionSMTP() {
  const estado = document.getElementById('smtp-status');
  estado.className = 'smtp-status checking';
  estado.textContent = 'Verificando…';
  try {
    const res = await API.verificarSmtp();
    estado.className = `smtp-status ${res.success ? 'success' : 'error'}`;
    estado.textContent = res.success ? 'Conexión OK' : `Error: ${res.error || 'sin detalle'}${res.code ? ` (${res.code})` : ''}`;
  } catch (error) {
    estado.className = 'smtp-status error';
    estado.textContent = `Error: ${error.message}`;
  }
}

async function cargarEstado() {
  try {
    const estado = await API.getEstadoNotas();
    document.getElementById('envio-activo').checked = estado.envio_activo;
    const texto = document.getElementById('envio-activo-texto');
    texto.textContent = estado.envio_activo ? 'Activado' : 'Desactivado';
    texto.className = `badge ${estado.envio_activo ? 'badge-success' : 'badge-secondary'}`;

    const alertas = [];
    if (estado.configuracion_faltante.length) {
      alertas.push(`Configuración incompleta: falta ${estado.configuracion_faltante.join(', ')}. Sin esto no se envían notas.`);
    }
    if (estado.fallidas > 0) {
      alertas.push(`Hay ${estado.fallidas} nota(s) que no se pudieron enviar. Revisalas en el libro con el filtro "Fallida".`);
    }
    document.getElementById('nd-alertas').innerHTML = alertas.map(a => `<div class="nd-alerta">${Utils.escapeHtml(a)}</div>`).join('');

    const nombres = { interna: 'Gestión interna', externa: 'Gestión externa' };
    document.getElementById('nd-proximas').innerHTML = Object.entries(estado.proximas).map(([gestion, p]) => `
      <div class="nd-proxima">
        <strong>${nombres[gestion]}</strong><br>
        Próximo aviso: ${p.aviso ? `${fecha(p.aviso.fecha)} (${p.aviso.cantidad} dataset/s)` : 'sin datasets pendientes'}<br>
        Próxima reiteración: ${fecha(p.reiteracion.fecha)} (${p.reiteracion.cantidad} dataset/s)
      </div>`).join('');
  } catch (error) {
    avisar(`No se pudo cargar el estado: ${error.message}`, 'error');
  }
}

async function cambiarEnvioAutomatico(evento) {
  const activar = evento.target.checked;
  if (activar && !confirm('¿Activar el envío automático? Desde la próxima corrida diaria (08:00) se enviarán Notas Digitales reales a los destinatarios configurados.')) {
    evento.target.checked = false;
    return;
  }
  try {
    await API.guardarConfigNotas({ envio_activo: activar });
    avisar(activar ? 'Envío automático activado' : 'Envío automático desactivado', 'success');
  } catch (error) {
    evento.target.checked = !activar;
    avisar(error.message, 'error');
  }
  cargarEstado();
}

// =====================================================
// LIBRO
// =====================================================
function inicializarFiltros() {
  const selectorAnio = document.getElementById('filtro-anio');
  for (let anio = new Date().getFullYear(); anio >= 2026; anio--) {
    selectorAnio.insertAdjacentHTML('beforeend', `<option value="${anio}">${anio}</option>`);
  }
  API.getDatasets()
    .then((datasets) => {
      const opciones = datasets.slice()
        .sort((a, b) => a.titulo.localeCompare(b.titulo))
        .map(d => `<option value="${d.id}">${Utils.escapeHtml(d.titulo)}</option>`)
        .join('');
      document.getElementById('filtro-dataset').insertAdjacentHTML('beforeend', opciones);
    })
    .catch(() => {});
}

const numeroDe = (nota) => (nota.es_prueba ? 'PRUEBA' : `${nota.numero}/${String(nota.anio).slice(-2)}`);

async function cargarLibro() {
  const cuerpo = document.getElementById('libro-cuerpo');
  const filtros = {
    anio: document.getElementById('filtro-anio').value,
    tipo: document.getElementById('filtro-tipo').value,
    gestion: document.getElementById('filtro-gestion').value,
    estado: document.getElementById('filtro-estado').value,
    dataset_id: document.getElementById('filtro-dataset').value,
    incluir_pruebas: document.getElementById('filtro-pruebas').checked ? '1' : ''
  };
  try {
    const notas = await API.getLibroNotas(filtros);
    if (!notas.length) {
      cuerpo.innerHTML = '<tr><td colspan="8">No hay notas con estos filtros.</td></tr>';
      return;
    }
    cuerpo.innerHTML = notas.map((n) => {
      const archivo = n.es_prueba ? `Nota-Digital-PRUEBA-${n.id}.pdf` : `Nota-Digital-${n.numero}-${String(n.anio).slice(-2)}.pdf`;
      const detalleEstado = n.ultimo_error || n.respuesta_smtp || '';
      return `
      <tr>
        <td>${numeroDe(n)}</td>
        <td>${fecha(n.fecha)}</td>
        <td>${ETIQUETAS[n.tipo]}</td>
        <td>${ETIQUETAS[n.gestion]}</td>
        <td>${n.cantidad_datasets}${n.seccion_dataset ? ` (${n.seccion_dataset === 'vencido' ? 'vencido' : 'próximo'})` : ''}</td>
        <td>${Utils.escapeHtml(n.para)}${n.cc ? `<br><small>CC: ${Utils.escapeHtml(n.cc)}</small>` : ''}</td>
        <td>
          <span class="badge ${CLASE_ESTADO[n.estado]}" title="${Utils.escapeHtml(detalleEstado)}">${ETIQUETAS[n.estado]}</span>
          ${n.enviada_at ? `<br><small>${Utils.escapeHtml(n.enviada_at)}</small>` : ''}
        </td>
        <td class="nd-acciones">
          <button type="button" class="btn btn-secondary btn-sm" data-accion="ver" data-id="${n.id}">Ver</button>
          <button type="button" class="btn btn-secondary btn-sm" data-accion="pdf" data-id="${n.id}" data-archivo="${Utils.escapeHtml(archivo)}">PDF</button>
          ${n.estado !== 'enviada' ? `<button type="button" class="btn btn-outline btn-sm" data-accion="reintentar" data-id="${n.id}">Reintentar</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  } catch (error) {
    cuerpo.innerHTML = `<tr><td colspan="8">${Utils.escapeHtml(error.message)}</td></tr>`;
  }
}

async function accionDelLibro(evento) {
  const boton = evento.target.closest('button[data-accion]');
  if (!boton) return;
  const id = Number(boton.dataset.id);
  try {
    if (boton.dataset.accion === 'ver') {
      const nota = await API.getNota(id);
      document.getElementById('modal-nota-titulo').textContent = nota.asunto;
      document.getElementById('modal-nota-datos').textContent = [
        `Para: ${nota.para}`,
        nota.cc ? `CC: ${nota.cc}` : '',
        nota.cco ? `CCO: ${nota.cco}` : '',
        nota.respuesta_smtp ? `Servidor: ${nota.respuesta_smtp}` : ''
      ].filter(Boolean).join(' · ');
      document.getElementById('modal-nota-marco').srcdoc = nota.html;
      document.getElementById('modal-nota').classList.add('active');
    } else if (boton.dataset.accion === 'pdf') {
      const url = URL.createObjectURL(await API.getNotaPdf(id));
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = boton.dataset.archivo;
      enlace.click();
      URL.revokeObjectURL(url);
    } else if (boton.dataset.accion === 'reintentar') {
      boton.disabled = true;
      const resultado = await API.reintentarNota(id);
      avisar(resultado.message, 'success');
    }
  } catch (error) {
    avisar(error.message, 'error');
  } finally {
    if (boton.dataset.accion === 'reintentar') {
      cargarLibro();
      cargarEstado();
    }
  }
}

function cerrarModalNota() {
  document.getElementById('modal-nota').classList.remove('active');
  document.getElementById('modal-nota-marco').srcdoc = '';
}

// =====================================================
// VISTA PREVIA Y PRUEBA
// =====================================================
const tipoYGestion = () => ({
  tipo: document.getElementById('preview-tipo').value,
  gestion: document.getElementById('preview-gestion').value
});

async function verVistaPrevia() {
  const { tipo, gestion } = tipoYGestion();
  try {
    const vista = await API.previewNota(tipo, gestion);
    const aviso = document.getElementById('preview-aviso');
    aviso.hidden = false;
    aviso.textContent = vista.ejemplo
      ? 'Hoy no saldría ninguna nota de este tipo: se muestran datos de ejemplo.'
      : `Con los datos de hoy esta nota incluiría ${vista.cantidad} dataset(s). Asunto: ${vista.asunto}`;
    const marco = document.getElementById('preview-marco');
    marco.srcdoc = vista.html;
    marco.hidden = false;
  } catch (error) {
    avisar(error.message, 'error');
  }
}

async function enviarmePrueba() {
  const { tipo, gestion } = tipoYGestion();
  if (!confirm('Se enviará esta nota marcada como PRUEBA solo a las casillas de prueba configuradas. ¿Continuar?')) return;
  try {
    const resultado = await API.enviarPruebaNota(tipo, gestion);
    avisar(resultado.message, 'success');
    cargarLibro();
  } catch (error) {
    avisar(error.message, 'error');
  }
}

// =====================================================
// CONFIGURACIÓN
// =====================================================
async function cargarConfiguracion() {
  try {
    configActual = await API.getConfigNotas();
    CAMPOS_CONFIG.forEach((campo) => {
      document.getElementById(campo).value = configActual[campo] ?? '';
    });
    mostrarFirma();
  } catch (error) {
    avisar(`No se pudo cargar la configuración: ${error.message}`, 'error');
  }
}

async function mostrarFirma() {
  const imagen = document.getElementById('firma-vista');
  if (!configActual?.tiene_firma) {
    imagen.hidden = true;
    return;
  }
  try {
    imagen.src = URL.createObjectURL(await API.getFirmaNotas());
    imagen.hidden = false;
  } catch {
    imagen.hidden = true;
  }
}

async function guardarConfiguracion(evento) {
  evento.preventDefault();
  const datos = Object.fromEntries(CAMPOS_CONFIG.map(campo => [campo, document.getElementById(campo).value]));
  try {
    await API.guardarConfigNotas(datos);
    avisar('Configuración guardada', 'success');
    await cargarConfiguracion();
    cargarEstado();
  } catch (error) {
    avisar(error.message, 'error');
  }
}

function subirFirma(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;
  if (!['image/png', 'image/jpeg'].includes(archivo.type)) {
    avisar('La firma debe ser una imagen PNG o JPEG', 'error');
    evento.target.value = '';
    return;
  }
  if (archivo.size > 500 * 1024) {
    avisar('La imagen debe pesar como máximo 500 KB', 'error');
    evento.target.value = '';
    return;
  }
  const lector = new FileReader();
  lector.onload = async () => {
    try {
      await API.subirFirmaNotas(lector.result, archivo.type);
      avisar('Firma guardada', 'success');
      await cargarConfiguracion();
      cargarEstado();
    } catch (error) {
      avisar(error.message, 'error');
    }
    evento.target.value = '';
  };
  lector.readAsDataURL(archivo);
}

// =====================================================
// AVISO A LAS ÁREAS
// =====================================================
async function verVistaPreviaArea() {
  try {
    const marco = document.getElementById('preview-area-marco');
    marco.srcdoc = await API.previewNotificacion('area-aviso-40');
    marco.hidden = false;
  } catch (error) {
    avisar(error.message, 'error');
  }
}

async function enviarmePruebaArea() {
  if (!confirm('Se enviará el aviso a áreas marcado como PRUEBA solo a las casillas de prueba. ¿Continuar?')) return;
  try {
    const resultado = await API.enviarPruebaAvisoArea();
    avisar(resultado.message, 'success');
  } catch (error) {
    avisar(error.message, 'error');
  }
}
```

- [ ] **Step 5: Versionar los scripts modificados**

Run: `node -e "const fs=require('fs');for(const f of fs.readdirSync('public').filter(f=>f.endsWith('.html'))){const r='public/'+f;const s=fs.readFileSync(r,'utf8');const n=s.split('js/api.js?v=20261012').join('js/api.js?v=20261013').split('<script src=\"js/correos.js\"></script>').join('<script src=\"js/correos.js?v=20261013\"></script>');if(n!==s){fs.writeFileSync(r,n);console.log(f)}}"`
Expected: lista los 12 HTML que cargan `api.js`. Verificar que `grep -c "correos.js?v=20261013" public/correos.html` dé `1`.

- [ ] **Step 6: Verificación en el navegador (con la app local en el puerto 3001 y una sesión de admin)**

Abrir `correos.html` y comprobar cada punto; si algo no se cumple, corregir antes de seguir:
1. La consola del navegador no muestra errores al cargar.
2. "Verificar conexión SMTP" muestra "Conexión OK" (Mailpit).
3. Con la base local recién migrada, la alerta indica "falta nombre de la firma, cargo de la firma" y el interruptor está desactivado.
4. Activar el interruptor sin firma muestra un toast con el error y el interruptor vuelve a desactivado.
5. Cargar en Configuración: firma (nombre, cargo e imagen `database/dump-local/firma.png`), casillas de prueba `prueba@rpad.test`; guardar. La imagen se ve debajo del campo y la alerta de configuración desaparece.
6. Poner `a@x.gov.ar; b@y.gov.ar` en un CC y guardar: al recargar figura `a@x.gov.ar, b@y.gov.ar`. Poner `no-es-email` en un Para: toast de error y no se guarda.
7. Vista previa de las 4 combinaciones: el marco muestra la nota con `N° XX` y aparece el aviso de datos reales o de ejemplo. En la externa se ven los contactos.
8. "Enviarme una prueba": toast con la casilla de prueba. En el libro, con "Incluir pruebas", aparece la fila `PRUEBA`; "Ver" abre el modal con la nota y "PDF" descarga un archivo que abre con el formato oficio y la firma.
9. Aviso a las áreas: la vista previa y la prueba funcionan (la prueba llega a Mailpit, http://localhost:8025, a la casilla de prueba).
10. Filtros del libro: cambiar tipo, gestión y estado actualiza la tabla sin errores.
11. A 375 px de ancho la página no tiene scroll horizontal (salvo dentro de la tabla).

- [ ] **Step 7: Correr la batería y commit**

Run: `npm test`
Expected: todos en verde.

```bash
git add public/
git commit -m "feat: pantalla de Correos con Notas Digitales"
```

---

### Task 10: Verificación final, documentación y prueba con el servidor real

**Files:**
- Modify: `README.md` (secciones "Configurar Cron Job" y "Notificaciones no se envían")

- [ ] **Step 1: Actualizar `README.md`**

Debajo de la tabla de "### 2. Configurar en cPanel → Cron Jobs", reemplazar la línea `Esto ejecuta las notificaciones todos los días a las 8:00 AM.` por:

```markdown
Esto ejecuta todos los días a las 8:00 el aviso directo a las áreas (40 días antes) y las **Notas Digitales**:

- **Aviso**: gestión interna 60 días antes del vencimiento, gestión externa 30 días antes.
- **Reiteración**: primer día hábil de cada mes, para los datasets avisados hace 21 días o más que siguen pendientes.
- Solo en días hábiles. Cada nota se numera (`Nota Digital N° 12/26`), se envía con el PDF adjunto y queda en el libro de la pantalla de Correos.
- El envío automático arranca **desactivado**: se activa desde Correos cuando la configuración (destinatarios y firma) está completa.
```

Y en "### Notificaciones no se envían", agregar:

```markdown
- En Correos, revisar que el envío automático de Notas Digitales esté activado y que no haya alertas de configuración incompleta
- Revisar en el libro de Notas Digitales las notas "Fallida" (el detalle del error está en el estado) y reintentarlas
- En desarrollo, `EMAIL_SOLO_A` en `.env` limita los envíos a esas casillas
```

- [ ] **Step 2: Batería completa y revisión del diff**

Run: `npm test`
Expected: todos en verde (más de 200 tests).
Run: `git diff main --stat`
Expected: solo los archivos del mapa de archivos de este plan, la especificación y este plan. Revisar que no haya imágenes, casillas personales ni contraseñas: `git diff main -- . ':!docs' | grep -i -E "gmail|yahoo|\.png|SMTP_PASS="` no debe devolver nada (se excluye `docs/` porque este plan contiene el propio patrón de búsqueda).

- [ ] **Step 3: Prueba real con el servidor de correo oficial (con OK del usuario antes de enviar)**

1. Pedir al usuario que, en el `.env` local, cambie `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` y `SMTP_PASS` a la cuenta oficial (lo hace él; no escribir credenciales) y confirmar que `EMAIL_SOLO_A` tiene sus casillas de prueba.
2. Reiniciar la app. En Correos, "Verificar conexión SMTP" debe dar OK.
3. En Configuración, poner como casillas de prueba las mismas de `EMAIL_SOLO_A`.
4. Con el OK del usuario, enviar la prueba de las 4 variantes y del aviso a áreas.
5. El usuario revisa en sus casillas: bandeja de entrada (no spam), formato en el cliente de correo, PDF adjunto, firma.
6. Volver el `.env` a Mailpit (`SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`) y correr `npm test` para confirmar que la batería sigue en verde.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: Notas Digitales en el README"
```
