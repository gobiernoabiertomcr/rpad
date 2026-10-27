# Mi espacio, licencias y horas extras: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La página personal Mi espacio (Resumen «Niveles», Licencias y Horas extras), con las reglas de cada modalidad contadas en días hábiles con los feriados, el saldo inicial, el paso de las ausencias de día entero a Configuración → Licencias, «Hoy no están» y el email de vencimiento de las 8:15.

**Architecture:**
- **Las reglas:** `services/miEspacioReglas.js`, puro: del `Estado` (lo cargado), «hoy» y el `Set` de feriados sale el `Calculo` (reparto de las vacaciones, topes, francos, horas a favor, lo no utilizado y faltantes). Una carga nueva se acepta si no suma faltantes.
- **El panel como datos:** `services/miEspacioResumen.js`, puro, con todos los textos: el navegador no recalcula nada.
- **La base:** `services/miEspacioDatos.js` (lecturas en lote) y `controllers/miEspacioController.js`.
- **Configuración:** el alta, la edición y la anulación de `licenciasController.js` pasan a `services/licenciasOficialesService.js`, sin cambiar lo que hace Configuración. El paso desde Mi espacio va en `services/miEspacioPaso.js`, con sus decisiones puras en las reglas.
- **El email:** `services/miEspacioAvisos.js`, un paso aislado de la corrida de las 8:15.
- **La página:** `public/mi-espacio.html` + `public/js/mi-espacio.js`, con la convención de `proyectos.js`.

**Tech Stack:** Node 22, Express 4, mysql2/promise sobre MariaDB y JS sin frameworks. Tests con `node:test`: los de API, sobre Docker con base propia; la corrida, en el mismo proceso con `mock.timers`; la página, en un `vm`.

**Spec:** `docs/superpowers/specs/2026-10-26-mi-espacio-licencias-y-horas-design.md`, aprobada el 26/10/2026, con la corrección del usuario a la sección 6 (solo las vacaciones dejan persona a cargo). Consume la entrega 1 (`2026-10-26-feriados-design.md`), que le deja `licencias_afectadas` y el aviso azul (sus secciones 3 y 4). La referencia visual son las maquetas (`2026-10-26-mi-espacio-mockups/`: `1-mi-espacio.html`, `2-formularios.html` y «Niveles» en `opciones.js` y `opciones.css`); donde no coincidan, manda la spec.

## Global Constraints

- **Antes de la Task 1: los feriados tienen que estar en main** (`git log main --oneline` muestra el merge de los feriados, con `services/feriadosReglas.js`, `services/feriadosDatos.js` y `GET /api/feriados`; es `c7627f0`, «Merge branch 'claude/funny-mahavira-3f16dc'», no `feat/feriados`: corrección de la Task 1, al leer el main nuevo). Si no están, parar y avisar: no se empieza nada.
- **No romper nada:** `npm test` completo antes y después de cada tarea, con el candado `C:\Users\Mariano\.rpad-suite.lock`, mirando antes que no haya otro `node --test` corriendo. Nunca dos suites a la vez.
- **Todos los subagentes van con Opus:** implementar, revisar y corregir.
- **Ningún email real** (en local todo va a Mailpit). Nunca llamar a `/api/cron/*`: la corrida se prueba llamando al controlador o al servicio.
- **La base local `datospublicos_mcr_rpad` no se escribe hasta el merge.** Para probar, `rpad_rama_mi_espacio`.
- **El repositorio es público:** sin nombres de personas reales. En los tests y las fixtures, los nombres inventados de las maquetas o «Persona de Prueba».
- **Migraciones aditivas, con su rollback,** que van antes del código.
- **Las convenciones de CLAUDE.md:** ES Modules y `async/await`; respuestas `{ success, data?, error?, campo?, message? }`, con 400 y su `campo` en un error de validación; SQL parametrizado; transacciones con `beginTransaction`/`commit`/`rollback`; textos en español, sin emojis.
- **Lo que no cambia:** `services/notasDigitalesCalendario.js`, `public/js/api.js`, `public/js/main.js`, la estructura de `usuarios_licencias` y `usuarios_auditoria`, y lo que hace Configuración → Licencias (los tests que ya están en `tests/licencias-api.test.js` y `tests/licencias-reglas.test.js` pasan sin tocar sus aserciones).
- **Lo que llega de la base** (el pool no tiene `dateStrings` ni `decimalNumbers`): las fechas, con `DATE_FORMAT(…, '%Y-%m-%d')`; `DECIMAL`, `tinyint` y `smallint`, con `Number()`; `TIME` (`'10:00:00'`), cortado a `'HH:MM'`. «Hoy» es `hoyArgentina()` y `Utils.hoyEnArgentina()`; los momentos, `ahoraArgentina()`.
- **Versiones:** `VERSION_MI_ESPACIO = '20261209'` (nueva). `VERSION_PANTALLAS` (`usuarios.js`) y `VERSION_FERIADOS` (`feriados.js`) pasan de `'20261208'` a `'20261209'`. `VERSION` no cambia.
- **Valores:**
  - **Modalidad:** `planta_permanente` y `planta_politica` son `'planta'`; `contrato` es `'contrato'`; NULL es null.
  - **`DIAS_VACACIONES`:** `[10, 15, 20, 25, 30]`.
  - **`DIAS_ESTUDIOS`:** `{ universitario: 15, secundario: 10 }`, con `DIAS_POR_EXAMEN = 3`.
  - **`TOPES`:** `{ franquicia: 42, medica: 25, familiar: 25 }`. La franquicia se cuenta en horas.
  - **`JORNADA = 7`:** las horas de un día entero y las horas extras que dan un franco.
  - **`LARGO_NOTA = 200`**, contado con `Array.from`.
  - **Los tipos (`TIPOS_LICENCIA`) y sus nombres (`NOMBRES_TIPO`):**
    - `vacaciones` «Vacaciones», `estudios` «Estudios», `medica` «Atención médica», `medica_extraordinaria` «Médica extraordinaria» y `familiar` «Atención del grupo familiar», en las dos modalidades;
    - en planta, además, `franquicia` «Franquicia» y `franco` «Franco compensatorio»;
    - en contrato, además, `horas_a_favor` «Horas a favor»;
    - `uso_autorizado` «Uso autorizado», en las dos.
    - `uso_autorizado` no se ofrece en «Cargar licencia»: tiene su propio formulario.
  - **El rango de fechas de una licencia o de unas horas extras:** del 01/01 de (año de hoy − 2) al 31/12 de (año de hoy + 1).
  - **El rango de «Hoy no están»:** hasta 93 días.
- **Textos fijos** (copiar tal cual; `dd/mm/aaaa` es `formatoCorto`, `dd/mm` va sin el año y los números van con coma: `10,5`):
  - **`MENSAJES_MI_ESPACIO`** (congelado):
    - `sinModalidad`: «Pedile a administración que cargue tu modalidad (planta permanente, planta política o contrato) en Configuración → Usuarios.»
    - `sinArranque`: «Para empezar, completá «Mis vacaciones y saldos».»
    - `tipo`: «Elegí el tipo de licencia.»
    - `fecha`: «Elegí una fecha válida.»
    - `hastaAntes`: «La licencia no puede terminar antes de empezar.»
    - `unDia`: «Esta licencia es de un solo día.»
    - `sinDiasHabiles`: «Entre esas fechas no hay ningún día hábil.»
    - `diaNoHabil`: «Ese día no es hábil: elegí un día de lunes a viernes que no sea feriado.»
    - `porExamen`: «Cada examen es de 1 a 3 días hábiles.»
    - `horasEnteras`: «Las franquicias se toman por hora entera, de 1 a 7.»
    - `horasMedias`: «Las horas van de a media hora, de 0,5 a 7.»
    - `nota`: «La nota puede tener hasta 200 caracteres.»
    - `horario`: «Elegí de qué hora a qué hora, de a media hora.»
    - `diasVacaciones`: «Elegí 10, 15, 20, 25 o 30 días.»
    - `estudios`: «Elegí universitaria, secundaria o «No estudio».»
    - `anio`: «Elegí un año válido.»
    - `saldoMedias`: «Escribí las horas de a media hora.»
    - `noEncontrada`: «Licencia no encontrada»
    - `noEncontradas`: «Horas extras no encontradas»
    - `yaEmpezo`: «Ya empezó: no se puede borrar»
    - `soloHasta`: «Ya empezó: solo podés cambiar hasta cuándo.»
    - `fechasFijas`: «Ya terminó: las fechas quedan fijas.»
    - `autorizadoSoloVacaciones`: «Solo las vacaciones dejan persona a cargo.»
    - `tipoFijo`: «Ya sale la nota que informa quién queda a cargo: el tipo no se puede cambiar.»
  - **Las funciones de texto:**
    - `textoRango(desde, hasta)`: «La fecha tiene que ser del 01/01/2024 al 31/12/2027.»
    - `textoNoEstudia(anio)`: «En 2026 elegiste «No estudio»: cambialo en «Mis vacaciones y saldos».»
    - `textoSuperpuesta(fecha)`: «Ya tenés una licencia cargada el 05/11/2026: corregí la que ya está.»
    - `textoSinHabilitados(fecha)`: «No te alcanzan los días habilitados: para el 15/06/2026 no te queda ninguno.»
    - `textoTope(tipo, anio)`:
      - «Con esta licencia pasarías los 25 días de atención médica de 2026.»
      - «Con esta licencia pasarías los 25 días de atención del grupo familiar de 2026.»
      - «Con esta licencia pasarías los 15 días de licencia por estudios de 2026.» (con el tope de ese año)
      - «Con esta licencia pasarías las 42 horas de franquicia de 2026.»
    - `textoSinFranco(mes)`: «En febrero de 2027 no tenés francos para usar.»
    - `textoSinHorasAFavor(mes, quedan)`: «En noviembre de 2026 te quedan 1,5 horas a favor.» y, con 0, «En noviembre de 2026 no te quedan horas a favor.»
    - `textoSinNoUtilizadas(modalidad, anio, quedan)`: en contrato, «En 2026 te quedan 2 horas no utilizadas previamente.»; en planta, «En 2026 no tenés francos no utilizados previamente.»
    - `textoHorarioSuperpuesto(desde, hasta)`: «Se superpone con las horas extras de 19:00 a 22:00 de ese día.»
    - `textoSaldo(maximo)`: «Escribí un número de 0 a 30.»
    - `textoAutorizadaSinDias(desde, hasta)`: «Sos la persona autorizada del firmante del 26/10/2026 al 10/11/2026, y con esta licencia no te quedaría ningún día hábil para presentar las notas. Hablalo con el firmante antes de cargarla.»
  - **Los faltantes del Resumen:**
    - «Revisá tus vacaciones: para el 15/06/2027 faltan 2 días habilitados.» (con uno, «falta 1 día habilitado»);
    - «Revisá tu atención médica de 2026: suman 27 días y el tope es 25.» Igual para «tu atención del grupo familiar», «tu licencia por estudios» y «tus franquicias», estas en horas;
    - «Revisá tus francos de octubre de 2026: cargaste 2 y corresponde 1.» (con 0, «y no corresponde ninguno»);
    - «Revisá tus horas a favor de octubre de 2026: cargaste 9 horas y corresponden 7,5.»;
    - «Revisá tus usos autorizados de 2026: cargaste 8 horas y había 6,5.» En planta, con francos.
  - **El paso a Configuración:**
    - `AVISO_DEL_PASO`: «Las fechas pasan a Configuración → Licencias. Mientras dure, no contás como disponible para auditar y no te llegan los recordatorios de cambios para auditar ni los avisos de cambios sin auditor. El tipo no pasa.»
    - `AVISO_DEL_PASO_SUPERADMIN`: «Los avisos al superadmin se guardan y te llegan en un resumen a la vuelta.»
    - `AVISO_NOTAS_DE_HOY`: «Las notas de hoy ya salieron a las 8:15 con tu firma.»
    - `AVISO_SIN_PERSONA_A_CARGO`: «Sin persona a cargo: esos días no se generan Notas Digitales y lo que venza se reitera cuando vuelvas.»
    - `textoSuperpuestaConConfiguracion(desde, hasta)`: «Se superpone con una licencia de Configuración del 03/11 al 05/11: revisala con administración»
    - `textoNoPaso(motivo)`: «No pasó a Configuración: <motivo>»
    - `textoYaNoCubierta(desde, hasta)`: «Ya no está cubierta en Configuración del 03/11 al 05/11: revisala con administración.»
    - `textoEnConfiguracion(desde, hasta)`: «En Configuración: del 03/11 al 05/11.»
    - `textoUnida(desde, hasta)`: «Ya estaba en Configuración → Licencias, del 02/11 al 13/11.»
    - `textoSigueEnConfiguracion(desde, hasta)`: «Sigue en Configuración del 03/11 al 03/11: ya empezó y no se pudo anular.»
    - `TEXTO_TAMBIEN_EN_CONFIGURACION`: «También en Configuración → Licencias.»
    - `TEXTO_NO_SE_COPIA`: «Administración la cambió en Configuración: lo que corrijas acá ya no se copia.»
    - `TEXTO_ANULADA_POR_ADMINISTRACION`: «Administración la anuló en Configuración: queda solo acá.»
    - `TEXTO_NO_DIA_ENTERO`: «No es el día entero: no pasa a Configuración»
    - la insignia de Configuración: «Cargada desde Mi espacio».
  - **El email:**
    - el asunto: «RPAD: lo que vence pronto en Mi espacio»;
    - el título: «Lo que vence pronto»;
    - el botón: «Ver en Mi espacio», a `${RPAD_URL}/mi-espacio.html#resumen`;
    - la nota: «Este aviso te llega una sola vez por cada cosa. Lo que cargás en Mi espacio lo ves solo vos.»;
    - un renglón por cosa:
      - «Tenés 1 franco compensatorio para usar en octubre: el último día hábil es el viernes 30/10.» (con 2, «2 francos compensatorios»);
      - «Tenés 1,5 horas a favor para usar en octubre: el último día hábil es el viernes 30/10.» (con 1, «1 hora»);
      - «Tenés 3 días de la licencia 2024: vence el 31/12/2026.» (con 1, «1 día»).
  - **«Hoy no están»:** «<nombre> no está» y «Vuelve el lunes 02/11».

## Review Focus

1. **Una modalidad que cambia con filas de otra** (una persona de contrato con horas a favor que pasa a planta). Esas filas se listan en gris con «No corresponde a tu modalidad actual: no cuenta.», no cuentan en ningún saldo y nada tira. Test en la Task 5 (`calcular`) y en la Task 6 (la lista).
2. **Lo que llega de la base como texto:** `"7.5"`, `'19:00:00'`, `"8.0"` y una fecha `Date`. Después de un INSERT por SQL, la API devuelve números como números, horas `'HH:MM'` y fechas `'AAAA-MM-DD'`. Test en la Task 7.
3. **El doble envío** (dos pestañas o un doble clic). Dos `POST` simultáneos de licencias que se superponen guardan una sola, y en el paso no queda ninguna licencia de Configuración huérfana. Test en la Task 8, y en la Task 10 con el paso.
4. **Una licencia que cruza el arranque** (desde antes del arranque, hasta después). Descuentan solo los días desde el arranque, y pasa a Configuración si termina hoy o después. Test en la Task 3 (pura) y en la Task 10 (API).
5. **HTML en una nota, en un nombre o en un motivo de Configuración** (`<img src=x onerror=alert(1)>`). Se ve como texto en la lista, en «No están», en el título de los modales y en los `aria-label`. Tests en las Tasks 15, 16 y 17.

---

### Task 1: La rama, la base y las seis tablas

**Files:**
- Create: `database/updates/migracion-mi-espacio.sql`, `database/updates/rollback-mi-espacio.sql`
- Modify: `database/schema.sql` (al final, después de las de feriados), `tests/schema.test.js`

