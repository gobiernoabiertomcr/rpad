# La reiteración en su propio anexo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que cada hoja del anexo de una reiteración muestre la reiteración que acompaña: como movimiento más nuevo, contada en «Avisos del ciclo abierto» y con su marca en la cinta.

**Architecture:** la nota se suma en memoria a una copia de las fuentes de cada dataset, solo al armar el anexo (`seguimientosDeLaNota`). Tiene la forma que `fuentesDe` le da a una nota de la base y `estado: 'enviada'`. `generarNota` sigue leyendo las fuentes antes de abrir la transacción, pero calcula los Seguimientos adentro, ya con el número. La vista previa y la prueba la suman con «XX» y «PRUEBA», sin año.

**Tech Stack:** Node 22 (ES modules), PDFKit, `node --test` (`npm test` = `node --test --test-concurrency=1 "tests/*.test.js"`), `tests/pdf-lector.js`, `tests/seguimiento-casos.js`, MariaDB en Docker para los tests de integración.

**Spec:** `docs/superpowers/specs/2026-10-24-reiteracion-en-su-anexo-design.md`. Va en la misma rama y el mismo kit que `2026-10-24-notas-hoja-oficio-design.md`, ya implementada en esta rama.

## Global Constraints

- **Dónde se suma la nota.** Solo en el anexo de la reiteración: el de la corrida, el de la prueba y el de «Ver anexo». No cambian el Seguimiento de la pantalla (`controllers/seguimientoController.js`), la descarga de su PDF, el anexo del aviso, la base ni lo que se guarda.
- **Las fuentes se copian, nunca se modifican.** Vale para los `Map` que vienen de `fuentesDe`, de `fuentesDeEjemplo` y de `tests/seguimiento-casos.js`.
- **La forma de la nota sumada:** la de `aNota` (`services/seguimientoDatos.js:57-61`).
  - `{ id: null, numero, anio, tipo: 'reiteracion', gestion, fecha, estado: 'enviada', enviada: '<fecha de la nota> <HH:MM:SS de la generación>', para, cc, seccion, vencimiento, datos_solicitados, creado_por, firmante }`;
  - `seccion`: `'vencido'` si `dataset.vencimiento < fecha`, si no `'proximo'`;
  - `vencimiento`: el `vencimiento` del dataset;
  - `datos_solicitados`: `dataset.pedido?.texto ?? null`;
  - `creado_por` y `firmante`: el `usuarios.nombre_completo` de `usuarioId` y del `firmanteId` de la firma de la nota (null si no hay).
- **Sin duplicados.** Antes de sumar la propia, se sacan de las fuentes del dataset las notas con `tipo === 'reiteracion'`, la misma `fecha` y la misma `gestion`.
- **El número.** En la nota real, `numero` (entero) y `anio`. En la prueba, `numero: 'PRUEBA'` y `anio: null`. En la vista previa, `numero: 'XX'` y `anio: null`. Con `anio` null:
  - el título del movimiento es «Nota Digital N° XX a DGMIT»;
  - la etiqueta de la cinta es «Nota XX».
- **Si falta la fuente de un dataset,** la reiteración no se genera, igual que hoy, con el mismo mensaje («El anexo de la reiteración necesita el Seguimiento de cada dataset: falta el del dataset N»).
- **Nada más cambia.** El anexo sigue siendo una hoja A4 por dataset, con la misma diagramación. La hoja oficio de la nota (`PAGINA = [612, 1008]`) no cambia.
- **Regla del proyecto:** `npm test` completo antes y después de cada cambio de código. Antes de correrlo, comprobar que no corra la suite de otra sesión: `SHOW DATABASES LIKE 'rpad_test%'` vacío y 0 procesos en `information_schema.PROCESSLIST` con `DB LIKE 'rpad_test%'`. Los archivos con Docker se corren con `--test-concurrency=1`.
- **Entorno.** Worktree `C:\git\rpad\.claude\worktrees\notas-hoja-oficio`, rama `feat/notas-hoja-oficio`, `.env` con `DB_NAME=rpad_rama_oficio`. Nada se escribe en main.
- **Estilo.** Español, con la densidad de comentarios del archivo, y sin nombres de personas en archivos versionados. Commits con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Ningún email real.** Nunca llamar a `/api/cron/*` contra una base compartida.

