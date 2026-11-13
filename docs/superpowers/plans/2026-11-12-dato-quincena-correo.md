# El dato de la quincena: el correo del RPAD y la lista en tarjetas. Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el RPAD mande el mail «Dato de la Quincena - DD/MM/AAAA» a una lista de usuarios en sus corridas de días hábiles, que acepte el SVG y la marca de efeméride del bot, y que la página muestre las ediciones en tarjetas «tipo diario» con una pestaña Correo para administración.

**Architecture:** el envío vive en tres archivos nuevos (`datoQuincenaCorreoReglas.js` puro, `datoQuincenaCorreoDatos.js` consultas, `datoQuincenaCorreo.js` la corrida, la reserva y los envíos), con cuatro tablas nuevas; la edición sigue inmutable. La recepción programa el envío en la misma transacción del `INSERT`. Las corridas de las 8:05 y las 14:00 suman un paso aislado con su candado. La página suma pestañas, tarjetas, páginas de a 18, la pestaña Correo y la caja del correo en el detalle.

**Tech Stack:** Node 22, Express 4, MariaDB (mysql2/promise), multer/busboy, Nodemailer, node:test, vanilla JS.

**Spec:** `docs/superpowers/specs/2026-11-12-dato-quincena-correo-design.md` (aprobada el 12/11/2026). Las maquetas aprobadas están fuera del repo: `~/rpad-notas/dato-quincena-correo/maqueta/` (la tarjeta es la variante A, «diario»; el mail, `mail.html`).

## Global Constraints

- Español en variables, comentarios y textos; lenguaje neutro (nunca «tardanza», «demora», «atraso», «sin respuesta», «no mandó»).
- Repositorio público: ningún nombre, dirección de correo ni cifra real en código, tests, fixtures, specs o docs. Datos inventados (`@ejemplo.test`, «Persona Uno»).
- Fechas: `hoyArgentina()` / `ahoraArgentina()` en el servidor; las reglas puras reciben hoy y ahora por parámetro; `DATETIME` escrito con `ahoraArgentina()`, nunca `NOW()`; un `TIMESTAMP` se lee con `UNIX_TIMESTAMP`.
- Una sola lectura del calendario por corrida o pedido (`leerCalendario`); la caída, por `calendario.error !== null`; ningún import de `esDiaHabil` ni sus derivadas fijas (`tests/calendario-unico.test.js`).
- `sendEmail` siempre con `to`; `from: remitente()`; ningún texto de nodemailer en una respuesta, una página o un registro que se muestre (solo un texto fijo; el detalle, a la consola).
- SQL siempre parametrizado; transacciones para lo multi-tabla; sin `CHECK` en la base.
- Respuestas `{ success, data?, error?, errores? }`; un 500 con un texto fijo por operación; un id que no es `idPositivo` o no existe, 404.
- Lo nuevo de un cuerpo se activa solo con el `true` literal (`activo === true`).
- Página: lo que arma HTML es puro y recibe los datos por parámetro; al cargarse el script solo declara y engancha `DOMContentLoaded`; todo texto del servidor por `Utils.escapeHtml` (también en atributos), un número con `String`; ninguna clase ni id con `ad-`; `<script src>` a secas; cada `?v=` atado a su constante de `tests/paginas.test.js`; «Guardar» y los botones que mandan, deshabilitados hasta la respuesta; foco visible; con `prefers-reduced-motion`, nada se mueve.
- Las migraciones van antes que el código y también en `database/schema.sql`; la base local del `.env` es compartida: la migración se corre ahí solo con el OK de la coordinadora (ver Tarea 12).
- Nunca `docker compose` desde el worktree; una sola suite por contenedor; ningún test nuevo llama a `/api/cron/*`.
- Los documentos: un renglón por oración, hasta 600 caracteres por renglón y 60 KB por documento (`tests/documentos.test.js`); se escribe lo vigente.
- Modelos (proceso del usuario): Opus en lo de la lista fija (permisos, API que escribe en la base, migraciones, reglas, corridas, mails, formularios) y en las revisiones de cada tarea; Sonnet en lo simple; la revisión final de la rama, Fable. Cada tarea dice el suyo.

## Review Focus

1. **Una corrida doble** (cPanel que repite, o la ruta manual mientras corre la Tarea Cron): nadie recibe el mail dos veces. Prueba en la Tarea 7: dos `ejecutarCorreoDelDatoQuincena` seguidos (y uno con el candado tomado) dan un solo mail por persona en Mailpit.
2. **Una edición que llega mientras corre la de las 8:05**: no se pierde ni se manda dos veces; sale a las 14:00. Prueba en la Tarea 7: programar después de la lectura de las programadas y verificar que la corrida de las 14:00 la manda.
3. **Una persona que cambió entre la programación y el envío** (se desactivó, cambió el email, se fue de la lista, entró de licencia ese día): se usa lo de ese momento. Prueba en la Tarea 7.
4. **La tabla de feriados que no se lee el lunes de la edición**: no sale ese día y sale en la corrida siguiente, si no pasaron 13 días. Prueba en la Tarea 7.
5. **Un SVG con mayúsculas o espacios para esquivar el control** (`<SCRIPT`, `ON load=`, `xlink:href = "http…"`, `url( http…)`): 422. Prueba en la Tarea 2.

---

### Task 1: La base: cuatro tablas y el SVG en los adjuntos

**Modelo:** Opus (migración).

**Files:**
- Create: `database/updates/migracion-dato-quincena-correo.sql`, `database/updates/rollback-dato-quincena-correo.sql`
- Modify: `database/schema.sql` (después de `dato_quincena_adjuntos`), `tests/schema.test.js:91` y el bloque de columnas (~689-720)
- Modify: `docs/temas/base-de-datos.md` (las tablas nuevas, un renglón por oración)

