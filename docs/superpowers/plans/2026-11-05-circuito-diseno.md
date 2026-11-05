# El circuito: quién y qué, juntos — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que las etapas del circuito se vean, en Métricas, en sus dos PDF y en el Seguimiento, sin mover ninguna cifra ni ningún texto.

**Architecture:** solo dibujo. Métricas cambia únicamente CSS, sobre el HTML de hoy. El Seguimiento cambia CSS y saca el estado del Área de su caja. El PDF de Métricas y el Informe anual comparten un dibujante, que se reemplaza. Reglas, datos y foto no se tocan.

**Tech Stack:** Node 22, vanilla JS, CSS, PDFKit, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-05-circuito-diseno-design.md`.

## Global Constraints

- **No se escribe código hasta que la coordinadora dé el turno.** Al recibirlo, traer `main` con `sync_with_base_branch`; si cambió alguno de los archivos de abajo, ajustar el plan antes de seguir.
- **Ninguna cifra ni ningún texto cambia.** Si falla un test de un texto o de una cifra, el error es del cambio: no se toca el test.
- **No tocar:** `services/metricasReglas.js`, `metricasCinta.js`, `metricasFoto.js`, `seguimientoReglas.js`, `seguimientoPdf.js`, `reportesCicloDeVidaPdf.js`, `reportesPorAreaPdf.js`, `notasDigitalesAnexo.js`, los controladores, `public/js/reportes.js`, `public/css/main.css` y `NODOS` ni `contorno` de `reportesMetricasPdf.js`.
- `reportes.js` no cambia, así que `VERSION_REPORTES` y `VERSION_FERIADOS` tampoco.
- Lenguaje neutro: nunca «tardanza», «demora», «atraso», «sin respuesta», «sin entregar» ni «no mandó».
- Datos inventados en tests, docs y ejemplos. Ningún email real. Nunca `docker compose` desde un worktree, ni `down -v`, ni `pkill -f`, ni `killall` con patrón.
- La base `datospublicos_mcr_rpad` es de solo lectura. Lo real se mira en una copia, y lo que salga de ahí no entra al repo.
- `npm test` completo antes y después de cada tarea, una sola suite a la vez; el `.env` copiado del checkout principal, sin mostrarlo.
- Commit y push de la rama después de cada tarea. Comentarios y nombres en español.

## Archivos

- `public/reportes.html`: los tokens del Área y el CSS del circuito.
- `public/seguimiento.html`: los tokens, el CSS del circuito y el `?v=` de `seguimiento.js`.
- `public/js/seguimiento.js`: `htmlDelCircuito`.
- `services/reportesMetricasPdf.js`: `piezaDelCircuito` y lo que usa.
- `tests/reportes-pdf.test.js`, `tests/seguimiento-frontend.test.js`, `tests/paginas.test.js`.
- `docs/temas/metricas-y-reportes.md`, `docs/temas/seguimiento.md`, `docs/temas/ciclo-de-vida.md`, `docs/temas/notas-dgmit.md`.

## Clasificación de las tareas

| Tarea | Dificultad | Modelo | Motivo |
|---|---|---|---|
| 1. La página de Métricas | media | Sonnet | Solo CSS; ningún test lo lee, y se comprueba mirando |
| 2. La página del Seguimiento | media | Sonnet | CSS y una función pura que arma HTML |
| 3. El PDF | difícil | Opus | Lista fija: lo que sale en un PDF; cambia la referencia de cinco PDF |
| 4. Lo común y la documentación | media | Sonnet | Un test de paridad y documentos |
| 5. La comparación con el dump | difícil | Opus | Es la prueba de que nada más cambió |

---

## Tarea 1: la página de Métricas

**Files:** `public/reportes.html`.

**Interfaz:** ninguna. El HTML que arma `reportes.js` no cambia: los tests de `tests/reportes-frontend.test.js` tienen que pasar sin tocarlos.

- [ ] **Paso 1: la suite en verde antes de empezar.** `npm test`.

- [ ] **Paso 2: los tokens.** En `:root`, después de `--sg-violeta`:

```css
            /* El Área en el circuito (spec 2026-11-05-circuito-diseno, 4): el mismo color en el Seguimiento y en el PDF (COLOR_DEL_AREA) */
            --sg-del-area: #1F6B73; --sg-del-area-fondo: #E8F4F5;
