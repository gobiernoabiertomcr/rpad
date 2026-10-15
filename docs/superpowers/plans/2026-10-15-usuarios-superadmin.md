# Usuarios: rol superadmin y panel de usuarios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar el rol superadmin, un panel de usuarios para admin y superadmin, contraseñas por link de un solo uso (invitación, recuperación y "¿Olvidaste tu contraseña?"), revocación inmediata de sesiones, cargo y vínculo de cada usuario, auditoría y aviso al superadmin, **sin romper nada de lo que hoy funciona**.

**Architecture:** El rol pasa a ser `superadmin | admin | lector` y un helper `esAdmin` reemplaza las comparaciones con `'admin'`. `authMiddleware` lee el rol, `activo` y `sesion_version` de la base en cada pedido. Las reglas puras viven en `services/usuariosReglas.js`; los links y sus emails, en `services/accesoService.js`; el historial, en `services/usuariosAuditoriaService.js`; el panel, en `controllers/usuariosController.js`. El frontend suma `usuarios.html` y `establecer-contrasena.html`, y ajusta `auth.js`, `main.js`, `api.js`, `perfil.js` y el sidebar de todas las páginas.

**Tech Stack:** Node 22 en producción (24 en desarrollo), Express 4, ES Modules, MariaDB 10.11 (mysql2/promise), bcryptjs, jsonwebtoken, express-rate-limit 8, Nodemailer, frontend vanilla JS, `node:test` contra Docker (MariaDB + Mailpit).

**Spec:** `docs/superpowers/specs/2026-10-15-usuarios-superadmin-design.md`. La spec manda; este plan es su argumento. Los números de sección que se citan ("spec 8.1") son de esa spec.

## Global Constraints

- **Regla principal del usuario: no romper nada de lo implementado.** Antes de empezar se guarda una línea de base de `npm test` (Task 0). **Cada tarea termina corriendo la suite completa** y comparándola con la línea de base: no puede aparecer ninguna falla nueva. Si una falla existía en la línea de base, se informa y no se toca.
- Se trabaja en la rama `feat/usuarios-superadmin`, nunca en `main`.
- Node 22 en producción: no usar APIs que no existan en Node 22. ES Modules, `async/await`, arrow functions, español en nombres, comentarios y textos.
- SQL siempre parametrizado con `?`. Los nombres de columna solo pueden salir de listas fijas del código.
- Respuestas de la API: `{ success, data?, error?, message? }`. Los errores de validación del panel suman `campo` (el nombre del campo que falló).
- **Compatibilidad hacia atrás:**
  - los tokens sin `v` (emitidos antes del despliegue) siguen siendo válidos;
  - las respuestas existentes solo suman campos, no cambian ni quitan;
  - el rol `admin` hace exactamente lo mismo que hoy;
  - los mensajes de error existentes no cambian.
- **El repositorio es público:** ningún nombre de persona, email personal, contraseña ni el contenido de `database/privado/` en archivos versionados. Los tests usan datos inventados con dominio `@rpad.test`. `database/privado/usuarios-superadmin-datos.sql` ya existe (se creó al planificar, está en `.gitignore`): no se edita ni se versiona.
- **Antes de correr cualquier test:** `grep -E '^(SMTP_HOST|SMTP_PORT|RPAD_TESTS_DB_LOCAL|DB_HOST)=' .env` tiene que mostrar `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`, `RPAD_TESTS_DB_LOCAL=1` y `DB_HOST=127.0.0.1`. Si no, no se corre nada: la base local es una copia de producción con emails reales.
- **Acceso a la base local de Docker** (en bash, desde la raíz del repo):
  ```bash
  RP=$(grep '^DB_ROOT_PASSWORD=' .env | cut -d= -f2); DBN=$(grep '^DB_NAME=' .env | cut -d= -f2)
  mdb() { docker exec -i -e MYSQL_PWD="$RP" rpad-db mariadb -uroot --default-character-set=utf8mb4 "$@"; }
  ```
- **Deploy sin terminal** (cPanel de WNPower):
  - el SQL se corre en phpMyAdmin (pestaña SQL o Importar);
  - los archivos se suben con el Administrador de archivos;
  - las variables de entorno y el Restart se hacen en Setup Node.js App.

  **No se agregan dependencias de npm.** Todo SQL nuevo tiene que poder pegarse tal cual en phpMyAdmin: sin `DELIMITER` y sin `USE`.
- **Orden de deploy (spec 15):** migración de estructura → subir código → Restart → SQL privado de datos. El SQL privado no puede ir antes del código nuevo: el código actual no conoce el rol `superadmin`.
- **Frontend:**
  - vanilla JS;
  - todo dato pasa por `Utils.escapeHtml`;
  - sin `onclick` inline con datos de usuarios: se usa delegación de eventos con `data-*`;
  - cada script compartido que cambia (`auth.js`, `main.js`, `api.js`, `perfil.js`) se carga con `?v=20261016` en **todas** las páginas que lo usan (lo verifica `tests/paginas.test.js`).
- **Vigencias y límites:**
  - invitación **72 h**, recuperación **2 h**;
  - `/auth/recuperar`: 5 por hora por IP y 3 por hora por identificador;
  - `/auth/link/validar` y `/auth/establecer-contrasena`: 20 cada 15 minutos por IP, compartido entre las dos rutas.
- **Textos exactos:**
  - Respuesta de "olvidé": `Si los datos corresponden a una cuenta activa, te enviamos un email con un link. Revisá también la carpeta de spam.`
  - Cuenta protegida: `Esta cuenta solo la modifica su titular.`
  - Mínimo de aprobadores: `No se puede: quedarían menos de 2 usuarios que puedan aprobar cambios.`
  - Contraseña guardada: `Tu contraseña quedó guardada. Ya podés ingresar.`
  - Links: `El link venció. Pedí uno nuevo.` / `Este link ya se usó. Si necesitás otro, pedilo de nuevo.` / `El link no es válido. Pedí uno nuevo.`
  - Asuntos de los emails: `Tu acceso al RPAD`, `Restablecé tu contraseña del RPAD`, `RPAD: cambio en los usuarios`.
  - Contrato: `Cumple funciones de {cargo} (sin designación formal)`.
- **Commits:** mensajes en español con el estilo del repo (`feat:`, `fix:`, `test:`, `docs:`), terminados con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Cada `git add` nombra archivos concretos: nunca `git add -A` ni `git add .`.

## Review Focus

1. **Navegador con `auth.js` viejo en caché.** El superadmin vería un menú de lector y redirecciones raras. Se espera que todas las páginas carguen las versiones nuevas. → `tests/paginas.test.js` en la Task 5.
2. **Sesión abierta durante el deploy.** El token del superadmin no tiene `v` y dice `rol: 'admin'`, pero la base dice `superadmin`. Se espera que siga entrando como administrador sin volver a loguearse y que `/auth/verify` le devuelva `superadmin`. → test en la Task 2.
3. **Usuario existente con email vacío o con mayúsculas.** Editarlo desde el panel sin cargarle un email válido tiene que responder 400 en el campo email, nunca 500 ni 409 por el `''` repetido. Editar solo otro campo por API tiene que funcionar. → tests en la Task 4.
4. **Doble clic o dos pestañas usando el mismo link.** Solo un pedido guarda la contraseña; el otro responde "ya se usó". → test de concurrencia en la Task 3.
5. **Nombres con tildes o ñ.** La sugerencia de usuario los quita ("Juan Peña" → `JPENA`); un usuario escrito a mano con ñ se rechaza con un mensaje claro, no se guarda. → tests en las Tasks 2 y 5.

---

## Mapa de archivos

| Archivo | Tarea | Responsabilidad |
|---|---|---|
| `database/updates/migracion-usuarios-superadmin.sql` | 1 | Estructura nueva (aditiva) |
| `database/updates/rollback-usuarios-superadmin.sql` | 1 | Deshacer la migración |
| `database/schema.sql` | 1 | Misma estructura para instalaciones nuevas |
| `services/usuariosReglas.js` | 2 | Reglas puras: roles, estados, validaciones, mínimo de aprobadores |
| `services/usuariosAuditoriaService.js` | 2 | Escribir y leer el historial |
| `middleware/auth.js` | 2 | Sesión validada contra la base; `adminOnly` con `esAdmin` |
| `controllers/authController.js` | 2, 3 | Login, perfil, contraseña, endpoints públicos de links |
| `controllers/notificacionesController.js` | 2 | El superadmin recibe el email de las 13:00 |
| `scripts/setup-admin.js` | 2 | Acepta superadmin y valida |
| `services/accesoService.js` | 3 | Links de acceso y sus emails |
| `services/emailTemplates.js` | 3, 4 | `RPAD_URL` desde `APP_URL`; plantillas nuevas |
| `middleware/rateLimit.js` | 3 | Límites de los endpoints públicos nuevos |
| `controllers/usuariosController.js` | 4 | API del panel |
| `routes/index.js` | 3, 4 | Rutas nuevas |
| `public/js/auth.js`, `main.js`, `api.js`, `perfil.js`, `perfil.html`, sidebar de 12 páginas | 5 | Frontend compartido |
| `public/usuarios.html`, `public/js/usuarios.js` | 6 | Pantalla del panel |
| `public/establecer-contrasena.html`, `public/js/establecer-contrasena.js`, `public/login.html` | 7 | Elegir contraseña / pedir link |
| `CLAUDE.md`, `README.md`, `.env.example` | 3, 8 | Documentación y deploy |

---

## Task 0: Preparación y línea de base

Esta tarea no cambia código. Deja el entorno listo y registra cómo está la suite **antes** de tocar nada.

**Files:** ninguno versionado.

- [ ] **Step 1: Crear la rama**

```bash
git switch main && git pull --ff-only && git switch -c feat/usuarios-superadmin
```

- [ ] **Step 2: Instalar dependencias** (no hay `node_modules` en este checkout)

```bash
npm ci
```

Expected: termina sin errores. No modifica `package-lock.json` (`git status` limpio).

- [ ] **Step 3: Preparar el `.env` local** (no versionado). Descomentar `RPAD_TESTS_DB_LOCAL=1` y agregar `APP_URL`:

```bash
sed -i 's/^# RPAD_TESTS_DB_LOCAL=1/RPAD_TESTS_DB_LOCAL=1/' .env
grep -q '^APP_URL=' .env || printf '\n# Links de los emails de acceso (local)\nAPP_URL=http://localhost:3001\n' >> .env
grep -E '^(SMTP_HOST|SMTP_PORT|RPAD_TESTS_DB_LOCAL|DB_HOST|APP_URL)=' .env
```

Expected:
```
DB_HOST=127.0.0.1
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
RPAD_TESTS_DB_LOCAL=1
APP_URL=http://localhost:3001
```

- [ ] **Step 4: Base y Mailpit arriba**

```bash
docker compose up -d && docker inspect -f '{{.State.Health.Status}}' rpad-db && curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8025/api/v1/info
```

Expected: `healthy` y `200`.

- [ ] **Step 5: Línea de base de la suite completa**

```bash
mkdir -p .claude && npm test 2>&1 | tee .claude/linea-de-base.txt | tail -12
```

Expected: el resumen final (`# pass N`, `# fail M`). Anotar N y M. Si `M > 0`, listar los tests que fallan (`grep -E '^not ok|# Subtest' .claude/linea-de-base.txt | grep -B1 'not ok'`) y **avisar al usuario antes de seguir**: son fallas previas, no se arreglan en este plan. En adelante, "comparar con la línea de base" significa que el conjunto de tests que fallan no crece.

Sin commit.

---

## Task 1: Migración, rollback y `schema.sql`

**Files:**
- Create: `database/updates/migracion-usuarios-superadmin.sql`
- Create: `database/updates/rollback-usuarios-superadmin.sql`
- Modify: `database/schema.sql` (cabecera, tabla `usuarios`, sección nueva al final)
- Modify: `tests/schema.test.js`
- Modify: `.gitignore` (ya tiene `database/privado/` desde la planificación: verificar)

**Interfaces:**
- Produces: columnas `usuarios.cargo`, `vinculo`, `ultimo_ingreso`, `sesion_version`; `usuarios.password_hash` admite NULL; `usuarios.rol` admite `superadmin`; tablas `usuarios_tokens` y `usuarios_auditoria`, con las columnas de la spec 6.2.

- [ ] **Step 1: Tests que fallan** en `tests/schema.test.js`.

Agregar este test dentro de `describe('database/schema.sql', …)`, después de `'crea un usuario nuevo con rol lector por defecto'`:

```js
  it('usuarios admite el rol superadmin, contraseña nula, cargo, vínculo, último ingreso y versión de sesión', async () => {
    const lista = (await columnas(root, BASE_TEMPORAL)).filter(c => c.startsWith('usuarios.'));
    for (const esperada of [
      "usuarios.rol enum('superadmin','admin','lector') null=NO default='lector' key=",
      'usuarios.password_hash varchar(255) null=YES default=NULL key=',
      'usuarios.cargo varchar(200) null=YES default=NULL key=',
      "usuarios.vinculo enum('planta_permanente','planta_politica','contrato') null=YES default=NULL key=",
      'usuarios.ultimo_ingreso timestamp null=YES default=NULL key=',
      'usuarios.sesion_version int(11) null=NO default=0 key='
    ]) {
      assert.ok(lista.includes(esperada), `falta: ${esperada}\n${lista.join('\n')}`);
    }
  });

  it('las tablas de links de acceso y de auditoría guardan solo el hash del token y el detalle como JSON', async () => {
    const lista = await columnas(root, BASE_TEMPORAL);
    assert.ok(lista.includes('usuarios_tokens.token_hash char(64) null=NO default=NULL key=UNI'), lista.join('\n'));
    assert.ok(lista.includes("usuarios_tokens.tipo enum('invitacion','recuperacion') null=NO default=NULL key="), lista.join('\n'));
    assert.ok(lista.some(c => c.startsWith('usuarios_auditoria.detalle longtext null=YES')), lista.join('\n'));
  });
```

Y agregar `'usuarios_tokens', 'usuarios_auditoria'` al final del arreglo del test `no trae datos en ${tabla}`:

```js
  for (const tabla of ['usuarios', 'areas', 'datasets', 'cambios_pendientes', 'notificaciones_log', 'historial_actualizaciones', 'proyectos', 'metricas_manuales', 'notas_digitales', 'notas_digitales_datasets', 'usuarios_tokens', 'usuarios_auditoria']) {
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/schema.test.js`
Expected: FAIL en los dos tests nuevos y en `no trae datos en usuarios_tokens` (la tabla no existe).

- [ ] **Step 3: Escribir la migración** `database/updates/migracion-usuarios-superadmin.sql`

```sql
-- =====================================================
-- RPAD - Usuarios: rol superadmin, cargo, vínculo, links de acceso y auditoría
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-15-usuarios-superadmin-design.md (sección 6)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura.
-- ORDEN: correr ANTES de subir el código nuevo (phpMyAdmin > base del RPAD > pestaña SQL, pegar y Continuar).
-- Después de subir el código y reiniciar, correr UNA SOLA VEZ la carga no versionada
-- database/privado/usuarios-superadmin-datos.sql (rol superadmin, cargos y vínculos).
-- No se puede correr dos veces: la segunda falla con "Duplicate column name" y no cambia nada.
-- Para deshacer: rollback-usuarios-superadmin.sql
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `usuarios`
  MODIFY COLUMN `password_hash` varchar(255) DEFAULT NULL,
  MODIFY COLUMN `rol` enum('superadmin','admin','lector') NOT NULL DEFAULT 'lector',
  ADD COLUMN `cargo` varchar(200) DEFAULT NULL AFTER `rol`,
  ADD COLUMN `vinculo` enum('planta_permanente','planta_politica','contrato') DEFAULT NULL AFTER `cargo`,
  ADD COLUMN `ultimo_ingreso` timestamp NULL DEFAULT NULL AFTER `activo`,
  ADD COLUMN `sesion_version` int(11) NOT NULL DEFAULT 0 AFTER `ultimo_ingreso`;

CREATE TABLE `usuarios_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `tipo` enum('invitacion','recuperacion') NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expira_at` datetime NOT NULL,
  `usado_at` datetime DEFAULT NULL,
  `anulado_at` datetime DEFAULT NULL,
  `creado_por` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_usuarios_tokens_hash` (`token_hash`),
  KEY `idx_usuarios_tokens_usuario` (`usuario_id`,`tipo`),
  KEY `fk_usuarios_tokens_creado_por` (`creado_por`),
  CONSTRAINT `fk_usuarios_tokens_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_usuarios_tokens_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `usuarios_auditoria` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `actor_id` int(11) DEFAULT NULL,
  `accion` enum('alta','edicion','cambio_rol','desactivacion','reactivacion','invitacion_enviada','recuperacion_enviada','contrasena_establecida','contrasena_cambiada','perfil_editado') NOT NULL,
  `detalle` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`detalle`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_usuarios_auditoria_usuario` (`usuario_id`,`created_at`),
  KEY `fk_usuarios_auditoria_actor` (`actor_id`),
  CONSTRAINT `fk_usuarios_auditoria_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_usuarios_auditoria_actor` FOREIGN KEY (`actor_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 4: Escribir el rollback** `database/updates/rollback-usuarios-superadmin.sql`

```sql
-- =====================================================
-- RPAD - Deshace migracion-usuarios-superadmin.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Se pierden el historial de usuarios, los links de acceso, los cargos y los vínculos.
-- Los usuarios con invitación pendiente quedan desactivados (no tienen contraseña).
-- =====================================================

SET NAMES utf8mb4;

UPDATE usuarios SET rol = 'admin' WHERE rol = 'superadmin';
UPDATE usuarios SET password_hash = '!sin-contrasena', activo = 0 WHERE password_hash IS NULL;

DROP TABLE IF EXISTS `usuarios_tokens`;
DROP TABLE IF EXISTS `usuarios_auditoria`;

ALTER TABLE `usuarios`
  DROP COLUMN `sesion_version`,
  DROP COLUMN `ultimo_ingreso`,
  DROP COLUMN `vinculo`,
  DROP COLUMN `cargo`,
  MODIFY COLUMN `rol` enum('admin','lector') NOT NULL DEFAULT 'lector',
  MODIFY COLUMN `password_hash` varchar(255) NOT NULL;
```

- [ ] **Step 5: Actualizar `database/schema.sql`**

(a) En la cabecera, reemplazar la línea `-- Incluye las 16 tablas, índices y claves foráneas, y los catálogos` por:

```sql
-- Incluye todas las tablas, índices y claves foráneas, y los catálogos
```

(b) Reemplazar la definición de `usuarios` (hoy en `database/schema.sql:305-318`) por:

```sql
CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `nombre_completo` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `rol` enum('superadmin','admin','lector') NOT NULL DEFAULT 'lector',
  `cargo` varchar(200) DEFAULT NULL,
  `vinculo` enum('planta_permanente','planta_politica','contrato') DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `ultimo_ingreso` timestamp NULL DEFAULT NULL,
  `sesion_version` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

(c) Al final del archivo, agregar las dos tablas nuevas. Son los dos `CREATE TABLE` del Step 3, **idénticos**, con este encabezado:

```sql

-- =====================================================
-- Usuarios: links de acceso y auditoría (database/updates/migracion-usuarios-superadmin.sql)
-- =====================================================
```

- [ ] **Step 6: Aplicar la migración a la base local** (copia de producción) y verificar que **no cambia ningún usuario**

```bash
RP=$(grep '^DB_ROOT_PASSWORD=' .env | cut -d= -f2); DBN=$(grep '^DB_NAME=' .env | cut -d= -f2)
mdb() { docker exec -i -e MYSQL_PWD="$RP" rpad-db mariadb -uroot --default-character-set=utf8mb4 "$@"; }
FOTO="SELECT id, username, rol, activo, email, password_hash FROM usuarios ORDER BY id"
mdb "$DBN" -e "$FOTO" > .claude/usuarios-antes.txt
mdb "$DBN" < database/updates/migracion-usuarios-superadmin.sql
mdb "$DBN" -e "$FOTO" > .claude/usuarios-despues.txt
diff .claude/usuarios-antes.txt .claude/usuarios-despues.txt && echo "USUARIOS SIN CAMBIOS"
```

Expected: `USUARIOS SIN CAMBIOS`. El rol de cada usuario se conserva después de cambiar el ENUM.

- [ ] **Step 7: Verificar que el rollback deja exactamente la estructura anterior** (en una base descartable)

```bash
RP=$(grep '^DB_ROOT_PASSWORD=' .env | cut -d= -f2)
mdb() { docker exec -i -e MYSQL_PWD="$RP" rpad-db mariadb -uroot --default-character-set=utf8mb4 "$@"; }
COLS="SELECT CONCAT_WS(' ', TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, IFNULL(COLUMN_DEFAULT,'-'), COLUMN_KEY) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='rpad_test_rollback' ORDER BY TABLE_NAME, ORDINAL_POSITION"
mdb -e "DROP DATABASE IF EXISTS rpad_test_rollback; CREATE DATABASE rpad_test_rollback CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
git show main:database/schema.sql | mdb rpad_test_rollback
mdb -N -e "$COLS" > .claude/estructura-anterior.txt
mdb rpad_test_rollback < database/updates/migracion-usuarios-superadmin.sql
mdb rpad_test_rollback < database/updates/rollback-usuarios-superadmin.sql
mdb -N -e "$COLS" > .claude/estructura-revertida.txt
diff .claude/estructura-anterior.txt .claude/estructura-revertida.txt && echo "ROLLBACK EXACTO"
mdb -e "DROP DATABASE rpad_test_rollback"
```

Expected: `ROLLBACK EXACTO`.

- [ ] **Step 8: Correr el test de schema**

Run: `node --test tests/schema.test.js`
Expected: PASS en todos (incluido `crea las mismas tablas y columnas que la base actual`, que compara `schema.sql` con la base local ya migrada).

- [ ] **Step 9: Suite completa con el código anterior sobre la estructura nueva**

Run: `npm test 2>&1 | tee .claude/task1.txt | tail -12`
Expected: el mismo resultado que la línea de base, más los tests nuevos de schema en verde. **Esto prueba que en producción la migración se puede correr antes de subir el código.**

- [ ] **Step 10: Commit**

```bash
git add database/updates/migracion-usuarios-superadmin.sql database/updates/rollback-usuarios-superadmin.sql database/schema.sql tests/schema.test.js
git commit -m "feat: migración de usuarios (superadmin, cargo, vínculo, links de acceso y auditoría) con rollback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Roles y sesiones en el backend

**Files:**
- Create: `services/usuariosReglas.js`
- Create: `services/usuariosAuditoriaService.js`
- Modify: `middleware/auth.js` (archivo completo abajo)
- Modify: `controllers/authController.js` (`login`, `verifySession`, `changePassword`, `updateProfile`, `getProfile`)
- Modify: `controllers/notificacionesController.js:143-150` (`getAdminsConEmail`)
- Modify: `scripts/setup-admin.js`
- Modify: `tests/helpers.js` (`crearUsuariosPrueba`, `limpiarDatosPrueba`)
- Create: `tests/usuarios-reglas.test.js`, `tests/sesiones.test.js`
- Modify: `tests/permisos.test.js`, `tests/notificaciones.test.js`, `tests/doble-verificacion.test.js`

**Interfaces:**
- Produces (`services/usuariosReglas.js`):
  - `ROLES_ASIGNABLES: ['admin','lector']`, `VINCULOS`, `MINIMO_APROBADORES = 2`;
  - `TEXTO_ROL: { superadmin: 'Superadmin', admin: 'Administrador', lector: 'Lector' }`;
  - `esAdmin(rol) → boolean`;
  - `estadoDeUsuario({ activo, tiene_contrasena }) → 'activo'|'invitacion_pendiente'|'desactivado'`;
  - `esAprobadorActivo({ rol, activo, tiene_contrasena }) → boolean`;
  - `violaMinimoAprobadores(usuarios, id, cambio) → boolean`;
  - `emailValido(email) → boolean`;
  - `validarContrasena(password) → string|null`;
  - `validarDatosUsuario(entrada, { parcial }) → { errores: [{ campo, error }], datos }`;
  - `camposCambiados(antes, nuevos, campos) → { campo: { antes, despues } }`.
- Produces (`services/usuariosAuditoriaService.js`):
  - `registrarAuditoria(conexion, { usuarioId, actorId, accion, detalle }) → Promise<void>`;
  - `historialDe(usuarioId) → Promise<Array<{ id, accion, detalle, created_at, actor_id, actor_nombre, actor_username }>>`.
- Produces (sesión):
  - payload del JWT `{ userId, username, rol, v }`;
  - `req.user = { ...payload, rol: <rol de la base> }`;
  - `POST /auth/change-password` responde además `data: { token }`;
  - `/auth/login`, `/auth/verify` y `/auth/profile` devuelven además `cargo` y `vinculo`.
- Produces (tests): `crearUsuariosPrueba(cliente, definiciones?)`. Por defecto crea `{ adminA: 'admin', adminB: 'admin', lector: 'lector', superadmin: 'superadmin' }`.

- [ ] **Step 1: Tests puros que fallan** — crear `tests/usuarios-reglas.test.js`

```js
// Reglas de usuarios y roles (services/usuariosReglas.js): funciones puras, sin base
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  esAdmin, estadoDeUsuario, esAprobadorActivo, violaMinimoAprobadores, emailValido,
  validarContrasena, validarDatosUsuario, camposCambiados, TEXTO_ROL
} from '../services/usuariosReglas.js';

const u = (id, rol, activo = 1, tieneContrasena = 1) => ({ id, rol, activo, tiene_contrasena: tieneContrasena });

describe('roles', () => {
  it('superadmin y admin son administradores; lector y nada, no', () => {
    assert.equal(esAdmin('superadmin'), true);
    assert.equal(esAdmin('admin'), true);
    assert.equal(esAdmin('lector'), false);
    assert.equal(esAdmin(undefined), false);
  });

  it('textos de los roles', () => {
    assert.deepEqual(TEXTO_ROL, { superadmin: 'Superadmin', admin: 'Administrador', lector: 'Lector' });
  });
});

