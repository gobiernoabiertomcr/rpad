# Métricas: «Redacción y entrega de nota» — plan

> **Para quien lo ejecute:** usar superpowers:subagent-driven-development, con todos los subagentes en Opus. Los pasos llevan casillas (`- [ ]`).

**Objetivo:** que la etapa del circuito de la DGMIT y la Dirección Administrativa deje de llamarse «Trámite y entrega de la nota» y pase a llamarse «Redacción y entrega de nota» en todo lo que se ve:
- la pestaña Métricas;
- la cinta;
- los PDF de Métricas del año, del Ciclo de vida del dato y del Informe anual.

**Cómo:** el nombre sale de un solo lugar, `TRAMOS` de `services/metricasReglas.js` (clave `tramite`). La pantalla, la cinta y los PDF lo imprimen tal cual (Ruling 19). El nombre nuevo entra en el lugar de siempre, así que la diagramación no cambia.

**Stack:** Node 22 ESM, PDFKit, `node --test`.

**Spec:** no hay spec aparte. Es el pedido del usuario del 28/10/2026, que llegó por la coordinadora. Las decisiones están acá abajo.

## Decisiones

- **El nombre es «Redacción y entrega de nota».** La coordinadora había pedido «Redacción y entrega de la nota». Ese nombre no entraba en dos PDF:
  - en la flecha del circuito de Métricas y del Informe anual se cortaba en «Redacción y» / «entrega de la…»;
  - en el bloque del Ciclo de vida se cortaba en «Redacción y entrega de la…».

  El usuario vio en el PDF de verdad las variantes con más lugar o con letra más chica y otros nombres. Después propuso «Redacción y entrega de nota», que entra sin tocar nada (28/10/2026).
- **La clave interna `tramite` no cambia** (decisión de la coordinadora). Nadie la ve, y la usan la foto del 31/12 (JSON), las cintas, `CIRCUITO_DE_LA_GESTION` y los tests. Tampoco cambian los identificadores que la repiten: `delTramite`, `sinTramite`, `tramoDe('tramite')`.
- **La descripción del Ciclo de vida** (`TEXTOS_DEL_CICLO.descripciones.externa.tramite`) cambia «preparan» por «redactan» (decisión del usuario). Queda: «La DGMIT y la Dirección Administrativa redactan la nota formal que le pide los datos al área y se la hacen llegar.» Mide 0,72 pt menos y se corta en los mismos renglones.
- **`docs/` no se toca.** Las specs, los planes y las maquetas son el registro de lo que se decidió.
  - Sí se actualizan `CLAUDE.md` y `README.md`, también en minúscula (decisión del usuario). Por ejemplo, «trámite y entrega de la nota» pasa a «redacción y entrega de nota» y «el trámite de la nota» pasa a «la redacción y entrega de nota».
- **Los comentarios del código y los títulos y comentarios de los tests** que nombran la etapa en prosa también cambian: «el trámite de la nota» pasa a «la redacción y entrega de nota», y «el trámite» a secas, a «la redacción».
  - Si «trámite» tiene otro sentido, queda como está:
    - «franquicia para trámites personales» (`services/miEspacioNota.js`);
    - «estado del trámite» (los SQL de los datasets);
    - `nota: 'Trámite'` de una licencia, en los tests de Mi espacio;
    - «consultas, trámites y gestiones» (`tests/seguimiento-casos.js`);
    - «Cantidad de trámites de prueba» (`tests/notas-generador-api.test.js`).
- **La diagramación no cambia**, porque el nombre entra donde entraba el viejo (medido con PDFKit, ver «Lo medido»):
  - **Flecha del circuito:** «Redacción y» / «entrega de nota», en 7 pt y dos renglones, como hoy.
  - **Bloque del Ciclo de vida:** sale en 8,6 pt; el nombre viejo salía en 9,1. Lo achica solo `ajustar`, que ya lo hacía con el nombre viejo, y no baja del mínimo de 8,4 pt.
  - **La cinta:** el rótulo «Redacción y entrega de nota · 12 días hábiles» es un carácter más corto que el de hoy.
  - **La pantalla:** el nombre pasa al renglón siguiente y no se corta.