**Interfaces:**
- Produces (todas ENGINE=InnoDB, utf8mb4 y utf8mb4_unicode_ci; las FK a `usuarios(id)`, ON DELETE CASCADE):
  - **`mi_espacio_anios`:** `usuario_id` int NOT NULL, `anio` smallint(6) NOT NULL, `dias_vacaciones` tinyint(4) NOT NULL, `estudios` enum('universitario','secundario') NULL, `created_at`, `updated_at`; PK (`usuario_id`, `anio`).
  - **`mi_espacio_arranque`:** `usuario_id` int NOT NULL PK, `fecha` date NOT NULL, `created_at`.
  - **`mi_espacio_saldos`:** `usuario_id`, `concepto` enum('vacaciones','franquicias','estudios','medica','familiar','horas_no_utilizadas') NOT NULL, `anio` smallint(6) NOT NULL, `cantidad` decimal(5,1) NOT NULL DEFAULT 0.0, `updated_at`; PK (`usuario_id`, `concepto`, `anio`).
  - **`mi_espacio_licencias`:**
    - `id` AI PK, `usuario_id`, `tipo` enum('vacaciones','franquicia','estudios','medica','medica_extraordinaria','familiar','franco','horas_a_favor','uso_autorizado') NOT NULL, `desde` date NOT NULL, `hasta` date NOT NULL, `horas` decimal(3,1) NULL;
    - `mostrar` tinyint(1) NOT NULL DEFAULT 1 y `nota` varchar(200) NULL;
    - `licencia_oficial_id` int NULL, `oficial` enum('creada','unida') NULL y `sin_pasar` varchar(200) NULL;
    - `activo` tinyint(1) NOT NULL DEFAULT 1, `created_at` y `updated_at`;
    - índice `idx_mi_espacio_licencias_usuario (usuario_id, desde, hasta)`;
    - FK `fk_mi_espacio_licencias_oficial` → `usuarios_licencias(id)` ON DELETE SET NULL.
  - **`mi_espacio_horas_extras`:** `id` AI PK, `usuario_id`, `fecha` date NOT NULL, `desde` time NOT NULL, `hasta` time NOT NULL, `nota` varchar(200) NULL, `activo` tinyint(1) NOT NULL DEFAULT 1, `created_at`, `updated_at`; índice `idx_mi_espacio_horas_usuario (usuario_id, fecha)`.
  - **`mi_espacio_avisos`:** `usuario_id`, `clave` varchar(40) NOT NULL, `enviado_at` datetime NOT NULL; PK (`usuario_id`, `clave`).
  - Las FK se llaman `fk_<tabla>_usuario`.

- [ ] **Step 1: Preparar el trabajo.**
  - Comprobar que los feriados están en main (Global Constraints). Si no, parar.
  - **Leer el main nuevo** (pedido del usuario): `git log` y `git diff` de lo que entró desde que se escribió este plan, la entrega de feriados y cualquier otra. Ajustar este plan en la rama si algo cambió: los nombres y las firmas de `feriadosReglas.js` y `feriadosDatos.js`, las versiones, los tests, la cantidad de tablas o de páginas. Si un cambio es una decisión del usuario, preguntárselo a la sesión coordinadora, sin decidirlo.
  - El worktree, en la rama `feat/mi-espacio`, cortada de `main`. Si este plan no está en main, mergear `docs/mi-espacio-pre-plan` en la rama. (Corrección de la Task 1, al leer el main nuevo: el worktree ya está armado en la rama `claude/mi-espacio-licencias-fc16d6`, con main —`c7627f0`— y `docs/mi-espacio-pre-plan` ya mergeados —`3f8a11d`—, el junction de `node_modules` y `DB_NAME=rpad_rama_mi_espacio` en su `.env`; donde este plan dice `feat/mi-espacio`, es esa rama.)
  - Junction de `node_modules` a `C:\git\rpad\node_modules`.
  - La base `rpad_rama_mi_espacio`: copia de `datospublicos_mcr_rpad`, que ya tiene los feriados (`DROP`, `CREATE`, volcado y `GRANT` a `rpad`, como en las entregas anteriores). En el `.env` del worktree, `DB_NAME=rpad_rama_mi_espacio`.
  - `npm test` completo, con el candado: anotar el total de tests y que haya 0 fallas.
- [ ] **Step 2: Escribir los tests que fallan** en `tests/schema.test.js`:
  - `const TABLAS_MI_ESPACIO = ['mi_espacio_anios', 'mi_espacio_arranque', 'mi_espacio_saldos', 'mi_espacio_licencias', 'mi_espacio_horas_extras', 'mi_espacio_avisos'];`
  - **en el `describe('database/schema.sql')`:** las seis tablas con sus columnas (como el test de las notas DGMIT), la FK a `usuarios_licencias` con `SET NULL` y las de `usuarios` con `CASCADE`;
  - **las seis, en la lista «no trae datos».**
  - **un `describe('migracion-mi-espacio.sql')`** copiado del de `migracion-metricas.sql`, con la base `rpad_schema_mi_espacio_test`:
    - sin DELIMITER, USE, DROP, RENAME ni CHECK en la migración, y sin DELIMITER ni USE en el rollback;
    - la cabecera de la migración dice `docs/superpowers/specs/2026-10-26-mi-espacio-licencias-y-horas-design.md`, «Solo agrega», «ORDEN: correr ANTES de subir el código», «después de migracion-feriados.sql», «Se puede volver a correr» y «Para deshacer: rollback-mi-espacio.sql»;
    - la cabecera del rollback dice `migracion-mi-espacio.sql`, «primero volver a subir los archivos anteriores», «se pierden» y «Las licencias que pasaron a Configuración → Licencias quedan allí»;
    - desde la estructura de main (schema.sql sin las seis), la migración corrida dos veces deja las columnas, las claves ajenas y los índices de `schema.sql`;
    - el rollback, corrido dos veces con una fila en cada tabla y una licencia de Configuración apuntada por `licencia_oficial_id`, deja la estructura de main y no borra esa licencia ni al usuario; la migración la recupera.
- [ ] **Step 3:** `node --test tests/schema.test.js` da FAIL: no existen los archivos.
- [ ] **Step 4: Escribir la migración, el rollback y las tablas en `schema.sql`,** con `SET NAMES utf8mb4` y las cabeceras de `migracion-metricas.sql`. El rollback borra las seis en orden inverso.
- [ ] **Step 5: Correr la migración en `rpad_rama_mi_espacio`** y después `node --test tests/schema.test.js`: PASS, también la comparación de `schema.sql` con la base local.
- [ ] **Step 6: Commit:** `feat(mi-espacio): las seis tablas de Mi espacio, con su migración y su vuelta atrás`.

### Task 2: Las vacaciones (mitades, vencimiento, la más vieja primero)

**Files:**
- Create: `services/miEspacioReglas.js`, `tests/mi-espacio-reglas.test.js`, `tests/fixtures/mi-espacio-casos.js`

**Interfaces:**
- Consumes: `diasHabilesDe`, `esDiaHabilCon` (`services/feriadosReglas.js`); `esFechaIso`, `sumarDias`, `formatoCorto` (`services/notasDigitalesCalendario.js`).
- Produces (puras; ninguna tira):
  - **El `Estado`:** `{ modalidad: 'planta' | 'contrato' | null, arranque: 'AAAA-MM-DD' | null, anios: [{ anio, dias_vacaciones, estudios }], saldos: [{ concepto, anio, cantidad }], licencias: [{ id, tipo, desde, hasta, horas: number | null }], horasExtras: [{ id, fecha, desde: 'HH:MM', hasta: 'HH:MM' }] }`. Solo las filas activas.
  - **Constantes:**
    - `MODALIDADES`, `modalidadDe(vinculo)` y `TEXTO_MODALIDAD`, por vínculo: «Planta permanente», «Planta política» y «Contrato»;
    - `TIPOS_LICENCIA`, `TIPOS_POR_MODALIDAD`, `NOMBRES_TIPO` y `DIAS_VACACIONES`;
    - `MENSAJES_MI_ESPACIO` y las funciones de texto de Global Constraints, todas, congeladas.
  - **`mitadesDe(dias) → [number, number]`:** la primera es la mayor.
  - **`habilitaciones(anio) → ['AAAA-07-01', '(A+1)-01-01']`.**
  - **`venceLaLicencia(anio) → '(A+2)-12-31'`.**
  - **`anioVigente(anios, anio) → { anio, dias_vacaciones, estudios } | null`:** la fila de ese año o la del año anterior más cercano.
  - **`ordinariasDe(estado, hoy) → Ordinaria[]`**, con `{ anio, total, mitades: [{ dias, habilita }], vence, desde_saldo }`, de la más vieja a la más nueva. Sin arranque, `[]`.
    - Las licencias van desde (año del arranque − 2) hasta el año de hoy + 1.
    - Una anterior al año del arranque tiene una sola mitad, `{ dias: saldo, habilita: arranque }`.
    - La del año del arranque, con arranque desde el 1/7: la primera mitad es el saldo y la segunda, la de `mitadesDe`.
    - El resto, con `mitadesDe(anioVigente(...).dias_vacaciones)`.
  - **`diasQueDescuentan(fila, estado, feriados) → string[]`:** los días hábiles de la fila. En los tipos con saldo inicial (vacaciones, franquicia, estudios, medica, familiar y, en contrato, uso_autorizado), solo desde el arranque, ese día incluido.
  - **`repartoDeVacaciones(estado, { hoy, feriados }) → { ordinarias, porFila, sinCubrir }`:**
    - `ordinarias` es Ordinaria más `{ habilitado, por_habilitar, usados, cargados, disponibles }`, a hoy;
    - `porFila` es un `Map` de id a `[{ anio, dias }]`;
    - `sinCubrir` es un `Map` de id a `string[]`.
  - **`textoDelReparto(reparto, filaId) → string`:** de qué licencia salen los días y lo que queda.

- [ ] **Step 1: Escribir la fixture `tests/fixtures/mi-espacio-casos.js`.** Exporta `HOY = '2026-10-26'`, `PLANTA` y `CONTRATO`, cada uno `{ persona, estado }`, con los datos de la maqueta ajustados a la regla del arranque (la maqueta es anterior y no la respeta):
  - **`PLANTA`** (persona inventada, rol `admin`, `planta_permanente`):
    - arranque `'2026-10-26'`; `anios`: 2026 con 20 días y `universitario`;
    - `saldos`: vacaciones 2024 = 8, 2025 = 20 y 2026 = 10; franquicias 17, estudios 6, medica 3 y familiar 2;
    - `licencias`: vacaciones del 03/11 al 09/11/2026, franco el 23/10, franquicia de 2 h el 15/10, estudios del 01/10 al 02/10, médica del 21/09 al 23/09 y franquicia de 7 h el 14/09;
    - `horasExtras`:
      - junio: 09/06 18:00–22:00 y 16/06 18:00–21:00 (7 h);
      - julio: 07/07 18:00–21:00 y 14/07 18:00–20:00 (5 h);
      - agosto: 04, 11, 18 y 25/08, de 18:00 a 21:30 (14 h);
      - septiembre: 10/09 18:00–22:00 y 17/09 18:00–21:30 (7,5 h);
      - octubre: 06/10 18:00–21:30, 14/10 17:00–21:00 y 22/10 19:00–22:00 (10,5 h).
  - **`CONTRATO`** (persona inventada, rol `lector`, `contrato`):
    - arranque `'2026-10-26'`; `anios`: 2026 con 15 días y `secundario`;
    - `saldos`: vacaciones 2024 = 0, 2025 = 5 y 2026 = 8; estudios 3, medica 0, familiar 3 y horas_no_utilizadas 6,5;
    - `licencias`: familiar el 30/10, horas a favor de 2 h el 20/10, estudios del 13/10 al 15/10 y horas a favor de 7 h el 09/10;
    - `horasExtras`: septiembre 10,5 h (10/09 18:00–22:00, 17/09 18:00–22:00 y 24/09 18:00–20:30) y octubre 4 h (21/10 18:00–22:00).
  - Los feriados de la fixture son un `Set` vacío (`SIN_FERIADOS`).
- [ ] **Step 2: Escribir los tests que fallan:**
  - **`mitadesDe`:** 15 da `[8, 7]`, 25 da `[13, 12]`, 20 da `[10, 10]` y 30 da `[15, 15]`.
  - **`habilitaciones(2026)`** es `['2026-07-01', '2027-01-01']`; **`venceLaLicencia`:** 2024 da `'2026-12-31'` y 2025, `'2027-12-31'`.
  - **`anioVigente`:** con solo 2025 cargado, 2027 da la fila de 2025; sin filas, null.
  - **«la licencia 2026 de 20 días»:** con arranque `'2026-01-02'` y hoy `'2026-07-01'`, la 2026 tiene `habilitado` 10 y `por_habilitar` 10; con hoy `'2027-01-01'`, 20 y 0.
  - **«el arranque con la primera mitad habilitada»:** `PLANTA` a hoy da, para la 2026, `habilitado` 10 y `por_habilitar` 10, y `desde_saldo` es true. Con arranque `'2026-03-02'`, la 2026 no tiene saldo y se arma con `mitadesDe(20)`.
  - **«solo días habilitados»:** con arranque `'2026-01-02'`, saldos 2024 y 2025 en 0 y vacaciones del 11/05 al 15/05/2026, `sinCubrir` tiene los cinco días. Del 06/07 al 10/07 salen de la 2026.
  - **«la más vieja, día por día»:** con el mismo arranque, saldo 2025 = 3 y vacaciones del 10/06 al 16/06/2026 (`SIN_FERIADOS`), los días 10, 11 y 12 salen de la 2025, y el primer día sin cubrir es el `'2026-06-15'`.
  - **`PLANTA`:**
    - las vacaciones de noviembre dan `porFila` `[{ anio: 2024, dias: 5 }]`;
    - las disponibles son 3 (2024), 20 (2025) y 10 (2026), con 5 cargados y 10 por habilitar;
    - `textoDelReparto` es «Salen de la licencia 2024, la más vieja. Te quedan 33 días: 3 de la 2024 (vencen el 31/12/2026), 20 de la 2025 y 10 de la 2026.»
  - **«los feriados en el medio»:** `PLANTA` con `new Set(['2026-11-09'])` da 4 días de la 2024 y 34 disponibles.
  - **«una carga que cruza un vencimiento»:** arranque `'2026-10-26'`, saldos 2024 = 3, 2025 = 0 y 2026 = 10, y vacaciones del 30/12/2026 al 05/01/2027. El reparto es `[{ anio: 2024, dias: 2 }, { anio: 2026, dias: 2 }]`, porque el 01/01 es feriado fijo y la 2024 vence el 31/12.
  - **`CONTRATO`:** `textoDelReparto` de unas vacaciones de 5 días hábiles desde el 03/11/2026 es «Salen de la licencia 2025, la más vieja. Te quedan 8 días, todos de la 2026.»
  - **«de lunes a lunes»:** `diasQueDescuentan` del 26/10 al 02/11/2026 da 6 días.
  - **«antes del arranque no descuenta»:** con `PLANTA`, unas vacaciones del 21/10 al 23/10/2026 dan `[]`.
  - **«nada tira»:** un estado vacío, `null`, fechas que no son fechas y un tipo desconocido.
- [ ] **Step 3:** `node --test tests/mi-espacio-reglas.test.js` da FAIL: el módulo no existe.
- [ ] **Step 4: Implementar en `services/miEspacioReglas.js`,** con el comentario de convención de los archivos puros. El reparto es este algoritmo:

```
días = para cada fila de vacaciones, diasQueDescuentan(fila); se ordenan por (fecha, id)
para cada día d: la ordinaria más vieja con d <= vence y (Σ mitades con habilita <= d) − asignados > 0
  sí: se le asigna a esa; no: d va a sinCubrir de su fila
a hoy: habilitado = Σ mitades con habilita <= hoy; por_habilitar = el resto
       usados = asignados con fecha <= hoy; cargados = asignados con fecha > hoy
       disponibles = max(0, habilitado − asignados) (0 si vence < hoy)
       por_habilitar −= max(0, asignados − habilitado)
```

  En `textoDelReparto`:
  - una sola licencia: «Salen de la licencia 2024, la más vieja.»;
  - varias: «Salen de las licencias 2024 (3 días) y 2025 (2 días), las más viejas.»;
  - después, las disponibles, con «(vencen el …)» en la que vence el 31/12 del año de hoy, «, todos de la 2026» si es una sola, o «No te quedan días disponibles.».
- [ ] **Step 5:** Correr: PASS.
- [ ] **Step 6: Commit:** `feat(mi-espacio): las reglas de las vacaciones: mitades, vencimiento y la más vieja primero`.

### Task 3: Las demás licencias, sus topes y la validación de una carga

