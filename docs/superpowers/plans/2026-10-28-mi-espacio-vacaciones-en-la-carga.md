# Mi espacio: las vacaciones al cargar una licencia — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el modal, el Resumen, «Vence pronto» y el email digan lo que de verdad se puede hacer con las vacaciones y la franquicia, sin cambiar la regla del reparto ni la de «Perdés».

**Architecture:** todo se calcula en las reglas puras (`services/miEspacioReglas.js`, `services/miEspacioResumen.js`) y viaja en lo que ya devuelve el servidor (`vista` del cálculo, `resumen`, `textos_mitades`, los campos del saldo); la página solo dibuja campos nuevos. Sin SQL.

**Tech Stack:** Node 22 ESM, `node:test`, MariaDB (Docker) para los tests de API, vanilla JS en un `vm` para la página.

**Spec:** `docs/superpowers/specs/2026-10-28-mi-espacio-vacaciones-en-la-carga-design.md` (leerla entera antes de cada tarea; las secciones se citan como «spec 3.1»).

## Global Constraints

- La regla del reparto y la de «Perdés» de las vacaciones NO cambian (spec 2). Ningún test existente de `repartoDeVacaciones` ni de `textoDePerdidos` cambia sus números.
- Ningún aviso nuevo frena un guardado: `evaluarLicencia` solo devuelve `error` en los casos de hoy.
- Ruling 19: el navegador no recalcula; los textos los arma el servidor y `mi-espacio.js` los imprime escapados (`Utils.escapeHtml`, un número con `String`).
- Fechas como texto `'AAAA-MM-DD'`; nada de `Date` local en las reglas.
- Repo público: nombres inventados en tests y docs (antes de cada commit, `node <scratchpad>/revisar-nombres.mjs` sobre el diff preparado: tiene que decir «sin nombres»).
- `npm test` completo antes y después de cada tarea, con el candado `%USERPROFILE%\.rpad-suite.lock` (la suite de integración usa bases de nombre fijo). Todos los subagentes con Opus.
- Sin SQL, sin cron, sin variables de entorno, sin npm. `VERSION_MI_ESPACIO` sube una vez (Task 9).
- La base local `datospublicos_mcr_rpad` no se escribe; ningún email real; nunca `/api/cron/*`.

## Review Focus

- El alcance de spec 3.1 tiene que ser exactamente el «Hasta» más lejano que se guarda: un test por fuerza bruta (probar cada «Hasta» día por día con `evaluarLicencia`) en varios estados, incluido uno con otra carga posterior que se queda corta (Task 2).
- Una corrección (con `editadaId`) no tiene que ver su propia carga como «otra carga» que se queda corta ni avisar que se reacomoda a sí misma (Tasks 3 y 5).
- El cambio de año: el 1/10, el 31/12, el 1/1 y el 1/7 (las mitades, la franquicia, el ámbar), con la franquicia ya en 0 el 1/1 del año siguiente (Tasks 4, 7).
- Persona de contrato: nada de franquicia (ni «Vence pronto», ni email, ni aviso); sus horas a favor sí siguen 3.2 y 3.7 (Tasks 4, 5, 6).
- Un día libre es un día hábil con los feriados de la tabla y fuera de toda licencia de Mi espacio de cualquier tipo y modalidad (las `ocupadas` de `calcular`), también para la franquicia y el franco (Tasks 4, 5).

---

### Task 1: Leer el main del pase y ajustar el plan

**Files:** ninguno del producto. Modify: este plan, si algo cambió.

