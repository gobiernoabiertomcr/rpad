# Mi espacio: la agenda con más onda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La pestaña Agenda de Mi espacio con la banda celeste, el fin de semana oculto, las barras continuas (tus licencias en verde y los compañeros en una franja pizarra), los renglones que se adaptan, los íconos, tocar un día para agendar y el día elegido en el teléfono, con el primer nombre de los compañeros en toda la agenda y el Resumen.

**Architecture:** El servidor arma los nombres cortos (`nombreCorto`, pura) y dos datos nuevos de `GET /mi-espacio/eventos` (`companeros_por_dia` y `frase_del_mes`, puras en `miEspacioEventosReglas.js`). La página sigue el patrón de `mi-espacio.js`: lo puro arma el modelo del mes (semanas, barras por día, renglones) y su HTML (una tabla, con un pedazo de barra en cada día); lo que toca el DOM pinta, recuerda el fin de semana, maneja el teclado (un botón por día con `tabindex` móvil), el día elegido y el movimiento de una sola vez.

**Tech Stack:** Node 22 + Express (ESM), MariaDB (sin cambios de esquema), vanilla JS; tests con `node:test` (`npm test`, con Docker para los de API).

**Spec:** `docs/superpowers/specs/2026-10-28-mi-espacio-agenda-onda-design.md` (las secciones se citan como «spec 3.4»). Maqueta: `docs/superpowers/specs/2026-10-28-mi-espacio-agenda-onda-mockups/` (`agenda.js` y `agenda.css` muestran una forma de dibujarlo; manda la spec).

## Global Constraints

- El repo es público: **ningún nombre real** en el código, los tests, los comentarios ni los commits. Nombres inventados: Andrea Paula Molina (superadmin, quien mira), Julián Esteban Ferreyra (admin), Carla Inés Benítez (editor), Carla Ríos y Carla Bustos (para los repetidos), Tomás Quiroga (lector).
- Ningún email real; nunca `/api/cron/*`. La base local `datospublicos_mcr_rpad` no se escribe: para mirar la página, la copia `rpad_rama_agenda_onda`, que se borra al cerrar.
- En el código, la agenda es `evento`, `mes`, `semana`, `dia` o `mi_espacio_`; **nunca la palabra «agenda» a secas** (solo en `#agenda`, `#tab-agenda`, `#vista-agenda`, los ids `ag-*` y los textos visibles).
- Ruling 19: los textos y los nombres los manda el servidor; la página solo cuenta lo de dibujo (semanas, tramos, renglones y cuántas cosas quedan en el fin de semana).
- `mi-espacio.js` al cargarse solo declara; lo puro va antes que lo que toca el DOM; todo texto del servidor por `Utils.escapeHtml` (`esc`), números con `String`; sin `aria-live` ni `role="status"` en lo que se redibuja (la región viva sigue siendo `#me-anuncio`).
- Estilos: solo `--sg-*` del `<style>` de `mi-espacio.html` y `--f-titulo`/`--f-texto`; nada de `@keyframes`/`animation`; sin `text-transform: uppercase`; una regla por renglón dentro de cada `@media`; en un `style` inline, solo `--n`, `--p`, `--demora` y `--duracion`.
- Contraste de texto ≥ 4,5:1; puntos y líneas del teléfono ≥ 3:1 contra el fondo de la celda; foco visible (anillo tinta 3 px + halo `--sol-fuerte`).
- Sin SQL, sin cron, sin variables de entorno, sin dependencias: el despliegue es archivos + Restart.
- `npm test` completo antes y después de cada tarea, con el candado `C:\Users\Mariano\.rpad-suite.lock` (un solo `npm test` a la vez en la máquina). Todos los subagentes con Opus.

## Review Focus

1. **Un mes que empieza o termina en fin de semana con sábado y domingo ocultos** (noviembre de 2026 empieza en domingo; agosto de 2026, en sábado): la primera fila no queda vacía, y el día elegido y el foco caen en un día visible (spec 3.8, regla de 9.12). Test en Task 5.
2. **Muchos compañeros el mismo día** (enero, vacaciones): «Carla, Julián, Tomás y Andrea no están» en un solo carril, cortado con «…» y entero en el `title` y para el lector de pantalla. Tests en Task 4 y Task 6.
3. **Una licencia que cruza la semana y el mes, con un feriado el lunes**: las puntas rectas solo cuando la fila siguiente sigue igual en su primer día visible; la frase recorta las fechas al mes («del 1 al 8»). Tests en Task 4 y Task 5.
4. **Nombres que chocan**: dos «Carla» (→ «Carla B.» y «Carla R.»), dos «Carla B.» (→ nombre completo), una tilde distinta («Matías»/«Matias»), quien creó un evento y ya no es de administración. Test en Task 2.
5. **Un teléfono de 320 px con el fin de semana visible** y alto contraste: sin desplazamiento de costado; las líneas y los puntos se siguen viendo en `forced-colors`. Test en Task 7 (estático) y verificación en Task 9.

## Pre-flight (28/10/2026, sobre main 65a79f8)

- La licencia anulada no tocó nada de la agenda (ni `htmlDelMes`, ni `cosasPorDia`, ni `gruposDeProximos`, ni `#vista-agenda`): tocó el Resumen (`htmlDeFaltantes` con `para_revisar`, `vinculosDelResumen` en `verResumen`), la lista de Licencias (`otros_anios`) y `volverAPedirTodo`. `contextoDe`, `ausentesPara`, `filaDeLicencia` (con `persona` en las opciones) y `mostrar_texto` siguen como los describe Task 2. Clases nuevas del Resumen que la agenda no tiene que pisar: `.me-frase-link`, `.me-faltantes a`, `.me-otros-anios`.
- `VERSION_MI_ESPACIO` está en '20261215': Task 7 la sube a **'20261216'** (y el `?v=` de `mi-espacio.js`).
- **Cada tarea deja la suite completa en verde** (también Task 7: los tests de DOM de la agenda no se rompen al sumar los ids nuevos).
- `cosasPorDia` cambia en **Task 6** (junto con `htmlDelMes` y sus tests), no en Task 5: si cambiara antes, el `htmlDelMes` de hoy perdería las licencias y los compañeros entre las dos tareas.
- `--n` va siempre en la pieza de `inicio` (el ancho del texto); `--demora`, solo con `animar`.

