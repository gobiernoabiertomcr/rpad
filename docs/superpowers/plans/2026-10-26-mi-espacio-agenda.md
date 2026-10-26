# Mi espacio, la agenda: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La pestaña Agenda de Mi espacio: eventos personales y compartidos, el mes y los próximos con lo propio, los feriados y los compañeros, los emails al guardar y los recordatorios de una Tarea Cron nueva cada media hora, con su línea en Correos → Estado.

**Architecture:**
- **Las reglas:** `services/miEspacioEventosReglas.js`, puro: la validación, `momentoDelAviso` con los feriados, quién recibe qué y los textos. El navegador no recalcula días hábiles.
- **La base:** `services/miEspacioEventosDatos.js` (lecturas en lote, con la visibilidad) y `controllers/miEspacioEventosController.js`.
- **Los emails:** cuatro plantillas en `services/emailTemplates.js`; los del guardado salen después de responder (`services/miEspacioEventosEmails.js`) y los recordatorios, de la corrida (`services/miEspacioEventosCorrida.js`), con `conBloqueo` exportado y su propio candado.
- **La página:** la pestaña y dos modales en `public/mi-espacio.html` + `public/js/mi-espacio.js`; la línea del Estado en `public/js/correos.js`.

**Tech Stack:** Node 22, Express 4, mysql2/promise sobre MariaDB y JS sin frameworks. Tests con `node:test`: los de API sobre Docker con base propia; la corrida, en el proceso con `mock.timers`; la página, en un `vm`.

**Spec:** `docs/superpowers/specs/2026-10-26-mi-espacio-agenda-design.md`, aprobada el 26/10/2026, con su segunda revisión. Consume las entregas 1 (`docs/superpowers/plans/2026-10-26-feriados.md`) y 2 (`docs/superpowers/plans/2026-10-26-mi-espacio-licencias-y-horas.md`). La referencia visual son las maquetas (`1-mi-espacio.html#agenda`, `2-formularios.html#evento` y `#evento-ajeno`); donde no coincidan, manda la spec.

## Global Constraints

- **Antes de la Task 1, la entrega 2 tiene que estar en main** (`git log main --oneline` muestra el merge de `feat/mi-espacio`). Si no, parar y avisar a la sesión coordinadora.
- **No romper nada:** `npm test` completo antes y después de cada tarea, con el candado `C:\Users\Mariano\.rpad-suite.lock`; nunca dos suites a la vez.
- **Todos los subagentes van con Opus.**
- **Ningún email real** (en local, Mailpit). **Nunca `/api/cron/*` desde los tests:** la corrida se prueba llamando a la función; la ruta, solo en `tests/permisos.test.js`.
- **La base `datospublicos_mcr_rpad` no se escribe hasta el merge;** para probar, `rpad_rama_agenda`.
- **Repositorio público:** sin nombres reales («Test <clave>» o «Persona de Prueba»).
- **Migraciones aditivas, con su rollback, antes del código.**
- **Exportar `conBloqueo` no cambia las Notas Digitales:** `tests/notas-motor.test.js` pasa sin tocar sus aserciones.
- **CLAUDE.md:** ES Modules; `{ success, data?, error?, campo?, message? }`, con 400 y su `campo`; SQL parametrizado; transacciones; español, sin emojis.
- **La base** (sin `dateStrings`): `DATE_FORMAT(…, '%Y-%m-%d')`, `TIME_FORMAT(…, '%H:%i')`, `DATE_FORMAT(para, '%Y-%m-%d %H:%i')` y `Number()`. Los momentos se escriben con `ahoraArgentina()`, nunca `NOW()`, y se comparan como texto `'AAAA-MM-DD HH:MM'` (`ahora.slice(0, 16)` contra el aviso y el inicio, `${fecha} ${desde}`).
- **No cambian:** `api.js`, `main.js`, `notasDigitalesCalendario.js`, `estadoNotas`, las corridas de las 8:15 y las 14:00 y la Agenda de pedidos. En el código, `mi_espacio_` o `evento`, nunca `agenda` a secas (salvo los ids `ag-*`).
- **Versiones:** `VERSION_MI_ESPACIO` `'20261209'` → `'20261210'`; `VERSION_CORREOS` `'20261204'` → `'20261210'`.
- **Valores** (congelados, en las reglas): `RECORDATORIOS = ['1h', '2h', 'dia_anterior', 'ninguno']` (el orden del formulario) y `RECORDATORIO_POR_DEFECTO = '2h'`; `TEXTO_RECORDATORIO` «1 hora antes», «2 horas antes», «El día hábil anterior», «Sin aviso»; `AVISO_CORTO` «Aviso 1 h antes», «Aviso 2 h antes», «Aviso el día hábil anterior», «Sin aviso»; `LARGO_TITULO_EVENTO = 150` y `LARGO_DETALLE_EVENTO = 1000` (con `Array.from`); `FECHA_MINIMA_EVENTO = '2025-01-01'`; `fechaMaximaEvento(hoy)`, el mismo día dos años después (un 29/02 da el 28/02); `ROLES_QUE_COMPARTEN = ['superadmin', 'admin', 'editor']`; `DIAS_DE_PROXIMOS = 30`; `VENTANA_DE_LA_CORRIDA = 15` días; `MINUTOS_SIN_CORRER = 60`; `BLOQUEO_EVENTOS = 'rpad_mi_espacio_eventos'`. El rango de `GET /eventos` usa el tope de 93 días, el `campo: 'fechas'` y el mensaje de `GET /mi-espacio/ausentes`.
- **Textos fijos** («martes 27/10/2026» es `diaDeLaSemana` + `formatoCorto`; «viernes 30/10», `diaLargo`):
  - **`MENSAJES_EVENTO`:** `titulo` «Escribí qué es el evento.»; `tituloLargo` «El título puede tener hasta 150 caracteres.»; `desde` «Elegí a qué hora empieza.»; `hasta` «La hora de fin tiene que ser después de la de inicio, el mismo día.»; `detalle` «El detalle puede tener hasta 1000 caracteres.»; `personas` «Elegí con quién lo compartís, o «Todos».»; `personasInvalidas` «Solo podés compartirlo con las personas de la lista.»; `recordatorio` «Elegí cuándo te llega el recordatorio.»; `sinPermiso` «No tenés permiso para compartir eventos.»; `noEncontrado` «Evento no encontrado»; `miRecordatorio` «Elegí si querés el recordatorio.»; `esTuyo` «El recordatorio de tu evento se cambia en el evento.»; `textoRangoEvento(hasta)` «La fecha tiene que ser del 01/01/2025 al 26/10/2028.»
  - **Cuándo:** `cuandoDelEvento` «martes 27/10/2026 de 10:00 a 11:00» (sin «A», «… a las 10:00»); `cuandoCortoDelEvento` «martes 27/10/2026 a las 10:00»; `cuandoEsElEvento(evento, hoy)` «Hoy a las 10:00», «Mañana a las 10:00» o «El lunes 02/11 a las 10:00»; `cuandoFue(momento, ahora)` «hoy a las 10:30», «ayer a las 23:30» o «el 23/10/2026 a las 10:30».
  - **`textoDelAviso`:** «2 horas antes (hoy a las 08:00)», «… (mañana a las 08:00)», «El día hábil anterior (el viernes 30/10 a las 10:00)»; pasada la hora, «2 horas antes (ya pasó esa hora: sale con el próximo envío, si es antes del evento)»; empezado, «2 horas antes (el evento ya empezó)»; `ninguno`, «Sin aviso».
  - **Quién:** `quien_texto` «Solo vos», «Con todos», «Con 1 persona», «Con 4 personas» o «De <creador>»; `quien_largo` «Lo creó <creador>. Están: vos, Sofía Paz y Carla Benítez.» o «Lo creó <creador>. Es para todos.»; en «Hoy y mañana», «Hoy · solo vos», «Mañana · con 4 personas», «Hoy · de <creador>».
  - **Lo demás:** una licencia, `NOMBRES_TIPO[tipo]` y, con horas, «, 2 h» («Franquicia, 2 h»); un feriado, «Feriado: <nombre>»; un compañero, «<nombre> no está»; varios días, «Hasta el viernes 30/10».
  - **La página:** la leyenda, las ayudas y los rótulos de la maqueta (sin «15 minutos antes»); los grupos «Hoy, lunes 26/10», «Mañana, martes 27/10», «Esta semana» y «Más adelante»; «No hay nada en los próximos 30 días.» y «No tenés eventos hoy ni mañana.»; «¿Borrar «Reunión de equipo» del martes 27/10/2026?», más « A las 4 personas les llega un email que dice que se canceló.» («A la persona…», «A toda la administración…»).
  - **Los emails,** con el botón «Ver en Mi espacio» → `${RPAD_URL}/mi-espacio.html#agenda` y el detalle en su párrafo (escapado, saltos como `<br>`):
    - invitación: «RPAD: te sumaron a un evento»; título «Te sumaron a un evento»; «<strong>Laura Gómez</strong> te sumó a un evento: <strong>Reunión de equipo</strong>, martes 27/10/2026 de 10:00 a 11:00.»; nota «Solo quien lo creó lo puede cambiar. Si cambia o se cancela, te llega otro email.»;
    - cambio: «RPAD: cambió un evento»; título «Cambió un evento»; «Cambió un evento: <strong>Reunión de equipo</strong>, miércoles 28/10/2026 de 10:00 a 11:00.», «Antes: <s>Reunión de equipo, martes 27/10/2026 de 10:00 a 11:00</s>» y «Lo cambió Laura Gómez.»;
    - cancelación: «RPAD: se canceló un evento»; título «Se canceló un evento»; «Se canceló: <strong>Reunión de equipo</strong>, martes 27/10/2026 a las 10:00.» y «Lo canceló Laura Gómez.»;
    - recordatorio: «RPAD: Reunión de equipo, hoy a las 10:00»; título «Recordatorio»; «Hoy a las 10:00: <strong>Reunión de equipo</strong>»; nota «Te llega porque el evento tiene un recordatorio por email. Lo podés apagar desde el evento, en la Agenda de Mi espacio.»
  - **Correos → Estado:** la línea «Recordatorios de la agenda: última corrida hoy a las 10:30.», «… corrida en curso, desde hoy a las 10:30.» o «… sin registro todavía.»; el resultado «Día no hábil: no se mandan recordatorios.» o «Recordatorios enviados: 2. Fallidos: 1.», más « Errores: <e1>; <e2>», cortado a 1000; las alertas (`error`, salvo la última): `eventos-con-errores` «La última corrida de los recordatorios de la agenda (hoy a las 10:30) terminó con errores: <resultado>»; `eventos-interrumpida` «La corrida de los recordatorios de la agenda que empezó hoy a las 10:30 no terminó.»; `eventos-sin-corrida` «Los recordatorios de la agenda no corren desde hoy a las 08:30: revisá la Tarea Cron de /api/cron/eventos.» (sin ninguna, «No hay registro de ninguna corrida de los recordatorios de la agenda: revisá la Tarea Cron de /api/cron/eventos.»); `eventos-sin-estado` (`advertencia`) «No se pudo leer la última corrida de los recordatorios de la agenda.»

