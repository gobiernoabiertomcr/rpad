# Feriados en Métricas, el Ciclo de vida, la foto y la Agenda (tanda 2): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Métricas, el Ciclo de vida del dato, la foto del 31/12, el Informe anual y la Agenda de pedidos cuenten los días hábiles con el calendario único (los 9 fijos más la tabla `feriados`), el mismo de las corridas desde la tanda 1. La foto guarda los feriados con los que se calculó y nunca se saca con los 9 fijos por una falla.

**Architecture:**
- Las reglas puras (`services/metricasReglas.js` y `services/reportesAgenda.js`) dejan de importar las derivadas fijas y reciben `calendario` en sus opciones (por defecto, `CALENDARIO_FIJO`). Adentro de Métricas viaja en el `ctx` de `contextoDe`.
- Los puntos de entrada (Métricas en vivo, el Ciclo de vida, la Agenda y la foto) leen el calendario una sola vez con `leerCalendario` y lo exigen con la tabla (`exigirLaTabla`): si cayó a los 9 fijos, tiran (500 en la API; la foto no se saca). Un año con foto no lee la tabla.
- La foto guarda `feriados`, la lista de los días que la tabla sacó de los hábiles, y `etapasDeLaFoto` rearma con ella el calendario cuando recalcula las etapas de una foto sin `etapas`.

**Tech Stack:** Node 22, ES Modules, Express 4 y mysql2/promise sobre MariaDB. Tests con `node:test`: puros, de la página en un `vm` y de integración sobre Docker con una base propia.

**Estado:** aprobado por el usuario el 28/10/2026. Se implementa con subagentes de Opus después de traer el main con «licencia anulada» (Task 0).

**Spec:** `docs/superpowers/specs/2026-10-27-feriados-en-notas-design.md`, aprobada el 27/10/2026. Este plan es su **tanda 2**: secciones 2 (lo de la tanda 2), 5, 6 (los textos de Métricas, el Ciclo de vida y el aviso azul), 7 (los tests de la tanda 2) y 9. La tanda 1 está en main desde ad0de02 (plan `docs/superpowers/plans/2026-10-27-feriados-en-notas-tanda-1.md`).
- El mapa del código, con archivo y línea de ad0de02, está en los informes de los tres agentes del 28/10/2026, resumidos acá en cada tarea. Las líneas pueden correrse con lo que traiga main en la Task 0: buscar por el nombre.

## Global Constraints

- **Plazo:** en producción **antes del 10/01/2027**, el día en que la corrida de las 8:15 saca la foto de 2026 (spec, sección 5). Si llega tarde, la foto de 2026 queda con los 9 fijos y la de 2027 con la tabla, y la bajada nueva («sin feriados ni días no laborables») sale igual en la pestaña y en el Informe anual de 2026, aunque esa foto se haya sacado con los 9 fijos.
- **No cambian:**
  - `esDiaHabil`, `FERIADOS_FIJOS`, `CALENDARIO_FIJO`, `calendarioCon`, `leerCalendario` y lo demás de la tanda 1;
  - `VENTANA_DIAS` y `VENTANA_DE_LA_REGLA` (40 y 60 días corridos);
  - `VERSION_DE_LA_FOTO` (sigue en 1), `PARTES_DE_LA_FOTO`, `datosLeidos` y `DIA_DE_LA_FOTO`;
  - las fotos ya guardadas (en producción todavía no hay ninguna) y lo que imprime el Informe anual, salvo el texto de la bajada;
  - `services/metricasCinta.js` (dibuja las cifras que ya trae la vista: no cuenta días hábiles);
  - el texto «(si ese día no es hábil, el siguiente)» de la Agenda (`services/reportesAgendaPdf.js`): sigue siendo cierto.
- **Un solo nombre para el parámetro:** `calendario`, el objeto de la tanda 1 (`{ esDiaHabil, proximoDiaHabil, …, diasHabilesTranscurridos, …, origen, error }`). En las opciones de `casosDe`, `vistaDe`, `etapasDe`, `agendaDe` y `datosDeLaFoto` va como clave; en las funciones posicionales, como último parámetro (`duracion(desde, hasta, dias, calendario)`, `fechaDeAvisoPorRegla(vencimiento, gestion, calendario)`).
- **Valores por defecto:**
  - las reglas puras exportadas: `CALENDARIO_FIJO` si no lo reciben, también con `null`. Por eso es `calendario ?? CALENDARIO_FIJO` en el cuerpo (o en `contextoDe`), nunca un parámetro por defecto (`= CALENDARIO_FIJO` no cubre `null`). Así los tests de hoy pasan sin tocarlos;
  - las internas (`diaDelAvisoDe`, `casosDelDataset` de Métricas y `filaDe` de la Agenda): sin valor por defecto (un olvido tira).
- **Los puntos de entrada leen el calendario y lo exigen con la tabla:** `exigirLaTabla(await leerCalendario())` (Task 2). La caída se detecta por `calendario.error !== null`, nunca por `origen`.
  - `metricasConOpciones`, solo en la rama en vivo; `cicloDeVidaDe`, una sola vez para los dos años, y solo si alguno va en vivo; `reporteAgenda`, una vez; `sacarFotoSiCorresponde`, solo si toca sacar una foto, con el `calendario` de la corrida (`calendario ?? await leerCalendario()`).
  - Un año con foto no lee la tabla (el Informe anual no la lee nunca).
  - Si la tabla no se puede leer: Métricas en vivo, el Ciclo de vida, la Agenda y «Datos para completar» (vía `metricasDe`) responden el 500 de siempre, con su mensaje fijo; la foto no se saca y se reintenta en la corrida siguiente (spec, sección 2).