**Interfaces:**
- Produces (tablas, con estos nombres exactos):
  - `dato_quincena_correo_config` (`id` tinyint PK = 1, `envio_activo` tinyint(1) NOT NULL DEFAULT 0, `cambiado_por` int NULL FK `usuarios` ON DELETE SET NULL, `cambiado_at` datetime NULL, `corrida_inicio_at` datetime NULL, `corrida_fin_at` datetime NULL, `corrida_resultado` varchar(500) NULL, `corrida_con_errores` tinyint(1) NOT NULL DEFAULT 0). La migración inserta la fila 1 con `INSERT IGNORE`.
  - `dato_quincena_destinatarios` (`usuario_id` int PK, FK `usuarios` ON DELETE CASCADE, `agregado_por` int NULL FK SET NULL, `agregado_at` datetime NOT NULL).
  - `dato_quincena_correos` (`edicion_id` int PK, FK `dato_quincena_ediciones` ON DELETE CASCADE, `estado` enum('programada','enviada','parcial','fallida','no_enviada') NOT NULL, `motivo` enum('apagado','vieja','mas_nueva','sin_lista') NULL, `enviada_at` datetime NULL, `creada_at` datetime NOT NULL, `ultima_corrida_at` datetime NULL; índice `(estado)`).
  - `dato_quincena_envios` (`id` int AI PK, `edicion_id` FK CASCADE, `usuario_id` int NOT NULL FK `usuarios` ON DELETE CASCADE, `email` varchar(100) NOT NULL, `tipo` enum('automatico','reenvio','prueba') NOT NULL, `unico` tinyint(1) NULL, `estado` enum('pendiente','enviando','enviado','fallido','licencia','omitido') NOT NULL, `intentos` tinyint unsigned NOT NULL DEFAULT 0, `enviado_at` datetime NULL, `ultimo_intento_at` datetime NULL, `error` varchar(200) NULL, `creado_por` int NULL FK SET NULL, `creado_at` datetime NOT NULL; `UNIQUE (edicion_id, usuario_id, unico)`: `unico` = 1 en el automático y NULL en reenvíos y pruebas, así hay un solo automático por persona).
  - `dato_quincena_adjuntos.campo` pasa a `enum('infografia_png','correo_texto','calculos','infografia_svg')`.
- La vuelta atrás borra las filas `infografia_svg`, vuelve el `ENUM` y borra las cuatro tablas (primero las que apuntan a otras). El encabezado dice que se pierden los SVG guardados y el registro de envíos.

- [ ] **Step 1:** En `tests/schema.test.js`, sumar las cuatro tablas a `TABLAS_DATO_QUINCENA` (o una constante hermana) y sus columnas exactas (como las de las tablas de hoy, `tabla.columna tipo null=… default=… key=…`), y cambiar la línea del `ENUM` de `campo`. Correr `node --test tests/schema.test.js` contra una base de prueba recién creada desde `schema.sql`: falla.
- [ ] **Step 2:** Escribir la migración (encabezado como `migracion-dato-quincena.sql`: spec, «solo agrega», ORDEN «después de migracion-dato-quincena.sql», se puede volver a correr, vuelta atrás) y `schema.sql`. La parte de `schema.sql` del test pasa.
- [ ] **Step 3:** Escribir la vuelta atrás y probar en una base de prueba descartable: migración, vuelta atrás, migración de nuevo, sin errores (`correrSqlEnBaseDePrueba`).
- [ ] **Step 4:** `docs/temas/base-de-datos.md`: las cuatro tablas y el `ENUM`, con el motivo de `unico`.
- [ ] **Step 5:** Commit `feat(dato-quincena): las tablas del correo y el SVG en los adjuntos`.

### Task 2: Las reglas de la recepción: el SVG, la efeméride, el nombre, el número y las partes de la fecha

**Modelo:** Opus (reglas).

**Files:**
- Modify: `services/datoQuincenaReglas.js`
- Modify: `tests/dato-quincena-reglas.test.js`, `tests/fixtures/dato-quincena-respuestas.json`, `tests/dato-quincena-fixtures.js` (un SVG inventado chico)

**Interfaces:**
- Produces:
  - `NOMBRE_DEL_BOT = 'Datito'` (exportada) y todos los textos del servidor que nombraban al bot la usan (`textoDelCorreo`: «Correo enviado el 09/11/2026 a las 08:00, según Datito.», «Correo enviado según Datito, sin la hora.», «Datito archivó esta edición sin que saliera el correo.»).
  - `TOPES.infografia_svg = 1024 * 1024`; `TOPE_DEL_PEDIDO = 7 * 1024 * 1024`; `PARTES` = `['metadata', 'infografia_png', 'correo_texto', 'calculos', 'infografia_svg']`; `ARCHIVOS` suma `'infografia_svg'` al final.
  - `esSvg(buffer) -> boolean`: UTF-8 válido sin nulo (`utf8`); sin BOM al principio; después de espacios, a lo sumo una declaración `<?xml …?>` y comentarios `<!-- … -->`, el primer elemento es `<svg` seguido de espacio o `>`; y en todo el texto, sin distinguir mayúsculas: ni `<script`, ni `<foreignObject`, ni un atributo `on\w+\s*=`, ni `@import`, ni `href`/`xlink:href` con un valor que no empiece con `#`, ni `url(` con un valor que no empiece con `#` (con espacios y comillas opcionales).
  - `ARCHIVO.infografia_svg = { mimes: ['image/svg+xml'], contenido: esSvg, otroContenido: 'svg', sinEntrada: 'sinEntradaSvg' }`; mensajes nuevos: `svg: 'La infografía editable tiene que ser un SVG que empiece con <svg, sin scripts, sin foreignObject, sin atributos on… y sin referencias externas.'`, `sinEntradaSvg: 'El manifiesto no describe la parte infografia_svg, que llegó en el pedido.'`; `campo` pasa a «… calculos o infografia_svg.»; `adjuntos`: «El manifiesto tiene que describir de 2 a 4 archivos.» (`lista(2, 4, …)`); `mime` suma «e image/svg+xml en la infografía editable».
  - `huellaDelPaquete(partes)`: el renglón `infografia_svg:<sha>` se agrega solo si llegó; sin SVG, la huella es exactamente la de hoy.
  - `EVENTO` pasa a función: con `tipo` presente, `unoDe(['evento', 'efemeride'], 'tipoDeEvento')` (mensaje: «El tipo de un evento de la agenda tiene que ser evento o efemeride.»); sin `tipo`, la forma de hoy.
  - `detalleDeLaEdicion` suma a cada ítem de `agenda` `etiqueta: 'Efeméride' | null`, al detalle `numero` (recibe `numero` en `fila`: texto «N.º 3» o null) y el archivo `infografia_svg` en `ARCHIVOS_DEL_DETALLE` (`{ rotulo: 'Infografía editable', formato: 'SVG · ', se_puede_ver: false }`, después de la infografía); `TIPO_DE_DESCARGA.infografia_svg = 'image/svg+xml'`.
  - `itemDeLaLista` suma `numero` (de la fila: «N.º 3» o null), `fecha_partes: { dia: 'Lunes', fecha: '9 de noviembre', anio: 'de 2026' }` (de `fecha_edicion`) y `cantidad` («4 propuestas»). `envio` lo agrega la Tarea 6.
  - `textoDelNumero(n) -> string | null`: «N.º 3»; null si n no es un entero positivo.

