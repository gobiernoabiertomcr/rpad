# El dato de la quincena en la agenda de Mi espacio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que la agenda de Mi espacio muestre, a todos los roles, las próximas 5 salidas del correo del dato de la quincena como un chip turquesa de solo lectura.

**Architecture:** una regla pura nueva en `services/datoQuincenaCorreoReglas.js` arma los ítems (con `proximasEdiciones` y `situacionDelEnvio`, sin copiarlas); `listarEventos` los suma a la respuesta de `GET /api/mi-espacio/eventos`, leídos aparte y aislados; `public/js/mi-espacio.js` los dibuja como al feriado.

**Tech Stack:** Node.js 22 (ES Modules), Express, MariaDB (mysql2/promise), vanilla JS, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-14-dato-quincena-en-mi-espacio-design.md` (aprobada el 14/11/2026). Leerla entera antes de cada tarea.

## Global Constraints

- Leer antes de tocar: `CLAUDE.md`, `docs/temas/dato-quincena-correo.md`, `docs/temas/mi-espacio-agenda.md`, `docs/temas/mi-espacio-agenda-mes.md`, `docs/temas/frontend.md`, `docs/temas/calendario-y-corridas.md`.
- El servidor arma todos los textos; la página los imprime tal cual, con `esc`. Ninguna regla se copia en el navegador.
- Textos exactos: `texto` «Dato de la quincena»; `nombre` «Sale el dato de la quincena» o «Salió el dato de la quincena»; `detalle` «Edición del lunes 23/11» + («: » + motivo, si va) + «.»; `titulo` `${nombre}, a las ${hora}. ${detalle}`; `hora` con dos cifras ('08:05', '14:00').
- Lenguaje neutro: nunca «tardanza», «demora», «atraso», «tarde», «sin respuesta», «sin entregar», «no mandó».
- Una sola lectura de feriados por pedido: el calendario del dato es `calendarioCon(filasFeriados)` con las filas que `listarEventos` ya lee. `tests/calendario-unico.test.js` no se toca.
- Hoy es `ahoraArgentina()` del controlador; las reglas reciben `ahora` por parámetro, sin `Date` local.
- Nada personal en la respuesta: ni emails, ni nombres, ni la lista del correo.
- En el código, la agenda es `evento` o `mi_espacio_`, nunca «agenda» a secas.
- Colores: `--sg-turquesa: #1E5C56`, `--sg-turquesa-borde: #2B7A73`, `--sg-turquesa-fondo: #DCF1EE`, en el `:root` del `<style>` de `mi-espacio.html`; el `<style>` usa solo `--sg-*`, `--f-titulo` y `--f-texto`.
- Ícono: Lucide «newspaper», el de `public/dato-quincena.html:357` (`<path d="M15 18h-5"/><path d="M18 14h-8"/><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2"/><rect width="8" height="4" x="10" y="6" rx="1"/>`).
- Repositorio público: ningún nombre real ni dato de producción en código, tests ni docs.
- Ningún mail real; nunca `docker compose` desde el worktree; la suite completa solo con «CONTENEDOR LIBRE» de la coordinadora. Mientras tanto, cada tarea corre solo los archivos de test que toca (con `node --test <archivo>`; los de API necesitan el contenedor: si no está libre, se corren en la Task 5).
- Docs: un renglón por oración, lo vigente, sin historia; ningún renglón de más de 600 caracteres (`tests/documentos.test.js`).
- Commit y push de la rama al terminar cada tarea (cortes de luz). Mensajes en español, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- La edición del 09/11/2026 de producción es una regular archivada antes del correo del RPAD (`correo` null): la agenda no la muestra y sigue con la serie (Task 1, test «una regular sin correo del RPAD»).
- Un nombre de feriado con `<`, `"` o `&` (lo carga administración en Configuración → Feriados) llega en el `detalle` y el `titulo`: se escapa en la casilla, en el día elegido y en «Próximos» (Task 3, test del escapado).
- Un mes sin ninguna fecha del dato, con el envío prendido: `dato_quincena: []` y la muestra de la leyenda visible (Task 2 y Task 4).
- La lectura del dato falla (falta la tabla de la configuración): la agenda responde 200 con `dato_quincena: []` y `dato_quincena_activo: false` (Task 2, test con `RENAME TABLE`).
- Un lunes cargado (feriado o licencia, compañeros y eventos): el chip del dato entra en «y N más» sin romper el orden (Task 3, test de `cosasPorDia` con un día lleno).

