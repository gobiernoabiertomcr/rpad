# El PDF de Métricas y el Informe anual, apaisados — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el PDF «Métricas del año» y el Informe anual vayan en A4 apaisado, con la distribución y la diferencia entre gestiones que eligió el usuario, sin mover ninguna cifra y sin tocar la página.

**Architecture:** un documento tiene una sola hoja, que se elige al crearlo, y la base la lee del documento, con la vertical de entrada: los demás PDF no cambian ni un byte. `reportesMetricasPdf.js` dibuja siempre apaisado y le presta sus hojas al Informe anual. Los dos PDF suman, desde el servidor, el circuito en días corridos.

**Tech Stack:** Node 22, PDFKit, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-05-metricas-pdf-apaisado-design.md` (aprobada el 05/11/2026; el usuario aprobó este plan el 05/11/2026).

**Maquetas:** `~/rpad-notas/metricas-pdf-apaisado/` (`LEEME.md`, `pdf/`, `laminas/`, `prototipo/`), fuera del repo porque traen datos del dump.
`prototipo/` muestra cómo se armó cada medida, pero es una maqueta con variables de entorno: no se copia.
`comparar/` trae el gancho que hashea cada PDF de una corrida de tests, `diff-pdf.mjs` y `simulaciones.mjs`.

## Global Constraints

- **No se escribe código hasta que la coordinadora dé el turno.** Al recibirlo, traer `main` con `sync_with_base_branch`; si cambió alguno de los archivos de abajo, ajustar el plan antes de seguir.
- **Solo el PDF.** No se tocan `public/reportes.html`, `public/js/reportes.js` ni ningún archivo de `public/`, tampoco `?v=`, `VERSION_REPORTES` ni `VERSION_FERIADOS`. «Unas 5 hojas» se queda.
- **Ninguna cifra ni texto armado por el servidor cambia.** No se tocan `services/metricasReglas.js`, `metricasFoto.js`, `seguimientoReglas.js` ni `reportesCicloDeVidaPdf.js`. De `metricasCinta.js`, solo el comentario de las líneas 180-181, que va en el kit. `VERSION_DE_LA_FOTO` sigue en 1.
- **Los otros PDF, ni un byte salvo la fecha:** Ciclo de vida, Estado general, Por área, Avisos, Agenda, Datos para completar, la hoja del Seguimiento y los anexos. Lo nuevo de `notasDigitalesAnexo.js`, `seguimientoPdf.js` y `reportesPdfBase.js` es opcional y vertical de entrada.
- **`GET /api/metricas` no cambia:** `circuito_en_corridos` es solo de los PDF.
- Una sola lectura de la tabla de feriados por pedido: los días corridos no vuelven a leer la base.
- Lenguaje neutro: nunca «tardanza», «demora», «atraso», «sin respuesta», «sin entregar» ni «no mandó». El color nunca es lo único que distingue.
- Datos inventados en tests, docs y ejemplos. Ningún número real en el repo. Ningún email real. Nunca `docker compose` desde un worktree, ni `down -v`, ni `pkill -f`, ni `killall` con patrón.
- La base `datospublicos_mcr_rpad` es de solo lectura.
- `npm test` completo antes y después de cada tarea, una sola suite a la vez; el `.env` copiado del checkout principal, sin mostrarlo.
- Commit y push de la rama después de cada tarea. Comentarios y nombres en español.
- `REFERENCIA_DE_LOS_PDF` se retoma en cada tarea que cambia un PDF: `node --test --test-name-pattern="no cambian" tests/reportes-pdf.test.js` imprime el JSON en el mensaje del test. Se suma un párrafo al comentario de arriba de la referencia, como los anteriores.
- Las líneas de los tests son las de `a269509`: si se movieron, se buscan por lo que dicen.

## Archivos

- `services/notasDigitalesAnexo.js`: `HOJA_VERTICAL` y `HOJA_APAISADA`.
- `services/seguimientoPdf.js`: los parámetros del encabezado, el pie y la cabeza de sección.
- `services/reportesPdfBase.js`: la hoja del documento y `nuevoFlujo`.
- `services/reportesMetricasPdf.js`: las hojas.
- `services/reportesInformeAnualPdf.js`: el Informe.
- `services/metricasCinta.js`: solo un comentario.
- `controllers/metricasController.js` y `controllers/reportesController.js`: `circuito_en_corridos`.
- `tests/pdf-diagramacion.js`, `tests/pdf-lector.js`, `tests/reportes-pdf.test.js`, `tests/metricas-api.test.js`, `tests/metricas-cinta.test.js`, `tests/reportes-frontend.test.js`.
- `docs/temas/metricas-y-reportes.md`, `docs/temas/ciclo-de-vida.md`, `README.md`.

## Clasificación de las tareas

Todas con Opus: PDF está en la lista fija.

| Tarea | Dificultad | Motivo |
|---|---|---|
| 1. La base | difícil | La comparten nueve PDF y los anexos de las notas |
| 2. Sin las cintas | media | Borrar, con la página intacta; todavía en vertical |
| 3. Los dos PDF, apaisados | difícil | Cambia la referencia y todos los tests de hojas |
| 4. Hojas 1 y 2 | difícil | El dibujo aprobado, con sus escalones y su peor caso |
| 5. Los días corridos | difícil | Toca los controladores; no puede volver a leer la base |
| 6. Hoja 3 | media | Dos columnas |
| 7. Hojas 4 y 5 | media | El flujo, y el Informe suma las áreas |
| 8. La última parte del Informe | difícil | Logros que cortan de columna y de hoja |
| 9. Comparación, documentos y cierre | difícil | Es la prueba de que nada más cambió |

---

## Tarea 1: la base

**Files:** `services/notasDigitalesAnexo.js`, `services/seguimientoPdf.js`, `services/reportesPdfBase.js`, `tests/pdf-diagramacion.js`, `tests/pdf-lector.js`, `tests/reportes-pdf.test.js`.

**Criterio:** ningún PDF cambia. `REFERENCIA_DE_LOS_PDF` no se toca en esta tarea.

- [ ] **Paso 1: la suite en verde, y el «antes».**
  `npm test`.
  Con `comparar/hook.mjs` y `comparar/correr.sh`, guardar en `~/rpad-notas/metricas-pdf-apaisado/antes/` el hash de cada PDF de `reportes-pdf`, `seguimiento-pdf` y `notas-anexo` (son unos 650).
  Sobre la base local, con `prototipo/sacar-datos.mjs` y `prototipo/fotos-informe.mjs`, guardar lo que manda `metricasDe` en las cuatro combinaciones, las fotos simuladas y, en PDF, Métricas, Informe, Ciclo de vida, Estado general, Por área, Avisos, Agenda, Datos para completar, Seguimiento y un anexo de reiteración.

- [ ] **Paso 2: las hojas.** En `notasDigitalesAnexo.js`, después de `CONTENIDO`:

```js
// Las dos formas de la hoja A4, con las medidas de arriba (no las de doc.page, que redondea: cambiaría los bytes de los demás PDF)
const armarHoja = (ancho, alto) => Object.freeze({
  ancho, alto, izquierda: MARGEN, derecha: ancho - MARGEN, abajo: alto - MARGEN, contenido: ancho - 2 * MARGEN
});
export const HOJA_VERTICAL = armarHoja(ANCHO, ALTO);
export const HOJA_APAISADA = armarHoja(ALTO, ANCHO);
```

- [ ] **Paso 3: el encabezado, el pie y la cabeza de sección.** En `seguimientoPdf.js`, con lo vertical de entrada y las firmas de hoy:
  - `dibujarEncabezado(doc, hoy, derecha = 'Seguimiento del dataset', hoja = HOJA_VERTICAL)`, con `hoja.contenido` en vez de `CONTENIDO`.
  - `lineaDelPie(hoja)`, exportada, y `LINEA_DEL_PIE = lineaDelPie(HOJA_VERTICAL)`, que sigue exportada.
  - `dibujarPie(doc, generado, derecha, hoja = HOJA_VERTICAL)`.
  - `dibujarCabezaDeSeccion(doc, titulo, derecha, y, { x = IZQUIERDA, ancho = CONTENIDO } = {})`.

- [ ] **Paso 4: la base.** En `reportesPdfBase.js`:
  - `nuevoReporte({ titulo, hoja = HOJA_VERTICAL })`: pasa a `DocumentoNota` `layout: hoja.ancho > hoja.alto ? 'landscape' : 'portrait'` y recuerda `marco: hoja` en `REPORTES`. Un `addPage()` sin opciones usa las del documento. La Tarea 1 comprueba que `layout: 'portrait'` no mueve un byte.
  - `export const hojaDe = (doc) => REPORTES.get(doc)?.marco ?? HOJA_VERTICAL`.
  - `export const limiteDe = (doc) => lineaDelPie(hojaDe(doc)) - SOBRE_PIE`.
  - `export const anchoDelRecuadro = (doc) => hojaDe(doc).contenido - RECUADRO.izquierda - RECUADRO.derecha`.
  - `LIMITE` y `ANCHO_DEL_RECUADRO` siguen exportados: los usan el Ciclo de vida y el Por área.
  - `agregarHoja`, `cerrarReporte`, `lugarPara`, `prepararTitulo`, `prepararPildora`, `prepararTarjetas`, `prepararSeccion`, `prepararParrafo`, `prepararRecuadro` y `prepararTabla` leen `hojaDe(doc)` y `limiteDe(doc)`.
  - `prepararPildora(doc, texto, { tono, anchoMaximo })`: sin `anchoMaximo`, exactamente lo de hoy, con `renglon`. Con él, topea el ancho de todo y corta con `ajustar` (1 línea) antes de escribir con `escribir`: `tests/pdf-diagramacion.js` mide entero un texto cortado por `renglon` (ver `docs/temas/ciclo-de-vida.md:84`).
  - `prepararSeccion(doc, { titulo, derecha, ancho })`: con `ancho`, su `dibujar(y, x)` la dibuja en esa columna; sin él, como hoy.

- [ ] **Paso 5: `nuevoFlujo`.** En `reportesPdfBase.js`. Primero sus tests (Paso 7), después esto:

```js
// Un flujo en dos columnas (spec 2026-11-05-metricas-pdf-apaisado, 7). Cada pieza ({ alto, dibujar(y, x) }, con su aire medido adentro) va
// debajo de la anterior; si no entra, sigue en la columna de la derecha y, después, en una hoja nueva con el encabezado de la última.
// cabeza(pieza): lo que va arriba de cada columna nueva (el encabezado de una tabla, el nombre de un proyecto); poner(pieza, { sinCabeza })
// primero elige el lugar, midiendo la cabeza y la pieza juntas, y recién ahí dibuja: una cabeza nunca queda sola. Una pieza que no entra en
// una columna vacía pasa a una hoja nueva si esa columna arrancó más abajo que una hoja recién agregada (debajo de un título)
export const nuevoFlujo = (doc, yInicial, { separacion = 20 } = {}) => {
  const reporte = REPORTES.get(doc);
  const { contenido, izquierda } = hojaDe(doc);
  const ancho = (contenido - separacion) / 2;
  let columna = 0;
  let tope = yInicial;
  let y = yInicial;
  let vacia = true;
  let laCabeza = null;
  const x = () => izquierda + columna * (ancho + separacion);
  const siguiente = () => {
    if (columna === 0) {
      columna = 1;
      y = tope;
    } else {
      tope = agregarHoja(doc, reporte.hoja);
      columna = 0;
      y = tope;
    }
    vacia = true;
  };
  return {
    ancho,
    cabeza: (pieza) => {
      laCabeza = pieza;
    },
    columna: () => columna,
    saltarColumna: siguiente,
    poner: (pieza, { sinCabeza = false } = {}) => {
      const necesita = () => (vacia && laCabeza && !sinCabeza ? laCabeza.alto : 0) + pieza.alto;
      const noEntra = () => y + necesita() > limiteDe(doc);
      if (noEntra() && !vacia) siguiente();
      while (noEntra() && tope > reporte.tope) siguiente();
      if (vacia && laCabeza && !sinCabeza) {
        laCabeza.dibujar(y, x());
        y += laCabeza.alto;
      }
      pieza.dibujar(y, x());
      y += pieza.alto;
      vacia = false;
    }
  };
};
```

  `reporte.tope` es la y de la última hoja agregada; una columna que arrancó debajo de un título tiene `tope` mayor.
  El `while` recorre la otra columna, que tiene el mismo `tope`, y termina en la hoja nueva, donde `tope === reporte.tope`.

- [ ] **Paso 6: los ayudantes de los tests.**
  - `tests/pdf-lector.js`: `export const HOJA_A4_APAISADA = { ancho: 841.89, alto: 595.28 }`.
  - `tests/pdf-diagramacion.js`: `diagramacion` guarda el tamaño de cada hoja (`this.page.width` y `this.page.height`, al indexarla) y devuelve `hojas`.
  - `verificarDiagramacion` controla cada elemento con los márgenes de su hoja: `x1 <= ancho - 15 mm`, `y1 <= alto - 15 mm`, y el límite de arriba y de la izquierda, de 15 mm.
  - Una hoja que no es A4 en ninguna de las dos formas falla.
  - Sin `hojas`, como vertical: `notas-anexo.test.js` y `seguimiento-pdf.test.js` no cambian.
  - El acento mira `x = 15 mm`: no cambia.

- [ ] **Paso 7: los tests**, en `tests/reportes-pdf.test.js`, un `describe('la hoja apaisada')`:
  - Un reporte con `hoja: HOJA_APAISADA`: `todasDelTamano(pdf, HOJA_A4_APAISADA)`, el pie adentro de la hoja, una tabla que corta de hoja y sigue apaisada, y `verificarDiagramacion`.
  - `verificarDiagramacion` falla si algo pasa de 282 mm en una apaisada, y si pasa de 195 mm en una vertical.
  - `nuevoFlujo`:
    - pasa a la derecha, después a otra hoja; la cabeza en cada columna nueva y también en la primera;
    - arrancando cerca del límite, una pieza que no entra con su cabeza no deja la cabeza sola;
    - con `sinCabeza`, la pieza no repite la cabeza;
    - una pieza más alta que lo que queda en una columna vacía debajo de un título pasa a una hoja nueva y no se sale, y el título no queda encimado;
    - `saltarColumna` va a la derecha o a una hoja nueva.
  - `prepararPildora` con `anchoMaximo` corta con «…», no pasa de ese ancho y `verificarDiagramacion` pasa con un texto cortado.
  - `prepararSeccion` con `ancho` y `x` no sale de su columna.

- [ ] **Paso 8: comprobar.** `npm test`, sin retomar la referencia.
  Con el gancho, comparar con el «antes»: 650 PDF iguales.

- [ ] **Paso 9: commit y push.** `feat(pdf): la base lee la hoja del documento y un flujo en dos columnas`.

---

## Tarea 2: sin las cintas

Va antes del apaisado: así se borra todavía en vertical, y no hay que recalcular la letra de la cinta para una hoja en la que ya no va a estar.

**Files:** `services/reportesMetricasPdf.js`, `services/metricasCinta.js`, `tests/reportes-pdf.test.js`, `tests/metricas-cinta.test.js`, `tests/reportes-frontend.test.js`.

- [ ] **Paso 1: la suite en verde.**

- [ ] **Paso 2: el test primero.** El PDF de Métricas no dice «El recorrido típico de un pedido», «RECORRIDO TÍPICO», «respecto del vencimiento» ni «La cinta pone las medianas»; lo que manda la API sigue trayendo `cinta`; `svgDeCinta` de la página sigue andando.

- [ ] **Paso 3: borrar de `reportesMetricasPdf.js`:**
  - `OPCIONES_CINTA_PDF`, `U`, `COLOR_DE_LA_CINTA`, `LEYENDA_DE_LA_CINTA`, `TIPOS_DE_MARCA`, `textoDeLaCinta`, `dibujarMarca`, `conX`, `dibujarLaCinta`, `piezaDeLeyenda`, `elementoDeLaCinta` y `T.leyenda`.
  - Los imports de `cintasDeLaVista`, `dibujarRayado` y `desdeBase`, si quedan sin uso.
  - La parte 2 de `renderMetricasDelAnio`. `elementosDeLosDestildados` se queda y pasa a ser los últimos grupos de la parte 1, debajo de «Cómo se cuenta»: sin destildados no agrega nada, y no queda una hoja con solo un título.
  - `contorno` y `KAPPA` se quedan: los usan las tarjetas y el Ciclo de vida.

- [ ] **Paso 4: los tests de las cintas.**
  - `reportes-pdf.test.js`: sacar «las cintas del PDF salen del circuito…» (765-780) y las líneas de la cinta en 678-686, 712-713, 757-758 y 833-834.
  - `reportes-frontend.test.js`: sacar «la leyenda de la cinta» de «los mismos textos»: los textos de la página ya no se comparan con nada. `htmlDeLeyendaDeCinta` sigue con sus otros tests.
  - `metricas-cinta.test.js`: `const OPCIONES_CINTA_PDF = { letra: 8 }` local, en vez del import, con un comentario: la opción `letra` de `metricasCinta.js` queda sin uso en producción y no se toca.
  - `metricasCinta.js:180-181`: corregir el comentario, que cita `OPCIONES_CINTA_PDF`. Es lo único que cambia en ese archivo, y va en el kit.

- [ ] **Paso 5: retomar la referencia**, `npm test`, commit y push. `feat(metricas): el PDF sin las cintas del recorrido típico`.

---

## Tarea 3: los dos PDF, apaisados

**Files:** `services/reportesMetricasPdf.js`, `services/reportesInformeAnualPdf.js`, `tests/reportes-pdf.test.js`, `tests/metricas-api.test.js`.

**Criterio:** los mismos dibujos, en la hoja nueva. Ninguna palabra cambia; pueden sumarse encabezados de tablas que cortan de hoja.

- [ ] **Paso 1: la suite en verde.**

- [ ] **Paso 2: la geometría de `reportesMetricasPdf.js`.**
  - `import { HOJA_APAISADA } ...`; `const HOJA = HOJA_APAISADA; const CONTENIDO = HOJA.contenido;` en vez de importar `CONTENIDO`.
  - `ANCHO_DEL_RECUADRO` local: la base exporta `anchoDelRecuadroEn(hoja)`, que usa también `anchoDelRecuadro(doc)`.
  - `ANCHO_COLUMNA` y lo que dependía de esos: se recalculan solos.
  - `renderMetricasDelAnio`: `nuevoReporte({ titulo, hoja: HOJA })`.

- [ ] **Paso 3: el Informe.** `renderInformeAnual`: `nuevoReporte({ titulo, hoja: HOJA_APAISADA })`. Sus `CONTENIDO` y `LIMITE`, `HOJA_APAISADA.contenido` y `limiteDe(doc)`.

- [ ] **Paso 4: los tests que dan por sentada la hoja.** Sin aflojar lo que controlan:
  - `reportes-pdf.test.js`: `todasDelTamano(pdf, HOJA_A4)` de Métricas y del Informe pasa a `HOJA_A4_APAISADA` (661, 1728, 1941).
  - `verificarDiagramacion` en las 11 variantes (871): sigue, ahora por hoja.
  - El control de las bandas: `x <= 282 * MM`, también sobre el Informe (2125-2129).
  - `metricas-api.test.js:230` y `:753`.
  - Lo que asume una hoja (671-675, 684-686, 712-713, 1730, 1738-1749, 1921): buscar por contenido o los índices nuevos.
  - `['Redacción y entrega de', 'nota']`: ahora entra en un renglón (2019, 2045, 2068, 2622-2634).
  - No se toca ninguna cifra ni texto esperado de otra forma: si falla uno, es un error del cambio.

- [ ] **Paso 5: retomar la referencia** y comprobar, con `lineasPorHoja`, que las palabras de los cinco PDF son las de antes, sin encabezado ni pie, salvo encabezados de tabla repetidos.

- [ ] **Paso 6: `npm test`, commit y push.** `feat(pdf): Métricas y el Informe anual, en A4 apaisado`.

---

## Tarea 4: hojas 1 y 2

**Files:** `services/reportesMetricasPdf.js`, `services/reportesInformeAnualPdf.js`, `tests/reportes-pdf.test.js`, `tests/metricas-api.test.js`.

**Interfaz:**
- `dibujarElCircuito(doc, hoja, datos, { anio, estadistico, dias, titulo })`: agrega la hoja, elige la letra y dibuja el título con la píldora y lo de dónde sale, y los recuadros.
- `dibujarLosResultados(doc, hoja, datos, { anio, dias, titulo, conDestildados })`: dibuja el título con la bajada, las tres columnas, «Cómo se cuenta» y, si corresponde, los destildados.
- `tituloConDerecha(doc, titulo, derecha)`, exportada: el elemento del título con lo que va arriba a la derecha. La usa también la Tarea 8.
- Las usan `renderMetricasDelAnio` y `renderInformeAnual`. `elementosDelCircuito` deja de exportarse y se va.

- [ ] **Paso 1: la suite en verde.**

- [ ] **Paso 2: los tests primero.**
  - La hoja 1 tiene `GESTIÓN EXTERNA`, `GESTIÓN INTERNA`, las dos frases y `Mediana en días hábiles` a la derecha; no tiene las aclaraciones ni «RESULTADOS DEL AÑO».
  - La píldora está arriba a la derecha, sin cruzar el rótulo, con 0, 1 y muchos destildados, también cortada.
  - Con foto y sin foto: `Sale de la foto…` o el aviso, a la derecha del título, sin sumarle alto a la hoja (la y del primer recuadro es la misma).
  - Las cuatro tarjetas de la externa miden lo mismo; las tres de la interna, lo mismo; el Portal no corta su texto, en las cuatro combinaciones.
  - La solapa externa es llena y la interna hueca: se comprueba el `scn` de `COLOR.tinta` en el contenido, y que ninguna usa un color de actor.
  - **Los escalones:** con los casos de los tests, la letra grande (se mira el tamaño de la cifra); con la respuesta del área con cifra, orientativa y con en curso, las dos gestiones siguen en la hoja 1, con una letra más chica; con lo más largo que no entra ni con la chica, la interna pasa a la hoja siguiente y nada se pisa.
  - La hoja 2 tiene «Resultados del año» como título, la bajada, «CÓMO SE CUENTA» y, adentro, cada aclaración del servidor, con `GESTIÓN EXTERNA` y `GESTIÓN INTERNA`.
  - Una gestión sin aclaraciones no lleva su nombre en «Cómo se cuenta»; sin ninguna, el recuadro queda como hoy.
  - Con `conFaltan(60)`: «y N más.» y nada se sale; con un título de 75 letras y el motivo más largo, el motivo no se corta.
  - Con `conFaltan(20)`: «Cómo se cuenta» va a la hoja siguiente, con el título de la hoja repetido arriba.
  - Los destildados van debajo de «Cómo se cuenta».
  - `verificarDiagramacion` en las variantes de hoy (línea 871) y en `conLoMasLargo` y `conLosPendientes`, también en las cuatro combinaciones.

- [ ] **Paso 3: la letra.**
  - `LETRAS_DEL_CIRCUITO`: los tres escalones de la spec, sección 5, de mayor a menor, con las claves `nodo, nodoRol, cifra, cifraMin, unidad, vacio, vacioMin, debajo, orientativo, nombre, chico, insignia`.
  - `LETRA`, lo demás: `aclaracion: 8.4, columna: 10, heroe: 26, heroeMin: 14, de: 9, texto: 8.4, mini: 8.4, barra: 8.4, pie: 7.4, indice: 7`, más `notaDeColumna: 7.6`, para las dos notas de las reiteraciones (hoy usan `chico`).
  - `BANDA.alto: 28`.
  - `bandaDe`, `etapaDe`, `piezaDeCifra` y `piezaDelCircuito` reciben `letra` y dejan de leer esas claves de `LETRA`.
  - `piezaDeLaGestion(doc, datos, gestion, letra)`: suma `datos`, que la Tarea 5 necesita.

- [ ] **Paso 4: las columnas.** `CIRCUITO_DE_LA_GESTION` deja `pesos`. En `piezaDelCircuito`:

```js
const anchoPortal = Math.max(
  doc.font(NEGRITA).fontSize(letra.nodo).widthOfString(NODOS.portal.nombre),
  doc.font(NORMAL).fontSize(letra.nodoRol).widthOfString(NODOS.portal.rol)
) + BANDA.punta + 2 * BANDA.relleno + 1.5;
const conEtapa = pasos.filter(([, clave]) => clave !== null).length;
const unidad = (ANCHO_DEL_RECUADRO - anchoPortal) / conEtapa;
```

- [ ] **Paso 5: la solapa y el panel.** `prepararGestion(doc, { gestion, combinacion, contenido })`, privada:
  - `FRASES_DE_LA_GESTION`, fuera de `T`, porque la página no las tiene.
  - La solapa: alto 17, ancho el del texto con 0,8 de espaciado más 20; el texto a 10 de su borde.
  - La frase, a 8 de la solapa, en 7,6 gris; la combinación, sobre el margen derecho, en 7,6 gris. No se cruzan con ningún texto armado: las dos son cortas.
  - El panel, con `roundedRect` para que `verificarDiagramacion` controle que nada cruza su borde: lleno en la externa (`COLOR.acentoSuave`), blanco con borde de 1,2 en `COLOR.tinta` en la interna. Aire: 6 arriba, 7 abajo y 13 a cada lado.
  - La solapa, con `contorno`. La hueca se une al panel: un polígono blanco, de 2,4 de alto, tapa el borde debajo de ella. Nunca un `rect` de 1 punto o menos.
  - Debajo de la externa, 18 de aire: su `dibujar` devuelve `y + alto + 18`, y el alto que mide `lugarPara` no lo incluye.
  - `piezaDeLaGestion` queda solo con `piezaDelCircuito`.
  - Sale `prepararRecuadro` de las gestiones: sigue en «Cómo se cuenta».

- [ ] **Paso 6: arriba de la hoja 1 y la elección de la letra.** `dibujarElCircuito`:

```js
const yHoja = agregarHoja(doc, hoja);
const armar = (letra) => GESTIONES.filter((g) => Array.isArray(circuito[g]))
  .map((gestion) => prepararGestion(doc, { gestion, combinacion, contenido: piezaDeLaGestion(doc, d, gestion, letra) }));
