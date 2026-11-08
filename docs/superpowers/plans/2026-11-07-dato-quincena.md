# El dato de la quincena: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el RPAD reciba por POST, con un token propio, cada edición de «El dato de la quincena» de Grok Bot, la guarde inmutable en la base y la muestre en una página de Herramientas a todos los roles con sesión.

**Architecture:** reglas puras en `services/datoQuincenaReglas.js` (validación, clave, huella, token, textos), consultas y transacción en `services/datoQuincenaDatos.js`, un controlador, tres middlewares (límite, token, multer en memoria) y tres tablas nuevas con los archivos en `MEDIUMBLOB`.
La página `dato-quincena.html` imprime los textos que arma el servidor, como Proyectos.

**Tech Stack:** Node 22 (ES Modules), Express 4, mysql2, multer 1.4.5-lts (memoria, busboy 1.6), express-rate-limit 8.7, `node:test`, vanilla JS. Sin dependencias nuevas.

**Aprobado** por el usuario el 07/11/2026, con ejecución por subagentes (Opus): un subagente por tarea y otro que la revisa, y una revisión final de la rama. Empieza cuando la sesión coordinadora da el turno de código; lo primero, traer main a la rama (`sync_with_base_branch`) y volver a mirar lo que haya cambiado en los archivos de este plan.

**Spec:** `docs/superpowers/specs/2026-11-07-dato-quincena-design.md`. Léanla entera antes de cada tarea: los textos, topes y reglas exactos están ahí y este plan no los repite todos.

## Ajustes de la coordinadora (noche del 08/11, con la consigna del usuario)

- Sin preguntas al usuario esta noche: ante una duda, lo más conservador (la spec aprobada, nada que rompa lo que anda, nada hacia afuera), anotado con su motivo en la nota de la sesión.
- Task 7, paso 3: sin `.claude/launch.json`. El servidor de ensayo se levanta con Bash en segundo plano (`DB_NAME`, `PORT` y `DATO_QUINCENA_TOKEN_SHA256` en el entorno del proceso) y se mira con `preview_start` pasando solo la `url`; se baja por su PID exacto.
- Task 9, paso 4: `.claude/rules/dato-quincena.md` no se escribe (pide permiso); su texto queda en `~/rpad-notas/dato-quincena/pendiente-regla.md`.
- Cualquier otra escritura que pida aprobación: se anota como pendiente y se sigue.
- Task 11: el kit va contra el commit del merge de los cajones de Métricas en main (lo pasa la coordinadora); su `PASOS.txt` dice al principio que se despliega después de `RPAD-deploy-metricas-cajones`, y su vuelta atrás vuelve al estado de los cajones. Con todo en verde, merge, push y «TODO EN VERDE» a la coordinadora; si algo no se resuelve de forma conservadora, «FRENADO» y sin merge.

## Global Constraints

- Leer `CLAUDE.md` y, por tema, `docs/temas/proyectos.md`, `frontend.md`, `base-de-datos.md` y `despliegue.md`.
- Sin dependencias nuevas; la CSP de `app.js` no cambia; sin CDN.
- Respuestas `{ success, data?, error? }`; el 422 suma `errores: [{ campo, mensaje }]`. Un 500 da un mensaje fijo por operación y en la consola solo `code` y `message` del error (nunca `err.sql`, el token ni el cuerpo).
- SQL parametrizado. Los `INSERT` con bytes, con `execute`; una lista en `IN (?)`, con `query` y solo si no está vacía.
- Las `DATE` se leen con `DATE_FORMAT(col, '%Y-%m-%d')` (`config/database.js` no tiene `dateStrings`) y los TIMESTAMP con `UNIX_TIMESTAMP`, pasados a hora argentina con `ahoraArgentina` (`services/notasDigitalesCalendario.js`). Las reglas puras reciben `hoy` por parámetro y no usan `Date` local.
- Largos con `Array.from`. El 0 es un valor (`??`, nunca `||`).
- Datos inventados en tests, fixtures y ejemplos: ningún nombre real ni cifra de producción. El paquete de Grok Bot (`~/rpad-notas/dato-quincena/grok/`) nunca entra al repo.
- Lenguaje neutro: `sin-respuesta` se muestra «Vencido», nunca «Sin respuesta»; nada de «atraso», «atrasada» ni parecidos en textos nuevos.
- Frontend: el script solo declara y engancha `DOMContentLoaded`; HTML puro por parámetro; todo texto del servidor por `Utils.escapeHtml` (también `title`, `alt`, `aria-label`), un número con `String`; clases e ids con prefijo `dq-` (ninguno con `ad-`); `<script src="js/X.js?v=N"></script>` a secas.
- Contenedor y base local: ver «Coordinación» al final. Nunca `docker compose` desde el worktree, nunca `down -v`, nunca `pkill -f` ni `killall` con patrón.
- Commit y push de la rama después de cada tarea (cortes de luz).

## Review Focus

- Un texto con emojis o tildes justo en el tope (un título de 200 caracteres con emojis): pasa, porque se cuenta con `Array.from`.
- Un `metadata` con BOM: 400 «metadata no es un JSON válido» (se decodifica con `ignoreBOM: true`, así el BOM no se pierde ni se acepta); y los bytes de `metadata` guardados son exactamente los recibidos.
- Una edición con todos los `rpad_id` en null, y un año sin ediciones: 201 y la lista vacía, nunca el 500 de un `IN ()`.
- Un instante raro (`…T23:59:60Z`, con `t` o `z` minúscula, con un espacio en lugar de la `T`): 422, nunca guardado (rompería el detalle para siempre).
- «Copiar» en un navegador sin `navigator.clipboard` (una página abierta por `http://`): muestra «No se pudo copiar: seleccioná el texto.» y no tira.

---

### Task 1: Las tablas y su migración

**Files:**
- Create: `database/updates/migracion-dato-quincena.sql`, `database/updates/rollback-dato-quincena.sql`
- Modify: `database/schema.sql` (las tres tablas al final, iguales a la migración), `tests/schema.test.js`, `docs/temas/base-de-datos.md`, `docs/temas/despliegue.md`

**Interfaces:**
- Produces: `dato_quincena_ediciones`, `dato_quincena_propuestas`, `dato_quincena_adjuntos`, con las columnas, collations, claves, FK e índices exactos de la spec, sección 8 (sin `CHECK`).

