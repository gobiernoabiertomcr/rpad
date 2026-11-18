# Propuestas de datasets nuevos (contrato v1.4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El RPAD acepta, valida y muestra (página y mail) la clave opcional `propuestas_datasets` de las ediciones de Datito, sin cambiar nada de una edición que no la trae.

**Architecture:** La validación va en `validarEdicion` (`services/datoQuincenaReglas.js`) con las piezas de hoy; la prioridad y los textos se arman al leer, de la `metadata` guardada, en `detalleDeLaEdicion`; `modeloDelMail` los pasa a la plantilla y la página los imprime. Sin migración, sin cambios en el recibo ni en la lista.

**Tech Stack:** Node 22 (ES Modules), Express, `node:test` (`npm test` = `node --test --test-concurrency=1 "tests/*.test.js"`), MariaDB en Docker (`rpad-db`, 3307) y Mailpit para los tests de API, vanilla JS cargado en `vm` para los tests de la página.

**Spec:** `docs/superpowers/specs/2026-11-18-dato-quincena-propuestas-datasets-design.md` (leela entera antes de cada tarea: los mensajes, topes y textos exactos están ahí).

## Global Constraints

- Una edición sin `propuestas_datasets` entra, se valida, se ve y se manda exactamente igual que en main 8784663, byte por byte (página y mail). Es el resguardo del primer envío real del 24/11.
- La clave es opcional en el RPAD (patrón de `repeticion`: `...(Object.hasOwn(valor, 'propuestas_datasets') ? { propuestas_datasets } : {})`); `schema_version` sigue en `'1.0'`.
- Los mensajes de 422 son los de la tabla de la spec, sección 1, letra por letra: Datito los copia en su chequeo.
- El recibo del POST (201 y 200) no cambia: ni claves ni avisos nuevos.
- El servidor arma todos los textos; la página y el mail los imprimen tal cual. Todo texto de Datito pasa por `esc` (página) y por `textoDelDato`/`conRenglones`/`escapeHtml` (mail). Un enlace va solo si es `https://`.
- El nombre del bot sale de `NOMBRE_DEL_BOT`; ningún texto lo escribe a mano.
- Sin migración, sin SQL, sin variables nuevas. `docs/temas/*.md`: lo vigente, un renglón por oración, renglones de hasta 600 bytes y documentos de hasta 60 KB (`tests/documentos.test.js`).
- Repo público: datos de prueba inventados, ningún nombre real, ningún dato del dump de producción ni de una edición real de Datito.
- Mail: un solo marco (`marcoEmail`), tablas y estilos en línea, sin emojis.
- `dato-quincena.js?v=20261234` y `VERSION_DATO_QUINCENA = '20261234'` (`tests/paginas.test.js`).
- Lenguaje neutro en todo lo que arma el sistema.

## Review Focus

1. Saltos de línea en `justificacion` y `anonimizacion`: la página los muestra (`.dq-texto`, `white-space: pre-line`) y el mail los pasa a `<br>` (`conRenglones`). Test en las tareas 4 y 5.
2. Textos largos sin espacios (un slug de 100, un campo sugerido de 64, una fuente de 2048) no rompen el ancho: en la página, `overflow-wrap: anywhere`; en el mail, `word-break: break-word` en los enlaces y los campos. Test en las tareas 4 y 5.
3. Caracteres fuera del plano básico (emoji) en los topes: un título de 120 emoji vale y uno de 121 da «Tiene que tener de 5 a 120 caracteres.»; uno de 4 emoji también lo da. Test en la tarea 2.
4. HTML en cualquier texto de Datito (título, justificación, nombre de un dataset relacionado, campos, anonimización, fuentes que no son `https://`): sale escapado en la página, en el HTML del mail y tal cual en el texto plano; la `url` de un dataset relacionado se arma solo con el slug validado. Test en las tareas 3, 4 y 5.
5. Títulos que solo difieren en las tildes no son repetidos («Educación» y «Educacion» pasan); los que difieren en mayúsculas o espacios de los extremos sí. Test en la tarea 2.

---

### Task 1: El resguardo del 24/11 (antes de tocar el código)

**Files:**
- Create: `tests/fixtures/dato-quincena-antes-de-v1-4.json`
- Create: `tests/dato-quincena-resguardo.test.js`

**Interfaces:**
- Produces: el fixture `{ mail: { subject, html, text }, mail_prueba: { subject, html, text }, pagina: { detalle, detalle_admin } }`, armado con el código de main 8784663 y la edición de prueba de `tests/dato-quincena-fixtures.js`; las tareas 4 y 5 no lo regeneran nunca.

