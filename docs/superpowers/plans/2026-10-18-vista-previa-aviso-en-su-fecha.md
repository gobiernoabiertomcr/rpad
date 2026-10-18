# Vista previa como sale y aviso anticipado que no salió — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la vista previa y la prueba de Correos muestren la nota tal como saldría en la próxima corrida con notas (víspera, aviso en su fecha, autorización tardía, días sin notas), y que un dataset cuyo aviso anticipado no salió no se quede sin recordatorio.

**Architecture:**
1. Ajuste del criterio de exclusión del aviso en su fecha: solo con el aviso anticipado enviado, y guardando sin `cuenta_desde` al que entra con los 20 días cumplidos.
2. Refactor sin cambio de comportamiento: la corrida arma el aviso de cada gestión con dos funciones compartidas, `contextoDelDia` (solo lee) y `avisoDelDia` (sin escrituras).
3. Las vistas previas eligen la fecha de la próxima corrida con notas (`fechaDeVistaPrevia`) y usan esas mismas funciones.
4. La pantalla de Correos avisa cuando la fecha no es hoy.

**Tech Stack:** Node 22 (ESM), Express, MariaDB (mysql2), node:test, JS sin frameworks en el navegador.

**Spec:** `docs/superpowers/specs/2026-10-15-dias-habiles-licencias-auditoria-design.md`, secciones 7.6 (exclusión solo con el aviso anticipado enviado; "Lo que guarda") y 7.7 (nueva).

## Global Constraints

- Sin migración y sin emails reales (Mailpit, direcciones `@rpad.test`).
- La corrida diaria no cambia de comportamiento por el refactor (Tarea 2): todos los tests existentes de `tests/notas-licencias.test.js`, `tests/notas-motor.test.js` y `tests/notas-auditoria.test.js` siguen en verde sin tocarlos. Incluye el orden de los errores del test de la búsqueda fallida (`notas-licencias.test.js` ~472-505).
- La vista previa no escribe nada: ni notas, ni `notas_digitales_datasets`, ni `usuarios_licencias.nota_autorizacion_id`. La prueba escribe solo su nota de prueba, como hoy.
- Textos exactos de la vista previa cuando la fecha no es hoy:
  - mensaje: `Hoy no se generan notas ({motivo}): así saldría el {dd/mm/aaaa}.`;
  - motivos, uno de: `día no hábil`, `licencia del firmante sin persona autorizada`, `la persona autorizada está de licencia`.
- `pendientesEnSuFecha` suma `aviso_estado` arriba de todo. `adelantado` sigue siendo `{ numero, anio, fecha }`, con deepEqual en `tests/notas-datos.test.js` ~278 y ~307.
- ES Modules, español, SQL parametrizado, nunca `CURDATE()`.
- `npm test` completo antes y después de cada tarea (línea de base: 2175 tests, 2170 pass, 0 fail, 5 skipped).
- Cache-busting: solo `correos.js` cambia en el navegador (`?v=20261107` y `VERSION_CORREOS` en `tests/paginas.test.js`).
- Ningún texto versionado lleva nombres de personas reales.

## Review Focus

1. **El refactor de la Tarea 2 no puede cambiar la corrida:** víspera, aviso en su fecha, autorización tardía, recuperación de 20 días y contabilidad de errores. Lo cubren los tests existentes.
2. **Vista previa en un día sin notas:**
   - sábado → lunes, motivo `día no hábil`;
   - licencia sin autorizado → la vuelta;
   - persona autorizada ausente → el día en que vuelve.

   Tests en la Tarea 3.
3. **Autorización tardía en la vista previa:** leyenda "Nota Digital N° XX", sin generar la nota de autorización ni tocar la licencia. Test en la Tarea 3.
4. **La vista previa coincide con la corrida:** mismo asunto (salvo el número) y mismos datasets el mismo día. Test en la Tarea 3.
5. **Aviso anticipado que no salió:**
   - fallido sin reintentos, con la recuperación 20 días tarde: entra en el aviso en su fecha sin `cuenta_desde` y no se reitera ese día;
   - pendiente: se reintenta primero y va a la reiteración.

   Tests en la Tarea 1.

---

### Task 1: El aviso anticipado que no salió, y el comentario del PDF

