# Mi espacio: el aviso diario de la agenda

Un mail a las 14:00 del día hábil anterior con la agenda de cada persona, y a sus jefes, el texto corto de lo que su gente deja a la vista.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-11-04-agenda-aviso-y-dependencia-design.md`

## Archivos

- `services/miEspacioEventosDiarioReglas.js`, puro: `cuandoLlegaElAviso`, `fraseDelAviso`, `mailDeLaPersona`, los mensajes del guardado y de la casilla y los textos de Correos → Estado.
- `services/miEspacioEventosDiarioDatos.js`, consultas en lote y sin N+1: `usuariosDelAviso`, `eventosDelAviso`, `informadosDe`, `deLicenciaOficial`, `marcarInformados`.
- `services/miEspacioEventosDiario.js`, la corrida: `ejecutarAvisoDiarioDeEventos`, `avisoDiarioAislado`, `leerCorridaDelDiario`, `estadoDelAvisoDiario`.
- `services/emailTemplates.js`: `avisoDiarioTemplate`, en el marco único.
- `services/usuariosReglas.js`: `superioresDe`, la única que recorre la cadena.
- En el código no se llama «agenda» a secas: es `Diario`, `evento` o `mi_espacio_`.

## Qué sale y cuándo

- 14:00 de un día hábil: a cualquier usuario activo con algo, sus eventos y Laborales (con la casilla) y los Públicos de su gente, de mañana al próximo día hábil inclusive.
  Un viernes trae sábado, domingo y lunes.
- 8:05 de un día hábil: solo a un jefe con por lo menos un rezagado, toda la agenda de hoy, con lo nuevo marcado «Nuevo:», y lo propio si tiene la casilla.
- A las 14:00, un jefe también recibe, en un grupo «Hoy», lo sin informar de hoy que no empezó: es lo que quedó de un mail de las 8:05 que falló.
- No sale sin nada para mandar, con licencia oficial, un día no hábil ni sin poder leer los feriados.
- No hay aviso al cargar ni por cambios o borrados: solo se avisa de lo que hay en cada una de esas dos horas (decisión del usuario).
- Lo que se carga y se realiza en el mismo día no pasa por acá: se avisa solo con su recordatorio, si lo tiene, y ese le llega solo a quien lo cargó (decisión del usuario, «solamente es recordatorio PREVIO»).
- Un Público cargado después del aviso para un día no hábil no se avisa nunca: es un caso de borde que el usuario decidió no cubrir.

## Qué recibe cada persona

- `mailDeLaPersona({ persona, eventos, informados, momento, ahora, calendario, usuarios })` da null o `{ propios, gente, dias, soloHoy, informa }`.
- Lo propio, solo con `eventos_por_mail`: lo que creó, de los tres tipos, con título, detalle y una marca, y los Laborales de otra persona en los que está, con «Laboral, de Federico».
- Haber apagado «Mi recordatorio» de un evento no lo saca de este mail.
- Lo de su gente, siempre: los Públicos activos de quien la tiene en su cadena, de un creador activo, solo con el nombre corto y el texto corto, «Micaela: Fuera de la oficina», con la hora y «Hasta las 10:00» si tiene fin.
- Quien solo fue elegida para ver un Público no recibe nada: el mail es para que los jefes estén enterados, no para quienes lo ven en su agenda (decisión del usuario).
- Un jefe no ve el título aunque esté marcado para verlo: la marca decide la agenda, y la cadena, el mail.
  Tampoco lo ve en su agenda, donde un Público siempre llega recortado.
- De un Público ajeno, `mailDeLaPersona` no lee `titulo`, `detalle`, `personas` ni `vistas`: los tests lo prueban con getters que tiran.
  No se relaja «para simplificar».
- Un Laboral no le llega a los jefes de quien lo creó, salvo que los inviten.

## Lo sin informar

- `mi_espacio_evento_informados` tiene una fila por evento, persona y fecha del evento, escrita solo cuando el mail salió bien.
- Es por fecha porque cambiar un Público de fecha lo vuelve a poner sin informar; si vuelve a una fecha ya informada de ese evento, no se avisa de nuevo.
- Un rezagado es un evento sin informar, de hoy, con `publicado_at` anterior a hoy o NULL (los de antes de la migración) y que todavía no empezó.
- `publicado_at` se escribe en hora argentina cuando un evento queda Público siendo nuevo, cuando pasa a Público desde otro tipo y cuando un Público cambia de fecha.
  Un cambio de título, hora o texto no lo toca, y un evento que deja de ser Público queda con NULL.
- `claveDeInformado` usa siempre el texto de la fecha, `AAAA-MM-DD`: la consulta la pasa con `DATE_FORMAT`.

## La frase de cuándo llega

- `cuandoLlegaElAviso({ fecha, desde, ahora, calendario })` da `{ llega: true, cuando }` o `{ llega: false, motivo }`, y `fraseDelAviso(aviso, cantidad)` arma el singular o el plural.
- `GET /api/mi-espacio/eventos/aviso-de-la-cadena?fecha=&desde=` responde `{ texto, llega }`, con el calendario leído en ese pedido; la página no calcula nada.
- Sin fecha, el genérico; con `fecha <= hoy`, que no llega; con el día hábil anterior a `fecha` después de hoy, ese día a las 14:00; si es hoy y no son las 14:00, «hoy a las 14:00».
- Si no (hoy puede no ser hábil: un sábado para el lunes), con `fecha` hábil, esa fecha a las 8:05, salvo que `desde` sea antes de las 8:05 o igual; con `fecha` no hábil, que no llega.

## La corrida

- `ejecutarAvisoDiarioDeEventos({ momento, ahora, calendario })`, con `momento` `'tarde'` o `'manana'`, da `{ ocupada, dia_habil, enviados, fallidos, errores }`.
- `avisoDiarioAislado(momento, calendario, { ahora })` la envuelve y nunca rechaza: a las 8:05 corre sin esperarla, y un rechazo sin manejar tumbaría el proceso con las Notas a mitad.
- Candado propio, `rpad_mi_espacio_diario`, ni el de las Notas ni el de los recordatorios: ocupado, termina «ocupada» sin escribir, y no da 207.
- `tests/notificaciones.test.js` y `tests/permisos.test.js` llaman a los crons reales y escribirían en la base del `.env`: toman ese candado en otra conexión antes de todo el archivo.
- `calendario.error !== null`: no manda y lo anota, y lo sin informar de los jefes sale en la corrida siguiente.
  Un día no hábil tampoco manda y se anota igual.
- `'tarde'` solo a partir de las 14:00 (`paso14`): las rutas manuales se pueden llamar antes.
- Nunca dos veces y a lo sumo una, el patrón de los recordatorios: se reserva cada mail en `mi_espacio_diario_envios` (`INSERT IGNORE` sobre `usuario_id`, `dia`, `momento`, o un `UPDATE` que retoma uno fallido y terminado), se manda solo si la reserva es de esta corrida y se anotan `success` y `enviado_at`.
  Una reserva sin terminar no se repite.
- Uno por persona, siempre con `to: [email]`.
  El texto de nodemailer no va al resultado.
- La licencia es `deLicenciaOficial`, solo `usuarios_licencias` con `anulada = 0`, y no `ausentesEn`: lo cargado en Mi espacio no frena este mail, que es lo que el usuario leyó al decidirlo.
  Sus superiores lo siguen recibiendo.
- Registro: `mi_espacio_eventos_corridas`, fila `id = 2`.
  Correos → Estado suma su línea en `#nd-diario` y la alerta `diario-con-errores`, de nivel `error`.
  Sin alerta de «no corrió»: viaja en corridas que ya tienen la suya.

