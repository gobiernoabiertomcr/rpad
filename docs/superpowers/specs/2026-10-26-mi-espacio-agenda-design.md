# Mi espacio: la agenda personal y compartida

Fecha: 26/10/2026. **Estado: pre-plan, borrador para revisar.** Salió de la charla del 26/10/2026 sobre el panel personal. Es la tercera de tres entregas:
1. Feriados (`2026-10-26-feriados-design.md`).
2. Mi espacio: licencias y horas extras (`2026-10-26-mi-espacio-licencias-y-horas-design.md`).
3. La agenda (este documento).

**Depende de la entrega 2,** que crea la página Mi espacio y las ausencias. La agenda se suma como cuarta pestaña.

**Maquetas:** en `2026-10-26-mi-espacio-mockups/`:
- `1-mi-espacio.html#agenda`, la pestaña;
- `2-formularios.html#evento` y `#evento-ajeno`, el formulario y un evento compartido por otra persona.

Se miran con el preview `maquetas-mi-espacio` (puerto 8765). Los datos son inventados. Donde la maqueta no coincida con este documento, manda el documento.

## Por qué

La Dirección coordina reuniones, entregas y capacitaciones por mensajes sueltos, y cada uno anota sus turnos y trámites donde puede. El usuario quiere una agenda dentro del RPAD:
- **personal:** «si Aldana sube algo personal a su agenda, lo ve ella sola»;
- **compartida:** un evento para todos, o para las personas que se elijan;
- **con un recordatorio por email antes del evento.**

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- **La pestaña Agenda de Mi espacio** (`#agenda`), con dos vistas: el mes y la lista de próximos (decisión del usuario).
- **Eventos personales,** que ve solo quien los crea.
- **Eventos compartidos** con personas elegidas o con todos. Solo quien lo creó lo cambia o lo borra (decisión del usuario).
- **Un recordatorio por email** que cada evento elige: sin aviso, 15 minutos, 1 hora, 2 horas o 1 día antes. Si no se elige nada, 2 horas antes (decisión del usuario). En un evento compartido les llega a todos (decisión del usuario).
- **Un email cuando alguien te suma a un evento** (decisión del usuario), y otro cuando ese evento cambia o se borra.
- **En la agenda de cada uno** aparecen también sus licencias y francos, los feriados y los compañeros que no están (decisión del usuario: «Lo mío en mi agenda» y «Hoy no están»).

**No objetivos**
- No hay eventos que se repiten ni eventos de todo el día, ni exportación al celular ni a Google Calendar: el usuario no los eligió. Quedan como posibles extensiones.
- No hay vista de semana ni de día: el usuario eligió mes y próximos.
- No hay confirmación de asistencia, salas, adjuntos ni comentarios.
- No se toca la «Agenda de pedidos» de Reportes, que es otra cosa. En el código, todo lo de esta agenda lleva el prefijo `mi_espacio_` o `evento`, nunca `agenda` a secas, para que no se confundan.

**Antiobjetivos**
- **Que un evento personal lo vea otra persona.** La API nunca devuelve un evento a quien no lo creó ni fue invitado.
- **Que un recordatorio salga dos veces, o tarde y sin aviso.** Si la corrida se atrasa, el recordatorio sale igual mientras el evento no haya empezado; si ya empezó, no sale.
- **Que el tipo de una licencia aparezca en la agenda de otro.** Los compañeros ven «Laura Gómez no está», como en la entrega 2.

## 1. El evento

- **Qué**: obligatorio, hasta 150 caracteres.
- **Fecha y De**: obligatorias. **A**: opcional, y si está tiene que ser después de «De», el mismo día.
- **Detalle**: opcional, hasta 1000 caracteres.
- **¿Quién lo ve?**: «Solo yo» o «Compartido».
  - **Si es compartido**, se eligen las personas: los usuarios activos o «Todos».
  - **«Todos»** es una marca, no una lista: un usuario creado después también lo ve. Les llegan la invitación, el cambio, la cancelación y el recordatorio, como en cualquier evento compartido.
  - **Quiénes son «todos»: pregunta abierta al usuario,** la misma que la de «los compañeros» de la entrega 2. Puede incluir o no a los colaboradores (personal de la DGMIT) y a los lectores. La lista de personas para elegir sigue la misma regla.
