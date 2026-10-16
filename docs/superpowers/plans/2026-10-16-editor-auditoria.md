# Entrega 3: rol editor y auditoría de cambios pendientes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un rol nuevo, **editor**, con todo lo de un admin salvo dos cosas: audita cambios solo de respaldo (cuando ese día ningún auditor disponible puede hacerlo) y en el panel de usuarios solo crea y modifica lectores. Los cambios pendientes pasan a un circuito con dos canales: un **recordatorio** diario (14:00, días hábiles) a quienes pueden auditarlos y, para los que el firmante titular no puede auditar, una **Nota Digital de auditoría** numerada (8:15) a la Dirección General, que se reitera cada 5 días hábiles. **Sin romper nada de lo que hoy funciona.**

**Architecture:** Una migración aditiva (rol `editor`, dos columnas en `cambios_pendientes`, tipo de nota `auditoria`, tabla `notas_digitales_cambios`, destinatarios de auditoría). Las reglas puras van en `services/auditoriaReglas.js` (quién audita, el permiso al aprobar o rechazar, el **canal** de cada cambio y si va como nuevo o reiterado) y las lecturas en `services/auditoriaService.js` (quién está **disponible** cada día, el canal de cada cambio pendiente, qué cambios van en la nota de hoy). El recordatorio (`avisosDiariosService.enviarCambiosPendientes`), la regla de aprobar y rechazar (`cambiosPendientesController`), la nota de auditoría (motor de Notas Digitales) y el Estado de Correos usan esas mismas funciones: el canal se calcula en un solo lugar. La nota de auditoría es una Nota Digital más (`construirNotaDeAuditoria`), con la estructura común que ya dibujan el HTML, el texto y el PDF, que suman tablas con proporciones propias, un detalle por cambio y apartados con viñetas.

**Tech Stack:** Node 22 en producción (24 en desarrollo), Express 4, ES Modules, MariaDB 10.11 (mysql2/promise), PDFKit, Nodemailer, frontend vanilla JS, `node:test` contra Docker (MariaDB + Mailpit).

**Spec:** `docs/superpowers/specs/2026-10-15-dias-habiles-licencias-auditoria-design.md`, secciones 3, 8, 9, 10, 11.2, 12 y 13 (entrega 3), 14 (editor y auditoría) y 15, más las menciones "(desde la entrega 3)" de 5.2, 5.3, 6.1 y 6.3. Los números de sección que se citan ("spec 9.1") son de esa spec.

## Decisiones del plan

Casos que la spec no resuelve del todo, decididos acá (los implementadores no los vuelven a decidir):

1. **Un auditor (superadmin o admin) siempre puede auditar los cambios de otros, aunque ese día esté de licencia.** La regla de 8.2 ("pueden auditar los auditores disponibles; si no hay ninguno, los editores disponibles") se aplica como **restricción al editor**: su mensaje de 403 ("Podés auditarlo solo si ninguno está disponible") solo tiene sentido para un editor. La disponibilidad decide a quién se le pide el cambio (recordatorio, nota) y si un editor puede actuar de respaldo; no le quita a un auditor una facultad de su rol. Así, además, nunca queda un cambio sin nadie habilitado cuando el único auditor está de licencia y no hay editores, y nada cambia para los admins de hoy.
2. **Un editor puede auditar de respaldo cuando ningún auditor disponible (que no sea quien lo propuso) puede hacerlo**, aunque él mismo esté de licencia (simétrico con la decisión 1). Nunca su propio cambio.
3. **"Propuesto al menos una hora antes de la corrida" y "fecha de la propuesta".** `cambios_pendientes.created_at` es `TIMESTAMP` con `DEFAULT current_timestamp()`: la base lo escribe con su propio reloj, lo guarda como instante y lo devuelve en la zona de la sesión. La base de Docker corre en UTC (`TZ: UTC` en `docker-compose.yml`) y la de producción puede estarlo; `ahoraArgentina()` es la hora de Argentina (UTC−3). Comparar el texto de `created_at` con `ahoraArgentina()` correría las cuentas 3 horas (en UTC, un cambio de hace 2 horas parecería del futuro). Por eso:
   - la antigüedad se calcula en SQL con el reloj de la base en los dos extremos: `TIMESTAMPDIFF(SECOND, cp.created_at, NOW())` (los dos valores salen en la zona de la sesión, y ni UTC ni Argentina cambian la hora en el año: la diferencia es la real en cualquiera de las dos situaciones; es lo que ya usa el email de cambios pendientes de hoy). Entra en el recordatorio si es ≥ 3600. No se usa `UNIX_TIMESTAMP() - UNIX_TIMESTAMP(…)`: MariaDB lo calcula sin signo y un `created_at` apenas en el futuro (relojes desfasados) daría un error de rango;
   - la fecha de la propuesta es `hoyArgentina(new Date(UNIX_TIMESTAMP(cp.created_at) * 1000))` (`UNIX_TIMESTAMP` de un `TIMESTAMP` es el instante, sin depender de la zona).
   Las dos son correctas con la base en UTC o en hora argentina. Lo fijan los tests de las Tasks 3 y 6 (un cambio de hace 61 minutos según la base entra; uno de 59, no; uno del 16/10 a las 22:30 de Argentina es del 16/10 aunque en UTC ya sea el 17).
4. **`primer_recordatorio_at`** se escribe con `ahoraArgentina()`, nunca con `NOW()`. `enviarCambiosPendientes` lo recibe como parámetro `ahora` (por defecto, `ahoraArgentina()`), para que los tests con fecha fija guarden un momento de ese día. "Ya tuvo su primer recordatorio en un día hábil anterior" = `DATE_FORMAT(primer_recordatorio_at, '%Y-%m-%d') < hoy` (se guardó en hora argentina).
5. **"Solicitado en … – reiterado N veces".** Se cita la **primera** nota de auditoría (no de prueba) que incluyó el cambio, y N = cantidad de notas de auditoría que lo incluyeron **después de esa y antes de la actual**, en cualquier estado (un cambio cuenta como incluido desde que la nota se genera, spec 9.3). La primera reiteración no agrega nada; la segunda dice "– reiterado 1 vez"; la tercera, "– reiterado 2 veces" (`vez`/`veces`, como las reiteraciones de datasets).
6. **Sin firmante titular elegido**, la condición 2 de 9.1 se evalúa con **todos** los usuarios `superadmin`: se cumple si ninguno puede auditar el cambio (lo propuso o no está disponible). Sin ningún superadmin, se cumple siempre. La condición 4 se cumple siempre (firma la configuración de Correos).
7. **Asunto del recordatorio** con el plural calculado, como el email de cambios pendientes de hoy (el "(s)" de la spec es notación de plantilla): `[RPAD] 1 cambio espera tu auditoría` / `[RPAD] 2 cambios esperan tu auditoría`. El cuerpo es el del email de cambios pendientes de hoy más el párrafo de respaldo; de paso se corrige el "Hace Hace 2 horas" que repetía la plantilla.
8. **Estructura de la nota de auditoría:** los puntos 5 y 6 de 10.3 son apartados con título, como "Justificación:": `Qué implica la auditoría:` (párrafo, cuatro ítems con viñeta y el párrafo del RPAD) e `Importancia:`. Las tablas de nuevos y reiterados no llevan introducción (la spec no la da). El detalle (punto 4) va bajo el título `Detalle de cada cambio`, una tabla por cambio: `Campo | Valor anterior | Valor nuevo` (modificación) o `Campo | Valor` (alta y baja), con las etiquetas de `public/admin.html`, los nombres de los catálogos y `Sin dato` para un valor vacío. La línea CC al pie queda vacía (no hay una para auditoría). En "Propuesto por" va `Nombre, Cargo` (o solo el nombre si no tiene cargo).
9. **`para_auditoria`** es obligatorio en Correos (no se puede guardar vacío), pero no entra en `configuracionCompleta`: un Para de auditoría vacío no frena las demás notas; el paso de auditoría de la corrida lo anota como error. Las columnas nuevas de `notas_digitales_config` van **después de `casillas_prueba`**, para no mover las posiciones que fija `tests/schema.test.js`.
10. **El firmante titular no puede pasar a editor ni a lector** desde el panel (409 con mensaje): la spec dice que solo superadmin o admin pueden ser firmante titular (6.2) y que el editor no puede serlo; sin este control, un cambio de rol dejaría a un editor firmando.
11. **Textos del 403 del panel para el editor** (la spec no los da): `Un editor solo puede crear y modificar usuarios lectores.` y `Un editor no puede cambiar roles.`
12. **Una sola nota de auditoría por día**, con un control explícito por fecha: si después de la corrida aparece otro cambio en el canal nota (una ejecución manual más tarde), sale en la del día hábil siguiente.
13. **Si la nota de autorización falla**, la de auditoría sigue la misma regla que las demás notas en la entrega 2: durante la licencia (autorización tardía) esa corrida no genera ninguna otra nota; en la víspera las reiteraciones (y ahora la auditoría) salen igual, firmadas solo por el titular, que todavía no está de licencia.
14. **Correos → Estado:** la próxima nota de auditoría se calcula con los cambios que hoy están en el canal nota (para un sábado, con los de la corrida del lunes); no anticipa licencias futuras del firmante (el canal ya refleja la licencia en curso).
15. **Historial de cambios (Mi Perfil):** "Revisado por {nombre}" pasa a `Aprobado por {nombre}` o `Rechazado por {nombre}`, con ` (respaldo)` si lo auditó un editor de respaldo.
16. **Panel de usuarios:** los editores van en un grupo propio, "Editores", entre "Pueden aprobar cambios" (auditores) y "Solo lectura".
17. **Tests existentes que cambian a propósito** (la spec cambia lo que fijaban): en `tests/schema.test.js`, el ENUM de `usuarios.rol` y el de `notas_digitales.tipo`; en `tests/usuarios-reglas.test.js`, `TEXTO_ROL`; en `tests/avisos-diarios.test.js` y `tests/notificaciones.test.js`, los cambios de prueba pasan a proponerse dos horas antes (la regla de una hora, 9.2); en `tests/paginas.test.js`, `VERSION`. `tests/notificaciones.test.js` y el describe `cron` de `tests/permisos.test.js` ya corren el cron contra la copia local de producción: desde esta entrega, además de los emails a Mailpit, deja `primer_recordatorio_at` en los cambios pendientes reales de esa copia local (nunca en producción).

## Global Constraints

- **Regla principal del usuario: no romper nada de lo implementado.** Línea de base de `main` (d2162d0): `ℹ tests 818`, `ℹ pass 817`, `ℹ fail 0`, `ℹ skipped 1`. El resumen de `node:test` usa el prefijo `ℹ` (no `#`). **Cada tarea termina corriendo la suite completa** (`npm test 2>&1 | tail -15`) y comparando con la línea de base: `ℹ fail 0` y `ℹ pass` igual a la línea de base más los tests nuevos. Si una falla existía en la línea de base, se informa y no se toca.
- **Requisito:** las entregas 1 y 2 están en `main` (d2162d0). Este plan usa `licenciasService`, `notasDigitalesFirmas.firmaParaFecha`, `firmasService` y el motor de Notas Digitales tal como quedaron.
- Se trabaja en la rama `feat/editor-auditoria` (ya creada, con este plan commiteado), nunca en `main`.
- Node 22 en producción: no usar APIs que no existan en Node 22. ES Modules, `async/await`, arrow functions, español en nombres, comentarios y textos.
- SQL siempre parametrizado con `?`. Los nombres de columna y de tabla solo pueden salir de listas fijas del código. Las fechas `DATE` se leen siempre con `DATE_FORMAT(..., '%Y-%m-%d')`.
- Respuestas de la API: `{ success, data?, error?, message? }`; los errores de validación suman `campo`. **Compatibilidad:** las respuestas existentes solo suman campos.
- **Hoy** es siempre `hoyArgentina()`; los servicios reciben `hoy` como parámetro para poder probarlos con fechas fijas. Una fecha y hora para guardar en una columna `DATETIME` (como `primer_recordatorio_at`) se escribe con `ahoraArgentina()`, nunca con `NOW()` (Decisiones 4); las columnas `TIMESTAMP` que ya se escriben con `NOW()` (`revisado_at`) siguen así, porque guardan el instante. **`cambios_pendientes.created_at` es `TIMESTAMP`: nunca se compara su texto con `ahoraArgentina()`** (Decisiones 3).
- **Disponible** (spec 3: activo, con contraseña definida y sin licencia ese día) se calcula solo en `auditoriaService.personasDeAuditoria`. El canal de un cambio se calcula solo con `auditoriaReglas.canalDelCambio`. Ningún otro archivo repite esas condiciones.
- **Quién puede aprobar o rechazar** (desvío deliberado de la letra de la spec 8.2, Decisiones 1 y 2): un auditor (superadmin o admin) siempre puede auditar cambios de otros, aunque ese día esté de licencia; un editor puede de respaldo cuando ningún auditor disponible que no lo propuso puede hacerlo, aunque él mismo esté de licencia. La disponibilidad decide a quién se le pide el cambio (recordatorio, nota), no quién puede auditarlo. Los revisores no lo marcan como defecto.
- **Sin cambios pendientes en el canal nota, las Notas Digitales salen exactamente como hoy**: la batería actual de Notas Digitales sigue en verde sin tocarla.
- **El repositorio es público:** ningún nombre de persona, email personal ni dato de `database/privado/`. Los tests usan datos inventados con dominio `@rpad.test`.
- **Antes de correr cualquier test:** `grep -E '^(SMTP_HOST|SMTP_PORT|RPAD_TESTS_DB_LOCAL|DB_HOST)=' .env` tiene que mostrar `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`, `RPAD_TESTS_DB_LOCAL=1` y `DB_HOST=127.0.0.1`. Si no, no se corre nada. En local todo email va a Mailpit: ningún envío real.
- **Los tests nuevos que escriben datos usan bases de prueba propias** (`crearBaseDePrueba('rpad_test_…')`), nunca la copia local de producción.
- **Acceso a la base local de Docker** (en bash, desde la raíz del repo):
  ```bash
  RP=$(grep '^DB_ROOT_PASSWORD=' .env | cut -d= -f2); DBN=$(grep '^DB_NAME=' .env | cut -d= -f2)
  mdb() { docker exec -i -e MYSQL_PWD="$RP" rpad-db mariadb -uroot --default-character-set=utf8mb4 "$@"; }
  ```
- **Deploy sin terminal:** SQL en phpMyAdmin, archivos con el Administrador de archivos, Restart en Setup Node.js App. **No se agregan dependencias de npm.** Todo SQL nuevo se puede pegar tal cual en phpMyAdmin (sin `DELIMITER` ni `USE`) y se puede volver a correr si se cortó a mitad.
- **Frontend:** vanilla JS; todo dato pasa por `Utils.escapeHtml`. `auth.js` cambia, así que **todas** las páginas pasan a cargar `auth.js`, `main.js` y `api.js` con `?v=20261022` (y `VERSION` de `tests/paginas.test.js` también); `usuarios.js`, `perfil.js` y `correos.js` también pasan a `?v=20261022`.
- **Textos exactos** (copiados de la spec; las llaves son datos):
  - 403 al auditar (8.2): `Este cambio lo auditan {nombres}. Podés auditarlo solo si ninguno está disponible.` (`{nombres}`: `A`, `A y B`, `A, B y C`, del nombre a la Z).
  - Historial (8.2): `Aprobado por {nombre} (respaldo)` (y `Rechazado por {nombre} (respaldo)`, Decisiones 15).
  - Recordatorio (9.2): asunto `[RPAD] 1 cambio espera tu auditoría` o `[RPAD] {n} cambios esperan tu auditoría` (Decisiones 7); respaldo `Te llega como respaldo: no hay auditores disponibles.`
  - Asunto con cambios nuevos (10.2): `Nota Digital N° {n}/{aa} – Ref.: Solicitud de auditoría de cambios en el Registro Permanente de Actualización de Datasets`.
  - Asunto solo con reiterados (10.2): `Nota Digital N° {n}/{aa} – Ref.: Reiteración – Solicitud de auditoría de cambios en el Registro Permanente de Actualización de Datasets`.
  - Destinatario (10.3): `DIRECCIÓN GENERAL DE MODERNIZACIÓN E INVESTIGACIÓN TERRITORIAL`; remitente `DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN, {fecha larga}.`
  - Párrafo inicial (10.3): `Me dirijo a Ud. a fin de solicitarle la auditoría de los cambios propuestos en el Registro Permanente de Actualización de Datasets (RPAD) que se detallan a continuación, que se encuentran pendientes de verificación. Conforme al procedimiento de doble verificación, cada modificación del registro debe ser revisada y aprobada por una persona distinta de quien la propuso antes de aplicarse.`
  - Secciones (10.3): `Cambios pendientes de auditoría` y `Cambios ya solicitados que continúan pendientes`; columnas `Conjunto de datos`, `Tipo de cambio` (`Alta`, `Modificación`, `Baja`), `Propuesto por`, `Fecha de la propuesta`, `Días hábiles pendiente` y, en los reiterados, `Solicitado en` (`Nota Digital N° 12/26 (dd/mm/aaaa)` y, si corresponde, ` – reiterado N veces`).
  - Qué implica la auditoría (10.3): `La auditoría consiste en verificar que:`; ítems `los datos coincidan con la información remitida por el área responsable;`, `el enlace al Portal de Datos Abiertos funcione y muestre la versión informada;`, `las fechas de última y próxima actualización sean coherentes con la frecuencia del conjunto de datos;`, `el título, la descripción, el área, los temas, los formatos y "qué se solicita" sean correctos.`; cierre `Cada cambio se aprueba o se rechaza, con un comentario, desde el RPAD: {APP_URL}/perfil.html (sección "Para revisar").` (`{APP_URL}` = `RPAD_URL` de `services/emailTemplates.js`).
  - Importancia (10.3): `Mientras un cambio no se audita, el conjunto de datos permanece bloqueado para nuevas modificaciones y el registro no refleja su estado real, lo que afecta los avisos y reiteraciones que emite esta Dirección y el cumplimiento de la Ordenanza N° 17.662/23. Por ello, solicito tenga a bien realizar la auditoría a la brevedad.`
  - Header: `Editor`.
  - Panel (Decisiones 10 y 11): `Un editor solo puede crear y modificar usuarios lectores.`, `Un editor no puede cambiar roles.`, `Es el firmante titular de las Notas Digitales: primero hay que elegir a otra persona en Correos.`
- **Commits:** mensajes en español con el estilo del repo (`feat:`, `fix:`, `test:`, `docs:`), terminados con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Cada `git add` nombra archivos concretos: nunca `git add -A` ni `git add .`.

## Review Focus

1. **Hora de la base contra hora argentina.** La regla de "una hora" y la fecha de la propuesta no dependen de la zona horaria de la base (Docker está en UTC; producción puede estarlo): un cambio de hace 61 minutos según el reloj de la base entra en el recordatorio y uno de 59 no; uno del 16/10 a las 22:30 de Argentina es del 16/10. → tests en la Task 3 (`tests/auditoria-datos.test.js`) y en la Task 6 (`tests/avisos-diarios.test.js`).
2. **Un solo canal para el recordatorio y la nota.** `canalDelCambio` decide en los dos procesos: un cambio en el canal nota no recibe recordatorio, uno en el canal recordatorio nunca va en una nota, y los cinco ejemplos de 9.4 dan lo que dice la spec. → tests en la Task 2 (`tests/auditoria-reglas.test.js`), Task 6 y Task 8 (`tests/notas-auditoria.test.js`).
3. **El editor no gana más de lo que dice la tabla 8.1.** No crea admins ni editores, no modifica admins, editores ni al superadmin, no cambia roles (tampoco el suyo) y no puede ser firmante titular; pasar a un admin a editor cuenta como quitar un auditor; el firmante titular no puede pasar a editor. → tests en la Task 4 (`tests/editor-panel.test.js`).
4. **Regla de respaldo al aprobar y al rechazar, evaluada con la fecha de hoy.** Un editor recibe 403 con los nombres mientras haya un auditor disponible que no propuso el cambio; sin ninguno, audita y queda `revisado_como_respaldo = 1`; un auditor siempre puede (Decisiones 1). → tests en la Task 5 (`tests/auditoria-api.test.js`).
5. **Una sola nota de auditoría por día, con la numeración del libro, y nada sale cuando no hay quién firme o la nota de autorización falló.** Reiteración a los 5 días hábiles citando la primera nota; si el envío falla se reintenta la misma; las pruebas no registran cambios. → tests en la Task 8 y la Task 9 (`tests/notas-auditoria.test.js`).

## Cada uso de un rol en el código: acceso o auditoría (spec 8.1)

"Acceso" = área de administración (`esAdmin`, `Auth.isAdmin()`: superadmin, admin y editor). "Auditoría" = aprobar y rechazar cambios de otros y el mínimo (`esAuditor`, `Auth.isAuditor()`: superadmin o admin).

| Uso | Archivo | Decisión | Tarea |
|---|---|---|---|
| `adminOnly` (`esAdmin`) | `middleware/auth.js` | Acceso: incluye al editor (`esAdmin` cambia) | 4 |
| `esAprobadorActivo` y `violaMinimoAprobadores` | `services/usuariosReglas.js` | Auditoría: `esAuditor` (pasar a editor quita un auditor) | 4 |
| `resumen.aprobadores_activos` | `controllers/usuariosController.js` | Auditoría (vía `esAprobadorActivo`) | 4 |
| Aviso de alta `datos.rol === 'admin'` | `controllers/usuariosController.js` | Acceso: `esAdmin(datos.rol)` (cubre editores, 8.1) | 4 |
| Aviso de email `esAdmin(despues.rol)` y de reactivación `esAdmin(reactivado.rol)` | `controllers/usuariosController.js` | Acceso: con `esAdmin` nuevo cubren editores (8.1) | 4 |
| `rol === 'superadmin'` (cuenta protegida) | `controllers/usuariosController.js` | Sin cambios | — |
| Lo que el editor no puede en el panel | `controllers/usuariosController.js` | Nuevo: `rechazoParaEditor` | 4 |
| Roles del script `['superadmin','admin','lector']` | `scripts/setup-admin.js` | Suma `editor` | 4 |
| `actor.rol === 'superadmin'`, `rol = 'superadmin'` | `services/avisosSuperadminService.js` | Sin cambios | — |
| `ROLES_CON_LICENCIA` (`superadmin`, `admin`, `editor`) | `services/licenciasReglas.js` | Sin cambios (ya incluía al editor) | — |
| `ROLES_AUTORIZABLES` (`admin`, `editor`) y autorizables `rol IN ('admin','editor')` | `services/notasDigitalesFirmas.js`, `controllers/licenciasController.js` | Sin cambios (el editor puede ser autorizado, 6.3) | — |
| Firmantes `rol IN ('superadmin','admin')` y `req.user?.rol !== 'superadmin'` | `controllers/notasDigitalesController.js` | Sin cambios (el editor no es firmante titular) | — |
| Destinatarios del email de cambios pendientes `rol IN ('admin','superadmin')` | `services/avisosDiariosService.js` | Auditoría: reemplazado por el recordatorio (`quienesAuditan`) | 6 |
| Aprobar y rechazar (solo "no el propio") | `controllers/cambiosPendientesController.js` | Auditoría: `permisoParaAuditar` (8.2) | 5 |
| `Auth.isAdmin()` | `public/js/auth.js` | Acceso: incluye al editor; se agrega `Auth.isAuditor()` | 10 |
| `Auth.getRoleText()` | `public/js/auth.js` | Suma `Editor` | 10 |
| `Auth.isAdmin()` en `admin.js`, `areas.js`, `correos.js`, `gestion.js`, `main.js`, `perfil.js`, `usuarios.js` | `public/js/*` | Acceso: sin cambios (el editor entra) | — |
| `Auth.isSuperadmin()` (firmante titular) | `public/js/correos.js` | Sin cambios | — |
| `esAprobador` (`admin` o `superadmin`) | `public/js/usuarios.js` | Auditoría: sin cambios; los editores van a su grupo | 10 |
| Selector de rol, confirmaciones, `rol === 'lector'` | `public/js/usuarios.js` | Suma `editor`; el editor no cambia roles | 10 |
| Aprobar y rechazar en Para revisar | `public/js/perfil.js` | Auditoría: el servidor dice si puede (`auditoria.puede`) | 10 |

---

## Mapa de archivos

| Archivo | Tarea | Responsabilidad |
|---|---|---|
| `database/updates/migracion-editor-auditoria.sql` (nuevo) | 1 | Estructura nueva, aditiva e idempotente |
| `database/updates/rollback-editor-auditoria.sql` (nuevo) | 1 | Deshacer la migración (los editores pasan a admin) |
| `database/schema.sql`, `tests/schema.test.js` | 1 | Misma estructura para instalaciones nuevas; rollback con y sin editores |
| `services/notasDigitalesCalendario.js` | 2 | `diasHabilesTranscurridos`, `sumarDiasHabiles` |
| `services/usuariosReglas.js` | 2, 4 | `esAuditor`; editor en `esAdmin`, `ROLES_ASIGNABLES`, `TEXTO_ROL`; `rechazoParaEditor` |
| `services/auditoriaReglas.js` (nuevo) | 2 | Reglas puras: quién audita, permiso, canal, sección |
| `services/auditoriaService.js` (nuevo) | 3 | Disponibilidad, canal de cada cambio, cambios de la nota de hoy, catálogos |
| `controllers/usuariosController.js`, `scripts/setup-admin.js` | 4 | Editor en el panel, firmante titular, avisos |
| `controllers/cambiosPendientesController.js` | 5 | Regla de respaldo al aprobar y rechazar; permiso en el detalle |
| `services/avisosDiariosService.js`, `services/emailTemplates.js` | 6 | Recordatorio de las 14:00 |
| `services/notasDigitalesContenido.js`, `services/notasDigitalesPdf.js` | 7 | Estructura, HTML, texto y PDF de la nota de auditoría |
| `services/notasDigitales.js` | 8, 9 | Nota de auditoría en la corrida; vista previa, prueba y Estado |
| `controllers/notasDigitalesController.js` | 9 | `tipo=auditoria`, libro, detalle y configuración |
| `public/js/auth.js`, `public/usuarios.html`, `public/js/usuarios.js`, `public/js/perfil.js`, 14 páginas `.html` | 10 | Editor en el frontend; versión de los scripts |
| `public/correos.html`, `public/js/correos.js` | 11 | Nota de auditoría en Correos |
| `CLAUDE.md`, `README.md` | 12 | Documentación y despliegue |

---

## Task 0: Preparación y línea de base

**Files:** ninguno versionado.

- [ ] **Step 1: Verificar la rama** (ya creada desde `main` en d2162d0, con este plan commiteado)

```bash
git switch feat/editor-auditoria && git merge-base --is-ancestor d2162d0 HEAD && echo "base OK" && git status --short
```

Expected: `base OK` y ningún archivo modificado. Si `merge-base` falla, **parar**: la rama no sale de `main` con las entregas 1 y 2.

- [ ] **Step 2: Verificar el entorno**

```bash
grep -E '^(SMTP_HOST|SMTP_PORT|RPAD_TESTS_DB_LOCAL|DB_HOST)=' .env
docker compose up -d && docker inspect -f '{{.State.Health.Status}}' rpad-db && curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8025/api/v1/info
```

Expected: `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`, `RPAD_TESTS_DB_LOCAL=1`, `DB_HOST=127.0.0.1`, `healthy` y `200`.

- [ ] **Step 3: Línea de base**

```bash
mkdir -p .claude && npm test 2>&1 | tee .claude/linea-de-base-editor.txt | tail -15
```

Expected: `ℹ tests 818`, `ℹ pass 817`, `ℹ fail 0`, `ℹ skipped 1` (la de `main`). Si `ℹ fail` es mayor que 0, listar las fallas (`grep -n '✖' .claude/linea-de-base-editor.txt | head -40`) y avisar antes de seguir.

Sin commit.

---

## Task 1: Migración, rollback y `schema.sql`

**Files:**
- Create: `database/updates/migracion-editor-auditoria.sql`
- Create: `database/updates/rollback-editor-auditoria.sql`
- Modify: `database/schema.sql`
- Modify: `tests/schema.test.js`

**Interfaces:**
- Produces:
  - `usuarios.rol` admite `editor`;
  - columnas `cambios_pendientes.primer_recordatorio_at` (DATETIME NULL) y `cambios_pendientes.revisado_como_respaldo` (TINYINT(1) NOT NULL DEFAULT 0);
  - `notas_digitales.tipo` admite `auditoria`;
  - tabla `notas_digitales_cambios (nota_id, cambio_id, seccion ENUM('nuevo','reiterado'))`, PK `(nota_id, cambio_id)`, índice `(cambio_id)`, las dos FK con `ON DELETE CASCADE`;
  - columnas `notas_digitales_config.para_auditoria` (VARCHAR(500) NOT NULL DEFAULT `'mit@comodoro.gov.ar'`) y `notas_digitales_config.cc_auditoria` (VARCHAR(500) NULL), después de `casillas_prueba`.

- [ ] **Step 1: Tests que fallan** en `tests/schema.test.js`.

(a) En el test `usuarios admite el rol superadmin, contraseña nula, …`, reemplazar la línea

```js
      "usuarios.rol enum('superadmin','admin','lector') null=NO default='lector' key=",
```

por

```js
      "usuarios.rol enum('superadmin','admin','editor','lector') null=NO default='lector' key=",
```

(b) En el test `licencias y firmas por usuario (…, 11.1)`, reemplazar

```js
    assert.ok(lista.some(c => c.startsWith("notas_digitales.tipo enum('aviso','reiteracion','autorizacion') null=NO")),
```

por (la entrega 3 suma `'auditoria'` al final del ENUM; lo que fija este test, que existe `'autorizacion'`, sigue igual)

```js
    assert.ok(lista.some(c => c.startsWith("notas_digitales.tipo enum('aviso','reiteracion','autorizacion'")),
```

(c) Agregar, dentro de `describe('database/schema.sql', …)`, después del test de licencias y firmas:

```js
  it('editor y auditoría de cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 11.2)', async () => {
    const lista = await columnas(root, BASE_TEMPORAL);
    for (const esperada of [
      "usuarios.rol enum('superadmin','admin','editor','lector') null=NO default='lector' key=",
      'cambios_pendientes.primer_recordatorio_at datetime null=YES default=NULL key=',
      'cambios_pendientes.revisado_como_respaldo tinyint(1) null=NO default=0 key=',
      'notas_digitales_cambios.nota_id int(11) null=NO default=null key=PRI',
      'notas_digitales_cambios.cambio_id int(11) null=NO default=null key=PRI',
      "notas_digitales_cambios.seccion enum('nuevo','reiterado') null=NO default=null key=",
      "notas_digitales_config.para_auditoria varchar(500) null=NO default='mit@comodoro.gov.ar' key=",
      'notas_digitales_config.cc_auditoria varchar(500) null=YES default=NULL key='
    ]) {
      assert.ok(lista.includes(esperada), `falta: ${esperada}\n${lista.filter(c => c.startsWith(esperada.split('.')[0])).join('\n')}`);
    }
    assert.ok(lista.some(c => c.startsWith("notas_digitales.tipo enum('aviso','reiteracion','autorizacion','auditoria') null=NO")),
      lista.filter(c => c.startsWith('notas_digitales.tipo')).join('\n'));
  });
```

(d) Agregar `'notas_digitales_cambios'` al final del arreglo del test `no trae datos en ${tabla}`.

(e) Agregar al final del archivo (después del `describe('database/schema.sql', …)`):

```js
// Rollback de la entrega 3 (spec 2026-10-15-dias-habiles-licencias-auditoria, 11.2 y 14), sobre una base descartable creada
// con schema.sql: con editores, sin editores, repetido, y la migración vuelve a dejar la estructura de schema.sql
describe('rollback y migración de la entrega 3 (editor y auditoría)', () => {
  const BASE_ROLLBACK = 'rpad_schema_rollback_test';
  const sql = (archivo) => fs.readFileSync(new URL(`../database/updates/${archivo}`, import.meta.url), 'utf8');
  const crearDesdeSchema = async () => {
    await root.query(`DROP DATABASE IF EXISTS \`${BASE_ROLLBACK}\``);
    await root.query(`CREATE DATABASE \`${BASE_ROLLBACK}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`USE \`${BASE_ROLLBACK}\``);
    await root.query(fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
  };
  const crearUsuario = (username, rol) => root.query(
    `INSERT INTO \`${BASE_ROLLBACK}\`.usuarios (username, password_hash, nombre_completo, email, rol) VALUES (?, 'x', ?, ?, ?)`,
    [username, username, `${username}@rpad.test`, rol]
  );

  after(async () => {
    await root?.query(`DROP DATABASE IF EXISTS \`${BASE_ROLLBACK}\``);
  });

  it('con editores: los pasa a admin, el rol vuelve a tres valores y notas_digitales.tipo queda ampliado', async () => {
    await crearDesdeSchema();
    await crearUsuario('t_editor', 'editor');
    await crearUsuario('t_admin', 'admin');
    await crearUsuario('t_lector', 'lector');
    await root.query(sql('rollback-editor-auditoria.sql'));
    const lista = await columnas(root, BASE_ROLLBACK);
    assert.ok(lista.includes("usuarios.rol enum('superadmin','admin','lector') null=NO default='lector' key="),
      lista.filter(c => c.startsWith('usuarios.rol')).join('\n'));
    const [filas] = await root.query(`SELECT username, rol FROM \`${BASE_ROLLBACK}\`.usuarios ORDER BY username`);
    assert.deepEqual(filas.map(f => [f.username, f.rol]), [['t_admin', 'admin'], ['t_editor', 'admin'], ['t_lector', 'lector']]);
    for (const quitada of ['cambios_pendientes.primer_recordatorio_at ', 'cambios_pendientes.revisado_como_respaldo ',
      'notas_digitales_config.para_auditoria ', 'notas_digitales_config.cc_auditoria ', 'notas_digitales_cambios.']) {
      assert.ok(!lista.some(c => c.startsWith(quitada)), `quedó: ${quitada}`);
    }
    assert.ok(lista.some(c => c.startsWith("notas_digitales.tipo enum('aviso','reiteracion','autorizacion','auditoria') null=NO")),
      lista.filter(c => c.startsWith('notas_digitales.tipo')).join('\n'));
  });

  it('sin editores: se puede repetir, y la migración (dos veces) vuelve a dejar exactamente la estructura de schema.sql', async () => {
    await crearDesdeSchema();
    const original = await columnas(root, BASE_ROLLBACK);
    await root.query(sql('rollback-editor-auditoria.sql'));
    await root.query(sql('rollback-editor-auditoria.sql'));
    await root.query(sql('migracion-editor-auditoria.sql'));
    await root.query(sql('migracion-editor-auditoria.sql'));
    assert.deepEqual(await columnas(root, BASE_ROLLBACK), original);
  });
});
```

(El `after` de este `describe` corre antes que el `after` del archivo, que cierra `root`.)

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/schema.test.js`
Expected: FAIL en `usuarios admite el rol superadmin…`, `editor y auditoría…`, `no trae datos en notas_digitales_cambios` y los dos de rollback (`ENOENT` de los archivos SQL).

