# Mi espacio: la agenda personal y compartida

Fecha: 26/10/2026. **Estado: pre-plan, borrador para revisar.** Salió de la charla del 26/10/2026 sobre el panel personal. Es la tercera de tres entregas:
1. Feriados (`2026-10-26-feriados-design.md`).
2. Mi espacio: licencias y horas extras (`2026-10-26-mi-espacio-licencias-y-horas-design.md`).
3. La agenda (este documento).

**Depende de la entrega 2,** que crea la página Mi espacio y las ausencias. La agenda se suma como cuarta pestaña.

**Maquetas:** en `2026-10-26-mi-espacio-mockups/`:
- `1-mi-espacio.html#agenda`, la pestaña;
- `2-formularios.html#evento` y `#evento-ajeno`, el formulario y un evento compartido por otra persona.

Se miran con el preview `maquetas-mi-espacio` (puerto 8765). Los datos son inventados. Donde la maqueta no coincida con este documento, manda el documento. La maqueta es anterior a la segunda revisión: ofrece «15 minutos», «1 hora» y «2 horas antes», y en la lista para invitar aparece una persona que es lectora.

**Revisión del 26/10/2026 (segunda sesión).** Cuatro agentes leyeron el código y el usuario contestó otra ronda de preguntas. Lo que cambió:
- **Ningún email del RPAD sale en un día que no es hábil** (pedido del usuario). «1 día antes» es el día hábil anterior.
- **Sin cron nuevo:** los recordatorios salen con las dos corridas que ya existen, a las 8:15 y a las 14:00. El usuario dejó la decisión en mis manos (sección 5).
- **Las opciones de recordatorio** pasan a ser «El día hábil anterior» (de entrada), «El mismo día» y «Sin aviso». Se van «15 minutos», «1 hora» y «2 horas antes».
- **Los emails de la agenda llegan aunque la persona esté de licencia:** van al mail laboral (respuesta del usuario sobre el recordatorio, extendida por mí a los otros tres).
- Lo que corrigió el análisis del código: el índice único de los envíos y los reintentos, los emails de un evento después de guardar, la plantilla en `emailTemplates.js` y los tests que cambian.

## Por qué

La Dirección coordina reuniones, entregas y capacitaciones por mensajes sueltos, y cada uno anota sus turnos y trámites donde puede. El usuario quiere una agenda dentro del RPAD:
- **personal:** si una compañera sube algo personal a su agenda, lo ve ella sola;
- **compartida:** un evento para todos, o para las personas que se elijan;
- **con un recordatorio por email antes del evento.**

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- **La pestaña Agenda de Mi espacio** (`#agenda`), con dos vistas: el mes y la lista de próximos (decisión del usuario).
- **Eventos personales,** que ve solo quien los crea.
- **Eventos compartidos** con personas elegidas o con todos. Solo quien lo creó lo cambia o lo borra (decisión del usuario).
- **Un recordatorio por email** que cada evento elige (decisión del usuario): el día hábil anterior (de entrada), el mismo día o sin aviso. En un evento compartido les llega a todos (decisión del usuario).
- **Un email cuando alguien te suma a un evento** (decisión del usuario), y otro cuando ese evento cambia o se borra.
- **En la agenda de cada uno** aparecen también sus licencias y francos, los feriados y los compañeros que no están (decisión del usuario: «Lo mío en mi agenda» y «Hoy no están»).

**No objetivos**
- No hay eventos que se repiten ni eventos de todo el día, ni exportación al celular ni a Google Calendar: el usuario no los eligió. Quedan como posibles extensiones.
- No hay vista de semana ni de día: el usuario eligió mes y próximos.
- No hay confirmación de asistencia, salas, adjuntos ni comentarios.
- No hay recordatorios con minutos u horas de anticipación: no hay una corrida cada pocos minutos.
- No se toca la «Agenda de pedidos» de Reportes, que es otra cosa. En el código, todo lo de esta agenda lleva el prefijo `mi_espacio_` o `evento`, nunca `agenda` a secas, para que no se confundan.

**Antiobjetivos**
- **Que un evento personal lo vea otra persona.** La API nunca devuelve un evento a quien no lo creó ni fue invitado.
- **Que un recordatorio salga dos veces, o tarde y sin aviso.** Si una corrida no lo mandó, sale en la siguiente mientras el evento no haya empezado; si ya empezó, no sale.
- **Que un email automático salga en un día que no es hábil.**
- **Que el tipo de una licencia aparezca en la agenda de otro.** Los compañeros ven «Laura Gómez no está», como en la entrega 2.

