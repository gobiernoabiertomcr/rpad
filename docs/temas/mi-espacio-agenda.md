# Mi espacio: la agenda

Los eventos personales y laborales, quién ve qué, los cuatro emails y la corrida de los recordatorios.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-26-mi-espacio-agenda-design.md`

## Archivos

miEspacioEventosController: la agenda de Mi espacio, con los eventos —los compañeros de cada día, la frase del mes, los tres tipos (Personal (Privado), Personal (Público) y Laboral) y a quién se le muestra un Público, sus vistas—, cuándo sale un aviso, las personas para compartir —también la segunda lista, la de un Público: todos los usuarios activos, `GET /mi-espacio/personas/publico`— y «mi recordatorio»;
miEspacioEventosReglas (la agenda: la validación de un evento —con los tres tipos, el texto público y las personas de cada tipo, `personasDelPedido`—, el momento del aviso con los feriados y sus textos, qué recordatorios tocan en una corrida, quién recibe qué email al guardar, cada evento como lo ve quien lo pide —también el Público de otra persona, recortado, y a quiénes se lo mostrás, `textoDeQuienVeElPublico`—, lo demás de la agenda, los compañeros de cada día y la frase del mes,
y la línea y las alertas de Correos → Estado, puro), miEspacioEventosDatos (las consultas de los eventos con quién ve cada uno —también los Públicos de otras personas, recortados y sin su título en el orden, sus vistas, `vistasDe`, y todos los usuarios activos de la segunda lista de personas, `personasParaElPublico`—, y los de la corrida en lote, solo lectura), miEspacioEventosEmails (la invitación, el cambio y la cancelación, después de responder el guardado)
y miEspacioEventosCorrida (la corrida de los recordatorios, con su propio candado, y su estado para Correos → Estado)

## Mi espacio: la agenda (spec 2026-10-26-mi-espacio-agenda)

- Qué es: la cuarta pestaña de Mi espacio (`#agenda`; el código, en «La página», más abajo), con eventos de tres tipos, cada uno con un recordatorio por email:
  Personal (Privado), Personal (Público) y Laboral (ver `docs/temas/mi-espacio-evento-publico.md`).
  Arriba va la banda celeste del Resumen con su ola: el mes en grande con «‹» y «›» a su derecha, «Sábado y domingo», «Hoy» y «Nuevo evento», y la frase del mes (ver `docs/temas/mi-espacio-agenda-mes.md`).
  Debajo, el mes (de lunes a viernes de entrada, o de lunes a domingo; tus licencias y los compañeros que no están en barras continuas, y los feriados y los eventos en renglones que se adaptan, con «y N más»; los fines de semana, los feriados, los días que ya pasaron y los de los meses vecinos con otro fondo, y hoy en celeste) con su leyenda, y al costado «Próximos» (los 30 días desde hoy, `DIAS_DE_PROXIMOS`, en Hoy, Mañana, Esta semana y Más adelante);
  en 980 px, una columna con el mes primero, y en el teléfono (640 px), el mes más bajo, con las barras como líneas finas y lo de cada día como puntos de color, el día elegido debajo de la grilla y «Próximos» después.
  Los colores: lo que es solo tuyo en tinta; lo compartido (también lo que creaste y compartiste), y lo de otra persona, en violeta (un Público tuyo va en tinta con el ojo y uno de otra persona, en rosado); tus licencias y francos de Mi espacio en verde, con el tipo (son tuyos:
  «Franquicia, 2 h»); los feriados en amarillo; y los compañeros que no están en la «pizarra», gris oscura con letra blanca («Carla no está», con el nombre corto y sin el tipo, como «Hoy no están»).
  «Hoy y mañana» del Resumen trae los eventos de hoy y de mañana (en sus columnas Hoy y Mañana y sin los de hoy que ya terminaron).
  No hay eventos que se repiten ni de todo el día, exportación, vista de semana o de día, confirmación de asistencia ni aviso de 15 minutos.
  Antiobjetivos: que un evento personal lo vea otra persona (salvo un Público: que vea de él algo más que «Carla:
  Turno médico» y cuándo es), que un recordatorio salga dos veces o tarde y sin aviso, que un email automático salga en un día que no es hábil y que el tipo de una licencia aparezca en la agenda de otro.