- [ ] **Step 1: Tests** en `tests/schema.test.js`:
  - `TOTAL_DE_TABLAS` de 47 a 50 (y su comentario); las tres tablas en el bucle «no trae datos en …» (línea ~710).
  - Un `it('El dato de la quincena: tres tablas con sus columnas, claves y FK (spec 2026-11-07-dato-quincena, 8)')`, como el de Mi espacio (línea ~406), con `TABLAS_DATO_QUINCENA`; columnas, FK (`fk_dato_quincena_propuesta_edicion` CASCADE, `fk_dato_quincena_propuesta_dataset` SET NULL, `fk_dato_quincena_adjunto_edicion` CASCADE) e índices (`uq_dato_quincena_clave`, `idx_dato_quincena_fecha`, `uq_dato_quincena_orden`, `idx_dato_quincena_dataset`, `uq_dato_quincena_adjunto`).
  - Un ayudante `collationsDe(conexion, base, tablas)` que lee `CHARACTER_SET_NAME` y `COLLATION_NAME` de `information_schema.COLUMNS`: `clave`, `huella` y `sha256` en `ascii`/`ascii_bin`; `metadata` en `utf8mb4_bin`.
  - Un `describe('migracion-dato-quincena.sql')` con la base `rpad_schema_dato_quincena_test`, como el de `migracion-mi-espacio-horas.sql` (línea ~2346): se pega en phpMyAdmin (sin `DELIMITER`, `USE`, `DROP`, `RENAME` ni `CHECK`), sus cabeceras, desde la estructura de main deja la de `schema.sql`, se puede repetir, y el rollback deja la estructura de main.
- [ ] **Step 2:** `node --test --test-name-pattern="dato" tests/schema.test.js` (con el aviso de contenedor libre). Esperado: falla.
- [ ] **Step 3: La migración y el rollback.** Encabezado como `migracion-mi-espacio-eventos-diario.sql` (spec, qué crea, ORDEN: antes del código y después de `migracion-mi-espacio-eventos-diario.sql`; repetible; obligatoria: sin ella las rutas nuevas dan 500; el código anterior no la lee), `SET NAMES utf8mb4;` y el SQL de la spec, sección 8. El rollback, como `rollback-notas-firma-leyenda.sql`: `DROP TABLE IF EXISTS` de adjuntos, propuestas y ediciones, en ese orden, con el aviso de que se pierden las ediciones (exportarlas antes). Las tres tablas al final de `database/schema.sql`.
- [ ] **Step 4:** El mismo comando. Esperado: pasan los tests nuevos. «crea las mismas tablas y columnas que la base actual» sigue fallando hasta que se migre la base compartida (Task 10): es esperado y no se migra antes (ver «Coordinación»).
- [ ] **Step 5: Docs.** `base-de-datos.md`: «## El dato de la quincena» con las tres tablas, la migración, qué pasa sin ella y el rollback; la cuenta de tablas pasa a 50. `despliegue.md`: la fila 37 (`migracion-dato-quincena.sql` | `rollback-dato-quincena.sql` | vacío).
- [ ] **Step 6: Commit y push.** `feat(dato-quincena): las tres tablas y su migración`.

### Task 2: La forma de la edición

**Files:**
- Create: `services/datoQuincenaReglas.js`, `tests/dato-quincena-reglas.test.js`, `tests/dato-quincena-fixtures.js`

**Interfaces:**
- Produces, en `services/datoQuincenaReglas.js`:
  - `TOPES = Object.freeze({ metadata: 256 * 1024, infografia_png: 5 * 1024 * 1024, correo_texto: 256 * 1024, calculos: 256 * 1024 })`, `TOPE_DEL_PEDIDO = 6 * 1024 * 1024`
  - `PARTES = Object.freeze(['metadata', 'infografia_png', 'correo_texto', 'calculos'])`, `ARCHIVOS = Object.freeze(['infografia_png', 'correo_texto', 'calculos'])`
  - `FECHA_MINIMA = '2026-11-01'`, `MAXIMO_DE_ERRORES = 50`, `MENSAJES_VALIDACION` (un objeto de textos fijos que los tests comparan)
  - `validarEdicion(edicion, { hoy }) → Array<{ campo, mensaje }>`: toda la sección 5 menos lo que depende de las partes recibidas. Del manifiesto, solo la forma: una lista de 2 o 3 objetos cerrados `{ campo, nombre, mime, bytes, sha256 }`, con `campo` y `nombre` textos, `mime` texto, `bytes` entero positivo y `sha256` 64 hex en minúsculas.
  - `claveDeEdicion({ tipo, fecha_edicion, referencia_piloto }) → string`
- Produces, en `tests/dato-quincena-fixtures.js` (inventado, como `tests/notas-fixtures.js`):
  - `FECHA_DE_PRUEBA = '2026-11-02'` (fija, pasada y desde `FECHA_MINIMA`: la API usa el hoy real)
  - `edicionDePrueba(cambios = {}) → objeto`: una regular válida de dos propuestas, con `rpad_id` 1 y 2 y nombres «Dataset de prueba A» y «Dataset de prueba B»; `pilotoDePrueba(cambios = {})`
  - `pngDePrueba({ ancho = 2, alto = 2 } = {}) → Buffer` (firma, `IHDR`, `IDAT` con `zlib.deflateSync`, `IEND`, CRC con `zlib.crc32`)
  - `partesDePrueba(edicion, { infografia_png, correo_texto, calculos } = {}) → { metadata: Buffer, infografia_png: Buffer, correo_texto: Buffer, calculos?: Buffer }`: con `calculos: null` no la incluye; recalcula `bytes` y `sha256` del manifiesto de `edicion.adjuntos` con las partes finales y arma `metadata` con `JSON.stringify` de esa edición.