## 1. El evento

- **Qué**: obligatorio, hasta 150 caracteres.
- **Fecha y De**: obligatorias. **A**: opcional, y si está tiene que ser después de «De», el mismo día.
- **Detalle**: opcional, hasta 1000 caracteres.
- **¿Quién lo ve?**: «Solo yo» o «Compartido».
  - **Si es compartido**, se eligen las personas o «Todos».
  - **«Todos»** es una marca, no una lista: alguien que se suma después también lo ve. Les llegan la invitación, el cambio, la cancelación y el recordatorio, como en cualquier evento compartido.
  - **«Todos» y las personas que se pueden elegir son administración:** superadmin, admin y editor (`esAdmin`; respuesta del usuario). Es la misma regla que la de «los compañeros» de la entrega 2.
  - Solo administración comparte eventos, aparece en la lista de personas y ve los «para todos».
  - El lector y el colaborador tienen solo eventos personales: el formulario no les ofrece «Compartido».
- **Recordatorio por email:**
  - **«El día hábil anterior»** es la opción de entrada. Sale en la corrida de las 14:00 del día hábil anterior al del evento.
  - **«El mismo día»** sale en la corrida de las 8:15 del día del evento. Si el evento cae en un día que no es hábil, sale el día hábil anterior a las 14:00, y el formulario lo dice.
  - **«Sin aviso».**
  - **El formulario dice cuándo sale:** «El día hábil anterior (el viernes 30/10, a las 14:00)» o «El mismo día (a las 8:15)».
  - **Si el evento empieza antes de las 8:15,** «El mismo día» no llega a tiempo, y el formulario lo avisa.

**Fechas:** del 01/01/2025 a dos años después de hoy. Un evento puede caer cualquier día, también en un fin de semana o un feriado.

**Las horas** son hora argentina, guardadas como DATE + TIME, sin pasar a UTC. Se comparan con `ahoraArgentina()`, nunca con `NOW()` de la base (CLAUDE.md: la base puede estar en UTC). El pool devuelve los `TIME` como texto (`'10:00:00'`): se cortan a `'HH:MM'`.

## 2. Quién ve y quién cambia

- **Lo ve** quien lo creó, las personas invitadas y, si es para todos, la administración activa con sesión.
- **Lo cambia y lo borra** solo quien lo creó (decisión del usuario). Cualquier otra persona recibe 404, también si lo intenta por la API: no se revela que existe.
- **Borrar es una baja lógica** con `activo`. A los invitados les llega «Se canceló: …».
- **Una persona invitada puede apagar su propio recordatorio** («Mi recordatorio: sin aviso»). El evento no cambia.
- **Si se da de baja a quien creó el evento,** el evento sigue para los invitados, que lo ven pero no lo pueden cambiar.

## 3. Lo que se guarda

Tablas nuevas, en `migracion-mi-espacio-agenda.sql` (aditiva y repetible) con su `rollback-mi-espacio-agenda.sql`, y también en `database/schema.sql` (los tests crean sus bases solo con `schema.sql`). Con las dos entregas anteriores hay 37 tablas: esta suma 3 y quedan 40. Los nombres finales quedan para quien lo construye.

- **`mi_espacio_eventos`:**
  - `id`, `creado_por` (FK a `usuarios`, ON DELETE SET NULL), `titulo` varchar(150) y `detalle` text NULL;
  - `fecha` DATE, `desde` TIME y `hasta` TIME NULL;
  - `para_todos` y `compartido` (tinyint) y `recordatorio` (enum: 'ninguno', 'dia_anterior' y 'mismo_dia'; de entrada, 'dia_anterior');
  - `activo`, `created_at` y `updated_at`.
- **`mi_espacio_evento_personas`:** `evento_id` y `usuario_id` (PK compuesta, las dos FK ON DELETE CASCADE) y `sin_recordatorio` (tinyint).
- **`mi_espacio_evento_envios`:** qué email salió a quién.
  - `id`, `evento_id`, `usuario_id`, `tipo` ('recordatorio', 'invitacion', 'cambio' o 'cancelacion'), `para` (DATETIME: el momento del evento al que se refiere), `enviado_at` (DATETIME, escrito con `ahoraArgentina()`) y `success`.
  - **Un recordatorio no se repite:** antes de mandarlo, la corrida lo reserva con un `INSERT IGNORE` sobre una clave única (`evento_id`, `usuario_id`, `para`) que vale solo para los recordatorios (por ejemplo, una columna generada que es NULL en los otros tipos). Si el envío falla, queda con `success = 0` y la corrida siguiente lo vuelve a intentar mientras el evento no haya empezado. Si el evento cambia de hora, cambia `para` y el recordatorio vuelve a salir.
  - **Las invitaciones, los cambios y las cancelaciones** no tienen clave única: una persona que se saca y se vuelve a sumar recibe otra invitación.