## Sin frenar nada, ni al revés

- 14:00 (`ejecutarNotificacionCambiosPendientes`): después de las notas que esperan la firma y de los recordatorios, y corre aunque `enviarCambiosPendientes` tire: el 500 de esa falla se responde después.
  Sus errores van a `data.diario` y dan 207, sin cambiar el mensaje de los recordatorios.
- 8:05 (`ejecutarNotificacionesDiarias`): se dispara antes de los demás pasos y sin esperarlo, y se espera al final.
  La mañana tarda minutos y el usuario quiere que salga «aunque sea 1 min antes»; así tampoco un SMTP colgado en este paso demora las notas.
  No escribe en la última corrida de las Notas (`registrarInicio` la borra): sus errores van a `resultados.errores`, con `tipo: 'mi-espacio-diario'`, y a la fila 2.
- No hay Tarea Cron nueva.

## La casilla

- `usuarios.eventos_por_mail`, `PUT /api/mi-espacio/eventos-por-mail` con `{ recibir: true | false }`; otro valor, 400 en `recibir`.
- `GET /api/mi-espacio/eventos` trae `eventos_por_mail` y `alguien_depende`, con el que la página suma «Lo de quienes dependen de vos te llega igual.».
- Apaga solo lo propio: lo que le llega como jefe no se apaga, para que el objetivo no dependa de una casilla (decisión del usuario).

## Los mails

- Con `plantillaSimple`, en el marco único, sin emojis y con el botón «Ver en Mi espacio» a `mi-espacio.html#agenda`.
  Cada parte se escapa una sola vez, con `parrafoDelEvento`.
- Los asuntos, los títulos, las aperturas y las notas al pie, con sus tres variantes, están en la spec, sección 8, y en `avisoDiarioTemplate`.
- Un mail de las 14:00 que solo trae el grupo «Hoy» usa los textos del de las 8:05.

## Lo que no es de este tema

- La cadena y el campo «Depende de», en `docs/temas/configuracion.md`.
- El formulario «¿Quién lo ve?», en `docs/temas/mi-espacio-evento-publico.md`.
- Las columnas y las tablas, en `docs/temas/base-de-datos.md`.
