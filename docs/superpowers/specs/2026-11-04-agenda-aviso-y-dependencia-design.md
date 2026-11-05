# El aviso diario de la agenda, de quién depende cada uno y un formulario que no se equivoca

Fecha: 04/11/2026. El usuario aprobó este diseño y su plan el 04/11/2026. Decisiones del usuario del 04/11/2026, tomadas en varias rondas y mirando la maqueta navegable, con datos inventados, en `docs/superpowers/specs/2026-11-04-agenda-aviso-y-dependencia-mockups/` (`mi-espacio.html#agenda`, `configuracion.html#usuarios` y `mails.html`).
Los textos van al pie de la letra. Las personas de los ejemplos son inventadas.

Sigue a `2026-10-26-mi-espacio-agenda-design.md` y `2026-10-29-mi-espacio-evento-publico-design.md`: lo que acá no se dice, sigue como dicen ellas. Cambia lo que dicen en cuatro puntos, y por eso va aparte (sección 12).

## 1. Por qué

Una persona cargó un evento como Personal (Privado) cuando quería que se viera. El formulario lo permite sin ninguna fricción: Privado viene marcado, el tipo está después del detalle, al guardar dice «Evento guardado.» para los tres tipos y en la grilla lo único que los separa es que falte un ojo.

El usuario pidió, con sus palabras (los nombres, cambiados):

- «ver como podemos mejorar eso. Brainstorming a full».
- «a las 14 hs, aprovechando la tarea CRON, salga una notificacion con la agenda del proximo dia habil».
- «a los Usuarios vamos a tener que ponerle de quien depende cada uno».
- «todo lo que ella publique como novedad Personal (Publico) deberia llegarle a la persona de la que ella depende […] y tambien a su vez a la de que el depende».
- «La idea de la notificacion es que los jefes esten enterados de esto, unicamente.» Quien solo aparece marcado para ver un Público no recibe nada: «no es necesario molestarla con una notificacion».
- «Lo que tenemos la obligacion es de avisar. Asi que aunque sea 1 min antes, esta bien.»
- «aca solamente es recordatorio PREVIO de la agenda».

**Antiobjetivos:** que el título o el detalle de un Público lleguen a un jefe; que quien solo fue elegido para ver un Público reciba un mail; que un Privado le llegue a alguien; que el mail nuevo frene las notas de las 8:05, las que esperan la firma o los recordatorios de las 14:00, o al revés; que un mail salga dos veces; que salga un mail vacío o en un día que no es hábil; que un nombre real o un dato de producción quede en el repo.

## 2. El formulario

### 2.1 «¿Quién lo ve?»

Va arriba de todo en el modal, antes de «Qué», y **nada viene marcado**: se elige a propósito.
Al editar un evento existente viene marcado su tipo.
Cambia solo el formulario: la leyenda del mes, la documentación y el código siguen con sus nombres (`privado`, `publico`, `laboral`).

Una barra compacta, la opción 4 de la maqueta (`[data-forma="4"]` de `css/propuesta.css`), con estos botones, en este orden, para **todos los roles**:

| `tipo` | Ícono (Lucide) | Nombre |
|---|---|---|
| `privado` | `lock`, en tinta | Solo yo |
| `publico` | `eye`, en rosado | Yo y quienes elija |
| `laboral` | `users`, en violeta | Laboral |

Sin ayuda dentro de cada botón: lo demás lo dice la frase. El color nunca es lo único que distingue: el elegido lleva además un borde de 2 px.
En el teléfono la barra sigue en una fila, y «Yo y quienes elija» ocupa tres renglones (el usuario lo vio y le pareció bien).

`MENSAJES_EVENTO.tipo` pasa a «Elegí quién lo ve.». Guardar sin elegir marca la barra en rojo, pone ese error debajo y lleva el foco al primer botón, sin pedido al servidor.
**Una pestaña con la página anterior** sigue mandando su cuerpo y se sigue leyendo como lo quiso decir: sin `tipo`, Privado, o Laboral con `compartido` en el `true` literal.
La página nueva no manda `compartido`. Por eso, un Laboral con `compartido: true` y `para_todos: true` es el «Toda la administración» de una pestaña vieja: se guarda con la administración activa como personas elegidas, no como «Todos». Si no, le llegaría el título, el detalle y un mail a todos los lectores, sin confirmación.

