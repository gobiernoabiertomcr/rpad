# Mi espacio, el Resumen «Titular»: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el Resumen «Niveles» de Mi espacio por «Titular», con la misma información:
- la banda celeste con la frase «Te quedan 45 días de vacaciones», la regla de días por licencia y lo que vence, en una línea;
- «El resto de 2026» en números con una línea;
- «Hoy y mañana» abajo, en columnas;
- un solo momento de movimiento al abrir.

**Architecture:**
- **Los textos nuevos los arma el servidor:** `services/miEspacioResumen.js`, puro (`titular`, el `texto` de lo que vence y la extraordinaria corta), y `services/miEspacioEventosReglas.js` (`dia` y `quien` en los eventos de «Hoy y mañana»). La página no arma textos (Ruling 19).
- **La página:** `public/js/mi-espacio.js` reemplaza las funciones puras del Resumen. El movimiento sigue la técnica de hoy: un atributo que se saca dos cuadros después, con transiciones CSS y los números contados con `requestAnimationFrame`.
- **Los estilos:** van en el `<style>` de `public/mi-espacio.html`, con las clases de la maqueta pasadas a `me-`.

**Tech Stack:** Node 22, Express 4, JS sin frameworks. Tests con `node:test`: lo puro, sin base; la página, en un `vm` con el DOM falso de `tests/mi-espacio-frontend.test.js`.

**Spec:** `docs/superpowers/specs/2026-10-27-mi-espacio-resumen-design.md`, aprobada el 27/10/2026.
- **La referencia visual** es la opción 2 de `docs/superpowers/specs/2026-10-27-mi-espacio-resumen-mockups/` (`opcion-2.css` y `opcion-2.js`; preview `maquetas-resumen`, puerto 8766). Donde no coincida con la spec, manda la spec.
- **Consume** la entrega 2 (`docs/superpowers/plans/2026-10-26-mi-espacio-licencias-y-horas.md`) y la 3, la agenda (`docs/superpowers/plans/2026-10-26-mi-espacio-agenda.md`).

## Global Constraints

- **La agenda ya está en main** (merge 780e39b, 27/10/2026) y main ya está traído a esta rama (merge 3ab4607). Se trabaja en esta misma rama, `claude/mi-espacio-resumen-mockups-8c1942`, en su worktree (`mi-espacio-licencias-fc16d6`): no hay worktree nuevo (pedido de la sesión coordinadora).
- **No romper nada:** `npm test` completo antes y después de cada tarea, con el candado `C:\Users\Mariano\.rpad-suite.lock`; nunca dos suites a la vez.
- **Todos los subagentes van con Opus.**
- **Ningún email real** (en local, Mailpit). **Nunca `/api/cron/*`.**
- **La base `datospublicos_mcr_rpad` no se escribe.** Para el recorrido, `rpad_rama_resumen`, una copia.
- **Repositorio público:** sin nombres reales. Los casos de `tests/fixtures/mi-espacio-casos.js` ya son inventados.
- **Sin SQL, sin tablas, sin rutas nuevas, sin librerías ni CDN.** No cambian `api.js`, `main.js`, `main.css`, la carcasa, los formularios, las pestañas Licencias, Horas extras y Agenda, ni el email de vencimiento.
- **CLAUDE.md:**
  - ES Modules y español, sin emojis;
  - en `mi-espacio.js`, lo puro primero y lo que toca el DOM al final;
  - todo texto del servidor pasa por `esc` (también en los `aria-label`) y todo número va con `String`;
  - los tokens van en el `<style>` de la página.
