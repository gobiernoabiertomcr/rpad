# El dato de la quincena: el mail lo manda el RPAD, y la lista en tarjetas

Spec del 12/11/2026. Sigue a `2026-11-07-dato-quincena-design.md` (el archivo) y a la entrega «sin correo» (`no_enviado`).
Las decisiones son del usuario, en rondas de preguntas del 12/11; las que tomó la sesión dicen «decisión de la sesión».
Los ejemplos de este documento son inventados: ningún nombre, dirección de correo ni cifra de producción.

## 1. Por qué

Hoy el mail de cada edición lo manda el bot (Datito, antes Grok Bot) a las 8:00 de cada dos lunes, y después archiva la edición en el RPAD.
El bot no conoce los días hábiles: el lunes 23/11/2026 es feriado, y el mail igual saldría.
El usuario quiere que el envío siga las reglas del RPAD: el bot archiva la edición, como ahora, y el RPAD manda el mail en su corrida de la mañana del primer día hábil.
En 2026 casi ningún lunes de la serie es hábil: el 09/11 fue feriado (el mail habría salido el 10/11), el 23/11 pasa al 24/11 y el 07/12 (no laborable, con el 08/12 feriado fijo) al miércoles 09/12.

La lista de ediciones, además, pasa de filas anchas a tarjetas de a tres, «tipo diario», con páginas de a 18.

## 2. Decisiones del usuario

1. El mail «Dato de la Quincena - DD/MM/AAAA» lo manda el RPAD a las 8:05 del primer día hábil en que la edición ya está archivada. La fecha del asunto es la de la edición, también si sale corrido.
2. Si la edición llega después de las 8:05 de un día hábil, sale a las 14:00 de ese día; si llega después de las 14:00, a las 8:05 del siguiente día hábil.
3. Lo reciben las personas que elige administración: sin roles nuevos. Las cuatro de hoy tienen cuenta en el RPAD (la encargada de prensa es lectora, activa): la lista es de usuarios, sin casillas sueltas.
4. Dónde se elige: una pestaña «Correo» en El dato de la quincena, que solo ve y edita administración (superadmin, admin y editor); la otra pestaña es «Ediciones».
5. Si el envío a una persona falla, el RPAD lo reintenta solo en las corridas siguientes, hasta 3 intentos por persona; después queda «No se pudo enviar» en la página y un aviso en Correos → Estado.
6. Administración puede «Reenviar» una edición (a una persona o a todas las que hoy lo reciben, en el momento) y «Enviarme una prueba» (solo a quien aprieta, con «[PRUEBA]» en el asunto).
7. Durante una licencia no le llega, como los demás mails del sistema; la edición queda en el archivo.
8. El mail va completo: la infografía (adentro del mail y adjunta), la agenda y una tarjeta por propuesta con la cifra, el dataset, por qué hoy, el ángulo, la idea de placa, el texto para redes, los puntos, el borrador, lo que hay que validar y las fuentes; el botón «Ver la edición en el RPAD».
   Cada propuesta empieza con una franja «Propuesta N de M» (la principal, en el color del título del mail) y queda en su propio recuadro, con aire entre una y otra.