- El nombre: en el código, la agenda es `evento` o `mi_espacio_` (las tablas, los archivos, las funciones y las constantes:
  `cargarEventos`, `mostrarMesDeEventos`, `ejecutarRecordatoriosDeEventos`, `BLOQUEO_EVENTOS`…), **nunca «agenda» a secas**, para no confundirla con la Agenda de pedidos de Reportes (`services/reportesAgenda.js`, con sus `MESES_DE_LA_AGENDA` y `GESTIONES_DE_LA_AGENDA`), que es otra cosa.
  La palabra queda solo en el nombre de la pestaña (`'agenda'` en `PESTANAS`, `#tab-agenda`, `#vista-agenda`, el fragmento `#agenda`, `data-pestana="agenda"` y los ids `ag-*`) y en los textos visibles («Recordatorios de la agenda», «Ver la agenda»).
- El evento (sección 1;
  `validarEvento(entrada, hoy)` → `{ datos, error }` de `services/miEspacioEventosReglas.js`, puro, con `MENSAJES_EVENTO`; ninguna función tira):
  «Qué», obligatorio, hasta 150 caracteres (`LARGO_TITULO_EVENTO`, contados con `Array.from`); la fecha, del 01/01/2025 (`FECHA_MINIMA_EVENTO`) al mismo día dos años después de hoy (`fechaMaximaEvento`: un 29/02 da el 28/02), cualquier día, también uno que no es hábil;
  «De», obligatoria, y «A», opcional, después de «De» y el mismo día; el detalle, opcional, hasta 1000 (`LARGO_DETALLE_EVENTO`);
  «Tipo de evento» (Privado; Público, con su texto público y con personas o «Todos»; o Laboral, con personas o «Toda la administración»: ver `docs/temas/mi-espacio-evento-publico.md`); y el recordatorio (`RECORDATORIOS`, en el orden del formulario: '1h', '2h' —de entrada, `RECORDATORIO_POR_DEFECTO`—, 'dia_anterior' —a la misma hora— y 'ninguno', con sus textos en `TEXTO_RECORDATORIO` y `AVISO_CORTO`).
  El primer error, en el orden título, fecha, desde, hasta, detalle, tipo, texto público (solo en un Público), personas y recordatorio; las personas tienen dos mensajes, los dos en `personas` (sin ninguna, «Elegí con quién lo compartís, o «Todos».» en un Público y, en un Laboral, «… o «Toda la administración».»; un id que no sirve o que no está en la lista, «Solo podés compartirlo con las personas de la lista.»), y con «Todos» las personas que lleguen se descartan.
  Las horas son hora argentina, DATE + TIME sin pasar a UTC, y se leen con `TIME_FORMAT(…, '%H:%i')` (un TIME crudo, '10:00:00', deja el aviso en null sin error).
- Quién ve y quién cambia (sección 2; es lo del Laboral; un Público, en `docs/temas/mi-espacio-evento-publico.md`): lo ve quien lo creó, las personas elegidas y, si es para todos, la administración activa (con el rol de la base en cada pedido).
  **Lo cambia y lo borra solo quien lo creó** (baja lógica con `activo`; decisión del usuario): a cualquier otra persona, el mismo 404 «Evento no encontrado» que a un id que no existe (no se revela que existe).
  Una invitada solo apaga o prende su recordatorio («Mi recordatorio»; el evento no cambia).
  Comparten, aparecen en la lista para invitar y ven los «para todos» solo administración: superadmin, admin y editor (`ROLES_QUE_COMPARTEN`, atada a `esAdmin` por un test, la regla de «los compañeros»; respuesta del usuario); el lector y el colaborador tienen solo eventos personales, Privados y Públicos (el formulario no les ofrece Laboral; por la API, 400 `sinPermiso` en `compartido`, también a quien lo creó y dejó de ser administración).
  **«Todos»** (`para_todos`) es una marca, no una lista: quien se suma después a la administración también lo ve y le llegan el cambio, la cancelación y el recordatorio (la invitación sale solo al guardar); sus filas en `mi_espacio_evento_personas` son solo las de quienes apagaron su recordatorio (la API no dice quién).
  Se comparte con la administración activa o con quien ya estaba elegido: una invitada que dejó de ser administración o se desactivó sigue en el evento (quien lo creó guarda sin tocarla y no recibe un 400), la desactivada no recibe emails y nadie la suma de nuevo.
  Si se desactiva a quien lo creó, el evento sigue para los invitados, que no lo pueden cambiar.
