# Generador de Notas — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Herramientas → Notas pasa a ser el generador de la DGMIT.
- La nota interna va a la Subsecretaría y la externa directo al organismo; la elige el ámbito del área.
- Los "Datos solicitados" los calcula el RPAD y cada dataset suma su "Qué se solicita".
- Sale en Word, en hoja membretada oficio de 216 × 356 mm, sin firma.
- Además, cada Nota Digital del Libro se puede bajar en Word, sin firma.

**Architecture:** Una representación intermedia de "bloques" (párrafos, tabla, firma y lista) que dibujan dos salidas:
- **Bloques → Word:** `renderDocx`, en `services/notasWord.js`.
- **Bloques → HTML:** `renderHtmlDeBloques`, para la vista previa.

Los bloques salen de dos fuentes:
- **La nota de la DGMIT:** `construirNotaDgmit`, puro, en `services/notasGeneradorContenido.js`.
- **El HTML guardado de una Nota Digital:** `bloquesDeNotaDigital`, en `services/notasDigitalesWord.js`.

Así la vista previa y el Word no pueden diferir, y los dos Word comparten la hoja. La validación es pura (`services/notasGeneradorReglas.js`); las consultas van en `services/notasGeneradorDatos.js`; la página (`notas.js`) solo dibuja lo que manda el servidor.

**Tech Stack:** Node 22 (ES modules), Express 4, mysql2/promise, `docx` 8.5.0 (ya instalada), jszip (llega con docx, para los tests), vanilla JS, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-24-generador-de-notas-design.md` (aprobada el 24/10/2026). Manda sobre la maqueta `docs/superpowers/specs/2026-10-24-generador-de-notas-mockups/generador.html`, que es el molde de la página: pasos, filas compactas, nota anterior en etiquetas, campos cortos y vista previa sobre la hoja membretada.

## Global Constraints

- **Cuándo:** se empieza cuando `feat/metricas-y-reportes` esté mergeada en main (pedido del usuario). La Task 1 trae main a esta rama. Los números de línea que cita este plan son de main 8b25ae0: después de traer main, se vuelven a buscar por nombre.
- **Dónde:** worktree `C:/git/rpad/.claude/worktrees/generador-de-notas`, rama `feat/generador-de-notas`. Nunca se escribe en `C:/git/rpad` (main) ni en su base.
- **Base de la rama:** `rpad_rama_generador`, copia de `datospublicos_mcr_rpad` con las migraciones de Métricas y la de esta rama aplicadas. El `.env` del worktree apunta a ella. `node_modules`, con un enlace (junction) a `C:\git\rpad\node_modules`. Antes de `git worktree remove`, sacar el enlace con `cmd //c "rmdir node_modules"` y comprobar que el `node_modules` de main sigue entero.
- **No romper lo implementado:** `npm test` completo antes de empezar (la línea de base queda en el ledger) y al final de cada tarea. Cuando una tarea cambia a propósito algo que afirmaba un test viejo, el cambio del test va en esa tarea y se nombra en su paso.
- **Ningún email real:** en el `.env`, `SMTP_HOST=127.0.0.1` y `SMTP_PORT=1025` (Mailpit). Nunca llamar a `/api/cron/*`.
- **Subagentes:** todos con Opus (implementar, revisar y corregir), por pedido del usuario.
- **Commits:** uno por tarea, en español, terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Servidor:** SQL siempre parametrizado. Respuestas `{ success, data?, error?, message? }`. Un error de validación es `{ success: false, error, campo, errores }`, como `rechazoDeValidacion` de `controllers/notasDgmitController.js`.
- **Migraciones:** van antes del código. Sin `DELIMITER`, `USE` ni `CHECK`; se pueden repetir y tienen su vuelta atrás.
- **Fechas:** texto `'AAAA-MM-DD'`. Hoy es `hoyArgentina()` (servidor) o `Utils.hoyEnArgentina()` (navegador). Nada de `new Date` local ni `toISOString` para fechas.
- **Sin nombres de personas** en archivos versionados. Los HTML de prueba de las Notas Digitales van con "Nombre Apellido" y correos `x@ejemplo.gob.ar`.
- **Frontend:**
  - Los scripts van como `<script src="js/X.js?v=…"></script>`, sin atributos.
  - `notas.js` pasa a llevar `?v=` (`VERSION_NOTAS`). `areas.js` y `correos.js` suben el suyo.
  - `main.js` cambia, así que `VERSION` sube en todas las páginas y en `tests/paginas.test.js`.
  - Cada versión nueva es la fecha de la tarea (`AAAAMMDD`), mayor que la que dejó Métricas.
  - `api.js` no cambia.
  - Todo texto dinámico pasa por `Utils.escapeHtml`; un 0 se escribe con `String(n)`.
- **Texto en castellano:** "de" + "el" es "del" y "a" + "el" es "al" en todo texto que arme el sistema ("dependiente del Ministerio…", "Al Instituto…"). Es una decisión de este plan: la spec escribe "de {artículo}", y con "el" quedaría "de el".
- **Textos exactos:** los de la spec.
  - Las notas: secciones 4.2, 4.3 y 4.4.
  - La tabla y los datos solicitados: 4.5.
  - La pantalla y sus mensajes: secciones 1 y 3.
  - El Word de las Notas Digitales: 6.
  - Nunca se reescriben de memoria: se copian de la spec.
- **Tono:** nada que se lea como un reproche. "No se ha recibido la información", en impersonal; nunca "el área no respondió".
- **Orden de despliegue:** primero la migración de Métricas, después la de esta rama.

## Review Focus

1. **Artículos "el".** Áreas con artículo "el", sin dependencia, o con una dependencia de artículo "el" (el Ministerio de Educación del Chubut). Lo esperado: "Al Instituto…", "…ante el Ente Autárquico Comodoro Deportes, dependiente de la Intendencia, …", "…dependiente del Ministerio de Educación del Chubut, …" y, sin dependencia, "…ante la Dirección General de Sueldos, la remisión…". → Task 5.
2. **Números raros.** "—", comillas tipográficas, emoji, varias "/" o 40 caracteres con emoji (contados con `Array.from`) en el número de la nota o en las notas anteriores. Salen tal cual en el Word y nunca dan 500; un número que llega como número JSON da 400. → Task 7.
3. **Una fecha de la nota que cambia el estado.** Un dataset al día hoy que a la fecha de la nota ya es próximo, y al revés. La lista del paso 2, lo que viene tildado y la validación del servidor usan la fecha de la nota; la lista del paso 1 usa hoy. → Task 7.
4. **Notas Digitales de distintas épocas.** La 1/26, sin la primera línea, con 6 columnas y la firma sin negrita; dos firmas con su leyenda; el CC vacío. El Word sale sin ningún dato de la firma, conserva la leyenda y omite el CC vacío; si no encuentra el remitente da 422 con un mensaje, nunca un Word roto. → Task 10.
5. **Sesión y permisos en la página.** La sesión vence a mitad del armado (401 en la vista previa o en la descarga) y la página lleva al login. Un lector que entra por la URL ve "No tenés permiso para usar el generador de notas." y ningún pedido sale. → Tasks 8 y 9.

---

### Task 1: Base de la rama y migración de las áreas

**Files:**
- Create: `database/updates/migracion-generador-notas.sql`, `database/updates/rollback-generador-notas.sql`
- Modify: `database/schema.sql` (la tabla `areas`), `tests/schema.test.js`
- Modify (sin versionar): `.env` del worktree (`DB_NAME=rpad_rama_generador`, más el resto copiado del `.env` de main) y el enlace `node_modules`