- [ ] **Step 1:** Con el hash que pasa la coordinadora (el merge de «Métricas: Redacción y entrega de la nota», que viene después del de «una agenda con más onda»), traer main a la rama (`mcp__ccd_host__sync_with_base_branch`; si el worktree no es de la app, `git merge <hash>`).
- [ ] **Step 2:** Crear el junction de `node_modules` hacia `C:\git\rpad\node_modules` y el `.env` del worktree (copia del local con `DB_NAME` de la rama); anotar ambos para quitarlos al cerrar.
- [ ] **Step 3:** Releer en el main nuevo `services/miEspacioReglas.js` (`repartoDeVacaciones`, `textoDelReparto`, `evaluarLicencia`, `vistaDe`, `problemaDeLaCarga`, `faltantesDe`, `avisosDeVencimiento`, `camposDelSaldoInicial`), `services/miEspacioResumen.js` (`venceProntoDe`, `tanqueDeVacaciones`, `bajadaDe`, `quedaDelTipo`, `mesesCargados`, el formato de días de la fila de la lista) y en `public/js/mi-espacio.js` `htmlDelCalculo`, `pintarCalculo`, `htmlDeVencePronto`, `htmlDeLaRegla`, `htmlDelResto` y el modal de saldos. La agenda con más onda toca `mi-espacio.js`, `mi-espacio.html` y el Resumen («Próximos», «Hoy y mañana»): ajustar nombres y lugares de este plan si cambiaron.
- [ ] **Step 4:** `npm test` completo con el candado. Anotar el total (pasan / fallan / omitidos) como línea de base.
- [ ] **Step 5:** Commit del plan ajustado (si cambió): `docs(mi-espacio): ajusta el plan de las vacaciones al main de …`.

### Task 2: Lo por habilitar y el alcance de una carga (spec 3.1)

**Files:**
- Modify: `services/miEspacioReglas.js`
- Test: `tests/mi-espacio-reglas.test.js`

**Interfaces:**
- Produces:
  - `porHabilitarDe(ordinarias, hoy) → [{ fecha, anio, dias }]`: por cada ordinaria, su `por_habilitar` repartido en sus mitades que se habilitan después de hoy (lo ya asignado de más consume primero la mitad más temprana), solo entradas con `dias > 0`, ordenadas por fecha y después por año. Usa las `ordinarias` de `repartoDeVacaciones` tal cual.
  - `alcanceDeLaCarga(estado, fila, opciones) → 'AAAA-MM-DD' | null`: `opciones = { hoy, feriados, editadaId }`. El «Hasta» más lejano ≥ `fila.desde` tal que `evaluarLicencia(estado, { ...fila, hasta }, opciones)` no da error de días (`problemaDeLaCarga` null), sin pasar de `rangoDeFechas(hoy).hasta`. null si ni el primer día hábil desde `fila.desde` entra. Búsqueda binaria sobre los días corridos (la factibilidad no crece al alargar).
  - `textoDelReparto(reparto, filaId, extras)` suma un tercer parámetro opcional `extras = { habilitaciones: [{ fecha, anio, dias }], alcance: string | null, hasta: string | null }` (sin él, el texto de hoy, idéntico).
  - `vistaDe` (y por ende `evaluarLicencia`) pasa los `extras` en las vacaciones: `habilitaciones` = `porHabilitarDe(despues.reparto.ordinarias, hoy)` filtrado a fechas ≤ máx(`fila.hasta`, alcance); `alcance` = `alcanceDeLaCarga` solo si los disponibles de hoy quedan en 0 y el alcance es posterior a `fila.hasta`.

- [ ] **Step 1: Tests que fallan** (`describe('lo por habilitar y el alcance (spec 2026-10-28, 3.1)')`), con la persona de planta inventada de la spec (arranque 27/10/2026; saldo 15 de la 2024, 20 de la 2025, 10 de la 2026; 20 días en 2026; hoy 2026-10-28; la precarga de feriados de `tests/fixtures/feriados-precarga.js`):
  - `porHabilitarDe` sin cargas: `[{ fecha: '2027-01-01', anio: 2026, dias: 10 }, { fecha: '2027-07-01', anio: 2027, dias: 10 }, { fecha: '2028-01-01', anio: 2027, dias: 10 }]`.
  - Vacaciones del 2026-12-01 al 2027-02-05: `vista.texto_reparto === 'Salen de las licencias 2024 (15 días), 2025 (20 días) y 2026 (10 días), las más viejas. No te quedan días disponibles hoy. El 1/1/2027 se habilitan 10 más de la 2026: esta licencia puede llegar hasta el 24/02/2027.'`
  - Del 2026-12-01 al 2027-02-24: termina en `'… y 2026 (20 días), las más viejas. No te quedan días disponibles.'` (nada por habilitar hasta su hasta; sin alcance).
  - Del 2026-11-16 al 2026-11-30: `'Salen de la licencia 2024, la más vieja. Te quedan 35 días: 5 de la 2024 (vencen el 31/12/2026), 20 de la 2025 y 10 de la 2026.'` (las fechas por habilitar quedan después de su hasta: no se nombran).
  - Una carga que llega al 1/7/2027 nombra las dos: `'… El 1/1/2027 se habilitan 10 más de la 2026 y el 1/7/2027, 10 de la 2027.'`
  - `alcanceDeLaCarga` contra fuerza bruta (probar cada hasta de `desde` a `rangoDeFechas(hoy).hasta` con `evaluarLicencia`) en: la persona sin cargas desde 2026-12-01 (`'2027-02-24'`); con otra carga guardada en marzo de 2027 que deja menos; con una corrección (`editadaId`); y un desde sin ningún día (`null`).
  - `textoDelReparto(reparto, id)` sin `extras` da exactamente lo de antes (los tests existentes no cambian).