## Review Focus

1. **El recordatorio apagado por una invitada sobrevive a un cambio del evento** guardado con las mismas personas. Test en la Task 4.
2. **HTML en un título, un detalle o un nombre** (`<img src=x onerror=alert(1)>`): texto en la grilla (también en su `title`), en Próximos, en «Hoy y mañana», en los modales y en los cuatro emails. Tests en las Tasks 6, 9 y 10.
3. **Un feriado cargado después de crear el evento** mueve el aviso: se calcula en cada pedido y en cada corrida, nunca se guarda. Tests en las Tasks 4 y 7.
4. **Una invitada que dejó de ser administración o se desactivó:** quien lo creó guarda sin tocarla y no recibe un 400; la desactivada no recibe emails; nadie la puede sumar de nuevo. Tests en las Tasks 4, 6 y 7.
5. **El doble clic en «Guardar»:** un solo `POST` (dos eventos compartidos mandarían dos invitaciones). Test en la Task 10.

---

### Task 1: La rama, la base y las cuatro tablas

**Files:**
- Create: `database/updates/migracion-mi-espacio-agenda.sql`, `database/updates/rollback-mi-espacio-agenda.sql`
- Modify: `database/schema.sql` (al final), `tests/schema.test.js`

**Interfaces:**
- Produces (InnoDB, utf8mb4_unicode_ci):
  - **`mi_espacio_eventos`:** `id` int AI PK; `creado_por` int NULL (FK `fk_mi_espacio_eventos_creado_por`, ON DELETE SET NULL); `titulo` varchar(150) NOT NULL; `detalle` text NULL; `fecha` date NOT NULL; `desde` time NOT NULL; `hasta` time NULL; `compartido` y `para_todos` tinyint(1) NOT NULL DEFAULT 0; `recordatorio` enum('ninguno','1h','2h','dia_anterior') NOT NULL DEFAULT '2h'; `activo` tinyint(1) NOT NULL DEFAULT 1; `created_at`, `updated_at`; índice `idx_mi_espacio_eventos_fecha (fecha, activo)`.
  - **`mi_espacio_evento_personas`:** `evento_id`, `usuario_id` (PK compuesta; FK `fk_mi_espacio_evento_personas_evento` y `…_usuario`, CASCADE) y `sin_recordatorio` tinyint(1) NOT NULL DEFAULT 0.
  - **`mi_espacio_evento_envios`:** `id` AI PK; `evento_id` y `usuario_id` (FK `fk_mi_espacio_evento_envios_evento` y `…_usuario`, CASCADE); `tipo` enum('recordatorio','invitacion','cambio','cancelacion') NOT NULL; `para` datetime NOT NULL; `enviado_at` datetime NULL (NULL mientras está reservado); `success` tinyint(1) NOT NULL DEFAULT 0; `recordatorio_unico` tinyint(1) GENERATED ALWAYS AS (case when `tipo` = 'recordatorio' then 1 end) STORED; UNIQUE `uq_mi_espacio_evento_envios_recordatorio` (`evento_id`, `usuario_id`, `para`, `recordatorio_unico`).
  - **`mi_espacio_eventos_corridas`:** `id` tinyint(4) PK (siempre 1; la escribe la corrida con `ON DUPLICATE KEY UPDATE`); `inicio_at`, `fin_at` datetime NULL; `resultado` varchar(1000) NULL; `con_errores` tinyint(1) NOT NULL DEFAULT 0.

- [ ] **Step 1: Preparar el trabajo.**
  - Comprobar que la entrega 2 está en main; si no, parar y avisar.
  - **Leer el main nuevo** (`git log` y `git diff` desde el commit de este plan: las entregas 1 y 2 y cualquier otra) y **ajustar este plan en la rama,** en su propio commit, si cambió algo: los nombres de los «Consumes» de cada tarea, las versiones, los tests, la cantidad de tablas (37 + 4) y de páginas, y lo que la entrega 2 dejó en `mi-espacio.js` (`PESTANAS`, `pestanaDeHash`, `htmlDeHoyYManana`, los modales, `#me-anuncio`) y en `miEspacioController.js` (`verResumen`, `hoy_y_manana`).
  - **Si un cambio es una decisión del usuario, preguntárselo a la sesión coordinadora, sin decidirlo.** Confirmar con ella las «Preguntas para el usuario»: si la 1 es «sí», el enum `tipo` suma `'salida'` en el Step 4 y la Task 6, su plantilla.
  - Worktree en `feat/mi-espacio-agenda`, desde `main` (si este plan no está en main, mergear `docs/mi-espacio-pre-plan`); junction de `node_modules`; `rpad_rama_agenda` como copia de `datospublicos_mcr_rpad`, en el `.env`.
  - `npm test` con el candado: anotar el total y 0 fallas.