**Interfaces:**
- Produces:
  - **La columna:** en `areas`, después de `articulo_superior`, `` `ambito` enum('municipal','externo') NOT NULL DEFAULT 'municipal' ``. Con `DEFAULT 'municipal'`, los `crearArea` de los fixtures siguen andando.
  - **La migración**, repetible:
    - `ADD COLUMN IF NOT EXISTS`.
    - Una sentencia por área de afuera (las 13 del Anexo A: 2, 3, 4, 6, 24, 27, 28, 29, 30, 35, 41, 43 y 44), con la forma `UPDATE areas SET ambito = 'externo' WHERE id = N AND nombre = '<nombre original>';`.
    - Una sentencia por texto corregido del Anexo A, con la forma `UPDATE areas SET <col> = '<corregido>' WHERE id = N AND <col> = '<original>';`. Las columnas son `nombre`, `area_superior` y `articulo_superior`.
    - Cada sentencia lleva arriba el comentario `-- <id>. <nombre>`.
    - Los originales salen de `SELECT id, nombre, area_superior, articulo_superior FROM areas` en la base de la rama, que tiene el dump del 24/10. Los corregidos, del Anexo A de la spec, tal cual.
    - El ámbito va antes que los textos, porque usa el nombre original.
  - **La cabecera de la migración:**
    - la ruta de la spec;
    - "ORDEN: correr ANTES de subir el código y después de migracion-metricas.sql";
    - "Se puede volver a correr: los textos solo cambian si siguen siendo los originales";
    - "Si después alguien cambia en Áreas el ámbito de una de las 13, no la vuelvas a correr: la vuelve a marcar como externa";
    - "Para deshacer: rollback-generador-notas.sql".
    - Al final, una consulta de verificación comentada: cuántas áreas quedaron `externo` (13).
  - **La vuelta atrás:** `UPDATE … SET <col> = '<original>' WHERE id = N AND <col> = '<corregido>'` para cada texto, y después `ALTER TABLE areas DROP COLUMN IF EXISTS ambito`. La cabecera dice que va después de volver a los archivos anteriores.

- [ ] **Step 1: Preparar la rama.**
  - En el worktree: `git merge main`, con Métricas ya adentro (un merge, no un rebase). Volver a ubicar por nombre lo que este plan cita por número de línea.
  - Crear el enlace `node_modules`: `cmd //c mklink /J node_modules C:\git\rpad\node_modules`.
  - Crear `rpad_rama_generador` como copia de `datospublicos_mcr_rpad`, con `mariadb-dump` y `mariadb` adentro del contenedor `rpad-db`, sin tocar la original. Aplicarle las migraciones de Métricas (las de `database/updates/` que Métricas agregó, en el orden de su README).
  - Escribir el `.env` del worktree.
  - Correr `npm test` y anotar la línea de base en el ledger.
- [ ] **Step 2: Write the failing tests** en `tests/schema.test.js`: un `describe('migración del generador de notas')`, con el molde de la migración de "auditar sin responsabilidad" (una columna) y el de "requiere nota datos" (UPDATEs por id):
  - `codigo(MIGRACION)` no tiene `DELIMITER`, `USE`, `DROP`, `RENAME` ni `CHECK`;
  - la cabecera tiene la spec, "ANTES de subir el código" y `rollback-generador-notas.sql`;
  - cada `UPDATE` cumple la forma exacta y tiene el comentario `-- <id>. ` arriba;
  - desde la estructura sin la columna, con 9 áreas originales cargadas (2, 6, 7, 11, 18, 25, 35, 38 y 42, con sus textos del dump), la migración corrida dos veces deja las columnas de `schema.sql`. Además: las áreas 2, 6 y 35 en `externo`; la 18 y la 25 en `municipal`; el nombre de la 7 "Dirección de Patrimonio Cultural y Natural"; la dependencia de la 18 "Subsecretaría de Recursos Humanos de la Secretaría de Gobierno, Modernización y Transparencia"; el artículo de la dependencia de la 6 `el`; y la dependencia de la 35 NULL;
  - un texto cambiado a mano antes de migrar (la dependencia de la 18) no se pisa;
  - la vuelta atrás, corrida dos veces, deja las columnas de antes y los 9 textos originales; la migración otra vez deja `schema.sql`;
  - "no trae datos en" sigue pasando para `areas`.
- [ ] **Step 3: Run** `node --test tests/schema.test.js`. Expected: FAIL (no existe la migración).
- [ ] **Step 4: Implement** la migración, la vuelta atrás y la columna en `schema.sql`.
- [ ] **Step 5: Aplicar** la migración en `rpad_rama_generador`: la primera prueba de `schema.test.js` compara `schema.sql` contra la base del `.env`. Correr la consulta de verificación: tiene que dar 13. Run `node --test tests/schema.test.js` y `npm test`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: ámbito de las áreas (municipal o fuera del municipio) y textos corregidos (migración y vuelta atrás)`.

### Task 2: El ámbito en Áreas (API y formulario)

**Files:**
- Modify: `controllers/areasController.js` (`createArea`, `updateArea`), `public/areas.html`, `public/js/areas.js`, `tests/paginas.test.js` (si fija la versión de `areas.js`)
- Create: `tests/areas-ambito-api.test.js`

**Interfaces:**
- Consumes: la columna de la Task 1.
- Produces:
  - `AMBITOS = ['municipal', 'externo']` y `MENSAJE_AMBITO = 'Elegí si el área es municipal o de fuera del municipio.'`, exportados de `controllers/areasController.js`.
  - `POST /api/areas`: `ambito` opcional, por defecto `'municipal'`.
  - `PUT /api/areas/:id`: si llega, se valida y se escribe tal cual. Nunca `|| null`.
  - Otro valor da 400 `{ success: false, error: MENSAJE_AMBITO, campo: 'ambito' }`.
  - `GET /api/areas` ya devuelve `ambito` (por `a.*`).

- [ ] **Step 1: Write the failing tests** (`tests/areas-ambito-api.test.js`, base propia con `crearBaseDePrueba('rpad_test_areas_ambito')`, como `tests/seguimiento-api.test.js`):
  - crear sin `ambito` → `municipal`; con `'externo'` → `externo`; con `'otro'` → 400 con `MENSAJE_AMBITO` y `campo: 'ambito'`;
  - actualizar solo `ambito` → cambia; actualizar el nombre sin `ambito` → lo conserva;
  - `GET /api/areas` trae `ambito`.
- [ ] **Step 2: Run** `node --test tests/areas-ambito-api.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** el servidor y el formulario:
  - un `<label for="ambito">Ámbito</label>` con `<select id="ambito" class="form-input">` (`municipal` "Municipal", `externo` "Fuera del municipio") debajo de `articulo_superior`, con la ayuda de la spec, sección 2, en un `.form-hint`;
  - `openAreaModal` lo llena (`area.ambito || 'municipal'`) y el `submit` lo manda;
  - en la lista, junto al nombre, la insignia "Fuera del municipio" (`badge-secondary`) cuando es `externo`;
  - `areas.js` sube su `?v=`.
