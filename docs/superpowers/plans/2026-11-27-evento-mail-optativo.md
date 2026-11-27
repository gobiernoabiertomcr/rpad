# «Yo y quienes elija» con el aviso por mail optativo: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un tilde «Aviso por mail» por evento en «Yo y quienes elija»; apagado, a la cadena de quien lo carga no le llega ningún mail por ese evento, y quienes están marcados lo siguen viendo en su agenda.

**Architecture:** una columna `mi_espacio_eventos.aviso_por_mail` (1 de entrada). La validación la devuelve en `datos` (`true`, `false` o `null` = «no vino»); el controlador resuelve el `null` con el evento de antes, la guarda y reescribe `publicado_at` al prenderla. El aviso diario saltea un Público ajeno con el tilde apagado. La página dibuja la casilla en el recuadro, cambia tres textos con el tilde apagado y suma una insignia.

**Tech Stack:** Node 22, Express, mysql2, `node:test`; vanilla JS con el DOM falso de `tests/mi-espacio-frontend.test.js`.

**Spec:** `docs/superpowers/specs/2026-11-27-evento-mail-optativo-design.md` (leela entera antes de empezar: los textos van al pie de la letra).

## Global Constraints

- Leé `CLAUDE.md` y, antes de tocar cada archivo, el documento que dice `.claude/rules/` (Mi espacio: `docs/temas/mi-espacio-evento-publico.md`, `mi-espacio-aviso-diario.md`, `mi-espacio-agenda.md`; base: `base-de-datos.md`; despliegue: `despliegue.md`; frontend: `frontend.md`; Configuración: `configuracion.md`).
- Repo público: ningún nombre real, email, título ni dato de producción. Los tests usan los «Test <clave>» de `crearUsuariosPrueba` o los nombres inventados de cada archivo (Micaela, Federico, Graciela, Lucía, Tomás).
- Textos exactos:
  - frase apagada: «De quien dependés: no le va a llegar ningún mail por este evento.» / «De quienes dependés: no les va a llegar ningún mail por este evento.»
  - aviso al guardar, apagado: «Evento guardado. {quien_texto} en su agenda, sin aviso por mail.» (en un cambio, «Evento cambiado.»)
  - insignia: «Sin aviso por mail»
  - sufijo del Resumen: «, sin aviso por mail»
  - ayuda de las personas, apagada y con la cadena marcada: «Federico ya está en la lista, porque dependés de esa persona. Si le sacás la marca, no lo ve en su agenda.» / «Federico y Graciela ya están en la lista, porque dependés de esas personas. Si les sacás la marca, no lo ven en su agenda.»
  - Configuración: «A esta persona y a quien esté más arriba les llega por mail el texto corto de los eventos que quien depende de ellas deja a la vista de otros, salvo los que cargue sin aviso por mail. No ven nada más de su Mi espacio.»
- Solo `true` y `false` literales mueven el tilde; nada da 400 por él.
- No cambian: los textos del mail del jefe y de la casilla «Recibir mi agenda por mail», `GET …/aviso-de-la-cadena`, el ítem recortado de un Público ajeno, lo propio del aviso diario.
- `npm test` completo antes (línea de base en `~/rpad-notas/evento-mail-optativo/logs/`) y después. Una sola suite por contenedor; nunca `docker compose` desde el worktree.
- `tests/schema.test.js` y `tests/permisos.test.js` leen la base del `.env`, que es la compartida: la migra la coordinadora (Task 1, paso final). Mientras tanto se corren los archivos de test que crean su propia base.
- Commit y push de la rama al terminar cada tarea (cortes de luz).
- Modelos: Opus en las Tasks 1 a 5 (migración, reglas, API que escribe, corrida y formulario: lista fija del proceso); Sonnet en la Task 6. Revisión de cada tarea con Opus; la de toda la rama, con Fable 5.2 en esfuerzo alto.

## Review Focus