- [ ] **Step 1: Tests que fallan** en `tests/dato-quincena-reglas.test.js`:
  - `esSvg acepta el SVG del bot` (empieza con `<svg xmlns="http://www.w3.org/2000/svg" …>` y con `<?xml version="1.0"?>` + comentario delante) y uno con `href="#a"` y `url(#grad)`;
  - `esSvg rechaza` cada uno: `<SCRIPT>`, `<svg ONLOAD = "x">`, `<foreignObject>`, `xlink:href = "https://x.test/a.png"`, `href='//x.test'`, `style="fill:url( http://x.test)"`, `@import`, un BOM delante, un nulo, un `<html>` primero, latin1 roto;
  - `la huella sin SVG no cambia` (contra un valor fijo calculado hoy con las cuatro partes) y `con SVG suma su renglón`;
  - `validarAdjuntos con SVG`: entrada con `image/svg+xml` y la parte → []; parte sin entrada → `sinEntradaSvg`; `image/png` en el SVG → `mime`; contenido inválido → `{ campo: 'infografia_svg', mensaje: MENSAJES_VALIDACION.svg }`;
  - `agenda con tipo`: `'efemeride'` y `'evento'` pasan, sin `tipo` pasa, `'feriado'` da `{ campo: 'agenda[0].tipo', … }`;
  - `textoDelCorreo dice Datito` (las tres frases);
  - `detalleDeLaEdicion` con un ítem `efemeride` → `etiqueta: 'Efeméride'`, con el SVG en `archivos` en segundo lugar («SVG · 7 KB»), y `numero`;
  - `itemDeLaLista` → `numero`, `fecha_partes`, `cantidad`.
  Correr: `node --test tests/dato-quincena-reglas.test.js` → FAIL.
- [ ] **Step 2:** Implementar en `services/datoQuincenaReglas.js` lo de Interfaces.
- [ ] **Step 3:** Actualizar `tests/fixtures/dato-quincena-respuestas.json` (claves nuevas de `lista` y `detalle`, en el orden que arman las reglas, con un ítem de agenda efeméride y el SVG) y el fixture del SVG inventado en `tests/dato-quincena-fixtures.js`. Correr: PASS.
- [ ] **Step 4:** Commit `feat(dato-quincena): el SVG, la efeméride y el nombre de Datito en las reglas`.

### Task 3: La recepción del SVG

**Modelo:** Opus (API que escribe en la base).

**Files:**
- Modify: `config/upload.js:326-363` (`filtroDelDatoQuincena`, `subidaDelDatoQuincena`), `controllers/datoQuincenaController.js` (descarga del SVG)
- Modify: `tests/dato-quincena-api.test.js`

**Interfaces:**
- Consumes: `PARTES`, `TOPES`, `TOPE_DEL_PEDIDO`, `esSvg`, `TIPO_DE_DESCARGA` (Tarea 2).
- Produces: `limits: { fields: 0, files: 5, parts: 6, fileSize: TOPES.infografia_png }` (se derivan de `PARTES.length`); el 413 del SVG dice «La parte infografia_svg supera el tamaño permitido (1 MB).»; `GET …/archivos/infografia_svg` con `Content-Type: image/svg+xml` y adjunto.

- [ ] **Step 1: Tests que fallan:** un POST con las cinco partes → 201 y el adjunto guardado; reenviar los mismos bytes → 200 `repetida`; el paquete de cuatro partes de los tests de hoy sigue dando la misma huella (201 y después 200); un SVG de 1 MB + 1 byte → 413 con su texto; un SVG con `<script>` → 422 con `infografia_svg`; seis partes → 400 «sobran partes»; la descarga del SVG → bytes iguales, `image/svg+xml`, `attachment`. Correr con Mailpit y la base de prueba del archivo: FAIL.
- [ ] **Step 2:** Implementar. Correr `node --test tests/dato-quincena-api.test.js`: PASS.
- [ ] **Step 3:** Commit `feat(dato-quincena): recibir y descargar el SVG`.

### Task 4: Las reglas del correo (puras)

**Modelo:** Opus (reglas).

**Files:**
- Create: `services/datoQuincenaCorreoReglas.js`, `tests/dato-quincena-correo-reglas.test.js`

