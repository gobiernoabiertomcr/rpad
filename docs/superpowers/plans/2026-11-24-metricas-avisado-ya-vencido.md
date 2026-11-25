# «Avisado ya vencido» también cuando se pudo avisar a tiempo: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que un ciclo sin el aviso de la regla cuyo primer aviso llegó ya vencido cuente desde ese primer aviso, aunque se pudiera avisar a tiempo, salvo que haya fallado un email de la regla del ciclo.

**Architecture:** una condición más en `heredado`, dentro de `casoDelCiclo` (`services/metricasReglas.js`).
Todo lo demás (la vista, el modal, «Cómo se cuenta», las aclaraciones, las reiteraciones, el Ciclo de vida, la foto y los cuatro PDF) ya lee `heredado` e `inicioTramos`, y cambia solo.
La verificación compara, con el dump de producción y fuera del repo, la regla de antes y la nueva: cada cifra y cada ciclo que cambia de fecha de conteo.

**Tech Stack:** Node 22 (ES Modules), `node:test`, MariaDB (solo la copia propia `rpad_sim_<tema>`).

**Spec:** `docs/superpowers/specs/2026-11-24-metricas-avisado-ya-vencido-design.md`

## Global Constraints

- Repo público: ningún nombre real, cifra ni dato de producción en el repo, en los commits ni en las specs. Los casos de prueba de siempre (`tests/metricas-casos.js`) se usan como están; no se suma ningún dato de producción nuevo. Antes de cada commit, `grep -i -w -F -f ~/rpad-notas/palabras.txt` sobre lo que cambia da vacío.
- Ningún texto de Métricas, de los PDF ni del Seguimiento cambia (spec, 5). Lenguaje neutro.
- `VERSION_DE_LA_FOTO` sigue en 1. Métricas y la foto nunca cuentan con los 9 fijos.
- `motivoSinAviso`, `pudo_avisar`, la cobertura, los pendientes de carga y «Para completar» no cambian de resultado.
- Node: `export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:$PATH"`.
- Nunca `docker compose` desde el worktree. La base compartida es de solo lectura. Lo que escribe la verificación va a `rpad_sim_<tema>`, que se borra al final.
- Antes de la suite completa (`npm test`, con base): PLAN LISTO a la coordinadora y esperar su CONTENEDOR LIBRE. Los tests puros (`node --test tests/<archivo>`) no la necesitan.
- Commit y push de la rama al terminar cada tarea.
- Los scripts de la verificación van en `.claude/sim/` del worktree (ignorado por git); sus salidas, en `~/rpad-notas/<carpeta de la sesión>/`.
- Plazo: en producción antes del 10/01/2027 (la foto del 31/12).

## Review Focus

1. Un interno que se pudo avisar a tiempo y se avisó ya vencido: la producción del relevamiento cuenta desde el primer aviso (Tarea 2).
2. Un email de la regla que falló y el primer aviso ya vencido: sigue sin inicio de los tramos y con 'email-fallido' (el test que ya existe, `tests/metricas-reglas.test.js:303`, no cambia).
3. Un email de 40 días que falló **fuera** de la ventana del vencimiento que rige (antes de la fecha de la regla, de un vencimiento anterior): no es de la regla de este ciclo y no frena (Tarea 2).
4. Un primer aviso el mismo día del vencimiento: no es «ya vencido», no es heredado (el test 'elDia' de `:357` sigue igual).
5. Un ciclo con `venc` null: nunca es heredado (sin cambios; la condición `venc !== null` queda).

---

### Task 1: La foto de antes, con los datos reales

Antes de tocar el código: con la regla de hoy, las cifras y los PDF con el dump de producción.

**Files:**
- Create: `.claude/sim/comparar.mjs` (fuera del repo)
- Create: `~/rpad-notas/<carpeta de la sesión>/antes.json`, `~/rpad-notas/<carpeta de la sesión>/antes-pdf/` (fuera del repo)

