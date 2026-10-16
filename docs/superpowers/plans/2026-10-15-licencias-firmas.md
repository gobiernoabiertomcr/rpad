# Entrega 2: licencias, firmas por persona y notas durante la licencia del firmante — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Licencias para quienes reciben avisos (sin emails personales durante la licencia), firma propia de cada persona en Mi Perfil y un firmante titular de las Notas Digitales. Durante su licencia, los avisos se anticipan a la víspera. Si autorizó a alguien, esa nota (o una nota de autorización) lo comunica formalmente y la persona autorizada presenta las demás notas con las dos firmas, citando ese número. Sin autorizado, las reiteraciones se postergan a la vuelta. **Sin romper nada de lo que hoy funciona.**

**Architecture:** Dos tablas nuevas (`usuarios_licencias`, `usuarios_firmas`) y columnas aditivas. Las reglas puras de licencias van en `services/licenciasReglas.js` y las lecturas en `services/licenciasService.js`. Los avisos al superadmin salen del controlador del panel a `services/avisosSuperadminService.js`, que los retiene durante la licencia y manda un resumen a la vuelta. `services/notasDigitalesFirmas.js` decide, para cada fecha, cómo se firman las notas (`firmaParaFecha`) y si hoy es la víspera de una licencia sin autorizado (`anticipoPorLicencia`). El motor de Notas Digitales usa esas dos funciones; el contenido y el PDF aprenden a dibujar dos firmas con la leyenda. **Sin firmante titular elegido todo funciona exactamente como hoy.**

**Tech Stack:** Node 22 en producción (24 en desarrollo), Express 4, ES Modules, MariaDB 10.11 (mysql2/promise), PDFKit, Nodemailer, frontend vanilla JS, `node:test` contra Docker (MariaDB + Mailpit).

**Spec:** `docs/superpowers/specs/2026-10-15-dias-habiles-licencias-auditoria-design.md`, secciones 5, 6, 7, 11.1, 12 (entrega 2) y 13. Los números de sección que se citan ("spec 7.3") son de esa spec.

## Global Constraints

- **Regla principal del usuario: no romper nada de lo implementado.** Antes de empezar se guarda una línea de base de `npm test` (Task 0). **Cada tarea termina corriendo la suite completa** y comparándola con la línea de base: no puede aparecer ninguna falla nueva. Si una falla existía en la línea de base, se informa y no se toca.
- **Requisito:** la entrega 1 (`docs/superpowers/plans/2026-10-15-dias-habiles.md`) ya está mergeada en `main`. Este plan usa `services/avisosDiariosService.js` y `rangoDeAviso`.
- Se trabaja en la rama `feat/licencias-firmas`, nunca en `main`.
- Node 22 en producción: no usar APIs que no existan en Node 22. ES Modules, `async/await`, arrow functions, español en nombres, comentarios y textos.
- SQL siempre parametrizado con `?`. Los nombres de columna solo pueden salir de listas fijas del código. Las fechas `DATE` se leen siempre con `DATE_FORMAT(..., '%Y-%m-%d')` (mysql2 las devuelve como `Date` en hora local).
- Respuestas de la API: `{ success, data?, error?, message? }`; los errores de validación suman `campo`. **Compatibilidad:** las respuestas existentes solo suman campos.
- **Hoy** es siempre `hoyArgentina()`; los servicios reciben `hoy` como parámetro para poder probarlos con fechas fijas. Una fecha y hora para guardar (por ejemplo, `autorizado_at`) se escribe con `ahoraArgentina()`, nunca con `NOW()` (la base puede estar en UTC).
- **Sin firmante titular elegido** (`notas_digitales_config.firmante_usuario_id` vacío), las Notas Digitales salen con la firma de Correos y ninguna licencia las afecta (spec 6.2). Es el estado de la base local y de producción hasta correr el SQL privado.
- **El repositorio es público:** ningún nombre de persona, email personal ni dato de `database/privado/`. Los tests usan datos inventados con dominio `@rpad.test`. `database/privado/licencias-firmas-datos.sql` ya existe (se creó al planificar, está en `.gitignore`): no se edita ni se versiona.
- **Antes de correr cualquier test:** `grep -E '^(SMTP_HOST|SMTP_PORT|RPAD_TESTS_DB_LOCAL|DB_HOST)=' .env` tiene que mostrar `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`, `RPAD_TESTS_DB_LOCAL=1` y `DB_HOST=127.0.0.1`. Si no, no se corre nada.
- **Los tests nuevos que escriben datos usan bases de prueba propias** (`crearBaseDePrueba('rpad_test_…')`), nunca la copia local de producción (tiene el envío automático de notas activo).
- **Acceso a la base local de Docker** (en bash, desde la raíz del repo):
  ```bash
  RP=$(grep '^DB_ROOT_PASSWORD=' .env | cut -d= -f2); DBN=$(grep '^DB_NAME=' .env | cut -d= -f2)
  mdb() { docker exec -i -e MYSQL_PWD="$RP" rpad-db mariadb -uroot --default-character-set=utf8mb4 "$@"; }
  ```
- **Deploy sin terminal:** SQL en phpMyAdmin, archivos con el Administrador de archivos, Restart en Setup Node.js App. **No se agregan dependencias de npm.** Todo SQL nuevo se puede pegar tal cual en phpMyAdmin (sin `DELIMITER` ni `USE`) y se puede volver a correr si se cortó a mitad.
- **Frontend:** vanilla JS; todo dato pasa por `Utils.escapeHtml`; delegación de eventos con `data-*`, sin `onclick` inline con datos. `api.js` cambia, así que **todas** las páginas pasan a cargar `auth.js`, `main.js` y `api.js` con `?v=20261021` (y `VERSION` de `tests/paginas.test.js` también); `usuarios.js`, `perfil.js` y `correos.js` también pasan a `?v=20261021`.
- **Textos exactos:**
  - Leyenda (spec 7.2): `Nota presentada por {nombre del autorizado}, {cargo del autorizado}, en nombre de {nombre del titular}, {cargo del titular}, conforme a la autorización conferida mediante Nota Digital N° {n}/{aa} (licencia del {dd/mm/aaaa} al {dd/mm/aaaa}).`
  - Párrafo de los avisos de la víspera: `Asimismo, por medio de la presente autorizo expresamente a {nombre}, {cargo}, a presentar en mi nombre las Notas Digitales durante mi licencia, del {dd/mm/aaaa} al {dd/mm/aaaa}, con el objetivo de mantener el correcto flujo de trabajo.`
  - Nota de autorización: `Por medio de la presente informo que, durante mi licencia del {dd/mm/aaaa} al {dd/mm/aaaa}, autorizo expresamente a {nombre}, {cargo}, a presentar en mi nombre las Notas Digitales de esta Dirección, con el objetivo de mantener el correcto flujo de trabajo.`; asunto `Nota Digital N° {n}/{aa} – Ref.: Autorización para la presentación de Notas Digitales (licencia del {dd/mm/aaaa} al {dd/mm/aaaa})`.
  - Asunto de un aviso anticipado: `… (gestión {interna|externa} – vencimientos de {rango})`, con `{rango}` = `enero a marzo 2027`, `diciembre 2026 a febrero 2027` o `enero 2027`.
  - Solo el titular autoriza: `La autorización para presentar las notas la da solo el firmante titular.`
  - Solo el superadmin elige al firmante: `Solo el superadmin elige al firmante titular.`
  - Firma de Correos con titular elegido: `Con un firmante titular elegido, la firma se carga en su Mi Perfil.`
  - Resumen al superadmin: asunto `RPAD: cambios en los usuarios durante tu licencia`.
- **Commits:** mensajes en español con el estilo del repo (`feat:`, `fix:`, `test:`, `docs:`), terminados con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Cada `git add` nombra archivos concretos: nunca `git add -A` ni `git add .`.

## Review Focus

1. **Sin firmante titular elegido, nada cambia.** Es como queda producción entre subir el código y correr el SQL privado, y como queda la base de cada test existente. La batería actual de Notas Digitales tiene que seguir en verde sin tocarla, y una licencia de un superadmin no tiene que frenar ninguna nota. → test en la Task 7.
2. **La licencia o la autorización se cargan tarde, o la persona autorizada deja de cumplir las condiciones.** Sin autorizado vigente, durante la licencia no se genera ninguna nota (los reintentos sí siguen) y lo pendiente sale a la vuelta, sin duplicados. Una autorización dada después de la víspera sale como nota de autorización en la corrida siguiente, antes que las notas que la citan. → tests en la Task 7; alerta en Correos en la Task 8.
3. **Una licencia de fin de semana o de feriados** (sin días hábiles) no anticipa ni frena nada. → test en la Task 7.
4. **Dos admins cargan a la vez licencias superpuestas para la misma persona.** Una sola se guarda; la otra responde 409. → test de concurrencia en la Task 4.
5. **Una firma con caracteres que el PDF no puede escribir** (☎, una tilde descompuesta de macOS) no se guarda: responde 400 con los caracteres. Una tilde normal (NFC) sí. → test en la Task 5.

---

## Mapa de archivos

| Archivo | Tarea | Responsabilidad |
|---|---|---|
| `database/updates/migracion-licencias-firmas.sql` (nuevo) | 1 | Estructura nueva, aditiva e idempotente |
| `database/updates/rollback-licencias-firmas.sql` (nuevo) | 1 | Deshacer la migración |
| `database/schema.sql`, `tests/schema.test.js` | 1 | Misma estructura para instalaciones nuevas |
| `services/notasDigitalesCalendario.js` | 2 | `ultimoDiaHabilHasta`, `textoRangoMeses` |
| `services/licenciasReglas.js` (nuevo) | 2 | Reglas puras de licencias |
| `services/licenciasService.js` (nuevo) | 2 | Lecturas de licencias |
| `services/usuariosAuditoriaService.js` | 3 | `registrarAuditoria` devuelve el id |
| `services/avisosSuperadminService.js` (nuevo) | 3 | Aviso al superadmin, retención y resumen |
| `services/emailTemplates.js` | 3 | Plantilla del resumen |
| `controllers/usuariosController.js` | 3, 4 | Usa el servicio de avisos; marca de licencia en la lista |
| `services/avisosDiariosService.js` | 3 | El email de cambios pendientes no va a quien está de licencia |
| `controllers/notificacionesController.js` | 3 | Resumen de avisos retenidos en la corrida diaria |
| `controllers/licenciasController.js` (nuevo) | 4 | API de licencias |
| `routes/index.js` | 4, 5 | Rutas nuevas |
| `services/imagenesSubidas.js` (nuevo) | 5 | Decodificar y validar imágenes subidas (compartido) |
| `services/firmasService.js` (nuevo) | 5 | Firma de cada usuario |
| `controllers/firmasController.js` (nuevo) | 5 | Mi firma (Mi Perfil) |
| `controllers/notasDigitalesController.js` | 5, 7 | Firmante titular; config con el firmante |
| `services/notasDigitalesContenido.js` | 6 | Dos firmas, leyenda y asunto con rango |
| `services/notasDigitalesPdf.js` | 6 | Dos firmas y leyenda en el PDF |
| `services/notasDigitalesFirmas.js` (nuevo) | 7 | `firmaParaFecha`, `anticipoPorLicencia`, `autorizadoVigente` |
| `services/notasDigitalesDatos.js` | 7 | Selección con horizonte y `cuenta_desde` |
| `services/notasDigitales.js` | 7, 8 | Motor y Estado con licencias |
| `public/usuarios.html`, `public/js/usuarios.js` | 9 | Pestaña Licencias y marcas |
| `public/perfil.html`, `public/js/perfil.js` | 10 | Mi firma |
| `public/correos.html`, `public/js/correos.js` | 10 | Firmante titular y licencia en el Estado |
| `public/js/api.js`, 14 páginas `.html`, `tests/paginas.test.js` | 9 | Métodos nuevos y versión de los scripts |
| `CLAUDE.md`, `README.md` | 11 | Documentación y despliegue |

---

## Task 0: Preparación y línea de base

**Files:** ninguno versionado.

- [ ] **Step 1: Crear la rama** (desde `main`, con la entrega 1 ya mergeada)

```bash
git switch main && git log --oneline -1 -- services/avisosDiariosService.js && git switch -c feat/licencias-firmas
```

Expected: el `git log` muestra un commit (la entrega 1 está en `main`). Si no muestra nada, **parar**: falta mergear la entrega 1.

- [ ] **Step 2: Verificar el entorno**

```bash
grep -E '^(SMTP_HOST|SMTP_PORT|RPAD_TESTS_DB_LOCAL|DB_HOST)=' .env
docker compose up -d && docker inspect -f '{{.State.Health.Status}}' rpad-db && curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8025/api/v1/info
ls database/privado/licencias-firmas-datos.sql && git check-ignore database/privado/licencias-firmas-datos.sql
```

Expected: los cuatro valores locales, `healthy`, `200`, y el archivo privado existe y está ignorado por git.

- [ ] **Step 3: Línea de base**

```bash
mkdir -p .claude && npm test 2>&1 | tee .claude/linea-de-base-licencias.txt | tail -12
```

Anotar `# pass N` y `# fail M`. Si `M > 0`, listar las fallas (`grep -B1 '^not ok' .claude/linea-de-base-licencias.txt`) y avisar antes de seguir.

Sin commit.

---

## Task 1: Migración, rollback y `schema.sql`

**Files:**
- Create: `database/updates/migracion-licencias-firmas.sql`
- Create: `database/updates/rollback-licencias-firmas.sql`
- Modify: `database/schema.sql`
- Modify: `tests/schema.test.js`

**Interfaces:**
- Produces:
  - tablas `usuarios_licencias` (con `nota_autorizacion_id`) y `usuarios_firmas`;
  - columnas `notas_digitales_config.firmante_usuario_id`, `notas_digitales.firmante_id`, `notas_digitales.presentada_por_id`, `notas_digitales_datasets.cuenta_desde` y `usuarios_auditoria.aviso_retenido`;
  - `notas_digitales.tipo` admite `autorizacion` y `notas_digitales.gestion` admite NULL;
  - acciones `licencia_cargada`, `licencia_editada` y `licencia_anulada` en `usuarios_auditoria.accion`.

- [ ] **Step 1: Tests que fallan** en `tests/schema.test.js`, dentro de `describe('database/schema.sql', …)`:

```js
  it('licencias y firmas por usuario (spec 2026-10-15-dias-habiles-licencias-auditoria, 11.1)', async () => {
    const lista = await columnas(root, BASE_TEMPORAL);
    for (const esperada of [
      'usuarios_licencias.usuario_id int(11) null=NO default=NULL key=MUL',
      'usuarios_licencias.desde date null=NO default=NULL key=',
      'usuarios_licencias.hasta date null=NO default=NULL key=',
      'usuarios_licencias.autorizado_id int(11) null=YES default=NULL key=MUL',
      'usuarios_licencias.autorizado_at datetime null=YES default=NULL key=',
      'usuarios_licencias.nota_autorizacion_id int(11) null=YES default=NULL key=',
      'usuarios_licencias.anulada tinyint(1) null=NO default=0 key=',
      'usuarios_firmas.usuario_id int(11) null=NO default=NULL key=PRI',
      'usuarios_firmas.nombre varchar(150) null=NO default=NULL key=',
      'usuarios_firmas.cargo varchar(200) null=NO default=NULL key=',
      'usuarios_firmas.imagen mediumblob null=YES default=NULL key=',
      'notas_digitales_config.firmante_usuario_id int(11) null=YES default=NULL key=',
      'notas_digitales.firmante_id int(11) null=YES default=NULL key=',
      'notas_digitales.presentada_por_id int(11) null=YES default=NULL key=',
      'notas_digitales_datasets.cuenta_desde date null=YES default=NULL key=',
      'usuarios_auditoria.aviso_retenido varchar(300) null=YES default=NULL key='
    ]) {
      assert.ok(lista.includes(esperada), `falta: ${esperada}\n${lista.filter(c => c.startsWith(esperada.split('.')[0])).join('\n')}`);
    }
    assert.ok(lista.some(c => c.startsWith("usuarios_auditoria.accion enum(") && c.includes("'licencia_cargada','licencia_editada','licencia_anulada'")),
      lista.filter(c => c.startsWith('usuarios_auditoria.accion')).join('\n'));
    // La nota de autorización (spec 7.2) es un tipo nuevo, sin gestión
    assert.ok(lista.some(c => c.startsWith("notas_digitales.tipo enum('aviso','reiteracion','autorizacion') null=NO")),
      lista.filter(c => c.startsWith('notas_digitales.tipo')).join('\n'));
    assert.ok(lista.some(c => c.startsWith("notas_digitales.gestion enum('interna','externa') null=YES default=NULL")),
      lista.filter(c => c.startsWith('notas_digitales.gestion')).join('\n'));
  });
```

Y agregar `'usuarios_licencias', 'usuarios_firmas'` al final del arreglo del test `no trae datos en ${tabla}`.

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/schema.test.js`
Expected: FAIL en el test nuevo y en `no trae datos en usuarios_licencias` / `usuarios_firmas`.

- [ ] **Step 3: Migración** `database/updates/migracion-licencias-firmas.sql`:

```sql
-- =====================================================
-- RPAD - Licencias, firma de cada usuario y firmante titular de las Notas Digitales
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-15-dias-habiles-licencias-auditoria-design.md (sección 11.1)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura.
-- ORDEN: correr ANTES de subir el código nuevo (phpMyAdmin > base del RPAD > pestaña SQL, pegar y Continuar).
-- Después de subir el código y reiniciar, correr UNA SOLA VEZ la carga no versionada
-- database/privado/licencias-firmas-datos.sql (firmante titular y su firma).
-- Se puede volver a correr si se cortó a mitad: lo que ya existe se saltea.
-- Para deshacer: rollback-licencias-firmas.sql
-- =====================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `usuarios_licencias` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `desde` date NOT NULL,
  `hasta` date NOT NULL,
  `autorizado_id` int(11) DEFAULT NULL,
  `autorizado_at` datetime DEFAULT NULL,
  `nota_autorizacion_id` int(11) DEFAULT NULL,
  `anulada` tinyint(1) NOT NULL DEFAULT 0,
  `creado_por` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_licencias_usuario_fechas` (`usuario_id`,`desde`,`hasta`),
  KEY `fk_licencias_autorizado` (`autorizado_id`),
  KEY `fk_licencias_creado_por` (`creado_por`),
  CONSTRAINT `fk_licencias_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_licencias_autorizado` FOREIGN KEY (`autorizado_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_licencias_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `usuarios_firmas` (
  `usuario_id` int(11) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `cargo` varchar(200) NOT NULL,
  `imagen` mediumblob DEFAULT NULL,
  `mime` varchar(20) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`usuario_id`),
  CONSTRAINT `fk_firmas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `notas_digitales_config`
  ADD COLUMN IF NOT EXISTS `firmante_usuario_id` int(11) DEFAULT NULL AFTER `firma_mime`;

ALTER TABLE `notas_digitales`
  MODIFY COLUMN `tipo` enum('aviso','reiteracion','autorizacion') NOT NULL,
  MODIFY COLUMN `gestion` enum('interna','externa') DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `firmante_id` int(11) DEFAULT NULL AFTER `creado_por`,
  ADD COLUMN IF NOT EXISTS `presentada_por_id` int(11) DEFAULT NULL AFTER `firmante_id`;

ALTER TABLE `notas_digitales_datasets`
  ADD COLUMN IF NOT EXISTS `cuenta_desde` date DEFAULT NULL AFTER `vencimiento`;

ALTER TABLE `usuarios_auditoria`
  MODIFY COLUMN `accion` enum('alta','edicion','cambio_rol','desactivacion','reactivacion','invitacion_enviada','recuperacion_enviada','contrasena_establecida','contrasena_cambiada','perfil_editado','licencia_cargada','licencia_editada','licencia_anulada') NOT NULL,
  ADD COLUMN IF NOT EXISTS `aviso_retenido` varchar(300) DEFAULT NULL AFTER `detalle`;
```

- [ ] **Step 4: Rollback** `database/updates/rollback-licencias-firmas.sql`:

```sql
-- =====================================================
-- RPAD - Deshace migracion-licencias-firmas.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Se pierden las licencias, las firmas cargadas en Mi Perfil, el firmante titular, quién firmó cada nota y los avisos
-- al superadmin retenidos. Las notas vuelven a salir con la firma cargada en Correos (que la migración no tocó).
-- notas_digitales.tipo (con 'autorizacion') y notas_digitales.gestion (que admite NULL) quedan ampliados a propósito:
-- las notas de autorización son notas numeradas del libro y no se borran. El código anterior funciona igual con ellas.
-- =====================================================

SET NAMES utf8mb4;

DELETE FROM `usuarios_auditoria` WHERE `accion` IN ('licencia_cargada','licencia_editada','licencia_anulada');

ALTER TABLE `usuarios_auditoria`
  DROP COLUMN IF EXISTS `aviso_retenido`,
  MODIFY COLUMN `accion` enum('alta','edicion','cambio_rol','desactivacion','reactivacion','invitacion_enviada','recuperacion_enviada','contrasena_establecida','contrasena_cambiada','perfil_editado') NOT NULL;

ALTER TABLE `notas_digitales_datasets` DROP COLUMN IF EXISTS `cuenta_desde`;

ALTER TABLE `notas_digitales`
  DROP COLUMN IF EXISTS `presentada_por_id`,
  DROP COLUMN IF EXISTS `firmante_id`;

ALTER TABLE `notas_digitales_config` DROP COLUMN IF EXISTS `firmante_usuario_id`;

DROP TABLE IF EXISTS `usuarios_firmas`;
DROP TABLE IF EXISTS `usuarios_licencias`;
```

- [ ] **Step 5: `database/schema.sql`**, con exactamente la estructura que deja la migración:

(a) En `notas_digitales` (hoy `database/schema.sql:430-461`), reemplazar las líneas de `tipo` y `gestion` por

```sql
  `tipo` enum('aviso','reiteracion','autorizacion') NOT NULL,
  `gestion` enum('interna','externa') DEFAULT NULL,
```

y, después de `` `creado_por` int(11) DEFAULT NULL, ``, agregar:

```sql
  `firmante_id` int(11) DEFAULT NULL,
  `presentada_por_id` int(11) DEFAULT NULL,
```

(b) En `notas_digitales_datasets`, después de `` `vencimiento` date NOT NULL, ``:

```sql
  `cuenta_desde` date DEFAULT NULL,
```

(c) En `notas_digitales_config`, después de `` `firma_mime` varchar(50) DEFAULT NULL, ``:

```sql
  `firmante_usuario_id` int(11) DEFAULT NULL,
```

(d) En `usuarios_auditoria`, reemplazar la línea de `accion` por la del Step 3 (con las tres acciones nuevas) y, después de la línea de `detalle`, agregar:

```sql
  `aviso_retenido` varchar(300) DEFAULT NULL,
```

(e) Al final del archivo, los dos `CREATE TABLE` del Step 3 **idénticos pero sin `IF NOT EXISTS`** (como las demás tablas de `schema.sql`), con este encabezado:

```sql

-- =====================================================
-- Licencias y firmas por usuario (database/updates/migracion-licencias-firmas.sql)
-- =====================================================
```

- [ ] **Step 6: Ensayo de la migración y el rollback en una base descartable** (desde el `schema.sql` de `main`, sin tocar la copia local):

```bash
RP=$(grep '^DB_ROOT_PASSWORD=' .env | cut -d= -f2)
mdb() { docker exec -i -e MYSQL_PWD="$RP" rpad-db mariadb -uroot --default-character-set=utf8mb4 "$@"; }
mdb -e "DROP DATABASE IF EXISTS rpad_ensayo_lf; CREATE DATABASE rpad_ensayo_lf CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
git show main:database/schema.sql | mdb rpad_ensayo_lf
COLS="SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='rpad_ensayo_lf' ORDER BY TABLE_NAME, ORDINAL_POSITION"
mdb -N -e "$COLS" > .claude/ensayo-antes.txt
mdb rpad_ensayo_lf < database/updates/migracion-licencias-firmas.sql
mdb rpad_ensayo_lf < database/updates/migracion-licencias-firmas.sql && echo "segunda corrida OK"
mdb rpad_ensayo_lf < database/updates/rollback-licencias-firmas.sql
mdb -N -e "$COLS" > .claude/ensayo-despues.txt
diff .claude/ensayo-antes.txt .claude/ensayo-despues.txt
mdb -e "DROP DATABASE rpad_ensayo_lf"
```

Expected: `segunda corrida OK`, y el `diff` muestra **solo** las líneas de `notas_digitales` `gestion` y `tipo` (que el rollback deja ampliadas a propósito). Cualquier otra diferencia es un error del rollback.

- [ ] **Step 7: Aplicar la migración a la base local** (copia de producción) y verificar que no cambia ningún dato

```bash
RP=$(grep '^DB_ROOT_PASSWORD=' .env | cut -d= -f2); DBN=$(grep '^DB_NAME=' .env | cut -d= -f2)
mdb() { docker exec -i -e MYSQL_PWD="$RP" rpad-db mariadb -uroot --default-character-set=utf8mb4 "$@"; }
CUENTA="SELECT (SELECT COUNT(*) FROM usuarios), (SELECT COUNT(*) FROM usuarios_auditoria), (SELECT COUNT(*) FROM notas_digitales), (SELECT COUNT(*) FROM notas_digitales_datasets), (SELECT CONCAT_WS('|', firma_nombre, firma_cargo, LENGTH(firma_imagen)) FROM notas_digitales_config)"
mdb -N "$DBN" -e "$CUENTA" > .claude/local-antes.txt
mdb "$DBN" < database/updates/migracion-licencias-firmas.sql
mdb -N "$DBN" -e "$CUENTA" > .claude/local-despues.txt
diff .claude/local-antes.txt .claude/local-despues.txt && echo "sin cambios de datos"
mdb -N "$DBN" -e "SELECT firmante_usuario_id FROM notas_digitales_config"
```

Expected: `sin cambios de datos` y `NULL` (sin firmante titular).

- [ ] **Step 8: Correr el test de esquema**

Run: `node --test tests/schema.test.js`
Expected: PASS (la base local y `schema.sql` coinciden).

- [ ] **Step 9: Suite completa y comparación con la línea de base**

Run: `npm test 2>&1 | tail -12`
Expected: ninguna falla nueva.

- [ ] **Step 10: Commit**

```bash
git add database/updates/migracion-licencias-firmas.sql database/updates/rollback-licencias-firmas.sql database/schema.sql tests/schema.test.js
git commit -m "feat: estructura de licencias, firmas por usuario y firmante titular de las notas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Calendario, reglas y lecturas de licencias

**Files:**
- Modify: `services/notasDigitalesCalendario.js`
- Create: `services/licenciasReglas.js`
- Create: `services/licenciasService.js`
- Test: `tests/notas-calendario.test.js` (agregar), `tests/licencias-reglas.test.js` (nuevo), `tests/licencias-datos.test.js` (nuevo)

**Interfaces:**
- Produces:
  - `ultimoDiaHabilHasta(iso) → 'AAAA-MM-DD'` (el último día hábil ≤ iso)
  - `textoRangoMeses(desde, hasta) → string` (`'enero a marzo 2027'`, `'diciembre 2026 a febrero 2027'`, `'enero 2027'`)
  - `ROLES_CON_LICENCIA`, `MAXIMO_DIAS_LICENCIA = 365`, `puedeTenerLicencia(rol)`, `estadoDeLicencia(l, hoy) → 'anulada'|'futura'|'en_curso'|'pasada'`, `validarFechasNuevas({desde, hasta}, hoy) → string|null`, `validarEdicion(actual, cambios, hoy) → { error, codigo } | { datos: {desde, hasta} }`, `puedeAnularse(l, hoy) → boolean`
  - `licenciaEnFecha(usuarioId, fecha, conexion?) → licencia|null`, `proximaLicencia(usuarioId, fecha) → licencia|null`. Una licencia leída de la base tiene `{ id, usuario_id, desde, hasta, autorizado_id, autorizado_at ('AAAA-MM-DD HH:MM:SS' o null), nota_autorizacion_id, anulada }`, con las fechas como texto.

- [ ] **Step 1: Tests del calendario.** Agregar al final de `tests/notas-calendario.test.js`:

```js
describe('ultimoDiaHabilHasta', () => {
  it('un día hábil es su propio último día hábil; un fin de semana o feriado va al anterior', () => {
    assert.equal(cal.ultimoDiaHabilHasta('2027-01-14'), '2027-01-14');
    assert.equal(cal.ultimoDiaHabilHasta('2027-01-24'), '2027-01-22');
    assert.equal(cal.ultimoDiaHabilHasta('2027-01-01'), '2026-12-31');
  });
});

describe('textoRangoMeses', () => {
  it('un mes, meses del mismo año y meses de dos años', () => {
    assert.equal(cal.textoRangoMeses('2027-01-20', '2027-01-31'), 'enero 2027');
    assert.equal(cal.textoRangoMeses('2027-01-20', '2027-03-31'), 'enero a marzo 2027');
    assert.equal(cal.textoRangoMeses('2026-12-15', '2027-02-10'), 'diciembre 2026 a febrero 2027');
  });
});
```

- [ ] **Step 2: Implementar** al final de `services/notasDigitalesCalendario.js`:

```js
// Último día hábil que no pasa de iso (iso mismo si es hábil)
export const ultimoDiaHabilHasta = (iso) => (esDiaHabil(iso) ? iso : diaHabilAnterior(iso));

// Rango de meses en minúsculas, como en el asunto de los avisos anticipados (spec 2026-10-15, 7.3):
// 'enero 2027', 'enero a marzo 2027' o 'diciembre 2026 a febrero 2027'
export const textoRangoMeses = (desde, hasta) => {
  if (periodoDe(desde) === periodoDe(hasta)) return mesYAnio(desde);
  if (desde.slice(0, 4) === hasta.slice(0, 4)) return `${MESES[Number(desde.slice(5, 7)) - 1]} a ${mesYAnio(hasta)}`;
  return `${mesYAnio(desde)} a ${mesYAnio(hasta)}`;
};
```

(`periodoDe`, `mesYAnio` y `MESES` ya están en el archivo; `textoRangoMeses` va **después** de ellos.)

- [ ] **Step 3: Tests de las reglas.** Crear `tests/licencias-reglas.test.js`:

```js
// Reglas de las licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.1 y 5.2): funciones puras
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES_CON_LICENCIA, MAXIMO_DIAS_LICENCIA, puedeTenerLicencia, estadoDeLicencia, validarFechasNuevas, validarEdicion,
  puedeAnularse
} from '../services/licenciasReglas.js';

