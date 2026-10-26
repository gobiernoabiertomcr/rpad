# Ciclo de vida del dato: plan de implementación

> **Para quien lo ejecuta:** sub-skill obligatoria: `superpowers:subagent-driven-development` (la recomendada) o `superpowers:executing-plans`, tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** un reporte PDF nuevo, «Ciclo de vida del dato», en «Para presentar». Tiene dos hojas A4, una por gestión, y un bloque por etapa del circuito. Cada bloque dice qué se hace en la etapa y da la mediana, el promedio, el caso más largo y el más corto, los en curso y el año anterior.

**Arquitectura:**
- Las cifras salen de una función pura nueva, `etapasDe`, en `services/metricasReglas.js`. Reusa `hechosDe`, `medir`, `cifraDe` y `tramoDelCircuito` sin copiarlos.
- Se calculan en vivo o se leen de la foto del 31/12, que suma la parte `etapas`.
- `controllers/metricasController.js` lee el año como lo lee Métricas.
- Un dibujante puro, `services/reportesCicloDeVidaPdf.js`, arma las dos hojas con la base de los reportes.
- La pestaña Reportes suma la tarjeta.

**Stack:** Node 22 (ESM), Express, MariaDB (mysql2), PDFKit, vanilla JS, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-25-ciclo-de-vida-del-dato-design.md`, aprobada el 25/10/2026.
- Maquetas: `…-mockups/`. La referencia visual es `Ciclo-de-vida-del-dato-2026-prueba.pdf`.
- El script que lo armó está en el scratchpad de la sesión de diseño: `maqueta/pdf-prueba.mjs`. Se puede leer para ver medidas, pero no se copia.

## Restricciones globales

- **Plazo:** en producción antes del **10/01/2027**, el día en que se saca la foto de 2026.
- **Turno:** la implementación va **después del merge de Proyectos** (`feat/proyectos`). Antes, la tarea 1 trae main y relee el código.
- **Ninguna regla se copia:** las cifras salen de `medir`, `hechosDe`, `cifraDe` y `tramoDelCircuito`, y la mediana y el promedio de cada etapa tienen que coincidir con la `cifra.valor` de `vistaDe` con `sin: []`.
- **Lenguaje neutro:** nunca «tardanza», «demora», «atraso», «sin respuesta», «sin entregar» ni «no mandó». Sin nota DGMIT, «pendiente de carga». Los extremos nombran el dataset, no el área.
- **Nombres de los extremos:**
  - en el aviso, «Con más anticipación» y «Con menos anticipación»;
  - en las demás etapas, «El caso más largo» y «El caso más corto»;
  - con un solo ciclo, «El único caso».
- **Unidad:** «días hábiles», o «día hábil» si es 1; los corridos, «40 días corridos» o «1 día corrido». 0 es «En el día», sin unidad.
- **Textos:** los arma el servidor (Ruling 19) y las páginas no recalculan nada.
- **Páginas y versiones:** `api.js`, `main.js` y `main.css` no cambian. Sube `VERSION_REPORTES`, a la siguiente libre después de la de Proyectos.
- **PDF:**
  - siempre dos hojas A4;
  - nada pasa de `LIMITE`;
  - nada se pisa (`pdf-diagramacion.js`);
  - ningún texto baja de 6,2 pt;
  - Helvetica, `COLOR` del anexo, violeta `#5B4691`, verde `#2E6B4C` y ámbar `#7A5200`.
- **Archivo:** `Ciclo-de-vida-del-dato-AAAA.pdf`.
- **Ruta:** `GET /api/reportes/ciclo-de-vida?anio=`, con `authMiddleware` y sin `adminOnly`.
  - Sin `anio`, el en curso.
  - Un año sin métricas da 404 `SIN_METRICAS`.
  - Un 500 dice «Error al generar el Ciclo de vida del dato».
- **Datos reales:** no van en tests versionados (Ruling 3). En los archivos versionados no van nombres de personas.
- **`npm test` completo antes y después de cada tarea**, con Docker. No correr dos suites a la vez: antes, revisar `SHOW DATABASES LIKE 'rpad_test%'` y los procesos. Nunca `/api/cron/*` ni emails reales.
- **Commits:** uno por tarea, en español, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Los subagentes, con Opus.

## Foco de la revisión

Son los casos que la spec implica y que más pueden fallar. Cada uno tiene su test en la tarea dueña.

