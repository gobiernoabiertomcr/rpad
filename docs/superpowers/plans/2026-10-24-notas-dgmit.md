# Notas DGMIT en el Seguimiento — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la DGMIT, la Dirección Administrativa (rol nuevo Colaborador) y la DDPC (editor, admin, superadmin) carguen en el Seguimiento la nota formal que la DGMIT le manda a cada área, y que se vea en el circuito, los movimientos, la cinta, la lista, el PDF y el anexo de la reiteración.

**Architecture:**
- **Datos:** tres tablas nuevas (`notas_dgmit`, `notas_dgmit_datasets`, `notas_dgmit_historial`) y el valor `colaborador` en `usuarios.rol`.
- **Escritura:** un controlador nuevo, `notasDgmitController.js`, con su validación pura en `services/notasDgmitReglas.js` y un middleware de permiso.
- **Lectura:** `fuentesDe` suma `notasDgmit` (consulta aislada) y `seguimientoReglas.js` arma el movimiento `dgmit`, la nota del ciclo abierto y el tramo del circuito. La cinta, el PDF y el anexo dibujan lo que calcula el servidor.
- **Pantalla:** `seguimiento.js` dibuja la columna, el tramo, la marca y el detalle, y suma el formulario (cargar o corregir) y el modal de anular. Lo puro va arriba y lo que toca el DOM, al final.

**Tech Stack:** Node.js 22 (ES modules), Express, MariaDB (mysql2), PDFKit, vanilla JS, `node --test`, `tests/pdf-lector.js`.

**Spec:** `docs/superpowers/specs/2026-10-24-notas-dgmit-design.md`. Ante una duda, manda la spec.

**Maquetas (referencia visual, no código de producción):** `C:/Users/Mariano/Desktop/RPAD-maquetas-notas-dgmit/`. Sirven de molde:
- `2-dataset.html` tiene el marcado del formulario (`#modal-nota`) y del modal de anular (`#modal-anular`).
- `mock.css` tiene los estilos nuevos. Las clases `mq-*` son de la maqueta: no se copian, o se renombran a `sg-*` (por ejemplo, `mq-pista` pasa a `sg-pista`).
- `4-circuito.html` muestra cada caso del circuito.

## Global Constraints

- **Dónde se trabaja:** worktree `C:/git/rpad/.claude/worktrees/nota-dgmit`, rama `feat/nota-dgmit`. Nunca se escribe en `C:/git/rpad` (main) ni en su base.
- **Base de la rama:** `rpad_rama_notas_dgmit`, una copia de `datospublicos_mcr_rpad` que la usa el `.env` del worktree. La migración se aplica solo ahí: la base de main queda como está, porque otras sesiones corren sus tests contra ella.
- **No romper lo implementado.** `npm test` completo antes de empezar (la línea de base queda en el ledger) y al final de cada tarea. No sale ningún email real: el SMTP local va a Mailpit y esta entrega no manda emails.
- **Commits:** uno por tarea, con mensajes en español que terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Textos exactos**, copiados de la spec:
  - Botón: `Cargar nota DGMIT`.
  - Títulos de los modales: `Cargar nota DGMIT`, `Corregir nota DGMIT N° <n>` y `Anular nota DGMIT N° <n>`.
  - Validación: `Escribí el número de la nota.` · `El número de la nota puede tener hasta 40 caracteres.` · `Elegí la fecha en que el área recibió la nota.` · `La fecha de recepción no puede ser posterior a hoy.` · `La fecha de recepción no puede ser anterior al 01/01/2025.` · `Elegí si es una solicitud o una reiteración.` · `Elegí al menos un dataset.` · `Escribí el motivo.` · `El motivo puede tener hasta 500 caracteres.`
  - Número repetido (409): `Ya hay una nota DGMIT N° <n> cargada. Para sumarle datasets o cambiar algo, corregila.`
  - Dataset que no se puede elegir (400): `«<título>» no se puede elegir: solo los datasets activos de gestión externa que requieren nota DGMIT.`
  - Sin permiso (403): `No tenés permiso para cargar notas DGMIT.`
  - Corregir o anular la nota de otro (403): `Solo quien cargó la nota o administración pueden corregirla o anularla.`
  - Nota anulada (409): `La nota está anulada: no se puede corregir ni volver a anular.`
  - Corrección sin cambios (400): `La corrección no cambia ningún dato de la nota.`
  - Nota que no existe (404): `Nota DGMIT no encontrada`.
  - Avisos de éxito: `Nota DGMIT N° <n> (solicitud|reiteración) cargada en N datasets.` (`en 1 dataset`) · `Nota DGMIT N° <n> corregida.` · `Nota DGMIT N° <n> anulada.`
  - Tramo sin nota: `Nota formal` con `Pendiente de carga`, `Todavía no hizo falta` o `Ya no se pide`; en el anexo, `La manda la DGMIT al área`.
  - Tramo con nota:
    - pantalla: `Nota DGMIT N° <n>` / `<Solicitud|Reiteración> recibida por el área el dd/mm/aaaa, <hoy|hace 1 día|hace N días>`;
    - PDF: `Nota DGMIT` / `<Solicitud|Reiteración> <n>. Recibida el dd/mm/aaaa`.
  - "Al área" del PDF con nota: `Al área: el dd/mm/aaaa recibió la nota DGMIT N° <n> (<solicitud|reiteración>), que pide los datos de este dataset.`
  - Movimiento:
    - título: `Nota DGMIT N° <n> al área: <solicitud|reiteración>`;
    - detalle: `Recibida por el área el dd/mm/aaaa.`, más ` La misma nota pide también <A>, <B> y <C>.` y ` Anulada el dd/mm/aaaa por <nombre corto>: <motivo>`;
    - quién: `Cargó <nombre corto>`.
  - Filtro de movimientos: `Notas DGMIT`. Leyenda: `Nota DGMIT al área`. Columna de la lista: `Última nota DGMIT al área`.
  - Rol: `Colaborador`. Las ayudas de cada rol, las de la spec, sección 1.
- **Color:** violeta `#5B4691`, token `--sg-violeta` en el `<style>` de `seguimiento.html`. En el PDF, la constante `VIOLETA`.
- **Fechas** como texto `'AAAA-MM-DD'`, con hoy = `hoyArgentina()` en el servidor. En el navegador, nunca `Date` para leer fechas (`Utils.fechaCorta`).
- **Frontend:**
  - Cada script que cambia sube su `?v=` en las páginas, y su constante en `tests/paginas.test.js`. `auth.js` cambia: sube `VERSION` en las 14 páginas.
  - `seguimiento.js` y `usuarios.js` siguen declarando solo al cargarse.
- **SQL** siempre parametrizado. Cargar, corregir y anular, en una transacción.