1. Una pestaña con la página anterior edita un Público que tiene el tilde apagado: tiene que quedar apagado (la Task 3 lo prueba con un PUT sin la clave).
2. Un evento que pasa de Público a Privado y vuelve a Público: arranca prendido, no hereda un 0 viejo (Task 3: un Privado guarda 1).
3. Prender el tilde el mismo día del evento, que se cargó días antes: no tiene que salir en el grupo «Hoy» de las 14:00 ni a las 8:05 (Task 3 reescribe `publicado_at`; Task 4 prueba que con `publicado_at` de hoy no es rezagado).
4. Un jefe con un Público apagado y otro prendido el mismo día: recibe solo el prendido, también a las 8:05 (Task 4).
5. Quien carga sin nadie arriba: no ve el tilde y el aviso al guardar no dice «sin aviso por mail» (Tasks 2 y 5).

---

### Task 1: La columna

**Files:**
- Create: `database/updates/migracion-mi-espacio-evento-aviso-por-mail.sql`, `database/updates/rollback-mi-espacio-evento-aviso-por-mail.sql`
- Modify: `database/schema.sql` (tabla `mi_espacio_eventos`, después de `publicado_at`), `tests/schema.test.js`, `docs/temas/base-de-datos.md`, `docs/temas/despliegue.md` (fila 41)

**Interfaces:**
- Produces: `mi_espacio_eventos.aviso_por_mail tinyint(1) NOT NULL DEFAULT 1`, después de `publicado_at`.

- [ ] **Step 1: Tests de esquema que fallan.** En `tests/schema.test.js`, la lista de columnas de la agenda suma, después de `publicado_at` y con su comentario, `'mi_espacio_eventos.aviso_por_mail tinyint(1) null=NO default=1 key='`. Suma un `describe` como el de `migracion-mi-espacio-eventos-diario.sql` (líneas ~3730): sobre una base temporal propia (`rpad_schema_evento_aviso_por_mail`) creada desde `schema.sql` sin la columna, la migración la deja igual a `schema.sql`, correrla dos veces no falla, los eventos que ya estaban quedan en 1, y el rollback la saca y deja la tabla como antes. La cabecera de los dos SQL dice el orden (después de `migracion-dato-quincena-votacion.sql`, antes del código) y la del rollback, que **los eventos con el tilde apagado vuelven a mandar el mail a la cadena**, con `SELECT id, creado_por, fecha FROM mi_espacio_eventos WHERE aviso_por_mail = 0 AND activo = 1` para listarlos antes; el test busca esas dos cosas en la cabecera. Ningún SQL trae `USE`.
- [ ] **Step 2:** `node --test tests/schema.test.js` → FALLA (la columna no está).
- [ ] **Step 3:** Escribir la migración (`ALTER TABLE mi_espacio_eventos ADD COLUMN IF NOT EXISTS aviso_por_mail tinyint(1) NOT NULL DEFAULT 1 AFTER publicado_at;`), el rollback (`DROP COLUMN IF EXISTS`) y la columna en `schema.sql`.
- [ ] **Step 4:** Correr la migración en una copia de la base compartida con otro nombre (`rpad_evento_mail_optativo`, ya existe) y `node --test tests/schema.test.js` contra una base local migrada: los tests nuevos pasan. El de la lista de columnas contra la base del `.env` sigue fallando hasta que la coordinadora migre la compartida.
- [ ] **Step 5:** `docs/temas/base-de-datos.md` (la columna, en la sección del aviso diario: qué es, que el código anterior anda con ella, la vuelta atrás) y fila 41 de `docs/temas/despliegue.md` (con «va antes que `rollback-mi-espacio-eventos-diario.sql`, si se deshace»).
- [ ] **Step 6:** Commit, push y **pedirle a la coordinadora** (SendMessage a `local_e7d7604b-f7e1-46e9-9f36-ba3f80b7ac0b`) que migre `datospublicos_mcr_rpad` con respaldo; no correr la suite completa hasta su respuesta.

### Task 2: Las reglas puras

