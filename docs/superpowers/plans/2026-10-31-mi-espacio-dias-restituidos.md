# Los días de vacaciones que restituye un asueto: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando un asueto (o cualquier día que deja de ser hábil) se carga en Configuración → Feriados después de unas vacaciones de Mi espacio que lo incluyen, ese día queda **por restituir**, con su plazo y su nota en Word: si su licencia vence antes del plazo, se carga como una licencia aparte («Días restituidos», caso A); si no, se pide la restitución y vuelve a la licencia (caso B). Si el plazo pasa sin nada, se pierde. Las vacaciones originales conservan sus días.

**Architecture:** Dos tablas nuevas: la **foto** (`mi_espacio_restituibles`, que se saca en la transacción del feriado: qué días de qué cargas dejó de hacer hábiles) y los **pedidos** (`mi_espacio_restituciones`). El enum de `mi_espacio_licencias.tipo` suma `'restituidos'`. Las reglas puras (`services/miEspacioReglas.js`) leen la foto, las fechas y los feriados de hoy y el reparto: los días restituibles cuentan como hábiles en su carga (así conserva sus días), y `restitucionesDe` arma los grupos (uno por carga, licencia de origen y tanda) con su plazo, su caso y su situación. Un pedido B suma una «mitad» a su licencia en `ordinariasDe`. El Resumen, la lista, «Cargar licencia», el email de las 8:15 y las notas reciben del servidor lo que hay que mostrar (Ruling 19).

**Tech Stack:** Node 22 + Express (ESM), MariaDB (mysql2/promise), vanilla JS en el navegador, `node --test`, `docx`.

**Spec:** `docs/superpowers/specs/2026-10-31-mi-espacio-dias-restituidos-design.md` (léanla entera: las secciones 3 y 17 son decisiones aprobadas del usuario y no se reabren). Maqueta: `docs/superpowers/specs/2026-10-31-mi-espacio-dias-restituidos-mockups/` (`datos.js` trae el HTML y los textos de cada momento —`window.MQ.T` tiene todos los textos—, `propuesta.css` los estilos nuevos, `email.html` el email y `word/` los tres Word armados de verdad). Donde la maqueta y la spec difieren, manda la spec.

## Global Constraints

