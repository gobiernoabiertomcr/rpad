# Mi espacio: las horas acumuladas de contrato — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que una persona de contrato use sus horas acumuladas (lo que no usó en su mes y su saldo inicial) desde «Cargar
licencia» → «Horas a favor», solas o junto con las del mes, sin que vuelvan a cero el 1/1.

**Architecture:** una columna nueva, `mi_espacio_licencias.horas_acumuladas` (la parte acumulada de una carga de horas a favor;
`horas` sigue siendo el total del día). En las reglas, una cuenta nueva sin años para contrato (`acumuladasDe`, en
`calcular` como `acumuladas`), los topes de los dos números (`topesDeHorasAFavor`) y su ruta `GET`; planta sigue con
`noUtilizadasDe`. La página dibuja dos campos («De {mes}» y «Acumuladas») cuando hay acumuladas.

**Tech Stack:** Node 22, Express 4, MariaDB 10.6+ (mysql2/promise), vanilla JS, `node --test`, `docx`.

**Spec:** `docs/superpowers/specs/2026-11-03-mi-espacio-horas-acumuladas-design.md` (aprobado el 03/11/2026). La maqueta, opción
B: `docs/superpowers/specs/2026-11-03-mi-espacio-horas-acumuladas-mockups/` (`?opcion=b`). El executor lee las dos.

## Global Constraints

- **Solo contrato.** Planta no cambia nada: sus francos, `noUtilizadasDe` en francos, su reinicio del 1/1, su «Registrar un uso
  autorizado» y sus textos. Los tests de planta de hoy no se tocan (salvo el del arreglo de la sección 5 de la spec: ver Task 3).
- **`horas` es el total del día** (0,5 a 7, de a media hora). `horas_acumuladas` es la parte acumulada, de 0 a `horas`, de a
  media hora; se guarda NULL cuando es 0 o en otro tipo. La parte del mes es `horas − horas_acumuladas`.
- Un cuerpo sin `horas_acumuladas` (una pestaña con la página anterior) se guarda como hoy: todo del mes.
- Los textos son los de la spec, al pie de la letra (secciones 5, 9 y 10). Los nombres: «Horas acumuladas» (contrato).
- Migración aditiva y repetible, **antes** del código. Con rollback.
- `VERSION_MI_ESPACIO` pasa a `'20261221'` (de `'20261220'`).
- **Nunca nombres reales** en el repo (tests, fixtures, commits, comentarios): personas inventadas.
- Ningún email real: en local todo va a Mailpit.
- **`npm test` completo antes y después de cada tarea, con el candado compartido `C:\Users\Mariano\.rpad-suite.lock`** (lo toma
  solo el controlador; los subagentes corren los archivos de su tarea con `node --test tests/<archivo>.test.js`; los de Docker
  necesitan `docker compose` arriba y el `.env` del worktree, también con el candado tomado).
- Commit y push de la rama después de cada tarea (hay cortes de luz). Mensajes en español, con la línea `Co-Authored-By`.
- Comentarios y nombres en español, como el código de alrededor. Fechas `'AAAA-MM-DD'`, sin `Date` local en las reglas.

## Review Focus

1. **Corregir una carga que ya usaba acumuladas:** sus propias horas (del mes y acumuladas) vuelven a sus topes; sin eso, guardar
   sin cambios da error. Test en Task 3 (`topesDeHorasAFavor` con `editadaId`) y en Task 4 (PUT sin cambios, 200).
2. **Un cambio posterior que deja la cuenta en negativo** (se borra una salida de un mes viejo, se baja el saldo inicial): faltante
   ámbar, nunca un 500 ni un número negativo en la tarjeta. Test en Task 2 (`faltantesDe` con `acumuladas`) y Task 5 (la tarjeta
   con `quedan` 0).
3. **Valores raros en `horas_acumuladas`:** `'0.5'` (texto) sirve; `''`, null y sin clave son 0; `-0.5`, `0.25`, `'0,5'`, más que
   `horas` y `true` dan 400 en `horas_acumuladas`. Test en Task 3.
4. **Cambiar la fecha a otro mes con el modal abierto:** los topes y el rótulo son del mes nuevo; una respuesta vieja de los topes
   se descarta. Test en Task 7.
5. **Un día de 7 h armado con acumuladas es de día entero:** pasa a Configuración → Licencias y «Hoy no están» lo muestra. Test en
   Task 4.

---

## File Structure

- `database/updates/migracion-mi-espacio-horas-acumuladas.sql` (nuevo) y `rollback-mi-espacio-horas-acumuladas.sql` (nuevo);
  `database/schema.sql`.
