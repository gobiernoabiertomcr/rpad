# El dato de la quincena: el correo

El mail «Dato de la Quincena» lo manda el RPAD, no el bot, siguiendo sus días hábiles: cuándo sale, a quién, con qué estados y textos, la corrida, Reenviar y la prueba, las fechas en la agenda de Mi espacio, el mail, la pestaña Envío y votación y la transición.
La pestaña Envío y votación se abre con `#correo` en la dirección: así siguen sirviendo los enlaces guardados.
El archivo de las ediciones (las lecturas y la página) está en `docs/temas/dato-quincena.md`, y el POST de Datito, la clave, la huella y el recibo, en `docs/temas/dato-quincena-contrato.md`.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-11-12-dato-quincena-correo-design.md`
- `docs/superpowers/specs/2026-11-14-dato-quincena-v1-3-design.md` (la pastilla Repite y la caja de la repetición)
- `docs/superpowers/specs/2026-11-14-dato-quincena-agenda-grupos-design.md` (la agenda en grupos)
- `docs/superpowers/specs/2026-11-14-dato-quincena-en-mi-espacio-design.md` (las fechas en la agenda de Mi espacio)
- `docs/superpowers/specs/2026-11-18-dato-quincena-propuestas-datasets-design.md` (las propuestas de datasets nuevos)
- `docs/superpowers/specs/2026-11-21-dato-quincena-principal-equipo-design.md` (la frase y el recuadro del mail)
- `docs/superpowers/specs/2026-11-23-dato-quincena-principal-votacion-design.md` (la pestaña Envío y votación y la lista de quienes votan)
- `docs/superpowers/specs/2026-11-23-dato-quincena-agenda-esta-semana-design.md` («Esta semana» en la agenda)

## Archivos

datoQuincenaCorreoReglas (puro: cuándo sale, los estados y todos los textos del detalle, de la pastilla y del recibo, la caja de administración, las próximas ediciones, las fechas de la agenda de Mi espacio, los avisos de Correos → Estado y `modeloDelMail`);
datoQuincenaCorreoDatos (las consultas y las escrituras: la configuración, la lista, las filas de cada envío, la reserva de cada persona);
datoQuincenaCorreo (la corrida con su candado `BLOQUEO_DATO_QUINCENA`, `reenviar`, `mandarPrueba` y lo que muestra Correos → Estado);
datoQuincenaCorreoController (las seis rutas de administración);
emailTemplates (`datoQuincenaTemplate`, la plantilla del mail);
dato-quincena.html y dato-quincena.js (las pestañas, la lista en tarjetas, la caja del correo del detalle y el diálogo de Reenviar);
`database/updates/migracion-dato-quincena-correo.sql` y `rollback-dato-quincena-correo.sql` (las tablas, en `docs/temas/base-de-datos.md`).

## La idea

- Datito archiva la edición en el RPAD y el RPAD manda el mail en la corrida del primer día hábil en que ya está archivada.
  El bot no conoce los días hábiles: un lunes feriado el mail igual saldría.
  Su propio mail es una copia para el usuario, «[Copia] …»: no es del RPAD y no se lee.
  Hasta el lunes de la transición el bot sigue mandando a todos (abajo, «La transición»).
- El mail va a personas con cuenta, elegidas por administración en la pestaña Envío y votación, sin roles nuevos ni casillas sueltas.
- Todo texto del envío lo arma el servidor; la página y el mail lo imprimen.
- El nombre del bot es `NOMBRE_DEL_BOT = 'Datito'` en `datoQuincenaReglas.js` y una constante de `dato-quincena.js`, porque es provisorio.
  Los textos de las ediciones ya archivadas también dicen Datito: el nombre no se guarda.

## Cuándo sale

- Solo las ediciones **regulares**.
  Un piloto nunca sale solo (sí se le puede mandar una prueba).
- Al llegar (el 201 del POST), en la misma transacción, la edición queda `programada` si el envío automático está prendido y su `fecha_edicion` es de los últimos 13 días (`DIAS_DE_VIGENCIA`); si no, queda `no_enviada` con su motivo, `apagado` o `vieja`.
  Un 200 o un 409 no programan nada.
  Una edición archivada antes de esta entrega no tiene fila de envío: nunca sale sola.
- Una corrida de las 8:05 o de las 14:00 manda las programadas si hoy es día hábil, el envío automático está prendido y `fecha_edicion <= hoy`.
  Si hay más de una programada, sale solo la de `fecha_edicion` más nueva; las otras quedan no enviadas, `mas_nueva`.
  Si al correr el envío está apagado (también un día no hábil), las programadas quedan no enviadas, `apagado`: apagarlo cancela lo que esperaba y prenderlo no manda lo de antes (para eso está Reenviar).
  Si la edición ya pasó los 13 días al correr, queda `vieja`.
- Una edición que llega después de las 8:05 de un día hábil sale a las 14:00 de ese día; después de las 14:00, a las 8:05 del siguiente día hábil.
- Un día no hábil la corrida no manda nada.
  El calendario es el de siempre, una lectura por corrida; si la tabla de feriados no se pudo leer (`calendario.error !== null`), no manda y lo deja para la corrida siguiente.
- Quién la recibe: la lista de la pestaña Envío y votación **en la primera corrida que la manda**, que arma una fila por persona.
  Quien se suma después no la recibe sola (se le puede reenviar).
  Al armarla se salta a quien está inactivo o sin un email válido (`omitido`); a quien está de licencia oficial ese día (`usuarios_licencias` sin anular) se le anota `licencia` y no se le reintenta.
  Con la lista vacía, la edición queda `no_enviada` con `sin_lista`.
- Los reintentos: la persona cuyo envío falló se reintenta en cada corrida siguiente de un día hábil, hasta 3 intentos (`MAXIMO_DE_INTENTOS`); al tercero queda «No se pudo enviar» y va un aviso a Correos → Estado.
  Los reintentos corren solo mientras la edición sigue vigente y el envío está prendido; una que dejó de estar vigente con reintentos abiertos los cuenta como finales (decisión: así ningún mail viejo sale al prender el envío semanas después y nada queda trabado).
  Entonces Reenviar queda habilitado: reenviarla es la forma de que le llegue.
  Apagar el envío solo frena los reintentos; los cierra la vigencia.
  Cada intento usa los datos de ese momento: el email de hoy, y una licencia de hoy es `licencia` sin reintento.
- Un `enviando` que quedó así por un corte no se reintenta, porque pudo haber salido (el criterio del aviso diario): se muestra «Sin confirmar» y cuenta como parcial.
- Las horas «8:05» y «14:00» son las de las Tareas Cron; lo que se guarda y se muestra es la hora real del envío (`ahoraArgentina()`).

## Los estados y los textos

- La edición: `programada`, `enviada` (a todas las personas que correspondía), `parcial` (a alguna no le llegó o quedó sin confirmar), `fallida` (a ninguna) o `no_enviada` (con su motivo).
  Cada persona: `pendiente`, `enviando`, `enviado`, `fallido` (con sus intentos), `licencia` u `omitido`.
- El detalle, para todos los roles:
  «Enviada por correo el martes 10/11/2026 a las 8:05.», «Se envía hoy a las 8:05.», «Se envía hoy a las 14:00.», «Se envía el martes 24/11/2026 a las 8:05.», «No se envió: el envío automático estaba apagado.», «No se envió: llegó con más de 13 días.», «No se envió: hay una edición más nueva.», «No se envió: no había nadie en la lista.», «No se pudo enviar.».
  Mientras el envío está apagado, una programada dice «En espera: el envío automático está apagado.».
  Un piloto: «Los pilotos no se envían por correo.».
  Una edición sin envío dice la línea de Datito de `docs/temas/dato-quincena.md`.
- La pastilla de la tarjeta: «Enviada el mar 10/11», «Sale hoy a las 8:05», «Sale hoy a las 14:00», «Sale el mar 24/11», «En espera», «No se envió», «No se pudo enviar», «Piloto: no se envía»; en una edición sin envío, «Enviada por Datito el lun 09/11» si su correo salió y ninguna si no.
  Administración ve además «Enviada a 3 de 4» cuando es parcial (M son todas las personas del envío automático, también las de licencia).
  Cada tipo con su color y su ícono, nunca solo el color: enviada en verde con el tilde, programada en cielo con el reloj, parcial, fallida y en espera en sol con el triángulo, no enviada y piloto en gris.
- «Sale el …» y «Se envía el …» se calculan con el calendario y la hora de la consulta: antes de las 8:05 de un día hábil, «hoy a las 8:05»; de 8:05 a 14:00, «hoy a las 14:00»; después, la mañana del siguiente día hábil, pero nunca antes de `fecha_edicion`.
- Cuando la edición le llegó a la gente por otro camino:
  una `no_enviada` (`apagado` o `vieja`) cuyo JSON dice que Datito mandó su correo muestra la línea y la pastilla del bot (el caso de las ediciones de la transición);
  una que el RPAD no mandó solo y que alguien reenvió a toda la lista dice «Reenviada por correo el miércoles 25/11/2026 a las 10:12.» (pastilla «Reenviada el mié 25/11»);
  un reenvío a una sola persona no cambia la línea que ven todos: se ve en la caja de administración.
- Mientras quedan reintentos, la edición sigue «enviada» para todos y administración ve «1 persona en reintento».
- El recibo del POST (`envio`) usa los mismos textos; su forma, en `docs/temas/dato-quincena-contrato.md`.
  El de un piloto es un objeto (`estado: 'piloto'`) y no null, porque el texto es parte de lo que el bot lee.
- Los textos de cada persona en la caja: «Enviado el 10/11 a las 8:05», «No se envió: de licencia», «No se pudo enviar (3 intentos)», «Sin confirmar».

## La corrida

- Un paso propio, `ejecutarCorreoDelDatoQuincena({ hoy, ahora, calendario })`, llamado por `correoDelDatoQuincenaAislado`, que nunca rechaza: lo que falle va a `errores` con un texto fijo.
  Va en la corrida de las 8:05 (`/api/cron/notificaciones`) al final, después del vencimiento de Mi espacio y antes de esperar el aviso diario, para darle unos segundos más al bot (`tests/mi-espacio-eventos-diario.test.js` fija que ningún `anotarEnLaUltimaCorrida` vaya después de `resultados.diario = await diario`), y en la de las 14:00 (`/api/cron/cambios-pendientes`) después del aviso diario.
  Sin Tarea Cron nueva.
- Su candado, `conBloqueo(fn, 'rpad_dato_quincena_correo')`, sin espera: ocupado no es un error (`ocupada: true`).
  `tests/notificaciones.test.js` y `tests/permisos.test.js` llaman a la corrida de las 14:00 sobre la base del `.env` y toman este candado, como el del aviso diario, para no mandar nada ni escribir.
- Que no salga dos veces lo garantiza la base, no el candado: cada persona se reserva con un `UPDATE … WHERE estado IN ('pendiente', 'fallido') AND intentos < 3` y solo se manda si `affectedRows === 1`.
  El automático es uno por edición y persona (`uq_dato_quincena_envio_automatico`).
- Un mail por persona: `sendEmail` con `to`, `from` de `remitente()`, una sola vez por reserva.
  La función de envío se inyecta en los tests (`enviar`), para probar fallas sin depender de Mailpit.
- Los errores: a las 8:05 suman a `resultados.errores` con `tipo: 'dato-quincena'`; a las 14:00 quedan en `data.dato_quincena.errores` y dan 207 (como el aviso diario, y `ocupada` no es un error).
  Lo que ve Correos → Estado lo escribe en su propio registro (`dato_quincena_correo_config`, las columnas `corrida_*`), no en la última corrida de las Notas.
- `/api/notificaciones/ejecutar` y `/api/notificaciones/cambios-pendientes`, las rutas manuales de administración, corren también este paso a la hora que sea: un día hábil manda lo que ya correspondía (es la acción de una persona), y con la reserva no repiten lo que salió.
- El sellado de la votación de la principal es otro paso, aparte y con su candado: `docs/temas/dato-quincena-principal-equipo.md` y `docs/temas/calendario-y-corridas.md`.
- Correos → Estado suma una línea del dato de la quincena (`dato_quincena.texto`, «El dato de la quincena: la última corrida fue el …») y dos alertas de nivel error:
  `dato-quincena-con-errores`, si la última corrida terminada falló en algo;
  y `dato-quincena-no-llego` («El dato de la quincena del 23/11/2026 no le llegó a 1 persona: se le puede reenviar desde la edición.»; con más, «no les llegó a 2 personas: se les puede reenviar…»), que no depende de la última corrida y sigue mientras la última edición que salió sola tenga una persona que no la recibió después de sus intentos, hasta que un reenvío le llegue o salga una más nueva.
  Una persona «Sin confirmar» no cuenta en esa alerta.
  Si no se puede leer, `dato_quincena` es null y va una advertencia.

## Reenviar y la prueba

- Solo administración, en el detalle de la edición.
- «Reenviar…» (una edición regular): a todas las personas que hoy están en la lista o a una de ellas, en el momento, aunque no sea día hábil, el envío esté apagado o la persona esté de licencia (lo decide una persona).
  Mismo asunto y contenido.
  Cada mail queda como una fila `reenvio`; el estado de la edición no cambia, salvo que una persona a la que no le había llegado ahora sí lo reciba (deja de contar como falla).
- «Enviarme una prueba» (cualquier edición, también un piloto): solo a la casilla de quien aprieta, con «[PRUEBA] » delante del asunto; no cuenta para el estado.
- Reenviar no se puede mientras el envío automático de esa edición no terminó (programada, o con alguna persona pendiente o en reintento): 409 «Esta edición todavía se está mandando sola: se puede reenviar cuando termine.», y el botón no aparece.
  Así un reenvío nunca se cruza con un envío automático.
- Los dos usan el candado de la corrida: si está mandando, 409 «Ahora se está mandando el dato de la quincena. Probá de nuevo en unos minutos.».
- La respuesta dice a cuántas personas salió y a cuántas no, sin el texto de nodemailer.
  Un 502 si un reenvío no llegó a nadie o si la prueba no salió.
- Una persona a la que no se le pudo armar el mail o anotar su fila cuenta entre las que no lo recibieron, y el reenvío sigue con las demás (en la consola, solo el código del error).
  Decisión: un 500 a mitad de camino, al repetirlo, les mandaría dos veces a las que ya lo recibieron.
- Las rutas, todas con `authMiddleware` y `adminOnly` (sin sesión 401, lector y colaborador 403; `tests/permisos.test.js`):
  `GET /api/dato-quincena/correo` (el envío, las próximas ediciones y las personas activas con su email, si lo reciben, si votan (`vota`), `votan_texto` y, de licencia, hasta cuándo);
  `PUT /api/dato-quincena/correo/envio` (`{ activo }`; solo el `true` literal prende y algo que no es un booleano da 400);
  `PUT /api/dato-quincena/correo/destinatarios` (`{ usuarios: [ids], votantes: [ids] }`; reemplaza las dos listas en una sola transacción; solo usuarios activos, uno inexistente, inactivo o repetido da 400 en cualquiera de las dos; guardar conserva `agregado_at` de quienes siguen; sin `votantes`, una pestaña con la página anterior, la lista de quienes votan no cambia y el mensaje es el de antes);
  `GET /api/dato-quincena/ediciones/:id/correo` (el resumen, cada persona con su estado, los reenvíos y las pruebas, y la lista de hoy para el diálogo);
  `POST /api/dato-quincena/ediciones/:id/reenvios` (`{ a: 'todas' }` o `{ a: <id de una persona de la lista> }`);
  `POST /api/dato-quincena/ediciones/:id/prueba`.
  Un id que no es entero positivo o no existe da 404 en JSON; un 500 dice un texto fijo por operación.
- Las próximas ediciones de `GET /correo` son una estimación: cada 14 días desde la última regular (`CADENCIA`; sin ninguna, desde `PRIMERA_EDICION`), con el día en que saldrían y el motivo si se corren («no es hábil el lunes 23/11, Día de la Soberanía Nacional»).

## En la agenda de Mi espacio

- La agenda de Mi espacio muestra cuándo sale el mail, para todos los roles, con la misma serie: `proximasEdiciones({ …, desdeLaSalida: true })` salta las ediciones cuyo día de salida (`sale`) es anterior a hoy, no las de fecha anterior a hoy.
  Decisión: el martes 24/11 la edición del lunes 23/11 feriado sale ese día aunque todavía no haya llegado, y sin la opción la serie ya la saltaría.
  La pestaña Envío y votación la llama sin la opción y no cambia.
- `datoQuincenaEnMiEspacio({ envioActivo, ultima, ahora, calendario, filasDeFeriados })` arma las fechas, las mismas para todos: hasta 5 (`CUANTAS_EN_MI_ESPACIO`), por fecha, y ninguna con el envío automático apagado o la tabla de feriados caída.
  `ultima` es la última regular con su correo y sus filas automáticas (`ultimaRegularConSuCorreo`, con la fecha como texto 'AAAA-MM-DD'), o null (la serie arranca en `PRIMERA_EDICION`).
- Si la última ya llegó, va según su situación, la misma de la pastilla (`situacionDelEnvio`): programada, el día y la hora de la corrida que la manda (08:05 o 14:00), si ese día todavía está vigente; enviada, solo el día de su primer envío, con esa hora y «Salió el dato de la quincena»; las demás no van.
  Decisión: la vigencia de una programada se mira con `estaVigente` contra el día de su salida, no contra hoy, porque con las corridas paradas la corrida de ese día la da por vieja y no sale (el día 13 después de las 14:00, la salida ya cae fuera).
  Después, las de la serie, a las 08:05 del día en que salen.
- Cada fecha es `{ fecha, hora, texto, nombre, titulo, detalle }`: «Dato de la quincena» para la casilla, «Sale el dato de la quincena» (o «Salió…»), el detalle «Edición del lunes 23/11: no es hábil el lunes 23/11, Día de la Soberanía Nacional.» y el `title`, «Sale el dato de la quincena, a las 08:05. » con el detalle.
  El día de la edición va sin el año, y la hora con dos cifras, como los eventos de la agenda (la pestaña Envío y votación dice «8:05»).
- El motivo es el de la serie y va solo si la fecha es el día en que la serie la hace salir.
  Decisión: una edición que ya llegó y sale otro día (en reintento, o porque llegó después de las 14:00) dice solo «Edición del lunes 23/11.»: la agenda no sabe la causa y no dice nada falso.
- No se copia ninguna regla: la serie, la salida y el motivo son los de la pestaña Envío y votación.
  Lo que dibuja la agenda está en `docs/temas/mi-espacio-agenda-mes.md`.

## El mail

- Asunto «Dato de la Quincena - DD/MM/AAAA», con la `fecha_edicion` también si sale corrido; remitente `remitente()`.
  Un mail por persona, con `marcoEmail` (tablas y estilos en línea, un solo `<!DOCTYPE>`, sin `<style>` ni emojis: lo controla `tests/email-diseno.test.js`).
- Contenido: el título y debajo «Edición N.º N» y la cantidad («4 propuestas de comunicación que armó Datito. Son internas: todavía no están aprobadas ni publicadas.»);
  justo después, la frase que aclara que la principal del correo es la que marcó Datito (abajo);
  «Buen día, <primer nombre>.»;
  el recuadro «Esta edición se lee mejor en el RPAD», con su botón (abajo);
  la infografía en línea (`cid`) con su pie;
  «Agenda de la quincena», en sus grupos («Lo que pasó», «Esta semana», «Lo que viene» y «Efemérides», los de `agenda_grupos`: `docs/temas/dato-quincena.md`);
  una tarjeta por propuesta, con su franja («Propuesta 1 de 4», «Principal» en la principal) y la cifra, el dataset, la repetición si hay, «Por qué es noticia» (`por_que_hoy`), el ángulo, la idea de placa, el texto para redes, los puntos, el borrador, lo que hay que validar y las fuentes;
  si la edición trae `propuestas_datasets`, «Propuestas de datasets nuevos» (abajo);
  el botón «Ver la edición en el RPAD» (`RPAD_URL/dato-quincena.html?id=N`);
  y una nota al pie con dónde están el texto del bot, los cálculos y la edición completa, por qué le llega y a quién avisar para dejar de recibirlo.
- Las etiquetas de una propuesta van en pastillas, menos «Principal», que va en la franja: «Validar» en ámbar, «Agenda» en celeste, «Efeméride» en la suave gris y «Repite» blanca con un borde de 1 px `#76879F` (con un píxel menos de relleno: mide lo mismo que las otras); cada una dice su nombre.
- La agenda, en un recuadro, con una sola tabla: el título de cada grupo en negrita, en una fila que ocupa las dos columnas, y debajo sus eventos, la fecha en su columna y el título, el detalle y «Ver» si la dirección es `https://`.
  Sin pastillas: el título del grupo ya dice si es una efeméride.
  `modeloDelMail` pasa `agenda_grupos` del detalle, no la `agenda` sin agrupar; un grupo sin eventos no va y, sin ninguno, la agenda no va.