---

### Task 1: Ponerse al día con main y ajustar el plan

La coordinadora manda el hash del merge de «Mi espacio: licencia anulada en Configuración». Hasta entonces no se implementa nada.

**Files:**
- Modify: este plan, si algo cambió.

- [ ] **Step 1: Traer main a la rama**

Run: `git fetch origin && git merge origin/main` (en la rama `claude/mi-espacio-agenda-onda-dc5c38`; si la app ofrece `sync_with_base_branch`, usar esa).
Expected: merge sin conflictos (la rama solo tiene la spec, la maqueta y este plan).

- [ ] **Step 2: Correr la suite completa sobre main**

Run (con el candado): `npm test`
Expected: todo verde; anotar el total (lo pide el kit).

- [ ] **Step 3: Releer lo que cambió la licencia anulada y ajustar el plan**

Mirar `git diff ad0de02..origin/main -- public/js/mi-espacio.js public/mi-espacio.html services/miEspacioResumen.js services/miEspacioReglas.js controllers/miEspacioController.js tests/paginas.test.js tests/mi-espacio-frontend.test.js`. Anotar en este plan: el valor nuevo de `VERSION_MI_ESPACIO` (Task 7 sube al siguiente), si cambiaron `filaDeLicencia`/`contextoDe`/`verResumen` (Task 2), y si la pestaña Agenda cambió algo (una licencia anulada deja de verse: las consultas ya filtran `activo = 1`).

- [ ] **Step 4: Commit del plan ajustado**

```bash
git add docs/superpowers/plans/2026-10-28-mi-espacio-agenda-onda.md
git commit -m "docs(mi-espacio): el plan de la agenda con más onda, sobre main con la licencia anulada"
```

---

### Task 2: El nombre corto de los compañeros (servidor)

**Files:**
- Modify: `services/miEspacioReglas.js` (junto a `textoNoEsta`)
- Modify: `services/miEspacioDatos.js` (`administracionActiva`, `contextoDe`)
- Modify: `controllers/miEspacioController.js` (`ausentesPara`)
- Modify: `services/miEspacioResumen.js` (`mostrar_texto` de `filaDeLicencia`)
- Test: `tests/mi-espacio-reglas.test.js`, `tests/mi-espacio-api.test.js`

**Interfaces:**
- Produces:
  - `nombreCorto(persona: { id, nombre }, administracion: Array<{ id, nombre }>) => string` (pura, en `miEspacioReglas.js`).
  - `administracionActiva(conexion = pool) => Promise<Array<{ id: number, nombre: string }>>` (en `miEspacioDatos.js`): `SELECT id, nombre_completo FROM usuarios WHERE activo = 1 AND rol IN ('superadmin','admin','editor') ORDER BY id`, parametrizada.
  - `contextoDe(...)` devuelve además `administracion` y `persona.nombre_corto`.
  - `ausentesPara(...)`: el `nombre` (y por lo tanto `texto`) de cada ausente es el corto. De ahí lo toman `GET /mi-espacio/ausentes`, el Resumen («Hoy y mañana») y `GET /mi-espacio/eventos`.

- [ ] **Step 1: Tests puros de `nombreCorto`**

En `tests/mi-espacio-reglas.test.js`, un `describe('nombreCorto')` con:
```js
const ADMIN = [
  { id: 1, nombre: 'Andrea Paula Molina' }, { id: 4, nombre: 'Julián Esteban Ferreyra' },
  { id: 2, nombre: 'Carla Inés Benítez' }
];
assert.equal(nombreCorto({ id: 2, nombre: 'Carla Inés Benítez' }, ADMIN), 'Carla');
const CON_OTRA = [...ADMIN, { id: 9, nombre: 'Carla Ríos' }];
assert.equal(nombreCorto({ id: 2, nombre: 'Carla Inés Benítez' }, CON_OTRA), 'Carla B.');
assert.equal(nombreCorto({ id: 9, nombre: 'Carla Ríos' }, CON_OTRA), 'Carla R.');
const MISMA_INICIAL = [...ADMIN, { id: 9, nombre: 'Carla Bustos' }];
assert.equal(nombreCorto({ id: 2, nombre: 'Carla Inés Benítez' }, MISMA_INICIAL), 'Carla Inés Benítez');
// Sin tildes ni mayúsculas: «Matías» y «matias» son el mismo primer nombre
assert.equal(nombreCorto({ id: 5, nombre: 'Matías Paz' }, [{ id: 5, nombre: 'Matías Paz' }, { id: 6, nombre: 'matias Sosa' }]), 'Matías P.');
// Quien no está en la lista (dejó de ser administración) se compara contra la lista
assert.equal(nombreCorto({ id: 7, nombre: 'Carla Vera' }, CON_OTRA), 'Carla V.');
assert.equal(nombreCorto({ id: 7, nombre: 'Tomás Quiroga' }, ADMIN), 'Tomás');
// Espacios de más; lo que no es un texto
assert.equal(nombreCorto({ id: 2, nombre: '  Carla   Inés  Benítez ' }, ADMIN), 'Carla');
assert.equal(nombreCorto({ id: 2, nombre: null }, ADMIN), '');
assert.equal(nombreCorto(null, ADMIN), '');
assert.equal(nombreCorto({ id: 2, nombre: 'Carla Inés Benítez' }, null), 'Carla');
```

- [ ] **Step 2: Correrlos y ver que fallan**

Run: `node --test tests/mi-espacio-reglas.test.js`
Expected: FAIL, `nombreCorto` no existe.

- [ ] **Step 3: Implementar `nombreCorto`**