- `services/miEspacioReglas.js`: la cuenta, los topes, la validación, los faltantes, los textos y el arreglo del «Te quedan 0».
- `services/miEspacioDatos.js`: lee la columna.
- `controllers/miEspacioController.js` y `routes/index.js`: escribe la columna y la ruta de los topes.
- `services/miEspacioResumen.js`: la opción del tipo, la pastilla, la tarjeta, la situación del mes, la fila y el saldo inicial.
- `services/miEspacioNota.js`: el cuerpo de la nota de horas a favor (el Word sale de la misma nota, sin cambios en
  `miEspacioNotaWord.js`).
- `public/js/mi-espacio.js` y `public/mi-espacio.html`: los dos campos, los topes, la tarjeta y la versión.
- `CLAUDE.md` (y el README si nombra el uso autorizado de contrato).
- Tests: `tests/mi-espacio-reglas.test.js`, `mi-espacio-resumen.test.js`, `mi-espacio-nota.test.js`,
  `mi-espacio-nota-word.test.js`, `mi-espacio-api.test.js`, `mi-espacio-frontend.test.js`, `schema.test.js`, `permisos.test.js` y
  `paginas.test.js`.

---

## Task 0: Preparar el worktree y la línea de base (el controlador)

Sin código. El controlador:

- [ ] Copia `C:\git\rpad\.env` al worktree (está en `.gitignore`), con `DB_NAME=rpad_rama_saldo_horas` (la copia de la base de
  esta rama, ya cargada) y le da al usuario de la app permisos sobre esa base (`GRANT ALL ON rpad_rama_saldo_horas.* TO …`, con
  el root del `.env`, sin mostrarlo).
- [ ] Con el candado, corre `npm test` completo y anota el resultado (la línea de base: tiene que dar todo verde).

---

## Task 1: La columna nueva y su lectura (simple → Sonnet, alto)

**Files:**
- Create: `database/updates/migracion-mi-espacio-horas-acumuladas.sql`, `database/updates/rollback-mi-espacio-horas-acumuladas.sql`
- Modify: `database/schema.sql` (la tabla `mi_espacio_licencias`), `services/miEspacioDatos.js:41-47` (`COLUMNAS_LICENCIA_MIA`,
  `aLicencia`) y el JSDoc de `estadosDe` (línea 72)
- Test: `tests/schema.test.js`, `tests/mi-espacio-api.test.js`

**Interfaces:**
- Produces: cada licencia de `estadoDe`/`estadosDe`/`contextoDe` lleva `horas_acumuladas: number | null` (con `numeroONulo`).

- [ ] **Step 1: Tests que fallan.** En `schema.test.js`, como los de `migracion-mi-espacio-horas-mes-anterior.sql`: la columna
  `horas_acumuladas` `decimal(3,1)` NULL después de `horas`; la migración se corre dos veces sobre la estructura de main sin
  error; la vuelta atrás la borra y se puede repetir; la cabecera de la migración dice que va después de
  `migracion-mi-espacio-restituciones.sql` y antes del código. En `mi-espacio-api.test.js`: `estadoDe` de una persona inventada con
  una fila `horas_a_favor` de 7 h y `horas_acumuladas` 0,5 (por SQL) devuelve `horas_acumuladas: 0.5`, y una sin la columna
  cargada, `null`.
- [ ] **Step 2:** `node --test tests/schema.test.js tests/mi-espacio-api.test.js` (con el candado) → FAIL.
- [ ] **Step 3: La migración:** `ALTER TABLE mi_espacio_licencias ADD COLUMN IF NOT EXISTS horas_acumuladas DECIMAL(3,1) NULL
  DEFAULT NULL AFTER horas;` con la cabecera de siempre (qué hace, el orden, que es obligatoria antes del código porque `estadosDe`
  la lee, que el código anterior anda con ella) y la verificación comentada `SHOW COLUMNS FROM mi_espacio_licencias LIKE
  'horas_acumuladas';` (1 fila). El rollback: `ALTER TABLE mi_espacio_licencias DROP COLUMN IF EXISTS horas_acumuladas;`, con la
  cabecera que dice qué se pierde (spec, 6). `schema.sql`: la columna en su lugar. `miEspacioDatos.js`: la columna en
  `COLUMNAS_LICENCIA_MIA` y `horas_acumuladas: numeroONulo(fila.horas_acumuladas)` en `aLicencia`, después de `horas`.
- [ ] **Step 4:** aplicar la migración a `rpad_rama_saldo_horas` (la base del `.env`) y a la base de Docker de los tests si hace
  falta; los dos archivos de tests → PASS.