- La repetición (`docs/temas/dato-quincena.md`), en un recuadro neutro (fondo `#F4F7FA`, borde `#DAE3ED`) después del renglón de la foto y antes de «Para validar»: el `texto` en negrita y abajo el `motivo`.
  El texto es un enlace a `RPAD_URL/dato-quincena.html?id=N` solo con un `id_edicion` entero positivo, subrayado a diferencia de los demás enlaces del mail: el texto sin enlace también es negrita y el color solo no los distingue.
  La corrida arma el detalle con las ediciones previas (`edicionesPreviasSinFallar`), como la página; `modeloDelMail` copia cada propuesta del detalle, así que la repetición llega sola.
  Si las previas no se pueden leer, el mail sale igual en esa corrida, con la repetición sin enlace.
- Las propuestas de datasets nuevos (`propuestas_datasets`, `docs/temas/dato-quincena.md`) van en su propia sección, «Propuestas de datasets nuevos», después de las propuestas y antes del botón.
  `modeloDelMail` pasa la lista del detalle, copiada, con la franja «Dataset nuevo N de M» primero en cada una; si el detalle no trae una lista, null.
  `numero`, `valor` y `riesgo` viajan en cada una y la plantilla no los dibuja: la franja reemplaza al número y su rótulo.
  De cada propuesta de comunicación, el modelo deja afuera `orden`, `orden_texto` y lo que se copia (`FUERA_DEL_MAIL`).
  Con null no hay sección: el bloque es null, `marcoEmail` lo saltea y el texto plano no suma nada.
  Sin la clave, el mail no lleva la sección y sale como el del fixture con exactamente dos inserciones, la frase y el recuadro de la principal del equipo (`docs/temas/dato-quincena-principal-equipo.md`), y el rótulo «Por qué es noticia» en lugar de «Por qué hoy»; el resto, byte por byte.
  Lo controla `tests/dato-quincena-resguardo.test.js`: el fixture no se regenera nunca, y las dos inserciones y el rótulo los suma el test.
  Con `[]`, el título y la línea «Esta quincena no hay propuestas de datasets.».