- [ ] **Step 3: Migración** `database/updates/migracion-editor-auditoria.sql`:

```sql
-- =====================================================
-- RPAD - Rol editor y auditoría de cambios pendientes
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-15-dias-habiles-licencias-auditoria-design.md (sección 11.2)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura.
-- ORDEN: correr ANTES de subir el código nuevo (phpMyAdmin > base del RPAD > pestaña SQL, pegar y Continuar).
-- Después de subir el código y reiniciar, el superadmin pasa a editor a quien corresponda desde el panel de usuarios
-- (no hace falta SQL privado) y revisa en Correos los destinatarios de las notas de auditoría.
-- Se puede volver a correr si se cortó a mitad: lo que ya existe se saltea.
-- Para deshacer: rollback-editor-auditoria.sql
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `usuarios`
  MODIFY COLUMN `rol` enum('superadmin','admin','editor','lector') NOT NULL DEFAULT 'lector';

ALTER TABLE `cambios_pendientes`
  ADD COLUMN IF NOT EXISTS `primer_recordatorio_at` datetime DEFAULT NULL AFTER `revisado_at`,
  ADD COLUMN IF NOT EXISTS `revisado_como_respaldo` tinyint(1) NOT NULL DEFAULT 0 AFTER `primer_recordatorio_at`;

ALTER TABLE `notas_digitales`
  MODIFY COLUMN `tipo` enum('aviso','reiteracion','autorizacion','auditoria') NOT NULL;

CREATE TABLE IF NOT EXISTS `notas_digitales_cambios` (
  `nota_id` int(11) NOT NULL,
  `cambio_id` int(11) NOT NULL,
  `seccion` enum('nuevo','reiterado') NOT NULL,
  PRIMARY KEY (`nota_id`,`cambio_id`),
  KEY `idx_ndc_cambio` (`cambio_id`),
  CONSTRAINT `fk_ndc_nota` FOREIGN KEY (`nota_id`) REFERENCES `notas_digitales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ndc_cambio` FOREIGN KEY (`cambio_id`) REFERENCES `cambios_pendientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `notas_digitales_config`
  ADD COLUMN IF NOT EXISTS `para_auditoria` varchar(500) NOT NULL DEFAULT 'mit@comodoro.gov.ar' AFTER `casillas_prueba`,
  ADD COLUMN IF NOT EXISTS `cc_auditoria` varchar(500) DEFAULT NULL AFTER `para_auditoria`;
```

- [ ] **Step 4: Rollback** `database/updates/rollback-editor-auditoria.sql`:

```sql
-- =====================================================
-- RPAD - Deshace migracion-editor-auditoria.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Los editores pasan a admin: la versión anterior no conoce el rol editor (vuelven a aprobar cambios como cualquier admin).
-- Se pierden la fecha del primer recordatorio de cada cambio, la marca de aprobación "de respaldo", qué cambios incluyó
-- cada nota de auditoría y los destinatarios de auditoría de Correos.
-- notas_digitales.tipo (con 'auditoria') queda ampliado a propósito: las notas de auditoría son notas numeradas del libro
-- y no se borran. El código anterior no falla con ellas, pero su libro las muestra con el tipo vacío ("undefined").
-- =====================================================

SET NAMES utf8mb4;

UPDATE `usuarios` SET `rol` = 'admin' WHERE `rol` = 'editor';

ALTER TABLE `usuarios`
  MODIFY COLUMN `rol` enum('superadmin','admin','lector') NOT NULL DEFAULT 'lector';

DROP TABLE IF EXISTS `notas_digitales_cambios`;

ALTER TABLE `notas_digitales_config`
  DROP COLUMN IF EXISTS `cc_auditoria`,
  DROP COLUMN IF EXISTS `para_auditoria`;

ALTER TABLE `cambios_pendientes`
  DROP COLUMN IF EXISTS `revisado_como_respaldo`,
  DROP COLUMN IF EXISTS `primer_recordatorio_at`;
```

- [ ] **Step 5: `database/schema.sql`**, con exactamente la estructura que deja la migración:

(a) En `usuarios`, reemplazar `` `rol` enum('superadmin','admin','lector') NOT NULL DEFAULT 'lector', `` por

```sql
  `rol` enum('superadmin','admin','editor','lector') NOT NULL DEFAULT 'lector',
```

(b) En `cambios_pendientes`, después de `` `revisado_at` timestamp NULL DEFAULT NULL, ``:

```sql
  `primer_recordatorio_at` datetime DEFAULT NULL,
  `revisado_como_respaldo` tinyint(1) NOT NULL DEFAULT 0,
```

(c) En `notas_digitales`, reemplazar `` `tipo` enum('aviso','reiteracion','autorizacion') NOT NULL, `` por

```sql
  `tipo` enum('aviso','reiteracion','autorizacion','auditoria') NOT NULL,
```

(d) En `notas_digitales_config`, después de `` `casillas_prueba` varchar(500) NOT NULL DEFAULT '', ``:

```sql
  `para_auditoria` varchar(500) NOT NULL DEFAULT 'mit@comodoro.gov.ar',
  `cc_auditoria` varchar(500) DEFAULT NULL,
```

(e) Al final del archivo, el `CREATE TABLE` del Step 3 **idéntico pero sin `IF NOT EXISTS`**, con este encabezado:

```sql

-- =====================================================
-- Auditoría de cambios pendientes (database/updates/migracion-editor-auditoria.sql)
-- =====================================================
```

- [ ] **Step 6: Ensayo de la migración y el rollback en una base descartable** (desde el `schema.sql` de `main`, sin tocar la copia local):

```bash
RP=$(grep '^DB_ROOT_PASSWORD=' .env | cut -d= -f2)
mdb() { docker exec -i -e MYSQL_PWD="$RP" rpad-db mariadb -uroot --default-character-set=utf8mb4 "$@"; }
mdb -e "DROP DATABASE IF EXISTS rpad_ensayo_ea; CREATE DATABASE rpad_ensayo_ea CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
git show main:database/schema.sql | mdb rpad_ensayo_ea
COLS="SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='rpad_ensayo_ea' ORDER BY TABLE_NAME, ORDINAL_POSITION"
mdb -N -e "$COLS" > .claude/ensayo-ea-antes.txt
mdb rpad_ensayo_ea < database/updates/migracion-editor-auditoria.sql
mdb rpad_ensayo_ea < database/updates/migracion-editor-auditoria.sql && echo "segunda corrida OK"
mdb rpad_ensayo_ea < database/updates/rollback-editor-auditoria.sql
mdb -N -e "$COLS" > .claude/ensayo-ea-despues.txt
diff .claude/ensayo-ea-antes.txt .claude/ensayo-ea-despues.txt
mdb -e "DROP DATABASE rpad_ensayo_ea"
```

Expected: `segunda corrida OK`, y el `diff` muestra **solo** la línea de `notas_digitales` `tipo` (que el rollback deja ampliada a propósito). Cualquier otra diferencia es un error del rollback.

- [ ] **Step 7: Aplicar la migración a la base local** (copia de producción) y verificar que no cambia ningún dato

```bash
RP=$(grep '^DB_ROOT_PASSWORD=' .env | cut -d= -f2); DBN=$(grep '^DB_NAME=' .env | cut -d= -f2)
mdb() { docker exec -i -e MYSQL_PWD="$RP" rpad-db mariadb -uroot --default-character-set=utf8mb4 "$@"; }
CUENTA="SELECT (SELECT COUNT(*) FROM usuarios), (SELECT GROUP_CONCAT(CONCAT(id, ':', rol) ORDER BY id) FROM usuarios), (SELECT COUNT(*) FROM cambios_pendientes), (SELECT COUNT(*) FROM notas_digitales), (SELECT COUNT(*) FROM notas_digitales_datasets)"
mdb -N "$DBN" -e "$CUENTA" > .claude/local-ea-antes.txt
mdb "$DBN" < database/updates/migracion-editor-auditoria.sql
mdb -N "$DBN" -e "$CUENTA" > .claude/local-ea-despues.txt
diff .claude/local-ea-antes.txt .claude/local-ea-despues.txt && echo "sin cambios de datos"
mdb -N "$DBN" -e "SELECT para_auditoria, cc_auditoria, firmante_usuario_id FROM notas_digitales_config"
```

Expected: `sin cambios de datos` y `mit@comodoro.gov.ar	NULL	NULL` (la base local no tiene firmante titular).

- [ ] **Step 8: Correr el test de esquema**

Run: `node --test tests/schema.test.js`
Expected: PASS (la base local y `schema.sql` coinciden; los dos de rollback pasan).

- [ ] **Step 9: Suite completa y comparación con la línea de base**

Run: `npm test 2>&1 | tail -15`
Expected: `ℹ fail 0`; `ℹ pass` = 817 + 4 tests nuevos (`editor y auditoría…`, `no trae datos en notas_digitales_cambios` y los dos de rollback).

- [ ] **Step 10: Commit**

```bash
git add database/updates/migracion-editor-auditoria.sql database/updates/rollback-editor-auditoria.sql database/schema.sql tests/schema.test.js
git commit -m "feat: estructura del rol editor y de la auditoría de cambios pendientes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Días hábiles entre fechas y reglas de quién audita y por qué canal

**Files:**
- Modify: `services/notasDigitalesCalendario.js`
- Modify: `services/usuariosReglas.js` (solo agrega `esAuditor`)
- Create: `services/auditoriaReglas.js`
- Test: `tests/notas-calendario.test.js` (agregar), `tests/usuarios-reglas.test.js` (agregar), `tests/auditoria-reglas.test.js` (nuevo)

**Interfaces:**
- Produces:
  - `diasHabilesTranscurridos(desde, hasta) → number`: días hábiles `d` con `desde < d ≤ hasta` (0 si `hasta ≤ desde`).
  - `sumarDiasHabiles(iso, n) → 'AAAA-MM-DD'`: el n-ésimo día hábil después de `iso` (sin contarlo); con `n = 0`, `iso`.
  - `esAuditor(rol) → boolean`: `superadmin` o `admin`.
  - En `services/auditoriaReglas.js`: `ANTIGUEDAD_MINIMA_RECORDATORIO = 3600`, `DIAS_HABILES_PARA_REITERAR_AUDITORIA = 5`, `quienesAuditan(personas, proponenteId) → { personas, respaldo }`, `mensajeNoCorresponde(auditores) → string`, `permisoParaAuditar(usuario, proponenteId, personas) → { puede: true, respaldo } | { puede: false, mensaje }`, `canalDelCambio({ cambio, hoy, personas, titulares, hayQuienFirme }) → 'nota' | 'recordatorio'`, `entraEnRecordatorio(cambio) → boolean`, `seccionDeAuditoria(ultima, hoy) → 'nuevo' | 'reiterado' | null`. Una persona es `{ id, rol, nombre_completo, disponible, … }` (la arma `personasDeAuditoria` en la Task 3); un cambio, `{ usuario_id, primer_recordatorio_fecha, canal, antiguedad_segundos, … }`.

- [ ] **Step 1: Tests del calendario.** Agregar al final de `tests/notas-calendario.test.js`:

```js
describe('diasHabilesTranscurridos (spec 2026-10-15-dias-habiles-licencias-auditoria, 10.3)', () => {
  it('cuenta los días hábiles después de la primera fecha, hasta la segunda inclusive', () => {
    // viernes 16/10/2026 → lunes 19/10: el fin de semana no cuenta
    assert.equal(cal.diasHabilesTranscurridos('2026-10-16', '2026-10-19'), 1);
    assert.equal(cal.diasHabilesTranscurridos('2026-10-19', '2026-10-26'), 5);
    assert.equal(cal.diasHabilesTranscurridos('2026-10-17', '2026-10-19'), 1);
    assert.equal(cal.diasHabilesTranscurridos('2026-10-16', '2026-10-16'), 0);
    assert.equal(cal.diasHabilesTranscurridos('2026-10-19', '2026-10-16'), 0);
  });

  it('los feriados fijos no cuentan; los trasladables sí', () => {
    // lunes 07/12/2026 → lunes 14/12: el martes 08/12 es feriado
    assert.equal(cal.diasHabilesTranscurridos('2026-12-07', '2026-12-14'), 4);
    // jueves 24/12/2026 → jueves 31/12: el 25/12 es feriado y el 26 y el 27, fin de semana
    assert.equal(cal.diasHabilesTranscurridos('2026-12-24', '2026-12-31'), 4);
    // miércoles 07/10/2026 → lunes 19/10: el lunes 12/10 (trasladable) cuenta
    assert.equal(cal.diasHabilesTranscurridos('2026-10-07', '2026-10-19'), 8);
  });
});

describe('sumarDiasHabiles', () => {
  it('avanza n días hábiles, salteando fines de semana y feriados fijos', () => {
    assert.equal(cal.sumarDiasHabiles('2026-10-19', 5), '2026-10-26');
    assert.equal(cal.sumarDiasHabiles('2026-10-16', 1), '2026-10-19');
    assert.equal(cal.sumarDiasHabiles('2026-12-07', 5), '2026-12-15');
    // 24/03/2027 es feriado: del lunes 22/03 son 23, 25, 26, 29 y 30
    assert.equal(cal.sumarDiasHabiles('2027-03-22', 5), '2027-03-30');
    // 25/12, el fin de semana y el 01/01: del jueves 24/12/2026, el quinto es el lunes 04/01/2027
    assert.equal(cal.sumarDiasHabiles('2026-12-24', 5), '2027-01-04');
    assert.equal(cal.sumarDiasHabiles('2026-10-17', 0), '2026-10-17');
  });

  it('es la inversa de diasHabilesTranscurridos', () => {
    for (const desde of ['2026-10-16', '2026-12-07', '2026-12-24', '2027-03-22']) {
      for (const n of [1, 5, 12]) {
        assert.equal(cal.diasHabilesTranscurridos(desde, cal.sumarDiasHabiles(desde, n)), n, `${desde} + ${n}`);
      }
    }
  });
});
```

- [ ] **Step 2: Implementar** al final de `services/notasDigitalesCalendario.js`:

```js
// Días hábiles después de desde y hasta hasta inclusive (desde no se cuenta): la columna "días hábiles pendiente" de la
// nota de auditoría y el plazo de sus reiteraciones (spec 2026-10-15-dias-habiles-licencias-auditoria, 9.3 y 10.3).
// 0 si hasta no es posterior a desde.
export const diasHabilesTranscurridos = (desde, hasta) => {
  let cantidad = 0;
  for (let fecha = sumarDias(desde, 1); fecha <= hasta; fecha = sumarDias(fecha, 1)) {
    if (esDiaHabil(fecha)) cantidad++;
  }
  return cantidad;
};

// El n-ésimo día hábil después de iso, sin contarlo (iso si n es 0): la próxima reiteración de una nota de auditoría
export const sumarDiasHabiles = (iso, n) => {
  let fecha = iso;
  for (let i = 0; i < n; i++) fecha = proximoDiaHabil(sumarDias(fecha, 1));
  return fecha;
};
```

- [ ] **Step 3: `esAuditor`.** En `tests/usuarios-reglas.test.js`, sumar `esAuditor` a la lista del `import` (después de `esAdmin`) y agregar dentro de `describe('roles', …)`:

```js
  it('auditores: superadmin y admin (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.1)', () => {
    assert.equal(esAuditor('superadmin'), true);
    assert.equal(esAuditor('admin'), true);
    assert.equal(esAuditor('editor'), false);
    assert.equal(esAuditor('lector'), false);
    assert.equal(esAuditor(undefined), false);
  });
```

En `services/usuariosReglas.js`, después de `esAdmin`, agregar:

```js
// Auditor: aprueba y rechaza cambios de otros y cuenta para el mínimo de aprobadores
// (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.1). El editor no lo es: audita solo de respaldo.
export const esAuditor = (rol) => rol === 'admin' || rol === 'superadmin';
```

- [ ] **Step 4: Tests de las reglas de auditoría.** Crear `tests/auditoria-reglas.test.js`:

```js
// Reglas de la auditoría de cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.2, 9.1, 9.3 y 9.4):
// funciones puras, con los ejemplos de la spec 9.4
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  quienesAuditan, permisoParaAuditar, mensajeNoCorresponde, canalDelCambio, entraEnRecordatorio, seccionDeAuditoria,
  ANTIGUEDAD_MINIMA_RECORDATORIO
} from '../services/auditoriaReglas.js';

// El firmante titular (1), otro auditor (2) y dos editores (3 y 4), todos disponibles salvo que se diga otra cosa
const persona = (id, rol, nombre) => ({ id, rol, nombre_completo: nombre, disponible: true });
const EQUIPO = [
  persona(1, 'superadmin', 'Persona Titular'), persona(2, 'admin', 'Persona Auditora'),
  persona(3, 'editor', 'Persona Editora'), persona(4, 'editor', 'Otra Editora')
];
// cambios: { id: { disponible: false } }
const equipo = (cambios = {}) => EQUIPO.map(p => ({ ...p, ...(cambios[p.id] ?? {}) }));
const ids = (lista) => lista.map(p => p.id);

describe('quién audita un cambio (spec 8.2)', () => {
  it('los auditores disponibles que no lo propusieron', () => {
    assert.deepEqual(ids(quienesAuditan(equipo(), 1).personas), [2]);
    assert.equal(quienesAuditan(equipo(), 1).respaldo, false);
    assert.deepEqual(ids(quienesAuditan(equipo(), 3).personas), [1, 2]);
  });

  it('sin auditores disponibles, los editores disponibles que no lo propusieron, de respaldo', () => {
    // Propone el titular y el otro auditor no está disponible
    assert.deepEqual(quienesAuditan(equipo({ 2: { disponible: false } }), 1), { personas: [EQUIPO[2], EQUIPO[3]], respaldo: true });
    // Propone un editor y ninguno de los dos auditores está disponible
    const sinAuditores = equipo({ 1: { disponible: false }, 2: { disponible: false } });
    assert.deepEqual(quienesAuditan(sinAuditores, 3), { personas: [EQUIPO[3]], respaldo: true });
  });

  it('sin nadie disponible: respaldo, sin personas', () => {
    const nadie = equipo({ 1: { disponible: false }, 2: { disponible: false }, 3: { disponible: false }, 4: { disponible: false } });
    assert.deepEqual(quienesAuditan(nadie, 1), { personas: [], respaldo: true });
  });
});

describe('permiso para aprobar o rechazar (spec 8.2, Decisiones del plan 1 y 2)', () => {
  const MENSAJE = 'Este cambio lo auditan Persona Auditora. Podés auditarlo solo si ninguno está disponible.';

  it('un auditor siempre puede, también si ese día está de licencia', () => {
    assert.deepEqual(permisoParaAuditar({ id: 2, rol: 'admin' }, 1, equipo()), { puede: true, respaldo: false });
    assert.deepEqual(permisoParaAuditar({ id: 2, rol: 'admin' }, 1, equipo({ 2: { disponible: false } })), { puede: true, respaldo: false });
    assert.deepEqual(permisoParaAuditar({ id: 1, rol: 'superadmin' }, 3, equipo()), { puede: true, respaldo: false });
  });

  it('un editor, solo de respaldo: con un auditor disponible recibe el mensaje con su nombre', () => {
    assert.deepEqual(permisoParaAuditar({ id: 3, rol: 'editor' }, 1, equipo()), { puede: false, mensaje: MENSAJE });
    assert.deepEqual(permisoParaAuditar({ id: 3, rol: 'editor' }, 1, equipo({ 2: { disponible: false } })), { puede: true, respaldo: true });
    // El editor de respaldo puede aunque él mismo esté de licencia
    assert.deepEqual(permisoParaAuditar({ id: 3, rol: 'editor' }, 1, equipo({ 2: { disponible: false }, 3: { disponible: false } })),
      { puede: true, respaldo: true });
  });

  it('el mensaje nombra a todos los auditores disponibles', () => {
    assert.equal(mensajeNoCorresponde([EQUIPO[0], EQUIPO[1]]),
      'Este cambio lo auditan Persona Titular y Persona Auditora. Podés auditarlo solo si ninguno está disponible.');
    assert.equal(mensajeNoCorresponde([EQUIPO[0], EQUIPO[1], persona(5, 'admin', 'Tercera Persona')]),
      'Este cambio lo auditan Persona Titular, Persona Auditora y Tercera Persona. Podés auditarlo solo si ninguno está disponible.');
  });

  it('un lector nunca', () => {
    assert.equal(permisoParaAuditar({ id: 9, rol: 'lector' }, 1, equipo()).puede, false);
  });
});

describe('canal de cada cambio (spec 9.1, ejemplos 9.4)', () => {
  const contexto = (cambios = {}, { titulares = [1], hayQuienFirme = true } = {}) => ({ personas: equipo(cambios), titulares, hayQuienFirme });
  const canal = (proponente, primer, hoy, ctx = contexto()) =>
    canalDelCambio({ cambio: { usuario_id: proponente, primer_recordatorio_fecha: primer }, hoy, ...ctx });

  it('propone el titular el viernes y hay otro auditor: el viernes, recordatorio; desde el lunes, nota', () => {
    assert.equal(canal(1, null, '2026-10-16'), 'recordatorio');
    assert.equal(canal(1, '2026-10-16', '2026-10-16'), 'recordatorio');
    assert.equal(canal(1, '2026-10-16', '2026-10-19'), 'nota');
  });

  it('propone un editor y el titular está disponible: siempre recordatorio', () => {
    assert.equal(canal(3, '2026-10-16', '2026-10-19'), 'recordatorio');
    assert.equal(canal(3, '2026-10-16', '2026-11-30'), 'recordatorio');
  });

  it('el titular de licencia con autorizado, propone un editor: nota desde el día hábil siguiente al primer recordatorio', () => {
    const deLicencia = contexto({ 1: { disponible: false } });
    assert.equal(canal(3, null, '2026-10-19', deLicencia), 'recordatorio');
    assert.equal(canal(3, '2026-10-19', '2026-10-20', deLicencia), 'nota');
  });

  it('propone el titular y el único otro auditor está de licencia: respaldo, recordatorio', () => {
    assert.equal(canal(1, '2026-10-16', '2026-10-19', contexto({ 2: { disponible: false } })), 'recordatorio');
  });

  it('el titular de licencia sin autorizado: recordatorio; a la vuelta, lo que cumple las condiciones va a nota', () => {
    assert.equal(canal(1, '2026-10-16', '2026-10-19', contexto({ 1: { disponible: false } }, { hayQuienFirme: false })), 'recordatorio');
    assert.equal(canal(1, '2026-10-16', '2026-10-26'), 'nota');
  });

  it('sin firmante titular, la condición 2 mira a los superadmins; sin ninguno, se cumple siempre', () => {
    assert.equal(canal(3, '2026-10-16', '2026-10-19', contexto({}, { titulares: [1] })), 'recordatorio');
    assert.equal(canal(3, '2026-10-16', '2026-10-19', contexto({}, { titulares: [] })), 'nota');
  });
});

describe('recordatorio y sección de la nota (spec 9.2 y 9.3)', () => {
  it('el recordatorio lleva lo del canal recordatorio propuesto hace una hora o más', () => {
    assert.equal(ANTIGUEDAD_MINIMA_RECORDATORIO, 3600);
    assert.equal(entraEnRecordatorio({ canal: 'recordatorio', antiguedad_segundos: 3600 }), true);
    assert.equal(entraEnRecordatorio({ canal: 'recordatorio', antiguedad_segundos: 3599 }), false);
    assert.equal(entraEnRecordatorio({ canal: 'nota', antiguedad_segundos: 999999 }), false);
  });

  it('nuevo si nunca estuvo en una nota; reiterado a los 5 días hábiles de la última; si no, nada', () => {
    assert.equal(seccionDeAuditoria(null, '2026-10-19'), 'nuevo');
    assert.equal(seccionDeAuditoria('2026-10-19', '2026-10-23'), null);
    assert.equal(seccionDeAuditoria('2026-10-19', '2026-10-26'), 'reiterado');
    // el martes 08/12 es feriado: del lunes 07/12, el 14/12 son 4 días hábiles y el 15/12, 5
    assert.equal(seccionDeAuditoria('2026-12-07', '2026-12-14'), null);
    assert.equal(seccionDeAuditoria('2026-12-07', '2026-12-15'), 'reiterado');
  });
});
```

- [ ] **Step 5: Correr y ver que fallan**

Run: `node --test tests/notas-calendario.test.js tests/usuarios-reglas.test.js tests/auditoria-reglas.test.js`
Expected: FAIL (`cal.diasHabilesTranscurridos is not a function` si todavía no se hizo el Step 2; `Cannot find module '../services/auditoriaReglas.js'`).

- [ ] **Step 6: Implementar** `services/auditoriaReglas.js`:

```js
// Quién audita cada cambio pendiente y por qué canal se le pide (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.2,
// 9.1 y 9.3): funciones puras, sin base de datos. Las personas, con su disponibilidad del día (activa, con contraseña y
// sin licencia), las lee auditoriaService.personasDeAuditoria.
import { esAuditor } from './usuariosReglas.js';
import { diasHabilesTranscurridos } from './notasDigitalesCalendario.js';

// El recordatorio incluye los cambios propuestos hace una hora o más (spec 9.2), en segundos
export const ANTIGUEDAD_MINIMA_RECORDATORIO = 3600;
// La nota de auditoría se reitera a los 5 días hábiles de la última que incluyó el cambio (spec 9.3)
export const DIAS_HABILES_PARA_REITERAR_AUDITORIA = 5;

// "Ana", "Ana y Juan", "Ana, Juan y Pedro"
const listaDeNombres = (nombres) => (nombres.length <= 1
  ? nombres.join('')
  : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`);

/**
 * Quiénes auditan un cambio ese día (spec 8.2): los auditores disponibles que no lo propusieron; si no hay ninguno, los
 * editores disponibles que no lo propusieron, de respaldo.
 * personas: [{ id, rol, nombre_completo, disponible }]. Devuelve { personas, respaldo }.
 */
export const quienesAuditan = (personas, proponenteId) => {
  const candidatas = personas.filter(p => p.disponible && p.id !== proponenteId);
  const auditores = candidatas.filter(p => esAuditor(p.rol));
  if (auditores.length > 0) return { personas: auditores, respaldo: false };
  return { personas: candidatas.filter(p => p.rol === 'editor'), respaldo: true };
};

// El 403 de un editor que quiere auditar un cambio que tiene auditores disponibles (spec 8.2)
export const mensajeNoCorresponde = (auditores) =>
  `Este cambio lo auditan ${listaDeNombres(auditores.map(p => p.nombre_completo))}. Podés auditarlo solo si ninguno está disponible.`;

/**
 * Si usuario ({ id, rol }) puede aprobar o rechazar hoy un cambio que propuso otro (proponenteId), según la spec 8.2 y las
 * "Decisiones del plan" 1 y 2: un auditor, siempre; un editor, solo de respaldo, cuando ningún auditor que no lo propuso
 * está disponible. Que no sea su propio cambio lo controla quien llama.
 * Devuelve { puede: true, respaldo } o { puede: false, mensaje }.
 */
export const permisoParaAuditar = (usuario, proponenteId, personas) => {
  if (esAuditor(usuario.rol)) return { puede: true, respaldo: false };
  if (usuario.rol !== 'editor') {
    return { puede: false, mensaje: 'Solo pueden auditar cambios los auditores y, de respaldo, los editores.' };
  }
  const { personas: auditores, respaldo } = quienesAuditan(personas, proponenteId);
  return respaldo ? { puede: true, respaldo: true } : { puede: false, mensaje: mensajeNoCorresponde(auditores) };
};

/**
 * Canal de un cambio pendiente en la corrida de un día hábil (spec 9.1). 'nota' si se cumplen las cuatro condiciones:
 * 1. ya tuvo su primer recordatorio en un día hábil anterior (primer_recordatorio_fecha < hoy);
 * 2. ninguno de los titulares puede auditarlo hoy (lo propuso o no está disponible);
 * 3. hay auditores disponibles para el cambio (no es de respaldo);
 * 4. hay quién firme.
 * 'recordatorio' en cualquier otro caso. La misma función decide para el recordatorio de las 14:00 y la nota de las 8:15.
 * cambio: { usuario_id, primer_recordatorio_fecha ('AAAA-MM-DD' en hora de Argentina, o null) }
 * personas, titulares (ids) y hayQuienFirme: los de auditoriaService.contextoDeCanal
 */
export const canalDelCambio = ({ cambio, hoy, personas, titulares, hayQuienFirme }) => {
  const yaTuvoRecordatorio = Boolean(cambio.primer_recordatorio_fecha) && cambio.primer_recordatorio_fecha < hoy;
  const disponibles = new Set(personas.filter(p => p.disponible).map(p => p.id));
  const algunTitularPuede = titulares.some(id => id !== cambio.usuario_id && disponibles.has(id));
  const hayAuditores = !quienesAuditan(personas, cambio.usuario_id).respaldo;
  return yaTuvoRecordatorio && !algunTitularPuede && hayAuditores && hayQuienFirme ? 'nota' : 'recordatorio';
};

// Va en el recordatorio (spec 9.2): está en el canal recordatorio y se propuso hace una hora o más. antiguedad_segundos
// se mide con el reloj de la base (auditoriaService.cambiosConCanal)
export const entraEnRecordatorio = (cambio) =>
  cambio.canal === 'recordatorio' && Number(cambio.antiguedad_segundos) >= ANTIGUEDAD_MINIMA_RECORDATORIO;

/**
 * Sección de la nota de auditoría de hoy para un cambio del canal nota (spec 9.3): 'nuevo' si nunca estuvo en una nota de
 * auditoría (ultima: null), 'reiterado' si la última que lo incluyó es de hace 5 días hábiles o más; si no, null.
 */
export const seccionDeAuditoria = (ultima, hoy) => {
  if (!ultima) return 'nuevo';
  return diasHabilesTranscurridos(ultima, hoy) >= DIAS_HABILES_PARA_REITERAR_AUDITORIA ? 'reiterado' : null;
};
```

- [ ] **Step 7: Correr los tests de la tarea**

Run: `node --test tests/notas-calendario.test.js tests/usuarios-reglas.test.js tests/auditoria-reglas.test.js`
Expected: PASS.

- [ ] **Step 8: Suite completa** — `npm test 2>&1 | tail -15`: `ℹ fail 0`, ninguna falla nueva.

- [ ] **Step 9: Commit**

```bash
git add services/notasDigitalesCalendario.js services/usuariosReglas.js services/auditoriaReglas.js tests/notas-calendario.test.js tests/usuarios-reglas.test.js tests/auditoria-reglas.test.js
git commit -m "feat: días hábiles entre fechas y reglas de quién audita cada cambio y por qué canal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 3: Disponibilidad de los auditores y canal de cada cambio pendiente (lecturas)

**Files:**
- Create: `services/auditoriaService.js`
- Test: `tests/auditoria-datos.test.js` (nuevo)

**Interfaces:**
- Consumes: `canalDelCambio`, `seccionDeAuditoria` (Task 2); `obtenerConfig` (`notasDigitalesDatos.js`); `firmaParaFecha` (`notasDigitalesFirmas.js`); `hoyArgentina`.
- Produces:
  - `personasDeAuditoria(fecha, conexion?) → [{ id, username, nombre_completo, email, rol, activo, tiene_contrasena, de_licencia, ausente_por_licencia, disponible }]`: superadmins, admins y editores, ordenados por nombre. `disponible = activo && tiene_contrasena && !de_licencia` (spec 3); `ausente_por_licencia = activo && tiene_contrasena && de_licencia` (estaría disponible si no fuera por la licencia). **Es el único lugar que calcula la disponibilidad.**
  - `contextoDeCanal(fecha, config?) → { personas, titulares, hayQuienFirme }`.
  - `cambiosConCanal(fecha, contexto?) → [cambio]`, cada cambio pendiente con `{ id, tipo_cambio, dataset_id, datos_nuevos, datos_anteriores (objetos), usuario_id, usuario_username, usuario_nombre, usuario_cargo, dataset_titulo, fecha_propuesta, antiguedad_segundos, primer_recordatorio_fecha, canal }`, del más viejo al más nuevo.
  - `notasDeAuditoriaDe(ids) → Map<cambio_id, [{ numero, anio, fecha }]>` (notas de auditoría no de prueba que lo incluyeron, de la primera a la última).
  - `seleccionarParaAuditoria(fecha, contexto?) → { nuevos, reiterados }`; cada reiterado suma `solicitado: { numero, anio, fecha, reiteraciones }` (Decisiones 5).
  - `catalogosParaAuditoria() → { areas, frecuencias, temas, formatos }` (cada uno `id → nombre`).

- [ ] **Step 1: Tests que fallan.** Crear `tests/auditoria-datos.test.js`:

```js
// Lecturas de la auditoría de cambios pendientes (services/auditoriaService.js, spec
// 2026-10-15-dias-habiles-licencias-auditoria, 3, 9.1 y 9.3) sobre una base de prueba
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query } from './helpers.js';
import { limpiarBase, crearNota, crearArea } from './notas-fixtures.js';
import { pngRgba } from './firma-fixtures.js';

const FIRMA = pngRgba({ ancho: 40, alto: 20 });
let base, servicio, dbReal, titular, auditor, editor;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_auditoria_datos');
  process.env.DB_NAME = base.nombre;
  servicio = await import('../services/auditoriaService.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

const crearUsuario = async (rol, { activo = 1, contrasena = 'x', conFirma = false } = {}) => {
  const username = `t_${rol}_${crypto.randomBytes(3).toString('hex')}`;
  const r = await query(
    'INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo, cargo) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [username, contrasena, `Persona ${rol}`, `${username}@rpad.test`, rol, activo, `Cargo ${rol}`]
  );
  if (conFirma) {
    await query("INSERT INTO usuarios_firmas (usuario_id, nombre, cargo, imagen, mime) VALUES (?, ?, ?, ?, 'image/png')",
      [r.insertId, `Firma ${rol}`, `Cargo de firma ${rol}`, FIRMA]);
  }
  return { id: r.insertId, username };
};

beforeEach(async () => {
  await limpiarBase();
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios_firmas');
  await query('DELETE FROM cambios_pendientes');
  await query('DELETE FROM usuarios');
  titular = await crearUsuario('superadmin', { conFirma: true });
  auditor = await crearUsuario('admin', { conFirma: true });
  editor = await crearUsuario('editor');
  await query('UPDATE notas_digitales_config SET firmante_usuario_id = ? WHERE id = 1', [titular.id]);
});

const licencia = (usuario, desde, hasta, autorizado = null) => query(
  'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, autorizado_id) VALUES (?, ?, ?, ?)',
  [usuario.id, desde, hasta, autorizado?.id ?? null]
);
// Instante de una fecha y hora de Argentina (UTC-3), en segundos: created_at se carga con FROM_UNIXTIME, que no depende
// de la zona horaria de la base
const instante = (texto) => Date.parse(`${texto.replace(' ', 'T')}-03:00`) / 1000;
const proponer = async (usuario, { creado = '2026-10-16 10:00:00', primer = null, titulo = 'Alta de prueba' } = {}) => (await query(
  `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id, created_at, primer_recordatorio_at)
   VALUES ('crear', NULL, ?, ?, FROM_UNIXTIME(?), ?)`,
  [JSON.stringify({ titulo }), usuario.id, instante(creado), primer]
)).insertId;

describe('personasDeAuditoria (spec 3: disponible)', () => {
  it('superadmin, admins y editores; disponibles si están activos, con contraseña y sin licencia ese día', async () => {
    const inactivo = await crearUsuario('admin', { activo: 0 });
    const sinContrasena = await crearUsuario('admin', { contrasena: null });
    await crearUsuario('lector');
    await licencia(editor, '2026-10-19', '2026-10-23');
    const personas = await servicio.personasDeAuditoria('2026-10-19');
    const de = (u) => personas.find(p => p.id === u.id);
    assert.equal(personas.length, 5);
    assert.deepEqual([titular, auditor, inactivo, sinContrasena, editor].map(u => de(u).disponible), [true, true, false, false, false]);
    assert.deepEqual([de(editor).de_licencia, de(editor).ausente_por_licencia, de(inactivo).ausente_por_licencia, de(inactivo).activo, de(sinContrasena).tiene_contrasena], [true, true, false, false, false]);
    assert.equal((await servicio.personasDeAuditoria('2026-10-26')).find(p => p.id === editor.id).disponible, true);
  });

  it('una licencia anulada no cuenta', async () => {
    await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta, anulada) VALUES (?, ?, ?, 1)', [auditor.id, '2026-10-19', '2026-10-23']);
    assert.equal((await servicio.personasDeAuditoria('2026-10-19')).find(p => p.id === auditor.id).disponible, true);
  });
});

describe('contextoDeCanal (spec 9.1)', () => {
  it('con firmante titular: es el único titular; durante su licencia sin autorizado no hay quién firme', async () => {
    let contexto = await servicio.contextoDeCanal('2026-10-19');
    assert.deepEqual(contexto.titulares, [titular.id]);
    assert.equal(contexto.hayQuienFirme, true);
    await licencia(titular, '2026-10-19', '2026-10-23');
    contexto = await servicio.contextoDeCanal('2026-10-19');
    assert.equal(contexto.hayQuienFirme, false);
    assert.equal(contexto.personas.find(p => p.id === titular.id).disponible, false);
  });

  it('durante la licencia con un autorizado vigente sí hay quién firme', async () => {
    await licencia(titular, '2026-10-19', '2026-10-23', auditor);
    assert.equal((await servicio.contextoDeCanal('2026-10-19')).hayQuienFirme, true);
  });

  it('sin firmante titular: los superadmins son los titulares y siempre hay quién firme (la configuración de Correos)', async () => {
    await query('UPDATE notas_digitales_config SET firmante_usuario_id = NULL WHERE id = 1');
    await licencia(titular, '2026-10-19', '2026-10-23');
    const contexto = await servicio.contextoDeCanal('2026-10-19');
    assert.deepEqual(contexto.titulares, [titular.id]);
    assert.equal(contexto.hayQuienFirme, true);
  });
});

describe('cambiosConCanal (spec 9.1 y Decisiones del plan 3)', () => {
  it('la fecha de la propuesta es la de Argentina aunque la base esté en UTC (el 16/10 a las 22:30 ya es 17/10 en UTC)', async () => {
    await proponer(editor, { creado: '2026-10-16 22:30:00' });
    const [cambio] = await servicio.cambiosConCanal('2026-10-19');
    assert.equal(cambio.fecha_propuesta, '2026-10-16');
    assert.deepEqual(cambio.datos_nuevos, { titulo: 'Alta de prueba' });
    assert.deepEqual([cambio.usuario_nombre, cambio.usuario_cargo, cambio.dataset_titulo], ['Persona editor', 'Cargo editor', null]);
  });

  it('la antigüedad se mide con el reloj de la base: 61 minutos son 61 minutos, en UTC o en hora argentina', async () => {
    const id = await proponer(editor);
    await query('UPDATE cambios_pendientes SET created_at = NOW() - INTERVAL 61 MINUTE WHERE id = ?', [id]);
    const [cambio] = await servicio.cambiosConCanal('2026-10-19');
    assert.ok(cambio.antiguedad_segundos >= 61 * 60 && cambio.antiguedad_segundos < 63 * 60, String(cambio.antiguedad_segundos));
  });

  it('el canal: nota con las cuatro condiciones, recordatorio si falta una; los ya auditados no aparecen', async () => {
    await proponer(titular, { primer: '2026-10-16 14:00:00', titulo: 'Del titular' });
    await proponer(editor, { primer: '2026-10-16 14:00:00', titulo: 'Del editor' });
    const canales = async (fecha) => Object.fromEntries((await servicio.cambiosConCanal(fecha)).map(c => [c.datos_nuevos.titulo, c.canal]));
    assert.deepEqual(await canales('2026-10-16'), { 'Del titular': 'recordatorio', 'Del editor': 'recordatorio' });
    assert.deepEqual(await canales('2026-10-19'), { 'Del titular': 'nota', 'Del editor': 'recordatorio' });
    const [fila] = await query("SELECT DATE_FORMAT(primer_recordatorio_at, '%Y-%m-%d') AS f FROM cambios_pendientes LIMIT 1");
    assert.equal(fila.f, '2026-10-16');
    await query("UPDATE cambios_pendientes SET estado = 'aprobado'");
    assert.deepEqual(await servicio.cambiosConCanal('2026-10-19'), []);
  });
});

describe('seleccionarParaAuditoria (spec 9.3 y Decisiones del plan 5)', () => {
  const incluir = (notaId, cambioId, seccion) =>
    query('INSERT INTO notas_digitales_cambios (nota_id, cambio_id, seccion) VALUES (?, ?, ?)', [notaId, cambioId, seccion]);

  it('nuevos; nada en los 5 días hábiles siguientes; después, reiterados con la primera nota y las reiteraciones', async () => {
    const id = await proponer(titular, { primer: '2026-10-16 14:00:00' });
    await proponer(editor, { primer: '2026-10-16 14:00:00', titulo: 'Del editor' });
    let seleccion = await servicio.seleccionarParaAuditoria('2026-10-19');
    assert.deepEqual([seleccion.nuevos.map(c => c.id), seleccion.reiterados], [[id], []]);

    await incluir(await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-10-19', numero: 3 }), id, 'nuevo');
    seleccion = await servicio.seleccionarParaAuditoria('2026-10-23');
    assert.deepEqual([seleccion.nuevos, seleccion.reiterados], [[], []]);

    seleccion = await servicio.seleccionarParaAuditoria('2026-10-26');
    assert.deepEqual(seleccion.reiterados.map(c => [c.id, c.solicitado]),
      [[id, { numero: 3, anio: 2026, fecha: '2026-10-19', reiteraciones: 0 }]]);

    await incluir(await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-10-26', numero: 5, estado: 'fallida' }), id, 'reiterado');
    // Una nota de prueba no cuenta, aunque tuviera filas
    await incluir(await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-10-30', esPrueba: 1 }), id, 'nuevo');
    seleccion = await servicio.seleccionarParaAuditoria('2026-11-02');
    assert.deepEqual(seleccion.reiterados[0].solicitado, { numero: 3, anio: 2026, fecha: '2026-10-19', reiteraciones: 1 });
    assert.deepEqual((await servicio.notasDeAuditoriaDe([id])).get(id).map(n => n.fecha), ['2026-10-19', '2026-10-26']);
  });

  it('catalogosParaAuditoria: los nombres por id', async () => {
    const [tema] = await query('SELECT id, nombre FROM temas ORDER BY id LIMIT 1');
    const areaId = await crearArea({ nombre: 'Área de catálogo' });
    const catalogos = await servicio.catalogosParaAuditoria();
    assert.equal(catalogos.temas[tema.id], tema.nombre);
    assert.equal(catalogos.areas[areaId], 'Área de catálogo');
    assert.ok(Object.values(catalogos.formatos).includes('CSV'));
    assert.ok(Object.values(catalogos.frecuencias).includes('Anualmente'));
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/auditoria-datos.test.js`
Expected: FAIL (`Cannot find module '../services/auditoriaService.js'`).

- [ ] **Step 3: Implementar** `services/auditoriaService.js`:

```js
// Lecturas de la auditoría de cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 3, 8, 9 y 10): quiénes
// están disponibles cada día, el canal de cada cambio pendiente y los cambios de la nota de auditoría. Las reglas están
// en auditoriaReglas.js; esta es la única definición de "disponible" del sistema.
import pool from '../config/database.js';
import { obtenerConfig } from './notasDigitalesDatos.js';
import { firmaParaFecha } from './notasDigitalesFirmas.js';
import { hoyArgentina } from './notasDigitalesCalendario.js';
import { canalDelCambio, seccionDeAuditoria } from './auditoriaReglas.js';

/**
 * Superadmins, admins y editores, del nombre a la Z, con si están disponibles en la fecha (spec 3): activos, con la
 * contraseña definida y sin licencia ese día (la misma condición que licenciasService.licenciaEnFecha: no anulada,
 * desde <= fecha <= hasta). conexion: el pool o una conexión con transacción.
 * [{ id, username, nombre_completo, email, rol, activo, tiene_contrasena, de_licencia, disponible }]
 */
export const personasDeAuditoria = async (fecha, conexion = pool) => {
  const [filas] = await conexion.query(
    `SELECT u.id, u.username, u.nombre_completo, u.email, u.rol, u.activo, (u.password_hash IS NOT NULL) AS tiene_contrasena,
       EXISTS (SELECT 1 FROM usuarios_licencias l
               WHERE l.usuario_id = u.id AND l.anulada = 0 AND l.desde <= ? AND l.hasta >= ?) AS de_licencia
     FROM usuarios u
     WHERE u.rol IN ('superadmin', 'admin', 'editor')
     ORDER BY u.nombre_completo, u.id`,
    [fecha, fecha]
  );
  return filas.map((f) => {
    const activo = Boolean(Number(f.activo));
    const tieneContrasena = Boolean(Number(f.tiene_contrasena));
    const deLicencia = Boolean(Number(f.de_licencia));
    return {
      id: f.id, username: f.username, nombre_completo: f.nombre_completo, email: f.email, rol: f.rol,
      activo, tiene_contrasena: tieneContrasena, de_licencia: deLicencia,
      ausente_por_licencia: activo && tieneContrasena && deLicencia, disponible: activo && tieneContrasena && !deLicencia
    };
  });
};

/**
 * Lo que necesita canalDelCambio en la fecha (spec 9.1): { personas, titulares, hayQuienFirme }.
 * titulares: el firmante titular o, sin titular elegido, los superadmins (Decisiones del plan 6).
 * hayQuienFirme: firmaParaFecha no está en modo 'sin_autorizado' (sin titular elegido firma la configuración de Correos).
 * config: la de Notas Digitales (se lee si no viene).
 */
export const contextoDeCanal = async (fecha, config = null) => {
  const configuracion = config ?? await obtenerConfig();
  const personas = await personasDeAuditoria(fecha);
  const titulares = configuracion.firmante_usuario_id
    ? [configuracion.firmante_usuario_id]
    : personas.filter(p => p.rol === 'superadmin').map(p => p.id);
  const { modo } = await firmaParaFecha(configuracion, fecha);
  return { personas, titulares, hayQuienFirme: modo !== 'sin_autorizado' };
};

const jsonDe = (valor) => (typeof valor === 'string' ? JSON.parse(valor) : valor ?? null);

/**
 * Cambios pendientes, del más viejo al más nuevo, con su canal en la fecha (spec 9.1). Cada uno suma:
 * fecha_propuesta ('AAAA-MM-DD' en hora de Argentina), antiguedad_segundos, primer_recordatorio_fecha ('AAAA-MM-DD' o null)
 * y canal ('nota' o 'recordatorio').
 * created_at es TIMESTAMP (un instante) y la base puede estar en UTC: su texto no es la hora argentina. Por eso la fecha
 * sale de UNIX_TIMESTAMP (hoyArgentina del instante) y la antigüedad, del reloj de la base en los dos extremos
 * (TIMESTAMPDIFF con NOW(), los dos en la zona de la sesión): ninguna depende de la zona de la base ni de la de Node.
 * contexto: el de contextoDeCanal para la fecha (se lee si no viene).
 */
export const cambiosConCanal = async (fecha, contexto = null) => {
  const ctx = contexto ?? await contextoDeCanal(fecha);
  const [filas] = await pool.query(
    `SELECT cp.id, cp.tipo_cambio, cp.dataset_id, cp.datos_nuevos, cp.datos_anteriores, cp.usuario_id,
            UNIX_TIMESTAMP(cp.created_at) AS creado_ts,
            TIMESTAMPDIFF(SECOND, cp.created_at, NOW()) AS antiguedad_segundos,
            DATE_FORMAT(cp.primer_recordatorio_at, '%Y-%m-%d') AS primer_recordatorio_fecha,
            d.titulo AS dataset_titulo, u.username AS usuario_username, u.nombre_completo AS usuario_nombre,
            u.cargo AS usuario_cargo
     FROM cambios_pendientes cp
     JOIN usuarios u ON u.id = cp.usuario_id
     LEFT JOIN datasets d ON d.id = cp.dataset_id
     WHERE cp.estado = 'pendiente'
     ORDER BY cp.created_at, cp.id`
  );
  return filas.map(({ creado_ts: creado, ...fila }) => {
    const cambio = {
      ...fila,
      datos_nuevos: jsonDe(fila.datos_nuevos),
      datos_anteriores: jsonDe(fila.datos_anteriores),
      antiguedad_segundos: Number(fila.antiguedad_segundos),
      fecha_propuesta: hoyArgentina(new Date(Number(creado) * 1000))
    };
    return { ...cambio, canal: canalDelCambio({ cambio, hoy: fecha, ...ctx }) };
  });
};

// Notas de auditoría (no de prueba, en cualquier estado) que incluyeron cada cambio, de la primera a la última:
// Map cambio_id → [{ numero, anio, fecha }]
export const notasDeAuditoriaDe = async (ids) => {
  if (ids.length === 0) return new Map();
  const [filas] = await pool.query(
    `SELECT c.cambio_id, n.numero, n.anio, DATE_FORMAT(n.fecha, '%Y-%m-%d') AS fecha
     FROM notas_digitales_cambios c JOIN notas_digitales n ON n.id = c.nota_id
     WHERE c.cambio_id IN (?) AND n.es_prueba = 0
     ORDER BY n.fecha, n.id`,
    [ids]
  );
  const porCambio = new Map();
  for (const f of filas) {
    if (!porCambio.has(f.cambio_id)) porCambio.set(f.cambio_id, []);
    porCambio.get(f.cambio_id).push({ numero: f.numero, anio: f.anio, fecha: f.fecha });
  }
  return porCambio;
};

/**
 * Cambios de la nota de auditoría de la fecha (spec 9.3): los del canal nota que nunca estuvieron en una nota de auditoría
 * (nuevos) y aquellos cuya última nota es de hace 5 días hábiles o más (reiterados). Cada reiterado suma solicitado:
 * { numero, anio, fecha } de la primera nota que lo incluyó y reiteraciones, cuántas lo incluyeron después de esa
 * (Decisiones del plan 5). Devuelve { nuevos, reiterados }.
 */
export const seleccionarParaAuditoria = async (fecha, contexto = null) => {
  const delCanal = (await cambiosConCanal(fecha, contexto)).filter(c => c.canal === 'nota');
  const previas = await notasDeAuditoriaDe(delCanal.map(c => c.id));
  const nuevos = [];
  const reiterados = [];
  for (const cambio of delCanal) {
    const notas = previas.get(cambio.id) ?? [];
    const seccion = seccionDeAuditoria(notas.at(-1)?.fecha ?? null, fecha);
    if (seccion === 'nuevo') nuevos.push(cambio);
    else if (seccion === 'reiterado') reiterados.push({ ...cambio, solicitado: { ...notas[0], reiteraciones: notas.length - 1 } });
  }
  return { nuevos, reiterados };
};

// Nombres de los catálogos para el detalle de los cambios de la nota de auditoría (spec 10.3): { areas, frecuencias,
// temas, formatos }, cada uno id → nombre. Los nombres de tabla salen de una lista fija del código.
export const catalogosParaAuditoria = async () => {
  const [[areas], [frecuencias], [temas], [formatos]] = await Promise.all(
    ['areas', 'frecuencias', 'temas', 'formatos'].map(tabla => pool.query(`SELECT id, nombre FROM ${tabla}`))
  );
  const porId = (filas) => Object.fromEntries(filas.map(f => [f.id, f.nombre]));
  return { areas: porId(areas), frecuencias: porId(frecuencias), temas: porId(temas), formatos: porId(formatos) };
};
```

- [ ] **Step 4: Correr los tests de la tarea**

Run: `node --test tests/auditoria-datos.test.js tests/auditoria-reglas.test.js`
Expected: PASS.

- [ ] **Step 5: Suite completa** — `npm test 2>&1 | tail -15`: `ℹ fail 0`, ninguna falla nueva.

- [ ] **Step 6: Commit**

```bash
git add services/auditoriaService.js tests/auditoria-datos.test.js
git commit -m "feat: disponibilidad de los auditores y canal de cada cambio pendiente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 4: El editor en el panel de usuarios y el mínimo de auditores

**Files:**
- Modify: `services/usuariosReglas.js`
- Modify: `controllers/usuariosController.js`
- Modify: `scripts/setup-admin.js`
- Test: `tests/usuarios-reglas.test.js` (cambiar `TEXTO_ROL` y agregar), `tests/editor-panel.test.js` (nuevo)

**Interfaces:**
- Consumes: `esAuditor` (Task 2).
- Produces:
  - `esAdmin(rol)` incluye `editor` (acceso al área de administración: `adminOnly` deja pasar al editor desde esta tarea).
  - `esAprobadorActivo` usa `esAuditor`: el editor no cuenta para el mínimo; `violaMinimoAprobadores(…, { rol: 'editor' })` cuenta como sacar un auditor.
  - `ROLES_ASIGNABLES = ['admin', 'editor', 'lector']`, `TEXTO_ROL.editor = 'Editor'`, mensaje de rol inválido `El rol debe ser admin, editor o lector`.
  - `MENSAJE_EDITOR_SOLO_LECTORES`, `MENSAJE_EDITOR_SIN_ROLES`, `rechazoParaEditor({ objetivo, cambiaRol }) → string | null`.
  - Panel: 403 con mensaje en lo que el editor no puede (tabla 8.1); 409 al pasar al firmante titular a un rol que no sea `superadmin`/`admin`; avisos al superadmin por altas, cambios de email y reactivaciones de editores.

- [ ] **Step 1: Tests de las reglas.** En `tests/usuarios-reglas.test.js`:

(a) Sumar al `import` (después de `TEXTO_ROL`): `ROLES_ASIGNABLES, rechazoParaEditor, MENSAJE_EDITOR_SOLO_LECTORES, MENSAJE_EDITOR_SIN_ROLES`.

(b) En `it('textos de los roles', …)`, reemplazar la línea del `deepEqual` por

```js
    assert.deepEqual(TEXTO_ROL, { superadmin: 'Superadmin', admin: 'Administrador', editor: 'Editor', lector: 'Lector' });
```

(c) Agregar al final del archivo:

```js
describe('editor (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.1 y 8.3)', () => {
  it('entra al área de administración, pero no es auditor ni cuenta como aprobador', () => {
    assert.equal(esAdmin('editor'), true);
    assert.equal(esAuditor('editor'), false);
    assert.equal(esAprobadorActivo(u(1, 'editor')), false);
    assert.deepEqual(ROLES_ASIGNABLES, ['admin', 'editor', 'lector']);
  });

  it('pasar a un admin a editor cuenta como quitar un aprobador', () => {
    const dos = [u(1, 'superadmin'), u(2, 'admin'), u(3, 'editor')];
    assert.equal(violaMinimoAprobadores(dos, 2, { rol: 'editor' }), true);
    assert.equal(violaMinimoAprobadores([...dos, u(4, 'admin')], 2, { rol: 'editor' }), false);
  });

  it('el formulario acepta el rol editor', () => {
    assert.equal(validarDatosUsuario({ rol: 'editor' }, { parcial: true }).datos.rol, 'editor');
    assert.equal(validarDatosUsuario({ rol: 'jefe' }, { parcial: true }).errores[0].error, 'El rol debe ser admin, editor o lector');
  });

  it('lo que el editor no puede en el panel: tocar a quien no es lector, o cambiar un rol', () => {
    assert.equal(rechazoParaEditor({ objetivo: 'lector' }), null);
    for (const objetivo of ['admin', 'editor', 'superadmin']) {
      assert.equal(rechazoParaEditor({ objetivo }), MENSAJE_EDITOR_SOLO_LECTORES, objetivo);
    }
    assert.equal(rechazoParaEditor({ objetivo: 'lector', cambiaRol: true }), MENSAJE_EDITOR_SIN_ROLES);
    assert.equal(MENSAJE_EDITOR_SOLO_LECTORES, 'Un editor solo puede crear y modificar usuarios lectores.');
    assert.equal(MENSAJE_EDITOR_SIN_ROLES, 'Un editor no puede cambiar roles.');
  });
});
```

- [ ] **Step 2: Tests de la API que fallan.** Crear `tests/editor-panel.test.js`:

```js
// El editor en el panel de usuarios y en lo que ya existía para él (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.2,
// 6.1, 6.2, 6.3, 8.1 y 8.3), contra una base de prueba propia. La API usa la fecha real: las licencias se arman desde hoy.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query, mailpit, paraCasilla
} from './helpers.js';
import { pngRgba } from './firma-fixtures.js';
import { hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';

const SOLO_LECTORES = 'Un editor solo puede crear y modificar usuarios lectores.';
const SIN_ROLES = 'Un editor no puede cambiar roles.';
const PROTEGIDA = 'Esta cuenta solo la modifica su titular.';
const MINIMO = 'No se puede: quedarían menos de 2 usuarios que puedan aprobar cambios.';
const FIRMANTE = 'Es el firmante titular de las Notas Digitales: primero hay que elegir a otra persona en Correos.';
const FIRMA_B64 = pngRgba({ ancho: 40, alto: 20 }).toString('base64');
let base, servidor, api, usuarios, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_editor_panel');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, {
    adminA: 'admin', adminB: 'admin', superadmin: 'superadmin', editor: 'editor', editor2: 'editor', lector: 'lector'
  });
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

// Cada prueba arranca igual: los usuarios base activos, con su rol y su email, sesiones nuevas, sin licencias, sin
// firmas y sin firmante titular. Los usuarios creados por otras pruebas quedan desactivados.
beforeEach(async () => {
  await mailpit.vaciar();
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios_firmas');
  await query('UPDATE notas_digitales_config SET firmante_usuario_id = NULL');
  const ids = Object.values(usuarios).map(u => u.id);
  await query('UPDATE usuarios SET activo = 0 WHERE id NOT IN (?)', [ids]);
  for (const u of Object.values(usuarios)) {
    await query('UPDATE usuarios SET activo = 1, rol = ?, email = ? WHERE id = ?', [u.rol, u.email, u.id]);
    u.token = await api.login(u.username, u.password);
  }
});

const como = (clave) => ({ token: usuarios[clave].token });
const sufijo = () => crypto.randomBytes(3).toString('hex');
const nuevo = (datos = {}) => {
  const s = sufijo();
  return { nombre_completo: 'Persona Nueva', username: `PNUEVA${s.toUpperCase()}`, email: `pnueva${s}@rpad.test`, rol: 'lector', ...datos };
};
const hoy = hoyArgentina();
const dia = (n) => sumarDias(hoy, n);

describe('lo que el editor puede (spec 8.1)', () => {
  it('entra a todo el área de administración: usuarios, historial, licencias, cambios, correos y su firma', async () => {
    for (const ruta of ['/usuarios', `/usuarios/${usuarios.adminA.id}`, '/usuarios/licencias', '/cambios-pendientes/para-revisar',
      '/cambios-pendientes/contador', '/notificaciones/notas-digitales/estado', '/notificaciones/notas-digitales/config',
      '/auth/profile/firma']) {
      assert.equal((await api.get(ruta, como('editor'))).status, 200, ruta);
    }
  });

  it('crea lectores, pero no admins ni editores', async () => {
    const lector = await api.post('/usuarios', nuevo(), como('editor'));
    assert.equal(lector.status, 201, JSON.stringify(lector.body));
    for (const rol of ['admin', 'editor']) {
      const res = await api.post('/usuarios', nuevo({ rol }), como('editor'));
      assert.equal(res.status, 403, rol);
      assert.equal(res.body.error, SOLO_LECTORES);
      assert.equal(res.body.campo, 'rol');
    }
  });

  it('edita, desactiva, reactiva y envía links a lectores', async () => {
    const id = usuarios.lector.id;
    assert.equal((await api.put(`/usuarios/${id}`, { cargo: 'Cargo nuevo' }, como('editor'))).status, 200);
    assert.equal((await api.put(`/usuarios/${id}`, { rol: 'lector' }, como('editor'))).status, 200);
    assert.equal((await api.post(`/usuarios/${id}/enviar-acceso`, {}, como('editor'))).status, 200);
    assert.equal((await api.post(`/usuarios/${id}/desactivar`, {}, como('editor'))).status, 200);
    assert.equal((await api.post(`/usuarios/${id}/reactivar`, {}, como('editor'))).status, 200);
  });
});

describe('lo que el editor no puede (spec 8.1)', () => {
  it('no modifica admins, editores (tampoco a sí mismo) ni al superadmin', async () => {
    for (const clave of ['adminA', 'editor2', 'editor']) {
      const id = usuarios[clave].id;
      const edicion = await api.put(`/usuarios/${id}`, { cargo: 'Otro cargo' }, como('editor'));
      assert.equal(edicion.status, 403, clave);
      assert.equal(edicion.body.error, SOLO_LECTORES, clave);
      assert.equal((await api.post(`/usuarios/${id}/enviar-acceso`, {}, como('editor'))).body.error, SOLO_LECTORES, clave);
    }
    assert.equal((await api.post(`/usuarios/${usuarios.adminA.id}/desactivar`, {}, como('editor'))).body.error, SOLO_LECTORES);
    assert.equal((await api.put(`/usuarios/${usuarios.superadmin.id}`, { cargo: 'Otro cargo' }, como('editor'))).body.error, PROTEGIDA);
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [usuarios.editor2.id]);
    assert.equal((await api.post(`/usuarios/${usuarios.editor2.id}/reactivar`, {}, como('editor'))).body.error, SOLO_LECTORES);
    const [admin] = await query('SELECT cargo, activo FROM usuarios WHERE id = ?', [usuarios.adminA.id]);
    assert.deepEqual([admin.cargo, admin.activo], [null, 1]);
  });

  it('no cambia roles: ni el de un lector ni el suyo', async () => {
    const ascenso = await api.put(`/usuarios/${usuarios.lector.id}`, { rol: 'admin' }, como('editor'));
    assert.equal(ascenso.status, 403);
    assert.equal(ascenso.body.error, SIN_ROLES);
    assert.equal((await api.put(`/usuarios/${usuarios.editor.id}`, { rol: 'admin' }, como('editor'))).status, 403);
    const roles = await query('SELECT id, rol FROM usuarios WHERE id IN (?) ORDER BY id', [[usuarios.lector.id, usuarios.editor.id]]);
    assert.deepEqual(roles.map(r => r.rol).sort(), ['editor', 'lector']);
  });
});

describe('mínimo de auditores y firmante titular (spec 6.2 y 8.3)', () => {
  it('un admin pasa a alguien a editor, y eso cuenta como quitar un auditor', async () => {
    const res = await api.put(`/usuarios/${usuarios.adminB.id}`, { rol: 'editor' }, como('adminA'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.rol, 'editor');
    assert.equal((await api.get('/usuarios', como('adminA'))).body.data.resumen.aprobadores_activos, 2);
    const otro = await api.put(`/usuarios/${usuarios.adminA.id}`, { rol: 'editor' }, como('superadmin'));
    assert.equal(otro.status, 409);
    assert.equal(otro.body.error, MINIMO);
  });

  it('el firmante titular no pasa a editor ni a lector', async () => {
    await query('UPDATE notas_digitales_config SET firmante_usuario_id = ?', [usuarios.adminA.id]);
    for (const rol of ['editor', 'lector']) {
      const res = await api.put(`/usuarios/${usuarios.adminA.id}`, { rol }, como('superadmin'));
      assert.equal(res.status, 409, rol);
      assert.equal(res.body.error, FIRMANTE);
    }
    assert.equal((await query('SELECT rol FROM usuarios WHERE id = ?', [usuarios.adminA.id]))[0].rol, 'admin');
  });
});

describe('avisos al superadmin (spec 8.1, último punto)', () => {
  const avisos = () => mailpit.esperar(
    m => m.Subject === 'RPAD: cambio en los usuarios' && paraCasilla(usuarios.superadmin.email)(m), { intentos: 20 }
  );

  it('cubren a los editores: alta, cambio de email y reactivación', async () => {
    assert.equal((await api.post('/usuarios', nuevo({ rol: 'editor' }), como('adminA'))).status, 201);
    assert.match(await mailpit.html((await avisos())[0].ID), /Alta como Editor/);

    await mailpit.vaciar();
    assert.equal((await api.put(`/usuarios/${usuarios.editor2.id}`, { email: `editor2-${sufijo()}@rpad.test` }, como('adminA'))).status, 200);
    assert.match(await mailpit.html((await avisos())[0].ID), /Email:/);

    await mailpit.vaciar();
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [usuarios.editor2.id]);
    assert.equal((await api.post(`/usuarios/${usuarios.editor2.id}/reactivar`, {}, como('adminA'))).status, 200);
    assert.match(await mailpit.html((await avisos())[0].ID), /Reactivado/);
  });
});