const altoDe = (recuadros) => elTitulo.alto + ENTRE + recuadros.reduce((total, r) => total + r.alto, 0) + AIRE_ENTRE_GESTIONES;
// La letra más grande con la que las dos gestiones entran en la hoja (spec, 5); con la más chica, si tampoco entran, la interna pasa a la siguiente
const recuadros = LETRAS_DEL_CIRCUITO.map(armar).find((r) => yHoja + altoDe(r) <= limiteDe(doc)) ?? armar(LETRAS_DEL_CIRCUITO.at(-1));
```

  El título sale de `tituloConDerecha`, que dibuja, además:

```js
pildora.dibujar(y - 6, IZQUIERDA + CONTENIDO - pildora.ancho);
```

  `anchoMaximo` de la píldora: `CONTENIDO` menos el ancho del rótulo más largo («INFORME ANUAL · AÑO 2026, AL 31/12/2026») y 12 de aire.
  `textoDeDondeSale`, si hay: `ajustar(doc, origen, { ancho: 245, lineas: 2, max: 7.2, opciones: { align: 'right' } })` y `escribir`, en color tinta, en `y + 19`.
  El título no cambia de ancho: `El circuito, del aviso del RPAD a la carga en el portal` mide unos 496 y deja lugar.

- [ ] **Paso 7: la hoja 2.** `dibujarLosResultados`:
  - El título, con `T.bajadaDeResultados(anio)` a su derecha.
  - `piezaDeResultados` sin cabeza de sección.
  - En la lista de cobertura, cada ítem en hasta 3 renglones. `ALTO_MAXIMO_DE_LA_LISTA` sigue en 260, si el test del Paso 2 pasa.
  - «Cómo se cuenta» en su propio grupo: ya no viaja con los resultados. Adentro, el párrafo de hoy y, debajo, cada gestión con su nombre en 6,6 negrita tinta y sus aclaraciones en 8,4.
  - Si `y + comoSeCuenta.alto > limiteDe(doc)`, en vez de `lugarPara`: `dibujarParte(doc, hoja, titulo(T.titulos.resultados), [[comoSeCuenta], …])`, con el título repetido.
  - `elementosDeLosDestildados` debajo, solo con `conDestildados`.

- [ ] **Paso 8: Métricas y el Informe** usan las dos funciones. Sacar lo que dejó de usarse.

- [ ] **Paso 9: los tests viejos de las hojas 1 y 2.**
  - `gestiones` (2025-2034) y los que buscan `GESTIÓN EXTERNA · MEDIANA EN DÍAS HÁBILES` y las aclaraciones.
  - Los que buscan `RESULTADOS DEL AÑO`: 672, 845, 1741, 1751.
  - «viaja con los resultados» (828-838) contradice la spec: se reemplaza por el del salto con título.
  - `LETRA_DEL_NOMBRE`, `LETRA_DE_LA_CIFRA`, `LETRA_DE_LA_INSIGNIA` y `LETRA_DE_LA_BANDA` (2014-2017): de la grande.
  - `metricas-api.test.js:243-252` y `406-415`.

- [ ] **Paso 10: mirar.** Con la base local, las cuatro combinaciones, un año cerrado sin foto y una foto simulada, como imágenes (`pdf2png`). Compararlas con `pdf/Metricas-RPAD-2026-maqueta.pdf`. Y con `prototipo/con-notas.mjs`: la respuesta del área con cifra.

- [ ] **Paso 11: retomar la referencia**, `npm test`, commit y push. `feat(metricas): la hoja del circuito y la de los resultados`.

---

## Tarea 5: los días corridos

**Files:** `services/reportesMetricasPdf.js`, `controllers/metricasController.js`, `controllers/reportesController.js`, `tests/reportes-pdf.test.js`, `tests/metricas-api.test.js`.

- [ ] **Paso 1: la suite en verde.**

- [ ] **Paso 2: los tests primero.**
  - `textoDeCorridos`, exportada, con cada fila de la tabla de la spec, sección 5. La cifra «En el día» trae `unidad` en días hábiles: se mira en `cifraDelTramo` (`services/metricasReglas.js:470`) antes de escribirla.
  - El PDF con «Días hábiles» y `circuito_en_corridos`: `(N días corridos)` debajo de cada cifra, y con el color de su tarjeta.
  - Con «Promedio», el promedio; con «Días corridos», ningún paréntesis; sin el campo, ningún paréntesis.
  - Un `conLoMasLargo` en días hábiles, con `circuito_en_corridos`: hoy está en corridos y no mediría el paréntesis. Ninguna línea termina en «…» y nada se pisa.
  - `metricas-api.test.js`: `GET /api/metricas` no trae `circuito_en_corridos`; el PDF en vivo escribe el paréntesis; un año con foto y el Informe lo toman de la foto.
  - Los destildados se respetan: con `sin`, el paréntesis sale de la vista sin ese dataset.
  - Se lee la tabla de feriados una sola vez y `fuentesDe` una sola vez por pedido del PDF (como lo mira hoy el test de `exigirLaTabla`, o contando con un espía del pool).

- [ ] **Paso 3: el dibujante.** `etapaDe` recibe `dias`, el elegido, y el tramo en corridos:

```js
// «(83 días corridos)»: la cifra del mismo tramo en días corridos, con el texto y la unidad del servidor. Nada si ya se dibujan días corridos,
// si no hay, o si las dos son «En el día» (spec 2026-11-05-metricas-pdf-apaisado, 5)
export const textoDeCorridos = (cifra, corrida, dias) => {
  if (dias !== 'habiles' || !esObjeto(cifra) || !esObjeto(corrida)) return '';
  if (corrida.en_el_dia === true) return cifra.en_el_dia === true ? '' : `(${texto(corrida.texto)})`;
  return `(${texto(corrida.texto)} ${texto(corrida.unidad)})`;
};
```

  `etapaDe` lo dibuja entre la cifra y `cifra.debajo`, con `chico(…, { fuente: NEGRITA, color: tono.tinta, tamano: letra.debajo, lineas: 1 })`.
  `piezaDelCircuito` recibe los tramos en corridos y busca por `clave`.
  `piezaDeLaGestion` los toma de `objeto(datos.circuito_en_corridos)[gestion]`.
  La elección de la letra de la Tarea 4 mide con el paréntesis.

- [ ] **Paso 4: Métricas en vivo.** En `metricasController.js`:
  - `enVivo(fuentes, { …, conCorridos })`: si `conCorridos && dias === 'habiles'`, suma `circuito_en_corridos: vistaDe(casos, { anio, al, estadistico, dias: 'corridos', sin, calendario }).circuito`, con los mismos `casos`.
  - `metricasConOpciones(query, { hoy, conCorridos = false })`. `pdfDeMetricas` pasa `true`. `metricasDe` no.
  - Con foto: `circuito_en_corridos: deLaFoto(foto, { estadistico, dias: 'corridos' }).vista.circuito`, solo con `conCorridos && dias === 'habiles'`.
  - `reportesController.js`, `delInforme`: `circuito_en_corridos: deLaFoto(foto, { estadistico: ESTADISTICOS[0], dias: 'corridos' }).vista.circuito`.
  - `cicloDeVidaDe` y «Datos para completar» no cambian.

- [ ] **Paso 5: los datos de los tests.** `metricasDeLosCasos` y `fotoDeLosCasos` suman `circuito_en_corridos` con `vistaDe`, con `dias: 'habiles'`.

- [ ] **Paso 6: mirar la hoja 1** con la base local, en las cuatro combinaciones. Comparar los paréntesis con `comparar/simulaciones.mjs`.

- [ ] **Paso 7: retomar la referencia**, `npm test`, commit y push. `feat(metricas): los días corridos entre paréntesis en la hoja del circuito`.

---

## Tarea 6: hoja 3

**Files:** `services/reportesMetricasPdf.js`, `services/reportesInformeAnualPdf.js`, `tests/reportes-pdf.test.js`.

- [ ] **Paso 1: la suite en verde.**

- [ ] **Paso 2: los tests primero.**
  - El índice y la antigüedad están en la misma hoja, con la x de la antigüedad a la derecha del índice.
  - «DOBLE VERIFICACIÓN» debajo de la antigüedad, en su columna.
  - Sin índice: su texto en la columna izquierda, y la derecha igual.
  - El Informe imprime el pie del índice cerrado, y no dice «el de hoy»; Métricas imprime `T.pieDelIndice`, también en un año cerrado.
  - Con `muchasManuales()`, la tabla corta de hoja apaisada y nada se sale.
  - Ajustar 679 y 809: la doble verificación cambia de orden.

- [ ] **Paso 3: el dibujo.**
  - `piezaDelIndice(doc, indice, ancho)`: usa `ancho` en vez de `CONTENIDO`.
  - `piezaDeBarras`, como está, con `anchoTexto: 78` en la antigüedad.
  - `elementosDelContexto(doc, contexto, trabajo, { pieDelIndice })`: un solo grupo, un elemento de dos columnas, de 470 y `CONTENIDO - 470 - 16`, con `prepararSeccion` y `ancho`. Mide el alto como el mayor de las dos.
  - `elementosDelTrabajo`: sale la doble verificación, que pasa a la columna derecha. Sigue `conManuales`.
  - `T.pieDelIndice` queda como está, atado a la página. El del Informe, en `TEXTOS_DEL_INFORME.pieDelIndice`: el texto de la spec, sección 6.

- [ ] **Paso 4: retomar la referencia**, `npm test`, commit y push. `feat(metricas): el contexto y el trabajo en la hoja apaisada`.

---

## Tarea 7: hojas 4 y 5

**Files:** `services/reportesMetricasPdf.js`, `services/reportesInformeAnualPdf.js`, `tests/reportes-pdf.test.js`.

**Interfaz:** `dibujarLasAreas(doc, hoja, areas, { titulo })`, que usan los dos PDF. Se exporta.

- [ ] **Paso 1: la suite en verde.**

- [ ] **Paso 2: los tests primero.** Con un `areas` armado a mano, de 3, 50 y 120 áreas (inventadas), y un nombre de 100 letras:
  - Todas las filas, en orden (`#` de 1 a N, leídas por columna y por hoja).
  - El encabezado de la tabla arriba de cada columna.
  - La cabeza «RANKING DE ÁREAS» solo en la primera hoja.
  - Temas y frecuencias en la columna libre, o en una hoja nueva si la tabla terminó a la derecha.
  - `verificarDiagramacion` en los tres.
  - Sin ranking: `T.sinAreas`. Sin temas: el texto de `vacios`.
  - El Informe imprime «Áreas y temas» y `RANKING DE ÁREAS`, con los datos de la foto. La línea 1756 afirma lo contrario: se invierte.

