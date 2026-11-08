# Métricas: el recorrido típico — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cambiar la cinta del recorrido típico de la pestaña Métricas por «El recorrido típico»: una línea a escala con hitos, en los colores de cada actor, el total arriba y el aviso anticipado por fuera, en una sección propia.

**Architecture:** El servidor (`services/metricasCinta.js`, puro) arma todo —anchos en porcentaje, la x del vencimiento, textos y la frase del lector de pantalla— y la página (`htmlDeCinta` en `public/js/reportes.js`) lo imprime en HTML y CSS, sin SVG y sin calcular (Ruling 19).
La API, la foto del 31/12 y los PDF no cambian de forma: `cinta: { externa, interna }` sigue viajando y guardándose, con el objeto nuevo adentro.

**Tech Stack:** Node 22, ES Modules, `node:test`; JS sin frameworks en el navegador; CSS en el `<style>` de `public/reportes.html`.

**Spec:** `docs/superpowers/specs/2026-11-08-metricas-recorrido-tipico-design.md` (leela entera antes de cada tarea: los textos van al pie de la letra y la tabla de la sección 4 es el contrato).
La maqueta aprobada está fuera del repo, en `~/rpad-notas/metricas-cinta/pagina/public/maqueta.js` (opción `linea`, «A2. La línea con hitos»): su CSS (`.cz-*`, `.cz-l-*`) es la referencia visual; trae cifras de producción, que **nunca** van al repo.

## Global Constraints

- Ruling 19: la página no calcula cifras, textos, plurales ni posiciones; imprime lo del servidor con `escaparTexto` y los números con `coordenada`.
- Textos al pie de la letra de la spec, sección 4. Lenguaje neutro: nunca «tardanza», «demora» ni «atraso».
- Repo público: los tests usan cifras inventadas, y ninguna cifra de la copia de producción.
- Antes de tocar nada, leer `docs/temas/metricas-y-reportes.md` (la cinta, la página y la foto), `docs/temas/frontend.md` y `CLAUDE.md` (Frontend y Reglas transversales).
- `cintaDeMetricas` y `cintasDeLaVista` son puras y nunca tiran.
- Las 11 claves de cada tramo y `vista.circuito.aclaraciones` no cambian (`tests/metricas-huellas.test.js`).
- Los PDF no cambian: `REFERENCIA_DE_LOS_PDF` no se toca.
- Versiones: `VERSION_REPORTES` 20261214 → 20261215 (`tests/paginas.test.js:89` y `public/reportes.html:740`); `VERSION_FERIADOS` 20261215 → 20261216 (`tests/paginas.test.js:41` y `public/configuracion.html:828`), porque tiene que seguir siendo mayor.
- Tests sin base: `node --test tests/<archivo>.test.js`. `tests/metricas-api.test.js` y `tests/metricas-foto.test.js` usan la base: no se corren sin el «CONTENEDOR LIBRE» de la coordinadora (una sola suite por contenedor). Nunca `docker compose` desde el worktree.
- Comentarios y nombres en español, como el resto del archivo; un renglón por oración en la documentación.

## Review Focus

1. **Datos raros en los tramos** (una cifra negativa, `NaN`, un texto, `tramos` que no es una lista, una gestión sin carga): no tira; lo que no se puede leer cuenta como sin cifra, y sin ningún tramo del circuito con cifra devuelve null. Test en la Tarea 1.
2. **Un texto del servidor con HTML o un `actor` que no está en la lista** (`'"><script>'`): la página escapa todo y un actor desconocido se dibuja como `gris`. Test en la Tarea 2.
3. **Ceros**: un tramo a escala de 0 días («En el día», sin porcentaje), todos los tramos a escala en 0 (anchos iguales) y el total en 0 («En total, en el día»). Ningún `NaN`, `null` ni `undefined` en el HTML. Tests en las Tareas 1 y 2.
4. **Una cinta de la forma de antes** (sin `forma: 'recorrido'`, como la de una foto vieja): la página devuelve '' y oculta la sección, sin error. Test en la Tarea 2.
5. **El aviso en los bordes**: de 0 días (regla de ancho 0, «el mismo día del vencimiento»), igual al total (vencimiento al final, sin `sigue`) y más largo que el total (`sigue`). Test en la Tarea 1.