- Cuándo sale el recordatorio (`momentoDelAviso(evento, feriados)`): la hora del evento menos 1 o 2 horas, o la misma hora del día hábil anterior; si eso cae en un día que no es hábil (`esDiaHabilCon` con los feriados de la tabla), el día hábil anterior a esa misma hora («El día hábil anterior» de un lunes a las 10:00 es el viernes a las 10:00, o el jueves si el viernes es feriado;
  «1 hora antes» de un lunes a las 00:30, el viernes a las 23:30).
  **Nunca se guarda:** se calcula en cada pedido y en cada corrida con los feriados de ese momento, así un feriado cargado después lo mueve.
  El formulario dice cuándo sale con lo que calcula el servidor (`textoDelAviso`:
  «2 horas antes (hoy a las 08:00)», «El día hábil anterior (el viernes 30/10 a las 10:00)», «2 horas antes (ya pasó esa hora: sale con el próximo envío, si es antes del evento)», «2 horas antes (el evento ya empezó)»).
- Los emails (sección 4; en `services/emailTemplates.js`, `eventoInvitacionTemplate`, `eventoCambioTemplate`, `eventoCancelacionTemplate` y `eventoRecordatorioTemplate`, con `plantillaSimple` en el marco `marcoEmail`, el botón «Ver en Mi espacio» → `mi-espacio.html#agenda` y el detalle en su párrafo, escapado y con los saltos como `<br>`; los cuándo salen de las reglas, sin copiarlos): la **invitación** («RPAD: te sumaron a un evento»), en el alta y a quien entra en un cambio;
  el **cambio** («RPAD: cambió un evento», con el valor anterior en un `<s>` justo debajo de lo nuevo y, después, el detalle), a los que siguen, solo si cambió el título, la fecha o una de las horas (`cambioQueAvisa`: el detalle, el recordatorio o las personas no lo mandan); la **cancelación** («RPAD: se canceló un evento»), a todos, al borrarlo; y el **recordatorio** («RPAD:
  Reunión de equipo, hoy a las 10:00», contado desde el día real del envío), a quien lo creó y a cada invitado que no lo apagó (de un evento personal, Privado o Público, sale solo el recordatorio, y solo a quien lo creó: a los que ven un Público no les llega nada).
  Quien lo creó no recibe los tres primeros, y de un evento que ya empezó no sale ninguno de ellos (`emailsDelGuardado`).
  **A quien se saca de un evento** (o a todos, si pasa a Privado o a Público) **no le llega nada** (respuesta del usuario, 26/10/2026:
  «Estamos todos en el mismo espacio físico.»; sin plantilla ni tipo de salida); si se lo vuelve a sumar, otra invitación.
  **Los cuatro llegan aunque la persona esté de licencia** (van al mail laboral y los ve a la vuelta: respuesta del usuario, 26/10/2026, extendida a los cuatro;
  es la excepción a la regla de no mandar emails durante una licencia), y **los tres del guardado salen en el momento, también en un día que no es hábil** (responden a lo que hizo una persona): quién recibe qué se decide en la transacción (la audiencia previa a la escritura, `audienciaDe`, se lee antes de escribir: después ya no están las filas de quien salió) y se mandan después de responder, fuera de ella (`guardarEvento` es el único lugar del alta, el cambio y la baja;
  `enviarEmailsDelGuardado` de `services/miEspacioEventosEmails.js`, que nunca tira), así un «para todos» no hace esperar a quien lo guarda y, si un email falla, el evento queda guardado.
  Cada uno con `sendEmail` y `to: [email]`, solo con un email que pasa `emailValido` (sin destinatario iría a las casillas por defecto de la DGMIT; una persona sin email no deja fila), y cada intento deja su fila en `mi_espacio_evento_envios` (`anotarEnvio`, con `success` 1 o 0).
  El título, el detalle y el nombre de quien lo creó van escapados, cada parte una sola vez, en `parrafoDelEvento` y `parrafoDelDetalle`: `plantillaSimple` no escapa sus párrafos.