### 2.2 La frase debajo de la barra

En `#ev-tipo-ayuda`, con el ícono de lo elegido.

| Elegido | Frase |
|---|---|
| Nada | Elegí una opción para ver a quién le llega. (apagada, con borde punteado) |
| Solo yo | Solo vos lo ves. Nadie más, ni en la agenda ni por mail. |
| Laboral | Lo ven las personas que elijas, con todo el detalle. A esas personas les llega un mail. |
| Yo y quienes elija | El bloque «Aviso por mail» de 2.3, si la persona depende de alguien. Si no, no hay frase. |

### 2.3 «Yo y quienes elija»: el mail y la agenda, separados

Cada cosa en su lugar, la opción 1 que eligió el usuario («aca estamos mezclando»).

**Arriba**, en la frase, con el ícono `mail` de Lucide:

> **Aviso por mail**
> (las iniciales y el nombre corto de cada persona de la cadena)
> De quienes dependés: les llega la notificación por mail {cuándo}.

Con una sola persona: «De quien dependés: le llega la notificación por mail {cuándo}.»

**El cuándo es la fecha exacta**, la calcula el servidor y cambia al elegir la fecha (`GET /mi-espacio/eventos/aviso-de-la-cadena?fecha=&desde=`, sección 7), con `cuandoLlegaElAviso` (sección 5.4):

| Caso, con ahora el miércoles 04/11 a las 10:30 | Termina la frase |
|---|---|
| Sin fecha | les llega la notificación por mail el día hábil anterior a las 14:00. |
| Mañana, antes de las 14:00 de hoy | les llega la notificación por mail hoy a las 14:00. |
| El viernes 06/11 | les llega la notificación por mail el jueves 05/11 a las 14:00. |
| El lunes 09/11, con el viernes hábil | les llega la notificación por mail el viernes 06/11 a las 14:00. |
| Mañana, con ahora después de las 14:00 | les llega la notificación por mail el jueves 05/11 a las 8:05. |
| Hoy | como es para hoy, no les llega ningún mail. |
| Un sábado o un feriado, con el aviso de ese día ya salido | como ya salió el aviso de ese día, no les llega ningún mail. |
| Mañana a las 7:30, con ahora después de las 14:00 | como empieza antes de las 8:05, no les llega ningún mail. |
| Una fecha que ya pasó | como ya pasó, no les llega ningún mail. |

**Abajo**, en el grupo de personas (la maqueta, al bajar):

- El rótulo pasa de «Con quién» a **«Quiénes lo ven en su agenda»**. En un Laboral sigue «Con quién».
- La ayuda, con el ícono `calendar` de Lucide, reemplaza a la de hoy:

> Lo ven en su agenda y en el Resumen, solo con el texto corto. Por marcarlas acá, no les llega ningún mail.
> Federico y Graciela ya están en la lista, porque dependés de esas personas. Si les sacás la marca, no lo ven en su agenda, pero igual les llega el mail.

La segunda oración, solo si depende de alguien; con una sola persona: «Federico ya está en la lista, porque dependés de esa persona. Si le sacás la marca, no lo ve en su agenda, pero igual le llega el mail.»
Esa oración solo vale si están todas marcadas: si no (se sacó una, hay «Todos» o el evento que se edita no las tenía), dice «A Federico y Graciela, de quienes dependés, les llega el mail aunque no tengan la marca.», o «A Federico, de quien dependés, le llega el mail aunque no tenga la marca.». Decir «ya está» de alguien sin la marca sería falso (agregado al implementar).

**Quienes están en la cadena vienen marcados y primeros en la lista**, solo en un evento nuevo y solo la primera vez que se elige este tipo: se les puede sacar la marca (decisión del usuario).
Al editar un evento se respeta lo que tiene.
Sacarles la marca no les saca el mail: el mail depende de la cadena y la agenda, de lo marcado.