- [ ] **Step 1: Armar el fixture con el código de hoy.** Con un script descartable (en el scratchpad, no en el repo) que importe `detalleDeLaEdicion` y `modeloDelMail` igual que `tests/dato-quincena-correo-reglas.test.js` (función `modelo`, línea ~1196: `detalleDe(edicionDePrueba())`, `fecha_edicion: '2026-11-02'`, `nombreCompleto: 'Persona Uno Ejemplo'`, `url: URL_DE_PRUEBA`) y llame `datoQuincenaTemplate(modelo, { conSvg: true })` para `mail`, y con `prueba: true`, `nombreCompleto: null` y `{ conSvg: false }` para `mail_prueba`.
  Para `pagina`, cargá `public/js/dato-quincena.js` en el `vm` como `cargar()` de `tests/dato-quincena-frontend.test.js` y guardá `htmlDelDetalle(RESPUESTAS.detalle.data)` y `htmlDelDetalle(RESPUESTAS.detalle.data, { admin: true })`.
- [ ] **Step 2: Escribir `tests/dato-quincena-resguardo.test.js`** con un `describe('el resguardo del 24/11: una edición sin propuestas_datasets da lo mismo que en 8784663')` y tres `it`: el mail (`assert.equal` de `subject`, `html` y `text`), el mail de la prueba, y las dos páginas. El test arma todo igual que el script del paso 1, sin leerlo de otro lado.
- [ ] **Step 3: Correr** `node --test tests/dato-quincena-resguardo.test.js`. Expected: PASS (es un test de caracterización: tiene que pasar con el código de hoy).
- [ ] **Step 4: Commit** `test(dato-quincena): el resguardo del mail y la página antes de la v1.4`.

### Task 2: La validación del POST

**Files:**
- Modify: `services/datoQuincenaReglas.js` (`MENSAJES_VALIDACION`, los validadores nuevos y `edicion`)
- Modify: `tests/dato-quincena-fixtures.js` (`propuestaDatasetDePrueba`)
- Test: `tests/dato-quincena-reglas.test.js`, `tests/dato-quincena-api.test.js`
- Modify: `docs/temas/dato-quincena.md` (la clave, sus reglas y mensajes)

**Interfaces:**
- Produces: `propuestaDatasetDePrueba(cambios = {})` en `tests/dato-quincena-fixtures.js`: una propuesta válida e inventada (`numero: 1`, valor `Alto`, riesgo `Bajo`, `anonimizacion: null`, dos `datasets_relacionados` con slugs de ejemplo, una fuente `https://datos.ejemplo.gob.ar/...`), que `cambios` pisa.
- Produces: las claves nuevas de `MENSAJES_VALIDACION` (los textos, de la tabla de la spec, sección 1): `propuestasDatasets`, `numeroDeDataset`, `de5a120`, `de20a600`, `tituloDeDatasetRepetido`, `origenes`, `origen`, `origenRepetido`, `datasetsRelacionados`, `slug`, `slugRepetido`, `valor`, `riesgo`, `bajoConAlto`, `formatoSugerido`, `camposSugeridos`, `hasta64`, `campoSugeridoRepetido` (`campoRepetido` ya existe, para el manifiesto), `sinAnonimizacion`, `anonimizacionDeMas`, `fuentesDeDataset`, `fuenteRepetida`.