- Convenciones del `CLAUDE.md` del repo: ES modules, castellano, `async/await`, consultas parametrizadas con `?`, respuestas `{ success, data?, error?, campo?, message? }`, fechas como texto `'AAAA-MM-DD'`, sin `Date` local en las reglas, ninguna regla pura tira.
- **El repo es público:** solo datos inventados en tests, comentarios, docs y commits. La persona de los tests es la de la maqueta, **Julieta Ferreyra** (planta permanente, admin, 20 días por año, arranque el 02/11/2026; saldo: 19 de la 2024, 15 de la 2025 y 10 de la 2026), con vacaciones del 11/12/2026 al 08/01/2027 (19 días hábiles) y asuetos el jueves 24 y el jueves 31/12/2026, cargados el 22/12/2026. Para la variante B, las mismas vacaciones con 20 de la 2025 y sin saldo de la 2024. Otras personas, también inventadas. Nunca un nombre de la tabla `usuarios` de la base local ni el caso real del usuario.
- Ningún email real (todo a Mailpit); nunca llamar a `/api/cron/*` (se llama a los servicios y a los controladores, con el reloj fijo de `mock.timers`).
- Ruling 19: los textos los arma el servidor; el navegador no recalcula nada. Todo texto del servidor pasa por `esc` en `mi-espacio.js` (también en los `aria-label`); un número va con `String`.
- **Nada frena una carga:** los grupos por restituir y el «Revisá tus días restituidos…» no van en `faltantes` ni en `calculo.faltantes` (`problemaDeLaCarga` no los ve).
- **Los textos exactos** son los de la maqueta (`window.MQ.T`) y la spec (secciones 4, 9, 10 y 12); los que la maqueta no muestra están en las tareas. Los dos formatos de fechas de asuetos: «del 24 y el 31/12/2026» (aviso del Resumen y email) y «del 24/12 y el 31/12/2026» (fila, cálculo, modal B, «Restituidos de la licencia…»); la nota, «de los días jueves 24 y jueves 31 de diciembre de 2026».
- `VERSION_MI_ESPACIO` pasa de `'20261219'` a `'20261220'` y `VERSION_FERIADOS` de `'20261209'` a `'20261210'` (en el HTML y en `tests/paginas.test.js`).
- Las tablas pasan de 43 a 45. La migración es aditiva y repetible, y va **antes** del código. La base local del `.env` (`datospublicos_mcr_rpad`) ya está respaldada por el controlador; la migración se corre ahí en la Task 1 (los tests de schema y permisos la leen). Nunca `docker compose down -v`. `docker` no está en el PATH: `/Applications/Docker.app/Contents/Resources/bin/docker`.
- Un commit por tarea, con la línea final `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Antes de cada commit, `git diff --cached | node <scratchpad>/cruce-nombres.mjs -` (el script lo da el controlador) tiene que dar «0 coincidencias». Después de cada commit, `git push`.
- Los tests de un archivo se corren con `node --test tests/<archivo>.test.js` (los de Docker usan `rpad-db` y `rpad-mailpit`, ya arriba). La suite completa la corre solo el controlador (no corran dos suites a la vez).

## Decisiones del constructor (sección 18 de la spec)

- **Nombres.** Tablas `mi_espacio_restituciones` (los pedidos) y `mi_espacio_restituibles` (la foto). Funciones nuevas en las tareas. La clave de un grupo es `'<licencia_id>-<anio>-<tanda>'` (la API recibe `{ licencia_id, anio, tanda }`); las claves de `mi_espacio_avisos`, `restitucion-<licencia_id>-<anio>-<tanda>-1` y `-2` (entran en `varchar(40)`).
- **Las tandas se sellan al pedir.** La foto guarda `tanda` (NULL mientras ningún pedido la selló). Al crear un pedido sobre una carga, en la misma transacción, las filas abiertas de esa carga pasan a `tanda = n`, con `n` la cantidad de pedidos (activos o no) que ya tenía; la tanda de una fila abierta es esa misma cuenta. Así la tanda no depende de comparar horas, un asueto que llega después de un pedido arma una tanda nueva, y un pedido borrado sigue separando tandas: los plazos nunca se acortan (decisión: un pedido que se deshizo no vuelve a juntar lo que separó).
- **El primer asueto de una tanda** es el más temprano entre los días de esa tanda que hoy siguen restituibles y sin pedido, y el `primer_asueto` guardado de sus pedidos activos (decisión 11: si se pide la 2024, la 2025 conserva el plazo del primer asueto).
- **El día del pedido** se guarda en una columna `fecha` (DATE, `hoyArgentina()` al pedir), no se deduce de `created_at`: es la fecha de la nota B y la habilitación de sus días, y así no depende de la zona horaria de la base.
- **La corrección de un feriado** saca foto solo de sus fechas **nuevas** (las que no tenía antes de corregirlo): renombrarlo no fotografía vacaciones cargadas después. Al sacarle una fecha, una foto sin pedido de esa fecha se borra, salvo que otro feriado activo siga cayendo ese día (entonces pasa a ese feriado).
- **El texto del modal de Feriados lo arma el navegador** (`textoDeAfectadasFeriado`, como hoy) con las cuentas y el plazo del servidor: no hay copia del servidor ni paridad. Los demás textos, en el servidor.
- **Un pedido B se borra con su ruta**; uno A (el de una carga de días restituidos), borrando la carga. `DELETE /mi-espacio/restituciones/:id` de un pedido A da 404.

## Review Focus

1. **Las vacaciones conservan sus días.** Con los asuetos cargados después, la fila, el reparto, el cálculo y la nota en Word de las vacaciones siguen diciendo 19, y no aparece un «Perdés» ni un faltante. Sin foto (el asueto ya estaba), todo se recalcula como hoy. → Task 3.
2. **Solo lo que cambió después.** Un feriado cargado antes de las vacaciones, uno corregido sin cambiar la fecha, «no rige» y la baja no sacan foto. Un día anterior al arranque, de otra licencia o de una carga borrada, tampoco. → Tasks 3, 4 y 9.
3. **Las tandas.** Dos licencias de origen en la misma tanda comparten el plazo aunque se pidan en días distintos; un asueto después de un pedido arma un grupo nuevo con su plazo; borrar un pedido antes del plazo devuelve sus días a «por restituir» con su plazo de siempre. → Task 4.
4. **Nada frena.** Ni un grupo por restituir ni un «Revisá…» frenan una carga ni prenden la marca (la prende «Vence pronto»). → Tasks 4 y 7.
5. **Lo ajeno da 404 y nada sale con nombres.** Las rutas nuevas trabajan sobre `req.user.userId`; el modal de Feriados dice solo cuántas. → Tasks 9, 10 y 11.
6. **El email llega una sola vez por aviso**, nunca a quien ese día está de licencia (le llega al volver), y si los dos avisos de un grupo tocan el mismo día va uno solo. → Task 12.
7. **La recursión:** un asueto que cae en una carga de días restituidos arma un grupo de esa carga, siempre caso A. → Tasks 4 y 5.

---

### Task 1: La estructura (migración, vuelta atrás, schema y base local)

**Files:**
- Create: `database/updates/migracion-mi-espacio-restituciones.sql`, `database/updates/rollback-mi-espacio-restituciones.sql`
- Modify: `database/schema.sql`
- Test: `tests/schema.test.js`

**Interfaces:**
- Produces:
  - `mi_espacio_licencias.tipo` con `'restituidos'` al final del enum (diez valores).
  - `mi_espacio_restituciones`: `id` int AUTO_INCREMENT PK, `usuario_id` int NOT NULL (FK `usuarios` ON DELETE CASCADE), `licencia_id` int NOT NULL (las vacaciones o, en la recursión, la carga de días restituidos; FK `mi_espacio_licencias` ON DELETE CASCADE), `anio` smallint NOT NULL (la licencia de origen), `caso` enum('tomar','restituir') NOT NULL, `dias` smallint NOT NULL, `primer_asueto` date NOT NULL, `tanda` smallint NOT NULL, `fecha` date NOT NULL (el día del pedido), `carga_id` int NULL (en A, la carga `restituidos`; FK `mi_espacio_licencias` ON DELETE SET NULL), `activo` tinyint(1) NOT NULL DEFAULT 1, `created_at` y `updated_at` timestamp como las demás; índices de las FK y `(usuario_id, activo)`.
  - `mi_espacio_restituibles`: `id` int AUTO_INCREMENT PK, `licencia_id` int NOT NULL (FK ON DELETE CASCADE), `feriado_id` int NOT NULL (FK `feriados` ON DELETE CASCADE), `fecha` date NOT NULL, `tanda` smallint NULL, `restitucion_id` int NULL (FK `mi_espacio_restituciones` ON DELETE SET NULL), `created_at` timestamp; clave única `uq_mi_espacio_restituibles_dia (licencia_id, fecha)` (es también el índice de la FK de `licencia_id`).

- [ ] **Step 1: Write the failing tests** en `tests/schema.test.js` (sigan el patrón de `migracion-mi-espacio-horas-mes-anterior.sql` y de `migracion-mi-espacio-evento-publico.sql`): el enum con diez valores en `schema.sql` y en la base del `.env`; las dos tablas con sus columnas, su clave única y sus FK; 45 tablas; la migración dos veces sobre la estructura de main (la del dump de main, como los `describe` de las migraciones anteriores) deja todo una sola vez; la vuelta atrás dos veces: pasa las cargas `'restituidos'` a `'vacaciones'` (probarlo con una fila cargada), borra primero la foto y después los pedidos, y deja el enum con nueve valores; las cabeceras de los dos archivos dicen el orden (la migración **antes** del código, obligatoria; la vuelta atrás después de los archivos anteriores y antes de `rollback-mi-espacio-horas-mes-anterior.sql` si se deshace también esa).
- [ ] **Step 2:** `node --test tests/schema.test.js` → FAIL.
- [ ] **Step 3: Implementar** los dos SQL (cabecera como las de Mi espacio: qué hace, que es aditiva y repetible —`MODIFY` del enum, que se puede repetir, y dos `CREATE TABLE IF NOT EXISTS`, primero los pedidos—, que va antes del código y por qué es obligatoria: `estadosDe` lee las dos tablas, así que sin ellas todo lo de Mi espacio que lee el estado de una persona da 500 y Configuración → Feriados no carga ni corrige un feriado; que el código anterior anda con la estructura nueva; que no carga datos; y la verificación comentada al final: `SHOW TABLES LIKE 'mi_espacio_restitu%'` da 2 filas) y `schema.sql`.
- [ ] **Step 4: Correr la migración en la base local del `.env`** (`datospublicos_mcr_rpad`; el controlador ya la respaldó): `docker exec -i -e MYSQL_PWD=… rpad-db mariadb -uroot datospublicos_mcr_rpad < database/updates/migracion-mi-espacio-restituciones.sql` (la clave de root sale del `.env`, sin imprimirla).
- [ ] **Step 5:** `node --test tests/schema.test.js` → PASS (y los demás tests que cuentan tablas, si alguno falla, se actualizan a 45).
- [ ] **Step 6: Commit** `feat(mi-espacio): las tablas de los días restituidos y el tipo nuevo (migración y vuelta atrás)`.

### Task 2: Los datos que leen las reglas

**Files:**
- Modify: `services/miEspacioDatos.js` (`estadoVacio`, `estadosDe`)
- Test: `tests/mi-espacio-api.test.js` (el `describe` de lo que llega de la base)

**Interfaces:**
- Produces, en cada `Estado`:
  - `restituibles: [{ id, licencia_id, feriado_id, fecha, tanda: number | null, restitucion_id: number | null }]`: las filas de la foto de las cargas de la persona (activas o no), por `licencia_id` y `fecha`.
  - `restituciones: [{ id, licencia_id, anio, caso, dias, primer_asueto, tanda, fecha, carga_id: number | null, activo: 0 | 1, licencia: { tipo, desde, hasta, activo } }]`: **todos** los pedidos de la persona (activos o no: las tandas cuentan los dos), por `licencia_id` e `id`, con la carga de la que salen (aunque esté dada de baja).
  - Los números con `Number()`, las fechas con `DATE_FORMAT`; dos consultas más para todas las personas (sin N+1). Un estado vacío trae las dos listas vacías.

- [ ] **Step 1: Write the failing tests:** con una persona inventada, una carga de vacaciones, dos filas de foto (una con pedido) y dos pedidos (uno dado de baja), `estadoDe` y `estadosDe` traen las dos listas con la forma de arriba (números como números, fechas 'AAAA-MM-DD', `null` donde corresponde), también en lote; un estado sin nada, las dos vacías.
- [ ] **Step 2:** correr → FAIL. **Step 3:** implementar (y el JSDoc del `Estado` en `miEspacioReglas.js` y `miEspacioDatos.js`). **Step 4:** correr → PASS.
- [ ] **Step 5: Commit** `feat(mi-espacio): el estado de cada persona trae la foto y los pedidos de restitución`.

### Task 3: El tipo nuevo, los días de una carga y el reparto

**Files:**
- Modify: `services/miEspacioReglas.js` (constantes ~64-148, `diasQueDescuentan` ~420, `repartoDeVacaciones` ~455, `TIPOS_DE_DIA_ENTERO` ~765, `validarLicencia` ~932, `vistaDe` ~2224, `pasoDeLaCorreccion` ~2490, `pasoPrevistoDe` ~2596), `services/miEspacioResumen.js` (`textoDeLaCantidad` ~614, `tiposDe` ~510, `NOMBRES_DE_LOS_FILTROS`), `services/miEspacioEventosReglas.js` (`FRASE_DE_LA_LICENCIA` ~995), `services/miEspacioNota.js` (`TIPOS_CON_NOTA`: por ahora sin `restituidos`, hasta la Task 8), `controllers/miEspacioController.js` (`autorizadoDelPedido` ~306)
- Test: `tests/mi-espacio-reglas.test.js`, `tests/mi-espacio-resumen.test.js`, `tests/mi-espacio-eventos-reglas.test.js`, `tests/mi-espacio-nota.test.js`

**Interfaces:**
- Produces:
  - `TIPOS_LICENCIA` con `'restituidos'` al final; `TIPOS_POR_MODALIDAD`, en planta y en contrato, con `'restituidos'` justo después de `'vacaciones'`; `NOMBRES_TIPO.restituidos = 'Días restituidos'`; `TIPOS_DE_DIA_ENTERO` suma `'restituidos'` (pasa a Configuración y se ve en «Hoy no están»).
  - `TIPOS_CON_PERSONA_A_CARGO = Object.freeze(['vacaciones', 'restituidos'])` y `dejaPersonaACargo(tipo)`: lo usan `autorizadoDelPedido` (un `autorizado_id` en otro tipo sigue dando `autorizadoSoloVacaciones`, con el mismo texto), `pasoPrevistoDe` (`AVISO_SIN_PERSONA_A_CARGO` y `puede_autorizar`) y `pasoDeLaCorreccion` (`pierdeLaPersona`).
  - `restituiblesDe(fila, estado, feriados) -> string[]`: los días restituibles de una carga (spec, sección 4), por fecha: las filas de `estado.restituibles` con `licencia_id` igual al id de la fila (comparado como número; una fila sin id, ninguno), solo si la fila es `vacaciones` o `restituidos`, con la fecha dentro de `[desde, hasta]`, que hoy no es hábil (`!esDiaHabilCon(fecha, feriados)`) y, en un tipo con saldo inicial, del arranque en adelante (sin arranque, ninguno). Nunca tira.
  - `diasDeLaCarga(fila, estado, feriados) -> string[]`: los días hábiles de la carga (`diasHabilesDe`) más sus restituibles, por fecha y sin repetir. `diasQueDescuentan` pasa a usarla (con el filtro del arranque de siempre).
  - `repartoDeVacaciones` devuelve también `porFecha: Map<id, Map<fecha, anio>>` (la licencia de cada día asignado de cada carga; los sin cubrir no están). La regla del reparto no cambia.
  - `validarLicencia` rechaza `'restituidos'` como hace con `uso_autorizado` fuera de su formulario (`rechazo('tipo', MENSAJES_MI_ESPACIO.tipo)`: se carga solo por su camino, Task 5), y su paso 3 (ningún día hábil) cuenta `diasDeLaCarga({ id: editadaId, tipo, desde, hasta }, …)`.
  - `vistaDe` (`dias_habiles` y `texto_dias`) y `textoDeLaCantidad` de la lista cuentan `diasDeLaCarga` en lugar de `diasHabilesDe`.
  - `tiposDe` (las opciones de «Cargar licencia») deja afuera `'restituidos'` (sus opciones, una por grupo, llegan en la Task 7); `NOMBRES_DE_LOS_FILTROS.restituidos` es «Días restituidos» (sale de `NOMBRES_TIPO`).
  - `FRASE_DE_LA_LICENCIA.restituidos = 'tus días restituidos'`.
- Consumes: `estado.restituibles` (Task 2).

- [ ] **Step 1: Write the failing tests** (con Julieta Ferreyra y `const ASUETOS = new Set(['2026-12-24', '2026-12-31'])`, hoy el 11/01/2027):
  - Las constantes nuevas (los arrays congelados y en su orden; `TIPOS_CON_PERSONA_A_CARGO`), los tests de antes que comparan `TIPOS_LICENCIA` y `TIPOS_POR_MODALIDAD` con el valor nuevo, `FRASE_DE_LA_LICENCIA` con las claves de `TIPOS_LICENCIA`.
  - `restituiblesDe`: con la foto del 24 y del 31/12 → los dos; un día que volvió a ser hábil (sin el asueto en el Set) no; fuera de las fechas (vacaciones acortadas al 23/12) no; anterior al arranque no; de otra carga no; otro tipo (una atención médica con foto) no; una fila sin id no; lo que no es un estado, [].
  - **Review Focus 1:** sin los asuetos, la carga tiene 19 días; con los asuetos y sin foto, 17 (como hoy); con los asuetos y la foto, `diasQueDescuentan` da 19, el reparto la cubre con 19 de la 2024, `porFecha` dice 2024 para el 24 y el 31/12, `calcular` no da ningún faltante y `textoDePerdidos` da '' (con hoy el 22/12/2026, antes del vencimiento), y la fila de la lista dice «19 días hábiles de 29 corridos».
  - `validarLicencia` con `tipo: 'restituidos'` → error en `tipo`; una corrección de unas vacaciones de un día que hoy es restituible no da «sin días hábiles».
  - `pasoPrevistoDe` con una fila `restituidos` del titular: sin `AVISO_SIN_PERSONA_A_CARGO` y con `puede_autorizar: true`; `pasoDeLaCorreccion` de vacaciones a vacaciones no pierde la persona.
  - `tiposDe` del Resumen no ofrece `'restituidos'`.
- [ ] **Step 2:** correr los cuatro archivos → FAIL.
- [ ] **Step 3:** implementar. Actualizar los JSDoc (`Estado`, `diasQueDescuentan`, el reparto) y el comentario de cabecera de `miEspacioReglas.js` con una línea de los días restituidos.
- [ ] **Step 4:** correr → PASS; correr también `tests/mi-espacio-api.test.js` (el controlador cambió) y `tests/mi-espacio-frontend.test.js` (las paridades de los tipos de un día y de horas no cambian).
- [ ] **Step 5: Commit** `feat(mi-espacio): el tipo «Días restituidos» y los días restituibles cuentan en su carga`.

### Task 4: El plazo, el caso, los grupos y las tandas

**Files:**
- Modify: `services/miEspacioReglas.js` (nuevas al lado del reparto; `ordinariasDe` ~387; `calcular` ~1728)
- Test: `tests/mi-espacio-reglas.test.js` (un `describe('los días restituidos')`)

**Interfaces:**
- Produces:
  - `PLAZO_DE_RESTITUCION_EN_MESES = 4`; `plazoDeRestitucion(primerAsueto, feriados) -> string | null`: `ultimoDiaHabilDelMesCon(mesMas(mes del asueto, 4), feriados)`.
  - `casoDeRestitucion(anio, plazo) -> 'tomar' | 'restituir' | null`: `'tomar'` si `venceLaLicencia(anio) < plazo`.
  - `restitucionesDe(estado, { hoy, feriados, reparto }) -> Grupo[]` (`reparto`: el de `calcular`; sin él, se calcula). `Grupo = { clave, licencia_id, anio, tanda, caso, dias, fechas, primer_asueto, plazo, situacion, restitucion_id, carga_id, fecha_pedido, revisar, carga: { tipo, desde, hasta } }`:
    - **Por restituir o perdida:** las filas de la foto sin pedido activo (`restitucion_id` null o de un pedido dado de baja) de una carga activa del estado que hoy son restituibles (`restituiblesDe`). La licencia de origen: en unas vacaciones, la de `reparto.porFecha` (un día sin cubrir no forma grupo); en una carga `restituidos`, el `anio` de su pedido activo (`carga_id`). La tanda: la de la fila o, abierta, la cantidad de pedidos (activos o no) de esa carga. Se agrupan por (carga, anio, tanda). `primer_asueto`: el más temprano de la tanda (sus filas por restituir de cualquier licencia de origen y el `primer_asueto` de sus pedidos activos). `caso`: en una carga `restituidos`, siempre `'tomar'`; si no, `casoDeRestitucion`. `situacion`: `'por_restituir'` hasta el plazo inclusive; después, `'perdida'`. `restitucion_id`, `carga_id` y `fecha_pedido` null; `revisar` ''.
    - **Pedida o cargada:** cada pedido activo: `'pedida'` (caso `restituir`) o `'cargada'` (caso `tomar`, con `carga_id`); `fechas`, las de sus filas; `dias` y `primer_asueto`, los guardados; `plazo`, recalculado con los feriados de hoy; `fecha_pedido`, la suya; `revisar`: el texto del primer problema que tenga, en este orden, o '': la carga de la que sale ya no está activa («Revisá tus días restituidos: las vacaciones del 11/12/2026 al 08/01/2027 ya no están cargadas.»; de una carga `restituidos`, «… los días restituidos del 12/04 al 13/04/2027 ya no están cargados.»), alguna fecha quedó fuera de sus fechas («Revisá tus días restituidos: tus vacaciones ya no incluyen el 31/12/2026.»; «tus días restituidos ya no incluyen …») o volvió a ser hábil («Revisá tus días restituidos: el asueto del 24/12/2026 se dio de baja.»; con varias, «los asuetos del 24/12 y el 31/12/2026 se dieron de baja.»). Las fechas, con el formato «del 24/12 y el 31/12/2026» (`fechasDeLosAsuetos(fechas, { conMes: true })`, que se exporta: con una sola, «24/12/2026»).
    - Por `carga.desde`, después por la carga, el primer asueto y el año. `clave = '<licencia_id>-<anio>-<tanda>'`.
  - `fechasDeLosAsuetos(fechas, { conMes }) -> string`: sin `conMes`, los días del mismo mes y año como «24» y el último de cada mes con «/MM/AAAA» («24 y el 31/12/2026»; «24, el 26, el 31/12/2025 y el 02/01/2026»); con `conMes`, cada día como «DD/MM» y el último de cada año con el año («24/12 y el 31/12/2026»). Una sola: «24/12/2026». Unidas con «, el» y « y el».
  - `ordinariasDe` suma, por cada pedido activo con caso `restituir`, una mitad `{ dias, habilita: fecha del pedido }` a la licencia de su `anio` (y a su `total`). Lo demás no cambia: `porHabilitarDe` y `alcanceDeLaCarga` no se tocan (la mitad ya está habilitada).
  - `calcular` suma `restituciones: restitucionesDe(deLaModalidad, { hoy, feriados, reparto })` (sin hoy, []). `faltantesDe` no cambia.
- Consumes: `restituiblesDe`, `reparto.porFecha` (Task 3); `estado.restituibles` y `estado.restituciones` (Task 2).

- [ ] **Step 1: Write the failing tests:**
  - `plazoDeRestitucion`: 24/12/2026 → '2027-04-30'; 24/12/2025 → '2026-04-29' con el 30/04/2026 en el Set (el feriado provincial: usen la fila de `tests/fixtures/feriados-precarga.js`); 12/03/2027 → '2027-07-30'; 31/10/2027 → '2028-02-29'; un feriado nuevo en el último día lo corre; lo que no es una fecha, null.
  - `casoDeRestitucion`: 2024 con 30/04/2027 → 'tomar'; 2025 con 30/04/2027 → 'restituir'; 2025 con 29/02/2028 (asueto del 15/10/2027) → 'tomar'; el borde (vence el mismo día que el plazo) → 'restituir'.
  - `restitucionesDe`, con Julieta: un grupo por restituir A (2 días de la 2024, plazo 30/04/2027, primer asueto 24/12/2026, tanda 0, `clave` `'<id>-2024-0'`); el 03/05/2027, `'perdida'`; la variante B → `'restituir'`; **dos licencias** (15 de la 2024 y 4 de la 2025: un asueto cae en cada una) → dos grupos con el mismo plazo; con un pedido B de la 2025 ya hecho (fila sellada, pedido activo), el grupo de la 2024 conserva el plazo; **otro asueto después de pedir** (fila abierta con un pedido) → un grupo nuevo, tanda 1, con su plazo; **borrar el pedido** (dado de baja, filas sin `restitucion_id` y selladas) → vuelve a `'por_restituir'` con su plazo de antes; **los cambios sin pedir:** acortar las vacaciones, borrarlas, la baja del asueto y «no rige» (el día ya no está en el Set) sacan el día; **con pedido:** los tres «Revisá…»; **la recursión** (foto sobre una carga `restituidos` con su pedido `tomar`) → caso A con el año de ese pedido; un día de la foto sin cubrir en el reparto no forma grupo.
  - La mitad B: con un pedido B de 2 días de la 2025 del 01/04/2027, `ordinariasDe` suma la mitad, y en el reparto «Te quedan» pasa de 21 a 23 (disponibles de la 2025 de 1 a 3); las vacaciones originales siguen con sus 19 días.
  - **Review Focus 4:** con un grupo por restituir, `calcular(...).faltantes` es [] y `problemaDeLaCarga` no frena una carga nueva.
- [ ] **Step 2:** correr → FAIL. **Step 3:** implementar (con JSDoc). **Step 4:** correr → PASS (y los tests de `calcular` de antes: la clave nueva en el objeto, si algún test compara el `Calculo` entero, se suma ahí).
- [ ] **Step 5: Commit** `feat(mi-espacio): el plazo, el caso y los grupos de los días por restituir, con sus tandas`.

### Task 5: La carga de los días restituidos (caso A), en las reglas

**Files:**
- Modify: `services/miEspacioReglas.js` (`MENSAJES_MI_ESPACIO`, nuevas al lado de `validarLicencia`, `evaluarLaCarga` ~2025, `vistaDe`, `evaluarLicencia` ~2276)
- Test: `tests/mi-espacio-reglas.test.js`

**Interfaces:**
- Produces:
  - Mensajes: `restituidosFijo: 'Los días restituidos no cambian de tipo.'`, `restitucionInvalida: 'Elegí qué días restituidos querés cargar.'`, `grupoNoPorRestituir: 'Esos días ya no están para restituir.'`, `grupoEsParaRestituir: 'Esos días no se toman: pedí la restitución.'`, `grupoEsParaTomar: 'Esos días se toman: cargalos como «Días restituidos».'`, `restitucionNoEncontrada: 'Restitución no encontrada'`, `restitucionVencida: 'Ya pasó el plazo: la restitución no se puede borrar.'`; y `textoDesdeDeLosRestituidos(primero, plazo)` → «Elegí un día del 11/01/2027 al 30/04/2027.».
  - `hastaDeLosRestituidos(desde, dias, feriados, restituibles = []) -> string | null`: el día número `dias` contando desde `desde` (incluido) los días hábiles y los de `restituibles` (los de la carga que se corrige: así una carga que no cambia «Desde» conserva su «Hasta»); a lo sumo 366 vueltas; si no, o con una entrada que no sirve, null.
  - `primerDiaDeLosRestituidos(grupo, feriados)`: el primer día hábil después del fin de su carga (`proximoDiaHabilCon(sumarDias(carga.hasta, 1), feriados)`).
  - `validarRestituidos(entrada, { hoy, estado, feriados, editadaId, grupos }) -> { datos, error }` (`grupos`, los de `restitucionesDe`): en el alta, `entrada.restitucion` (`{ licencia_id, anio, tanda }`) tiene que ser un grupo `'por_restituir'` de caso `'tomar'` (si no es un objeto con los tres enteros, `restitucionInvalida`; si no está o no está por restituir, `grupoNoPorRestituir`; si es de caso B, `grupoEsParaRestituir`; los tres en `tipo`); en una corrección, el grupo `'cargada'` con `carga_id` igual a `editadaId`. Después, en este orden: «Desde» es una fecha del rango (`fecha`/`textoRango`, en `desde`), posterior al fin de su carga y a lo sumo el plazo (`textoDesdeDeLosRestituidos`, en `desde`); el «Hasta»: en una corrección que no cambia «Desde», el guardado; si no, `hastaDeLosRestituidos` con sus `dias` (null o fuera del rango, en `desde`); la nota (`nota`); que no se superponga con otra licencia (`textoSuperpuesta`, en `desde`). `datos = { tipo: 'restituidos', desde, hasta, horas: null, mostrar, nota, restitucion: { licencia_id, anio, tanda } }`.
  - `evaluarLicencia` (y `evaluarLaCarga`, que pasa a recibir el validador): una corrección de una carga `restituidos` con otro tipo, o de otra carga con `'restituidos'`, da `restituidosFijo` en `tipo`; con `tipo: 'restituidos'` (o la corrección de una), la modalidad y el arranque, después `validarRestituidos` con los grupos de `calcular`, y lo demás como siempre (`problemaDeLaCarga`, los avisos de la carga). Su `vista`: `{ dias_habiles: dias, texto_dias: textoDeLosDiasHabiles(dias, corridos), texto_reparto: textoDelCalculoDeRestituidos(grupo), queda_texto: '', antes_del_arranque: false, texto_antes_del_arranque: '', avisos, hasta }` (`hasta` solo en esta vista).
  - Textos: `textoDelCalculoDeRestituidos(grupo)` → «Son los días restituidos de la licencia 2024, por los asuetos del 24/12 y el 31/12/2026.» (uno: «Es el día restituido de la licencia 2024, por el asueto del 24/12/2026.»); `textoDeLaAyudaDeRestituidos(grupo, feriados)` → «Los 2 días van juntos: elegí desde cuándo y Mi espacio pone el «Hasta». Podés empezar del 11/01/2027 al viernes 30/04/2027.» (uno: «Es 1 día: elegí cuándo y Mi espacio pone el «Hasta». Podés tomarlo del 11/01/2027 al viernes 30/04/2027.»); `textoDelHastaDeRestituidos(dias)` → «Lo pone Mi espacio: 2 días hábiles.» («1 día hábil»).
- Consumes: `restitucionesDe` (Task 4), `diasDeLaCarga` (Task 3).

- [ ] **Step 1: Write the failing tests:** `hastaDeLosRestituidos` (desde un lunes, 2 → el martes; desde un sábado; cruzando un feriado; con `restituibles`; null); `validarRestituidos` en sus bordes (el día después de las vacaciones y el plazo entran; el fin de las vacaciones y el día después del plazo no; un grupo perdido; uno B; una restitución que no es un objeto; la superposición; la corrección que no cambia «Desde» conserva el «Hasta»; la que lo cambia lo recalcula); `evaluarLicencia` del alta (la vista exacta de la maqueta: «2 días hábiles», el texto del cálculo y `hasta: '2027-04-13'` desde el 12/04/2027) y de la corrección; los dos `restituidosFijo`; los textos en singular.
- [ ] **Step 2:** correr → FAIL. **Step 3:** implementar. **Step 4:** correr → PASS.
- [ ] **Step 5: Commit** `feat(mi-espacio): la carga de los días restituidos, con su «Hasta» y su validación (reglas)`.

### Task 6: Los textos de los avisos y el email de vencimiento

**Files:**
- Modify: `services/miEspacioReglas.js` (los textos, al lado de los del reparto; `avisosDeVencimiento` ~2780)
- Test: `tests/mi-espacio-reglas.test.js`

**Interfaces:**
- Produces (texto plano; `hoy` donde la variante depende del día):
  - `textoDelAvisoDeRestitucion(grupo, hoy)` (el aviso del Resumen). A: «Los asuetos del 24 y el 31/12/2026 cayeron en tus vacaciones: tenés 2 días restituidos de la licencia 2024. Como esa licencia ya venció, tomalos todos juntos, empezando a más tardar el viernes 30/04/2027, con la nota al Director General. Si no, se pierden.»; hasta el vencimiento de la licencia, «Como esa licencia vence el 31/12/2026, antes del plazo, tomalos todos juntos, …» (decisión 3 de la sección 17). B: «Los asuetos del 24 y el 31/12/2026 cayeron en tus vacaciones: podés pedir que te restituyan 2 días a tu licencia 2025. Pedilo con la nota al Director General a más tardar el viernes 30/04/2027. Si no, se pierden.». Un día: «El asueto del 24/12/2026 cayó en tus vacaciones: tenés 1 día restituido de la licencia 2024. Como esa licencia ya venció, tomalo a más tardar el viernes 30/04/2027, con la nota al Director General. Si no, se pierde.» y «… podés pedir que te restituyan 1 día a tu licencia 2025. … Si no, se pierde.». En la recursión, «cayeron en tus días restituidos».
  - `textoDelBotonDeRestitucion(grupo)`: «Cargar los días restituidos» («Cargar el día restituido») o «Pedir la restitución».
  - `textoDeLaFilaDeRestitucion(grupo, cargada)` (`cargada`: la carga A, para sus fechas): por restituir A «2 días por restituir (asuetos del 24/12 y el 31/12/2026): empezá a tomarlos a más tardar el 30/04/2027.» (uno: «1 día por restituir (asueto del 24/12/2026): tomalo a más tardar el 30/04/2027.»); por restituir B «2 días por restituir a la licencia 2025 (asuetos del 24/12 y el 31/12/2026): pedí la restitución a más tardar el 30/04/2027.»; cargada «Los 2 días restituidos están cargados del 12/04 al 13/04/2027.» (uno: «El día restituido está cargado el 12/04/2027.»); pedida «Restitución pedida el 01/04/2027: los 2 días volvieron a la licencia 2025.» (uno: «… el día volvió a la licencia 2025.»); perdida «2 días por restituir: se perdieron el 30/04/2027.» (uno: «1 día por restituir: se perdió el 30/04/2027.»).
  - `bajadaDeRestituciones(grupos, hoy) -> [{ texto, vence }]`: los grupos por restituir, juntos por caso y plazo, una oración cada uno, con `vence` en los últimos 30 días corridos antes del plazo (`diasEntre(hoy, plazo) <= 30`): A «Además, 2 restituidos de la 2024: empezá a tomarlos a más tardar el viernes 30/04.» (varias licencias: «Además, 2 restituidos de la 2024 y 1 de la 2025: empezá a tomarlos a más tardar el viernes 30/04.»; uno: «Además, 1 restituido de la 2024: tomalo a más tardar el viernes 30/04.»); B «Además, 2 por restituir: pedí la restitución antes del viernes 30/04.».
  - `tituloDeRestitucionQueVence(grupo)` («Vence pronto»): «2 días restituidos de la 2024» o «2 días para restituir a la 2025» (uno: «1 día restituido de la 2024», «1 día para restituir a la 2025»).
  - `partesDelEmailDeRestitucion(grupo, hoy) -> string[][]`-like: los tres párrafos del email de la maqueta (`email.html`), con lo que va en negrita marcado como `{ negrita }`: A «Los asuetos del 24 y el 31/12/2026 cayeron en tus vacaciones del 11/12/2026 al 08/01/2027: tenés **2 días restituidos de la licencia 2024**.», «Como esa licencia ya venció, tomalos todos juntos, empezando a más tardar el **viernes 30/04/2027**, con la nota al Director General. Si no, se pierden.» y «En Mi espacio podés cargarlos y bajar la nota en Word.»; B «… podés pedir que te restituyan **2 días a tu licencia 2025**.», «Pedilo con la nota al Director General a más tardar el **viernes 30/04/2027**. Si no, se pierden.» y «En Mi espacio podés pedirla y bajar la nota en Word.».
  - `recuadroDeLaRestitucion(grupo) -> { resaltado, resto }` (el modal B): «**2 días hábiles vuelven a tu licencia 2025** (vence el 31/12/2027), por los asuetos del 24/12 y el 31/12/2026. Al pedirla se arma la nota al Director General y los días vuelven enseguida.» (uno: «1 día hábil vuelve …» y «… y el día vuelve enseguida.»).
  - `mensajeDeLaRestitucionPedida(grupo)`: «Restitución pedida: los 2 días volvieron a tu licencia 2025.»; `MENSAJE_RESTITUCION_BORRADA = 'Pedido de restitución borrado: los días vuelven a estar por restituir.'`.
  - `avisosDeVencimiento` suma, por cada grupo por restituir de `calculo.restituciones`, `{ clave: 'restitucion-<licencia>-<anio>-<tanda>-1', texto, restitucion: { grupo: clave, partes, primero: true } }` desde que aparece hasta el plazo, y `…-2` (`primero: false`) desde 5 días hábiles antes del plazo (`restarDiasHabilesCon`) hasta el plazo. `texto` es el de las partes, sin negritas. Van después de lo de antes, por plazo.
- Consumes: `Grupo` (Task 4), `fechasDeLosAsuetos`.

- [ ] **Step 1: Write the failing tests** con cada texto exacto (los de la maqueta, comparados con `window.MQ.T`: cópienlos en el test, sin importar la maqueta), en singular, las dos variantes del aviso A (el 22/12/2026 y el 11/01/2027), la recursión, la bajada en ámbar desde el 31/03/2027 y no el 30/03, la bajada de dos licencias; `avisosDeVencimiento` el 11/01/2027 (solo `-1`), el 23/04/2027 (las dos, si ninguna se mandó) y el 01/05/2027 (ninguna), sin grupos pedidos ni perdidos; las claves entran en 40 caracteres.
- [ ] **Step 2:** correr → FAIL. **Step 3:** implementar. **Step 4:** correr → PASS.
- [ ] **Step 5: Commit** `feat(mi-espacio): los textos de los días restituidos y sus avisos de vencimiento (reglas)`.

### Task 7: El Resumen y la lista de Licencias

**Files:**
- Modify: `services/miEspacioResumen.js` (`resumenDe` ~535, `bajadaDe` ~307 y `titularDe`, `venceProntoDe` ~139, `tiposDe` ~510, `paraRevisarDe` ~763, `filaDeLicencia` ~648, `filasDeLicencias`), y una exportada nueva para el segundo paso B
- Test: `tests/mi-espacio-resumen.test.js`

**Interfaces:**
- Produces:
  - `resumenDe` suma `restituciones: [{ clave, texto, accion: { texto, tipo: 'restituidos' | 'restitucion', grupo: clave, restitucion: { licencia_id, anio, tanda } } }]`, una por grupo por restituir (`textoDelAvisoDeRestitucion` y `textoDelBotonDeRestitucion`); sin modalidad o sin arranque, [].
  - `para_revisar` suma, después de los de Configuración, cada grupo pedido con `revisar`: `{ licencia_id, anio, texto, enlace }` (el año y el link, los de las fechas de su carga, como los demás).
  - La bajada de `titular` suma al final `bajadaDeRestituciones` (después de «Perdés …»).
  - `vence_pronto` suma, por grupo por restituir en sus últimos 30 días corridos, `cosaQueVence({ fecha: plazo, cantidad: dias, titulo: tituloDeRestitucionQueVence(grupo), accion })`, con la misma `accion` del aviso. Prenden la marca, como todo «Vence pronto».
  - `tipos` (las opciones de «Cargar licencia»): justo después de `vacaciones`, una por grupo por restituir A: `{ tipo: 'restituidos', grupo: clave, restitucion, nombre: 'Días restituidos', queda_texto: '2 de la 2024 · empezar hasta el 30/04', dias, ayuda_desde: textoDeLaAyudaDeRestituidos(...), ayuda_hasta: textoDelHastaDeRestituidos(dias) }`.
  - Cada fila de `vacaciones` o `restituidos` de la lista suma `restituciones: [{ texto, aviso, accion, restitucion_id, puede_borrar }]` (las de `calculo.restituciones` de esa carga): por restituir, `aviso: true` y su `accion`; pedida, `restitucion_id` y `puede_borrar` (hasta el plazo); cargada y perdida, solo el texto. La fila `restituidos` dice en `de_licencias_texto` «Restituidos de la licencia 2024 por los asuetos del 24/12 y el 31/12/2026.» (uno: «Restituido de la licencia 2024 por el asueto del 24/12/2026.») y suma `restituidos: { ayuda_desde, ayuda_hasta, dias }` (para corregirla).
  - `textoDeLaRestitucionHecha(grupo, calculo, hoy)` (exportada): «Los 2 días volvieron a tu licencia 2025: te quedan 23 días de vacaciones.» (el número es el de la frase del Resumen; uno: «El día volvió …»; «te queda 1 día»; con 0, «no te quedan días de vacaciones»).
- Consumes: Tasks 4–6.

- [ ] **Step 1: Write the failing tests** con Julieta en los momentos de la maqueta: el 11/01/2027 (el aviso con el texto «ya venció», la bajada sin ámbar, sin «Vence pronto», sin marca por esto, «Te quedan 35»); el 01/04/2027 («Vence pronto» con «Vencen el viernes 30/04, en 29 días.» y su acción, la bajada en ámbar, la marca); después de cargarlos (sin aviso, la fila de las vacaciones con «Los 2 días restituidos están cargados del 12/04 al 13/04/2027.», la fila `restituidos` con su texto y el filtro «Días restituidos»); el 03/05/2027 sin cargarlos (la línea en gris y sin aviso); la variante B y después del pedido (la línea, `restitucion_id`, `puede_borrar`, «Te quedan 23» y `textoDeLaRestitucionHecha`); el «Revisá…» en `para_revisar`; la opción del tipo; un Resumen de antes (sin `restituciones` en el cálculo) sale igual que hoy.
- [ ] **Step 2:** correr → FAIL. **Step 3:** implementar. **Step 4:** correr → PASS.
- [ ] **Step 5: Commit** `feat(mi-espacio): el Resumen y la lista dicen los días por restituir`.

### Task 8: Las notas en Word

**Files:**
- Modify: `services/miEspacioNota.js`
- Test: `tests/mi-espacio-nota.test.js`, `tests/mi-espacio-nota-word.test.js`

**Interfaces:**
- Produces:
  - `TIPOS_CON_NOTA` incluye `'restituidos'`; `NOMBRES_DEL_ARCHIVO.restituidos = 'Días restituidos'` («Nota de licencia - Días restituidos - 2027-04-12.docx»).
  - `textoDeLosAsuetos(fechas) -> string` (exportada): «de los días jueves 24 y jueves 31 de diciembre de 2026»; varios meses o años: «de los días miércoles 24, viernes 26 y miércoles 31 de diciembre de 2025 y viernes 2 de enero de 2026»; uno: «del día jueves 24 de diciembre de 2026».
  - `notaDeLicencia(licencia, { fecha, persona, feriados, salidas, restituibles, restitucion })`: `restituibles` (los de `restituiblesDe` para esa licencia) suma esos días a los de vacaciones y de `restituidos`; el cuerpo de `restituidos` usa `restitucion = { anio, fechas }`: «el usufructo de dos (2) días hábiles de mi licencia anual ordinaria 2024, restituidos por los asuetos de los días jueves 24 y jueves 31 de diciembre de 2026, declarados durante mis vacaciones, a partir del día lunes 12 de abril de 2027.» (uno: «el usufructo de un (1) día hábil de mi licencia anual ordinaria 2024, restituido por el asueto del día jueves 24 de diciembre de 2026, declarado durante mis vacaciones, el día lunes 12 de abril de 2027.»). Sin `restitucion`, `{ error: 'error' }`.
  - `notaDeRestitucion(pedido, { fecha, persona })` (`pedido = { anio, dias, fechas }`): la misma estructura que `notaDeLicencia` (así `htmlDeLaNota` y `renderNotaDocx` no cambian), con el cuerpo «la restitución a mi licencia anual ordinaria 2025 de dos (2) días hábiles, correspondientes a los asuetos de los días jueves 24 y jueves 31 de diciembre de 2026, declarados durante mis vacaciones.» (uno: «… de un (1) día hábil, correspondiente al asueto del día …, declarado durante mis vacaciones.») y el nombre «Nota de restitución - Licencia 2025 - 2027-04-01.docx» (con la fecha del pedido). Nunca tira.
  - `aclaracionDeLaRestitucion(fecha)`: «Lleva la fecha del 01/04/2027, el día en que pediste la restitución. Se baja en Word, para imprimir y firmar.».

- [ ] **Step 1: Write the failing tests:** los dos cuerpos al pie de la letra (los de la spec, sección 12, y la hoja de `MQ.MODAL_A.segundo` y `MQ.MODAL_B.cuerpo`), el singular, `textoDeLosAsuetos` (un mes, dos meses, dos años, un día), las vacaciones con `restituibles` siguen con «diecinueve (19)», los nombres de los archivos, `TIPOS_CON_NOTA` con nueve tipos; el Word igual a la vista para A y B (`mi-espacio-nota-word.test.js`, el patrón de siempre).
- [ ] **Step 2:** correr → FAIL. **Step 3:** implementar. **Step 4:** correr → PASS.
- [ ] **Step 5: Commit** `feat(mi-espacio): las notas en Word de los días restituidos y de la restitución`.

### Task 9: La foto en Configuración → Feriados

**Files:**
- Modify: `services/feriadosReglas.js` (nueva `fotosDelFeriado`), `services/miEspacioDatos.js` (`cargasParaLaFoto`, `vacacionesParaRestituir`), `controllers/feriadosController.js` (`afectadasPorFeriado`, `licenciasAfectadasDe`, `crearFeriado`, `corregirFeriado`, `cambiarRige`)
- Create: `services/miEspacioRestituciones.js` (las escrituras de la foto y de los pedidos, siempre con la conexión de una transacción ajena)
- Test: `tests/feriados-reglas.test.js`, `tests/feriados-api.test.js`

**Interfaces:**
- Produces:
  - `fotosDelFeriado(fila, cargas, otrasFilas, { antes = null } = {}) -> [{ licencia_id, fecha }]` (pura): las fechas en que el feriado deja de hacer hábil un día (`fechasQueCambianDiasHabiles(fila, desdeAnio, hastaAnio, otrasFilas)`, con los años de las cargas), sin las que ya tenía antes de corregirlo (`fechasDelFeriado(antes, …)`), por cada carga (`{ id, tipo, desde, hasta, arranque }`) `vacaciones` o `restituidos` que la incluye y, en unas vacaciones, del arranque en adelante (sin arranque, ninguna). Por fecha y carga.
  - `cargasParaLaFoto(conexion, desde, hasta)`: las cargas activas `vacaciones` o `restituidos` de cualquier persona que tocan el rango, con el arranque de su persona; `vacacionesParaRestituir(fila, { excluir, antes }, conexion) -> { vacaciones, plazo }`: cuántas cargas tendrían foto y el plazo desde la primera de esas fechas (`plazoDeRestitucion`, con los feriados de la tabla y el del modal), o `{ vacaciones: 0, plazo: null }`.
  - En `services/miEspacioRestituciones.js`: `sacarLaFoto(conexion, feriadoId, fotos)` (`INSERT IGNORE`), `acomodarLaFotoDelFeriado(conexion, feriado, filas)` (las fotos sin pedido de ese feriado cuya fecha ya no es suya: pasan a otro feriado activo de ese día, si hay, y si no se borran), `registrarPedido(conexion, { usuarioId, grupo, caso, cargaId, hoy })` (sella las filas abiertas de la carga con la cantidad de pedidos que tenía, inserta el pedido con la tanda, el primer asueto, los días y `fecha = hoy`, y enlaza las filas del grupo; devuelve el id) y `soltarPedido(conexion, pedidoId)` (lo da de baja y deja sus filas sin `restitucion_id`, con su tanda).
  - `crearFeriado` pasa a una transacción (`enTransaccion`): el `INSERT`, las filas de los feriados con esa conexión, las cargas y `sacarLaFoto`. `corregirFeriado`, después del `UPDATE`, con `antes` = la fila leída con `FOR UPDATE`: `sacarLaFoto` de las fechas nuevas y `acomodarLaFotoDelFeriado`. `cambiarRige` con `pasa_al`, si carga un día nuevo, su foto (el existente no). «No rige» y la baja no tocan la foto.
  - `GET /feriados/afectadas`, `POST /feriados` y `PUT /feriados/:id` suman `vacaciones_para_restituir` y `plazo_de_restitucion` al lado de `licencias_afectadas` (con `antes`: en el GET, la fila guardada; en el PUT, la de antes de corregir; aislados como hoy: si fallan, null).
- Consumes: `plazoDeRestitucion` (Task 4).

- [ ] **Step 1: Write the failing tests:**
  - `fotosDelFeriado`: el 24/12/2026 con las vacaciones de Julieta → su carga; un sábado, uno de los 9 fijos u otro feriado activo ese día → nada; antes del arranque → nada; una carga `restituidos` → sí; otro tipo → no; con `antes` de la misma fecha → nada; uno que se repite, en cada año dentro de las cargas.
  - API (Docker): cargar el asueto saca la foto en la misma transacción (si algo falla después del `INSERT`, no queda ni el feriado ni la foto: fuércenlo como los tests de transacciones de Proyectos o de Feriados); corregirlo a otra fecha mueve la foto (la vieja se borra, salvo pedida o con otro feriado ese día); renombrarlo no saca foto nueva (**Review Focus 2**); «Se pasó al» saca la del día nuevo; «no rige» y la baja no tocan nada; `GET /feriados/afectadas` con una vacación y con dos licencias (una de vacaciones) → las cuentas y el plazo, sin nombres en la respuesta; los permisos de siempre.
- [ ] **Step 2:** correr → FAIL. **Step 3:** implementar. **Step 4:** correr → PASS (y `tests/feriados-en-notas.test.js` y `tests/feriados-en-metricas.test.js`, que cargan feriados).
- [ ] **Step 5: Commit** `feat(feriados): un asueto sobre unas vacaciones ya cargadas saca la foto de los días por restituir`.

### Task 10: La API de Mi espacio: la carga de los días restituidos

**Files:**
- Modify: `controllers/miEspacioController.js` (`calcularLicencia`, `cargarLicenciaMia`, `corregirLicenciaMia`, `borrarLicenciaMia`, `leerLaNota`)
- Test: `tests/mi-espacio-api.test.js` (un `describe('los días restituidos')`)

**Interfaces:**
- Produces:
  - `POST /mi-espacio/licencias/calculo` y `POST /mi-espacio/licencias` con `{ tipo: 'restituidos', restitucion: { licencia_id, anio, tanda }, desde, mostrar, nota, autorizado_id? }`: el «Hasta» lo pone el servidor; el alta, en su transacción de siempre, crea la carga, pasa a Configuración (`aplicarCarga`, con la persona a cargo del titular) y `registrarPedido(caso 'tomar', cargaId)`. Los 400 con su campo (Task 5).
  - `PUT /mi-espacio/licencias/:id` de una carga `restituidos`: «Desde» (el «Hasta» se recalcula), la nota y «Mostrar», con el paso a Configuración de siempre. `DELETE`: la da de baja (con `aplicarBaja`) y `soltarPedido` de su pedido, en la misma transacción.
  - `leerLaNota` pasa `restituibles` (de `restituiblesDe`) y, en una carga `restituidos`, `restitucion: { anio, fechas }` (de su grupo cargado): la nota A sale por `GET …/licencias/:id/nota` y `…/word`.
- Consumes: Tasks 3–9.

- [ ] **Step 1: Write the failing tests** (Docker, con Julieta y los asuetos cargados por `POST /feriados` como admin, con el reloj fijo donde haga falta): el cálculo y el alta desde el 12/04/2027 → «Hasta» 13/04, el pedido `tomar` y la foto enlazada, la carga en Configuración con la insignia; los 400 (grupo B, perdido, «Desde» antes o después, superpuesta, restitución que no es un objeto); el PUT que mueve «Desde»; el DELETE antes del plazo (el grupo vuelve) y después (perdido); un `restituidosFijo` en cada dirección; la nota A y su Word; las vacaciones originales siguen con 19 días en su nota; lo ajeno da 404; un titular con persona a cargo.
- [ ] **Step 2:** correr → FAIL. **Step 3:** implementar. **Step 4:** correr → PASS.
- [ ] **Step 5: Commit** `feat(mi-espacio): cargar, corregir y borrar los días restituidos (API)`.

### Task 11: La API de Mi espacio: el pedido de restitución

**Files:**
- Modify: `controllers/miEspacioController.js` (cuatro rutas nuevas), `routes/index.js`
- Test: `tests/mi-espacio-api.test.js`, `tests/permisos.test.js`

**Interfaces:**
- Produces (todas con `authMiddleware`, sobre `req.user.userId`; lo ajeno, inexistente o dado de baja, `restitucionNoEncontrada`, 404):
  - `GET /mi-espacio/restituciones/vista?licencia_id=&anio=&tanda=`: la vista del modal B antes de pedir, `{ recuadro: { resaltado, resto }, html, aclaracion }` (la nota con la fecha de hoy). Un grupo que no está por restituir, 400 `grupoNoPorRestituir`; uno A, 400 `grupoEsParaTomar` (campo null).
  - `POST /mi-espacio/restituciones` con `{ licencia_id, anio, tanda }`: en una transacción que bloquea la fila de la persona, `registrarPedido(caso 'restituir')`; 201 `{ data: { id }, message: mensajeDeLaRestitucionPedida }`. Los mismos 400.
  - `DELETE /mi-espacio/restituciones/:id`: un pedido B activo de la persona; después del plazo, 409 `restitucionVencida`; si no, `soltarPedido` y 200 con `MENSAJE_RESTITUCION_BORRADA`. Un pedido A, 404.
  - `GET /mi-espacio/restituciones/:id/nota`: `{ html, fecha, aclaracion, hecho: textoDeLaRestitucionHecha(...), vacaciones: { tipo_nombre, fechas_texto } }`; `GET …/word`: el .docx con `disposicionDeAdjunto`.
  - En `tests/permisos.test.js`, las cuatro en `RUTAS_MI_ESPACIO` (y las dos `GET` en las lecturas del lector y del colaborador).
- Consumes: Tasks 4–9.

- [ ] **Step 1: Write the failing tests:** la variante B de punta a punta (vista, pedido, «Te quedan» de 21 a 23 en el Resumen, la nota y el Word con la fecha del pedido, borrarlo antes del plazo y el 409 después), dos licencias en la misma tanda (pedir una no cambia el plazo de la otra), los 400, lo ajeno, el doble envío (dos `POST` a la vez dejan un solo pedido: el segundo da 400), y los permisos.
- [ ] **Step 2:** correr → FAIL. **Step 3:** implementar. **Step 4:** correr → PASS.
- [ ] **Step 5: Commit** `feat(mi-espacio): pedir y borrar la restitución, con su nota (API)`.

### Task 12: El email de las 8:15

**Files:**
- Modify: `services/emailTemplates.js` (`vencimientoMiEspacioTemplate`), `services/miEspacioAvisos.js` (`emailDe`)
- Test: `tests/mi-espacio-avisos.test.js`, `tests/email-diseno.test.js`, `tests/emails-fixtures.js`

**Interfaces:**
- Produces:
  - `emailDe`: después de sacar las claves ya avisadas, si quedan los dos avisos de un mismo grupo (`restitucion.grupo`), dibuja uno solo (el `-2`) y anota las dos claves.
  - `vencimientoMiEspacioTemplate({ nombre_completo, avisos })`: un aviso con `restitucion` se dibuja con sus párrafos (las negritas en `<strong>`, todo escapado) y, en el texto plano, con su `texto`. Si todos los avisos son de restitución, el asunto es «RPAD: tenés días para restituir en Mi espacio» y el título «Días para restituir»; si no, los de siempre. La nota del pie suma adelante «Te va a llegar otro aviso 5 días hábiles antes del plazo.» si algún aviso de restitución es `primero` y su `-2` no va en el mismo email. Lo demás (el destinatario, el remitente, el marco, las claves anotadas solo si sale y el candado) no cambia.
- Consumes: `avisosDeVencimiento` (Task 6).

- [ ] **Step 1: Write the failing tests** (Docker y Mailpit, con el reloj fijo, llamando al servicio): con Julieta, el asueto cargado el 22/12/2026 mientras está de vacaciones → el 22/12 no le llega; el lunes 11/01/2027 le llega el email de la maqueta (asunto, título, los tres párrafos y la nota del pie); el 12/01, nada; el viernes 23/04/2027, el segundo (sin «Te va a llegar otro aviso…»); si los dos tocan el mismo día, uno solo con las dos claves anotadas; con un aviso de franco el mismo día, el asunto de siempre y el renglón de la restitución; la plantilla con HTML en el nombre (escapado).
- [ ] **Step 2:** correr → FAIL. **Step 3:** implementar. **Step 4:** correr → PASS.
- [ ] **Step 5: Commit** `feat(mi-espacio): el email de los días para restituir`.

### Task 13: La página: lo puro

**Files:**
- Modify: `public/js/mi-espacio.js` (la sección del Resumen ~196-460, la de Licencias ~470-560 y la de los formularios ~960-1210)
- Test: `tests/mi-espacio-frontend.test.js`

**Interfaces:**
- Produces (puras, en el `vm`):
  - `htmlDeRestituciones(lista)`: un `<div class="me-aviso me-aviso-ambar me-restituir">` por cada una, con su `<p>` y su botón (`sg-btn sg-btn-borde sg-btn-chico`): A con `data-accion="cargar-licencia" data-tipo="restituidos" data-grupo="<clave>"`, B con `data-accion="pedir-restitucion" data-grupo`; sin nada, ''. `htmlDelResumen` lo pone **entre la banda y el resto** (después de `htmlDeLaBanda`, antes de `htmlDelResto`).
  - `htmlDeVencePronto`: con `accion.grupo`, el botón suma `data-grupo` y, con `accion.tipo === 'restitucion'`, `data-accion="pedir-restitucion"`.
  - `htmlDeFilaDeLicencia`: cada una de `fila.restituciones` en un `<span class="me-restituir-linea">` dentro del cuerpo de la fila: por restituir, `<span class="me-detalle me-detalle-aviso"><span aria-hidden="true">▲ </span>…</span>` y su botón; pedida, el texto en `me-detalle`, «Word» (`data-word-restitucion`, `aria-label` «Descargar en Word la nota de la restitución a la licencia 2025») y, con `puede_borrar`, «Borrar el pedido» (`sg-link me-link-rojo`, `data-borrar-restitucion`); cargada y perdida, el texto en `me-detalle`. `CLASE_DEL_TIPO.restituidos = 'azul'`.
  - «Cargar licencia»: `htmlDeTiposDeLicencia` pone `data-grupo` en las opciones `restituidos` (una por grupo, todas con `value="restituidos"`) y elige la del grupo elegido; `valoresDeLicencia(fila, tipo, grupo)` suma `grupo` (y, de una fila `restituidos`, su grupo cargado); `erroresDeLicencia` de `restituidos` controla solo «Desde»; `cuerpoDeLicencia` de `restituidos` manda `{ tipo, restitucion, desde, mostrar, nota }` (en el alta, `restitucion` de la opción elegida; al corregir, sin ella) y `autorizado_id` como unas vacaciones (`dejaPersonaACargo`, copia de `TIPOS_CON_PERSONA_A_CARGO`, atada por un test de paridad).
  - El modal B: `htmlDelRecuadroDeRestitucion(recuadro)` (`<b>resaltado</b>resto`, escapado) y `htmlDelSegundoPasoDeRestitucion({ vacaciones, hecho, html, aclaracion })` (como `htmlDelSegundoPaso`: la tilde, la insignia «Vacaciones», las fechas, el texto de `hecho`, «Así sale la nota», la aclaración y la hoja, que va tal cual).
  - `textoDeConfirmacionDeRestitucion(linea)`: «¿Borrar el pedido de restitución? Los días vuelven a estar por restituir y la nota que armaste ya no vale.» (texto plano).
- [ ] **Step 1: Write the failing tests** con los datos de la maqueta (`datos.js`: comparen el HTML de las partes nuevas, con `mq-nuevo` sacado, cuando sea razonable), el escapado (un texto con `<b>"x"</b>`), la paridad, y que un Resumen o una fila de antes (sin las claves nuevas) se dibujan igual que hoy.
- [ ] **Step 2:** correr → FAIL. **Step 3:** implementar. **Step 4:** correr → PASS.
- [ ] **Step 5: Commit** `feat(mi-espacio): el aviso, la fila y los formularios de los días restituidos (lo puro)`.

### Task 14: La página: el DOM, el HTML y los estilos

**Files:**
- Modify: `public/js/mi-espacio.js` (`alTocarResumen`, `alTocarLicencias`, `abrirLicencia`, `pintarCamposDelTipo`, `pintarCalculo`, `guardarLicencia`, el segundo paso, `bajarWordDeLicencia`/`pedirWordDeLicencia` generalizado a una ruta, `pedirConfirmacion`, `FORMULARIOS`, `IDENTIDADES_DEL_FOCO`), `public/mi-espacio.html` (`#modal-restitucion`, la ayuda de «Hasta», los estilos y `mi-espacio.js?v=20261220`)
- Test: `tests/mi-espacio-frontend.test.js` (DOM falso), `tests/paginas.test.js`