- **Una sola lectura de la tabla por pedido o corrida:** la corrida de las 8:15 le pasa a la foto el calendario que ya leyó (el email de vencimiento de Mi espacio sigue leyendo los feriados por su cuenta, como en la tanda 1).
- **Textos, al pie de la letra** (spec, sección 6):
  - la bajada de los días hábiles (`public/reportes.html`, `BAJADA_DE_LOS_DIAS.habiles` de `public/js/reportes.js` y `TEXTOS_DE_LA_PESTANA.bajada.habiles` de `services/reportesMetricasPdf.js`, que imprime también el Informe anual): «Los días son hábiles: de lunes a viernes, sin feriados ni días no laborables.»;
  - el comienzo de `COMO_SE_CUENTA` (`services/reportesCicloDeVidaPdf.js`): «Días hábiles: de lunes a viernes, sin feriados ni días no laborables; entre paréntesis, los corridos. …» (el resto, igual);
  - el aviso azul de la pestaña Feriados (`public/configuracion.html`, `#feriados-aviso`): «Estos feriados, junto con los 9 fijos, son los días no hábiles de todo el sistema: esos días no sale ninguna nota ni ningún email automático, y no cuentan como días hábiles en las licencias, Mi espacio ni Métricas.»;
  - `MENSAJE_METRICAS_SIN_FERIADOS` (nuevo, mío): `'no se pudieron leer los feriados de Configuración → Feriados'`, en minúscula porque la corrida lo anota detrás de «No se pudo sacar la foto del año: » (Correos → Estado dice «No se pudo sacar la foto del año: no se pudieron leer los feriados de Configuración → Feriados»). En la API no se ve: el 500 lleva el mensaje fijo de cada reporte.
- **Versiones:** `public/js/reportes.js` cambia, así que `VERSION_REPORTES` pasa de `'20261207'` a **`'20261208'`** (en `tests/paginas.test.js` y en el `?v=` de `public/reportes.html`). No más alto: `tests/paginas.test.js` exige `VERSION_FERIADOS` (`'20261209'`) mayor que `VERSION_REPORTES`. El aviso azul es HTML: no sube ninguna versión.
- **No romper nada:** `npm test` completo antes y después de cada tarea, con el candado `C:\Users\Mariano\.rpad-suite.lock` (nunca borrar uno ajeno) y `--test-concurrency=1`; nunca dos suites a la vez. Todo test que use Docker, también uno suelto, se corre con el candado tomado.
- **Todos los subagentes van con Opus.**
- **Ningún email real** (en local, Mailpit). **Nunca `/api/cron/*` desde los tests:** se llama al controlador con un `res` falso.
- **La base `datospublicos_mcr_rpad` no se escribe.** La Task 6 solo la lee.
- **CLAUDE.md:** ES Modules, consultas parametrizadas, español en el código, sin emojis, repositorio público (sin nombres reales ni datos de producción en los tests: «Dataset A de prueba»).
- **Sin SQL, sin tablas, sin cron nuevo y sin Run NPM Install.**

## Review Focus

1. **La foto del 10/01/2027 con la tabla sin leer.** No se guarda nada, Correos → Estado lo dice en la última corrida, la corrida responde 207 y la del día siguiente la saca con la tabla. Test en la Task 2.
2. **La corrida del día de la foto lee la tabla una sola vez:** la foto usa el calendario de la corrida, no vuelve a leer. Test en la Task 2 (con la tabla renombrada, una sola lectura fallida).
3. **Una foto sin `etapas`.** El código de producción ya guarda `etapas`: una foto sin ellas sale solo si `etapasParaLaFoto` falló al sacarla. `etapasDeLaFoto` la recalcula con sus `feriados`; sin `feriados` (una foto sacada con el código anterior, si esta tanda llega tarde), con los 9 fijos, como se sacó; con `feriados` que no son una lista de fechas, tira «La foto de AAAA no se puede leer». Test en la Task 2, sobre la base con la precarga (en la de `metricas-foto` la tabla está vacía y los tres casos darían lo mismo).
4. **Un año con foto se lee sin la tabla:** con la tabla renombrada, Métricas, el Ciclo de vida y el Informe anual de un año con foto responden 200 y no leen la tabla. Test en la Task 3.
5. **El Ciclo de vida con los dos años en vivo** (el 05/01/2027 pidiendo 2027: 2026 todavía no tiene foto) lee la tabla una sola vez. Test en la Task 3 (cuenta las consultas a `feriados_no_rige`, que `filasDeFeriados` hace solo si hay filas: funciona porque la base tiene la precarga, y el test lo dice).

---

### Task 0: Preparación

Sin código.

- [ ] **Step 1: Traer main.** `git merge main` en la rama `claude/feriados-en-metricas` (creada el 28/10/2026 desde main ad0de02), con el main que indique la coordinadora: antes, la sesión «Mi espacio: licencia anulada» (rama `claude/mi-espacio-licencia-anulada-84cd6e`) tiene que estar mergeada. Toca Mi espacio y Configuración → Licencias, no Métricas; puede chocar en `CLAUDE.md` y `README.md`. Si cambió algún nombre que usa este plan, ajustar el plan en su propio commit antes de seguir.
- [ ] **Step 2: La línea de base.** Docker arriba (`docker ps`: `rpad-db` y Mailpit). `npm test` completo con el candado: anotar cuántos pasan, cuántos fallan y cuáles.
- [ ] **Step 3: Confirmar los nombres.** Que existan con esta forma:
  - en `services/metricasReglas.js`: `duracion(desde, hasta, dias)`, `diaDelAvisoDe`, `esperabaElAviso`, `casoDelCiclo`, `casosDelDataset(fuentes, hoy)`, `casosDe`, `contextoDe`, `hechosDe`, `medir`, `resultadosDe`, `filaDe`, `vistaDe`, `casosQueTocanElAnio` y `etapasDe` (con su `contexto = (dias) => contextoDe({ … })`);
  - en `services/reportesAgenda.js`: `fechaDeAvisoPorRegla(vencimiento, gestion)`, `filaDe(d, hoy, vencido)` y `agendaDe(datasets, { hoy, meses, gestion } = {})`;
  - en `services/metricasFoto.js`: `etapasParaLaFoto`, `datosDeLaFoto(fuentesPorDataset, { anio, generada })`, `sacarFotoSiCorresponde({ hoy } = {})`, `leerFoto` y `etapasDeLaFoto({ anio, datos })`;
  - en `controllers/metricasController.js`: `enVivo`, `metricasConOpciones`, `etapasDelPeriodo(periodo, fuentes)` y `cicloDeVidaDe`; en `controllers/reportesController.js`: `reporteAgenda` y `ERROR_AL_GENERAR`; en `controllers/notificacionesController.js`, la llamada `sacarFotoSiCorresponde({ hoy })`;
  - en `services/feriadosReglas.js`: `calendarioCon`, `FECHA_MINIMA_FERIADO` y los dos `MENSAJE_…_SIN_FERIADOS`; en `services/feriadosDatos.js`: `leerCalendario` y `filasDeFeriados` (la segunda consulta lee `feriados_no_rige`);
  - en `tests/calendario-unico.test.js`: `SIEMPRE` y `HASTA_LA_TANDA_2`.
