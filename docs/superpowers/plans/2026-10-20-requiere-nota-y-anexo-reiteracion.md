# «Requiere nota DGMIT» y anexo de la reiteración — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar a los datasets externos el dato «Requiere nota DGMIT» (Sí/No) y mostrarlo en las notas externas, el Seguimiento y la administración. Además, sumar a cada reiteración un anexo con la hoja del Seguimiento de cada dataset.

**Architecture:** El dato es una columna nueva, `datasets.requiere_nota`, que recorre el circuito de siempre: el formulario, la doble verificación y las listas fijas de campos. Las notas lo leen de `COLUMNAS_DATASET`. Las tablas se arman en `construirNota` (puro) y el PDF las dibuja con proporciones propias de cada diseño. El anexo de la reiteración reutiliza el dibujo de la hoja del Seguimiento (`seguimientoPdf.js`) para N hojas en un solo documento. Se genera en `generarNota` y se guarda en `notas_digitales.anexo_pdf`, igual que el anexo del aviso.

**Tech Stack:** Node.js 22 (ES modules), Express, MariaDB (mysql2), PDFKit, vanilla JS, `node --test` y `tests/pdf-lector.js`.

**Spec:** `docs/superpowers/specs/2026-10-20-requiere-nota-y-anexo-reiteracion-design.md`. Ante una duda, manda la spec.

## Global Constraints

- **No romper lo implementado.** `npm test` completo (con Docker arriba y `RPAD_TESTS_DB_LOCAL=1`) antes de empezar y al final de cada tarea. Hay que superar la línea de base, guardada en el scratchpad (`base-npm-test.txt`).
- **Ningún email real.** En local todo va a Mailpit. La simulación usa una base propia, nunca `datospublicos_mcr_rpad`.
- **Valores de `requiere_nota`:** `1` Sí, `0` No, `NULL` sin dato. En gestión interna siempre NULL. Nunca `x || null` sobre este campo; siempre `??`.
- **Textos exactos** (copiar tal cual):
  - Encabezado de columna y rótulo de campo: `Requiere nota DGMIT`.
  - Valores en la nota: `Sí`, `No`, `—`. En el Seguimiento: `Sí`, `No`, `Sin dato`.
  - Validación (servidor y copia en el navegador): `Indicá si el dataset requiere nota DGMIT.`
  - Circuito con «No»: el rol del medio es `No hace falta nota formal`; el tramo, título `Sin nota formal` y texto `Los datos se obtienen de la fuente`.
  - Renglón de la reiteración: `Anexo: seguimiento de los conjuntos de datos (N hojas).` (`1 hoja` en singular).
  - Pie del anexo: `Anexo de la Nota Digital N° <numeroTexto> · Hoja <k> de <N>`.
  - Primera línea del email de la reiteración: `SE ADJUNTAN NOTA Y ANEXO EN PDF`. La autorización y la auditoría siguen con `SE ADJUNTA NOTA EN PDF`.
- **Proporciones del PDF:**
  - aviso externo (5 columnas): `[28, 24, 15, 10, 23]`;
  - reiteración externa con la segunda parte de «Informado en»: `[18, 14, 10, 10, 13, 10, 25]`;
  - reiteración externa sin la segunda parte: `[24, 14, 10, 10, 15, 12, 15]`.
- **Columna en la base:** `requiere_nota TINYINT(1) NULL DEFAULT NULL AFTER tipo_gestion`.
- **Frontend:**
  - todo script que cambie lleva un `?v=` nuevo, y se actualizan las constantes de `tests/paginas.test.js`;
  - el que se carga en un `vm` sigue declarando solo al cargarse.
- **Carga inicial:**
  - **No (0):** 10, 30, 35, 36, 50, 63, 74, 77, 78 y 81.
  - **Sí (1):** 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 13, 22, 23, 25, 27, 32, 33, 42, 44, 46, 48, 52, 53, 54, 56, 57, 58, 59, 61, 69, 70, 71, 72, 73 y 75.
