# Aviso en su fecha con persona autorizada — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Durante la licencia del firmante titular con persona autorizada, cada dataset avisado por adelantado en la víspera vuelve a salir en un aviso en su fecha normal, presentado por la persona autorizada, con un párrafo que cita la nota anticipada.

**Architecture:** Una regla pura nueva calcula el día del aviso en su fecha (`licenciasReglas.js`). Una consulta nueva trae los datasets adelantados pendientes de ese aviso (`notasDigitalesDatos.js`). La corrida diaria los suma al aviso del día solo cuando la persona autorizada presenta (`modo === 'autorizado'`). El contenido arma el párrafo a partir de los datasets marcados `adelantado`. La reiteración pasa a dar una fila por dataset aunque tenga dos avisos, y "Informado en" nombra todos. Correos → Estado y los textos de Correos y Usuarios lo reflejan.

**Tech Stack:** Node 22 (ESM), Express, MariaDB (mysql2), node:test, JS sin frameworks en el navegador.

**Spec:** `docs/superpowers/specs/2026-10-15-dias-habiles-licencias-auditoria-design.md`, sección 7.6 (nueva) y las menciones en 1, 7.2, 7.4, 7.5 y 14.

## Global Constraints

- Sin migración: el esquema no cambia (`notas_digitales_datasets` ya admite dos filas de aviso por dataset y vencimiento; su clave es `(nota_id, dataset_id)`).
- Sin persona autorizada no cambia nada, y la víspera (anticipo, párrafo de autorización, nota de autorización) sigue igual.
- ES Modules, código y textos en español, SQL siempre parametrizado con `?`. Hoy es `hoyArgentina()` o el `hoy` que recibe la función, nunca `CURDATE()`.
- `services/licenciasReglas.js` sigue siendo puro (sin pool ni `Date` local; fechas como texto `'AAAA-MM-DD'`).
- Ningún email real: los tests usan Mailpit y direcciones `@rpad.test` (`tests/helpers.js` lo verifica).
- `npm test` completo antes y después de cada tarea (requiere `docker compose up -d` y `RPAD_TESTS_DB_LOCAL=1`). Línea de base: 2114 tests, 2109 pasan, 0 fallan, 5 omitidos.
- Formas que fijan tests existentes y no cambian: `estado.licencia_firmante` (deepEqual en `tests/notas-licencias.test.js:651`); `proximas[g].aviso` como `{ fecha, cantidad }`; `informado` de un dataset con un solo aviso como `{ numero, anio, fecha }`, sin claves nuevas (deepEqual en `tests/notas-datos.test.js:170` y `:241`).
- En la nota en su fecha, el asunto lleva el mes de la nota (`(gestión externa – diciembre 2026)`); el rango "vencimientos de …" queda solo para el aviso anticipado de la víspera.
- Cache-busting: se sube el `?v=` solo de los scripts que cambian (`correos.js`, `usuarios.js`) y su constante en `tests/paginas.test.js`.
- Ningún texto versionado lleva nombres de personas reales.

## Review Focus

1. **Una segunda corrida el mismo día** (o un reintento manual): no tiene que generar otro aviso en su fecha. La condición "una sola fila de aviso para ese vencimiento" lo cubre; test en la Tarea 3.
2. **La vuelta de una licencia sin autorizado:** los datasets anticipados tienen `cuenta_desde`, pero no tiene que salir ningún aviso en su fecha (solo `modo === 'autorizado'`). Test en la Tarea 3.
3. **Un dataset que se actualizó entre la víspera y su fecha** (cambió `proxima_actualizacion`): no se vuelve a pedir. Test en las Tareas 1 y 3.
4. **La reiteración de un dataset con dos avisos:** una sola fila (si no, la clave primaria de `notas_digitales_datasets` hace fallar la nota entera y el mes nunca se marca). Tests en las Tareas 1 y 3.
5. **Un aviso en su fecha que se junta con un dataset nuevo el mismo día:** el párrafo nombra solo los adelantados. Test puro en la Tarea 2.

---

### Task 1: Selección — día del aviso en su fecha, pendientes y reiteración sin duplicados