9. El SVG de la infografía también: el bot lo manda como una parte más, opcional; el RPAD lo guarda, lo deja descargar y lo adjunta al mail, sin dibujarlo.
10. El bot se llama «Datito» en todo lo que se ve, también en las ediciones ya archivadas. El nombre está en una sola constante del servidor y una de la página, porque es provisorio.
11. En el detalle de una edición nueva, la línea del correo habla solo del envío del RPAD; lo que el bot dice de su propio mail (ahora una copia para el usuario) queda en el JSON y no se muestra. Las ediciones anteriores siguen diciendo lo de hoy, con el nombre nuevo.
12. La tarjeta: «tipo diario» (la variante A de la maqueta): el nombre de la serie con doble línea y el número de edición, la fecha grande, la cantidad de propuestas, el título de la principal y el envío.
13. El número de edición («N.º 1», «N.º 2»…) va en la tarjeta, en el detalle y en el cuerpo del mail (no en el asunto).
14. Años y páginas: los años arriba, como hoy, y dentro de un año páginas de a 18.
15. La pastilla del envío en la tarjeta la ven todos los roles; administración ve además si a alguien no le llegó.
16. Fable hace la revisión final de la rama; lo demás, con los modelos de siempre.
17. Del lado del bot (consultado el 12/11; respondió que todo es factible): arranca a las 7:00; apenas la edición está lista manda la copia al usuario (aunque sea antes de las 8:00: la regla de las 8:00 era para el equipo, que ahora recibe el mail del RPAD), decide `correo.estado`, congela el paquete y lo archiva; una rutina aparte, a las 8:00 de los lunes, vuelve a mandar el mismo paquete si no tiene el recibo.
    Su mail pasa a ser solo una copia para el usuario («[Copia] …»), también un lunes feriado. El contrato del JSON no cambia por eso: `correo` sigue en el paquete y habla de la copia.
18. Las efemérides: cada ítem de `agenda` acepta una clave opcional `tipo`, `"evento"` o `"efemeride"` (si falta, `"evento"`), y el RPAD muestra la etiqueta «Efeméride» en la agenda del detalle y del mail.
19. Si un lunes la rutina del bot falla, se retoma la edición de ese lunes, con su fecha: la serie no se corre.

Maquetas aprobadas: `~/rpad-notas/dato-quincena-correo/maqueta/` (fuera del repo: tiene datos reales).

## 3. Enfoques

- **Dónde se configura:** (a) una pestaña en la página del dato de la quincena, o (b) una pestaña «Envíos automáticos» en Correos.
  Elegido (a): vive junto a lo que configura; (b) mezcla temas (Correos es de las Notas Digitales) y el aviso diario de la agenda ya lo elige cada persona en Mi espacio.
- **Cuándo se manda:** (a) un paso en la corrida de las 8:05 y otro en la de las 14:00, (b) una Tarea Cron nueva cada media hora, o (c) al llegar el POST.
  Elegido (a): sin cambio en cPanel, con el precedente del aviso diario de la agenda y de la firma digital; (b) suma una Tarea Cron y su alerta de «no corrió»; (c) manda fuera de las corridas y no deja reintentar con calma.
- **Dónde se guarda el estado del envío:** columnas en la edición, o tablas aparte. Elegido: tablas aparte (decisión de la sesión), porque la edición es inmutable y su fila solo se inserta.
- **La encargada de prensa:** una casilla suelta o una cuenta. Ya tiene cuenta de lectora: la lista es solo de usuarios.

## 4. Qué es y qué no

- Objetivo: que el mail del dato de la quincena salga del RPAD, siguiendo sus días hábiles, a una lista que se maneja en la página, sin que nadie lo reciba dos veces ni deje de recibirlo sin saberse.
- No cambia: el archivo (la recepción, la clave, la huella, la inmutabilidad, quién ve las ediciones), salvo la parte del SVG y una clave del recibo.
- No es: un editor de la edición, un aprobador de propuestas, un publicador. El mail sigue diciendo que son propuestas internas.
- Antiobjetivos: un mail repetido a las mismas personas por una corrida doble o un reintento; un mail de una edición vieja o de un piloto; un mail en un día no hábil (salvo un reenvío o una prueba a mano); que un lector o un colaborador vea las direcciones de correo o la lista; nombres o direcciones reales en el repositorio.

## 5. Cuándo sale

- Solo las ediciones **regulares**. Un piloto nunca sale solo (sí se le puede mandar una prueba).
- Al llegar (el 201 del POST), en la misma transacción, la edición queda **programada** si el envío automático está prendido y su `fecha_edicion` es de los últimos 13 días (`fecha_edicion >= hoy − 13`); si no, queda **no enviada**, con su motivo («apagado» o «vieja»).
  Un 200 o un 409 no programan nada. Las ediciones archivadas antes de esta entrega no tienen envío: nunca salen solas.