- [ ] **Step 5: Commit y push.**

---

## Task 2: La cuenta de las horas acumuladas (difícil → Opus, alto)

**Files:**
- Modify: `services/miEspacioReglas.js` (`horasAFavorDe` ~2310, `noUtilizadasDe` no cambia, `calcular` ~2542, `faltantesDe`
  ~2659, `mensajeDeLaCarga` ~2733, textos ~273)
- Test: `tests/mi-espacio-reglas.test.js`, `tests/fixtures/mi-espacio-casos.js` (solo si hace falta sumar un caso inventado)

**Interfaces:**
- Consumes: `horas_acumuladas` de cada licencia (Task 1).
- Produces:
  - `horasAcumuladasDe(fila) → number`: la parte acumulada de una carga `horas_a_favor` (0 si es null, no es un número finito o
    la fila es de otro tipo). `horasDelMesDe(fila) → number`: `horas − horasAcumuladasDe(fila)` (nunca menos de 0).
  - `acumuladasDe(estado, { hoy, feriados }) → { saldo: { cantidad, quedan }, meses: [{ mes_de_uso, mes_trabajado, cantidad,
    quedan }], usos: [{ id, fecha, cantidad }], entra, sale, quedan }`. Fuera de contrato o sin un hoy válido, todo en 0 y listas
    vacías.
  - `calcular(...)` suma `acumuladas` (contrato: `acumuladasDe`; si no, null) y, en contrato, `noUtilizadas` queda `{}` (planta,
    como hoy).
  - `textoQuedanAcumuladas(quedan) → string`: «No te quedan horas acumuladas.», «Te queda 1 hora acumulada.», «Te quedan 1,5
    horas acumuladas.» (exportada: la página la copia en Task 7 solo si la usa).
  - El faltante `{ clave: 'acumuladas', campo: 'horas_acumuladas', medida, texto, mensaje }`.

- [ ] **Step 1: Tests que fallan** (puros, con una persona de contrato inventada; los números del caso: arranque el 28/10/2026,
  saldo inicial `horas_no_utilizadas` 2026 = 1,5, salidas de octubre que dan 6,5 h; hoy el 03/11/2026):
  - `acumuladasDe` el 03/11/2026: `quedan` 1,5, `saldo.cantidad` 1,5, `meses` [] (noviembre no terminó).
  - El 01/12/2026 sin usar noviembre: `quedan` 8 y `meses` [{ mes_de_uso: '2026-11', mes_trabajado: '2026-10', cantidad: 6.5,
    quedan: 6.5 }].
  - **Sin reinicio:** el 15/01/2027, la misma persona sigue con 8 (el saldo de 2026 cuenta en 2027) y un mes de diciembre de 2026
    con sobrante suma.
  - Los meses de antes del arranque no suman (están en el saldo).
  - Una carga `horas_a_favor` del 06/11 con `horas` 7 y `horas_acumuladas` 0,5: `horasAFavorDe` cuenta 6,5 de noviembre (no 7) y
    `acumuladasDe` saca 0,5 (`quedan` 1). Una con `horas` 1,5 y `horas_acumuladas` 1,5 no es un uso del mes.
  - Las más viejas primero: con saldo 1 y un mes con 3, un uso de 2 deja el saldo en 0 y el mes en 2.
  - Un uso autorizado de contrato ya cargado (fila `uso_autorizado` de 1 h, del arranque en adelante) también sale; uno de antes
    del arranque, no.
  - La parte acumulada de una carga anterior al arranque no sale.
  - `faltantesDe` con lo que sale por encima de lo que entra: `{ clave: 'acumuladas', campo: 'horas_acumuladas', medida: 0.5,
    texto: 'Revisá tus horas acumuladas: usaste 2 horas y había 1,5.', mensaje: 'No te quedan horas acumuladas.' }`; sin nada
    que entra: «… usaste 1 hora y no había ninguna.».
  - `calcular` de contrato: `noUtilizadas` es `{}` y `acumuladas` el de `acumuladasDe`; de planta, `acumuladas` null y
    `noUtilizadas` como hoy (los tests de planta no cambian).
  - `textoQuedanAcumuladas(0)`, `(1)`, `(0.5)`, `(1.5)`.