- [ ] **Step 4: Run** el archivo y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: el ámbito del área en la API y en el formulario de Áreas`.

### Task 3: Reglas puras del generador

**Files:**
- Create: `services/notasGeneradorReglas.js`, `tests/notas-generador-reglas.test.js`
- Modify: `services/notasDgmitReglas.js` (recibe `sePuedeElegir`), `controllers/notasDgmitController.js` (la importa), `tests/notas-dgmit-reglas.test.js`

**Interfaces:**
- Produces, en `services/notasDgmitReglas.js`:
  - `export const sePuedeElegir = (dataset) => Boolean(dataset.activo) && dataset.tipo_gestion === 'externa' && (dataset.requiere_nota === null || dataset.requiere_nota === 1)`. Es la misma de `notasDgmitController.js`, que se borra de ahí.
- Produces, en `services/notasGeneradorReglas.js` (puro; importa `esFechaIso`, `sumarDias` y `formatoCorto` de `notasDigitalesCalendario.js`):
  - `LARGO_NUMERO = 40`, `FECHA_MINIMA = '2025-01-01'` y `DIAS_ADELANTE = 30`.
  - `TIPOS_NOTA = ['interna', 'externa']` y `PEDIDOS = ['solicitud', 'reiteracion']`.
  - `ORDEN_DE_CAMPOS = ['fecha', 'numero', 'tipo', 'pedido', 'anteriores', 'area', 'datasets']`.
  - `MENSAJES_GENERADOR` (congelado):
    ```js
    { fecha: 'Elegí la fecha de la nota.',
      fechaFuera: 'La fecha de la nota tiene que estar entre el 01/01/2025 y 30 días después de hoy.',
      numeroLargo: 'El número de la nota puede tener hasta 40 caracteres.',
      tipo: 'Elegí si la nota es interna o externa.',
      pedido: 'Elegí si es una solicitud o una reiteración.',
      anteriorLargo: 'Cada número de nota anterior puede tener hasta 40 caracteres.',
      area: 'Elegí el área.',
      datasets: 'Elegí al menos un dataset.' }
    ```
  - `textoAlDia(titulo)` → `«${titulo}» está al día: todavía no hay datos para pedir.`
  - `textoDeOtraArea(titulo)` → `«${titulo}» no es del área elegida.`
  - `validarPedidoDeNota(entrada, hoy)` → `{ datos: { fecha, numero, tipo, pedido, anteriores, area_id, datasets }, errores }`. Nunca tira.
    - `numero`: texto recortado o `null` si está vacío. Si no es texto ni null, error de `numeroLargo`.
    - `anteriores`: lista de textos recortados, sin vacíos ni repetidos; solo con reiteración (con solicitud, `[]`).
    - `area_id` y `datasets`: enteros positivos (los ids con la regla de `idsDeDatasets`: sin repetidos, y uno malo invalida el campo).
    - Caracteres contados con `Array.from`.
  - `sePuedePedir(estado)` → `estado !== 'actualizado'`. Sirve para los estados de `estadoDelDataset`.
  - `ordenDeLaTabla(datasets)` → copia ordenada de `[{ titulo, dias, estado, proxima }]`:
    1. los vencidos (`dias < 0`), el más vencido primero;
    2. los próximos, por `dias`;
    3. el resto, por `proxima`, con `null` al final;
    4. los empates, por título (`localeCompare(…, 'es')`).

- [ ] **Step 1: Write the failing tests** (`tests/notas-generador-reglas.test.js`):
  - `validarPedidoDeNota({ fecha: '2026-10-24', tipo: 'interna', pedido: 'solicitud', area_id: 37, datasets: [58] }, '2026-10-24')` → sin errores y `numero: null`;
  - fecha `'2024-12-31'` y `'2026-11-24'` (hoy + 31) → `fechaFuera`; `'2026-11-23'` vale; `'2026-02-29'` → `fecha`;
  - un número de 40 emoji vale y uno de 41 da `numeroLargo`; `numero: 125` → `numeroLargo` (no tira);
  - `tipo: 'escalonada'` → `tipo`; `pedido: 'x'` → `pedido`;
  - con reiteración, `anteriores: [' 97/26 ', '97/26', '', '102/26']` → `['97/26', '102/26']`; con solicitud → `[]`;
  - `datasets: []` → `datasets`; `[5, 'x']` → `datasets`;
  - `errores` sigue `ORDEN_DE_CAMPOS`;
  - `sePuedePedir`: `actualizado` → false; `atrasado`, `sin-respuesta`, `proximo`, `eventual` y `sin-fecha` → true;
  - `ordenDeLaTabla` con un vencido de −85, uno de −450, un próximo de 37, uno al día y un eventual → `[−450, −85, 37, al día, eventual]`;
  - en `tests/notas-dgmit-reglas.test.js`: `sePuedeElegir` con activo e inactivo, interno, `requiere_nota` 1, 0 y null.
- [ ] **Step 2: Run** los dos archivos. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** los archivos, `tests/notas-dgmit-api.test.js` y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: reglas puras del generador de notas (validación, qué se puede pedir y el orden de la tabla)`.

### Task 4: Las notas DGMIT del ciclo abierto

**Files:**
- Modify: `services/seguimientoReglas.js`, `tests/seguimiento-reglas.test.js`

**Interfaces:**
- Consumes: `notasDgmitPorCiclo(fuentes, ciclos, hoy)` y su ayudante `notasDgmitVigentes`, que dejó Métricas en `seguimientoReglas.js`; `ciclosDe(fuentes, hoy)`. Si al traer main tienen otros nombres, se usan los de main.
- Produces: `export const notasDgmitDelCicloAbierto = (fuentes, hoy)` → `[{ numero, tipo, recibida }]`.
  - Son las vigentes (sin anular y recibidas hasta `hoy`) del ciclo abierto, ordenadas por recepción, después por carga y después por id: `notasDgmitPorCiclo(fuentes, ciclosDe(fuentes, hoy), hoy).at(-1) ?? []`.
  - Sin ciclos (eventual o sin fecha), todas las vigentes en ese orden.
  - La primera es la "nota original del ciclo" de la spec 3.2. Nunca tira: con entradas inválidas, `[]`.

- [ ] **Step 1: Write the failing tests** (`describe('notasDgmitDelCicloAbierto')`, con el molde de `describe('notasDgmitPorCiclo')` y un caso de `tests/seguimiento-casos.js`):
  - una solicitud y una reiteración en el ciclo abierto → las dos, solicitud primero;
  - una anulada no está; una recibida después de `hoy` no está; una de un ciclo anterior no está;
  - un eventual con dos notas → las dos;
  - `notasDgmitDelCicloAbierto(null, '2026-10-24')` → `[]`.
- [ ] **Step 2: Run** `node --test tests/seguimiento-reglas.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**, al lado de `notaDgmitDelCiclo`.
- [ ] **Step 4: Run** el archivo y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: las notas DGMIT del ciclo abierto, en orden de recepción`.

### Task 5: El contenido de la nota de la DGMIT (bloques)

**Files:**
- Create: `services/notasGeneradorContenido.js`, `tests/notas-generador-contenido.test.js`
- Modify: `services/notasDigitalesContenido.js` (`export const QUE_SE_SOLICITA_POR_DEFECTO`; la regex de `tests/admin-frontend.test.js` igual lo encuentra)

**Interfaces:**
- Produces: la representación de bloques, que usan las Tasks 6, 7, 9 y 10 (se documenta con JSDoc arriba del archivo).
  ```js
  // Parte  = { texto, negrita?, subrayado?, cursiva?, salto?, letra? }    // salto: un renglón nuevo antes; letra: medios puntos
  // Celda  = { partes: Parte[], abarca?, fondo?: 'gris', letra? }
  // Fila   = { encabezado?: true, celdas: Celda[] }
  // Bloque = { tipo: 'parrafo', alinear: 'izquierda'|'derecha'|'centro'|'justificado', partes: Parte[], antes?, despues? }  // espacios en twips
  //        | { tipo: 'tabla', anchos: number[] /* proporciones que suman 100 */, filas: Fila[] }
  //        | { tipo: 'lista', items: Parte[][] }
  //        | { tipo: 'firma', columnas: 1 | 2 }     // el espacio en blanco para firmar a mano
  ```