describe('estado del usuario', () => {
  it('desactivado, invitación pendiente o activo', () => {
    assert.equal(estadoDeUsuario({ activo: 0, tiene_contrasena: 1 }), 'desactivado');
    assert.equal(estadoDeUsuario({ activo: 0, tiene_contrasena: 0 }), 'desactivado');
    assert.equal(estadoDeUsuario({ activo: 1, tiene_contrasena: 0 }), 'invitacion_pendiente');
    assert.equal(estadoDeUsuario({ activo: 1, tiene_contrasena: 1 }), 'activo');
  });

  it('aprobador activo: admin o superadmin, activo y con contraseña', () => {
    assert.equal(esAprobadorActivo(u(1, 'superadmin')), true);
    assert.equal(esAprobadorActivo(u(1, 'admin')), true);
    assert.equal(esAprobadorActivo(u(1, 'lector')), false);
    assert.equal(esAprobadorActivo(u(1, 'admin', 0)), false);
    assert.equal(esAprobadorActivo(u(1, 'admin', 1, 0)), false);
  });
});

describe('mínimo de 2 aprobadores', () => {
  const dos = [u(1, 'superadmin'), u(2, 'admin'), u(3, 'lector')];

  it('con 2 aprobadores no se puede desactivar ni degradar a ninguno', () => {
    assert.equal(violaMinimoAprobadores(dos, 2, { activo: 0 }), true);
    assert.equal(violaMinimoAprobadores(dos, 2, { rol: 'lector' }), true);
    assert.equal(violaMinimoAprobadores(dos, 1, { activo: 0 }), true);
  });

  it('desactivar a un lector nunca viola la regla', () => {
    assert.equal(violaMinimoAprobadores(dos, 3, { activo: 0 }), false);
  });

  it('con 3 aprobadores se puede sacar a uno', () => {
    assert.equal(violaMinimoAprobadores([...dos, u(4, 'admin')], 2, { activo: 0 }), false);
  });

  it('un admin con la invitación pendiente no cuenta', () => {
    assert.equal(violaMinimoAprobadores([...dos, u(4, 'admin', 1, 0)], 2, { activo: 0 }), true);
  });

  it('si ya había menos de 2, una operación que no saca aprobadores sigue permitida', () => {
    const uno = [u(1, 'admin'), u(3, 'lector')];
    assert.equal(violaMinimoAprobadores(uno, 3, { activo: 0 }), false);
    assert.equal(violaMinimoAprobadores(uno, 3, { rol: 'admin' }), false);
  });

  it('un id que no está en la lista no viola nada', () => {
    assert.equal(violaMinimoAprobadores(dos, 99, { activo: 0 }), false);
  });
});

describe('validaciones', () => {
  it('email', () => {
    assert.equal(emailValido('persona@rpad.test'), true);
    for (const malo of ['', 'sin-arroba', 'a@b', 'con espacio@rpad.test', null, `${'x'.repeat(95)}@rpad.test`]) {
      assert.equal(emailValido(malo), false, String(malo));
    }
  });

  it('contraseña: mínimo 8 caracteres y máximo 72 bytes', () => {
    assert.equal(validarContrasena('corta'), 'La contraseña debe tener al menos 8 caracteres');
    assert.equal(validarContrasena(undefined), 'La contraseña debe tener al menos 8 caracteres');
    assert.equal(validarContrasena('a'.repeat(72)), null);
    assert.match(validarContrasena('ñ'.repeat(37)), /72 bytes/);
  });

  it('datos completos válidos se normalizan', () => {
    const { errores, datos } = validarDatosUsuario({
      nombre_completo: '  Laura Inés Fernández ', username: ' lifernandez ', email: ' LIF@RPAD.test ',
      rol: 'lector', cargo: '  ', vinculo: ''
    });
    assert.deepEqual(errores, []);
    assert.deepEqual(datos, {
      nombre_completo: 'Laura Inés Fernández', username: 'LIFERNANDEZ', email: 'lif@rpad.test',
      cargo: null, vinculo: null, rol: 'lector'
    });
  });

  it('cada dato inválido indica su campo', () => {
    const base = { nombre_completo: 'Persona', username: 'PERSONA', email: 'p@rpad.test', rol: 'lector' };
    for (const [cambio, campo] of [
      [{ nombre_completo: '' }, 'nombre_completo'],
      [{ nombre_completo: 'x'.repeat(101) }, 'nombre_completo'],
      [{ username: 'ab' }, 'username'],
      [{ username: 'con espacio' }, 'username'],
      [{ username: 'PEÑA' }, 'username'],
      [{ email: 'no' }, 'email'],
      [{ cargo: 'x'.repeat(201) }, 'cargo'],
      [{ vinculo: 'otro' }, 'vinculo'],
      [{ rol: 'superadmin' }, 'rol'],
      [{ rol: undefined }, 'rol']
    ]) {
      const { errores } = validarDatosUsuario({ ...base, ...cambio });
      assert.deepEqual(errores.map(e => e.campo), [campo], JSON.stringify(cambio));
    }
  });

  it('en la edición parcial solo valida lo que viene', () => {
    assert.deepEqual(validarDatosUsuario({ cargo: 'Nuevo' }, { parcial: true }), { errores: [], datos: { cargo: 'Nuevo' } });
    assert.deepEqual(validarDatosUsuario({ email: '' }, { parcial: true }).errores.map(e => e.campo), ['email']);
  });
});

describe('campos cambiados', () => {
  it('solo los que vienen y cambian, con el valor anterior y el nuevo', () => {
    const antes = { nombre_completo: 'A', email: 'a@rpad.test', cargo: null, vinculo: null };
    assert.deepEqual(camposCambiados(antes, { nombre_completo: 'A', cargo: 'Cargo', vinculo: null }, ['nombre_completo', 'email', 'cargo', 'vinculo']), {
      cargo: { antes: null, despues: 'Cargo' }
    });
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --test tests/usuarios-reglas.test.js`
Expected: FAIL con `Cannot find module '.../services/usuariosReglas.js'`.

- [ ] **Step 3: Implementar** `services/usuariosReglas.js`

```js
// Reglas de usuarios y roles (spec 2026-10-15-usuarios-superadmin): funciones puras, sin base de datos

export const ROLES_ASIGNABLES = ['admin', 'lector'];
export const VINCULOS = ['planta_permanente', 'planta_politica', 'contrato'];
export const MINIMO_APROBADORES = 2;
export const TEXTO_ROL = { superadmin: 'Superadmin', admin: 'Administrador', lector: 'Lector' };

const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATRON_USERNAME = /^[A-Z0-9._-]{3,50}$/;

// superadmin y admin pasan todo lo de administración (spec 5.3)
export const esAdmin = (rol) => rol === 'admin' || rol === 'superadmin';

// Estado derivado (spec 3): no se guarda, sale de activo y de si tiene contraseña
export const estadoDeUsuario = ({ activo, tiene_contrasena }) => {
  if (!activo) return 'desactivado';
  return tiene_contrasena ? 'activo' : 'invitacion_pendiente';
};

// Puede aprobar cambios hoy: aprobador, activo y con contraseña definida (spec 3)
export const esAprobadorActivo = (usuario) =>
  esAdmin(usuario.rol) && Boolean(usuario.activo) && Boolean(usuario.tiene_contrasena);

/**
 * ¿La operación deja menos de MINIMO_APROBADORES? (spec 8.1). Solo bloquea si la operación saca a un
 * aprobador: con un único admin se pueden seguir desactivando lectores.
 * usuarios: [{ id, rol, activo, tiene_contrasena }]; cambio: lo que se aplica al usuario id ({ activo: 0 } o { rol: 'lector' })
 */
export const violaMinimoAprobadores = (usuarios, id, cambio) => {
  const antes = usuarios.filter(esAprobadorActivo).length;
  const despues = usuarios.map(u => (u.id === id ? { ...u, ...cambio } : u)).filter(esAprobadorActivo).length;
  return despues < antes && despues < MINIMO_APROBADORES;
};

export const emailValido = (email) => typeof email === 'string' && email.length <= 100 && PATRON_EMAIL.test(email);

// null si la contraseña sirve; si no, el motivo (spec 7.4: mínimo 8 caracteres, máximo 72 bytes por bcrypt)
export const validarContrasena = (password) => {
  if (typeof password !== 'string' || password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return 'La contraseña es demasiado larga: admite hasta 72 bytes (unos 72 caracteres sin tildes)';
  }
  return null;
};

/**
 * Normaliza y valida los datos del formulario del panel (spec 8.3).
 * parcial: en la edición, los campos que no vienen no se validan ni se tocan.
 * Devuelve { errores: [{ campo, error }], datos } con los valores ya normalizados.
 */
export const validarDatosUsuario = (entrada, { parcial = false } = {}) => {
  const errores = [];
  const datos = {};
  const viene = (campo) => entrada[campo] !== undefined;
  const error = (campo, mensaje) => errores.push({ campo, error: mensaje });

  if (!parcial || viene('nombre_completo')) {
    const nombre = String(entrada.nombre_completo ?? '').trim();
    if (!nombre) error('nombre_completo', 'El nombre completo es obligatorio');
    else if (nombre.length > 100) error('nombre_completo', 'El nombre completo admite hasta 100 caracteres');
    else datos.nombre_completo = nombre;
  }
  if (!parcial || viene('username')) {
    const username = String(entrada.username ?? '').trim().toUpperCase();
    if (!PATRON_USERNAME.test(username)) {
      error('username', 'El usuario debe tener de 3 a 50 caracteres: letras sin tildes ni ñ, números, punto, guion o guion bajo');
    } else datos.username = username;
  }
  if (!parcial || viene('email')) {
    const email = String(entrada.email ?? '').trim().toLowerCase();
    if (!emailValido(email)) error('email', 'Ingresá un email válido');
    else datos.email = email;
  }
  if (viene('cargo')) {
    const cargo = String(entrada.cargo ?? '').trim();
    if (cargo.length > 200) error('cargo', 'El cargo admite hasta 200 caracteres');
    else datos.cargo = cargo || null;
  }
  if (viene('vinculo')) {
    const vinculo = entrada.vinculo === '' || entrada.vinculo === null ? null : entrada.vinculo;
    if (vinculo !== null && !VINCULOS.includes(vinculo)) error('vinculo', 'El vínculo no es válido');
    else datos.vinculo = vinculo;
  }
  if (!parcial || viene('rol')) {
    if (!ROLES_ASIGNABLES.includes(entrada.rol)) error('rol', 'El rol debe ser admin o lector');
    else datos.rol = entrada.rol;
  }
  return { errores, datos };
};

// Campos que vienen y cambian, con el valor anterior y el nuevo (para el historial, spec 9)
export const camposCambiados = (antes, nuevos, campos) => Object.fromEntries(campos
  .filter(campo => nuevos[campo] !== undefined && (antes[campo] ?? null) !== (nuevos[campo] ?? null))
  .map(campo => [campo, { antes: antes[campo] ?? null, despues: nuevos[campo] ?? null }]));
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `node --test tests/usuarios-reglas.test.js`
Expected: PASS.

- [ ] **Step 5: Cambiar `tests/helpers.js`**

(a) Reemplazar la firma y el comentario de `crearUsuariosPrueba`:

```js
// Crea usuarios de prueba con contraseñas aleatorias. Por defecto: admin A, admin B, un lector y un superadmin.
// Devuelve sus datos y tokens.
export const crearUsuariosPrueba = async (
  cliente,
  definiciones = { adminA: 'admin', adminB: 'admin', lector: 'lector', superadmin: 'superadmin' }
) => {
  const sufijo = crypto.randomBytes(4).toString('hex');
  const usuarios = {};
```

(Se borra la línea `const definiciones = { adminA: 'admin', adminB: 'admin', lector: 'lector' };`; el resto del cuerpo queda igual.)

(b) En `limpiarDatosPrueba`, antes de borrar los cambios pendientes:

```js
  if (ids.length > 0) {
    // Historial y links de acceso de los usuarios de prueba (sus FK no borran en cascada)
    await db().query('DELETE FROM usuarios_auditoria WHERE usuario_id IN (?)', [ids]);
    await db().query('DELETE FROM usuarios_tokens WHERE usuario_id IN (?)', [ids]);
    await db().query('DELETE FROM cambios_pendientes WHERE usuario_id IN (?)', [ids]);
    await db().query('DELETE FROM usuarios WHERE id IN (?)', [ids]);
  }
```

- [ ] **Step 6: Tests de sesión que fallan** — crear `tests/sesiones.test.js`

```js
// Sesiones y roles (spec 5): el rol y el estado se leen de la base en cada pedido. Base de prueba propia.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query
} from './helpers.js';

let base, servidor, api, usuarios, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_sesiones');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api);
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

const verificar = (token) => api.get('/auth/verify', { token });
const rutaAdmin = (token) => api.get('/cambios-pendientes/contador', { token });
const tokenSinVersion = (usuario, rol) =>
  jwt.sign({ userId: usuario.id, username: usuario.username, rol }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('rol tomado de la base', () => {
  it('el superadmin pasa las rutas de administrador', async () => {
    assert.equal((await rutaAdmin(usuarios.superadmin.token)).status, 200);
  });

  it('un admin pasado a lector pierde el acceso de admin con el mismo token, pero sigue logueado', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'admin' });
    assert.equal((await rutaAdmin(x.token)).status, 200);
    await query("UPDATE usuarios SET rol = 'lector' WHERE id = ?", [x.id]);
    assert.equal((await rutaAdmin(x.token)).status, 403);
    assert.equal((await api.get('/auth/profile', { token: x.token })).status, 200);
  });

  it('un lector pasado a admin gana el acceso con el mismo token', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    assert.equal((await rutaAdmin(x.token)).status, 403);
    await query("UPDATE usuarios SET rol = 'admin' WHERE id = ?", [x.id]);
    assert.equal((await rutaAdmin(x.token)).status, 200);
  });

  it('una sesión abierta antes del despliegue (token sin versión y rol admin) sigue entrando y ve su rol nuevo', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'superadmin' });
    const viejo = tokenSinVersion(x, 'admin');
    assert.equal((await rutaAdmin(viejo)).status, 200);
    const res = await verificar(viejo);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.rol, 'superadmin');
  });
});

describe('cierre de sesiones', () => {
  it('un usuario desactivado recibe 401 con su token', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [x.id]);
    assert.equal((await verificar(x.token)).status, 401);
  });

  it('si cambia la versión de sesión, el token anterior deja de servir', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await query('UPDATE usuarios SET sesion_version = sesion_version + 1 WHERE id = ?', [x.id]);
    assert.equal((await verificar(x.token)).status, 401);
  });

  it('un token sin userId recibe 401', async () => {
    const raro = jwt.sign({ rol: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    assert.equal((await verificar(raro)).status, 401);
  });

  it('el token del login trae la versión de sesión', () => {
    assert.equal(jwt.decode(usuarios.lector.token).v, 0);
  });
});

describe('login', () => {
  it('devuelve cargo y vínculo y registra el último ingreso sin tocar updated_at', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await query(
      "UPDATE usuarios SET cargo = 'Cargo de prueba', vinculo = 'contrato', ultimo_ingreso = NULL, updated_at = '2026-01-01 00:00:00' WHERE id = ?",
      [x.id]
    );
    const res = await api.post('/auth/login', { username: x.username, password: x.password });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.cargo, 'Cargo de prueba');
    assert.equal(res.body.data.user.vinculo, 'contrato');
    const [fila] = await query(
      "SELECT ultimo_ingreso IS NOT NULL AS con_ingreso, updated_at = '2026-01-01 00:00:00' AS sin_tocar FROM usuarios WHERE id = ?",
      [x.id]
    );
    assert.equal(fila.con_ingreso, 1);
    assert.equal(fila.sin_tocar, 1);
  });

  it('un usuario sin contraseña (invitación pendiente) recibe la misma respuesta que uno inexistente', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await query('UPDATE usuarios SET password_hash = NULL WHERE id = ?', [x.id]);
    const sinContrasena = await api.post('/auth/login', { username: x.username, password: 'cualquier-cosa' });
    const inexistente = await api.post('/auth/login', { username: `no_existe_${x.username}`, password: 'cualquier-cosa' });
    assert.equal(sinContrasena.status, 401);
    assert.deepEqual(sinContrasena.body, inexistente.body);
    assert.deepEqual(sinContrasena.body, { success: false, error: 'Credenciales inválidas' });
  });

  it('verify y profile devuelven cargo y vínculo', async () => {
    await query("UPDATE usuarios SET cargo = 'Cargo X', vinculo = 'planta_permanente' WHERE id = ?", [usuarios.lector.id]);
    for (const ruta of ['/auth/verify', '/auth/profile']) {
      const { user } = (await api.get(ruta, { token: usuarios.lector.token })).body.data;
      assert.equal(user.cargo, 'Cargo X', ruta);
      assert.equal(user.vinculo, 'planta_permanente', ruta);
    }
  });
});

describe('Mi Perfil', () => {
  it('cambiar la contraseña devuelve un token nuevo, invalida el anterior y queda en el historial', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const res = await api.post('/auth/change-password', { currentPassword: x.password, newPassword: 'NuevaClave123' }, { token: x.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Contraseña actualizada correctamente');
    assert.equal((await verificar(x.token)).status, 401);
    assert.equal((await verificar(res.body.data.token)).status, 200);
    const historial = await query('SELECT accion, actor_id FROM usuarios_auditoria WHERE usuario_id = ?', [x.id]);
    assert.deepEqual(historial.map(h => [h.accion, h.actor_id]), [['contrasena_cambiada', x.id]]);
  });

  it('rechaza una contraseña nueva corta (mismo mensaje de siempre) o de más de 72 bytes', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const corta = await api.post('/auth/change-password', { currentPassword: x.password, newPassword: 'corta' }, { token: x.token });
    assert.equal(corta.status, 400);
    assert.equal(corta.body.error, 'La nueva contraseña debe tener al menos 8 caracteres');
    const larga = await api.post('/auth/change-password', { currentPassword: x.password, newPassword: 'ñ'.repeat(40) }, { token: x.token });
    assert.equal(larga.status, 400);
  });

  it('rechaza un email con formato inválido o un nombre de más de 100 caracteres', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    assert.equal((await api.put('/auth/profile', { email: 'no-es-email' }, { token: x.token })).status, 400);
    assert.equal((await api.put('/auth/profile', { nombre_completo: 'x'.repeat(101) }, { token: x.token })).status, 400);
  });

  it('editar nombre y email queda en el historial con los valores anteriores y nuevos', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const res = await api.put('/auth/profile', { nombre_completo: 'Nombre Nuevo', email: `nuevo_${x.email}` }, { token: x.token });
    assert.equal(res.status, 200);
    const [fila] = await query("SELECT detalle FROM usuarios_auditoria WHERE usuario_id = ? AND accion = 'perfil_editado'", [x.id]);
    assert.deepEqual(JSON.parse(fila.detalle).campos, {
      nombre_completo: { antes: 'Test x', despues: 'Nombre Nuevo' },
      email: { antes: x.email, despues: `nuevo_${x.email}` }
    });
  });
});
```

- [ ] **Step 7: Agregar los tests del superadmin en los archivos existentes**

(a) `tests/permisos.test.js`: extraer la lista de GET del `describe('admin')` a una constante y repetirla para el superadmin. Reemplazar el bloque `describe('admin', () => { … });` completo por:

```js
// GET de administración que se pueden llamar sin efectos sobre la base local
const RUTAS_GET_ADMIN = [
  '/cambios-pendientes/contador',
  '/cambios-pendientes/para-revisar',
  '/cambios-pendientes/mis-cambios',
  '/cambios-pendientes/datasets-bloqueados',
  '/notificaciones/verificar-smtp',
  '/notificaciones/preview/area-aviso-40',
  '/notificaciones/notas-digitales',
  '/notificaciones/notas-digitales/estado',
  '/notificaciones/preview-cambios-pendientes'
];

for (const clave of ['adminA', 'superadmin']) {
  describe(clave === 'adminA' ? 'admin' : 'superadmin', () => {
    for (const ruta of RUTAS_GET_ADMIN) {
      it(`puede usar GET ${ruta}`, async () => {
        const res = await api.get(ruta, { token: usuarios[clave].token });
        assert.equal(res.status, 200);
      });
    }
  });
}
```

(b) `tests/notificaciones.test.js`: en el test `'le llega al otro admin con el cambio propuesto, y no al que lo propuso'`, antes de `assert.equal(para(usuarios.lector.email).length, 0, …)`, agregar:

```js
    const paraSuperadmin = para(usuarios.superadmin.email);
    assert.equal(paraSuperadmin.length, 1, 'el superadmin también recibe el resumen');
    assert.match(await mailpit.html(paraSuperadmin[0].ID), /aviso de cambio pendiente/);
```

(c) `tests/doble-verificacion.test.js`: dentro de `describe('alta de dataset', …)`, después de `'el mismo admin que propone no puede rechazar'`, agregar:

```js
  it('el superadmin tampoco puede aprobar ni rechazar sus propios cambios', async () => {
    const alta = await api.post('/datasets', datosAlta('autoaprobación del superadmin'), { token: usuarios.superadmin.token });
    assert.equal(alta.status, 201);
    assert.equal((await aprobar(alta.body.data.cambio_pendiente_id, usuarios.superadmin)).status, 403);
    assert.equal((await rechazar(alta.body.data.cambio_pendiente_id, usuarios.superadmin)).status, 403);
  });

  it('el superadmin aprueba el cambio de otro admin', async () => {
    const alta = await api.post('/datasets', datosAlta('aprobada por el superadmin'), { token: usuarios.adminA.token });
    assert.equal((await aprobar(alta.body.data.cambio_pendiente_id, usuarios.superadmin)).status, 200);
  });
```

- [ ] **Step 8: Correr y ver que fallan**

Run: `node --test tests/sesiones.test.js tests/permisos.test.js tests/notificaciones.test.js tests/doble-verificacion.test.js`
Expected: FAIL. Por ejemplo, en el superadmin con 403 en rutas de admin, en `cargo` undefined, en el token viejo que no ve `superadmin` y en `data.token` undefined.

- [ ] **Step 9: Implementar** `services/usuariosAuditoriaService.js`

```js
// Historial de cambios sobre usuarios (spec 9)
import pool from '../config/database.js';

/**
 * Registra una acción. conexion: el pool o la conexión con la transacción del cambio abierta.
 * detalle: objeto (se guarda como JSON) o null.
 */
export const registrarAuditoria = async (conexion, { usuarioId, actorId = null, accion, detalle = null }) => {
  await (conexion ?? pool).execute(
    'INSERT INTO usuarios_auditoria (usuario_id, actor_id, accion, detalle) VALUES (?, ?, ?, ?)',
    [usuarioId, actorId, accion, detalle === null ? null : JSON.stringify(detalle)]
  );
};

// Historial de un usuario, del más reciente al más viejo, con el nombre de quien hizo cada cambio
export const historialDe = async (usuarioId) => {
  const [filas] = await pool.execute(
    `SELECT a.id, a.accion, a.detalle, a.created_at, a.actor_id,
            ac.nombre_completo AS actor_nombre, ac.username AS actor_username
     FROM usuarios_auditoria a
     LEFT JOIN usuarios ac ON ac.id = a.actor_id
     WHERE a.usuario_id = ?
     ORDER BY a.created_at DESC, a.id DESC`,
    [usuarioId]
  );
  return filas.map(f => ({ ...f, detalle: typeof f.detalle === 'string' ? JSON.parse(f.detalle) : f.detalle }));
};
```

- [ ] **Step 10: Reemplazar `middleware/auth.js` completo**

```js
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/database.js';
import { esAdmin } from '../services/usuariosReglas.js';

// Sin JWT_SECRET cualquiera podría firmar tokens válidos: no se permite iniciar
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ Falta la variable de entorno JWT_SECRET. El servidor no puede iniciar.');
  process.exit(1);
}

export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7h' });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

// Middleware para rutas protegidas. Además de verificar el token, lee de la base el rol, si el usuario
// sigue activo y su versión de sesión: desactivar o cambiar el rol tiene efecto en el pedido siguiente (spec 5.1)
export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Token de autenticación no proporcionado'
    });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload || !Number.isInteger(payload.userId)) {
    return res.status(401).json({
      success: false,
      error: 'Token inválido o expirado'
    });
  }

  let usuario;
  try {
    const [filas] = await pool.execute('SELECT rol, activo, sesion_version FROM usuarios WHERE id = ?', [payload.userId]);
    usuario = filas[0];
  } catch (error) {
    console.error('Error verificando la sesión:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }

  // Un token sin versión (emitido antes de que existiera sesion_version) cuenta como versión 0
  if (!usuario || !usuario.activo || (payload.v ?? 0) !== usuario.sesion_version) {
    return res.status(401).json({
      success: false,
      error: 'La sesión ya no es válida. Iniciá sesión nuevamente.'
    });
  }

  req.user = { ...payload, rol: usuario.rol };
  next();
};

// Middleware para rutas de administración: admin y superadmin
export const adminOnly = (req, res, next) => {
  if (!esAdmin(req.user?.rol)) {
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado. Se requiere rol de administrador.'
    });
  }
  next();
};

// Middleware para el cron externo: clave en header x-cron-secret o query ?secret=
// Si CRON_SECRET no está configurado se rechaza todo (antes undefined === undefined dejaba pasar)
export const cronAuth = (req, res, next) => {
  const esperado = process.env.CRON_SECRET;
  const recibido = req.headers['x-cron-secret'] || req.query.secret;

  let valido = false;
  if (esperado && typeof recibido === 'string') {
    const a = Buffer.from(recibido);
    const b = Buffer.from(esperado);
    valido = a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  if (!valido) {
    return res.status(403).json({ success: false, error: 'Acceso denegado' });
  }
  next();
};
```

- [ ] **Step 11: Cambiar `controllers/authController.js`**

(a) Imports al principio del archivo:

```js
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pool from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import { registrarAuditoria } from '../services/usuariosAuditoriaService.js';
import { validarContrasena, emailValido, camposCambiados } from '../services/usuariosReglas.js';

// Hash de referencia: si el usuario no existe o no tiene contraseña, igual se compara contra este hash,
// para que el tiempo de respuesta no revele si la cuenta existe (spec 5.4)
const HASH_DE_REFERENCIA = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);
```

(b) En `login`, reemplazar desde `const usuario = rows[0];` hasta el `res.json({ … })` inclusive por:

```js
    const usuario = rows[0];

    // Siempre se compara, aunque el usuario no exista o tenga la invitación pendiente (password_hash NULL)
    const passwordValid = await bcrypt.compare(String(password), usuario?.password_hash || HASH_DE_REFERENCIA);

    if (!usuario || !usuario.password_hash || !passwordValid) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // updated_at = updated_at: registrar el ingreso no cuenta como modificación del usuario
    await pool.execute(
      'UPDATE usuarios SET ultimo_ingreso = CURRENT_TIMESTAMP, updated_at = updated_at WHERE id = ?',
      [usuario.id]
    );

    // Generar token (v: versión de sesión, spec 5.2)
    const token = generateToken({
      userId: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
      v: usuario.sesion_version
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: usuario.id,
          username: usuario.username,
          nombre_completo: usuario.nombre_completo,
          email: usuario.email,
          rol: usuario.rol,
          cargo: usuario.cargo,
          vinculo: usuario.vinculo
        }
      }
    });
```

(Se borran los dos bloques anteriores: `if (rows.length === 0) {…}` y `const passwordValid = …; if (!passwordValid) {…}`.)

(c) En `verifySession` y en `getProfile`, agregar `cargo, vinculo` al SELECT:

```js
      'SELECT id, username, nombre_completo, email, rol, cargo, vinculo FROM usuarios WHERE id = ? AND activo = TRUE',
```

```js
      'SELECT id, username, nombre_completo, email, rol, cargo, vinculo, created_at FROM usuarios WHERE id = ? AND activo = TRUE',
```

(d) En `changePassword`:
- después del chequeo `if (newPassword.length < 8) {…}`, agregar:

```js
    // Máximo de bcrypt (72 bytes): lo más largo se ignoraría en silencio
    const errorContrasena = validarContrasena(newPassword);
    if (errorContrasena) {
      return res.status(400).json({ success: false, error: errorContrasena });
    }
```

- reemplazar desde `// Verificar contraseña actual` hasta el `res.json({…})` final por:

```js
    // Verificar contraseña actual
    const passwordValid = Boolean(usuario.password_hash) && await bcrypt.compare(currentPassword, usuario.password_hash);

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: 'Contraseña actual incorrecta'
      });
    }

    // Hashear nueva contraseña
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña y cerrar las otras sesiones: cambia la versión y esta sesión recibe un token nuevo (spec 5.2)
    await pool.execute(
      'UPDATE usuarios SET password_hash = ?, sesion_version = sesion_version + 1 WHERE id = ?',
      [newPasswordHash, usuario.id]
    );
    await registrarAuditoria(pool, { usuarioId: usuario.id, actorId: usuario.id, accion: 'contrasena_cambiada' });

    const token = generateToken({
      userId: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
      v: usuario.sesion_version + 1
    });

    res.json({
      success: true,
      message: 'Contraseña actualizada correctamente',
      data: { token }
    });
```

(e) En `updateProfile`:
- después de `if (!nombre_completo && !email) {…}`, agregar:

```js
    if (nombre_completo && String(nombre_completo).trim().length > 100) {
      return res.status(400).json({ success: false, error: 'El nombre completo admite hasta 100 caracteres' });
    }

    if (email && !emailValido(String(email).trim().toLowerCase())) {
      return res.status(400).json({ success: false, error: 'Ingresá un email válido' });
    }
```

- reemplazar desde `// Construir query de actualización` hasta `await pool.execute(\`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?\`, values);` inclusive por:

```js
    // Construir query de actualización
    const updates = [];
    const values = [];
    const nuevos = {};

    if (nombre_completo) {
      updates.push('nombre_completo = ?');
      nuevos.nombre_completo = nombre_completo.trim();
      values.push(nuevos.nombre_completo);
    }

    if (email) {
      updates.push('email = ?');
      nuevos.email = email.trim().toLowerCase();
      values.push(nuevos.email);
    }

    values.push(userId);

    await pool.execute(
      `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Historial: solo lo que efectivamente cambió (spec 9)
    const campos = camposCambiados(userRows[0], nuevos, ['nombre_completo', 'email']);
    if (Object.keys(campos).length > 0) {
      await registrarAuditoria(pool, { usuarioId: userId, actorId: userId, accion: 'perfil_editado', detalle: { campos } });
    }
```

- [ ] **Step 12: Email de las 13:00 también para el superadmin** — `controllers/notificacionesController.js`, en `getAdminsConEmail`:

```js
     WHERE rol IN ('admin', 'superadmin') AND activo = TRUE AND email IS NOT NULL`
```

- [ ] **Step 13: `scripts/setup-admin.js`**

(a) Agregar el import después de `import readline from 'readline';`:

```js
import { emailValido, validarContrasena } from '../services/usuariosReglas.js';
```

(b) Reemplazar las líneas de `rolInput` a `if (password.length < 8) {…}` por:

```js
    const rolInput = await question('Rol (superadmin/admin/lector) [lector]: ');
    const rolElegido = rolInput.trim().toLowerCase();
    const rol = ['superadmin', 'admin', 'lector'].includes(rolElegido) ? rolElegido : 'lector';

    if (!emailValido(email.trim().toLowerCase())) {
      console.error('❌ El email no es válido.');
      process.exit(1);
    }

    const errorContrasena = validarContrasena(password);
    if (errorContrasena) {
      console.error(`❌ ${errorContrasena}.`);
      process.exit(1);
    }
```

(c) En el INSERT, usar `username.trim(), …, email.trim().toLowerCase()`:

```js
      [username.trim(), password_hash, nombre_completo.trim(), email.trim().toLowerCase(), rol]
```

(d) Cambiar el título del recuadro a `Configuración de Usuario - RPAD` y la pregunta `'¿Desea crear otro usuario administrador? (s/n): '` por `'¿Desea crear otro usuario? (s/n): '`.

Verificación: `node --check scripts/setup-admin.js` → sin salida. El script es interactivo y no tiene test automático.

- [ ] **Step 14: Correr los tests de la tarea**

Run: `node --test tests/usuarios-reglas.test.js tests/sesiones.test.js tests/permisos.test.js tests/notificaciones.test.js tests/doble-verificacion.test.js`
Expected: PASS.

- [ ] **Step 15: Suite completa contra la línea de base**

Run: `npm test 2>&1 | tee .claude/task2.txt | tail -12`
Expected: ninguna falla nueva respecto de `.claude/linea-de-base.txt`.

- [ ] **Step 16: Commit**

```bash
git add services/usuariosReglas.js services/usuariosAuditoriaService.js middleware/auth.js controllers/authController.js controllers/notificacionesController.js scripts/setup-admin.js tests/helpers.js tests/usuarios-reglas.test.js tests/sesiones.test.js tests/permisos.test.js tests/notificaciones.test.js tests/doble-verificacion.test.js
git commit -m "feat: rol superadmin y sesiones validadas contra la base (revocación inmediata)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 3: Links de acceso (invitación, recuperación y "¿Olvidaste tu contraseña?")

**Files:**
- Create: `services/accesoService.js`
- Modify: `services/emailTemplates.js` (`RPAD_URL`, `fechaHoraArgentina`, `plantillaSimple`, `invitacionTemplate`, `recuperacionTemplate`)
- Modify: `controllers/authController.js` (`recuperarContrasena`, `validarLinkDeAcceso`, `establecerContrasenaConLink`)
- Modify: `middleware/rateLimit.js`
- Modify: `routes/index.js`
- Modify: `.env.example`
- Modify: `tests/helpers.js` (`mailpit.esperar`, `paraCasilla`, `tokenDelLink`)
- Create: `tests/usuarios-contrasena.test.js`

**Interfaces:**
- Consumes: `registrarAuditoria`, `emailValido`, `validarContrasena`, `TEXTO_ROL` (Task 2).
- Produces (`services/accesoService.js`):
  - `HORAS_VIGENCIA`, `MENSAJE_LINK`, `class ErrorLink { motivo }`, `hashToken(token)`;
  - `generarLink(conexion, { usuarioId, tipo, creadoPor }) → Promise<string>` (el token en claro);
  - `validarLink(token) → Promise<{ valido: true, tipo, username, nombre_completo } | { valido: false, motivo }>`;
  - `establecerContrasena(token, password) → Promise<{ usuarioId }>` (lanza `ErrorLink`);
  - `enviarLinkDeAcceso({ usuario: { id, username, nombre_completo, email, rol }, tipo, actorId, origen }) → Promise<{ email_enviado, error? }>`.
- Produces (`services/emailTemplates.js`):
  - `export const RPAD_URL`, `fechaHoraArgentina(fecha) → string`, `plantillaSimple({ titulo, parrafos, boton, notas })`;
  - `invitacionTemplate(datos)` y `recuperacionTemplate(datos) → { subject, html, text }`.
- Produces (tests): `mailpit.esperar(condicion, opciones?) → Promise<mensajes[]>`, `paraCasilla(email) → (mensaje) => boolean`, `tokenDelLink(html) → string|undefined`.

- [ ] **Step 1: Helpers de los tests** — en `tests/helpers.js`, reemplazar el objeto `mailpit` y agregar dos utilidades:

```js
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
```

- [ ] **Step 2: Tests que fallan** — crear `tests/usuarios-contrasena.test.js`

```js
// Links de acceso (spec 7): recuperación, invitación y "¿Olvidaste tu contraseña?". Base de prueba propia.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query,
  mailpit, paraCasilla, tokenDelLink
} from './helpers.js';

let base, servidor, api, usuarios, acceso, pool, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_usuarios_contrasena');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api);
  // Se importan después de apuntar DB_NAME a la base de prueba: el pool de la app se crea al importarse
  acceso = await import('../services/accesoService.js');
  pool = (await import('../config/database.js')).default;
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await pool?.end();
  await cerrarDb();
  await servidor?.detener();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  await mailpit.vaciar();
});

// app.js confía en un proxy: la IP del pedido es la última de X-Forwarded-For. Cada pedido usa una IP
// distinta para no chocar con los límites, salvo en los tests de límites.
let ultimaIp = 0;
const ipNueva = () => ({ 'X-Forwarded-For': `198.51.100.${++ultimaIp}` });

const validar = (token) => api.post('/auth/link/validar', { token }, { headers: ipNueva() });
const establecer = (token, password) => api.post('/auth/establecer-contrasena', { token, password }, { headers: ipNueva() });
const recuperar = (identificador, headers = ipNueva()) => api.post('/auth/recuperar', { identificador }, { headers });
const linkPara = (usuario, tipo = 'recuperacion') => acceso.generarLink(pool, { usuarioId: usuario.id, tipo });

describe('link de recuperación', () => {
  it('se valida, sirve una sola vez y deja ingresar con la contraseña nueva', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const token = await linkPara(x);
    const validacion = await validar(token);
    assert.equal(validacion.status, 200);
    assert.deepEqual(validacion.body.data, { valido: true, tipo: 'recuperacion', username: x.username, nombre_completo: 'Test x' });

    const guardado = await establecer(token, 'ContraseñaNueva1');
    assert.equal(guardado.status, 200);
    assert.equal(guardado.body.message, 'Tu contraseña quedó guardada. Ya podés ingresar.');
    assert.ok(await api.login(x.username, 'ContraseñaNueva1'));

    const otraVez = await establecer(token, 'OtraContraseña2');
    assert.equal(otraVez.status, 400);
    assert.equal(otraVez.body.motivo, 'usado');
    assert.deepEqual((await validar(token)).body.data, { valido: false, motivo: 'usado' });
  });

  it('al establecer la contraseña se cierran las sesiones abiertas y queda en el historial', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'admin' });
    await establecer(await linkPara(x), 'ContraseñaNueva1');
    assert.equal((await api.get('/auth/verify', { token: x.token })).status, 401);
    const historial = await query('SELECT accion, actor_id FROM usuarios_auditoria WHERE usuario_id = ?', [x.id]);
    assert.deepEqual(historial.map(h => [h.accion, h.actor_id]), [['contrasena_establecida', x.id]]);
  });

  it('un link vencido no sirve', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const token = await linkPara(x);
    await query('UPDATE usuarios_tokens SET expira_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE usuario_id = ?', [x.id]);
    assert.deepEqual((await validar(token)).body.data, { valido: false, motivo: 'vencido' });
    const res = await establecer(token, 'ContraseñaNueva1');
    assert.equal(res.status, 400);
    assert.equal(res.body.motivo, 'vencido');
    assert.equal(res.body.error, 'El link venció. Pedí uno nuevo.');
  });

  it('generar un link nuevo anula el anterior', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const primero = await linkPara(x);
    const segundo = await linkPara(x);
    assert.deepEqual((await validar(primero)).body.data, { valido: false, motivo: 'invalido' });
    assert.equal((await validar(segundo)).body.data.valido, true);
  });

  it('un link inventado o mal formado no sirve', async () => {
    for (const token of [crypto.randomBytes(32).toString('base64url'), 'corto', '<script>alert(1)</script>', 123, null]) {
      assert.deepEqual((await validar(token)).body.data, { valido: false, motivo: 'invalido' }, String(token));
    }
  });

  it('el link de un usuario desactivado no sirve', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const token = await linkPara(x);
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [x.id]);
    assert.deepEqual((await validar(token)).body.data, { valido: false, motivo: 'invalido' });
  });

  it('rechaza contraseñas de menos de 8 caracteres o de más de 72 bytes, sin consumir el link', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const token = await linkPara(x);
    const corta = await establecer(token, 'corta');
    assert.equal(corta.status, 400);
    assert.equal(corta.body.error, 'La contraseña debe tener al menos 8 caracteres');
    assert.equal((await establecer(token, 'ñ'.repeat(37))).status, 400);
    assert.equal((await validar(token)).body.data.valido, true);
  });

  it('dos pedidos simultáneos con el mismo link: solo uno guarda la contraseña', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const token = await linkPara(x);
    const resultados = await Promise.all([establecer(token, 'PrimeraClave1'), establecer(token, 'SegundaClave2')]);
    assert.deepEqual(resultados.map(r => r.status).sort(), [200, 400]);
    assert.equal(resultados.find(r => r.status === 400).body.motivo, 'usado');
  });
});

