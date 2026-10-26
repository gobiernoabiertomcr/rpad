# Proyectos (gestion.html pasa a proyectos.html) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la página Gestión por `proyectos.html` con el estilo del Seguimiento: carriles de 3 años con flechas, detalle con la cinta del recorrido, línea de tiempo y logros. Se arreglan los errores de la página y del servidor, el lector puede bajar los documentos y el renombre llega a todo el sitio.

**Architecture:** El servidor mantiene las rutas `/api/gestion/…`.
- Las funciones de proyectos pasan a `controllers/proyectosController.js`.
- Las reglas puras van a `services/proyectosReglas.js`.
- Las subidas pasan por un middleware que valida antes de que multer escriba.

El navegador carga `public/js/proyectos.js`, que al cargarse solo declara. Lo puro arma el HTML y lo prueba un `vm`; lo que toca el DOM y la API va al final del archivo.

La redirección de `/gestion.html` y el menú de las páginas con carcasa cierran el renombre.

**Tech Stack:** Node 22, Express 4, mysql2/promise sobre MariaDB, multer 1.4.5 y JS sin frameworks. Los tests corren con `node:test`: los de API, sobre Docker con base propia; los de la página, en un `vm`.

**Spec:** `docs/superpowers/specs/2026-10-25-proyectos-design.md` (aprobada el 25/10/2026). La maqueta, `docs/superpowers/specs/2026-10-25-proyectos-mockups/`, sirve de referencia visual y de CSS, pero manda la spec.

## Global Constraints

- **Esta entrega va al final de la cola.** La Task 1 recién empieza cuando estén en main el Generador de Notas y Configuración (`git log main` muestra los dos merges). Ningún archivo de main se toca antes.
- **No romper nada:** `npm test` completo antes y después de cada tarea. Nunca dos suites a la vez con otra sesión: antes de correr, mirar que no haya bases `rpad_test%` en uso ni otro `node --test`.
- **Todos los subagentes van con Opus** (implementar, revisar, corregir).
- **Ningún email real.** Nunca llamar a `/api/cron/*`. La base compartida `datospublicos_mcr_rpad` no se escribe: para probar, `rpad_rama_proyectos`.
- **Sin nombres de personas** en archivos versionados. En los tests, datos inventados con el prefijo `[TEST]`.
- **Las convenciones de CLAUDE.md:**
  - ES Modules y `async/await`;
  - respuestas `{ success, data?, error?, campo?, message? }`;
  - SQL siempre parametrizado;
  - transacciones con `beginTransaction`/`commit`/`rollback`;
  - textos en español, sin «→» en links ni botones, sin rótulos en mayúsculas.
- **Las fechas como texto `'AAAA-MM-DD'`:**
  - en el navegador, «hoy» = `Utils.hoyEnArgentina()`; nunca `toISOString()` ni `new Date('AAAA-MM-DD')`;
  - en el servidor, `hoyArgentina()` y `esFechaIso` de `services/notasDigitalesCalendario.js`;
  - un TIMESTAMP, con `UNIX_TIMESTAMP` + `ahoraArgentina`.
- **`public/js/api.js` y `public/js/main.js` no cambian.** Si cambiaran, habría que subir `VERSION` en todas las páginas.
- **Textos fijos de la spec** (copiar tal cual):
  - la bajada: «Los proyectos de la Dirección de Datos Públicos y Comunicación, con sus hitos y documentos, y los logros del área. Los hitos de cada año salen en el Informe anual.»;
  - la frase del año: «En 2025: 7 hitos de 4 proyectos y 1 logro del área. Son los que salen en el Informe anual de 2025.»;
  - el aviso de las métricas: «Las métricas de Gestión ahora están en Herramientas → Métricas y Reportes.» (con el link a `reportes.html#metricas`);
  - los mensajes de validación de la sección 9 de la spec y los de la Task 2.
- **La paleta, en este orden:** `#1A365D` Azul tinta, `#0950C6` Azul oscuro, `#3B82F6` Azul, `#2B7AB8` Celeste, `#0E7490` Petróleo, `#2E6B4C` Verde, `#F45000` Naranja, `#CC0066` Magenta, `#6D4BA8` Violeta, `#56677F` Gris.
- **El ícono del menú y del `h1`:** `folder-kanban`, `<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><path d="M8 10v4"/><path d="M12 10v2"/><path d="M16 10v6"/>`.
- **Los límites de los archivos:** 3 por hito, 10 documentos por proyecto, 10 MB cada uno, con las extensiones y los MIME de `config/upload.js`.
- **El rango de fechas:** de `'2000-01-01'` al 31/12 de cinco años después del de hoy.
- **Los carriles:** ventana de 3 años; reparto `minmax(0, 2fr) minmax(0, 3fr)`; los puntos a menos de 15 px se juntan.

## Review Focus

1. **Un nombre de proyecto, de hito o de archivo con HTML** (`<img src=x onerror=alert(1)>`) se ve como texto en los carriles, la ficha, la cinta, la línea de tiempo, los `title` y los avisos. Nunca se ejecuta. Tests en las Tasks 5, 6 y 7.
2. **Un archivo con tildes o espacios** («presentación final.pdf») se guarda, se lista y se descarga con su nombre. Test en la Task 4.
3. **Doble clic en «Guardar»:** el botón queda deshabilitado mientras espera, y no se crean dos proyectos ni dos hitos. Test en la Task 8 (el guardado con un `fetch` falso que tarda).
4. **Editar un proyecto con un color que no está en la paleta** (`#6CA3C6`): aparece «Color actual» elegido, y guardar sin tocarlo no cambia el color. Tests en la Task 7 (navegador) y la Task 3 (el servidor acepta cualquier `#RRGGBB`).
5. **Un nombre largo sin espacios** (200 caracteres seguidos): no rompe el carril, la ficha ni la tabla de datos (`overflow-wrap: anywhere`). Test en la Task 5 (la clase está en el HTML) y se mira en el recorrido de la Task 11.

---

### Task 1: Traer main, armar la base de la rama y releer

**Files:**
- Modify: este plan, si algo cambió (por ejemplo, la cantidad de páginas con carcasa, la línea de la ayuda del lector en `usuarios.js` o las constantes de versión de `tests/paginas.test.js`).

**Interfaces:**
- Produces: la rama `feat/proyectos` con main adentro, la base `rpad_rama_proyectos` al día y un `npm test` en verde de base.

- [ ] **Step 1:** Comprobar que el Generador de Notas y Configuración están en main: `git log --oneline main | head -20` muestra los merges de `feat/generador-de-notas` y `feat/configuracion`. Si falta alguno, parar y avisar.
- [ ] **Step 2:** En el worktree `.claude/worktrees/proyectos`, ejecutar `git merge main`. No debería haber conflictos: la rama solo tiene `docs/`.
- [ ] **Step 3:** Rehacer la base `rpad_rama_proyectos` como copia de `datospublicos_mcr_rpad`, que ya tiene las migraciones de las dos entregas (`DROP` + `CREATE` + volcado, y `GRANT` a `rpad`, como el 25/10). Junction de `node_modules` a `C:\git\rpad\node_modules`.
- [ ] **Step 4:** Releer lo que esta entrega toca y anotar en el plan lo que cambió:
  - el menú de `index.html` (cuántas páginas tienen `id="sidebar"`);
  - `tests/paginas.test.js`: las constantes de versión, la lista de destinos y el arreglo de scripts «después de api.js»;
  - la ayuda del lector y del colaborador en `public/js/usuarios.js`, y su página y su `?v=`;
  - las redirecciones que dejó Configuración en `app.js`;
  - `routes/index.js` (sección Gestión).