**Interfaces:**
- Produces: `node .claude/sim/comparar.mjs <salida.json> <carpeta-pdf>` con `DB_NAME=rpad_sim_<tema>`, que escribe:
  - `vistas`: por cada combinación de `mediana|promedio` × `corridos|habiles`, de 2026 al 2026-11-24 y sin destildados: por gestión y tramo `{ clave, cifra: { valor, ciclos } | null, en_curso_n, pendientes }`, las aclaraciones (`n` y `texto`), `resultados.cobertura` (`si`, `vencimientos`, `faltan`) y `resultados.reiteraciones`;
  - `etapas`: `etapasDe` del año, con el mismo calendario;
  - `ciclos`: por cada caso de `casosDe`, `{ dataset_id, venc, heredado, inicio_tramos, motivo_sin_aviso }`;
  - en la carpeta, el texto por hoja (`lineasPorHoja` de `tests/pdf-lector.js`) de: `pdfDeMetricas({ anio: '2026' }, GENERADO)`, `pdfDeParaCompletar({ anio: '2026' }, GENERADO)`, `pdfDeCicloDeVida({ anio: '2026' }, GENERADO)` y el Informe anual de 2026 (una foto de 2026 armada con `datosDeLaFoto` y escrita en `rpad_sim_<tema>.metricas_fotos`, y `reporteInformeAnual` llamado con un `req`/`res` de mentira), con `GENERADO = { momento: '2026-11-24 21:15:00', por: 'Usuario Ejemplo' }`.

- [ ] **Step 1: Escribir `.claude/sim/comparar.mjs`** con las importaciones de `../../services/...` y `../../controllers/...`, hoy fijo `'2026-11-24'` y el calendario de `exigirLaTabla(await leerCalendario())`.

- [ ] **Step 2: Correrlo sobre la copia**

Run: `DB_NAME=rpad_sim_<tema> node .claude/sim/comparar.mjs ~/rpad-notas/<carpeta de la sesión>/antes.json ~/rpad-notas/<carpeta de la sesión>/antes-pdf`
Expected: el JSON tiene la redacción externa con la cifra que dio la reproducción (anotada en el informe, fuera del repo), y hay cuatro archivos de texto, uno por PDF.

Sin commit: nada de esto va al repo.

---

### Task 2: La regla

**Files:**
- Modify: `services/metricasReglas.js:217-221` (`motivoSinAviso`), `:241-244` (`casoDelCiclo`), y los comentarios de `:242`, `:298-305` y `:315`
- Modify: `docs/temas/metricas-y-reportes.md` (la lista de specs y las líneas 39, 53 y 57)
- Test: `tests/metricas-reglas.test.js`

**Interfaces:**
- Consumes: nada de la Tarea 1.
- Produces: `casosDe` con la forma de siempre; `heredado` con la regla nueva (spec, 3).

- [ ] **Step 1: Escribir el test que falla**, en `describe('casosDe')`, después de 'ya-vencido: sin aviso de la regla…' (`:343`):