- **Recordatorio por email**: sin aviso, 15 minutos, 1 hora, 2 horas (de entrada) o 1 día antes. El formulario dice a qué hora sale («2 horas antes (a las 08:00)»).

**Fechas:** del 01/01/2025 a dos años después de hoy. Un evento puede caer cualquier día, también en un fin de semana o un feriado.

**Las horas** son hora argentina, guardadas como DATE + TIME, sin pasar a UTC. Se comparan con `ahoraArgentina()`, nunca con `NOW()` de la base (CLAUDE.md: la base puede estar en UTC).

## 2. Quién ve y quién cambia

- **Lo ve** quien lo creó, las personas invitadas y, si es para todos, todos los usuarios activos con sesión.
- **Lo cambia y lo borra** solo quien lo creó (decisión del usuario). Cualquier otra persona recibe 404, también si lo intenta por la API: no se revela que existe.
- **Borrar es una baja lógica** con `activo`. A los invitados les llega «Se canceló: …».
- **Una persona invitada puede apagar su propio recordatorio** («Mi recordatorio: sin aviso»). El evento no cambia. *(Mía, para revisar: el usuario eligió que el recordatorio les llegue a todos; esto solo deja que cada uno lo apague para sí.)*
- **Si se da de baja a quien creó el evento,** el evento sigue para los invitados, que lo ven pero no lo pueden cambiar.

## 3. Lo que se guarda

Tablas nuevas, en `migracion-mi-espacio-agenda.sql` (aditiva y repetible) con su `rollback-mi-espacio-agenda.sql`. Los nombres finales quedan para quien lo construye.

- **`mi_espacio_eventos`:**
  - `id`, `creado_por` (FK a `usuarios`, ON DELETE SET NULL), `titulo` varchar(150) y `detalle` text NULL;
  - `fecha` DATE, `desde` TIME y `hasta` TIME NULL;
  - `para_todos` y `compartido` (tinyint) y `recordatorio` (enum: 'ninguno', '15m', '1h', '2h' y '1d'; de entrada, '2h');
  - `activo`, `created_at` y `updated_at`.
- **`mi_espacio_evento_personas`:** `evento_id` y `usuario_id` (PK compuesta, las dos FK ON DELETE CASCADE) y `sin_recordatorio` (tinyint).
- **`mi_espacio_evento_envios`:**
  - qué email salió a quién: `evento_id`, `usuario_id`, `tipo` ('recordatorio', 'invitacion', 'cambio' o 'cancelacion'), `para` (el momento del evento al que se refiere), `enviado_at` y `success`;
  - con índice único en (`evento_id`, `usuario_id`, `tipo`, `para`), así un recordatorio no se repite. Si el evento cambia de hora, el recordatorio vuelve a salir, porque cambia `para`.

## 4. Los emails

- **Todos** van con `remitente()` y `plantillaSimple`, en el marco de siempre, sin emojis y con el botón «Ver en Mi espacio» → `mi-espacio.html#agenda`.
- **Invitación**, al sumar a alguien: «Laura Gómez te sumó a un evento: Reunión de equipo, martes 27/10/2026 de 10:00 a 11:00.» Lleva el detalle.
- **Cambio**, si quien lo creó cambia la fecha, la hora o el título: «Cambió un evento: …», con lo de antes tachado. Si solo cambia el detalle o el recordatorio, no sale.
- **Cancelación**: «Se canceló: Reunión de equipo, martes 27/10/2026 a las 10:00.»
- **Recordatorio**: «Hoy a las 10:00: Reunión de equipo» («Mañana a las …» con el de 1 día). Le llega a quien lo creó y a cada invitado, salvo a quien lo apagó. Un evento personal solo se lo manda a quien lo creó.
- **De licencia no salen:** ni recordatorios ni invitaciones a quien ese día está de licencia en Configuración o tiene una ausencia de día completo en Mi espacio. Es la regla del RPAD de no mandar emails durante la licencia. El evento igual aparece en su agenda.
- **Los emails que no salieron** quedan en `mi_espacio_evento_envios` con `success = 0`.

