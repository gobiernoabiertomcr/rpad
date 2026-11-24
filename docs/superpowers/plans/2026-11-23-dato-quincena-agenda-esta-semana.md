# «Esta semana» en la agenda del dato de la quincena: plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** la agenda de una edición, en la página y en el mail, separa los eventos de la semana de la edición en «Esta semana», antes de «Lo que viene».

**Architecture:** solo cambia la regla pura `gruposDeLaAgenda` (`services/datoQuincenaReglas.js`), que pasa de tres grupos a cuatro.
`agenda_grupos` conserva su forma, y la página (`htmlDeLaAgenda`) y la plantilla del mail (`datoQuincenaTemplate`) ya dibujan los grupos que lleguen: no se tocan.

**Tech Stack:** Node 22, ES Modules, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-23-dato-quincena-agenda-esta-semana-design.md`

## Global Constraints

- Los cuatro títulos, exactos y en este orden: «Lo que pasó», «Esta semana», «Lo que viene», «Efemérides».
- «Esta semana»: eventos (sin `tipo` o con `evento`) con `fecha_edicion <= fecha <= domingo de la semana de fecha_edicion`; la semana va de lunes a domingo.
- «Lo que viene»: eventos con `fecha >` ese domingo. «Lo que pasó» y «Efemérides», como hoy.
- Sin `Date` local para fechas de negocio: el domingo sale de `sumarDias` (ya importado de `notasDigitalesCalendario.js`) y del `diaDeLaSemana` privado del mismo archivo.
- No cambian: el contrato, la validación, `agenda` del detalle, `public/js/dato-quincena.js` (sin `?v=` ni `VERSION_DATO_QUINCENA` nuevos), `public/dato-quincena.html`, `services/emailTemplates.js`, `modeloDelMail`, la base.
- No cambian `tests/fixtures/dato-quincena-respuestas.json` ni `tests/dato-quincena-resguardo.test.js` y su fixture: si alguno falla, la regla está mal.
- Repositorio público: eventos inventados en los tests, ningún dato de la edición real.
- Comentarios y textos en castellano; un renglón por oración en `docs/temas/`.

## Review Focus

1. Una edición de un domingo (un piloto): «Esta semana» es solo ese día y el lunes siguiente ya es «Lo que viene» (Task 1, `una edición de un domingo`).
2. El borde de una regular (lunes): el domingo (día 6) va en «Esta semana» y el lunes siguiente (día 7) en «Lo que viene» (Task 1, `el domingo de la semana y el lunes siguiente`).
3. Una semana que cruza el mes y el año (lunes 28/12/2026, domingo 03/01/2027): la comparación de textos no se confunde (Task 1, `una semana que cruza el año`).
4. Una efeméride de la semana de la edición sigue en «Efemérides», no en «Esta semana» (Task 1, `una efeméride de esta semana`).
5. Los cuatro grupos a la vez, en la página y en el mail, en su orden (Task 2).

---

### Task 0: Esperar el turno

- [ ] **Step 1:** no empezar hasta que la coordinadora diga que la votación de la principal está en main y dé CONTENEDOR LIBRE.
- [ ] **Step 2:** traer main a la rama.

Run: `git fetch origin && git rebase origin/main`
Expected: sin conflictos (esta rama solo tiene la spec y este plan).
Después de cada tarea, `git diff <sha de la coordinadora> -- services/datoQuincenaReglas.js` trae solo `GRUPOS_DE_LA_AGENDA`, `domingoDeLaSemana` y sus comentarios; si trae algo más, avisarle a la coordinadora.

- [ ] **Step 3:** el `.env` del worktree con `RPAD_TESTS_DB_LOCAL=1` y la base compartida ya migrada con la votación; correr la suite completa antes de tocar nada.

Run: `export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:$PATH" && npm test`
Expected: 0 fallan. Anotar los totales para compararlos al final.

### Task 1: La regla «Esta semana»

