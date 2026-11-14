# El dato de la quincena: el correo

El mail «Dato de la Quincena» lo manda el RPAD, no el bot, siguiendo sus días hábiles: cuándo sale, a quién, con qué estados y textos, la corrida, Reenviar y la prueba, el mail, la pestaña Correo y la transición.
El archivo de las ediciones (el POST de Datito, la clave, la huella, las lecturas) está en `docs/temas/dato-quincena.md`.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-11-12-dato-quincena-correo-design.md`
- `docs/superpowers/specs/2026-11-14-dato-quincena-v1-3-design.md` (la pastilla Repite y la caja de la repetición)

## Archivos

datoQuincenaCorreoReglas (puro: cuándo sale, los estados y todos los textos del detalle, de la pastilla y del recibo, la caja de administración, las próximas ediciones, los avisos de Correos → Estado y `modeloDelMail`);
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
- El mail va a personas con cuenta, elegidas por administración en la pestaña Correo, sin roles nuevos ni casillas sueltas.
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
- Quién la recibe: la lista de la pestaña Correo **en la primera corrida que la manda**, que arma una fila por persona.
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
- El recibo del POST (`envio`) usa los mismos textos; su forma, en `docs/temas/dato-quincena.md`.
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
  `GET /api/dato-quincena/correo` (el envío, las próximas ediciones y las personas activas con su email, si lo reciben y, de licencia, hasta cuándo);
  `PUT /api/dato-quincena/correo/envio` (`{ activo }`; solo el `true` literal prende y algo que no es un booleano da 400);
  `PUT /api/dato-quincena/correo/destinatarios` (`{ usuarios: [ids] }`; solo usuarios activos, uno inexistente o inactivo da 400; guardar conserva `agregado_at` de quienes siguen);
  `GET /api/dato-quincena/ediciones/:id/correo` (el resumen, cada persona con su estado, los reenvíos y las pruebas, y la lista de hoy para el diálogo);
  `POST /api/dato-quincena/ediciones/:id/reenvios` (`{ a: 'todas' }` o `{ a: <id de una persona de la lista> }`);
  `POST /api/dato-quincena/ediciones/:id/prueba`.
  Un id que no es entero positivo o no existe da 404 en JSON; un 500 dice un texto fijo por operación.
- Las próximas ediciones de `GET /correo` son una estimación: cada 14 días desde la última regular (`CADENCIA`; sin ninguna, desde `PRIMERA_EDICION`), con el día en que saldrían y el motivo si se corren («no es hábil el lunes 23/11, Día de la Soberanía Nacional»).

## El mail

- Asunto «Dato de la Quincena - DD/MM/AAAA», con la `fecha_edicion` también si sale corrido; remitente `remitente()`.
  Un mail por persona, con `marcoEmail` (tablas y estilos en línea, un solo `<!DOCTYPE>`, sin `<style>` ni emojis: lo controla `tests/email-diseno.test.js`).
- Contenido: el título y debajo «Edición N.º N» y la cantidad («4 propuestas de comunicación que armó Datito. Son internas: todavía no están aprobadas ni publicadas.»); «Buen día, <primer nombre>.»;
  la infografía en línea (`cid`) con su pie;
  «Agenda de la quincena», con la etiqueta «Efeméride» en las que lo son;
  una tarjeta por propuesta, con su franja («Propuesta 1 de 4», «Principal» en la principal) y la cifra, el dataset, la repetición si hay, por qué hoy, el ángulo, la idea de placa, el texto para redes, los puntos, el borrador, lo que hay que validar y las fuentes;
  el botón «Ver la edición en el RPAD» (`RPAD_URL/dato-quincena.html?id=N`);
  y una nota al pie con dónde están el texto del bot, los cálculos y la edición completa, por qué le llega y a quién avisar para dejar de recibirlo.
- Las etiquetas van en pastillas, menos «Principal», que va en la franja: «Validar» en ámbar, «Agenda» en celeste, «Efeméride» en la suave de la agenda (también en una propuesta) y «Repite» blanca con un borde de 1 px `#76879F` (con un píxel menos de relleno: mide lo mismo que las otras); cada una dice su nombre.
- La repetición (`docs/temas/dato-quincena.md`), en un recuadro neutro (fondo `#F4F7FA`, borde `#DAE3ED`) después del renglón de la foto y antes de «Para validar»: el `texto` en negrita y abajo el `motivo`.
  El texto es un enlace a `RPAD_URL/dato-quincena.html?id=N` solo con un `id_edicion` entero positivo, subrayado a diferencia de los demás enlaces del mail: el texto sin enlace también es negrita y el color solo no los distingue.
  La corrida arma el detalle con las ediciones previas (`edicionesPreviasSinFallar`), como la página; `modeloDelMail` copia cada propuesta del detalle, así que la repetición llega sola.
  Si las previas no se pueden leer, el mail sale igual en esa corrida, con la repetición sin enlace.
- El nombre del bot llega a la plantilla por el modelo (`modeloDelMail`): la plantilla no lo escribe.
- Todo texto de la edición va escapado y con sus saltos como `<br>`; una dirección es enlace solo si es `https://`.
- El texto plano lo arma el servidor con lo mismo: no es el `correo_texto` del bot, que trae el saludo de otros destinatarios.
  La repetición va en él como un bloque «<texto>\n<motivo>», en el mismo lugar que en el HTML y sin el enlace.
- Adjuntos: la infografía PNG en línea, la misma PNG como archivo y el SVG si llegó (`datoQuincenaTemplate(modelo, { conSvg })`), con los nombres del manifiesto.
- Sin direcciones en lo que se muestra: ni la lista de ediciones ni el detalle traen emails ni nombres de quienes lo reciben; el texto de nodemailer, que puede traer la dirección, va a la consola solo con su código.

## La página

- Pestañas «Ediciones» y «Correo» para administración (`tablist`, flechas, Home y End; `#correo` en la dirección, junto a `?id`, `?anio` y `&pagina`); los demás roles ven la página sin pestañas.
  La lista en tarjetas «tipo diario» y sus páginas de a 18 están en `docs/temas/dato-quincena.md`; la pastilla la ven todos y administración ve además si a alguien no le llegó.
- Correo: «Envío por correo», con el interruptor «Envío automático» (se guarda al cambiarlo; al prenderlo, una confirmación que dice qué va a pasar), la regla en dos oraciones y «Las próximas ediciones»;
  y «Quién lo recibe», con la tabla de personas activas (persona y cargo, rol, correo, «Lo recibe»), «Lo reciben N personas.» (`textoDeLosQueReciben`, con una copia en la página atada por un test de paridad para el conteo en vivo) y «Guardar».
- El detalle: el N.º junto a la fecha, la línea del correo y, en «Archivos», la infografía editable.
  Para administración, debajo de «Archivos», la caja «Correo» con el resumen, una fila por persona, «Reenviar…» (un diálogo: a todas o a una persona de la lista, con el aviso de que sale en el momento) y «Enviarme una prueba».
  Cualquier respuesta de Reenviar cierra el diálogo y vuelve a leer la caja.
- Las reglas de siempre: lo que arma HTML es puro; todo texto del servidor por `Utils.escapeHtml`; los botones que mandan, deshabilitados hasta la respuesta; sin `ad-`; `VERSION_DATO_QUINCENA` en `tests/paginas.test.js`.

## La transición

- La migración va antes del código; el envío nace apagado y la lista, vacía.
- El orden, el mismo que sigue el kit:
  1. Desplegar con el envío automático apagado.
  2. Tildar a las personas en la pestaña Correo y guardar.
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
