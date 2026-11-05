# El aviso diario de la agenda, de quién depende cada uno y el formulario — plan de implementación

**Goal:** que el formulario no deje cargar un evento sin elegir quién lo ve, que cada usuario tenga de quién depende, que a las 14:00 salga la agenda del próximo día hábil, que a las 8:05 salga a los jefes lo que se sumó, y que cualquier rol pueda crear un Laboral con cualquier persona.

**Architecture:** tres archivos nuevos para la corrida, `services/miEspacioEventosDiario{Reglas,Datos,}.js`, con su candado, sus reservas y su fila en el registro de corridas, enganchada aislada a las dos corridas que ya existen. La cadena sale de una sola función pura, `superioresDe`. Lo que un jefe recibe de un Público se arma sin leer su título ni su detalle.

**Tech Stack:** Node 22, Express 4, MariaDB 10.6+ (mysql2/promise), vanilla JS, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-04-agenda-aviso-y-dependencia-design.md` (el usuario aprobó la spec y este plan el 04/11/2026). El executor la lee entera, con su maqueta (`...-mockups/`), y también `docs/temas/mi-espacio-agenda.md`, `mi-espacio-evento-publico.md`, `configuracion.md`, `calendario-y-corridas.md` y `base-de-datos.md`. Los textos son los de la spec, al pie de la letra.

**Turno:** se implementa cuando la coordinadora da el turno. Antes de la Task 1: `sync_with_base_branch`, ver qué cambió en estos archivos y ajustar el plan. Las líneas citadas son de d6de459.

## Global Constraints

- **El aviso nuevo no frena nada, ni al revés:** las notas de las 8:05, las que esperan la firma y los recordatorios de las 14:00 salen igual si este paso tira, y este paso corre aunque ellos tiren.
- **De un Público ajeno, ni el título ni el detalle:** ni al mail, ni a un log, ni al resultado de la corrida.
- **Un Privado no le llega a nadie más.** Quien solo fue elegido para ver un Público no recibe ningún mail.
- **Nunca nombres reales** en el repo. Antes de cada commit, buscar en el diff los nombres y usernames de la tabla `usuarios` de la base local. Las personas de los tests, con nombres inventados y los «Test <clave>» de `crearUsuariosPrueba`.
- Ningún email real: en local todo va a Mailpit. Nunca `/api/cron/*` en producción. Un test nuevo llama al servicio con un hoy fijo; el orden y el aislamiento, al controlador con `res` falso y reloj fijo.
- `sendEmail`, siempre con `to` no vacío. En la consola, solo la pila. El texto de nodemailer no va a un resultado.
- `docker` no está en el PATH (`/Applications/Docker.app/Contents/Resources/bin/docker`). Nunca `docker compose` desde el worktree ni `down -v`, y nada de `pkill -f` ni `killall` con un patrón. Una sola suite a la vez por contenedor. Copiar `.env` del checkout principal, sin mostrarlo, con `RPAD_TESTS_DB_LOCAL=1` y `DB_NAME=rpad_rama_agenda_aviso`.
- **`datospublicos_mcr_rpad` es de solo lectura y se comparte.** Para escribir, `rpad_rama_agenda_aviso`, y otra para la simulación. Se borran al cerrar. Tienen datos reales: nada de eso va al repo. No se leen títulos ni detalles de eventos privados de otras personas.
- `npm test` completo antes de empezar y después de cada tarea. Commit y push de la rama después de cada tarea, en español, con la línea `Co-Authored-By`.
- Cada script que cambia sube su constante en `tests/paginas.test.js` y su `?v=` en el HTML.
- Nunca desplegar.

**Modelos:** las tareas 1 a 10 están en la lista fija (migración, reglas, permisos, API que escribe, corridas y formularios): **Opus, esfuerzo Extra**. La 11, documentos: Sonnet, Alto, con revisión de Opus. Revisión de cada tarea y de la rama: Opus, Extra.

---

## Task 1: Las tablas

**Files:** `database/updates/migracion-mi-espacio-eventos-diario.sql`, `database/updates/rollback-mi-espacio-eventos-diario.sql`, `database/schema.sql`, `tests/schema.test.js`, `docs/temas/base-de-datos.md`, `docs/temas/despliegue.md`.

- [ ] Tests en `tests/schema.test.js`: las columnas y las tablas de la spec, sección 9. El rollback corre antes que los de las migraciones de las que depende (`:2187` borra `mi_espacio_eventos`, y la tabla de informados la referencia).
- [ ] Migración, con el encabezado de `migracion-notas-firma-digital.sql` (qué hace, orden, por qué es obligatoria, cómo deshacerla, «Se puede volver a correr»):

```sql
SET NAMES utf8mb4;
ALTER TABLE `usuarios`
  ADD COLUMN IF NOT EXISTS `depende_de` int(11) DEFAULT NULL AFTER `vinculo`,
  ADD COLUMN IF NOT EXISTS `eventos_por_mail` tinyint(1) NOT NULL DEFAULT 1 AFTER `depende_de`,
  ADD KEY IF NOT EXISTS `fk_usuarios_depende_de` (`depende_de`);
-- La clave foránea, solo si no está: como `database/updates/migracion-notas-firma-digital.sql:31`
ALTER TABLE `mi_espacio_eventos` ADD COLUMN IF NOT EXISTS `publicado_at` datetime DEFAULT NULL AFTER `texto_publico`;
CREATE TABLE IF NOT EXISTS `mi_espacio_evento_informados` (...);
CREATE TABLE IF NOT EXISTS `mi_espacio_diario_envios` (...);
-- Los Laborales «para todos» de antes querían decir «la administración». Primero, las filas de un recordatorio apagado por
-- quien dejó de serlo: hoy no le dan acceso y convertidas sí (ELEGIDA)
DELETE p FROM `mi_espacio_evento_personas` p
  JOIN `mi_espacio_eventos` e ON e.id = p.evento_id AND e.compartido = 1 AND e.para_todos = 1
  JOIN `usuarios` u ON u.id = p.usuario_id AND u.rol NOT IN ('superadmin', 'admin', 'editor');
INSERT IGNORE INTO `mi_espacio_evento_personas` (`evento_id`, `usuario_id`)
  SELECT e.id, u.id FROM `mi_espacio_eventos` e
  JOIN `usuarios` u ON u.activo = 1 AND u.rol IN ('superadmin', 'admin', 'editor') AND (e.creado_por IS NULL OR u.id <> e.creado_por)
  WHERE e.compartido = 1 AND e.para_todos = 1;
UPDATE `mi_espacio_eventos` SET `para_todos` = 0 WHERE `compartido` = 1 AND `para_todos` = 1;
```

  Comprobar que la conversión conserva `sin_recordatorio` de las filas que había (`INSERT IGNORE`), que un ex administrador con su recordatorio apagado no queda viendo el evento, y que el código actual, sin tocar, sigue mostrando esos eventos a las mismas personas: ese es el orden del despliegue. El encabezado dice que se puede volver a correr **solo antes de subir el código**.
- [ ] Rollback con lo que dice la spec, sección 9, en el encabezado. No devuelve los «para todos».
- [ ] `database/schema.sql`: todo lo mismo.
- [ ] Crear `rpad_rama_agenda_aviso` desde el dump y correrle la migración dos veces. La base compartida no se toca: la coordinadora la migra en su control.
- [ ] `docs/temas/despliegue.md`: fila 36. `docs/temas/base-de-datos.md`: las columnas y las tablas.
- [ ] Commit: `feat(agenda): las tablas del aviso diario y de quién depende cada uno`.

## Task 2: La cadena y la API de Usuarios

**Files:** `services/usuariosReglas.js`, `controllers/usuariosController.js`, `tests/usuarios-reglas.test.js`, `tests/usuarios-panel.test.js`.

- [ ] Tests primero. En reglas, `superioresDe(id, usuarios)` y `quienesDependenDe(id, usuarios)`: sube, salta desactivados, sin repetidos, nunca la propia persona, corta un ciclo, id que no existe da []. `rechazoDeDependencia({ id, dependeDe, usuarios })` con cada mensaje de la spec, sección 3; quien ya estaba cargada y se desactivó no da error si no cambia. `validarDatosUsuario` con `depende_de` (`''`, null, un entero positivo, otra cosa).
- [ ] En el panel: admin y superadmin cargan, el editor sobre lector y colaborador sí y sobre un admin 403, la cuenta del superadmin solo su titular, una pestaña vieja sin el campo no lo toca, el historial lo registra y **no** hay aviso al superadmin, y la lista y el detalle traen `depende_de`.
- [ ] `superioresDe` en `usuariosReglas.js`, sobre filas `{ id, activo, depende_de }`, con un `Set` de vistos.
- [ ] `controllers/usuariosController.js`: `depende_de` en `CAMPOS_EDITABLES` (`:19`), `COLUMNAS` (`:22`), `aRespuesta` (`:30`), el INSERT y el detalle del alta (`:160-173`); en `bloquearUsuarios` (`:84`) suma `depende_de`, para controlar ciclos con esas filas bloqueadas. El alta no tiene `id`: su control es solo que exista y esté activa.
- [ ] `aRespuesta` suma `depende_de_nombre`, `no_elegibles` y `al_desactivar` (spec, sección 3), con las filas de todos, en la lista y en el detalle: una consulta, sin N+1.
- [ ] `tests/usuarios-panel.test.js` y `tests/helpers.js:286`: comprobar que la clave `ON DELETE SET NULL` no traba la limpieza.
- [ ] Commit: `feat(usuarios): de quién depende cada uno, en la API`.

## Task 3: El panel de Usuarios

**Files:** `public/configuracion.html`, `public/js/usuarios.js`, `tests/usuarios-frontend.test.js`, `tests/paginas.test.js`. Maqueta: `js/maqueta-usuarios.js` (`MQU`).

- [ ] Tests: el `<select id="u-depende">` después de «Vínculo», sin los `no_elegibles` del servidor, con la desactivada que ya estaba y su «(desactivado)»; «Depende de …» en la fila, escapado; `hayCambiosSinGuardar` lo tiene en cuenta (`normalizados`, `:512`); el texto al desactivar, en sus dos casos; y `NOMBRE_CAMPO` y el historial muestran el nombre, no el id.
- [ ] `CAMPO_A_INPUT` (`:39`), lo que se manda (`:475`), lo que se escribe (`:389`). `configuracion.html` carga siete scripts: ningún nombre de nivel superior repetido.
- [ ] El DOM falso de `tests/usuarios-frontend.test.js:66` suma el input nuevo.
- [ ] `VERSION_PANTALLAS` (`tests/paginas.test.js:29`) y el `?v=` de `usuarios.js`.
- [ ] Commit: `feat(usuarios): «Depende de» en el panel`.

## Task 4: El Laboral abierto

**Files:** `services/miEspacioEventosReglas.js`, `services/miEspacioEventosDatos.js`, `services/miEspacioDatos.js`, `controllers/miEspacioEventosController.js`, `controllers/miEspacioController.js`, `public/mi-espacio.html`, `public/js/mi-espacio.js`, `tests/mi-espacio-eventos-reglas.test.js`, `tests/mi-espacio-eventos-api.test.js`, `tests/mi-espacio-eventos-corrida.test.js`, `tests/mi-espacio-frontend.test.js`, `tests/paginas.test.js`, `tests/permisos.test.js`.

Va con su parte de la página, para no dejar la suite en rojo: las copias de `MENSAJES_EVENTO` y los textos se mueven juntos.

- [ ] Tests primero: un lector crea un Laboral, invita a un lector y a un admin, y les llega la invitación; «Todos» le llega a un colaborador y lo ve; la corrida se lo manda (`destinatariosDe` atado a `audienciaDe` por el test que ya hay); `GET /mi-espacio/personas` a un lector da 200, con todos los activos sin quien pide; ya no hay 400 `sinPermiso`; un cuerpo viejo con `compartido: true` sigue guardando un Laboral y, con `para_todos: true`, **queda con la administración activa como personas**, no como «Todos» (spec, 2.1); los textos de la spec, 2.4; el nombre corto contra todos los usuarios activos; y un «para todos» migrado (Task 1) sigue con la misma audiencia.
- [ ] Reglas: `ROLES_QUE_COMPARTEN` pasa a `ROLES_DE_ADMINISTRACION`, atada a `esAdmin` por su test, y queda solo para `administracionActiva` (`miEspacioDatos.js:259`). `MENSAJES_EVENTO`: `personas` nuevo y sin `sinPermiso`. `itemDeEvento` (`:808`): `nombresContra` siempre `usuarios`; `quienTexto` y `quien_largo`. `tipo`, «Elegí quién lo ve.».
- [ ] Datos (`miEspacioEventosDatos.js`): `visiblesPara` y `VISIBLES_CON_TODOS` se unen en una sola condición, para todos los roles; `audienciaDe` y `destinatariosDe` sin el rol; `eventosParaLaCorrida` lee todos los activos (`:329`); `personasParaCompartir` igual a `personasParaElPublico`, sin duplicar la consulta.
- [ ] Controlador: sale el `sinPermiso` de `datosDelGuardado` (`:157`) y el 403 de `listarPersonasParaCompartir` (`:293`); en `listarEventos`, `ve_companeros` en lugar de `puede_compartir`. `ausentesPara` no cambia: a quien no es administración, [].
- [ ] La página: sale `compartido` de `cuerpoDelEvento` (`:3016`), y todo `puedeCompartir`: `erroresDelEvento`, `cuerpoDelEvento`, `tiposQueSeVen`, `htmlDeTiposDeEvento`, `ayudasDelEvento`, `abrirEvento` (`Auth.isAdmin`, `:6392`) y `MENSAJE_LABORAL_SIN_PERMISO`. La lista del Laboral se pide cuando se elige. La copia de `MENSAJES_EVENTO` (`:2800`), `:3048` («Todos»), `:3240` (la confirmación del borrado) y `:2860`. La leyenda (`:3954-3955`): «Laborales» pierde `hidden` (`mi-espacio.html:1031`, `tests/paginas.test.js:789,793`) y «Compañeros que no están» usa `ve_companeros`; el mock de `tests/mi-espacio-frontend.test.js:1159` no lo agarra: sumar el test. Los de `:5989`, `:2033`, `:2081` y `:7001` cambian con los textos. `VERSION_MI_ESPACIO` y su `?v=`.
- [ ] `eventosDelResumen` ya recibe `usuarios`: comprobar con `usuariosDelResumen` caído ([]) que el Resumen sale igual.
- [ ] Commit: `feat(agenda): cualquiera crea un Laboral, con cualquier persona`.

## Task 5: Lo nuevo de la API de eventos

**Files:** `services/miEspacioEventosDiarioReglas.js` (se crea, con `cuandoLlegaElAviso`), `services/miEspacioEventosDatos.js`, `controllers/miEspacioEventosController.js`, `routes/index.js`, `tests/mi-espacio-eventos-diario-reglas.test.js` (se crea), `tests/mi-espacio-eventos-api.test.js`, `tests/permisos.test.js`.

- [ ] Tests: `cuandoLlegaElAviso` y `fraseDelAviso` con cada fila de la tabla de la spec, 2.3, en singular y en plural, con un feriado en el medio, con `CALENDARIO_FIJO`, **con hoy no hábil** (un sábado para el lunes, y un feriado para el día siguiente) y con `desde` antes de las 8:05. La API: `aviso-de-la-cadena` con una fecha que no sirve (400 en `fecha`); `eventos-por-mail` con `true`, `false` y otro valor; `GET /mi-espacio/eventos` trae `eventos_por_mail` y `alguien_depende`; `personas/publico` con `es_superior`, `nombre_corto` y la cadena primero; los mensajes de 2.5, también con una fecha que no llega; y `publicado_at`: se escribe al crear un Público, al pasar a Público y al cambiarle la fecha, y no al cambiarle el título, la hora o el texto, ni en un Privado o Laboral.
- [ ] Rutas: `/mi-espacio/eventos/aviso-de-la-cadena` va antes que las que llevan `:id`. Sumarlas a `RUTAS_MI_ESPACIO`.
- [ ] `aviso-de-la-cadena` arma el calendario con `calendarioCon(filas)` en ese pedido; si no se pudo leer la tabla, responde el genérico.
- [ ] Los mensajes dependen de la cadena y de la fecha: se arman en la transacción con las filas de `usuarios`, sin una consulta por persona.
- [ ] `guardarVistas` no cambia: la cadena no se escribe sola en las vistas; la marca la página y se guarda lo que llega.
- [ ] Commit: `feat(agenda): cuándo les llega el aviso, la casilla y a quién dice que le llega`.

## Task 6: El formulario

**Files:** `public/mi-espacio.html`, `public/js/mi-espacio.js`, `tests/mi-espacio-frontend.test.js`, `tests/paginas.test.js`. Maqueta: `js/mi-espacio.js` (buscar `window.MQ`), `js/maqueta-comun.js` (`piezas`, `cuandoDelAviso`, `elegidasDe`) y `css/propuesta.css`, de donde salen los estilos con los tokens `--sg-*`.

- [ ] Tests, puros, sin el DOM: `valoresDelEvento` nuevo con `tipo: ''`; `erroresDelEvento` sin tipo da el mensaje nuevo; `htmlDeTiposDeEvento` con los íconos y los tres para todos; `ayudasDelEvento` con cada fila de 2.2; las piezas del Público, con y sin cadena, en singular y en plural; `valoresConElTipo` con la preselección, solo en uno nuevo; `necesitaConfirmar` con 4, con 5, con quien ya estaba y con «Todos»; `iconoDelEvento` con el candado. Paridad de `MENSAJES_EVENTO`.
- [ ] `tests/paginas.test.js:1018-1023` y `:1156-1159`: el orden del modal y el HTML del grupo; deja de prohibir «¿Quién lo ve?» y «Solo yo». `:788`: la leyenda con el candado.
- [ ] `#ev-grupo-tipo` pasa a ir justo después de `#ev-error` (`mi-espacio.html:1401`). El foco inicial, en el primer botón de la barra.
- [ ] `alCambiarElCuando` pide el aviso de la cadena, con la fecha y la hora, con `ESPERA_DEL_CALCULO`, y una respuesta vieja se descarta, como `pedirAvisoDelEvento`. `#ev-tipo-ayuda` deja de ser solo texto: lo del servidor, escapado con `Utils.escapeHtml`, y los íconos, del código.
- [ ] Los jefes marcados: con `es_superior`, al elegir el Público en uno nuevo con la lista ya llegada; si llega después, se marca al llegar, si el usuario todavía no tocó ninguna persona.
- [ ] La confirmación: `guardarEvento` (`:6596`) pasa por `pedirConfirmacion` con `alConfirmar`, `textoSi: 'Guardar'`. «Guardar» se deshabilita como hasta ahora.
- [ ] El aviso con «Cambiar»: después de `avisarLaRespuesta`, sumar el botón al `.toast`, sin tocar `main.js`.
- [ ] `ICONOS_DEL_MES` suma `candado` (ocho claves), la muestra de la leyenda y `iconoDelEvento`. La casilla, en `.me-proximos-tarjeta`: se deshabilita ella misma mientras responde, y si falla vuelve a como estaba.
- [ ] Estilos en el `<style>`, sin clases `ag-` ni `ad-`, con foco visible y 4,5:1. Probar el formulario en el navegador, en la compu y a 375 px, contra la maqueta, con la API real en local.
- [ ] `VERSION_MI_ESPACIO` y su `?v=`.
- [ ] Commit: `feat(agenda): «¿Quién lo ve?», sin nada marcado, con el mail y la agenda separados`.

## Task 7: Las reglas del aviso diario

**Files:** `services/miEspacioEventosDiarioReglas.js`, `tests/mi-espacio-eventos-diario-reglas.test.js`.

Puro, sin pool ni `Date`, con hoy y el calendario por parámetro.

- [ ] Tests primero: `diasDelAviso(hoy, calendario)`, de un martes, de un viernes y antes de un feriado. `mailDeLaPersona({ persona, eventos, informados, momento, ahora, calendario, usuarios })`, que devuelve null o `{ propios, gente, informa }`:
  - Sin casilla, solo lo de su gente; sin gente, null.
  - **Un Público ajeno que no es de su gente no entra aunque esté en sus vistas.**
  - **Un Público de su gente entra aunque no esté en sus vistas**, sin título ni detalle: getters que tiran en `titulo`, `detalle`, `personas` y `vistas`.
  - Un Privado ajeno, nunca. Un Público de un creador desactivado, no. Con `publico` y `compartido` juntos (datos mal), manda el Público, como `services/miEspacioEventosDatos.js:231,265`.
  - Los Laborales: el propio, con su marca; el de otra persona, con una fila suya o «Todos»; con «Mi recordatorio» apagado, también.
  - `'manana'`: null sin un rezagado; con uno, trae todo hoy, con lo propio si tiene la casilla, y «nuevo» en lo sin informar. Un Público que ya empezó no lo dispara. `publicado_at` de hoy, tampoco; NULL, sí.
  - `'tarde'`: el grupo «Hoy» solo con lo rezagado que no empezó.
  - `informa`: todos los Públicos de su gente que trae el mail, con su fecha.
- [ ] Las marcas, con `textoDeQuienVeElPublico`, sin copiarla. El nombre corto, con `nombreCorto({ id, nombre }, activos)`: `nombreCorto` lee `.nombre` (`services/miEspacioReglas.js:3781`), y con `nombre_completo` dos Carlas saldrían iguales. Test con dos.
- [ ] Commit: `feat(agenda): qué recibe cada persona en el aviso diario`.

## Task 8: Los datos y el mail

**Files:** `services/miEspacioEventosDiarioDatos.js` (se crea), `services/emailTemplates.js`, `tests/email-diseno.test.js`, `tests/emails-fixtures.js`, `tests/mi-espacio-eventos-diario-datos.test.js` (se crea).

- [ ] **Las fechas, con `DATE_FORMAT`:** el pool no tiene `dateStrings`, y un `Date` crudo en `fecha` de informados o en `publicado_at` nunca coincide: repetiría «Nuevo» y el mail cada día. Con su test.
- [ ] Tests de datos sobre su base: en lote, sin N+1, los eventos activos del rango con sus filas de personas y vistas, y los informados de los eventos leídos; `usuariosDelAviso` (`id`, `nombre_completo`, `email`, `activo`, `depende_de`, `eventos_por_mail`); `deLicenciaOficial(hoy)`: `usuarios_licencias` con `anulada = 0`, **no** `ausentesEn`; `marcarInformados`, con `INSERT IGNORE`.
- [ ] `avisoDiarioTemplate({ persona, mail, momento, hoy })`, que devuelve `{ subject, html, text }`, con los textos de la spec, sección 8, cada parte con `parrafoDelEvento`. Tests: cada columna de su tabla, un mail de las 14:00 solo con «Hoy», un título con `<b>` escapado una sola vez, los saltos del detalle, y el `text` dice lo mismo. Los días, con `diaLargo`.
- [ ] `tests/email-diseno.test.js`: pasa por el marco único, sin emojis, y el remitente de siempre.
- [ ] Commit: `feat(agenda): los datos y el mail del aviso diario`.

## Task 9: La corrida y sus dos enganches

**Files:** `services/miEspacioEventosDiario.js` (se crea), `controllers/notificacionesController.js`, `tests/mi-espacio-eventos-diario.test.js` (se crea), `tests/feriados-en-notas.test.js` o uno nuevo para el orden.

- [ ] Tests de la corrida, con el servicio y un hoy fijo: manda y marca; repetirla no manda de nuevo; un `sendEmail` que falla deja `success = 0` y sin marcar, y la siguiente lo retoma; una reserva sin terminar no se repite; con otra corrida con el candado, «ocupada» sin escribir; día no hábil y sin feriados (`calendario.error`), sin mandar y anotada; `'tarde'` antes de las 14:00, nada; con licencia oficial, nada, y a su superior le sale igual; sin un email válido, nada, sin error; `to` siempre con una dirección.
- [ ] **Del principio al fin, con Mailpit:** el mail de un jefe no contiene el título ni el detalle de un Público de su gente; un elegido que no es de la cadena no recibe nada.
- [ ] `ejecutarAvisoDiarioDeEventos`, copiando el armado de `ejecutarRecordatoriosDeEventos` y sus reservas: `conBloqueo(…, BLOQUEO_DIARIO)`, la fila `id = 2`, `reservar`, `terminar`, `mandarUno`. Lo que se pueda reusar se exporta, no se copia. `textoDelResultadoDelDiario`, en las reglas.
- [ ] `avisoDiarioAislado(momento, calendario)` **nunca rechaza**: `ejecutarRecordatoriosDeEventos` tira si no consigue el candado (`miEspacioEventosCorrida.js:171`) y en `app.js` no hay manejador de `unhandledRejection`: en Node 22, un rechazo antes del `await` tumba el proceso. `try/catch` total, que devuelve `{ ocupada: false, dia_habil: null, enviados: 0, fallidos: 0, errores: [...] }`, y `.catch` al dispararla, como `controllers/miEspacioEventosController.js:103`. Con su test, con la base caída.
- [ ] Marcar informados solo después de un envío bueno. Si marcar falla: a los errores; el mail ya salió.
- [ ] **14:00:** `ejecutarNotificacionCambiosPendientes` (`:263`). Mantener cada respuesta de hoy:

```js
let resultados;
let fallaDeCambios = null;
try {
  resultados = await enviarCambiosPendientes({ hoy: hoyArgentina(), calendario });
} catch (error) {
  fallaDeCambios = error;
}
const diario = await avisoDiarioAislado('tarde', calendario); // nunca tira
if (fallaDeCambios) throw fallaDeCambios; // el 500 de siempre
```

  `data.diario` en las dos ramas; sus errores y sus fallidos dan 207, sin cambiar el mensaje. **`ocupada` no da 207:** no copiar `sinErroresDeFirma` (`:272`).
- [ ] **8:05:** `ejecutarNotificacionesDiarias` (`:72`), después de `leerCalendario`: `const diario = avisoDiarioAislado('manana', calendario);` sin `await`, y `resultados.diario = await diario` antes de responder, con sus errores en `resultados.errores` (`tipo: 'mi-espacio-diario'`). Nada de `anotarEnLaUltimaCorrida`.
- [ ] **Tests de aislamiento**, con `res` falso y reloj fijo: si `enviarCambiosPendientes` tira, el paso corrió y responde 500; si el paso tira, salieron los recordatorios y da 207; a las 8:05, con un `sendEmail` del paso que no resuelve, las Notas igual corren (una promesa controlada por el test).
- [ ] `tests/notificaciones.test.js:97` y `tests/permisos.test.js:467` corren los `/api/cron/*` reales y exigen 200: el paso anotaría la fila 2 y, desde las 14:00, mandaría, y un fallido los rompería solo según la hora. Toman el candado `rpad_mi_espacio_diario` en otra conexión, como `tests/permisos.test.js:485`, y así terminan «ocupada» sin escribir.
- [ ] Commit: `feat(agenda): el aviso diario sale a las 14:00 y a las 8:05, sin frenar nada`.

## Task 10: Correos → Estado

**Files:** `services/miEspacioEventosDiario.js`, `controllers/notasDigitalesController.js`, `public/correos.html`, `public/js/correos.js`, `tests/correos-frontend.test.js`, `tests/paginas.test.js`.

- [ ] Tests: `estadoDelAvisoDiario` con la fila 2, sin registro, en curso y con errores; una lectura que falla no rompe el Estado (como `eventos-sin-estado`); la línea `#nd-diario`, oculta sin dato; la alerta `diario-con-errores`.
- [ ] `verEstado` suma `diario`, sin leer dos veces el calendario.
- [ ] `VERSION_CORREOS` y su `?v=`.
- [ ] Commit: `feat(correos): la línea del aviso diario en el Estado`.

## Task 11: Los documentos

**Files:** `docs/temas/mi-espacio-aviso-diario.md` (se crea), `docs/temas/mi-espacio-agenda.md`, `docs/temas/mi-espacio-evento-publico.md`, `docs/temas/mi-espacio.md`, `docs/temas/calendario-y-corridas.md`, `docs/temas/configuracion.md`, `CLAUDE.md`, `.claude/rules/mi-espacio.md`, `.claude/rules/calendario-y-corridas.md`, `.claude/rules/emails.md`.

- [ ] El tema nuevo, en el mapa de `CLAUDE.md`, y en la tabla de `.claude/rules/mi-espacio.md` (ruta protegida: pide permiso).
- [ ] Se escribe lo vigente. Lo que quedó escrito y cambió: «De entrada, Personal (Privado)», «No les llega ningún email», «Comparten… solo administración», «Toda la administración», «ni un jefe» (`mi-espacio.md:32`), «Los cuatro llegan aunque…» (el quinto, no), y en `CLAUDE.md`, «Solo administración comparte eventos Laborales» y `:232`.
- [ ] Las decisiones con su motivo, si alguien podría «arreglarlas»: `usuarios_licencias` y no `ausentesEn`; el paso de las 8:05 sin esperar; por qué lo cargado en el día no se avisa; que un jefe no ve el título aunque esté marcado.
- [ ] `tests/documentos.test.js`: topes de 600 por renglón y 60 KB. `mi-espacio-agenda.md` y `base-de-datos.md`, atentos.
- [ ] Commit: `docs: el aviso diario de la agenda y de quién depende cada uno`.

## Task 12: La simulación, la revisión y el cierre

- [ ] **Simulación**, con una copia nueva del dump (`rpad_sim_agenda_aviso`), en Mailpit, sin envíos reales y sin leer eventos reales. Con usuarios reales de la copia en la cadena y **eventos inventados**, llamando a los servicios con `ahora` fijo: jueves 14:00, viernes 8:05, viernes 14:00, un fin de semana y un feriado en el medio. Comprobar los cinco ejemplos de la spec, sección 4, y que las notas y los recordatorios de esa copia salen igual. Informe en `~/rpad-notas/`, fuera del repo.
- [ ] `npm test` completo, en verde.
- [ ] **Revisión final de la rama**, con un Opus sin contexto, contra la spec: privacidad primero.
- [ ] Traer main; si cambió algo con código, otra vez la suite.
- [ ] `database/privado/depende-de.sql`, que no se versiona, con los usernames de la tabla local y la cadena que dijo el usuario, verificación final con un `SELECT`, y su vuelta atrás. El usuario lo revisa.
- [ ] Merge y push a main si todo da bien (regla de la sesión coordinadora). Kit `~/rpad-kits/RPAD-deploy-mi-espacio-eventos-diario`, contra el último commit de main con código, con su `PASOS.txt`: comprobación previa de `correos.js?v=20261214`, migración, SQL privado, archivos y Restart. Con el interruptor de la firma prendido, no entre las 8:05 y las 14:00. Sin Tarea Cron nueva.
- [ ] Reporte a la coordinadora: `TODO EN VERDE`, o `FRENADO` con el motivo.

---

## Lo que el executor tiene que mirar con cuidado

1. **`nombresContra`:** pasar a `usuarios` cambia algún nombre corto que hoy sale contra la administración: si otro usuario de otro rol se llama igual, ahora lleva inicial. Es lo que corresponde, y hay tests que lo fijan con nombres de administración.
2. **Los tests que cambian de mensaje:** `Evento guardado.` y `Evento cambiado.` tienen `deepEqual` en `tests/mi-espacio-eventos-api.test.js`. Mirar que no se pierda lo que controlaban.
3. **`mi-espacio.js` se carga en un `vm`:** nada de código al cargar que toque el DOM (`CLAUDE.md`, Frontend).
4. **`#ev-tipo-ayuda` en `aria-describedby`:** lo que está oculto se lee igual; que el grupo no anuncie una frase vieja.
5. **Un evento nuevo con `tipo: ''`:** `valoresConElTipo`, `tipoDelEvento`, la vista previa y `pedirLasPersonas` lo reciben sin tipo por primera vez.
6. **El orden de la migración:** se corre antes de subir el código, con los «para todos» convertidos; el código viejo los lee como elegidas, sin diferencia para nadie.