- Cada una va en una tarjeta con el borde de las propuestas, con 16 px entre una y otra (una fila de alto fijo, por Outlook).
  Arriba, la franja verde clara (fondo `#EEF6F1`, borde `#D5E9DD`, texto `#2E6B4C`) con «Dataset nuevo 1 de 3».
  Después, en este orden: los orígenes en pastillas; el título; la prioridad en su pastilla y al lado «Valor alto · Riesgo bajo»; «Por qué abrirlo»; «Formato sugerido»; «Campos sugeridos», en monoespaciada y separados por comas; la anonimización, si hay, en el aviso ámbar «Cómo anonimizar»; «Datasets relacionados en el portal», si hay; y «Fuentes».
  Los orígenes van todos en la pastilla neutra, también «Agenda», que en una propuesta de comunicación va en celeste: dicen de dónde salió la idea y no son una etiqueta de la propuesta.
  El color de la prioridad sale de la clave del servidor, nunca del texto: `alta` en el verde de «Crear», `si_hay_recursos` en el azul de «Editar» y `evaluar` en el ámbar del aviso; una clave desconocida, en la neutra.
  La pastilla de la prioridad va en negrita (700, como en la maqueta aprobada) y siempre dice la prioridad: el color nunca es lo único que la distingue.
  Un dataset relacionado es enlace a su `url` y una fuente, a sí misma, solo si la dirección es `https://`; si no, el texto solo.
  Los campos sugeridos y las listas de enlaces llevan `word-break: break-word` y `overflow-wrap: anywhere`: un campo de 64 caracteres, un slug de 100 o una fuente larga sin espacios no ensanchan el mail.