---

### Task 1: La regla — `proximasEdiciones` con `desdeLaSalida` y `datoQuincenaEnMiEspacio` (Opus: regla, lista fija)

**Files:**
- Modify: `services/datoQuincenaCorreoReglas.js` (`proximasEdiciones`, `:662`; la función nueva, debajo)
- Test: `tests/dato-quincena-correo-reglas.test.js` (junto al describe de `proximasEdiciones`, `:894`)
- Docs: `docs/temas/dato-quincena-correo.md`

**Interfaces:**
- Produces:
  - `proximasEdiciones({ ultimaRegular, hoy, calendario, filasDeFeriados, cantidad = 4, desdeLaSalida = false })`: lo mismo de hoy; con `desdeLaSalida === true`, el bucle salta mientras `proximoDiaHabil(edicion) < hoy` en lugar de `edicion < hoy`.
  - `export const CUANTAS_EN_MI_ESPACIO = 5`.
  - `export const datoQuincenaEnMiEspacio = ({ envioActivo, ultima, ahora, calendario, filasDeFeriados }) => Array<{ fecha, hora, texto, nombre, titulo, detalle }>`, por fecha, hasta 5. `ultima`: `{ fecha_edicion, correo, envios }` (correo: la fila de `correosDeLasEdiciones` o null; envios: sus filas automáticas) o null. `ahora`: 'AAAA-MM-DD HH:MM:SS' argentino.

- [ ] **Step 1: Escribir los tests que fallan** — un describe nuevo, `datoQuincenaEnMiEspacio: las fechas de la agenda de Mi espacio (spec 2026-11-14-dato-quincena-en-mi-espacio)`, con `CALENDARIO` y `FILAS_PRECARGA` del archivo y los ayudantes `correo`, `enviado`, `fallido` que ya existen:

```js
const enMiEspacio = (cambios = {}) => datoQuincenaEnMiEspacio({
  envioActivo: true, ultima: null, ahora: '2026-11-14 18:12:00', calendario: CALENDARIO, filasDeFeriados: FILAS_PRECARGA, ...cambios
});
const ultimaDel = (fecha_edicion, correoDeLa, envios = []) => ({ fecha_edicion, correo: correoDeLa, envios });
const SOBERANIA = 'Edición del lunes 23/11: no es hábil el lunes 23/11, Día de la Soberanía Nacional.';
```

  Casos y asserts (con `assert.deepEqual` sobre los ítems o sobre `map(({ fecha, hora, nombre, detalle }) => …)`):
  - `desdeLaSalida`: `proximasEdiciones({ ultimaRegular: '2026-11-09', hoy: '2026-11-24', …, cantidad: 1, desdeLaSalida: true })[0].edicion === '2026-11-23'`; sin la opción, `'2026-12-07'`. Los cinco tests de hoy de `proximasEdiciones` no cambian.
  - Apagado (`envioActivo: false`) y calendario caído (`CALENDARIO_CAIDO`): `[]`.
  - Sin regulares, el sábado 14/11: fechas `['2026-11-24', '2026-12-09', '2026-12-21', '2027-01-04', '2027-01-18']`; el primero entero: `{ fecha: '2026-11-24', hora: '08:05', texto: 'Dato de la quincena', nombre: 'Sale el dato de la quincena', titulo: 'Sale el dato de la quincena, a las 08:05. ' + SOBERANIA, detalle: SOBERANIA }`; el del 21/12, `detalle: 'Edición del lunes 21/12.'`.
  - Una regular sin correo del RPAD (`ultimaDel('2026-11-09', null)`): las mismas cinco.
  - La del 23/11 ya llegó, martes 24/11 a las 07:40 (`correo('programada')`, sin filas): primero `{ fecha: '2026-11-24', hora: '08:05', nombre: 'Sale el dato de la quincena', detalle: SOBERANIA }`, después `09/12, 21/12, 04/01, 18/01` (cinco en total).
  - La del 23/11 salió hoy a las 08:05 (`correo('enviada')`, `[enviado(1, '2026-11-24 08:05:12')]`, ahora 24/11 10:30): primero `{ fecha: '2026-11-24', hora: '08:05', nombre: 'Salió el dato de la quincena', detalle: SOBERANIA }`.
  - La misma, el miércoles 25/11: no va; fechas `['2026-12-09', '2026-12-21', '2027-01-04', '2027-01-18', '2027-02-01']`.
  - La del 21/12 programada a las 10:30 de ese lunes: `{ fecha: '2026-12-21', hora: '14:00', nombre: 'Sale el dato de la quincena', detalle: 'Edición del lunes 21/12.' }`; en reintento (`[fallido(1, 1)]`), lo mismo; a las 15:00: `{ fecha: '2026-12-22', hora: '08:05', detalle: 'Edición del lunes 21/12.' }` (sale otro día que el de la serie: sin motivo).
  - No enviada (`correo('no_enviada', 'sin_lista')`): no va; la serie sigue.
  - Ningún texto de ningún caso coincide con `PROHIBIDAS`.