### 2.4 Laboral: cualquiera, con «Todos»

Lo crea **cualquier rol** y se puede elegir a **cualquier usuario activo**.
Sale «Toda la administración». Queda un solo atajo, **«Todos»**: todos los usuarios activos, también quien se da de alta después (una marca, como hoy).

**Confirmación antes de guardar**, con el modal chico de la página (`pedirConfirmacion`), si con ese guardado entran por lo menos 5 personas que no estaban (`PERSONAS_PARA_CONFIRMAR`) o si pasa a «Todos» sin estarlo:

> Título: ¿Guardar? Texto: Les va a llegar un mail a {N} personas. Botones: Guardar y Cancelar.

Con una sola persona, que solo puede darse con «Todos» y una lista de una: «Le va a llegar un mail a 1 persona.» (agregado al implementar).

Con «Todos», N es el largo de la lista de personas de la página.

Los textos que nombraban a la administración pasan a nombrar a todos: `MENSAJES_EVENTO.personas`, «Elegí con quién lo compartís, o «Todos».»; `quien_texto`, «Con todos»; `quien_largo`, «Lo creó Julián. Es para todos.»; la confirmación del borrado, «A todas las personas les llega…»; y la opción del tipo en lo que quede de `OPCIONES_DEL_TIPO`.
Los jefes no reciben un Laboral de su gente, salvo que los inviten (decisión por defecto que el usuario aceptó).

### 2.5 Al guardar

El aviso de éxito nombra el resultado, y lo arma el servidor (`message` del POST y del PUT):

| Tipo | Mensaje |
|---|---|
| Privado | Evento guardado. Solo vos lo ves. |
| Público | Evento guardado. {quien_texto} en su agenda, y a Federico y Graciela les llega antes del evento. |
| Público de quien no depende de nadie, o que no llega en ningún aviso (`llega` de 5.4) | Evento guardado. {quien_texto} en su agenda. |
| Laboral | Evento guardado. {quien_texto}. |

En un cambio, «Evento cambiado.» en lugar de «Evento guardado.». Si el texto de `quien_texto` trae «como «…»», va tal cual.
La página le suma un botón **«Cambiar»** que abre ese evento (`data.id`). No reemplaza ningún camino: el evento también se abre desde la grilla y desde Próximos.

### 2.6 El candado en la grilla

Un Privado propio lleva el candado (Lucide `lock`) donde un Público propio lleva el ojo: en la grilla, en el día elegido y en Próximos, y también en la muestra «Solo vos» de la leyenda.
En el teléfono, los puntos de la grilla no cambian: el candado se ve en el día elegido y en Próximos.

### 2.7 La casilla

En la tarjeta de Próximos, debajo de la lista, una casilla prendida de entrada:

> **Recibir mi agenda por mail**
> A las 14:00 del día hábil anterior, si tenés algo. Lo de quienes dependen de vos te llega igual.

La segunda oración, solo si alguien depende de esa persona.
Se guarda al tocarla. Al apagarla: «Ya no te llega tu agenda por mail. Lo de quienes dependen de vos te llega igual.»; al prenderla: «Te va a llegar tu agenda por mail.»; sin nadie a cargo, sin la segunda oración.
Apaga solo lo propio (sección 5.2): lo que le llega como jefe no se apaga, para que el objetivo no dependa de una casilla.

## 3. De quién depende cada uno

Un campo nuevo en el panel de Usuarios, **«Depende de»**, después de «Vínculo», con «Nadie» y la lista de los activos, sin la propia persona ni quienes ya dependen de ella.
Quien esté desactivada y ya estaba cargada se sigue mostrando, con «(desactivado)» al lado, y nadie la elige de nuevo.
La ayuda:

> A esta persona y a quien esté más arriba les llega por mail el texto corto de los eventos que quien depende de ellas deja a la vista de otros. No ven nada más de su Mi espacio.

En la lista de usuarios, en el detalle de cada fila: «Depende de Graciela Paz».

El servidor manda: cada usuario de `GET /usuarios` y `GET /usuarios/:id` trae `depende_de`, `depende_de_nombre`, `no_elegibles` (los ids que no se le ofrecen) y `al_desactivar` (`{ dependen, suben_a }`, con los nombres). El navegador no recorre la cadena.