- [ ] **Step 5:** Correr `npm test` completo. Esperado: 0 fallos; anotar el total.
- [ ] **Step 6:** Si hubo cambios, commit: `git commit -am "docs: plan de Proyectos al día con main (Generador y Configuración)"`.

### Task 2: Las reglas puras (`services/proyectosReglas.js`)

**Files:**
- Create: `services/proyectosReglas.js`
- Test: `tests/proyectos-reglas.test.js`

**Interfaces:**
- Consumes: `esFechaIso` de `services/notasDigitalesCalendario.js`.
- Produces (todo exportado; ninguna función tira):
  - `ESTADOS_PROYECTO = ['idea', 'en_curso', 'completado', 'suspendido']`, `PRIORIDADES = ['alta', 'media', 'baja']`, `CATEGORIAS = ['tecnologia', 'normativa', 'difusion']`;
  - `ICONOS_PROYECTO`: las 25 claves de `ICON_SELECTOR_MAP` de `public/js/main.js`, en su orden;
  - `LARGOS = { nombre: 200, responsable: 150, enlace: 500, titulo: 200, evidencia: 500 }`;
  - `FECHA_MINIMA = '2000-01-01'`;
  - `fechaMaxima(hoy) → 'AAAA-12-31'`, con el año de `hoy` más 5;
  - `MENSAJES_PROYECTOS` (abajo);
  - `validarProyecto(entrada, { hoy, parcial = false }) → { datos, errores: [{ campo, mensaje }] }`;
  - `validarHito(entrada, { hoy, parcial = false }) → { datos, errores }`;
  - `evidenciaTipo({ evidencia_url, cantidadArchivos }) → 'url' | 'archivo' | 'ninguno'`;
  - `nombreOriginal(nombre) → string`: de latin1 a UTF-8. Si el resultado trae `\uFFFD`, devuelve el original;
  - `idPositivo(valor) → number | null`: solo `/^[1-9]\d{0,9}$/`;
  - `primerError(errores) → { error, campo } | null`.

`MENSAJES_PROYECTOS`, textos exactos:

```js
{
  nombre: 'Escribí el nombre del proyecto.', nombreLargo: 'El nombre puede tener hasta 200 caracteres.',
  estado: 'El estado no es válido.', prioridad: 'La prioridad no es válida.', categoria: 'La categoría no es válida.',
  fechaInicio: 'La fecha de elevación no es válida.',
  responsable: 'El autor o responsable puede tener hasta 150 caracteres.',
  enlace: 'El enlace tiene que empezar con http:// o https://.', enlaceLargo: 'El enlace puede tener hasta 500 caracteres.',
  color: 'El color no es válido.', icono: 'El ícono no es válido.', areas: 'Elegí áreas que existan.',
  titulo: 'Escribí el título del hito.', tituloLargo: 'El título puede tener hasta 200 caracteres.',
  fecha: 'Elegí la fecha del hito.', fechaInvalida: 'La fecha del hito no es válida.',
  evidencia: 'El enlace de la evidencia tiene que empezar con http:// o https://.',
  evidenciaLarga: 'El enlace de la evidencia puede tener hasta 500 caracteres.',
  sinDatos: 'No hay datos para guardar.'
}
```

**Reglas:**
- **`validarProyecto`:**
  - recorta los textos; un texto vacío es `null`;
  - `color` cumple `/^#[0-9a-fA-F]{6}$/`; cualquier color vale, no solo los de la paleta;
  - `icono` está en `ICONOS_PROYECTO` o es vacío;
  - `areas` son enteros positivos sin repetir; un id inválido da el error de `areas`;
  - con `parcial`, solo valida y devuelve las claves presentes, y un `nombre` presente y vacío es un error;
  - sin `parcial`, `estado`, `prioridad` y `categoria` que faltan toman `'idea'`, `'media'` y `'tecnologia'`;
  - los errores van en el orden nombre, estado, prioridad, categoría, fecha, responsable, enlace, color, ícono, áreas.
- **`validarHito`:** `titulo` y `fecha` son obligatorios (sin `parcial`). `fecha` y `fecha_inicio` tienen que estar entre `FECHA_MINIMA` y `fechaMaxima(hoy)`. El largo se cuenta con `Array.from`, como en las notas DGMIT.

- [ ] **Step 1: Write the failing tests** en `tests/proyectos-reglas.test.js`:
  - `validarProyecto`: el mínimo válido da los valores de entrada; nombre vacío o de espacios da `[{ campo: 'nombre', mensaje: MENSAJES_PROYECTOS.nombre }]`; 201 caracteres da `nombreLargo`; `estado: 'otro'` da `estado`; `fecha_inicio: '2026-02-30'` y `'1999-12-31'` dan `fechaInicio`, igual que `fechaMaxima('2026-10-25')` más un día (`'2032-01-01'`); `enlace_externo: 'javascript:alert(1)'` da `enlace`; `color: '#6ca3c6'` vale; `color: 'red'` da `color`; `icono: 'rocket'` da `icono`; `areas: [3, '3', 'x']` da `areas`; `areas: [3, 3, 5]` da `[3, 5]`.
  - Con `parcial`: `{ descripcion: 'x' }` devuelve `datos` con solo `descripcion`, y `{ nombre: '' }` es un error.
  - `validarHito`: falta el título, falta la fecha, fecha fuera de rango, evidencia que no es http y 501 caracteres.
  - `evidenciaTipo`: con enlace da `'url'`; sin enlace y con 1 archivo, `'archivo'`; sin nada, `'ninguno'`.
  - `nombreOriginal(Buffer.from('presentación.pdf', 'utf8').toString('latin1'))` da `'presentación.pdf'`, y `nombreOriginal('informe.pdf')` da `'informe.pdf'`.
  - `idPositivo`: `'12'` da 12; `'0'`, `'-3'`, `'1.5'`, `'1e3'`, `'..%2F'` y `'abc'` dan `null`.
  - `ICONOS_PROYECTO` es igual a las claves de `ICON_SELECTOR_MAP`, sacadas con una regex del texto de `public/js/main.js`.
- [ ] **Step 2:** `node --test tests/proyectos-reglas.test.js`. Esperado: FAIL (no existe el módulo).
- [ ] **Step 3:** Implementar `services/proyectosReglas.js` con las firmas de arriba.
- [ ] **Step 4:** `node --test tests/proyectos-reglas.test.js`. Esperado: PASS.
- [ ] **Step 5:** `npm test` completo y commit: `feat: reglas puras de proyectos e hitos (validación, evidencia y nombres de archivo)`.

### Task 3: El controlador de proyectos, hitos, logros y timeline (sin archivos)