- [ ] **Step 2:** `node --test tests/mi-espacio-reglas.test.js` → fallan los nuevos.
- [ ] **Step 3:** Implementar las tres funciones y el cambio de `vistaDe`. «No te quedan días disponibles hoy.» solo si hay alguna habilitación que nombrar; la oración de las habilitaciones: una fecha, `El 1/1/2027 se habilitan 10 más de la 2026.`; dos o más, `El A se habilitan N más de la X y el B, M de la Y.` (fechas con `fechaSinCeros`); con alcance, el punto final pasa a `: esta licencia puede llegar hasta el DD/MM/AAAA.`
- [ ] **Step 4:** `node --test tests/mi-espacio-reglas.test.js` → pasan todos.
- [ ] **Step 5:** Suite completa con el candado; commit `feat(mi-espacio): lo que se habilita después y hasta dónde llega una carga`.

### Task 3: Los errores de días dicen hasta dónde alcanza (spec 3.3)

**Files:** Modify `services/miEspacioReglas.js`; Test `tests/mi-espacio-reglas.test.js`.

**Interfaces:**
- Consumes: `alcanceDeLaCarga`, `porHabilitarDe` (Task 2).
- Produces: en `evaluarLicencia`, cuando el problema es de vacaciones (`clave` `vacaciones:<id>`), el error se reescribe así (Resumen y `faltantesDe` no cambian):
  - la que se queda corta es esta carga y su alcance ≥ desde: `{ campo: 'hasta', mensaje: 'No te alcanzan los días habilitados: esta licencia puede llegar hasta el 24/02/2027.' }`;
  - esta carga sin ningún día: `{ campo: 'desde', mensaje: 'No te alcanzan los días habilitados para el 21/06/2027.' }` y, si después de ese día hay una habilitación (de `porHabilitarDe`), `' El 1/7/2027 se habilitan 5 más de la 2027.'`;
  - es otra carga guardada (su id no es el de la fila ni `editadaId`): `{ campo: 'hasta', mensaje: 'Con estos días, a tus vacaciones del 04/01 al 22/01/2027 les faltan días desde el 20/01/2027.' }` (fechas como las de la lista: año solo al final si los dos son del mismo año; si no, los dos con año).
  - con ese error, `vista.texto_reparto` es '' (spec 3.3: solo los días).

- [ ] **Step 1: Tests que fallan:** los tres mensajes con sus campos; la persona de la spec del 2026-12-01 al 2027-02-26 da el primero con `'24/02/2027'` y `vista.texto_reparto === ''`, `vista.texto_dias === '57 días hábiles de 88 corridos'`; una persona inventada de contrato con 10 días por año (saldo 0/7/5, arranque 2026-10-28) con enero cargado (2027-01-04 al 2027-01-22) que pide 2026-12-14 al 2026-12-18 da el de otra carga con `'del 04/01 al 22/01/2027'` y `'desde el 20/01/2027'`; al corregir esa misma carga de enero alargándola, el mensaje es el de esta carga, nunca el de «otra».
- [ ] **Step 2:** correr → fallan.
- [ ] **Step 3:** Implementar en `evaluarLicencia` (después de `problemaDeLaCarga`), con un ayudante puro para las fechas de la otra carga.
- [ ] **Step 4:** correr → pasan (y los tests que esperaban `campo: 'desde'` con `textoSinHabilitados` en el modal se actualizan solo si eran del flujo de carga; los del Resumen no cambian).
- [ ] **Step 5:** Suite completa; commit `feat(mi-espacio): el error de días dice hasta dónde alcanza la licencia`.