- Una corrida (8:05 o 14:00) manda las programadas si hoy es día hábil, el envío automático está prendido y `fecha_edicion <= hoy`.
  Si hay más de una programada, sale solo la de `fecha_edicion` más nueva; las otras quedan no enviadas («hay una más nueva»).
  Si al correr el envío automático está apagado, las programadas quedan no enviadas («apagado»): apagarlo cancela lo que esperaba, y prenderlo no manda lo de antes (para eso está «Reenviar»).
  Si la edición ya pasó los 13 días al momento de la corrida (por ejemplo, porque no hubo días hábiles), queda no enviada («vieja»).
- Un día no hábil la corrida no manda nada. El calendario es el de siempre (`leerCalendario`, una lectura por corrida); si la tabla de feriados no se pudo leer (`calendario.error !== null`), no manda y lo deja para la corrida siguiente, como el aviso diario de la agenda.
- Quién la recibe: la lista de la pestaña Correo **en la primera corrida que la manda** (ahí se arma una fila por persona). Quien se suma después no la recibe sola (se le puede reenviar).
  Al armarla se salta a quien está inactivo o no tiene un email válido; a quien está de licencia oficial ese día (`usuarios_licencias` sin anular, como `deLicenciaOficial`) se le anota «de licencia» y no se le reintenta.
  Si la lista está vacía, la edición queda no enviada («nadie en la lista»).
- Los reintentos: una persona cuyo envío falló se reintenta en cada corrida siguiente de un día hábil (la de las 14:00 y las de la mañana), hasta 3 intentos en total; al tercero queda «No se pudo enviar» y va un aviso a Correos → Estado.
- Las horas: «8:05» y «14:00» son las de las Tareas Cron; lo que se guarda y se muestra es la hora real del envío (`ahoraArgentina()`), HH:MM.

## 6. Los estados y lo que se muestra

- La edición (cuando tiene envío): `programada`, `enviada` (a todas las personas que correspondía), `parcial` (a alguna no le llegó después de los 3 intentos o quedó sin confirmar), `fallida` (a ninguna) o `no_enviada` (con su motivo).
- Cada persona: `pendiente`, `enviando` (reservada por una corrida), `enviado`, `fallido` (con sus intentos), `licencia` u `omitido` (inactiva o sin email).
  Un `enviando` que quedó así por un corte no se reintenta: pudo haber salido (el mismo criterio que el aviso diario). Se muestra «Sin confirmar» y cuenta como `parcial`.
- Los textos los arma el servidor (decisión de la sesión; ejemplos):
  - el detalle, para todos: «Enviada por correo el martes 10/11/2026 a las 8:05.», «Se envía hoy a las 8:05.», «Se envía hoy a las 14:00.», «Se envía el martes 24/11/2026 a las 8:05.», «No se envió: el envío automático estaba apagado.», «No se envió: llegó con más de 13 días.», «No se envió: hay una edición más nueva.», «No se envió: no había nadie en la lista.», «No se pudo enviar.»;
    mientras el envío automático está apagado, una programada dice «En espera: el envío automático está apagado.»;
    un piloto, «Los pilotos no se envían por correo.»;
    una edición sin envío (anterior a esta entrega), la línea de siempre con el nombre nuevo: «Correo enviado el 09/11/2026 a las 08:00, según Datito.», «Correo enviado según Datito, sin la hora.» o «Datito archivó esta edición sin que saliera el correo.».
  - la pastilla de la tarjeta, corta: «Enviada el mar 10/11», «Sale hoy a las 8:05», «Sale hoy a las 14:00», «Sale el mar 24/11», «En espera», «No se envió», «No se pudo enviar», «Piloto: no se envía»; para una edición sin envío, «Enviada por Datito el lun 09/11» si su correo salió, y sin pastilla si no.
    Administración ve además «Enviada a 3 de 4» cuando es `parcial`.
    Cada tipo con su color y su ícono (nunca solo el color): enviada en verde con el tilde, programada en cielo con el reloj, parcial, fallida y en espera en sol con el triángulo, no enviada y piloto en gris.
  - «Sale el …» y «Se envía el …» se calculan con el calendario y la hora de la consulta: antes de las 8:05 de un día hábil, «hoy a las 8:05»; de 8:05 a 14:00 de un día hábil, «hoy a las 14:00»; después, la mañana del siguiente día hábil (`proximoDiaHabil`), pero nunca antes de `fecha_edicion`.