- [ ] **Step 4: La versión de partida.** `VERSION_REPORTES` en `'20261207'` y `VERSION_FERIADOS` en `'20261209'` (si main los subió, la nueva de reportes es la de main más un día y menor que la de feriados; si no se puede, cambiar la comparación de `tests/paginas.test.js` contra el literal `'20261207'` y anotarlo).
- [x] **Step 5: El pre-flight.** **Hecho el 28/10/2026 contra ad0de02:** sin bloqueantes, 2 importantes y 13 menores, todos aplicados a este plan. Todos los números que fija el plan se verificaron con copias de las reglas cambiadas como dice la Task 1, y con esas copias pasan los 348 tests puros de Métricas y la Agenda. El informe está en la carpeta de notas de la coordinadora, `feriados-en-metricas-preflight.md`. Después del Step 1, repetirlo solo para lo que main haya tocado de los archivos de este plan.

### Task 1: Las reglas de Métricas y de la Agenda con el calendario

**Files:**
- Modify: `services/metricasReglas.js` (el import de L13-15; `duracion` L82-87; `diaDelAvisoDe` L171; `casoDelCiclo` L213; `casosDelDataset` L238-253; `casosDe` L285-289; `contextoDe` L330-346; `hechosDe` L368; `medir` L399; `resultadosDe` L585; `filaDe` L662; `etapasDe` L967; los comentarios de L1-12 y L165-170)
- Modify: `services/reportesAgenda.js` (L13, L39-46, L57-72, L88-103)
- Test: `tests/metricas-reglas.test.js`, `tests/reportes-agenda.test.js`, `tests/calendario-unico.test.js`

**Interfaces:**
- Produces:
  - `duracion(desde, hasta, dias, calendario) → number | null` (en hábiles, `(calendario ?? CALENDARIO_FIJO).diasHabilesTranscurridos`);
  - `casosDe(fuentesPorDataset, { hoy, calendario })`, `vistaDe(casos, { anio, al, estadistico, dias, sin, calendario })` y `etapasDe(casos, { anio, al, calendario })`, cada una con `calendario ?? CALENDARIO_FIJO`. `casosQueTocanElAnio` no cambia (su resultado no depende del calendario);
  - `fechaDeAvisoPorRegla(vencimiento, gestion, calendario)` (`(calendario ?? CALENDARIO_FIJO).proximoDiaHabil`) y `agendaDe(datasets, { hoy, meses, gestion, calendario })` (`calendario ?? CALENDARIO_FIJO`).
- Internas: `contextoDe` suma `calendario: o.calendario ?? CALENDARIO_FIJO` al `ctx`, y `hechosDe`, `medir`, `resultadosDe` y `filaDe` usan `ctx.calendario`; `etapasDe` lo pasa a mano a su `contexto(dias)` (no le pasa las opciones enteras); `casosDelDataset(fuentes, hoy, calendario)` lo pone en `datos.calendario` y `casoDelCiclo` lo lee de ahí (no cambia de firma); `diaDelAvisoDe(fechaRegla, calendario)`; `filaDe(d, hoy, vencido, calendario)` de la Agenda.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **`tests/metricas-reglas.test.js`**, un `describe` nuevo, «con los feriados de la tabla (feriados en todo el sistema, tanda 2)», con `const TABLA = calendarioCon(FILAS_PRECARGA)` (de `services/feriadosReglas.js` y `tests/fixtures/feriados-precarga.js`) y los ayudantes del archivo (`casosReales`, `vista`, `cifraDel`, `tramoDe`, `caso`, `etapasDe`):
    - `duracion('2025-12-22', '2026-01-31', 'habiles', TABLA) === 26` (con los fijos, 27: el 02/01/2026 es asueto); en `'corridos'`, lo mismo con los dos.
    - Con los casos de prueba al `AL` del archivo (24/10/2026), casos y vista con `TABLA`: el aviso anticipado externo da mediana 26 (fijos, 27), el interno 40 (42), y `resultados.a_tiempo.despues.texto` dice 25 donde con los fijos dice 27 (escribir el texto completo que da con los fijos, cambiando solo el número). Sin `calendario`, los tres siguen como hoy.
    - Al 31/12/2026, casos y vista con `TABLA`: el en curso de la producción interna dice «hace 237 días hábiles» (fijos, 253: los días hábiles de 2026).
    - Lo que no cambia, al `AL` y al 31/12, entre los fijos y `TABLA`: `casosDe` entero (`deepEqual`), `resultados.cobertura`, `resultados.reiteraciones`, `para_completar` y la vista entera en `dias: 'corridos'`.
    - **La ventana del feriado:** un caso externo armado como `delMes` del test de L1182, pero de 2026 (venc `'2026-12-31'`, `fecha_regla` `'2026-11-21'`, `inicio` y `alta` `'2026-01-15'`, sin aviso, `motivo_sin_aviso: 'sin-aviso'`), con `vistaDe(…, { anio: 2026, al, calendario })`: `resultados.cobertura.total` al `'2026-11-24'` es 0 con `TABLA` (1 con los fijos: para ellos el aviso salía el 23/11) y al `'2026-11-25'`, 1 con los dos.
    - En `casosDe`, el `motivo_sin_aviso` de un dataset externo con vencimiento el 31/12/2026, sin avisos, al `hoy: '2026-11-24'`: null con `TABLA` y `'sin-aviso'` con los fijos (armarlo con los ayudantes de `tests/metricas-casos.js`, como los demás casos sintéticos del archivo).
    - **La paridad con la Agenda con la tabla:** el bucle de L1203-1216 repetido para 2026 y 2027 pasando `TABLA` a `vistaDe` y a `fechaDeAvisoPorRegla`.
    - `etapasDe(casos, { anio: 2026, al: AL, calendario: TABLA })`: la etapa del aviso externo, `habiles.mediana === 26` y `textos.indice === '26'`.
  - **`tests/reportes-agenda.test.js`** (importar `calendarioCon` y `FILAS_PRECARGA`):
    - `fechaDeAvisoPorRegla('2026-12-31', 'interna', TABLA) === '2026-11-03'` y `('2026-12-31', 'externa', TABLA) === '2026-11-24'`; sin calendario, siguen `'2026-11-02'` y `'2026-11-23'`;
    - el bucle de paridad de L170-177, también con `TABLA` contra `TABLA.proximoDiaHabil`;
    - `agendaDe(…, { hoy: HOY, calendario: TABLA })`: «Dependencias municipales» con `aviso_aprox` `'2026-11-03'` (sin calendario, `'2026-11-02'`, como hoy).
  - **`tests/calendario-unico.test.js`:** borrar `HASTA_LA_TANDA_2` y su comentario (L20-21); las excepciones son solo `SIEMPRE`; el segundo `it` pasa a llamarse «las excepciones existen» y queda solo con su primer `for`.