- **Versión:** `VERSION_MI_ESPACIO` sube un día: la que dejó la agenda (según su plan, `'20261210'`) pasa a `'20261211'`, en `tests/paginas.test.js` y en el `?v=` de `mi-espacio.js`. La Task 1 confirma la de partida.
- **Textos fijos** (spec, sección 4; los días con `diaLargo`, «viernes 30/10»):
  - **El `texto` de lo que vence, según los días corridos de hoy a su `fecha` (`diasEntre`):**
    - 2 o más: «Vence el viernes 30/10, en 4 días.» o «Vencen el jueves 31/12, en 66 días.»;
    - 1: «Vence mañana.» o «Vencen mañana.»;
    - 0: «Vence hoy.» o «Vencen hoy.»;
    - menos de 0: «Venció el viernes 30/10.» o «Vencieron el viernes 30/10.».

    Va en singular solo con una cantidad de 1: 1 franco, 1 hora o 1 día.
  - **`titular.encabezado`:** «Lunes 26 de octubre, planta permanente». Se arma con el día de la semana con mayúscula, el número del día sin cero, «de», `nombreDelMes` y la modalidad con la primera letra en minúscula («planta política», «contrato»).
  - **`titular.antes`, `cifra` y `despues`:**
    - «Te quedan», '33' y «días de vacaciones»;
    - con 1: «Te queda», '1' y «día de vacaciones»;
    - con 0: «No te quedan días de vacaciones», '' y ''.
  - **`titular.bajada`** (`[{ texto, vence }]`, en este orden y solo las que hay):
    - «3 vencen el jueves 31/12.» («1 vence el …»), con `vence: true`;
    - «5 ya están cargados para noviembre.» («1 ya está cargado para …»), con los meses de la nota de la capa;
    - «Otros 10 se habilitan el 1/1/2027.» («Otro 1 se habilita el …»; con la cifra en 0, sin «Otros»: «10 se habilitan el 1/1/2027.»), con las fechas de la nota de la capa.
  - **`extraordinaria`:** «Atención médica extraordinaria: sin tope. No usaste en 2026.» («Usaste 1 día en 2026.», «Usaste 3 días en 2026.»).
  - **La página:** «Vence pronto», «El resto de 2026» (con el `anio`), «Hoy y mañana», «Hoy», «Mañana», «Próximo feriado», «No tenés eventos hoy ni mañana.» y «Ver la agenda».
- **Decisiones del usuario al implementar (27/10/2026; spec 2.3 y 4.4):**
  - los eventos de hoy que ya terminaron no van en «Hoy y mañana» (los saca el servidor);
  - con la agenda (`hoy_y_manana.eventos` es una lista), la sección está siempre, con «No tenés eventos hoy ni mañana.» si no hay eventos y «Ver la agenda».
- **El movimiento** (spec, sección 3):
  - tramos: empiezan a los 250 ms, la regla dura en total 1300 ms y cada tramo dura `max(160, n / capacidad × 1300)` ms, uno detrás del otro;
  - líneas del resto: a los 900 ms + 90 ms por línea, de 700 ms cada una;
  - una sola vez por carga de la página;
  - quieto con `prefers-reduced-motion: reduce`.

## Review Focus

1. **HTML en un texto del servidor:** en `titular.antes`, en la bajada, en el `texto` y el `titulo` de lo que vence, en el `quien` y el `titulo` de un evento, y en el nombre de un ausente. Todo se ve escapado, también en los `aria-label`. Test en la Task 3.
2. **Un lector de pantalla nunca lee un número a medio contar:** el número que sube va con `aria-hidden`, y el oculto a la vista ya tiene el valor final desde el primer cuadro. Test en la Task 4.
3. **El conteo termina exactamente en el texto del servidor,** también con decimales («1,5») y con «0». Test en la Task 4.
4. **Capas raras** (una con `n` 0, la capacidad en 0, un tramo de 1 día entre 40): sin `NaN` ni `Infinity` en el `style`, y el número del tramo angosto no se pisa. Test en la Task 3.
5. **Un Resumen que se vuelve a dibujar mientras la banda se mueve** (se guarda una licencia en el primer segundo): el nuevo queda quieto y completo, y el conteo viejo no escribe en él. Test en la Task 4.

---

### Task 1: La rama, el main nuevo y el punto de partida

**Files:**
- Modify: este plan (si hace falta, en su propio commit)

Hecha por el controlador el 27/10/2026: los Steps 1 a 3, con este ajuste del plan y de la spec en su propio commit. Lo que se encontró:
- `eventosDeHoyYManana(items, hoy)` da `{ id, hora, titulo, compartido, detalle }`; la llama `eventosDelResumen` de `controllers/miEspacioController.js`, que ya tiene `ahora` (`ahoraArgentina()`). Su test es `tests/mi-espacio-eventos-reglas.test.js` (`describe('eventosDeHoyYManana')`).
- `htmlDeHoyYManana` de `mi-espacio.js` dibuja los eventos con `htmlDeEventosDeHoy` («No tenés eventos hoy ni mañana.» y «Ver la agenda», `data-pestana="agenda"`), solo si `eventos` es una lista; los ausentes, con `htmlDeAusente`.
- **`iniciales` la usa la agenda** (el selector de personas de un evento compartido): se queda.
- `VERSION_MI_ESPACIO` es `'20261210'`.