1. **Un título de dataset larguísimo** (250 caracteres) en el caso más largo o el más corto: se corta con «…» y no pisa nada (tarea 5).
2. **Un bloque sin cifras con todo:** en curso, notas pendientes, aclaración y año anterior. Todo se ve y nada se pisa (tareas 2 y 5).
3. **Un año cerrado sin foto, entre el 01/01 y el 09/01:** píldora ámbar con el aviso de la foto; el año anterior se lee en vivo al 31/12 (tarea 4).
4. **Una foto sin `etapas`,** sacada antes del despliegue: se calculan con sus `casos` y dan lo mismo que la foto nueva (tarea 3).
5. **La hoja externa con las cuatro etapas llenas y dos renglones de notas en cada bloque:** entra en una hoja (tarea 5).

---

### Tarea 1: Traer main, releer el código y la línea de base

**Archivos:**
- Modificar: este plan, si main cambió algo de lo que asume.

- [ ] **Paso 1.** Desde el worktree, traer main con la herramienta `sync_with_base_branch` (o `git merge main` si no hay app), resolver conflictos y comprobar que el `.env` apunte a `rpad_rama_ciclo_de_vida`.
- [ ] **Paso 2.** Releer `services/metricasReglas.js` (`hechosDe`, `medir`, `tramoDelCircuito`, `vistaDe`), `services/metricasFoto.js`, `controllers/metricasController.js`, `controllers/reportesController.js`, `routes/index.js` (el bloque `/reportes/*`), `public/js/reportes.js` (las tarjetas) y los tests que nombra este plan. Escribir al pie de este plan «Diferencias encontradas» (nombres, líneas y la `VERSION_REPORTES` actual) y ajustar las tareas.
- [ ] **Paso 3.** Correr `npm test` completo. Esperado: todo verde, la línea de base.
- [ ] **Paso 4.** Avisarle al usuario las diferencias antes de seguir y hacer el commit del plan ajustado: `docs: plan del Ciclo de vida del dato con main al día`.

### Tarea 2: `etapasDe`, las cifras de cada etapa

**Archivos:**
- Modificar: `services/metricasReglas.js`
- Test: `tests/metricas-reglas.test.js`

**Interfaces:**
- **Produce:** `etapasDe(casos, { anio, al }) → { anio, al, externa: Etapa[], interna: Etapa[], aclaracion_de_la_hoja: { externa: string, interna: string } } | null`. Es null sin año, como `vistaDe`, y nunca tira.

  ```
  Etapa = {
    clave, numero, nombre, desde_hasta, responsable, dgmit,   // los de TRAMOS; numero: 1..4 (externa) o 1..3 (interna)
    nodos: [desde, hasta],                                  // 'rpad' | 'da' | 'dit' | 'area' | 'ddpc' | 'portal'
    n,                                                      // ciclos terminados
    habiles: { mediana, promedio } | null, corridos: { mediana, promedio } | null,
    largo: Extremo | null, corto: Extremo | null,           // con n = 1, `corto` es null y `largo` es «El único caso»
    vacio: { titulo, texto, pie } | null,                   // solo con n = 0
    textos: {
      indice: '27' | 'En el día' | '—',
      mediana: { numero, unidad, corridos },                // '27', 'días hábiles', '40 días corridos'; con 0: 'En el día', '', ''
      promedio: { numero, unidad, corridos },               // corridos entre paréntesis: '(41 días corridos)'
      ciclos: 'de 32 ciclos',
      notas: string[]                                       // en orden: orientativo, en curso, pendientes, aclaración de la etapa
    }
  }
  Extremo = { rotulo, habiles, corridos, dataset_id, titulo, mas, numero, unidad, corridos_texto, dataset_texto }
            // dataset_texto: 'Castraciones de Animales y 14 más'
  ```

- **Produce:** `conAnterior(etapas, anteriores) → etapas` (puro).
  - Le suma a cada etapa `textos.anterior`: «Año anterior: mediana de 29 días hábiles», «Año anterior: mediana en el día» o «Año anterior: no hay».
  - `anteriores` es otro resultado de `etapasDe`, o null.
  - La comparación es por gestión y `clave`, con `habiles.mediana`.