**Files:**
- Modify: `services/licenciasReglas.js` (nueva función pura; sumar `diaHabilAnterior` y `ultimoDiaHabilHasta` al import de `./notasDigitalesCalendario.js`)
- Modify: `services/notasDigitalesDatos.js` (nueva `pendientesEnSuFecha`; `seleccionarParaReiteracion` sin duplicados)
- Modify: `tests/notas-fixtures.js` (`crearNota` acepta `cuentaDesde` por dataset)
- Test: `tests/licencias-reglas.test.js`, `tests/notas-datos.test.js`

**Interfaces:**
- Produces:
  - `diaDelAvisoEnSuFecha({ cuentaDesde, licencia: { desde, hasta }, ausencias = [] })` → `'AAAA-MM-DD' | null`. Es `cuentaDesde` si no cae en ninguna ausencia; si no, el último día hábil anterior que no cae en ninguna, sin bajar de `licencia.desde`; `null` si no hay ninguno, si `cuentaDesde` no es una fecha o si está fuera de `[desde, hasta]`. `ausencias`: `[{ desde, hasta }]` (las de `disponibilidadDelAutorizado`, sin unir).
  - `pendientesEnSuFecha(gestion, hoy, licencia, ausencias)` → `Promise<Array>`. Cada elemento trae las columnas de `COLUMNAS_DATASET` pasadas por `conPedido(fila, hoy)`, más `cuenta_desde` (`'AAAA-MM-DD'`), `adelantado: { numero, anio, fecha }` (la nota que lo adelantó) y `dia_en_su_fecha` (`'AAAA-MM-DD'`). Solo los que tienen `dia_en_su_fecha` no nulo; **no** filtra por `dia_en_su_fecha <= hoy` (lo hacen la corrida y el Estado). Orden: vencimiento, título.
  - `seleccionarParaReiteracion(gestion, hoy)`: misma salida que hoy, pero una fila por dataset. `informado` es el primer aviso enviado de ese vencimiento (por fecha y por id), `{ numero, anio, fecha }`. Con más de uno, `informado` suma `tambien: [{ numero, anio, fecha }, …]` con los demás, en orden; con uno solo, no tiene la clave `tambien`.

- [ ] **Step 1: Tests de la regla pura** en `tests/licencias-reglas.test.js`, un `describe('diaDelAvisoEnSuFecha (spec 7.6)')` con el comentario de calendario de diciembre de 2026 (el 08 es feriado, el 25 es feriado, el 10 es jueves) y `const lic = { desde: '2026-12-10', hasta: '2027-01-08' }`:
  ```js
  assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde: '2026-12-22', licencia: lic }), '2026-12-22');
  assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde: '2026-12-22', licencia: lic, ausencias: [{ desde: '2026-12-21', hasta: '2026-12-23' }] }), '2026-12-18');
  assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde: '2026-12-22', licencia: lic, ausencias: [{ desde: '2026-12-18', hasta: '2026-12-18' }, { desde: '2026-12-21', hasta: '2026-12-23' }] }), '2026-12-17');
  assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde: '2026-12-22', licencia: lic, ausencias: [{ desde: '2026-12-10', hasta: '2026-12-23' }] }), null); // falta desde el primer día
  assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde: '2027-01-11', licencia: lic }), null); // fuera de la licencia
  assert.equal(diaDelAvisoEnSuFecha({ cuentaDesde: null, licencia: lic }), null);
  ```