- [x] **Step 1:** Comprobar que la agenda está en main; si no, parar y avisar a la sesión coordinadora.
- [x] **Step 2: Leer el main nuevo** (`git log` y `git diff` desde el commit de este plan) y **ajustar este plan en la rama,** en su propio commit, si cambió algo. En particular:
  - qué dejó la agenda en `public/js/mi-espacio.js`: `htmlDeHoyYManana` con los eventos y «Ver la agenda», las pestañas, la bajada de la página y si usa `.me-titulo`, `.me-subtitulo` u otra clase del Resumen fuera de él;
  - la forma real de `eventosDeHoyYManana` y sus tests;
  - `VERSION_MI_ESPACIO`;
  - los tests de `tests/mi-espacio-frontend.test.js` y `tests/mi-espacio-resumen.test.js` que miran el Resumen.
- [x] **Step 3: Si un cambio es una decisión del usuario, preguntársela,** sin decidirla (se le preguntaron las dos de «Hoy y mañana»).
- [ ] **Step 4: Preparar el trabajo:**
  - esta rama, con main ya traído;
  - el junction de `node_modules`;
  - `rpad_rama_resumen` como copia de `datospublicos_mcr_rpad`, en el `.env` del worktree.
- [ ] **Step 5:** `npm test` con el candado: anotar el total y 0 fallas.

### Task 2: Los textos del servidor

**Files:**
- Modify: `services/miEspacioResumen.js`, `services/miEspacioEventosReglas.js`, `controllers/miEspacioController.js`
- Test: `tests/mi-espacio-resumen.test.js`, `tests/mi-espacio-eventos-reglas.test.js`

**Interfaces:**
- Produces:
  - **`resumenDe(entrada)`:** suma `titular` después de `tanques`. Es `{ encabezado: string, antes: string, cifra: string, despues: string, bajada: { texto: string, vence: boolean }[] }`, o `null` sin tanques. Las claves quedan así: `modalidad, anio, al_texto, mensaje, abrir_saldos, persona, marca, vence_pronto, faltantes, tanques, titular, pastillas, extraordinaria, tipos, hoy_y_manana`.
  - **Cada cosa de `vence_pronto`** es `{ fecha, dia, mes, titulo, texto, accion }`, sin `cuando` ni `detalle`.
  - **`extraordinaria`,** la corta.
  - **`eventosDeHoyYManana(items, hoy, ahora)`:** cada evento suma `dia: 'hoy' | 'manana'` y `quien: string` (el `quien_texto` en minúscula, o ''). Los demás campos no cambian, `detalle` incluido. Con `ahora` (`'AAAA-MM-DD HH:MM:SS'`, del mismo día que `hoy`), saca los de hoy cuyo fin (`hasta` si es una hora; si no, `desde`) es anterior a `ahora.slice(11, 16)`; sin `ahora`, o si no sirve o es de otro día, no saca ninguno. `eventosDelResumen` del controlador le pasa el `ahora` que ya calcula.