**Files:**
- Modify: `services/miEspacioEventosReglas.js` (`validarEvento`, `itemDeEvento`, `eventosDeHoyYManana`, nuevo `avisoPorMailAlGuardar`), `services/miEspacioEventosDiarioReglas.js` (`mensajeDelGuardado`)
- Test: `tests/mi-espacio-eventos-reglas.test.js`, `tests/mi-espacio-eventos-diario-reglas.test.js`

**Interfaces:**
- Produces:
  - `validarEvento(entrada, hoy).datos.aviso_por_mail`: en un Público, `true` si vino `true`, `false` si vino `false`, `null` en cualquier otro caso; en un Privado y un Laboral, `true`.
  - `avisoPorMailAlGuardar(datos, anterior = null) → boolean`: si `datos.publico` no es verdadero, `true`; si `datos.aviso_por_mail` es booleano, ese; si `anterior` era Público (`anterior.publico` verdadero), `anterior.aviso_por_mail !== false`; si no, `true`.
  - El ítem propio de un Público (`itemDeEvento`) trae `aviso_por_mail` (booleano: `!esNo(fuente.aviso_por_mail)`) justo después de `texto_publico`. El ajeno, igual que hoy.
  - `eventosDeHoyYManana`: un Público propio con `aviso_por_mail === false` suma `SUFIJO_SIN_AVISO_POR_MAIL` (`', sin aviso por mail'`, exportada) al final de `quien` (y por eso de `detalle`).
  - `mensajeDelGuardado({ tipo, verbo, quienTexto, superiores = [], aviso = null, avisoPorMail = true })`: en un Público con `superiores` y `avisoPorMail === false`, `` `Evento ${verbo}. ${quienTexto} en su agenda, sin aviso por mail.` `` (antes de mirar `aviso`); lo demás, igual.

- [ ] **Step 1: Tests que fallan.**
  - Reglas: los `deepEqual` de `datos` (el de «un evento válido» y `PRIVADO`, y los Laborales y Públicos del bloque de tipos) suman `aviso_por_mail` (`true` en Privado y Laboral; `null` en un Público sin la clave). Nuevo `it('aviso_por_mail: solo el true y el false literales, en un Público')`: `datosDe({ tipo: 'publico', …, aviso_por_mail: false }).aviso_por_mail === false`, con `true` → `true`, y con `'false'`, `0`, `null`, `1` y sin la clave → `null`; un Privado y un Laboral con `false` → `true`; ningún valor da error.
  - `avisoPorMailAlGuardar`: alta (`anterior` null) con `null` → `true`; con `false` → `false`; cambio con `null` y `anterior = { publico: true, aviso_por_mail: false }` → `false`; con `null` y `anterior = { publico: false, aviso_por_mail: false }` → `true`; `datos.publico` falso con `false` → `true`.
  - `CLAVES_DEL_MIO_PUBLICO` (reglas y `tests/mi-espacio-eventos-api.test.js`) suma `'aviso_por_mail'` después de `'texto_publico'`; el deepEqual del Público propio (≈ línea 1582) suma `aviso_por_mail: true`; uno con `aviso_por_mail: 0` da `false`; `CLAVES_DEL_AJENO_PUBLICO` no cambia aunque la fuente traiga `aviso_por_mail: 0`.
  - `eventosDeHoyYManana`: un Público propio con `aviso_por_mail: false` y `quien_texto` «Lo ven todos como «Trámite personal»» da `quien` «lo ven todos como «Trámite personal», sin aviso por mail» y `detalle` «Hoy · lo ven todos como «Trámite personal», sin aviso por mail»; uno ajeno con `aviso_por_mail: false`, `quien` ''.
  - Aviso diario: `mensajeDelGuardado({ tipo: 'publico', verbo: 'guardado', quienTexto: 'Lo ve Lucía como «Trámite personal»', superiores: ['Federico'], aviso: { llega: true }, avisoPorMail: false })` → «Evento guardado. Lo ve Lucía como «Trámite personal» en su agenda, sin aviso por mail.»; lo mismo con `aviso: { llega: false }` y con `verbo: 'cambiado'`; con `superiores: []` y `avisoPorMail: false` → «… en su agenda.»; sin `avisoPorMail`, los textos de hoy.