## 4. Los emails

- **Todos** van con `remitente()` y `plantillaSimple`, en el marco de siempre, sin emojis y con el botón «Ver en Mi espacio» → `mi-espacio.html#agenda`. Las plantillas van en `services/emailTemplates.js` y se suman a `tests/emails-fixtures.js` y a los mapas `ASUNTOS` y `TEXTOS` de `tests/email-diseno.test.js`.
- **Se mandan con `sendEmail` y `to: [email]`,** después de `emailValido`, nunca con `to` vacío: sin destinatario, `sendEmail` manda a las casillas por defecto de la DGMIT.
- **Invitación**, al sumar a alguien: «Laura Gómez te sumó a un evento: Reunión de equipo, martes 27/10/2026 de 10:00 a 11:00.» Lleva el detalle.
- **Cambio**, si quien lo creó cambia la fecha, la hora o el título: «Cambió un evento: …», con lo de antes tachado (`<s>` dentro de un párrafo). Si solo cambia el detalle o el recordatorio, no sale.
- **Cancelación**: «Se canceló: Reunión de equipo, martes 27/10/2026 a las 10:00.»
- **Recordatorio**: «Hoy a las 10:00: Reunión de equipo» (el mismo día), «Mañana a las 10:00: …» (si el evento es al día siguiente) o «El lunes 02/11 a las 10:00: …» (si en el medio hay días que no son hábiles). El texto se arma con la fecha real del envío. Le llega a quien lo creó y a cada invitado, salvo a quien lo apagó. Un evento personal solo se lo manda a quien lo creó.
- **Llegan aunque la persona esté de licencia:** van al mail laboral y los ve a la vuelta (respuesta del usuario, 26/10/2026). La agenda no sigue la regla del RPAD de no mandar emails durante la licencia.
- **Los emails que no salieron** quedan en `mi_espacio_evento_envios` con `success = 0`.

## 5. El envío de los recordatorios

**Sin cron nuevo:** los recordatorios salen con las dos corridas que ya existen. Lo decidí yo, por pedido del usuario. Así no hay que configurar nada en cPanel, no hay riesgo de chocar con el candado de las Notas Digitales y los emails salen solo en días hábiles, como las demás corridas.
- **A las 8:15** (`ejecutarNotificacionesDiarias`): un paso nuevo y aislado, con su try/catch y su `resultados.eventos`. Va después de las Notas Digitales, porque `registrarInicio` borra lo anotado, y sus errores van a `resultados.errores` y a `anotarEnLaUltimaCorrida`.
- **A las 14:00** (`/api/cron/cambios-pendientes`): un paso nuevo y aislado después del recordatorio de cambios pendientes, que no lo frena.
- **Solo en días hábiles,** con `esDiaHabilCon` y los feriados (entrega 1), no con `esDiaHabil`.

**Cada corrida manda los recordatorios que ya tocaban y cuyo evento todavía no empezó.**
- **Le toca** el día hábil anterior al evento, desde las 14:00 («El día hábil anterior»), o el día del evento, desde las 8:15 («El mismo día», en un día hábil).
- **Si una corrida no lo mandó** (el evento se creó después, la corrida falló o el envío falló), sale en la siguiente, mientras el evento no haya empezado. Por ejemplo, un evento creado a las 16:00 para mañana a las 10:00 avisa mañana a las 8:15.
- **Sin repetidos:** el `INSERT IGNORE` de la reserva (sección 3) hace que una corrida manual repetida no mande dos veces. No hace falta un candado propio.
- **Las funciones reciben el momento** (`{ ahora }`) para que los tests usen un hoy fijo.

**Las invitaciones, los cambios y las cancelaciones** salen en el momento, cuando alguien guarda el evento, también en un día que no es hábil: responden a lo que hizo una persona. Se mandan después de responder el guardado, fuera de la transacción, así un evento «para todos» no hace esperar a quien lo guarda. Si el email falla, el evento se guarda igual y la falla queda registrada.

## 6. La pestaña Agenda

Las medidas, los colores y los textos están en la maqueta 1.