**Interfaces:**
- Produces:
  - «Cargar licencia» con «Días restituidos»: se abre con el grupo elegido desde el aviso, «Vence pronto» y la fila (`abrirLicencia({ tipo: 'restituidos', grupo })`) o eligiendo la opción; «Desde» con `ayuda_desde` en `#ml-fechas-ayuda`; «Hasta» de solo lectura (`readonly`, clase `me-auto`) con `ayuda_hasta` en un `<p class="form-hint" id="ml-hasta-ayuda">` en su `aria-describedby`, y el valor de `vista.hasta` del cálculo; sin horas; la nota, «Mostrar», la persona a cargo del titular y el paso, como unas vacaciones; al guardar, el segundo paso de siempre (la nota A).
  - `#modal-restitucion` («Pedir la restitución», un modal de administración que el velo no cierra): `#mr-error` (`role="alert"`), `#mr-vista` (el recuadro, «Así sale la nota», la aclaración y la hoja de `GET …/restituciones/vista`), el pie con «Cancelar» y `#mr-pedir`; después del `POST`, `#mr-paso-dos` (con `GET …/restituciones/:id/nota`) y su pie con «Listo» y `#mr-descargar-word`. «Pedir la restitución» queda deshabilitado mientras pide (un doble clic manda un solo `POST`); un 400 va a `#mr-error` y el modal sigue abierto; un 401, al login. Al cerrar, la página vuelve a pedir todo y el foco va adonde va después de cualquier guardado.
  - En la fila: «Word» de la restitución (`GET …/restituciones/:id/word`, con el mismo fetch propio de la nota de licencia) y «Borrar el pedido» (con `pedirConfirmacion` y `textoDeConfirmacionDeRestitucion`; un 409 se avisa con el mensaje del servidor).
  - Estilos en el `<style>` de `mi-espacio.html`, solo con los tokens `--sg-*` (y `--f-titulo`/`--f-texto`): `.me-restituir p { flex: 1 1 360px }`, `.me-restituir .sg-btn { flex: 0 0 auto }`, `.me-restituir-linea` (renglón propio, con su botón de 32 px; 44 px en el teléfono), `.form-input.me-auto` (el fondo sutil y el texto de siempre). 4,5:1 o más en los textos nuevos; en el teléfono, el aviso queda después de la regla.
  - `VERSION_MI_ESPACIO` en `'20261220'`.