- [ ] **Paso 1: los tests que fallan,** en un `describe('etapasDe: el Ciclo de vida del dato')`, sobre `mapaDeLosCasos()` y `HOY_DE_LAS_METRICAS` de `tests/metricas-casos.js` y casos sintéticos con `con(...)`:
  - `paridad con vistaDe`: para cada gestión, etapa y combinación de `ESTADISTICOS` × `DIAS`, `etapa[dias][estadistico]` es igual a la `cifra.valor` del tramo en `vistaDe(casos, { anio: 2026, al, estadistico, dias, sin: [] })`. Sin cifra, `n === 0` y `habiles === null`.
  - `extremos y empates`: los ciclos sintéticos de 0, 0, 0, 5 y 9 días hábiles tienen que dar:
    - `largo.habiles === 9` y `corto.habiles === 0`;
    - `corto.mas === 2`;
    - el `corto` nombrado es el de menos corridos y, con empate, el primero por título;
    - `dataset_texto` termina en « y 2 más».
  - `nombres de los extremos`: en el aviso, «Con más anticipación» y «Con menos anticipación»; en las demás, «El caso más largo» y «El caso más corto»; con un solo ciclo, `largo.rotulo === 'El único caso'` y `corto === null`.
  - `vacío`:
    - sin notas DGMIT en los casos, el trámite da `{ titulo: 'Todavía no hay notas DGMIT cargadas', texto: '<N> notas pendientes de carga', pie: 'Se empieza a contar cuando se carguen en el Seguimiento.' }` y la respuesta, `{ titulo: 'Sin datos todavía', texto: 'Se empieza a contar cuando haya notas DGMIT cargadas.', pie: '' }`;
    - con una nota y sin casos, «Sin casos en 2026».
  - `nada desaparece` (Foco 2): con una nota DGMIT y una respuesta sin terminar, la respuesta tiene `n === 0` y `textos.notas` incluye el en curso «1 sin datos registrados todavía, hace …», el de `tramoDelCircuito`.
  - `notas en orden`:
    - en el aviso externo, la de los avisados ya vencidos: «N ciclos se avisaron cuando ya estaban vencidos: no cuentan en esta etapa, y sus etapas siguientes se cuentan desde ese primer aviso.» (singular con 1);
    - en la respuesta, la de la fuente pública: «N ciclos se resolvieron con datos de una fuente pública: no cuentan en esta etapa.»;
    - con n ≤ 4, primero «Con tan pocos casos, es orientativo.».
  - `aclaración de la hoja`: `aclaracion_de_la_hoja.externa` es el texto de `textoNoRequierenNota` y `interna` es ''.
  - `conAnterior`: los tres textos, «Año anterior: no hay» con `anteriores === null` o con la etapa sin cifra.
  - `no tira`: con `null`, `[]`, `[{}]` o `{ anio: 'x' }` devuelve null o etapas vacías, nunca tira, y ningún texto contiene «undefined», «null» ni «NaN».

- [ ] **Paso 2.** Correr `node --test tests/metricas-reglas.test.js`. Esperado: FALLA, `etapasDe is not a function`.

- [ ] **Paso 3: implementar** `etapasDe` y `conAnterior` en `services/metricasReglas.js`.
  - Hace una sola pasada de `hechosDe` y `medir` por caso para cada unidad, con `contextoDe({ anio, al, dias, estadistico: 'mediana', sin: [] })`.
  - Las cifras salen de `cifraDe`.
  - El vacío, el en curso (en días hábiles y con mediana) y los pendientes salen de `tramoDelCircuito`, adaptados con los textos nuevos de 1.4.
  - Para que `vistaDe` y `etapasDe` usen el mismo código, se extraen dos funciones privadas sin cambiar lo que devuelve `vistaDe`:
    - `aclaracionesDe(cuentan, ctx)`: las cuentas de los avisados ya vencidos, la fuente pública y los que no requieren nota.
    - `textoYaVencidosDeLaEtapa(n)`: el texto corto de la etapa.
  - Lo demás queda privado: ni `hechosDe` ni `medir` se exportan.

- [ ] **Paso 4.** Correr `node --test tests/metricas-reglas.test.js tests/metricas-cinta.test.js tests/reportes-frontend.test.js`. Esperado: PASA, incluidas las de antes (`vistaDe` no cambió).

- [ ] **Paso 5.** Commit: `feat: etapasDe, las cifras de cada etapa del Ciclo de vida del dato`.

### Tarea 3: La foto guarda `etapas`