- Produces, en `services/notasGeneradorContenido.js`:
  - `LETRA = { cuerpo: 24, tabla: 20, queSeSolicita: 18 }` y `ANCHOS_TABLA = [38, 24, 38]`.
  - `INFORMACION_SIN_PEDIDO = 'Información actualizada disponible'`.
  - `construirNotaDgmit({ tipo, pedido, fecha, numero, anteriores, area: { nombre, articulo, area_superior, articulo_superior }, datasets: [{ titulo, frecuencia, datosSolicitados, queSeSolicita }] })` → `Bloque[]`:
    - con los textos exactos de la spec 4.2 (interna), 4.3 (externa), 4.4 (reiteración) y 4.5 (tabla);
    - el área en negrita;
    - "Al"/"A la" y "de"/"del" según los artículos;
    - `numero` null da `____/AA`;
    - la tabla en el orden recibido (lo ordena quien llama);
    - `queSeSolicita` vacío da `QUE_SE_SOLICITA_POR_DEFECTO`;
    - `datosSolicitados` null da `INFORMACION_SIN_PEDIDO`;
    - termina en `{ tipo: 'firma', columnas: 1 }`.
  - `textoDeNotasAnteriores(numeros)`: `[]` → `null`; `['97/26']` → `'Nota N° 97/26'`; `['88/26', '102/26']` → `'Notas N° 88/26 y N° 102/26'`; tres → `'Notas N° a, N° b y N° c'`.
  - `renderHtmlDeBloques(bloques)` → HTML escapado:
    - `<p>` con `text-align`;
    - `<b>`, `<u>`, `<i>` y `<br>`;
    - `<table class="nota-tabla">` con `colspan`;
    - la firma, como `<div class="nota-firma"></div>`.
  - `nombreDelWord({ tipo, pedido, area, fecha })` → `` `Nota ${tipo}${pedido === 'reiteracion' ? ' reiteracion' : ''} - ${area} - ${fecha}.docx` ``.

- [ ] **Step 1: Write the failing tests.** Un ayudante `textoDe(bloques)` une las partes de cada párrafo. Los textos esperados se copian de la spec.
  - Interna, solicitud, "Secretaría de la Mujer, Género y Diversidad" ("la", dependiente de "la" "Intendencia"), número null, 24/10/2026:
    - REF `REF.: "Solicitud de datos para el Portal de Datos Abiertos Municipal"` a la derecha y `Nota N° ____/26`;
    - el destinatario `SUBSECRETARÍA DE MODERNIZACIÓN Y TRANSPARENCIA`, en negrita y subrayado;
    - el párrafo de la spec 4.2, punto 4, completo, con el área en negrita;
    - el cierre `DIRECCIÓN GENERAL DE MODERNIZACIÓN E INVESTIGACIÓN TERRITORIAL, 24 de octubre de 2026.`;
    - el último bloque, `{ tipo: 'firma', columnas: 1 }`.
  - Artículos (Review Focus 1):
    - "Ente Autárquico Comodoro Deportes" ("el", "la" "Intendencia") → `…gestionar ante el Ente Autárquico Comodoro Deportes, dependiente de la Intendencia, la remisión…`;
    - dependencia "el" "Ministerio de Educación del Chubut" → `…, dependiente del Ministerio de Educación del Chubut, …`;
    - sin dependencia → `…ante la Dirección General de Sueldos, la remisión…`;
    - externa con "el" → el bloque `Al`; con "la", `A la`.
  - Externa, solicitud: el primer bloque `Comodoro Rivadavia, 24 de octubre de 2026`, a la derecha; después `PRESENTE`, `De nuestra consideración:`, el párrafo de la spec 4.3, punto 8, y `Sin más, saludamos a Uds. atentamente.`; el remitente, sin fecha; al final, la firma.
  - Reiteración interna con `['97/26']`:
    - REF `Reiteración – Solicitud de datos para el Portal de Datos Abiertos Municipal`;
    - el primer párrafo empieza `Solicito a Ud. tenga a bien reiterar ante la `;
    - después de la tabla y antes de `Justificación:`, `La presente reiteración se debe a que, al día de la fecha, no se ha recibido la información solicitada mediante Nota N° 97/26, conforme a lo establecido en la Ordenanza N° 17.662/23.`
  - Reiteración externa:
    - con `['88/26', '102/26']`, `…mediante Notas N° 88/26 y N° 102/26, conforme…`, antes de `Motiva dicha solicitud…`;
    - sin anteriores, `…no se ha recibido la información correspondiente, conforme…`;
    - el primer párrafo, el de la spec 4.4.
  - Tabla:
    - el encabezado `Conjunto de datos | Frecuencia | Datos solicitados`;
    - bajo cada dataset, una fila con `abarca: 3`: `Qué se solicita:` en cursiva, seguido del texto;
    - un eventual dice `Información actualizada disponible`;
    - sin "Qué se solicita", el texto por defecto.
  - `renderHtmlDeBloques` con un título `<script>alert(1)</script>` → escapado.
  - `nombreDelWord({ tipo: 'interna', pedido: 'reiteracion', area: 'Secretaría de Cultura', fecha: '2026-10-24' })` → `Nota interna reiteracion - Secretaría de Cultura - 2026-10-24.docx`.
- [ ] **Step 2: Run** `node --test tests/notas-generador-contenido.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** La fecha larga con `formatoLargo`.
- [ ] **Step 4: Run** el archivo, `tests/admin-frontend.test.js` y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: el contenido de la nota de la DGMIT (interna, externa, solicitud y reiteración) como bloques`.

### Task 6: El Word en la hoja membretada

**Files:**
- Create: `services/notasWord.js`, `public/img/membrete-isotipo-aclarado.png`, `tests/notas-word.test.js`

**Interfaces:**
- Consumes: los bloques de la Task 5. `validarImagenMembrete(datos, mime)` → `{ ancho, alto }` (`services/notasDigitalesPdf.js`). `obtenerConfig()` (`services/notasDigitalesDatos.js`).
- Produces:
  - `HOJA = { ancho: 12240, alto: 20160, arriba: 1985, costados: 1701, abajo: 1417, encabezado: 0, pie: 708 }`, en twips: oficio de 216 × 356 mm, con los márgenes de la hoja membretada.
  - `renderDocx(bloques, { membrete, pie })` → `Promise<Buffer>`.
    - `membrete` es `{ datos: Buffer, ancho, alto }` o `null`.
    - `pie` es un texto.
    - La marca de agua se lee de `public/img/membrete-isotipo-aclarado.png` una sola vez.
  - `membreteParaWord()` → `Promise<{ membrete, pie }>`, desde `notas_digitales_config`:
    - `membrete_imagen` y su mime, con el tamaño de `validarImagenMembrete`; `null` si no hay imagen;
    - `membrete_pie`.
- **Con `docx` 8.5.0, probado:**
  - `sections[].properties.page = { size: { width, height }, margin: { top, right, bottom, left, header: 0, footer: 708 } }`. El `header: 0` va explícito.
  - **El membrete** es un `ImageRun` flotante en el `Header`, anclado a la hoja en (0, 0):
    - `horizontalPosition` y `verticalPosition` con `relative: PAGE, offset: 0`;
    - `wrap: { type: TextWrappingType.NONE }`, `allowOverlap: true`, `behindDocument: false`;
    - `transformation: { width: 816, height: round(alto × 816 / ancho) }`, en píxeles a 96 ppp.
  - **La marca de agua** es otro `ImageRun` flotante en el mismo `Header`:
    - `align: CENTER` relativo a la hoja en los dos ejes;
    - `behindDocument: true`;
    - unos 500 × 500 px.
  - `ImageRun` no tiene `type`: guarda todo como `.png`, y Word y LibreOffice abren igual un JPEG.
  - **El pie** es un párrafo centrado con el estilo `PieRpad` (`paragraphStyles`, Arial de 8 pt): el texto de `pie`, un `break`, y `['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES]`. La letra va en el estilo y no en el run, porque si no LibreOffice dibuja los números en 12 pt.
  - **La tabla:**
    - `width: { size: 8838, type: DXA }`, con las `columnWidths` sacadas de `anchos`;
    - `layout: FIXED`;
    - bordes simples de tamaño 4, en negro;
    - el encabezado con `tableHeader: true` y `shading: { fill: 'D9D9D9' }`;
    - las celdas con `abarca`, en `columnSpan`.
  - **La firma:**
    - con una columna, un párrafo vacío con `spacing.before: 1440`;
    - con dos, una tabla sin bordes de dos celdas vacías de 1440 de alto (`HeightRule.ATLEAST`).
  - Estilo por defecto: Arial de 12 pt (`size: 24`). Las partes con `letra` y las celdas usan la suya.
  - Todas las imágenes salen con `docPr id="1"`. Word y LibreOffice lo abren igual, así que no se corrige.