**Quién lo cambia:** quien ya puede modificar a esa persona (`rechazoParaEditor` y la protección de la cuenta del superadmin no cambian). El editor, sobre lectores y colaboradores; el superadmin, el suyo.
Un cambio queda en el historial, con el nombre, y no le avisa al superadmin, como el cargo o el vínculo (decisión por defecto que el usuario aceptó).

**Validación en la API:** `depende_de` es null o el id de un usuario activo o el que ya tenía (400 en `depende_de`: «Elegí una persona de la lista.»), no la misma persona («No puede depender de sí misma.») y sin cerrar un ciclo («Esa persona ya depende de quien estás editando.»).
Un cuerpo sin `depende_de` (una pestaña con la página anterior) no lo toca.

**Al desactivar a alguien** nada lo frena, y lo que dependía de esa persona sube al siguiente activo de la cadena: el dato queda cargado por si se la reactiva. La confirmación de hoy suma:

> De esta persona depende: Micaela Ojeda. Mientras esté desactivada, lo suyo le va a llegar a Graciela Paz.

Si no hay nadie más arriba: «… Lo suyo no le va a llegar a nadie hasta que le cargues de quién depende.»

**La carga inicial**, con un SQL en `database/privado/`, que no se versiona: se corre en phpMyAdmin con la migración (decisión del usuario).

## 4. Qué sale y cuándo

| Momento | Quién | Qué trae | Cuándo no sale |
|---|---|---|---|
| **14:00** de un día hábil | Cualquier usuario activo con algo | Sus eventos y Laborales (si tiene la casilla) y los Públicos de su gente, de mañana al próximo día hábil inclusive | Sin nada; con licencia; un día no hábil; sin poder leer los feriados |
| **8:05** de un día hábil | Solo jefes con un Público de su gente **cargado antes de hoy**, para hoy, que no se les informó y no empezó | Toda la agenda de hoy, con lo nuevo marcado, y lo propio si tiene la casilla | Lo mismo que a las 14:00, y sin nada sin informar |

No hay aviso al cargar ni por cambios o borrados: **solo se avisa de lo que hay en cada una de esas dos horas** (palabras del usuario).
Los días no hábiles no sale nada: un Público cargado el viernes a las 15:00 para el sábado no se avisa nunca («es una situacion muy border»).
**Lo que se carga y se realiza en el mismo día no pasa por la agenda:** se avisa solo con su recordatorio, si lo tiene, y ese le llega solo a quien lo cargó (decisión del usuario).

Ejemplos, todos con Micaela, que depende de Federico, que depende de Graciela:

- El jueves a las 14:02, Micaela carga un Público para el viernes a las 8:15. El mail de las 14:00 ya salió: el viernes a las 8:05 les llega a Federico y a Graciela.
- El viernes a las 11:15, carga algo para las 14:00 de ese viernes: no se avisa con la agenda.
- El viernes a las 15:00, carga algo para el lunes a las 9:00: el lunes a las 8:05.
- Le cambia la fecha a otra: entra como no informado para esa fecha, aunque otro aviso ya haya cubierto ese día. Si vuelve a una fecha que ya se le informó de ese evento: nada.
- Un Privado que pasa a Público después de las 14:00 cuenta como cargado en ese momento.

## 5. Las reglas

### 5.1 La cadena

`superioresDe(usuarioId, usuarios)`: sube por `depende_de` desde la persona, salta a los desactivados sin cortar y termina en quien no depende de nadie.
Sin repetidos, nunca incluye a la persona y se corta si encuentra un ciclo (no debería haber: la API no deja, y esto es la defensa).
Todo lo demás se arma con esta función: no se copia.

### 5.2 Qué recibe cada persona

Para cada usuario activo con un email que pasa `emailValido` y sin licencia oficial hoy (`usuarios_licencias` con `anulada = 0`, la regla de «no recibe emails durante una licencia»; lo cargado en Mi espacio **no** frena esto, que es lo que el usuario leyó al decidirlo: por eso no se usa `ausentesEn`).