---

### Tarea 1: el servidor arma el recorrido típico (Opus: es una regla y la guarda la foto)

**Files:**
- Rewrite: `services/metricasCinta.js`
- Rewrite: `tests/metricas-cinta.test.js`
- Modify: `tests/metricas-reglas.test.js:2928-2956` (el nombre de la etapa en las cintas)
- Modify: `tests/reportes-pdf.test.js:1061-1063` (lo que el PDF no dice)

**Interfaces:**
- Consumes: de `services/metricasReglas.js`, `unidadDe(valor, dias)`, `cantidadDeLasDos(corridos, habiles)`, `SIN_NOTAS_DGMIT` y `GESTIONES`.
- Produces:
  - `export const FORMA_DE_LA_CINTA = 'recorrido'`;
  - `export const cintaDeMetricas = (tramos, { gestion = 'externa', dias = 'habiles', estadistico = 'mediana' } = {}) => objeto | null` con la forma exacta de la spec, sección 5 («El servidor»): `forma`, `titulo`, `bajada`, `total { antes, cifra, despues }`, `partes [{ clave, actor, ancho, angosta, grande, nombre, dias }]`, `carga { clave, actor, grande, nombre, dias }`, `portal { nombre, texto }`, `vencimiento { x } | null`, `aviso { rotulo, texto, ancho, sigue, vencimiento }`, `orientativos [string]`, `lista [{ actor, nombre, texto }]`, `lista_siempre`, `aclaracion`, `descripcion`;
  - `export const cintasDeLaVista = (vista, { dias, estadistico } = {}) => ({ externa, interna })` (sin `letra`).
  - Se van `ALTURAS_DE_LA_CINTA` y la opción `letra`.