**Files:**
- Modify: `services/datoQuincenaReglas.js` (`GRUPOS_DE_LA_AGENDA`, su comentario y el JSDoc de `gruposDeLaAgenda`, hoy en :1140-1164)
- Test: `tests/dato-quincena-reglas.test.js` (`describe('gruposDeLaAgenda')`, hoy en :2803-2902)
- Test: `tests/dato-quincena-correo-reglas.test.js` (el caso «la agenda en sus tres grupos…», hoy en :1576-1612)

**Interfaces:**
- Produces: `gruposDeLaAgenda(agenda, fechaDeLaEdicion)`, misma firma y misma forma de salida (`[{ titulo, eventos: [{ fecha_texto, titulo, detalle, url }] }]`), ahora con hasta cuatro grupos.

- [ ] **Step 1: Cambiar los tests que hoy esperan en «Lo que viene» un evento de la semana de la edición** (`tests/dato-quincena-reglas.test.js`), y el comentario del `describe` (cuatro grupos, spec 2026-11-23-dato-quincena-agenda-esta-semana):
  - `los tres grupos con la edición del piloto 14…` pasa a `los cuatro grupos con la edición del piloto 14…` (edición del sábado 14/11, domingo 15/11):
    `[{ 'Lo que pasó', [agenda[0]] }, { 'Esta semana', agenda.slice(1, 3) }, { 'Lo que viene', agenda.slice(3, 5) }, { 'Efemérides', agenda.slice(5) }]`, con `enElGrupo`; el resto del caso, igual.
  - El del orden, con la edición del lunes 16/11 (domingo 22/11):
    `['Lo que pasó', ['Pasó 03', 'Pasó 12 primero', 'Pasó 12 segundo']]`, `['Esta semana', ['Viene 20 primero', 'Viene 20 segundo']]`, `['Lo que viene', ['Viene 25', 'Viene en diciembre']]`, `['Efemérides', ['Efeméride 18', 'Efeméride 18 otra', 'Efeméride 30']]`.
  - El del mismo día pasa a `un evento del mismo día de la edición va a «Esta semana»; uno del día anterior, a «Lo que pasó»`: `[['Lo que pasó', ['Ayer']], ['Esta semana', ['Hoy']]]`.
  - `sin tipo es un evento…`: `[['Lo que pasó', ['Sin tipo, pasó', 'Con tipo, pasó']], ['Esta semana', ['Sin tipo, viene', 'Con tipo, viene']]]`.

- [ ] **Step 2: Sumar los casos nuevos** en el mismo `describe`, con `eventoDeAgenda` y `titulosPorGrupo`:
  - `el domingo de la semana y el lunes siguiente`: edición lunes '2026-12-07'; eventos 'Domingo' '2026-12-13' y 'Lunes siguiente' '2026-12-14' → `[['Esta semana', ['Domingo']], ['Lo que viene', ['Lunes siguiente']]]`.
  - `una edición de un domingo`: edición '2026-11-22'; eventos 'El mismo domingo' '2026-11-22' y 'Lunes' '2026-11-23' → `[['Esta semana', ['El mismo domingo']], ['Lo que viene', ['Lunes']]]`.
  - `una semana que cruza el año`: edición lunes '2026-12-28'; eventos 'Fin de año' '2026-12-31', 'Domingo de enero' '2027-01-03' y 'Lunes de enero' '2027-01-04' → `[['Esta semana', ['Fin de año', 'Domingo de enero']], ['Lo que viene', ['Lunes de enero']]]`.
  - `una efeméride de esta semana va a «Efemérides»`: edición '2026-11-16'; efeméride 'Efeméride del jueves' '2026-11-19' y evento 'Evento del jueves' '2026-11-19' → `[['Esta semana', ['Evento del jueves']], ['Efemérides', ['Efeméride del jueves']]]`.
  - `los cuatro grupos, en su orden`: edición '2026-11-16'; en este orden de llegada 'Efeméride' '2026-11-30' (efemeride), 'Viene' '2026-11-24', 'Semana' '2026-11-18', 'Pasó' '2026-11-10' → títulos `['Lo que pasó', 'Esta semana', 'Lo que viene', 'Efemérides']`.