- **Rama:** `feat/requiere-nota-y-anexo-reiteracion`, con un commit por tarea. Los mensajes terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Un «No» (0) que se pierde en el camino.** El formulario manda `"0"`; si la propuesta, la aprobación (INSERT y UPDATE) o el enriquecido usan `||`, se guarda NULL. Esperado: se propone «No», se aprueba y la base tiene 0. → Task 2.
2. **Cambiar la gestión.** De externa a interna con `requiere_nota = 1`, se guarda NULL. De interna a externa sin el dato, 400 con el mensaje exacto. Una edición que solo cambia este dato es un cambio real, no un 400 «No se detectaron cambios». → Task 2.
3. **Una reiteración externa con un dataset próximo a vencer (no vencido).** La celda dice «Vence» con «Vence en N días» debajo, va en la sección de próximos y es la primera hoja del anexo. → Tasks 5 y 9.
4. **Un externo con NULL.** La nota muestra «—», el Seguimiento «Sin dato», recibe el email de 40 días y su circuito es el de siempre. → Tasks 5, 6 y 7.
5. **Vista previa y prueba de una reiteración sin datos reales (ejemplo).** El anexo de ejemplo se arma sin consultar la base y no falla con los ids 0 y -1. → Task 10.

---

### Task 1: La columna y las migraciones

**Files:**
- Modify: `database/schema.sql` (tabla `datasets`, después de `tipo_gestion`)
- Create: `database/updates/migracion-requiere-nota.sql`, `database/updates/migracion-requiere-nota-datos.sql`
- Test: `tests/schema.test.js`

**Interfaces:**
- Produces: la columna `datasets.requiere_nota`, que todas las tareas siguientes leen.

- [ ] **Step 1: Write the failing tests** en `tests/schema.test.js`, con el molde de `tipo_pedido` (:162-188 y :277-330):
  - `'datasets tiene requiere_nota TINYINT(1) NULL después de tipo_gestion'`;
  - `'migracion-requiere-nota.sql se puede repetir y deja NULL'`;
  - `'migracion-requiere-nota-datos.sql: los 10 «No» quedan en 0, los 35 «Sí» en 1, los internos en NULL y no pisa un valor ya cargado'`, sobre una base de prueba propia, con el molde de `tests/fechas-datos.test.js`.
- [ ] **Step 2: Run** `node --test tests/schema.test.js`. Expected: FAIL (no existe la columna).
- [ ] **Step 3: Implement.**
  - **Estructura:** cabecera como `migracion-fechas-datasets.sql` (spec, «Solo agrega», ORDEN «ANTES de subir el código»), `SET NAMES utf8mb4`, `ALTER TABLE datasets ADD COLUMN IF NOT EXISTS requiere_nota TINYINT(1) NULL DEFAULT NULL AFTER tipo_gestion;`.
  - **Datos:** un `UPDATE datasets SET requiere_nota = <0|1> WHERE id = <N> AND tipo_gestion = 'externa' AND requiere_nota IS NULL;` por cada id de la carga inicial, con el título del dataset en un comentario. Al final, la consulta de verificación comentada: `SELECT id, titulo FROM datasets WHERE activo = 1 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;`, que tiene que devolver 0 filas.
  - Sin `CHECK`, `DELIMITER`, `USE` ni `DROP` (`schema.test.js:301-304`).
