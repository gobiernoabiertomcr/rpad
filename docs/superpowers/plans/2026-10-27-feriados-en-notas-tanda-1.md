# Feriados en las Notas Digitales y los recordatorios (tanda 1): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un solo calendario de días hábiles (los 9 fijos más la tabla `feriados`) para las corridas de las 8:15 y de las 14:00 y para todo lo que las anuncia (Correos → Estado, la vista previa y la prueba, Configuración → Licencias y Mi espacio). Si la tabla no se puede leer, las corridas siguen con los 9 fijos y Correos → Estado lo marca en rojo.

**Architecture:**
- `services/notasDigitalesCalendario.js` escribe las derivadas una sola vez sobre un predicado (`derivadasDe`) y exporta `CALENDARIO_FIJO`; los nombres que exporta hoy siguen y dan lo mismo.
- `calendarioCon(filas)` (`feriadosReglas.js`) arma el mismo objeto con la tabla. `leerCalendario` (`feriadosDatos.js`) lo lee una vez por corrida o por pedido y, si falla, cae a los fijos sin tirar.
- El objeto viaja por las capas, dentro de los contextos que ya existen o como último parámetro. Correos → Estado y la vista previa sacan sus fechas de una sola función, con la regla de la corrida: «el primer día con notas».

**Tech Stack:** Node 22, ES Modules, Express 4 y mysql2/promise sobre MariaDB. Tests con `node:test`:
- puros;
- de la página, en un `vm`;
- de integración, sobre Docker con una base propia y Mailpit.

**Spec:** `docs/superpowers/specs/2026-10-27-feriados-en-notas-design.md`, aprobada el 27/10/2026.
- Este plan es su **tanda 1**: secciones 1, 2, 3, 4, 6 (los textos de la tanda 1), 7, 8 y 9.
- La tanda 2 (sección 5: Métricas, el Ciclo de vida, la foto, el Informe anual y la Agenda de pedidos) tiene su propio plan.
- El análisis del código, con archivo y línea (de 780e39b), está en la carpeta de notas de la coordinadora: `feriados-en-notas-analisis.md`.

## Global Constraints

- **No cambian:**
  - `esDiaHabil` y `FERIADOS_FIJOS`;
  - `VENTANA_DIAS` (40 en externa y 60 en interna) y `DIAS_PARA_REITERAR` (20 días corridos);
  - `DIAS_HABILES_PARA_REITERAR_AUDITORIA` (5) y `RECORDATORIOS_ANTES_DE_LA_NOTA` (2);
  - los vencimientos (siempre fin de mes).
- **La tanda 2 no se toca:** `services/metricasReglas.js`, `services/reportesAgenda.js`, `services/metricasFoto.js` y los PDF de reportes.
- **Tampoco** el email de vencimiento de Mi espacio ni la corrida de la agenda (ya usan la tabla).
- **Lo ya enviado no cambia:** las notas, sus anexos y los `cuenta_desde` guardados no se reescriben.
- **Un solo nombre para el parámetro:** `calendario`, el objeto de la sección 1:

  `{ esDiaHabil, proximoDiaHabil, diaHabilAnterior, ultimoDiaHabilHasta, primerDiaHabilDelMes, rangoDeAviso, diasHabilesTranscurridos, sumarDiasHabiles, origen: 'tabla' | 'fijos', error: string | null }`.

  En los objetos que ya pasan por las capas va como clave; en las funciones posicionales, al final.
- **Valores por defecto:**
  - las reglas puras: `calendario = CALENDARIO_FIJO`;
  - las funciones exportadas que leen la base: `calendario ?? await leerCalendario(conexion)`;
  - las internas no exportadas de `services/notasDigitales.js` y de `services/avisosDiariosService.js`: sin valor por defecto (un olvido tira).
- **La caída a los 9 fijos se detecta por `calendario.error !== null`, nunca por `origen`:** así un test puede pasar `CALENDARIO_FIJO` sin que la corrida anote un error.
- **Tope de 366 vueltas:** en cada búsqueda de un día hábil (`proximoDiaHabil`, `diaHabilAnterior` y las que las usan), la búsqueda mira la fecha y los 365 días siguientes (o los 366 anteriores). Sin ninguno, tira `RangeError` con «366» en el mensaje. Con los 9 fijos nunca pasa.
- **Textos, al pie de la letra** (spec, sección 6):
  - `MENSAJE_CORRIDA_SIN_FERIADOS`: «No se pudieron leer los feriados de Configuración → Feriados: la corrida usó solo los 9 fijos.»
  - `MENSAJE_ESTADO_SIN_FERIADOS`: «No se pudieron leer los feriados de Configuración → Feriados: las fechas de esta pantalla cuentan solo los 9 feriados fijos.» Va en la alerta `feriados-sin-leer`, de nivel `error`.
  - `efectoEnNotas` (Configuración y su copia en Mi espacio), en una licencia sin anticipo:
    - sin persona autorizada: «Empieza a continuación de otra licencia: los avisos no se adelantan. Lo que toque avisar y las reiteraciones salen el primer día hábil después de la licencia.»;
    - con ella: «Empieza a continuación de otra licencia: los avisos no se adelantan. Desde el primer día, {nombre} presenta las notas con las dos firmas, después de la nota que comunica la autorización.»
  - `textoLicenciaFirmante` (Correos → Estado), en una licencia futura sin anticipo:
    - sin persona autorizada: «Licencia del firmante del {desde} al {hasta}, sin autorizado: empieza a continuación de otra licencia, así que los avisos no se adelantan, y las reiteraciones se postergan al {vuelta}.»;
    - con ella: «Licencia del firmante del {desde} al {hasta}: empieza a continuación de otra licencia, así que los avisos no se adelantan. {nombre} presenta las notas por autorización, con las dos firmas, desde el primer día.»
  - La vista previa, cuando la nota sale otro día y hoy sí hay notas:
    - la primera línea: «Esta nota no sale hoy: así saldría el {fecha}.»;
    - la segunda, la de siempre con motivo: «Con los datos de hoy, ese día esta nota incluiría N dataset(s). Asunto: …» o «Ese día no saldría ninguna nota de este tipo: se muestran datos de ejemplo.».
  - La prueba: «Prueba enviada a … (como saldría el {fecha})».
  - El aviso azul de la pestaña Feriados (tanda 1): «Estos feriados, junto con los 9 fijos, son los días no hábiles de las Notas Digitales, los emails automáticos, las licencias y Mi espacio: esos días no sale ninguna nota ni ningún email automático. Métricas, el Ciclo de vida del dato y la Agenda de pedidos todavía cuentan solo los 9 fijos.»
  - **Un texto que la spec no trae (a mostrar al usuario antes del merge):** en Configuración, una licencia del firmante sin días hábiles dice «No tiene días hábiles: las notas no cambian.». Es la frase que ya usa Correos → Estado en ese caso.
- **No romper nada:** `npm test` completo antes y después de cada tarea, con el candado `C:\Users\Mariano\.rpad-suite.lock`; nunca dos suites a la vez.
  - Todo test que use Docker, también uno suelto, se corre con el candado tomado: las bases `rpad_test_<archivo>` y el `GET_LOCK` de las Notas son del servidor entero.
- **Todos los subagentes van con Opus.**
- **Ningún email real** (en local, Mailpit). **Nunca `/api/cron/*` desde los tests:** se llama a la función o al controlador con un `res` falso.
- **La base `datospublicos_mcr_rpad` no se escribe.** La simulación (Task 11) usa `rpad_rama_feriados_notas` y nada más.
- **CLAUDE.md:**
  - ES Modules, consultas parametrizadas con `?` y respuestas `{ success, data?, error?, campo?, message? }`;
  - español en el código, en los comentarios y en la interfaz, sin emojis;
  - repositorio público: sin nombres reales en los tests («Persona admin», «Firma superadmin»).
- **Versiones:** un cambio en un `public/js/*.js` sube su `VERSION_*` una sola vez en la rama, en `tests/paginas.test.js` y en el `?v=` del HTML:
  - `correos.js` → `VERSION_CORREOS`, en la Task 6;
  - `usuarios.js` → `VERSION_PANTALLAS`, en la Task 8;
  - `mi-espacio.js` → `VERSION_MI_ESPACIO`, en la Task 9.

  El valor nuevo es el de main más un día; la Task 0 confirma los de partida (al 27/10: `'20261210'`, `'20261209'` y `'20261211'`).
- **Sin SQL, sin tablas, sin cron nuevo y sin Run NPM Install.**

## Review Focus

1. **Un `cuenta_desde` guardado que cae en un feriado de la tabla.** Pasa con un anticipo hecho antes del despliegue, con los 9 fijos, o con un feriado cargado después de la víspera.
   - El aviso en su fecha se presenta el hábil anterior dentro de la licencia y no se pierde.
   - La reiteración sigue contando desde lo guardado.
   - Test en la Task 4: «un cuenta_desde guardado en un feriado de la tabla…».
2. **La corrida de las 8:15 «ocupada» con la tabla sin leer.** El error queda en la respuesta y en la consola, y la última corrida (la de la otra) no se toca. Test en la Task 4.
3. **La columna «días hábiles pendiente» de la nota de auditoría con un feriado de la tabla en el medio.** Un cambio del 30/10 en la nota del 04/11 dice 2, no 3. Test en la Task 3.
4. **El próximo aviso del Estado con licencias seguidas.** Un dataset que toca durante la segunda licencia no se anuncia en la «víspera» (que cae dentro de la primera), y la corrida de ese día no lo anticipa. Test en la Task 6.
5. **La lectura del calendario que falla dentro de la transacción de Configuración no la rompe.** La licencia del titular con persona autorizada se guarda con los 9 fijos y la transacción confirma. Test en la Task 8.

---

### Task 0: Preparación

Sin código.

- [ ] **Step 1: Traer main.**
  - `git merge main`, con el main que indique la coordinadora (no rebase; la herramienta del host no puede hacer fetch en este repo).
  - Para esta tanda tienen que estar en main la sesión «confirmación y Word de la licencia» (toca el modal de licencia de `mi-espacio.js`) y la de «mejoras en la carga de horas extras».