- [ ] **Step 2:** `node --test tests/mi-espacio-reglas.test.js` → FAIL.
- [ ] **Step 3: Implementar.** `horasAFavorDe`: los usos de `horas_a_favor` cuentan `horasDelMesDe(fila)` (si da 0, no es un uso
  del mes). `acumuladasDe`: entra el saldo (`saldoDeHorasNoUtilizadas` sin la condición del año: la fila es la del año del
  arranque) y los `no_utilizadas > 0` de los meses de `horasAFavorDe` que terminaron y no son `antes_del_arranque`, de cualquier
  año; sale lo de `uso_autorizado` (como hoy: `diasQueDescuentan`, que ya respeta el arranque) y `horasAcumuladasDe` de cada
  `horas_a_favor` con fecha desde el arranque; se descuenta del saldo y después de los meses, del más viejo al más nuevo, sin
  negativos (como el bucle de `noUtilizadasDe`). `calcular`: `noUtilizadas` solo en planta; `acumuladas` en contrato.
  `faltantesDe`: el faltante de arriba (los `uso:<anio>` siguen para planta). `mensajeDeLaCarga`: con la clave `acumuladas`,
  `textoQuedanAcumuladas` de lo que quedaba antes de la carga, con lo que ya usaba la fila que se corrige (como
  `quedanDeLoNoUtilizado`).
- [ ] **Step 4:** el archivo → PASS. Los tests de hoy que miraban `calcular(...).noUtilizadas` de contrato pasan a mirar
  `acumuladas`; los de `noUtilizadasDe` (la función no cambia) y los de planta quedan como están.
- [ ] **Step 5: Commit y push.**

---

## Task 3: La validación, los topes y el cálculo (difícil → Opus, alto)

**Files:**
- Modify: `services/miEspacioReglas.js` (`MENSAJES_MI_ESPACIO`, `validarLicencia` ~1302, `evaluarLaCarga` ~2870,
  `textoDeLoQueQueda` ~2807, `vistaDe` ~3073)
- Test: `tests/mi-espacio-reglas.test.js`

**Interfaces:**
- Consumes: `acumuladasDe`, `horasAcumuladasDe`, `horasDelMesDe`, `textoQuedanAcumuladas`, `calcular().acumuladas` (Task 2).
- Produces:
  - `MENSAJES_MI_ESPACIO.acumuladasMedias = 'Las horas acumuladas van de a media hora, hasta el total.'`
  - `validarLicencia` devuelve `datos.horas_acumuladas`: en `horas_a_favor`, el número (null si es 0); en otro tipo, null.
  - `topesDeHorasAFavor(estado, fecha, { hoy, feriados, editadaId }) → { mes, mes_texto, del_mes, acumuladas, termino } | null`:
    lo que queda para la carga del mes de `fecha` y de las acumuladas, antes de esta carga y con lo que ya usaba la de
    `editadaId`. `mes` 'AAAA-MM', `mes_texto` el de `nombreDelMes` ('noviembre'), `termino` si el mes de uso ya terminó. Con
    `termino`, `del_mes` es `min(lo que queda del mes, acumuladas)` (spec 5, «Una carga en un mes que ya terminó»). null fuera de
    contrato, sin arranque o con una fecha que no es una fecha.

- [ ] **Step 1: Tests que fallan** (puros, el mismo caso):
  - `validarLicencia` con `horas_acumuladas`: sin la clave, null o '' → `datos.horas_acumuladas` null; '0.5' y 0.5 → 0.5; 0 →
    null; `-0.5`, `0.25`, `'0,5'`, `true` y más que `horas` → `{ campo: 'horas_acumuladas', mensaje: 'Las horas acumuladas van de
    a media hora, hasta el total.' }`; en `franquicia` o `medica`, la clave se ignora (null). El error de `horas` sigue antes.
  - `topesDeHorasAFavor` el 03/11 para el 06/11: `{ mes: '2026-11', mes_texto: 'noviembre', del_mes: 6.5, acumuladas: 1.5,
    termino: false }`; con `editadaId` de una carga de 7 h (0,5 acumuladas) del 06/11: `del_mes` 6,5 y `acumuladas` 1,5 (sus
    horas vuelven); para el 04/12: `del_mes` 0 (noviembre trabajó 0 para diciembre) y `acumuladas` 1,5 («las de hoy»).
  - Carga tarde: el 05/12/2026, con noviembre sin usar (6,5 pasaron a acumuladas, total 8), para el 20/11: `termino` true,
    `del_mes` 6,5 y `acumuladas` 8; si 7 de esas 8 ya se usaron como acumuladas en otra carga, `del_mes` 1.
  - `evaluarLicencia` del 06/11 con `horas` 7 y `horas_acumuladas` 0,5: sin error; `vista.texto_dias` '7 horas, el día entero';
    `vista.queda_texto` 'Usás 6,5 horas a favor de noviembre y 0,5 de tus horas acumuladas. Te queda 1 hora acumulada.'.
  - `horas` 1,5 y `horas_acumuladas` 1,5: `texto_dias` '1,5 horas', `queda_texto` 'Usás 1,5 horas acumuladas. No te quedan horas
    acumuladas.'.
  - `horas` 7 sin acumuladas: error `{ campo: 'horas', mensaje: 'En noviembre de 2026 te quedan 6,5 horas a favor.' }` y
    `vista.queda_texto` '' (**el arreglo**: ya no «Usás 7 … Te quedan 0.»).
  - `horas` 7 y `horas_acumuladas` 2 (pasa de las 1,5): error en `horas_acumuladas`, 'Te quedan 1,5 horas acumuladas.'.
  - Carga tarde del 20/11 el 05/12 con 2 del mes cuando solo queda 1 libre: error en `horas`, 'En noviembre de 2026 te queda 1
    hora a favor.'.
  - El arreglo en todo tipo: una franquicia de planta que pasa el tope da su error y `queda_texto` ''; sin error, `queda_texto`
    como hoy (este es el único test de planta que cambia, por la decisión de la spec 5).
  - Solo del mes, sin acumuladas, sin error: la vista como hoy («Usás 6,5 horas a favor de noviembre. Te quedan 0.»).