- [ ] **Step 1: Tests**, uno por regla de la sección 5, con sus bordes:
  - `edicionDePrueba()` y `pilotoDePrueba()` dan `[]`.
  - Cada clave que falta, también una que puede ser null (`generado_at` en un piloto), y cada clave de más, dan su error con la ruta (`propuestas[1].puntos_centrales`, `adjuntos[0].sha256`).
  - `schema_version` distinto de `'1.0'`; `agente` distinto.
  - Fechas: `2026-02-30`, `2026-10-31` (antes de `FECHA_MINIMA`), `sumarDias(hoy, 1)` sí y `sumarDias(hoy, 2)` no.
  - `referencia_piloto`: `piloto-0`, `piloto-01` y `piloto-1000` no; `piloto-999` sí; un texto en una regular no.
  - Una regular con `generado_at` o `correo.enviado_at` en null.
  - Instantes: sin zona, `…T23:59:60Z`, con `t` o `z` minúscula, con un espacio en lugar de la `T` y un día que no existe, no; con fracción de 9 cifras y con `-03:00`, sí.
  - `datos_al` y `ultima_actualizacion` aceptan `'AAAA-MM-DD'` y un instante (`2026-06-03T03:00:00.000Z`); un texto cualquiera no.
  - Direcciones `http://`, rotas o de 2049; órdenes 1, 3; cero o dos `Principal`; etiquetas repetidas o desconocidas; 2 y 6 puntos; 1 y 4 párrafos; 0 y 21 fuentes.
  - Un título de 200 caracteres con emojis pasa y uno de 201 no; un texto de solo espacios; un texto con `\u0000`.
  - `rpad_id` 0, -1, `'3'` y 1.5 no; `dias_para_vencer` ±100001 no; un `estado` desconocido no.
  - El manifiesto: 1 y 4 elementos; un elemento que no es un objeto; `sha256` en mayúsculas o de 63.
  - Una edición con 60 problemas da 50 errores.
  - `null`, `[]` y `3` dan un solo error con `campo` `''`.
  - `claveDeEdicion`: `dq:regular:2026-11-23` y `dq:piloto:2026-11-06:piloto-4`.
- [ ] **Step 2:** `node --test tests/dato-quincena-reglas.test.js`. Esperado: falla (no existe el módulo).
- [ ] **Step 3: Implementar** `validarEdicion` y `claveDeEdicion`: un validador por forma (objeto cerrado, texto con tope, lista con mínimo y máximo, fecha, instante, fecha o instante, dirección) que agrega a una lista y corta en `MAXIMO_DE_ERRORES`. Fecha: `esFechaIso` (`notasDigitalesCalendario.js`). Instante: `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/`, `esFechaIso` de los 10 primeros caracteres y `Number.isFinite(Date.parse(valor))`. Los mensajes, fijos y sin repetir lo que llegó, en `MENSAJES_VALIDACION`.
- [ ] **Step 4:** El mismo comando. Esperado: pasa.
- [ ] **Step 5: Commit y push.** `feat(dato-quincena): la forma de la edición`.

### Task 3: Las partes, la huella y el token (puro)