const HOY = '2026-11-10';
const licencia = (desde, hasta, anulada = 0) => ({ desde, hasta, anulada });

describe('quién puede tener licencia', () => {
  it('superadmin, admin y editor; el lector no', () => {
    assert.deepEqual(ROLES_CON_LICENCIA, ['superadmin', 'admin', 'editor']);
    assert.equal(puedeTenerLicencia('admin'), true);
    assert.equal(puedeTenerLicencia('lector'), false);
    assert.equal(puedeTenerLicencia(undefined), false);
  });
});

describe('estadoDeLicencia', () => {
  it('futura, en curso (incluidos los dos extremos), pasada y anulada', () => {
    assert.equal(estadoDeLicencia(licencia('2026-11-11', '2026-11-20'), HOY), 'futura');
    assert.equal(estadoDeLicencia(licencia('2026-11-10', '2026-11-20'), HOY), 'en_curso');
    assert.equal(estadoDeLicencia(licencia('2026-11-01', '2026-11-10'), HOY), 'en_curso');
    assert.equal(estadoDeLicencia(licencia('2026-11-01', '2026-11-09'), HOY), 'pasada');
    assert.equal(estadoDeLicencia(licencia('2026-11-11', '2026-11-20', 1), HOY), 'anulada');
  });
});

describe('validarFechasNuevas', () => {
  it('acepta una licencia que termina hoy o después, aunque haya empezado antes', () => {
    assert.equal(validarFechasNuevas({ desde: '2026-11-05', hasta: '2026-11-10' }, HOY), null);
    assert.equal(validarFechasNuevas({ desde: '2026-11-26', hasta: '2027-01-14' }, HOY), null);
  });

  it('rechaza fechas inválidas, invertidas, ya pasadas o de más de 365 días', () => {
    assert.match(validarFechasNuevas({ desde: '2026-11-31', hasta: '2026-12-01' }, HOY), /días válidos/);
    assert.match(validarFechasNuevas({ desde: '2026-12-01' }, HOY), /días válidos/);
    assert.match(validarFechasNuevas({ desde: '2026-12-10', hasta: '2026-12-01' }, HOY), /antes de empezar/);
    assert.match(validarFechasNuevas({ desde: '2026-11-01', hasta: '2026-11-09' }, HOY), /ya terminó/);
    assert.equal(validarFechasNuevas({ desde: '2026-11-10', hasta: '2027-11-09' }, HOY), null);
    assert.match(validarFechasNuevas({ desde: '2026-11-10', hasta: '2027-11-10' }, HOY), new RegExp(`${MAXIMO_DIAS_LICENCIA} días`));
  });
});

describe('validarEdicion (spec 5.2)', () => {
  it('una futura admite cambiar las dos fechas', () => {
    assert.deepEqual(validarEdicion(licencia('2026-11-20', '2026-11-30'), { desde: '2026-11-21', hasta: '2026-12-05' }, HOY),
      { datos: { desde: '2026-11-21', hasta: '2026-12-05' } });
  });

  it('una en curso solo admite cambiar el fin, a ayer o después', () => {
    const enCurso = licencia('2026-11-01', '2026-11-30');
    assert.deepEqual(validarEdicion(enCurso, { hasta: '2026-12-15' }, HOY), { datos: { desde: '2026-11-01', hasta: '2026-12-15' } });
    assert.deepEqual(validarEdicion(enCurso, { desde: '2026-11-01', hasta: '2026-11-09' }, HOY), { datos: { desde: '2026-11-01', hasta: '2026-11-09' } });
    assert.equal(validarEdicion(enCurso, { hasta: '2026-11-08' }, HOY).codigo, 400);
    assert.match(validarEdicion(enCurso, { desde: '2026-11-02' }, HOY).error, /solo se puede cambiar la fecha de fin/);
  });

  it('una pasada o anulada no admite cambios (409)', () => {
    assert.equal(validarEdicion(licencia('2026-11-01', '2026-11-09'), { hasta: '2026-11-20' }, HOY).codigo, 409);
    assert.equal(validarEdicion(licencia('2026-11-20', '2026-11-30', 1), { hasta: '2026-12-01' }, HOY).codigo, 409);
  });

  it('sin cambios devuelve las mismas fechas', () => {
    assert.deepEqual(validarEdicion(licencia('2026-11-20', '2026-11-30'), {}, HOY), { datos: { desde: '2026-11-20', hasta: '2026-11-30' } });
  });
});

describe('puedeAnularse', () => {
  it('solo si no está anulada y empieza hoy o después', () => {
    assert.equal(puedeAnularse(licencia('2026-11-10', '2026-11-20'), HOY), true);
    assert.equal(puedeAnularse(licencia('2026-11-11', '2026-11-20'), HOY), true);
    assert.equal(puedeAnularse(licencia('2026-11-09', '2026-11-20'), HOY), false);
    assert.equal(puedeAnularse(licencia('2026-11-11', '2026-11-20', 1), HOY), false);
  });
});
```

- [ ] **Step 4: Implementar** `services/licenciasReglas.js`:

```js
// Reglas de las licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.1 y 5.2): funciones puras, sin base de datos.
// Las fechas son textos 'AAAA-MM-DD' en hora de Argentina.
import { esFechaIso, diasEntre, sumarDias } from './notasDigitalesCalendario.js';

export const ROLES_CON_LICENCIA = ['superadmin', 'admin', 'editor'];
export const MAXIMO_DIAS_LICENCIA = 365;

const FECHAS_INVALIDAS = 'Las fechas tienen que ser días válidos (AAAA-MM-DD)';
const DEMASIADO_LARGA = `La licencia puede durar como máximo ${MAXIMO_DIAS_LICENCIA} días`;

export const puedeTenerLicencia = (rol) => ROLES_CON_LICENCIA.includes(rol);

export const estadoDeLicencia = ({ desde, hasta, anulada }, hoy) => {
  if (Number(anulada)) return 'anulada';
  if (desde > hoy) return 'futura';
  if (hasta < hoy) return 'pasada';
  return 'en_curso';
};

const duraDeMas = ({ desde, hasta }) => diasEntre(desde, hasta) + 1 > MAXIMO_DIAS_LICENCIA;

// null si las fechas sirven para una licencia nueva o una futura editada; si no, el motivo
export const validarFechasNuevas = ({ desde, hasta }, hoy) => {
  if (!esFechaIso(desde) || !esFechaIso(hasta)) return FECHAS_INVALIDAS;
  if (desde > hasta) return 'La licencia no puede terminar antes de empezar';
  if (hasta < hoy) return 'La licencia ya terminó: no tiene efecto';
  if (duraDeMas({ desde, hasta })) return DEMASIADO_LARGA;
  return null;
};

/**
 * Qué cambios admite una licencia según su estado (spec 5.2).
 * actual: { desde, hasta, anulada }; cambios: { desde?, hasta? } (lo que no viene queda como está).
 * Devuelve { error, codigo } (400 datos inválidos, 409 la licencia no admite cambios) o { datos: { desde, hasta } }.
 */
export const validarEdicion = (actual, cambios, hoy) => {
  const estado = estadoDeLicencia(actual, hoy);
  if (estado === 'anulada') return { error: 'La licencia está anulada', codigo: 409 };
  if (estado === 'pasada') return { error: 'La licencia ya terminó: no se puede modificar', codigo: 409 };
  const datos = { desde: cambios.desde ?? actual.desde, hasta: cambios.hasta ?? actual.hasta };
  if (estado === 'futura') {
    const error = validarFechasNuevas(datos, hoy);
    return error ? { error, codigo: 400 } : { datos };
  }
  if (datos.desde !== actual.desde) return { error: 'La licencia ya empezó: solo se puede cambiar la fecha de fin', codigo: 400 };
  if (!esFechaIso(datos.hasta)) return { error: FECHAS_INVALIDAS, codigo: 400 };
  if (datos.hasta < datos.desde || datos.hasta < sumarDias(hoy, -1)) {
    return { error: 'La fecha de fin tiene que ser ayer o posterior, y no anterior al inicio', codigo: 400 };
  }
  if (duraDeMas(datos)) return { error: DEMASIADO_LARGA, codigo: 400 };
  return { datos };
};

// Se anula una licencia que todavía no empezó o que empieza hoy (una cargada por error); una en curso se corta con el fin
export const puedeAnularse = (licencia, hoy) => !Number(licencia.anulada) && licencia.desde >= hoy;
```

- [ ] **Step 5: Tests de las lecturas.** Crear `tests/licencias-datos.test.js`:

```js
// Lecturas de licencias (services/licenciasService.js) sobre una base de prueba
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, cerrarDb, query } from './helpers.js';
import { asegurarBaseDePrueba } from './notas-fixtures.js';

let base, servicio, dbReal, usuarioId;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_licencias_datos');
  process.env.DB_NAME = base.nombre;
  servicio = await import('../services/licenciasService.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  await asegurarBaseDePrueba();
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios');
  const r = await query("INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES ('t_lic', 'x', 'Prueba', 't_lic@rpad.test', 'admin', 1)");
  usuarioId = r.insertId;
});

const cargar = (desde, hasta, anulada = 0) => query(
  'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, anulada, autorizado_at) VALUES (?, ?, ?, ?, ?)',
  [usuarioId, desde, hasta, anulada, '2026-11-20 10:30:00']
);

describe('licenciaEnFecha', () => {
  it('encuentra la licencia que incluye la fecha, con sus extremos, y devuelve las fechas como texto', async () => {
    await cargar('2026-11-26', '2027-01-14');
    for (const fecha of ['2026-11-26', '2026-12-31', '2027-01-14']) {
      const l = await servicio.licenciaEnFecha(usuarioId, fecha);
      assert.equal(l?.desde, '2026-11-26', fecha);
      assert.equal(l.hasta, '2027-01-14');
      assert.equal(l.autorizado_at, '2026-11-20 10:30:00');
    }
    assert.equal(await servicio.licenciaEnFecha(usuarioId, '2026-11-25'), null);
    assert.equal(await servicio.licenciaEnFecha(usuarioId, '2027-01-15'), null);
  });

  it('ignora las anuladas', async () => {
    await cargar('2026-11-26', '2027-01-14', 1);
    assert.equal(await servicio.licenciaEnFecha(usuarioId, '2026-12-01'), null);
  });
});

describe('proximaLicencia', () => {
  it('la primera no anulada que empieza después de la fecha', async () => {
    await cargar('2027-03-01', '2027-03-05');
    await cargar('2026-12-01', '2026-12-10', 1);
    await cargar('2027-01-25', '2027-02-05');
    assert.equal((await servicio.proximaLicencia(usuarioId, '2026-11-10')).desde, '2027-01-25');
    assert.equal((await servicio.proximaLicencia(usuarioId, '2027-01-25')).desde, '2027-03-01');
    assert.equal(await servicio.proximaLicencia(usuarioId, '2027-03-01'), null);
  });
});
```

- [ ] **Step 6: Implementar** `services/licenciasService.js`:

```js
// Lecturas de licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, sección 5). Las fechas salen como texto
// 'AAAA-MM-DD' (y autorizado_at como 'AAAA-MM-DD HH:MM:SS', en hora de Argentina, como se guardó).
import pool from '../config/database.js';

const COLUMNAS = `l.id, l.usuario_id, DATE_FORMAT(l.desde, '%Y-%m-%d') AS desde, DATE_FORMAT(l.hasta, '%Y-%m-%d') AS hasta,
  l.autorizado_id, DATE_FORMAT(l.autorizado_at, '%Y-%m-%d %H:%i:%s') AS autorizado_at, l.nota_autorizacion_id, l.anulada`;

// Licencia no anulada del usuario que incluye la fecha, o null. conexion: el pool o una conexión con transacción.
export const licenciaEnFecha = async (usuarioId, fecha, conexion = pool) => {
  const [filas] = await conexion.query(
    `SELECT ${COLUMNAS} FROM usuarios_licencias l
     WHERE l.usuario_id = ? AND l.anulada = 0 AND l.desde <= ? AND l.hasta >= ?
     ORDER BY l.desde LIMIT 1`,
    [usuarioId, fecha, fecha]
  );
  return filas[0] ?? null;
};

// Primera licencia no anulada del usuario que empieza después de la fecha, o null
export const proximaLicencia = async (usuarioId, fecha) => {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS} FROM usuarios_licencias l
     WHERE l.usuario_id = ? AND l.anulada = 0 AND l.desde > ?
     ORDER BY l.desde LIMIT 1`,
    [usuarioId, fecha]
  );
  return filas[0] ?? null;
};
```

- [ ] **Step 7: Correr los tests de la tarea**

Run: `node --test tests/notas-calendario.test.js tests/licencias-reglas.test.js tests/licencias-datos.test.js`
Expected: PASS.

- [ ] **Step 8: Suite completa** — `npm test 2>&1 | tail -12`: ninguna falla nueva.

- [ ] **Step 9: Commit**

```bash
git add services/notasDigitalesCalendario.js services/licenciasReglas.js services/licenciasService.js tests/notas-calendario.test.js tests/licencias-reglas.test.js tests/licencias-datos.test.js
git commit -m "feat: reglas y lecturas de licencias, y rango de meses para los asuntos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 3: Sin emails personales durante la licencia; avisos al superadmin retenidos y resumen a la vuelta

**Files:**
- Modify: `services/usuariosAuditoriaService.js`
- Create: `services/avisosSuperadminService.js`
- Modify: `services/emailTemplates.js` (agregar una plantilla al final)
- Modify: `controllers/usuariosController.js`
- Modify: `services/avisosDiariosService.js`
- Modify: `controllers/notificacionesController.js`
- Test: `tests/avisos-superadmin.test.js` (nuevo), `tests/avisos-diarios.test.js` (agregar)

**Interfaces:**
- Consumes: `hoyArgentina`, `esDiaHabil` (calendario); `emailValido` (`services/usuariosReglas.js`); `fechaHoraArgentina`, `plantillaSimple`, `RPAD_URL` (`services/emailTemplates.js`).
- Produces:
  - `registrarAuditoria(...) → Promise<number>` (id de la fila; antes no devolvía nada y nadie usaba el resultado)
  - `avisarAlSuperadmin({ actor: { id, rol }, afectado: { nombre_completo, username }, cambio, auditoriaId, hoy? }) → Promise<void>`: nunca lanza.
  - `enviarResumenAvisosRetenidos({ hoy }) → Promise<{ enviado: boolean, cantidad: number }>`: lanza si el envío falla.
  - `resumenAvisosRetenidosTemplate(retenidos) → { subject, html, text }`
  - `enviarCambiosPendientes({ hoy })` suma `deLicencia: [username]` al resultado.

- [ ] **Step 1: Tests que fallan.** Crear `tests/avisos-superadmin.test.js`:

```js
// Avisos al superadmin durante su licencia (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.3 y 5.4),
// con fechas fijas sobre una base de prueba + Mailpit
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query, mailpit } from './helpers.js';
import { asegurarBaseDePrueba } from './notas-fixtures.js';

let base, servicio, dbReal, superadmin, admin, lector;
const ASUNTO_AVISO = 'RPAD: cambio en los usuarios';
const ASUNTO_RESUMEN = 'RPAD: cambios en los usuarios durante tu licencia';

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_avisos_superadmin');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  servicio = await import('../services/avisosSuperadminService.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

const crearUsuario = async (rol) => {
  const username = `t_${rol}_${crypto.randomBytes(3).toString('hex')}`;
  const r = await query(
    "INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES (?, 'x', ?, ?, ?, 1)",
    [username, `Persona ${rol}`, `${username}@rpad.test`, rol]
  );
  return { id: r.insertId, username, email: `${username}@rpad.test`, nombre_completo: `Persona ${rol}`, rol };
};

beforeEach(async () => {
  await asegurarBaseDePrueba();
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios_auditoria');
  await query('DELETE FROM usuarios');
  superadmin = await crearUsuario('superadmin');
  admin = await crearUsuario('admin');
  lector = await crearUsuario('lector');
  await mailpit.vaciar();
});

const deLicencia = (usuario, desde, hasta) =>
  query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuario.id, desde, hasta]);
const filaDeAuditoria = async () => (await query(
  "INSERT INTO usuarios_auditoria (usuario_id, actor_id, accion, detalle) VALUES (?, ?, 'desactivacion', NULL)", [lector.id, admin.id]
)).insertId;
const avisos = async (asunto) => (await mailpit.mensajes()).filter(m => m.Subject === asunto);
const esperarUnPoco = () => new Promise(r => setTimeout(r, 300));

describe('aviso al superadmin', () => {
  it('sin licencia le llega como siempre y no queda nada retenido', async () => {
    const auditoriaId = await filaDeAuditoria();
    await servicio.avisarAlSuperadmin({ actor: admin, afectado: lector, cambio: 'Desactivado', auditoriaId, hoy: '2026-11-10' });
    const [aviso] = await mailpit.esperar(m => m.Subject === ASUNTO_AVISO);
    assert.deepEqual(aviso.To.map(t => t.Address), [superadmin.email]);
    const [fila] = await query('SELECT aviso_retenido FROM usuarios_auditoria WHERE id = ?', [auditoriaId]);
    assert.equal(fila.aviso_retenido, null);
  });

  it('de licencia no le llega: el texto queda retenido en la fila del historial', async () => {
    await deLicencia(superadmin, '2026-11-01', '2026-11-20');
    const auditoriaId = await filaDeAuditoria();
    await servicio.avisarAlSuperadmin({ actor: admin, afectado: lector, cambio: 'Desactivado', auditoriaId, hoy: '2026-11-10' });
    await esperarUnPoco();
    assert.equal((await avisos(ASUNTO_AVISO)).length, 0);
    const [fila] = await query('SELECT aviso_retenido FROM usuarios_auditoria WHERE id = ?', [auditoriaId]);
    assert.equal(fila.aviso_retenido, 'Desactivado');
  });

  it('un cambio del propio superadmin no genera aviso ni retención', async () => {
    await deLicencia(superadmin, '2026-11-01', '2026-11-20');
    const auditoriaId = await filaDeAuditoria();
    await servicio.avisarAlSuperadmin({ actor: superadmin, afectado: lector, cambio: 'Desactivado', auditoriaId, hoy: '2026-11-10' });
    const [fila] = await query('SELECT aviso_retenido FROM usuarios_auditoria WHERE id = ?', [auditoriaId]);
    assert.equal(fila.aviso_retenido, null);
  });
});

describe('resumen de avisos retenidos (spec 5.4)', () => {
  const retener = async (cambio) => {
    const auditoriaId = await filaDeAuditoria();
    await query('UPDATE usuarios_auditoria SET aviso_retenido = ? WHERE id = ?', [cambio, auditoriaId]);
    return auditoriaId;
  };

  it('a la vuelta, en un día hábil, llega un solo email con todos y dejan de estar retenidos', async () => {
    await deLicencia(superadmin, '2026-11-01', '2026-11-20');
    await retener('Desactivado');
    await retener('Lector → Administrador');
    const resultado = await servicio.enviarResumenAvisosRetenidos({ hoy: '2026-11-23' });
    assert.deepEqual(resultado, { enviado: true, cantidad: 2 });
    const [resumen, ...otros] = await mailpit.esperar(m => m.Subject === ASUNTO_RESUMEN);
    assert.equal(otros.length, 0);
    assert.deepEqual(resumen.To.map(t => t.Address), [superadmin.email]);
    const html = await mailpit.html(resumen.ID);
    assert.match(html, /Desactivado/);
    assert.match(html, /Lector → Administrador/);
    assert.match(html, /Persona admin/);
    assert.equal((await query('SELECT COUNT(*) AS n FROM usuarios_auditoria WHERE aviso_retenido IS NOT NULL'))[0].n, 0);
    assert.deepEqual(await servicio.enviarResumenAvisosRetenidos({ hoy: '2026-11-24' }), { enviado: false, cantidad: 0 });
  });

  it('mientras sigue de licencia, o en un día no hábil, no se envía y quedan retenidos', async () => {
    await deLicencia(superadmin, '2026-11-01', '2026-11-20');
    await retener('Desactivado');
    assert.deepEqual(await servicio.enviarResumenAvisosRetenidos({ hoy: '2026-11-19' }), { enviado: false, cantidad: 1 });
    assert.deepEqual(await servicio.enviarResumenAvisosRetenidos({ hoy: '2026-11-21' }), { enviado: false, cantidad: 0 });
    await esperarUnPoco();
    assert.equal((await avisos(ASUNTO_RESUMEN)).length, 0);
    assert.equal((await query('SELECT COUNT(*) AS n FROM usuarios_auditoria WHERE aviso_retenido IS NOT NULL'))[0].n, 1);
  });
});
```

(En un día no hábil la función sale antes de mirar los retenidos: por eso devuelve `cantidad: 0`.)

Agregar en `tests/avisos-diarios.test.js`, dentro de `describe('email de cambios pendientes (spec 4.1)', …)`:

```js
  it('no le llega a quien está de licencia ese día (spec 5.3)', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    const c = await crearUsuario('admin');
    await proponerCambio(a.id, 'Cambio con un revisor de licencia');
    await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [b.id, '2026-10-12', '2026-10-16']);

    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-16' });

    assert.deepEqual(resultado.enviados.map(e => e.email), [c.email]);
    assert.deepEqual(resultado.deLicencia, [b.username]);
    assert.equal(para(await mailpit.mensajes(), b.email).length, 0);
  });
```

y en su `beforeEach`, antes de `DELETE FROM usuarios`, agregar `await query('DELETE FROM usuarios_licencias');`.

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/avisos-superadmin.test.js tests/avisos-diarios.test.js`
Expected: FAIL (`Cannot find module '../services/avisosSuperadminService.js'`; `deLicencia` undefined).

- [ ] **Step 3: `registrarAuditoria` devuelve el id.** En `services/usuariosAuditoriaService.js`, reemplazar la función por:

```js
/**
 * Registra una acción y devuelve el id de la fila. conexion: el pool o la conexión con la transacción del cambio abierta.
 * detalle: objeto (se guarda como JSON) o null.
 */
export const registrarAuditoria = async (conexion, { usuarioId, actorId = null, accion, detalle = null }) => {
  const [resultado] = await (conexion ?? pool).execute(
    'INSERT INTO usuarios_auditoria (usuario_id, actor_id, accion, detalle) VALUES (?, ?, ?, ?)',
    [usuarioId, actorId, accion, detalle === null ? null : JSON.stringify(detalle)]
  );
  return resultado.insertId;
};
```

- [ ] **Step 4: Plantilla del resumen.** Agregar al final de `services/emailTemplates.js`:

```js
// Resumen de los avisos al superadmin que no se enviaron durante su licencia
// (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.4). retenidos: filas del historial con created_at, actor y afectado.
export const resumenAvisosRetenidosTemplate = (retenidos) => {
  const lineas = retenidos.map(r => ({
    cuando: fechaHoraArgentina(new Date(r.created_at)),
    quien: r.actor_nombre ? `${r.actor_nombre} (${r.actor_username})` : 'Sin registro',
    aQuien: `${r.afectado_nombre} (${r.afectado_username})`,
    cambio: r.cambio
  }));
  const cuantos = lineas.length === 1 ? 'hubo un cambio' : `hubo ${lineas.length} cambios`;
  return {
    subject: 'RPAD: cambios en los usuarios durante tu licencia',
    html: plantillaSimple({
      titulo: 'Cambios en los usuarios durante tu licencia',
      parrafos: [
        `Mientras estabas de licencia ${cuantos} que te habrían llegado como aviso:`,
        ...lineas.map(l => `${escapeHtml(l.cuando)} h – <strong>${escapeHtml(l.quien)}</strong>: ${escapeHtml(l.aQuien)}: <strong>${escapeHtml(l.cambio)}</strong>`)
      ],
      boton: { texto: 'Ver el panel de usuarios', url: `${RPAD_URL}/usuarios.html` },
      notas: ['Este resumen te llega porque sos superadmin y estos avisos no se enviaron durante tu licencia.']
    }),
    text: [
      `Mientras estabas de licencia ${cuantos} que te habrían llegado como aviso:`,
      ...lineas.map(l => `- ${l.cuando} h – ${l.quien}: ${l.aQuien}: ${l.cambio}`),
      '',
      `Panel de usuarios: ${RPAD_URL}/usuarios.html`
    ].join('\n')
  };
};
```

- [ ] **Step 5: Servicio** `services/avisosSuperadminService.js`:

```js
// Avisos por email al superadmin cuando otro usuario hace un cambio sensible (spec usuarios 10.3), retenidos mientras
// está de licencia y resumidos a la vuelta (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.4)
import pool from '../config/database.js';
import { sendEmail } from './emailService.js';
import { avisoSuperadminTemplate, resumenAvisosRetenidosTemplate } from './emailTemplates.js';
import { emailValido } from './usuariosReglas.js';
import { esDiaHabil, hoyArgentina } from './notasDigitalesCalendario.js';

const LARGO_AVISO = 300;

// Superadmins activos con email válido, y si están de licencia en la fecha
const superadmins = async (fecha) => {
  const [filas] = await pool.query(
    `SELECT u.email,
       EXISTS (SELECT 1 FROM usuarios_licencias l
               WHERE l.usuario_id = u.id AND l.anulada = 0 AND l.desde <= ? AND l.hasta >= ?) AS de_licencia
     FROM usuarios u WHERE u.rol = 'superadmin' AND u.activo = TRUE`,
    [fecha, fecha]
  );
  return filas.filter(f => emailValido(f.email)).map(f => ({ email: f.email, deLicencia: Boolean(Number(f.de_licencia)) }));
};

/**
 * Avisa al superadmin un cambio que hizo otro usuario. Si todos los superadmins están de licencia no se envía: el texto
 * queda retenido en la fila del historial (auditoriaId) para el resumen de la vuelta. Nunca hace fallar la operación.
 * actor: { id, rol } de quien hizo el cambio; afectado: { nombre_completo, username }.
 */
export const avisarAlSuperadmin = async ({ actor, afectado, cambio, auditoriaId = null, hoy = hoyArgentina() }) => {
  if (actor.rol === 'superadmin') return;
  try {
    const lista = await superadmins(hoy);
    if (lista.length === 0) return;
    const disponibles = lista.filter(s => !s.deLicencia).map(s => s.email);
    if (disponibles.length === 0) {
      if (auditoriaId) {
        await pool.execute('UPDATE usuarios_auditoria SET aviso_retenido = ? WHERE id = ?', [String(cambio).slice(0, LARGO_AVISO), auditoriaId]);
      }
      return;
    }
    const [[datosActor]] = await pool.execute('SELECT nombre_completo, username FROM usuarios WHERE id = ?', [actor.id]);
    const envio = await sendEmail({ ...avisoSuperadminTemplate({ actor: datosActor, afectado, cambio, fecha: new Date() }), to: disponibles });
    if (!envio.success) console.error('No se pudo avisar al superadmin:', envio.error);
  } catch (error) {
    console.error('No se pudo avisar al superadmin:', error);
  }
};

/**
 * En un día hábil, si hay avisos retenidos y algún superadmin disponible, un solo email con todos; al enviarse dejan de
 * estar retenidos. Devuelve { enviado, cantidad }. Si el envío falla lanza un error (la corrida diaria lo registra y los
 * avisos siguen retenidos para el día hábil siguiente).
 */
export const enviarResumenAvisosRetenidos = async ({ hoy }) => {
  if (!esDiaHabil(hoy)) return { enviado: false, cantidad: 0 };
  const [retenidos] = await pool.query(
    `SELECT a.id, a.aviso_retenido AS cambio, a.created_at,
            af.nombre_completo AS afectado_nombre, af.username AS afectado_username,
            ac.nombre_completo AS actor_nombre, ac.username AS actor_username
     FROM usuarios_auditoria a
     JOIN usuarios af ON af.id = a.usuario_id
     LEFT JOIN usuarios ac ON ac.id = a.actor_id
     WHERE a.aviso_retenido IS NOT NULL
     ORDER BY a.created_at, a.id`
  );
  if (retenidos.length === 0) return { enviado: false, cantidad: 0 };
  const disponibles = (await superadmins(hoy)).filter(s => !s.deLicencia).map(s => s.email);
  if (disponibles.length === 0) return { enviado: false, cantidad: retenidos.length };
  const envio = await sendEmail({ ...resumenAvisosRetenidosTemplate(retenidos), to: disponibles });
  if (!envio.success) throw new Error(`No se pudo enviar el resumen de avisos retenidos: ${envio.error}`);
  await pool.query('UPDATE usuarios_auditoria SET aviso_retenido = NULL WHERE id IN (?)', [retenidos.map(r => r.id)]);
  return { enviado: true, cantidad: retenidos.length };
};
```

- [ ] **Step 6: El panel usa el servicio.** En `controllers/usuariosController.js`:

(a) Imports: quitar `sendEmail` (`'../services/emailService.js'`) y `avisoSuperadminTemplate` (`'../services/emailTemplates.js'`), y agregar:

```js
import { avisarAlSuperadmin } from '../services/avisosSuperadminService.js';
```

(b) Borrar la función local `avisarAlSuperadmin` (líneas 79-92) y agregar en su lugar:

```js
// Aviso al superadmin por un cambio de este pedido (spec 10.3): lo retiene si está de licencia (spec 2026-10-15, 5.4)
const avisar = (req, afectado, cambio, auditoriaId) =>
  avisarAlSuperadmin({ actor: { id: req.user.userId, rol: req.user.rol }, afectado, cambio, auditoriaId });
```

(c) `crearUsuario`: declarar `let auditoriaId;` junto a `let id;`, guardar el resultado de `registrarAuditoria` (`auditoriaId = await registrarAuditoria(conexion, { … accion: 'alta' … });`) y reemplazar `await avisarAlSuperadmin(req, usuario, \`Alta como ${TEXTO_ROL.admin}\`);` por `await avisar(req, usuario, \`Alta como ${TEXTO_ROL.admin}\`, auditoriaId);`.

(d) `actualizarUsuario`: declarar `let auditoriaId = null;` junto a `let campos = {};`; en el bloque que registra, guardar los ids:

```js
      if (Object.keys(campos).length > 0) {
        auditoriaId = await registrarAuditoria(conexion, { usuarioId: id, actorId: req.user.userId, accion: 'edicion', detalle: { campos } });
      }
      if (rolNuevo) {
        auditoriaId = await registrarAuditoria(conexion, {
          usuarioId: id, actorId: req.user.userId, accion: 'cambio_rol', detalle: { antes: antes.rol, despues: rolNuevo }
        });
      }
```

y reemplazar `if (avisos.length > 0) await avisarAlSuperadmin(req, despues, avisos.join('; '));` por `if (avisos.length > 0) await avisar(req, despues, avisos.join('; '), auditoriaId);`.

(e) `desactivarUsuario`: declarar `let auditoriaId;` junto a `let usuario;`, guardar el id de `registrarAuditoria(… 'desactivacion' …)` y reemplazar `await avisarAlSuperadmin(req, usuario, 'Desactivado');` por `await avisar(req, usuario, 'Desactivado', auditoriaId);`.

(f) `reactivarUsuario`: declarar `let auditoriaId;` antes del `try`, guardar el id de `registrarAuditoria(… 'reactivacion' …)` y reemplazar `if (esAdmin(reactivado.rol)) await avisarAlSuperadmin(req, reactivado, 'Reactivado');` por `if (esAdmin(reactivado.rol)) await avisar(req, reactivado, 'Reactivado', auditoriaId);`.

Verificar: `grep -n "avisarAlSuperadmin\|sendEmail\|avisoSuperadminTemplate" controllers/usuariosController.js` muestra solo el import nuevo y el uso dentro de `avisar`.

- [ ] **Step 7: Cambios pendientes sin quien está de licencia.** En `services/avisosDiariosService.js`, reemplazar `adminsConEmail` por:

```js
// Admins activos con email que ya pueden ingresar y aprobar (con contraseña definida), y si están de licencia en la fecha
const adminsConEmail = async (hoy) => {
  const [rows] = await pool.execute(
    `SELECT u.id, u.username, u.nombre_completo, u.email,
       EXISTS (SELECT 1 FROM usuarios_licencias l
               WHERE l.usuario_id = u.id AND l.anulada = 0 AND l.desde <= ? AND l.hasta >= ?) AS de_licencia
     FROM usuarios u
     WHERE u.rol IN ('admin', 'superadmin') AND u.activo = TRUE AND u.email IS NOT NULL AND u.password_hash IS NOT NULL`,
    [hoy, hoy]
  );
  return rows.map(r => ({ ...r, de_licencia: Boolean(Number(r.de_licencia)) }));
};
```

y en `enviarCambiosPendientes`: inicializar `deLicencia: []` en `resultados`, recorrer `await adminsConEmail(hoy)` y, como primera instrucción del `for`:

```js
    // Durante la licencia no recibe emails del sistema (spec 2026-10-15, 5.3)
    if (admin.de_licencia) {
      resultados.deLicencia.push(admin.username);
      continue;
    }
```

Actualizar el comentario JSDoc de `enviarCambiosPendientes` para incluir `deLicencia: [username]`.

- [ ] **Step 8: Resumen en la corrida diaria.** En `controllers/notificacionesController.js`:

(a) Import: `import { enviarResumenAvisosRetenidos } from '../services/avisosSuperadminService.js';`

(b) En `ejecutarNotificacionesDiarias`, inicializar `avisos_retenidos: null` en `resultados` y, después del bloque del aviso a las áreas (y de `resultados.dia_habil ??= …`), agregar:

```js
    // Resumen de los avisos al superadmin retenidos durante su licencia (spec 2026-10-15, 5.4). Aislado: un error acá no
    // saltea las Notas Digitales y los avisos quedan retenidos para el día hábil siguiente
    try {
      resultados.avisos_retenidos = await enviarResumenAvisosRetenidos({ hoy });
    } catch (error) {
      console.error('Error en el resumen de avisos retenidos:', error);
      resultados.errores.push({ tipo: 'avisos-retenidos', error: error.message });
    }
```

- [ ] **Step 9: Correr los tests de la tarea y los del panel**

Run: `node --test tests/avisos-superadmin.test.js tests/avisos-diarios.test.js tests/usuarios-panel.test.js tests/notas-api.test.js`
Expected: PASS (los avisos del panel se comportan igual que antes).

- [ ] **Step 10: Suite completa** — ninguna falla nueva.

- [ ] **Step 11: Commit**

```bash
git add services/usuariosAuditoriaService.js services/avisosSuperadminService.js services/emailTemplates.js controllers/usuariosController.js services/avisosDiariosService.js controllers/notificacionesController.js tests/avisos-superadmin.test.js tests/avisos-diarios.test.js
git commit -m "feat: sin emails personales durante la licencia; avisos al superadmin retenidos y resumen a la vuelta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 4: API de licencias y marca en la lista de usuarios

**Files:**
- Create: `controllers/licenciasController.js`
- Modify: `routes/index.js`
- Modify: `controllers/usuariosController.js` (marca de licencia)
- Test: `tests/licencias-api.test.js` (nuevo), `tests/permisos.test.js` (agregar rutas)

**Interfaces:**
- Consumes: Task 2 (`licenciasReglas`), Task 3 (`registrarAuditoria` con id, `avisarAlSuperadmin`), `ahoraArgentina`, `hoyArgentina`, `formatoCorto`, `diaHabilAnterior`, `sumarDias`.
- Produces (rutas, todas con `authMiddleware, adminOnly`):
  - `GET /api/usuarios/licencias[?incluir_pasadas=1]` → `data: { hoy, firmante_titular_id, soy_titular, licencias: [licencia], usuarios: [{ id, nombre_completo, rol }], autorizables: [{ id, nombre_completo }] }`. Cada licencia: `{ id, usuario_id, desde, hasta, autorizado_id, autorizado_at, anulada, creado_por, usuario_nombre, usuario_username, usuario_rol, autorizado_nombre, creado_por_nombre, estado, vispera }` (`vispera` solo en las del firmante titular).
  - `POST /api/usuarios/licencias` `{ usuario_id, desde, hasta, autorizado_id? }` → 201 `data: licencia`.
  - `PUT /api/usuarios/licencias/:id` `{ desde?, hasta?, autorizado_id? }` → `data: licencia`. Si cambian las fechas o la persona autorizada, `nota_autorizacion_id` vuelve a NULL (spec 6.3): la nota de autorización anterior deja de valer.
  - `POST /api/usuarios/licencias/:id/anular` → `data: licencia`.
  - `GET /api/usuarios` y `GET /api/usuarios/:id`: cada usuario suma `licencia: { desde, hasta, en_curso } | null`.

- [ ] **Step 1: Tests que fallan.** Crear `tests/licencias-api.test.js`:

```js
// API de licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, 5 y 6.3), contra una base de prueba propia.
// La API usa la fecha real: las fechas de los tests se arman desde hoy.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query, mailpit, paraCasilla
} from './helpers.js';
import { hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const SOLO_TITULAR = 'La autorización para presentar las notas la da solo el firmante titular.';
let base, servidor, api, usuarios, dbReal;
const hoy = hoyArgentina();
const dia = (n) => sumarDias(hoy, n);

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_licencias_api');
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

beforeEach(async () => {
  await mailpit.vaciar();
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios_firmas');
  await query('UPDATE notas_digitales_config SET firmante_usuario_id = NULL');
});

const comoA = () => ({ token: usuarios.adminA.token });
const comoSuper = () => ({ token: usuarios.superadmin.token });
const conFirma = (usuario) => query(
  "INSERT INTO usuarios_firmas (usuario_id, nombre, cargo, imagen, mime) VALUES (?, 'Firma', 'Cargo', ?, 'image/png')", [usuario.id, PNG]
);
const titular = (usuario) => query('UPDATE notas_digitales_config SET firmante_usuario_id = ?', [usuario.id]);
const cargar = (cuerpo, opciones = comoA()) => api.post('/usuarios/licencias', cuerpo, opciones);
const historial = (usuarioId, accion) =>
  query('SELECT actor_id, detalle FROM usuarios_auditoria WHERE usuario_id = ? AND accion = ? ORDER BY id', [usuarioId, accion]);

describe('alta', () => {
  it('carga la licencia de un admin, la lista y deja el historial', async () => {
    const res = await cargar({ usuario_id: usuarios.adminB.id, desde: dia(5), hasta: dia(10) });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.estado, 'futura');
    assert.equal(res.body.data.usuario_id, usuarios.adminB.id);

    const lista = await api.get('/usuarios/licencias', comoA());
    assert.equal(lista.status, 200);
    assert.deepEqual(lista.body.data.licencias.map(l => [l.usuario_id, l.desde, l.hasta]), [[usuarios.adminB.id, dia(5), dia(10)]]);
    assert.ok(lista.body.data.usuarios.some(u => u.id === usuarios.superadmin.id));
    assert.ok(!lista.body.data.usuarios.some(u => u.id === usuarios.lector.id));

    const [fila] = await historial(usuarios.adminB.id, 'licencia_cargada');
    assert.equal(fila.actor_id, usuarios.adminA.id);
  });

  it('un lector no puede tener licencia', async () => {
    const res = await cargar({ usuario_id: usuarios.lector.id, desde: dia(1), hasta: dia(2) });
    assert.equal(res.status, 400);
    assert.equal(res.body.campo, 'usuario_id');
  });

  it('rechaza fechas inválidas y una licencia superpuesta con otra de la misma persona', async () => {
    assert.equal((await cargar({ usuario_id: usuarios.adminB.id, desde: dia(5), hasta: dia(2) })).status, 400);
    assert.equal((await cargar({ usuario_id: usuarios.adminB.id, desde: dia(-10), hasta: dia(-1) })).status, 400);
    assert.equal((await cargar({ usuario_id: usuarios.adminB.id, desde: dia(1), hasta: dia(5) })).status, 201);
    const repetida = await cargar({ usuario_id: usuarios.adminB.id, desde: dia(5), hasta: dia(8) });
    assert.equal(repetida.status, 409);
    assert.match(repetida.body.error, /Se superpone/);
  });

  it('dos cargas simultáneas superpuestas: se guarda una sola', async () => {
    const [r1, r2] = await Promise.all([
      cargar({ usuario_id: usuarios.adminB.id, desde: dia(20), hasta: dia(25) }),
      cargar({ usuario_id: usuarios.adminB.id, desde: dia(22), hasta: dia(28) }, comoSuper())
    ]);
    assert.deepEqual([r1.status, r2.status].sort(), [201, 409]);
    assert.equal((await query('SELECT COUNT(*) AS n FROM usuarios_licencias WHERE usuario_id = ?', [usuarios.adminB.id]))[0].n, 1);
  });

  it('cualquier admin puede cargar la licencia del superadmin, y el superadmin recibe el aviso', async () => {
    const res = await cargar({ usuario_id: usuarios.superadmin.id, desde: dia(30), hasta: dia(40) });
    assert.equal(res.status, 201);
    const [aviso] = await mailpit.esperar(m => m.Subject === 'RPAD: cambio en los usuarios' && paraCasilla(usuarios.superadmin.email)(m));
    assert.match(await mailpit.html(aviso.ID), /Licencia cargada/);
  });
});

describe('edición y anulación (spec 5.2)', () => {
  it('una futura se edita y se anula', async () => {
    const { body } = await cargar({ usuario_id: usuarios.adminB.id, desde: dia(5), hasta: dia(10) });
    const editada = await api.put(`/usuarios/licencias/${body.data.id}`, { desde: dia(6), hasta: dia(12) }, comoA());
    assert.equal(editada.status, 200);
    assert.deepEqual([editada.body.data.desde, editada.body.data.hasta], [dia(6), dia(12)]);
    const anulada = await api.post(`/usuarios/licencias/${body.data.id}/anular`, {}, comoA());
    assert.equal(anulada.status, 200);
    assert.equal(anulada.body.data.estado, 'anulada');
    assert.equal((await historial(usuarios.adminB.id, 'licencia_editada')).length, 1);
    assert.equal((await historial(usuarios.adminB.id, 'licencia_anulada')).length, 1);
  });

  it('una en curso solo cambia el fin, y no se anula', async () => {
    const { insertId: id } = await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuarios.adminB.id, dia(-3), dia(5)]);
    assert.equal((await api.put(`/usuarios/licencias/${id}`, { desde: dia(-2), hasta: dia(5) }, comoA())).status, 400);
    const cortada = await api.put(`/usuarios/licencias/${id}`, { desde: dia(-3), hasta: dia(-1) }, comoA());
    assert.equal(cortada.status, 200);
    assert.equal(cortada.body.data.estado, 'pasada');
    const { insertId: otra } = await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuarios.adminB.id, dia(-1), dia(5)]);
    assert.equal((await api.post(`/usuarios/licencias/${otra}/anular`, {}, comoA())).status, 409);
  });
});

describe('autorización del firmante titular (spec 6.3)', () => {
  it('solo la licencia del titular lleva autorizado, y solo la carga el titular', async () => {
    await titular(usuarios.superadmin);
    await conFirma(usuarios.adminA);
    const ajena = await cargar({ usuario_id: usuarios.adminB.id, desde: dia(5), hasta: dia(10), autorizado_id: usuarios.adminA.id }, comoSuper());
    assert.equal(ajena.status, 403);
    const porOtro = await cargar({ usuario_id: usuarios.superadmin.id, desde: dia(5), hasta: dia(10), autorizado_id: usuarios.adminA.id });
    assert.equal(porOtro.status, 403);
    assert.equal(porOtro.body.error, SOLO_TITULAR);

    const propia = await cargar({ usuario_id: usuarios.superadmin.id, desde: dia(5), hasta: dia(10), autorizado_id: usuarios.adminA.id }, comoSuper());
    assert.equal(propia.status, 201, JSON.stringify(propia.body));
    assert.equal(propia.body.data.autorizado_id, usuarios.adminA.id);
    assert.match(propia.body.data.autorizado_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

    const lista = await api.get('/usuarios/licencias', comoSuper());
    assert.equal(lista.body.data.soy_titular, true);
    assert.deepEqual(lista.body.data.autorizables.map(a => a.id), [usuarios.adminA.id]);
    assert.ok(lista.body.data.licencias[0].vispera);
  });

  it('no se puede autorizar a alguien sin firma, ni a alguien de licencia en esas fechas', async () => {
    await titular(usuarios.superadmin);
    const sinFirma = await cargar({ usuario_id: usuarios.superadmin.id, desde: dia(5), hasta: dia(10), autorizado_id: usuarios.adminB.id }, comoSuper());
    assert.equal(sinFirma.status, 400);
    assert.equal(sinFirma.body.campo, 'autorizado_id');

    await conFirma(usuarios.adminB);
    assert.equal((await cargar({ usuario_id: usuarios.adminB.id, desde: dia(8), hasta: dia(12) })).status, 201);
    const ocupado = await cargar({ usuario_id: usuarios.superadmin.id, desde: dia(5), hasta: dia(10), autorizado_id: usuarios.adminB.id }, comoSuper());
    assert.equal(ocupado.status, 409);
  });

  it('la persona autorizada no puede tomarse una licencia que se superponga', async () => {
    await titular(usuarios.superadmin);
    await conFirma(usuarios.adminA);
    await cargar({ usuario_id: usuarios.superadmin.id, desde: dia(5), hasta: dia(10), autorizado_id: usuarios.adminA.id }, comoSuper());
    const res = await cargar({ usuario_id: usuarios.adminA.id, desde: dia(9), hasta: dia(15) });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /autorizada/);
  });

  it('cambiar las fechas o la persona autorizada deja sin efecto la nota de autorización', async () => {
    await titular(usuarios.superadmin);
    await conFirma(usuarios.adminA);
    await conFirma(usuarios.adminB);
    const { body } = await cargar({ usuario_id: usuarios.superadmin.id, desde: dia(5), hasta: dia(10), autorizado_id: usuarios.adminA.id }, comoSuper());
    const nota = async () => (await query('SELECT nota_autorizacion_id AS n FROM usuarios_licencias WHERE id = ?', [body.data.id]))[0].n;
    await query('UPDATE usuarios_licencias SET nota_autorizacion_id = 999 WHERE id = ?', [body.data.id]);
    assert.equal((await api.put(`/usuarios/licencias/${body.data.id}`, { hasta: dia(12) }, comoSuper())).status, 200);
    assert.equal(await nota(), null);
    await query('UPDATE usuarios_licencias SET nota_autorizacion_id = 999 WHERE id = ?', [body.data.id]);
    assert.equal((await api.put(`/usuarios/licencias/${body.data.id}`, { autorizado_id: usuarios.adminB.id }, comoSuper())).status, 200);
    assert.equal(await nota(), null);
  });

  it('otro admin puede cambiar las fechas de la licencia del titular, pero no la autorización', async () => {
    await titular(usuarios.superadmin);
    await conFirma(usuarios.adminA);
    const { body } = await cargar({ usuario_id: usuarios.superadmin.id, desde: dia(5), hasta: dia(10), autorizado_id: usuarios.adminA.id }, comoSuper());
    assert.equal((await api.put(`/usuarios/licencias/${body.data.id}`, { hasta: dia(11) }, comoA())).status, 200);
    const quitar = await api.put(`/usuarios/licencias/${body.data.id}`, { autorizado_id: null }, comoA());
    assert.equal(quitar.status, 403);
    assert.equal(quitar.body.error, SOLO_TITULAR);
  });
});

describe('marca en la lista de usuarios (spec 5.5)', () => {
  it('en curso y próxima (dentro de 30 días); más lejos no', async () => {
    await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuarios.adminB.id, dia(-1), dia(3)]);
    await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuarios.adminA.id, dia(10), dia(12)]);
    await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuarios.superadmin.id, dia(45), dia(50)]);
    const { body } = await api.get('/usuarios', comoA());
    const de = (u) => body.data.usuarios.find(x => x.id === u.id).licencia;
    assert.deepEqual(de(usuarios.adminB), { desde: dia(-1), hasta: dia(3), en_curso: true });
    assert.deepEqual(de(usuarios.adminA), { desde: dia(10), hasta: dia(12), en_curso: false });
    assert.equal(de(usuarios.superadmin), null);
    assert.deepEqual((await api.get(`/usuarios/${usuarios.adminB.id}`, comoA())).body.data.licencia, { desde: dia(-1), hasta: dia(3), en_curso: true });
  });
});
```

En `tests/permisos.test.js`, agregar a `RUTAS_SOLO_ADMIN`:

```js
  ['GET', '/usuarios/licencias'],
  ['POST', '/usuarios/licencias'],
  ['PUT', '/usuarios/licencias/1'],
  ['POST', '/usuarios/licencias/1/anular'],
```

y a `RUTAS_GET_ADMIN`: `'/usuarios/licencias'`.

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/licencias-api.test.js tests/permisos.test.js`
Expected: FAIL (404 en las rutas nuevas; en permisos, el lector recibe 404 en vez de 403 y el visitante 401 pasa).

- [ ] **Step 3: Controlador** `controllers/licenciasController.js`:

```js
// Licencias de quienes reciben avisos (spec 2026-10-15-dias-habiles-licencias-auditoria, sección 5). Las rutas exigen
// authMiddleware + adminOnly. La autorización para presentar las notas (6.3) la da solo el firmante titular.
import pool from '../config/database.js';
import { registrarAuditoria } from '../services/usuariosAuditoriaService.js';
import { avisarAlSuperadmin } from '../services/avisosSuperadminService.js';
import { hoyArgentina, ahoraArgentina, formatoCorto, diaHabilAnterior } from '../services/notasDigitalesCalendario.js';
import {
  ROLES_CON_LICENCIA, puedeTenerLicencia, estadoDeLicencia, validarFechasNuevas, validarEdicion, puedeAnularse
} from '../services/licenciasReglas.js';

const MENSAJE_ERROR = 'Error interno del servidor';
const MENSAJE_SOLO_TITULAR = 'La autorización para presentar las notas la da solo el firmante titular.';

const responderError = (res, status, error, campo) =>
  res.status(status).json({ success: false, error, ...(campo ? { campo } : {}) });

const idDe = (valor) => {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const periodo = ({ desde, hasta }) => `del ${formatoCorto(desde)} al ${formatoCorto(hasta)}`;

// autorizado_id del cuerpo: undefined si no vino, null para "nadie", un id o NaN si es inválido
const autorizadoDelCuerpo = (cuerpo) => {
  if (!Object.hasOwn(cuerpo, 'autorizado_id')) return undefined;
  const valor = cuerpo.autorizado_id;
  if (valor === null || valor === '') return null;
  return idDe(valor) ?? Number.NaN;
};

const COLUMNAS = `
  l.id, l.usuario_id, DATE_FORMAT(l.desde, '%Y-%m-%d') AS desde, DATE_FORMAT(l.hasta, '%Y-%m-%d') AS hasta,
  l.autorizado_id, DATE_FORMAT(l.autorizado_at, '%Y-%m-%d %H:%i') AS autorizado_at, l.anulada, l.creado_por,
  u.nombre_completo AS usuario_nombre, u.username AS usuario_username, u.rol AS usuario_rol,
  au.nombre_completo AS autorizado_nombre, cr.nombre_completo AS creado_por_nombre`;
const DESDE = `
  FROM usuarios_licencias l
  JOIN usuarios u ON u.id = l.usuario_id
  LEFT JOIN usuarios au ON au.id = l.autorizado_id
  LEFT JOIN usuarios cr ON cr.id = l.creado_por`;

const firmanteTitular = async (conexion = pool) => {
  const [[config]] = await conexion.query('SELECT firmante_usuario_id FROM notas_digitales_config WHERE id = 1');
  return config?.firmante_usuario_id ?? null;
};

const aRespuesta = (fila, hoy, titular) => ({
  ...fila,
  anulada: Boolean(fila.anulada),
  estado: estadoDeLicencia(fila, hoy),
  // Del firmante titular: el día en que saldrían los avisos anticipados si no hay autorizado (spec 7.3)
  vispera: fila.usuario_id === titular ? diaHabilAnterior(fila.desde) : null
});

const buscarLicencia = async (conexion, id) => {
  const [filas] = await conexion.query(`SELECT ${COLUMNAS} ${DESDE} WHERE l.id = ?`, [id]);
  return filas[0] ?? null;
};

// Admins y editores que el titular puede autorizar (spec 6.3): activos, con contraseña y con la imagen de su firma
const autorizables = async (conexion, titular) => {
  const [filas] = await conexion.query(
    `SELECT u.id, u.nombre_completo FROM usuarios u JOIN usuarios_firmas f ON f.usuario_id = u.id
     WHERE u.rol IN ('admin', 'editor') AND u.activo = TRUE AND u.password_hash IS NOT NULL AND f.imagen IS NOT NULL
       AND u.id <> ?
     ORDER BY u.nombre_completo`,
    [titular ?? 0]
  );
  return filas;
};

/**
 * Reglas que necesitan la base (spec 5.2 y 6.3). autorizadoNuevo: la autorización se está dando o cambiando en este
 * pedido (si no, solo se revisa que la persona ya autorizada no tenga licencia en las fechas nuevas).
 * Devuelve [status, mensaje, campo] si no se puede, o null.
 */
const rechazoDeLaBase = async (conexion, { licenciaId = 0, usuarioId, desde, hasta, autorizadoId, autorizadoNuevo }) => {
  const [[usuario]] = await conexion.query('SELECT rol, activo FROM usuarios WHERE id = ?', [usuarioId]);
  if (!usuario || !usuario.activo || !puedeTenerLicencia(usuario.rol)) {
    return [400, 'Solo pueden tener licencia el superadmin, los admins y los editores activos.', 'usuario_id'];
  }
  const [[propia]] = await conexion.query(
    `SELECT DATE_FORMAT(desde, '%Y-%m-%d') AS desde, DATE_FORMAT(hasta, '%Y-%m-%d') AS hasta FROM usuarios_licencias
     WHERE usuario_id = ? AND anulada = 0 AND id <> ? AND desde <= ? AND hasta >= ? LIMIT 1`,
    [usuarioId, licenciaId, hasta, desde]
  );
  if (propia) return [409, `Se superpone con otra licencia de la misma persona (${periodo(propia)}).`, 'fechas'];
  const [[comoAutorizada]] = await conexion.query(
    `SELECT u.nombre_completo, DATE_FORMAT(l.desde, '%Y-%m-%d') AS desde, DATE_FORMAT(l.hasta, '%Y-%m-%d') AS hasta
     FROM usuarios_licencias l JOIN usuarios u ON u.id = l.usuario_id
     WHERE l.autorizado_id = ? AND l.anulada = 0 AND l.id <> ? AND l.desde <= ? AND l.hasta >= ? LIMIT 1`,
    [usuarioId, licenciaId, hasta, desde]
  );
  if (comoAutorizada) {
    return [409, `Es la persona autorizada a presentar las notas durante la licencia de ${comoAutorizada.nombre_completo} (${periodo(comoAutorizada)}): primero hay que cambiar esa autorización.`, 'fechas'];
  }
  if (autorizadoId && autorizadoNuevo) {
    const titular = await firmanteTitular(conexion);
    if (usuarioId !== titular) return [400, 'Solo la licencia del firmante titular de las notas lleva una persona autorizada.', 'autorizado_id'];
    if (!(await autorizables(conexion, titular)).some(a => a.id === autorizadoId)) {
      return [400, 'Solo se puede autorizar a un admin o editor activo, con su firma cargada en Mi Perfil.', 'autorizado_id'];
    }
  }
  if (autorizadoId) {
    const [[ocupada]] = await conexion.query(
      'SELECT 1 AS si FROM usuarios_licencias WHERE usuario_id = ? AND anulada = 0 AND desde <= ? AND hasta >= ? LIMIT 1',
      [autorizadoId, hasta, desde]
    );
    if (ocupada) return [409, 'La persona autorizada tiene una licencia en esas fechas.', 'autorizado_id'];
  }
  return null;
};

// Aviso al superadmin si la licencia es suya y el cambio lo hizo otro (spec 5.2); lo retiene si ya está de licencia
const avisarSiEsDelSuperadmin = (req, licencia, cambio, auditoriaId, hoy) => (licencia.usuario_rol === 'superadmin'
  ? avisarAlSuperadmin({
    actor: { id: req.user.userId, rol: req.user.rol },
    afectado: { nombre_completo: licencia.usuario_nombre, username: licencia.usuario_username },
    cambio, auditoriaId, hoy
  })
  : Promise.resolve());

// Bloquea las filas de usuarios (son pocas) hasta el fin de la transacción, como el panel: dos cargas simultáneas para
// la misma persona se esperan y la segunda ve la primera
const bloquearUsuarios = (conexion) => conexion.query('SELECT id FROM usuarios ORDER BY id FOR UPDATE');

// GET /usuarios/licencias
export const listarLicencias = async (req, res) => {
  try {
    const hoy = hoyArgentina();
    const todas = req.query.incluir_pasadas === '1';
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} ${DESDE} ${todas ? '' : 'WHERE l.anulada = 0 AND l.hasta >= ?'} ORDER BY l.desde, u.nombre_completo`,
      todas ? [] : [hoy]
    );
    const titular = await firmanteTitular();
    const [conLicencia] = await pool.query(
      'SELECT id, nombre_completo, rol FROM usuarios WHERE activo = TRUE AND rol IN (?) ORDER BY nombre_completo', [ROLES_CON_LICENCIA]
    );
    const soyTitular = titular !== null && titular === req.user.userId;
    res.json({
      success: true,
      data: {
        hoy,
        firmante_titular_id: titular,
        soy_titular: soyTitular,
        licencias: filas.map(f => aRespuesta(f, hoy, titular)),
        usuarios: conLicencia,
        autorizables: soyTitular ? await autorizables(pool, titular) : []
      }
    });
  } catch (error) {
    console.error('Error listando licencias:', error);
    responderError(res, 500, MENSAJE_ERROR);
  }
};

// POST /usuarios/licencias
export const crearLicencia = async (req, res) => {
  const hoy = hoyArgentina();
  const cuerpo = req.body ?? {};
  const usuarioId = idDe(cuerpo.usuario_id);
  if (!usuarioId) return responderError(res, 400, 'Elegí a quién corresponde la licencia.', 'usuario_id');
  const errorFechas = validarFechasNuevas(cuerpo, hoy);
  if (errorFechas) return responderError(res, 400, errorFechas, 'fechas');
  const autorizadoId = autorizadoDelCuerpo(cuerpo) ?? null;
  if (Number.isNaN(autorizadoId)) return responderError(res, 400, 'La persona autorizada no es válida.', 'autorizado_id');
  if (autorizadoId && req.user.userId !== usuarioId) return responderError(res, 403, MENSAJE_SOLO_TITULAR, 'autorizado_id');

  let conexion;
  let licencia;
  let auditoriaId;
  try {
    conexion = await pool.getConnection();
    await conexion.beginTransaction();
    await bloquearUsuarios(conexion);
    const rechazo = await rechazoDeLaBase(conexion, {
      usuarioId, desde: cuerpo.desde, hasta: cuerpo.hasta, autorizadoId, autorizadoNuevo: Boolean(autorizadoId)
    });
    if (rechazo) {
      await conexion.rollback();
      return responderError(res, ...rechazo);
    }
    const [resultado] = await conexion.query(
      'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, autorizado_id, autorizado_at, creado_por) VALUES (?, ?, ?, ?, ?, ?)',
      [usuarioId, cuerpo.desde, cuerpo.hasta, autorizadoId, autorizadoId ? ahoraArgentina() : null, req.user.userId]
    );
    licencia = await buscarLicencia(conexion, resultado.insertId);
    auditoriaId = await registrarAuditoria(conexion, {
      usuarioId, actorId: req.user.userId, accion: 'licencia_cargada',
      detalle: { licencia_id: licencia.id, desde: licencia.desde, hasta: licencia.hasta, autorizado_id: licencia.autorizado_id }
    });
    await conexion.commit();
  } catch (error) {
    await conexion?.rollback().catch(() => {});
    console.error('Error cargando la licencia:', error);
    return responderError(res, 500, MENSAJE_ERROR);
  } finally {
    conexion?.release();
  }

  try {
    await avisarSiEsDelSuperadmin(req, licencia, `Licencia cargada ${periodo(licencia)}`, auditoriaId, hoy);
    res.status(201).json({ success: true, data: aRespuesta(licencia, hoy, await firmanteTitular()), message: 'Licencia cargada' });
  } catch (error) {
    console.error('Error respondiendo la carga de la licencia:', error);
    responderError(res, 500, MENSAJE_ERROR);
  }
};