- [ ] **Step 4: Aplicar las dos migraciones a la base local** (`docker exec -i … mariadb -uroot datospublicos_mcr_rpad < …`), porque `schema.test.js:55-61` compara `schema.sql` con la base Docker. Run `node --test tests/schema.test.js`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: columna requiere_nota y su carga inicial`.

### Task 2: El dato en la API y la doble verificación

**Files:**
- Modify: `controllers/datasetController.js` (`hayCambiosReales` :70, `createDataset` :449-530, `updateDataset` :549-690)
- Modify: `controllers/cambiosPendientesController.js` (`enriquecerDatos` :36-48, `calcularCambios` :66-86, `aprobarCambio` INSERT :474-495 y `campos` :515-520)
- Create: `services/requiereNotaReglas.js`
- Test: `tests/requiere-nota-api.test.js` (nuevo, con base de prueba como `fechas-escritura.test.js`); actualizar los tests que crean datasets externos por API sin el campo.

**Interfaces:**
- Produces (en `services/requiereNotaReglas.js`, puro):
  - `MENSAJE_FALTA_REQUIERE_NOTA = 'Indicá si el dataset requiere nota DGMIT.'`
  - `normalizarRequiereNota(valor) → 0 | 1 | null | undefined`: `undefined` si no vino; `null` para `null`/`''`; `1` para `1`, `true`, `'1'`; `0` para `0`, `false`, `'0'`; cualquier otro valor tira `TypeError` (el controlador responde 400).
  - `requiereNotaResultante({ gestion, valor }) → 0 | 1 | null`: NULL si la gestión es interna; si no, el valor.
  - `textoRequiereNota(valor, sinDato = '—') → 'Sí' | 'No' | sinDato`.

- [ ] **Step 1: Write the failing tests** en `tests/requiere-nota-api.test.js`:
  - `'alta de un externo sin requiere_nota → 400 con MENSAJE_FALTA_REQUIERE_NOTA'`
  - `'alta de un externo con "0" → cambio pendiente con datos_nuevos.requiere_nota === 0; al aprobar, datasets.requiere_nota === 0'`
  - `'alta de un interno con 1 → se guarda NULL'`
  - `'edición que solo cambia requiere_nota de 1 a 0 → crea el cambio (no 400 «No se detectaron cambios»); al aprobar queda 0'`
  - `'edición externa → interna con requiere_nota 1 → datos_nuevos.requiere_nota === null'`
  - `'edición interna → externa sin el dato → 400'`
  - `'edición de un externo sin mandar el campo conserva el valor'`
  - `'requiere_nota "si" → 400'`
  - `'calcularCambios rotula «Requiere nota DGMIT» con Sí → No'`
  - `'aprobar un cambio viejo sin la clave no toca requiere_nota'` (UPDATE) y `'aprobar un alta vieja sin la clave lo deja NULL'` (INSERT)
- [ ] **Step 2: Run** `node --test tests/requiere-nota-api.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **`services/requiereNotaReglas.js`:** las tres funciones de Interfaces.
  - **`datasetController.js`:**
    - en `createDataset` y `updateDataset`, normalizar y calcular el valor resultante con la gestión resultante (`data.tipo_gestion ?? existente.tipo_gestion`);
    - si el resultado es externo y NULL, 400 con el mensaje;
    - sumar `requiere_nota` a `datosNuevos` y `datosAnteriores`, y `'requiere_nota'` a `hayCambiosReales`, comparando normalizado.
  - **`cambiosPendientesController.js`:**
    - `enriquecerDatos` agrega `requiere_nota_texto: textoRequiereNota(datos.requiere_nota)` cuando la clave existe;
    - `calcularCambios` suma `{ key: 'requiere_nota_texto', label: 'Requiere nota DGMIT', keyAntes: 'requiere_nota', keyDespues: 'requiere_nota' }` después de `tipo_gestion`;
    - en `aprobarCambio`, el INSERT del alta lleva `datosNuevos.requiere_nota ?? null` y `campos` del UPDATE suma `'requiere_nota'`.
  - **Tests existentes:** buscar los que hacen `POST /datasets` o `PUT /datasets/:id` de un externo sin el campo (`grep -rn "tipo_gestion" tests/`) y sumarles `requiere_nota: 1`.
- [ ] **Step 4: Run** `node --test tests/requiere-nota-api.test.js` y después `npm test`. Expected: PASS, y la línea de base intacta.
- [ ] **Step 5: Commit** `feat: requiere_nota en el alta, la edición y la aprobación de datasets`.

### Task 3: Rótulos en Mi Perfil, la nota de auditoría y los movimientos del Seguimiento

**Files:**
- Modify: `public/js/perfil.js` (`ETIQUETAS_DE_CAMPO` :799-815, `CAMPOS_DE_ALTA_Y_BAJA` :1050-1066, valores 0/1)
- Modify: `services/notasDigitalesContenido.js` (`CAMPOS_DEL_DATASET` :361-378, `valorDelCampo` :400-408)
- Modify: `services/seguimientoReglas.js` (`CAMPOS` :119-136, `textoDelValor` :155-165)
- Modify: `perfil.html` (`?v=`), `tests/paginas.test.js` (`VERSION_PERFIL`)
- Test: `tests/perfil-frontend.test.js`, `tests/notas-contenido.test.js`, `tests/seguimiento-reglas.test.js`

**Interfaces:**
- Consumes: `textoRequiereNota` (Task 2). `perfil.js` no la importa: le alcanza con una copia mínima del texto Sí/No para 0/1.

- [ ] **Step 1: Write the failing tests**:
  - `perfil-frontend`: `'la comparación muestra «Requiere nota DGMIT» con Sí y No'` (alta, edición y baja).
  - `notas-contenido`: `'la nota de auditoría lista «Requiere nota DGMIT: Sí» en un alta'`.
  - `seguimiento-reglas`: `'un cambio de solo requiere_nota dice «Cambió: requiere nota DGMIT» con de Sí a No'`, con el mismo orden exacto de :407-421.
- [ ] **Step 2: Run** esos tres archivos. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Etiqueta:** `'Requiere nota DGMIT'` en las tres listas.
  - **`seguimientoReglas`:** `{ campo: 'requiere_nota', rotulo: 'Requiere nota DGMIT', enTexto: 'requiere nota DGMIT', otro: true }` después de `tipo_gestion`; el valor, con `textoRequiereNota`.
  - **`perfil.js`:** el 0/1 numérico se muestra Sí/No solo para este campo.
