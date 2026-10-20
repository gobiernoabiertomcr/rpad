# El editor audita sin responsabilidad por la auditoría

Fecha: 20/10/2026.

Cambia la regla de la spec `2026-10-15-dias-habiles-licencias-auditoria-design.md`, sección 8.2 («Quién audita un cambio»), y lo que la spec `2026-10-16-perfil-pestanas-gestion-cambios-design.md` fija sobre el objeto `auditoria`. Todo lo demás de esas specs sigue igual.

## Por qué

Hoy un editor audita un cambio ajeno solo **de respaldo**: cuando ese día no hay ningún auditor (superadmin o admin) disponible que no lo haya propuesto. Si hay un auditor disponible, el editor ve el cambio en Mi Perfil con los botones deshabilitados, y el servidor responde 403 si intenta aprobarlo o rechazarlo.

En la práctica pasa que un auditor disponible le pide a un editor que audite el cambio de otro auditor. Con la regla de hoy, el editor no puede, y la única forma de habilitarlo (cargarle una licencia al auditor) sería registrar una ausencia que no existió. Si el sistema simplemente lo dejara aprobar, el registro diría «Aprobado por {editor}» y la responsabilidad de la auditoría le quedaría a quien solo hizo el trámite.

Lo que se quiere: que el editor pueda hacerlo, y que quede registrado que lo hizo **sin responsabilidad por la auditoría**. El usuario pidió explícitamente que sea simple: una marca, sin pasos nuevos para nadie (el auditor no tiene que delegar ni confirmar nada) y sin nombrar en la marca a quién le correspondía.

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- Un editor puede aprobar o rechazar un cambio propuesto por un auditor aunque haya auditores disponibles. Queda registrado como «sin responsabilidad por la auditoría».
- Antes de hacerlo, Mi Perfil le avisa que va a quedar registrado así, y la confirmación del aprobar lo repite.
- En Mi Perfil (Revisados y Mis cambios), el cambio dice «Aprobado por {nombre} (sin responsabilidad por la auditoría) el dd/mm/aaaa» (o «Rechazado por…»).

**No objetivos**
- No cambia el respaldo: si no hay auditores disponibles, el editor audita de respaldo, con responsabilidad, y la marca sigue siendo «(respaldo)».
- No cambia quién recibe el recordatorio de las 14:00, la nota de auditoría de las 8:15, el aviso a quien propone sin auditores, los días sin auditor (Licencias), ni Correos → Estado: todo eso sigue saliendo de `quienesAuditan`, que **no se toca**.
- No cambian el contador de «Para revisar» ni la campana: ya cuentan todos los pendientes ajenos.
- El Seguimiento (pantalla, PDF de descarga y anexo de la reiteración), las notas, el Libro, Gestión, los reportes y los emails **no muestran la marca** (hoy tampoco muestran «(respaldo)») y no se tocan.
- No hay email ni aviso nuevo a los auditores cuando un editor aprueba sin responsabilidad.
- Nadie audita sus propios cambios; el lector no audita. Sin cambios.

**Antiobjetivos** (sería un fracaso aunque funcione)
- Que un editor quede registrado **con** responsabilidad (de respaldo) sin haber visto ese aviso, o **sin** responsabilidad sin haberlo confirmado.
- Que un cambio propuesto por un editor termine aprobado sin que lo audite ningún auditor (salvo el respaldo de siempre, cuando no hay auditores).
- Que el texto largo de la marca llegue al Seguimiento o a un PDF (la columna «Quién» del PDF corta con «…» y cortaría el nombre).
- Que una aprobación o un rechazo den error 500 por el orden del despliegue.

## La regla

`permisoParaAuditar(usuario, proponenteId, personas)` (`services/auditoriaReglas.js`) pasa a devolver siempre `{ puede, respaldo, sin_responsabilidad, mensaje }` y decide así (quien revisa ya no es quien propuso: eso lo controla el controlador antes, como hoy):