- **El mes:**
  - la grilla de lunes a domingo, con «‹», «›», «Hoy» y «Nuevo evento»;
  - en cada día, hasta 3 renglones y «y N más»;
  - los fines de semana y los feriados con otro fondo, y hoy marcado.
- **Los colores:** los eventos propios, en tinta; los compartidos, en violeta; tus licencias y francos, en verde (con el tipo, porque son tuyos; la franquicia, como «Franquicia, 2 h»); los feriados, en amarillo; y los compañeros que no están, en gris.
- **La leyenda,** debajo de la grilla.
- **Próximos, al costado:** agrupados en Hoy, Mañana, Esta semana y Más adelante. Cada uno muestra la hora, el título y si es solo tuyo, compartido con N personas o de otra persona, con su aviso.
- **Abrir un evento:** un clic en el evento, en la grilla o en la lista, lo abre:
  - si es tuyo, en el formulario de edición;
  - si es de otra persona, en el detalle (maqueta 2, «evento ajeno»), con «Mi recordatorio».
- **En el teléfono:** «Próximos» va primero y la grilla muestra puntos de colores por día.
- **El Resumen:** desde esta entrega, «Hoy y mañana» suma los eventos.
- **Los modales** son los de la entrega 2: un clic en el velo no los cierra.

**Lo dibuja `mi-espacio.js`,** con funciones puras para el mes y para la lista, como `calendario.js`:
- los días se cuentan con `Date.UTC` sobre las partes de la fecha;
- la semana empieza el lunes;
- «hoy» es `Utils.hoyEnArgentina()`;
- todo texto pasa por `Utils.escapeHtml`;
- cuándo sale el recordatorio («el viernes 30/10, a las 14:00») lo calcula el servidor, con los feriados: el navegador no recalcula días hábiles.

## 7. La API

En `controllers/miEspacioController.js`, o en un controlador propio de eventos, con `authMiddleware` y siempre sobre `req.user.userId`:

| Ruta | Qué hace |
|---|---|
| `GET /api/mi-espacio/eventos?desde=&hasta=` | Lo que ve la persona en ese rango: sus eventos, los compartidos con ella y los «para todos», cada uno con `es_mio`, sus personas (solo nombres), su recordatorio y cuándo sale. Suma sus licencias de Mi espacio (con el tipo), los feriados (entrega 1) y las ausencias de los compañeros (entrega 2, sin el tipo). |
| `POST /api/mi-espacio/eventos` | Crea un evento. |
| `PUT /api/mi-espacio/eventos/:id` | Lo cambia; solo quien lo creó. |
| `DELETE /api/mi-espacio/eventos/:id` | Lo da de baja; solo quien lo creó. |
| `PUT /api/mi-espacio/eventos/:id/mi-recordatorio` | Una persona invitada apaga o prende el suyo. |
| `GET /api/mi-espacio/eventos/aviso?fecha=&desde=&recordatorio=` | Cuándo saldría el recordatorio, para el texto del formulario, sin guardar nada. |
| `GET /api/mi-espacio/personas` | La administración activa para elegir, con id, nombre e iniciales. Nada más: ni email, ni rol. Al lector y al colaborador, 403. |

**Errores:** un error de validación es 400 `{ success: false, error, campo }`; un id ajeno o que no existe, 404.

**Validación pura** en `services/miEspacioEventosReglas.js`: `validarEvento(entrada, hoy)` → `{ datos, error }`, que cuenta los caracteres con `Array.from`, y `momentoDelAviso(evento, feriados)` → el momento en que toca el recordatorio. Ninguna función tira.

## 8. Tests

- **`tests/mi-espacio-eventos-reglas.test.js` (puro):**
  - la validación en sus bordes;
  - `momentoDelAviso`:
    - «El día hábil anterior» de un lunes es el viernes a las 14:00, y el jueves si el viernes es feriado;
    - de un sábado, el viernes;
    - «El mismo día» de un día hábil es a las 8:15, y de un domingo, el viernes a las 14:00;
    - el cambio de mes y de año;
  - qué recordatorios tocan en una corrida:
    - el que ya tocaba y no salió;
    - el evento ya empezado;
    - el apagado por un invitado;
    - el evento cambiado de hora;
    - el que falló y se reintenta.