**Files:**
- Modify: `services/notasDigitalesDatos.js` (`pendientesEnSuFecha`, ~154-177: `av.estado AS aviso_estado` en el SELECT y `aviso_estado` arriba de todo en cada elemento; actualizar su comentario)
- Modify: `services/notasDigitales.js` (`yaTocaReiterar` ~39-43 y su comentario; el filtro de la corrida ~485-486)
- Modify: `services/notasDigitalesPdf.js` (~270-271: el comentario tiene secuencias de escape `°`, `ú`, `ó` escritas como texto; reemplazarlas por °, ú y ó. Las líneas de código con la expresión regular y el reemplazo no se tocan)
- Test: `tests/notas-datos.test.js`, `tests/notas-licencias.test.js`

**Interfaces:**
- Produces: cada elemento de `pendientesEnSuFecha` trae `aviso_estado` (`'pendiente' | 'enviada' | 'fallida'`), el estado de su aviso anticipado.
- `yaTocaReiterar = (dataset, dia) => dataset.aviso_estado === 'enviada' && dataset.cuenta_desde <= sumarDias(dia, -DIAS_PARA_REITERAR)`. El Estado (`proximoAvisoEnSuFecha`) la usa igual y no cambia.
- En la corrida, después del filtro, el que entra con los 20 días cumplidos (solo puede ser uno con el aviso anticipado no enviado) va sin `cuenta_desde`:
  `.map(d => (d.cuenta_desde <= sumarDias(hoy, -DIAS_PARA_REITERAR) ? { ...d, cuenta_desde: null } : d))`

- [ ] **Step 1: Tests.**
  - En `tests/notas-datos.test.js`, al test de `pendientesEnSuFecha` que cuenta un aviso en cualquier estado (~314-322), sumar: `assert.deepEqual(filas.map(f => [f.id, f.aviso_estado]), [[enviado, 'enviada'], [pendiente, 'pendiente'], [fallido, 'fallida']])`, con los nombres de variables que use ese test.
  - En `tests/notas-licencias.test.js`, dentro del describe anidado "recuperación 20 días tarde o más" (~515-576). Su `beforeEach` deja la licencia hasta el 29/01/2027 sin autorizada y crea `interno`; no usar `vispera()`. Dos tests nuevos:
    - `el aviso adelantado quedó fallido sin reintentos: el 11/01 el externo sale en su fecha y no se reitera ese día`.
      - Preparación: correr el 09/12 y tomar el aviso anticipado externo. Ponerlo `UPDATE notas_digitales SET estado = 'fallida', intentos = ?, ultimo_error = 'SMTP caído', enviada_at = NULL WHERE id = ?` con `motor.MAX_INTENTOS`. Cargar la autorizada con `autorizado_at = '2027-01-08 10:00:00'`.
      - Estado del 11/01: `proximas.externa.aviso` deepEqual `{ fecha: '2027-01-11', cantidad: 1 }`.
      - Corrida del 11/01: `errores` vacío, y hay un aviso externo presentado por la autorizada.
      - Ese aviso: `datasetsDe` = `[{ dataset_id: externo, cuenta_desde: null }]`, y su HTML incluye `Este pedido ya se había adelantado por Nota Digital N° {anticipado}/26 del 09/12/2026.`
      - Ninguna reiteración externa ese día.
      - La anticipada sigue `{ estado: 'fallida', intentos: 5 }`.
      - El 12/01, los avisos externos siguen siendo 2.
    - `el aviso adelantado quedó pendiente: se reintenta primero y el externo va a la reiteración`. Igual, pero con `UPDATE … SET estado = 'pendiente', intentos = 0, enviada_at = NULL`. Después de correr el 11/01:
      - la anticipada quedó `'enviada'`;
      - no hay aviso externo con fecha 11/01;
      - la reiteración externa del 11/01 incluye a `externo`, y su "Informado en" cita la anticipada.
- [ ] **Step 2: Correr y ver que fallan** — `node --test --test-concurrency=1 tests/notas-datos.test.js tests/notas-licencias.test.js`.
- [ ] **Step 3: Implementar** los tres cambios y el comentario.
- [ ] **Step 4: Correr** esos dos archivos más `tests/notas-pdf.test.js` → pasan. Después, `npm test` completo.
- [ ] **Step 5: Commit**
  ```bash
  git add services/notasDigitalesDatos.js services/notasDigitales.js services/notasDigitalesPdf.js tests/notas-datos.test.js tests/notas-licencias.test.js
  git commit -m "fix: un dataset cuyo aviso anticipado no salió no se queda sin el aviso en su fecha"
  ```