- [ ] **Step 2:** el archivo → FAIL.
- [ ] **Step 3: Implementar.** `validarLicencia`: el control de `horas_acumuladas` justo después del de las horas (paso 4).
  `topesDeHorasAFavor`: `calcular` del estado sin la carga de `editadaId`; `del_mes` = `a_favor − usadas` del mes de uso de
  `fecha` (0 si no está); `acumuladas` = `acumuladas.quedan`; con `termino`, el mínimo. En `evaluarLaCarga`, para `horas_a_favor`
  de contrato y antes de `loQueFrena`, con esos topes: la parte del mes por encima de `del_mes` → error en `horas` con
  `textoSinHorasAFavor(mes, del_mes)`; si no, la acumulada por encima de `acumuladas − (termino ? parte del mes : 0)` → error en
  `horas_acumuladas` con `textoQuedanAcumuladas` de ese número. `textoDeLoQueQueda` de `horas_a_favor`: con parte acumulada, los
  textos de arriba (y '7 horas, el día entero' en `texto_dias` solo con acumuladas, en `vistaDe`); sin ella, como hoy; el uso
  autorizado de contrato dice `textoQuedanAcumuladas(...)` + ' Se descuentan primero las más viejas.'. `vistaDe`: con
  `contexto.conError`, `queda_texto` ''.
- [ ] **Step 4:** el archivo → PASS. Los tests de hoy que esperaban «Te quedan 0.» al lado de un error cambian; los demás no.
- [ ] **Step 5: Commit y push.**

---

## Task 4: La API (difícil → Opus, alto)

**Files:**
- Modify: `controllers/miEspacioController.js` (el INSERT ~382 y el UPDATE ~420 de las licencias; una función nueva),
  `routes/index.js` (las rutas de Mi espacio)
- Test: `tests/mi-espacio-api.test.js`, `tests/permisos.test.js`

**Interfaces:**
- Consumes: `datos.horas_acumuladas` (Task 3), `topesDeHorasAFavor` (Task 3).
- Produces: `GET /api/mi-espacio/horas-a-favor/topes?fecha=AAAA-MM-DD&id=N` (`verTopesDeHorasAFavor`, con `authMiddleware`,
  sobre `req.user.userId`) → `{ success: true, data: { mes, mes_texto, del_mes, acumuladas, termino } }`. Sin `fecha`, hoy; una
  fecha que no es una fecha, 400 `{ campo: 'fecha', error: MENSAJES_MI_ESPACIO.fecha }`; `id` de otra persona o que no existe,
  se ignora (no se revela); sin modalidad, 200 `{ modalidad: null, mensaje }` (como las otras lecturas); planta, `data: null`. Un
  500: «Error al obtener las horas a favor».