## Review Focus

1. **Una nota recibida el mismo día en que se aprobó la actualización que cerró el ciclo.** Va al ciclo anterior. Una nota de un dataset sin ciclos (eventual o sin fecha) es la vigente más reciente. → Task 7.
2. **El anexo de la reiteración.**
   - Sin nota, el tramo dice `La manda la DGMIT al área` y nunca `Pendiente de carga`.
   - Si la consulta de notas DGMIT falla (por ejemplo, porque falta la tabla), la reiteración se genera igual.
   - → Tasks 6 y 8.
3. **El número repetido.**
   - Dos cargas del mismo número (con otras mayúsculas o espacios) dan 409.
   - Una anulada no bloquea.
   - Corregir una nota conservando su número no choca consigo misma.
   - → Task 5.
4. **Los límites del Colaborador.**
   - No toca datasets, usuarios ni rutas de administración, y no corrige ni anula la nota de otro.
   - El editor solo pasa a alguien entre lector y colaborador.
   - El mínimo de 2 auditores no cambia.
   - → Tasks 2 y 5.
5. **Una corrección con un dataset que ya no se puede elegir** (pasó a "No" o a interno). Si ya estaba en la nota, se acepta; si es nuevo, 400. → Task 5.

---

### Task 1: Migración, schema y vuelta atrás

**Files:**
- Modify: `database/schema.sql`: el rol en `usuarios` (:326) y las tres tablas nuevas, con el estilo de `usuarios_licencias` (:576-595).
- Create: `database/updates/migracion-notas-dgmit.sql` y `database/updates/rollback-notas-dgmit.sql`.
- Test: `tests/schema.test.js`.

**Interfaces:**
- Produces:
  - Las tablas de la spec, sección 4: `notas_dgmit`, `notas_dgmit_datasets` y `notas_dgmit_historial`.
  - `usuarios.rol enum('superadmin','admin','editor','colaborador','lector') NOT NULL DEFAULT 'lector'`.
  - Nombres de las FK: `fk_notas_dgmit_creado_por`, `fk_notas_dgmit_datasets_nota`, `fk_notas_dgmit_datasets_dataset`, `fk_notas_dgmit_historial_nota` y `fk_notas_dgmit_historial_usuario`.

- [ ] **Step 1: Write the failing tests** en `tests/schema.test.js`, con el molde de los tests de `requiere_nota` y del editor:
  - `'usuarios admite el rol colaborador (después de editor) y sigue con lector por defecto'`;
  - `'notas DGMIT: tres tablas con sus columnas, claves y FK (spec 2026-10-24-notas-dgmit, 4)'`. Compara la lista de columnas, que `numero` es `varchar(40)`, que `tipo` es `enum('solicitud','reiteracion')`, la PK compuesta de `notas_dgmit_datasets` y los `ON DELETE` (CASCADE en nota y dataset, SET NULL en usuario);
  - `describe('migracion-notas-dgmit.sql')`:
    - `'se pega tal cual en phpMyAdmin: sin DELIMITER ni USE, y solo agrega (nada de DROP, RENAME ni CHECK)'`;
    - `'la cabecera dice la spec y que va ANTES de subir el código'`;
    - `'desde la estructura de main deja la de schema.sql y se puede repetir'`. Aplica la migración dos veces sobre una base creada con el schema de main (`git show main:database/schema.sql`, o el que ya usa el test del editor) y compara contra `schema.sql`;
  - `describe('rollback-notas-dgmit.sql')`:
    - `'sin colaboradores: borra las tres tablas y el rol vuelve a cuatro valores'`;
    - `'con un colaborador: no toca el rol y avisa con la consulta comentada que hay que pasarlo a lector primero'`.
- [ ] **Step 2: Run** `node --test tests/schema.test.js`. Expected: FAIL (faltan las tablas y el rol).
- [ ] **Step 3: Implement:**
  - `schema.sql`;
  - la migración: el `ALTER TABLE usuarios MODIFY rol …` y los `CREATE TABLE IF NOT EXISTS …`, con la cabecera "va ANTES de subir el código";
  - el rollback: `DROP TABLE IF EXISTS` en orden (historial, datasets, notas). El `MODIFY` del rol de vuelta va condicionado a que no haya colaboradores, igual que el rollback del editor (ver `rollback-editor-auditoria.sql`).
- [ ] **Step 4: Aplicar la migración en `rpad_rama_notas_dgmit`** (nunca en `datospublicos_mcr_rpad`):
  ```bash
  docker exec -i -e MYSQL_PWD=<DB_ROOT_PASSWORD> rpad-db mariadb -uroot rpad_rama_notas_dgmit < database/updates/migracion-notas-dgmit.sql
  ```
  Después, `node --test tests/schema.test.js` y `npm test`. Expected: PASS ("crea las mismas tablas y columnas que la base actual" incluido).
- [ ] **Step 5: Commit** `feat: tablas de las notas DGMIT y rol colaborador (migración y vuelta atrás)`.

### Task 2: El rol Colaborador en el servidor

**Files:**
- Modify: `services/usuariosReglas.js` (`ROLES_ASIGNABLES` :3, `TEXTO_ROL` :6, el mensaje del rol :90, `MENSAJE_EDITOR_SOLO_LECTORES` :102, `rechazoParaEditor` :109-114).
- Modify: `controllers/usuariosController.js` (:145, :238, :329, :379, :416).
- Modify: `scripts/setup-admin.js` (:45-47).
- Test: `tests/usuarios-reglas.test.js`, `tests/editor-panel.test.js`, `tests/usuarios-panel.test.js`.

**Interfaces:**
- Produces, en `services/usuariosReglas.js`:
  - `ROLES_ASIGNABLES = ['admin', 'editor', 'colaborador', 'lector']`;
  - `TEXTO_ROL.colaborador = 'Colaborador'`;
  - el mensaje `'El rol debe ser admin, editor, colaborador o lector'`;
  - `export const ROLES_DEL_EDITOR = ['lector', 'colaborador']`;
  - `MENSAJE_EDITOR_SOLO_LECTORES = 'Un editor solo puede crear y modificar usuarios lectores y colaboradores.'`;
  - `export const puedeCargarNotasDgmit = (rol) => esAdmin(rol) || rol === 'colaborador'`;
  - `rechazoParaEditor({ objetivo, rolNuevo = null })`: devuelve `MENSAJE_EDITOR_SOLO_LECTORES` si `objetivo` no está en `ROLES_DEL_EDITOR`, `MENSAJE_EDITOR_SIN_ROLES` si `rolNuevo` no es null y no está en `ROLES_DEL_EDITOR`, y null en cualquier otro caso.