- [ ] **Step 2: Correrlos y ver que fallan**

Run: `node --test tests/dato-quincena-correo-reglas.test.js`
Expected: FAIL («datoQuincenaEnMiEspacio is not a function» / el caso de `desdeLaSalida`).

- [ ] **Step 3: Implementar** en `services/datoQuincenaCorreoReglas.js`, sin copiar reglas:
  - `proximasEdiciones`: la opción `desdeLaSalida` (comentario: la usa la agenda de Mi espacio; la pestaña Correo, sin ella).
  - `datoQuincenaEnMiEspacio`: `[]` si `envioActivo !== true` o `calendario.error !== null`; la última con `situacionDelEnvio({ tipo: 'regular', fecha_edicion, correo, envios, reenvios: [], lista: [], correoDelBot: null, envioActivo, ahora, calendario })`: `programada` → `situacion.salida` ('AAAA-MM-DD HH:MM'); `enviada` → `primerEnvio` solo si su fecha es la de hoy, con `slice(11, 16)`; las demás, nada. Después `proximasEdiciones({ …, cantidad: CUANTAS_EN_MI_ESPACIO - incluidas, desdeLaSalida: true })` a las `HORA_DE_LA_MANANA`. El motivo: el de la serie (`motivoDelCorrimiento(edicion, fecha, filas)`) solo si `fecha === calendario.proximoDiaHabil(edicion)` y `fecha !== edicion`. El día: `diaDeLaSemana` + `diaYMes`, sin el año.

- [ ] **Step 4: Correr y ver que pasan**

Run: `node --test tests/dato-quincena-correo-reglas.test.js`
Expected: PASS, todos (también los de antes).

- [ ] **Step 5: Docs** — en `docs/temas/dato-quincena-correo.md`, donde están las próximas ediciones: que la agenda de Mi espacio usa la misma serie con `desdeLaSalida` (por qué: el día del envío la edición ya llegó y la serie salta), la regla de `datoQuincenaEnMiEspacio` y que no se copia. `node --test tests/documentos.test.js` → PASS.

- [ ] **Step 6: Commit y push**

```bash
git add services/datoQuincenaCorreoReglas.js tests/dato-quincena-correo-reglas.test.js docs/temas/dato-quincena-correo.md
git commit -m "feat(dato-quincena): las fechas del correo para la agenda de Mi espacio"
git push
```

### Task 2: La API — `dato_quincena` y `dato_quincena_activo` en `GET /mi-espacio/eventos` (Opus: API y lectura de la base)