### Task 2: Una sola selección del aviso del día (refactor, sin cambio de comportamiento)

**Files:**
- Modify: `services/notasDigitales.js` (`correrPasos`, ~405-513)
- Test: `tests/notas-licencias.test.js` (tests nuevos de `avisoDelDia`)

**Interfaces:**
- Produces:
  - `contextoDelDia(config, fecha)`, interna, solo lee, en el mismo orden que la corrida:
    - con `modo === 'sin_autorizado'` → `{ modo, firma, licencia }`;
    - si no → `{ modo, firma, licencia, pendiente, autorizacion, anticipo }`.
    - `pendiente` = `autorizacionPendiente(config, fecha)`; `autorizacion` = `pendiente ? datosDeAutorizacion(pendiente) : null`; `anticipo` = `modo === 'titular' ? anticipoPorLicencia(config, fecha) : null`.
  - `export const avisoDelDia = async ({ gestion, fecha, modo, licencia = null, anticipo = null, autorizacion = null })` → `{ datasets, rangoVencimientos, autorizacion, errorEnSuFecha }`. Sin escrituras ni `resumen`.
    - `datasets`: `prepararAviso(gestion, fecha, anticipo)`, más, con `modo === 'autorizado'`, los en su fecha. Esos salen de un `try` propio con `disponibilidadDelAutorizado(licencia)` (por gestión) y `pendientesEnSuFecha`, con el filtro y el `map` de la Tarea 1, y el orden `porVencimientoYTitulo`. Si ese `try` falla, `errorEnSuFecha` = el error y `datasets` = la selección normal.
    - `rangoVencimientos` = como hoy, solo con `anticipo`.
    - `autorizacion` devuelta = `anticipo ? autorizacion : null`.
  - Lo que se queda solo en `correrPasos`:
    - los reintentos;
    - los textos de `resumen.licencia`;
    - `generarAutorizacion` y `registrarAutorizacion` con sus banderas;
    - la rama tardía y la relectura de `firmaParaFecha`;
    - el error de la leyenda que falta;
    - por gestión: pasar `autorizacion: autorizacionDesactualizada ? null : autorizacion`, anotar `errorEnSuFecha` con `anotarError(resumen, { tipo: 'aviso', gestion }, errorEnSuFecha)` justo después de la llamada (dentro del `try` de la gestión, para que una falla de `prepararAviso` se anote y siga), `generarNota`, `resumen.generadas` y `enviar`;
    - la nota de autorización de la víspera sin avisos.

- [ ] **Step 1: Tests nuevos de `avisoDelDia`** en `tests/notas-licencias.test.js`, con los escenarios y helpers del archivo, llamando `motor.avisoDelDia` con el contexto que corresponde:
  - víspera con autorizado (licencia 26/11/2026–14/01/2027, datasets internos que vencen 25/01 y 15/02, fecha 25/11, `modo` 'titular', `anticipo` de `firmas.anticipoPorLicencia`): los dos datasets, con `cuenta_desde`; `rangoVencimientos` no nulo; `autorizacion` no nula;
  - día del aviso en su fecha (describe de 7.6, después de la víspera, fecha 22/12, `modo` 'autorizado' y la licencia del titular): el externo con `adelantado`; `rangoVencimientos` nulo; `autorizacion` nula;
  - día normal sin licencia: `datasets` igual a `seleccionarParaAviso(gestion, fecha)` (los ids); `errorEnSuFecha` nulo.
- [ ] **Step 2: Correr y ver que fallan** (`avisoDelDia` no existe).
- [ ] **Step 3: Implementar** las dos funciones y pasar `correrPasos` a usarlas.
- [ ] **Step 4: Correr** `node --test --test-concurrency=1 tests/notas-licencias.test.js tests/notas-motor.test.js tests/notas-auditoria.test.js` → pasan sin tocar ningún test existente. Después, `npm test` completo.
- [ ] **Step 5: Commit**
  ```bash
  git add services/notasDigitales.js tests/notas-licencias.test.js
  git commit -m "refactor: la corrida arma el aviso de cada gestión con una función compartida (avisoDelDia)"
  ```

### Task 3: La vista previa y la prueba muestran la nota como saldría