- La frase y el recuadro de la principal (`aclaracion` y `recuadro` del modelo; la regla y el motivo, en `docs/temas/dato-quincena-principal-equipo.md`):
  la frase, «La principal de este correo es la que marcó Datito: la del equipo se elige y se ve en el RPAD.», es la misma con la votación abierta o cerrada, en cualquier envío;
  va en un párrafo como el de la bajada, en `COLORES.subtitulo` (el gris de la bajada no llega a 4,5:1);
  el recuadro, en celeste, lleva «Esta edición se lee mejor en el RPAD», qué hay en el RPAD y el mismo botón «Ver la edición en el RPAD»;
  la plantilla dibuja cada uno solo si el modelo lo trae.
- El nombre del bot llega a la plantilla por el modelo (`modeloDelMail`): la plantilla no lo escribe.
- Todo texto de la edición va escapado y con sus saltos como `<br>`; una dirección es enlace solo si es `https://`.
- El texto plano lo arma el servidor con lo mismo: no es el `correo_texto` del bot, que trae el saludo de otros destinatarios.
  La repetición va en él como un bloque «<texto>\n<motivo>», en el mismo lugar que en el HTML y sin el enlace.
  La agenda, «Agenda de la quincena» y cada grupo con su título en un renglón y sus eventos debajo («10/11/2026 · Título», el detalle y la dirección `https://`), separados por un renglón en blanco.
  Las propuestas de datasets nuevos, en el mismo lugar que en el HTML: «Propuestas de datasets nuevos», un renglón en blanco y cada una en renglones seguidos, separadas por un renglón en blanco.
  Cada una: la franja; el título con sus orígenes entre corchetes; la prioridad con «(Valor alto · Riesgo bajo)»; «Por qué abrirlo» y la justificación; «Formato sugerido: CSV»; «Campos sugeridos: fecha, barrio»; «Cómo anonimizar» y su texto, si hay; los relacionados, «- nombre: dirección» (la dirección solo si es `https://`); y las fuentes, como llegaron.
  Con `[]`, «Propuestas de datasets nuevos» y en el renglón siguiente «Esta quincena no hay propuestas de datasets.».
  La frase va un renglón debajo de la bajada, en el mismo bloque, y el recuadro es un bloque «Esta edición se lee mejor en el RPAD: <dirección>» después del bloque del título.
