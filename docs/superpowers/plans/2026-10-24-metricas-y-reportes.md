# Métricas y Reportes — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `reportes.html` pasa a ser «Métricas y Reportes».
- **Métricas:** el circuito de cada gestión en días hábiles o corridos y en mediana o promedio, la cinta, los casos (que se pueden destildar), los resultados del año, el contexto, el trabajo del RPAD, áreas y temas y «Para completar».
- **Reportes:** siete PDF con el diseño del anexo.
- **Además:** una foto que se saca sola el 10/01; «Recibido el» obligatorio, con el origen de los datos; y la edición ya no registra actualizaciones.

**Architecture:**
- **Reglas puras en dos pasos:** `casosDe(fuentes)` arma un caso por ciclo, con sus hitos, y `vistaDe(casos, opciones)` saca de los casos todo lo que se muestra. Los dos están en `services/metricasReglas.js`. La foto guarda los casos, así que un año con foto se ve con la misma `vistaDe`.
- **El resto de las reglas puras:** la cinta, en `services/metricasCinta.js`; el contexto y el trabajo del RPAD salen de las mismas fuentes del Seguimiento (`fuentesDe(null)`), sin SQL nuevo salvo las métricas manuales.
- **Los PDF:** comparten `services/reportesPdfBase.js`, que tiene el encabezado, el pie, el rótulo, la píldora, los recuadros y la tabla del anexo. Por área reutiliza la hoja del Seguimiento.
- **La página:** `public/js/reportes.js` dibuja lo que manda el servidor. Lo puro va arriba y lo que toca el DOM, al final, como `seguimiento.js`.

**Tech Stack:** Node 22 (ES modules), Express 4, mysql2/promise, PDFKit, vanilla JS, `node --test`, `tests/pdf-lector.js`.

**Spec:** `docs/superpowers/specs/2026-10-24-metricas-y-reportes-design.md`, aprobada. Manda sobre las maquetas de `docs/superpowers/specs/2026-10-24-metricas-y-reportes-mockups/`:
- `1-metricas.html` y `7-combinaciones-datos-reales.html` sirven de molde de la pestaña Métricas. La 7 tiene la cinta dibujada en JS, con las reglas de rótulos que se prueban.
- `3-reportes.html` sirve para la pestaña Reportes y el diseño de los PDF.
- `4` a `6` traen los números reales al 24/10/2026, que sirven para los tests de los casos reales.

## Global Constraints

- **Dónde se trabaja:** worktree `C:/git/rpad/.claude/worktrees/metricas-y-reportes`, rama `feat/metricas-y-reportes`, que ya tiene main con las notas DGMIT (merge 1116b9b). Nunca se escribe en `C:/git/rpad` (main) ni en su base.
- **Base de la rama:** `rpad_rama_metricas`, una copia de `datospublicos_mcr_rpad` (que tiene el dump de producción del 24/10), y el `.env` del worktree apunta a ella. Las migraciones se aplican solo ahí, porque otras sesiones corren sus tests contra la base de main.
- **No romper lo implementado.** `npm test` completo antes de empezar (la línea de base queda en el ledger) y al final de cada tarea. Cuando una tarea cambia a propósito algo que un test viejo afirmaba, el cambio del test va en esa tarea y se nombra en su paso.
- **Ningún email real.** En el `.env`, `SMTP_HOST=127.0.0.1` y `SMTP_PORT=1025` (Mailpit). Nunca llamar a `/api/cron/*`. La foto se prueba llamando al servicio con un `hoy` fijo.
- **Subagentes:** todos con Opus (implementar, revisar y corregir), por pedido del usuario.
- **Commits:** uno por tarea, en español, terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **SQL** siempre parametrizado. Respuestas `{ success: true, data }` o `{ success: false, error }`.
- **Migraciones aditivas:** van antes del código, sin `DELIMITER`, `USE`, `DROP`, `RENAME` ni `CHECK`, se pueden repetir y tienen su rollback.
- **Fechas:** texto `'AAAA-MM-DD'`. Hoy es `hoyArgentina()`. Las reglas reciben `hoy` o `al` por parámetro y no usan `Date` local.
- **Días hábiles:** `diasHabilesTranscurridos(desde, hasta)`, que no cuenta el día de inicio y sí el de fin. **Días corridos:** `diasEntre(desde, hasta)`. Los dos con piso 0. Los feriados móviles no se suman.
- **Sin nombres de personas** en archivos versionados. Los tests usan `tests/seguimiento-casos.js`, ya anonimizado, y fixtures nuevos con nombres inventados.
- **Frontend:**
  - todo script va como `<script src="js/X.js?v=…"></script>`, sin atributos;
  - si cambia `api.js`, sube `VERSION` en todas las páginas y en `tests/paginas.test.js`;
  - los scripts que cambian suben su `?v=`;
  - todo texto dinámico pasa por `Utils.escapeHtml`, y un 0 se escribe con `String(n)`, no con `escapeHtml(n)`, que devuelve vacío.
- **Textos exactos** (de la spec):
  - Página: `Métricas y Reportes`, en el título, el `h1` y el link del menú de las 14 páginas. Pestañas: `Métricas`, `Reportes`.
  - Bajada: `Cuánto tarda cada paso del circuito, desde el aviso del RPAD hasta la carga en el portal, y los reportes en PDF.`, más `Los días son hábiles: de lunes a viernes, sin los feriados nacionales fijos.` o `Los días son corridos: todos los días del calendario.`.
  - Selectores: `Mediana` | `Promedio`; `Días hábiles` | `Días corridos`; `Gestión externa` | `Gestión interna`.
  - Tramos:
    - nombres: `Aviso anticipado`, `Trámite y entrega de la nota`, `Respuesta del área`, `Producción del relevamiento`, `Preparación y carga`;
    - texto de la flecha: `Del aviso al vencimiento`, `Del aviso a la nota en el área`, `De la nota a la entrega`, `Del aviso a la entrega`, `De la entrega a la carga`.
  - Nodos: `RPAD`/`Datos Públicos avisa` · `DGMIT y Dirección Administrativa`/`Mandan la nota formal` · `DGMIT y Dirección de Investigación Territorial`/`Hacen el relevamiento` · `Área responsable`/`Prepara los datos` · `Datos Públicos`/`Limpia y estructura` · `Portal`/`Datos publicados`.
  - Cifra:
    - con valor, `27` + `días hábiles`, y debajo `mediana de 32 ciclos` (o `promedio de …`);
    - con 0, `En el día`, y debajo `mediana en días hábiles`; los ciclos van en el texto de la flecha;
    - singular: `1 día hábil`, `1 día corrido`;
    - sin casos: `Sin casos en 2026`;
    - con 4 casos o menos, además: `con tan pocos casos, es orientativo`.
  - Sin notas DGMIT:
    - tramo de la DGMIT: `Todavía no hay notas DGMIT cargadas` y `N notas pendientes de carga`;
    - tramo del área: `Sin datos todavía` y `Se empieza a contar cuando haya notas DGMIT cargadas`;
    - cinta: `La cinta se completa cuando haya notas DGMIT cargadas`.
  - En curso: `N sin datos registrados todavía, hace X (mediana)`. Aclaración: `Se cuenta hasta que se registra la actualización.`.
  - Aclaraciones:
    - `N ciclos se avisaron cuando ya estaban vencidos (vencieron antes de que existiera el aviso): no cuentan en el aviso anticipado, y el resto de sus tramos se cuenta desde ese primer aviso.`
    - `N ciclos se resolvieron con datos de una fuente pública: no cuentan en la respuesta del área.`
  - Pie del circuito: `Con «Mediana», el número grande es el del medio: en la mitad de los casos, ese número o menos. Con «Promedio» o «Días corridos», cada cifra lo dice debajo.`
  - Destildado:
    - franja: `Calculado sin N datasets: A, B.` (`sin 1 dataset`), con el link `Volver a todos`;
    - píldora del PDF: `Mediana en días hábiles · con todos los datasets` o `… · calculado sin 1 dataset: Parque Automotor`.
  - Foto: `La foto de 2026 se saca el 10/01/2027`.
  - Registro:
    - mensajes: `Indicá cuándo se recibieron los datos.` · `Indicá quién entregó los datos.` · `Para registrar una actualización, usá «Registrar actualización».`
    - opciones: `Los entregó el área` | `Los obtuvo Datos Públicos de una fuente pública`;
    - rótulo de la fecha: `Recibido el` u `Obtenido el`.
  - Comparaciones y movimientos: `Origen de los datos`, con el valor `Los entregó el área` o `Fuente pública`.
- **Tono:** en Métricas nunca `tardanza`, `demora`, `atraso`, `sin respuesta` ni `sin entregar`. La DGMIT sin nota es «pendiente de carga», sin días.
- **Colores:** los del Seguimiento (`--sg-*`). La DGMIT va en violeta `#5B4691`, el Portal en verde `#2E6B4C` y los vencidos en el ámbar del rayado.