describe('¿Olvidaste tu contraseña?', () => {
  it('responde lo mismo para una cuenta activa, una inexistente y una desactivada, y solo escribe a la activa', async () => {
    const { activa, desactivada } = await crearUsuariosPrueba(api, { activa: 'lector', desactivada: 'lector' });
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [desactivada.id]);
    const respuestas = [await recuperar(activa.username), await recuperar('no_existe_nadie'), await recuperar(desactivada.email)];
    for (const res of respuestas) {
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        success: true,
        message: 'Si los datos corresponden a una cuenta activa, te enviamos un email con un link. Revisá también la carpeta de spam.'
      });
    }
    const paraActiva = await mailpit.esperar(paraCasilla(activa.email));
    assert.equal(paraActiva.length, 1);
    assert.equal(paraActiva[0].Subject, 'Restablecé tu contraseña del RPAD');
    assert.equal((await mailpit.mensajes()).filter(paraCasilla(desactivada.email)).length, 0);
  });

  it('acepta el email en lugar del usuario; el link del email funciona y el pedido queda en el historial', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await recuperar(x.email.toUpperCase());
    const [mensaje] = await mailpit.esperar(paraCasilla(x.email));
    const token = tokenDelLink(await mailpit.html(mensaje.ID));
    assert.equal((await validar(token)).body.data.tipo, 'recuperacion');
    const [fila] = await query("SELECT actor_id, detalle FROM usuarios_auditoria WHERE usuario_id = ? AND accion = 'recuperacion_enviada'", [x.id]);
    assert.equal(fila.actor_id, null);
    assert.deepEqual(JSON.parse(fila.detalle), { origen: 'login', email_enviado: true });
  });

  it('a un usuario con la invitación pendiente le reenvía la invitación', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await query('UPDATE usuarios SET password_hash = NULL WHERE id = ?', [x.id]);
    await recuperar(x.username);
    const [mensaje] = await mailpit.esperar(paraCasilla(x.email));
    assert.equal(mensaje.Subject, 'Tu acceso al RPAD');
  });

  it('limita a 3 pedidos por hora para un mismo usuario, aunque cambie la IP', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    for (let i = 0; i < 3; i++) assert.equal((await recuperar(x.username)).status, 200);
    assert.equal((await recuperar(x.username)).status, 429);
  });

  it('limita a 5 pedidos por hora desde una misma IP', async () => {
    const misma = { 'X-Forwarded-For': '192.0.2.10' };
    for (let i = 0; i < 5; i++) assert.equal((await recuperar(`nadie_${i}`, misma)).status, 200);
    assert.equal((await recuperar('nadie_6', misma)).status, 429);
  });
});
```

- [ ] **Step 3: Correr y ver que falla**

Run: `node --test tests/usuarios-contrasena.test.js`
Expected: FAIL. `accesoService.js` no existe y las rutas responden 404.

- [ ] **Step 4: Plantillas** — en `services/emailTemplates.js`:

(a) Agregar un import al principio del archivo (antes de `const COLORS`):

```js
import { TEXTO_ROL } from './usuariosReglas.js';
```

(b) Reemplazar `const RPAD_URL = 'https://rpad.mcrmodernizacion.gob.ar';` por:

```js
// URL pública del RPAD para los links de los emails. En local se configura APP_URL (spec 7.1)
export const RPAD_URL = (process.env.APP_URL || 'https://rpad.mcrmodernizacion.gob.ar').replace(/\/+$/, '');

// "18 de octubre de 2026, 14:30" en la hora de Argentina
const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
});
export const fechaHoraArgentina = (fecha) => FORMATO_FECHA_HORA.format(fecha);
```

(c) Al final del archivo, agregar:

```js
// =====================================================
// PLANTILLAS DE USUARIOS: acceso al RPAD y avisos al superadmin (spec 10)
// =====================================================

/**
 * Email simple con el formato de los demás: encabezado, título, párrafos, botón y notas al pie.
 * parrafos y notas: HTML ya escapado (pueden traer <strong>). boton: { texto, url } o null.
 */
export const plantillaSimple = ({ titulo, parrafos, boton = null, notas = [] }) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(titulo)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${COLORS.light};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.primary} 100%); padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">RPAD</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">Registro Permanente de Actualización de Datasets</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 24px 8px 24px;">
              <h2 style="color: ${COLORS.dark}; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">${escapeHtml(titulo)}</h2>
              ${parrafos.map(p => `<p style="margin: 0 0 12px 0; color: ${COLORS.dark}; font-size: 14px; line-height: 1.6;">${p}</p>`).join('')}
            </td>
          </tr>
          ${boton ? `
          <tr>
            <td style="padding: 8px 24px 24px 24px; text-align: center;">
              <a href="${escapeHtml(boton.url)}" style="display: inline-block; background-color: ${COLORS.primary}; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">${escapeHtml(boton.texto)}</a>
            </td>
          </tr>` : ''}
          ${notas.length > 0 ? `
          <tr>
            <td style="padding: 0 24px 24px 24px;">
              ${notas.map(n => `<p style="margin: 0 0 8px 0; color: ${COLORS.muted}; font-size: 12px; line-height: 1.5;">${n}</p>`).join('')}
            </td>
          </tr>` : ''}
          <tr>
            <td style="background-color: ${COLORS.light}; padding: 16px 24px; text-align: center; border-top: 1px solid ${COLORS.border};">
              <p style="margin: 0; color: ${COLORS.muted}; font-size: 12px;">
                Dirección de Datos Públicos y Comunicación<br>
                Municipalidad de Comodoro Rivadavia
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// Invitación: el usuario elige su contraseña por primera vez (spec 10.1). vence: texto de fecha y hora
export const invitacionTemplate = ({ nombre_completo, username, rol, link, vence }) => {
  const rolTexto = TEXTO_ROL[rol] || rol;
  return {
    subject: 'Tu acceso al RPAD',
    html: plantillaSimple({
      titulo: 'Tu acceso al RPAD',
      parrafos: [
        `Hola, ${escapeHtml(nombre_completo)}.`,
        `Te dieron acceso al Registro Permanente de Actualización de Datasets (RPAD) con el usuario <strong>${escapeHtml(username)}</strong> y el rol <strong>${escapeHtml(rolTexto)}</strong>.`,
        'Para empezar, elegí tu contraseña con el botón de abajo.'
      ],
      boton: { texto: 'Elegir mi contraseña', url: link },
      notas: [
        `El link sirve una sola vez y vence el ${escapeHtml(vence)} h.`,
        'Si vence, pedí uno nuevo desde "¿Olvidaste tu contraseña?" en la pantalla de ingreso, o pedíselo a un administrador.'
      ]
    }),
    text: [
      `Hola, ${nombre_completo}.`,
      '',
      `Te dieron acceso al RPAD con el usuario ${username} y el rol ${rolTexto}.`,
      'Elegí tu contraseña en este link:',
      link,
      '',
      `El link sirve una sola vez y vence el ${vence} h.`,
      'Si vence, pedí uno nuevo desde "¿Olvidaste tu contraseña?" en la pantalla de ingreso, o pedíselo a un administrador.'
    ].join('\n')
  };
};

// Recuperación: reset desde el panel o "¿Olvidaste tu contraseña?" (spec 10.2)
export const recuperacionTemplate = ({ nombre_completo, username, link, vence }) => ({
  subject: 'Restablecé tu contraseña del RPAD',
  html: plantillaSimple({
    titulo: 'Restablecé tu contraseña',
    parrafos: [
      `Hola, ${escapeHtml(nombre_completo)}.`,
      `Recibimos un pedido para restablecer la contraseña del usuario <strong>${escapeHtml(username)}</strong> en el RPAD.`
    ],
    boton: { texto: 'Elegir una contraseña nueva', url: link },
    notas: [
      `El link sirve una sola vez y vence el ${escapeHtml(vence)} h.`,
      'Si no lo pediste, ignorá este email: tu contraseña actual sigue funcionando.'
    ]
  }),
  text: [
    `Hola, ${nombre_completo}.`,
    '',
    `Recibimos un pedido para restablecer la contraseña del usuario ${username} en el RPAD.`,
    'Elegí una contraseña nueva en este link:',
    link,
    '',
    `El link sirve una sola vez y vence el ${vence} h.`,
    'Si no lo pediste, ignorá este email: tu contraseña actual sigue funcionando.'
  ].join('\n')
});
```

- [ ] **Step 5: Implementar** `services/accesoService.js`

```js
// Links de acceso de un solo uso: invitación (alta) y recuperación de contraseña (spec 7)
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { sendEmail } from './emailService.js';
import { invitacionTemplate, recuperacionTemplate, RPAD_URL, fechaHoraArgentina } from './emailTemplates.js';
import { registrarAuditoria } from './usuariosAuditoriaService.js';
import { emailValido } from './usuariosReglas.js';

export const HORAS_VIGENCIA = { invitacion: 72, recuperacion: 2 };

// Lo que ve quien abre un link que no sirve
export const MENSAJE_LINK = {
  vencido: 'El link venció. Pedí uno nuevo.',
  usado: 'Este link ya se usó. Si necesitás otro, pedilo de nuevo.',
  invalido: 'El link no es válido. Pedí uno nuevo.'
};

export class ErrorLink extends Error {
  constructor(motivo) {
    super(MENSAJE_LINK[motivo]);
    this.motivo = motivo;
  }
}

// En la base solo se guarda el SHA-256 del token
export const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// Los tokens son 32 bytes en base64url (43 caracteres); cualquier otra cosa no se busca en la base
const formatoValido = (token) => typeof token === 'string' && /^[A-Za-z0-9_-]{20,100}$/.test(token);

// Motivo por el que un link no sirve, o null si sirve
const motivoInvalidez = (fila) => {
  if (!fila || !fila.activo || fila.anulado_at) return 'invalido';
  if (fila.usado_at) return 'usado';
  if (fila.vencido) return 'vencido';
  return null;
};

const SELECT_LINK = `
  SELECT t.id, t.usuario_id, t.tipo, t.usado_at, t.anulado_at, (t.expira_at < NOW()) AS vencido,
         u.username, u.nombre_completo, u.activo
  FROM usuarios_tokens t
  JOIN usuarios u ON u.id = t.usuario_id
  WHERE t.token_hash = ?`;

/**
 * Crea un link nuevo y anula los anteriores sin usar del usuario (spec 7.1).
 * conexion: el pool o una conexión con transacción abierta. Devuelve el token en claro: solo viaja por email.
 */
export const generarLink = async (conexion, { usuarioId, tipo, creadoPor = null }) => {
  if (!HORAS_VIGENCIA[tipo]) throw new Error(`Tipo de link inválido: ${tipo}`);
  const token = crypto.randomBytes(32).toString('base64url');
  await conexion.execute(
    'UPDATE usuarios_tokens SET anulado_at = NOW() WHERE usuario_id = ? AND usado_at IS NULL AND anulado_at IS NULL',
    [usuarioId]
  );
  await conexion.execute(
    `INSERT INTO usuarios_tokens (usuario_id, tipo, token_hash, expira_at, creado_por)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?)`,
    [usuarioId, tipo, hashToken(token), HORAS_VIGENCIA[tipo], creadoPor]
  );
  return token;
};

// Estado de un link, sin consumirlo (spec 7.4)
export const validarLink = async (token) => {
  if (!formatoValido(token)) return { valido: false, motivo: 'invalido' };
  const [filas] = await pool.execute(SELECT_LINK, [hashToken(token)]);
  const motivo = motivoInvalidez(filas[0]);
  if (motivo) return { valido: false, motivo };
  const { tipo, username, nombre_completo } = filas[0];
  return { valido: true, tipo, username, nombre_completo };
};