- [ ] **Step 2: La línea de base.** Docker arriba (`docker ps`: `rpad-db` y Mailpit). `npm test` completo con el candado: anotar cuántos pasan, cuántos fallan y cuáles.
- [ ] **Step 3: Confirmar los nombres que usa el plan.** Mirar que existan, con esta forma:
  - en `services/notasDigitalesCalendario.js`: `esDiaHabil`, `proximoDiaHabil`, `diaHabilAnterior`, `ultimoDiaHabilHasta`, `primerDiaHabilDelMes`, `rangoDeAviso`, `diasHabilesTranscurridos` y `sumarDiasHabiles`;
  - en `services/feriadosReglas.js` y `services/feriadosDatos.js`: `feriadosDelRango` y `filasDeFeriados(conexion = pool)`;
  - en `services/licenciasReglas.js`: `diasHabilesLibres`, `unirAusencias` y `diaDelAvisoEnSuFecha`;
  - en `services/notasDigitalesFirmas.js`: `firmaParaFecha`, `autorizacionPendiente`, `anticipoPorLicencia`, `disponibilidadDelAutorizado` y `autorizadoParaLicencia`;
  - en `services/auditoriaReglas.js`: `agruparDiasSinAuditor`, `canalDelCambio` y `seccionDeAuditoria`;
  - en `services/auditoriaService.js`: `personasPorDia`, `periodosSinAuditor`, `proximoDiaConQuienAudite`, `contextoDeCanal`, `cambiosConCanal` y `seleccionarParaAuditoria`;
  - en `services/avisosDiariosService.js`: `datasetsExternosPorArea`, `enviarAvisoAreas` y `enviarCambiosPendientes`;
  - en `services/avisosSuperadminService.js`: `enviarResumenAvisosRetenidos`;
  - en `services/notasDigitales.js`:
    - el motor: `ejecutarNotasDigitales`, `correrPasos`, `prepararAviso`, `contextoDelDia` y `avisoDelDia`;
    - la vista previa: `fechaDeVistaPrevia`, `diaDeVistaPrevia`, `notaDeVistaPrevia`, `previewNota`, `previewPdf`, `previewAnexo`, `mensajeDePrueba` y `enviarPrueba`;
    - el Estado: `licenciaDelFirmante`, `proximoAvisoEnSuFecha`, `estadoAuditoria`, `estadoNotas`, `alertasDeCorrida`, `ejemploAuditoria` y `anotarEnLaUltimaCorrida`;
  - `pendientesEnSuFecha` (`services/notasDigitalesDatos.js`);
  - `filaDeCambio` (`services/notasDigitalesContenido.js`);
  - en `controllers/notificacionesController.js`: `ejecutarNotificacionesDiarias`, `ejecutarNotificacionCambiosPendientes` y `fechaDelProximoAviso`;
  - `verEstado` y `enviarPrueba` (`controllers/notasDigitalesController.js`);
  - en `controllers/licenciasController.js`: `aRespuesta`, `listarLicencias` y `listarDiasSinAuditor`;
  - en `services/licenciasOficialesService.js`: `conSusLicencias`, `rechazoDeLaBase`, `cargarLicencia` y `cambiarLicencia`;
  - en `services/miEspacioReglas.js`: `limiteParaCambiarTipo`, `pasoDeLaCorreccion`, `pasoPrevistoDe` y `AVISO_NOTAS_DE_HOY`;
  - en `services/miEspacioPaso.js`: `pasoPrevisto`, `aplicarCarga`, `aplicarCorreccion` y `planDeLaCorreccion`;
  - en `controllers/miEspacioController.js`: `calcularLicencia`, `cargarLicenciaMia`, `corregirLicenciaMia` y `verFirmante`;
  - `oficialesQueSeCruzan` (`services/miEspacioDatos.js`);
  - en el navegador: `efectoEnNotas` (`public/js/usuarios.js` y `public/js/mi-espacio.js`) y `textoLicenciaFirmante` y `textoDeVistaPrevia` (`public/js/correos.js`).
  - Si algo cambió de nombre o de lugar, ajustar este plan en la rama, en su propio commit, antes de seguir.
- [ ] **Step 4: La lista de los pendientes del test estático.**
  - Listar los archivos de `services/` y `controllers/` que importan alguna de las ocho funciones de arriba desde `notasDigitalesCalendario.js`. Con `grep -rn "notasDigitalesCalendario.js'" services controllers` se ven; los imports de varias líneas se leen en el archivo.
  - Al 27/10 son 16:
    - los 4 de las excepciones: el calendario, `feriadosReglas.js`, `metricasReglas.js` y `reportesAgenda.js`;
    - y 12 pendientes: `auditoriaReglas.js`, `auditoriaService.js`, `avisosDiariosService.js`, `avisosSuperadminService.js`, `licenciasOficialesService.js`, `licenciasReglas.js`, `miEspacioReglas.js`, `notasDigitales.js`, `notasDigitalesContenido.js` y `notasDigitalesFirmas.js` (en `services/`), y `licenciasController.js` y `notificacionesController.js` (en `controllers/`).
  - Si main sumó otro, va a `PENDIENTES_DE_LA_TANDA_1` de la Task 1 y a la tarea que corresponda.
- [ ] **Step 5: Las versiones de partida.** Anotar las versiones de partida (`VERSION_CORREOS`, `VERSION_PANTALLAS` y `VERSION_MI_ESPACIO` en `tests/paginas.test.js`) y fijar las nuevas, cada una un día más.

### Task 1: El calendario único

**Files:**
- Modify: `services/notasDigitalesCalendario.js`, `services/feriadosReglas.js`, `services/feriadosDatos.js`, `tests/helpers.js`, `tests/notas-calendario.test.js`, `tests/feriados-reglas.test.js`
- Create:
  - las fixtures: `tests/fixtures/calendario-fijo-de-antes.js` y `tests/fixtures/feriados-precarga.js`;
  - los tests: `tests/calendario-unico.test.js` y `tests/feriados-en-notas.test.js`.

**Interfaces:**
- Produces:
  - **En `services/notasDigitalesCalendario.js`:**
    - `TOPE_DE_VUELTAS = 366`;
    - `derivadasDe(esHabil: (fecha) => boolean) → { esDiaHabil, proximoDiaHabil(iso), diaHabilAnterior(iso), ultimoDiaHabilHasta(iso), primerDiaHabilDelMes(periodo), rangoDeAviso(hoy, dias) → { desde, hasta } | null, diasHabilesTranscurridos(desde, hasta) → number, sumarDiasHabiles(iso, n) }`, con el tope;
    - `CALENDARIO_FIJO`, congelado: `{ ...derivadasDe(esDiaHabil), origen: 'fijos', error: null }`.
    - Los nombres de hoy salen de él (`export const proximoDiaHabil = CALENDARIO_FIJO.proximoDiaHabil`, …). `esDiaHabil` y `FERIADOS_FIJOS` no cambian.
    - `diasHabilesTranscurridos` hace lo mismo que hoy en toda entrada en la que hoy termina. Con un `hasta` texto mayor que `'9999-12-31'` (por ejemplo, `'abc'`), en el que hoy no termina, tira `RangeError`.
  - **En `services/feriadosReglas.js`:**
    - `calendarioCon(filas, { origen = 'tabla', error = null } = {})` → el mismo objeto, congelado. Copia las filas al armarse.
    - Su predicado es `esDiaHabil(fecha) && !delAnio(fecha.slice(0, 4)).has(fecha)`, sin `esFechaIso`. `delAnio` arma con `feriadosDelRango` el Set de un año la primera vez que se lo pide y lo guarda.
    - `MENSAJE_CORRIDA_SIN_FERIADOS` y `MENSAJE_ESTADO_SIN_FERIADOS` (Global Constraints).
  - **En `services/feriadosDatos.js`:** `leerCalendario(conexion = pool) → Promise<calendario>`.
    - Es `calendarioCon(await filasDeFeriados(conexion))`.
    - Si la lectura falla: `Object.freeze({ ...CALENDARIO_FIJO, origen: 'fijos', error: String(error?.message ?? error) })`, con el error en `console.error`. Nunca tira.
  - **En `tests/helpers.js`:** `correrSqlEnBaseDePrueba(nombre, rutaDesdeLaRaiz)`.
    - Valida el nombre con `validarDestinoBasePrueba`, abre la conexión de root (`multipleStatements`), hace `USE` y corre el archivo tal cual.
  - **`tests/fixtures/feriados-precarga.js`:** `FILAS_PRECARGA`, las 28 filas de `database/updates/migracion-feriados-datos.sql`, en el orden del archivo.
    - Con la forma de `filasDeFeriados`: `{ id: 1…28, fecha, nombre, tipo, trasladado_de, se_repite, hasta_anio: null, activo: 1, no_rige: [] }`.
    - Congeladas.
  - **`tests/fixtures/calendario-fijo-de-antes.js`:** la copia literal, sin imports, de `aFecha`, `aIso`, `sumarDias`, `FERIADOS_FIJOS`, `esDiaHabil` y las siete derivadas de hoy.
  - **`tests/calendario-unico.test.js`:**
    - `PROHIBIDOS`: las ocho funciones de la Task 0, Step 3, primera línea.
    - `SIEMPRE`: `services/notasDigitalesCalendario.js` y `services/feriadosReglas.js`.
    - `HASTA_LA_TANDA_2`: `services/metricasReglas.js` y `services/reportesAgenda.js`.
    - `PENDIENTES_DE_LA_TANDA_1`: los 12 de la Task 0, Step 4.
    - Lee cada `.js` de `services/` y `controllers/`, y los `import { … }` y `export { … } from` (también de varias líneas) desde `./notasDigitalesCalendario.js` o `../services/notasDigitalesCalendario.js`. De cada nombre toma lo de antes de ` as `.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **`tests/notas-calendario.test.js`,** `describe('las derivadas sobre un predicado (spec 2026-10-27-feriados-en-notas, 1)')`. Con `const resultado = (fn) => { try { return { valor: fn() }; } catch (e) { return { tira: e.constructor.name }; } };`:
    - **«los nombres de siempre y CALENDARIO_FIJO dan lo mismo que la copia de antes, del 2025 al 2028 y con entradas raras».**
      - Para cada día del `'2024-12-25'` al `'2029-01-07'` y para `RAROS = ['abc', '', '2026-02-30', '2026-13-01', null, undefined, 3, '2026-2-3', '9999-12-31']`: `assert.deepEqual(resultado(() => cal.X(e)), resultado(() => antes.X(e)))` y lo mismo con `cal.CALENDARIO_FIJO.X`.
      - Con `X` en `esDiaHabil`, `proximoDiaHabil`, `diaHabilAnterior` y `ultimoDiaHabilHasta`.
      - `rangoDeAviso(e, d)`, con `d` en `0`, `40` y `60`.
      - `sumarDiasHabiles(e, n)`, con `n` en `0`, `1`, `2` y `5`.
      - `primerDiaHabilDelMes(p)`, para cada `'AAAA-MM'` de 2025-01 a 2028-12 y para los raros.
      - `diasHabilesTranscurridos(d, sumarDias(d, k))`, con `k` en `-1`, `0`, `1`, `7`, `30` y `400`.
      - `diasHabilesTranscurridos(r, '2026-01-10')` con cada raro, y `diasHabilesTranscurridos('2026-01-01', h)` con `h` en `''`, `null`, `undefined`, `3`, `'2026-02-30'` y `'2026-2-3'` (no con `'abc'`: la copia de antes no termina).
    - **«CALENDARIO_FIJO»:** `assert.equal(cal.CALENDARIO_FIJO.esDiaHabil, cal.esDiaHabil)`; `origen` `'fijos'`, `error` null y `Object.isFrozen(cal.CALENDARIO_FIJO)`.
    - **«diasHabilesTranscurridos con un hasta mayor que toda fecha tira»:** `assert.throws(() => cal.diasHabilesTranscurridos('2026-01-01', 'abc'), RangeError)`.
    - **«el tope de 366 vueltas»,** con `todo` = un Set con cada día del `'2026-01-01'` al `'2027-01-31'` y `const t = cal.derivadasDe((f) => cal.esDiaHabil(f) && !todo.has(f))`:
      - `assert.throws(() => t.proximoDiaHabil('2026-01-01'), (e) => e instanceof RangeError && /366/.test(e.message))`;
      - lo mismo con `t.diaHabilAnterior('2027-02-01')`, `t.primerDiaHabilDelMes('2026-01')` y `t.sumarDiasHabiles('2025-12-31', 1)`;
      - con el Set hasta el `'2026-12-30'`, `t.proximoDiaHabil('2026-01-01')` es `'2026-12-31'`.
  - **`tests/feriados-reglas.test.js`:**
    - **`describe('calendarioCon (spec 2026-10-27-feriados-en-notas, 1)')`:**
      - **«sin filas da lo mismo que CALENDARIO_FIJO»:** los mismos recorridos de arriba, `calendarioCon([])` contra `CALENDARIO_FIJO`; también con `null`, `[null]` y `[{}]`.
      - **«con la precarga»,** con `const c = calendarioCon(FILAS_PRECARGA)`:
        - `c.esDiaHabil(f)` es false en `'2026-11-02'`, `'2026-11-09'`, `'2026-11-23'`, `'2026-12-07'`, `'2027-02-08'`, `'2027-02-09'`, `'2027-02-23'`, `'2027-03-25'` y `'2027-03-26'`, y true en `'2026-11-03'`, `'2026-11-10'`, `'2026-11-24'` y `'2026-12-04'`;
        - `c.diaHabilAnterior('2026-12-09')` es `'2026-12-04'`;
        - `c.primerDiaHabilDelMes('2026-11')` es `'2026-11-03'`;
        - `c.proximoDiaHabil('2026-11-21')` es `'2026-11-24'`;
        - `c.rangoDeAviso('2026-11-06', 40)` es `{ desde: '2026-12-16', hasta: '2026-12-19' }`, y `c.rangoDeAviso('2026-11-02', 40)`, `null`;
        - `c.diasHabilesTranscurridos('2026-10-30', '2026-11-03')` es `1`;
        - `c.sumarDiasHabiles('2026-11-04', 5)` es `'2026-11-12'`;
        - 2026 tiene `237` días hábiles (contados con `c.esDiaHabil`);
        - `c.origen` es `'tabla'`, `c.error` null y `Object.isFrozen(c)` true.
      - **«las filas que cambian después no lo cambian»:** con una copia de la precarga, borrar la fila del 02/11 después de `calendarioCon(copia)`: el 02/11 sigue sin ser hábil.
      - **«origen y error se pasan»:** `calendarioCon([], { origen: 'fijos', error: 'x' })` tiene `origen` `'fijos'` y `error` `'x'`.
    - **`describe('la precarga de las fixtures es la de migracion-feriados-datos.sql')`:** las 28 filas de `FILAS_PRECARGA`, comparadas con el SQL leído con la misma `FORMA` de `tests/schema.test.js` (fecha, nombre, tipo, trasladado_de y se_repite, en el orden del archivo), con `id` de 1 a 28, `hasta_anio` null, `activo` 1 y `no_rige` vacío.
    - **`describe('los mensajes de la caída a los 9 fijos')`:** los dos textos, escritos a mano.
  - **`tests/calendario-unico.test.js`:**
    - **«ningún archivo de services/ ni controllers/ importa del calendario una derivada fija ni esDiaHabil, salvo las excepciones»:** el mensaje nombra el archivo y la función. También falla con `import * as … from` o `import(…)` del calendario.
    - **«las excepciones de la tanda 2 y las pendientes todavía las importan»:** la lista no tiene de más. Cada tarea que arregla un archivo lo saca de `PENDIENTES_DE_LA_TANDA_1`.
  - **`tests/feriados-en-notas.test.js`** (Docker, base `rpad_test_feriados_en_notas`):
    - **El `before`:**
      - `crearBaseDePrueba` y `correrSqlEnBaseDePrueba(base.nombre, 'database/updates/migracion-feriados-datos.sql')`;
      - `process.env.DB_NAME = base.nombre` y `EMAIL_SOLO_A = ''`;
      - los `import()` dinámicos, como `tests/notas-motor.test.js`.
    - **El `after`:** cierra el pool de `config/database.js` y `cerrarDb`, y borra la base.
    - **Los ayudantes del archivo,** copiados de los de hoy:
      - `crearUsuario` y `licencia`, de `tests/notas-licencias.test.js`;
      - `proponerCambio`, de `tests/avisos-diarios.test.js`, con un `creado` opcional que fija `created_at`;
      - `conLaTablaRenombrada(fn)`: `RENAME TABLE feriados TO feriados_sin_leer`, y de vuelta en un `finally`.
    - **El `beforeEach`:** limpia como `tests/notas-licencias.test.js`, sin tocar nunca `feriados`.
    - **`describe('leerCalendario con la precarga')`:**
      - **«lee la tabla: el 02/11/2026 no es hábil y el 03/11 sí»:** `origen` `'tabla'`, `error` null.
      - **«con la tabla renombrada cae a los 9 fijos, con el error, sin tirar»:** `origen` `'fijos'`, `error` que menciona `feriados`, y el 02/11 hábil.