```js
it('avisado ya vencido aunque se pudo avisar a tiempo: cuenta desde el primer aviso, salvo un email de la regla que falló (spec 2026-11-24)', () => {
  // Alta el 18/02/2026, vence el 31/03 (regla el 19/02, después del alta): se podía avisar a tiempo, y el primer aviso es el de vencidos del 01/04
  const datos = { id: 900, alta: '2026-02-18 10:00:00', proxima: '2026-03-31', ultima: '2026-02-18' };
  const vencidos = email({ tipo: 'externo-vencido', enviado: '2026-04-01 08:00:00' });
  const conNota = { notasDgmit: [notaDgmit({ recibida: '2026-04-20', datasets: [{ id: 900, titulo: 'Ejemplo' }] })] };
  const [c] = casosDel(solo(datos, { emails: [vencidos], ...conNota }));
  assert.deepEqual([c.fecha_regla, c.pudo_avisar, c.heredado, c.inicio_tramos, c.motivo_sin_aviso, c.reiteraciones_rpad],
    ['2026-02-19', true, true, '2026-04-01', 'ya-vencido', 0]);
  // La redacción cuenta del primer aviso a la nota, con su marca en el modal
  const v = vista([c], { dias: 'corridos' });
  assert.equal(cifraDel(v, 'externa', 'tramite').valor, 19);
  assert.deepEqual(modalDe(v, 'externa', 'tramite').ciclos.map((f) => [f.estado, f.desde, f.hasta, f.nota]),
    [['cuenta', '2026-04-01', '2026-04-20', 'avisado ya vencido: desde ese primer aviso']]);
  // Con un email de la regla del ciclo que falló, gana el email fallido: sin inicio y fuera de la redacción
  const fallido = email({ id: 901, tipo: 'externo-40', enviado: '2026-02-19 08:00:00', success: false });
  const [f] = casosDel(solo(datos, { emails: [fallido, vencidos], ...conNota }));
  assert.deepEqual([f.heredado, f.inicio_tramos, f.motivo_sin_aviso, f.reiteraciones_rpad], [false, null, 'email-fallido', null]);
  assert.equal(cifraDel(vista([f], { dias: 'corridos' }), 'externa', 'tramite'), null);
  // Un email de 40 días que falló antes de la fecha de la regla (de otro vencimiento) no es de la regla de este ciclo: no frena
  const deOtro = email({ id: 902, tipo: 'externo-40', enviado: '2026-01-10 08:00:00', success: false });
  const [o] = casosDel(solo(datos, { emails: [deOtro, vencidos] }));
  assert.deepEqual([o.heredado, o.inicio_tramos, o.motivo_sin_aviso], [true, '2026-04-01', 'ya-vencido']);
  // Interna: la producción del relevamiento, en curso desde el primer aviso
  const [i] = casosDel(solo({ ...datos, tipo_gestion: 'interna', proxima: '2026-04-30' },
    { emails: [email({ tipo: 'interno-vencido', enviado: '2026-05-01 08:00:00' })] }));
  assert.deepEqual([i.pudo_avisar, i.heredado, i.inicio_tramos], [true, true, '2026-05-01']);
  assert.ok(tramoDe(vista([i], { dias: 'corridos' }), 'interna', 'produccion').en_curso.n === 1);
});
```

`modalDe` es el ayudante que ya usa la suite del modal (`:3414` en adelante); si no está al alcance de `describe('casosDe')`, se sube al nivel del archivo sin cambiarlo.
Si un número no da por una regla que el test no conoce (por ejemplo, `ultima` y R7), se ajusta el dato del test, nunca la regla.

- [ ] **Step 2: Correr el test y ver que falla**

Run: `node --test --test-name-pattern="se pudo avisar a tiempo: cuenta" tests/metricas-reglas.test.js`
Expected: FAIL en el primer `deepEqual` (`heredado` false, `inicio_tramos` null).

- [ ] **Step 3: Implementar**, en `services/metricasReglas.js`:
  - en `casoDelCiclo`, antes de `pudoAvisar`: `const emailDeLaReglaFallido = avisos.some((a) => !a.enviado && deLaRegla(a));`
  - `heredado = avisoRegla === null && primerAviso !== null && venc !== null && primerAviso > venc && (!pudoAvisar || !emailDeLaReglaFallido)`;
  - `motivoSinAviso` recibe `emailDeLaReglaFallido` en lugar de `avisos` y `deLaRegla` (una sola fuente para «falló un email de la regla»), con el mismo orden de motivos;
  - los comentarios de `:242`, `:298-305` (`pudo_avisar`, `heredado`) y `:315` dicen la regla nueva, con la spec 2026-11-24.

- [ ] **Step 4: Correr el test nuevo y ver que pasa**

Run: `node --test --test-name-pattern="se pudo avisar a tiempo: cuenta" tests/metricas-reglas.test.js`
Expected: PASS

