# Métricas: los rótulos de la tabla del modal y el número de la nota DGMIT — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que la tabla «Los ciclos (N)» del modal de cada tramo diga los rótulos que eligió el usuario y, en la redacción y en la respuesta del área, el número de la nota DGMIT junto a su fecha.

**Architecture:** el servidor (`modalDelTramo`, `services/metricasReglas.js`) arma los rótulos de las dos fechas por tramo y gestión, el rótulo nuevo de los días y el texto «(N° 7/26)» de cada ciclo; la página (`htmlDelModal`, `public/js/reportes.js`) los imprime tal cual, con «Días» y la fecha sola cuando faltan (una foto vieja). La sección del modal de `docs/temas/metricas-y-reportes.md` pasa a un documento propio.

**Tech Stack:** Node.js 22, ES Modules, `node:test`; vanilla JS en la página, cargada en un `vm` por los tests.

**Spec:** `docs/superpowers/specs/2026-11-08-metricas-modal-rotulos-design.md`

## Global Constraints

- Los rótulos, al pie de la letra (spec, 3): «Pedido DDPC vía RPAD», «Vencimiento del dato», «Días de anticipación», «Entrega de nota DGMIT», «Días de redacción y entrega», «Datos recibidos», «Días de circuito y producción», «Carga en el portal», «Días de preparación y carga», «Entrega del relevamiento», «Días de producción»; la primera columna sigue diciendo «Dataset».
- El número: «(N° 7/26)», con el «°» U+00B0 (el de «Nota DGMIT N°» del Seguimiento) y un espacio común; sin número, ''.
- El servidor arma todo texto; la página no arma rótulos ni números (Ruling 19) y todo lo del servidor pasa por `escaparTexto`.
- Las once claves del tramo que lee el Ciclo de vida no cambian (`tests/metricas-huellas.test.js`, no tocarlo).
- `VERSION_DE_LA_FOTO` sigue en 1: son claves nuevas y la página las lee con tolerancia.
- Lenguaje neutro (nunca «demora», «atraso», «tardanza»); repo público: números de nota y datasets inventados en tests y documentos.
- Ningún test nuevo toca la base ni `/api/cron/*`. La suite completa (`npm test`) se corre solo con el turno de código de la coordinadora y su «CONTENEDOR LIBRE»; nunca `docker compose` desde el worktree.
- Un renglón por oración en los documentos; ninguno de más de 600 caracteres; ningún documento de más de 60 KB.

## Review Focus

1. Una foto sin `rotulo_de_los_dias` ni `*_nota_dgmit` (o un tramo de la vista en hábiles, con `modal` null): la página tiene que poner «Días» y la fecha sola, sin «undefined» ni «null». Tarea 2, paso 1.
2. Un número de nota con `<`, `"` o `&` (la columna es texto libre de 40): sale escapado en la celda. Tarea 2, paso 1.
3. Una nota DGMIT sin número (`numero` null o ''): el ciclo dice ''. Tarea 1, paso 1.
4. Dos ciclos con notas distintas en el mismo tramo: cada fila lleva el número de su propia nota, no el del primero. Tarea 1, paso 1.
5. La interna: la carga empieza en «Entrega del relevamiento», no en «Datos recibidos», también sin ciclos. Tarea 1, paso 1.

---

### Task 1: el servidor arma los rótulos y el número (Opus: reglas)

**Files:**
- Modify: `services/metricasReglas.js` (`DEL_MODAL`, hoy 616-635; `filasDelModal`, hoy 663-686; `modalDelTramo` y su comentario, hoy 747-770)
- Test: `tests/metricas-reglas.test.js` (describe «el modal de cada tramo (spec 2026-11-07, 5 y 7)», desde 3409)

**Interfaces:**
- Produces: `tramo.modal` = `{ quien, leyenda, como_se_cuenta, lista, puntas, rotulo_de_los_dias, ciclos, vacio, grafico }`, en ese orden de claves; cada ciclo = `{ dataset_id, titulo, area, estado, desde, desde_nota_dgmit, hasta, hasta_nota_dgmit, hasta_texto, dias_texto, nota }`, en ese orden. `puntas`: `[string, string]`; `rotulo_de_los_dias`: string; `desde_nota_dgmit` y `hasta_nota_dgmit`: `'(N° 7/26)'` o `''`.