**Interfaces:**
- Consumes: el objeto calendario (`esDiaHabil`, `proximoDiaHabil`), `sumarDias`, `formatoCorto`/`formatoLargo` de `notasDigitalesCalendario.js`, `NOMBRE_DEL_BOT`, `horaArgentina`, `fechaLarga` de `datoQuincenaReglas.js`, `NOMBRES_DE_LOS_FIJOS` de `feriadosReglas.js`.
- Produces (todas puras; `ahora` es 'AAAA-MM-DD HH:MM:SS' de `ahoraArgentina()`):
  - `DIAS_DE_VIGENCIA = 13`, `MAXIMO_DE_INTENTOS = 3`, `HORA_DE_LA_MANANA = '08:05'`, `HORA_DE_LA_TARDE = '14:00'`, `CADENCIA = 14`.
  - `envioAlLlegar({ tipo, fecha_edicion, envioActivo, hoy }) -> { estado: 'programada' } | { estado: 'no_enviada', motivo: 'apagado' | 'vieja' } | null` (null en un piloto).
  - `estaVigente(fecha_edicion, hoy) -> boolean` (`fecha_edicion >= sumarDias(hoy, -13)`).
  - `decidirCorrida({ programadas, envioActivo, hoy, calendario }) -> { mandar: id | null, noEnviar: [{ id, motivo }] }`: `programadas` son `[{ id, fecha_edicion }]`; apagado → todas `apagado` (cualquier día); día no hábil o `calendario.error` → nada; de las que `fecha_edicion <= hoy`, las no vigentes → `vieja`, de las vigentes la más nueva se manda y las demás → `mas_nueva`; las de `fecha_edicion > hoy` esperan.
  - `proximaSalida({ fecha_edicion, ahora, calendario }) -> 'AAAA-MM-DD HH:MM'`: la regla de la sección 6 de la spec.
  - `instanteDeSalida(salida) -> 'AAAA-MM-DDTHH:MM:00-03:00'`.
  - `estadoDeLaEdicion(envios) -> 'enviada' | 'parcial' | 'fallida' | null`: `envios` son las filas automáticas `[{ estado, intentos }]`; null mientras alguna está `pendiente` o `fallido` con `intentos < 3`; `enviando` cuenta como sin confirmar (parcial).
  - `lineaDelCorreo({ correo, envios, reenvios, correoDelBot, envioActivo, ahora, calendario, tipo }) -> string` y `pastillaDelEnvio({ … mismos …, admin }) -> { tipo: 'enviada'|'programada'|'parcial'|'fallida'|'espera'|'no_enviada'|'piloto', texto } | null`: los textos exactos de la sección 6 de la spec (también la línea del bot y «Reenviada por correo el …» / «Reenviada el mié 25/11»), con la hora «8:05» / «14:00» sin cero a la izquierda y la de un envío real `HH:MM` (como «10:12», «8:07»).
  - `envioDelRecibo({ correo, envios, envioActivo, ahora, calendario, tipo }) -> { estado, programado_at, texto } | null`.
  - `textoDeLaPersona(envio) -> { texto, mal: boolean }`: «Enviado el 10/11 a las 8:05», «No se envió: de licencia», «No se envió: no tenía un email válido», «No se envió: ya no estaba activa», «No se pudo enviar (3 intentos)», «En reintento (1 de 3)», «Sin confirmar», «Pendiente».
  - `resumenDelCorreo({ correo, envios }) -> string`: «Enviada el martes 10/11/2026 a las 8:05, a 2 de 4 personas.» (y las variantes).
  - `proximasEdiciones({ ultimaRegular, hoy, calendario, filasDeFeriados, cantidad = 4 }) -> [{ edicion, sale, motivo }]`: desde la última regular (o el 09/11/2026 si no hay), cada 14 días, las que son hoy o después; `motivo` «no es hábil el lunes 23/11, Día de la Soberanía Nacional» (o «no son hábiles … y …»), con el nombre de la fila o de `NOMBRES_DE_LOS_FIJOS`; null si sale ese día.
  - `modeloDelMail({ detalle, nombreCompleto, url, prueba }) -> { asunto, primerNombre, titulo, numero, bajada, agenda, propuestas, url }`: el asunto «Dato de la Quincena - DD/MM/AAAA» (con «[PRUEBA] » delante en una prueba), la bajada «4 propuestas de comunicación que armó Datito. Son internas: todavía no están aprobadas ni publicadas.».
  - `MENSAJES_CORREO` (los 400, 404 y 409 de las rutas de administración y de la corrida).

- [ ] **Step 1: Tests que fallan**, con `calendarioCon(FILAS_PRECARGA)` de `tests/fixtures/feriados-precarga.js` y momentos fijos:
  - `envioAlLlegar`: regular prendido del 23/11 con hoy 23/11 → programada; apagado → `apagado`; con `fecha_edicion` 14 días antes → `vieja`; piloto → null.
  - `proximaSalida`: llegada el lunes 23/11 a las 7:40 → `'2026-11-24 08:05'`; el martes 24/11 a las 8:10 → `'2026-11-24 14:00'`; a las 14:30 → `'2026-11-25 08:05'`; la del 07/12 llegada el 07/12 → `'2026-12-09 08:05'`; una con `fecha_edicion` mañana, hoy hábil a las 7:00 → mañana a las 8:05.
  - `decidirCorrida`: dos programadas vigentes → manda la más nueva, la otra `mas_nueva`; una de hace 14 días → `vieja`; apagado un sábado → todas `apagado`; un feriado → nada; `calendario.error` → nada.
  - `estadoDeLaEdicion`, `lineaDelCorreo`, `pastillaDelEnvio` (con `admin` true y false), `envioDelRecibo`: un caso por texto de la sección 6 de la spec, comparando el texto exacto.
  - `proximasEdiciones` desde el 09/11 con hoy 12/11 → 23/11 (sale el martes 24/11, motivo de la Soberanía), 07/12 (miércoles 09/12, dos motivos), 21/12 y 04/01/2027 sin motivo.
  - `modeloDelMail`: asunto, «[PRUEBA] », primer nombre de «Persona Uno Ejemplo» → «Persona».
  Correr `node --test tests/dato-quincena-correo-reglas.test.js` → FAIL.
- [ ] **Step 2:** Implementar. PASS.
- [ ] **Step 3:** Commit `feat(dato-quincena): las reglas del correo`.

### Task 5: El mail

**Modelo:** Opus (mails).

**Files:**
- Modify: `services/emailTemplates.js` (una plantilla nueva, sin importar nada de `datoQuincena*`: recibe el modelo armado), `tests/emails-fixtures.js` (un caso), `tests/email-diseno.test.js` si fija la lista de casos
- Test: `tests/dato-quincena-correo-reglas.test.js` (el texto plano)

**Interfaces:**
- Consumes: el objeto de `modeloDelMail` (Tarea 4).
- Produces: `datoQuincenaTemplate(modelo) -> { subject, html, text }`, con `marcoEmail` y sus piezas; la infografía como `<img src="cid:infografia-dato-quincena" …>`; `CID_INFOGRAFIA = 'infografia-dato-quincena'` exportado. La forma visual es la de `~/rpad-notas/dato-quincena-correo/maqueta/mail.html` (franja «Propuesta N de M», la principal con la franja `#1F3A5F` y borde de 2 px, 28 px entre propuestas, «Para validar antes de publicar» en el aviso ámbar, la etiqueta «Efeméride» en la agenda).

