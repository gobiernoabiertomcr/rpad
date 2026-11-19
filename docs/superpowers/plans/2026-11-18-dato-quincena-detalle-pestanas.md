# El detalle de una edición en tres pestañas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El detalle de una edición del dato de la quincena se ve en tres pestañas (General, Propuestas y Datasets nuevos) con el diseño A «Diario», y el servidor manda los números, la matriz y los textos que la página necesita.

**Architecture:** El servidor suma claves de solo lectura a `detalleDeLaEdicion` (`services/datoQuincenaReglas.js`); la página (`public/js/dato-quincena.js` y el `<style>` de `public/dato-quincena.html`) dibuja las tres pestañas juntas al cargar el detalle, muestra la elegida y guarda en la dirección la pestaña y la propuesta (`history.replaceState`). Sin SQL; el mail no cambia.

**Tech Stack:** Node 22 (ES Modules), Express, `node:test` (`npm test`), vanilla JS cargado en `vm` para los tests de la página, MariaDB en Docker y Mailpit para los tests de API.

**Spec:** `docs/superpowers/specs/2026-11-18-dato-quincena-detalle-pestanas-design.md` (leela entera antes de cada tarea). Referencia visual aprobada, fuera del repo: `~/rpad-notas/dato-quincena-detalle-pestanas/web/`, dirección A (funciones `…A` de `js/pestanas-maqueta.js` y las reglas de `css/pestanas.css` que no son de B); se ve con `python3 -I -m http.server 4821 --bind 127.0.0.1 --directory ~/rpad-notas/dato-quincena-detalle-pestanas/web` en `http://localhost:4821/dato-quincena.html?id=20&vista=general&dir=A&rol=lector&nuevos=tal-cual`. Es referencia, no código para copiar: usa datos reales que no entran al repo.

## Global Constraints

- El mail no cambia: una edición sin `propuestas_datasets` da el mismo `subject`, `html` y `text` que el fixture de `tests/dato-quincena-resguardo.test.js` (la parte `mail` y `mail_prueba` no se regenera nunca).
- El servidor arma los textos, los números y lo que sale de una regla; la página los imprime tal cual. Todo texto del servidor pasa por `esc` (también en atributos); un número va con `String`; enlaces solo `https://` (`esEnlaceSeguro`, `enlaceDeAfuera`); clases e íconos desde mapas con `Object.hasOwn`.
- Los scripts de la página, al cargarse, solo declaran y enganchan `DOMContentLoaded`; lo que arma HTML es puro; los eventos, delegados en contenedores fijos.
- Accesible: `role="tablist"`/`tab`/`tabpanel`, `aria-selected`, `aria-controls`, `aria-labelledby`, flechas, Inicio y Fin; foco visible; 4,5:1 o más en todo texto; el color nunca es lo único que distingue; `prefers-reduced-motion`; ningún nombre de clase ni id empieza con `ad-`.
- Sin scroll horizontal de 360 px en adelante; el teléfono (< 640 px) como en la maqueta.
- `dato-quincena.js?v=20261235` y `VERSION_DATO_QUINCENA = '20261235'` (`tests/paginas.test.js`).
- Docs: `docs/temas/dato-quincena.md`, lo vigente, un renglón por oración, renglones de hasta 600 bytes, documento de hasta 60 KB (`tests/documentos.test.js`).
- Repo público: datos de prueba inventados (los de `tests/dato-quincena-fixtures.js`), nada de los pilotos reales.
- Sin `docker compose` desde el worktree; nunca `pkill -f` ni `killall` con un patrón.

## Review Focus