- [ ] **Step 2: Correr los tests y ver que fallan.**
  - `node --test tests/notas-calendario.test.js tests/feriados-reglas.test.js tests/calendario-unico.test.js`: FAIL, porque `derivadasDe`, `CALENDARIO_FIJO` y `calendarioCon` no existen y las fixtures no están. `calendario-unico` ya pasa con las listas de la Task 0.
  - Con el candado, `node --test tests/feriados-en-notas.test.js`: FAIL, porque `leerCalendario` no existe.
- [ ] **Step 3: Implementar.**
  - Las firmas de arriba. El encabezado de `feriadosReglas.js` deja de decir que «el resto del sistema sigue con esDiaHabil».
- [ ] **Step 4: Correr los tests y ver que pasan.** Los mismos comandos: PASS.
- [ ] **Step 5: Commit.**

  `git add services/notasDigitalesCalendario.js services/feriadosReglas.js services/feriadosDatos.js tests/helpers.js tests/notas-calendario.test.js tests/feriados-reglas.test.js tests/fixtures/calendario-fijo-de-antes.js tests/fixtures/feriados-precarga.js tests/calendario-unico.test.js tests/feriados-en-notas.test.js && git commit -m "feat(feriados): el calendario único de días hábiles, los 9 fijos con la tabla, y su lectura que nunca tira" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 2: Licencias y firmas con el calendario

**Files:**
- Modify: `services/licenciasReglas.js`, `services/notasDigitalesFirmas.js`, `tests/licencias-reglas.test.js`, `tests/calendario-unico.test.js`

**Interfaces:**
- Consumes: `CALENDARIO_FIJO`, `calendarioCon` y `leerCalendario` (Task 1).
- Produces, puras (en `services/licenciasReglas.js`, con `CALENDARIO_FIJO` por defecto):
  - `diasHabilesLibres(desde, hasta, licencias, calendario)` y `unirAusencias(ausencias, calendario)`: la regla de siempre, con el calendario.
  - `diaDelAvisoEnSuFecha({ cuentaDesde, licencia, ausencias = [], calendario })`: si `cuentaDesde` es hábil con el calendario y ella no falta ese día, `cuentaDesde`. Si no, el primer día que cumple las dos, de `ultimoDiaHabilHasta(cuentaDesde)` hacia atrás, sin bajar de `licencia.desde`; si no hay, null.
  - `visperaDeLaLicencia(licencia, otras, calendario) → { vispera: string | null, sin_anticipo: boolean, sin_dias_habiles: boolean }`. `otras`: las demás licencias del titular, `[{ desde, hasta, anulada? }]`, sin la misma.
    - Sin días hábiles (`ultimoDiaHabilHasta(hasta) < desde`): `{ vispera: null, sin_anticipo: false, sin_dias_habiles: true }`.
    - Si alguna de `otras` sin anular incluye el `diaHabilAnterior(desde)`: `{ vispera: null, sin_anticipo: true, sin_dias_habiles: false }`.
    - Si no: `{ vispera: diaHabilAnterior(desde), sin_anticipo: false, sin_dias_habiles: false }`.
    - Nunca tira: con fechas que no sirven, `{ vispera: null, sin_anticipo: false, sin_dias_habiles: false }`.
- Produces, en `services/notasDigitalesFirmas.js` (leen la base: `calendario ?? await leerCalendario(conexion)`):
  - `autorizacionPendiente(config, hoy, calendario)` y `anticipoPorLicencia(config, hoy, calendario)`, con `diaHabilAnterior` y `ultimoDiaHabilHasta` del calendario;
  - `disponibilidadDelAutorizado(licencia, { desde, licenciaExtra, excluirLicenciaId, conexion, calendario })`;
  - `autorizadoParaLicencia(licencia, { desde, licenciaExtra, excluirLicenciaId, calendario })`.

- [ ] **Step 1: Escribir los tests que fallan.** En `tests/licencias-reglas.test.js`, `describe('con el calendario de la tabla (spec 2026-10-27-feriados-en-notas, 3)')`, con `const CAL = calendarioCon(FILAS_PRECARGA)` y el `tramo` del archivo:
  - **«la víspera de una licencia desde el 09/12/2026 es el viernes 04/12»:**
    - `visperaDeLaLicencia({ desde: '2026-12-09', hasta: '2027-01-08' }, [], CAL)` da `{ vispera: '2026-12-04', sin_anticipo: false, sin_dias_habiles: false }`;
    - sin `CAL`, `vispera: '2026-12-07'`.
  - **«a continuación de otra licencia: sin víspera»:**
    - `visperaDeLaLicencia({ desde: '2027-01-04', hasta: '2027-01-08' }, [{ desde: '2026-12-09', hasta: '2026-12-31' }], CAL)` da `{ vispera: null, sin_anticipo: true, sin_dias_habiles: false }`;
    - con esa otra `anulada: 1`, `vispera: '2026-12-31'`.
  - **«sin días hábiles: sin víspera»:**
    - `visperaDeLaLicencia({ desde: '2026-11-07', hasta: '2026-11-09' }, [], CAL)` da `{ vispera: null, sin_anticipo: false, sin_dias_habiles: true }`;
    - sin `CAL`, `{ vispera: '2026-11-06', sin_anticipo: false, sin_dias_habiles: false }`.
  - **«diasHabilesLibres con el 02/11»:**
    - `diasHabilesLibres('2026-11-02', '2026-11-03', [tramo('2026-11-03', '2026-11-03')], CAL)` da `{ primerDia: null, cubiertos: true }`;
    - sin `CAL`, `{ primerDia: '2026-11-02', cubiertos: false }`.
  - **«unirAusencias con el 02/11»:**
    - `unirAusencias([tramo('2026-10-26', '2026-10-30'), tramo('2026-11-03', '2026-11-06')], CAL)` da `[{ desde: '2026-10-26', hasta: '2026-11-06' }]`;
    - sin `CAL`, dos.
  - **«el aviso en su fecha que cae en un feriado de la tabla va al hábil anterior, dentro de la licencia»,** con `cuentaDesde: '2026-12-07'`:
    - con la licencia del 03/12 al 18/12 y `CAL`, `'2026-12-04'`; sin `CAL`, `'2026-12-07'`;
    - con la licencia desde el 07/12, null;
    - con la licencia desde el 01/12 y `ausencias: [tramo('2026-12-04', '2026-12-04')]`, `'2026-12-03'`.
  - **«nada tira»:** `visperaDeLaLicencia` con `null`, `{}` y fechas raras.
- [ ] **Step 2: Correr los tests y ver que fallan.** `node --test tests/licencias-reglas.test.js`: FAIL, porque `visperaDeLaLicencia` no existe y `diasHabilesLibres` ignora el cuarto parámetro.
- [ ] **Step 3: Implementar.**
  - Sacar `services/licenciasReglas.js` y `services/notasDigitalesFirmas.js` de `PENDIENTES_DE_LA_TANDA_1`.
  - `notasDigitales.js` todavía no les pasa el calendario: lo leen ellas (con la base vacía de los tests, lo mismo que los fijos).
- [ ] **Step 4: Correr los tests y ver que pasan.**
  - `node --test tests/licencias-reglas.test.js tests/calendario-unico.test.js`: PASS.
  - Con el candado, `node --test tests/notas-licencias.test.js tests/licencias-api.test.js`: PASS sin tocarlos.
- [ ] **Step 5: Commit.**

  `git add services/licenciasReglas.js services/notasDigitalesFirmas.js tests/licencias-reglas.test.js tests/calendario-unico.test.js && git commit -m "feat(feriados): la víspera, los días libres de la persona autorizada y el aviso en su fecha con el calendario" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 3: Auditoría, un solo calendario en las dos corridas

