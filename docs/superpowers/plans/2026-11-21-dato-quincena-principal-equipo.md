# La principal del equipo: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que administración elija la principal del equipo de cada edición del dato de la quincena, que se vea en General, Propuestas y la lista, y que el mail aclare que su principal es la de Datito y sume un recuadro al RPAD.

**Architecture:** una tabla nueva con una fila por elección (la vigente es la última); un PUT solo para administración; el detalle y la lista suman lo de las dos principales, con los textos ya armados; el mail suma dos claves al modelo que la plantilla dibuja solo si vienen.

**Tech Stack:** Node 22, Express 4, ES Modules, MariaDB (mysql2/promise), vanilla JS, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-21-dato-quincena-principal-equipo-design.md` (leerla entera antes de cada tarea).

## Global Constraints

- El contrato v1.4, el POST de Datito, su validación y sus tests no cambian. Si una tarea necesita tocarlos, frena y avisa.
- Lo archivado no cambia: ni `dato_quincena_ediciones`, ni `dato_quincena_propuestas` (tampoco `principal`), ni `metadata`.
- El servidor arma los textos y la página los imprime. Todo texto del servidor pasa por `esc` en la página, y un número va con `String`.
- El nombre del bot sale de `NOMBRE_DEL_BOT`, en el servidor y en la página. La plantilla del mail no escribe «Datito» (lo controla `tests/email-diseno.test.js`).
- Repo público: ningún nombre real; quien elige en los tests es «Persona Inventada». Ningún dato de producción ni las cifras del piloto 25.
- Lenguaje neutro, «del» y «al». Un renglón por oración en los documentos.
- Respuestas `{ success, data?, error?, message? }`; un 500 da un mensaje fijo y, en la consola, solo el código y el mensaje.
- Ninguna clase ni id empieza con `ad-`; foco visible; 4,5:1; el color nunca es lo único que distingue.
- Nada de `docker compose`. La base del `.env` es la local; la migración corre ahí (Tarea 1) antes de la suite.
- Las tareas corren en paralelo en el mismo worktree, con archivos que no se pisan: **ninguna hace commit**. Lo hace la sesión que coordina, después de revisar.
- El fixture compartido `tests/fixtures/dato-quincena-respuestas.json` ya está actualizado (lo hizo la sesión que coordina) y es el contrato entre la Tarea 2 y la Tarea 4: no se edita sin avisar.

## Review Focus

1. Dos personas eligen a la vez: no se cruzan (fila de la edición `FOR UPDATE`), gana la última y la misma elección no se repite. Test en la Tarea 2.
2. `orden` raro (`'2'`, `0`, `-1`, `1.5`, `300`, `null`, sin la clave, un orden que la edición no tiene): 400 sin escribir nada. Test en la Tarea 2.
3. Un lector o un colaborador mandan el PUT: 403, y sin sesión, 401. Test en la Tarea 2 (`tests/permisos.test.js`).
4. Un mail que sale después de que el equipo eligió (un reintento, un reenvío, la prueba) sale igual que antes de elegir. Test en la Tarea 3.
5. Un título de propuesta con HTML (`<img src=x onerror=alert(1)>`) en la franja, el diálogo, las marcas y la tarjeta sale escapado. Test en la Tarea 4.

---

### Task 1: La base (Opus)

**Files:**
- Create: `database/updates/migracion-dato-quincena-principal-equipo.sql`, `database/updates/rollback-dato-quincena-principal-equipo.sql`
- Modify: `database/schema.sql` (después de las tablas del correo del dato de la quincena)
- Test: `tests/schema.test.js`

**Interfaces:**
- Produces: la tabla `dato_quincena_principal_equipo` de la spec, sección 1, columna por columna, con los nombres de índices y FK de la spec.

- [ ] **Step 1:** Leer `tests/schema.test.js` y `~/rpad-notas/dato-quincena-principal-equipo/escaneo/4-tests-docs-permisos.md` (punto 1: qué pide una tabla nueva).
- [ ] **Step 2: Escribir los tests que fallan.**
  - El `it` de la tabla: columnas, tipos, nulabilidad, PK, los dos KEY y las dos FK con `ON DELETE CASCADE` y `ON DELETE SET NULL`.
  - `TOTAL_DE_TABLAS` pasa de 54 a 55.
  - La tabla en el `for` «no trae datos».
  - Un `describe('migracion-dato-quincena-principal-equipo')` como el del correo, que pruebe:
    - que corre sobre una base con las tablas del dato de la quincena y del correo;
    - que corre dos veces sin error;
    - que el rollback la borra y se puede volver a correr;
    - que borrar una edición borra sus elecciones;
    - que borrar el usuario deja `elegida_por` en NULL;
    - que una elección con un `orden` que la edición no tiene falla por la FK.
  - Ajustar los bloques anteriores que la tabla nueva cambia:
    - el DROP de las ediciones;
    - el orden de los rollbacks: el nuevo va primero;
    - los `LIKE 'dato\_quincena\_%'`.
- [ ] **Step 3:** Correr `node --test tests/schema.test.js`. Tiene que fallar por la tabla que falta.
- [ ] **Step 4: Escribir la migración, el rollback y `schema.sql`.**
  - La cabecera de la migración, como la de `migracion-dato-quincena-correo.sql`: qué agrega, que es aditiva y repetible, el orden («ANTES de subir el código nuevo, después de migracion-dato-quincena-correo.sql») y el rollback.
  - El rollback: `DROP TABLE IF EXISTS`, con la cabecera que dice que va antes que `rollback-dato-quincena-correo.sql` y `rollback-dato-quincena.sql`.
- [ ] **Step 5: Correr la migración en la base local del `.env`, sin imprimir la clave.**
  `docker exec -i -e MYSQL_PWD=… rpad-db mariadb -u<DB_USER> <DB_NAME> < database/updates/migracion-dato-quincena-principal-equipo.sql`, con `docker` en `/Applications/Docker.app/Contents/Resources/bin/docker` y los valores leídos del `.env` del worktree.
- [ ] **Step 6:** Correr `node --test tests/schema.test.js`. Tiene que pasar entero.

### Task 2: El servidor (Opus; después de la Tarea 1 para los tests con base)

**Files:**
- Modify: `services/datoQuincenaDatos.js`, `services/datoQuincenaReglas.js`, `controllers/datoQuincenaController.js`, `routes/index.js`
- Test: `tests/dato-quincena-reglas.test.js`, `tests/dato-quincena-api.test.js`, `tests/permisos.test.js`

**Interfaces:**
- Consumes: la tabla de la Tarea 1; el fixture compartido (las claves `principal_datito` y `principal_equipo` de cada `detalle*`, `rotulo` en cada `principal` de las listas, y las variantes `detalle_equipo_coincide` y `detalle_equipo_otra`).
- Produces:
  - `leerPrincipalDelEquipo(edicionId)` en `datoQuincenaDatos.js`.
    Devuelve `{ orden: number, nombre: string | null, elegida_at: 'AAAA-MM-DD HH:MM:SS' } | null`: la de mayor `id`, con el `nombre_completo` de `usuarios` (LEFT JOIN).
  - `guardarPrincipalDelEquipo({ edicionId, orden, usuarioId, ahora })` en `datoQuincenaDatos.js`.
    Devuelve `{ existe: boolean, valida: boolean, cambio: boolean, coincide: boolean }`.
    Trabaja en una transacción, con la fila de la edición `FOR UPDATE`, la propuesta comprobada y la vigente comparada; inserta solo si cambia.
  - `listarEdiciones` suma `orden_del_equipo: number | null` a cada fila, con una sola consulta más.
  - En `datoQuincenaReglas.js`:
    - `detalleDeLaEdicion({ …, eleccion = null })` suma `principal_datito` y `principal_equipo` al final, como en la spec, sección 3;
    - `itemDeLaLista(fila, envio)` lee `fila.orden_del_equipo` (`undefined` cuenta como null);
    - `MENSAJES_PRINCIPAL_EQUIPO` y `mensajeDeLaEleccion({ orden, coincide, cambio })` arman los cuatro textos de la spec, sección 2.
  - `PUT /api/dato-quincena/ediciones/:id/principal-equipo` con `authMiddleware, adminOnly`, que llama a `elegirPrincipalDelEquipo` en `controllers/datoQuincenaController.js`.

- [ ] **Step 1: Tests de reglas que fallan** (`tests/dato-quincena-reglas.test.js`).
  - El `it` existente «la edición de prueba da el detalle de las respuestas de la página…» tiene que dar el fixture nuevo: hoy falla por las dos claves.
  - Nuevos:
    - `detalle con eleccion { orden: 1, nombre: 'Persona Inventada', elegida_at: '2026-11-23 10:12:00' }` da `RESPUESTAS.detalle_equipo_coincide.data`.
    - Con `orden: 2`, da `RESPUESTAS.detalle_equipo_otra.data`.
    - `nombre: null`: `quien` es «La eligió el equipo el 23/11/2026 a las 10:12.».
    - Una `eleccion` con un orden que la edición no tiene se toma como sin elegir.
    - Sin propuestas, `principal_datito` es null.
    - `itemDeLaLista` con `orden_del_equipo: 2` muestra el título de la 2 con `rotulo: 'Principal del equipo'`, y `resto` nombra el dataset de la 1 y no el de la 2.
    - Sin `orden_del_equipo`, da el ítem del fixture.
    - `mensajeDeLaEleccion` da los cuatro textos exactos de la spec, sección 2.
- [ ] **Step 2:** `node --test tests/dato-quincena-reglas.test.js` falla. Implementar las reglas. Vuelve a pasar.
- [ ] **Step 3: Tests de la API que fallan** (`tests/dato-quincena-api.test.js`), contra el servidor de prueba como los que ya hay.
  - Un admin elige la 2: 200, `data.cambio` true, el `message` de la spec, y el detalle trae `principal_equipo.orden` 2 con su `quien`.
  - Elegir la 2 otra vez: 200, `cambio` false, «La propuesta 2 ya era la principal del equipo.», y sigue habiendo una sola fila.
  - Elegir la de Datito: «Quedó la de Datito como principal del equipo.» y `coincide` true en el detalle.
  - Un editor y el superadmin también eligen. Un lector y un colaborador: 403 sin escribir.
  - Cada `orden` raro de la Review Focus 2: 400 «Elegí una de las propuestas de la edición.», sin escribir.
  - Un id 999999, `abc` o `0`: 404 «No existe esa edición.», antes de mirar el cuerpo.
  - Dos PUT a la vez con órdenes distintos dejan dos filas, y el detalle muestra la de mayor id. Dos PUT a la vez con el mismo orden dejan una sola fila.
  - La lista muestra la del equipo con su `rotulo`, y la forma de la lista y la del detalle siguen siendo las del fixture.
  - Un lector recibe el mismo detalle que el admin.
- [ ] **Step 4:** `tests/permisos.test.js`: sumar `['PUT', '/dato-quincena/ediciones/999999/principal-equipo', 404, 'No existe esa edición.']` a `RUTAS_DEL_CORREO_DEL_DATO`, que entra en `RUTAS_SOLO_ADMIN`.
- [ ] **Step 5: Implementar.**
  - Datos y controlador:
    - `ver` lee `leerPrincipalDelEquipo` en paralelo con lo demás y la pasa como `eleccion`.
    - `elegirPrincipalDelEquipo` sigue el orden de la spec, sección 2. Un `orden` vale si es `Number.isSafeInteger` y está entre 1 y 255.
  - La ruta, en `routes/index.js`, junto a las del correo, con su comentario.
  - El mensaje del 500: «Error al guardar la principal del equipo».
- [ ] **Step 6:** Correr `node --test tests/dato-quincena-reglas.test.js tests/dato-quincena-api.test.js tests/permisos.test.js`. Tiene que pasar.

### Task 3: El mail (Opus; en paralelo con 1 y 2)

**Files:**
- Modify: `services/datoQuincenaCorreoReglas.js` (`modeloDelMail`), `services/emailTemplates.js` (`datoQuincenaTemplate` y sus ayudantes)
- Test: `tests/dato-quincena-correo-reglas.test.js`, `tests/email-diseno.test.js` (y `tests/emails-fixtures.js` si hace falta), `tests/dato-quincena-resguardo.test.js`, `tests/dato-quincena-correo.test.js`

**Interfaces:**
- Produces: `modeloDelMail` suma, después de `bajada`, `aclaracion` (el texto de la spec, sección 5, armado con `NOMBRE_DEL_BOT`) y `recuadro: true`.
  La plantilla los dibuja solo si `typeof modelo.aclaracion === 'string'` y `modelo.recuadro === true`.

- [ ] **Step 1:** Leer `~/rpad-notas/dato-quincena-principal-equipo/escaneo/2-mail.md` (dónde va cada cosa, las restricciones de los tests y las anclas medidas).
- [ ] **Step 2: Tests que fallan.**
  - **Resguardo** (`tests/dato-quincena-resguardo.test.js`). El fixture no se regenera.
    - El mail esperado es el del fixture con exactamente dos inserciones, en HTML y en texto, del mail y de la prueba.
    - Cada ancla aparece una sola vez antes de reemplazar: la frase, después de la bajada; el recuadro, después de la fila del saludo; en el texto, después de la bajada y del bloque del título.
    - Un `it` que diga que, sin las dos inserciones, el mail es el de antes byte por byte.
  - **Correo-reglas:** las claves exactas del modelo, con `aclaracion` y `recuadro`; el texto exacto de `aclaracion`; y la TEXTO completa con el renglón de la frase y el bloque «Esta edición se lee mejor en el RPAD: <url>».
  - **Diseño** (`tests/email-diseno.test.js`):
    - un recuadro celeste más (6 en vez de 5) y su texto;
    - el botón «Ver la edición en el RPAD» dos veces, con la misma dirección;
    - la frase en `#5A7391`;
    - un modelo sin las claves nuevas sale como hoy;
    - la plantilla sigue sin la palabra «Datito».
  - **Correo con la base** (`tests/dato-quincena-correo.test.js`), la Review Focus 4: la prueba de una edición antes y después de insertar una fila en `dato_quincena_principal_equipo` da el mismo `html` y `text`. Necesita la migración de la Tarea 1 en la base local; si todavía no está, dejar el test escrito y avisarlo.
