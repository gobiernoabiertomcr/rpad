# La nota de licencia nombra a quien se encarga de las tareas: plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que la nota de licencia de Mi espacio (la hoja del segundo paso y el Word) sume el párrafo de quien se encarga de las tareas cuando la licencia tiene persona a cargo en Configuración.

**Architecture:** `datosDeLaNota` lee la persona a cargo y el día de `autorizado_at` en la misma consulta; `leerLaNota` se la pasa a `notaDeLicencia`, que suma a la estructura la clave `encargo` (el texto o null); `htmlDeLaNota` y `parrafosDe` del Word la dibujan entre el cuerpo y el cierre.

**Tech Stack:** Node 22, ES Modules, mysql2, `docx`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-25-mi-espacio-nota-licencia-encargo-design.md`

## Global Constraints

- El texto, al pie de la letra: «Asimismo, con el objetivo de mantener el correcto flujo de trabajo, durante mi licencia {nombre}, {cargo}, se encargará de las tareas de la Dirección a mi cargo.»; sin cargo: «Asimismo, con el objetivo de mantener el correcto flujo de trabajo, durante mi licencia {nombre} se encargará de las tareas de la Dirección a mi cargo.».
- El cargo de un contratado (`vinculo === 'contrato'`) con `cargoEnTexto` de `services/notasDigitalesContenido.js`: «personal contratado, cumpliendo funciones de {cargo}».
- Nombres de prueba inventados (repo público): ninguno de la tabla `usuarios`.
- Las reglas puras sin pool ni `Date` local; ninguna función de la nota tira.
- Un renglón por oración en los documentos; `docs/temas/` sin «pasó a» ni historia.

## Review Focus

1. Un nombre o un cargo con `&`, `<` o comillas: la hoja lo escapa y el Word no se daña (Task 1 y Task 2).
2. Un cargo de puros espacios cuenta como sin cargo; un nombre de puros espacios, como sin persona (Task 1).
3. `autorizado_at` a las 22:30 hora argentina da ese día, no el siguiente (Task 3).
4. Una licencia corregida después de elegir la persona sigue con el día de la corrección (`updated_at` más nuevo) (Task 3).
5. La licencia de Configuración anulada no da párrafo aunque conserve `autorizado_id` (Task 3).

---

### Task 1: la nota pura

**Files:**
- Modify: `services/miEspacioNota.js` (`notaCon`, `notaDeLicencia`, `notaDeRestitucion`, `htmlDeLaNota` y sus comentarios)
- Test: `tests/mi-espacio-nota.test.js`

**Interfaces:**
- Produces: `notaDeLicencia(licencia, { …, encargo })` con `encargo` = `{ nombre, cargo, vinculo }` opcional; la nota suma `encargo: string | null`. `notaDeRestitucion` da `encargo: null`. `htmlDeLaNota(nota)` dibuja `renglon(nota.encargo, 'sangria justificado') + vacios(1)` después del cuerpo y su vacío, solo si es un texto no vacío.

- [ ] **Step 1: tests que fallan**, en un `describe('el párrafo de quien se encarga de las tareas')`:
  - planta `{ nombre: 'Tomás Ibáñez', cargo: 'Coordinador de Sistemas', vinculo: 'planta_permanente' }` → `nota.encargo === 'Asimismo, con el objetivo de mantener el correcto flujo de trabajo, durante mi licencia Tomás Ibáñez, Coordinador de Sistemas, se encargará de las tareas de la Dirección a mi cargo.'`;
  - contratado `{ nombre: 'Paula Benítez', cargo: 'Analista de Datos', vinculo: 'contrato' }` → «… durante mi licencia Paula Benítez, personal contratado, cumpliendo funciones de Analista de Datos, se encargará …»;
  - sin cargo (`null`, `''` y `'   '`), de planta o contratado → «… durante mi licencia Marta Ríos se encargará de las tareas de la Dirección a mi cargo.»;
  - sin `encargo`, con `null`, con `'texto'`, con `{}` y con `{ nombre: '   ' }` → `nota.encargo === null` y el resto de la nota igual a la de sin `encargo` (`deepEqual` sin la clave);
  - el cuerpo, el cierre y la firma no cambian con `encargo`;
  - `notaDeRestitucion(…)` → `nota.encargo === null`;
  - «la nota tiene exactamente las claves del contrato»: la lista suma `'encargo'`;
  - `htmlDeLaNota`: con encargo, `…<p class="sangria justificado">{cuerpo}</p><p></p><p class="sangria justificado">{encargo}</p><p></p><p class="sangria">{cierre}</p>…`; sin encargo, el HTML de hoy; con `nombre: 'Ana <b> & "Co"'`, escapado (`Ana &lt;b&gt; &amp; &quot;Co&quot;`).
- [ ] **Step 2:** `node --test tests/mi-espacio-nota.test.js` → fallan los nuevos.
- [ ] **Step 3:** implementar. El texto en una función interna `textoDelEncargo(encargo)` → string o null, con `textoDe` para nombre y cargo y `cargoEnTexto({ cargo, contratado: vinculo === 'contrato' })`; `notaCon` recibe `encargo` (por defecto null). Actualizar el comentario de `notaDeLicencia` y el de `htmlDeLaNota`.
- [ ] **Step 4:** `node --test tests/mi-espacio-nota.test.js` → todo verde.
- [ ] **Step 5:** commit `feat(mi-espacio): la nota de licencia nombra a quien se encarga de las tareas`.

### Task 2: el Word

**Files:**
- Modify: `services/miEspacioNotaWord.js` (`parrafosDe` y su comentario, el JSDoc de `renderNotaDocx`)
- Test: `tests/mi-espacio-nota-word.test.js`

**Interfaces:**
- Consumes: `nota.encargo` (Task 1).
- Produces: el párrafo del encargo, después del cuerpo y su vacío, con `{ ...CON_SANGRIA, alignment: AlignmentType.JUSTIFIED }`, y un vacío; con `encargo` null o vacío, los párrafos de hoy.

- [ ] **Step 1: tests que fallan**, con `notaDeLicencia(LICENCIAS.vacaciones, { fecha: FECHA, persona: PLANTA, feriados: FERIADOS, encargo: CONTRATADA })`:
  - `parrafosDelWord`: después del cuerpo, un vacío, el encargo (`justificado` y sangría 709 en el primer renglón, como el cuerpo), un vacío y el cierre;
  - «los mismos renglones que la vista»: con encargo, el Word y `htmlDeLaNota` dan la misma lista;
  - un nombre con `&`, `<` y un carácter de control (`'\u0001'`): el Word abre y el texto sale sin el control (como hoy con `textoParaWord`);
  - las comparaciones con los Word de las maquetas (notas A y B) siguen sin tocarse y verdes.
- [ ] **Step 2:** `node --test tests/mi-espacio-nota-word.test.js` → fallan los nuevos.
- [ ] **Step 3:** implementar en `parrafosDe` (el párrafo y su vacío solo si `textoDe(nota.encargo)` no es '').
- [ ] **Step 4:** `node --test tests/mi-espacio-nota-word.test.js tests/mi-espacio-nota.test.js tests/notas-word.test.js` → verde.
- [ ] **Step 5:** commit `feat(mi-espacio): el Word de la licencia con el párrafo del encargo`.

### Task 3: la persona a cargo desde la base, la fecha y el documento

**Files:**
- Modify: `services/miEspacioDatos.js` (`datosDeLaNota` y su comentario), `controllers/miEspacioController.js` (`leerLaNota`), `docs/temas/mi-espacio-nota-word.md`
- Test: `tests/mi-espacio-api.test.js` (en `describe('la nota de una licencia')`)

**Interfaces:**
- Consumes: `notaDeLicencia(…, { encargo })` (Task 1).
- Produces: `datosDeLaNota(usuarioId, licenciaId, conexion)` → `{ guardada, nombre, cargo, vinculo, encargo }` o null, con `encargo` = `{ nombre, cargo, vinculo }` o null y `guardada` el día más nuevo entre el de `updated_at` (como hoy) y `DATE_FORMAT(ul.autorizado_at, '%Y-%m-%d')` (solo con persona).
  La consulta: `LEFT JOIN usuarios_licencias ul ON ul.id = l.licencia_oficial_id AND ul.usuario_id = l.usuario_id AND ul.anulada = 0 LEFT JOIN usuarios a ON a.id = ul.autorizado_id`.

- [ ] **Step 1: tests que fallan** (con `comoTitular('adminB')`, `conFirma('adminA')`, unas vacaciones de adminB con `autorizado_id: usuarios.adminA.id` y el cargo de adminA con `conCargo`):
  - `…/nota`: el `html` tiene el párrafo con el nombre de adminA y su cargo; `…/word`: el `document.xml` lo tiene;
  - sin persona (`autorizado_id` null): ni el html ni el Word lo tienen;
  - con la de Configuración anulada por SQL (`UPDATE usuarios_licencias SET anulada = 1`): no lo tiene;
  - la fecha: `updated_at` el `2026-11-20T15:00:00Z` y `autorizado_at` `'2026-12-01 22:30:00'` → `data.fecha === '2026-12-01'` y la aclaración con «01/12/2026»; con `autorizado_at` `'2026-11-10 09:00:00'` → `'2026-11-20'`.
- [ ] **Step 2:** `node --test tests/mi-espacio-api.test.js` (con `docker compose` ya arriba, sin levantarlo desde el worktree) → fallan los nuevos.
- [ ] **Step 3:** implementar `datosDeLaNota` y pasar `encargo` en `leerLaNota`.
- [ ] **Step 4:** `node --test tests/mi-espacio-api.test.js tests/permisos.test.js` → verde.
- [ ] **Step 5:** `docs/temas/mi-espacio-nota-word.md`: en «La nota», el párrafo (cuándo, el texto, el contratado y sin cargo, dónde va, que no dice «a cargo» porque ni un contratado ni la planta transitoria pueden quedar a cargo de una Dirección) y la fecha con `autorizado_at` y su límite; en «La API», que `datosDeLaNota` trae `encargo`. `node --test tests/documentos.test.js` → verde.
- [ ] **Step 6:** commit `feat(mi-espacio): la nota lee la persona a cargo de Configuración`.

### Cierre

- [ ] `npm test` completo → el mismo resultado que antes de empezar, más los tests nuevos.
- [ ] Revisión final con Fable 5.2, esfuerzo alto; los hallazgos reales, arreglados con su test.
- [ ] Merge en main, push y kit `~/rpad-kits/RPAD-deploy-mi-espacio-nota-encargo` contra ce6798b (4 archivos, sin SQL).