## Review Focus

1. **Un año o un filtro sin ningún caso,** por ejemplo destildando todo o con `?anio=2026` y la base vacía. Todas las cifras dicen `Sin casos en 2026`, nada dice `NaN`, `null` ni `undefined`, no hay divisiones por cero, la cinta no se dibuja y el índice, sin base, queda vacío. → Tasks 7, 8, 9, 11 y 12.
2. **Parámetros raros en la URL:** `?anio=abc&sin=x,1e3,-2&estadistico=foo&dias=bar&gestion=z`. Se usan los valores por defecto y lo que no sirve se ignora, siempre con 200 y nunca con 500. Un año sin datos ni foto da 404 en JSON. → Task 11.
3. **Fechas al revés:** «Recibido el» antes del aviso, una nota DGMIT antes del aviso, la carga el mismo día que la recepción. Todo da 0 (piso), nunca negativo, y el 0 se escribe `En el día`. → Tasks 6 y 7.
4. **La foto:** la corrida del 10/01, una segunda corrida del mismo día, una corrida del 09/01 o del 15/06 con la foto ya sacada, y un error al guardarla. Se saca una sola vez, nunca antes del 10/01, y un error no frena las notas y queda en la última corrida. → Task 10.
5. **Datasets dados de baja en el año:**
   - sus ciclos cuentan hasta la baja;
   - no entran en el índice después de la baja ni en las hojas de Por área;
   - se pueden destildar igual.
   → Tasks 7, 8 y 16.

---

### Task 1: Base de la rama, migración y schema

**Files:**
- Create: `database/updates/migracion-metricas.sql`, `database/updates/rollback-metricas.sql`
- Modify: `database/schema.sql` (dos tablas al final), `tests/schema.test.js`
- Modify (sin versionar): `.env` del worktree, con `DB_NAME=rpad_rama_metricas`

**Interfaces:**
- Produces (DDL, con el estilo de `schema.sql`):
  ```sql
  CREATE TABLE IF NOT EXISTS metricas_fotos (
    anio smallint NOT NULL,            -- el año de la foto
    al date NOT NULL,                  -- siempre AAAA-12-31
    datos longtext NOT NULL,           -- JSON: { version, casos, contexto, trabajo, areas, generada }
    created_at timestamp NULL DEFAULT current_timestamp(),
    PRIMARY KEY (anio)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  CREATE TABLE IF NOT EXISTS actualizaciones_recibido (
    cambio_id int(11) NOT NULL,
    recibido_el date DEFAULT NULL,
    origen_datos enum('area','fuente_publica') DEFAULT NULL,
    created_at timestamp NULL DEFAULT current_timestamp(),
    PRIMARY KEY (cambio_id),
    CONSTRAINT fk_actualizaciones_recibido_cambio FOREIGN KEY (cambio_id) REFERENCES cambios_pendientes (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```
- El rollback borra las dos tablas (se pierden la foto y lo importado) y lo dice en su cabecera.

- [ ] **Step 1: Preparar la base de la rama.** Crear `rpad_rama_metricas` como copia de `datospublicos_mcr_rpad` (con `mysqldump` adentro del contenedor `rpad-db`) y apuntar el `.env` del worktree a ella. No tocar `datospublicos_mcr_rpad`. Correr `npm test` y anotar la línea de base en el ledger.
- [ ] **Step 2: Write the failing tests** (`tests/schema.test.js`):
  - un `describe('migracion-metricas.sql')` con el molde de las migraciones de notas DGMIT: sin palabras prohibidas, la cabecera con la ruta de la spec, «desde la estructura de main deja la de schema.sql y se puede repetir» (la corre dos veces) y «el rollback deja la estructura anterior»;
  - las dos tablas nuevas en el loop «no trae datos en».
- [ ] **Step 3: Run** `node --test tests/schema.test.js`. Expected: FAIL (no existe la migración).
- [ ] **Step 4: Implement** la migración, el rollback y las tablas en `schema.sql`. Cabeceras como las de `migracion-notas-dgmit.sql`:
  - «Solo agrega»;
  - «ORDEN: correr ANTES de subir el código»;
  - «Se puede volver a correr»;
  - «Para deshacer: rollback-metricas.sql».
- [ ] **Step 5: Aplicar** la migración en `rpad_rama_metricas` (la línea 80 de schema.test.js compara contra la base del `.env`). Run `node --test tests/schema.test.js` y `npm test`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: tablas de la foto anual y de los «Recibido el» importados (migración y rollback)`.

### Task 2: Reglas puras del registro

**Files:**
- Create: `services/registroReglas.js`, `tests/registro-reglas.test.js`

**Interfaces:**
- Produces:
  - `ORIGENES_DATOS = Object.freeze(['area', 'fuente_publica'])`
  - `OPCIONES_ORIGEN = Object.freeze({ area: 'Los entregó el área', fuente_publica: 'Los obtuvo Datos Públicos de una fuente pública' })` (el modal)
  - `TEXTO_ORIGEN = Object.freeze({ area: 'Los entregó el área', fuente_publica: 'Fuente pública' })` (las comparaciones y los movimientos)
  - `MENSAJE_FALTA_RECIBIDO = 'Indicá cuándo se recibieron los datos.'`
  - `MENSAJE_FALTA_ORIGEN = 'Indicá quién entregó los datos.'`
  - `MENSAJE_EDICION_REGISTRA = 'Para registrar una actualización, usá «Registrar actualización».'`
  - `normalizarOrigen(valor) → 'area' | 'fuente_publica' | null`: null, undefined y `''` dan null; cualquier otro valor tira `TypeError`, como `normalizarRequiereNota`.
  - `origenSugerido({ tipo_gestion, requiere_nota }) → 'fuente_publica' | null`: solo un externo con `requiere_nota === 0`; el 0 se compara con `===`.
  - `rotuloDeLaFecha(origen) → 'Obtenido el' | 'Recibido el'`
  - `textoOrigen(valor, sinDato = '—') → string`: nunca tira.

- [ ] **Step 1: Write the failing tests:**
  - `normalizarOrigen`: `'area'`→`'area'`; `''`→`null`; `'otro'` tira `TypeError`.
  - `origenSugerido`:
    - `{ tipo_gestion: 'externa', requiere_nota: 0 }`→`'fuente_publica'`;
    - con `requiere_nota: null`→`null`;
    - `{ tipo_gestion: 'interna', requiere_nota: 0 }`→`null`.
  - `rotuloDeLaFecha('fuente_publica')`→`'Obtenido el'`; `rotuloDeLaFecha(null)`→`'Recibido el'`.
  - `textoOrigen('x')`→`'—'`; `textoOrigen(null, 'Sin dato')`→`'Sin dato'`.
- [ ] **Step 2: Run** `node --test tests/registro-reglas.test.js`. Expected: FAIL (no existe el módulo).
- [ ] **Step 3: Implement** según Interfaces.
- [ ] **Step 4: Run** el archivo. Expected: PASS.
- [ ] **Step 5: Commit** `feat: reglas puras del registro (origen de los datos y mensajes)`.

### Task 3: «Recibido el» obligatorio, origen y edición (servidor)

**Files:**
- Modify: `controllers/datasetController.js` (`errorDelRegistro` :223-236, `registrarActualizacion` :917-997, `updateDataset` :587-769)
- Modify: `controllers/cambiosPendientesController.js` (`enriquecerDatos` :31-70, `calcularCambios` :81-148)
- Test: `tests/fechas-escritura.test.js`, `tests/doble-verificacion.test.js`, `tests/cambios-listas-api.test.js` y `tests/requiere-nota-api.test.js`, más los casos nuevos en `tests/fechas-escritura.test.js`.

**Interfaces:**
- Consumes: Task 2.
- `registrarActualizacion`:
  - Lee `origen_datos` del body.
  - `errorDelRegistro` suma `{ recibido, origen, gestion }`. El orden de los errores es: falta datos al → carga → `MENSAJE_FALTA_RECIBIDO` → recibido posterior a hoy o a la carga (los mensajes de hoy) → en externa, `MENSAJE_FALTA_ORIGEN` → próxima.
  - `normalizarOrigen` inválido da 400 con `'El origen de los datos no es válido.'`.
  - En interna, el origen se guarda null aunque llegue.
  - `datosNuevos` suma `origen_datos`.
- `updateDataset`: justo después del bloque de fechas (:696), `if (cambia('ultima_actualizacion') && cambia('proxima_actualizacion')) return responderInvalido(res, MENSAJE_EDICION_REGISTRA)`.
- `enriquecerDatos` suma `origen_datos_texto` si viene la clave, con `textoOrigen`. `calcularCambios` suma, después de `recibido_el`, `{ key: 'origen_datos_texto', label: 'Origen de los datos', keyAntes: 'origen_datos', keyDespues: 'origen_datos' }`, y la condición :114 incluye la clave nueva.
- `aprobarCambio` **no cambia**: el origen viaja en `datos_nuevos` y el historial sigue igual. Un cambio pendiente viejo, sin `recibido_el` ni `origen_datos`, se aprueba como siempre.
- La nota de auditoría (`CAMPOS_DEL_REGISTRO`) no cambia: no está en la spec.

- [ ] **Step 1: Write the failing tests** (`fechas-escritura`):
  - `'registrar sin recibido_el da 400 con «Indicá cuándo se recibieron los datos.»'`;
  - `'registrar un externo sin origen da 400 con «Indicá quién entregó los datos.»; un interno sin origen, no'`;
  - `'registrar con origen_datos «otro» da 400'`;
  - `'el origen viaja en datos_nuevos y en interna queda null aunque llegue'`;
  - `'un cambio pendiente creado sin recibido_el ni origen se aprueba y escribe el historial'`: lo inserta por SQL, con el JSON viejo;
  - `'editar cambiando a la vez la carga y la próxima da 400 con el mensaje de la edición; cambiando una sola, no'`;
  - `'la comparación muestra «Origen de los datos: Fuente pública»'`.
- [ ] **Step 2: Run** `node --test tests/fechas-escritura.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** según Interfaces.
- [ ] **Step 4: Adaptar los tests viejos que registran sin el dato** (cambio a propósito, por la spec):
  - `registroValido()` (fechas-escritura :89-91) suma `recibido_el` y `origen_datos: 'area'`;
  - doble-verificacion :159-160 suma `recibido_el`;
  - los `deepEqual` de `campos_modificados` (cambios-listas-api :175-191, requiere-nota-api :274) suman la fila nueva solo donde viene el origen.