**Archivos:**
- Modificar: `services/metricasFoto.js`
- Test: `tests/metricas-foto.test.js` (Docker)

**Interfaces:**
- **Usa:** `etapasDe` (tarea 2).
- **Produce:** `etapasDeLaFoto({ anio, datos }) → resultado de etapasDe`.
  - Es `datos.etapas` si existe.
  - Si no, `etapasDe(datos.casos, { anio, al: \`${anio}-12-31\` })`.
  - Tira si el resultado es null, como `deLaFoto` con una foto que no se puede leer.

- [ ] **Paso 1: los tests que fallan.**
  - El test de las claves exactas de la foto (`metricas-foto.test.js`, hoy cerca de la línea 169) suma `etapas`.
  - `la foto guarda etapas y son las de etapasDe con sus casos`.
  - Foco 4: `una foto sin etapas se lee igual`. Se borra `etapas` de los datos de una foto sacada en el test y `etapasDeLaFoto` da lo mismo que con la clave.
- [ ] **Paso 2.** Correr `node --test tests/metricas-foto.test.js`. Esperado: FALLA.
- [ ] **Paso 3: implementar.**
  - `datosDeLaFoto` suma `etapas: etapasDe(delAnio, { anio, al })`.
  - `VERSION_DE_LA_FOTO` sigue en 1 y `PARTES_DE_LA_FOTO` no cambia.
  - `etapasDeLaFoto` se exporta.
- [ ] **Paso 4.** Correr `node --test tests/metricas-foto.test.js tests/metricas-api.test.js`. Esperado: PASA.
- [ ] **Paso 5.** Commit: `feat: la foto del 31/12 guarda las etapas del Ciclo de vida del dato`.

### Tarea 4: Los datos del reporte, con el año anterior

**Archivos:**
- Modificar: `controllers/metricasController.js`
- Test: `tests/metricas-api.test.js` (Docker)

**Interfaces:**
- **Usa:** `etapasDe` y `conAnterior` (tarea 2), `etapasDeLaFoto` (tarea 3), y los privados `leerAniosConFoto`, `opcionesDeMetricas` y `leerFoto`.
- **Produce:** `cicloDeVidaDe(query, { hoy }) → { anio, al, en_vivo, aviso_foto, etapas } | null`.
  - `etapas` es el resultado de `etapasDe` con `conAnterior` aplicado.
  - Es null para un año sin métricas. Lee `query.anio` como `metricasDe`.

- [ ] **Paso 1: los tests que fallan** (`describe('cicloDeVidaDe')`, con la base de prueba del archivo):
  - En vivo, la mediana de cada etapa es la de `metricasDe` con la misma combinación.
  - Un año anterior a 2026 o futuro da null.
  - Con una foto del año anterior, `textos.anterior` sale de la foto. Sin foto ni año anterior (2026), «Año anterior: no hay».
  - Foco 3: con `hoy = '2027-01-05'`, el año 2026 se lee en vivo al 31/12 y `aviso_foto` viene con el texto de `opcionesDeMetricas`.
- [ ] **Paso 2.** Correr `node --test tests/metricas-api.test.js`. Esperado: FALLA.
- [ ] **Paso 3: implementar** `cicloDeVidaDe`.
  - Una sola llamada a `fuentesDe(null)` sirve para el año y, si hace falta, para el anterior en vivo.
  - El año anterior se lee como se lee ese año: de su foto, o en vivo al 31/12. Antes de `PRIMER_ANIO`, null.
- [ ] **Paso 4.** Correr `node --test tests/metricas-api.test.js`. Esperado: PASA.
- [ ] **Paso 5.** Commit: `feat: cicloDeVidaDe, los datos del Ciclo de vida del dato`.

### Tarea 5: El PDF de dos hojas

**Archivos:**
- Crear: `services/reportesCicloDeVidaPdf.js`
- Modificar: `services/reportesMetricasPdf.js` (solo `export` de lo que se reuse)
- Test: `tests/reportes-pdf.test.js`