**Files:**
- Create: `controllers/proyectosController.js`
- Modify: `controllers/gestionController.js` (salen las funciones de proyectos; quedan las métricas, el CSV y las métricas manuales), `routes/index.js` (sección «Gestión»: los imports y los handlers de proyectos)
- Test: `tests/proyectos-api.test.js` (nuevo, Docker; base `rpad_test_proyectos_api` con `crearBaseDePrueba`, como `tests/seguimiento-api.test.js`), `tests/permisos.test.js`

**Interfaces:**
- Consumes: `validarProyecto`, `validarHito`, `evidenciaTipo`, `idPositivo`, `primerError` y `MENSAJES_PROYECTOS` (Task 2); `hoyArgentina` y `ahoraArgentina`.
- Produces: las respuestas que lee la página (Tasks 5 a 8). Los nombres de los campos no cambian; cambian las fechas.

**`GET /gestion/proyectos`** responde, por cada proyecto activo:
- `{ id, nombre, descripcion, estado, fecha_inicio, icono, color, responsable, enlace_externo, prioridad, categoria, orden, areas: [{ id, nombre }], cantidad_hitos, hitos_completados, cantidad_documentos }`;
- `fecha_inicio` va como `'AAAA-MM-DD'` o `null`;
- `hitos_completados` cuenta las fechas ≤ `hoyArgentina()`.

**`GET /gestion/proyectos/:id`** responde lo mismo más:
- `hitos: [{ id, proyecto_id, titulo, fecha, descripcion, evidencia_tipo, evidencia_url, archivos: [{ id, nombre_archivo, tamano, mime_type, subido_el }] }]`, por `fecha` descendente;
- `documentos: [{ id, nombre_archivo, tamano, mime_type, subido_el }]`.

**`GET /gestion/timeline`** responde cada hito con:
- `proyecto_nombre`, `proyecto_color`, `proyecto_icono` y `categoria`;
- `archivos`;
- `fecha` como `'AAAA-MM-DD'`;
- `subido_el` como `'AAAA-MM-DD'`, el día en Argentina, de `UNIX_TIMESTAMP(created_at)` + `ahoraArgentina`.

Sin consultas N+1: una consulta por tabla para todos los ids juntos.

**Escrituras:**
- `POST/PUT /gestion/proyectos[/:id]` y `POST /gestion/logros`, `POST /gestion/proyectos/:proyecto_id/hitos`, `PUT /gestion/hitos/:id`:
  - validan con las reglas; un error es 400 `{ success: false, error, campo, errores }`;
  - las áreas que no existen dan 400 en `areas`;
  - un proyecto con áreas va en una transacción;
  - `evidencia_tipo` lo deriva el servidor: se ignora el que llegue.
- `DELETE /gestion/proyectos/:id`: soft delete, como hoy.
- `PUT` y `DELETE /gestion/hitos/:id`: 404 «Hito no encontrado» si el hito no existe o es de un proyecto dado de baja.
- Un id que no pasa `idPositivo`: 404.
- El borrado de los archivos del disco al borrar un hito lo agrega la Task 4. Acá, el `DELETE` borra las filas en una transacción.

- [ ] **Step 1: Write the failing tests** en `tests/proyectos-api.test.js` (`describe('proyectos')`, `describe('hitos y logros')`, `describe('permisos')`):
  - crear un proyecto con dos áreas da 201 (como hoy; también los hitos, los logros y las subidas) con su `id`; el detalle trae las áreas y `fecha_inicio: '2026-03-16'` como texto;
  - un área inexistente da 400 `campo: 'areas'`, y `SELECT COUNT(*) FROM proyectos WHERE nombre = ?` da 0 (la transacción);
  - cada 400 de validación con su `campo`, uno por regla de la Task 2;
  - un `PUT` solo con `descripcion` no cambia el nombre, y `PUT { nombre: '' }` da 400;
  - el color `#6CA3C6` se guarda tal cual;
  - el `DELETE` da de baja; después el detalle da 404, la lista no lo trae y `PUT /gestion/hitos/<un hito suyo>` da 404;
  - el hito con `evidencia_url` queda `evidencia_tipo: 'url'`, sin ella `'ninguno'`, aunque llegue `evidencia_tipo: 'archivo'`;
  - el logro (`POST /gestion/logros`) aparece en `/gestion/timeline` con `proyecto_id: null`;
  - las fechas de la timeline son texto `'AAAA-MM-DD'`;
  - el id `abc` da 404 en `GET /gestion/proyectos/abc`;
  - permisos: el lector y el colaborador reciben 200 en los tres GET y 403 en cada escritura; sin sesión, 401.
- [ ] **Step 2:** Sumar a `RUTAS_SOLO_ADMIN` de `tests/permisos.test.js` las escrituras de proyectos, logros e hitos (las subidas y borrados de archivos, en la Task 4). Sumar `/gestion/timeline` a los GET que puede el lector (`describe('lector')`, que ya tiene `/gestion/metricas` y `/gestion/proyectos`), y `/gestion/proyectos` y `/gestion/timeline` a los del colaborador (`describe('colaborador')`, que hoy no tiene ninguno de `/gestion`).
- [ ] **Step 3:** Correr los dos archivos. Esperado: FAIL donde cambia el comportamiento (validaciones, fechas, transacción, 404 del dado de baja).
- [ ] **Step 4:** Implementar `controllers/proyectosController.js`: `getProyectos`, `getProyectoById`, `createProyecto`, `updateProyecto`, `deleteProyecto`, `createLogro`, `createHito`, `updateHito`, `deleteHito` y `getTimeline`. Mover sus imports en `routes/index.js` y sacarlas de `gestionController.js`.
- [ ] **Step 5:** Correr los dos archivos (PASS) y `npm test` completo (0 fallos; `metricas-api.test.js` del Informe anual sigue igual).
- [ ] **Step 6:** Commit: `feat: proyectos, hitos y logros en su controlador, con validaciones, transacciones y fechas como texto`.

### Task 4: Los archivos: subida segura, descarga para todos y borrado

**Files:**
- Modify: `config/upload.js`, `controllers/proyectosController.js`, `routes/index.js`, `controllers/gestionController.js` (salen las funciones de archivos)
- Test: `tests/proyectos-api.test.js` (`describe('archivos')`), `tests/permisos.test.js`

**Interfaces:**
- Consumes: `idPositivo`, `nombreOriginal` y `evidenciaTipo` (Task 2).
- Produces, desde `config/upload.js`:
  - `EXTENSIONES_PERMITIDAS` (arreglo, el orden de hoy), `MIMES_PERMITIDOS`, `TAMANO_MAXIMO = 10 * 1024 * 1024`, `MAXIMO_POR_HITO = 3`, `MAXIMO_POR_PROYECTO = 10`;
  - `UPLOADS_BASE` = `process.env.UPLOADS_DIR`, o `uploads/` si no está;
  - `rutaSegura(relativa) → string | null`: compara con `path.sep` al final;
  - `subida(tipo)`, con `tipo` `'proyecto'` o `'hito'`: el middleware de multer, armado en cada pedido.
- Produces, desde el controlador: `prepararSubidaProyecto` y `prepararSubidaHito`, los middlewares que van antes de multer.
- Los mensajes de cantidad: «Podés subir hasta 3 archivos por hito.» y «Podés subir hasta 10 documentos por proyecto.» (en `config/upload.js`, exportados para la paridad). El del archivo faltante: «El archivo no está en el servidor.».