- [ ] **Step 1: Escribir los tests que fallan,** con `PLANTA` y `CONTRATO` de los casos congelados (hoy, el lunes 26/10/2026):
  - **las claves de `resumenDel(PLANTA)`,** con `titular` entre `tanques` y `pastillas`;
  - **`vence_pronto` de `PLANTA`:**
    - el franco: `texto` «Vence el viernes 30/10, en 4 días.»;
    - la licencia: «Vencen el jueves 31/12, en 66 días.»;
    - el resto de los campos, como hoy, sin `cuando` ni `detalle`;
  - **con dos francos sin usar** (el estado del test que ya existe): «Vencen el viernes 30/10, en 4 días.»;
  - **con hoy distinto** (`resumenDel(PLANTA, { hoy })`):
    - el 29/10, «Vence mañana.»;
    - el 30/10, «Vence hoy.»;
    - el sábado 31/10, «Venció el viernes 30/10.» y, con los dos francos, «Vencieron el viernes 30/10.»;
  - **`CONTRATO`:** las horas a favor, «Vencen el viernes 30/10, en 4 días.»;
  - **`titular` de `PLANTA`:**
    ```js
    { encabezado: 'Lunes 26 de octubre, planta permanente', antes: 'Te quedan', cifra: '33', despues: 'días de vacaciones',
      bajada: [{ texto: '3 vencen el jueves 31/12.', vence: true }, { texto: '5 ya están cargados para noviembre.', vence: false },
               { texto: 'Otros 10 se habilitan el 1/1/2027.', vence: false }] }
    ```
  - **`titular` de `CONTRATO`:** el encabezado «Lunes 26 de octubre, contrato», '13' y la bajada `[{ texto: 'Otros 7 se habilitan el 1/1/2027.', vence: false }]`;
  - **con un estado que deja 1 día disponible:** «Te queda», '1' y «día de vacaciones»;
  - **con uno que deja 0** (vacaciones cargadas que consumen todo lo habilitado): «No te quedan días de vacaciones», '' y '', y la bajada «10 se habilitan el 1/1/2027.», sin «Otros»;
  - **con 1 día que vence o 1 cargado:** «1 vence el jueves 31/12.» y «1 ya está cargado para noviembre.»;
  - **sin modalidad o sin arranque:** `titular` `null`;
  - **`extraordinaria`:** los tres textos cortos (no usaste, 3 días y 1 día);
  - **los eventos:** cada uno con su `dia` y su `quien`, por ejemplo `{ …, detalle: 'Hoy · solo vos', dia: 'hoy', quien: 'solo vos' }`; sin `quien_texto`, `quien: ''`. Los tests de la agenda que comparan un evento entero suman las dos claves: es el único cambio permitido a sus aserciones;
  - **los que ya terminaron,** con `ITEMS` y `ahora` el `HOY` a las 10:00:00: el de las 09:00 sin `hasta` no va y el de las 12:00 sí; uno de 09:00 a 10:00 todavía va y a las 10:01 ya no; uno de 09:00 a 11:00, sí; los de mañana van todos aunque sea más tarde que su hora; con `ahora` de otro día, `null`, `'x'` o sin él, van todos.

  Los tests que comparaban `cuando`, `detalle` o la extraordinaria larga se reescriben con los textos nuevos.
- [ ] **Step 2:** `node --test tests/mi-espacio-resumen.test.js` y el de la agenda: FAIL.
- [ ] **Step 3: Implementar,** con lo que ya hay:
  - en `miEspacioResumen.js`, `diasEntre` y `diaLargo`, `nombreDelMes` y `diaDeLaSemana`, y las notas de las capas de `tanqueDeVacaciones` (la bajada no vuelve a calcular meses ni fechas);
  - en `eventosDeHoyYManana`, el `dia` y el `quien` que ya calcula para `detalle`;
  - el JSDoc de `resumenDe` y el comentario de cabecera dicen «Titular».
- [ ] **Step 4:** Los dos tests y `node --test tests/mi-espacio-api.test.js`: PASS.
- [ ] **Step 5: Commit:** `feat(mi-espacio): los textos del Resumen «Titular»: la frase, la bajada, «Vence el …» y los eventos con su día`.

### Task 3: La página, lo que se dibuja

**Files:**
- Modify: `public/js/mi-espacio.js`, `public/mi-espacio.html`, `tests/mi-espacio-frontend.test.js`, `tests/paginas.test.js`