- [ ] **Step 2: Correr y ver que falla** — `node --test tests/licencias-reglas.test.js` → falla (`diaDelAvisoEnSuFecha` no existe).
- [ ] **Step 3: Implementar `diaDelAvisoEnSuFecha`** en `services/licenciasReglas.js` (bucle desde `ultimoDiaHabilHasta(cuentaDesde)` hacia atrás con `diaHabilAnterior`, mientras `>= licencia.desde`).
- [ ] **Step 4: Tests de la selección** en `tests/notas-datos.test.js`. Primero, `crearNota` (`tests/notas-fixtures.js:48-62`) escribe `cuenta_desde` desde `d.cuentaDesde ?? null` en su INSERT. Fechas fijas: licencia `{ desde: '2026-12-10', hasta: '2027-01-08' }`, hoy `'2026-12-22'`, dataset externo que vence `'2027-01-31'`.
  - `pendientesEnSuFecha devuelve el dataset adelantado con su nota, su cuenta_desde y su día`: un aviso (fecha `'2026-12-09'`, número 10, año 2026) con el dataset y `cuentaDesde: '2026-12-22'` → un elemento con `id`, `cuenta_desde === '2026-12-22'`, `dia_en_su_fecha === '2026-12-22'`, `adelantado` deepEqual `{ numero: 10, anio: 2026, fecha: '2026-12-09' }` y `pedido.texto` no vacío.
  - `… no devuelve el que ya tuvo su aviso en su fecha`: además, un segundo aviso del mismo vencimiento (número 11, fecha `'2026-12-22'`, `cuentaDesde: '2026-12-22'`) → `[]`.
  - `… no devuelve el que se actualizó`: `UPDATE datasets SET proxima_actualizacion = '2028-01-31'` → `[]`.
  - `… no devuelve una cuenta_desde fuera de la licencia`: `cuentaDesde: '2027-01-11'` → `[]`.
  - `… ignora los avisos de prueba` (`esPrueba: 1`) → `[]`.
  - `… con la persona autorizada de licencia el 22/12, el día es el 18/12`: `ausencias = [{ desde: '2026-12-21', hasta: '2026-12-23' }]` → `dia_en_su_fecha === '2026-12-18'`.
  - `seleccionarParaReiteracion da una fila por dataset con dos avisos, y los dos en informado`: los dos avisos enviados (10/26 del 09/12 y 11/26 del 22/12, los dos con `cuentaDesde: '2026-12-22'`), hoy `'2027-02-01'` → una sola fila del dataset, `informado` deepEqual `{ numero: 10, anio: 2026, fecha: '2026-12-09', tambien: [{ numero: 11, anio: 2026, fecha: '2026-12-22' }] }`.
  - Los tests existentes de `informado` (`:170`, `:241`) siguen pasando sin cambios.
- [ ] **Step 5: Correr y ver que falla** — `node --test tests/notas-datos.test.js`.
- [ ] **Step 6: Implementar `pendientesEnSuFecha`** en `services/notasDigitalesDatos.js`. La consulta une `datasets` con la fila de aviso (`notas_digitales_datasets` + `notas_digitales` tipo `'aviso'`, `es_prueba = 0`, cualquier estado) del vencimiento actual (`ndd.vencimiento = d.proxima_actualizacion`), con estas condiciones:
  - `CONDICION_BASE` de la gestión y `d.proxima_actualizacion >= ?` (hoy);
  - `ndd.cuenta_desde BETWEEN ? AND ?` (`licencia.desde`, `licencia.hasta`);
  - exactamente **una** fila de aviso (`es_prueba = 0`, cualquier estado) para ese dataset y vencimiento.
  
  Calcula `dia_en_su_fecha` con `diaDelAvisoEnSuFecha` y descarta los `null`.
- [ ] **Step 7: Reiteración sin duplicados.** `seleccionarParaReiteracion` deja de devolver una fila por aviso: ordena las filas por dataset, fecha e id del aviso, y en JS arma una fila por dataset con `informado` (el primero) y, solo si hay más, `informado.tambien`. La condición de los 20 días (`COALESCE(avd.cuenta_desde, av.fecha)`) y `REITERACIONES_PREVIAS` no cambian.
- [ ] **Step 8: Correr** `node --test tests/licencias-reglas.test.js tests/notas-datos.test.js` → pasan. Después `npm test` completo → 0 fallas.
- [ ] **Step 9: Commit**
  ```bash
  git add services/licenciasReglas.js services/notasDigitalesDatos.js tests/notas-fixtures.js tests/licencias-reglas.test.js tests/notas-datos.test.js
  git commit -m "feat: selección del aviso en su fecha y reiteración con una fila por dataset aunque tenga dos avisos"
  ```

### Task 2: Contenido — el párrafo del adelanto y "Informado en" con varias notas

**Files:**
- Modify: `services/notasDigitalesContenido.js`, `services/notasDigitalesPdf.js`
- Test: `tests/notas-contenido.test.js`, `tests/notas-pdf.test.js`