## Review Focus

1. **Notas duplicadas.** La vista previa abierta el mismo día después de la reiteración real no puede mostrar dos reiteraciones de esa fecha (Task 3: test «doble»).
2. **Fuentes compartidas que se modifican.** Si se hiciera un `push` sobre `CASOS` o sobre el `Map` de `fuentesDe`, la nota se colaría en otros tests o en otra hoja (Task 1: el test «no modifica las fuentes»).
3. **Una reiteración que falla al enviarse.** El anexo guardado la muestra normal. El Seguimiento de la pantalla dice «No se pudo enviar.» y no la cuenta como aviso (Task 3: test «fallida»).
4. **Vista previa y prueba.** Nunca «N° null/ll» ni una marca sin etiqueta. También con datos de ejemplo, que no tienen notas (Task 1 y Task 3).
5. **El anexo del aviso y el Seguimiento de la pantalla siguen iguales.** Task 3 lo afirma.

---

### Task 1: la reiteración se suma a su propio Seguimiento (puro)

**Files:**
- Modify: `services/seguimientoReglas.js:232` (`numeroDeNota`): con `anio` null, `String(numero)`.
- Modify: `services/seguimientoCinta.js:88-92` (`etiquetaDeNota`): con número y `anio` null, `Nota ${numero}`. Sin número, sigue en null. Se actualiza el comentario.
- Modify: `services/notasDigitalesSeguimiento.js`:
  - el comentario de cabecera (:1-6), que hoy dice «no la reiteración que acompaña (todavía no existe)»;
  - `seguimientosDeLaNota` y dos funciones nuevas: `fuentesDeLaNota` y `notaPropiaDe`.
- Test: `tests/seguimiento-reglas.test.js`, `tests/seguimiento-cinta.test.js`, un archivo nuevo y puro `tests/notas-seguimiento-anexo.test.js`, y `tests/seguimiento-pdf.test.js` (la diagramación con la nota sumada).

**Interfaces:**
- Produces:
  - `export const fuentesDeLaNota = async (datasets, fuentesPorId = null) => Map`. Con `fuentesPorId` lo devuelve tal cual; si no, `fuentesDe(ids)` con una sola llamada. Tira el error de «falta el del dataset N» si falta alguno.
  - `export const notaPropiaDe = (dataset, fecha, propia) => nota`, con la forma de las Global Constraints. `propia = { numero, anio, gestion, enviada, para, cc, creado_por, firmante }`.
  - `export const seguimientosDeLaNota = async (datasets, fecha, fuentesPorId = null, propia = null) => Seguimiento[]`. Sin `propia`, hace lo mismo que hoy. Con `propia`, a cada dataset le pasa a `seguimientoDe` una copia `{ ...fuentes, notas: [...notas sin la reiteración de esa fecha y gestión, notaPropiaDe(dataset, fecha, propia)] }`.