Primera palabra de `nombre` (recortado, espacios colapsados). Se compara con las demás personas de `administracion` (id distinto) por la primera palabra normalizada (`normalize('NFD')`, sin diacríticos, en minúscula). Si alguna coincide, la primera palabra + `' '` + la inicial de la última palabra + `'.'`; si entre las que coinciden alguna tiene además la misma inicial del último apellido (normalizada), el nombre completo recortado. Nunca tira.

- [ ] **Step 4: Correr y ver que pasan**

Run: `node --test tests/mi-espacio-reglas.test.js` → PASS.

- [ ] **Step 5: Tests de API (Docker) del nombre corto**

En `tests/mi-espacio-api.test.js`, con personas inventadas (Andrea mira; Carla Inés Benítez y Carla Ríos, editoras, con una ausencia cada una; Julián, admin):
- `GET /api/mi-espacio/ausentes` → `ausentes[].nombre` es «Carla B.» y «Carla R.» y `texto` «Carla B. no está»; con Carla Ríos desactivada, «Carla» y «Carla no está».
- `GET /api/mi-espacio/resumen` (Andrea) → `hoy_y_manana.ausentes_hoy[0].texto` con el nombre corto.
- La fila de una licencia de Julián (`GET /api/mi-espacio/licencias`) → `mostrar_texto` «Tus compañeros ven «Julián no está».».
- `administracionActiva()` → solo las activas de los tres roles, `{ id, nombre }`, sin lector ni colaborador.

- [ ] **Step 6: Implementar en los datos y el controlador**

`administracionActiva` en `miEspacioDatos.js`; `contextoDe` la lee con su conexión y suma `administracion` y `persona.nombre_corto` (con `persona` null, null). `ausentesPara` lee `administracionActiva()` junto con las ausencias y pasa cada fila por `nombreCorto({ id: usuario_id, nombre })` antes de `ausenciasUnidas`. `filaDeLicencia` usa `persona.nombre_corto ?? persona.nombre_completo` en `mostrar_texto` (es lo único de esa fila que cambia).

- [ ] **Step 7: Suite completa (con el candado) y commit**

Run: `npm test` → todo verde (actualizar las aserciones existentes que esperaban el nombre completo en «… no está»: `tests/mi-espacio-api.test.js`, `tests/mi-espacio-resumen.test.js` si arman `mostrar_texto`).
```bash
git add services/miEspacioReglas.js services/miEspacioDatos.js services/miEspacioResumen.js controllers/miEspacioController.js tests/
git commit -m "feat(mi-espacio): los compañeros con el primer nombre (y la inicial si se repite)"
```

---

### Task 3: Los eventos con el nombre corto (servidor)

**Files:**
- Modify: `services/miEspacioEventosReglas.js` (`itemDeEvento`, `conPersonas`)
- Modify: `controllers/miEspacioEventosController.js` (`listarEventos`, `cambiarMiRecordatorio`), `controllers/miEspacioController.js` (`eventosDelResumen`)
- Test: `tests/mi-espacio-eventos-reglas.test.js`, `tests/mi-espacio-eventos-api.test.js`

**Interfaces:**
- Consumes: `nombreCorto`, `administracionActiva` (Task 2).
- Produces: `itemDeEvento(evento, { usuarioId, ahora, feriados, administracion = [] })`: `creador`, `quien_texto` y `quien_largo` con nombres cortos; **`personas` sigue con los completos** (spec 9.13). `quien_texto` de uno propio compartido con una sola persona: «Con <corto>»; con más, «Con N personas» (spec 9.4).

- [ ] **Step 1: Tests de `itemDeEvento`**

En `tests/mi-espacio-eventos-reglas.test.js`, con `administracion` = Andrea (1), Julián (4) y Carla Inés Benítez (2):
- ajeno creado por Julián → `creador` «Julián», `quien_texto` «De Julián», `quien_largo` «Lo creó Julián. Están: vos y Carla.»;
- propio compartido solo con Carla → `quien_texto` «Con Carla», `personas` `['Carla Inés Benítez']`;
- propio con Carla y Julián → «Con 2 personas»;
- con Carla Ríos (9) también en `administracion` → «Lo creó Julián. Están: vos, Carla B. y Julián.» según quiénes estén;
- sin `administracion` (llamada vieja) → el primer nombre de cada uno, sin tirar.
- Las listas de claves (`CLAVES_DEL_MIO`, `CLAVES_DEL_AJENO`) no cambian.

Correr: `node --test tests/mi-espacio-eventos-reglas.test.js` → FAIL.

- [ ] **Step 2: Implementar en `itemDeEvento`**

`creador` = `nombreCorto({ id: evento.creado_por, nombre: evento.creador }, administracion)` (sin nombre, el guion de hoy). Los nombres de `quien_largo` y el de «Con …», con `nombreCorto` de cada persona `{ id, nombre }`. Correr → PASS.

- [ ] **Step 3: Pasar `administracion` desde los controladores**

`listarEventos` y `eventosDelResumen` leen `administracionActiva()` en el mismo `Promise.all` que ya tienen; `cambiarMiRecordatorio` la lee antes de abrir la transacción (como los feriados). Tests de API (Docker) en `tests/mi-espacio-eventos-api.test.js`: el ajeno de Julián llega con `quien_texto` «De Julián»; en el Resumen, «Hoy y mañana» dice «de Julián» (`eventos[].quien`).

- [ ] **Step 4: Suite completa y commit**

Run: `npm test` → verde (actualizar las aserciones con nombres completos en `quien_texto`/`quien_largo`/«Con 1 persona», también en `tests/mi-espacio-frontend.test.js` si alguna los copia). Los emails no cambian: `tests/email-diseno.test.js` sigue igual.
```bash
git commit -am "feat(mi-espacio): los eventos de la agenda con el primer nombre de quien los creó y de quien está"
```

---

### Task 4: `companeros_por_dia` y `frase_del_mes` en `GET /mi-espacio/eventos`

**Files:**
- Modify: `services/miEspacioEventosReglas.js`
- Modify: `controllers/miEspacioEventosController.js` (`listarEventos`)
- Test: `tests/mi-espacio-eventos-reglas.test.js`, `tests/mi-espacio-eventos-api.test.js`

