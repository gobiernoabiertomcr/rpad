# La votación cierra cuando votaron todos: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que la votación de la principal del equipo cierre en cuanto vota la última persona de la foto (o a las 12:00, lo que pase primero), con el voto firme desde ese momento y un aviso a quien es la última.

**Architecture:** el cierre anticipado se calcula al leer, de los votos guardados: una regla pura nueva (`cierreAnticipado`) entra en `estadoDeLaVotacion`, que ahora devuelve también el cierre de siempre (para el sellado) y el `id` del voto que cerró (para saber qué votos cuentan). El voto toma la hora con la votación bloqueada y mira el cierre con los votos de ese momento. Sin migración.

**Tech Stack:** Node 22 (ES Modules), Express 4, MariaDB 10.6, vanilla JS, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-23-dato-quincena-votacion-cierre-anticipado-design.md` (anexo de `docs/superpowers/specs/2026-11-23-dato-quincena-principal-votacion-design.md`). Doc vigente: `docs/temas/dato-quincena-principal-equipo.md`.

## Global Constraints

- Las del plan anterior (`docs/superpowers/plans/2026-11-23-dato-quincena-principal-votacion.md`, «Global Constraints») siguen todas: textos del servidor, `Utils.escapeHtml`, `ahoraArgentina()`, un solo calendario por pedido, SQL parametrizado, 500 con mensaje fijo, sin nombres reales, `?v=` con su constante.
- Base: main 7ffaed4 (incluye «Esta semana» de otra sesión, que tocó `services/datoQuincenaReglas.js`: no pisar su cambio).
- `dato-quincena.js?v=20261238` → `20261239` con `VERSION_DATO_QUINCENA`.
- Textos exactos: «La votación cerró el lunes 23/11/2026 a las 21:40, cuando votaron todos.» (`cierre`, franja y mail); «Guardamos tu orden. Votaron todos: la votación cerró.» (`message` del voto que cierra); «Sos la última persona en votar: al guardar, la votación cierra y nadie puede cambiar su orden.» (`aviso_de_cierre`). El 409 de un voto posterior sigue siendo «La votación ya cerró.».
- Turno del contenedor: los tests con base solo con «CONTENEDOR LIBRE» de la coordinadora; sin migración esta vez.

## Review Focus

1. **Dos personas que faltan votan a la vez:** las dos reciben 200; la segunda en guardarse es la que cierra; ningún voto aceptado queda fuera del resultado.
2. **Un cambio de alguien que ya votó, justo después del voto que cierra:** 409 y sin fila nueva; un cambio mientras todavía falta alguien: 200.
3. **El sellado no se adelanta:** una votación que cerró por todos un domingo o la noche anterior se sella recién a las 14:00 del día del cierre de siempre, y su `cierre_at` es la hora del voto que cerró.
4. **Foto vacía o alguien que nunca vota:** nunca cierra antes de las 12:00.
5. **El aviso del diálogo:** solo para quien es la única que falta; no para quien ya votó y cambia.

---

### Task 1: Las reglas (puras)

**Files:**
- Modify: `services/datoQuincenaVotacionReglas.js`, `tests/fixtures/dato-quincena-respuestas.json`
- Test: `tests/dato-quincena-votacion-reglas.test.js`, `tests/dato-quincena-reglas.test.js`, `tests/dato-quincena-frontend.test.js` (claves de los fixtures)

**Interfaces:**
- Produces:
  - `cierreAnticipado({ personas, votos, ordenes, cierreNominal }) → { id, votado_at } | null`: null si `personas` está vacía o si alguna persona no tiene un voto válido (orden que es permutación de `ordenes`) con `votado_at` (16 primeros) menor que `cierreNominal` (sin `cierreNominal`, cualquiera); si no, de los primeros votos válidos de cada persona (el de menor `id`), el de mayor `id`.
  - `estadoDeLaVotacion({ cierre_at, fecha_edicion, llegada, ahora, calendario, personas = [], votos = [], ordenes = [] }) → { abierta, cierre, cierre_nominal, por_todos, hasta_id, sin_calendario }`:
    - `cierre_nominal`: el de `cierreDeLaVotacion` (null sin calendario);
    - con `cierreAnticipado` no null: `por_todos` true, `hasta_id` su `id`, `cierre` su `votado_at` (16), `abierta` false — también si está sellada o sin calendario (los votos alcanzan);
    - si no: como hoy (`por_todos` false, `hasta_id` null); sellada, `cierre` de `cierre_at`.
  - `estadoDeLaVotacionLeida(votacion, { ahora, calendario })`: pasa también `votacion.personas`, `votacion.votos` y `votacion.ordenes` (con `[]` si no vienen).
  - `votosVigentes({ personas, votos, cierre, ordenes, hastaId = null })`: con `hastaId`, cuentan los votos con `id <= hastaId` (sin mirar la hora); sin él, como hoy.
  - `votacionDelDetalle`: usa `hastaId: estado.hasta_id`; cerrada por todos, `cierre` «La votación cerró ${cierreLargo(cierre)}, cuando votaron todos.»; clave nueva `aviso_de_cierre` después de `dialogo`: el texto de Global Constraints si `puede_votar`, quien mira no tiene voto vigente y es la única que falta; si no, null.
  - `votacionDeLaLista`, `votacionParaLaLista` e `itemsDeLaVotacionEnMiEspacio`: con `hastaId` del estado (cerrada por todos no muestra ítem ni «Se vota hasta…»).
  - `mensajeDelVoto({ cambio, cierre, cerro = false })`: con `cerro`, «Guardamos tu orden. Votaron todos: la votación cerró.».
- [ ] **Step 1: Write the failing tests** (`dato-quincena-votacion-reglas.test.js`, con personas y votos inventados): `cierreAnticipado` (foto vacía → null; uno sin votar → null; todos votaron → el primer voto de la última, aunque otras hayan cambiado después o antes; un voto inválido no cuenta; un voto con `votado_at` ≥ cierre nominal no cuenta); `estadoDeLaVotacion` cerrada por todos antes de las 12:00 (con `cierre`, `cierre_nominal`, `hasta_id`), sellada por todos, sin calendario por todos; `votosVigentes` con `hastaId` (un cambio con id mayor no cuenta, uno menor sí); `votacionDelDetalle` cerrada por todos (texto del cierre, resultado con los vigentes hasta el id) y `aviso_de_cierre` (solo a la única que falta; null para quien ya votó, para quien no está y con la votación cerrada); `votacionDeLaLista` cerrada por todos → null; Mi espacio sin ítem cerrada por todos; `mensajeDelVoto` con `cerro`. En `dato-quincena-reglas.test.js` y el fixture: `aviso_de_cierre` en cada `detalle_votacion_*` (en su lugar) y un `detalle_votacion_cerrada_por_todos`; `dato-quincena-frontend.test.js` suma la clave a su lista.
- [ ] **Step 2: Run** `node --test tests/dato-quincena-votacion-reglas.test.js tests/dato-quincena-reglas.test.js tests/dato-quincena-frontend.test.js` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** el mismo comando → PASS, más `tests/calendario-unico.test.js`.
- [ ] **Step 5: Commit** `feat(dato-quincena): la votación cierra cuando votaron todos (las reglas)`.

---

### Task 2: El voto y el sellado

**Files:**
- Modify: `services/datoQuincenaVotacionDatos.js` (`guardarVoto`), `controllers/datoQuincenaVotacionController.js` (`votar`), `services/datoQuincenaVotacion.js` (el sellado)
- Test: `tests/dato-quincena-votacion-api.test.js`, `tests/dato-quincena-votacion-sellado.test.js`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `guardarVoto({ edicionId, usuarioId, orden, reloj = ahoraArgentina, estaCerrada }) → { votacion, persona, cerrada, cambio, cerro }`: con la fila bloqueada (el `FOR UPDATE` de hoy), lee la foto, los votos y los `orden` de las propuestas de esa edición (sin candado), toma `ahora = reloj()` y llama `estaCerrada({ cierre_at, fecha_edicion, recibida_ts, personas, votos, ordenes, ahora })`; inserta con `votado_at = ahora`; `cerro` true si con el voto nuevo la foto quedó completa (`cierreAnticipado` da el id del voto insertado).
  - `votar`: `estaCerrada` usa `estadoDeLaVotacionLeida` con lo que recibe (incluido `ahora`); el `message` sale de `mensajeDelVoto({ cambio, cierre, cerro })`.
  - El sellado: `debeSellar` con `estado.cierre_nominal` (no con el cierre anticipado); `sellarLaVotacion` guarda `${estado.cierre}:00` (la hora del voto que cerró, si cerró por todos). Para eso el cálculo usa la votación leída entera (`leerVotaciones`), no solo la fila de `votacionesSinSellar`.
- [ ] **Step 1: Write the failing tests**: en `dato-quincena-votacion-api.test.js` (con `reloj` inyectable donde haga falta): votar la última → 200 con el mensaje de cierre y la edición cerrada en el detalle; un cambio de cualquiera después → 409 «La votación ya cerró.» sin fila nueva; un cambio mientras falta alguien → 200; **Review Focus 1**: dos que faltan votan a la vez → dos 200, una sola de las respuestas trae el mensaje de cierre y el resultado cuenta los dos votos; **Review Focus 2**. En `dato-quincena-votacion-sellado.test.js`: **Review Focus 3** (cerró por todos el lunes 23/11 a las 21:40, feriado: no sella el 24/11 a las 8:05 ni a las 13:59; sella a las 14:00 con `cierre_at` '2026-11-23 21:40:00' y el mail dice «…, cuando votaron todos.»); **Review Focus 4** (alguien que nunca vota: sella a las 14:00 del día del cierre con el cierre de las 12:00, como hoy).
- [ ] **Step 2: Run** (CONTENEDOR LIBRE) `node --test tests/dato-quincena-votacion-api.test.js` y después `node --test tests/dato-quincena-votacion-sellado.test.js` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** esos dos, `tests/dato-quincena-api.test.js`, `tests/mi-espacio-eventos-api.test.js` y `tests/permisos.test.js`, de a uno → PASS.
- [ ] **Step 5: Commit** `feat(dato-quincena): el voto que completa la lista cierra la votación`.

---

### Task 3: La página

**Files:**
- Modify: `public/dato-quincena.html` (un `<p>` para el aviso dentro de `#dq-voto`, arriba del pie; `?v=20261239`), `public/js/dato-quincena.js`
- Test: `tests/dato-quincena-frontend.test.js`, `tests/paginas.test.js`