**Interfaces:**
- Consumes: lo que produce la Task 2.
- Produces, puras, en `mi-espacio.js`:
  - `htmlDeLaFrase(titular) → string`: `<div class="me-titular">`, con el encabezado (`p.me-banda-dia`), el `h2#me-frase`, con el número en `<span class="me-cifra"><span aria-hidden="true" data-contar>33</span><span class="visualmente-oculto">33</span></span>` (sin `cifra`, sin `.me-cifra`), y la bajada (`p.me-frase-bajada`: las oraciones unidas con un espacio; la de `vence: true`, en `<b class="vence">`; sin oraciones, sin el `p`).
  - `htmlDeVencePronto(lista) → string`: `<aside class="me-vence" aria-labelledby="me-vence-titulo">`, con el `h2` y un `ol.me-entradas`. Cada cosa es un `li.me-entrada` con:
    - el talón `span.me-talon` (`aria-hidden`), con `<b>` el día y el mes;
    - el `b#me-vence-i` con el título;
    - el `span.me-entrada-texto` con el `texto`;
    - el botón de hoy, `data-accion="cargar-licencia"`, `data-tipo` y `aria-describedby="me-vence-i"`.

    Sin nada, ''.
  - `htmlDeLaRegla(vacaciones) → string`: `<div class="me-regla">`.
    - **La barra:** `div.me-barra` (`aria-hidden`), con `style="grid-template-columns: minmax(0, Nfr) …"`, una columna por capa con su `n` (una `n` que no es un número positivo, 0).
    - **Un `span.me-tramo` por capa,** con su clase (`vence`, `tinta`, `medio`, `cargadas` o `por_habilitar`; una desconocida, `tinta`), `style="--n:N;--demora:Xms;--duracion:Yms"` (sección «El movimiento»; con la capacidad en 0, `--demora:0ms;--duracion:0ms`) y un `<span>` con `n`.
    - **La lista:** `ul.me-regla-lista` con un `li` por capa, con `i.me-muestra` (`aria-hidden`), «<b>Licencia 2024: 3</b>» y la nota. La que vence lleva `class="vence"`.
  - `htmlDeLaBanda(resumen) → string`: `<section class="me-banda" aria-labelledby="me-frase">`, con un `div.me-banda-cuerpo` (con `sin-vence` si no hay nada) que tiene, en este orden, la frase, «Vence pronto» y la regla, y después la ola: el `svg.me-ola` de las páginas públicas, con `aria-hidden` y `focusable="false"`. Sin `titular` o sin `tanques`, ''.
  - `htmlDelResto(resumen) → string`: `<section class="me-resto" aria-labelledby="me-resto-titulo">`, con:
    - **la cabeza** (`div.me-resto-cabeza`): el `h2` «El resto de 2026», `al_texto` y el botón `data-abrir="saldos"` «Mis vacaciones y saldos»;
    - **`ul.me-numeros`:** un link `a.me-numero` (con `vence` si lo es) por cada `tanques.otros`, con `href="#licencias"` o `"#horas"`, `data-pestana` y el `aria-label` del servidor. Adentro: `<b data-contar>22</b>` y la unidad, el nombre, `de`, y `span.me-linea` (`aria-hidden`) con un `<i style="--p:52.4%;--demora:Xms">`. `--p` es `valor / total × 100`, redondeado a un decimal; con el total en 0, 0%;
    - **`htmlDeLosMeses(pastillas)`:** la línea de los francos o las horas a favor;
    - **`p.me-extra`** con la extraordinaria.
  - `htmlDeLosMeses(pastillas) → string`: `p.me-meses` con `<b>titulo:</b>` y un `span.me-mes` por mes («<strong>1</strong> Diciembre <span>Octubre sigue sumando</span>», con su clase por `estado`: `vence` o `pendiente`) y por `previo` (`previo`). Sin nada, ''.
  - `htmlDeHoyYManana(datos, veCompaneros) → string`: `<section class="me-hoy" aria-labelledby="me-hoy-titulo">`, con el `h2` y `div.me-columnas`:
    - **«Hoy»,** con los eventos de `dia: 'hoy'`: `<time>` la hora, el título y `<small>` con `quien` (sin `quien`, sin el `small`). Con `veCompaneros === true`, suma los ausentes de hoy (`li.ausente`, con el texto y `<small>` la vuelta);
    - **«Mañana»,** igual;
    - **«Próximo feriado».**

    Una columna sin nada no va (sin columnas, sin `div.me-columnas`).
    - **Con `eventos` como lista** (aunque vacía), la sección va siempre: sin ningún evento, `p.me-vacio` «No tenés eventos hoy ni mañana.» debajo del `h2`; y «Ver la agenda» (`<a class="sg-link" href="#agenda" data-pestana="agenda">`, como la dejó la agenda) al final de la última columna o, sin columnas, después de esa frase.
    - **Sin `eventos`** (no es una lista): sin columnas, ''; con columnas, sin «Ver la agenda».
  - `htmlDelResumen(resumen)`: como hoy hasta los mensajes. Después, los faltantes, la banda, el resto y «Hoy y mañana». Sin `.me-contexto`.
  - Se van `svgDeTanque`, `htmlDeNivel`, `htmlDeLeyendaDeVacaciones`, `htmlDeTanques`, `htmlDePastillas`, `htmlDeLoQueTeQueda`, `htmlDeAusente`, `htmlDeEventosDeHoy`, `TANQUE_GRANDE`, `TANQUE_CHICO` y `CAPAS_EN_GRIS` (antes de sacar cada una, un `grep` comprueba que nada más la use). **`iniciales` se queda:** la usa la agenda.