- [ ] **Step 5: Run** los cuatro archivos y `npm test`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: «Recibido el» obligatorio, el origen de los datos y la edición que no registra actualizaciones`.

### Task 4: La administración y Mi Perfil

**Files:**
- Modify: `public/admin.html` (modal :750-827 y formulario :600-647), `public/js/admin.js` (`formularioDelRegistro` :1570, `abrirRegistro` :1451, `mostrarProblemas` :1131, `enfocarElPrimerProblema` :1145, `enviarFormulario` :1167), `public/js/admin-fechas.js` (`problemaDeFechasDelRegistro` :540, `cuerpoDelRegistro` :587, `problemasDelFormulario` :965), `public/js/perfil.js` (`ETIQUETAS_DE_CAMPO` :841)
- Modify: `tests/paginas.test.js` (versiones de `admin.js`, `admin-fechas.js` y `perfil.js`)
- Test: `tests/admin-frontend.test.js`, `tests/perfil-frontend.test.js`

**Interfaces:**
- Consumes: Task 2 (paridad).
- `admin-fechas.js` suma copias atadas por test de paridad: `MENSAJE_FALTA_RECIBIDO`, `MENSAJE_FALTA_ORIGEN`, `MENSAJE_EDICION_REGISTRA`, `OPCIONES_ORIGEN` y `origenSugeridoDe({ tipo_gestion, requiere_nota })`.
- `problemaDeFechasDelRegistro({ recibido, cargado, hoy, gestion, origen })` devuelve `{ campo: 'recibido' | 'cargado' | 'origen', mensaje } | null`, con el mismo orden que el servidor.
- `cuerpoDelRegistro(f)` suma `origen_datos` (null en interna).
- `problemasDelFormulario` suma `edicion: MENSAJE_EDICION_REGISTRA | null` cuando, contra `f.original`, cambian la carga y la próxima.
- Modal:
  - `Recibido el` deja de decir «(opcional)» y lleva `required`;
  - en externa aparece el select `#registrar-origen` («¿Quién entregó los datos?»), que viene con `origenSugeridoDe(dataset)`;
  - el rótulo de la fecha cambia con el origen (`rotuloDeLaFechaDe`, copia de `rotuloDeLaFecha`).
- Mi Perfil: `ETIQUETAS_DE_CAMPO['Origen de los datos'] = 'Origen de los datos'`.

- [ ] **Step 1: Write the failing tests:**
  - paridad de los cinco nombres de arriba con `services/registroReglas.js`;
  - `'problemaDeFechasDelRegistro sin recibido devuelve el campo recibido con el mensaje'`;
  - `'en externa sin origen devuelve el campo origen'`;
  - `'cuerpoDelRegistro lleva origen_datos y en interna null'`;
  - `'problemasDelFormulario marca la edición que mueve carga y próxima'`;
  - el regex del HTML: `Recibido el` sin «(opcional)», y el select de origen presente.
- [ ] **Step 2: Run** `node --test tests/admin-frontend.test.js tests/perfil-frontend.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** Adaptar los `deepEqual` de los cuerpos (:1535, :1582), el de `problemasDelFormulario` (:2465) y el regex «Recibido el \(opcional\)» (:1797): son los cambios a propósito.
- [ ] **Step 4: Run** los dos archivos, `tests/paginas.test.js` y `npm test`. Expected: PASS.
- [ ] **Step 5: Verificar en el navegador:** `preview_start` con `rpad` sobre la base de la rama. Registrar una actualización de un externo con «Requiere nota: No»: el origen viene en «Fuente pública» y el rótulo dice «Obtenido el». Editar y mover la carga y la próxima: aparece el aviso.
- [ ] **Step 6: Commit** `feat: el modal pide «Recibido el» y el origen, y el formulario avisa que la edición no registra actualizaciones`.

### Task 5: Las fuentes: lo importado, el tema y el origen en el Seguimiento

**Files:**
- Modify: `services/seguimientoDatos.js` (`fuentesDe` :140, `aDataset` :63, `aCambio` :51)
- Modify: `services/seguimientoReglas.js` (`CAMPOS` :126-144: una fila nueva; exportar `notasDgmitPorCiclo`, y `notaDgmitDelCiclo` pasa a usarla)
- Test: `tests/seguimiento-datos.test.js`, `tests/seguimiento-reglas.test.js`

**Interfaces:**
- Produces:
  - `importadosDe(cambioIds) → Promise<Map<cambio_id, { recibido_el, origen_datos }>>`. Es una consulta aislada con `try/catch`: si falla, `console.error('No se pudieron leer los «Recibido el» importados:', e)` y un Map vacío. Así nunca frena el anexo de la reiteración.
  - `aCambio`: si hay importado y `nuevos` no trae la clave, `nuevos` suma `recibido_el` y `origen_datos` (solo las claves no null).
  - `aDataset` suma `tema_principal` (nombre o null), con un JOIN a `temas`.
  - `notasDgmitPorCiclo(fuentes, ciclos, hoy) → Array<Array<nota>>`: para cada ciclo, sus notas vigentes, por `recibida` y después `id`. La regla de asignación es la de hoy, incluida R7. `notaDgmitDelCiclo` devuelve la última del último ciclo, igual que hoy.
  - `CAMPOS` suma `{ campo: 'origen_datos', rotulo: 'Origen de los datos', tipo: 'texto', ... }`, con `textoOrigen` para el valor.

- [ ] **Step 1: Write the failing tests:**
  - `'fuentesDe suma a un cambio viejo el recibido y el origen importados'`;
  - `'si la tabla de importados no existe, fuentesDe sale igual'` (con `RENAME` en la base de prueba, como en notas DGMIT);
  - `'el dataset trae tema_principal'`;
  - `'notasDgmitPorCiclo pone cada nota en el ciclo de notaDgmitDelCiclo'`, sobre los casos con notas DGMIT de `seguimiento-reglas.test.js` (:1611);
  - `'el movimiento de una actualización con origen dice «Origen de los datos: Fuente pública»'`.
- [ ] **Step 2: Run** los dos archivos. Expected: FAIL.
- [ ] **Step 3: Implement.** Los tests del Seguimiento que ya existen no se tocan y tienen que seguir pasando.
- [ ] **Step 4: Run** los dos archivos, `tests/notas-motor.test.js` y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: los «Recibido el» importados, el tema y el origen en las fuentes del Seguimiento`.

### Task 6: Reglas de métricas I: duraciones, cifras y casos

**Files:**
- Create: `services/metricasReglas.js`, `tests/metricas-reglas.test.js`, `tests/metricas-casos.js` (fixtures: los de `seguimiento-casos.js` más lo necesario, anonimizados)