- [ ] **Step 2: Escribir los tests que fallan** en `tests/schema.test.js`:
  - `TABLAS_AGENDA` con las cuatro: columnas, claves ajenas e índices; `recordatorio_unico` con `EXTRA = 'STORED GENERATED'`; las cuatro en «no trae datos»;
  - **«la clave única vale solo para los recordatorios»:** repetir un recordatorio con `INSERT IGNORE` da `affectedRows` 0; dos invitaciones iguales entran;
  - `describe('migracion-mi-espacio-agenda.sql')`, copiado del de `migracion-mi-espacio.sql` (base `rpad_schema_mi_espacio_agenda_test`), con sus mismas aserciones: las cabeceras (la spec, «después de migracion-mi-espacio.sql» y «Para deshacer: rollback-mi-espacio-agenda.sql»; en el rollback, «se pierden»), la migración dos veces y el rollback dos veces con una fila en cada tabla, sin borrar al usuario.
- [ ] **Step 3:** `node --test tests/schema.test.js`: FAIL.
- [ ] **Step 4: La migración, el rollback** (corridas, envíos, personas y eventos) **y `schema.sql`,** con `SET NAMES utf8mb4` y las cabeceras de `migracion-mi-espacio.sql`.
- [ ] **Step 5:** La migración en `rpad_rama_agenda` y el test: PASS.
- [ ] **Step 6: Commit:** `feat(agenda): las cuatro tablas de la agenda, con su migración y su vuelta atrás`.

### Task 2: La validación, el momento del aviso y los textos (puro)

**Files:**
- Create: `services/miEspacioEventosReglas.js`, `tests/mi-espacio-eventos-reglas.test.js`

**Interfaces:**
- Consumes: `esDiaHabilCon`, `restarDiasHabilesCon`, `diaDeLaSemana`; `esFechaIso`, `sumarDias`, `formatoCorto`; `diaLargo`; `idPositivo`; `esAdmin`.
- Produces (puras; ninguna tira; las constantes y los textos de Global Constraints):
  - **`validarEvento(entrada, hoy) → { datos: { titulo, detalle, fecha, desde, hasta, compartido, para_todos, personas: number[], recordatorio } | null, error: { campo, mensaje } | null }`,** en este orden:
    1. `titulo`, recortado: vacío, `titulo`; más de 150, `tituloLargo`;
    2. `fecha`: `esFechaIso`, de `FECHA_MINIMA_EVENTO` a `fechaMaximaEvento(hoy)`; si no, `textoRangoEvento`;
    3. `desde`: `/^([01]\d|2[0-3]):[0-5]\d$/`;
    4. `hasta`: `''`, null y `undefined` son null; si viene, el mismo formato y mayor que `desde`;
    5. `detalle`: recortado, vacío es null, hasta 1000;
    6. `compartido` y `para_todos`: solo el `true` literal, y `para_todos` solo con `compartido`; compartido sin `para_todos` exige `personas`, ids con `idPositivo`, sin repetidos, no vacío; sin compartir, `[]`;
    7. `recordatorio`: sin él, `'2h'`; fuera de `RECORDATORIOS`, error.
  - **`momentoDelAviso({ fecha, desde, recordatorio }, feriados) → 'AAAA-MM-DD HH:MM' | null`:** null con `ninguno` o algo inválido. `1h`/`2h`: la hora menos la anticipación, en minutos (negativo: el día anterior, + 1440). `dia_anterior`: `restarDiasHabilesCon(fecha, 1, feriados)`, a la misma hora. Si el día que queda no es hábil, `restarDiasHabilesCon(día, 1, feriados)`, a la misma hora.
  - **`textoDelAviso({ fecha, desde, recordatorio }, { ahora, feriados })`, `cuandoDelEvento`, `cuandoCortoDelEvento`, `cuandoEsElEvento`, `cuandoFue`, `textoDelEvento(evento)`** («Reunión de equipo, martes 27/10/2026 de 10:00 a 11:00»), **`listaConY(nombres)`** e **`inicialesDe(nombre)`** («MR»).

- [ ] **Step 1: Escribir los tests que fallan** (hoy `'2026-10-26'`, lunes):
  - **`validarEvento`,** cada error con su campo: título de espacios; 150 emojis pasan y 151 no; `'2024-12-31'`, `'2026-02-30'`, `'2028-10-27'` y `null` (`'2028-10-26'` pasa); `'24:00'`, `'9:00'` y `'10:00:00'`; `hasta` igual a `desde`; 1001 de detalle; compartido con `[]`, `[0]` y `['abc']`; `'otro'`. Sin recordatorio, `'2h'`; `para_todos` sin `compartido`, false; `[3, 3, 5]` da `[3, 5]`; `compartido: 'true'`, false.
  - **`momentoDelAviso`:** `dia_anterior` del lunes 02/11/2026 a las 10:00 da `'2026-10-30 10:00'` y, con `new Set(['2026-10-30'])`, `'2026-10-29 10:00'`; `2h` del martes 27/10 a las 10:00, `'2026-10-27 08:00'`, y del sábado 31/10, `'2026-10-30 08:00'`; `1h` del lunes 02/11 a las 00:30, `'2026-10-30 23:30'`; el mes: `dia_anterior` del 02/02/2026, `'2026-01-30 10:00'`; el año: del 04/01/2027, `'2026-12-31 10:00'` (el 01/01 es fijo), y `2h` del 01/01/2027 a la 01:00, `'2026-12-31 23:00'`; `ninguno`, `'2026-02-30'` y `'25:00'`, null.
  - **`textoDelAviso`** con `ahora` `'2026-10-27 07:00:00'`: «2 horas antes (hoy a las 08:00)» y «El día hábil anterior (el viernes 30/10 a las 10:00)»; a las 09:00, el de la hora pasada; a las 10:00, el empezado; `ninguno`, «Sin aviso».
  - **Los cuándo,** `listaConY` (uno, dos y tres) e `inicialesDe`.
  - **`ROLES_QUE_COMPARTEN`** es `['superadmin', 'admin', 'editor', 'colaborador', 'lector'].filter(esAdmin)`.
  - **«nada tira»:** `validarEvento(null, hoy)` da error en `titulo`; los textos con `null` devuelven texto.
- [ ] **Step 2:** Correr: FAIL.
- [ ] **Step 3: Implementar,** con el comentario de convención de los archivos puros.
- [ ] **Step 4:** Correr: PASS.
- [ ] **Step 5: Commit:** `feat(agenda): la validación de un evento, el momento del aviso con los feriados y sus textos`.

### Task 3: Quién recibe qué: los recordatorios de una corrida y los emails de un guardado (puro)

**Files:**
- Modify: `services/miEspacioEventosReglas.js`, `tests/mi-espacio-eventos-reglas.test.js`

**Interfaces:**
- Consumes: `momentoDelAviso`, `esDiaHabilCon`, `emailValido`.
- Produces:
  - **`recordatoriosQueTocan(eventos, { ahora, feriados }) → [{ evento_id, usuario_id, email, para, reintento }]`**, por `evento_id` y `usuario_id`. Un evento es `{ id, fecha, desde, recordatorio, destinatarios: [{ usuario_id, email, sin_recordatorio }], envios: [{ usuario_id, para, success, terminado }] }`, con `para` = `${fecha} ${desde}` y `terminado` = `enviado_at` no NULL. Toca un destinatario si hoy es hábil, `aviso <= ahora16 < inicio`, no lo apagó, su email pasa `emailValido` y no tiene envío con ese `para` (o tiene uno fallido y terminado: `reintento: true`). Uno que salió, o una reserva sin terminar (pudo haber salido), no se repite.
  - **`cambioQueAvisa(antes, despues)`:** cambió `titulo`, `fecha`, `desde` o `hasta`.
  - **`emailsDelGuardado({ antes, despues, audienciaAntes, audienciaDespues, ahora }) → { invitacion, cambio, cancelacion }`** (ids, sin quien lo creó; `antes` null en un alta, `despues` null en una baja): el alta invita a la audiencia; la baja la cancela; un cambio invita a los que entran y avisa a los que siguen, solo con `cambioQueAvisa`; los que salen, nada (Pregunta 1). Si el evento (el de después, o el de antes en una baja) ya empezó, nada.