- [ ] **Step 1: Tests de reglas que fallan**, en un `describe('propuestas_datasets (contrato v1.4)')` de `tests/dato-quincena-reglas.test.js`, con `validarEdicion(edicionDePrueba({ propuestas_datasets: [...] }), { hoy })` como los de `repeticion`:
  - `[]`, una y tres válidas: `[]` de errores; sin la clave: `[]` (la edición de prueba de hoy); `null`: `{ campo: 'propuestas_datasets', mensaje: 'Tiene que ser una lista.' }`; cuatro: el de cantidad.
  - Cada una de las once claves que falta y una de más (los mensajes `falta` y `sobra` de hoy, con su ruta).
  - `numero` 2 en la primera y 1, 3 en dos: el de `numeroDeDataset` en la que salta.
  - Topes por debajo y por encima: título 4 y 121, justificación 19 y 601, 3 y 16 campos, campo de 65, 0 y 6 fuentes, 0 y 5 orígenes, 6 relacionados, `nombre` de 201, `anonimizacion` de 1001.
  - Review Focus 3: título de 120 emoji vale; de 121 y de 4 emoji, `de5a120`.
  - Valores cerrados: un origen, un valor, un riesgo y un formato que no existen.
  - Slug: `Playones` (mayúscula), `a`, uno de 101, `con espacio` y `ñandu`, con `slug`; `playones_deportivos-2` vale.
  - Repetidos, con el error en el segundo y su índice: origen, slug, campo, fuente, y título con otras mayúsculas y espacios en los extremos (`propuestas_datasets[1].titulo`, `tituloDeDatasetRepetido`). Review Focus 5: «Educación» y «Educacion» no dan error.
  - La cantidad y los repetidos se suman: cinco orígenes con uno repetido dan los dos errores.
  - Coherencia: `Bajo`/`Alto` con anonimización (solo `bajoConAlto` en `.riesgo`); `Bajo`/`Alto` con `null` (solo `bajoConAlto`); `Medio` y `Alto` de riesgo con `null` (`sinAnonimizacion`); `Bajo` con texto (`anonimizacionDeMas`); `""` y `"   "` dan `vacio` y no suman la coherencia; un `valor` inválido con riesgo `Medio` y `null`: solo el de `valor`.
  - Una fuente `http://` da el mensaje `direccion` de hoy.
- [ ] **Step 2: Correr** `node --test tests/dato-quincena-reglas.test.js`. Expected: FAIL en los casos nuevos (la clave da `sobra`).
- [ ] **Step 3: Implementar en `services/datoQuincenaReglas.js`:**
  - un validador de texto con mínimo y máximo (`texto` de hoy para el tipo, el vacío y el nulo; después el largo con `caracteres`, con la clave de mensaje que se le pasa);
  - `anonimizacion`: `null` o un texto que no puede quedar vacío ni con solo espacios, de hasta 1000 (no `texto(1000, { oNull: true })`, que acepta `""`);
  - `ckan_slug` con `/^[a-z0-9_-]{2,100}$/` (si no es texto, el error `texto`);
  - un «sin repetidos» que, después de validar la lista, marque el segundo de cada par con la clave que se le pasa (comparación exacta; los títulos, con `trim().toLowerCase()`);
  - `propuestaDataset(valor, indice)` con las once claves (`numero: igual(indice + 1, 'numeroDeDataset')`) y la coherencia después de la forma, como `propuestaCoherente`: con `valor` y `riesgo` válidos, primero `bajoConAlto`; si no, y solo si `anonimizacion` no tuvo su propio error, `sinAnonimizacion` o `anonimizacionDeMas`;
  - `propuestas_datasets: lista(0, 3, 'propuestasDatasets', ...)` más los títulos repetidos, sumado a `edicion(hoy)` solo si la clave está.
- [ ] **Step 4: Correr** `node --test tests/dato-quincena-reglas.test.js`. Expected: PASS, también los tests de antes (una edición v1.3 sigue valiendo).
- [ ] **Step 5: Tests de API** en `tests/dato-quincena-api.test.js`, en un `describe('propuestas_datasets (contrato v1.4)')` (con `docker compose` ya levantado por la coordinadora y `RPAD_TESTS_DB_LOCAL=1`):
  - un POST con tres propuestas da 201 y el recibo tiene exactamente las claves de hoy, con `avisos: []`;
  - un POST con la primera `Bajo`/`Alto` da 422 con `errores: [{ campo: 'propuestas_datasets[0].riesgo', mensaje: 'Un dataset de valor bajo y riesgo alto no se propone (matriz de priorización).' }]` y la tabla `dato_quincena_ediciones` sigue sin filas nuevas;
  - un POST sin la clave sigue dando 201.
  Correr `node --test tests/dato-quincena-api.test.js`. Expected: PASS.
- [ ] **Step 6: Documentar** en `docs/temas/dato-quincena.md` la clave opcional, sus reglas, la coherencia y que el RPAD no la exige (el plan B), con los mensajes que copia Datito.
- [ ] **Step 7: Commit** `feat(dato-quincena): la v1.4 valida propuestas_datasets`.

### Task 3: La prioridad y el detalle

**Files:**
- Modify: `services/datoQuincenaReglas.js` (`prioridadDeDataset`, `propuestasDatasetsDelDetalle`, `detalleDeLaEdicion`)
- Modify: `tests/fixtures/dato-quincena-respuestas.json`
- Test: `tests/dato-quincena-reglas.test.js`, `tests/dato-quincena-api.test.js`
- Modify: `docs/temas/dato-quincena.md` (la prioridad y el detalle)

