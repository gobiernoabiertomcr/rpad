# Notas Digitales en hoja oficio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el PDF de la Nota Digital salga en hoja oficio Legal (612 × 1008 pt) de hoy en adelante, sin tocar los PDF A4.

**Architecture:** el alto de la hoja entra al dibujo por un solo lugar, `PAGINA` en `services/notasDigitalesPdf.js`. Todo lo demás (pie, paginación, paso de página, tablas, cierre medido) mide contra `doc.page.height` y los márgenes. Por eso el cambio de producto es esa constante. El trabajo está en que los tests fijen el tamaño nuevo, que protejan los A4 que no cambian y que haya una prueba de punta a punta.

**Tech Stack:** Node 22 (ES modules), PDFKit 0.15.2, `node --test` (`npm test` = `node --test --test-concurrency=1 "tests/*.test.js"`), `tests/pdf-lector.js`, MariaDB en Docker para los tests de integración.

**Spec:** `docs/superpowers/specs/2026-10-24-notas-hoja-oficio-design.md`

## Global Constraints

- Hoja de la nota: Legal exacto, **612 × 1008 pt** (8½ × 14″, 215,9 × 355,6 mm). No `[216 * MM, 356 * MM]`, que da 612,28 × 1009,13.
- `PAGINA` sigue privada del módulo (sin `export`). `DocumentoNota` no gana tamaño por defecto.
- No cambian `services/notasDigitalesAnexo.js`, `services/seguimientoPdf.js`, `services/notasDigitalesSeguimiento.js`, `controllers/reportesController.js` ni ningún otro PDF. Siguen en A4: 595,28 × 841,89.
- La nota se arma igual (decisión del usuario): mismos márgenes (superior: el alto del banner + 9 mm, nunca menos de 25 mm; inferior: 25 mm; laterales: 30 mm), membrete, letra, firma, cierre medido y paginación. Sin marca de agua.
- Las notas ya generadas no se regeneran (`notas_digitales.pdf` guarda los bytes).
- Regla del proyecto: `npm test` completo antes y después de cada cambio de código. Antes de correrlo, comprobar que no esté corriendo la suite de otra sesión. Las bases `rpad_test_<archivo>` tienen nombre fijo y se pisan: `SHOW DATABASES LIKE 'rpad_test%'` tiene que dar vacío, igual que los procesos en `information_schema.PROCESSLIST` con `DB LIKE 'rpad_test%'`.
- Worktree `C:\git\rpad\.claude\worktrees\notas-hoja-oficio`, rama `feat/notas-hoja-oficio`, `.env` con `DB_NAME=rpad_rama_oficio` (base propia) y `PORT=3012`. Nada se escribe en main.
- Sin nombres de personas en archivos versionados. Idioma: español en código, comentarios, tests y docs, con la densidad de comentarios del archivo que se toca.
- Ningún email real. En local todo va a Mailpit. Nunca llamar a `/api/cron/*` contra una base compartida.
- Commits con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Un PDF A4 que cambia de tamaño sin que nadie lo note.** Hoy ningún test fija el alto A4 del anexo del aviso, y el Seguimiento y el anexo de la reiteración no tienen ninguno. Lo cubre la Task 1: cada hoja de `renderAnexo`, `renderSeguimiento` y `renderAnexoDeSeguimiento` mide 595,28 × 841,89.
2. **Una nota de varias hojas con alguna hoja de otro tamaño, o la medida redondeada a 216 × 356 mm.** Hoy el test mira solo la primera coincidencia del `MediaBox`. Lo cubre la Task 2: cada hoja de cada clase de nota mide exactamente 612 × 1008.
3. **La nota que hoy se corta en dos hojas por pocos milímetros.** Con 26 mm más tiene que entrar en una (el caso real del pedido). Lo cubre la Task 2, con el caso del cierre medido que termina entre el límite viejo y el nuevo.
4. **Lo que se guarda y lo que se manda.** El `pdf` guardado de una nota generada por la corrida, el de una prueba y el de la vista previa tienen que salir en oficio, y su `anexo_pdf` en A4. Lo cubre la Task 2, con aserciones en `tests/notas-motor.test.js` y `tests/notas-api.test.js`.
5. **El pie, la paginación y la firma con el alto nuevo.** Que el pie siga a 12,5 mm, la paginación a 17,5 mm, la REF. a 40, 54 o 25 mm según el banner, y que nada baje del margen inferior. Lo cubren los tests de membrete de hoy en `notas-pdf.test.js`: siguen valiendo cuando sus constantes pasan a la hoja nueva (Task 2).