Las reglas (todas de la spec, secciones 4 y 5), para las que el implementador no tiene otra fuente:
- Tramos de la cadena: externa `tramite` (actor `dgmit`), `respuesta` (`area`), `carga` (`ddpc`); interna `produccion` (`dgmit`), `carga` (`ddpc`). El `aviso` va aparte. Un tramo sin cifra legible tiene actor `gris`.
- La cifra de un tramo: `cifra.valor` finito y ≥ 0; los hábiles, `habiles.valor` finito y ≥ 0, solo con `dias === 'corridos'`.
- Los días de un tramo: `cantidadDeLasDos(valor, habiles)` en corridos (con 0, «en el día»); en hábiles, `${valor} ${unidadDe(valor, 'habiles')}` (con 0, «en el día»).
- Con todos los tramos con cifra hay total: `cifra` es `${total} ${unidadDe(total, dias)}`; `despues` es lo que `cantidadDeLasDos(total, habilesTotales)` agrega después de esa cifra (« (57 hábiles)»), solo en corridos y si todos los tramos traen hábiles; `antes` es 'En total, unos '. Con total 0: `{ antes: 'En total, ', cifra: 'en el día', despues: '' }`.
- Porcentajes: solo en la externa y con total > 0; sobre los días de la vista; por el resto mayor (desempate: el primero en la cadena), para que sumen 100; un tramo de 0 días no lleva porcentaje. Texto: `'45 %'` (con un espacio común) o `'menos del 1 %'` si redondea a 0.
- `grande`: el porcentaje (externa completa); si no, los días en corridos sin el paréntesis (`${valor} ${unidadDe(valor, dias)}`) y entonces `dias` es solo el paréntesis de los hábiles (`'(25 hábiles)'`, o '' sin hábiles); con 0 días, 'En el día' y `dias` ''; sin cifra, 'Sin casos' y `dias` 'se completa cuando haya casos' (la redacción con `vacio.titulo === SIN_NOTAS_DGMIT`: 'se completa cuando haya notas DGMIT cargadas').
- Anchos: el peso de un tramo a escala son sus días; el de uno sin cifra, `Math.max(0.7 × suma de los pesos con cifra, 1)`; si todos los pesos son 0, todos 1. `ancho = 100 × peso / suma`, redondeado a dos decimales; el último es `100 − suma de los otros` (redondeado a dos decimales). `angosta`: `ancho < 12`; `lista_siempre`: alguna angosta.
- Vencimiento y regla del aviso (solo si el aviso tiene cifra y todos los tramos de la cadena, la carga también, tienen cifra): `x = min(100, 100 × aviso / días a escala)` con dos decimales (días a escala = suma sin la carga; si es 0, `x` 100); `sigue` si hay total y `aviso > total`, y entonces `vencimiento` null, `aviso.ancho` 100, `aviso.vencimiento` '' y `aviso.texto` lleva «; la publicación llega N días corridos antes del vencimiento» (N = aviso − total, con `unidadDe`). Si no, `vencimiento { x }` y `aviso.ancho = x`.
- Aviso sin regla (falta un tramo, la carga también): `ancho` null, `texto` con « antes del vencimiento» al final. Aviso de 0 días: `texto` 'el mismo día del vencimiento'. Aviso sin cifra: `ancho` null, `texto` 'sin casos todavía'.
- `orientativos`: uno por tramo (el aviso incluido, en el orden de la cadena con el aviso primero) con `cifra.orientativo === true`: `'${nombre}: con tan pocos casos, es orientativo.'`.
- `lista`: un renglón por tramo de la cadena (sin el aviso): externa completa `'${días} · ${porcentaje}'` (sin porcentaje con 0 días: 'en el día'); interna o incompleta, los días; sin cifra, 'sin casos todavía'.
- `aclaracion`: con total, 'El total suma las medianas de cada tramo: es una referencia, no la duración de un caso.' (con promedio, 'los promedios'); sin total, ''.
- `descripcion`: 'El recorrido típico de un pedido de la gestión externa: ' + el total (`antes` + `cifra` + `despues`) con minúscula inicial y punto + cada tramo de la cadena «Nombre: días, 45 %.» (sin porcentaje, «Nombre: días.»; sin cifra, «Nombre: sin casos todavía.») + `'Aviso anticipado: ' + aviso.texto` + « antes del vencimiento» solo cuando hay regla, sin `sigue` y con aviso > 0 + «.».
- null si `tramos` no es una lista o si ningún tramo de la cadena (sin el aviso) tiene cifra.

