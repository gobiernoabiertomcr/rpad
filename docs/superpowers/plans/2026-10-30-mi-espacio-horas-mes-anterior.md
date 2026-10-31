# Sumar las horas de un día al mes anterior: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En la planilla de horas extras de contrato de Mi espacio, un tilde «Sumar a {mes anterior}» por día que hace que las horas de ese día cuenten como horas extras del mes anterior, y que la planilla, la pestaña Horas extras y la nota en Word lo digan.

**Architecture:** Una columna nueva, `mi_espacio_salidas.al_mes_anterior`. La única regla que cambia es a qué mes suma una salida (`mesDeLaSalida`, que usa `horasPorMesDeSalidas`): todo lo que sale de las horas a favor se acomoda solo. La planilla, la pestaña y la nota reciben del servidor lo que hay que mostrar (Ruling 19), y el navegador recalcula solo mientras se escribe o se tilda, con copias atadas por tests de paridad.

**Tech Stack:** Node 22 + Express (ESM), MariaDB (mysql2/promise), vanilla JS en el navegador, `node --test`, `docx`.

**Spec:** `docs/superpowers/specs/2026-10-30-mi-espacio-horas-mes-anterior-design.md` (léanla entera; donde la maqueta difiere, manda la spec). Maqueta: `docs/superpowers/specs/2026-10-30-mi-espacio-horas-mes-anterior-mockups/` (`maqueta.js`, con lo nuevo marcado «NUEVO», y `propuesta.css`: sirven de referencia para el marcado y los estilos).

## Global Constraints