- **La marca de agua aclarada** se genera una vez, con Python y Pillow:
  - desde `docs/superpowers/specs/2026-10-24-generador-de-notas-mockups/membrete-isotipo.png` (972 × 972, RGBA);
  - cada canal pasa a `255 − (255 − c) × 0,2`, y la transparencia se conserva;
  - se commitea el PNG. El script no se versiona.

- [ ] **Step 1: Write the failing tests** (`tests/notas-word.test.js`, puros, con `JSZip.loadAsync`). Con bloques de la Task 5 y un membrete hecho con `public/img/logo.png`:
  - `word/document.xml` tiene `w:pgSz w:w="12240" w:h="20160"` y `w:pgMar w:top="1985" w:right="1701" w:bottom="1417" w:left="1701" w:header="0" w:footer="708"`;
  - el `header` tiene dos `wp:anchor`, y uno con `behindDoc="1"`;
  - el `footer` tiene `PAGE`, `NUMPAGES` y el texto del pie;
  - el documento tiene el REF, el área y `Qué se solicita:`, y la tabla tiene `w:gridSpan w:val="3"` y `w:tblHeader`;
  - con `membrete: null`, el `header` tiene un solo `wp:anchor` (la marca de agua);
  - una firma de dos columnas da una tabla sin texto.
- [ ] **Step 2: Run** `node --test tests/notas-word.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**, generar el PNG y abrir un Word de prueba en LibreOffice: `"C:\Program Files\LibreOffice\program\soffice.exe" --headless --convert-to pdf`. Mirar que salga una hoja de 215,9 × 355,6 mm con el membrete, la marca de agua y el pie, y dejar el PDF en el ledger.
- [ ] **Step 4: Run** el archivo y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: el Word en la hoja membretada (oficio, encabezado, marca de agua y pie con páginas)`.

### Task 7: Los datos y la API del generador

**Files:**
- Create: `services/notasGeneradorDatos.js`, `tests/notas-generador-api.test.js`
- Modify: `controllers/notasController.js` (se reescribe: se van la escalonada, el sello y las fechas con `Date`), `middleware/auth.js`, `routes/index.js`, `tests/permisos.test.js`, `tests/reportes.test.js` (sale `describe('notas DOCX')`), `tests/notas-fixtures.js` (`crearDataset` suma `queSeSolicita`; `crearArea` acepta `ambito`)

**Interfaces:**
- Consumes: Tasks 3 a 6. `estadoDelDataset`, `pedido`, `tipoEfectivo` y `frecuenciaEnNota` (`fechasDatasetReglas.js`); `fuentesDe(ids)` (`seguimientoDatos.js`); `disposicionDeAdjunto` (`seguimientoReglas.js`).
- Produces:
  - En `middleware/auth.js`: `export const usaGeneradorDeNotas = (req, res, next)`. Usa la misma regla, `puedeCargarNotasDgmit(req.user?.rol)`; si no la cumple, 403 `{ success: false, error: 'No tenés permiso para usar el generador de notas.' }`.
  - `areasParaElGenerador(hoy)` → `[{ id, nombre, ambito, area_superior, articulo, articulo_superior, datasets: [{ id, titulo, estado, dias, proxima }] }]`.
    - Solo las áreas con algún dataset que cumple `sePuedeElegir`, y solo esos datasets.
    - El estado es el de hoy.
    - Dos consultas: áreas y datasets.
  - `areaParaElGenerador(areaId, fecha)` → `null` o el área con `datasets`. Cada dataset trae:
    ```
    { id, titulo, estado, dias, proxima, frecuencia, datos_solicitados, que_se_solicita, se_puede_pedir, notas_dgmit }
    ```
    - estado, pedido y frecuencia, calculados con la `fecha` de la nota;
    - `frecuencia` = `frecuenciaEnNota`;
    - `datos_solicitados` = `pedido(...)?.texto ?? null`;
    - `se_puede_pedir` = `sePuedePedir(estado)`;
    - `notas_dgmit` = `notasDgmitDelCicloAbierto(fuentes, fecha)`, con una sola llamada a `fuentesDe(ids del área)`;
    - en el orden de `ordenDeLaTabla`.
  - `prepararNota(cuerpo, hoy)` → `[status, { datos, bloques, nombre } | cuerpoDeError]`:
    - `validarPedidoDeNota`;
    - después, en la base: el área existe; cada dataset existe y es del área (si no, `textoDeOtraArea`), cumple `sePuedeElegir` (si no, `textoNoSePuedeElegir`) y no está al día a la fecha (si no, `textoAlDia`), todo en `datasets`;
    - por último, `construirNotaDgmit` con los datasets en `ordenDeLaTabla`.
  - Rutas, todas con `authMiddleware` y `usaGeneradorDeNotas`:
    - `GET /api/notas/areas` → `{ success, data: areasParaElGenerador(hoy) }`;
    - `GET /api/notas/areas/:id?fecha=AAAA-MM-DD` → `{ success, data }`. Sin fecha, hoy; una fecha inválida, 400 `MENSAJES_GENERADOR.fecha`; un área inexistente o un id que no es entero positivo, 404 `'Área no encontrada'`;
    - `GET /api/notas/membrete` → `{ success, data: { imagen: 'data:<mime>;base64,…' | null, pie } }`, para la hoja de la vista previa;
    - `POST /api/notas/vista-previa` → `{ success, data: { html: renderHtmlDeBloques(bloques) } }`;
    - `POST /api/notas/generar` → el `.docx`, con `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document` y `Content-Disposition: disposicionDeAdjunto(nombreDelWord(...))`.