**Interfaces:**
- Consumes: `ciclosDe`, `cicloDelAviso`, `notasDgmitPorCiclo`, `QUE_PEDIA` (seguimientoReglas); `diasHabilesTranscurridos`, `diasEntre`, `sumarDias` (calendario).
- Produces:
  - `ESTADISTICOS = ['mediana', 'promedio']`, `DIAS = ['habiles', 'corridos']`, `VENTANA_DE_LA_REGLA = { externa: 40, interna: 60 }`, `INICIO_DEL_REGISTRO = '2025-12-06'`.
  - `duracion(desde, hasta, dias) → number`, con piso 0.
  - `cifraDe(valores: number[]) → { n, mediana, promedio }`: redondeados; con un n par, la mediana es el promedio de las dos del medio, redondeado; con `n = 0`, los dos null.
  - `unidadDe(valor, dias) → 'día hábil' | 'días hábiles' | 'día corrido' | 'días corridos'`.
  - `casosDe(fuentesPorDataset: Map, { hoy }) → Caso[]`, un caso por ciclo con `venc` de cada dataset (también los dados de baja; nunca los eventuales ni los sin fecha):
    ```
    Caso = { dataset_id, titulo, area, gestion, requiere_nota, activo, tema,
      venc, inicio, cierre, como, abierto, aprobado,      // de ciclosDe (aprobado = ciclo.hasta)
      aviso_regla, primer_aviso, heredado, inicio_tramos, fecha_regla, pudo_avisar, motivo_sin_aviso,
      nota_dgmit: { numero, tipo, recibida } | null, reiteraciones_dgmit,
      recibido, origen, carga, cambio_id,
      avisos_rpad: ['AAAA-MM-DD'...], reiteraciones_rpad }
    ```
- Reglas (sección 1.2 de la spec):
  - **El aviso de la regla** es el primer email con `success` de tipo `externo-40` o `interno-60`, o una Nota Digital `aviso` con `seccion = 'proximo'` asignada al ciclo, con fecha ≤ `venc`.
  - **`fecha_regla`:** `sumarDias(venc, -40|-60)`. `pudo_avisar` es `fecha_regla >= INICIO_DEL_REGISTRO` y `fecha_regla >= alta`.
  - **Heredado:** sin aviso de la regla, con un primer aviso posterior al `venc` y `!pudo_avisar`. En ese caso `inicio_tramos` es el primer aviso; si no, el aviso de la regla o null.
  - **`motivo_sin_aviso`**, solo si `pudo_avisar` y no hubo aviso de la regla: `'email-fallido'` si hay un email de la regla sin `success`; `'alta-cercana'` si el alta es posterior a `fecha_regla`; si no, `'sin-aviso'`.
  - **El cambio que cerró un ciclo:** el `editar` aprobado con `revisado === ciclo.hasta`. De él salen `recibido` (`nuevos.recibido_el`), `origen` (`nuevos.origen_datos`, null en interna) y `cambio_id`. `carga` es `ciclo.cierre` si `como === 'actualizacion'`.
  - **La nota DGMIT:** la primera de `notasDgmitPorCiclo` del ciclo. `reiteraciones_dgmit` cuenta las de tipo reiteración.
  - **Los avisos del RPAD:** las fechas de los emails a la DGMIT con `success` (los de `QUE_PEDIA`) y de las Notas Digitales enviadas del ciclo. `reiteraciones_rpad` cuenta los posteriores a `inicio_tramos`.

- [ ] **Step 1: Write the failing tests** (sobre `metricas-casos.js`, con los nombres de la spec, sección 7):
  - `'duracion: hábiles sin contar el inicio, corridos con diasEntre, y piso 0'`;
  - `'cifraDe: [1,2,3,10] → mediana 3 (2,5 redondeado), promedio 4; [] → nulls'`;
  - `'unidadDe: 1 → «1 día hábil»; 2 → «días hábiles»; corridos igual'`;
  - `'un ciclo externo completo: aviso de 40, nota DGMIT, recibido, carga'`;
  - `'un ciclo avisado ya vencido es heredado y empieza en su primer aviso'`;
  - `'sin el email de 40 porque falló: no es heredado y el motivo es email-fallido'`;
  - `'la nota DGMIT anulada no cuenta'`;
  - `'un cierre por reprogramación no tiene recibido ni carga'`;
  - `'la actualización simple de diciembre de 2025 deja venc null en su ciclo'`;
  - `'un dataset dado de baja tiene ciclos hasta la baja'`;
  - `'con los casos reales al 24/10/2026, el externo 52 (31/01/2026) da aviso 22/12/2025, recibido y carga 04/02/2026, origen área'`. Lo importado se simula en las fuentes.
- [ ] **Step 2: Run** `node --test tests/metricas-reglas.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** según Interfaces.
- [ ] **Step 4: Run** el archivo. Expected: PASS.
- [ ] **Step 5: Commit** `feat: reglas de métricas: duraciones, cifras y casos por ciclo`.

### Task 7: Reglas de métricas II: la vista

**Files:**
- Modify: `services/metricasReglas.js`, `tests/metricas-reglas.test.js`

**Interfaces:**
- Produces: `vistaDe(casos, { anio, al, estadistico, dias, sin = [] }) → Vista`.
  - **`al`** es hoy para el año en curso y `AAAA-12-31` para un año cerrado.
  - **Un tramo terminó en el año** si su hito final cae entre el 1/1 y `al`. **Está en curso** si su inicio es ≤ `al` y su fin es > `al` o null, en un ciclo abierto a esa fecha.
  - **Los tramos y su hito final:**
    - aviso: el `venc` en el año;
    - trámite: `nota_dgmit.recibida`;
    - respuesta y producción: `recibido`;
    - carga: la `carga`.
  - **`sin`:** los `dataset_id` que no cuentan.
  ```
  Vista = {
    circuito: { externa: Tramo[4], interna: Tramo[3],
      aclaraciones: { externa: { ya_vencidos, fuente_publica }, interna: { ya_vencidos } } },
    resultados: {
      a_tiempo: { a_tiempo, total, externa: [a, t], interna: [a, t], despues: { valor, texto } },
      cobertura: { si, total, faltan: [{ titulo, venc, motivo }] },
      reiteraciones: { rpad: { ninguna, una, dos_o_mas, total }, dgmit: { ninguna, una_o_mas, total } | null } },
    casos: FilaDeCaso[],          // los de la gestión con aviso o carga en el año, ordenados por vencimiento
    para_completar: { notas: [{ dataset_id, titulo, area, abierto, aviso, que }], recibido: [{ dataset_id, titulo, gestion, carga, falta: 'recibido' | 'origen' }] } }
  Tramo = { clave, nombre, desde_hasta, responsable, dgmit: boolean,
    cifra: { valor, texto, unidad, debajo, ciclos, orientativo } | null,
    vacio: { titulo, texto } | null,
    en_curso: { n, valor, texto } | null,
    pendientes: number | null }
  ```
- Reglas (secciones 1.3 y 1.4 de la spec):
  - Los tramos de la DGMIT y del área son solo para externos con `requiere_nota !== 0`, salvo que el ciclo tenga una nota DGMIT.
  - El origen `fuente_publica` no cuenta en la respuesta del área y suma en `aclaraciones.externa.fuente_publica`.
  - **Sin ninguna nota DGMIT vigente en todos los casos:**
    - la DGMIT lleva `vacio = { titulo: 'Todavía no hay notas DGMIT cargadas', texto: 'N notas pendientes de carga' }`;
    - el área lleva `vacio = { titulo: 'Sin datos todavía', texto: 'Se empieza a contar cuando haya notas DGMIT cargadas' }`.
  - **`pendientes`:** los ciclos abiertos de externos con nota requerida, con algún aviso y sin nota DGMIT. Se cuentan sin días.
  - **La carga** nunca tiene `en_curso`.
  - **`cifra.texto`:** `'En el día'` si el valor es 0, y si no `String(valor)`.
  - **`cifra.debajo`:** `'mediana de 32 ciclos'`, o `'mediana en días hábiles'` si el valor es 0. `orientativo` si `n <= 4`. Sin casos, `cifra = null` y `vacio = { titulo: 'Sin casos en 2026', texto: '' }`.
  - **«Actualizados a tiempo»:** los ciclos cerrados por actualización con la carga en el año y `venc` no null; a tiempo si `carga <= venc`.
  - **«Cobertura»:** los ciclos con `venc` en el año, `pudo_avisar` y `fecha_regla <= al`.
  - **«Para completar»:**
    - notas: los ciclos abiertos que tienen aviso y no tienen nota, más los cerrados en el año con origen `area` o null y sin nota;
    - recibido: las actualizaciones del año sin `recibido`, o externas sin `origen`.

- [ ] **Step 1: Write the failing tests:**
  - `'sin notas DGMIT, la DGMIT y el área van vacías y la DGMIT cuenta los pendientes sin días'`;
  - `'con una nota DGMIT, el trámite cuenta desde el aviso y la respuesta desde la nota'`;
  - `'la nota antes del aviso da 0 y se escribe «En el día»'`;
  - `'fuente pública: no cuenta en la respuesta y suma en la aclaración'`;
  - `'requiere nota No: solo aviso y carga'`;
  - `'la carga nunca está en curso; la producción en curso cuenta hasta al'`;
  - `'destildar saca al dataset de todos los números'`;
  - `'estadístico y días cambian cifra, unidad y debajo; 1 da singular'`;
  - `'con 4 casos, orientativo; con 0, «Sin casos en 2026» y nada null en los textos'` (Review Focus 1);
  - `'un tramo que termina después de al está en curso al 31/12'`;
  - `'con los casos reales al 24/10/2026: aviso externo 27 (mediana, hábiles) y 40 (corridos), 32 ciclos; carga «En el día», 23; a tiempo 5 de 33; cobertura 34 de 35; reiteraciones del RPAD 5/3/39; 10 notas pendientes en ciclos abiertos'`. Son los números de la maqueta 7.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** el archivo. Expected: PASS.
- [ ] **Step 5: Commit** `feat: reglas de métricas: el circuito, los resultados, los casos y «Para completar»`.

### Task 8: Reglas de métricas III: contexto, trabajo, áreas y temas

**Files:**
- Modify: `services/metricasReglas.js`, `tests/metricas-reglas.test.js`

**Interfaces:**
- Consumes: `ciclosDe`, `estadoDelDataset`, `tasaDeActualizacion` (fechasDatasetReglas), `casosDe`.
- Produces:
  - `indiceMesAMes(fuentesPorDataset, { anio, al, sin }) → [{ dia, tasa, al_dia, base }]`:
    - un punto por el **primer día de cada mes** del año hasta `al`, y el último punto es `al`;
    - un dataset entra si ya existía, seguía activo y no es eventual;
    - si no tiene ciclos (sin fecha), está en la base pero no al día;
    - está al día si el ciclo que regía ese día vence ese día o después;
    - los meses en los que no se sabe el estado de más del 10 % de la base (ciclo con `venc` null) quedan `{ tasa: null }`.
  - `antiguedadDeVencidos(fuentesPorDataset, { anio, al, sin }) → { total, menos_de_3_meses, de_3_a_12, mas_de_un_anio, al_inicio: { total, actualizados } }`. Los grupos van por días corridos: menos de 90, de 90 a 365 y más de 365.
  - `trabajoDelAnio(fuentesPorDataset, casos, { anio, al, sin, estadistico }) → { avisos, actualizaciones, auditados, nuevos, fuente_publica, por_mes: { avisos: number[12], actualizaciones: number[12], auditados: number[12] }, auditoria: { valor, texto, n } }`:
    - los avisos son ids únicos de emails a la DGMIT con `success` más Notas Digitales `aviso`/`reiteracion` enviadas, de los datasets que cuentan;
    - los auditados son ids únicos de cambios revisados en el año;
    - `fuente_publica` cuenta los ciclos del año con origen `fuente_publica` y `requiere_nota !== 0`;
    - `auditoria.texto` es `'mediana de 3 minutos'` o `'promedio de 9 horas'`: minutos si el valor es menos de 120, si no horas redondeadas.
  - `areasYTemas(fuentesPorDataset, { al, sin }) → { ranking: [{ area, total, al_dia, porcentaje }], temas: [[nombre, n]], frecuencias: [[nombre, n]] }`. El ranking usa la misma regla que `cumplimientoDeGestion`, con el null al final.

- [ ] **Step 1: Write the failing tests:**
  - `'el punto de hoy del índice es igual a tasaDeActualizacion con los mismos datasets'` (paridad);
  - `'el índice se toma el primer día de cada mes: un vencimiento del 31/01 aparece en el punto del 1/2'`;
  - `'un dataset dado de baja no cuenta después de la baja'` (Review Focus 5);
  - `'antigüedad: 89, 90 y 366 días caen en los tres grupos'`;
  - `'trabajo: un email con tres datasets cuenta una vez y no cuenta si se destildan los tres'`;
  - `'auditoría en minutos y en horas'`;
  - `'con los casos reales al 24/10/2026: índice 81, 50, 56, 66, 74, 79, 82, 77, 77, 77 y 82 de hoy'`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: reglas de métricas: índice mes a mes, antigüedad de los vencidos, trabajo del RPAD y áreas`.