- [ ] **Step 1: Escribir los tests que fallan,** con un evento del martes 03/11/2026 a las 10:00 con `2h`, la persona 1 que lo creó y la 2 invitada:
  - a las 07:59, nadie; a las 08:00 y a las 09:30, las dos, con `para` `'2026-11-03 10:00'`; a las 10:00, `[]`;
  - con `sin_recordatorio` en la 2, solo la 1;
  - **«cambiado de hora»:** con un envío exitoso a las 10:00 y el evento a las 15:00, a las 13:00 toca la 1 con `'2026-11-03 15:00'`;
  - fallido y terminado vuelve con `reintento: true`; sin terminar, no;
  - **«un día no hábil»:** el sábado 31/10 a las 11:00, `[]` para uno de las 12:00 con `1h`; con un feriado el 03/11, `[]`;
  - `email: null` no toca;
  - **`emailsDelGuardado`:** el alta a `[2, 3]`; de `[2, 3]` a `[3, 4]` con otra hora da `invitacion [4]` y `cambio [3]`; solo el detalle, `cambio []`; la baja, `cancelacion [2, 3]`; uno de ayer, todo vacío.
- [ ] **Step 2:** Correr: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** Correr: PASS.
- [ ] **Step 5: Commit:** `feat(agenda): qué recordatorios tocan en una corrida y quién recibe qué email al guardar`.

### Task 4: La API de los eventos

**Files:**
- Create: `services/miEspacioEventosDatos.js`, `controllers/miEspacioEventosController.js`, `tests/mi-espacio-eventos-api.test.js`
- Modify: `routes/index.js`, `services/miEspacioEventosReglas.js`, `tests/permisos.test.js`

**Interfaces:**
- Consumes: Tasks 2 y 3; `feriadosEntre`; `esAdmin`, `idPositivo`, `ahoraArgentina`.
- Produces:
  - **Datos** (`conexion = pool`, sin N+1): `eventosVisibles({ id, rol }, desde, hasta, conexion) → Evento[]` (los activos que creó, los compartidos sin `para_todos` con una fila suya y los `para_todos` si `esAdmin(rol)`), con `Evento` = `{ id, creado_por, creador, titulo, detalle, fecha, desde, hasta, compartido, para_todos, recordatorio, personas: [{ id, nombre, sin_recordatorio }] }`; `eventoVisible(id, usuario, conexion)` y `eventoPropio(id, usuarioId, conexion, { bloquear })`, `Evento | null`; `audienciaDe(evento, conexion) → [{ id, nombre, email, sin_recordatorio }]` (sin quien lo creó, solo activos; con `para_todos`, los de `ROLES_QUE_COMPARTEN`); y `personasParaCompartir(excluirId, conexion) → [{ id, nombre, iniciales }]` (activas, de `ROLES_QUE_COMPARTEN`, por nombre).
  - **`itemDeEvento(evento, { usuarioId, ahora, feriados })`** (puro) → `{ id, titulo, detalle, fecha, desde, hasta, es_mio, compartido, para_todos, creador, personas: [nombre], personas_ids (si es suyo), recordatorio, recordatorio_texto, mi_recordatorio, aviso: { momento, texto, corto }, quien_texto, quien_largo (si no es suyo) }`; `mi_recordatorio` es `ninguno` si lo apagó, y `aviso` va sobre él.
  - **Las rutas** (`authMiddleware`, con el `rol` de la base; `/eventos/aviso` antes que `/eventos/:id`):
    - `GET /api/mi-espacio/eventos?desde=&hasta=` (`listarEventos`) → `{ desde, hasta, hoy, puede_compartir, eventos }`, por fecha, hora y título; los feriados, de `desde − 31` a `hasta`;
    - `GET /api/mi-espacio/eventos/aviso?fecha=&desde=&recordatorio=` (`verAvisoDelEvento`) → `{ momento, texto }`; un dato inválido, 400 en su campo;
    - `GET /api/mi-espacio/personas` (`listarPersonasParaCompartir`): sin `esAdmin`, 403 con `sinPermiso`;
    - `POST /eventos` (`crearEvento`) → 201 `{ data: { id }, message: 'Evento guardado.' }`; `PUT /eventos/:id` (`cambiarEvento`, el formulario entero) → `'Evento cambiado.'`; `DELETE /eventos/:id` (`borrarEvento`, `activo = 0`) → `'Evento borrado.'`;
    - `PUT /eventos/:id/mi-recordatorio` (`cambiarMiRecordatorio`): `{ sin_aviso: true | false }` → `{ data: { mi_recordatorio, aviso }, message }`; con `para_todos`, apagar inserta o actualiza su fila y prender la borra.
  - **Los controles, en orden:** un id que no pasa `idPositivo`, ajeno (`PUT` y `DELETE`: que no lo creó; «mi recordatorio»: que no lo ve), inexistente o dado de baja → 404; «mi recordatorio» de uno propio, 400 `esTuyo`, y no booleano, `miRecordatorio` (en `sin_aviso`); `validarEvento` → 400; compartido sin `esAdmin` → 400 `sinPermiso` en `compartido` (también para quien lo creó y dejó de ser administración); una persona que no está en `personasParaCompartir` ni estaba ya en el evento → 400 `personasInvalidas` (el id propio se saca sin error).
  - **Las personas al guardar,** en la transacción: con `para_todos`, solo quedan las filas apagadas; con personas, exactamente las elegidas, y las que siguen conservan su `sin_recordatorio`; sin compartir, ninguna.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **`tests/mi-espacio-eventos-api.test.js`:** base `rpad_test_mi_espacio_eventos`, con el armado de `tests/licencias-api.test.js` (servidor propio, la fecha real, `LUNES` y `q(n)`); superadmin, adminA, adminB, editor, lector y colab; el `beforeEach` vacía las cuatro tablas, `feriados`, `usuarios_licencias` y Mailpit:
    - **uno personal** no sale en el `GET` de adminB ni del superadmin, y su `PUT`, su `DELETE` y su «mi recordatorio» dan 404;
    - **con personas,** adminB lo ve con `es_mio: false`, «De Test adminA» y «Lo creó Test adminA. Están: vos.», y el editor no; adminA, con «Con 1 persona» y `personas_ids`;
    - **para todos,** lo ven el superadmin, adminB, el editor y un admin creado después por SQL, y no el lector ni el colaborador;
    - el lector compartiendo, 400 `sinPermiso`; personal, 201; `GET /personas`, 403 con «No tenés permiso para compartir eventos.»;
    - adminB invitada recibe 404 en el `PUT` y el `DELETE`, como `'abc'`, `'1e3'` y uno dado de baja; con adminA desactivada, adminB lo sigue viendo;
    - cada 400 con su campo, y el borrado deja `activo = 0`;
    - **«mi recordatorio»:** adminB lo apaga (`mi_recordatorio: 'ninguno'`); el editor apaga uno para todos (fila nueva) y lo prende (sin fila); adminA sobre el suyo, `esTuyo`; `'si'`, 400;
    - **Review Focus 1:** adminA cambia la hora con las mismas personas y adminB sigue apagada;
    - **Review Focus 4:** el editor pasa a lector por SQL; adminA cambia el título sin tocarlo (200) y él lo sigue viendo; sumarlo a otro, `personasInvalidas`; con adminA lectora, guardarlo compartido da 400 en `compartido` y «Solo yo», 200;
    - `GET /personas` da `['id', 'nombre', 'iniciales']` de adminB, el editor y el superadmin, sin el lector, el colaborador, una desactivada ni quien pide;
    - **Review Focus 3:** para un lunes a más de dos semanas, `GET /eventos/aviso` con `dia_anterior` da el viernes anterior y, con un feriado ese viernes, el jueves, con su `texto`; `recordatorio=otro`, 400.
  - **`tests/permisos.test.js`:** `RUTAS_MI_ESPACIO` suma las siete rutas (401 sin sesión); el lector y el colaborador, 200 en `GET /mi-espacio/eventos` y 403 en `GET /mi-espacio/personas`.