- [ ] **Step 3: Cambiar el caso del mail** (`tests/dato-quincena-correo-reglas.test.js`, «la agenda en sus tres grupos…»): pasa a «…en sus cuatro grupos…»; en el texto esperado, entre el bloque de «Lo que pasó» y el de «Lo que viene» queda
  `'Esta semana', '16/11/2026 · Lo que viene antes', 'https://datos.ejemplo.gob.ar/v1', '',` y «Lo que viene» lleva solo `'25/11/2026 · Lo que viene después', 'Uno inventado.', 'https://datos.ejemplo.gob.ar/v2', ''`.
  Los títulos inventados de los eventos no cambian.

- [ ] **Step 4: Correr y ver que fallan**

Run: `node --test tests/dato-quincena-reglas.test.js tests/dato-quincena-correo-reglas.test.js`
Expected: fallan los casos de los Steps 1 a 3 (todavía no hay «Esta semana»); los demás pasan.

- [ ] **Step 5: La regla** en `services/datoQuincenaReglas.js`:
  - Una función privada `domingoDeLaSemana(iso)`: el domingo de la semana (lunes a domingo) de una fecha 'AAAA-MM-DD' que existe, con `sumarDias(iso, (7 - DIAS_DE_LA_SEMANA.indexOf(diaDeLaSemana(iso))) % 7)` (los dos privados del archivo; 'Domingo' es el 0).
  - `GRUPOS_DE_LA_AGENDA` con cuatro entradas: «Lo que pasó» igual; «Esta semana», `!esEfemeride(e) && e.fecha >= f && e.fecha <= domingoDeLaSemana(f)`; «Lo que viene», `!esEfemeride(e) && e.fecha > domingoDeLaSemana(f)`; «Efemérides» igual.
  - El comentario de `GRUPOS_DE_LA_AGENDA` y el JSDoc de `gruposDeLaAgenda` dicen los cuatro grupos, que la semana va hasta el domingo como en los próximos de Mi espacio, y citan las dos specs (2026-11-14-dato-quincena-agenda-grupos y 2026-11-23-dato-quincena-agenda-esta-semana).

- [ ] **Step 6: Correr y ver que pasan, con los que no deberían cambiar**

Run: `node --test tests/dato-quincena-reglas.test.js tests/dato-quincena-correo-reglas.test.js tests/dato-quincena-resguardo.test.js tests/dato-quincena-frontend.test.js tests/email-diseno.test.js`
Expected: 0 fallan (el resguardo y el fixture de respuestas, sin tocar).

- [ ] **Step 7: Commit y push**

```bash
git add services/datoQuincenaReglas.js tests/dato-quincena-reglas.test.js tests/dato-quincena-correo-reglas.test.js
git commit -m "feat(dato-quincena): «Esta semana» en la agenda"
git push
```

### Task 2: Los cuatro grupos en la página y en el mail, y los documentos

**Files:**
- Test: `tests/dato-quincena-frontend.test.js` (junto a los de `htmlDeLaAgenda`, hoy en :595-660)
- Test: `tests/email-diseno.test.js` (junto a los de la agenda, hoy en :786-826)
- Modify: `docs/temas/dato-quincena.md` (:8-15 las specs, :71-73 los grupos), `docs/temas/dato-quincena-correo.md` (:6-12 las specs, :153 los grupos)

**Interfaces:**
- Consumes: la salida de Task 1 (cuatro grupos con esos títulos); `ctx.htmlDeLaAgenda`, `GRUPOS()` y `titulosDeLosGrupos` del test de la página; `mail(cambiar)`, `TITULO_DEL_GRUPO` y `titulosDeLosGrupos` del de diseño.

- [ ] **Step 1: El test de la página**, `con los cuatro grupos, cuatro columnas en su orden`: a `GRUPOS()` se le inserta en el lugar 1 `{ titulo: 'Esta semana', eventos: [{ fecha_texto: '15/11/2026', titulo: 'Jornada de la semana', detalle: 'En la semana de la edición.', url: 'https://datos.ejemplo.gob.ar/semana' }] }`;
  `titulosDeLosGrupos(html)` da `['Lo que pasó', 'Esta semana', 'Lo que viene', 'Efemérides']` y hay 4 `<div class="dq-agenda-col">`.