---

### Task 1: `pdf-lector` lee el tamaño de cada hoja y los A4 quedan protegidos

Se hace antes del cambio de la hoja: estos tests tienen que pasar hoy, y seguir pasando después.

**Files:**
- Modify: `tests/pdf-lector.js` (`hojasDelPdf`, :20-37)
- Modify: `tests/notas-anexo.test.js` (el test 'es un PDF A4 con una hoja por dataset…', :261-272)
- Modify: `tests/seguimiento-pdf.test.js` (un test en el describe de `renderSeguimiento` y otro en 'renderAnexoDeSeguimiento: una hoja por dataset, en un solo PDF', :464)

**Interfaces:**
- Produces: `export const tamanosPorHoja = (pdf) => [{ ancho: number, alto: number }]`, una entrada por hoja y en orden, leída del `/MediaBox [x0 y0 x1 y1]` de cada `/Page` (`ancho = x1 - x0`, `alto = y1 - y0`). `hojasDelPdf` pasa a devolver también `ancho` (hoy solo `alto`). `textosPorHoja`, `lineasPorHoja`, `contenidoPorHoja`, `imagenesPorHoja` e `imagenesGuardadas` no cambian de forma.

- [ ] **Step 1: Escribir los tests de A4 que fallan** (fallan porque `tamanosPorHoja` no existe)

En `tests/notas-anexo.test.js`, el test de `renderAnexo` reemplaza la aserción floja de :270-271 (que buscaba `595.2` en todo el archivo) por:

```js
const A4 = { ancho: 595.28, alto: 841.89 };
const enA4 = (tamano) => Math.abs(tamano.ancho - A4.ancho) < 0.01 && Math.abs(tamano.alto - A4.alto) < 0.01;
// …
assert.ok(tamanosPorHoja(pdf).every(enA4), JSON.stringify(tamanosPorHoja(pdf)));
```

En `tests/seguimiento-pdf.test.js`, dos tests nuevos con el mismo `enA4`:
- `'renderSeguimiento: la hoja es A4 (595,28 × 841,89), no la hoja oficio de la nota'`: `tamanosPorHoja(await render(seguimiento(52)))` tiene una entrada y es A4.
- `'renderAnexoDeSeguimiento: todas las hojas son A4, no la hoja oficio de la nota'`: con tres seguimientos (los del test de :744, con `numeroTexto: '9/26'`), son tres entradas y todas A4.