**Files:**
- Modify: `services/datoQuincenaCorreoDatos.js` (una lectura nueva, junto a `ultimaRegular`, `:394`)
- Modify: `controllers/miEspacioEventosController.js` (`listarEventos`, `:281-310`)
- Test: `tests/mi-espacio-eventos-api.test.js` (las claves, `:169-170`; un describe nuevo)
- Docs: `docs/temas/mi-espacio-agenda.md`

**Interfaces:**
- Consumes: `datoQuincenaEnMiEspacio` y su forma (Task 1); `leerConfig()` (`{ envioActivo }`), `correosDeLasEdiciones(ids)` de `datoQuincenaCorreoDatos.js`; `calendarioCon` de `feriadosReglas.js`.
- Produces:
  - `export const ultimaRegularConSuCorreo = async (conexion = pool) => ({ id, fecha_edicion, correo, envios } | null)`: la regular de `fecha_edicion` más nueva (y, con la misma, el id más alto), con lo de `correosDeLasEdiciones([id])`.
  - La respuesta de `GET /api/mi-espacio/eventos` suma, al final y en este orden, `dato_quincena` (los ítems de Task 1 con `fecha` entre `desde` y `hasta`) y `dato_quincena_activo` (boolean).

- [ ] **Step 1: Escribir los tests que fallan** en `tests/mi-espacio-eventos-api.test.js`:
  - Las claves de `:169-170` suman `'dato_quincena', 'dato_quincena_activo'` al final; con la base de prueba (`envio_activo` 0), `dato_quincena` `[]` y `dato_quincena_activo` `false`.
  - Un describe «el dato de la quincena en la agenda (spec 2026-11-14-dato-quincena-en-mi-espacio)»: con `UPDATE dato_quincena_correo_config SET envio_activo = 1 WHERE id = 1` (y de vuelta a 0 en el `after`), para `lector`, `colab` y `adminA`, `listado(clave, hoy, dia(70))`: `dato_quincena_activo === true`, entre 1 y 5 ítems, cada uno con las claves `['fecha', 'hora', 'texto', 'nombre', 'titulo', 'detalle']`, `texto === 'Dato de la quincena'`, `hora === '08:05'`, `fecha` entre desde y hasta y día hábil (`esDiaHabil`, sin feriados de la tabla, que el `beforeEach` vacía); el mismo pedido para los tres roles da los mismos ítems. Un rango sin ninguno (un sábado y su domingo: el dato sale siempre un día hábil) da `[]` con `dato_quincena_activo: true`.
  - Aislado: `RENAME TABLE dato_quincena_correo_config TO dato_quincena_correo_config_fuera` (de vuelta en un `finally`): `listado('lector')` responde 200 con `dato_quincena: []` y `dato_quincena_activo: false`, y los feriados y eventos igual.

- [ ] **Step 2: Correrlos y ver que fallan** (necesita el contenedor; si no está libre, dejarlo para la Task 5 y seguir)

Run: `node --test tests/mi-espacio-eventos-api.test.js`
Expected: FAIL en las claves y en el describe nuevo.

- [ ] **Step 3: Implementar**
  - `ultimaRegularConSuCorreo` en `datoQuincenaCorreoDatos.js`: una consulta parametrizada (`SELECT id, DATE_FORMAT(fecha_edicion, '%Y-%m-%d') … WHERE tipo = 'regular' ORDER BY fecha_edicion DESC, id DESC LIMIT 1`) y `correosDeLasEdiciones`.
  - En `listarEventos`, después del `Promise.all` de hoy, una función local aislada (try/catch como `eventosDelResumen`, `controllers/miEspacioController.js:99-109`): `Promise.all([leerConfig(), ultimaRegularConSuCorreo()])`, `datoQuincenaEnMiEspacio({ envioActivo, ultima, ahora, calendario: calendarioCon(filasFeriados), filasDeFeriados: filasFeriados })` filtrado al rango; si tira, `console.error` con un mensaje fijo y `{ dato_quincena: [], dato_quincena_activo: false }`. La importación de las reglas del correo va en el controlador (ciclo de imports: spec, «El servidor»).