**Files:**
- Modify: `services/notasDigitales.js` (`fechaDeVistaPrevia` nueva; `contenidoParaMostrar`, `notaDeVistaPrevia`, `previewNota`, `previewPdf`, `previewAnexo`, `enviarPrueba`)
- Modify: `controllers/notasDigitalesController.js` (`verPreview` devuelve `fecha` y `motivo`; el mensaje de `enviarPrueba`)
- Test: `tests/notas-licencias.test.js` (y ajustar el test de `:981-985` sobre las vistas previas durante una licencia sin autorizado)

**Interfaces:**
- Consumes: `contextoDelDia` y `avisoDelDia` (Tarea 2); `textoLeyendaAutorizacion` (`notasDigitalesContenido.js` ~102-104); `licenciaEnFecha` (licenciasService).
- Produces:
  - `fechaDeVistaPrevia(config, hoy)` → `{ fecha, motivo }`.
    - `fecha`: el primer día desde hoy que es hábil y en que `firmaParaFecha(config, d).modo !== 'sin_autorizado'`. Se busca hasta 366 días; si no hay ninguno, `{ fecha: hoy, motivo: null }`.
    - `motivo`: `null` si `fecha === hoy`; si no, el de hoy:
      - `'día no hábil'` si hoy no es hábil;
      - `'la persona autorizada está de licencia'` si hoy es de licencia del titular, la licencia tiene `autorizado_id` y esa persona tiene licencia hoy (`licenciaEnFecha`);
      - si no, `'licencia del firmante sin persona autorizada'`.
  - `previewNota` devuelve `{ html, asunto, ejemplo, cantidad, fecha, motivo }`.
  - Las previas de reiteración y de auditoría usan la misma `fecha` (y su firma); su selección no cambia.

Reglas de contenido (spec 7.7):
- El aviso de la vista previa sale de `avisoDelDia` con el contexto de `fecha`. Pasa a `construirNota` y a `generarNota` (en la prueba) la `firma`, el `rangoVencimientos` y la `autorizacion` de ese día.
- Autorización todavía no comunicada (`modo === 'autorizado'`, sin `firma.leyenda` y con `pendiente`): la firma de la vista previa lleva `leyenda: textoLeyendaAutorizacion({ presentante: firma.presentante, titular: firma.titular, nota: { numero: null, anio: null }, licencia })`, que dice "N° XX". No se genera la nota de autorización.
- Si `avisoDelDia` devuelve `errorEnSuFecha`, la vista previa lanza el error (500) en vez de mostrar una nota distinta.
- Sin datasets, el ejemplo de siempre, con la firma de esa fecha, sin rango ni autorización.
- El mensaje de la prueba suma ` (como saldría el {dd/mm/aaaa})` cuando hay `motivo`.

- [ ] **Step 1: Tests** en `tests/notas-licencias.test.js`, con fechas fijas y los helpers del archivo:
  - `vista previa de la víspera con autorizado`: licencia 26/11–14/01 con autorizado y dos datasets internos (25/01 y 15/02). `previewNota({ tipo: 'aviso', gestion: 'interna', hoy: '2026-11-25' })` da:
    - asunto que coincide con `/vencimientos de enero a febrero 2027/`;
    - el párrafo de autorización en el HTML;
    - `cantidad` 2, `motivo` null y `fecha` '2026-11-25';
    - ninguna nota real en la base (`notas()` vacía) y `notaDeAutorizacionDe(licenciaId)` nulo.
  - `vista previa del aviso en su fecha coincide con la corrida` (describe de 7.6):
    - después de la víspera, `previewNota({ tipo: 'aviso', gestion: 'externa', hoy: '2026-12-22' })` tiene el párrafo `Este pedido ya se había adelantado por …`, la leyenda y el asunto del mes;
    - después, `correr('2026-12-22')` genera un aviso cuyo asunto sin el número es igual al de la vista previa;
    - los datasets de la vista previa (los de `avisoDelDia`) son los de `datasetsDe` del aviso generado.
  - `un sábado muestra el lunes`: `previewNota({ …, hoy: '2026-12-19' })` da `fecha` '2026-12-21' y `motivo` 'día no hábil'.
  - `durante una licencia sin autorizado muestra la vuelta`: el test de `:981-985` pasa a afirmar `fecha` = el primer día hábil después de la licencia, `motivo` 'licencia del firmante sin persona autorizada' y la firma del titular.
  - `con la persona autorizada de licencia muestra el día en que vuelve`: `motivo` 'la persona autorizada está de licencia' y `fecha` = su primer día hábil disponible.
  - `autorización tardía: la leyenda cita N° XX y no se genera nada`:
    - licencia en curso sin autorizado y víspera corrida;
    - cargar la autorizada;
    - la vista previa de un día de la licencia trae `Nota Digital N° XX` en la leyenda;
    - las notas reales no cambian y la licencia sigue sin `nota_autorizacion_id`.
  - `la prueba de la víspera`: `enviarPrueba({ tipo: 'aviso', gestion: 'interna', hoy: '2026-11-25' })` genera una nota de prueba con asunto `[PRUEBA] …vencimientos de enero a febrero 2027…` y no escribe `notas_digitales_datasets`.
  - Los tests de vistas previas existentes siguen en verde: `notas-motor.test.js` ~676-947, `notas-api.test.js` ~320-753, `notas-auditoria.test.js` ~322 y ~343, `permisos.test.js` ~44-54.