- [ ] **Step 1: Write the failing tests**

En el describe del modal:

1. «la lista: …» (hoy 3428): las claves esperadas pasan a ser las de Produces (modal con `'rotulo_de_los_dias'` después de `'puntas'`; ciclo con `'desde_nota_dgmit'` después de `'desde'` y `'hasta_nota_dgmit'` después de `'hasta'`).
2. «las dos fechas de la etapa, con el nombre de cada punta, y quién actúa» (hoy 3518): renombrarlo «… con el rótulo de cada punta y de los días …»; la aserción pasa a `[t.modal.quien, t.modal.puntas, t.modal.rotulo_de_los_dias, c.desde, c.hasta, c.hasta_texto, c.estado]` y, sin ciclos, a `[t.modal.quien, t.modal.puntas, t.modal.rotulo_de_los_dias]` (`ESPERADO[gestion][t.clave].slice(0, 3)`). Las fechas no cambian; `ESPERADO` queda:

```js
const PEDIDO = 'Pedido DDPC vía RPAD';
const NOTA = 'Entrega de nota DGMIT';
const RELEVAMIENTO = 'Entrega del relevamiento';
const AVISO = (g) => [`RPAD · gestión ${g}`, [PEDIDO, 'Vencimiento del dato'], 'Días de anticipación', '2026-02-19', '2026-03-31'];
const ESPERADO = {
  externa: {
    aviso: AVISO('externa'),
    tramite: ['DGMIT y Dirección Administrativa · gestión externa', [PEDIDO, NOTA], 'Días de redacción y entrega', '2026-02-19', '2026-03-02'],
    respuesta: ['Área responsable · gestión externa', [NOTA, 'Datos recibidos'], 'Días de circuito y producción', '2026-03-02', '2026-04-06'],
    carga: ['Datos Públicos · gestión externa', ['Datos recibidos', 'Carga en el portal'], 'Días de preparación y carga', '2026-04-06', '2026-04-08']
  },
  interna: {
    aviso: AVISO('interna'),
    produccion: ['DGMIT y Dirección de Investigación Territorial · gestión interna', [PEDIDO, RELEVAMIENTO], 'Días de producción', '2026-02-19', '2026-04-06'],
    carga: ['Datos Públicos · gestión interna', [RELEVAMIENTO, 'Carga en el portal'], 'Días de preparación y carga', '2026-04-06', '2026-04-08']
  }
};
```

3. Test nuevo, después del anterior: `it('el número de la nota DGMIT junto a su fecha: en la redacción, donde termina; en la respuesta, donde empieza; cada ciclo con el de su nota', …)`:

```js
const casos = [
  cerrado({ dataset_id: 930, titulo: 'Cerrado', nota_dgmit: notaDe('2026-03-02', { numero: '7/26' }) }),
  caso({ dataset_id: 931, titulo: 'Abierto', nota_dgmit: notaDe('2026-05-04', { numero: '12/26' }) }),
  avisado('2026-03-10', { dataset_id: 932, titulo: 'Pendiente' }),
  cerrado({ dataset_id: 933, titulo: 'Sin número', nota_dgmit: notaDe('2026-03-03', { numero: '' }) }),
  cerrado({ dataset_id: 934, titulo: 'Número nulo', nota_dgmit: notaDe('2026-03-04', { numero: null }) })
];
const v = enCorridos(casos);
const numeros = (clave) => Object.fromEntries(modalDe(v, 'externa', clave).ciclos.map((c) => [c.titulo, [c.estado, c.desde_nota_dgmit, c.hasta_nota_dgmit]]));
assert.deepEqual(numeros('tramite'), {
  Cerrado: ['cuenta', '', '(N° 7/26)'], Abierto: ['cuenta', '', '(N° 12/26)'], Pendiente: ['pendiente', '', ''],
  'Sin número': ['cuenta', '', ''], 'Número nulo': ['cuenta', '', '']
});
assert.deepEqual(numeros('respuesta'), {
  Cerrado: ['cuenta', '(N° 7/26)', ''], Abierto: ['en_curso', '(N° 12/26)', ''],
  'Sin número': ['cuenta', '', ''], 'Número nulo': ['cuenta', '', '']
});
// En los demás tramos, nunca
for (const [gestion, t] of tramosDe(v)) {
  if (gestion === 'externa' && ['tramite', 'respuesta'].includes(t.clave)) continue;
  assert.ok(t.modal.ciclos.every((c) => c.desde_nota_dgmit === '' && c.hasta_nota_dgmit === ''), `${gestion}, ${t.clave}`);
}
```