- **Lo propio** (solo con `eventos_por_mail`):
  - Los que creó, de los tres tipos, con título y detalle, y una marca: Privado, «Solo vos lo ves»; Público, su `textoDeQuienVeElPublico` («Lo ven Lucía y Tomás como «Trámite personal»»); Laboral, «Laboral, con Federico» o «Laboral, con todos».
  - Los Laborales de otra persona en los que está (una fila suya o «Todos»), con título y detalle y «Laboral, de Federico». Haber apagado «Mi recordatorio» de un evento no lo saca de acá.
- **Lo de su gente** (siempre): los Públicos activos de quien la tiene en su cadena, de un creador activo, **solo con el nombre corto y el texto corto**: «Micaela: Fuera de la oficina», con la hora y «Hasta las 10:00» si tiene fin. No depende de a quién marcó quien lo cargó.

Un Público de otra persona que no es de su gente no entra, aunque se lo muestren: a quien solo fue elegida no le llega nada.

**La defensa:** de un Público ajeno, estas funciones no leen `titulo` ni `detalle` (los tests lo prueban con getters que tiran, como los de `tests/mi-espacio-eventos-reglas.test.js`).

### 5.3 Los días

- **14:00:** de hoy + 1 al próximo día hábil inclusive (`calendario.proximoDiaHabil(sumarDias(hoy, 1))`), cada día con su título. Un viernes trae sábado, domingo y lunes.
  Además, a un jefe, en un grupo «Hoy» con «Nuevo:», lo sin informar de hoy que todavía no empezó (5.4): es lo que quedó de un mail de las 8:05 que falló.
- **8:05:** solo hoy.

### 5.4 Lo sin informar

Una fila en `mi_espacio_evento_informados` por evento, persona y **fecha del evento**, escrita solo cuando el mail salió bien.

- **Sin informar:** no tiene fila para esa persona y esa fecha.
- **Rezagado:** sin informar, de hoy, con `publicado_at` anterior a hoy (o NULL, los de antes de esta entrega) y cuya hora de inicio todavía no llegó.
- `publicado_at` se escribe con `ahoraArgentina()` cuando un evento queda Público siendo nuevo, cuando pasa a Público desde otro tipo y cuando un Público cambia de fecha. Un cambio de título, hora o texto no lo toca.
- A las 8:05, el mail le sale a un jefe solo si tiene por lo menos un rezagado. Una vez que sale, trae toda la agenda de hoy: lo propio con la casilla y todo lo de hoy de su gente. «Nuevo:» va en lo sin informar, también en uno que ya empezó (que solo no dispara el mail).
- Salir bien marca como informados todos los Públicos de su gente que trae el mail.

`cuandoLlegaElAviso({ fecha, desde, ahora, calendario })`, puro, con la tabla de 2.3, devuelve `{ llega, cuando }`, y `fraseDelAviso(aviso, cantidad)` arma el singular o el plural: sin fecha, el genérico; `fecha <= hoy`, que no llega; si el día hábil anterior a `fecha` es después de hoy, ese día a las 14:00; si es hoy y todavía no son las 14:00, «hoy a las 14:00»; si no (hoy puede no ser hábil: un sábado para el lunes), con `fecha` hábil, esa fecha a las 8:05, salvo que `desde` sea antes de las 8:05 o igual, que no llega; con `fecha` no hábil, que no llega.

## 6. La corrida

Tres archivos nuevos, como los recordatorios: `services/miEspacioEventosDiarioReglas.js` (puro), `miEspacioEventosDiarioDatos.js` (consultas en lote, sin N+1) y `miEspacioEventosDiario.js` (la corrida). En el código no se llama «agenda» (regla del proyecto).

`ejecutarAvisoDiarioDeEventos({ momento, ahora, calendario })`, con `momento` `'tarde'` o `'manana'`, devuelve `{ ocupada, dia_habil, enviados, fallidos, errores }`. **Nunca tira:** ni si no consigue el candado, porque a las 8:05 corre sin esperarlo y un rechazo sin manejar tumbaría el proceso con las Notas a mitad. Lo envuelve `avisoDiarioAislado`, con `try/catch` total, y disparado lleva su `.catch`:

- **Su propio candado**, `rpad_mi_espacio_diario`, ni el de las Notas ni el de los recordatorios. Ocupado, termina «ocupada» sin escribir, y no es un error: no da 207.
- **Sin feriados** (`calendario.error !== null`, nunca `origen`): no manda y lo anota: lo sin informar de los jefes sale en la corrida siguiente. Un día no hábil, tampoco, y se anota igual.
- `'tarde'` solo a partir de las 14:00 (`paso14`): las rutas manuales se pueden llamar antes.
- **Nunca dos veces, a lo sumo una**, el patrón de los recordatorios: se reserva cada mail en `mi_espacio_diario_envios` (`INSERT IGNORE` sobre `usuario_id`, `dia`, `momento`, o un `UPDATE` que retoma uno fallido y terminado), se manda solo si la reserva es de esta corrida y se anotan `success` y `enviado_at`. Una reserva sin terminar no se repite.
- Uno por persona, siempre con `to: [email]`. Se arma antes de reservar. El texto de nodemailer no va al resultado.
- **Registro:** `mi_espacio_eventos_corridas`, la fila `id = 2`. Correos → Estado suma su línea: «Aviso diario de la agenda: última corrida hoy a las 14:00. Enviados: 3.», y la alerta `diario-con-errores`, de nivel `error`. Sin alerta de «no corrió»: viaja en corridas que ya tienen la suya.

**Sin frenar nada, ni al revés:**

- **14:00** (`ejecutarNotificacionCambiosPendientes`): después de las notas que esperan la firma y de los recordatorios, en un paso aislado **que corre aunque `enviarCambiosPendientes` tire** (hoy no tiene `try`: el 500 de esa falla se sigue respondiendo después del paso). Sus errores van a `data.diario` y dan 207, sin cambiar el mensaje de los recordatorios.
- **8:05** (`ejecutarNotificacionesDiarias`): se dispara **antes de los demás pasos y sin esperarlo**, se espera al final. La mañana tarda minutos y el usuario quiere que salga «aunque sea 1 min antes»; así tampoco un SMTP colgado en este paso demora las notas. No escribe en la última corrida de las Notas (`registrarInicio` la borra): sus errores van a `resultados.errores`, con `tipo: 'mi-espacio-diario'`, y a la fila 2.
- No hay Tarea Cron nueva.

## 7. La API

| Ruta | Qué hace |
|---|---|
| `GET /mi-espacio/eventos` | Suma `ve_companeros` (`esAdmin`: prende «Compañeros que no están»), `eventos_por_mail` y `alguien_depende`. Sale `puede_compartir`. |
| `GET /mi-espacio/eventos/aviso-de-la-cadena?fecha=&desde=` | `{ texto, llega }`, de `cuandoLlegaElAviso` y `fraseDelAviso`, con el calendario de la tabla leído en ese pedido. |
| `PUT /mi-espacio/eventos-por-mail` | `{ recibir: true \| false }`. Otro valor, 400 en `recibir`. |
| `GET /mi-espacio/personas` | Pasa a ser para todos los roles: todos los activos sin quien pide. |
| `GET /mi-espacio/personas/publico` | Suma `es_superior` y `nombre_corto` en cada persona, con la cadena primero y por nombre dentro de cada grupo. Con ellos arma la página «Federico y Graciela». |
| `POST` y `PUT /mi-espacio/eventos` | Los mensajes de 2.5, y sin `sinPermiso`. `publicado_at`, como dice 5.4. |
| `GET`, `POST` y `PUT /usuarios` | `depende_de`, con lo de la sección 3. |

Todas sobre `req.user.userId`, con `authMiddleware`, y las nuevas en `RUTAS_MI_ESPACIO` de `tests/permisos.test.js`.
Todo lo de Laboral que miraba el rol (`esAdmin`, `ROLES_QUE_COMPARTEN`, `VISIBLES_CON_TODOS`, `audienciaDe`, `destinatariosDe`) deja de mirarlo.
El nombre corto de un Laboral se arma contra todos los usuarios activos, como el de un Público: lo puede crear un lector.
`administracionActiva` sigue para «los compañeros», con su constante renombrada, `ROLES_DE_ADMINISTRACION`.