- [ ] **Step 1: reescribir `tests/metricas-cinta.test.js` para la forma nueva** (borrar el archivo de hoy entero, `REALES` incluido). Con un ayudante `tramo(clave, nombre, valor, habiles, extra)` y cifras inventadas. Tests, con estos nombres y aserciones:
  - `'la externa completa: el total, los porcentajes, los anchos y el vencimiento'`: aviso 35 (24), redacción 38 (25), respuesta 47 (32), carga 0 → `total` `{ antes: 'En total, unos ', cifra: '85 días corridos', despues: ' (57 hábiles)' }`; `partes.map(p => [p.clave, p.actor, p.ancho, p.grande, p.dias])` = `[['tramite','dgmit',44.71,'45 %','38 días corridos (25 hábiles)'], ['respuesta','area',55.29,'55 %','47 días corridos (32 hábiles)']]`; `carga` `{ clave: 'carga', actor: 'ddpc', grande: 'En el día', nombre: 'Preparación y carga', dias: '' }`; `vencimiento` `{ x: 41.18 }`; `aviso` `{ rotulo: 'Aviso anticipado:', texto: '35 días corridos (24 hábiles)', ancho: 41.18, sigue: false, vencimiento: 'vencimiento' }`; `forma` 'recorrido'; `titulo` 'El recorrido típico'; `bajada` la de la spec con «externa»; `portal` `{ nombre: 'Portal', texto: 'datos publicados' }`; `aclaracion` la de la mediana; `lista_siempre` false.
  - `'los porcentajes suman 100 por el resto mayor'`: para 200 cadenas inventadas (redacción y respuesta de 0 a 60, carga de 0 a 3), la suma de los porcentajes es 100 cuando el total es > 0, cada `ancho` es ≥ 0 y la suma de los anchos es 100 (con `Math.abs(suma - 100) < 0.011`).
  - `'la carga de unos días: su porcentaje y sus días, a ancho fijo'`: carga 2 (1) → `carga.grande` '2 %', `carga.dias` '2 días corridos (1 hábil)', y la carga no está en `partes`.
  - `'menos del 1 %'`: redacción 300, respuesta 300, carga 1 → `carga.grande` 'menos del 1 %'.
  - `'la interna: los días en grande, sin porcentajes'`: aviso 20 (14), producción 90 (61), carga 0 → `partes[0].grande` '90 días corridos', `partes[0].dias` '(61 hábiles)', `partes[0].ancho` 100; `lista[0].texto` '90 días corridos (61 hábiles)'; ninguna cadena del objeto tiene '%'.
  - `'un tramo sin casos: gris, sin total ni porcentajes ni vencimiento'`: respuesta sin cifra → `partes[0].grande` '38 días corridos' y `partes[0].dias` '(25 hábiles)'; `partes[1]` actor 'gris', grande 'Sin casos', dias 'se completa cuando haya casos'; `total.antes` 'El total se completa cuando haya casos de todos los tramos' y `cifra` ''; `vencimiento` null; `aviso.ancho` null y `aviso.texto` '35 días corridos (24 hábiles) antes del vencimiento'; el ancho del gris es `100 × max(0.7 × 38, 1) / (38 + 26.6)` redondeado; `aclaracion` ''.
  - `'sin notas DGMIT: la redacción dice que falta cargarlas'`: redacción con `vacio: { titulo: SIN_NOTAS_DGMIT }` y respuesta sin cifra → `partes[0].dias` 'se completa cuando haya notas DGMIT cargadas'.
  - `'el aviso más largo que el circuito'`: interna, aviso 50 (34), producción 31 (21), carga 1 (1) → `aviso` `{ texto: '50 días corridos (34 hábiles); la publicación llega 18 días corridos antes del vencimiento', ancho: 100, sigue: true, vencimiento: '' }` y `vencimiento` null.
  - `'el aviso en los bordes'`: aviso 0 → `aviso.texto` 'el mismo día del vencimiento', `vencimiento.x` 0; aviso igual a la suma a escala con carga 0 → `vencimiento.x` 100 y `sigue` false; aviso sin cifra → `aviso.texto` 'sin casos todavía', `aviso.ancho` null, y la cinta no es null.
  - `'ceros'`: redacción 0, respuesta 0, carga 0 → anchos 50 y 50, grandes 'En el día', `total` `{ antes: 'En total, ', cifra: 'en el día', despues: '' }`; ninguna cadena dice 'NaN', 'undefined' ni 'null'.
  - `'un tramo angosto'`: redacción 2, respuesta 50 → `partes[0].angosta` true y `lista_siempre` true.
  - `'orientativo'`: el aviso con `cifra.orientativo: true` → `orientativos` `['Aviso anticipado: con tan pocos casos, es orientativo.']`.
  - `'la vista en hábiles y el promedio'`: con `dias: 'habiles'` los días dicen 'N días hábiles' sin paréntesis y el total no tiene `despues`; con `estadistico: 'promedio'`, la `aclaracion` dice 'los promedios'.
  - `'descripcion'`: la de la externa completa es exactamente 'El recorrido típico de un pedido de la gestión externa: en total, unos 85 días corridos (57 hábiles). Redacción y entrega de nota: 38 días corridos (25 hábiles), 45 %. Respuesta del área: 47 días corridos (32 hábiles), 55 %. Preparación y carga: en el día. Aviso anticipado: 35 días corridos (24 hábiles) antes del vencimiento.'
  - `'datos raros: nunca tira'`: `cintaDeMetricas(null)`, `(undefined)`, `({})`, `([])`, una lista de tramos sin cifra y `[tramo('tramite', …, -3), tramo('respuesta', …, NaN), tramo('carga', …, '2')]` → null; `[aviso con cifra 'x', redacción 10, respuesta 10, carga 0]` no tira y trata el aviso como sin cifra.
  - `'cintasDeLaVista'`: con una vista inventada de `vistaDe` (la de `mapaDeLosCasos` de `tests/metricas-casos.js`, como hoy) devuelve `{ externa, interna }`, cada una igual a `cintaDeMetricas(vista.circuito[g], { gestion: g, dias, estadistico })`; sin vista, las dos null.