- [ ] **Step 2:** Correr los dos: FAIL.
- [ ] **Step 3: Implementar,** con las rutas después de las de Mi espacio; el alta y el cambio, en una transacción, y el cambio lee con `eventoPropio(…, { bloquear: true })`.
- [ ] **Step 4:** Correr los dos: PASS.
- [ ] **Step 5: Commit:** `feat(agenda): la API de los eventos: ver, crear, cambiar, borrar, mi recordatorio, el aviso y las personas`.

### Task 5: Lo demás de la agenda y «Hoy y mañana» en el Resumen

**Files:**
- Modify: `services/miEspacioEventosReglas.js`, `services/miEspacioEventosDatos.js`, `controllers/miEspacioEventosController.js`, `controllers/miEspacioController.js`, `tests/mi-espacio-eventos-reglas.test.js`, `tests/mi-espacio-eventos-api.test.js`

**Interfaces:**
- Consumes: `diasHabilesDe`, `filasDeFeriados`, `feriadosDelAnio`; `NOMBRES_TIPO`, `ausenciasVisibles`, `ausenciasUnidas`, `numeroTexto`, `diaLargo`; Task 4.
- Produces:
  - **Puras:** `itemDeLicencia(fila, { desde, hasta, feriados }) → { id, tipo, desde, hasta, texto, hasta_texto, dias }` (`dias`, sus hábiles dentro del rango; `hasta_texto` `''` si dura un día); `itemDeAusencia(ausencia, …) → { nombre, desde, hasta, texto, hasta_texto, dias }` (nunca el tipo, la nota ni el id); `itemsDeFeriados(lista, desde, hasta) → [{ fecha, nombre, texto }]` (los que rigen y caen en el rango, también fijos y de fin de semana); `eventosDeHoyYManana(items, hoy) → [{ id, hora, titulo, compartido, detalle }]`.
  - **`licenciasPropiasEntre(usuarioId, desde, hasta, conexion)`:** las activas de `mi_espacio_licencias` que tocan el rango.
  - **`GET /mi-espacio/eventos`** suma `licencias`, `feriados` y `ausentes` (`ausenciasVisibles` sin quien mira y `ausenciasUnidas`; `[]` sin `esAdmin`).
  - **`GET /mi-espacio/resumen`** suma `hoy_y_manana.eventos`; aislado: si falla, `[]` y la consola.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **Puros:** «Franquicia, 2 h» sin `hasta_texto`; vacaciones del 26/10 al 06/11/2026 pedidas de noviembre dan `dias` del 02/11 al 06/11 (sin el 03/11 si es feriado) y «Hasta el viernes 06/11»; las claves de `itemDeAusencia` son exactamente las seis; `itemsDeFeriados` de diciembre a enero trae el 08/12, el 25/12 y el 01/01 y no uno que no rige; `eventosDeHoyYManana` deja afuera pasado mañana.
  - **API:** las licencias de adminA (por SQL) salen con su tipo y las de adminB no; **los compañeros, sin el tipo (antiobjetivo):** las vacaciones de adminB con `mostrar = 1` salen en los `ausentes` de adminA con sus seis claves, con `mostrar = 0` no, y el lector recibe `[]`; un feriado cargado sale con «Feriado: <nombre>»; 94 días o fechas inválidas, 400 en `fechas`; uno de hoy y uno compartido de mañana salen en `hoy_y_manana.eventos`, y uno de pasado mañana no. Si un test de la entrega 2 compara `hoy_y_manana` entero, se le suma `eventos: []`: es el único cambio permitido a sus aserciones.
- [ ] **Step 2:** Correr: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** Correr los dos, `tests/mi-espacio-api.test.js` y `tests/mi-espacio-resumen.test.js`: PASS.
- [ ] **Step 5: Commit:** `feat(agenda): tus licencias, los feriados y los compañeros en la agenda, y los eventos en «Hoy y mañana»`.

### Task 6: Las cuatro plantillas y los emails de invitación, cambio y cancelación

**Files:**
- Create: `services/miEspacioEventosEmails.js`
- Modify: `services/emailTemplates.js`, `controllers/miEspacioEventosController.js`, `tests/emails-fixtures.js`, `tests/email-diseno.test.js`, `tests/mi-espacio-eventos-api.test.js`

**Interfaces:**
- Consumes: `plantillaSimple`, `RPAD_URL`, `sendEmail`, `emailValido`, los cuándo, `emailsDelGuardado`, `audienciaDe`.
- Produces:
  - **Plantillas** (`→ { subject, html, text }`): `eventoInvitacionTemplate({ creador, evento })`, `eventoCambioTemplate({ creador, antes, despues })`, `eventoCancelacionTemplate({ creador, evento })` y `eventoRecordatorioTemplate({ evento, hoy })`; `evento` = `{ titulo, fecha, desde, hasta, detalle }`, `creador` = un nombre.
  - **`anotarEnvio({ evento_id, usuario_id, tipo, para, success }, conexion = pool)`** (con `enviado_at = ahoraArgentina()`) y **`enviarEmailsDelGuardado({ plan, antes, despues, creador, audiencia }) → { enviados, fallidos }`** (`audiencia`: `Map` de id a `{ email }`): un email por persona con `sendEmail({ subject, html, text, to: [email] })`, solo con `emailValido(email)` (si no, ni envío ni fila: nunca `to` vacío); cada intento, su fila. Nunca tira.
  - **El controlador:** las audiencias, dentro de la transacción (la de antes, antes de escribir); responde y **después** llama a `enviarEmailsDelGuardado`, sin mirar las licencias.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **`tests/emails-fixtures.js`:** `'evento: invitación'`, `'evento: cambio'` (al miércoles 28/10), `'evento: cancelación'` y `'evento: recordatorio'` (hoy `'2026-10-27'`), con `boton: true`, «Persona de Prueba» y `{ titulo: 'Reunión de equipo', fecha: '2026-10-27', desde: '10:00', hasta: '11:00', detalle: 'Sala de reuniones del 2.º piso.' }`.
  - **`tests/email-diseno.test.js`:** `ASUNTOS` y `TEXTOS` de los cuatro; el botón a `/mi-espacio.html#agenda`; el `<s>` dentro de un `<p>`; el recordatorio con hoy, mañana y el 02/11 da sus asuntos; **un título y un detalle con HTML, escapados en los cuatro** (Review Focus 2).
  - **API** (`describe('los emails del guardado')`, con `mailpit.esperar` y `paraCasilla`): el alta compartida le llega a adminB y no a adminA; con todos, a toda la administración activa menos adminA, y a nadie más; cambiar la hora le avisa a adminB y sumar al editor lo invita solo a él; cambiar el detalle no manda nada; borrarlo cancela a los dos; una invitada desactivada no recibe nada (Review Focus 4); adminB con una licencia de Configuración hoy lo recibe igual; cada email deja su fila con `success = 1`; con `email` NULL, ni mensaje ni fila; y, en el proceso, `enviarEmailsDelGuardado` con `EMAIL_SOLO_A = 'nadie@rpad.test'` deja `success = 0` y no tira.
- [ ] **Step 2:** Correr los tres: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** Correr los tres: PASS.
- [ ] **Step 5: Commit:** `feat(agenda): las cuatro plantillas y los emails de invitación, cambio y cancelación, después de responder`.

### Task 7: La corrida de los recordatorios, con su propio candado

**Files:**
- Create: `services/miEspacioEventosCorrida.js`
- Modify: `services/notasDigitales.js`, `services/miEspacioEventosDatos.js`, `services/miEspacioEventosReglas.js`, `controllers/notificacionesController.js`, `routes/index.js`, `tests/notas-motor.test.js`, `tests/mi-espacio-eventos-reglas.test.js`, `tests/mi-espacio-eventos-api.test.js`, `tests/permisos.test.js`