## 8. Los mails

Con `plantillaSimple`, en el marco único, sin emojis, con el botón «Ver en Mi espacio» → `mi-espacio.html#agenda`. Cada parte, escapada una sola vez, con `parrafoDelEvento`. La maqueta `mails.html` los muestra con el marco real.

Renglón de un evento: `09:30 · Turno con la kinesióloga`, debajo el detalle y debajo la marca, en gris. Los días, como «Jueves 05/11».

| | 14:00, con lo propio | 14:00, solo lo de su gente | 8:05 |
|---|---|---|---|
| Asunto | RPAD: tu agenda del jueves 05/11 — o «hasta el lunes 09/11», si cubre más de un día | RPAD: agenda del jueves 05/11 de quienes dependen de vos — o «hasta el lunes 09/11» | RPAD: se sumó algo a tu agenda de hoy |
| Título | Tu agenda del jueves 05/11 — o «Tu agenda hasta el lunes 09/11» | Agenda del jueves 05/11 de quienes dependen de vos — o «Agenda hasta el lunes 09/11 de quienes dependen de vos» | Tu agenda de hoy, actualizada |
| Abre | Micaela, esto es lo que tenés para el próximo día hábil. — «hasta el próximo día hábil.», si cubre más de un día | Federico, esto es lo que publicaron para el próximo día hábil. | Graciela, después del último aviso se sumó algo a la agenda de hoy, viernes 06/11. Lo nuevo dice «Nuevo». |

Lo de su gente va al final, bajo **«De quienes dependen de vos»**. Lo nuevo: `08:15 · **Nuevo:** Micaela: Fuera de la oficina`.
Un mail de las 14:00 que solo trae el grupo «Hoy» de 5.3 usa los textos de la columna de las 8:05.

Las notas, al pie:

- Sin gente: Si algo no está como querías, lo podés cambiar desde el evento. Para dejar de recibir este mail, destildá «Recibir mi agenda por mail» en la Agenda de Mi espacio.
- Con lo propio y gente: De quienes dependen de vos, te llega solo el texto corto de lo que publican. Lo tuyo lo podés apagar desde la Agenda de Mi espacio; lo demás te llega siempre.
- Solo su gente: De quienes dependen de vos, te llega solo el texto corto de lo que publican.

## 9. Las tablas

Migración `migracion-mi-espacio-eventos-diario.sql`, fila 36 de `docs/temas/despliegue.md`, se puede volver a correr y va antes que el código; todo también en `database/schema.sql`:

- `usuarios.depende_de`, `int(11)` nula, con clave foránea a `usuarios(id)` `ON DELETE SET NULL` y su índice.
- `usuarios.eventos_por_mail`, `tinyint(1) NOT NULL DEFAULT 1`.
- `mi_espacio_eventos.publicado_at`, `datetime` nula, en hora argentina. Sin completar las viejas: NULL cuenta como anterior a hoy.
- `mi_espacio_evento_informados`: `evento_id`, `usuario_id`, `fecha` (date), `informado_at`, con clave primaria en los tres primeros y las dos claves foráneas `ON DELETE CASCADE`.
- `mi_espacio_diario_envios`: `id`, `usuario_id`, `dia` (date), `momento` (`enum('tarde','manana')`), `enviado_at`, `success`, único en `usuario_id`, `dia`, `momento`.
- **Los Laborales «para todos» de antes** querían decir «la administración», y con el código nuevo pasarían a ser «todos». La migración los convierte, sin cambiar quién los ve: suma una fila por cada administración activa (`INSERT IGNORE`, conservando las de quienes apagaron su recordatorio), **borra antes las filas de quien hoy no es administración activa**, y los deja con `para_todos = 0`. Esas filas son de un recordatorio apagado por alguien que dejó de ser administración o se desactivó: hoy no le dan acceso, y convertidas le mostrarían el título y el detalle. Corre antes que el código y el código viejo los sigue mostrando igual.
Se puede volver a correr **solo antes de subir el código**: después, achicaría a la administración los «Todos» nuevos. Lo dice el encabezado.