- La corrida de los recordatorios (sección 5;
  `ejecutarRecordatoriosDeEventos({ ahora })` de `services/miEspacioEventosCorrida.js`; su ruta, su frecuencia, su candado y su línea en Correos → Estado, en `docs/temas/calendario-y-corridas.md`): solo manda en un día hábil con los feriados de la tabla (un sábado o un feriado no manda nada, pero la corrida se anota igual), y manda los recordatorios cuya hora de aviso ya pasó y cuyo evento todavía no empezó, de los eventos activos de hoy a hoy + 15 días (`VENTANA_DE_LA_CORRIDA`;
  `eventosParaLaCorrida`, en lote: cuatro consultas para todos, con los destinatarios —quien lo creó, si está activo, y su audiencia, atada a `audienciaDe` por un test— y solo los envíos de tipo recordatorio).
  Qué toca lo decide `recordatoriosQueTocan` (puro).
  La precisión es de media hora: el aviso sale en la primera corrida desde su hora; uno que no salió (el evento se creó después, la corrida falló o el envío falló) sale en la siguiente de un día hábil, mientras el evento no haya empezado.
  **Los atrasados** (más de 30 minutos desde su hora de aviso, `MINUTOS_A_TIEMPO`; a los 30 justos todavía está a tiempo) **salen solo de las 07:00 a las 20:00 de un día hábil** (`HORA_DE_LOS_ATRASADOS` inclusive y `HORA_DE_CIERRE_DE_LOS_ATRASADOS` exclusive), siempre antes del evento; fuera de esa franja esperan a las 07:00 del día hábil siguiente (respuesta del usuario, 26/10/2026: un recordatorio atrasado no sale de noche ni de madrugada; la hora de cierre la sumó la sesión coordinadora).
  Por ejemplo, un evento creado a las 22:00 para las 08:00 del día siguiente avisa a las 07:00.
  Los que salen a tiempo salen en su hora:
  «2 horas antes» de un evento a las 08:00 sale a las 06:00.
  El formulario dice «sale con el próximo envío», que para un atrasado de la noche es el de las 07:00.
- **Nunca dos veces, a lo sumo una** (la reserva): cada recordatorio se reserva antes de mandarlo, con un `INSERT IGNORE` sobre la clave única de los recordatorios (o, uno que falló y terminó, con un `UPDATE` que lo vuelve a tomar solo si sigue fallido y terminado), y se manda solo si la reserva es de esta corrida (`affectedRows === 1`); después se anotan `success` y `enviado_at`.
  Uno que `sendEmail` no pudo mandar queda con `success = 0` y se reintenta en la misma fila.
  **Una reserva sin terminar** (`enviado_at` NULL: el proceso se cayó entre la reserva y el envío, o falló la anotación del final) **no se repite nunca**: pudo haber salido, y la spec manda que nunca salga dos veces (decisión del controlador de la implementación; si hiciera falta, se sumaría un vencimiento de las reservas viejas).
  La plantilla se arma una vez por evento y antes de reservar (si tirara, no queda una reserva que frene el reintento).
  El texto de nodemailer de un envío que falla no va al resultado (puede traer la dirección).
  Devuelve `{ ocupada, dia_habil, enviados, fallidos, errores }`, y su resultado (`textoDelResultadoDeEventos`:
  «Recordatorios enviados: 2.
  Fallidos: 1.», «Día no hábil: no se mandan recordatorios.», más « Errores: evento 12, persona 4: …», cortado a 1000) queda en `mi_espacio_eventos_corridas`, con `con_errores` si hubo fallidos o errores.