**Interfaces:**
- Consumes: `propuestaDatasetDePrueba` (tarea 2).
- Produces: `export const prioridadDeDataset = (valor, riesgo) => ({ clave, texto })` con la tabla de 9 casos de la spec, sección 2 (`Bajo`/`Alto` no llega: el POST lo rechaza; devuelve `evaluar`).
- Produces: `export const propuestasDatasetsDelDetalle = (edicion) => null | Array<{ numero_texto, titulo, origenes, justificacion, prioridad: { clave, texto }, valor_y_riesgo, formato, campos, anonimizacion, datasets_relacionados: Array<{ nombre, url }>, fuentes }>` (spec, sección 4). `url` es `https://datos.comodoro.gov.ar/dataset/` + `ckan_slug`.
- Produces: `detalleDeLaEdicion(...)` con la clave `propuestas_datasets` después de `propuestas`.
- Produces: en `tests/fixtures/dato-quincena-respuestas.json`, `propuestas_datasets: null` en `detalle` y `detalle_con_repeticion`, y dos respuestas nuevas: `detalle_con_datasets` (la edición de prueba con tres propuestas, una de cada prioridad) y `detalle_datasets_vacia` (con `[]`).

- [ ] **Step 1: Tests que fallan:** los 9 casos de `prioridadDeDataset` (clave y texto); `propuestasDatasetsDelDetalle` sin la clave da `null`, con `[]` da `[]`, y con una propuesta da cada texto (`numero_texto: 'Dataset nuevo 1'`, `valor_y_riesgo: 'Valor alto · Riesgo bajo'`, `datasets_relacionados[0].url` con el slug); Review Focus 4: un `nombre` con `<img src=x onerror=1>` pasa tal cual (lo escapa quien imprime) y la `url` es solo el portal más el slug; `detalleDeLaEdicion` de la edición de prueba trae `propuestas_datasets: null` y las claves en el orden del fixture (el test de la línea ~2512); las dos respuestas nuevas del fixture salen de `detalle` con esas ediciones.
- [ ] **Step 2: Correr** `node --test tests/dato-quincena-reglas.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar** las dos funciones y sumar la clave al detalle. Actualizar el fixture JSON con lo que da el código (y revisarlo a mano: textos de la spec).
- [ ] **Step 4: Correr** `node --test tests/dato-quincena-reglas.test.js tests/dato-quincena-frontend.test.js tests/dato-quincena-resguardo.test.js`. Expected: PASS (la página no cambia con `null`).
- [ ] **Step 5: API:** el GET del detalle de una edición guardada con tres propuestas trae `propuestas_datasets` con sus tres prioridades; el de una sin la clave, `null`. Correr `node --test tests/dato-quincena-api.test.js`. Expected: PASS.
- [ ] **Step 6: Documentar** la tabla de prioridad (con el motivo de Medio/Alto) y la clave del detalle en `docs/temas/dato-quincena.md`.
- [ ] **Step 7: Commit** `feat(dato-quincena): la prioridad y las propuestas de datasets en el detalle`.

### Task 4: El mail

**Files:**
- Modify: `services/datoQuincenaCorreoReglas.js` (`modeloDelMail`)
- Modify: `services/emailTemplates.js` (`datoQuincenaTemplate` y las piezas de la sección)
- Test: `tests/dato-quincena-correo-reglas.test.js`, `tests/dato-quincena-correo.test.js`
- Modify: `docs/temas/dato-quincena-correo.md`

**Interfaces:**
- Consumes: `detalleDeLaEdicion(...).propuestas_datasets` (tarea 3).
- Produces: `modeloDelMail(...)` con `propuestas_datasets` entre `propuestas` y `url`: `null` si el detalle trae `null`; si no, la lista del detalle con `franja: 'Dataset nuevo N de M'` primero en cada una (copia, el detalle no cambia).

- [ ] **Step 1: Tests que fallan** en `tests/dato-quincena-correo-reglas.test.js`:
  - la lista de claves del modelo (línea ~1210) suma `propuestas_datasets` entre `propuestas` y `url`; con la edición de prueba vale `null`; con tres, las franjas «Dataset nuevo 1 de 3»…;
  - con `[]`: el HTML trae «Propuestas de datasets nuevos» y «Esta quincena no hay propuestas de datasets.» después de la última propuesta y antes de «Ver la edición en el RPAD»; el texto plano trae `Propuestas de datasets nuevos\nEsta quincena no hay propuestas de datasets.` en el mismo lugar;
  - con tres: cada franja, título, orígenes, prioridad con su eje, «Por qué abrirlo», «Formato sugerido», «Campos sugeridos», la anonimización solo en las de riesgo Medio o Alto, los relacionados con su enlace, y las fuentes; el orden de las tres; el texto plano con el mismo orden;
  - Review Focus 1: una justificación con `\n` sale con `<br>` en el HTML y con su salto en el texto;
  - Review Focus 2: los campos y los enlaces llevan `word-break: break-word`;
  - Review Focus 4: el XSS en cada texto sale escapado en el HTML y tal cual en el texto; una fuente `javascript:` no es enlace;
  - sin emojis en la sección (como el test de hoy del mail).
- [ ] **Step 2: Correr** `node --test tests/dato-quincena-correo-reglas.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar** en `modeloDelMail` la clave, y en `emailTemplates.js` la sección (spec, sección 6), con `tituloSeccion`, `parrafo`, `pastillaDelDato` (orígenes, neutras), una pastilla de prioridad con un mapa de clave a colores (`alta` → `ETIQUETAS.crear`, `si_hay_recursos` → `ETIQUETAS.editar`, `evaluar` → `COLORES.respaldo`), `campoDelDato`, `avisoDestacado`, `enlace` y filas de 16 px entre tarjetas. La franja: fondo `#EEF6F1`, borde `#D5E9DD`, texto `#2E6B4C`. El bloque es `null` cuando `propuestas_datasets` no es una lista: `marcoEmail` lo salta y el texto plano no suma nada.
- [ ] **Step 4: Correr** `node --test tests/dato-quincena-correo-reglas.test.js tests/dato-quincena-resguardo.test.js`. Expected: PASS: el resguardo sigue igual byte por byte.
- [ ] **Step 5: Corrida con base:** en `tests/dato-quincena-correo.test.js`, una regular con tres propuestas que sale en la corrida de la mañana manda en Mailpit un mail con la sección; y «Enviarme una prueba» de un piloto con la clave también la trae. Correr `node --test tests/dato-quincena-correo.test.js`. Expected: PASS.
- [ ] **Step 6: Documentar** la sección del mail y su texto plano en `docs/temas/dato-quincena-correo.md`.
- [ ] **Step 7: Commit** `feat(dato-quincena): las propuestas de datasets nuevos en el mail`.