**Interfaces:**
- Consumes: los ítems de `itemDeAusencia` (`{ nombre, dias, … }`, con el nombre corto de Task 2), de `itemDeEvento`, `itemsDeFeriados` e `itemDeLicencia`.
- Produces:
  - `companerosPorDia(ausentes) => Array<{ fecha, texto }>` (pura): por fecha ascendente, un elemento por cada fecha que aparece en algún `dias`; nombres ordenados con `localeCompare(…, 'es')`; `texto` = `listaConY(nombres)` + « no está» (uno) o « no están» (más). Sin ausentes, `[]`.
  - `fraseDelMes({ mes, eventos, feriados, licencias }) => string | null` (pura): `null` si `mes` no es `'AAAA-MM'`.
  - `FRASE_DE_LA_LICENCIA` (congelada, por tipo): `vacaciones: 'tus vacaciones'`, `horas_a_favor: 'tus horas a favor'`, `franquicia: 'tu franquicia'`, `estudios: 'tu licencia por estudios'`, `medica: 'tu licencia médica'`, `medica_extraordinaria: 'tu licencia médica extraordinaria'`, `familiar: 'tu licencia por el grupo familiar'`, `franco: 'tu franco compensatorio'`, `uso_autorizado: 'tu uso autorizado'`.
  - La respuesta de `GET /mi-espacio/eventos?desde&hasta[&mes]`: `{ desde, hasta, hoy, puede_compartir, eventos, licencias, feriados, ausentes, companeros_por_dia, frase_del_mes }` (las dos nuevas al final). `frase_del_mes` solo si `mes` es `'AAAA-MM'` y el mes entero cae en `[desde, hasta]`; si no, `null`.

- [ ] **Step 1: Tests puros**

`companerosPorDia`:
```js
const A = (nombre, dias) => ({ nombre, desde: dias[0], hasta: dias.at(-1), texto: `${nombre} no está`, hasta_texto: '', dias });
assert.deepEqual(companerosPorDia([A('Julián', ['2026-11-03', '2026-11-04', '2026-11-05']), A('Carla', ['2026-11-05', '2026-11-06'])]), [
  { fecha: '2026-11-03', texto: 'Julián no está' }, { fecha: '2026-11-04', texto: 'Julián no está' },
  { fecha: '2026-11-05', texto: 'Carla y Julián no están' }, { fecha: '2026-11-06', texto: 'Carla no está' }
]);
// Cuatro el mismo día (enero)
assert.equal(companerosPorDia(['Tomás', 'Carla', 'Julián', 'Andrea'].map((n) => A(n, ['2027-01-05'])))[0].texto,
  'Andrea, Carla, Julián y Tomás no están');
assert.deepEqual(companerosPorDia(null), []);
```
`fraseDelMes` (noviembre de 2026, los datos de la maqueta):
```js
// 8 eventos del mes, feriados el 2, 8, 9 y 23 (el 9 con dos nombres cuenta una vez), franquicia el 4 y vacaciones 16–27
assert.equal(fraseDelMes({ mes: '2026-11', eventos, feriados, licencias }),
  '8 eventos, 4 feriados, tu franquicia el 4 y tus vacaciones del 16 al 27.');
assert.equal(fraseDelMes({ mes: '2026-11', eventos: [unoDel('2026-11-10')], feriados: [], licencias: [] }), '1 evento.');
// Recortada al mes: unas vacaciones del 21/12 al 08/01, en enero
assert.equal(fraseDelMes({ mes: '2027-01', eventos: [], feriados: [{ fecha: '2027-01-01', nombre: 'Año Nuevo', texto: 'Feriado: Año Nuevo' }],
  licencias: [{ id: 3, tipo: 'vacaciones', desde: '2026-12-21', hasta: '2027-01-08', texto: 'Vacaciones', hasta_texto: '…', dias: [] }] }),
  '1 feriado y tus vacaciones del 1 al 8.');
assert.equal(fraseDelMes({ mes: '2026-12', eventos: [], feriados: [], licencias: [] }),
  'Nada cargado en diciembre. Tocá un día para agendar algo.');
assert.equal(fraseDelMes({ mes: 'raro', eventos: [], feriados: [], licencias: [] }), null);
```
Reglas que fijan los tests: «N eventos» cuenta los eventos con `fecha` del mes; «N feriados», las **fechas** distintas del mes con algún feriado (también en fin de semana); cada licencia que toca el mes (`desde` ≤ último día y `hasta` ≥ día 1), por `desde`, con `FRASE_DE_LA_LICENCIA[tipo]` y sus fechas recortadas al mes, «el N» si es un solo día o «del N al M»; unidas con `listaConY`, la primera letra en mayúscula y punto final. Un tipo desconocido no entra. Los compañeros no van.

Run: `node --test tests/mi-espacio-eventos-reglas.test.js` → FAIL.

- [ ] **Step 2: Implementar las dos funciones** (con `nombreDelMes` de `miEspacioReglas.js` para «diciembre»). Correr → PASS.

- [ ] **Step 3: Controlador y tests de API**

`listarEventos` lee `req.query.mes` (un texto; una lista o lo que no sea `'AAAA-MM'` es como si no viniera), arma `companeros_por_dia` de los ausentes ya cortados y `frase_del_mes` con los ítems de la respuesta. En `tests/mi-espacio-eventos-api.test.js`: la lista de claves de `data` suma las dos al final; con `mes=2026-11` y el rango de la grilla, la frase; sin `mes`, con un `mes` fuera del rango o repetido (`?mes=2026-11&mes=2026-12`), `null`; a un lector, `companeros_por_dia` `[]`.

- [ ] **Step 4: Suite completa y commit**

```bash
git commit -am "feat(mi-espacio): la agenda recibe los compañeros de cada día y la frase del mes"
```

---

### Task 5: La página, lo puro: el modelo del mes

**Files:**
- Modify: `public/js/mi-espacio.js` (sección «Lo puro: la agenda»)
- Test: `tests/mi-espacio-frontend.test.js`