- [ ] **Step 3:** Implementar en el modelo y la plantilla, con `COLORES` (sin colores sueltos) y el botón con el ayudante `boton` que ya existe.
- [ ] **Step 4:** Correr `node --test tests/dato-quincena-correo-reglas.test.js tests/email-diseno.test.js tests/dato-quincena-resguardo.test.js tests/dato-quincena-correo.test.js`. Tiene que pasar.

### Task 4: La página (Opus; en paralelo con 1, 2 y 3)

**Files:**
- Modify: `public/js/dato-quincena.js`, `public/dato-quincena.html` (el diálogo estático y el CSS de su `<style>`)
- Test: `tests/dato-quincena-frontend.test.js`, `tests/paginas.test.js` (`VERSION_DATO_QUINCENA` 20261235 → 20261236, y el `?v=` en el HTML)

**Interfaces:**
- Consumes:
  - del detalle, `principal_datito` y `principal_equipo` (spec, sección 3, y las variantes del fixture);
  - de cada ítem de la lista, `principal.rotulo`;
  - `PUT /api/dato-quincena/ediciones/:id/principal-equipo` con `{ orden }`, que responde `{ success, data: { cambio }, message }` (los mensajes de error llegan en `error`).

- [ ] **Step 1: Mirar la maqueta (referencia visual, no código para copiar).**
  - La maqueta es `~/rpad-notas/dato-quincena-principal-equipo/maqueta/web/`, en la dirección B: `js/principal-maqueta.js` (las funciones `…B` y las comunes) y `css/principal-maqueta.css`.
  - Con su servidor (`preview_start` name `maqueta-principal-equipo`): `http://localhost:4831/dato-quincena.html?id=23&dir=B&estado=otra&rol=admin`.
  - Sin «Cambios (N)»: el usuario lo sacó.
  - Leer también `escaneo/3-pagina-y-mi-espacio.md`.