- [ ] **Step 2: Correr y ver que fallan.**
- [ ] **Step 3: Implementar** `fechaDeVistaPrevia`, la vista previa con la misma selección y la respuesta del controlador.
- [ ] **Step 4: Correr** `node --test --test-concurrency=1 tests/notas-licencias.test.js tests/notas-motor.test.js tests/notas-api.test.js tests/notas-auditoria.test.js tests/permisos.test.js` → pasan. Después, `npm test` completo.
- [ ] **Step 5: Commit**
  ```bash
  git add services/notasDigitales.js controllers/notasDigitalesController.js tests/notas-licencias.test.js
  git commit -m "feat: la vista previa y la prueba de Correos muestran la nota como saldría en la próxima corrida con notas"
  ```

### Task 4: La pantalla de Correos y la documentación

**Files:**
- Modify: `public/js/correos.js` (`verVistaPrevia` ~434-454), `public/correos.html` (texto de ayuda ~442 y `?v=` de `correos.js`), `CLAUDE.md`, `README.md` (Changelog)
- Test: `tests/correos-frontend.test.js` (el texto de ayuda fijado ~1291 y un test nuevo del texto de la vista previa), `tests/paginas.test.js` (`VERSION_CORREOS`)

**Interfaces:**
- Produces: `textoDeVistaPrevia({ ejemplo, cantidad, asunto, fecha: f, motivo })`, una función pura nueva en `correos.js`. Devuelve el texto que hoy arma `verVistaPrevia` (~444-446): los dos textos actuales sin cambios. Si hay `motivo`, antepone en su propia línea: `Hoy no se generan notas (${motivo}): así saldría el ${fecha(f)}.`, con el `fecha()` de `correos.js:81`. `verVistaPrevia` la usa. El archivo sigue solo declarando al cargarse.

- [ ] **Step 1: Tests**
  - En `correos-frontend.test.js`, `textoDeVistaPrevia` sin `motivo` da exactamente el texto de hoy (los dos casos, ejemplo y real). Con `motivo: 'día no hábil'` y `fecha: '2026-12-21'`, empieza con `Hoy no se generan notas (día no hábil): así saldría el 21/12/2026.`
  - En el texto de ayuda de `correos.html` (~442), reemplazar "Cómo saldría hoy" por "Cómo saldría en la próxima corrida con notas" y "si hoy no sale ninguna" por "si no saldría ninguna". Actualizar la aserción de `~1291`.
  - `VERSION_CORREOS = '20261107'`.
- [ ] **Step 2: Correr y ver que fallan.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Documentación.**
  - `CLAUDE.md`: en la línea de `correos.js` (sección Frontend), sumar: "La vista previa y la prueba muestran la nota como saldría en la próxima corrida con notas (`fechaDeVistaPrevia`, con la misma selección que la corrida: `avisoDelDia`); si no es hoy, lo avisan (spec 2026-10-15, 7.7)."
  - `README.md`: una entrada arriba del Changelog, "Vista previa como sale (2026-10)", con una o dos líneas. Sin nombres de personas.
- [ ] **Step 5: Correr** `node --test --test-concurrency=1 tests/correos-frontend.test.js tests/paginas.test.js` y después `npm test` completo.
- [ ] **Step 6: Commit**
  ```bash
  git add public/js/correos.js public/correos.html tests/correos-frontend.test.js tests/paginas.test.js CLAUDE.md README.md
  git commit -m "feat: Correos avisa cuando la vista previa muestra otro día; documentación"
  ```