- El controlador, en :238, pasa `rolNuevo` en lugar de `cambiaRol`. En :329, :379 y :416 usa `!ROLES_DEL_EDITOR.includes(usuario.rol)`.

- [ ] **Step 1: Write the failing tests:**
  - `usuarios-reglas`:
    - `'puedeCargarNotasDgmit: superadmin, admin, editor y colaborador sí; lector y null no'`;
    - `'rechazoParaEditor: lector↔colaborador sí; a editor o admin no; sobre un editor o un admin no'`;
    - `'validarUsuario acepta colaborador'`.
  - `editor-panel` (Docker):
    - `'el editor crea un colaborador'`;
    - `'el editor pasa un lector a colaborador y vuelta'`;
    - `'el editor no pasa un colaborador a editor (403 sin roles)'`;
    - `'el editor desactiva, reactiva y envía el link a un colaborador'`.
  - `usuarios-panel` (Docker):
    - `'el admin crea un colaborador'`;
    - `'pasar un lector a colaborador avisa al superadmin y queda en el historial'`. Usar el molde de los avisos que ya prueba el panel;
    - `'crear un colaborador no avisa al superadmin'`;
    - `'un colaborador no cuenta para el mínimo de aprobadores'`.
- [ ] **Step 2: Run** los tres archivos. Expected: FAIL.
- [ ] **Step 3: Implement** según Interfaces. `setup-admin.js` ofrece `superadmin/admin/editor/colaborador/lector`.
- [ ] **Step 4: Run** los tres archivos y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: rol colaborador en el panel de usuarios (el editor maneja lectores y colaboradores)`.

### Task 3: El rol en las pantallas

**Files:**
- Modify: `public/js/auth.js`: `getRoleText` (:37-39) y `puedeCargarNotasDgmit()` nuevo.
- Modify: las 14 páginas con carcasa: `?v=` de `auth.js`, `main.js` y `api.js`, con el `VERSION` nuevo.
- Modify: `public/usuarios.html`:
  - la opción `colaborador` entre Editor y Lector (:322-325);
  - el grupo "Colaboradores" entre Editores y Solo lectura (:208-221);
  - la línea de ayuda debajo del selector (`<p id="u-rol-ayuda">`, unida por `aria-describedby`) y su estilo;
  - el `?v=` de `usuarios.js`.
- Modify: `public/js/usuarios.js`: `TEXTO_ROL` (:8), el armado de los grupos (:280-290), las reglas del editor (:116-124, :324-342, :417) y la ayuda del rol.
- Modify: `tests/paginas.test.js`: `VERSION` y `VERSION_PANTALLAS`.
- Test: `tests/auth-frontend.test.js`, `tests/usuarios-frontend.test.js`, `tests/paginas.test.js`.

**Interfaces:**
- Produces:
  - `Auth.getRoleText()` → `'Colaborador'` para `colaborador`.
  - `Auth.puedeCargarNotasDgmit()`: `['superadmin', 'admin', 'editor', 'colaborador'].includes(this.getRole())`. Es una copia de `puedeCargarNotasDgmit` del servidor.
- En `usuarios.js`, puro (lo usan los tests en el `vm`):
  - `AYUDA_DEL_ROL`: los textos de la spec, sección 1, para lector, colaborador, editor y admin;
  - `htmlDeAyudaDelRol(rol)` → `<b>Colaborador:</b> …`, o `''` para superadmin.
- El editor ve en el selector solo Lector y Colaborador. Lo puede cambiar si el usuario es lector o colaborador; si no, la ficha es de solo lectura, como hoy.

- [ ] **Step 1: Write the failing tests:**
  - `auth-frontend`:
    - `'getRoleText de colaborador es Colaborador'`;
    - `'puedeCargarNotasDgmit: superadmin, admin, editor y colaborador sí; lector y sin sesión no'`;
    - `'puedeCargarNotasDgmit del navegador da lo mismo que la regla del servidor para cada rol'` (paridad con `services/usuariosReglas.js`).
  - `usuarios-frontend`:
    - `'los colaboradores tienen su grupo, entre Editores y Solo lectura, y no aparecen entre los de solo lectura'`;
    - `'la ayuda de cada rol'` (los cuatro textos exactos);
    - `'el editor puede modificar un colaborador y solo ofrece Lector y Colaborador'`;
    - `'el editor no puede modificar un editor ni un admin'`.
  - `paginas`: las constantes nuevas.
- [ ] **Step 2: Run** los tres archivos. Expected: FAIL.
- [ ] **Step 3: Implement.** Las versiones nuevas: `VERSION = '20261124'` y `VERSION_PANTALLAS = '20261124'`. Se cambian en las 14 páginas con un reemplazo exacto, sin tocar nada más.
- [ ] **Step 4: Run** los tres archivos y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: rol colaborador en el encabezado y en Usuarios (grupo propio y ayuda de cada rol)`.

### Task 4: La validación de una nota DGMIT (pura)

**Files:**
- Create: `services/notasDgmitReglas.js`.
- Test: `tests/notas-dgmit-reglas.test.js`.

**Interfaces:**
- Produces:
  - Constantes:
    - `LARGO_NUMERO = 40`, `LARGO_MOTIVO = 500`, `FECHA_MINIMA = '2025-01-01'` y `TIPOS_NOTA_DGMIT = ['solicitud', 'reiteracion']`.
    - `MENSAJES_NOTA_DGMIT` (congelado), con las claves `numero`, `numeroLargo`, `recibida`, `recibidaFutura`, `recibidaVieja`, `tipo`, `datasets`, `motivo` y `motivoLargo`. Los textos son los de Global Constraints.
    - `TEXTO_TIPO_NOTA_DGMIT = { solicitud: 'Solicitud', reiteracion: 'Reiteración' }`.
  - `validarNotaDgmit(entrada, hoy)` → `{ datos: { numero, recibida, tipo, datasets }, errores }`. `errores` tiene a lo sumo una clave por campo (`numero`, `recibida`, `tipo`, `datasets`).
    - `numero`: recortado, entre 1 y 40 caracteres.
    - `recibida`: `'AAAA-MM-DD'` que existe (`esFechaIso` de `fechasDatasetReglas.js`), entre `FECHA_MINIMA` y `hoy`.
    - `tipo`: uno de `TIPOS_NOTA_DGMIT`.
    - `datasets`: un array con al menos un id entero positivo (números o textos de solo dígitos), sin repetidos y en el orden recibido. Cualquier otra cosa da el error de `datasets`.
    - Nunca tira error.
  - `validarMotivo(valor)` → `{ motivo, error }` (recortado, entre 1 y 500 caracteres).
  - `textoNumeroRepetido(numero)` y `textoNoSePuedeElegir(titulo)`: los textos de los 409 y 400.