- [ ] **Step 5: Correr el archivo y actualizar los esperados del caso de prueba del 33**, que es de esta clase (vence el 31/01/2026, alta antes de su regla, primer aviso en junio). Fallan siete; cada uno cambia solo así:
  - `:343` 'ya-vencido…': el 33 da `[null, '2026-06-21', true, true, 'ya-vencido', '2026-06-21']` y el armado, `[true, true, 'ya-vencido']`; el nombre del test y su comentario dicen que ahora es avisado ya vencido (spec 2026-11-24).
  - `:858` el circuito: `aclaraciones.externa.ya_vencidos` pasa de 2 a 3, con el texto de 3.
  - `:1500` reiteraciones del RPAD: `dos_o_mas` 11 → 12, `total` 16 → 17.
  - `:1527` textos de los resultados: 'Del RPAD a la DGMIT (16 ciclos)' → '(17 ciclos)'.
  - `:1614` el aviso del 33 en «Los casos»: texto 'se avisó ya vencido' → 'avisado ya vencido'.
  - `:2787` la aclaración de la etapa: '2 ciclos…' → '3 ciclos…'.
  - `:3678` «Cómo se cuenta» del aviso, con los casos reales: externa 'cuando ya' pasa de 0 a 1 (el 33 vence en 2026); la suma pasa a ser «no tuvieron» + «cuando ya» de los que están en la cobertura = `faltan.length`; `ya_vencidos` `[2, 1]` → `[3, 1]`; el comentario dice por qué.
  - `:1395` (la cobertura, que sigue con 'se avisó ya vencido') y `:303` (email fallido) **no** cambian.

Run: `node --test tests/metricas-reglas.test.js`
Expected: `# fail 0`, 167 tests.

- [ ] **Step 6: Actualizar `docs/temas/metricas-y-reportes.md`**: sumar la spec a la lista; en las líneas 39 y 57, la definición de `heredado` de la spec (3) y el motivo en una oración (un vencimiento que se movió por fuera del RPAD se lee como uno que se pudo avisar a tiempo, y su nota no contaba; decisión del usuario del 24/11/2026); en la 53, que tampoco cuenta uno avisado ya vencido al que le falló un email de la regla. Un renglón por oración, cada uno de 600 caracteres o menos.

Run: `node --test tests/documentos.test.js`
Expected: `# fail 0`

- [ ] **Step 7: Commit y push**

```bash
git add services/metricasReglas.js tests/metricas-reglas.test.js docs/temas/metricas-y-reportes.md
git commit -m "fix(metricas): un ciclo avisado ya vencido cuenta desde su primer aviso aunque se pudiera avisar a tiempo"
git push
```

---

### Task 3: Las huellas y la referencia de los PDF

**Files:**
- Modify: `tests/metricas-huellas.test.js` (`HUELLAS.aclaraciones`, `HUELLAS.etapas`, `HUELLAS.ciclo` y el comentario de arriba)
- Modify: `tests/reportes-pdf.test.js` (`REFERENCIA_DE_LOS_PDF` y su comentario, `:2340-2349`)
- Create: `~/rpad-notas/<carpeta de la sesión>/tests-pdf-antes-despues.md` (fuera del repo)

**Interfaces:**
- Consumes: la regla de la Tarea 2.

- [ ] **Step 1: Ver que fallan solo esas**

Run: `node --test tests/metricas-huellas.test.js tests/reportes-pdf.test.js`
Expected: fallan las aclaraciones, las etapas y el PDF del Ciclo de vida (huellas) y «el PDF de Métricas y el Informe anual no cambian»; las huellas de los tramos **no** fallan.