1. Una dirección vieja o rota (`?id=20&vista=x`, `&propuesta=0`, `&propuesta=99`, `&vista=datasets` en una edición sin la clave, `&propuesta=3` sin `vista`) abre algo sensato (General, o la principal) y se corrige; nunca una pantalla en blanco. Test en la tarea 2 (vista) y 3 (propuesta).
2. Una edición con una sola propuesta (y sin principal marcada), sin agenda, sin nota de Datito, sin SVG o sin cálculos: cada panel se ve bien, sin títulos vacíos. Test en las tareas 2 y 3.
3. Un detalle sin las claves nuevas (servidor viejo durante el despliegue): la página no se rompe (sin números en las pestañas, sin matriz, el orden por posición). Test en las tareas 2, 3 y 4.
4. Administración: las pestañas de página (Ediciones y Correo) y las de la edición conviven; pasar a Correo y volver deja la misma pestaña y propuesta; la caja «Correo» sigue cargando en General. Test en la tarea 2.
5. Textos largos sin espacios (una fuente de 2048, un título largo) no ensanchan el índice ni las tarjetas; HTML en cualquier texto sale escapado en los tres paneles. Test en las tareas 3 y 4.

---

### Task 1: Lo que suma el servidor al detalle

**Files:**
- Modify: `services/datoQuincenaReglas.js` (`propuestaDelDetalle`, `propuestasDatasetsDelDetalle`, `detalleDeLaEdicion`, una función pura nueva para la matriz)
- Modify: `services/datoQuincenaCorreoReglas.js` (`FUERA_DEL_MAIL` suma `orden`)
- Modify: `tests/fixtures/dato-quincena-respuestas.json` (las respuestas de detalle con las claves nuevas)
- Test: `tests/dato-quincena-reglas.test.js`, `tests/dato-quincena-correo-reglas.test.js`, `tests/dato-quincena-api.test.js`
- Modify: `docs/temas/dato-quincena.md` (las claves nuevas del detalle)

**Interfaces:**
- Produces, en el detalle (spec, sección 6): cada propuesta con `orden` (entero); cada elemento de `propuestas_datasets` con `numero` (entero), `valor` y `riesgo` (`'Alto'|'Medio'|'Bajo'`); `matriz_de_prioridad`: `null` o 9 celdas `{ valor, riesgo, clave, texto, con_rotulo }` en el orden riesgo Alto, Medio, Bajo × valor Bajo, Medio, Alto (la de Bajo/Alto: `clave: 'no_se_propone'`, `texto: 'No se propone'`; `con_rotulo: true` solo en las 4 celdas de la spec); `cantidades: { propuestas, datasets_nuevos }` (`datasets_nuevos` null sin la clave); `ver_propuestas` («Ver las N propuestas» / «Ver la propuesta»); `aviso_datasets_nuevos` («Datito propone 1 dataset nuevo para abrir.» / «Datito propone N datasets nuevos para abrir.», con `NOMBRE_DEL_BOT`; `null` sin la clave o con `[]`); `ver_datasets_nuevos` («Ver el dataset nuevo» / «Ver los datasets nuevos»; `null` cuando `aviso_datasets_nuevos` es `null`).
- Produces: una exportación pura `matrizDePrioridad()` (o el nombre que elijas, sin argumentos, construida con `prioridadDeDataset`) que devuelve las 9 celdas.