**Interfaces:**
- Consumes: datasets con `adelantado: { numero, anio, fecha }` (Tarea 1) e `informado` con `tambien` opcional.
- Produces:
  - `textoAdelanto(datasets)` → `string | null`, exportada y pura.
  - `construirNota(...)` devuelve además `adelanto: textoAdelanto(datasets)` (solo en `tipo === 'aviso'`; en la reiteración, `null`).
  - `construirNotaDeAutorizacion` y `construirNotaDeAuditoria` devuelven `adelanto: null`.
  - `renderHtml`, `renderTexto` y el PDF dibujan `nota.adelanto` inmediatamente después de `nota.autorizacion`, con el mismo formato (`parrafo(...)` en HTML; `lineas.push(texto, '')` en texto; en el PDF, el mismo bloque `asegurarEspacio` + `parrafo` de `notasDigitalesPdf.js:497-500`).

Textos exactos (la fecha con `formatoCorto`, el número con `textoNumero`):
- Ningún dataset con `adelantado` → `null`.
- Todos adelantados por la misma nota → `Este pedido ya se había adelantado por Nota Digital N° 10/26 del 09/12/2026.`
- Si no, una oración por cada nota que adelantó alguno, en el orden de su primera aparición en los datasets, separadas por un espacio:
  - uno: `El conjunto de datos "Título A" ya se había adelantado por Nota Digital N° 10/26 del 09/12/2026.`
  - varios: `Los conjuntos de datos "Título A", "Título B" y "Título C" ya se habían adelantado por Nota Digital N° 10/26 del 09/12/2026.`
- `textoInformado` con `tambien`: `Nota Digital N° 10/26 (09/12/2026) y N° 11/26 (22/12/2026)`; con tres, `Nota Digital N° 10/26 (09/12/2026), N° 11/26 (22/12/2026) y N° 1/27 (04/01/2027)`; después, ` – reiterado …` como hoy. Sin `tambien`, idéntico a hoy (lo usa también la nota de auditoría, `:362`).

- [ ] **Step 1: Tests puros** en `tests/notas-contenido.test.js`:
  - `textoAdelanto`: los tres casos de arriba (todos de la misma nota; mezcla con un dataset sin `adelantado`, con uno y con dos títulos; dos notas distintas → dos oraciones).
  - `construirNota` de un aviso con datasets adelantados: `nota.adelanto` es el texto; en `renderHtml(nota)` el párrafo aparece después del primer párrafo y antes de `<table`; en `renderTexto(nota)`, en una línea propia después del primer párrafo.
  - Sin datasets adelantados, `nota.adelanto === null` y el HTML y el texto quedan idénticos a hoy (los tests de `:478-511` siguen pasando).
  - Reiteración con `informado.tambien`: la celda dice `Nota Digital N° 10/26 (09/12/2026) y N° 11/26 (22/12/2026)` (HTML y texto, como `:214` y `:222`).
- [ ] **Step 2: Correr y ver que falla** — `node --test tests/notas-contenido.test.js`.
- [ ] **Step 3: Implementar** en `notasDigitalesContenido.js` (`textoAdelanto`, `adelanto` en las tres construcciones, render HTML y texto, `textoInformado` con `tambien`).
- [ ] **Step 4: Tests del PDF** en `tests/notas-pdf.test.js`:
  - un aviso con `adelanto` muestra el párrafo en la hoja 1, después del primer párrafo y antes de la tabla, como el de autorización (`:940-965`);
  - sumar a `REITERACION_REAL` (`:141-155`) un dataset con `informado.tambien`, para que los barridos de "ninguna tabla parte una palabra ni una fecha" (`:191`, `:206`, `:271`, `:868`, `:887`) lo cubran.
- [ ] **Step 5: Implementar** el bloque del PDF y correr `node --test tests/notas-contenido.test.js tests/notas-pdf.test.js` → pasan. Después, `npm test` completo.
- [ ] **Step 6: Commit**
  ```bash
  git add services/notasDigitalesContenido.js services/notasDigitalesPdf.js tests/notas-contenido.test.js tests/notas-pdf.test.js
  git commit -m "feat: párrafo que cita la nota anticipada y \"Informado en\" con todos los avisos"
  ```

### Task 3: Motor — el aviso en su fecha en la corrida diaria