### Task 5: La página

**Files:**
- Modify: `public/js/dato-quincena.js` (`htmlDeLosDatasetsNuevos`, `htmlDelDetalle`)
- Modify: `public/dato-quincena.html` (estilos `.dq-nuevos…` y `?v=20261234`)
- Modify: `tests/paginas.test.js` (`VERSION_DATO_QUINCENA = '20261234'`)
- Test: `tests/dato-quincena-frontend.test.js`
- Modify: `docs/temas/dato-quincena.md` (la página)

**Interfaces:**
- Consumes: `propuestas_datasets` del detalle (tarea 3) y las respuestas `detalle_con_datasets` y `detalle_datasets_vacia` del fixture.
- Produces: `htmlDeLosDatasetsNuevos(lista)` (pura, en la parte pura del archivo): `''` si `lista` no es un array; con `[]`, la sección con el título y la línea; si no, la lista ordenada de tarjetas (spec, sección 5).

- [ ] **Step 1: Tests que fallan** (vm, con el fixture):
  - `htmlDelDetalle(RESPUESTAS.detalle.data)` no trae `dq-nuevos` (y el resguardo ya cubre que sea igual);
  - con `detalle_datasets_vacia`: `<section class="dq-nuevos"` con el `h3` y `<p class="dq-nuevos-vacia">Esta quincena no hay propuestas de datasets.</p>`, después de `</ol></section>` de las propuestas;
  - con `detalle_con_datasets`: tres `<li class="dq-nuevo">` en orden, cada uno con su orden de piezas (número y orígenes, título, prioridad con `dq-prio-<clave>` y su eje, «Por qué abrirlo», «Formato sugerido», «Campos sugeridos», la caja «Cómo anonimizar» solo en las de riesgo Medio o Alto, «Datasets relacionados en el portal» solo si hay, «Fuentes»);
  - una prioridad con una clave desconocida no lleva clase ni ícono, pero sí su texto;
  - Review Focus 4: el XSS en cada texto sale escapado; un relacionado o una fuente que no es `https://` va sin enlace;
  - Review Focus 1 y 2: la justificación y la anonimización van en `.dq-texto` (pre-line) y los estilos de `.dq-nuevo` llevan `overflow-wrap: anywhere` (test sobre el `<style>` de la página, como los de hoy);
  - ningún nombre de clase ni id nuevo empieza con `ad-` (el test de hoy lo cubre).