- [ ] **Paso 3: el dibujo.**
  - La fila del ranking: una pieza con letra 7,6, aire 3,5 arriba y abajo, y el nombre del área en hasta 4 renglones; columnas `[0, 18, ancho - 122, ancho - 84, ancho - 54]`, porque «Cumplimiento» en negrita mide unos 51; `filete` debajo, del ancho de la columna.
  - `flujo.cabeza(encabezadoDeLaTabla)`: una pieza con los títulos y su filete.
  - Después de la tabla: `flujo.cabeza(null)` y `flujo.saltarColumna()`.
  - Temas y frecuencias: **una pieza por cada una**, con la cabeza (`prepararSeccion` con `ancho`), las barras (`piezaDeBarras`, `anchoTexto: 130`) y el aire medidos adentro, para que `poner` no las separe.
  - `elementosDeLasAreas` se reemplaza.

- [ ] **Paso 4: el Informe** llama a `dibujarLasAreas` con `objeto(f.areas)`, antes de su última parte. Actualizar el comentario de arriba y el de `renderInformeAnual`, que dicen que las áreas no van.

- [ ] **Paso 5: retomar la referencia**, `npm test`, commit y push. `feat(metricas): el ranking en dos columnas y las áreas en el Informe anual`.

---

## Tarea 8: la última parte del Informe