- Adjuntos: la infografía PNG en línea, la misma PNG como archivo y el SVG si llegó (`datoQuincenaTemplate(modelo, { conSvg })`), con los nombres del manifiesto.
- Sin direcciones en lo que se muestra: ni la lista de ediciones ni el detalle traen emails ni nombres de quienes lo reciben; el texto de nodemailer, que puede traer la dirección, va a la consola solo con su código.

## La página

- Pestañas «Ediciones» y «Envío y votación» para administración (`tablist`, flechas, Home y End; `#correo` en la dirección, junto a `?id`, `&vista`, `&propuesta`, `?anio` y `&pagina`); los demás roles ven la página sin ellas.
  La lista en tarjetas «tipo diario» y sus páginas de a 18 están en `docs/temas/dato-quincena.md`; la pastilla la ven todos y administración ve además si a alguien no le llegó.
- Envío y votación: «Envío por correo», con el interruptor «Envío automático» (se guarda al cambiarlo; al prenderlo, una confirmación que dice qué va a pasar), la regla en dos oraciones y «Las próximas ediciones»;
  «La votación de la principal del equipo», con la regla en dos párrafos (el cierre, a las 12:00 del día del mail o cuando votaron todas las personas de la lista, lo que pase primero; los puntos y el desempate; lo que se ve; el mail de las 14:00 y los pilotos);
  y «Las personas», con «Recibe el mail: …» y «Vota: …» arriba y la tabla de personas activas (persona y cargo, rol, correo, «Recibe el mail» y «Vota», una casilla en cada una), `reciben_texto` y `votan_texto` al pie (`textoDeLosQueReciben` y `textoDeLosQueVotan`, con copias en la página atadas por un test de paridad para el conteo en vivo) y un solo «Guardar».
  El mensaje al guardar: «Guardamos la lista: lo reciben 4 personas y votan 3.».
  Cambiar la lista no cambia las votaciones abiertas: cada edición vota con su foto (`docs/temas/dato-quincena-principal-equipo.md`).