- [ ] **Step 4: Correr y ver que pasan**

Run: `node --test tests/mi-espacio-eventos-api.test.js tests/calendario-unico.test.js`
Expected: PASS.

- [ ] **Step 5: Docs** — en `docs/temas/mi-espacio-agenda.md`, donde se describe la respuesta de `GET /mi-espacio/eventos`: las dos claves, que se leen aisladas y por qué la importación va en el controlador. No alargar el renglón 98 (599 caracteres). `node --test tests/documentos.test.js` → PASS.

- [ ] **Step 6: Commit y push**

```bash
git add services/datoQuincenaCorreoDatos.js controllers/miEspacioEventosController.js tests/mi-espacio-eventos-api.test.js docs/temas/mi-espacio-agenda.md
git commit -m "feat(mi-espacio): la agenda trae las fechas del dato de la quincena"
git push
```

### Task 3: Lo puro del dibujo — el chip en el mes, el día elegido y «Próximos» (Sonnet, alto: dibujo puro, sin permisos ni escritura; la revisión, Opus)

**Files:**
- Modify: `public/js/mi-espacio.js` (`ICONOS_DEL_MES` `:2570`, `cosasPorDia` `:2342`, `htmlDeCosa` `:2613`, `htmlDelDiaElegido` `:2715`, `gruposDeProximos` `:2749`)
- Test: `tests/mi-espacio-frontend.test.js` (`respuestaDeEventos` `:1153`; los describe «la agenda: el modelo del mes», «el HTML del mes» y «los próximos»)

**Interfaces:**
- Consumes: los ítems `{ fecha, hora, texto, nombre, titulo, detalle }` en `datos.dato_quincena` (Task 2).
- Produces: la clase `dato` (la usan el CSS y la leyenda de la Task 4); `ICONOS_DEL_MES.dato`.

- [ ] **Step 1: Escribir los tests que fallan**
  - `respuestaDeEventos` suma las opciones `dato = []` y `datoActivo = false` y las claves `dato_quincena` (filtradas al rango) y `dato_quincena_activo`: los datos de antes no cambian.
  - `DATO_DE_PRUEBA`: armado con la función real, `datoQuincenaEnMiEspacio({ envioActivo: true, ultima: { fecha_edicion: '2026-10-12', correo: { estado: 'enviada', motivo: null, enviada_at: null }, envios: [{ usuario_id: 1, estado: 'enviado', intentos: 1, enviado_at: '2026-10-13 08:05:10' }] }, ahora: AHORA, calendario: calendarioCon(FILAS_PRECARGA), filasDeFeriados: FILAS_PRECARGA })`, con `FILAS_PRECARGA` de `tests/fixtures/feriados-precarga.js`: da el 26/10 (hoy, «Edición del lunes 26/10.»), el 10/11 (corrida por el feriado del 09/11), el 24/11, el 09/12 y el 21/12. `CON_EL_DATO` y `PROXIMOS_CON_EL_DATO`: los rangos de `DEL_MES` y `PROXIMOS` con `dato: DATO_DE_PRUEBA, datoActivo: true`.
  - `cosasPorDia(CON_EL_DATO)['2026-10-26']`: `[{ clase: 'dato', texto: 'Dato de la quincena', titulo: 'Sale el dato de la quincena, a las 08:05. Edición del lunes 26/10.' }, { clase: 'propio', icono: 'candado', texto: '12:00 Llamar a Vialidad por el TMDA', evento_id: 11 }]`; con un feriado el mismo día, el feriado primero; ningún ítem del dato con `evento_id`.
  - `htmlDelMes`: el dato es `<span class="me-ev dato" data-lineas="…" title="Sale el dato de la quincena, a las 08:05. Edición del lunes 26/10.">` + `ICONOS_DEL_MES.dato` + «Dato de la quincena», nunca un `button` ni `data-evento`; el punto del teléfono `<i class="dato"></i>`; la celda no suma la clase `feriado`.
  - Un día lleno (feriado + dato + dos eventos, con dos carriles): el dato entra en el orden y lo que no entra va en «y N más».
  - `htmlDelDiaElegido('2026-10-26', CON_EL_DATO, HOY)`: una fila `<li class="me-fila-del-dia dato"><div class="me-elegido-cosa">` con «08:05», «Sale el dato de la quincena» y el `small` «Edición del lunes 26/10.», después de lo de todo el día y antes de los eventos.
  - `gruposDeProximos(PROXIMOS_CON_EL_DATO, HOY)`: hoy, `{ hora: '08:05', titulo: 'Sale el dato de la quincena', detalle: 'Edición del lunes 26/10.', clase: 'dato' }` antes de los eventos de hoy; más adelante, `{ hora: 'Mar 10/11', titulo: '08:05 Sale el dato de la quincena', detalle: 'Edición del lunes 09/11: no es hábil el lunes 09/11, Visita de Su Santidad el Papa León XIV.', clase: 'dato' }`; sin `evento_id` y `htmlDeProximo` lo dibuja con `<span class="me-prox-titulo">`.
  - El escapado: un ítem con `detalle` y `titulo` que traen `<b>"x"</b> & y` sale escapado en la casilla (`title`), en el día elegido y en «Próximos».
  - `ICONOS_DEL_MES`: las claves suman `dato`; es el «newspaper» (incluye `<rect width="8" height="4" x="10" y="6" rx="1"/>`), decorativo, y distinto de los demás.