- La API (`controllers/miEspacioEventosController.js`; todas con `authMiddleware`, sobre `req.user.userId`, en `RUTAS_MI_ESPACIO` de `tests/permisos.test.js`; respuestas `{ success, data?, error?, campo?, message? }`, un error de validación es 400 con su `campo`):
  `GET /api/mi-espacio/eventos?desde=&hasta=&mes=` (el rango de «Hoy no están», con `rangoDelPedido` de `miEspacioController.js`, sin copiarlo: hasta 93 días, 400 en `fechas` antes de leer nada;
  `mes`, solo para `frase_del_mes`) → `{ desde, hasta, hoy, puede_compartir, mi_nombre_corto, eventos, licencias, feriados, ausentes, companeros_por_dia, frase_del_mes }` (las dos últimas: ver `docs/temas/mi-espacio-agenda-mes.md`): cada evento como lo ve quien lo pide (`itemDeEvento`:
  `es_mio`, `creador` —el nombre corto de quien lo creó, o null sin un nombre—, `personas` —los nombres completos (el formulario de uno propio los muestra al lado de los de la lista para compartir); con «Todos», []—, `personas_ids` solo si es suyo, `recordatorio` y `recordatorio_texto` del evento, `mi_recordatorio`, `aviso` `{ momento, texto, corto }` sobre el suyo, `quien_texto` —«Solo vos», «Con toda la administración», «Con Carla» (una sola persona, con su nombre corto;
  sin nombre, «Con 1 persona»), «Con 4 personas» o «De Julián»— y, si no es suyo, `quien_largo` —«Lo creó Julián.
  Están: vos, Carla B. y Tomás.» o «Lo creó Julián.
  Es para toda la administración.», con los nombres cortos; el punto de una inicial cierra también la oración, «Lo creó Carla R.
  Es para toda la administración.»; sin quien lo creó, la raya—);
  `licencias`, las suyas de Mi espacio, con el tipo y nunca la nota (`itemDeLicencia`; solo las de Mi espacio, no las de Configuración);
  `feriados`, «Feriado: <nombre>» (`itemsDeFeriados`: uno por cada nombre distinto en el mismo día; los que ese año no rigen, no); y `ausentes`, los compañeros que no están, sin el tipo ni la nota (`itemDeAusencia` sobre `ausentesPara`, leídas con margen y unidas;
  `{ nombre, desde, hasta, texto, hasta_texto, dias }`, con el nombre corto:
  «Carla no está»; a quien no es administración, [] sin consultar); cada cosa de varios días va entera, con `dias`, sus días hábiles dentro del rango.
  Las filas de los feriados se leen una vez por pedido, y la administración activa (`administracionActiva`), también, en el mismo `Promise.all`.
  Además:
  `GET /mi-espacio/eventos/aviso?fecha=&desde=&recordatorio=` (cuándo saldría, `{ momento, texto }`, sin guardar nada; va antes que las rutas con `:id`), `GET /mi-espacio/personas` (la administración activa sin quien pide, `{ id, nombre, iniciales }`, ni email ni rol; al lector y al colaborador, 403 «No tenés permiso para compartir eventos.»;
  es la lista del Laboral, y la de un Público es `GET /mi-espacio/personas/publico`: ver `docs/temas/mi-espacio-evento-publico.md`), `POST /mi-espacio/eventos` (201 `{ data: { id } }`, «Evento guardado.»), `PUT /mi-espacio/eventos/:id` (el formulario entero, «Evento cambiado.»), `DELETE /mi-espacio/eventos/:id` («Evento borrado.») y `PUT /mi-espacio/eventos/:id/mi-recordatorio` (`{ sin_aviso: true | false }`; a quien lo creó, 400 `esTuyo` con `campo` null; otro valor, 400 en `sin_aviso`;
  responde `{ mi_recordatorio, aviso }` con «Recordatorio apagado.» o «Recordatorio prendido.»).
  Orden: 404 (un id que no pasa `idPositivo`, ajeno, que no existe o dado de baja) → `validarEvento` → `sinPermiso` → las personas (`personasDelPedido`: las de `personasParaCompartir` más las que ya estaban elegidas; el id propio se saca sin error y, si era el único, 400 en `personas`).
  Cada guardado es una transacción (`enTransaccion`, que repite un `ER_LOCK_DEADLOCK` hasta 3 intentos en total), y el cambio, la baja y «mi recordatorio» bloquean primero la fila del evento (`eventoPropio` y `eventoVisible` con `{ bloquear: true }`;
  «mi recordatorio» lee los feriados antes de abrir la transacción, así no toma una segunda conexión del pool con la fila bloqueada).
  Las personas se escriben por la clave y solo lo que cambia: las que siguen conservan su `sin_recordatorio` (el recordatorio apagado por una invitada sobrevive a un cambio del evento).
  Un guardado rechazado (un 400, o el 404 de quien no lo creó) no manda nada ni deja filas.
  El Resumen (`GET /mi-espacio/resumen`) trae `hoy_y_manana.eventos` (`eventosDeHoyYManana(items, hoy, ahora)`, con el `ahoraArgentina()` del pedido, el mismo del aviso de cada evento: cada uno `{ id, hora, titulo, compartido, publico, detalle, dia, quien }`, con `detalle` «Hoy · solo vos», «Mañana · con Carla», «Mañana · con 4 personas» o «Hoy · de Julián» (con el nombre corto, de la administración del contexto) y `dia` —'hoy' o 'manana'— y `quien` —lo que va después de « · », en minúscula:
  «solo vos»; sin `quien_texto`, ''—, para sus columnas: la página no corta `detalle`; sin los de hoy que ya terminaron —su fin, `hasta` o, sin él, `desde`, antes de la hora y el minuto de `ahora`: a las 10:00, uno de 09:00 a 10:00 todavía va y a las 10:01, ya no; decisión del usuario, 27/10/2026; en la pestaña Agenda siguen—; los de mañana van todos, y sin un `ahora` que sirva o con uno de otro día no saca ninguno (uno sin ninguna hora, tampoco: no se sabe si terminó);
  la página no lo recalcula: si queda abierta, se actualiza al volver a pedir el Resumen), aislado: si falla, [] y la consola.
  El servidor lo manda también sin modalidad; la página, sin modalidad, muestra solo el mensaje.
