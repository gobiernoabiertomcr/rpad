# Métricas: la frase en «Los casos» — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que cada número de «Los casos» diga su unidad y desde cuándo cuenta, sin mover ninguna cifra.

**Architecture:** solo textos. `filaDe` (`services/metricasReglas.js`) arma las frases; la página y el PDF las imprimen tal cual. Se saca la oración del pie, que ya no hace falta, y la tabla del PDF con los destildados suma las líneas que necesita.

**Tech Stack:** Node 22, vanilla JS, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-05-metricas-frase-en-los-casos-design.md`. Los textos, los de la spec, al pie de la letra.

## Global Constraints

- **No se escribe código hasta que la coordinadora dé el turno.** Al recibirlo, traer `main` con `sync_with_base_branch`; si trajo una migración, correrla en la base local antes de la suite. Los números de línea de este plan son los de `b58cc38`.
- **Ninguna cifra cambia.** Si un test de una cifra (`cifra.valor`, `valor`, `n`, `en_curso.texto`, `despues`, `etapas`) falla, el error es del cambio: frenar y mirar. Solo se tocan aserciones de los textos de la fila (`aviso.texto`, `nota.texto`, `recibido.texto`, `carga.texto`).
- **No tocar:** `medir`, `hechosDe`, `inicioTramos`, `heredado`, `duracion`, `cifraDe`, `etapasDe`, `seguimientoReglas.js`, `metricasFoto.js`, `VERSION_DE_LA_FOTO`. Tampoco los otros hallazgos del escaneo: decisión del usuario.
- `VERSION_REPORTES` y `public/reportes.html` pasan a `20261209`. `VERSION_FERIADOS` (`20261210`) sigue siendo mayor.
- Lenguaje neutro: nunca «tardanza», «demora», «atraso», «sin respuesta», «sin entregar» ni «no mandó».
- Datos inventados en tests, docs y ejemplos. Ningún email real. Nunca `docker compose` desde un worktree, ni `down -v`, ni `pkill -f`, ni `killall` con patrón.
- La base `datospublicos_mcr_rpad` es de solo lectura.
- `npm test` completo antes y después de cada tarea, una sola suite a la vez; el `.env` copiado del checkout principal, sin mostrarlo.
- Commit y push de la rama después de cada tarea. Comentarios y nombres en español.

## Archivos

- `services/metricasReglas.js`: `filaDe`, sus ayudantes y el comentario de la forma de `casos`.
- `services/reportesPdfBase.js`: la opción `lineas` de `prepararTabla`.
- `services/reportesMetricasPdf.js`: `elementosDeLosDestildados`, sin `textoDelPieDeLosCasos` y sin el parámetro `dias`.
- `public/js/reportes.js`: `htmlDeCasos`, sin `NOMBRE_DE_LOS_DIAS`, que deja de usarse.
- `public/reportes.html`: el `?v=` de `reportes.js`.
- `tests/metricas-reglas.test.js`, `tests/metricas-foto.test.js`, `tests/reportes-frontend.test.js`, `tests/reportes-pdf.test.js`, `tests/paginas.test.js`.
- `docs/temas/metricas-y-reportes.md`.

---

## Tarea 1: las frases, en el servidor y en el PDF

Van juntas: `filaDe` cambia la hoja de los destildados, así que el test «el PDF de Métricas y el Informe anual no cambian» recién vuelve a pasar con la referencia retomada, y la suite queda verde al final de la tarea.

- [ ] **Paso 1: correr la suite completa y guardar las cifras de partida.**

```bash
npm test 2>&1 | tail -15
```

Un script en el scratchpad, con el worktree como directorio actual y solo lectura, guarda en un JSON el resultado de `metricasDe({ anio: '2026', estadistico, dias }, { hoy: '2026-11-05' })` en las cuatro combinaciones de mediana o promedio y hábiles o corridos.

- [ ] **Paso 2: escribir los tests que fallan,** en un `describe` nuevo de `tests/metricas-reglas.test.js`, con casos sintéticos, usando los ayudantes del archivo (`vista`, `caso`, `cerrado`, `notaDe`). Cubren cada fila de la tabla de la sección 4 de la spec, en corridos y en hábiles:

```js
describe('«Los casos»: cada número dice su unidad y desde cuándo cuenta (spec 2026-11-05-metricas-frase-en-los-casos)', () => {
  // - aviso.texto: `${n} días corridos antes del vencimiento` y, con 1 día, `1 día hábil antes del vencimiento`
  // - nota.texto: `${n} días corridos desde el aviso`
  // - recibido.texto interno: `${n} días corridos desde el aviso`
  // - recibido.texto externo con nota: `${n} días corridos desde la nota`
  // - recibido.texto abierto: `en curso, ${n} días corridos desde la nota` y `en curso, ${n} días corridos desde el aviso`
  // - carga.texto: `${n} días corridos desde que se recibió`, también con el origen sin dato y en la interna, y, con fuente
  //   pública, `${n} días corridos desde que se obtuvo`
  // - el 0 sigue siendo `en el día`; un abierto sin días, `en curso`; las filas de la tabla con «igual», como hoy
  // - un heredado dice `desde el aviso`, con el valor de `duracion(inicio_tramos, recibido)`
});
```

Cada `n` se calcula con `duracion`, no se copia a mano. El `d(...)` de la línea 1323 es local a su `it`: el `describe` nuevo no lo ve.

- [ ] **Paso 3: correrlos y ver que fallan.**

```bash
node --test --test-name-pattern='cada número dice su unidad' tests/metricas-reglas.test.js
```

- [ ] **Paso 4: implementar en `services/metricasReglas.js`,** reemplazando `textoDeDias` y los textos de `filaDe`. Este es el `textoDeDias` de este archivo: el de `miEspacioNota.js` es otro y no se toca.

```js
// Una cantidad de días con su unidad: «308 días corridos», «1 día hábil»
const cantidadDeDias = (valor, dias) => `${valor} ${unidadDe(valor, dias)}`;