- Convenciones del `CLAUDE.md` del repo: ES modules, castellano, `async/await`, consultas parametrizadas con `?`, respuestas `{ success, data?, error?, campo?, message? }`, fechas como texto `'AAAA-MM-DD'`, sin `Date` local en las reglas.
- **El repo es público:** solo datos inventados en tests, comentarios, docs y commits. Ningún nombre de la tabla `usuarios` de producción. No usar el caso real: nada de 6,5 h en octubre de 2026 con 0,5 h el 03/11/2026, ni una salida a las 17:16 del 30/10/2026. Usen, por ejemplo, enero y febrero de 2027 (los de la maqueta: Sofía Paz, enero 5,5 h, el martes 02/02/2027 salida 16:20 → 1,5 h tildado, el miércoles 03/02/2027 salida 15:50 → 1 h).
- Ningún email real; nunca llamar a `/api/cron/*`. La base del `.env` es la copia `rpad_rama_horas_mes_anterior`; nunca tocar `datospublicos_mcr_rpad`.
- Ruling 19: los textos los arma el servidor; el navegador no recalcula nada salvo lo que cambia mientras se escribe o se tilda, y cada copia está atada por un test de paridad en `tests/mi-espacio-frontend.test.js`.
- Todo texto del servidor pasa por `esc` en `mi-espacio.js`; un número va con `String` o `numeroConComa`.
- Textos exactos (de la spec): el tilde «Sumar a enero» (el mes anterior, en minúscula, sin año); su nombre accesible «Sumar a enero el martes 02/02»; la pastilla de un día tildado con «→ enero» (el lector de pantalla: «van a enero»); la segunda línea de la banda «Incluye 1,5 h de febrero.» y «1,5 h del martes 02/02 suman a enero.» («suma» con 1 h; con dos días «1,5 h del martes 02/02 y del jueves 04/02 suman a enero.»; con más, «4 h de 3 días suman a enero.»); el bloque «De febrero» con «Ver en febrero»; en «Cómo se cuentan las horas», «Si te autorizan a sumar las horas de un día al mes anterior, tildá «Sumar a enero»: cuentan como horas extras de enero.»; en la tabla «5,5 h + 1,5 h de febrero», «1,5 h de febrero» (sin horas propias) y «1,5 h suman a enero» («suma» con 1 h); en el día por día «Suma a enero» y «De febrero»; «Sin horas a favor»; el 400 «Elegí si este día suma al mes anterior.».
- La banda: «tuviste» si el mes de uso (el siguiente al de la planilla) ya pasó, «tenés» si es el de hoy, «vas a tener» si no llegó.
- La nota en Word de «Horas a favor» (todas): «el usufructo de {horas} a favor el día {día}, {correspondiente(s)} a las horas extras realizadas en {mes de año}.» y, con días sumados, antes del punto: « (incluidas las del martes 2 de febrero de 2027, sumadas a enero)»; dos: «las del martes 2 y el miércoles 3 de febrero de 2027»; tres o más: «las del lunes 1, el martes 2 y el miércoles 3 de febrero de 2027».
- `VERSION_MI_ESPACIO` pasa de `'20261218'` a `'20261219'` (en `public/mi-espacio.html` y en `tests/paginas.test.js`).
- Un commit por tarea, con la línea final `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Antes de cada commit, el diff se cruza contra los nombres reales con el script `cruce-nombres.mjs` que da el controlador (fuera del repo; `git diff --cached` por stdin, con `-`): tiene que dar 0 coincidencias.
- Los tests de un archivo se corren con `node --test tests/<archivo>.test.js` (los de Docker necesitan `docker compose` arriba y el `.env` del worktree). La suite completa la corre solo el controlador, con el candado.

## Review Focus

1. Una página vieja (la de antes, en otra pestaña) guarda días sin `al_mes_anterior`: un día tildado tiene que seguir tildado. → Task 2, test «sin el campo se conserva lo guardado».
2. Un día tildado que se borra y después se vuelve a cargar: vuelve sin tildar (la baja lo deja en 0 y el upsert sin el campo no lo revive). → Task 2, test «el borrado deja la marca en 0».
3. Se tilda un día de febrero sin guardar y se va a enero: la banda y el bloque de enero ya lo muestran; destildarlo sin guardar lo saca. → Task 6, test del DOM.
4. Un día de enero tildado suma a diciembre del año anterior: la tabla del año anterior lo cuenta y su día por día lo lista, aunque la fecha sea del año siguiente. → Task 3, test «cruzando el año».
5. Las mismas horas nunca cuentan dos veces: la suma de `horasPorMesDeSalidas` de todos los meses es igual a la suma de las horas de todos los días, con y sin tildes. → Task 1, test «no se cuentan dos veces».

---

### Task 1: Las reglas puras

**Files:**
- Modify: `services/miEspacioReglas.js` (`MENSAJES_MI_ESPACIO`, `horasPorMesDeSalidas` ~1138, `textoDeLaSumaDelMes` ~1177, `validarSalida` ~1236)
- Modify: `public/js/mi-espacio.js` (`fraseDeLaSumaDelMes` ~814: el verbo, para que no se rompa la paridad)
- Test: `tests/mi-espacio-reglas.test.js`, `tests/mi-espacio-resumen.test.js` (~1843), `tests/mi-espacio-frontend.test.js` (~3632)

**Interfaces:**
- Produces:
  - `MENSAJES_MI_ESPACIO.alMesAnterior = 'Elegí si este día suma al mes anterior.'`
  - `mesDeLaSalida(fila) -> string | null`: el 'AAAA-MM' al que suman las horas de una salida: el de su fecha, o `mesMas(ese, -1)` si `fila.al_mes_anterior === true` (solo el `true` literal). Sin una fecha válida, null.
  - `horasPorMesDeSalidas(salidas, feriados)` (misma firma): pone cada día en `mesDeLaSalida(fila)`.
  - `repartoDelMes(salidas, mes, feriados) -> { propias: number, entran: Array<{ fecha, horas, fila }>, van: Array<{ fecha, horas, fila }> }`: `propias`, la suma de las horas (`horasDeLaSalida`, null cuenta 0) de los días de `mes` sin tildar; `entran`, los días tildados de `mesMas(mes, 1)`; `van`, los días tildados de `mes`; las dos listas por fecha, con `horas` (number o null) y la fila entera. Con un mes que no sirve, `{ propias: 0, entran: [], van: [] }`. Cumple: `propias + Σ entran.horas = horasPorMesDeSalidas(...).get(mes) ?? 0`.
  - `textoDeLoQueSeMueve(mes, entran, van) -> string`: la segunda línea de la banda (texto plano), con las listas de `repartoDelMes` (lee solo `fecha` y `horas` de cada una); solo cuentan los días con horas > 0; '' si no hay nada. Hasta dos frases separadas por un espacio, en este orden: «Incluye 1,5 h de febrero.» y «1,5 h del martes 02/02 suman a enero.» (un día: `del ${diaDeLaSemana} ${diaYMes}`; dos: «del martes 02/02 y del jueves 04/02»; tres o más: «de 3 días»; «suma» si el total es 1).
  - `textoDeLaSumaDelMes(mes, horas, hoy)`: el verbo según el mes de uso (`mesMas(mes, MESES_HASTA_LAS_HORAS)`) contra el mes de hoy: anterior «tuviste», igual «tenés», posterior «vas a tener». Sin horas, como hoy.
  - `validarSalida(dia, contexto)`: `datos` suma `al_mes_anterior: true | false | null`. En un borrado, `false`. Si no es un borrado: sin la clave en `dia` (o `undefined`), `null` (= conservar lo guardado); `true` o `false` literal, ese; otro valor, `rechazo('al_mes_anterior', MENSAJES_MI_ESPACIO.alMesAnterior)`, controlado al final, después de la nota.

- [ ] **Step 1: Write the failing tests** en `tests/mi-espacio-reglas.test.js`, en un `describe('sumar al mes anterior')`, con datos inventados de enero y febrero de 2027 y feriados `new Set()`:
  - `mesDeLaSalida({ fecha: '2027-02-02', al_mes_anterior: true })` → `'2027-01'`; con `false`, sin la clave o con `'true'` → `'2027-02'`; `{ fecha: '2027-01-05', al_mes_anterior: true }` → `'2026-12'`; `{ fecha: 'x' }` → `null`.
  - `horasPorMesDeSalidas` con enero (días de 5,5 h en total) y `{ fecha: '2027-02-02', salida: '16:20', al_mes_anterior: true }` y `{ fecha: '2027-02-03', salida: '15:50' }` → `Map { '2027-01' => 7, '2027-02' => 1 }`.
  - «no se cuentan dos veces»: para esas salidas y para las mismas con todos los tildes en `true`, la suma de los valores del Map es igual a la suma de `horasDeLaSalida` de cada día.
  - `repartoDelMes(salidas, '2027-01', feriados)` → `propias` 5,5, `entran` con la fila del 02/02 y `horas` 1,5, `van` []; `repartoDelMes(salidas, '2027-02', …)` → `propias` 1, `entran` [], `van` con la del 02/02.
  - `textoDeLoQueSeMueve`: enero → «Incluye 1,5 h de febrero.»; febrero → «1,5 h del martes 02/02 suman a enero.»; un día de 1 h → «1 h del martes 02/02 suma a enero.»; dos días → «… del martes 02/02 y del jueves 04/02 suman a enero.»; tres → «4 h de 3 días suman a enero.»; los dos a la vez en un mes que recibe y da → las dos frases separadas por un espacio; un tildado con 0 h no cuenta; sin nada → ''.
  - `textoDeLaSumaDelMes('2027-01', 7, '2027-02-03')` → 'En febrero tenés 1 día de franco.'; `('2027-01', 7, '2027-03-01')` → 'En febrero tuviste 1 día de franco.'; `('2027-02', 1, '2027-02-03')` → 'En marzo vas a tener 1 hora a favor.'.
  - `validarSalida`: con `al_mes_anterior: true` → `datos.al_mes_anterior === true`; sin la clave → `null`; un borrado con `true` → `false`; con `'si'` → error `{ campo: 'al_mes_anterior', mensaje: 'Elegí si este día suma al mes anterior.' }`; con `'si'` y además la salida mal → el error de la salida (el del tilde va al final).
- [ ] **Step 2:** `node --test tests/mi-espacio-reglas.test.js` → FAIL (`mesDeLaSalida` no existe, etc.).
- [ ] **Step 3:** Implementar en `services/miEspacioReglas.js` lo de Interfaces (exportar `mesDeLaSalida`, `repartoDelMes` y `textoDeLoQueSeMueve`). En `public/js/mi-espacio.js`, `fraseDeLaSumaDelMes` toma el mismo verbo (comparando el mes de uso con el de hoy).
- [ ] **Step 4:** Actualizar las aserciones que cambian por el verbo (respuesta del usuario): en `tests/mi-espacio-reglas.test.js` (~1432 y ~1435) `'2026-09'` con hoy `'2026-10-27'` pasa a «En octubre tenés …»; en `tests/mi-espacio-resumen.test.js` (~1843) y en `tests/mi-espacio-frontend.test.js` (~3632), igual. Ninguna otra aserción existente cambia.
- [ ] **Step 5:** `node --test tests/mi-espacio-reglas.test.js tests/mi-espacio-resumen.test.js tests/mi-espacio-frontend.test.js` → PASS.
- [ ] **Step 6: Commit** `feat(mi-espacio): las horas de una salida tildada suman al mes anterior (reglas)`.

### Task 2: La columna, la lectura y el guardado

**Files:**
- Create: `database/updates/migracion-mi-espacio-horas-mes-anterior.sql`, `database/updates/rollback-mi-espacio-horas-mes-anterior.sql`
- Modify: `database/schema.sql` (`mi_espacio_salidas`), `services/miEspacioDatos.js` (~136, la consulta de `estadosDe`), `controllers/miEspacioController.js` (~635-681: `UPSERT_DE_LA_SALIDA`, `BAJA_DE_LA_SALIDA`, el bucle de `guardarSalidas`)
- Test: `tests/schema.test.js`, `tests/mi-espacio-api.test.js`, `tests/mi-espacio-salidas-api.test.js`

**Interfaces:**
- Consumes: `validarSalida` con `datos.al_mes_anterior` (Task 1).
- Produces: `estado.salidas[i].al_mes_anterior: boolean` (de `Number(fila.al_mes_anterior) === 1`); el `PUT /mi-espacio/salidas` acepta `al_mes_anterior` por día.

- [ ] **Step 1: Migración y vuelta atrás.** `migracion-…sql`: cabecera como `migracion-mi-espacio-horas.sql` (qué hace, que va después de esa y **antes** del código, obligatoria, repetible, que lo cargado queda en 0 y que el código anterior anda con la columna) y `ALTER TABLE mi_espacio_salidas ADD COLUMN IF NOT EXISTS al_mes_anterior tinyint(1) NOT NULL DEFAULT 0 AFTER nota;`, con una consulta comentada de verificación (`SHOW COLUMNS … LIKE 'al_mes_anterior'` da 1 fila). `rollback-…sql`: va después de volver a los archivos anteriores; `ALTER TABLE mi_espacio_salidas DROP COLUMN IF EXISTS al_mes_anterior;`; dice que las horas tildadas vuelven a su mes y que va antes que `rollback-mi-espacio-horas.sql`. `schema.sql`: la columna después de `nota`.
- [ ] **Step 2: Correr la migración en la base del `.env`** (`rpad_rama_horas_mes_anterior`, la copia de la rama; nunca otra): `docker exec -i -e MYSQL_PWD=… rpad-db mariadb -uroot rpad_rama_horas_mes_anterior < database/updates/migracion-mi-espacio-horas-mes-anterior.sql` (la clave de root sale del `.env`, sin imprimirla). Sin esto, `schema.test.js` falla.
- [ ] **Step 3: Write the failing tests.**
  - `tests/schema.test.js`: la columna en `schema.sql` y en la base; la migración dos veces sobre la estructura de main (como el `describe` de `migracion-mi-espacio-horas.sql`) deja la columna una vez; la vuelta atrás la saca y se puede repetir; las filas que había quedan con 0.
  - `tests/mi-espacio-api.test.js`: `estadosDe` (o `estadoDe`) trae `al_mes_anterior: true` en una salida guardada con 1 y `false` en una con 0.
  - `tests/mi-espacio-salidas-api.test.js`, en un `describe('sumar al mes anterior')`, con una persona inventada de contrato y fechas relativas a hoy como los tests de ese archivo (un día del mes de hoy, tildado, suma al mes anterior):
    - `PUT` con `al_mes_anterior: true` → 200; la fila queda con 1; `GET /mi-espacio/horas-extras` muestra las horas en la fila del mes anterior.
    - «sin el campo se conserva lo guardado»: después, un `PUT` del mismo día con otra salida y sin `al_mes_anterior` → la fila sigue con 1.
    - `PUT` con `false` → 0.
    - «el borrado deja la marca en 0»: un borrado de un día tildado → `activo` 0 y `al_mes_anterior` 0; volver a cargarlo sin el campo → `activo` 1 y 0.
    - `al_mes_anterior: 'si'` → 400 con `campo: 'al_mes_anterior'`, `fecha` y el mensaje; no se guarda ninguno de los días del pedido.
- [ ] **Step 4:** Correr esos tres archivos → FAIL.
- [ ] **Step 5: Implementar.** `estadosDe`: `al_mes_anterior` en el SELECT y `al_mes_anterior: Number(fila.al_mes_anterior) === 1` en cada salida. Controlador: dos upserts, `UPSERT_DE_LA_SALIDA` (sin la columna: un día nuevo queda en 0 y uno guardado conserva la suya) y `UPSERT_DE_LA_SALIDA_CON_LA_MARCA` (con `al_mes_anterior` en el `INSERT` y `al_mes_anterior = VALUES(al_mes_anterior)` en el `UPDATE`), elegido por `datos.al_mes_anterior === null`; `BAJA_DE_LA_SALIDA` pone además `al_mes_anterior = 0`. Comentario de `guardarSalidas`: suma la marca al cuerpo.
- [ ] **Step 6:** Correr los tres archivos → PASS.
- [ ] **Step 7: Commit** `feat(mi-espacio): la marca al_mes_anterior de la planilla, guardada y leída (con su migración)`.

### Task 3: La planilla y la pestaña en el servidor

**Files:**
- Modify: `services/miEspacioResumen.js` (`planillaDelMes` ~1185, `diaDeLaPlanilla` ~1168, `diasDeLasSalidas` ~1020, `tablaDeHorasExtras` ~1062, `situacionDeLasHoras` ~915)
- Test: `tests/mi-espacio-resumen.test.js`, `tests/mi-espacio-salidas-api.test.js`

**Interfaces:**
- Consumes: `mesDeLaSalida`, `repartoDelMes`, `textoDeLoQueSeMueve`, `horasPorMesDeSalidas`, `nombreDelMes` (Task 1).
- Produces (las formas que la página usa en las Tasks 5 y 6):
  - En `planillaDelMes`: cada día suma `al_mes_anterior: boolean`; la planilla suma `sumar_a: string` (el nombre del mes anterior, «enero»; en todos los meses) y `entran: Dia[]` (los días tildados del mes siguiente, por fecha, con la misma forma de un día —armados con `diaDeLaPlanilla` y los nombres de los feriados del año de su fecha—; si el mes siguiente es posterior al de hoy, []); `suma` pasa a `{ horas, cifra, texto, detalle }`, con `horas = propias + Σ entran.horas` de `repartoDelMes` (igual a `horasPorMesDeSalidas(...).get(mes) ?? 0`) y `detalle = textoDeLoQueSeMueve(mes, entran, van)`.
  - En `tablaDeHorasExtras` (contrato): cada mes suma `horas_detalle: string` («5,5 h + 1,5 h de febrero», «1,5 h de febrero» sin propias, «1,5 h suman a enero» —«suma» con 1 h—; si recibe y da, las dos separadas por « · »; si no, ''). Las filas son los meses del año con horas a favor (como hoy) **más** los meses del año con al menos una salida activa (por la fecha de la salida); una fila sin la de `cuenta.horasAFavor` se arma con `horas: 0`, `a_favor_texto` el mes de uso, `a_favor_detalle: ''`, `usadas_texto: '—'`. «Situación»: si `horas === 0`, `usadas === 0` y el mes trabajado ya terminó → `['sin_horas', 'Sin horas a favor']`; si no, `situacionDeLasHoras` como hoy.
  - En `diasDeLasSalidas`: cada día suma `suma_a: string` («Suma a enero» si está tildado; si no, '') y los días tildados que suman a un mes del año van **también** al final de la lista de ese mes, con `tipo_texto: 'De febrero'` y `de_otro_mes: true` (en su propio mes siguen con `suma_a`). Toma las salidas cuya fecha **o** cuyo `mesDeLaSalida` es del año. `totales_por_mes[mes]` es lo que suma el mes con la regla nueva (`conUnidad(horas, 'hora', 'horas')`).

- [ ] **Step 1: Write the failing tests** en `tests/mi-espacio-resumen.test.js` (un `describe('sumar al mes anterior')`, con el caso de contrato de los fixtures o uno inventado de enero y febrero de 2027, hoy `'2027-02-03'`):
  - `planillaDelMes(…, { mes: '2027-01' })`: `suma.horas` 7, `suma.cifra` '7', `suma.texto` 'En febrero tenés 1 día de franco.', `suma.detalle` 'Incluye 1,5 h de febrero.', `entran` con un día `fecha: '2027-02-02'` y `horas: 1.5`, `sumar_a` 'diciembre'.
  - `planillaDelMes(…, { mes: '2027-02' })`: el día 02/02 con `al_mes_anterior: true` y `horas: 1.5`; `suma.horas` 1; `suma.detalle` '1,5 h del martes 02/02 suman a enero.'; `entran` []; `sumar_a` 'enero'.
  - `tablaDeHorasExtras(…, { anio: 2027 })`: enero `horas_texto` '7 h', `horas_detalle` '5,5 h + 1,5 h de febrero', `a_favor_detalle` '1 día de franco'; febrero `horas_texto` '1 h', `horas_detalle` '1,5 h suman a enero'.
  - Un mes cuyas horas pasan todas al anterior (febrero solo con el 02/02 tildado) tiene su fila: '0 h', `a_favor_texto` 'Marzo 2027', 'El mes sigue sumando'; con hoy en abril de 2027 dice 'Sin horas a favor'. Un mes con una salida de 15:05 (0 h) también tiene fila.
  - «cruzando el año»: un día del 05/01/2027 tildado → la tabla de 2026 tiene diciembre con sus horas y su día por día lista el 05/01 al final con 'De enero'; la de 2027 lista el 05/01 en enero con 'Suma a diciembre'.
  - `dias_por_mes['2027-02']` tiene el 02/02 con `suma_a` 'Suma a enero'; `dias_por_mes['2027-01']` termina con el 02/02 con `tipo_texto` 'De febrero' y `de_otro_mes: true`; `totales_por_mes['2027-01']` '7 horas'.
  - Sin tildes, todo lo de antes da lo mismo (las aserciones existentes no cambian, salvo la del verbo de la Task 1).
  - En `tests/mi-espacio-salidas-api.test.js`: `GET /mi-espacio/salidas?mes=` del mes anterior, después de guardar un día tildado del mes de hoy, trae ese día en `entran` y `suma.detalle`.
- [ ] **Step 2:** Correr los dos archivos → FAIL.
- [ ] **Step 3:** Implementar lo de Interfaces. `planillaDelMes`: la suma con `repartoDelMes` (no con `dias`); `entran` con un contexto de `diaDeLaPlanilla` para el mes siguiente (sus salidas y los nombres de los feriados de su año). Actualizar los JSDoc de las tres funciones.
- [ ] **Step 4:** Correr → PASS.
- [ ] **Step 5: Commit** `feat(mi-espacio): la planilla y la pestaña dicen lo que se suma al mes anterior (servidor)`.

### Task 4: La nota en Word de las horas a favor

**Files:**
- Modify: `services/miEspacioNota.js` (`CUERPOS.horas_a_favor` ~154, `notaDeLicencia` ~184), `controllers/miEspacioController.js` (`leerLaNota` ~445)
- Test: `tests/mi-espacio-nota.test.js` (~135, la aserción de las horas a favor), `tests/mi-espacio-nota-word.test.js`, `tests/mi-espacio-api.test.js`

**Interfaces:**
- Consumes: `horasDeLaSalida`, `nombreDelMes`, `mesMas`, `MESES_HASTA_LAS_HORAS` (de `miEspacioReglas.js`).
- Produces: `notaDeLicencia(licencia, { fecha, persona, feriados, salidas })`: `salidas` opcional (las de `estado.salidas`; sin ellas, []). El cuerpo de `horas_a_favor` recibe además `salidas` y `feriados`.

- [ ] **Step 1: Write the failing tests** en `tests/mi-espacio-nota.test.js`:
  - Sin salidas: la aserción de ~135 pasa a `${PIDO}el usufructo de dos horas y media (2,5) a favor el día jueves 15 de octubre de 2026, correspondientes a las horas extras realizadas en septiembre de 2026.` (decisión del usuario: el día primero en todas). Revisar las otras aserciones de horas a favor del archivo y ponerlas en el orden nuevo.
  - Con una salida tildada del 02/02/2027 de 1,5 h y la licencia de 7 h del 05/02/2027: `${PIDO}el usufructo de siete (7) horas a favor el día viernes 5 de febrero de 2027, correspondientes a las horas extras realizadas en enero de 2027 (incluidas las del martes 2 de febrero de 2027, sumadas a enero).`
  - Dos días (02/02 y 03/02 tildados) → «(incluidas las del martes 2 y el miércoles 3 de febrero de 2027, sumadas a enero)»; tres (01/02, 02/02 y 03/02) → «(incluidas las del lunes 1, el martes 2 y el miércoles 3 de febrero de 2027, sumadas a enero)».
  - No se nombran: un tildado de 0 h, uno sin tildar, uno tildado de otro mes (por ejemplo, de marzo), una salida inválida.
  - «correspondiente» con 1 h: `…una (1) hora a favor el día …, correspondiente a las horas extras …`.
  - En `tests/mi-espacio-nota-word.test.js`: con una salida tildada, el Word tiene los mismos renglones que `htmlDeLaNota` (el patrón que ya usa el archivo).
  - En `tests/mi-espacio-api.test.js` (el `describe` «la nota de una licencia»): con una salida tildada guardada, `GET …/nota` trae el paréntesis en `html`.
- [ ] **Step 2:** Correr los tres → FAIL.
- [ ] **Step 3:** Implementar: el cuerpo nuevo (el día después de «a favor», la concordancia de siempre con `correspondientesALasHoras`, y el paréntesis con los días tildados de `mesMas(mes de las horas, 1)` —el mes de la licencia— que dan horas, en orden de fecha); `leerLaNota` pasa `salidas: contexto.estado.salidas`. El franco de planta no cambia.
- [ ] **Step 4:** Correr → PASS.
- [ ] **Step 5: Commit** `feat(mi-espacio): la nota de horas a favor con el día primero y los días sumados al mes`.

### Task 5: La página: lo puro (planilla y pestaña)

**Files:**
- Modify: `public/js/mi-espacio.js` (la sección de la planilla ~1200-1600; `htmlDeTablaDeHorasAFavor` ~617; `htmlDeDiaPorDiaDeSalidas` ~649)
- Test: `tests/mi-espacio-frontend.test.js`

**Interfaces:**
- Consumes: las formas de la Task 3 (`al_mes_anterior`, `sumar_a`, `entran`, `suma.detalle`, `horas_detalle`, `suma_a`, `de_otro_mes`).
- Produces (puras, en el `vm`):
  - `valoresDeLaSalida(fuente)` → `{ entrada, salida, nota, al_mes_anterior }`, con `al_mes_anterior` `true` solo si `fuente.al_mes_anterior === true` y la salida no está vacía. `valorDelDia` trae también `al_mes_anterior` (boolean). `fechasCambiadas` compara también `al_mes_anterior`. `cuerpoDeLaPlanilla` manda siempre `al_mes_anterior` (boolean) en cada día.
  - `horasDeLosDias(dias, cambios)`: no suma los días tildados (la banda y el total de cada semana).
  - `diasQueEntran(planilla, estado) -> Array<{ dia, fecha, horas }>`: los días tildados del mes siguiente, con lo de la página encima: si `estado.meses` (Map de mes a planilla) tiene el mes siguiente, de sus días visibles con `cambios`; si no, de `planilla.entran` con `cambios`. Solo los tildados, por fecha.
  - `textoDeLoQueSeMueve(mes, entran, van)` (copia de la de la Task 1: lee solo `fecha` y `horas` de cada uno), atada por un test de paridad.
  - `htmlDelTilde(dia, valor, sumarA) -> string`: un `<label class="mp-anterior">` con un checkbox `data-campo="al_mes_anterior"` `data-fecha`, `aria-label="Sumar a ${sumarA} el ${diaLargoDe(fecha)}"` (el primero del texto visible), `checked` si `valor.al_mes_anterior`, y el texto «Sumar a {sumarA}»; sin salida, la clase `vacio` (en el `<style>`, oculto sin perder su lugar) y el checkbox con `tabindex="-1"`.
  - `htmlDeLasHorasDeLaFila(dia, valor)`: con `valor.al_mes_anterior` y horas, la pastilla con la clase `otro-mes` y `<small class="mp-va-a"><span aria-hidden="true">→ </span>{mes}</small>` con «van a {mes}» para el lector de pantalla (mirar `htmlDeLasHorasDeLaFila` de la maqueta). Recibe el mes por un tercer parámetro `sumarA`.
  - `htmlDeLaFilaDeLaPlanilla(dia, { cambios, errores, notasAbiertas, cambiadas, sumarA })`: el tilde entre las horas y «Quitar» / «Nota» (en los días con campos).
  - `htmlDeLaBandaDeLaPlanilla(mes, horas, hoy, detalle = '')`: la segunda línea en `<p class="mp-suma-aparte">` (vacía si no hay detalle, para que la banda tenga siempre el alto de dos renglones).
  - `htmlDelBloqueDelMesSiguiente(planilla, estado) -> string`: después de la última semana, si `diasQueEntran` no está vacío: un `<div class="mp-semana">` con «De {mes siguiente}» y su total, y por cada día una fila de solo lectura (`mp-dia de-otro-mes`, `role="group"`): la fecha, «Salida 16:20» (y «Entrada …»), las horas y `<button class="sg-link" data-ver-en="{fecha}" aria-label="Ver el martes 02/02 en febrero">Ver en febrero</button>`; la nota, si tiene. `htmlDeLaPlanilla` lo suma al final.
  - `textoDeSumarAlAnterior(mes, sumarA) -> string`: «Si te autorizan a sumar las horas de un día al mes anterior, tildá «Sumar a {sumarA}»: cuentan como horas extras de {sumarA}.» ('' sin un mes o un `sumarA`).
  - `htmlDeTablaDeHorasAFavor`: `horas_detalle` en un `<small>` debajo de las horas. `htmlDeDiaPorDiaDeSalidas`: un día con `suma_a` lleva la pastilla con la clase `otro-mes` y `suma_a` en un `me-detalle me-fila-otro-mes`; uno con `de_otro_mes`, su `tipo_texto` debajo de la fecha, como «Feriado». Su «Editar» sigue con `data-editar-salida` y su fecha (abre su mes).
- [ ] **Step 1: Write the failing tests** (sección nueva del archivo, con los datos de la maqueta): cada función de Interfaces con sus textos exactos; el escapado (un `sumar_a` y un `horas_detalle` con `<b>"x"</b>`); la paridad de `textoDeLoQueSeMueve` y la de `fraseDeLaSumaDelMes` con el verbo nuevo contra el servidor (con hoy en el mes de uso, antes y después); `cuerpoDeLaPlanilla` con `al_mes_anterior`; `fechasCambiadas` con un cambio solo del tilde; `horasDeLosDias` sin los tildados; `diasQueEntran` con y sin el mes siguiente en `meses`, y con un tildado sin guardar; un día sin salida con el tilde vacío; la pastilla con «→ enero».
- [ ] **Step 2:** `node --test tests/mi-espacio-frontend.test.js` → FAIL.
- [ ] **Step 3:** Implementar lo de Interfaces (la maqueta tiene una versión de cada una, marcada «NUEVO»).
- [ ] **Step 4:** Correr → PASS (los tests de antes de la planilla siguen pasando).
- [ ] **Step 5: Commit** `feat(mi-espacio): el tilde y lo que se suma al mes anterior en la planilla y la pestaña (lo puro)`.

### Task 6: La página: el DOM, el HTML y los estilos

**Files:**
- Modify: `public/js/mi-espacio.js` (`pintarLaSumaDeLaPlanilla` ~4697, `alEscribirEnLaPlanilla` ~4739, `alTocarLaPlanilla` ~4804, donde se pinta la planilla y «Cómo se cuentan», ~4545 y ~4667), `public/mi-espacio.html` (el `<details>` de `#modal-planilla`: un `<li id="mp-como-anterior">` antes de `#mp-como-mes`; el `<style>`: los estilos de `propuesta.css` de la maqueta, solo con los tokens `--sg-*` del `<style>` y `--f-titulo`/`--f-texto`; `mi-espacio.js?v=20261219`)
- Test: `tests/mi-espacio-frontend.test.js` (DOM falso), `tests/paginas.test.js`