- [ ] **Step 2:** `node --test tests/mi-espacio-eventos-reglas.test.js tests/mi-espacio-eventos-diario-reglas.test.js` → FALLAN.
- [ ] **Step 3:** Implementar lo de «Produces».
- [ ] **Step 4:** Los dos archivos pasan, y `node --test tests/mi-espacio-frontend.test.js` sigue pasando (la paridad de `erroresDelEvento` mira solo el error).
- [ ] **Step 5:** Commit y push.

### Task 3: El guardado

**Files:**
- Modify: `services/miEspacioEventosDatos.js` (`COLUMNAS_EVENTO` y el objeto de `leerEventos`; `recortado` NO), `controllers/miEspacioEventosController.js` (`datosDelGuardado`, `valoresDelEvento`, INSERT, UPDATE, `mensajeDe`)
- Test: `tests/mi-espacio-eventos-api.test.js`

**Interfaces:**
- Consumes: `avisoPorMailAlGuardar`, `mensajeDelGuardado({ …, avisoPorMail })` (Task 2).
- Produces: los eventos de `leerEventos` (y por eso `eventoPropio`) traen `aviso_por_mail: Number(fila.aviso_por_mail) !== 0` después de `texto_publico`; `datosDelGuardado` devuelve `datos.aviso_por_mail` ya resuelto (booleano) con `avisoPorMailAlGuardar(datos, anterior)`.

- [ ] **Step 1: Tests que fallan**, en un `describe('el aviso por mail (spec 2026-11-27-evento-mail-optativo)')`, con los helpers del archivo (`crear`, `cambiar`, `publicoCon`, `formulario`, `como`, `publicadoDe`, `ponerPublicado`, `conCadena`) y uno nuevo `avisoDe(id)` que lee la columna:
  - un alta Pública con `aviso_por_mail: false` guarda 0; sin la clave, 1;
  - un PUT de ese evento sin la clave lo deja en 0 (pestaña vieja); con `true`, 1; con `'false'`, sin cambiar;
  - un Privado con `aviso_por_mail: false` guarda 1; pasar ese Privado a Público sin la clave, 1;
  - `publicado_at`: con el tilde apagado y `ponerPublicado(id, VIEJO)`, prenderlo con la misma fecha lo reescribe (≠ VIEJO); apagarlo no lo toca (= VIEJO);
  - el mensaje con `conCadena()`: alta apagada de `adminB` → «Evento guardado. Lo ve Test l. como «Trámite personal» en su agenda, sin aviso por mail.»; el cambio, «Evento cambiado. …»; `lector` (sin cadena) apagado → «Evento guardado. Lo ve Test adminB como «Trámite personal» en su agenda.»;
  - `GET /mi-espacio/eventos` da `aviso_por_mail: false` en el ítem propio y nada en el de otra persona (las claves del recortado no cambian);
  - el deepEqual de `eventoPropio`/`eventoVisible` (≈ líneas 865 y 2023) suma `aviso_por_mail: true` donde corresponde.
- [ ] **Step 2:** `node --test tests/mi-espacio-eventos-api.test.js` → FALLA.
- [ ] **Step 3:** Implementar: la columna en la lectura; `aviso_por_mail` al final de las columnas del INSERT y del UPDATE (`datos.aviso_por_mail ? 1 : 0`, después de `recordatorio` en `valoresDelEvento`); en el UPDATE, `publicado_at` se conserva solo si `datos.publico && antes.publico && antes.fecha === datos.fecha && !(antes.aviso_por_mail === false && datos.aviso_por_mail === true)`; `mensajeDe` pasa `avisoPorMail: evento.aviso_por_mail !== false`.
- [ ] **Step 4:** El archivo pasa; también `tests/mi-espacio-eventos-corrida.test.js`, `tests/mi-espacio-api.test.js` y `tests/mi-espacio-resumen.test.js` (el Resumen).
- [ ] **Step 5:** `docs/temas/mi-espacio-aviso-diario.md`, «Lo sin informar»: `publicado_at` también se escribe al prender el tilde. Commit y push.