**Files:**
- Modify: `services/notasDigitales.js` (`correrPasos`, el paso 2 de avisos, `:458-482`)
- Test: `tests/notas-licencias.test.js`

**Interfaces:**
- Consumes: `pendientesEnSuFecha` y `diaDelAvisoEnSuFecha` (Tarea 1), `textoAdelanto` vía `construirNota` (Tarea 2), `disponibilidadDelAutorizado(licencia)` de `notasDigitalesFirmas.js` (`→ { primer_dia_disponible, ausencias } | null`).

Cambios en `correrPasos`:
- Solo si `modo === 'autorizado'` (después del control de `firma.leyenda`), por cada gestión se calculan las ausencias una vez: `(await disponibilidadDelAutorizado(licencia))?.ausencias ?? []`. Los datasets del aviso son los de `prepararAviso(gestion, hoy, anticipo)` más los de `pendientesEnSuFecha(gestion, hoy, licencia, ausencias)` con `dia_en_su_fecha <= hoy`, ordenados por vencimiento y título. `licencia` es la del titular que devuelve `firmaParaFecha`.
- `rangoVencimientos` solo si hay `anticipo` (hoy: `datasets.some(d => d.cuenta_desde)`, que los datasets en su fecha también cumplen).
- La nota en su fecha no lleva `autorizacion` (`conAutorizacion` ya exige `anticipo`) y guarda la `cuenta_desde` de cada dataset (ya viene en el dataset).

- [ ] **Step 1: Tests de integración** en `tests/notas-licencias.test.js`: un `describe('aviso en su fecha con persona autorizada (spec 7.6), licencia del 10/12/2026 al 08/01/2027')` después del bloque que termina en `:235`. Seguir los helpers del archivo (`licencia`, `crearDataset`, `correr`, `notas`, `datasetsDe`, `notaDeAutorizacionDe`, `lineasPorHoja`, `mailpit.esperar`). `beforeEach`: `licencia(titular, '2026-12-10', '2027-01-08', autorizado)` y un dataset externo `'Externo de enero'` que vence `'2027-01-31'`. Un helper `vispera()` corre `'2026-12-09'` y verifica un solo aviso externo del titular, con el párrafo de autorización del 10/12/2026 al 08/01/2027 y `datasetsDe` = `[{ dataset_id, cuenta_desde: '2026-12-22' }]`. Los tests:
  - `el 22/12 la persona autorizada vuelve a presentar el aviso, con las dos firmas y el párrafo que cita la nota de la víspera`:
    - el 21/12 no sale nada;
    - el 22/12 sale un aviso externo con `firmante_id` del titular y `presentada_por_id` de la autorizada;
    - asunto exacto `Nota Digital N° {n}/26 – Ref.: Solicitud de gestión de datos para el Portal de Datos Abiertos Municipal (gestión externa – diciembre 2026)`;
    - leyenda; párrafo `Este pedido ya se había adelantado por Nota Digital N° {víspera}/26 del 09/12/2026.` antes de `<table` en el HTML y presente en `texto`;
    - sin `Asimismo` y sin la autorizada en CC;
    - las dos firmas en la última hoja del PDF;
    - `datasetsDe` = `[{ dataset_id, cuenta_desde: '2026-12-22' }]`;
    - el email en Mailpit;
    - el 23/12 no se repite.
  - `la reiteración del 01/02/2027 muestra el dataset una sola vez, con las dos notas en "Informado en"`: el 04/01 no hay reiteración externa; el 01/02, `errores` vacío, una reiteración externa con ese único dataset y `>Nota Digital N° {víspera}/26 (09/12/2026) y N° {en su fecha}/26 (22/12/2026)` en el HTML y en el texto.
  - `con la persona autorizada de licencia del 21/12 al 23/12, sale el viernes 18/12`: `licencia(autorizado, '2026-12-21', '2026-12-23')`; el 17/12 no sale nada y el 18/12 sale el aviso presentado por ella.
  - `no repite un dataset que ya se actualizó`: después de la víspera, `proxima_actualizacion = '2028-01-31'` → el 22/12 no sale nada.
  - `si la corrida del 22/12 no se hizo, sale en la siguiente`: se corre recién el 23/12 → un aviso en su fecha con fecha 23/12.
  - `una segunda corrida el mismo día no lo repite`: dos `correr('2026-12-22')` → un solo aviso en su fecha.
  - `junto con un dataset nuevo del día, el párrafo nombra solo el adelantado`: antes del 22/12, `crearDataset({ titulo: 'Externo nuevo', gestion: 'externa', vencimiento: '2027-01-31' })`. El 22/12 sale un solo aviso con los dos, y el párrafo es `El conjunto de datos "Externo de enero" ya se había adelantado por …`.
  - `sin persona autorizada no hay aviso en su fecha, tampoco a la vuelta`: con la licencia sin autorizado, el 22/12 `resumen.licencia` dice "sin autorizado" y no hay notas nuevas. El 11/01/2027 solo salen reiteraciones (ningún aviso con fecha 11/01).