- [ ] **Step 2: Correr los tests y ver que fallan.** `node --test --test-concurrency=1 tests/metricas-reglas.test.js tests/reportes-agenda.test.js tests/calendario-unico.test.js`: FAIL (el calendario se ignora y los dos archivos todavía importan derivadas fijas).
- [ ] **Step 3: Implementar.**
  - `metricasReglas.js`: sacar `diasHabilesTranscurridos` y `proximoDiaHabil` del import e importar `CALENDARIO_FIJO`; las firmas de Interfaces. La cabecera (L12) suma que un `calendario` mal armado tira; el comentario de `diaDelAvisoDe` (L165-170) dice «con el calendario que recibe (el de la Agenda y el del envío)».
  - `reportesAgenda.js`: lo mismo (`proximoDiaHabil` sale del import; el comentario de L39-42 dice «con el calendario»). La cabecera sigue diciendo que es puro.
  - Ningún otro archivo cambia en esta tarea: sin `calendario`, todo da lo mismo que hoy.
- [ ] **Step 4: Correr los tests y ver que pasan.** Los tres de arriba, más `tests/metricas-cinta.test.js`, `tests/metricas-opciones.test.js`, `tests/reportes-pdf.test.js` y `tests/reportes-frontend.test.js`: PASS, sin tocar estos cuatro.
- [ ] **Step 5: Commit.**

  `git add services/metricasReglas.js services/reportesAgenda.js tests/metricas-reglas.test.js tests/reportes-agenda.test.js tests/calendario-unico.test.js && git commit -m "feat(metricas): las reglas de Métricas y de la Agenda cuentan con el calendario que reciben" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`
- [ ] **Step 6: La suite completa,** con el candado: 0 fallas nuevas contra la Task 0.

### Task 2: La foto con sus feriados

**Files:**
- Modify: `services/feriadosReglas.js` (agregados, después de `calendarioCon`)
- Modify: `services/metricasFoto.js` (`datosDeLaFoto` L65-90, `sacarFotoSiCorresponde` L97-107, `etapasDeLaFoto` L146-150 y sus comentarios)
- Modify: `controllers/notificacionesController.js` (la llamada a la foto, L131-139, y su comentario)
- Test: `tests/feriados-reglas.test.js`, `tests/metricas-foto.test.js`
- Create: `tests/feriados-en-metricas.test.js`

**Interfaces:**
- Consumes: `datosDeLaFoto` pasa `calendario` a `casosDe`, a `vistaDe` y a `etapasParaLaFoto` (Task 1).
- Produces (en `feriadosReglas.js`, puras):
  - `MENSAJE_METRICAS_SIN_FERIADOS` (Global Constraints);
  - `exigirLaTabla(calendario) → calendario`: el mismo objeto si `calendario.error === null`; si no, tira `new Error(MENSAJE_METRICAS_SIN_FERIADOS)`;
  - `feriadosDelCalendario(calendario, desde, hasta) → string[]`: los días de `desde` a `hasta` (los dos incluidos), en orden, que son hábiles con los 9 fijos (`esDiaHabil`) y no con `calendario`. Con fechas que no sirven o `desde > hasta`, `[]`. Recorre `diasEntre(desde, hasta) + 1` días con `sumarDias`, como `diasHabilesDe` (comparar el texto de las fechas no termina después del `'9999-12-31'`);
  - `calendarioDeFechas(fechas) → calendario`: `calendarioCon(fechas.map((fecha) => ({ fecha, se_repite: 0, activo: 1 })))` (una fila suelta por fecha: con la lista de `feriadosDelCalendario` da lo mismo que el calendario original en ese rango).