// PUT /usuarios/licencias/:id: fechas según el estado (spec 5.2) y, solo el titular, la persona autorizada (6.3)
export const editarLicencia = async (req, res) => {
  const id = idDe(req.params.id);
  if (!id) return responderError(res, 404, 'Licencia no encontrada');
  const hoy = hoyArgentina();
  const cuerpo = req.body ?? {};
  const autorizadoPedido = autorizadoDelCuerpo(cuerpo);
  if (Number.isNaN(autorizadoPedido)) return responderError(res, 400, 'La persona autorizada no es válida.', 'autorizado_id');

  let conexion;
  let antes;
  let despues;
  let auditoriaId = null;
  let sinCambios = false;
  try {
    conexion = await pool.getConnection();
    await conexion.beginTransaction();
    await bloquearUsuarios(conexion);
    antes = await buscarLicencia(conexion, id);
    if (!antes) {
      await conexion.rollback();
      return responderError(res, 404, 'Licencia no encontrada');
    }
    const { error, codigo, datos } = validarEdicion(antes, { desde: cuerpo.desde, hasta: cuerpo.hasta }, hoy);
    if (error) {
      await conexion.rollback();
      return responderError(res, codigo, error, 'fechas');
    }
    const autorizadoCambia = autorizadoPedido !== undefined && autorizadoPedido !== antes.autorizado_id;
    if (autorizadoCambia && req.user.userId !== antes.usuario_id) {
      await conexion.rollback();
      return responderError(res, 403, MENSAJE_SOLO_TITULAR, 'autorizado_id');
    }
    const autorizadoId = autorizadoCambia ? autorizadoPedido : antes.autorizado_id;
    const rechazo = await rechazoDeLaBase(conexion, {
      licenciaId: id, usuarioId: antes.usuario_id, ...datos, autorizadoId, autorizadoNuevo: autorizadoCambia
    });
    if (rechazo) {
      await conexion.rollback();
      return responderError(res, ...rechazo);
    }
    sinCambios = datos.desde === antes.desde && datos.hasta === antes.hasta && !autorizadoCambia;
    if (sinCambios) {
      await conexion.rollback();
      despues = antes;
    } else {
      // Columnas fijas del código; los valores van como parámetros
      const asignaciones = ['desde = ?', 'hasta = ?'];
      const valores = [datos.desde, datos.hasta];
      if (autorizadoCambia) {
        asignaciones.push('autorizado_id = ?', 'autorizado_at = ?');
        valores.push(autorizadoId, autorizadoId ? ahoraArgentina() : null);
      }
      // La nota de autorización dice a quién y entre qué fechas: si cambia algo, deja de valer y sale otra (spec 6.3)
      asignaciones.push('nota_autorizacion_id = NULL');
      await conexion.query(`UPDATE usuarios_licencias SET ${asignaciones.join(', ')} WHERE id = ?`, [...valores, id]);
      despues = await buscarLicencia(conexion, id);
      auditoriaId = await registrarAuditoria(conexion, {
        usuarioId: antes.usuario_id, actorId: req.user.userId, accion: 'licencia_editada',
        detalle: {
          licencia_id: id,
          antes: { desde: antes.desde, hasta: antes.hasta, autorizado_id: antes.autorizado_id },
          despues: { desde: despues.desde, hasta: despues.hasta, autorizado_id: despues.autorizado_id }
        }
      });
      await conexion.commit();
    }
  } catch (error) {
    await conexion?.rollback().catch(() => {});
    console.error('Error editando la licencia:', error);
    return responderError(res, 500, MENSAJE_ERROR);
  } finally {
    conexion?.release();
  }

  try {
    if (!sinCambios) {
      await avisarSiEsDelSuperadmin(req, despues, `Licencia modificada: ${periodo(despues)} (antes: ${periodo(antes)})`, auditoriaId, hoy);
    }
    res.json({ success: true, data: aRespuesta(despues, hoy, await firmanteTitular()), message: sinCambios ? 'Sin cambios' : 'Licencia modificada' });
  } catch (error) {
    console.error('Error respondiendo la edición de la licencia:', error);
    responderError(res, 500, MENSAJE_ERROR);
  }
};