- [ ] **Step 2: correr y ver que falla**: `node --test tests/metricas-cinta.test.js` → falla (la forma de hoy no tiene `forma`, `partes`, …).
- [ ] **Step 3: reescribir `services/metricasCinta.js`** con las interfaces de arriba: borrar todo lo del eje, las marcas, los rótulos medidos y `ALTURAS_DE_LA_CINTA`; dejar el comentario de cabecera al día (qué es, Ruling 19, que la guarda la foto y que la dibuja solo la página).
- [ ] **Step 4: correr y ver que pasa**: `node --test tests/metricas-cinta.test.js` → todo en verde.
- [ ] **Step 5: `tests/metricas-reglas.test.js`, el nombre de la etapa**: en `'ninguna etapa se llama «trámite»…'`, cambiar lo de la cinta: con notas, `cintas.externa.partes[0].nombre` es 'Redacción y entrega de nota' y su `grande` termina en ' %' (mediana y promedio en corridos; en hábiles, el `grande` dice 'días hábiles'); sin notas, `cintas.externa.partes[0]` tiene actor 'gris' y `dias` 'se completa cuando haya notas DGMIT cargadas'; ninguna cinta dice 'trámite'. Borrar las dos aserciones de `segmentos` y `rotulos`. Correr `node --test tests/metricas-reglas.test.js` → verde.
- [ ] **Step 6: `tests/reportes-pdf.test.js`, lo que el PDF no dice**: en `'el PDF no dibuja las cintas del recorrido típico…'`, sumar 'El recorrido típico' y 'En total, unos' a la lista. Correr `node --test tests/reportes-pdf.test.js` → verde.
- [ ] **Step 7: correr lo que no usa la base y que lee la cinta**: `node --test tests/metricas-cinta.test.js tests/metricas-reglas.test.js tests/reportes-pdf.test.js tests/metricas-huellas.test.js` → verde. (`tests/reportes-frontend.test.js` falla hasta la Tarea 2: es esperado.)
- [ ] **Step 8: commit**

```bash
git add services/metricasCinta.js tests/metricas-cinta.test.js tests/metricas-reglas.test.js tests/reportes-pdf.test.js
git commit -m "feat(metricas): el servidor arma el recorrido típico (línea a escala, total y aviso por fuera)"
```

### Tarea 2: la página dibuja el recorrido típico (Sonnet, esfuerzo alto: imprime lo del servidor, con la maqueta como referencia; revisión con Opus)

**Files:**
- Modify: `public/js/reportes.js` (constantes de la cinta `:71-82`, `htmlDeAclaraciones` `:369-376`, la cinta `:378-480`, `dibujarElCircuito` `:1665-1675`)
- Modify: `public/reportes.html` (CSS de la cinta `:174-211`, el bloque `@media (forced-colors: active)` `:158`, el HTML `:579-590`, la versión `:740`)
- Modify: `public/configuracion.html:828` (solo la versión de `feriados.js`)
- Modify: `tests/reportes-frontend.test.js` (`:96-97`, `:651-674`, `:1182-1263`, `:1680-1690`, `:1717-1735`, `:2358-2370`, `:2551-2560`, `:2604-2624`)
- Modify: `tests/paginas.test.js:41` y `:89` (las versiones; el comentario de `:83-88` suma esta entrega)

