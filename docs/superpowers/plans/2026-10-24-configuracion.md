# Configuración (Usuarios, Licencias y Áreas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **APROBADO por el usuario el 24/10/2026. EN COLA. Orden del usuario (24/10 a la noche): arranca cuando termina Mejoras de Notas, sin pedir aprobación, después de escanear main y actualizar el plan si algo cambió; al terminar, kit, merge y push (autorizados; no desplegar). No empezar hasta que estén en main las tres ramas:** "Métricas y Reportes" (`feat/metricas-y-reportes`), el Generador de Notas (`feat/generador-de-notas`) y "Notas Digitales en hoja oficio" (`feat/notas-hoja-oficio`). La Task 1 lo comprueba, trae main y relee el código. Si algo cambió respecto de lo que dice este plan, se ajusta el plan y se le avisa al usuario **antes** de la Task 2.

**Goal:** Fusionar `usuarios.html` y `areas.html` en `configuracion.html` (pestañas Usuarios | Licencias | Áreas), rediseñar la pestaña Áreas con el modal arreglado, actualizar el menú de las páginas y sacar los datos de contacto de las APIs públicas, sin perder nada de lo que hacen hoy.

**Architecture:**
- **Usuarios y Licencias:** `usuarios.html` pasa a ser `configuracion.html` (`git mv`) y suma la pestaña Áreas. `usuarios.js` aprende la tercera pestaña y el fragmento de la dirección.
- **Áreas:** `areas.js` se reescribe para la pestaña. Lo puro va primero y lo del DOM al final, y al cargarse solo declara.
- **Servidor:**
  - Las reglas de un área van en un servicio puro nuevo, `services/areasReglas.js`.
  - Una sesión opcional (`sesionOpcional`, `middleware/auth.js`) decide quién ve los datos de contacto en `GET /api/areas` y `GET /api/datasets`.
  - `app.js` redirige las URLs viejas.