| Quién revisa | ¿Hay auditores disponibles que no lo propusieron? | Quién lo propuso (rol actual) | Resultado |
|---|---|---|---|
| Auditor | — | — | `puede: true`, `respaldo: false`, `sin_responsabilidad: false`, `mensaje: null` |
| Editor | No | — | `puede: true`, `respaldo: true`, `sin_responsabilidad: false`, `mensaje: null` (como hoy) |
| Editor | Sí | Auditor (superadmin o admin) | `puede: true`, `respaldo: false`, `sin_responsabilidad: true`, `mensaje:` el aviso (ver abajo) |
| Editor | Sí | Editor, u otro rol, o no se encuentra | `puede: false`, `respaldo: false`, `sin_responsabilidad: false`, `mensaje: mensajeNoCorresponde(...)` (como hoy) |
| Otro rol (lector) | — | — | `puede: false`, `mensaje:` «Solo pueden auditar cambios los auditores y los editores.» |

- «Auditores disponibles que no lo propusieron» es exactamente lo que hoy calcula `quienesAuditan(personas, proponenteId)` (`respaldo: false` y su lista de personas). No se cambia `quienesAuditan`.
- El rol del proponente es el **actual** (decisión del usuario), leído de `personas` (que ya trae a todos los superadmin, admin y editores, activos o no, con su rol: `leerPersonasYLicencias`). No se guarda el rol al proponer: sin columnas extra. Caso límite aceptado: si un editor propone y lo pasan a admin con el cambio pendiente, ese cambio pasa a contar como de un auditor. Al revés (un admin que pasa a editor), sus pendientes dejan de poder aprobarse sin responsabilidad. Si el proponente no está en `personas` (ya no tiene uno de esos roles), no vale «sin responsabilidad»: falla cerrado.
- `respaldo` y `sin_responsabilidad` nunca son verdaderos a la vez (el respaldo solo existe cuando no hay auditores).
- El aviso (`mensaje` cuando `sin_responsabilidad`): «Este cambio lo auditan {nombres}. Si lo aprobás o lo rechazás vos, queda registrado sin responsabilidad por la auditoría.» Los nombres, como hoy en `mensajeNoCorresponde` («Ana», «Ana y Juan», «Ana, Juan y Pedro»). Lo arma el servidor: el navegador no copia el texto.
- La disponibilidad de quien revisa no se mira (igual que hoy con el respaldo).

## La API

**El objeto `auditoria`** de `GET /cambios-pendientes/para-revisar` (cada cambio) y de `GET /cambios-pendientes/:id` suma la clave `sin_responsabilidad`. En el detalle, las claves pasan a ser exactamente `mensaje`, `puede`, `respaldo` y `sin_responsabilidad`; en la lista, además `auditan` (como hoy). El valor por defecto cuando el cambio no es ajeno o no está pendiente suma `sin_responsabilidad: false`. `auditan` sigue trayendo los nombres de quienes lo auditan hoy y ahora también le sirve al editor que sí puede auditar.

**Aprobar y rechazar** (`POST /cambios-pendientes/:id/aprobar` y `/rechazar`) aceptan en el cuerpo `sin_responsabilidad` (booleano): lo que la persona vio y confirmó. Solo cuenta el `true` literal: si no viene, o viene otra cosa (`"true"`, `1`), vale `false`. El servidor, dentro de la transacción y después de los controles de hoy (pendiente, no propio):
1. calcula el permiso de hoy; si `puede` es falso, 403 con el `mensaje`, como hoy;
2. si `(cuerpo.sin_responsabilidad === true) !== permiso.sin_responsabilidad`, hace rollback y responde **409** con `{ success: false, error: 'La situación de este cambio cambió. Revisá el aviso y volvé a confirmar.' }`;
3. si no, aprueba o rechaza como hoy y escribe `revisado_como_respaldo = permiso.respaldo ? 1 : 0` y `revisado_sin_responsabilidad = permiso.sin_responsabilidad ? 1 : 0`.

Consecuencias buscadas:
- Un auditor o un editor de respaldo no mandan nada (o `false`) y todo sigue como hoy: ninguna llamada existente cambia de resultado.
- Si entre que el editor abre la fila y confirma la situación cambia (le cargan una licencia al último auditor disponible, vuelve un auditor, pasa la medianoche), el servidor frena con 409 en lugar de registrar algo que la persona no vio.
- Un `perfil.js` viejo en la caché del navegador no manda el campo: no puede aprobar sin responsabilidad (409). Falla cerrado.