- [ ] **Step 1: Tests que fallan:** las 9 celdas exactas de la matriz (orden, claves, textos, `con_rotulo` en riesgo Alto/valor Bajo, Alto/Alto, Medio/Bajo y Bajo/Alto); el detalle de la edición de prueba (sin la clave) con `matriz_de_prioridad: null`, `cantidades: { propuestas: 2, datasets_nuevos: null }`, `ver_propuestas: 'Ver las 2 propuestas'`, `aviso_datasets_nuevos: null`, `ver_datasets_nuevos: null` y `orden` en cada propuesta; con `[]` (`datasets_nuevos: 0`, aviso `null`); con una y con tres (`numero`, `valor`, `riesgo`, aviso y botón en singular y plural); una edición con una sola propuesta («Ver la propuesta»); el orden de las claves del detalle (el test que lo compara con el fixture, ~línea 2512, y el de `tests/dato-quincena-frontend.test.js` que fija la lista de claves); el modelo del mail sigue sin `orden` en las propuestas (`FUERA_DEL_MAIL`).
- [ ] **Step 2: Correr** `node --test tests/dato-quincena-reglas.test.js tests/dato-quincena-correo-reglas.test.js`. Expected: FAIL en los nuevos.
- [ ] **Step 3: Implementar** las claves en `services/datoQuincenaReglas.js` (las de primer nivel después de `propuestas_datasets` o donde las ordene el test, siempre las mismas para todo detalle) y sumar `orden` a `FUERA_DEL_MAIL`. Actualizar el fixture JSON con lo que da el código.
- [ ] **Step 4: Correr** `node --test --test-concurrency=1 tests/dato-quincena-*.test.js tests/paginas.test.js tests/documentos.test.js`. Expected: PASS, con el resguardo del mail igual (la parte de la página del resguardo puede fallar si compara el detalle: si falla, no la regeneres; avisalo, la retira la tarea 2).
- [ ] **Step 5: API:** el GET del detalle de una edición guardada trae las claves nuevas; correr `node --test tests/dato-quincena-api.test.js`. Expected: PASS.
- [ ] **Step 6: Documentar** las claves en `docs/temas/dato-quincena.md`.
- [ ] **Step 7: Commit** `feat(dato-quincena): el detalle suma los números, la matriz y los textos de las pestañas`.

### Task 2: La dirección, las pestañas y General

**Files:**
- Modify: `public/js/dato-quincena.js` (`estadoDeLaUrl`, `urlDeEstado`, `htmlDelDetalle` y lo nuevo de las pestañas y de General; los eventos en la parte del DOM)
- Modify: `public/dato-quincena.html` (los estilos de la cabecera, las pestañas y General; `?v=20261235`)
- Modify: `tests/paginas.test.js` (`VERSION_DATO_QUINCENA = '20261235'`)
- Modify: `tests/dato-quincena-resguardo.test.js` y `tests/fixtures/dato-quincena-antes-de-v1-4.json` (sale la parte de la página; el mail queda)
- Test: `tests/dato-quincena-frontend.test.js`
- Modify: `docs/temas/dato-quincena.md` (la página: la dirección, las pestañas y General)

**Interfaces:**
- Consumes: las claves de la tarea 1.
- Produces: `estadoDeLaUrl(search, hash)` → `{ id, anio, pagina, correo, vista, propuesta }` (`vista`: `'general'|'propuestas'|'datasets'|null`; `propuesta`: entero positivo o `null`); `urlDeEstado({ id, anio, pagina, correo, vista, propuesta })` que escribe `&vista=` solo si no es `general` y `&propuesta=` solo con `vista` `propuestas`; `htmlDelDetalle(detalle, { admin, vista, propuesta })` que devuelve la cabecera, las pestañas y los tres paneles (los no elegidos con `hidden`); funciones puras por panel que las tareas 3 y 4 completan (`htmlDelPanelGeneral`, `htmlDelPanelPropuestas`, `htmlDelPanelDatasets`, con esos nombres o los que elijas, documentados en el informe).

- [ ] **Step 1: Tests que fallan (vm):**
  - `estadoDeLaUrl`: `?id=20` (vista null), `&vista=propuestas&propuesta=3`, valores que no sirven (`vista=x`, `propuesta=0`, `propuesta=03`, `propuesta=-1`) dan `null`; `#correo` sigue igual.
  - `urlDeEstado`: los casos de hoy sin cambios, y con vista y propuesta.
  - `htmlDelDetalle`: con la respuesta `detalle` (sin la clave) hay dos pestañas, con `detalle_datasets_vacia` y `detalle_con_datasets` tres; los contadores salen de `cantidades` (sin `cantidades`, sin número); la elegida por defecto es General; `vista: 'datasets'` sin la clave elige General; los `aria-*` del tablist y los paneles; la cabecera (marca o N.º, fecha, título, doble línea).
  - General: la principal (etiquetas, título, cifra, dataset, el botón con `ver_propuestas`), el lugar de la infografía, la nota de Datito solo si hay, el recibo, la agenda en sus grupos (sin agenda, nada), los archivos con sus «Ver» y «Descargar», el aviso de datasets nuevos solo con `aviso_datasets_nuevos`, y la caja «Correo» solo con `admin: true`.
  - El escapado de cada texto nuevo y Review Focus 2 (una sola propuesta, sin nota, sin agenda).