- [ ] **Step 2: El texto de antes y de después**, hoja por hoja, de los PDF de esos tests (`lineasPorHoja`), con el código de `bcf8487` (`git stash` no: un worktree temporal de solo lectura en el scratchpad, o `git show bcf8487:services/metricasReglas.js` a un archivo aparte importado por un script de `.claude/sim/`), en `tests-pdf-antes-despues.md`.
Expected: solo cambian las líneas del avisado ya vencido de más (la aclaración con un ciclo más, las reiteraciones del RPAD con un ciclo más y la fila del 33); si cambia otra cosa, se frena y se pregunta.

- [ ] **Step 3: Actualizar las huellas y la referencia** con los valores que da el código nuevo, y en cada comentario una oración: retomadas el 24/11/2026 por la spec 2026-11-24-metricas-avisado-ya-vencido, el caso de prueba del 33 pasa a ser avisado ya vencido, comprobado con el diff de texto hoja por hoja.

Run: `node --test tests/metricas-huellas.test.js tests/reportes-pdf.test.js`
Expected: `# fail 0` en los dos.

- [ ] **Step 4: Commit y push**

```bash
git add tests/metricas-huellas.test.js tests/reportes-pdf.test.js
git commit -m "test(metricas): huellas y referencia de los PDF con el avisado ya vencido nuevo"
git push
```

---

### Task 4: La comparación con los datos reales

**Files:**
- Create: `~/rpad-notas/<carpeta de la sesión>/despues.json`, `despues-pdf/` y `comparacion.md` (fuera del repo)

**Interfaces:**
- Consumes: `comparar.mjs` de la Tarea 1.

- [ ] **Step 1: Correr el script con el código nuevo**

Run: `DB_NAME=rpad_sim_<tema> node .claude/sim/comparar.mjs ~/rpad-notas/<carpeta de la sesión>/despues.json ~/rpad-notas/<carpeta de la sesión>/despues-pdf`

- [ ] **Step 2: Armar `comparacion.md`**: una tabla con cada cifra que cambió (gestión, tramo, estadístico, unidad, antes, después), otra con las aclaraciones, la cobertura y las reiteraciones, la lista de ciclos cuya `inicio_tramos` cambió (dataset, título, vencimiento, antes → después) y, por PDF, las líneas que cambiaron en cada hoja.
Expected: cambia solo el ciclo que encontró la investigación, con las cifras que anticipa el informe (fuera del repo): la redacción externa, los avisados ya vencidos de la externa y las reiteraciones del RPAD, cada uno con un ciclo más; nada más. Si cambia otra cosa, se frena y se pregunta.

Sin commit.

---

### Task 5: Suite, revisión, merge y kit

- [ ] **Step 1: Traer el main** (`git merge origin/main`: hoy suma `7a959f6`, que no toca Métricas) y correr los tests puros de Métricas y Reportes otra vez.
- [ ] **Step 2: PLAN LISTO a la coordinadora** y esperar CONTENEDOR LIBRE.
- [ ] **Step 3: Suite completa**, en segundo plano: `npm test > ~/rpad-notas/logs/<rama>.log 2>&1`.
Expected: 0 fallas.
- [ ] **Step 4: Revisión final de la rama con Fable 5.2, esfuerzo alto**, con la spec y el plan; lo importante que encuentre se corrige y se vuelve a correr lo que toque.
- [ ] **Step 5: Merge a main y push** (squash, con el control de palabras sobre el diff), y TODO EN VERDE a la coordinadora con la comparación.
- [ ] **Step 6: Kit** `~/rpad-kits/RPAD-deploy-metricas-avisado-ya-vencido/` contra `90f7d7b` (salvo que la coordinadora diga otra base): `services/metricasReglas.js`, sin SQL, con Restart; `PASOS.txt`, `VERIFICACION.txt` (en /reportes.html, Métricas: la redacción externa con un ciclo más, y en su modal la fila con «avisado ya vencido: desde ese primer aviso») y `vuelta-atras/`, el zip sin carpeta raíz. Antes del 10/01/2027.
- [ ] **Step 7: Borrar la copia** `rpad_sim_<tema>` y anotar en el informe qué se miró.