**Files:**
- Modify: `services/miEspacioReglas.js`, `tests/mi-espacio-reglas.test.js`

**Interfaces:**
- Consumes: lo de la Task 2.
- Produces:
  - **Constantes:** `DIAS_ESTUDIOS`, `DIAS_POR_EXAMEN`, `TOPES`, `JORNADA` y `LARGO_NOTA`.
  - **`rangoDeFechas(hoy) → { desde, hasta }`.**
  - **`esDiaEntero({ tipo, horas }) → boolean`:** vacaciones, estudios, medica, medica_extraordinaria, familiar y franco, o `Number(horas) === 7`.
  - **`topeDe(tipo, anio, anios) → number | null`:** estudios sale de `anioVigente` (null con «No estudio»); medica_extraordinaria, null.
  - **`usoDeLosTopes(estado, { feriados }) → [{ tipo, anio, usados, tope }]`:**
    - de franquicia (en horas), estudios, medica, familiar y medica_extraordinaria;
    - cada día en su año, con `diasQueDescuentan`;
    - suma el saldo inicial del concepto en el año del arranque.
  - **`validarLicencia(entrada, { hoy, estado, feriados, editadaId }) → { datos: { tipo, desde, hasta, horas, mostrar, nota } | null, error: { campo, mensaje } | null }`.** Los campos son `tipo`, `desde`, `hasta`, `horas` y `nota`, y el orden es este:
    1. el tipo (de la modalidad y no `uso_autorizado` fuera de su formulario: se acepta con `uso_autorizado: true` en el contexto);
    2. las fechas: el formato, `textoRango`, `hastaAntes` y, en los de un día (franquicia, franco, horas_a_favor y uso_autorizado), `unDia`;
    3. los días hábiles: `sinDiasHabiles` o, en los de un día, `diaNoHabil`;
    4. las horas: en franquicia, enteras de 1 a 7; en horas_a_favor y uso_autorizado de contrato, de 0,5 a 7 en pasos de 0,5; en uso_autorizado de planta, siempre 7; en el resto, null;
    5. la nota (recortada, vacía es null);
    6. `textoSuperpuesta` con otra licencia activa (sin `editadaId`), con la primera fecha en común;
    7. en estudios, `porExamen` y `textoNoEstudia`.
    - `mostrar` es 1 salvo con `false`, `0` o `'0'`.

- [ ] **Step 1: Escribir los tests que fallan:**
  - **`rangoDeFechas('2026-10-26')`** es `{ desde: '2024-01-01', hasta: '2027-12-31' }`. `'2023-12-31'` da `textoRango` en `desde`.
  - **`esDiaEntero`:** franquicia de 7 sí y de 3 no; franco sí; horas a favor de 7 sí.
  - **`usoDeLosTopes(PLANTA.estado)`:** franquicia 2026 = 17 (lo de antes del arranque no suma), estudios = 6, medica = 3 y familiar = 2.
  - **«cruza el año»:** una médica del 28/12/2026 al 05/01/2027 suma 4 en 2026 y 2 en 2027.
  - **«cruza el arranque»:** con `PLANTA`, una médica del 23/10 al 28/10/2026 suma 3 (26, 27 y 28).
  - **`validarLicencia`, cada error con su campo:**
    - una franquicia en contrato da `tipo`;
    - del sábado 31/10 al domingo 01/11 da `sinDiasHabiles`;
    - una franquicia el sábado 31/10 da `diaNoHabil`;
    - franquicias de 2,5 h y de 8 h dan `horasEnteras`;
    - horas a favor de 2,25 h y de 7,5 h dan `horasMedias`;
    - estudios de 4 días hábiles da `porExamen`;
    - estudios en un año con `estudios: null` da `textoNoEstudia(2026)`;
    - una franquicia el 05/11/2026 con las vacaciones de `PLANTA` cargadas da «Ya tenés una licencia cargada el 05/11/2026: corregí la que ya está.»; con `editadaId` igual a esas vacaciones, no;
    - una nota de 201 caracteres da `nota`, y 200 emojis pasan.
  - **«nada tira»:** `validarLicencia(null, …)` da error en `tipo`.
- [ ] **Step 2:** Correr: FAIL.
- [ ] **Step 3: Implementar.** Los topes contra lo cargado se comparan en la Task 5 (`problemaDeLaCarga`), no acá.
- [ ] **Step 4:** Correr: PASS.
- [ ] **Step 5: Commit:** `feat(mi-espacio): las demás licencias, sus topes y la validación de una carga`.

### Task 4: Las horas extras, los francos, las horas a favor y lo no utilizado

**Files:**
- Modify: `services/feriadosReglas.js`, `tests/feriados-reglas.test.js`, `services/miEspacioReglas.js`, `tests/mi-espacio-reglas.test.js`

**Interfaces:**
- Consumes: `esDiaHabilCon` y `diaDeLaSemana` (entrega 1); lo de las Tasks 2 y 3.
- Produces:
  - **En `services/feriadosReglas.js`** (puras, con un tope de 366 vueltas; null con una entrada inválida): `proximoDiaHabilCon(fecha, feriados)` (la fecha, si es hábil, o la siguiente que lo es), `restarDiasHabilesCon(fecha, n, feriados)` (el n-ésimo día hábil anterior, sin contar la fecha) y `ultimoDiaHabilDelMesCon('AAAA-MM', feriados)`.
  - **En `services/miEspacioReglas.js`:**
    - `horasDe(desde, hasta) → number | null`: `'HH:MM'` en pasos de media hora; con `hasta <= desde`, pasa la medianoche (+24 h); null si son iguales o no son medias horas. `mesMas('AAAA-MM', n) → 'AAAA-MM'`.
    - `validarHorasExtras(entrada, { hoy, estado, editadaId }) → { datos: { fecha, desde, hasta, nota }, error }`: la fecha en `rangoDeFechas` (cualquier día vale), el horario con `horario` (campo `desde`), la nota, y la superposición con otra del mismo día con `textoHorarioSuperpuesto`.
    - `horasPorMes(horasExtras) → Map<'AAAA-MM', number>`: cada fila cuenta en el mes de su `fecha`.
    - `francosDe(estado, { hoy, feriados })`, en planta: `[{ mes_trabajado, horas, francos = floor(horas / 7), mes_de_uso = mes_trabajado + 2, usos: [{ id, fecha }], disponibles, no_utilizados, ultimo_dia_habil, termino }]`. Los usos son todas las filas `franco` de ese mes, sin la regla del arranque; `no_utilizados` cuenta si el mes terminó.
    - `horasAFavorDe(estado, { hoy, feriados })`, en contrato: `[{ mes_trabajado, horas, mes_de_uso = mes_trabajado + 1, a_favor = horas, usos: [{ id, fecha, horas }], usadas, disponibles, no_utilizadas, antes_del_arranque, ultimo_dia_habil, termino }]`. `antes_del_arranque`: el mes de uso terminó antes del arranque, así que esas horas ya están en el saldo inicial.
    - `noUtilizadasDe(estado, anio, { hoy, feriados }) → { anio, unidad: 'horas' | 'francos', saldo, meses: [{ mes_de_uso, mes_trabajado, cantidad, quedan, antes_del_arranque }], usos: [{ id, fecha, cantidad }], quedan }`.
      - Lo no utilizado del año del mes de uso, que vuelve a cero el 1/1. El saldo inicial (`horas_no_utilizadas`) va solo en contrato y en el año del arranque.
      - Los usos autorizados de ese año descuentan primero el saldo y después los meses, de los más viejos a los más nuevos. En contrato, los anteriores al arranque no descuentan.
      - En planta, un uso autorizado descuenta un franco.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **`tests/feriados-reglas.test.js`:**
    - `ultimoDiaHabilDelMesCon('2026-10', new Set())` es `'2026-10-30'`; con `new Set(['2026-10-30'])`, `'2026-10-29'`; `'2026-13'` da null;
    - `restarDiasHabilesCon('2026-10-30', 5, new Set())` es `'2026-10-23'`;
    - `proximoDiaHabilCon('2026-10-31', new Set())` es `'2026-11-02'`; con `new Set(['2026-11-02'])`, `'2026-11-03'`; `('2026-10-30', …)` es la misma fecha.
  - **`tests/mi-espacio-reglas.test.js`:**
    - **`horasDe`:** de 19:00 a 22:00, 3; de 18:00 a 21:30, 3,5; de 22:00 a 01:30, 3,5; de 23:30 a 00:00, 0,5; de 10:15 a 11:00 y de 10:00 a 10:00, null.
    - **«los ejemplos del usuario, planta»:**
      - 10,5 h en octubre de 2026 dan 1 franco con `mes_de_uso` `'2026-12'`;
      - 7,5 h en noviembre dan 1 para `'2027-01'`;
      - 6,5 h en diciembre dan 0 para `'2027-02'`.
    - **`PLANTA` a hoy:**
      - el franco de agosto es 2 para `'2026-10'`, con un uso el 23/10, 1 disponible y `ultimo_dia_habil` `'2026-10-30'`;
      - junio da 1 para `'2026-08'`, con `no_utilizados` 1;
      - julio da 0.
    - **«los ejemplos del usuario, contrato»:**
      - 10,5 h en octubre dan 10,5 a favor en noviembre, que aceptan usos de 7, 2 y 1,5;
      - 7,5 h en noviembre dan 7,5 en diciembre;
      - 6,5 h en diciembre dan 6,5 en enero de 2027.
    - **`CONTRATO` a hoy:** octubre tiene `a_favor` 10,5, `usadas` 9 y `disponibles` 1,5; noviembre, 4 y sin terminar.
    - **«lo no utilizado vuelve a cero el 1/1»:** con 3 h en diciembre de 2026 sin usar en enero, `noUtilizadasDe(…, 2026)` no las cuenta y `(…, 2027)` sí.
    - **«antes del arranque»:**
      - con arranque `'2026-10-26'`, 3 h en agosto y un uso de 1,5 el 15/09, septiembre queda con `antes_del_arranque` true y no suma;
      - el saldo de 6,5 sí suma;
      - `noUtilizadasDe(CONTRATO.estado, 2026)` da `quedan` 6,5.
    - **«el uso autorizado, más viejas primero»:** con saldo 1 y 3 no utilizadas en junio, un uso de 2 deja el saldo en 0 y junio en 2 (`quedan` 2).
    - **«uso autorizado en planta»:** el franco no utilizado de agosto se descuenta con un uso autorizado el 26/10/2026, y queda 0.
    - **`validarHorasExtras`:**
      - un sábado y un feriado son válidos;
      - 22/10 de 20:00 a 21:00, con 19:00–22:00 cargado, da «Se superpone con las horas extras de 19:00 a 22:00 de ese día.»;
      - de 10:15 a 11:00 da `horario`;
      - una nota de 201 da `nota`.
- [ ] **Step 2:** Correr los dos archivos: FAIL.
- [ ] **Step 3: Implementar.** Las de feriados van con su comentario y sin tocar las de la entrega 1.
- [ ] **Step 4:** Correr: PASS.
- [ ] **Step 5: Commit:** `feat(mi-espacio): horas extras, francos, horas a favor y lo no utilizado previamente`.

### Task 5: «Mis vacaciones y saldos», el cálculo completo, los faltantes y lo que frena una carga

**Files:**
- Modify: `services/miEspacioReglas.js`, `tests/mi-espacio-reglas.test.js`

**Interfaces:**
- Consumes: lo de las Tasks 2 a 4.
- Produces:
  - **`camposDelSaldoInicial({ modalidad, arranque, anios }) → [{ clave, concepto, anio, rotulo, maximo, paso }]`.** Sin arranque, se arma con hoy (`arranque` es la fecha del arranque o hoy).
    - `vacaciones-<A−2>` «Sin usar de la licencia 2024», `vacaciones-<A−1>` «De la 2025» y, solo con el arranque desde el 1/7, `vacaciones-<A>` «De la 2026». El máximo es el `dias_vacaciones` vigente de ese año o 30, y el de la del año, su primera mitad.
    - En planta, `franquicias` «Horas de franquicia», con máximo 42.
    - `estudios` «Días de estudios», con el tope del año; no va con «No estudio».
    - `medica` «Días de atención médica» y `familiar` «Días de grupo familiar», con máximo 25.
    - En contrato, `horas_no_utilizadas` «Horas no utilizadas previamente», con máximo 200 y paso 0,5. El resto va con paso 1.
  - **`validarSaldoInicial(entrada, campos) → { datos: [{ concepto, anio, cantidad }], error }`:** `entrada.saldos[clave]` es obligatorio, un número de 0 al máximo, entero o de a media hora. Los errores son `textoSaldo` o `saldoMedias`, con `campo` = la clave.
  - **`validarAnio(anio, entrada, hoy) → { datos: { anio, dias_vacaciones, estudios }, error }`:**
    - el año va de (año de hoy − 2) a (año de hoy + 1); si no, `anio`;
    - `dias_vacaciones` en `DIAS_VACACIONES`; si no, `diasVacaciones`;
    - `estudios` es `'universitario'`, `'secundario'` o null; si no, `estudios`.
  - **`fueraDeLaModalidad(fila, modalidad) → boolean`.**
  - **`calcular(estado, { hoy, feriados }) → Calculo`:** `{ reparto, topes, francos, horasAFavor, noUtilizadas: { [anio]: … }, faltantes }`. No cuenta las filas fuera de la modalidad.
  - **`faltantesDe(calculo) → [{ clave, campo, medida, texto, mensaje }]`.** `texto` es el del Resumen (Global Constraints) y `mensaje`, el error de una carga. Las claves y lo que miden:
    - `vacaciones:<id>`: sus días sin cubrir; `textoSinHabilitados` con el primero;
    - `tope:<tipo>:<anio>`: lo que suma cuando pasa el tope; `textoTope`;
    - `franco:<mes>`: los usos de más; `textoSinFranco`;
    - `horas:<mes>`: las horas de más; `textoSinHorasAFavor`;
    - `uso:<anio>`: lo de más; `textoSinNoUtilizadas`.
  - **`problemaDeLaCarga(antes, despues) → { campo, mensaje } | null`:** el primer faltante de `despues` que no está en `antes` o que mide más que en `antes`. `campo` es `desde` en días y francos, y `horas` en horas.
  - **`evaluarLicencia(estado, entrada, { hoy, feriados, editadaId, persona }) → { datos, error, vista }`:** `validarLicencia`, después `calcular` sin la fila y con ella, y después `problemaDeLaCarga`.
    - `vista` es `{ dias_habiles, texto_dias, texto_reparto, queda_texto, antes_del_arranque, texto_antes_del_arranque }`.
    - `texto_dias`: «5 días hábiles» o «5 días hábiles de 7 corridos»; en horas, «2 horas».
    - `queda_texto`: «Te quedan 22 de 25.», «Te quedan 23 de 42 horas de franquicia.» o «Usás 1,5 horas a favor de octubre. Te quedan 0.»
    - `texto_antes_del_arranque`: «Es anterior al saldo inicial: queda como historia y no descuenta.»
    - Sin modalidad, `sinModalidad`; sin arranque, `sinArranque`. Las dos van con `campo: null`.