- [ ] **Step 1: Escribir los tests que fallan,** en un `describe('el Resumen «Titular»')` que reemplaza al de «Niveles». Los casos se arman con el Resumen de `PLANTA` y de `CONTRATO`, como los de hoy:
  - **El orden:** la banda (frase, «Vence pronto» y regla), el resto y «Hoy y mañana»; sin `.me-contexto`.
  - **La frase:** `h2#me-frase` con «Te quedan», el número dos veces (el visible con `aria-hidden` y `data-contar`, y el oculto) y «días de vacaciones». Con cifra '', sin `.me-cifra`. La bajada tiene sus tres oraciones, y la primera en `<b class="vence">`.
  - **«Vence pronto»:**
    - el `aside`, con su `aria-labelledby`;
    - dos entradas, con el talón `aria-hidden` («30» y «oct»), el título, el `texto` y el botón con `data-tipo="franco"` y `aria-describedby="me-vence-0"`;
    - ni «Viernes 30/10» ni «Es el último día hábil»;
    - sin nada, sin `aside` y la banda con `sin-vence`.
  - **La regla de `PLANTA`:**
    - `grid-template-columns: minmax(0, 3fr) minmax(0, 20fr) minmax(0, 10fr) minmax(0, 5fr) minmax(0, 10fr)`;
    - cinco tramos con su clase, `--n` y su número;
    - `--demora` empieza en 250ms y cada uno empieza donde termina el anterior;
    - la lista, con cinco `li`, «Licencia 2024: 3» con `vence`, y las notas;
    - la barra, con `aria-hidden`.
  - **El resto:**
    - «El resto de 2026», «Al lunes 26/10/2026» y `data-abrir="saldos"`;
    - un link por tanque, con `href`, `data-pestana` y el `aria-label` del servidor, y `--p` de franquicias: 25 de 42 = 59.5%;
    - en `CONTRATO`, las horas a favor con `vence` y `href="#horas"`;
    - los meses, con sus clases y lo no utilizado; sin meses, sin la línea;
    - la extraordinaria.
  - **«Hoy y mañana»:**
    - las tres columnas, con los eventos por `dia`, `quien` debajo y los ausentes solo con `veCompaneros === true`;
    - una columna vacía no va;
    - con `eventos: []` y nada más: la sección, «No tenés eventos hoy ni mañana.» y «Ver la agenda», sin `div.me-columnas`;
    - con `eventos: []` y un feriado: la frase, la columna del feriado y «Ver la agenda» al final de esa columna;
    - con eventos: sin la frase, y «Ver la agenda» al final de la última columna;
    - sin la clave `eventos` y sin nada más, ''; sin `eventos` y con un feriado, la columna sin «Ver la agenda».
  - **Review Focus 1:** el `antes`, una oración de la bajada, un `texto`, un `titulo`, el `quien` y el `titulo` de un evento, y el nombre de un ausente, cada uno con `<img src=x onerror=alert(1)>`, se ven escapados, también en los `aria-label`.
  - **Review Focus 4:** capas con `n` 0, `null` o `'x'`, la capacidad en 0 y un total 0: ningún `NaN` ni `Infinity` en el HTML.
  - **`tests/paginas.test.js`:** la versión nueva.

  Los tests de la página con el DOM falso que esperan `.me-niveles-fila` se cambian en la Task 4; acá solo se reescriben sus selectores si fallan por eso.