- [ ] **Step 1: Write the failing tests:** con el DOM y el `fetch` falsos, el recorrido A (el aviso → el modal con el grupo, la ayuda, el «Hasta» del cálculo, guardar, el segundo paso) y el B (el modal, pedir, el segundo paso, el Word, borrar con confirmación, el 409), el doble clic, el 400, el foco al cerrar; `tests/paginas.test.js`: la versión, los ids de `#modal-restitucion` y `#ml-hasta-ayuda`, las clases nuevas en el `<style>` y su contraste.
- [ ] **Step 2:** correr → FAIL. **Step 3:** implementar. **Step 4:** correr → PASS.
- [ ] **Step 5: Commit** `feat(mi-espacio): cargar y pedir los días restituidos desde la página`.

### Task 15: Configuración → Feriados

**Files:**
- Modify: `public/js/feriados.js` (`textoDeAfectadasFeriado`, `pedirAfectadasFeriado`), `public/configuracion.html` (`feriados.js?v=20261210`)
- Test: `tests/feriados-frontend.test.js`, `tests/paginas.test.js`

**Interfaces:**
- Produces: `textoDeAfectadasFeriado(cantidad, vacaciones = 0, plazo = null)`: sin vacaciones, el texto de hoy; todas son vacaciones: «1 licencia cargada lo incluye: son vacaciones, y ese día queda para restituir con nota hasta el 30/04/2027.» (con más, «3 licencias cargadas lo incluyen: son vacaciones, y …»); de los dos: «3 licencias cargadas lo incluyen. En 2 vacaciones, ese día queda para restituir con nota hasta el 30/04/2027; la otra se recalcula.» (una de vacaciones: «En unas vacaciones, …»; más de una que se recalcula: «las otras 2 se recalculan»); sin un plazo que sea una fecha, sin «hasta …». Sin nombres. `pedirAfectadasFeriado` lee `vacaciones_para_restituir` y `plazo_de_restitucion`. `VERSION_FERIADOS` en `'20261210'`.
- [ ] **Step 1: Write the failing tests** (los dos textos de la maqueta, `MQ.T.feriado1` y `MQ.T.feriado3`, y los demás casos; el pedido con el `fetch` falso; la versión en `tests/paginas.test.js`).
- [ ] **Step 2:** correr → FAIL. **Step 3:** implementar. **Step 4:** correr → PASS.
- [ ] **Step 5: Commit** `feat(feriados): el modal dice cuántas vacaciones quedan con días para restituir`.