- El detalle: el N.º en la cabecera, la línea del correo y, en «Archivos», la infografía editable.
  Para administración, al final de la pestaña General de la edición, la caja «Correo» con el resumen, una fila por persona, «Reenviar…» (un diálogo: a todas o a una persona de la lista, con el aviso de que sale en el momento) y «Enviarme una prueba».
  Cualquier respuesta de Reenviar cierra el diálogo y vuelve a leer la caja.
- Las reglas de siempre: lo que arma HTML es puro; todo texto del servidor por `Utils.escapeHtml`; los botones que mandan, deshabilitados hasta la respuesta; sin `ad-`; `VERSION_DATO_QUINCENA` en `tests/paginas.test.js`.

## La transición

- La migración va antes del código; el envío nace apagado y la lista, vacía.
- El orden, el mismo que sigue el kit:
  1. Desplegar con el envío automático apagado.
  2. Tildar a las personas en la pestaña Envío y votación y guardar.
  3. «Enviarme una prueba» sobre la edición del 09/11 y mirar el mail.
  4. El piloto 7 en producción: Datito manda un piloto con la forma nueva (con el envío apagado), se miran el recibo y la tarjeta, y se usa «Enviarme una prueba» sobre él.
  5. Elegir el lunes de la transición.
  6. El día hábil anterior a ese lunes, prender el envío automático y escribirle a Datito «desde la edición del DD/MM, copia solo a mí».
  Así nadie recibe dos mails ni ninguno.
