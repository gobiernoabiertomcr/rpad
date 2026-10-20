# El editor audita sin responsabilidad por la auditoría — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que un editor pueda aprobar o rechazar un cambio propuesto por un auditor aunque haya auditores disponibles, y que quede registrado «sin responsabilidad por la auditoría», visible solo en Mi Perfil.

**Architecture:** la regla vive en una sola función pura (`permisoParaAuditar`), que pasa a devolver cuatro claves; el controlador la aplica al listar, al mostrar el detalle y al aprobar o rechazar (con un 409 si lo confirmado no coincide) y la guarda en una columna nueva; Mi Perfil refleja lo que manda el servidor. `quienesAuditan` y todo lo que depende de ella no se tocan.

**Tech Stack:** Node 22 + Express (ES Modules), MariaDB (mysql2), vanilla JS, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-20-editor-sin-responsabilidad-design.md`

**Dónde se trabaja:** worktree `C:\git\rpad\.claude\worktrees\editor-sin-responsabilidad` (rama `feat/editor-sin-responsabilidad`, desde `main` 0d1098a). Su `.env` apunta a la base `rpad_dev_sin_responsabilidad` (copia de la local), para no tocar la de la otra sesión. Suite de base: `scratchpad/suite-antes.txt`.

## Global Constraints

- Textos exactos (copiar tal cual):
  - Aviso (servidor, `mensaje`): `Este cambio lo auditan {nombres}. Si lo aprobás o lo rechazás vos, queda registrado sin responsabilidad por la auditoría.` ({nombres} como `mensajeNoCorresponde`: «A», «A y B», «A, B y C»).
  - 409: `La situación de este cambio cambió. Revisá el aviso y volvé a confirmar.`
  - Lector (403 de la regla): `Solo pueden auditar cambios los auditores y los editores.`
  - Pregunta de la confirmación: `¿Aprobar sin responsabilidad por la auditoría? El cambio se aplica al dataset ahora.`
  - Sufijo del revisor: ` (sin responsabilidad por la auditoría)`.
  - Grupo Editores en Usuarios: `Proponen cambios y auditan de respaldo o sin responsabilidad`.
- Clave del objeto `auditoria` y del cuerpo del POST: `sin_responsabilidad` (booleano). En el POST solo cuenta el `true` literal (`cuerpo?.sin_responsabilidad === true`); cualquier otra cosa es `false`.
- Columna: `revisado_sin_responsabilidad tinyint(1) NOT NULL DEFAULT 0`, después de `aviso_sin_auditores_at`.
- No se tocan: `quienesAuditan`, `canalDelCambio`, `entraEnRecordatorio`, `public/js/api.js`, `public/js/auth.js`, nada del Seguimiento, notas, emails, Gestión ni reportes.
- SQL siempre parametrizado; español en nombres, comentarios y textos; comentarios con la densidad del código vecino.
- `npm test` completo antes (ya corrido) y después.

## Review Focus

1. Un `perfil.js` viejo (sin el campo) intenta aprobar sin responsabilidad → 409, el cambio sigue pendiente (Task 3, «sin confirmar»).
2. El proponente ya no está en `personas` (dejó de ser superadmin/admin/editor) → nunca `sin_responsabilidad` (Task 2).
3. Un cuerpo con `sin_responsabilidad: "true"` o `1` → cuenta como `false` (Task 3).
4. Un 409 al rechazar conserva lo escrito en el motivo y la fila vuelve a abrirse con el aviso nuevo (Task 4; lo hace `reabrirRechazo`).
5. Un auditor (o un editor de respaldo) que manda `sin_responsabilidad: true` → 409 (Task 3).

---

### Task 1: La columna nueva, su migración y su rollback

**Files:**
- Create: `database/updates/migracion-editor-sin-responsabilidad.sql`, `database/updates/rollback-editor-sin-responsabilidad.sql`
- Modify: `database/schema.sql:71` (después de `aviso_sin_auditores_at`)
- Test: `tests/schema.test.js` (it «editor y auditoría…» ~L139 y un `describe` nuevo al final)

**Interfaces:** Produces la columna `cambios_pendientes.revisado_sin_responsabilidad`.

- [ ] **Step 1: tests.** En el it «editor y auditoría de cambios pendientes» sumar a la lista `'cambios_pendientes.revisado_sin_responsabilidad tinyint(1) null=NO default=0 key='` y `assert.equal(posicion('revisado_sin_responsabilidad'), posicion('aviso_sin_auditores_at') + 1, …)`. `describe('migración de «el editor audita sin responsabilidad»')` con una base descartable propia (patrón de «Requiere nota DGMIT»: `schema.sql` y después `ALTER TABLE cambios_pendientes DROP COLUMN revisado_sin_responsabilidad`): (a) cabecera con `ORDEN: correr ANTES` y el nombre del rollback; las líneas de código (sin comentarios) no contienen `DROP`, `RENAME`, `CHECK`, `USE` ni `DELIMITER`; (b) la migración dos veces deja exactamente las columnas de una base creada con `schema.sql`; (c) el rollback dos veces quita la columna y deja el resto igual; (d) el it existente de rollback/migración de editor-auditoría sigue pasando sin cambios.
- [ ] **Step 2:** `node --test tests/schema.test.js` → FAIL (falta la columna y los archivos).
- [ ] **Step 3:** escribir la migración (`SET NAMES utf8mb4;` + `ALTER TABLE \`cambios_pendientes\` ADD COLUMN IF NOT EXISTS \`revisado_sin_responsabilidad\` tinyint(1) NOT NULL DEFAULT 0 AFTER \`aviso_sin_auditores_at\`;`), con la cabecera de `migracion-editor-auditoria.sql` (spec, «Solo agrega», ORDEN, se puede repetir, rollback), y el rollback (`DROP COLUMN IF EXISTS`, cabecera «primero volver a subir los archivos anteriores y Restart; después correr esto»; si se revierte también `rollback-editor-auditoria.sql`, este va primero). Sumar la columna a `schema.sql`. Aplicar la migración a `rpad_dev_sin_responsabilidad` (`docker exec -i -e MYSQL_PWD=… rpad-db mariadb -uroot rpad_dev_sin_responsabilidad < database/updates/migracion-editor-sin-responsabilidad.sql`).
- [ ] **Step 4:** `node --test tests/schema.test.js` → PASS.
- [ ] **Step 5:** commit `feat: columna revisado_sin_responsabilidad en cambios_pendientes`.