**Interfaces:**
- **Usa:** la forma de `cicloDeVidaDe` (tarea 4), y `nuevoReporte`, `agregarHoja`, `cerrarReporte`, `prepararTitulo`, `prepararPildora` y `LIMITE` de `reportesPdfBase.js`.
- **Produce:**
  - `renderCicloDeVida(datos, { hoy, generado }) → Promise<Buffer>`.
  - `TEXTOS_DEL_CICLO`, congelado: `{ descripciones: { externa: { aviso, tramite, respuesta, carga }, interna: { aviso, produccion, carga } }, seMide: { … igual … }, comoSeCuenta(anio) }`.
    - Los textos, al pie de la letra de la spec (2.3 y 2.4).
    - Las ventanas, de `VENTANA_DE_LA_REGLA`.
    - La última oración de «Cómo se cuenta» solo en 2026.

- [ ] **Paso 1: la referencia del PDF de Métricas y del Informe anual.** Un test `el PDF de Métricas y el Informe anual no cambian` compara `contenidoPorHoja` de `renderMetricasDelAnio` y `renderInformeAnual` (con los datos que ya usa el archivo) contra la versión de antes de esta tarea. Se toma la referencia, se guarda en el test como un hash por hoja (`createHash('sha256')`) y debe pasar.

- [ ] **Paso 2: los tests que fallan** (`describe('Ciclo de vida del dato con el diseño del anexo')`), con datos armados en el test con `etapasDe` sobre `mapaDeLosCasos()` y con etapas sintéticas:
  - `dos hojas A4`: `todasDelTamano(pdf, HOJA_A4)` y `lineasPorHoja(pdf).length === 2`.
  - `encabezado, título, píldora y pie`:
    - la hoja 1 tiene «Gestión externa», «CICLO DE VIDA DEL DATO · 2026, EN CURSO» y «Del 01/01/2026 al 24/10/2026, con todos los ciclos»;
    - cada hoja tiene «Ciclo de vida del dato · 2026 · Hoja k de 2» y «Generado el … por Usuario Ejemplo»;
    - en un año cerrado, «… al 31/12/2026, …», y con `aviso_foto`, ese texto.
  - `un bloque por etapa`: estos textos, en orden:
    - los nombres de las etapas (4 en la hoja 1 y 3 en la 2);
    - «Estadísticas de la etapa», «Mediana», «Promedio» y «de N ciclos»;
    - los rótulos de los extremos;
    - las descripciones y cómo se mide, de `TEXTOS_DEL_CICLO`;
    - «Cómo se cuenta.».
  - `vacío`: el trámite sin notas muestra el título, el texto y el pie del vacío.
  - `un solo ciclo`: una etapa con n = 1 muestra «El único caso» una sola vez, en un recuadro a lo ancho, y no muestra «El caso más corto».
  - Foco 2: un vacío con notas y año anterior los muestra.
  - `nada se pisa` (Foco 1 y 5): `verificarDiagramacion(await diagramacion(...))` con:
    - (a) los datos de los casos;
    - (b) las cuatro etapas externas llenas, con un título de dataset de 250 caracteres en los extremos y dos notas en cada bloque;
    - (c) todas vacías.
    - En los tres, el PDF tiene 2 hojas.
  - `sin NaN, null ni undefined` y `tono`: ninguna línea contiene esas palabras ni «tardanza», «demora», «atraso», «sin respuesta», «sin entregar».

- [ ] **Paso 3.** Correr `node --test tests/reportes-pdf.test.js`. Esperado: FALLAN los nuevos y PASA el de la referencia.

- [ ] **Paso 4: implementar** `renderCicloDeVida`.
  - La diagramación es la del PDF de prueba (spec 2.1 y 2.2):
    - el índice del circuito con la sigla de cada nodo y la mediana en cada flecha;
    - los bloques que se reparten el alto hasta `LIMITE` menos la aclaración y «Cómo se cuenta»;
    - el mosaico de la mediana, el promedio y los extremos;
    - los renglones de notas.
  - Las formas anidadas se dibujan con `contorno` (que se exporta de `reportesMetricasPdf.js`), no con `roundedRect` sobre otro `roundedRect`.
  - Los textos largos se cortan con «…».
  - Nada se escribe fuera del bloque.

- [ ] **Paso 5.** Correr `node --test tests/reportes-pdf.test.js`. Esperado: PASA todo, también la referencia del Paso 1.

- [ ] **Paso 6.** Commit: `feat: el PDF del Ciclo de vida del dato`.

### Tarea 6: La ruta, el nombre y los permisos

**Archivos:**
- Modificar:
  - `controllers/reportesController.js` (`ERROR_AL_GENERAR.ciclo`, `pdfDeCicloDeVida` y `reporteCicloDeVida`)
  - `routes/index.js` (el import de `reportesController` y la ruta, en el bloque `/reportes/*`)
  - `services/reportesNombres.js` (`case 'ciclo'`)