**Files:**
- Modify: `services/datoQuincenaReglas.js`, `tests/dato-quincena-reglas.test.js`

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - `sha256(buffer) → string` (hex en minúsculas)
  - `esPng(buffer) → boolean`; `esTextoUtf8(buffer) → boolean`
  - `textoDeMetadata(buffer) → string | null`: `new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })` en un `try`; null si no es UTF-8. Con `ignoreBOM`, un BOM queda como `﻿` y el `JSON.parse` del controlador falla (400).
  - `validarAdjuntos(adjuntos, partes) → Array<{ campo, mensaje }>`, con `partes = { infografia_png: Buffer, correo_texto: Buffer, calculos?: Buffer }`: los valores del manifiesto contra lo recibido (sección 5): `campo` conocido (`ARCHIVOS`), sin repetir, presente si y solo si llegó la parte; `mime` por campo; `nombre` (1 a 255, sin `/`, `\` ni controles); `bytes` y `sha256` iguales a los de la parte; y el contenido (`esPng`, `esTextoUtf8`). Saltea los elementos que no son objetos (ya los informa `validarEdicion`).
  - `erroresDeLaEdicion(edicion, partes, { hoy }) → Array<{ campo, mensaje }>`: `validarEdicion` y, si `edicion.adjuntos` es una lista, `validarAdjuntos`; con el tope de 50.
  - `huellaDelPaquete(partes) → string`, con `partes = { metadata: Buffer, infografia_png: Buffer, correo_texto: Buffer, calculos?: Buffer }`: el SHA-256 de `metadata:<sha>\ninfografia_png:<sha>\ncorreo_texto:<sha>\ncalculos:<sha o ->\n` (sección 6). No depende del orden de llegada.
  - `estadoDelToken(authorization, huellaConfigurada) → 'apagado' | 'rechazado' | 'aceptado'`: `apagado` si la huella no es `/^[0-9a-f]{64}$/i`; `rechazado` si `authorization` no es un texto `Bearer ` + 1 a 512 caracteres, o si no coincide; compara con `crypto.timingSafeEqual` dos `Buffer.from(hex, 'hex')` de 32 bytes (la huella configurada, en minúsculas).

- [ ] **Step 1: Tests.**
  - `esPng`: `pngDePrueba()` sí; 4096 × 4096 sí y 4097 no; ancho 0 no; sin firma, con un `IHDR` de otro largo, cortado o con bytes después del `IEND`, no.
  - `esTextoUtf8`: `'ñandú 🧉'` sí; `Buffer.from([0xff])` no; un `\u0000` no.
  - `textoDeMetadata`: `EF BB BF 7B 7D` da `'﻿{}'` (el BOM se conserva); `[0xff]` da null.
  - `validarAdjuntos`: el manifiesto de `partesDePrueba` da `[]`; sin cálculos (`calculos: null`), `[]`; la entrada sin la parte y la parte sin la entrada; `bytes` y `sha256` distintos; `campo` repetido y `correo_html`; `text/html` en el texto (y `text/plain` en los cálculos sí); `nombre` con `/`, `\`, un control o de 256; una infografía que no es PNG; un texto que no es UTF-8; un elemento `null` no rompe.
  - `huellaDelPaquete`: igual con las mismas partes; distinta si cambia un byte de cualquiera; distinta con y sin cálculos; igual al esperado armado en el test con `crypto` y el texto de la sección 6.
  - `estadoDelToken`: sin huella, con 63 caracteres o con `zz…`, `'apagado'`; sin encabezado, `'Basic x'`, `'Bearer '` y otro token, `'rechazado'`; el token correcto, `'aceptado'`, también con la huella en mayúsculas.
- [ ] **Step 2:** Correr. Esperado: fallan.
- [ ] **Step 3: Implementar.** `esPng`: firma de 8 bytes; largo 13 y tipo `IHDR` en los bytes 8 a 16; ancho y alto (`readUInt32BE` 16 y 20) de 1 a 4096; los últimos 12 bytes `00 00 00 00 49 45 4E 44 AE 42 60 82`.
- [ ] **Step 4:** Correr. Esperado: pasan.
- [ ] **Step 5: Commit y push.** `feat(dato-quincena): las partes, la huella y el token`.

### Task 4: Los textos y las filas que arma el servidor (puro)

**Files:**
- Modify: `services/datoQuincenaReglas.js`, `tests/dato-quincena-reglas.test.js`

**Interfaces:**
- Consumes: `ahoraArgentina`, `formatoLargo` y `formatoCorto` (`services/notasDigitalesCalendario.js`), `enLista` (`services/miEspacioReglas.js`), `RPAD_URL` (`services/emailTemplates.js`).
- Produces:
  - `fechaLarga(iso) → 'Viernes 6 de noviembre de 2026'` (el día de la semana con `Date.UTC` sobre las partes, con mayúscula, y `formatoLargo`)
  - `marcaDePiloto(tipo, referencia) → 'Piloto 4' | null`
  - `horaArgentina(instanteOUnix) → { fecha: 'dd/mm/aaaa', hora: 'HH:MM', iso: 'AAAA-MM-DDTHH:MM:SS-03:00' }`: recibe un número (segundos UNIX) o un instante RFC 3339 (`Date.parse`), siempre por `ahoraArgentina(new Date(ms))`
  - `diaArgentino(fechaOInstante) → 'dd/mm/aaaa' | '—'` (una `'AAAA-MM-DD'` tal cual; un instante, su día en Argentina; null, «—»)
  - `textoDeLlegada(unix)`, `textoDelCorreo(enviadoAt)`, `textoDeCantidad(n)`, `textoDelResto(nombres)`, `tamanoTexto(bytes)` («97 KB», redondeado hacia arriba; desde 1 MB, «1,5 MB»)
  - `fotoDelDataset(snapshot) → Array<{ rotulo, valor }>`, con el rótulo «En el RPAD ese día:» y los demás de la sección 9
  - `textoParaCopiar(propuesta) → string` y `borradorParaCopiar(borrador) → string` (sección 9)
  - `filasDeLaEdicion(edicion) → Array<{ orden, titulo, cifra_clave, principal, rpad_id, dataset_nombre }>` (`principal` 1 si lleva `'Principal'`; `dataset_nombre` de `dataset.nombre`), lo que guarda la Task 5
  - `avisosDeLaEdicion(edicion, guardadas) → string[]`, con `edicion` el JSON y `guardadas = [{ orden, dataset_id }]`: un aviso por cada propuesta con `rpad_id` no null y `dataset_id` null, con el texto de la sección 7
  - `reciboDe({ id, clave, tipo, fecha_edicion, huella, recibida_ts }, adjuntos, avisos, repetida) → objeto` (sección 7; `adjuntos = [{ campo, bytes, sha256 }]` en el orden de `ARCHIVOS`; `recibida_at` = `horaArgentina(recibida_ts).iso`; `url` con `RPAD_URL`)

- [ ] **Step 1: Tests** con los textos exactos de la spec:
  - `fechaLarga('2026-11-06')` «Viernes 6 de noviembre de 2026»; `marcaDePiloto('piloto', 'piloto-12')` «Piloto 12» y `('regular', null)` null.
  - `horaArgentina(Date.UTC(2026, 10, 23, 11, 14, 2) / 1000)` da `23/11/2026`, `08:14` y `2026-11-23T08:14:02-03:00`; `horaArgentina('2026-11-23T11:12:00Z').hora` `08:12`.
  - `diaArgentino('2026-06-30')` `30/06/2026`, `('2026-06-03T03:00:00.000Z')` `03/06/2026`, `(null)` «—».
  - `textoDelCorreo` con un instante y con null; `textoDeCantidad(1)` «1 propuesta»; `textoDelResto([])` null, `(['A'])` «Y 1 propuesta más: A.», `(['A','B','C'])` «Y 3 propuestas más: A, B y C.»; `tamanoTexto` de 99511 «98 KB» y de 1572864 «1,5 MB».
  - `fotoDelDataset` con los seis estados y null: `atrasado` y `sin-respuesta` dan «Vencido» y ningún valor dice «Sin respuesta»; 0 «Próxima en» «0 días», 1 «1 día», -3 «Venció hace» «3 días», null sin la fila.
  - `textoParaCopiar` de la propuesta del ejemplo de la sección 9, comparado entero con `equal`; sin etiquetas, sin corchetes; sin notas, sin ese bloque. `borradorParaCopiar` con dos párrafos.
  - `filasDeLaEdicion` y `avisosDeLaEdicion` con `edicionDePrueba`; `reciboDe` con todas sus claves.
- [ ] **Step 2:** Correr. Esperado: fallan.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** Correr. Esperado: pasan.
- [ ] **Step 5: Commit y push.** `feat(dato-quincena): los textos y las filas del servidor`.

### Task 5: Recibir una edición (el POST)

**Files:**
- Create: `services/datoQuincenaDatos.js`, `controllers/datoQuincenaController.js`, `tests/dato-quincena-api.test.js`
- Modify: `middleware/rateLimit.js`, `middleware/auth.js`, `middleware/cuerpo.js`, `config/upload.js`, `routes/index.js`, `.env.example`

**Interfaces:**
- Consumes: Tasks 2 a 4; `responderAlTerminarDeLeer` (`config/upload.js`); `motivoDeRechazo` (`middleware/cuerpo.js`); `hoyArgentina`.
- Produces:
  - `middleware/cuerpo.js` exporta `MENSAJES_DEL_CUERPO` (nada más cambia).
  - `responderAntesDeLeer(req, res, status, cuerpo)` (`config/upload.js`): si `Content-Length` falta o pasa `TOPE_DEL_PEDIDO`, responde enseguida con `Connection: close` (y `req.resume()` sin esperar); si no, `responderAlTerminarDeLeer`. La usan el 429, el 401, el 503 y los 400 y 413 de la lectura.
  - `limiteDatoQuincena` (`middleware/rateLimit.js`): `rateLimit({ windowMs: HORA_MS, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, handler })`; el `handler` responde con `responderAntesDeLeer` 429 «Demasiados pedidos. Probá de nuevo más tarde.» (express-rate-limit ya puso `Retry-After`).
  - `tokenDelDatoQuincena` (`middleware/auth.js`): `estadoDelToken(req.headers.authorization, process.env.DATO_QUINCENA_TOKEN_SHA256)`; `apagado` → 503, `rechazado` → 401 (textos de la sección 7).
  - `subidaDelDatoQuincena` (`config/upload.js`), armada en cada pedido (el estado del filtro vive en el pedido, nunca en el módulo):
    - Sin `req.is('multipart/form-data')`, 400 «…: el pedido no es multipart/form-data».
    - `multer({ storage: multer.memoryStorage(), limits: { fields: 0, files: 4, parts: 4, fileSize: TOPES.infografia_png, fieldNameSize: 100 }, fileFilter }).any()`; el filtro anota en el estado del pedido un nombre que no es de `PARTES` («una parte no corresponde») o uno repetido («la parte <nombre> llegó dos veces») y descarta esa parte (`cb(null, false)`: multer no da error).
    - Motivos, el primero que valga: (1) no es multipart; (2) un error de multer: `LIMIT_FILE_SIZE` → 413 de esa parte; `LIMIT_FIELD_COUNT` → «todas las partes van como archivo»; `LIMIT_PART_COUNT` y `LIMIT_FILE_COUNT` → «sobran partes»; cualquier otro → «el pedido está mal armado»; (3) una parte que no corresponde; (4) una repetida; (5) falta `metadata`, `infografia_png` o `correo_texto`, en ese orden; (6) `metadata`, `correo_texto` o `calculos` de más de 256 KB → 413.
    - Deja `req.partes = { metadata, infografia_png, correo_texto, calculos? }`, todos `Buffer`.
  - `guardarEdicion({ clave, tipo, fecha_edicion, referencia_piloto, titulo, metadataTexto, huella, filas, adjuntos }) → Promise<{ estado: 'creada' | 'repetida' | 'conflicto', id }>` (`services/datoQuincenaDatos.js`), con `filas` de `filasDeLaEdicion` y `adjuntos = [{ campo, nombre, mime, bytes, sha256, contenido }]`. Una transacción: los `dataset_id` existentes con `query('SELECT id FROM datasets WHERE id IN (?)', [ids])` solo si hay ids; el `INSERT` de la edición con `execute`; ante `ER_DUP_ENTRY`, `rollback` y la huella de la guardada (repetida o conflicto, con su `id`); si no, los `INSERT` de propuestas y adjuntos con `execute` y `commit`.
  - `leerRecibo(id) → Promise<{ fila: { id, clave, tipo, fecha_edicion, huella, recibida_ts, metadata }, adjuntos: [{ campo, bytes, sha256 }], guardadas: [{ orden, dataset_id }] } | null>` (`DATE_FORMAT` y `UNIX_TIMESTAMP`).
  - `recibirEdicion(req, res)` (`controllers/datoQuincenaController.js`): `textoDeMetadata` y `JSON.parse` (400 «No se pudo leer la edición: metadata no es un JSON válido.»); `motivoDeRechazo` (400 con `MENSAJES_DEL_CUERPO[400]`); `erroresDeLaEdicion` (422); `claveDeEdicion`, `huellaDelPaquete`, `filasDeLaEdicion`, `guardarEdicion`; después del `commit`, `leerRecibo`, `avisosDeLaEdicion` y `reciboDe`: 201, 200 o 409. Error de la base: 500 «No se pudo guardar la edición.». La consola: `Dato de la quincena: <clave> <status>` en los que tienen clave, y `Dato de la quincena: <status> (<motivo corto>)` en los demás, sin nada de lo recibido.
  - La ruta: `router.post('/dato-quincena/ediciones', limiteDatoQuincena, tokenDelDatoQuincena, subidaDelDatoQuincena, recibirEdicion)`.

- [ ] **Step 1: Tests de la API** en `tests/dato-quincena-api.test.js`:
  - Base propia `crearBaseDePrueba('rpad_test_dato_quincena_api')`, con un área y dos datasets inventados (ids 1 y 2; el 2 con `activo` 0), un servidor con `DATO_QUINCENA_TOKEN_SHA256` = la huella de un token generado en el test, y dos servidores aparte para el 503 (`''` explícito, porque un `.env` local se heredaría, y una huella mal formada).
  - Un ayudante `enviar(partes, { token, ip, orden, tipos })` que arma un `FormData` con las partes como `Blob` con nombre de archivo (en el orden pedido) y manda `X-Forwarded-For: 203.0.113.<ip>`, un número por grupo de casos (con `trust proxy` 1, el límite cuenta esa IP). Para lo que `fetch` no permite (sin `Content-Length`, un campo de texto), `http.request` armado a mano, escuchando `'response'` y tolerando un `ECONNRESET` o `EPIPE` al escribir.
  - 503 sin huella y con una mal formada; 401 sin token, con otro token y con el JWT de un admin.
  - 201: el recibo completo (claves; `recibida_at` que termina en `-03:00` y está a menos de un minuto de ahora; `adjuntos` con los `sha256` de las partes; `url` que termina en `/dato-quincena.html?id=<id>`), las filas de las tres tablas y `contenido` y `metadata` iguales byte a byte a lo enviado.
  - 200 al repetir (mismo `id`, `huella` y `recibida_at`, sin filas nuevas), también con las partes en otro orden. 409 con un byte distinto en el texto (`partesDePrueba` con otro `correo_texto`), sin cambios.
  - Dos iguales a la vez con `Promise.all`: 201 y 200. Un piloto y una regular del mismo día, y dos pilotos del mismo día con otra referencia: tres 201.
  - Una edición con todos los `rpad_id` en null: 201 sin avisos. Una con un `rpad_id` que no existe: 201 con su aviso y `dataset_id` null.
  - 400: un cuerpo JSON; sin `metadata`; sin `infografia_png`; `metadata` como campo de texto; una parte `correo_html`; dos `infografia_png`; cinco partes; JSON roto; un BOM (y nada guardado); `__proto__` como clave; 40 niveles.
  - 413 con un PNG de 5 MB + 1 y con un texto de 256 KB + 1. 422 con `errores` (dos `Principal` y un manifiesto que no coincide).
  - 429 con `Retry-After` en el pedido 21 de una misma IP. Un desconocido sin `Content-Length` (chunked) recibe el 401 sin que el servidor lea todo.
  - Que nada más cambió: `mailpit.vaciar()` antes y ningún mail después, y la misma cuenta de filas de `datasets`, `cambios_pendientes`, `historial_actualizaciones`, `notificaciones_log`, `proyecto_hitos` y `hito_archivos` antes y después.
- [ ] **Step 2:** Con el aviso de contenedor libre, `node --test tests/dato-quincena-api.test.js`. Esperado: falla (404 de la ruta).
- [ ] **Step 3: Implementar** lo de las Interfaces. `.env.example` suma `DATO_QUINCENA_TOKEN_SHA256=` vacío, con un comentario de una línea (sección 12 de la spec).
- [ ] **Step 4:** Correr el test nuevo y `node --test tests/errores-del-cuerpo.test.js tests/upload-subida.test.js tests/proyectos-api.test.js tests/login-limite.test.js`. Esperado: todo pasa.
- [ ] **Step 5: Commit y push.** `feat(dato-quincena): recibir una edición`.

### Task 6: Las lecturas

**Files:**
- Modify: `services/datoQuincenaDatos.js`, `services/datoQuincenaReglas.js`, `controllers/datoQuincenaController.js`, `routes/index.js`, `tests/dato-quincena-api.test.js`, `tests/dato-quincena-reglas.test.js`, `tests/permisos.test.js`

**Interfaces:**
- Consumes: Tasks 4 y 5; `idPositivo` (`services/proyectosReglas.js`); `disposicionDeAdjunto` (`services/seguimientoReglas.js`); `authMiddleware`.
- Produces, en `services/datoQuincenaDatos.js` (nunca un `SELECT` de `contenido` fuera de `leerArchivo`):
  - `listarEdiciones(anio) → Promise<{ anios: [{ anio, cantidad }], anio, filas: [{ id, tipo, fecha_edicion, referencia_piloto, propuestas: [{ orden, titulo, cifra_clave, principal, dataset_nombre }] }] }>`: sin `anio`, el más reciente; las propuestas con `query(... edicion_id IN (?))` solo si hay ediciones.
  - `leerEdicion(id) → Promise<{ fila: { id, clave, tipo, fecha_edicion, referencia_piloto, titulo, metadata, recibida_ts }, guardadas: [{ orden, dataset_id, dataset_activo }], adjuntos: [{ campo, nombre, mime, bytes }] } | null>`
  - `leerArchivo(id, campo) → Promise<{ existe: false } | { existe: true, archivo: { nombre, mime, contenido: Buffer } | null }>`: `campo` `metadata` da el texto como `Buffer`, con el nombre `dato-quincena-<clave sin "dq:", con "-" por ":">.json` y `application/json; charset=utf-8`.
- Produces, en `services/datoQuincenaReglas.js`:
  - `itemDeLaLista(fila) → { id, fecha_texto, marca, principal: { titulo, cifra_clave }, resto }`
  - `detalleDeLaEdicion({ fila, edicion, guardadas, adjuntos }) → objeto` (sección 9; `edicion` es el `JSON.parse` de `fila.metadata`, que hace el controlador; cada propuesta con `para_copiar` y `borrador_para_copiar`; `archivos` con `campo`, `rotulo`, `nombre`, `detalle` y `se_puede_ver`; `id_enlace` solo si `dataset_activo`)
- Produces, en el controlador y en `routes/index.js`, con `authMiddleware`: `listar` (`GET /dato-quincena/ediciones`), `ver` (`GET /dato-quincena/ediciones/:id`) y `descargar` (`GET /dato-quincena/ediciones/:id/archivos/:campo`). Textos y estados de la sección 9: 400 «El año no es válido.» (`anio` que no es un entero de 2000 a 2100); 404 «No existe esa edición.» (`idPositivo` o `existe: false`); 404 «El archivo no existe.» (`archivo` null); 500 «Error al obtener las ediciones», «Error al obtener la edición» o «Error al descargar el archivo».

- [ ] **Step 1: Tests.**
  - Reglas: `itemDeLaLista` y `detalleDeLaEdicion` con filas inventadas (todas las claves; `id_enlace` solo con el dataset activo; el orden de `archivos`; los nombres de descarga).
  - API: la lista vacía (`anios` `[]`, `anio` null); `?anio=2025` sin ediciones, 200 con la lista vacía; con ediciones de dos años, sin `anio` el más reciente y con `anio` ese, ordenadas por fecha y por id; `anio=1999` y `anio=abc`, 400.
  - El detalle con sus textos (`llegada` desde `recibida_at`, `correo` en hora argentina).
  - Cada descarga: bytes iguales a los enviados, su `Content-Type` y un `Content-Disposition` de adjunto con su nombre.
  - 404 «No existe esa edición.» con `0`, `abc` y un id que no existe (detalle y descarga); 404 «El archivo no existe.» con `correo_html` y con cálculos que no llegaron.
  - 401 sin sesión en las tres; el lector y el colaborador, 200 en la lista y en el detalle.
  - `tests/permisos.test.js` (no se corre hasta la Task 10: lee la base del `.env`): `'/dato-quincena/ediciones'` en las listas de «puede usar GET» del lector (línea ~157) y del colaborador (línea ~315); el detalle y la descarga de un id que no existe llegan al controlador como las lecturas de la restitución (404 «No existe esa edición.», nunca 401, 403 ni «Ruta no encontrada»); y las tres, 401 sin sesión.
- [ ] **Step 2:** Con el aviso de contenedor libre, `node --test tests/dato-quincena-reglas.test.js tests/dato-quincena-api.test.js`. Esperado: fallan.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** El mismo comando. Esperado: pasan.
- [ ] **Step 5: Commit y push.** `feat(dato-quincena): la lista, el detalle y las descargas`.

### Task 7: La base de ensayo

Fuera del repo y sin tocar la base del `.env`. La usan la Task 8 (mirar la página) y la Task 10 (el ensayo con el piloto 4).

- [ ] **Step 1:** Con el aviso de contenedor libre, una copia entera de la base del `.env` en `rpad_sim_dato_quincena`, con `mariadb-dump` y `mariadb` dentro del contenedor (`docker exec -i -e MYSQL_PWD=…`, ver «Coordinación»), y `migracion-dato-quincena.sql` corrida en la copia.
- [ ] **Step 2:** Dos usuarios de prueba en la copia, `prueba_dq_lector` (lector) y `prueba_dq_admin` (admin), con un script de una sola vez en `~/rpad-notas/dato-quincena/ensayo/` que genera contraseñas al azar, las hashea con `bcryptjs` y las deja en `~/rpad-notas/dato-quincena/ensayo/usuarios.txt` (nunca en el chat ni en el repo).
- [ ] **Step 3:** Una entrada en `.claude/launch.json` (no se versiona: `.gitignore` la deja afuera) para un servidor local con `DB_NAME=rpad_sim_dato_quincena`, otro `PORT` y `DATO_QUINCENA_TOKEN_SHA256` = la huella de un token de ensayo guardado en `~/rpad-notas/dato-quincena/ensayo/`; se levanta con `preview_start`.
- [ ] **Step 4:** Anotar en `~/rpad-notas/dato-quincena/ensayo.md` cómo se armó y cómo se borra (Task 10).

### Task 8: La página y el menú

**Files:**
- Create: `public/dato-quincena.html`, `public/js/dato-quincena.js`, `tests/dato-quincena-frontend.test.js`, `tests/fixtures/dato-quincena-respuestas.json` (respuestas inventadas de la lista y del detalle)
- Modify: el menú de Herramientas de las 14 páginas con carcasa, `public/js/usuarios.js` (`AYUDA_DEL_ROL.lector`) y su `?v=` en `configuracion.html`, `tests/paginas.test.js`, `tests/usuarios-frontend.test.js`
- Referencia visual: la maqueta aprobada, `~/rpad-notas/dato-quincena/maqueta/index.html` (estilos en `_estilo.html`); sus datos son reales y no se copian.

**Interfaces:**
- Consumes: las respuestas de la Task 6; `API.pedirJson`, `API.pedirArchivo`, `Utils.escapeHtml`, `Auth.isAuthenticated`, `Auth.isTokenExpired`, `Auth.clearSession`.
- Produces, en `public/js/dato-quincena.js`:
  - Puras, por parámetro: `estadoDeLaUrl(search) → { id: number | null, anio: number | null }`, `urlDeEstado({ id, anio }) → string`, `esEnlaceSeguro(url) → boolean` (solo `https://`), `htmlDeAnios(anios, anio)`, `htmlDeFila(item)`, `htmlDeLaLista(datos)`, `htmlDeLaAgenda(agenda)`, `htmlDeLaFoto(foto)`, `htmlDePropuesta(propuesta)`, `htmlDeArchivos(archivos, id)`, `htmlDelDetalle(detalle)`, `htmlDelEstado(tipo)` (`cargando`, `error`, `vacio`, `no-existe`), `MENSAJES_COPIAR = { copiado: 'Copiado', fallo: 'No se pudo copiar: seleccioná el texto.' }`.
  - `copiarTexto(boton, texto, { portapapeles = globalThis.navigator?.clipboard, esperar = setTimeout } = {})`: sin `portapapeles?.writeText` o si falla, deja `MENSAJES_COPIAR.fallo` en el botón; si copia, «Copiado» y lo anuncia en `#dq-anuncio`; a los 2 s, el texto original.
  - Al final, `iniciarDatoQuincena()` (enganchada a `DOMContentLoaded`): sin sesión, al login; los eventos delegados en contenedores fijos; la miniatura y la infografía desde un `blob:` (`API.pedirArchivo` + `URL.createObjectURL`, liberados al salir); «Ver» en un modal con `textContent`; «Descargar» con `descargarBlob` (copiada de `proyectos.js`) y el `nombre` del servidor.

- [ ] **Step 1: Tests de frontend** (`vm` después de `main.js` y `api.js` de verdad, como `tests/proyectos-frontend.test.js`, con `setTimeout` y sin `navigator` en el contexto):
  - La lista con un año y con dos (los botones solo con más de uno), la fila con y sin marca, la lista vacía.
  - El detalle: con y sin agenda; la principal abierta y las otras cerradas; «Para validar antes de publicar» fuera del `<details>`; la foto; el enlace al dataset solo con `id_enlace`; «en el portal» y las fuentes con enlace solo si `esEnlaceSeguro` (si no, texto sin enlace); los tres «Copiar» con `texto_redes`, `borrador_para_copiar` y `para_copiar` tal cual en su `data-`; los cuatro archivos, con «Ver» solo en el texto y los cálculos.
  - Cada estado; todo escapado (un título `<img src=x onerror=1>` sale como texto); ninguna clase ni id con `ad-`.
  - `copiarTexto` sin portapapeles: el botón dice `MENSAJES_COPIAR.fallo` y no tira; con un portapapeles falso: «Copiado» y, con un `esperar` falso, vuelve al texto original.
- [ ] **Step 2: Tests de las páginas y de Usuarios.**
  - `tests/paginas.test.js`: `VERSION_DATO_QUINCENA` (el número siguiente al más alto del archivo al implementar); `['dato-quincena.html', 'dato-quincena', VERSION_DATO_QUINCENA]` en la lista de scripts; «hay 15 páginas con carcasa»; `dato-quincena.html` en los destinos de la carcasa; el test de Herramientas, con cinco enlaces y el último `dato-quincena.html` «El dato de la quincena» con el ícono `newspaper`; `VERSION_PANTALLAS` (la de `usuarios.js` en `configuracion.html`) al número siguiente al más alto del archivo.
  - `tests/usuarios-frontend.test.js`: la ayuda nueva del lector (sección 11 de la spec).
- [ ] **Step 3:** Correr `node --test tests/dato-quincena-frontend.test.js tests/paginas.test.js tests/usuarios-frontend.test.js`. Esperado: fallan.
- [ ] **Step 4: Implementar.**
  - La página: la carcasa de `proyectos.html` (encabezado, velo, menú y footer idénticos a los de `index.html`); `main.css?v=` de siempre; `config.js`, `auth.js`, `main.js` y `api.js` con el `VERSION` actual, sin subirlo, y `dato-quincena.js?v=VERSION_DATO_QUINCENA`; su `<style>` con los tokens `--sg-*` y las piezas de la maqueta; los estados de la sección 10 y la región viva `#dq-anuncio`.
  - El enlace nuevo, al final de Herramientas, en las 14 páginas, igual en todas.
  - `AYUDA_DEL_ROL.lector` con el texto de la sección 11, y `usuarios.js?v=` en `configuracion.html` con el `VERSION_PANTALLAS` nuevo.
- [ ] **Step 5:** Correr los tres tests y además `node --test tests/main-frontend.test.js tests/proyectos-frontend.test.js`. Esperado: pasan.
- [ ] **Step 6: Mirarla** con el servidor de ensayo (Task 7), en el panel del navegador: escritorio y 375 px sin desborde horizontal, el foco visible, con `prueba_dq_lector` y con `prueba_dq_admin`. Para tener ediciones, mandar dos inventadas con el token de ensayo (una regular y un piloto).
- [ ] **Step 7: Commit y push.** `feat(dato-quincena): la página y el menú`.

### Task 9: La documentación

**Files:**
- Create: `docs/temas/dato-quincena.md`, `.claude/rules/dato-quincena.md`
- Modify: `CLAUDE.md`, `docs/temas/frontend.md`

- [ ] **Step 1:** `docs/temas/dato-quincena.md`, con el formato de los otros temas (un renglón por oración, lo vigente, las decisiones con su motivo): qué es; el contrato del POST (partes como archivo, topes, orden de controles, respuestas); la clave y la huella; las tablas (una línea, con referencia a `base-de-datos.md`); las lecturas y sus textos; la página; el token, cómo se genera, el interruptor y cómo se apaga; lo que no cambia; «## Archivos» y «## Archivos de tests». Sin «atrasadas»: «ediciones anteriores a la activación».
- [ ] **Step 2:** `CLAUDE.md`:
  - «El mapa»: «El dato de la quincena: el archivo de Grok Bot, su token y su página | `dato-quincena.md`».
  - «Estructura»: los middlewares nuevos en las líneas de `middleware/auth.js` y `middleware/rateLimit.js`, y la subida nueva en la de `config/upload.js`.
  - «Frontend» y «Estructura»: 15 páginas con carcasa donde dice 14.
  - «Seguridad»: en el renglón del límite de pedidos, «el dato de la quincena, 20 por hora por IP».
  - «Roles»: las Herramientas del lector suman El dato de la quincena.
  - «Variables de entorno requeridas»: `DATO_QUINCENA_TOKEN_SHA256` (opcional: sin ella, la recepción está apagada).
- [ ] **Step 3:** `docs/temas/frontend.md`: 15 páginas con carcasa; `auth.js` en 16 páginas y `main.js` y `api.js` en 15; la constante nueva; Herramientas con cinco enlaces.
- [ ] **Step 4:** `.claude/rules/dato-quincena.md` (ruta protegida: la escritura pide permiso), con el glob de `services/datoQuincena*.js`, `controllers/datoQuincenaController.js`, `public/js/dato-quincena.js` y `public/dato-quincena.html`, como las otras reglas: leer `docs/temas/dato-quincena.md` antes de tocar, y tres reglas de una línea (inmutable; el token nunca en el repo ni en un log; el servidor arma los textos).
- [ ] **Step 5:** `node --test tests/documentos.test.js`. Esperado: pasa.
- [ ] **Step 6: Commit y push.** `docs(dato-quincena): el tema, el mapa y la regla`.

### Task 10: La base compartida, la suite y el ensayo con el piloto 4

- [ ] **Step 1: La base del `.env`.** Avisar a la coordinadora: desde que se migra hasta el merge, `schema.test.js` («crea las mismas tablas y columnas que la base actual») falla para quien corra la suite de main. Con su sí y el contenedor libre: respaldo en `~/rpad-respaldos/antes-dato-quincena-<fecha>.sql` y `migracion-dato-quincena.sql` en la base del `.env`.
- [ ] **Step 2:** `npm test` completo. Antes de cada corrida, comprobar en `information_schema` que estén las tres tablas `dato_quincena_*` (la base compartida se recarga seguido; la migración se puede repetir). Esperado: 0 fallas; comparar la cantidad de tests con la última corrida de main.
- [ ] **Step 3: El ensayo** sobre la base de ensayo (Task 7): el piloto 4 real con el manifiesto reducido, armado en `~/rpad-notas/dato-quincena/ensayo/` desde `~/rpad-notas/dato-quincena/grok/rpad-integracion/` (nunca en el repo), mandado con el token de ensayo: 201; otra vez, 200; un byte cambiado, 409. Mirar la página con el piloto 4 contra la maqueta. Anotar lo encontrado en `~/rpad-notas/dato-quincena/ensayo.md`. Al terminar, bajar el servidor de ensayo (`preview_stop`) y borrar `rpad_sim_dato_quincena` y los usuarios de ensayo.
- [ ] **Step 4:** Nombres reales y paquete de Grok: `git diff --stat main...` sin archivos de afuera, y `git grep -n -i -f ~/rpad-notas/palabras.txt` sin resultados nuevos frente a main.
- [ ] **Step 5: Revisión final** de toda la rama con un agente nuevo (Opus) contra la spec; corregir lo que encuentre y volver a correr la suite.

### Task 11: Merge, push y kit

- [ ] **Step 1:** Con todo en verde, merge en main y push (la regla del usuario: si todo da bien, sin pedir OK). Avisar a la coordinadora para su control.
- [ ] **Step 2: El kit** `~/rpad-kits/RPAD-deploy-dato-quincena/`, contra el último commit en producción que confirme la coordinadora, con el filtro de «El kit» de `docs/temas/despliegue.md`: `PASOS.txt` con los pasos de la sección 17 de la spec (incluidos `SELECT @@max_allowed_packet` de 16 MB o más, la verificación de las tres tablas, el comando del token y el orden con Grok Bot), `sql/01-migracion-dato-quincena.sql`, `archivos-dato-quincena/` y su zip, `vuelta-atras/` (los archivos del commit en producción, su zip y `rollback-dato-quincena.sql`) y `VERIFICACION.txt` (sha256 de cada archivo contra `git show`).
- [ ] **Step 3:** Si algo del código cambió el contrato, actualizar `~/rpad-notas/dato-quincena/para-grok/contrato-v1.md` y decirle al usuario qué mandarle a Grok Bot. Si no cambió nada, solo el aviso del día del despliegue: generar el token, cargarlo en Grok Bot y pedirle el piloto 4 y el piloto 5.

## Coordinación

- El contenedor (MariaDB + Mailpit) es de una sola suite a la vez y lo asigna la sesión coordinadora (`local_e7d7604b-f7e1-46e9-9f36-ba3f80b7ac0b`): antes de cualquier test que use la base (Tasks 1, 5, 6, 7, 10), pedirle el aviso de contenedor libre con `SendMessage`.
- La base del `.env` es compartida (el dump de producción del 07/11) y de solo lectura para las sesiones: se migra solo en la Task 10, con el sí de la coordinadora y un respaldo en `~/rpad-respaldos/`. Lo demás va en bases con otro nombre (`rpad_test_*`, `rpad_schema_*`, `rpad_sim_dato_quincena`).
- En esta Mac no hay cliente `mysql`: todo va por el contenedor, con docker por su ruta completa (`/Applications/Docker.app/Contents/Resources/bin/docker exec -i -e MYSQL_PWD=<DB_ROOT_PASSWORD del .env> rpad-db mariadb -uroot …`), leyendo la contraseña del `.env` sin mostrarla.
- Un worktree no trae el `.env`: copiarlo con `RPAD_TESTS_DB_LOCAL=1`. Antes de borrar el worktree, ver la memoria del junction de `node_modules`.