- Cuando la edición le llegó a la gente por otro camino (decisiones de la sesión, después de la revisión de la spec):
  - una `no_enviada` («apagado» o «vieja») cuyo JSON dice que el bot mandó su correo (`correo.estado` `enviado`) muestra la línea del bot («Correo enviado el … según Datito.») y su pastilla: es el caso de las ediciones de la transición, cuando el bot todavía manda a todos;
  - una edición que el RPAD no mandó solo y que alguien reenvió a toda la lista dice «Reenviada por correo el martes 25/11/2026 a las 10:12.» (pastilla «Reenviada el mié 25/11»);
  - un reenvío a una sola persona no cambia la línea que ven todos: se ve en la caja del correo de administración.
- Mientras quedan reintentos, la edición sigue «enviada» para todos (con la hora del primer envío que salió) y administración ve «1 persona en reintento».
- En «Enviada a N de M» (administración), M son todas las personas del envío automático, también las de licencia, y N las que lo recibieron.

## 7. La base

Una migración nueva (`database/updates/migracion-dato-quincena-correo.sql`, con su vuelta atrás), también en `database/schema.sql`. Los nombres son de la sesión; el constructor puede ajustarlos.

- `dato_quincena_correo_config`: una fila (`id = 1`), con `envio_activo` (0 al crearla) y quién y cuándo lo cambió.
- `dato_quincena_destinatarios`: `usuario_id` (clave, FK a `usuarios`), quién y cuándo lo sumó. Vacía al crearla: las personas se tildan en la página (en el repositorio no va ninguna).
- `dato_quincena_correos`: una fila por edición con envío (`edicion_id` único, FK con CASCADE), `estado`, `motivo` (si no se envió), `enviada_at` (la hora del primer envío que salió), `ultima_corrida_at`.
- `dato_quincena_envios`: una fila por persona y envío: `edicion_id`, `usuario_id`, `email` (la dirección usada), `tipo` (`automatico`, `reenvio`, `prueba`), `estado`, `intentos`, `enviado_at`, `error` (un texto fijo, nunca el de nodemailer), `creado_por` (en un reenvío o una prueba).
  El automático es uno por edición y persona (único); los reenvíos y las pruebas, filas aparte.
- `dato_quincena_adjuntos.campo` suma `infografia_svg` al `ENUM`.
- `dato_quincena_ediciones` no cambia: su fila sigue siendo solo de `INSERT`.
- Las horas, en `DATETIME` con `ahoraArgentina()`, nunca `NOW()` (en el Docker local da UTC).

## 8. La corrida

- Un paso propio en la corrida de las 8:05 y otro en la de las 14:00, en un servicio nuevo, con un candado propio (`conBloqueo(fn, 'rpad_dato_quincena_correo')`, sin espera; ocupado no es un error), que recibe `{ hoy, ahora, calendario }` y nunca rechaza.
  En la de las 8:05 va al final (después del vencimiento de Mi espacio y antes de esperar el aviso diario), para darle unos segundos más al bot; respeta lo que fija `tests/mi-espacio-eventos-diario.test.js` (ningún `anotarEnLaUltimaCorrida` después de `resultados.diario = await diario`).