### Task 2: La regla

**Files:**
- Modify: `services/auditoriaReglas.js:66-95`
- Test: `tests/auditoria-reglas.test.js` (describe «permiso para aprobar o rechazar»)

**Interfaces:**
- Produces: `permisoParaAuditar(usuario: {id, rol}, proponenteId: number, personas: [{id, rol, nombre_completo, disponible}]) → { puede, respaldo, sin_responsabilidad, mensaje }` (siempre las cuatro claves; `mensaje` string o null). `avisoSinResponsabilidad(auditores: [{nombre_completo}]) → string`. `MENSAJE_SITUACION_CAMBIADA` (el texto del 409). `mensajeNoCorresponde` sin cambios.

- [ ] **Step 1: tests** (con el `EQUIPO` del archivo; `AVISO = 'Este cambio lo auditan Persona Auditora. Si lo aprobás o lo rechazás vos, queda registrado sin responsabilidad por la auditoría.'`):
  - auditor (los tres casos de hoy) → `{ puede: true, respaldo: false, sin_responsabilidad: false, mensaje: null }`.
  - editor 3, cambio del titular (1), auditor 2 disponible → `{ puede: true, respaldo: false, sin_responsabilidad: true, mensaje: AVISO }`.
  - editor de respaldo (los dos casos de hoy) → `{ puede: true, respaldo: true, sin_responsabilidad: false, mensaje: null }`.
  - editor 3, cambio del editor 4, auditores disponibles → `{ puede: false, respaldo: false, sin_responsabilidad: false, mensaje: 'Este cambio lo auditan Persona Titular y Persona Auditora. Podés auditarlo solo si ninguno está disponible.' }`.
  - editor 3, proponente 99 (no está en `personas`), auditores disponibles → `puede: false` con `mensajeNoCorresponde` de 1 y 2.
  - lector → `{ puede: false, respaldo: false, sin_responsabilidad: false, mensaje: 'Solo pueden auditar cambios los auditores y los editores.' }`.
  - nunca `respaldo && sin_responsabilidad`: recorrer revisores 1–4 y lector × proponentes 1–4 y 99 × disponibilidades (todos, sin 2, sin 1 y 2, nadie).
  - `avisoSinResponsabilidad([EQUIPO[0], EQUIPO[1]])` con «Persona Titular y Persona Auditora».
