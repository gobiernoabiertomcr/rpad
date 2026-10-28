# Mi espacio: la licencia anulada en Configuración y las licencias de otro año — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que anular en Configuración → Licencias una licencia cargada desde Mi espacio la borre también de Mi espacio, que
Mi espacio marque para revisar lo que en Configuración quedó distinto, y que una licencia de otro año se encuentre.

**Architecture:** la baja de la fila de Mi espacio va en la transacción de la anulación de Configuración
(`controllers/licenciasController.js` + un ayudante nuevo en `services/miEspacioPaso.js`), nunca en `anularLicenciaDe`. Lo
de «para revisar» sale de las reglas puras del vínculo (`services/miEspacioReglas.js`) y lo arma el Resumen
(`services/miEspacioResumen.js`); la página (`public/js/mi-espacio.js`) solo dibuja lo que manda el servidor.

**Tech Stack:** Node 22, Express 4 (ESM), MariaDB (mysql2/promise), front vanilla JS, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-28-mi-espacio-licencia-anulada-design.md` (leerla entera antes de cada tarea; las
secciones 2 y 3 son las decisiones). Las convenciones del repo están en `CLAUDE.md` («Mi espacio: licencias y horas
extras», la convención de `mi-espacio.js`, «Configuración»).

## Global Constraints

- El repo es público: en tests, comentarios y textos, solo nombres inventados. Nunca un nombre real ni datos del dump.
- Ningún email real; nunca llamar a `/api/cron/*`. Los tests de Docker usan su propia base (`rpad_test_*`); la base del
  `.env` de este worktree es `rpad_rama_licencia_anulada` (la copia del dump de esta sesión): no la tocás a mano.
- Español en variables, comentarios y UI. ES Modules, arrow functions, `async/await`, SQL siempre parametrizado con `?`.
- Respuestas `{ success, data?, error?, campo?, message? }`. Toda escritura de varias tablas, en una transacción.
- Ruling 19: los textos los arma el servidor; la página no recalcula reglas ni fechas. Todo texto del servidor pasa por
  `esc` (`Utils.escapeHtml`) en la página, también en los `aria-label`; un número va con `String`.
- Nunca el tipo de una licencia fuera del panel de su dueña (la confirmación de Configuración y los avisos no lo dicen).
- Nunca «Administración» en un texto cuando no se sabe quién hizo el cambio.
- Un aviso para revisar nunca frena una carga ni una corrección (no va en `calculo.faltantes`).
- Textos fijos, al pie de la letra (son los de la spec y este plan):
  - `TEXTO_SE_BORRA_DE_MI_ESPACIO` = `'Se cargó desde Mi espacio: también se borra de ahí.'`
  - mensajes de la anulación: `'Licencia anulada'` (sin fila de Mi espacio), `'Licencia anulada. También se borró de Mi espacio.'`,
    `'Licencia anulada. En Mi espacio ya había empezado: queda allá para que la persona la revise.'`
  - `TEXTO_ANULADA_EN_CONFIGURACION` = `'Se anuló en Configuración: acá sigue contando. Si ya no va, borrala.'` (reemplaza a
    `TEXTO_ANULADA_POR_ADMINISTRACION`, que se va)
  - `textoRevisalaEnConfiguracion(desde, hasta)` = `` `En Configuración quedó del ${diaYMes(desde)} al ${diaYMes(hasta)}: revisala.` ``
  - Resumen, `textoParaRevisar` (con `fechas` = `textoDeLasFechas(fila.desde, fila.hasta)` de la lista, «04/01 al 15/01/2027»):
    - `'fechas'`: `` `Revisá tu licencia del ${fechas}: en Configuración quedó del ${diaYMes(desde)} al ${diaYMes(hasta)}.` ``
    - `'anulada'`: `` `Revisá tu licencia del ${fechas}: se anuló en Configuración y acá sigue contando.` ``
    - `'sin_cubrir'`: `` `Revisá tu licencia del ${fechas}: ya no está cubierta en Configuración del ${diaYMes(desde)} al ${diaYMes(hasta)}.` ``
    - el link: `` `Ver en Licencias de ${anio}` ``
  - otros años: `` `También tenés ${n} licencia cargada en ${anio}.` `` (n = 1) / `` `También tenés ${n} licencias cargadas en ${anio}.` ``
  - segundo paso: `` `Está en la lista de ${anio}.` `` (solo si ese año no es el de hoy)
- Versiones: `VERSION_MI_ESPACIO` `'20261214'` → `'20261215'` (en `public/mi-espacio.html` y `tests/paginas.test.js`);
  `VERSION_PANTALLAS` `'20261210'` → `'20261211'` (el `usuarios.js?v=` de `public/configuracion.html` y `tests/paginas.test.js`).
- Tests: TDD. Un archivo suelto con `node --test --test-concurrency=1 tests/<archivo>.test.js`, solo si no hay otro
  `node --test` corriendo; la suite completa con
  `"/c/Users/Mariano/AppData/Local/Temp/claude/C--git-rpad--claude-worktrees-mi-espacio-licencias-fc16d6/3370f6ec-4b64-4b1d-bc75-4c6fba9de03e/scratchpad/suite.sh" <etiqueta>`
  (toma el candado `C:\Users\Mariano\.rpad-suite.lock`; si dice OCUPADO, esperá y volvé a intentar). La de base dio 6584
  tests, 6583 pasan, 1 omitido. Al terminar cada tarea, la suite completa en verde.
- Commits chicos, con el cuerpo en español y la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Una corrección de Mi espacio de la fila que Configuración acaba de anular (dos pestañas abiertas): la corrección y el
   borrado tienen que dar el 404 «Licencia no encontrada», nunca un 500 ni revivirla. (Test en la tarea 1.)
2. Una licencia de Configuración con varias filas de Mi espacio que la apuntan (una creada y unidas): solo se da de baja la
   creada que todavía no empezó; las unidas quedan, con «Ya no está cubierta…». (Test en la tarea 1.)
3. Una anulación que no se puede (el 409 de una que ya empezó) o que falla después de la baja: Mi espacio queda como estaba
   (la baja va en la misma transacción). (Test en la tarea 1.)
4. Una creada anulada de antes que ya terminó, o una fecha cambiada cuya licencia de Configuración ya terminó: la fila lo
   dice, pero el Resumen no avisa (no se puede resolver). (Test en la tarea 2.)
5. Guardar desde el Resumen una licencia de 2027 con la pestaña Licencias sin abrir: al abrirla, muestra 2027; una del año en
   curso pide la lista sin `?anio=` (con el reloj del teléfono adelantado, el año del teléfono daría otra cosa). (Test en la
   tarea 4.)

---

### Task 1: Anular en Configuración borra también en Mi espacio

**Files:**
- Modify: `services/miEspacioPaso.js` (nueva `bajaPorLaAnulacion`)
- Modify: `services/licenciasReglas.js` (nueva `mensajeDeLaAnulacion` y `TEXTO_SE_BORRA_DE_MI_ESPACIO`)
- Modify: `controllers/licenciasController.js` (`anularLicencia`, líneas ~264-299)
- Modify: `public/js/usuarios.js` (`anularLicencia`, ~906-916; nueva `textoDeLaAnulacion`), `public/configuracion.html`
  (`usuarios.js?v=`), `tests/paginas.test.js` (`VERSION_PANTALLAS`)
- Test: `tests/licencias-api.test.js`, `tests/mi-espacio-api.test.js`, `tests/licencias-reglas.test.js`,
  `tests/usuarios-frontend.test.js`

**Interfaces:**
- Produces: `bajaPorLaAnulacion(conexion, { licenciaOficialId: number, hoy: 'AAAA-MM-DD' }) → Promise<{ borradas: number, quedan: number }>`
  (`borradas`: filas de `mi_espacio_licencias` con `licencia_oficial_id = ?`, `oficial = 'creada'`, `activo = 1` y
  `desde >= hoy`, que pasa a `activo = 0` con un solo `UPDATE`; `quedan`: las creadas activas que siguen apuntándola, las que
  empezaron antes de hoy). `mensajeDeLaAnulacion({ borradas, quedan }) → string` (pura: con `quedan > 0`, el tercer mensaje;
  si no, con `borradas > 0`, el segundo; si no, `'Licencia anulada'`). `textoDeLaAnulacion(licencia) → string` en
  `usuarios.js` (pura: `` `¿Anular la licencia de ${l.usuario_nombre} (${textoPeriodo(l).toLowerCase()})?` `` y, si
  `desde_mi_espacio` es verdadero (true o 1), `' ' + TEXTO_SE_BORRA_DE_MI_ESPACIO`; texto plano para `confirm`).

- [ ] **Step 1: Tests de las reglas puras** — en `tests/licencias-reglas.test.js`: `mensajeDeLaAnulacion` con
  `{ borradas: 0, quedan: 0 }` → `'Licencia anulada'`; `{ borradas: 1, quedan: 0 }` → el segundo; `{ borradas: 0, quedan: 1 }`
  y `{ borradas: 1, quedan: 1 }` → el tercero; sin argumentos o con basura, `'Licencia anulada'` (nunca tira). Correr y ver
  que fallan.
- [ ] **Step 2: Tests de la API** — en `tests/mi-espacio-api.test.js`, reemplazar el test «administración la anula en
  Configuración: la fila lo dice y una corrección no la toca» por:
  - «anularla en Configuración la borra de Mi espacio, la anule otra persona o la misma»: una médica futura de `adminA` →
    `POST /usuarios/licencias/:id/anular` como `adminB` → 200 con `message` `'Licencia anulada. También se borró de Mi espacio.'`;
    la fila con `activo` 0 (`vinculosDe`); no aparece en `GET /mi-espacio/licencias?anio=` de su año, ni en
    `GET /mi-espacio/eventos` de ese rango (`licencias`), ni en lo que ve `adminB` como compañero (`ausentes`); y el
    Resumen la deja de descontar (unas vacaciones futuras: `titular.cifra` vuelve al valor de antes de cargarlas). Lo mismo
    anulándola `adminA` (la dueña).
  - «una corrección o un borrado de Mi espacio después de la anulación da 404»: `PUT` y `DELETE /mi-espacio/licencias/:id`
    → 404 `{ success: false, error: 'Licencia no encontrada' … }` (el cuerpo exacto que ya da `noEncontrada()`).
  - «la anulación que no se puede no toca Mi espacio»: una que empezó antes de hoy → 409 de siempre, la fila sigue `activo` 1.
  - «si en Mi espacio ya empezó, queda para revisar»: una creada de Mi espacio que empezó antes de hoy cuya licencia de
    Configuración se movió por SQL a empezar mañana → anular → 200 con el tercer mensaje; la fila sigue `activo` 1 y la lista
    dice `{ texto: TEXTO_ANULADA_EN_CONFIGURACION, insignia: 'aviso' }` (la constante la crea la tarea 2: si esta tarea va
    primero, el test compara con `'Se anuló en Configuración: acá sigue contando. Si ya no va, borrala.'` escrito a mano y la
    tarea 2 lo pasa a la constante).
  - «una unida no se toca»: la licencia de Configuración de `adminB` con una fila unida de Mi espacio → anular → 200 con
    `'Licencia anulada'`; la unida sigue `activo` 1.
  - «una corrección de Mi espacio que anula la de Configuración deja la fila activa» (Review Focus, regresión): una franquicia
    de 7 h futura corregida a 3 h → la de Configuración `anulada` 1 y la fila `activo` 1 (si ya hay un test así, alcanza con
    sumarle la aserción de `activo`).
  En `tests/licencias-api.test.js`, el test «la trae la que creó Mi espacio, mientras esa fila esté activa…»: después de
  anular `creada`, `desde_mi_espacio` pasa a `false` en la respuesta y en `?incluir_pasadas=1`, y el `message` es
  `'Licencia anulada. También se borró de Mi espacio.'`; la fila `creada` de `mi_espacio_licencias` queda `activo` 0 (sus
  filas las arma `deMiEspacio` con `desde` y `hasta` de la licencia: futuras). Correr: fallan.
- [ ] **Step 3: Test de la página de Configuración** — en `tests/usuarios-frontend.test.js`: `textoDeLaAnulacion` con
  `desde_mi_espacio` true, 1, false, 0 y sin la clave (el texto con y sin la segunda oración), y con un nombre con `<b>` (es
  texto plano: va tal cual, sin escapar, porque lo muestra `confirm`). Correr: falla.
- [ ] **Step 4: Implementar** `mensajeDeLaAnulacion` y `TEXTO_SE_BORRA_DE_MI_ESPACIO` en `services/licenciasReglas.js`;
  `bajaPorLaAnulacion` en `services/miEspacioPaso.js` (con un comentario que diga por qué no va en `anularLicenciaDe`: la usa
  también `aplicarCorreccion`, que necesita la fila activa); en `anularLicencia` del controlador, después de un
  `anularLicenciaDe` sin rechazo y antes del `commit`, `const mi = await bajaPorLaAnulacion(conexion, { licenciaOficialId: id, hoy })`,
  y la respuesta con `message: mensajeDeLaAnulacion(mi)`. En `usuarios.js`, `textoDeLaAnulacion` (con
  `TEXTO_SE_BORRA_DE_MI_ESPACIO` copiado y su test de paridad contra el de `services/licenciasReglas.js`, como las demás
  copias de `usuarios.js`) y `anularLicencia` la usa en el `confirm`. Subir `VERSION_PANTALLAS`.
- [ ] **Step 5: Correr** los cuatro archivos de test: pasan.
- [ ] **Step 6: Suite completa** con `suite.sh tarea1`: 0 fallas.
- [ ] **Step 7: Commit** — `fix(licencias): anular en Configuración borra también la de Mi espacio`.

### Task 2: Las reglas del vínculo: «para revisar» y la creada anulada de antes

**Files:**
- Modify: `services/miEspacioReglas.js` (constantes de los textos, `textoDelVinculo` ~1760-1785, nueva `revisionDelVinculo`,
  `vinculosDeLaLista` ~1915-1938)
- Test: `tests/mi-espacio-reglas.test.js` (constantes ~224, `vinculoDe`/`textoDelVinculo` ~2770-2830, `vinculosDeLaLista`),
  `tests/mi-espacio-api.test.js` (el import de la constante)

**Interfaces:**
- Consumes: `vinculoDe(fila, oficial, tocadaPorOtros)` (sin cambios), `esDiaEntero`, `diaYMes`.
- Produces:
  - `TEXTO_ANULADA_EN_CONFIGURACION` (exportada; se borra `TEXTO_ANULADA_POR_ADMINISTRACION` y se cambian sus usos).
  - `textoRevisalaEnConfiguracion(desde, hasta) → string` (exportada).
  - `revisionDelVinculo(vinculo, fila, { sinPasar, puedeTener, hoy }) → null | { motivo: 'fechas' | 'anulada' | 'sin_cubrir', desde: string | null, hasta: string | null }` (pura, nunca tira):
    - `'fechas'` (`desde`/`hasta` = las de Configuración): estado `'creada'` o `'creada_cambiada'`, `motivoDe(sinPasar)` null,
      `esDiaEntero(fila)`, `puedeTener === true`, la de Configuración con `desde` o `hasta` distintos de los de la fila y
      `oficial.hasta >= hoy`;
    - `'anulada'` (`desde`/`hasta` null): estado `'creada_anulada'` y `fila.hasta >= hoy`;
    - `'sin_cubrir'` (`desde`/`hasta` = `vinculo.sin_cubrir`): estado `'unida_sin_cubrir'` y `fila.hasta >= hoy`;
    - si no, null (también sin `hoy` válido).
  - `textoDelVinculo`, rama `'creada'`: si `motivoDe(sinPasar)` no es null, como hoy; si no es de día entero, como hoy; si
    `puedeTener === true` y las fechas de Configuración difieren de las de la fila, `aviso(textoRevisalaEnConfiguracion(oficial.desde, oficial.hasta))`;
    si no, `TEXTO_TAMBIEN_EN_CONFIGURACION`. Rama `'creada_anulada'`: `aviso(TEXTO_ANULADA_EN_CONFIGURACION)`. Las demás, igual.
  - Cada entrada de `vinculosDeLaLista` suma `revision` (lo de `revisionDelVinculo`, con el `hoy` de las opciones).

- [ ] **Step 1: Tests** — en `tests/mi-espacio-reglas.test.js`: la constante nueva al pie de la letra; `textoDelVinculo` de
  una creada con fechas iguales (`TEXTO_TAMBIEN_EN_CONFIGURACION`), con fechas distintas (`textoRevisalaEnConfiguracion`, con
  `insignia: 'aviso'`), con fechas distintas y `puedeTener: false` (`TEXTO_TAMBIEN_EN_CONFIGURACION`), con `sinPasar` (el
  texto de hoy) y una que dejó de ser de día entero (el de hoy); la creada anulada (`TEXTO_ANULADA_EN_CONFIGURACION`).
  `revisionDelVinculo`: cada motivo con su `desde`/`hasta`; null en una creada con fechas iguales, con `sinPasar`, sin día
  entero, sin `puedeTener`, con la de Configuración ya terminada (`oficial.hasta < hoy`), en una anulada o una unida sin
  cubrir que ya terminaron (`fila.hasta < hoy`), en `'unida'` y `'ninguno'`, y con entradas basura (sin tirar). Que
  `vinculosDeLaLista` lleve `revision`. Los tests que comparaban con `TEXTO_ANULADA_POR_ADMINISTRACION` (también en
  `tests/mi-espacio-api.test.js`) pasan a la constante nueva. Correr: fallan.
- [ ] **Step 2: Implementar** en `services/miEspacioReglas.js` (actualizar el JSDoc de `textoDelVinculo` y de
  `vinculosDeLaLista`, y el comentario de `vinculoDe` que decía «la haya anulado quien la haya anulado»: ahora una anulación
  de Configuración borra la creada, salvo la que ya empezó en Mi espacio; las creadas anuladas son las de antes de este
  cambio o esa).
- [ ] **Step 3: Correr** `tests/mi-espacio-reglas.test.js` y `tests/mi-espacio-api.test.js`: pasan.
- [ ] **Step 4: Suite completa** (`suite.sh tarea2`): 0 fallas.
- [ ] **Step 5: Commit** — `feat(mi-espacio): las licencias que quedaron distintas en Configuración, para revisar`.

### Task 3: El servidor: el Resumen, la lista y el segundo paso

**Files:**
- Modify: `services/miEspacioResumen.js` (`resumenDe` ~410-472, `tanqueDeVacaciones`/`bajadaDe` ~173-258,
  `filasDeLicencias` ~626-671, nuevas `paraRevisarDe`, `otrosAniosDe`, `textoDeLaListaDe`)
- Modify: `controllers/miEspacioController.js` (`verResumen` ~103-115, `verNotaDeLicencia` ~414-428)
- Test: `tests/mi-espacio-resumen.test.js`, `tests/mi-espacio-api.test.js`

**Interfaces:**
- Consumes: de la tarea 2, `vinculosDeLaLista` con `revision`; `vinculosDe(persona, estado, hoy)` de
  `services/miEspacioPaso.js` (sin cambios).
- Produces (lo que dibuja la tarea 4):
  - `resumenDe({ …, vinculos })` suma `para_revisar: [{ licencia_id, anio, texto, enlace }]` (en todas sus salidas; `[]`
    sin vínculos, sin modalidad o sin arranque): una entrada por fila activa del estado con `revision` no nula en `vinculos`,
    ordenadas por `desde` y después por id; `anio` = año de `fila.desde`; `texto` y `enlace` con los textos fijos de Global
    Constraints. Lo arma `paraRevisarDe(estado, vinculos)` (exportada para el test).
  - `titular.bajada`: la oración de lo cargado (la capa `'cargadas'`) suma `anio`: el año del primer mes de `mesesCargados`
    (un número); las demás oraciones no tienen `anio`.
  - `filasDeLicencias` suma `otros_anios: [{ anio, cantidad, texto }]`, de `otrosAniosDe(licencias, { anio, anios, hoy })`
    (exportada): las filas que pasan `esFilaDeLaLista`, que no tocan el año que se muestra, con `hasta >= hoy`, contadas en el
    año de su `desde` si ese año está en `anios`; ordenadas por año; `[]` si no hay o si el año que se muestra es null.
  - `GET /mi-espacio/licencias/:id/nota` suma `lista`: `textoDeLaListaDe(fila.desde, hoy)` →
    `` `Está en la lista de ${anio}.` `` si el año de `desde` no es el de `hoy`; si no (o si algo no es una fecha), null.
  - `verResumen` pide `vinculosDe(persona, estado, hoy)` y se lo pasa a `resumenDe` (en paralelo con lo que ya pide).

- [ ] **Step 1: Tests puros** — en `tests/mi-espacio-resumen.test.js`, con los casos de `tests/fixtures/mi-espacio-casos.js`:
  `paraRevisarDe` (cada motivo con su texto exacto, el orden, el `anio` de una del 28/12/2026 al 08/01/2027 → 2026, filas
  sin revisión no van, vínculos que no son un Map → `[]`); `resumenDe` con `para_revisar` (y `[]` sin arranque); la oración
  de lo cargado con `anio` (vacaciones cargadas en noviembre de 2026 y enero de 2027 → 2026; solo en enero → 2027) y las
  otras sin `anio`; `otrosAniosDe` (viendo 2026, una de enero de 2027 → `[{ anio: 2027, cantidad: 1, texto: 'También tenés 1 licencia cargada en 2027.' }]`;
  dos → plural; una que cruza de 2026 a 2027, nada; una terminada de 2025, nada; una de 2027 a 2028 viendo 2026 → solo en
  2027; un año fuera de `anios`, nada; un uso autorizado y una de la otra modalidad, cuentan); `textoDeLaListaDe`
  (mismo año → null, otro → el texto, basura → null). Correr: fallan.
- [ ] **Step 2: Tests de la API** — en `tests/mi-espacio-api.test.js`: `GET /mi-espacio/resumen` de una creada cuya licencia
  de Configuración se movió por SQL (`UPDATE usuarios_licencias SET hasta = …`) trae su entrada en `para_revisar` con el texto
  exacto, y la fila de la lista dice `textoRevisalaEnConfiguracion` (la cambió la dueña: sin auditoría de otro actor); al
  corregir la de Mi espacio a esas fechas, `para_revisar` vuelve a `[]`; `GET /mi-espacio/licencias` sin `anio` trae
  `otros_anios` con una del año siguiente; `GET …/nota` de una del año siguiente trae `lista` y de una del año en curso,
  `null`. Correr: fallan.
- [ ] **Step 3: Implementar** en `services/miEspacioResumen.js` y `controllers/miEspacioController.js` (actualizar los JSDoc
  de `resumenDe`, `filasDeLicencias` y los comentarios de las rutas).
- [ ] **Step 4: Correr** los dos archivos: pasan.
- [ ] **Step 5: Suite completa** (`suite.sh tarea3`): 0 fallas.
- [ ] **Step 6: Commit** — `feat(mi-espacio): para revisar, otros años y el año de la lista en el servidor`.

### Task 4: La página de Mi espacio

**Files:**
- Modify: `public/js/mi-espacio.js` (`htmlDeFaltantes` ~175, `htmlDeLaFrase` ~196-210, `htmlDeListaDeLicencias` ~490-505,
  `htmlDelSegundoPaso` ~1057, `mostrarPestana` ~2217, `alTocarResumen` ~2359, el clic de la lista ~2490, `volverAPedirTodo`
  ~3063, `guardarLicencia` ~3418, `pedirLaNotaDelSegundoPaso`)
- Modify: `public/mi-espacio.html` (`mi-espacio.js?v=` y, si hace falta, los estilos del link de la bajada, de los avisos y de
  «otros años», en su `<style>`, con los tokens `--sg-*` que ya hay), `tests/paginas.test.js` (`VERSION_MI_ESPACIO`)
- Test: `tests/mi-espacio-frontend.test.js`, `tests/paginas.test.js`

**Interfaces:**
- Consumes: de la tarea 3, `resumen.para_revisar`, la oración de la bajada con `anio`, `licencias.otros_anios` y
  `nota.lista`.
- Produces (todo en `mi-espacio.js`, lo puro primero, como el resto del archivo):
  - `htmlDeFaltantes(faltantes, paraRevisar)`: el mismo aviso ámbar; los faltantes como hoy y después cada entrada de
    `paraRevisar` como `<li>texto <a href="#licencias" data-pestana="licencias" data-anio-licencias="AAAA">enlace</a></li>`;
    sin ninguna de las dos, `''`. `htmlDelResumen` le pasa `resumen.para_revisar`.
  - `htmlDeLaFrase`: una oración con `anio` entero va como `<a href="#licencias" data-pestana="licencias" data-anio-licencias="AAAA" class="me-frase-link">texto</a>`
    (la que vence sigue en `<b class="vence">`).
  - `htmlDeListaDeLicencias`: debajo de la cabeza, cada `otros_anios` como un `<p class="me-otros-anios">` con el texto y un
    `<button type="button" data-anio="AAAA">Ver AAAA</button>` (el `data-anio` del selector: lo atiende el clic de siempre).
  - `htmlDelSegundoPaso({ …, lista })`: `lista` (texto del servidor, escapado) en un `<p class="me-paso-dos-lista">` después
    de la licencia guardada; sin `lista`, nada.
  - `anioDeLaLicencia(desde) → number | null` (el año de un `'AAAA-MM-DD'`; si no, null).
  - Estado nuevo `pagina.anioDeLicencias` (number | null): el año que la lista tiene que mostrar la próxima vez que se pida.
    `guardarLicencia`, con un 2xx (los dos formularios, licencia y uso autorizado), lo pone con `anioDeLaLicencia(cuerpo.desde)`
    antes de `volverAPedirTodo`/`pasarAlSegundoPaso`. `volverAPedirTodo` y `mostrarPestana('licencias')` piden la lista con
    `pagina.anioDeLicencias` (si es null o el de hoy, `cargarLicencias(null)`) y lo vuelven a null.
  - `irALicencias(anio)`: abre la pestaña Licencias en ese año (si la lista ya muestra otro, la pide de nuevo) y el foco va a la
    pestaña. `alTocarResumen` la usa para un `[data-pestana="licencias"][data-anio-licencias]` (con los modificadores y el
    botón no principal, el link hace lo suyo, como los demás).

- [ ] **Step 1: Tests puros** — en `tests/mi-espacio-frontend.test.js`: `htmlDeFaltantes` con faltantes y `para_revisar`
  (los dos, solo uno, ninguno → `''`; textos con `<script>` escapados también en el link; un `anio` que no es entero no
  dibuja el link); `htmlDeLaFrase` con la oración con `anio` (el link y su `data-anio-licencias`) y sin él; la lista con
  `otros_anios` (el texto escapado y el botón `data-anio`); `htmlDelSegundoPaso` con y sin `lista`; `anioDeLaLicencia`
  (`'2027-01-04'` → 2027, `'2027-1-4'`, `null`, `5` → null). Correr: fallan.
- [ ] **Step 2: Tests con el DOM y el fetch falsos** (los de la tarea van con los ayudantes que ya tiene el archivo):
  guardar una licencia de 2027 con la pestaña Licencias abierta en 2026 pide `/mi-espacio/licencias?anio=2027`; guardarla
  desde el Resumen con la pestaña sin abrir y después abrirla pide `?anio=2027` (Review Focus 5); una del año en curso pide
  `/mi-espacio/licencias` sin `anio`; el segundo paso muestra `lista`; el link de la bajada y el de un aviso para revisar
  abren Licencias en su año, con el foco en la pestaña; el botón de `otros_anios` pide ese año. Correr: fallan.
- [ ] **Step 3: Implementar** en `public/js/mi-espacio.js` (actualizar el comentario de cabecera y los de las funciones que
  cambian) y los estilos en `public/mi-espacio.html` (el link de la bajada con el color de la frase, subrayado; contraste
  ≥ 4,5:1 sobre `--sg-cielo`; foco visible como el resto); subir `VERSION_MI_ESPACIO`.
- [ ] **Step 4: Correr** `tests/mi-espacio-frontend.test.js` y `tests/paginas.test.js`: pasan.
- [ ] **Step 5: Suite completa** (`suite.sh tarea4`): 0 fallas.
- [ ] **Step 6: Commit** — `feat(mi-espacio): encontrar una licencia de otro año y los avisos para revisar`.

### Task 5: La documentación

**Files:**
- Modify: `CLAUDE.md` («Configuración»: la anulación y la insignia; «Mi espacio: licencias y horas extras»: el paso a
  Configuración —«si la anuló, queda solo en Mi espacio» pasa a la regla nueva, con 3b—, «para revisar», otros años y el
  año de la lista; la convención de `mi-espacio.js` y de `usuarios.js`: las funciones nuevas y las versiones; «Tests»),
  `README.md` (una entrada en «Changelog», arriba de «Feriados en las Notas Digitales y los recordatorios», con el
  despliegue: sin SQL, los archivos y Restart, después del kit de Feriados en las notas)
- Test: ninguno nuevo (la suite completa)

- [ ] **Step 1: Escribir** los cambios en `CLAUDE.md` y `README.md`, con el mismo tono y nivel de detalle que lo que los
  rodea (sin nombres reales).
- [ ] **Step 2: Suite completa** (`suite.sh tarea5`): 0 fallas.
- [ ] **Step 3: Commit** — `docs: la licencia anulada en Configuración y las licencias de otro año`.
