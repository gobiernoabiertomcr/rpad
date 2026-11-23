# La principal del equipo se vota: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que la principal del equipo de cada edición nueva de El dato de la quincena la decida una votación por orden de preferencia, con cierre, desempate, avisos y un mail del resultado, en lugar de la designación directa.

**Architecture:** cuatro tablas nuevas (la lista de votantes, la votación de cada edición creada al llegar, la foto de quienes la votan y los votos, solo INSERT). La ganadora se calcula al leer con reglas puras nuevas (`datoQuincenaVotacionReglas.js`); un paso de las corridas de las 8:05 y las 14:00 sella las votaciones vencidas y manda el mail a administración. La página, la lista, la pestaña «Envío y votación» y Mi espacio imprimen lo que arma el servidor.

**Tech Stack:** Node 22 (ES Modules), Express 4, MariaDB 10.6 con mysql2/promise, Nodemailer, vanilla JS, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-23-dato-quincena-principal-votacion-design.md` (leerla entera antes de empezar). Las maquetas aprobadas, fuera del repo: `~/rpad-notas/dq-principal-votacion/web/` (la página, con «Cómo se ordena: B»; el mail en `mail-resultado.html`) y `~/rpad-notas/dq-principal-votacion/mi-espacio/` (Mi espacio; su `js/mi-espacio.js` trae los cambios marcados `MAQUETA`).

## Global Constraints

- Leer antes de tocar: `CLAUDE.md`, `docs/temas/dato-quincena.md`, `dato-quincena-principal-equipo.md`, `dato-quincena-contrato.md`, `dato-quincena-correo.md`, `base-de-datos.md`, `frontend.md`, `mi-espacio-agenda.md`, `calendario-y-corridas.md`.
- Repositorio público: ningún nombre real ni dato de producción en el código, los tests, los fixtures, los docs ni los commits. Personas inventadas en los tests (las de `tests/dato-quincena-fixtures.js` o nuevas, inventadas).
- El servidor arma todos los textos (Ruling 19); la página los imprime por `Utils.escapeHtml`, y un número va con `String`. El nombre del bot sale de `NOMBRE_DEL_BOT`.
- Horas: `ahoraArgentina()` y `hoyArgentina()` (`services/notasDigitalesCalendario.js`), nunca `NOW()`, `CURDATE()` ni `Date` local para fechas de negocio. `recibida_at` se lee con `UNIX_TIMESTAMP` y se pasa a Argentina con `horaArgentina` (`services/datoQuincenaReglas.js`).
- Un solo calendario: el objeto de `leerCalendario` o `calendarioCon(filasDeFeriados)`, leído una vez por pedido o corrida; la caída se detecta con `calendario.error !== null`. Nada importa `esDiaHabil` suelto (`tests/calendario-unico.test.js`).
- SQL siempre parametrizado; transacciones con `beginTransaction`/`commit`/`rollback`; el RPAD nunca hace UPDATE ni DELETE de `dato_quincena_votos`.
- Un 500 dice un mensaje fijo; en la consola, solo `code` y `message` del error. Un id que no pasa `idPositivo` o no existe: 404 «No existe esa edición.», antes de mirar el cuerpo.
- `sendEmail` siempre con `to`; ningún texto de nodemailer en una respuesta.
- Una pestaña con la página anterior manda el cuerpo de antes: se sigue leyendo (el PUT de la lista sin `votantes` no toca los votantes).
- Lenguaje neutro; «de el» es «del» y «a el» es «al».
- Cada `?v=` que cambia sube también su constante en `tests/paginas.test.js`. `dato-quincena.js?v=20261237` → `20261238`.
- Ningún nombre de clase ni id empieza con `ad-`. Foco visible, 4,5:1, el color nunca es lo único que distingue; con `prefers-reduced-motion`, nada se mueve.
- Entorno (Mac M5): `export PATH=/opt/homebrew/opt/node@22/bin:$PATH`; Docker en `/Applications/Docker.app/Contents/Resources/bin/docker`. Nunca `docker compose` desde el worktree ni `down -v`. El `.env` del worktree es copia del de la carpeta principal (con `RPAD_TESTS_DB_LOCAL=1`).
- **Turno del contenedor:** los tests puros (`*-reglas.test.js`, `dato-quincena-frontend.test.js`, `paginas.test.js`, `email-diseno.test.js`, `documentos.test.js`) se corren cuando sea. Los que usan la base (`schema`, `permisos`, `*-api`, `dato-quincena-correo`, `notificaciones`, `mi-espacio-eventos-api`, el test nuevo del sellado) **solo con «CONTENEDOR LIBRE» de la coordinadora**, y antes la coordinadora migra la base compartida `datospublicos_mcr_rpad` con la migración de la Task 1. La suite completa, antes de empezar (contra la rama sin cambios) y al final.

## Review Focus

1. **Dos guardados a la vez de la misma persona** (doble clic, dos pestañas): queda una sola fila nueva, sin error ni deadlock. Test en la Task 4.
2. **Un voto en el borde del cierre**: a las 11:59:59 del día del cierre se guarda; a las 12:00:00, 409 «La votación ya cerró.». Test en la Task 4.
3. **Una edición con una sola propuesta o con cinco**: los puntos van de N a 1, el texto «Ganó por puntos» no nombra «la que siguió» cuando no hay otra, y el diálogo funciona con una fila. Tests en las Tasks 2 y 8.
4. **Una pestaña abierta con la página anterior**: su «Validar la de Datito» recibe 409 «La principal del equipo ahora se vota: volvé a cargar la página.» y su «Guardar» de la lista (sin `votantes`) no borra a quienes votan. Tests en las Tasks 4 y 5.
5. **La corrida de las 14:00 y una a mano, juntas o seguidas**: el mail del resultado sale una sola vez por edición. Test en la Task 6.

---

### Task 1: La base

**Files:**
- Create: `database/updates/migracion-dato-quincena-votacion.sql`, `database/updates/rollback-dato-quincena-votacion.sql`
- Modify: `database/schema.sql` (al final, con el bloque `-- ===== El dato de la quincena: la votación (database/updates/migracion-dato-quincena-votacion.sql) …`)
- Modify: `docs/temas/base-de-datos.md` (las cuatro tablas y la cuenta 55 → 59), `docs/temas/despliegue.md` (fila 40 y el orden de las vueltas atrás), la cabecera de `rollback-dato-quincena-principal-equipo.sql` («si también se deshace la votación, esa va primero»)
- Test: `tests/schema.test.js`

**Interfaces:**
- Produces: las tablas `dato_quincena_votantes`, `dato_quincena_votaciones`, `dato_quincena_votacion_personas`, `dato_quincena_votos`, con las columnas de abajo.

Las tablas (todas `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`; el nombre de cada índice de FK igual al de su constraint, `fk_<tabla>_<destino>`):

```sql
dato_quincena_votantes:          usuario_id int(11) PK  FK usuarios ON DELETE CASCADE
                                 agregado_por int(11) NULL  FK usuarios ON DELETE SET NULL
                                 agregado_at datetime NOT NULL