- [ ] **Step 2:** `node --test tests/auditoria-reglas.test.js` → FAIL.
- [ ] **Step 3:** implementar. El proponente se busca en `personas` por id; es «de un auditor» si está y `esAuditor(rol)`. Usa `quienesAuditan` tal cual (no se modifica). Actualizar los comentarios de la sección (el de `:82-87` y el de `mensajeNoCorresponde`).
- [ ] **Step 4:** → PASS. Correr también `node --test tests/avisos-diarios.test.js tests/notas-auditoria.test.js` si hay Docker: no deberían cambiar.
- [ ] **Step 5:** commit `feat: un editor audita sin responsabilidad los cambios de un auditor`.

### Task 3: La API

**Files:**
- Modify: `controllers/cambiosPendientesController.js` (`:13-18` comentario; para-revisar `:264-272`; detalle `:367-371`; aprobar `:458-462` y `:594-599`; rechazar `:668-680`)
- Test: `tests/auditoria-api.test.js`, `tests/cambios-listas-api.test.js`

**Interfaces:**
- Consumes: Task 2 (`permisoParaAuditar`, `MENSAJE_SITUACION_CAMBIADA`); Task 1 (columna).
- Produces: `auditoria` con `sin_responsabilidad` (lista: más `auditan`); `POST …/aprobar` y `…/rechazar` aceptan `sin_responsabilidad` y responden 409 `{ success: false, error: MENSAJE_SITUACION_CAMBIADA }`; las listas traen `revisado_sin_responsabilidad` (por `cp.*`).