### Task 9: La cinta de métricas

**Files:**
- Create: `services/metricasCinta.js`, `tests/metricas-cinta.test.js`

**Interfaces:**
- Consumes: `Tramo[]` de `vistaDe` (Task 7).
- Produces: `cintaDeMetricas(tramos, { gestion, dias, estadistico }) → Cinta | null`. Devuelve null si el aviso anticipado no tiene cifra.
  ```
  Cinta = { ancho: 1000, alto: 156,
    ticks: [{ x, texto }],          // paso de 5, 10, 20, 30, 50 o 100, como mucho 8 marcas
    banda: { x0, x1 },              // del aviso al vencimiento (celeste)
    rayado: { x0, x1 } | null,      // del vencimiento a la carga, si la carga es posterior
    gris: { x0, x1, texto } | null, // la cadena se corta: «La cinta se completa cuando haya notas DGMIT cargadas»
    vencimiento: { x },
    segmentos: [{ x0, x1, texto, color: 'violeta' | 'tinta' | 'verde' }],
    marcas: [{ x, tipo: 'aviso' | 'nota' | 'datos' | 'carga' | 'datos-y-carga' }],
    rotulos: [{ x, y, texto, anclaje: 'start' | 'middle' | 'end', color }],
    eje: { x: 30, y: 152, texto: 'días hábiles respecto del vencimiento' } }
  ```
- Reglas:
  - **La escala** va de x = 30 a x = 970 sobre `[aviso − aire, fin + aire]`.
  - **La cadena** se arma en orden. Si un tramo no tiene cifra, se corta ahí y aparece `gris`.
  - **Las marcas** a menos de 11 unidades se juntan en una: `'datos-y-carga'`, con el rótulo `Entrega y carga, el mismo día` si la carga es 0, o `Entrega y carga, 1 día corrido después` si no lo es.
  - **El aviso** lleva el rótulo `Aviso · 27 días hábiles antes`.
  - **Ningún rótulo sale de 0 a 1000:** si no entra a la derecha de su marca, va con anclaje `end` a la izquierda.
  - **Ningún rótulo se pisa con otro** (rectángulos aproximados con 6,6 por letra): si choca, pasa a la fila libre de arriba (y = 26), y si tampoco entra, no va.