- Test:
  - `tests/reportes.test.js` (Docker)
  - `tests/permisos.test.js`

**Interfaces:**
- **Usa:** `cicloDeVidaDe` (tarea 4) y `renderCicloDeVida` (tarea 5).
- **Produce:**
  - `pdfDeCicloDeVida(query, generado) → Promise<Buffer | null>`, con el patrón de `pdfDeParaCompletar`;
  - `nombreDelReporte('ciclo', { anio }) → 'Ciclo-de-vida-del-dato-AAAA.pdf'`.

- [ ] **Paso 1: los tests que fallan.**
  - **En `reportes.test.js`:**
    - el lector lo descarga (200, `application/pdf`);
    - el `Content-Disposition` dice `Ciclo-de-vida-del-dato-2026.pdf`;
    - `?anio=2025` da 404 con `{ success: false, error: 'No hay métricas de ese año' }`;
    - un error interno da 500 con «Error al generar el Ciclo de vida del dato».
  - **En `permisos.test.js`:** `/reportes/ciclo-de-vida` va en las listas del lector, del colaborador y de 401.
- [ ] **Paso 2.** Correr `node --test tests/reportes.test.js tests/permisos.test.js`. Esperado: FALLA.
- [ ] **Paso 3: implementar** el handler, con el patrón de `reporteParaCompletar`: un `ahoraArgentina()`, `nombreCorto` y `disposicionDeAdjunto`. Después, la ruta `router.get('/reportes/ciclo-de-vida', authMiddleware, reporteCicloDeVida)` y el `case`.
- [ ] **Paso 4.** Correr `node --test tests/reportes.test.js tests/permisos.test.js`. Esperado: PASA.
- [ ] **Paso 5.** Commit: `feat: GET /api/reportes/ciclo-de-vida`.

### Tarea 7: La tarjeta en la pestaña Reportes

**Archivos:**
- Modificar:
  - `public/js/reportes.js`
  - `public/reportes.html` (solo el `?v=` de `reportes.js`)
- Test:
  - `tests/reportes-frontend.test.js`
  - `tests/paginas.test.js` (`VERSION_REPORTES`)

**Interfaces:**
- **Usa:** la ruta y el nombre (tarea 6).
- **Produce:** la clave `'ciclo'` en `GRUPOS_DE_REPORTES` (segunda en `presentar`, que pasa a `'rp-grilla g4'`), `ICONOS_DE_REPORTES.ciclo` (Lucide `route`), `REPORTES_POR_DEFECTO.ciclo = null`, `htmlDeTarjetaDeReportes`, `pedidoDeReporte`, la copia de `nombreDelReporte`, `conReporteElegido`, `TARJETAS_CON_ANIO` y `CONTROLES_DE_REPORTES['rp-ciclo']`.

- [ ] **Paso 1: los tests que fallan.**
  - «ocho tarjetas en dos grupos»:
    - `presentar` es `['metricas', 'ciclo', 'informe', 'estado']`, con `rp-grilla g4`;
    - la tarjeta dice «Ciclo de vida del dato», el texto de la spec 4 y «2 hojas: la gestión externa y la interna».
  - `pedidoDeReporte('ciclo', …)`:
    - con el año en curso, `{ ruta: '/reportes/ciclo-de-vida', nombre: 'Ciclo-de-vida-del-dato-2026.pdf' }`;
    - con 2026 cerrado y 2027 en curso, `ruta: '/reportes/ciclo-de-vida?anio=2026'`.
  - `conReporteElegido(datos, 'ciclo', '2026')` guarda el año.
  - La paridad de `nombreDelReporte` con el servidor suma `'ciclo'`.
  - Sin NaN, null ni undefined con datos vacíos.