**`api.js` no se toca.** Cambiarlo obliga a subir `VERSION` en las 15 páginas (`tests/paginas.test.js` exige la misma versión de `auth.js`, `main.js` y `api.js` en todas), y un `api.js` viejo en caché con el `perfil.js` nuevo dejaría al editor en un 409 tras otro. En su lugar, `perfil.js` aprueba y rechaza con `API.pedirJson('POST', '/cambios-pendientes/{id}/aprobar', { sin_responsabilidad })` y `API.pedirJson('POST', '/cambios-pendientes/{id}/rechazar', { comentario, sin_responsabilidad })`, que ya existe y pone `error.status` en el error: así reconoce el 409. `API.aprobarCambio` y `API.rechazarCambio` quedan como están (no los usa nadie más).

## La base

- Columna nueva en `cambios_pendientes`: `revisado_sin_responsabilidad tinyint(1) NOT NULL DEFAULT 0`, **al final**, después de `aviso_sin_auditores_at`. Tiene que ir ahí: `tests/schema.test.js` exige que `aviso_sin_auditores_at` siga inmediatamente a `revisado_como_respaldo`, y el test que corre el rollback y la migración del editor solo vuelve a dejar exactamente `schema.sql` con la columna al final.
- No se reutiliza `revisado_como_respaldo` con un valor 2: `perfil.js` lo lee con `Number(x) ?` y mostraría «(respaldo)», que dice lo contrario; además el nombre de la columna mentiría.
- `database/updates/migracion-editor-sin-responsabilidad.sql`: `SET NAMES utf8mb4;` y `ALTER TABLE cambios_pendientes ADD COLUMN IF NOT EXISTS ... AFTER aviso_sin_auditores_at;`, sin `USE`, `DELIMITER`, `DROP`, `RENAME` ni `CHECK`; se puede repetir. Cabecera como la de `migracion-editor-auditoria.sql`: la spec, «Solo agrega», «ORDEN: correr ANTES de subir el código (phpMyAdmin > pestaña SQL)», que se puede repetir y cuál es su rollback.
- `database/updates/rollback-editor-sin-responsabilidad.sql`: `DROP COLUMN IF EXISTS`, con la cabecera «primero volver a subir los archivos anteriores y Restart; después correr esto». Si alguna vez se revierte también `rollback-editor-auditoria.sql`, este va primero.
- `database/schema.sql` se actualiza a la par.
- Sin `CHECK`: la exclusión entre `revisado_como_respaldo` y `revisado_sin_responsabilidad` la garantiza `permisoParaAuditar`, con test.

## Mi Perfil

Lo que arma HTML sigue siendo puro y refleja lo que manda el servidor (`auditoria`); la UI no decide.