dato_quincena_votaciones:        edicion_id int(11) PK  FK dato_quincena_ediciones ON DELETE CASCADE
                                 creada_at datetime NOT NULL
                                 cierre_at datetime NULL, sellada_at datetime NULL
                                 aviso enum('enviado','parcial','fallido','apagado','no_corresponde') NULL
                                 aviso_at datetime NULL
dato_quincena_votacion_personas: id int(11) AUTO_INCREMENT PK
                                 edicion_id int(11) NOT NULL  FK dato_quincena_votaciones ON DELETE CASCADE
                                 usuario_id int(11) NULL  FK usuarios ON DELETE SET NULL
                                 UNIQUE uq_dato_quincena_votacion_persona (edicion_id, usuario_id)
dato_quincena_votos:             id int(11) AUTO_INCREMENT PK
                                 persona_id int(11) NOT NULL  FK dato_quincena_votacion_personas ON DELETE CASCADE
                                 orden varchar(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
                                 votado_at datetime NOT NULL
```

- [ ] **Step 1: Write the failing tests** en `tests/schema.test.js`, con los modelos de la principal del equipo (líneas ~877-908 y ~4243-4443):
  - `TOTAL_DE_TABLAS` pasa de 55 a 59 (y su comentario de historia);
  - un `it` en `describe('database/schema.sql')`, «las tablas de la votación del dato de la quincena», con las columnas, tipos, nulos, FK (destino y `ON DELETE`), el UNIQUE, motor y colaciones de arriba;
  - un `describe('migracion-dato-quincena-votacion.sql')`: base descartable con `crearBase({ conLoNuevo })`, que da lo mismo que `schema.sql` (`comoSchema()`), sin `DELIMITER|USE|DROP|RENAME|CHECK`, la lista exacta de sentencias (`SET NAMES` y cuatro `CREATE TABLE IF NOT EXISTS`), las frases de la cabecera («Solo agrega», «El código anterior no la lee», `ORDEN: correr ANTES de subir el código nuevo, después de migracion-dato-quincena-principal-equipo.sql`, «Es obligatoria», «Se puede volver a correr», «Para deshacer: rollback-dato-quincena-votacion.sql»), que se pueda correr dos veces con datos sin perder nada, y la verificación «tiene que dar 12 filas» con `SHOW TABLES LIKE 'dato_quincena%';`;
  - el rollback: cabecera (`ORDEN: primero volver a subir los archivos anteriores…`, qué se pierde, exportar antes, se puede repetir, va antes que `rollback-dato-quincena-principal-equipo.sql`), cuatro `DROP TABLE IF EXISTS` en orden hijo → padre (`votos`, `votacion_personas`, `votaciones`, `votantes`);
  - actualizar lo que hoy espera listas exactas de tablas `dato_quincena%` (`tablasDelDato`, líneas ~4178 y ~4403), los `crearBase` que borran tablas del dato (~3831, ~4263: borrar primero las cuatro nuevas) y los rollbacks encadenados del archivo (~3925-3946: el de la votación primero).
- [ ] **Step 2: Run** (solo con CONTENEDOR LIBRE y la base compartida ya migrada; si todavía no, dejarlo para ese turno): `node --test tests/schema.test.js` → FAIL en los tests nuevos.
- [ ] **Step 3: Write** la migración, el rollback y el bloque de `schema.sql` (idéntico a la migración), con las cabeceras del modelo `migracion-dato-quincena-principal-equipo.sql`. Las frases de la cabecera explican cada tabla en una línea y que la existencia de la fila de `dato_quincena_votaciones` es lo que dice que la edición se vota.
- [ ] **Step 4: Run** `node --test tests/schema.test.js` → PASS. Correr también la migración en una base descartable dos veces (lo hace el test).
- [ ] **Step 5: Docs** `base-de-datos.md` (viñeta de cada tabla, cuenta 59) y `despliegue.md` (fila 40; vueltas atrás: la de la votación primero).
- [ ] **Step 6: Commit** `feat(dato-quincena): las tablas de la votación de la principal del equipo`.

---

### Task 2: Las reglas puras de la votación

**Files:**
- Create: `services/datoQuincenaVotacionReglas.js`
- Test: `tests/dato-quincena-votacion-reglas.test.js`

**Interfaces:**
- Consumes: `NOMBRE_DEL_BOT` (`datoQuincenaReglas.js`), `formatoCorto` y `sumarDias` (`notasDigitalesCalendario.js`), `diaDeLaSemana` (`feriadosReglas.js`), `HORA_DE_LA_MANANA` = '08:05' (`datoQuincenaCorreoReglas.js`). El calendario llega por parámetro (`esDiaHabil(fecha)`, `proximoDiaHabil(fecha)` que incluye la fecha, `error`).
- Produces (todas puras, exportadas):
  - `HORA_DEL_CIERRE = '12:00'`, `HORA_DEL_SELLADO = '14:00'`, `NOMBRE_SIN_CUENTA = 'Una persona que ya no está'`.
  - `MENSAJES_VOTACION` (`Object.freeze`): `noSeVota` «Esta edición no se vota.», `noEstas` «No estás en la lista de quienes votan esta edición.», `cerro` «La votación ya cerró.», `orden` «Ordená todas las propuestas de la edición.», `alGuardar` «No se pudo guardar tu orden. Probá de nuevo en unos minutos.», `ahoraSeVota` «La principal del equipo ahora se vota: volvé a cargar la página.».
  - `llegadaDe(recibida_ts) → 'AAAA-MM-DD HH:MM' | null`: los segundos UNIX de `recibida_at` en hora argentina (con `horaArgentina` de `datoQuincenaReglas.js`; este módulo importa de ese y no al revés).
  - `cierreDeLaVotacion({ fecha_edicion, llegada, calendario }) → 'AAAA-MM-DD 12:00'` (`llegada`, la de `llegadaDe`).
  - `estadoDeLaVotacion({ cierre_at, fecha_edicion, llegada, ahora, calendario }) → { abierta, cierre, sin_calendario }`: con `cierre_at` (sellada), `cierre` = sus primeros 16 caracteres y `abierta` false; sin sellar y con `calendario.error !== null`, `{ abierta: true, cierre: null, sin_calendario: true }`; si no, `cierre` = `cierreDeLaVotacion(…)` y `abierta` = `ahora.slice(0, 16) < cierre`.
  - `ordenDelVoto(valor, ordenes) → string | null`: `valor` tiene que ser un array de enteros seguros que es una permutación exacta de `ordenes`; devuelve `'2,1,4,3'`.
  - `ordenDeTexto(texto, ordenes) → number[] | null`: el inverso, null si no es una permutación de `ordenes`.
  - `votosVigentes({ personas, votos, cierre, ordenes }) → Map<persona_id, number[]>`: de cada persona de `personas` (`[{ persona_id }]`), su voto de mayor `id` con `votado_at` (16 primeros) menor que `cierre` (sin `cierre`, todos) y un `orden` válido.
  - `resultadoDeLaVotacion({ ordenes, deDatito, votos }) → { orden, como, puntos, empatadas }`: `votos`, array de permutaciones; `puntos`, `Map<orden, número>` con N − puesto + 1; `como` `'nadie'` sin votos (gana `deDatito`), `'puntos'` con una sola máxima, `'desempate'` si no (gana `deDatito` si está entre las empatadas, si no la menor).
  - `debeSellar({ cierre, ahora, calendario }) → boolean`: `calendario.error === null`, `calendario.esDiaHabil(ahora.slice(0, 10))` y `ahora.slice(0, 16) >= ${cierre.slice(0, 10)} 14:00`.
  - `textoDeLosQueVotan(n)`: «No vota nadie.», «Vota 1 persona.», «Votan N personas.».
  - `textoDeLasListasGuardadas({ reciben, votan })`: «Guardamos la lista: lo reciben 4 personas y votan 3.»; con 1, «lo recibe 1 persona» / «vota 1»; con 0, «no lo recibe nadie» / «no vota nadie».
  - Fechas: `cierreLargo(cierre)` «el martes 24/11/2026 a las 12:00», `cierreMedio(cierre)` «el martes 24/11 a las 12:00», `cierreCorto(cierre)` «mar 24/11 a las 12:00».

`cierreDeLaVotacion` (el único algoritmo que la firma no determina):

```js
// D = el mayor entre fecha_edicion y el día de la llegada; si llegó ese mismo día D a las 8:05 o después, D pasa al día siguiente.
// El cierre es el primer día hábil desde D, a las 12:00.
let desde = fecha_edicion > llegada.slice(0, 10) ? fecha_edicion : llegada.slice(0, 10);
if (desde === llegada.slice(0, 10) && llegada.slice(11, 16) >= HORA_DE_LA_MANANA) desde = sumarDias(desde, 1);
return `${calendario.proximoDiaHabil(desde)} ${HORA_DEL_CIERRE}`;
```

- [ ] **Step 1: Write the failing tests** (calendario de prueba con `calendarioCon(filas)` y feriados inventados para 2026-11-23, 2026-12-07 y 2026-12-08; `ahora` fijo):
  - `cierreDeLaVotacion`: llegada '2026-11-23 09:45' con `fecha_edicion` '2026-11-23' → '2026-11-24 12:00'; lunes hábil '2026-11-16 10:00' → '2026-11-17 12:00'; '2026-11-16 08:04' → '2026-11-16 12:00'; '2026-11-16 08:05' → '2026-11-17 12:00'; llegada viernes '2026-11-13 11:30' con `fecha_edicion` '2026-11-16' → '2026-11-16 12:00'; '2026-12-07 09:00' → '2026-12-09 12:00'; llegada '2026-11-30 09:00' con `fecha_edicion` vieja '2026-11-02' (Datito manda atrasada) → '2026-12-01 12:00'.
  - `estadoDeLaVotacion`: abierta a '2026-11-24 11:59:59', cerrada a '2026-11-24 12:00:00'; sellada (`cierre_at` '2026-11-24 12:00:00') queda cerrada aunque el calendario falle o cambie; sin sellar y `calendario.error` → `{ abierta: true, cierre: null, sin_calendario: true }`.
  - `ordenDelVoto`: `[2,1,4,3]` con `[1,2,3,4]` → '2,1,4,3'; null para `[1,2,3]`, `[1,1,2,3]`, `[1,2,3,5]`, `['1',2,3,4]`, `[1.5,…]`, `'2,1,4,3'`, `null`, `{}`.
  - `votosVigentes`: toma el de mayor id; ignora uno con `votado_at` ≥ cierre y uno con `orden` inválido (cae al anterior válido); una persona sin votos no aparece.
  - `resultadoDeLaVotacion` con `ordenes [1,2,3,4]`, `deDatito 1`: `[[2,1,4,3],[3,2,1,4],[4,2,1,3]]` → 2, `puntos` 2=10, 1=7, 4=7, 3=6, `'puntos'`; `[[2,1,4,3],[1,2,3,4]]` → 1, `'desempate'`, empatadas [1,2]; `[[2,3,1,4],[3,2,1,4]]` → 2 (sin la de Datito, la menor), `'desempate'`; `[]` → 1, `'nadie'`; una sola propuesta `[[1]]` → 1 con 1 punto, `'puntos'`; cinco propuestas → el 1.º suma 5.
  - `debeSellar`: false a '2026-11-24 13:59', true a '2026-11-24 14:00', false un sábado, false con `calendario.error`, true a '2026-11-25 08:05' para un cierre del 24.
  - Los textos de `textoDeLosQueVotan`, `textoDeLasListasGuardadas` y las tres fechas (con '2026-11-24 12:00').
- [ ] **Step 2: Run** `node --test tests/dato-quincena-votacion-reglas.test.js` → FAIL (módulo no existe).
- [ ] **Step 3: Implement** el módulo con las firmas de arriba. Cabecera del archivo con el puntero a la spec, como los otros `*Reglas.js`.
- [ ] **Step 4: Run** el mismo comando → PASS. También `node --test tests/calendario-unico.test.js` → PASS.
- [ ] **Step 5: Commit** `feat(dato-quincena): las reglas de la votación (cierre, puntos y desempate)`.

---

### Task 3: Los textos de la votación (detalle, lista, Mi espacio y mail)

**Files:**
- Modify: `services/datoQuincenaVotacionReglas.js`
- Modify: `services/datoQuincenaReglas.js` (`detalleDeLaEdicion`, `principalEquipoDelDetalle`, `itemDeLaLista`)
- Modify: `tests/fixtures/dato-quincena-respuestas.json`
- Test: `tests/dato-quincena-votacion-reglas.test.js`, `tests/dato-quincena-reglas.test.js`

**Interfaces:**
- Consumes: lo de la Task 2.
- Produces:
  - `votacionDelDetalle({ propuestas, deDatito, estado, personas, votos, quienMira }) → votacion` (la forma de la spec, sección 3, «El detalle»), donde `propuestas` es `[{ orden, titulo }]` en el orden de la edición, `deDatito` su orden, `estado` el de `estadoDeLaVotacion`, `personas` `[{ persona_id, usuario_id, nombre }]` en el orden de la foto (`nombre` null si la cuenta se borró), `votos` las filas crudas y `quienMira` el `userId`. Claves, en este orden: `estado`, `resumen`, `cierre`, `participacion`, `puede_votar`, `falta_tu_voto`, `tu_orden`, `dialogo`, `resultado`.
    - `resumen` (lo que la franja pone después de «Principal del equipo:»): abierta, «se vota hasta el martes 24/11 a las 12:00.»; sin calendario, «se está votando.»; cerrada, null (la franja usa el de `principal_equipo`).
    - `dialogo` (solo abierta y con `puede_votar`, si no null): «Tocá las propuestas en orden, de la que más querés trabajar como principal a la que menos. Lo podés cambiar hasta el martes 24/11 a las 12:00.».
    - `cierre`, `participacion`, `tu_orden` y `resultado` (con `orden`, `como`, `texto`, `regla`, `tabla`): los textos exactos de la spec. Plurales: «Ya votó 1 de 3: A. Faltan los votos de B y C.», «Ya votaron 2 de 3: A y B. Falta el voto de C.», «Ya votaron 3 de 3.», «Todavía no votó nadie de 3.»; cerrada «Votaron 3 de 3.», «Votaron 2 de 3: no votó C.», «Votó 1 de 3: no votaron B y C.», «No votó nadie de 3.»; sin personas, «No había nadie en la lista para votar.». Listas con «A, B y C». Sin calendario: `cierre` «No se pudo leer el calendario: el cierre se confirma en unos minutos.», `puede_votar` false, `resultado` null.
    - «Ganó por puntos: 10, contra 7 de la que siguió.»; con una sola propuesta, «Ganó por puntos: 1.».
  - `votacionDeLaLista({ estado, personas, votos, quienMira, ordenes }) → { texto, falta_tu_voto } | null`: abierta con cierre, `{ texto: 'Se vota hasta el mar 24/11 a las 12:00', falta_tu_voto }`; abierta sin calendario, `{ texto: 'Se está votando', falta_tu_voto }`; cerrada, null.
  - `itemsDeLaVotacionEnMiEspacio({ votaciones, usuarioId, desde, hasta }) → [{ fecha, hora, texto, nombre, titulo, detalle, enlace }]`: de cada votación abierta con cierre (`[{ edicion_id, fecha_edicion, estado, personas, votos, ordenes }]`) en la que `usuarioId` está en la foto y no tiene voto vigente, con `fecha` el día del cierre dentro de `desde`–`hasta`: `hora` «Hasta 12:00», `texto` y `nombre` «Votá la principal del dato de la quincena», `detalle` «Edición del lunes 23/11.», `titulo` «Votá la principal del dato de la quincena. Edición del lunes 23/11. Cierra a las 12:00.», `enlace` `dato-quincena.html?id=N`.
  - `modeloDelMailDeLaVotacion({ edicion: { id, fecha_edicion }, propuestas, deDatito, votacion, nombreCompleto, url }) → modelo` para la plantilla de la Task 6 (asunto «La principal del equipo del lunes 23/11/2026», saludo con el primer nombre, la ganadora con su título y su cifra clave, `resultado.texto`, `participacion`, `cierre`, la tabla y la regla).
  - `detalleDeLaEdicion({ …, eleccion = null, votacion = null })`: `votacion` es la salida de `votacionDelDetalle` (o null). Suma la clave `votacion` al final (después de `principal_equipo`, null si no viene). Con `votacion`, `principal_equipo` sale de ella: abierta, `{ orden: null, coincide: false, rotulo, pastilla, marca, resumen: votacion.resumen, cifra_clave: null, quien: null }`; cerrada, la de `resultado.orden` con los textos de hoy («la misma de Datito (propuesta N).» o «Propuesta N · <título>», la cifra si no es la de Datito) y `quien` null. Sin `votacion`, como hoy (`eleccion`).
  - `itemDeLaLista(fila, envio = null)`: `fila.votacion` (opcional) `{ abierta, orden_ganadora, de_la_lista }`: abierta, la de Datito con «Principal de Datito»; cerrada, la de `orden_ganadora` con «Principal del equipo»; sin `fila.votacion`, como hoy (`orden_del_equipo`). Suma la clave `votacion` (`de_la_lista`, la salida de `votacionDeLaLista`, o null) al final.
- [ ] **Step 1: Write the failing tests** en `tests/dato-quincena-votacion-reglas.test.js`: cada estado de `votacionDelDetalle` (abierta sin voto de quien mira, abierta con su voto, quien mira fuera de la foto, sin calendario, cerrada por puntos, por desempate con y sin la de Datito, nadie votó, sin personas, una persona con la cuenta borrada → «Una persona que ya no está» en `participacion` y en `tabla.votantes`), con `deepStrictEqual` sobre la forma entera y las claves en orden; `votacionDeLaLista`; `itemsDeLaVotacionEnMiEspacio` (aparece el día del cierre solo para quien está en la foto y no votó, no aparece si votó, si está cerrada, sin calendario o fuera del rango); `modeloDelMailDeLaVotacion`.
  En `tests/dato-quincena-reglas.test.js`: `detalleDeLaEdicion` con `votacion` abierta y cerrada contra fixtures nuevos de `tests/fixtures/dato-quincena-respuestas.json` (`detalle_votacion_abierta`, `detalle_votacion_abierta_con_voto`, `detalle_votacion_cerrada_puntos`, `detalle_votacion_cerrada_desempate`, `detalle_votacion_cerrada_nadie`, armados con la edición de prueba de `tests/dato-quincena-fixtures.js` y personas inventadas); los fixtures existentes suman `"votacion": null` al final; `itemDeLaLista` con `fila.votacion` abierta y cerrada.
- [ ] **Step 2: Run** `node --test tests/dato-quincena-votacion-reglas.test.js tests/dato-quincena-reglas.test.js` → FAIL.
- [ ] **Step 3: Implement** las funciones nuevas y los cambios de `detalleDeLaEdicion`, `principalEquipoDelDetalle` e `itemDeLaLista`. `datoQuincenaReglas.js` no importa de `datoQuincenaVotacionReglas.js` (evita el ciclo con `NOMBRE_DEL_BOT`): recibe `votacion` ya armada.
- [ ] **Step 4: Run** el mismo comando → PASS. También `node --test tests/dato-quincena-correo-reglas.test.js tests/dato-quincena-resguardo.test.js` → PASS (el mail de la edición no cambia: `modeloDelMail` no pasa `votacion`).
- [ ] **Step 5: Commit** `feat(dato-quincena): los textos de la votación del detalle, la lista, Mi espacio y el mail`.

---

### Task 4: Las consultas, la llegada, el voto y las lecturas

**Files:**
- Create: `services/datoQuincenaVotacionDatos.js`, `controllers/datoQuincenaVotacionController.js`
- Modify: `services/datoQuincenaDatos.js` (`guardarEdicion`, `listarEdiciones`), `controllers/datoQuincenaController.js` (`ver`, `listar`, `elegirPrincipalDelEquipo`), `routes/index.js`
- Test: `tests/dato-quincena-votacion-api.test.js` (nuevo), `tests/dato-quincena-api.test.js`, `tests/permisos.test.js`

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces:
  - `crearLaVotacion(conexion, { edicionId, ahora })`: inserta la fila de `dato_quincena_votaciones` (`creada_at` = `ahora`) y la foto (`INSERT … SELECT` de `dato_quincena_votantes` con `usuarios.activo = 1`). La llama `guardarEdicion` en su transacción, después de la fila del correo, para regulares y pilotos.
  - `leerVotaciones(edicionIds, conexion = pool) → Map<edicion_id, { tipo, fecha_edicion, recibida_ts, cierre_at, sellada_at, aviso, ordenes, personas: [{ persona_id, usuario_id, nombre }], votos: [{ id, persona_id, orden, votado_at }] }>`: a lo sumo cuatro consultas con `IN (?)` (la votación con su edición, los `orden` de sus propuestas en orden, la foto y los votos); con la lista vacía, un Map vacío sin consultar. `nombre` de `usuarios.nombre_completo` (null sin la cuenta). Las fechas como texto `'%Y-%m-%d %H:%i:%s'`, `fecha_edicion` como 'AAAA-MM-DD' y `recibida_ts` con `UNIX_TIMESTAMP`. La usan `ver`, `listar`, el sellado (Task 6) y Mi espacio (Task 7).
  - `guardarVoto({ edicionId, usuarioId, orden, ahora, estaCerrada }) → { votacion, persona, cerrada, cambio }`: en una transacción, `SELECT … FROM dato_quincena_votaciones v JOIN dato_quincena_ediciones e … FOR UPDATE` (trae `cierre_at`, `fecha_edicion`, `recibida_ts`); sin fila, `{ votacion: false }`; sin la persona en la foto, `{ votacion: true, persona: false }`; si `estaCerrada({ cierre_at, fecha_edicion, recibida_ts })` es true, `{ …, cerrada: true }`; si el voto vigente de esa persona ya es `orden`, `cambio: false` sin escribir; si no, inserta con `votado_at = ahora`.
  - `votar(req, res)` (el controlador nuevo), con los controles y los mensajes de la spec, sección 3, «Votar», en ese orden. Lee el calendario con `leerCalendario` una vez; con `calendario.error !== null`, `estaCerrada` devuelve true solo si está sellada, y el voto de una no sellada se rechaza con 500 `MENSAJES_VOTACION.alGuardar` sin escribir. Respuesta 200 `{ success: true, data: { cambio }, message }` con «Guardamos tu orden. Lo podés cambiar hasta el martes 24/11 a las 12:00.» o «Tu orden ya era ese.».
  - Ruta: `router.put('/dato-quincena/ediciones/:id/voto', authMiddleware, votar)`, junto a las del dato de la quincena.
  - `ver`: lee la votación de la edición (`leerVotaciones([id])`) y el calendario (una vez), arma `estadoDeLaVotacion` y `votacionDelDetalle` con `quienMira = req.user.userId`, y los pasa a `detalleDeLaEdicion`; sin fila de votación, `votacion: null` y la elección a mano como hoy.
  - `listar` / `listarEdiciones`: una consulta más para todas las ediciones de la página (`leerVotaciones(ids)`) y el calendario una vez; cada fila suma `votacion` para `itemDeLaLista`.
  - `elegirPrincipalDelEquipo`: después del 404 (que sigue antes de mirar el cuerpo), siempre 409 `MENSAJES_VOTACION.ahoraSeVota`, sin escribir.
- [ ] **Step 1: Write the failing tests** en `tests/dato-quincena-votacion-api.test.js` (servidor de prueba con `iniciarServidor`, base `rpad_test_dato-quincena-votacion-api`, personas y tokens como en `tests/dato-quincena-api.test.js`; el POST de Datito con el paquete de `tests/dato-quincena-fixtures.js`; `ahora` del servidor no se fija, así que el cierre se controla con `fecha_edicion` futura o pasada y un `cierre_at` sellado a mano):
  - el POST crea la votación y la foto con las personas activas de `dato_quincena_votantes` (una inactiva no entra); un 200 repetido no crea otra; un piloto también la tiene;
  - el PUT: 404 con id `abc` y 999999 (antes de mirar el cuerpo); 409 `noSeVota` en una edición sin votación; 403 `noEstas` para un lector fuera de la foto; 409 `cerro` en una sellada; 400 `orden` con `[1,2]`, `[1,1,2,3]`, `'1,2,3,4'`, sin cuerpo; 200 con `cambio: true` y el mensaje con la fecha; el mismo orden otra vez, `cambio: false` sin fila nueva; cambiar el orden, una fila más; un lector de la foto puede votar (no es por rol); quien se suma a la lista después de la llegada recibe 403;
  - **Review Focus 1**: dos PUT distintos a la vez de la misma persona → 200 los dos, dos filas como mucho y ningún 500; dos PUT iguales a la vez → una sola fila;
  - **Review Focus 2**: con una votación cuyo cierre calculado es pasado (llegada vieja), 409 `cerro`; con `cierre_at` sellado igual al minuto actual, 409; el borde exacto de 11:59:59 / 12:00:00 se prueba en las reglas (Task 2) y acá se controla que `votar` usa `estadoDeLaVotacion` con `ahoraArgentina()`;
  - **Review Focus 4**: `PUT …/principal-equipo` con `{ orden: 1 }` → 409 `ahoraSeVota` y ninguna fila nueva en `dato_quincena_principal_equipo`; con id 999999 → 404;
  - el GET del detalle trae `votacion` con la forma de los fixtures (`forma()`), `tu_orden` y `puede_votar` según quien pide, y `votacion: null` en una edición sin votación con la elección a mano de antes en `principal_equipo`; el GET de la lista trae `votacion` y la principal que cuenta;
  - sin las tablas nuevas, el detalle da 500 con su mensaje fijo (como el test de la principal sin su tabla).
  En `tests/permisos.test.js`, la ruta nueva en la lista de las que contestan 404 con el id 999999 antes de escribir, para cualquier rol con sesión. En `tests/dato-quincena-api.test.js`, los deepEqual del detalle y de la lista con la clave `votacion`, y los tests de la elección a mano: el PUT da 409 (los que esperaban 200 o 403 por rol pasan a esperar 409 después del 404; el de un lector, 403 sigue siendo de `adminOnly`, que se mantiene en la ruta).
- [ ] **Step 2: Run** (CONTENEDOR LIBRE) `node --test tests/dato-quincena-votacion-api.test.js tests/dato-quincena-api.test.js tests/permisos.test.js` → FAIL.
- [ ] **Step 3: Implement** los datos, el controlador, la ruta y los cambios de `guardarEdicion`, `listarEdiciones`, `ver`, `listar` y `elegirPrincipalDelEquipo`. `guardarVoto` usa el mismo cuidado que `guardarPrincipalDelEquipo` (sin `LOCK IN SHARE MODE`, por el deadlock documentado ahí).
- [ ] **Step 4: Run** el mismo comando → PASS. Y `node --test tests/dato-quincena-correo.test.js` → PASS (el POST sigue programando el correo igual).
- [ ] **Step 5: Commit** `feat(dato-quincena): votar la principal del equipo y leer la votación`.

---

### Task 5: La lista de quienes votan («Las personas»)

**Files:**
- Modify: `services/datoQuincenaCorreoDatos.js` (`personasDelCorreo`, `reemplazarDestinatarios`), `controllers/datoQuincenaCorreoController.js` (`verCorreo`, `cambiarDestinatarios`)
- Test: `tests/dato-quincena-correo-api.test.js`, `tests/dato-quincena-correo-reglas.test.js` (si cubre `listaDePersonas`)

**Interfaces:**
- Consumes: `textoDeLosQueVotan`, `textoDeLasListasGuardadas` (Task 2); `listaDePersonas` (la validación de hoy).
- Produces:
  - `GET /api/dato-quincena/correo`: cada persona suma `vota` (boolean) y la respuesta suma `votan_texto`.
  - `reemplazarDestinatarios(ids, usuarioId, ahora, votantes = null)`: con `votantes` un array, reemplaza también `dato_quincena_votantes` en la misma transacción, con las mismas validaciones (todas activas); con null, no la toca.
  - `PUT /api/dato-quincena/correo/destinatarios` acepta `{ usuarios, votantes }`; `votantes` ausente (`undefined`) → no cambia; presente y no válido (`listaDePersonas` da null) → 400 con el mensaje de hoy. `message`: con `votantes`, `textoDeLasListasGuardadas`; sin `votantes`, el de hoy (`textoDeLaListaGuardada`). `data` suma `votantes` (ordenados) cuando vino.
- [ ] **Step 1: Write the failing tests** en `tests/dato-quincena-correo-api.test.js`: el GET con `vota` y `votan_texto`; el PUT con las dos listas (las dos quedan, el mensaje «Guardamos la lista: lo reciben 2 personas y votan 3.»); **Review Focus 4**: el PUT sin `votantes` deja la lista de votantes como estaba y responde el mensaje de hoy; `votantes` con un inactivo, repetido o un texto → 400 y no cambia ninguna de las dos (transacción); un no administración → 403 como hoy.
- [ ] **Step 2: Run** (CONTENEDOR LIBRE) `node --test tests/dato-quincena-correo-api.test.js` → FAIL.
- [ ] **Step 3: Implement** los cambios.
- [ ] **Step 4: Run** el mismo comando → PASS.
- [ ] **Step 5: Commit** `feat(dato-quincena): la lista de quienes votan, con la del mail`.

---

### Task 6: El sellado y el mail de las 14:00

**Files:**
- Create: `services/datoQuincenaVotacion.js`
- Modify: `services/datoQuincenaVotacionDatos.js` (sellar, el aviso, administración para el mail), `services/emailTemplates.js` (`votacionResultadoTemplate`), `controllers/notificacionesController.js` (las dos corridas), `services/datoQuincenaCorreo.js` (`estadoDelCorreoDelDatoQuincena`: el aviso de Correos → Estado)
- Test: `tests/dato-quincena-votacion-sellado.test.js` (nuevo), `tests/email-diseno.test.js`, `tests/notificaciones.test.js`, `tests/permisos.test.js`

**Interfaces:**
- Consumes: `debeSellar`, `estadoDeLaVotacion`, `resultadoDeLaVotacion`, `votacionDelDetalle`, `modeloDelMailDeLaVotacion` (Tasks 2-3); `leerVotaciones` (Task 4); `conBloqueo(fn, nombre)` (`services/notasDigitales.js`); `deLicenciaOficial(dia, conexion)` (`services/miEspacioEventosDiarioDatos.js`); `leerConfig()` (`envioActivo`); `sendEmail`, `remitente`.
- Produces:
  - `BLOQUEO_VOTACION = 'rpad_dato_quincena_votacion'`.
  - `votacionesSinSellar(conexion = pool) → [{ edicion_id, tipo, fecha_edicion, recibida_ts }]`.
  - `sellarLaVotacion({ edicionId, cierre, ahora }) → boolean`: `UPDATE dato_quincena_votaciones SET cierre_at = ?, sellada_at = ? WHERE edicion_id = ? AND sellada_at IS NULL`; true solo con `affectedRows === 1` (es la reserva del mail).
  - `anotarElAviso({ edicionId, aviso, ahora })` y `administracionParaElAviso() → [{ id, nombre_completo, email }]` (activas, `esAdmin`, con email válido).
  - `ejecutarLaVotacionDelDatoQuincena({ ahora = ahoraArgentina(), calendario, enviar = sendEmail }) → { selladas, mails, errores, ocupada? }`, con `conBloqueo(…, BLOQUEO_VOTACION)`: por cada votación sin sellar (`leerVotaciones` de las de `votacionesSinSellar`), calcula el cierre con `estadoDeLaVotacion` y, si `debeSellar`, la sella; para el mail lee la edición (`leerEdicion`) y arma `votacionDelDetalle` con `quienMira` null y `modeloDelMailDeLaVotacion`; si la sella y es **regular**: con el envío apagado, `aviso = 'apagado'`; si no, un mail por persona de `administracionParaElAviso()` sin licencia oficial ese día (`deLicenciaOficial`), y `aviso` `enviado`, `parcial` o `fallido` según cuántos salieron (`no_corresponde` si no había a quién). Un piloto se sella con `aviso = 'no_corresponde'`.
  - `votacionDelDatoQuincenaAislada(calendario, { ahora } = {})`: lo mismo, nunca rechaza (errores con un texto fijo y a la consola solo el código).
  - `votacionResultadoTemplate(modelo) → { subject, html, text }` con `plantillaSimple`, el texto de la maqueta `~/rpad-notas/dq-principal-votacion/web/mail-resultado.html` (ver `generar-mail.mjs` al lado): asunto «La principal del equipo del lunes 23/11/2026», el recuadro celeste (`COLORES.encabezado` con su borde) con «PROPUESTA N» (y « · LA MISMA DE DATITO»), el título y la cifra clave; el resultado en negrita, la participación, el cierre; la tabla (sin votos no va) y la regla en chico; el botón «Ver la edición en el RPAD» a `${RPAD_URL}/dato-quincena.html?id=N`; la nota «Te llega porque sos de administración del RPAD. Votan las personas con «Vota» tildado en la pestaña Envío y votación.». Todo texto del modelo pasa por `escapeHtml`.
  - En `notificacionesController.js`: `ejecutarNotificacionesDiarias` y `ejecutarNotificacionCambiosPendientes` llaman `votacionDelDatoQuincenaAislada(calendario)` después de `correoDelDatoQuincenaAislado` y suman `resultados.votacion_dato_quincena`. Las rutas a mano comparten el controlador: `debeSellar` ya frena antes de las 14:00 del día del cierre.
  - Correos → Estado: `estadoDelCorreoDelDatoQuincena` suma una alerta si la última votación regular sellada en los últimos 14 días tiene `aviso` `parcial` o `fallido`: «El mail de la votación del dd/mm no le llegó a todas las personas de administración.».
- [ ] **Step 1: Write the failing tests**:
  - `tests/dato-quincena-votacion-sellado.test.js` (base propia, `enviar` falso que junta los mails, `ahora` y calendario fijos por parámetro): una votación regular con cierre '2026-11-24 12:00' no se sella a '2026-11-24 12:30' ni a '13:59' y se sella a '14:00' con un mail a cada persona de administración (no a un lector ni a una inactiva ni a una de licencia oficial ese día), `aviso = 'enviado'`; con el envío apagado se sella sin mail y `aviso = 'apagado'`; un piloto se sella sin mail; un sábado no sella; con `calendario.error` no sella; **Review Focus 5**: dos corridas seguidas (y dos a la vez con `Promise.all`) → un solo mail por persona; un `enviar` que falla para una persona → `aviso = 'parcial'` y la alerta en `estadoDelCorreoDelDatoQuincena`; una sellada no se vuelve a abrir aunque el calendario cambie (el detalle la sigue mostrando cerrada con su `cierre_at`).
  - `tests/email-diseno.test.js`: el asunto en `ASUNTOS` y el texto visible en `TEXTOS` de la plantilla nueva; marco, remitente y sin emojis como las demás.
  - `tests/notificaciones.test.js` y `tests/permisos.test.js`: tomar también el candado `rpad_dato_quincena_votacion` en la otra conexión, como hoy con `rpad_dato_quincena_correo`.
- [ ] **Step 2: Run** (CONTENEDOR LIBRE para los de base) `node --test tests/dato-quincena-votacion-sellado.test.js tests/email-diseno.test.js tests/notificaciones.test.js tests/permisos.test.js` → FAIL.
- [ ] **Step 3: Implement** el servicio, las consultas, la plantilla, el paso en las dos corridas y la alerta.
- [ ] **Step 4: Run** el mismo comando → PASS. Y `node --test tests/dato-quincena-resguardo.test.js tests/dato-quincena-correo.test.js` → PASS.
- [ ] **Step 5: Commit** `feat(dato-quincena): el sellado de la votación y el mail del resultado a las 14:00`.

---

### Task 7: Mi espacio

**Files:**
- Modify: `controllers/miEspacioEventosController.js` (`listarEventos`), `services/datoQuincenaVotacionDatos.js` (`votacionesAbiertasDe`), `public/js/mi-espacio.js`, `public/mi-espacio.html` (la leyenda y el `?v=`), el CSS de la agenda (donde estén las clases del chip del dato de la quincena)
- Test: `tests/mi-espacio-eventos-api.test.js`, los tests de frontend de Mi espacio que dibujan la agenda, `tests/paginas.test.js`

**Interfaces:**
- Consumes: `itemsDeLaVotacionEnMiEspacio` (Task 3), `leerVotaciones` (Task 4), `estadoDeLaVotacion` (Task 2).
- Produces:
  - `votacionesAbiertasDe(usuarioId) → [edicion_id]`: las votaciones sin sellar en cuya foto está la persona.
  - `GET /api/mi-espacio/eventos` suma la clave `dato_quincena_votacion` (después de `dato_quincena_activo`), aislada como `datoQuincenaDelListado` (si falla, `[]` y a la consola), con el calendario de `filasFeriados` del mismo pedido.
  - En `mi-espacio.js`: los cambios marcados `MAQUETA` de `~/rpad-notas/dq-principal-votacion/mi-espacio/js/mi-espacio.js` (comparar con `public/js/mi-espacio.js`: `datosDelVoto`, la casilla del día como enlace con «Hasta 12:00» en negrita, el día elegido y «Próximos» con el enlace «Votar», el ícono `vote` de Lucide, la leyenda `ag-leyenda-voto` y que un clic en un `a[href]` no abra «Nuevo evento»), sin los comentarios `MAQUETA`. El estilo cobre, de la maqueta (`css/` de esa carpeta).
- [ ] **Step 1: Write the failing tests**: en `tests/mi-espacio-eventos-api.test.js`, la lista exacta de claves de la respuesta suma `dato_quincena_votacion` (línea ~169), y un caso con una votación abierta cuyo cierre cae en el rango: le aparece a quien está en la foto y no votó, no a quien votó ni a quien no está; en el test de frontend de Mi espacio, la casilla, el día elegido y «Próximos» dibujan el ítem con su enlace y su ícono, y escapan los textos.
- [ ] **Step 2: Run** (CONTENEDOR LIBRE para el de API) `node --test tests/mi-espacio-eventos-api.test.js <el de frontend de Mi espacio> tests/paginas.test.js` → FAIL.
- [ ] **Step 3: Implement**; sube el `?v=` de `mi-espacio.js` (y del CSS si cambia) con su constante en `tests/paginas.test.js`.
- [ ] **Step 4: Run** el mismo comando → PASS.
- [ ] **Step 5: Commit** `feat(mi-espacio): votar la principal del dato de la quincena, el día del cierre`.

---

### Task 8: La página del dato de la quincena

**Files:**
- Modify: `public/dato-quincena.html` (el `<style>`, el diálogo `#dq-voto` en lugar de `#dq-principal`, `?v=20261238`), `public/js/dato-quincena.js`
- Test: `tests/dato-quincena-frontend.test.js`, `tests/paginas.test.js`

**Interfaces:**
- Consumes: las respuestas de las Tasks 3-5 (`votacion` del detalle y de la lista, `vota` y `votan_texto` de la pestaña).
- Produces (en `dato-quincena.js`; la referencia visual es `~/rpad-notas/dq-principal-votacion/web/maqueta-votacion.js` con la forma B, y sus estilos `css/maqueta.css`, pasados a clases `dq-`):
  - `TEXTOS_DEL_VOTO` (`Object.freeze`): `votar` «Votar», `cambiar` «Cambiar mi orden», `guardar` «Guardar mi orden», `deNuevo` «Empezar de nuevo», `faltaTuVoto` «Falta tu voto», `noEstas` «Votan las personas de la lista que arma administración.», `verLosVotos` «Ver los votos», `gano` «Ganó», `tuOrden` «Tu orden», `primero` «Tocá primero la que más querés trabajar.», `error` «No se pudo guardar tu orden. Probá de nuevo en unos minutos.». «Te faltan N.» / «Te falta 1.» y «Listo: ya están las N.» los arma la página con el conteo.
  - Se borran `TEXTOS_DE_LA_PRINCIPAL`, el diálogo de la principal y sus funciones (`abrirLaPrincipalDq`, `cerrarLaPrincipalDq`, `confirmarLaPrincipalDq`, `conectarLaPrincipalDq`, `guardarLaPrincipalDq`, `actualizarGuardarLaPrincipalDq`, `htmlDelDialogoDeLaPrincipal`, `FOCO_DESPUES_DE_ELEGIR`) y sus casos en `alTocarDq`.
  - `htmlDeLaFranja(detalle, principales)`: `votacion` null → la franja de hoy sin botones; abierta → «Principal del equipo:» + `votacion.resumen`, `participacion`, «Tu orden» (lista de `tu_orden`), la pastilla «Falta tu voto» (clase de la pastilla en espera, con el triángulo) y el botón `button[data-votar]` («Votar» / «Cambiar mi orden») si `puede_votar`, o `noEstas`; cerrada → `principal_equipo.resumen`, su cifra, `resultado.texto` en negrita, `participacion` y `cierre`, y `<details>` «Ver los votos» con `regla` y la tabla (`htmlDeLosVotos`), con «Ver la propuesta».
  - `htmlDeLosVotos(resultado)`: `<table>` con encabezados de columna (Propuesta, cada votante, Puntos) y de fila (cada propuesta, con la marca de Datito en la suya); la ganadora con una clase de fondo y «Ganó» con el tilde.
  - `htmlDelDialogoDelVoto(detalle, tocadas)`: una fila por propuesta (`button[data-tocar="<orden>"]` con `aria-pressed`, el puesto o un punto, «Propuesta N» y el título, la marca de Datito), la región viva con «Tocá primero…» / «Te faltan N.» / «Listo: ya están las N.» y `button[data-de-nuevo]` si hay tocadas. El texto de arriba es `votacion.dialogo`.
  - Estado: `vistaDatoQuincena.voto` (`{ volverA, tocadas }` o null) y `vistaDatoQuincena.guardandoVoto`. El diálogo arranca vacío sin voto y con `tu_orden` si votó. `#dq-voto-guardar` deshabilitado hasta tener todas tocadas y hasta la respuesta. Una por vez: mientras se guarda no abre el diálogo ni «Reenviar…».
  - Guardar: `PUT /dato-quincena/ediciones/:id/voto` con `{ orden: tocadas }` (con `API.pedirJson`); el `message` al toast; error → el mensaje del servidor y el diálogo queda abierto; si sale bien, cierra y `redibujarElDetalleDq` en la misma pestaña y propuesta, con el foco en `button[data-votar]` del panel visible.
  - Propuestas: con `puede_votar`, en la cabecera de cada propuesta, «Tu N.º» (si votó) y `button[data-votar]`; en el índice, la marca «Tu N.º» con el estilo de las otras marcas; sin «Elegir como principal del equipo» ni «Es la principal del equipo».
  - La tarjeta: con `item.votacion`, el pie suma «Se vota hasta …» (el estilo de la pastilla programada, con el reloj) y, con `falta_tu_voto`, «Falta tu voto».
  - La pestaña: `htmlDePestanas` dice «Envío y votación»; `TITULO_CORREO_DQ` = `Envío y votación - ${TITULO_DQ}`; `#correo` igual.
  - `htmlDelCorreo`: «Envío por correo» igual; después, la sección «La votación de la principal del equipo» (los dos párrafos de la maqueta, armados en la página como el resto de esa pestaña, con `NOMBRE_DEL_BOT`); «Quién lo recibe» pasa a «Las personas»: los dos renglones de qué es cada casilla, la tabla Persona | Rol | Correo | Recibe el mail | Vota (`input[data-usuario]` y `input[data-vota]`), el pie `#dq-cuantas-reciben` + `#dq-cuantas-votan`, un «Guardar» (`button[data-guardar-lista]`) que manda `{ usuarios, votantes }`.
  - `textoDeLosQueVotan(n)`: copia del navegador, atada por un test de paridad con la del servidor (como `textoDeLosQueReciben`).
- [ ] **Step 1: Write the failing tests** en `tests/dato-quincena-frontend.test.js` (el contexto `vm` de hoy): la franja con cada fixture de la Task 3 (abierta sin voto, con voto, fuera de la foto, sin calendario, cerrada por puntos y por desempate, nadie votó, una edición de antes sin botones para administración), que todo texto pasa por `escapeHtml` (un título con `<b>` sale escapado), que no queda ningún «Validar la de Datito», «Elegir otra», «Cambiar» ni «Elegir como principal del equipo»; el diálogo: tocar 3, 1, 4 y 2 da `[3,1,4,2]`, tocar una con puesto la saca y las de atrás suben, «Empezar de nuevo», «Guardar» deshabilitado hasta completar, una edición de una sola propuesta (**Review Focus 3**), el PUT manda `{ orden }` y redibuja con el foco en `button[data-votar]`, un error deja el diálogo abierto, Escape y Tab; Propuestas con «Tu N.º» y el botón; la tarjeta con las dos pastillas; la pestaña «Envío y votación», la tabla con las dos casillas, el recuento al tildar y el cuerpo del PUT con `usuarios` y `votantes`; la paridad de `textoDeLosQueVotan`. En `tests/paginas.test.js`, `VERSION_DATO_QUINCENA` = '20261238'.
- [ ] **Step 2: Run** `node --test tests/dato-quincena-frontend.test.js tests/paginas.test.js` → FAIL.
- [ ] **Step 3: Implement**; el diálogo estático en `dato-quincena.html` como el de «Reenviar» (velo, Escape, foco que no sale con Tab ni Mayúscula+Tab).
- [ ] **Step 4: Run** el mismo comando → PASS.
- [ ] **Step 5: Ver en el navegador** con el servidor local sobre una **copia** de la base (`rpad_sim_votacion`, armada con `mysqldump` de `datospublicos_mcr_rpad`; el `.env` del worktree apuntado a la copia solo mientras dure y restaurado al final): votar con dos personas inventadas, la franja abierta y cerrada (sellando a mano con un `UPDATE` en la copia), la tarjeta, la pestaña y Mi espacio, en escritorio y a 375 px, sin errores en la consola. Borrar la copia al terminar.
- [ ] **Step 6: Commit** `feat(dato-quincena): votar en la página, la franja con el resultado y la pestaña Envío y votación`.

---

### Task 9: La documentación

**Files:**
- Modify: `docs/temas/dato-quincena-principal-equipo.md` (pasa a contar la principal votada: reglas, API, página, sellado y mail; las ediciones de antes en una sección corta), `docs/temas/dato-quincena.md` (punteros, la clave `votacion` del detalle y de la lista, que `ver` mira a quien pide), `docs/temas/dato-quincena-correo.md` (el nombre de la pestaña, «Las personas», el PUT con `votantes`, el paso de las corridas), `docs/temas/calendario-y-corridas.md`, `docs/temas/mi-espacio-agenda.md`, `CLAUDE.md` (la fila de «El mapa» si nace un documento), `.claude/rules/dato-quincena.md` (la regla de la tabla: la principal se vota; los votos, solo INSERT; el candado nuevo; pide permiso: es ruta protegida)
- Test: `tests/documentos.test.js`
- [ ] **Step 1:** Escribir lo vigente, un renglón por oración, con las decisiones y su motivo (las «mi decisión» de la spec), sin «pasó a» ni historia. Si `dato-quincena-principal-equipo.md` pasa el tope, partir el sellado y el mail en `docs/temas/dato-quincena-votacion.md` y sumarlo a «El mapa» y a la regla.
- [ ] **Step 2: Run** `node --test tests/documentos.test.js` → PASS.
- [ ] **Step 3: Commit** `docs(dato-quincena): la principal del equipo se vota`.

---

### Task 10: El cierre de la rama

- [ ] **Step 1:** Suite completa (CONTENEDOR LIBRE, la base compartida ya migrada por la coordinadora): `npm test 2>&1 | tee ~/rpad-notas/logs/dq-principal-votacion-rama.log` → 0 fallas. Comparar con la suite de antes de empezar.
- [ ] **Step 2:** Revisión final de la rama con Fable 5.2 en esfuerzo alto (`/code-review high` o un revisor con ese modelo), con la spec y este plan; corregir lo que confirme y volver a correr los tests tocados.
- [ ] **Step 3:** Control del repo público: `git diff 3b6f10a --stat` y una búsqueda de los nombres de la tabla `usuarios` de la base local y de direcciones de mail en el diff → nada.
- [ ] **Step 4:** Merge en main (squash, mensaje `feat(dato-quincena): la principal del equipo se vota`), push, y suite de main.
- [ ] **Step 5:** Kit `~/rpad-kits/RPAD-deploy-dato-quincena-principal-votacion/` contra 3b6f10a: el zip sin carpeta raíz con los archivos cambiados (sin tests ni docs), la migración y su vuelta atrás, `PASOS.txt` (comprobar antes `dato-quincena.js?v=20261237`; correr la migración en phpMyAdmin antes de subir el código; Restart; comprobar `?v=20261238`; ventana fuera de las 8:05, las 14:00, las horas en punto y y media, y de las rutinas de Datito del viernes a las 10:00 y 11:30; antes del lunes 07/12, cuya votación cierra el miércoles 09/12 a las 12:00) y la vuelta atrás (archivos anteriores, Restart, después el rollback). Controlarlo con `~/rpad-notas/control-kit.py`.
- [ ] **Step 6:** Avisar TODO EN VERDE a la coordinadora (`local_e7d7604b-f7e1-46e9-9f36-ba3f80b7ac0b`) con el commit de main, la suite y el kit; dejar la nota de cierre en la carpeta de notas compartida.