### Task 4: El aviso diario

**Files:**
- Modify: `services/miEspacioEventosDiarioDatos.js` (`eventosDelAviso`), `services/miEspacioEventosDiarioReglas.js` (`mailDeLaPersona`), `docs/temas/mi-espacio-aviso-diario.md`
- Test: `tests/mi-espacio-eventos-diario-reglas.test.js`, `tests/mi-espacio-eventos-diario-datos.test.js`, `tests/mi-espacio-eventos-diario.test.js`

**Interfaces:**
- Produces: cada evento de `eventosDelAviso` trae `aviso_por_mail: Number(fila.aviso_por_mail) !== 0`; `mailDeLaPersona` saltea (`continue`) un Público de otra persona con `evento.aviso_por_mail === false`, en la misma condición que `!evento.creador_activo`.

- [ ] **Step 1: Tests que fallan.**
  - Puros (con `publico(id, cambios)`, `mail(...)`, `JUEVES_TARDE` y los usuarios del archivo): un Público de Micaela para el viernes con `aviso_por_mail: false` no le llega a Federico ni a Graciela a las 14:00 (`mail(...)` da null); con otro prendido el mismo día, `gente` trae solo el prendido e `informa` solo ese; a las 8:05, uno apagado de hoy sin informar y con `publicado_at` viejo no dispara el mail (null) y, si hay otro rezagado prendido, no aparece en `gente`; un rezagado prendido con `publicado_at` de hoy no dispara nada (lo que deja la Task 3 al prenderlo); lo propio de Micaela (con `eventos_por_mail`) sigue saliendo con su marca; un evento sin la clave (los fixtures de hoy) cuenta como prendido. El test de los getters que tiran suma un Público con `aviso_por_mail: false` y sigue pasando.
  - Datos: `eventosDelAviso` da `aviso_por_mail: false` para una fila con 0 y `true` con el default.
  - Corrida con Mailpit: Micaela con un Público apagado («Asunto familiar») y otro prendido («Fuera de la oficina») para el día siguiente: el mail de Federico trae «Fuera de la oficina» y no «Asunto familiar»; con solo el apagado, a Federico no le llega mail y la corrida termina sin error.
- [ ] **Step 2:** Los tres archivos → FALLAN.
- [ ] **Step 3:** Implementar lo de «Produces».
- [ ] **Step 4:** Los tres pasan. (`tests/notificaciones.test.js` corre los crons sobre la base del `.env`: va recién en la suite de la Task 7, con la compartida migrada.)
- [ ] **Step 5:** `docs/temas/mi-espacio-aviso-diario.md`: en «Qué recibe cada persona», que un Público con el tilde apagado no le llega a la cadena; en «La casilla», que el mail a la cadena depende también del tilde de quien carga (spec, sección 10, con el motivo). Commit y push.

### Task 5: El formulario

**Files:**
- Modify: `public/mi-espacio.html` (el grupo del tipo y su CSS; `?v=` de `js/mi-espacio.js` a `20261235`), `public/js/mi-espacio.js`, `tests/paginas.test.js` (`VERSION_MI_ESPACIO = '20261235'`, la lista de ids de `modal-evento`, la regex de `#ev-grupo-tipo`), `tests/mi-espacio-frontend.test.js`, `docs/temas/mi-espacio-evento-publico.md`