**Interfaces:**
- Consumes: el objeto de `cintaDeMetricas` de la Tarea 1 (sus claves exactas están en su bloque Produces) y `FORMA_DE_LA_CINTA` = 'recorrido'.
- Produces: `function htmlDeCinta(cinta)` → string (pura; '' sin cinta o si `cinta.forma !== 'recorrido'`).

- [ ] **Step 1: los tests de la página** en `tests/reportes-frontend.test.js`:
  - `CINTA_INTERNA` y `CINTA_EXTERNA` (`:96-97`) siguen armándose con `cintaDeMetricas`, con cifras inventadas que no sean de producción, y ahora con `dias: 'corridos'` y hábiles en los tramos.
  - Reemplazar el `describe('reportes.js: la cinta')` por uno con:
    - `'htmlDeCinta imprime lo que manda el servidor'`: para las dos cintas, el HTML tiene `<h3 class="mt-rec-titulo">El recorrido típico</h3>`, la bajada, `role="img" aria-label="${descripcion escapada}"`, el total con `<b>${cifra}</b>`, cada parte con `style="width:${coord(ancho)}%"`, su clase de actor, su `grande`, su `nombre` y sus `dias`; la carga y el Portal; el vencimiento con `style="left:${coord(x)}%"`; la regla del aviso con `style="width:${coord(aviso.ancho)}%"`, `rotulo`, `texto` y 'vencimiento'; y la lista con un `<li>` por renglón.
    - `'sin regla: el aviso en un renglón'`: con `aviso.ancho` null no hay regla ni vencimiento y el renglón dice `${rotulo} ${texto}`; con `sigue`, la regla termina en flecha y no dice 'vencimiento'.
    - `'la lista también en la computadora con un tramo angosto'`: con `lista_siempre`, la lista lleva la clase `siempre`; una parte `angosta` lleva la clase `angosta`.
    - `'sin cinta o con la forma de antes, nada'`: `htmlDeCinta(null)`, `({})` y `({ ancho: 1000, alto: 156, segmentos: [] })` dan ''.
  - En `:1680-1690` (lo malo se escapa): `htmlDeCinta` con un texto malo en `titulo`, `bajada`, `grande`, `nombre`, `dias`, `aviso.texto`, `lista[].texto` y `descripcion`, y un `actor` '"><x' → nada sin escapar y el actor cae a `gris`.
  - En `:1717-1735` (ceros y nada de `NaN`): una cinta con `ancho: 0`, `vencimiento: { x: 0 }` y `aviso.ancho: 0` escribe `width:0%`/`left:0%`; ninguna cinta escribe 'NaN', 'undefined' ni 'null'.
  - `:651-674`: borrar los tests de `htmlDeAclaraciones`.
  - `:2358-2370` (los lugares que llena reportes.js): sacar 'mt-leyenda' y 'mt-aclaraciones' de la lista de ids; en `reportes.html`, `id="mt-cinta"` va antes de `id="mt-aclaracion-cinta"` y los dos antes de `class="mt-casos-cab"`; el `<p class="mt-pie">Con «Mediana»…</p>` ya no está en la página.
  - `:2551-2560`: el pie de la mediana sigue en `TEXTOS_DE_LA_PESTANA.pieDelCircuito` (el PDF), pero `reportes.html` no lo incluye.
  - `:2604-2624`: borrar «la leyenda de la cinta».
  - Correr `node --test tests/reportes-frontend.test.js` → fallan los nuevos.