- [ ] **Step 1: Tests que fallan** (Docker, personas inventadas con `crearUsuariosPrueba` y el `hoy` real del servidor: armar las
  salidas y el saldo relativos a hoy, como los tests de horas a favor de hoy):
  - POST de una carga con `horas` 7 y `horas_acumuladas` 0,5 en un día hábil del mes en curso (con 6,5 a favor y 1,5 en el saldo):
    201; la fila tiene `horas` 7.0 y `horas_acumuladas` 0.5; pasa a Configuración (el editor, como día entero) y `GET
    /mi-espacio/ausentes` la muestra a otra persona de administración; la nota (`GET …/nota`) dice el texto de la spec 9.
  - `horas` 7 y `horas_acumuladas` 1,5 (5,5 del mes): 201. `horas` 8: 400 en `horas` (`horasMedias`). `horas` 7 y
    `horas_acumuladas` 2: 400 en `horas_acumuladas` («Te quedan 1,5 horas acumuladas.»). En los dos 400, nada se guarda.
  - Sin la clave `horas_acumuladas`: se guarda como hoy (NULL) y 7 h dan el error de hoy.
  - PUT de la carga combinada sin cambios: 200 (sus horas vuelven a los topes); PUT a solo del mes (6,5, sin acumuladas): 200 y
    vuelven las acumuladas.
  - El doble envío (dos POST iguales a la vez): uno entra y el otro da 400 (`textoSuperpuesta`), nunca dos.
  - `GET /mi-espacio/horas-a-favor/topes`: sin `fecha`, con la del 06/11 de este mes, con `id` propio y ajeno, con `fecha`
    'x' (400), planta (`data: null`), sin modalidad.
  - Lo ajeno: el PUT de una carga de otra persona da el 404 de siempre.
  - `permisos.test.js`: la ruta nueva en `RUTAS_MI_ESPACIO` y en las lecturas del lector y del colaborador.
- [ ] **Step 2:** los dos archivos (con el candado) → FAIL.
- [ ] **Step 3: Implementar.** El INSERT y el UPDATE escriben `horas_acumuladas` (después de `horas`, con
  `datos.horas_acumuladas`). La ruta nueva, antes de cualquier ruta con `:id` de Mi espacio que pudiera chocar, con `responder`,
  `contextoDe` y `topesDeHorasAFavor(estado, fecha, { hoy, feriados, editadaId })`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit y push.**

---

## Task 5: El Resumen, la tarjeta y la lista (media → Opus, alto: muchos textos y consumidores)

**Files:**
- Modify: `services/miEspacioResumen.js` (`quedaDelTipo` ~566, `previoDe` ~497, `usoAutorizadoDe` ~1209,
  `noUtilizadasDeLaTabla` ~1225, `situacionDeLasHoras` ~1205, `saldoInicialDe` ~993, `filaDeLicencia` ~899, `tablaDeHorasExtras`
  ~1418), `services/miEspacioReglas.js` (`camposDelSaldoInicial`: el rótulo)
- Test: `tests/mi-espacio-resumen.test.js`, `tests/mi-espacio-reglas.test.js` (el rótulo)

**Interfaces:**
- Consumes: `calculo.acumuladas`, `horasAcumuladasDe`, `horasDelMesDe`, `nombreDelMes` (Tasks 2 y 3).
- Produces (contrato):
  - La opción `horas_a_favor` de `tipos`: `queda_texto` «Quedan 6,5 h en noviembre · 1,5 acumuladas» («· 1 acumulada»; sin
    acumuladas, como hoy).
  - `pastillas.previo`: `{ numero: '1,5', titulo: 'Horas acumuladas', nota: 'De meses anteriores' }` («Hora acumulada» con 1);
    null sin acumuladas.
  - `tabla.no_utilizadas` (la clave no cambia): `{ titulo: 'Horas acumuladas', total_texto: '1,5 horas', filas, nota: 'No
    vencen: quedan hasta que las uses.', uso_autorizado: { puede, texto } }`, con `puede` true y el texto «Si te autorizan a
    tomarlas, sumalas en «Cargar licencia», con las horas a favor del mes o solas: se descuentan primero las más viejas.» si quedan;
    si no, `puede` false y «No tenés horas acumuladas.». Las filas, de cualquier año, la más nueva primero, más «Del saldo
    inicial». No depende del `anio` pedido.
  - La situación `no_utilizadas` de un mes: «1,5 h pasaron a acumuladas» («1 h pasó a acumuladas»).
  - Cada fila de la lista suma `acumuladas_texto`: en `horas_a_favor` con parte acumulada, «6,5 de noviembre y 0,5 acumuladas» o
    «Todas acumuladas»; si no, ''.
  - El saldo inicial: «Tenías 1,5 horas acumuladas.» («1 hora acumulada»). El campo de «Para arrancar», `rotulo` 'Horas
    acumuladas'.
  - Planta: todo como hoy.