/**
 * Consume el link y guarda la contraseña (spec 7.4): cierra las sesiones abiertas y anula los demás links.
 * El token se bloquea (FOR UPDATE): con dos pedidos simultáneos, el segundo ve el link ya usado.
 * Lanza ErrorLink si el link no sirve.
 */
export const establecerContrasena = async (token, password) => {
  if (!formatoValido(token)) throw new ErrorLink('invalido');
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const [filas] = await conexion.execute(`${SELECT_LINK} FOR UPDATE`, [hashToken(token)]);
    const motivo = motivoInvalidez(filas[0]);
    if (motivo) throw new ErrorLink(motivo);
    const { id, usuario_id: usuarioId } = filas[0];

    const hash = await bcrypt.hash(password, 10);
    await conexion.execute(
      'UPDATE usuarios SET password_hash = ?, sesion_version = sesion_version + 1 WHERE id = ?',
      [hash, usuarioId]
    );
    await conexion.execute('UPDATE usuarios_tokens SET usado_at = NOW() WHERE id = ?', [id]);
    await conexion.execute(
      'UPDATE usuarios_tokens SET anulado_at = NOW() WHERE usuario_id = ? AND id <> ? AND usado_at IS NULL AND anulado_at IS NULL',
      [usuarioId, id]
    );
    await registrarAuditoria(conexion, { usuarioId, actorId: usuarioId, accion: 'contrasena_establecida' });
    await conexion.commit();
    return { usuarioId };
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
};

/**
 * Genera el link y envía el email de invitación o de recuperación (spec 7.2 y 10).
 * usuario: { id, username, nombre_completo, email, rol }. origen: 'panel' | 'login'.
 * El link queda generado aunque el email falle; el intento queda en el historial (spec 10.4).
 * Devuelve { email_enviado, error? }.
 */
export const enviarLinkDeAcceso = async ({ usuario, tipo, actorId = null, origen }) => {
  if (!emailValido(usuario.email)) return { email_enviado: false, error: 'El usuario no tiene un email válido' };

  const token = await generarLink(pool, { usuarioId: usuario.id, tipo, creadoPor: actorId });
  const link = `${RPAD_URL}/establecer-contrasena.html#token=${token}`;
  const vence = fechaHoraArgentina(new Date(Date.now() + HORAS_VIGENCIA[tipo] * 3600 * 1000));
  const plantilla = tipo === 'invitacion' ? invitacionTemplate : recuperacionTemplate;

  const envio = await sendEmail({
    ...plantilla({ ...usuario, link, vence }),
    to: usuario.email,
    from: `"RPAD - Datos Abiertos MCR" <${process.env.SMTP_USER}>`
  });

  const resultado = envio.success ? { email_enviado: true } : { email_enviado: false, error: envio.error };
  await registrarAuditoria(pool, {
    usuarioId: usuario.id,
    actorId,
    accion: tipo === 'invitacion' ? 'invitacion_enviada' : 'recuperacion_enviada',
    detalle: { origen, ...resultado }
  });
  return resultado;
};
```

- [ ] **Step 6: Endpoints públicos** — en `controllers/authController.js`:

(a) Agregar este import, debajo de los de la Task 2 (`validarContrasena` ya está importado):

```js
import { validarLink, establecerContrasena, enviarLinkDeAcceso, ErrorLink } from '../services/accesoService.js';
```

(b) Al final del archivo:

```js
// =====================================================
// Links de acceso (spec 7.3 y 7.4)
// =====================================================

const MENSAJE_RECUPERAR = 'Si los datos corresponden a una cuenta activa, te enviamos un email con un link. Revisá también la carpeta de spam.';

// "¿Olvidaste tu contraseña?": siempre la misma respuesta, exista o no la cuenta.
// Se responde antes de buscar y enviar: el tiempo de respuesta tampoco revela si la cuenta existe.
export const recuperarContrasena = async (req, res) => {
  const identificador = String(req.body?.identificador ?? '').trim();
  res.json({ success: true, message: MENSAJE_RECUPERAR });

  if (!identificador || identificador.length > 100) return;
  try {
    const [filas] = await pool.execute(
      `SELECT id, username, nombre_completo, email, rol, (password_hash IS NOT NULL) AS tiene_contrasena
       FROM usuarios
       WHERE activo = TRUE AND (username = ? OR email = ?)
       LIMIT 1`,
      [identificador, identificador.toLowerCase()]
    );
    const usuario = filas[0];
    if (!usuario) return;
    // Si nunca eligió contraseña, se le reenvía la invitación
    await enviarLinkDeAcceso({
      usuario,
      tipo: usuario.tiene_contrasena ? 'recuperacion' : 'invitacion',
      actorId: null,
      origen: 'login'
    });
  } catch (error) {
    console.error('Error en el pedido de recuperación de contraseña:', error);
  }
};