**Cómo funciona:**
- **Las rutas de subida:** `authMiddleware, adminOnly, prepararSubida…, subida(tipo), handler`.
  - `prepararSubida…` valida el id con `idPositivo` (404 si no) y que el proyecto activo o el hito existan (404).
  - Calcula los lugares que quedan: 400 con el mensaje de cantidad si no queda ninguno.
  - Deja `req.subida = { id, carpeta: 'proyectos/<id>' | 'hitos/<id>', lugares }`.
- **`subida(tipo)`** arma multer con `limits: { fileSize: TAMANO_MAXIMO, files: req.subida.lugares }` y el destino `ensureUploadDir(req.subida.carpeta)`.
  - En `filename`, pasa `file.originalname` por `nombreOriginal`.
  - `LIMIT_FILE_COUNT` y `LIMIT_UNEXPECTED_FILE` dan el mensaje de cantidad; multer borra lo que escribió.
- **El handler** hace los INSERT en una transacción (los documentos, con `ruta_archivo` = la ruta relativa). Si falla, borra los archivos escritos y responde 500. Al terminar actualiza `evidencia_tipo` del hito.
- **Borrar un archivo** actualiza `evidencia_tipo`.
- **Borrar un hito** borra sus archivos del disco después del commit. Un error del disco se registra y no cambia la respuesta.
- **Las descargas** (`…/documentos/:docId/descargar` y `…/archivos/:archivoId/descargar`) pasan a `authMiddleware` sin `adminOnly`.
  - Validan los dos ids.
  - Usan `rutaSegura`.
  - Si el archivo no está en el disco, responden 404 con el mensaje.
  - `res.download` lleva el nombre original.

- [ ] **Step 1: Write the failing tests** (el servidor de prueba arranca con `UPLOADS_DIR` en una carpeta temporal; las subidas usan `fetch` con `FormData` y `File`):
  - subir 2 PDF a un proyecto da 200 y dos filas, con `ruta_archivo` no vacía y los archivos en `<tmp>/proyectos/<id>/`;
  - «presentación final.pdf» queda con ese `nombre_archivo` y se descarga con ese nombre (`Content-Disposition` con `filename*`);
  - el lector descarga un documento y un archivo de hito: 200 y los mismos bytes;
  - el lector recibe 403 al subir y al borrar;
  - subir a un proyecto que no existe da 404, sin carpeta `<tmp>/proyectos/999999`;
  - subir a `/gestion/proyectos/..%2F..%2Fescape/documentos` da 404, sin nada fuera de `<tmp>`;
  - un hito con 2 archivos que recibe 2 más da 400 «Podés subir hasta 3 archivos por hito.», y su carpeta sigue con 2;
  - un hito lleno da 400 sin escribir;
  - un `.exe` da 400 «Tipo de archivo no permitido: .exe»;
  - borrar el hito borra su carpeta de archivos;
  - borrar el archivo del disco a mano y descargarlo da 404 «El archivo no está en el servidor.»;
  - subir un archivo a un hito sin enlace lo deja en `evidencia_tipo: 'archivo'`, y borrarlo lo vuelve a `'ninguno'`.
- [ ] **Step 2:** En `tests/permisos.test.js`, sumar las subidas y los borrados de archivos a `RUTAS_SOLO_ADMIN`. Las descargas no van ahí: el lector ya no recibe 403 (lo prueba `proyectos-api`).
- [ ] **Step 3:** Correr. Esperado: FAIL.
- [ ] **Step 4:** Implementar lo de arriba.
- [ ] **Step 5:** Correr (PASS) y `npm test` completo.
- [ ] **Step 6:** Commit: `fix: subidas de proyectos sin archivos huérfanos ni rutas fuera de uploads, descargas para todos los roles y nombres con tildes`.

### Task 5: La página, parte 1: `proyectos.html` y la pestaña Proyectos (carriles)

**Files:**
- Create: `public/proyectos.html`
- Create: `public/js/proyectos.js` (por ahora, lo puro de los carriles y los filtros)
- Test: `tests/proyectos-frontend.test.js` (nuevo, en un `vm`, como `tests/seguimiento-frontend.test.js`: `api.js` de verdad para `Utils`, `getIconSvg` y `ICON_SELECTOR_MAP` copiados de `main.js` en el contexto), `tests/paginas.test.js`

**`proyectos.html`:**
- La carcasa copiada de `index.html`, tal cual la tenga main: con el link de Gestión todavía. El menú lo cambia la Task 9 en todas a la vez.
- `<title>Proyectos - RPAD</title>` y la meta description.
- El `<style>` con los tokens `--sg-*` y las piezas de la maqueta (`.pr-*`), sin `publico.css`.
- La estructura de la maqueta: el `h1`, «Nuevo proyecto» `hidden`, la bajada, el aviso `#pr-aviso-metricas` `hidden`, `#message-container`, las tres pestañas y sus paneles, `#pr-vista-detalle`, los estados `#pr-cargando` (`role="status"`) y `#pr-error` (`role="alert"`), y el `<noscript>`.
- Los modales los agrega la Task 7.
- Los scripts: `config.js`, `auth`, `main` y `api` con `?v=VERSION` (`'20261204'`), y `proyectos.js?v=VERSION_PROYECTOS` (`'20261206'`: el siguiente al más alto de `tests/paginas.test.js`, el `'20261205'` de `VERSION_PANTALLAS` y `VERSION_AREAS`; Ruling R2).

**Interfaces** (`proyectos.js`, globales del script):
- **Constantes:** `TEXTO_ESTADO`, `TEXTO_ESTADO_PLURAL`, `ORDEN_ESTADOS`, `TEXTO_CATEGORIA`, `TEXTO_PRIORIDAD` y `ANIOS_VENTANA = 3`.
- **El estado de la dirección:**
  - `estadoDeLaUrl(search, hoy) → { busqueda, estado, categoria, anios, resaltar }`, con los de entrada `''`, `'todos'`, `'todas'`, el año de hoy y `null`;
  - `urlDeEstado(estado, hoy) → string`: solo escribe lo que no es de entrada, en el orden `estado, categoria, busqueda, anios, resaltar`.
- **La ventana:**
  - `extremosDeAnios(proyectos, hitos, hoy) → { min, max }`: el año más viejo de las fechas de elevación y los hitos; el más nuevo entre hoy y el último hito;
  - `ventanaDe(fin, extremos) → { desde, hasta, anterior, siguiente }`: `fin` queda entre `min(extremos.min + 2, extremos.max)` y `extremos.max`.
- **Los filtros:**
  - `filtrarProyectos(proyectos, estado) → proyecto[]`: busca sin tildes ni mayúsculas en el nombre, la descripción y el responsable;
  - `cantidadesDeFiltros(proyectos, estado) → { estado: { todos, en_curso, … }, categoria: { todas, … } }`: cada grupo cuenta con los otros filtros;
  - `ordenarProyectos(proyectos, hitos, hoy) → proyecto[]`: por estado, el último hito cumplido descendente y el nombre.
- **Los puntos:** `puntosDelCarril(hitos, { desde, hasta, hoy, anchoPx }) → { puntos: [{ x, cantidad, futuro, titulos }], antes, despues, tramo: { x1, x2 } | null }`.
  - `x` va en % de la pista.
  - Junta los puntos a menos de `15 / anchoPx * 100`.
  - Un grupo es `futuro` solo si todos sus hitos lo son.