- [ ] **Step 2: Correrlos y ver que fallan**

Run: `node --test tests/mi-espacio-frontend.test.js`
Expected: FAIL en los casos nuevos; los demás, PASS.

- [ ] **Step 3: Implementar** en `public/js/mi-espacio.js`, en «Lo puro: la agenda», con los comentarios al día:
  - `ICONOS_DEL_MES.dato` (el «newspaper»).
  - `cosasPorDia`: después del bucle de feriados, `{ clase: 'dato', texto: comoTexto(dato.texto), titulo: comoTexto(dato.titulo) }`.
  - `htmlDeCosa`: el `title` del `<span>` es `cosa.titulo` si es un texto, si no `cosa.texto`.
  - `htmlDelDiaElegido`: después de los compañeros, `{ clase: 'dato', hora, texto: nombre, quien: detalle }` (sin `evento_id`).
  - `gruposDeProximos`: después de los compañeros, `{ fecha, clase: 'dato', hora, texto: nombre, detalle, conHora: true }`, y la hora de un ítem se arma igual para un evento y para uno con `conHora` (hoy y mañana, la hora; después, el día y `${hora} ${texto}`).

- [ ] **Step 4: Correr y ver que pasan**

Run: `node --test tests/mi-espacio-frontend.test.js`
Expected: PASS, todos.

- [ ] **Step 5: Commit y push**

```bash
git add public/js/mi-espacio.js tests/mi-espacio-frontend.test.js
git commit -m "feat(mi-espacio): el chip del dato de la quincena en el mes, el día y Próximos"
git push
```

### Task 4: La página — la leyenda, los colores, la versión y el clic (Sonnet, alto: HTML y CSS; la revisión, Opus)

**Files:**
- Modify: `public/mi-espacio.html` (`:root` `:20-29`; chips `:401-408`; día elegido `:433-438`; Próximos `:455-461`; teléfono `:884-890`; leyenda `:1058-1066`; `?v=` `:1573`)
- Modify: `public/js/mi-espacio.js` (`pintarMesDeEventos`, `:4064`)
- Modify: `tests/paginas.test.js` (`VERSION_MI_ESPACIO` `:117`; leyenda `:810-819`; clases `:866-868`)
- Test: `tests/mi-espacio-frontend.test.js` (estilos `:10827-10990`; la leyenda `:10911`; el clic `:8260-8288`)
- Docs: `docs/temas/mi-espacio-agenda-mes.md`

**Interfaces:**
- Consumes: la clase `dato`, `ICONOS_DEL_MES.dato` (Task 3); `dato_quincena_activo` (Task 2).