**Interfaces:**
- Consumes: la respuesta de Task 4 (`companeros_por_dia` además de lo de antes).
- Produces (puras, globales del script):
  - `semanasDelMes(mes, { finde }) => Array<Array<{ fecha, dia, del_mes, finde }>>`: las semanas de `diasDeLaGrilla(mes)` (que no cambia); sin `finde`, cada semana sin sábado ni domingo y sin las semanas cuyos días visibles no son del mes. Mes que no sirve, `[]`.
  - `barrasDelMes(semanas, datos) => Array<{ carriles: 0|1|2, piezas: Map<fecha, Array<Pieza|null>> }>`, una por semana, con `Pieza = { clase: 'licencia'|'ausente', texto, titulo, inicio, fin, largo, sigue_antes, sigue_despues }`: el carril 1 es tuyo si la semana tiene algún día de licencia (de `licencias[].dias`), si no los compañeros van en el 1; un **tramo** son días visibles contiguos de la fila con la misma licencia (por `id`) o el mismo `texto` de `companeros_por_dia`; `inicio` y `fin` marcan sus puntas; `largo` es la cantidad de días del tramo (solo en la pieza de `inicio`, para que el texto ocupe el tramo con `--n`); `sigue_despues` si la pieza es la última columna de la fila y la primera columna de la fila siguiente tiene la misma licencia o el mismo texto; `sigue_antes`, al revés. `titulo`: en una licencia, `texto` + «. » + `hasta_texto` (sin `hasta_texto`, solo `texto`); en los compañeros, cada ausente de ese día (los de `ausentes` cuyos `dias` lo incluyen, en el orden del texto) con su `texto` y, si tiene, su `hasta_texto`: «Carla no está. Hasta el viernes 13/11. Julián no está. Hasta el viernes 06/11.».
  - `renglonesDelDia(cantidad, lugares) => { lineas: number[], mas: number }` (spec 3.5).
  - `cuantasEnElFinde(mes, datos) => number`: las cosas de `cosasPorDia` en sábados y domingos del mes.
  - `diaVisibleCercano(fecha, semanas) => fecha | null` (spec 3.8: el primero visible que la sigue en la grilla; si no hay, el último que la precede).

- [ ] **Step 1: Tests**

Con los fixtures de siempre (armados con los `itemDe*` reales) más `companeros_por_dia` de `companerosPorDia`:
- `semanasDelMes('2026-11', { finde: false })`: la primera semana es del lunes 02/11 (la del domingo 1 no va), 5 días por semana; con `finde: true`, la primera empieza el lunes 26/10 y trae el domingo 1. `semanasDelMes('2026-08', { finde: false })[0][0].fecha === '2026-08-03'`.
- `renglonesDelDia`: `(1, 4) → { lineas: [3], mas: 0 }`, `(2, 4) → [2, 2]`, `(3, 4) → [1, 1, 1]`, `(4, 4) → { lineas: [1, 1, 1], mas: 1 }`, `(1, 2) → [2]`, `(2, 3) → [2, 1]`, `(3, 2) → { lineas: [1], mas: 2 }`, `(0, 4) → { lineas: [], mas: 0 }`.
- `barrasDelMes` en noviembre (fin de semana oculto): la semana del 02/11 tiene 2 carriles; el 03/11 tiene en el carril 2 `{ clase: 'ausente', texto: 'Julián no está', inicio: true }`, el 05/11 `{ texto: 'Carla y Julián no están', inicio: true }` y el 04/11 `inicio: false`; las vacaciones del 16 al 20 son un tramo de `largo` 5 con `sigue_despues: false` (el lunes 23 es feriado: la fila siguiente no empieza igual) y el 24 empieza otro (`inicio: true`, `sigue_antes: false`). Una licencia del jueves 01/10 al martes 06/10 (sin feriados): la pieza del viernes 02 tiene `sigue_despues: true` y la del lunes 05, `sigue_antes: true`.
- `cuantasEnElFinde('2026-11', datos)`: 1 (el feriado del domingo 8) con los fixtures; con un evento el sábado 14, 2.
- `diaVisibleCercano('2026-11-01', semanasDelMes('2026-11', { finde: false })) === '2026-11-02'`; `('2026-10-31', octubre sin finde) === '2026-10-30'`; con `finde: true`, la misma fecha.

Run: `node --test tests/mi-espacio-frontend.test.js` → FAIL.

- [ ] **Step 2: Implementar** (sin tocar `diasDeLaGrilla`, `mesVecino`, `tituloDelMes`, `rangoDeLaGrilla` ni sus paridades). Correr → PASS.

- [ ] **Step 3: Suite completa y commit**

```bash
git commit -am "feat(mi-espacio): el modelo del mes con las barras, los renglones y el fin de semana"
```

---

### Task 6: La página, lo puro: el HTML del mes, del día elegido y de «Próximos»

**Files:**
- Modify: `public/js/mi-espacio.js`
- Test: `tests/mi-espacio-frontend.test.js`