**Files:** `services/reportesInformeAnualPdf.js`, `tests/reportes-pdf.test.js`, `tests/metricas-api.test.js`.

- [ ] **Paso 1: la suite en verde.**

- [ ] **Paso 2: los tests primero.**
  - El primer año: el título es «Logros del año»; la píldora «Primer año con foto» arriba a la derecha y debajo «Los hitos de 2026 cargados en Proyectos»; no dice «COMPARACIÓN CON 2025», «Comparación con 2025 y logros del año» ni la cabeza «LOGROS DEL AÑO».
  - Sin hitos, el primer año: el título, la píldora y «Sin hitos registrados en 2026.».
  - Con foto anterior: el título de hoy, las tres tablas, «Diferencia: …», y debajo o en la hoja siguiente «LOGROS DEL AÑO» con su derecha.
  - La cabeza «LOGROS DEL AÑO» viaja con el primer hito: nunca queda sola al pie.
  - Los hitos en dos columnas, por proyecto, en el orden de `logrosPorProyecto`.
  - Un proyecto cuyos hitos pasan a otra columna o a otra hoja repite su nombre, y un nombre nunca queda solo al pie de una columna.
  - Un hito con 35 renglones de descripción, justo debajo del título o de la comparación, no se sale ni deja un título solo en su hoja.
  - `verificarDiagramacion` en todas (`HITOS`, muchos hitos, primer año y con comparación).
  - Las palabras de `comparacionDe` y `logrosPorProyecto` no cambian.
  - `metricas-api.test.js:801` y `:820`: el primer año ya no dice esas cabezas.