- [ ] **Step 1:** Sumar el caso a `casosDeEmail` (con un modelo inventado: dos propuestas, una agenda con una efeméride, «Persona»). Correr `node --test tests/email-diseno.test.js` → FAIL.
- [ ] **Step 2:** Test del texto plano en `tests/dato-quincena-correo-reglas.test.js`: empieza con «Buen día, Persona.», tiene «Propuesta 1 de 2 (principal)», cada campo con su título, y ningún HTML.
- [ ] **Step 3:** Implementar. Correr los dos archivos: PASS.
- [ ] **Step 4:** Commit `feat(dato-quincena): el mail del dato de la quincena`.

### Task 6: La programación al llegar, el recibo y las lecturas con el envío

**Modelo:** Opus (API que escribe en la base).

**Files:**
- Create: `services/datoQuincenaCorreoDatos.js`
- Modify: `services/datoQuincenaDatos.js` (`guardarEdicion`, `leerRecibo`, `listarEdiciones`, `leerEdicion`), `services/datoQuincenaReglas.js` (`reciboDe` suma `envio`), `controllers/datoQuincenaController.js` (`recibirEdicion`, `listar`, `ver`)
- Modify: `tests/dato-quincena-api.test.js`, `tests/fixtures/dato-quincena-respuestas.json`, `tests/dato-quincena-reglas.test.js`

**Interfaces:**
- Consumes: `envioAlLlegar`, `envioDelRecibo`, `lineaDelCorreo`, `pastillaDelEnvio`, `textoDelNumero` (Tareas 2 y 4); `leerCalendario`.
- Produces:
  - `guardarEdicion` lee `envio_activo` dentro de la transacción (`SELECT … FROM dato_quincena_correo_config WHERE id = 1`, sin fila = apagado) y, si `envioAlLlegar` no es null, inserta en `dato_quincena_correos` (`creada_at = ahoraArgentina()`), en la misma transacción y después del `INSERT` de la edición. Recibe `hoy` como parámetro nuevo.
  - En `datoQuincenaCorreoDatos.js`: `leerConfig(conexion = pool) -> { envioActivo }`, `correoDe(edicionId) -> fila | null`, `enviosDe(edicionId) -> [fila]`, `correosDeLasEdiciones(ids) -> Map(id, { correo, envios })` (una consulta por tabla, con `IN (?)`).
  - `reciboDe(fila, adjuntos, avisos, repetida, envio)`: `envio` al final del recibo (después de `avisos`).
  - `listarEdiciones` suma a cada fila `numero` (cuántas regulares tienen `fecha_edicion` menor o igual, solo en una regular; una subconsulta) y `correo_del_bot` (`JSON_VALUE(metadata, '$.correo.estado')` y `'$.correo.enviado_at'`); el controlador arma `envio` con `pastillaDelEnvio`, con `admin: esAdmin(req.user.rol)`, leyendo el calendario una vez.
  - El detalle: `correo` pasa a `lineaDelCorreo(…)`; `numero` como en la lista.
- [ ] **Step 1: Tests que fallan** en la API: con el envío prendido (escribir la fila 1 de la config en la base de prueba), un POST regular de hoy → 201 con `envio.estado 'programada'`, `programado_at` y `texto`; la fila en `dato_quincena_correos`; el mismo POST → 200 con el mismo `envio`; otro contenido → 409 y ninguna fila nueva; apagado → `no_enviada`/`apagado` y `envio.texto` «No se envía por correo: el envío automático está apagado.»; un piloto → `envio: null`, «Los pilotos no se envían por correo.» en el detalle. La lista: `numero`, `fecha_partes`, `cantidad`, `envio`; un lector no ve «Enviada a 3 de 4» y un admin sí; una edición sin fila de correo con el bot `enviado` → «Enviada por Datito el lun 09/11».
- [ ] **Step 2:** Implementar. Actualizar el fixture de respuestas y las listas de claves en orden. PASS en `dato-quincena-api`, `dato-quincena-reglas` y `dato-quincena-frontend`.
- [ ] **Step 3:** Commit `feat(dato-quincena): programar el correo al llegar y mostrar el envío`.

### Task 7: La corrida: el paso de las 8:05 y las 14:00

**Modelo:** Opus (corridas).

**Files:**
- Create: `services/datoQuincenaCorreo.js`, `tests/dato-quincena-correo.test.js`
- Modify: `services/datoQuincenaCorreoDatos.js`, `controllers/notificacionesController.js` (`ejecutarNotificacionesDiarias` y `ejecutarNotificacionCambiosPendientes`), `controllers/notasDigitalesController.js` (`verEstado`), `public/correos.html` y `public/js/correos.js` (la línea y el aviso), `tests/notificaciones.test.js`, `tests/permisos.test.js` (tomar el candado), `tests/paginas.test.js` (`VERSION_CORREOS`), `tests/mi-espacio-eventos-diario.test.js` si su control del orden del código lo pide