- **`tests/mi-espacio-eventos-api.test.js` (Docker, con base propia):**
  - un evento personal es invisible para otro;
  - compartido con personas y para todos, incluida alguien de administración que se suma después;
  - el lector y el colaborador no pueden compartir;
  - solo quien lo creó cambia o borra, y el resto recibe 404;
  - los emails en Mailpit: invitación, cambio, cancelación y recordatorio, y que llegan aunque la persona esté de licencia;
  - un solo recordatorio aunque la corrida se repita;
  - ningún recordatorio en un día que no es hábil;
  - los pasos de las dos corridas, con un hoy fijo (`mock.timers` y el paso llamado directo, como `tests/metricas-foto.test.js`), sin llamar a `/api/cron/*`.
- **`tests/mi-espacio-frontend.test.js`:** el mes (con la semana desde el lunes, el cambio de año y «y N más»), los próximos, los colores y el formulario.
- **Los tests existentes que cambian:**
  - `permisos.test.js`: las rutas nuevas;
  - `schema.test.js`: las tablas, la migración y la vuelta atrás;
  - `email-diseno.test.js`: las cuatro plantillas;
  - los de la corrida de las 8:15 y del recordatorio de las 14:00 (`notificaciones`, `avisos-diarios`): los pasos nuevos no cambian lo que ya hacen.

## 9. Documentación y despliegue

- **`CLAUDE.md`:**
  - la agenda dentro de Mi espacio;
  - las tablas nuevas;
  - los pasos nuevos de las corridas de las 8:15 y de las 14:00 en «Recordatorios automáticos»;
  - la aclaración del nombre frente a la Agenda de pedidos.
- **`README.md`:** la migración.
- **Despliegue:**
  - después de la entrega 2;
  - se corre `migracion-mi-espacio-agenda.sql` antes de subir el código;
  - se suben los archivos y se reinicia la aplicación;
  - no hace falta ninguna Tarea Cron nueva.

## Decisiones

**Del usuario (26/10/2026):**
- La agenda tiene eventos personales, que ve solo quien los crea, y compartidos con las personas que se elijan o con todos.
- El recordatorio es elegible por evento.
- En un evento compartido, el recordatorio les llega a todos.
- Solo quien creó el evento lo cambia o lo borra; si cambia, les llega un aviso a los demás.
- Hay dos vistas: el mes y la lista de próximos.
- Sale un email cuando te suman a un evento.
- En la agenda aparecen también las licencias propias, los feriados y quién no está.
- Quedan afuera los eventos que se repiten, los de todo el día y la exportación.
- «Todos» y las personas que se pueden invitar son administración: superadmin, admin y editor (respuesta a la revisión).

**Del usuario, en la segunda sesión (26/10/2026):**
- Ningún email del RPAD sale en un día que no es hábil: «1 día antes» es el día hábil anterior.
- El recordatorio llega aunque la persona esté de licencia, porque va al mail laboral.
- Reusar las corridas de las 8:15 y de las 14:00 o sumar una nueva: lo dejó en mis manos.
- Aprobó todas las decisiones mías de la primera revisión.

**Mías, aprobadas por el usuario en la segunda sesión (26/10/2026):**
- Cada persona invitada puede apagar su propio recordatorio.
- «Todos» es una marca que incluye a quienes se suman después.
- La hora «A» es opcional y el evento termina el mismo día.
- Si una corrida no mandó un recordatorio, sale en la siguiente mientras el evento no haya empezado.
- El email de cambio sale solo si cambian la fecha, la hora o el título.
- La lista de personas para elegir trae solo el nombre.
- El prefijo `mi_espacio_` y la palabra «evento» en el código, para no confundir con la Agenda de pedidos.
- Las franquicias de menos de 7 horas no cuentan como ausencia.

**Mías, nuevas en la segunda sesión (para revisar):**
- Los recordatorios salen con las corridas de las 8:15 y de las 14:00, sin cron nuevo. Las opciones son «El día hábil anterior» (de entrada, a las 14:00), «El mismo día» (a las 8:15) y «Sin aviso».
- La invitación, el cambio y la cancelación también llegan aunque la persona esté de licencia, como el recordatorio, y salen en el momento en que alguien guarda el evento, aunque no sea un día hábil.
- Sin una línea propia en Correos → Estado: los errores de la corrida de las 8:15 se anotan en su última corrida, y cada envío fallido queda en `mi_espacio_evento_envios` y se reintenta.
- El índice único de los envíos vale solo para los recordatorios, y se reserva antes de mandar.
- La lista de personas responde 403 al lector y al colaborador.

## Lo que queda para quien lo construye

- Los nombres finales.
- Si los eventos van en el controlador de Mi espacio o en uno propio.
- El dibujo del mes en el teléfono.
- Cómo se ordena la lista de próximos dentro de un mismo día.
- El texto exacto de los emails, con el tono del RPAD.