- Que no salga dos veces lo garantiza la base, no el candado: cada persona se reserva con un `UPDATE … WHERE estado IN ('pendiente', 'fallido') AND intentos < 3` y solo se manda si `affectedRows === 1`, como el aviso diario de la agenda.
- Un mail por persona: `sendEmail` con `to` siempre, `from` de `remitente()`, una sola vez por reserva.
- Sus errores suman a `resultados.errores` con su `tipo`; lo que se ve en Correos → Estado lo escribe en su propio registro (como el diario), no en la última corrida de las Notas.
- `tests/notificaciones.test.js` y `tests/permisos.test.js` llaman a la corrida de las 14:00 sobre la base del `.env`: tienen que tomar también este candado, como ya toman el del diario, para no mandar nada ni escribir.
- Las rutas manuales de administración que corren las mismas corridas (`/api/notificaciones/ejecutar` y `/cambios-pendientes`) corren también este paso, a la hora que sea: un día hábil manda lo que ya correspondía (decisión de la sesión; es una acción de una persona). Con la reserva, no repiten lo que salió.
- Si el envío automático está apagado, cualquier corrida (también la de un día no hábil) deja como no enviadas las que esperaban.

## 9. Reenviar y la prueba

- «Reenviar» (administración, en el detalle de una edición regular): a todas las personas que hoy están en la lista o a una de ellas.
  Sale en el momento, aunque no sea día hábil, el envío automático esté apagado o la persona esté de licencia (lo decide una persona). Mismo asunto y mismo contenido.
  Cada mail queda como una fila `reenvio`; el estado de la edición no cambia, salvo que una persona a la que no le había llegado ahora sí lo reciba (deja de contar como falla).
- «Enviarme una prueba» (administración, en cualquier edición, también un piloto): solo a la casilla de quien aprieta, con «[PRUEBA] » delante del asunto; no cuenta para el estado.
- «Reenviar» no se puede mientras el envío automático de esa edición no terminó (programada, o con alguna persona pendiente, reservada o en reintento): 409 «Esta edición todavía se está mandando sola: se puede reenviar cuando termine.», y en la página el botón no aparece. Así un reenvío nunca se cruza con un envío automático (decisión de la sesión).
- Los dos bajo el mismo candado: si una corrida está mandando, responden 409 con un texto fijo («Ahora se está mandando el dato de la quincena. Probá de nuevo en unos minutos.»).
- La respuesta dice a cuántas personas salió y a cuántas no, sin el texto de nodemailer.

## 10. El mail

- Asunto: «Dato de la Quincena - DD/MM/AAAA», con `fecha_edicion`. Remitente: `remitente()`. Un mail por persona.
- HTML con `marcoEmail` («celeste institucional», tablas y estilos en línea, sin emojis), como la maqueta aprobada:
  el título «Dato de la Quincena - DD/MM/AAAA», debajo «Edición N.º N» y la cantidad («4 propuestas de comunicación que armó Datito. Son internas: todavía no están aprobadas ni publicadas.»);
  «Buen día, <primer nombre>.» (el primer nombre de `nombre_completo`, como `notasParaFirmarTemplate`);
  la infografía en línea (`cid`) con su pie;
  «Agenda de la quincena» si hay, con la etiqueta «Efeméride» en las que lo son;
  una tarjeta por propuesta, en su orden, con su franja («Propuesta 1 de 4» y «Principal» en la principal);
  el botón «Ver la edición en el RPAD» (`RPAD_URL`/dato-quincena.html?id=N);
  y una nota al pie: dónde están el texto del bot, los cálculos y la edición completa, por qué le llega y a quién avisar para dejar de recibirlo.
- Todo texto de la edición va escapado y con sus saltos de línea como `<br>`; una dirección es enlace solo si es `https://`.
- Texto plano propio, armado por el servidor con lo mismo (no el `correo_texto` del bot, que trae el saludo de los destinatarios de antes).
- Adjuntos: la infografía PNG en línea (con `cid`), la misma PNG como archivo y el SVG si llegó, con los nombres del manifiesto.
- `tests/email-diseno.test.js` suma el caso nuevo (un solo `<!DOCTYPE>`, sin `<style>` ni emojis).

## 11. La recepción: el SVG y el recibo