## 5. El envío de los recordatorios

**Una ruta nueva para el cron, `GET /api/cron/eventos`,** con `cronAuth`, como las otras.
- **En cPanel,** una Tarea Cron nueva cada 15 minutos (`*/15 * * * *`), además de las de las 8:15 y las 14:00. Se configura una vez.
- **Corre todos los días,** también en fin de semana: un evento puede ser un sábado.

**Cada corrida manda los recordatorios cuya hora de aviso ya pasó y cuyo evento todavía no empezó.**
- La hora de aviso es la fecha y la hora del evento menos su anticipación.
- La precisión es de unos 15 minutos.
- Si la corrida anterior falló, el recordatorio sale en la siguiente, mientras el evento no haya empezado.

**Sin superposiciones.** Para que dos corridas no se pisen, la corrida usa `GET_LOCK` (`conBloqueo`, como las Notas Digitales) y el índice único de envíos.

**Las invitaciones, los cambios y las cancelaciones** salen en el momento, al guardar, fuera de la transacción. Si el email falla, el evento se guarda igual y la falla queda registrada.

**Correos → Estado** suma una línea con la última corrida de los eventos, en el estilo de las líneas que ya muestra.

## 6. La pestaña Agenda

Las medidas, los colores y los textos están en la maqueta 1.

- **El mes:**
  - la grilla de lunes a domingo, con «‹», «›», «Hoy» y «Nuevo evento»;
  - en cada día, hasta 3 renglones y «y N más»;
  - los fines de semana y los feriados con otro fondo, y hoy marcado.
- **Los colores:** los eventos propios, en tinta; los compartidos, en violeta; tus licencias y francos, en verde (con el tipo, porque son tuyos); los feriados, en amarillo; y los compañeros que no están, en gris.
- **La leyenda,** debajo de la grilla.
- **Próximos, al costado:** agrupados en Hoy, Mañana, Esta semana y Más adelante. Cada uno muestra la hora, el título y si es solo tuyo, compartido con N personas o de otra persona, con su aviso.
- **Abrir un evento:** un clic en el evento, en la grilla o en la lista, lo abre:
  - si es tuyo, en el formulario de edición;
  - si es de otra persona, en el detalle (maqueta 2, «evento ajeno»), con «Mi recordatorio».
- **En el teléfono:** «Próximos» va primero y la grilla muestra puntos de colores por día.
- **El Resumen:** desde esta entrega, «Hoy y mañana» suma los eventos.

**Lo dibuja `mi-espacio.js`,** con funciones puras para el mes y para la lista, como `calendario.js`:
- los días se cuentan con `Date.UTC` sobre las partes de la fecha;
- la semana empieza el lunes;
- «hoy» es `Utils.hoyEnArgentina()`;
- todo texto pasa por `Utils.escapeHtml`.

## 7. La API

En `controllers/miEspacioController.js`, o en un controlador propio de eventos, con `authMiddleware` y siempre sobre `req.user.userId`:

| Ruta | Qué hace |
|---|---|
| `GET /api/mi-espacio/eventos?desde=&hasta=` | Lo que ve la persona en ese rango: sus eventos, los compartidos con ella y los «para todos», cada uno con `es_mio`, sus personas (solo nombres) y su recordatorio. Suma sus licencias de Mi espacio (con el tipo), los feriados (entrega 1) y las ausencias de los compañeros (entrega 2, sin el tipo). |
| `POST /api/mi-espacio/eventos` | Crea un evento. |
| `PUT /api/mi-espacio/eventos/:id` | Lo cambia; solo quien lo creó. |
| `DELETE /api/mi-espacio/eventos/:id` | Lo da de baja; solo quien lo creó. |
| `PUT /api/mi-espacio/eventos/:id/mi-recordatorio` | Una persona invitada apaga o prende el suyo. |
| `GET /api/mi-espacio/personas` | Los usuarios activos para elegir, con id, nombre e iniciales. Nada más: ni email, ni rol. |