- **Cabecera de la fila** (`marcaDeAuditoria`): para un editor, «Podés auditarlo de respaldo» si `respaldo`; si no, «Lo auditan {nombres}» cuando `auditan` no está vacío, **también con `puede: true`** (hoy con `puede: true` sin respaldo devuelve vacío).
- **Aviso en la fila abierta**: con `sin_responsabilidad`, una nota ámbar con el `mensaje` del servidor, como la de hoy («no corresponde») pero con su propia clase (`pf-nota sin-responsabilidad`, mismos tokens de color). Va en el cuerpo de la fila (no en el pie de acciones), así sigue visible al confirmar, al escribir el motivo del rechazo y después de «Cancelar». Su `id` se suma al `aria-describedby` de Aprobar, Rechazar, «Sí, aprobar» y el campo del motivo.
- **Botones**: habilitados (como cualquier `puede: true`).
- **Confirmación del aprobar**: con `sin_responsabilidad`, la pregunta es «¿Aprobar sin responsabilidad por la auditoría? El cambio se aplica al dataset ahora.»; el resto del tiempo, la de hoy. Los botones siguen siendo «Cancelar» y «Sí, aprobar».
- **Rechazo**: igual que hoy (abre el motivo); el aviso de la fila ya dice que queda registrado sin responsabilidad.
- **Envío**: `aprobarCambio` y el rechazo mandan `sin_responsabilidad` con el valor del permiso que la fila mostró (leído de la lista cargada, como ya hace `cancelarAccion`).
- **409**: la página vuelve a pedir la lista de Para revisar, deja abierta la fila de ese cambio si sigue pendiente y muestra el error del servidor arriba (como los otros errores de aprobar y rechazar). La persona ve el aviso nuevo (o su ausencia) y vuelve a confirmar.
- **Quién auditó** (`textoRevisor`, Revisados y Mis cambios): «Aprobado por {nombre} (sin responsabilidad por la auditoría) el dd/mm/aaaa» y «Rechazado por …» si `revisado_sin_responsabilidad`; «(respaldo)» como hoy. Los dos datos vienen en `cp.*`; no hace falta tocar las consultas.
- Comentarios desactualizados de `perfil.js` y `perfil.html` se corrigen. Se sube el `?v=` de `perfil.js` (`perfil.html`) y `VERSION_PERFIL` (`tests/paginas.test.js`).

## Textos que hoy dicen «solo de respaldo»

- `public/usuarios.html`, grupo Editores: «Proponen cambios y auditan de respaldo o sin responsabilidad».
- `public/js/usuarios.js`, confirmaciones al pasar a Editor (la propia y la de otra persona): que diga que deja de ser auditor y que audita de respaldo, cuando no hay auditores disponibles, y sin responsabilidad por la auditoría los cambios de los auditores. Redacción final a criterio de quien construye, en el tono de las de hoy; se actualiza `tests/usuarios-frontend.test.js`.
- Si se cambia `usuarios.js`, se sube su `?v=` y `VERSION_PANTALLAS`.
- **No se toca `public/js/auth.js`** (ni su comentario «solo de respaldo»): cambiarlo obliga a subir `VERSION` en las 14 páginas.
- Siguen siendo correctos y no se tocan: «En esos días solo pueden auditar de respaldo» (Licencias, días sin auditor), «Te llega como respaldo» (recordatorio de las 14:00), Correos → Estado y la nota de auditoría.

## Tests

Cambian (afirman la regla vieja o la forma exacta del objeto):
- `tests/auditoria-reglas.test.js` (puro): la tabla de la regla, con `deepEqual` de las cuatro claves; casos: auditor; editor de respaldo; editor con auditores y cambio de un auditor (`sin_responsabilidad`); editor con auditores y cambio de un editor (403 como hoy); proponente que no está en `personas`; lector; que `respaldo` y `sin_responsabilidad` nunca sean los dos verdaderos.
- `tests/auditoria-api.test.js` (Docker): el editor con auditores disponibles aprueba y rechaza un cambio de un auditor con `sin_responsabilidad: true` (200, `revisado_sin_responsabilidad = 1`, `revisado_como_respaldo = 0`); sin el campo, 409 y el cambio sigue pendiente; con `true` siendo de respaldo, 409; un cambio de un editor sigue en 403; `fila()` suma la columna; el detalle con las cuatro claves.
- `tests/cambios-listas-api.test.js` (Docker): las claves del detalle pasan a ser cuatro; la lista del editor con `sin_responsabilidad`.
- `tests/perfil-frontend.test.js` (puro): el test «un editor sin permiso: los botones deshabilitados» se reescribe con un caso que siga siendo real (cambio de un editor); casos nuevos para la marca «Lo auditan» con `puede: true`, la nota `sin-responsabilidad`, la pregunta de la confirmación, el `aria-describedby`, `textoRevisor` con la marca nueva y el manejo del 409.
- `tests/usuarios-frontend.test.js` (puro): los textos de las confirmaciones.
- `tests/schema.test.js` (Docker): la columna nueva en la lista de `cambios_pendientes` y un `describe` de la migración nueva como el de «Requiere nota DGMIT» (cabecera, sin `DROP`/`RENAME`/`CHECK`/`USE`, repetible, y que migración + rollback + migración deje `schema.sql`).
- `tests/paginas.test.js`: las versiones.