Si al correrlo alguno de esos casos no cae donde dice (por ejemplo, «Abierto» no cuenta en la redacción), ajustar el caso armado, no la regla: los mismos patrones ya se usan en el test de orden (hoy 3494-3516).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test --test-name-pattern="modal de cada tramo" tests/metricas-reglas.test.js`
Expected: FAIL en las tres (las claves, los rótulos y el número).

- [ ] **Step 3: Implement in `services/metricasReglas.js`**

- Tres constantes de texto: `PEDIDO_DDPC = 'Pedido DDPC vía RPAD'`, `ENTREGA_DE_NOTA = 'Entrega de nota DGMIT'`, `ENTREGA_DEL_RELEVAMIENTO = 'Entrega del relevamiento'`.
- `DEL_MODAL`: cada tramo con sus `puntas` y su `dias` (el rótulo de los días) de la spec, 3; la redacción con `numero: 'hasta'` y la respuesta con `numero: 'desde'`; la carga con las puntas de la externa y, aparte, las de la interna (`[ENTREGA_DEL_RELEVAMIENTO, 'Carga en el portal']`). Todo `Object.freeze`, como hoy.
- `puntasDelModal(clave, gestion) -> [string, string]`: las de `DEL_MODAL[clave]`, salvo la carga de la interna.
- `numeroDeLaNotaDgmit(h) -> string`: `(N° ${numero})` si `tieneValor(h.nota?.numero)`, con `String(…).trim()`; si no, `''`.
- `filasDelModal(clave, medidas)`: el `ciclo(...)` suma `desde_nota_dgmit` y `hasta_nota_dgmit` en el orden de Produces: el número va en la punta que dice `DEL_MODAL[clave].numero` y solo si `estado !== 'pendiente'`; en los demás, `''`.
- `modalDelTramo(clave, gestion, …)`: `puntas: [...puntasDelModal(clave, gestion)]` y `rotulo_de_los_dias: DEL_MODAL[clave].dias`, en el orden de Produces. Actualizar el comentario de la forma del modal (hoy 747-752) y el de `DEL_MODAL` (hoy 616-617), que dice «el nombre de las dos puntas».

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/metricas-reglas.test.js tests/metricas-huellas.test.js tests/metricas-grafico.test.js tests/metricas-cinta.test.js tests/metricas-opciones.test.js`
Expected: PASS, 0 fallas (huellas sin tocar).

- [ ] **Step 5: Commit**

```bash
git add services/metricasReglas.js tests/metricas-reglas.test.js
git commit -m "feat(metricas): los rótulos de la tabla del modal y el número de la nota DGMIT, en el servidor"
```

---

### Task 2: la página los dibuja, y las versiones (Sonnet)

**Files:**
- Modify: `public/js/reportes.js` (`htmlDeFilaDelModal`, hoy 588-598, y su comentario; `htmlDelModal`, hoy 618-625, y su comentario; la constante `COLUMNA_DE_LOS_DIAS` y su comentario, hoy 503-505)
- Modify: `public/reportes.html` (el `<style>`: después de `.mt-modal-tabla td:last-child { white-space: nowrap; }`, hoy 394; `reportes.js?v=20261213` → `20261214`, hoy 738)
- Modify: `public/configuracion.html` (`feriados.js?v=20261214` → `20261215`, hoy 828)
- Test: `tests/reportes-frontend.test.js` (describe «reportes.js: la banda y el modal de cada tramo», desde 681), `tests/paginas.test.js` (`VERSION_FERIADOS` y `VERSION_REPORTES`, hoy 41 y 101, con sus comentarios)

**Interfaces:**
- Consumes: la forma de `tramo.modal` y de cada ciclo de la Tarea 1 (Produces).

- [ ] **Step 1: Write the failing tests**

En `tests/reportes-frontend.test.js`:

1. El test «htmlDelModal: el título, quién, …» (hoy 754) usa `modalAMano` sin las claves nuevas: queda como está y prueba la tolerancia (encabezado «Días», las fechas solas). Sumarle al nombre «; sin las claves nuevas (una foto vieja), «Días» y la fecha sola».
2. Test nuevo: `it('htmlDelModal: el rótulo de los días del servidor y el número de la nota DGMIT junto a su fecha, en un renglón', …)`, con `tramoConModal({ modal: modalAMano({ puntas: ['Entrega de nota DGMIT', 'Datos recibidos'], rotulo_de_los_dias: 'Días de circuito y producción', ciclos }) })`, donde `ciclos` es `CICLOS` con `desde_nota_dgmit: '(N° 7/26)'` en el primero y `hasta_nota_dgmit: ''` en todos:
   - el `<thead>` es `<tr><th scope="col">Dataset</th><th scope="col">Entrega de nota DGMIT</th><th scope="col">Datos recibidos</th><th scope="col">Días de circuito y producción</th></tr>`;
   - la primera fila tiene `<td><span class="nro">02/03/2026 (N° 7/26)</span></td><td>05/05/2026</td>`;
   - las otras tres filas, iguales a las del test de arriba (sin `nro`);
   - con `hasta_nota_dgmit: '(N° 9/26)'` en la primera fila (y `desde_nota_dgmit: ''`), su segunda fecha es `<td><span class="nro">05/05/2026 (N° 9/26)</span></td>`;
   - en una fila en curso, `hasta_nota_dgmit` con texto no se dibuja (no hay fecha): la celda sigue siendo `<span class="mt-curso">en curso</span>`.