**Errores:** un error de validación es 400 `{ success: false, error, campo }`; un id ajeno o que no existe, 404.

**Validación pura** en `services/miEspacioEventosReglas.js`: `validarEvento(entrada, hoy)` → `{ datos, error }`, que cuenta los caracteres con `Array.from`, y `momentoDelAviso(evento)`. Ninguna función tira.

## 8. Tests

- **`tests/mi-espacio-eventos-reglas.test.js` (puro):**
  - la validación en sus bordes;
  - `momentoDelAviso` con cada anticipación, cruzando la medianoche y el cambio de mes;
  - qué recordatorios tocan en una corrida: atrasada, con el evento ya empezado, apagado por un invitado y con el evento cambiado de hora.
- **`tests/mi-espacio-eventos-api.test.js` (Docker, con base propia):**
  - un evento personal es invisible para otro;
  - compartido con personas y para todos, incluido un usuario creado después;
  - solo quien lo creó cambia o borra, y el resto recibe 404;
  - los emails en Mailpit: invitación, cambio, cancelación y recordatorio;
  - un solo recordatorio aunque la corrida se repita;
  - nada a quien está de licencia;
  - `/api/cron/eventos`, con su clave y sin ella.
- **`tests/mi-espacio-frontend.test.js`:** el mes (con la semana desde el lunes, el cambio de año y «y N más»), los próximos, los colores y el formulario.
- **Los tests existentes que cambian:** `permisos.test.js` (las rutas nuevas y la del cron) y `schema.test.js` (las tablas, la migración y la vuelta atrás).

## 9. Documentación y despliegue

- **`CLAUDE.md`:**
  - la agenda dentro de Mi espacio;
  - las tablas nuevas;
  - la ruta del cron y su frecuencia en «Recordatorios automáticos»;
  - la aclaración del nombre frente a la Agenda de pedidos.
- **`README.md`:**
  - la migración;
  - la Tarea Cron nueva de cPanel, `*/15 * * * *`, con la URL y la clave, como las otras.
- **Despliegue:**
  - después de la entrega 2;
  - se corre `migracion-mi-espacio-agenda.sql` antes de subir el código;
  - se suben los archivos y se reinicia la aplicación;
  - se crea la Tarea Cron.

## Decisiones

**Del usuario (26/10/2026):**
- La agenda tiene eventos personales, que ve solo quien los crea, y compartidos con las personas que se elijan o con todos.
- El recordatorio es elegible por evento; si no se elige, sale 2 horas antes.
- En un evento compartido, el recordatorio les llega a todos.
- Solo quien creó el evento lo cambia o lo borra; si cambia, les llega un aviso a los demás.
- Hay dos vistas: el mes y la lista de próximos.
- Sale un email cuando te suman a un evento.
- En la agenda aparecen también las licencias propias, los feriados y quién no está.
- Quedan afuera los eventos que se repiten, los de todo el día y la exportación.

**Mías (para revisar):**
- Cada persona invitada puede apagar su propio recordatorio.
- «Todos» es una marca que incluye a los usuarios que se creen después.
- La hora «A» es opcional y el evento termina el mismo día.
- No salen emails a quien está de licencia ese día.
- Si la corrida se atrasa, el recordatorio sale igual mientras el evento no haya empezado.
- Un cron cada 15 minutos.
- El email de cambio sale solo si cambian la fecha, la hora o el título.
- La lista de personas para elegir trae solo el nombre.
- El prefijo `mi_espacio_` y la palabra «evento» en el código, para no confundir con la Agenda de pedidos.

## Lo que queda para quien lo construye

- Los nombres finales.
- Si los eventos van en el controlador de Mi espacio o en uno propio.
- El dibujo del mes en el teléfono.
- Cómo se ordena la lista de próximos dentro de un mismo día.
- El texto exacto de los emails, con el tono del RPAD.