- [ ] **Step 2:** `node --test tests/mi-espacio-frontend.test.js tests/paginas.test.js`: FAIL.
- [ ] **Step 3: Implementar las funciones** y, en el `<style>` de `mi-espacio.html`, los estilos de la maqueta (`opcion-2.css`):
  - Las clases pasan de `.o2-` a `.me-`: `banda`, `banda-cuerpo`, `ola`, `banda-dia` (era `dia`), `titular`, `frase`, `cifra`, `frase-bajada` (era `bajada`: `.me-bajada` es la de la página), `regla`, `barra`, `tramo`, `regla-lista` (era `rotulos`), `muestra`, `vence`, `entradas`, `entrada`, `talon`, `entrada-texto` (era `detalle`), `resto`, `resto-cabeza` (era `.o2-resto`), `resto-al`, `numeros`, `numero`, `linea`, `meses`, `mes`, `extra`, `hoy`, `columnas` y `columna`.
  - Se suma `--sg-medio: #4C7AB0` a los tokens.
  - Salen los estilos que solo usaba «Niveles». Antes de sacar cada clase, un `grep` comprueba que nada más la use.
- [ ] **Step 4:** Los dos tests y `npm test` con el candado: PASS.
- [ ] **Step 5: Commit:** `feat(mi-espacio): el Resumen «Titular»: la banda con la frase y la regla, lo que vence, el resto y hoy y mañana en columnas`.

### Task 4: El movimiento

**Files:**
- Modify: `public/js/mi-espacio.js`, `public/mi-espacio.html`, `tests/mi-espacio-frontend.test.js`

**Interfaces:**
- Consumes: el HTML de la Task 3 (`.me-banda`, `.me-resto`, `[data-contar]`, `--demora` y `--duracion`).
- Produces:
  - **`animarLaBanda()`:** reemplaza a `llenarTanques`, y `pagina.bandaAnimada` reemplaza a `pagina.tanquesLlenos`. Con la banda dibujada y a la vista, y si todavía no se animó en esta carga de la página:
    - le pone `data-animar` a `#vista-resumen`;
    - empieza a contar cada `[data-contar]`;
    - saca `data-animar` dos cuadros después.

    Con el Resumen oculto, espera a que se vea, como hoy. Sin `requestAnimationFrame`, no hace nada: todo queda en su valor final.

    Los tiempos de cada número:
    - el de la frase cuenta con la regla: 250 ms de demora y 1300 ms;
    - cada número del resto, con su línea: la `--demora` de su `<i>` y 700 ms.

    Los números de los tramos no cuentan: aparecen con `opacity` al final de su tramo.
  - **`contarHasta(elemento, demoraMs, duracionMs)`:**
    - lee el valor final del texto que dejó el HTML (con coma: '1,5');
    - escribe '0' y lo sube con los tiempos de `requestAnimationFrame`, en enteros hasta el último cuadro, que deja el texto final tal cual;
    - si un cuadro llega sin tiempo (el DOM falso), escribe el final;
    - si el elemento ya no está en el documento, se detiene.

    No cuenta con `matchMedia('(prefers-reduced-motion: reduce)')`.
  - **CSS:**
    - `#vista-resumen[data-animar] .me-tramo, #vista-resumen[data-animar] .me-linea i { transform: scaleX(0) }`;
    - las transiciones `transform var(--duracion) cubic-bezier(0.4, 0, 0.3, 1) var(--demora)` (las líneas, 700ms) y el número del tramo con `opacity`;
    - en `@media (prefers-reduced-motion: reduce)`, sin transiciones ni transformaciones, como hoy.