- [ ] **Step 1: Escribir los tests que fallan:**
  - **`camposDelSaldoInicial`:**
    - `PLANTA` da las claves `['vacaciones-2024', 'vacaciones-2025', 'vacaciones-2026', 'franquicias', 'estudios', 'medica', 'familiar']`, y el máximo de `vacaciones-2026` es 10;
    - con arranque `'2026-03-02'`, no hay `vacaciones-2026`;
    - en contrato, `horas_no_utilizadas` con paso 0,5 y sin `franquicias`;
    - con `estudios: null`, sin `estudios`.
  - **`validarSaldoInicial`:**
    - una clave que falta da error con su clave;
    - 11 en `vacaciones-2026` da «Escribí un número de 0 a 10.»;
    - 2,5 en `franquicias` da `textoSaldo(42)`;
    - 6,5 en `horas_no_utilizadas` pasa, y 6,25 da `saldoMedias`.
  - **`validarAnio`:** 12 días da `diasVacaciones`, `'otro'` da `estudios` y 2023 (con hoy de 2026) da `anio`.
  - **«corregir el saldo inicial deja un faltante»:**
    - con arranque `'2026-10-26'`, 2026 de 20 días, saldos 2024 = 0, 2025 = 0 y 2026 = 10, y vacaciones del 01/06 al 16/06/2027 (12 días hábiles, `SIN_FERIADOS`), no hay faltantes;
    - con el saldo de 2026 en 0, `faltantesDe` da «Revisá tus vacaciones: para el 15/06/2027 faltan 2 días habilitados.».
  - **«dar de baja un feriado»:** `PLANTA` con saldo 2024 = 4 y los feriados `{'2026-11-09'}` no tiene faltantes; sin el feriado, da «Revisá tus vacaciones: para el 09/11/2026 falta 1 día habilitado.».
  - **«un tope que se pasa»:**
    - con saldo médica 23, una médica nueva de 3 días hábiles da `problemaDeLaCarga` «Con esta licencia pasarías los 25 días de atención médica de 2026.» en `desde`;
    - con saldo franquicias 40, una de 3 h da «Con esta licencia pasarías las 42 horas de franquicia de 2026.» en `horas`;
    - con estudios universitario y saldo 13, 3 días dan el texto de estudios con 15.
  - **«un franco en un mes sin francos»:** `PLANTA` y un franco el 01/02/2027 dan «En febrero de 2027 no tenés francos para usar.».
  - **«horas a favor de más»:** `CONTRATO` y 2 h el 29/10 dan «En octubre de 2026 te quedan 1,5 horas a favor.».
  - **«corregir otro campo de una fila en faltante no frena»:** sobre el caso del 15/06/2027, `evaluarLicencia` con la misma fila y otra nota da `error` null.
  - **«una modalidad que cambia» (Review Focus 1):** `CONTRATO` con `modalidad: 'planta'` no tira; sus horas a favor no cuentan en ningún saldo y `fueraDeLaModalidad` las marca.
  - **`evaluarLicencia`:**
    - con `PLANTA` y vacaciones del 03/11 al 09/11/2026 (editando la cargada), `vista.texto_reparto` es el de la Task 2 y `vista.texto_dias` es «5 días hábiles de 7 corridos»;
    - sin arranque, `sinArranque`.
- [ ] **Step 2:** Correr: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** Correr: PASS.
- [ ] **Step 5: Commit:** `feat(mi-espacio): el saldo inicial, el cálculo completo y los faltantes`.

### Task 6: El panel como datos: el Resumen, la lista de licencias y las tablas de horas extras

**Files:**
- Create: `services/miEspacioResumen.js`, `tests/mi-espacio-resumen.test.js`

**Interfaces:**
- Consumes: `calcular`, `faltantesDe`, los textos (Tasks 2 a 5); `feriadosDelAnio`, `diaDeLaSemana` y `ultimoDiaHabilDelMesCon` (entrega 1 y Task 4).
- Produces (puras; ninguna tira; todo número es un número y todo texto, un texto):
  - **Formatos:** `numeroTexto(n)` ('10,5'), `diaCorto(fecha)` ('Vie 23/10/2026'), `diaLargo(fecha)` ('viernes 30/10'), `mesEnFrase('AAAA-MM')` ('octubre de 2026') y `mesTitulo('AAAA-MM')` ('Octubre 2026').
  - **`resumenDe({ persona, estado, calculo, hoy, feriados, hoyYManana }) → Resumen`:** `{ modalidad: { clave, texto } | null, anio, al_texto: 'Al lunes 26/10/2026', mensaje, abrir_saldos (con modalidad y sin arranque), persona: { nombre, ve_companeros: esAdmin(rol), audita: esAuditor(rol), es_superadmin }, marca, vence_pronto, faltantes: string[], tanques: { vacaciones, otros } | null, pastillas, extraordinaria, tipos: [{ tipo, nombre, queda_texto }] (las opciones de «Cargar licencia»), hoy_y_manana }`.
    - `extraordinaria`: «Atención médica extraordinaria: sin tope y aparte de los 25 días. No usaste en 2026.» (o «Usaste 3 días en 2026.»).
  - **`vence_pronto`:** `[{ fecha, dia: '30', mes: 'oct', cuando: 'Viernes 30/10', titulo, detalle, accion: { texto, tipo } }]`, por fecha:
    - el franco o las horas a favor del mes en curso sin usar, en su `ultimo_dia_habil`: detalle «Es el último día hábil del mes. Si no lo usás, queda como no utilizado previamente.» y acción «Cargarlo», o detalle «Es el último día hábil del mes. Lo que no uses pasa a horas no utilizadas previamente.» y acción «Usarlas»;
    - desde el 1/10, los disponibles de la ordinaria que vence el 31/12 de este año: detalle «Ese día vence la licencia 2024.» y acción «Cargar vacaciones».
  - **`tanques.vacaciones`:** `{ numero, unidad: 'días', pie: 'de 3 licencias', capacidad, aria, capas: [{ clase, n, nombre, nota }] }`, de abajo hacia arriba: las ordinarias con disponibles (la que vence este año, `'vence'`; las demás alternan `'tinta'` y `'medio'`; la nota es su vencimiento, o «La primera mitad» si falta la segunda), después `'cargadas'` («Cargados para noviembre», «… para noviembre y diciembre») y `'por_habilitar'`, si no son 0.
  - **`tanques.otros`:** `[{ clave, nombre, numero, unidad, de, valor, total, vence, pestana, aria }]`. En planta, Franquicias, Estudios (si estudia), Atención médica y Grupo familiar. En contrato, Horas a favor (la de este mes, con `vence` si quedan y `pestana: 'horas'`) en lugar de Franquicias.
  - **`pastillas`:** `{ titulo: 'Francos compensatorios' | 'Horas a favor', meses: [{ numero, mes, nota, estado: 'vence' | 'disponible' | 'pendiente' }], previo | null }`: en planta, los meses de uso de este mes a dos más, con francos; en contrato, este mes y el siguiente. `pendiente` es el que todavía suma.
  - **`filasDeLicencias(estado, calculo, { anio, hoy, persona, vinculos = new Map() }) → { anio, anios, filtros, licencias, saldo_inicial }`:**
    - `anios`: de (año del arranque − 2) al año de hoy + 1;
    - `filtros`: `[{ tipo: 'todas' | <tipo>, nombre, cantidad }]`, solo los tipos con filas del año, en plural (Franquicias, Francos, Usos autorizados, Grupo familiar; el resto, como `NOMBRES_TIPO`);
    - cada licencia, de la más nueva a la más vieja: `{ id, tipo, tipo_nombre, desde, hasta, horas, fechas_texto ('03/11 al 09/11/2026', 'Vie 23/10/2026'), cantidad_texto ('7 días corridos, 5 hábiles', '2 días hábiles', '1 día', '2 horas', '7 horas, el día entero'), proxima, de_licencias_texto ('De la licencia 2024.'), antes_del_arranque («Antes del saldo inicial: no descuenta»), fuera_de_la_modalidad, nota, mostrar, mostrar_texto («Tus compañeros ven «<nombre> no está».», solo con `ve_companeros` y en día entero), configuracion: { texto, insignia } | null, puede_borrar, solo_hasta, fechas_fijas }`. Los cuatro últimos salen de `vinculos` (Task 10); sin vínculo, `null`, `true`, `false` y `false`;
    - `saldo_inicial`: `{ fecha, cargado_texto: 'Cargado el 26/10/2026', texto }`.
  - **`tablaDeHorasExtras(estado, calculo, { anio, hoy, feriados })`:** los meses trabajados del año, del más nuevo al más viejo, con `dias_por_mes: { 'AAAA-MM': [{ id, fecha, fecha_texto, horario, horas_texto, nota }] }`, `totales_por_mes` y `mes_en_curso`.
    - En planta, `{ modalidad: 'planta', meses: [{ mes, mes_texto, horas_texto, dias_texto, francos, uso_texto, situacion }], uso_autorizado: { puede, texto } }`. Situaciones: 'El mes sigue sumando', 'Disponible desde el 02/11', '1 usado el 23/10 · 1 para usar hasta el 30/10', 'Todos usados', 'No llega a 7 horas: no genera franco' y 'No utilizado previamente'.
    - En contrato, `{ modalidad: 'contrato', meses: [{ mes, mes_texto, horas_texto, a_favor_texto, usadas_texto, usadas_detalle, situacion }], no_utilizadas: { total_texto, filas: [{ titulo, texto }], uso_autorizado } }`. Situaciones: 'El mes sigue sumando', '1,5 h para usar hasta el 30/10', '1,5 h no utilizadas previamente', 'Todas usadas' y 'Antes del saldo inicial: está en el saldo'. La fila del saldo es «Del saldo inicial», «6,5 horas».
  - **`proximoFeriadoDe(filasFeriados, hoy) → { fecha, cuando: 'Lunes 23/11', nombre } | null`:** el próximo que rige y cae de lunes a viernes, de este año o del siguiente.

- [ ] **Step 1: Escribir los tests que fallan** en `tests/mi-espacio-resumen.test.js`, sobre la fixture, con `SIN_FERIADOS`:
  - **«`PLANTA`: Vence pronto»:** `marca` true y, en este orden, `{ fecha: '2026-10-30', cuando: 'Viernes 30/10', titulo: '1 franco compensatorio de octubre', accion: { texto: 'Cargarlo', tipo: 'franco' } }` y `{ fecha: '2026-12-31', titulo: '3 días de la licencia 2024', accion: { texto: 'Cargar vacaciones', tipo: 'vacaciones' } }`.
  - **«`PLANTA`: los tanques»:**
    - vacaciones `numero` 33, `capacidad` 48, `aria` «Vacaciones: 33 días hábiles disponibles. Ver tus licencias» y las capas `vence` 3 «Vence el 31/12/2026», `tinta` 20 «Vence el 31/12/2027», `medio` 10 «La primera mitad», `cargadas` 5 «Cargados para noviembre» y `por_habilitar` 10 «Se habilitan el 1/1/2027»;
    - otros: Franquicias 25 «de 42 horas», Estudios 9 «de 15 días», Atención médica 22 «de 25 días» y Grupo familiar 23 «de 25 días».
  - **«`PLANTA`: las pastillas»:**
    - Octubre 1 «Hasta el viernes 30/10» con estado `vence`;
    - Noviembre 1 «Por las horas de septiembre» con estado `disponible`;
    - Diciembre 1 «Octubre sigue sumando» con estado `pendiente`;
    - previo `{ numero: '1', titulo: 'Agosto', nota: 'No utilizado previamente' }`.
  - **«`CONTRATO`»:**
    - vacaciones 13, con las capas `tinta` 5 y `medio` 8, y `por_habilitar` 7;
    - otros: Horas a favor `numero` '1,5' «de 10,5 en octubre», con `vence` true y `pestana` 'horas'; Estudios 7 «de 10 días»; Atención médica 25; Grupo familiar 21;
    - pastillas: Octubre '1,5' (`vence`) y Noviembre '4' (`pendiente`), y previo '6,5' «Horas de 2026»;
    - `vence_pronto` tiene solo «1,5 horas a favor de octubre»;
    - `persona.ve_companeros` es false.
  - **«Vence pronto, desde el 1/10»:** `PLANTA` con hoy `'2026-09-30'` no trae la licencia 2024.
  - **«sin modalidad y sin arranque»:** con `modalidad: null`, `mensaje` es `sinModalidad` y `tanques` es null; con modalidad y sin arranque, `abrir_saldos` es true.
  - **`filasDeLicencias(PLANTA, …, { anio: 2026 })`:**
    - filtros `[['todas', 6], ['vacaciones', 1], ['franquicia', 2], ['estudios', 1], ['medica', 1], ['franco', 1]]`;
    - la primera fila es '03/11 al 09/11/2026', '7 días corridos, 5 hábiles', con `proxima` true y 'De la licencia 2024.';
    - la franquicia del 15/10 va con `antes_del_arranque` true;
    - `saldo_inicial.texto` es «Antes de empezar con Mi espacio: de vacaciones, quedaban 8 días de la licencia 2024, 20 de la 2025 y 10 de la 2026. En 2026 ya habías usado 17 horas de franquicia, 6 días de estudios, 3 de atención médica y 2 de atención del grupo familiar.»
  - **«fuera de la modalidad» (Review Focus 1):** `CONTRATO` en planta lista sus horas a favor con «No corresponde a tu modalidad actual: no cuenta.».
  - **`tablaDeHorasExtras(PLANTA, …)`:**
    - las cinco filas de junio a octubre, con los textos de la maqueta (Octubre '10,5 h', '3 días', 1, 'Diciembre 2026', 'El mes sigue sumando'; …; Agosto, '1 usado el 23/10 · 1 para usar hasta el 30/10');
    - `dias_por_mes['2026-10']` en orden: 'Jue 22/10' '19:00 a 22:00' '3 horas', 'Mié 14/10' '17:00 a 21:00' '4 horas' y 'Mar 06/10' '18:00 a 21:30' '3,5 horas'.
  - **`tablaDeHorasExtras(CONTRATO, …)`:**
    - Septiembre '10,5 h', 'Octubre 2026', '9 h', '09/10: 7 h · 20/10: 2 h' y '1,5 h para usar hasta el 30/10';
    - no utilizadas '6,5 horas en 2026'.
  - **`proximoFeriadoDe`:** con un feriado del 23/11/2026 en la tabla, desde el 26/10 da 'Lunes 23/11'. Uno que cae domingo se saltea.
- [ ] **Step 2:** `node --test tests/mi-espacio-resumen.test.js`: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** Correr: PASS.
- [ ] **Step 5: Commit:** `feat(mi-espacio): el Resumen, la lista de licencias y las tablas de horas extras como datos`.

### Task 7: La API de lectura

**Files:**
- Create: `services/miEspacioDatos.js`, `controllers/miEspacioController.js`, `tests/mi-espacio-api.test.js`
- Modify: `routes/index.js`, `tests/permisos.test.js`

**Interfaces:**
- Consumes: `feriadosEntre` y `filasDeFeriados` (entrega 1); `calcular`, `camposDelSaldoInicial` y `anioVigente` (Tasks 2 a 5); `resumenDe`, `filasDeLicencias`, `tablaDeHorasExtras` y `proximoFeriadoDe` (Task 6).
- Produces:
  - **`personaDe(usuarioId, conexion = pool) → { id, nombre_completo, rol, vinculo, email, activo } | null`.**
  - **`estadoDe(usuarioId, conexion = pool) → Estado`:** las licencias suman `mostrar`, `nota`, `licencia_oficial_id`, `oficial` y `sin_pasar`, y las horas extras, su `nota`.
  - **`estadosDe(usuarioIds, conexion = pool) → Map<id, Estado>`:** seis consultas para todos, sin N+1.
  - **`feriadosPara(estados, hoy) → Promise<Set>`:** `feriadosEntre`, del 01/01 de min(año de hoy − 3, la fecha más vieja cargada) al 31/12 de max(año de hoy + 2, la más nueva).
  - **`contextoDe(usuarioId, hoy, conexion = pool) → { persona, estado, feriados, calculo }`.**
  - **Las rutas** (todas con `authMiddleware`, sobre `req.user.userId`):
    - **`GET /api/mi-espacio/resumen`** (`verResumen`) → `{ success, data: Resumen }`, con `hoy_y_manana: { ausentes: [], proximo_feriado }` hasta la Task 12.
    - **`GET /api/mi-espacio/licencias?anio=`** (`listarLicenciasMias`) → `filasDeLicencias`. Sin modalidad, `{ modalidad: null, mensaje }`.
    - **`GET /api/mi-espacio/horas-extras?anio=`** (`listarHorasExtras`) → `tablaDeHorasExtras`, con el mismo vacío.
    - **`GET /api/mi-espacio/anio/:anio`** (`verAnio`) → `{ anio, dias_vacaciones, estudios, heredado, texto_mitades }`. `texto_mitades`: «Se habilitan en dos mitades: 10 el 1/7/2026 y 10 el 1/1/2027 (con 15, 8 y 7; con 25, 13 y 12). Cada licencia vence el 31/12 de dos años después.»
    - **`GET /api/mi-espacio/saldo-inicial`** (`verSaldoInicial`) → `{ arranque, modalidad, campos: [...con valor] }`.
    - Un `anio` que no es un entero de 2000 a 2100 da 400 en `anio`.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **`tests/mi-espacio-api.test.js`:**
    - base `rpad_test_mi_espacio_api`, con el armado de `tests/licencias-api.test.js` (servidor propio, `LUNES` y `q(n)`, «la API usa la fecha real»);
    - usuarios: superadmin, adminA, adminB, editor, lector y colab, con su `vinculo` puesto por SQL;
    - un `beforeEach` que borra las seis tablas, `usuarios_licencias` y `feriados`.
    - Los tests:
      - **«sin vínculo»:** el lector sin vínculo recibe 200 con `modalidad: null` y `mensaje: sinModalidad` en las cinco rutas.
      - **«lo que llega de la base» (Review Focus 2):** con `licencias` (horas `7.5`), `horas_extras` (`'19:00:00'`) y `saldos` (`8.0`) cargados por SQL, `GET /licencias` da `horas: 7.5` (número), `GET /horas-extras` da `horario: '19:00 a 22:00'`, y todas las fechas son `'AAAA-MM-DD'`.
      - **«lo ajeno no se ve»:** las licencias de adminB no aparecen en el `GET /licencias` de adminA.
      - **«el saldo inicial sin arranque»:** los campos se arman con hoy.
      - **«`anio` inválido»:** `?anio=abc` da 400 en `anio`.
  - **`tests/permisos.test.js`:**
    - una lista nueva, `RUTAS_MI_ESPACIO`, con las cinco rutas de lectura, y su `describe('Mi espacio')`: «el visitante sin sesión recibe 401». Las Tasks 8, 11 y 12 le suman las suyas;
    - el lector y el colaborador pueden usar `GET /mi-espacio/resumen`, `/mi-espacio/licencias`, `/mi-espacio/horas-extras`, `/mi-espacio/saldo-inicial` y `/mi-espacio/anio/2026`.