// Lo que va debajo de una fecha de la lista de casos: los días con su unidad y desde cuándo cuentan
// (spec 2026-11-05-metricas-frase-en-los-casos, 4). 0 es «en el día»; sin días, nada
const textoDeDias = (valor, dias, desde) => {
  if (valor === null) return '';
  return valor === 0 ? 'en el día' : `${cantidadDeDias(valor, dias)} ${desde}`;
};

const DESDE_EL_AVISO = 'desde el aviso';
const DESDE_LA_NOTA = 'desde la nota';
```

Y en `filaDe`, solo estos textos:

```js
// aviso, el avisado a tiempo
textoDelAviso = antes === null ? '' : antes === 0 ? 'el día del vencimiento' : `${cantidadDeDias(antes, ctx.dias)} antes del vencimiento`;

// nota
texto: h.inicioTramos === null ? '' : textoDeDias(dias(h.inicioTramos, h.nota.recibida), ctx.dias, DESDE_EL_AVISO)

// recibido, con datos
if (h.aplicaNota && h.nota !== null && h.origen !== 'fuente_publica') textoDeRecibido = textoDeDias(dias(h.nota.recibida, h.recibido), ctx.dias, DESDE_LA_NOTA);
else if (!h.externa && h.inicioTramos !== null) textoDeRecibido = textoDeDias(dias(h.inicioTramos, h.recibido), ctx.dias, DESDE_EL_AVISO);

// recibido, abierto: `duracion` con `desde` null da null
const conNota = h.externa && h.nota !== null;
const hace = dias(conNota ? h.nota.recibida : h.inicioTramos, ctx.al);
textoDeRecibido = hace === null || hace === 0 ? 'en curso' : `en curso, ${cantidadDeDias(hace, ctx.dias)} ${conNota ? DESDE_LA_NOTA : DESDE_EL_AVISO}`;

// carga
texto: h.carga !== null && h.recibido !== null
  ? textoDeDias(dias(h.recibido, h.carga), ctx.dias, h.origen === 'fuente_publica' ? 'desde que se obtuvo' : 'desde que se recibió')
  : ''