- **`VERSION_REPORTES` no cambia**, porque no cambian ni `public/js/reportes.js` ni `public/reportes.html`.
- **La foto del 31/12** guarda los textos ya armados (`vistas`, `cintas` y `etapas`).
  - La de 2026 se saca el 10/01/2027 y no se modifica nunca, así que este cambio tiene que estar en producción antes.
  - Viaja en el kit de «Mi espacio: los días de vacaciones al cargar la licencia»; no tiene kit propio.
  - Las fotos que ya existan no se tocan (no debería haber ninguna).

## Lo medido (Helvetica-Bold, PDFKit)

| Lugar | Letra | Ancho | Hoy | «Redacción y entrega de nota» |
|---|---|---|---|---|
| Flecha del circuito, `services/reportesMetricasPdf.js` (`flechaDe`; el Informe anual la usa con `elementosDelCircuito`) | 7 pt, 2 renglones | 59,74 pt | «Trámite y entrega» / «de la nota» | «Redacción y» / «entrega de nota», entero |
| Nombre del bloque, `services/reportesCicloDeVidaPdf.js` (`dibujarIzquierda`) | 9,6 → 8,4 pt, 1 renglón | 123,13 pt | entero a 9,1 | entero a 8,6 |

## Cuidados globales

- **El repo es público:** no puede aparecer ningún nombre real de personas. Antes de cada commit, revisar el diff contra la tabla `usuarios` del dump (`C:\Users\Mariano\Desktop\datospublicos_mcr_rpad.sql`): primer nombre, apellidos y username.
- **Base, emails y crons:** la base local `datospublicos_mcr_rpad` no se escribe. No se mandan emails reales ni se llama a `/api/cron/*`.
- **Suite:** `npm test` completo antes y después de la tarea, con el candado `C:\Users\Mariano\.rpad-suite.lock`.

## A revisar

1. **La referencia de los PDF tiene que cambiar solo por el nombre.** Antes de volver a tomarla, el diff de texto hoja por hoja tiene que mostrar nada más que:
   - las líneas del nombre en la hoja 1 de los cinco PDF;
   - en «con una nota DGMIT…», además, el rótulo de la cinta de la hoja 3.
2. **Ninguna «…» en el nombre**, en ninguno de los tres PDF, con los datos reales de los casos. Lo cubren los tests que buscan el nombre entero (`bloqueDe`, `enOrden` y la hoja 1 del PDF de Métricas).
3. **Ningún «trámite» de esta etapa en lo que arma el servidor.** Lo cubre el test nuevo, que mira el JSON de la vista, las cintas y las etapas.
4. **El orden de los rótulos** en `tests/metricas-cinta.test.js` (las líneas que siguen a la 275, la lista que se compara ordenada con `sort()`): «Redacción» va antes de «Respuesta». Es un cambio del test, no del dibujo.
5. **Los tests que pasarían sin probar nada** si se quedaran con el nombre viejo: el `doesNotMatch` de `tests/reportes-frontend.test.js:367` y el fin del bloque de `tests/reportes-pdf.test.js:2278`. Pasan al nombre nuevo.

---

### Tarea 1: «Redacción y entrega de nota»

**Archivos:**
- `services/metricasReglas.js`:
  - `TRAMOS.tramite.nombre` (~línea 299);
  - los comentarios en prosa de las líneas ~403, 428, 511, 764, 845 y 883.
- `services/metricasCinta.js`: el comentario de la línea ~167.
- `services/reportesCicloDeVidaPdf.js`: `TEXTOS_DEL_CICLO.descripciones.externa.tramite` (~línea 45).
- `CLAUDE.md`: las líneas ~210, 243, 246 y 252. En la línea 344, «trámites personales» queda.
- `README.md`: las líneas ~177 y 1149.
- Tests: los literales esperados y la prosa.
  - `tests/metricas-reglas.test.js`:
    - literales: 675, 720 y 2236;
    - títulos: 751, 2392 y 2420;
    - comentarios: 767, 818, 862, 1330, 1376, 1533, 2192, 2290, 2448 y 2494.
  - `tests/metricas-cinta.test.js`:
    - 17 (`DE_LA_CLAVE`), 275, 281-284 (reordenada) y 439;
    - comentarios: 267, 297 y 434.
  - `tests/reportes-frontend.test.js`: 73 (`DE_LA_CLAVE`) y 367.
  - `tests/reportes-pdf.test.js`:
    - literales: 560 (`TRAMOS_A_MANO`), 694, 2179-2180, 2203, 2215, 2278 y 2322;
    - comentarios: 1993, 2213 y 2320;
    - el rótulo de la variante de 2051 y el título de 2196.
  - `tests/metricas-api.test.js`: el comentario de 622.