- [ ] **Step 1: Write the failing tests:**
  - `'externa sin notas: banda hasta el vencimiento, gris con el texto y solo la marca del aviso'`;
  - `'interna con carga 0: una sola marca datos-y-carga con «Entrega y carga, el mismo día»'`;
  - `'interna con promedio: «Entrega y carga, 1 día corrido después»'`;
  - `'en las cuatro combinaciones y las dos gestiones de los casos reales, ningún rótulo sale del dibujo ni se pisa con otro'`;
  - `'sin cifra del aviso devuelve null'`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** El molde está en la función `cinta()` de `7-combinaciones-datos-reales.html`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: la cinta del recorrido típico (datos puros, sin rótulos que se pisen)`.

### Task 10: La foto del 31/12

**Files:**
- Create: `services/metricasFoto.js`, `tests/metricas-foto.test.js`
- Modify: `services/notasDigitales.js` (suma `anotarEnLaUltimaCorrida`), `controllers/notificacionesController.js` (`ejecutarNotificacionesDiarias` :56-113: un paso aislado nuevo después de Notas Digitales)

**Interfaces:**
- Consumes: `fuentesDe`, `casosDe`, `indiceMesAMes`, `antiguedadDeVencidos`, `trabajoDelAnio` y `areasYTemas` (Tasks 5 a 8).
- Produces:
  - `DIA_DE_LA_FOTO = '01-10'` (el 10 de enero).
  - `sacarFotoSiCorresponde({ hoy }) → { anio, sacada: true } | { anio, ya: true } | null`:
    - si `hoy >= AAAA-01-10` y no hay foto de `AAAA − 1`, la calcula con `al = (AAAA−1)-12-31` y todos los datasets;
    - guarda solo los casos que tocan el año, con `INSERT IGNORE` por `anio`, así una segunda corrida no la pisa;
    - antes del 10/01, devuelve null.
  - `leerFoto(anio) → { anio, al, datos } | null` y `aniosConFoto() → number[]`.
  - `anotarEnLaUltimaCorrida(texto)`: `UPDATE notas_digitales_config SET ultima_corrida_resultado = LEFT(CONCAT_WS(' · ', ultima_corrida_resultado, ?), 1000), ultima_corrida_con_errores = 1 WHERE id = 1`.
  - El controlador, después de la línea 101: `try { resultados.foto = await sacarFotoSiCorresponde({ hoy }) } catch (e) { console.error(...); resultados.errores.push({ tipo: 'foto-del-anio', error: e.message }); await anotarEnLaUltimaCorrida('No se pudo sacar la foto del año: ' + e.message).catch(() => {}) }`.
  - `datos.version = 1`. Los casos guardados son los mismos `Caso` de la Task 6.

- [ ] **Step 1: Write the failing tests** (base de prueba propia, con el patrón de `notas-motor.test.js`):
  - `'el 09/01/2027 no saca la foto'`;
  - `'el 10/01/2027 la saca al 31/12/2026 y una segunda llamada devuelve ya'`;
  - `'una carga del 05/01/2027 con fecha 30/12/2026 entra; una del 03/01/2027 queda en curso al 31/12'`;
  - `'un error al guardar no tira: queda en la última corrida y con_errores = 1'` (con `conFallaSimulada`).
  - No se llama a `/cron`.
- [ ] **Step 2: Run** `node --test tests/metricas-foto.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** Después correr `tests/notas-api.test.js`, que llama a la corrida diaria contra su base: con hoy anterior al 10/01 de 2027, la foto devuelve null y no cambia nada.
- [ ] **Step 4: Run** el archivo y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: la foto del año se saca sola el 10/01 en la corrida de las 8:15, aislada`.

### Task 11: La API de métricas

**Files:**
- Create: `controllers/metricasController.js`, `tests/metricas-api.test.js`
- Modify: `routes/index.js` (después del Seguimiento, :254), `tests/permisos.test.js` (:95, :147, :186)

**Interfaces:**
- Consumes: Tasks 5 a 10.
- Produces:
  - `opcionesDeMetricas(query, { hoy, aniosConFoto }) → { anio, al, estadistico, dias, gestion, sin }`. Es pura y exportada:
    - los valores inválidos caen al de por defecto (año actual, mediana, hábiles, externa);
    - `sin` acepta solo enteros positivos, sin repetidos.
  - `GET /api/metricas` (`authMiddleware`, sin `adminOnly`) → `{ success, data }`, con `data` así:
    - `{ anio, al, en_vivo, aviso_foto, anios, vista, cinta: { externa, interna }, contexto: { indice, antiguedad }, trabajo, areas, sin_titulos }`;
    - con foto, `vista` sale de `datos.casos`, y el contexto, el trabajo y las áreas, de la foto;
    - entre el 1/1 y el 10/1, el año anterior va en vivo «al 31/12», con `aviso_foto = 'La foto de 2026 se saca el 10/01/2027'`;
    - `anios`: desde 2026 hasta el actual;
    - un año fuera de esa lista da 404 `'No hay métricas de ese año'`.
  - `GET /api/metricas/manuales` sigue en Gestión (`/gestion/metricas-manuales`), sin cambios.

- [ ] **Step 1: Write the failing tests:**
  - `opcionesDeMetricas` con `{ anio: 'abc', sin: 'x,1e3,-2,5,5', estadistico: 'foo', dias: 'bar', gestion: 'z' }` → los de por defecto y `sin: [5]` (Review Focus 2);
  - `'GET /metricas con lector y con colaborador da 200; sin sesión, 401'`;
  - `'?anio=1999 da 404 en JSON'`;
  - `'con una foto guardada, la vista sale de la foto aunque cambie la base'`;
  - `'?estadistico=promedio&dias=corridos cambia las cifras'`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Sumar `/metricas` y `/reportes/estado-general` a las rutas del colaborador en `permisos.test.js`.
- [ ] **Step 4: Run** los archivos y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: la API de métricas (vista, cinta, contexto, trabajo, áreas y foto)`.

### Task 12: La pestaña Métricas: carcasa, circuito, cinta y casos

**Files:**
- Modify: `public/reportes.html` (completo, con su `<style>` de los tokens `--sg-*`, tomado del Seguimiento), `public/js/reportes.js` (se reescribe)
- Modify: el link del menú de Herramientas en las 14 páginas (`<span>Reportes</span>` → `<span>Métricas y Reportes</span>`) y `tests/paginas.test.js` (`reportes.js?v=…` entra en la lista de orden de los scripts, con su constante `VERSION_REPORTES`)
- Create: `tests/reportes-frontend.test.js` (carga `api.js` y `reportes.js` en un `vm`, como `seguimiento-frontend.test.js`)

**Interfaces:**
- Consumes: `GET /api/metricas` (Task 11).
- Produces (puras, en `reportes.js`):
  - `estadoDeLaUrl(search) → { anio, estadistico, dias, gestion, sin, pestana }`;
  - `urlDeEstado(estado) → string`: omite lo que está en su valor por defecto;
  - `htmlDeBarra(datos, estado)`, `htmlDeFranjaSin(datos)`, `htmlDeCircuito(vista, gestion)`, `htmlDeFlecha(tramo)`, `svgDeCinta(cinta)`, `htmlDeAclaraciones(vista, gestion)`, `htmlDeCasos(vista, estado)`.
  - DOM, al final: `cargarMetricas()`, `alCambiarSelector(clave, valor)`, `alDestildar(datasetId)`, las pestañas con hash (`#metricas`, `#reportes`) con el patrón de `correos.js` (`mostrarPestana`, `teclaEnPestanas`).
- Pide los datos con `API.pedirJson('GET', '/metricas?' + …)`.
- Muestra los estados cargando, error (`No se pudieron cargar las métricas. Probá de nuevo en unos minutos.`) y sin datos.

- [ ] **Step 1: Write the failing tests** (`reportes-frontend`):
  - `'estadoDeLaUrl ignora valores inválidos y urlDeEstado omite los de por defecto'`;
  - `'htmlDeFlecha: «27» + «días hábiles» + «mediana de 32 ciclos»; con 0, «En el día» + «mediana en días hábiles» y los ciclos en el texto'`;
  - `'el tramo vacío de la DGMIT dice «Todavía no hay notas DGMIT cargadas» y los pendientes'`;
  - `'svgDeCinta dibuja lo que manda el servidor (x, rótulos y anclajes)'`;
  - `'la franja dice «Calculado sin 1 dataset: Parque Automotor.» y «Volver a todos»'`;
  - `'htmlDeCasos tacha las filas de los destildados'`;
  - `'todo pasa por escapeHtml'` (un título con `<b>`);
  - `'un 0 se escribe como 0'`.
- [ ] **Step 2: Run** `node --test tests/reportes-frontend.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** El molde visual es `4-metricas-datos-reales.html` y `7-combinaciones-datos-reales.html`.
- [ ] **Step 4: Run** el archivo, `tests/paginas.test.js` y `npm test`. Expected: PASS.
- [ ] **Step 5: Verificar en el navegador** (`preview_start` con `rpad`):
  - las ocho combinaciones de selectores y gestión, como lector;
  - destildar Parque Automotor y volver;
  - el teléfono: el circuito en una columna, y la cinta y las tablas con desplazamiento horizontal sin mover la página;
  - sacar una captura.
- [ ] **Step 6: Commit** `feat: la pestaña Métricas: el circuito, la cinta, los selectores y los casos`.

### Task 13: La pestaña Métricas: resultados, contexto, trabajo, áreas, «Para completar» y la mudanza de Gestión

**Files:**
- Modify: `public/js/reportes.js`, `public/reportes.html`
- Modify: `public/gestion.html` (sacar `#tab-metricas` :1026-1118, su CSS, sus pestañas y el `<script>` de Chart.js :13), `public/js/gestion.js` (sacar las funciones de Métricas :5-8, :26, :29, :61, :73-84, :99-396; `MESES_FULL` queda: lo usa Proyectos)
- Modify: `tests/publico-frontend.test.js` (:1317-1342: `textoPorcentaje` y `htmlDelRanking` se prueban en `reportes-frontend`), `tests/paginas.test.js` (`VERSION_GESTION`)
- Test: `tests/reportes-frontend.test.js`

**Interfaces:**
- Produces (puras):
  - `htmlDeResultados(vista)`, `svgDeIndice(indice)` (línea, una serie, el valor en un `<title>` por punto), `htmlDeAntiguedad(antiguedad)`, `htmlDeTrabajo(trabajo, estado)` (cinco totales y las columnas por mes, con chips);
  - `htmlDeAreas(areas)`: el ranking con `textoPorcentaje` y `htmlDelRanking`, que se mudan sin cambios desde gestion.js, y los temas y las frecuencias en barras horizontales;
  - `htmlDeParaCompletar(vista, puedeCargar)`: el link `Cargar nota DGMIT` lleva a `seguimiento.html?id=N#cargar-nota` solo si `Auth.puedeCargarNotasDgmit()`.
- Las métricas manuales: la misma API de Gestión. El formulario aparece solo con `Auth.isAdmin()`, y el CSV es el de siempre (`/gestion/metricas/csv`).
- Si el Seguimiento no abre el formulario con `#cargar-nota`, se suma ahí con un cambio mínimo: al cargar, si el hash es `#cargar-nota` y quien mira puede cargar, abre el modal con el dataset elegido.

