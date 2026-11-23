# El dato de la quincena: la principal del equipo

Datito marca una sola propuesta de cada edición como `Principal`; el equipo vota cuál es la suya, y las dos conviven en el RPAD.
Las personas de una lista que arma administración ordenan todas las propuestas, gana la que suma más puntos y la votación cierra sola.
Se ve en General, en Propuestas, en la lista y en Mi espacio, y el mail de las 8:05 aclara que su principal es la de Datito.
El contrato con Datito y el archivo son los de `docs/temas/dato-quincena-contrato.md` y `docs/temas/dato-quincena.md`.
La lista de quienes votan se arma en la pestaña «Envío y votación» (`docs/temas/dato-quincena-correo.md`).
La frase y el recuadro de la principal están en el correo (abajo, «El mail»).

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-11-21-dato-quincena-principal-equipo-design.md` (la elección a mano, que ya no existe)
- `docs/superpowers/specs/2026-11-23-dato-quincena-principal-votacion-design.md` (la votación)

## Archivos

datoQuincenaVotacionReglas (puro: el cierre, los votos vigentes, los puntos y el desempate, `votacionDelDetalle`, `votacionDeLaLista`, los ítems de Mi espacio, `modeloDelMailDeLaVotacion`, y `votacionParaElDetalle` y `votacionParaLaLista`, que arman con lo leído lo que reciben el detalle, la lista y el mail);
datoQuincenaVotacionDatos (las consultas: `crearLaVotacion`, `leerVotaciones`, `guardarVoto`, el sellado y lo de Mi espacio);
datoQuincenaVotacion (el sellado y el mail del resultado, con su candado `BLOQUEO_VOTACION`);
datoQuincenaVotacionController (`votar`);
datoQuincenaDatos (`guardarEdicion` crea la votación; `listarEdiciones` la lee de todas las ediciones con una consulta más);
datoQuincenaReglas (`detalleDeLaEdicion`, `itemDeLaLista` y la principal que cuenta) y datoQuincenaController (`ver` y `listar` miran a quien pide);
`routes/index.js` (`PUT /api/dato-quincena/ediciones/:id/voto` y la ruta vieja de la principal);
emailTemplates (`votacionResultadoTemplate` y la frase y el recuadro de `datoQuincenaTemplate`);
dato-quincena.html y dato-quincena.js (la franja, el diálogo «Tu orden», las marcas y la tarjeta);
`database/updates/migracion-dato-quincena-votacion.sql` y su rollback (las cuatro tablas, en `docs/temas/base-de-datos.md`).

## La regla

- En el RPAD conviven dos principales: la de Datito, la del JSON, y la del equipo.
  Son dos cosas distintas y no se mezclan: lo archivado de Datito no cambia nunca, y lo del equipo se calcula al leer con los votos.
- Decisión: la ganadora no se escribe en ninguna tabla.
  Se calcula al mirar, con los votos anteriores al cierre, y pasado el cierre el servidor rechaza votos: no hace falta un paso que cierre a las 12:00.
  Es el criterio del correo, que calcula «Sale el …» al leer.
- Quién vota: la lista que arma administración (`dato_quincena_votantes`); entra cualquier usuario activo, de cualquier rol.
  Las dos personas de la Dirección están siempre, pero en el sistema son dos personas más de la lista: no hay marca de «la Dirección».
- Decisión: cada edición vota con la foto de la lista de cuando llegó (`dato_quincena_votacion_personas`, solo personas activas).
  Quien se suma a la lista después vota desde la edición siguiente; contar a quienes están al cierre cambiaría «Votaron 2 de 3» si la lista cambia después.
- Que la fila de `dato_quincena_votaciones` exista es lo que dice que la edición se vota: las ediciones de antes no la tienen.
  Se crea en la transacción del POST de Datito, en regulares y pilotos; un 200 repetido o un 409 no crean nada.
  Con la lista vacía la votación existe igual y termina como «nadie votó».
- Cómo: cada persona ordena **todas** las propuestas; con N propuestas, el 1.º puesto da N puntos y el último, 1.
  Gana la que suma más.
  Desempate: si la de Datito (la marcada `principal` o, si ninguna, la primera) está entre las empatadas, gana; si no, la de `orden` más bajo.
  Sin votos queda la de Datito y el texto dice «nadie votó», no «por desempate».
- Cierre: las 12:00 del primer día hábil en que la edición ya estaba en el RPAD a las 8:05, y nunca antes de su `fecha_edicion`.
  Con D el mayor entre `fecha_edicion` y el día de la llegada (hora argentina, de `recibida_at`): si llegó ese día a las 8:05 o después, D pasa al siguiente; cierra el primer día hábil desde D.
  Es independiente del envío real: un envío apagado, un mail que falló o un piloto cierran igual.
- Hasta el cierre cada persona cambia su orden cuando quiera.
  Mientras está abierta no se ve el orden de nadie ni cómo va, y nadie puede acomodar su voto al de otra persona.
  Cerrada, se ve para todos los roles quién votó qué: el Seguimiento ya muestra a todos quién propuso y quién aprobó cada cambio.
- Decisión: sin calendario (`calendario.error !== null`) y sin sellar, el cierre no se puede saber con certeza.
  Con los 9 fijos podría dar cerrada un día que la tabla de feriados extiende, y al volver la tabla se reabriría.
  Las tres lecturas (detalle, lista y Mi espacio) la toman como abierta y sin resultado: `cierre` dice «No se pudo leer el calendario: el cierre se confirma en unos minutos.», `puede_votar` es false, el PUT no guarda y Mi espacio no muestra el ítem.
  Una llegada que no se puede leer, sin sellar, se trata igual (`estadoDeLaVotacionLeida`).
- Decisión: el sellado deja guardado el cierre (`cierre_at`, `sellada_at`).
  Desde ahí la votación ya no depende del calendario: un feriado cargado después para un día que ya pasó no la reabre ni cambia su resultado.
- Un voto cuyo `orden` no es una permutación de las propuestas de la edición no se guarda; si llegara uno a la base por un SQL a mano, no cuenta y vale el anterior.
- Los pilotos se votan igual, con el mismo cierre, pero no mandan el mail del resultado.
- No hay corrección a mano del resultado, ni un interruptor entre votar y designar: hay un solo método.

## La base

Las cuatro tablas están en `docs/temas/base-de-datos.md`.
- `dato_quincena_votos`: una fila por cada vez que alguien guarda su orden, como texto «2,1,4,3».
  El RPAD nunca hace un UPDATE ni un DELETE: el vigente de cada persona es su voto de mayor `id` anterior al cierre y con un orden válido.
- Decisión: el voto se ata a la fila de la foto, no al usuario.
  Si alguien borrara una cuenta con un SQL a mano (el RPAD no borra usuarios), la fila queda con `usuario_id` en null pero sigue juntando sus votos, y una votación cerrada no cambia; su nombre sale «Una persona que ya no está».
- `votado_at` y el resto de las horas son hora argentina (`ahoraArgentina()`), no `NOW()`.
- La migración es aditiva y repetible y va antes que el código: sin las tablas, la lista, el detalle y el POST de Datito dan error.
  Su vuelta atrás va antes que la de la principal del equipo y las del correo y del archivo (el orden, en `docs/temas/despliegue.md`).

## Votar

- `PUT /api/dato-quincena/ediciones/:id/voto`, con `authMiddleware` y cualquier rol: el permiso es estar en la foto de esa edición, no el rol.
  El cuerpo es `{ orden: [2, 1, 4, 3] }`, el `orden` de cada propuesta de la más querida a la menos.
- El orden de los controles, cada uno antes del siguiente:
  1. un id que no pasa `idPositivo` o una edición que no existe: 404 «No existe esa edición.»;
  2. una edición sin votación: 409 «Esta edición no se vota.»;
  3. quien pide no está en la foto: 403 «No estás en la lista de quienes votan esta edición.»;
  4. la votación ya cerró: 409 «La votación ya cerró.»;
  5. un `orden` que no es una lista con cada propuesta de la edición una sola vez: 400 «Ordená todas las propuestas de la edición.»;
  6. sin calendario y sin sellar: 500 «No se pudo guardar tu orden. Probá de nuevo en unos minutos.».
- Todo va en una transacción con la fila de la votación bloqueada (`FOR UPDATE`): el cierre se mira adentro, con la hora de ese momento, y un voto aceptado siempre cuenta.
- Si el orden es el último que guardó esa persona, no escribe; si no, inserta una fila.
  `guardarVoto` compara con el último voto de la persona (el de mayor `id`), no con el vigente: solo difieren si alguien metió un voto inválido por SQL, y entonces se inserta una fila más, que es inofensivo.
- Responde 200 con `{ cambio }` y el texto ya armado: «Guardamos tu orden. Lo podés cambiar hasta el martes 24/11 a las 12:00.» o «Tu orden ya era ese.».
- Un 500 dice un mensaje fijo; en la consola, solo el código y el mensaje.
- El sellado toma solo la fila de la votación, y `guardarVoto` toma esa y después la de la edición: el orden de los candados no se cruza.

## Lo que manda el servidor

- `GET /api/dato-quincena/ediciones/:id`: `principal_datito` no cambia.
  `principal_equipo` mantiene su forma (`orden`, `coincide`, `rotulo`, `pastilla`, `marca`, `resumen`, `cifra_clave`, `quien`):
  - en una edición de antes, la elección a mano vigente o «todavía no la eligió.»;
  - abierta, `orden` null y `resumen` «se vota hasta el martes 24/11 a las 12:00.» (sin calendario, «se está votando.»), sin cifra ni `quien`;
  - cerrada, la ganadora: «la misma de Datito (propuesta N).» o «Propuesta N · <título>» con su `cifra_clave`, y `quien` null.
- Decisión: `ver` mira a quien pide (`req.user`): el detalle deja de ser igual para todos los roles.
  Lo de quien mira va en la clave `votacion`; todo lo demás sigue igual para todos.
- `votacion`, al final del detalle, es null en una edición de antes y, si no:
  - `estado`, `abierta` o `cerrada`; `resumen`; `cierre`, «Se vota hasta el martes 24/11/2026 a las 12:00.» o «La votación cerró el …»;
  - `participacion`, igual para todos: «Ya votó 1 de 3: <nombre>. Faltan los votos de <nombre> y <nombre>.», «Ya votaron 3 de 3.», «Todavía no votó nadie de 3.»; cerrada, «Votaron 2 de 3: no votó <nombre>.», «No votó nadie de 3.»; sin votantes, «No había nadie en la lista para votar.»;
  - para quien mira: `puede_votar` (está en la foto y está abierta, con calendario), `falta_tu_voto`, `tu_orden` (`[{ puesto: '1.º', orden, texto }]` o null; null al cerrar) y `dialogo`, el texto del diálogo;
  - cerrada, `resultado`: `orden`, `como` (`puntos`, `desempate` o `nadie`), `texto`, la `regla` y la `tabla` (null sin votos; si no, `votantes` y `filas` de más a menos puntos, cada una `{ orden, texto, de_datito, puestos, puntos, gana }`).
- Decisión: `falta_tu_voto` es `puede_votar` sin voto, y sin calendario es false, también en la lista: una pastilla «Falta tu voto» sin botón para votar confunde.
- `resultado.texto`: «Ganó por puntos: 10, contra 7 de la que siguió.», «Ganó por desempate: empató con la 2, con 7 puntos, y es la de Datito.» (o «…y tiene el número más bajo.»), «Nadie votó: quedó la de Datito.».
- La lista: cada edición muestra la principal que cuenta; abierta, la de Datito («Principal de Datito»); cerrada, la ganadora («Principal del equipo»); una de antes, la elección a mano si hay y si no la de Datito.
  Suma `votacion`, null salvo abierta: `{ texto: 'Se vota hasta el mar 24/11 a las 12:00', falta_tu_voto }`.
  `listarEdiciones` lee las votaciones, sus fotos y sus votos de todas las ediciones de la página sin una consulta por edición.

## Las ediciones de antes

- Las que llegaron antes de la votación conservan lo que se eligió a mano (`dato_quincena_principal_equipo`, una fila por elección, la vigente la de mayor `id`) o quedan sin elegir.
  La franja las muestra sin botones para nadie.
- `PUT /api/dato-quincena/ediciones/:id/principal-equipo` queda solo para una pestaña abierta con la página anterior: después del 404 de una edición que no existe, siempre 409 «La principal del equipo ahora se vota: volvé a cargar la página.», sin escribir nada.
- La tabla se sigue leyendo para esas ediciones y no se escribe más.

## La página

Los textos los trae el servidor y la página los imprime, todos por `Utils.escapeHtml`.

- General: arriba de la portada, a lo ancho, una franja con «Principal del equipo:» y el `resumen`.
  - Abierta: debajo, `participacion` y, si hay, «Tu orden» con `tu_orden`.
    Con `falta_tu_voto`, la pastilla «Falta tu voto» (con el triángulo) y, con `puede_votar`, el botón «Votar» o, con voto, «Cambiar mi orden».
    Quien no está en la foto ve «Votan las personas de la lista que arma administración.», sin botón.
  - Decisión: sin calendario, también quien está en la lista ve ese texto; la página no distingue sin comparar textos y el caso dura minutos.
  - Cerrada: la `cifra_clave`, el `resultado.texto` en negrita, `participacion` con el `cierre`, y «Ver la propuesta», que lleva a la ganadora en Propuestas.
    Plegado, «Ver los votos» con la `regla` y la tabla (Propuesta, una columna por quien votó, Puntos): la ganadora lleva fondo y «Ganó» con un tilde, y la de Datito su marca; el color no es lo único.
- Decisión: la portada es la de la propuesta de Datito, con su infografía, y se rotula «La principal de Datito»: la infografía es la suya, y al lado de otra propuesta quedaría desparejo.
- «Ver las N propuestas» lleva a la del equipo si ya cerró y, si no, a la de Datito.
- El diálogo «Tu orden» lo abren «Votar» y «Cambiar mi orden», de la franja y de cada propuesta.
  Es HTML estático de `dato-quincena.html`, como el de «Reenviar»: velo, Escape, foco, y Tab y Mayúscula+Tab no salen.
  - El texto es el `dialogo` del servidor.
  - Una fila por propuesta, en el orden de la edición: un botón con `aria-pressed`, su puesto («1.º» o un punto), «Propuesta N» y el título, y la marca de Datito en la suya.
    Tocar una sin puesto le da el siguiente; tocar una con puesto se lo saca y las de atrás suben; «Empezar de nuevo» saca todos.
  - Decisión: sin voto arranca sin ningún puesto, para no empujar a dejar el orden de Datito.
  - Una región viva dice «Tocá primero la que más querés trabajar.», «Te faltan 2.», «Listo: ya están las 4.» o, con una sola propuesta, «Listo: ya está la única.».
  - «Guardar mi orden» está deshabilitado hasta que todas tienen puesto y hasta la respuesta.
  - Un error muestra el mensaje del servidor, también en la región viva del diálogo: con `aria-modal`, la de la página no se anuncia.
    Un 409 («La votación ya cerró.», «Esta edición no se vota.») o un 403 («No estás en la lista…») cierra el diálogo y vuelve a pedir y dibujar la edición, que ya no muestra «Votar», con el foco en su pestaña.
    Otro error (un 500, la red) deja el diálogo abierto, para volver a probar.
  - Después de guardar sale el `message`, se vuelve a pedir el detalle y se redibuja en la misma pestaña y propuesta, con el foco en el botón que lo abrió o su reemplazo.
- Decisión: una acción por vez; mientras se guarda, el diálogo no se abre ni abre «Reenviar…» (el redibujo correría con un diálogo abierto y el foco iría detrás del velo).
- Propuestas: con la votación abierta y `puede_votar`, cada propuesta suma en su cabecera «Tu N.º» (si votó) y «Votar» o «Cambiar mi orden»; el índice suma la marca «Tu N.º».
  Las marcas `Datito` y `Equipo` llevan cada una su ícono y un texto oculto «Principal de …»; la del equipo va en la ganadora cuando cierra.
  Sin `&propuesta=`, se abre la del equipo si cerró y, si no, la de Datito.
- La tarjeta de la lista suma arriba del título el `rotulo` de la principal con un ícono.
  Abierta, en el pie, además de la pastilla del envío, «Se vota hasta el mar 24/11 a las 12:00» (con el reloj) y, con `falta_tu_voto`, «Falta tu voto».
- «Copiar la propuesta» sigue copiando las etiquetas tal como las mandó Datito: la copia es de lo archivado.
- Decisión: la agenda ocupa tantas columnas como grupos trae, arriba de 820 px; debajo, una sola.

## Mi espacio

- El día del cierre, en la agenda de quien está en la foto de una votación abierta y todavía no votó, un ítem «Votá la principal del dato de la quincena» (`docs/temas/mi-espacio-agenda.md`).
- Va aparte del chip del dato de la quincena, que es igual para todos y sin enlace: el ítem es de cada persona.
  Lo arma el servidor en `GET /api/mi-espacio/eventos`, en la clave `dato_quincena_votacion`.
  Desaparece apenas vota o cuando cierra, y no va al aviso diario ni a ningún mail.

## El sellado y el mail del resultado

- Un paso de las corridas de las 8:05 y de las 14:00 (`votacionDelDatoQuincenaAislada`, que nunca rechaza), con su candado `rpad_dato_quincena_votacion` (`docs/temas/calendario-y-corridas.md`).
  Sella cada votación sin sellar cuyo cierre ya pasó, calculado con el calendario de la corrida.
- Cuándo sella: solo un día hábil, con el calendario leído (`calendario.error === null`) y desde las 14:00 del día del cierre.
  La corrida de las 14:00 de ese día sella; si no pudo, la de las 8:05 del siguiente día hábil.
  Las corridas a mano de administración (`/api/notificaciones/ejecutar` y `/api/notificaciones/cambios-pendientes`) comparten el controlador y la misma regla: antes de las 14:00 del día del cierre no sellan ni mandan nada.
- En una edición regular, al sellar se manda el mail del resultado a administración: personas activas con `esAdmin`, con un email válido y sin licencia oficial ese día.
  Un piloto se sella sin mail.
- Decisión: el mail respeta el interruptor «Envío automático»: apagado, la votación se sella igual, sin mail, y no se manda después al prenderlo (como el correo de una edición).
- Sale una sola vez por edición.
  Lo reserva el UPDATE condicionado que sella (`AND sellada_at IS NULL`) y solo manda la corrida cuyo UPDATE tocó la fila.
  Todo lo que hace falta para el mail se prepara antes de sellar: si la edición no se puede leer, queda sin sellar y la corrida siguiente lo reintenta.
- `dato_quincena_votaciones.aviso` guarda cómo salió: `enviado`, `parcial`, `fallido`, `no_corresponde` (un piloto o nadie a quien mandar) o `apagado`.
  A quien no le llega no se le reintenta.
- Decisión: el aviso de Correos → Estado dice «El mail de la votación del dd/mm no le llegó a todas las personas de administración.» con `parcial` y «El mail de la votación del dd/mm no le llegó a nadie de administración.» con `fallido`, y no cuenta personas: la columna no guarda cantidades.
  Aparece con `parcial` o `fallido` en la última regular sellada en los últimos 14 días.
  El resultado está siempre en la página: es un aviso, no la edición.
- El mail usa `plantillaSimple` (el marco y el remitente de siempre, y `to` siempre):
  - asunto «La principal del equipo del lunes 23/11/2026» y, como título del cuerpo, el `titulo` del modelo, sin el año: «La principal del equipo del lunes 23/11», como la maqueta que aprobó el usuario;
  - el saludo, «Cerró la votación de El dato de la quincena del lunes 23/11/2026. La principal del equipo es esta:», un recuadro celeste con «Propuesta N» (y «La misma de Datito»), su título y su cifra clave;
  - el `resultado.texto` en negrita, la participación y el cierre; la tabla de los votos y la regla en chico (sin votos, no van);
  - el botón «Ver la edición en el RPAD» y la nota «Te llega porque sos de administración del RPAD. Votan las personas con «Vota» tildado en la pestaña Envío y votación.».
  `plantillaSimple` acepta un párrafo `{ bloque }`, para una tabla o un recuadro sin meterlos dentro de un `<p>`.
- Una votación sellada en la corrida de las 8:05 del día siguiente manda el mail a esa hora.

## El mail

- `modeloDelMail` suma dos claves: `aclaracion`, «La principal de este correo es la que marcó Datito: la del equipo se elige y se ve en el RPAD.», y `recuadro: true`.
  La frase se arma con `NOMBRE_DEL_BOT`: la plantilla no escribe el nombre del bot.
- Decisión: la frase es fija, y dice lo mismo con la votación abierta o cerrada.
  El mail sale a las 8:05 y la votación cierra a las 12:00: el primer envío suele salir con la votación abierta, pero un reintento, un reenvío o la prueba pueden salir con la votación cerrada, y todos tienen que salir iguales.
  Por eso no lee la votación al armarse (dos personas podrían recibir la misma edición distinta) ni se congela en el primer envío (otra columna, para nada).
- Decisión: la frase no dice que la del equipo sea otra, porque tiene que ser cierta en todos los envíos, los reintentos, los reenvíos y la prueba: la votación puede terminar en la misma de Datito.
- La plantilla dibuja cada una solo si viene: un modelo armado a mano sin ellas sale como siempre.
- La frase va justo después de la bajada, en un párrafo como el de la bajada, y en el texto plano un renglón debajo de la bajada, en el mismo bloque.
- Decisión: su color es `COLORES.subtitulo` (#5A7391, 4,89:1 sobre blanco) y no el gris de la bajada, que no llega a 4,5:1.
- El recuadro va después del saludo y antes de la infografía, en celeste (`COLORES.encabezado` con su borde), con «Esta edición se lee mejor en el RPAD», la frase de qué hay en el RPAD y el mismo botón «Ver la edición en el RPAD», con la misma dirección.
  En el texto plano, un bloque «Esta edición se lee mejor en el RPAD: <dirección>» después del bloque del título.
  El botón del final queda.
- Sale igual en la corrida, los reintentos, los reenvíos y la prueba.
- Lo controla `tests/dato-quincena-resguardo.test.js`: su fixture no se regenera y compara contra el mail de antes con exactamente esas dos inserciones, en anclas que aparecen una sola vez, y el rótulo «Por qué es noticia» en lugar de «Por qué hoy», una vez por propuesta.
  Si el mail cambia en algo más que la frase, el recuadro y ese rótulo, ese test falla a propósito.

## Lo que no cambia

- El POST de Datito, el contrato v1.4, su validación de una sola `Principal`, la clave, la huella, el recibo y el 409.
- `dato_quincena_propuestas.principal` y la `metadata` guardada.
- El chip de Mi espacio, que no nombra ninguna propuesta, y el aviso diario.
- La caja Correo de cada edición y sus rutas.
- El mail de cada edición, salvo la frase y el recuadro; la infografía del mail y su pie.

## Archivos de tests

`schema.test.js`, `dato-quincena-reglas.test.js`, `dato-quincena-votacion-reglas.test.js`, `dato-quincena-votacion-api.test.js`, `dato-quincena-votacion-sellado.test.js`, `dato-quincena-api.test.js`, `permisos.test.js`, `dato-quincena-frontend.test.js`, `dato-quincena-correo-reglas.test.js`, `dato-quincena-correo.test.js`, `dato-quincena-resguardo.test.js`, `mi-espacio-eventos-api.test.js`, `email-diseno.test.js`, `notificaciones.test.js`, `paginas.test.js`