- [ ] **Step 2:** `node --test tests/mi-espacio-api.test.js tests/permisos.test.js`: FAIL (404 en las rutas).
- [ ] **Step 3: Implementar.** Las rutas van después de las de Mi firma.
- [ ] **Step 4:** Correr los dos: PASS. El de permisos corre contra `rpad_rama_mi_espacio`, que ya tiene las tablas.
- [ ] **Step 5: Commit:** `feat(mi-espacio): la API de lectura: Resumen, licencias, horas extras, el año y el saldo inicial`.

### Task 8: Cargar, corregir y borrar licencias, y el cálculo previo (sin Configuración todavía)

**Files:**
- Modify: `controllers/miEspacioController.js`, `routes/index.js`, `tests/mi-espacio-api.test.js`, `tests/permisos.test.js` (el Step 1 le suma rutas: corrección de la Task 1, al leer el main nuevo)

**Interfaces:**
- Consumes: `evaluarLicencia` (Task 5); `contextoDe` (Task 7); `idPositivo` (`services/proyectosReglas.js`); `esAdmin` (`services/usuariosReglas.js`).
- Produces:
  - **`enTransaccion(fn)`**, propio del controlador. Bloquea la fila de la persona (`SELECT id FROM usuarios WHERE id = ? FOR UPDATE`) antes de leer el `Estado`; la Task 10 lo cambia por `bloquearUsuarios` cuando puede haber paso.
  - **`POST /api/mi-espacio/licencias/calculo`** (`calcularLicencia`): `{ ...licencia, id? }` → 200 `{ success, data: { error, vista } }`. No guarda nada y un error va dentro de `data`.
  - **`POST /api/mi-espacio/licencias`** (`cargarLicenciaMia`): 201 `{ success, data: { id }, message: 'Licencia cargada.' }`. `mostrar` se guarda solo para `esAdmin`; si no, 0.
  - **`PUT /api/mi-espacio/licencias/:id`** (`corregirLicenciaMia`): 200 `{ success, data: { id }, message: 'Licencia corregida.', avisos: [] }`.
  - **`DELETE /api/mi-espacio/licencias/:id`** (`borrarLicenciaMia`): baja lógica, 200 `{ success, message: 'Licencia borrada.' }`.
  - **Los errores:**
    - el orden es: un id que no pasa `idPositivo`, ajeno, inexistente o dado de baja → 404 `noEncontrada`; después, `evaluarLicencia` → 400 con su `campo` (`campo: null` sin modalidad o sin arranque);
    - el `POST /licencias/calculo` va antes del `PUT /licencias/:id`.

- [ ] **Step 1: Escribir los tests que fallan:**
  - **«alta y lista»:** un admin con arranque y año cargados por SQL carga una médica de `q(0)` a `q(2)` y la ve en `GET /licencias` con `cantidad_texto` '3 días hábiles'.
  - **«cada 400 con su campo»:**
    - `tipo: 'otro'` va en `tipo`;
    - `desde` `'2026-02-30'` va en `desde`;
    - `q(5)` a `q(6)` (fin de semana) va en `desde` con `sinDiasHabiles`;
    - una franquicia de 2,5 h va en `horas`;
    - una nota de 201 va en `nota`;
    - sin arranque, `campo: null` con `sinArranque`.
  - **«el tope frena una carga nueva»:** con saldo médica 24, una de 2 días da 400 con `textoTope('medica', año)`.
  - **«una superpuesta no se guarda»** y **«dos POST simultáneos que se superponen guardan uno solo» (Review Focus 3).**
  - **«lo anterior al arranque se guarda y no descuenta»:** con arranque en `q(7)`, una médica en `q(0)` da 201 y el tanque de atención médica no baja.
  - **«el cálculo no guarda»:** `POST /licencias/calculo` con unas vacaciones da `vista.texto_reparto` y no deja ninguna fila. Con un error, 200 y `data.error.campo`.
  - **«lo ajeno es 404»:** el `PUT` y el `DELETE` de adminA sobre una licencia de adminB, `'abc'`, `'1e3'` y una dada de baja.
  - **«borrar es baja lógica»:** la fila queda con `activo = 0`.
  - **«el lector no guarda `mostrar`»:** su licencia queda con `mostrar = 0`.
  - **`tests/permisos.test.js`:** `RUTAS_MI_ESPACIO` suma `['POST', '/mi-espacio/licencias']`, `['POST', '/mi-espacio/licencias/calculo']`, `['PUT', '/mi-espacio/licencias/1']` y `['DELETE', '/mi-espacio/licencias/1']`.
- [ ] **Step 2:** Correr: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** Correr `tests/mi-espacio-api.test.js` y `tests/permisos.test.js`: PASS.
- [ ] **Step 5: Commit:** `feat(mi-espacio): cargar, corregir y borrar licencias, con el cálculo previo`.

### Task 9: Las licencias de Configuración en un servicio compartido, y la insignia

**Files:**
- Create: `services/licenciasOficialesService.js`
- Modify: `controllers/licenciasController.js`, `public/js/usuarios.js`, `public/configuracion.html`, `tests/licencias-api.test.js`, `tests/usuarios-frontend.test.js`, `tests/paginas.test.js`

**Interfaces:**
- Produces (en `services/licenciasOficialesService.js`; reciben la conexión de la transacción y el actor, nunca `req`, y no abren ni cierran la transacción):
  - **Lo que se mueve tal cual desde el controlador:**
    - `COLUMNAS_LICENCIA` y `DESDE_LICENCIA` (en el controlador se llaman `COLUMNAS` y `DESDE`: corrección de la Task 1, al leer el main nuevo), que suman `EXISTS (SELECT 1 FROM mi_espacio_licencias m WHERE m.licencia_oficial_id = l.id AND m.oficial = 'creada' AND m.activo = 1) AS desde_mi_espacio`;
    - `buscarLicenciaOficial(conexion, id)` (en el controlador, `buscarLicencia`);
    - `firmanteTitular(conexion = pool)`;
    - `autorizables(conexion, titular)` y `conSusLicencias(personas, hoy)`;
    - `bloquearUsuarios(conexion)`;
    - `periodo` y `MENSAJE_SOLO_TITULAR`, exportado (corrección de la Task 1, al leer el main nuevo: `rechazoDeLaBase` arma sus mensajes con `periodo`, `cambiarLicencia` devuelve el 403 con `MENSAJE_SOLO_TITULAR` y el alta del controlador lo sigue usando antes de abrir la transacción).
  - **`rechazoDeLaBase(conexion, { licenciaId, usuarioId, desde, hasta, autorizadoId, autorizadoNuevo }) → Rechazo | null`.** Un `Rechazo` es `{ status, error, campo, motivo }`, con los mismos `status`, `error` y `campo` de hoy (hoy devuelve el array `[status, mensaje, campo]` y el controlador lo esparce en `responderError(res, ...rechazo)`: el alta y la edición de Configuración pasan a leer el objeto; corrección de la Task 1, al leer el main nuevo). Los motivos:
    - `'rol'`;
    - `'superpuesta'`;
    - `'autorizada_sin_dias'`, que suma `licencia: { desde, hasta, nombre }`;
    - `'no_es_titular'`;
    - `'no_autorizable'`;
    - `'autorizado_sin_dias'`.
  - **`cargarLicencia(conexion, { usuarioId, desde, hasta, autorizadoId = null, actorId, hoy }) → { licencia, auditoriaId } | { rechazo }`:** `validarFechasNuevas` (motivo `'fechas'`, 400 en `fechas`), `rechazoDeLaBase`, el INSERT y `licencia_cargada`.
  - **`cambiarLicencia(conexion, { licenciaId, desde, hasta, autorizadoPedido, actorId, hoy }) → { antes, despues, auditoriaId, sinCambios } | { rechazo }`.** El orden de hoy:
    1. 404 (`'no_encontrada'`);
    2. `validarEdicion` (`'edicion'`, con su `codigo`);
    3. 403 `MENSAJE_SOLO_TITULAR` (`'solo_titular'`);
    4. `rechazoDeLaBase`;
    5. `sinCambios`, sin UPDATE; si no, el UPDATE con `nota_autorizacion_id = NULL` y `licencia_editada`.
  - **`anularLicenciaDe(conexion, { licenciaId, actorId, hoy }) → { licencia, auditoriaId } | { rechazo }`:** 404 o 409 `'no_se_anula'`, después el UPDATE y `licencia_anulada`.
  - **`licenciasController.js`:** sigue con lo del pedido (los controles antes de la transacción, abrirla y cerrarla, responder y `avisarSiEsDelSuperadmin` después del commit) y llama al servicio. `aRespuesta` suma `desde_mi_espacio: Boolean(Number(...))`.
  - **`usuarios.js`:** `filaLicencia` suma `<span class="etiqueta etiqueta-mi-espacio">Cargada desde Mi espacio</span>` con `l.desde_mi_espacio === true`. `configuracion.html` suma el estilo de `.etiqueta-mi-espacio` y sube `usuarios.js` a `VERSION_PANTALLAS`.

- [ ] **Step 1: Escribir los tests que fallan:**
  - **`tests/licencias-api.test.js`** (los existentes no se tocan):
    - **«la insignia»:** una licencia de Configuración apuntada por una fila `creada` y activa de `mi_espacio_licencias` (por SQL) trae `desde_mi_espacio: true` en `GET /usuarios/licencias`; con `unida`, o con la fila dada de baja, `false`;
    - **«el servicio compartido»,** llamado en el proceso (importado después de apuntar `DB_NAME`, como `tests/metricas-foto.test.js`):
      - `cargarLicencia` con una superposición devuelve `{ rechazo: { status: 409, campo: 'fechas', motivo: 'superpuesta' } }` y no escribe;
      - siendo la persona autorizada sin días, `motivo: 'autorizada_sin_dias'` con `licencia.desde` y `licencia.hasta`;
      - `cambiarLicencia` sin cambios devuelve `sinCambios: true`, no deja historial y conserva `nota_autorizacion_id`.
  - **`tests/usuarios-frontend.test.js`:** `filaLicencia({ ..., desde_mi_espacio: true })` trae «Cargada desde Mi espacio», y con `false` (o sin la clave), no.
  - **`tests/paginas.test.js`:** `VERSION_PANTALLAS = '20261209'`.
- [ ] **Step 2:** Correr los tres: FAIL.
- [ ] **Step 3: Implementar.** Primero mover sin cambiar nada, con la suite de licencias en verde; después, los motivos y la insignia.
- [ ] **Step 4:** Correr los tres, y después `tests/licencias-reglas.test.js`, `tests/permisos.test.js` y los de notas que leen licencias (`tests/notas-motor.test.js`): PASS.
- [ ] **Step 5: Commit:** `refactor(licencias): el alta, la edición y la anulación en un servicio compartido, con la insignia «Cargada desde Mi espacio»`.

### Task 10: El paso a Configuración desde Mi espacio

**Files:**
- Create: `services/miEspacioPaso.js`
- Modify: `services/miEspacioReglas.js`, `services/miEspacioDatos.js`, `controllers/miEspacioController.js`, `tests/mi-espacio-reglas.test.js`, `tests/mi-espacio-api.test.js`