- [ ] **Step 1: Escribir los tests que fallan**
  - `seguimiento-reglas`: `seguimientoDe` de un caso con una nota `{ …, numero: 'XX', anio: null, estado: 'enviada' }` da el título «Nota Digital N° XX a DGMIT». El texto de avisos del circuito la nombra «XX».
  - `seguimiento-cinta`: la marca de esa nota lleva la etiqueta «Nota XX». Con «PRUEBA», «Nota PRUEBA».
  - `notas-seguimiento-anexo.test.js` (nuevo, puro), con `CASOS`, `CATALOGOS` y `HOY_DE_LOS_CASOS`. Elegir un caso externo vencido con notas enviadas y uno próximo: el 52, que tiene notas, y otro que tenga un vencimiento futuro.
    - `'sin la nota propia da lo mismo que hoy'`: `seguimientosDeLaNota(ds, HOY, fuentes)` es `deepEqual` a `seguimientoDe(fuentes.get(id), HOY, OPCIONES_CINTA_PDF, { anexo: true })` para cada uno.
    - `'la nota propia es el movimiento más nuevo, igual que las otras notas'`. Con `propia = { numero: 2, anio: 2027, gestion: 'externa', enviada: '<HOY> 08:15:03', para: 'a@x', cc: null, creado_por: null, firmante: 'Nombre Apellido Firmante' }`, `movimientos[0]` tiene:
      - título «Nota Digital N° 2/27 a DGMIT»;
      - `fecha` HOY;
      - detalle que empieza con «Reiteración de gestión externa: vencía el …» (o «vence», según el caso) y lleva «Pide: …» si el dataset tiene pedido;
      - quién `['Envío automático', 'Firmó Nombre Firmante']`, como lo arma `nombreCorto`.
    - `'la nota propia suma en los avisos del ciclo abierto y va en la cinta'`. La cantidad de `circuito` (el número de avisos) es una más que sin ella, y su texto termina en «2/27». En `cinta.marcas` hay una marca de nota arriba, con la etiqueta «Nota 2/27».
    - `'no modifica las fuentes'`. Después de llamarla con `propia`, `CASOS[id].notas` y el `Map` recibido conservan su largo y su contenido (`structuredClone` antes y `deepEqual` después).
    - `'saca la reiteración de la misma fecha y gestión que ya estaba en las fuentes'`. Con una nota `{ tipo: 'reiteracion', fecha: HOY, gestion: 'externa', numero: 2, anio: 2027, … }` ya en las fuentes, hay un solo movimiento «Nota Digital N° …» con fecha HOY.
    - `'en la vista previa y la prueba, XX y PRUEBA'`: con `{ numero: 'XX', anio: null }`, «Nota Digital N° XX a DGMIT» y «Nota XX».
    - `'fuentesDeLaNota tira si falta la fuente de un dataset'`: el mensaje de hoy.
  - `seguimiento-pdf`: `renderAnexoDeSeguimiento` con los tres seguimientos de `tres()`, calculados con la nota sumada (también con «PRUEBA»). Pasa `verificarDiagramacion`, tiene 3 hojas A4 (`todasDelTamano(pdf, HOJA_A4)`) y en cada hoja aparece una vez «Nota Digital N° 2/27 a DGMIT».

- [ ] **Step 2:** `node --test tests/seguimiento-reglas.test.js tests/seguimiento-cinta.test.js tests/notas-seguimiento-anexo.test.js tests/seguimiento-pdf.test.js`. Expected: FAIL. Las funciones nuevas no existen, y con `anio` null sale «N° XX/ll» o la marca queda sin etiqueta.
- [ ] **Step 3:** implementar lo de **Files** y **Interfaces**.
- [ ] **Step 4:** mismos archivos. Expected: PASS.
- [ ] **Step 5:** `npm test` completo, después del control de concurrencia. Expected: 0 fallas.
- [ ] **Step 6: Commit** `feat: la reiteración se suma a su propio Seguimiento en el anexo (puro)`.

---

### Task 2: la lista de «Avisos del ciclo abierto» se recorta del medio en el PDF

Decisión del usuario: «recortar del medio». En el PDF, el texto de los avisos del ciclo tiene dos renglones (`dibujarTramo` en `services/seguimientoPdf.js`: `ajustar` con `lineas: 2` y la letra fija `LETRA.nodoTexto`). Hoy, si no entra, se corta al final con «…», y se perdería justo el número más nuevo.

**Files:**
- Modify: `services/seguimientoReglas.js`: `textoDeAvisos` (:704) y `circuitoDe` (:810). `circuito.avisos` suma `textosCortos`, la lista de versiones cada vez más cortas del texto, que la pantalla no usa.
- Modify: `services/seguimientoPdf.js`: el dibujo del tramo de avisos usa la primera de `[avisos.texto, ...avisos.textosCortos]` que entra en dos renglones sin cortarse. Si ninguna entra, usa la última con el corte de siempre.
- Test: `tests/seguimiento-reglas.test.js` y `tests/seguimiento-pdf.test.js`.