- `infografia_svg`: una quinta parte, opcional, como archivo; en el manifiesto, `mime: 'image/svg+xml'`, solo si llegó (`validarAdjuntos`).
  Tope de 1 MB (lo sugirió el bot: el suyo pesa unos 7 KB); el multipart pasa a `files: 5`, `parts: 6` y el tope del pedido suma lo mismo.
  El contenido (lo sugirió el bot y lo decidió la sesión: se adjunta a un mail y se descarga, nunca se dibuja): UTF-8 válido sin el carácter nulo, cuyo primer elemento es `<svg` (después de, como mucho, la declaración XML, comentarios y espacios; el del bot empieza directo con `<svg xmlns=…>`), sin `<script`, sin atributos `on…=`, sin `<foreignObject` y sin referencias externas (un `href` o `xlink:href` que no empieza con `#`, un `@import` o un `url(` que no empieza con `#`).
  Un SVG que no cumple da 422 con su campo, como un PNG que no es PNG.
- La huella: el renglón del SVG se suma solo si llegó, así la huella de un paquete sin SVG es la de siempre y un reenvío de algo ya archivado sigue dando 200.
- La descarga: `GET …/archivos/infografia_svg`, con `Content-Type: image/svg+xml` y `Content-Disposition` de adjunto. En el detalle, «Infografía editable», «SVG · 84 KB», sin «Ver».
- El recibo (201 y 200) suma `envio`, con las dos formas que pidió el bot: `{ estado, programado_at, texto }`.
  `estado` es el de la sección 6 al momento del recibo; `programado_at`, solo si está programada, la corrida en que sale como instante con zona (`'2026-11-24T08:05:00-03:00'` o las 14:00); `texto`, el de la sección 6 («Se envía el martes 24/11/2026 a las 8:05.», «Los pilotos no se envían por correo.», «No se envía por correo: el envío automático está apagado.», «No se envía por correo: tiene más de 13 días.»).
  Un 200 lo arma con el estado de ese momento («Enviada por correo el …» si ya salió).
- La agenda: cada ítem acepta la clave opcional `tipo` (`'evento'` o `'efemeride'`; otro valor, 422); sin ella, es un evento. El detalle suma `etiqueta` a cada ítem («Efeméride» o null), y la página y el mail la muestran como una etiqueta suave.
- `schema_version` sigue en '1.0': el SVG y `tipo` son opcionales y lo viejo sigue valiendo (de acuerdo con el bot). El documento para el bot se llama «contrato v1.2».

## 12. Las lecturas

- La lista (`GET /api/dato-quincena/ediciones?anio=`, todos los roles) suma a cada edición, con los textos armados:
  `numero` («N.º 3» en una regular: cuántas regulares hay con esa fecha o anterior; null en un piloto),
  `fecha_partes` (`{ dia: 'Lunes', fecha: '9 de noviembre', anio: 'de 2026' }`),
  `cantidad` («4 propuestas») y `envio` (`{ tipo, texto }` de la pastilla, con el texto de administración si quien pide es de administración; null si no lleva pastilla).
  El título de la principal sigue en `principal.titulo`. La lista sigue siendo de un año entero: la página la parte en páginas.
  Si una regular atrasada llega después, los números de las posteriores corren (decisión de la sesión: se calculan al leer).
- El detalle suma `numero` y cambia `correo` por la línea de la sección 6; `archivos` suma el SVG. Sin direcciones ni nombres de quienes lo recibieron.
- Solo administración (`adminOnly`):
  - `GET /api/dato-quincena/correo`: el envío automático, las próximas ediciones estimadas (cada 14 días desde la última regular, con el día en que saldrían y el motivo si se corren: «no es hábil el lunes 23/11, Día de la Soberanía Nacional») y las personas activas (nombre, cargo, rol, email, si lo recibe y, si está de licencia hoy, hasta cuándo).
  - `PUT /api/dato-quincena/correo/envio` (`{ activo }`, el `true` literal prende) y `PUT /api/dato-quincena/correo/destinatarios` (`{ usuarios: [ids] }`, solo usuarios activos; uno que no existe o está inactivo da 400 con un texto fijo).
  - `GET /api/dato-quincena/ediciones/:id/correo`: el resumen y cada persona con su estado («Enviado el 10/11 a las 8:05», «No se envió: de licencia», «No se pudo enviar (3 intentos)», «Sin confirmar»), los reenvíos y las pruebas, y la lista de hoy para el diálogo de «Reenviar».
  - `POST /api/dato-quincena/ediciones/:id/reenvios` (`{ a: 'todas' }` o `{ a: <id de una persona de la lista> }`) y `POST /api/dato-quincena/ediciones/:id/prueba`.
  - Un id que no es entero positivo o no existe, 404; un 500, un texto fijo por operación.