**Interfaces:**
- Consumes: el servicio de la Task 9; `puedeTenerLicencia` y `puedeAnularse` (`licenciasReglas.js`); `diaHabilAnterior` (`notasDigitalesCalendario.js`).
- Produces:
  - **En `miEspacioReglas.js` (puras):**
    - **`vinculoDe(fila, oficial, tocadaPorOtros) → { estado, oficial, sin_cubrir? }`**, con `estado`:
      - `'ninguno'`, `'creada'` (Mi espacio la maneja), `'creada_cambiada'` (administración la editó), `'creada_anulada'` o `'unida'`;
      - `'unida_sin_cubrir'`, con `sin_cubrir: { desde, hasta }`: el primer y el último día de la fila fuera de la de Configuración (toda la fila, si está anulada).
    - **`textoDelVinculo(vinculo, fila, { hoy, sinPasar, puedeTener }) → { texto, insignia: 'creada' | 'unida' | 'aviso' } | null`**, con los textos de Global Constraints:
      - `creada`, `TEXTO_TAMBIEN_EN_CONFIGURACION` (`textoSigueEnConfiguracion` si dejó de ser de día entero);
      - `creada_cambiada`, `textoEnConfiguracion` + `TEXTO_NO_SE_COPIA`; `creada_anulada`, `TEXTO_ANULADA_POR_ADMINISTRACION`;
      - `unida`, `textoUnida`; `unida_sin_cubrir`, `textoYaNoCubierta`;
      - con `sin_pasar`, `textoNoPaso`; menos de 7 horas, de quien puede tener licencia, `TEXTO_NO_DIA_ENTERO`.
    - **`pasoDeLaCarga({ fila, rol, hoy, cruzadas }) → { accion: 'nada' } | { accion: 'unir', oficial } | { accion: 'avisar', sin_pasar } | { accion: 'crear' }`:**
      - `nada` si el rol no puede tener licencia, si no es de día entero o si `hasta < hoy`;
      - `unir` con la que cubre todas sus fechas;
      - `avisar` con `textoSuperpuestaConConfiguracion` de la primera que se cruza;
      - si no, `crear`.
    - **`pasoDeLaCorreccion({ anterior, fila, vinculo, rol, hoy, cruzadas, autorizadoCambia }) → { accion: 'nada' | 'cambiar' | 'anular' | 'quedar' } | { accion: 'soltar', luego } | { error: { campo, mensaje } }`:**
      - **en `creada`:**
        - si deja de ser de día entero, `anular` si `puedeAnularse`; si no, `quedar`;
        - si cambian las fechas, con `anterior.hasta < hoy` es error `fechasFijas`; con `anterior.desde < hoy` y otro `desde`, error `soloHasta` en `desde`; si no, `cambiar`;
        - si solo cambia la persona autorizada, `cambiar`;
        - si no, `nada`;
      - en `creada_cambiada`, `creada_anulada` y `unida` (si sigue cubierta y de día entero), `nada`;
      - en `unida` que ya no cubre, o que deja de ser de día entero, `soltar` y `luego` = `pasoDeLaCarga`;
      - en `ninguno`, `pasoDeLaCarga`.
    - **`pasoDeLaBaja({ vinculo, hoy }) → { accion: 'nada' | 'anular' } | { error }`:** en `creada`, `anular` si `puedeAnularse` y, si no, `error` con `yaEmpezo` (409, campo null).
  - **En `miEspacioDatos.js`:**
    - `oficialesDe(ids, conexion)`: un `Map` de id a `{ id, desde, hasta, anulada }`;
    - `tocadasPorOtros(usuarioId, conexion)`: un `Set` de los ids de `usuarios_auditoria` con `licencia_editada` o `licencia_anulada`, `JSON_VALUE(detalle, '$.licencia_id')` y `(actor_id IS NULL OR actor_id <> ?)`;
    - `oficialesQueSeCruzan(conexion, usuarioId, desde, hasta)`: las no anuladas.
  - **En `miEspacioPaso.js`, con la transacción abierta:**
    - `aplicarCarga(conexion, { persona, fila, hoy, autorizadoId })`;
    - `aplicarCorreccion(conexion, { persona, anterior, fila, hoy, autorizadoPedido })`;
    - `aplicarBaja(conexion, { persona, fila, hoy })`.
    - Devuelven `{ licencia_oficial_id, oficial, sin_pasar, avisos }`, o `{ error: { status, campo, mensaje } }`, que deshace todo. Un rechazo se interpreta así:
      - `autorizada_sin_dias` → 409 en `fechas` con `textoAutorizadaSinDias(licencia.desde, licencia.hasta)`;
      - `campo === 'autorizado_id'` → su `status` y su mensaje, sin guardar;
      - cualquier otro → se guarda con `sin_pasar` = el mensaje, cortado a 200.
  - **El controlador:**
    - con `puedeTenerLicencia(rol)` y una fila de día entero, `enTransaccion` usa `bloquearUsuarios` en lugar de la fila propia, siempre antes de leer;
    - **solo las vacaciones dejan persona a cargo** (corrección del usuario a la spec, sección 6): un `autorizado_id` con valor (ni `null` ni `''`) en un tipo que no es `vacaciones` da 400 en `autorizado_id` con `autorizadoSoloVacaciones`, antes de abrir la transacción. Los demás tipos de día entero pasan a Configuración con `autorizadoId = null`;
    - en vacaciones, `autorizado_id` se acepta solo del titular, como en Configuración (lo controla `rechazoDeLaBase`);
    - **corregir el tipo de unas vacaciones del titular con persona a cargo** (una `creada` cuya licencia de Configuración tiene `autorizado_id`; respuesta del usuario, 26/10/2026):
      - se puede hasta 2 días hábiles antes de que empiecen, inclusive. Ese último día es `limiteParaCambiarTipo(desde) = diaHabilAnterior(diaHabilAnterior(desde))`, con el calendario de las Notas Digitales (`esDiaHabil`, los 9 fijos), que es el que decide qué día sale la nota de la víspera (la que adelanta los datasets e informa quién queda a cargo);
      - hasta ese día, el cambio a otro tipo le saca la persona a cargo a la de Configuración (`cambiarLicencia` con `autorizadoPedido = null`), y el cálculo previo lo avisa con `AVISO_SIN_PERSONA_A_CARGO`;
      - después, 400 en `tipo` con `tipoFijo`;
      - `limiteParaCambiarTipo` es pura y va en `miEspacioReglas.js`;
      - en cualquier otro caso (otra persona, o vacaciones sin persona a cargo), cambiar el tipo no toca Configuración, como dice la spec;
    - el `GET /licencias` pasa `vinculos` a `filasDeLicencias`: `textoDelVinculo` más `puede_borrar`, `solo_hasta` y `fechas_fijas` de una `creada`.
  - **`POST /licencias/calculo`** suma `data.paso: { pasa, avisos: [texto], firmante: { soy_titular, puede_autorizar, vispera, notas_de_hoy } | null, sin_pasar_previsto }`:
    - `avisos` lleva `AVISO_DEL_PASO`, más `AVISO_DEL_PASO_SUPERADMIN` para el superadmin y, para el titular, `AVISO_NOTAS_DE_HOY` con `desde <= hoy` y `AVISO_SIN_PERSONA_A_CARGO` en un tipo que no es vacaciones;
    - `puede_autorizar` es `tipo === 'vacaciones'`;
    - `vispera` es `diaHabilAnterior(desde)`, con los 9 fijos, como Configuración;
    - `sin_pasar_previsto` es el texto de `unir` o de `avisar`, si toca.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **Puros (`tests/mi-espacio-reglas.test.js`):** cada rama de `vinculoDe`, `pasoDeLaCarga`, `pasoDeLaCorreccion` y `pasoDeLaBaja`, con fechas fijas (hoy `'2026-10-26'`):
    - **«ya empezó» quiere decir antes de hoy:** una `creada` que empieza hoy se anula; una que empezó ayer da `yaEmpezo`;
    - la franquicia de 7 h que pasa a 3 da `anular` antes de empezar y `quedar` después;
    - una `unida` corrida fuera de la de administración da `soltar` → `crear`;
    - un lector, siempre `nada`.
  - **API (`tests/mi-espacio-api.test.js`, `describe('el paso a Configuración')`):**
    - **«alta»:** unas vacaciones de adminA de `q(0)` a `q(4)` dejan en `usuarios_licencias` una fila con `usuario_id` = `creado_por` = adminA, sin tipo; la de Mi espacio queda `creada`; hay un `licencia_cargada` con `actor_id` adminA; y Mailpit queda vacío también con el superadmin.
    - **«no pasa»:** el lector; una franquicia de 3 h (la de 7 h sí pasa); una ya terminada; la `fila.configuracion` de la de 3 h es `TEXTO_NO_DIA_ENTERO`.
    - **«unida y superpuesta»:** con una de administración de `q(0)` a `q(9)`, una de `q(2)` a `q(3)` queda `unida` y no crea otra; una de `q(8)` a `q(11)` se guarda con `sin_pasar` «Se superpone con una licencia de Configuración del dd/mm al dd/mm: revisala con administración».
    - **«corregir antes de empezar»:**
      - cambiar las fechas mueve la de Configuración y pone `nota_autorizacion_id` en NULL;
      - cambiar solo la nota, el tipo o `mostrar` no cambia `usuarios_licencias.updated_at` ni suma historial.
    - **«cruza el arranque y ya empezó» (Review Focus 4):** una de `hoy − 3` a `hoy + 3` pasa; cambiar su `desde` da 400 `soloHasta`; cambiar su `hasta` lo copia; el `DELETE` da 409 «Ya empezó: no se puede borrar».
    - **«borrar una que no empezó»** anula la de Configuración (`licencia_anulada`).
    - **«administración la cambia»:**
      - si adminB anula la de Configuración por `POST /usuarios/licencias/:id/anular`, la fila dice `TEXTO_ANULADA_POR_ADMINISTRACION` y una corrección no toca `usuarios_licencias`;
      - si le cambia las fechas, dice «En Configuración: del …» y la corrección responde `avisos: [TEXTO_NO_SE_COPIA]`;
      - si acorta la que cubría una `unida`, la fila dice «Ya no está cubierta en Configuración del …».
    - **«la franquicia de 7 a 3»:** antes de empezar, la de Configuración queda anulada y el vínculo, en NULL. Si ya empezó (de ayer, con las dos filas —la de Configuración y la `creada`— cargadas por SQL, porque el paso solo crea las que terminan hoy o después; una cargada para hoy todavía se anula, porque `puedeAnularse` es `desde >= hoy`, como en el test puro: corrección de la Task 1, al leer el main nuevo), queda y la fila dice `textoSigueEnConfiguracion`.
    - **«el rol del momento»:** una licencia del lector no pasa; si el lector pasa a admin por SQL, recién al corregirla aparece en Configuración.
    - **«el firmante titular»:**
      - el titular carga con `autorizado_id` de una persona con firma, y la de Configuración queda con `autorizado_id` y `autorizado_at`;
      - **el caso del usuario:** vacaciones de `q(0)` a `q(8)` con persona a cargo y una médica de `q(9)` a `q(10)` sin persona a cargo dan dos licencias de Configuración. En el proceso, `firmaParaFecha(config, q(3)).modo` es `'autorizado'` y `firmaParaFecha(config, q(9)).modo` es `'sin_autorizado'`;
      - **«solo las vacaciones dejan persona a cargo»:** el titular carga una médica con `autorizado_id` y recibe 400 en `autorizado_id` con `autorizadoSoloVacaciones`, sin ninguna fila nueva; la misma carga sin el campo pasa a Configuración con `autorizado_id` NULL. Lo mismo con una franquicia de 7 h;
      - `POST /licencias/calculo` del titular con `desde` = hoy trae `AVISO_NOTAS_DE_HOY` y `vispera`; el de una médica trae `AVISO_SIN_PERSONA_A_CARGO` y `puede_autorizar: false`, y el de unas vacaciones, `puede_autorizar: true` sin ese aviso;
      - el del superadmin, `AVISO_DEL_PASO_SUPERADMIN`; el del lector, `pasa: false`;
      - **«el tipo de unas vacaciones con persona a cargo»:** vacaciones del titular desde un lunes, con persona a cargo. (Corrección de la Task 1, al leer el main nuevo: el servidor de prueba usa la fecha real y no hay forma de fijar «hoy», como dice `tests/licencias-api.test.js`. En la API, con `desde` = `q(0)` el cambio da 200, y con `desde` = el primer día hábil después de hoy —`proximoDiaHabil(sumarDias(hoy, 1))`, con los 9 fijos— da 400 en `tipo`; el borde exacto —desde un lunes, el límite es el jueves anterior, inclusive, y el viernes ya no— y el Carnaval van en el test puro de `limiteParaCambiarTipo`.)
        - Con hoy el jueves anterior (2 días hábiles antes), pasarlas a médica da 200, y la de Configuración queda con `autorizado_id` NULL.
        - Con hoy el viernes (la víspera), da 400 en `tipo` con `tipoFijo` y no cambia nada.
        - Con un lunes de Carnaval en el medio, el límite se cuenta con los 9 fijos.
        - Las vacaciones de otra persona, o sin persona a cargo, cambian de tipo cualquier día.
    - **«la persona autorizada que se queda sin días»:** con la licencia del titular de `q(0)` a `q(4)` autorizando a adminA, una de adminA de `q(0)` a `q(4)` da 409 en `fechas` con `textoAutorizadaSinDias` y no deja ninguna fila en ninguna de las dos tablas; una de `q(1)` a `q(2)` se guarda y pasa.
    - **«otro rechazo se guarda»:** una médica extraordinaria de 366 días corridos se guarda con `sin_pasar` «La licencia puede durar como máximo 365 días».
    - **«el doble envío» (Review Focus 3):** dos `POST` simultáneos iguales dejan una sola fila en cada tabla.
- [ ] **Step 2:** Correr los dos archivos: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** Correr `tests/mi-espacio-reglas.test.js`, `tests/mi-espacio-api.test.js` y `tests/licencias-api.test.js`: PASS.
- [ ] **Step 5: Commit:** `feat(mi-espacio): el paso de las ausencias de día entero a Configuración → Licencias`.

### Task 11: La API de horas extras y de «Mis vacaciones y saldos»

**Files:**
- Modify: `controllers/miEspacioController.js`, `routes/index.js`, `tests/mi-espacio-api.test.js`, `tests/permisos.test.js` (el Step 1 le suma rutas: corrección de la Task 1, al leer el main nuevo)

**Interfaces:**
- Consumes: `validarHorasExtras` (Task 4); `validarAnio`, `validarSaldoInicial` y `camposDelSaldoInicial` (Task 5).
- Produces:
  - **`POST /api/mi-espacio/horas-extras`** (`cargarHorasExtras`) → 201 `{ success, data: { id }, message: 'Horas extras cargadas.' }`.
  - **`PUT /api/mi-espacio/horas-extras/:id`** (`corregirHorasExtras`) → 200.
  - **`DELETE /api/mi-espacio/horas-extras/:id`** (`borrarHorasExtras`): baja lógica.
  - **Cómo se valida:**
    - las horas extras exigen modalidad y arranque, como las licencias;
    - corregirlas o borrarlas nunca se frena por un faltante;
    - lo ajeno da 404 `noEncontradas`.
  - **`PUT /api/mi-espacio/anio/:anio`** (`guardarAnio`): `{ dias_vacaciones, estudios }`, con un upsert. Exige modalidad. Bajar los días no se frena.
  - **`PUT /api/mi-espacio/saldo-inicial`** (`guardarSaldoInicial`): `{ saldos: { clave: número } }`, en una transacción:
    - crea el arranque con hoy si no existe; si existe, la fecha no cambia;
    - reemplaza todas las filas de `mi_espacio_saldos`;
    - exige el año del arranque cargado en `mi_espacio_anios`; si no, 400 en `dias_vacaciones` con `diasVacaciones`.
    - Responde `{ success, data: { arranque }, message: 'Saldo inicial guardado.' }`.

- [ ] **Step 1: Escribir los tests que fallan:**
  - **«horas extras»:**
    - un `POST` el sábado `q(5)` de 22:00 a 01:30 da 201, y `GET /horas-extras` lo cuenta en su mes con '3,5 horas';
    - una superpuesta da 400 en `desde` con `textoHorarioSuperpuesto`;
    - de 10:15 a 11:00 da 400 en `desde` con `horario`;
    - lo ajeno da 404.
  - **«borrar unas horas extras deja un faltante, sin frenar»:** con un franco usado que dependía de ellas, el `DELETE` da 200 y el Resumen trae el faltante del franco.
  - **«el año»:** `PUT /anio/2026` con 15 y `'secundario'` y después `GET`; 12 días da 400 en `dias_vacaciones`; `'otro'` da 400 en `estudios`.
  - **«el saldo inicial»:**
    - el primer `PUT` crea el arranque con hoy;
    - una corrección cambia los valores y no la fecha;
    - una clave que falta da 400 con su clave;
    - sin el año del arranque cargado da 400 en `dias_vacaciones`;
    - el lector sin vínculo recibe 400 `sinModalidad`.
  - **`tests/permisos.test.js`:** `RUTAS_MI_ESPACIO` suma el `POST`, el `PUT` y el `DELETE` de `/mi-espacio/horas-extras` y los `PUT` de `/mi-espacio/anio/2026` y `/mi-espacio/saldo-inicial`.
- [ ] **Step 2:** Correr: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** Correr `tests/mi-espacio-api.test.js` y `tests/permisos.test.js`: PASS.
- [ ] **Step 5: Commit:** `feat(mi-espacio): la API de horas extras y de «Mis vacaciones y saldos»`.

### Task 12: «Hoy no están» y lo que necesita el firmante

**Files:**
- Modify: `services/miEspacioDatos.js`, `services/miEspacioReglas.js`, `controllers/miEspacioController.js`, `routes/index.js`, `tests/mi-espacio-reglas.test.js`, `tests/mi-espacio-api.test.js`, `tests/permisos.test.js` (el Step 1 le suma rutas: corrección de la Task 1, al leer el main nuevo)

**Interfaces:**
- Consumes: `esDiaEntero` (Task 3); `proximoDiaHabilCon` (Task 4); `firmanteTitular`, `autorizables` y `conSusLicencias` (Task 9).
- Produces:
  - **`ausenciasUnidas(filas, feriados) → [{ usuario_id, nombre, desde, hasta, vuelve }]`** (pura, en `miEspacioReglas.js`): las ausencias de cada persona, seguidas o separadas solo por días no hábiles, unidas. `vuelve` es `proximoDiaHabilCon(hasta + 1)`.
  - **`ausenciasVisibles(desde, hasta, { excluir })`** (datos): las filas activas, de día entero y con `mostrar = 1`, de personas activas con `esAdmin(rol)`, sin `excluir`.
  - **`GET /api/mi-espacio/ausentes?desde=&hasta=`** (`listarAusentes`):
    - responde `{ success, data: { puede_ver, ausentes: [{ nombre, desde, hasta, vuelve, texto, vuelve_texto }] } }`. Nunca el tipo, la nota ni el id;
    - `texto` es «<nombre> no está» y `vuelve_texto`, «Vuelve el lunes 02/11»;
    - sin `esAdmin` de quien mira, `{ puede_ver: false, ausentes: [] }`;
    - las fechas inválidas, o un rango de más de 93 días, dan 400 en `fechas`.
  - **`GET /api/mi-espacio/firmante`** (`verFirmante`): al titular, `{ soy_titular: true, hoy, autorizables }`, con la forma de los `autorizables` de `GET /usuarios/licencias`; a cualquier otra persona, `{ soy_titular: false }`.
  - **El Resumen:** `hoy_y_manana.ausentes`, de hoy a mañana, para quien puede verlas.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **Puros:** `ausenciasUnidas` junta unas vacaciones del 26/10 al 30/10/2026 con una médica del 02/11 al 03/11 (vuelve el `'2026-11-04'`). Con `new Set(['2026-11-04'])`, vuelve el `'2026-11-05'`.
  - **API:**
    - **«el tipo no sale» (antiobjetivo):** las claves de cada ausente son exactamente `['nombre', 'desde', 'hasta', 'vuelve', 'texto', 'vuelve_texto']`;
    - **«solo administración»:** el lector recibe `puede_ver: false`; las licencias del lector no aparecen nunca; las de adminB con `mostrar = 0` tampoco; una franquicia de 3 h no y una de 7 h sí;
    - **«la vuelta con un feriado»:** con un feriado cargado en `feriados`, el día siguiente al fin de una ausencia, la vuelta lo saltea;
    - **«el rango»:** 94 días dan 400 en `fechas`;
    - **«el firmante»:** el titular recibe `soy_titular: true` con `autorizables[0].ausencias`; adminB recibe `{ soy_titular: false }`.
  - **`tests/permisos.test.js`:** `RUTAS_MI_ESPACIO` suma `['GET', '/mi-espacio/ausentes?desde=2026-10-26&hasta=2026-10-27']` y `['GET', '/mi-espacio/firmante']`, y el lector y el colaborador las usan con 200 (las fechas van en la ruta: sin ellas, `ausentes` da el 400 en `fechas` si valida las fechas antes de mirar el rol; corrección de la Task 1, al leer el main nuevo).