- [ ] **Step 1: Write the failing tests:**
  - `'una nota completa y válida: datos recortados, datasets sin repetir'`;
  - `'cada campo vacío da su mensaje'`;
  - `'número de 40 caracteres sí; de 41, numeroLargo'`;
  - `'fecha: 2025-01-01 y hoy sí; 2024-12-31, recibidaVieja; mañana, recibidaFutura; 2026-02-30 y "22/10/2026", recibida'`;
  - `'tipo fuera de la lista da el mensaje del tipo'`;
  - `'datasets: [], "5", [0], [-1], ["a"] y [1.5] dan el error; ["7", 7, 8] da [7, 8]'`;
  - `'validarMotivo: vacío, 500 y 501 caracteres'`;
  - `'nunca tira error con entradas raras (null, undefined, números en lugar de texto)'`.
- [ ] **Step 2: Run** `node --test tests/notas-dgmit-reglas.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** según Interfaces.
- [ ] **Step 4: Run** el archivo y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: validación de las notas DGMIT (reglas puras)`.

### Task 5: Cargar, corregir y anular (API)

**Files:**
- Create: `controllers/notasDgmitController.js`.
- Modify: `middleware/auth.js` (middleware nuevo, después de `adminOnly`) y `routes/index.js` (junto a las rutas del Seguimiento, :251-253).
- Test: `tests/notas-dgmit-api.test.js` (nuevo, Docker) y `tests/permisos.test.js`.

**Interfaces:**
- Consumes: Task 2 (`puedeCargarNotasDgmit`, `esAdmin`) y Task 4 (validación y textos).
- Produces:
  - `export const cargaNotasDgmit = (req, res, next)`: 403 `{ success: false, error: 'No tenés permiso para cargar notas DGMIT.' }` si `!puedeCargarNotasDgmit(req.user?.rol)`.
  - Rutas, las tres con `authMiddleware` y `cargaNotasDgmit`:
    - `POST /api/notas-dgmit` → `cargarNotaDgmit`: 201 `{ success, data: { id, numero, tipo, recibida, datasets }, message }`.
    - `PUT /api/notas-dgmit/:id` → `corregirNotaDgmit`: el cuerpo de la carga más `motivo`. 200 `{ success, data, message }`.
    - `POST /api/notas-dgmit/:id/anular` → `anularNotaDgmit`: cuerpo `{ motivo }`. 200 `{ success, message }`.
  - Errores:
    - 400 `{ success: false, error: <el primer mensaje>, campo, errores }`;
    - 403;
    - 404 `Nota DGMIT no encontrada` (un id que no es un entero positivo también da 404);
    - 409, del número repetido (con `campo: 'numero'`) y de la nota anulada.
  - Reglas del controlador:
    - Los datasets se buscan en la base. Se pueden elegir los activos, externos y con `requiere_nota IS NULL OR requiere_nota = 1`; en una corrección, también los que la nota ya tenía. El primero que no cumple da 400 con `textoNoSePuedeElegir(título)` y `campo: 'datasets'`. Un id que no existe da el mismo 400, con su número en lugar del título.
    - Número repetido: dentro de la transacción, `SELECT id FROM notas_dgmit WHERE numero = ? AND anulada = 0 AND id <> ? FOR UPDATE` (la colación ya ignora las mayúsculas). Si encuentra una, 409.
    - Corregir y anular: puede quien la cargó (`creado_por = req.user.userId`) o `esAdmin(rol)`.
    - Al corregir:
      - si nada cambia (número, tipo, fecha y el mismo conjunto de datasets), 400;
      - si algo cambia, se guarda `notas_dgmit_historial` (`accion = 'correccion'`, `motivo`, `anteriores` JSON `{ numero, tipo, recibida, datasets: [ids ordenados] }`, `usuario_id`), se actualiza la cabecera y se ajustan los datasets (se borran los que salen y se insertan los que entran).
    - Al anular: `anulada = 1` y su fila en el historial (`accion = 'anulacion'`, `anteriores` null).

- [ ] **Step 1: Write the failing tests** (`notas-dgmit-api`):
  - Preparación:
    - usuarios con `crearUsuariosPrueba(api, { adminA: 'admin', editor: 'editor', colab: 'colaborador', colab2: 'colaborador', lector: 'lector' })`;
    - datasets de prueba con `PREFIJO_TEST`: dos externos con Sí, uno externo con NULL, uno externo con No, uno interno y uno externo inactivo;
    - limpieza: borrar las notas de esos datasets antes de `limpiarDatosPrueba`.
  - Carga:
    - `'el colaborador carga una nota con dos datasets: 201, cabecera, detalle y creado_por'`;
    - `'el mensaje dice «cargada en 2 datasets»; con uno, «en 1 dataset»'`;
    - `'cada campo inválido da 400 con su mensaje y su campo'`;
    - `'un dataset con No, interno, inactivo o que no existe da 400 con el texto de no se puede elegir'`;
    - `'el número repetido da 409, también con otras mayúsculas y espacios; una anulada no bloquea'`.
  - Corrección:
    - `'el colaborador corrige la suya: historial con los anteriores, datasets que entran y salen'`;
    - `'corregir conservando el número no choca consigo misma'`;
    - `'una corrección sin cambios da 400'`;
    - `'en una corrección se acepta un dataset que ya estaba aunque hoy tenga No; uno nuevo con No da 400'`.
  - Permisos:
    - `'otro colaborador no corrige ni anula la nota ajena (403); el admin y el editor sí'`;
    - `'el lector recibe 403 en las tres rutas'`.
  - Anulación:
    - `'anular pide motivo; anula, deja historial y no borra'`;
    - `'corregir o anular una anulada da 409'`.
  - Otros:
    - `'un id que no es un entero positivo o no existe da 404'`;
    - `'las fechas se guardan como se mandan (sin correrse un día)'`.
  - `permisos`:
    - las tres rutas en un bloque nuevo: el lector recibe 403 y el visitante sin sesión, 401;
    - el lector sigue pudiendo usar `GET /seguimiento`.
- [ ] **Step 2: Run** `node --test tests/notas-dgmit-api.test.js tests/permisos.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** según Interfaces. Los errores inesperados responden 500 `{ success: false, error: 'Error al guardar la nota DGMIT' }`, con `console.error`.
- [ ] **Step 4: Run** los dos archivos y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: cargar, corregir y anular notas DGMIT (API)`.

### Task 6: Las notas DGMIT en las fuentes del Seguimiento

**Files:**
- Modify: `services/seguimientoDatos.js` (`fuentesDe` :82-197 y el comentario de `Fuentes` :5).
- Modify: `services/notasDigitales.js`: `fuentesDeEjemplo` (:693-702) suma `notasDgmit: []`.
- Test: `tests/seguimiento-datos.test.js`.