- [ ] **Step 1: Escribir los tests que fallan,** con el DOM falso. Reemplazan los tres de los tanques:
  - **una sola vez:** `data-animar` en el primer cuadro y no en el segundo; un Resumen que se vuelve a dibujar (por ejemplo, después de guardar una licencia) ya no lo tiene, y sus números están en su valor;
  - **con `#licencias` abierto:** la banda espera a que se vea el Resumen;
  - **sin `requestAnimationFrame`:** ni `data-animar`, y los números en su valor desde el principio;
  - **después del saldo inicial:** sin arranque, el primer Resumen es la invitación. Al guardar «Mis vacaciones y saldos» aparece la banda y se anima (spec, sección 3);
  - **Review Focus 2:** durante el conteo, el `.visualmente-oculto` de la frase ya dice '33';
  - **Review Focus 3:** con cuadros con tiempo (el test pasa `t`), el número de la frase termina en '33', el de las horas a favor de `CONTRATO` en '1,5' y uno en '0' sigue en '0';
  - **Review Focus 5:** se vuelve a dibujar el Resumen entre el primer cuadro y el último. El nuevo no tiene `data-animar` y sus números están en su valor, y los cuadros que quedan del conteo viejo no lo tocan.
- [ ] **Step 2:** `node --test tests/mi-espacio-frontend.test.js`: FAIL.
- [ ] **Step 3: Implementar** `animarLaBanda`, `contarHasta` y el CSS, y cambiar las dos llamadas de `llenarTanques` (al dibujar el Resumen y al mostrar la pestaña).
- [ ] **Step 4:** El test y `npm test` con el candado: PASS.
- [ ] **Step 5: Commit:** `feat(mi-espacio): el Resumen «Titular» se mueve una vez al abrir: la regla, la frase que cuenta y las líneas`.

### Task 5: Documentación, recorrido, revisión final y cierre

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-10-26-mi-espacio-licencias-y-horas-design.md`

- [ ] **Step 1: `CLAUDE.md`:**
  - en «Mi espacio», la descripción del Resumen pasa de «Niveles» (los tanques, las pastillas y «Hoy no están» al costado) a «Titular» (spec, sección 2);
  - en la convención de `mi-espacio.js`, lo puro del Resumen, `animarLaBanda` y que el número que sube va con `aria-hidden`;
  - en «Tests», lo que cambió;
  - el `titular` y el `texto` de `vence_pronto` en la lista de lo que manda el servidor.
- [ ] **Step 2: La spec de licencias y horas,** sección 8: una línea, «El Resumen «Niveles» se reemplazó por «Titular» (`2026-10-27-mi-espacio-resumen-design.md`)».
- [ ] **Step 3: Recorrido en el navegador** sobre `rpad_rama_resumen`:
  - una persona de planta y una de contrato (cargadas con la página, nunca en `datospublicos_mcr_rpad`), y una de administración con un compañero que no está y un evento de hoy;
  - nada por vencer;
  - el movimiento al abrir y que no se repite al guardar una licencia;
  - con «reducir movimiento» (emular `prefers-reduced-motion`);
  - el foco en cada link y botón;
  - 375 px sin desplazamiento de costado.

  Capturas para el usuario.
- [ ] **Step 4: Revisión final de toda la rama** con Opus; se corrigen los hallazgos críticos e importantes.
- [ ] **Step 5:** `npm test` completo con el candado: 0 fallas, con el total de la Task 1 más los nuevos y menos los de «Niveles» que se fueron.
- [ ] **Step 6: Kit `RPAD-deploy-mi-espacio-resumen` en el Escritorio:** los archivos en su ruta, la lista contra `git diff --name-only 780e39b HEAD` (sin `docs/`) y `PASOS.txt`, comparados byte a byte con git (también lo que va dentro de los zip), y `vuelta-atras/` con los mismos archivos de 780e39b:
  1. con la agenda desplegada, respaldo de los archivos;
  2. subir los archivos con el Administrador de archivos;
  3. Setup Node.js App → Restart;
  4. abrir Mi espacio con una cuenta: la banda con la frase y la regla.

  Sin SQL, sin cron y sin Run NPM Install.
- [ ] **Step 7: Merge y push,** autorizados por el usuario si todo está bien:
  - traer main con merge, no rebase, y volver a correr la suite;
  - merge en main y push;
  - comprobar que main y origin coinciden.
- [ ] **Step 8: Limpieza:** quitar el junction de `node_modules` (el worktree queda para que lo limpie la app) y borrar `rpad_rama_resumen`.
- [ ] **Step 9: Traspaso** en la carpeta de notas de la coordinadora y **aviso con SendMessage:** el hash del merge, el kit, los tests antes (Task 1) y después, y lo que el usuario despliega: los archivos y el Restart, después del kit de la agenda.