### Task 4: La franquicia que vence (spec 3.6) y los días libres

**Files:** Modify `services/miEspacioReglas.js`, `services/miEspacioResumen.js`, `services/emailTemplates.js` (solo si el renglón lo necesita); Test `tests/mi-espacio-reglas.test.js`, `tests/mi-espacio-resumen.test.js`.

**Interfaces:**
- Produces:
  - `diasLibresEntre(desde, hasta, ocupadas, feriados) → number`: días hábiles (con los feriados) de `desde` a `hasta`, ambos incluidos, fuera de toda fila de `ocupadas` (`{ desde, hasta }`).
  - `franquiciaQueVence(estado, calculo, { hoy, feriados, ocupadas }) → { quedan, perdidas, disponibles } | null`: solo planta; `quedan` = 42 − usado − cargado del año de hoy (lo de `usoDeLosTopes`); `perdidas = max(0, quedan − 7 × diasLibresEntre(hoy, 31/12, ocupadas, feriados))`; `disponibles = quedan − perdidas`. null en contrato o sin modalidad.
  - `calcular` suma `franquicia` (lo de arriba, con las mismas `ocupadas` que el reparto).
  - `avisosDeVencimiento` suma `{ clave: 'franquicia-AAAA', texto: 'Tenés 22 horas de franquicia: vencen el 31/12/2026.' }` (con 1, «1 hora … vence»; media hora como `textoDeHoras`) desde el primer día hábil de diciembre hasta el 31/12, solo con `disponibles > 0`, después del franco y antes de la licencia.
  - Resumen: `venceProntoDe` suma desde el 1/10 `{ titulo: '22 horas de franquicia', texto: 'Vencen el jueves 31/12, en 64 días.', accion: { texto: 'Cargar franquicia', tipo: 'franquicia' } }` (con `disponibles`); en `tanques.otros`, la de `franquicia` suma `perdidas_texto: 'Perdés 8 horas (vencen el 31/12/2026).'` (o `''`).

- [ ] **Step 1: Tests que fallan:** `diasLibresEntre` con un feriado de la tabla, un fin de semana y una licencia de otra modalidad; `franquiciaQueVence` con 22 horas y 4 días libres (quedan 22, perdidas 0), con 2 días libres (perdidas 8), sin días libres (perdidas 22), en contrato (null); el renglón del email el 2026-12-01 y no el 2026-11-30 ni el 2027-01-01, y que no sale con `disponibles` 0; «Vence pronto» el 2026-09-30 sin la franquicia y el 2026-10-01 con ella (por fecha, con la licencia), en contrato nunca; `perdidas_texto` en «El resto».
- [ ] **Step 2:** correr los dos archivos → fallan.
- [ ] **Step 3:** Implementar. La clave `franquicia-AAAA` entra en `mi_espacio_avisos.clave` (`varchar(40)`): sin SQL.
- [ ] **Step 4:** correr → pasan.
- [ ] **Step 5:** Suite completa; commit `feat(mi-espacio): la franquicia se recuerda antes de que venza`.

### Task 5: Lo que una carga hace perder y las cargas que se reacomodan (spec 3.2 y 3.4)

**Files:** Modify `services/miEspacioReglas.js`; Test `tests/mi-espacio-reglas.test.js`.

**Interfaces:**
- Consumes: `diasLibresEntre`, `franquiciaQueVence` (Task 4).
- Produces: `vista.avisos: string[]` (siempre una lista; vacía si no hay nada), en este orden:
  1. Vacaciones (solo si la fila NO es de vacaciones): por cada ordinaria cuyo `perdidos` crece entre `antes` y `despues`, la diferencia: `'Con esta licencia perdés 3 de la 2024 (vencen el 31/12/2026).'` (varias con `enLista`, como `textoDePerdidos`).
  2. El franco (planta) o las horas a favor (contrato) de cada mes de uso, desde el de hoy, con disponibles > 0 en `antes`, que tenía algún día libre en su mes (todo el mes, también los días pasados) y en `despues` ninguno: `'Tu franco de diciembre se queda sin días libres: vence el 31/12/2026.'` (con 2, «Tus 2 francos de diciembre se quedan…»); `'Tus 3 horas a favor de diciembre se quedan sin días libres: vencen el 31/12/2026.'` (la fecha es el último día del mes).
  3. Franquicia: si `perdidas` crece, `'Con esta licencia perdés 8 horas de franquicia (vencen el 31/12/2026).'`.
  4. Reacomodo (al cargar y al corregir): por cada otra carga de vacaciones guardada cuyo `porFila` cambia entre `antes` y `despues`, en el orden de sus fechas: `'Esta carga cambia de dónde salen tus vacaciones del 04/01 al 22/01/2027: ahora de las licencias 2025 (5 días) y 2026 (10 días).'` (una sola licencia: `'ahora de la licencia 2025.'`). Nunca la propia (`editadaId`).