**Interfaces:**
- Consumes: `aviso_por_mail` del ítem propio (Task 2) y del cuerpo (Task 3).
- Produces:
  - HTML: dentro de `#ev-grupo-tipo`, entre `#ev-tipos` y `#ev-tipo-ayuda`: `<label class="me-aviso-mail" id="ev-aviso-mail-rotulo" hidden><input type="checkbox" id="ev-aviso-mail" aria-describedby="ev-tipo-ayuda"> <b>Aviso por mail</b></label>`. El `<p id="ev-tipo-ayuda">` y la descripción del grupo no cambian.
  - CSS: la etiqueta visible es la parte de arriba del recuadro (mismo fondo y borde que `.me-frase-tipo`, sin borde abajo) y `.me-aviso-mail:not([hidden]) + .me-frase-tipo` es la de abajo (sin borde arriba, con la sangría de la casilla); `.me-superiores.apagados .me-superior` (fondo transparente, borde punteado, `--sg-suave`) y su `i`; foco visible en la casilla.
  - `FRASE_SIN_AVISO_POR_MAIL = Object.freeze({ uno: '…', varios: '…' })` (los textos de las Global Constraints), solo del navegador.
  - `valoresDelEvento`: suma `aviso_por_mail` (nuevo: `true`; de un ítem: `item.aviso_por_mail !== false`).
  - `cuerpoDelEvento`: un Público suma `aviso_por_mail: datos.aviso_por_mail !== false`, después de `texto_publico`; el Privado y el Laboral, sin la clave.
  - `htmlDeLaFraseDelTipo`: en un Público con la cadena, ya **sin** el ícono del mail ni «Aviso por mail»: `<span class="me-superiores">` (con `apagados` si `aviso_por_mail === false`) y, después, el `aviso` o, apagado, `FRASE_SIN_AVISO_POR_MAIL.uno|varios`; lo demás, igual.
  - `htmlDeLaAyudaDeLasPersonas`: apagado, las oraciones sin el mail (Global Constraints) si están todas marcadas y, si no, solo `AYUDA_DE_LAS_PERSONAS_DEL_PUBLICO`; prendido, igual.
  - `pintarLaFrase`: `#ev-aviso-mail-rotulo.hidden = !(tipo publico && superiores.length > 0)` y `#ev-aviso-mail.checked = valores.aviso_por_mail !== false`.
  - `alCambiarElAvisoPorMail` (en `change` de `#ev-aviso-mail`): `formulario.valores = { ...valoresDelFormularioDeEvento(formulario), aviso_por_mail: casilla.checked }` y `pintarLaFrase()`; el foco queda en la casilla.

- [ ] **Step 1: Tests que fallan.**
  - Puros: `valoresDelEvento(null)` y los deepEqual de los valores (≈ 6368 y 6584) suman `aviso_por_mail: true`; un ítem con `aviso_por_mail: false` da `false`; `cuerpoDelEvento` de un Público trae `aviso_por_mail` (deepEqual y `Object.keys` con la clave después de `texto_publico`), y el del Privado y el Laboral no; `htmlDeLaFraseDelTipo` apagada con una persona y con dos (textos exactos y la clase `apagados`), prendida con el `aviso` del servidor y sin «Aviso por mail»; `htmlDeLaAyudaDeLasPersonas` apagada, marcadas y sin marcar.
  - Página (DOM falso, `abrirNuevo(conCadena())`, `tipoDel`, `textoDe`): al elegir «Yo y quienes elija» la casilla se ve y está prendida; sin cadena (`CON_CADENA` vacío), oculta; apagarla (`checked = false`, `disparar('change')`) cambia la frase y la ayuda y el POST lleva `aviso_por_mail: false`; un evento que se edita con `aviso_por_mail: false` abre con la casilla apagada; pasar a «Solo yo» y volver la conserva; el test de ≈ 7606 cambia su regex a la frase sin «Aviso por mail».
  - `tests/paginas.test.js`: la regex nueva del grupo del tipo (con la etiqueta, en ese lugar), `ev-aviso-mail-rotulo` y `ev-aviso-mail` en la lista de ids, y la versión.
