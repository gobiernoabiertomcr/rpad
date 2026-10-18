# El aviso sin fecha sugerida y la frecuencia con "(Acumulado)" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El aviso deja de mostrar "Fecha sugerida de envío", el anexo, el admin y el email de 40 días dejan ese nombre, y la frecuencia de un pedido acumulado menor al año dice "(Acumulado)".

**Architecture:** Una regla pura nueva, `frecuenciaEnNota`, en `services/fechasDatasetReglas.js`, que usan la nota, el anexo y el email, más una copia en el navegador comparada con ella en un test. El resto son cambios de columnas y de textos en los renderizadores existentes. Sin SQL ni cambios de selección.

**Tech Stack:** Node 22 (ES Modules), Express, MariaDB (mysql2), PDFKit, vanilla JS en el navegador, node:test.

**Spec:** `docs/superpowers/specs/2026-10-17-fechas-datasets-design.md`, sección 18 (y las secciones 2, 8 y 9, anotadas con el cambio).

## Global Constraints

- ES Modules, arrow functions, async/await; español en nombres, comentarios y textos.
- Las fechas son texto `'AAAA-MM-DD'`; `formatoCorto` da `dd/mm/aaaa`.
- Sin SQL ni migraciones: la base no cambia. `notas_digitales_datasets.vencimiento` no se toca.
- No cambia qué datasets entran en cada nota, ni los asuntos, la numeración ni la firma.
- Lo ya generado no cambia: las notas guardan su HTML, texto, PDF y anexo.
- Textos exactos (spec 18):
  - párrafo del aviso externo, final: `…con los datos del período que se indica en cada caso.`
  - frecuencia: `` `${frecuencia} (Acumulado)` `` con `Acumulado` = `NOMBRES_TIPO_PEDIDO.acumulado`
  - anexo: `Vence el dd/mm/aaaa · faltan N días` (`falta 1 día`), `Venció el dd/mm/aaaa · hace N días`, `Vence hoy`; rótulo de la línea de tiempo `Vence`
  - admin: `Vence el dd/mm/aaaa` (lista), `Vence` / `Vencido desde` (Registrar actualización), marca `Vence` (ciclo)