- [ ] **Step 2: `public/js/reportes.js`**:
  - `htmlDeCinta(cinta)` con la estructura de la maqueta aprobada (`htmlLinea` de `maqueta.js`), con estas clases: `mt-rec` (contenedor), `mt-rec-titulo` (`<h3>`), `mt-rec-bajada`, `mt-rec-dibujo` (`role="img"` y `aria-label`), `mt-rec-total`, `mt-rec-fila`, `mt-rec-escala`, `mt-rec-parte` + actor (`dgmit`, `area`, `ddpc`, `gris`) + `angosta`, `mt-rec-grande`, `mt-rec-nombre`, `mt-rec-dias`, `mt-rec-pista`, `mt-rec-hito`, `mt-rec-fin`, `mt-rec-meta`, `mt-rec-portal`, `mt-rec-vence`, `mt-rec-aviso` (+ `sigue`), `mt-rec-rombo`, `mt-rec-riel`, `mt-rec-tope`, `mt-rec-flechita`, `mt-rec-aviso-solo`, `mt-rec-orientativo`, `mt-rec-lista` (+ `siempre`). Ninguna clase empieza con `ad-`.
  - `const ACTORES = ['gris', 'dgmit', 'area', 'ddpc']` y `elegidoDe(actor, ACTORES)` (el primero, 'gris', para lo desconocido).
  - Borrar `ANCLAJES`, `COLORES`, `TIPOS_DE_MARCA`, `NOMBRES_DE_LOS_HITOS`, `LEYENDA_DE_LA_CINTA`, `LEYENDA_FIJA`, `nombreDeLaMarca`, `iconoDeLaMarca`, `rectangulo`, `svgDeCinta`, `htmlDeLeyendaDeCinta` y `htmlDeAclaraciones`, después de confirmar con `grep` que nadie más los usa (`elegidoDe` queda).
  - `dibujarElCircuito`: `porId('mt-cinta').innerHTML = htmlDeCinta(cinta)`; `hidden` si da ''; `#mt-aclaracion-cinta` con `cinta.aclaracion` (o ''); sin las líneas de `mt-leyenda` ni `mt-aclaraciones`.
  - Los comentarios de cabecera que nombran `svgDeCinta` pasan a `htmlDeCinta`.
- [ ] **Step 3: `public/reportes.html`**:
  - HTML: sacar `#mt-leyenda`, `#mt-aclaraciones` y el `<p class="mt-pie">Con «Mediana»…</p>`; `<div id="mt-cinta" hidden></div>` y `<p class="mt-pie" id="mt-aclaracion-cinta"></p>` van justo antes de `<div class="mt-casos-cab">`, sin `tabindex`, `role` ni `aria-label`, con un comentario que diga que es la sección «El recorrido típico» (spec 2026-11-08-metricas-recorrido-tipico).
  - CSS: borrar `.mt-cinta-marco`, `.mt-cinta-svg …`, `.mt-leyenda …`, `.mk …` y `.mk-*`; sumar las reglas `.mt-rec-*` pasadas de la maqueta (`.cz-seccion`, `.cz-cota`, `.cz-l-*`, `.cz-aviso*`, `.cz-lista`, `.cz-orientativo`, los `@media (max-width: 700px)`), con los tokens `--sg-violeta`, `--sg-del-area`, `--sg-tinta`, `--sg-verde`, `--sg-suave`, `--sg-linea`, `--sg-texto`, `--f-titulo`, `--f-texto`.
  - La pista y los hitos con bordes (`border-top` de 10 px, no `background`), y `-webkit-print-color-adjust: exact; print-color-adjust: exact`.
  - El gris punteado con `border-top: 10px dashed`.
  - La lista se ve hasta 700 px y, con `.siempre`, en todos los anchos; una `.angosta` muestra solo `.mt-rec-grande`.
  - Alto contraste: las reglas de la sección nueva dentro del primer bloque `@media (forced-colors: active)` (el de `:158`), después de las de la banda (`tests/paginas.test.js` lee solo ese bloque): `.mt-rec-meta { forced-color-adjust: none; }`.
  - `js/reportes.js?v=20261215`.