Vuelta atrás, `rollback-mi-espacio-eventos-diario.sql`: primero los archivos, después el SQL. Saca las columnas y las tablas. Un Laboral «Todos» creado con el código nuevo queda para la administración, y uno con filas de lector sigue viéndose por sus filas: se dice en el encabezado. Lo cargado en «Depende de» se pierde.

## 10. Lo que no cambia

- El recordatorio de un Privado o un Público le llega solo a quien lo creó.
- Un Público se recorta desde la consulta y en su orden; en el mail, también.
- Los cuatro emails de un evento siguen con su excepción de licencia. **El nuevo no**: durante una licencia oficial no sale (decisión del usuario), y sus superiores lo siguen recibiendo.
- La firma digital, las notas, los recordatorios de cambios y sus respuestas.
- `tests/calendario-unico.test.js`: el calendario llega por parámetro.

## 11. Pruebas

- Reglas puras con hoy fijo: la cadena (saltos, ciclos, desactivados), qué recibe cada quién, los días de un viernes y antes de un feriado, lo sin informar, `cuandoLlegaElAviso` con cada fila de 2.3 y los textos en singular y en plural.
- **Privacidad:** getters que tiran en `titulo` y `detalle` de un Público ajeno; un elegido que no es de la cadena no recibe nada; un Privado no le llega a un superior; el mail real de Mailpit de un jefe no contiene el título ni el detalle.
- Corrida con un hoy fijo, llamando al servicio: no se manda dos veces, un fallo se reintenta, sin feriados no manda, día no hábil, con licencia, sin email, `to` nunca vacío.
- **Aislamiento:** con el controlador y `res` falso, si `enviarCambiosPendientes` tira el paso corre y el 500 se sigue respondiendo; si el paso nuevo tira, las notas y los recordatorios salen y la respuesta es 207; a las 8:05, las notas no esperan al paso.
- Laboral abierto: un lector lo crea, invita a un lector y a un admin, «Todos» le llega a un colaborador, y el evento de otro lector le aparece; un «para todos» viejo, migrado, sigue con la misma audiencia.
- Usuarios: el editor solo sobre lector y colaborador, el 400 de cada caso, el historial, una pestaña vieja sin el campo.
- Frontend: nada marcado, los textos, la preselección solo en uno nuevo, la confirmación y sus umbrales, la casilla, el candado, y cada copia del navegador con su paridad.
- **Simulación** con una copia de la base de producción y Mailpit, sin envíos reales, con eventos y fechas fijas: el jueves a las 14:00, el viernes a las 8:05 y a las 14:00, y un feriado en el medio.

## 12. Lo que cambia de las specs anteriores

1. **«UNICAMENTE a la persona que crea el evento»** (evento público, 2.6) sigue valiendo para los cuatro emails de un evento y deja de valer para el mail diario: de un Público, a los superiores les llega su texto corto.
2. **«De entrada, Personal (Privado)» y «Los nombres, los del usuario»** (evento público, 4): nada viene marcado y el formulario dice «¿Quién lo ve?». `tests/paginas.test.js` hoy prohíbe esos textos y deja de hacerlo.
3. **Comparte solo administración** (agenda, 2; regla de `CLAUDE.md`): cualquier rol crea un Laboral y elige a cualquiera.
4. **«Lo cargado lo ve solo su dueño: ni administración, ni un jefe»** (`docs/temas/mi-espacio.md`): sigue valiendo para licencias, horas y todo evento Privado; un jefe recibe solo lo de la sección 5.2.

## 13. Despliegue

Lo hace solo el usuario, con el kit armado contra el último commit de main con código.
`PASOS.txt` empieza comprobando `correos.js?v=20261214`, lo que dejó el kit anterior. Con el interruptor de la firma prendido, no se sube entre las 8:05 y las 14:00.
Orden: migración, SQL privado de la carga inicial, archivos y Restart. Sin Tarea Cron nueva y sin `npm install`.