- [ ] **Step 1: Write the failing tests** (`tests/notas-generador-api.test.js`):
  - Arranque: base propia `crearBaseDePrueba('rpad_test_generador_api')` y fixtures.
    - Un área municipal "la" con dependencia y un área externa "el".
    - Datasets: externo vencido con «Requiere nota» en Sí, externo próximo sin dato, externo al día, externo con «No», interno, eventual externo con Sí y uno de otra área.
    - Una nota DGMIT cargada por SQL en el ciclo abierto del vencido.
  - Permisos:
    - sin sesión → 401;
    - lector → 403 con `'No tenés permiso para usar el generador de notas.'`;
    - colaborador y admin → 200 en `GET /notas/areas`.
  - `GET /notas/areas`: el área externa sin el dataset con «No» ni el interno; ningún área con solo internos.
  - `GET /notas/areas/:id`:
    - el vencido trae `datos_solicitados`, `que_se_solicita` y `notas_dgmit: [{ numero, tipo, recibida }]`;
    - el al día trae `se_puede_pedir: false`;
    - con `?fecha=` 30 días después, un dataset que hoy está al día y vence dentro de ese plazo trae `se_puede_pedir: true` (Review Focus 3).
  - `POST /notas/generar` con el vencido y el próximo:
    - 200, el `Content-Type` del Word y `PK` al principio;
    - `word/document.xml` tiene `Solicito a Ud. tenga a bien gestionar ante la` y `Qué se solicita:`, y no tiene `Período:` ni `Consta de`.
  - Errores 400, con su `campo`:
    - un dataset de otra área → `datasets`, con `textoDeOtraArea`;
    - el al día → `textoAlDia`, y el mismo dataset pasa con la fecha en la que es próximo (Review Focus 3);
    - el interno → `textoNoSePuedeElegir`;
    - `tipo: 'escalonada'` → `tipo`;
    - `numero: 125` → `numero` (antes daba 500);
    - un número de 41 caracteres → `numero`;
    - `fecha: '2026-02-30'` → `fecha`.
  - Review Focus 2: `numero: '12/26/DGMIT—“x” 😀'` y `anteriores: ['97/26—a']` → 200; el XML trae los dos textos tal cual; el `Content-Disposition` empieza con `attachment; filename="Nota interna - `.
  - `POST /notas/vista-previa` → `data.html` tiene el área en `<b>` y `<table class="nota-tabla">`.
  - En `tests/permisos.test.js`: una lista `RUTAS_GENERADOR` con las cinco rutas, con el molde de `RUTAS_NOTAS_DGMIT`: lector 403 con el texto exacto, sin sesión 401 y colaborador "llega al controlador".
- [ ] **Step 2: Run** los dos archivos. Expected: FAIL.
- [ ] **Step 3: Implement.** Borrar `describe('notas DOCX')` de `tests/reportes.test.js` y su comentario en la línea 1: lo reemplaza este archivo. `API.generarNota` de `api.js` queda sin uso: `api.js` no se toca.
- [ ] **Step 4: Run** los archivos, `tests/reportes.test.js` y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: la API del generador de notas (áreas, datos de un área, vista previa y Word), solo para quien carga notas DGMIT`.

### Task 8: La página: lo puro de `notas.js`

**Files:**
- Modify: `public/js/notas.js` (se reescribe: arriba lo puro, abajo lo que toca el DOM, como `seguimiento.js`)
- Create: `tests/notas-frontend.test.js`

**Interfaces:**
- Consumes: las respuestas de la Task 7.
- Produces, como funciones o `const` del script (en el `vm`):
  - **Copias del servidor**, atadas por test de paridad: `MENSAJES_GENERADOR`, `LARGO_NUMERO_NOTA = 40` y `MENSAJE_SIN_PERMISO = 'No tenés permiso para usar el generador de notas.'`.
  - **El paso 1:**
    - `textoParaBuscar(texto)`, copia de la de `seguimiento.js`;
    - `esUrgente(dataset)`: vencido (`dias < 0`) o próximo;
    - `areasDelFiltro(areas, filtro: 'urgentes' | 'todas', busqueda)`: en "urgentes", las que tienen alguno urgente, la más vencida primero; en "todas", por nombre (`localeCompare 'es'`). La búsqueda mira el nombre del área y los títulos de sus datasets;
    - `cantidadesDeFiltros(areas)` → `{ urgentes, todas }`;
    - `textoDeInsignia({ estado, dias })` → `[clase, texto]`: `Vencido hace N días`, `Vence en N días`, `Vence hoy`, `Al día`, `Eventual` y `Sin fecha`;
    - `htmlDeFilaDeArea(area, elegida)`: un `<button class="area-opcion" data-area>`, como la maqueta.
    - `htmlDeListaDeAreas(areas, filtro, busqueda, elegida)`: las filas o, sin ninguna, el texto vacío de la spec 3.1. Sin urgentes: `Hoy ninguna área tiene datasets vencidos o próximos a vencer.`; sin coincidencias en el buscador: `Ninguna área coincide con la búsqueda.`.
  - **El paso 2:**
    - `elegidosIniciales(datasets)`: los ids de los urgentes que se pueden pedir;
    - `htmlDeDataset(dataset, elegido)`. Si no se puede pedir: fila en gris, casilla `disabled` y `Al día: todavía no hay datos para pedir.`. Si tiene notas DGMIT, la línea violeta `Notas DGMIT del ciclo: …`;
    - `htmlDeListaDeDatasets(datasets, elegidos)`: las filas y, si ninguno se puede pedir, el aviso `Hoy no hay datos para pedirle a esta área: sus datasets están al día.`;
    - `textoDelTipo(ambito, tipo)`, la pista del tipo de nota (spec 3.2): `Viene elegida porque el área figura como municipal en Áreas.` (o `fuera del municipio`) cuando coincide, y `Cambiada a mano: el área figura como municipal, que lleva nota interna.` (o su par) cuando no;
    - `numerosTraidos(datasets, elegidos)`: el `numero` de la primera nota de cada elegido, sin repetidos, ordenados por `recibida`;
    - `htmlDeNotaAnterior({ numeros, editada, traidos })`, con estas líneas:
      - `Traída de las notas DGMIT cargadas en el Seguimiento.`;
      - `Editada a mano.`, con el botón `Volver a traer las cargadas`;
      - `No hay notas DGMIT cargadas para estos datasets: escribila si la sabés.`
  - **El paso 3:** `htmlDeHoja(cuerpoHtml, { imagen, pie })`, la hoja de la vista previa: el membrete, la marca de agua `img/membrete-isotipo-aclarado.png`, el cuerpo y el pie.
  - **El pedido:**
    - `erroresDelPaso2({ elegidos, numero, anteriores })` → `{ campo: mensaje }`, con los mensajes de `MENSAJES_GENERADOR`;
    - `cuerpoDelPedido(estado)` → `{ fecha, numero, tipo, pedido, anteriores, area_id, datasets }`.
  - **La descarga:** `async function pedirWord(cuerpo)`. Hace un `fetch` POST a `${CONFIG.API_URL}/notas/generar`, con `Auth.getAuthHeaders()`, y devuelve el blob. Si falla, tira un `Error(data.error)` con `status` y `campo`. Es local porque `API.pedirArchivo` es solo GET y `api.js` no se toca.
  - **El arranque:** un `DOMContentLoaded`.
    - Sin sesión, a `login.html`.
    - Sin `Auth.puedeCargarNotasDgmit()`, muestra `MENSAJE_SIN_PERMISO` y no pide nada.
    - Con permiso, `iniciarGenerador()`.

- [ ] **Step 1: Write the failing tests** (`tests/notas-frontend.test.js`, con el arnés de `tests/seguimiento-frontend.test.js`: `cargar()` y `preparar()` con un DOM falso):
  - al cargarse solo registra `DOMContentLoaded`;
  - sin sesión, `location.href` es `'login.html'`;
  - con `puedeCargarNotasDgmit: () => false`, el mensaje está en la página y no salió ningún `pedirJson` (Review Focus 5);
  - `areasDelFiltro`: con las áreas de la maqueta (un vencido de −997, uno de −85, un próximo de 37 y un área con todos al día), "urgentes" da 3 en orden; "todas" da 4 por nombre; la búsqueda `"genero"` encuentra "Áreas específicas de género";
  - `textoDeInsignia`: `{ estado: 'sin-respuesta', dias: -85 }` → `Vencido hace 85 días`; `proximo` con 0 → `Vence hoy`; con 1 → `Vence en 1 día`;
  - `htmlDeListaDeAreas`: sin urgentes y sin coincidencias, los dos textos vacíos; `htmlDeListaDeDatasets` con todos al día, el aviso;
  - `textoDelTipo('municipal', 'interna')` y `textoDelTipo('externo', 'interna')` → los dos textos de la spec 3.2;
  - `htmlDeDataset` de uno al día lleva `disabled` y el texto de la spec; un título con `<b>` sale escapado;
  - `numerosTraidos`: con notas `88/26` (en dos elegidos) y `102/26`, → `['88/26', '102/26']`; sin elegidos, `[]`;
  - `erroresDelPaso2({ elegidos: [] })` → `{ datasets: 'Elegí al menos un dataset.' }`;
  - paridad: `MENSAJES_GENERADOR` y `LARGO_NUMERO_NOTA` contra `services/notasGeneradorReglas.js`; `MENSAJE_SIN_PERMISO` contra el middleware;
  - `pedirWord` con un 401 tira un error con `status: 401` (Review Focus 5).
- [ ] **Step 2: Run** `node --test tests/notas-frontend.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** lo puro y el arranque.
- [ ] **Step 4: Run** el archivo y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: generador de notas, lo puro de la página (filtros, insignias, datasets, nota anterior y pedido)`.

### Task 9: La página: pasos, vista previa, descarga y menú

**Files:**
- Modify: `public/notas.html`; `public/js/notas.js` (la parte del DOM); `public/js/main.js` (`updateSidebarAuth`); las 14 páginas con carcasa más `login.html`, por `VERSION`; `tests/paginas.test.js`; `tests/main-frontend.test.js`; `tests/notas-frontend.test.js`

**Interfaces:**
- Consumes: la Task 8 y las rutas de la Task 7.
- Produces:
  - **`notas.html`.** La carcasa no cambia (sigue igual a la de `index.html`).
    - El `<main>`: el `h1` "Generador de Notas" y la tarjeta con los tres pasos (`<ol>` con `aria-current="step"`).
    - Un `<div id="nt-aviso" role="status" aria-live="polite">`.
    - Los tres pasos, con el marcado y las clases de la maqueta.
    - Se van el modal "Buscar Área por Dataset", la escalonada y el período a mano.
    - El `<style>` se rehace con los tokens de `main.css` y define `.alert`, `.alert-error`, `.alert-success` y `[hidden]`.
    - Scripts: `config.js`, `auth.js?v=VERSION`, `main.js?v=VERSION`, `api.js?v=VERSION` y `notas.js?v=VERSION_NOTAS`.
  - **`notas.js`, la parte del DOM:**
    - el estado de la página;
    - los pasos (al cambiar, el foco va al título del paso);
    - en el paso 1, un clic en la fila pasa al paso 2;
    - "Cambiar el área" conserva el filtro y la búsqueda;
    - cambiar la fecha vuelve a pedir el área con `?fecha=`;
    - la vista previa se pide 300 ms después del último cambio, y de una respuesta vieja se descarta lo que no corresponde;
    - la nota anterior: "Agregar" (y Enter) suma un número, la "×" lo quita; mientras no se edite, se vuelve a completar con `numerosTraidos` cuando cambian los datasets tildados; "Volver a traer las cargadas" la repone;
    - los errores van por campo, con `aria-invalid`, `aria-describedby` y el foco al primero;
    - si falla la carga de las áreas: `No se pudieron cargar las áreas. Probá de nuevo en unos minutos.` (no una lista vacía);
    - un 401 en cualquier pedido lleva a `login.html`;
    - "Descargar Word" usa `pedirWord` y `descargarBlob`, con el nombre que manda el servidor;
    - "Armar otra nota".
  - **`main.js`:** `updateSidebarAuth` oculta `#sidebarTools a[href="notas.html"]`, con la clase `hidden`, si no se cumple `Auth.puedeCargarNotasDgmit()`. El marcado de las 14 páginas no cambia.
  - **`tests/paginas.test.js`:** `VERSION` nuevo y `['notas.html', 'notas', VERSION_NOTAS]` en el arreglo de scripts con versión.