Los dos importan `tamanosPorHoja` de `./pdf-lector.js`.

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/notas-anexo.test.js tests/seguimiento-pdf.test.js`
Expected: FAIL, `tamanosPorHoja` no es una exportación de `pdf-lector.js` (SyntaxError al importar).

- [ ] **Step 3: Implementar `tamanosPorHoja` en `tests/pdf-lector.js`**

La regex del `MediaBox` de `hojasDelPdf` captura los cuatro números (hoy captura solo el cuarto). Cada hoja devuelve `ancho` y `alto` como diferencias. `imagenesPorHoja` sigue usando `alto`. Se actualiza el comentario de cabecera del archivo y el de `hojasDelPdf`.

- [ ] **Step 4: Correr y ver que pasan**

Run: `node --test tests/notas-anexo.test.js tests/seguimiento-pdf.test.js tests/notas-pdf.test.js`
Expected: PASS (35 + 66 + 2 nuevos en seguimiento-pdf; notas-pdf sigue en 130/130).

- [ ] **Step 5: Comprobar que los tests nuevos detectan el cambio**

En `services/seguimientoPdf.js:664`, cambiar a mano y por un momento `size: 'A4'` por `size: 'LEGAL'`. Correr `node --test tests/seguimiento-pdf.test.js`: los dos tests nuevos tienen que fallar. Volver el archivo atrás con `git checkout services/seguimientoPdf.js` y comprobar con `git diff --stat` que solo cambiaron los tres archivos de tests.

- [ ] **Step 6: `npm test` completo**

Comprobar antes que no corra la suite de otra sesión (Global Constraints).
Run: `npm test`
Expected: 0 fallas. La línea de base de la rama era 3260 tests: 3255 pasan y 5 se saltean. Ahora son 2 más.

- [ ] **Step 7: Commit**

```bash
git add tests/pdf-lector.js tests/notas-anexo.test.js tests/seguimiento-pdf.test.js
git commit -m "test: pdf-lector lee el tamaño de cada hoja; los anexos y el Seguimiento quedan fijos en A4"
```

---

### Task 2: la Nota Digital sale en hoja oficio Legal

**Files:**
- Modify: `services/notasDigitalesPdf.js:8` (`PAGINA`) y su comentario
- Modify: `services/notasDigitalesContenido.js:224` (comentario de `PROPORCIONES_EXTERNA`: "7 filas en la primera hoja" pasa a 8, en la hoja oficio)
- Modify: `tests/notas-pdf.test.js` (:13-15 constantes, :72-77 test del `MediaBox`, :390-392 filas de la primera hoja, el describe del cierre medido :1395, más tests nuevos)
- Modify: `tests/notas-motor.test.js` (describe 'anexo de los avisos (spec 6.7)', :879, y el test de :1116 de la reiteración)
- Modify: `tests/notas-api.test.js` (test del PDF de la vista previa, :399)

**Interfaces:**
- Consumes: `tamanosPorHoja(pdf)` de la Task 1.
- Produces: nada que otra tarea consuma. `renderPdf` mantiene su firma.

- [ ] **Step 1: Escribir los tests de `notas-pdf.test.js` que fallan**

1. Constantes (:13-15): `ANCHO_HOJA = 612` y `ALTO_HOJA = 1008` (Legal). Se agregan `const HOJA_OFICIO = { ancho: 612, alto: 1008 }`, `const LIMITE_VIEJO = 330 * MM - 25 * MM` (dónde terminaba el contenido en la hoja de antes) y el ayudante `const enOficio = (t) => cerca(t.ancho, 612) && cerca(t.alto, 1008)`. `MM` queda para los márgenes. Las posiciones que miden los tests de membrete (`tope`, `LIMITE` del cierre medido) quedan con el alto nuevo.
2. Test `'genera un PDF oficio con el número en el título'` (:72): la regex pasa a `/\/MediaBox \[0 0 612 1008\]/`, y además `assert.ok(tamanosPorHoja(pdf).every(enOficio))`.
3. Reiteración real del 02/11 (:390-392): `assert.equal(primeras.length, 8, …)`. El comentario dice que en la hoja oficio entran 8 filas: 7 en la de 330 mm, y 4 con la tabla de 8 columnas.
4. Describe nuevo `'renderPdf: hoja oficio Legal (spec 2026-10-24-notas-hoja-oficio)'`:
   - `'todas las hojas de todas las notas miden 612 × 1008, con membrete y sin él'`. Recorre estos casos:
     - aviso externo y aviso interno, `nota(1)` y `nota(60)`;
     - reiteración externa e interna, `nota(60, { tipo: 'reiteracion' })` y la de `gestion: 'interna'`;
     - la autorización y la auditoría completa (las armadas como en el describe del cierre medido, :1406-1426, sin recortar apartados);
     - el aviso con dos firmas y la leyenda (`firma` con `presentante` y `leyenda`, como `FIRMAS[2]` del cierre medido).

     Cada caso va con `{}` y con `{ membreteImagen: BANNER, membretePie: PIE }`. Afirmaciones: `tamanosPorHoja(pdf).every(enOficio)`, y que el conjunto de casos incluye al menos uno de una hoja y uno de tres o más.
   - `'una nota que en la hoja de 330 mm pasaba a una segunda hoja ahora entra en una'`. Usa el aviso externo con una firma con imagen y el método del cierre medido (`fin`, `conRelleno` y `RENGLON`, que hoy son locales de ese describe: se suben al nivel del archivo para reusarlos). Elige el `k` más chico con `finSinRelleno + k * RENGLON * 12 > LIMITE_VIEJO + 1.5` y comprueba que también cumpla `<= ALTO_HOJA - 25 * MM - 1.5`. Afirma `paginas(pdf) === 1` y `fin(pdf) > LIMITE_VIEJO` (las dos medidas desde arriba de la hoja: lo escrito pasa del límite de la hoja vieja y entra en la nueva).

- [ ] **Step 2: Escribir las aserciones de integración que fallan**

- `tests/notas-motor.test.js`, test `'el aviso de la corrida adjunta la nota y el anexo guardado…'` (:879): después de leer `pdf` y `anexo`, `assert.ok(tamanosPorHoja(pdf).every(enOficio))` y `assert.ok(tamanosPorHoja(anexo).every(enA4))`.
- Mismo archivo, test de :1116 (reiteración): igual con `reiteracion.pdf` (oficio) y `reiteracion.anexo_pdf` (A4).
- Mismo archivo, la prueba de :916 (`'la prueba de un aviso adjunta Anexo-Nota-Digital-PRUEBA.pdf…'`): el adjunto `Nota-Digital-PRUEBA.pdf` mide oficio y el anexo, A4.
- `tests/notas-api.test.js`, test del PDF de la vista previa (:399): `assert.ok(tamanosPorHoja(res.body).every(enOficio))`.

En cada archivo, `enOficio` y `enA4` se definen arriba con tolerancia de 0,01, junto a las constantes que ya tiene, y `tamanosPorHoja` se importa de `./pdf-lector.js`.

- [ ] **Step 3: Correr y ver que fallan**

Run: `node --test tests/notas-pdf.test.js`
Expected: FAIL. Fallan el test del `MediaBox` y el nuevo de todas las hojas (miden 612,28 × 935,43), los de membrete que usan `tope` (REF. corrida unos 73 pt), «8 filas» (da 7) y el de la hoja vieja (sale en 2).
Docker: comprobar que no corra otra suite y correr `node --test tests/notas-motor.test.js tests/notas-api.test.js`. Expected: FAIL solo en las aserciones nuevas de oficio. Las de A4 pasan.

- [ ] **Step 4: Implementar**

En `services/notasDigitalesPdf.js:8`, `PAGINA = [612, 1008]`. Es Legal exacto, 8½ × 14 pulgadas a 72 puntos. El comentario dice que es la hoja oficio en la que imprime la Municipalidad, que no se escribe en milímetros porque `216 * MM, 356 * MM` daría 612,28 × 1009,13 y una impresora lo tomaría como tamaño personalizado, y que los anexos y los demás PDF fijan su A4 aparte. Si cambia el comentario de la línea 1 o el de :121, que siga diciendo «hoja oficio». En `services/notasDigitalesContenido.js:224`, el comentario pasa a «8 filas en la primera hoja oficio».

- [ ] **Step 5: Correr y ver que pasan**

Run: `node --test tests/notas-pdf.test.js tests/notas-anexo.test.js tests/seguimiento-pdf.test.js`
Expected: PASS. notas-pdf: 130 de antes más los nuevos.
Docker: `node --test tests/notas-motor.test.js tests/notas-api.test.js`. Expected: PASS.

- [ ] **Step 6: `npm test` completo**

Comprobar antes que no corra otra suite.
Run: `npm test`
Expected: 0 fallas.

- [ ] **Step 7: Commit**

```bash
git add services/notasDigitalesPdf.js services/notasDigitalesContenido.js tests/notas-pdf.test.js tests/notas-motor.test.js tests/notas-api.test.js
git commit -m "feat: la Nota Digital sale en hoja oficio Legal (612 x 1008 pt); los anexos siguen en A4"
```

---

### Task 3: documentación

**Files:**
- Modify: `CLAUDE.md`. En «Firma de las Notas Digitales y licencia del firmante», después del bullet «El cierre se mide de verdad», un bullet «Hoja de la nota (spec 2026-10-24-notas-hoja-oficio)». Dice:
  - el PDF de la nota sale en oficio Legal, 612 × 1008 pt (`PAGINA`, privada; no `216 × 356 mm`);
  - los márgenes y el membrete no cambiaron;
  - los anexos, el Seguimiento y los reportes siguen en A4, cada uno con su `size: 'A4'` (`DocumentoNota` no tiene tamaño);
  - las notas generadas antes del despliegue conservan su PDF de 216 × 330;
  - los tests: `tamanosPorHoja` de `tests/pdf-lector.js`, la hoja oficio en `notas-pdf.test.js` y el A4 en `notas-anexo.test.js` y `seguimiento-pdf.test.js`.
- Modify: `README.md`. Entrada nueva al principio del Changelog (:785), `### Notas Digitales en hoja oficio (2026-10)`, con el estilo de las de al lado:
  - qué cambia (el PDF de la nota en oficio Legal, 26 mm más por hoja, la nota se arma igual);
  - qué no cambia (anexos y demás PDF en A4, notas ya generadas, también pendientes o fallidas);
  - «Solo `services/notasDigitalesPdf.js`; Restart, sin SQL ni Run NPM Install».