- [ ] **Step 2: Correr** `node --test tests/dato-quincena-frontend.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar** la función, sumarla a `htmlDelDetalle` después de la sección de las propuestas, y los estilos en el `<style>` de la página: `.dq-nuevos` (fondo `#EEF6F1`, radio 14 px, margen arriba 26 px), `.dq-nuevo` (blanca, borde `#CFE3D7`, radio 16 px), `.dq-prio-alta` (`--sg-verde-fondo`/`--sg-verde`), `.dq-prio-si_hay_recursos` (`--sg-azul-fondo`/`--sg-azul`), `.dq-prio-evaluar` (`--sg-sol`/`--sg-ambar`), los campos en monoespaciada del sistema. Íconos Lucide embebidos con `aria-hidden="true"` (check, info, shield). La maqueta aprobada está en `~/rpad-notas/dato-quincena-datasets-propuestos/maqueta/web/` (`js/dato-quincena.js` entre las marcas MAQUETA y `maqueta.css`): es la referencia visual, no código para copiar tal cual.
- [ ] **Step 4: Subir la versión** a `20261234` en `public/dato-quincena.html` y en `tests/paginas.test.js`. Correr `node --test tests/dato-quincena-frontend.test.js tests/paginas.test.js tests/dato-quincena-resguardo.test.js`. Expected: PASS.
- [ ] **Step 5: Documentar** la sección de la página en `docs/temas/dato-quincena.md`; correr `node --test tests/documentos.test.js`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(dato-quincena): las propuestas de datasets nuevos en la página`.

### Task 6: La suite completa y la simulación con la copia de producción

**Files:** ninguno del repo (scripts en el scratchpad; notas en `~/rpad-notas/dato-quincena-datasets-propuestos/simulacion/`).

- [ ] **Step 1: Suite completa** `npm test` en el worktree (con el `.env` del worktree, `RPAD_TESTS_DB_LOCAL=1`, la base local migrada). Expected: 0 fallas; anotar los totales y guardar el log en `~/rpad-notas/logs/`.
- [ ] **Step 2: La copia:** cargar `~/Downloads/datospublicos_mcr_rpad.sql` (el dump de producción del 18/11) en una base nueva `rpad_sim_datasets_nuevos` del contenedor `rpad-db` (con el root del `.env`), sin tocar `datospublicos_mcr_rpad`.
- [ ] **Step 3: Levantar el RPAD** con el código de la rama contra la copia, en otro puerto, con SMTP a Mailpit, el envío automático como esté en la copia y una huella de token de prueba (el token, generado en el momento, nunca en un archivo del repo ni en el chat).
- [ ] **Step 4: Mandar tres pilotos** armados desde los ejemplos de `para-datito/` con partes de prueba y su manifiesto recalculado: sin la clave (201), con `[]` (201) y con tres propuestas (201); y el de valor Bajo y riesgo Alto (422, sin fila nueva).
- [ ] **Step 5: Mirar** la página de cada piloto (navegador del panel, sesión armada con el `JWT_SECRET` local para un usuario de administración de la copia) y «Enviarme una prueba» del de tres propuestas: el mail llega a Mailpit, con la sección, y a ninguna otra casilla.
- [ ] **Step 6: Anotar** el resultado en `~/rpad-notas/dato-quincena-datasets-propuestos/simulacion/resultado.md`, bajar el servidor, borrar `rpad_sim_datasets_nuevos` y `.claude/launch.json` del worktree.

## Después del plan

Revisión final de toda la rama con Fable 5.2 y esfuerzo alto, ola de arreglos y re-revisión; la suite completa otra vez; squash en main con push; el kit `~/rpad-kits/RPAD-deploy-dato-quincena-datasets-propuestos/` contra 8784663 (sin SQL, con Restart, vuelta atrás, `PASOS.txt` con la comprobación de `mi-espacio.js?v=20261233` y `dato-quincena.js?v=20261232` y la ventana lejos de 8:05, 14:00, los :00 y los :30), controlado con `python3 -I ~/rpad-notas/control-kit.py <kit> dato-quincena-datasets-propuestos 8784663 <head>`; TODO EN VERDE a la coordinadora.