**Interfaces:**
- Produces: `Fuentes.notasDgmit` en cada dataset, `[{ id, numero, tipo, recibida, anulada, cargada, por, por_id, datasets, historial }]`, en orden de `recibida` y después de `id`.
  - `recibida`: `'AAAA-MM-DD'`.
  - `anulada`: boolean.
  - `cargada`: el momento de `created_at` en hora argentina (`momento(UNIX_TIMESTAMP(...))`).
  - `por`: el `nombre_completo` de quien la cargó, o null. `por_id`: su id, o null.
  - `datasets`: todos los de la nota, `[{ id, titulo }]`, por título.
  - `historial`: `[{ accion, motivo, por, momento }]`, la más nueva primero.
- La consulta va en su propia función, `notasDgmitDe(datasetIds)`, con un `try/catch`: si falla, `console.error('No se pudieron leer las notas DGMIT:', error)` y devuelve un `Map` vacío. Así cada dataset queda con `notasDgmit: []` y el resto de las fuentes sale como siempre.

- [ ] **Step 1: Write the failing tests** (`seguimiento-datos`, sobre su base de prueba, que ya se crea con `schema.sql`):
  - `'fuentesDe trae las notas DGMIT de cada dataset, con todos sus datasets, quién la cargó y el historial'`;
  - `'la anulada viene con anulada: true y su anulación en el historial'`;
  - `'recibida sin correrse un día y cargada en hora argentina'`;
  - `'si la tabla de notas DGMIT no existe, fuentesDe sale igual con notasDgmit vacía'`. El test hace `RENAME TABLE notas_dgmit TO notas_dgmit_x` en su base de prueba y lo deshace al terminar.
- [ ] **Step 2: Run** `node --test tests/seguimiento-datos.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** según Interfaces.
- [ ] **Step 4: Run** el archivo, `tests/notas-motor.test.js` y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: las notas DGMIT en las fuentes del Seguimiento (consulta aislada)`.

### Task 7: Las reglas del Seguimiento y la cinta

**Files:**
- Modify: `services/seguimientoReglas.js`:
  - `FILTRO_DEL_TIPO` (:40-43);
  - el movimiento nuevo, junto a `movimientoDeNota` (:299);
  - `movimientosDe` (:355-376);
  - `TRAMO_FUERA` y los textos nuevos (:586-597);
  - `circuitoDe` (:657-682), `seguimientoDe` (:722-736) y `resumenParaLista` (:746-765).
- Modify: `services/seguimientoCinta.js`: `FILA_DEL_TIPO` (:30-34), `PRIORIDAD` (:38) y `vaEnLaCinta` (:95-100).
- Test: `tests/seguimiento-reglas.test.js` y `tests/seguimiento-cinta.test.js`.

**Interfaces:**
- Consumes: Task 6 (`Fuentes.notasDgmit`) y `TEXTO_TIPO_NOTA_DGMIT` de Task 4.
- Produces:
  - **El movimiento `dgmit`.** Filtro `'dgmit'`, `fecha = recibida` y `momento = recibida + ' 00:00:00'`.
    - Título, detalle y quién: los de Global Constraints. En el detalle, "otros" son los datasets de la nota menos el propio, unidos con `unirConY`.
    - `extra`: `{ nota_id, numero, tipo, recibida, anulada, cargada, por, por_id, area, datasets, historial }`. `area` es `fuentes.dataset.area`.
    - Los movimientos incluyen las anuladas y dejan afuera las de `recibida > hoy`. Eso hace que `movimientosDe(fuentes, hoy)` necesite `hoy`: se agrega como segundo parámetro opcional, y sin `hoy` no se filtra.
  - **`export const notaDgmitDelCiclo = (fuentes, ciclos, hoy)`** → `{ numero, tipo, recibida } | null`.
    - Cuentan solo las vigentes: no anuladas y con `recibida <= hoy`.
    - Con ciclos, la más reciente (por `recibida`, después `cargada`, después `id`) entre las que pertenecen al ciclo abierto: `cicloDelAviso(ciclos, recibida + ' 00:00:00') === ciclos.length - 1`.
    - Sin ciclos, la vigente más reciente.
  - **`circuitoDe(fuentes, ciclos, hoy, { anexo = false } = {})`.** Solo en gestión externa, `tramoFuera = { titulo, texto, registrada, nota, tituloPdf, textoPdf }`:
    - Con nota del ciclo abierto: los textos de pantalla y de PDF de Global Constraints, `registrada: true`. Si el dataset tiene "No", también `nodoMedio = NODO_MEDIO.externa`.
    - Sin nota y con "No": `TRAMO_FUERA_SIN_NOTA`, como hoy.
    - Sin nota y con `anexo`: `Nota formal` / `La manda la DGMIT al área`.
    - Sin nota, dado de baja (`estadoDeSeguimiento(...).estado === 'baja'`): `Ya no se pide`.
    - Sin nota, con ciclos y con avisos del ciclo (`delCiclo.total > 0`) o con el ciclo vencido (`abierto.diasVencido > 0`): `Pendiente de carga`.
    - Cualquier otro caso: `Todavía no hizo falta`.
    - Sin nota: `registrada: false`, `nota: null`, y `tituloPdf`/`textoPdf` iguales a `titulo`/`texto`. En gestión interna, lo de hoy más esas cuatro claves.
    - `alArea`: con nota, `textoPdf` pasa a ser el renglón "Al área" de la nota y `texto` (pantalla) queda como hoy, o null si no hubo email. Con "No" y nota, `alArea` deja de ser null. Sin nota, como hoy.
  - **`seguimientoDe(fuentes, hoy, opcionesCinta = {}, opciones = {})`:** le pasa `opciones` a `circuitoDe` y `hoy` a `movimientosDe`.
  - **`resumenParaLista`** suma `requiere_nota` (`requiereNotaDe(dataset)`) y `nota_dgmit` (`notaDgmitDelCiclo`).
  - **`export const conNotasDgmitEditables = (seguimiento, { usuarioId, administracion })`:** copia el seguimiento. En cada movimiento `dgmit` pone `extra.editable = administracion || extra.por_id === usuarioId` y saca `por_id`. No toca lo demás.
  - **Cinta:**
    - `FILA_DEL_TIPO.dgmit = 'abajo'`;
    - `PRIORIDAD = ['nota', 'email', 'act', 'actp', 'cambio', 'cambiop', 'alta', 'dgmit', 'rech', 'area']`;
    - `vaEnLaCinta` deja afuera la `dgmit` anulada.
- Los días de "hace N días" se cuentan como texto, sin `Date` local, con el mismo cálculo que usa el módulo para los días de vencido.