- [ ] **Step 1: Write the failing tests:**
  - los de `textoPorcentaje` y `htmlDelRanking`, movidos;
  - `'htmlDeResultados: «5 de 33 ciclos» y «una mediana de 61 días hábiles después»'`;
  - `'svgDeIndice: sin puntos no dibuja nada; un mes con tasa null no se dibuja'`;
  - `'htmlDeParaCompletar sin permiso no tiene el link de carga'`;
  - `'gestion.html ya no tiene Chart.js ni #tab-metricas'` (paginas).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `tests/reportes-frontend.test.js`, `tests/publico-frontend.test.js`, `tests/paginas.test.js` y `npm test`. Expected: PASS.
- [ ] **Step 5: Verificar en el navegador:**
  - Métricas completa, como admin y como lector;
  - Gestión, que queda solo con Proyectos;
  - cargar una métrica manual como admin.
- [ ] **Step 6: Commit** `feat: Métricas suma resultados, contexto, trabajo, áreas y «Para completar»; Gestión queda con Proyectos`.

### Task 14: La base de los PDF y el Estado general con el diseño del anexo

**Files:**
- Create: `services/reportesPdfBase.js`, `tests/reportes-pdf.test.js`
- Modify: `controllers/reportesController.js` (`reporteEstadoGeneral` :246 pasa a usar la base; se sacan `drawHeader`/`drawFooter`/`drawStatCard*` si ya nadie los usa)

**Interfaces:**
- Consumes: de `notasDigitalesAnexo.js`: `COLOR`, `MARGEN`, `IZQUIERDA`, `DERECHA`, `ABAJO`, `CONTENIDO`, `NORMAL`, `NEGRITA`, `renglon`, `rotulo`, `filete`, `prepararGrilla`. De `notasDigitalesPdf.js`: `DocumentoNota`.
- Produces:
  - `nuevoReporte({ titulo }) → DocumentoNota`: A4, `autoFirstPage: false`, márgenes 0 e `info`.
  - `agregarHoja(doc, { derecha, fecha }) → y`: el encabezado del anexo, con «DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN» y «Municipalidad de Comodoro Rivadavia» a la izquierda, y a la derecha `derecha` con la fecha larga y el filete con el acento.
  - `cerrarReporte(doc, { generado: { momento, por }, pieDe: (k, n) => string }) → Promise<Buffer>`: dibuja los pies en todas las hojas (`Generado el dd/mm/aaaa a las hh:mm por <nombre corto>` y `pieDe(k, n)`).
  - `dibujarTitulo(doc, { rotulo, titulo }, y) → y`, `dibujarPildora(doc, texto, y, { tono: 'azul' | 'sol' }) → y`, `dibujarTarjetas(doc, [{ valor, rotulo }], y) → y`, `prepararTabla(doc, { columnas: [{ titulo, ancho }], filas, estados }) → { dibujar(y) → y }`. La tabla corta de hoja y repite el encabezado.
- **Estado general:**
  - conserva los textos que afirman `tests/reportes.test.js` (:51-59) y `tests/estados-api.test.js` (:197-245): las tarjetas con el valor arriba del rótulo, `Tasa de actualización: N%`, las aclaraciones de eventuales y sin fecha, los encabezados de la tabla y los estados;
  - suma la píldora `El N % de los que tienen vencimiento están al día: A de B`;
  - el pie dice `Estado general · Hoja k de N`.

- [ ] **Step 1: Write the failing tests** (`reportes-pdf`, con `pdf-lector`):
  - `'el Estado general lleva el encabezado del anexo y el pie «Estado general · Hoja k de N»'`;
  - `'la tabla de 81 filas corta de hoja y repite el encabezado'`;
  - `'nada se pisa'` (con el `verificarDiagramacion` de `seguimiento-pdf.test.js`, movido a un ayudante compartido `tests/pdf-diagramacion.js`).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `tests/reportes-pdf.test.js`, `tests/reportes.test.js`, `tests/estados-api.test.js`, `tests/seguimiento-pdf.test.js` y `npm test`. Expected: PASS, sin tocar las afirmaciones del Estado general.
- [ ] **Step 5: Commit** `feat: la base de los reportes PDF y el Estado general con el diseño del anexo`.

### Task 15: PDF «Métricas del año»

**Files:**
- Create: `services/reportesMetricasPdf.js`
- Modify: `controllers/metricasController.js` (`GET /api/metricas/pdf`, con las mismas opciones que la API), `routes/index.js`
- Test: `tests/reportes-pdf.test.js`, `tests/metricas-api.test.js`

**Interfaces:**
- Consumes: Tasks 11 y 14, y `cintaDeMetricas`.
- Produces: `renderMetricasDelAnio(datos, { generado }) → Promise<Buffer>`. Son unas 4 hojas:
  1. Los dos circuitos en recuadros con borde azul, los resultados y «Cómo se cuenta».
  2. Las dos cintas y los casos destildados, si los hay.
  3. El contexto y el trabajo del RPAD.
  4. Áreas y temas.
  - La píldora dice `Mediana en días hábiles · con todos los datasets` (o lo elegido, con los destildados). El pie, `Métricas del RPAD · AAAA · Hoja k de N`.
- El nombre del archivo es `Metricas-RPAD-AAAA.pdf`, con `disposicionDeAdjunto`.

- [ ] **Step 1: Write the failing tests:**
  - `'la píldora dice la combinación y los destildados'`;
  - `'el circuito sin notas DGMIT dice «Todavía no hay notas DGMIT cargadas»'`;
  - `'nada se pisa'`;
  - `'el lector lo descarga'`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: el PDF de Métricas del año`.

### Task 16: PDF «Por área» con las hojas del Seguimiento

**Files:**
- Modify: `services/seguimientoPdf.js` (exportar `dibujarHoja(doc, seguimiento, { hoy, generado, pie })`, sin cambiar lo que dibuja), `controllers/reportesController.js` (`reportePorArea` :742 se reescribe)
- Test: `tests/reportes-pdf.test.js`, `tests/estados-api.test.js` (:247-295 se reescribe a propósito), `tests/reportes.test.js` (:61-66 se reescribe)

**Interfaces:**
- Consumes: `fuentesDe(ids)`, `seguimientoDe(fuentes, hoy, OPCIONES_CINTA_PDF)`, `dibujarHoja`, la base de la Task 14.
- La portada lleva:
  - el área y sus contactos;
  - las 5 tarjetas;
  - la lista por grupo (`Vencidos (n)`, `Próximos a vencer (n)`, `Actualizados (n)`, `Eventuales (n)`, `Sin fecha (n)`), con un renglón por dataset: `Título · Datos al: dd/mm/aaaa · Próxima: dd/mm/aaaa`.
- Después, una hoja del Seguimiento por cada dataset **activo**, en el orden de la lista.
- El pie de todas las hojas dice `Reporte por área · Hoja k de N`. El nombre del archivo es `Reporte-area-<id>-AAAA-MM-DD.pdf`.

- [ ] **Step 1: Write the failing tests:**
  - `'1 portada + N hojas, una por dataset activo; uno dado de baja no tiene hoja'` (Review Focus 5);
  - `'el pie dice «Reporte por área · Hoja k de N» en todas'`;
  - `'la portada agrupa como antes'`: reescribe las afirmaciones viejas de la portada con el formato nuevo de renglón;
  - `'área inexistente: 404 «Área no encontrada»'`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** los archivos, `tests/seguimiento-pdf.test.js` y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: el reporte Por área con una hoja de Seguimiento por dataset`.

### Task 17: PDF «Avisos del RPAD», sin Cumplimiento ni Historial

**Files:**
- Modify: `controllers/reportesController.js` (sale `reporteHistorialNotificaciones` :475 y sus ayudantes; sale `reporteCumplimiento` :853; entra `reporteAvisos`), `routes/index.js` (:244-247), `public/js/api.js` (salen `getReporteHistorialUrl` :500 y `getReporteCumplimientoUrl` :512; `VERSION` sube en todas las páginas y en `tests/paginas.test.js`)
- Test: `tests/reportes.test.js` (:34-36 y :43-45 se reescriben), `tests/estados-api.test.js` (:297-337: sale el bloque de Cumplimiento y «la tasa es la misma» compara la portada, el Estado general y `GET /metricas`), `tests/reportes-pdf.test.js`

**Interfaces:**
- Produces: `GET /api/reportes/avisos?desde=&hasta=` (`authMiddleware`). Las fechas se validan con `esFechaIso`; si son inválidas o `desde > hasta`, da 400 con `'Elegí un período válido.'`. Por defecto va del 1/1 a hoy.
- El contenido:
  - los totales;
  - una tabla `Fecha · Qué fue · Gestión · Datasets · Estado`, con «Qué fue» en los textos del Seguimiento (`QUE_PEDIA`, `Nota Digital N° n/aa`, `Email al área: anticipo de la nota formal`);
  - sin direcciones, sin notas de prueba, sin auditoría ni autorización y sin el texto técnico de los errores;
  - el pie: `Avisos del RPAD · Hoja k de N`.