- Produces (en `metricasFoto.js`):
  - `datosDeLaFoto(fuentesPorDataset, { anio, generada, calendario = CALENDARIO_FIJO })`, con la clave nueva `feriados: feriadosDelCalendario(calendario, FECHA_MINIMA_FERIADO, \`${anio + 1}-12-31\`)` entre `etapas` y `generada` (hasta el año siguiente: las filas de los casos cuentan días hasta vencimientos del año siguiente). Con `CALENDARIO_FIJO`, `[]`;
  - `sacarFotoSiCorresponde({ hoy = hoyArgentina(), calendario } = {})`: solo si toca sacar una (`toca.falta`), `exigirLaTabla(calendario ?? await leerCalendario())`, antes de pedir las fuentes, y se lo pasa a `datosDeLaFoto`;
  - `etapasDeLaFoto({ anio, datos })`: si recalcula (sin `etapas`), con el calendario de la foto: sin `feriados`, `CALENDARIO_FIJO`; con una lista de fechas (`esFechaIso` cada una), `calendarioDeFechas(datos.feriados)`; con otra cosa, tira «La foto de AAAA no se puede leer». Con `etapas` guardadas, no mira `feriados` (Ruling 16).
- La corrida de las 8:15 llama `sacarFotoSiCorresponde({ hoy, calendario })` con el calendario que ya leyó.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **`tests/feriados-reglas.test.js`**, con `TABLA = calendarioCon(FILAS_PRECARGA)`:
    - `exigirLaTabla(CALENDARIO_FIJO) === CALENDARIO_FIJO` y `exigirLaTabla(TABLA) === TABLA`; `exigirLaTabla(calendarioCon([], { origen: 'fijos', error: 'falla' }))` tira con `MENSAJE_METRICAS_SIN_FERIADOS`.
    - `feriadosDelCalendario(CALENDARIO_FIJO, '2025-01-01', '2027-12-31')` es `[]`; con `TABLA`, estas 28, en este orden: `['2026-01-02','2026-02-16','2026-02-17','2026-02-23','2026-03-23','2026-04-03','2026-04-30','2026-06-15','2026-07-10','2026-07-28','2026-08-17','2026-10-12','2026-11-02','2026-11-09','2026-11-23','2026-12-07','2027-02-08','2027-02-09','2027-02-23','2027-03-25','2027-03-26','2027-06-21','2027-07-28','2027-08-16','2027-10-11','2027-11-01','2027-11-08','2027-12-13']`; `desde > hasta` y una fecha que no es una fecha dan `[]`.
    - `calendarioDeFechas(esa lista).esDiaHabil(d) === TABLA.esDiaHabil(d)` en cada día del 2025-01-01 al 2027-12-31, y `diasHabilesTranscurridos('2025-12-31', '2026-12-31')` da 237 en los dos; `calendarioDeFechas([])` da lo mismo que `CALENDARIO_FIJO` en ese rango.
  - **`tests/metricas-foto.test.js`** (su base tiene la tabla vacía):
    - las claves exactas de la foto suman `'feriados'`: en L170, entre `'etapas'` y `'generada'`; en L450, entre `'areas'` y `'generada'`. La foto sacada tiene `feriados: []`;
    - «una foto sin etapas se lee igual» (L387-416) sigue siendo una foto del código anterior: en L397 saca también `feriados` (`const { etapas, feriados, ...sinEtapas } = nueva.datos;`) y la L400 no cambia;
    - `etapasDeLaFoto` de esa foto sin `etapas` y con `feriados: ['2026-11-02']`: da lo mismo que `etapasDe(casos, { anio: 2026, al: AL, calendario: calendarioDeFechas(['2026-11-02']) })`, y la etapa del aviso externo (el dataset A de `prepararElAnio`: aviso el 21/10, vence el 30/11) cuenta 27 días hábiles donde sin `feriados` cuenta 28;
    - con `feriados: 'x'` o `feriados: ['no es una fecha']` (y sin `etapas`), tira «La foto de 2026 no se puede leer»; con `etapas` guardadas, unos `feriados` raros no importan.
  - **`tests/feriados-en-metricas.test.js`** (nuevo), con su base `rpad_test_feriados_en_metricas`, que carga `database/updates/migracion-feriados-datos.sql` tal cual con `correrSqlEnBaseDePrueba` (como `tests/feriados-en-notas.test.js`, L19-20). Copia (es la costumbre del repo), cada uno con un comentario «copiado de …»:
    - de `tests/metricas-foto.test.js`: los ayudantes (`instante`, `fijarAlta`, `aprobado`, `actualizacion`, `emailEnviado`, `prepararElAnio`, `corridaDiaria` y `ultimaCorrida`), sus ganchos (el usuario del `before`; en cada test, `DELETE FROM metricas_fotos` y lo de `notas_dgmit`) y sus imports dinámicos de lo que usa el pool, después de crear la base;
    - de `tests/feriados-en-notas.test.js`: `conLaTablaRenombrada` y `lecturasFallidas`. Su `beforeEach` no: borra `usuarios` y rompe `aprobado`.

    Un `describe` «la foto», con `prepararElAnio()`:
    - `sacarFotoSiCorresponde({ hoy: '2027-01-10' })` (sin calendario: lo lee de la tabla) la saca; `datos.feriados` es la lista de 28 de arriba; la etapa del aviso externo, `habiles.mediana === 25`, y la del interno, `38` (con los 9 fijos serían 28 y 42).
    - **Review Focus 3:** con esa foto, `etapasDeLaFoto` sin `etapas` da 25 y 38 (con sus `feriados`); sin `etapas` ni `feriados`, 28 y 42 (los 9 fijos, como se habría sacado con el código anterior).
    - **Review Focus 1 y 2:** `conLaTablaRenombrada(() => corridaDiaria('2027-01-10T11:15:00Z'))`: responde 207; `data.errores` tiene `{ tipo: 'foto-del-anio', error: MENSAJE_METRICAS_SIN_FERIADOS }`; `metricas_fotos` sigue vacía; `lecturasFallidas(consola) === 1` (con `console.error` simulado, como el test de la tanda 1); el texto de la última corrida incluye «No se pudo sacar la foto del año: no se pudieron leer los feriados de Configuración → Feriados». Después, `corridaDiaria('2027-01-11T11:15:00Z')` con la tabla saca la foto de 2026, con los 28 feriados.
    - `sacarFotoSiCorresponde({ hoy: '2027-01-10', calendario: calendarioCon([], { origen: 'fijos', error: 'falla' }) })` tira con `MENSAJE_METRICAS_SIN_FERIADOS` y no guarda nada; un día que no toca sacar ninguna (`'2027-01-09'`) no tira aunque el calendario tenga error (no lo mira).