- [ ] **Step 2:** Correr: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** Correr `tests/mi-espacio-reglas.test.js`, `tests/mi-espacio-api.test.js` y `tests/permisos.test.js`: PASS.
- [ ] **Step 5: Commit:** `feat(mi-espacio): «Hoy no están», sin el tipo, y los datos del campo del firmante`.

### Task 13: El email de vencimiento en la corrida de las 8:15

**Files:**
- Create: `services/miEspacioAvisos.js`, `tests/mi-espacio-avisos.test.js`
- Modify: `services/miEspacioReglas.js`, `services/miEspacioDatos.js`, `services/emailTemplates.js`, `controllers/notificacionesController.js`, `tests/emails-fixtures.js`, `tests/email-diseno.test.js`, `tests/mi-espacio-reglas.test.js`

**Interfaces:**
- Consumes: `calcular` (Task 5); `ultimoDiaHabilDelMesCon`, `restarDiasHabilesCon` y `proximoDiaHabilCon` (Task 4); `estadosDe` y `feriadosPara` (Task 7); `sendEmail` y `remitente`; `emailValido`; `anotarEnLaUltimaCorrida`.
- Produces:
  - **`avisosDeVencimiento(calculo, { hoy, feriados, modalidad }) → [{ clave, texto }]`** (pura). Solo lo que está en su tramo:
    - **`franco-AAAA-MM` y `horas-AAAA-MM`:** del mes de hoy, si quedan disponibles. El tramo va de `restarDiasHabilesCon(último, 5)` a `último` (= `ultimoDiaHabilDelMesCon`).
    - **`licencia-<año − 2>`:** si quedan disponibles. El tramo va de `proximoDiaHabilCon('AAAA-12-01')` al `'AAAA-12-31'`.
  - **`ausentesEn(fecha, usuarioIds, conexion = pool) → Set<id>`** (datos, en lote): una licencia de Configuración no anulada o una de Mi espacio de día entero ese día.
  - **`vencimientoMiEspacioTemplate({ nombre_completo, avisos }) → { subject, html, text }`,** con `plantillaSimple` y los textos de Global Constraints.
  - **`enviarAvisosDeVencimiento({ hoy }) → { dia_habil, enviados, errores: [{ usuario_id, error }] }`:**
    - con `esDiaHabilCon(hoy, feriados)`, no con `esDiaHabil`;
    - para las personas activas con vínculo, arranque y `emailValido`, que no están en `ausentesEn` y con claves todavía no enviadas;
    - un solo email por persona y por corrida, con `sendEmail({ ...plantilla, to: [email] })`;
    - si sale, un INSERT por clave en `mi_espacio_avisos` con `ahoraArgentina()`; si falla, no anota nada.
  - **En `ejecutarNotificacionesDiarias`:** un paso aislado, después de la foto, con su try/catch y `resultados.miEspacio`. Sus errores van a `resultados.errores` como `{ tipo: 'mi-espacio', … }` y a `anotarEnLaUltimaCorrida`, con «No se pudieron enviar los avisos de Mi espacio: <mensaje>». `resultados.dia_habil` no cambia.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **Puros (`avisosDeVencimiento` con `PLANTA`):**
    - hoy `'2026-10-22'`: `[]`;
    - hoy `'2026-10-23'`: `[{ clave: 'franco-2026-10', texto: 'Tenés 1 franco compensatorio para usar en octubre: el último día hábil es el viernes 30/10.' }]`;
    - hoy `'2026-12-01'`: incluye `'licencia-2024'` con «Tenés 3 días de la licencia 2024: vence el 31/12/2026.»;
    - `CONTRATO` el `'2026-10-26'`: la de horas, con «Tenés 1,5 horas a favor para usar en octubre: …».
  - **`tests/emails-fixtures.js` y `tests/email-diseno.test.js`:**
    - el caso `{ nombre: 'vencimiento de Mi espacio', email: t.vencimientoMiEspacioTemplate({ nombre_completo: 'Persona de Prueba', avisos: [{ texto: '…franco…' }, { texto: '…licencia 2024…' }] }), boton: true }`;
    - su asunto en `ASUNTOS`, su texto visible completo en `TEXTOS`, y el botón a `/mi-espacio.html#resumen`.
  - **`tests/mi-espacio-avisos.test.js`:** base `rpad_test_mi_espacio_avisos`. Los servicios se importan después de apuntar `DB_NAME` y la corrida se llama con `mock.timers`, como en `tests/metricas-foto.test.js`, con Mailpit:
    - **«el tramo»:** con una persona de planta con el franco de octubre sin usar, la corrida del 22/10/2026 no manda nada, la del 23/10 manda un email a su casilla y la del 26/10 no lo repite;
    - **«de licencia ese día»:** con una licencia de Configuración el 23/10, sale el 26/10; con una médica de Mi espacio, lo mismo;
    - **«el que falla sale al siguiente»:** el 23/10, con `EMAIL_SOLO_A` = otra casilla, no sale ni se anota; el 26/10, con `EMAIL_SOLO_A = ''`, sale;
    - **«un día no hábil»:** con un feriado cargado el 23/10, ese día `dia_habil` es false;
    - **«nunca a las casillas por defecto»:** una persona sin email válido no genera ningún envío;
    - **«en la corrida»:** `ejecutarNotificacionesDiarias` del 23/10 a las 11:15 UTC trae `data.miEspacio.enviados` 1. Con `mi_espacio_avisos` renombrada durante la corrida (y devuelta en un `finally`), el error queda en `errores` con `tipo: 'mi-espacio'`, no sale ningún email y la respuesta llega igual.
- [ ] **Step 2:** Correr los tres archivos: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** Correr los tres, y `tests/metricas-foto.test.js` y `tests/notas-motor.test.js`: PASS.
- [ ] **Step 5: Commit:** `feat(mi-espacio): el email de vencimiento en la corrida de las 8:15, una sola vez`.

### Task 14: Lo que la entrega 1 le dejó a esta: las licencias afectadas por un feriado y el aviso azul

**Files:**
- Modify: `services/feriadosReglas.js`, `services/miEspacioDatos.js`, `controllers/feriadosController.js`, `routes/index.js`, `public/js/feriados.js`, `public/configuracion.html`, `tests/feriados-reglas.test.js`, `tests/feriados-api.test.js`, `tests/feriados-frontend.test.js`, `tests/paginas.test.js`, `tests/permisos.test.js`

**Interfaces:**
- Consumes: la entrega 1 (`crearFeriado`, `corregirFeriado` y el modal `#modal-feriado` con `fe-fecha`).
- Produces:
  - **Un feriado que se repite cuenta todos los años en que rige** (decisión del usuario, 26/10/2026, al leer el main nuevo: «Todos los años»). La cuenta es de las licencias que incluyen alguno de sus días, cada licencia una vez, aunque incluya el feriado de dos años.
  - **`fechasDelFeriado(fila, desdeAnio, hastaAnio) → string[]`** (pura, en `services/feriadosReglas.js`, sin tocar las de la entrega 1): `fechaEnElAnio(fila, anio)` para cada año del rango, sin los null. Respeta lo que ya hace `fechaEnElAnio`: desde el año de su fecha (no hacia atrás), hasta `hasta_anio`, sin los años de `no_rige` y sin un 29/02 que no existe. Uno que no se repite da solo su fecha, si cae en el rango. Con una entrada inválida, `[]`.
  - **`licenciasQueIncluyen(fila) → Promise<number>`** (datos, en `services/miEspacioDatos.js`): `fila` tiene la forma de las de `filasDeFeriados` (`{ fecha, se_repite, hasta_anio, no_rige, activo: 1 }`). Lee el primer y el último año de las licencias activas de `mi_espacio_licencias` (`MIN(desde)` y `MAX(hasta)`; sin ninguna, 0 sin más consultas), arma las fechas con `fechasDelFeriado` en ese rango y cuenta las filas activas, de cualquier persona, que incluyen alguna (`desde <= fecha <= hasta`, con un `?` por fecha, parametrizado).
  - **`GET /api/feriados/afectadas?fecha=&se_repite=&id=`** (`afectadasPorFeriado`; `authMiddleware` + `adminOnly`) → `{ success, data: { licencias_afectadas } }`. Una fecha inválida da 400 en `fecha`. `se_repite` es `'1'` o `'0'` (otro valor, `'0'`). Con `id` de un feriado que existe (corregir), se usan su `hasta_anio` y su `no_rige` guardados con la fecha y `se_repite` del modal; sin `id`, o con uno que no existe, sin baja ni años que no rigen.
  - **`POST` y `PUT /api/feriados[/:id]`** suman `licencias_afectadas` del feriado ya guardado (`filaDeFeriado(id)` después del commit). Es aislado: si la cuenta falla, va `null` y se registra en la consola, sin cambiar la respuesta.
  - **El modal del feriado:** debajo de la fecha, 300 ms después del último cambio de `fe-fecha` o de `fe-se-repite`, pide `/feriados/afectadas` con la fecha, `se_repite` y, al corregir, el `id`, y muestra:
    - «1 licencia cargada lo incluye: sus días hábiles se recalculan.» o «2 licencias cargadas lo incluyen: sus días hábiles se recalculan.»;
    - con 0, nada;
    - la respuesta vieja se descarta.
    - La función pura es `textoDeAfectadasFeriado(n)`.
  - **El aviso azul pasa a decir:** «Por ahora, estos feriados cuentan solo para Mi espacio: los días hábiles de las licencias y los francos. Las Notas Digitales, la auditoría y Métricas siguen con los 9 feriados fijos.»
  - `VERSION_FERIADOS = '20261209'`.

- [ ] **Step 1: Escribir los tests que fallan:**
  - **`tests/feriados-reglas.test.js`:** `fechasDelFeriado` de uno que se repite desde 2026, de 2024 a 2027, da las de 2026 y 2027 (no hacia atrás); con `hasta_anio` 2026, solo la de 2026; con `no_rige: [2027]`, solo la de 2026; uno que no se repite, su fecha; un 29/02 que se repite saltea los años sin 29/02; `null` da `[]`.
  - **`tests/feriados-api.test.js`:** con dos licencias de Mi espacio que incluyen el 16/02/2026 (por SQL, de dos personas), `GET /feriados/afectadas?fecha=2026-02-16` da 2, y un `POST` de ese día trae `licencias_afectadas: 2`; `?fecha=abc` da 400. **«Todos los años»:** con una licencia que incluye el 13/12/2026 y otra que incluye el 13/12/2027, `?fecha=2026-12-13&se_repite=1` da 2 y `se_repite=0`, 1; una sola licencia del 10/12/2026 al 15/12/2027 cuenta 1; con `id` de un feriado guardado que se repite y no rige en 2027, da 1. Las aserciones que hoy fijan la forma de esas respuestas cambian para sumar `licencias_afectadas`: las claves del alta (`['avisos', 'data', 'message', 'success']` y `data` = `['id']`, en «Carnaval 2026 da 201…») y el cuerpo entero de la corrección (`{ success, message, avisos }`, en «cambia el nombre y la fecha») (corrección de la Task 1, al leer el main nuevo).
  - **`tests/feriados-frontend.test.js`:** `textoDeAfectadasFeriado` con 0, 1 y 2. Con el DOM falso, el modal pide `/feriados/afectadas` una sola vez después de dos cambios seguidos de la fecha. (Corrección de la Task 1, al leer el main nuevo: el aviso azul no va acá, porque está escrito en `configuracion.html` y `feriados.js` no lo arma; va en `tests/paginas.test.js`. Y el `crearPagina` de este archivo corre cada `setTimeout` enseguida y su `servidor` falso contesta cualquier GET con la lista de un año: este test necesita una opción con temporizadores que el test vence, como `temporizadores` de `tests/proyectos-frontend.test.js`, sin cambiar la de siempre, y su propia respuesta para `/feriados/afectadas`.)
  - **`tests/permisos.test.js`:** `['GET', '/feriados/afectadas?fecha=2026-02-16']` en `RUTAS_SOLO_ADMIN`.
  - **`tests/paginas.test.js`:** `VERSION_FERIADOS = '20261209'`, y el aviso nuevo, tal cual, en el test «el aviso azul dice, tal cual, …» de la pestaña Feriados (corrección de la Task 1, al leer el main nuevo).
- [ ] **Step 2:** Correr los cinco: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** Correr los cinco: PASS.
- [ ] **Step 5: Commit:** `feat(feriados): cuántas licencias de Mi espacio incluye la fecha, y el aviso de que cuentan para Mi espacio`.

### Task 15: La página, la carcasa en las 14 y las pestañas Licencias y Horas extras

**Files:**
- Create: `public/mi-espacio.html`, `public/js/mi-espacio.js`, `tests/mi-espacio-frontend.test.js`
- Modify: las 13 páginas con carcasa (`#sidebarAccount`), `tests/paginas.test.js`

**Interfaces:**
- Consumes: `GET /mi-espacio/resumen`, `/licencias` y `/horas-extras` (Task 7).
- Produces:
  - **El menú «Mi cuenta» de las 14 páginas,** después de Mi Perfil: `<a href="mi-espacio.html" class="sidebar-link"><svg aria-hidden="true" …><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg><span>Mi espacio</span></a>`. El SVG lleva los mismos atributos que los demás del menú.
  - **`mi-espacio.html`:** la carcasa de `index.html`, sin `aria-current`; `<title>Mi espacio - RPAD</title>` y la descripción «Tus licencias, tus horas extras y lo que te queda»; un `<style>` con los tokens `--sg-*` del Seguimiento más `--sg-ambar-fondo`, `--sg-gris-fondo` y `--sg-violeta-fondo`, y las clases `.me-*`; el `h1` «Mi espacio» con `calendar-check` decorativo y la bajada de la maqueta; `#btn-cargar-horas` y `#btn-cargar-licencia`; las pestañas `#tab-resumen`, `#tab-licencias` y `#tab-horas` (`role="tab"`, `aria-selected`), la marca `#me-marca` y los paneles `#vista-resumen`, `#vista-licencias` y `#vista-horas`; `#me-anuncio` (`role="status"`, la única región viva); los scripts config → auth → main → api → `js/mi-espacio.js?v=20261209`.
  - **En `mi-espacio.js`, lo puro:** `PESTANAS` y `pestanaDeHash(hash)` (uno desconocido abre `resumen`); `htmlDeMensaje(texto)` y `htmlSinArranque()` (con `data-abrir="saldos"`); `htmlDelSelectorDeAnio(anios, anio)` y `htmlDeFiltrosDeLicencias(filtros, elegido)`, con `aria-pressed`; `htmlDeListaDeLicencias(datos, filtro)`, cada fila con «Editar» (`data-editar-licencia`, `aria-label` «Editar la licencia del 03/11 al 09/11/2026») y al final «Los días se cuentan hábiles: sin sábados, domingos ni feriados.»; `htmlDeTablaDeFrancos(tabla)`, `htmlDeTablaDeHorasAFavor(tabla)`, `htmlDeDiaPorDia(tabla, mes)` (cada mes de la tabla es un botón `data-mes`; de entrada, el en curso) y `htmlDeNoUtilizadas(tabla)`.
  - **Lo que toca el DOM:** `iniciarMiEspacio()` en `DOMContentLoaded` (sin sesión, al login, como `proyectos.js`), `mostrarPestana(nombre)` con `history.replaceState`, y `cargarLicencias(anio)` y `cargarHorasExtras(anio)` con `API.pedirJson`, con los eventos delegados en contenedores fijos.