**Interfaces:**
- Consumes: `conBloqueo` de `services/notasDigitales.js`; `deLicenciaOficial` de `services/miEspacioEventosDiarioDatos.js`; `sendEmail`, `remitente`; `decidirCorrida`, `estadoDeLaEdicion`, `modeloDelMail`, `MAXIMO_DE_INTENTOS` (Tarea 4); `datoQuincenaTemplate`, `CID_INFOGRAFIA` (Tarea 5); `detalleDeLaEdicion`, `leerEdicion` (para armar el modelo); `leerArchivo` (los bytes del PNG y del SVG).
- Produces:
  - `BLOQUEO_DATO_QUINCENA = 'rpad_dato_quincena_correo'`.
  - `ejecutarCorreoDelDatoQuincena({ hoy, ahora, calendario }) -> { ocupada, edicion: id | null, enviados, fallidos, licencia, omitidos, errores: [{ usuario_id, error }] }`: bajo el candado; anota inicio y fin en la config; `decidirCorrida`; marca las `noEnviar`; para la que se manda, si no tiene filas automáticas las crea con la lista de ese momento (`dato_quincena_destinatarios` JOIN `usuarios`: inactiva o sin `emailValido` → `omitido`; de licencia oficial ese día → `licencia`; las demás `pendiente`, con su email de ese momento), o queda `no_enviada`/`sin_lista` si no hay nadie; después, para la que se manda y para toda edición con filas `fallido` e `intentos < 3` (si hoy es hábil y el envío está prendido), reserva cada persona (`UPDATE … SET estado = 'enviando', intentos = intentos + 1, ultimo_intento_at = ? WHERE id = ? AND estado IN ('pendiente', 'fallido') AND intentos < 3`, sigue solo con `affectedRows === 1`), arma el mail con su nombre y lo manda con `to: [email]`, `from: remitente()` y los adjuntos (PNG en línea con `cid`, PNG como archivo, SVG si hay), y anota `enviado`/`enviado_at` o `fallido` con el texto fijo «No se pudo enviar el mail.»; al final recalcula el estado de cada edición tocada (`estadoDeLaEdicion`) y `enviada_at` (el primer `enviado_at`).
  - `correoDelDatoQuincenaAislado(calendario, { ahora } = {}) -> mismo objeto`, que nunca rechaza (como `avisoDiarioAislado`).
  - `estadoDelCorreoDelDatoQuincena({ ahora }) -> { texto, alertas }` para Correos → Estado: la línea de la última corrida («El dato de la quincena: la última corrida fue el 24/11 a las 8:05: mandó 4 mails.») y el aviso mientras la última edición enviada tenga una persona `fallido` con 3 intentos sin un reenvío `enviado` posterior a esa persona.
  - En la corrida de las 8:05, el paso va después de `enviarAvisosDeVencimiento` y antes de `resultados.diario = await diario`; en la de las 14:00, después del diario. Sus errores van a `resultados.errores` con `tipo: 'dato-quincena'` y dan 207; «ocupada» no es un error.
- [ ] **Step 1: Tests que fallan** en `tests/dato-quincena-correo.test.js` (base `rpad_test_dato_quincena_correo`, la precarga de feriados, Mailpit vaciado, usuarios y direcciones inventados `@ejemplo.test`, `EMAIL_SOLO_A = ''`), cada uno llamando al servicio con `{ hoy, ahora, calendario }` fijos:
  - un día hábil a las 8:05 con dos personas → dos mails en Mailpit con el asunto «Dato de la Quincena - 23/11/2026», cada uno a su casilla, con el PNG en línea y adjunto y el SVG; la edición `enviada`;
  - el lunes 23/11 (feriado) → nada; el martes 24/11 → sale;
  - una corrida dos veces seguidas → sigue habiendo un mail por persona; con el candado tomado en otra conexión → `ocupada: true`, ningún mail;
  - una persona con el transporte fallando (un `sendEmail` falso inyectable o una dirección que Mailpit rechace) → `fallido`, intento 1; la corrida de las 14:00 la reintenta; al tercero queda `fallido` con 3 y la edición `parcial`, y `estadoDelCorreoDelDatoQuincena` trae el aviso;
  - una persona de licencia oficial ese día → `licencia`, sin mail, sin reintento; una inactiva → `omitido`;
  - una programada después de la corrida de las 8:05 → la de las 14:00 la manda (Review Focus 2);
  - la persona cambió el email o salió de la lista antes de la primera corrida → se usa lo de ese momento (Review Focus 3);
  - apagado → la programada queda `no_enviada`/`apagado`; dos programadas → la vieja `mas_nueva`; de hace 14 días → `vieja`; lista vacía → `sin_lista`;
  - la tabla de feriados renombrada (`conLaTablaRenombrada`) → no manda; con la tabla de vuelta, al día siguiente hábil, sale (Review Focus 4).
  Correr: FAIL.
- [ ] **Step 2:** Implementar el servicio y sus consultas. PASS.
- [ ] **Step 3:** Conectar los dos pasos en `notificacionesController.js`; en `tests/notificaciones.test.js` y `tests/permisos.test.js`, tomar también `rpad_dato_quincena_correo` en la conexión que toma el del diario (antes de iniciar el servidor) y soltarlo al final. Correr `node --test tests/mi-espacio-eventos-diario.test.js tests/notas-api.test.js` (el 200 con la base vacía y el orden del código): PASS.
- [ ] **Step 4:** Correos → Estado: `verEstado` suma `dato_quincena: { texto }` y sus `alertas`; `correos.html` un `<p id="nd-dato-quincena" hidden>` junto a `#nd-diario`; `correos.js` lo llena como al diario; subir `?v=` de `correos.js` y `VERSION_CORREOS`. Test en el archivo de Correos que ya prueba `#nd-diario` (o en `tests/dato-quincena-correo.test.js` para `verEstado`).
- [ ] **Step 5:** Commit `feat(dato-quincena): el paso del correo en las corridas`.

### Task 8: Las rutas de administración: la configuración, el estado por persona, reenviar y la prueba

**Modelo:** Opus (permisos y API que escribe en la base).

**Files:**
- Create: `controllers/datoQuincenaCorreoController.js`
- Modify: `routes/index.js`, `services/datoQuincenaCorreo.js` (`reenviar`, `mandarPrueba`), `services/datoQuincenaCorreoDatos.js`, `tests/permisos.test.js`, `tests/dato-quincena-api.test.js`