No deberían cambiar (si cambian, algo se tocó de más): `avisos-diarios`, `notas-auditoria`, `auditoria-datos`, `licencias-api`, `email-diseno`, `correos-frontend`, todos los `seguimiento-*`, `notas-*`.

Antes de correr la suite en local hay que aplicar la migración a la base Docker (`datospublicos_mcr_rpad`): `schema.test.js` compara `schema.sql` con esa base, y varios tests de integración aprueban y rechazan cambios sobre ella. Regla del proyecto: `npm test` completo antes y después.

## Verificación con el caso real (pedido del usuario)

Además de la suite, la prueba de aceptación es el caso que originó este cambio, sobre una copia de la base de producción (nunca sobre la base real ni con envíos reales):
- El cambio pendiente de «Presupuesto Municipal», propuesto por el superadmin, con un admin disponible y sin licencia ese día.
- La editora entra a Mi Perfil → Para revisar: ve «Lo auditan {admin}», la nota ámbar con el aviso y los botones habilitados.
- Aprueba: la confirmación pregunta «¿Aprobar sin responsabilidad por la auditoría?»; al confirmar, el cambio queda aprobado y aplicado al dataset, con `revisado_sin_responsabilidad = 1` y `revisado_como_respaldo = 0`, y Revisados dice «Aprobado por {editora} (sin responsabilidad por la auditoría) el dd/mm/aaaa».
- Mis cambios del superadmin muestra lo mismo.
- Contraprueba en otra copia: con licencia del admin ese día, la editora audita de respaldo como hoy (`revisado_como_respaldo = 1`, «(respaldo)»).

## Documentación

- `CLAUDE.md`: la línea de la doble verificación (editor «solo de respaldo»), el rol editor, la descripción de `GET /:id` (`{ puede, respaldo, mensaje }` → con `sin_responsabilidad`) y una mención de la columna nueva.
- `README.md`: la tabla de roles, el párrafo de la doble verificación, una sección «Migración: …» como las otras, el archivo nuevo en el árbol de `database/updates` y una entrada en el Changelog.
- Spec `2026-10-15-dias-habiles-licencias-auditoria-design.md`, 8.2, y spec `2026-10-16-perfil-pestanas-gestion-cambios-design.md` (donde fija `{ puede, respaldo, mensaje }`): una nota «Cambio del 20/10/2026: ver `2026-10-20-editor-sin-responsabilidad-design.md`», sin reescribirlas.

## Despliegue

1. Respaldo de la base y de los archivos.
2. phpMyAdmin → SQL: `migracion-editor-sin-responsabilidad.sql`. Con el código viejo es inofensiva (`DEFAULT 0`; las listas usan `cp.*` y solo traen un campo de más).
3. Subir los archivos y Restart. No hace falta «Run NPM Install».
4. Fuera de los horarios de los crons (8:15 y 14:00).

**Si el código sube sin la migración**, toda aprobación y todo rechazo, de cualquier rol, dan 500 («Unknown column») hasta que se corra: por eso la migración va primero. Para volver atrás: primero los archivos anteriores y Restart, después el rollback.

## Lo que queda a criterio de quien construye

- Nombres internos (funciones, clase CSS exacta), siempre que el cuerpo del POST use `sin_responsabilidad` y el objeto `auditoria` use la clave `sin_responsabilidad`.
- La redacción final de las confirmaciones de `usuarios.js` y del texto del grupo Editores, en el tono de hoy.
- Si `mensajeNoCorresponde` y el aviso nuevo comparten una función que arma la lista de nombres.

Decisiones tomadas en esta conversación por Claude (no por el usuario), para revisar:
- La respuesta 409 y su texto.
- No tocar `api.js` y usar `API.pedirJson` desde `perfil.js`.
- El texto del aviso de la fila y de la pregunta de la confirmación.
- El texto del 403 del lector («Solo pueden auditar cambios los auditores y los editores.»).
- El texto del grupo Editores en Usuarios.