- La página:
  «Nuevo evento» en el encabezado (`#btn-nuevo-evento`) y en el mes (`#ag-nuevo-evento`, en la banda del mes) abre el formulario con hoy y «2 horas antes»; un día del mes (en la compu) y «Nuevo evento» del día elegido (en el teléfono), con esa fecha; un evento propio, de la grilla, del día elegido o de los próximos, abre `#modal-evento` («Nuevo evento» o «Editar evento», con «Borrar el evento» y su confirmación:
  «¿Borrar «Reunión de equipo» del martes 27/10/2026? A las 4 personas les llega un email que dice que se canceló.»), y uno de otra persona, `#modal-evento-ajeno` (cuándo es, el detalle, quién lo creó y quiénes están, y «Mi recordatorio», que se guarda al elegirlo, con «Cerrar»; un Público de otra persona, sin el detalle ni «Mi recordatorio»: ver `docs/temas/mi-espacio-evento-publico.md`).
  Un clic en el velo no cierra los modales.
- Decisiones del usuario del 27/10/2026: 1) **sin modalidad cargada, la agenda funciona igual**: la pestaña y «Nuevo evento» se ven siempre, aunque «Cargar licencia» y «Cargar horas extras» estén ocultos, y el Resumen sin modalidad muestra solo el mensaje, sin «Hoy y mañana»; 2) la descripción de la página (`<meta name="description">`) es «Tus licencias, tus horas extras, tu agenda y lo que te queda»;
  3) la leyenda del mes no muestra «Compañeros que no están» a quien no los ve (el lector y el colaborador;
  `#ag-leyenda-ausentes`, que se prende con `puede_compartir`); las demás se ven (son siete, y a quien no es de administración tampoco le muestra «Laborales»: ver `docs/temas/mi-espacio-evento-publico.md`); 4) la nota del email de vencimiento («Lo que cargás en Mi espacio lo ves solo vos.») no cambia: habla de licencias; 5) la agenda no toca la corrida de la mañana: su texto de Correos → Estado («No se pudieron enviar los avisos de Mi espacio: el email salió, pero no se pudo anotar») no se cambia.