- [ ] **Step 4: Run** esos tres archivos y después `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: requiere nota DGMIT en la comparación, la nota de auditoría y los movimientos`.

### Task 4: Administración (formulario, filtro y vista previa)

**Files:**
- Modify: `public/admin.html` (fieldset «Actualización y pedido» :557-625, junto a `tipo_gestion` :565-570; barra de filtros :362-376; vista previa :614-618; `?v=` :814-815)
- Modify: `public/js/admin.js` (`estadoDeLista` :34, `filtrarPorBarra` :69-76, conexión de filtros :362-367, `openModal` :820-826, `formularioDelDataset` :897-910, cambio de gestión)
- Modify: `public/js/admin-fechas.js` (`cuerpoDelDataset` :881-906, `huellaDelFormulario` :913-916, vista previa :948-959)
- Modify: `tests/paginas.test.js` (`VERSION_ADMIN`)
- Test: `tests/admin-frontend.test.js`

**Interfaces:**
- Produces (en `admin-fechas.js`, puro):
  - `MENSAJE_FALTA_REQUIERE_NOTA`, copia del de Task 2;
  - `errorDeRequiereNota({ gestion, valor }) → string | null`;
  - `cuerpoDelDataset(...)` suma `requiere_nota`: `1`, `0` o `null` (interna o vacío);
  - `htmlDeVistaPreviaDeNota` (o la función que hoy arma esos `th`) suma la columna para los externos.

- [ ] **Step 1: Write the failing tests** en `admin-frontend.test.js`:
  - `'cuerpoDelDataset manda requiere_nota 0 con «No», 1 con «Sí» y null con gestión interna'` (actualizar el `deepEqual` de :2314-2321);
  - `'errorDeRequiereNota: externa sin elegir → mensaje exacto; interna → null'`;
  - `'el selector requiere_nota está en admin.html con Elegí una opción / Sí / No'`;
  - `'la vista previa de un externo tiene 4 th con «Requiere nota DGMIT» entre Frecuencia y Datos solicitados'` (y la interna sigue con 3);
  - `'la huella cambia si cambia requiere_nota'`;
  - `'filtro requiere nota: Sí deja solo externos con 1'`.
- [ ] **Step 2: Run** `node --test tests/admin-frontend.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Selector:** `<select id="requiere_nota">` con `<option value="">Elegí una opción</option><option value="1">Sí</option><option value="0">No</option>`, en una `.fila` con «Tipo de gestión». Su contenedor se oculta (`hidden`) con gestión interna.
  - **Filtro:** `<select id="filtro-requiere-nota">` con «Requiere nota: todos», «Sí» y «No», conectado como `filtro-gestion`.
  - **Al guardar:** `errorDeRequiereNota` bloquea con el mensaje.
  - **`openModal`:** carga el valor guardado (vacío si es NULL).
- [ ] **Step 4: Run** `node --test tests/admin-frontend.test.js tests/paginas.test.js` y después `npm test`. Expected: PASS.
- [ ] **Step 5: Verificar en el navegador:** levantar el dev server con preview, iniciar sesión con un usuario de prueba local y probar el alta de un externo sin elegir (debe avisar), el cambio a interna (el selector se oculta) y el filtro. Captura.
- [ ] **Step 6: Commit** `feat: requiere nota DGMIT en el formulario, el filtro y la vista previa del admin`.

### Task 5: Las tablas de las notas externas

**Files:**
- Modify: `services/notasDigitalesDatos.js` (`COLUMNAS_DATASET` :18-22)
- Modify: `services/notasDigitalesContenido.js` (`columnasDe` :195-199, celdas :237-246, la sección con `proporciones`, `tabla` HTML :606-627, `lineasDeSeccion` :678-693)
- Modify: `services/notasDigitalesPdf.js` (`PROPORCIONES` :32 con la clave 5; celda «Venció» de dos renglones)
- Modify: `services/notasDigitales.js` (`ejemplo()` :629-664: los ejemplos externos llevan `requiere_nota`)
- Test: `tests/notas-contenido.test.js`, `tests/notas-pdf.test.js`, `tests/notas-licencias.test.js`

**Interfaces:**
- Produces:
  - **Fila de la reiteración externa:** `{ valores: [titulo, area, frecuencia, requiere, pedido, venceFecha, informado], situacion: '<texto>', … }`. La situación viaja aparte (`fila.situacion`) y cada formato la dibuja debajo de la fecha, como `informadoAnterior` en «Informado en».
  - **Columnas de la reiteración externa:** `['Conjunto de datos', 'Área responsable', 'Frecuencia', 'Requiere nota DGMIT', 'Datos solicitados', 'Venció'|'Vence', 'Informado en']`, más `proporciones` (con o sin segunda parte, según Global Constraints).
  - **Aviso externo:** `['Conjunto de datos', 'Área responsable', 'Frecuencia', 'Requiere nota DGMIT', 'Datos solicitados']`.
  - **Interna:** sin cambios (4 y 7 columnas, con «Situación»).

- [ ] **Step 1: Write the failing tests** (actualizar las listas exactas de `notas-contenido.test.js` :61, 79, 86, 98, 108, 156, 165, 183, 267, 273, 308, 324, 364, 372, 398, 485, 497 según el diseño nuevo, y sumar):
  - `'aviso externo: 5 columnas con Requiere nota DGMIT; celdas Sí, No y — (NULL)'`
  - `'reiteración externa: 7 columnas sin Situación; la celda Venció lleva la fecha y fila.situacion «Vencido hace N días»'`
  - `'reiteración externa con un próximo: columna «Vence», situación «Vence en N días»'`
  - `'interna sin cambios: aviso 4 columnas y reiteración 7 con Situación'`
  - `'HTML: la situación va debajo de la fecha con <br> en la misma celda'`
  - `'texto plano de la reiteración externa: renglones «Venció: …» y «Situación: …»'`
  - `notas-pdf`: `'reiteración externa real (10 datasets del 02/11): ningún título partido'` (con `pdf-lector`, armando la nota con los datos de `CASOS` o con filas fijas que copien las del 02/11: Parque Automotor (Patentamiento), Ejecución presupuestaria, …) y `'aviso externo de 5 columnas: anchos dentro del ancho de texto'`.
- [ ] **Step 2: Run** `node --test tests/notas-contenido.test.js tests/notas-pdf.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `COLUMNAS_DATASET` suma `d.requiere_nota`.
  - Columnas y celdas según Interfaces, con `textoRequiereNota` (Task 2).
  - Las dos proporciones de la reiteración externa van en `seccion.proporciones` (`calcularAnchos` ya la respeta).
  - PDF: en la celda «Venció», la situación en un renglón aparte, del mismo tamaño.
  - `ejemplo()` con un externo en Sí y otro en No.