- [ ] **Step 1: tests.** En `auditoria-api.test.js`: `aprobar(id, clave, cuerpo = {})`, `rechazar(id, clave, extra = {})` (cuerpo `{ comentario, ...extra }`), `fila()` suma `revisado_sin_responsabilidad` (actualizar todos los `deepEqual` con `revisado_sin_responsabilidad: 0`), `AVISO = 'Este cambio lo auditan Test adminB y Test superadmin. Si lo aprobás o lo rechazás vos, queda registrado sin responsabilidad por la auditoría.'`. Reemplazar «con auditores disponibles, el editor recibe 403…» por:
  - el editor aprueba un cambio de adminA con `{ sin_responsabilidad: true }` → 200, fila `{ estado: 'aprobado', revisor_id: editor, revisado_como_respaldo: 0, revisado_sin_responsabilidad: 1 }`; en `mis-cambios` de adminA, `revisado_sin_responsabilidad === 1`.
  - editor2 rechaza igual → `rechazado`, `revisado_sin_responsabilidad: 1`.
  - sin confirmar: aprobar y rechazar con `{}`, `{ sin_responsabilidad: false }`, `{ sin_responsabilidad: 'true' }` y `{ sin_responsabilidad: 1 }` → 409 con el mensaje; sigue pendiente.
  - un cambio de `editor`, con auditores disponibles: `editor2` con `{ sin_responsabilidad: true }` → 403 `'Este cambio lo auditan Test adminA, Test adminB y Test superadmin. Podés auditarlo solo si ninguno está disponible.'`.
  - de respaldo (adminB y superadmin de licencia), el editor con `{ sin_responsabilidad: true }` → 409; sin el campo → 200 con `revisado_como_respaldo: 1, revisado_sin_responsabilidad: 0`.
  - adminB con `{ sin_responsabilidad: true }` → 409.
  - detalle: editor → `{ puede: true, respaldo: false, sin_responsabilidad: true, mensaje: AVISO }`; adminB → `{ puede: true, respaldo: false, sin_responsabilidad: false, mensaje: null }`; adminA (propio) → los cuatro en falso/null; de licencia → editor `{ puede: true, respaldo: true, sin_responsabilidad: false, mensaje: null }`.
  En `cambios-listas-api.test.js`: los `deepEqual` de `deLista` y `delDetalle` con la clave nueva (editor: `{ puede: true, respaldo: false, sin_responsabilidad: true, mensaje: AVISO, auditan: AUDITAN }`); el test de claves pasa a `['mensaje', 'puede', 'respaldo', 'sin_responsabilidad']` y su título dice «sus cuatro claves».
- [ ] **Step 2:** `node --test tests/auditoria-api.test.js tests/cambios-listas-api.test.js` → FAIL.
- [ ] **Step 3:** implementar. Lista: por defecto `{ puede: false, respaldo: false, sin_responsabilidad: false, mensaje: null, auditan: [] }`; pendiente: `{ ...permisoParaAuditar(...), auditan }` (`auditan` como hoy). Detalle: el mismo valor por defecto sin `auditan`. Aprobar y rechazar: después del 403, `if ((req.body?.sin_responsabilidad === true) !== permiso.sin_responsabilidad)` → rollback y 409; el `UPDATE` escribe `revisado_sin_responsabilidad = ?` con `permiso.sin_responsabilidad ? 1 : 0`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** commit `feat: la API registra la auditoría sin responsabilidad y frena si la situación cambió`.

### Task 4: Mi Perfil

**Files:**
- Modify: `public/js/perfil.js` (`:503-522` aprobarCambio, `:539-561` confirmarAprobacion, `:564-582` abrirModalRechazo, `:603-634` confirmarRechazo, `:761-790`, `:1003-1013`, `:1228`), `public/perfil.html` (CSS `:122` y `?v=` de `perfil.js`)
- Test: `tests/perfil-frontend.test.js`, `tests/paginas.test.js` (`VERSION_PERFIL` → `'20261118'`, con su comentario)

**Interfaces:**
- Consumes: Task 3 (`auditoria.sin_responsabilidad`, `auditoria.mensaje`, el 409 con `error.status` vía `API.pedirJson`, `revisado_sin_responsabilidad`).
- Produces: `notaSinResponsabilidad(id, mensaje) → '<div class="pf-nota sin-responsabilidad" id="aviso-{id}">{escudo}<span>{mensaje escapado}</span></div>'`; `reabrirFila(n) → boolean`.