### Task 16: La comprobación con los casos reales (fuera del repo)

**Files:** ninguno del repo. Todo en el scratchpad del controlador, en una copia de la base local (`rpad_sim_restituidos`) y en `~/Desktop/RPAD-simulacion-dias-restituidos/`.

El usuario pidió comprobar con sus casos reales, que están en `~/rpad-notas/dias-restituidos-casos-reales.md` (**no van al repo**: ni los nombres, ni las fechas, ni el informe). Se reusa la simulación anterior (`~/rpad-notas/simulacion-mi-espacio/sim/`: `reloj.mjs` —la barrera de red, el reloj de Node y de la base, los emails a archivos y a Mailpit con su etiqueta, y los candados con nombres propios—, `accion.mjs` y `dia.mjs`), adaptada a esta rama.

- [ ] **Step 1:** Copiar la base local a `rpad_sim_restituidos` (ya migrada) y verificar los saldos reales de los dos casos.
- [ ] **Step 2:** Correr la línea de tiempo con el reloj fijo, por los controladores: las cargas de fines de noviembre y de principios de diciembre, los asuetos del 21/12/2026 (como administración), la corrida completa de las 8:15 cada día hábil hasta el 03/05/2027, las acciones de cada caso (la carga A y los pedidos B el primer día hábil de febrero, con los datos del archivo de casos) y, en las fechas clave, el Resumen, la lista, Configuración → Licencias, Correos → Estado y las notas en Word.
- [ ] **Step 3: Las capturas** (pedido del usuario): el día en que cada persona vuelve a trabajar, cómo se ve el RPAD (el Resumen y la pestaña Licencias, en la compu y en el teléfono, y el email de ese día en Mailpit). Con la app corriendo sobre la copia y con el reloj de la simulación, Chrome sin ventana manejado por CDP desde Node (el `WebSocket` de Node 22; un perfil propio en el scratchpad), con la sesión de esa persona en el `localStorage` (un token firmado con el `JWT_SECRET` local) y la fecha de la página fijada en la de la simulación (`Page.addScriptToEvaluateOnNewDocument`). Se guardan como PNG en el informe.
- [ ] **Step 4:** Escribir el informe (`LEEME.html` con lo que vio cada persona día por día, las capturas, los emails, las notas y cualquier hallazgo) y una copia corta en `~/rpad-notas/dias-restituidos-simulacion-cierre.md`. Los hallazgos que sean errores de esta entrega se arreglan en la rama (con su test, con datos inventados) antes de la Task 17; los que no, quedan para el usuario.
- [ ] **Step 5:** Borrar `rpad_sim_restituidos` al terminar.