- [ ] **Step 4: Run** `node --test tests/notas-contenido.test.js tests/notas-pdf.test.js tests/notas-licencias.test.js` y después `npm test`. Expected: PASS.
- [ ] **Step 5: Comparar contra el mockup:** regenerar con el código real el aviso externo del 22/12 y la reiteración externa del 02/11 (scripts del scratchpad, contra una base con la columna) y verificar que coinciden con `2b` y `1` del Escritorio.
- [ ] **Step 6: Commit** `feat: columna Requiere nota DGMIT en el aviso y la reiteración externos`.

### Task 6: El email de los 40 días sin los «No»

**Files:**
- Modify: `services/avisosDiariosService.js` (`datasetsExternosPorArea` :26-45)
- Test: el test existente del aviso a áreas (`grep -rln "datasetsExternosPorArea" tests/`)

- [ ] **Step 1: Write the failing test** `'datasetsExternosPorArea deja afuera requiere_nota = 0 y conserva 1 y NULL'`.
- [ ] **Step 2: Run** el archivo. Expected: FAIL.
- [ ] **Step 3: Implement:** `AND (d.requiere_nota IS NULL OR d.requiere_nota = 1)` en el WHERE.
- [ ] **Step 4: Run** el archivo y después `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: sin email de 40 días al área si el dataset no requiere nota`.

### Task 7: El Seguimiento con el dato (ficha y circuito)

**Files:**
- Modify: `services/seguimientoDatos.js` (SELECT de `fuentesDe` :86-97, `aDataset` :59-63)
- Modify: `services/seguimientoReglas.js` (`fichaDe` :613-637, `circuitoDe` :579-596, `alAreaDe` :566-574)
- Modify: `services/seguimientoPdf.js` (`prepararFicha` :145-175)
- Modify: `public/js/seguimiento.js` (ficha :262-287), `public/seguimiento.html` (`?v=`), `tests/paginas.test.js`
- Test: `tests/seguimiento-reglas.test.js`, `tests/seguimiento-pdf.test.js`, `tests/seguimiento-frontend.test.js`, `tests/seguimiento-datos.test.js`