**Interfaces:**
- Consumes: `recordatoriosQueTocan`, `eventoRecordatorioTemplate`, `feriadosEntre`, `sendEmail`.
- Produces:
  - **`notasDigitales.js`:** `export const conBloqueo = async (fn, nombre = BLOQUEO)`, igual que hoy, con el nombre en `GET_LOCK`, `RELEASE_LOCK` y el aviso de la consola; sus llamadas no cambian.
  - **`eventosParaLaCorrida(hoy, conexion)`** (en lote): los activos con recordatorio de `hoy` a `hoy + VENTANA_DE_LA_CORRIDA`, con `destinatarios` (quien lo creó, si está activo, y su `audienciaDe`) y `envios` de recordatorio, con la forma de la Task 3.
  - **`textoDelResultadoDeEventos({ dia_habil, enviados, fallidos, errores })`** (pura).
  - **`ejecutarRecordatoriosDeEventos({ ahora = ahoraArgentina() } = {}) → { ocupada, dia_habil, enviados, fallidos, errores: [{ evento_id, usuario_id, error }] }`,** dentro de `conBloqueo(…, BLOQUEO_EVENTOS)` (tomado: `ocupada: true`, sin escribir nada):
    1. anota el inicio (`inicio_at` = `ahora`);
    2. los feriados de `hoy − 31` a `hoy + 16` y `recordatoriosQueTocan`;
    3. reserva cada uno: nuevo, `INSERT IGNORE` con `enviado_at` NULL y `success` 0; reintento, `UPDATE … SET enviado_at = NULL WHERE … AND success = 0 AND enviado_at IS NOT NULL`; sigue solo con `affectedRows === 1`;
    4. manda con `to: [email]` y anota `success` y `enviado_at = ahoraArgentina()`; un error va a `errores` y sigue;
    5. anota el fin (`fin_at`, `resultado`, `con_errores`).
    Anota también en un día no hábil (así el Estado sabe que la Tarea Cron llama); si anotar falla, va a la consola.
  - **`leerCorridaDeEventos(conexion = pool) → { inicio, fin, resultado, con_errores, en_curso } | null`** (`en_curso`: sin fin y `IS_FREE_LOCK(BLOQUEO_EVENTOS)` distinto de 1).
  - **`ejecutarRecordatoriosDeLaAgenda(req, res)`** (`notificacionesController.js`), siempre con `data`: ocupada, 200 «Otra corrida de los recordatorios está en curso.»; día no hábil, 200 «Hoy no es día hábil: no se mandan recordatorios.»; con fallidos o errores, 207; si no, 200 «Recordatorios enviados: N.»; una excepción, 500 «Error en los recordatorios de la agenda». Ruta: `router.get('/cron/eventos', cronAuth, ejecutarRecordatoriosDeLaAgenda)`.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **Puros:** `textoDelResultadoDeEventos` no hábil, con 2 y 1, y con un error.
  - **`tests/notas-motor.test.js`** (los demás, sin tocar): con `tomarBloqueoAjeno()`, `motor.conBloqueo(fn, 'rpad_mi_espacio_eventos')` corre `fn`, y `motor.conBloqueo(fn)` da `{ ocupado: true }` sin correrla.
  - **API** (`describe('la corrida de los recordatorios')`): el servicio se importa después de apuntar `DB_NAME`, los eventos van por SQL con fechas fijas y cada corrida se llama con `mock.timers.enable({ apis: ['Date'], now })`, como `corridaDiaria` de `tests/metricas-foto.test.js`. Con uno de adminA compartido con adminB, el martes 03/11/2026 a las 10:00 con `2h`:
    - a las 07:30 (10:30 UTC), nada; a las 08:00, un email a cada uno con «RPAD: Reunión de equipo, hoy a las 10:00»; a las 08:30, ninguno más;
    - creado a las 09:45, la de las 10:00 no manda nada; con adminB apagada, solo adminA; pasado a las 15:00, sale otra vez a las 13:00, con otra fila;
    - a las 08:00 con `EMAIL_SOLO_A = 'nadie@rpad.test'`, `success = 0`; a las 08:30 con `''` sale, con una sola fila por persona; con una fila de adminB con `enviado_at` NULL, a adminB no le llega;
    - uno del sábado 31/10 a las 12:00 con `1h` no sale el sábado a las 11:00 (`dia_habil: false`); uno del lunes 02/11 a las 10:00 con `dia_anterior`, cargado el sábado, sale el lunes a las 00:00; con un feriado el 03/11, ese día nada;
    - **Review Focus 3:** uno del lunes 09/11 a las 10:00 con `dia_anterior` sale el viernes 06/11 a las 10:00 y, con un feriado cargado el 06/11, el jueves 05/11;
    - adminB, con una licencia de Configuración ese día, lo recibe; una persona desactivada (Review Focus 4) o sin email, no, y nada va a otras casillas;
    - con `GET_LOCK('rpad_mi_espacio_eventos', 0)` tomado en otra conexión, `ocupada: true`, sin emails ni anotación; con el de las Notas tomado, corre;
    - `inicio_at` es el momento simulado, con `fin_at` y su `resultado` (un sábado, «Día no hábil: no se mandan recordatorios.»).
  - **`tests/permisos.test.js`** (`describe('cron')`): `/cron/eventos` da 403 sin clave y con una incorrecta, y 200 con la clave por encabezado.
- [ ] **Step 2:** Correr los cuatro: FAIL.
- [ ] **Step 3: Implementar:** primero exportar `conBloqueo` y correr `tests/notas-motor.test.js` entero; después, la corrida.
- [ ] **Step 4:** Correr los cuatro y `tests/metricas-foto.test.js`: PASS.
- [ ] **Step 5: Commit:** `feat(agenda): la corrida de los recordatorios cada media hora, con su propio candado y sin repetidos`.

### Task 8: La línea de los recordatorios en Correos → Estado

**Files:**
- Modify: `services/miEspacioEventosReglas.js`, `services/miEspacioEventosCorrida.js`, `controllers/notasDigitalesController.js`, `public/correos.html`, `public/js/correos.js`, `tests/mi-espacio-eventos-reglas.test.js`, `tests/mi-espacio-eventos-api.test.js`, `tests/correos-frontend.test.js`, `tests/paginas.test.js`

**Interfaces:**
- Consumes: `leerCorridaDeEventos`, `cuandoFue`, `esDiaHabilCon`, `feriadosEntre`.
- Produces:
  - **Puras:** `textoDeLaCorridaDeEventos(corrida, ahora)` y `alertasDeLaCorridaDeEventos(corrida, { ahora, feriados }) → [{ tipo, nivel, mensaje }]`; `eventos-sin-corrida` va solo en un día hábil, sin corrida o con más de `MINUTOS_SIN_CORRER` desde su inicio.
  - **`estadoDeLosRecordatorios({ ahora = ahoraArgentina() } = {}) → { texto, corrida, alertas }`.**
  - **`verEstado`** suma `data.eventos = { texto, corrida }` y sus alertas al final de `data.alertas`; si falla, `data.eventos = null` y `eventos-sin-estado`.
  - **`correos.html`:** `<p id="nd-eventos" hidden></p>` después de `#nd-ultima-corrida` y `correos.js?v=20261210`; **`correos.js`:** `cargarEstado` escribe `estado.eventos?.texto` en `#nd-eventos` y lo oculta sin `estado.eventos`.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **Puros:** la línea hoy, ayer, el 23/10/2026, en curso y sin corrida; las alertas el lunes 26/10/2026 a las 10:45 con la última a las 10:30 (`[]`) o a las 09:30 (`eventos-sin-corrida`); el sábado y un feriado, `[]`; sin corrida en un día hábil; con errores; sin fin ni `en_curso`.
  - **API:** `estadoDeLosRecordatorios` en el proceso, con un `ahora` fijo y una fila por SQL; por HTTP, `GET /notificaciones/notas-digitales/estado` trae `data.eventos.texto` y los campos de siempre.
  - **`tests/correos-frontend.test.js`** (los existentes, sin tocar): `#nd-eventos` visible con el `texto`; sin `eventos` o con `null`, oculto; una alerta `eventos-sin-corrida` se dibuja como `<div class="nd-alerta">` y prende el punto rojo.
  - **`tests/paginas.test.js`:** `VERSION_CORREOS = '20261210'` y `#nd-eventos` después de `#nd-ultima-corrida`.