- [ ] **Step 2: Correr los tests y ver que fallan.** `node --test --test-concurrency=1 tests/feriados-reglas.test.js` (puro) y, con el candado, `tests/metricas-foto.test.js tests/feriados-en-metricas.test.js`: FAIL.
- [ ] **Step 3: Implementar** las firmas de Interfaces.
  - En `notificacionesController.js`, solo la llamada (`sacarFotoSiCorresponde({ hoy, calendario })`) y su comentario: «con el calendario de la corrida; si cayó a los 9 fijos, la foto no se saca y se reintenta en la corrida siguiente».
  - El comentario de la cabecera de `metricasFoto.js` y el de `PARTES_DE_LA_FOTO` dicen que `feriados` es opcional como `etapas`.
  - La cabecera de `feriadosReglas.js` suma las tres funciones y que `exigirLaTabla` tira a propósito (una excepción a «ninguna tira», como las derivadas del calendario).
  - Para la revisión: que `datosDeLaFoto` le pase el calendario también a `casosDe` (si no, no cambia nada de lo que se ve hoy y ningún test lo nota).
- [ ] **Step 4: Correr los tests y ver que pasan.** Los de los Steps 1 y 2, más `tests/metricas-api.test.js` y `tests/feriados-en-notas.test.js` (la corrida del 02/11 sigue con una sola lectura: ese día no toca la foto), con el candado: PASS.
- [ ] **Step 5: Commit.**

  `git add services/feriadosReglas.js services/metricasFoto.js controllers/notificacionesController.js tests/feriados-reglas.test.js tests/metricas-foto.test.js tests/feriados-en-metricas.test.js && git commit -m "feat(metricas): la foto del 31/12 cuenta con la tabla, guarda sus feriados y no se saca sin ella" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`
- [ ] **Step 6: La suite completa,** con el candado: 0 fallas nuevas contra la Task 0.

### Task 3: Métricas, el Ciclo de vida y la Agenda leen el calendario

**Files:**
- Modify: `controllers/metricasController.js` (`enVivo` L35-49, `metricasConOpciones` L84-96, `etapasDelPeriodo` L102-106, `cicloDeVidaDe` L119-136 y sus comentarios)
- Modify: `controllers/reportesController.js` (`reporteAgenda` L252-286)
- Test: `tests/feriados-en-metricas.test.js`

**Interfaces:**
- Consumes: `exigirLaTabla` y `MENSAJE_METRICAS_SIN_FERIADOS` (Task 2), `leerCalendario` (tanda 1), las opciones de la Task 1.
- Produces:
  - `enVivo(fuentesPorDataset, { anio, al, estadistico, dias, sin, calendario })`, que pasa `calendario` a `casosDe` y a `vistaDe` (`contextoDelAnio`, `trabajoDelAnio` y `areasYTemas` no lo necesitan);
  - `metricasConOpciones`: en la rama en vivo, `const calendario = exigirLaTabla(await leerCalendario())`, después de `leerAniosConFoto` y `opcionesDeMetricas` y antes de `fuentesDe(null)` (ningún test protege este orden: es para que un año con foto no lea la tabla);
  - `etapasDelPeriodo(periodo, fuentes, pedirCalendario)`, con `pedirCalendario` una función que da una promesa del calendario, como `fuentes`; en vivo, `const calendario = await pedirCalendario()` y lo pasa a `casosDe` y a `etapasDe`;
  - `cicloDeVidaDe`: el calendario se pide una sola vez, memorizado como `fuentes` (`leido ??= leerCalendario().then(exigirLaTabla)`), y solo si algún año va en vivo: siempre después de `leerAniosConFoto`. Así el test de `tests/reportes.test.js` L303-327 (`reporteCicloDeVida` con toda consulta fallando exige un solo `console.error`) no cambia: falla antes `aniosConFoto`;
  - `reporteAgenda`: `leerCalendario()` en el `Promise.all` de la consulta, `exigirLaTabla` del resultado y `calendario` a `agendaDe`. Un error sigue por `responderError(res, 'agenda', error)` (500 «Error al generar el PDF de la Agenda de pedidos»).
  - Sin cambios: `deLaFoto`, `reporteInformeAnual`, `pdfDeParaCompletar` (hereda de `metricasDe`) y `pdfDeCicloDeVida`.

- [ ] **Step 1: Escribir los tests que fallan,** en `tests/feriados-en-metricas.test.js`, un `describe` «Métricas, el Ciclo de vida y la Agenda», con `prepararElAnio()` y `TABLA = calendarioCon(FILAS_PRECARGA)`:
  - `metricasDe({ anio: '2026' }, { hoy: '2026-12-31' })`: la cifra del aviso externo de `vista.circuito` es 25 y la del interno 38; `data.vista` da lo mismo que `vistaDe(casosDe(await fuentesDe(null), { hoy: '2026-12-31', calendario: TABLA }), { anio: 2026, al: '2026-12-31', calendario: TABLA })`.
  - `cicloDeVidaDe({ anio: '2026' }, { hoy: '2026-12-31' })`: `etapas.externa[0].habiles.mediana === 25` y `etapas.interna[0].habiles.mediana === 38`.
  - **Review Focus 5:** con `mock.method(pool, 'query')` (sin implementación: espía y llama a la de verdad), las lecturas de la tabla son las consultas con `feriados_no_rige`: `cicloDeVidaDe({ anio: '2027' }, { hoy: '2027-01-05' })`, sin foto de 2026 todavía (2027 y 2026 en vivo), lee 1; `metricasDe({ anio: '2026' }, { hoy: '2026-12-31' })`, 1.
  - **Review Focus 4:** con la foto de 2026 sacada (`sacarFotoSiCorresponde({ hoy: '2027-01-10' })`) y con la tabla renombrada, al `hoy: '2027-01-12'`: `metricasDe({ anio: '2026' })` y `cicloDeVidaDe({ anio: '2026' })` responden (no null y sin tirar) y `reporteInformeAnual` para 2026 responde 200 con un PDF (controlador con `res` falso); con la tabla, ninguno de los tres la lee (0 consultas con `feriados_no_rige`).
  - Con la tabla renombrada, en vivo: `verMetricas` (`{ query: { anio: '2026' } }`, con el reloj en el 31/12/2026) responde 500 «Error al obtener las métricas»; `reporteCicloDeVida`, 500 «Error al generar el Ciclo de vida del dato»; `reporteAgenda`, 500 «Error al generar el PDF de la Agenda de pedidos». Ninguno arma un PDF.
  - **La Agenda con la tabla:** un dataset interno activo con próxima `'2026-12-31'` y el reloj en `'2026-10-28T13:00:00Z'`: el renglón de ese dataset del PDF de `reporteAgenda` (leído con `tests/pdf-lector.js`) dice el 03/11 como «Aviso aprox.» (con los 9 fijos diría el 02/11; usar el formato de fecha que imprime `reportesAgendaPdf.js`).