- Los números de línea son los de main 65a79f8. Hay que verificarlos con `grep -n -i "tr[aá]mite"`.

**Interfaces:**
- Produce el `nombre` del tramo `tramite`, «Redacción y entrega de nota». Lo reciben:
  - `GET /api/metricas`, en `vista.circuito.externa[1].nombre`;
  - las cintas, en `segmentos[].texto` y `rotulos[].texto`;
  - el Ciclo de vida, en `etapas.externa[1].nombre`.

- [ ] **Paso 1: escribir los tests que fallan.**
  - En todos los tests de la lista, los literales esperados pasan al nombre nuevo. En el Ciclo de vida, la descripción esperada pasa a «redactan».
  - Test nuevo en `tests/metricas-reglas.test.js`: `it('ninguna etapa se llama «trámite»: el circuito, las cintas y el Ciclo de vida dicen «Redacción y entrega de nota»')`.
    - Toma con los casos el `JSON.stringify` de `vistaDe(…)`, de `cintasDeLaVista(…)` y de `etapasDe(…)`.
    - Ninguno hace match con `/trámite/i`. La búsqueda va con tilde, para no confundirse con la clave `tramite`.
    - Los tres incluyen `'Redacción y entrega de nota'`.
  - En `tests/reportes-pdf.test.js`, la misma comprobación sobre las líneas de la hoja 1 del PDF de Métricas (con una nota DGMIT) y de la hoja 1 del Ciclo de vida:
    - ninguna línea hace match con `/trámite/i`;
    - en Métricas, las líneas incluyen `'Redacción y'` y `'entrega de nota'`;
    - en el Ciclo de vida, incluyen `'Redacción y entrega de nota'`.
- [ ] **Paso 2: comprobar que fallan.** Correr `node --test tests/metricas-reglas.test.js tests/metricas-cinta.test.js tests/reportes-frontend.test.js tests/reportes-pdf.test.js`. Lo esperado es que FALLEN los literales nuevos.
- [ ] **Paso 3: cambiar el código.** Primero el `nombre` en `TRAMOS` y la descripción en `TEXTOS_DEL_CICLO`; después los comentarios.
- [ ] **Paso 4: volver a tomar la referencia.**
  - Antes de tomarla, comparar con `bash <scratchpad>/simular.sh HEAD`, sin commitear. El scratchpad es `C:\Users\Mariano\AppData\Local\Temp\claude\C--git-rpad--claude-worktrees-funny-mahavira-3f16dc\590a8eca-8e39-440d-a51e-a90d554d3679\scratchpad\`.
  - El diff tiene que mostrar solo lo del punto 1 de «A revisar». En el Ciclo de vida, solo el nombre, su letra, la x de la insignia y la línea con «redactan».
  - Después, correr `node --test --test-name-pattern="no cambian" tests/reportes-pdf.test.js` y pegar los hashes del mensaje en `REFERENCIA_DE_LOS_PDF`.
  - Sumar al comentario de `REFERENCIA_DE_LOS_PDF` que la hoja 1 de los cinco PDF y la hoja 3 de «con una nota DGMIT» se volvieron a tomar por el nombre de la etapa (28/10/2026), comprobado con el diff.
- [ ] **Paso 5: actualizar la documentación.** Cambiar `CLAUDE.md` y `README.md`.
- [ ] **Paso 6: verificar.**
  - Correr las cuatro suites del paso 2. Lo esperado es que PASEN.
  - Correr `npm test` completo, con el candado.
  - Correr `grep -rn -i "tr[aá]mite" --exclude-dir=docs --exclude-dir=node_modules .`. Tiene que mostrar solo las claves y los identificadores, más los «trámite» con otro sentido de «Decisiones».
- [ ] **Paso 7: hacer el commit.** Revisar el diff contra los nombres del dump y commitear `feat(metricas): «Redacción y entrega de nota»`.