- [ ] **Step 2: Tests que fallan** (`tests/dato-quincena-frontend.test.js`, funciones puras con cadenas exactas, como los que hay).
  - **Franja**, en los tres estados (`detalle`, `detalle_equipo_coincide`, `detalle_equipo_otra`) × lector y admin:
    - texto y botones de la spec, sección 4;
    - «Validar la de Datito» y «Elegir otra» solo sin elegir y solo para admin;
    - «Ver la propuesta» lleva a `&vista=propuestas&propuesta=2`;
    - «Cambiar» solo para admin.
  - **Portada:** `.dq-sobre` dice «La principal de Datito», y el pie y el alt de la infografía son los del servidor.
  - **Índice de Propuestas:** las marcas «Datito» y «Equipo», con el texto oculto «Principal de …»; en `coincide`, las dos en la 1.
  - **La propuesta que se ve:**
    - la pastilla «Principal de Datito» en lugar de «Principal»;
    - «Principal del equipo» en la del equipo;
    - el botón «Elegir como principal del equipo» solo para admin y solo en las que no lo son;
    - «Es la principal del equipo» en la que lo es.
  - **Por defecto** se abre la del equipo: `detalle_equipo_otra` sin `&propuesta=` mira la 2, y «Ver las N propuestas» lleva a la 2.
  - **El cuerpo del diálogo:**
    - una opción por propuesta y « (la de Datito)» en la 1;
    - marcada la vigente;
    - sin ninguna marcada, «Guardar» deshabilitado.
  - **Tarjeta:** el `rotulo` arriba del título.
  - **Escape** de un título con `<img src=x onerror=alert(1)>` en la franja, el diálogo, la marca y la tarjeta (la Review Focus 5).
  - **DOM** (`paginaFalsa`):
    - «Validar la de Datito» manda `PUT` con `{ orden: 1 }` y deshabilita el botón hasta la respuesta;
    - después: toast con el `message`, vuelve a pedir el detalle y queda en la misma pestaña;
    - un 400 muestra el `error` y no cierra el diálogo.
  - **HTML estático:** el diálogo nuevo (ids únicos, `role="dialog"`, `aria-modal`, `aria-labelledby`).
  - **CSS:** `.dq-agenda-cols` con `grid-auto-flow: column` arriba de 820 px.
