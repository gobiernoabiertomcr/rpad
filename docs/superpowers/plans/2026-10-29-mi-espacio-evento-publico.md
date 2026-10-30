# Mi espacio: el evento Personal (Público) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sumar a la Agenda de Mi espacio el tipo de evento Personal (Público), que ven quienes elija quien lo carga (de cualquier
rol) como «Carla: Turno médico», sin emails a nadie más, y renombrar los otros dos a Personal (Privado) y Laboral.

**Architecture:** un Público se guarda como un evento personal (`compartido` 0, `para_todos` 0) con tres columnas nuevas y una tabla
propia para su audiencia, así ningún camino viejo de emails o de visibilidad lo toca. La visibilidad suma una rama para todos los
roles, y el ítem de un Público ajeno se arma sin el título, el detalle ni el recordatorio. La página dibuja lo que manda el servidor.

**Tech Stack:** Node 22 + Express 4 (ES Modules), MariaDB (mysql2/promise), vanilla JS en el navegador, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-29-mi-espacio-evento-publico-design.md` (leela entera antes de cada tarea). La maqueta:
`docs/superpowers/specs/2026-10-29-mi-espacio-evento-publico-mockups/` (manda la spec).

## Global Constraints

- Repo público: **ningún nombre real de persona** en código, tests, comentarios ni docs; en los tests, los de `crearUsuariosPrueba`
  («Test <clave>») o los inventados de la maqueta (Carla Inés Benítez, Julián Esteban Ferreyra, Tomás Quiroga, Lucía Sosa, Andrea Paula
  Molina). Antes de cada commit: `node "<scratchpad>/nombres-reales.mjs" <archivos del diff>` tiene que dar «coincidencias: 0».
- **La base `datospublicos_mcr_rpad` no se escribe.** La suite corre contra `rpad_rama_evento_para_todos` (el dump del 29/10 cargado):
  siempre con `bash "<scratchpad>/suite.sh" <etiqueta>` (el candado compartido `~/.rpad-suite.lock`, `DB_NAME` exportado). Un test de
  integración suelto: `bash "<scratchpad>/con-candado.sh" node --test tests/<archivo>.test.js`. Los puros: `node --test tests/<archivo>`.
  Un SQL en la base de la rama: `bash "<scratchpad>/aplicar-sql.sh" <archivo.sql>`. `<scratchpad>` es el scratchpad de la sesión
  que coordina (te lo da el controlador).
- Ningún email real (el SMTP local va a Mailpit) y nunca `/api/cron/*` de producción.
- Convenciones de CLAUDE.md: ES Modules, español, respuestas `{ success, data?, error?, campo?, message? }`, SQL parametrizado, lo puro
  primero y lo del DOM al final en `mi-espacio.js` (que al cargarse solo declara), todo texto del servidor con `Utils.escapeHtml`, en el
  código la agenda es `evento`/`mi_espacio_`, **nunca «agenda»** (salvo los ids `ag-*` y la pestaña), y ninguna clase `.ag-`/`.mq-`
  de la maqueta en la página (`paginas.test.js` las rechaza).
- Textos exactos (spec 2 y 4): los tipos **«Personal (Privado)»**, **«Personal (Público)»** y **«Laboral»**, con «Nadie más lo ve», «Lo ven
  quienes elijas, con un texto corto» y «Con la administración que elijas»; la lista **Trámite personal, Turno médico, Asunto familiar,
  Fuera de la oficina, Capacitación o curso** y «Otro»; largo del texto público **60** (`Array.from`).
- Mensajes nuevos o cambiados de `MENSAJES_EVENTO`: `personas: 'Elegí con quién lo compartís, o «Toda la administración».'`,
  `personasPublico: 'Elegí con quién lo compartís, o «Todos».'`, `tipo: 'Elegí el tipo de evento.'`, `textoPublico: 'Elegí qué ven
  los demás.'`, `textoPublicoLargo: 'Lo que ven los demás puede tener hasta 60 caracteres.'`, `sinRecordatorio: 'Este evento no tiene
  recordatorio para vos.'`. Solo del navegador: `'Escribí qué ven los demás.'` («Otro» vacío) y `'Ya no podés compartir eventos
  laborales. Elegí otro tipo para guardarlo.'`.
- Textos del Laboral: «Con todos» → **«Con toda la administración»**, «Es para todos.» → **«Es para toda la administración.»**, el botón
  «Todos» del Laboral → **«Toda la administración»**, la insignia «Compartido» → **«Laboral»**, la leyenda «Compartidos» → **«Laborales»**.
- Rosado: `--sg-rosado: #8A3B5C; --sg-rosado-fondo: #F7E3EC; --sg-rosado-borde: #B5577F;` (texto ≥ 4,5:1; bordes, puntos y anillos ≥ 3:1).
- `VERSION_MI_ESPACIO` pasa de `'20261217'` a `'20261218'`.
- Suite completa en verde antes y después de cada tarea (base: `suite-base.log`). Commits chicos, con
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` al final del mensaje.

## Review Focus

1. **El JSON que recibe otra persona nunca trae el título ni el detalle de un Público**, por ningún camino: `GET /mi-espacio/eventos`,
   el Resumen («Hoy y mañana») y la respuesta de `PUT …/mi-recordatorio` (el 400). Se prueba buscando el texto del título y del detalle
   en `JSON.stringify` de cada respuesta (Task 3).
2. **Un Laboral «para todos» con recordatorios apagados que pasa a Público** no manda nada a nadie y no deja filas en
   `mi_espacio_evento_personas` (un `sin_recordatorio` viejo no sobrevive) (Task 3).
3. **Una pestaña abierta con la página anterior** (un cuerpo sin `tipo`) sigue creando y corrigiendo Privados y Laborales como hoy
   (Task 2 en `validarEvento`, Task 3 por HTTP).
4. **El texto público raro**: solo espacios (es el error de «Elegí…»), 60 caracteres con emojis (vale) y 61 (no), y uno con `<b>` o
   comillas, que se ve escapado en la grilla, «Próximos», la vista previa y el detalle (Tasks 2, 4 y 5).
5. **Quien cargó un Público se desactiva**: desaparece también de «Hoy y mañana» y de la frase del mes de los demás, y su propio
   Privado o Laboral siguen como hoy (Task 3).

---

### Task 1: La estructura de la base

**Files:**
- Create: `database/updates/migracion-mi-espacio-evento-publico.sql`, `database/updates/rollback-mi-espacio-evento-publico.sql`
- Modify: `database/schema.sql` (la tabla `mi_espacio_eventos` y, después de `mi_espacio_evento_personas`, la nueva)
- Test: `tests/schema.test.js`

**Interfaces:**
- Produces: las columnas `mi_espacio_eventos.publico` tinyint(1) NOT NULL DEFAULT 0, `publico_todos` tinyint(1) NOT NULL DEFAULT 0 y
  `texto_publico` varchar(60) DEFAULT NULL, en ese orden después de `para_todos`; la tabla `mi_espacio_evento_vistas` (`evento_id`
  int(11) NOT NULL, `usuario_id` int(11) NOT NULL, PK (`evento_id`,`usuario_id`), KEY `fk_mi_espacio_evento_vistas_usuario`
  (`usuario_id`), FK `fk_mi_espacio_evento_vistas_evento` → `mi_espacio_eventos(id)` ON DELETE CASCADE y
  `fk_mi_espacio_evento_vistas_usuario` → `usuarios(id)` ON DELETE CASCADE, InnoDB, utf8mb4_unicode_ci). 43 tablas.

- [ ] **Step 1: Los tests de la estructura** en `tests/schema.test.js`: `TOTAL_DE_TABLAS` pasa a 43; la lista de tablas de la agenda
  (`TABLAS_MI_ESPACIO_AGENDA`, :74) suma `mi_espacio_evento_vistas` (y la de «no trae datos», :592); las columnas exactas de
  `mi_espacio_eventos` (:461-503) suman las tres nuevas con su tipo, nulo y valor por defecto; la tabla nueva con su PK, sus dos FK
  (ON DELETE CASCADE) y su índice. Un `describe('migracion-mi-espacio-evento-publico.sql')` nuevo, con la forma del de la agenda
  (:2019): las dos frases de la cabecera y `SET NAMES utf8mb4;` (como :2078-2099); «desde la estructura de main deja la de schema.sql y
  se puede repetir» (borra la tabla nueva y las tres columnas de una base con schema.sql, corre la migración **dos veces** y compara con
  `comoSchema()`); y la vuelta atrás (después de la migración, el rollback dos veces deja la estructura de main). En el test de la
  agenda de :2108, `crearBase({ conLoNuevo: false })` borra primero `mi_espacio_evento_vistas` y, después de correr
  `migracion-mi-espacio-agenda.sql` dos veces, corre también `migracion-mi-espacio-evento-publico.sql` antes de comparar.
- [ ] **Step 2:** `bash "<scratchpad>/con-candado.sh" node --test tests/schema.test.js` → FALLA (faltan la tabla, las columnas y los
  archivos).
- [ ] **Step 3: La migración y su vuelta atrás**, con la cabecera de las de la agenda (spec 8): la migración, `SET NAMES utf8mb4;`, tres
  `ALTER TABLE mi_espacio_eventos ADD COLUMN IF NOT EXISTS …` y un `CREATE TABLE IF NOT EXISTS mi_espacio_evento_vistas`; «ORDEN: correr
  ANTES de subir el código nuevo, después de migracion-mi-espacio-horas.sql»; el rollback, `DROP TABLE IF EXISTS
  mi_espacio_evento_vistas` y tres `DROP COLUMN IF EXISTS`, «ORDEN: primero volver a subir los archivos anteriores y hacer Restart;
  después correr esto», que dice qué se pierde (spec 8) y que el SQL privado de vuelta atrás va antes. `schema.sql` con lo mismo.
- [ ] **Step 4:** aplicar la migración a la base de la rama: `bash "<scratchpad>/aplicar-sql.sh"
  database/updates/migracion-mi-espacio-evento-publico.sql` (y de nuevo, para ver que se repite). Después,
  `bash "<scratchpad>/con-candado.sh" node --test tests/schema.test.js` → PASA.
- [ ] **Step 5:** `bash "<scratchpad>/suite.sh" t1` → 0 fallas. Chequeo de nombres y commit `feat(mi-espacio): la estructura del
  evento Personal (Público)`.

### Task 2: Las reglas (puras)

**Files:**
- Modify: `services/miEspacioEventosReglas.js`
- Test: `tests/mi-espacio-eventos-reglas.test.js`

**Interfaces:**
- Consumes: `nombreCorto(persona, lista)` de `services/miEspacioReglas.js` (la de los compañeros).
- Produces:
  - `TIPOS_DE_EVENTO = Object.freeze(['privado', 'publico', 'laboral'])`, `TEXTOS_PUBLICOS = Object.freeze(['Trámite personal', 'Turno
    médico', 'Asunto familiar', 'Fuera de la oficina', 'Capacitación o curso'])`, `LARGO_TEXTO_PUBLICO = 60` y los mensajes de Global
    Constraints en `MENSAJES_EVENTO`.
  - `validarEvento(entrada, hoy)` → `{ datos, error }`, con `datos` que suma `tipo`, `publico`, `publico_todos` y `texto_publico`. El
    cuerpo: `{ titulo, fecha, desde, hasta, detalle, recordatorio, tipo, para_todos, personas, texto_publico }`, donde `para_todos` y
    `personas` dicen «Todos»/las personas del tipo que corresponda. Sin `tipo` (cuerpo de antes): `compartido === true` → laboral; si
    no, privado. Laboral: `compartido` true, `para_todos` y `personas` como hoy, `publico` false, `publico_todos` false, `texto_publico`
    null. Público: `compartido` false, `para_todos` false, `publico` true, `publico_todos = fuente.para_todos === true`, `personas` (sin
    «Todos»; con «Todos», []), `texto_publico` recortado. Privado: todo lo de compartir en false/[]/null. Orden de los errores: título,
    fecha, desde, hasta, detalle, **tipo** (`campo: 'tipo'`), **texto público** (`campo: 'texto_publico'`: vacío o solo espacios →
    `textoPublico`; más de 60 → `textoPublicoLargo`), personas (un Público sin «Todos» y sin personas → `personasPublico`; el Laboral,
    `personas`), recordatorio.
  - `personasDelPedido(pedidas, { usuarioId, permitidas, tipo = 'laboral' })` → como hoy; con `tipo: 'publico'`, el mensaje de
    «ninguna» es `personasPublico`.
  - `textoDeQuienVeElPublico(evento, usuarios)` → «Lo ven todos como «X»» (con `publico_todos`), «Lo ve Julián como «X»», «Lo ven Julián
    y Tomás como «X»», «Lo ven 3 personas como «X»» (desde 3), con los nombres cortos de `evento.vistas` contra `usuarios`.
  - `itemDeEvento(evento, contexto)`: `contexto` suma `usuarios` (todos los activos, `{ id, nombre }`). El evento de los datos suma
    `publico`, `publico_todos`, `texto_publico` y `vistas` (`[{ id, nombre }]`). Tres ramas:
    - **Público de otra persona** (`publico` sí y `creado_por` ≠ `usuarioId`): devuelve **solo** `{ id, fecha, desde, hasta, es_mio:
      false, compartido: false, publico: true, creador, titulo, texto_publico }`, con `creador = nombreCorto(creador, usuarios)` y
      `titulo = \`${creador}: ${texto_publico}\``. No lee `evento.titulo` ni `evento.detalle`.
    - **Público tuyo**: lo de hoy de uno tuyo (con `personas` = los nombres de `vistas` y `personas_ids` = sus ids), más `publico:
      true`, `publico_todos`, `texto_publico` y `quien_texto = textoDeQuienVeElPublico(…)`.
    - **Privado o Laboral**: como hoy, más `publico: false`, con «Con toda la administración» y «Es para toda la administración.».
  - `eventosDeHoyYManana(items, hoy, ahora)` → suma `publico` a cada uno; un Público ajeno da `quien: ''` y `detalle` sin « · ».

- [ ] **Step 1: Los tests** (en los `describe` que ya existen, con `HOY = '2026-10-26'`):
  - `validarEvento`: cada tipo con sus `datos` exactos; el cuerpo de antes (`{ compartido: true, para_todos: true }` → laboral para
    todos; `{}` → privado); `tipo: 'otro'` → `{ campo: 'tipo', mensaje: 'Elegí el tipo de evento.' }`; el texto público `'   '`,
    `'x'.repeat(61)` y 60 emojis `'🙂'.repeat(60)` (vale) y 61 (no); un Público sin «Todos» ni personas → `personasPublico`; el orden
    (un cuerpo con detalle largo y texto vacío da el del detalle).
  - `personasDelPedido` con `tipo: 'publico'`.
  - `itemDeEvento`: `CLAVES_DEL_AJENO_PUBLICO = ['id','fecha','desde','hasta','es_mio','compartido','publico','creador','titulo',
    'texto_publico']` exactas y en ese orden para un Público de Carla visto por Tomás, con `titulo: 'Carla: Turno médico'`; que
    `JSON.stringify(item)` no contiene el título real ni el detalle; el nombre corto con dos Carlas en `usuarios` («Carla B.»); el
    Público propio con `quien_texto` de cada forma (todos, 1, 2 y 3 personas); un Laboral propio para todos «Con toda la administración»
    y uno ajeno «Lo creó Julián. Es para toda la administración.»; `CLAVES_DEL_MIO`/`CLAVES_DEL_AJENO` suman `publico` (y el propio
    Público, `publico_todos` y `texto_publico`).
  - `eventosDeHoyYManana`: el Público ajeno con `quien: ''` y `publico: true`; el propio con `quien: 'lo ven todos como «Turno médico»'`.
  - Cambiar los literales «Con todos»/«Es para todos» de :1152-1272 y :1673-1689 a los nuevos.
- [ ] **Step 2:** `node --test tests/mi-espacio-eventos-reglas.test.js` → FALLA.
- [ ] **Step 3:** implementar lo de Interfaces en `services/miEspacioEventosReglas.js` (las constantes nuevas se exportan, con su
  comentario; el texto de «Todos» del Público sale de `MENSAJES_EVENTO.personasPublico`).
- [ ] **Step 4:** `node --test tests/mi-espacio-eventos-reglas.test.js` → PASA.
- [ ] **Step 5:** `bash "<scratchpad>/suite.sh" t2` → 0 fallas (los tests de API o de página que miran «Con todos» y que esta tarea
  rompe se ajustan acá, con el texto nuevo). Nombres y commit `feat(mi-espacio): las reglas del evento Personal (Público)`.

### Task 3: Los datos y la API

**Files:**
- Modify: `services/miEspacioEventosDatos.js`, `services/miEspacioDatos.js` (`usuariosActivos`), `controllers/miEspacioEventosController.js`,
  `controllers/miEspacioController.js` (`eventosDelResumen` y `verResumen`), `routes/index.js`
- Test: `tests/mi-espacio-eventos-api.test.js`, `tests/mi-espacio-eventos-corrida.test.js`, `tests/permisos.test.js`

**Interfaces:**
- Consumes: Task 1 (la estructura) y Task 2 (`validarEvento`, `personasDelPedido`, `itemDeEvento`, `eventosDeHoyYManana`).
- Produces:
  - `usuariosActivos(conexion = pool)` en `services/miEspacioDatos.js` → `[{ id, nombre }]`, todos los roles, `activo = 1`, por id.
  - En `services/miEspacioEventosDatos.js`: `COLUMNAS_EVENTO` suma `e.publico, e.publico_todos, e.texto_publico` y `c.activo AS
    creador_activo`; una condición `VISTA_PUBLICA` = `(e.publico = 1 AND e.compartido = 0 AND c.activo = 1 AND (e.publico_todos = 1 OR
    EXISTS (SELECT 1 FROM mi_espacio_evento_vistas v WHERE v.evento_id = e.id AND v.usuario_id = ?)))`, sumada a la visibilidad de
    **todos** los roles (`visiblesPara` y los valores de `eventosVisibles` y `eventoVisible`); `vistasDe(eventoIds, conexion)` → Map id
    → `[{ id, nombre }]` (en lote, como `personasDe`); `leerEventos` suma `vistas` a cada Público; `eventosVisibles` y `eventoVisible`
    devuelven un Público ajeno **recortado** a `{ id, creado_por, creador, fecha, desde, hasta, compartido: 0, publico: 1, texto_publico }`
    (sin `titulo`, `detalle`, `recordatorio`, `personas` ni `vistas`); `audienciaDe` devuelve [] si `publico` es 1 (antes que nada) y
    los destinatarios de la corrida (`destinatariosDe`) solo a quien lo creó si `publico` es 1 (el SELECT de `eventosParaLaCorrida` suma
    `e.publico`); `personasParaElPublico(excluirId, conexion = pool)` → `[{ id, nombre, iniciales }]` de todos los activos sin quien
    pide, por nombre.
  - En el controlador: `datosDelGuardado` maneja los tres tipos (el Público valida sus personas contra `personasParaElPublico` más las
    `vistas` que ya tenía, con `personasDelPedido(…, { tipo: 'publico' })`); `valoresDelEvento` y el INSERT/UPDATE suman `publico,
    publico_todos, texto_publico`; `guardarVistas(conexion, eventoId, datos, antes)` (borra todas si no es Público; si lo es, deja las
    de `datos.personas`, por diferencia, como `guardarPersonas`); `listarEventos` lee `usuariosActivos()` en su `Promise.all`, se lo
    pasa al contexto (`usuarios`) y suma `mi_nombre_corto` (el de quien pide, `nombreCorto` contra `usuarios`) a la respuesta;
    `cambiarMiRecordatorio`: después del 404 y de `esTuyo`, si `publico` es 1 → 400 `{ campo: null, error: MENSAJES_EVENTO.sinRecordatorio
    }` sin escribir; `listarPersonasParaElPublico` (cualquier rol con sesión) en `GET /mi-espacio/personas/publico`.
  - `eventosDelResumen(usuario, hoy, { feriados, administracion, usuarios })`; `verResumen` lee `usuariosActivos()` aislado como la
    administración.

- [ ] **Step 1: Los tests de la API** (`tests/mi-espacio-eventos-api.test.js`, un `describe('Personal (Público)')` con los helpers del
  archivo y un `PUBLICO_TODOS = { tipo: 'publico', para_todos: true, texto_publico: 'Turno médico' }`):
  - el superadmin crea un Público para todos («Turno con el dentista», detalle «Llevar el carnet»): el lector, el colaborador y el
    adminA lo ven con exactamente `CLAVES_DEL_AJENO_PUBLICO` y `titulo: 'Test Superadmin: Turno médico'` (el nombre corto de
    `crearUsuariosPrueba`); `JSON.stringify` de cada respuesta no contiene «dentista» ni «carnet»; el que lo creó lo ve con su título y
    `quien_texto: 'Lo ven todos como «Turno médico»'`;
  - un Público del lector con personas `[colab]`: lo ve el colaborador, no lo ve adminA; un usuario creado después por SQL ve el «para
    todos» y no el de personas;
  - **ningún email**: crear, cambiar la hora y borrar un Público para todos deja Mailpit vacío para todas las casillas de la prueba y
    `mi_espacio_evento_envios` sin filas;
  - un Laboral para todos con un `sin_recordatorio` de adminB que pasa a Público: Mailpit vacío, ninguna fila en
    `mi_espacio_evento_personas`, y adminB lo ve como `«Test …: Turno médico»`; un Público que pasa a Laboral para todos manda la
    invitación a la administración (como hoy);
  - **cuerpo de antes**: `{ titulo, fecha, desde, compartido: true, para_todos: true }` sin `tipo` crea un Laboral para todos con sus
    invitaciones; `{ titulo, fecha, desde }`, un Privado;
  - quien lo creó, desactivado por SQL: el lector ya no lo ve en `GET /mi-espacio/eventos` ni en `hoy_y_manana.eventos` del Resumen, y
    la `frase_del_mes` no lo cuenta;
  - `PUT …/mi-recordatorio` del lector sobre el Público: 400, `campo` null, «Este evento no tiene recordatorio para vos.», la respuesta
    sin el título, y ninguna fila nueva en `mi_espacio_evento_personas`;
  - los 400: `tipo` inválido en `tipo`; texto vacío y de 61 en `texto_publico`; un Público sin personas en `personas` con
    `personasPublico`; una persona que no está en la lista; un Laboral del lector en `compartido` (`sinPermiso`, como hoy);
  - `GET /mi-espacio/personas/publico`: al lector y al colaborador, 200 con todos los activos menos quien pide, solo `{ id, nombre,
    iniciales }`; `GET /mi-espacio/personas` sigue dando 403 al lector;
  - el Resumen: «Hoy y mañana» del lector trae el Público de mañana con `titulo: 'Test Superadmin: Turno médico'`, `quien: ''` y nada
    del título real.
  - Los literales «Es para todos.»/«Con todos» de :285 y :292 pasan a los nuevos; `CLAVES_DEL_MIO`/`CLAVES_DEL_AJENO` como en Task 2.
- [ ] **Step 2: La corrida** (`tests/mi-espacio-eventos-corrida.test.js`, en «la corrida de los recordatorios»): un Público para todos
  con «2 horas antes» y otro de personas, a las 10:00 de un día hábil, corriendo a las 08:00: un solo envío por evento, el de quien lo
  creó; y la defensa: un evento puesto por SQL con `publico` 1, `compartido` 1 y `para_todos` 1 (datos mal) no le manda a nadie más que
  a quien lo creó, y `audienciaDe` da [].
- [ ] **Step 3: Permisos** (`tests/permisos.test.js`): `['GET', '/mi-espacio/personas/publico']` en `RUTAS_MI_ESPACIO` (401 sin sesión)
  y 200 para el lector y el colaborador.
- [ ] **Step 4:** `bash "<scratchpad>/con-candado.sh" node --test tests/mi-espacio-eventos-api.test.js tests/mi-espacio-eventos-corrida.test.js tests/permisos.test.js`
  → FALLA.
- [ ] **Step 5:** implementar lo de Interfaces.
- [ ] **Step 6:** el mismo comando → PASA.
- [ ] **Step 7:** `bash "<scratchpad>/suite.sh" t3` → 0 fallas. Nombres y commit `feat(mi-espacio): la API del evento Personal
  (Público)`.

### Task 4: La página: el formulario

**Files:**
- Modify: `public/mi-espacio.html` (`#modal-evento` y su `<style>`), `public/js/mi-espacio.js`
- Test: `tests/mi-espacio-frontend.test.js`, `tests/paginas.test.js`

**Interfaces:**
- Consumes: de Task 3, `GET /mi-espacio/personas/publico` y `mi_nombre_corto` en `GET /mi-espacio/eventos`; los ítems con `publico`,
  `publico_todos`, `texto_publico` y `personas_ids`; el cuerpo de `validarEvento` (Task 2).
- Produces (puro, en `mi-espacio.js`):
  - Copias atadas por paridad: `MENSAJES_EVENTO` (entero), `TIPOS_DE_EVENTO`, `TEXTOS_PUBLICOS`, `LARGO_TEXTO_PUBLICO`. Solo del
    navegador: `MENSAJE_OTRO_VACIO = 'Escribí qué ven los demás.'`, `MENSAJE_LABORAL_SIN_PERMISO = 'Ya no podés compartir eventos
    laborales. Elegí otro tipo para guardarlo.'`, `AYUDA_DE_LAS_PERSONAS_DEL_PUBLICO = 'No les llega ningún email: lo ven en su agenda y
    en el Resumen.'`, `AYUDA_DEL_RECORDATORIO_PUBLICO = 'Te llega solo a vos.'`.
  - `valoresDelEvento(item, { fecha })` suma `tipo` ('laboral' si `compartido`, 'publico' si `publico`, si no 'privado'),
    `texto_publico` y `otro` (true si hay texto y no es de `TEXTOS_PUBLICOS`); en un Público, `para_todos = publico_todos` y
    `personas = personas_ids`.
  - `erroresDelEvento(valores, hoy, { puedeCompartir = false } = {})`: suma `tipo` (Laboral sin `puedeCompartir` →
    `MENSAJE_LABORAL_SIN_PERMISO`), `texto_publico` (`otro` con texto vacío → `MENSAJE_OTRO_VACIO`; sin texto →
    `MENSAJES_EVENTO.textoPublico`; más de 60 → `textoPublicoLargo`) y las personas del tipo (`personasPublico` o `personas`).
  - `cuerpoDelEvento(valores, { puedeCompartir })` → siempre `tipo`; Público: `para_todos`, `personas` (sin «Todos») y `texto_publico`;
    Laboral (solo con `puedeCompartir`): `compartido: true`, `para_todos` y `personas`.
  - `htmlDeTiposDeEvento(valores, { puedeCompartir })` (los tres `.me-opcion` con `data-tipo` y `aria-pressed`; sin `puedeCompartir`,
    dos, salvo que `valores.tipo` sea 'laboral': entonces los tres, con el Laboral `aria-pressed="true"` y `disabled`);
    `htmlDeTextosPublicos(valores)` (una `.sg-chip` por cada uno de `TEXTOS_PUBLICOS` y «Otro», con `data-texto` y `aria-pressed`);
    `htmlDeLaVistaPrevia(valores, { nombre })` → el día corto («Jue 5») y `<span class="me-ev publico-otro">` con el ojo,
    `<b>10:00</b>` y `«${nombre}: ${texto}»` escapados (sin texto, «${nombre}: …»); `htmlDePersonasDelEvento` dice «Toda la
    administración» en un Laboral y «Todos» en un Público.
- Produces (DOM): `#ev-grupo-tipo` reemplaza a `#ev-grupo-quien` (ids `ev-tipo-rotulo`, `ev-tipos`, `ev-tipo-ayuda`), y aparecen
  `#ev-publico` (con `#ev-grupo-texto`, `#ev-textos`, `#ev-texto-error`, `#ev-otro-grupo`, `#ev-otro`, `#ev-otro-cuenta` «0 de 60
  caracteres», `#ev-otro-error`, `#ev-vista-previa`, `#ev-vista-previa-dia`, `#ev-vista-previa-evento`); `#ev-personas-ayuda` queda
  vacía en el HTML y la llena `pintarQuienLoVe` (Laboral: el texto de hoy; Público: `AYUDA_DE_LAS_PERSONAS_DEL_PUBLICO`), igual que
  `#ev-recordatorio-ayuda` (Laboral: la de hoy; Público: `AYUDA_DEL_RECORDATORIO_PUBLICO`). El grupo del tipo se ve para **todos**
  los roles. Las personas de un Público se piden una vez a `/mi-espacio/personas/publico` (`pagina.personasPublico`, que se vuelve a
  pedir si falló), las del Laboral como hoy. La vista previa se vuelve a dibujar con cada cambio de la hora, el texto o «Otro», y el
  contador de «Otro» con cada letra (fuera de toda región viva). Accesibilidad: `#ev-grupo-texto` con `aria-describedby="ev-texto-error"`,
  `#ev-otro` con `aria-describedby="ev-otro-cuenta ev-otro-error"`, `#ev-grupo-tipo` con `aria-describedby="ev-tipo-ayuda ev-tipo-error"`
  (y su `#ev-tipo-error`); en `conSusControles` (`evento:`, :3360-3366), `tipo: 'ev-tipos'` y `texto_publico` a `ev-otro` con «Otro»
  elegido o a `ev-textos` si no, así un error del servidor va a su control y lleva el foco. Estilos `.me-opciones.tres`, `.me-textos`,
  `.me-otro`, `.me-cuenta`, `.me-vista-previa*` (los de la maqueta, con `me-` en lugar de `ag-`, sin `--lineas`: con `data-lineas`), y en
  640 px una columna.

- [ ] **Step 1: Los tests puros** (`tests/mi-espacio-frontend.test.js`): las paridades (`MENSAJES_EVENTO`, `TIPOS_DE_EVENTO`,
  `TEXTOS_PUBLICOS`, `LARGO_TEXTO_PUBLICO`); `valoresDelEvento` de los tres tipos y de un Público con un texto que no es de la lista
  (`otro: true`); `erroresDelEvento` en los mismos bordes que `validarEvento` (Task 2: el primer error de cada uno es el del servidor,
  con el mismo campo), más «Otro» vacío y el Laboral sin permiso; `cuerpoDelEvento` de cada tipo (y que el cuerpo de un Público nunca
  trae `compartido`); `htmlDeTiposDeEvento` (tres, dos y el Laboral deshabilitado); `htmlDeTextosPublicos`; `htmlDeLaVistaPrevia` con
  un texto `'<b>"x"</b>'` escapado; el «Todos» de cada tipo.
- [ ] **Step 2: Los tests con el DOM falso** (`montarPagina`): el lector abre «Nuevo evento» y ve el tipo con dos opciones; elige
  Público, «Turno médico» y «Todos», y «Guardar» manda un solo `POST` con `{ tipo: 'publico', para_todos: true, texto_publico: 'Turno
  médico' }` y pide `/mi-espacio/personas/publico` (no `/mi-espacio/personas`); la vista previa cambia con la hora; «Otro» con 61
  caracteres muestra el error debajo, con `aria-invalid`; administración: Laboral pide `/mi-espacio/personas` y su botón dice «Toda la
  administración»; un lector que abre un Laboral suyo ve la opción deshabilitada y «Guardar» no manda nada hasta elegir otro tipo; los
  tests que miraban `ev-solo`, `ev-compartido` y `ev-grupo-quien` (:5803-6091) pasan a `data-tipo` y `ev-grupo-tipo`.
- [ ] **Step 3: `tests/paginas.test.js`**: `VERSION_MI_ESPACIO = '20261218'`; los ids nuevos de `#modal-evento` (:950-953) y su
  marcado (:1026-1044); los tokens `--sg-rosado*` exigidos; ninguna clase `.ag-`.
- [ ] **Step 4:** `node --test tests/mi-espacio-frontend.test.js tests/paginas.test.js` → FALLA.
- [ ] **Step 5:** implementar (HTML, estilos y `mi-espacio.js`; `?v=20261218` en el `<script>`; la cabecera de las copias, :56-67, suma
  las nuevas).
- [ ] **Step 6:** el mismo comando → PASA.
- [ ] **Step 7:** `bash "<scratchpad>/suite.sh" t4` → 0 fallas. Nombres y commit `feat(mi-espacio): el formulario con los tres tipos
  de evento`.

### Task 5: La página: cómo se ve

**Files:**
- Modify: `public/mi-espacio.html` (la leyenda, `#modal-evento-ajeno` y el `<style>`), `public/js/mi-espacio.js`
- Test: `tests/mi-espacio-frontend.test.js`, `tests/paginas.test.js`

**Interfaces:**
- Consumes: los ítems de Task 3 (`publico`, `titulo` «Carla: …», `quien_texto` del propio) y `ICONOS_DEL_MES`.
- Produces:
  - `claseDelEvento(evento)` → `'compartido'` (un Laboral, tuyo o ajeno), `'publico-otro'` (un Público ajeno) o `'propio'` (lo tuyo
    que no es Laboral). `ICONOS_DEL_MES` suma `ojo` (Lucide `eye`, el de la maqueta) y `'publico-otro'` (el mismo ojo); `iconoDe(clase,
    icono)` usa `icono` si viene. `cosasPorDia` suma `icono: 'ojo'` a un Público tuyo. Con eso, la grilla, el día elegido, «Próximos»
    (`htmlDeProximo`: un Público tuyo con una línea `.me-lo-ven` con el ojo y su `quien_texto`, sin insignia; uno ajeno sin insignia) y
    los puntos del teléfono (`<i class="publico-otro">`, un anillo).
  - `htmlDelEventoAjeno(item)` → con `publico`: `quien` = la insignia `<span class="me-insignia rosado">` con el ojo y «Personal
    (Público)» y «Es un evento personal de ${creador}: se ve solo lo que eligió mostrar.», y `opciones: ''`; `abrirEventoAjeno` oculta
    `#mea-grupo-recordatorio` (el `form-group` de «Mi recordatorio», que suma ese id) en un Público. Un Laboral: la insignia «Laboral».
  - La leyenda: «Solo vos», «Tuyos, a la vista» (propio con el ojo), «Personales de otros» (`publico-otro` con el ojo), «Laborales»
    (`#ag-leyenda-laborales`, oculta sin `puede_compartir`, como `#ag-leyenda-ausentes`), «Tus licencias y francos», «Feriados» y
    «Compañeros que no están».
  - Estilos: los tokens rosados en el bloque de `--sg-*`; `.me-ev.publico-otro, .me-leyenda .publico-otro` con la forma de
    `.me-ev.compartido` (fondo, borde y texto rosados); `.me-insignia.rosado`; `.me-lo-ven`; los puntos del teléfono
    (`.me-puntos .publico-otro`: fondo blanco y `box-shadow: inset 0 0 0 2px var(--sg-rosado-borde)`); alto contraste
    (`.me-puntos .publico-otro { background: Canvas; outline: 2px solid CanvasText; outline-offset: -2px; }` y la muestra de la leyenda,
    con la especificidad del bloque de `forced-colors`).

- [ ] **Step 1: Los tests puros**: `claseDelEvento` de los cuatro casos; `ICONOS_DEL_MES` con sus claves nuevas (:1593); la grilla
  (`htmlDelMes`) con un Público ajeno: `<button class="me-ev publico-otro"` con el ojo y «Carla: Turno médico» escapado, y su punto
  `<i class="publico-otro">`; un Público tuyo: clase `propio` con el ojo; «Próximos» y el día elegido con la línea «Lo ven todos como
  «Turno médico»»; un texto público `'<b>"x"</b>'` sale escapado en la grilla, «Próximos», el día elegido y el detalle; `htmlDelEventoAjeno` de un Público (sin opciones) y de un Laboral («Laboral»); «Hoy y mañana» con un Público ajeno
  (sin `<small>`); los textos «Con todos»/«Es para todos» de :2000, :2047 y :5706-5709, a los nuevos.
- [ ] **Step 2: Con el DOM falso**: la leyenda del lector (`['Solo vos', 'Tuyos, a la vista', 'Personales de otros', 'Tus licencias y
  francos', 'Feriados']` a la vista) y la de administración (con «Laborales» y «Compañeros que no están»), :5279-5291 y :8886-8892;
  abrir un Público ajeno muestra el detalle sin «Mi recordatorio» y no manda ningún `PUT`.
- [ ] **Step 3: Los contrastes** (con los helpers de :8804-8884): el texto rosado sobre su fondo y sobre blanco ≥ 4,5:1; el borde y el
  anillo del teléfono contra la celda (las de hoy, la de un día pasado y la de otro mes) ≥ 3:1. Y en `tests/paginas.test.js`, la leyenda
  (:747-754), los selectores por clase (:795-797, con `publico-otro`) y el alto contraste (:844-883).
- [ ] **Step 4:** `node --test tests/mi-espacio-frontend.test.js tests/paginas.test.js` → FALLA.
- [ ] **Step 5:** implementar.
- [ ] **Step 6:** el mismo comando → PASA.
- [ ] **Step 7:** `bash "<scratchpad>/suite.sh" t5` → 0 fallas. Nombres y commit `feat(mi-espacio): cómo se ve el evento Personal
  (Público)`.

### Task 6: CLAUDE.md, el README y los SQL del evento real

**Files:**
- Modify: `CLAUDE.md` (las secciones «Mi espacio: la agenda», la convención de `mi-espacio.js`, «Base de datos» —43 tablas, la tabla y
  las columnas nuevas, la migración y su vuelta atrás—, «Seguridad» —la lista de todos los usuarios para un Público y el ítem
  recortado— y «Despliegue»), y el README si nombra las migraciones de Mi espacio.
- Create (no versionados, en `database/privado/`, que está en `.gitignore`): `mi-espacio-evento-publico-datos.sql` y
  `rollback-mi-espacio-evento-publico-datos.sql`.

**Interfaces:**
- Consumes: la estructura de Task 1.

- [ ] **Step 1: CLAUDE.md**, con el tono y la densidad de las secciones vecinas: los tres tipos y sus reglas (spec 3 y 6), los textos,
  la ruta nueva, la convención de la página (las funciones y las copias nuevas de Task 4 y 5), `VERSION_MI_ESPACIO` en `'20261218'` y el
  despliegue (spec 8: la migración antes, los archivos y Restart, el SQL privado después; antes, el kit `RPAD-deploy-feriados-en-metricas`).
  Nada del evento real (ni su título ni su fecha).
- [ ] **Step 2: El SQL privado** del evento real: los datos (id, título, fecha, hora y quién lo creó) salen del dump de
  producción del Escritorio del usuario (29/10/2026, 20:28; te lo da el controlador); `SET NAMES utf8mb4;`, un `UPDATE mi_espacio_eventos SET
  compartido = 0, para_todos = 0, publico = 1, publico_todos = 1, texto_publico = 'Turno médico' WHERE id = … AND creado_por = … AND
  titulo = … AND fecha = … AND desde = … AND activo = 1 AND compartido = 1 AND para_todos = 1;`, un `DELETE FROM
  mi_espacio_evento_personas WHERE evento_id = …;` (hoy no tiene filas) y la consulta de verificación (debe dar 1 fila con `publico` 1);
  la cabecera dice qué hace, que va después de la estructura y del código, y que si el evento cambió no hace nada y la verificación da
  0. La vuelta atrás: el `UPDATE` inverso (`compartido = 1, para_todos = 1, publico = 0, publico_todos = 0, texto_publico = NULL`), que
  va antes del rollback de la estructura.
- [ ] **Step 3: Probarlos** en una base aparte, `rpad_rama_evento_para_todos_privado` (creada con el dump y la migración de Task 1, con
  `aplicar-sql.sh` sobre esa base): el SQL convierte la fila (verificación: 1), correrlo otra vez no hace nada, la vuelta atrás la deja
  como en el dump, y con el evento cambiado antes (otro título) no convierte nada. Borrar esa base al terminar.
- [ ] **Step 4:** `bash "<scratchpad>/suite.sh" t6` → 0 fallas. Nombres sobre el diff y commit `docs(mi-espacio): CLAUDE.md del evento
  Personal (Público)` (los SQL privados no van en el commit: `git status` no los muestra).