- [ ] **Step 1: Write the failing tests:**
  - Fixtures: copias de `CASOS[58]` (externo, avisado en el ciclo, con 1 aviso), `CASOS[25]` (externo sin avisos en el ciclo), `CASOS[81]` (con `requiere_nota: 0`), `CASOS[26]` (interno) y uno eventual (`CASOS[66]` o el que no tenga ciclos), con `notasDgmit` armadas en el test.
  - `seguimiento-reglas`:
    - `'movimiento dgmit: título, detalle con los otros datasets, quién y extra'`;
    - `'la anulada: detalle con «Anulada el … por …: motivo» y extra.anulada'`;
    - `'una nota con recibida posterior a hoy no aparece'`;
    - `'notaDgmitDelCiclo: la más reciente del ciclo abierto; una de un ciclo anterior no cuenta'`;
    - `'una nota recibida el mismo día de la aprobación que cerró el ciclo va al ciclo anterior'`;
    - `'sin ciclos: la vigente más reciente'`;
    - `'circuito con nota: textos de pantalla y PDF, registrada, hace N días (hoy, 1 día, N días)'`;
    - `'circuito sin nota: Pendiente de carga (58), Todavía no hizo falta (25), Ya no se pide (dado de baja)'`;
    - `'circuito en el anexo sin nota: La manda la DGMIT al área; con nota, la nota'`;
    - `'externo con No: sin nota como hoy; con nota, el tramo de la nota, el nodo medio Mandan la nota formal al área y alArea con la nota'`;
    - `'alArea.textoPdf con nota y sin nota'`;
    - `'gestión interna: el circuito no cambia (salvo las claves nuevas)'`;
    - `'una nota DGMIT no cambia avisosDelCiclo, ciclos, hitos ni estado'` (compara contra el mismo caso sin notas);
    - `'resumenParaLista: requiere_nota y nota_dgmit'`;
    - `'conNotasDgmitEditables: quien la cargó y administración sí, otro no; saca por_id; no toca el original'`.
  - `seguimiento-cinta`:
    - `'la nota DGMIT va en la fila de abajo, con el título en el detalle'`;
    - `'junto a un rechazo se dibuja la nota DGMIT'`;
    - `'la anulada no tiene marca'`.