**Interfaces:**
- Produces: `circuito.avisos.textosCortos: string[]`. Para notas `[n1, …, nk]` con k ≥ 4, la versión m (m = 1 … k − 3) conserva `n1` y los últimos `k − 1 − m`, con «…» entre los dos: «las Notas Digitales N° n1, …, n(m+2), …, nk», con «y» antes del último. Por ejemplo, con 6 notas:
  - «las Notas Digitales N° 1/26, …, 4/26, 5/26, 6/26 y 7/26»;
  - «…, 5/26, 6/26 y 7/26»;
  - …;
  - «las Notas Digitales N° 1/26, …, 6/26 y 7/26».

  La parte de los emails no cambia. Con 3 notas o menos, la lista queda vacía. El texto de siempre (`avisos.texto`) no cambia.
- Consumes: nada de otras tareas (es independiente de la Task 1).

- [ ] **Step 1: Escribir los tests que fallan**
  - `seguimiento-reglas`: `circuitoDe` (o `seguimientoDe`) de un ciclo con 7 notas enviadas y 11 emails.
    - `avisos.texto` es el de siempre, con todos los números.
    - `avisos.textosCortos[0]` es «11 emails y las Notas Digitales N° <n1>, …, <n3>, <n4>, <n5>, <n6> y <n7>».
    - La última versión es «11 emails y las Notas Digitales N° <n1>, …, <n6> y <n7>».
    - Con 3 notas, `textosCortos` es `[]`.
  - `seguimiento-pdf`: un Seguimiento con 9 notas enviadas en el ciclo abierto. Sale de un caso real con notas sumadas a una copia de sus fuentes.
    - El renglón de los avisos no termina en «…» y contiene el último número y el primero.
    - `verificarDiagramacion` pasa.
    - Con un caso de 3 notas, el texto dibujado es el de siempre.
- [ ] **Step 2:** `node --test tests/seguimiento-reglas.test.js tests/seguimiento-pdf.test.js`. Expected: FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** mismos archivos más `tests/notas-seguimiento-anexo.test.js`. Expected: PASS.
- [ ] **Step 5:** `npm test` completo. Expected: 0 fallas.
- [ ] **Step 6: Commit** `feat: la lista de avisos del ciclo se recorta del medio en el PDF (siempre se ven el primero y los últimos)`.

---

### Task 3: `generarNota` y la vista previa arman el anexo con la propia reiteración

**Files:**
- Modify: `services/notasDigitales.js`.
  - `generarNota` (:131-219):
    - Antes de la transacción, en lugar de `seguimientosDeLaNota(...)`: `const fuentes = tipo === 'reiteracion' ? await fuentesDeLaNota(contenido.datasets, contenido.fuentesPorId ?? null) : null;` y los nombres de `usuarioId` y `firmaNota.firmanteId`, con una consulta parametrizada `SELECT id, nombre_completo FROM usuarios WHERE id IN (?)` (solo los ids no nulos; sin ids, no consulta).
    - Adentro, ya con `numero`: `const momento = ahoraArgentina();` y `seguimientos = await seguimientosDeLaNota(contenido.datasets, fecha, fuentes, { numero: esPrueba ? 'PRUEBA' : numero, anio, gestion, enviada: \`${fecha} ${momento.slice(11)}\`, para: para.join(', '), cc: cc.join(', ') || null, creado_por, firmante })`.
    - `renderAnexoDeReiteracion` recibe el mismo `momento`.
  - `previewAnexo` (:870-879):
    - toma también `firma` de `diaDeVistaPrevia`;
    - lee el `nombre_completo` de `firma.firmanteId`;
    - suma la propia con `{ numero: 'XX', anio: null, gestion, enviada: \`${fecha} ${momento.slice(11)}\`, para/cc de destinatarios(config, gestion, false, null, 'reiteracion'), creado_por: null, firmante }`.
  - El comentario de :143-144.