- [ ] **Step 4: versiones**: `public/configuracion.html:828` → `js/feriados.js?v=20261216`; `tests/paginas.test.js`: `VERSION_FERIADOS = '20261216'`, `VERSION_REPORTES = '20261215'` y una línea en el comentario de `:83-88` («después, el recorrido típico (spec 2026-11-08-metricas-recorrido-tipico)»).
- [ ] **Step 5: correr**: `node --test tests/reportes-frontend.test.js tests/paginas.test.js tests/publico.test.js` → verde.
- [ ] **Step 6: mirarla**: servir `public/` con la maqueta de datos (`~/rpad-notas/metricas-cinta/`: copiar el `public/` de la rama a `pagina-rama/public/`, con `datos-maqueta/` y un `maqueta.js` que solo haga el `fetch` falso y el token, sin dibujar nada propio) y comparar con la opción «A2» de la maqueta aprobada a 1280 px y a 375 px, externa e interna, mediana y promedio. Nada de eso va al repo.
- [ ] **Step 7: commit**

```bash
git add public/js/reportes.js public/reportes.html public/configuracion.html tests/reportes-frontend.test.js tests/paginas.test.js
git commit -m "feat(metricas): la página dibuja el recorrido típico y deja sin el recuadro de aclaraciones y el pie de la mediana"
```

### Tarea 3: la documentación (Sonnet, esfuerzo alto)

**Files:**
- Modify: `docs/temas/metricas-y-reportes.md` (`:20`, `:112`, `:114-126`, `:220`, `:240`, `:275-279`)
- Modify: `README.md:191` y `:301` si nombran la cinta de Métricas

**Interfaces:**
- Consumes: lo que hicieron las Tareas 1 y 2 (leer el diff de la rama).

- [ ] **Step 1: `docs/temas/metricas-y-reportes.md`**: reescribir «La cinta» como «El recorrido típico» con lo vigente (spec, secciones 2 a 5): qué dibuja, los colores por actor, el total como suma, los porcentajes solo en la externa, el aviso por fuera, los casos borde, la forma del objeto en una línea, que solo la dibuja la página en HTML y CSS, que la foto la guarda y que una cinta sin `forma: 'recorrido'` no se dibuja; y las decisiones con su motivo (decisiones del usuario del 08/11/2026: la línea con hitos, la suma de medianas en lugar de la mediana de los ciclos completos, sin el recuadro «i» ni el pie de la mediana en la página pero sí en el PDF).
  En «La página: reportes.js», `htmlDeCinta` en lugar de `svgDeCinta`, y sin `htmlDeAclaraciones`.
  Sin «pasó a», sin historia; un renglón por oración.
- [ ] **Step 2: correr** `node --test tests/documentos.test.js` → verde (el documento queda por debajo de 60 KB).
- [ ] **Step 3: `README.md`**: «con la cinta del "recorrido típico"» → «con el recorrido típico (cuánto lleva un pedido y cómo se reparte entre quienes actúan)», y la línea de `services/metricas*.js`, si hace falta.
- [ ] **Step 4: commit**

```bash
git add docs/temas/metricas-y-reportes.md README.md
git commit -m "docs(metricas): el recorrido típico en lugar de la cinta"
```

### Después de las tareas (lo hace la sesión, no un subagente)

- Pedir el «CONTENEDOR LIBRE» a la coordinadora y correr `npm test` completo (main da 8612 tests): 0 fallas.
- Revisión final de toda la rama con Opus (esfuerzo extra), contra la spec y este plan; arreglos con Opus y re-revisión.
- Verificación con la copia del 07/11 (fuera del repo): la rama da las mismas cifras que la maqueta aprobada, en la computadora y en el teléfono.
- Merge en main (squash) y push; kit `~/rpad-kits/RPAD-deploy-metricas-cinta/` contra `e1640da`, con `PASOS.txt` (comprobación previa con GET de `reportes.js?v=20261214`, `feriados.js?v=20261215` y `usuarios.js?v=20261228`), verificación byte por byte y vuelta atrás; aviso TODO EN VERDE.