- **La frase del año:** `fraseDelAnio(anio, hitos) → string`, el texto de la spec, 2.3.
- **El HTML:**
  - `htmlDeFiltros(estado, cantidades, ventana) → string`;
  - `htmlDeCarriles(proyectos, hitos, { estado, hoy, anchoPx, esAdmin }) → string`, con el renglón de los logros al final, la leyenda y los vacíos de la spec, 2.5.

- [ ] **Step 1: Write the failing tests** (datos inventados y los 8 proyectos y 14 hitos de `docs/superpowers/specs/2026-10-25-proyectos-mockups/js/maqueta-datos.js` como casos):
  - `ventanaDe(2026, { min: 2021, max: 2026 })` da `{ desde: 2024, hasta: 2026, anterior: true, siguiente: false }`;
  - `ventanaDe(2019, …)` queda en 2023 (`desde: 2021`, `anterior: false`);
  - con `{ min: 2025, max: 2026 }` las dos flechas son false;
  - `puntosDelCarril` del Índice (5 hitos de 2021 a 2025) con la ventana 2024 a 2026 da `antes: 3` y 2 puntos;
  - los hitos del 30/11/2025 y el 10/12/2025, con `anchoPx: 600`, quedan en 1 punto con `cantidad: 2` y dos títulos; con `anchoPx: 4000`, en 2;
  - `tramo` no sale de 0 a 100;
  - `fraseDelAnio('2025', hitos)` con 6 hitos de 4 proyectos y 1 logro da el texto exacto; sin logros termina en «de 4 proyectos.»;
  - `estadoDeLaUrl('?estado=x&anios=abc', '2026-10-25')` da los de entrada;
  - `urlDeEstado` de los de entrada da `''`; con `estado: 'en_curso'` y `resaltar: '2025'` da `'?estado=en_curso&resaltar=2025'`;
  - `filtrarProyectos` con `busqueda: 'INDICE'` encuentra «Índice…»;
  - `cantidadesDeFiltros` con categoría Difusión elegida cuenta los estados solo de Difusión;
  - el orden de la maqueta: en curso primero y, dentro, el del último hito más nuevo;
  - `htmlDeCarriles`: un link `href="?id=7"` (con el estado de la dirección) por proyecto; la píldora «3 antes» con `title="3 hitos antes de 2024"`; «Sin hitos todavía»; el renglón «Logros del área»; un nombre `<img src=x onerror=alert(1)>` sale escapado (en el texto y en el `title`); el nombre lleva la clase que hace `overflow-wrap: anywhere`;
  - el vacío por filtros con «Ver todos los proyectos»; sin ningún proyecto, para el lector «Todavía no hay proyectos.» sin la invitación, y para administración, con ella;
  - en `paginas.test.js`, sumar `const VERSION_PROYECTOS = '20261206'` (con su comentario, como las demás) y `['proyectos.html', 'proyectos', VERSION_PROYECTOS]` al arreglo de los scripts «después de api.js» (hoy termina en `['notas.html', 'notas', VERSION_NOTAS]`);
  - en `paginas.test.js`, `it('hay 13 páginas con carcasa')` pasa a 14 mientras conviven `gestion.html` y `proyectos.html`, con su comentario al día (líneas 376-377; la Task 9 lo vuelve a 13). Los tests que recorren las páginas con carcasa ya cubren `proyectos.html`: la carcasa igual a la de `index.html`, `main.css` y las fuentes, los destinos del menú (todavía con `gestion.html`), sin `aria-current`, sin `publico.css`, nada de afuera y `auth`, `main` y `api` con `VERSION`.
- [ ] **Step 2:** Correr `node --test tests/proyectos-frontend.test.js tests/paginas.test.js`. Esperado: FAIL.
- [ ] **Step 3:** Implementar las funciones en `proyectos.js` (al cargarse solo declara) y `proyectos.html`.
- [ ] **Step 4:** Correr (PASS) y `npm test` completo.
- [ ] **Step 5:** Commit: `feat: proyectos.html con los carriles de 3 años, los filtros y el año resaltado (lo puro)`.

### Task 6: La página, parte 2: el detalle con la cinta, la línea de tiempo y los logros

**Files:**
- Modify: `public/js/proyectos.js`, `public/proyectos.html` (estilos de la ficha, la cinta y las filas, si faltan)
- Test: `tests/proyectos-frontend.test.js`

**Interfaces:**
- `textoDelEnlace(url) → 'Abrir en GitHub' | 'Abrir el borrador' | 'Abrir el enlace' | null`: `null` si no es http o https.
- `htmlDeFicha(proyecto, { esAdmin }) → string`: el título, las insignias, la descripción, las acciones y la fila de datos, con «—» en los vacíos.
- `cintaDelProyecto(proyecto, hoy) → { desde, hasta, meses, anios: [{ anio, x }], banda: { x1, x2, x3 }, hoyX, eventos: [{ x, fecha, tipo: 'hecho' | 'futuro' | 'elev', texto, fila: 0 | 1 | 2 | null, xTexto }] } | null`.
  - Espacio de 1000, de x = 30 a x = 970.
  - Los años, como en la spec, sección 3.
  - Las etiquetas, cortadas a 34 caracteres con «…», con 6,3 unidades por letra, en hasta 3 filas sin pisarse (con 10 de aire). `fila: null` si no entra.
  - Da `null` sin hitos ni fecha de elevación.
- `svgDeCinta(cinta, titulo) → string`: la leyenda y, si `cinta` es null, el texto de la spec.
- `htmlDeHito(hito, { conProyecto, proyecto, esAdmin, hoy }) → string`: la fila que se despliega, con `aria-expanded` y `aria-controls`.
- `htmlDeArchivos(archivos, { esAdmin, base })`: cada uno con Ver (solo `image/*` y `application/pdf`), Descargar y Eliminar (solo administración), con `data-*` para la parte del DOM.
- `htmlDeDocumentos(proyecto, { esAdmin })`.
- `htmlDeDetalle(proyecto, { esAdmin, hoy }) → string`: el link de vuelta, la ficha, el Recorrido y las dos columnas.
- `htmlDeLinea(hitos, { filtro, hoy, esAdmin }) → string`: los chips y los años con sus filas.
- `htmlDeLogros(hitos, { esAdmin, hoy }) → string`.

- [ ] **Step 1: Write the failing tests:**
  - `textoDelEnlace` con github, docs.google, drive.google, otra web y `javascript:`;
  - la ficha del lector sin «Editar el proyecto» ni «Eliminar» y con «Abrir en GitHub»; la de administración, con los tres; «—» sin fecha de elevación;
  - `cintaDelProyecto` del Índice: `desde: 2021`, `hasta: 2026`, `meses: false`, 6 eventos (5 hitos más la elevación), toda `x` entre 30 y 970;
  - ninguna etiqueta con `fila` no nula se pisa con otra de su fila;
  - un hito futuro da `tipo: 'futuro'`;
  - un proyecto de un solo año da `hasta - desde === 1` y `meses: true`;
  - sin eventos da `null`, y `svgDeCinta(null)` da el texto de la spec;
  - `htmlDeHito` con fecha futura lleva «Previsto»;
  - la evidencia `javascript:` no se dibuja;
  - el lector ve «Descargar» y no «Eliminar»; «Ver» solo en PDF e imágenes;
  - un título `<script>` sale escapado en la fila y en la cinta;
  - `htmlDeLinea` agrupa por año del más nuevo al más viejo, con «N hitos, hasta hoy y lo previsto» en el año de hoy; el filtro «Logros del área» deja solo los sin proyecto;
  - los vacíos de la spec (sin hitos, sin documentos, sin logros, sin hitos con el filtro).