- Regla del proyecto: no romper nada. `npm test` completo (con `docker compose up -d` y `RPAD_TESTS_DB_LOCAL=1`) al terminar cada tarea: hoy 2204 tests, 2199 pasan, 0 fallan, 5 se saltean.
- Ningún email real. Los tests no llevan nombres de personas.
- Commits con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` al final del mensaje.

## Review Focus

1. **Un dataset sin `tipo_pedido` guardado cuyo sugerido es acumulado** (externo trimestral): tiene que decir "(Acumulado)" en la nota, el anexo y el email. El tipo que llega a los renderizadores es el efectivo de `conPedido`. Test en la Task 2 (email, a través de `datasetsExternosPorArea`) y en la Task 1 (nota, con el tipo efectivo).
2. **Frecuencia sin nombre** (null, '' o undefined): nada se rompe y cada lugar sigue con su "sin dato" ("Sin definir" en el email, "—" en el admin). Tests en las Tasks 1, 2 y 3.
3. **`meses` que no es un entero de 1 a 11** (null, 0, 12, 24, 2.5, '3'): sin "(Acumulado)". Test en la Task 1 y en la comparación de la Task 3.
4. **"Cuatrimestralmente (Acumulado)" en la tabla de 4 columnas del PDF:** ninguna palabra partida, nada fuera del margen y "Datos solicitados" la más ancha después del título. Test en la Task 1.
5. **La nota con una sección de vencidos:** los próximos van con 4 columnas, los vencidos siguen con 7 y el antecedente ocupa todas las columnas de su tabla (4 y 7). Test en la Task 1.

---

### Task 1: La regla `frecuenciaEnNota` y la nota (aviso y reiteración)

**Files:**
- Modify: `services/fechasDatasetReglas.js` (regla nueva, junto a `tipoEfectivo`)
- Modify: `services/notasDigitalesContenido.js` (`PARRAFO_INICIAL.aviso.externa` y su comentario, `columnasDe`, los `valores` de cada fila en `construirNota` y sus comentarios)
- Modify: `services/notasDigitalesPdf.js` (`PROPORCIONES` y su comentario)
- Test: `tests/fechas-reglas.test.js`, `tests/notas-contenido.test.js`, `tests/notas-pdf.test.js`, `tests/notas-motor.test.js`

**Interfaces:**
- Produces: `export const frecuenciaEnNota = ({ frecuencia, tipo, meses } = {}) => string | lo recibido`, en `services/fechasDatasetReglas.js`.
  - Si `tipo === 'acumulado'`, `meses` es un entero de 1 a 11 y `frecuencia` es un texto no vacío, devuelve `` `${frecuencia} (${NOMBRES_TIPO_PEDIDO.acumulado})` ``.
  - Si no, devuelve `frecuencia` tal cual (también null, undefined o '').
  - Las Tasks 2 y 3 la usan.

- [ ] **Step 1: Tests de la regla** (`tests/fechas-reglas.test.js`, describe nuevo `frecuenciaEnNota (spec 18)`):
  - `frecuenciaEnNota({ frecuencia: 'Trimestralmente', tipo: 'acumulado', meses: 3 })` → `'Trimestralmente (Acumulado)'`; también con meses 1, 4, 6 y 11.
  - Sin cambio con `meses` 12, 24, null, undefined, 0, -3, 2.5 y '3', con `tipo: 'acumulado'`.
  - Sin cambio con meses 3 y `tipo` `'foto'`, `'anio_anterior'`, `'ejercicio'`, `'edicion'`, `'relevamiento'`, `'eventual'`, null o `'otro'`.
  - Devuelve lo recibido con `frecuencia` null, undefined y '' (con tipo acumulado y meses 3); `frecuenciaEnNota()` no tira error y da undefined.
- [ ] **Step 2: Tests de la nota** (`tests/notas-contenido.test.js`):
  - Las columnas del aviso: `['Conjunto de datos', 'Área', 'Frecuencia', 'Datos solicitados']` y, en externa, `'Área responsable'`. El nombre del test dice 4 columnas.
  - "La sección de vencidos de un aviso usa las columnas de la reiteración": los próximos con esas 4, los vencidos con las 7 de siempre y la misma fila de vencidos de hoy.
  - Celdas del aviso: `['Dataset A', 'Área Uno', 'Anualmente', 'Del 01/01/2026 al 30/11/2026']` y `[..., 'Relevamiento actualizado']`, sin la fecha.
  - Test nuevo: con `dataset({ frecuencia_nombre: 'Trimestralmente', tipo_pedido: 'acumulado', meses: 3 })`, la tercera celda es `'Trimestralmente (Acumulado)'` en el aviso y en la reiteración. Con `tipo_pedido: 'foto'` queda `'Trimestralmente'`.
  - El antecedente: `colspan="4"` en el aviso; en "la fila del antecedente ocupa…", `[4, 7]`.
  - Texto plano del aviso: los renglones terminan en `'    Datos solicitados: Del 01/01/2026 al 30/11/2026'` y `''`, sin `Fecha sugerida de envío:`. Test nuevo: `'    Frecuencia: Trimestralmente (Acumulado)'` con el dataset trimestral acumulado.
  - Párrafo inicial: la frase pasa a `', con los datos del período que se indica en cada caso'`. El externo termina en `…(Excel, CSV, etc.), con los datos del período que se indica en cada caso.`; el interno y las reiteraciones quedan como estaban. Ningún párrafo contiene `sugerida`.
- [ ] **Step 3: Correr** `node --test tests/fechas-reglas.test.js tests/notas-contenido.test.js`. Esperado: FALLAN los tests nuevos y los cambiados.
- [ ] **Step 4: Implementar** la regla y la nota.
  - `valores` arranca con `[d.titulo, d.area_nombre, frecuenciaEnNota({ frecuencia: d.frecuencia_nombre, tipo: d.tipo_pedido, meses: d.meses }), d.pedido?.texto || RAYA]`.
  - Si la tabla no es la de próximos de un aviso, suma `formatoCorto(d.vencimiento)`, la situación y el informado, en ese orden. Las columnas de próximos de un aviso son las 4 comunes.
  - El tipo es el que trae el dataset: en las notas reales es el efectivo de `conPedido`. Verificar que todos los caminos que llegan a `construirNota` pasan por `conPedido`: avisos, reiteraciones y aviso en su fecha. Si alguno no pasa, decirlo en el informe sin cambiarlo.
  - Actualizar los comentarios que hablan de la fecha sugerida en el contenido.
- [ ] **Step 5: El PDF.**
  - `PROPORCIONES` cambia la clave `5` por `4: [30, 26, 16, 28]`. La `6` (legado) y la `7` quedan.
  - El comentario de `PROPORCIONES` dice 4 columnas y que desde el 18/10/2026 el aviso no lleva la fecha.
- [ ] **Step 6: Tests del PDF** (`tests/notas-pdf.test.js`, describe "tabla de 5 columnas…" → 4):
  - `COLUMNAS` sin 'Fecha sugerida de envío'.
  - "Datos solicitados" más ancha que Área y Frecuencia, y el título más ancho que ella: `anchos[3] > anchos[1] && anchos[3] > anchos[2]`, `anchos[0] > anchos[3]`.
  - El antecedente "a todo el ancho de las 4 columnas".
  - Los tests que cuentan notas de 5 columnas o buscan 'sugerida' (cerca de las líneas 903-925), y los que miran el final del párrafo (`endsWith('envío.')`, cerca de 976 y 1026): ahora miran 4 columnas y `endsWith('en cada caso.')`.
  - Si `AVISO_REAL` no trae `tipo_pedido` y `meses`, sumárselos como en producción: los Trimestralmente y Cuatrimestralmente, `acumulado` con 3 y 4; los Anualmente, `acumulado` con 12; el Presupuesto, `ejercicio` con 12.
  - Test nuevo: con `AVISO_REAL` (que trae "Cuatrimestralmente" acumulado), el PDF dice "(Acumulado)" en la columna Frecuencia, sin partir palabras (`fragmentos` vacío) y sin salir del margen derecho.
- [ ] **Step 7: `tests/notas-motor.test.js`** (vista previa, cerca de la línea 786): la columna y la frase ya no están; el aviso de la vista previa no contiene 'Fecha sugerida de envío'.
- [ ] **Step 8: Correr** `node --test tests/fechas-reglas.test.js tests/notas-contenido.test.js tests/notas-pdf.test.js tests/notas-motor.test.js`: PASAN. Después, `npm test` completo: 0 fallas.
- [ ] **Step 9: Commit**: `feat: el aviso sin fecha sugerida y la frecuencia con (Acumulado) en las notas`.

### Task 2: El anexo y el email de 40 días

**Files:**
- Modify: `services/notasDigitalesContenido.js`: `estadoDelAnexo`, el renglón `['Frecuencia', …]` de `construirAnexo` y los comentarios de `lineaDelAnexo`.
- Modify: `services/notasDigitalesAnexo.js`: el rótulo del fin de la línea de tiempo y los comentarios que dicen "fecha sugerida".
- Modify: `services/emailTemplates.js`: `renglonesDeDataset` y su comentario.
- Modify: `services/avisosDiariosService.js`: `datasetsExternosPorArea` y su comentario.
- Modify, si hace falta: `controllers/notificacionesController.js`. Es el ejemplo del email; tiene que traer `tipo_pedido` y `meses` si el template los necesita.
- Test: `tests/notas-anexo.test.js`, `tests/email-diseno.test.js`, `tests/avisos-diarios.test.js`, `tests/notas-api.test.js`

**Interfaces:**
- Consumes: `frecuenciaEnNota` (Task 1).
- Produces: cada dataset de `datasetsExternosPorArea` suma `tipo_pedido` (el efectivo) y `meses`, los dos de `conPedido(d, fecha)`, el mismo llamado que ya da `pedido`.

- [ ] **Step 1: Tests del anexo** (`tests/notas-anexo.test.js`):
  - El estado dice `'Vence el 31/12/2026 · faltan 30 días'` y `'Vence el … · falta 1 día'`. Con 0 días, `'Vence hoy'`. Con un vencimiento pasado, `'Venció el … · hace N días'`. Ninguno dice 'sugerida'.
  - El rótulo del final de la línea de tiempo es 'Vence'.
  - Test nuevo: la ficha de un dataset `acumulado` con meses 3 tiene `['Frecuencia', 'Trimestralmente (Acumulado)']` en `campos`; uno anual queda igual.
  - Ajustar los demás tests que fijan 'Fecha sugerida de envío' (cerca de las líneas 47, 72, 269, 283 y 360).
- [ ] **Step 2: Tests del email:**
  - `tests/email-diseno.test.js`, describe del aviso a las áreas:
    - los renglones son la frecuencia y "Datos que se solicitarán", sin "Fecha sugerida de envío";
    - test nuevo: con `{ frecuencia_nombre: 'Trimestralmente', tipo_pedido: 'acumulado', meses: 3 }`, `Frecuencia de actualización: Trimestralmente (Acumulado)`;
    - sin `frecuencia_nombre`, sigue `Sin definir`.
  - `tests/avisos-diarios.test.js`, cerca de la línea 151:
    - el texto exacto sin la fecha;
    - test nuevo con un dataset externo trimestral **sin `tipo_pedido` guardado** (NULL, el sugerido es acumulado): `datasetsExternosPorArea` le da `tipo_pedido: 'acumulado'` y `meses: 3`, y el email dice "(Acumulado)".
  - `tests/notas-api.test.js`, cerca de las líneas 748-759 (vista previa y prueba del aviso a las áreas): sin 'Fecha sugerida de envío'.
- [ ] **Step 3: Correr** `node --test tests/notas-anexo.test.js tests/email-diseno.test.js tests/avisos-diarios.test.js tests/notas-api.test.js`. Esperado: FALLAN los tests nuevos y los cambiados.
- [ ] **Step 4: Implementar.**
  - `estadoDelAnexo` usa los textos de las Global Constraints.
  - El rótulo de `dibujarLineaDeTiempo` dice `'Vence'`.
  - La ficha usa `frecuenciaEnNota({ frecuencia: f.frecuencia_nombre, tipo: f.tipo_pedido, meses: f.meses })`.
  - `renglonesDeDataset`:
    - la frecuencia es `frecuenciaEnNota({ frecuencia: d.frecuencia_nombre, tipo: d.tipo_pedido, meses: d.meses }) || 'Sin definir'`;
    - se va el renglón de la fecha. `d.vencimiento` sigue en el objeto, porque lo usan otras partes del aviso.
- [ ] **Step 5: Correr** los tests del Step 3 (PASAN) y `npm test` completo: 0 fallas.
- [ ] **Step 6: Commit**: `feat: el anexo dice Vence y el email de 40 días va sin fecha, con (Acumulado)`.

### Task 3: El admin

**Files:**
- Modify: `public/js/admin-fechas.js`. Cambian:
  - `htmlDeProximoPedido`;
  - `htmlDeDatosDelPedido`;
  - la marca del ciclo en `htmlDeCiclo` (`conEnvio` se puede renombrar);
  - `textosDeVistaPrevia`;
  - y se suma `frecuenciaEnNotaDe`.
- Modify: `public/js/admin.js`: `pintarVistaPrevia` y los comentarios de "Envío sugerido", cerca de la línea 1688.
- Modify: `public/admin.html`:
  - la tabla de "Así va a salir en la próxima nota";
  - el comentario CSS de "Envío sugerido", cerca de la línea 145;
  - las versiones `admin-fechas.js?v=20261108` y `admin.js?v=20261108`.
- Test: `tests/admin-frontend.test.js`, `tests/paginas.test.js` (`VERSION_ADMIN` → `20261108`)

**Interfaces:**
- Consumes: `frecuenciaEnNota` (Task 1), solo en el test de comparación.
- Produces: `frecuenciaEnNotaDe({ frecuencia, tipo, meses } = {})` en `admin-fechas.js`. Es la misma regla, escrita sin importar nada, porque el archivo se carga en un `vm`.
- `textosDeVistaPrevia({ titulo, gestion, solicita, frecuencia, tipo, meses } = {})` devuelve `{ cabecera, titulo, frecuencia, solicita }`.
  - `frecuencia` es `frecuenciaEnNotaDe({ frecuencia, tipo, meses })` o, sin nombre, `SIN_DATO`.
  - Ya no devuelve `fecha` ni recibe `proxima`.

- [ ] **Step 1: Tests** (`tests/admin-frontend.test.js`):
  - Comparación: `frecuenciaEnNotaDe es una copia de frecuenciaEnNota del servidor: dan lo mismo`. Recorre:
    - frecuencias `['Trimestralmente', 'Anualmente', '', null, undefined]`;
    - todos los `TIPOS_PEDIDO` más null y `'otro'`;
    - meses `[null, undefined, 0, -3, 1, 3, 4, 6, 11, 12, 24, 2.5, '3']`.
  - `textosDeVistaPrevia({ titulo: 'Pauta', gestion: 'externa', solicita: 'La planilla.', frecuencia: 'Trimestralmente', tipo: 'acumulado', meses: 3 })` da:
    - `cabecera` `'Nota Digital de gestión externa (vista previa)'`;
    - `titulo` `'Pauta'`;
    - `frecuencia` `'Trimestralmente (Acumulado)'`;
    - `solicita` `'La planilla.'`.

    Sin frecuencia da `'—'`, y `textosDeVistaPrevia()` no tira error.
  - `htmlDeProximoPedido`: dice `Vence el 31/01/2027` y no 'Fecha sugerida'. Ajustar los tests que fijaban el texto viejo, cerca de las líneas 423-550.
  - `htmlDeDatosDelPedido`: `<dt>Vence:</dt>` con la próxima de hoy en adelante y `<dt>Vencido desde:</dt>` si ya pasó (líneas 1559-1588).
  - `htmlDeCiclo`: la marca `Vence` en lugar de `Envío sugerido` (líneas 675-712, con la misma regla de "solo si no venció").
  - Ningún HTML de admin-fechas contiene 'sugerida de envío' ni 'Envío sugerido'.
  - La tabla de la vista previa en `admin.html` (test cerca de la línea 2577): encabezados `Conjunto de datos`, `Frecuencia`, `Datos solicitados`, con las celdas `form-nota-titulo`, `form-nota-frecuencia` y `form-nota-periodo`. `form-nota-fecha` ya no existe.
- [ ] **Step 2: Correr** `node --test tests/admin-frontend.test.js tests/paginas.test.js`. Esperado: FALLAN.
- [ ] **Step 3: Implementar.**
  - `admin.js`, `pintarVistaPrevia`:
    - pasa a `textosDeVistaPrevia` el nombre de la frecuencia elegida (del catálogo `frecuencias`, por `frecuencia_id`), `f.tipo_pedido` y `f.meses`;
    - escribe `form-nota-frecuencia` antes de la comparación de `edicion.clave`, igual que hoy el título, así cambia con la frecuencia aunque el pedido no se vuelva a pedir.
  - Sacar `.ad-fecha` de la vista previa si queda sin uso.
  - Revisar con `grep -n -i "sugerid" public/` que no quede "fecha sugerida" ni "Envío sugerido" en admin. `opcionesDeProxima` y la marca "Sugerida" de la próxima son otra cosa: quedan.
- [ ] **Step 4: Correr** los tests del Step 2 (PASAN) y `npm test` completo: 0 fallas.
- [ ] **Step 5: Commit**: `feat: el admin dice Vence y la vista previa muestra la frecuencia como en la nota`.

### Task 4: Documentación

**Files:**
- Modify: `CLAUDE.md`, sección "Datos solicitados en las Notas Digitales":
  - el aviso tiene 4 columnas y no lleva la fecha (desde el 18/10/2026);
  - la frecuencia lleva "(Acumulado)" si el pedido es acumulado y la frecuencia es menor al año (`frecuenciaEnNota`, spec 2026-10-17, sección 18);
  - el anexo dice "Vence";
  - el email de 40 días va sin la fecha.

  En la lista de copias mínimas del navegador, suma `frecuenciaEnNotaDe` (copia de `frecuenciaEnNota`) entre las que se comparan contra el servidor en un test.
- Modify: `README.md`:
  - línea 75 ("Próxima actualización (fecha sugerida de envío)") y línea 629 ("…dicen qué datos se solicitan y la fecha sugerida de envío…"): al estado nuevo;
  - Changelog: una entrada nueva arriba de todo, `### Aviso sin fecha sugerida y frecuencia acumulada (2026-10)`, con 3 o 4 renglones en el estilo de las vecinas.

- [ ] **Step 1:** Editar los dos archivos. Sin nombres de personas.
- [ ] **Step 2:** `grep -rn -i "fecha sugerida" services controllers public CLAUDE.md README.md`. Solo puede quedar donde se dice que ya no se usa, o lo que hable de la historia. Listar lo que quede en el informe.
- [ ] **Step 3:** `npm test` completo: 0 fallas.
- [ ] **Step 4: Commit**: `docs: CLAUDE.md y changelog del aviso sin fecha sugerida y la frecuencia acumulada`.