```

Actualizar el comentario de la forma de `casos` (líneas 800-802): `'27 días hábiles antes del vencimiento'` y `'en curso, 89 días hábiles desde el aviso'`.

- [ ] **Paso 5: correr los tests nuevos y ver que pasan.**

- [ ] **Paso 6: actualizar las aserciones de texto que dejan de valer:**
  - `tests/metricas-reglas.test.js`: 969 y 970 (`'40 antes'`, `'27 antes'`), 1050 (`en curso, hace`), 1326 (`${d(...)} antes`), 1332 y 1335 (`en curso, hace`), 1340, 1341, 1346 y 1347 (`texto: d(...)`).
  - `tests/metricas-foto.test.js`: 316 (`texto: '1'` pasa a `1 día hábil desde que se recibió`) y 329 (`en curso, hace`).

Las aserciones sobre `en_curso.texto` **no cambian** y siguen pasando: `hace 206 días hábiles (mediana)`, en `tests/metricas-reglas.test.js`, `tests/reportes-frontend.test.js` y `tests/reportes-pdf.test.js`.

- [ ] **Paso 7: escribir los tests del PDF que fallan,** en `tests/reportes-pdf.test.js`:
  - El PDF con destildados imprime las frases y no dice «Debajo de cada fecha». Las frases se parten en varias líneas: unir el texto con `join(' ')` antes de buscar.
  - Una fila armada a mano, con lo más largo de cada celda (vencimiento y aviso con «avisado ya vencido» y «email mensual de vencidos»; nota «Reiteración» con tres cifras; recibido con tres cifras y «Los entregó el área»; carga con tres cifras y «desde que se recibió»): ninguna línea termina en «…». `verificarDiagramacion` sola no lo ve.
  - `prepararTabla` sin `lineas` sigue cortando a 4 líneas.

- [ ] **Paso 8: implementar el PDF:**
  - `services/reportesPdfBase.js`: `prepararTabla(doc, { columnas, filas, estados = [], cabeza = null, aclaracion = null, lineas = LINEAS_POR_CELDA })`, y `celdaDeTexto` de las filas usa `lineas`. El encabezado sigue con `LINEAS_DEL_ENCABEZADO`, y el comentario de la función lo dice.
  - `services/reportesMetricasPdf.js`:
    - Borrar `textoDelPieDeLosCasos` y su comentario, y sacarlo de la lista del comentario de `TEXTOS_DE_LA_PESTANA`.
    - `elementosDeLosDestildados(doc, vista)`, sin `dias`, pasa `lineas` y devuelve solo `[[prepararSeccion(…), tabla]]`. El valor es el menor con el que el test de la fila más larga pasa, en una constante con su motivo.
    - Ajustar la llamada de `renderMetricasDelAnio` (línea 963). `dias` sigue en uso ahí.
  - `tests/reportes-frontend.test.js`: sacar el import de `textoDelPieDeLosCasos` (línea 19) y el `for` que lo usa (línea 1737). `htmlDeCasos` sigue diciendo la oración hasta la Tarea 2, y la línea 549 todavía pasa.

- [ ] **Paso 9: mirar la tabla.** Generar a un archivo del scratchpad el PDF de «Métricas: con una nota DGMIT, promedio en días corridos y dos destildados» y el de la fila más larga, y leerlos con la herramienta de PDF. Se pueden ajustar los `ancho` de `columnas`, sin otro cambio.

- [ ] **Paso 10: volver a tomar la referencia.** Solo la entrada «Métricas: con una nota DGMIT, promedio en días corridos y dos destildados» de `REFERENCIA_DE_LOS_PDF`, y solo su hoja de los destildados. Antes, comparar el texto hoja por hoja contra el código anterior: solo pueden cambiar las filas de los destildados y el párrafo del pie. Sumar un comentario que diga por qué se tomó, como los anteriores. Si cambia otra entrada u otra hoja, frenar: algo se tocó de más.

- [ ] **Paso 11: comprobar que ninguna cifra se movió,** contra el JSON del Paso 1, con la base local, de solo lectura y en las cuatro combinaciones: todo lo que manda `metricasDe` (`vista.circuito`, `vista.resultados`, `vista.para_completar`, `cinta`, `contexto`, `trabajo` y `areas`) es igual, y en `vista.casos` solo difieren `aviso.texto`, `nota.texto`, `recibido.texto` y `carga.texto`.

- [ ] **Paso 12: suite completa y commit.**

```bash
git add services/metricasReglas.js services/reportesPdfBase.js services/reportesMetricasPdf.js tests/metricas-reglas.test.js tests/metricas-foto.test.js tests/reportes-pdf.test.js tests/reportes-frontend.test.js
git commit -m "feat(metricas): cada número de los casos dice su unidad y desde cuándo cuenta"
git push
```

---

## Tarea 2: la página

- [ ] **Paso 1: cambiar los tests.** En `tests/reportes-frontend.test.js`:
  - «la aclaración de los casos dice los días elegidos y, con foto, que no se destilda» pasa a «el pie de los casos dice lo de destildar y, con foto, que no se destilda», y comprueba que no diga «Debajo de cada fecha» (líneas 547-553).
  - El ejemplo de `htmlDeCasos` (líneas 528-537) usa textos de la frase: `40 días corridos antes del vencimiento` (aviso del 21/06, vencimiento del 31/07), `3 días corridos desde el aviso` y `1 día corrido desde que se recibió`.

- [ ] **Paso 2: correrlos y ver que fallan.**

```bash
node --test tests/reportes-frontend.test.js
```

- [ ] **Paso 3: implementar en `public/js/reportes.js`.** En `htmlDeCasos`, el pie queda solo con `destildar`:

```js
+ `<p class="mt-pie">${destildar}</p>`;
```

Borrar `NOMBRE_DE_LOS_DIAS` (línea 49), que no se usa en ningún otro lado. El comentario de `htmlDeCasos` (líneas 491-492) deja de decir «con los días elegidos». `e` sigue en uso por `g`.

- [ ] **Paso 4: subir la versión.** `public/reportes.html`: `js/reportes.js?v=20261209`. `tests/paginas.test.js`: `VERSION_REPORTES = '20261209'`, con su comentario, que avisa que el próximo cambio de `reportes.js` también tiene que subir `VERSION_FERIADOS`.

- [ ] **Paso 5: correr `tests/reportes-frontend.test.js` y `tests/paginas.test.js`, después la suite completa, y commit.**

```bash
git add public/js/reportes.js public/reportes.html tests/reportes-frontend.test.js tests/paginas.test.js
git commit -m "feat(metricas): el pie de los casos, sin la oración que ya dice cada fila"
git push
```

---

## Tarea 3: documentación y comprobación final

- [ ] **Paso 1: `docs/temas/metricas-y-reportes.md`.** Sumar la spec a la lista de arriba y, después de la línea 42, adentro de la misma viñeta, con dos espacios y un renglón por oración:

```text
  Cada número de «Los casos» dice su unidad y desde cuándo cuenta («308 días corridos desde el aviso», «45 días corridos desde la nota», «3 días corridos desde que se recibió», «en curso, 20 días corridos desde la nota»; lo arma `filaDe`).
  Un ciclo `heredado` (sin aviso de la regla, que el RPAD no pudo avisar a tiempo y cuyo primer aviso llegó después del vencimiento) cuenta desde ese primer aviso, no desde el vencimiento (decisión del usuario del 05/11/2026): contarlo desde el vencimiento le atribuiría a la DGMIT y a la DIT días anteriores a todo aviso, incluso de antes del alta.
  Por eso un número de Métricas puede ser menor que los días del Seguimiento para el mismo ciclo: el Seguimiento mide del vencimiento a la carga o, en un ciclo abierto, a hoy, y esa medida en Métricas es la mediana o el promedio de «Actualizados a tiempo».
```

Sin `CLAUDE.md` ni `.claude/rules/`: no nace un tema ni cambia una regla transversal.

- [ ] **Paso 2: ver la página.** Reiniciar la maqueta guardada en `~/rpad-notas/metricas-dias-del-ano/maqueta/servidor.mjs`, que importa el código al arrancar, y elegir «Como está hoy», que muestra el código real sin transformar nada: interna y externa, corridos y hábiles, en 1280 px y en teléfono. La lista se lee y la página no se desborda.

- [ ] **Paso 3: buscar lo prohibido** en el diff: nombres reales (`~/rpad-notas/palabras.txt`), datos de producción y las palabras del lenguaje neutro.

- [ ] **Paso 4: `npm test` completo.** Commit y push. Con todo en verde, revisión final de un agente sin contexto; con ella limpia, `TODO EN VERDE` a la coordinadora, merge y push de `main` según su turno, y el kit, sin SQL, para que esté en producción antes del 10/01/2027.