- [ ] **Step 1: Escribir los tests que fallan.**
  - **`tests/mi-espacio-frontend.test.js`:**
    - el `vm` de `tests/areas-frontend.test.js`, cargando `js/api.js` y después `js/mi-espacio.js`;
    - los datos se arman con las funciones del servidor sobre la fixture (`filasDeLicencias`, `tablaDeHorasExtras`);
    - los tests:
      - «al cargarse solo declara»: ninguna consulta al `document` y un solo oyente, `DOMContentLoaded`;
      - `pestanaDeHash('#horas')` es 'horas', y `('#otra')`, 'resumen';
      - la lista de `PLANTA`: seis filas, «Próxima» solo en la de noviembre, «Antes del saldo inicial: no descuenta», los filtros con su cantidad y `aria-pressed`;
      - la tabla de planta, con los textos de la Task 6, y la de contrato con «Horas no utilizadas previamente»;
      - **escapado (Review Focus 5):** una nota y un `sin_pasar` `<img src=x onerror=alert(1)>` se ven escapados en la fila y en el `aria-label`;
      - sin modalidad, solo el mensaje y ningún botón de carga.
  - **`tests/paginas.test.js`:**
    - `const VERSION_MI_ESPACIO = '20261209';`
    - `mi-espacio.js` con su versión, después de `api.js`;
    - «hay 14 páginas con carcasa»;
    - `'mi-espacio.html'` en la lista de destinos;
    - un `describe('el menú de Mi cuenta')`, como el de Herramientas: en `index.html`, Mi Perfil y Mi espacio, en ese orden, con sus íconos, y ningún otro link.
- [ ] **Step 2:** Correr los dos: FAIL.
- [ ] **Step 3: Implementar.** Primero el menú en las 13 páginas (lo controla la comparación con `index.html`) y después la página.
- [ ] **Step 4:** Correr los dos, y `tests/main-frontend.test.js`: PASS.
- [ ] **Step 5: Commit:** `feat(mi-espacio): la página, el menú «Mi cuenta» en las 14 y las pestañas Licencias y Horas extras`.

### Task 16: El Resumen «Niveles»

**Files:**
- Modify: `public/mi-espacio.html`, `public/js/mi-espacio.js`, `tests/mi-espacio-frontend.test.js`, `tests/paginas.test.js`

**Interfaces:**
- Consumes: `GET /mi-espacio/resumen` (Tasks 7 y 12).
- Produces (puras, en `mi-espacio.js`):
  - **`svgDeTanque({ capas, capacidad, ancho, alto, id }) → string`:** el SVG de «Niveles» de `opciones.js`, con `aria-hidden="true"`; las cargadas, con un patrón rayado; las por habilitar, punteadas. Cada capa mide `n / capacidad × alto`.
  - **`htmlDeVencePronto(lista)`:** cada cosa con su bloque amarillo y un `<button>` con `data-accion` y `data-tipo`. Con la lista vacía, `''`.
  - **`htmlDeFaltantes(faltantes)`:** el aviso ámbar.
  - **`htmlDeTanques(tanques)`:** cada tanque es un `<a href="#licencias">` (o `#horas`) con su `aria-label` del servidor. El de vacaciones va con su lista al lado.
  - **`htmlDePastillas(pastillas)`, `htmlDeHoyYManana(datos)`, `htmlDelResumen(resumen)` y `htmlDeMarca(marca)`:** la marca es `<span class="me-marca" role="img" aria-label="Hay algo que vence pronto"></span>` o `''`.
  - **Lo que toca el DOM:** `cargarResumen()`. Una acción de «Vence pronto» abre «Cargar licencia» con su tipo; la Task 17 la conecta.
  - **El movimiento:** los tanques se llenan una vez al abrir (`.me-tanque-nivel` con una transición de `transform`), sin movimiento con `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 1: Escribir los tests que fallan:**
  - **`resumenDe(PLANTA)`:**
    - `htmlDelResumen` trae, en este orden, «Vence pronto», «Lo que te queda» y «Hoy y mañana»;
    - el `aria-label` «Vacaciones: 33 días hábiles disponibles. Ver tus licencias»;
    - cinco capas en el tanque de vacaciones, que suman el alto del tanque (las capas suman la capacidad, 48) y ninguna sale de él;
    - los botones «Cargarlo» y «Cargar vacaciones».
  - **`resumenDe(CONTRATO)`:** el tanque de horas a favor con la clase de «vence» y su link a `#horas`.
  - **«sin nada que venza»:** sin «Vence pronto» y sin marca.
  - **«Hoy y mañana»:** un ausente con el nombre `<b>x</b>` se ve escapado (Review Focus 5); el próximo feriado «Lunes 23/11».
  - **`tests/paginas.test.js`:** el `<style>` de `mi-espacio.html` tiene `prefers-reduced-motion` y define `--sg-ambar-fondo`, `--sg-gris-fondo` y `--sg-violeta-fondo`.
- [ ] **Step 2:** Correr: FAIL.
- [ ] **Step 3: Implementar,** desde `opciones.js` y `opciones.css` de las maquetas, con los tokens pasados a `--sg-*`.
- [ ] **Step 4:** Correr: PASS.
- [ ] **Step 5: Commit:** `feat(mi-espacio): el Resumen «Niveles», con Vence pronto, los tanques y Hoy y mañana`.

### Task 17: Los formularios

**Files:**
- Modify: `public/mi-espacio.html`, `public/js/mi-espacio.js`, `tests/mi-espacio-frontend.test.js`, `tests/paginas.test.js`

**Interfaces:**
- Consumes: las rutas de escritura (Tasks 8, 10, 11 y 12), `GET /usuarios/licencias/sin-auditor` y `POST /licencias/calculo`.
- Produces:
  - **Los modales, después del footer** (`.modal-overlay` y `.modal` con `.active`, `role="dialog"`, `aria-modal`; un clic en el velo no los cierra; cada campo con su `<id>-error` y su `aria-describedby`):
    - `#modal-licencia`: `#ml-tipos` (radios grandes), `ml-desde`, `ml-hasta`, `ml-horas`, `ml-mostrar`, `ml-nota`, `#ml-calculo`, `#ml-paso` (el aviso azul), `#ml-grupo-autorizado` con `ml-autorizado`, `#ml-sin-auditor`, `#ml-error`, `ml-guardar` y `ml-borrar`;
    - `#modal-horas` (`mh-fecha`, `mh-desde`, `mh-hasta`, `mh-nota`, `#mh-suma`, `mh-guardar`, `mh-borrar`), `#modal-saldos` (la modalidad, `ms-dias`, `ms-estudios`, `#ms-campos`, `ms-guardar`), `#modal-uso` (`mu-fecha`, `mu-horas`, `mu-nota`, `mu-guardar`) y `#modal-confirmar`.
  - **Copias mínimas, atadas por tests de paridad** (el servidor valida igual): las claves estáticas de `MENSAJES_MI_ESPACIO` que usan los formularios, `DIAS_VACACIONES`, `TOPES`, `DIAS_ESTUDIOS`, `DIAS_POR_EXAMEN`, `JORNADA` y `LARGO_NOTA`; `horasDelHorario(desde, hasta)` (copia de `horasDe`); `efectoEnNotas` (con `hoy` por parámetro), `textoSinAuditor`, `textoAusenciasAutorizado` y `parametrosSinAuditor` (copias de `usuarios.js`).
  - **Lo puro:** `valoresDeLicencia(fila | null, tipo)`, `erroresDeLicencia(valores) → { campo: mensaje }` (obligatorios, formatos y nota), `cuerpoDeLicencia(valores, { soyTitular })`, `htmlDeTiposDeLicencia(tipos, elegido)`, `htmlDelCalculo(data)`, `htmlDelPaso(paso, { autorizado, ausencias, hoy })`, `valoresDelSaldo(campos)`, `erroresDelSaldo(valores, campos)`, `textoDeConfirmacion(fila)` (texto plano) y `textoDeLaSuma(valores, tabla, modalidad)`: en planta, «3,5 horas. En octubre llevás 14 horas: 2 francos compensatorios para usar en diciembre.»; en contrato, «… en noviembre vas a tener 7,5 horas a favor.»; si el mes no está en la tabla cargada, solo «3,5 horas.».
  - **El comportamiento:**
    - el cálculo se pide 300 ms después del último cambio y se descarta la respuesta vieja; «Guardar» queda deshabilitado hasta la respuesta;
    - un error con campo va a su campo (`aria-invalid` y el foco) y, sin campo, a `#ml-error`; `fechas` (el 409 de la persona autorizada, Task 10) no es un campo del formulario y va a `ml-desde`, y `autorizado_id`, a `ml-autorizado` (corrección de la Task 1, al leer el main nuevo); un 404 cierra el modal, avisa y vuelve a pedir la pestaña; después de guardar se vuelven a pedir el Resumen y la pestaña, y el mensaje va a `#me-anuncio`;
    - «Mis vacaciones y saldos» se abre solo con `abrir_saldos`, y desde el Resumen con «Mis vacaciones y saldos». Guarda con `PUT /anio/:anio` y después `PUT /saldo-inicial`; si el segundo falla, queda abierto con «Los días del año se guardaron, pero el saldo inicial no: <motivo>.»;
    - «Registrar un uso autorizado» abre `#modal-uso` (en planta, sin horas);
    - el aviso de los días sin auditor aparece solo cuando `paso.pasa`, con `Auth.isAuditor()`;
    - el campo del firmante («Autorizo a presentar las notas en mi nombre a:», opcional y vacío) aparece solo cuando `paso.pasa` y `paso.firmante.puede_autorizar` (vacaciones), con los datos de `GET /mi-espacio/firmante`. En los demás tipos no aparece y `cuerpoDeLicencia` no manda `autorizado_id`; el aviso `AVISO_SIN_PERSONA_A_CARGO` llega en `paso.avisos`;
    - el foco va al primer campo y vuelve al botón que abrió el modal, y Escape cierra primero `#modal-confirmar`.

- [ ] **Step 1: Escribir los tests que fallan:**
  - **«las paridades»:**
    - cada clave copiada de `MENSAJES_MI_ESPACIO` es igual a la del servidor, y lo mismo las constantes;
    - `horasDelHorario` es igual a `horasDe` en diez horarios, con la medianoche y los inválidos;
    - `efectoEnNotas`, `textoSinAuditor`, `textoAusenciasAutorizado` y `parametrosSinAuditor` dan lo mismo que las de `usuarios.js` (cargado en otro `vm`, con el armado de `tests/usuarios-frontend.test.js`) en los casos de ese test.
  - **«los tipos»:** `htmlDeTiposDeLicencia(resumenDe(PLANTA).tipos)` trae «Franquicia» con «Quedan 25 h de 42» y no trae «Uso autorizado».
  - **«la persona a cargo, solo en vacaciones»:** `cuerpoDeLicencia` de una médica con `{ soyTitular: true }` no lleva la clave `autorizado_id`, y el de unas vacaciones sí. Con el DOM falso, `#ml-grupo-autorizado` queda oculto con un `paso` de médica y visible con uno de vacaciones.
  - **«la suma»:** `textoDeLaSuma` con 3,5 h el 28/10 en `PLANTA` da «3,5 horas. En octubre llevás 14 horas: 2 francos compensatorios para usar en diciembre.».
  - **Con el DOM y el `fetch` falsos** (como `tests/proyectos-frontend.test.js`):
    - un guardado con un `fetch` que tarda deja el botón deshabilitado y manda un solo `POST`;
    - un 400 en `horas` pone `aria-invalid="true"` en `#ml-horas`;
    - el 409 de la persona autorizada se ve debajo de `ml-desde`;
    - dos cambios seguidos de fecha piden un solo cálculo, y una respuesta vieja que llega tarde no pisa la nueva;
    - el saldo que falla después del año deja el modal abierto con su mensaje;
    - un clic en el velo no cierra, y Escape cierra la confirmación antes que el modal;
    - un título de modal con una nota `<img src=x onerror=alert(1)>` se ve escapado (Review Focus 5).
  - **`tests/paginas.test.js`:** los ids de los modales, una sola vez, sin repetirse con los de la carcasa, y después del footer.
- [ ] **Step 2:** Correr: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** Correr `tests/mi-espacio-frontend.test.js`, `tests/paginas.test.js` y `tests/usuarios-frontend.test.js`: PASS.
- [ ] **Step 5: Commit:** `feat(mi-espacio): los formularios: cargar licencia, horas extras, Mis vacaciones y saldos y el uso autorizado`.

### Task 18: Documentación, recorrido, revisión final y cierre

**Files:**
- Modify: `CLAUDE.md`, `README.md`

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: `CLAUDE.md`** (spec, sección 13): 37 tablas y las seis en «Base de datos», con su migración; los archivos nuevos en la Estructura; `mi-espacio.html` en la carcasa (14 páginas) y la convención de `mi-espacio.js`, con sus copias y paridades; «Mi espacio» en Roles («los compañeros» son administración); el paso a Configuración en «Licencias», con la insignia, el servicio compartido y que solo las vacaciones dejan persona a cargo; el paso de las 8:15 en «Recordatorios automáticos»; las tres funciones nuevas de `feriadosReglas` y el aviso azul.
- [ ] **Step 2: `README.md`:** `migracion-mi-espacio.sql` antes del código y después de las de feriados, y su rollback.
- [ ] **Step 3: Recorrido en el navegador** sobre `rpad_rama_mi_espacio`: como una persona de planta (admin), el modal que se abre solo, vacaciones, una franquicia, horas extras, un franco, el Resumen y la insignia en Configuración → Licencias; como una de contrato (lectora), horas a favor y un uso autorizado; el foco, Escape, `prefers-reduced-motion` y 375 px. Capturas para el usuario.
- [ ] **Step 4: Revisión final de toda la rama** con Opus; se corrigen los hallazgos críticos e importantes.
- [ ] **Step 5:** `npm test` completo con el candado: 0 fallas, y el total de la Task 1 más los tests nuevos.
- [ ] **Step 6: Kit `RPAD-deploy-mi-espacio` en el Escritorio:** los archivos cambiados en su ruta y los dos SQL; `PASOS.txt` (con los feriados ya desplegados: `migracion-mi-espacio.sql`, subir los archivos y Restart; sin cron nuevo); la lista contra `git diff --name-only main...claude/mi-espacio-licencias-fc16d6` (la rama del worktree: corrección de la Task 1, al leer el main nuevo).
- [ ] **Step 7: Merge y push** (autorizado por el usuario si todo está bien): traer main con merge (no rebase) y volver a correr la suite; merge en main y push; comprobar que main y origin coinciden; aplicar la migración a `datospublicos_mcr_rpad`, con un respaldo antes.
- [ ] **Step 8: Limpieza:** quitar el junction de `node_modules` antes de `git worktree remove` y borrar la base `rpad_rama_mi_espacio`.
- [ ] **Step 9: Avisar a la sesión coordinadora** con el hash del merge, el nombre del kit, la cantidad de tests antes y después, y lo que el usuario tiene que desplegar. Con ese aviso arranca la sesión de la agenda.

## Preguntas para el usuario

1. **El firmante corrige el tipo de unas vacaciones que dejaron persona a cargo** (por ejemplo, de vacaciones a médica, ya pasadas a Configuración con `autorizado_id`). Chocan dos reglas de la sección 6:
   - «Cambiar el tipo, la nota o «Mostrar» no toca Configuración» (así no se borra `nota_autorizacion_id` ni sale otra nota de autorización);
   - «solo la licencia ordinaria deja persona a cargo» (la corrección del usuario).

   **Respuesta del usuario (26/10/2026):** el firmante puede cambiar el tipo hasta 2 días hábiles antes de que empiecen las vacaciones, porque el día hábil anterior sale la Nota Digital que adelanta los datasets e informa quién queda a cargo. Hasta ese día, el cambio le saca la persona a cargo (la propuesta); después, el tipo queda fijo. Está en la Task 10.