**Interfaces:**
- Consumes: `votacion.aviso_de_cierre` (Task 1).
- Produces: al abrir el diálogo, el aviso se pone con `textContent` y se muestra solo si viene (con `hidden` si no); va asociado al diálogo (`aria-describedby` suma su id cuando se muestra) y no es una región viva. Después de guardar el voto que cierra, el redibujo de hoy muestra la franja cerrada.
- [ ] **Step 1: Write the failing tests**: con `aviso_de_cierre` el diálogo lo muestra arriba de «Guardar mi orden», escapado; sin él, oculto; **Review Focus 5** con los fixtures de la Task 1; `VERSION_DATO_QUINCENA` = '20261239'.
- [ ] **Step 2: Run** `node --test tests/dato-quincena-frontend.test.js tests/paginas.test.js` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** el mismo comando → PASS.
- [ ] **Step 5: Commit** `feat(dato-quincena): el aviso a la última persona en votar`.

---

### Task 4: La documentación

**Files:** `docs/temas/dato-quincena-principal-equipo.md` (la regla del cierre por todos, el aviso, el mensaje, qué votos cuentan, el sellado con el cierre de siempre), `docs/temas/dato-quincena.md` si nombra las claves de `votacion`; `tests/documentos.test.js`.
- [ ] Escribir lo vigente (un renglón por oración, decisiones con su motivo), correr `node --test tests/documentos.test.js`, commit `docs(dato-quincena): la votación cierra cuando votaron todos`.

---

### Task 5: El cierre

- [ ] Suite completa (CONTENEDOR LIBRE), revisión final de la rama con Fable 5.2 en esfuerzo alto, una ola de arreglos si hace falta, merge en main (squash) y push, suite de main.
- [ ] Kit `~/rpad-kits/RPAD-deploy-dato-quincena-votacion-cierre-anticipado/` contra lo que esté en producción (ed2e70b, o 7ffaed4 si «Esta semana» ya se desplegó: preguntar a la coordinadora), sin SQL; PASOS comprueba `dato-quincena.js?v=20261238`; ventana: después del martes 24/11 a las 14:10 y antes del lunes 07/12; `control-kit.py`.
- [ ] TODO EN VERDE a la coordinadora y nota de cierre en la carpeta compartida.