- [ ] **Step 2: Correr los tests y ver que fallan,** con el candado: `node --test --test-concurrency=1 tests/feriados-en-metricas.test.js`: FAIL.
- [ ] **Step 3: Implementar** las firmas de Interfaces. Los comentarios de `metricasController.js` (la cabecera y los de `enVivo`, `metricasConOpciones`, `etapasDelPeriodo` y `cicloDeVidaDe`) dicen con qué calendario se cuenta y que sin la tabla tiran. Para la revisión: que `enVivo` le pase el calendario también a `casosDe` (como en la foto, ningún test lo nota).
- [ ] **Step 4: Correr los tests y ver que pasan,** con el candado: `tests/feriados-en-metricas.test.js`, `tests/metricas-api.test.js`, `tests/reportes.test.js`, `tests/estados-api.test.js` (también pide `/metricas`) y `tests/permisos.test.js`: PASS.
- [ ] **Step 5: Commit.**

  `git add controllers/metricasController.js controllers/reportesController.js tests/feriados-en-metricas.test.js && git commit -m "feat(metricas): Métricas en vivo, el Ciclo de vida y la Agenda de pedidos leen el calendario una vez" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`
- [ ] **Step 6: La suite completa,** con el candado: 0 fallas nuevas contra la Task 0.

### Task 4: Los textos

**Files:**
- Modify: `public/reportes.html` (L417 y el `?v=` de `js/reportes.js`, L602), `public/js/reportes.js` (`BAJADA_DE_LOS_DIAS`, L45-48), `services/reportesMetricasPdf.js` (`TEXTOS_DE_LA_PESTANA.bajada.habiles`, L54), `services/reportesCicloDeVidaPdf.js` (`COMO_SE_CUENTA`, L32), `public/configuracion.html` (`#feriados-aviso`, L427), `services/feriadosReglas.js` (el comentario de la cabecera, L13)
- Test: `tests/reportes-frontend.test.js` (L170-174), `tests/reportes-pdf.test.js` (L2191 y `REFERENCIA_DE_LOS_PDF`, L1877-1926), `tests/paginas.test.js` (`VERSION_REPORTES`, L67-74; el aviso, L272-280)

- [ ] **Step 1: Escribir los tests que fallan.**
  - `tests/reportes-frontend.test.js` L172: la bajada nueva (Global Constraints). La paridad con el PDF (L1641) no se toca: obliga a cambiar los dos juntos. Una aserción nueva: el texto inicial de `#mt-bajada` en `public/reportes.html` (L417) termina con la bajada de los días hábiles (hoy no lo ata ningún test).
  - `tests/reportes-pdf.test.js` L2191: `sinLaUltima` empieza con «Días hábiles: de lunes a viernes, sin feriados ni días no laborables; entre paréntesis, los corridos. …».
  - `tests/paginas.test.js`: `VERSION_REPORTES = '20261208'`, con una línea más en su comentario de historia («desde los feriados en todo el sistema, tanda 2»); el aviso azul de la tanda 2, y su comentario (L272-273).
- [ ] **Step 2: Correr los tests y ver que fallan.** `node --test --test-concurrency=1 tests/reportes-frontend.test.js tests/reportes-pdf.test.js tests/paginas.test.js`: FAIL.
- [ ] **Step 3: Cambiar los textos** de Files, al pie de la letra. El comentario de `feriadosReglas.js` L13 dice que todo el sistema cuenta con el calendario.
- [ ] **Step 4: Volver a tomar `REFERENCIA_DE_LOS_PDF`.**
  - Correr `node --test --test-concurrency=1 tests/reportes-pdf.test.js`: el test de la referencia falla e imprime el JSON de los hashes nuevos.
  - Tienen que cambiar **solo** el hash de la hoja 1 de los PDF 1, 3, 4 y 5 (Métricas con las métricas manuales, Métricas de un año cerrado sin foto y los dos Informes anuales): es la hoja de «Cómo se cuenta». El PDF 2 (días corridos) no cambia. Si cambia otra hoja, parar y revisar.
  - Pegar los nuevos y sumar al comentario de L1877-1879 que se volvió a tomar por la bajada de los días hábiles (feriados en todo el sistema, tanda 2).
- [ ] **Step 5: Correr los tests y ver que pasan.** Los tres del Step 2: PASS.
- [ ] **Step 6: Commit.**

  `git add public/reportes.html public/js/reportes.js services/reportesMetricasPdf.js services/reportesCicloDeVidaPdf.js public/configuracion.html services/feriadosReglas.js tests/reportes-frontend.test.js tests/reportes-pdf.test.js tests/paginas.test.js && git commit -m "feat(metricas): los textos dicen que los días hábiles no cuentan feriados ni días no laborables" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`
- [ ] **Step 7: La suite completa,** con el candado: 0 fallas nuevas contra la Task 0.