**Files:**
- Modify:
  - las reglas y la base: `services/auditoriaReglas.js`, `services/auditoriaService.js` y `services/notasDigitalesContenido.js`;
  - la corrida de las 14:00: `services/avisosDiariosService.js` y `controllers/notificacionesController.js`;
  - los tests: `tests/auditoria-reglas.test.js`, `tests/feriados-en-notas.test.js` y `tests/calendario-unico.test.js`.

**Interfaces:**
- Consumes: `leerCalendario`, `MENSAJE_CORRIDA_SIN_FERIADOS` (Task 1) y `anotarEnLaUltimaCorrida` (`services/notasDigitales.js`).
- Produces, puras (en `services/auditoriaReglas.js`):
  - `agruparDiasSinAuditor(dias, hasta, calendario)`;
  - `canalDelCambio({ cambio, hoy, personas, titulares, hayQuienFirme, calendario })`;
  - `seccionDeAuditoria(ultima, hoy, calendario)`.
- Produces, en la base (`services/auditoriaService.js`):
  - `personasPorDia(desde, hasta, { licenciaSimulada, excluirLicenciaId, conexion, calendario })`;
  - `periodosSinAuditor(desde, hasta, { licenciaSimulada, excluirLicenciaId, calendario })`: lee el calendario una vez y lo pasa a las dos;
  - `proximoDiaConQuienAudite(proponenteId, desde, calendario)`.
  - `contextoDeCanal(fecha, config = null, calendario = null) → { personas, titulares, hayQuienFirme, calendario }` (sin calendario, `leerCalendario()`): así llega a `canalDelCambio` desde las dos corridas.
  - `seleccionarParaAuditoria(fecha, contexto)`: pone `dias_habiles_pendiente: calendario.diasHabilesTranscurridos(cambio.fecha_propuesta, fecha)` en cada nuevo y cada reiterado.
- Produces, en el contenido: `filaDeCambio` (`services/notasDigitalesContenido.js`) usa `cambio.dias_habiles_pendiente ?? CALENDARIO_FIJO.diasHabilesTranscurridos(cambio.fecha_propuesta, fecha)`, así sigue puro.
- Produces, en la corrida de las 14:00:
  - `enviarCambiosPendientes({ hoy, ahora, calendario })`:
    - `dia_habil` es `calendario.esDiaHabil(hoy)`;
    - pasa el calendario a `contextoDeCanal` y a `proximoDiaConQuienAudite`, a través de `avisarSinAuditor` y `enviarAvisoSinAuditor`, que lo reciben sin valor por defecto;
    - el resultado no cambia de forma.
  - `ejecutarNotificacionCambiosPendientes` lee `leerCalendario()` una vez y lo pasa. La respuesta suma `data.calendario` (`origen`).
    - Con `error`: `await anotarEnLaUltimaCorrida(MENSAJE_CORRIDA_SIN_FERIADOS).catch(() => {})` y 207 con `success: false`, también en un día no hábil (con el mismo mensaje «Hoy no es día hábil: no se envían recordatorios.»).

- [ ] **Step 1: Escribir los tests que fallan.**
  - **`tests/auditoria-reglas.test.js`,** `describe('con el calendario de la tabla')`, con `CAL`, `personas = [{ id: 1, rol: 'superadmin', disponible: true }, { id: 2, rol: 'admin', disponible: true }]` y `cambio = { usuario_id: 1, primer_recordatorio_fecha: '2026-10-30' }`:
    - **«con el primer recordatorio el viernes 30/10, el 03/11 sigue por recordatorio y el 04/11 pasa a la nota»:**
      - `canalDelCambio({ cambio, hoy: '2026-11-03', personas, titulares: [1], hayQuienFirme: true, calendario: CAL })` es `'recordatorio'`;
      - el `'2026-11-04'`, `'nota'`;
      - sin `calendario`, el 03/11 es `'nota'`.
    - **«la nota de auditoría se reitera a los 5 días hábiles, sin el 09/11»:** `seccionDeAuditoria('2026-11-04', '2026-11-11', CAL)` es null; con el `'2026-11-12'`, `'reiterado'`; sin `CAL`, el 11/11 ya es `'reiterado'`.
    - **«el 09/11 no corta el período y la vuelta es el 10/11»:**
      - `agruparDiasSinAuditor` con `dias` del 06/11, el 09/11 y el 10/11 (el 06/11 sin auditor; el 09/11 y el 10/11, con uno) y `hasta` `'2026-11-06'`;
      - con `CAL`, salta el 09/11 y da `[{ desde: '2026-11-06', hasta: '2026-11-06', vuelve: '2026-11-10', respaldo: [] }]`;
      - sin `CAL`, `vuelve: '2026-11-09'`.
  - **`tests/feriados-en-notas.test.js`,** `describe('auditoría: un solo calendario a las 8:15 y a las 14:00')`.
    - Arma: el titular firmante con firma, otro admin, `configurarNotas({ para_auditoria: 'auditoria@rpad.test' })` y un cambio del titular, `created_at` el 30/10 a las 12:00 en hora argentina y `primer_recordatorio_at` `'2026-10-30 14:00:00'`. Los tests:
    - **«el 03/11 va por recordatorio a las 8:15 y a las 14:00»:**
      - `motor.ejecutarNotasDigitales({ hoy: '2026-11-03' })` no genera la nota de auditoría (ninguna `generadas` de tipo `'auditoria'`);
      - `avisos.enviarCambiosPendientes({ hoy: '2026-11-03' })` da `canal_nota` 0 y le llega al otro admin.
    - **«el 04/11 va por nota en las dos»:** la corrida genera la nota de auditoría con ese cambio en «nuevos», y a las 14:00 `canal_nota` es 1 y `enviados` está vacío.
    - **«la nota del 04/11 dice 2 días hábiles pendiente» (Review Focus 3):** en el HTML de la nota, la celda de ese cambio es `2`; con los 9 fijos sería 3.
    - **«el 02/11 la corrida de las 14:00 no es día hábil»:** `dia_habil` false y Mailpit sin mensajes.
    - **«proximoDiaConQuienAudite desde el sábado 07/11 es el 10/11».**
    - **«periodosSinAuditor: con los dos auditores de licencia del 03/11 al 06/11, la vuelta es el 10/11».**
    - **«con la tabla renombrada, la de las 14:00 responde 207 y lo anota en la última corrida»:**
      - `ejecutarNotificacionCambiosPendientes({}, res)`, con un `res` falso que guarda `status` y `json`;
      - 207, `data.calendario` `'fijos'`;
      - `ultima_corrida_resultado` incluye `MENSAJE_CORRIDA_SIN_FERIADOS`, con `con_errores` 1.
- [ ] **Step 2: Correr los tests y ver que fallan.**
  - `node --test tests/auditoria-reglas.test.js`: FAIL (el canal con `CAL` todavía da `'nota'`).
  - Con el candado, `node --test tests/feriados-en-notas.test.js`: FAIL.
- [ ] **Step 3: Implementar.** Sacar `auditoriaReglas.js`, `auditoriaService.js` y `notasDigitalesContenido.js` de `PENDIENTES_DE_LA_TANDA_1`.
- [ ] **Step 4: Correr los tests y ver que pasan.**
  - Los dos de arriba: PASS.
  - Con el candado, `node --test tests/avisos-diarios.test.js tests/notas-auditoria.test.js tests/auditoria-api.test.js tests/auditoria-datos.test.js tests/notas-contenido.test.js`: PASS sin tocarlos.