- [ ] **Step 1: Tests que fallan** con esos textos y valores, y que planta no cambia (sus tests de hoy sin tocar). La tarjeta con
  `quedan` 0 (todo usado) dice «0 horas» y «No tenés horas acumuladas.», sin negativos. La tabla de 2025 de contrato trae la misma
  tarjeta que la de 2026.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: Implementar** leyendo `calculo.acumuladas` en contrato (las funciones de hoy siguen con `noUtilizadas` en
  planta).
- [ ] **Step 4:** → PASS. Los tests de hoy de contrato con «no utilizadas previamente», «Horas de 2026» o «en 2026» cambian.
- [ ] **Step 5: Commit y push.**

---

## Task 6: La nota en Word (difícil → Opus, alto)

**Files:**
- Modify: `services/miEspacioNota.js` (`CUERPOS.horas_a_favor` ~218 y quien le pasa la licencia)
- Test: `tests/mi-espacio-nota.test.js`, `tests/mi-espacio-nota-word.test.js`

**Interfaces:**
- Consumes: `licencia.horas_acumuladas` (Task 1), `horasAcumuladasDe` (Task 2).

- [ ] **Step 1: Tests que fallan:**
  - `horas` 7, `horas_acumuladas` 0,5, el 06/11/2026: el cuerpo es «el usufructo de siete (7) horas a favor el día viernes 6 de
    noviembre de 2026: seis horas y media (6,5) correspondientes a las horas extras realizadas en octubre de 2026 y media hora
    (0,5) de horas extras acumuladas de meses anteriores.»
  - `horas` 1,5 y `horas_acumuladas` 1,5, el 09/11/2026: «el usufructo de una hora y media (1,5) de horas extras acumuladas de
    meses anteriores el día lunes 9 de noviembre de 2026.»
  - Con un día tildado «Sumar a {mes anterior}» (el 02/11, 1 h): «… realizadas en octubre de 2026 (incluidas las del lunes 2 de
    noviembre de 2026, sumadas a octubre) y media hora (0,5) de horas extras acumuladas de meses anteriores.»
  - «correspondiente» con 1 h del mes («una (1) hora correspondiente …»).
  - Sin acumuladas, el texto de hoy (los tests de hoy sin tocar).
  - El Word igual a la vista en los dos casos nuevos (`mi-espacio-nota-word.test.js`, renglón por renglón).
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: Implementar** en `CUERPOS.horas_a_favor`, con `textoDeHoras`, `correspondientesALasHoras` (de la parte del mes),
  `conElDia` y el paréntesis de hoy.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit y push.**

---

## Task 7: La página (difícil → Opus, alto)

**Files:**
- Modify: `public/js/mi-espacio.js`, `public/mi-espacio.html` (el modal `#modal-licencia`, el `<style>` y `?v=20261221`)
- Test: `tests/mi-espacio-frontend.test.js`, `tests/paginas.test.js`

**Interfaces:**
- Consumes: `GET /mi-espacio/horas-a-favor/topes` (Task 4), `tabla.no_utilizadas.titulo` y `.nota` y `fila.acumuladas_texto`
  (Task 5), `MENSAJES_MI_ESPACIO.acumuladasMedias` (Task 3).
- Produces (HTML, dentro de `#ml-grupo-horas`, después de `#ml-horas-error`): `<div class="me-dos-horas" id="ml-dos-horas"
  hidden>` con dos `.form-group`: `<label for="ml-horas-del-mes" id="ml-horas-del-mes-rotulo">` («De noviembre» y `<span
  class="me-opcional" id="ml-horas-del-mes-tope">(quedan 6,5)</span>`), `<select class="form-select" id="ml-horas-del-mes"
  aria-describedby="ml-horas-del-mes-error">`, `<p class="form-error" id="ml-horas-del-mes-error" hidden>`; lo mismo con
  `ml-horas-acumuladas` («Acumuladas» y «(tenés 1,5)», `aria-describedby="ml-horas-acumuladas-ayuda ml-horas-acumuladas-error"`);
  `<p class="me-dos-horas-total" id="ml-horas-total">` y `<p class="form-hint" id="ml-horas-acumuladas-ayuda">Las horas
  acumuladas se usan con la autorización del Director General.</p>`. El segundo paso («Licencia cargada») muestra
  `acumuladas_texto` de la fila como la lista.