- [ ] **Step 2:** Correr. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr (PASS) y `npm test` completo.
- [ ] **Step 5:** Commit: `feat: el detalle de un proyecto con la cinta del recorrido, la línea de tiempo y los logros (lo puro)`.

### Task 7: Formularios, archivos y confirmaciones (lo puro y el HTML de los modales)

**Files:**
- Modify: `public/proyectos.html` (cuatro modales: `#modal-proyecto`, `#modal-hito`, `#modal-confirmar` y `#modal-vista-previa`, con el `<form>` como columna flexible), `public/js/proyectos.js`
- Test: `tests/proyectos-frontend.test.js`

**Interfaces:**
- **Copias, atadas por paridad:**
  - `MENSAJES_PROYECTOS`, `LARGOS_PROYECTOS` y `FECHA_MINIMA_PROYECTOS`, de `services/proyectosReglas.js`;
  - `EXTENSIONES_PERMITIDAS`, `TAMANO_MAXIMO`, `MAXIMO_POR_HITO`, `MAXIMO_POR_PROYECTO` y los dos mensajes de cantidad, de `config/upload.js`;
  - `ESTADOS`, `PRIORIDADES`, `CATEGORIAS` e `ICONOS`.
- `PALETA`: los 10 de Global Constraints.
- `erroresDelProyecto(valores, hoy) → [{ campo, mensaje }]` y `erroresDelHito(valores, hoy) → [{ campo, mensaje }]`: los mismos resultados que `validarProyecto` y `validarHito` en los casos de borde.
- `problemaDeArchivo({ name, size }, { tipo: 'hito' | 'proyecto', existentes: string[], elegidos: string[] }) → string | null`. Controla la extensión, el tamaño, la cantidad (existentes + elegidos) y los repetidos, con «Ya hay un archivo llamado <nombre>.».
- `htmlDeColores(actual) → string`: si `actual` no está en `PALETA`, va primero como «Color actual», elegido.
- `htmlDeIconos(actual) → string`.
- `valoresDelProyecto(proyecto | null) → objeto` y `valoresDelHito(hito | null, hoy) → objeto`: lo que precarga cada formulario. La fecha por defecto es `hoy`.
- `textoDeConfirmacion(tipo: 'proyecto' | 'hito' | 'logro' | 'archivo', datos) → string`, textos exactos (los de la spec, sección 6, con la concordancia resuelta):
  - **proyecto:** «¿Eliminar el proyecto X? Deja de verse en la lista, en la línea de tiempo y en el Informe anual», seguido de:
    - con hitos y documentos: «, con 5 hitos y 2 documentos.»;
    - si falta uno de los dos, solo el otro: «, con 5 hitos.» o «, con 1 documento.»;
    - sin ninguno: «.».
  - **hito y logro:** «¿Eliminar el hito X?» o «¿Eliminar el logro X?», con « Se borra también su archivo.» (1 archivo) o « Se borran también sus N archivos.» (más de uno), y sin nada más si no tiene.
  - **archivo:** «¿Eliminar X?».

- [ ] **Step 1: Write the failing tests:**
  - paridad: los mensajes, los largos y la fecha mínima, contra `services/proyectosReglas.js` (importado); las constantes de archivos, contra `config/upload.js` (importado);
  - `erroresDelProyecto` y `validarProyecto` dan los mismos errores en: nombre vacío, 200 y 201 caracteres (con tildes y emojis, contados con `Array.from`), fecha `'2026-02-29'`, enlace `ftp://x` y color `#ABCDEF`;
  - lo mismo con `erroresDelHito` y `validarHito`;
  - `problemaDeArchivo`: `.exe`, 10 MB + 1 byte, el cuarto archivo de un hito, el undécimo documento y un nombre repetido;
  - `htmlDeColores('#6CA3C6')` empieza con «Color actual» elegido; `htmlDeColores('#3B82F6')` no lo tiene y elige Azul;
  - `textoDeConfirmacion`: proyecto con 5 hitos y 2 documentos; con 1 hito y 0 documentos («…, con 1 hito.»); sin ninguno; hito con 0, 1 y 3 archivos; logro; archivo. Cada uno con el texto exacto;
  - en `proyectos.html`: los cuatro modales con `role="dialog"`, `aria-modal="true"` y `aria-labelledby`; cada `<label for>` apunta a un id que existe; el CSS de `.pr-form` tiene `display: flex`, `flex-direction: column` y `min-height: 0`.
- [ ] **Step 2:** Correr. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr (PASS) y `npm test` completo.
- [ ] **Step 5:** Commit: `feat: formularios de proyecto, hito y logro, archivos y confirmaciones en Proyectos (lo puro y los modales)`.

### Task 8: La página, parte 3: el DOM y la API

**Files:**
- Modify: `public/js/proyectos.js` (la sección final, la que toca el DOM y la API)
- Test: `tests/proyectos-frontend.test.js` (con un DOM falso mínimo y un `fetch` falso)

**Interfaces:**
- Consumes: todo lo puro de las Tasks 5 a 7; `API.pedirJson` y `API.pedirArchivo`; `Auth`; `Utils.showSuccess` y `Utils.showError`.
- Produces: `iniciarProyectos()`, enganchado a `DOMContentLoaded`. No lo hace al cargarse, para que el `vm` lo cargue sin efectos.
  - Lo enganchan `document.addEventListener` y el chequeo de sesión: sin sesión, va a `login.html`.

**Qué hace:**
- **Carga:** pide `/gestion/proyectos` y `/gestion/timeline` en paralelo. Muestra cargando y después la vista, o el error.
- **El detalle:** con `?id=N`, pide `/gestion/proyectos/N`. Un 404 o un id inválido muestran «Proyecto no encontrado».
- **Pestañas:** con el hash, las flechas, Inicio y Fin.
- **`#metricas`:** muestra el aviso y abre Proyectos.
- **Filtros, flechas y resaltado:** redibujan y escriben la dirección con `history.replaceState(urlDeEstado(...))`. El foco se conserva en el control usado.
- **El ancho de la pista:** `anchoPx` sale de la primera `.pr-pista`, medida en el DOM, y se recalcula con un `ResizeObserver`.
- **Las filas:** se despliegan.
- **Los modales:** se abren y se cierran con Escape, la ×, Cancelar o el velo (si el clic empezó ahí). El foco va al primer campo y vuelve al botón que los abrió. Los errores van al campo, con `aria-invalid` y `aria-describedby`, y sin campo, dentro del modal.
- **Guardar** deshabilita el botón hasta la respuesta.
- **Subir:** con `fetch` + `FormData` + `Auth.getAuthHeaders()` sin `Content-Type`. Si el hito se guardó y la subida falló, el modal queda abierto con «El hito se guardó, pero los archivos no se subieron: <motivo>.» y deja reintentar.
- **Descargar:** con `API.pedirArchivo` + `descargarBlob` (propia).
- **Vista previa:** con un `blob:` en `#modal-vista-previa`, que libera la URL al cerrar.
- **Confirmar** con `#modal-confirmar` y, al terminar, volver a pedir la vista.