// Estado de un link (la pantalla lo consulta al abrirse)
export const validarLinkDeAcceso = async (req, res) => {
  try {
    res.json({ success: true, data: await validarLink(req.body?.token) });
  } catch (error) {
    console.error('Error validando el link de acceso:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

// Guarda la contraseña elegida con un link
export const establecerContrasenaConLink = async (req, res) => {
  const { token, password } = req.body ?? {};
  const errorContrasena = validarContrasena(password);
  if (errorContrasena) {
    return res.status(400).json({ success: false, error: errorContrasena });
  }
  try {
    await establecerContrasena(token, password);
    res.json({ success: true, message: 'Tu contraseña quedó guardada. Ya podés ingresar.' });
  } catch (error) {
    if (error instanceof ErrorLink) {
      return res.status(400).json({ success: false, error: error.message, motivo: error.motivo });
    }
    console.error('Error estableciendo la contraseña:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};
```

- [ ] **Step 7: Límites** — al final de `middleware/rateLimit.js`:

```js
// "¿Olvidaste tu contraseña?" (spec 7.3): cuentan todos los pedidos, no solo los fallidos
const HORA_MS = 60 * 60 * 1000;
const respuestaRecuperar = {
  success: false,
  error: 'Demasiados pedidos de recuperación. Intente nuevamente en una hora.'
};

// 5 pedidos por IP por hora
export const limiteRecuperarPorIp = rateLimit({
  windowMs: HORA_MS,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: respuestaRecuperar
});

// 3 pedidos por usuario o email por hora, desde cualquier IP
export const limiteRecuperarPorIdentificador = rateLimit({
  windowMs: HORA_MS,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `recuperar|${String(req.body?.identificador ?? '').trim().toLowerCase()}`,
  message: respuestaRecuperar
});

// Validar un link y elegir la contraseña (spec 7.4): 20 pedidos cada 15 minutos por IP, entre las dos rutas
export const limiteLinkDeAcceso = rateLimit({
  windowMs: VENTANA_MS,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Demasiados intentos. Intente nuevamente en 15 minutos.' }
});
```

- [ ] **Step 8: Rutas** — en `routes/index.js`:

(a) Imports:

```js
import { limiteLoginPorIp, limiteLoginPorUsuario, limiteRecuperarPorIp, limiteRecuperarPorIdentificador, limiteLinkDeAcceso } from '../middleware/rateLimit.js';
```

```js
import {
  login, verifySession, changePassword, updateProfile, getProfile,
  recuperarContrasena, validarLinkDeAcceso, establecerContrasenaConLink
} from '../controllers/authController.js';
```

(b) Después de `router.post('/auth/login', …);`:

```js
// Links de acceso: "¿Olvidaste tu contraseña?" y elegir contraseña (con límite de pedidos)
router.post('/auth/recuperar', limiteRecuperarPorIp, limiteRecuperarPorIdentificador, recuperarContrasena);
router.post('/auth/link/validar', limiteLinkDeAcceso, validarLinkDeAcceso);
router.post('/auth/establecer-contrasena', limiteLinkDeAcceso, establecerContrasenaConLink);
```

- [ ] **Step 9: `.env.example`** — después del bloque de seguridad (`CRON_SECRET=cambiar`), agregar:

```
# URL pública del RPAD, para los links de los emails de acceso (invitaciones y recuperación de contraseña).
# En producción: https://rpad.mcrmodernizacion.gob.ar (es el valor por defecto). En local: http://localhost:3001
APP_URL=http://localhost:3001
```

- [ ] **Step 10: Correr los tests de la tarea**

Run: `node --test tests/usuarios-contrasena.test.js tests/email-barrera.test.js tests/notificaciones.test.js`
Expected: PASS.

- [ ] **Step 11: Suite completa contra la línea de base**

Run: `npm test 2>&1 | tee .claude/task3.txt | tail -12`
Expected: ninguna falla nueva.

- [ ] **Step 12: Commit**

```bash
git add services/accesoService.js services/emailTemplates.js controllers/authController.js middleware/rateLimit.js routes/index.js .env.example tests/helpers.js tests/usuarios-contrasena.test.js
git commit -m "feat: links de acceso de un solo uso (invitación, recuperación y olvidé mi contraseña)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 4: API del panel de usuarios

**Files:**
- Create: `controllers/usuariosController.js`
- Modify: `services/emailTemplates.js` (`avisoSuperadminTemplate`)
- Modify: `routes/index.js`
- Modify: `tests/permisos.test.js`
- Create: `tests/usuarios-panel.test.js`

**Interfaces:**
- Consumes: reglas y auditoría (Task 2); `enviarLinkDeAcceso`, `plantillaSimple`, `fechaHoraArgentina` y `RPAD_URL` (Task 3); `sendEmail` (existente).
- Produces (HTTP, todas con `authMiddleware, adminOnly`):
  - `GET /api/usuarios` → `data: { usuarios: [UsuarioPanel], resumen: { aprobadores_activos, minimo } }`;
  - `GET /api/usuarios/:id` → `data: UsuarioPanel & { historial }`;
  - `POST /api/usuarios` → 201, `data: { usuario: UsuarioPanel, email_enviado }`, `message`;
  - `PUT /api/usuarios/:id` → `data: UsuarioPanel`, `message`;
  - `POST /api/usuarios/:id/desactivar` y `/reactivar` → `data: UsuarioPanel`, `message`;
  - `POST /api/usuarios/:id/enviar-acceso` → `data: { tipo, email_enviado }`, `message`.

  `UsuarioPanel = { id, username, nombre_completo, email, email_valido, rol, cargo, vinculo, estado, ultimo_ingreso, invitacion_vence, cambios_pendientes_propuestos, created_at }`.

  Los errores devuelven `{ success: false, error, campo? }` con 400 (validación), 403 (cuenta protegida), 404, 409 (repetido, mínimo de aprobadores o estado) o 500.

- [ ] **Step 1: Agregar las rutas nuevas a `tests/permisos.test.js`**

Al final del arreglo `RUTAS_SOLO_ADMIN`:

```js
  ['GET', '/usuarios'],
  ['POST', '/usuarios'],
  ['GET', '/usuarios/1'],
  ['PUT', '/usuarios/1'],
  ['POST', '/usuarios/1/desactivar'],
  ['POST', '/usuarios/1/reactivar'],
  ['POST', '/usuarios/1/enviar-acceso'],
```

Y `'/usuarios'` al final de `RUTAS_GET_ADMIN`.

- [ ] **Step 2: Tests que fallan** — crear `tests/usuarios-panel.test.js`

```js
// Panel de usuarios (spec 8 a 11), contra una base de prueba propia
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query,
  mailpit, paraCasilla, tokenDelLink
} from './helpers.js';

const MINIMO = 'No se puede: quedarían menos de 2 usuarios que puedan aprobar cambios.';
const PROTEGIDA = 'Esta cuenta solo la modifica su titular.';
let base, servidor, api, usuarios, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_usuarios_panel');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api);
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

// Cada prueba arranca igual: los 4 usuarios base activos, con su rol, y sesiones nuevas
// (admin A, admin B y el superadmin son 3 aprobadores activos). Los usuarios creados por otras pruebas quedan desactivados.
beforeEach(async () => {
  await mailpit.vaciar();
  const ids = Object.values(usuarios).map(u => u.id);
  await query('UPDATE usuarios SET activo = 0 WHERE id NOT IN (?)', [ids]);
  for (const u of Object.values(usuarios)) {
    await query('UPDATE usuarios SET activo = 1, rol = ? WHERE id = ?', [u.rol, u.id]);
    u.token = await api.login(u.username, u.password);
  }
});

const comoA = () => ({ token: usuarios.adminA.token });
const comoB = () => ({ token: usuarios.adminB.token });
const comoSuper = () => ({ token: usuarios.superadmin.token });
const auditoria = (usuarioId, accion) =>
  query('SELECT actor_id, detalle FROM usuarios_auditoria WHERE usuario_id = ? AND accion = ? ORDER BY id', [usuarioId, accion]);
const nuevo = (datos) => ({ rol: 'lector', ...datos });

describe('permisos', () => {
  it('sin sesión 401, lector 403, admin y superadmin 200', async () => {
    assert.equal((await api.get('/usuarios')).status, 401);
    assert.equal((await api.get('/usuarios', { token: usuarios.lector.token })).status, 403);
    assert.equal((await api.get('/usuarios', comoA())).status, 200);
    assert.equal((await api.get('/usuarios', comoSuper())).status, 200);
  });
});

describe('lista', () => {
  it('trae a cada usuario con su estado, sin la contraseña, y el resumen de aprobadores', async () => {
    const { usuarios: lista, resumen } = (await api.get('/usuarios', comoA())).body.data;
    assert.deepEqual(resumen, { aprobadores_activos: 3, minimo: 2 });
    const a = lista.find(u => u.id === usuarios.adminA.id);
    assert.equal(a.estado, 'activo');
    assert.equal(a.email_valido, true);
    assert.equal(a.rol, 'admin');
    assert.ok(a.ultimo_ingreso);
    assert.equal('password_hash' in a, false);
  });

  it('marca la invitación pendiente y el email inválido', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await query("UPDATE usuarios SET password_hash = NULL, email = 'sin-arroba-lista' WHERE id = ?", [x.id]);
    const fila = (await api.get('/usuarios', comoA())).body.data.usuarios.find(u => u.id === x.id);
    assert.equal(fila.estado, 'invitacion_pendiente');
    assert.equal(fila.email_valido, false);
  });
});

describe('alta', () => {
  it('crea al usuario con la invitación pendiente, normaliza los datos y envía la invitación', async () => {
    const res = await api.post('/usuarios', nuevo({
      nombre_completo: '  Laura Inés Fernández ', username: 'lifernandez', email: 'LIF@RPAD.test',
      cargo: 'Cargo de prueba', vinculo: 'contrato'
    }), comoA());
    assert.equal(res.status, 201);
    assert.equal(res.body.data.email_enviado, true);
    assert.equal(res.body.message, 'Usuario creado. Le enviamos la invitación a lif@rpad.test.');
    const u = res.body.data.usuario;
    assert.equal(u.username, 'LIFERNANDEZ');
    assert.equal(u.email, 'lif@rpad.test');
    assert.equal(u.nombre_completo, 'Laura Inés Fernández');
    assert.equal(u.estado, 'invitacion_pendiente');
    assert.ok(u.invitacion_vence);

    const [mensaje] = await mailpit.esperar(paraCasilla('lif@rpad.test'));
    assert.equal(mensaje.Subject, 'Tu acceso al RPAD');
    const html = await mailpit.html(mensaje.ID);
    assert.match(html, /LIFERNANDEZ/);
    assert.match(html, /Lector/);
    const validacion = await api.post('/auth/link/validar', { token: tokenDelLink(html) });
    assert.equal(validacion.body.data.tipo, 'invitacion');

    const acciones = await query('SELECT accion, actor_id FROM usuarios_auditoria WHERE usuario_id = ? ORDER BY id', [u.id]);
    assert.deepEqual(acciones.map(a => [a.accion, a.actor_id]),
      [['alta', usuarios.adminA.id], ['invitacion_enviada', usuarios.adminA.id]]);
  });

  it('valida los datos e indica el campo', async () => {
    const valido = nuevo({ nombre_completo: 'Persona de Prueba', username: 'PPRUEBA', email: 'pprueba@rpad.test' });
    const casos = [
      [{ email: 'no-es-un-email' }, 400, 'email'],
      [{ nombre_completo: '' }, 400, 'nombre_completo'],
      [{ nombre_completo: 'x'.repeat(101) }, 400, 'nombre_completo'],
      [{ username: 'ab' }, 400, 'username'],
      [{ username: 'PEÑA' }, 400, 'username'],
      [{ cargo: 'x'.repeat(201) }, 400, 'cargo'],
      [{ vinculo: 'otro' }, 400, 'vinculo'],
      [{ rol: 'superadmin' }, 400, 'rol'],
      [{ rol: 'jefe' }, 400, 'rol'],
      [{ username: usuarios.adminA.username.toUpperCase() }, 409, 'username'],
      [{ email: usuarios.adminA.email.toUpperCase() }, 409, 'email']
    ];
    for (const [cambio, status, campo] of casos) {
      const res = await api.post('/usuarios', { ...valido, ...cambio }, comoA());
      assert.equal(res.status, status, JSON.stringify(cambio));
      assert.equal(res.body.campo, campo, JSON.stringify(cambio));
    }
    assert.equal((await query("SELECT COUNT(*) AS n FROM usuarios WHERE username = 'PPRUEBA'"))[0].n, 0);
  });

  it('si el email no sale, el usuario igual se crea y la respuesta lo avisa', async () => {
    const bloqueado = await iniciarServidor({ env: { DB_NAME: base.nombre, EMAIL_SOLO_A: 'nadie@rpad.test' } });
    try {
      const res = await crearCliente(bloqueado.url).post('/usuarios',
        nuevo({ nombre_completo: 'Sin Envio', username: 'SENVIO', email: 'senvio@rpad.test' }), comoA());
      assert.equal(res.status, 201);
      assert.equal(res.body.data.email_enviado, false);
      assert.equal(res.body.message, 'El usuario se guardó, pero no se pudo enviar el email. Podés reenviarlo desde Enviar link de acceso.');
      const [fila] = await auditoria(res.body.data.usuario.id, 'invitacion_enviada');
      assert.equal(JSON.parse(fila.detalle).email_enviado, false);
    } finally {
      await bloqueado.detener();
    }
  });
});

describe('edición', () => {
  it('guarda los cambios y los deja en el historial con el valor anterior y el nuevo', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const res = await api.put(`/usuarios/${x.id}`, { nombre_completo: 'Nombre Editado', cargo: 'Cargo nuevo', vinculo: 'planta_permanente' }, comoA());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.cargo, 'Cargo nuevo');
    const [fila] = await auditoria(x.id, 'edicion');
    assert.deepEqual(JSON.parse(fila.detalle).campos, {
      nombre_completo: { antes: 'Test x', despues: 'Nombre Editado' },
      cargo: { antes: null, despues: 'Cargo nuevo' },
      vinculo: { antes: null, despues: 'planta_permanente' }
    });
  });

  it('sin cambios responde 200 y no escribe en el historial', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const res = await api.put(`/usuarios/${x.id}`, { nombre_completo: 'Test x' }, comoA());
    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Sin cambios');
    assert.equal((await auditoria(x.id, 'edicion')).length, 0);
  });

  it('no deja usar el usuario o el email de otro', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    const usuario = await api.put(`/usuarios/${x.id}`, { username: usuarios.adminB.username }, comoA());
    assert.equal(usuario.status, 409);
    assert.equal(usuario.body.campo, 'username');
    const email = await api.put(`/usuarios/${x.id}`, { email: usuarios.adminB.email }, comoA());
    assert.equal(email.status, 409);
    assert.equal(email.body.campo, 'email');
  });

  it('un usuario sin email válido: guardar sin email responde 400 en email; editar solo otro campo funciona', async () => {
    const { x, y } = await crearUsuariosPrueba(api, { x: 'lector', y: 'lector' });
    await query("UPDATE usuarios SET email = '' WHERE id = ?", [x.id]);
    const sinEmail = await api.put(`/usuarios/${x.id}`, { nombre_completo: 'Con Email Vacío', email: '' }, comoA());
    assert.equal(sinEmail.status, 400);
    assert.equal(sinEmail.body.campo, 'email');
    assert.equal((await api.put(`/usuarios/${x.id}`, { cargo: 'Solo cargo' }, comoA())).status, 200);
    // Otro usuario editado sin tocar el email no choca con el '' del primero
    assert.equal((await api.put(`/usuarios/${y.id}`, { cargo: 'Otro cargo' }, comoA())).status, 200);
  });

  it('cambia el rol, lo registra y el usuario lo tiene en el pedido siguiente', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    assert.equal((await api.get('/usuarios', { token: x.token })).status, 403);
    assert.equal((await api.put(`/usuarios/${x.id}`, { rol: 'admin' }, comoA())).status, 200);
    assert.equal((await api.get('/usuarios', { token: x.token })).status, 200);
    const [fila] = await auditoria(x.id, 'cambio_rol');
    assert.deepEqual(JSON.parse(fila.detalle), { antes: 'lector', despues: 'admin' });
  });
});

describe('cuenta del superadmin', () => {
  it('un admin no puede editarla, desactivarla ni enviarle links', async () => {
    const id = usuarios.superadmin.id;
    for (const res of [
      await api.put(`/usuarios/${id}`, { cargo: 'Cambio de otro' }, comoA()),
      await api.post(`/usuarios/${id}/desactivar`, {}, comoA()),
      await api.post(`/usuarios/${id}/enviar-acceso`, {}, comoA())
    ]) {
      assert.equal(res.status, 403);
      assert.equal(res.body.error, PROTEGIDA);
    }
  });

  it('el superadmin edita sus propios datos pero no su rol ni su estado', async () => {
    const id = usuarios.superadmin.id;
    assert.equal((await api.put(`/usuarios/${id}`, { cargo: 'Mi cargo' }, comoSuper())).status, 200);
    assert.equal((await api.put(`/usuarios/${id}`, { rol: 'admin' }, comoSuper())).status, 403);
    assert.equal((await api.post(`/usuarios/${id}/desactivar`, {}, comoSuper())).status, 403);
    const [fila] = await query('SELECT rol, activo, cargo FROM usuarios WHERE id = ?', [id]);
    assert.deepEqual({ ...fila }, { rol: 'superadmin', activo: 1, cargo: 'Mi cargo' });
  });
});

describe('mínimo de aprobadores', () => {
  it('con 2 aprobadores activos no se puede desactivar ni pasar a lector a ninguno', async () => {
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [usuarios.superadmin.id]);
    for (const res of [
      await api.post(`/usuarios/${usuarios.adminB.id}/desactivar`, {}, comoA()),
      await api.put(`/usuarios/${usuarios.adminB.id}`, { rol: 'lector' }, comoA()),
      await api.put(`/usuarios/${usuarios.adminA.id}`, { rol: 'lector' }, comoA())
    ]) {
      assert.equal(res.status, 409);
      assert.equal(res.body.error, MINIMO);
    }
    assert.equal((await api.post(`/usuarios/${usuarios.lector.id}/desactivar`, {}, comoA())).status, 200);
  });

  it('un admin con la invitación pendiente no cuenta como aprobador', async () => {
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [usuarios.superadmin.id]);
    const alta = await api.post('/usuarios', { nombre_completo: 'Admin Pendiente', username: 'APENDIENTE', email: 'apendiente@rpad.test', rol: 'admin' }, comoA());
    assert.equal(alta.status, 201);
    assert.equal((await api.post(`/usuarios/${usuarios.adminB.id}/desactivar`, {}, comoA())).status, 409);
  });

  it('con 3 aprobadores se puede sacar a uno', async () => {
    assert.equal((await api.put(`/usuarios/${usuarios.adminB.id}`, { rol: 'lector' }, comoA())).status, 200);
    assert.equal((await api.get('/usuarios', comoA())).body.data.resumen.aprobadores_activos, 2);
  });

  it('dos admins que se desactivan mutuamente al mismo tiempo dejan al menos 2 aprobadores', async () => {
    const resultados = await Promise.all([
      api.post(`/usuarios/${usuarios.adminB.id}/desactivar`, {}, comoA()),
      api.post(`/usuarios/${usuarios.adminA.id}/desactivar`, {}, comoB())
    ]);
    assert.ok(resultados.some(r => r.status === 200), resultados.map(r => r.status).join(','));
    const [{ n }] = await query("SELECT COUNT(*) AS n FROM usuarios WHERE rol IN ('admin','superadmin') AND activo = 1 AND password_hash IS NOT NULL");
    assert.ok(n >= 2, `quedaron ${n} aprobadores`);
  });
});

describe('desactivar y reactivar', () => {
  it('desactivar cierra la sesión en el acto, anula los links y registra los cambios pendientes', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'admin' });
    await query("INSERT INTO cambios_pendientes (tipo_cambio, datos_nuevos, usuario_id) VALUES ('crear', '{}', ?)", [x.id]);
    const fila = (await api.get('/usuarios', comoA())).body.data.usuarios.find(u => u.id === x.id);
    assert.equal(fila.cambios_pendientes_propuestos, 1);
    await api.post(`/usuarios/${x.id}/enviar-acceso`, {}, comoA());

    const res = await api.post(`/usuarios/${x.id}/desactivar`, {}, comoA());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.estado, 'desactivado');
    assert.equal((await api.get('/auth/verify', { token: x.token })).status, 401);
    const [{ vigentes }] = await query('SELECT COUNT(*) AS vigentes FROM usuarios_tokens WHERE usuario_id = ? AND usado_at IS NULL AND anulado_at IS NULL', [x.id]);
    assert.equal(vigentes, 0);
    const [registro] = await auditoria(x.id, 'desactivacion');
    assert.deepEqual(JSON.parse(registro.detalle), { cambios_pendientes: 1 });
  });

  it('reactivar devuelve el acceso con la contraseña de siempre', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await api.post(`/usuarios/${x.id}/desactivar`, {}, comoA());
    const res = await api.post(`/usuarios/${x.id}/reactivar`, {}, comoA());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.estado, 'activo');
    assert.ok(await api.login(x.username, x.password));
  });

  it('reactivar a alguien que nunca eligió contraseña lo deja con la invitación pendiente', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await query('UPDATE usuarios SET password_hash = NULL, activo = 0 WHERE id = ?', [x.id]);
    assert.equal((await api.post(`/usuarios/${x.id}/reactivar`, {}, comoA())).body.data.estado, 'invitacion_pendiente');
  });

  it('no se puede desactivar dos veces ni reactivar a alguien activo', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    assert.equal((await api.post(`/usuarios/${x.id}/reactivar`, {}, comoA())).status, 409);
    await api.post(`/usuarios/${x.id}/desactivar`, {}, comoA());
    assert.equal((await api.post(`/usuarios/${x.id}/desactivar`, {}, comoA())).status, 409);
  });
});

describe('enviar link de acceso', () => {
  it('a un usuario activo le envía la recuperación; a uno pendiente, la invitación', async () => {
    const { activo, pendiente } = await crearUsuariosPrueba(api, { activo: 'lector', pendiente: 'lector' });
    await query('UPDATE usuarios SET password_hash = NULL WHERE id = ?', [pendiente.id]);
    assert.equal((await api.post(`/usuarios/${activo.id}/enviar-acceso`, {}, comoA())).body.data.tipo, 'recuperacion');
    assert.equal((await api.post(`/usuarios/${pendiente.id}/enviar-acceso`, {}, comoA())).body.data.tipo, 'invitacion');
    assert.equal((await mailpit.esperar(paraCasilla(activo.email)))[0].Subject, 'Restablecé tu contraseña del RPAD');
    assert.equal((await mailpit.esperar(paraCasilla(pendiente.email)))[0].Subject, 'Tu acceso al RPAD');
  });

  it('no envía a un usuario desactivado ni a uno sin email válido', async () => {
    const { desactivado, sinEmail } = await crearUsuariosPrueba(api, { desactivado: 'lector', sinEmail: 'lector' });
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [desactivado.id]);
    await query("UPDATE usuarios SET email = 'sin-arroba-envio' WHERE id = ?", [sinEmail.id]);
    assert.equal((await api.post(`/usuarios/${desactivado.id}/enviar-acceso`, {}, comoA())).status, 409);
    const res = await api.post(`/usuarios/${sinEmail.id}/enviar-acceso`, {}, comoA());
    assert.equal(res.status, 409);
    assert.equal(res.body.campo, 'email');
  });
});

describe('aviso al superadmin', () => {
  const avisos = () => mailpit.esperar(m => m.Subject === 'RPAD: cambio en los usuarios' && paraCasilla(usuarios.superadmin.email)(m), { intentos: 20 });

  it('le llega cuando un admin cambia un rol, desactiva a alguien o crea un admin', async () => {
    const { x, y } = await crearUsuariosPrueba(api, { x: 'lector', y: 'lector' });
    await api.put(`/usuarios/${x.id}`, { rol: 'admin' }, comoA());
    const [aviso] = await avisos();
    const html = await mailpit.html(aviso.ID);
    assert.match(html, /Test adminA/);
    assert.match(html, /Test x/);
    assert.match(html, /Lector → Administrador/);

    await mailpit.vaciar();
    await api.post(`/usuarios/${y.id}/desactivar`, {}, comoA());
    assert.equal((await avisos()).length, 1);

    await mailpit.vaciar();
    await api.post('/usuarios', { nombre_completo: 'Admin Nuevo', username: 'ANUEVO', email: 'anuevo@rpad.test', rol: 'admin' }, comoA());
    assert.equal((await avisos()).length, 1);
  });

  it('no le llega cuando el cambio lo hace el propio superadmin, ni por cambios de datos', async () => {
    const { x } = await crearUsuariosPrueba(api, { x: 'lector' });
    await api.put(`/usuarios/${x.id}`, { rol: 'admin' }, comoSuper());
    await api.put(`/usuarios/${x.id}`, { cargo: 'Otro cargo' }, comoA());
    await new Promise(r => setTimeout(r, 300));
    assert.equal((await mailpit.mensajes()).filter(m => m.Subject === 'RPAD: cambio en los usuarios').length, 0);
  });
});

describe('historial y detalle', () => {
  it('GET /usuarios/:id devuelve el historial del más reciente al más viejo, con quién hizo cada cambio', async () => {
    const alta = await api.post('/usuarios', nuevo({ nombre_completo: 'Con Historial', username: 'HISTORIAL', email: 'historial@rpad.test' }), comoA());
    const id = alta.body.data.usuario.id;
    await api.put(`/usuarios/${id}`, { cargo: 'Cargo' }, comoB());
    const res = await api.get(`/usuarios/${id}`, comoA());
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.historial.map(h => [h.accion, h.actor_username]), [
      ['edicion', usuarios.adminB.username],
      ['invitacion_enviada', usuarios.adminA.username],
      ['alta', usuarios.adminA.username]
    ]);
  });

  it('un id inexistente responde 404', async () => {
    assert.equal((await api.get('/usuarios/999999', comoA())).status, 404);
    assert.equal((await api.put('/usuarios/999999', { cargo: 'x' }, comoA())).status, 404);
    assert.equal((await api.post('/usuarios/999999/desactivar', {}, comoA())).status, 404);
    assert.equal((await api.get('/usuarios/abc', comoA())).status, 404);
  });
});
```

- [ ] **Step 3: Correr y ver que falla**

Run: `node --test tests/usuarios-panel.test.js tests/permisos.test.js`
Expected: FAIL. Las rutas `/usuarios` responden 404.

- [ ] **Step 4: Plantilla del aviso** — al final de `services/emailTemplates.js`:

```js
// Aviso al superadmin cuando otro admin crea un admin, cambia un rol o desactiva a alguien (spec 10.3)
export const avisoSuperadminTemplate = ({ actor, afectado, cambio, fecha }) => {
  const cuando = fechaHoraArgentina(fecha);
  const quien = `${actor.nombre_completo} (${actor.username})`;
  const aQuien = `${afectado.nombre_completo} (${afectado.username})`;
  return {
    subject: 'RPAD: cambio en los usuarios',
    html: plantillaSimple({
      titulo: 'Cambio en los usuarios del RPAD',
      parrafos: [
        `<strong>${escapeHtml(quien)}</strong> hizo este cambio:`,
        `${escapeHtml(aQuien)}: <strong>${escapeHtml(cambio)}</strong>`,
        `Fecha: ${escapeHtml(cuando)} h`
      ],
      boton: { texto: 'Ver el panel de usuarios', url: `${RPAD_URL}/usuarios.html` },
      notas: ['Este aviso te llega porque sos superadmin y el cambio lo hizo otro administrador.']
    }),
    text: [
      `${quien} hizo este cambio:`,
      `${aQuien}: ${cambio}`,
      `Fecha: ${cuando} h`,
      '',
      `Panel de usuarios: ${RPAD_URL}/usuarios.html`
    ].join('\n')
  };
};
```

- [ ] **Step 5: Implementar** `controllers/usuariosController.js`

```js
// Panel de usuarios (spec 8 a 11). Las rutas exigen authMiddleware + adminOnly: admin y superadmin.
import pool from '../config/database.js';
import {
  validarDatosUsuario, violaMinimoAprobadores, estadoDeUsuario, esAprobadorActivo, emailValido, camposCambiados,
  MINIMO_APROBADORES, TEXTO_ROL
} from '../services/usuariosReglas.js';
import { registrarAuditoria, historialDe } from '../services/usuariosAuditoriaService.js';
import { enviarLinkDeAcceso } from '../services/accesoService.js';
import { sendEmail } from '../services/emailService.js';
import { avisoSuperadminTemplate } from '../services/emailTemplates.js';

const MENSAJE_PROTEGIDA = 'Esta cuenta solo la modifica su titular.';
const MENSAJE_MINIMO = 'No se puede: quedarían menos de 2 usuarios que puedan aprobar cambios.';
const MENSAJE_SIN_ENVIO = 'El usuario se guardó, pero no se pudo enviar el email. Podés reenviarlo desde Enviar link de acceso.';
const CAMPOS_EDITABLES = ['nombre_completo', 'username', 'email', 'cargo', 'vinculo'];

// Columnas del panel: nunca password_hash, solo si existe
const COLUMNAS = `
  u.id, u.username, u.nombre_completo, u.email, u.rol, u.cargo, u.vinculo, u.activo, u.ultimo_ingreso, u.created_at,
  (u.password_hash IS NOT NULL) AS tiene_contrasena,
  (SELECT MAX(t.expira_at) FROM usuarios_tokens t
    WHERE t.usuario_id = u.id AND t.tipo = 'invitacion' AND t.usado_at IS NULL AND t.anulado_at IS NULL) AS invitacion_vence,
  (SELECT COUNT(*) FROM cambios_pendientes cp WHERE cp.usuario_id = u.id AND cp.estado = 'pendiente') AS cambios_pendientes_propuestos`;

const aRespuesta = (u) => ({
  id: u.id,
  username: u.username,
  nombre_completo: u.nombre_completo,
  email: u.email,
  email_valido: emailValido(u.email),
  rol: u.rol,
  cargo: u.cargo,
  vinculo: u.vinculo,
  estado: estadoDeUsuario(u),
  ultimo_ingreso: u.ultimo_ingreso,
  invitacion_vence: u.invitacion_vence,
  cambios_pendientes_propuestos: Number(u.cambios_pendientes_propuestos),
  created_at: u.created_at
});

const responderError = (res, status, error, campo) =>
  res.status(status).json({ success: false, error, ...(campo ? { campo } : {}) });

const idDeRuta = (req) => {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const buscarUsuario = async (conexion, id) => {
  const [filas] = await conexion.execute(`SELECT ${COLUMNAS} FROM usuarios u WHERE u.id = ?`, [id]);
  return filas[0] || null;
};

// Bloquea las filas de usuarios (son pocas) hasta el fin de la transacción y devuelve lo necesario para contar
// aprobadores. Se leen siempre todas y en el mismo orden: dos operaciones simultáneas se esperan en lugar de
// trabarse, y la segunda cuenta con lo que dejó la primera (spec 8.1).
const bloquearUsuarios = async (conexion) => {
  const [filas] = await conexion.execute(
    'SELECT id, rol, activo, (password_hash IS NOT NULL) AS tiene_contrasena FROM usuarios ORDER BY id FOR UPDATE'
  );
  return filas;
};

// Busca un usuario o email ya usado por otro. Devuelve el campo repetido o null.
const campoRepetido = async (conexion, { username, email }, exceptoId = 0) => {
  if (username === undefined && email === undefined) return null;
  const [filas] = await conexion.execute(
    'SELECT username, email FROM usuarios WHERE id <> ? AND (username = ? OR email = ?)',
    [exceptoId, username ?? null, email ?? null]
  );
  if (filas.length === 0) return null;
  return filas.some(f => username !== undefined && f.username.toUpperCase() === username) ? 'username' : 'email';
};

const MENSAJE_REPETIDO = { username: 'Ese usuario ya existe', email: 'Ese email ya lo usa otro usuario' };

// Spec 10.3: si el cambio no lo hizo un superadmin, se avisa a los superadmin activos. Nunca hace fallar la operación.
const avisarAlSuperadmin = async (req, afectado, cambio) => {
  if (req.user.rol === 'superadmin') return;
  try {
    const [destinatarios] = await pool.execute("SELECT email FROM usuarios WHERE rol = 'superadmin' AND activo = TRUE");
    const correos = destinatarios.map(d => d.email).filter(emailValido);
    if (correos.length === 0) return;
    const [[actor]] = await pool.execute('SELECT nombre_completo, username FROM usuarios WHERE id = ?', [req.user.userId]);
    const envio = await sendEmail({ ...avisoSuperadminTemplate({ actor, afectado, cambio, fecha: new Date() }), to: correos });
    if (!envio.success) console.error('No se pudo avisar al superadmin:', envio.error);
  } catch (error) {
    console.error('No se pudo avisar al superadmin:', error);
  }
};

// GET /usuarios
export const listarUsuarios = async (req, res) => {
  try {
    const [filas] = await pool.execute(`SELECT ${COLUMNAS} FROM usuarios u ORDER BY u.nombre_completo`);
    res.json({
      success: true,
      data: {
        usuarios: filas.map(aRespuesta),
        resumen: { aprobadores_activos: filas.filter(esAprobadorActivo).length, minimo: MINIMO_APROBADORES }
      }
    });
  } catch (error) {
    console.error('Error listando usuarios:', error);
    responderError(res, 500, 'Error interno del servidor');
  }
};

// GET /usuarios/:id
export const obtenerUsuario = async (req, res) => {
  const id = idDeRuta(req);
  try {
    const usuario = id && await buscarUsuario(pool, id);
    if (!usuario) return responderError(res, 404, 'Usuario no encontrado');
    res.json({ success: true, data: { ...aRespuesta(usuario), historial: await historialDe(id) } });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    responderError(res, 500, 'Error interno del servidor');
  }
};

// POST /usuarios: alta con la invitación pendiente y envío del link (spec 7.2)
export const crearUsuario = async (req, res) => {
  const entrada = req.body ?? {};
  if (entrada.rol === 'superadmin') return responderError(res, 400, 'El rol superadmin no se asigna desde el panel', 'rol');
  const { errores, datos } = validarDatosUsuario(entrada);
  if (errores.length > 0) return responderError(res, 400, errores[0].error, errores[0].campo);

  const conexion = await pool.getConnection();
  let id;
  try {
    await conexion.beginTransaction();
    const repetido = await campoRepetido(conexion, datos);
    if (repetido) {
      await conexion.rollback();
      return responderError(res, 409, MENSAJE_REPETIDO[repetido], repetido);
    }
    const [resultado] = await conexion.execute(
      `INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, cargo, vinculo, activo)
       VALUES (?, NULL, ?, ?, ?, ?, ?, TRUE)`,
      [datos.username, datos.nombre_completo, datos.email, datos.rol, datos.cargo ?? null, datos.vinculo ?? null]
    );
    id = resultado.insertId;
    await registrarAuditoria(conexion, {
      usuarioId: id,
      actorId: req.user.userId,
      accion: 'alta',
      detalle: {
        username: datos.username, nombre_completo: datos.nombre_completo, email: datos.email,
        rol: datos.rol, cargo: datos.cargo ?? null, vinculo: datos.vinculo ?? null
      }
    });
    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    if (error.code === 'ER_DUP_ENTRY') return responderError(res, 409, 'Ese usuario o email ya existe');
    console.error('Error creando usuario:', error);
    return responderError(res, 500, 'Error interno del servidor');
  } finally {
    conexion.release();
  }

  try {
    const usuario = await buscarUsuario(pool, id);
    const envio = await enviarLinkDeAcceso({ usuario, tipo: 'invitacion', actorId: req.user.userId, origen: 'panel' });
    if (datos.rol === 'admin') await avisarAlSuperadmin(req, usuario, `Alta como ${TEXTO_ROL.admin}`);
    res.status(201).json({
      success: true,
      data: { usuario: aRespuesta(await buscarUsuario(pool, id)), email_enviado: envio.email_enviado },
      message: envio.email_enviado ? `Usuario creado. Le enviamos la invitación a ${datos.email}.` : MENSAJE_SIN_ENVIO
    });
  } catch (error) {
    // El usuario ya quedó creado: se informa que falta el email
    console.error('Error enviando la invitación:', error);
    res.status(201).json({ success: true, data: { usuario: { id }, email_enviado: false }, message: MENSAJE_SIN_ENVIO });
  }
};

// PUT /usuarios/:id: datos y rol (spec 8.2 y 8.3)
export const actualizarUsuario = async (req, res) => {
  const id = idDeRuta(req);
  if (!id) return responderError(res, 404, 'Usuario no encontrado');
  const entrada = req.body ?? {};
  if (entrada.rol === 'superadmin') return responderError(res, 400, 'El rol superadmin no se asigna desde el panel', 'rol');
  const { errores, datos } = validarDatosUsuario(entrada, { parcial: true });
  if (errores.length > 0) return responderError(res, 400, errores[0].error, errores[0].campo);

  const conexion = await pool.getConnection();
  let antes;
  let rolNuevo = null;
  let sinCambios = false;
  try {
    await conexion.beginTransaction();
    const todos = await bloquearUsuarios(conexion);
    antes = await buscarUsuario(conexion, id);
    if (!antes) {
      await conexion.rollback();
      return responderError(res, 404, 'Usuario no encontrado');
    }
    if (antes.rol === 'superadmin') {
      if (req.user.userId !== id) {
        await conexion.rollback();
        return responderError(res, 403, MENSAJE_PROTEGIDA);
      }
      if (datos.rol !== undefined) {
        await conexion.rollback();
        return responderError(res, 403, 'El superadmin no puede cambiar su propio rol', 'rol');
      }
    }

    rolNuevo = datos.rol !== undefined && datos.rol !== antes.rol ? datos.rol : null;
    if (rolNuevo && violaMinimoAprobadores(todos, id, { rol: rolNuevo })) {
      await conexion.rollback();
      return responderError(res, 409, MENSAJE_MINIMO);
    }

    const repetido = await campoRepetido(conexion, { username: datos.username, email: datos.email }, id);
    if (repetido) {
      await conexion.rollback();
      return responderError(res, 409, MENSAJE_REPETIDO[repetido], repetido);
    }

    const campos = camposCambiados(antes, datos, CAMPOS_EDITABLES);
    sinCambios = Object.keys(campos).length === 0 && !rolNuevo;
    if (sinCambios) {
      await conexion.rollback();
    } else {
      // Los nombres de columna salen de CAMPOS_EDITABLES (lista fija), nunca del pedido
      const asignaciones = Object.keys(campos).map(campo => `${campo} = ?`);
      const valores = Object.keys(campos).map(campo => datos[campo]);
      if (rolNuevo) {
        asignaciones.push('rol = ?');
        valores.push(rolNuevo);
      }
      await conexion.execute(`UPDATE usuarios SET ${asignaciones.join(', ')} WHERE id = ?`, [...valores, id]);
      if (Object.keys(campos).length > 0) {
        await registrarAuditoria(conexion, { usuarioId: id, actorId: req.user.userId, accion: 'edicion', detalle: { campos } });
      }
      if (rolNuevo) {
        await registrarAuditoria(conexion, {
          usuarioId: id, actorId: req.user.userId, accion: 'cambio_rol', detalle: { antes: antes.rol, despues: rolNuevo }
        });
      }
      await conexion.commit();
    }
  } catch (error) {
    await conexion.rollback();
    if (error.code === 'ER_DUP_ENTRY') return responderError(res, 409, 'Ese usuario o email ya existe');
    console.error('Error actualizando usuario:', error);
    return responderError(res, 500, 'Error interno del servidor');
  } finally {
    conexion.release();
  }

  const despues = await buscarUsuario(pool, id);
  if (rolNuevo) await avisarAlSuperadmin(req, despues, `${TEXTO_ROL[antes.rol]} → ${TEXTO_ROL[rolNuevo]}`);
  res.json({ success: true, data: aRespuesta(despues), message: sinCambios ? 'Sin cambios' : 'Cambios guardados' });
};

// POST /usuarios/:id/desactivar (spec 8.6)
export const desactivarUsuario = async (req, res) => {
  const id = idDeRuta(req);
  if (!id) return responderError(res, 404, 'Usuario no encontrado');
  const conexion = await pool.getConnection();
  let usuario;
  try {
    await conexion.beginTransaction();
    const todos = await bloquearUsuarios(conexion);
    usuario = await buscarUsuario(conexion, id);
    let rechazo = null;
    if (!usuario) rechazo = [404, 'Usuario no encontrado'];
    else if (usuario.rol === 'superadmin') {
      rechazo = [403, req.user.userId === id ? 'La cuenta del superadmin no se puede desactivar.' : MENSAJE_PROTEGIDA];
    } else if (!usuario.activo) rechazo = [409, 'El usuario ya está desactivado'];
    else if (violaMinimoAprobadores(todos, id, { activo: 0 })) rechazo = [409, MENSAJE_MINIMO];
    if (rechazo) {
      await conexion.rollback();
      return responderError(res, ...rechazo);
    }

    await conexion.execute('UPDATE usuarios SET activo = FALSE, sesion_version = sesion_version + 1 WHERE id = ?', [id]);
    await conexion.execute(
      'UPDATE usuarios_tokens SET anulado_at = NOW() WHERE usuario_id = ? AND usado_at IS NULL AND anulado_at IS NULL',
      [id]
    );
    await registrarAuditoria(conexion, {
      usuarioId: id, actorId: req.user.userId, accion: 'desactivacion',
      detalle: { cambios_pendientes: Number(usuario.cambios_pendientes_propuestos) }
    });
    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    console.error('Error desactivando usuario:', error);
    return responderError(res, 500, 'Error interno del servidor');
  } finally {
    conexion.release();
  }

  await avisarAlSuperadmin(req, usuario, 'Desactivado');
  res.json({ success: true, data: aRespuesta(await buscarUsuario(pool, id)), message: 'Usuario desactivado' });
};

// POST /usuarios/:id/reactivar (spec 8.6)
export const reactivarUsuario = async (req, res) => {
  const id = idDeRuta(req);
  if (!id) return responderError(res, 404, 'Usuario no encontrado');
  try {
    const usuario = await buscarUsuario(pool, id);
    if (!usuario) return responderError(res, 404, 'Usuario no encontrado');
    if (usuario.rol === 'superadmin' && req.user.userId !== id) return responderError(res, 403, MENSAJE_PROTEGIDA);
    if (usuario.activo) return responderError(res, 409, 'El usuario ya está activo');
    await pool.execute('UPDATE usuarios SET activo = TRUE WHERE id = ?', [id]);
    await registrarAuditoria(pool, { usuarioId: id, actorId: req.user.userId, accion: 'reactivacion' });
    res.json({ success: true, data: aRespuesta(await buscarUsuario(pool, id)), message: 'Usuario reactivado' });
  } catch (error) {
    console.error('Error reactivando usuario:', error);
    responderError(res, 500, 'Error interno del servidor');
  }
};

// POST /usuarios/:id/enviar-acceso: invitación o recuperación según el estado (spec 7.2)
export const enviarAcceso = async (req, res) => {
  const id = idDeRuta(req);
  if (!id) return responderError(res, 404, 'Usuario no encontrado');
  try {
    const usuario = await buscarUsuario(pool, id);
    if (!usuario) return responderError(res, 404, 'Usuario no encontrado');
    if (usuario.rol === 'superadmin' && req.user.userId !== id) return responderError(res, 403, MENSAJE_PROTEGIDA);
    if (!usuario.activo) return responderError(res, 409, 'El usuario está desactivado: reactivalo antes de enviarle un link');
    if (!emailValido(usuario.email)) {
      return responderError(res, 409, 'El usuario no tiene un email válido. Cargale uno y guardá antes de enviarle el link.', 'email');
    }
    const tipo = usuario.tiene_contrasena ? 'recuperacion' : 'invitacion';
    const envio = await enviarLinkDeAcceso({ usuario, tipo, actorId: req.user.userId, origen: 'panel' });
    const message = !envio.email_enviado
      ? 'No se pudo enviar el email. Probá de nuevo en unos minutos.'
      : tipo === 'invitacion'
        ? `Le reenviamos la invitación a ${usuario.email}.`
        : `Le enviamos un link para restablecer la contraseña a ${usuario.email}.`;
    res.json({ success: true, data: { tipo, email_enviado: envio.email_enviado }, message });
  } catch (error) {
    console.error('Error enviando el link de acceso:', error);
    responderError(res, 500, 'Error interno del servidor');
  }
};
```

- [ ] **Step 6: Rutas** — en `routes/index.js`:

(a) Import:

```js
import {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  desactivarUsuario,
  reactivarUsuario,
  enviarAcceso
} from '../controllers/usuariosController.js';
```

(b) Después del bloque de Cambios Pendientes:

```js
// =====================================================
// Usuarios (panel: admin y superadmin)
// =====================================================
router.get('/usuarios', authMiddleware, adminOnly, listarUsuarios);
router.post('/usuarios', authMiddleware, adminOnly, crearUsuario);
router.get('/usuarios/:id', authMiddleware, adminOnly, obtenerUsuario);
router.put('/usuarios/:id', authMiddleware, adminOnly, actualizarUsuario);
router.post('/usuarios/:id/desactivar', authMiddleware, adminOnly, desactivarUsuario);
router.post('/usuarios/:id/reactivar', authMiddleware, adminOnly, reactivarUsuario);
router.post('/usuarios/:id/enviar-acceso', authMiddleware, adminOnly, enviarAcceso);
```

- [ ] **Step 7: Correr los tests de la tarea**

Run: `node --test tests/usuarios-panel.test.js tests/permisos.test.js`
Expected: PASS.

- [ ] **Step 8: Suite completa contra la línea de base**

Run: `npm test 2>&1 | tee .claude/task4.txt | tail -12`
Expected: ninguna falla nueva.

- [ ] **Step 9: Commit**

```bash
git add controllers/usuariosController.js services/emailTemplates.js routes/index.js tests/permisos.test.js tests/usuarios-panel.test.js
git commit -m "feat: API del panel de usuarios con auditoría, mínimo de aprobadores y aviso al superadmin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Frontend compartido (roles, sesión, sidebar y utilidades)

**Files:**
- Modify: `public/js/auth.js`
- Modify: `public/js/main.js` (`initHeader`, inicialización)
- Modify: `public/js/api.js` (`pedirJson`, sección USUARIOS, `Utils.sugerirUsername`, `Utils.textoCargo`, `Utils.textoVinculo`)
- Modify: `public/js/perfil.js` (`cargarPerfil`, `cambiarPassword`)
- Modify: `public/perfil.html` (campos de cargo y vínculo)
- Modify: las 13 páginas `public/*.html` (enlace en el sidebar y versión de los scripts)
- Create: `tests/auth-frontend.test.js`, `tests/paginas.test.js`
- Modify: `tests/frontend-utils.test.js`

**Interfaces:**
- Consumes: `/auth/verify` con `cargo` y `vinculo` (Task 2), rutas `/usuarios` (Task 4).
- Produces:
  - `Auth.isAdmin()` (admin o superadmin), `Auth.isSuperadmin()`, `Auth.getRoleText()`;
  - `Auth.refrescarSesion() → Promise<'ok'|'invalida'|'sin-conexion'>`;
  - `API.getUsuarios() → { usuarios, resumen }`, `API.getUsuario(id)`, `API.crearUsuario(datos)`, `API.actualizarUsuario(id, datos)`, `API.desactivarUsuario(id)`, `API.reactivarUsuario(id)`, `API.enviarAccesoUsuario(id)`. Las últimas cinco devuelven la respuesta completa `{ success, data, message }`;
  - los errores de `API.pedirJson` traen `.status` y `.campo`;
  - `Utils.sugerirUsername(nombre, existentes)`, `Utils.textoCargo(cargo, vinculo)`, `Utils.textoVinculo(vinculo)`.

- [ ] **Step 1: Tests que fallan**

(a) Crear `tests/auth-frontend.test.js`:

```js
// Roles y sesión en el frontend (public/js/auth.js), ejecutado en Node
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';

const cargarAuth = (usuario, fetch = async () => ({ ok: true, status: 200, json: async () => ({}) })) => {
  const almacen = new Map([['rpad_token', 'token-de-prueba'], ['rpad_user', JSON.stringify(usuario)]]);
  const localStorage = {
    getItem: (clave) => almacen.get(clave) ?? null,
    setItem: (clave, valor) => almacen.set(clave, String(valor)),
    removeItem: (clave) => almacen.delete(clave)
  };
  const contexto = vm.createContext({ CONFIG: { API_URL: '/api', TOKEN_KEY: 'rpad_token', USER_KEY: 'rpad_user' }, localStorage, fetch, console });
  vm.runInContext(`${fs.readFileSync(new URL('../public/js/auth.js', import.meta.url), 'utf8')}\n;globalThis.Auth = Auth;`, contexto);
  return { Auth: contexto.Auth, almacen };
};

describe('roles', () => {
  it('superadmin y admin son administradores; lector no', () => {
    assert.equal(cargarAuth({ rol: 'superadmin' }).Auth.isAdmin(), true);
    assert.equal(cargarAuth({ rol: 'admin' }).Auth.isAdmin(), true);
    assert.equal(cargarAuth({ rol: 'lector' }).Auth.isAdmin(), false);
    assert.equal(cargarAuth(null).Auth.isAdmin(), false);
  });

  it('solo el superadmin es superadmin', () => {
    assert.equal(cargarAuth({ rol: 'superadmin' }).Auth.isSuperadmin(), true);
    assert.equal(cargarAuth({ rol: 'admin' }).Auth.isSuperadmin(), false);
  });

  it('texto del rol en el header', () => {
    assert.equal(cargarAuth({ rol: 'superadmin' }).Auth.getRoleText(), 'Superadmin');
    assert.equal(cargarAuth({ rol: 'admin' }).Auth.getRoleText(), 'Administrador');
    assert.equal(cargarAuth({ rol: 'lector' }).Auth.getRoleText(), 'Lector');
  });
});

describe('refrescarSesion', () => {
  it('actualiza el usuario guardado con lo que dice el servidor y conserva lo demás', async () => {
    const fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: { user: { rol: 'superadmin', cargo: 'Cargo' } } }) });
    const { Auth } = cargarAuth({ id: 1, rol: 'admin', nombre_completo: 'Persona' }, fetch);
    assert.equal(await Auth.refrescarSesion(), 'ok');
    assert.equal(Auth.getUser().rol, 'superadmin');
    assert.equal(Auth.getUser().cargo, 'Cargo');
    assert.equal(Auth.getUser().nombre_completo, 'Persona');
  });

  it('401: sesión inválida, sin tocar lo guardado', async () => {
    const { Auth } = cargarAuth({ rol: 'admin' }, async () => ({ ok: false, status: 401, json: async () => ({}) }));
    assert.equal(await Auth.refrescarSesion(), 'invalida');
    assert.equal(Auth.getUser().rol, 'admin');
  });

  it('error del servidor o sin red: no cierra la sesión', async () => {
    assert.equal(await cargarAuth({ rol: 'admin' }, async () => ({ ok: false, status: 500, json: async () => ({}) })).Auth.refrescarSesion(), 'sin-conexion');
    assert.equal(await cargarAuth({ rol: 'admin' }, async () => { throw new Error('sin red'); }).Auth.refrescarSesion(), 'sin-conexion');
  });
});
```

(b) Crear `tests/paginas.test.js`:

```js
// Todas las páginas cargan las versiones nuevas de los scripts compartidos, y el menú de Administración tiene "Usuarios".
// Al cambiar alguno de estos scripts, subir la versión en todas las páginas y en VERSION.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

const VERSION = '20261016';
const DIRECTORIO = new URL('../public/', import.meta.url);
const paginas = fs.readdirSync(DIRECTORIO).filter(nombre => nombre.endsWith('.html'));
const leer = (pagina) => fs.readFileSync(new URL(pagina, DIRECTORIO), 'utf8');

describe('páginas', () => {
  for (const pagina of paginas) {
    it(`${pagina}: auth.js, main.js y api.js con la versión ${VERSION}`, () => {
      const html = leer(pagina);
      for (const script of ['auth', 'main', 'api']) {
        for (const uso of html.match(new RegExp(`js/${script}\\.js[^"]*"`, 'g')) || []) {
          assert.equal(uso, `js/${script}.js?v=${VERSION}"`, `${pagina}: ${uso}`);
        }
      }
    });
  }

  for (const pagina of paginas.filter(p => leer(p).includes('id="sidebarAdmin"'))) {
    it(`${pagina}: el menú de Administración tiene un único enlace a Usuarios`, () => {
      assert.equal(leer(pagina).match(/href="usuarios\.html"/g)?.length, 1);
    });
  }
});
```

(c) En `tests/frontend-utils.test.js`, al final del archivo:

```js
describe('usuarios', () => {
  it('sugiere el usuario con las iniciales de los nombres y el último apellido, sin tildes', () => {
    assert.equal(Utils.sugerirUsername('Laura Inés Fernández'), 'LIFERNANDEZ');
    assert.equal(Utils.sugerirUsername('María de los Ángeles Ruiz'), 'MARUIZ');
    assert.equal(Utils.sugerirUsername('Juan Peña'), 'JPENA');
    assert.equal(Utils.sugerirUsername('  laura   fernández '), 'LFERNANDEZ');
    assert.equal(Utils.sugerirUsername(''), '');
  });

  it('si el usuario sugerido ya existe, le agrega un número', () => {
    assert.equal(Utils.sugerirUsername('Laura Inés Fernández', ['lifernandez']), 'LIFERNANDEZ2');
    assert.equal(Utils.sugerirUsername('Laura Inés Fernández', ['LIFERNANDEZ', 'LIFERNANDEZ2']), 'LIFERNANDEZ3');
  });

  it('el cargo de alguien con contrato se muestra sin designación formal', () => {
    assert.equal(Utils.textoCargo('Jefa de Departamento', 'contrato'), 'Cumple funciones de Jefa de Departamento (sin designación formal)');
    assert.equal(Utils.textoCargo('Directora', 'planta_permanente'), 'Directora');
    assert.equal(Utils.textoCargo(null, 'contrato'), '');
  });

  it('texto del vínculo', () => {
    assert.equal(Utils.textoVinculo('planta_permanente'), 'Planta permanente');
    assert.equal(Utils.textoVinculo('planta_politica'), 'Planta política');
    assert.equal(Utils.textoVinculo('contrato'), 'Contrato');
    assert.equal(Utils.textoVinculo(null), '');
  });
});

describe('API.pedirJson', () => {
  it('el error trae el status y el campo del servidor', async () => {
    const codigo = fs.readFileSync(new URL('../public/js/api.js', import.meta.url), 'utf8');
    const contexto = vm.createContext({
      CONFIG: { API_URL: '/api' },
      Auth: { getAuthHeaders: () => ({}) },
      fetch: async () => ({ ok: false, status: 409, json: async () => ({ success: false, error: 'Ese usuario ya existe', campo: 'username' }) }),
      console
    });
    vm.runInContext(`${codigo}\n;globalThis.API = API;`, contexto);
    await assert.rejects(() => contexto.API.pedirJson('POST', '/usuarios', {}), (error) =>
      error.message === 'Ese usuario ya existe' && error.status === 409 && error.campo === 'username');
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/auth-frontend.test.js tests/paginas.test.js tests/frontend-utils.test.js`
Expected: FAIL. `isSuperadmin is not a function`, versiones viejas en las páginas, `sugerirUsername is not a function`.

- [ ] **Step 3: `public/js/auth.js`** — reemplazar `isAdmin()` y agregar los métodos nuevos:

```js
  // Verificar si es administrador: admin y superadmin pasan todo lo de administración
  isAdmin() {
    return ['admin', 'superadmin'].includes(this.getRole());
  },

  // Verificar si es superadmin
  isSuperadmin() {
    return this.getRole() === 'superadmin';
  },

  // Rol para mostrar en el header
  getRoleText() {
    return { superadmin: 'Superadmin', admin: 'Administrador' }[this.getRole()] || 'Lector';
  },

  // Confirma la sesión con el servidor y actualiza el usuario guardado (rol, nombre, cargo).
  // Devuelve 'ok', 'invalida' (401: cuenta desactivada o contraseña cambiada) o 'sin-conexion'.
  async refrescarSesion() {
    const token = this.getToken();
    if (!token) return 'invalida';
    try {
      const response = await fetch(`${CONFIG.API_URL}/auth/verify`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 401) return 'invalida';
      if (!response.ok) return 'sin-conexion';
      const data = await response.json();
      localStorage.setItem(CONFIG.USER_KEY, JSON.stringify({ ...this.getUser(), ...data.data.user }));
      return 'ok';
    } catch {
      return 'sin-conexion';
    }
  },
```

- [ ] **Step 4: `public/js/main.js`**

(a) En `initHeader`, reemplazar las líneas de `rolText` e `isAdmin`:

```js
        const rolText = Auth.getRoleText();

        const isAdmin = Auth.isAdmin();
```

(b) Reemplazar el bloque `document.addEventListener('DOMContentLoaded', () => { … });` del final del archivo por:

```js
// Páginas que se pueden ver sin sesión: si la sesión dejó de valer, se quedan en la página
const PAGINAS_PUBLICAS = ['', 'index.html', 'datasets.html', 'dataset.html', 'calendario.html', 'contacto.html'];

/**
 * Confirma la sesión con el servidor (spec 5.3): si la cuenta se desactivó o la contraseña cambió en otro lado,
 * la cierra; si cambió el rol o el nombre, actualiza el header y el menú.
 */
async function refrescarSesionGuardada() {
    if (!Auth.isAuthenticated()) return;
    const antes = JSON.stringify(Auth.getUser());
    const resultado = await Auth.refrescarSesion();
    if (resultado === 'invalida') {
        Auth.clearSession();
        const pagina = window.location.pathname.split('/').pop();
        if (!PAGINAS_PUBLICAS.includes(pagina)) {
            window.location.href = 'login.html';
            return;
        }
    }
    if (JSON.stringify(Auth.getUser()) !== antes) {
        initHeader();
        updateSidebarAuth();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Verificar si el token expiró antes de inicializar
    if (Auth.isAuthenticated() && Auth.isTokenExpired()) {
        Auth.clearSession();
    }

    initHeader();
    initSidebar();
    updateSidebarAuth();
    setActiveSidebarLink();
    refrescarSesionGuardada();
});
```

- [ ] **Step 5: `public/js/api.js`**

(a) En `pedirJson`, reemplazar la línea `if (!response.ok) throw new Error(data.error || \`Error ${response.status}\`);` por:

```js
    if (!response.ok) {
      const error = new Error(data.error || `Error ${response.status}`);
      error.status = response.status;
      error.campo = data.campo;
      throw error;
    }
```

(b) Antes de `// === NOTAS DIGITALES ===`, agregar:

```js
  // === USUARIOS (panel) ===
  async getUsuarios() {
    return (await this.pedirJson('GET', '/usuarios')).data;
  },

  async getUsuario(id) {
    return (await this.pedirJson('GET', `/usuarios/${id}`)).data;
  },

  // Las acciones devuelven la respuesta completa: la pantalla muestra el message del servidor
  async crearUsuario(datos) {
    return this.pedirJson('POST', '/usuarios', datos);
  },

  async actualizarUsuario(id, datos) {
    return this.pedirJson('PUT', `/usuarios/${id}`, datos);
  },

  async desactivarUsuario(id) {
    return this.pedirJson('POST', `/usuarios/${id}/desactivar`);
  },

  async reactivarUsuario(id) {
    return this.pedirJson('POST', `/usuarios/${id}/reactivar`);
  },

  async enviarAccesoUsuario(id) {
    return this.pedirJson('POST', `/usuarios/${id}/enviar-acceso`);
  },

```

(c) En `Utils`, después de `getTipoGestionTexto`, agregar:

```js
  // Usuario sugerido con el patrón del RPAD: iniciales de los nombres + último apellido, en mayúsculas y
  // sin tildes. Si ya existe, le agrega un número (spec 8.4)
  sugerirUsername(nombreCompleto, existentes = []) {
    const PARTICULAS = ['de', 'del', 'la', 'las', 'los', 'y'];
    const palabras = String(nombreCompleto || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z\s]/g, ' ')
      .split(/\s+/)
      .filter(palabra => palabra && !PARTICULAS.includes(palabra.toLowerCase()));
    if (palabras.length === 0) return '';
    const ultima = palabras[palabras.length - 1];
    const base = (palabras.slice(0, -1).map(palabra => palabra[0]).join('') + ultima).toUpperCase().slice(0, 48);
    const usados = new Set(existentes.map(usuario => String(usuario).toUpperCase()));
    if (!usados.has(base)) return base;
    let numero = 2;
    while (usados.has(`${base}${numero}`)) numero++;
    return `${base}${numero}`;
  },

  // Cargo para mostrar: con contrato, "Cumple funciones de … (sin designación formal)" (spec 12.2)
  textoCargo(cargo, vinculo) {
    if (!cargo) return '';
    return vinculo === 'contrato' ? `Cumple funciones de ${cargo} (sin designación formal)` : cargo;
  },

  textoVinculo(vinculo) {
    return { planta_permanente: 'Planta permanente', planta_politica: 'Planta política', contrato: 'Contrato' }[vinculo] || '';
  },

```

- [ ] **Step 6: Mi Perfil**

(a) En `public/perfil.html`, después del `form-group` del campo `perfil-username` (el `</div>` que cierra `<input type="text" id="perfil-username" …>`), agregar:

```html
                            <div class="form-group" id="perfil-cargo-grupo" style="display: none;">
                                <label class="form-label">Cargo</label>
                                <input type="text" id="perfil-cargo" class="form-input" disabled style="background: var(--gray-50);">
                            </div>
                            <div class="form-group" id="perfil-vinculo-grupo" style="display: none;">
                                <label class="form-label">Vínculo</label>
                                <input type="text" id="perfil-vinculo" class="form-input" disabled style="background: var(--gray-50);">
                            </div>
```

(b) En `public/js/perfil.js`, en `cargarPerfil`, después de `document.getElementById('perfil-email').value = user.email;`:

```js
    // Cargo y vínculo: solo lectura, los actualiza un administrador desde el panel de usuarios
    const cargo = Utils.textoCargo(user.cargo, user.vinculo);
    const vinculo = Utils.textoVinculo(user.vinculo);
    document.getElementById('perfil-cargo').value = cargo;
    document.getElementById('perfil-cargo-grupo').style.display = cargo ? '' : 'none';
    document.getElementById('perfil-vinculo').value = vinculo;
    document.getElementById('perfil-vinculo-grupo').style.display = vinculo ? '' : 'none';
```

(c) En `cambiarPassword`, después del `if (!response.ok) {…}` y antes de `Utils.showSuccess(…)`:

```js
    // El servidor cierra las demás sesiones y devuelve un token nuevo para esta (spec 5.2)
    if (data.data?.token) {
      Auth.saveSession(data.data.token, Auth.getUser());
    }
```

- [ ] **Step 7: Enlace "Usuarios" en el sidebar y versión de los scripts en todas las páginas**

Correr este script, que no se versiona (se guarda en `.claude/`). Falla si alguna página no tiene el bloque esperado:

```bash
cat > .claude/sidebar-usuarios.mjs <<'EOF'
// Inserta el enlace "Usuarios" después de "Áreas" en el sidebar y versiona los scripts compartidos
import fs from 'fs';
const VERSION = '20261016';
const ICONO = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
const conSidebar = ['admin', 'areas', 'calendario', 'contacto', 'correos', 'dataset', 'datasets', 'gestion', 'index', 'notas', 'perfil', 'reportes'];
for (const pagina of [...conSidebar, 'login']) {
  const ruta = `public/${pagina}.html`;
  let html = fs.readFileSync(ruta, 'utf8');
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  if (conSidebar.includes(pagina)) {
    const patron = /^([ \t]*)<a href="areas\.html" class="sidebar-link">[\s\S]*?<\/a>/m;
    if (!patron.test(html) || html.includes('href="usuarios.html"')) throw new Error(`${ruta}: falta el enlace a Áreas o ya tiene Usuarios`);
    html = html.replace(patron, (bloque, s) =>
      `${bloque}${eol}${s}<a href="usuarios.html" class="sidebar-link">${eol}${s}    ${ICONO}${eol}${s}    <span>Usuarios</span>${eol}${s}</a>`);
  }
  html = html
    .replace(/js\/auth\.js(\?v=[^"]*)?"/g, `js/auth.js?v=${VERSION}"`)
    .replace(/js\/main\.js(\?v=[^"]*)?"/g, `js/main.js?v=${VERSION}"`)
    .replace(/js\/api\.js(\?v=[^"]*)?"/g, `js/api.js?v=${VERSION}"`)
    .replace(/js\/perfil\.js(\?v=[^"]*)?"/g, `js/perfil.js?v=${VERSION}"`);
  fs.writeFileSync(ruta, html);
  console.log(`ok ${ruta}`);
}
EOF
node .claude/sidebar-usuarios.mjs
```

Expected: 13 líneas `ok public/….html`. Revisar el diff de una página (`git diff public/areas.html`): el enlace queda con la misma sangría que "Áreas" y solo cambian las versiones de los scripts.

- [ ] **Step 8: Correr los tests de la tarea**

Run: `node --test tests/auth-frontend.test.js tests/paginas.test.js tests/frontend-utils.test.js tests/correos-frontend.test.js`
Expected: PASS.

- [ ] **Step 9: Suite completa contra la línea de base**

Run: `npm test 2>&1 | tee .claude/task5.txt | tail -12`
Expected: ninguna falla nueva.

- [ ] **Step 10: Commit**

```bash
git add public/js/auth.js public/js/main.js public/js/api.js public/js/perfil.js public/*.html tests/auth-frontend.test.js tests/paginas.test.js tests/frontend-utils.test.js
git commit -m "feat: frontend con rol superadmin, sesión confirmada al cargar y enlace a Usuarios en el menú

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 6: Pantalla del panel de usuarios

**Files:**
- Create: `public/usuarios.html`
- Create: `public/js/usuarios.js`

**Interfaces:**
- Consumes: `API.getUsuarios/getUsuario/crearUsuario/actualizarUsuario/desactivarUsuario/reactivarUsuario/enviarAccesoUsuario`, `Utils.sugerirUsername/textoCargo/textoVinculo/escapeHtml`, `Auth.isAdmin/getUser/logout`, `showToast`, `getInitials` (Task 5 y existentes).

- [ ] **Step 1: Escribir `public/usuarios.html`** con dos marcadores (`<!-- HEADER_Y_SIDEBAR -->` y `<!-- FOOTER -->`) que el Step 2 reemplaza por los bloques idénticos de `areas.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Usuarios - RPAD</title>
    <meta name="description" content="Gestión de usuarios del RPAD">
    <link rel="icon" type="image/png" href="img/icon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/main.css">
    <style>
        /* Grupos de la lista */
        .grupo-usuarios { background: var(--bg-card); border-radius: var(--border-radius-lg); box-shadow: var(--shadow); margin-bottom: 24px; overflow: hidden; }
        .grupo-encabezado { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .grupo-encabezado h2, .grupo-desactivados summary h2 { display: inline; font-size: 1rem; font-weight: 600; color: var(--gray-800); margin: 0; }
        .grupo-contador { color: var(--gray-500); font-size: 0.875rem; }

        /* El elemento distintivo: quiénes pueden aprobar hoy y cuántos quedan */
        .aprobadores-resumen { display: flex; align-items: center; gap: 12px; }
        .aprobadores-iniciales { display: flex; }
        .aprobadores-iniciales .usuario-avatar { margin-left: -6px; border: 2px solid var(--bg-card); }
        .aprobadores-iniciales .usuario-avatar:first-child { margin-left: 0; }
        .aprobadores-contador { font-size: 0.875rem; font-weight: 600; color: var(--primary); background: var(--info-light); padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
        .aprobadores-resumen.en-el-minimo .aprobadores-contador { color: #92400e; background: var(--warning-light); }

        /* Filas */
        .fila-usuario { display: flex; align-items: center; gap: 16px; padding: 14px 20px; border-bottom: 1px solid var(--gray-100); }
        .fila-usuario:last-child { border-bottom: none; }
        .fila-desactivada { opacity: 0.6; }
        .usuario-avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 600; font-size: 0.875rem; background: var(--gray-200); color: var(--gray-700); }
        .usuario-avatar.rol-superadmin { background: var(--primary); color: #fff; }
        .usuario-avatar.rol-admin { background: var(--info-light); color: var(--primary); }
        .usuario-avatar.mini { width: 28px; height: 28px; font-size: 0.7rem; }
        .usuario-datos { flex: 1; min-width: 0; }
        .usuario-nombre { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; color: var(--gray-800); }
        .usuario-detalle { display: flex; flex-wrap: wrap; gap: 2px 12px; margin-top: 2px; font-size: 0.875rem; color: var(--gray-600); }
        .usuario-username { font-weight: 500; color: var(--gray-700); }
        .usuario-ingreso { margin-top: 2px; font-size: 0.8rem; }
        .lista-vacia { padding: 20px; color: var(--gray-500); font-size: 0.875rem; margin: 0; }

        /* Etiquetas */
        .etiqueta { display: inline-block; font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 999px; line-height: 1.5; }
        .etiqueta.rol-superadmin { background: var(--primary); color: #fff; }
        .etiqueta.rol-admin { background: var(--info-light); color: var(--primary); }
        .etiqueta.rol-lector { background: var(--gray-100); color: var(--gray-600); }
        .etiqueta-contrato { background: var(--purple-light); color: var(--purple); }
        .etiqueta-pendiente { background: var(--warning-light); color: #92400e; }
        .etiqueta-sin-email { background: var(--danger-light); color: #b91c1c; }

        /* Desactivados plegados */
        .grupo-desactivados summary { display: flex; align-items: center; gap: 8px; padding: 16px 20px; cursor: pointer; list-style: none; }
        .grupo-desactivados summary::-webkit-details-marker { display: none; }
        .grupo-desactivados summary::before { content: '▸'; color: var(--gray-500); transition: transform 0.2s; }
        .grupo-desactivados[open] summary::before { transform: rotate(90deg); }
        .grupo-desactivados[open] summary { border-bottom: 1px solid var(--border-color); }

        /* Modal */
        .modal-encabezado-etiquetas { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; margin-right: 12px; }
        .usuario-pestanas { display: flex; gap: 4px; padding: 0 24px; border-bottom: 1px solid var(--border-color); }
        .usuario-pestana { background: none; border: none; border-bottom: 2px solid transparent; padding: 10px 14px; font: inherit; font-weight: 500; color: var(--gray-500); cursor: pointer; }
        .usuario-pestana.activa { color: var(--primary); border-bottom-color: var(--primary); }
        .usuario-pestana:focus-visible, .fila-usuario .btn:focus-visible, .grupo-desactivados summary:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .requerido { color: var(--danger); }
        .campo-error { color: #b91c1c; font-size: 0.8rem; margin: 4px 0 0; }
        .form-input[aria-invalid="true"] { border-color: var(--danger); }
        .aviso { padding: 12px 14px; border-radius: var(--border-radius); font-size: 0.875rem; margin-bottom: 16px; }
        .aviso-error { background: var(--danger-light); color: #b91c1c; }
        .aviso-info { background: var(--info-light); color: var(--primary); }
        .acciones-form { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
        .bloque-acceso { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-color); }
        .bloque-acceso h4 { font-size: 0.9rem; color: var(--gray-700); margin: 0 0 6px; }
        .bloque-acceso-botones { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 6px; }
        .historial-usuario { list-style: none; margin: 0; padding: 0; }
        .historial-usuario li { padding: 12px 0; border-bottom: 1px solid var(--gray-100); font-size: 0.875rem; }
        .historial-cabecera { display: flex; justify-content: space-between; gap: 12px; }
        .historial-cabecera time { color: var(--gray-500); white-space: nowrap; }

        @media (max-width: 768px) {
            .form-row { grid-template-columns: 1fr; }
            .grupo-encabezado { padding: 14px 16px; }
            .fila-usuario { padding: 12px 16px; align-items: flex-start; }
        }
        @media (prefers-reduced-motion: reduce) {
            .grupo-desactivados summary::before { transition: none; }
        }
    </style>
</head>
<body>
    <div class="app-container">
<!-- HEADER_Y_SIDEBAR -->

        <!-- Main Content -->
        <main class="main-content">
            <div class="page-header">
                <h1 class="page-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    Usuarios
                </h1>
                <button type="button" class="btn btn-primary" id="btn-nuevo-usuario">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                    Nuevo usuario
                </button>
            </div>

            <div class="card mb-5">
                <div class="filters-bar" style="margin-bottom: 0;">
                    <div class="filter-group" style="flex: 1;">
                        <label for="buscar-usuario">Buscar</label>
                        <input type="search" id="buscar-usuario" class="form-input" placeholder="Buscar por nombre, usuario, cargo o email...">
                    </div>
                </div>
            </div>

            <section class="grupo-usuarios" aria-labelledby="titulo-aprobadores">
                <div class="grupo-encabezado">
                    <h2 id="titulo-aprobadores">Pueden aprobar cambios</h2>
                    <div class="aprobadores-resumen" id="aprobadores-resumen"></div>
                </div>
                <div id="lista-aprobadores"><div class="loading"><div class="spinner"></div></div></div>
            </section>

            <section class="grupo-usuarios" aria-labelledby="titulo-lectores">
                <div class="grupo-encabezado">
                    <h2 id="titulo-lectores">Solo lectura</h2>
                    <span class="grupo-contador" id="contador-lectores"></span>
                </div>
                <div id="lista-lectores"></div>
            </section>

            <details class="grupo-usuarios grupo-desactivados">
                <summary><h2>Desactivados (<span id="contador-desactivados">0</span>)</h2></summary>
                <div id="lista-desactivados"></div>
            </details>

<!-- FOOTER -->
        </main>
    </div>

    <!-- Modal Usuario -->
    <div class="modal-overlay" id="modal-usuario">
        <div class="modal" style="max-width: 720px;" role="dialog" aria-modal="true" aria-labelledby="modal-usuario-titulo">
            <div class="modal-header">
                <h3 class="modal-title" id="modal-usuario-titulo">Nuevo usuario</h3>
                <span class="modal-encabezado-etiquetas" id="modal-usuario-etiquetas"></span>
                <button type="button" class="modal-close" id="modal-usuario-cerrar" aria-label="Cerrar">&times;</button>
            </div>
            <div class="usuario-pestanas" id="usuario-pestanas" role="tablist">
                <button type="button" class="usuario-pestana activa" data-pestana="datos" role="tab" aria-selected="true">Datos</button>
                <button type="button" class="usuario-pestana" data-pestana="historial" role="tab" aria-selected="false">Historial</button>
            </div>
            <div class="modal-body">
                <div id="usuario-error" class="aviso aviso-error" role="alert" hidden></div>
                <div id="aviso-protegida" class="aviso aviso-info" hidden>Esta cuenta solo la modifica su titular.</div>

                <div id="pestana-datos">
                    <form id="form-usuario" novalidate>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label" for="u-nombre">Nombre completo <span class="requerido">*</span></label>
                                <input type="text" id="u-nombre" class="form-input" maxlength="100" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="u-username">Usuario <span class="requerido">*</span></label>
                                <input type="text" id="u-username" class="form-input" maxlength="50" required autocomplete="off" spellcheck="false">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label" for="u-email">Email <span class="requerido">*</span></label>
                                <input type="email" id="u-email" class="form-input" maxlength="100" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="u-rol">Rol</label>
                                <select id="u-rol" class="form-input">
                                    <option value="lector">Lector</option>
                                    <option value="admin">Admin</option>
                                    <option value="superadmin" hidden>Superadmin</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="u-cargo">Cargo</label>
                            <input type="text" id="u-cargo" class="form-input" maxlength="200" placeholder="Ej.: Directora Administrativa">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="u-vinculo">Vínculo</label>
                            <select id="u-vinculo" class="form-input">
                                <option value="">Sin dato</option>
                                <option value="planta_permanente">Planta permanente</option>
                                <option value="planta_politica">Planta política</option>
                                <option value="contrato">Contrato (sin designación formal)</option>
                            </select>
                        </div>
                        <div class="acciones-form" id="acciones-form">
                            <button type="button" class="btn btn-secondary" id="btn-cancelar-usuario">Cancelar</button>
                            <button type="submit" class="btn btn-primary" id="btn-guardar-usuario">Guardar cambios</button>
                        </div>
                    </form>

                    <div class="bloque-acceso" id="bloque-acceso" hidden>
                        <h4>Acceso</h4>
                        <p id="acceso-detalle" class="text-muted"></p>
                        <div class="bloque-acceso-botones">
                            <button type="button" class="btn btn-secondary" id="btn-enviar-acceso">Enviar link para restablecer la contraseña</button>
                            <button type="button" class="btn btn-danger" id="btn-cambiar-estado">Desactivar</button>
                        </div>
                        <p class="text-muted" id="acceso-nota" style="font-size: 0.8rem;"></p>
                    </div>
                </div>

                <div id="pestana-historial" hidden>
                    <ol class="historial-usuario" id="historial-usuario"></ol>
                </div>
            </div>
        </div>
    </div>

    <script src="js/config.js"></script>
    <script src="js/auth.js?v=20261016"></script>
    <script src="js/main.js?v=20261016"></script>
    <script src="js/api.js?v=20261016"></script>
    <script src="js/usuarios.js?v=20261016"></script>
</body>
</html>
```

- [ ] **Step 2: Completar el header, el sidebar y el footer desde `areas.html`** (son idénticos en todas las páginas y `areas.html` ya tiene el enlace a Usuarios)

```bash
cat > .claude/armar-usuarios-html.mjs <<'EOF'
import fs from 'fs';
const areas = fs.readFileSync('public/areas.html', 'utf8');
const bloque = (desde, hasta) => {
  const inicio = areas.indexOf(desde);
  const fin = areas.indexOf(hasta, inicio) + hasta.length;
  if (inicio < 0 || fin < hasta.length) throw new Error(`No se encontró "${desde}" … "${hasta}" en areas.html`);
  return areas.slice(inicio, fin);
};
const html = fs.readFileSync('public/usuarios.html', 'utf8')
  .replace('<!-- HEADER_Y_SIDEBAR -->', '        ' + bloque('<!-- Header -->', '</aside>'))
  .replace('<!-- FOOTER -->', '            ' + bloque('<!-- Footer -->', '</footer>'));
if (html.includes('<!-- HEADER_Y_SIDEBAR -->') || html.includes('<!-- FOOTER -->')) throw new Error('Quedaron marcadores sin reemplazar');
fs.writeFileSync('public/usuarios.html', html);
console.log('ok public/usuarios.html');
EOF
node .claude/armar-usuarios-html.mjs && grep -c 'href="usuarios.html"' public/usuarios.html
```

Expected: `ok public/usuarios.html` y `1`.

- [ ] **Step 3: Escribir `public/js/usuarios.js`**

```js
// Panel de usuarios (spec 2026-10-15-usuarios-superadmin, sección 12.2):
// lista agrupada por rol, alta, edición, acceso (links y activación) e historial
let usuarios = [];
let resumen = { aprobadores_activos: 0, minimo: 2 };
let abierto = null;          // usuario del modal; null = alta
let usernameTocado = false;  // si se escribió el usuario a mano, la sugerencia no lo pisa

const TEXTO_ROL = { superadmin: 'Superadmin', admin: 'Admin', lector: 'Lector' };
const TEXTO_ACCION = {
  alta: 'Alta del usuario',
  edicion: 'Edición de datos',
  cambio_rol: 'Cambio de rol',
  desactivacion: 'Desactivación',
  reactivacion: 'Reactivación',
  invitacion_enviada: 'Invitación enviada',
  recuperacion_enviada: 'Link para restablecer la contraseña',
  contrasena_establecida: 'Eligió su contraseña',
  contrasena_cambiada: 'Cambió su contraseña desde Mi Perfil',
  perfil_editado: 'Editó su perfil'
};
const NOMBRE_CAMPO = { nombre_completo: 'Nombre', username: 'Usuario', email: 'Email', cargo: 'Cargo', vinculo: 'Vínculo' };
const CAMPO_A_INPUT = { nombre_completo: 'u-nombre', username: 'u-username', email: 'u-email', rol: 'u-rol', cargo: 'u-cargo', vinculo: 'u-vinculo' };

const esc = (texto) => Utils.escapeHtml(texto == null ? '' : String(texto));
const avisar = (mensaje, tipo = 'info') => showToast(esc(mensaje), tipo);
const esAprobador = (u) => u.rol === 'admin' || u.rol === 'superadmin';
const soyYo = (u) => Boolean(u) && u.id === Auth.getUser()?.id;
const sinTildes = (texto) => String(texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const plural = (n, singular, varios) => `${n} ${n === 1 ? singular : varios}`;
const leer = (id) => document.getElementById(id).value.trim();
const escribir = (id, valor) => { document.getElementById(id).value = valor ?? ''; };

// "hoy 09:12", "ayer 18:40", "hace 5 días", una fecha (más de 30 días) o "Sin registro"
const textoIngreso = (iso) => {
  if (!iso) return 'Sin registro';
  const fecha = new Date(iso);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = new Date(fecha);
  dia.setHours(0, 0, 0, 0);
  const dias = Math.round((hoy - dia) / 86400000);
  const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  if (dias <= 0) return `hoy ${hora}`;
  if (dias === 1) return `ayer ${hora}`;
  if (dias <= 30) return `hace ${dias} días`;
  return fecha.toLocaleDateString('es-AR');
};
const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '');

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }
  if (!Auth.isAdmin()) {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('buscar-usuario').addEventListener('input', renderLista);
  document.getElementById('btn-nuevo-usuario').addEventListener('click', () => abrirModal(null));
  document.querySelector('main').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-ver]');
    if (boton) verUsuario(Number(boton.dataset.ver));
  });
  document.getElementById('form-usuario').addEventListener('submit', guardarUsuario);
  document.getElementById('u-nombre').addEventListener('input', sugerirUsuario);
  document.getElementById('u-username').addEventListener('input', (evento) => {
    usernameTocado = evento.target.value.trim() !== '';
  });
  document.getElementById('btn-enviar-acceso').addEventListener('click', enviarAcceso);
  document.getElementById('btn-cambiar-estado').addEventListener('click', cambiarEstado);
  document.getElementById('btn-cancelar-usuario').addEventListener('click', cerrarModal);
  document.getElementById('modal-usuario-cerrar').addEventListener('click', cerrarModal);
  document.getElementById('usuario-pestanas').addEventListener('click', (evento) => {
    const pestana = evento.target.closest('[data-pestana]');
    if (pestana) mostrarPestana(pestana.dataset.pestana);
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && document.getElementById('modal-usuario').classList.contains('active')) cerrarModal();
  });

  cargarUsuarios();
});

// =====================================================
// LISTA
// =====================================================
async function cargarUsuarios() {
  try {
    ({ usuarios, resumen } = await API.getUsuarios());
    renderLista();
  } catch (error) {
    document.getElementById('lista-aprobadores').innerHTML = `<p class="lista-vacia">No se pudo cargar la lista: ${esc(error.message)}</p>`;
  }
}

const etiquetasDe = (u) => [
  `<span class="etiqueta rol-${esc(u.rol)}">${esc(TEXTO_ROL[u.rol] || u.rol)}</span>`,
  u.vinculo === 'contrato' ? '<span class="etiqueta etiqueta-contrato">Contrato</span>' : '',
  u.estado === 'invitacion_pendiente'
    ? `<span class="etiqueta etiqueta-pendiente" title="${esc(u.invitacion_vence ? `Vence ${fechaHora(u.invitacion_vence)}` : 'Sin link vigente: reenviá la invitación')}">Invitación pendiente</span>`
    : '',
  u.email_valido ? '' : '<span class="etiqueta etiqueta-sin-email">Sin email</span>'
].join('');

const filaUsuario = (u) => {
  const cargo = Utils.textoCargo(u.cargo, u.vinculo);
  const vinculo = u.vinculo && u.vinculo !== 'contrato' ? Utils.textoVinculo(u.vinculo) : '';
  return `
    <article class="fila-usuario${u.estado === 'desactivado' ? ' fila-desactivada' : ''}">
      <div class="usuario-avatar rol-${esc(u.rol)}" aria-hidden="true">${esc(getInitials(u.nombre_completo))}</div>
      <div class="usuario-datos">
        <div class="usuario-nombre"><strong>${esc(u.nombre_completo)}</strong>${etiquetasDe(u)}</div>
        <div class="usuario-detalle">
          <span class="usuario-username">${esc(u.username)}</span>
          ${cargo ? `<span>${esc(cargo)}</span>` : ''}
          ${vinculo ? `<span class="text-muted">${esc(vinculo)}</span>` : ''}
        </div>
        <div class="usuario-ingreso text-muted">Último ingreso: ${esc(textoIngreso(u.ultimo_ingreso))}</div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" data-ver="${esc(u.id)}" aria-label="Ver a ${esc(u.nombre_completo)}">Ver</button>
    </article>`;
};

const pintar = (id, lista, vacio) => {
  document.getElementById(id).innerHTML = lista.length > 0
    ? lista.map(filaUsuario).join('')
    : `<p class="lista-vacia">${esc(vacio)}</p>`;
};

// El superadmin primero; después, por nombre
const ordenAprobadores = (a, b) =>
  (b.rol === 'superadmin') - (a.rol === 'superadmin') || a.nombre_completo.localeCompare(b.nombre_completo, 'es');

function renderLista() {
  const texto = sinTildes(document.getElementById('buscar-usuario').value.trim());
  const coincide = (u) => !texto || [u.nombre_completo, u.username, u.cargo, u.email].some(v => sinTildes(v).includes(texto));
  const visibles = usuarios.filter(coincide);
  const vigentes = visibles.filter(u => u.estado !== 'desactivado');

  pintar('lista-aprobadores', vigentes.filter(esAprobador).sort(ordenAprobadores),
    texto ? 'Ningún aprobador coincide con la búsqueda.' : 'Todavía no hay aprobadores.');
  pintar('lista-lectores', vigentes.filter(u => !esAprobador(u)),
    texto ? 'Ningún usuario de solo lectura coincide con la búsqueda.' : 'No hay usuarios de solo lectura.');
  pintar('lista-desactivados', visibles.filter(u => u.estado === 'desactivado'), 'No hay usuarios desactivados.');

  const lectores = usuarios.filter(u => u.estado !== 'desactivado' && !esAprobador(u)).length;
  document.getElementById('contador-lectores').textContent = plural(lectores, 'activo', 'activos');
  document.getElementById('contador-desactivados').textContent = String(usuarios.filter(u => u.estado === 'desactivado').length);
  renderResumenAprobadores();
}

// Encabezado de aprobadores: iniciales de quienes pueden aprobar hoy y el contador contra el mínimo (spec 12.2)
function renderResumenAprobadores() {
  const activos = usuarios.filter(u => esAprobador(u) && u.estado === 'activo').sort(ordenAprobadores);
  const { aprobadores_activos: cantidad, minimo } = resumen;
  const contenedor = document.getElementById('aprobadores-resumen');
  const enElMinimo = cantidad <= minimo;
  contenedor.classList.toggle('en-el-minimo', enElMinimo);
  contenedor.title = enElMinimo ? 'No se puede sacar a ningún aprobador más: la doble verificación necesita al menos 2.' : '';
  contenedor.innerHTML = `
    <div class="aprobadores-iniciales" aria-hidden="true">
      ${activos.map(u => `<span class="usuario-avatar mini rol-${esc(u.rol)}" title="${esc(u.nombre_completo)}">${esc(getInitials(u.nombre_completo))}</span>`).join('')}
    </div>
    <span class="aprobadores-contador">${esc(plural(cantidad, 'activo', 'activos'))} (mínimo ${esc(minimo)})</span>`;
}

// =====================================================
// MODAL
// =====================================================
async function verUsuario(id) {
  try {
    abrirModal(await API.getUsuario(id));
  } catch (error) {
    avisar(error.message, 'error');
  }
}

function abrirModal(u) {
  abierto = u;
  usernameTocado = Boolean(u);
  limpiarErrores();
  const protegida = Boolean(u) && u.rol === 'superadmin' && !soyYo(u);
  const superadminPropio = Boolean(u) && u.rol === 'superadmin' && soyYo(u);

  document.getElementById('modal-usuario-titulo').textContent = u ? u.nombre_completo : 'Nuevo usuario';
  document.getElementById('modal-usuario-etiquetas').innerHTML = u ? etiquetasDe(u) : '';
  document.getElementById('usuario-pestanas').hidden = !u;
  document.getElementById('aviso-protegida').hidden = !protegida;

  escribir('u-nombre', u?.nombre_completo);
  escribir('u-username', u?.username);
  escribir('u-email', u?.email);
  escribir('u-cargo', u?.cargo);
  document.getElementById('u-vinculo').value = u?.vinculo || '';
  const selectRol = document.getElementById('u-rol');
  selectRol.querySelector('option[value="superadmin"]').hidden = !(u && u.rol === 'superadmin');
  selectRol.value = u?.rol || 'lector';

  for (const id of Object.values(CAMPO_A_INPUT)) document.getElementById(id).disabled = protegida;
  selectRol.disabled = protegida || superadminPropio;
  document.getElementById('acciones-form').hidden = protegida;
  document.getElementById('btn-guardar-usuario').textContent = u ? 'Guardar cambios' : 'Crear usuario';

  renderAcceso(u, { protegida, superadminPropio });
  renderHistorial(u?.historial || []);
  mostrarPestana('datos');
  document.getElementById('modal-usuario').classList.add('active');
  if (!protegida) document.getElementById('u-nombre').focus();
}

function cerrarModal() {
  document.getElementById('modal-usuario').classList.remove('active');
  abierto = null;
}

function mostrarPestana(nombre) {
  document.querySelectorAll('.usuario-pestana').forEach(boton => {
    const activa = boton.dataset.pestana === nombre;
    boton.classList.toggle('activa', activa);
    boton.setAttribute('aria-selected', String(activa));
  });
  document.getElementById('pestana-datos').hidden = nombre !== 'datos';
  document.getElementById('pestana-historial').hidden = nombre !== 'historial';
}

function renderAcceso(u, { protegida, superadminPropio }) {
  const bloque = document.getElementById('bloque-acceso');
  bloque.hidden = !u || protegida;
  if (!u || protegida) return;

  const detalle = [`Último ingreso: ${textoIngreso(u.ultimo_ingreso)}`];
  if (u.estado === 'invitacion_pendiente') {
    detalle.push(u.invitacion_vence ? `Invitación pendiente, vence ${fechaHora(u.invitacion_vence)}` : 'Invitación pendiente, sin link vigente');
  }
  if (u.estado === 'desactivado') detalle.push('Desactivado: no puede ingresar');
  document.getElementById('acceso-detalle').textContent = `${detalle.join('. ')}.`;

  const enviar = document.getElementById('btn-enviar-acceso');
  enviar.textContent = u.estado === 'invitacion_pendiente' ? 'Reenviar invitación' : 'Enviar link para restablecer la contraseña';
  enviar.disabled = u.estado === 'desactivado' || !u.email_valido;
  document.getElementById('acceso-nota').textContent = !u.email_valido
    ? 'No tiene un email válido: cargale uno y guardá antes de enviarle un link.'
    : u.estado === 'desactivado' ? 'Reactivalo para poder enviarle un link.' : '';

  const estado = document.getElementById('btn-cambiar-estado');
  estado.hidden = superadminPropio;
  estado.textContent = u.estado === 'desactivado' ? 'Reactivar' : 'Desactivar';
  estado.className = `btn ${u.estado === 'desactivado' ? 'btn-secondary' : 'btn-danger'}`;
}

function sugerirUsuario() {
  if (abierto || usernameTocado) return;
  escribir('u-username', Utils.sugerirUsername(leer('u-nombre'), usuarios.map(u => u.username)));
}

// =====================================================
// ACCIONES
// =====================================================
async function guardarUsuario(evento) {
  evento.preventDefault();
  limpiarErrores();
  const datos = {
    nombre_completo: leer('u-nombre'),
    username: leer('u-username'),
    email: leer('u-email'),
    cargo: leer('u-cargo'),
    vinculo: document.getElementById('u-vinculo').value || null
  };
  const selectRol = document.getElementById('u-rol');
  if (!selectRol.disabled) datos.rol = selectRol.value;

  // Confirmación al cambiar un rol, y en especial el propio (spec 8.5)
  if (abierto && datos.rol && datos.rol !== abierto.rol) {
    const texto = soyYo(abierto)
      ? 'Vas a perder el acceso de administrador en este momento. ¿Continuar?'
      : datos.rol === 'admin'
        ? `${abierto.nombre_completo} va a pasar a Admin: podrá proponer y aprobar cambios. ¿Continuar?`
        : `${abierto.nombre_completo} va a pasar a Lector: deja de poder proponer y aprobar cambios. ¿Continuar?`;
    if (!confirm(texto)) return;
  }

  const boton = document.getElementById('btn-guardar-usuario');
  boton.disabled = true;
  try {
    if (abierto) {
      const res = await API.actualizarUsuario(abierto.id, datos);
      avisar(res.message || 'Cambios guardados', 'success');
      if (soyYo(abierto) && datos.rol === 'lector') {
        window.location.href = 'index.html';
        return;
      }
    } else {
      const res = await API.crearUsuario(datos);
      avisar(res.message, res.data.email_enviado ? 'success' : 'warning');
    }
    cerrarModal();
    await cargarUsuarios();
  } catch (error) {
    mostrarError(error);
  } finally {
    boton.disabled = false;
  }
}

async function enviarAcceso() {
  const boton = document.getElementById('btn-enviar-acceso');
  boton.disabled = true;
  try {
    const res = await API.enviarAccesoUsuario(abierto.id);
    avisar(res.message, res.data.email_enviado ? 'success' : 'warning');
    await recargarAbierto();
  } catch (error) {
    mostrarError(error);
    boton.disabled = false;
  }
}

async function cambiarEstado() {
  const u = abierto;
  const desactivar = u.estado !== 'desactivado';
  if (desactivar) {
    const partes = [soyYo(u)
      ? 'Vas a desactivar tu propia cuenta y perder el acceso en este momento.'
      : `${u.nombre_completo} no va a poder ingresar al RPAD y se cerrarán sus sesiones.`];
    if (u.cambios_pendientes_propuestos > 0) {
      partes.push(`Tiene ${plural(u.cambios_pendientes_propuestos, 'cambio pendiente', 'cambios pendientes')} que otros admins todavía pueden aprobar o rechazar.`);
    }
    if (!confirm(`${partes.join('\n\n')}\n\n¿Desactivar?`)) return;
  }
  try {
    const res = desactivar ? await API.desactivarUsuario(u.id) : await API.reactivarUsuario(u.id);
    avisar(res.message, 'success');
    if (desactivar && soyYo(u)) {
      Auth.logout();
      return;
    }
    await recargarAbierto();
  } catch (error) {
    mostrarError(error);
  }
}

async function recargarAbierto() {
  const id = abierto?.id;
  await cargarUsuarios();
  if (id) abrirModal(await API.getUsuario(id));
}

// =====================================================
// ERRORES E HISTORIAL
// =====================================================
function limpiarErrores() {
  document.getElementById('usuario-error').hidden = true;
  document.querySelectorAll('#form-usuario .campo-error').forEach(nodo => nodo.remove());
  document.querySelectorAll('#form-usuario [aria-invalid]').forEach(nodo => {
    nodo.removeAttribute('aria-invalid');
    nodo.removeAttribute('aria-describedby');
  });
}

// Con campo, el mensaje va debajo del input; si no, arriba del formulario
function mostrarError(error) {
  const input = error.campo && document.getElementById(CAMPO_A_INPUT[error.campo]);
  if (input) {
    const mensaje = document.createElement('p');
    mensaje.className = 'campo-error';
    mensaje.id = `${input.id}-error`;
    mensaje.textContent = error.message;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', mensaje.id);
    input.insertAdjacentElement('afterend', mensaje);
    mostrarPestana('datos');
    input.focus();
    return;
  }
  const caja = document.getElementById('usuario-error');
  caja.textContent = error.message;
  caja.hidden = false;
}

const textoValor = (campo, valor) => {
  if (valor === null || valor === '') return '(vacío)';
  return campo === 'vinculo' ? Utils.textoVinculo(valor) : valor;
};

function describirDetalle({ accion, detalle }) {
  const d = detalle || {};
  if (accion === 'alta') return `Rol inicial: ${TEXTO_ROL[d.rol] || d.rol}`;
  if (accion === 'cambio_rol') return `${TEXTO_ROL[d.antes] || d.antes} → ${TEXTO_ROL[d.despues] || d.despues}`;
  if (d.campos) {
    return Object.entries(d.campos)
      .map(([campo, cambio]) => `${NOMBRE_CAMPO[campo] || campo}: ${textoValor(campo, cambio.antes)} → ${textoValor(campo, cambio.despues)}`)
      .join('; ');
  }
  if (accion === 'desactivacion' && d.cambios_pendientes) {
    return `Tenía ${plural(d.cambios_pendientes, 'cambio pendiente', 'cambios pendientes')}`;
  }
  if ('email_enviado' in d) return d.email_enviado ? 'Email enviado' : `No se pudo enviar el email${d.error ? `: ${d.error}` : ''}`;
  return '';
}

function renderHistorial(historial) {
  const lista = document.getElementById('historial-usuario');
  if (historial.length === 0) {
    lista.innerHTML = '<li class="text-muted">Sin movimientos registrados.</li>';
    return;
  }
  lista.innerHTML = historial.map(h => {
    const detalle = describirDetalle(h);
    const quien = h.actor_id ? `${h.actor_nombre} (${h.actor_username})` : 'Pedido desde la pantalla de ingreso';
    return `
      <li>
        <div class="historial-cabecera"><strong>${esc(TEXTO_ACCION[h.accion] || h.accion)}</strong><time datetime="${esc(h.created_at)}">${esc(fechaHora(h.created_at))}</time></div>
        <div class="text-muted">${esc(quien)}</div>
        ${detalle ? `<div>${esc(detalle)}</div>` : ''}
      </li>`;
  }).join('');
}
```

- [ ] **Step 4: Verificar la sintaxis y los tests estáticos**

Run: `node --check public/js/usuarios.js && node --test tests/paginas.test.js`
Expected: sin errores de sintaxis; `paginas.test.js` en verde, incluido `usuarios.html`.

- [ ] **Step 5: Probar la pantalla en el navegador** (local, contra Docker)

1. Crear `.claude/launch.json` (no versionado) si no existe:
   ```json
   { "version": "0.0.1", "configurations": [ { "name": "rpad", "runtimeExecutable": "node", "runtimeArgs": ["app.js"], "port": 3001 } ] }
   ```
2. Levantar con `preview_start` (`name: "rpad"`).
3. Crear un admin de prueba local, `[TEST] Panel`, con una contraseña conocida (`TestPanel2026!`):
   ```bash
   RP=$(grep '^DB_ROOT_PASSWORD=' .env | cut -d= -f2); DBN=$(grep '^DB_NAME=' .env | cut -d= -f2)
   HASH=$(node -e "console.log(require('bcryptjs').hashSync('TestPanel2026!', 10))")
   docker exec -i -e MYSQL_PWD="$RP" rpad-db mariadb -uroot "$DBN" -e "INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol) VALUES ('TESTPANEL', '$HASH', '[TEST] Panel', 'testpanel@rpad.test', 'admin')"
   ```
4. Entrar con `TESTPANEL` y abrir `usuarios.html`. Verificar con `read_page` y una captura:
   - los dos grupos y el contador de aprobadores;
   - el modal Ver con sus pestañas Datos e Historial;
   - el alta, con la sugerencia de usuario mientras se escribe el nombre;
   - los errores debajo del campo (por ejemplo, un email inválido);
   - una cuenta superadmin en solo lectura (si la base local ya la tiene; si no, se ve en la Task 8);
   - el ancho de móvil (`resize_window` con `preset: "mobile"`), y después volver a `desktop`.
5. No dejar datos: borrar al usuario de prueba y lo que haya creado (todo lo de prueba lleva `@rpad.test`).
   ```bash
   docker exec -i -e MYSQL_PWD="$RP" rpad-db mariadb -uroot "$DBN" -e "DELETE a FROM usuarios_auditoria a JOIN usuarios u ON u.id = a.usuario_id WHERE u.email LIKE '%@rpad.test'; DELETE t FROM usuarios_tokens t JOIN usuarios u ON u.id = t.usuario_id WHERE u.email LIKE '%@rpad.test'; DELETE FROM usuarios WHERE email LIKE '%@rpad.test';"
   ```

Expected: todo se ve y funciona como describe la spec 12.2; la consola del navegador no muestra errores (`read_console_messages` con `onlyErrors: true`).

- [ ] **Step 6: Suite completa contra la línea de base**

Run: `npm test 2>&1 | tee .claude/task6.txt | tail -12`
Expected: ninguna falla nueva.

- [ ] **Step 7: Commit**

```bash
git add public/usuarios.html public/js/usuarios.js
git commit -m "feat: pantalla del panel de usuarios agrupada por rol, con alta, edición, acceso e historial

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 7: Elegir contraseña y "¿Olvidaste tu contraseña?" en el login

**Files:**
- Create: `public/establecer-contrasena.html`
- Create: `public/js/establecer-contrasena.js`
- Modify: `public/login.html`

**Interfaces:**
- Consumes: `POST /auth/link/validar`, `POST /auth/establecer-contrasena` y `POST /auth/recuperar` (Task 3), `CONFIG.API_URL`.

- [ ] **Step 1: Escribir `public/establecer-contrasena.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex">
    <meta name="referrer" content="no-referrer">
    <title>RPAD - Elegir contraseña</title>
    <link rel="icon" type="image/png" href="img/icon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #1f2937; background: #f9fafb; min-height: 100vh; }
        .pagina { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem 1rem; }
        .tarjeta { width: 100%; max-width: 440px; background: #fff; border-radius: 12px; box-shadow: 0 10px 25px rgba(26, 54, 93, 0.08); overflow: hidden; }
        .tarjeta-cabecera { background: linear-gradient(135deg, #1a365d 0%, #2a5a8a 50%, #3182ce 100%); color: #fff; padding: 1.5rem 2rem; }
        .tarjeta-cabecera strong { font-size: 1.5rem; letter-spacing: -0.02em; }
        .tarjeta-cabecera p { opacity: 0.85; font-size: 0.875rem; }
        .tarjeta-cuerpo { padding: 2rem; }
        h1 { font-size: 1.375rem; font-weight: 700; color: #111827; margin-bottom: 0.25rem; }
        .subtitulo { color: #6b7280; margin-bottom: 1.5rem; }
        .form-group { margin-bottom: 1.25rem; }
        .form-label { display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.5rem; }
        .form-control { width: 100%; padding: 0.75rem 1rem; font: inherit; border: 1px solid #d1d5db; border-radius: 0.5rem; background: #fff; color: #1f2937; }
        .form-control:focus { outline: none; border-color: #3182ce; box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.15); }
        .ayuda { font-size: 0.8rem; color: #6b7280; margin-top: 0.375rem; }
        .btn { width: 100%; display: inline-flex; justify-content: center; padding: 0.75rem 1.5rem; font: inherit; font-weight: 500; border: none; border-radius: 0.5rem; cursor: pointer; background: linear-gradient(135deg, #1a365d 0%, #2a5a8a 100%); color: #fff; }
        .btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .btn:focus-visible, a:focus-visible { outline: 2px solid #3182ce; outline-offset: 2px; }
        .alert { padding: 0.875rem 1rem; border-radius: 0.5rem; margin-bottom: 1.25rem; font-size: 0.875rem; }
        .alert-danger { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .alert-warning { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
        .alert-success { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
        .pie { margin-top: 1.5rem; text-align: center; font-size: 0.875rem; }
        .pie a { color: #2a5a8a; }
    </style>
</head>
<body>
    <div class="pagina">
        <main class="tarjeta">
            <div class="tarjeta-cabecera">
                <strong>RPAD</strong>
                <p>Registro Permanente de Actualización de Datasets</p>
            </div>
            <div class="tarjeta-cuerpo">
                <section id="seccion-cargando">
                    <p class="subtitulo">Verificando el link…</p>
                </section>

                <section id="seccion-elegir" hidden>
                    <h1 id="saludo">Elegí tu contraseña</h1>
                    <p class="subtitulo" id="subtitulo-elegir"></p>
                    <div id="alerta-elegir" class="alert alert-danger" role="alert" hidden></div>
                    <form id="form-elegir" novalidate>
                        <div class="form-group">
                            <label class="form-label" for="password">Contraseña nueva</label>
                            <input type="password" id="password" class="form-control" autocomplete="new-password" minlength="8" required aria-describedby="ayuda-password">
                            <p class="ayuda" id="ayuda-password">Al menos 8 caracteres.</p>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="password-repetir">Repetí la contraseña</label>
                            <input type="password" id="password-repetir" class="form-control" autocomplete="new-password" required>
                        </div>
                        <button type="submit" class="btn" id="btn-guardar">Guardar contraseña</button>
                    </form>
                </section>

                <section id="seccion-pedir" hidden>
                    <h1>¿Olvidaste tu contraseña?</h1>
                    <p class="subtitulo">Escribí tu usuario o tu email y te enviamos un link para elegir una nueva.</p>
                    <div id="alerta-pedir" class="alert alert-warning" role="alert" hidden></div>
                    <form id="form-pedir" novalidate>
                        <div class="form-group">
                            <label class="form-label" for="identificador">Usuario o email</label>
                            <input type="text" id="identificador" class="form-control" autocomplete="username" maxlength="100" required>
                        </div>
                        <button type="submit" class="btn" id="btn-pedir">Enviar link</button>
                    </form>
                </section>

                <section id="seccion-enviado" hidden>
                    <h1>Revisá tu correo</h1>
                    <div class="alert alert-success" role="status" id="texto-enviado"></div>
                </section>

                <p class="pie"><a href="login.html">Volver al ingreso</a></p>
            </div>
        </main>
    </div>

    <script src="js/config.js"></script>
    <script src="js/establecer-contrasena.js?v=20261016"></script>
</body>
</html>
```

- [ ] **Step 2: Escribir `public/js/establecer-contrasena.js`**

```js
// Elegir contraseña con un link de acceso, o pedir uno nuevo (spec 12.3).
// El token llega en el fragmento (#token=…), que no se envía al servidor, y se manda en el body de un POST.
const MENSAJE_MOTIVO = {
  vencido: 'El link venció. Pedí uno nuevo con tu usuario o tu email.',
  usado: 'Este link ya se usó. Si necesitás otro, pedilo con tu usuario o tu email.',
  invalido: 'El link no es válido. Pedí uno nuevo con tu usuario o tu email.'
};
const SECCIONES = ['seccion-cargando', 'seccion-elegir', 'seccion-pedir', 'seccion-enviado'];
let token = null;

const mostrar = (id) => SECCIONES.forEach(seccion => { document.getElementById(seccion).hidden = seccion !== id; });

const alerta = (id, texto) => {
  const caja = document.getElementById(id);
  caja.textContent = texto || '';
  caja.hidden = !texto;
};

const postJson = async (ruta, body) => {
  const response = await fetch(`${CONFIG.API_URL}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
};

const mostrarPedir = (motivo) => {
  alerta('alerta-pedir', motivo);
  mostrar('seccion-pedir');
  document.getElementById('identificador').focus();
};

document.addEventListener('DOMContentLoaded', async () => {
  token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  // El token no queda en la barra de direcciones ni en el historial del navegador
  if (window.location.hash) history.replaceState(null, '', window.location.pathname);

  document.getElementById('form-elegir').addEventListener('submit', guardarContrasena);
  document.getElementById('form-pedir').addEventListener('submit', pedirLink);

  if (!token) {
    mostrarPedir('');
    return;
  }
  try {
    const { ok, status, data } = await postJson('/auth/link/validar', { token });
    if (!ok) {
      mostrarPedir(status === 429 ? data.error : 'No pudimos verificar el link. Probá de nuevo en unos minutos.');
      return;
    }
    if (!data.data.valido) {
      mostrarPedir(MENSAJE_MOTIVO[data.data.motivo] || MENSAJE_MOTIVO.invalido);
      return;
    }
    document.getElementById('saludo').textContent = `Hola, ${data.data.nombre_completo}.`;
    document.getElementById('subtitulo-elegir').textContent = `Elegí tu contraseña para el usuario ${data.data.username}.`;
    mostrar('seccion-elegir');
    document.getElementById('password').focus();
  } catch {
    mostrarPedir('No hay conexión con el servidor. Probá de nuevo en unos minutos.');
  }
});

async function guardarContrasena(evento) {
  evento.preventDefault();
  const password = document.getElementById('password').value;
  const repetir = document.getElementById('password-repetir').value;
  alerta('alerta-elegir', '');
  if (password.length < 8) return alerta('alerta-elegir', 'La contraseña debe tener al menos 8 caracteres.');
  if (password !== repetir) return alerta('alerta-elegir', 'Las contraseñas no coinciden.');

  const boton = document.getElementById('btn-guardar');
  boton.disabled = true;
  try {
    const { ok, data } = await postJson('/auth/establecer-contrasena', { token, password });
    if (ok) {
      window.location.href = 'login.html?contrasena=ok';
      return;
    }
    if (data.motivo) {
      mostrarPedir(MENSAJE_MOTIVO[data.motivo]);
      return;
    }
    alerta('alerta-elegir', data.error || 'No se pudo guardar la contraseña.');
  } catch {
    alerta('alerta-elegir', 'No hay conexión con el servidor. Probá de nuevo.');
  } finally {
    boton.disabled = false;
  }
}

async function pedirLink(evento) {
  evento.preventDefault();
  const identificador = document.getElementById('identificador').value.trim();
  if (!identificador) return alerta('alerta-pedir', 'Escribí tu usuario o tu email.');

  const boton = document.getElementById('btn-pedir');
  boton.disabled = true;
  try {
    const { ok, data } = await postJson('/auth/recuperar', { identificador });
    if (!ok) return alerta('alerta-pedir', data.error || 'No se pudo enviar el pedido.');
    document.getElementById('texto-enviado').textContent = data.message;
    mostrar('seccion-enviado');
  } catch {
    alerta('alerta-pedir', 'No hay conexión con el servidor. Probá de nuevo.');
  } finally {
    boton.disabled = false;
  }
}
```

- [ ] **Step 3: `public/login.html`**

(a) En el `<style>`, después de `.alert-danger {…}`:

```css
        .alert-success {
            background: #ecfdf5;
            color: #047857;
            border: 1px solid #a7f3d0;
        }

        .login-olvido {
            text-align: right;
            margin: -0.5rem 0 1rem;
            font-size: 0.875rem;
        }

        .login-olvido a {
            color: #2a5a8a;
        }
```

(b) Antes de `<div id="alertError" …>`:

```html
                <div id="alertExito" class="alert alert-success" role="status" style="display: none;">
                    <span>Tu contraseña quedó guardada. Ya podés ingresar.</span>
                </div>
```

(c) Entre el `form-group` de la contraseña y el botón `btnLogin`:

```html
                    <div class="login-olvido">
                        <a href="establecer-contrasena.html">¿Olvidaste tu contraseña?</a>
                    </div>
```

(d) Dentro del `DOMContentLoaded` del script inline, después del `if (Auth.isAuthenticated()) {…}`:

```js
            // Llegó desde "Elegir contraseña": se avisa y se limpia la URL
            if (new URLSearchParams(window.location.search).get('contrasena') === 'ok') {
                document.getElementById('alertExito').style.display = 'flex';
                history.replaceState(null, '', 'login.html');
            }
```

- [ ] **Step 4: Verificar la sintaxis**

Run: `node --check public/js/establecer-contrasena.js && node --test tests/paginas.test.js`
Expected: sin errores.

- [ ] **Step 5: Probar los flujos en el navegador** (servidor local de la Task 6, emails en Mailpit)

1. Crear un lector de prueba local con email `testlink@rpad.test` (mismo INSERT que en la Task 6, Step 5.3, con rol `lector` y username `TESTLINK`).
2. `login.html`: hacer clic en "¿Olvidaste tu contraseña?", escribir `TESTLINK` y verificar el mensaje genérico.
3. Leer el email en Mailpit:
   ```bash
   curl -s http://localhost:8025/api/v1/messages | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const m=JSON.parse(s).messages.find(x=>x.To.some(t=>t.Address==='testlink@rpad.test'));console.log(m.ID, m.Subject)})"
   ```
   y abrir el link (`http://localhost:3001/establecer-contrasena.html#token=…`) en el navegador.
4. Verificar:
   - que la barra de direcciones queda sin `#token`;
   - el saludo con nombre y usuario;
   - los errores "menos de 8" y "no coinciden".
5. Guardar y verificar:
   - la redirección a `login.html` con el mensaje verde;
   - el ingreso con la contraseña nueva;
   - que abrir el mismo link otra vez muestra "Este link ya se usó…".
6. Abrir `establecer-contrasena.html#token=inventado`: tiene que mostrar "El link no es válido…".
7. Ancho de móvil (`preset: "mobile"`) en las dos páginas, y volver a `desktop`.
8. Limpiar con el `DELETE` de la Task 6, Step 5.5.

Expected: cada paso como se describe, sin errores en la consola.

- [ ] **Step 6: Suite completa contra la línea de base**

Run: `npm test 2>&1 | tee .claude/task7.txt | tail -12`
Expected: ninguna falla nueva.

- [ ] **Step 7: Commit**

```bash
git add public/establecer-contrasena.html public/js/establecer-contrasena.js public/login.html
git commit -m "feat: pantalla para elegir contraseña con un link y enlace a ¿Olvidaste tu contraseña? en el ingreso

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 8: Documentación, ensayo del deploy y verificación final

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md` (Roles de Usuario, migración nueva, Changelog)

- [ ] **Step 1: `CLAUDE.md`**

(a) En `## Comandos`, agregar:

```markdown
- `npm test` — Tests de integración: requieren `docker compose up -d` (MariaDB + Mailpit) y `RPAD_TESTS_DB_LOCAL=1` en el `.env` local
```

(b) Reemplazar la sección `### Roles` por:

```markdown
### Roles
- **superadmin:** todo lo de admin. Su cuenta solo la modifica su titular y recibe un aviso cuando otro admin crea un admin, cambia un rol o desactiva a alguien. Se asigna por SQL, nunca desde la aplicación.
- **admin:** CRUD datasets (con doble verificación), áreas, panel de usuarios, aprobación de cambios, reportes, notificaciones
- **lector:** solo lectura de datos públicos + perfil
- El rol y el estado activo se leen de la base en cada pedido (`authMiddleware`): desactivar o cambiar un rol tiene efecto inmediato. `esAdmin(rol)` (services/usuariosReglas.js) y `Auth.isAdmin()` incluyen al superadmin: no comparar con `'admin'` a mano.
- Siempre tiene que haber al menos 2 aprobadores activos (admin o superadmin): el panel no deja bajar de ese mínimo.
```

(c) En `### Base de datos`, reemplazar la línea `- 10 tablas: …` por:

```markdown
- 21 tablas (ver `database/schema.sql`). Usuarios: `usuarios` (rol, cargo, vínculo, `sesion_version`), `usuarios_tokens` (links de acceso, solo el hash) y `usuarios_auditoria` (historial del panel)
```

(d) En `## Variables de entorno requeridas`, agregar dentro del bloque:

```
APP_URL (links de los emails; por defecto la URL de producción)
EMAIL_SOLO_A, RPAD_TESTS_DB_LOCAL, DB_ROOT_PASSWORD (solo desarrollo local)
```

(e) Al final, una sección nueva:

```markdown
## Despliegue (producción)
- cPanel sin terminal: el SQL se corre en phpMyAdmin (pestaña SQL o Importar), los archivos se suben con el Administrador de archivos, y las variables de entorno, "Run NPM Install" y Restart se manejan en Setup Node.js App. El cron se configura en Tareas Cron.
- Las migraciones van antes que el código. Las cargas de datos de personas (roles, cargos) van en `database/privado/` (no versionado) y se corren después del código.
- Regla del proyecto: no romper nada de lo implementado. Correr `npm test` completo antes y después de cada cambio.
```

- [ ] **Step 2: `README.md`**

(a) Reemplazar la sección `## Roles de Usuario` (desde el título hasta antes de `## Campo "Qué se solicita"`) por:

```markdown
## Roles de Usuario

El sistema cuenta con tres roles de usuario:

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| `superadmin` | Administrador con la cuenta protegida | Todo lo de `admin`. Su cuenta solo la modifica su titular. Recibe un email cuando otro admin crea un admin, cambia un rol o desactiva a alguien. Se asigna por SQL, no desde la aplicación. |
| `admin` | Administrador completo | Proponer creación, edición y eliminación de datasets. Aprobar o rechazar cambios propuestos por otro admin. Gestionar áreas y usuarios. Configurar notificaciones SMTP. Generar reportes y notas. |
| `lector` | Solo lectura | Ver todas las secciones (tablero, calendario, datasets, reportes, notas) sin poder modificar datos. |

Los cambios sobre datasets requieren doble verificación: un admin (o el superadmin) propone y otro distinto aprueba o rechaza. Los usuarios con rol `lector` ven el mensaje "Solo lectura" en lugar de los botones de acción.

### Panel de usuarios

En **Administración → Usuarios**, admin y superadmin pueden:

- **Crear usuarios.** El usuario nuevo recibe un email con un link para elegir su contraseña (vence en 72 h). Nadie ve ni envía contraseñas.
- **Editar** nombre, usuario, email, cargo, vínculo (planta permanente, planta política o contrato) y rol (admin o lector).
- **Desactivar y reactivar.** Desactivar cierra las sesiones de esa persona en el acto. Los usuarios nunca se borran.
- **Enviar un link para restablecer la contraseña** (vence en 2 h), o reenviar la invitación.
- **Ver el historial** de cambios de cada usuario.

Siempre tiene que haber al menos **2 usuarios que puedan aprobar cambios**: el panel no deja desactivar ni pasar a lector a un admin si quedarían menos. Cualquier usuario puede pedir un link nuevo desde **"¿Olvidaste tu contraseña?"** en la pantalla de ingreso.
```

(b) Antes de `### Migración: Notas Digitales`, agregar:

```markdown
### Migración: Usuarios (superadmin y panel de usuarios)

⚠️ Requisito: las migraciones anteriores aplicadas. No hay dependencias nuevas de npm.

Secuencia de despliegue, **en este orden** (todo desde cPanel):

1. **Backup de la base:** phpMyAdmin → base del RPAD → **Exportar** (método rápido, formato SQL). Guardar el archivo.
2. **Backup de los archivos:** Administrador de archivos → carpeta de la app → seleccionar `controllers`, `middleware`, `routes`, `services`, `scripts` y `public` → **Comprimir** → descargar el zip.
3. **Migración de estructura:** phpMyAdmin → base del RPAD → pestaña **SQL** → pegar el contenido de `database/updates/migracion-usuarios-superadmin.sql` → **Continuar**. Solo agrega columnas y tablas, y el código actual sigue funcionando con la estructura nueva: si los pasos siguientes se demoran, no pasa nada.
4. **Subir los archivos** con el Administrador de archivos, reemplazando los existentes. La lista exacta está en el pedido de despliegue (`git diff --name-only` contra la versión anterior, sin `tests/`, `docs/` ni `database/`).
5. **Setup Node.js App** → la app del RPAD → **Environment variables** → agregar `APP_URL` = `https://rpad.mcrmodernizacion.gob.ar` → **Save**. Después, **Restart**.
6. **Datos de usuarios:** phpMyAdmin → pestaña **SQL** → pegar el contenido de `database/privado/usuarios-superadmin-datos.sql`. Ese archivo no está en el repositorio: lo tiene el Director de Datos Públicos y Comunicación. Tiene que ir **después** del Restart: el código anterior no conoce el rol superadmin. El `SELECT` final muestra los usuarios con su rol, cargo y vínculo para revisar.
7. **Verificar:**
   - el superadmin ve "Superadmin" en el header;
   - Administración → Usuarios muestra a todos con su cargo;
   - "Nuevo usuario" con una casilla propia de prueba: la invitación llega y el link funciona;
   - desactivar ese usuario de prueba.

**Si algo sale mal:** subir de nuevo los archivos del backup del paso 2 → Restart → phpMyAdmin → pestaña SQL → pegar `database/updates/rollback-usuarios-superadmin.sql`. El rollback deja la estructura exactamente como estaba; se pierden los cargos, vínculos e historial de usuarios.
```

(c) En `## Changelog`, antes de `### v1.5.0 (2026-02-06)`:

```markdown
### Usuarios y superadmin (2026-10)
- Rol `superadmin`, con la cuenta protegida y avisos por email de cambios hechos por otros admins
- Panel de usuarios: alta, edición, cargo y vínculo, roles, activación, links de acceso e historial
- Contraseñas por link de un solo uso (invitación y recuperación) y "¿Olvidaste tu contraseña?"
- Desactivar a alguien o cambiarle el rol tiene efecto inmediato
- Mínimo de 2 aprobadores activos para la doble verificación
```

- [ ] **Step 3: Ensayo del deploy en local, en el mismo orden que en producción**

La migración de estructura ya está aplicada (Task 1) y el código nuevo está en la rama. Falta el paso 6: correr el SQL privado sobre la base local y revisar la salida del `SELECT` final.

```bash
RP=$(grep '^DB_ROOT_PASSWORD=' .env | cut -d= -f2); DBN=$(grep '^DB_NAME=' .env | cut -d= -f2)
docker exec -i -e MYSQL_PWD="$RP" rpad-db mariadb -uroot --default-character-set=utf8mb4 "$DBN" < database/privado/usuarios-superadmin-datos.sql
```

Expected: el `SELECT` lista a los 9 usuarios, con 1 solo superadmin y todos con su cargo y vínculo.

- [ ] **Step 4: Recorrido final en el navegador como el superadmin** (servidor local, emails en Mailpit)

1. `login.html` → "¿Olvidaste tu contraseña?" → el usuario de la cuenta superadmin (el del SQL privado) → leer el link en Mailpit (como en la Task 7, Step 5.3) → elegir una contraseña **solo para la base local**.
2. Ingresar y verificar:
   - el header dice "Superadmin";
   - el menú tiene Usuarios;
   - el panel muestra los grupos con los usuarios reales, "Cumple funciones de … (sin designación formal)" en los de contrato y "Sin email" donde corresponde.
3. Abrir un admin y verificar que el superadmin puede editar su cargo (y que no se guarda nada si se cancela).
4. Desde **otra sesión** (ventana privada con el admin de prueba de la Task 6), abrir la cuenta superadmin: tiene que estar en solo lectura con "Esta cuenta solo la modifica su titular."
5. Recorrer las páginas existentes (Tablero, Datasets, Gestión de Datasets, Áreas, Correos, Reportes, Notas, Gestión, Mi Perfil) con el superadmin. Tienen que funcionar igual que antes, sin errores en la consola. Con el admin de prueba, aprobar un cambio de prueba propuesto por el superadmin y verificar que el superadmin no pueda aprobar el suyo.
6. Limpiar: el `DELETE` de la Task 6, Step 5.5, y los datasets de prueba que se hayan creado.

- [ ] **Step 5: Suite completa final contra la línea de base**

Run: `npm test 2>&1 | tee .claude/final.txt | tail -12`
Expected: todos los tests nuevos en verde y ninguna falla nueva respecto de `.claude/linea-de-base.txt`.

- [ ] **Step 6: Lista de archivos para subir a producción**

```bash
git diff --name-only main...HEAD -- . ':!tests' ':!docs' ':!database' ':!CLAUDE.md' ':!README.md' ':!.env.example' ':!.gitignore'
```

Expected: los archivos de `controllers/`, `middleware/`, `routes/`, `services/`, `scripts/` y `public/`. Guardar esta lista para el pedido de despliegue al usuario.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: roles, panel de usuarios y despliegue por cPanel de la migración de usuarios

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