- [ ] **Step 1: Escribir los tests que fallan**
  - `tests/paginas.test.js`: `VERSION_MI_ESPACIO = '20261233'` con su comentario; la leyenda con ocho muestras, la nueva después de «Feriados»: `['dato', 'El dato de la quincena', true, 'svg']` (la expresión acepta `id="ag-leyenda-dato" hidden`), y 8 `<li>`; las clases de los chips suman `dato` (`.me-ev.dato, .me-leyenda .dato {`).
  - `tests/mi-espacio-frontend.test.js`, estilos: los tres tokens nuevos con sus valores; el día elegido `dato` con 4,5:1 o más; el punto `.me-puntos .dato` del teléfono con 3:1 o más sobre blanco y sobre el cielo, igual a `--sg-turquesa-borde`; la muestra de la leyenda con el ícono `ICONOS_DEL_MES.dato`.
  - Página (DOM falso, `montarPagina` con un `responder` que contesta `CON_EL_DATO`): `#ag-leyenda-dato` visible con `dato_quincena_activo: true` y oculta con `false`; en la compu, tocar `.me-ev.dato` del 26/10 abre «Nuevo evento» con `ev-fecha` 2026-10-26 (sumar el caso a la lista de `:8264`, que hoy prueba el feriado).

- [ ] **Step 2: Correrlos y ver que fallan**

Run: `node --test tests/paginas.test.js tests/mi-espacio-frontend.test.js`
Expected: FAIL en los casos nuevos.

- [ ] **Step 3: Implementar**
  - `mi-espacio.html`: los tokens; `.me-ev.dato, .me-leyenda .dato { background: var(--sg-turquesa-fondo); border-color: var(--sg-turquesa-borde); color: var(--sg-turquesa); }`, la misma regla para `.me-fila-del-dia.dato .me-elegido-cosa`, `.me-prox-icono.dato { color: var(--sg-turquesa-borde); }` y, en el bloque de 640 px, `.me-puntos .dato { background: var(--sg-turquesa-borde); }`; la muestra `<li id="ag-leyenda-dato" hidden><span class="me-color dato" aria-hidden="true">` + el SVG de `ICONOS_DEL_MES.dato` + `</span>El dato de la quincena</li>` después de «Feriados»; el `?v=20261233`.
  - `pintarMesDeEventos`: `porId('ag-leyenda-dato').hidden = delMes.dato_quincena_activo !== true;`, junto a la de los compañeros.

- [ ] **Step 4: Correr y ver que pasan**

Run: `node --test tests/paginas.test.js tests/mi-espacio-frontend.test.js`
Expected: PASS.

- [ ] **Step 5: Docs** — en `docs/temas/mi-espacio-agenda-mes.md`: el chip del dato (dónde va, el orden, que no abre nada propio y el clic cae en la casilla, la muestra de la leyenda solo con el envío prendido, el color turquesa con sus contrastes y que la frase del mes no lo cuenta). `node --test tests/documentos.test.js` → PASS.

- [ ] **Step 6: Commit y push**

```bash
git add public/mi-espacio.html public/js/mi-espacio.js tests/paginas.test.js tests/mi-espacio-frontend.test.js docs/temas/mi-espacio-agenda-mes.md
git commit -m "feat(mi-espacio): la leyenda y el color del dato de la quincena en la agenda"
git push
```

### Task 5: El control de la rama

- [ ] **Step 1:** Con «CONTENEDOR LIBRE» de la coordinadora: `npm test` completo (con `RPAD_TESTS_DB_LOCAL=1` en el `.env` del worktree y `node_modules` enlazado), en segundo plano, con el log en `~/rpad-notas/logs/rama-dato-quincena-en-mi-espacio-<commit>.log`. Expected: 0 fallas.
- [ ] **Step 2:** Sin nombres reales ni datos de producción en el diff: `git diff main...HEAD` contra `~/rpad-notas/palabras.txt`. Expected: 0 coincidencias.
- [ ] **Step 3:** La revisión final de toda la rama, con Fable 5.2 y esfuerzo alto; los arreglos, con Opus, y la suite otra vez.