**Interfaces:**
- Consumes: todo lo de la Task 5.

- [ ] **Step 1: Write the failing tests.**
  - DOM falso: tildar el checkbox de un día cambia `cambios` (con `al_mes_anterior`), la pastilla de la fila, el total de la semana, la banda (la cifra y `.mp-suma-aparte`) y el pie («1 día con cambios sin guardar»), sin volver a dibujar la fila (el foco queda en el checkbox); destildar lo vuelve a como estaba y el pie a «Todo guardado.».
  - Borrar la salida de un día tildado oculta el tilde (clase `vacio`) y el día se manda sin la marca.
  - Review Focus 3: tildar el 02/02 en febrero, ir a enero con «‹» → la banda de enero dice 7 h y «Incluye 1,5 h de febrero.» y el bloque «De febrero» lista el 02/02; volver, destildar, ir a enero → 5,5 h y sin bloque.
  - «Ver en febrero» abre la planilla de febrero (sin pedir de nuevo si ya está en `meses`) con el foco en el checkbox de ese día.
  - «Guardar» manda un solo `PUT` con `al_mes_anterior` en cada día cambiado.
  - «Cómo se cuentan las horas» tiene el renglón nuevo con el mes anterior.
  - `tests/paginas.test.js`: `VERSION_MI_ESPACIO` en `'20261219'`; `#mp-como-anterior` en el modal; las clases nuevas en el `<style>` (`.mp-anterior`, `.mp-va-a`, `.otro-mes` de la pastilla, `.mp-suma-aparte`, `.de-otro-mes`, `.me-fila-otro-mes`), con el corte de 720 px (el tilde de 44 px de alto en la tarjeta) y el contraste de 4,5:1 en los textos nuevos y de 3:1 en el borde punteado.