- El envío se prende a más tardar el día hábil anterior al lunes elegido (o ese lunes antes de las 7:00), antes de que Datito archive la edición.
  La edición se programa cuando llega (`envioAlLlegar`), y Datito arranca a las 7:00 y la archiva entre las 7:15 y las 7:45: prenderlo a las 7:50 ya no la programa.
  Prendido después, la edición queda `no_enviada` (`apagado`) y no sale sola, y ese día Datito manda solo la copia al usuario: al equipo no le llega.
  La página no lo hace notar: como el JSON dice que Datito mandó su correo, muestra la línea y la pastilla del bot.
- El plan B: si ese lunes la edición no dice «Se envía …» ni «Enviada por correo …», sino la línea de Datito o «No se envió: el envío automático estaba apagado.», administración la manda con «Reenviar…» → «A todas las personas que hoy lo reciben».
- Hasta entonces el bot manda a todos: una edición que llega con el envío apagado queda `no_enviada` (`apagado`) y muestra la línea y la pastilla del bot.
- La vuelta atrás está en `docs/temas/despliegue.md`: se pierden los SVG ya guardados, el registro de los envíos, la lista y el interruptor (exportarlos antes).

## Archivos de tests

`dato-quincena-correo-reglas.test.js` (puro), `dato-quincena-correo.test.js` (la corrida contra su base y Mailpit, con un hoy fijo), `dato-quincena-correo-api.test.js` (las rutas), `dato-quincena-frontend.test.js`, `dato-quincena-reglas.test.js`, `dato-quincena-api.test.js`, `email-diseno.test.js`, `notificaciones.test.js`, `permisos.test.js`, `schema.test.js`, `correos-frontend.test.js`, `paginas.test.js`