**Interfaces:**
- Consumes: Tareas 4 a 7.
- Produces (todas con `authMiddleware, adminOnly`):
  - `GET /api/dato-quincena/correo` → `{ envio_activo, proximas, personas: [{ id, nombre, cargo, rol, email, recibe, licencia }] }`; `licencia`: «De licencia hasta el 30/11» o null. Lee `filasDeFeriados` una sola vez y arma el calendario con `calendarioCon` (si la tabla falla, `proximas: []`).
  - `PUT /api/dato-quincena/correo/envio` (`{ activo }`) → `{ envio_activo }`; anota `cambiado_por` y `cambiado_at`.
  - `PUT /api/dato-quincena/correo/destinatarios` (`{ usuarios: [ids] }`): una lista de enteros positivos sin repetir, de usuarios activos; si no, 400 «La lista de personas no es válida.»; reemplaza la tabla en una transacción.
  - `GET /api/dato-quincena/ediciones/:id/correo` → `{ resumen, linea, personas: [{ nombre, texto, mal }], reenvios: [{ texto }], se_puede_reenviar, lista_de_hoy: [{ id, nombre }] }`.
  - `POST /api/dato-quincena/ediciones/:id/reenvios` (`{ a: 'todas' }` o `{ a: <id> }`): solo una regular, con el automático terminado (si no, 409 «Esta edición todavía se está mandando sola: se puede reenviar cuando termine.»); una persona que no está en la lista, 400; bajo el candado (ocupado, 409 «Ahora se está mandando el dato de la quincena. Probá de nuevo en unos minutos.»); filas `reenvio`; responde `{ enviados, fallidos }` y el texto «Se reenvió a 4 personas.» / «Se reenvió a 3 de 4 personas: a 1 no le llegó.».
  - `POST /api/dato-quincena/ediciones/:id/prueba`: a `req.user.userId` con su email (sin uno válido, 400), «[PRUEBA] » en el asunto, cualquier edición, aunque el envío esté apagado; bajo el candado; fila `prueba`; responde «Te mandamos la prueba a tu casilla.».
- [ ] **Step 1: Tests que fallan:** en `tests/permisos.test.js`, las seis rutas: sin sesión 401, lector y colaborador 403, admin y editor 200 o su error de negocio; en `tests/dato-quincena-api.test.js`: el GET con personas inventadas y una de licencia; el PUT del envío con `'true'` (texto) no prende; destinatarios con un id inactivo → 400 y la lista sin cambios; reenviar una programada → 409; reenviar a todas una enviada → mails en Mailpit y la línea «Reenviada…» si el automático no la había mandado; la prueba → un mail con «[PRUEBA] » a la casilla del admin; un id que no existe → 404.
- [ ] **Step 2:** Implementar. PASS.
- [ ] **Step 3:** Commit `feat(dato-quincena): la configuración del correo, reenviar y la prueba`.

### Task 9: La página: pestañas, tarjetas y páginas

**Modelo:** Sonnet (presentación; la revisión, Opus).

**Files:**
- Modify: `public/dato-quincena.html` (el `<style>`: pestañas, tarjetas «diario», páginas; la bajada sin el nombre del bot, la descripción sin el nombre), `public/js/dato-quincena.js`, `tests/dato-quincena-frontend.test.js`, `tests/paginas.test.js` (`VERSION_DATO_QUINCENA`)

**Interfaces:**
- Consumes: la lista con `numero`, `fecha_partes`, `cantidad`, `envio` (Tarea 6).
- Produces (puras, en `dato-quincena.js`):
  - `NOMBRE_DEL_BOT = 'Datito'` y `textoDeLaBajada()` → «Las propuestas de comunicación que arma Datito cada dos lunes, tal como llegaron. Son internas: guardarlas acá no las aprueba ni las publica. El RPAD las manda por correo a las personas de la lista.»; el texto del vacío pasa a «Todavía no llegó ninguna edición. Datito manda cada una cada dos lunes.».
  - `POR_PAGINA = 18`, `paginaDeEdiciones(ediciones, pedida) -> { pagina, paginas, desde, hasta, total, visibles }` (una pedida fuera de rango va a la última que existe), `htmlDePaginasDeEdiciones({ pagina, paginas, desde, hasta, total })` («Anterior», «Página 1 de 2» con «Mostrando 1–18 de 27», «Siguiente»; con una página, ''), `htmlDeTarjeta(item)` (la variante A de la maqueta: `<li class="dq-tarjeta">` con «El dato de la quincena» y el N.º o la marca con la doble línea, la fecha en tres renglones, la cantidad, el título de la principal y la pastilla `dq-envio dq-envio-<tipo>` con su ícono; el enlace en la fecha, estirado con `::after`), `htmlDeLaLista(datos, pagina)`, `htmlDePestanas(activa)` (solo se llama con `Auth.isAdmin()`).
  - El estado en la dirección: `?anio=`, `&pagina=N`, `#correo`; `estadoDeLaUrl`/`urlDeEstado` los conservan; cambiar de año vuelve a la página 1.
  - La lista ya no pide miniaturas (se van `data-mini`, `ponerImagenDq` en la lista y su CSS `.dq-mini`).
  - El detalle: el `numero` junto a la fecha (como la marca de un piloto), «Nota de Datito:» con `NOMBRE_DEL_BOT`, y en «Agenda de la quincena» la etiqueta suave «Efeméride» en los ítems con `etiqueta` (texto, no solo color).
- [ ] **Step 1: Tests que fallan** en `tests/dato-quincena-frontend.test.js` (en el `vm`, con el fixture): `htmlDeTarjeta` con una regular (N.º, «9 de noviembre», «de 2026», «4 propuestas», el título, la pastilla con su texto escapado), con un piloto (la marca, sin N.º), con `envio: null` (sin pastilla); `paginaDeEdiciones` con 27 (dos páginas, 18 y 9) y con una pedida 5 → 2; `htmlDePaginasDeEdiciones` con una sola página → ''; `htmlDePestanas` con sus `role` y `aria-selected`; `htmlDelDetalle` con `numero` y un ítem de agenda con `etiqueta: 'Efeméride'`, y «Nota de Datito:»; el CSS: la grilla `repeat(3, minmax(0, 1fr))`, 2 columnas a 960 px, 1 a 560 px, el foco de la tarjeta con `:has(`, `prefers-reduced-motion`; la bajada y la descripción ya no traen el nombre; ninguna clase `ad-`. FAIL.
- [ ] **Step 2:** Implementar; subir `dato-quincena.js?v=` y `VERSION_DATO_QUINCENA`. PASS en `dato-quincena-frontend` y `paginas`.
- [ ] **Step 3:** Mirarla en el navegador con la base de prueba local (lector y admin, 2026 y un año con más de 18) y comparar con la maqueta.
- [ ] **Step 4:** Commit `feat(dato-quincena): la lista en tarjetas tipo diario, con páginas`.

### Task 10: La página: la pestaña Correo y la caja del correo en el detalle

**Modelo:** Opus (formularios).