- Con un error de días (Task 3), `avisos` es `[]`.

- [ ] **Step 1: Tests que fallan:** la persona inventada con 3 de la 2024, hoy 2026-12-15, atención médica del 15/12 al 31/12 → `avisos` `['Con esta licencia perdés 3 de la 2024 (vencen el 31/12/2026).']` y el guardado sigue posible (`datos !== null`); unas vacaciones que cubren todo diciembre con un franco para diciembre → el del franco; una carga de diciembre que reacomoda enero y julio (la persona de contrato de Task 3: enero 2027-01-04/22 y julio 2027-07-01/07 guardados, carga nueva 2026-12-28/29) → dos oraciones, enero y después julio; al corregir una carga sin cambiarle nada → `[]`; en el modal de vacaciones nunca va la 1.
- [ ] **Step 2:** correr → fallan.
- [ ] **Step 3:** Implementar en `evaluarLicencia`/`vistaDe` (los dos `calcular`, `antes` y `despues`, ya existen).
- [ ] **Step 4:** correr → pasan.
- [ ] **Step 5:** Suite completa; commit `feat(mi-espacio): el cálculo avisa lo que una carga hace perder o reacomoda`.

### Task 6: «Vence pronto» y el email no ofrecen lo que no se puede usar (spec 3.7)

**Files:** Modify `services/miEspacioResumen.js`, `services/miEspacioReglas.js`; Test `tests/mi-espacio-resumen.test.js`, `tests/mi-espacio-reglas.test.js`.

**Interfaces:**
- Consumes: `diasLibresEntre` (Task 4).
- Produces: en `venceProntoDe`, el franco o las horas a favor del mes sin ningún día libre en todo su mes: la cosa sigue, con `accion: null` y `sin_dias_libres: 'No te quedan días libres este mes para usarlo.'` (`'usarlas'` en horas; en plural de francos, `'usarlos'`). `avisosDeVencimiento` no las nombra.

- [ ] **Step 1: Tests que fallan:** el franco de diciembre con vacaciones que cubren todo diciembre → la cosa con `accion === null` y el texto; un día libre pasado del mes alcanza para que siga el botón; el email del 23/12 sin el franco.
- [ ] **Step 2–4:** correr → fallan; implementar; correr → pasan.
- [ ] **Step 5:** Suite completa; commit `fix(mi-espacio): «Vence pronto» no ofrece cargar lo que no entra en ningún día`.

### Task 7: Los textos de las vacaciones en el Resumen y la lista (spec 3.1, 3.5 y 3.9)

**Files:** Modify `services/miEspacioResumen.js`, `services/miEspacioReglas.js`; Test `tests/mi-espacio-resumen.test.js`, `tests/mi-espacio-reglas.test.js`.

**Interfaces:**
- Consumes: `porHabilitarDe` (Task 2).
- Produces:
  - `quedaDelTipo('vacaciones', …)`: `'45 disponibles · 10 más el 1/1'` (la primera fecha de `porHabilitarDe` de las licencias hasta el año de hoy, `D/M` sin año); sin nada, como hoy.
  - `bajadaDe`: la oración de la licencia que vence en el año, antes del 1/10 (`AVISO_DE_LA_LICENCIA`) `{ texto: '12 vencen el 31/12/2027.', vence: false }`; desde el 1/10, como hoy (`'… el viernes 31/12.'`, `vence: true`). «Perdés …» sigue con `vence: true`.
  - La nota de lo cargado, agrupada por año: `'Cargados para diciembre y para enero y febrero de 2027'` (y en la bajada `'34 ya están cargados para diciembre y para enero y febrero de 2027.'`); solo del año de hoy, `'para noviembre y diciembre'`; solo de otro año, `'para enero y febrero de 2027'`. `anio` (el link) sigue siendo el del primer mes.
  - La capa `cargadas` suma solo los `cargados` de las licencias de años ≤ el de hoy.
  - `textoDelReparto`: «, la más vieja» / «, las más viejas» solo si ninguna ordinaria más vieja que la primera usada tiene `vence >= hoy` y `disponibles + perdidos > 0`.
  - El formato de días de la fila de la lista (`miEspacioResumen.js`, hoy `'7 días corridos, 5 hábiles'`) pasa a `'5 días hábiles de 7 corridos'` (la forma de `textoDeLosDias`); un solo día y los iguales, como hoy.