- [ ] **Step 5: Commit.**

  `git add services/auditoriaReglas.js services/auditoriaService.js services/notasDigitalesContenido.js services/avisosDiariosService.js controllers/notificacionesController.js tests/auditoria-reglas.test.js tests/feriados-en-notas.test.js tests/calendario-unico.test.js && git commit -m "feat(feriados): el canal de cada cambio pendiente, los días sin auditor y la corrida de las 14:00 con el calendario" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 4: El motor de las Notas Digitales

**Files:**
- Modify: `services/notasDigitales.js`, `services/notasDigitalesDatos.js`, `tests/feriados-en-notas.test.js`

**Interfaces:**
- Consumes: Tasks 1 a 3.
- Produces:
  - **`ejecutarNotasDigitales({ hoy, usuarioId, calendario })`:**
    - sin calendario, `await leerCalendario()`;
    - antes de `conBloqueo`, si `calendario.error !== null`: `anotarError(resumen, { tipo: 'feriados' }, new Error(MENSAJE_CORRIDA_SIN_FERIADOS))`. Así queda antes de mirar si el envío está activo, lo escribe `registrarFin` y, si la corrida termina «ocupada», queda solo en lo que se devuelve;
    - el resumen suma `calendario: calendario.origen`.
  - **Internas, sin valor por defecto:**
    - `correrPasos(resumen, hoy, usuarioId, calendario)`, con la puerta del día en `calendario.esDiaHabil(hoy)`;
    - `prepararAviso(gestion, hoy, anticipo, calendario)`, con `cuenta_desde: calendario.proximoDiaHabil(sumarDias(d.apertura_mes, -VENTANA_DIAS[gestion]))`;
    - `contextoDelDia(config, fecha, calendario)`, que lo pasa a `autorizacionPendiente` y a `anticipoPorLicencia`.
  - **`avisoDelDia({ gestion, fecha, modo, licencia, anticipo, autorizacion, calendario })`** (exportada: `calendario ?? await leerCalendario()`). Lo pasa a `disponibilidadDelAutorizado` y a `pendientesEnSuFecha`.
  - **`pendientesEnSuFecha(gestion, hoy, licencia, ausencias = [], calendario)`** (`services/notasDigitalesDatos.js`; `calendario ?? await leerCalendario()`), con `diaDelAvisoEnSuFecha({ …, calendario })`.
  - **Lo demás:** la reiteración y la auditoría usan el calendario de la corrida, con `contextoDeCanal(hoy, config, calendario)`.

- [ ] **Step 1: Escribir los tests que fallan.** En `tests/feriados-en-notas.test.js`, `describe('la corrida de las Notas Digitales con la precarga')`, con `correr = (hoy) => motor.ejecutarNotasDigitales({ hoy })` y los ayudantes `notas()`, `datasetsDe()`, `notaDeAutorizacionDe()` y `ultimaCorrida()` copiados de `notas-licencias` y `notas-motor`:
  - **«el lunes 02/11/2026 es «Día no hábil» y el martes 03/11 salen el aviso interno del 31/12 y la reiteración de noviembre»:**
    - datasets internos que vencen el `'2026-12-31'` y el `'2026-10-31'`;
    - el 02/11, `resumen.motivo` es `'Día no hábil'`, `resumen.calendario` `'tabla'` y no hay notas;
    - el 03/11, `generadas.map(g => [g.tipo, g.gestion])` es `[['aviso', 'interna'], ['reiteracion', 'interna']]`.
  - **«el 09/11 no genera nada»:** un interno que vence el `'2027-01-08'`. El 09/11, `'Día no hábil'` y ninguna nota; el 10/11 sale su aviso.
  - **«la víspera de una licencia del firmante desde el 09/12, con persona autorizada, es el viernes 04/12, y el 07/12 no genera nada»:**
    - `licencia(titular, '2026-12-09', '2027-01-08', autorizado)` y un externo que vence el `'2027-01-31'`;
    - el 04/12: una nota `['aviso', 'externa', '2026-12-04']`, `datasetsDe` `[{ dataset_id, cuenta_desde: '2026-12-22' }]` y la licencia con esa nota como nota de autorización;
    - el 07/12: `'Día no hábil'` y sigue habiendo una sola nota.
  - **«un cuenta_desde guardado en un feriado de la tabla se presenta el hábil anterior dentro de la licencia» (Review Focus 1):**
    - la licencia del titular del 03/12 al 18/12 con la autorizada, y un aviso anticipado ya enviado (`crearNota`) con un externo de `cuentaDesde` `'2026-12-07'`, que es la nota de autorización de la licencia;
    - la corrida del 04/12 genera el aviso en su fecha con ese dataset, presentado por ella;
    - su `cuenta_desde` guardado sigue en `'2026-12-07'`.
  - **«con la tabla renombrada usa los 9 fijos, queda con errores y dice qué calendario usó»:**
    - `conLaTablaRenombrada(() => correr('2026-11-02'))`, con un interno que vence el 31/12;
    - `resumen.calendario` es `'fijos'`, `resumen.errores.map(e => e.tipo)` `['feriados']` y su `mensaje`, `MENSAJE_CORRIDA_SIN_FERIADOS`;
    - sale el aviso interno;
    - la última corrida con `con_errores` 1 y el texto en `resultado`;
    - con `configurarNotas({ envio_activo: 0 })`: `motivo` `'Envío automático desactivado'` y el mismo error.
  - **«ocupada, con la tabla sin leer, el error queda solo en lo que devuelve» (Review Focus 2):** con el candado tomado en otra conexión (`tomarBloqueoAjeno` de `notas-motor`) y la tabla renombrada, el resumen trae `motivo` `'Otra corrida en curso'` y el error `feriados`, y la última corrida no cambia.
- [ ] **Step 2: Correr los tests y ver que fallan.** Con el candado, `node --test tests/feriados-en-notas.test.js`: FAIL (el 02/11 corre con los 9 fijos).
- [ ] **Step 3: Implementar.** `notasDigitales.js` sigue en `PENDIENTES_DE_LA_TANDA_1` hasta la Task 7: el Estado y la vista previa todavía usan las fijas.
- [ ] **Step 4: Correr los tests y ver que pasan.** Con el candado, `node --test tests/feriados-en-notas.test.js tests/notas-motor.test.js tests/notas-licencias.test.js tests/notas-datos.test.js tests/notas-auditoria.test.js`: PASS. Los cuatro de antes, sin tocarlos.
- [ ] **Step 5: Commit.**

  `git add services/notasDigitales.js services/notasDigitalesDatos.js tests/feriados-en-notas.test.js && git commit -m "feat(feriados): la corrida de las Notas Digitales con el calendario, y los 9 fijos con un error si la tabla no se lee" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 5: La corrida de las 8:15 completa

**Files:**
- Modify:
  - el código: `controllers/notificacionesController.js`, `services/avisosDiariosService.js` y `services/avisosSuperadminService.js`;
  - los tests: `tests/notificaciones.test.js`, `tests/feriados-en-notas.test.js` y `tests/calendario-unico.test.js`.

**Interfaces:**
- Consumes: Tasks 1 a 4.
- Produces:
  - **El email de los 40 días:**
    - `datasetsExternosPorArea(fecha, calendario)` (`calendario ?? await leerCalendario()`) usa `calendario.rangoDeAviso`;
    - `enviarAvisoAreas({ hoy, calendario })` usa ese mismo objeto para `dia_habil` y para el rango. El resultado no cambia de forma.
  - **El resumen al superadmin:** `enviarResumenAvisosRetenidos({ hoy, calendario })`, con `calendario.esDiaHabil(hoy)`. El resultado no cambia de forma.
  - **`ejecutarNotificacionesDiarias`:**
    - lee `const calendario = await leerCalendario()` una vez, al principio;
    - lo pasa a `enviarAvisoAreas`, a `enviarResumenAvisosRetenidos` y a `ejecutarNotasDigitales`;
    - `resultados.dia_habil ??= calendario.esDiaHabil(hoy)` y `resultados.calendario = calendario.origen`.
  - **`export const fechaDelProximoAviso = (calendario, hoy = hoyArgentina()) => calendario.proximoDiaHabil(hoy)`:** `previewEmail` y `pruebaAvisoArea` leen `leerCalendario()` y le pasan el mismo objeto a `datasetsExternosPorArea`.
  - **`tests/notificaciones.test.js`:** `const HOY_ES_HABIL = (await leerCalendario(db())).esDiaHabil(hoyArgentina())`, con el pool de `helpers.js`. Si `error` no es null, tira: falla en lugar de decidir con los fijos.

- [ ] **Step 1: Escribir los tests que fallan.** En `tests/feriados-en-notas.test.js`, `describe('la corrida de las 8:15: el email de los 40 días y el resumen al superadmin')`:
  - **«el viernes 06/11 avisa también lo que vence el 19/12 (el lunes 09/11 es feriado), el 09/11 no sale y el 10/11 no lo repite»:**
    - un área con email y un externo que vence el `'2026-12-19'`;
    - `enviarAvisoAreas({ hoy: '2026-11-06' })` da `enviados.map(e => e.cantidad)` `[1]`;
    - el 09/11, `{ dia_habil: false, enviados: [], errores: [], sin_datasets: true }`;
    - el 10/11, `enviados` vacío.
  - **«el resumen de avisos retenidos no sale el 02/11 y sale el 03/11»:**
    - un superadmin disponible y un aviso retenido en `usuarios_auditoria`;
    - `{ enviado: false, cantidad: 0 }` el 02/11 y `{ enviado: true, cantidad: 1 }` el 03/11.
  - **«fechaDelProximoAviso»:** con `calendarioCon(FILAS_PRECARGA)`, el `'2026-11-07'` da `'2026-11-10'`.
  - **«la corrida de las 8:15 dice qué calendario usó»,** con `mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-02T11:15:00Z') })`, como `tests/mi-espacio-avisos.test.js`, y `ejecutarNotificacionesDiarias({}, res)`:
    - con la tabla: `data.calendario` `'tabla'`, `data.dia_habil` false y `data.notasDigitales.motivo` `'Día no hábil'`;
    - con la tabla renombrada: 207, `data.calendario` `'fijos'`, `data.dia_habil` true y algún error `{ tipo: 'notas-digitales', paso: 'feriados' }`.