- [ ] **Paso 3: el dibujo.**
  - `LINEAS_DE_LA_DESCRIPCION`: 35, con el motivo en su comentario.
  - `prepararHito(doc, hito, ancho)`, con el ancho de la columna: una pieza `{ alto, dibujar(y, x) }`, con la línea fina debajo y `ENTRE` de aire medido adentro.
  - `dibujarLogros(doc, y, logros, anio, { conCabeza })`:
    - Con `conCabeza`: `y = lugarPara(doc, y, seccion.alto + ENTRE + alturaDeLaPrimeraPieza)` y la cabeza, de todo el ancho, antes de crear el flujo.
    - `nuevoFlujo(doc, y)`.
    - Para cada proyecto: `flujo.cabeza(nombre)`; `flujo.poner(nombreMasPrimerHito, { sinCabeza: true })`; los demás hitos, `flujo.poner(hito)`: si cortan de columna, la cabeza repite el nombre.
    - Al cambiar de proyecto, la cabeza cambia antes de poner.
  - El primer año: `tituloConDerecha` de la Tarea 4, con la píldora y la derecha. `conCabeza: false`.
  - Con foto anterior, como hoy, con `conCabeza: true`.

- [ ] **Paso 4: retomar la referencia**, `npm test`, commit y push. `feat(informe): la última parte, apaisada, con los logros en dos columnas`.