- [ ] **Step 1: tests.** Infraestructura: en `armarAcciones`, el `API` por defecto suma `pedirJson(metodo, ruta, cuerpo)` que despacha `POST /cambios-pendientes/{id}/aprobar` a `API.aprobarCambio(id, cuerpo)` y `…/rechazar` a `API.rechazarCambio(id, cuerpo.comentario, cuerpo)` (los stubs de siempre, sobre el objeto ya mezclado) y tira error con cualquier otra ruta: así los tests existentes siguen valiendo. Constantes: `AVISO_EDITOR = 'Este cambio lo auditan Laura. Si lo aprobás o lo rechazás vos, queda registrado sin responsabilidad por la auditoría.'`, `SIN_RESPONSABILIDAD = { puede: true, respaldo: false, sin_responsabilidad: true, mensaje: AVISO_EDITOR, auditan: ['Laura'] }`. Casos:
  - `textoRevisor` con `revisado_sin_responsabilidad: 1` → `'Aprobado por Persona Editora (sin responsabilidad por la auditoría)'` y `'Rechazado por …'`; con las dos en 0, sin sufijo.
  - `marcaDeAuditoria(SIN_RESPONSABILIDAD)` → `'Lo auditan Laura'` (con escudo, clase `pf-marca`).
  - `permisoDeAuditoria({})` → `sin_responsabilidad === false`.
  - `botonesDeAuditoria(5, SIN_RESPONSABILIDAD)`: habilitados, los dos con `aria-describedby="aviso-5"`; con `{ puede: true, respaldo: false, sin_responsabilidad: false }`, sin `aria-describedby`.
  - `htmlDeFila` de un editor con `SIN_RESPONSABILIDAD`: contiene `notaSinResponsabilidad(7, AVISO_EDITOR)`, `'Lo auditan Laura'`, `onclick="aprobarCambio(7)"`; no contiene `no-corresponde` ni `disabled`. En modo `'mio'`, ni la nota ni botones (sumar `sin-responsabilidad` a la regex del test de Mis cambios). El test «un editor sin permiso» queda igual con el título «…(el cambio es de otro editor)».
  - aprobar sin responsabilidad (`paraRevisar: [pendiente(7, SIN_RESPONSABILIDAD), pendiente(8)]`): la pregunta exacta de Global Constraints, `aria-describedby` de cancelar y confirmar = `'pregunta-7 aviso-7'`; al confirmar, el cuerpo recibido es `{ sin_responsabilidad: true }`. Aprobar normal manda `{ sin_responsabilidad: false }` y conserva la pregunta y el `aria-describedby` de hoy.
  - rechazar sin responsabilidad: el `textarea` con `aria-describedby="aviso-7"`; el cuerpo `{ comentario: 'Falta la fuente', sin_responsabilidad: true }`.
  - 409 al aprobar: el stub cambia `paraRevisar` a `[pendiente(7, { puede: true, respaldo: true, sin_responsabilidad: false, mensaje: null, auditan: [] })]` y tira un error con `status = 409` y el mensaje del 409 → el error a la vista, `cabeza-7` con `aria-expanded="true"`, `cuerpo-7` visible y el foco en `cabeza-7` con `{ preventScroll: true }`.
  - `perfil.html` tiene la regla `.pf-nota.sin-responsabilidad`.
- [ ] **Step 2:** `node --test tests/perfil-frontend.test.js tests/paginas.test.js` → FAIL.
- [ ] **Step 3:** implementar.
  - `htmlDeFila`: la nota es `notaSinResponsabilidad` si `permiso.sin_responsabilidad`, `avisoNoCorresponde` si `!permiso.puede && permiso.mensaje` (como hoy), y va en el mismo lugar (cuerpo, antes del pie).
  - `marcaDeAuditoria`: pastilla si `respaldo`; si no, «Lo auditan …» cuando hay nombres, sin mirar `puede`.
  - `aprobarCambio` lee el permiso del cambio en `vistaParaRevisar.cambios` (sin el cambio, `false`) y lo guarda en el pedido de `confirmacionesDeAprobacion`.
  - `confirmarAprobacion` y `confirmarRechazo` usan `API.pedirJson('POST', …, cuerpo)`. El rechazo calcula `sin_responsabilidad` de la misma lista al enviar.
  - En el error de `confirmarAprobacion`, si `error.status === 409`, después de `recargarCambios()` llama `reabrirFila(n)`; si devuelve `false`, el foco de siempre.
  - `reabrirFila(n)`: si el cambio sigue pendiente en `vistaParaRevisar` y su cabecera existe, `desplegarFila(cabeza, true)`, foco en la cabecera con `preventScroll` y `true`.
  - CSS: `.pf-nota.no-corresponde, .pf-nota.sin-responsabilidad { … }`.
  - Corregir los comentarios afectados. `?v=` y `VERSION_PERFIL` a `20261118`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** commit `feat: Mi Perfil deja auditar sin responsabilidad, con el aviso en la fila`.