- [ ] **Step 2: Correr los tests y ver que fallan.** Con el candado, `node --test tests/feriados-en-notas.test.js`: FAIL.
- [ ] **Step 3: Implementar.** Sacar `avisosDiariosService.js`, `avisosSuperadminService.js` y `controllers/notificacionesController.js` de `PENDIENTES_DE_LA_TANDA_1`.
- [ ] **Step 4: Correr los tests y ver que pasan.** Con el candado, `node --test tests/feriados-en-notas.test.js tests/avisos-diarios.test.js tests/avisos-superadmin.test.js tests/notificaciones.test.js tests/permisos.test.js tests/calendario-unico.test.js`: PASS. Los de antes, sin tocarlos (salvo la línea de `HOY_ES_HABIL`).
- [ ] **Step 5: Commit.**

  `git add controllers/notificacionesController.js services/avisosDiariosService.js services/avisosSuperadminService.js tests/notificaciones.test.js tests/feriados-en-notas.test.js tests/calendario-unico.test.js && git commit -m "feat(feriados): la corrida de las 8:15 lee el calendario una vez y lo usa en el email de los 40 días y en el resumen al superadmin" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 6: Correos → Estado con las fechas reales

**Files:**
- Modify:
  - el servidor: `services/notasDigitalesFirmas.js`, `services/notasDigitales.js` y `controllers/notasDigitalesController.js`;
  - la página: `public/js/correos.js` y `public/correos.html`;
  - los tests: `tests/correos-frontend.test.js`, `tests/paginas.test.js`, `tests/notas-licencias.test.js` y `tests/feriados-en-notas.test.js`.

**Interfaces:**
- Consumes: `visperaDeLaLicencia` (Task 2), `MENSAJE_ESTADO_SIN_FERIADOS` (Task 1).
- Produces:
  - **`modoDelDia(config, fecha) → Promise<{ modo, licencia }>`** (`notasDigitalesFirmas.js`):
    - el mismo modo que `firmaParaFecha`, sin leer las imágenes de las firmas (que la persona autorizada tenga la suya se mira con `imagen IS NOT NULL`);
    - `firmaParaFecha` la usa primero y lee las firmas solo para el modo que da. Si al leerlas la persona autorizada ya no sirve, `'sin_autorizado'`.
  - **`primerDiaConNotas(config, desde, calendario) → Promise<string | null>`** (exportada; `calendario ?? await leerCalendario()`):
    - el primer día desde `desde`, hasta `desde` + 366 inclusive, que es hábil con el calendario y cuyo `modoDelDia` no es `'sin_autorizado'`; null si no hay;
    - salta los no hábiles con el predicado, de a uno (nunca con `proximoDiaHabil`: no tira) y, en una licencia sin autorizado, como hoy `fechaDeVistaPrevia`.
  - **`fechaDeVistaPrevia(config, hoy, calendario)`:** `{ fecha: (await primerDiaConNotas(…)) ?? hoy, motivo }`, con el motivo de siempre, mirado con el calendario.
  - **`licenciaDelFirmante(config, hoy, calendario)`.** `publica` suma `sin_anticipo` al final, después de `vuelta`:
    - `vispera`, `sin_anticipo` y `sin_dias_habiles` salen de `visperaDeLaLicencia(licencia, otras, calendario)`, con `otras` = `[licenciaEnFecha(titular, calendario.diaHabilAnterior(desde))]` si la hay;
    - `ultimo_habil = calendario.ultimoDiaHabilHasta(hasta)`;
    - `vuelta = (await primerDiaConNotas(config, sumarDias(hasta, 1), calendario)) ?? calendario.proximoDiaHabil(sumarDias(hasta, 1))`;
    - el día que se mira, con `calendario.proximoDiaHabil`, y `unirAusencias(…, calendario)`.
  - **`proximoAvisoEnSuFecha(gestion, corrida, delFirmante, config, calendario)`:** el día de cada pendiente es `primerDiaConNotas(config, max(dia_en_su_fecha, corrida))`, solo si no pasa de `titular.hasta`. Pasada la licencia no hay aviso en su fecha.
  - **`proximasFechas({ config, hoy, calendario }) → Promise<{ corrida, delFirmante, proximas: { interna, externa }, auditoria }>`** (interna): la única fuente de las fechas del Estado y de la vista previa. Con `corrida = calendario.proximoDiaHabil(hoy)`:
    - **El aviso de cada gestión:**
      - el candidato es `max(apertura − ventana, corrida)`;
      - si cae en la licencia del firmante (con días hábiles), con `vispera` no null y `vispera >= corrida`, la víspera, con la cantidad de `seleccionarParaAviso(gestion, vispera, ultimo_habil)`;
      - si no, `primerDiaConNotas(candidato)` (null: sin aviso), con la cantidad de ese día;
      - con persona autorizada, el aviso en su fecha si es antes o el mismo día.
    - **La reiteración:**
      - evaluada este mes: `primerDiaConNotas('<mes siguiente>-01')`; si no, `primerDiaConNotas(hoy)`;
      - `{ fecha, cantidad }`, con la cantidad de `seleccionarParaReiteracion` en esa fecha; sin fecha, `{ fecha: null, cantidad: 0 }`.
    - **La nota de auditoría** (`estadoAuditoria(config, hoy, calendario)`):
      - el canal, en `primerDiaConNotas(hoy) ?? corrida`;
      - la primera libre: ese día o, si ya salió la de ese día, `primerDiaConNotas` del siguiente;
      - cada reiteración: `primerDiaConNotas(calendario.sumarDiasHabiles(ultima, 5))`;
      - de los candidatos, de menor a mayor, el primero en que `contextoDeCanal` de esa fecha deja algún cambio en `'nota'`.
      - `periodos_sin_auditor` con el calendario.
  - **`estadoNotas({ hoy, calendario })`:**
    - sin calendario, `leerCalendario()`;
    - usa `proximasFechas` y `alertasDeCorrida(config, corrida, hoy, calendario)` (`debioCorrer = calendario.diaHabilAnterior(hoy)`);
    - con `calendario.error`, suma `{ tipo: 'feriados-sin-leer', nivel: 'error', mensaje: MENSAJE_ESTADO_SIN_FERIADOS }`.
  - **`verEstado`:** `estadoNotas({ calendario: await leerCalendario() })`, una lectura por pedido.
  - **`textoLicenciaFirmante(l)` (`correos.js`):**
    - después de `sin_dias_habiles`, con `!l.en_curso && l.sin_anticipo === true`, los dos textos nuevos;
    - `{nombre}` es `l.autorizado`;
    - `{vuelta}`, `fecha(l.vuelta)`.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **`tests/feriados-en-notas.test.js`,** `describe('Correos → Estado con las fechas reales')`:
    - **«el 30/10 anuncia el aviso interno del 31/12 y las reiteraciones de noviembre para el 03/11, y la corrida del 03/11 lo cumple»:**
      - un interno que vence el 31/12 y las dos reiteraciones evaluadas en `'2026-10'`;
      - `estadoNotas({ hoy: '2026-10-30' })` da `proximas.interna.aviso` `{ fecha: '2026-11-03', cantidad: 1 }` y las dos `reiteracion.fecha` `'2026-11-03'`;
      - `correr('2026-11-03')` genera el aviso interno.
    - **«el caso de la simulación: el firmante del 09/12 al 08/01 con la persona autorizada, y ella del 04/01 al 15/01: las reiteraciones de enero, el 11/01»:**
      - las licencias, un interno vencido sin aviso y las reiteraciones evaluadas en `'2026-12'`;
      - `estadoNotas({ hoy: '2026-12-21' })`: las dos `reiteracion.fecha` son `'2027-01-11'`;
      - el 04/01 la corrida no genera notas, y el 11/01 genera la reiteración interna.
    - **«licencias seguidas: vacaciones del 09/12 al 31/12 con la autorizada y una médica del 04/01 al 08/01 sin ella»:**
      - antes, `correr('2026-12-04')` comunica la autorización;
      - `estadoNotas({ hoy: '2026-12-21' }).licencia_firmante.vuelta` es `'2027-01-11'`;
      - el sábado `'2027-01-02'`, `licencia_firmante` tiene `desde` `'2027-01-04'`, `vispera` null, `sin_anticipo` true y `vuelta` `'2027-01-11'`.
    - **Review Focus 4:**
      - con un externo que vence el `'2027-02-15'` (su aviso caería el 06/01), `estadoNotas({ hoy: '2026-12-21' }).proximas.externa.aviso.fecha` es `'2027-01-11'`;
      - `correr('2026-12-31')` no lo anticipa; `correr('2027-01-06')` no genera nada, y `correr('2027-01-11')` genera su aviso.
    - **«lo mismo con una médica con persona autorizada (cargada en Configuración)»:**
      - el 02/01, `sin_anticipo` true y `autorizado` el de ella;
      - `correr('2027-01-04').generadas[0].tipo` es `'autorizacion'` y le siguen las notas con las dos firmas.
      - Si algo de esto no coincide con los textos de la sección 6, marcarlo «a mostrar al usuario» en el commit y avisar a la coordinadora. Por la lectura del código, coincide: la víspera dentro de la otra licencia no es modo titular, así que no hay anticipo, y la autorización sale tardía el primer día.
    - **«la próxima nota de auditoría, 5 días hábiles después de la del 04/11, es el 12/11»:**
      - un cambio en el canal nota, ya incluido en una nota de auditoría del 04/11 (`notas_digitales_cambios`);
      - `estadoNotas({ hoy: '2026-11-05' }).auditoria.proxima` es `'2026-11-12'`.
    - **«sin-corrida: el martes 03/11 debía haber corrido el viernes 30/10»:** con la última corrida del 30/10 y el envío activo, `estadoNotas({ hoy: '2026-11-03' }).alertas` no tiene `'sin-corrida'`.
    - **«con la tabla renombrada, la alerta feriados-sin-leer»,** con su nivel y su texto.
  - **`tests/notas-licencias.test.js`:**
    - «modoDelDia da el mismo modo que firmaParaFecha» en los casos del archivo: sin licencia, sin autorizado, con autorizado, ella de licencia, sin firma, inactiva y sin su rol;
    - «primerDiaConNotas da lo mismo que probar día por día», con los casos de la prueba de `fechaDeVistaPrevia` que ya existe, y null con dos licencias seguidas sin autorizado que cubren 400 días;
    - en los dos tests que fijan la forma de `licencia_firmante` (la lista de claves y el `deepEqual`), `sin_anticipo` al final, con `false`.
  - **`tests/correos-frontend.test.js`:**
    - `textoLicenciaFirmante({ desde: '2027-01-04', hasta: '2027-01-08', en_curso: false, autorizado: null, sin_dias_habiles: false, sin_anticipo: true, vispera: null, vuelta: '2027-01-11' })` es el texto sin autorizado, con «al 11/01/2027.»;
    - con `autorizado: 'Persona Autorizada'`, el texto con ella;
    - con `sin_anticipo: false`, los de siempre.
  - **`tests/paginas.test.js`:** `VERSION_CORREOS` nuevo.
- [ ] **Step 2: Correr los tests y ver que fallan.**
  - Con el candado, `node --test tests/feriados-en-notas.test.js tests/notas-licencias.test.js`: FAIL.
  - `node --test tests/correos-frontend.test.js tests/paginas.test.js`: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr los tests y ver que pasan.** Los mismos, más `tests/notas-api.test.js`, `tests/notas-auditoria.test.js` y `tests/notas-motor.test.js`: PASS.
- [ ] **Step 5: Commit.**

  `git add services/notasDigitalesFirmas.js services/notasDigitales.js controllers/notasDigitalesController.js public/js/correos.js public/correos.html tests/correos-frontend.test.js tests/paginas.test.js tests/notas-licencias.test.js tests/feriados-en-notas.test.js && git commit -m "feat(feriados): Correos → Estado anuncia las fechas reales: el primer día con notas, la víspera sin anticipo y la alerta si no se leen los feriados" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 7: Vista previa y prueba con la fecha real

**Files:**
- Modify:
  - el código: `services/notasDigitales.js`, `controllers/notasDigitalesController.js` y `public/js/correos.js`;
  - los tests: `tests/correos-frontend.test.js`, `tests/feriados-en-notas.test.js` y `tests/calendario-unico.test.js`.

**Interfaces:**
- Consumes: `proximasFechas`, `fechaDeVistaPrevia` y `primerDiaConNotas` (Task 6).
- Produces:
  - **`diaDeVistaPrevia(config, hoy, calendario, { tipo, gestion }) → { fecha, motivo, otro_dia, contexto, firma }`** (interna):
    - `motivo` es el de `fechaDeVistaPrevia`, que dice por qué hoy no hay notas;
    - la fecha, según el tipo:
      - el aviso, la de `fechaDeVistaPrevia`;
      - la reiteración, `proximas[gestion].reiteracion.fecha` de `proximasFechas`, o la de `fechaDeVistaPrevia` si es null;
      - la auditoría, `auditoria.proxima`, o la de `fechaDeVistaPrevia` si es null;
    - `otro_dia: fecha !== hoy`;
    - `contexto = contextoDelDia(config, fecha, calendario)`.
  - **Las de la vista previa:**
    - `previewNota`, `previewPdf`, `previewAnexo` y `enviarPrueba` reciben `calendario`, con `leerCalendario()` por defecto;
    - `previewNota` devuelve también `otro_dia`, y `enviarPrueba` también;
    - `contenidoDeAuditoriaParaMostrar(config, fecha, calendario)`;
    - `ejemploAuditoria(hoy, calendario)`: el ejemplo pone `dias_habiles_pendiente`.
  - **`mensajeDePrueba({ destinatarios, ejemplo, motivo, fecha, otro_dia })`:** aclara «como saldría el {fecha}» con `motivo || otro_dia === true`. `enviarPrueba` del controlador manda `otro_dia` en `data`.
  - **`textoDeVistaPrevia({ ejemplo, tipo, cantidad, asunto, fecha, motivo, otro_dia })` (`correos.js`):**
    - con `motivo`, como hoy;
    - sin `motivo` y con `otro_dia === true`, la primera línea «Esta nota no sale hoy: así saldría el {fecha}.» y la segunda de «ese día»;
    - si no, como hoy.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **`tests/feriados-en-notas.test.js`,** `describe('vista previa y prueba con la fecha real')`:
    - **«la reiteración muestra la del 01/12 si la de noviembre ya salió»:**
      - con las reiteraciones evaluadas en `'2026-11'`, `previewNota({ tipo: 'reiteracion', gestion: 'interna', hoy: '2026-11-04' })` da `fecha` `'2026-12-01'`, `motivo` null y `otro_dia` true;
      - es la `reiteracion.fecha` de `estadoNotas({ hoy: '2026-11-04' })`.
    - **«el aviso, el primer día con notas»:** el `'2026-11-02'` da `fecha` `'2026-11-03'`, `motivo` `'día no hábil'` y `otro_dia` true.
    - **«la auditoría, la que anuncia el Estado; sin ninguna, el primer día con notas»:**
      - con el arreglo de la Task 6, `previewNota({ tipo: 'auditoria', hoy: '2026-11-05' }).fecha` es `'2026-11-12'`;
      - sin cambios, `'2026-11-05'` y `otro_dia` false.
    - **«la prueba de la reiteración dice qué día muestra»:**
      - `enviarPrueba({ tipo: 'reiteracion', gestion: 'interna', hoy: '2026-11-04' })` da `fecha` `'2026-12-01'` y `otro_dia` true;
      - `mensajeDePrueba` termina en `como saldría el 01/12/2026)`.
    - **«mensajeDePrueba»,** sin la base:
      - `{ destinatarios: ['prueba@rpad.test'], ejemplo: false, motivo: null, fecha: '2026-12-01', otro_dia: true }` da `'Prueba enviada a prueba@rpad.test (como saldría el 01/12/2026)'`;
      - con `otro_dia: false`, `'Prueba enviada a prueba@rpad.test'`.
  - **`tests/correos-frontend.test.js`:**
    - `textoDeVistaPrevia({ ejemplo: false, tipo: 'reiteracion', cantidad: 3, asunto: 'Reiteración', fecha: '2026-12-01', motivo: null, otro_dia: true })` es `'Esta nota no sale hoy: así saldría el 01/12/2026.\nCon los datos de hoy, ese día esta nota incluiría 3 dataset(s). Asunto: Reiteración'`;
    - con `ejemplo: true`, la segunda línea es `'Ese día no saldría ninguna nota de este tipo: se muestran datos de ejemplo.'`;
    - los tests de hoy, sin `otro_dia`, no cambian.