- Test: `tests/notas-motor.test.js` (describe 'anexo de la reiteración …', :1057) y, si hace falta para la vista previa por HTTP, `tests/notas-api.test.js`.

**Interfaces:**
- Consumes (Task 1): `fuentesDeLaNota(datasets, fuentesPorId)`, `seguimientosDeLaNota(datasets, fecha, fuentesPorId, propia)` y la forma de `propia`.

- [ ] **Step 1: Escribir los tests que fallan** (en `tests/notas-motor.test.js`)
  - **Corrida real** (ampliar :1123 o uno nuevo con `reiteracionDel0211()` y `ejecutar('2026-11-02')`):
    - en cada hoja del `anexo_pdf`, «Nota Digital N° 2/26 a DGMIT» aparece una vez y la cinta tiene «Nota 2/26»;
    - el próximo dice «2 avisos» / «Las Notas Digitales N° 1/26 y 2/26»;
    - el vencido dice «1 aviso» / «La Nota Digital N° 2/26».

    Ajustar a lo que den los datos del test, pero siempre contando la propia.
  - **Paridad:** después de `ejecutar`, la nota enviada, leída con `seguimientoDatos.fuentesDe([id])`, es igual a `notaPropiaDe(dataset, fecha, propia)` salvo `id` y `enviada`, con `creado_por` y `firmante` en `nombre_completo`.
  - **Fallida** (con `EMAIL_SOLO_A` o el mecanismo de fallas que ya usa el describe 'fallas, reintentos y concurrencia'):
    - el `anexo_pdf` guardado muestra la nota sin «Pendiente de envío.» ni «No se pudo enviar.»;
    - `seguimientoDe(fuentesDe(...))` la muestra «No se pudo enviar.» y no la cuenta en `avisosDelCiclo`.
  - **Prueba** (:1205 / :1225, `enviarPrueba` de una reiteración): el anexo adjunto dice «Nota Digital N° PRUEBA a DGMIT» y «Nota PRUEBA», y la prueba no inserta filas en `notas_digitales_datasets`, como hoy.
  - **Vista previa:** `previewAnexo({ tipo: 'reiteracion', gestion, hoy })` con datos reales y con datos de ejemplo dice «Nota Digital N° XX a DGMIT» y «Nota XX». Con la reiteración real ya generada ese mismo día, la vista previa no muestra dos reiteraciones de esa fecha.
  - **Vista previa contra la corrida** (:1291-1311): el reemplazo de «N° 2/26» por «N° XX» pasa a reemplazar todas las apariciones del número (`/\b2\/26\b/g` → `XX`). Si la etiqueta de la cinta queda «Nota XX», el test sigue comparando las hojas enteras.
  - **El anexo del aviso no cambia:** ninguna hoja del `anexo_pdf` de un aviso dice «Nota Digital N° 1/26 a DGMIT» (el aviso propio).
  - **El Seguimiento de la pantalla no cambia:** `GET /api/seguimiento/:id` (o `seguimientoDe(fuentesDe(...))`) antes de enviar la reiteración no la muestra como enviada, sino «Pendiente de envío.», o no la muestra si se mira antes de generarla.
- [ ] **Step 2:** con el control de concurrencia, `node --test --test-concurrency=1 tests/notas-motor.test.js tests/notas-api.test.js`. Expected: FAIL en lo nuevo.
- [ ] **Step 3:** implementar lo de **Files**.
- [ ] **Step 4:** mismos archivos. Expected: PASS. Después `node --test tests/notas-seguimiento-anexo.test.js tests/seguimiento-pdf.test.js`.
- [ ] **Step 5:** `npm test` completo. Expected: 0 fallas.
- [ ] **Step 6: Commit** `feat: el anexo de la reiteración muestra la propia reiteración (corrida, prueba y vista previa)`.

---

### Task 4: documentación