**Tech Stack:** Node 22, Express 4, MariaDB (mysql2/promise), HTML y JS sin frameworks, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-24-configuracion-design.md`. La maqueta, en `docs/superpowers/specs/2026-10-24-configuracion-mockups/` (`configuracion.html`, `js/areas.js`, `js/maqueta-servidor.js`), es la referencia visual. La spec manda sobre la maqueta.

## Global Constraints

- **Rama:** `feat/configuracion`, worktree `.claude/worktrees/configuracion`. Nada se escribe en main. El merge y el push, solo con el OK del usuario.
- **Subagentes:** todos con Opus (implementador, revisor y correcciones), por pedido del usuario.
- **Suite completa** (`npm test`) antes y después de cada tarea. Antes de correrla, comprobar que ninguna otra sesión la esté corriendo:
  - `SHOW DATABASES LIKE 'rpad_test%'` tiene que dar vacío o solo bases viejas sin procesos (`SHOW PROCESSLIST`);
  - los tests de integración usan bases con nombre fijo y se pisan.
- **Base de la rama:** `rpad_rama_configuracion`, una copia de `datospublicos_mcr_rpad`. Nunca escribir en la compartida ni recargarla. Ningún email real: SMTP a Mailpit. Nunca llamar a `/api/cron/*`.
- **Sin nombres de personas** en archivos versionados: fixtures con nombres inventados.
- **Scripts:** cada `<script src="js/X.js?v=…"></script>` va sin atributos, y el script que cambia sube su `?v=`. `config.js` va sin versión. `auth.js`, `main.js` y `api.js` no cambian en esta entrega, así que `VERSION` no sube; `main.css` tampoco, así que `VERSION_CSS` no sube.
- **Frontend:** todo texto dinámico pasa por `Utils.escapeHtml`; un número va con `String(n)`, nunca `escapeHtml(n)`, que convierte el 0 en vacío. Pide con `API.pedirJson`. **No se toca `api.js`.**
- **Backend:**
  - SQL siempre parametrizado; respuestas `{ success, data?, error?, campo?, message? }`.
  - `x ?? null`, nunca `x || null`, en todo lo que puede ser 0.
- **Archivos:** las páginas de `public/` están en CRLF; se conservan así.
- **Commits:** uno por tarea, en español, terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Worktree:** `node_modules` es un enlace (junction) a `C:\git\rpad\node_modules`. Al cerrar la rama, primero `cmd //c "rmdir node_modules"` y después `git worktree remove`. Comprobar después que el `node_modules` de main sigue entero.

**Textos exactos:**
- Página:
  - `<title>Configuración - RPAD</title>`, `<h1>` "Configuración";
  - pestañas "Usuarios", "Licencias" y "Áreas"; botones "Nuevo usuario" y "Nueva área".
- Menú (Administración, en este orden): "Gestión de Datasets", "Correos", "Configuración".
- Bajada de Áreas: "Los organismos responsables de los datasets. El nombre, el artículo y la dependencia salen así en las notas, y los emails del área reciben el aviso de los 40 días de los datasets de gestión externa."
- Aviso:
  - "N áreas con datasets de gestión externa no tienen email cargado: no les llega el aviso de los 40 días.";
  - con una sola: "1 área con datasets de gestión externa no tiene email cargado: no le llega el aviso de los 40 días.";
  - el botón: "Ver las áreas sin email".
- Tarjeta y lista:
  - "Áreas responsables" y "N áreas" ("1 área");
  - el buscador: "Buscá por nombre, dependencia, email o persona de contacto";
  - los filtros: "Todas", "Municipales", "Fuera del municipio", "Sin email" y "Sin datasets".
- Columnas: "Área y dependencia", "Ámbito", "Emails del área", "Persona de contacto", "Datasets"; el botón "Editar", con `aria-label` "Editar <nombre>".
- Textos de las celdas:
  - "Depende de <artículo> <dependencia>" o "Sin dependencia cargada";
  - las insignias "Municipal" y "Fuera del municipio";
  - "Sin email: no recibe el aviso de los 40 días" o "Sin email";
  - "Sin teléfono ni email", "—" y "Sin nombre".
- Estados:
  - "Ninguna área coincide con lo que buscaste.";
  - "No se pudieron cargar las áreas. Probá de nuevo en unos minutos.";
  - "Tu sesión ya no permite ver las áreas. Volvé a ingresar."
- El modal del área:
  - títulos "Nueva área" y "Editar área";
  - grupos "El área", "Contacto del área" y "Persona de contacto";
  - campos "Nombre", "Depende de", "Así se lee en las notas", "Ámbito", "Email principal", "Email secundario", "Teléfono", "Celular", "Nombre", "Teléfono" y "Email";
  - las opciones de Ámbito: "Municipal" / "La nota de la DGMIT va por la Subsecretaría." y "Fuera del municipio" / "La nota de la DGMIT va directo al organismo.";
  - la ayuda de los emails: "Los dos reciben el aviso de los 40 días de los datasets de gestión externa. Sin ninguno, no le llega.";
  - los botones "Cancelar" y "Guardar área".
- El pie del modal:
  - "Se guarda al confirmar." y el botón "Borrar el área";
  - "Tiene N datasets: para borrarla, primero hay que pasarlos a otra área." ("Tiene 1 dataset: … pasarlo a otra área.");
  - "Un cambio pendiente la usa: para borrarla, primero hay que aprobarlo o rechazarlo." y "N cambios pendientes la usan: para borrarla, primero hay que aprobarlos o rechazarlos.".
- Borrar:
  - título "Borrar área";
  - "¿Borrar el área «X»? No tiene datasets. Se borra del todo y no se puede deshacer.";
  - botones "Cancelar" y "Borrar área".
- Mensajes del servidor (`MENSAJES_AREA`, Task 2):
  - `nombre`: "Escribí el nombre del área."; `nombreLargo`: "El nombre puede tener hasta 200 caracteres."; `nombreRepetido`: "Ya hay un área con ese nombre.";
  - `articulo`: "Elegí el artículo: la o el.";
  - `email`: "Revisá el email: no parece una dirección válida."; `emailLargo`: "El email puede tener hasta 150 caracteres.";
  - `largo(n)`: "Puede tener hasta N caracteres.";
  - `enUso`: "No se puede borrar el área: tiene datasets asociados. Primero hay que pasarlos a otra área.";
  - `noEncontrada`: "Área no encontrada".

## Review Focus

1. **Un nombre de área o de contacto con `<`, `&` o comillas:** se ve tal cual en la tabla, en el `aria-label` de "Editar" y en "Así se lee". Nunca se interpreta como HTML. Test en la Task 5.
2. **Un `datos_nuevos.area_id` guardado como texto ("12") en lugar de número:** igual bloquea el borrado. Test en la Task 3.
3. **Una edición que solo agrega espacios** (" mesa@x.gob.ar ") **o vacía un campo que era NULL:** no cuenta como cambio y no se manda nada. Test en la Task 5.
4. **Abrir `configuracion.html#licencias` o recargar en `#areas`:** abre esa pestaña. Un fragmento desconocido (`#foo`) abre Usuarios. Test en la Task 6.
5. **Un área con el teléfono o el email de contacto y sin el nombre** (hay una en producción): la columna muestra "Sin nombre" con el teléfono y el email, no "—". Test en la Task 5.

---

### Task 1: Traer main, armar el entorno de la rama y releer

**Files:**
- Modify: este plan (sección "Diferencias encontradas", al final), si algo cambió.
- Sin versionar: `.env` del worktree (`DB_NAME=rpad_rama_configuracion`, el resto copiado del `.env` de main) y el enlace `node_modules`.

**Interfaces:**
- Produce: la rama con main adentro, la base `rpad_rama_configuracion` y la suite en verde como línea de base.

- [ ] **Step 1: Comprobar que las tres ramas estén en main.**
  - Correr `git -C C:/git/rpad branch --merged main`. Tienen que aparecer `feat/metricas-y-reportes`, `feat/generador-de-notas` y `feat/notas-hoja-oficio`; también sirve `git log main --oneline --grep` con sus merges.
  - Si falta alguna: **parar** y avisarle al usuario.
- [ ] **Step 2: Traer main a la rama.** Usar el `sync_with_base_branch` del host si está disponible; si no, `git merge main` en el worktree. La rama solo tiene `docs/` propios, así que no debería haber conflictos.
- [ ] **Step 3: Armar el entorno.**
  - Crear el enlace con `cmd //c "mklink /J node_modules C:\git\rpad\node_modules"` en el worktree, y el `.env`.
  - Copiar la base, con `DB_ROOT_PASSWORD` del `.env`: `docker exec -e MYSQL_PWD=… rpad-db sh -c "mariadb-dump -uroot datospublicos_mcr_rpad | mariadb -uroot rpad_rama_configuracion"`, después de `CREATE DATABASE rpad_rama_configuracion CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`. Dar permisos al usuario de la app como en las ramas anteriores.
  - Si a la copia le falta alguna migración que ya está en main (por ejemplo, `areas.ambito` del Generador: `SHOW COLUMNS FROM areas LIKE 'ambito'`), correrla **solo en la copia**.
- [ ] **Step 4: Línea de base.** Correr `npm test` (después del control de los Global Constraints). Anotar los totales (pasan, fallan, omitidos). Expected: 0 fallan.
- [ ] **Step 5: Releer el código actualizado** y comparar con lo que asume este plan:
  - **El menú lateral de `public/index.html`:** el bloque `#sidebarAdmin` y el texto de Herramientas, que Métricas cambia a "Métricas y Reportes".
  - **`public/js/main.js`:** si el Generador ocultó Notas al lector en `updateSidebarAuth`.
  - **`tests/paginas.test.js`:** las constantes `VERSION*` y la cantidad de páginas con carcasa.
  - **El Ámbito del Generador:** `public/areas.html` y `public/js/areas.js` con su selector, y `controllers/areasController.js` con `AMBITOS`, `MENSAJE_AMBITO` y lo que valida.
  - **`tests/areas-ambito-api.test.js`:** qué pide y con qué token.
  - **`controllers/datasetController.js`** (lo cambia Métricas): `DATASET_SELECT_QUERY`, `enriquecer`, `getDatasets` y `getDatasetById`.
  - **`routes/index.js`:** las rutas de `/areas` y `/datasets`.
  - **`public/js/usuarios.js`** y `tests/usuarios-frontend.test.js`.
  - **`services/emailTemplates.js`:** `avisoSuperadminTemplate` y `resumenAvisosRetenidosTemplate`.
  - **Quién más llama a `GET /api/areas` o usa `area_email_*` / `area_contacto_*`:** grep en `public/`, `services/` y `controllers/`; también el endpoint del Generador.
  - **`CLAUDE.md`:** la cantidad de páginas.
- [ ] **Step 6: Las diferencias.**
  - Si algo difiere de lo que dice este plan, anotarlo en "Diferencias encontradas", ajustar las tareas afectadas y **avisarle al usuario antes de la Task 2**.
  - Si no difiere nada, anotar "Sin diferencias".
- [ ] **Step 7: Commit:** `git add docs/superpowers/plans/2026-10-24-configuracion.md && git commit -m "docs: plan de Configuración, revisado contra main"`.

### Task 2: Las reglas de un área (servicio puro)

**Files:**
- Create: `services/areasReglas.js`
- Modify: `services/usuariosReglas.js` (agrega `export` a `PATRON_EMAIL`, sin otro cambio)
- Test: `tests/areas-reglas.test.js` (nuevo, sin base)

**Interfaces:**
- Produce (todo exportado desde `services/areasReglas.js`):
  - `MENSAJES_AREA`: el objeto de los textos de los Global Constraints; `largo` es una función `(n) => string`.
  - `LARGOS_AREA = { nombre: 200, area_superior: 300, email_principal: 150, email_secundario: 150, email_contacto: 150, telefono_area: 50, celular_area: 50, telefono_contacto: 50, nombre_contacto: 150 }`.
  - `CAMPOS_DE_CONTACTO_AREA = ['email_principal', 'email_secundario', 'telefono_area', 'celular_area', 'nombre_contacto', 'telefono_contacto', 'email_contacto']`.
  - `CAMPOS_DE_CONTACTO_DATASET = ['area_email_principal', 'area_email_secundario', 'area_telefono', 'area_celular', 'area_contacto_nombre', 'area_contacto_telefono', 'area_contacto_email']`.
  - `sinCampos(objeto, campos) → objeto`: una copia sin esas claves.
  - `validarArea(entrada, anterior = null) → { datos, error }`:
    - `error` es `null` o `{ mensaje, campo }`.
    - `datos` trae solo las claves que vinieron, normalizadas. En el alta trae también `articulo: 'la'` si no vino.
    - Nunca tira.
  - `textoNoSePuedeBorrar({ activos, deBaja, pendientes }) → string | null`.

- [ ] **Step 1: Write the failing tests** (`tests/areas-reglas.test.js`):
  - `validarArea({ nombre: '  Dirección X  ' })` → `datos.nombre === 'Dirección X'`, `datos.articulo === 'la'`, `error === null`.
  - **El nombre:**
    - `validarArea({ nombre: '   ' })` y `validarArea({})` → `error: { mensaje: 'Escribí el nombre del área.', campo: 'nombre' }`;
    - en una edición, `validarArea({ nombre: '' }, { nombre: 'Vieja' })` → el mismo error;
    - en una edición, `validarArea({ email_principal: 'a@b.co' }, ANTERIOR)` sin `nombre` → sin error, y `datos` no trae `nombre`.
  - **Largos:**
    - un nombre de 201 caracteres (`'á'.repeat(201)`, contado con `Array.from`) → `nombreLargo`; uno de 200 pasa;
    - `area_superior` de 301 → `{ mensaje: 'Puede tener hasta 300 caracteres.', campo: 'area_superior' }`.
  - **Artículos:**
    - `articulo: 'los'` → `{ mensaje: 'Elegí el artículo: la o el.', campo: 'articulo' }`;
    - `articulo_superior: 'x'` → lo mismo en `articulo_superior`;
    - `articulo_superior: ''` → `datos.articulo_superior === null`.
  - **Vacíos y recortes:** `area_superior: '  '` → `null`; `email_principal: ' a@b.co '` → `'a@b.co'`; `email_secundario: ''` → `null`.
  - **Emails:**
    - `email_contacto: 'x@'` → `{ mensaje: 'Revisá el email: no parece una dirección válida.', campo: 'email_contacto' }`;
    - uno de 151 → `emailLargo`;
    - `telefono_area` de 51 → `'Puede tener hasta 50 caracteres.'`.
  - **Solo si cambia:**
    - `validarArea({ email_principal: 'malo' }, { email_principal: 'malo', nombre: 'A' })` → sin error, porque no cambió;
    - con `{ email_principal: 'otro malo' }` → error.
  - **El orden de los errores:** con `nombre` vacío y `email_contacto` inválido, el error es el del nombre.
  - **`textoNoSePuedeBorrar`:**
    - `({ activos: 0, deBaja: 0, pendientes: 0 })` → `null`;
    - `({ activos: 2, deBaja: 1, pendientes: 0 })` → `'No se puede borrar el área: tiene 3 datasets (1 dado de baja). Primero hay que pasarlos a otra área.'`;
    - `({ activos: 1, deBaja: 0, pendientes: 3 })` → `'No se puede borrar el área: tiene 1 dataset. Primero hay que pasarlo a otra área.'`;
    - `({ activos: 0, deBaja: 2, pendientes: 0 })` → `'… tiene 2 datasets (2 dados de baja). …'`;
    - `({ activos: 0, deBaja: 0, pendientes: 1 })` → `'No se puede borrar el área: un cambio pendiente la usa. Primero hay que aprobarlo o rechazarlo.'`;
    - `pendientes: 2` → `'No se puede borrar el área: 2 cambios pendientes la usan. Primero hay que aprobarlos o rechazarlos.'`.
  - **`sinCampos`:** `({ id: 1, email_principal: 'x', nombre: 'A' }, CAMPOS_DE_CONTACTO_AREA)` → `{ id: 1, nombre: 'A' }`; el original no cambia.
- [ ] **Step 2: Run** `node --test tests/areas-reglas.test.js`. Expected: FAIL (el módulo no existe).
- [ ] **Step 3: Implementar `services/areasReglas.js`.**
  - **Cuándo se valida:** el nombre y los artículos, siempre que vienen. Formato y largo del resto, si `anterior === null` o si el valor normalizado difiere de `anterior[campo] ?? null`.
  - **El orden de los campos:** nombre, articulo, area_superior, articulo_superior, email_principal, email_secundario, telefono_area, celular_area, nombre_contacto, telefono_contacto, email_contacto.
  - **Lo que no toca:** `ambito`. Lo valida el controlador del Generador, como dejó la Task 1.
  - **Largos:** con `Array.from(texto).length`. **Emails:** con `PATRON_EMAIL` importado de `usuariosReglas.js`.
- [ ] **Step 4: Run** `node --test tests/areas-reglas.test.js`. Expected: PASS. Correr `npm test` completo. Expected: 0 fallan.
- [ ] **Step 5: Commit:** `feat: reglas de un área (validación y mensajes, puras)`.

### Task 3: La sesión opcional, la API de áreas y la de datasets

**Files:**
- Modify: `middleware/auth.js`, `controllers/areasController.js`, `controllers/datasetController.js`, `routes/index.js`
- Test: `tests/areas-api.test.js` (nuevo, con Docker), `tests/publico.test.js` (un caso)

**Interfaces:**
- Consume: `validarArea`, `textoNoSePuedeBorrar`, `sinCampos`, `CAMPOS_DE_CONTACTO_AREA`, `CAMPOS_DE_CONTACTO_DATASET` y `MENSAJES_AREA` (Task 2); `esAdmin` de `services/usuariosReglas.js`.
- Produce:
  - `verificarSesion(authorization) → Promise<{ ok: true, user } | { ok: false, status, error }>`, exportada de `middleware/auth.js`. `authMiddleware` pasa a usarla, con los mismos estados y mensajes de hoy.
  - `sesionOpcional(req, res, next)`, el middleware:
    - con una sesión válida pone `req.user = { ...payload, rol }` y sigue;
    - con cualquier otra cosa (sin token, token inválido, sesión vencida o un error de la base) sigue sin `req.user`;
    - nunca responde.
  - **`GET /api/areas` y `/api/areas/:id`**, con `sesionOpcional`:
    - con `esAdmin(req.user?.rol)` → `{ success, data, vista: 'administracion' }`, con `datasets_dados_de_baja`, `datasets_externos_con_nota` y `cambios_pendientes_que_la_usan` como números;
    - si no → `{ success, data }`, cada área pasada por `sinCampos(…, CAMPOS_DE_CONTACTO_AREA)` y sin las tres cuentas.
  - **`GET /api/datasets` y `/api/datasets/:id`**, con `sesionOpcional`: sin administración, cada dataset pasa por `sinCampos(…, CAMPOS_DE_CONTACTO_DATASET)`.
  - **`POST /api/areas` y `PUT /api/areas/:id`:** responden `{ success: false, error, campo }` con 400 ante un error de validación o un nombre repetido. Éxito: el mismo cuerpo y el mismo `message` de hoy.
  - **`DELETE /api/areas/:id`:** 400 con `textoNoSePuedeBorrar(…)`.

- [ ] **Step 1: Write the failing tests** (`tests/areas-api.test.js`, base `crearBaseDePrueba('rpad_test_areas_api')`, servidor y cliente como `tests/seguimiento-api.test.js`).
  - **Usuarios:** `crearUsuariosPrueba(api, { superadmin: 'superadmin', admin: 'admin', editor: 'editor', lector: 'lector', colab: 'colaborador', baja: 'admin' })`. Después de iniciar sesión, `UPDATE usuarios SET activo = 0` para `baja`.
  - **Fixtures:** `crearArea` y `crearDataset` de `tests/notas-fixtures.js`, con `nombre_contacto: 'Contacto Inventado'`, `email_principal: 'mesa@area.test'`, etc.
  - **Quién ve el contacto (cada caso, en `/areas` y en `/areas/:id`):**
    - sin token, con lector, con colab, con `Bearer x.y.z` y con el token de `baja`: 200, sin ninguna clave de `CAMPOS_DE_CONTACTO_AREA` y sin `vista`, ni `datasets_dados_de_baja`, ni `datasets_externos_con_nota`, ni `cambios_pendientes_que_la_usan`; con `nombre`, `articulo` y `cantidad_datasets`;
    - con superadmin, admin y editor: `vista === 'administracion'` y los siete campos.
  - **Las cuentas:**
    - un área con un dataset activo externo con `requiere_nota` NULL y frecuencia con `dias` da `datasets_externos_con_nota === 1`;
    - el mismo dataset con `requiere_nota = 0` da 0;
    - con la frecuencia eventual (`dias IS NULL`), 0;
    - uno con `activo = 0` suma a `datasets_dados_de_baja`.
  - **Los cambios pendientes:** un `cambios_pendientes` en `pendiente` con `datos_nuevos` `{"area_id": 12}` y otro con `{"area_id": "12"}` dan `cambios_pendientes_que_la_usan === 2`; uno `aprobado` no cuenta.
  - **Datasets:**
    - `GET /datasets` y `/datasets/:id` sin token: el dataset sin ninguna clave de `CAMPOS_DE_CONTACTO_DATASET`, con `area_nombre`;
    - con el token del admin: con `area_contacto_nombre === 'Contacto Inventado'`.
  - **Alta y edición:**
    - `POST /areas` con `{ nombre: '   ' }` → 400 `{ error: 'Escribí el nombre del área.', campo: 'nombre' }`;
    - con el nombre de otra área en otras mayúsculas o sin tilde → 400 `nombreRepetido` en `nombre`;
    - `{ nombre: 'Nueva' }` → 201 con `articulo: 'la'`, porque el alta rápida de `admin.js` sigue andando;
    - `PUT` con `{ nombre: '' }` → 400, y el nombre guardado no cambia;
    - `PUT` con solo `{ email_contacto: 'x@' }` → 400 en `email_contacto`;
    - con un email inválido guardado por SQL, un `PUT` con solo `{ telefono_area: '297 1' }` → 200;
    - `PUT` con `{}` → 400 "No hay datos para actualizar".
  - **Borrar:**
    - un área con un dataset `activo = 0` → 400 con `textoNoSePuedeBorrar({ activos: 0, deBaja: 1, pendientes: 0 })`, nunca 500;
    - con un alta pendiente que la elige con `area_id` en texto → 400 con el texto de pendientes;
    - sin nada → 200 y ya no existe;
    - `DELETE /areas/abc` y `/areas/999999` → 404 `{ error: 'Área no encontrada' }`.
  - **`tests/publico.test.js`:** en el caso de `/areas`, sumar que ninguna fila trae `email_principal`.
- [ ] **Step 2: Run** `node --test tests/areas-api.test.js`. Expected: FAIL (aparecen los campos de contacto; el borrado da 500).
- [ ] **Step 3: Implementar.**
  - **`middleware/auth.js`:** extraer el cuerpo de `authMiddleware` a `verificarSesion`, sin cambiar los mensajes ni los estados (401 sin token, 401 inválido, 401 sesión vencida, 500 con un error de la base), y escribir `sesionOpcional`. `tests/permisos.test.js` y los de sesión tienen que seguir pasando sin cambios.
  - **`areasController.js`:**
    - Las tres cuentas de `getAreas` y `getAreaById` van como subconsultas en el mismo `SELECT`. Para la de nota, `JOIN frecuencias f ON f.id = d.frecuencia_id`, con `d.activo = TRUE AND d.tipo_gestion = 'externa' AND (d.requiere_nota IS NULL OR d.requiere_nota = 1) AND f.dias IS NOT NULL`. Para la de pendientes, `cp.estado = 'pendiente' AND JSON_UNQUOTE(JSON_EXTRACT(cp.datos_nuevos, '$.area_id')) = CAST(a.id AS CHAR)`. La sesión opcional elige qué devolver.
    - **`createArea` y `updateArea`:** usan `validarArea` (en `updateArea`, con la fila guardada como `anterior`) y conservan la validación del Ámbito del Generador. El repetido se busca con `WHERE nombre = ? AND id <> ?`, y un `ER_DUP_ENTRY` da el mismo 400. El UPDATE escribe solo las claves de `datos`.
    - **`deleteArea`:** cuenta activos, dados de baja y pendientes antes del DELETE. Un `ER_ROW_IS_REFERENCED_2` da 400 con `MENSAJES_AREA.enUso`. Un id que no es entero positivo da 404.
  - **`datasetController.js`:** aplicar `sinCampos` en `getDatasets` y `getDatasetById` cuando no hay administración, después de `enriquecer`.
  - **`routes/index.js`:** `sesionOpcional` en las cuatro rutas GET. Las de escritura no cambian.
- [ ] **Step 4: Run** `node --test tests/areas-api.test.js tests/publico.test.js tests/permisos.test.js`. Expected: PASS. Si la Task 1 lo encontró, correr también `tests/areas-ambito-api.test.js`. Después, `npm test` completo. Expected: 0 fallan.
- [ ] **Step 5: Commit:** `fix: los datos de contacto de las áreas solo para administración; validación del área y borrar sin 500`.

### Task 4: Las URLs viejas y los emails al superadmin

**Files:**
- Modify: `app.js` (antes de `app.use(express.static(…))`), `services/emailTemplates.js` (los cuatro `${RPAD_URL}/usuarios.html`)
- Test: `tests/areas-api.test.js` (un `describe` más), `tests/avisos-superadmin.test.js` o `tests/email-diseno.test.js` (donde ya se arman los dos templates)

**Interfaces:**
- Produce:
  - `GET /usuarios.html` → 302 con `Location: /configuracion.html`;
  - `GET /areas.html` → 302 con `Location: /configuracion.html#areas`.

- [ ] **Step 1: Write the failing tests.**
  - En `areas-api.test.js`: `fetch(\`${servidor.url}/usuarios.html\`, { redirect: 'manual' })` → `status 302` y `headers.get('location') === '/configuracion.html'`; lo mismo para `/areas.html` con `'/configuracion.html#areas'`.
  - En el test de los templates:
    - `avisoSuperadminTemplate(…)` y `resumenAvisosRetenidosTemplate([…])`, con los mismos argumentos que `tests/emails-fixtures.js`;
    - su `html` incluye `/configuracion.html"` y su `text`, `/configuracion.html`;
    - ninguno incluye `usuarios.html`;
    - el botón sigue diciendo "Ver el panel de usuarios".
- [ ] **Step 2: Run** los dos archivos. Expected: FAIL.
- [ ] **Step 3: Implementar.** Las dos rutas van con un comentario que cite la spec (sección 3).
- [ ] **Step 4: Run** los dos archivos. Expected: PASS. Después, `npm test`, con 0 fallan.
- [ ] **Step 5: Commit:** `feat: usuarios.html y areas.html llevan a Configuración; los avisos al superadmin abren Configuración`.

### Task 5: La pestaña Áreas (`areas.js`)

**Files:**
- Modify (reescritura completa): `public/js/areas.js`
- Test: `tests/areas-frontend.test.js` (nuevo, sin base)

**Interfaces:**
- Consume: `API.pedirJson`, `Utils.escapeHtml` y `showToast` (`main.js`); `Auth.isAdmin`; la respuesta de la Task 3 (`vista`, las tres cuentas).
- Produce (nombres globales del script; ninguno puede repetirse con `config.js`, `auth.js`, `main.js`, `api.js` ni `usuarios.js`):
  - **Constantes:**
    - `TEXTO_AMBITO = { municipal: 'Municipal', externo: 'Fuera del municipio' }`;
    - `FILTROS_AREA`: `[{ clave, texto, pasa }]` con las claves `'todas' | 'municipal' | 'externo' | 'sin-email' | 'sin-datasets'`;
    - `MENSAJE_NOMBRE_AREA`, copia de `MENSAJES_AREA.nombre`, atada por un test de paridad;
    - `MENSAJE_SESION_AREAS` y `MENSAJE_ERROR_AREAS`;
    - `CAMPO_DEL_ERROR_AREA`: campo del servidor → id del input. Incluye `ambito → 'a-ambito'`, cuyo error va en `a-ambito-error`, debajo de las dos opciones.
  - **Funciones puras:**
    - `comoSeNombra({ articulo, nombre, articulo_superior, area_superior }) → string`;
    - `sinEmail(area)` y `sinAvisoDe40(area)` (`sinEmail && datasets_externos_con_nota > 0`);
    - `datasetsEnTotal(area)`, que es activos más dados de baja;
    - `areasVisibles(areas, filtro, busqueda) → area[]`;
    - `htmlDeFiltrosArea(areas, elegido)`, `htmlDeTablaAreas(areas)` y `textoAvisoSinEmail(areas)`, que da `''` si no hay ninguna;
    - `textoPieDelArea(area | null) → { borrar: boolean, texto: string }`;
    - `datosDelFormularioArea(leerCampo) → objeto con los 12 campos normalizados`;
    - `cambiosDelArea(datos, area) → objeto con solo lo que cambió`, con '' y null equivalentes;
    - `esVistaDeAdministracion(respuesta) → boolean`.
  - **DOM:** `cargarAreas(forzar = false)`, que llama `usuarios.js` (Task 6), `pintarAreas()`, `abrirModalArea(area, origen)`, `cerrarModalArea()`, `guardarArea()`, `pedirBorradoArea(id, origen)`, `cerrarModalBorrarArea()` y `confirmarBorradoArea()`.
  - **Ids del HTML** (los pone la Task 6):
    - la vista y la lista: `vista-areas`, `areas-aviso`, `areas-contador`, `buscar-area`, `areas-filtros`, `areas-lista` y `areas-vacio`;
    - el botón del encabezado: `btn-nueva-area`;
    - el modal: `modal-area`, `modal-area-titulo`, `area-error`, `area-pie-izquierda` y `area-guardar`;
    - los campos: `a-nombre`, `a-articulo`, `a-superior`, `a-articulo-superior`, los radios `name="a-ambito"`, `a-lectura`, `a-email-principal`, `a-email-secundario`, `a-telefono`, `a-celular`, `a-contacto`, `a-contacto-telefono` y `a-contacto-email`;
    - los errores de los campos: `a-nombre-error`, `a-email-principal-error`, `a-email-secundario-error`, `a-contacto-email-error` y `a-ambito-error`;
    - borrar: `modal-borrar-area`, `borrar-area-texto`, `borrar-area-error` y `borrar-area-confirmar`;
    - para cerrar: `data-cerrar-area` y `data-cerrar-borrar`.

- [ ] **Step 1: Write the failing tests** (`tests/areas-frontend.test.js`). `areas.js` corre en un `vm` con el `api.js` de verdad, como `tests/seguimiento-frontend.test.js`, con un `document` que no hace nada.
  - **Al cargarse no toca el DOM:** `getElementById` registra si lo llaman; tiene que quedar sin llamadas.
  - **Conviven:**
    - `api.js`, `usuarios.js` y `areas.js` se cargan en el mismo `vm`, con los stubs de `tests/usuarios-frontend.test.js`, sin tirar.
    - Los nombres declarados en el nivel superior de `areas.js` (regex sobre `^(const|let|function|async function) (\w+)`) no se repiten con los de `config.js`, `auth.js`, `main.js`, `api.js` ni `usuarios.js`.
  - **`comoSeNombra`:**
    - `{ articulo: 'la', nombre: 'Dirección General de Catastro', articulo_superior: 'la', area_superior: 'Subsec. de Coordinación Económica y Control de Gestión' }` → `'la Dirección General de Catastro, dependiente de la Subsec. de Coordinación Económica y Control de Gestión'`;
    - sin `area_superior` → `'la Dirección General de Catastro'`;
    - con `articulo_superior: null` → `'…, dependiente de Subsec. …'`;
    - con el nombre vacío → `'la …'`.
  - **`sinAvisoDe40`:**
    - `{ email_principal: null, email_secundario: null, datasets_externos_con_nota: 1 }` → true;
    - con `datasets_externos_con_nota: 0` → false;
    - con solo `email_secundario` → false.
  - **`textoAvisoSinEmail`:** con 6 áreas así → `'6 áreas con datasets de gestión externa no tienen email cargado: no les llega el aviso de los 40 días.'`; con 1, el singular; con 0, `''`.
  - **Los filtros:**
    - `htmlDeFiltrosArea` con 2 áreas municipales, una sin email y ninguna sin datasets: cinco botones salvo "Sin datasets", con `aria-pressed` en el elegido y las cantidades con `<b>0</b>` cuando corresponde.
    - "Sin datasets" aparece si un área tiene `cantidad_datasets: 0, datasets_dados_de_baja: 0`.
  - **`areasVisibles`:** `'catastro'` encuentra "Dirección General de Catastro"; `'dirección general'` y `'direccion general'` dan lo mismo; el filtro y la búsqueda se combinan.
  - **`htmlDeTablaAreas`:**
    - un nombre `'Área <b>&"x"</b>'` sale escapado en la celda y en el `aria-label` (Review Focus 1);
    - `cantidad_datasets: 0` muestra `>0<`;
    - un área sin persona pero con `telefono_contacto` muestra "Sin nombre" y el teléfono (Review Focus 5);
    - sin ningún dato de contacto, "—";
    - `sinAvisoDe40` muestra la etiqueta roja y, si no, "Sin email".
  - **`textoPieDelArea`:**
    - `null` → `{ borrar: false, texto: 'Se guarda al confirmar.' }`;
    - sin nada → `{ borrar: true, texto: '' }`;
    - con 1 activo → `'Tiene 1 dataset: para borrarla, primero hay que pasarlo a otra área.'`;
    - con 2 activos y 1 de baja → `'Tiene 3 datasets: para borrarla, primero hay que pasarlos a otra área.'`;
    - sin datasets y con 1 pendiente → `'Un cambio pendiente la usa: para borrarla, primero hay que aprobarlo o rechazarlo.'`; con 2 → el plural.
  - **`cambiosDelArea`:**
    - el formulario igual al área → `{}`;
    - con `' mesa@x.gob.ar '` contra `'mesa@x.gob.ar'` → `{}`;
    - con `''` contra `null` → `{}` (Review Focus 3);
    - un teléfono nuevo → `{ telefono_area: '297 1' }`;
    - `articulo_superior` de `'la'` a `''` → `{ articulo_superior: null }`.
  - **`esVistaDeAdministracion`:** `{ success: true, data: [], vista: 'administracion' }` → true; `{ success: true, data: [] }` → false.
  - **Paridad:** `MENSAJE_NOMBRE_AREA === MENSAJES_AREA.nombre` (importado de `services/areasReglas.js`).
- [ ] **Step 2: Run** `node --test tests/areas-frontend.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar `public/js/areas.js`** a partir de `docs/superpowers/specs/2026-10-24-configuracion-mockups/js/areas.js` (la variante tabla), con estos cambios:
  - **Los nombres** de la lista de Interfaces; nada de sufijos `A`, y fuera la variante filas y `VARIANTE_LISTA`.
  - **Sin la marca de la vista:** `cargarAreas` pinta en `areas-lista` un `<p class="aviso aviso-error">` con `MENSAJE_SESION_AREAS` y un link a `login.html`, oculta el aviso y deshabilita `btn-nueva-area`. Si el pedido falla, `MENSAJE_ERROR_AREAS`.
  - **`guardarArea`:**
    - en una edición manda `cambiosDelArea(datosDelFormularioArea(…), areaAbierta)`, y si queda vacío cierra sin pedir nada;
    - con 401 o 403 deja el mensaje en el modal y no vuelve a pedir la lista;
    - el error con `campo` va al campo; sin campo, a `area-error`.
  - **El foco y Escape:** el foco vuelve al botón que abrió el modal, y Escape cierra primero el de borrar y después el del área.
  - **Los oyentes**, todos en `DOMContentLoaded` y solo si `Auth.isAdmin()`.
- [ ] **Step 4: Run** `node --test tests/areas-frontend.test.js`. Expected: PASS. Después, `npm test`, con 0 fallan.
- [ ] **Step 5: Commit:** `feat: la pestaña Áreas (tabla, filtros, aviso de los 40 días y modal con los botones siempre a la vista)`.

### Task 6: La página `configuracion.html` y la tercera pestaña de `usuarios.js`

**Files:**
- Rename: `public/usuarios.html` → `public/configuracion.html` (`git mv`, para conservar la historia)
- Delete: `public/areas.html` (`git rm`)
- Modify: `public/configuracion.html`, `public/js/usuarios.js`, `tests/paginas.test.js`, `tests/usuarios-frontend.test.js`

**Interfaces:**
- Consume: `cargarAreas` (Task 5), que se llama solo si existe.
- Produce:
  - en `usuarios.js`, `const VISTAS = ['usuarios', 'licencias', 'areas']`, `vistaDeLaDireccion(hash) → 'usuarios' | 'licencias' | 'areas'` (un fragmento desconocido da `'usuarios'`) y `mostrarVista(nombre)` con las tres vistas;
  - en el HTML, los ids de la Task 5.

- [ ] **Step 1: Write the failing tests.**
  - **`tests/usuarios-frontend.test.js`:**
    - cambiar las dos lecturas de `../public/usuarios.html` por `../public/configuracion.html`;
    - `vistaDeLaDireccion('#licencias') === 'licencias'`, `('#areas') === 'areas'`, `('#foo')`, `('')` y `(undefined) === 'usuarios'` (Review Focus 4);
    - `mostrarVista('areas')` deja `vista-areas.hidden === false`, `vista-usuarios.hidden === true`, `btn-nueva-area.hidden === false` y `btn-nuevo-usuario.hidden === true`, sin tirar aunque `cargarAreas` no exista en el `vm`;
    - con `contexto.cargarAreas = () => llamadas.push('cargarAreas')`, `mostrarVista('areas')` la llama una vez;
    - con `window.history = { replaceState: (…a) => registro.push(a) }`, `mostrarVista('licencias')` llama `replaceState(null, '', '#licencias')`, y sin `history` no tira;
    - el arranque (`alCargar()`) con `window.location.hash = '#areas'` muestra Áreas.
  - **`tests/paginas.test.js`:**
    - el `for` de `['usuarios.html', 'usuarios']` pasa a `configuracion.html`, con `usuarios.js?v=${VERSION_PANTALLAS}`;
    - un test nuevo: `configuracion.html` carga `js/areas.js?v=${VERSION_AREAS}` una sola vez, después de `api.js` y de `usuarios.js`;
    - el test de `#grupo-autorizado` lee `configuracion.html`;
    - "hay 13 páginas con carcasa";
    - `usuarios.html` y `areas.html` ya no están en `paginas`.
    - **Todavía no cambian** los tests del menú (`href="usuarios.html"` y los destinos con `areas.html`): los cambia la Task 7.
- [ ] **Step 2: Run** `node --test tests/usuarios-frontend.test.js tests/paginas.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
  - **`configuracion.html`:**
    - el `<title>` y la descripción ("Usuarios, licencias y áreas responsables del RPAD");
    - el `h1` con la ruedita y `aria-hidden="true"`;
    - el botón `#btn-nueva-area hidden` después de `#btn-nuevo-usuario`;
    - la pestaña `data-vista="areas"`;
    - `#vista-areas hidden` después de `#vista-licencias`;
    - los modales `#modal-area` y `#modal-borrar-area` después de `#modal-licencia`, con el marcado de la maqueta (variante tabla), los ids de la Task 5 y `a-ambito-error`.
  - **Su `<style>`:** suma el bloque de Áreas de la maqueta (las clases `ar-`, `.sr-only`, `.main-content { min-width: 0; }` y `.ar-tabla-marco { position: relative; }`), sin las reglas de la variante filas.
  - **Los scripts:** `usuarios.js?v=` sube a `VERSION_PANTALLAS` nueva. Sugerencia: `20261127`, o el siguiente valor libre si la Task 1 vio que ya se usa. Después va `<script src="js/areas.js?v=…"></script>` con `VERSION_AREAS`, el mismo valor. `areas.js` hoy carga `?v=20261012`.
  - **El menú de esta página:** todavía el de `index.html` (Task 7).
  - **`usuarios.js`:**
    - `mostrarVista` recorre `VISTAS`, oculta o muestra los dos botones y, en `'areas'`, llama `if (typeof cargarAreas === 'function') cargarAreas();`;
    - después escribe `window.history?.replaceState?.(null, '', \`#${nombre}\`)`;
    - al final del arranque, `const inicial = vistaDeLaDireccion(window.location.hash); if (inicial !== 'usuarios') mostrarVista(inicial);`;
    - sin `hashchange` y sin un segundo `DOMContentLoaded`;
    - las funciones que el test llama siguen siendo `function`.
  - **`tests/paginas.test.js`:** `VERSION_PANTALLAS` y `VERSION_AREAS` nuevas, con su comentario.
- [ ] **Step 4: Run** los dos archivos. Expected: PASS. Después, `npm test`, con 0 fallan.
- [ ] **Step 5: Commit:** `feat: Configuración reemplaza a Usuarios y Áreas (tres pestañas, la pestaña en la dirección)`.

### Task 7: El menú lateral y los íconos

**Files:**
- Modify: las 13 páginas con carcasa de `public/` (el bloque `#sidebarAdmin`), `public/admin.html` (además, el ícono del `h1` y el texto del alta rápida), `tests/paginas.test.js`

**Interfaces:**
- Produce: el bloque `#sidebarAdmin` igual en las 13 páginas:

```html
<div class="sidebar-section hidden" id="sidebarAdmin">
    <div class="sidebar-section-title">Administración</div>
    <a href="admin.html" class="sidebar-link"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg><span>Gestión de Datasets</span></a>
    <a href="correos.html" class="sidebar-link"><!-- el SVG de Correos, sin cambios --><span>Correos</span></a>
    <a href="configuracion.html" class="sidebar-link"><!-- el SVG de la ruedita que hoy tiene Gestión de Datasets, sin cambios --><span>Configuración</span></a>
</div>
```

- [ ] **Step 1: Write the failing tests** (`tests/paginas.test.js`):
  - **Los links de Administración:**
    - el test del único `href="usuarios.html"` pasa a un único `href="configuracion.html"` en cada página con `sidebarAdmin`;
    - `href="usuarios.html"` y `href="areas.html"` no aparecen en ninguna página;
    - en la lista de destinos, `'areas.html'` pasa a ser `'configuracion.html'`.
  - **El orden y los íconos en `index.html`:**
    - los `href` de `#sidebarAdmin`, en orden, son `['admin.html', 'correos.html', 'configuracion.html']`;
    - el SVG del link a `admin.html` contiene `m12.83 2.18`, y el de `configuracion.html`, `M12.22 2h-.44`.
  - **`admin.html`:**
    - el SVG del `h1` contiene `m12.83 2.18` y tiene `aria-hidden="true"`;
    - el texto "Los datos de contacto se completan después, en Configuración → Áreas." está.
- [ ] **Step 2: Run** `node --test tests/paginas.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
  - Reemplazar el bloque en las 13 páginas con un script de una sola vez en el scratchpad, sin versionarlo. Leer cada archivo, reemplazar el bloque `<div class="sidebar-section hidden" id="sidebarAdmin">…</div>` y conservar la sangría y el CRLF de cada página.
  - En `admin.html`, el ícono del `h1` y el texto.
  - **No se tocan `main.js` ni `Icons.settings`:** el selector de íconos de los proyectos de Gestión lo usa.
- [ ] **Step 4: Run** `node --test tests/paginas.test.js`. Expected: PASS: el menú de cada página es el de `index.html`. Después, `npm test`, con 0 fallan.
- [ ] **Step 5: Commit:** `feat: el menú de Administración con Configuración, y Gestión de Datasets con el ícono de capas`.

### Task 8: Documentación, recorrido en el navegador y kit de despliegue

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `docs/superpowers/specs/2026-10-24-configuracion-design.md` (estado: implementado)
- Sin versionar: el kit `C:\Users\Mariano\Desktop\RPAD-deploy-configuracion\`, armado como `RPAD-deploy-notas-dgmit`

**Interfaces:**
- Consume: todo lo anterior.

- [ ] **Step 1: `CLAUDE.md`.**
  - "14 páginas" pasa a 13 en todos los lugares, con `configuracion.html` en la lista de la carcasa y en la estructura (`public/`).
  - Usuarios: "pestaña Licencias de Configuración".
  - **Una convención nueva para `areas.js`:** al cargarse solo declara; los tests son `tests/areas-frontend.test.js`; `MENSAJE_NOMBRE_AREA` es una copia atada por paridad.
  - `services/areasReglas.js` en la estructura de `services/`.
  - **Las APIs públicas de áreas y datasets:** sin sesión de administración no devuelven los datos de contacto; `sesionOpcional` va en `middleware/auth.js`.
  - Las redirecciones.
  - Los tests nuevos.
- [ ] **Step 2: `README.md`.** "Panel de usuarios" pasa a Configuración (Usuarios, Licencias y Áreas). Actualizar el árbol de archivos y sumar el Changelog.
- [ ] **Step 3: Recorrido en el navegador** con el servidor de la rama: una entrada en `.claude/launch.json` que arranque `app.js` con `DB_NAME=rpad_rama_configuracion` en un puerto libre, como `rpad-metricas`.
  - **Como superadmin, admin y editor:**
    - las tres pestañas;
    - `#licencias` y `#areas` al recargar.
  - **En la pestaña Áreas:**
    - el aviso de las 6 áreas y "Ver las áreas sin email";
    - editar un área, sin cambios y con un cambio;
    - un nombre repetido;
    - un alta y un borrado.
  - **El modal con 640 px de alto** (`resize_window`): Guardar a la vista.
  - **El teléfono (375 px):** sin desplazamiento de costado (`scrollWidth === clientWidth`).
  - **Las otras cuentas y los links viejos:**
    - el lector y el colaborador van a la portada;
    - `/usuarios.html` lleva a Usuarios y `/areas.html#…` a Áreas.
  - **Un email al superadmin en Mailpit:** se dispara con un cambio de rol hecho por un admin, en la base de la rama. El link abre `configuracion.html`.
  - Capturas de lo principal.
- [ ] **Step 4: El kit** `Desktop/RPAD-deploy-configuracion/`, como los anteriores.
  - **`PASOS.txt`:**
    - primero: antes de este kit se despliegan el de Métricas y Reportes y el de Mejoras de Notas, en ese orden (orden del usuario);
    - qué incluye;
    - comprobaciones previas: que las tres entregas anteriores estén en producción, por ejemplo con `SHOW COLUMNS FROM areas LIKE 'ambito'`;
    - **sin migración**;
    - subir los archivos y borrar `public/usuarios.html` y `public/areas.html` del servidor;
    - Restart;
    - qué mirar después.
  - **Los archivos que cambian:** `archivos-configuracion/` y su `.zip`, con la lista de los nuevos y los reemplazados.
  - **`vuelta-atras/`:** `LEEME.txt` y `archivos-anteriores.zip`, con los archivos de main antes del merge. No hay SQL.
- [ ] **Step 5: `npm test` completo.** Anotar los totales contra la línea de base de la Task 1. Expected: 0 fallan.
- [ ] **Step 6: Commit:** `docs: Configuración en CLAUDE.md, README y la spec`.

### Task 9: Revisión final de la rama (Opus)

- [ ] **Step 1:** Revisión de toda la rama contra la spec y este plan, con Opus. Pedir los riesgos de "no romper nada":
  - Usuarios y Licencias;
  - el Colaborador;
  - el editor;
  - los avisos al superadmin;
  - los permisos;
  - lo que el Generador agregó a Áreas.
- [ ] **Step 2:** Corregir los hallazgos críticos e importantes, con Opus y un commit por corrección. Volver a correr `npm test`.
- [ ] **Step 3:** Merge a main y push. El usuario los autorizó el 24/10 a la noche: «Una vez que finaliza todo, se arma el kit de despliegue, se hace merge en main y push». **No desplegar.** Si la rama trae migraciones (no debería), aplicarlas también a la base local después del merge, con un respaldo antes.
- [ ] **Step 4:** Informar el resumen, los totales de la suite, el recorrido, el kit y el hash del merge.
- [ ] **Step 5:** Mandarle el hash del merge por mensaje a la sesión "Proyectos" (`local_792b68d3-eedb-49fc-9e82-b34247a3837b`, rama `feat/proyectos`), que va después en la cola. Ella se adapta a main: renombra `gestion.html` → `proyectos.html` y suma su redirección junto a las de esta rama.

## Diferencias encontradas

(La Task 1 completa esta sección.)