- [ ] **Step 2: Run** `node --test tests/seguimiento-reglas.test.js tests/seguimiento-cinta.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** según Interfaces.
- [ ] **Step 4: Run** los dos archivos, `tests/seguimiento-frontend.test.js`, `tests/seguimiento-pdf.test.js` y `npm test`. Expected: PASS. Los tests de pantalla y de PDF existentes no se tocan: el circuito de hoy, sin notas, ahora dice "Pendiente de carga" o "Todavía no hizo falta" donde antes decía "Por fuera del RPAD: no queda registrada". Si algún test existente fija ese texto, se actualiza al nuevo y se dice en el reporte.
- [ ] **Step 5: Commit** `feat: las notas DGMIT en las reglas del Seguimiento (movimiento, circuito, lista y cinta)`.

### Task 8: El PDF y el anexo de la reiteración

**Files:**
- Modify: `services/seguimientoPdf.js`:
  - `dibujarTramo` y `dibujarCircuito` (:223-264);
  - `dibujarMarca` (:285-310);
  - `LEYENDA` (:489-493);
  - la tabla de movimientos (:535-585) y `dibujarHoja` (:589).
- Modify: `services/notasDigitalesSeguimiento.js`: `seguimientosDeLaNota` (:27-34) llama a `seguimientoDe(delDataset, fecha, OPCIONES_CINTA_PDF, { anexo: true })`.
- Test: `tests/seguimiento-pdf.test.js` y `tests/notas-motor.test.js`.

**Interfaces:**
- Consumes: Task 7 (`tramoFuera.registrada`, `tituloPdf`, `textoPdf`, `alArea.textoPdf` y el movimiento `dgmit`).
- Produces:
  - `const VIOLETA = '#5B4691'`.
  - El tramo de la nota formal usa `tituloPdf ?? titulo` y `textoPdf ?? texto`. Con `registrada`, va en violeta y con línea llena; sin ella, en `COLOR.grisClaro` y punteado, como hoy.
  - `dibujarMarca` suma `'dgmit'`: `doc.rect(cx - 4.5 * s, cy - 6 * s, 9 * s, 12 * s).fill(VIOLETA)`.
  - `LEYENDA` suma `['dgmit', 'Nota DGMIT al área']` después de `'area'`.
  - La tabla de movimientos y su texto "N de M" dejan afuera los `dgmit` anulados.

- [ ] **Step 1: Write the failing tests:**
  - `seguimiento-pdf` (con `pdf-lector`):
    - `'con nota: el tramo dice Nota DGMIT / Solicitud 156/26. Recibida el …, en violeta y lleno'`;
    - `'con nota: el renglón Al área nombra la nota'`;
    - `'sin nota: Nota formal / Pendiente de carga'`;
    - `'la fila de la nota DGMIT en los movimientos, y la anulada no'`;
    - `'la leyenda dice Nota DGMIT al área solo si hay una marca'`;
    - `'con nota sigue en una hoja, con 8 renglones y sin pisadas'`;
    - `'el anexo: una hoja con nota y otra sin; la sin nota dice La manda la DGMIT al área y nunca Pendiente de carga'`.
  - `notas-motor`:
    - `'el anexo de una reiteración real sin notas DGMIT no dice Pendiente de carga en ninguna hoja'`;
    - `'si la tabla de notas DGMIT falta, la reiteración se genera con su anexo'`. Molde: los tests del anexo que ya existen; para la tabla faltante, el `RENAME TABLE` de Task 6 en la base de prueba del motor.
- [ ] **Step 2: Run** `node --test tests/seguimiento-pdf.test.js tests/notas-motor.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** según Interfaces.
- [ ] **Step 4: Run** los dos archivos, `tests/notas-api.test.js` y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: la nota DGMIT en el PDF del Seguimiento y el anexo neutral de la reiteración`.

### Task 9: El Seguimiento según quién mira

**Files:**
- Modify: `controllers/seguimientoController.js` (`verSeguimiento` :43-54).
- Test: `tests/seguimiento-api.test.js`.

**Interfaces:**
- Consumes: `conNotasDgmitEditables` (Task 7).
- Produces: `GET /api/seguimiento/:id` aplica `conNotasDgmitEditables(seguimiento, { usuarioId: req.user.userId, administracion: esAdmin(req.user.rol) })`, además de `sinErroresTecnicos` para quien no es administración. `GET /api/seguimiento` ya trae `requiere_nota` y `nota_dgmit` por Task 7.

- [ ] **Step 1: Write the failing tests** (`seguimiento-api`, sobre su base propia):
  - `'el colaborador que la cargó ve editable: true; otro colaborador y el lector, false; el admin, true'`;
  - `'la respuesta no trae por_id'`;
  - `'la lista trae requiere_nota y nota_dgmit'`.
- [ ] **Step 2: Run** `node --test tests/seguimiento-api.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** el archivo y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: el Seguimiento dice quién puede corregir cada nota DGMIT`.

### Task 10: La pantalla: la nota en la lista, el circuito, la cinta y los movimientos

**Files:**
- Modify: `public/js/seguimiento.js`:
  - `FILTROS_MOVIMIENTOS` (:34), `TIPOS_DE_MARCA` (:41) y `LEYENDA_CINTA` (:61);
  - `htmlDeFilaDeLista` (:204-217), `htmlDelCircuito` (:314-330) e `iconoDeCinta` (:342-363);
  - `htmlDelCuerpo` (:562-576) y `htmlDeMovimiento` (:579-589).
- Modify: `public/seguimiento.html`: la columna en el `<thead>` (:337-344), los estilos (los de `mock.css` de la maqueta: el tramo `registrada`, `.mk-dgmit`, `.i-dgmit`, `.sg-mov.anulada`, `.nota-dgmit` y `--sg-violeta`) y el `?v=` de `seguimiento.js`.
- Modify: `tests/paginas.test.js` (`VERSION_SEGUIMIENTO`).
- Test: `tests/seguimiento-frontend.test.js`.

**Interfaces:**
- Consumes: lo que manda el servidor (Tasks 7 y 9).
- Produces (puro):
  - `TIPOS_NOTA_DGMIT = { solicitud: 'Solicitud', reiteracion: 'Reiteración' }` y `TIPOS_NOTA_DGMIT_LARGOS` (`'Solicitud: la primera vez que se le piden los datos al área'` y `'Reiteración: ya se le habían pedido y se le vuelven a pedir'`). Son copias de `TEXTO_TIPO_NOTA_DGMIT`, atadas por un test de paridad.
  - La fila de la lista suma `<td class="nota-dgmit"><b>N° 156/26</b><small>Solicitud, recibida el 22/10/2026</small></td>`, o `<td class="nota-dgmit">—</td>`.
  - `htmlDelCircuito`: `sg-flecha registrada` si `tramoFuera.registrada`, y si no, `sg-flecha fuera`.
  - `iconoDeCinta('dgmit', cx, cy)`: `<rect … width="10" height="13" rx="1.5" class="i-dgmit"/>`.
  - `htmlDelCuerpoDeNotaDgmit(extra)`:
    - Filas: Número de nota DGMIT, Tipo de nota (el largo), Recibida por el área, Área, Datasets de la nota (uno por renglón), Cargada (`momentoEnTexto(cargada), por <por>`).
    - Por cada entrada del historial, "Corregida" o "Anulada" con `momentoEnTexto(momento), por <por>: <motivo>`.
    - Si `extra.editable && !extra.anulada`, botones `Corregir` y `Anular` (`class="sg-link"`, `data-accion="corregir-nota"` y `"anular-nota"`, `data-nota="<nota_id>"`).
    - Todo pasa por `escaparTexto`.
  - `htmlDeMovimiento`: con `m.tipo === 'dgmit' && m.extra?.anulada`, el `<li>` lleva la clase `anulada`.

- [ ] **Step 1: Write the failing tests** (`seguimiento-frontend`, en el `vm`, con seguimientos armados por `seguimientoDe` sobre los casos más `notasDgmit`):
  - `'la lista tiene la columna Última nota DGMIT al área: con nota y con —'`;
  - `'el circuito con nota usa sg-flecha registrada; sin nota, fuera, con Pendiente de carga'`;
  - `'el filtro Notas DGMIT aparece con su cantidad, después de Emails al área'`;
  - `'la leyenda incluye Nota DGMIT al área'`;
  - `'el ícono de la cinta de una nota DGMIT'`;
  - `'el detalle de una nota DGMIT: filas, correcciones y botones solo si editable'`;
  - `'la anulada: li con clase anulada, sin botones, con la fila Anulada'`;
  - `'TIPOS_NOTA_DGMIT del navegador = TEXTO_TIPO_NOTA_DGMIT del servidor'`;
  - `'un texto con < > & en el número o el motivo llega escapado'`.
  - `paginas`: la versión nueva.
- [ ] **Step 2: Run** `node --test tests/seguimiento-frontend.test.js tests/paginas.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** `VERSION_SEGUIMIENTO = '20261124'`.
- [ ] **Step 4: Run** los dos archivos y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: la nota DGMIT en la pantalla del Seguimiento (lista, circuito, cinta y movimientos)`.

### Task 11: La pantalla: cargar, corregir y anular

**Files:**
- Modify: `public/seguimiento.html`:
  - el botón en `.page-header` (:299-305), `hidden` hasta que el script lo muestre;
  - `#modal-nota` y `#modal-anular`, con el marcado de la maqueta `2-dataset.html` y las clases `sg-*`;
  - sus estilos;
  - el `?v=` de `seguimiento.js`.
- Modify: `public/js/seguimiento.js`: lo puro, en una sección nueva antes de "La página (DOM y API)" (:620); el DOM y la API, al final.
- Modify: `tests/paginas.test.js` (`VERSION_SEGUIMIENTO = '20261125'`).
- Test: `tests/seguimiento-frontend.test.js`.

**Interfaces:**
- Consumes: la API de Task 5 (por `API.pedirJson`), la lista de `GET /api/seguimiento` (`requiere_nota`, `nota_dgmit`, `estado`, `dias`, `proxima`, `area`, `activo`, `tipo_gestion`) y `Auth.puedeCargarNotasDgmit()` (Task 3).
- Produces (puro, en el `vm`):
  - `MENSAJES_NOTA_DGMIT`: copia de la del servidor, atada por un test de paridad.
  - `datasetsParaElegir(filas, incluir = [])` → las filas activas, externas y con `requiere_nota !== 0`, más las de `incluir` (ids) aunque no cumplan.
  - `estaEnElAlcanceInicial(fila)` → `fila.estado === 'vencido' || fila.estado === 'proximo'`.
  - `textoDeEstadoDeOpcion(fila)` → `['vencido'|'proximo'|'', texto]`: "Vencido hace N días", "Vence en N días", "Vence el dd/mm/aaaa", "Sin fecha" o "Sin vencimiento", como en la maqueta.
  - `htmlDeOpcionesDeNota(filas, elegidos)`: grupos por área (áreas y títulos en orden alfabético, `localeCompare` 'es'), con un checkbox por dataset (`value` = id), `data-titulo` y la marca de alcance.
  - `htmlDeElegidos(filas, ids)`: "N datasets elegidos:" y las etiquetas con su botón de quitar, o "Todavía no elegiste ningún dataset.".
  - `textoDePistaDeSolicitud(filas, ids, tipo, excluirNumero = null)` → `''` o los renglones de la spec, sección 2, más "Si se le vuelven a pedir los datos, es una reiteración.".
  - `erroresDelFormularioDeNota({ numero, recibida, tipo, datasets, motivo }, { hoy, conMotivo })` → errores por campo, con las reglas de `validarNotaDgmit` y `validarMotivo` y los mismos mensajes.