- [ ] **Step 2: Correr los tests y ver que fallan.** Con el candado, `node --test tests/feriados-en-notas.test.js`, y `node --test tests/correos-frontend.test.js`: FAIL.
- [ ] **Step 3: Implementar.** Sacar `services/notasDigitales.js` de `PENDIENTES_DE_LA_TANDA_1`.
- [ ] **Step 4: Correr los tests y ver que pasan.** Los mismos, más con el candado `tests/notas-api.test.js`, `tests/notas-licencias.test.js` y `tests/notas-motor.test.js`, y `tests/calendario-unico.test.js`: PASS.
- [ ] **Step 5: Commit.**

  `git add services/notasDigitales.js controllers/notasDigitalesController.js public/js/correos.js tests/correos-frontend.test.js tests/feriados-en-notas.test.js tests/calendario-unico.test.js && git commit -m "feat(feriados): la vista previa y la prueba de la reiteración y la auditoría muestran el día real en que salen" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 8: Configuración → Licencias

**Files:**
- Modify:
  - el código: `controllers/licenciasController.js`, `services/licenciasOficialesService.js`, `public/js/usuarios.js` y `public/configuracion.html` (la versión de `usuarios.js`);
  - los tests: `tests/usuarios-frontend.test.js`, `tests/paginas.test.js`, `tests/feriados-en-notas.test.js` y `tests/calendario-unico.test.js`.

**Interfaces:**
- Consumes: `visperaDeLaLicencia` y `unirAusencias` con el calendario (Task 2), `periodosSinAuditor` (Task 3) y `leerCalendario` (Task 1).
- Produces:
  - **`aRespuesta(fila, hoy, titular, { calendario, delTitular })`:** en una licencia del titular suma `vispera`, `sin_anticipo` y `sin_dias_habiles`, de `visperaDeLaLicencia(fila, delTitular sin la fila, calendario)`; en las demás, `null`, `false` y `false`.
    - `listarLicencias`, `crearLicencia`, `editarLicencia` y `anularLicencia` leen `leerCalendario()` y las licencias sin anular del titular en una consulta (`SELECT id, desde, hasta FROM usuarios_licencias WHERE usuario_id = ? AND anulada = 0`) para armarla.
    - Si el calendario cayó a los fijos, sigue con ellos (`leerCalendario` ya lo anota en la consola).
  - **`conSusLicencias(personas, hoy, calendario)`:** `calendario ?? await leerCalendario()`, con `unirAusencias(…, calendario)` y `vuelve: calendario.proximoDiaHabil(sumarDias(a.hasta, 1))`.
  - **`rechazoDeLaBase(conexion, { …, calendario })`:** solo cuando controla a la persona autorizada, `calendario ?? await leerCalendario(conexion)`, dentro de la transacción y después de `bloquearUsuarios`; lo pasa a `disponibilidadDelAutorizado`.
    - `cargarLicencia` y `cambiarLicencia` suman la clave `calendario` y la pasan.
  - **`listarDiasSinAuditor`:** ya usa la tabla por `periodosSinAuditor` (Task 3); no cambia.
  - **`efectoEnNotas(licencia, autorizadoNombre, hoy)` (`usuarios.js`):** después de la rama en curso, con `licencia?.sin_dias_habiles === true` «No tiene días hábiles: las notas no cambian.» y, con `licencia?.sin_anticipo === true`, los dos textos de la sección 6. El formulario, antes de guardar, no le pregunta al servidor (spec).

- [ ] **Step 1: Escribir los tests que fallan.**
  - **`tests/feriados-en-notas.test.js`,** `describe('Configuración → Licencias con la precarga')`, con los controladores llamados con un `res` falso:
    - **«la víspera de la licencia del firmante desde el 09/12 es el 04/12»:** `listarLicencias({ query: { incluir_pasadas: '1' }, user: { userId: titular.id } }, res)` da `vispera` `'2026-12-04'` y `sin_anticipo` false.
    - **«licencias seguidas: la segunda, sin víspera»:** `vispera` null y `sin_anticipo` true.
    - **«el 409 de la persona autorizada sin días, con la tabla»:**
      - en una transacción, después de `bloquearUsuarios`, con la autorizada de licencia el 09/12;
      - `rechazoDeLaBase(conexion, { usuarioId: titular.id, desde: '2026-12-07', hasta: '2026-12-09', autorizadoId: autorizado.id, autorizadoNuevo: true })` da `motivo` `'autorizado_sin_dias'`, porque el 07/12 y el 08/12 no son hábiles;
      - con los 9 fijos sería null.
    - **«la lectura que falla dentro de la transacción no la rompe» (Review Focus 5):**
      - con la tabla renombrada, la misma carga con `cargarLicencia` no se rechaza (con los fijos, el 07/12 es hábil);
      - el `COMMIT` confirma y la licencia queda en la base.
    - **«conSusLicencias con el 02/11 y el 09/11»:**
      - la autorizada del 26/10 al 30/10 y del 03/11 al 06/11, con `hoy` `'2026-10-20'`;
      - una ausencia unida `{ desde: '2026-10-26', hasta: '2026-11-06', vuelve: '2026-11-10' }`.
    - **«los días sin auditor vuelven el 10/11»:** `listarDiasSinAuditor({ query: { desde: '2026-11-02', hasta: '2026-11-10' } }, res)`, con los dos auditores de licencia del 03/11 al 06/11, da un período con `vuelve` `'2026-11-10'`.
  - **`tests/usuarios-frontend.test.js`:**
    - `efectoEnNotas({ desde: '2027-01-04', vispera: null, sin_anticipo: true }, null, '2026-12-21')` y lo mismo con `'Persona Autorizada'`: los dos textos, enteros;
    - `efectoEnNotas({ desde: '2026-11-07', vispera: null, sin_dias_habiles: true }, null, '2026-10-20')`: el texto nuevo;
    - con la licencia en curso, el de siempre.
  - **`tests/paginas.test.js`:** `VERSION_PANTALLAS` nuevo.
- [ ] **Step 2: Correr los tests y ver que fallan.** Con el candado, `node --test tests/feriados-en-notas.test.js`, y `node --test tests/usuarios-frontend.test.js tests/paginas.test.js`: FAIL.
- [ ] **Step 3: Implementar.** Sacar `controllers/licenciasController.js` y `services/licenciasOficialesService.js` de `PENDIENTES_DE_LA_TANDA_1`.
- [ ] **Step 4: Correr los tests y ver que pasan.** Los mismos, más con el candado `tests/licencias-api.test.js` y `tests/licencias-datos.test.js` (sin tocarlos), y `tests/calendario-unico.test.js`: PASS.
- [ ] **Step 5: Commit.**

  `git add controllers/licenciasController.js services/licenciasOficialesService.js public/js/usuarios.js public/configuracion.html tests/usuarios-frontend.test.js tests/paginas.test.js tests/feriados-en-notas.test.js tests/calendario-unico.test.js && git commit -m "feat(feriados): Configuración → Licencias con el calendario: la víspera real, sin anticipo a continuación de otra licencia y la vuelta de la persona autorizada" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 9: Mi espacio

**Files:**
- Modify:
  - el servidor: `services/miEspacioReglas.js`, `services/miEspacioPaso.js`, `services/miEspacioDatos.js` y `controllers/miEspacioController.js`;
  - la página: `public/js/mi-espacio.js` y `public/mi-espacio.html` (la versión);
  - los tests: `tests/mi-espacio-reglas.test.js`, `tests/mi-espacio-api.test.js`, `tests/mi-espacio-frontend.test.js`, `tests/paginas.test.js`, `tests/feriados-en-notas.test.js` y `tests/calendario-unico.test.js`.

**Interfaces:**
- Consumes: `calendarioCon` (Task 1), `visperaDeLaLicencia` (Task 2), `conSusLicencias` y `cargarLicencia`/`cambiarLicencia` con `calendario` (Task 8). La otra sesión ya dejó en main el modal de licencia de `mi-espacio.js`: la Task 0 lo vio.
- Produces, puras (`services/miEspacioReglas.js`, con `CALENDARIO_FIJO` por defecto):
  - `limiteParaCambiarTipo(desde, calendario)`;
  - `pasoDeLaCorreccion({ …, calendario })`, que se lo pasa a `limiteParaCambiarTipo`;
  - `pasoPrevistoDe({ paso, vinculo, fila, rol, hoy, soyTitular, comoAutorizada, delTitular, notasDeHoy, calendario })`:
    - `firmante` es `{ soy_titular, puede_autorizar, vispera, sin_anticipo, notas_de_hoy }`, con `vispera` y `sin_anticipo` de `visperaDeLaLicencia(fila, delTitular, calendario)`;
    - `AVISO_NOTAS_DE_HOY` y `notas_de_hoy` solo con `fila.desde <= hoy && notasDeHoy === true`.
- Produces, en la base:
  - `notasDeHoyDelTitular(titularId, hoy, conexion = pool) → Promise<boolean>` (`services/miEspacioDatos.js`): hay alguna nota de hoy, no de prueba, en cualquier estado, firmada por el titular (`fecha = ? AND es_prueba = 0 AND firmante_id = ?`, `LIMIT 1`).
  - `pasoPrevisto({ persona, anterior, fila, hoy, calendario }, conexion)`. Al titular le lee:
    - `delTitular`: `oficialesQueSeCruzan(conexion, persona.id, v, v)` con `v = calendario.diaHabilAnterior(fila.desde)`, sin la de Configuración del vínculo que se corrige;
    - `notasDeHoy`.
  - `aplicarCarga(conexion, { …, calendario })` y `aplicarCorreccion(conexion, { …, calendario })`, que lo pasan a `cargarLicencia`/`cambiarLicencia` y a `pasoDeLaCorreccion`.
  - En el controlador:
    - `calcularLicencia`, `cargarLicenciaMia` y `corregirLicenciaMia` arman `calendarioCon(filasFeriados)` con lo que ya lee `contextoDe`. Si no se pueden leer, Mi espacio falla como hoy;
    - `verFirmante` le pasa a `conSusLicencias` `calendarioCon(await filasDeFeriados())`.