```

- [ ] **Paso 3: el circuito.** Reemplazar desde `/* El circuito: nodos y flechas, …` hasta `.mt-flecha.dgmit .mt-resp { … }`, inclusive, por este bloque. `.mt-directo` queda como está.

```css
        /* El circuito (spec 2026-11-05-circuito-diseno): una banda de flechas con quién actúa y, debajo de cada una, la etapa que le
           toca. El HTML sigue yendo nodo, flecha, nodo…: en el teléfono se leen así, en una columna, y desde 961 px la grilla los reparte
           en dos filas. La flecha de color es el nodo; `.l`, la línea de antes, ya no se dibuja */
        .mt-tramos { display: grid; align-items: stretch; grid-template-columns: minmax(0, 1fr); }
        .mt-nodo { background: var(--sg-tinta); border-radius: 12px; padding: 10px 14px; display: flex; flex-direction: column; justify-content: center; }
        .mt-nodo .q { font-family: var(--f-titulo); font-weight: 700; color: #fff; line-height: 1.18; font-size: 0.9rem; }
        .mt-nodo .r { font-size: 0.76rem; color: #fff; margin-top: 2px; line-height: 1.25; }
        .mt-nodo.dgmit { background: var(--sg-violeta); }
        .mt-nodo.fin { background: var(--sg-verde); }
        .mt-flecha { min-width: 0; display: flex; flex-direction: column; justify-content: flex-start; margin: 6px 0 14px; padding: 12px; background: #F4F8FC; border: 1px solid #CFE0EF; border-radius: 12px; }
        .mt-flecha .t { order: -1; margin: 0 0 6px; font-family: var(--f-titulo); font-size: 0.92rem; font-weight: 700; color: var(--sg-tinta); line-height: 1.22; }
        .mt-flecha .n { font-family: var(--f-titulo); font-weight: 750; font-size: 1.75rem; color: var(--sg-tinta); line-height: 1.05; letter-spacing: -0.02em; }
        /* La unidad va al lado de la cifra y no se corta en dos renglones */
        .mt-flecha .n small { white-space: nowrap; font-family: var(--f-texto); font-size: 0.8rem; font-weight: 600; letter-spacing: 0; color: var(--sg-suave); }
        .mt-flecha .u { font-size: 0.76rem; font-weight: 600; color: var(--sg-suave); line-height: 1.2; margin-top: 3px; }
        .mt-flecha .o { font-size: 0.76rem; font-weight: 600; color: var(--sg-ambar); line-height: 1.25; margin-top: 3px; }
        .mt-flecha .l { display: none; }
        .mt-flecha .c { font-size: 0.8rem; color: var(--sg-suave); line-height: 1.35; margin-top: 6px; }
        .mt-flecha .c b { color: var(--sg-texto); font-weight: 600; }
        .mt-flecha .c.curso { color: var(--sg-ambar); font-weight: 600; }
        .mt-flecha .c.pend { color: var(--sg-violeta); font-weight: 600; }
        .mt-flecha.dgmit { background: var(--sg-violeta-fondo); border-color: #D6CCEB; }
        .mt-flecha.dgmit .n, .mt-flecha.dgmit .u, .mt-flecha.dgmit .t { color: var(--sg-violeta); }
        /* Sin cifra: el porqué en lugar del número y el borde punteado gris (también en la DGMIT) */
        .mt-flecha.vacia { background: var(--sg-sutil); border: 1px dashed var(--sg-gris); }
        .mt-flecha.vacia .n { font-size: 1.05rem; font-weight: 650; letter-spacing: -0.01em; line-height: 1.2; color: var(--sg-suave); }
        /* Quién está a cargo, al pie de la tarjeta: nunca solo el color */
        .mt-flecha > :nth-last-child(2) { margin-bottom: 10px; }
        .mt-resp { align-self: flex-start; margin-top: auto; padding: 1px 8px; border-radius: 999px; background: #fff; color: var(--sg-tinta); font-size: 0.72rem; font-weight: 700; }
        .mt-flecha.dgmit .mt-resp { color: var(--sg-violeta); }
        /* El Área tiene color propio: solo está en la gestión externa, y son el quinto y el sexto de la grilla */
        .mt-tramos.externa > .mt-nodo:nth-child(5) { background: var(--sg-del-area); }
        .mt-tramos.externa > .mt-flecha:nth-child(6) { background: var(--sg-del-area-fondo); border-color: #BFDDE0; }
        .mt-tramos.externa > .mt-flecha.vacia:nth-child(6) { background: #F1F8F9; border-color: var(--sg-del-area); }
        .mt-tramos.externa > .mt-flecha:nth-child(6) .t, .mt-tramos.externa > .mt-flecha:nth-child(6) .mt-resp { color: var(--sg-del-area); }
        .mt-tramos.externa > .mt-flecha:not(.vacia):nth-child(6) .n, .mt-tramos.externa > .mt-flecha:nth-child(6) .u { color: var(--sg-del-area); }
        @media (min-width: 961px) {
            .mt-tramos.externa { grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(0, 0.62fr); }
            .mt-tramos.interna { grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 0.62fr); }
            /* La flecha: `--punta` es lo que sale a la derecha y la muesca donde entra la anterior */
            .mt-nodo { --punta: 16px; grid-row: 1; border-radius: 0; min-height: 76px; margin-right: -10px; padding: 10px calc(var(--punta) + 8px) 10px calc(var(--punta) + 10px);
                clip-path: polygon(0 0, calc(100% - var(--punta)) 0, 100% 50%, calc(100% - var(--punta)) 100%, 0 100%, var(--punta) 50%); }
            .mt-nodo:first-child { padding-left: 14px; border-radius: 12px 0 0 12px; clip-path: polygon(0 0, calc(100% - var(--punta)) 0, 100% 50%, calc(100% - var(--punta)) 100%, 0 100%); }
            .mt-nodo.fin { margin-right: 0; padding-right: 12px; border-radius: 0 12px 12px 0; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, var(--punta) 50%); }
            .mt-flecha { grid-row: 2; margin: 10px 8px 0 0; }
            /* El nombre reserva dos renglones: las cifras quedan a la misma altura */
            .mt-flecha .t { min-height: 2.44em; }
            .mt-tramos > :nth-child(1), .mt-tramos > :nth-child(2) { grid-column: 1; }
            .mt-tramos > :nth-child(3), .mt-tramos > :nth-child(4) { grid-column: 2; }
            .mt-tramos > :nth-child(5), .mt-tramos > :nth-child(6) { grid-column: 3; }
            .mt-tramos > :nth-child(7), .mt-tramos > :nth-child(8) { grid-column: 4; }
            .mt-tramos > :nth-child(9) { grid-column: 5; }
        }
        /* En alto contraste la banda pierde el fondo: sin la forma de flecha, queda una caja con borde */
        @media (forced-colors: active) {
            .mt-nodo, .mt-nodo:first-child, .mt-nodo.fin { clip-path: none; padding: 10px 14px; border: 1px solid CanvasText; border-radius: 12px; }
            .mt-nodo, .mt-nodo:first-child { margin-right: 8px; }
            .mt-nodo.fin { margin-right: 0; }
        }
```

- [ ] **Paso 4: el teléfono.** En `@media (max-width: 960px)` sacar las reglas de `.mt-tramos`, `.mt-flecha` y `.mt-flecha .l`, con el comentario que dice «nodo, flecha hacia abajo, nodo…», que pasa a decir que la cinta y las tablas se desplazan de costado.

- [ ] **Paso 5: la suite.** `npm test`. No tiene que fallar nada: ningún test lee estas reglas.

- [ ] **Paso 6: mirarla.** Con la página real, a 1320, 1120 y 961 píxeles y a 375, en las dos gestiones y con los dos estadísticos: las cifras a la misma altura, ninguna palabra cortada, sin desplazamiento horizontal (`document.documentElement.scrollWidth === innerWidth`) y una etapa sin casos con su borde punteado. Comparar con la maqueta, que está fuera del repo.

- [ ] **Paso 7: commit y push.** `feat(metricas): el circuito con la banda de quién actúa y la tarjeta de cada etapa`

---

## Tarea 2: la página del Seguimiento

**Files:** `public/seguimiento.html`, `public/js/seguimiento.js`, `tests/seguimiento-frontend.test.js`, `tests/paginas.test.js`.

**Interfaz:** `htmlDelCircuito(circuito)` devuelve seis hijos en `.sg-tramos`: los mismos cinco de hoy, sin `<div class="e">` en el nodo del Área, y `<div class="sg-estado-area${vencido}"><div class="e">…</div></div>` al final.

**Cuidado:** `.sg-estado`, a secas, ya existe: es la de `#loading`, `#not-found` y `#sg-error`. No se toca.

- [ ] **Paso 1: los tests, que fallan.** En `tests/seguimiento-frontend.test.js`, en el `describe` del circuito:

```js
  it('el estado del área va en su propia tarjeta, debajo de la banda (spec 2026-11-05-circuito-diseno, 6)', () => {
    const vencido = ctx.htmlDelCircuito(seguimientoDe(f(52), HOY).circuito);
    assert.ok(vencido.includes('<div class="sg-estado-area vencido"><div class="e">Vencido hace 81 días</div></div>'));
    assert.ok(vencido.includes('<div class="sg-nodo area">'), 'el nodo sigue marcando al vencido');
    assert.ok(!/class="sg-nodo[^"]*">(?:(?!class="sg-(?:flecha|estado)).)*class="e"/s.test(vencido), 'ningún nodo lleva el estado adentro');
    const alDia = ctx.htmlDelCircuito(seguimientoDe(f(10), HOY).circuito);
    assert.ok(alDia.includes('<div class="sg-estado-area"><div class="e">Vence en 103 días</div></div>'));
    assert.ok(!alDia.includes('sg-estado-area vencido'));
    assert.match(alDia, /<div class="sg-estado-area[^"]*"><div class="e">[^<]*<\/div><\/div>\s*<\/div>/, 'la tarjeta va al final de la grilla');
  });
```

En el test de `:195`, el mensaje `'el área vencida, en rojo'` pasa a `'el nodo marca al área vencida'`: lo rojo ya no es el nodo.

- [ ] **Paso 2: comprobar que falla.** `node --test --test-name-pattern="su propia tarjeta" tests/seguimiento-frontend.test.js`.

- [ ] **Paso 3: `htmlDelCircuito`.** En `public/js/seguimiento.js`, la línea del nodo del Área:

```js
      <div class="sg-nodo${area.vencido ? ' area' : ''}"><div class="q">${escaparTexto(area.nombre) || Utils.SIN_DATO}</div><div class="r">Área responsable</div></div>
      <div class="sg-estado-area${area.vencido ? ' vencido' : ''}"><div class="e">${escaparTexto(area.texto)}</div></div>
```

En el comentario de la función, «el tramo es una línea llena violeta (`sg-flecha registrada`); sin nota, la punteada gris de siempre (`sg-flecha fuera`). En alto contraste se distinguen por el trazo (lleno o punteado).» pasa a decir: «la tarjeta del tramo va en violeta (`sg-flecha registrada`); sin nota, con el borde punteado gris (`sg-flecha fuera`). En alto contraste se distinguen por el trazo (lleno o punteado). El estado del área va en su propia tarjeta, debajo de la banda (spec 2026-11-05-circuito-diseno, 6).»

- [ ] **Paso 4: las versiones.** `public/seguimiento.html` pide `js/seguimiento.js?v=20261130` y `VERSION_SEGUIMIENTO` (`tests/paginas.test.js`) pasa a `'20261130'`, con el motivo sumado a su comentario.

- [ ] **Paso 5: los tokens.** En el `:root` de `public/seguimiento.html`, `--sg-violeta` pasa a llevar su fondo y se suman los del Área:

```css
            --sg-violeta: #5B4691; --sg-violeta-fondo: #EFEAF8;
            /* El Área en el circuito (spec 2026-11-05-circuito-diseno, 4): el mismo color en Métricas y en el PDF (COLOR_DEL_AREA) */
            --sg-del-area: #1F6B73; --sg-del-area-fondo: #E8F4F5;
```

- [ ] **Paso 6: el circuito.** Reemplazar desde `/* Circuito */` hasta `.sg-flecha.registrada .c { … }`, inclusive, por este bloque. `.sg-directo` queda como está.

```css
        /* Circuito (spec 2026-11-05-circuito-diseno): una banda de flechas con quién actúa y, debajo de cada una, lo que le toca. El HTML
           sigue yendo nodo, flecha, nodo…: en el teléfono se leen así, y desde 961 px la grilla los reparte en dos filas. Son siempre seis:
           el RPAD, los avisos, la DGMIT, la nota, el área y su estado. `.l`, la línea de antes, ya no se dibuja */
        .sg-tramos { display: grid; grid-template-columns: minmax(0, 1fr); }
        .sg-nodo { background: var(--sg-tinta); border-radius: 12px; padding: 10px 14px; display: flex; flex-direction: column; justify-content: center; }
        .sg-nodo .q { font-family: var(--f-titulo); font-weight: 700; color: #fff; line-height: 1.18; font-size: 0.95rem; }
        .sg-nodo .r { font-size: 0.8rem; color: #fff; margin-top: 3px; line-height: 1.25; }
        .sg-tramos > .sg-nodo:nth-child(3) { background: var(--sg-violeta); }
        .sg-tramos > .sg-nodo:nth-child(5) { background: var(--sg-del-area); }
        .sg-flecha, .sg-estado-area { min-width: 0; display: flex; flex-direction: column; justify-content: flex-start; margin: 6px 0 14px; padding: 12px; background: #F4F8FC; border: 1px solid #CFE0EF; border-radius: 12px; }
        .sg-flecha .l { display: none; }
        .sg-flecha .n { font-family: var(--f-titulo); font-weight: 750; font-size: 1.25rem; color: var(--sg-tinta); line-height: 1.15; }
        .sg-flecha .c { font-size: 0.82rem; color: var(--sg-suave); margin-top: 6px; }
        /* La nota formal: sin nota DGMIT, el borde punteado gris; con una nota cargada, en violeta (en alto contraste se distinguen por el
           trazo, lleno o punteado) */
        .sg-flecha.fuera { background: var(--sg-sutil); border: 1px dashed var(--sg-gris); }
        .sg-flecha.fuera .n { color: var(--sg-suave); font-weight: 650; }
        .sg-flecha.registrada { background: var(--sg-violeta-fondo); border-color: #D6CCEB; }
        .sg-flecha.registrada .n { color: var(--sg-violeta); }
        .sg-flecha.registrada .c { color: var(--sg-texto); font-weight: 600; }
        .sg-estado-area { background: var(--sg-del-area-fondo); border-color: #BFDDE0; }
        .sg-estado-area .e { font-family: var(--f-titulo); font-weight: 750; font-size: 1.25rem; line-height: 1.15; color: var(--sg-del-area); }
        .sg-estado-area.vencido { background: var(--sg-rojo-fondo); border-color: #EFCACA; }
        .sg-estado-area.vencido .e { color: var(--sg-rojo); }
        @media (min-width: 961px) {
            .sg-tramos { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.1fr); }
            /* La flecha: `--punta` es lo que sale a la derecha y la muesca donde entra la anterior */
            .sg-nodo { --punta: 16px; grid-row: 1; border-radius: 0; min-height: 76px; margin-right: -10px; padding: 10px calc(var(--punta) + 8px) 10px calc(var(--punta) + 10px);
                clip-path: polygon(0 0, calc(100% - var(--punta)) 0, 100% 50%, calc(100% - var(--punta)) 100%, 0 100%, var(--punta) 50%); }
            .sg-tramos > .sg-nodo:nth-child(1) { padding-left: 14px; border-radius: 12px 0 0 12px; clip-path: polygon(0 0, calc(100% - var(--punta)) 0, 100% 50%, calc(100% - var(--punta)) 100%, 0 100%); }
            .sg-tramos > .sg-nodo:nth-child(5) { margin-right: 0; padding-right: 12px; border-radius: 0 12px 12px 0; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, var(--punta) 50%); }
            .sg-flecha, .sg-estado-area { grid-row: 2; margin: 10px 8px 0 0; }
            .sg-estado-area { margin-right: 0; }
            .sg-tramos > :nth-child(1), .sg-tramos > :nth-child(2) { grid-column: 1; }
            .sg-tramos > :nth-child(3), .sg-tramos > :nth-child(4) { grid-column: 2; }
            .sg-tramos > :nth-child(5), .sg-tramos > :nth-child(6) { grid-column: 3; }
        }
        /* En alto contraste la banda pierde el fondo: sin la forma de flecha, queda una caja con borde */
        @media (forced-colors: active) {
            .sg-nodo, .sg-tramos > .sg-nodo:nth-child(1), .sg-tramos > .sg-nodo:nth-child(5) { clip-path: none; padding: 10px 14px; border: 1px solid CanvasText; border-radius: 12px; }
            .sg-nodo, .sg-tramos > .sg-nodo:nth-child(1) { margin-right: 8px; }
            .sg-tramos > .sg-nodo:nth-child(5) { margin-right: 0; }
        }
```

- [ ] **Paso 7: el teléfono.** En `@media (max-width: 960px)`, de la línea de `.sg-tramos`, sacar `.sg-tramos { … }`, `.sg-flecha { … }` y `.sg-flecha .l { … }`.

- [ ] **Paso 8: la suite.** `npm test`.

- [ ] **Paso 9: mirarla.** Con un dataset de cada estado: externo vencido, al día, con una nota DGMIT cargada, «No requiere nota», interno, eventual (sin vencimiento) y dado de baja; y con `.sg-directo`. `#loading`, un id que no existe (`#not-found`) y la lista sin `id` se ven como hoy. A 1320, 1120, 961 y 375 píxeles: un nombre de área largo entra en su banda sin salirse de la flecha, y sin desplazamiento horizontal.

- [ ] **Paso 10: commit y push.** `feat(seguimiento): los avisos del ciclo abierto con el diseño del circuito`

---

## Tarea 3: el PDF de Métricas y el Informe anual

**Files:** `services/reportesMetricasPdf.js`, `tests/reportes-pdf.test.js`.

**Interfaz:**
- `piezaDelCircuito(doc, tramos, gestion)` sigue devolviendo `{ alto, dibujar(y, x0) }`.
- `export const COLOR_DEL_AREA = '#1F6B73'`.
- `piezaDeInsignia(doc, valor, { ancho, color, fondo = COLOR.blanco })`.

- [ ] **Paso 1: los tests, que fallan.** En `tests/reportes-pdf.test.js`, un `describe('el circuito: la banda y la etapa (spec 2026-11-05-circuito-diseno)')`, con `textosPorHoja` de `tests/pdf-lector.js`. Cada texto trae su posición y su letra; `base` se mide desde abajo, así que «más arriba» es `base` mayor. Las siglas salen dos veces: se separan por la letra, la banda en 8 y la insignia en 6,2.

- En la hoja 1 de Métricas, las siglas de la banda (letra 8) van de izquierda a derecha a la misma `base`: `RPAD`, `DGMIT y DA`, `Área`, `DDPC`, `Portal`; en la interna, `RPAD`, `DGMIT y DIT`, `DDPC`, `Portal`.
- En cada columna, el nombre de la etapa está más arriba que su cifra, los dos están más abajo que su banda y a su misma `x`, con menos de 12 puntos de diferencia.
- Los nombres de las etapas de una gestión están a la misma `base`, y las cifras de letra 13, también. «Sin casos en 2026» va en letra 8: no entra en esa comparación.
- Debajo de `Portal` no hay ningún texto en su columna hasta las aclaraciones.
- Con un tramo que no llega (`null` en `vista.circuito.externa`), el PDF se arma igual.
- Con lo más largo de cada campo (`vacio.titulo` «Todavía no hay notas DGMIT cargadas», `vacio.texto` «Se empieza a contar cuando haya notas DGMIT cargadas», `en_curso.texto` de 3 cifras en promedio y `pendientes_texto` «100 notas pendientes de carga») ninguna línea termina en «…» y pasa `verificarDiagramacion(await diagramacion(render))`, de `tests/pdf-diagramacion.js`.
- El Informe anual imprime la misma banda.

- [ ] **Paso 2: comprobar que fallan.** `node --test --test-name-pattern="la banda y la etapa" tests/reportes-pdf.test.js`.

- [ ] **Paso 3: las medidas.** En `services/reportesMetricasPdf.js`, reemplazar `CIRCUITO_DE_LA_GESTION`, `NODO` y `FLECHA` por:

```js
// El circuito de cada gestión: cada nodo con la clave de su tramo (la etapa que le toca, debajo de él) y la parte del ancho de cada
// columna. El Portal va más angosto y sin etapa
const CIRCUITO_DE_LA_GESTION = Object.freeze({
  externa: { pasos: [['rpad', 'aviso'], ['da', 'tramite'], ['area', 'respuesta'], ['ddpc', 'carga'], ['portal', null]], pesos: [1, 1, 1, 1, 0.62] },
  interna: { pasos: [['rpad', 'aviso'], ['dit', 'produccion'], ['ddpc', 'carga'], ['portal', null]], pesos: [1, 1, 1, 0.62] }
});
// La banda: el aire, el alto mínimo, la punta de cada flecha, lo que queda entre dos, el radio de las puntas redondeadas y el aire debajo.
// La etapa: el aire, el radio, lo que queda entre dos y lo que queda debajo del nombre y arriba de la insignia
const BANDA = { relleno: 3, alto: 24, punta: 7, luz: 2, radio: 4, bajo: 3 };
const ETAPA = { relleno: 4, radio: 4, separacion: 3, bajoNombre: 2, sobreInsignia: 3 };
// El Área tiene color propio en el circuito. No está en NODOS: si no, cambiaría el Ciclo de vida del dato, que también los dibuja
export const COLOR_DEL_AREA = '#1F6B73';
// Los colores de una etapa: el fondo y el borde de la tarjeta, el nombre y la cifra, y la insignia (su fondo y su letra). El recuadro ya es
// celeste: la tarjeta común va en blanco
const TONOS_DE_LA_ETAPA = Object.freeze({
  comun: { fondo: COLOR.blanco, borde: '#C9D7E6', tinta: COLOR.tinta, fondoInsignia: COLOR.acentoSuave, letraInsignia: COLOR.acento },
  dgmit: { fondo: '#F5F2FB', borde: '#D6CCEB', tinta: VIOLETA, fondoInsignia: '#E6DFF3', letraInsignia: VIOLETA },
  area: { fondo: '#F0F8F9', borde: '#BFDDE0', tinta: COLOR_DEL_AREA, fondoInsignia: '#D5ECEE', letraInsignia: COLOR_DEL_AREA }
});
const FONDO_SIN_CIFRA = '#F8F9FB';
```

En `LETRA`, cambiar `nodo: 7.4` por `nodo: 8`, `cifra: 12` por `cifra: 13`, `vacio: 7.4` por `vacio: 8` y `nombre: 7` por `nombre: 7.8`. `LETRA` es propia de este archivo: el Ciclo de vida tiene la suya. Comprobar que `LETRA.cifra`, `LETRA.vacio`, `LETRA.nombre` y `LETRA.nodo` no se usan fuera del circuito antes de cambiarlas; si se usan, sumar una nueva.

- [ ] **Paso 4: la insignia.** `piezaDeInsignia(doc, valor, { ancho, color, fondo = COLOR.blanco })`: `contorno(…).fill(fondo)`.

- [ ] **Paso 5: el dibujante.** Reemplazar `nodoDe`, `flechaDe` y `piezaDelCircuito` por:

```js
// La forma de una banda: una flecha, con la muesca donde entra la anterior. La primera y la última van con las puntas redondeadas. Con
// líneas y curvas, como `contorno`: un roundedRect sería, para el test de diagramación, un bloque encimado con su recuadro
const contornoDeBanda = (doc, x, y, ancho, alto, { primera, ultima }) => {
  const r = BANDA.radio;
  const c = r * (1 - KAPPA);
  const p = BANDA.punta;
  const d = x + ancho;
  doc.moveTo(primera ? x + r : x, y);
  if (ultima) doc.lineTo(d - r, y).bezierCurveTo(d - c, y, d, y + c, d, y + r).lineTo(d, y + alto - r).bezierCurveTo(d, y + alto - c, d - c, y + alto, d - r, y + alto);
  else doc.lineTo(d - p, y).lineTo(d, y + alto / 2).lineTo(d - p, y + alto);
  if (primera) doc.lineTo(x + r, y + alto).bezierCurveTo(x + c, y + alto, x, y + alto - c, x, y + alto - r).lineTo(x, y + r).bezierCurveTo(x, y + c, x + c, y, x + r, y);
  else doc.lineTo(x, y + alto).lineTo(x + p, y + alto / 2);
  return doc.closePath();
};

// Una banda: la sigla de quién actúa y qué hace, en blanco sobre su color. `anchoColumna`: la flecha sale de ahí hasta la muesca de la
// siguiente
const bandaDe = (doc, clave, anchoColumna, { primera, ultima }) => {
  const nodo = NODOS[clave];
  const izquierda = primera ? BANDA.relleno : BANDA.punta + BANDA.relleno;
  const derecha = ultima ? BANDA.relleno : BANDA.relleno + BANDA.luz;
  const anchoTexto = anchoColumna - izquierda - derecha;
  return {
    color: clave === 'area' ? COLOR_DEL_AREA : nodo.color,
    izquierda,
    ancho: ultima ? anchoColumna : anchoColumna + BANDA.punta - BANDA.luz,
    contenido: apilar([
      pieza(doc, nodo.nombre, { ancho: anchoTexto, tamano: LETRA.nodo, min: LETRA.nodo - 1.5, fuente: NEGRITA, color: COLOR.blanco, lineas: 2 }),
      pieza(doc, nodo.rol, { ancho: anchoTexto, tamano: LETRA.nodoRol, min: LETRA.nodoRol - 0.5, color: COLOR.blanco, lineas: 2 })
    ], 1)
  };
};

// La etapa de un tramo (un Tramo de vistaDe), con lo que manda el servidor, como htmlDeFlecha de la pestaña: el nombre arriba; la cifra con
// su unidad al lado y el estadístico con los ciclos debajo («27» + «días hábiles», «mediana de 32 ciclos»; con 0, «En el día» y «mediana en
// días hábiles», con los ciclos más abajo), «con tan pocos casos, es orientativo» o, sin cifra, por qué (`vacio.titulo`); «desde → hasta»,
// los pendientes de carga de la DGMIT, los en curso (con «Se cuenta hasta que se registra la actualización.») y, al pie, la insignia de
// quién está a cargo. Lo de la DGMIT en violeta y lo del área en su color; sin cifra, el borde punteado
const etapaDe = (doc, clave, tramo, ancho) => {
  const t = objeto(tramo);
  const cifra = esObjeto(t.cifra) ? t.cifra : null;
  const vacio = cifra === null && esObjeto(t.vacio) ? t.vacio : null;
  const dgmit = t.dgmit === true;
  const tono = dgmit ? TONOS_DE_LA_ETAPA.dgmit : clave === 'respuesta' ? TONOS_DE_LA_ETAPA.area : TONOS_DE_LA_ETAPA.comun;
  const anchoTexto = ancho - 2 * ETAPA.relleno;
  const chico = (valor, { color = COLOR.gris, fuente = NORMAL, lineas = 3, tamano = LETRA.chico } = {}) =>
    pieza(doc, valor, { ancho: anchoTexto, tamano, fuente, color, lineas });
  const deLaDgmit = t.clave === 'tramite';
  let pendientes = null;
  if (vacio && texto(vacio.texto)) {
    pendientes = chico(vacio.texto, deLaDgmit ? { color: VIOLETA, fuente: NEGRITA, lineas: 5 } : { lineas: 5 });
  } else if (texto(t.pendientes_texto)) {
    pendientes = chico(t.pendientes_texto, { color: VIOLETA, fuente: NEGRITA, lineas: 5 });
  }
  const enCurso = esObjeto(t.en_curso) && texto(t.en_curso.texto)
    ? [chico(t.en_curso.texto, { color: AMBAR, fuente: NEGRITA, lineas: 6 }), chico(T.seCuentaHasta)] : [];
  return {
    tono,
    punteada: cifra === null,
    nombre: pieza(doc, t.nombre, { ancho: anchoTexto, tamano: LETRA.nombre, fuente: NEGRITA, color: tono.tinta, lineas: 2 }),
    cuerpo: apilar([
      cifra
        ? piezaDeCifra(doc, { numero: cifra.texto, lado: cifra.unidad }, {
          ancho: anchoTexto, tamano: LETRA.cifra, min: LETRA.cifraMin, tamanoLado: LETRA.unidad, color: tono.tinta
        })
        : pieza(doc, vacio?.titulo, { ancho: anchoTexto, tamano: LETRA.vacio, min: LETRA.vacioMin, fuente: NEGRITA, color: COLOR.gris, lineas: 3 }),
      cifra ? chico(cifra.debajo, { fuente: NEGRITA, color: dgmit ? VIOLETA : COLOR.gris, tamano: LETRA.debajo, lineas: 2 }) : null,
      cifra?.orientativo === true ? chico(T.orientativo, { fuente: NEGRITA, color: AMBAR, tamano: LETRA.orientativo }) : null,
      chico(t.desde_hasta, { lineas: 2 }),
      cifra?.en_el_dia === true ? chico(cifra.ciclos_texto, { color: COLOR.tinta, fuente: NEGRITA, lineas: 1 }) : null,
      pendientes,
      ...enCurso
    ], 1),
    insignia: piezaDeInsignia(doc, t.responsable, { ancho: anchoTexto, color: tono.letraInsignia, fondo: tono.fondoInsignia })
  };
};

// El circuito de una gestión (spec 2026-11-05-circuito-diseno, 7), del ancho de adentro de un recuadro: arriba, la banda de flechas con
// quién actúa; debajo de cada una, la etapa que le toca. Los nombres de las etapas y sus cifras quedan a la misma altura y las tarjetas
// tienen el mismo alto. `tramos`: los de vistaDe para la gestión
const piezaDelCircuito = (doc, tramos, gestion) => {
  const { pasos, pesos } = CIRCUITO_DE_LA_GESTION[gestion];
  const unidad = ANCHO_DEL_RECUADRO / pesos.reduce((total, p) => total + p, 0);
  const tramoDe = (clave) => lista(tramos).find((t) => esObjeto(t) && t.clave === clave) ?? null;
  const columnas = [];
  let x = 0;
  pasos.forEach(([nodo, clave], i) => {
    const ancho = pesos[i] * unidad;
    const lugar = { primera: i === 0, ultima: clave === null };
    columnas.push({ x, ancho, lugar, banda: bandaDe(doc, nodo, ancho, lugar), etapa: clave === null ? null : etapaDe(doc, clave, tramoDe(clave), ancho - ETAPA.separacion) });
    x += ancho;
  });
  const etapas = columnas.filter((c) => c.etapa).map((c) => c.etapa);
  const altoBanda = Math.max(BANDA.alto, ...columnas.map((c) => c.banda.contenido.alto + 2 * BANDA.relleno));
  const altoNombre = Math.max(0, ...etapas.map((e) => e.nombre?.alto ?? 0));
  const altoCuerpo = Math.max(0, ...etapas.map((e) => e.cuerpo.alto));
  const altoInsignia = Math.max(0, ...etapas.map((e) => e.insignia?.alto ?? 0));
  const altoEtapa = 2 * ETAPA.relleno + altoNombre + ETAPA.bajoNombre + altoCuerpo + ETAPA.sobreInsignia + altoInsignia;
  return {
    alto: altoBanda + BANDA.bajo + altoEtapa,
    dibujar: (y, x0) => {
      for (const c of columnas) {
        const xc = x0 + c.x;
        doc.save();
        contornoDeBanda(doc, xc, y, c.banda.ancho, altoBanda, c.lugar).fill(c.banda.color);
        doc.restore();
        c.banda.contenido.dibujar(y + (altoBanda - c.banda.contenido.alto) / 2, xc + c.banda.izquierda);
        if (!c.etapa) continue;
        const e = c.etapa;
        const yEtapa = y + altoBanda + BANDA.bajo;
        const anchoEtapa = c.ancho - ETAPA.separacion;
        doc.save();
        contorno(doc, xc, yEtapa, anchoEtapa, altoEtapa, ETAPA.radio).fill(e.punteada ? FONDO_SIN_CIFRA : e.tono.fondo);
        doc.restore();
        doc.save();
        doc.lineWidth(0.7);
        if (e.punteada) doc.dash(3, { space: 2 });
        contorno(doc, xc, yEtapa, anchoEtapa, altoEtapa, ETAPA.radio).stroke(e.punteada ? COLOR.grisClaro : e.tono.borde);
        doc.restore();
        const xTexto = xc + ETAPA.relleno;
        e.nombre?.dibujar(yEtapa + ETAPA.relleno, xTexto);
        e.cuerpo.dibujar(yEtapa + ETAPA.relleno + altoNombre + ETAPA.bajoNombre, xTexto);
        e.insignia?.dibujar(yEtapa + altoEtapa - ETAPA.relleno - e.insignia.alto, xTexto);
      }
    }
  };
};
```

`KAPPA` ya existe, junto a `contorno`. Si `etapaDe` usa algo declarado más abajo, moverlo: el orden de las `const` importa. En el comentario de `NODOS`, «el resto en el acento» suma: «(en el circuito de Métricas, el Área lleva `COLOR_DEL_AREA`)»; `NODOS` en sí no cambia.

- [ ] **Paso 6: los tests nuevos en verde.** `node --test --test-name-pattern="la banda y la etapa" tests/reportes-pdf.test.js`.

- [ ] **Paso 7: el test del nombre.** En `ninguna línea dice «trámite»`, el nombre de la etapa va en otro corte de renglón: `for (const t of ['Redacción y entrega de', 'nota'])`. Comprobar el corte real con el error del test antes de escribirlo. Es el único test de este archivo, además de la referencia, que puede cambiar; si falla otro, parar y mirar.

- [ ] **Paso 8: la referencia, comprobando antes.** Un script fuera del repo arma los cinco PDF con el código de `main` y con el de la rama y compara, en todo el PDF, la bolsa de palabras (`lineasPorHoja`, partiendo por espacios), sin las líneas de encabezado y pie de cada hoja: con una hoja menos, salen una vez menos. Tiene que ser idéntica en las cinco entradas. Recién entonces se toman los hashes nuevos y se pegan en `REFERENCIA_DE_LOS_PDF`, sumando al comentario de arriba:

```js
// Todas las hojas 1, y las siguientes de «con una nota DGMIT», se volvieron a tomar por el diseño del circuito (spec 2026-11-05-circuito-diseno, 7):
// el texto de cada PDF tiene las mismas palabras que antes, en otro orden, y en «con una nota DGMIT» los resultados vuelven a la hoja 1, comprobado
// con el diff de texto contra el código de antes.
```

- [ ] **Paso 9: la suite.** `npm test`. El Informe anual sigue con 3 hojas; el test de `:1726` no cambia.

- [ ] **Paso 10: mirarlo.** Generar con el dump, fuera del repo, el PDF de Métricas en las cuatro combinaciones, con destildados y un Informe anual a partir de una foto armada en memoria con `datosDeLaFoto`. Pasar la hoja 1 a imagen y compararla con la maqueta aprobada.

- [ ] **Paso 11: commit y push.** `feat(metricas): el PDF de Métricas y el Informe anual con el diseño del circuito`

---

## Tarea 4: lo común y la documentación

**Files:** `tests/paginas.test.js`, `docs/temas/metricas-y-reportes.md`, `docs/temas/seguimiento.md`, `docs/temas/ciclo-de-vida.md`, `docs/temas/notas-dgmit.md`.

- [ ] **Paso 1: un test de paridad.** En `tests/paginas.test.js`:

```js
describe('el circuito: el mismo diseño en Métricas, el Seguimiento y el PDF (spec 2026-11-05-circuito-diseno)', () => {
  it('el color del Área es uno solo', async () => {
    const { COLOR_DEL_AREA } = await import('../services/reportesMetricasPdf.js');
    for (const pagina of ['reportes.html', 'seguimiento.html']) assert.ok(leer(pagina).includes(`--sg-del-area: ${COLOR_DEL_AREA};`), pagina);
  });

  it('en alto contraste, la banda vuelve a ser una caja con borde', () => {
    for (const [pagina, clase] of [['reportes.html', '.mt-nodo'], ['seguimiento.html', '.sg-nodo']]) {
      const html = leer(pagina);
      const bloque = html.slice(html.indexOf('@media (forced-colors: active)'));
      assert.ok(bloque.includes(clase) && bloque.includes('clip-path: none'), pagina);
    }
  });
});
```

`leer` es la que ya tiene el archivo. Antes de dar el bloque por bueno, comprobar que `seguimiento.html` no tenga otro `@media (forced-colors: active)` antes del nuevo.

- [ ] **Paso 2: `docs/temas/metricas-y-reportes.md`.** En la pestaña Métricas, el paréntesis de «el circuito (nodos y flechas…)» ocupa dos renglones y cada renglón tiene un tope de 600 caracteres: el primero termina en «el circuito (una banda de flechas con quién actúa y, debajo, la tarjeta de cada etapa; lo de la DGMIT en violeta, el Área en verde azulado y el Portal en verde;» y el segundo sigue con «en el teléfono, en una columna; solo CSS, sobre el HTML de nodos y flechas: `.mt-flecha` sigue siendo la etapa y `.l` no se dibuja), la cinta…». En la base de los PDF, sumar: «El circuito de Métricas y del Informe anual (`piezaDelCircuito`) dibuja la misma banda; el color del Área, `COLOR_DEL_AREA`, no está en `NODOS` para no cambiar el Ciclo de vida.». Sumar la spec a «Historia y motivos».

- [ ] **Paso 3: `docs/temas/seguimiento.md`.** En «avisos del ciclo abierto (el circuito dibujado)» sumar que va con el diseño del circuito de Métricas y que el estado del Área va en su tarjeta, `.sg-estado-area`. Sumar la spec a «Historia y motivos». Sumar: «El PDF del Seguimiento, el Reporte por área y los anexos conservan el dibujo de nodos y flechas (decisión del usuario del 05/11/2026): la hoja tiene alturas fijas y sale en los anexos de las notas.».

- [ ] **Paso 4: `docs/temas/ciclo-de-vida.md`.** Sumar que el Ciclo de vida conserva su dibujo y el Área en el acento (decisión del usuario del 05/11/2026), y la spec a «Historia y motivos». Sin palabras de más: `tests/documentos.test.js` controla los topes.

- [ ] **Paso 5: `docs/temas/notas-dgmit.md`.** En el circuito, «línea llena violeta» y «punteado gris» pasan a distinguir la página del PDF: en la página, la tarjeta en violeta o con el borde punteado; en el PDF del Seguimiento, la línea llena o punteada.

- [ ] **Paso 6: la suite.** `npm test`.

- [ ] **Paso 7: commit y push.** `docs(metricas): el diseño del circuito y por qué el PDF del Seguimiento no cambia`

---

## Tarea 5: la comparación con el dump

Fuera del repo, con el código de `main` en una copia y el de la rama, sobre una copia del dump del día. Sin escribir nada en la base.

- [ ] **Paso 1: los datos.** Lo que manda `metricasDe`, en las cuatro combinaciones y con destildados, y `seguimientoDe`, por cada dataset: JSON idéntico. Tiene que dar 0 diferencias: no se tocó ninguna regla.

- [ ] **Paso 2: los PDF que no cambian.** Ciclo de vida, Seguimiento de todos los datasets y Por área de un área: hash idéntico por hoja, con la misma fecha.

- [ ] **Paso 3: los PDF que cambian.** Métricas, en las cuatro combinaciones: la misma bolsa de palabras y la misma cantidad de hojas que antes, o menos si los resultados vuelven a la hoja 1. Informe anual con una foto en memoria: la misma bolsa de palabras.

- [ ] **Paso 4: la revisión final de toda la rama,** con un agente nuevo, sin el contexto de esta sesión.

- [ ] **Paso 5: merge, push y kit.** Con todo en verde, merge a `main` y push. Kit en `~/rpad-kits/RPAD-deploy-circuito-diseno`, con los cuatro archivos de producción, su vuelta atrás y `VERIFICACION.txt`. Sin SQL, con Restart. Si `RPAD-deploy-metricas-frase-casos` todavía no se desplegó, va después de él: la comprobación previa de `PASOS.txt` mira `reportes.js?v=20261209` y `seguimiento.js?v=20261129`. Cambiar en el tablero el orden de despliegue.