- [ ] **Step 1: Write the failing tests** (un `document` falso con `getElementById` y `querySelector` sobre un registro de elementos, y un `fetch` falso que registra los pedidos):
  - `iniciarProyectos()` pone en las pestañas las cantidades (8 proyectos, todos los hitos y los logros) con los datos de la maqueta;
  - con `?id=7`, el título de la ventana es «<nombre> - Proyectos - RPAD»;
  - `iniciarProyectos()` con `location.search = '?id=abc'` muestra el no encontrado sin pedir el detalle;
  - con `#metricas`, el aviso queda visible;
  - guardar un proyecto dos veces seguidas, con un `fetch` que tarda, hace un solo `POST /api/gestion/proyectos`;
  - un `POST` de hito que responde 200 y una subida que responde 400 dejan el modal abierto con el texto exacto, y no muestran el aviso de guardado;
  - un 400 con `campo: 'nombre'` pone `aria-invalid="true"` en `#p-nombre`.
- [ ] **Step 2:** Correr. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr (PASS) y `npm test` completo.
- [ ] **Step 5:** Levantar la rama contra `rpad_rama_proyectos` (lanzador en el puerto 3013, `UPLOADS_DIR` en una carpeta del scratchpad) y mirar `proyectos.html` con un admin y un lector, con la sesión armada con un token local, sin escribir contraseñas. Sin errores en la consola.
- [ ] **Step 6:** Commit: `feat: Proyectos carga, filtra, abre el detalle y guarda, sube, baja y borra desde la página`.

### Task 9: El renombre: redirección, menú, archivos viejos y textos

**Files:**
- Modify: `app.js` (antes de `express.static`, debajo de las dos redirecciones de Configuración, que están en las líneas 55 a 60 con su comentario —`app.get('/usuarios.html', (req, res) => res.redirect(302, '/configuracion.html'));` y la de `areas.html`— y antes de `app.use(express.static(…))`, línea 63: `app.get('/gestion.html', (req, res) => res.redirect(302, '/proyectos.html'));`, con un comentario que cite la spec, sección 11)
- Modify: las 12 páginas con `id="sidebar"` que quedan (admin, calendario, configuracion, contacto, correos, dataset, datasets, index, notas, perfil, reportes y seguimiento) y `proyectos.html`; `gestion.html` se borra, así que siguen 13. En `#sidebarTools`, el tercer link (en `index.html`, línea 82: `<a href="gestion.html" class="sidebar-link">`, el ícono de barras `M3 3v18h18` y `<span>Gestión</span>`) pasa a `href="proyectos.html"`, el texto «Proyectos» y el `folder-kanban`. El `h1` de `proyectos.html` también.
- Delete: `public/gestion.html`, `public/js/gestion.js`
- Modify: `services/reportesInformeAnualPdf.js` (`deDondeSalenLosLogros`, línea 37: «Los hitos de ${anio} cargados en Proyectos», y los comentarios de las líneas 8, 25 —que nombra `public/js/gestion.js`— y 160), `public/js/reportes.js` (la tarjeta del Informe anual, línea 1060: «(los hitos de Herramientas → Proyectos)», y el comentario de la línea 776, «vienen de gestion.js», que pasa a decir que se mudaron de Gestión) + `public/reportes.html` (línea 601, `js/reportes.js?v=20261203`: `VERSION_REPORTES` pasa a `'20261206'`), `public/js/usuarios.js` (`AYUDA_DEL_ROL.lector`, línea 13: «Ve los datos públicos y usa las Herramientas (Métricas y Reportes, Gestión y Seguimiento). No modifica nada.» pasa a «… (Métricas y Reportes, Proyectos y Seguimiento) …»; la del colaborador no nombra Gestión y no cambia) + su página, `configuracion.html` (línea 658, `js/usuarios.js?v=20261205`: `VERSION_PANTALLAS` pasa a `'20261206'`)
- Test: `tests/paginas.test.js`, `tests/reportes-pdf.test.js`, `tests/reportes-frontend.test.js`, `tests/usuarios-frontend.test.js` y el test de la redirección, en `tests/proyectos-api.test.js`, `describe('la dirección vieja')`, con las tres comprobaciones de `describe('las direcciones viejas')` de `tests/areas-api.test.js`, donde Configuración puso las suyas

- [ ] **Step 1: Write the failing tests:**
  - `GET /gestion.html` con `redirect: 'manual'` da 302, `location: '/proyectos.html'` y un cuerpo sin `<!DOCTYPE html>` (no sirve la página vieja);
  - en `paginas.test.js`:
    - los destinos del menú tienen `proyectos.html` en lugar de `gestion.html`;
    - un test nuevo: `public/gestion.html` y `public/js/gestion.js` no existen;
    - se reemplazan los tres tests de `gestion.html`: versión, Chart.js y aviso de la mudanza;
    - test nuevo: `proyectos.html` tiene el aviso `#pr-aviso-metricas` con el link a `reportes.html#metricas`, `hidden`, y no carga Chart.js;
    - `VERSION_GESTION` sale;
    - `it('hay 13 páginas con carcasa')` vuelve a 13 (la Task 5 lo pasó a 14), con su comentario al día;
    - `VERSION_REPORTES` (`'20261203'`) y `VERSION_PANTALLAS` (`'20261205'`) pasan a `'20261206'`, con su comentario; `VERSION_PANTALLAS` la usan también el test de `usuarios.js` y la lista completa de los scripts de `configuracion.html`;
  - `reportes-pdf.test.js` (línea 1814): «Los hitos de 2026 cargados en Proyectos»;
  - `reportes-frontend.test.js` (línea 985): «(los hitos de Herramientas → Proyectos)»;
  - `usuarios-frontend.test.js` (línea 648): la ayuda del lector con «Proyectos» y sin «Gestión».
- [ ] **Step 2:** Correr. Esperado: FAIL.
- [ ] **Step 3:** Implementar. El menú, con un script que reemplace el `<a href="gestion.html" …>…</a>` exacto de `index.html` en cada página. Después, `normalizarPieza` de `paginas.test.js` compara las páginas con `index.html`.
- [ ] **Step 4:** Correr (PASS) y `npm test` completo. Además, `grep -rn "gestion\.html\|gestion\.js" public services controllers app.js routes` no da nada, salvo la redirección de `app.js` y el comentario de `public/js/api.js` (línea 536, «gestion.js tiene MESES»), que queda: `api.js` no cambia.
- [ ] **Step 5:** Commit: `feat: Gestión pasa a llamarse Proyectos en todo el sitio (menú, redirección de gestion.html y textos)`.

### Task 10: La documentación

**Files:**
- Modify: `CLAUDE.md` y `README.md`