- Produces, en la página: `efectoEnNotas` de `mi-espacio.js`, la copia exacta de la de `usuarios.js`. `htmlDelPaso` le pasa `{ desde, vispera: paso.firmante.vispera, sin_anticipo: paso.firmante.sin_anticipo }`.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **`tests/mi-espacio-reglas.test.js`:**
    - **«limiteParaCambiarTipo con la tabla»:** con `CAL`, `'2026-12-09'` da `'2026-12-03'` y `'2027-02-10'` da `'2027-02-04'`. Los tests de hoy, sin el calendario, no cambian.
    - **«pasoDeLaCorreccion con la tabla»:** unas vacaciones del 09/12 con persona a cargo que pasan a otro tipo:
      - el 04/12, con `CAL`, `{ error: { campo: 'tipo', mensaje: MENSAJES_MI_ESPACIO.tipoFijo } }`;
      - sin `CAL`, `'cambiar'`.
    - **«pasoPrevistoDe: la víspera con la tabla, sin anticipo y las notas de hoy»:**
      - unas vacaciones del 09/12 con `CAL`: `vispera` `'2026-12-04'` y `sin_anticipo` false;
      - con `delTitular` que incluye el 04/12: `vispera` null y `sin_anticipo` true;
      - con `desde` = hoy, `AVISO_NOTAS_DE_HOY` está en `avisos` solo con `notasDeHoy: true`, y `notas_de_hoy` lo sigue.
    - En los dos `deepEqual` de hoy con `firmante` (el de las vacaciones y el de «hoy mismo»), `sin_anticipo: false` después de `vispera`, y en «hoy mismo», `notasDeHoy: true` en la entrada.
  - **`tests/mi-espacio-api.test.js`:**
    - en los dos `deepEqual` de `firmante`, `sin_anticipo: false`;
    - en el de hoy, `notas_de_hoy` false y sin `AVISO_NOTAS_DE_HOY`;
    - nuevo, **«AVISO_NOTAS_DE_HOY solo si hoy salieron notas con tu firma»:** con una nota de hoy con `firmante_id` del titular, `notas_de_hoy` true y el aviso.
  - **`tests/feriados-en-notas.test.js`,** `describe('Mi espacio con la precarga')`:
    - `pasoPrevisto({ persona: titular, anterior: null, fila: <vacaciones del 09/12/2026 al 08/01/2027>, hoy: '2026-11-05', calendario: calendarioCon(FILAS_PRECARGA) })` da `paso.firmante.vispera` `'2026-12-04'`;
    - con una licencia de Configuración del titular que incluye el 31/12 y la fila desde el 04/01: `sin_anticipo` true.
  - **`tests/mi-espacio-frontend.test.js`:** la paridad de `efectoEnNotas` con `usuarios.js` suma `{ desde: '2027-01-04', vispera: null, sin_anticipo: true }` con y sin nombre, y `{ sin_dias_habiles: true }`. `htmlDelPaso` con `firmante.sin_anticipo: true` muestra el texto sin anticipo.
  - **`tests/paginas.test.js`:** `VERSION_MI_ESPACIO` nuevo.
- [ ] **Step 2: Correr los tests y ver que fallan.** `node --test tests/mi-espacio-reglas.test.js tests/mi-espacio-frontend.test.js tests/paginas.test.js` y, con el candado, `node --test tests/mi-espacio-api.test.js tests/feriados-en-notas.test.js`: FAIL.
- [ ] **Step 3: Implementar.** Sacar `services/miEspacioReglas.js` de `PENDIENTES_DE_LA_TANDA_1`, que queda vacía.
- [ ] **Step 4: Correr los tests y ver que pasan.** Los mismos, y `tests/calendario-unico.test.js`: PASS.
- [ ] **Step 5: Commit.**

  `git add services/miEspacioReglas.js services/miEspacioPaso.js services/miEspacioDatos.js controllers/miEspacioController.js public/js/mi-espacio.js public/mi-espacio.html tests/mi-espacio-reglas.test.js tests/mi-espacio-api.test.js tests/mi-espacio-frontend.test.js tests/paginas.test.js tests/feriados-en-notas.test.js tests/calendario-unico.test.js && git commit -m "feat(feriados): Mi espacio con el calendario: el límite para cambiar el tipo, la víspera y «las notas de hoy» solo si salieron" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

### Task 10: El aviso azul, la documentación y el cierre del test estático

**Files:**
- Modify: `public/configuracion.html`, `tests/paginas.test.js`, `tests/calendario-unico.test.js`, `CLAUDE.md`, `README.md`

- [ ] **Step 1: Escribir los tests que fallan.**
  - **`tests/paginas.test.js`:** el texto de `#feriados-aviso` es el de la tanda 1 (Global Constraints).
  - **`tests/calendario-unico.test.js`:** `PENDIENTES_DE_LA_TANDA_1` se borra; quedan `SIEMPRE` (el calendario y `feriadosReglas.js`) y `HASTA_LA_TANDA_2` (`metricasReglas.js` y `reportesAgenda.js`).
- [ ] **Step 2: Correr los tests y ver que fallan.** `node --test tests/paginas.test.js`: FAIL.
- [ ] **Step 3: El aviso, `CLAUDE.md` y `README.md`.**
  - **El aviso:** `public/configuracion.html`, `#feriados-aviso`, con el texto de la tanda 1.
  - **`CLAUDE.md`** (spec, sección 9):
    - «Recordatorios automáticos»: un solo calendario para las dos corridas y lo que las anuncia;
    - la caída a los 9 fijos, con su error en la última corrida y la alerta `feriados-sin-leer`;
    - `resultados.calendario` y `resumen.calendario`;
    - «Feriados»: deja de decir que el resto del sistema no cambia; hasta la tanda 2, Métricas, el Ciclo de vida, la foto y la Agenda de pedidos siguen con los 9 fijos;
    - «Firma de las Notas Digitales y licencia del firmante» y «Auditoría de cambios pendientes»: el calendario, la víspera sin anticipo y «el primer día con notas»;
    - la Estructura: `CALENDARIO_FIJO`, `derivadasDe`, `calendarioCon` y `leerCalendario`;
    - el test estático;
    - las convenciones de `usuarios.js` y `mi-espacio.js` (`efectoEnNotas` lee `sin_anticipo` y `sin_dias_habiles`) y de `correos.js` (`otro_dia` y `sin_anticipo`);
    - las versiones;
    - Despliegue: sin SQL, sin cron y sin Run NPM Install, antes del 03/12/2026.
  - **`README.md`:** las secciones de Feriados («Por ahora cuentan solo para Mi espacio», «Todavía no cambia ningún día hábil del sistema», lo que se mira después de desplegar) y el despliegue.
- [ ] **Step 4: Correr los tests y ver que pasan.** `node --test tests/paginas.test.js tests/calendario-unico.test.js`: PASS.
- [ ] **Step 5: Commit.**

  `git add public/configuracion.html tests/paginas.test.js tests/calendario-unico.test.js CLAUDE.md README.md && git commit -m "docs(feriados): el aviso de la pestaña Feriados, CLAUDE.md y el README de la tanda 1" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`
- [ ] **Step 6: La suite completa.** `npm test` completo con el candado: 0 fallas nuevas contra la línea de base de la Task 0, más los tests nuevos.

### Task 11: Verificación con la simulación (spec, sección 8)

No es una tarea de código. La corre la sesión que coordina la implementación (no la coordinadora de la cola), antes de la revisión final, fuera del repo.

- [ ] **Step 1: La carpeta.** Copiar `simulacion-mi-espacio/sim/` de la carpeta de notas compartida al scratchpad de la sesión, en `sim-feriados/`, con `base-27-10.sql`.
- [ ] **Step 2: Los dos códigos.**
  - Dos worktrees de solo lectura: el commit que está en producción (lo dice la coordinadora) y la punta de esta rama.
  - En `escenario-b.sh`, `extraer.mjs` y `formulario.mjs`, `CODIGO` apunta a uno o al otro según la variante, y la comprobación del hash, a ese commit.
- [ ] **Step 3: Los frenos.**
  - En `orquestador.mjs`, `reloj.mjs`, `escenario-b.sh`, `extraer.mjs` y `preparar.sh`, el nombre de la base acepta `^rpad_rama_feriados_notas$` y nada más.
  - Las dos variantes corren una detrás de la otra sobre esa base, que `preparar.sh` vuelve a crear desde `base-27-10.sql`.
  - `grep -rn "rpad_sim_mi_espacio_" sim-feriados/` no da nada.
- [ ] **Step 4: Los demás cambios.** `SIM_ETIQUETA` en `feriados-en-notas-produccion` y `feriados-en-notas-rama`; los textos fijos de `informe.mjs`, con los títulos de esta verificación.
- [ ] **Step 5: El escenario del usuario,** todo desde Mi espacio y a las 10:00 (13:00Z):
  - 30/10: un cambio pendiente propuesto por el firmante (acción nueva, `cambio`, que inserta en `cambios_pendientes`);
  - 05/11: el firmante carga sus vacaciones del 09/12/2026 al 08/01/2027, con la persona autorizada a cargo;
  - 20/11: la persona autorizada arranca su Mi espacio (los saldos de la simulación anterior) y carga sus vacaciones del 04/01 al 15/01/2027; en Configuración → Feriados, cuatro asuetos municipales, el 23, el 24, el 30 y el 31/12/2026;
  - 24/11: el firmante corrige el Día del Petróleo del 13/12 al 14/12/2026, con «Trasladado del 13/12»;
  - miradas a Correos → Estado (acción `estado`) el 28/10, 30/10, 03/11, 06/11, 20/11, 24/11, 03/12, 04/12, 21/12, 29/12, 04/01 y 11/01.
- [ ] **Step 6: Correr y mirar.**
  - Correr `escenario-b.sh produccion` y después `escenario-b.sh rama`, del 28/10/2026 al 05/02/2027, unos 2 minutos cada una.
  - Antes y después, `curl -s "http://127.0.0.1:8025/api/v1/messages?limit=1"`: los mensajes nuevos llevan solo las dos etiquetas.
  - Ningún proceso llama a `/api/cron`: los scripts importan los controladores.
- [ ] **Step 7: Lo que se tiene que ver en la variante de la rama:**
  - el 02/11, el 09/11 y el 23/11, «Día no hábil»;
  - el 03/11, el aviso interno del 31/12 y la reiteración de noviembre; el 24/11, el aviso externo del 31/12;
  - el cambio pendiente: recordatorio el 30/10 y el 03/11 a las 14:00, nota de auditoría el 04/11 a las 8:15 y ningún recordatorio ese día a las 14:00;
  - la víspera, el viernes 04/12, con la nota que comunica la autorización a la persona autorizada; nada el 07/12 ni el 08/12;
  - durante la licencia, ninguna nota el 14/12, el 23, 24, 25, 30 y 31/12, el 01/01 ni del 04/01 al 08/01. Los avisos en su fecha que caen en esos días se presentan el día hábil anterior en que la persona autorizada está;
  - las reiteraciones de enero, el 11/01;
  - cada fecha que anuncia el Estado (el próximo aviso, la reiteración, la auditoría, la víspera y la vuelta) es la que cumple después la corrida. El informe lo compara día por día y lista las diferencias; con la rama tiene que dar ninguna.
  - Ojo con «el Estado lo anuncia desde el 20/11»: hasta la corrida del 01/12, el Estado muestra la reiteración de diciembre (el 01/12). La de enero aparece desde el 01/12, ya con el 11/01. Que el informe diga cuándo aparece.
- [ ] **Step 8: La variante de producción** muestra las diferencias de la sección 3 de la spec (el 02/11, el 07/12 como víspera, el Estado con el 04/01): el informe las pone lado a lado.
- [ ] **Step 9: Cerrar.** Borrar `rpad_rama_feriados_notas`; dejar el informe en `C:\Users\Mariano\Desktop\RPAD-simulacion-feriados-en-notas\` y avisar a la sesión que hace la revisión final (lo que se vio y cualquier diferencia).