**Files:**
- Modify: `public/dato-quincena.html` (el panel Correo, el diálogo «Reenviar», el CSS), `public/js/dato-quincena.js`, `tests/dato-quincena-frontend.test.js`, `tests/paginas.test.js`

**Interfaces:**
- Consumes: las rutas de la Tarea 8.
- Produces:
  - Puras: `htmlDelCorreo(datos)` (las dos cajas de la maqueta: «Envío por correo» con el interruptor `role="switch"`, la regla, «Las próximas ediciones»; «Quién lo recibe» con la tabla, «Lo reciben N personas.» y «Guardar»), `htmlDeLaCajaDelCorreo(datos)` (en el costado del detalle, debajo de «Archivos»: el resumen, una fila por persona con `mal` en ámbar y su texto, los reenvíos, «Reenviar…» solo con `se_puede_reenviar`, y «Enviarme una prueba»), `htmlDelReenvio(lista)` (el diálogo: «A todas las personas que hoy lo reciben (N)» o «A una persona:» con un `<select>`).
  - DOM: el interruptor guarda al cambiar; al prender, un `confirm` con «Desde ahora, cada edición regular que llegue sale por correo a la lista. ¿Prendemos el envío automático?»; si el PUT falla, vuelve a como estaba y avisa. «Guardar», la prueba y «Reenviar» deshabilitados hasta la respuesta; los errores, con el `error` del servidor (escapado) en `showToast`; el diálogo se cierra con la ×, «Cancelar», Escape o el velo, y el foco vuelve al botón.
  - La caja del correo y la pestaña se piden solo con `Auth.isAdmin()`; los demás roles ni las piden ni las ven.
- [ ] **Step 1: Tests que fallan:** `htmlDelCorreo` con dos personas (una de licencia) y el envío prendido (el `checked`, el texto «Lo reciben 1 persona.» → «Lo recibe 1 persona.»); `htmlDeLaCajaDelCorreo` con y sin `se_puede_reenviar`; `htmlDelReenvio`; todo texto del servidor escapado (un nombre con `<b>`); ids sin repetir. FAIL.
- [ ] **Step 2:** Implementar; subir versión. PASS.
- [ ] **Step 3:** Mirarla en el navegador: prender y apagar, tildar, guardar, reenviar a una persona, la prueba (todo a Mailpit).
- [ ] **Step 4:** Commit `feat(dato-quincena): la pestaña Correo y el envío en el detalle`.

### Task 11: El nombre «Datito» y la documentación

**Modelo:** Sonnet (texto; la revisión, Opus).

**Files:**
- Modify: todo lo vigente que dice «Grok Bot» fuera de las specs y los planes viejos (`grep -rn "Grok Bot" --exclude-dir=node_modules --exclude-dir=superpowers .`): código, comentarios, tests (las frases que comparan), `docs/temas/`.
- Create: `docs/temas/dato-quincena-correo.md` (el envío: cuándo, quién, estados y textos, la corrida, reenviar y la prueba, el mail, el SVG y la efeméride, la página Correo, la transición, los archivos de tests).
- Modify: `docs/temas/dato-quincena.md` (lo que ya no es cierto: «no manda mails», «no corre ningún cron», la lista en filas, las miniaturas; un puntero al documento nuevo), `docs/temas/calendario-y-corridas.md` (el paso y su candado), `docs/temas/despliegue.md` (la migración en el orden), `CLAUDE.md` (una fila en el mapa: «El dato de la quincena: el correo, la lista, Reenviar» → `dato-quincena-correo.md`), `.claude/rules/dato-quincena.md` (el glob de los archivos nuevos y el documento nuevo; es ruta protegida: se escribe en el `.claude/rules/` del worktree y pide permiso).

- [ ] **Step 1:** Renombrar; correr `grep -rn "Grok Bot"` y quedarse solo con specs y planes viejos.
- [ ] **Step 2:** Escribir y ajustar los documentos. Correr `node --test tests/documentos.test.js`: PASS (topes y punteros).
- [ ] **Step 3:** Commit `docs(dato-quincena): Datito y el documento del correo`.

### Task 12: La base local, la suite, la simulación y el cierre

**Modelo:** Opus para la simulación y las correcciones; Fable para la revisión final de la rama.

- [ ] **Step 1:** Pedir a la coordinadora el turno de código (SendMessage a `local_e7d7604b-f7e1-46e9-9f36-ba3f80b7ac0b`) y esperar «CONTENEDOR LIBRE» y «BASE RECARGADA». Con su OK, respaldo y `migracion-dato-quincena-correo.sql` en la base compartida (`docker exec … mariadb … < …`, sin `docker compose`), y verificar que `schema` y `permisos` pasan.
- [ ] **Step 2:** Suite completa (`npm test`), una sola en el contenedor. Esperado: 0 fallas.
- [ ] **Step 3:** Simulación local con la base del `.env` copiada a `rpad_sim_dato_quincena_correo` y `EMAIL_SOLO_A` con las dos casillas de prueba del usuario o vacía (Mailpit): el paquete de simulación de Datito (piloto 6, fuera del repo, en `~/rpad-notas/dato-quincena-correo/`) entra por el POST con un token de prueba; la edición del 09/11 recibe «Enviarme una prueba»; una regular inventada recorre el lunes 23/11 (feriado) → martes 24/11 a las 8:05 con el servicio y un hoy fijo. Anotar lo visto en `~/rpad-notas/dato-quincena-correo/simulacion.md`.
- [ ] **Step 4:** Revisión final de la rama con Fable (`superpowers:requesting-code-review`), correcciones con Opus, re-revisión.
- [ ] **Step 5:** Merge en main (squash) y push; kit `~/rpad-kits/RPAD-deploy-dato-quincena-correo/` contra el último commit en producción que diga la coordinadora: `PASOS.txt` (migración antes del código, Restart, tildar a las personas, prueba, la transición con Datito), el SQL, la vuelta atrás y los archivos; el «contrato v1.2» para Datito en `~/rpad-notas/dato-quincena/para-grok/contrato-v1.2.md`, sin secretos y con los mensajes exactos del código; aviso «TODO EN VERDE» a la coordinadora con el conteo.