describe('licencias y firma del editor (spec 5.2, 6.1, 6.2 y 6.3, "desde la entrega 3")', () => {
  it('carga licencias, puede tener una, carga su firma y puede ser la persona autorizada, pero no firmante titular', async () => {
    const deOtro = await api.post('/usuarios/licencias', { usuario_id: usuarios.adminB.id, desde: dia(5), hasta: dia(10) }, como('editor'));
    assert.equal(deOtro.status, 201, JSON.stringify(deOtro.body));
    const propia = await api.post('/usuarios/licencias', { usuario_id: usuarios.editor.id, desde: dia(5), hasta: dia(10) }, como('adminA'));
    assert.equal(propia.status, 201, JSON.stringify(propia.body));

    const firma = await api.put('/auth/profile/firma', { nombre: 'Firma Editora', cargo: 'Cargo Editora', imagen: FIRMA_B64, mime: 'image/png' }, como('editor2'));
    assert.equal(firma.status, 200, JSON.stringify(firma.body));
    await api.put('/auth/profile/firma', { nombre: 'Firma Super', cargo: 'Cargo Super', imagen: FIRMA_B64, mime: 'image/png' }, como('superadmin'));
    await query('UPDATE notas_digitales_config SET firmante_usuario_id = ?', [usuarios.superadmin.id]);
    const autorizada = await api.post('/usuarios/licencias',
      { usuario_id: usuarios.superadmin.id, desde: dia(20), hasta: dia(25), autorizado_id: usuarios.editor2.id }, como('superadmin'));
    assert.equal(autorizada.status, 201, JSON.stringify(autorizada.body));
    assert.equal(autorizada.body.data.autorizado_id, usuarios.editor2.id);

    const firmantes = (await api.get('/notificaciones/notas-digitales/config/firmantes', como('superadmin'))).body.data;
    assert.ok(!firmantes.some(f => f.id === usuarios.editor2.id));
    assert.equal((await api.put('/notificaciones/notas-digitales/config/firmante', { usuario_id: usuarios.editor2.id }, como('superadmin'))).status, 400);
  });
});
```

- [ ] **Step 3: Correr y ver que fallan**

Run: `node --test tests/usuarios-reglas.test.js tests/editor-panel.test.js`
Expected: FAIL (`rechazoParaEditor` no existe; el editor recibe 403 de `adminOnly` en todo el panel).

- [ ] **Step 4: `services/usuariosReglas.js`.**

(a) Reemplazar

```js
export const ROLES_ASIGNABLES = ['admin', 'lector'];
```

y

```js
export const TEXTO_ROL = { superadmin: 'Superadmin', admin: 'Administrador', lector: 'Lector' };
```

por

```js
export const ROLES_ASIGNABLES = ['admin', 'editor', 'lector'];
```

y

```js
export const TEXTO_ROL = { superadmin: 'Superadmin', admin: 'Administrador', editor: 'Editor', lector: 'Lector' };
```

(b) Reemplazar

```js
// superadmin y admin pasan todo lo de administración (spec 5.3)
export const esAdmin = (rol) => rol === 'admin' || rol === 'superadmin';
```

por

```js
// superadmin, admin y editor pasan todo lo de administración (spec 5.3; el editor, spec 2026-10-15, 8.1)
export const esAdmin = (rol) => rol === 'admin' || rol === 'superadmin' || rol === 'editor';
```

(c) Reemplazar

```js
// Puede aprobar cambios hoy: aprobador, activo y con contraseña definida (spec 3)
export const esAprobadorActivo = (usuario) =>
  esAdmin(usuario.rol) && Boolean(usuario.activo) && Boolean(usuario.tiene_contrasena);
```

por

```js
// Cuenta para el mínimo de aprobadores: auditor (superadmin o admin), activo y con contraseña definida (spec 3; el editor
// no cuenta, spec 2026-10-15, 8.3)
export const esAprobadorActivo = (usuario) =>
  esAuditor(usuario.rol) && Boolean(usuario.activo) && Boolean(usuario.tiene_contrasena);
```

(`esAuditor` está definida antes, desde la Task 2.)

(d) En `validarDatosUsuario`, reemplazar `'El rol debe ser admin o lector'` por `'El rol debe ser admin, editor o lector'`.

(e) Agregar al final del archivo:

```js
// Lo que el editor no puede hacer en el panel (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.1)
export const MENSAJE_EDITOR_SOLO_LECTORES = 'Un editor solo puede crear y modificar usuarios lectores.';
export const MENSAJE_EDITOR_SIN_ROLES = 'Un editor no puede cambiar roles.';

/**
 * Motivo del 403 si un editor no puede hacer la operación, o null. objetivo: el rol del usuario afectado (en el alta, el
 * rol pedido); cambiaRol: si el pedido le cambia el rol. El editor solo crea, edita, activa, desactiva y envía links a
 * lectores, y no cambia roles (tampoco el suyo): cambiándole el email y enviándole un link a otro editor podría quedarse
 * con su cuenta.
 */
export const rechazoParaEditor = ({ objetivo, cambiaRol = false }) => {
  if (objetivo !== 'lector') return MENSAJE_EDITOR_SOLO_LECTORES;
  if (cambiaRol) return MENSAJE_EDITOR_SIN_ROLES;
  return null;
};
```

- [ ] **Step 5: `controllers/usuariosController.js`.**

(a) Reemplazar el comentario de la primera línea por

```js
// Panel de usuarios (spec 8 a 11). Las rutas exigen authMiddleware + adminOnly: superadmin, admin y editor. El editor solo
// crea y modifica lectores y no cambia roles (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.1).
```

y el `import` de `usuariosReglas.js` por

```js
import {
  validarDatosUsuario, violaMinimoAprobadores, estadoDeUsuario, esAprobadorActivo, esAdmin, esAuditor, emailValido, camposCambiados,
  rechazoParaEditor, MENSAJE_EDITOR_SOLO_LECTORES, MINIMO_APROBADORES, TEXTO_ROL
} from '../services/usuariosReglas.js';
```

(b) Después de `const MENSAJE_ERROR = 'Error interno del servidor';`, agregar:

```js
const MENSAJE_FIRMANTE = 'Es el firmante titular de las Notas Digitales: primero hay que elegir a otra persona en Correos.';
```

y después de `buscarUsuario`:

```js
// ¿Es quien firma las Notas Digitales? Tiene que seguir siendo superadmin o admin (spec 2026-10-15, 6.2)
const esFirmanteTitular = async (conexion, id) => {
  const [[config]] = await conexion.execute('SELECT firmante_usuario_id FROM notas_digitales_config WHERE id = 1');
  return config?.firmante_usuario_id === id;
};
```

(c) `crearUsuario`: después de sus dos primeras validaciones, `const { errores, datos } = validarDatosUsuario(entrada);` y `if (errores.length > 0) return responderError(res, 400, errores[0].error, errores[0].campo);` (en `actualizarUsuario` la validación lleva `{ parcial: true }`: ahí no va), agregar

```js
  // El editor solo crea lectores (spec 2026-10-15, 8.1)
  const rechazoEditor = req.user.rol === 'editor' ? rechazoParaEditor({ objetivo: datos.rol }) : null;
  if (rechazoEditor) return responderError(res, 403, rechazoEditor, 'rol');
```

y reemplazar

```js
    if (datos.rol === 'admin') await avisar(req, usuario, `Alta como ${TEXTO_ROL.admin}`, auditoriaId);
```

por

```js
    // El alta de alguien con acceso a la administración (admin o editor) se avisa al superadmin (spec 10.3; 2026-10-15, 8.1)
    if (esAdmin(datos.rol)) await avisar(req, usuario, `Alta como ${TEXTO_ROL[datos.rol]}`, auditoriaId);
```

(d) `actualizarUsuario`: reemplazar

```js
    rolNuevo = datos.rol !== undefined && datos.rol !== antes.rol ? datos.rol : null;
    if (rolNuevo && violaMinimoAprobadores(todos, id, { rol: rolNuevo })) {
```

por

```js
    rolNuevo = datos.rol !== undefined && datos.rol !== antes.rol ? datos.rol : null;
    // El editor solo modifica lectores y no cambia roles, tampoco el suyo (spec 2026-10-15, 8.1)
    const rechazoEditor = req.user.rol === 'editor' ? rechazoParaEditor({ objetivo: antes.rol, cambiaRol: Boolean(rolNuevo) }) : null;
    if (rechazoEditor) {
      await conexion.rollback();
      return responderError(res, 403, rechazoEditor);
    }
    // Quien firma las Notas Digitales tiene que seguir siendo superadmin o admin (spec 2026-10-15, 6.2)
    if (rolNuevo && !esAuditor(rolNuevo) && await esFirmanteTitular(conexion, id)) {
      await conexion.rollback();
      return responderError(res, 409, MENSAJE_FIRMANTE, 'rol');
    }
    // Pasar a un admin a editor o a lector saca un auditor (spec 2026-10-15, 8.3)
    if (rolNuevo && violaMinimoAprobadores(todos, id, { rol: rolNuevo })) {
```

y, en el comentario de los avisos (`// Un solo aviso por edición, con todo lo que importa: …`), dejar: `// Un solo aviso por edición: el rol y el email de quien tiene acceso a la administración, editores incluidos (spec 10.3; 2026-10-15, 8.1)`. La línea `if (campos.email && esAdmin(despues.rol)) …` no cambia: con el `esAdmin` nuevo cubre a los editores.

(e) `desactivarUsuario`: reemplazar (la línea empieza con la llave que cierra el bloque del superadmin)

```js
    } else if (!usuario.activo) rechazo = [409, 'El usuario ya está desactivado'];
```

por

```js
    } else if (req.user.rol === 'editor' && usuario.rol !== 'lector') rechazo = [403, MENSAJE_EDITOR_SOLO_LECTORES];
    else if (!usuario.activo) rechazo = [409, 'El usuario ya está desactivado'];
```

(f) `reactivarUsuario`: reemplazar

```js
    else if (usuario.activo) rechazo = [409, 'El usuario ya está activo'];
```

por

```js
    else if (req.user.rol === 'editor' && usuario.rol !== 'lector') rechazo = [403, MENSAJE_EDITOR_SOLO_LECTORES];
    else if (usuario.activo) rechazo = [409, 'El usuario ya está activo'];
```

(La línea `if (esAdmin(reactivado.rol)) await avisar(…, 'Reactivado', …)` no cambia: con el `esAdmin` nuevo cubre a los editores.)

(g) `enviarAcceso`: después de `if (usuario.rol === 'superadmin' && req.user.userId !== id) return responderError(res, 403, MENSAJE_PROTEGIDA);`, agregar

```js
    // El editor solo envía links a lectores (spec 2026-10-15, 8.1)
    if (req.user.rol === 'editor' && usuario.rol !== 'lector') return responderError(res, 403, MENSAJE_EDITOR_SOLO_LECTORES);
```

- [ ] **Step 6: `scripts/setup-admin.js`.** Reemplazar

```js
    const rolInput = await question('Rol (superadmin/admin/lector) [lector]: ');
    const rolElegido = rolInput.trim().toLowerCase();
    const rol = ['superadmin', 'admin', 'lector'].includes(rolElegido) ? rolElegido : 'lector';
```

por

```js
    const rolInput = await question('Rol (superadmin/admin/editor/lector) [lector]: ');
    const rolElegido = rolInput.trim().toLowerCase();
    const rol = ['superadmin', 'admin', 'editor', 'lector'].includes(rolElegido) ? rolElegido : 'lector';
```

- [ ] **Step 7: Correr los tests de la tarea y los del panel**

Run: `node --test tests/usuarios-reglas.test.js tests/editor-panel.test.js tests/usuarios-panel.test.js tests/licencias-api.test.js tests/firmas.test.js tests/permisos.test.js`
Expected: PASS (el panel se comporta igual que antes para admins y superadmin).

- [ ] **Step 8: Suite completa** — `npm test 2>&1 | tail -15`: `ℹ fail 0`, ninguna falla nueva.

- [ ] **Step 9: Commit**

```bash
git add services/usuariosReglas.js controllers/usuariosController.js scripts/setup-admin.js tests/usuarios-reglas.test.js tests/editor-panel.test.js
git commit -m "feat: rol editor en el panel de usuarios y mínimo de auditores

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Regla de respaldo al aprobar y rechazar

**Files:**
- Modify: `controllers/cambiosPendientesController.js`
- Test: `tests/auditoria-api.test.js` (nuevo)

**Interfaces:**
- Consumes: `permisoParaAuditar` (Task 2), `personasDeAuditoria` (Task 3), `hoyArgentina`.
- Produces:
  - `POST /cambios-pendientes/:id/aprobar` y `/rechazar`: además de "no el propio", aplican la regla 8.2 con la fecha de hoy en Argentina: 403 `{ error: mensaje }` si no corresponde; si corresponde de respaldo, guardan `revisado_como_respaldo = 1`.
  - `GET /cambios-pendientes/:id` suma `auditoria: { puede, respaldo, mensaje }` (para Mi Perfil, Task 10): `puede: false, mensaje: null` si es el cambio propio o ya no está pendiente.
  - `GET /cambios-pendientes/mis-cambios` y `/para-revisar` traen `revisado_como_respaldo` (ya lo hacen con `cp.*` desde la Task 1).

- [ ] **Step 1: Tests que fallan.** Crear `tests/auditoria-api.test.js`:

```js
// Quién aprueba o rechaza un cambio pendiente (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.2): la regla de respaldo
// del editor, contra una base de prueba propia. La API usa la fecha real: las licencias se arman desde hoy.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { crearDataset, limpiarBase } from './notas-fixtures.js';
import { hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';

// Los auditores disponibles cuando propone adminA, por nombre: "Test adminB" y "Test superadmin"
const MENSAJE = 'Este cambio lo auditan Test adminB y Test superadmin. Podés auditarlo solo si ninguno está disponible.';
const hoy = hoyArgentina();
let base, servidor, api, usuarios, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_auditoria_api');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, {
    adminA: 'admin', adminB: 'admin', superadmin: 'superadmin', editor: 'editor', editor2: 'editor'
  });
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
  await limpiarBase();
  await query('DELETE FROM cambios_pendientes');
  await query('DELETE FROM usuarios_licencias');
});

const como = (clave) => ({ token: usuarios[clave].token });
// De licencia desde ayer hasta mañana
const deLicenciaHoy = (...claves) => Promise.all(claves.map(clave => query(
  'INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuarios[clave].id, sumarDias(hoy, -1), sumarDias(hoy, 1)]
)));
// Una baja propuesta por esa persona, sobre un dataset de prueba
const proponerBaja = async (clave) => {
  const datasetId = await crearDataset({ titulo: `Dataset auditado ${crypto.randomBytes(3).toString('hex')}`, vencimiento: '2027-06-30' });
  return (await query(
    `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, datos_anteriores, usuario_id)
     VALUES ('eliminar', ?, '{"eliminado":true}', '{"titulo":"Dataset auditado"}', ?)`,
    [datasetId, usuarios[clave].id]
  )).insertId;
};
const aprobar = (id, clave) => api.post(`/cambios-pendientes/${id}/aprobar`, {}, como(clave));
const rechazar = (id, clave) => api.post(`/cambios-pendientes/${id}/rechazar`, { comentario: 'No coincide con lo informado' }, como(clave));
const fila = async (id) => (await query('SELECT estado, revisor_id, revisado_como_respaldo FROM cambios_pendientes WHERE id = ?', [id]))[0];

describe('regla de respaldo al aprobar y rechazar (spec 8.2)', () => {
  it('el editor propone cambios como cualquier admin (spec 8.1) y los audita un auditor, sin marca de respaldo', async () => {
    const datasetId = await crearDataset({ titulo: 'Dataset que propone el editor', vencimiento: '2027-06-30' });
    const baja = await api.delete(`/datasets/${datasetId}`, como('editor'));
    assert.equal(baja.status, 200, JSON.stringify(baja.body));
    const id = baja.body.data.cambio_pendiente_id;
    assert.equal((await aprobar(id, 'adminA')).status, 200);
    assert.deepEqual(await fila(id), { estado: 'aprobado', revisor_id: usuarios.adminA.id, revisado_como_respaldo: 0 });
  });

  it('con auditores disponibles, el editor recibe 403 al aprobar y al rechazar, con sus nombres', async () => {
    const id = await proponerBaja('adminA');
    for (const pedir of [aprobar, rechazar]) {
      const res = await pedir(id, 'editor');
      assert.equal(res.status, 403);
      assert.equal(res.body.error, MENSAJE);
    }
    assert.deepEqual(await fila(id), { estado: 'pendiente', revisor_id: null, revisado_como_respaldo: 0 });
  });

  it('un auditor aprueba sin marca de respaldo, también si ese día está de licencia (Decisiones del plan 1)', async () => {
    await deLicenciaHoy('adminB');
    const id = await proponerBaja('adminA');
    assert.equal((await aprobar(id, 'adminB')).status, 200);
    assert.deepEqual(await fila(id), { estado: 'aprobado', revisor_id: usuarios.adminB.id, revisado_como_respaldo: 0 });
  });

  it('sin auditores disponibles, un editor aprueba de respaldo y queda marcado; Mis cambios lo muestra', async () => {
    await deLicenciaHoy('adminB', 'superadmin');
    const id = await proponerBaja('adminA');
    assert.equal((await aprobar(id, 'editor')).status, 200);
    assert.deepEqual(await fila(id), { estado: 'aprobado', revisor_id: usuarios.editor.id, revisado_como_respaldo: 1 });
    const mios = (await api.get('/cambios-pendientes/mis-cambios', como('adminA'))).body.data;
    assert.equal(mios.find(c => c.id === id).revisado_como_respaldo, 1);
  });

  it('el rechazo de respaldo también queda marcado', async () => {
    await deLicenciaHoy('adminB', 'superadmin');
    const id = await proponerBaja('adminA');
    assert.equal((await rechazar(id, 'editor2')).status, 200);
    assert.deepEqual(await fila(id), { estado: 'rechazado', revisor_id: usuarios.editor2.id, revisado_como_respaldo: 1 });
  });

  it('un editor nunca audita su propio cambio, aunque no haya auditores disponibles; otro editor sí', async () => {
    await deLicenciaHoy('adminA', 'adminB', 'superadmin');
    const id = await proponerBaja('editor');
    assert.equal((await aprobar(id, 'editor')).status, 403);
    assert.equal((await aprobar(id, 'editor2')).status, 200);
    assert.equal((await fila(id)).revisado_como_respaldo, 1);
  });
});