- DOM (al final del archivo):
  - Mostrar el botón si `Auth.puedeCargarNotasDgmit()`.
  - Abrir y cerrar: foco al primer campo y de vuelta al botón, Escape, clic en el velo.
  - Los botones de alcance, el buscador (sin tildes ni mayúsculas, `textoParaBuscar`), las etiquetas y la pista.
  - Los errores en su campo (`aria-invalid` y `aria-describedby`; el foco va al primero).
  - Guardar: `POST /notas-dgmit` o `PUT /notas-dgmit/:id` con `API.pedirJson`. Un error del servidor con `campo` va a ese campo; sin `campo`, `avisarError`. Si sale bien: `showToast(Utils.escapeHtml(message), 'success')`, cerrar y volver a pedir la vista (`cargarLista()` o `cargarDataset(id)` y `cargarSugerencias()`).
  - "Corregir" (en `#sg-movimientos`) abre el mismo formulario: título "Corregir nota DGMIT N° …", los datos de `extra`, el campo del motivo visible, el botón "Guardar corrección", el pie de la corrección e `incluir` = los datasets de la nota.
  - "Anular" abre `#modal-anular` con el texto de la spec, sección 3 ("de su dataset" con uno; "de sus N datasets" con más) y el motivo obligatorio.
  - Desde un dataset, el formulario abre con ese dataset elegido si está en `datasetsParaElegir`. Si no está en el alcance inicial, abre en "Todos".
  - La lista de datasets sale de `vista.filas`, que ya cargan `cargarLista` y `cargarSugerencias`. Si está vacía, se pide `GET /seguimiento` al abrir.
  - Hoy, en el navegador: `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())`, una copia de `hoyEnArgentina` de `admin-fechas.js`.

- [ ] **Step 1: Write the failing tests** (`seguimiento-frontend`):
  - `'MENSAJES_NOTA_DGMIT del navegador = los del servidor'`;
  - `'datasetsParaElegir: deja afuera internos, No e inactivos; incluir los suma'`;
  - `'textoDeEstadoDeOpcion para vencido, próximo, actualizado, sin fecha y eventual'`;
  - `'htmlDeOpcionesDeNota: agrupado por área en orden, con los elegidos marcados y los textos escapados'`;
  - `'htmlDeElegidos con 0, 1 y 2'`;
  - `'textoDePistaDeSolicitud: con Solicitud y un dataset con nota en el ciclo; con Reiteración, vacío; excluye el número que se corrige'`;
  - `'erroresDelFormularioDeNota da lo mismo que validarNotaDgmit en los casos de borde'` (los de Task 4, recorridos en un loop contra el servidor);
  - `'cargar la página no hace nada en el vm'` (el test de carga que ya existe sigue pasando);
  - `'la página tiene el botón Cargar nota DGMIT oculto, el formulario y el modal de anular, con sus ids'` (lee el HTML).
- [ ] **Step 2: Run** `node --test tests/seguimiento-frontend.test.js tests/paginas.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** los dos archivos y `npm test`. Expected: PASS.
- [ ] **Step 5: Verificación en el navegador.** Servidor del worktree en un puerto propio (3002), contra la base de la rama, con un usuario colaborador y uno lector de prueba. Recorrer:
  - cargar una nota (errores, número repetido, pista y aviso de éxito) y que aparezca en la lista, el circuito, la cinta y los movimientos;
  - corregirla, anularla, y que el lector no vea el botón.
  - Capturas como prueba.
  - Las notas y los usuarios de prueba se borran al terminar.
- [ ] **Step 6: Commit** `feat: cargar, corregir y anular notas DGMIT desde el Seguimiento`.

### Task 12: Documentación, kit y cierre

**Files:**
- Modify: `CLAUDE.md`:
  - Roles: colaborador.
  - Base de datos: 27 tablas, las tres nuevas y la migración.
  - Seguimiento del dataset: se saca "no hay carga manual de movimientos" y "Sin tablas, columnas ni migraciones nuevas", y se apunta a la sección nueva.
  - Sección nueva "Notas DGMIT (spec 2026-10-24-notas-dgmit)": quién carga, el formulario, corregir y anular, la nota en el circuito, la lista, la cinta, el PDF y el anexo neutral, la API y los tests.
  - Las copias mínimas nuevas (`Auth.puedeCargarNotasDgmit`, `MENSAJES_NOTA_DGMIT`, `TIPOS_NOTA_DGMIT`, `hoyEnArgentina` en `seguimiento.js`).
- Modify: `README.md`: la sección "Migración: notas DGMIT" (antes del código; la vuelta atrás), el árbol y la tabla de migraciones.
- Modify: `docs/superpowers/specs/2026-10-20-seguimiento-dataset-design.md`, línea 63: una nota que dice que la decisión se revirtió el 24/10/2026, con la spec nueva.
- Create (fuera del repo): `C:/Users/Mariano/Desktop/RPAD-deploy-notas-dgmit/`, con:
  - `PASOS.txt` en ASCII;
  - las dos migraciones;
  - `archivos-notas-dgmit.zip` (`git archive` de los archivos cambiados);
  - `vuelta-atras/archivos-anteriores.zip` (los mismos archivos en main, c4ea542).

- [ ] **Step 1: Docs** (CLAUDE.md, README y la nota en la spec del Seguimiento).
- [ ] **Step 2: Run** `npm test` completo. Expected: todos pasan, salvo los omitidos de la línea de base.
- [ ] **Step 3: Kit.** `PASOS.txt`:
  1. la migración en phpMyAdmin, con la verificación (`SHOW TABLES LIKE 'notas_dgmit%'` y el rol);
  2. subir los archivos del zip;
  3. Restart en Setup Node.js App;
  4. controles: el Seguimiento de un dataset dice "Pendiente de carga" o "Todavía no hizo falta"; Usuarios ofrece Colaborador; Correos → Vista previa de una reiteración → "Ver anexo" dice "La manda la DGMIT al área".
  - Opcional, después: pasar la cuenta de la DGMIT a Colaborador desde Usuarios.
- [ ] **Step 4: Commit** `docs: notas DGMIT en el Seguimiento`.
- [ ] **Step 5:** revisión final de toda la rama. Merge a main y push, solo con el OK del usuario.
