# El calendario y las corridas

El calendario único de días hábiles y los tres crons: 8:05, 14:00 y cada media hora.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-27-feriados-en-notas-design.md`
- `docs/superpowers/specs/2026-10-26-mi-espacio-agenda-design.md`
- `docs/superpowers/specs/2026-11-04-agenda-aviso-y-dependencia-design.md`
- `docs/superpowers/specs/2026-11-12-dato-quincena-correo-design.md`

## Archivos

notificacionesController: también la corrida de los recordatorios de la agenda, `GET /api/cron/eventos`, y el aviso diario de la agenda, en las corridas de las 8:05 y de las 14:00 (`docs/temas/mi-espacio-aviso-diario.md`), y el correo del dato de la quincena, en las mismas dos (`docs/temas/dato-quincena-correo.md`).
notasDigitalesCalendario (el calendario de días hábiles, puro:
`esDiaHabil` y `FERIADOS_FIJOS`, los 9 fijos;
`derivadasDe`, las derivadas escritas una sola vez sobre un predicado, con el tope `TOPE_DE_VUELTAS`, 366, y `CALENDARIO_FIJO`, las de los 9 fijos;
`tests/calendario-unico.test.js` falla si otro archivo de `services/` o `controllers/` importa de acá `esDiaHabil` o una derivada fija, salvo los dos que arman los calendarios, este y `feriadosReglas`: no hay otras excepciones).
avisosDiariosService (los avisos por email que no son Notas Digitales: a las áreas, 40 días antes, y los de los cambios pendientes) y avisosSuperadminService (los avisos al superadmin, retenidos durante su licencia).
emailService y emailTemplates: `sendEmail`, `remitente` y `marcoEmail`; cada plantilla, en el documento de su tema.

## Recordatorios automáticos

- Salen solo en días hábiles, con un solo calendario (spec 2026-10-27-feriados-en-notas, tanda 1): de lunes a viernes, sin los 9 feriados nacionales fijos ni los de la tabla `feriados` (Configuración → Feriados).
  Hoy = `hoyArgentina()`, nunca `CURDATE()`, en todo lo que se avisa (`controllers/gestionController.js` lo usa para las ventanas de meses de las métricas manuales, que no avisan nada).
  La invitación, el cambio y la cancelación de un evento de la agenda no son automáticos: salen en el momento en que alguien lo guarda, también en un día que no es hábil (ver `docs/temas/mi-espacio-agenda.md`).
- El calendario (spec 2026-10-27-feriados-en-notas, 1):
  `{ esDiaHabil, proximoDiaHabil, diaHabilAnterior, ultimoDiaHabilHasta, primerDiaHabilDelMes, rangoDeAviso, diasHabilesTranscurridos, sumarDiasHabiles, origen: 'tabla' | 'fijos', error: string | null }`, congelado.
  Las derivadas se escriben una sola vez sobre un predicado (`derivadasDe(esHabil)`, `services/notasDigitalesCalendario.js`).
  `CALENDARIO_FIJO` es el de los 9 fijos (sobre `esDiaHabil`): los nombres que exporta el archivo (`proximoDiaHabil`, `rangoDeAviso`, …) son los suyos, y `tests/notas-calendario.test.js` exige que den lo mismo que una copia congelada, `tests/fixtures/calendario-fijo-de-antes.js`, también con entradas que no son fechas.
  `calendarioCon(filas)` (`services/feriadosReglas.js`, que importa el calendario: no hay ciclo) arma el mismo objeto con un predicado que además saca los feriados de la tabla (los de cada año se calculan con `feriadosDelRango` la primera vez que se piden y se guardan; no llama a `esFechaIso`); sin filas, da lo mismo que `CALENDARIO_FIJO`.
  `leerCalendario(conexion = pool)` (`services/feriadosDatos.js`) lo arma con `filasDeFeriados` y **nunca tira**: si la tabla no se puede leer, lo anota en la consola y devuelve el de los 9 fijos con `origen: 'fijos'` y el motivo en `error`.
  La caída se detecta siempre por `calendario.error !== null`, nunca por `origen` (un test puede pasar `CALENDARIO_FIJO` sin que sea un error).
- Una sola lectura de la tabla por corrida o por pedido: el punto de entrada (las dos corridas, Correos → Estado, la vista previa, la prueba y cada pedido de Configuración → Licencias, de Métricas en vivo, del Ciclo de vida del dato y de la Agenda de pedidos;
  un año con foto no la lee, ni en Métricas, ni en el Ciclo de vida, ni en el Informe anual, cuyas cifras salen de las fotos y cuyos logros son los hitos en vivo, que no dependen del calendario) lee el calendario y lo pasa a todo lo que llama, dentro de lo que ya viaja (`contextoDeCanal` y `contextoDelDia` lo devuelven en el contexto;
  las opciones de `personasPorDia`, `periodosSinAuditor`, `disponibilidadDelAutorizado`, `autorizadoParaLicencia`, `avisoDelDia`, `enviarAvisoAreas`, `enviarCambiosPendientes`, `enviarResumenAvisosRetenidos`, `ejecutarNotasDigitales` y `estadoNotas` llevan la clave) o como último parámetro (`fechaDelProximoAviso(hoy, calendario)`, `primerDiaConNotas(config, desde, calendario)`;
  en las opciones de `casosDe`, `vistaDe`, `etapasDe`, `agendaDe` y `datosDeLaFoto` y como último parámetro de `duracion` y `fechaDeAvisoPorRegla`; la corrida de la mañana le pasa a la foto el que ya leyó).
  Las reglas puras usan `CALENDARIO_FIJO` si no lo reciben; las exportadas que leen la base, `calendario ?? await leerCalendario(conexion)`; las internas de `notasDigitales.js` y de `avisosDiariosService.js`, y las de Métricas (`diaDelAvisoDe` y `casosDelDataset`), no tienen valor por defecto (un olvido tira;
  `contextoDelDia` lo exige con un `TypeError`); la de la Agenda (`filaDe`) tampoco, pero se lo pasa a `fechaDeAvisoPorRegla`, así que un olvido no tira: cae a los 9 fijos.
  Mi espacio arma el suyo con las filas que ya leyó (`calendarioCon`).
  Los tests lo cuentan con la tabla renombrada: una sola línea de `leerCalendario` en la consola por corrida o por pedido.
- Quién cuenta con qué: las corridas de la mañana y de las 14:00, Correos → Estado, la vista previa y la prueba, Configuración → Licencias (también lo que pasa desde Mi espacio) y Mi espacio cuentan con los 9 fijos y la tabla, lo mismo que muestra la pestaña Feriados, y también todo el sistema (spec, sección 5): Métricas, el Ciclo de vida del dato, la foto del 31/12 y la Agenda de pedidos (las cifras del Informe anual salen de las fotos).
  La Agenda de pedidos dice el día en que sale el aviso (el 24/11/2026 del externo del 31/12, no el 23/11, que es feriado) y la cobertura de Métricas lo espera ese mismo día, con el mismo calendario.
  El email de vencimiento de Mi espacio (en la misma corrida de la mañana) y los recordatorios de la agenda leen la tabla por su cuenta (`esDiaHabilCon` y sus cuentas de `feriadosReglas`): si no la pueden leer, no mandan nada (es la excepción a «una lectura por corrida» que acepta la spec).
  Correos → Estado la lee también para la alerta `eventos-sin-corrida` de la agenda (`estadoDeLosRecordatorios`, con los feriados de hoy en cada pedido: un feriado cargado hoy la saca).
- El tope (`TOPE_DE_VUELTAS` = 366, uno solo, el del calendario;
  `feriadosReglas.js` lo importa): cada búsqueda de un día hábil (`proximoDiaHabil` mira la fecha y los 365 días siguientes;
  `diaHabilAnterior`, los 366 anteriores;
  `primerDiaHabilDelMes`, `rangoDeAviso`, `ultimoDiaHabilHasta` y `sumarDiasHabiles` las usan) tira `RangeError` con «366» en el mensaje si no encuentra ninguno (con la tabla, un año entero cargado como feriado daría un bucle infinito), y `diasHabilesTranscurridos` tira donde el recorrido no terminaría (después del `'9999-12-31'`).
  Con los 9 fijos nunca pasa, salvo ahí.
  Son dos convenciones, a propósito: las `…Con` de `feriadosReglas.js` que usa Mi espacio (`proximoDiaHabilCon`, `restarDiasHabilesCon`, `ultimoDiaHabilDelMesCon`) devuelven null; las del calendario tiran (`visperaDeLaLicencia` y `limiteParaCambiarTipo` atrapan solo ese `RangeError`; un calendario null o mal armado tira).
- El test estático, `tests/calendario-unico.test.js`: lee como texto los `import` y `export … from` de `notasDigitalesCalendario.js` de cada archivo de `services/` y `controllers/` (también de varias líneas, con alias, `import * as` e `import()`) y falla con el archivo y la función si alguno trae `esDiaHabil` o una derivada fija, salvo los que arman los calendarios (`SIEMPRE`:
  el calendario mismo y `feriadosReglas.js`), las únicas excepciones (`metricasReglas.js` y `reportesAgenda.js` reciben el calendario); también falla si una excepción no existe.
- Si la tabla no se puede leer (spec, sección 2; casi imposible sin que falle toda la base): las corridas siguen con los 9 fijos y lo anotan con `MENSAJE_CORRIDA_SIN_FERIADOS` («No se pudieron leer los feriados de Configuración → Feriados: la corrida usó solo los 9 fijos.»).
  En la corrida de la mañana, entre los errores de las Notas Digitales (`{ tipo: 'feriados' }`, que el controlador pasa como `{ tipo: 'notas-digitales', paso: 'feriados' }`), anotado antes de mirar si el envío está activo (queda también con el envío apagado o un día no hábil) y escrito por `registrarFin` en la última corrida: la corrida queda con errores (la alerta `corrida-con-errores`) y responde 207; si termina «ocupada», el error queda solo en la respuesta y en la consola.
  A las 14:00, que no tiene registro propio, en la última corrida de las Notas (`anotarEnLaUltimaCorrida`, en rojo hasta la corrida del día siguiente), y responde 207 con `success: false`, también un día que no es hábil (el mensaje no cambia).
  Correos → Estado suma primero la alerta `feriados-sin-leer`, de nivel `error`, con `MENSAJE_ESTADO_SIN_FERIADOS` («No se pudieron leer los feriados de Configuración → Feriados: las fechas de esta pantalla cuentan solo los 9 feriados fijos.»).
  Configuración → Licencias (y `GET /mi-espacio/firmante`) sigue con los 9 fijos y lo anota en la consola, y la vista previa y la prueba del email de los 40 días, también (solo la consola); el resto de Mi espacio da 500 (su `contextoDe` lee los feriados).
  Métricas y la foto no siguen con los 9 fijos (`exigirLaTabla`):
  Métricas (también su PDF), el Ciclo de vida del dato y «Datos para completar» de un año que va en vivo, y la Agenda de pedidos, responden 500, con su mensaje fijo, y la foto del 31/12, si ese día toca sacarla, no se saca: la corrida de la mañana lo anota en la última corrida («No se pudo sacar la foto del año:
  no se pudieron leer los feriados de Configuración → Feriados», con `MENSAJE_METRICAS_SIN_FERIADOS`), junto con el error de la caída (`MENSAJE_CORRIDA_SIN_FERIADOS`), y la del día siguiente la vuelve a intentar.
  Con un calendario que cayó a los 9 fijos, `sacarFotoSiCorresponde` tira sin guardar nada; si no toca sacar una, no lo mira.
  Un año con foto y el Informe anual siguen andando: no leen la tabla.
- `tests/feriados-en-notas.test.js` (base `rpad_test_feriados_en_notas`) y `tests/feriados-en-metricas.test.js` (base `rpad_test_feriados_en_metricas`) van con Docker: cargan `database/updates/migracion-feriados-datos.sql` tal cual con `correrSqlEnBaseDePrueba` de `tests/helpers.js`, ningún test escribe en `feriados` y llaman al servicio y al controlador de la corrida con un hoy fijo, nunca a `/api/cron/*`.
  `tests/notificaciones.test.js` decide qué tests corren con `leerCalendario` sobre la base del `.env` (si no la puede leer, tira).
  Los textos de pantalla y de los PDF que dependen del calendario los miran `tests/correos-frontend.test.js`, `tests/usuarios-frontend.test.js`, `tests/mi-espacio-frontend.test.js`, `tests/reportes-frontend.test.js`, `tests/reportes-pdf.test.js` y `tests/paginas.test.js`.
- Cron de la mañana, a las 8:05 (`/api/cron/notificaciones`; «la corrida de la mañana» es esta): lee el calendario una vez, al principio (`leerCalendario`), y el mismo objeto va al aviso a las áreas (`services/avisosDiariosService.js`, `enviarAvisoAreas`: el «hoy es hábil» y el rango de vencimientos que avisa, `rangoDeAviso`, salen del mismo calendario, así, entre corridas seguidas, no se pierde ni se repite un vencimiento;
  el email de los 40 días no deduplica: un segundo pase el mismo día lo repite, un envío fallido no se reintenta y una corrida salteada pierde su rango), al resumen de avisos retenidos al superadmin (`enviarResumenAvisosRetenidos`: en un feriado de la tabla no sale;
  sale el próximo día hábil), a las Notas Digitales (`services/notasDigitales.js`, `ejecutarNotasDigitales({ hoy, usuarioId, calendario })`:
  la puerta del día, el `cuenta_desde` de los avisos anticipados, la víspera, los días libres de la persona autorizada, el aviso en su fecha, la reiteración y la nota de auditoría), con la nota de auditoría al final, y a `resultados.dia_habil` (`resultados.calendario` y el `calendario` del resumen de las Notas Digitales, `resumen.calendario`, dicen de dónde salió: 'tabla' o 'fijos';
  la vista previa y la prueba del email de los 40 días usan el próximo día hábil con el calendario, `fechaDelProximoAviso(hoy, calendario)`); después, aislada y sea o no día hábil, la foto del año anterior desde el 10/01 (`sacarFotoSiCorresponde({ hoy, calendario })`, `services/metricasFoto.js`: ver `docs/temas/metricas-y-reportes.md`; con el mismo calendario de la corrida, sin volver a leer la tabla, y si cayó a los 9 fijos no la saca;
  un error queda en `resultados.errores` como `foto-del-anio` y en la última corrida de Correos → Estado, «No se pudo sacar la foto del año: …», y la corrida del día siguiente la vuelve a intentar).
  La Tarea Cron de cPanel corre todos los días (día de la semana `*`): la foto del 10/01 sale ese día aunque sea domingo.
  Al final, otro paso aislado, de Mi espacio: el email de vencimiento —también el de los días para restituir— (`enviarAvisosDeVencimiento({ hoy })`, `services/miEspacioAvisos.js`; ver `docs/temas/mi-espacio-paso-y-avisos.md` y `docs/temas/mi-espacio-restituidos.md`), después de las Notas Digitales (`registrarInicio` borra lo anotado en la última corrida) y de la foto, con su propio try/catch y su `resultados.miEspacio` (`{ dia_habil, enviados, errores }`).
  Sale solo en días hábiles con su propio control (`esDiaHabilCon` con los feriados de la tabla, que lee por su cuenta en la misma corrida; un día no hábil no lee más que los feriados): si no los puede leer, no manda nada, aunque la corrida haya seguido con los 9 fijos.
  Un email que no salió, uno que salió y no se pudo anotar y una persona cuyo email no se pudo preparar (cada persona va aislada: no frena a las demás) van a `resultados.errores` como `{ tipo: 'mi-espacio', usuario_id, error, motivo }` y a la última corrida de Correos → Estado («No se pudieron enviar los avisos de Mi espacio: <motivos>», solo los motivos fijos —«el email no se pudo enviar», «el email salió, pero no se pudo anotar» y «no se pudo preparar el email»—, sin nombres;
  el texto de nodemailer, que puede traer la dirección, queda solo en `error`).
  Dos corridas a la vez no mandan dos veces: un día hábil, el paso toma `GET_LOCK('rpad_mi_espacio_avisos', 0)` y lo libera en un `finally` con la misma conexión (si lo tiene otra, no manda nada y suma `motivo: 'Otra corrida en curso'`); un error antes de mandar (también si falta una tabla) va igual, con `tipo: 'mi-espacio'`, no sale ningún email y no frena la respuesta.
- Cron 14:00 (`/api/cron/cambios-pendientes`): primero, aisladas, las notas que esperaban la firma digital (ver `docs/temas/firma-digital.md`); después, el recordatorio de cambios pendientes (`enviarCambiosPendientes({ hoy, ahora, calendario })`) a quienes pueden auditarlos.
  Lee el calendario una vez (`leerCalendario`) y el mismo cuenta el «hoy es hábil», el canal de cada cambio (`contextoDeCanal` lo lleva a `canalDelCambio`: el mismo calendario que la nota de auditoría de la corrida de la mañana, así un cambio no se queda un día sin recordatorio y sin nota, salvo que falle la nota de autorización tardía: `correrPasos` corta ahí y `hayQuienFirme` no lo ve), el aviso a quien propone y su «hasta» (`proximoDiaConQuienAudite`);
  `data.calendario` dice de dónde salió, también un día no hábil.
- El aviso diario de la agenda viaja en las dos corridas, sin Tarea Cron propia y sin frenarlas ni al revés (`docs/temas/mi-espacio-aviso-diario.md`).
  A las 8:05, `avisoDiarioAislado('manana', calendario)` se dispara antes de los demás pasos, sin esperarlo, y se espera al final: la mañana tarda minutos y tiene que salir antes de los eventos de la primera hora.
  A las 14:00 corre después de los recordatorios y también si `enviarCambiosPendientes` tira: ese 500 se responde después del paso.
  Sus errores van a `resultados.errores`, con `tipo: 'mi-espacio-diario'`, a las 8:05, y a `data.diario`, a las 14:00; `ocupada` no da 207.
- El correo del dato de la quincena también viaja en las dos corridas, sin Tarea Cron propia y sin frenarlas (`docs/temas/dato-quincena-correo.md`).
  A las 8:05 va al final, después del vencimiento de Mi espacio y antes de esperar el aviso diario (para darle unos segundos más al bot), y sus errores van a `resultados.errores` con `tipo: 'dato-quincena'`.
  A las 14:00 corre después del aviso diario y también si `enviarCambiosPendientes` tira, y sus errores van a `data.dato_quincena.errores` y dan 207; `ocupada` no es un error.
  Tiene su propio candado, `GET_LOCK('rpad_dato_quincena_correo', 0)` (`BLOQUEO_DATO_QUINCENA`, por `conBloqueo` con ese nombre), y su propio registro de la última corrida, que lee Correos → Estado.
  `tests/notificaciones.test.js` y `tests/permisos.test.js`, que llaman a la corrida de las 14:00 sobre la base del `.env`, toman este candado además del del aviso diario.
  Las rutas manuales de administración (`/api/notificaciones/ejecutar` y `/api/notificaciones/cambios-pendientes`) corren también el paso.
- Cron cada media hora (`GET /api/cron/eventos`, con `cronAuth`: sin la clave, o con una que no es, 403; spec 2026-10-26-mi-espacio-agenda, 5): los recordatorios de la agenda (`ejecutarRecordatoriosDeEventos` de `controllers/notificacionesController.js`, que llama al servicio del mismo nombre de `services/miEspacioEventosCorrida.js`; qué manda, en `docs/temas/mi-espacio-agenda.md`).
  Una Tarea Cron de cPanel propia, `*/30` todos los días (decisión del usuario:
  «1 hora antes» con una corrida por hora podía avisar con muy poco margen).
  Solo manda en días hábiles, con su propio control (`esDiaHabilCon` con los feriados de la tabla, leídos en cada corrida), y se anota también un día que no es hábil.
  Responde con `data` (`{ ocupada, dia_habil, enviados, fallidos, errores }`): 200 «Otra corrida de los recordatorios está en curso.», «Hoy no es día hábil: no se mandan recordatorios.» o «Recordatorios enviados:
  N.»; 207 (`success: false`) con fallidos o errores; y 500 «Error en los recordatorios de la agenda», sin `data`, si ni siquiera pudo pedir el candado (la base no responde).
  **Su propio candado:** `conBloqueo` de `services/notasDigitales.js`, exportado y con el nombre como parámetro (`conBloqueo(fn, nombre = BLOQUEO)`: sin nombre, es el de las Notas Digitales, y si no se puede liberar, el aviso de la consola dice «de Notas Digitales»;
  con otro, dice ese nombre), con `BLOQUEO_EVENTOS` (`'rpad_mi_espacio_eventos'`), nunca el de las Notas: una de estas corridas puede coincidir con la de la mañana, que tarda unos minutos, y si tomara su candado las Notas de ese día no saldrían.
  Con el candado tomado por otra, termina «ocupada», que no es un error, sin escribir nada.
  Cada corrida que lo toma se anota en `mi_espacio_eventos_corridas` (el inicio, y después el fin, el resultado y `con_errores`), y Correos → Estado (`verEstado` de `controllers/notasDigitalesController.js`, que lee el calendario una vez para `estadoNotas`) suma `eventos: { texto, corrida }` y sus alertas al final de las demás (`estadoDeLosRecordatorios`, con `textoDeLaCorridaDeEventos` y `alertasDeLaCorridaDeEventos`): la línea «Recordatorios de la agenda: última corrida hoy a las 10:30.
  Recordatorios enviados: 2.» («… corrida en curso, desde hoy a las 10:30.», «… sin registro todavía.»; en curso es sin fin y con el candado tomado, `IS_FREE_LOCK`) y tres alertas `error`:
  `eventos-con-errores` (cualquier día), `eventos-interrumpida` (sin fin y sin el candado tomado, cualquier día) y **`eventos-sin-corrida`, solo en un día hábil, si no hay ninguna corrida o si la última empezó hace más de una hora** (`MINUTOS_SIN_CORRER` = 60; 60 justos, todavía no): es la manera de notar que la Tarea Cron no quedó configurada (con la tabla recién creada, hasta la primera corrida, la marca del Estado se ve roja).
  **También sale si una corrida quedó «en curso» más de una hora** (las que siguen terminan «ocupadas» y no anotan nada): entonces hay que mirar el servidor —un proceso colgado que tiene el candado—, no solo la Tarea Cron de cPanel.
  Si no se puede leer la corrida, `eventos` es null y va la advertencia `eventos-sin-estado` («No se pudo leer la última corrida de los recordatorios de la agenda.»); el resto del Estado responde igual.

## Archivos de tests

`calendario-unico.test.js`, `notas-calendario.test.js`, `feriados-reglas.test.js`, `licencias-reglas.test.js`, `auditoria-reglas.test.js`, `mi-espacio-reglas.test.js`, `notas-licencias.test.js`, `mi-espacio-api.test.js`, `notas-motor.test.js`, `feriados-en-notas.test.js`, `notificaciones.test.js`, `metricas-reglas.test.js`, `reportes-agenda.test.js`, `metricas-foto.test.js`, `feriados-en-metricas.test.js`