describe('detalle del cambio para Mi Perfil (spec 8.2)', () => {
  it('dice si quien mira puede auditarlo y, si no, por qué', async () => {
    const id = await proponerBaja('adminA');
    const auditoriaDe = async (clave) => (await api.get(`/cambios-pendientes/${id}`, como(clave))).body.data.auditoria;
    assert.deepEqual(await auditoriaDe('editor'), { puede: false, respaldo: false, mensaje: MENSAJE });
    assert.deepEqual(await auditoriaDe('adminB'), { puede: true, respaldo: false, mensaje: null });
    assert.deepEqual(await auditoriaDe('adminA'), { puede: false, respaldo: false, mensaje: null });
    await deLicenciaHoy('adminB', 'superadmin');
    assert.deepEqual(await auditoriaDe('editor'), { puede: true, respaldo: true, mensaje: null });
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/auditoria-api.test.js`
Expected: FAIL (el editor aprueba con 200 donde se espera 403; `auditoria` undefined en el detalle; `revisado_como_respaldo` queda en 0).

- [ ] **Step 3: `controllers/cambiosPendientesController.js`.**

(a) Después de `import pool from '../config/database.js';`, agregar:

```js
import { personasDeAuditoria, catalogosParaAuditoria } from '../services/auditoriaService.js';
import { permisoParaAuditar } from '../services/auditoriaReglas.js';
import { hoyArgentina } from '../services/notasDigitalesCalendario.js';

// ¿Quien pide puede aprobar o rechazar hoy este cambio? (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.2): un
// auditor siempre; un editor, solo de respaldo. conexion: la de la transacción o el pool.
// Devuelve { puede: true, respaldo } o { puede: false, mensaje }.
const permisoParaAuditarHoy = async (conexion, usuario, proponenteId) => permisoParaAuditar(
  { id: usuario.userId, rol: usuario.rol }, proponenteId, await personasDeAuditoria(hoyArgentina(), conexion)
);
```

(a2) Borrar `cargarCatalogos` (el comentario `Funcion auxiliar: Cargar catalogos para enriquecer datos` y la función): hace las mismas consultas que `catalogosParaAuditoria`. En `getCambioPendienteById`, reemplazar `const catalogos = await cargarCatalogos();` por `const catalogos = await catalogosParaAuditoria();`.

(b) En `getCambioPendienteById`, reemplazar

```js
    const cambio = {
      ...rows[0],
      datos_nuevos: datosNuevosEnriquecidos,
      datos_anteriores: datosAnterioresEnriquecidos,
      campos_modificados: camposModificados
    };
```

por

```js
    // Si quien mira puede aprobarlo o rechazarlo hoy (spec 2026-10-15, 8.2): Mi Perfil deshabilita los botones con el motivo
    const sinAuditar = rows[0].estado !== 'pendiente' || rows[0].usuario_id === req.user.userId;
    const auditoria = sinAuditar
      ? { puede: false, respaldo: false, mensaje: null }
      : { respaldo: false, mensaje: null, ...(await permisoParaAuditarHoy(pool, req.user, rows[0].usuario_id)) };

    const cambio = {
      ...rows[0],
      datos_nuevos: datosNuevosEnriquecidos,
      datos_anteriores: datosAnterioresEnriquecidos,
      campos_modificados: camposModificados,
      auditoria
    };
```

(c) En `aprobarCambio`, después del bloque `// Verificar que no sea su propio cambio` (el `if (cambio.usuario_id === revisorId) { … }` que responde `'No puede aprobar sus propios cambios'`), agregar:

```js
    // Regla de respaldo (spec 2026-10-15, 8.2), con la fecha de hoy en Argentina
    const permiso = await permisoParaAuditarHoy(connection, req.user, cambio.usuario_id);
    if (!permiso.puede) {
      await connection.rollback();
      return res.status(403).json({ success: false, error: permiso.mensaje });
    }
```

y reemplazar el `UPDATE` que lo marca aprobado

```js
    await connection.execute(
      `UPDATE cambios_pendientes 
       SET estado = 'aprobado', revisor_id = ?, revisado_at = NOW() 
       WHERE id = ?`,
      [revisorId, id]
    );
```

por

```js
    await connection.execute(
      `UPDATE cambios_pendientes
       SET estado = 'aprobado', revisor_id = ?, revisado_at = NOW(), revisado_como_respaldo = ?
       WHERE id = ?`,
      [revisorId, permiso.respaldo ? 1 : 0, id]
    );
```

(El texto viejo tiene espacios al final de dos líneas: `cambios_pendientes ` y `revisado_at = NOW() `. Si el reemplazo no encuentra el texto, reemplazar ese `UPDATE` completo a mano.)

(d) En `rechazarCambio`, después del bloque que responde `'No puede rechazar sus propios cambios'`, agregar el mismo bloque de la regla de respaldo del punto (c), y reemplazar

```js
    await connection.execute(
      `UPDATE cambios_pendientes
       SET estado = 'rechazado', revisor_id = ?, comentario_rechazo = ?, revisado_at = NOW()
       WHERE id = ?`,
      [revisorId, comentario.trim(), id]
    );
```

por

```js
    await connection.execute(
      `UPDATE cambios_pendientes
       SET estado = 'rechazado', revisor_id = ?, comentario_rechazo = ?, revisado_at = NOW(), revisado_como_respaldo = ?
       WHERE id = ?`,
      [revisorId, comentario.trim(), permiso.respaldo ? 1 : 0, id]
    );
```

- [ ] **Step 4: Correr los tests de la tarea y los de la doble verificación**

Run: `node --test tests/auditoria-api.test.js tests/doble-verificacion.test.js tests/concurrencia.test.js tests/permisos.test.js`
Expected: PASS (los admins aprueban y rechazan como antes).

- [ ] **Step 5: Suite completa** — `npm test 2>&1 | tail -15`: `ℹ fail 0`, ninguna falla nueva.

- [ ] **Step 6: Commit**

```bash
git add controllers/cambiosPendientesController.js tests/auditoria-api.test.js
git commit -m "feat: regla de respaldo del editor al aprobar y rechazar cambios

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 6: Recordatorio de las 14:00

**Files:**
- Modify: `services/emailTemplates.js` (`cambiosPendientesTemplate`)
- Modify: `services/avisosDiariosService.js`
- Test: `tests/avisos-diarios.test.js` (cambiar `proponerCambio` y agregar), `tests/notificaciones.test.js` (los cambios de prueba, dos horas antes)

**Interfaces:**
- Consumes: `contextoDeCanal`, `cambiosConCanal` (Task 3); `quienesAuditan`, `entraEnRecordatorio` (Task 2); `emailValido`; `ahoraArgentina`.
- Produces:
  - `cambiosPendientesTemplate(cambios, { respaldo = false } = {}) → { subject, html }`: asunto `[RPAD] 1 cambio espera tu auditoría` o `[RPAD] {n} cambios esperan tu auditoría`; con `respaldo`, el párrafo `Te llega como respaldo: no hay auditores disponibles.`
  - `enviarCambiosPendientes({ hoy, ahora? })` (mismo nombre: la ruta `/api/cron/cambios-pendientes` y su ejecución manual no cambian) → `{ fecha, dia_habil, enviados: [{ admin, email, cantidadPendientes, respaldo }], sinPendientes: [username], deLicencia: [username], canal_nota, errores: [{ admin, error }] }`. `ahora` (`'AAAA-MM-DD HH:MM:SS'`, hora de Argentina) es lo que se guarda en `primer_recordatorio_at`; por defecto, `ahoraArgentina()` (Decisiones 4).

- [ ] **Step 1: Tests que fallan.** En `tests/avisos-diarios.test.js`:

(a) Reemplazar `proponerCambio` por (el recordatorio solo incluye lo propuesto hace una hora o más, spec 9.2: los tests de siempre proponen dos horas antes, con el reloj de la base)

```js
// Propuesto hace haceMinutos minutos según el reloj de la base (por defecto, dos horas): el recordatorio solo incluye lo
// propuesto hace una hora o más (spec 2026-10-15, 9.2). Devuelve el id del cambio.
const proponerCambio = async (usuarioId, titulo, { haceMinutos = 120 } = {}) => (await query(
  `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id, created_at)
   VALUES ('crear', NULL, ?, ?, NOW() - INTERVAL ? MINUTE)`,
  [JSON.stringify({ titulo }), usuarioId, haceMinutos]
)).insertId;
```

(b) Agregar al final del archivo:

```js
describe('recordatorio de cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 9.2)', () => {
  const asunto = (n) => (n === 1 ? '[RPAD] 1 cambio espera tu auditoría' : `[RPAD] ${n} cambios esperan tu auditoría`);
  const primerRecordatorio = async (id) => (await query(
    "SELECT DATE_FORMAT(primer_recordatorio_at, '%Y-%m-%d %H:%i:%s') AS f FROM cambios_pendientes WHERE id = ?", [id]
  ))[0].f;

  it('solo incluye lo propuesto hace una hora o más, medido con el reloj de la base, y guarda el primer recordatorio', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    const viejo = await proponerCambio(a.id, 'Propuesto hace 61 minutos', { haceMinutos: 61 });
    const reciente = await proponerCambio(a.id, 'Propuesto hace 59 minutos', { haceMinutos: 59 });

    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-16', ahora: '2026-10-16 14:00:00' });

    assert.deepEqual(resultado.enviados.map(e => [e.email, e.cantidadPendientes, e.respaldo]), [[b.email, 1, false]]);
    const [mensaje] = para(await mailpit.esperar(m => m.To.some(t => t.Address === b.email)), b.email);
    assert.equal(mensaje.Subject, asunto(1));
    const html = await mailpit.html(mensaje.ID);
    assert.match(html, /Propuesto hace 61 minutos/);
    assert.doesNotMatch(html, /Propuesto hace 59 minutos/);
    assert.doesNotMatch(html, /Hace Hace/);
    assert.equal(await primerRecordatorio(viejo), '2026-10-16 14:00:00');
    assert.equal(await primerRecordatorio(reciente), null);
  });

  it('se repite cada día hábil mientras sigue en el canal recordatorio, sin pisar la fecha del primero', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    // Un superadmin disponible que no lo propuso: sin firmante titular elegido, el cambio no pasa al canal nota (9.1)
    await crearUsuario('superadmin');
    const id = await proponerCambio(a.id, 'Cambio que sigue pendiente');
    await servicio.enviarCambiosPendientes({ hoy: '2026-10-16', ahora: '2026-10-16 14:00:00' });
    await mailpit.vaciar();
    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-19', ahora: '2026-10-19 14:00:00' });
    assert.ok(resultado.enviados.some(e => e.email === b.email));
    assert.equal(await primerRecordatorio(id), '2026-10-16 14:00:00');
  });

  it('a los editores no les llega mientras haya auditores disponibles; sin ellos, les llega de respaldo y lo dice', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    const editor = await crearUsuario('editor');
    await proponerCambio(a.id, 'Cambio para el respaldo');
    let resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-16' });
    assert.deepEqual(resultado.enviados.map(e => e.email), [b.email]);
    assert.ok(resultado.sinPendientes.includes(editor.username));

    await mailpit.vaciar();
    await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [b.id, '2026-10-19', '2026-10-23']);
    resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-19' });
    assert.deepEqual(resultado.enviados.map(e => [e.email, e.respaldo]), [[editor.email, true]]);
    assert.deepEqual(resultado.deLicencia, [b.username]);
    const [mensaje] = await mailpit.esperar(m => m.To.some(t => t.Address === editor.email));
    assert.match(await mailpit.html(mensaje.ID), /Te llega como respaldo: no hay auditores disponibles\./);
    assert.equal(para(await mailpit.mensajes(), b.email).length, 0);
  });

  it('un cambio en el canal nota no recibe recordatorio', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    const id = await proponerCambio(a.id, 'Cambio pedido por nota');
    // Ya tuvo su primer recordatorio y, sin firmante titular ni superadmin, nadie puede auditarlo como titular (9.1)
    await query("UPDATE cambios_pendientes SET primer_recordatorio_at = '2026-10-16 14:00:00' WHERE id = ?", [id]);
    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-19' });
    assert.equal(resultado.canal_nota, 1);
    assert.deepEqual(resultado.enviados, []);
    assert.equal(para(await mailpit.mensajes(), b.email).length, 0);
  });

  it('el asunto cuenta los cambios de cada persona', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    await proponerCambio(a.id, 'Primer cambio');
    await proponerCambio(a.id, 'Segundo cambio');
    await servicio.enviarCambiosPendientes({ hoy: '2026-10-16' });
    const [mensaje] = await mailpit.esperar(m => m.To.some(t => t.Address === b.email));
    assert.equal(mensaje.Subject, asunto(2));
  });
});
```

En `tests/notificaciones.test.js`, en los dos tests de `describe('email de cambios pendientes', …)` que proponen un alta por la API, agregar enseguida de `assert.equal(alta.status, 201);`:

```js
    // El recordatorio solo incluye lo propuesto hace una hora o más (spec 2026-10-15, 9.2)
    await query('UPDATE cambios_pendientes SET created_at = NOW() - INTERVAL 2 HOUR WHERE id = ?', [alta.body.data.cambio_pendiente_id]);
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/avisos-diarios.test.js`
Expected: FAIL en los 5 tests nuevos (el asunto, `respaldo` y `canal_nota` no existen todavía; el de 59 minutos se envía).

- [ ] **Step 3: Plantilla** (`services/emailTemplates.js`, `cambiosPendientesTemplate`):

(a) Reemplazar

```js
export const cambiosPendientesTemplate = (cambios) => ({
  subject: `[RPAD] Hay ${cambios.length} cambio${cambios.length > 1 ? 's' : ''} pendiente${cambios.length > 1 ? 's' : ''} de aprobacion`,
```

por

```js
// Recordatorio de cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 9.2). respaldo: la persona lo recibe
// porque no hay auditores disponibles
export const cambiosPendientesTemplate = (cambios, { respaldo = false } = {}) => ({
  subject: cambios.length === 1 ? '[RPAD] 1 cambio espera tu auditoría' : `[RPAD] ${cambios.length} cambios esperan tu auditoría`,
```

(b) Reemplazar

```js
                    <p style="margin: 8px 0 0 0; color: ${COLORS.muted}; font-size: 14px;">Por favor, revisa y aprueba o rechaza los siguientes cambios propuestos por otros administradores.</p>
```

por

```js
                    <p style="margin: 8px 0 0 0; color: ${COLORS.muted}; font-size: 14px;">Por favor, revisa y aprueba o rechaza los siguientes cambios propuestos por otros administradores.</p>
                    ${respaldo ? `<p style="margin: 8px 0 0 0; color: ${COLORS.dark}; font-size: 14px;"><strong>Te llega como respaldo: no hay auditores disponibles.</strong></p>` : ''}
```

(c) El texto de antigüedad ya trae "Hace" (`'Hace 2 horas'`): reemplazar

```js
                      <p style="margin: 2px 0 0 0; color: ${COLORS.muted}; font-size: 11px;">Hace ${c.tiempo_pendiente}</p>
```

por

```js
                      <p style="margin: 2px 0 0 0; color: ${COLORS.muted}; font-size: 11px;">${escapeHtml(c.tiempo_pendiente)}</p>
```

- [ ] **Step 4: Servicio** (`services/avisosDiariosService.js`):

(a) Reemplazar el comentario de cabecera y los imports por:

```js
// Avisos diarios por email que no son Notas Digitales: el aviso directo a las áreas (40 días antes) y el recordatorio de
// cambios pendientes a quienes pueden auditarlos. Salen solo en días hábiles y la fecha se recibe como parámetro, para
// poder probarlos con cualquier día.
// Spec: docs/superpowers/specs/2026-10-15-dias-habiles-licencias-auditoria-design.md (secciones 4 y 9.2)
import pool from '../config/database.js';
import { sendEmail, sendEmailToArea } from './emailService.js';
import * as templates from './emailTemplates.js';
import { ahoraArgentina, esDiaHabil, rangoDeAviso } from './notasDigitalesCalendario.js';
import { contextoDeCanal, cambiosConCanal } from './auditoriaService.js';
import { quienesAuditan, entraEnRecordatorio } from './auditoriaReglas.js';
import { emailValido } from './usuariosReglas.js';
```

(b) Reemplazar desde `// Admins activos con email que ya pueden ingresar y aprobar …` (la función `adminsConEmail`) hasta el final del archivo (la función `enviarCambiosPendientes`) por:

```js
// "Hace 45 minutos", "Hace 3 horas" o "Hace 2 dias", como en el email anterior
const tiempoPendiente = (segundos) => {
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `Hace ${minutos} minutos`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} horas`;
  return `Hace ${Math.floor(horas / 24)} dias`;
};

/**
 * Recordatorio de cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 9.2), solo en días hábiles.
 * Incluye los cambios del canal recordatorio (9.1) propuestos hace una hora o más. Cada persona que puede auditarlos
 * (8.2) y está disponible recibe un email con los suyos; si los recibe de respaldo (no hay auditores disponibles), el
 * email lo dice. Quien está de licencia no lo recibe (5.3). La primera vez que un cambio va en un email enviado se
 * guarda primer_recordatorio_at = ahora ('AAAA-MM-DD HH:MM:SS' en hora de Argentina, ahoraArgentina() salvo en los tests
 * con fecha fija: Decisiones del plan 4).
 * { fecha, dia_habil, enviados: [{ admin, email, cantidadPendientes, respaldo }], sinPendientes: [username],
 *   deLicencia: [username], canal_nota, errores: [{ admin, error }] }
 */
export const enviarCambiosPendientes = async ({ hoy, ahora = ahoraArgentina() }) => {
  const resultados = {
    fecha: new Date().toISOString(), dia_habil: esDiaHabil(hoy), enviados: [], sinPendientes: [], deLicencia: [],
    canal_nota: 0, errores: []
  };
  if (!resultados.dia_habil) return resultados;

  const contexto = await contextoDeCanal(hoy);
  const cambios = await cambiosConCanal(hoy, contexto);
  resultados.canal_nota = cambios.filter(c => c.canal === 'nota').length;
  // Los cambios de cada persona que los audita hoy (spec 8.2): un auditor los recibe como tal; un editor, de respaldo
  const porPersona = new Map();
  for (const cambio of cambios.filter(c => entraEnRecordatorio(c))) {
    const { personas, respaldo } = quienesAuditan(contexto.personas, cambio.usuario_id);
    for (const persona of personas) {
      if (!porPersona.has(persona.id)) porPersona.set(persona.id, { respaldo, cambios: [] });
      porPersona.get(persona.id).cambios.push({ ...cambio, tiempo_pendiente: tiempoPendiente(cambio.antiguedad_segundos) });
    }
  }

  for (const persona of contexto.personas) {
    // Durante la licencia no recibe emails del sistema (spec 5.3)
    if (persona.ausente_por_licencia) {
      resultados.deLicencia.push(persona.username);
      continue;
    }
    if (!persona.disponible) continue;
    const destino = porPersona.get(persona.id);
    if (!destino) {
      resultados.sinPendientes.push(persona.username);
      continue;
    }
    if (!emailValido(persona.email)) {
      resultados.errores.push({ admin: persona.username, error: 'No tiene un email válido' });
      continue;
    }
    const { subject, html } = templates.cambiosPendientesTemplate(destino.cambios, { respaldo: destino.respaldo });
    const envio = await sendEmail({ subject, html, to: [persona.email] });
    if (!envio.success) {
      resultados.errores.push({ admin: persona.username, error: envio.error });
      continue;
    }
    resultados.enviados.push({
      admin: persona.username, email: persona.email, cantidadPendientes: destino.cambios.length, respaldo: destino.respaldo
    });
    // Solo la primera vez: después se repite cada día hábil sin pisar la fecha (spec 9.2)
    await pool.query(
      'UPDATE cambios_pendientes SET primer_recordatorio_at = ? WHERE id IN (?) AND primer_recordatorio_at IS NULL',
      [ahora, destino.cambios.map(c => c.id)]
    );
  }
  return resultados;
};
```

(`cambiosPendientesParaAdmin`, que usa la vista previa del email, queda como está: la vista previa muestra el formato del email con los pendientes ajenos, sin aplicar la hora ni el canal.)

- [ ] **Step 5: Correr los tests de la tarea**

Run: `node --test tests/avisos-diarios.test.js tests/auditoria-reglas.test.js tests/notificaciones.test.js`
Expected: PASS (los tests de días hábiles y de licencia de siempre siguen en verde).

- [ ] **Step 6: Suite completa** — `npm test 2>&1 | tail -15`: `ℹ fail 0`, ninguna falla nueva.

- [ ] **Step 7: Commit**

```bash
git add services/emailTemplates.js services/avisosDiariosService.js tests/avisos-diarios.test.js tests/notificaciones.test.js
git commit -m "feat: recordatorio de cambios pendientes a quienes pueden auditarlos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 7: Contenido y PDF de la nota de auditoría

**Files:**
- Modify: `services/notasDigitalesContenido.js`
- Modify: `services/notasDigitalesPdf.js`
- Test: `tests/notas-contenido.test.js` (agregar), `tests/notas-pdf.test.js` (agregar)

**Interfaces:**
- Consumes: `diasHabilesTranscurridos` (Task 2); `RPAD_URL` (`services/emailTemplates.js`); `firmaDeLaNota`, `textoNumero`, `formatoCorto`, `formatoLargo` (ya en el archivo).
- Produces:
  - `construirNotaDeAuditoria({ numero, anio, esPrueba, fecha, nuevos, reiterados, catalogos, firma, config }) → nota`, con la forma común (`tipo: 'auditoria'`, `gestion: null`, `secciones`, `contactos: []`, `anexo: null`, `autorizacion: null`, `justificacion: []`, `lineaCc: ''`) más dos campos nuevos que solo tiene esta nota:
    - `detalles: { titulo: 'Detalle de cada cambio', secciones: [seccion] }`;
    - `apartados: [{ titulo, parrafos: [texto], items: [texto], cierre: [texto] }]`.
  - Cada cambio de `nuevos`/`reiterados` es uno de `auditoriaService.cambiosConCanal` (`id, tipo_cambio, dataset_titulo, datos_nuevos, datos_anteriores, usuario_nombre, usuario_cargo, fecha_propuesta`; los reiterados, además, `solicitado: { numero, anio, fecha, reiteraciones }`); `catalogos` es el de `catalogosParaAuditoria`.
  - Una sección (de las de siempre, de los detalles o de la auditoría) puede traer `proporciones` (porcentajes del ancho de cada columna en el PDF) y una `introduccion` vacía, que no se escribe. Las del detalle traen `partirPalabras: true`: en el PDF, el mínimo de una columna que no es la primera no pasa de su ancho proporcional, así una URL larga se parte dentro de su celda en lugar de achicar la columna de las etiquetas.
  - `renderHtml`, `renderTexto` y `renderPdf` dibujan `detalles` y `apartados` cuando existen; las notas de siempre no los tienen y salen igual que hoy.

- [ ] **Step 1: Tests de contenido que fallan.** En `tests/notas-contenido.test.js`, sumar `construirNotaDeAuditoria` a la línea del `import` de `notasDigitalesContenido.js`, agregar debajo `import { RPAD_URL } from '../services/emailTemplates.js';` y, al final del archivo:

```js
describe('nota de auditoría (spec 2026-10-15-dias-habiles-licencias-auditoria, 10)', () => {
  const REF_AUDITORIA = 'Solicitud de auditoría de cambios en el Registro Permanente de Actualización de Datasets';
  const CATALOGOS = {
    areas: { 10: 'Área Uno', 11: 'Área Dos' }, frecuencias: { 6: 'Anualmente' }, temas: { 1: 'Economía y Finanzas' },
    formatos: { 1: 'CSV', 2: 'XLSX' }
  };
  // Una modificación como la guarda el RPAD: datos_anteriores con las fechas con hora (un Date de mysql2 pasado a JSON)
  const modificacion = (cambios = {}) => ({
    id: 7, tipo_cambio: 'editar', dataset_titulo: 'Presupuesto Municipal', usuario_nombre: 'Persona Editora',
    usuario_cargo: 'Cargo de Prueba', fecha_propuesta: '2026-10-16',
    datos_anteriores: {
      titulo: 'Presupuesto Municipal', area_id: 10, frecuencia_id: 6, formatos: [1, 2], descripcion: 'Igual',
      proxima_actualizacion: '2026-03-15T03:00:00.000Z'
    },
    datos_nuevos: {
      titulo: 'Presupuesto Municipal', area_id: 11, frecuencia_id: 6, formatos: [2, 1], descripcion: 'Igual',
      proxima_actualizacion: '2027-03-15'
    },
    ...cambios
  });
  const ALTA = {
    id: 8, tipo_cambio: 'crear', dataset_titulo: null, usuario_nombre: 'Persona Auditora', usuario_cargo: null,
    fecha_propuesta: '2026-10-07', datos_anteriores: null,
    datos_nuevos: {
      titulo: 'Dataset Nuevo', area_id: 10, tema_principal_id: 1, frecuencia_id: 6, tipo_gestion: 'externa', formatos: [1],
      descripcion: '', url_dataset: 'https://datos.comodoro.gov.ar/dataset/nuevo'
    }
  };
  const BAJA = {
    id: 9, tipo_cambio: 'eliminar', dataset_titulo: 'Dataset Viejo', usuario_nombre: 'Persona Titular', usuario_cargo: 'Director',
    fecha_propuesta: '2026-10-01', datos_nuevos: { eliminado: true },
    datos_anteriores: { titulo: 'Dataset Viejo', area_id: 11, frecuencia_id: 6, tipo_gestion: 'interna', descripcion: null },
    solicitado: { numero: 12, anio: 2026, fecha: '2026-10-09', reiteraciones: 0 }
  };
  const auditoria = (cambios = {}) => construirNotaDeAuditoria({
    numero: 15, anio: 2026, fecha: '2026-10-19', nuevos: [modificacion()], reiterados: [], catalogos: CATALOGOS, config, ...cambios
  });

  it('asunto y encabezado: con cambios nuevos, solo con reiterados y de prueba', () => {
    assert.equal(auditoria().asunto, `Nota Digital N° 15/26 – Ref.: ${REF_AUDITORIA}`);
    assert.equal(auditoria({ nuevos: [], reiterados: [BAJA] }).asunto, `Nota Digital N° 15/26 – Ref.: Reiteración – ${REF_AUDITORIA}`);
    assert.equal(auditoria({ numero: null, anio: null, esPrueba: true }).asunto, `[PRUEBA] Nota Digital N° PRUEBA – Ref.: ${REF_AUDITORIA}`);
    const nota = auditoria();
    assert.deepEqual([nota.tipo, nota.gestion, nota.ref, nota.anexo, nota.lineaCc], ['auditoria', null, REF_AUDITORIA, null, '']);
    assert.equal(nota.destinatario, 'DIRECCIÓN GENERAL DE MODERNIZACIÓN E INVESTIGACIÓN TERRITORIAL');
    assert.equal(nota.remitente, 'DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN');
    assert.equal(nota.fechaLarga, '19 de octubre de 2026');
    assert.deepEqual(nota.justificacion, []);
  });

  it('párrafo inicial, "Qué implica la auditoría" e "Importancia", con los textos de la spec', () => {
    const nota = auditoria();
    assert.equal(nota.parrafoInicial, 'Me dirijo a Ud. a fin de solicitarle la auditoría de los cambios propuestos en el Registro Permanente de Actualización de Datasets (RPAD) que se detallan a continuación, que se encuentran pendientes de verificación. Conforme al procedimiento de doble verificación, cada modificación del registro debe ser revisada y aprobada por una persona distinta de quien la propuso antes de aplicarse.');
    assert.deepEqual(nota.apartados, [
      {
        titulo: 'Qué implica la auditoría:',
        parrafos: ['La auditoría consiste en verificar que:'],
        items: [
          'los datos coincidan con la información remitida por el área responsable;',
          'el enlace al Portal de Datos Abiertos funcione y muestre la versión informada;',
          'las fechas de última y próxima actualización sean coherentes con la frecuencia del conjunto de datos;',
          'el título, la descripción, el área, los temas, los formatos y "qué se solicita" sean correctos.'
        ],
        cierre: [`Cada cambio se aprueba o se rechaza, con un comentario, desde el RPAD: ${RPAD_URL}/perfil.html (sección "Para revisar").`]
      },
      {
        titulo: 'Importancia:',
        parrafos: ['Mientras un cambio no se audita, el conjunto de datos permanece bloqueado para nuevas modificaciones y el registro no refleja su estado real, lo que afecta los avisos y reiteraciones que emite esta Dirección y el cumplimiento de la Ordenanza N° 17.662/23. Por ello, solicito tenga a bien realizar la auditoría a la brevedad.'],
        items: [],
        cierre: []
      }
    ]);
  });

  it('tablas de nuevos y reiterados: tipo, quién propuso, fecha y días hábiles pendiente', () => {
    const nota = auditoria({ nuevos: [modificacion(), ALTA], reiterados: [BAJA] });
    assert.deepEqual(nota.secciones.map(s => [s.clave, s.titulo, s.introduccion]), [
      ['nuevo', 'Cambios pendientes de auditoría', ''],
      ['reiterado', 'Cambios ya solicitados que continúan pendientes', '']
    ]);
    assert.deepEqual(nota.secciones[0].columnas,
      ['Conjunto de datos', 'Tipo de cambio', 'Propuesto por', 'Fecha de la propuesta', 'Días hábiles pendiente']);
    // 16/10 → 19/10: 1 día hábil; 07/10 → 19/10: 8 (el 12/10 es trasladable y cuenta); 01/10 → 19/10: 12
    assert.deepEqual(nota.secciones[0].filas.map(f => f.valores), [
      ['Presupuesto Municipal', 'Modificación', 'Persona Editora, Cargo de Prueba', '16/10/2026', '1'],
      ['Dataset Nuevo', 'Alta', 'Persona Auditora', '07/10/2026', '8']
    ]);
    assert.equal(nota.secciones[1].columnas.at(-1), 'Solicitado en');
    assert.deepEqual(nota.secciones[1].filas[0].valores,
      ['Dataset Viejo', 'Baja', 'Persona Titular, Director', '01/10/2026', '12', 'Nota Digital N° 12/26 (09/10/2026)']);
    assert.deepEqual(auditoria({ nuevos: [], reiterados: [BAJA] }).secciones.map(s => s.clave), ['reiterado']);
  });

  it('"Solicitado en" cuenta las reiteraciones: 1 vez, 2 veces', () => {
    const solicitado = (reiteraciones) => auditoria({ nuevos: [], reiterados: [{ ...BAJA, solicitado: { ...BAJA.solicitado, reiteraciones } }] })
      .secciones[0].filas[0].valores[5];
    assert.equal(solicitado(1), 'Nota Digital N° 12/26 (09/10/2026) – reiterado 1 vez');
    assert.equal(solicitado(2), 'Nota Digital N° 12/26 (09/10/2026) – reiterado 2 veces');
  });

  it('detalle de una modificación: solo los campos que cambian, con las etiquetas del formulario y los nombres de los catálogos', () => {
    const { detalles } = auditoria();
    assert.equal(detalles.titulo, 'Detalle de cada cambio');
    const [detalle] = detalles.secciones;
    assert.equal(detalle.titulo, '1. Presupuesto Municipal – Modificación');
    assert.equal(detalle.introduccion, 'Propuesta por Persona Editora el 16/10/2026. Campos que cambian, con el valor anterior y el nuevo:');
    assert.deepEqual(detalle.columnas, ['Campo', 'Valor anterior', 'Valor nuevo']);
    // Los formatos [1, 2] y [2, 1] son los mismos; la descripción no cambió; la fecha con hora es el 15/03/2026
    assert.deepEqual(detalle.filas.map(f => f.valores), [
      ['Área Responsable', 'Área Uno', 'Área Dos'],
      ['Próxima Actualización', '15/03/2026', '15/03/2027']
    ]);
  });

  it('detalle de un alta (los datos cargados) y de una baja (el dataset que se daría de baja)', () => {
    const [, alta, baja] = auditoria({ nuevos: [modificacion(), ALTA], reiterados: [BAJA] }).detalles.secciones;
    assert.equal(alta.titulo, '2. Dataset Nuevo – Alta');
    assert.equal(alta.introduccion, 'Propuesta por Persona Auditora el 07/10/2026. Datos principales del conjunto de datos propuesto:');
    assert.deepEqual(alta.columnas, ['Campo', 'Valor']);
    assert.deepEqual(alta.filas.map(f => f.valores), [
      ['Título', 'Dataset Nuevo'], ['Área Responsable', 'Área Uno'], ['Tema Principal', 'Economía y Finanzas'],
      ['Frecuencia', 'Anualmente'], ['Tipo de Gestión', 'Externa'], ['Formatos del Dataset', 'CSV'],
      ['URL en Portal', 'https://datos.comodoro.gov.ar/dataset/nuevo']
    ]);
    assert.equal(baja.titulo, '3. Dataset Viejo – Baja');
    assert.equal(baja.introduccion, 'Propuesta por Persona Titular el 01/10/2026. Conjunto de datos que se daría de baja:');
    assert.deepEqual(baja.filas.map(f => f.valores), [
      ['Título', 'Dataset Viejo'], ['Área Responsable', 'Área Dos'], ['Frecuencia', 'Anualmente'], ['Tipo de Gestión', 'Interna']
    ]);
  });

  it('HTML y texto: escapan los datos, listan los ítems con viñeta y llevan el detalle', () => {
    const nota = auditoria({ nuevos: [modificacion({ dataset_titulo: '<b>Presupuesto</b>' })] });
    const html = renderHtml(nota);
    assert.ok(html.includes('&lt;b&gt;Presupuesto&lt;/b&gt;'));
    assert.ok(!html.includes('<b>Presupuesto</b>'));
    assert.ok(html.includes('<li style="margin:0 0 4px;text-align:justify;">los datos coincidan con la información remitida por el área responsable;</li>'));
    assert.ok(html.includes('<b>Detalle de cada cambio</b>'));
    assert.ok(html.includes('<b>Qué implica la auditoría:</b>'));
    assert.ok(html.includes('Nombre de Firma<br>Cargo de Firma'));
    assert.ok(!html.includes('Justificación'));
    const texto = renderTexto(nota);
    assert.ok(texto.includes('- los datos coincidan con la información remitida por el área responsable;'));
    assert.ok(texto.includes('Detalle de cada cambio'));
    assert.ok(texto.includes('    Valor anterior: Área Uno'));
    assert.ok(texto.includes('Importancia:'));
  });

  it('presentada por la persona autorizada: las dos firmas y la leyenda (spec 7.2)', () => {
    const firma = {
      titular: { nombre: 'Firma Titular', cargo: 'Director' }, presentante: { nombre: 'Firma Autorizada', cargo: 'Coordinadora' },
      leyenda: 'Nota presentada por Firma Autorizada, Coordinadora, en nombre de Firma Titular, Director, conforme a la autorización conferida mediante Nota Digital N° 3/26 (licencia del 19/10/2026 al 30/10/2026).'
    };
    const html = renderHtml(auditoria({ firma }));
    assert.ok(html.includes(firma.leyenda));
    assert.ok(html.includes('Firma Autorizada<br>Coordinadora'));
    assert.ok(html.includes('Firma Titular<br>Director'));
  });

  it('las notas de siempre no cambian: sin detalle ni apartados', () => {
    const aviso = nota();
    assert.equal(aviso.detalles, undefined);
    assert.equal(aviso.apartados, undefined);
    assert.ok(!renderHtml(aviso).includes('Detalle de cada cambio'));
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/notas-contenido.test.js`
Expected: FAIL (`construirNotaDeAuditoria is not a function`).

- [ ] **Step 3: `services/notasDigitalesContenido.js`.**

(a) Reemplazar la línea del `import` del calendario por estas dos:

```js
import {
  formatoCorto, formatoLargo, mesYAnio, diasEntre, esFechaIso, textoRangoMeses, diasHabilesTranscurridos
} from './notasDigitalesCalendario.js';
import { RPAD_URL } from './emailTemplates.js';
```

(b) Agregar, después de `construirNotaDeAutorizacion` (antes de `const ETIQUETA_GESTION`):

```js
// =====================================================
// Nota de auditoría de cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 10)
// =====================================================
const REF_AUDITORIA = 'Solicitud de auditoría de cambios en el Registro Permanente de Actualización de Datasets';
const PARRAFO_AUDITORIA = 'Me dirijo a Ud. a fin de solicitarle la auditoría de los cambios propuestos en el Registro Permanente de Actualización de Datasets (RPAD) que se detallan a continuación, que se encuentran pendientes de verificación. Conforme al procedimiento de doble verificación, cada modificación del registro debe ser revisada y aprobada por una persona distinta de quien la propuso antes de aplicarse.';
const SECCIONES_AUDITORIA = { nuevo: 'Cambios pendientes de auditoría', reiterado: 'Cambios ya solicitados que continúan pendientes' };
const COLUMNAS_AUDITORIA = ['Conjunto de datos', 'Tipo de cambio', 'Propuesto por', 'Fecha de la propuesta', 'Días hábiles pendiente'];
// Proporción del ancho de cada columna en el PDF: 5 columnas los nuevos y 6 los reiterados (con "Solicitado en")
const PROPORCIONES_AUDITORIA = { nuevo: [32, 14, 26, 14, 14], reiterado: [22, 12, 18, 14, 12, 22] };
const TIPO_DE_CAMBIO = { crear: 'Alta', editar: 'Modificación', eliminar: 'Baja' };
// Puntos 5 y 6 de la spec 10.3: apartados con título, como "Justificación:" (Decisiones del plan 8)
const QUE_IMPLICA = {
  titulo: 'Qué implica la auditoría:',
  parrafos: ['La auditoría consiste en verificar que:'],
  items: [
    'los datos coincidan con la información remitida por el área responsable;',
    'el enlace al Portal de Datos Abiertos funcione y muestre la versión informada;',
    'las fechas de última y próxima actualización sean coherentes con la frecuencia del conjunto de datos;',
    'el título, la descripción, el área, los temas, los formatos y "qué se solicita" sean correctos.'
  ],
  cierre: [`Cada cambio se aprueba o se rechaza, con un comentario, desde el RPAD: ${RPAD_URL}/perfil.html (sección "Para revisar").`]
};
const IMPORTANCIA = {
  titulo: 'Importancia:',
  parrafos: ['Mientras un cambio no se audita, el conjunto de datos permanece bloqueado para nuevas modificaciones y el registro no refleja su estado real, lo que afecta los avisos y reiteraciones que emite esta Dirección y el cumplimiento de la Ordenanza N° 17.662/23. Por ello, solicito tenga a bien realizar la auditoría a la brevedad.'],
  items: [],
  cierre: []
};

// Campos del dataset con las etiquetas del formulario (public/admin.html), en su orden. catalogo: de qué catálogo sale el
// nombre de un id
const CAMPOS_DEL_DATASET = [
  { campo: 'titulo', etiqueta: 'Título' },
  { campo: 'area_id', etiqueta: 'Área Responsable', catalogo: 'areas' },
  { campo: 'descripcion', etiqueta: 'Descripción' },
  { campo: 'tema_principal_id', etiqueta: 'Tema Principal', catalogo: 'temas' },
  { campo: 'tema_secundario_id', etiqueta: 'Tema Secundario', catalogo: 'temas' },
  { campo: 'frecuencia_id', etiqueta: 'Frecuencia', catalogo: 'frecuencias' },
  { campo: 'tipo_gestion', etiqueta: 'Tipo de Gestión' },
  { campo: 'formatos', etiqueta: 'Formatos del Dataset', catalogo: 'formatos' },
  { campo: 'ultima_actualizacion', etiqueta: 'Última Actualización' },
  { campo: 'proxima_actualizacion', etiqueta: 'Próxima Actualización' },
  { campo: 'url_dataset', etiqueta: 'URL en Portal' },
  { campo: 'que_se_solicita', etiqueta: 'Qué se solicita' },
  { campo: 'observaciones', etiqueta: 'Observaciones' }
];
const CAMPOS_DE_FECHA = ['ultima_actualizacion', 'proxima_actualizacion'];
const SIN_DATO = 'Sin dato';
const GESTION_DEL_DATASET = { interna: 'Interna', externa: 'Externa' };

const vacio = (valor) => valor === null || valor === undefined || String(valor).trim() === '' || (Array.isArray(valor) && valor.length === 0);

// Para comparar el valor anterior con el nuevo: las fechas por el día (al proponer un cambio, las fechas guardadas llegan
// con hora, "2026-03-15T03:00:00.000Z": el día es el de los primeros 10 caracteres con Node en hora argentina o en UTC) y
// los formatos sin importar el orden
const valorComparable = (campo, valor) => {
  if (vacio(valor)) return '';
  if (campo === 'formatos') return (Array.isArray(valor) ? valor : [valor]).map(Number).sort((a, b) => a - b).join(',');
  if (CAMPOS_DE_FECHA.includes(campo)) return String(valor).slice(0, 10);
  return String(valor);
};

// Un valor del dataset como se lee en la nota: el nombre de un id de catálogo, la fecha dd/mm/aaaa, la gestión con
// mayúscula; "Sin dato" si está vacío
const valorDelCampo = ({ campo, catalogo }, valor, catalogos) => {
  if (vacio(valor)) return SIN_DATO;
  if (campo === 'formatos') return (Array.isArray(valor) ? valor : [valor]).map(id => catalogos.formatos?.[id] ?? String(id)).join(', ');
  if (catalogo) return catalogos[catalogo]?.[valor] ?? String(valor);
  if (campo === 'tipo_gestion') return GESTION_DEL_DATASET[valor] ?? String(valor);
  if (CAMPOS_DE_FECHA.includes(campo) && esFechaIso(String(valor).slice(0, 10))) return formatoCorto(String(valor).slice(0, 10));
  return String(valor);
};

const tituloDelCambio = (cambio) =>
  cambio.dataset_titulo ?? cambio.datos_nuevos?.titulo ?? cambio.datos_anteriores?.titulo ?? 'Conjunto de datos sin título';
const filaSimple = (valores) => ({ valores, url: null, antecedente: null, informadoAnterior: null });

// "Nota Digital N° 12/26 (09/10/2026)" y, si ya se reiteró, " – reiterado N veces" (Decisiones del plan 5)
const textoSolicitado = (s) => `Nota Digital N° ${textoNumero(s)} (${formatoCorto(s.fecha)})`
  + `${s.reiteraciones > 0 ? ` – reiterado ${cantidad(s.reiteraciones, 'vez', 'veces')}` : ''}`;

// Fila de las tablas de nuevos y reiterados (spec 10.3, punto 3)
const filaDeCambio = (cambio, fecha, conSolicitud) => {
  const proponente = cambio.usuario_cargo ? `${cambio.usuario_nombre}, ${cambio.usuario_cargo}` : cambio.usuario_nombre;
  const valores = [
    tituloDelCambio(cambio), TIPO_DE_CAMBIO[cambio.tipo_cambio] ?? cambio.tipo_cambio, proponente,
    formatoCorto(cambio.fecha_propuesta), String(diasHabilesTranscurridos(cambio.fecha_propuesta, fecha))
  ];
  if (conSolicitud) valores.push(textoSolicitado(cambio.solicitado));
  return filaSimple(valores);
};

// Detalle de un cambio (spec 10.3, punto 4): de una modificación, los campos que cambian con el valor anterior y el nuevo;
// de un alta, los datos del dataset propuesto; de una baja, el dataset que se daría de baja
const detalleDelCambio = (cambio, numero, catalogos) => {
  const titulo = `${numero}. ${tituloDelCambio(cambio)} – ${TIPO_DE_CAMBIO[cambio.tipo_cambio] ?? cambio.tipo_cambio}`;
  const propuesta = `Propuesta por ${cambio.usuario_nombre} el ${formatoCorto(cambio.fecha_propuesta)}.`;
  if (cambio.tipo_cambio === 'editar') {
    const nuevos = cambio.datos_nuevos ?? {};
    const anteriores = cambio.datos_anteriores ?? {};
    const filas = CAMPOS_DEL_DATASET
      .filter(c => Object.hasOwn(nuevos, c.campo) && valorComparable(c.campo, anteriores[c.campo]) !== valorComparable(c.campo, nuevos[c.campo]))
      .map(c => filaSimple([c.etiqueta, valorDelCampo(c, anteriores[c.campo], catalogos), valorDelCampo(c, nuevos[c.campo], catalogos)]));
    return {
      titulo, introduccion: `${propuesta} Campos que cambian, con el valor anterior y el nuevo:`,
      columnas: ['Campo', 'Valor anterior', 'Valor nuevo'], proporciones: [24, 38, 38], partirPalabras: true,
      filas: filas.length ? filas : [filaSimple(['—', 'Sin diferencias registradas', '—'])]
    };
  }
  const datos = (cambio.tipo_cambio === 'crear' ? cambio.datos_nuevos : cambio.datos_anteriores) ?? {};
  const filas = CAMPOS_DEL_DATASET
    .filter(c => !vacio(datos[c.campo]))
    .map(c => filaSimple([c.etiqueta, valorDelCampo(c, datos[c.campo], catalogos)]));
  return {
    titulo,
    introduccion: cambio.tipo_cambio === 'crear'
      ? `${propuesta} Datos principales del conjunto de datos propuesto:`
      : `${propuesta} Conjunto de datos que se daría de baja:`,
    columnas: ['Campo', 'Valor'], proporciones: [28, 72], partirPalabras: true,
    filas: filas.length ? filas : [filaSimple(['Título', tituloDelCambio(cambio)])]
  };
};

/**
 * Nota de auditoría (spec 10): pide a la Dirección General que audite los cambios pendientes. nuevos y reiterados: cambios
 * de auditoriaService (los reiterados con solicitado). catalogos: { areas, frecuencias, temas, formatos } (id → nombre).
 * firma: la de firmaParaFecha (titular, o las dos firmas con la leyenda); sin ella, la de la configuración.
 * Tiene la misma forma que las demás notas, más detalles y apartados.
 */
export const construirNotaDeAuditoria = ({
  numero = null, anio = null, esPrueba = false, fecha, nuevos = [], reiterados = [], catalogos = {}, firma = null, config = null
}) => {
  const numeroTexto = textoNumero({ numero, anio, esPrueba });
  const ref = nuevos.length ? REF_AUDITORIA : `Reiteración – ${REF_AUDITORIA}`;
  const secciones = [['nuevo', nuevos], ['reiterado', reiterados]]
    .filter(([, lista]) => lista.length > 0)
    .map(([clave, lista]) => ({
      clave,
      titulo: SECCIONES_AUDITORIA[clave],
      introduccion: '',
      columnas: clave === 'reiterado' ? [...COLUMNAS_AUDITORIA, 'Solicitado en'] : COLUMNAS_AUDITORIA,
      proporciones: PROPORCIONES_AUDITORIA[clave],
      filas: lista.map(cambio => filaDeCambio(cambio, fecha, clave === 'reiterado'))
    }));
  return {
    tipo: 'auditoria',
    gestion: null,
    esPrueba,
    fecha,
    numeroTexto,
    asunto: `${esPrueba ? '[PRUEBA] ' : ''}Nota Digital N° ${numeroTexto} – Ref.: ${ref}`,
    ref,
    destinatario: DESTINATARIO,
    avisoAdjunto: AVISO_ADJUNTO.reiteracion,
    parrafoInicial: PARRAFO_AUDITORIA,
    secciones,
    detalles: {
      titulo: 'Detalle de cada cambio',
      secciones: [...nuevos, ...reiterados].map((cambio, i) => detalleDelCambio(cambio, i + 1, catalogos))
    },
    contactos: [],
    anexo: null,
    autorizacion: null,
    apartados: [QUE_IMPLICA, IMPORTANCIA],
    justificacion: [],
    remitente: REMITENTE,
    fechaLarga: formatoLargo(fecha),
    firma: firmaDeLaNota(firma, config),
    lineaCc: ''
  };
};
```

(c) En `renderHtml`:
- reemplazar

```js
  const secciones = nota.secciones
    .map(s => `<p style="margin:16px 0 6px;"><b>${escapeHtml(s.titulo)}</b></p>${parrafo(s.introduccion)}${tabla(s)}`)
    .join('\n');
```

por

```js
  // (una sección sin introducción, como las de la nota de auditoría, no la escribe)
  const secciones = nota.secciones
    .map(s => `<p style="margin:16px 0 6px;"><b>${escapeHtml(s.titulo)}</b></p>${s.introduccion ? parrafo(s.introduccion) : ''}${tabla(s)}`)
    .join('\n');
  // Nota de auditoría (spec 2026-10-15, 10.3): el detalle de cada cambio y los apartados con viñetas
  const detalles = nota.detalles?.secciones.length
    ? `<p style="margin:16px 0 6px;"><b>${escapeHtml(nota.detalles.titulo)}</b></p>\n${nota.detalles.secciones
      .map(s => `<p style="margin:12px 0 6px;"><b>${escapeHtml(s.titulo)}</b></p>${s.introduccion ? parrafo(s.introduccion) : ''}${tabla(s)}`)
      .join('\n')}`
    : '';
  const apartados = (nota.apartados ?? []).map(a => `<p style="margin:16px 0 6px;"><b>${escapeHtml(a.titulo)}</b></p>
${a.parrafos.map(parrafo).join('\n')}${a.items.length ? `<ul style="margin:0 0 12px;padding-left:24px;">${a.items.map(i => `<li style="margin:0 0 4px;text-align:justify;">${escapeHtml(i)}</li>`).join('')}</ul>` : ''}${(a.cierre ?? []).map(parrafo).join('\n')}`).join('\n');
```

- y en la plantilla que devuelve, reemplazar la línea `${contactos}${autorizacion}` por `${detalles}${contactos}${autorizacion}${apartados}` (para las notas de siempre `detalles` y `apartados` son `''`: el HTML no cambia).

(d) Reemplazar `renderTexto` entero por:

```js
// Una sección con tabla en texto plano: el título, la introducción (si tiene) y cada fila con sus columnas
const lineasDeSeccion = (seccion) => {
  const lineas = [seccion.titulo, ...(seccion.introduccion ? [seccion.introduccion] : []), ''];
  for (const fila of seccion.filas) {
    lineas.push(`- ${fila.valores[0]}${fila.url ? ` (${fila.url})` : ''}`);
    // La segunda parte de la última celda ("Informado en" de las reiteraciones) va en la misma línea
    seccion.columnas.slice(1).forEach((columna, i) => {
      const segunda = i + 1 === seccion.columnas.length - 1 && fila.informadoAnterior ? ` ${fila.informadoAnterior}` : '';
      lineas.push(`    ${columna}: ${fila.valores[i + 1]}${segunda}`);
    });
    if (fila.antecedente) lineas.push(`    ${fila.antecedente}`);
  }
  lineas.push('');
  return lineas;
};

export const renderTexto = (nota) => {
  const lineas = [nota.avisoAdjunto, '', `REF.: "${nota.ref}"`, `Nota Digital N° ${nota.numeroTexto}`, '', nota.destinatario, '', nota.parrafoInicial, ''];
  for (const seccion of nota.secciones) lineas.push(...lineasDeSeccion(seccion));
  // Nota de auditoría (spec 2026-10-15, 10.3): el detalle de cada cambio
  if (nota.detalles?.secciones.length) {
    lineas.push(nota.detalles.titulo, '');
    for (const seccion of nota.detalles.secciones) lineas.push(...lineasDeSeccion(seccion));
  }
  if (nota.contactos.length) {
    lineas.push('Datos de contacto de las áreas responsables');
    for (const contacto of nota.contactos) lineas.push(contacto.nombre, ...contacto.lineas.map(l => `    ${l}`));
    lineas.push('');
  }
  if (nota.autorizacion) lineas.push(nota.autorizacion, '');
  for (const apartado of nota.apartados ?? []) {
    lineas.push(apartado.titulo, ...apartado.parrafos, ...apartado.items.map(i => `- ${i}`), ...(apartado.cierre ?? []), '');
  }
  lineas.push(...(nota.anexo ? [nota.anexo, ''] : []), ...(nota.justificacion.length ? ['Justificación:', ...nota.justificacion, ''] : []),
    `${nota.remitente}, ${nota.fechaLarga}.`, '', ...lineasFirma(nota.firma), '', nota.lineaCc);
  return lineas.join('\n');
};
```

(Para las notas de siempre el texto es idéntico al de hoy: cada sección sigue siendo título, introducción, línea vacía, filas y línea vacía.)

- [ ] **Step 4: Tests de contenido en verde**

Run: `node --test tests/notas-contenido.test.js`
Expected: PASS (los tests de siempre también).

- [ ] **Step 5: Tests del PDF que fallan.** En `tests/notas-pdf.test.js`, sumar `construirNotaDeAuditoria` a la línea del `import` de contenido y agregar al final del archivo:

```js
describe('renderPdf: nota de auditoría (spec 2026-10-15-dias-habiles-licencias-auditoria, 10.3)', () => {
  const LARGA = `Descripción ${'muy '.repeat(150)}larga del conjunto de datos, que se transcribe completa.`;
  const cambio = (i) => ({
    id: i, tipo_cambio: 'editar', dataset_titulo: `Dataset ${i} auditado`, usuario_nombre: 'Persona Editora',
    usuario_cargo: 'Cargo de Prueba', fecha_propuesta: '2026-10-16',
    datos_anteriores: { descripcion: 'Antes' }, datos_nuevos: { descripcion: LARGA }
  });
  const auditoria = (cantidad, cambios = {}) => construirNotaDeAuditoria({
    numero: 15, anio: 2026, fecha: '2026-10-19', nuevos: Array.from({ length: cantidad }, (_, i) => cambio(i + 1)), reiterados: [],
    catalogos: { areas: {}, frecuencias: {}, temas: {}, formatos: {} }, config, ...cambios
  });
  // El texto de todas las hojas, en el orden en que se dibujó (cada celda es una sola escritura: su texto queda junto)
  const todo = (pdf) => lineasPorHoja(pdf).flat().join(' ').replace(/\s+/g, ' ');
  const incluye = (pdf, esperado) => todo(pdf).includes(esperado.replace(/\s+/g, ' '));

  it('lleva las tablas, el detalle con los textos largos completos y los apartados con viñetas', async () => {
    const pdf = await renderPdf(auditoria(2), { firmaImagen: PNG });
    for (const esperado of ['Cambios pendientes de auditoría', 'Detalle de cada cambio', '1. Dataset 1 auditado – Modificación',
      '2. Dataset 2 auditado – Modificación', LARGA, 'Qué implica la auditoría:',
      '• los datos coincidan con la información remitida por el área responsable;', 'Importancia:',
      '/perfil.html (sección "Para revisar").', 'DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN']) {
      assert.ok(incluye(pdf, esperado), esperado.slice(0, 60));
    }
    assert.ok(!incluye(pdf, 'Justificación:'));
  });

  it('con muchos cambios ocupa varias hojas y el cierre (remitente y firma) queda entero en la última', async () => {
    const pdf = await renderPdf(auditoria(12));
    const hojas = lineasPorHoja(pdf);
    assert.ok(hojas.length > 1);
    const ultima = hojas.at(-1).join(' ');
    assert.ok(ultima.includes('DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN'));
    assert.ok(ultima.includes('Nombre') && ultima.includes('Cargo'));
  });

  it('presentada por la persona autorizada: las dos imágenes y la leyenda', async () => {
    const firma = {
      titular: { nombre: 'Firma Titular', cargo: 'Director', imagen: PNG },
      presentante: { nombre: 'Firma Autorizada', cargo: 'Coordinadora', imagen: PNG },
      leyenda: 'Nota presentada por Firma Autorizada, Coordinadora, en nombre de Firma Titular, Director, conforme a la autorización conferida mediante Nota Digital N° 3/26 (licencia del 19/10/2026 al 30/10/2026).'
    };
    const pdf = await renderPdf(auditoria(1, { firma }), { firmaImagen: PNG, presentanteImagen: PNG });
    const ultima = lineasPorHoja(pdf).at(-1).join(' ');
    assert.ok(ultima.includes('Firma Autorizada') && ultima.includes('Firma Titular'));
    assert.ok(incluye(pdf, firma.leyenda));
    assert.equal(imagenesPorHoja(pdf).at(-1).length, 2);
  });
});
```

- [ ] **Step 6: Correr y ver que fallan**

Run: `node --test tests/notas-pdf.test.js`
Expected: FAIL en los 3 nuevos (sin `detalles` ni `apartados` en el PDF; una tabla de 5 columnas no tiene proporciones).

- [ ] **Step 7: `services/notasDigitalesPdf.js`.**

(a) Después de `const AIRE_ANEXO = 6;`, agregar:

```js
// Ítems con viñeta de los apartados de la nota de auditoría: la viñeta, a SANGRIA_ITEM del margen; el texto, SANGRIA_VINETA
// más adentro, con sus renglones alineados (sangría francesa). En puntos.
const SANGRIA_ITEM = 14;
const SANGRIA_VINETA = 10;
```

(b) En `calcularAnchos`, reemplazar

```js
  const proporciones = (seccion.filas.some(f => f.informadoAnterior) ? PROPORCIONES_CON_SEGUNDA : PROPORCIONES)[seccion.columnas.length];
```

por

```js
  // Una sección puede traer sus proporciones (las tablas de la nota de auditoría y de su detalle)
  const proporciones = seccion.proporciones
    ?? (seccion.filas.some(f => f.informadoAnterior) ? PROPORCIONES_CON_SEGUNDA : PROPORCIONES)[seccion.columnas.length];
```

y, en la misma función, reemplazar

```js
    return Math.min(largo, i === 0 ? MINIMO_TITULO : Infinity) + 2 * RELLENO + 1;
```

por

```js
    // (en el detalle de la nota de auditoría una URL larga se parte dentro de su celda en lugar de achicar la de las etiquetas)
    return Math.min(largo, i === 0 ? MINIMO_TITULO : (seccion.partirPalabras ? base[i] - 2 * RELLENO - 1 : Infinity)) + 2 * RELLENO + 1;
```

(c) En `renderPdf`, reemplazar el bucle de las secciones

```js
    for (const seccion of nota.secciones) {
      // El título, la introducción, el encabezado de la tabla y su primera fila viajan juntos (10 pt: separaciones)
      const tabla = prepararTabla(doc, seccion, ancho);
      asegurarEspacio(altoTexto(seccion.titulo) + altoTexto(seccion.introduccion) + 10 + tabla.altoInicio);
      parrafo(seccion.titulo, { fuente: NEGRITA, align: 'left', espacio: 0.3 });
      parrafo(seccion.introduccion, { espacio: 0.4 });
      tabla.dibujar();
      doc.moveDown(0.8);
    }
```

por

```js
    // El título, la introducción (si tiene), el encabezado de la tabla y su primera fila viajan juntos (10 pt: separaciones)
    const altoInicioDe = (seccion, tabla) => altoTexto(seccion.titulo)
      + (seccion.introduccion ? altoTexto(seccion.introduccion) : 0) + 10 + tabla.altoInicio;
    const dibujarSeccion = (seccion) => {
      const tabla = prepararTabla(doc, seccion, ancho);
      asegurarEspacio(altoInicioDe(seccion, tabla));
      parrafo(seccion.titulo, { fuente: NEGRITA, align: 'left', espacio: 0.3 });
      if (seccion.introduccion) parrafo(seccion.introduccion, { espacio: 0.4 });
      tabla.dibujar();
      doc.moveDown(0.8);
    };
    nota.secciones.forEach(dibujarSeccion);

    // Nota de auditoría (spec 2026-10-15-dias-habiles-licencias-auditoria, 10.3): el detalle de cada cambio; el título
    // viaja con el primero
    if (nota.detalles?.secciones.length) {
      const primera = nota.detalles.secciones[0];
      asegurarEspacio(altoTexto(nota.detalles.titulo, 12, NEGRITA) + altoEspacio(0.4, 12, NEGRITA)
        + altoInicioDe(primera, prepararTabla(doc, primera, ancho)));
      parrafo(nota.detalles.titulo, { fuente: NEGRITA, align: 'left', espacio: 0.4 });
      nota.detalles.secciones.forEach(dibujarSeccion);
    }
```

(d) Agregar, justo antes del bloque `if (nota.anexo) {` (y de su comentario `// La línea del anexo (solo avisos) …`):

```js
    // Apartados de la nota de auditoría (spec 10.3): título, párrafos, ítems con viñeta y párrafos de cierre. El título
    // viaja con su primer renglón
    for (const apartado of nota.apartados ?? []) {
      asegurarEspacio(ALTO_TITULO_JUSTIFICACION + altoTexto(apartado.parrafos[0] ?? apartado.items[0] ?? ''));
      parrafo(apartado.titulo, { fuente: NEGRITA, align: 'left', espacio: 0.3 });
      apartado.parrafos.forEach(texto => parrafo(texto));
      apartado.items.forEach((texto) => {
        const anchoItem = ancho - SANGRIA_ITEM - SANGRIA_VINETA;
        asegurarEspacio(altoTexto(texto, 12, NORMAL, anchoItem));
        const y = doc.y;
        doc.font(NORMAL).fontSize(12).text('•', MARGENES.left + SANGRIA_ITEM, y, { lineBreak: false });
        doc.text(texto, MARGENES.left + SANGRIA_ITEM + SANGRIA_VINETA, y, { width: anchoItem, align: 'left' });
        doc.moveDown(0.2);
      });
      if (apartado.items.length) doc.moveDown(0.4);
      (apartado.cierre ?? []).forEach(texto => parrafo(texto));
    }
```

(La viñeta `•` está en WinAnsi: Helvetica la escribe. La nota de auditoría no tiene justificación: el cierre se reserva solo, como en la nota de autorización.)

- [ ] **Step 8: Tests del PDF y de contenido en verde**

Run: `node --test tests/notas-pdf.test.js tests/notas-contenido.test.js tests/notas-anexo.test.js`
Expected: PASS (los de siempre también: las notas de siempre no tienen `proporciones`, `detalles` ni `apartados`, y todas sus secciones tienen introducción).

- [ ] **Step 9: Suite completa** — `npm test 2>&1 | tail -15`: `ℹ fail 0`, ninguna falla nueva.

- [ ] **Step 10: Commit**

```bash
git add services/notasDigitalesContenido.js services/notasDigitalesPdf.js tests/notas-contenido.test.js tests/notas-pdf.test.js
git commit -m "feat: contenido y PDF de la nota de auditoría

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 8: La nota de auditoría en la corrida diaria

**Files:**
- Modify: `services/notasDigitales.js`
- Test: `tests/notas-auditoria.test.js` (nuevo)

**Interfaces:**
- Consumes: `construirNotaDeAuditoria` (Task 7); `contextoDeCanal`, `seleccionarParaAuditoria`, `catalogosParaAuditoria` (Task 3); `firmaParaFecha` y el flujo de autorización de la entrega 2.
- Produces:
  - `generarNota({ …, auditoria })`: con `tipo: 'auditoria'` y `auditoria: { nuevos, reiterados, catalogos }` arma la nota de auditoría (sin gestión ni datasets), la numera con la numeración del libro y, salvo en las pruebas, registra cada cambio en `notas_digitales_cambios` con su sección (`nuevo`/`reiterado`).
  - Destinatarios de la nota de auditoría: Para `para_auditoria`, CC `cc_auditoria`, CCO el `cco` general (spec 10.1).
  - Paso 4 de la corrida diaria, después de avisos y reiteraciones, con el mismo bloqueo e interruptor: una sola nota de auditoría por día (Decisiones 12). El resumen suma `{ id, tipo: 'auditoria', gestion: null, datasets: 0, cambios }` en `generadas`; un error del paso queda como `{ tipo: 'auditoria' }`.

- [ ] **Step 1: Tests que fallan.** Crear `tests/notas-auditoria.test.js`:

```js
// La nota de auditoría en la corrida diaria de Notas Digitales (spec 2026-10-15-dias-habiles-licencias-auditoria, 9 y 10),
// con los ejemplos de la spec 9.4 como fechas fijas, sobre una base de prueba + Mailpit
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query, mailpit } from './helpers.js';
import { crearDataset, limpiarBase, configurarNotas, conFallaSimulada } from './notas-fixtures.js';
import { pngRgba } from './firma-fixtures.js';
import { lineasPorHoja } from './pdf-lector.js';

const FIRMA = pngRgba({ ancho: 40, alto: 20 });
const REF = 'Solicitud de auditoría de cambios en el Registro Permanente de Actualización de Datasets';
let base, motor, dbReal, titular, auditor, editor;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_notas_auditoria');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  motor = await import('../services/notasDigitales.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

// Cada persona con su firma cargada: "Firma {rol}" / "Cargo de firma {rol}"
const crearUsuario = async (rol) => {
  const username = `t_${rol}_${crypto.randomBytes(3).toString('hex')}`;
  const r = await query(
    "INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo, cargo) VALUES (?, 'x', ?, ?, ?, 1, ?)",
    [username, `Persona ${rol}`, `${username}@rpad.test`, rol, `Cargo ${rol}`]
  );
  await query("INSERT INTO usuarios_firmas (usuario_id, nombre, cargo, imagen, mime) VALUES (?, ?, ?, ?, 'image/png')",
    [r.insertId, `Firma ${rol}`, `Cargo de firma ${rol}`, FIRMA]);
  return { id: r.insertId, email: `${username}@rpad.test` };
};

// El firmante titular (superadmin), otro auditor (admin) y un editor
beforeEach(async () => {
  process.env.EMAIL_SOLO_A = '';
  await limpiarBase();
  await configurarNotas({ para_auditoria: 'auditoria@rpad.test', cc_auditoria: 'cc-auditoria@rpad.test' });
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios_firmas');
  await query('DELETE FROM cambios_pendientes');
  await query('DELETE FROM usuarios');
  titular = await crearUsuario('superadmin');
  auditor = await crearUsuario('admin');
  editor = await crearUsuario('editor');
  await query('UPDATE notas_digitales_config SET firmante_usuario_id = ?', [titular.id]);
  await mailpit.vaciar();
});

// Instante de una fecha y hora de Argentina (UTC-3), en segundos
const instante = (texto) => Date.parse(`${texto.replace(' ', 'T')}-03:00`) / 1000;
// Un alta propuesta el viernes 16/10/2026 a las 10:00, con su primer recordatorio ese día a las 14:00
const proponer = async (usuario, { titulo = 'Dataset nuevo auditado', creado = '2026-10-16 10:00:00', primer = '2026-10-16 14:00:00' } = {}) => (await query(
  `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id, created_at, primer_recordatorio_at)
   VALUES ('crear', NULL, ?, ?, FROM_UNIXTIME(?), ?)`,
  [JSON.stringify({ titulo, tipo_gestion: 'interna' }), usuario.id, instante(creado), primer]
)).insertId;
const licencia = (usuario, desde, hasta, autorizado = null) => query(
  'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, autorizado_id, autorizado_at) VALUES (?, ?, ?, ?, ?)',
  [usuario.id, desde, hasta, autorizado?.id ?? null, autorizado ? '2026-10-15 10:00:00' : null]
);
const correr = (hoy) => motor.ejecutarNotasDigitales({ hoy });
const auditorias = () => query(
  `SELECT id, numero, anio, gestion, estado, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, asunto, para, cc, cco, html, pdf,
          firmante_id, presentada_por_id
   FROM notas_digitales WHERE tipo = 'auditoria' AND es_prueba = 0 ORDER BY id`
);
const incluidos = (notaId) => query('SELECT cambio_id, seccion FROM notas_digitales_cambios WHERE nota_id = ? ORDER BY cambio_id', [notaId]);
const libro = () => query('SELECT numero, tipo FROM notas_digitales WHERE es_prueba = 0 ORDER BY id');

describe('ejemplo 9.4: propone el titular el viernes y hay otro auditor disponible', () => {
  it('el lunes sale la nota con el cambio nuevo, a los destinatarios de auditoría, firmada por el titular', async () => {
    const id = await proponer(titular);
    await correr('2026-10-19');
    const [nota, ...otras] = await auditorias();
    assert.equal(otras.length, 0);
    assert.equal(nota.asunto, `Nota Digital N° ${nota.numero}/26 – Ref.: ${REF}`);
    assert.deepEqual([nota.gestion, nota.estado, nota.fecha], [null, 'enviada', '2026-10-19']);
    assert.deepEqual([nota.para, nota.cc, nota.cco], ['auditoria@rpad.test', 'cc-auditoria@rpad.test', 'respaldo@rpad.test']);
    assert.deepEqual([nota.firmante_id, nota.presentada_por_id], [titular.id, null]);
    assert.deepEqual(await incluidos(nota.id), [{ cambio_id: id, seccion: 'nuevo' }]);
    assert.ok(nota.html.includes('Dataset nuevo auditado'));
    assert.ok(nota.html.includes('Persona superadmin, Cargo superadmin'));
    assert.ok(nota.html.includes('Firma superadmin<br>Cargo de firma superadmin'));
    assert.ok(lineasPorHoja(nota.pdf).flat().join(' ').includes('Detalle de cada cambio'));
    const [mensaje] = await mailpit.esperar(m => m.Subject === nota.asunto);
    assert.deepEqual(mensaje.To.map(t => t.Address), ['auditoria@rpad.test']);
    assert.deepEqual(mensaje.Cc.map(t => t.Address), ['cc-auditoria@rpad.test']);
  });

  it('no se repite en los días siguientes; a los 5 días hábiles se reitera citando la primera nota, y cuenta las reiteraciones', async () => {
    const id = await proponer(titular);
    for (const dia of ['2026-10-19', '2026-10-20', '2026-10-23']) await correr(dia);
    assert.equal((await auditorias()).length, 1);
    await correr('2026-10-26');
    const [primera, reiteracion] = await auditorias();
    assert.equal(reiteracion.asunto, `Nota Digital N° ${reiteracion.numero}/26 – Ref.: Reiteración – ${REF}`);
    assert.deepEqual(await incluidos(reiteracion.id), [{ cambio_id: id, seccion: 'reiterado' }]);
    assert.ok(reiteracion.html.includes(`Nota Digital N° ${primera.numero}/26 (19/10/2026)`));
    assert.ok(!reiteracion.html.includes('– reiterado'));
    await correr('2026-11-02');
    const segunda = (await auditorias())[2];
    assert.ok(segunda.html.includes(`Nota Digital N° ${primera.numero}/26 (19/10/2026) – reiterado 1 vez`));
  });
});

describe('canal de cada cambio en la corrida (spec 9.1 y 9.4)', () => {
  it('propone un editor y el titular está disponible: nunca sale nota', async () => {
    await proponer(editor);
    await correr('2026-10-19');
    await correr('2026-10-26');
    assert.equal((await auditorias()).length, 0);
  });

  it('sin el primer recordatorio en un día hábil anterior no va: ni sin recordatorio ni con el de hoy', async () => {
    await proponer(titular, { primer: null });
    await proponer(titular, { titulo: 'Recordado hoy', primer: '2026-10-19 14:00:00' });
    await correr('2026-10-19');
    assert.equal((await auditorias()).length, 0);
  });

  it('propone el titular y el único otro auditor está de licencia: respaldo, no sale nota', async () => {
    await proponer(titular);
    await licencia(auditor, '2026-10-19', '2026-10-23');
    await correr('2026-10-19');
    assert.equal((await auditorias()).length, 0);
  });

  it('el titular de licencia sin autorizado: no sale nota; el primer día hábil posterior, sí', async () => {
    const id = await proponer(titular);
    await licencia(titular, '2026-10-19', '2026-10-23');
    await correr('2026-10-19');
    assert.equal((await auditorias()).length, 0);
    await correr('2026-10-26');
    const [nota] = await auditorias();
    assert.equal(nota.fecha, '2026-10-26');
    assert.deepEqual(await incluidos(nota.id), [{ cambio_id: id, seccion: 'nuevo' }]);
  });

  it('el titular de licencia con autorizado, propone un editor: sale después de la nota de autorización, con las dos firmas', async () => {
    await proponer(editor);
    await licencia(titular, '2026-10-19', '2026-10-30', auditor);
    await correr('2026-10-19');
    const notas = await libro();
    assert.deepEqual(notas.map(n => n.tipo), ['autorizacion', 'auditoria']);
    assert.equal(notas[1].numero, notas[0].numero + 1);
    const [nota] = await auditorias();
    assert.deepEqual([nota.firmante_id, nota.presentada_por_id], [titular.id, auditor.id]);
    assert.ok(nota.html.includes(`Nota presentada por Firma admin, Cargo de firma admin, en nombre de Firma superadmin, Cargo de firma superadmin, conforme a la autorización conferida mediante Nota Digital N° ${notas[0].numero}/26 (licencia del 19/10/2026 al 30/10/2026).`));
  });

  it('sin firmante titular, la condición 2 mira al superadmin y firma la configuración de Correos', async () => {
    await query('UPDATE notas_digitales_config SET firmante_usuario_id = NULL');
    await proponer(titular);
    await correr('2026-10-19');
    const [nota] = await auditorias();
    assert.equal(nota.firmante_id, null);
    assert.ok(nota.html.includes('Firma de Prueba<br>Cargo de Prueba'));
  });
});

describe('una por día, numeración del libro, reintentos, autorización e interruptor', () => {
  it('la numeración es la del libro: el aviso del día y después la nota de auditoría', async () => {
    await crearDataset({ vencimiento: '2026-12-15' });
    await proponer(titular);
    await correr('2026-10-19');
    assert.deepEqual((await libro()).map(n => [n.tipo, n.numero]), [['aviso', 1], ['auditoria', 2]]);
  });

  it('un cambio que entra al canal después de la nota del día sale al día hábil siguiente, sin repetir el anterior', async () => {
    await proponer(titular);
    await correr('2026-10-19');
    const tarde = await proponer(titular, { titulo: 'Llegó más tarde' });
    await correr('2026-10-19');
    assert.equal((await auditorias()).length, 1);
    await correr('2026-10-20');
    const [, siguiente] = await auditorias();
    assert.deepEqual(await incluidos(siguiente.id), [{ cambio_id: tarde, seccion: 'nuevo' }]);
  });

  it('si el envío falla, la misma nota se reintenta en la corrida siguiente y no se genera otra', async () => {
    await proponer(titular);
    process.env.EMAIL_SOLO_A = 'nadie@rpad.test';
    await correr('2026-10-19');
    process.env.EMAIL_SOLO_A = '';
    assert.equal((await auditorias())[0].estado, 'fallida');
    await correr('2026-10-20');
    const todas = await auditorias();
    assert.equal(todas.length, 1);
    assert.equal(todas[0].estado, 'enviada');
  });

  it('si la nota de autorización no se pudo generar ese día, tampoco sale la de auditoría', async () => {
    await proponer(editor);
    await licencia(titular, '2026-10-19', '2026-10-30', auditor);
    const resumen = await conFallaSimulada('INSERT', "NEW.tipo = 'autorizacion'", () => correr('2026-10-19'));
    assert.deepEqual(resumen.errores.map(e => e.tipo), ['autorizacion']);
    assert.equal((await auditorias()).length, 0);
    await correr('2026-10-20');
    assert.deepEqual((await libro()).map(n => n.tipo), ['autorizacion', 'auditoria']);
  });

  it('con el envío automático desactivado no sale nada', async () => {
    await configurarNotas({ envio_activo: 0, para_auditoria: 'auditoria@rpad.test' });
    await proponer(titular);
    await correr('2026-10-19');
    assert.equal((await auditorias()).length, 0);
  });

  it('sin Para de auditoría, el paso queda como error y las demás notas salen igual', async () => {
    await query("UPDATE notas_digitales_config SET para_auditoria = ''");
    await crearDataset({ vencimiento: '2026-12-15' });
    await proponer(titular);
    const resumen = await correr('2026-10-19');
    assert.deepEqual(resumen.errores.map(e => e.tipo), ['auditoria']);
    assert.deepEqual((await libro()).map(n => n.tipo), ['aviso']);
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/notas-auditoria.test.js`
Expected: FAIL (la corrida no genera notas de auditoría).

- [ ] **Step 3: Motor** (`services/notasDigitales.js`):

(a) Imports: sumar `construirNotaDeAuditoria` al import de `./notasDigitalesContenido.js`, y agregar

```js
import { contextoDeCanal, seleccionarParaAuditoria, catalogosParaAuditoria } from './auditoriaService.js';
```

(a2) Agregar, antes de `const correrPasos = async (resumen, hoy, usuarioId) => {`:

```js
// ¿Ya se generó la nota de auditoría (no de prueba) de esta fecha? Una sola por día (Decisiones del plan 12)
const hayNotaDeAuditoria = async (fecha) => {
  const [[fila]] = await pool.query(
    "SELECT COUNT(*) AS cantidad FROM notas_digitales WHERE tipo = 'auditoria' AND es_prueba = 0 AND fecha = ?", [fecha]
  );
  return Number(fila.cantidad) > 0;
};
```

(b) Reemplazar `destinatarios`, con sus dos líneas de comentario de arriba (`// ccAutorizado: …`), por:

```js
// ccAutorizado: el email de la persona autorizada, en las notas que comunican su autorización (spec 2026-10-15, 7.2).
// Va solo si es un email válido: uno mal cargado no puede hacer fallar el envío de la nota.
// La nota de auditoría va a sus propios destinatarios, con el CCO general (spec 2026-10-15, 10.1).
const destinatarios = (config, gestion, esPrueba, ccAutorizado = null, tipo = null) => {
  if (esPrueba) return { para: listaDeCorreos(config.casillas_prueba), cc: [], cco: [] };
  if (tipo === 'auditoria') {
    return { para: listaDeCorreos(config.para_auditoria), cc: listaDeCorreos(config.cc_auditoria), cco: listaDeCorreos(config.cco) };
  }
  // La nota de autorización no tiene gestión: va a los "Para" de las dos, sin repetir
  const para = gestion
    ? listaDeCorreos(config[`para_${gestion}`])
    : [...new Set(GESTIONES.flatMap(g => listaDeCorreos(config[`para_${g}`])))];
  const cc = gestion ? listaDeCorreos(config[`cc_${gestion}`]) : [];
  if (ccAutorizado && emailValido(ccAutorizado) && !cc.includes(ccAutorizado)) cc.push(ccAutorizado);
  return { para, cc, cco: listaDeCorreos(config.cco) };
};
```

(c) Reemplazar `generarNota` entera (desde su comentario `/** Asigna el número, …` hasta su `};`) por:

```js
/**
 * Asigna el número, renderiza HTML, texto, PDF y (en los avisos) el anexo y deja la nota registrada como pendiente.
 * firma: la de firmaParaFecha (sin ella, la que corresponde a la fecha). rangoVencimientos: asunto de un aviso anticipado.
 * autorizacion: { nombre, cargo, email, desde, hasta } de la persona autorizada: en un aviso suma el párrafo de autorización;
 * con tipo 'autorizacion' es la nota de autorización (sin gestión ni datasets), que firma solo el titular. En los dos
 * casos va en CC.
 * auditoria: { nuevos, reiterados, catalogos } de la nota de auditoría (tipo 'auditoria', sin gestión ni datasets; spec
 * 2026-10-15, 10). Salvo en las pruebas, cada cambio queda en notas_digitales_cambios con su sección: cuenta como incluido
 * desde que la nota se genera (spec 9.3).
 */
export const generarNota = async ({
  tipo, gestion, fecha, datasets, config, esPrueba = false, usuarioId = null, preparado = null,
  firma = null, rangoVencimientos = null, autorizacion = null, auditoria = null
}) => {
  const esAutorizacion = tipo === 'autorizacion';
  const esAuditoria = tipo === 'auditoria';
  const firmaDelDia = firma ?? (await firmaParaFecha(config, fecha)).firma;
  const firmaNota = esAutorizacion ? soloTitular(firmaDelDia) : firmaDelDia;
  const contenido = esAutorizacion || esAuditoria
    ? { datasets: [], areas: [], fichas: [] }
    : preparado ?? await prepararContenido({ tipo, gestion, datasets });
  const fichas = tipo === 'aviso' ? validarFichas(contenido) : null;
  const { para, cc, cco } = destinatarios(config, gestion, esPrueba, autorizacion?.email ?? null, tipo);
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
    let nota;
    if (esAutorizacion) {
      nota = construirNotaDeAutorizacion({ numero, anio, esPrueba, fecha, firma: firmaNota, autorizacion });
    } else if (esAuditoria) {
      nota = construirNotaDeAuditoria({ numero, anio, esPrueba, fecha, ...auditoria, firma: firmaNota, config });
    } else {
      nota = construirNota({
        tipo, gestion, numero, anio, esPrueba, fecha, datasets: contenido.datasets, areas: contenido.areas, config,
        firma: firmaNota, rangoVencimientos, autorizacion
      });
    }
    const pdf = await renderPdf(nota, opcionesPdf(config, firmaNota));
    // El anexo se renderiza antes del INSERT: si falla, no queda una nota numerada sin su anexo
    const anexoPdf = fichas ? await renderAnexo(construirAnexo({ numero, anio, esPrueba, fecha, fichas })) : null;
    const [resultado] = await conexion.query(
      `INSERT INTO notas_digitales
         (numero, anio, tipo, gestion, periodo, fecha, es_prueba, asunto, para, cc, cco, html, texto, pdf, anexo_pdf, creado_por,
          firmante_id, presentada_por_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero, anio, tipo, gestion ?? null, tipo === 'reiteracion' ? periodoDe(fecha) : null, fecha, esPrueba ? 1 : 0,
        nota.asunto, para.join(', '), cc.join(', '), cco.join(', '), renderHtml(nota), renderTexto(nota), pdf, anexoPdf, usuarioId,
        firmaNota.firmanteId, firmaNota.presentanteId]
    );
    if (!esPrueba) {
      for (const d of contenido.datasets) {
        await conexion.query(
          'INSERT INTO notas_digitales_datasets (nota_id, dataset_id, seccion, vencimiento, cuenta_desde) VALUES (?, ?, ?, ?, ?)',
          [resultado.insertId, d.id, d.vencimiento < fecha ? 'vencido' : 'proximo', d.vencimiento, d.cuenta_desde ?? null]
        );
      }
      for (const [seccion, cambios] of [['nuevo', auditoria?.nuevos ?? []], ['reiterado', auditoria?.reiterados ?? []]]) {
        for (const cambio of cambios) {
          await conexion.query(
            'INSERT INTO notas_digitales_cambios (nota_id, cambio_id, seccion) VALUES (?, ?, ?)', [resultado.insertId, cambio.id, seccion]
          );
        }
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
```

(d) En `correrPasos`, después del bucle del paso 3 (`// 3. Reiteraciones: una evaluación por mes y gestión`, el `for (const gestion of GESTIONES) { … }` que termina con el `catch` que anota `{ tipo: 'reiteracion', gestion }`) y antes del `};` que cierra `correrPasos`, agregar:

```js

  // 4. Nota de auditoría de los cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 9.3 y 10): una sola
  // por día (Decisiones del plan 12), con la firma del día. Si hoy no hay quién firme (licencia sin autorizado) o la nota
  // de autorización no se pudo generar, la corrida ya terminó arriba, como para las demás notas.
  try {
    if (!(await hayNotaDeAuditoria(hoy))) {
      const { nuevos, reiterados } = await seleccionarParaAuditoria(hoy, await contextoDeCanal(hoy, config));
      if (nuevos.length || reiterados.length) {
        if (listaDeCorreos(config.para_auditoria).length === 0) {
          throw new Error('Falta el Para de las notas de auditoría (Correos > Configuración)');
        }
        const id = await generarNota({
          tipo: 'auditoria', gestion: null, fecha: hoy, datasets: [], config, usuarioId, firma,
          auditoria: { nuevos, reiterados, catalogos: await catalogosParaAuditoria() }
        });
        resumen.generadas.push({ id, tipo: 'auditoria', gestion: null, datasets: 0, cambios: nuevos.length + reiterados.length });
        await enviar(id, { tipo: 'auditoria' });
      }
    }
  } catch (error) {
    anotarError(resumen, { tipo: 'auditoria' }, error);
  }
```

- [ ] **Step 4: Correr los tests de la tarea y toda la batería de Notas Digitales**

Run: `node --test tests/notas-auditoria.test.js tests/notas-motor.test.js tests/notas-licencias.test.js tests/notas-api.test.js tests/notas-datos.test.js tests/notas-contenido.test.js tests/notas-pdf.test.js tests/notas-anexo.test.js`
Expected: PASS. Los tests existentes no se tocan y siguen en verde: sin cambios en el canal nota, la corrida es la de siempre.

- [ ] **Step 5: Suite completa** — `npm test 2>&1 | tail -15`: `ℹ fail 0`, ninguna falla nueva.

- [ ] **Step 6: Commit**

```bash
git add services/notasDigitales.js tests/notas-auditoria.test.js
git commit -m "feat: nota de auditoría en la corrida diaria de Notas Digitales

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 9: Correos: vista previa, prueba, libro, configuración y Estado de la nota de auditoría

**Files:**
- Modify: `services/notasDigitales.js` (vista previa, prueba y Estado)
- Modify: `controllers/notasDigitalesController.js`
- Test: `tests/notas-auditoria.test.js` (agregar), `tests/notas-api.test.js` (agregar), `tests/permisos.test.js` (agregar una ruta)

**Interfaces:**
- Consumes: Task 8 (`generarNota` con `auditoria`); `cambiosConCanal`, `notasDeAuditoriaDe` (Task 3); `sumarDiasHabiles` (Task 2); `DIAS_HABILES_PARA_REITERAR_AUDITORIA`.
- Produces:
  - `previewNota`, `previewPdf` y `enviarPrueba` aceptan `tipo: 'auditoria'` (con `gestion: null`): datos reales del día (lo que saldría hoy) o, si no hay, un ejemplo (una modificación, un alta y una baja ya solicitada). La prueba no registra cambios en `notas_digitales_cambios`.
  - `estadoNotas()` suma `auditoria: { canal_nota, proxima }` (`proxima`: `'AAAA-MM-DD'` o `null`).
  - API: `GET /preview`, `GET /preview/pdf` y `POST /prueba` aceptan `tipo=auditoria` sin `gestion` (el PDF se llama `Nota-Digital-vista-previa-auditoria.pdf`); el libro filtra `tipo=auditoria` y cada nota suma `cantidad_cambios`; `GET /notificaciones/notas-digitales/:id` suma `cambios: [{ cambio_id, seccion, tipo_cambio, estado, titulo }]`; `PUT /config` acepta `para_auditoria` (obligatorio) y `cc_auditoria` (opcional).

- [ ] **Step 1: Tests que fallan.**

(a) Agregar al final de `tests/notas-auditoria.test.js`:

```js
describe('Correos: Estado, vista previa y prueba (spec 10.4)', () => {
  it('el Estado cuenta los cambios del canal nota y da la fecha de la próxima nota de auditoría', async () => {
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-10-19' })).auditoria, { canal_nota: 0, proxima: null });
    await proponer(titular);
    await proponer(editor);
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-10-19' })).auditoria, { canal_nota: 1, proxima: '2026-10-19' });
    await correr('2026-10-19');
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-10-19' })).auditoria, { canal_nota: 1, proxima: '2026-10-26' });
    // Un sábado mira la corrida del lunes
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-10-24' })).auditoria, { canal_nota: 1, proxima: '2026-10-26' });
  });

  it('la vista previa usa los cambios de hoy o, si no hay, un ejemplo; no escribe nada', async () => {
    const ejemplo = await motor.previewNota({ tipo: 'auditoria', gestion: null, hoy: '2026-10-19' });
    assert.equal(ejemplo.ejemplo, true);
    assert.equal(ejemplo.asunto, `Nota Digital N° XX – Ref.: ${REF}`);
    assert.match(ejemplo.html, /Dataset de ejemplo/);
    await proponer(titular);
    const real = await motor.previewNota({ tipo: 'auditoria', gestion: null, hoy: '2026-10-19' });
    assert.deepEqual([real.ejemplo, real.cantidad], [false, 1]);
    assert.ok(real.html.includes('Dataset nuevo auditado'));
    const pdf = await motor.previewPdf({ tipo: 'auditoria', gestion: null, hoy: '2026-10-19' });
    assert.equal(pdf.subarray(0, 4).toString('latin1'), '%PDF');
    assert.equal((await query('SELECT COUNT(*) AS n FROM notas_digitales'))[0].n, 0);
  });

  it('la prueba va a las casillas de prueba y no registra cambios: el cambio sigue siendo nuevo para la corrida', async () => {
    await proponer(titular);
    const resultado = await motor.enviarPrueba({ tipo: 'auditoria', gestion: null, hoy: '2026-10-19' });
    assert.equal(resultado.success, true);
    const [nota] = await query('SELECT tipo, es_prueba, para, asunto FROM notas_digitales WHERE id = ?', [resultado.id]);
    assert.deepEqual([nota.tipo, nota.es_prueba, nota.para], ['auditoria', 1, 'prueba@rpad.test']);
    assert.match(nota.asunto, /^\[PRUEBA\] Nota Digital N° PRUEBA – Ref\.: /);
    assert.equal((await query('SELECT COUNT(*) AS n FROM notas_digitales_cambios'))[0].n, 0);
    await correr('2026-10-19');
    assert.equal((await auditorias()).length, 1);
  });
});
```

(b) Agregar al final de `tests/notas-api.test.js`:

```js
describe('nota de auditoría en Correos (spec 2026-10-15-dias-habiles-licencias-auditoria, 10.1 y 10.4)', () => {
  it('la vista previa, su PDF y la prueba aceptan tipo=auditoria sin gestión', async () => {
    const vista = await api.get('/notificaciones/notas-digitales/preview?tipo=auditoria', comoAdmin());
    assert.equal(vista.status, 200, JSON.stringify(vista.body));
    assert.equal(vista.body.data.ejemplo, true);
    assert.match(vista.body.data.asunto, /Solicitud de auditoría de cambios/);
    const pdf = await api.get('/notificaciones/notas-digitales/preview/pdf?tipo=auditoria', comoAdmin());
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers.get('content-disposition'), /Nota-Digital-vista-previa-auditoria\.pdf/);
    const prueba = await api.post('/notificaciones/notas-digitales/prueba', { tipo: 'auditoria' }, comoAdmin());
    assert.equal(prueba.status, 200, JSON.stringify(prueba.body));
    const [nota] = await query('SELECT tipo, es_prueba FROM notas_digitales WHERE id = ?', [prueba.body.data.id]);
    assert.deepEqual([nota.tipo, nota.es_prueba], ['auditoria', 1]);
  });

  it('el libro filtra por Auditoría (sin gestión, con la cantidad de cambios) y el detalle lista los cambios incluidos', async () => {
    const auditoria = await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-10-19', numero: 4 });
    await crearNota({ tipo: 'aviso', gestion: 'interna', fecha: '2026-10-19', numero: 3 });
    const { insertId: cambioId } = await query(
      `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id)
       VALUES ('crear', NULL, '{"titulo":"Alta auditada"}', ?)`,
      [usuarios.adminA.id]
    );
    try {
      await query("INSERT INTO notas_digitales_cambios (nota_id, cambio_id, seccion) VALUES (?, ?, 'nuevo')", [auditoria, cambioId]);
      const libro = (await api.get('/notificaciones/notas-digitales?tipo=auditoria', comoAdmin())).body.data;
      assert.deepEqual(libro.map(n => [n.id, n.gestion, n.cantidad_cambios]), [[auditoria, null, 1]]);
      const detalle = (await api.get(`/notificaciones/notas-digitales/${auditoria}`, comoAdmin())).body.data;
      assert.deepEqual(detalle.cambios, [{ cambio_id: cambioId, seccion: 'nuevo', tipo_cambio: 'crear', estado: 'pendiente', titulo: 'Alta auditada' }]);
    } finally {
      await query('DELETE FROM cambios_pendientes WHERE id = ?', [cambioId]);
    }
  });

  it('configuración: el Para de auditoría es obligatorio y el CC, opcional', async () => {
    const ruta = '/notificaciones/notas-digitales/config';
    assert.equal((await api.get(ruta, comoAdmin())).body.data.para_auditoria, 'mit@comodoro.gov.ar');
    assert.equal((await api.put(ruta, { para_auditoria: '' }, comoAdmin())).status, 400);
    const res = await api.put(ruta, { para_auditoria: 'auditoria@rpad.test', cc_auditoria: '' }, comoAdmin());
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual([res.body.data.para_auditoria, res.body.data.cc_auditoria], ['auditoria@rpad.test', '']);
  });
});
```

(La base de `notas-api.test.js` se crea con `schema.sql`: `para_auditoria` arranca en `mit@comodoro.gov.ar`. Ningún otro test de ese archivo genera notas de auditoría, porque no deja cambios en el canal nota.)

(c) En `tests/permisos.test.js`, agregar a `RUTAS_SOLO_ADMIN`:

```js
  ['GET', '/notificaciones/notas-digitales/preview?tipo=auditoria'],
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/notas-auditoria.test.js tests/notas-api.test.js`
Expected: FAIL (`estadoNotas` no trae `auditoria`; la vista previa responde 400 a `tipo=auditoria`; el libro no trae `cantidad_cambios`).

- [ ] **Step 3: Servicio** (`services/notasDigitales.js`).

(a) Imports: el de `./auditoriaService.js` pasa a

```js
import {
  contextoDeCanal, seleccionarParaAuditoria, catalogosParaAuditoria, cambiosConCanal, notasDeAuditoriaDe
} from './auditoriaService.js';
import { DIAS_HABILES_PARA_REITERAR_AUDITORIA } from './auditoriaReglas.js';
```

y sumar `sumarDiasHabiles` al import de `./notasDigitalesCalendario.js`.

(b) Agregar, antes de `const contenidoParaMostrar = …`:

```js
// Ejemplo de la nota de auditoría para la vista previa y la prueba cuando hoy no hay cambios para pedir (spec 10.4):
// una modificación y un alta nuevas, y una baja ya solicitada
const ejemploAuditoria = (hoy) => {
  const comun = { usuario_nombre: 'Persona de ejemplo', usuario_cargo: 'Cargo de ejemplo', fecha_propuesta: diaHabilAnterior(diaHabilAnterior(hoy)) };
  return {
    nuevos: [
      {
        ...comun, id: 0, tipo_cambio: 'editar', dataset_titulo: 'Dataset de ejemplo',
        datos_anteriores: { proxima_actualizacion: sumarDias(hoy, -10), url_dataset: 'https://datos.comodoro.gov.ar/dataset/ejemplo' },
        datos_nuevos: { proxima_actualizacion: sumarDias(hoy, 355), url_dataset: 'https://datos.comodoro.gov.ar/dataset/ejemplo-actualizado' }
      },
      {
        ...comun, id: -1, tipo_cambio: 'crear', dataset_titulo: null, datos_anteriores: null,
        datos_nuevos: {
          titulo: 'Dataset nuevo de ejemplo', descripcion: 'Descripción de ejemplo del conjunto de datos propuesto.',
          tipo_gestion: 'interna', url_dataset: 'https://datos.comodoro.gov.ar/dataset/nuevo'
        }
      }
    ],
    reiterados: [{
      ...comun, id: -2, tipo_cambio: 'eliminar', dataset_titulo: 'Dataset de ejemplo a dar de baja', fecha_propuesta: sumarDias(hoy, -14),
      datos_nuevos: { eliminado: true }, datos_anteriores: { titulo: 'Dataset de ejemplo a dar de baja', tipo_gestion: 'externa' },
      solicitado: { numero: 1, anio: Number(hoy.slice(0, 4)), fecha: diaHabilAnterior(sumarDias(hoy, -6)), reiteraciones: 0 }
    }],
    catalogos: { areas: {}, frecuencias: {}, temas: {}, formatos: {} }
  };
};

// Lo que llevaría hoy la nota de auditoría (spec 9.3) o, si no lleva nada, el ejemplo
const contenidoDeAuditoriaParaMostrar = async (config, hoy) => {
  const { nuevos, reiterados } = await seleccionarParaAuditoria(hoy, await contextoDeCanal(hoy, config));
  if (nuevos.length || reiterados.length) return { nuevos, reiterados, catalogos: await catalogosParaAuditoria(), ejemplo: false };
  return { ...ejemploAuditoria(hoy), ejemplo: true };
};
```

(c) Reemplazar `notaDeVistaPrevia`, con sus dos líneas de comentario de arriba (`// La nota de la vista previa: …`), por:

```js
// La nota de la vista previa: los datos de hoy (o de ejemplo) con N° XX, firmada como saldría (en una licencia sin
// autorizado, como saldría a la vuelta: con la firma del titular). La de auditoría no tiene gestión (spec 2026-10-15, 10.4).
const notaDeVistaPrevia = async ({ tipo, gestion, hoy }) => {
  const config = await obtenerConfig();
  const { firma } = await firmaParaFecha(config, hoy);
  if (tipo === 'auditoria') {
    const { ejemplo: esEjemplo, ...auditoria } = await contenidoDeAuditoriaParaMostrar(config, hoy);
    const nota = construirNotaDeAuditoria({ numero: null, anio: null, esPrueba: false, fecha: hoy, ...auditoria, firma, config });
    return { nota, config, firma, ejemplo: esEjemplo, cantidad: esEjemplo ? 0 : auditoria.nuevos.length + auditoria.reiterados.length };
  }
  const { datasets, areas, ejemplo: esEjemplo } = await contenidoParaMostrar(tipo, gestion, hoy);
  const nota = construirNota({ tipo, gestion, numero: null, anio: null, esPrueba: false, fecha: hoy, datasets, areas, config, firma });
  return { nota, config, firma, ejemplo: esEjemplo, cantidad: esEjemplo ? 0 : datasets.length };
};
```

(`previewNota` y `previewPdf` no cambian: ya usan `notaDeVistaPrevia`.)

(d) En `enviarPrueba`, antes de `const { datasets, areas, fichas, ejemplo: esEjemplo } = await contenidoParaMostrar(tipo, gestion, hoy);` (la línea que sigue a `const { firma } = await firmaParaFecha(config, hoy);` en esa función), agregar:

```js
  // La prueba de la nota de auditoría: los cambios de hoy o el ejemplo, sin registrar cambios incluidos (spec 2026-10-15, 11.2)
  if (tipo === 'auditoria') {
    const { ejemplo: esEjemplo, ...auditoria } = await contenidoDeAuditoriaParaMostrar(config, hoy);
    const id = await generarNota({ tipo, gestion: null, fecha: hoy, datasets: [], config, esPrueba: true, usuarioId, firma, auditoria });
    return { id, ejemplo: esEjemplo, destinatarios: casillas, ...(await enviarNota(id)) };
  }
```

(e) Agregar, antes de `export const estadoNotas`:

```js
/**
 * Nota de auditoría en el Estado (spec 2026-10-15, 10.4): cuántos cambios están en el canal nota en la próxima corrida
 * posible (hoy si es hábil) y la fecha de la próxima nota: la de esa corrida si alguno todavía no estuvo en una nota (o el
 * día hábil siguiente si la de esa fecha ya salió), y si no, 5 días hábiles después de la última nota de cada uno.
 * { canal_nota, proxima: 'AAAA-MM-DD' | null }
 */
const estadoAuditoria = async (config, hoy) => {
  const corrida = proximoDiaHabil(hoy);
  const delCanal = (await cambiosConCanal(corrida, await contextoDeCanal(corrida, config))).filter(c => c.canal === 'nota');
  if (delCanal.length === 0) return { canal_nota: 0, proxima: null };
  const previas = await notasDeAuditoriaDe(delCanal.map(c => c.id));
  const primeraLibre = (await hayNotaDeAuditoria(corrida)) ? proximoDiaHabil(sumarDias(corrida, 1)) : corrida;
  const fechas = delCanal.map((cambio) => {
    const ultima = previas.get(cambio.id)?.at(-1)?.fecha;
    const fecha = ultima ? sumarDiasHabiles(ultima, DIAS_HABILES_PARA_REITERAR_AUDITORIA) : primeraLibre;
    return fecha < primeraLibre ? primeraLibre : fecha;
  });
  return { canal_nota: delCanal.length, proxima: fechas.sort()[0] };
};
```

y en el objeto que devuelve `estadoNotas`, después de `licencia_firmante: licencia,`, agregar `auditoria: await estadoAuditoria(config, hoy),`.

- [ ] **Step 4: Controlador** (`controllers/notasDigitalesController.js`).

(a) Reemplazar

```js
const TIPOS = ['aviso', 'reiteracion'];
// El libro también filtra las notas de autorización; la vista previa y la prueba solo usan TIPOS
const TIPOS_LIBRO = [...TIPOS, 'autorizacion'];
```

por

```js
const TIPOS = ['aviso', 'reiteracion'];
// El libro también filtra las notas de autorización y las de auditoría (spec 2026-10-15, 7.2 y 10.4)
const TIPOS_LIBRO = [...TIPOS, 'autorizacion', 'auditoria'];
```

y agregar, después de `idDe`:

```js
// Tipo y gestión de la vista previa y la prueba: un aviso o una reiteración con su gestión, o la nota de auditoría, que no
// tiene gestión (spec 2026-10-15, 10.4). null si no son válidos.
const notaPedida = ({ tipo, gestion } = {}) => {
  if (tipo === 'auditoria') return { tipo, gestion: null };
  return TIPOS.includes(tipo) && GESTIONES.includes(gestion) ? { tipo, gestion } : null;
};
```

(b) En `LISTAS`, agregar al final `para_auditoria: true, cc_auditoria: false`:

```js
const LISTAS = {
  para_interna: true, para_externa: true, cc_interna: false, cc_externa: false, cco: false, casillas_prueba: false,
  para_auditoria: true, cc_auditoria: false
};
```

(c) En `listarNotas`, después de `(SELECT COUNT(*) FROM notas_digitales_datasets c WHERE c.nota_id = n.id) AS cantidad_datasets,`, agregar

```sql
              (SELECT COUNT(*) FROM notas_digitales_cambios k WHERE k.nota_id = n.id) AS cantidad_cambios,
```

(d) En `obtenerNota`, después de la consulta de `datasets`, agregar

```js
    // Los cambios que incluye una nota de auditoría (spec 2026-10-15, 10.4). El título es el del dataset o, en un alta, el
    // propuesto (se arma acá y no con COALESCE en SQL: datos_nuevos tiene otra intercalación que datasets.titulo)
    const [filasCambios] = await pool.query(
      `SELECT k.cambio_id, k.seccion, cp.tipo_cambio, cp.estado, d.titulo AS dataset_titulo, cp.datos_nuevos
       FROM notas_digitales_cambios k
       JOIN cambios_pendientes cp ON cp.id = k.cambio_id
       LEFT JOIN datasets d ON d.id = cp.dataset_id
       WHERE k.nota_id = ? ORDER BY k.seccion, cp.created_at, cp.id`, [id]
    );
    const cambios = filasCambios.map(({ dataset_titulo: tituloDataset, datos_nuevos: datosNuevos, ...cambio }) => ({
      ...cambio,
      titulo: tituloDataset ?? (typeof datosNuevos === 'string' ? JSON.parse(datosNuevos) : datosNuevos)?.titulo ?? null
    }));
```

y reemplazar `data: { ...nota, tiene_anexo: Boolean(nota.tiene_anexo), datasets }` por `data: { ...nota, tiene_anexo: Boolean(nota.tiene_anexo), datasets, cambios }`.

(e) Reemplazar `verPreview` y `verPreviewPdf` (completas) por:

```js
export const verPreview = async (req, res) => {
  try {
    const pedida = notaPedida(req.query);
    if (!pedida) return res.status(400).json({ success: false, error: 'Tipo o gestión inválidos' });
    res.json({ success: true, data: await notas.previewNota(pedida) });
  } catch (error) {
    errorInterno(res, 'Error al generar la vista previa', error);
  }
};

// El PDF de la vista previa (N° XX, con el membrete y la firma cargados): no se guarda ni se envía
export const verPreviewPdf = async (req, res) => {
  try {
    const pedida = notaPedida(req.query);
    if (!pedida) return res.status(400).json({ success: false, error: 'Tipo o gestión inválidos' });
    const pdf = await notas.previewPdf(pedida);
    const nombre = `Nota-Digital-vista-previa-${pedida.tipo}${pedida.gestion ? `-${pedida.gestion}` : ''}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nombre}"`);
    res.send(pdf);
  } catch (error) {
    // Una firma o un banner guardados que no se pueden leer: el admin los reemplaza en Configuración
    if (error instanceof ImagenInvalida) return res.status(400).json({ success: false, error: error.message });
    errorInterno(res, 'Error al generar el PDF de la vista previa', error);
  }
};
```

y, en `enviarPrueba`, reemplazar

```js
    const { tipo, gestion } = req.body ?? {};
    if (!TIPOS.includes(tipo) || !GESTIONES.includes(gestion)) {
      return res.status(400).json({ success: false, error: 'Tipo o gestión inválidos' });
    }
    const resultado = await notas.enviarPrueba({ tipo, gestion, usuarioId: req.user?.userId ?? null });
```

por

```js
    const pedida = notaPedida(req.body ?? {});
    if (!pedida) return res.status(400).json({ success: false, error: 'Tipo o gestión inválidos' });
    const resultado = await notas.enviarPrueba({ ...pedida, usuarioId: req.user?.userId ?? null });
```

- [ ] **Step 5: Correr los tests de la tarea y los de Notas Digitales**

Run: `node --test tests/notas-auditoria.test.js tests/notas-api.test.js tests/notas-motor.test.js tests/notas-licencias.test.js tests/permisos.test.js`
Expected: PASS (`tipo=autorizacion` sigue rechazándose en la vista previa y la prueba; un aviso sin gestión, también).

- [ ] **Step 6: Suite completa** — `npm test 2>&1 | tail -15`: `ℹ fail 0`, ninguna falla nueva.

- [ ] **Step 7: Commit**

```bash
git add services/notasDigitales.js controllers/notasDigitalesController.js tests/notas-auditoria.test.js tests/notas-api.test.js tests/permisos.test.js
git commit -m "feat: nota de auditoría en Correos: vista previa, prueba, libro, configuración y Estado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 10: El editor en el frontend: header, panel de usuarios y Para revisar

**Files:**
- Modify: `public/js/auth.js`
- Modify: `public/usuarios.html`, `public/js/usuarios.js`
- Modify: `public/js/perfil.js`
- Modify: las 14 páginas `public/*.html` (versión de los scripts compartidos)
- Test: `tests/auth-frontend.test.js` (agregar), `tests/usuarios-frontend.test.js` (agregar), `tests/perfil-frontend.test.js` (nuevo), `tests/paginas.test.js` (`VERSION`)

**Interfaces:**
- Consumes: `GET /cambios-pendientes/:id` con `auditoria: { puede, respaldo, mensaje }` y `revisado_como_respaldo` en las listas (Task 5); los 403 del panel (Task 4).
- Produces: `Auth.isAdmin()` incluye al editor; `Auth.isAuditor()`; `Auth.getRoleText()` devuelve `Editor`. En `usuarios.js`: `avisoSoloLectura(u)`, `textoCambioDeRol(u, rol)`, el grupo "Editores". En `perfil.js`: `botonesDeAuditoria(id, permiso)`, `avisoNoCorresponde(mensaje)`, `textoRevisor(cambio)`.

- [ ] **Step 1: Versión de los scripts compartidos.** En `tests/paginas.test.js`: `const VERSION = '20261022';`. En todas las páginas:

```bash
sed -i -E 's#js/(auth|main|api)\.js\?v=20261021#js/\1.js?v=20261022#g' public/*.html
grep -c 'v=20261022' public/*.html
sed -i 's#js/usuarios.js?v=20261021#js/usuarios.js?v=20261022#' public/usuarios.html
sed -i 's#js/perfil.js?v=20261021#js/perfil.js?v=20261022#' public/perfil.html
grep -rn 'v=20261021' public/*.html
```

Expected: el último `grep` solo muestra `js/correos.js?v=20261021` en `public/correos.html` (lo cambia la Task 11).

Run: `node --test tests/paginas.test.js`
Expected: PASS.

- [ ] **Step 2: Tests del frontend que fallan.**

(a) Agregar al final de `tests/auth-frontend.test.js`:

```js
describe('editor (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.1)', () => {
  it('el editor entra a la administración pero no es auditor; el header dice Editor', () => {
    const { Auth } = cargarAuth({ rol: 'editor' });
    assert.equal(Auth.isAdmin(), true);
    assert.equal(Auth.isAuditor(), false);
    assert.equal(Auth.isSuperadmin(), false);
    assert.equal(Auth.getRoleText(), 'Editor');
  });

  it('auditores: superadmin y admin', () => {
    assert.equal(cargarAuth({ rol: 'superadmin' }).Auth.isAuditor(), true);
    assert.equal(cargarAuth({ rol: 'admin' }).Auth.isAuditor(), true);
    assert.equal(cargarAuth({ rol: 'lector' }).Auth.isAuditor(), false);
    assert.equal(cargarAuth(null).Auth.isAuditor(), false);
  });
});
```

(b) En `tests/usuarios-frontend.test.js`, cambiar la firma de `cargarPanel` a `const cargarPanel = (abierto = USUARIO, alPedir = () => {}, rol = 'admin') => {` y, en el contexto, reemplazar `Auth: { getUser: () => ({ id: 1 }), isAuthenticated: () => true, isAdmin: () => true },` por `Auth: { getUser: () => ({ id: 1 }), getRole: () => rol, isAuthenticated: () => true, isAdmin: () => true },`. Agregar al final del archivo:

```js
describe('editor (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.1)', () => {
  const evaluar = (contexto, expresion) => vm.runInContext(expresion, contexto);
  const aviso = (contexto, u) => evaluar(contexto, `avisoSoloLectura(${JSON.stringify(u)})`);

  it('un editor solo modifica lectores: los demás se ven con el aviso y sin acciones', () => {
    const { contexto } = cargarPanel(USUARIO, () => {}, 'editor');
    assert.equal(aviso(contexto, { id: 7, rol: 'lector' }), null);
    assert.equal(aviso(contexto, { id: 8, rol: 'admin' }), 'Como editor, solo podés modificar usuarios lectores.');
    assert.equal(aviso(contexto, { id: 9, rol: 'editor' }), 'Como editor, solo podés modificar usuarios lectores.');
    assert.equal(aviso(contexto, { id: 10, rol: 'superadmin' }), 'Esta cuenta solo la modifica su titular.');
    assert.equal(aviso(contexto, null), null);
  });

  it('un admin modifica a todos, salvo la cuenta del superadmin', () => {
    const { contexto } = cargarPanel();
    assert.equal(aviso(contexto, { id: 8, rol: 'admin' }), null);
    assert.equal(aviso(contexto, { id: 9, rol: 'editor' }), null);
    assert.equal(aviso(contexto, { id: 10, rol: 'superadmin' }), 'Esta cuenta solo la modifica su titular.');
  });

  it('en el alta, el rol va siempre, aunque el selector esté fijo en Lector para el editor', async () => {
    const panel = cargarPanel(null, () => {}, 'editor');
    panel.formulario({ nombre_completo: 'Persona Nueva', username: 'PNUEVA', email: 'pnueva@rpad.test' });
    panel.elemento('u-rol').value = 'lector';
    panel.elemento('u-rol').disabled = true;
    await panel.contexto.guardarUsuario({ preventDefault() {} });
    const pedido = panel.pedidos.find(p => p.nombre === 'crearUsuario');
    assert.equal(pedido.args[0].rol, 'lector');
  });

  it('textos de la confirmación al cambiar el rol', () => {
    const { contexto } = cargarPanel();
    const texto = (u, rol) => evaluar(contexto, `textoCambioDeRol(${JSON.stringify(u)}, '${rol}')`);
    const otro = { id: 7, nombre_completo: 'Persona de Prueba' };
    assert.match(texto(otro, 'editor'), /^Persona de Prueba va a pasar a Editor: podrá proponer cambios y auditarlos solo de respaldo/);
    assert.match(texto(otro, 'admin'), /va a pasar a Admin: podrá proponer y aprobar cambios/);
    assert.match(texto(otro, 'lector'), /va a pasar a Lector/);
    assert.match(texto({ id: 1 }, 'editor'), /^Vas a pasar a Editor: dejás de auditar cambios/);
    assert.match(texto({ id: 1 }, 'lector'), /^Vas a perder el acceso de administrador/);
  });
});
```

(c) Crear `tests/perfil-frontend.test.js`:

```js
// Mi Perfil (public/js/perfil.js), ejecutado en Node: los botones de aprobar y rechazar según quién puede auditar el
// cambio, y quién lo auditó (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.2)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';

const escaparHtml = (texto) => String(texto ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cargarPerfil = () => {
  const contexto = vm.createContext({
    document: { addEventListener() {}, getElementById: () => ({}) },
    Utils: { escapeHtml: escaparHtml }, Auth: {}, API: {}, CONFIG: {}, console
  });
  vm.runInContext(fs.readFileSync(new URL('../public/js/perfil.js', import.meta.url), 'utf8'), contexto);
  return contexto;
};
const MENSAJE = 'Este cambio lo auditan Persona Auditora. Podés auditarlo solo si ninguno está disponible.';

describe('perfil.js: auditar un cambio (spec 8.2)', () => {
  it('con permiso, los botones de aprobar y rechazar funcionan', () => {
    const html = cargarPerfil().botonesDeAuditoria(5, { puede: true, mensaje: null });
    assert.match(html, /onclick="aprobarCambio\(5\)"/);
    assert.match(html, /abrirModalRechazo\(5\)/);
    assert.doesNotMatch(html, /disabled/);
  });

  it('sin permiso aparecen deshabilitados, con el motivo', () => {
    const contexto = cargarPerfil();
    const html = contexto.botonesDeAuditoria(5, { puede: false, mensaje: MENSAJE });
    assert.equal(html.match(/disabled/g).length, 2);
    assert.doesNotMatch(html, /aprobarCambio|abrirModalRechazo/);
    assert.ok(html.includes(`title="${MENSAJE}"`));
    assert.ok(contexto.avisoNoCorresponde('<b>x</b>').includes('&lt;b&gt;x&lt;/b&gt;'));
  });

  it('quién auditó: aprobado o rechazado, con "(respaldo)" si fue un editor de respaldo', () => {
    const contexto = cargarPerfil();
    assert.equal(contexto.textoRevisor({ estado: 'aprobado', revisor_nombre: 'Persona Editora', revisado_como_respaldo: 1 }),
      'Aprobado por Persona Editora (respaldo)');
    assert.equal(contexto.textoRevisor({ estado: 'aprobado', revisor_nombre: 'Persona Auditora', revisado_como_respaldo: 0 }),
      'Aprobado por Persona Auditora');
    assert.equal(contexto.textoRevisor({ estado: 'rechazado', revisor_nombre: 'Persona Editora', revisado_como_respaldo: 1 }),
      'Rechazado por Persona Editora (respaldo)');
  });
});
```

Run: `node --test tests/auth-frontend.test.js tests/usuarios-frontend.test.js tests/perfil-frontend.test.js`
Expected: FAIL (`Auth.isAuditor is not a function`; `avisoSoloLectura is not defined`; `contexto.botonesDeAuditoria is not a function`).

- [ ] **Step 3: `public/js/auth.js`.** Reemplazar

```js
  // Verificar si es administrador: admin y superadmin pasan todo lo de administración
  isAdmin() {
    return ['admin', 'superadmin'].includes(this.getRole());
  },
```

por

```js
  // Verificar si es administrador: superadmin, admin y editor pasan todo lo de administración
  // (el editor, spec 2026-10-15-dias-habiles-licencias-auditoria, 8.1)
  isAdmin() {
    return ['admin', 'superadmin', 'editor'].includes(this.getRole());
  },

  // Auditor: aprueba y rechaza cambios de otros (superadmin o admin); el editor, solo de respaldo
  isAuditor() {
    return ['admin', 'superadmin'].includes(this.getRole());
  },
```

y en `getRoleText`, reemplazar `{ superadmin: 'Superadmin', admin: 'Administrador' }` por `{ superadmin: 'Superadmin', admin: 'Administrador', editor: 'Editor' }`.

- [ ] **Step 4: `public/usuarios.html`.**

(a) En el `<style>`, después de `.usuario-avatar.rol-admin { … }`, agregar `.usuario-avatar.rol-editor { background: #e6f4f1; color: #0f766e; }`, y después de `.etiqueta.rol-admin { … }`, agregar `.etiqueta.rol-editor { background: #e6f4f1; color: #0f766e; }`.

(b) En el selector de rol, entre `<option value="lector">Lector</option>` y `<option value="admin">Admin</option>`, agregar `<option value="editor">Editor</option>`.

(c) Después del `</section>` de "Pueden aprobar cambios" (la que contiene `lista-aprobadores`), agregar:

```html

            <section class="grupo-usuarios" aria-labelledby="titulo-editores">
                <div class="grupo-encabezado">
                    <h2 id="titulo-editores">Editores</h2>
                    <span class="grupo-contador">Proponen cambios y los auditan solo de respaldo</span>
                </div>
                <div id="lista-editores"></div>
            </section>
```

- [ ] **Step 5: `public/js/usuarios.js`.**

(a) Reemplazar `const TEXTO_ROL = { superadmin: 'Superadmin', admin: 'Admin', lector: 'Lector' };` por `const TEXTO_ROL = { superadmin: 'Superadmin', admin: 'Admin', editor: 'Editor', lector: 'Lector' };`.

(b) Después de `const soyYo = (u) => Boolean(u) && u.id === Auth.getUser()?.id;`, agregar:

```js
// El editor solo crea y modifica lectores y no cambia roles (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.1)
const soyEditor = () => Auth.getRole() === 'editor';
// Aviso de un usuario que quien está conectado no puede modificar (la cuenta del superadmin, o para un editor cualquiera
// que no sea lector), o null
const avisoSoloLectura = (u) => {
  if (!u) return null;
  if (u.rol === 'superadmin' && !soyYo(u)) return 'Esta cuenta solo la modifica su titular.';
  if (soyEditor() && u.rol !== 'lector') return 'Como editor, solo podés modificar usuarios lectores.';
  return null;
};
// Confirmación al cambiar un rol, y en especial el propio (spec 8.5; el editor, spec 2026-10-15, 8.1)
const textoCambioDeRol = (u, rol) => {
  if (soyYo(u)) {
    return rol === 'editor'
      ? 'Vas a pasar a Editor: dejás de auditar cambios, salvo de respaldo cuando no haya auditores disponibles. ¿Continuar?'
      : 'Vas a perder el acceso de administrador en este momento. ¿Continuar?';
  }
  if (rol === 'admin') return `${u.nombre_completo} va a pasar a Admin: podrá proponer y aprobar cambios. ¿Continuar?`;
  if (rol === 'editor') {
    return `${u.nombre_completo} va a pasar a Editor: podrá proponer cambios y auditarlos solo de respaldo, cuando no haya auditores disponibles. ¿Continuar?`;
  }
  return `${u.nombre_completo} va a pasar a Lector: deja de poder proponer y aprobar cambios. ¿Continuar?`;
};
```

(c) En `renderLista`, reemplazar

```js
  pintar('lista-lectores', vigentes.filter(u => !esAprobador(u)),
    texto ? 'Ningún usuario de solo lectura coincide con la búsqueda.' : 'No hay usuarios de solo lectura.');
```

por

```js
  pintar('lista-editores', vigentes.filter(u => u.rol === 'editor'),
    texto ? 'Ningún editor coincide con la búsqueda.' : 'No hay editores.');
  pintar('lista-lectores', vigentes.filter(u => u.rol === 'lector'),
    texto ? 'Ningún usuario de solo lectura coincide con la búsqueda.' : 'No hay usuarios de solo lectura.');
```

y `const lectores = usuarios.filter(u => u.estado !== 'desactivado' && !esAprobador(u)).length;` por `const lectores = usuarios.filter(u => u.estado !== 'desactivado' && u.rol === 'lector').length;`.

(d) En `abrirModal`, reemplazar

```js
  const protegida = Boolean(u) && u.rol === 'superadmin' && !soyYo(u);
```

por

```js
  // Solo lectura: la cuenta protegida del superadmin o, para un editor, cualquiera que no sea lector (spec 2026-10-15, 8.1)
  const aviso = avisoSoloLectura(u);
  const protegida = Boolean(aviso);
```

reemplazar `document.getElementById('aviso-protegida').hidden = !protegida;` por

```js
  document.getElementById('aviso-protegida').hidden = !protegida;
  document.getElementById('aviso-protegida').textContent = aviso ?? '';
```

y `selectRol.disabled = protegida || superadminPropio;` por `selectRol.disabled = protegida || superadminPropio || soyEditor();`.

(e) En `guardarUsuario`, reemplazar `if (!selectRol.disabled) datos.rol = selectRol.value;` por

```js
  // En el alta el rol va siempre (al editor el selector le queda fijo en Lector)
  if (!abierto || !selectRol.disabled) datos.rol = selectRol.value;
```

y el bloque de la confirmación

```js
  if (abierto && datos.rol && datos.rol !== abierto.rol) {
    const texto = soyYo(abierto)
      ? 'Vas a perder el acceso de administrador en este momento. ¿Continuar?'
      : datos.rol === 'admin'
        ? `${abierto.nombre_completo} va a pasar a Admin: podrá proponer y aprobar cambios. ¿Continuar?`
        : `${abierto.nombre_completo} va a pasar a Lector: deja de poder proponer y aprobar cambios. ¿Continuar?`;
    if (!confirm(texto)) return;
  }
```

por

```js
  if (abierto && datos.rol && datos.rol !== abierto.rol && !confirm(textoCambioDeRol(abierto, datos.rol))) return;
```

- [ ] **Step 6: `public/js/perfil.js`.**

(a) En `renderCambioCard`, reemplazar `Revisado por: ${Utils.escapeHtml(cambio.revisor_nombre)}` por `${Utils.escapeHtml(textoRevisor(cambio))}`.

(b) En `verDetalle`, reemplazar

```js
    if (cambio.estado === 'pendiente' && !esPropioCambio) {
      footer.innerHTML = `
        <button class="btn btn-secondary" onclick="cerrarModalDetalle()">Cerrar</button>
        <button class="btn btn-danger" onclick="cerrarModalDetalle(); abrirModalRechazo(${cambio.id})">✗ Rechazar</button>
        <button class="btn btn-success" onclick="aprobarCambio(${cambio.id})">✓ Aprobar</button>
      `;
    } else {
```

por

```js
    if (cambio.estado === 'pendiente' && !esPropioCambio) {
      // Si no le corresponde auditarlo (un editor con auditores disponibles, spec 2026-10-15, 8.2), los botones aparecen
      // deshabilitados y el motivo, debajo del detalle
      const permiso = cambio.auditoria ?? { puede: true, mensaje: null };
      if (!permiso.puede && permiso.mensaje) contenido.insertAdjacentHTML('beforeend', avisoNoCorresponde(permiso.mensaje));
      footer.innerHTML = botonesDeAuditoria(cambio.id, permiso);
    } else {
```

(c) Agregar al final del archivo:

```js
// =====================================================
// AUDITAR UN CAMBIO (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.2)
// =====================================================
// Botones del detalle de un cambio. permiso: { puede, mensaje } que manda el servidor; sin permiso, deshabilitados con
// el motivo
function botonesDeAuditoria(id, permiso) {
  const cerrar = '<button class="btn btn-secondary" onclick="cerrarModalDetalle()">Cerrar</button>';
  if (permiso.puede) {
    return `
        ${cerrar}
        <button class="btn btn-danger" onclick="cerrarModalDetalle(); abrirModalRechazo(${Number(id)})">✗ Rechazar</button>
        <button class="btn btn-success" onclick="aprobarCambio(${Number(id)})">✓ Aprobar</button>
      `;
  }
  const motivo = Utils.escapeHtml(permiso.mensaje ?? '');
  return `
        ${cerrar}
        <button class="btn btn-danger" disabled title="${motivo}">✗ Rechazar</button>
        <button class="btn btn-success" disabled title="${motivo}">✓ Aprobar</button>
      `;
}

function avisoNoCorresponde(mensaje) {
  return `<div class="alert alert-warning" style="margin-top: 1rem;">${Utils.escapeHtml(mensaje)}</div>`;
}

// Quién auditó un cambio: "Aprobado por …" o "Rechazado por …", con "(respaldo)" si lo auditó un editor porque no había
// auditores disponibles
function textoRevisor(cambio) {
  const accion = cambio.estado === 'aprobado' ? 'Aprobado' : 'Rechazado';
  return `${accion} por ${cambio.revisor_nombre}${Number(cambio.revisado_como_respaldo) ? ' (respaldo)' : ''}`;
}
```

- [ ] **Step 7: Tests del frontend**

Run: `node --test tests/auth-frontend.test.js tests/usuarios-frontend.test.js tests/perfil-frontend.test.js tests/main-frontend.test.js tests/paginas.test.js`
Expected: PASS.

- [ ] **Step 8: Recorrido en el navegador** (app local: `npm start`; con usuarios de prueba creados para esto en la base local, por ejemplo con `npm run setup-admin` —un editor, un admin y un lector, emails `@rpad.test`—, nunca con usuarios reales): como editor, el header dice "Editor"; Usuarios muestra el grupo "Editores"; "Nuevo usuario" deja el rol fijo en Lector; al abrir un admin se ve "Como editor, solo podés modificar usuarios lectores." y no hay acciones; como admin, proponer un cambio de un dataset y, como editor, abrir Mi Perfil → Para revisar → Revisar: los botones aparecen deshabilitados con el mensaje que nombra a los auditores disponibles. Anotar en el reporte lo que se vio. Al terminar, borrar de la base local ese cambio pendiente de prueba (`DELETE FROM cambios_pendientes WHERE id = …`, con `mdb`) y los usuarios de prueba (antes, sus filas de `usuarios_auditoria` y `usuarios_tokens`).

- [ ] **Step 9: Suite completa** — `npm test 2>&1 | tail -15`: `ℹ fail 0`, ninguna falla nueva.

- [ ] **Step 10: Commit**

```bash
git add public/js/auth.js public/usuarios.html public/js/usuarios.js public/js/perfil.js public/*.html tests/paginas.test.js tests/auth-frontend.test.js tests/usuarios-frontend.test.js tests/perfil-frontend.test.js
git commit -m "feat: editor en el frontend: header, panel de usuarios y Para revisar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 11: La nota de auditoría en la pantalla de Correos

**Files:**
- Modify: `public/correos.html`
- Modify: `public/js/correos.js`
- Test: `tests/correos-frontend.test.js` (agregar)

**Interfaces:**
- Consumes: la API de la Task 9 (`tipo=auditoria` en vista previa, PDF y prueba; `cantidad_cambios` en el libro; `cambios` en el detalle; `para_auditoria`/`cc_auditoria` en la configuración; `auditoria` en el Estado). `API.previewNota`, `API.previewNotaPdf` y `API.enviarPruebaNota` ya mandan `tipo` y `gestion`: con `tipo=auditoria` el servidor ignora la gestión, así que `api.js` no cambia.
- Produces: en `correos.js`, `celdaCantidad(n)`, `textoCambioDeNota(c)`, `textoAuditoria(a)`, `nombreVistaPrevia(tipo, gestion)`, `actualizarSelectorGestion()`; `ETIQUETAS.auditoria = 'Auditoría'`.

- [ ] **Step 1: Test que falla.** Agregar al final de `tests/correos-frontend.test.js`:

```js
describe('correos.js: nota de auditoría (spec 2026-10-15-dias-habiles-licencias-auditoria, 10.4)', () => {
  const evaluar = (contexto, expresion) => vm.runInContext(expresion, contexto);

  it('el libro muestra el tipo Auditoría, sin gestión y con la cantidad de cambios', () => {
    const { contexto } = cargarCorreos();
    assert.equal(evaluar(contexto, 'ETIQUETAS.auditoria'), 'Auditoría');
    assert.equal(evaluar(contexto, 'textoGestion(null)'), '—');
    assert.equal(evaluar(contexto, "celdaCantidad({ tipo: 'auditoria', cantidad_cambios: 3, es_prueba: 0 })"), '3 cambio(s)');
    assert.equal(evaluar(contexto, "celdaCantidad({ tipo: 'aviso', cantidad_datasets: 2, es_prueba: 0 })"), '2');
    assert.equal(evaluar(contexto, "celdaCantidad({ tipo: 'reiteracion', cantidad_datasets: 1, seccion_dataset: 'vencido', es_prueba: 0 })"), '1 (vencido)');
    assert.equal(evaluar(contexto, "celdaCantidad({ tipo: 'autorizacion', es_prueba: 0 })"), '—');
    assert.equal(evaluar(contexto, "celdaCantidad({ tipo: 'auditoria', cantidad_cambios: 0, es_prueba: 1 })"), '—');
  });

  it('el detalle de la nota lista los cambios incluidos', () => {
    const { contexto } = cargarCorreos();
    assert.equal(evaluar(contexto, "textoCambioDeNota({ tipo_cambio: 'editar', titulo: 'Presupuesto', seccion: 'nuevo', estado: 'pendiente' })"),
      'Modificación: Presupuesto (nuevo)');
    assert.equal(evaluar(contexto, "textoCambioDeNota({ tipo_cambio: 'crear', titulo: 'Nuevo', seccion: 'reiterado', estado: 'aprobado' })"),
      'Alta: Nuevo (reiterado, aprobado)');
  });

  it('el Estado dice cuántos cambios van por nota y cuándo sale la próxima', () => {
    const { contexto } = cargarCorreos();
    assert.equal(evaluar(contexto, "textoAuditoria({ canal_nota: 2, proxima: '2026-10-26' })"),
      'Auditoría de cambios: 2 cambio(s) para pedir por nota; próxima nota de auditoría: 26/10/2026.');
    assert.equal(evaluar(contexto, 'textoAuditoria({ canal_nota: 0, proxima: null })'),
      'Auditoría de cambios: no hay cambios para pedir por nota.');
    assert.equal(evaluar(contexto, 'textoAuditoria(undefined)'), 'Auditoría de cambios: no hay cambios para pedir por nota.');
  });

  it('la vista previa de auditoría no usa la gestión', () => {
    const { contexto } = cargarCorreos();
    assert.equal(evaluar(contexto, "nombreVistaPrevia('auditoria', 'interna')"), 'Nota-Digital-vista-previa-auditoria.pdf');
    assert.equal(evaluar(contexto, "nombreVistaPrevia('aviso', 'externa')"), 'Nota-Digital-vista-previa-aviso-externa.pdf');
    evaluar(contexto, "document.getElementById('preview-tipo').value = 'auditoria'");
    contexto.actualizarSelectorGestion();
    assert.equal(evaluar(contexto, "document.getElementById('preview-gestion').disabled"), true);
    evaluar(contexto, "document.getElementById('preview-tipo').value = 'aviso'");
    contexto.actualizarSelectorGestion();
    assert.equal(evaluar(contexto, "document.getElementById('preview-gestion').disabled"), false);
  });
});
```

Run: `node --test tests/correos-frontend.test.js`
Expected: FAIL (`celdaCantidad is not defined`).

- [ ] **Step 2: `public/js/correos.js`.**

(a) Reemplazar

```js
const CAMPOS_CONFIG = ['para_interna', 'cc_interna', 'linea_cc_interna', 'para_externa', 'cc_externa', 'linea_cc_externa',
  'cco', 'casillas_prueba', 'firma_nombre', 'firma_cargo', 'membrete_pie'];
```

por

```js
const CAMPOS_CONFIG = ['para_interna', 'cc_interna', 'linea_cc_interna', 'para_externa', 'cc_externa', 'linea_cc_externa',
  'para_auditoria', 'cc_auditoria', 'cco', 'casillas_prueba', 'firma_nombre', 'firma_cargo', 'membrete_pie'];
```

(b) En `ETIQUETAS`, agregar `auditoria: 'Auditoría'` (después de `autorizacion: 'Autorización'`).

(c) Después de `const textoGestion = …`, agregar:

```js
// Columna "Datasets" del libro: la nota de autorización no tiene; la de auditoría cuenta cambios (spec 2026-10-15, 10.4)
const celdaCantidad = (n) => {
  if (n.es_prueba || n.tipo === 'autorizacion') return '—';
  if (n.tipo === 'auditoria') return `${n.cantidad_cambios} cambio(s)`;
  return `${n.cantidad_datasets}${n.seccion_dataset ? ` (${n.seccion_dataset === 'vencido' ? 'vencido' : 'próximo'})` : ''}`;
};
const TIPO_DE_CAMBIO = { crear: 'Alta', editar: 'Modificación', eliminar: 'Baja' };
// Un cambio incluido en una nota de auditoría, para el detalle de la nota
const textoCambioDeNota = (c) => `${TIPO_DE_CAMBIO[c.tipo_cambio] ?? c.tipo_cambio}: ${c.titulo ?? 'Sin título'} `
  + `(${c.seccion === 'nuevo' ? 'nuevo' : 'reiterado'}${c.estado === 'pendiente' ? '' : `, ${c.estado}`})`;
// La nota de auditoría en el Estado (spec 10.4)
const textoAuditoria = (a) => (!a || a.canal_nota === 0
  ? 'Auditoría de cambios: no hay cambios para pedir por nota.'
  : `Auditoría de cambios: ${a.canal_nota} cambio(s) para pedir por nota; próxima nota de auditoría: ${fecha(a.proxima)}.`);
// Nombre del PDF de la vista previa: la nota de auditoría no tiene gestión
const nombreVistaPrevia = (tipo, gestion) => `Nota-Digital-vista-previa-${tipo}${tipo === 'auditoria' ? '' : `-${gestion}`}.pdf`;
```

(`fecha` está definida más abajo en el archivo: estas funciones la usan recién cuando se llaman.)

(d) En el `DOMContentLoaded`, después de `document.getElementById('preview-tipo').addEventListener('change', actualizarBotonAnexo);`, agregar `document.getElementById('preview-tipo').addEventListener('change', actualizarSelectorGestion);`, y después de `actualizarBotonAnexo();` (la llamada suelta antes de `inicializarFiltros();`), agregar `actualizarSelectorGestion();`.

(e) En `cargarEstado`, después de `licencia.hidden = !estado.licencia_firmante;`, agregar

```js
    document.getElementById('nd-auditoria').textContent = textoAuditoria(estado.auditoria);
```

(f) En `cargarLibro`, reemplazar la celda de datasets

```js
        <td>${n.es_prueba || n.tipo === 'autorizacion' ? '—' : `${n.cantidad_datasets}${n.seccion_dataset ? ` (${n.seccion_dataset === 'vencido' ? 'vencido' : 'próximo'})` : ''}`}</td>
```

por

```js
        <td>${celdaCantidad(n)}</td>
```

(g) En `accionDelLibro`, en la rama `'ver'`, después de `errorNota.hidden = !nota.ultimo_error;`, agregar

```js
      // Nota de auditoría: los cambios que incluye (spec 2026-10-15, 10.4)
      const cambios = document.getElementById('modal-nota-cambios');
      cambios.innerHTML = (nota.cambios ?? []).map(c => `<li>${Utils.escapeHtml(textoCambioDeNota(c))}</li>`).join('');
      cambios.hidden = !nota.cambios?.length;
```

(h) En `verVistaPrevia`, reemplazar

```js
        : `Con los datos de hoy esta nota incluiría ${vista.cantidad} dataset(s). Asunto: ${vista.asunto}`;
```

por

```js
        : `Con los datos de hoy esta nota incluiría ${vista.cantidad} ${tipo === 'auditoria' ? 'cambio(s)' : 'dataset(s)'}. Asunto: ${vista.asunto}`;
```

y en `verPdfDeVistaPrevia`, reemplazar `` `Nota-Digital-vista-previa-${tipo}-${gestion}.pdf` `` por `nombreVistaPrevia(tipo, gestion)`.

(i) Agregar, después de `actualizarBotonAnexo`:

```js
// La nota de auditoría no tiene gestión: el selector de gestión se deshabilita mientras está elegida
function actualizarSelectorGestion() {
  document.getElementById('preview-gestion').disabled = document.getElementById('preview-tipo').value === 'auditoria';
}
```

- [ ] **Step 3: `public/correos.html`.**

(a) En la tarjeta de Estado, después de `<p id="nd-licencia" class="test-hint" hidden></p>`, agregar

```html
                <p id="nd-auditoria" class="test-hint"></p>
```

y, después del `<p class="test-hint">` que explica los avisos y las reiteraciones, agregar

```html
                <p class="test-hint">Nota de auditoría: pide a la Dirección General que audite los cambios pendientes que el firmante no puede auditar y que ya tuvieron su recordatorio un día hábil anterior. Sale una por día y se reitera cada 5 días hábiles mientras sigan pendientes.</p>
```

(b) En el selector `filtro-tipo` (libro), después de `<option value="autorizacion">Autorización</option>`, agregar `<option value="auditoria">Auditoría</option>`; en el selector `preview-tipo` (vista previa), después de **su** `<option value="reiteracion">Reiteración</option>` (el libro tiene otra igual), agregar `<option value="auditoria">Auditoría</option>`.

(c) En el formulario de Configuración, después del `</fieldset>` de "Gestión externa", agregar

```html
                    <fieldset>
                        <legend>Notas de auditoría</legend>
                        <div class="form-group"><label class="form-label" for="para_auditoria">Para</label><input id="para_auditoria" class="form-input" autocomplete="off"></div>
                        <div class="form-group"><label class="form-label" for="cc_auditoria">CC</label><input id="cc_auditoria" class="form-input" autocomplete="off"></div>
                        <p class="form-hint">La copia oculta (CCO) es la de respaldo, la misma de las demás notas.</p>
                    </fieldset>
```

(d) En el modal de la nota, después de `<p id="modal-nota-error" class="nd-alerta" hidden></p>`, agregar

```html
                        <ul id="modal-nota-cambios" class="test-hint" hidden></ul>
```

(e) Cambiar `js/correos.js?v=20261021` por `js/correos.js?v=20261022`.

- [ ] **Step 4: Tests del frontend**

Run: `node --test tests/correos-frontend.test.js tests/paginas.test.js`
Expected: PASS. Además, `grep -rn 'v=20261021' public/` no devuelve nada.

- [ ] **Step 5: Recorrido en el navegador** (app local, con un usuario admin de prueba creado para esto; nunca con usuarios reales; **el envío automático de la base local no se toca**): Correos → Vista previa → tipo **Auditoría** (el selector de gestión queda deshabilitado) → "Vista previa" (datos de ejemplo) y "Ver PDF" (se descarga `Nota-Digital-vista-previa-auditoria.pdf` con el detalle, "Qué implica la auditoría:" e "Importancia:"); Configuración muestra "Notas de auditoría" con `mit@comodoro.gov.ar`; Estado muestra la línea de auditoría; el libro filtra por "Auditoría". **No** usar "Enviarme una prueba" salvo que las casillas de prueba de la base local sean de Mailpit o `@rpad.test`. Anotar lo visto en el reporte; al terminar, borrar el usuario de prueba.

- [ ] **Step 6: Suite completa** — `npm test 2>&1 | tail -15`: `ℹ fail 0`, ninguna falla nueva.

- [ ] **Step 7: Commit**

```bash
git add public/correos.html public/js/correos.js tests/correos-frontend.test.js
git commit -m "feat: la nota de auditoría en la pantalla de Correos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 12: Documentación

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: CLAUDE.md.**

(a) En `### Doble verificación (CRÍTICO)`, reemplazar

```markdown
1. Un admin propone el cambio → se crea registro en `cambios_pendientes`
2. Un admin DIFERENTE aprueba o rechaza → se aplica al dataset
```

por

```markdown
1. Un admin o un editor propone el cambio → se crea registro en `cambios_pendientes`
2. Otra persona aprueba o rechaza → se aplica al dataset. Auditan los auditores (superadmin o admin); un editor, solo de respaldo, si ese día no hay ningún auditor disponible que no lo haya propuesto (`permisoParaAuditar` en `services/auditoriaReglas.js`; queda `cambios_pendientes.revisado_como_respaldo`)
```

(b) En `### Roles`, después de la línea de `**admin:**`, agregar

```markdown
- **editor:** todo lo de admin, pero audita cambios solo de respaldo y en el panel de usuarios solo crea y modifica lectores (no cambia roles, tampoco el suyo). Puede tener licencia, cargar su firma y ser la persona autorizada del firmante, pero no firmante titular.
```

reemplazar

```markdown
- El rol y el estado activo se leen de la base en cada pedido (`authMiddleware`): desactivar o cambiar un rol tiene efecto inmediato. `esAdmin(rol)` (services/usuariosReglas.js) y `Auth.isAdmin()` incluyen al superadmin: no comparar con `'admin'` a mano.
- Siempre tiene que haber al menos 2 aprobadores activos (admin o superadmin): el panel no deja bajar de ese mínimo.
```

por

```markdown
- El rol y el estado activo se leen de la base en cada pedido (`authMiddleware`): desactivar o cambiar un rol tiene efecto inmediato. `esAdmin(rol)` (services/usuariosReglas.js) y `Auth.isAdmin()` incluyen al superadmin y al editor (acceso a la administración); `esAuditor(rol)` y `Auth.isAuditor()` (superadmin o admin) deciden quién audita y quién cuenta para el mínimo: no comparar con `'admin'` a mano.
- Siempre tiene que haber al menos 2 auditores activos (superadmin o admin, con contraseña): el panel no deja bajar de ese mínimo, y pasar a un admin a editor cuenta como quitar uno. El firmante titular no puede pasar a editor ni a lector.
```

y en la línea de `**superadmin:**`, reemplazar `recibe un aviso cuando otro admin crea un admin, cambia un rol, cambia el email de un admin, reactiva a un admin o desactiva a alguien` por `recibe un aviso cuando otro usuario crea un admin o un editor, cambia un rol, cambia el email de un admin o un editor, reactiva a uno de ellos o desactiva a alguien`.

(c) En `### Base de datos`, reemplazar la primera línea (la que empieza con `- 23 tablas (ver`) por

```markdown
- 24 tablas (ver `database/schema.sql`). Usuarios: `usuarios` (rol, cargo, vínculo, `sesion_version`), `usuarios_tokens` (links de acceso, solo el hash), `usuarios_auditoria` (historial del panel), `usuarios_licencias` (licencias; nunca se borran, se anulan) y `usuarios_firmas` (firma de cada usuario para las notas). Notas de auditoría: `notas_digitales_cambios` (qué cambios incluyó cada una, `nuevo` o `reiterado`)
```

(d) En `### Recordatorios automáticos`, reemplazar

```markdown
- Cron 8:15 (`/api/cron/notificaciones`): aviso a las áreas (`services/avisosDiariosService.js`) y Notas Digitales (`services/notasDigitales.js`).
- Cron 14:00 (`/api/cron/cambios-pendientes`): email de cambios pendientes a los admins.
```

por

```markdown
- Cron 8:15 (`/api/cron/notificaciones`): aviso a las áreas (`services/avisosDiariosService.js`) y Notas Digitales (`services/notasDigitales.js`), con la nota de auditoría al final.
- Cron 14:00 (`/api/cron/cambios-pendientes`): recordatorio de cambios pendientes (`enviarCambiosPendientes`) a quienes pueden auditarlos.
```

(e) Agregar, después de la sección `### Firma de las Notas Digitales y licencia del firmante`:

```markdown
### Auditoría de cambios pendientes
- Disponible (un día dado) = activo, con contraseña y sin licencia: solo lo calcula `personasDeAuditoria` (`services/auditoriaService.js`). El canal de cada cambio lo decide una sola función pura, `canalDelCambio` (`services/auditoriaReglas.js`), igual para el recordatorio de las 14:00 y la nota de las 8:15.
- Canal **nota** (spec 9.1): ya tuvo su primer recordatorio un día hábil anterior (`cambios_pendientes.primer_recordatorio_at`), el firmante titular (sin titular, el superadmin) no puede auditarlo, hay auditores disponibles y hay quién firme. Si no, canal **recordatorio**.
- Recordatorio: solo días hábiles, los cambios propuestos hace una hora o más. `created_at` es TIMESTAMP y la base puede estar en UTC: la antigüedad se mide en SQL con `TIMESTAMPDIFF(SECOND, created_at, NOW())` (reloj y zona de la base en los dos extremos), nunca comparando su texto con `ahoraArgentina()`.
- Nota de auditoría (tipo `auditoria`, sin gestión, numeración del libro): una por día, después de avisos y reiteraciones; nuevos y reiterados a los 5 días hábiles de la última nota; destinatarios `para_auditoria` y `cc_auditoria` de `notas_digitales_config`, con el `cco` general.
```

- [ ] **Step 2: README.**

(a) En `## Roles de Usuario`: reemplazar `El sistema cuenta con tres roles de usuario:` por `El sistema cuenta con cuatro roles de usuario:`; en la fila de `superadmin`, reemplazar `Recibe un email cuando otro admin crea un admin, cambia un rol, cambia el email de un admin, reactiva a un admin o desactiva a alguien.` por `Recibe un email cuando otro usuario crea un admin o un editor, cambia un rol, cambia el email de un admin o un editor, reactiva a uno de ellos o desactiva a alguien.`; y agregar, después de la fila de `admin`:

```markdown
| `editor` | Administrador sin la responsabilidad formal de auditar | Todo lo de `admin`, con dos diferencias: audita cambios de otros solo **de respaldo** (si ese día no hay ningún auditor disponible) y en el panel de usuarios solo crea y modifica lectores. Puede tener licencia, cargar su firma y ser la persona autorizada del firmante, pero no ser firmante titular. |
```

(b) Reemplazar `Los cambios sobre datasets requieren doble verificación: un admin (o el superadmin) propone y otro distinto aprueba o rechaza.` por `Los cambios sobre datasets requieren doble verificación: alguien propone y otra persona aprueba o rechaza. Auditan los **auditores** (superadmin y admins); un editor, solo si ese día no hay ningún auditor disponible que no lo haya propuesto, y el cambio queda "aprobado de respaldo".`

(c) En `### Panel de usuarios`: reemplazar `En **Administración → Usuarios**, admin y superadmin pueden:` por `En **Administración → Usuarios**, admin y superadmin pueden (el editor, solo sobre lectores y sin cambiar roles):`; `y rol (admin o lector).` por `y rol (admin, editor o lector).`; `Siempre tiene que haber al menos **2 usuarios que puedan aprobar cambios**: el panel no deja desactivar ni pasar a lector a un admin si quedarían menos.` por `Siempre tiene que haber al menos **2 auditores** (superadmin o admins activos): el panel no deja desactivar ni pasar a editor o a lector a un admin si quedarían menos, ni pasar a editor o a lector a quien firma las Notas Digitales.`; y `El superadmin recibe un aviso por email cuando otro admin crea un administrador, cambia un rol, cambia el email de un administrador, reactiva a un administrador o desactiva a alguien.` por `El superadmin recibe un aviso por email cuando otro usuario crea un administrador o un editor, cambia un rol, cambia el email de un administrador o un editor, reactiva a uno de ellos o desactiva a alguien.`

(d) En `### 2. Configurar en cPanel → Tareas Cron`: después de la línea `- **Reiteración**: …`, agregar

```markdown
- **Nota de auditoría**: pide a la Dirección General la auditoría de los cambios pendientes que el firmante no puede auditar (los propuso él o está de licencia) y que ya tuvieron su recordatorio un día hábil anterior. Sale una sola por día, después de avisos y reiteraciones, y se reitera cada 5 días hábiles mientras sigan pendientes. Destinatarios en Correos → Configuración → Notas de auditoría.
```

y reemplazar `El de las **14:00** envía a cada administrador el email con los cambios pendientes de aprobación que puede revisar (nunca los propios).` por `El de las **14:00** envía el **recordatorio** de cambios pendientes: a cada persona que puede auditar un cambio (los auditores disponibles o, si no hay ninguno, los editores, de respaldo), los cambios propuestos hace una hora o más que no van por nota de auditoría (nunca los propios). Quien está de licencia no lo recibe.`

(e) En `### Cron (requiere secret)`, reemplazar `Email de cambios pendientes a los admins (para cron)` por `Recordatorio de cambios pendientes (para cron)`.

(f) Agregar, antes de `### Migración: Licencias y firmas`:

```markdown
### Migración: Editor y auditoría

⚠️ Requisito: la migración de licencias y firmas aplicada. No hay dependencias nuevas de npm.

1. **Backup de la base** (phpMyAdmin → Exportar → Personalizado, con "Agregar sentencia DROP TABLE / VIEW / PROCEDURE / FUNCTION / EVENT / TRIGGER") y **de los archivos** (comprimir `controllers`, `routes`, `services`, `scripts` y `public` dentro de la carpeta de la app).
2. **Migración de estructura:** phpMyAdmin → pestaña **SQL** → pegar `database/updates/migracion-editor-auditoria.sql` → **Continuar**. Agrega el rol `editor`, dos columnas a los cambios pendientes, el tipo de nota `auditoria`, la tabla de los cambios de cada nota de auditoría y los destinatarios de auditoría (Para: `mit@comodoro.gov.ar`); no cambia datos y el código actual sigue funcionando con la estructura nueva. Si se corta a mitad, se puede volver a correr.
3. **Subir los archivos** (zip con los archivos que cambian y sus carpetas → Cargar → Extraer en la carpeta de la app) y, enseguida, **Setup Node.js App → Restart**. No hace falta "Run NPM Install".
4. **Editores:** el superadmin entra a Usuarios y pasa a **Editor** a quien corresponda (Ver → Rol → Guardar cambios). No hace falta SQL privado. El panel no deja bajar de 2 auditores ni pasar a editor a quien firma las notas.
5. **Destinatarios de auditoría:** Correos → Configuración → "Notas de auditoría": revisar el Para y el CC, y guardar.
6. **Verificar:** Correos → Vista previa → tipo **Auditoría** → "Vista previa" y "Ver PDF"; Correos → Estado muestra la línea de auditoría; un editor ve su rol en el encabezado y, en Mi Perfil → Para revisar, los botones deshabilitados mientras haya auditores disponibles.

**Si algo sale mal:** subir de nuevo los archivos del backup → Restart → phpMyAdmin → pegar `database/updates/rollback-editor-auditoria.sql`.

- El rollback pasa a admin a los editores (vuelven a aprobar cambios como cualquier admin) y deja la estructura como estaba; se pierden la fecha del primer recordatorio de cada cambio, la marca de aprobación de respaldo, qué cambios incluyó cada nota de auditoría y los destinatarios de auditoría. Las notas de auditoría quedan en el libro, que en la versión anterior las muestra con el tipo vacío ("undefined").
- Si el rollback SQL falla, la alternativa es restaurar el backup del paso 1: phpMyAdmin → **Importar**. Se pierde lo cargado en el sistema desde que se hizo ese backup.
```

(g) En `## Changelog`, agregar arriba de `### Días hábiles, licencias y firmas (2026-10)`:

```markdown
### Editor y auditoría de cambios pendientes (2026-10)
- Rol `editor`: todo lo de un admin, pero audita cambios solo de respaldo (si ningún auditor está disponible) y en el panel solo crea y modifica lectores
- Mínimo de 2 auditores (superadmin o admins); el firmante titular sigue siendo superadmin o admin
- Recordatorio de las 14:00 (solo días hábiles) a quienes pueden auditar cada cambio, desde una hora después de propuesto
- Nota Digital de auditoría a la Dirección General para los cambios que el firmante no puede auditar, reiterada cada 5 días hábiles
```

- [ ] **Step 3: Suite completa** — `npm test 2>&1 | tail -15`: `ℹ fail 0`, ninguna falla nueva (la documentación no tiene tests: es la última comparación con la línea de base antes de la revisión final).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: editor, auditoría de cambios pendientes y despliegue de la entrega 3

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Después de la Task 12 (lo hace quien coordina)

- Suite completa en la rama: ninguna falla nueva respecto de la línea de base (`ℹ fail 0`).
- Merge en `main` según lo que elija el usuario (superpowers:finishing-a-development-branch).
- El kit de despliegue (zip, `PASOS.txt`) lo arma el usuario fuera de este plan. Archivos nuevos que el zip tiene que incluir: `services/auditoriaReglas.js` y `services/auditoriaService.js` (sin ellos la app no arranca).