### Task 5: Textos de Usuarios

**Files:**
- Modify: `public/usuarios.html:211` (y el `?v=` de `usuarios.js`), `public/js/usuarios.js:127-138`
- Test: `tests/usuarios-frontend.test.js:623-631`, `tests/paginas.test.js` (versión de `usuarios.js`)

- [ ] **Step 1: tests.** `textoCambioDeRol`:
  - otra persona → Editor: `/^Persona de Prueba va a pasar a Editor: podrá proponer cambios y auditarlos de respaldo, cuando no haya auditores disponibles, y sin responsabilidad por la auditoría los de los auditores\. ¿Continuar\?$/`;
  - uno mismo → Editor: `/^Vas a pasar a Editor: dejás de ser auditor\. Vas a poder auditar de respaldo, cuando no haya auditores disponibles, y sin responsabilidad por la auditoría los cambios de los auditores\. ¿Continuar\?$/`;
  - el texto del grupo Editores en `usuarios.html` es exactamente el de Global Constraints.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** cambiar los textos y subir la versión de `usuarios.js`. `VERSION_PANTALLAS` es solo de `usuarios.js`: verificarlo; si la comparten otros scripts, crear una constante propia para `usuarios.js`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** commit `feat: Usuarios dice que el editor audita de respaldo o sin responsabilidad`.

### Task 6: Documentación

**Files:** `CLAUDE.md` (doble verificación, rol editor, `GET /:id`, base de datos: la columna y su migración antes del código), `README.md` (tabla de roles, doble verificación, sección «Migración: …», árbol de `database/updates`, Changelog), notas «Cambio del 20/10/2026» en las specs `2026-10-15-dias-habiles-licencias-auditoria-design.md` (8.2) y `2026-10-16-perfil-pestanas-gestion-cambios-design.md` (donde fija `{ puede, respaldo, mensaje }`).

- [ ] **Step 1:** escribir los cambios, sin reescribir lo histórico.
- [ ] **Step 2:** `node --test tests/paginas.test.js` (algunos tests leen el README o CLAUDE.md: verificar con `grep -l "README\|CLAUDE.md" tests/*.js` y correrlos).
- [ ] **Step 3:** commit `docs: el editor audita sin responsabilidad por la auditoría`.

### Task 7: Verificación

- [ ] **Step 1:** `npm test` completo en el worktree (base `rpad_dev_sin_responsabilidad` migrada) y comparar con `scratchpad/suite-antes.txt`: mismas cantidades más los tests nuevos, 0 fallas.
- [ ] **Step 2: caso real.** Copia nueva del dump de producción (`database/dump-local/datospublicos_mcr_rpad.sql`) en `rpad_sim_sin_responsabilidad`, más la migración. Servidor del worktree con esa base (lanzador en el scratchpad, entrada en `.claude/launch.json`) y contraseña de prueba para la editora y el admin, solo en la copia. La editora aprueba el cambio pendiente de «Presupuesto Municipal» con el admin disponible: aviso y confirmación como en la spec; en la base, `aprobado`, `revisado_sin_responsabilidad = 1`, `revisado_como_respaldo = 0` y el dataset actualizado; Revisados y Mis cambios del superadmin con el sufijo. Contraprueba en otra copia con licencia del admin: «(respaldo)». Capturas para el usuario.
- [ ] **Step 3:** revisión de toda la rama por un revisor nuevo (superpowers:requesting-code-review) y corregir lo que encuentre.