- Modify: `docs/superpowers/specs/2026-10-12-notas-digitales-design.md`. Después del renglón «hoja oficio de 216 × 330 mm;» (:186), un subrenglón: «desde el 24/10/2026, oficio Legal de 612 × 1008 pt (spec `2026-10-24-notas-hoja-oficio-design.md`); las notas anteriores conservan su PDF de 216 × 330». El texto viejo no se borra.

- [ ] **Step 1: Escribir los tres cambios**
- [ ] **Step 2: Comprobar que no quedan menciones vivas del tamaño viejo**

Run: `git grep -n -E "330 ?mm|216 × 330|935\.43" -- ':!docs/superpowers/plans' ':!docs/superpowers/specs/2026-10-12-notas-digitales-design.md'`
Expected: solo menciones históricas o explicativas (CLAUDE.md y README dicen que las notas viejas conservan 216 × 330, y la spec nueva). Ningún código ni test con 330.

- [ ] **Step 3: `npm test` completo**

Ningún test lee CLAUDE.md ni el README, pero se corre igual porque es la regla del proyecto. Comprobar antes que no corra otra suite.
Run: `npm test`. Expected: 0 fallas.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md docs/superpowers/specs/2026-10-12-notas-digitales-design.md
git commit -m "docs: Notas Digitales en hoja oficio (CLAUDE.md, README y la spec de las notas)"
```

---

### Task 4: simulación de punta a punta, del 25/10/2026 al 05/01/2027 (fuera del repo)

No se versiona nada. Scripts en el scratchpad de la sesión (`…\d735cd94-64cf-4b50-ae5b-931afc6a1d31\scratchpad\sim\`); muestras en `C:\Users\Mariano\Desktop\RPAD-simulacion-notas-oficio\`.

**Molde (copiar y adaptar, rutas bajo `C:\Users\Mariano\AppData\Local\Temp\claude\C--git-rpad\`):**
- `40fd4306-7dad-4c1e-80c9-2dd5bbdfdd62\scratchpad\sim\`: `reloj.mjs`, `dia.mjs` y `preparar.sh`;
- `bddc2165-5c42-4cff-83de-f079cc906b4f\scratchpad\sim\`: `orquestador.mjs` (el que tiene `SIM_FASES`), `accion.mjs` y `escenario-licencia.sh`;
- `eef718a6-e2d9-4a17-8c2b-1fb94d2825fa\scratchpad\sim\`: `armar-carpeta.py`, `pdf-texto.py` y `servidor-simulacion.mjs`.

Todos tienen escrito `C:/git/rpad`: el `createRequire` y el `database.js` de `reloj.mjs`, los imports de `dia.mjs` y `accion.mjs`, y el `cwd` del orquestador. Pasan a `C:/git/rpad/.claude/worktrees/notas-hoja-oficio`, con el código de esta rama.

**Requisitos:**
- **Bases** (nombres nuevos; las `rpad_sim_*` que ya existen no se tocan):
  - `rpad_sim_oficio`, la corrida principal;
  - `rpad_sim_oficio_auditoria` y `rpad_sim_oficio_autorizacion`, las escenas.

  Cada una se arma con `mariadb-dump datospublicos_mcr_rpad | mariadb <base>` dentro de `rpad-db`, o importando `C:\Users\Mariano\Desktop\datospublicos_mcr_rpad.sql`, el dump del 24/10 a las 16:45. `preparar.sh` aborta si la base no empieza con `rpad_sim_oficio` (hace `DROP DATABASE`).
- **Barreras** (decisión del usuario; las tres en cada proceso):
  1. la captura en nodemailer (`reloj.mjs`);
  2. `SMTP_HOST=127.0.0.1` y `SMTP_PORT=1025` en el entorno, con el total de Mailpit (`curl -s "http://127.0.0.1:8025/api/v1/messages?limit=1"`) medido antes y después: tiene que ser el mismo;
  3. en `reloj.mjs`, `net.connect`, `net.createConnection`, `net.Socket.prototype.connect` y `tls.connect` rechazan todo destino que no sea `127.0.0.1`, `::1` o `localhost`.

  `EMAIL_SOLO_A=''` explícito. Las variantes corren una detrás de la otra: `GET_LOCK` es de todo el servidor de base.
- **Corrida principal:**
  - el 25/10 a las 10:00 (hora argentina), `crearLicencia` como el titular (usuario 1): licencia del 10/12/2026 al 08/01/2027 con `autorizado_id: 2`, la editora con su firma real (`accion.mjs licencia` suma `autorizado_id`);
  - después, `node orquestador.mjs 2026-10-25 2027-01-05` con las fases de las 8:15 y las 14:00.

  Se espera (informe del 24/10, con los datos de hoy):
  - 02/11: aviso interno y reiteraciones interna y externa;
  - 01/12: reiteraciones;
  - 09/12, la víspera: avisos interno y externo anticipados, con la autorización;
  - 22/12: aviso externo en su fecha, con dos firmas, «Este pedido ya se había adelantado…» y emails a las áreas;
  - 30/12: aviso interno con dos firmas;
  - 04/01/2027: reiteraciones con dos firmas.

  Si sale distinto, se averigua el porqué antes de seguir.
- **Escena de auditoría** (`rpad_sim_oficio_auditoria`): igual que la principal, más el 26/10 a las 10:00 un cambio inocuo propuesto por el titular (observaciones de un dataset) que nadie aprueba. Se espera la nota de auditoría al tercer día hábil (los recordatorios de las 14:00 del día 1 y del día 2), su reiteración cada 5 días hábiles y, durante la licencia, con dos firmas.
- **Escena de autorización aparte** (`rpad_sim_oficio_autorizacion`): la licencia del titular se carga el 25/10 sin persona autorizada. El 09/12 a las 10:00 (después de la corrida), `editarLicencia` como el titular le suma `autorizado_id: 2`. Se espera la nota de autorización el 10/12.
- **Control automático de cada PDF capturado** (un script `controlar.mjs` que importa `tests/pdf-lector.js` del worktree): cada `Nota-Digital-*.pdf` mide 612 × 1008 en todas sus hojas, cada `Anexo-*.pdf` mide 595,28 × 841,89, y en las notas ninguna línea baja del margen de 25 mm, salvo el pie y la paginación, ni sale del margen derecho. Imprime una tabla (fecha, número, tipo, gestión, hojas, firmas, resultado) y termina con código 1 si algo falla.
- **Carpeta para el usuario** `RPAD-simulacion-notas-oficio`:
  - `LEEME.html` (o `.txt`), con qué se hizo, el calendario día por día, las cifras, qué se controló y los hallazgos;
  - `notas/`, con `AAAA-MM-DD - Nota-Digital-N-AA.pdf` y sus anexos;
  - `escenas/auditoria/` y `escenas/autorizacion/`;
  - `emails-a-las-areas/<día> <área>.html`, uno por email (corrige el error del molde, que los pisaba);
  - `comparacion/`, la misma nota (la reiteración externa del 02/11 de la simulación) en 216 × 330, generada con main en una base aparte o con el mismo contenido y la hoja vieja, y en oficio.

- [ ] **Step 1:** copiar y adaptar los scripts (rutas, bases, guardas, barreras, `autorizado_id`).
- [ ] **Step 2:** preparar las tres bases y anotar el total de Mailpit.
- [ ] **Step 3:** correr la principal, la de auditoría y la de autorización, una detrás de la otra (en segundo plano: cada una tarda varios minutos).
- [ ] **Step 4:** correr `controlar.mjs` sobre las tres salidas. Expected: 0 fallas. Mailpit, el mismo total.
- [ ] **Step 5:** armar la carpeta del Escritorio y revisarla abriendo el `LEEME` en el navegador.

---

### Task 5: kit de despliegue (fuera del repo)

`C:\Users\Mariano\Desktop\RPAD-deploy-notas-hoja-oficio\`, con la estructura de `RPAD-deploy-firma-nombre-negrita`:
- `PASOS.txt` (ASCII), con las secciones de los kits anteriores:
  - título con la fecha y «(todo desde cPanel, sin terminal)»;
  - REQUISITO: las Notas DGMIT ya en producción;
  - qué incluye y qué NO cambia;
  - «Cambia 1 archivo (0 nuevos y 1 reemplazo) … Sin SQL ni npm, CON Restart. Las Tareas Cron no cambian.»;
  - CUÁNDO: lejos de las 8:15 y de las 14:00;
  - PROBADO: los tests y la simulación;
  - pasos:
    - 0) ANTES: en Correos → Libro, que no haya notas pendientes ni fallidas; si hay, saldrán en 216 × 330;
    - 1) BACKUP;
    - 2) SUBIR (zip en `/home/datospublicos/rpad` y «Extraer ahí mismo»);
    - 3) RESTART;
    - 4) VERIFICAR, solo mirando: en Correos, «Ver PDF» sale en oficio (en el visor, Propiedades del documento → tamaño de página 21,59 × 35,56 cm);
    - SI ALGO SALE MAL: subir `vuelta-atras/archivos-anteriores.zip` y Restart.
- `archivos-notas-hoja-oficio/services/notasDigitalesPdf.js` y el mismo árbol en `.zip`. **Se arma con el archivo de main en el momento de armar el kit**: si para entonces otra entrega cambió `notasDigitalesPdf.js` en main, el kit lleva el de main con el cambio de `PAGINA`.
- `muestras/`: las de la Task 4, o un link a la carpeta de la simulación.
- `vuelta-atras/archivos-anteriores.zip`: el `notasDigitalesPdf.js` de main de hoy (8b25ae0), o el de producción si es otro.

- [ ] **Step 1:** armar el kit con `git show <ref>:services/notasDigitalesPdf.js` (el archivo nuevo y el anterior).
- [ ] **Step 2:** comprobar que `PASOS.txt` es ASCII (`grep -P '[^\x00-\x7F]' PASOS.txt` vacío) y que nombra el archivo, y que el zip tiene el árbol `services/notasDigitalesPdf.js`.
- [ ] **Step 3:** comparar el archivo del kit con el de la rama: la única diferencia con main es `PAGINA` y su comentario.
