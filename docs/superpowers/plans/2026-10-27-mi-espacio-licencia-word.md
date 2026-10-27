# Mi espacio: la nota de licencia en Word — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. En el RPAD, todos los subagentes (implementar, revisar y corregir) van con Opus.

**Goal:** Al guardar una licencia en Mi espacio, el modal pasa a un segundo paso con la nota a la vista y «Descargar Word», y cada licencia de la lista tiene «Word».

**Architecture:** Un módulo puro arma la nota como estructura y su HTML (`services/miEspacioNota.js`); otro arma el .docx desde esa misma estructura con la librería `docx` (`services/miEspacioNotaWord.js`). Dos rutas nuevas de Mi espacio (`GET …/licencias/:id/nota` y `…/word`) leen la licencia, su fecha de guardado en hora argentina y la firma de la persona. La página reemplaza el cierre del modal por el segundo paso y baja el Word con un `fetch` propio que lee el `Content-Disposition`.

**Tech Stack:** Node 22 + Express (ES Modules), MariaDB (mysql2/promise), `docx` 8.5 (ya instalada), vanilla JS, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-27-mi-espacio-licencia-word-design.md` (aprobada el 27/10/2026). Las maquetas, en `docs/superpowers/specs/2026-10-27-mi-espacio-licencia-word-mockups/` (versión C; `css/maqueta.css` es la base del CSS del segundo paso).

## Global Constraints

- Ningún nombre real ni dato de producción en el código, los tests ni los docs (el repositorio es público). La nota va al cargo, sin nombre.
- Sin CDN ni librerías nuevas en el navegador (la CSP no deja), y ninguna dependencia nueva en el servidor.
- Hoja A4 11906 × 16838 twips (literales), márgenes de 2,5 cm arriba y abajo (1417) y 3 cm a los costados (1701), Arial 11 (`size: 22`), interlineado `line: 276`, `lineRule: 'auto'`, `after: 0`.
- Los textos de la nota, al pie de la letra los de la sección 2 de la spec.
- Fechas como texto `'AAAA-MM-DD'`; hoy es `hoyArgentina()`; nunca `Date` local en lo puro.
- Respuestas `{ success, data?, error? }`; consultas parametrizadas con `?`.
- `mi-espacio.js`: lo puro primero; lo que toca el DOM o la API, al final; al cargarse solo declara.
- Contraste de 4,5:1 o más, foco visible y sin desplazamiento horizontal a 375 px.
- No se escribe en la base `datospublicos_mcr_rpad`: para probar a mano, una copia propia con datos inventados, que se borra al cerrar. Nunca `/api/cron/*`, ningún email real.
- `npm test` completo antes y después (necesita `docker compose up -d` y `RPAD_TESTS_DB_LOCAL=1`). Las suites de integración usan bases de nombre fijo: nunca dos a la vez.
- El Word del Generador de Notas y el de las Notas Digitales no cambian: `services/notasWord.js` solo gana un `export`.

## Review Focus

1. **Un guardado entre las 21:00 y las 23:59 de Argentina:** la base guarda los TIMESTAMP en UTC; la nota tiene que salir con el día argentino, no con el siguiente. Test en la Task 4.
2. **Un nombre o un cargo con `<`, `&`, comillas o caracteres que el XML no admite:** la vista va escapada y el Word se abre sano. Tests en las Tasks 2 y 3.
3. **Una licencia que empieza un sábado o un feriado, un solo día hábil entre fechas distintas, o ningún día hábil** (un feriado cargado después): primer día hábil, singular y 409. Tests en las Tasks 2 y 4.
4. **La respuesta de `…/nota` que llega cuando el modal ya se cerró** (o se guardó otra licencia): se descarta, no pinta nada. Test en la Task 6.
5. **Un nombre de archivo con tildes** («Atención médica», «Médica extraordinaria»): la página lo toma del `filename*` en UTF-8, no del `filename` en ASCII. Test en la Task 5.

---

### Task 1: Leer el main de ese momento y ajustar el plan

Esta función va en la cola después del Resumen «Titular», que cambia `public/mi-espacio.html` y `public/js/mi-espacio.js`. El plan se escribió sobre main 780e39b.

**Files:**
- Modify: este plan (solo las referencias que cambiaron)

- [ ] **Step 1:** Crear la rama de trabajo desde el main de ese momento (`git log --oneline -5 main`), en un worktree propio, y traerle con un merge la rama `claude/mi-espacio-licencia-word`, que solo tiene los docs (la spec, las maquetas y este plan). Confirmar que el merge del Resumen «Titular» ya está en main. Si no está, avisarle a la coordinadora (`local_62853c2f-ecfd-4cf2-bc66-93f666633e21`) y esperar.
- [ ] **Step 2:** Volver a ubicar en el main nuevo lo que este plan nombra y anotar las líneas que cambiaron:
  - `guardarLicencia`, `FORMULARIOS`, `volverAPedirTodo`, `respaldoDelFoco`, `devolverElFoco`, `avisarLaRespuesta`, `irAlLogin`, `abrirLicencia`, `cerrarModal`, `alTocarLicencias` y `htmlDeFilaDeLicencia` (`public/js/mi-espacio.js`);
  - `#modal-licencia` (`public/mi-espacio.html`);
  - `filaDeLicencia` y `filasDeLicencias` (`services/miEspacioResumen.js`);
  - `contextoDe`, `licenciaDe` y `personaDe` (`services/miEspacioDatos.js`);
  - `vinculosDe` (`services/miEspacioPaso.js`);
  - `VERSION_MI_ESPACIO` (`tests/paginas.test.js`) y `RUTAS_MI_ESPACIO` (`tests/permisos.test.js`);
  - los tests del frontend que esperan que el modal se cierre al guardar (en 780e39b, alrededor de las líneas 2092, 2146, 2474 y 3158 de `tests/mi-espacio-frontend.test.js`).
- [ ] **Step 3:** Si algo del main nuevo choca con una decisión de la spec (no con un nombre o una línea), preguntárselo a la coordinadora antes de seguir.
- [ ] **Step 4:** Correr la suite completa y anotar el total de tests en verde (la línea de base).

Run: `npm test`
Expected: todo en verde; anotar «tests N, pass N».

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-10-27-mi-espacio-licencia-word.md
git commit -m "docs(licencia-word): el plan ajustado al main de hoy"
```

---

### Task 2: La nota, pura

**Files:**
- Create: `services/miEspacioNota.js`
- Test: `tests/mi-espacio-nota.test.js`

**Interfaces:**
- Consumes: `diasHabilesDe(desde, hasta, feriados)` y `diaDeLaSemana(fecha)` (`services/feriadosReglas.js`); `formatoLargo(iso)` y `formatoCorto(iso)` (`services/notasDigitalesCalendario.js`); `RENGLON_FIRMA_CONTRATADO` o `renglonesDeFirma` (`services/notasDigitalesContenido.js`).
- Produces:
  - `TIPOS_CON_NOTA`: los ocho tipos, en el orden de `TIPOS_LICENCIA`, sin `uso_autorizado`.
  - `NOMBRES_DEL_ARCHIVO`: `{ vacaciones: 'Licencia anual ordinaria', franquicia: 'Franquicia', estudios: 'Estudios', medica: 'Atención médica', familiar: 'Atención del grupo familiar', medica_extraordinaria: 'Médica extraordinaria', franco: 'Franco compensatorio', horas_a_favor: 'Horas a favor' }`.
  - `MENSAJES_NOTA`: `{ sinNota: 'Esta licencia no tiene nota.', sinDiasHabiles: 'Entre esas fechas ya no hay ningún día hábil: corregí la licencia para bajar la nota.', error: 'Error al armar la nota' }`.
  - `enLetras(n: number, genero: 'm' | 'f') => string`, de 1 a 999 («un»/«una», «veintiún»/«veintiuna»).
  - `textoDeHoras(horas: number) => string`: «una (1) hora», «tres (3) horas», «media hora (0,5)», «una hora y media (1,5)», «dos horas y media (2,5)».
  - `notaDeLicencia(licencia, { fecha, persona, feriados }) => { nota } | { error: 'sinNota' | 'sinDiasHabiles' }`, con `licencia = { tipo, desde, hasta, horas }`, `fecha = 'AAAA-MM-DD'` (el día de la última vez que se guardó), `persona = { nombre, cargo, vinculo }` y `feriados` el Set de `contextoDe`. `nota = { fecha, destinatario: [string, string], sd, saludo, cuerpo, cierre, firma: Array<{ texto, chico }>, nombre }`. Nunca tira.
  - `htmlDeLaNota(nota) => string`: la hoja, con todo texto escapado (`&`, `<`, `>`, `"`, `'`), con las clases `me-hoja`, `me-hoja-texto`, `derecha`, `sangria`, `justificado`, `sd`, `firma` y `chico` (las de `.p2-hoja` de la maqueta, renombradas al prefijo de la página).
  - `aclaracionDeLaNota(fecha) => string`: «Lleva la fecha del 27/10/2026, la última vez que guardaste un cambio en la licencia. Se baja en Word, para imprimir y firmar.».

- [ ] **Step 1: Write the failing tests** (`tests/mi-espacio-nota.test.js`, puro, sin base). Casos, con `PERSONA = { nombre: 'Lucía Fernández', cargo: 'Jefa de División Datos Abiertos', vinculo: 'planta_permanente' }`, `FERIADOS = new Set(['2026-11-23'])` y `fecha: '2026-10-27'`:

```js
const PIDO = 'Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar ';
const cuerpo = (licencia) => notaDeLicencia(licencia, { fecha: '2026-10-27', persona: PERSONA, feriados: FERIADOS }).nota.cuerpo;

it('vacaciones: solo los días hábiles y desde cuándo', () => {
  assert.equal(cuerpo({ tipo: 'vacaciones', desde: '2026-11-16', hasta: '2026-11-27', horas: null }),
    `${PIDO}el usufructo de nueve (9) días hábiles correspondientes a mi licencia anual ordinaria, a partir del día lunes 16 de noviembre de 2026.`);
});
it('franquicia', () => {
  assert.equal(cuerpo({ tipo: 'franquicia', desde: '2026-11-04', hasta: '2026-11-04', horas: 3 }),
    `${PIDO}el usufructo de tres (3) horas de franquicia para trámites personales el día miércoles 4 de noviembre de 2026.`);
});
it('estudios, atención médica, grupo familiar (un día) y médica extraordinaria', () => {
  assert.equal(cuerpo({ tipo: 'estudios', desde: '2026-11-16', hasta: '2026-11-17', horas: null }),
    `${PIDO}licencia por examen por dos (2) días hábiles, a partir del día lunes 16 de noviembre de 2026.`);
  assert.equal(cuerpo({ tipo: 'medica', desde: '2026-11-12', hasta: '2026-11-13', horas: null }),
    `${PIDO}licencia por atención médica por dos (2) días hábiles, a partir del día jueves 12 de noviembre de 2026.`);
  assert.equal(cuerpo({ tipo: 'familiar', desde: '2026-11-20', hasta: '2026-11-20', horas: null }),
    `${PIDO}licencia por atención del grupo familiar por un (1) día hábil, el día viernes 20 de noviembre de 2026.`);
  assert.equal(cuerpo({ tipo: 'medica_extraordinaria', desde: '2027-03-01', hasta: '2027-03-12', horas: null }),
    `${PIDO}licencia médica extraordinaria por diez (10) días hábiles, a partir del día lunes 1 de marzo de 2027.`);
});
it('franco: las horas extras de dos meses antes, también cruzando el año', () => {
  assert.equal(cuerpo({ tipo: 'franco', desde: '2026-12-14', hasta: '2026-12-14', horas: null }),
    `${PIDO}el usufructo del franco compensatorio correspondiente a las horas extras realizadas en octubre de 2026, el día lunes 14 de diciembre de 2026.`);
  assert.match(cuerpo({ tipo: 'franco', desde: '2027-01-15', hasta: '2027-01-15', horas: null }), /realizadas en noviembre de 2026, el día viernes 15 de enero de 2027\.$/);
});
it('horas a favor: el mes anterior y la concordancia de las medias', () => {
  assert.equal(cuerpo({ tipo: 'horas_a_favor', desde: '2026-10-15', hasta: '2026-10-15', horas: 2.5 }),
    `${PIDO}el usufructo de dos horas y media (2,5) a favor, correspondientes a las horas extras realizadas en septiembre de 2026, el día jueves 15 de octubre de 2026.`);
  assert.match(cuerpo({ tipo: 'horas_a_favor', desde: '2026-10-15', hasta: '2026-10-15', horas: 0.5 }), /media hora \(0,5\) a favor, correspondiente a las horas/);
  assert.match(cuerpo({ tipo: 'horas_a_favor', desde: '2026-10-15', hasta: '2026-10-15', horas: 1 }), /una \(1\) hora a favor, correspondiente a las horas/);
  assert.match(cuerpo({ tipo: 'horas_a_favor', desde: '2026-10-15', hasta: '2026-10-15', horas: 1.5 }), /una hora y media \(1,5\) a favor, correspondiente a las horas/);
  assert.match(cuerpo({ tipo: 'horas_a_favor', desde: '2027-01-15', hasta: '2027-01-15', horas: 1 }), /realizadas en diciembre de 2026/);
});
```

  Más, en el mismo archivo:
  - **el primer día hábil:** vacaciones del sábado 2026-10-31 al viernes 2026-11-06 dicen «cinco (5) días hábiles … a partir del día lunes 2 de noviembre de 2026»;
  - **un solo día hábil entre fechas distintas:** estudios del 2026-11-20 al 2026-11-23, con `FERIADOS` que tiene el 23, dicen «por un (1) día hábil, el día viernes 20 de noviembre de 2026»; vacaciones de un día hábil dicen «un (1) día hábil correspondiente a mi licencia anual ordinaria, el día …»;
  - **ningún día hábil:** estudios del 2026-11-21 al 2026-11-22 dan `{ error: 'sinDiasHabiles' }`; un franco en un día que pasó a feriado sigue teniendo nota (no cuenta días);
  - **el uso autorizado** da `{ error: 'sinNota' }`, y un tipo desconocido también;
  - **`enLetras`:** 1 'm' → 'un', 1 'f' → 'una', 21 'm' → 'veintiún', 30 → 'treinta', 45 'm' → 'cuarenta y cinco', 100 → 'cien', 101 'm' → 'ciento un';
  - **las partes fijas:** `fecha` 'Comodoro Rivadavia, 27 de octubre de 2026'; `destinatario` ['Al Señor Director General de', 'Modernización e Investigación Territorial']; `sd` 'S               /               D' (15 espacios a cada lado); `saludo` 'De mi mayor consideración:'; `cierre` 'Sin otro particular, saludo a Ud. atentamente.';
  - **la firma:** de planta, `[{ texto: 'Lucía Fernández', chico: false }, { texto: 'Jefa de División Datos Abiertos', chico: false }]`; de contrato, con `{ texto: 'Personal contratado, cumpliendo funciones de', chico: true }` en el medio; sin cargo (null o ''), solo el nombre, también en un contratado; sin vínculo (null), como planta;
  - **el nombre:** 'Nota de licencia - Licencia anual ordinaria - 2026-11-16.docx' (con el `desde`, no el primer día hábil);
  - **el HTML:** un nombre `'Ana <b>&</b> "Luz"'` sale escapado en `htmlDeLaNota` y ningún `<b>` crudo;
  - **`aclaracionDeLaNota('2026-10-27')`:** el texto de la Interfaz;
  - **nunca tira:** `notaDeLicencia(null, {})`, fechas inválidas y horas null dan `{ error: … }`, sin excepción.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/mi-espacio-nota.test.js`
Expected: FAIL (no existe `services/miEspacioNota.js`).

- [ ] **Step 3: Implement `services/miEspacioNota.js`** con las firmas de la Interfaz. La referencia de los textos es `js/nota-licencia.js` de la maqueta, con dos diferencias de la spec: «a partir del día» y el singular usan los días hábiles de `diasHabilesDe` (el primero, y la cantidad), y la concordancia de las medias va por la palabra («hora» → «correspondiente», «horas» → «correspondientes»). Comentarios en español, como `miEspacioReglas.js`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/mi-espacio-nota.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/miEspacioNota.js tests/mi-espacio-nota.test.js
git commit -m "feat(licencia-word): la nota de licencia como estructura y su HTML, pura"
```

---

### Task 3: El Word

**Files:**
- Create: `services/miEspacioNotaWord.js`
- Modify: `services/notasWord.js` (solo `export` en `textoParaWord`)
- Test: `tests/mi-espacio-nota-word.test.js`

**Interfaces:**
- Consumes: `nota` de `notaDeLicencia` (Task 2); `textoParaWord(texto) => string` (`services/notasWord.js`, ahora exportada).
- Produces: `renderNotaDocx(nota) => Promise<Buffer>`; `HOJA_DE_LA_NOTA = { ancho: 11906, alto: 16838, arriba: 1417, abajo: 1417, izquierda: 1701, derecha: 1701 }`; `TIPO_WORD` (el MIME de Word, el mismo que `controllers/notasController.js`).

- [ ] **Step 1: Write the failing tests** (`tests/mi-espacio-nota-word.test.js`, puro, abre el .docx con JSZip como `tests/notas-word.test.js`). Con la nota de vacaciones de la Task 2:
  - `word/document.xml` tiene `<w:pgSz w:w="11906" w:h="16838"/>` y `<w:pgMar w:top="1417" w:right="1701" w:bottom="1417" w:left="1701"` (aceptar el orden de atributos que escriba `docx`);
  - `word/styles.xml`, en `docDefaults`: `Arial` y `<w:sz w:val="22"/>`, y en `pPrDefault` `w:line="276"` con `w:lineRule="auto"` y `w:after="0"`;
  - no hay `word/header*.xml` ni `word/footer*.xml`;
  - los textos, en orden: la fecha (en un párrafo con `<w:jc w:val="right"/>`), las dos líneas del destinatario, el «S / D», el saludo, el cuerpo (con `<w:jc w:val="both"/>` y `w:firstLine="709"`), el cierre (con `w:firstLine="709"`), la línea de la firma (`______________________________`), el nombre y el cargo, los tres con `w:left="4535"` y `<w:jc w:val="center"/>`;
  - en un contratado, el renglón «Personal contratado, cumpliendo funciones de» con `<w:sz w:val="18"/>`;
  - el renglón vacío entre los bloques: dos después de la fecha, uno después del «S / D», del saludo y del cuerpo, cuatro después del cierre;
  - una persona con un carácter de control (`'Ana\u0001 Luz\uD800'`) da un Word que JSZip abre y cuyo XML no tiene U+0001 ni un surrogate solo.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/mi-espacio-nota-word.test.js`
Expected: FAIL (no existe el módulo).

- [ ] **Step 3: Implement `renderNotaDocx(nota)`** en `services/miEspacioNotaWord.js` con `Document`, `Packer`, `Paragraph`, `TextRun`, `AlignmentType` y `LineRuleType` de `docx`; el interlineado en `styles.default.document.paragraph.spacing`, no en cada párrafo. Agregar `export` a `textoParaWord` en `services/notasWord.js` sin tocar nada más. La referencia de la diagramación es `generar-words` de la maqueta (los .docx de `word/`, aprobados por el usuario).

- [ ] **Step 4: Run tests to verify they pass, y que los Word de antes no cambian**

Run: `node --test tests/mi-espacio-nota-word.test.js tests/notas-word.test.js tests/notas-digitales-word.test.js`
Expected: PASS los tres (los dos de antes, sin tocarlos).

- [ ] **Step 5: Commit**

```bash
git add services/miEspacioNotaWord.js services/notasWord.js tests/mi-espacio-nota-word.test.js
git commit -m "feat(licencia-word): el Word de la nota de licencia, en A4, Arial 11 e interlineado 1,15"
```

---

### Task 4: Los datos y la API

**Files:**
- Modify: `services/miEspacioDatos.js` (una función nueva), `services/miEspacioResumen.js` (un envoltorio exportado), `controllers/miEspacioController.js` (dos manejadores), `routes/index.js` (dos rutas)
- Test: `tests/mi-espacio-api.test.js` (un `describe` nuevo, «la nota de una licencia»), `tests/permisos.test.js` (`RUTAS_MI_ESPACIO`)

**Interfaces:**
- Consumes: `notaDeLicencia`, `htmlDeLaNota`, `aclaracionDeLaNota`, `MENSAJES_NOTA` (Task 2); `renderNotaDocx`, `TIPO_WORD` (Task 3); `contextoDe` (`miEspacioDatos.js`), `vinculosDe` (`miEspacioPaso.js`), `disposicionDeAdjunto(nombre)` (`services/seguimientoReglas.js`), `idPositivo`, `hoyArgentina`.
- Produces:
  - `datosDeLaNota(usuarioId, licenciaId, conexion = pool) => Promise<{ guardada: 'AAAA-MM-DD', nombre, cargo, vinculo } | null>` en `miEspacioDatos.js`: una consulta que une `mi_espacio_licencias` (activa, de esa persona) con `usuarios`, con `UNIX_TIMESTAMP(l.updated_at)` pasado a día argentino con `hoyArgentina(new Date(ts * 1000))`, como `subido_el` de `controllers/proyectosController.js`. `personaDe` no cambia (tiene un `deepEqual` en los tests).
  - `filaDeUnaLicencia(estado, calculo, { id, hoy, persona, vinculos, feriados }) => object | null` en `miEspacioResumen.js`: la fila de `filaDeLicencia` de la licencia `id` del estado, con el mismo contexto que `filasDeLicencias`; null si no está.
  - `GET /api/mi-espacio/licencias/:id/nota` (`verNotaDeLicencia`) → 200 `{ success: true, data: { fila, html, fecha, aclaracion } }`.
  - `GET /api/mi-espacio/licencias/:id/word` (`bajarWordDeLicencia`) → 200 con `Content-Type: TIPO_WORD`, `Content-Disposition: disposicionDeAdjunto(nota.nombre)` y el buffer.
  - Errores de las dos: 404 `MENSAJES_MI_ESPACIO.noEncontrada` (id que no pasa `idPositivo`, de otra persona, dada de baja o inexistente); 404 `MENSAJES_NOTA.sinNota` (uso autorizado); 409 `MENSAJES_NOTA.sinDiasHabiles`; 500 `MENSAJES_NOTA.error` (con `responder`, que manda la pila solo a la consola).
  - Una persona sin modalidad arma la nota igual (la fila sale de `filaDeUnaLicencia` con su `estado`, aunque la lista responda `sinModalidad`).

- [ ] **Step 1: Write the failing tests.** En `tests/mi-espacio-api.test.js`, `describe('la nota de una licencia', …)`, con las personas y las fechas `q(n)` del archivo (dos semanas sin feriados):
  - `adminA` carga vacaciones `q(0)`–`q(4)` → `GET …/nota` da 200, `data.fila.id` es el id, `data.fecha` es `hoy`, `data.html` incluye «cinco (5) días hábiles» y «Laura Gómez», y `data.aclaracion` empieza con `Lleva la fecha del ${formatoCorto(hoy)}`;
  - la nota opcional de la licencia (cargada con `nota: 'Turno con el dentista'`) no aparece en `data.html` ni en el Word;
  - `GET …/word` da 200, `content-type` de Word, y `content-disposition` con `filename*=UTF-8''Nota%20de%20licencia%20-%20Licencia%20anual%20ordinaria%20-%20${q(0)}.docx`; el cuerpo abre con JSZip;
  - **la fecha guardada:** `UPDATE mi_espacio_licencias SET updated_at = FROM_UNIXTIME(?) WHERE id = ?` con el instante `2026-10-28T01:30:00Z` → `data.fecha` es `'2026-10-27'` (22:30 en Argentina); una corrección con cambios por `PUT` mueve la fecha a hoy; un `PUT` con los mismos datos no la mueve (fijar antes un `updated_at` viejo y comprobar que sigue);
  - **lo ajeno:** la licencia de `adminA` pedida por `adminB` da 404 «Licencia no encontrada»; una borrada (`DELETE`) da 404; `abc`, `0`, `-3` y `1.5` dan 404;
  - **el uso autorizado** (cargado por SQL para `editor`, de contrato) da 404 «Esta licencia no tiene nota.» en las dos rutas;
  - **sin días hábiles:** unos estudios `q(5)`–`q(6)` insertados por SQL (el fin de semana; la API no los deja guardar) dan 409 con `MENSAJES_NOTA.sinDiasHabiles` en las dos rutas;
  - **sin modalidad:** `lector` (sin vínculo) con una licencia insertada por SQL arma la nota (200) y su firma no tiene el renglón del contratado;
  - **un contratado:** `editor` (contrato) con un cargo puesto por SQL: el `html` tiene «Personal contratado, cumpliendo funciones de»;
  - **un lector baja la suya** (200);
  - en `tests/permisos.test.js`, sumar `['GET', '/mi-espacio/licencias/1/nota']` y `['GET', '/mi-espacio/licencias/1/word']` a `RUTAS_MI_ESPACIO` (401 sin sesión).

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/mi-espacio-api.test.js` (con Docker) y `node --test tests/permisos.test.js`
Expected: FAIL en los casos nuevos (404 de Express en las rutas que no existen).

- [ ] **Step 3: Implement** `datosDeLaNota`, `filaDeUnaLicencia`, `verNotaDeLicencia` y `bajarWordDeLicencia` con las firmas de la Interfaz, y las dos rutas en `routes/index.js`, al lado de las de licencias de Mi espacio, con `authMiddleware`. Los dos manejadores comparten la lectura: `contextoDe(req.user.userId, hoy)`, `datosDeLaNota`, la licencia del `estado` por id (la de `datosDeLaNota` confirma que es suya y activa) y `notaDeLicencia(licencia, { fecha: guardada, persona: { nombre, cargo, vinculo }, feriados })`. Solo `…/nota` pide `vinculosDe` (la fila). El Word se manda con `res.set(…)` y `res.send(buffer)`, fuera de `responder` (que responde JSON), con su propio `try/catch` y el mismo 500.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/mi-espacio-api.test.js` y `node --test tests/permisos.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/miEspacioDatos.js services/miEspacioResumen.js controllers/miEspacioController.js routes/index.js tests/mi-espacio-api.test.js tests/permisos.test.js
git commit -m "feat(licencia-word): GET /api/mi-espacio/licencias/:id/nota y /word"
```

---

### Task 5: «Word» en la lista y la descarga

**Files:**
- Modify: `public/js/mi-espacio.js`, `public/mi-espacio.html` (el `<style>` y el `?v=`), `tests/paginas.test.js` (`VERSION_MI_ESPACIO`)
- Test: `tests/mi-espacio-frontend.test.js`

**Interfaces:**
- Consumes: `GET …/word` (Task 4).
- Produces (en `mi-espacio.js`):
  - puro: `nombreDelAdjunto(cabecera: string | null) => string | null` (el `filename*` en UTF-8 decodificado con `decodeURIComponent`; si no hay, el `filename` entre comillas; si no, null); `NOMBRE_DEL_WORD_POR_DEFECTO = 'Nota de licencia.docx'`; `MENSAJE_SIN_DESCARGA = 'No se pudo descargar la nota. Probá de nuevo en unos minutos.'`; `htmlDeFilaDeLicencia(fila)` con un grupo `<span class="me-fila-acciones">` que lleva «Word» (`data-word-licencia="<id>"`, `aria-label` «Descargar en Word la nota de la licencia del <fechas_texto>») antes de «Editar», sin «Word» en `tipo === 'uso_autorizado'`;
  - con la API: `pedirWordDeLicencia(id) => Promise<{ blob, nombre }>`, un `fetch` GET propio a `${CONFIG.API_URL}/mi-espacio/licencias/${encodeURIComponent(id)}/word` con `Auth.getAuthHeaders()`, que tira un Error con `status` y el `error` del servidor si no es ok (como `pedirWord` de `public/js/notas.js`); `descargarBlob(blob, nombre)` (copia de la de `correos.js`); `bajarWordDeLicencia(id, boton) => Promise<void>`: deshabilita el botón mientras baja, baja con el nombre o `NOMBRE_DEL_WORD_POR_DEFECTO`, con 401 llama a `irAlLogin()`, y con otro error avisa el mensaje del servidor o `MENSAJE_SIN_DESCARGA` (con `avisarMiEspacio`, como los demás avisos de la página).

- [ ] **Step 1: Write the failing tests** en `tests/mi-espacio-frontend.test.js`:
  - `htmlDeFilaDeLicencia`: una fila de vacaciones tiene `data-word-licencia="7"` y el `aria-label` con sus fechas, antes de `data-editar-licencia`; una de `uso_autorizado` no tiene `data-word-licencia`;
  - `nombreDelAdjunto`: `"attachment; filename=\"Nota de licencia - Atencion medica - 2026-11-05.docx\"; filename*=UTF-8''Nota%20de%20licencia%20-%20Atenci%C3%B3n%20m%C3%A9dica%20-%202026-11-05.docx"` → «Nota de licencia - Atención médica - 2026-11-05.docx»; solo `filename="a.docx"` → «a.docx»; null y '' → null; un `filename*` con un `%` roto → el `filename` o null, sin tirar;
  - con `montarPagina({ hash: '#licencias' })` y el `fetch` falso devolviendo un blob con ese `Content-Disposition` (sumar al contexto del `vm` `Blob` y `URL.createObjectURL`/`revokeObjectURL` falsos que anoten): un clic en «Word» pide `GET /api/mi-espacio/licencias/7/word` con el encabezado `Authorization`, deja el botón deshabilitado mientras espera y crea un `<a download>` con el nombre con tildes;
  - un 401 lleva al login; un 409 muestra su mensaje; un error sin mensaje muestra `MENSAJE_SIN_DESCARGA`; un segundo clic mientras baja no pide nada.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/mi-espacio-frontend.test.js`
Expected: FAIL en los nuevos.

- [ ] **Step 3: Implement** lo de la Interfaz. El clic de «Word» va en `alTocarLicencias`, antes del de «Editar». El CSS de `.me-fila-acciones` (los dos botones en fila, con 18 px entre ellos y alineados a la derecha; en el teléfono, arriba a la derecha como hoy «Editar») va en el `<style>` de `mi-espacio.html`. Subir `VERSION_MI_ESPACIO` en `tests/paginas.test.js` y el `?v=` de `js/mi-espacio.js` en `mi-espacio.html` al mismo valor.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/mi-espacio-frontend.test.js tests/paginas.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/js/mi-espacio.js public/mi-espacio.html tests/mi-espacio-frontend.test.js tests/paginas.test.js
git commit -m "feat(licencia-word): «Word» en cada licencia de la lista, con el nombre del archivo del servidor"
```

---

### Task 6: El segundo paso

**Files:**
- Modify: `public/js/mi-espacio.js`, `public/mi-espacio.html` (el marcado del segundo paso y su CSS)
- Test: `tests/mi-espacio-frontend.test.js`

**Interfaces:**
- Consumes: `GET …/nota` (Task 4); `pedirWordDeLicencia`, `bajarWordDeLicencia`, `descargarBlob` (Task 5); `respaldoDelFoco`, `devolverElFoco`, `volverAPedirTodo`, `cerrarModal`, `irAlLogin` (los de hoy).
- Produces:
  - marcado en `#modal-licencia`: el `.modal-body` de hoy con `id="ml-cuerpo"` y el `.modal-footer` de hoy con `id="ml-pie-del-formulario"`; después, `<div class="modal-body me-paso-dos" id="ml-paso-dos" hidden>` y `<div class="modal-footer" id="ml-paso-dos-pie" hidden>` con «Listo» (`sg-btn sg-btn-borde`, `data-cerrar`) y «Descargar Word» (`sg-btn sg-btn-tinta`, `id="ml-descargar-word"`);
  - puro: `tituloDelSegundoPaso(corregida: boolean) => 'Licencia cargada' | 'Licencia corregida'`; `anuncioDelSegundoPaso(corregida, avisos) => string` («Licencia cargada. Podés descargar la nota en Word.», con los avisos después); `htmlDelSegundoPaso({ fila, html, aclaracion, avisos }) => string` (el recuadro ámbar de los avisos si hay; la tilde, la insignia del tipo con su clase de `CLASE_DEL_TIPO`, `fechas_texto` y `cantidad_texto`, y en gris `de_licencias_texto`, `configuracion.texto` y `mostrar_texto`; «Así sale la nota» como `<h3>`, la `aclaracion` y el `html` del servidor tal cual dentro de `<div class="me-mesa">`); `TEXTO_ARMANDO_LA_NOTA = 'Armando la nota…'`; `MENSAJE_SIN_VISTA = 'La licencia quedó guardada, pero no se pudo armar la vista de la nota. Probá «Descargar Word» o bajala después con «Word» en la lista.'`;
  - con el DOM: `mostrarSegundoPaso({ id, corregida, avisos })` y `quitarSegundoPaso()`.

- [ ] **Step 1: Write the failing tests** en `tests/mi-espacio-frontend.test.js`:
  - **cambian** los que hoy esperan que el modal se cierre al guardar una licencia (los de la Task 1, Step 2): ahora el modal sigue `active`, el título es «Licencia cargada» y, después de «Listo», sigue lo que esperaban (el Resumen y la pestaña pedidos de nuevo, el foco en el «Editar» nuevo de la misma fila);
  - **el uso autorizado** («Registrar un uso autorizado», `FORMULARIOS.uso`) se sigue cerrando al guardar, sin segundo paso;
  - **el segundo paso:** después del POST 201, se pide `GET /api/mi-espacio/licencias/<id>/nota`; mientras tanto `#ml-paso-dos` dice `TEXTO_ARMANDO_LA_NOTA`; con la respuesta, muestra la insignia, las fechas, la `aclaracion` y el `html`; `#ml-cuerpo` y `#ml-pie-del-formulario` quedan `hidden`; el foco va a `#ml-descargar-word`; `#me-anuncio` dice «Licencia cargada. Podés descargar la nota en Word.»; no hay aviso flotante de «Licencia cargada.»;
  - **la corrección:** el PUT 200 con `avisos: [TEXTO_NO_SE_COPIA]` da «Licencia corregida» y el recuadro ámbar con el aviso;
  - **otro año:** la licencia guardada es de un año que la lista no muestra y el segundo paso igual la muestra (la fila viene de `…/nota`);
  - **cerrar:** «Listo», la × y Escape cierran; al volver a abrir «Cargar licencia» está el formulario (`#ml-paso-dos` `hidden`, `#ml-cuerpo` visible, título «Cargar licencia»);
  - **respuesta vieja:** si `…/nota` responde después de cerrar el modal (o después de un segundo guardado), no se pinta nada en el modal cerrado ni en el nuevo;
  - **falla de la vista:** un 500 de `…/nota` muestra `MENSAJE_SIN_VISTA` y «Descargar Word» sigue andando; un 401 lleva al login;
  - **«Descargar Word»** del segundo paso baja con `bajarWordDeLicencia(id, boton)` (el mismo camino que la lista).

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/mi-espacio-frontend.test.js`
Expected: FAIL en los nuevos y en los cambiados.

- [ ] **Step 3: Implement.** En `guardarLicencia`, solo con `nombre === 'licencia'`: en lugar de `cerrarModal` y `avisarLaRespuesta`, calcular el respaldo del foco con el botón que abrió el modal (`respaldoDelFoco(<volverA de la sesión del modal>)`) antes de `volverAPedirTodo()`, llamar a `mostrarSegundoPaso({ id: respuesta.data.id, corregida: Boolean(formulario.fila), avisos: respuesta.avisos ?? [] })` y dar por terminado el formulario (que el cálculo, la persona a cargo y sus temporizadores no sigan). Al cerrar el modal (el `alCerrar` de su sesión), `quitarSegundoPaso()` y, cuando termine la recarga pendiente, `devolverElFoco(respaldo)`. Las respuestas de `…/nota` se descartan con un contador propio del segundo paso (como `formulario.pedido` del cálculo). El CSS, desde `css/maqueta.css` de la maqueta (versión C): `.me-paso-dos`, la tilde, `.me-mesa` (fondo `--sg-gris-fondo`, sin `max-height`: el cuerpo del modal es el que se desplaza) y la hoja (`.me-hoja`: `container-type: inline-size`, `aspect-ratio: 210 / 297`, `padding: 11.9cqw 14.29cqw`, `font: 1.848cqw/1.32 Arial, Helvetica, sans-serif`, sangría `5.95cqw`, firma con `margin-left: 38.1cqw`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/mi-espacio-frontend.test.js tests/paginas.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/js/mi-espacio.js public/mi-espacio.html tests/mi-espacio-frontend.test.js
git commit -m "feat(licencia-word): el segundo paso de «Cargar licencia», con la nota a la vista y «Descargar Word»"
```

---

### Task 7: El cierre

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1:** Sumar al `CLAUDE.md` la función: la convención de `mi-espacio.js` (el segundo paso, «Word», `pedirWordDeLicencia`, `nombreDelAdjunto`), los dos módulos nuevos en «Estructura del proyecto» y una sección corta «La nota de licencia en Word (spec 2026-10-27-mi-espacio-licencia-word)» con los contratos de la API y las reglas del texto (al estilo de las demás secciones).
- [ ] **Step 2:** Correr la suite completa y comparar con la línea de base de la Task 1.

Run: `npm test`
Expected: todo en verde; el total es la línea de base más los tests nuevos.

- [ ] **Step 3:** Probar en el navegador, con una copia propia de la base (`rpad_rama_licencia_word`, con las personas y las licencias inventadas, como las maquetas) y el servidor de la rama: cargar y corregir una licencia de cada tipo, abrir los Word en Word o LibreOffice, el teléfono (375 px) y el foco. Borrar la copia al terminar.
- [ ] **Step 4:** Revisión final de toda la rama con un revisor nuevo (Opus) contra la spec y este plan. Corregir lo que encuentre y volver a correr la suite.
- [ ] **Step 5:** Si todo dio bien (tareas, revisión y suite en verde): merge en main y push, como pide el usuario (`merge y push automáticos`). Armar el kit `RPAD-deploy-mi-espacio-licencia-word` en el Escritorio: los archivos que cambiaron, sin SQL ni Tarea Cron, «subir los archivos y Restart», después del kit del Resumen «Titular».
- [ ] **Step 6:** Avisarle a la coordinadora (`local_62853c2f-ecfd-4cf2-bc66-93f666633e21`) con el hash del merge, el total de tests y la ruta del kit, y dejar la nota de traspaso en su carpeta de notas.

```bash
git add CLAUDE.md
git commit -m "docs(licencia-word): el CLAUDE.md con la nota de licencia en Word"
```
