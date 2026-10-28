# Mi espacio: la planilla de horas extras de contrato — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que una persona de contrato cargue sus horas extras en una planilla del mes (la salida y, opcional, la entrada de cada día), con las horas de cada día calculadas con la regla del usuario y la suma dicha en días de franco y horas.

**Architecture:** una tabla nueva (`mi_espacio_salidas`) que el `Estado` de Mi espacio lee como `salidas`; las reglas puras calculan las horas de cada día y las horas a favor de contrato salen de las salidas (planta sigue con `mi_espacio_horas_extras`); `planillaDelMes` arma un mes como datos; `GET` y `PUT /api/mi-espacio/salidas`; la página dibuja la planilla y calcula en el momento con copias atadas por tests de paridad.

**Tech Stack:** Node 22, Express 4 (ES Modules), MariaDB (mysql2/promise), JS del navegador sin frameworks, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-27-mi-espacio-horas-design.md` (y la maqueta `docs/superpowers/specs/2026-10-27-mi-espacio-horas-mockups/`, `?abrir=2026-10`). Leer las dos antes de cada tarea.

## Global Constraints

- Sin CDN ni librerías nuevas en el navegador (la CSP de `app.js` no deja); sin dependencias nuevas.
- Contraste de al menos 4,5:1 en los textos y 3:1 en los bordes de los controles (`--sg-borde-control`); todo funciona a 375 px de ancho sin desplazamiento horizontal de la página.
- Planta no cambia: su modal, sus reglas (`francosDe` sobre `estado.horasExtras`) y sus tests siguen igual.
- Las horas a favor se usan como hoy (desde «Cargar licencia», de a media hora); «días de franco» es solo una forma de decirlo: 7 horas = 1 día.
- Reglas, valores exactos: jornada hasta `'15:00'`; día hábil `floor((salida − 15:00 + 14) / 30) / 2` (negativo = 0); día no hábil `floor((salida − entrada + 10) / 30) / 2`; máximo 100 días por guardado.
- Convenciones del `CLAUDE.md`: español, ES Modules, consultas con `?`, respuestas `{ success, data?, error?, campo?, message? }`, transacciones con `enTransaccion`, baja lógica con `activo`, lo puro de `mi-espacio.js` solo declara al cargarse, todo texto del servidor por `Utils.escapeHtml` (también en `aria-label`) y los números con `String`, fechas como texto `'AAAA-MM-DD'`.
- El repo es público: personas inventadas (las de los casos: Sofía Paz, Carla Benítez…), ningún dato de producción.
- Nunca `/api/cron/*`, ningún email real (en local todo va a Mailpit). Subagentes, siempre con Opus.
- `npm test` completo antes de empezar y al final de cada tarea (`docker compose up -d`; no correr dos suites a la vez). La línea de base la fija la Task 1.
- La base local (`datospublicos_mcr_rpad`) necesita la migración para `tests/schema.test.js`: pedirle el OK al usuario antes de correrla ahí (como con la agenda).

## Review Focus

1. Una hora con segundos o con otro formato (`'16:46:00'`, `'9:05'`, `'25:00'`): el servidor responde 400 con «Escribí la hora como 16:45.» en ese campo, y la página manda siempre `'HH:MM'` (corta lo que da el `<input type="time">`). Tests en las Tasks 2 y 7.
2. Un sábado o domingo que además es feriado: aparece en `fines_de_semana` con `tipo: 'feriado'` y su nombre, y cuenta de la entrada a la salida. Test en la Task 5.
3. Un `mes` raro en `GET /mi-espacio/salidas` (`'2026-13'`, `'2026-1'`, `'2026-10-01'`, el parámetro repetido, que Express da como lista, uno anterior al rango o del mes que viene): 400 en `mes`, antes de leer nada. Test en la Task 6.
4. «Guardar» con el error en un mes que no es el que se ve: la planilla pasa a ese mes y el foco va al campo del error. Test en la Task 8.
5. Un día que se cambia y se vuelve a dejar como estaba: no cuenta como cambio (el pie vuelve a «Todo guardado.» y no se manda). Test en la Task 7.

---

### Task 1: Traer el main y ajustar el plan

**Files:** este plan (`docs/superpowers/plans/2026-10-27-mi-espacio-horas.md`).

- [ ] **Step 1:** confirmar que «Mi espacio: confirmación y Word de la licencia» ya está en `main` (`git log --oneline main -15`; buscar el merge de `claude/mi-espacio-licencia-word-codigo`). Si no está, parar y avisar a la coordinadora: esta entrega va después.
- [ ] **Step 2:** `git merge main` en la rama (`claude/mi-espacio-horas-9c3d4b` o la que se use); resolver conflictos (solo docs de esta rama).
- [ ] **Step 3:** `npm test` completo; anotar la línea de base (pasan / se omiten) en este plan.
- [ ] **Step 4:** releer en el main nuevo lo que tocan las dos entregas: `guardarLicencia`, `pedirConfirmacion` y `#modal-confirmar`, `FORMULARIOS`, `estaOcupado`, `respaldoDelFoco`, `VERSION_MI_ESPACIO` (`tests/paginas.test.js` y el `?v=` de `mi-espacio.html`), las rutas nuevas del Word en `routes/index.js`, `RUTAS_MI_ESPACIO`, `miEspacioResumen.js` y `miEspacioDatos.js`. Corregir en este plan todo nombre, línea o firma que haya cambiado.
- [ ] **Step 5:** commit `docs(mi-espacio): el plan de las horas de contrato, ajustado al main con el Word`.

### Task 2: Las reglas de una salida (puras)

**Files:**
- Modify: `services/miEspacioReglas.js` (las constantes y los mensajes arriba; las funciones nuevas en la sección de las horas extras, después de `horasPorMes`)
- Test: `tests/mi-espacio-reglas.test.js`

**Interfaces:**
- Produces (todas exportadas, ninguna tira):
  - `SALIDA_DE_LA_JORNADA = '15:00'`, `TOLERANCIA_DIA_HABIL = 14`, `TOLERANCIA_DIA_INHABIL = 10`, `MAXIMO_DIAS_POR_GUARDADO = 100`.
  - En `MENSAJES_MI_ESPACIO`: `horaSalida: 'Escribí la hora como 16:45.'`, `salidaQueCuenta: 'Falta la salida: es la que cuenta.'`, `salidaFalta: 'Falta la salida.'`, `entradaFeriado: 'En un feriado, poné también la entrada.'`, `entradaFinde: 'En un sábado o domingo, poné también la entrada.'`, `salidaAntes: 'La salida tiene que ser después de la entrada.'`, `diaQueNoLlego: 'Ese día todavía no llegó.'`, `diaDeLicencia: 'Ese día tenés una licencia de día entero: no se cargan horas.'`, `sinDias: 'No hay cambios para guardar.'`, `muchosDias: 'Guardá de a 100 días como mucho.'`, `diaRepetido: 'Ese día está dos veces.'`, `planillaSoloContrato: 'La planilla es para las personas de contrato.'`, `contratoEnLaPlanilla: 'Las personas de contrato cargan sus horas en la planilla.'` (claves nuevas: no pisar las que existen).
  - `horaSalidaValida(hora) → boolean` (`/^([01]\d|2[0-3]):[0-5]\d$/`).
  - `tipoDeDia(fecha, feriados) → 'habil' | 'feriado' | 'finde' | null` (`'feriado'` si la fecha está en el Set, aunque sea sábado o domingo; `'finde'`, sábado o domingo sin feriado; null si no es una fecha).
  - `horasDeLaSalida({ fecha, entrada, salida }, feriados) → number | null` (spec §3).
  - `horasPorMesDeSalidas(salidas, feriados) → Map<'AAAA-MM', number>`, ordenado como `horasPorMes`; lo que da null no suma.
  - `enDiasDeFranco(horas) → string` (spec §3; `''` con 0 o con lo que no es un número positivo).
  - `textoDeLaSumaDelMes(mes, horas, hoy) → string` (spec §4: en curso «En noviembre vas a tener 2 días de franco y 4 horas a favor.», pasado «En octubre tuviste 1 día de franco y 3,5 horas a favor.», sin horas «Todavía no sumaste horas extras en octubre.» / «En septiembre no hiciste horas extras.»; el mes del texto es el siguiente al de las horas, en minúscula y sin año; solo días, «… 3 días de franco.»; solo horas, «… 4,5 horas a favor.»).
  - `licenciaDeDiaEnteroEn(estado, fecha, feriados) → fila | null`: una licencia activa del estado que cubre la fecha (`desde ≤ fecha ≤ hasta`), `esDiaEntero`, no `fueraDeLaModalidad` y con la fecha hábil (`esDiaHabilCon`).
  - `validarSalida(dia, { hoy, estado, feriados }) → { datos: { fecha, entrada, salida, nota, borrar }, error: { campo, mensaje } | null }`, en el orden de la spec §7 (el formato de la fecha, después el borrado, que pasa siempre, y los pasos 1 a 7). `entrada` y `nota` vacías son null; `borrar` es `true` solo en el borrado.

- [ ] **Step 1: Write the failing tests** (un `describe('las salidas de contrato')`):

```js
// Los 19 renglones del CSV del usuario (mayo de 2026, sin feriados ese mes salvo el 1 y el 25, que no están): día hábil
const CSV = [['2026-05-04','15:15',0],['2026-05-05','15:16',0.5],['2026-05-06','15:27',0.5],['2026-05-07','15:28',0.5],
  ['2026-05-08','15:29',0.5],['2026-05-11','15:44',0.5],['2026-05-12','15:45',0.5],['2026-05-13','15:46',1],
  ['2026-05-14','15:47',1],['2026-05-15','16:00',1],['2026-05-18','16:14',1],['2026-05-19','16:15',1],['2026-05-20','16:16',1.5],
  ['2026-05-21','16:45',1.5],['2026-05-22','16:46',2],['2026-05-26','16:47',2],['2026-05-27','17:01',2],['2026-05-28','17:15',2],
  ['2026-05-29','17:16',2.5],['2026-05-04','15:14',0]];
it('un día hábil cuenta la salida desde las 15:00, con la media hora desde el minuto 16 (el CSV del usuario)', () => {
  for (const [fecha, salida, horas] of CSV) assert.equal(horasDeLaSalida({ fecha, salida }, SIN_FERIADOS), horas, salida);
  assert.equal(horasDeLaSalida({ fecha: '2026-05-04', entrada: '07:00', salida: '15:16' }, SIN_FERIADOS), 0.5); // la entrada no cuenta
  assert.equal(horasDeLaSalida({ fecha: '2026-05-04', salida: '13:02' }, SIN_FERIADOS), 0);
});
it('un feriado, sábado o domingo cuenta de la entrada a la salida con 10 minutos de tolerancia (los ejemplos del usuario)', () => {
  const sab = '2026-10-24';
  for (const [entrada, salida, horas] of [['09:19','12:10',3],['09:20','12:10',3],['09:21','12:10',2.5],['08:09','15:00',7],
    ['08:10','15:00',7],['08:11','15:00',6.5],['10:00','11:19',1],['10:00','11:20',1.5],['10:00','11:49',1.5],['10:00','11:50',2]]) {
    assert.equal(horasDeLaSalida({ fecha: sab, entrada, salida }, SIN_FERIADOS), horas, `${entrada}-${salida}`);
  }
  const feriados = new Set(['2026-10-12']);
  assert.equal(horasDeLaSalida({ fecha: '2026-10-12', entrada: '07:40', salida: '09:10' }, feriados), 1.5);
  assert.equal(horasDeLaSalida({ fecha: '2026-10-12', salida: '16:46' }, feriados), null);         // sin entrada
  assert.equal(horasDeLaSalida({ fecha: sab, entrada: '12:00', salida: '11:00' }, SIN_FERIADOS), null); // al revés
  assert.equal(horasDeLaSalida({ fecha: '2026-05-25', entrada: '09:00', salida: '10:00' }, feriadosDelRango([], '2026-01-01', '2026-12-31')), 1); // fijo
});
it('enDiasDeFranco: 7 horas son un día', () => {
  assert.equal(enDiasDeFranco(18.5), '2 días de franco y 4,5 horas');
  assert.equal(enDiasDeFranco(21), '3 días de franco');
  assert.equal(enDiasDeFranco(20.5), '2 días de franco y 6,5 horas');
  assert.equal(enDiasDeFranco(7), '1 día de franco');
  assert.equal(enDiasDeFranco(4.5), '4,5 horas');
  assert.equal(enDiasDeFranco(1), '1 hora');
  assert.equal(enDiasDeFranco(0), '');
});
it('textoDeLaSumaDelMes', () => {
  assert.equal(textoDeLaSumaDelMes('2026-10', 18.5, '2026-10-27'), 'En noviembre vas a tener 2 días de franco y 4,5 horas a favor.');
  assert.equal(textoDeLaSumaDelMes('2026-09', 10.5, '2026-10-27'), 'En octubre tuviste 1 día de franco y 3,5 horas a favor.');
  assert.equal(textoDeLaSumaDelMes('2026-12', 21, '2026-12-10'), 'En enero vas a tener 3 días de franco.'); // sin «a favor»
  assert.equal(textoDeLaSumaDelMes('2026-10', 4.5, '2026-10-27'), 'En noviembre vas a tener 4,5 horas a favor.');
  assert.equal(textoDeLaSumaDelMes('2026-10', 0, '2026-10-27'), 'Todavía no sumaste horas extras en octubre.');
  assert.equal(textoDeLaSumaDelMes('2026-09', 0, '2026-10-27'), 'En septiembre no hiciste horas extras.');
});
```

  El caso de 21 horas es el del usuario: «En noviembre vas a tener 3 días de franco», sin «a favor» (el «a favor» va solo con horas sueltas).

  Y `validarSalida` (con un `estado` de contrato armado en el test, hoy `'2026-10-27'`): el formato de la fecha; el borrado (todo vacío) pasa también el 28/10 y en un día de licencia; el 28/10 con salida da `diaQueNoLlego` en `fecha`; antes del rango, `textoRango`; un día de vacaciones (o de horas a favor de 7 horas) da `diaDeLicencia` en `fecha`, uno de horas a favor de 2 horas pasa; `'16:46:00'`, `'9:05'` y `'25:00'` dan `horaSalida` en su campo; con entrada o nota y sin salida, `salidaQueCuenta` (hábil) o `salidaFalta` (feriado); feriado sin entrada `entradaFeriado`, sábado sin entrada `entradaFinde`; salida antes o igual que la entrada `salidaAntes` (también en un día hábil); nota de 201 caracteres `nota`; un día correcto devuelve los datos recortados y `borrar: false`.

- [ ] **Step 2:** `node --test tests/mi-espacio-reglas.test.js` → FAIL (no existen).
- [ ] **Step 3:** implementar en `services/miEspacioReglas.js` (minutos con cualquier minuto, distinto de `minutosDe`, que solo acepta `:00`/`:30`; `tipoDeDia` con `esDiaHabilCon` y el día de la semana con `Date.UTC` sobre las partes).
- [ ] **Step 4:** `node --test tests/mi-espacio-reglas.test.js` → PASS; `npm test` completo, igual que la base más los nuevos.
- [ ] **Step 5:** commit `feat(mi-espacio): las reglas de una salida de contrato`.

### Task 3: Las horas a favor desde las salidas, y los avisos

**Files:**
- Modify: `services/miEspacioReglas.js` (`mesesTrabajados`, `horasAFavorDe`, `calcular`, el JSDoc del `Estado`), `services/miEspacioResumen.js` (los `faltantes` de `resumenDe`), `tests/fixtures/mi-espacio-casos.js`
- Test: `tests/mi-espacio-reglas.test.js`, `tests/mi-espacio-resumen.test.js`

**Interfaces:**
- Consumes: `horasPorMesDeSalidas`, `horasDeLaSalida`, `tipoDeDia`, `licenciaDeDiaEnteroEn` (Task 2).
- Produces:
  - El `Estado` suma `salidas: [{ id, fecha, entrada, salida, nota }]` (un estado sin la clave cuenta como `[]`).
  - `mesesTrabajados(horasPorMes, usos, distancia)` recibe el `Map` de horas (`francosDe` le pasa `horasPorMes(estado.horasExtras)`; `horasAFavorDe`, `horasPorMesDeSalidas(estado.salidas, feriados)`).
  - `avisosDeSalidas(estado, feriados) → [{ clave: 'salida:AAAA-MM-DD', fecha, texto, aviso }]`, solo en contrato, por fecha: un día no hábil sin entrada (`texto` «Revisá tus horas extras del lunes 12/10: ahora es feriado y falta la entrada.», `aviso` «Ahora es feriado: falta la entrada.»; en sábado o domingo, «es sábado y falta la entrada» y «Es sábado: falta la entrada.»), y un día con licencia de día entero (`texto` «Revisá tus horas extras del viernes 09/10: ese día tenés una licencia de día entero.», `aviso` «Ese día tenés una licencia de día entero: revisá esta salida.»). El día va con `diaLargo` (o el ayudante equivalente de las reglas: «lunes 12/10»).
  - `calcular(...)` devuelve además `avisosDeSalidas`; **no** entran en `faltantes` (así `problemaDeLaCarga` no los ve). `resumenDe` pone sus `texto` al final de `faltantes`.

- [ ] **Step 1: Write the failing tests:**
  - `horasAFavorDe` con un estado de contrato con salidas (octubre: 16:20, 15:46, un feriado 12/10 de 09:21 a 12:10 con `feriados` que lo tienen) da `a_favor` 5 en el mes trabajado octubre; un feriado sin entrada no suma; una salida en un día de vacaciones **sí** suma.
  - `francosDe` no mira `salidas` (un estado de planta con salidas y sin horas extras da `[]`).
  - `avisosDeSalidas`: los dos casos y sus textos; planta, `[]`; un feriado dado de baja (el Set sin la fecha) no deja aviso y la salida cuenta desde las 15:00.
  - `calcular(...).faltantes` no tiene ninguna clave `salida:`; `calcular(...).avisosDeSalidas` sí.
  - `evaluarLicencia` de unas vacaciones en un día con una salida guardada: **no** la frena (sin error).
  - `resumenDe`: los textos de los avisos al final de `faltantes`.
- [ ] **Step 2:** `node --test tests/mi-espacio-reglas.test.js tests/mi-espacio-resumen.test.js` → FAIL.
- [ ] **Step 3:** implementar. En `tests/fixtures/mi-espacio-casos.js`, el caso CONTRATO **suma** `salidas` con los mismos totales y las mismas fechas que sus `horasExtras`: `{ id: 1, fecha: '2026-09-10', entrada: null, salida: '19:00', nota: null }` (4 h), `{ id: 2, fecha: '2026-09-17', …, salida: '19:00' }` (4 h), `{ id: 3, fecha: '2026-09-24', …, salida: '17:30' }` (2,5 h), `{ id: 4, fecha: '2026-10-21', …, salida: '19:00' }` (4 h), y **conserva** sus `horasExtras` hasta la Task 5 (que las saca cuando la tabla de contrato pasa a las salidas; ledger, Ruling 2). Las aserciones de hoy sobre CONTRATO tienen que seguir pasando sin tocarlas.
- [ ] **Step 4:** los dos archivos → PASS; `npm test` completo.
- [ ] **Step 5:** commit `feat(mi-espacio): las horas a favor de contrato salen de las salidas`.

### Task 4: La tabla y la lectura

**Files:**
- Create: `database/updates/migracion-mi-espacio-horas.sql`, `database/updates/rollback-mi-espacio-horas.sql`
- Modify: `database/schema.sql` (después de `mi_espacio_horas_extras`), `services/miEspacioDatos.js` (`estadoVacio`, `estadosDe`, `feriadosPara`)
- Test: `tests/schema.test.js`, `tests/mi-espacio-api.test.js` (la parte de «lo que llega de la base» y el `beforeEach`)

**Interfaces:**
- Produces: la tabla de la spec §6, tal cual (`uq_mi_espacio_salidas_dia (usuario_id, fecha)`, `fk_mi_espacio_salidas_usuario` ON DELETE CASCADE); `estadosDe` lee `salidas` con una consulta más para todos (`TIME_FORMAT(entrada, '%H:%i')`, `TIME_FORMAT(salida, '%H:%i')`, `DATE_FORMAT(fecha, '%Y-%m-%d')`, solo `activo = 1`, por fecha); `feriadosPara` suma las fechas de `salidas`.

- [ ] **Step 1: Write the failing tests:** en `schema.test.js`, como con `mi_espacio_horas_extras`: la tabla está en `schema.sql` con sus columnas, la clave única y la FK; la migración se puede correr dos veces; la vuelta atrás la borra; el total de tablas pasa de 41 a 42 donde se cuente. En `mi-espacio-api.test.js` (base de prueba): una salida insertada por SQL con `entrada` NULL y `salida` `'16:46:00'` llega en `estadosDe` como `{ entrada: null, salida: '16:46' }`, la fecha como `'AAAA-MM-DD'`, y una dada de baja no llega. Sumar `mi_espacio_salidas` a la lista del `beforeEach`.
- [ ] **Step 2:** correr esos dos archivos → FAIL.
- [ ] **Step 3:** escribir la migración, la vuelta atrás, `schema.sql` y la lectura. Correr la migración en la base del `.env` del worktree, la copia `rpad_rama_horas` (`docker exec -i -e MYSQL_PWD=… rpad-db mariadb -uroot rpad_rama_horas < database/updates/migracion-mi-espacio-horas.sql`); en `datospublicos_mcr_rpad`, recién en el cierre (ledger, Ruling 3).
- [ ] **Step 4:** → PASS; `npm test` completo.
- [ ] **Step 5:** commit `feat(mi-espacio): la tabla de las salidas de contrato y su lectura`.

### Task 5: La planilla de un mes y la tabla de contrato, como datos

**Files:**
- Modify: `services/miEspacioResumen.js` (`planillaDelMes` nueva; `tablaDeHorasExtras` en contrato), `services/miEspacioReglas.js` (`mesDeLaPlanilla`)
- Test: `tests/mi-espacio-resumen.test.js`, `tests/mi-espacio-reglas.test.js`

**Interfaces:**
- Consumes: Tasks 2 y 3; `feriadosDelAnio` y `NOMBRES_DE_LOS_FIJOS` de `services/feriadosReglas.js` (los nombres); `rangoDeFechas`.
- Produces:
  - `mesDeLaPlanilla(valor, hoy) → 'AAAA-MM' | null`: sin valor o `''`, el mes de hoy; un texto `^\d{4}-(0[1-9]|1[0-2])$` entre el mes de `rangoDeFechas(hoy).desde` y el de hoy, ese; cualquier otra cosa (también una lista), null.
  - `planillaDelMes(estado, calculo, { mes, hoy, feriados, filasFeriados }) → Planilla` con la forma de la spec §8 (`dias`, `fines_de_semana`, `suma`, `anterior`, `siguiente`, `aviso` de cada día con `avisosDeSalidas`; `licencia.texto` con el nombre del tipo de la persona —«Vacaciones», «Estudios», «Atención médica», «Grupo familiar», «Horas a favor, el día entero», «2 h a favor», «Uso autorizado, 3 h»—; `horas_texto` `'1,5 h'`, `'0'` o `''`). Fuera de contrato, null.
  - `tablaDeHorasExtras` en contrato: cada mes suma `a_favor_detalle` (`enDiasDeFranco(horas)`); `dias_por_mes` sale de `salidas` con `{ id, fecha, fecha_texto, tipo_texto: 'Feriado' | 'Sábado' | 'Domingo' | '', horario: 'Salida 16:20' | 'De 09:21 a 12:10', entrada_texto: 'Entrada 08:02' | '', horas, horas_texto, cero, nota, aviso }` (de la más nueva a la más vieja, como hoy); `totales_por_mes` con lo que suma. Planta, sin cambios.
- [ ] **Step 1: Write the failing tests:** `mesDeLaPlanilla` (`undefined`, `''`, `'2026-10'`, `'2026-13'`, `'2026-1'`, `'2026-10-01'`, `['2026-10']`, el mes que viene, uno de hace tres años); `planillaDelMes` con un estado de contrato y hoy `'2026-10-27'`: los hábiles de octubre, el 12/10 como feriado con su nombre, el 9/10 con licencia entera, el 20/10 con «2 h a favor», 28–30/10 con `futuro`, el 27/10 con `hoy`, un sábado con salida en `dias` y los demás sábados y domingos hasta hoy en `fines_de_semana`, **un sábado feriado en `fines_de_semana` con `tipo: 'feriado'` y su nombre** (Review Focus 2), `anterior`/`siguiente` (null en el mes de hoy y en el primero del rango), `suma`; la tabla de contrato con `a_favor_detalle` y el día por día nuevo; planta sin cambios. Acá el caso CONTRATO del fixture saca sus `horasExtras` (quedan solo las `salidas`), y se actualizan las aserciones del día por día de contrato que cambian (en `mi-espacio-resumen.test.js` y, solo de texto, en `mi-espacio-frontend.test.js`: «18:00 a 22:00» pasa a «Salida 19:00»), sin borrar ninguna (ledger, Ruling 2).
- [ ] **Step 2:** → FAIL. **Step 3:** implementar. **Step 4:** → PASS; `npm test` completo.
- [ ] **Step 5:** commit `feat(mi-espacio): la planilla de un mes y la tabla de contrato como datos`.

### Task 6: La API

**Files:**
- Modify: `controllers/miEspacioController.js` (`verPlanilla`, `guardarSalidas`; el freno de contrato en `cargarHorasExtras` y `corregirHorasExtras`), `routes/index.js`
- Create: `tests/mi-espacio-salidas-api.test.js` (Docker; base `rpad_test_mi_espacio_salidas`; mismo armado que `mi-espacio-api.test.js`: personas inventadas, el vínculo por SQL)
- Test: `tests/permisos.test.js` (`RUTAS_MI_ESPACIO` suma `['get', '/mi-espacio/salidas']` y `['put', '/mi-espacio/salidas']`)

**Interfaces:**
- Consumes: Tasks 2–5; `contextoDe` (ya da `filasFeriados`), `estadoDe`, `feriadosPara`, `enTransaccion`, `frenoDeLasHorasExtras`, `cuerpoDe`, `responder`.
- Produces:
  - `GET /api/mi-espacio/salidas?mes=` → `verPlanilla`: `mesDeLaPlanilla` primero (null: 400 `{ success: false, error: 'Elegí un mes válido.', campo: 'mes' }`, sin leer nada; sumar `mes: 'Elegí un mes válido.'` a `MENSAJES_MI_ESPACIO`); sin modalidad, `sinModalidad()`; planta, 400 `planillaSoloContrato` con `campo` null; si no, `conDatos(planillaDelMes(...))`. 500: «Error al obtener la planilla».
  - `PUT /api/mi-espacio/salidas` → `guardarSalidas`, en `enTransaccion(usuarioId, false, …)`: el estado bajo el bloqueo; `frenoDeLasHorasExtras`; planta, 400 `planillaSoloContrato`; `dias` lista de 1 a 100 (`sinDias` / `muchosDias` en `dias`), sin fechas repetidas (`diaRepetido`, con esa `fecha`); `validarSalida` de **todos** con `feriados` de `feriadosPara([estado], hoy)`: con errores, 400 `{ success: false, error, campo, fecha, errores: [{ fecha, campo, mensaje }] }` ordenados por fecha (el primero arriba) y nada escrito; si no, por día `INSERT INTO mi_espacio_salidas (usuario_id, fecha, entrada, salida, nota) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE entrada = VALUES(entrada), salida = VALUES(salida), nota = VALUES(nota), activo = 1`, o en un borrado `UPDATE mi_espacio_salidas SET activo = 0 WHERE usuario_id = ? AND fecha = ? AND activo = 1`; 200 `{ success: true, data: { guardados }, message: 'Horas extras guardadas: 3 días.' }` (`guardados` = los días del pedido; «1 día»). 500: «Error al guardar las horas extras».
  - `POST` y `PUT /mi-espacio/horas-extras` a contrato: 400 `contratoEnLaPlanilla`, `campo` null (después del 404 de la corrección y del freno). `DELETE` sin cambios.
- [ ] **Step 1: Write the failing tests** (`tests/mi-espacio-salidas-api.test.js`; las fechas desde la fecha real, como en `mi-espacio-api.test.js`, y la tabla `feriados` vacía en el `beforeEach`): sin sesión 401; GET de contrato (editor y colaborador de contrato), de planta (400), sin vínculo (200 con `modalidad: null`); **los meses raros** (Review Focus 3: `?mes=2026-13`, `?mes=2026-1`, `?mes=2026-10-01`, `?mes=a&mes=b`, el mes que viene, uno de hace tres años → 400 en `mes`); PUT: alta (y lo que devuelve el GET después: `salida: '16:46'`, `horas: 2`), corrección, borrado (`activo = 0`), volver a cargar un día borrado (la misma fila, `activo = 1`), todo o nada (dos días, uno con error: ninguno escrito, `errores` con el malo, `fecha` y `campo`), cada 400 (sin arranque, planta, `dias` vacío o de 101, repetido, futuro, licencia de día entero, feriado sin entrada —con un feriado cargado por SQL—, `'16:46:00'`), el doble envío (dos PUT a la vez del mismo día: una sola fila, sin 500), y que después el Resumen (`tanques.otros` de horas a favor), `GET /mi-espacio/horas-extras` (`dias_por_mes` y `a_favor_detalle`) y el cálculo de «Cargar licencia» de unas horas a favor del mes siguiente usan las salidas; `POST /mi-espacio/horas-extras` de contrato, 400 `contratoEnLaPlanilla`; `DELETE` de una fila vieja de contrato, 200.
- [ ] **Step 2:** `node --test tests/mi-espacio-salidas-api.test.js tests/permisos.test.js` → FAIL.
- [ ] **Step 3:** implementar las rutas (`router.get('/mi-espacio/salidas', authMiddleware, verPlanilla)`, `router.put('/mi-espacio/salidas', authMiddleware, guardarSalidas)`, junto a las de horas extras) y el controlador.
- [ ] **Step 4:** → PASS; `npm test` completo.
- [ ] **Step 5:** commit `feat(mi-espacio): GET y PUT /mi-espacio/salidas`.

### Task 7: La planilla en la página, lo puro

**Files:**
- Modify: `public/js/mi-espacio.js` (lo puro, en la sección de los formularios; las copias, con las demás copias)
- Test: `tests/mi-espacio-frontend.test.js`

**Interfaces:**
- Consumes: la forma de `planillaDelMes` y de la tabla de contrato (Task 5).
- Produces (puras, en el `vm`):
  - Copias atadas por paridad: `SALIDA_DE_LA_JORNADA`, `TOLERANCIA_DIA_HABIL`, `TOLERANCIA_DIA_INHABIL`, `MAXIMO_DIAS_POR_GUARDADO`, los mensajes nuevos (en `MENSAJES_FORMULARIOS`, con el mismo nombre), `enDiasDeFranco`, `textoDeLaSumaDelMes`, y `horasDelDiaDeLaPlanilla({ tipo, entrada, salida }) → number | null` (la de `horasDeLaSalida`, con el `tipo` del día que manda el servidor en lugar de los feriados).
  - `erroresDeLaPlanilla(cambios, diasPorFecha) → Map<fecha, { campo, mensaje }>`: los pasos 3 a 7 de `validarSalida` (el formato de las horas, la salida que falta, la entrada que falta, el orden, la nota); los días que no llegaron y los de licencia no se pueden tocar en la página.
  - `fechasCambiadas(cambios, diasPorFecha) → string[]`: las fechas cuyo `{ entrada, salida, nota }` es distinto de lo guardado (un día vuelto a como estaba no cuenta: Review Focus 5); un sábado o domingo sumado sin nada no cuenta.
  - `cuerpoDeLaPlanilla(cambios, fechas) → { dias: [{ fecha, entrada, salida, nota }] }` (horas cortadas a `'HH:MM'`, vacío como `''`: Review Focus 1).
  - `htmlDeLaPlanilla(planilla, { cambios, agregados, errores, notasAbiertas }) → string` (las semanas y las filas de la maqueta, con sus clases, `role="group"`, `aria-labelledby`, `aria-label` de cada campo, `aria-invalid`/`aria-describedby` con error, el aviso de la fila y «Quitar» en un sábado o domingo y en un día de licencia con salida), `htmlDeLaBandaDeLaPlanilla(mes, horas, hoy)`, `textoDelPieDeLaPlanilla(fechas) → string` («Todo guardado.» / «3 días con cambios sin guardar (septiembre y octubre).»), `textoDeLaSemana(fechas) → string` («5 al 9 de octubre», «1 y 2 de octubre», «30 de octubre»), `htmlDeDiaPorDiaDeSalidas(tabla, mes)` (con `data-editar-salida="AAAA-MM-DD"` y `aria-label` «Editar el lunes 05/10») y `htmlDeTablaDeHorasAFavor` con `a_favor_detalle` en un `<small>`. `htmlDeHorasExtras` usa `htmlDeDiaPorDiaDeSalidas` en contrato.
- [ ] **Step 1: Write the failing tests:** las paridades (contra `services/miEspacioReglas.js`: las constantes, los mensajes, `enDiasDeFranco` en 0/1/4,5/7/18,5/20,5/21, `textoDeLaSumaDelMes` en los cuatro casos, `horasDelDiaDeLaPlanilla` vs `horasDeLaSalida` en los 19 renglones del CSV y los ejemplos del feriado de la Task 2, con el `tipo` de `tipoDeDia`); `erroresDeLaPlanilla` contra `validarSalida` en los casos de los pasos 3 a 7 (mismo campo y mismo mensaje); `fechasCambiadas` (cambiado, vuelto a como estaba, sábado sumado vacío); `cuerpoDeLaPlanilla` con `'16:46:00'` → `'16:46'`; `htmlDeLaPlanilla` con la planilla de la Task 5 pasada por JSON (cada tipo de fila, «Hoy», «Todavía no llegó.», la licencia entera sin campos y con una salida vieja con su aviso y «Quitar», un error, una nota abierta y una cerrada, todo texto escapado —un feriado con `<b>` en el nombre—); la banda; el pie; las semanas; el día por día nuevo y la tabla con el detalle.
- [ ] **Step 2:** `node --test tests/mi-espacio-frontend.test.js` → FAIL. **Step 3:** implementar. **Step 4:** → PASS; `npm test` completo.
- [ ] **Step 5:** commit `feat(mi-espacio): la planilla de horas, lo puro de la página`.

### Task 8: La planilla en la página, el modal

**Files:**
- Modify: `public/mi-espacio.html` (el modal `#modal-planilla` y sus estilos en el `<style>`, con prefijo propio —la maqueta usa `.mp-`—; el `?v=` de `mi-espacio.js`), `public/js/mi-espacio.js` (lo que toca el DOM, al final), `tests/paginas.test.js` (`VERSION_MI_ESPACIO` = `'20261213'`, después del `'20261212'` del Word; los ids del modal, los estilos)
- Test: `tests/mi-espacio-frontend.test.js` (con el DOM y el `fetch` falsos)

**Interfaces:**
- Consumes: Task 7; `abrirModal`, `cerrarModal`, `estaOcupado`, `respaldoDelFoco`, `volverAPedirTodo`, `avisarMiEspacio`, `anunciar`, `pedirConfirmacion` (Task 1 confirma sus firmas).
- Produces:
  - El modal: `#modal-planilla` con `#mp-titulo`, `#mp-anterior`, `#mp-mes-titulo`, `#mp-siguiente`, `#mp-suma`, `#mp-cuerpo`, `#mp-error` (`role="alert"`), `#mp-anuncio` (región viva propia, `.visualmente-oculto`), el `<details>` «Cómo se cuentan las horas», las columnas, `#mp-dias`, `#mp-sumar`, `#mp-pendientes`, `#mp-guardar` y los `[data-cerrar]`; la maqueta (`index.html`, `planilla.css`) es la referencia visual, sin su barra oscura.
  - `pagina.planilla = { mes, meses: Map, cambios: Map, agregados: Set, errores: Map, notasAbiertas: Set, guardando, pedido }`; `abrirPlanilla({ mes, fecha, volverA })`, `cargarMesDeLaPlanilla(mes)` (descarta la respuesta vieja por `pedido`), `guardarPlanilla()`, `pedirSalirDeLaPlanilla()`; `estaOcupado('modal-planilla')` mientras guarda.
  - `pedirConfirmacion` acepta textos propios para el botón que confirma y el que vuelve (`textoSi`, `textoNo`; de entrada, los de hoy), para «¿Salir sin guardar?» / «Los cambios de 3 días se pierden.» / «Seguir cargando» / «Salir sin guardar».
  - En contrato, `#btn-cargar-horas` y `[data-cargar="horas"]` abren la planilla (sin arranque, «Mis vacaciones y saldos», como hoy) y `[data-editar-salida]` la abre en ese día; en planta, todo como hoy.
- [ ] **Step 1: Write the failing tests** (DOM y `fetch` falsos, como los de horas extras de hoy): abrir desde el encabezado y desde la tarjeta (un GET del mes en curso; el foco en la salida de hoy); «Editar» del día por día abre ese mes con el foco en esa salida; escribir una salida actualiza las horas de la fila, la semana, la banda y el pie; cambiar de mes pide el otro mes una vez y conserva los cambios; volver al mes no lo vuelve a pedir; sumar un sábado (el foco en su entrada) y quitarlo; abrir y cerrar una nota; Enter en una salida va a la siguiente y en la última a «Guardar»; guardar con un error local en la fila (sin PUT); **guardar con el error en otro mes** (Review Focus 4: pasa a ese mes y el foco va al campo); guardar bien (un PUT con los días cambiados, cierra, avisa «Horas extras guardadas: 3 días.», vuelve a pedir el Resumen y la pestaña); un 400 del servidor con `errores` va a esas filas; un 400 sin días va a `#mp-error`; el doble clic manda un solo PUT; cerrar con cambios pregunta y «Seguir cargando» vuelve al modal sin perder nada, «Salir sin guardar» cierra y descarta; cerrar sin cambios no pregunta; Escape hace lo mismo; planta sigue abriendo `#modal-horas`. En `paginas.test.js`: `VERSION_MI_ESPACIO`, los ids del modal, que los estilos nuevos usen solo `var(--sg-*)` definidas y el corte de 720 px.
- [ ] **Step 2:** → FAIL. **Step 3:** implementar. **Step 4:** → PASS; `npm test` completo; mirar la página en el navegador (el servidor del worktree en el puerto 3071 con la copia `rpad_rama_horas`; nunca el 3031 ni la base del Word, nunca escribir en `datospublicos_mcr_rpad`) a 1366 px y a 375 px: que se vea como la maqueta y sin desplazamiento horizontal.
- [ ] **Step 5:** commit `feat(mi-espacio): la planilla de horas extras de contrato en la página`.

### Task 9: El cierre

**Files:** `CLAUDE.md`, el kit en el Escritorio (fuera del repo).

- [ ] **Step 1:** `CLAUDE.md`: «Base de datos» (42 tablas, `mi_espacio_salidas`, la migración y la vuelta atrás, que va antes del código), «Mi espacio: licencias y horas extras» (la planilla de contrato, las reglas, las rutas, los avisos de las salidas), la convención de `mi-espacio.js` (las copias nuevas y sus paridades, `VERSION_MI_ESPACIO`), el despliegue.
- [ ] **Step 2:** `npm test` completo: todo lo de la base más lo nuevo, sin fallas.
- [ ] **Step 3:** revisión final de toda la rama con un subagente Opus nuevo (spec, plan y diff contra main); corregir lo que encuentre y volver al Step 2.
- [ ] **Step 4:** si todo da bien, merge en `main` y push (regla del usuario); si algo no da, parar y avisar.
- [ ] **Step 5:** la migración en la base local `datospublicos_mcr_rpad`, con un respaldo antes (`mariadb-dump` a un archivo fuera del repo).
- [ ] **Step 6:** el kit `RPAD-deploy-mi-espacio-horas` en el Escritorio, que va **después** del kit del Word: la consulta previa (spec §11, tiene que dar 0), `migracion-mi-espacio-horas.sql` antes de los archivos, el zip y lo mismo sin comprimir, la lista de archivos a subir, Restart, y `vuelta-atras/` con los archivos de 2aa394a (más `rollback-mi-espacio-horas.sql`). Comparar todo byte a byte con git, también lo que va dentro del zip.
- [ ] **Step 7:** el traspaso en la carpeta de notas de la coordinadora (para la sesión de Feriados: el main nuevo, qué archivos cambiaron, el kit) y el aviso a la coordinadora con SendMessage: el hash del merge, los tests antes y después, y el kit. Limpieza: quitar el junction de `node_modules` (y comprobar que no queda), borrar la base `rpad_rama_horas` y su permiso, apagar los servidores de prueba.