- [ ] **Step 2: Correr y ver que falla** — `node --test tests/notas-licencias.test.js` (el 22/12 no genera nada).
- [ ] **Step 3: Implementar** los cambios en `correrPasos`.
- [ ] **Step 4: Correr** `node --test tests/notas-licencias.test.js tests/notas-auditoria.test.js tests/notas-motor.test.js` → pasan, incluidos los existentes (`notas-auditoria.test.js:241` incluido). Después, `npm test` completo.
- [ ] **Step 5: Commit**
  ```bash
  git add services/notasDigitales.js tests/notas-licencias.test.js
  git commit -m "feat: con persona autorizada, cada aviso adelantado sale también en su fecha"
  ```

### Task 4: Correos → Estado y los textos de Correos y Usuarios

**Files:**
- Modify: `services/notasDigitales.js` (`licenciaDelFirmante`, `estadoNotas`)
- Modify: `public/js/correos.js` (`textoLicenciaFirmante`, `:593`), `public/js/usuarios.js` (`efectoEnNotas`, `:52` y `:57`), `public/correos.html` (`?v=` de `correos.js`), `public/usuarios.html` (`?v=` de `usuarios.js`)
- Test: `tests/notas-licencias.test.js` (bloque `Estado de Correos (spec 7.5)`, `:646`), `tests/correos-frontend.test.js`, `tests/usuarios-frontend.test.js`, `tests/paginas.test.js`

**Interfaces:**
- Consumes: `pendientesEnSuFecha`, `diasHabilesLibres` (Tarea 1 y `licenciasReglas.js`), `disponibilidadDelAutorizado`.
- `estado.licencia_firmante` no cambia de forma. `licenciaDelFirmante` puede devolver, aparte, lo que el Estado necesita (la licencia del titular y las ausencias), pero el objeto público queda igual.

Regla del próximo aviso (después del bloque de `:783-789`, solo si `licencia?.autorizado && !licencia.sin_dias_habiles`; **no** se condiciona a `en_curso`). Por gestión:
- `pendientes = await pendientesEnSuFecha(gestion, corrida, licenciaDelTitular, ausencias)`.
- Por cada pendiente, `efectiva = dia_en_su_fecha >= corrida ? dia_en_su_fecha : diasHabilesLibres(corrida, licencia.hasta, ausencias).primerDia`. Si da `null`, el pendiente no entra.
- `fecha = mínimo de efectiva`.
- `cantidad = (await seleccionarParaAviso(gestion, fecha)).length + pendientes con efectiva <= fecha`.
- `aviso = el más temprano entre el de hoy y { fecha, cantidad }`. Si es el mismo día, la cantidad ya suma los dos.
- La forma sigue siendo `{ fecha, cantidad }`.

Textos:
- `correos.js`, licencia futura con autorizado:
  `Licencia del firmante ${periodo}: los avisos se anticipan el ${fecha(l.vispera)} con la autorización a ${autorizado}, que durante la licencia presenta las demás notas y vuelve a presentar cada aviso en su fecha.`
  La de la licencia en curso no cambia.
- `usuarios.js`, licencia futura con autorizado:
  `Los avisos que tocarían durante la licencia salen por adelantado ${cuando} (corrida de las 8:15), en una nota que comunica la autorización a ${autorizadoNombre}. Durante la licencia, ${autorizadoNombre} presenta las demás notas con las dos firmas, citando esa nota, y vuelve a presentar cada aviso en su fecha.`