**Interfaces:**
- Produces: `ficha.requiere_nota` (0 | 1 | null; null en interna). El circuito con «No»: `nodoMedio = { nombre: 'DGMIT y Dirección Administrativa', rol: 'No hace falta nota formal' }`, `tramoFuera = { titulo: 'Sin nota formal', texto: 'Los datos se obtienen de la fuente' }`, y `alArea` en null salvo que el ciclo tenga emails al área (entonces `alAreaDe(fechas)` como hoy).

- [ ] **Step 1: Write the failing tests**:
  - `'circuito de un externo con No y sin emails al área: textos sin nota formal y alArea null'`
  - `'circuito de un externo con No y un email al área en el ciclo: alArea con sus fechas'`
  - `'circuito con NULL o Sí: como hoy'`
  - `'ficha: requiere_nota de un interno es null'`
  - `seguimiento-pdf`: `'la hoja de un externo dice REQUIERE NOTA DGMIT / No junto a DATOS QUE SE PIDEN; la interna no'` (con `pdf-lector`, sin pisadas)
  - `seguimiento-frontend`: `'la ficha de un externo muestra Requiere nota DGMIT: No; con null, Sin dato; la interna no lo muestra'`
  - `seguimiento-datos`: `'fuentesDe trae requiere_nota'`
- [ ] **Step 2: Run** los cuatro archivos. Expected: FAIL.
- [ ] **Step 3: Implement** según Interfaces.
  - En el PDF, para un externo, «Datos que se piden» deja de ser `completa` y la sigue `{ etiqueta: 'Requiere nota DGMIT', valor: textoRequiereNota(ficha.requiere_nota, 'Sin dato') }`.
  - En la pantalla, `htmlDeDato('Requiere nota DGMIT', …)` después de «Datos solicitados hoy», solo para externos.
- [ ] **Step 4: Run** los cuatro archivos y después `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: requiere nota DGMIT en la ficha y el circuito del Seguimiento`.

### Task 8: Hojas del Seguimiento para un anexo

**Files:**
- Modify: `services/seguimientoPdf.js` (`dibujarPie` :101-110, `dibujarHoja` :566, `renderSeguimiento`/`dibujarSeguimiento` :608-630)
- Modify: `controllers/seguimientoController.js` (`OPCIONES_CINTA_PDF` pasa a importarse)
- Test: `tests/seguimiento-pdf.test.js`

**Interfaces:**
- Produces (en `seguimientoPdf.js`):
  - `export const OPCIONES_CINTA_PDF = { separacion: 12, letra: 8.4 }` (se va del controlador).
  - `export const renderAnexoDeSeguimiento = async (seguimientos, { hoy, generado, numeroTexto }) → Promise<Buffer>`: una hoja por elemento de `seguimientos` (salidas de `seguimientoDe`), en ese orden. El pie derecho de cada una es `Anexo de la Nota Digital N° ${numeroTexto} · Hoja ${k} de ${N}`. `generado` = `{ momento, por: null }`. Una lista vacía tira error.
  - `renderSeguimiento(seguimiento, { hoy, generado })`: sin cambios visibles (pie «Seguimiento del dataset · Hoja 1 de 1»).

- [ ] **Step 1: Write the failing tests**:
  - `'renderAnexoDeSeguimiento con 3 casos: 3 hojas, en orden, cada una con su título y «Anexo de la Nota Digital N° 9/26 · Hoja k de 3»'`
  - `'cada hoja del anexo pasa la diagramación de una hoja (nada se pisa, 8 renglones)'`
  - `'la descarga de una hoja sigue con «Hoja 1 de 1»'`
  - `'una lista vacía tira error'`