---

## Tarea 9: comparación, documentos y cierre

**Files:** `docs/temas/metricas-y-reportes.md`, `docs/temas/ciclo-de-vida.md`, `README.md`, comentarios.

- [ ] **Paso 1: la comparación con la base local**, contra el «antes» de la Tarea 1, fuera del repo.
  - Lo que manda `metricasDe` en las cuatro combinaciones: idéntico.
  - La foto simulada con `datosDeLaFoto`: idéntica.
  - Ciclo de vida, Estado general, Por área, Avisos, Agenda, Datos para completar, Seguimiento y un anexo de reiteración: idénticos por hoja.
  - El gancho sobre `reportes-pdf`, `seguimiento-pdf` y `notas-anexo`: los PDF que no son de Métricas ni del Informe, idénticos.
  - Métricas y el Informe: `comparar/simulaciones.mjs`, cifra por cifra, y la bolsa de palabras, sin encabezado ni pie. Cada diferencia tiene que estar en la spec, sección 8, o ser un encabezado de tabla repetido, el rótulo del año en una hoja con título nuevo o el nombre de un proyecto repetido. Se listan todas; no se pide cero.
  - El Informe suma, además, todo lo de Áreas y temas, y pierde la frase vieja del pie del índice.
  - Cada `(N días corridos)` del PDF es igual a la cifra de la misma etapa con `dias: 'corridos'`, en las dos gestiones y los dos estadísticos.