- [ ] **Step 1: Tests que fallan:** cada salida de arriba con el caso de la spec (hoy 2026-10-28 y 2027-01-04 y 2027-10-01); una carga de enero con días de la 2024 sin usar dice `'Salen de la licencia 2025.'` (sin «la más vieja»); la fila de la lista con `'18 días hábiles de 26 corridos'`.
- [ ] **Step 2–4:** fallan; implementar; pasan. Actualizar los tests existentes que fijaban el formato viejo de días o la nota de los meses (es un cambio pedido: spec 3.9).
- [ ] **Step 5:** Suite completa; commit `fix(mi-espacio): los textos de las vacaciones dicen lo que pasa`.

### Task 8: «Mis vacaciones y saldos» explica sus números (spec 3.8)

**Files:** Modify `services/miEspacioReglas.js`, `controllers/miEspacioController.js` (si `textos_mitades` cambia de forma), `public/js/mi-espacio.js` (la ayuda de cada campo y la copia `textoSaldo`); Test `tests/mi-espacio-reglas.test.js`, `tests/mi-espacio-frontend.test.js`.

**Interfaces:**
- Produces:
  - `textoDeLasMitades(anio, dias, { arranque })`: si `anio` es el del arranque y el arranque es desde el 1/7, `'La primera mitad es lo que pongas en «De la 2026», más abajo. El 1/1/2027 se habilitan 10.'` (la segunda mitad de `mitadesDe(dias)`); si no, el texto de hoy. `verAnio` se lo pasa (lee el arranque).
  - Cada campo de `camposDelSaldoInicial` suma `ayuda`: el del año del arranque, `'De 0 a 8: lo que se habilitó de la 2026 hasta hoy.'`; uno anterior con sus días cargados, `'De 0 a 20: los días de la 2025.'`; sin días cargados (`DIAS_SIN_ELEGIR`), `'De 0 a 30, el máximo de una licencia.'`; los demás, sin ayuda (`''`). `textoSaldo(maximo)` no cambia; el error de un campo con `ayuda` usa la ayuda.
  - La página muestra `ayuda` debajo del campo (en su `aria-describedby`) y, al elegir otros días en el modal, la recalcula con `camposConLoElegido` (que ya copia los máximos): la copia de las ayudas se ata con un test de paridad contra `camposDelSaldoInicial`.

- [ ] **Step 1: Tests que fallan:** `textoDeLasMitades(2026, 20, { arranque: '2026-10-27' })` y con arranque 2026-03-10 (el texto de hoy); las tres ayudas; la paridad de la página.
- [ ] **Step 2–4:** fallan; implementar; pasan.
- [ ] **Step 5:** Suite completa; commit `feat(mi-espacio): «Mis vacaciones y saldos» dice de dónde salen sus números`.

### Task 9: La página dibuja lo nuevo

**Files:** Modify `public/js/mi-espacio.js`, `public/mi-espacio.html` (el `<style>` y el `?v=`), `tests/paginas.test.js` (la versión); Test `tests/mi-espacio-frontend.test.js`.

**Interfaces:**
- Consumes: `vista.avisos` (Task 5), el error con `campo: 'hasta'` (Task 3), `accion: null` y `sin_dias_libres` en «Vence pronto» (Tasks 4 y 6), `perdidas_texto` de la franquicia (Task 4), `ayuda` de los campos del saldo (Task 8).
- Produces:
  - `htmlDelCalculo`: después del texto de hoy, cada `vista.avisos` en un `<p class="me-calculo-aviso">` (ámbar, con los tokens `--sg-*`), escapado.
  - `htmlDeVencePronto`: con `accion === null`, sin botón y con `sin_dias_libres` en un `<p>`.
  - `htmlDelResto`: debajo de «Franquicias», `perdidas_texto` en ámbar si no es ''.
  - `htmlDeLaRegla`: un tramo de un solo día muestra su número (letra más chica si no entra).
  - `VERSION_MI_ESPACIO` sube a la siguiente después de la que deje el main del pase.