- [ ] **Step 2: El test del mail**, `la agenda con los cuatro grupos, en su orden`: `mail((m) => { m.agenda_grupos.splice(1, 0, { titulo: 'Esta semana', eventos: [{ fecha_texto: '09/11/2026', titulo: 'Jornada de la semana', detalle: 'En la semana de la edición.', url: 'https://datos.ejemplo.test/agenda/semana' }] }); })`;
  los títulos dan los cuatro en orden, el relleno da `['0', '12px', '12px', '12px']` y el texto plano trae `'Esta semana\n09/11/2026 · Jornada de la semana'` entre «Lo que pasó» y «Lo que viene».
  `tests/emails-fixtures.js` no cambia: lo usan otros casos que fijan el texto entero.
- [ ] **Step 3: Correr**

Run: `node --test tests/dato-quincena-frontend.test.js tests/email-diseno.test.js`
Expected: 0 fallan (la página y la plantilla ya dibujan cualquier cantidad de grupos: si uno falla, mirar el test, no tocar el código).

- [ ] **Step 4: Los documentos**, lo vigente y un renglón por oración:
  - `docs/temas/dato-quincena.md`: la spec nueva en «Historia y motivos»; en `agenda_grupos`, los cuatro grupos («Esta semana», los del día de la edición al domingo de esa semana, los dos incluidos; «Lo que viene», los de después de ese domingo) y una oración con el motivo: va hasta el domingo como en los próximos de Mi espacio, y en una regular (un lunes) son los días 0 a 6, donde caen los 3 a 6 que Datito separa en su correo.
  - `docs/temas/dato-quincena-correo.md`: la spec nueva en «Historia y motivos» y los cuatro títulos en :153.

Run: `node --test tests/documentos.test.js`
Expected: pasa (los topes).

- [ ] **Step 5: Commit y push**

```bash
git add tests/dato-quincena-frontend.test.js tests/email-diseno.test.js docs/temas/dato-quincena.md docs/temas/dato-quincena-correo.md
git commit -m "test(dato-quincena): los cuatro grupos de la agenda en la página y el mail; docs"
git push
```

### Task 3: Cierre

- [ ] **Step 1: La suite completa**, con el CONTENEDOR LIBRE de la coordinadora.

Run: `npm test`
Expected: 0 fallan, y los totales de Task 0 más los casos nuevos.

- [ ] **Step 2: Revisión final de la rama con Fable 5.2 a esfuerzo alto**, contra la spec; lo que encuentre se arregla en un commit aparte y se vuelve a correr la suite.
- [ ] **Step 3: Merge en main y push** (decisión del usuario: si todo da bien, sin pedir OK).
- [ ] **Step 4: El kit** `~/rpad-kits/RPAD-deploy-dato-quincena-agenda-esta-semana/` (zip sin carpeta raíz), sin SQL, contra el sha de main después del merge de la votación (lo da la coordinadora con el CONTENEDOR LIBRE), no contra 3b6f10a: `services/datoQuincenaReglas.js` y un `PASOS.txt`.
  El archivo ya lleva el código de la votación: el kit solo sirve con la votación desplegada.
  El `PASOS.txt`:
  1. «Desplegar DESPUÉS de RPAD-deploy-dato-quincena-principal-votacion».
  2. Un paso 0 que comprueba con GET que la votación está en producción: el `?v=` de `dato-quincena.js` que deja su kit (lo da la coordinadora).
  3. Subir el archivo y Restart en Setup Node.js App, fuera del horario de los crons.
  4. Mirar el detalle de la edición del 23/11 (General → «Agenda de la quincena»): los eventos de esa semana en «Esta semana», antes de «Lo que viene» (las cifras, solo en el `PASOS.txt`, fuera del repo).
  Desplegar antes del miércoles 09/12 a las 8:05.
- [ ] **Step 5: Aviso a la coordinadora** con el commit de main, el kit y la base del kit; borrar el worktree y la rama según la memoria (junction de `node_modules` primero).