- [ ] **Paso 2: mirar.** Como imágenes, con la base local: las cuatro combinaciones; un año cerrado sin foto; un Informe de una foto simulada, primer año y con comparación; un PDF con destildados; y la respuesta del área con cifra (`prototipo/con-notas.mjs`). Impreso en grises, que la solapa se distinga.

- [ ] **Paso 3: el documento del tema**, `docs/temas/metricas-y-reportes.md`:
  - Sumar esta spec a la «Historia».
  - Los reportes: Métricas del año, con sus 5 hojas, sin cintas, «Unas 5 hojas»; el Informe anual, con Áreas y temas y su última parte.
  - «La base de los PDF»: A4 por documento, `hojaDe`, `limiteDe`, `nuevoFlujo`.
  - El circuito del PDF: solapa, frases, columnas, Portal, los escalones de la letra y `circuito_en_corridos`, con el motivo de por qué las aclaraciones van en «Cómo se cuenta» y de por qué hay escalones: si alguien los quiere «arreglar» de buena fe.
  - La cinta: «La pantalla la dibuja en SVG y el PDF con PDFKit» pasa a que solo la dibuja la página, y sale `OPCIONES_CINTA_PDF`.
  - `tests/documentos.test.js` controla los topes.

- [ ] **Paso 4: los otros documentos.**
  - `README.md`, línea 193: Métricas y el Informe, apaisados.
  - `docs/temas/ciclo-de-vida.md`, línea 88: sigue valiendo; mirar que no diga que el PDF de Métricas está en A4 vertical.
  - Los comentarios de arriba de `reportesMetricasPdf.js`, `reportesInformeAnualPdf.js` y `reportesPdfBase.js`.
  - `CLAUDE.md` y `.claude/rules/` no cambian.

- [ ] **Paso 5: el repo.** Ningún nombre real ni dato de producción (`~/rpad-notas/palabras.txt`), sin binarios, lenguaje neutro en el diff.

- [ ] **Paso 6: la revisión de toda la rama**, con un agente con Opus, que no haya visto la implementación, contra la spec. Corregir y volver a mirar.

- [ ] **Paso 7: merge y kit.** Traer `main` a la rama, `npm test` completo en verde, merge y push sin pedir OK (regla del usuario).
  Armar `~/rpad-kits/RPAD-deploy-metricas-pdf-apaisado`, contra `a269509` o el `main` que indique la coordinadora, sin SQL, con Restart, con los ocho archivos de la spec, sección 10, su vuelta atrás y `PASOS.txt`, y comprobación previa de `correos.js?v=20261226`, `usuarios.js?v=20261224`, `mi-espacio.js?v=20261226`, `reportes.js?v=20261209` y `seguimiento.js?v=20261130`.
  Nunca desplegar.

- [ ] **Paso 8: avisar a la coordinadora:** `TODO EN VERDE`, con el hash y el kit.