- `tests/permisos.test.js` suma las rutas nuevas (sin sesión 401, lector y colaborador 403).

## 13. La página

- Dos pestañas, «Ediciones» y «Correo», solo para administración (el patrón de Proyectos y de Correos: `tablist`, flechas, Home y End, la pestaña en el hash `#correo`, junto a `?id` y `?anio`); los demás roles ven la página sin pestañas, como hoy.
- **Ediciones**: los años arriba (como hoy), la cantidad del año a la derecha, la grilla de tarjetas de a 3 (2 debajo de 960 px, 1 debajo de 560 px) y las páginas de a 18 abajo («Anterior», «Página 1 de 2», «Mostrando 1–18 de 27», «Siguiente»; con una sola página, nada), con la página en la dirección (`&pagina=N`); al cambiar de año, la página 1.
- **La tarjeta «tipo diario»**: arriba «El dato de la quincena» y el N.º (o la marca «Piloto N»), con una doble línea; el día de la semana, la fecha grande («9 de noviembre») y «de 2026»; una línea fina; la cantidad de propuestas; el título de la principal (hasta 3 renglones); y la pastilla del envío.
  La tarjeta entera abre el detalle (un solo enlace, en la fecha, que se estira a toda la tarjeta), con el foco visible en la tarjeta.
  Sin miniatura: la lista ya no baja las infografías.
- **Correo**: «Envío por correo», con el interruptor «Envío automático» (se guarda al cambiarlo; al prenderlo, una confirmación que dice qué va a pasar), la regla en dos oraciones y «Las próximas ediciones»; y «Quién lo recibe», con la tabla de personas activas (persona y cargo, rol, correo, «Lo recibe»), «Lo reciben N personas.» y «Guardar».
- **El detalle**: el número de edición junto a la fecha; la línea del correo de la sección 6; en «Archivos», el SVG.
  Para administración, debajo de «Archivos», la caja «Correo» con el resumen, una fila por persona, «Reenviar…» (un diálogo: a todas o a una persona de la lista, con el aviso de que sale en el momento) y «Enviarme una prueba».
- La bajada: «Las propuestas de comunicación que arma Datito cada dos lunes, tal como llegaron. Son internas: guardarlas acá no las aprueba ni las publica. El RPAD las manda por correo a las personas de la lista.»
- Las reglas de siempre de la página: lo que arma HTML es puro; todo texto del servidor por `Utils.escapeHtml`; «Guardar» y los botones que mandan deshabilitados hasta la respuesta; el foco visible; nada se mueve con `prefers-reduced-motion`; ninguna clase con `ad-`; la versión de `dato-quincena.js` sube con su constante en `tests/paginas.test.js`.
- Correos → Estado suma una línea del dato de la quincena (la última corrida y su resultado), armada por el servidor (`verEstado`), como la del aviso diario; `correos.js` sube su versión.
  El aviso de «no le llegó» (decisión de la sesión) no depende de la última corrida: sigue mientras la última edición que salió tenga una persona que no la recibió después de los 3 intentos, hasta que un reenvío le llegue o salga una edición más nueva.

## 14. El nombre del bot

- «Datito» en una constante del servidor (`datoQuincenaReglas.js`), que usan los textos del detalle, de la lista y del mail, y en una de `dato-quincena.js`, que usan los textos de la página (la bajada la escribe el script, para que el HTML no repita el nombre; la descripción de la página no lo nombra).
- Se renombra todo lo que se ve; los documentos vigentes (`docs/temas/`) también. Las specs viejas quedan como están: son historia.

## 15. Seguridad y privacidad