3. «todo lo del servidor escapado» (hoy 943): sumar `rotulo_de_los_dias: malo` a `modalAMano(...)` y `desde_nota_dgmit: malo` al primer ciclo; la cuenta pasa de 26 a 28 y el comentario nombra «el rótulo de los días» y «el número de la nota».
4. «un 0 se escribe como 0, …» (hoy 971): en el modal de `vacios`, sumar `rotulo_de_los_dias: null` y un ciclo `{ desde: '2026-01-02', desde_nota_dgmit: null, hasta_nota_dgmit: 0 }`; sigue sin «NaN», «null», «undefined» ni «[object».
5. Test nuevo que lee `reportes.html` (con el `leer` que ya usa el archivo, hoy 205): tiene `.mt-modal-tabla .nro { white-space: nowrap; }`.

En `tests/paginas.test.js`: `VERSION_REPORTES = '20261214'` y `VERSION_FERIADOS = '20261215'`; los comentarios suman, al final de cada lista de cambios, «después, los rótulos de la tabla del modal y el número de la nota DGMIT (spec 2026-11-08-metricas-modal-rotulos)» en el de `reportes.js` y la spec en la lista de subidas de `feriados.js`, y conservan que el próximo cambio de `reportes.js` también sube `VERSION_FERIADOS`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/reportes-frontend.test.js tests/paginas.test.js`
Expected: FAIL en el test nuevo del modal, en el del escape (26 en lugar de 28), en el de `reportes.html` y en las versiones.

- [ ] **Step 3: Implement**

- `htmlDelModal`: el último encabezado es `escaparTexto(m.rotulo_de_los_dias) || COLUMNA_DE_LOS_DIAS`. El comentario de `COLUMNA_DE_LOS_DIAS` dice que es el de una foto sin `rotulo_de_los_dias`.
- `htmlDeFilaDelModal`: una función chica `conNumero(dia, texto)` que, con `escaparTexto(texto)` no vacío, devuelve `<span class="nro">${dia} ${numero}</span>` y si no, `dia`; se aplica a la primera fecha con `desde_nota_dgmit` y a la segunda con `hasta_nota_dgmit` solo cuando `ciclo.hasta` es un texto (una fecha). La marca del avisado ya vencido sigue después, fuera del `<span>`.
- `reportes.html`: la regla `.mt-modal-tabla .nro { white-space: nowrap; }` y la versión nueva. `configuracion.html`: la versión nueva de `feriados.js`, sin tocar `feriados.js`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/reportes-frontend.test.js tests/paginas.test.js tests/publico.test.js`
Expected: PASS, 0 fallas.

- [ ] **Step 5: Commit**

```bash
git add public/js/reportes.js public/reportes.html public/configuracion.html tests/reportes-frontend.test.js tests/paginas.test.js
git commit -m "feat(metricas): la tabla del modal dibuja los rótulos del servidor y el número de la nota DGMIT"
```

---

### Task 3: el documento del modal, aparte (Sonnet)

**Files:**
- Create: `docs/temas/metricas-modal.md`
- Modify: `docs/temas/metricas-y-reportes.md` (la sección «## El modal de cada tramo», hoy 268-309; la lista de specs del principio)
- Modify: `CLAUDE.md` («El mapa», la fila de Métricas, hoy 80)
- Test: `tests/documentos.test.js` (no cambia: es el control)

- [ ] **Step 1: Mover la sección**

`docs/temas/metricas-modal.md` empieza con `# Métricas: el modal de cada tramo`, una oración de qué es, «Historia y motivos, en las specs:» con `docs/superpowers/specs/2026-11-07-metricas-cajones-y-ciclos-design.md` y `docs/superpowers/specs/2026-11-08-metricas-modal-rotulos-design.md`, y después el texto de la sección tal cual, sin su título `##`.
En `metricas-y-reportes.md`, la sección queda con su título y un renglón: «Ver `docs/temas/metricas-modal.md`: la banda, lo que arma el servidor, la tabla de los ciclos con sus rótulos, el gráfico y cómo se usa.».
En `CLAUDE.md`, debajo de la fila de Métricas: `| Métricas: el modal de cada tramo (la tabla de los ciclos, sus rótulos, el gráfico) | `metricas-modal.md` |`.

- [ ] **Step 2: Escribir lo vigente**

En `metricas-modal.md`:
- La forma de `tramo.modal` suma `rotulo_de_los_dias` (después de `puntas`), y cada ciclo, `desde_nota_dgmit` y `hasta_nota_dgmit`.
- El renglón de cada fila deja de listar las puntas viejas y dice: las dos fechas de la etapa, con los rótulos del servidor (`puntas`, según el tramo y la gestión), y los días, con su rótulo (`rotulo_de_los_dias`); la tabla de la spec 2026-11-08-metricas-modal-rotulos, 3, en una tabla corta (tramo, empieza, termina, días), y que la carga de la interna empieza en «Entrega del relevamiento».
- Un punto nuevo: el número de la nota DGMIT («(N° 7/26)»), en la redacción junto a la entrega de la nota y en la respuesta junto a la primera fecha, en las filas con esa fecha; el de la primera nota vigente del ciclo; la fecha y el número en un `<span class="nro">` que no se corta, por decisión del usuario.
- Un punto nuevo: una foto sin esas claves dibuja «Días» y la fecha sola; la foto de 2026 guarda los rótulos nuevos si este cambio está en producción antes del 10/01/2027.
- La decisión con su motivo: solo el modal; «Los casos» y «Los casos destildados» siguen con sus encabezados, porque son otra tabla.

- [ ] **Step 3: Run the documentation tests**

Run: `node --test tests/documentos.test.js`
Expected: PASS (el mapa nombra el documento nuevo, ninguno pasa de 60 KB ni tiene renglones de más de 600 caracteres). Y `wc -c docs/temas/metricas-y-reportes.md docs/temas/metricas-modal.md`: el primero, bien por debajo de 58,8 KB.

- [ ] **Step 4: Commit**

```bash
git add docs/temas/metricas-modal.md docs/temas/metricas-y-reportes.md CLAUDE.md
git commit -m "docs(metricas): el modal de cada tramo, en su propio documento, con los rótulos y el número de la nota"
```

---

## Después de las tareas (la sesión, no un subagente)

1. Con el turno de código y «CONTENEDOR LIBRE» de la coordinadora: `npm test` completo en el worktree (con el `.env` copiado y `RPAD_TESTS_DB_LOCAL=1`), en segundo plano; 0 fallas, y el conteo contra la línea de base de main (8609).
2. Revisión final de la rama con Opus; arreglos, revisados.
3. Mirar el modal con la página de la rama y los datos de la copia local (la maqueta, ahora sin el parche).
4. Merge en main (squash) y push; el kit `~/rpad-kits/RPAD-deploy-metricas-modal-rotulos/` contra `0d9fdcd`, sin SQL, con Restart, antes del 10/01/2027, con la comprobación previa de `reportes.js?v=20261213` y `feriados.js?v=20261214` y su vuelta atrás.
5. Pendiente para el usuario: sumar `docs/temas/metricas-modal.md` en `.claude/rules/metricas-y-reportes.md` (ruta protegida).