- [ ] **Step 1: Write the failing tests:**
  - `tests/main-frontend.test.js`: con rol `lector`, el enlace a `notas.html` del menú queda `hidden`; con `colaborador` y `admin`, visible;
  - `tests/paginas.test.js`: `notas.js` con `VERSION_NOTAS` y después de `api.js`;
  - `tests/notas-frontend.test.js`, con el DOM falso: un 401 en `GET /notas/areas` lleva a `login.html` (Review Focus 5); un 500 ahí muestra `No se pudieron cargar las áreas. Probá de nuevo en unos minutos.`; un 400 con `campo: 'datasets'` marca ese campo y lleva el foco ahí; elegir un área pide `/notas/areas/<id>?fecha=<hoy>`; con la nota anterior editada a mano, tildar otro dataset no la cambia.
- [ ] **Step 2: Run** los tres archivos. Expected: FAIL.
- [ ] **Step 3: Implement.** Subir `VERSION` en todas las páginas que cargan `auth.js`, `main.js` y `api.js`.
- [ ] **Step 4: Probar en el navegador.**
  - Levantar `node app.js` desde el worktree con `PORT=3012` y la base de la rama: `preview_start` con una configuración `generador` en `.claude/launch.json` del worktree.
  - **Como colaborador:** la Secretaría de la Mujer como solicitud, y la Agencia Provincial de Seguridad Vial como externa y reiteración, con una nota anterior escrita a mano. Mirar la vista previa, cambiar la fecha, descargar el Word y abrirlo.
  - **Como lector:** el menú sin "Notas" y `notas.html` con el mensaje.
  - Ver el ancho de teléfono, recorrer todo con el teclado y mirar la consola sin errores.
  - Capturas en el ledger.
- [ ] **Step 5: Run** `npm test`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: la página del generador de notas (tres pasos, vista previa en la hoja membretada y descarga) y Notas fuera del menú del lector`.

### Task 10: La Nota Digital en Word

**Files:**
- Create: `services/notasDigitalesWord.js`, `tests/notas-digitales-word.test.js`, `tests/fixtures/notas-digitales-html/` (los HTML de prueba)
- Modify: `controllers/notasDigitalesController.js` (`descargarWord`), `routes/index.js`, `tests/permisos.test.js` (`RUTAS_SOLO_ADMIN`)

**Interfaces:**
- Consumes: `renderDocx` y `membreteParaWord` de la Task 6; los bloques de la Task 5.
- Produces:
  - **`bloquesDeNotaDigital(html)`** → `Bloque[]`. Si no encuentra el remitente, tira `Error('No se encontró el remitente de la nota.')`. Reglas, probadas sobre las 8 notas del libro y las cuatro sintéticas:
    1. Toma los hijos del `<div>` del `<body>`.
    2. Quita el primer `<p>` si tiene `color:#800000` o su texto es uno de `AVISO_ADJUNTO` ("SE ADJUNTAN NOTA Y ANEXO EN PDF" o "SE ADJUNTA NOTA EN PDF"). Las notas viejas no lo tienen.
    3. El remitente es el último `<p>` que empieza con "DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN". Se conserva.
    4. Después del remitente viene la firma, el bloque con `margin:32px 0 0`: un `<p>` es una firma (`columnas: 1`) y una `<table>` son dos (`columnas: 2`). Lo de adentro no se lee.
    5. La leyenda es el `<p>` en cursiva que viene después de la firma, y se conserva.
    6. El CC es el último `<p>`: se conserva si tiene texto y se omite si está vacío.
    7. Lo anterior al remitente se convierte así:
       - `<p>` → `parrafo`, con la alineación de `text-align` y los espacios a partir del `margin` en px × 15;
       - `<b>`, `<u>` y `font-style:italic` → negrita, subrayado y cursiva;
       - `<br>` → `salto`;
       - `font-size` de 15, 13, 12 y 11 px → `letra` de 24, 20, 18 y 16;
       - `<a>` → su texto;
       - `<table>` → `tabla`, con `anchos` de `PROPORCIONES` de `notasDigitalesPdf.js` según la cantidad de columnas (parejos si no está), la primera fila de `<th>` como encabezado y `colspan` como `abarca`;
       - `<ul><li>` → `lista`;
       - las cinco entidades de `escapeHtml`, decodificadas.
  - **`descargarWord(req, res)`.** Lee `numero`, `anio`, `es_prueba` y `html`. Si la nota no existe, 404 `'Nota no encontrada'`.
    - El nombre es `Nota-Digital-${numero}-${AA}.docx`. Una prueba es `Nota-Digital-PRUEBA-${id}.docx`, como sus PDF (la spec decía "prueba" en minúscula: se sigue al Libro).
    - Responde con `disposicionDeAdjunto`.
    - Si el conversor tira, 422 con su mensaje (Review Focus 4).
  - **La ruta:** `GET /api/notificaciones/notas-digitales/:id/word`, con `authMiddleware` y `adminOnly`, junto a `/pdf` y `/anexo`.