- [ ] **Step 2:** Correr los cuatro: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** Correr los cuatro y `tests/notas-api.test.js`: PASS.
- [ ] **Step 5: Commit:** `feat(agenda): la última corrida de los recordatorios en Correos → Estado, con su aviso si no corre`.

### Task 9: La pestaña Agenda: el mes, los próximos, los colores y «Hoy y mañana»

**Files:**
- Modify: `public/mi-espacio.html`, `public/js/mi-espacio.js`, `tests/mi-espacio-frontend.test.js`, `tests/paginas.test.js`

**Interfaces:**
- Consumes: `GET /mi-espacio/eventos` y `hoy_y_manana.eventos`.
- Produces:
  - **`mi-espacio.html`:** `#tab-agenda` después de `#tab-horas` y `#vista-agenda` después de `#vista-horas`; `#btn-nuevo-evento` (`sg-btn-borde`) antes de `#btn-cargar-horas`; en la vista, `#ag-anterior`, `#ag-mes-titulo` (`h2`), `#ag-siguiente`, `#ag-hoy`, `#ag-nuevo-evento`, `#ag-mes`, `.me-leyenda` y `#ag-proximos`; la bajada y la descripción con «tu agenda», como la maqueta; los estilos del mes, los eventos (`propio`, `compartido`, `licencia`, `feriado`, `ausente`), la leyenda y los próximos de `maqueta.css`; en `@media (max-width: 720px)`, Próximos primero y `.me-ev` como puntos (`font-size: 0`).
  - **Lo puro en `mi-espacio.js`** (sin repetir nombres de la entrega 2): `PESTANAS` suma `'agenda'`;
    - `diasDeLaGrilla('AAAA-MM') → [{ fecha, dia, del_mes, finde }]` (de lunes a domingo, con `Date.UTC`), `mesVecino(mes, n)`, `tituloDelMes(mes)` ('Octubre 2026'), `rangoDeLaGrilla(mes)` y `rangoDeProximos(hoy)` (de hoy a hoy + `DIAS_DE_PROXIMOS`, copia del servidor con su test de paridad);
    - `cosasPorDia(datos) → Map<fecha, [{ clase, texto, evento_id? }]>`: el feriado, tus licencias, los compañeros y los eventos por hora y título (`'10:00 Reunión de equipo'`); licencias y compañeros, en sus `dias`;
    - `htmlDelMes(mes, datos, hoy)`: una celda por día (hoy con `aria-current="date"`), hasta 3 cosas y `<button type="button" class="me-mas" data-ver-mas="AAAA-MM-DD">y N más</button>`, que muestra el resto en la celda; un evento es `<button type="button" class="me-ev <clase>" data-evento="<id>" title="<texto>">`, y lo demás, un `<span>` con su `title`;
    - `gruposDeProximos(datos, hoy) → [{ titulo, items: [{ hora, titulo, detalle, evento_id? }] }]`: Hoy y Mañana (la hora o «Todo el día»), Esta semana (hasta el domingo: «Mié 28», con la hora en el título) y Más adelante («Mar 03/11»), sin grupos vacíos; lo de varios días, una vez, en el grupo de `max(desde, hoy)`, con su `hasta_texto`; el detalle de un evento, `quien_texto` y `aviso.corto`;
    - `htmlDeProximos(grupos)`; `htmlDeHoyYManana` suma los eventos y «Ver la agenda» (`href="#agenda"`).
  - **El DOM:** `cargarAgenda({ forzar })` (dos `API.pedirJson`, al abrir la pestaña), `mostrarMesDeLaAgenda(mes)` y los clics delegados en `#vista-agenda`; el mes no va en la dirección.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **`tests/mi-espacio-frontend.test.js`:**
    - `pestanaDeHash('#agenda')` es 'agenda', y `DIAS_DE_PROXIMOS` es el del servidor;
    - `diasDeLaGrilla('2026-10')`: 35, del `'2026-09-28'` al `'2026-11-01'`; `'2026-08'`: 42, del `'2026-07-27'` al `'2026-09-06'`; `'2027-01'` empieza el `'2026-12-28'`; `mesVecino('2026-12', 1)` es `'2027-01'` y `('2027-01', -1)`, `'2026-12'`;
    - `htmlDelMes`: un día con un feriado, una licencia, un compañero y dos eventos muestra los tres primeros y «y 2 más»; hoy, con `hoy` y `aria-current`; sábados y domingos, `finde`; uno propio es `me-ev propio` y uno ajeno, `me-ev compartido`;
    - `gruposDeProximos` con hoy `'2026-10-26'`: «Hoy, lunes 26/10» (con un compañero desde el 23/10 y «Hasta el viernes 30/10»), «Mañana, martes 27/10», «Esta semana» («Mié 28», «15:30 Turno médico») y «Más adelante» («Mar 03/11»); sin nada mañana, no hay ese grupo;
    - `htmlDeHoyYManana` con eventos y sin ellos;
    - **escapado (Review Focus 2):** un título y un nombre con HTML, escapados en la grilla (y en el `title`), en Próximos y en «Hoy y mañana».
  - **`tests/paginas.test.js`:** `VERSION_MI_ESPACIO = '20261210'`; `#tab-agenda`, la cuarta pestaña; `#vista-agenda` oculta, después de `#vista-horas`; `#btn-nuevo-evento` antes de `#btn-cargar-horas`; `.me-ev` con `font-size: 0` dentro de `@media (max-width: 720px)`.
- [ ] **Step 2:** Correr los dos: FAIL.
- [ ] **Step 3: Implementar,** desde `maqueta.js` (`mes()`) y `maqueta.css`.
- [ ] **Step 4:** Correr los dos: PASS.
- [ ] **Step 5: Commit:** `feat(agenda): la pestaña Agenda con el mes, los próximos, los colores y los eventos de hoy y mañana`.

### Task 10: El formulario del evento y el detalle de un evento ajeno

**Files:**
- Modify: `public/mi-espacio.html`, `public/js/mi-espacio.js`, `tests/mi-espacio-frontend.test.js`, `tests/paginas.test.js`