// POST /usuarios/licencias/:id/anular: solo si todavía no empezó o empieza hoy (spec 5.2)
export const anularLicencia = async (req, res) => {
  const id = idDe(req.params.id);
  if (!id) return responderError(res, 404, 'Licencia no encontrada');
  const hoy = hoyArgentina();
  let conexion;
  let licencia;
  let auditoriaId;
  try {
    conexion = await pool.getConnection();
    await conexion.beginTransaction();
    await bloquearUsuarios(conexion);
    licencia = await buscarLicencia(conexion, id);
    let rechazo = null;
    if (!licencia) rechazo = [404, 'Licencia no encontrada'];
    else if (!puedeAnularse(licencia, hoy)) {
      rechazo = [409, 'Solo se puede anular una licencia que todavía no empezó o que empieza hoy. Para cortar una licencia en curso, cambiá la fecha de fin.'];
    }
    if (rechazo) {
      await conexion.rollback();
      return responderError(res, ...rechazo);
    }
    await conexion.query('UPDATE usuarios_licencias SET anulada = 1 WHERE id = ?', [id]);
    auditoriaId = await registrarAuditoria(conexion, {
      usuarioId: licencia.usuario_id, actorId: req.user.userId, accion: 'licencia_anulada',
      detalle: { licencia_id: id, desde: licencia.desde, hasta: licencia.hasta }
    });
    licencia = await buscarLicencia(conexion, id);
    await conexion.commit();
  } catch (error) {
    await conexion?.rollback().catch(() => {});
    console.error('Error anulando la licencia:', error);
    return responderError(res, 500, MENSAJE_ERROR);
  } finally {
    conexion?.release();
  }

  try {
    await avisarSiEsDelSuperadmin(req, licencia, `Licencia anulada (${periodo(licencia)})`, auditoriaId, hoy);
    res.json({ success: true, data: aRespuesta(licencia, hoy, await firmanteTitular()), message: 'Licencia anulada' });
  } catch (error) {
    console.error('Error respondiendo la anulación de la licencia:', error);
    responderError(res, 500, MENSAJE_ERROR);
  }
};
```

- [ ] **Step 4: Rutas.** En `routes/index.js`, importar los cuatro handlers:

```js
import { listarLicencias, crearLicencia, editarLicencia, anularLicencia } from '../controllers/licenciasController.js';
```

y agregarlas **antes** de `router.get('/usuarios/:id', …)` (si no, `licencias` se tomaría como un id):

```js
// Licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, 5): antes de /usuarios/:id
router.get('/usuarios/licencias', authMiddleware, adminOnly, listarLicencias);
router.post('/usuarios/licencias', authMiddleware, adminOnly, crearLicencia);
router.put('/usuarios/licencias/:id', authMiddleware, adminOnly, editarLicencia);
router.post('/usuarios/licencias/:id/anular', authMiddleware, adminOnly, anularLicencia);
```

- [ ] **Step 5: Marca de licencia en la lista** (`controllers/usuariosController.js`):

(a) Import: `import { hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';`

(b) Agregar, después de `buscarUsuario`:

```js
// Licencia en curso o que empieza en los próximos 30 días de cada usuario (spec 2026-10-15, 5.5): Map id → licencia
const licenciasVisibles = async () => {
  const hoy = hoyArgentina();
  const [filas] = await pool.query(
    `SELECT usuario_id, DATE_FORMAT(desde, '%Y-%m-%d') AS desde, DATE_FORMAT(hasta, '%Y-%m-%d') AS hasta
     FROM usuarios_licencias WHERE anulada = 0 AND hasta >= ? AND desde <= ? ORDER BY desde`,
    [hoy, sumarDias(hoy, 30)]
  );
  const porUsuario = new Map();
  for (const f of filas) {
    if (!porUsuario.has(f.usuario_id)) porUsuario.set(f.usuario_id, { desde: f.desde, hasta: f.hasta, en_curso: f.desde <= hoy });
  }
  return porUsuario;
};
```

(c) `aRespuesta` recibe el Map como segundo parámetro opcional y suma el campo (al final del objeto):

```js
const aRespuesta = (u, licencias = new Map()) => ({
  // … los campos de hoy, sin cambios …
  created_at: u.created_at,
  licencia: licencias.get(u.id) ?? null
});
```

(d) En `listarUsuarios`: `const licencias = await licenciasVisibles();` y `usuarios: filas.map(u => aRespuesta(u, licencias))`. En `obtenerUsuario`: `data: { ...aRespuesta(usuario, await licenciasVisibles()), historial: … }`. Las demás respuestas quedan con `licencia: null`.

- [ ] **Step 6: Correr los tests de la tarea**

Run: `node --test tests/licencias-api.test.js tests/permisos.test.js tests/usuarios-panel.test.js`
Expected: PASS.

- [ ] **Step 7: Suite completa** — ninguna falla nueva.

- [ ] **Step 8: Commit**

```bash
git add controllers/licenciasController.js routes/index.js controllers/usuariosController.js tests/licencias-api.test.js tests/permisos.test.js
git commit -m "feat: API de licencias con autorización del firmante titular y marca en la lista de usuarios

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Firma de cada usuario (Mi Perfil) y firmante titular

**Files:**
- Create: `services/imagenesSubidas.js`
- Create: `services/firmasService.js`
- Create: `controllers/firmasController.js`
- Modify: `controllers/notasDigitalesController.js`
- Modify: `routes/index.js`
- Test: `tests/firmas.test.js` (nuevo), `tests/permisos.test.js` (agregar rutas)

**Interfaces:**
- Consumes: `validarImagenFirma`, `caracteresNoEscribibles` (`services/notasDigitalesPdf.js`); `obtenerConfig`.
- Produces:
  - `decodificarImagenSubida({ imagen, mime }, { tipoInvalido, validar }) → Buffer`; lanza `ImagenSubidaInvalida` (mensaje para el usuario).
  - `firmaDeUsuario(usuarioId, conexion?) → { usuario_id, nombre, cargo, imagen, mime } | null`
  - `validarTextosFirma({ nombre, cargo }) → { errores: [{ campo, error }], datos: { nombre, cargo } }`
  - `guardarFirma(usuarioId, { nombre, cargo, imagen, mime })` (imagen `null` = conserva la guardada)
  - Rutas: `GET/PUT /api/auth/profile/firma`, `GET /api/auth/profile/firma/imagen`, `GET /api/notificaciones/notas-digitales/config/firmantes`, `PUT /api/notificaciones/notas-digitales/config/firmante`.
  - `GET /config` suma `firmante: { id, nombre_completo, nombre, cargo, tiene_imagen } | null`; con firmante, `tiene_firma` dice si **su** firma tiene imagen y `GET /config/firma` devuelve **su** imagen.

- [ ] **Step 1: Tests que fallan.** Crear `tests/firmas.test.js`:

```js
// Firma de cada usuario en Mi Perfil y firmante titular de las notas (spec 2026-10-15-dias-habiles-licencias-auditoria, 6.1
// y 6.2), contra una base de prueba propia
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { pngRgba } from './firma-fixtures.js';

const FIRMA = pngRgba({ ancho: 40, alto: 20 });
const FIRMA_B64 = FIRMA.toString('base64');
let base, servidor, api, usuarios, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_firmas');
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

beforeEach(async () => {
  await query('DELETE FROM usuarios_firmas');
  await query("UPDATE notas_digitales_config SET firmante_usuario_id = NULL, envio_activo = 0, firma_nombre = 'Firma de Correos', firma_cargo = 'Cargo de Correos', firma_imagen = NULL");
});

const como = (u) => ({ token: usuarios[u].token });
const guardar = (cuerpo, u = 'adminA') => api.put('/auth/profile/firma', cuerpo, como(u));

describe('Mi firma', () => {
  it('sin firma cargada propone el nombre y el cargo del usuario', async () => {
    const res = await api.get('/auth/profile/firma', como('adminA'));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { cargada: false, nombre: 'Test adminA', cargo: '', tiene_imagen: false });
  });

  it('guarda nombre, cargo e imagen; después cambia los textos sin perder la imagen', async () => {
    const res = await guardar({ nombre: 'Téc. Nombre Apellido', cargo: 'Director de Prueba', imagen: FIRMA_B64, mime: 'image/png' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await guardar({ nombre: 'Téc. Nombre Apellido', cargo: 'Otro cargo' })).status, 200);
    const firma = await api.get('/auth/profile/firma', como('adminA'));
    assert.deepEqual(firma.body.data, { cargada: true, nombre: 'Téc. Nombre Apellido', cargo: 'Otro cargo', tiene_imagen: true });
    const imagen = await api.get('/auth/profile/firma/imagen', como('adminA'));
    assert.equal(imagen.status, 200);
    assert.ok(Buffer.compare(imagen.body, FIRMA) === 0);
  });

  it('nadie ve ni cambia la firma de otro: cada uno trabaja sobre la suya', async () => {
    await guardar({ nombre: 'Firma A', cargo: 'Cargo A', imagen: FIRMA_B64, mime: 'image/png' });
    assert.equal((await api.get('/auth/profile/firma/imagen', como('adminB'))).status, 404);
  });

  it('textos obligatorios; una tilde descompuesta se guarda en NFC; un carácter que el PDF no escribe se rechaza', async () => {
    assert.equal((await guardar({ nombre: '', cargo: 'Cargo' })).body.campo, 'nombre');
    assert.equal((await guardar({ nombre: 'Nombre', cargo: '   ' })).body.campo, 'cargo');
    const nfd = 'Te\u0301c. Nombre';
    assert.equal((await guardar({ nombre: nfd, cargo: 'Cargo' })).status, 200);
    assert.equal((await query('SELECT nombre FROM usuarios_firmas WHERE usuario_id = ?', [usuarios.adminA.id]))[0].nombre, 'Téc. Nombre');
    const res = await guardar({ nombre: 'Nombre ☎', cargo: 'Cargo' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /☎/);
  });

  it('una imagen inválida responde 400 con el mismo mensaje que la firma de Correos', async () => {
    const res = await guardar({ nombre: 'N', cargo: 'C', imagen: 'no es base64!', mime: 'image/png' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'La imagen no es base64 válido');
    assert.equal((await guardar({ nombre: 'N', cargo: 'C', imagen: FIRMA_B64, mime: 'image/gif' })).body.error, 'La firma debe ser una imagen PNG o JPEG');
  });

  it('un lector no tiene firma', async () => {
    assert.equal((await api.get('/auth/profile/firma', como('lector'))).status, 403);
  });
});

describe('firmante titular (spec 6.2)', () => {
  it('solo el superadmin lo elige, entre superadmin y admins con firma', async () => {
    await guardar({ nombre: 'Firma Super', cargo: 'Cargo Super', imagen: FIRMA_B64, mime: 'image/png' }, 'superadmin');
    const candidatos = await api.get('/notificaciones/notas-digitales/config/firmantes', como('adminA'));
    assert.deepEqual(candidatos.body.data.map(c => c.id), [usuarios.superadmin.id]);

    const porAdmin = await api.put('/notificaciones/notas-digitales/config/firmante', { usuario_id: usuarios.superadmin.id }, como('adminA'));
    assert.equal(porAdmin.status, 403);
    assert.equal(porAdmin.body.error, 'Solo el superadmin elige al firmante titular.');
    assert.equal((await api.put('/notificaciones/notas-digitales/config/firmante', { usuario_id: usuarios.adminB.id }, como('superadmin'))).status, 400);

    const res = await api.put('/notificaciones/notas-digitales/config/firmante', { usuario_id: usuarios.superadmin.id }, como('superadmin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.firmante, {
      id: usuarios.superadmin.id, nombre_completo: 'Test superadmin', nombre: 'Firma Super', cargo: 'Cargo Super', tiene_imagen: true
    });
    assert.equal(res.body.data.tiene_firma, true);
  });

  it('con firmante elegido, la imagen de la firma de Correos es la suya y la de Correos ya no se carga', async () => {
    await guardar({ nombre: 'Firma Super', cargo: 'Cargo Super', imagen: FIRMA_B64, mime: 'image/png' }, 'superadmin');
    await query('UPDATE notas_digitales_config SET firmante_usuario_id = ?', [usuarios.superadmin.id]);
    const imagen = await api.get('/notificaciones/notas-digitales/config/firma', como('adminA'));
    assert.equal(imagen.status, 200);
    assert.ok(Buffer.compare(imagen.body, FIRMA) === 0);
    const subir = await api.put('/notificaciones/notas-digitales/config/firma', { imagen: FIRMA_B64, mime: 'image/png' }, como('adminA'));
    assert.equal(subir.status, 409);
    assert.equal(subir.body.error, 'Con un firmante titular elegido, la firma se carga en su Mi Perfil.');
  });

  it('sin firmante elegido, todo como antes: la firma de Correos se sube y la config no trae firmante', async () => {
    const subir = await api.put('/notificaciones/notas-digitales/config/firma', { imagen: FIRMA_B64, mime: 'image/png' }, como('adminA'));
    assert.equal(subir.status, 200);
    const config = await api.get('/notificaciones/notas-digitales/config', como('adminA'));
    assert.equal(config.body.data.firmante, null);
    assert.equal(config.body.data.tiene_firma, true);
  });

  it('volver a "nadie" se rechaza si el envío está activo y la firma de Correos está incompleta', async () => {
    await guardar({ nombre: 'Firma Super', cargo: 'Cargo Super' }, 'superadmin');
    await query("UPDATE notas_digitales_config SET firmante_usuario_id = ?, envio_activo = 1, firma_nombre = '', para_interna = 'mit@rpad.test', para_externa = 'mit@rpad.test'", [usuarios.superadmin.id]);
    const res = await api.put('/notificaciones/notas-digitales/config/firmante', { usuario_id: null }, como('superadmin'));
    assert.equal(res.status, 400);
    assert.match(res.body.error, /nombre de la firma/);
  });
});
```

En `tests/permisos.test.js`, agregar a `RUTAS_SOLO_ADMIN`:

```js
  ['GET', '/auth/profile/firma'],
  ['PUT', '/auth/profile/firma'],
  ['GET', '/auth/profile/firma/imagen'],
  ['GET', '/notificaciones/notas-digitales/config/firmantes'],
  ['PUT', '/notificaciones/notas-digitales/config/firmante'],
```

y a `RUTAS_GET_ADMIN`: `'/auth/profile/firma'`, `'/notificaciones/notas-digitales/config/firmantes'`.

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/firmas.test.js tests/permisos.test.js`
Expected: FAIL (rutas inexistentes).

- [ ] **Step 3: `services/imagenesSubidas.js`** (la validación de hoy de `notasDigitalesController.subirImagen`, compartida):

```js
// Imágenes que llegan en el cuerpo de un pedido como base64 (firma y banner del membrete de Correos, firma de Mi Perfil).
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 9)
export const IMAGEN_MAX_BYTES = 500 * 1024;
// Primeros bytes de cada formato aceptado
const CABECERAS = { 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/jpeg': [0xff, 0xd8, 0xff] };

export class ImagenSubidaInvalida extends Error {}

/**
 * { imagen: base64 o data URL, mime } → Buffer listo para guardar. Lanza ImagenSubidaInvalida con el mensaje para la
 * pantalla. tipoInvalido: el mensaje si el formato no es PNG ni JPEG; validar(datos, mime): decodifica la imagen y lanza
 * si está dañada (una imagen dañada con la cabecera correcta haría fallar cada nota).
 */
export const decodificarImagenSubida = ({ imagen, mime }, { tipoInvalido, validar }) => {
  // Object.hasOwn: 'constructor' o '__proto__' no son formatos válidos aunque existan en Object.prototype
  if (typeof mime !== 'string' || !Object.hasOwn(CABECERAS, mime) || typeof imagen !== 'string') {
    throw new ImagenSubidaInvalida(tipoInvalido);
  }
  const base64 = imagen.replace(/^data:[^;]+;base64,/, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new ImagenSubidaInvalida('La imagen no es base64 válido');
  const datos = Buffer.from(base64, 'base64');
  if (datos.length === 0 || datos.length > IMAGEN_MAX_BYTES) throw new ImagenSubidaInvalida('La imagen debe pesar como máximo 500 KB');
  if (!CABECERAS[mime].every((byte, i) => datos[i] === byte)) {
    throw new ImagenSubidaInvalida('El contenido no corresponde a una imagen PNG o JPEG');
  }
  try {
    validar(datos, mime);
  } catch (error) {
    throw new ImagenSubidaInvalida(error.message);
  }
  return datos;
};
```

- [ ] **Step 4: `services/firmasService.js`**:

```js
// Firma de cada usuario para las Notas Digitales (spec 2026-10-15-dias-habiles-licencias-auditoria, 6.1)
import pool from '../config/database.js';
import { caracteresNoEscribibles } from './notasDigitalesPdf.js';

const TEXTOS = [
  { campo: 'nombre', maximo: 150, etiqueta: 'El nombre de la firma' },
  { campo: 'cargo', maximo: 200, etiqueta: 'El cargo de la firma' }
];

export const firmaDeUsuario = async (usuarioId, conexion = pool) => {
  if (!usuarioId) return null;
  const [[fila]] = await conexion.query('SELECT usuario_id, nombre, cargo, imagen, mime FROM usuarios_firmas WHERE usuario_id = ?', [usuarioId]);
  return fila ?? null;
};

// Los dos textos van al PDF: obligatorios, en NFC y sin caracteres que Helvetica no puede escribir
export const validarTextosFirma = (entrada) => {
  const errores = [];
  const datos = {};
  for (const { campo, maximo, etiqueta } of TEXTOS) {
    const valor = entrada?.[campo];
    const texto = typeof valor === 'string' ? valor.normalize('NFC').trim() : '';
    const noEscribibles = caracteresNoEscribibles(texto);
    if (!texto) errores.push({ campo, error: `${etiqueta} es obligatorio` });
    else if (texto.length > maximo) errores.push({ campo, error: `${etiqueta} admite hasta ${maximo} caracteres` });
    else if (noEscribibles.length) errores.push({ campo, error: `${etiqueta} tiene caracteres que el PDF no puede escribir: ${noEscribibles.join(' ')}` });
    else datos[campo] = texto;
  }
  return { errores, datos };
};

// Guarda la firma propia. imagen null conserva la que ya estaba guardada.
export const guardarFirma = async (usuarioId, { nombre, cargo, imagen = null, mime = null }) => {
  await pool.query(
    `INSERT INTO usuarios_firmas (usuario_id, nombre, cargo, imagen, mime) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), cargo = VALUES(cargo),
       imagen = COALESCE(VALUES(imagen), imagen), mime = COALESCE(VALUES(mime), mime)`,
    [usuarioId, nombre, cargo, imagen, imagen ? mime : null]
  );
};
```

- [ ] **Step 5: `controllers/firmasController.js`**:

```js
// Firma propia para las Notas Digitales, en Mi Perfil (spec 2026-10-15-dias-habiles-licencias-auditoria, 6.1).
// Las rutas exigen authMiddleware + adminOnly: cada uno trabaja solo sobre su propia firma.
import pool from '../config/database.js';
import { firmaDeUsuario, validarTextosFirma, guardarFirma } from '../services/firmasService.js';
import { decodificarImagenSubida, ImagenSubidaInvalida } from '../services/imagenesSubidas.js';
import { validarImagenFirma } from '../services/notasDigitalesPdf.js';

const errorInterno = (res, mensaje, error) => {
  console.error(`${mensaje}:`, error);
  res.status(500).json({ success: false, error: mensaje });
};

const aRespuesta = async (usuarioId) => {
  const firma = await firmaDeUsuario(usuarioId);
  if (firma) return { cargada: true, nombre: firma.nombre, cargo: firma.cargo, tiene_imagen: Boolean(firma.imagen) };
  // Sin firma: se proponen el nombre y el cargo del usuario
  const [[usuario]] = await pool.query('SELECT nombre_completo, cargo FROM usuarios WHERE id = ?', [usuarioId]);
  return { cargada: false, nombre: usuario?.nombre_completo ?? '', cargo: usuario?.cargo ?? '', tiene_imagen: false };
};

// GET /auth/profile/firma
export const verMiFirma = async (req, res) => {
  try {
    res.json({ success: true, data: await aRespuesta(req.user.userId) });
  } catch (error) {
    errorInterno(res, 'Error al obtener la firma', error);
  }
};

// PUT /auth/profile/firma: { nombre, cargo, imagen?, mime? }
export const guardarMiFirma = async (req, res) => {
  try {
    const cuerpo = req.body ?? {};
    const { errores, datos } = validarTextosFirma(cuerpo);
    if (errores.length) return res.status(400).json({ success: false, error: errores[0].error, campo: errores[0].campo });
    let imagen = null;
    if (cuerpo.imagen !== undefined && cuerpo.imagen !== null) {
      try {
        imagen = decodificarImagenSubida(cuerpo, { tipoInvalido: 'La firma debe ser una imagen PNG o JPEG', validar: validarImagenFirma });
      } catch (error) {
        if (error instanceof ImagenSubidaInvalida) return res.status(400).json({ success: false, error: error.message, campo: 'imagen' });
        throw error;
      }
    }
    await guardarFirma(req.user.userId, { ...datos, imagen, mime: cuerpo.mime });
    res.json({ success: true, message: 'Firma guardada', data: await aRespuesta(req.user.userId) });
  } catch (error) {
    errorInterno(res, 'Error al guardar la firma', error);
  }
};

// GET /auth/profile/firma/imagen (404 si no hay)
export const verImagenMiFirma = async (req, res) => {
  try {
    const firma = await firmaDeUsuario(req.user.userId);
    if (!firma?.imagen) return res.status(404).json({ success: false, error: 'No hay imagen de la firma' });
    res.setHeader('Content-Type', firma.mime || 'image/png');
    res.send(firma.imagen);
  } catch (error) {
    errorInterno(res, 'Error al obtener la imagen de la firma', error);
  }
};
```

- [ ] **Step 6: Correos y el firmante titular** (`controllers/notasDigitalesController.js`):

(a) Imports: agregar

```js
import { decodificarImagenSubida, ImagenSubidaInvalida } from '../services/imagenesSubidas.js';
import { firmaDeUsuario } from '../services/firmasService.js';
```

y quitar las constantes `IMAGEN_MAX_BYTES` y `FIRMAS` (ahora en `imagenesSubidas.js`).

(b) Reemplazar `configPublica` por:

```js
// Firmante titular para la pantalla (spec 2026-10-15, 6.2), o null
const datosFirmante = async (usuarioId) => {
  if (!usuarioId) return null;
  const [[fila]] = await pool.query(
    `SELECT u.id, u.nombre_completo, f.nombre, f.cargo, (f.imagen IS NOT NULL) AS tiene_imagen
     FROM usuarios u LEFT JOIN usuarios_firmas f ON f.usuario_id = u.id WHERE u.id = ?`, [usuarioId]
  );
  return fila ? { ...fila, tiene_imagen: Boolean(fila.tiene_imagen) } : null;
};

// La configuración sin las imágenes: solo si están cargadas. Con firmante titular, la firma es la suya.
const configPublica = async ({ firma_imagen, membrete_imagen, ...resto }) => {
  const firmante = await datosFirmante(resto.firmante_usuario_id);
  return {
    ...resto,
    envio_activo: Boolean(resto.envio_activo),
    tiene_firma: firmante ? firmante.tiene_imagen : Boolean(firma_imagen),
    tiene_membrete: Boolean(membrete_imagen),
    firmante
  };
};
```

y cambiar sus dos usos a `await configPublica(…)` (en `verConfig` y al final de `guardarConfig`).

(c) En `guardarConfig`, la validación de `configuracionCompleta` pasa a considerar al titular:

```js
    const resultante = { ...(await obtenerConfig()), ...cambios };
    const faltan = notas.configuracionCompleta(resultante, await firmaDeUsuario(resultante.firmante_usuario_id));
```

(d) Reemplazar `subirImagen` y `verImagen` por:

```js
// PUT de una imagen de la configuración (firma o banner del membrete): { imagen: base64 o data URL, mime }
const subirImagen = (uso) => async (req, res) => {
  const definicion = IMAGENES[uso];
  // Todo el cuerpo del handler va dentro del try: Express 4 no atrapa los rechazos de un handler async
  // y una excepción sin atrapar tumbaría el proceso.
  try {
    // Con firmante titular elegido, la firma de las notas es la de su Mi Perfil (spec 2026-10-15, 6.2)
    if (uso === 'firma' && (await obtenerConfig()).firmante_usuario_id) {
      return res.status(409).json({ success: false, error: 'Con un firmante titular elegido, la firma se carga en su Mi Perfil.' });
    }
    let datos;
    try {
      datos = decodificarImagenSubida(req.body ?? {}, definicion);
    } catch (error) {
      if (error instanceof ImagenSubidaInvalida) return res.status(400).json({ success: false, error: error.message });
      throw error;
    }
    // Las columnas salen de IMAGENES, texto fijo del código
    await pool.query(`UPDATE notas_digitales_config SET ${definicion.imagen} = ?, ${definicion.mime} = ?, updated_by = ? WHERE id = 1`,
      [datos, req.body.mime, req.user?.userId ?? null]);
    res.json({ success: true, message: definicion.guardada });
  } catch (error) {
    errorInterno(res, definicion.errorGuardar, error);
  }
};

// GET de una imagen de la configuración, para la vista previa de la pantalla (404 si no hay). Con firmante titular, la
// firma es la de su Mi Perfil.
const verImagen = (uso) => async (req, res) => {
  const definicion = IMAGENES[uso];
  try {
    const guardada = await obtenerConfig();
    const fuente = uso === 'firma' && guardada.firmante_usuario_id
      ? await firmaDeUsuario(guardada.firmante_usuario_id)
      : { imagen: guardada[definicion.imagen], mime: guardada[definicion.mime] };
    if (!fuente?.imagen) return res.status(404).json({ success: false, error: definicion.falta });
    res.setHeader('Content-Type', fuente.mime || 'image/png');
    res.send(fuente.imagen);
  } catch (error) {
    errorInterno(res, definicion.errorObtener, error);
  }
};
```

(e) Agregar al final del archivo:

```js
// GET /config/firmantes: quiénes pueden ser firmante titular (spec 2026-10-15, 6.2): superadmin o admins activos con su
// firma cargada en Mi Perfil
export const listarFirmantes = async (req, res) => {
  try {
    const [filas] = await pool.query(
      `SELECT u.id, u.nombre_completo, u.rol, f.nombre, f.cargo, (f.imagen IS NOT NULL) AS tiene_imagen
       FROM usuarios u JOIN usuarios_firmas f ON f.usuario_id = u.id
       WHERE u.rol IN ('superadmin', 'admin') AND u.activo = TRUE
       ORDER BY u.nombre_completo`
    );
    res.json({ success: true, data: filas.map(f => ({ ...f, tiene_imagen: Boolean(f.tiene_imagen) })) });
  } catch (error) {
    errorInterno(res, 'Error al obtener los firmantes', error);
  }
};

// PUT /config/firmante: { usuario_id } o { usuario_id: null } para volver a la firma de Correos. Solo el superadmin.
export const elegirFirmante = async (req, res) => {
  try {
    if (req.user?.rol !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Solo el superadmin elige al firmante titular.' });
    }
    const crudo = req.body?.usuario_id;
    const usuarioId = crudo === null || crudo === '' || crudo === undefined ? null : idDe(crudo);
    if (crudo !== null && crudo !== '' && crudo !== undefined && !usuarioId) {
      return res.status(400).json({ success: false, error: 'Firmante inválido' });
    }
    if (usuarioId) {
      const [[candidato]] = await pool.query(
        `SELECT u.id FROM usuarios u JOIN usuarios_firmas f ON f.usuario_id = u.id
         WHERE u.id = ? AND u.rol IN ('superadmin', 'admin') AND u.activo = TRUE`, [usuarioId]
      );
      if (!candidato) {
        return res.status(400).json({ success: false, error: 'El firmante titular tiene que ser el superadmin o un admin activo, con su firma cargada en Mi Perfil.' });
      }
    }
    const resultante = { ...(await obtenerConfig()), firmante_usuario_id: usuarioId };
    const faltan = notas.configuracionCompleta(resultante, await firmaDeUsuario(usuarioId));
    if (resultante.envio_activo && faltan.length) {
      return res.status(400).json({ success: false, error: `No se puede con el envío automático activo: faltaría ${faltan.join(', ')}` });
    }
    await pool.query('UPDATE notas_digitales_config SET firmante_usuario_id = ?, updated_by = ? WHERE id = 1', [usuarioId, req.user.userId]);
    res.json({
      success: true,
      message: usuarioId ? 'Firmante titular elegido' : 'Las notas vuelven a usar la firma cargada en Correos',
      data: await configPublica(await obtenerConfig())
    });
  } catch (error) {
    errorInterno(res, 'Error al elegir el firmante titular', error);
  }
};
```

(f) `configuracionCompleta` (en `services/notasDigitales.js`) recibe la firma del titular. Reemplazarla por:

```js
// firmaTitular: la firma del firmante titular (firmasService.firmaDeUsuario), si hay uno elegido (spec 2026-10-15, 6.2)
export const configuracionCompleta = (config, firmaTitular = null) => {
  const faltan = [];
  for (const gestion of GESTIONES) {
    if (listaDeCorreos(config[`para_${gestion}`]).length === 0) faltan.push(`Para (gestión ${gestion})`);
  }
  const firma = config.firmante_usuario_id ? firmaTitular : { nombre: config.firma_nombre, cargo: config.firma_cargo };
  if (!String(firma?.nombre ?? '').trim()) faltan.push('nombre de la firma');
  if (!String(firma?.cargo ?? '').trim()) faltan.push('cargo de la firma');
  return faltan;
};
```

(Sus otros dos usos, en `correrPasos` y `estadoNotas`, se actualizan en las Tasks 7 y 8. Hasta entonces reciben `undefined` como segundo argumento y, sin firmante, se comportan igual que hoy.)

- [ ] **Step 7: Rutas** (`routes/index.js`):

```js
import { verMiFirma, guardarMiFirma, verImagenMiFirma } from '../controllers/firmasController.js';
```

Sumar `listarFirmantes, elegirFirmante` al import de `notasDigitalesController.js`, y agregar:

```js
// Mi firma (spec 2026-10-15-dias-habiles-licencias-auditoria, 6.1): admin y superadmin
router.get('/auth/profile/firma', authMiddleware, adminOnly, verMiFirma);
router.put('/auth/profile/firma', authMiddleware, adminOnly, guardarMiFirma);
router.get('/auth/profile/firma/imagen', authMiddleware, adminOnly, verImagenMiFirma);
```

(junto a las rutas de `/auth/profile`), y junto a las de `/notificaciones/notas-digitales/config/…` (antes de las de `/:id`):

```js
router.get('/notificaciones/notas-digitales/config/firmantes', authMiddleware, adminOnly, listarFirmantes);
router.put('/notificaciones/notas-digitales/config/firmante', authMiddleware, adminOnly, elegirFirmante);
```

- [ ] **Step 8: Correr los tests de la tarea y los de Notas Digitales**

Run: `node --test tests/firmas.test.js tests/permisos.test.js tests/notas-api.test.js`
Expected: PASS (la subida de la firma y del membrete de Correos se comporta igual que antes).

- [ ] **Step 9: Suite completa** — ninguna falla nueva.

- [ ] **Step 10: Commit**

```bash
git add services/imagenesSubidas.js services/firmasService.js controllers/firmasController.js controllers/notasDigitalesController.js services/notasDigitales.js routes/index.js tests/firmas.test.js tests/permisos.test.js
git commit -m "feat: firma de cada usuario en Mi Perfil y firmante titular de las notas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 6: Contenido y PDF: dos firmas, leyenda, párrafo y nota de autorización, asunto con rango

**Files:**
- Modify: `services/notasDigitalesContenido.js`
- Modify: `services/notasDigitalesPdf.js`
- Test: `tests/notas-contenido.test.js`, `tests/notas-pdf.test.js` (agregar)

**Interfaces:**
- Consumes: `textoRangoMeses` (Task 2).
- Produces:
  - `construirNota({ …, firma?, rangoVencimientos?, autorizacion? })`.
    - `firma`: `{ titular: { nombre, cargo }, presentante: { nombre, cargo } | null, leyenda: string | null }`. Sin `firma`, usa `config.firma_nombre`/`firma_cargo`, como hoy.
    - `rangoVencimientos`: `{ desde, hasta }` (fechas ISO), para el asunto de un aviso anticipado.
    - `autorizacion`: `{ nombre, cargo, desde, hasta }` (persona autorizada y licencia). La nota suma `autorizacion` con el párrafo "Asimismo, …" (spec 7.2).
  - `construirNotaDeAutorizacion({ numero, anio, esPrueba, fecha, firma, autorizacion }) → nota` con `tipo: 'autorizacion'`, `gestion: null`, sin secciones ni justificación.
  - `textoLeyendaAutorizacion({ presentante, titular, nota: { numero, anio }, licencia: { desde, hasta } }) → string` (la leyenda de spec 7.2; la usa la Task 7).
  - `nota.firma` sigue teniendo `nombre` y `cargo` (los del titular) y suma `presentante` (`{ nombre, cargo }` o `null`) y `leyenda`.
  - Los tres formatos (HTML, texto y PDF) omiten el título "Justificación:" cuando la nota no tiene justificación. Las notas de hoy siempre la tienen y no cambian.
  - `renderPdf(nota, { firmaImagen, presentanteImagen?, membreteImagen, membretePie })`.

- [ ] **Step 1: Tests de contenido.** Agregar al final de `tests/notas-contenido.test.js`, importando también `construirNotaDeAutorizacion` y `textoLeyendaAutorizacion` en la línea del import:

```js
const AUTORIZADA = { nombre: 'Persona Autorizada', cargo: 'Cargo Autorizado', desde: '2026-11-26', hasta: '2027-01-14' };
const PARRAFO_AUTORIZACION = 'Asimismo, por medio de la presente autorizo expresamente a Persona Autorizada, Cargo Autorizado, a presentar en mi nombre las Notas Digitales durante mi licencia, del 26/11/2026 al 14/01/2027, con el objetivo de mantener el correcto flujo de trabajo.';
const LEYENDA = 'Nota presentada por Persona Autorizada, Cargo Autorizado, en nombre de Persona Titular, Cargo Titular, conforme a la autorización conferida mediante Nota Digital N° 15/26 (licencia del 26/11/2026 al 14/01/2027).';

describe('firma con autorización (spec 2026-10-15-dias-habiles-licencias-auditoria, 7.2)', () => {
  const firma = {
    titular: { nombre: 'Persona Titular', cargo: 'Cargo Titular' },
    presentante: { nombre: 'Persona Autorizada', cargo: 'Cargo Autorizado' },
    leyenda: LEYENDA
  };

  it('la leyenda cita la nota de autorización', () => {
    assert.equal(textoLeyendaAutorizacion({
      presentante: firma.presentante, titular: firma.titular, nota: { numero: 15, anio: 2026 }, licencia: AUTORIZADA
    }), LEYENDA);
  });

  it('sin firma usa la de la configuración, sin presentante ni leyenda', () => {
    assert.deepEqual(nota().firma, { nombre: 'Nombre de Firma', cargo: 'Cargo de Firma', presentante: null, leyenda: null });
  });

  it('con la firma del titular sola, la nota firma con sus datos', () => {
    const n = nota({ firma: { titular: { nombre: 'Persona Titular', cargo: 'Cargo Titular' }, presentante: null, leyenda: null } });
    assert.deepEqual(n.firma, { nombre: 'Persona Titular', cargo: 'Cargo Titular', presentante: null, leyenda: null });
  });

  it('HTML: las dos firmas lado a lado (quien presenta a la izquierda), escapadas, y la leyenda', () => {
    const html = renderHtml(nota({ firma: { ...firma, presentante: { nombre: 'Persona <b>Autorizada</b>', cargo: 'Cargo Autorizado' } } }));
    const izquierda = html.indexOf('Persona &lt;b&gt;Autorizada&lt;/b&gt;<br>Cargo Autorizado');
    const derecha = html.indexOf('Persona Titular<br>Cargo Titular');
    assert.ok(izquierda > 0 && derecha > izquierda, 'quien presenta va antes (a la izquierda) que el titular');
    assert.ok(html.includes('conforme a la autorización conferida mediante Nota Digital N° 15/26'));
  });

  it('HTML sin presentante: el bloque de firma queda exactamente como antes', () => {
    assert.ok(renderHtml(nota()).includes('<p style="margin:32px 0 0;text-align:right;">Nombre de Firma<br>Cargo de Firma</p>'));
  });

  it('texto plano: quien presenta, el titular y la leyenda, antes de la línea de CC', () => {
    assert.ok(renderTexto(nota({ firma })).includes(`Persona Autorizada\nCargo Autorizado\n\nPersona Titular\nCargo Titular\n\n${LEYENDA}\n\nCC. Dir. de Investigación Territorial`));
  });
});

describe('párrafo de autorización en los avisos de la víspera (spec 7.2)', () => {
  it('va después de las tablas y antes de la línea del anexo, en el HTML y en el texto', () => {
    const n = nota({ autorizacion: AUTORIZADA });
    assert.equal(n.autorizacion, PARRAFO_AUTORIZACION);
    const html = renderHtml(n);
    assert.ok(html.indexOf('Dataset A') < html.indexOf('Asimismo, por medio de la presente'));
    assert.ok(html.indexOf('Asimismo, por medio de la presente') < html.indexOf('Anexo: reporte'));
    const texto = renderTexto(n);
    assert.ok(texto.includes(`${PARRAFO_AUTORIZACION}\n\nAnexo: reporte`));
  });

  it('sin autorización, la nota no lo lleva', () => {
    assert.equal(nota().autorizacion, null);
    assert.ok(!renderHtml(nota()).includes('Asimismo'));
  });
});

describe('nota de autorización (spec 7.2)', () => {
  const firmaTitular = { titular: { nombre: 'Persona Titular', cargo: 'Cargo Titular' }, presentante: null, leyenda: null };
  const autorizacion = construirNotaDeAutorizacion({ numero: 15, anio: 2026, fecha: '2026-11-25', firma: firmaTitular, autorizacion: AUTORIZADA });

  it('asunto, texto y firma del titular, sin gestión, tablas ni justificación', () => {
    assert.equal(autorizacion.asunto, 'Nota Digital N° 15/26 – Ref.: Autorización para la presentación de Notas Digitales (licencia del 26/11/2026 al 14/01/2027)');
    assert.equal(autorizacion.tipo, 'autorizacion');
    assert.equal(autorizacion.gestion, null);
    assert.equal(autorizacion.parrafoInicial, 'Por medio de la presente informo que, durante mi licencia del 26/11/2026 al 14/01/2027, autorizo expresamente a Persona Autorizada, Cargo Autorizado, a presentar en mi nombre las Notas Digitales de esta Dirección, con el objetivo de mantener el correcto flujo de trabajo.');
    assert.deepEqual(autorizacion.firma, { nombre: 'Persona Titular', cargo: 'Cargo Titular', presentante: null, leyenda: null });
  });

  it('HTML y texto sin "Justificación:" y con el párrafo', () => {
    for (const salida of [renderHtml(autorizacion), renderTexto(autorizacion)]) {
      assert.ok(!salida.includes('Justificación'));
      assert.ok(salida.includes('autorizo expresamente a Persona Autorizada'));
      assert.ok(salida.includes('SE ADJUNTA NOTA EN PDF'));
    }
  });

  it('prueba: N° PRUEBA y [PRUEBA] en el asunto', () => {
    const prueba = construirNotaDeAutorizacion({ esPrueba: true, fecha: '2026-11-25', firma: firmaTitular, autorizacion: AUTORIZADA });
    assert.match(prueba.asunto, /^\[PRUEBA\] Nota Digital N° PRUEBA – /);
  });
});

describe('asunto de un aviso anticipado (spec 7.3)', () => {
  it('nombra el rango de meses de los vencimientos en lugar del mes de la nota', () => {
    assert.equal(nota({ rangoVencimientos: { desde: '2027-01-20', hasta: '2027-03-31' } }).asunto,
      `Nota Digital N° 12/26 – Ref.: ${REF} (gestión interna – vencimientos de enero a marzo 2027)`);
    assert.equal(nota({ rangoVencimientos: { desde: '2026-12-15', hasta: '2027-02-10' } }).asunto,
      `Nota Digital N° 12/26 – Ref.: ${REF} (gestión interna – vencimientos de diciembre 2026 a febrero 2027)`);
    assert.equal(nota({ rangoVencimientos: { desde: '2027-01-20', hasta: '2027-01-31' } }).asunto,
      `Nota Digital N° 12/26 – Ref.: ${REF} (gestión interna – vencimientos de enero 2027)`);
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/notas-contenido.test.js`
Expected: FAIL en los tests nuevos (falta el export de `construirNotaDeAutorizacion`).

- [ ] **Step 3: `services/notasDigitalesContenido.js`.**

(a) Import: sumar `textoRangoMeses` al import del calendario.

(b) Textos de la autorización, debajo de `AVISO_ADJUNTO`:

```js
// Autorización para presentar las notas durante la licencia del firmante (spec 2026-10-15-dias-habiles-licencias-auditoria, 7.2).
// a: { nombre, cargo, desde, hasta } de la persona autorizada y la licencia
const periodoLicencia = ({ desde, hasta }) => `del ${formatoCorto(desde)} al ${formatoCorto(hasta)}`;
const PARRAFO_AUTORIZACION = (a) => `Asimismo, por medio de la presente autorizo expresamente a ${a.nombre}, ${a.cargo}, a presentar en mi nombre las Notas Digitales durante mi licencia, ${periodoLicencia(a)}, con el objetivo de mantener el correcto flujo de trabajo.`;
const TEXTO_NOTA_AUTORIZACION = (a) => `Por medio de la presente informo que, durante mi licencia ${periodoLicencia(a)}, autorizo expresamente a ${a.nombre}, ${a.cargo}, a presentar en mi nombre las Notas Digitales de esta Dirección, con el objetivo de mantener el correcto flujo de trabajo.`;
const REF_AUTORIZACION = 'Autorización para la presentación de Notas Digitales';
```

(c) Después de `textoNumero`, agregar:

```js
// Leyenda de una nota presentada por la persona autorizada (spec 2026-10-15, 7.2): cita la nota de autorización
export const textoLeyendaAutorizacion = ({ presentante, titular, nota, licencia }) =>
  `Nota presentada por ${presentante.nombre}, ${presentante.cargo}, en nombre de ${titular.nombre}, ${titular.cargo}, `
  + `conforme a la autorización conferida mediante Nota Digital N° ${textoNumero(nota)} (licencia ${periodoLicencia(licencia)}).`;

// La firma de la nota: la del titular (o la de la configuración, sin firmante elegido) y, durante su licencia con
// autorización, la de quien la presenta con la leyenda (spec 2026-10-15, 7.2)
const firmaDeLaNota = (firma, config) => ({
  nombre: firma?.titular?.nombre ?? config?.firma_nombre ?? '',
  cargo: firma?.titular?.cargo ?? config?.firma_cargo ?? '',
  presentante: firma?.presentante ? { nombre: firma.presentante.nombre, cargo: firma.presentante.cargo } : null,
  leyenda: firma?.presentante ? firma.leyenda ?? null : null
});
```

(d) `construirNota`: agregar `firma = null, rangoVencimientos = null, autorizacion = null` a los parámetros. El asunto pasa a:

```js
  // El mes de la nota o, en un aviso anticipado por la licencia del firmante, el rango de meses de los vencimientos (7.3)
  const cuando = rangoVencimientos
    ? `vencimientos de ${textoRangoMeses(rangoVencimientos.desde, rangoVencimientos.hasta)}`
    : mesYAnio(fecha);
  const asunto = `${esPrueba ? '[PRUEBA] ' : ''}Nota Digital N° ${numeroTexto} – Ref.: ${ref} (gestión ${gestion} – ${cuando})`;
```

y en el objeto que devuelve: reemplazar la línea `firma: …` por `firma: firmaDeLaNota(firma, config),` y agregar, después de `anexo`, `autorizacion: autorizacion ? PARRAFO_AUTORIZACION(autorizacion) : null,`.

(e) Después de `construirNota`, agregar:

```js
// Nota de autorización (spec 2026-10-15, 7.2): la que sale cuando la víspera no hay avisos, o cuando la autorización se da
// después. Firma solo el titular. Tiene la misma forma que las demás notas para que la rendericen las mismas funciones.
export const construirNotaDeAutorizacion = ({ numero = null, anio = null, esPrueba = false, fecha, firma, autorizacion }) => {
  const numeroTexto = textoNumero({ numero, anio, esPrueba });
  return {
    tipo: 'autorizacion',
    gestion: null,
    esPrueba,
    fecha,
    numeroTexto,
    asunto: `${esPrueba ? '[PRUEBA] ' : ''}Nota Digital N° ${numeroTexto} – Ref.: ${REF_AUTORIZACION} (licencia ${periodoLicencia(autorizacion)})`,
    ref: REF_AUTORIZACION,
    destinatario: DESTINATARIO,
    avisoAdjunto: AVISO_ADJUNTO.reiteracion,
    parrafoInicial: TEXTO_NOTA_AUTORIZACION(autorizacion),
    secciones: [],
    contactos: [],
    anexo: null,
    autorizacion: null,
    justificacion: [],
    remitente: REMITENTE,
    fechaLarga: formatoLargo(fecha),
    firma: firmaDeLaNota({ titular: firma.titular, presentante: null, leyenda: null }),
    lineaCc: ''
  };
};
```

(f) `renderHtml`:
- después de `const contactos = …;` agregar `const autorizacion = nota.autorizacion ? parrafo(nota.autorizacion) : '';` y en la plantilla cambiar `${contactos}` por `${contactos}${autorizacion}` (en la misma línea, sin agregar saltos);
- reemplazar las dos líneas de la justificación por:

```js
${nota.justificacion.length ? `<p style="margin:16px 0 6px;"><b>Justificación:</b></p>
${nota.justificacion.map(parrafo).join('\n')}` : ''}
```

  (con justificación, el HTML queda idéntico al de hoy);
- reemplazar la línea de la firma (`<p style="margin:32px 0 0;text-align:right;">…`) por `${bloqueFirmaHtml(nota.firma)}` y agregar antes de `renderHtml`:

```js
// Una firma (sin presentante): a la derecha, como siempre. Con presentante: las dos lado a lado, quien presenta a la
// izquierda y el titular a la derecha, y la leyenda debajo
const bloqueFirmaHtml = (firma) => {
  if (!firma.presentante) {
    return `<p style="margin:32px 0 0;text-align:right;">${escapeHtml(firma.nombre)}<br>${escapeHtml(firma.cargo)}</p>`;
  }
  const celda = ({ nombre, cargo }) => `<td style="width:50%;text-align:center;vertical-align:top;">${escapeHtml(nombre)}<br>${escapeHtml(cargo)}</td>`;
  return `<table cellspacing="0" cellpadding="0" style="width:100%;margin:32px 0 0;"><tr>${celda(firma.presentante)}${celda(firma)}</tr></table>
<p style="margin:12px 0 0;font-size:12px;font-style:italic;text-align:justify;">${escapeHtml(firma.leyenda)}</p>`;
};
```

(g) `renderTexto`:
- después del bloque de contactos (antes del `lineas.push(...)` final), agregar `if (nota.autorizacion) lineas.push(nota.autorizacion, '');`;
- en el `lineas.push(...)` final, reemplazar `'Justificación:', ...nota.justificacion, '',` por `...(nota.justificacion.length ? ['Justificación:', ...nota.justificacion, ''] : []),` y `nota.firma.nombre, nota.firma.cargo,` por `...lineasFirma(nota.firma),`;
- agregar antes de `renderTexto`:

```js
const lineasFirma = (firma) => (firma.presentante
  ? [firma.presentante.nombre, firma.presentante.cargo, '', firma.nombre, firma.cargo, '', firma.leyenda]
  : [firma.nombre, firma.cargo]);
```

- [ ] **Step 4: Tests de contenido en verde**

Run: `node --test tests/notas-contenido.test.js`
Expected: PASS, incluidos todos los que ya existían.

- [ ] **Step 5: Tests del PDF.** Agregar al final de `tests/notas-pdf.test.js` (importando también `construirNotaDeAutorizacion` en la línea del import de contenido):

```js
describe('renderPdf: autorización (spec 2026-10-15-dias-habiles-licencias-auditoria, 7.2)', () => {
  const firma = {
    titular: { nombre: 'Persona Titular', cargo: 'Cargo Titular' },
    presentante: { nombre: 'Persona Autorizada', cargo: 'Cargo Autorizado' },
    leyenda: 'Nota presentada por Persona Autorizada, Cargo Autorizado, en nombre de Persona Titular, Cargo Titular, conforme a la autorización conferida mediante Nota Digital N° 15/26 (licencia del 26/11/2026 al 14/01/2027).'
  };
  const FIRMA_A = pngRgba({ ancho: 40, alto: 20 });
  const FIRMA_B = pngRgba({ ancho: 60, alto: 20 });
  const todo = (pdf) => lineasPorHoja(pdf).flat().join(' ');

  it('dibuja las dos imágenes, quien presenta a la izquierda del titular, y la leyenda', async () => {
    const pdf = await renderPdf(nota(1, { firma }), { firmaImagen: FIRMA_A, presentanteImagen: FIRMA_B });
    const textos = textosPorHoja(pdf).flat();
    const de = (texto) => textos.find(t => t.texto === texto);
    assert.ok(de('Persona Autorizada') && de('Persona Titular'));
    assert.ok(de('Persona Autorizada').x < de('Persona Titular').x, 'quien presenta va a la izquierda');
    assert.ok(todo(pdf).includes('conforme a la autorización conferida mediante Nota Digital N° 15/26'));
    assert.equal(imagenesPorHoja(pdf).flat().length, 2);
  });

  it('una imagen dañada de quien presenta rechaza la promesa, como la del titular', async () => {
    for (const [caso, imagen] of Object.entries(pngsDanados())) {
      await assert.rejects(renderPdf(nota(1, { firma }), { firmaImagen: FIRMA_A, presentanteImagen: imagen }), /firma/, caso);
    }
    // La descompresión de png-js es asíncrona: si alguna imagen llegara a PDFKit, su error aparecería después
    await new Promise(resolve => setTimeout(resolve, 300));
  });

  it('con 1 a 30 datasets, el cierre (remitente, las dos firmas, la leyenda y la línea CC) queda entero en la última hoja', async () => {
    for (let cantidad = 1; cantidad <= 30; cantidad++) {
      const n = nota(cantidad, { firma });
      const hojas = lineasPorHoja(await renderPdf(n, { firmaImagen: FIRMA_A, presentanteImagen: FIRMA_B }));
      const ultima = hojas.at(-1).join(' ');
      for (const parte of [n.remitente, 'Persona Autorizada', 'Persona Titular', 'conforme a la autorización', n.lineaCc]) {
        assert.ok(ultima.includes(parte), `${cantidad} datasets: falta "${parte}" en la última hoja`);
      }
      for (const anterior of hojas.slice(0, -1)) {
        assert.ok(!anterior.join(' ').includes('Persona Titular'), `${cantidad} datasets: la firma se partió entre hojas`);
      }
    }
  });

  it('el párrafo de autorización de un aviso va en el PDF, antes de la línea del anexo', async () => {
    const n = nota(3, { autorizacion: { nombre: 'Persona Autorizada', cargo: 'Cargo Autorizado', desde: '2026-11-26', hasta: '2027-01-14' } });
    const texto = todo(await renderPdf(n, { firmaImagen: FIRMA_A }));
    assert.ok(texto.indexOf('Asimismo, por medio de la presente') > 0);
    assert.ok(texto.indexOf('Asimismo, por medio de la presente') < texto.indexOf('Anexo: reporte'));
  });

  it('la nota de autorización: una hoja, el párrafo y la firma del titular, sin "Justificación:"', async () => {
    const n = construirNotaDeAutorizacion({
      numero: 15, anio: 2026, fecha: '2026-11-25', firma: { titular: firma.titular, presentante: null, leyenda: null },
      autorizacion: { nombre: 'Persona Autorizada', cargo: 'Cargo Autorizado', desde: '2026-11-26', hasta: '2027-01-14' }
    });
    const hojas = lineasPorHoja(await renderPdf(n, { firmaImagen: FIRMA_A }));
    assert.equal(hojas.length, 1);
    const texto = hojas[0].join(' ');
    assert.ok(texto.includes('autorizo expresamente a Persona Autorizada'));
    assert.ok(texto.includes('Persona Titular'));
    assert.ok(!texto.includes('Justificación'));
  });
});
```

- [ ] **Step 6: Correr y ver que fallan**

Run: `node --test tests/notas-pdf.test.js`
Expected: FAIL en los tests nuevos.

- [ ] **Step 7: `services/notasDigitalesPdf.js`.**

(a) Constante nueva, junto a `ALTO_CIERRE`:

```js
// Aire entre las firmas y la leyenda de una nota presentada por autorización (spec 2026-10-15, 7.2), en líneas de 11 pt
const ESPACIO_LEYENDA = 0.8;
```

(b) La firma de `renderPdf` suma `presentanteImagen = null`, y se valida igual que la del titular:

```js
export const renderPdf = (nota, { firmaImagen = null, presentanteImagen = null, membreteImagen = null, membretePie = null } = {}) => new Promise((resolve, reject) => {
  try {
    // Una imagen dañada rechaza la promesa acá, antes de llegar a PDFKit (que tumbaría el proceso)
    if (firmaImagen) validarImagenFirma(firmaImagen);
    if (presentanteImagen) validarImagenFirma(presentanteImagen);
```

(c) El cierre reserva también la leyenda. Después de definir `altoEspacio`, agregar:

```js
    // Con presentante, el cierre suma la leyenda (medida, no estimada)
    const altoCierre = ALTO_CIERRE + (nota.firma.presentante
      ? altoEspacio(ESPACIO_LEYENDA, 11) + altoTexto(nota.firma.leyenda, 9, CURSIVA)
      : 0);
```

y reemplazar los **dos** usos de `ALTO_CIERRE` dentro de `renderPdf` por `altoCierre`.

(d) Párrafo de autorización: después del bloque de contactos y antes del de la línea del anexo, agregar:

```js
    // Párrafo de autorización de los avisos de la víspera de la licencia del firmante (spec 2026-10-15, 7.2)
    if (nota.autorizacion) {
      asegurarEspacio(altoTexto(nota.autorizacion) + altoEspacio(ESPACIO_PARRAFO, 12));
      parrafo(nota.autorizacion);
    }
```

(e) Justificación opcional: envolver el bloque que empieza en `const ultimo = nota.justificacion.length - 1;` y termina en el `forEach` de los párrafos en `if (nota.justificacion.length) { … } else { asegurarEspacio(altoCierre); }`, sin cambiar nada adentro.

(f) Reemplazar el bloque `// Firma a la derecha: imagen (si está cargada), nombre y cargo` (desde `const anchoFirma = 200;` hasta `doc.text(nota.firma.cargo, …);`) por:

```js
    // Firma: imagen (si está cargada), nombre y cargo, centrados en un ancho de 200 pt. Devuelve dónde termina.
    const anchoFirma = 200;
    const dibujarFirma = (x, y, imagen, { nombre, cargo }) => {
      let abajo = y;
      if (imagen) {
        doc.image(imagen, x + (anchoFirma - 140) / 2, abajo, { fit: [140, 60], align: 'center', valign: 'bottom' });
        abajo += 64;
      } else {
        abajo += 30;
      }
      doc.font(NORMAL).fontSize(11).text(nombre, x, abajo, { width: anchoFirma, align: 'center' });
      doc.text(cargo, x, doc.y, { width: anchoFirma, align: 'center' });
      return doc.y;
    };
    const xDerecha = MARGENES.left + ancho - anchoFirma;
    doc.moveDown(1.5);
    const yFirmas = doc.y;
    if (nota.firma.presentante) {
      // Dos firmas lado a lado: quien presenta a la izquierda, el titular a la derecha; debajo, la leyenda
      const finIzquierda = dibujarFirma(MARGENES.left, yFirmas, presentanteImagen, nota.firma.presentante);
      const finDerecha = dibujarFirma(xDerecha, yFirmas, firmaImagen, nota.firma);
      doc.y = Math.max(finIzquierda, finDerecha);
      doc.moveDown(ESPACIO_LEYENDA);
      doc.font(CURSIVA).fontSize(9).text(nota.firma.leyenda, MARGENES.left, doc.y, { width: ancho, align: 'justify' });
      doc.font(NORMAL).fontSize(11);
    } else {
      dibujarFirma(xDerecha, yFirmas, firmaImagen, nota.firma);
    }
```

(La firma sola queda dibujada exactamente como antes: mismo `x`, mismo `y`, mismos tamaños.)

- [ ] **Step 8: Tests del PDF y de contenido en verde**

Run: `node --test tests/notas-pdf.test.js tests/notas-contenido.test.js`
Expected: PASS, incluidos todos los barridos de maquetación que ya existían.

- [ ] **Step 9: Suite completa** — ninguna falla nueva.

- [ ] **Step 10: Commit**

```bash
git add services/notasDigitalesContenido.js services/notasDigitalesPdf.js tests/notas-contenido.test.js tests/notas-pdf.test.js
git commit -m "feat: notas con dos firmas y leyenda, párrafo y nota de autorización, y asunto con el rango de vencimientos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 7: El motor de Notas Digitales con la licencia del firmante

**Files:**
- Create: `services/notasDigitalesFirmas.js`
- Modify: `services/notasDigitalesDatos.js`
- Modify: `services/notasDigitales.js`
- Test: `tests/notas-licencias.test.js` (nuevo)

**Interfaces:**
- Consumes: `firmaDeUsuario` (Task 5); `licenciaEnFecha`, `proximaLicencia` (Task 2, con `nota_autorizacion_id`); `construirNota` con `firma`, `rangoVencimientos` y `autorizacion`, `construirNotaDeAutorizacion`, `textoLeyendaAutorizacion`, `renderPdf` con `presentanteImagen` (Task 6).
- Produces:
  - `firmaParaFecha(config, fecha) → { modo: 'configuracion'|'titular'|'autorizado'|'sin_autorizado', firma, licencia?, autorizado? }`, con `firma = { titular: { nombre, cargo, imagen }, presentante: {…}|null, leyenda, firmanteId, presentanteId }`. En modo `autorizado`, `leyenda` es `null` si la nota de autorización todavía no existe.
  - `autorizadoVigente(licencia, fecha) → { usuario_id, nombre, cargo, imagen, mime, email } | null`
  - `autorizacionPendiente(config, hoy) → { licencia, autorizado } | null`
  - `anticipoPorLicencia(config, hoy) → { hasta, licencia } | null` (con o sin autorizado)
  - `registrarNotaDeAutorizacion(licenciaId, notaId)`
  - `firmaTitularDe(config) → firma | null`
  - `seleccionarParaAviso(gestion, hoy, horizonte = hoy)`: cada fila suma `apertura_mes` (primer vencimiento de su mes).
  - `generarNota({ …, firma?, rangoVencimientos?, autorizacion? })`; con `tipo: 'autorizacion'` genera la nota de autorización (`gestion: null`, sin datasets). Guarda `firmante_id`, `presentada_por_id` y, en `notas_digitales_datasets`, `cuenta_desde`.
  - El resumen de la corrida suma `licencia` (texto) cuando la licencia del firmante cambió lo que se generó.

- [ ] **Step 1: Tests que fallan.** Crear `tests/notas-licencias.test.js`:

```js
// Notas Digitales durante la licencia del firmante titular (spec 2026-10-15-dias-habiles-licencias-auditoria, 7),
// con los ejemplos de la sección 7.4 como fechas fijas, sobre una base de prueba + Mailpit
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query, mailpit } from './helpers.js';
import { crearDataset, crearNota, limpiarBase, configurarNotas } from './notas-fixtures.js';
import { pngRgba } from './firma-fixtures.js';
import { lineasPorHoja } from './pdf-lector.js';

const FIRMA = pngRgba({ ancho: 40, alto: 20 });
const PARRAFO = 'Asimismo, por medio de la presente autorizo expresamente a Firma admin, Cargo admin, a presentar en mi nombre las Notas Digitales durante mi licencia, del 26/11/2026 al 14/01/2027, con el objetivo de mantener el correcto flujo de trabajo.';
let base, motor, firmas, dbReal, titular, autorizado;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_notas_licencias');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  motor = await import('../services/notasDigitales.js');
  firmas = await import('../services/notasDigitalesFirmas.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

const crearUsuario = async (rol, { conFirma = true } = {}) => {
  const username = `t_${rol}_${crypto.randomBytes(3).toString('hex')}`;
  const email = `${username}@rpad.test`;
  const r = await query(
    "INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES (?, 'x', ?, ?, ?, 1)",
    [username, `Persona ${rol}`, email, rol]
  );
  if (conFirma) {
    await query("INSERT INTO usuarios_firmas (usuario_id, nombre, cargo, imagen, mime) VALUES (?, ?, ?, ?, 'image/png')",
      [r.insertId, `Firma ${rol}`, `Cargo ${rol}`, FIRMA]);
  }
  return { id: r.insertId, email };
};

const licencia = async (usuario, desde, hasta, autorizadoDe = null) => (await query(
  'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, autorizado_id, autorizado_at) VALUES (?, ?, ?, ?, ?)',
  [usuario.id, desde, hasta, autorizadoDe?.id ?? null, autorizadoDe ? '2026-11-20 10:00:00' : null]
)).insertId;

beforeEach(async () => {
  await limpiarBase();
  await configurarNotas();
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios_firmas');
  await query('DELETE FROM usuarios');
  titular = await crearUsuario('superadmin');
  autorizado = await crearUsuario('admin');
  await query('UPDATE notas_digitales_config SET firmante_usuario_id = ?', [titular.id]);
  await mailpit.vaciar();
});

const config = async () => (await query('SELECT * FROM notas_digitales_config WHERE id = 1'))[0];
const notas = () => query(
  `SELECT id, numero, anio, tipo, gestion, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, asunto, para, cc, html, firmante_id,
          presentada_por_id, pdf
   FROM notas_digitales WHERE es_prueba = 0 ORDER BY id`
);
const datasetsDe = (notaId) => query(
  "SELECT dataset_id, DATE_FORMAT(cuenta_desde, '%Y-%m-%d') AS cuenta_desde FROM notas_digitales_datasets WHERE nota_id = ? ORDER BY dataset_id",
  [notaId]
);
const notaDeAutorizacionDe = async (licenciaId) => (await query('SELECT nota_autorizacion_id AS id FROM usuarios_licencias WHERE id = ?', [licenciaId]))[0].id;
const correr = (hoy) => motor.ejecutarNotasDigitales({ hoy });
const ordenados = (lista) => [...lista].sort((a, b) => a - b);

describe('firmante titular sin licencia', () => {
  it('firma el titular: firmante_id es el suyo y no hay leyenda', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    const [nota] = await notas();
    assert.equal(nota.firmante_id, titular.id);
    assert.equal(nota.presentada_por_id, null);
    assert.match(nota.html, /Firma superadmin<br>Cargo superadmin/);
    assert.doesNotMatch(nota.html, /Nota presentada por/);
  });

  it('sin firmante titular elegido, una licencia de un superadmin no frena nada y firma la configuración', async () => {
    await query('UPDATE notas_digitales_config SET firmante_usuario_id = NULL');
    await licencia(titular, '2026-10-26', '2026-11-13');
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    const [nota] = await notas();
    assert.equal(nota.firmante_id, null);
    assert.match(nota.html, /Firma de Prueba<br>Cargo de Prueba/);
  });
});

describe('licencia sin autorizado (spec 7.3), ejemplo del 26/11/2026 al 14/01/2027', () => {
  const ids = {};
  beforeEach(async () => {
    await licencia(titular, '2026-11-26', '2027-01-14');
    ids.enero = await crearDataset({ titulo: 'Vence en enero', vencimiento: '2027-01-20' });
    ids.febrero = await crearDataset({ titulo: 'Vence en febrero', vencimiento: '2027-02-15' });
    ids.marzo10 = await crearDataset({ titulo: 'Vence el 10 de marzo', vencimiento: '2027-03-10' });
    ids.marzo31 = await crearDataset({ titulo: 'Vence el 31 de marzo', vencimiento: '2027-03-31' });
    ids.abril = await crearDataset({ titulo: 'Vence en abril', vencimiento: '2027-04-10' });
  });

  it('la víspera (25/11) avisa en una sola nota todo lo que se habría avisado durante la licencia', async () => {
    await correr('2026-11-25');
    const [aviso, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.equal(aviso.tipo, 'aviso');
    assert.match(aviso.asunto, /\(gestión interna – vencimientos de enero a marzo 2027\)$/);
    assert.ok(!aviso.html.includes('Asimismo'), 'sin persona autorizada no hay párrafo de autorización');
    const incluidos = await datasetsDe(aviso.id);
    assert.deepEqual(ordenados(incluidos.map(d => d.dataset_id)), ordenados([ids.enero, ids.febrero, ids.marzo10, ids.marzo31]));
    const cuenta = Object.fromEntries(incluidos.map(d => [d.dataset_id, d.cuenta_desde]));
    // Enero ya entraba en la ventana el 25/11: sin cuenta_desde. Febrero se habría avisado el 17/12; marzo, el 11/01
    // (el 09/01 es sábado)
    assert.equal(cuenta[ids.enero], null);
    assert.equal(cuenta[ids.febrero], '2026-12-17');
    assert.equal(cuenta[ids.marzo10], '2027-01-11');
    assert.equal(cuenta[ids.marzo31], '2027-01-11');
  });

  it('durante la licencia no se generan notas; los reintentos sí siguen', async () => {
    await correr('2026-11-25');
    await crearNota({ fecha: '2026-11-20', numero: 99, anio: 2026, estado: 'fallida', intentos: 1 });
    for (const dia of ['2026-11-26', '2026-12-01', '2027-01-04', '2027-01-14']) {
      const resumen = await correr(dia);
      assert.match(resumen.licencia, /sin autorizado/, dia);
    }
    const todas = await notas();
    assert.equal(todas.filter(n => n.tipo === 'reiteracion').length, 0);
    assert.equal(todas.filter(n => n.tipo === 'aviso').length, 1);
    assert.equal((await query('SELECT estado FROM notas_digitales WHERE numero = 99'))[0].estado, 'enviada');
  });

  it('a la vuelta (15/01) sale una sola reiteración, y lo anticipado de marzo todavía no se reitera', async () => {
    await correr('2026-11-25');
    await correr('2026-12-01');
    await correr('2027-01-15');
    const reiteraciones = (await notas()).filter(n => n.tipo === 'reiteracion');
    assert.equal(reiteraciones.length, 1);
    const reiterados = (await datasetsDe(reiteraciones[0].id)).map(d => d.dataset_id);
    assert.deepEqual(ordenados(reiterados), ordenados([ids.enero, ids.febrero]));
  });
});

describe('licencia con autorizado (spec 7.2)', () => {
  it('la víspera anticipa los avisos con el párrafo de autorización, en CC la persona autorizada, y la licencia guarda la nota', async () => {
    const licenciaId = await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    await crearDataset({ vencimiento: '2027-01-20' });
    await crearDataset({ vencimiento: '2027-02-15' });
    await correr('2026-11-24');
    assert.equal((await notas()).length, 0, 'antes de la víspera no sale nada');
    await correr('2026-11-25');
    const [aviso, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.equal(aviso.tipo, 'aviso');
    assert.match(aviso.asunto, /vencimientos de enero a febrero 2027/);
    assert.ok(aviso.html.includes(PARRAFO));
    assert.ok(aviso.cc.split(', ').includes(autorizado.email));
    assert.equal(aviso.firmante_id, titular.id);
    assert.equal(aviso.presentada_por_id, null);
    assert.equal(await notaDeAutorizacionDe(licenciaId), aviso.id);
  });

  it('si la víspera no hay avisos, sale la nota de autorización sola', async () => {
    const licenciaId = await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    await correr('2026-11-25');
    const [nota, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.equal(nota.tipo, 'autorizacion');
    assert.equal(nota.gestion, null);
    assert.equal(nota.asunto, `Nota Digital N° ${nota.numero}/26 – Ref.: Autorización para la presentación de Notas Digitales (licencia del 26/11/2026 al 14/01/2027)`);
    assert.equal(nota.para, 'mit@rpad.test');
    assert.equal(nota.cc, autorizado.email);
    assert.ok(nota.html.includes('Por medio de la presente informo que, durante mi licencia del 26/11/2026 al 14/01/2027, autorizo expresamente a Firma admin, Cargo admin'));
    assert.ok(!nota.html.includes('Justificación'));
    assert.equal(await notaDeAutorizacionDe(licenciaId), nota.id);
    assert.equal((await mailpit.esperar(m => m.Subject === nota.asunto)).length, 1);
  });

  it('durante la licencia, la persona autorizada presenta las reiteraciones con las dos firmas y la cita de la nota', async () => {
    const licenciaId = await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    const vencido = await crearDataset({ vencimiento: '2026-11-30' });
    await crearNota({ tipo: 'aviso', fecha: '2026-10-01', numero: 50, anio: 2026, datasets: [{ id: vencido, vencimiento: '2026-11-30' }] });
    await correr('2026-11-25');
    const [autorizacion] = await query('SELECT numero FROM notas_digitales WHERE id = ?', [await notaDeAutorizacionDe(licenciaId)]);
    await correr('2026-12-01');
    const [reiteracion] = (await notas()).filter(n => n.tipo === 'reiteracion' && n.fecha === '2026-12-01');
    assert.equal(reiteracion.firmante_id, titular.id);
    assert.equal(reiteracion.presentada_por_id, autorizado.id);
    assert.ok(reiteracion.html.includes(`Nota presentada por Firma admin, Cargo admin, en nombre de Firma superadmin, Cargo superadmin, conforme a la autorización conferida mediante Nota Digital N° ${autorizacion.numero}/26 (licencia del 26/11/2026 al 14/01/2027).`));
    const ultima = lineasPorHoja(reiteracion.pdf).at(-1).join(' ');
    assert.ok(ultima.includes('Firma admin') && ultima.includes('Firma superadmin'));
  });

  it('autorización tardía: la primera corrida genera la nota de autorización (firma solo el titular) y después las demás, que la citan', async () => {
    const licenciaId = await licencia(titular, '2026-10-26', '2026-11-13', autorizado);
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    const [autorizacion, aviso, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.equal(autorizacion.tipo, 'autorizacion');
    assert.equal(autorizacion.presentada_por_id, null);
    assert.equal(await notaDeAutorizacionDe(licenciaId), autorizacion.id);
    assert.equal(aviso.tipo, 'aviso');
    assert.equal(aviso.presentada_por_id, autorizado.id);
    assert.ok(aviso.html.includes(`mediante Nota Digital N° ${autorizacion.numero}/26 (licencia del 26/10/2026 al 13/11/2026)`));
    assert.ok(!aviso.html.includes('Asimismo'), 'el aviso de un día de licencia no repite el párrafo');
  });

  it('si se vacía la nota de autorización (cambiaron las fechas o la persona), la corrida siguiente genera otra', async () => {
    const licenciaId = await licencia(titular, '2026-10-26', '2026-11-13', autorizado);
    await correr('2026-11-02');
    await query('UPDATE usuarios_licencias SET nota_autorizacion_id = NULL WHERE id = ?', [licenciaId]);
    await correr('2026-11-03');
    assert.equal((await notas()).filter(n => n.tipo === 'autorizacion').length, 2);
  });

  it('si el autorizado ya no tiene firma, ese día se comporta como sin autorizado', async () => {
    await licencia(titular, '2026-10-26', '2026-11-13', autorizado);
    await query('UPDATE usuarios_firmas SET imagen = NULL WHERE usuario_id = ?', [autorizado.id]);
    await crearDataset({ vencimiento: '2026-12-31' });
    const resumen = await correr('2026-11-02');
    assert.equal((await notas()).length, 0);
    assert.match(resumen.licencia, /sin autorizado/);
  });
});

describe('otros casos', () => {
  it('ejemplo del 25/01 al 05/03/2027: la víspera es el viernes 22/01 y la reiteración sale el lunes 08/03', async () => {
    await licencia(titular, '2027-01-25', '2027-03-05');
    assert.equal(await firmas.anticipoPorLicencia(await config(), '2027-01-21'), null);
    assert.equal((await firmas.anticipoPorLicencia(await config(), '2027-01-22')).hasta, '2027-03-05');
    await crearDataset({ vencimiento: '2027-02-20' });
    for (const dia of ['2027-01-22', '2027-02-01', '2027-03-01', '2027-03-08']) await correr(dia);
    assert.equal((await config()).reiteracion_evaluada_interna, '2027-03');
    assert.equal((await notas()).filter(n => n.tipo === 'reiteracion' && n.fecha === '2027-03-08').length, 1);
  });

  it('una licencia sin días hábiles (un fin de semana) no anticipa ni frena', async () => {
    await licencia(titular, '2026-11-28', '2026-11-29', autorizado);
    assert.equal(await firmas.anticipoPorLicencia(await config(), '2026-11-27'), null);
    assert.equal(await firmas.autorizacionPendiente(await config(), '2026-11-27'), null);
    assert.equal((await firmas.firmaParaFecha(await config(), '2026-11-30')).modo, 'titular');
  });

  it('licencia cargada tarde (sin víspera): lo pendiente sale el primer día hábil de la vuelta', async () => {
    await licencia(titular, '2026-11-26', '2026-12-04');
    const id = await crearDataset({ vencimiento: '2027-01-30' });
    await correr('2026-11-26');
    await correr('2026-12-01');
    assert.equal((await notas()).length, 0);
    await correr('2026-12-07');
    const [aviso] = await notas();
    assert.equal(aviso.fecha, '2026-12-07');
    assert.deepEqual((await datasetsDe(aviso.id)).map(d => d.dataset_id), [id]);
    assert.doesNotMatch(aviso.asunto, /vencimientos de/);
  });

  it('las vistas previas durante una licencia sin autorizado muestran la firma del titular', async () => {
    await licencia(titular, '2026-10-26', '2026-11-13');
    const vista = await motor.previewNota({ tipo: 'aviso', gestion: 'interna', hoy: '2026-11-02' });
    assert.match(vista.html, /Firma superadmin<br>Cargo superadmin/);
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/notas-licencias.test.js`
Expected: FAIL (`Cannot find module '../services/notasDigitalesFirmas.js'`).

- [ ] **Step 3: `services/notasDigitalesFirmas.js`**:

```js
// Cómo se firman las Notas Digitales de una fecha: el firmante titular, su autorizado durante una licencia o la firma
// de Correos sin titular elegido; y la autorización que todavía falta comunicar
// (spec 2026-10-15-dias-habiles-licencias-auditoria, 6 y 7)
import pool from '../config/database.js';
import { firmaDeUsuario } from './firmasService.js';
import { licenciaEnFecha, proximaLicencia } from './licenciasService.js';
import { textoLeyendaAutorizacion } from './notasDigitalesContenido.js';
import { diaHabilAnterior, ultimoDiaHabilHasta } from './notasDigitalesCalendario.js';

const ROLES_AUTORIZABLES = ['admin', 'editor'];

const firmaParaNota = (firma) => ({ nombre: firma?.nombre ?? '', cargo: firma?.cargo ?? '', imagen: firma?.imagen ?? null });

// La firma del firmante titular elegido, o null (sin titular, o si el titular no tiene firma)
export const firmaTitularDe = (config) => firmaDeUsuario(config.firmante_usuario_id);

/**
 * La firma de la persona autorizada de una licencia, con su email, si en esa fecha sigue cumpliendo las condiciones
 * (spec 6.3): admin o editor activo, con la imagen de su firma y sin licencia. null si no hay autorizado o ya no las cumple.
 */
export const autorizadoVigente = async (licencia, fecha) => {
  if (!licencia?.autorizado_id) return null;
  const [[usuario]] = await pool.query('SELECT rol, activo, email FROM usuarios WHERE id = ?', [licencia.autorizado_id]);
  if (!usuario || !usuario.activo || !ROLES_AUTORIZABLES.includes(usuario.rol)) return null;
  const firma = await firmaDeUsuario(licencia.autorizado_id);
  if (!firma?.imagen) return null;
  if (await licenciaEnFecha(licencia.autorizado_id, fecha)) return null;
  return { ...firma, email: usuario.email };
};

// Número y año de la nota que comunicó la autorización de la licencia, o null si todavía no salió
const notaDeAutorizacion = async (licencia) => {
  if (!licencia.nota_autorizacion_id) return null;
  const [[nota]] = await pool.query('SELECT numero, anio FROM notas_digitales WHERE id = ?', [licencia.nota_autorizacion_id]);
  return nota ?? null;
};

/**
 * Cómo se firman las notas de esa fecha:
 * - 'configuracion': sin firmante titular elegido, la firma de Correos, como siempre;
 * - 'titular': el titular no está de licencia;
 * - 'autorizado': está de licencia con un autorizado vigente: las dos firmas y la leyenda, que cita la nota de
 *   autorización (null si todavía no salió: la corrida la genera primero, con autorizacionPendiente);
 * - 'sin_autorizado': está de licencia sin autorizado vigente: ese día no se generan notas (la firma que se devuelve es
 *   la del titular, para las vistas previas, que muestran la nota como saldría a la vuelta).
 * firma: { titular: { nombre, cargo, imagen }, presentante: {...} | null, leyenda, firmanteId, presentanteId }
 */
export const firmaParaFecha = async (config, fecha) => {
  if (!config.firmante_usuario_id) {
    return {
      modo: 'configuracion',
      firma: {
        titular: { nombre: config.firma_nombre ?? '', cargo: config.firma_cargo ?? '', imagen: config.firma_imagen ?? null },
        presentante: null, leyenda: null, firmanteId: null, presentanteId: null
      }
    };
  }
  const titular = firmaParaNota(await firmaDeUsuario(config.firmante_usuario_id));
  const delTitular = { titular, presentante: null, leyenda: null, firmanteId: config.firmante_usuario_id, presentanteId: null };
  const licencia = await licenciaEnFecha(config.firmante_usuario_id, fecha);
  if (!licencia) return { modo: 'titular', firma: delTitular };
  const autorizado = await autorizadoVigente(licencia, fecha);
  if (!autorizado) return { modo: 'sin_autorizado', firma: delTitular, licencia };
  const presentante = firmaParaNota(autorizado);
  const nota = await notaDeAutorizacion(licencia);
  return {
    modo: 'autorizado',
    licencia,
    autorizado,
    firma: {
      ...delTitular,
      presentante,
      presentanteId: licencia.autorizado_id,
      leyenda: nota ? textoLeyendaAutorizacion({ presentante, titular, nota, licencia }) : null
    }
  };
};

/**
 * Autorización que todavía no se comunicó con una nota (spec 7.2): la licencia del titular en curso o la próxima, con
 * días hábiles, desde su víspera hasta su fin, con una persona autorizada vigente y sin nota de autorización.
 * Devuelve { licencia, autorizado } o null.
 */
export const autorizacionPendiente = async (config, hoy) => {
  if (!config.firmante_usuario_id) return null;
  const licencia = (await licenciaEnFecha(config.firmante_usuario_id, hoy)) ?? (await proximaLicencia(config.firmante_usuario_id, hoy));
  if (!licencia || licencia.nota_autorizacion_id) return null;
  if (hoy < diaHabilAnterior(licencia.desde) || ultimoDiaHabilHasta(licencia.hasta) < licencia.desde) return null;
  const autorizado = await autorizadoVigente(licencia, hoy);
  return autorizado ? { licencia, autorizado } : null;
};

/**
 * Si hoy es la víspera (el último día hábil antes) de una licencia del firmante titular con días hábiles, devuelve
 * { hasta: último día hábil de la licencia, licencia }: hasta ahí se anticipan los avisos, con o sin autorizado
 * (spec 7.2 y 7.3). null en cualquier otro caso.
 */
export const anticipoPorLicencia = async (config, hoy) => {
  if (!config.firmante_usuario_id) return null;
  const licencia = await proximaLicencia(config.firmante_usuario_id, hoy);
  if (!licencia || diaHabilAnterior(licencia.desde) !== hoy) return null;
  const hasta = ultimoDiaHabilHasta(licencia.hasta);
  return hasta < licencia.desde ? null : { hasta, licencia };
};

// La primera nota que comunicó la autorización vigente queda en la licencia (las siguientes del mismo día no la pisan)
export const registrarNotaDeAutorizacion = (licenciaId, notaId) => pool.query(
  'UPDATE usuarios_licencias SET nota_autorizacion_id = ? WHERE id = ? AND nota_autorizacion_id IS NULL', [notaId, licenciaId]
);
```

- [ ] **Step 4: Selección con horizonte y `cuenta_desde`** (`services/notasDigitalesDatos.js`):

(a) Reemplazar `seleccionarParaAviso` por:

```js
// Solo datasets a vencer (spec 5.2): los que vencen dentro de la ventana y los demás de la gestión que vencen el mismo
// mes que alguno que ya entró en ella. Como d es parte de su mes, "el primer vencimiento del mes está en la ventana"
// cubre las dos condiciones. Los vencidos sin aviso van a la reiteración (5.3).
// horizonte: hasta qué día se mira la ventana. Es hoy, salvo en la víspera de una licencia del firmante, en que es el
// último día hábil de la licencia (spec 2026-10-15-dias-habiles-licencias-auditoria, 7.3).
// apertura_mes: el primer vencimiento del mes de cada dataset (con él se calcula su fecha normal de aviso).
export const seleccionarParaAviso = async (gestion, hoy, horizonte = hoy) => {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS_DATASET}, DATE_FORMAT(${PRIMER_VENCIMIENTO_DEL_MES}, '%Y-%m-%d') AS apertura_mes ${DESDE_DATASETS}
     WHERE ${CONDICION_BASE}
       AND d.proxima_actualizacion >= ?
       AND ${PRIMER_VENCIMIENTO_DEL_MES} <= DATE_ADD(?, INTERVAL ? DAY)
       AND ${SIN_AVISO}
     ORDER BY d.proxima_actualizacion, d.titulo`,
    [gestion, hoy, horizonte, VENTANA_DIAS[gestion]]
  );
  return filas;
};
```

(b) En `seleccionarParaReiteracion`, reemplazar `AND av.fecha <= DATE_SUB(?, INTERVAL ? DAY)` por `AND COALESCE(avd.cuenta_desde, av.fecha) <= DATE_SUB(?, INTERVAL ? DAY)` y agregar a su comentario: `// Un aviso anticipado por la licencia del firmante cuenta los 20 días desde su fecha normal (cuenta_desde, spec 2026-10-15, 7.3).`

- [ ] **Step 5: Motor** (`services/notasDigitales.js`):

(a) Imports: sumar `construirNotaDeAutorizacion` al import de `./notasDigitalesContenido.js` y agregar:

```js
import {
  firmaParaFecha, anticipoPorLicencia, autorizacionPendiente, registrarNotaDeAutorizacion, firmaTitularDe
} from './notasDigitalesFirmas.js';
```

(b) Reemplazar `destinatarios` y `opcionesPdf` por:

```js
// ccAutorizado: el email de la persona autorizada, en las notas que comunican su autorización (spec 2026-10-15, 7.2)
const destinatarios = (config, gestion, esPrueba, ccAutorizado = null) => {
  if (esPrueba) return { para: listaDeCorreos(config.casillas_prueba), cc: [], cco: [] };
  // La nota de autorización no tiene gestión: va a los "Para" de las dos, sin repetir
  const para = gestion
    ? listaDeCorreos(config[`para_${gestion}`])
    : [...new Set(GESTIONES.flatMap(g => listaDeCorreos(config[`para_${g}`])))];
  const cc = gestion ? listaDeCorreos(config[`cc_${gestion}`]) : [];
  if (ccAutorizado && !cc.includes(ccAutorizado)) cc.push(ccAutorizado);
  return { para, cc, cco: listaDeCorreos(config.cco) };
};

// Imágenes de las firmas y del membrete con que se arma el PDF (se congelan en la nota al generarla)
const opcionesPdf = (config, firma) => ({
  firmaImagen: firma.titular.imagen, presentanteImagen: firma.presentante?.imagen ?? null,
  membreteImagen: config.membrete_imagen, membretePie: config.membrete_pie
});
```

(c) `generarNota`:

```js
/**
 * Asigna el número, renderiza HTML, texto, PDF y (en los avisos) el anexo y deja la nota registrada como pendiente.
 * firma: la de firmaParaFecha (sin ella, la que corresponde a la fecha). rangoVencimientos: asunto de un aviso anticipado.
 * autorizacion: { nombre, cargo, email, desde, hasta } de la persona autorizada: en un aviso suma el párrafo de autorización;
 * con tipo 'autorizacion' es la nota de autorización (sin gestión ni datasets). En los dos casos va en CC.
 */
export const generarNota = async ({
  tipo, gestion, fecha, datasets, config, esPrueba = false, usuarioId = null, preparado = null,
  firma = null, rangoVencimientos = null, autorizacion = null
}) => {
  const firmaNota = firma ?? (await firmaParaFecha(config, fecha)).firma;
  const esAutorizacion = tipo === 'autorizacion';
  const contenido = esAutorizacion
    ? { datasets: [], areas: [], fichas: [] }
    : preparado ?? await prepararContenido({ tipo, gestion, datasets });
  const fichas = tipo === 'aviso' ? validarFichas(contenido) : null;
  const { para, cc, cco } = destinatarios(config, gestion, esPrueba, autorizacion?.email ?? null);
```

y adentro de la transacción:

```js
    const nota = esAutorizacion
      ? construirNotaDeAutorizacion({ numero, anio, esPrueba, fecha, firma: firmaNota, autorizacion })
      : construirNota({
        tipo, gestion, numero, anio, esPrueba, fecha, datasets: contenido.datasets, areas: contenido.areas, config,
        firma: firmaNota, rangoVencimientos, autorizacion
      });
    const pdf = await renderPdf(nota, opcionesPdf(config, firmaNota));
```

El `INSERT INTO notas_digitales` suma `firmante_id, presentada_por_id` (dos `?` más, al final) con `firmaNota.firmanteId, firmaNota.presentanteId`; el valor de `gestion` puede ser `null`. El `INSERT INTO notas_digitales_datasets` suma `cuenta_desde`:

```js
        await conexion.query(
          'INSERT INTO notas_digitales_datasets (nota_id, dataset_id, seccion, vencimiento, cuenta_desde) VALUES (?, ?, ?, ?, ?)',
          [resultado.insertId, d.id, d.vencimiento < fecha ? 'vencido' : 'proximo', d.vencimiento, d.cuenta_desde ?? null]
        );
```

(d) `textoResultado` agrega el texto de la licencia:

```js
const textoResultado = (resumen) => {
  const base = resumen.motivo ?? `${resumen.enviadas} enviada(s), ${resumen.fallidas} fallida(s)`;
  const licencia = resumen.licencia ? `. ${resumen.licencia}` : '';
  const errores = resumen.errores.length
    ? `. ${resumen.errores.length} error(es): ${resumen.errores.map(describirError).join('; ')}`
    : '';
  return `${base}${licencia}${errores}`.slice(0, LARGO_RESULTADO);
};
```

y `ejecutarNotasDigitales` inicializa `licencia: null` en `resumen`.

(e) Agregar, antes de `correrPasos`:

```js
// Datos de la persona autorizada para el párrafo o la nota de autorización (spec 2026-10-15, 7.2)
const datosDeAutorizacion = ({ licencia, autorizado }) => ({
  nombre: autorizado.nombre, cargo: autorizado.cargo, email: autorizado.email, desde: licencia.desde, hasta: licencia.hasta
});

// La firma del titular solo (la nota de autorización la firma él, aunque ya esté de licencia)
const soloTitular = (firma) => ({ ...firma, presentante: null, presentanteId: null, leyenda: null });

// Datasets del aviso de hoy. En la víspera de una licencia del firmante (anticipo), la selección mira hasta el último día
// hábil de la licencia y cada dataset que hoy no habría entrado guarda su fecha normal de aviso (cuenta_desde): el primer
// día hábil desde que su mes entra en la ventana (spec 2026-10-15, 7.3)
const prepararAviso = async (gestion, hoy, anticipo) => {
  if (!anticipo) return seleccionarParaAviso(gestion, hoy);
  const normales = new Set((await seleccionarParaAviso(gestion, hoy)).map(d => d.id));
  return (await seleccionarParaAviso(gestion, hoy, anticipo.hasta)).map(d => (normales.has(d.id)
    ? d
    : { ...d, cuenta_desde: proximoDiaHabil(sumarDias(d.apertura_mes, -VENTANA_DIAS[gestion])) }));
};
```

(f) En `correrPasos`:
- `const faltan = configuracionCompleta(config, await firmaTitularDe(config));`
- después del paso 1 (reintentos), antes del paso 2:

```js
  let { modo, firma, licencia } = await firmaParaFecha(config, hoy);
  // Licencia del firmante sin autorizado: ese día no se genera ninguna nota (spec 2026-10-15, 7.3). Los reintentos de
  // arriba siguen: su contenido ya está congelado.
  if (modo === 'sin_autorizado') {
    resumen.licencia = `Licencia del firmante del ${formatoCorto(licencia.desde)} al ${formatoCorto(licencia.hasta)} sin autorizado: no se generan notas`;
    return;
  }

  // La autorización todavía no comunicada (spec 7.2) va en los avisos de la víspera; si no hay avisos, o se dio más tarde,
  // sale una nota de autorización firmada por el titular
  const pendiente = await autorizacionPendiente(config, hoy);
  const autorizacion = pendiente ? datosDeAutorizacion(pendiente) : null;
  let autorizacionComunicada = false;
  const generarAutorizacion = async () => {
    try {
      const id = await generarNota({ tipo: 'autorizacion', gestion: null, fecha: hoy, datasets: [], config, usuarioId, firma: soloTitular(firma), autorizacion });
      await registrarNotaDeAutorizacion(pendiente.licencia.id, id);
      autorizacionComunicada = true;
      resumen.generadas.push({ id, tipo: 'autorizacion', gestion: null, datasets: 0 });
      await enviar(id, { tipo: 'autorizacion' });
    } catch (error) {
      anotarError(resumen, { tipo: 'autorizacion' }, error);
    }
  };

  // En la víspera de una licencia del firmante, el aviso suma lo que se habría avisado durante la licencia
  const anticipo = modo === 'titular' ? await anticipoPorLicencia(config, hoy) : null;
  if (anticipo) {
    resumen.licencia = `Víspera de la licencia del firmante: avisos anticipados hasta el ${formatoCorto(anticipo.hasta)} más la ventana${autorizacion ? `, con la autorización a ${autorizacion.nombre}` : ''}`;
  } else if (pendiente) {
    // Autorización tardía o cambiada: primero la nota de autorización; sin ella, ese día no salen las demás (spec 7.2)
    await generarAutorizacion();
    if (!autorizacionComunicada) return;
    ({ modo, firma, licencia } = await firmaParaFecha(config, hoy));
  }
  if (modo === 'autorizado' && !firma.leyenda) {
    anotarError(resumen, { tipo: 'autorizacion' }, new Error('Falta la nota de autorización de la licencia del firmante'));
    return;
  }
```

- el paso 2 (avisos), dentro del `try`, pasa a:

```js
      const datasets = await prepararAviso(gestion, hoy, anticipo);
      if (!datasets.length) continue;
      // Un aviso con datasets anticipados nombra en el asunto el rango de meses de los vencimientos (spec 7.3)
      const rangoVencimientos = datasets.some(d => d.cuenta_desde)
        ? { desde: datasets[0].vencimiento, hasta: datasets.at(-1).vencimiento }
        : null;
      // En la víspera, el aviso comunica la autorización todavía pendiente
      const conAutorizacion = anticipo && autorizacion ? autorizacion : null;
      id = await generarNota({ tipo: 'aviso', gestion, fecha: hoy, datasets, config, usuarioId, firma, rangoVencimientos, autorizacion: conAutorizacion });
      if (conAutorizacion) {
        await registrarNotaDeAutorizacion(pendiente.licencia.id, id);
        autorizacionComunicada = true;
      }
      resumen.generadas.push({ id, tipo: 'aviso', gestion, datasets: datasets.length });
```

- después del bucle de avisos:

```js
  // Víspera sin avisos generados: la autorización sale igual, en su nota (spec 7.2)
  if (anticipo && autorizacion && !autorizacionComunicada) await generarAutorizacion();
```

- en el paso 3, `generarNota({ tipo: 'reiteracion', …, usuarioId, firma })`.

(g) Vistas previas y prueba con la firma de la fecha:

```js
// La nota de la vista previa: los datos de hoy (o de ejemplo) con N° XX, firmada como saldría (en una licencia sin
// autorizado, como saldría a la vuelta: con la firma del titular)
const notaDeVistaPrevia = async ({ tipo, gestion, hoy }) => {
  const config = await obtenerConfig();
  const { firma } = await firmaParaFecha(config, hoy);
  const { datasets, areas, ejemplo: esEjemplo } = await contenidoParaMostrar(tipo, gestion, hoy);
  const nota = construirNota({ tipo, gestion, numero: null, anio: null, esPrueba: false, fecha: hoy, datasets, areas, config, firma });
  return { nota, config, firma, ejemplo: esEjemplo, cantidad: esEjemplo ? 0 : datasets.length };
};
```

`previewPdf` usa `const { nota, config, firma } = await notaDeVistaPrevia(…); return renderPdf(nota, opcionesPdf(config, firma));`, y `enviarPrueba` resuelve `const { firma } = await firmaParaFecha(config, hoy);` y lo pasa a `generarNota({ …, firma })`.

- [ ] **Step 6: Correr los tests de la tarea y toda la batería de Notas Digitales**

Run: `node --test tests/notas-licencias.test.js tests/notas-motor.test.js tests/notas-datos.test.js tests/notas-api.test.js tests/notas-contenido.test.js tests/notas-pdf.test.js tests/notas-anexo.test.js`
Expected: PASS. Los tests existentes no se tocan y siguen en verde (Review Focus 1).

- [ ] **Step 7: Suite completa** — ninguna falla nueva.

- [ ] **Step 8: Commit**

```bash
git add services/notasDigitalesFirmas.js services/notasDigitalesDatos.js services/notasDigitales.js tests/notas-licencias.test.js
git commit -m "feat: notas durante la licencia del firmante: avisos anticipados, autorización por nota y dos firmas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 8: Estado de Correos con la licencia del firmante

**Files:**
- Modify: `services/notasDigitales.js` (`estadoNotas`)
- Test: `tests/notas-licencias.test.js` (agregar)

**Interfaces:**
- Produces: `estadoNotas({ hoy })` suma `licencia_firmante: { desde, hasta, en_curso, autorizado, nota_autorizacion, autorizado_no_vigente, sin_dias_habiles, vispera, ultimo_habil, vuelta } | null` (`nota_autorizacion`: `{ numero, anio }` o `null`). Ajusta las fechas:
  - un aviso que caería dentro de la licencia pasa a la víspera, si todavía no pasó;
  - si ya pasó y no hay autorizado, el aviso pasa a la vuelta;
  - sin autorizado, una reiteración que caería dentro de la licencia pasa a la vuelta;
  - con autorizado, las reiteraciones quedan en su fecha.

  Suma las alertas `autorizado-no-vigente` (error) y `sin-firma` del titular.

- [ ] **Step 1: Tests que fallan.** Agregar al final de `tests/notas-licencias.test.js`:

```js
describe('Estado de Correos (spec 7.5)', () => {
  it('sin licencia: licencia_firmante es null', async () => {
    assert.equal((await motor.estadoNotas({ hoy: '2026-11-02' })).licencia_firmante, null);
  });

  it('licencia próxima sin autorizado: víspera y vuelta, y el próximo aviso pasa a la víspera', async () => {
    await licencia(titular, '2026-11-26', '2027-01-14');
    await crearDataset({ vencimiento: '2027-01-31' });
    const estado = await motor.estadoNotas({ hoy: '2026-11-10' });
    assert.deepEqual(estado.licencia_firmante, {
      desde: '2026-11-26', hasta: '2027-01-14', en_curso: false, autorizado: null, nota_autorizacion: null,
      autorizado_no_vigente: false, sin_dias_habiles: false, vispera: '2026-11-25', ultimo_habil: '2027-01-14', vuelta: '2027-01-15'
    });
    assert.equal(estado.proximas.interna.aviso.fecha, '2026-11-25');
  });

  it('licencia en curso sin autorizado: la próxima reiteración es a la vuelta', async () => {
    await licencia(titular, '2026-11-26', '2027-01-14');
    const estado = await motor.estadoNotas({ hoy: '2026-12-02' });
    assert.equal(estado.licencia_firmante.en_curso, true);
    assert.equal(estado.proximas.interna.reiteracion.fecha, '2027-01-15');
  });

  it('licencia en curso con autorizado: la reiteración queda en su fecha y se informa la nota de autorización', async () => {
    const licenciaId = await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    await correr('2026-11-25');
    const estado = await motor.estadoNotas({ hoy: '2026-12-02' });
    assert.equal(estado.licencia_firmante.autorizado, 'Firma admin');
    const [nota] = await query('SELECT numero, anio FROM notas_digitales WHERE id = ?', [await notaDeAutorizacionDe(licenciaId)]);
    assert.deepEqual(estado.licencia_firmante.nota_autorizacion, { numero: nota.numero, anio: nota.anio });
    assert.equal(estado.proximas.interna.reiteracion.fecha, '2026-12-02');
  });

  it('autorizado que ya no cumple las condiciones: alerta de error', async () => {
    await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [autorizado.id]);
    const estado = await motor.estadoNotas({ hoy: '2026-11-10' });
    assert.equal(estado.licencia_firmante.autorizado_no_vigente, true);
    assert.ok(estado.alertas.some(a => a.tipo === 'autorizado-no-vigente' && a.nivel === 'error'));
  });

  it('titular sin imagen de firma: la advertencia sin-firma mira la suya', async () => {
    await query('UPDATE usuarios_firmas SET imagen = NULL WHERE usuario_id = ?', [titular.id]);
    assert.ok((await motor.estadoNotas({ hoy: '2026-11-02' })).alertas.some(a => a.tipo === 'sin-firma'));
  });
});
```

- [ ] **Step 2: Correr y ver que fallan** — `node --test tests/notas-licencias.test.js`: FAIL en los 6 nuevos.

- [ ] **Step 3: Implementar** en `services/notasDigitales.js`.

(a) Imports: sumar `autorizadoVigente` al import de `./notasDigitalesFirmas.js`, `licenciaEnFecha, proximaLicencia` desde `./licenciasService.js`, y `ultimoDiaHabilHasta` al del calendario.

(b) Agregar antes de `estadoNotas`:

```js
// Licencia del firmante titular en curso o la próxima, con lo que hace falta para mostrar su efecto (spec 2026-10-15, 7.5)
const licenciaDelFirmante = async (config, hoy) => {
  if (!config.firmante_usuario_id) return null;
  const licencia = (await licenciaEnFecha(config.firmante_usuario_id, hoy)) ?? (await proximaLicencia(config.firmante_usuario_id, hoy));
  if (!licencia) return null;
  const autorizado = await autorizadoVigente(licencia, hoy);
  const [[nota]] = licencia.nota_autorizacion_id
    ? await pool.query('SELECT numero, anio FROM notas_digitales WHERE id = ?', [licencia.nota_autorizacion_id])
    : [[null]];
  const ultimoHabil = ultimoDiaHabilHasta(licencia.hasta);
  return {
    desde: licencia.desde,
    hasta: licencia.hasta,
    en_curso: licencia.desde <= hoy,
    autorizado: autorizado ? autorizado.nombre : null,
    nota_autorizacion: nota ? { numero: nota.numero, anio: nota.anio } : null,
    autorizado_no_vigente: Boolean(licencia.autorizado_id) && !autorizado,
    sin_dias_habiles: ultimoHabil < licencia.desde,
    vispera: diaHabilAnterior(licencia.desde),
    ultimo_habil: ultimoHabil,
    vuelta: proximoDiaHabil(sumarDias(licencia.hasta, 1))
  };
};
```

(c) En `estadoNotas`:
- `const firmaTitular = await firmaTitularDe(config);` al principio, y `configuracion_faltante: configuracionCompleta(config, firmaTitular)`;
- `const licencia = await licenciaDelFirmante(config, hoy);` y `const dentro = (fecha) => Boolean(licencia) && !licencia.sin_dias_habiles && fecha >= licencia.desde && fecha <= licencia.hasta;`
- dentro del `for`, después de calcular `aviso`:

```js
    // Un aviso que caería dentro de una licencia del firmante se anticipa a la víspera, si todavía no pasó; si ya pasó,
    // sin autorizado sale a la vuelta (con autorizado, en su fecha)
    if (aviso && dentro(aviso.fecha)) {
      if (licencia.vispera >= corrida) {
        aviso = { fecha: licencia.vispera, cantidad: (await seleccionarParaAviso(gestion, licencia.vispera, licencia.ultimo_habil)).length };
      } else if (!licencia.autorizado) {
        aviso = { fecha: licencia.vuelta, cantidad: (await seleccionarParaAviso(gestion, licencia.vuelta)).length };
      }
    }
```

  y reemplazar `const fechaReiteracion = …` por `let fechaReiteracion = …` seguido de `if (!licencia?.autorizado && dentro(fechaReiteracion)) fechaReiteracion = licencia.vuelta;`.
- en la respuesta, sumar `licencia_firmante: licencia`;
- reemplazar la advertencia `sin-firma` (`...(config.firma_imagen ? [] : [ … ])`) por:

```js
      // La imagen de la firma que usan las notas: la del titular, si hay uno elegido
      ...((config.firmante_usuario_id ? firmaTitular?.imagen : config.firma_imagen) ? [] : [{
        tipo: 'sin-firma', nivel: 'advertencia', mensaje: 'No hay imagen de la firma: las notas saldrían sin la firma escaneada.'
      }]),
      ...(licencia?.autorizado_no_vigente ? [{
        tipo: 'autorizado-no-vigente', nivel: 'error',
        mensaje: `La persona autorizada para la licencia del firmante (del ${formatoCorto(licencia.desde)} al ${formatoCorto(licencia.hasta)}) ya no está activa, no tiene su firma cargada o está de licencia: esos días no se generan notas.`
      }] : []),
```

- [ ] **Step 4: Correr** `node --test tests/notas-licencias.test.js tests/notas-api.test.js tests/permisos.test.js`: PASS.

- [ ] **Step 5: Suite completa** — ninguna falla nueva.

- [ ] **Step 6: Commit**

```bash
git add services/notasDigitales.js tests/notas-licencias.test.js
git commit -m "feat: el Estado de Correos muestra la licencia del firmante y corre las fechas de los próximos envíos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 9: Pantalla de Usuarios con la pestaña Licencias

**Files:**
- Modify: `public/js/api.js`
- Modify: `public/usuarios.html`
- Modify: `public/js/usuarios.js`
- Modify: las 14 páginas `public/*.html` (versión de los scripts compartidos)
- Test: `tests/paginas.test.js`, `tests/usuarios-frontend.test.js`

**Interfaces:**
- Consumes: la API de la Task 4 (forma de la respuesta en su bloque Interfaces).
- Produces: `API.getLicencias(incluirPasadas)`, `API.crearLicencia(datos)`, `API.editarLicencia(id, datos)`, `API.anularLicencia(id)`, `API.getMiFirma()`, `API.guardarMiFirma(datos)`, `API.getImagenMiFirma()`, `API.getFirmantesNotas()`, `API.elegirFirmanteNotas(usuarioId)` (los de firma los usa la Task 10).

- [ ] **Step 1: `public/js/api.js`.** Después de `enviarAccesoUsuario`, agregar:

```js
  // === LICENCIAS (spec 2026-10-15-dias-habiles-licencias-auditoria, 5) ===
  async getLicencias(incluirPasadas = false) {
    return (await this.pedirJson('GET', `/usuarios/licencias${incluirPasadas ? '?incluir_pasadas=1' : ''}`)).data;
  },

  async crearLicencia(datos) {
    return this.pedirJson('POST', '/usuarios/licencias', datos);
  },

  async editarLicencia(id, datos) {
    return this.pedirJson('PUT', `/usuarios/licencias/${id}`, datos);
  },

  async anularLicencia(id) {
    return this.pedirJson('POST', `/usuarios/licencias/${id}/anular`);
  },

  // === MI FIRMA (spec 6.1) ===
  async getMiFirma() {
    return (await this.pedirJson('GET', '/auth/profile/firma')).data;
  },

  async guardarMiFirma(datos) {
    return this.pedirJson('PUT', '/auth/profile/firma', datos);
  },

  async getImagenMiFirma() {
    return this.pedirArchivo('/auth/profile/firma/imagen');
  },
```

y después de `getMembreteNotas`:

```js
  // Firmante titular de las notas (spec 6.2)
  async getFirmantesNotas() {
    return (await this.pedirJson('GET', '/notificaciones/notas-digitales/config/firmantes')).data;
  },

  async elegirFirmanteNotas(usuarioId) {
    return this.pedirJson('PUT', '/notificaciones/notas-digitales/config/firmante', { usuario_id: usuarioId });
  },
```

- [ ] **Step 2: Versión de los scripts compartidos.** En `tests/paginas.test.js`: `const VERSION = '20261021';`. En todas las páginas:

```bash
sed -i -E 's#js/(auth|main|api)\.js\?v=20261016#js/\1.js?v=20261021#g' public/*.html
grep -c 'v=20261021' public/*.html
sed -i 's#js/usuarios.js?v=20261016#js/usuarios.js?v=20261021#' public/usuarios.html
sed -i 's#js/perfil.js?v=20261016#js/perfil.js?v=20261021#' public/perfil.html
sed -i -E 's#js/correos.js\?v=[0-9]+#js/correos.js?v=20261021#' public/correos.html
```

Run: `node --test tests/paginas.test.js`
Expected: PASS.

- [ ] **Step 3: Tests del frontend que fallan.** Agregar al final de `tests/usuarios-frontend.test.js`:

```js
describe('licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.5)', () => {
  const evaluar = (contexto, expresion) => vm.runInContext(expresion, contexto);

  it('período y marca de la lista, sin pasar por Date', () => {
    const { contexto } = cargarPanel();
    assert.equal(evaluar(contexto, "textoPeriodo({ desde: '2026-11-26', hasta: '2027-01-14' })"), 'Del 26/11/2026 al 14/01/2027');
    assert.match(evaluar(contexto, "etiquetaLicencia({ desde: '2026-11-26', hasta: '2027-01-14', en_curso: true })"), /De licencia hasta 14\/01/);
    assert.match(evaluar(contexto, "etiquetaLicencia({ desde: '2026-11-26', hasta: '2027-01-14', en_curso: false })"), /Licencia desde 26\/11/);
    assert.equal(evaluar(contexto, 'etiquetaLicencia(null)'), '');
  });

  it('efecto en las notas: con autorizado, y sin autorizado con la víspera', () => {
    const { contexto } = cargarPanel();
    const conAutorizado = evaluar(contexto, "efectoEnNotas({ vispera: '2026-11-25' }, 'Persona Autorizada')");
    assert.match(conAutorizado, /comunica la autorización a Persona Autorizada/);
    assert.match(conAutorizado, /Persona Autorizada presenta las demás notas/);
    assert.match(evaluar(contexto, "efectoEnNotas({ vispera: '2026-11-25' }, null)"), /por adelantado el 25\/11\/2026/);
    assert.match(evaluar(contexto, 'efectoEnNotas(null, null)'), /último día hábil anterior/);
  });
});
```

Run: `node --test tests/usuarios-frontend.test.js`
Expected: FAIL (`textoPeriodo is not defined`).

- [ ] **Step 4: `public/usuarios.html`.**

(a) En el `<style>`, agregar:

```css
        /* Licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.5) */
        .pagina-pestanas { padding: 0; margin-bottom: 20px; }
        .etiqueta-licencia { background: var(--warning-light); color: #92400e; }
        .etiqueta-licencia-proxima { background: var(--gray-100); color: var(--gray-700); }
```

(b) Después del `</div>` del `page-header` (debajo del botón "Nuevo usuario"), agregar las pestañas y envolver el contenido actual:

```html
            <div class="usuario-pestanas pagina-pestanas" id="pagina-pestanas" role="tablist">
                <button type="button" class="usuario-pestana activa" data-vista="usuarios" role="tab" aria-selected="true">Usuarios</button>
                <button type="button" class="usuario-pestana" data-vista="licencias" role="tab" aria-selected="false">Licencias</button>
            </div>

            <div id="vista-usuarios">
```

El `<div id="vista-usuarios">` envuelve, sin cambiarlos, la tarjeta del buscador y las tres secciones de usuarios (`grupo-usuarios` de aprobadores, de lectores y `grupo-desactivados`); se cierra con `</div>` justo antes de `<!-- Footer -->`, seguido de la vista nueva:

```html
            <div id="vista-licencias" hidden>
                <section class="grupo-usuarios" aria-labelledby="titulo-licencias">
                    <div class="grupo-encabezado">
                        <h2 id="titulo-licencias">En curso y próximas</h2>
                        <button type="button" class="btn btn-primary btn-sm" id="btn-nueva-licencia">Nueva licencia</button>
                    </div>
                    <p class="lista-vacia" style="padding-bottom: 0;">Durante la licencia, la persona no recibe emails del sistema. Las notas a casillas institucionales no cambian, salvo la licencia de quien firma las notas.</p>
                    <div id="lista-licencias"><div class="loading"><div class="spinner"></div></div></div>
                </section>
                <details class="grupo-usuarios grupo-desactivados" id="grupo-licencias-pasadas">
                    <summary><h2>Terminadas y anuladas</h2></summary>
                    <div id="lista-licencias-pasadas"></div>
                </details>
            </div>
```

(c) Después del modal de usuario, agregar el modal de licencia:

```html
    <!-- Modal Licencia -->
    <div class="modal-overlay" id="modal-licencia">
        <div class="modal" style="max-width: 560px;" role="dialog" aria-modal="true" aria-labelledby="modal-licencia-titulo">
            <div class="modal-header">
                <h3 class="modal-title" id="modal-licencia-titulo">Nueva licencia</h3>
                <button type="button" class="modal-close" id="modal-licencia-cerrar" aria-label="Cerrar">&times;</button>
            </div>
            <div class="modal-body">
                <div id="licencia-error" class="aviso aviso-error" role="alert" hidden></div>
                <form id="form-licencia" novalidate>
                    <div class="form-group">
                        <label class="form-label" for="l-usuario">Persona <span class="requerido">*</span></label>
                        <select id="l-usuario" class="form-input"></select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" for="l-desde">Desde <span class="requerido">*</span></label>
                            <input type="date" id="l-desde" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="l-hasta">Hasta, inclusive <span class="requerido">*</span></label>
                            <input type="date" id="l-hasta" class="form-input">
                        </div>
                    </div>
                    <div class="form-group" id="grupo-autorizado" hidden>
                        <label class="form-label" for="l-autorizado">Autorizo a presentar las notas en mi nombre a:</label>
                        <select id="l-autorizado" class="form-input"></select>
                    </div>
                    <p id="licencia-efecto" class="aviso aviso-info" hidden></p>
                    <div class="acciones-form">
                        <button type="button" class="btn btn-danger" id="btn-anular-licencia" hidden>Anular</button>
                        <button type="button" class="btn btn-secondary" id="btn-cancelar-licencia">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btn-guardar-licencia">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
```

- [ ] **Step 5: `public/js/usuarios.js`.**

(a) Arriba, debajo de `CAMPO_A_INPUT`, agregar:

```js
// Licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.5)
let datosLicencias = { hoy: '', firmante_titular_id: null, soy_titular: false, licencias: [], usuarios: [], autorizables: [] };
let licenciaAbierta = null;   // licencia del modal; null = alta
const TEXTO_ESTADO_LICENCIA = { futura: 'Próxima', en_curso: 'En curso', pasada: 'Terminada', anulada: 'Anulada' };

// 'AAAA-MM-DD' → 'dd/mm/aaaa' sin pasar por Date (evita corrimientos de zona horaria)
const fechaCorta = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const textoPeriodo = ({ desde, hasta }) => `Del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
const etiquetaLicencia = (l) => {
  if (!l) return '';
  return l.en_curso
    ? `<span class="etiqueta etiqueta-licencia">De licencia hasta ${esc(fechaCorta(l.hasta).slice(0, 5))}</span>`
    : `<span class="etiqueta etiqueta-licencia-proxima">Licencia desde ${esc(fechaCorta(l.desde).slice(0, 5))}</span>`;
};
// Efecto de la licencia del firmante titular en las notas (spec 7.2 y 7.3)
const efectoEnNotas = (licencia, autorizadoNombre) => {
  const cuando = licencia?.vispera ? `el ${fechaCorta(licencia.vispera)}` : 'el último día hábil anterior';
  return autorizadoNombre
    ? `Los avisos que tocarían durante la licencia salen por adelantado ${cuando} (corrida de las 8:15), en una nota que comunica la autorización a ${autorizadoNombre}. Durante la licencia, ${autorizadoNombre} presenta las demás notas con las dos firmas, citando esa nota.`
    : `Sin persona autorizada: los avisos que tocarían durante la licencia salen por adelantado ${cuando} (corrida de las 8:15) y las reiteraciones se postergan a la vuelta. Cargá la licencia antes de ese día.`;
};
```

Y **antes** de `TEXTO_ACCION` (tiene que estar declarada antes de usarse), agregar

```js
const ACCION_LICENCIA = { licencia_cargada: 'Licencia cargada', licencia_editada: 'Licencia modificada', licencia_anulada: 'Licencia anulada' };
```

y sumar `...ACCION_LICENCIA` como último elemento de `TEXTO_ACCION` (queda con las acciones de hoy más las de licencia).

(b) En `etiquetasDe(u)`, agregar `etiquetaLicencia(u.licencia),` como segundo elemento del arreglo (después de la del rol).

(c) En `describirDetalle`, antes del último `return ''`, agregar:

```js
  if (accion in ACCION_LICENCIA && d.despues) return `${textoPeriodo(d.antes)} → ${textoPeriodo(d.despues)}`;
  if (accion in ACCION_LICENCIA && d.desde) return textoPeriodo(d);
```

(d) En el `DOMContentLoaded`, agregar los eventos (antes de `cargarUsuarios();`):

```js
  document.getElementById('pagina-pestanas').addEventListener('click', (evento) => {
    const pestana = evento.target.closest('[data-vista]');
    if (pestana) mostrarVista(pestana.dataset.vista);
  });
  document.getElementById('btn-nueva-licencia').addEventListener('click', () => abrirModalLicencia(null));
  document.getElementById('grupo-licencias-pasadas').addEventListener('toggle', cargarLicenciasPasadas);
  document.getElementById('form-licencia').addEventListener('submit', guardarLicencia);
  document.getElementById('l-usuario').addEventListener('change', prepararAutorizado);
  document.getElementById('l-autorizado').addEventListener('change', actualizarEfecto);
  document.getElementById('btn-anular-licencia').addEventListener('click', anularLicencia);
  document.getElementById('btn-cancelar-licencia').addEventListener('click', cerrarModalLicencia);
  document.getElementById('modal-licencia-cerrar').addEventListener('click', cerrarModalLicencia);
```

en el `click` de `main`, después del de `[data-ver]`:

```js
    const editar = evento.target.closest('[data-licencia]');
    if (editar) abrirModalLicencia(datosLicencias.licencias.find(l => l.id === Number(editar.dataset.licencia)) ?? null);
```

y en el `keydown` de Escape: `if (evento.key === 'Escape' && document.getElementById('modal-licencia').classList.contains('active')) cerrarModalLicencia();`.

(e) Agregar al final del archivo:

```js
// =====================================================
// LICENCIAS (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.5)
// =====================================================
function mostrarVista(nombre) {
  document.querySelectorAll('#pagina-pestanas [data-vista]').forEach(boton => {
    const activa = boton.dataset.vista === nombre;
    boton.classList.toggle('activa', activa);
    boton.setAttribute('aria-selected', String(activa));
  });
  document.getElementById('vista-usuarios').hidden = nombre !== 'usuarios';
  document.getElementById('vista-licencias').hidden = nombre !== 'licencias';
  document.getElementById('btn-nuevo-usuario').hidden = nombre !== 'usuarios';
  if (nombre === 'licencias') cargarLicencias();
}

async function cargarLicencias() {
  try {
    datosLicencias = await API.getLicencias();
    const vigentes = datosLicencias.licencias.filter(l => l.estado === 'futura' || l.estado === 'en_curso');
    document.getElementById('lista-licencias').innerHTML = vigentes.length
      ? vigentes.map(filaLicencia).join('')
      : '<p class="lista-vacia">No hay licencias en curso ni próximas.</p>';
  } catch (error) {
    document.getElementById('lista-licencias').innerHTML = `<p class="lista-vacia">No se pudieron cargar las licencias: ${esc(error.message)}</p>`;
  }
}

async function cargarLicenciasPasadas() {
  if (!document.getElementById('grupo-licencias-pasadas').open) return;
  const lista = document.getElementById('lista-licencias-pasadas');
  try {
    const todas = await API.getLicencias(true);
    const pasadas = todas.licencias.filter(l => l.estado === 'pasada' || l.estado === 'anulada').reverse();
    lista.innerHTML = pasadas.length ? pasadas.map(filaLicencia).join('') : '<p class="lista-vacia">No hay licencias terminadas ni anuladas.</p>';
  } catch (error) {
    lista.innerHTML = `<p class="lista-vacia">No se pudieron cargar: ${esc(error.message)}</p>`;
  }
}

const filaLicencia = (l) => {
  const esTitular = l.usuario_id === datosLicencias.firmante_titular_id;
  const vigente = l.estado === 'futura' || l.estado === 'en_curso';
  const detalle = [textoPeriodo(l), TEXTO_ESTADO_LICENCIA[l.estado], l.creado_por_nombre ? `Cargó ${l.creado_por_nombre}` : ''].filter(Boolean);
  return `
    <article class="fila-usuario${vigente ? '' : ' fila-desactivada'}">
      <div class="usuario-avatar" aria-hidden="true">${esc(getInitials(l.usuario_nombre))}</div>
      <div class="usuario-datos">
        <div class="usuario-nombre"><strong>${esc(l.usuario_nombre)}</strong>${esTitular ? '<span class="etiqueta rol-superadmin">Firma las notas</span>' : ''}</div>
        <div class="usuario-detalle">${detalle.map(d => `<span>${esc(d)}</span>`).join('')}</div>
        ${esTitular && vigente ? `<div class="usuario-ingreso text-muted">${esc(efectoEnNotas(l, l.autorizado_nombre))}</div>` : ''}
      </div>
      ${vigente ? `<button type="button" class="btn btn-secondary btn-sm" data-licencia="${esc(l.id)}" aria-label="Editar la licencia de ${esc(l.usuario_nombre)}">Editar</button>` : ''}
    </article>`;
};

function abrirModalLicencia(l) {
  licenciaAbierta = l;
  limpiarErrorLicencia();
  document.getElementById('modal-licencia-titulo').textContent = l ? `Licencia de ${l.usuario_nombre}` : 'Nueva licencia';
  const selector = document.getElementById('l-usuario');
  const opciones = datosLicencias.usuarios.map(u => ({ id: u.id, nombre: u.nombre_completo }));
  if (l && !opciones.some(o => o.id === l.usuario_id)) opciones.push({ id: l.usuario_id, nombre: l.usuario_nombre });
  selector.innerHTML = opciones.map(o => `<option value="${esc(o.id)}">${esc(o.nombre)}</option>`).join('');
  if (l) selector.value = String(l.usuario_id);
  selector.disabled = Boolean(l);
  escribir('l-desde', l?.desde);
  escribir('l-hasta', l?.hasta);
  document.getElementById('l-desde').disabled = l?.estado === 'en_curso';
  document.getElementById('btn-anular-licencia').hidden = !l || l.desde < datosLicencias.hoy;
  prepararAutorizado();
  document.getElementById('modal-licencia').classList.add('active');
}

function cerrarModalLicencia() {
  document.getElementById('modal-licencia').classList.remove('active');
  licenciaAbierta = null;
}

// La persona autorizada: solo en la licencia del firmante titular, y solo la elige el titular (spec 6.3)
function prepararAutorizado() {
  const usuarioId = Number(document.getElementById('l-usuario').value);
  const esTitular = usuarioId === datosLicencias.firmante_titular_id;
  const puedeAutorizar = esTitular && datosLicencias.soy_titular;
  document.getElementById('grupo-autorizado').hidden = !puedeAutorizar;
  if (puedeAutorizar) {
    const selector = document.getElementById('l-autorizado');
    selector.innerHTML = ['<option value="">Nadie: se anticipan los avisos</option>',
      ...datosLicencias.autorizables.map(a => `<option value="${esc(a.id)}">${esc(a.nombre_completo)}</option>`)].join('');
    selector.value = licenciaAbierta?.autorizado_id ? String(licenciaAbierta.autorizado_id) : '';
  }
  actualizarEfecto();
}

function actualizarEfecto() {
  const usuarioId = Number(document.getElementById('l-usuario').value);
  const efecto = document.getElementById('licencia-efecto');
  efecto.hidden = usuarioId !== datosLicencias.firmante_titular_id;
  if (efecto.hidden) return;
  const elegido = document.getElementById('grupo-autorizado').hidden
    ? licenciaAbierta?.autorizado_nombre
    : datosLicencias.autorizables.find(a => String(a.id) === document.getElementById('l-autorizado').value)?.nombre_completo;
  efecto.textContent = efectoEnNotas(licenciaAbierta, elegido ?? null);
}

async function guardarLicencia(evento) {
  evento.preventDefault();
  limpiarErrorLicencia();
  const datos = { desde: document.getElementById('l-desde').value, hasta: document.getElementById('l-hasta').value };
  if (!document.getElementById('grupo-autorizado').hidden) datos.autorizado_id = document.getElementById('l-autorizado').value || null;
  const boton = document.getElementById('btn-guardar-licencia');
  boton.disabled = true;
  try {
    const res = licenciaAbierta
      ? await API.editarLicencia(licenciaAbierta.id, datos)
      : await API.crearLicencia({ ...datos, usuario_id: Number(document.getElementById('l-usuario').value) });
    avisar(res.message, 'success');
    cerrarModalLicencia();
    await Promise.all([cargarLicencias(), cargarUsuarios()]);
  } catch (error) {
    mostrarErrorLicencia(error);
  } finally {
    boton.disabled = false;
  }
}

async function anularLicencia() {
  const l = licenciaAbierta;
  if (!l || !confirm(`¿Anular la licencia de ${l.usuario_nombre} (${textoPeriodo(l).toLowerCase()})?`)) return;
  try {
    const res = await API.anularLicencia(l.id);
    avisar(res.message, 'success');
    cerrarModalLicencia();
    await Promise.all([cargarLicencias(), cargarUsuarios()]);
  } catch (error) {
    mostrarErrorLicencia(error);
  }
}

function limpiarErrorLicencia() {
  document.getElementById('licencia-error').hidden = true;
}

function mostrarErrorLicencia(error) {
  const caja = document.getElementById('licencia-error');
  caja.textContent = error.message;
  caja.hidden = false;
}
```

- [ ] **Step 6: Tests del frontend**

Run: `node --test tests/usuarios-frontend.test.js tests/paginas.test.js`
Expected: PASS.

- [ ] **Step 7: Recorrido en el navegador** (app local: `npm start`; ingresar con un usuario de prueba admin creado para esto en la base local, nunca con usuarios reales): pestaña Licencias, nueva licencia para un admin de prueba, editar, anular; la marca "Licencia desde …" en la lista; un lector no ve la página. Anotar en el reporte lo que se vio. Al terminar, borrar las licencias y el usuario de prueba creados.

- [ ] **Step 8: Suite completa** — ninguna falla nueva.

- [ ] **Step 9: Commit**

```bash
git add public/js/api.js public/usuarios.html public/js/usuarios.js public/*.html tests/paginas.test.js tests/usuarios-frontend.test.js
git commit -m "feat: pestaña Licencias en Usuarios y marca de licencia en la lista

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 10: Mi firma (Mi Perfil) y firmante titular en Correos

**Files:**
- Modify: `public/perfil.html`, `public/js/perfil.js`
- Modify: `public/correos.html`, `public/js/correos.js`
- Test: `tests/correos-frontend.test.js` (agregar)

**Interfaces:**
- Consumes: `API.getMiFirma`, `API.guardarMiFirma`, `API.getImagenMiFirma`, `API.getFirmantesNotas`, `API.elegirFirmanteNotas` (Task 9); `estado.licencia_firmante` (Task 8); `config.firmante` (Task 5).

- [ ] **Step 1: Test que falla.** Agregar al final de `tests/correos-frontend.test.js`:

```js
describe('correos.js: firmante titular (spec 2026-10-15-dias-habiles-licencias-auditoria, 6.2)', () => {
  it('con firmante, los campos de firma muestran los suyos, no se editan y no se envían al guardar', () => {
    const { contexto } = cargarCorreos();
    vm.runInContext("configActual = { firmante: { nombre_completo: 'Persona Titular', nombre: 'Téc. Titular', cargo: 'Director' } }", contexto);
    contexto.aplicarFirmante();
    const elemento = (id) => vm.runInContext(`document.getElementById('${id}')`, contexto);
    assert.equal(elemento('firma_nombre').disabled, true);
    assert.equal(elemento('firma_nombre').value, 'Téc. Titular');
    assert.equal(elemento('firma_cargo').value, 'Director');
    assert.equal(elemento('firma-archivo').disabled, true);
    assert.match(elemento('firma-ayuda').textContent, /Persona Titular/);
    assert.deepEqual(Object.keys(vm.runInContext('datosDelFormulario()', contexto)).filter(c => c.startsWith('firma')), []);
  });

  it('sin firmante, todo como antes', () => {
    const { contexto } = cargarCorreos();
    vm.runInContext('configActual = { firmante: null }', contexto);
    contexto.aplicarFirmante();
    const elemento = (id) => vm.runInContext(`document.getElementById('${id}')`, contexto);
    assert.equal(elemento('firma_nombre').disabled, false);
    assert.ok(Object.keys(vm.runInContext('datosDelFormulario()', contexto)).includes('firma_nombre'));
  });

  it('texto de la licencia del firmante para el Estado', () => {
    const { contexto } = cargarCorreos();
    const texto = (l) => vm.runInContext(`textoLicenciaFirmante(${JSON.stringify(l)})`, contexto);
    assert.equal(texto(null), '');
    assert.match(texto({ desde: '2026-11-26', hasta: '2027-01-14', en_curso: false, autorizado: null, vispera: '2026-11-25', vuelta: '2027-01-15' }),
      /los avisos se anticipan el 25\/11\/2026 y las reiteraciones se postergan al 15\/01\/2027/);
    assert.match(texto({ desde: '2026-11-26', hasta: '2027-01-14', en_curso: false, autorizado: 'Persona Autorizada', vispera: '2026-11-25' }),
      /los avisos se anticipan el 25\/11\/2026 con la autorización a Persona Autorizada/);
    assert.match(texto({ desde: '2026-11-26', hasta: '2027-01-14', en_curso: true, autorizado: 'Persona Autorizada', nota_autorizacion: { numero: 15, anio: 2026 } }),
      /Persona Autorizada presenta las notas por autorización, con las dos firmas \(autorización comunicada en la Nota Digital N° 15\/26\)/);
  });

  it('el libro muestra las notas de autorización, sin gestión ni datasets', () => {
    const { contexto } = cargarCorreos();
    assert.equal(vm.runInContext("ETIQUETAS.autorizacion", contexto), 'Autorización');
    assert.equal(vm.runInContext("textoGestion(null)", contexto), '—');
    assert.equal(vm.runInContext("textoGestion('interna')", contexto), 'Interna');
  });
});
```

(El stub `elemento` de `cargarCorreos` no tiene `textContent`: agregarle `textContent: ''` al objeto que crea, sin cambiar lo demás.)

Run: `node --test tests/correos-frontend.test.js`
Expected: FAIL (`contexto.aplicarFirmante is not a function`).

- [ ] **Step 2: `public/js/correos.js`.**

(a) Reemplazar el `confirm` de `cambiarEnvioAutomatico` y todo lo demás no se toca, salvo lo siguiente.

(b) En `guardarConfiguracion`, reemplazar la línea `const datos = …` por `const datos = datosDelFormulario();` y agregar antes de esa función:

```js
// Los campos del formulario que se guardan: los de la firma deshabilitados (con firmante titular) no se envían
function datosDelFormulario() {
  return Object.fromEntries(CAMPOS_CONFIG
    .filter(campo => !document.getElementById(campo).disabled)
    .map(campo => [campo, document.getElementById(campo).value]));
}
```

(c) En `cargarConfiguracion`, después de `Object.keys(IMAGENES_CONFIG).forEach(mostrarImagen);`, agregar `aplicarFirmante();` y `cargarFirmantes();`.

(d) Agregar, después de `cargarConfiguracion`:

```js
// Con firmante titular elegido, la firma de las notas es la de su Mi Perfil: los campos de firma de esta pantalla muestran
// sus datos y no se editan (spec 2026-10-15-dias-habiles-licencias-auditoria, 6.2)
function aplicarFirmante() {
  const firmante = configActual?.firmante ?? null;
  for (const id of ['firma_nombre', 'firma_cargo', 'firma-archivo']) document.getElementById(id).disabled = Boolean(firmante);
  if (firmante) {
    document.getElementById('firma_nombre').value = firmante.nombre ?? '';
    document.getElementById('firma_cargo').value = firmante.cargo ?? '';
  }
  document.getElementById('firma-ayuda').textContent = firmante
    ? `Firma ${firmante.nombre_completo}: el nombre, el cargo y la imagen se cambian en su Mi Perfil.`
    : '';
}

async function cargarFirmantes() {
  const selector = document.getElementById('firmante');
  try {
    const candidatos = await API.getFirmantesNotas();
    selector.innerHTML = ['<option value="">Nadie: la firma cargada en esta pantalla</option>',
      ...candidatos.map(c => `<option value="${c.id}">${Utils.escapeHtml(`${c.nombre_completo} (${c.nombre}, ${c.cargo})`)}</option>`)].join('');
    selector.value = configActual?.firmante_usuario_id ? String(configActual.firmante_usuario_id) : '';
    selector.disabled = !Auth.isSuperadmin();
    document.getElementById('firmante-ayuda').textContent = Auth.isSuperadmin()
      ? 'Aparecen el superadmin y los admins activos con su firma cargada en Mi Perfil.'
      : 'Lo elige el superadmin.';
  } catch (error) {
    avisar(`No se pudieron cargar los firmantes: ${error.message}`, 'error');
  }
}

async function elegirFirmante(evento) {
  const valor = evento.target.value;
  try {
    const res = await API.elegirFirmanteNotas(valor ? Number(valor) : null);
    avisar(res.message, 'success');
    cargarEstado();
  } catch (error) {
    avisar(error.message, 'error');
  }
  await cargarConfiguracion();
}

// Licencia del firmante para el Estado (spec 7.5)
function textoLicenciaFirmante(l) {
  if (!l) return '';
  const periodo = `del ${fecha(l.desde)} al ${fecha(l.hasta)}`;
  if (l.sin_dias_habiles) return `Licencia del firmante ${periodo}: no tiene días hábiles, las notas no cambian.`;
  if (l.autorizado) {
    const nota = l.nota_autorizacion ? ` (autorización comunicada en la Nota Digital N° ${l.nota_autorizacion.numero}/${String(l.nota_autorizacion.anio).slice(-2)})` : '';
    return l.en_curso
      ? `Licencia del firmante ${periodo}: ${l.autorizado} presenta las notas por autorización, con las dos firmas${nota}.`
      : `Licencia del firmante ${periodo}: los avisos se anticipan el ${fecha(l.vispera)} con la autorización a ${l.autorizado}, que presenta las demás notas durante la licencia.`;
  }
  const avisos = l.en_curso ? 'no se generan notas hasta la vuelta' : `los avisos se anticipan el ${fecha(l.vispera)}`;
  return `Licencia del firmante ${periodo}, sin autorizado: ${avisos} y las reiteraciones se postergan al ${fecha(l.vuelta)}.`;
}
```

(e) En el `DOMContentLoaded`, agregar `document.getElementById('firmante').addEventListener('change', elegirFirmante);`.

(e2) Libro con notas de autorización (spec 7.2): en `ETIQUETAS` agregar `autorizacion: 'Autorización'`; agregar, debajo de `ETIQUETAS`,

```js
// La nota de autorización no tiene gestión
const textoGestion = (gestion) => (gestion ? ETIQUETAS[gestion] : '—');
```

y en `cargarLibro` reemplazar `<td>${ETIQUETAS[n.gestion]}</td>` por `<td>${textoGestion(n.gestion)}</td>`, y la celda de datasets por `<td>${n.es_prueba || n.tipo === 'autorizacion' ? '—' : `${n.cantidad_datasets}${n.seccion_dataset ? ` (${n.seccion_dataset === 'vencido' ? 'vencido' : 'próximo'})` : ''}`}</td>`.

En `public/correos.html`, en `filtro-tipo`, cambiar el texto de la primera opción a `Todos los tipos` y agregar `<option value="autorizacion">Autorización</option>`.

En `controllers/notasDigitalesController.js`, el filtro del libro acepta el tipo nuevo, pero la vista previa y la prueba no: agregar `const TIPOS_LIBRO = [...TIPOS, 'autorizacion'];` y en `listarNotas` usar `TIPOS_LIBRO.includes(tipo)` en lugar de `TIPOS.includes(tipo)`.

(f) En `cargarEstado`, después de `textoUltimaCorrida`:

```js
    const licencia = document.getElementById('nd-licencia');
    licencia.textContent = textoLicenciaFirmante(estado.licencia_firmante);
    licencia.hidden = !estado.licencia_firmante;
```

- [ ] **Step 3: `public/correos.html`.** En la tarjeta de Estado, después de `<p id="nd-ultima-corrida" class="test-hint"></p>`, agregar `<p id="nd-licencia" class="test-hint" hidden></p>`. En el formulario de Configuración, antes del `<fieldset>` de "Firma", agregar:

```html
                    <fieldset>
                        <legend>Firmante titular</legend>
                        <div class="form-group">
                            <label class="form-label" for="firmante">Firma las notas</label>
                            <select id="firmante" class="form-input"></select>
                        </div>
                        <p class="form-hint" id="firmante-ayuda"></p>
                    </fieldset>
```

y dentro del `<fieldset>` de "Firma", como último elemento: `<p class="form-hint" id="firma-ayuda"></p>`.

- [ ] **Step 4: `public/perfil.html`.** En el `<style>`, agregar:

```css
        [hidden] { display: none !important; }
        .firma-vista { display: block; max-width: 220px; max-height: 90px; margin-top: 8px; border: 1px dashed var(--gray-300); padding: 4px; background: #ffffff; }
```

Después de la tarjeta "Cambiar Contraseña" (antes de `<!-- Gestión de Cambios (solo admin) -->`), agregar:

```html
                <!-- Mi firma (admin y superadmin): la usan las Notas Digitales cuando firmás o presentás una nota -->
                <div class="profile-card" id="seccion-firma" hidden>
                    <div class="profile-card-header">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        <h2>Mi firma</h2>
                    </div>
                    <div class="profile-card-body">
                        <p class="form-hint" id="firma-estado"></p>
                        <form id="form-firma">
                            <div class="form-group">
                                <label class="form-label" for="firma-nombre">Nombre para la firma <span style="color: var(--danger);">*</span></label>
                                <input type="text" id="firma-nombre" class="form-input" maxlength="150" placeholder="Ej.: Téc. Nombre Apellido">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="firma-cargo">Cargo para la firma <span style="color: var(--danger);">*</span></label>
                                <input type="text" id="firma-cargo" class="form-input" maxlength="200">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="firma-archivo">Imagen de la firma (PNG o JPEG, máximo 500 KB)</label>
                                <input type="file" id="firma-archivo" class="form-input" accept="image/png,image/jpeg">
                                <img id="firma-vista" class="firma-vista" alt="Tu firma cargada" hidden>
                            </div>
                            <button type="submit" class="btn btn-primary" id="btn-guardar-firma" style="width: 100%;">Guardar firma</button>
                        </form>
                    </div>
                </div>
```

- [ ] **Step 5: `public/js/perfil.js`.** En el `DOMContentLoaded`, dentro del `if (Auth.isAdmin())` existente, agregar al principio:

```js
    document.getElementById('seccion-firma').hidden = false;
    document.getElementById('form-firma').addEventListener('submit', guardarMiFirma);
    cargarMiFirma();
```

y al final del archivo:

```js
// =====================================================
// MI FIRMA (spec 2026-10-15-dias-habiles-licencias-auditoria, 6.1)
// =====================================================
let urlImagenFirma = null;

async function cargarMiFirma() {
  try {
    const firma = await API.getMiFirma();
    document.getElementById('firma-nombre').value = firma.nombre ?? '';
    document.getElementById('firma-cargo').value = firma.cargo ?? '';
    document.getElementById('firma-estado').textContent = firma.cargada
      ? 'Con esta firma salen las notas que firmás o presentás por autorización.'
      : 'Todavía no cargaste tu firma: se proponen tu nombre y tu cargo.';
    await mostrarImagenFirma(firma.tiene_imagen);
  } catch (error) {
    Utils.showError(`No se pudo cargar tu firma: ${error.message}`);
  }
}

async function mostrarImagenFirma(tiene) {
  const vista = document.getElementById('firma-vista');
  if (urlImagenFirma) URL.revokeObjectURL(urlImagenFirma);
  urlImagenFirma = null;
  vista.hidden = true;
  if (!tiene) return;
  try {
    urlImagenFirma = URL.createObjectURL(await API.getImagenMiFirma());
    vista.src = urlImagenFirma;
    vista.hidden = false;
  } catch {
    // sin vista previa
  }
}

const leerComoDataUrl = (archivo) => new Promise((resolve, reject) => {
  const lector = new FileReader();
  lector.onload = () => resolve(lector.result);
  lector.onerror = () => reject(new Error('No se pudo leer la imagen'));
  lector.readAsDataURL(archivo);
});

async function guardarMiFirma(evento) {
  evento.preventDefault();
  const boton = document.getElementById('btn-guardar-firma');
  boton.disabled = true;
  try {
    const datos = {
      nombre: document.getElementById('firma-nombre').value.trim(),
      cargo: document.getElementById('firma-cargo').value.trim()
    };
    const archivo = document.getElementById('firma-archivo').files[0];
    if (archivo) {
      if (!['image/png', 'image/jpeg'].includes(archivo.type)) throw new Error('La firma debe ser una imagen PNG o JPEG');
      if (archivo.size > 500 * 1024) throw new Error('La imagen debe pesar como máximo 500 KB');
      datos.imagen = await leerComoDataUrl(archivo);
      datos.mime = archivo.type;
    }
    const res = await API.guardarMiFirma(datos);
    Utils.showSuccess(res.message);
    document.getElementById('firma-archivo').value = '';
    await cargarMiFirma();
  } catch (error) {
    Utils.showError(error.message);
  } finally {
    boton.disabled = false;
  }
}
```

- [ ] **Step 6: Tests del frontend**

Run: `node --test tests/correos-frontend.test.js tests/paginas.test.js`
Expected: PASS.

- [ ] **Step 7: Recorrido en el navegador** (app local, con un usuario de prueba admin y otro superadmin creados para esto, nunca con usuarios reales; la base local **no** tiene firmante titular): Mi Perfil → Mi firma (guardar textos e imagen, ver la vista previa); Correos → Configuración: el admin ve el selector deshabilitado, el superadmin elige al firmante de prueba y los campos de firma pasan a mostrar sus datos; "Ver PDF" de la vista previa sale con su firma; volver a "Nadie" y comprobar que la configuración queda como estaba. Anotar lo visto en el reporte; al terminar, dejar `firmante_usuario_id` en NULL y borrar los usuarios y firmas de prueba.

- [ ] **Step 8: Suite completa** — ninguna falla nueva.

- [ ] **Step 9: Commit**

```bash
git add public/perfil.html public/js/perfil.js public/correos.html public/js/correos.js controllers/notasDigitalesController.js tests/correos-frontend.test.js
git commit -m "feat: Mi firma en Mi Perfil, firmante titular en Correos y licencia del firmante en el Estado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 11: Documentación

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: CLAUDE.md.**
  - En `### Roles`, agregar: `- **Licencias:** superadmin, admins (y editores) pueden tener licencias (pestaña Licencias de Usuarios). Durante la licencia no reciben emails del sistema; los avisos al superadmin se retienen y le llega un resumen a la vuelta. Ver services/licenciasReglas.js y services/avisosSuperadminService.js.`
  - En `### Base de datos`, cambiar `21 tablas` por `23 tablas` y sumar: `usuarios_licencias` (licencias; nunca se borran, se anulan) y `usuarios_firmas` (firma de cada usuario para las notas).
  - Agregar una sección:

```markdown
### Firma de las Notas Digitales y licencia del firmante
- Cada usuario carga su firma en Mi Perfil (`usuarios_firmas`). El superadmin elige al firmante titular en Correos (`notas_digitales_config.firmante_usuario_id`). Sin titular elegido, las notas usan la firma cargada en Correos, como antes.
- `services/notasDigitalesFirmas.js` decide cómo se firma cada fecha (`firmaParaFecha`). La víspera de la licencia del titular se anticipan los avisos (`anticipoPorLicencia`). Con persona autorizada, esos avisos (o una nota de tipo `autorizacion`) comunican la autorización (`autorizacionPendiente`); la licencia guarda esa nota (`usuarios_licencias.nota_autorizacion_id`) y durante la licencia las notas salen con las dos firmas y una leyenda que la cita. Sin autorizado, durante la licencia no se generan notas y las reiteraciones salen a la vuelta. Un aviso anticipado cuenta los 20 días de la reiteración desde `notas_digitales_datasets.cuenta_desde`.
```

- [ ] **Step 2: README.**
  - En `### Panel de usuarios`, agregar un punto: `- **Licencias** (pestaña Licencias): fechas de licencia de admins y del superadmin. Durante la licencia esa persona no recibe emails del sistema. En la licencia de quien firma las notas, los avisos se anticipan al último día hábil anterior. El titular puede autorizar a otra persona: la autorización se comunica en esa nota (o en una nota de autorización) y la persona autorizada presenta las demás notas con las dos firmas, citando su número. Si no autoriza a nadie, las reiteraciones salen a la vuelta.`
  - Agregar, antes de `### Migración: Notas Digitales`, la sección de despliegue de esta entrega, con la misma forma que `### Migración: Usuarios (superadmin y panel de usuarios)`:

```markdown
### Migración: Licencias y firmas

⚠️ Requisito: la migración de usuarios y la entrega de días hábiles aplicadas. No hay dependencias nuevas de npm.

1. **Backup de la base** (phpMyAdmin → Exportar → Personalizado, con "Agregar sentencia DROP TABLE / VIEW / PROCEDURE / FUNCTION / EVENT / TRIGGER") y **de los archivos** (comprimir `controllers`, `routes`, `services` y `public` dentro de la carpeta de la app).
2. **Migración de estructura:** phpMyAdmin → pestaña **SQL** → pegar `database/updates/migracion-licencias-firmas.sql` → **Continuar**. Solo agrega tablas y columnas; el código actual sigue funcionando con la estructura nueva. Si se corta a mitad, se puede volver a correr.
3. **Subir los archivos** (zip con los archivos que cambian y sus carpetas → Cargar → Extraer en la carpeta de la app) y, enseguida, **Setup Node.js App → Restart**. No hace falta "Run NPM Install".
4. **Firmante titular:** phpMyAdmin → pestaña SQL → pegar `database/privado/licencias-firmas-datos.sql` (no está en el repositorio). Va **después** del Restart. El `SELECT` final muestra al firmante con su firma.
5. **Verificar:** el firmante entra a Mi Perfil → Mi firma y revisa el nombre y el cargo con que firma; Correos → Configuración muestra al firmante titular y "Ver PDF" sale con su firma; Usuarios → Licencias carga y lista; Correos → Estado sin alertas nuevas.

**Si algo sale mal:** subir de nuevo los archivos del backup → Restart → phpMyAdmin → pegar `database/updates/rollback-licencias-firmas.sql`. Las notas vuelven a salir con la firma cargada en Correos (la migración no la toca).
```

  - En `## Changelog`, agregar arriba:

```markdown
### Días hábiles, licencias y firmas (2026-10)
- Todos los recordatorios automáticos salen solo en días hábiles (sin fines de semana ni los feriados nacionales fijos)
- Licencias de los administradores: durante la licencia no reciben emails; resumen al superadmin a la vuelta
- Firma propia en Mi Perfil y firmante titular de las Notas Digitales
- Durante la licencia del firmante: avisos anticipados a la víspera, y notas presentadas por una persona autorizada (autorización por Nota Digital, dos firmas y cita de esa nota) o reiteraciones a la vuelta
```

- [ ] **Step 3: Suite completa** — ninguna falla nueva.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: licencias, firmas por usuario y despliegue de la entrega 2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 12: Cierre (lo hace quien coordina, después de la revisión final)

- [ ] **Step 1:** Suite completa en la rama: ninguna falla nueva respecto de la línea de base.
- [ ] **Step 2:** Merge en `main` según lo que elija el usuario (superpowers:finishing-a-development-branch).
- [ ] **Step 3: Kit de despliegue** en el Escritorio, carpeta `RPAD-deploy-licencias-firmas` (fuera del repo):
  - `2-migracion-licencias-firmas.sql` (copia de la migración);
  - `3-archivos-rpad-licencias-firmas.zip`, armado con `git archive` desde `main` con exactamente los archivos de `controllers`, `routes`, `services` y `public` que cambiaron desde el commit anterior a la entrega 2 (`git diff --name-only <base>..main -- controllers routes services public`). Verificar que son idénticos a `main` (ignorando CRLF) y que incluye los nuevos: `controllers/licenciasController.js`, `controllers/firmasController.js`, `services/licenciasReglas.js`, `services/licenciasService.js`, `services/avisosSuperadminService.js`, `services/imagenesSubidas.js`, `services/firmasService.js`, `services/notasDigitalesFirmas.js`;
  - `5-licencias-firmas-datos.sql` (copia de `database/privado/licencias-firmas-datos.sql`, PRIVADO);
  - `rollback-licencias-firmas.sql`;
  - `PASOS.txt` con el orden de la sección de README de la Task 11, la ruta real `/home/datospublicos/rpad` y la lista de archivos nuevos a controlar.