- [ ] **Step 1:** Actualizar `CLAUDE.md`:
  - la estructura (`proyectosController`, `proyectosReglas`);
  - la lista de las páginas con carcasa (`proyectos` en lugar de `gestion`);
  - la convención de `proyectos.js` («al cargarse solo declara», sus copias mínimas y sus paridades), con el estilo de las de `seguimiento.js` y `reportes.js`;
  - el lector: solo «Gestión» pasa a «Proyectos» («Métricas y Reportes, Proyectos y Seguimiento»; sigue sin Notas, desde el Generador);
  - «hitos de Herramientas → Proyectos»;
  - el párrafo de Gestión de Métricas y Reportes;
  - una sección corta «Proyectos (spec 2026-10-25-proyectos)»: carriles de 3 años, la cinta, las descargas para todos los roles, la redirección y `UPLOADS_DIR` para los tests.
- [ ] **Step 2:** Actualizar `README.md`: los roles, el árbol (`proyectos.html`, `proyectos.js`, `proyectosController.js`, `proyectosReglas.js`) y la entrada del Changelog.
- [ ] **Step 3:** `npm test` completo (los tests que leen `CLAUDE.md` o `README.md`, si hay) y commit: `docs: Proyectos en CLAUDE.md y README`.

### Task 11: Revisión final, recorrido en el navegador y kit

- [ ] **Step 1:** Revisión de toda la rama con un revisor Opus fresco (spec + plan + `git diff main...feat/proyectos`). Corregir los hallazgos críticos e importantes, con un subagente Opus y la revisión de cada arreglo.
- [ ] **Step 2: Recorrido en el navegador.** La rama contra `rpad_rama_proyectos`, con `UPLOADS_DIR` en el scratchpad y con admin, lector y colaborador:
  - los carriles: las flechas, «3 antes», el resaltado y su frase, los filtros, y volver de un proyecto con los filtros puestos;
  - el detalle con la cinta;
  - crear, editar y borrar un proyecto, un hito y un logro;
  - subir, ver, bajar y borrar archivos, uno de ellos con tildes;
  - la línea de tiempo y los logros;
  - `gestion.html` y `gestion.html#metricas`;
  - el teléfono (375 px) y el teclado (las pestañas, los modales y las filas);
  - la consola, sin errores.
  - Capturas para el usuario.
- [ ] **Step 3:** `npm test` completo. Esperado: 0 fallos.
- [ ] **Step 4: El kit** `Escritorio\RPAD-deploy-proyectos`, con la estructura de los kits anteriores:
  - los archivos que cambian, con sus carpetas, sacados de `git diff --name-only main...feat/proyectos` sin `docs/` ni `tests/`;
  - `PASOS.txt`: sin SQL; va después de los kits de Métricas, del Generador y de Configuración; subir los archivos, Restart, borrar `public/gestion.html` y `public/js/gestion.js` del servidor y no tocar `uploads/`;
  - la lista de lo que hay que probar en producción.
- [ ] **Step 5:** Pedirle al usuario, con AskUserQuestion, el OK para el merge a main y el push. Solo con su OK:
  - `git merge --no-ff feat/proyectos` en main;
  - `npm test` completo sobre main;
  - `git push`.
- [ ] **Step 6:** Limpiar el worktree:
  - quitar el junction de `node_modules` con `cmd //c "rmdir node_modules"` dentro del worktree;
  - comprobar que ya no existe;
  - `git worktree remove`;
  - comprobar que `C:\git\rpad\node_modules` sigue entero.
- [ ] **Step 7:** Actualizar la memoria (`proyectos.md`) y la nota de la carpeta compartida con el hash del merge.
- [ ] **Step 8:** Avisarle con el hash del merge, por `SendMessage`, a la sesión que va después en la cola: «Ciclo de Vida del Dato» (`local_8b509d51-747e-43e4-a743-4fcf82eb590a`, rama `claude/ciclo-de-vida-del-dato-aba0d0`). Se cruzan en `VERSION_REPORTES` y el `?v=` de `reportes.js`, `tests/permisos.test.js`, `tests/reportes-frontend.test.js`, `CLAUDE.md` y `README.md`. El mensaje dice también que la sesión que mergee segunda toma para `reportes.js` (`VERSION_REPORTES`) un `?v=` más alto que cualquiera que ya esté en main: así el mismo número nunca sale dos veces con contenido distinto (Ruling R6).

## Diferencias encontradas

Task 1, 25/10/2026: main trae el Generador de Notas (c26e0e8) y Configuración (2e48142). Se trajo a la rama en bf6c784, sin conflictos. La base `rpad_rama_proyectos` se rehízo desde `datospublicos_mcr_rpad`: 29 tablas, con `areas.ambito`. Lo que cambió respecto de lo que daba por hecho este plan, ya corregido en las tareas:

1. **Páginas con carcasa:** son 13. Configuración reemplazó a `usuarios.html` y `areas.html` por `configuracion.html`, y `tests/paginas.test.js` lo fija con `it('hay 13 páginas con carcasa')`. La Task 5 lo pasa a 14 y la Task 9 lo vuelve a 13.
2. **Versiones** (`tests/paginas.test.js`):
   - `VERSION` (auth, main y api), `VERSION_CORREOS` y `VERSION_NOTAS`: `20261204`;
   - `VERSION_PANTALLAS` (`usuarios.js`, que ahora carga `configuracion.html`) y `VERSION_AREAS`: `20261205`, las más altas;
   - `VERSION_REPORTES`: `20261203`; `VERSION_GESTION` y `VERSION_SEGUIMIENTO`: `20261129`.
   - `VERSION_PROYECTOS` es `'20261206'` (Ruling R2). La Task 9 sube al mismo valor `VERSION_REPORTES` y `VERSION_PANTALLAS`.
3. **La ayuda del lector** (`usuarios.js`, línea 13) nombra «Gestión»; la del colaborador no. Su página es `configuracion.html` (línea 658, `?v=20261205`).
4. **Las redirecciones de Configuración** (`app.js`, líneas 55 a 60): `app.get('/usuarios.html', …)` y `app.get('/areas.html', …)` con `res.redirect(302, …)`, antes de `express.static` (línea 63). Su test está en `tests/areas-api.test.js`, `describe('las direcciones viejas')`.
5. **`tests/permisos.test.js`:** `RUTAS_SOLO_ADMIN` conserva su nombre. La lista de GET del colaborador no tiene ninguna ruta de `/gestion` (Task 3).
6. **Sin cambios:**
   - la sección «Gestión» de `routes/index.js` (líneas 296 a 333; los imports de `gestionController.js`, 94 a 116, y el de `config/upload.js`, 120);
   - `controllers/gestionController.js` y `config/upload.js`;
   - `public/gestion.html`, salvo el menú de Administración y el `?v=` de los scripts compartidos;
   - `ICON_SELECTOR_MAP` (25 claves) y el link de Gestión de `#sidebarTools`.
7. **El grep de la Task 9** encuentra también tres comentarios que ya estaban: el de `public/js/api.js:536`, que no se toca porque `api.js` no cambia, y los de `public/js/reportes.js:776` y `services/reportesInformeAnualPdf.js:25`, que la Task 9 corrige.

Base: `npm test` da 4384 tests, 4379 pasan, 0 fallan y 5 se omiten (hoy no es día hábil).