- [ ] **Step 2: Correr** `node --test tests/dato-quincena-frontend.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar** lo puro (la dirección, la cabecera, las pestañas, General) y en la parte del DOM: al cargar el detalle, la vista y la propuesta salen de la dirección; tocar una pestaña (o usar flechas, Inicio y Fin) muestra su panel, mueve el foco y reemplaza la dirección (`history.replaceState`, conservando `#correo` si está); pasar a Correo y volver deja la misma vista y propuesta; la infografía se carga una vez en su lugar de General; un botón de General que lleva a otra pestaña la elige. Los estilos, como la maqueta A.
- [ ] **Step 4: El resguardo:** sacá de `tests/dato-quincena-resguardo.test.js` el `it` de las páginas y de su fixture la clave `pagina` (la página cambia a propósito: spec, sección 8); la parte del mail no se toca.
- [ ] **Step 5: Subir** la versión a `20261235` en el HTML y en `tests/paginas.test.js`. Correr `node --test --test-concurrency=1 tests/dato-quincena-*.test.js tests/paginas.test.js tests/documentos.test.js`. Expected: PASS.
- [ ] **Step 6: Documentar** la dirección, las pestañas y General en `docs/temas/dato-quincena.md`.
- [ ] **Step 7: Commit** `feat(dato-quincena): el detalle en pestañas, la dirección y General`.

### Task 3: Propuestas

**Files:**
- Modify: `public/js/dato-quincena.js` (el panel Propuestas y sus eventos)
- Modify: `public/dato-quincena.html` (los estilos del índice y de la propuesta)
- Test: `tests/dato-quincena-frontend.test.js`
- Modify: `docs/temas/dato-quincena.md` (el panel)

**Interfaces:**
- Consumes: `orden` de cada propuesta (tarea 1); `htmlDelDetalle(detalle, { admin, vista, propuesta })` y el panel vacío de la tarea 2.
- Produces: el panel Propuestas completo (spec, sección 4): índice (lista con la elegida marcada con algo más que el color), una propuesta por vez, anterior/siguiente, chips en el teléfono.