- [ ] **Step 2: Run** `node --test tests/seguimiento-pdf.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement:** `dibujarPie(doc, generado, derecha)` y `dibujarHoja(doc, s, { hoy, generado, pie })`. Las dos funciones de render comparten un dibujante de N hojas.
- [ ] **Step 4: Run** `node --test tests/seguimiento-pdf.test.js tests/seguimiento-api.test.js` y después `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: hojas del Seguimiento en un solo PDF para anexos`.

### Task 9: El anexo de la reiteración

**Files:**
- Create: `services/notasDigitalesSeguimiento.js`
- Modify: `services/notasDigitales.js` (`generarNota` :128-203)
- Modify: `services/notasDigitalesContenido.js` (`AVISO_ADJUNTO` :59, renglón `anexo` :283, y sus usos en la autorización :308 y la auditoría :502)
- Modify: comentarios y docs que dicen que la reiteración no tiene anexo (`controllers/notasDigitalesController.js:180`, `public/js/seguimiento.js:858`)
- Test: `tests/notas-motor.test.js` (:874-925), `tests/notas-api.test.js` (:541-604), `tests/notas-contenido.test.js` (:535-554), `tests/notas-pdf.test.js` (:93-101)

**Interfaces:**
- Consumes: `fuentesDe` (seguimientoDatos), `seguimientoDe` (seguimientoReglas), `renderAnexoDeSeguimiento` y `OPCIONES_CINTA_PDF` (Task 8).
- Produces (en `services/notasDigitalesSeguimiento.js`):
  - `ordenDeLaTabla(datasets, fecha) → datasets`: primero los que tienen `vencimiento >= fecha`, después los vencidos, estable.
  - `seguimientosDeLaNota(datasets, fecha, fuentesPorId = null) → Promise<Array>`: si no recibe `fuentesPorId`, llama a `fuentesDe(ids)` una sola vez, y aplica `seguimientoDe(fuentes, fecha, OPCIONES_CINTA_PDF)` en el orden de `ordenDeLaTabla`. Si falta la fuente de un id, tira error.
  - `renderAnexoDeReiteracion({ seguimientos, fecha, numeroTexto, momento }) → Promise<Buffer>`.
- `construirNota` de una reiteración: `anexo = 'Anexo: seguimiento de los conjuntos de datos (N hojas).'` y `avisoAdjunto = 'SE ADJUNTAN NOTA Y ANEXO EN PDF'`.

- [ ] **Step 1: Write the failing tests**:
  - `notas-contenido`: `'la reiteración anuncia el anexo de seguimiento (N hojas / 1 hoja) y su primera línea es SE ADJUNTAN NOTA Y ANEXO EN PDF; autorización y auditoría siguen con SE ADJUNTA NOTA EN PDF'`.
  - `notas-motor`:
    - `'generarNota de una reiteración guarda anexo_pdf con una hoja por dataset en el orden de la tabla y el pie con su número'`;
    - `'enviarNota de una reiteración adjunta Nota y Anexo'`;
    - `'si el anexo de la reiteración falla, no queda nota ni número usado'` (stub de `fuentesDe` que tira error);
    - `'una prueba de reiteración lleva anexo con N° PRUEBA'` (reemplaza :906-925).
  - `notas-api`: `'una reiteración tiene tiene_anexo y descargarAnexo la entrega'` (reemplaza :541-604, que esperaba 404).
- [ ] **Step 2: Run** esos archivos. Expected: FAIL.
- [ ] **Step 3: Implement** en `generarNota`, para `tipo === 'reiteracion'`:
  - leer `seguimientos = await seguimientosDeLaNota(contenido.datasets, fecha)` **antes** de abrir la transacción;
  - adentro, ya con el número, `anexoPdf = await renderAnexoDeReiteracion({ seguimientos, fecha, numeroTexto: textoNumero(...), momento: ahoraArgentina() })`.
  - `textoNumero` se exporta de `notasDigitalesContenido.js`.
  - Si algo falla, el `throw` existente hace el rollback.
  - `prepararContenido` no cambia.
- [ ] **Step 4: Run** los cuatro archivos y después `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: la reiteración lleva el anexo con el Seguimiento de cada dataset`.

### Task 10: Vista previa y prueba del anexo en Correos

**Files:**
- Modify: `services/notasDigitales.js` (`contenidoParaMostrar` :772-788, `previewAnexo` :819-823, `enviarPrueba` :834-851, `ejemplo` :629-664)
- Modify: `controllers/notasDigitalesController.js` (`verPreviewAnexo` :247-260)
- Modify: `public/js/api.js` (`previewNotaAnexo` :332-334), `public/js/correos.js` (`actualizarBotonAnexo` :479-486 y quien llama a `previewNotaAnexo`), `public/correos.html` (`?v=`), versión de `api.js` en las 14 páginas si cambia (`VERSION` de `tests/paginas.test.js`)
- Test: `tests/correos-frontend.test.js` (:71-91, :1007), `tests/notas-api.test.js`, `tests/notas-motor.test.js`

**Interfaces:**
- Produces:
  - `previewAnexo({ tipo = 'aviso', gestion, hoy })`: en un aviso, como hoy; en una reiteración, `renderAnexoDeReiteracion` con los `seguimientos` de la misma selección y la misma fecha que la vista previa de la nota, y `numeroTexto 'XX'`.
  - `fuentesDeEjemplo(datasetsDeEjemplo, fecha) → Map<id, Fuentes>`, en memoria, para cuando `contenidoParaMostrar` devuelve `ejemplo: true`. Datasets con su ficha y sin movimientos; `seguimientoDe` no puede fallar con los ids 0 y -1.
  - `API.previewNotaAnexo(gestion, tipo = 'aviso')` agrega `tipo` a la query.
  - La ruta lee `req.query.tipo`, que solo puede ser `aviso` o `reiteracion` (si no, 400).
  - `actualizarBotonAnexo()`: habilitado para aviso y reiteración, deshabilitado para auditoría (title `'La nota de auditoría no lleva anexo'`).
  - `enviarPrueba` de una reiteración: pasa por `generarNota` con `esPrueba`, que ya arma el anexo (Task 9). Con ejemplo, usa `fuentesDeEjemplo`.

- [ ] **Step 1: Write the failing tests**:
  - `correos-frontend`:
    - `'el botón Ver anexo está habilitado con reiteración y deshabilitado con auditoría'`;
    - `'previewNotaAnexo manda tipo=reiteracion'`.
  - `notas-api`:
    - `'GET preview/anexo?tipo=reiteracion devuelve un PDF con una hoja por dataset'`;
    - `'… con datos de ejemplo devuelve un PDF sin consultar fuentes'`;
    - `'tipo inválido → 400'`.
  - `notas-motor`: `'la prueba de una reiteración de ejemplo adjunta el anexo'`.
- [ ] **Step 2: Run** esos archivos. Expected: FAIL.
- [ ] **Step 3: Implement** según Interfaces.
- [ ] **Step 4: Run** esos archivos, `tests/paginas.test.js` y después `npm test`. Expected: PASS.
- [ ] **Step 5: Verificar en el navegador:** Correos → Vista previa y pruebas, reiteración externa, «Ver anexo» abre el PDF. Captura.
- [ ] **Step 6: Commit** `feat: vista previa y prueba del anexo de la reiteración en Correos`.

### Task 11: Documentación, simulación y kit

**Files:**
- Modify: `CLAUDE.md`, `README.md`
- Create (fuera del repo): `Escritorio/RPAD-deploy-requiere-nota-y-anexo/` (`PASOS.txt`, las dos migraciones, `archivos-requiere-nota.zip`, `vuelta-atras/archivos-anteriores.zip`, `muestras-simulacion/`)

- [ ] **Step 1: CLAUDE.md:**
  - «Base de datos» (la columna y las dos migraciones, en orden);
  - «Datos solicitados en las Notas Digitales» (5 columnas en el aviso externo, 7 reorganizadas en la reiteración externa, interna sin cambios);
  - «Seguimiento del dataset» (ficha, circuito con «No», hojas para anexos);
  - el anexo de la reiteración;
  - el email de 40 días;
  - las copias mínimas (`MENSAJE_FALTA_REQUIERE_NOTA` en `admin-fechas.js`);
  - la lista de servicios (`requiereNotaReglas`, `notasDigitalesSeguimiento`).
- [ ] **Step 2: README:** la sección «Migración: Requiere nota DGMIT», con la consulta previa, las dos migraciones, la verificación, los archivos y el Restart. Agregarla también al árbol y a la tabla de migraciones.
- [ ] **Step 3: Run** `npm test` completo. Expected: todos pasan salvo los omitidos de la línea de base.
- [ ] **Step 4: Simulación del 20/10 al 15/11/2026:**
  - base nueva `rpad_sim_requiere_nota` con el dump del 20/10 a las 9:00 (`database/dump-local/`) y las dos migraciones;
  - corridas de 8:15 y 14:00 de cada día hábil con el orquestador de las simulaciones anteriores (`sim/` del scratchpad de la sesión eef718a6: `preparar.sh`, `orquestador.mjs`), SMTP a Mailpit y `EMAIL_SOLO_A` con las dos casillas de prueba como barrera.
  - Verificar:
    - ningún envío fuera de Mailpit;
    - la reiteración externa y la interna del 02/11, con su anexo (10 y 3 hojas) y la tabla nueva;
    - los avisos externos con la columna;
    - ningún email de 40 días para los datasets 10 y 30.
  - Copiar las muestras al kit.
- [ ] **Step 5: Kit:**
  - `PASOS.txt` en ASCII:
    1. las dos migraciones en phpMyAdmin, con la verificación (0 filas);
    2. subir los archivos del zip;
    3. Restart en Setup Node.js App;
    4. controles después del despliegue: Correos → Vista previa de una reiteración con «Ver anexo», y el formulario de un dataset externo.
  - `archivos-requiere-nota.zip` con `git archive` de los archivos cambiados.
  - `vuelta-atras`, con los archivos de main (7c6000e). La columna puede quedar.
- [ ] **Step 6: Commit** `docs: requiere nota DGMIT y anexo de la reiteración`, revisión final de toda la rama y, con el OK del usuario, merge a main y push.