### Task 5: La documentación

**Files:**
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: `CLAUDE.md`** (spec, sección 9; las líneas son de ad0de02):
  - L26 (Estructura): `feriadosReglas` suma `exigirLaTabla`, `feriadosDelCalendario` y `calendarioDeFechas`; el test estático ya no tiene excepciones de la tanda 2.
  - L209 y L211 (Métricas): los días hábiles con el calendario (los 9 fijos y la tabla); la cobertura cuenta el día del aviso con el mismo calendario que la Agenda y el envío (sale la frase del faltante entre las 0:00 y las 8:15).
  - L214 (la foto): la clave opcional `feriados` (qué guarda y su rango) y que no se saca si la tabla no se puede leer; L248-249 (Ciclo de vida): `etapasDeLaFoto` recalcula con los `feriados` de la foto o, sin ellos, con los 9 fijos; `cicloDeVidaDe` lee el calendario una vez.
  - L284, L290, L364, L365, L367, L368 y L370 (Feriados y Recordatorios automáticos): se sacan los «hasta la tanda 2»; el aviso azul nuevo; una sola lectura por pedido, también en Métricas, el Ciclo de vida y la Agenda (un año con foto no la lee); quién cuenta con qué: todo el sistema; si la tabla no se puede leer, Métricas en vivo, el Ciclo de vida, la Agenda y «Datos para completar» dan 500 y la foto no se saca (con `MENSAJE_METRICAS_SIN_FERIADOS` en la última corrida); en la corrida de las 8:15, la foto recibe el calendario de la corrida; el test estático solo con `SIEMPRE`; los tests de la tanda 2, con `tests/feriados-en-metricas.test.js`.
  - La convención de `reportes.js`: `VERSION_REPORTES` en `'20261208'` desde la tanda 2.
  - L251: la referencia de los PDF se volvió a tomar por la bajada.
  - L423 (Despliegue): la tanda 2, sin SQL, sin cron y sin Run NPM Install, los archivos y Restart, **antes del 10/01/2027**; después, el Estado no cambia (nada que mirar ahí) y en Métricas la bajada dice «sin feriados ni días no laborables».
- [ ] **Step 2: `README.md`:** L75 (Configuración → Feriados: ya no «todavía cuentan solo los 9 fijos»), L178 (los días hábiles de Métricas), L182 (la foto guarda sus feriados), L927 (Tareas Cron) y una entrada nueva del changelog arriba de L1094, con el despliegue. L1101 queda como historia (como mucho, una remisión). L723, L726, L742, L1128, L1135 y L1288 no se tocan.
- [ ] **Step 3: Revisar** que `grep -rn "tanda 2\|HASTA_LA_TANDA_2\|feriados nacionales fijos" CLAUDE.md README.md services controllers public tests` solo dé historia o la spec. `tests/schema.test.js:1784` (la cabecera de la precarga) queda.
- [ ] **Step 4: Commit.**

  `git add CLAUDE.md README.md && git commit -m "docs(metricas): CLAUDE.md y el README de los feriados en todo el sistema, tanda 2" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 6: Verificación con la copia local de producción (solo lectura)

No es una tarea de código ni va al repo. La corre la sesión que coordina la implementación, antes de la revisión final. Los números reales no van en tests versionados (Ruling 3 de Métricas).

- [ ] **Step 1: El script,** en el scratchpad de la sesión: importa los servicios de la rama con el `.env` local (la base `datospublicos_mcr_rpad`, el volcado de producción con la precarga y lo que cargó el usuario). Solo lecturas: `fuentesDe(null)`, `leerCalendario()` y nada que escriba.
- [ ] **Step 2: Comparar los 9 fijos con la tabla,** al día de hoy y al 31/12/2026:
  - Métricas 2026 (las cuatro combinaciones de la vista): qué cifras y qué textos cambian;
  - el Ciclo de vida de 2026: la mediana y el promedio de cada etapa;
  - la Agenda de pedidos (12 meses, las dos gestiones): qué «Aviso aprox.» se mueven (tienen que aparecer el 31/12 externo, del 23/11 al 24/11, y el 31/12 interno, del 02/11 al 03/11, si todavía están en la ventana);
  - una foto en seco: `datosDeLaFoto(fuentes, { anio: 2026, generada, calendario })` con los datos de hoy, su tamaño en bytes, `feriados` (las fechas de la tabla real) y que tenga `etapas`.
- [ ] **Step 3: El informe,** en `C:\Users\Mariano\Desktop\RPAD-verificacion-feriados-en-metricas\LEEME.html`: lo que cambia y lo que no, con los dos lados. Avisar a la sesión que hace la revisión final si algo no coincide con la spec (sección 5: «No cambian la cobertura del aviso, las reiteraciones, el índice, …»).

### Después del merge: el kit (no es una tarea de este plan)

Lo arma la sesión que coordina la implementación, después del merge en main (spec, sección 9):
- `RPAD-deploy-feriados-en-metricas`, en el Escritorio, con su vuelta atrás, comparado byte a byte con git contra el merge de «licencia anulada» (lo indica la coordinadora: no contra ad0de02);
- sin SQL, sin cron nuevo y sin Run NPM Install: subir los archivos y Restart, fuera del horario de los crons (8:15, 14:00 y las medias horas), **antes del 10/01/2027**;
- después de desplegar: en Métricas, la bajada dice «sin feriados ni días no laborables»; la Agenda de pedidos dice el 24/11 (no el 23/11) para los externos que vencen el 31/12/2026 y el 03/11 (no el 02/11) para los internos, si todavía se ven;
- el 10 o el 11/01/2027 (el 10 es domingo: Correos → Estado dice «Día no hábil» y muestra la foto solo si falló): en Métricas y Reportes, 2026 ya no dice «La foto de 2026 se saca el 10/01/2027» ni «… todavía no se sacó», y el Informe anual de 2026 se puede bajar; la última corrida de Correos → Estado no dice «No se pudo sacar la foto del año».