- [ ] **Step 1: Tests que fallan (vm):** el índice con todas las propuestas (número de `orden`, título, marca de principal y de «Para validar»); la elegida por defecto es la principal (la primera si ninguna lo es); `propuesta: 3` elige la de `orden` 3; una que no existe, la principal (Review Focus 1); sin `orden`, la posición (Review Focus 3); el contenido de la elegida en el orden de la spec (etiquetas, título, cifra, dataset y foto, repetición, «Para validar», las dos columnas con «Texto para redes» y su «Copiar», el borrador con su «Copiar», «Idea de placa», los tres `<details>`, «Copiar la propuesta», anterior y siguiente, sin anterior en la primera ni siguiente en la última); el escapado; Review Focus 5 (`overflow-wrap: anywhere` en el índice y en el contenido, test sobre el `<style>`).
- [ ] **Step 2: Correr** `node --test tests/dato-quincena-frontend.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar** el panel y sus eventos (elegir del índice o con anterior/siguiente redibuja la propuesta, mueve el foco a su título y reemplaza la dirección con `&propuesta=`); los «Copiar» siguen con `data-copiar`. Estilos como la maqueta A.
- [ ] **Step 4: Correr** `node --test --test-concurrency=1 tests/dato-quincena-*.test.js tests/paginas.test.js tests/documentos.test.js`. Expected: PASS.
- [ ] **Step 5: Documentar** el panel en `docs/temas/dato-quincena.md`.
- [ ] **Step 6: Commit** `feat(dato-quincena): el panel de las propuestas, una por vez con índice`.

### Task 4: Datasets nuevos

**Files:**
- Modify: `public/js/dato-quincena.js` (el panel Datasets nuevos)
- Modify: `public/dato-quincena.html` (los estilos de la matriz, la lista y las tarjetas)
- Test: `tests/dato-quincena-frontend.test.js`
- Modify: `docs/temas/dato-quincena.md` (el panel)

**Interfaces:**
- Consumes: `matriz_de_prioridad`, y `numero`, `valor` y `riesgo` de cada dataset (tarea 1); el panel vacío de la tarea 2.
- Produces: el panel completo (spec, sección 5).

- [ ] **Step 1: Tests que fallan (vm):** con `detalle_con_datasets`, la matriz es una `<table>` con encabezados de fila (Riesgo alto/medio/bajo) y de columna (Valor bajo/medio/alto), cada celda con la clase de su `clave` (por mapa) y su texto visible solo con `con_rotulo` (oculto en las demás), la de `no_se_propone` rayada además de su color, y cada dataset como marcador con su `numero` en la celda de su `valor` y `riesgo`; la lista al lado (número, título, prioridad, eje) con su enlace a la tarjeta; las tarjetas con el contenido de hoy; con `detalle_datasets_vacia`, solo la línea; sin `matriz_de_prioridad`, sin matriz y con la lista y las tarjetas (Review Focus 3); el escapado; Review Focus 5.
- [ ] **Step 2: Correr** `node --test tests/dato-quincena-frontend.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar** el panel. Estilos como la maqueta A (colores de zona: `--sg-verde-fondo`/`--sg-verde`, `--sg-azul-fondo`/`--sg-azul`, `--sg-sol`/`--sg-ambar`, y para «No se propone» un rojo claro con rayado y `--sg-rojo`).
- [ ] **Step 4: Correr** `node --test --test-concurrency=1 tests/dato-quincena-*.test.js tests/paginas.test.js tests/documentos.test.js`. Expected: PASS.
- [ ] **Step 5: Documentar** el panel en `docs/temas/dato-quincena.md`.
- [ ] **Step 6: Commit** `feat(dato-quincena): el panel de los datasets nuevos con la matriz`.

### Task 5: La suite completa y el control visual

**Files:** ninguno del repo (scripts en el scratchpad; notas en `~/rpad-notas/dato-quincena-detalle-pestanas/`).

- [ ] **Step 1: Suite completa** `npm test` en el worktree. Expected: 0 fallas; el log en `~/rpad-notas/logs/`.
- [ ] **Step 2: Vista real:** armar con las funciones del servidor de la rama los detalles de los pilotos 19 y 20 (JSON en `~/rpad-notas/dato-quincena-datasets-propuestos/pilotos-reales/`) y uno sin la clave, servir la página de la rama con esas respuestas (como `pilotos-reales/web/`) y mirar las tres pestañas a 1280 px y a 390 px, con lector y con administración.
- [ ] **Step 3: Anotar** el resultado en `~/rpad-notas/dato-quincena-detalle-pestanas/control-visual.md` y bajar el servidor.

## Después del plan

Revisión final de toda la rama con Fable 5.2 alto, ola de arreglos y re-revisión; la suite completa otra vez; squash en main con push; el kit `~/rpad-kits/RPAD-deploy-dato-quincena-detalle-pestanas/` contra 8c8f313 (sin SQL, con Restart, vuelta atrás, `PASOS.txt` con la comprobación de `dato-quincena.js?v=20261234` y la ventana), controlado con `python3 -I ~/rpad-notas/control-kit.py <kit> dato-quincena-detalle-pestanas 8c8f313 <head>`; TODO EN VERDE a la coordinadora. Despliegue del usuario antes del martes 24/11.