### Task 17: La documentación

**Files:**
- Modify: `CLAUDE.md` (la estructura del proyecto —el servicio nuevo—, «Base de datos» —las tablas, de 43 a 45—, la convención de `mi-espacio.js` —con `VERSION_MI_ESPACIO` en `'20261220'`—, la de `feriados.js` —`VERSION_FERIADOS` en `'20261210'`—, «Mi espacio: licencias y horas extras» —la regla, la API y la página—, «Mi espacio: la nota de licencia en Word» —los dos cuerpos—, «Feriados» —la foto— y «Despliegue»), `README.md` (la estructura de `database/updates/` y una sección «Migración: los días restituidos», con el formato de las de Mi espacio)

- [ ] **Step 1:** Escribir los cambios, cortos, con el estilo de cada sección (sin nombres reales ni el caso real).
- [ ] **Step 2:** `node --test tests/paginas.test.js` → PASS.
- [ ] **Step 3: Commit** `docs(mi-espacio): los días restituidos (CLAUDE.md y README)`.

### Task 18: La revisión final y la suite completa

- [ ] **Step 1:** Revisión de toda la rama (`git diff 39eef2b..HEAD`) por un subagente Opus que no la escribió: la spec entera, los Review Focus, las convenciones del `CLAUDE.md`, los nombres reales.
- [ ] **Step 2:** Arreglar lo importante, con su test, y volver a revisar.
- [ ] **Step 3:** `npm test` completo (lo corre el controlador) → verde.
- [ ] **Step 4: Commit y push** de los arreglos.

### Task 19: El kit de despliegue (fuera del repo)

- [ ] **Step 1:** `~/rpad-kits/RPAD-deploy-mi-espacio-dias-restituidos/`, armado contra main 39eef2b: los archivos de `git diff --name-only 39eef2b..HEAD` sin `tests/` ni `docs/` (`database/schema.sql` va de referencia: no se corre), `migracion-mi-espacio-restituciones.sql` y su vuelta atrás, y un `LEEME` con los pasos de cPanel de la sección 14 de la spec (la comprobación previa: `mi-espacio.html` pide `mi-espacio.js?v=20261219` y `configuracion.html`, `feriados.js?v=20261209`; el SQL con su verificación, **antes** de subir el código; los archivos; Restart; sin Run NPM Install, sin variables de entorno nuevas y sin cron nuevo; lo que se mira con Ctrl+F5; y la vuelta atrás, en orden). El kit de vuelta atrás, con los archivos de main 39eef2b.
- [ ] **Step 2:** Cruzar el kit contra los nombres reales (0 coincidencias).