- [ ] **Step 1: Tests que fallan** (en el `vm`, con el `api.js` de verdad, y con el DOM y el `fetch` falsos):
  - Paridad: `MENSAJES_FORMULARIOS.acumuladasMedias` igual al del servidor.
  - `erroresDeLicencia` con `horas_acumuladas` (los mismos bordes que el servidor: medias, de 0 a `horas`).
  - `cuerpoDeLicencia` de `horas_a_favor` en modo de dos campos: `{ horas: 7, horas_acumuladas: 0.5, … }`; en el modo de un campo,
    sin la clave (como hoy).
  - `htmlDeOpcionesDeLasDos(tope, elegida)` (o el nombre que elija el implementador): de 0 al tope de a media hora.
  - El total: «Total: 7 horas, el día entero.», «Total: 2 horas.», «Total: 1 hora.», «Elegí cuántas horas tomás.».
  - La tarjeta: el título y la nota del servidor (sin ellos, los de hoy), el botón «Usar horas acumuladas» con
    `data-usar-acumuladas` en contrato (planta, «Registrar un uso autorizado» como hoy), y `acumuladas_texto` en la fila, escapado.
  - DOM: «Usarlas» con acumuladas pide los topes (`/mi-espacio/horas-a-favor/topes?fecha=…`) y dibuja los dos campos con sus
    topes y rótulos; elegir 6,5 y 0,5 manda el cálculo con `horas: 7, horas_acumuladas: 0.5`; los campos no ofrecen más que su
    tope (las acumuladas, nunca más de 7 menos lo del mes; con `termino`, de las acumuladas menos lo del mes); cambiar la fecha a
    diciembre pide los topes de nuevo y cambia el rótulo a «De diciembre»; una respuesta vieja de los topes se descarta; sin
    acumuladas (`acumuladas` 0) queda el campo «Horas» de hoy; si los topes no llegan, también (el servidor valida igual); un
    error del servidor en `horas` va debajo de «De noviembre» y en `horas_acumuladas`, debajo de «Acumuladas» (con
    `aria-invalid`); «Mostrar a mis compañeros» aparece con 7 en total; corregir una carga con acumuladas abre los dos campos con
    sus valores; el botón de la tarjeta abre «Cargar licencia» con «Horas a favor» y el foco vuelve a él al cerrar.
  - `paginas.test.js`: `VERSION_MI_ESPACIO` '20261221' y los ids nuevos del modal.
  - Los textos nuevos con 4,5:1 o más (como los tests de contraste de hoy) y el corte del teléfono (≤ 640 px: los dos campos uno
    debajo del otro).
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: Implementar.** Los topes los pide la página al abrir «Cargar licencia» con «Horas a favor», al elegir ese tipo y
  300 ms después de cambiar la fecha (`ESPERA_DEL_CALCULO`), con un número de pedido en `pagina.pedidos` para descartar lo viejo;
  mientras llegan, los campos de horas quedan deshabilitados. El modo de dos campos va con `topes.acumuladas > 0` o con una carga
  que se corrige que ya tenía `horas_acumuladas`. `valoresDelFormulario` lee, en ese modo, `horas` (la suma) y
  `horas_acumuladas`; `pintarMostrar` usa ese total; el campo de los errores de `horas` es `ml-horas-del-mes` en ese modo (como
  `controlDelCampo` de los eventos). Los estilos, `.me-dos-horas` (dos columnas; una en 640 px), con los tokens `--sg-*`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit y push.**

---

## Task 8: La documentación (simple → Sonnet, alto)

**Files:** `CLAUDE.md` (la base de datos, «Mi espacio: licencias y horas extras», la convención de `mi-espacio.js`, la nota en
Word y el despliegue) y `README.md` si nombra el uso autorizado de contrato o las horas no utilizadas.

- [ ] Describir lo nuevo con el estilo de `CLAUDE.md`: la columna y su migración (el orden, obligatoria antes del código, la
  vuelta atrás), la cuenta sin años de contrato, los dos campos y los topes con su ruta, la carga tarde, el arreglo del «Te quedan
  0», los textos de la tarjeta y de la nota, y `VERSION_MI_ESPACIO` en `'20261221'`. Lo de planta, sin cambios.
- [ ] Commit y push.

---

## Después de las tareas (el controlador)

- [ ] La revisión de toda la rama (Opus, alto o extra), con la spec y este plan.
- [ ] Traer main a la rama (si se movió: leer lo nuevo con agentes y ajustar antes de seguir) y `npm test` completo con el
  candado.
- [ ] Merge en main y push; el kit `C:\Users\Mariano\Desktop\RPAD-deploy-mi-espacio-horas-acumuladas` con `PASOS.txt` (el SQL
  primero; va después del kit de los días restituidos) y los archivos verificados byte a byte contra `git diff`.
- [ ] Antes de borrar el worktree, sacar el junction de `node_modules` (memoria `junction-node-modules-antes-de-borrar-worktree`).