- `GET /reportes/cumplimiento` y `GET /reportes/historial-notificaciones` pasan a dar 404.

- [ ] **Step 1: Write the failing tests:**
  - `'avisos: emails y notas del período, sin «@» en ninguna parte del PDF'`;
  - `'desde > hasta da 400'`;
  - `'cumplimiento e historial-notificaciones dan 404'`;
  - `'la tasa es la misma en la portada, el Estado general y /metricas'`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** `tests/frontend-utils.test.js` (:93-110) sigue pasando, porque quedan `getReporteEstadoGeneralUrl` y `getReportePorAreaUrl`.
- [ ] **Step 4: Run** los archivos, `tests/paginas.test.js`, `tests/frontend-utils.test.js` y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: el reporte Avisos del RPAD reemplaza al Historial; sale Cumplimiento`.

### Task 18: PDF «Agenda de pedidos» y «Datos para completar»

**Files:**
- Create: `services/reportesAgenda.js` (puro: la agenda como datos), `tests/reportes-agenda.test.js`
- Modify: `controllers/reportesController.js` (`reporteAgenda`, `reporteParaCompletar`), `routes/index.js`
- Test: `tests/reportes-pdf.test.js`

**Interfaces:**
- Consumes: `pedido`, `tipoEfectivo` y `frecuenciaEnNota` (fechasDatasetReglas); `VENTANA_DIAS` (notasDigitalesDatos); `proximoDiaHabil` y `sumarDias`; `vistaDe(...).para_completar`.
- Produces:
  - `fechaDeAvisoPorRegla(vencimiento, gestion) → 'AAAA-MM-DD'`: `proximoDiaHabil(sumarDias(vencimiento, -VENTANA_DIAS[gestion]))`.
  - `agendaDe(datasets, { hoy, meses: 3 | 6 | 12, gestion: 'ambas' | 'externa' | 'interna' }) → { vencidos: Fila[], meses: [{ mes: 'AAAA-MM', filas: Fila[] }] }`:
    - `Fila = { titulo, area, gestion, frecuencia, requiere_nota_texto, datos_solicitados, aviso_aprox }`;
    - un vencimiento por dataset, que es la próxima actual;
    - los vencidos van aparte, al principio;
    - sin eventuales ni sin fecha.
  - `GET /api/reportes/agenda?meses=&gestion=`: los valores inválidos caen a 6 y `ambas`. El pie dice `Agenda de pedidos · Hoja k de N`.
  - `GET /api/reportes/para-completar`: el mismo contenido que la sección de Métricas, con el pie `Datos para completar · Hoja k de N`.

- [ ] **Step 1: Write the failing tests:**
  - `'agendaDe con 6 meses agrupa por mes y pone los vencidos aparte'`;
  - `'fechaDeAvisoPorRegla del 31/01/2027 externo cae en el hábil siguiente al 22/12/2026'`;
  - `'?meses=7 cae a 6'`;
  - `'los dos PDF se descargan con lector y nada se pisa'`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: los reportes Agenda de pedidos y Datos para completar`.

### Task 19: PDF «Informe anual»

**Files:**
- Modify: `controllers/reportesController.js` (`reporteInformeAnual`), `routes/index.js`
- Test: `tests/reportes-pdf.test.js`, `tests/metricas-api.test.js`

**Interfaces:**
- Consumes: `leerFoto(anio)`, `leerFoto(anio - 1)`, `vistaDe` y los hitos de `proyecto_hitos` (con `fecha` en el año, agrupados por proyecto; el SQL va como el de `getTimeline`, `gestionController.js:574`).
- Produces: `GET /api/reportes/informe-anual?anio=`.
  - Sin foto de ese año da 404 `'Todavía no hay foto de ese año: se saca el 10/01 del año siguiente.'`.
  - El contenido:
    - la foto: el circuito, los resultados, el contexto y el trabajo;
    - la comparación con la foto del año anterior, o `Primer año con foto`;
    - `Logros del año`.
  - El pie dice `Informe anual AAAA · Hoja k de N`.

- [ ] **Step 1: Write the failing tests:**
  - `'sin foto, 404 con el mensaje'`;
  - `'con foto de 2026 y sin la de 2025: «Primer año con foto»'`;
  - `'los logros de 2026 por proyecto'`;
  - `'nada se pisa'`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: el Informe anual sale de la foto del 31/12`.

### Task 20: La pestaña Reportes

**Files:**
- Modify: `public/reportes.html`, `public/js/reportes.js`
- Test: `tests/reportes-frontend.test.js`

**Interfaces:**
- Produces:
  - `htmlDeReportes(datos, { anios, areas })`, con dos grupos:
    - **Para presentar:** Métricas del año, Informe anual y Estado general de los datasets.
    - **Para trabajar:** Por área, Avisos del RPAD, Agenda de pedidos (chips `3`, `6`, `12 meses` y la gestión) y Datos para completar.
  - Los textos de cada tarjeta son los de `3-reportes.html`. El Informe anual sin foto muestra el botón deshabilitado `Disponible desde el 10/01/AAAA+1`. (La spec decía «1/1»: vale el 10/01 de la foto.)
  - `descargarReporte(ruta, nombre)` usa `API.pedirArchivo` y una copia local de `descargarBlob`, como `seguimiento.js`.
  - Las áreas salen de `API.getAreas()`.

- [ ] **Step 1: Write the failing tests:**
  - `'siete tarjetas en dos grupos'`;
  - `'el Informe anual sin foto, deshabilitado con «Disponible desde el 10/01/2027»'`;
  - `'Avisos del RPAD trae del 1/1 a hoy'`;
  - `'Por área sin elegir no descarga y avisa «Elegí un área.»'`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** el archivo y `npm test`. Expected: PASS.
- [ ] **Step 5: Verificar en el navegador:** descargar los siete PDF (el Informe anual con una foto de prueba en la base de la rama) y sacar capturas de una hoja de cada uno.
- [ ] **Step 6: Commit** `feat: la pestaña Reportes con los siete reportes`.

### Task 21: Los «Recibido el» viejos, la documentación y el kit

**Files:**
- Create: `database/updates/migracion-metricas-recibido-datos.sql`, generada desde `Escritorio/RPAD-metricas/RPAD - Recibido el - para completar.xlsx`. Solo lleva fechas y orígenes, sin las observaciones. El generador queda fuera del repositorio.
- Modify: `CLAUDE.md`, `README.md`
- Test: `tests/schema.test.js` (su `describe`)

**Interfaces:**
- El SQL inserta una fila por cada fila del Excel que tenga fecha u origen:
  - `INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT ?, ?, ? FROM cambios_pendientes WHERE id = ? ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos)`, con los valores escritos, uno por fila;
  - se puede repetir, y un cambio que no existe no hace nada;
  - al final, la consulta de verificación: cuántos cambios aprobados siguen sin «Recibido el» (con la base del 24/10 y el Excel de hoy, 5).
- Documentación:
  - **CLAUDE.md:**
    - la página Métricas y Reportes (reglas, foto, selectores, destildado);
    - «Recibido el» obligatorio, el origen y la edición;
    - los reportes nuevos y los que salen;
    - Gestión, solo con Proyectos;
    - Chart.js ya no se usa en Gestión;
    - 29 tablas;
    - las copias mínimas nuevas de `admin-fechas.js`.
  - **README:** la sección «Migración: Métricas y Reportes», el Changelog y la tabla de estructura.
  - **Kit:** `Escritorio/RPAD-deploy-metricas-y-reportes/`, con el formato de `RPAD-deploy-notas-dgmit`:
    - `PASOS.txt`;
    - `sql/1-migracion-metricas.sql` y `sql/2-migracion-metricas-recibido-datos.sql`;
    - los archivos y el zip;
    - `vuelta-atras/`.
    - Los avisos de lo que cambia en la administración: «Registrar actualización» pide fecha y origen, y la edición no mueve juntas la carga y la próxima.
    - El recordatorio: los Excel van antes del 10/01/2027.
    - El de notas DGMIT 2026 se importa con la importación de esa spec (sección 9), que **no** está en este plan.

- [ ] **Step 1: Write the failing test** (`schema.test.js`): el SQL de datos no tiene palabras prohibidas, se puede repetir y después de correrlo quedan 5 cambios sin «Recibido el» en la base de la rama.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** el SQL, CLAUDE.md, README y el kit.
- [ ] **Step 4: Run** `npm test` completo. Expected: PASS, contra la línea de base de la Task 1 más los tests nuevos.
- [ ] **Step 5: Commit** `docs: Métricas y Reportes: SQL de los «Recibido el» viejos, CLAUDE.md, README y kit`.
- [ ] **Step 6: Revisión final de toda la rama** con Opus (superpowers:requesting-code-review), antes de ofrecerle el merge al usuario.