- [ ] **Step 2:** Correr los dos → FAIL.
- [ ] **Step 3:** Implementar: el `change` del checkbox en `alEscribirEnLaPlanilla` (ya escucha `input` y `change` en `#mp-dias`), `pintarLaSumaDeLaPlanilla` con la cifra de `horasDeLosDias` + `diasQueEntran` y el detalle de `textoDeLoQueSeMueve`, el bloque al pintar el mes, `data-ver-en` en `alTocarLaPlanilla` (con `irAlMesDeLaPlanilla`), el renglón de «Cómo se cuentan», los estilos y la versión.
- [ ] **Step 4:** Correr → PASS.
- [ ] **Step 5: Commit** `feat(mi-espacio): el tilde «Sumar a {mes anterior}» en la planilla (la página)`.

### Task 7: La documentación

**Files:**
- Modify: `CLAUDE.md` (la convención de `mi-espacio.js`, «Base de datos» —la planilla de contrato—, «Mi espacio: licencias y horas extras» —la planilla, su API y la pestaña—, «Mi espacio: la nota de licencia en Word» —el cuerpo de horas a favor— y «Despliegue»), `README.md` (la estructura de `database/updates/` y una sección «Migración: sumar las horas de un día al mes anterior», con el formato de la de `migracion-mi-espacio-horas.sql`: requisito —todo main desplegado, `mi-espacio.js?v=20261218` en el código fuente—, SQL → archivos → Restart, la verificación y la vuelta atrás)

- [ ] **Step 1:** Escribir los cambios, cortos, con el estilo de cada sección (sin nombres reales ni el caso real).
- [ ] **Step 2:** `node --test tests/paginas.test.js` (lee el HTML y algunas cosas del CLAUDE.md) → PASS.
- [ ] **Step 3: Commit** `docs(mi-espacio): sumar las horas de un día al mes anterior (CLAUDE.md y README)`.