- Las tablas, su migración y su vuelta atrás, en `docs/temas/base-de-datos.md`; la corrida, en `docs/temas/calendario-y-corridas.md`; el despliegue, en `docs/temas/despliegue.md`.

## La página

La cuarta pestaña:
`'agenda'` en `PESTANAS` (`#agenda`, `#tab-agenda`, `#vista-agenda` y los ids `ag-*`; además de los comentarios y los textos de pantalla, es lo único del archivo que lleva la palabra, salvo `verLaAgenda`, el enlace del Resumen: las funciones y las constantes son de `evento`, como `cargarEventos` y `mostrarMesDeEventos`).
Lo puro: el mes (`diasDeLaGrilla`, de lunes a domingo con los días de los meses vecinos, contados con `Date.UTC` sobre las partes de la fecha;
`mesVecino`, `rangoDeLaGrilla`, `cosasPorDia` —solo los feriados y los eventos de cada día, `[{ clase, texto, evento_id? }]` con `clase` 'feriado', 'propio', 'compartido' o 'publico-otro':
tus licencias y los compañeros van en las barras de `barrasDelMes`, y los renglones de cada cosa los da `renglonesDelDia` (ver `docs/temas/mi-espacio-agenda-mes.md`)— y `htmlDelMes`, una `<table>` con `aria-labelledby="ag-mes-titulo"` y cada `<th scope="col">` con el nombre largo del día para el lector de pantalla), los próximos (`rangoDeProximos`, `gruposDeProximos` —Hoy, Mañana, Esta semana y Más adelante— y `htmlDeProximos`), los eventos de «Hoy y mañana» (dentro de `htmlDeHoyYManana`,
en las columnas Hoy y Mañana según su `dia`, con la hora, el título y debajo `quien`, sin cortar `detalle`; con `hoy_y_manana.eventos` la sección está siempre, y sin ninguno dice «No tenés eventos hoy ni mañana.» con «Ver la agenda»), el formulario (`valoresDelEvento`, `erroresDelEvento` —todos los errores juntos, en el orden del formulario—, `cuerpoDelEvento` —sin `puedeCompartir`, el cuerpo no trae `compartido`, `para_todos` ni `personas`;
siempre con `tipo`: ver `docs/temas/mi-espacio-evento-publico.md`—, `personasParaElegir`, `htmlDePersonasDelEvento` —las que ya estaban en el evento y no están en la lista se muestran al final y se guardan—, `elegirPersona`, `htmlDeOpcionesDeRecordatorio` y `pedidoDelAviso`), el detalle de uno ajeno (`miRecordatorioDe` y `htmlDelEventoAjeno`) y la confirmación del borrado (`textoDeConfirmacionDeEvento`, texto plano).
Lo que toca el DOM:
`cargarEventos` (dos `GET /mi-espacio/eventos`, la grilla del mes que se ve y los próximos, al abrir la pestaña; el mes no va en la dirección;
una respuesta vieja se descarta por los contadores de `pagina.pedidos`), `mostrarMesDeEventos`, `pintarMesDeEventos` (prende «Compañeros que no están» —y «Laborales»— de la leyenda solo con `puede_compartir === true`), `alTocarEventos` (delegado en `#vista-agenda`: un `[data-evento]` de la grilla, del día elegido o de los próximos abre `#modal-evento` si es suyo o `#modal-evento-ajeno` si no;
también «Sábado y domingo», «Nuevo evento» del día elegido y un día del mes: ver `docs/temas/mi-espacio-agenda-mes.md`) y `llevarALaVista` (en el teléfono, desplaza la barra de pestañas, nunca la página, para que se vea la elegida; también después de `document.fonts.ready`).
El evento tiene su propio estado (`pagina.evento` y `pagina.eventoAjeno`: no se cruza con el cálculo de «Cargar licencia»).
Las personas para compartir un Laboral se piden una sola vez (`pagina.personas`, que se vuelve a pedir si falló) y solo con `Auth.isAdmin?.() === true` («Tipo de evento» se ve para todos los roles: ver `docs/temas/mi-espacio-evento-publico.md`).
Si no llegan, la lista lo dice: con un 403 (un rol viejo en el navegador), el mensaje del servidor («No tenés permiso para compartir eventos.», escapado); con otra falla, «No se pudo cargar la lista de personas.
Probá de nuevo en unos minutos.».
Cuándo sale el aviso lo pide a `GET /mi-espacio/eventos/aviso` 300 ms después del último cambio de la fecha, la hora o el recordatorio (`ESPERA_DEL_CALCULO`; la respuesta vieja se descarta; mientras tanto `#ev-aviso` queda vacío, nunca con uno viejo).
«Guardar» se deshabilita hasta la respuesta y el modal no se cierra mientras tanto (un doble clic manda un solo `POST`: dos eventos compartidos mandarían dos invitaciones);
«Borrar el evento» pide una confirmación (`pedirConfirmacion`, sobre el formulario).
«Mi recordatorio» del ajeno manda el `PUT` al elegirlo y la agenda se vuelve a pedir al cerrar el modal (`recargarAlCerrar`), así el foco vuelve antes al evento; un 404 cierra el detalle y la vuelve a pedir una sola vez (apaga `recargarAlCerrar` antes de `noEstaMas`), aunque antes un cambio haya salido bien.
Después de guardar o borrar, el foco vuelve al control del mismo lugar (`identidadDe` guarda `dentro`, `ag-mes`, `ag-proximos` o `ag-elegido`;
`controlesDelCandidato` salta los ocultos, como los de un «y N más» cerrado, con `estaOculto`;
`devolverElFoco` prueba el siguiente si uno no lo toma).
`#ev-recordatorio-ayuda` está vacía en el HTML y `pintarQuienLoVe` le escribe «Les llega a todas las personas del evento.» (`AYUDA_DEL_RECORDATORIO_COMPARTIDO`) solo en uno compartido (con `ayudasDelEvento`; y en un Público, «Te llega solo a vos.»): el select la tiene en su `aria-describedby` y un lector de pantalla la leería aunque estuviera oculta.
Copias de `services/miEspacioEventosReglas.js`, atadas por tests de paridad:
`DIAS_DE_PROXIMOS`, `MENSAJES_EVENTO` (entero), `LARGO_TITULO_EVENTO`, `LARGO_DETALLE_EVENTO`, `FECHA_MINIMA_EVENTO`, `fechaMaximaEvento` (con el tope del año 9999), `textoRangoDelEvento` (`textoRangoEvento`), `RECORDATORIOS`, `RECORDATORIO_POR_DEFECTO`, `TEXTO_RECORDATORIO`, `erroresDelEvento` (`validarEvento`: su primer error es el del servidor, en los bordes de cada campo), `cuandoDelEventoDe` (`cuandoDelEvento`) e `iniciales` (`inicialesDe`: con lo que no es un texto, '');
`diaLargoDe` y `tituloDelMes` (`diaLargo` y `mesTitulo` de `services/miEspacioResumen.js`) e `idDeLaPersona` (`idPositivo` de `services/proyectosReglas.js`), también atadas.
Solo del navegador, con tests de comportamiento: los nombres de los días, los grupos de los próximos y `AYUDA_DEL_RECORDATORIO_COMPARTIDO`.
La agenda no recalcula días hábiles ni textos: los días que pinta una licencia o un compañero (`dias`), el aviso, quién está, «Hasta el …» y «Feriado: …» los manda el servidor.

## Reglas de los tests

Los tests de la corrida corren con un hoy fijo (`mock.timers`) y llaman a la función directo, nunca a `/api/cron/*`; el de `/cron/eventos` con la clave toma el candado en otra conexión, así la corrida no escribe ni manda nada en la base del `.env`.
Los emails del guardado salen después de responder: el test los espera y de Mailpit cuenta solo los que traen la marca de su título, porque puede tener los de otras sesiones o uno de un test anterior.

## Archivos de tests

`permisos.test.js`, `mi-espacio-eventos-reglas.test.js`, `mi-espacio-eventos-api.test.js`, `mi-espacio-eventos-corrida.test.js`, `mi-espacio-frontend.test.js`, `schema.test.js`, `email-diseno.test.js`, `notas-motor.test.js`, `correos-frontend.test.js`, `paginas.test.js`