**Interfaces:**
- Consumes: las rutas de la Task 4; `#modal-confirmar` y `#me-anuncio` (entrega 2).
- Produces:
  - **Los modales, después del footer,** como los de la entrega 2 (el velo no los cierra; cada campo con su `<id>-error` y `aria-describedby`): `#modal-evento` («Nuevo evento» o «Editar evento») con `ev-titulo`, `ev-fecha`, `ev-desde`, `ev-hasta`, `ev-detalle`, `#ev-grupo-quien` (`ev-solo` y `ev-compartido`, con `aria-pressed`), `#ev-grupo-personas`/`#ev-personas`, `ev-recordatorio` (en el orden de `RECORDATORIOS`), `#ev-aviso`, `#ev-error`, `ev-guardar` y `ev-borrar`; y `#modal-evento-ajeno` con `#mea-titulo`, `#mea-cuando`, `#mea-detalle`, `#mea-quien`, `mea-recordatorio` («<recordatorio_texto> (el que eligió <creador>)» y «Sin aviso»; sin recordatorio, solo el texto), `#mea-error` y `mea-cerrar`.
  - **Copias con paridad:** `MENSAJES_EVENTO`, `LARGO_TITULO_EVENTO`, `LARGO_DETALLE_EVENTO`, `FECHA_MINIMA_EVENTO`, `fechaMaximaEvento`, `RECORDATORIOS`, `RECORDATORIO_POR_DEFECTO`, y `TEXTO_RECORDATORIO`.
  - **Lo puro:** `valoresDelEvento(item | null, { fecha })`; `erroresDelEvento(valores, hoy) → { campo: mensaje }`; `cuerpoDelEvento(valores, { puedeCompartir })` (sin `puedeCompartir`, sin `compartido`, `para_todos` ni `personas`); `htmlDePersonasDelEvento(personas, valores)` («Todos» primero, `data-persona="todos"`; elegido, las demás `disabled`); `htmlDeOpcionesDeRecordatorio(elegido)`; `pedidoDelAviso(valores) → string | null`; `htmlDelEventoAjeno(item)` y `textoDeConfirmacionDeEvento(item)` (texto plano).
  - **El comportamiento:** uno propio abre `#modal-evento`, uno ajeno `#modal-evento-ajeno` y «Nuevo evento», con hoy y `2h`; las personas se piden una vez y solo con `Auth.isAdmin() === true` (si no, `#ev-grupo-quien` oculto); el aviso, 300 ms después del último cambio, descartando la respuesta vieja; «Guardar», deshabilitado hasta la respuesta; un 400 va a su campo (`aria-invalid` y el foco) o a `#ev-error`; un 404 cierra, anuncia y vuelve a pedir la agenda; al guardar o borrar se vuelven a pedir la agenda y el Resumen, y el `message` va a `#me-anuncio`; «Borrar» confirma en `#modal-confirmar`; en el ajeno, `mea-recordatorio` manda el `PUT` enseguida y, si falla, vuelve a lo de antes con el error en `#mea-error`; el foco va al primer campo y vuelve al botón; Escape cierra primero la confirmación.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **Paridades:** cada copia, igual a la del servidor; `fechaMaximaEvento` con `'2026-10-26'`, `'2028-02-29'` y `'2026-12-31'`; `erroresDelEvento` contra `validarEvento` en los bordes de la Task 2.
  - **Lo puro:** el cuerpo de un lector no trae `compartido`; con «Todos», `para_todos: true` y `personas: []`, y las demás `disabled`; `pedidoDelAviso` con una hora inválida, null; la confirmación personal, con 4 personas y con todos.
  - **Con el DOM y el `fetch` falsos** (como `tests/proyectos-frontend.test.js`): **dos clics con un `fetch` que tarda mandan un solo `POST`** (Review Focus 5); un 400 en `titulo` deja `aria-invalid="true"` y el foco en `#ev-titulo`; dos cambios seguidos de la hora piden un solo aviso y una respuesta vieja no pisa `#ev-aviso`; un 404 cierra y vuelve a pedir `/mi-espacio/eventos`; el lector no ve `#ev-grupo-quien` ni pide `/mi-espacio/personas`; en el ajeno, un `PUT` que falla deja el select como estaba; el velo no cierra y Escape cierra la confirmación primero; **un título con HTML, escapado en `#mea-titulo` y en la confirmación** (Review Focus 2).
  - **`tests/paginas.test.js`:** los ids de los dos modales, una sola vez, sin repetirse con los de la carcasa ni los de la entrega 2, y después del footer.
- [ ] **Step 2:** Correr: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** Correr los dos: PASS.
- [ ] **Step 5: Commit:** `feat(agenda): el formulario del evento, compartir, el recordatorio y el detalle de un evento ajeno`.

### Task 11: Documentación, recorrido, revisión final y cierre

**Files:**
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: `CLAUDE.md`** (spec, sección 9): la agenda en Mi espacio (quién ve y cambia, «Todos», los emails aunque la persona esté de licencia y los del guardado también en un día no hábil); 41 tablas y las cuatro, con su migración y la clave única; los archivos nuevos; la convención de la agenda en `mi-espacio.js` y la línea de `correos.js`; en «Recordatorios automáticos», `GET /api/cron/eventos` cada media hora, con `BLOQUEO_EVENTOS`; la aclaración frente a la Agenda de pedidos.
- [ ] **Step 2: `README.md`:** la migración (después de `migracion-mi-espacio.sql`, antes del código) y su rollback; en «Configurar Cron Job», la URL nueva para probar a mano, la fila `*/30 | * | * | * | * | curl -s "https://tu-dominio.com/api/cron/eventos?secret=TU_CRON_SECRET" > /dev/null` con un párrafo de lo que hace, y la ruta en la tabla de cron.
- [ ] **Step 3: Recorrido en el navegador** sobre `rpad_rama_agenda`: como admin, un evento personal y uno compartido (la invitación en Mailpit), cambiarle la hora, «Todos», el mes, Próximos, el Resumen y el borrado; como la invitada, el detalle y «Mi recordatorio»; como lectora, solo «Solo yo»; la corrida, llamando a la función (nunca a la URL), y la línea en Correos → Estado; el foco, Escape y 375 px. Capturas para el usuario.
- [ ] **Step 4: Revisión final de toda la rama** con Opus; se corrigen los hallazgos críticos e importantes.
- [ ] **Step 5:** `npm test` completo con el candado: 0 fallas y el total de la Task 1 más los nuevos.
- [ ] **Step 6: Kit `RPAD-deploy-mi-espacio-agenda` en el Escritorio:** los archivos en su ruta, los dos SQL, la lista contra `git diff --name-only main...feat/mi-espacio-agenda` y `PASOS.txt`:
  1. con la entrega 2 desplegada, respaldo de la base y de los archivos, fuera del horario de los crons (8:15, 14:00 y las medias horas: por ejemplo, a las 10:10);
  2. phpMyAdmin → la base del RPAD → SQL: `migracion-mi-espacio-agenda.sql`;
  3. subir los archivos con el Administrador de archivos; Setup Node.js App → Restart;
  4. abrir `https://rpad.mcrmodernizacion.gob.ar/api/cron/eventos?secret=<CRON_SECRET>`: un JSON con `"success":true`;
  5. WHM o cPanel → Tareas Cron → agregar: Minuto `*/30`, Hora `*`, Día `*`, Mes `*`, Día semana `*`, comando `curl -s "https://rpad.mcrmodernizacion.gob.ar/api/cron/eventos?secret=<CRON_SECRET>" > /dev/null`; las de las 8:15 y las 14:00 no se tocan;
  6. pasada la media hora siguiente, Correos → Estado dice «Recordatorios de la agenda: última corrida hoy a las …», sin alertas de la agenda.
- [ ] **Step 7: Merge y push** (autorizado por el usuario si todo está bien): traer main con merge (no rebase) y volver a correr la suite; merge en main y push; comprobar que main y origin coinciden; la migración en `datospublicos_mcr_rpad`, con un respaldo antes.
- [ ] **Step 8: Limpieza:** quitar el junction de `node_modules` antes de `git worktree remove` y borrar `rpad_rama_agenda`.
- [ ] **Step 9: Avisar a la sesión coordinadora:** el hash del merge, el kit, los tests antes (Task 1) y después, y lo que el usuario despliega: la migración, los archivos, el Restart, la prueba de la URL y la Tarea Cron nueva cada media hora.

## Preguntas para el usuario

1. **A una persona que se saca de un evento compartido** (o a todas, si pasa a «Solo yo»), ¿le llega un email? La spec nombra la invitación, el cambio y la cancelación, y «Se canceló» no sería cierto: el evento sigue. **El plan, de entrada, no le manda nada** (Task 3). Si el usuario quiere avisarle, va una quinta plantilla («Ya no estás en un evento: Reunión de equipo, martes 27/10/2026 de 10:00 a 11:00.») con el tipo `'salida'` en el enum; se decide antes del Step 4 de la Task 1.
2. **Un recordatorio atrasado sale en la primera corrida de un día hábil, la de las 00:00.** Por ejemplo, un evento del lunes a las 10:00 con «El día hábil anterior» cargado el sábado: el aviso (el viernes) ya pasó y, según la spec, sale «en la siguiente de un día hábil, mientras el evento no haya empezado». ¿Está bien a esa hora, o los atrasados esperan a una hora de trabajo (por ejemplo, desde las 7:00)? **El plan sigue la spec** (un test de la Task 7 lo fija).