- [ ] **Step 1: Armar los HTML de prueba** (versionados, sin nombres reales). Se guardan en `tests/fixtures/notas-digitales-html/`:
  - **Las de hoy.** Con `construirNota` y `renderHtml` del código actual, y los datos de `ejemplo()` de `services/notasDigitales.js` con firmas "Nombre Apellido"/"Cargo":
    - `aviso-externo.html`;
    - `reiteracion-externa-dos-firmas.html`, con personal contratado y leyenda;
    - `auditoria.html`, con su `<ul>`;
    - `autorizacion.html`, con el CC vacío.
  - **La de la 1/26.** `aviso-interno-viejo.html`, escrito a mano con la forma de la nota 1/26 (13/10):
    - sin la primera línea;
    - una tabla de 6 columnas con "Última actualización" y una fila de antecedente `colspan` en cursiva;
    - la firma `<p style="margin:32px 0 0;text-align:right;">Nombre Apellido<br>Cargo</p>`, sin negrita;
    - y el CC.
- [ ] **Step 2: Write the failing tests** (`tests/notas-digitales-word.test.js`):
  - **Para cada HTML:**
    - ningún bloque tiene "Nombre Apellido" ni "Cargo" (la firma no queda);
    - hay un bloque `firma`, con dos columnas en la de dos firmas;
    - el remitente se conserva;
    - la primera línea no está.
  - **La de dos firmas:** conserva la leyenda.
  - **La autorización:** no tiene un párrafo vacío al final.
  - **Las tablas:** la vieja da 6 anchos, y una fila de grupo da `abarca`.
  - **`renderDocx`** de cada uno abre con JSZip y tiene `12240`.
  - **Un HTML sin remitente** tira.
  - **API, sobre una base propia** (con el molde de `notas-api.test.js`, cargando una nota con `crearNota` y su `html`):
    - admin → 200 Word, con `Nota-Digital-` en el `Content-Disposition`;
    - lector y colaborador → 403;
    - una nota con un HTML sin remitente → 422;
    - un id inexistente → 404.
  - **En `tests/permisos.test.js`:** la ruta, en `RUTAS_SOLO_ADMIN`.
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement.** Como no hay librería de HTML, el análisis es un recorrido chico por etiquetas: el HTML siempre sale de `renderHtml`, con un conjunto conocido de etiquetas. Probarlo además con las 8 notas reales de la base de la rama, sin versionarlas.
- [ ] **Step 5: Run** los archivos y `npm test`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: cada Nota Digital se puede bajar en Word, en la hoja membretada y sin firma`.

### Task 11: El botón "Word" del Libro

**Files:**
- Modify: `public/js/correos.js` (`filaDelLibro` y `accionDelLibro`), `public/correos.html` (`?v=` de `correos.js`), `tests/correos-frontend.test.js`, `tests/paginas.test.js` (`VERSION_CORREOS`)

**Interfaces:**
- Consumes: la ruta de la Task 10.
- Produces:
  - **`filaDelLibro(n)`:** después de "PDF" suma `<button type="button" class="co-btn" data-accion="word" data-id="${n.id}" data-archivo="${esc(archivoWord)}">Word</button>`. `archivoWord` es el nombre del PDF con `.docx`, para todas las notas.
  - **`accionDelLibro`:** `word` hace `descargarBlob(await API.pedirArchivo(\`/notificaciones/notas-digitales/${id}/word\`), boton.dataset.archivo)`, con los errores por `avisar`, como "PDF".

- [ ] **Step 1: Write the failing tests:** en `tests/correos-frontend.test.js`, actualizar los tres asserts que cuentan los botones (líneas 1012 y 1014 y el `deepEqual` de 1134, a buscar por nombre después del merge) y sumar:
  - una nota de prueba da `Nota-Digital-PRUEBA-7.docx`;
  - el clic en "Word" pide `/notificaciones/notas-digitales/7/word`.
- [ ] **Step 2: Run** `node --test tests/correos-frontend.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**; subir `?v=` de `correos.js` y `VERSION_CORREOS`.
- [ ] **Step 4: Probar en el navegador** (como admin, en Correos → Libro): bajar el Word de la 1/26 y el de la 4/26 y abrirlos. Capturas en el ledger.
- [ ] **Step 5: Run** `npm test`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: botón «Word» en el Libro de Notas Digitales`.

### Task 12: Documentación, kit de despliegue y revisión final

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `docs/superpowers/specs/2026-10-24-notas-dgmit-design.md` (una línea)

**Interfaces:**
- **CLAUDE.md:**
  - estructura: `notasController` es el generador; los servicios nuevos (`notasGeneradorReglas`, `notasGeneradorContenido`, `notasGeneradorDatos`, `notasWord` y `notasDigitalesWord`); el middleware `usaGeneradorDeNotas`;
  - la convención de `notas.js` (como `seguimiento.js`, con `?v=`): la frase de los scripts sin versión queda solo con `config.js` y `contacto.js`;
  - roles: el lector ya no tiene Notas;
  - `areas.ambito`;
  - una sección "Generador de Notas (spec 2026-10-24-generador-de-notas)", al estilo de las demás, con:
    - quién lo usa, los pasos, los bloques y las dos salidas;
    - los artículos "del" y "al";
    - el Word de las Notas Digitales;
    - las copias mínimas de `notas.js`.
- **README:**
  - roles (líneas de admin, colaborador y lector);
  - Herramientas → Notas;
  - Correos → Word;
  - Áreas → Ámbito;
  - la sección "Migración: Generador de Notas", con el orden: después de la de Métricas y antes del código;
  - el Changelog.
- **Spec de las notas DGMIT:** en "No objetivos", al final de la línea que dice que la DGMIT no usa Herramientas → Notas, va "(revertido por la spec 2026-10-24-generador-de-notas: ahora lo usa)".
- **Kit:** `Escritorio/RPAD-deploy-generador-de-notas/`, con el formato de `RPAD-deploy-notas-dgmit`:
  - `PASOS.txt`:
    - la migración después de la de Métricas y antes del código;
    - después de subir, Restart;
    - el aviso: "Si se cambió a mano el ámbito de un área, no volver a correr la migración";
  - `sql/migracion-generador-notas.sql`;
  - los archivos y el zip;
  - `vuelta-atras/` con el rollback.

- [ ] **Step 1: Write** la documentación y el kit.
- [ ] **Step 2: Run** `npm test` completo. Expected: PASS, la línea de base de la Task 1 más los tests nuevos.
- [ ] **Step 3: Commit** `docs: Generador de Notas: CLAUDE.md, README y la línea de la spec de notas DGMIT`.
- [ ] **Step 4: Revisión final de toda la rama** con Opus (superpowers:requesting-code-review), antes de ofrecerle el merge al usuario.