- [ ] **Paso 2.** Correr `node --test tests/reportes-frontend.test.js tests/paginas.test.js`. Esperado: FALLA.
- [ ] **Paso 3: implementar** la tarjeta: el selector de año con `htmlDeSelectorDeAnios('rp-ciclo-anio', 'rp-ciclo', lista, anio, true)` y la descarga como las demás. Actualizar los comentarios que dicen «siete» y subir `VERSION_REPORTES` en el test y en `reportes.html`.
- [ ] **Paso 4.** Correr `node --test tests/reportes-frontend.test.js tests/paginas.test.js`. Esperado: PASA.
- [ ] **Paso 5: verificar en el navegador.**
  - Levantar la rama en su puerto (3031, con la base `rpad_rama_ciclo_de_vida`).
  - Entrar con una cuenta de prueba de esa base, creada con `npm run setup-admin` y guardada en el scratchpad, nunca en el chat.
  - Abrir Reportes, descargar el PDF y mirar las dos hojas contra el PDF de prueba.
  - Probarlo a 375 px (dos columnas) y con el teclado.
- [ ] **Paso 6.** Commit: `feat: la tarjeta «Ciclo de vida del dato» en Reportes`.

### Tarea 8: Documentación y kit

**Archivos:**
- Modificar:
  - `CLAUDE.md`: la sección «Ciclo de vida del dato»; en «Métricas y Reportes», «ocho tarjetas» y la lista de los PDF; la parte `etapas` de la foto y el plazo; la convención de `reportes.js`.
  - `README.md`: los reportes y el Changelog.
  - La spec: el estado a «implementada».
- Crear: `C:\Users\Mariano\Desktop\RPAD-deploy-ciclo-de-vida-del-dato\`, con:
  - `PASOS.txt` en ASCII: sin SQL; subir los archivos de la lista; Restart; antes del 10/01/2027; cómo probar;
  - `archivos/`, con las rutas del repo;
  - `vuelta-atras/`, con los archivos anteriores y su `PASOS.txt`.

- [ ] **Paso 1.** Escribir la documentación.
- [ ] **Paso 2.** Armar el kit con la lista de `git diff --name-only main...HEAD` (sin `docs/` ni `tests/`).
- [ ] **Paso 3.** Correr `npm test` completo. Esperado: todo verde, con más tests que la línea de base.
- [ ] **Paso 4.** Commit: `docs: Ciclo de vida del dato en CLAUDE.md, README y la spec`.

### Tarea 9: Revisión final, merge y push

- [ ] **Paso 1.** Revisión de toda la rama con un revisor Opus fresco. Mira:
  - la spec contra el código;
  - el tono;
  - que nada se copie de las reglas;
  - las paridades;
  - que el PDF de Métricas y el Informe anual no cambien.

  Corregir lo que encuentre y volver a correr `npm test`.
- [ ] **Paso 2.** Traer main otra vez si cambió. Hacer el merge en main con `--no-ff` y el mensaje del estilo de los anteriores, y el `git push` (autorizado por el usuario para cada sesión de la cola).
- [ ] **Paso 3.** Avisarle a la sesión que abrió esta con el hash del merge. Actualizar la nota de la carpeta compartida y la memoria del proyecto.
- [ ] **Paso 4.** Quitar el junction de `node_modules` antes de cerrar el worktree: `cmd //c "rmdir node_modules"`, verificar que ya no existe y recién ahí `git worktree remove`.

## Diferencias encontradas

Releído el 25/10/2026, con main en 2e48142 (el merge de Configuración) traído a la rama en 199e8e0.

**Lo que cambió en main**
- `public/reportes.html`: solo el menú de Administración (Gestión de Datasets, Correos y Configuración). Las páginas con carcasa ahora son 13.
- `routes/index.js`: la línea 2 (`sesionOpcional`) y las rutas públicas de datasets y de áreas. El bloque `/reportes/*` no cambió.
- `GET /api/areas`: devuelve los datos de contacto solo a administración. `reportes.js` usa nada más el `id` y el `nombre`.
- `CLAUDE.md` y `README.md`: la sección «Configuración» y las cuentas de páginas.

**Lo que no cambió**
- `services/metricasReglas.js`, `metricasFoto.js`, `metricasCinta.js`, `reportesMetricasPdf.js` y `reportesPdfBase.js`.
- `controllers/metricasController.js` y `reportesController.js`.
- `public/js/reportes.js`.
- `tests/permisos.test.js`, `reportes-frontend.test.js` y `reportes-pdf.test.js`.
- `VERSION_REPORTES` sigue en `'20261203'`.

**Conclusión:** las tareas 2 a 9 no cambian. Proyectos implementa en paralelo y va a subir `VERSION_REPORTES`. Esta rama usa `'20261206'` de forma provisoria y la ajusta al traer main después del merge de Proyectos.