- [ ] **Step 3:** Implementar.
  - Las funciones puras reciben `{ admin }` (el `true` literal), como hoy. Para que lleguen a `htmlDePropuesta`, pasarlo por `htmlDeLaPropuestaElegida` y `mostrarPropuestaDq`.
  - El diálogo copia el ciclo de «Reenviar»: abrir, cerrar, Escape, velo y foco.
  - El PUT va con `API.pedirJson`, con `conBotonBloqueadoDq` y `avisarDq`.
  - Los textos de los botones son constantes de la página, con `NOMBRE_DEL_BOT`.
- [ ] **Step 4:** Subir la versión: `dato-quincena.js?v=20261236` en `public/dato-quincena.html` y `VERSION_DATO_QUINCENA` en `tests/paginas.test.js`.
- [ ] **Step 5:** Correr `node --test tests/dato-quincena-frontend.test.js tests/paginas.test.js`. Tiene que pasar.
- [ ] **Step 6:** Revisar con capturas, contra un arnés como el de la maqueta, con `datos/detalle-23.json` regenerado con el código de la rama.
  - Las tres situaciones × lector/admin, a 1280 y 390 px.
  - Sin scroll horizontal y sin errores en la consola.

### Task 5: La documentación (Sonnet; en paralelo)

**Files:**
- Create: `docs/temas/dato-quincena-contrato.md`, `docs/temas/dato-quincena-principal-equipo.md`
- Modify: `docs/temas/dato-quincena.md`, `docs/temas/dato-quincena-correo.md`, `docs/temas/despliegue.md`, `docs/temas/base-de-datos.md` (si lista las tablas o las migraciones), `CLAUDE.md` (la tabla «El mapa»)
- Test: `tests/documentos.test.js`