- La configuración, la lista, las direcciones y el estado por persona salen solo a administración; la lista de ediciones y el detalle no los traen.
- `sendEmail` siempre con `to`; con `EMAIL_SOLO_A` (en local) todo va a Mailpit o a las casillas de prueba.
- Ningún texto de nodemailer en una respuesta ni en la página: a la consola, con el código del error.
- El repositorio no lleva ninguna persona real: las migraciones crean las tablas vacías; los tests usan usuarios y direcciones inventados.
- El token del bot sigue sirviendo solo para el POST.

## 16. Pruebas

- Las reglas puras (cuándo sale, qué texto, quién, el número, las partes de la fecha, el SVG y cada cosa que rechaza, la huella con y sin SVG, `tipo` en la agenda, `envio` del recibo), con un hoy y un ahora fijos.
- El servicio de la corrida contra su base de prueba y Mailpit, con un hoy fijo y el calendario de la precarga: un lunes feriado, un 07/12 que sale el 09/12, la llegada después de las 8:05 que sale a las 14:00, una corrida doble que no repite, un candado ocupado, una falla y sus 3 intentos, una licencia, el interruptor apagado, una vieja, dos programadas, una lista vacía y la caída de la tabla de feriados.
- La API (permisos, validaciones, reenviar y prueba, el recibo con `envio`, el SVG), la página en el `vm` (las tarjetas, las páginas, las pestañas, la caja del correo) y el diseño del mail.
- Ningún test nuevo llama a `/api/cron/*`; los dos que ya lo hacen toman el candado nuevo.
- La suite completa, en verde, antes del merge.

## 17. Documentación

- `docs/temas/dato-quincena.md` se parte: el archivo sigue ahí y el correo va en `docs/temas/dato-quincena-correo.md` (nace un tema: una fila en el mapa de `CLAUDE.md` y el glob de `.claude/rules/dato-quincena.md`, que pide permiso).
- `calendario-y-corridas.md` suma el paso; `base-de-datos.md`, las tablas; `despliegue.md`, el kit y la transición.

## 18. El bot: lo que se le consultó y lo que contestó

La consulta (`~/rpad-notas/dato-quincena/para-grok/datito-1-en-que-andamos-y-dudas.md`) y sus respuestas del 12/11 (`~/rpad-notas/dato-quincena/grok/respuestas-correo/`) quedan fuera del repositorio.
Todo le resultó factible; no cambia nada de su rutina hasta que el usuario le avise que el contrato nuevo está en producción.
- La copia: asunto «[Copia] Propuestas El dato de la quincena – DD/MM/AAAA» y una primera línea que dice que al equipo se lo manda el RPAD (con `envio.texto` del recibo, si lo tiene). `correo_texto` es el texto de esa copia, sin nombres ni direcciones de otras personas.
- El horario: el de la decisión 17. Calcula la edición lista entre las 7:15 y las 7:45.
- El SVG: de unos 7 KB, sin imágenes, enlaces, scripts ni fuentes embebidas (los textos quedan editables; el PNG es la versión fiel).
- Los rebotes: los sigue mirando, solo para su copia.
- La transición: cambia su rutina cuando el usuario le escriba «desde la edición del DD/MM, copia solo a mí».
Con la rama terminada se escribe el «contrato v1.2» para el bot, que coincide con el código, sin secretos.

## 19. Despliegue y transición

- La migración antes del código; el envío automático nace apagado y la lista vacía.
- El usuario tilda a las cuatro personas, se manda una prueba y la mira.
- Se elige un lunes: desde esa edición el bot manda la copia solo al usuario, y el usuario prende el envío automático antes de las 8:05 de ese día. Así nadie recibe dos mails ni ninguno.
- Vuelta atrás: el código anterior y la vuelta atrás de la migración, en el orden de `despliegue.md`; un SVG ya guardado se pierde con ella (el kit lo dice).

## 20. Lo que queda para el plan

Los nombres de tablas, columnas, funciones y archivos; el orden de las tareas; el detalle de los textos que no están acá, con el estilo de los de la sección 6; cómo se ve la confirmación del interruptor; y la forma de los recibos de «Reenviar» y de la prueba.