**Interfaces:**
- Consumes: Task 5.
- Produces:
  - `cosasPorDia(datos)`: **solo feriados y eventos** (las licencias y los compañeros pasan a las barras); misma forma `{ clase, texto, evento_id? }`. Test: el 12/10 `[{ clase: 'feriado', texto: 'Feriado: Día del Respeto a la Diversidad Cultural' }]`; ningún día con `clase` 'licencia' ni 'ausente'.
  - `ICONOS_DEL_MES` (congelado): SVG de Lucide para `feriado` (bandera), `licencia` (sol), `ausente` (persona) y `compartido` (dos personas), `aria-hidden="true"`, `class="me-icono"`; `propio`, ''.
  - `htmlDelMes(mes, datos, hoy, { finde = false, elegido = null, foco = null, telefono = false, animar = false } = {})`: la tabla (spec 3.3–3.5, sección 6). Estructura de cada día:
    ```html
    <td class="me-celda[ otro-mes][ finde][ feriado][ hoy][ paso][ elegido]" data-fecha="…"[ aria-current="date"]><div class="me-celda-cuerpo">
      <button type="button" class="me-num" data-dia="…" tabindex="0|-1" aria-label="Nuevo evento el jueves 22/10">22</button>
      <div class="me-carriles">  <!-- solo si la semana tiene carriles; un hijo por carril -->
        <span class="me-tira licencia inicio fin sigue-antes sigue-despues" title="…"[ style="--n:3[;--demora:0.21s]"]>…ícono…<span class="me-tira-texto">Vacaciones</span></span>
        <span class="me-tira vacia"></span>
      </div>
      <div class="me-cosas"> …cosas… [<div class="me-resto" hidden>…</div><button type="button" class="me-mas" data-ver-mas="…">y N más</button>] </div>
      <span class="me-puntos" aria-hidden="true"><i class="propio"></i>…</span>
    </div></td>
    ```
    La pieza que no es `inicio` lleva su texto en `<span class="visualmente-oculto">` (el lector de pantalla lo lee en cada día). Cada cosa: `<button|span class="me-ev <clase>" data-lineas="1|2|3"[ data-evento]` title="…">` con el ícono y, en un evento, `<b>HH:MM</b> título`. `--n` (los días del tramo) siempre en la pieza de `inicio`; `--demora` solo con `animar` (semana × 0,16 s + columna × 0,05 s, dos decimales), en todas las piezas que no son `vacia`. El `aria-label` del número: «Nuevo evento el <diaLargoDe>» o, con `telefono`, «Ver el <diaLargoDe>». `tabindex="0"` solo en `foco`.
  - `htmlDelDiaElegido(fecha, datos, hoy)`: `<div class="me-elegido-cabeza"><h3 id="ag-elegido-titulo">Miércoles 28 de octubre (hoy)</h3><button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-nuevo-el="…">…Nuevo evento</button></div>` y la lista (`<ul class="me-elegido-lista">`, una `<li class="me-fila-del-dia <clase>">` por cosa: feriados, tu licencia, los compañeros —el `texto` de `companeros_por_dia`—, con «Todo el día», y los eventos con su hora, como botón `data-evento`); sin nada, `<p class="me-vacio">No hay nada este día.</p>`. La fecha larga con `diaLargoDe` + el mes (sin año).
  - `htmlDeProximo(item)`: suma `<span class="me-prox-icono <clase>" aria-hidden="true">…</span>` dentro del título, antes del texto.

- [ ] **Step 1: Tests de HTML**

Reemplazar los de `htmlDelMes` (1220, 1246, 1262, 1278 de hoy) y sumar:
- la cabeza tiene 5 `<th scope="col">` sin `finde` y 7 con; el `<th>` del día de la semana de hoy lleva `class="hoy"` solo si hoy está en la grilla (en noviembre, ninguno); la celda de hoy tiene `aria-current="date"` y `class` con `hoy`; los días del mes anteriores a hoy, `paso`;
- cada celda empieza con `<div class="me-celda-cuerpo"><button type="button" class="me-num" data-dia="AAAA-MM-DD"`; exactamente un `tabindex="0"` en todo el mes (el de `foco`);
- 05/11 (noviembre): `<span class="me-tira ausente inicio"` con «Carla y Julián no están» visible y, el 06/11, el mismo texto dentro de `visualmente-oculto`; el 16/11, `licencia inicio` con `--n:5`;
- un evento solo en el día y sin carriles → `data-lineas="3"`; el 05/11 (2 carriles, 4 eventos) → un `data-lineas="1"` y `y 3 más`;
- con `animar`, cada `me-tira` que no es `vacia` tiene `--demora:`; sin `animar`, ningún `--demora` (sí el `--n` de cada `inicio`);
- `aria-label="Ver el lunes 02/11"` con `telefono: true`;
- el escapado: un título y un nombre con `<b>&"` salen escapados en el texto, en el `title` y en el oculto;
- ningún `aria-live`, `role="status"` ni `role="alert"`.
`htmlDelDiaElegido('2026-10-28', datos, '2026-10-28')`: el título «Miércoles 28 de octubre (hoy)», un `data-nuevo-el="2026-10-28"`, los eventos con `data-evento`; un día sin nada → «No hay nada este día.». `htmlDeProximos`: actualizar los tres tests (1346, 1366, 1373) con el ícono.

Run → FAIL.

- [ ] **Step 2: Implementar.** Correr → PASS. Suite completa y commit:
```bash
git commit -am "feat(mi-espacio): el HTML del mes con las barras por día, el día elegido y los íconos"
```

---

### Task 7: La página estática: el HTML de la pestaña y el `<style>`

**Files:**
- Modify: `public/mi-espacio.html` (la sección `#vista-agenda` y el `<style>`; `?v=` de `mi-espacio.js`)
- Modify: `tests/paginas.test.js` (`VERSION_MI_ESPACIO` a '20261216'; las aserciones de la pestaña)
- Test: `tests/paginas.test.js`, `tests/mi-espacio-frontend.test.js` (contrastes)

**Interfaces:**
- Produces (ids, en este orden dentro de `#vista-agenda`): `ag-mes-titulo`, `ag-anterior`, `ag-siguiente`, `ag-finde`, `ag-finde-cuenta`, `ag-hoy`, `ag-nuevo-evento`, `ag-frase`, `ag-mes`, `ag-leyenda-ausentes`, `ag-elegido`, `ag-proximos-titulo`, `ag-proximos`.
  - La banda: `<div class="me-banda-del-mes">` con la ola (`<svg class="me-ola" aria-hidden="true" …>`, la del Resumen) y, adentro, `<h2 id="ag-mes-titulo">`, las dos `.me-flecha` (sus `aria-label` de siempre), `<button type="button" class="me-finde" id="ag-finde" aria-pressed="false"><span class="me-finde-llave" aria-hidden="true"></span>Sábado y domingo<span class="me-finde-cuenta" id="ag-finde-cuenta" hidden></span></button>`, «Hoy» y «Nuevo evento» (con sus clases de siempre) y `<p class="me-frase-del-mes" id="ag-frase"></p>`.
  - La leyenda: cada `<li>` con `<span class="me-color <clase>" aria-hidden="true">ícono</span>texto` (los mismos cinco textos; `#ag-leyenda-ausentes` sigue `hidden`).
  - `<section class="me-elegido" id="ag-elegido" aria-labelledby="ag-elegido-titulo"></section>` dentro de la tarjeta del mes, después de la leyenda.