- [ ] **Step 1: Mover secciones a `dato-quincena-contrato.md`.**
  - Pasan, tal cual, «El POST de Datito», «La edición», «La clave, la huella y el guardado» y «El token y el interruptor».
  - Cada documento con su título, su sección «Archivos» y punteros al otro.
  - Corregir los «abajo» que ahora apuntan al otro documento (`dato-quincena.md:37` y `:205`) y los punteros de `dato-quincena-correo.md:4`, `:78` y `base-de-datos.md:268`.
- [ ] **Step 2: Escribir `dato-quincena-principal-equipo.md` con lo vigente de la spec.**
  - La tabla, el PUT y quién puede, lo que manda el servidor, la página, el mail (la frase fija y el recuadro, con el motivo de que sea fija) y lo que no cambia.
  - Las decisiones con motivo que alguien podría «arreglar»:
    - la frase no lee la elección;
    - la historia está en la base, pero no en la página;
    - la columna `principal` es de Datito;
    - el gris de la frase es más oscuro que el de la bajada.
  - Sin listas de tests ni «desde la entrega X».
- [ ] **Step 3: Actualizar lo vigente en los demás documentos.**
  - En `dato-quincena.md`, que «nadie escribe salvo el POST» pasa a decir que la elección del equipo vive en su tabla.
  - En `dato-quincena-correo.md`, la frase y el recuadro en el orden del mail.
  - En `despliegue.md`, la fila de la migración nueva en el orden de las migraciones y las vueltas atrás.
  - En `CLAUDE.md`, las filas del mapa: `dato-quincena-contrato.md` («El dato de la quincena: el POST de Datito, la edición, la clave y el token») y `dato-quincena-principal-equipo.md` («El dato de la quincena: la principal del equipo»).
- [ ] **Step 4:** Correr `node --test tests/documentos.test.js`. Tiene que pasar; los dos documentos del dato de la quincena quedan bajo 60 KB.
- [ ] `.claude/rules/dato-quincena.md` y `.claude/rules/migraciones.md` NO se tocan acá: son ruta protegida y los edita la sesión que coordina.

### Al final (la sesión que coordina)

- `.claude/rules/dato-quincena.md`: los globs de la migración nueva y los punteros a los documentos nuevos. `.claude/rules/migraciones.md`: su renglón.
- Una revisión Opus por área (servidor y base, mail, página), las correcciones, la suite completa y la revisión de la rama con Fable 5.2 en esfuerzo alto.
- La búsqueda de nombres reales en el diff, el merge en main, el push y el kit contra 235a840.