- [ ] **Step 2:** `node --test tests/mi-espacio-frontend.test.js tests/paginas.test.js` → FALLAN.
- [ ] **Step 3:** Implementar lo de «Produces».
- [ ] **Step 4:** Los dos pasan. Mirar la página en el navegador (preview `rpad-copia-evento-mail`, puerto 3098, con la copia migrada): la casilla, la frase, los chips en gris, el foco con el teclado y el teléfono (375 px).
- [ ] **Step 5:** `docs/temas/mi-espacio-evento-publico.md` («Cómo se ve» y «La página»: la casilla, las constantes y lo que no tiene paridad). Commit y push.

### Task 6: La insignia y Configuración

**Files:**
- Modify: `public/js/mi-espacio.js` (`gruposDeProximos`, `htmlDeProximo`, `htmlDelDiaElegido`, `htmlDeFilaDelDia`), `public/configuracion.html` (`#u-depende-ayuda`), `tests/mi-espacio-frontend.test.js`, `tests/paginas.test.js` (línea ≈ 152), `docs/temas/mi-espacio-evento-publico.md`, `docs/temas/mi-espacio-agenda.md` (el `quien` del Resumen), `docs/temas/configuracion.md`

**Interfaces:**
- Consumes: `aviso_por_mail` del ítem propio (Task 2); `SUFIJO_SIN_AVISO_POR_MAIL` ya lo pone el servidor en el Resumen (Task 2).
- Produces: `INSIGNIA_SIN_AVISO_POR_MAIL = 'Sin aviso por mail'`; `sinAvisoDelEvento(evento) → { sin_aviso: true } | {}` (solo un Público propio con `aviso_por_mail === false`), que se suma como `iconoDelEvento` a la cosa de `gruposDeProximos` (y pasa al ítem) y a la fila de `htmlDelDiaElegido`; `htmlDeProximo` y `htmlDeFilaDelDia` dibujan `<span class="me-insignia gris">Sin aviso por mail</span>` después de «Lo ven …».

- [ ] **Step 1: Tests que fallan:** `gruposDeProximos` con un Público propio apagado trae `sin_aviso: true` y los demás ítems no traen la clave (los deepEqual de hoy siguen iguales); `htmlDeProximo` y `htmlDeFilaDelDia` con `sin_aviso` incluyen la insignia después de `me-lo-ven`/`<small>`; uno ajeno con `aviso_por_mail: false` no la lleva; la regex de `#u-depende-ayuda` con el texto nuevo.
- [ ] **Step 2:** `node --test tests/mi-espacio-frontend.test.js tests/paginas.test.js` → FALLAN.
- [ ] **Step 3:** Implementar; el texto de Configuración, al pie de la letra.
- [ ] **Step 4:** Pasan; mirar Próximos, el día elegido (teléfono) y el Resumen en el navegador.
- [ ] **Step 5:** Los tres documentos. Commit y push.

### Task 7: Cierre

- [ ] **Step 1:** Con la base compartida migrada (respuesta de la coordinadora), `npm test` completo; comparar con la línea de base.
- [ ] **Step 2:** Revisión de toda la rama con Fable 5.2, esfuerzo alto; arreglar lo que encuentre y volver a correr lo afectado y la suite.
- [ ] **Step 3:** Traer main, suite en verde, merge en main y push (sin pedir OK, si todo está bien).
- [ ] **Step 4:** Kit `~/rpad-kits/RPAD-deploy-mi-espacio-evento-aviso-por-mail` contra f94b2aa: el zip sin carpeta raíz, el SQL antes del código, `PASOS.txt` con el paso 0 (`mi-espacio.js?v=20261234` en producción), la ventana (fuera de 8:05, 14:00, :00 y :30, las rutinas de Datito y los lunes a la mañana), Restart, la vuelta atrás y el aviso de que después el usuario cambia sus eventos desde la página.
- [ ] **Step 5:** Avisarle a la coordinadora: sha de main, kit y lo que quedó; soltar el contenedor. Borrar la copia `rpad_evento_mail_optativo` y bajar las vistas previas.