- [ ] **Step 1: Tests en `tests/paginas.test.js`**

Actualizar la prueba de la estructura (709): la lista de ids de arriba en ese orden; `aria-pressed="false"` en `#ag-finde`; la leyenda con la nueva forma (`<li( id="ag-leyenda-ausentes" hidden)?><span class="me-color (\w+)" aria-hidden="true"><svg`… o vacía en `propio`); `#ag-mes` antes de `#ag-proximos`. Los cortes (737): en `media(980)` sigue `.me-mes-y-proximos { grid-template-columns: minmax(0, 1fr); }`; en `media(640)` **ya no** está `.me-proximos-tarjeta { order: -1; }` ni `.me-ev { font-size: 0`; está `.me-elegido { display: block`; afuera de 640, `.me-elegido { display: none; }` y `.me-puntos { display: none; }`. Sigue `.me-ev.X, .me-leyenda .X {` para los cinco y suma `.me-tira.ausente` con `background: var(--sg-suave)` y `color: #fff`. Sumar: `@media (forced-colors: active)` con `.me-tira` y `.me-puntos`; `@media (prefers-reduced-motion: reduce)` con `.me-tira { transition: none; }`; ninguna regla con `[data-animar]` usa `animation`. Sin cambios en 962/982 (la página escribe solo `--n` y `--demora`).

En `tests/mi-espacio-frontend.test.js`, con `reglaDe`/`contraste`: `.me-tira.ausente` blanco sobre `--sg-suave` ≥ 4,5:1; el número de `.me-celda.otro-mes .me-num` (`--sg-suave`) sobre `--sg-sutil` ≥ 4,5:1; los puntos del teléfono (`--sg-tinta`, `--sg-violeta`, el ámbar del feriado) y las líneas (`--sg-verde`, `--sg-suave`) ≥ 3:1 sobre blanco y sobre `--sg-cielo`.

Run: `node --test tests/paginas.test.js` → FAIL.

- [ ] **Step 2: El HTML y el `<style>`**

Los estilos, con la maqueta como guía (`agenda.css`, «pizarra» = `.franja-fuerte`), con las clases `me-` de la interfaz de arriba y las de Task 6: la banda (como `.me-banda` del Resumen, sin pisar sus clases), la llave, la cuenta en el sol, la tabla de filas de al menos 122 px, hoy en `--sg-cielo`, `paso` (el número en `--sg-suave` y `.me-cosas` con `filter: saturate(0.55)`), otro mes, fin de semana, el «+» con `.me-celda:hover .me-num::after` (sin control aparte), los carriles de 22 px, `.me-tira` que cruza el borde de la celda (márgenes negativos del relleno y el borde de la celda; `inicio` y `fin` redondeados con 3 px de aire, `sigue-*` rectos), el texto de `inicio` a lo ancho del tramo (`width: calc(var(--n) * 100% …)`, una línea con «…»), `[data-lineas]` con `-webkit-line-clamp`, `#ag-mes[data-animar] .me-tira { transform: scaleX(0); transition: none; }` y la transición con `var(--demora)`. 640 px: el número centrado, sin `.me-cosas` ni «+», las barras de 5 px sin texto, `.me-puntos` visibles, `.me-elegido { display: block; … }`, «Próximos» en su orden natural. Subir `VERSION_MI_ESPACIO` y el `?v=`.

Run: `node --test tests/paginas.test.js tests/mi-espacio-frontend.test.js` → PASS, también los de DOM de la agenda (los ids de antes siguen; Task 8 recién usa los nuevos). Después, la suite completa en verde.

- [ ] **Step 3: Commit**
```bash
git commit -am "feat(mi-espacio): la banda del mes, la grilla y el teléfono en la página"
```

---

### Task 8: La página, lo que toca el DOM

**Files:**
- Modify: `public/js/mi-espacio.js` (sección del DOM de la agenda)
- Test: `tests/mi-espacio-frontend.test.js` (el bloque «la agenda en la página», con el DOM falso)

**Interfaces:**
- Consumes: Tasks 5–7.
- Produces: estado `pagina.semana` = `{ finde: boolean, elegido: fecha|null, foco: fecha|null, animado: boolean }`; `CLAVE_DEL_FIN_DE_SEMANA = 'rpad-mi-espacio-fin-de-semana'`; `enElTelefono() => boolean` (`window.matchMedia?.('(max-width: 640px)')?.matches === true`); `IDENTIDADES_DEL_FOCO` suma `data-dia`.

- [ ] **Step 1: Tests con el DOM falso**

Sumar `localStorage` al `window` del montaje (un Map; una variante que tira en `getItem`/`setItem`) y un `matchMedia` que el test pueda poner en 640 (el DOM falso hoy solo tiene `reducido`). Casos:
- al abrir: `#ag-finde` con `aria-pressed="false"`, la grilla de 5 columnas, `#ag-finde-cuenta` visible con «1» en noviembre (el domingo 8) y el `aria-label` «Sábado y domingo: 1 cosa escondida»; `#ag-frase` con la `frase_del_mes` del servidor (`textContent`); el pedido del mes lleva `&mes=2026-10`;
- tocar `#ag-finde` → `aria-pressed="true"`, 7 columnas, la cuenta oculta, `localStorage` con '1'; al volver a montar, sigue en 7; con `localStorage` que tira, 5 y sin error;
- un clic en una celda (sobre `.me-celda-cuerpo` o una `.me-tira`, no en un evento ni en «y N más») abre `#modal-evento` con `#ev-fecha` en esa fecha; el número (`[data-dia]`) también;
- en el teléfono (`matchMedia` en 640): tocar un día lo marca `elegido`, pinta `#ag-elegido` con `htmlDelDiaElegido` de esa fecha y no abre el modal; `[data-nuevo-el]` abre «Nuevo evento» con esa fecha; con hoy sábado 31/10 y el fin de semana oculto, el elegido es el viernes 30;
- el teclado: `ArrowRight` en el número del 28/10 pasa el `tabindex="0"` y el foco al 29; `ArrowDown`, al 04/11 de la fila de abajo (si se ve); `Home`/`End`, al primero y al último de la fila; en el borde de la grilla no se mueve;
- el movimiento: con `cuadros: true`, la primera vez que el mes se dibuja visible `#ag-mes` tiene `data-animar` y las barras `--demora`; dos cuadros después ya no lo tiene; cambiar de mes o prender el fin de semana no lo vuelve a poner; con `reducido: true` o sin `requestAnimationFrame`, nunca;
- después de guardar un evento abierto desde un número, el foco vuelve al `[data-dia]` de esa fecha;
- los que ya había (‹ › Hoy, respuesta vieja, «y 2 más» con el foco, la leyenda sin compañeros para el lector, los errores, el 401, abrir propio/ajeno) siguen, con su HTML nuevo.