- [ ] **Step 1: Tests que fallan** (en el `vm`): los cuatro HTML con texto con `<` escapado; con el DOM falso, un cálculo con error en `hasta` lo muestra debajo de `#ml-hasta` (con `aria-invalid`) y no debajo de `#ml-desde`; «Guardar» sigue habilitado con `avisos` y sin error; el contraste del ámbar ≥ 4,5:1 sobre el fondo del recuadro.
- [ ] **Step 2–4:** fallan; implementar; pasan.
- [ ] **Step 5:** Suite completa; commit `feat(mi-espacio): la página muestra los avisos nuevos de las vacaciones`.

### Task 10: La API de punta a punta, el email y CLAUDE.md

**Files:** Test `tests/mi-espacio-api.test.js`, `tests/mi-espacio-avisos.test.js`; Modify `CLAUDE.md`.

- [ ] **Step 1: Tests de API (Docker):** `POST /mi-espacio/licencias/calculo` con la persona de planta inventada devuelve el texto de spec 3.1 y, con el «Hasta» del alcance, guarda (`POST /mi-espacio/licencias` 201) y con un día más da 400 con `campo: 'hasta'` y el mensaje de 3.3; la médica de 3.2 guarda con `vista.avisos`; el Resumen trae la franquicia en «Vence pronto» con un hoy fijo del 1/10. En `mi-espacio-avisos.test.js` (Mailpit, hoy fijo con `mock.timers`, nunca `/api/cron/*`): el email del primer día hábil de diciembre trae el renglón de la franquicia y anota `franquicia-AAAA`; no se repite al día siguiente.
- [ ] **Step 2:** correrlos con el candado → pasan (lo de las Tasks 2–9 ya está).
- [ ] **Step 3:** CLAUDE.md: en «Mi espacio: licencias y horas extras» y en la convención de `mi-espacio.js`, lo nuevo (lo por habilitar y el alcance, los errores, `vista.avisos`, la franquicia en «Vence pronto» y el email, «Vence pronto» sin botón, el ámbar desde el 1/10, las ayudas del saldo, la nueva versión), en el estilo del archivo; y en «Despliegue», el kit.
- [ ] **Step 4:** Suite completa; commit `docs: las vacaciones al cargar una licencia en CLAUDE.md`.

### Task 11: Cierre

- [ ] **Step 1:** Revisión final de toda la rama (subagente Opus nuevo, con la spec y este plan) y corregir lo que encuentre.
- [ ] **Step 2:** `npm test` completo con el candado: 0 fallas.
- [ ] **Step 3:** Merge en main y push (sin pedir OK, si todo dio bien).
- [ ] **Step 4:** Kit `%USERPROFILE%\Desktop\RPAD-deploy-mi-espacio-vacaciones-licencia`: los archivos de `git diff --name-only <merge de la agenda>..<merge nuevo>` sin `tests/` ni `docs/` ni CLAUDE.md (incluye los de «Redacción y entrega de la nota»: la coordinadora pasa la lista para compararla), el zip, la vuelta atrás con esos archivos desde el merge de la agenda, PASOS.txt (sin SQL, sin cron, sin npm; las dos entregas; **antes del 10/01/2027**) y VERIFICACION.txt con la comparación byte a byte contra `git show`.
- [ ] **Step 5:** Limpieza: quitar el junction de `node_modules` y el `.env` del worktree, borrar `rpad_rama_vacaciones_licencia` y las `rpad_rama_vacaciones_licencia_*` con su permiso (`scratchpad/sim/base.sh borrar <sufijo>` y el `REVOKE`/`DROP` de la base sin sufijo), y parar el servidor de prueba de la simulación si sigue.
- [ ] **Step 6:** Traspaso `mi-espacio-vacaciones-licencia-cierre.md` en la carpeta de notas de la coordinadora y `SendMessage` a `local_62853c2f-ecfd-4cf2-bc66-93f666633e21`.