- `usuarios.js`, licencia en curso con autorizado:
  `Licencia en curso: ${autorizadoNombre} presenta las notas con las dos firmas, citando la nota que comunica la autorización (si todavía no salió, la próxima corrida la genera primero), y vuelve a presentar en su fecha cada aviso que se adelantó.`
  Este texto no puede contener "por adelantado": lo prohíbe `tests/usuarios-frontend.test.js:193`.
- Versiones: `correos.js` y `usuarios.js` pasan a `?v=20261106` en su HTML, con sus constantes en `tests/paginas.test.js`.
  - Si `VERSION_PANTALLAS` fija también otros scripts que no cambian, separarlo en una constante propia para `usuarios.js`.
  - Actualizar los comentarios de esas constantes.

- [ ] **Step 1: Tests**
  - En `notas-licencias.test.js`, en el describe de la Tarea 3: `Estado: durante la licencia, el próximo aviso externo es el en su fecha`. Después de la víspera, `estadoNotas({ hoy: '2026-12-14' })` da `proximas.externa.aviso` deepEqual `{ fecha: '2026-12-22', cantidad: 1 }`. Con la autorizada de licencia del 21/12 al 23/12, da `{ fecha: '2026-12-18', cantidad: 1 }`.
  - Los tests del Estado de `:646-695` siguen pasando sin cambios.
  - En `correos-frontend.test.js`, los textos exactos de `:135-137` y `:147-150` pasan al texto nuevo; `:125-128` y `:138-140` no cambian.
  - En `usuarios-frontend.test.js:176-197`, sumar `assert.match(texto, /vuelve a presentar cada aviso en su fecha/)` a la licencia futura y `/vuelve a presentar en su fecha cada aviso que se adelantó/` a la licencia en curso. Las aserciones existentes siguen.
  - En `paginas.test.js`, las versiones nuevas.
- [ ] **Step 2: Correr y ver que fallan** — `node --test tests/notas-licencias.test.js tests/correos-frontend.test.js tests/usuarios-frontend.test.js tests/paginas.test.js`.
- [ ] **Step 3: Implementar** la regla del Estado, los textos y las versiones.
- [ ] **Step 4: Correr** esos archivos → pasan. Después, `npm test` completo.
- [ ] **Step 5: Commit**
  ```bash
  git add services/notasDigitales.js public/js/correos.js public/js/usuarios.js public/correos.html public/usuarios.html tests/notas-licencias.test.js tests/correos-frontend.test.js tests/usuarios-frontend.test.js tests/paginas.test.js
  git commit -m "feat: Correos y Usuarios muestran el aviso en su fecha durante la licencia con persona autorizada"
  ```

### Task 5: Documentación

**Files:**
- Modify: `CLAUDE.md` (sección "Firma de las Notas Digitales y licencia del firmante"), `README.md` (`:54` y el Changelog)

- [ ] **Step 1: `CLAUDE.md`.** En "Firma de las Notas Digitales y licencia del firmante", después de la oración que empieza "Con persona autorizada, esos avisos (o una nota de tipo `autorizacion`) comunican la autorización", sumar:
  > Durante la licencia, cada dataset adelantado vuelve a salir en un aviso en su fecha (su `cuenta_desde`, o el último día hábil anterior en que la persona autorizada está disponible), presentado por ella y con el párrafo "Este pedido ya se había adelantado por Nota Digital N° …" (`diaDelAvisoEnSuFecha` en `services/licenciasReglas.js`, `pendientesEnSuFecha` en `services/notasDigitalesDatos.js`, spec 7.6). La reiteración da una fila por dataset y "Informado en" nombra todos sus avisos.
- [ ] **Step 2: `README.md`.** Actualizar `:54` para que diga que la persona autorizada vuelve a presentar cada aviso en su fecha, y sumar al Changelog una entrada "Aviso en su fecha con persona autorizada (2026-10)" de una o dos líneas. No lleva nombres de personas.
- [ ] **Step 3: Correr** `npm test` completo (la documentación no rompe tests, pero la regla del proyecto lo pide).
- [ ] **Step 4: Commit**
  ```bash
  git add CLAUDE.md README.md
  git commit -m "docs: aviso en su fecha con persona autorizada en CLAUDE.md y el README"
  ```