**Files:**
- `CLAUDE.md`:
  - en «Requiere nota DGMIT y anexo de la reiteración» (la línea que dice «La hoja no muestra la reiteración que lo acompaña (todavía no existe).»), dice que la hoja muestra la propia reiteración como movimiento más nuevo, contada en los avisos del ciclo y con su marca. Nombra `notaPropiaDe`, `fuentesDeLaNota` y el parámetro `propia` de `seguimientosDeLaNota`, que se suma en memoria, solo en el anexo, con «XX» y «PRUEBA» en la vista previa y la prueba. Dice también que el Seguimiento de la pantalla y la descarga no cambian;
  - suma `notas-seguimiento-anexo.test.js` donde se nombran los tests.
- `README.md`: en la entrada del Changelog «Notas Digitales en hoja oficio (2026-10)» se suma un bullet con la reiteración en su anexo. El bullet del despliegue nombra los archivos que cambian (servicios), sin SQL y con Restart. El título pasa a «Notas Digitales en hoja oficio y la reiteración en su anexo (2026-10)».
- `docs/superpowers/specs/2026-10-20-requiere-nota-y-anexo-reiteracion-design.md`, debajo de la línea 146 («La hoja no muestra la reiteración que la acompaña…») y de la decisión 7: una línea que remita a `2026-10-24-reiteracion-en-su-anexo-design.md` («desde el despliegue de…, la hoja muestra también la reiteración que acompaña»). El texto viejo queda.

- [ ] **Step 1:** escribir los cambios.
- [ ] **Step 2:** `git grep -n "no muestra la reiteración\|todavía no existe"`. Expected: solo menciones históricas con su remisión.
- [ ] **Step 3:** `npm test` completo.
- [ ] **Step 4: Commit** `docs: la reiteración en su propio anexo (CLAUDE.md, README y la spec del 20/10)`.

---

### Task 5: simulación corta y kit (fuera del repo)

- **Simulación** (pedido del usuario):
  - la principal, del 25/10/2026 al 05/01/2027, con la licencia del titular (del 10/12/2026 al 08/01/2027) y la editora como persona autorizada, con su firma real;
  - sin escenas;
  - con los scripts de la simulación anterior (`…\d735cd94-64cf-4b50-ae5b-931afc6a1d31\scratchpad\sim\`), las mismas barreras (captura, bloqueo de red salvo la base, SMTP a Mailpit, `EMAIL_SOLO_A=''`), el bloqueo renombrado (`rpad_notas_digitales_sim_oficio`) y una base nueva, `rpad_sim_oficio_anexo`, armada desde `datospublicos_mcr_rpad`.
  - **Control:** el de siempre (notas en 612 × 1008, anexos en A4, márgenes) más uno nuevo: en cada anexo de reiteración (02/11, 01/12 y 04/01), cada hoja lista su propia nota una sola vez, como movimiento más nuevo, y la marca «Nota n/aa» está en la cinta. Lo demás tiene que salir igual que en la simulación anterior: las mismas 11 notas en los mismos días.
  - **Carpeta del Escritorio** `RPAD-simulacion-notas-oficio`: la corrida anterior pasa entera a `anterior-sin-la-propia-reiteracion/`. Arriba quedan `notas/` (las 11 nuevas, con sus anexos), `comparacion/` (sin cambios) y un `LEEME.html` nuevo que dice qué cambió y dónde está lo anterior.
- **Kit** `RPAD-deploy-notas-hoja-oficio`:
  - los archivos de servicios que cambian contra main (`git diff --stat main -- services`), cada uno sacado de la rama y comparado con el de main: el único cambio tiene que ser el de esta entrega;
  - `PASOS.txt` (ASCII) con la segunda parte, la lista de archivos, la verificación (en «Ver anexo» de una reiteración, cada hoja muestra «Nota Digital N° XX a DGMIT») y la vuelta atrás con todos los archivos de main;
  - las muestras de la simulación nueva.
- [ ] **Step 1:** correr la simulación y el control. Expected: 11 notas, 0 errores, 0 conexiones rechazadas y el control nuevo en verde.
- [ ] **Step 2:** carpeta del Escritorio.
- [ ] **Step 3:** kit, con `PASOS.txt` en ASCII y los zips con rutas `services/…`.