Run → FAIL.

- [ ] **Step 2: Implementar**

`rutaDeEventos` suma `mes` en el pedido del mes (no en el de los próximos). `pintarMesDeEventos` llama a `htmlDelMes` con el estado y `enElTelefono()`, escribe `#ag-frase` (con `textContent`; `null` deja el texto vacío), `#ag-finde`/`#ag-finde-cuenta` y, siempre, `#ag-elegido`. `alTocarEventos` suma `#ag-finde`, `[data-dia]`, `[data-nuevo-el]` y el clic en la celda (`closest('.me-celda')` cuando el blanco no es un evento ni `[data-ver-mas]`). Un `keydown` delegado en `#ag-mes` para las flechas, Inicio y Fin sobre `[data-dia]`. Un `matchMedia(...).addEventListener('change', …)` (si existe) que vuelve a pintar el mes. El movimiento, como `animarLaBanda` del Resumen (una vez por carga, solo con la pestaña visible y datos del mes, sin `prefers-reduced-motion`). Cambiar de mes pone `elegido` y `foco` en `diaVisibleCercano(hoy o el 1)`.

Run → PASS.

- [ ] **Step 3: Suite completa y commit**
```bash
git commit -am "feat(mi-espacio): sábado y domingo, tocar un día, el teclado, el día elegido y el movimiento"
```

---

### Task 9: CLAUDE.md, la página de verdad y la revisión

**Files:**
- Modify: `CLAUDE.md` (la convención de `mi-espacio.js`, «Mi espacio: la agenda», los tests y «Despliegue»)

- [ ] **Step 1: CLAUDE.md**

En la convención de `mi-espacio.js`: las funciones nuevas (Tasks 5, 6, 8), `CLAVE_DEL_FIN_DE_SEMANA`, el `tabindex` móvil, el día elegido, el movimiento, `data-lineas` y el `VERSION_MI_ESPACIO` nuevo. En «Mi espacio: la agenda»: la spec 2026-10-28, el nombre corto (`nombreCorto`, `administracionActiva`, dónde va y dónde no), `companeros_por_dia`, `frase_del_mes` y `FRASE_DE_LA_LICENCIA`, el fin de semana, la pizarra. En «Despliegue»: sin SQL ni cron, archivos + Restart, después del kit de la licencia anulada.

- [ ] **Step 2: Mirar la página de verdad**

Crear `rpad_rama_agenda_onda` (copia de la base local con `mysqldump | mariadb`, sin tocar la original), cargarle eventos y licencias inventados como los de la maqueta y levantar el servidor de la rama contra esa base (una entrada propia en `.claude/launch.json`, con `DB_NAME` de la copia y un puerto libre). Recorrer octubre, noviembre, diciembre y enero en 1440 px, 980 px, 390 px y 320 px, con el fin de semana prendido y apagado, el modal desde un día, el teclado y `forced-colors`. Sin errores en la consola. Sacar capturas para el traspaso.

- [ ] **Step 3: Revisión de toda la rama** (superpowers:requesting-code-review, con Opus), corregir lo que salga, y `npm test` completo en verde.

- [ ] **Step 4: Commit**
```bash
git commit -am "docs(mi-espacio): CLAUDE.md con la agenda con más onda"
```

---

### Task 10: Merge, push, kit y traspaso

- [ ] **Step 1:** Si las tareas, la revisión final y la suite dieron bien: `git checkout main && git merge --no-ff claude/mi-espacio-agenda-onda-dc5c38` (mensaje con el resumen, como los merges anteriores) y `git push`. Antes, revisar que `git log -p origin/main..` no tenga ningún nombre de la tabla `usuarios` de la base local.
- [ ] **Step 2: El kit** en `C:\Users\Mariano\Desktop\RPAD-deploy-mi-espacio-agenda-onda`, como `RPAD-deploy-mi-espacio-licencia-word`: `PASOS.txt` (requisito: el kit de la licencia anulada; comprobación previa; qué cambia; backup de `controllers`, `services`, `routes` y `public`; subir el zip; Restart; verificar; la vuelta atrás), `archivos-mi-espacio-agenda-onda/` y su `.zip` con los archivos de `git diff --name-only <merge de la licencia anulada>..<merge nuevo>` sin tests ni docs, `vuelta-atras/` con esos mismos archivos en el merge de la licencia anulada, y `VERIFICACION.txt` con la comparación byte a byte de cada archivo del kit contra `git show <merge>:<ruta>` (y de la vuelta atrás contra el merge anterior).
- [ ] **Step 3:** Borrar `rpad_rama_agenda_onda` y la entrada de `launch.json`; dejar `mi-espacio-agenda-onda-cierre.md` en la carpeta de notas de la coordinadora (qué se hizo, el merge, el kit, los totales de la suite, los bordes abiertos); avisarle con `SendMessage` (`local_62853c2f-ecfd-4cf2-bc66-93f666633e21`).
