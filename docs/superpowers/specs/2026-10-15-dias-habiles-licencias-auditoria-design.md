# Días hábiles, licencias y auditoría de cambios pendientes

**Fecha:** 2026-10-15
**Estado:** diseño aprobado, pendiente de revisión de esta especificación

## 1. Objetivo

Tres mejoras al sistema de avisos del RPAD, que se diseñan juntas porque se apoyan unas en otras:

1. **Días hábiles.** Ningún recordatorio automático sale en un día no hábil. Hoy las Notas Digitales ya lo respetan, pero el email de cambios pendientes y el aviso a las áreas salen todos los días.
2. **Licencias.** Los usuarios que reciben avisos pueden tener períodos de licencia en los que el sistema no les escribe. Durante la licencia del firmante de las notas, las notas salen firmadas por una persona que él autorizó o, si no autorizó a nadie, se anticipan los avisos y se postergan las reiteraciones.
3. **Auditoría de cambios pendientes.** La doble verificación pasa a distinguir a quienes auditan (personal designado) de quienes proponen sin la responsabilidad formal de auditar. Si un cambio no se audita a tiempo, se le pide formalmente a la Dirección General con una Nota Digital numerada, que se reitera cada semana.

## 2. Alcance y entregas

Se implementa y despliega en tres entregas independientes, en este orden:

| Entrega | Contenido | Migración |
|---|---|---|
| **1. Días hábiles** | Sección 4 | No |
| **2. Licencias y firmas** | Secciones 5, 6 y 7 | Sí, aditiva |
| **3. Editor y auditoría** | Secciones 8, 9 y 10 | Sí, aditiva |

Cada entrega deja el sistema completo y funcionando. La entrega 2 tiene que estar en producción antes de la primera licencia del firmante que se quiera cargar.

**No cambian:** los textos y el formato de los avisos y reiteraciones de Notas Digitales (salvo el bloque de firma de la sección 7.2 y el asunto de la sección 7.3), el anexo, el aviso a las áreas (salvo su calendario), las invitaciones, la recuperación de contraseña y el formulario de contacto.

## 3. Conceptos

| Término | Significado |
|---|---|
| **Día hábil** | De lunes a viernes, excepto los feriados nacionales de fecha fija: 01/01, 24/03, 02/04, 01/05, 25/05, 20/06, 09/07, 08/12 y 25/12. Los feriados trasladables no se consideran. Es el calendario que ya usan las Notas Digitales (`services/notasDigitalesCalendario.js`). |
| **Hoy** | La fecha en `America/Argentina/Buenos_Aires`, nunca `CURDATE()`. |
| **Licencia** | Período `desde`–`hasta` (ambos incluidos) en el que un usuario no recibe emails del sistema. |
| **Firmante titular** | El usuario que firma las Notas Digitales. Se elige en la configuración de Correos. |
| **Autorizado** | Usuario al que el firmante titular autoriza a presentar las notas en su nombre durante una licencia. |
| **Víspera** | El último día hábil anterior al primer día de una licencia. |
| **Auditor** | Usuario con rol `superadmin` o `admin`. Aprueba y rechaza cambios de otros (entrega 3). |
| **Editor** | Rol nuevo (entrega 3): todo lo de un admin, pero audita cambios solo como respaldo (sección 8.2). |
| **Auditar** | Aprobar o rechazar un cambio pendiente. |
| **Disponible** (un día dado) | Activo, con contraseña definida y sin licencia ese día. |

## 4. Calendario hábil (entrega 1)

### 4.1 Email de cambios pendientes

`ejecutarNotificacionCambiosPendientes` (cron y ejecución manual) no envía nada si hoy no es día hábil. Responde 200 con `{ success: true, message: 'Hoy no es día hábil: no se envían recordatorios.', data: { dia_habil: false } }`. En un día hábil se comporta como hoy, hasta que la entrega 3 lo reemplaza por el recordatorio (sección 9.2).

### 4.2 Aviso a las áreas (40 días)

Hoy selecciona los datasets que vencen exactamente `CURDATE() + 40`, cualquier día de la semana. Pasa a:

- en un día no hábil no se envía nada;
- en un día hábil `D`, selecciona los datasets que vencen entre `D + 40` y `S + 39`, donde `S` es el día hábil siguiente a `D`. Así, cada día hábil avisa también lo que habría caído en los días no hábiles que siguen: un viernes avisa los vencimientos de viernes, sábado y domingo + 40; el día anterior a un feriado avisa también el del feriado. El aviso se anticipa, nunca se atrasa;
- `D` es la fecha de hoy en Argentina, no `CURDATE()`.

La vista previa y la prueba del aviso a las áreas usan la misma selección. Si un día hábil no hubo corrida (falló el cron), esos datasets no se avisan, igual que hoy.

### 4.3 Sin cambios

Las Notas Digitales ya cumplen el calendario. Las invitaciones, la recuperación de contraseña, los avisos al superadmin y el formulario de contacto salen en el momento, porque los dispara una persona.

### 4.4 Tareas cron

Siguen corriendo todos los días: cPanel no conoce los feriados y el código decide. El horario pasa a **8:15** (`/api/cron/notificaciones`) y **14:00** (`/api/cron/cambios-pendientes`). El código no depende de la hora, así que el cambio en cPanel se puede hacer en cualquier momento. Los textos que mencionan "08:00" (confirmación del interruptor en Correos y README) pasan a "08:15".

## 5. Licencias (entrega 2)

### 5.1 Quiénes y qué se guarda

- Pueden tener licencia los usuarios con rol `superadmin`, `admin` o `editor` (los que reciben avisos). Los lectores no.
- Se guarda: usuario, `desde`, `hasta`, autorizado (sección 6.3), quién la cargó y cuándo. **No se guarda el motivo**: una licencia por enfermedad es un dato sensible.
- Las licencias no se borran: se **anulan** y quedan registradas.

### 5.2 Carga y edición

Cargan licencias el superadmin, los admins y (desde la entrega 3) los editores, para cualquier usuario que pueda tenerla, incluido el superadmin.

| Estado de la licencia | Qué se puede hacer |
|---|---|
| **Futura** (`desde` > hoy) | Editar las fechas o anular |
| **En curso** (`desde` ≤ hoy ≤ `hasta`) | Cambiar solo `hasta`, a una fecha ≥ ayer (y ≥ `desde`): sirve para extenderla o para cortarla si la persona vuelve antes. Si empieza hoy, también se puede anular: como `hasta` no puede quedar antes de `desde`, no hay otra forma de dejarla sin efecto |
| **Pasada** | Nada |

Validaciones:
- `desde` ≤ `hasta`, y `hasta` ≥ hoy al crearla (una licencia pasada no tiene efecto);
- como máximo 365 días;
- no se superpone con otra licencia no anulada del mismo usuario;
- el usuario existe, está activo y tiene un rol que puede tener licencia;
- un usuario que es autorizado de otra licencia no puede tener una licencia que cubra todos los días hábiles de la del titular (sumada a las que ya tiene): una superposición parcial se permite (sección 6.3).

Cada alta, edición y anulación queda en el historial del panel (`usuarios_auditoria`). Si alguien que no es el superadmin carga, edita o anula **una licencia del superadmin**, corresponde el aviso al superadmin de siempre (retenido si ya está de licencia, sección 5.4).

### 5.3 Efecto en los emails personales

Mientras dura la licencia, el usuario **no recibe ningún email del sistema dirigido a su persona**:
- el email de cambios pendientes y, desde la entrega 3, el recordatorio y su respaldo;
- los avisos al superadmin: se **retienen** (sección 5.4).

Sí recibe los emails que pide él mismo o que son parte de un trámite de acceso: invitación y recuperación de contraseña.

Las notas a casillas institucionales (la DGMIT y sus copias) **no cambian** por la licencia de nadie: un usuario puede tener como email personal una casilla institucional, pero las notas no se dirigen al usuario sino a la casilla configurada. La única licencia que afecta a las notas es la del firmante titular (sección 7).

### 5.4 Avisos retenidos al superadmin

Si un aviso al superadmin corresponde mientras el superadmin está de licencia, no se envía: la fila del historial guarda el texto del aviso como **retenido**. En la corrida diaria del primer día hábil posterior a su licencia se le envía **un solo email de resumen** con los cambios retenidos (fecha, quién, qué, a quién) y un enlace al historial; al enviarse, las filas dejan de estar retenidas (el texto se borra). Si el envío falla, se reintenta en la corrida del día hábil siguiente. Este paso va aislado en la corrida diaria, como el aviso a las áreas: un error ahí no afecta a las Notas Digitales.

### 5.5 Pantalla

La pantalla de Usuarios pasa a tener dos pestañas: **Usuarios** (la de hoy) y **Licencias**.

- **Licencias:** lista de las licencias en curso y futuras (usuario, desde, hasta, autorizado si hay, quién la cargó) y, plegadas, las pasadas y anuladas. Formulario para cargar y editar, con las acciones de la tabla 5.2.
- **Usuarios:** junto al estado, una marca **"De licencia hasta dd/mm"** para quien está de licencia hoy, y **"Licencia desde dd/mm"** para quien tiene una próxima en los siguientes 30 días.
- Para el firmante titular, el formulario muestra el efecto en las notas (sección 7) y, si no hay autorizado, una advertencia: *"Los avisos anticipados salen en la corrida de las 8:15 del {víspera}. Cargá la licencia antes."*

## 6. Firmas, firmante titular y autorización (entrega 2)

### 6.1 Firma por persona

Cada usuario con rol `superadmin`, `admin` o `editor` puede cargar **su propia firma** en Mi Perfil: imagen (PNG o JPEG, 500 KB como máximo, con la misma validación que la firma actual), **nombre para la firma** (por ejemplo, "Nombre Apellido") y **cargo para la firma**. El nombre y el cargo se precargan con `nombre_completo` y `cargo` del usuario y se pueden ajustar. Nadie carga ni ve la firma de otro, salvo en la vista previa de una nota.

**Personal contratado** (`usuarios.vinculo = 'contrato'`, sin designación formal): su firma sale en tres renglones, el nombre, `Personal contratado, cumpliendo funciones de` (en letra más chica que el cargo) y el cargo; Mi Perfil le muestra cómo sale ("Así sale en las notas:"). El cargo guardado en la firma sigue siendo solo el cargo, y quien no es contratado (planta permanente, planta política o sin dato) firma como siempre.

Se guarda en una tabla aparte (`usuarios_firmas`), para que ninguna consulta de usuarios arrastre la imagen. Los textos de la firma pasan por el mismo resguardo de caracteres que el resto del PDF (NFC; se rechazan los caracteres que el PDF no puede escribir).

### 6.2 Firmante titular

- En Correos → Configuración se elige el **firmante titular** entre los usuarios `superadmin` o `admin` activos y con firma cargada. **Solo el superadmin** lo elige; los demás lo ven.
- Las notas usan la imagen, el nombre y el cargo de la firma del firmante titular.
- **Compatibilidad:** mientras no haya firmante titular elegido, las notas salen con la firma de la configuración de Correos, como hoy, y las licencias no afectan a las notas. Los campos de firma de Correos se editan solo en ese caso; con titular elegido muestran los datos de su firma, sin editarse.
- La carga inicial (elegir al firmante titular y pasarle la firma actual de Correos) se hace con un SQL privado no versionado (sección 13).

### 6.3 Autorización

- En una licencia del firmante titular, el campo **"Autorizo a presentar las notas en mi nombre a:"** lo completa, cambia o borra **solo el propio firmante titular**, en cualquier momento antes de que la licencia termine. Si otro usuario carga la licencia, la carga sin autorizado.
- Se puede autorizar a un usuario `admin` o (desde la entrega 3) `editor`, activo, con firma cargada y con al menos un día hábil sin licencia dentro de la licencia del titular. Si tiene una licencia propia que se superpone en parte, se la puede autorizar igual: los días en que falta se aplica la sección 7.3 (no se generan notas) y a su vuelta presenta las que correspondan. Si su licencia cubre todos los días hábiles de la del titular, el sistema responde 409: *"La persona autorizada está de licencia todos los días hábiles de tu licencia: no podría presentar ninguna nota."*
- El formulario de la licencia del titular lo advierte, debajo del selector, sin bloquear el guardado, con un texto por cada superposición: *"{nombre} va a estar de licencia del {dd/mm/aaaa} al {dd/mm/aaaa}: esos días no se generan notas. Desde el {dd/mm/aaaa} las presenta en tu nombre."* (sin la última frase si no vuelve antes de que termine la licencia del titular; *"…de licencia el {dd/mm/aaaa}: ese día no se generan notas."* si es un solo día). Cada texto es una ausencia: sus licencias unidas si las separan solo días no hábiles, como en el Estado (7.5), y recortadas a las fechas del formulario; el "Desde el" es el primer día hábil en que vuelve. Las ausencias las trae la lista de autorizables (sección 12) y el navegador solo las recorta.
- A la inversa, la persona autorizada puede cargar una licencia que se superponga en parte con la del titular; si con esa licencia (y las que ya tiene) no le quedara ningún día hábil dentro de la del titular, responde 409 y pide cambiar primero la autorización.
- Se registra la fecha y hora de la autorización (`autorizado_at`) y queda en el historial.
- La autorización se comunica formalmente con una Nota Digital numerada (sección 7.2): las notas que presenta la persona autorizada citan ese número.
- Cambiar o quitar a la persona autorizada, o cambiar las fechas de la licencia, deja sin efecto la nota de autorización anterior (dice a quién y entre qué fechas): si sigue habiendo una persona autorizada, sale una nota nueva (7.2).
- Si el día de una nota el autorizado ya no cumple las condiciones (fue desactivado o borró su firma), ese día se aplica el comportamiento sin autorizado (sección 7.3) y Correos → Estado muestra una alerta.

## 7. Notas Digitales durante la licencia del firmante (entrega 2)

### 7.1 Qué día es "de licencia"

Un día es de licencia del firmante si el firmante titular tiene ese día una licencia no anulada. Todo lo de esta sección se evalúa en cada corrida, con las licencias cargadas en ese momento. Una licencia sin ningún día hábil (por ejemplo, un fin de semana) no tiene efecto en las notas.

### 7.2 Con autorizado

**Víspera: avisos anticipados y autorización.** Los avisos se anticipan igual que sin autorizado (7.3), y cada aviso de la víspera suma, inmediatamente después del primer párrafo, el párrafo:

> Asimismo, por medio de la presente autorizo expresamente a {nombre del autorizado}, {cargo del autorizado}, a presentar en mi nombre las Notas Digitales durante mi licencia, del {dd/mm/aaaa} al {dd/mm/aaaa}, con el objetivo de mantener el correcto flujo de trabajo.

Si ese día no hay ningún aviso, sale igual una **nota de autorización** (un tipo nuevo de Nota Digital, sin gestión ni tablas), firmada solo por el titular:

> Por medio de la presente informo que, durante mi licencia del {dd/mm/aaaa} al {dd/mm/aaaa}, autorizo expresamente a {nombre del autorizado}, {cargo del autorizado}, a presentar en mi nombre las Notas Digitales de esta Dirección, con el objetivo de mantener el correcto flujo de trabajo.

- La nota de autorización va a los destinatarios de las notas (los "Para" de las dos gestiones, sin repetir) con el CCO de respaldo. Su asunto es `Nota Digital N° {n}/{aa} – Ref.: Autorización para la presentación de Notas Digitales (licencia del {dd/mm/aaaa} al {dd/mm/aaaa})`.
- Las notas que comunican la autorización (los avisos de la víspera o la nota de autorización) llevan en CC el email de la persona autorizada.
- La licencia guarda cuál fue la **primera** nota que comunicó la autorización (`usuarios_licencias.nota_autorizacion_id`); es la que citan las notas de la persona autorizada.
- **La autorización se comunica siempre en la víspera**, aunque la persona autorizada esté de licencia ese día: se la mira por la licencia entera del titular (le queda algún día hábil sin licencia propia, sección 6.3), no por la fecha de la corrida. Firma solo el titular, que todavía no está de licencia, y la persona autorizada va en CC igual. Las notas que presente después citan esa nota; cuando vuelve no sale una nota de autorización aparte.
- **Autorización tardía o cambiada:** si llega un día hábil, entre la víspera y el fin de la licencia, en que la persona autorizada vigente todavía no tiene nota de autorización (se cargó después de la corrida de la víspera, o se cambió de persona), esa corrida genera primero la nota de autorización, firmada por el titular, y después las demás, que ya la citan. Si ese día la persona autorizada también está de licencia, no sale nada y la nota de autorización sale el primer día hábil en que vuelve.

**Durante la licencia.** Las reiteraciones, los avisos que todavía correspondan (por ejemplo, un dataset nuevo) y las notas de auditoría salen en su fecha normal, presentadas por la persona autorizada. Los días en que la persona autorizada también está de licencia no se genera ninguna nota (7.3, como sin autorizado); el primer día hábil en que vuelve salen las que correspondan. Cambia el bloque de firma:

- **PDF:** dos firmas lado a lado, cada una con su imagen, nombre y cargo: el **firmante titular a la derecha** (la posición habitual) y el **autorizado a la izquierda**. Debajo, a todo el ancho y con letra más chica, la leyenda:

  > *Nota presentada por {nombre del autorizado}, {cargo del autorizado}, en nombre de {nombre del titular}, {cargo del titular}, conforme a la autorización conferida mediante Nota Digital N° {n}/{aa} (licencia del {dd/mm/aaaa} al {dd/mm/aaaa}).*

- **Email (HTML y texto):** los dos nombres y cargos, y la misma leyenda.
- La nota guarda quién firmó como titular y quién la presentó (sección 11.1).
- Si la nota de autorización no se pudo generar, ese día no se genera ninguna otra nota (se reintenta en la corrida siguiente).

**Personal contratado (6.1).** En el párrafo de la víspera, en la nota de autorización y en la leyenda, el cargo de una persona contratada se nombra en minúscula y en letra normal, `{nombre}, personal contratado, cumpliendo funciones de {cargo}`: *"… autorizo expresamente a {nombre del autorizado}, personal contratado, cumpliendo funciones de {cargo del autorizado}, a presentar …"* y *"Nota presentada por {nombre del autorizado}, personal contratado, cumpliendo funciones de {cargo del autorizado}, en nombre de {nombre del titular}, {cargo del titular}, conforme a …"* (si el titular también fuera contratado, su mención sigue la misma regla). En las dos firmas, el renglón más chico va solo en la de la persona contratada; los nombres y la base de las imágenes siguen alineados y la leyenda va debajo de la firma más alta.

### 7.3 Sin autorizado

**Avisos.** En la víspera (con o sin autorizado), el aviso de cada gestión incluye, además de lo de ese día, todo lo que se habría avisado durante la licencia: en la selección de la spec de Notas Digitales (5.2), el horizonte `hoy + ventana` se reemplaza por `U + ventana`, donde `U` es el último día hábil de la licencia. Sale **una sola nota por gestión**, con los datasets ordenados por vencimiento, como siempre. Hoy el asunto termina con el mes de la nota (`(gestión interna – noviembre 2026)`); en un aviso anticipado, en su lugar va el rango de meses de los vencimientos: `(gestión interna – vencimientos de enero a marzo 2027)`, o `(gestión interna – vencimientos de enero 2027)` si es un solo mes. Un aviso es anticipado si incluye algún dataset que en la selección normal de ese día no habría entrado.

**Días de licencia.** No se generan avisos, reiteraciones ni notas de auditoría. Los reintentos de notas fallidas generadas antes de la licencia siguen, porque su contenido ya está congelado.

**Reiteraciones.** No salen durante la licencia. En el primer día hábil posterior, la reiteración del mes en curso se evalúa si todavía no se evaluó (sección 5.3 de la spec de Notas Digitales): sale **una sola**, aunque la licencia haya cubierto el primer día hábil de más de un mes.

**Un aviso anticipado no adelanta las reiteraciones.** Al guardar un dataset en un aviso, si su fecha normal de aviso (el primer día hábil desde que su mes entra en la ventana: primer vencimiento del mes − ventana) es posterior a la fecha de la nota, se guarda esa fecha en `notas_digitales_datasets.cuenta_desde`. La regla de los 20 días de la reiteración se cuenta desde `cuenta_desde` cuando existe, y desde la fecha de la nota en los demás casos. En el calendario normal `cuenta_desde` queda vacío y no cambia nada.

**Carga tardía.** Si la licencia se carga después de la corrida de su víspera (por ejemplo, por una enfermedad), no hay anticipo: lo que se tendría que haber avisado durante la licencia sale en el primer día hábil posterior, porque la selección es por rango. Lo que para entonces ya venció entra en la reiteración, como cualquier vencido sin aviso.

### 7.4 Ejemplos

| Licencia | Víspera | Durante la licencia | Primer día hábil posterior |
|---|---|---|---|
| 26/11/2026 – 14/01/2027 | mié 25/11/2026: avisos de lo que vence hasta el 14/01/2027 + ventana (interna hasta mediados de marzo, externa hasta mediados de febrero, con los meses completos) | No salen la reiteración de diciembre (01/12) ni la de enero (04/01; el 01/01 es feriado) | vie 15/01/2027: sale la reiteración de enero |
| 25/01/2027 – 05/03/2027 | vie 22/01/2027 (el 24/01 es domingo) | No salen las reiteraciones del 01/02 ni del 01/03 | lun 08/03/2027: sale la reiteración de marzo |

Sin autorizado, como en la tabla. Con autorizado, la víspera sale lo mismo y además cada aviso lleva el párrafo de autorización (o sale la nota de autorización si no hay avisos); durante la licencia, las reiteraciones de cada mes (01/12 y 04/01 en el primer ejemplo; 01/02 y 01/03 en el segundo) salen en su fecha, presentadas por la persona autorizada con las dos firmas y la cita de la nota de autorización.

### 7.5 Correos → Estado

- Una línea con la próxima licencia o la licencia en curso del firmante titular y su efecto: *"Licencia del firmante del 26/11 al 14/01: los avisos se anticipan el 25/11 con la autorización a {nombre}, que presenta las demás notas durante la licencia"* o *"…: sin autorizado, los avisos se anticipan el 25/11 y las reiteraciones se postergan al 15/01"*.
- Las fechas de "próximo aviso" y "próxima reiteración" tienen en cuenta la licencia.
- Si la persona autorizada falta algunos días de la licencia del titular (6.3), al principio, en el medio o hasta el final, el Estado lo muestra mientras la persona autorizada esté de licencia el día que se evalúa (hoy o, si la licencia del titular todavía no empezó, su primer día hábil): la línea la nombra con *"(de licencia hasta el {dd/mm/aaaa})"* y aparece una **advertencia**, no un error: *"La persona autorizada está de licencia hasta el {dd/mm/aaaa}: hasta entonces no se generan notas."* Para el "hasta el", sus licencias cuentan como una sola si las separan solo días no hábiles.
- Alertas: autorizado que dejó de cumplir las condiciones (6.3: desactivado, sin firma cargada o de licencia todos los días hábiles de la del titular); firmante titular sin firma cargada.

## 8. Roles: editor y auditores (entrega 3)

### 8.1 Roles

`usuarios.rol` pasa a `ENUM('superadmin','admin','editor','lector')`.

| Acción | superadmin | admin | editor | lector |
|---|---|---|---|---|
| Todo el área de administración (datasets, áreas, correos, reportes, gestión) | Sí | Sí | Sí | No |
| Proponer cambios | Sí | Sí | Sí | No |
| Auditar cambios de otros | Sí | Sí | Solo de respaldo (8.2) | No |
| Panel de usuarios: ver, historial, licencias | Sí | Sí | Sí | No |
| Panel de usuarios: crear, editar, activar, desactivar y enviar links a **lectores** | Sí | Sí | Sí (solo crea lectores) | No |
| Panel de usuarios: crear admins o editores, cambiar roles, modificar admins o editores | Sí | Sí | **No** | No |
| Cargar su propia firma (Mi Perfil) | Sí | Sí | Sí | No |

El editor no puede modificar a otros editores: cambiándole el email y enviándole un link podría quedarse con su cuenta.

En el código:
- `esAdmin(rol)` (acceso al área de administración, `adminOnly`) pasa a incluir `editor`.
- Se agrega `esAuditor(rol)` (`superadmin` o `admin`). Lo usan: auditar cambios, el mínimo de aprobadores, `esAprobadorActivo` y los destinatarios del recordatorio. **Cada uso actual de `esAdmin` se revisa** para decidir si es acceso o auditoría.
- Frontend: `Auth.isAdmin()` incluye al editor; se agrega `Auth.isAuditor()`. El header muestra **Editor**.
- `ROLES_ASIGNABLES` pasa a `['admin', 'editor', 'lector']`.
- Los avisos al superadmin que hoy se refieren a un admin o a un aprobador (crear, cambiar el email, reactivar) pasan a cubrir también a los editores.

### 8.2 Quién audita un cambio

En un día dado, pueden auditar un cambio:
1. los **auditores disponibles** que no lo propusieron;
2. si no hay ninguno, los **editores disponibles** que no lo propusieron (**respaldo**).

El backend aplica la regla al aprobar y al rechazar. Si no corresponde, responde 403 con: *"Este cambio lo auditan {nombres}. Podés auditarlo solo si ninguno está disponible."* Cuando un editor audita de respaldo, el cambio queda marcado (`revisado_como_respaldo`) y el historial de cambios lo muestra: *"Aprobado por {nombre} (respaldo)"*.

En Mi Perfil → Para revisar, el editor ve los cambios, pero los botones de aprobar y rechazar aparecen deshabilitados con el mismo mensaje cuando no le corresponde.

### 8.3 Mínimo de auditores

La regla "siempre al menos 2 aprobadores activos" pasa a contar **auditores** (`superadmin` o `admin`, activos y con contraseña). Pasar a un admin a editor cuenta como quitar un auditor. Las licencias no cuentan para el mínimo, porque son temporales.

### 8.4 Paso inicial

Después del despliegue, el superadmin pasa a editor, desde el panel, a los admins que corresponda. No hace falta SQL privado.

## 9. Circuito de cambios pendientes (entrega 3)

### 9.1 Canal de cada cambio

En cada corrida de un día hábil, cada cambio pendiente está en **uno** de dos canales:

- **Nota**, si se cumplen las cuatro condiciones:
  1. ya tuvo sus dos recordatorios: el primero (sección 9.2), hace dos días hábiles o más (cambio del 16/10/2026: antes, un día hábil anterior);
  2. el **firmante titular no puede auditarlo** hoy: lo propuso él, o no está disponible (por ejemplo, está de licencia);
  3. hay **auditores** disponibles para el cambio (no es de respaldo);
  4. hay quién firme: el firmante titular si no está de licencia, o su autorizado si el titular está de licencia y la persona autorizada no (sección 7).
- **Recordatorio**, en cualquier otro caso.

Si el firmante titular puede auditarlo, una nota suya pidiendo que lo audite otro no tendría sentido: ese cambio sigue con recordatorios. Sin firmante titular elegido (6.2), la condición 2 se evalúa con el usuario superadmin y la condición 4 se cumple siempre (firma la configuración de Correos).

### 9.2 Recordatorio (14:00)

Reemplaza al email de cambios pendientes de las 13:00, en la misma ruta (`/api/cron/cambios-pendientes`) y con su ejecución manual.

- Solo en días hábiles.
- Incluye los cambios del canal recordatorio propuestos al menos **una hora** antes de la corrida.
- Cada persona que puede auditarlos (8.2) y está disponible recibe un email con sus cambios, como hoy. Si los recibe como respaldo, el email lo dice: *"Te llega como respaldo: no hay auditores disponibles."*
- Asunto: `[RPAD] {n} cambio(s) esperan tu auditoría`.
- La primera vez que un cambio se incluye en un recordatorio enviado con éxito se guarda la fecha (`primer_recordatorio_at`).
- Se repite cada día hábil mientras el cambio siga pendiente y en el canal recordatorio.

### 9.3 Nota de auditoría (8:15)

En la corrida diaria de las Notas Digitales, después de los avisos y las reiteraciones, bajo el mismo bloqueo y con el mismo interruptor de envío automático:

- **Nuevos:** los cambios del canal nota que nunca estuvieron en una nota de auditoría.
- **Reiterados:** los cambios del canal nota cuya última nota de auditoría es de hace **5 días hábiles o más**.
- Si hay alguno, se genera **una sola nota** ese día, con una sección para cada grupo que tenga cambios.

Un cambio en el canal nota no recibe recordatorios. Si deja de cumplir las condiciones (por ejemplo, el auditor se toma licencia y pasa a respaldo), vuelve al canal recordatorio desde la corrida siguiente.

Un cambio cuenta como incluido en una nota desde que la nota se genera, en cualquier estado, como los avisos. Si el envío falla, se reintenta como cualquier Nota Digital.

### 9.4 Ejemplos

- **Propone el firmante titular el viernes a las 10:00; hay otro auditor disponible.** Viernes y lunes 14:00: recordatorio al otro auditor. Martes 8:15: nota de auditoría. Si sigue pendiente, la nota se reitera el martes siguiente a las 8:15.
- **Propone un editor; el firmante titular está disponible.** Recordatorio diario al firmante titular y a los demás auditores disponibles. Nunca sale nota.
- **El firmante titular está de licencia con autorizado; propone un editor.** Recordatorio a los auditores disponibles el día del primero y el día hábil siguiente; la nota de auditoría con las dos firmas (7.2) sale el segundo día hábil después del primero.
- **Propone el firmante titular; el único otro auditor está de licencia.** Respaldo: recordatorio diario a los editores disponibles. No sale nota.
- **El firmante titular está de licencia sin autorizado.** Recordatorios a quienes puedan auditar. No sale nota. Al primer día hábil posterior, los cambios que cumplen las condiciones se escalan.

### 9.5 Días sin auditor

Si todos los auditores están de licencia a la vez, el circuito de 9.1 a 9.3 no le avisa a nadie: los cambios quedan sin recordatorio ni nota y los datasets siguen bloqueados. Esta sección lo hace visible en tres lugares: el formulario de licencias, el aviso a quien propone y Correos → Estado.

**Definiciones**
- **Día sin auditor:** un día hábil (sección 3) en el que ninguna persona con rol `superadmin` o `admin` está **disponible** (sección 3: activa, con contraseña y sin licencia ese día). Los editores no cuentan: se informan como **respaldo** (8.2).
- **Período sin auditor:** días sin auditor seguidos, contando solo días hábiles. Un fin de semana o un feriado en el medio no cortan el período: el 31/12 y el 4/1 quedan en el mismo.
- **`vuelve`:** el primer día hábil posterior al período en que hay algún auditor disponible. Se busca hasta 366 días hacia adelante; si no hay, `vuelve` es nulo.
- Un auditor de licencia que igual entra al sistema puede aprobar (8.2): por eso los textos dicen "sin auditor disponible", nunca "nadie puede aprobar".
- La disponibilidad se decide en un solo lugar (`disponibilidad`, usada por `personasDeAuditoria` y por la lectura por rango `personasPorDia`) y los períodos los calcula `periodosSinAuditor`, con una consulta de usuarios y una de licencias para todo el rango.

**API:** `GET /api/usuarios/licencias/sin-auditor` (`adminOnly`). Con `desde` y `hasta` (`AAAA-MM-DD`) devuelve los períodos dentro de ese rango; `usuario_id` suma esa licencia (la del formulario, todavía sin guardar) y `excluir` ignora la licencia guardada que se está editando. Sin fechas, de hoy a hoy + 60 días (con `usuario_id` o `excluir`, las dos fechas son obligatorias). Fechas inválidas o incompletas, `desde` posterior a `hasta` o más de 366 días: 400 con `campo` `fechas`. Respuesta: `{ periodos: [{ desde, hasta, vuelve, respaldo: [nombres] }] }` (`respaldo`: los editores disponibles en al menos uno de los días del período, por nombre y sin repetir).

**Formulario de licencias (5.5).** Debajo de las fechas, un aviso que se actualiza al cambiar la persona o las fechas (con una espera corta, y descartando respuestas viejas). Cuenta la licencia que se está cargando como una más y, al editar, no cuenta dos veces la guardada. No bloquea el guardado, y si las fechas están incompletas o son inválidas no aparece. Los días que ya pasaron no se consultan. Un párrafo por período:
- Varios días: `Del {dd/mm/aaaa} al {dd/mm/aaaa} no va a haber ningún auditor disponible: los cambios que se propongan en esos días van a quedar pendientes hasta el {vuelve}.`
- Un solo día: `El {dd/mm/aaaa} no va a haber ningún auditor disponible: los cambios que se propongan ese día van a quedar pendientes hasta el {vuelve}.`
- Sin `vuelve`: el cierre es `… van a quedar pendientes hasta que haya un auditor disponible.`
- Con respaldo, se suma ` En esos días solo pueden auditar de respaldo: {nombres separados por coma y "y"} (nunca un cambio propio).` (en un solo día, "ese día").

En la pestaña Licencias, arriba de "En curso y próximas", el encabezado `Próximos días sin auditores disponibles:` y un renglón por período con el mismo texto (hoy + 60 días). Se recarga al guardar o anular una licencia y no se muestra si no hay períodos.

**Aviso a quien propone** (recordatorio de las 14:00, 9.2). Un cambio entra al aviso si cumple las tres:
1. entra en el recordatorio (canal recordatorio, propuesto hace una hora o más);
2. hoy no tiene a nadie que pueda auditarlo: ningún auditor disponible ni, de respaldo, ningún editor disponible que no sea quien lo propuso;
3. todavía no se le avisó a quien lo propuso (`cambios_pendientes.aviso_sin_auditores_at` es NULL).

Se agrupa por quien propuso y se le manda **un email** con todos sus cambios en esa situación, solo si esa persona está disponible. Si está de licencia, no se manda: queda sin marcar y sale a su vuelta, si el cambio sigue sin auditor. Si está inactiva o ya no tiene rol de auditoría ni de edición, no se manda. Si el email se envió, se guarda `aviso_sin_auditores_at` (hora de Argentina): el aviso sale **una sola vez por cambio**. Un email inválido, una falla de envío o de guardado quedan en los errores de la corrida con el usuario.
- Asunto, con un cambio: `[RPAD] Tu cambio en {dataset} queda sin auditor disponible hasta el {dd/mm/aaaa}`; con varios: `[RPAD] {n} cambios tuyos quedan sin auditor disponible hasta el {dd/mm/aaaa}`. Si no hay fecha, en lugar de "hasta el …": `por ahora`.
- Cuerpo: `Hasta el {dd/mm/aaaa} no hay ningún auditor disponible para revisar {este cambio | estos cambios}.` (sin fecha: `Por ahora no hay …`); la lista de cambios (tipo, conjunto de datos y fecha de la propuesta, como en el recordatorio); y el cierre: `Mientras tanto, el conjunto de datos sigue bloqueado para nuevas modificaciones. Apenas vuelva a haber un auditor disponible, le llega el recordatorio.`
- La fecha es el primer día hábil, desde el siguiente, en que alguien puede auditar el cambio (un auditor o, de respaldo, un editor que no sea quien lo propuso), o ninguna si no hay uno a la vista.
- El resultado de la corrida suma `sin_auditor: [{ usuario, cambios, hasta }]`.

**Correos → Estado (10.4).** Debajo de la línea de auditoría:
- si hay cambios pendientes sin nadie que pueda auditarlos en la próxima corrida (`sin_quien_audite`), una alerta: `Hoy {n} cambios no tienen ningún auditor ni editor de respaldo disponible.` (o `Hoy 1 cambio no tiene ningún auditor ni editor de respaldo disponible.`);
- si hay períodos (`periodos_sin_auditor`, de la próxima corrida a hoy + 60 días): `Próximos días sin auditores disponibles: del {dd/mm/aaaa} al {dd/mm/aaaa} (vuelve a haber auditor el {dd/mm/aaaa})`, uno por período, separados por `; ` y terminado en punto; sin `vuelve`: `(sin fecha de vuelta)`.

## 10. Nota de auditoría: contenido (entrega 3)

Es una **Nota Digital**: mismo libro, numeración correlativa compartida con avisos y reiteraciones, membrete, PDF adjunto, reintentos y estado. No lleva anexo.

### 10.1 Destinatarios

Configurables en Correos → Configuración:
- `para_auditoria`: por defecto `mit@comodoro.gov.ar`;
- `cc_auditoria`: por defecto vacío;
- CCO: el `cco` general de las notas.

### 10.2 Asunto

- Con cambios nuevos: `Nota Digital N° {n}/{aa} – Ref.: Solicitud de auditoría de cambios en el Registro Permanente de Actualización de Datasets`.
- Solo con reiterados: `Nota Digital N° {n}/{aa} – Ref.: Reiteración – Solicitud de auditoría de cambios en el Registro Permanente de Actualización de Datasets`.

### 10.3 Estructura

1. `REF.:` con el texto del asunto, `Nota Digital N°` a la derecha y el destinatario `DIRECCIÓN GENERAL DE MODERNIZACIÓN E INVESTIGACIÓN TERRITORIAL`, como en las otras notas.
2. **Párrafo inicial:**
   > Me dirijo a Ud. a fin de solicitarle la auditoría de los cambios propuestos en el Registro Permanente de Actualización de Datasets (RPAD) que se detallan a continuación, que se encuentran pendientes de verificación. Conforme al procedimiento de doble verificación, cada modificación del registro debe ser revisada y aprobada por una persona distinta de quien la propuso antes de aplicarse.
3. **Cambios pendientes de auditoría** (nuevos) y **Cambios ya solicitados que continúan pendientes** (reiterados, con la columna "Solicitado en": `Nota Digital N° 12/26 (dd/mm/aaaa)` y, si corresponde, `– reiterado N veces`). Columnas comunes: conjunto de datos, tipo de cambio (alta, modificación, baja), propuesto por (nombre y cargo; si quien propuso es personal contratado, `{nombre}, personal contratado, cumpliendo funciones de {cargo}`, 6.1), fecha de la propuesta y **días hábiles pendiente** (días hábiles transcurridos desde la fecha de la propuesta, sin contarla).
4. **Detalle de cada cambio:**
   - **modificación:** los campos que cambian, con el valor anterior y el nuevo;
   - **alta:** los datos principales del dataset propuesto;
   - **baja:** el dataset que se daría de baja.

   Las etiquetas de los campos son las del formulario del dataset. Los textos largos se transcriben completos en el PDF.
5. **Qué implica la auditoría:**
   > La auditoría consiste en verificar que:
   > - los datos coincidan con la información remitida por el área responsable;
   > - el enlace al Portal de Datos Abiertos funcione y muestre la versión informada;
   > - las fechas de última y próxima actualización sean coherentes con la frecuencia del conjunto de datos;
   > - el título, la descripción, el área, los temas, los formatos y "qué se solicita" sean correctos.
   >
   > Cada cambio se aprueba o se rechaza, con un comentario, desde el RPAD: {APP_URL}/perfil.html (sección "Para revisar").
6. **Importancia:**
   > Mientras un cambio no se audita, el conjunto de datos permanece bloqueado para nuevas modificaciones y el registro no refleja su estado real, lo que afecta los avisos y reiteraciones que emite esta Dirección y el cumplimiento de la Ordenanza N° 17.662/23. Por ello, solicito tenga a bien realizar la auditoría a la brevedad.
7. Remitente (`DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN, {fecha larga}.`) y firma: la del firmante titular o, en su licencia con autorizado, las dos firmas con la leyenda (7.2).

El HTML, el texto y el PDF se construyen desde la misma estructura, como las demás notas. Todo dato de la base se escapa en el HTML y pasa por el resguardo de caracteres en el PDF.

### 10.4 Libro y pantalla

- El libro muestra el tipo **Auditoría** y se puede filtrar por él. En las notas de auditoría la columna de gestión queda vacía.
- El detalle de la nota lista los cambios incluidos.
- Correos → Vista previa y prueba: se agrega el tipo "auditoría" (con datos reales del día o de ejemplo).
- Correos → Estado: cantidad de cambios en el canal nota y fecha de la próxima nota de auditoría.

## 11. Datos

Todas las migraciones son aditivas e idempotentes (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`), con su rollback, y se reflejan en `database/schema.sql` y `tests/schema.test.js`.

### 11.1 Entrega 2: `migracion-licencias-firmas.sql`

**`usuarios_licencias`**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | INT PK AI | |
| `usuario_id` | INT, FK → `usuarios` | |
| `desde`, `hasta` | DATE | Ambos incluidos |
| `autorizado_id` | INT NULL, FK → `usuarios` | Solo en licencias del firmante titular |
| `autorizado_at` | DATETIME NULL | Cuándo se registró la autorización |
| `nota_autorizacion_id` | INT NULL | Primera nota que comunicó la autorización vigente (7.2); se vacía al cambiar las fechas o la persona autorizada |
| `anulada` | TINYINT(1) DEFAULT 0 | |
| `creado_por` | INT NULL, FK → `usuarios` | |
| `created_at`, `updated_at` | TIMESTAMP | |

Índice `(usuario_id, desde, hasta)`.

**`usuarios_firmas`**

| Columna | Tipo | Notas |
|---|---|---|
| `usuario_id` | INT PK, FK → `usuarios` | |
| `nombre` | VARCHAR(150) | Nombre para la firma |
| `cargo` | VARCHAR(200) | Cargo para la firma |
| `imagen` | MEDIUMBLOB | |
| `mime` | VARCHAR(20) | |
| `updated_at` | TIMESTAMP | |

**Columnas nuevas:**
- `notas_digitales_config.firmante_usuario_id` INT NULL;
- `notas_digitales.firmante_id` INT NULL y `notas_digitales.presentada_por_id` INT NULL (titular y autorizado de cada nota);
- `notas_digitales.tipo` suma `'autorizacion'` y `notas_digitales.gestion` admite NULL (la nota de autorización no tiene gestión). Todo el código que lee `gestion` se revisa. El rollback deja estas dos columnas ampliadas, para no borrar notas numeradas del libro: el código anterior funciona igual con ellas;
- `notas_digitales_datasets.cuenta_desde` DATE NULL (7.3);
- `usuarios_auditoria.aviso_retenido` VARCHAR(300) NULL (5.4): el texto del aviso al superadmin que no se envió; NULL = nada retenido.

### 11.2 Entrega 3: `migracion-editor-auditoria.sql`

- `usuarios.rol`: `ENUM('superadmin','admin','editor','lector')`.
- `cambios_pendientes.primer_recordatorio_at` DATETIME NULL, `cambios_pendientes.revisado_como_respaldo` TINYINT(1) DEFAULT 0 y `cambios_pendientes.aviso_sin_auditores_at` DATETIME NULL (cuándo se le avisó a quien propuso que su cambio no tiene a nadie que lo audite, 9.5).
- `notas_digitales.tipo`: agrega `'auditoria'` (`gestion` ya admite NULL desde la entrega 2).
- **`notas_digitales_cambios`:** `nota_id` (FK → `notas_digitales` ON DELETE CASCADE), `cambio_id` (FK → `cambios_pendientes` ON DELETE CASCADE), `seccion` ENUM('nuevo','reiterado'). PK `(nota_id, cambio_id)` e índice `(cambio_id)`. Las notas de prueba no registran filas.
- `notas_digitales_config.para_auditoria` VARCHAR(500) DEFAULT `'mit@comodoro.gov.ar'` y `cc_auditoria` VARCHAR(500) NULL.

El rollback de la entrega 3 primero pasa a `admin` a los usuarios con rol `editor` y quita las columnas nuevas de `cambios_pendientes` (se pierde, entre otras, la fecha del aviso de días sin auditor). Como el de la entrega 2, deja `notas_digitales.tipo` ampliado para no borrar notas numeradas del libro.

## 12. API

### Entrega 2

| Método | Ruta | Quién | Uso |
|---|---|---|---|
| GET | `/api/usuarios/licencias` | admin | Licencias en curso y futuras; `?incluir_pasadas=1` agrega pasadas y anuladas |
| POST | `/api/usuarios/licencias` | admin | Alta `{ usuario_id, desde, hasta, autorizado_id? }` |
| PUT | `/api/usuarios/licencias/:id` | admin | Edición según la tabla 5.2 |
| POST | `/api/usuarios/licencias/:id/anular` | admin | Solo licencias futuras o que empiezan hoy |
| GET | `/api/auth/profile/firma` | admin | Nombre, cargo y si hay imagen, de la propia firma |
| PUT | `/api/auth/profile/firma` | admin | `{ nombre, cargo, imagen?, mime? }` de la propia firma |
| GET | `/api/auth/profile/firma/imagen` | admin | Imagen de la propia firma |
| PUT | `/api/notificaciones/notas-digitales/config/firmante` | superadmin | `{ usuario_id }` |

"admin" = `adminOnly` (superadmin, admin y, desde la entrega 3, editor). `autorizado_id` solo lo acepta el backend si quien llama es el firmante titular y la licencia es suya; en otro caso responde 403. Cada persona de `autorizables` (en `GET /api/usuarios/licencias`) trae `licencias: [{ desde, hasta }]`, las suyas no anuladas que no terminaron, y `ausencias: [{ desde, hasta, vuelve }]`, esas mismas unidas si las separan solo días no hábiles, con `vuelve`, el primer día hábil después de cada una: con ellas el formulario arma el aviso de la sección 6.3.

### Entrega 3

- Se agrega `tipo=auditoria` a vista previa, PDF de vista previa, prueba y filtros del libro.
- `PUT /config` acepta `para_auditoria` y `cc_auditoria`.
- Aprobar y rechazar aplican la regla 8.2.
- Las rutas del panel aplican la tabla 8.1 para el editor (403 con mensaje en lo que no puede hacer).

## 13. Despliegue

Por entrega, siempre: backup (phpMyAdmin → Exportar con DROP TABLE, y zip de las carpetas del código), migración antes que el código, archivos por zip en `/home/datospublicos/rpad`, Restart en Setup Node.js App y verificación. Cada entrega lleva su `PASOS.txt`.

- **Entrega 1:** sin migración. Archivos y Restart. Cambiar en Tareas Cron 8:00 → 8:15 y 13:00 → 14:00 (en cualquier momento).
- **Entrega 2:** migración, archivos y Restart. Después, SQL privado (`database/privado/`, no versionado) que elige al firmante titular y le copia la firma de la configuración de Correos. Después, cada usuario que pueda ser autorizado carga su firma en Mi Perfil.
- **Entrega 3:** migración, archivos y Restart. Después, el superadmin pasa a editor a quien corresponda desde el panel y revisa en Correos los destinatarios de auditoría.

## 14. Pruebas

TDD con la batería completa antes y después de cada tarea (`npm test`, contra Docker y Mailpit). Ningún test nuevo rompe uno existente.

- **Calendario (entrega 1):**
  - el email de cambios pendientes no sale en sábado, domingo ni feriado fijo y sí en un feriado trasladable;
  - aviso a las áreas: un viernes incluye los vencimientos de viernes, sábado y domingo + 40; el día antes de un feriado incluye el del feriado; un día no hábil no envía nada; se usa la fecha argentina.
- **Licencias (entrega 2):**
  - validaciones de la tabla 5.2, superposición, máximo de 365 días y roles;
  - solo el firmante titular pone el autorizado; condiciones del autorizado, incluida la licencia propia que se superpone en parte (se permite) o que cubre todos los días hábiles de la del titular (409);
  - un usuario de licencia no recibe el email de cambios pendientes;
  - aviso al superadmin retenido y resumen el primer día hábil posterior, una sola vez;
  - historial de altas, ediciones y anulaciones.
- **Notas con licencia del firmante (entrega 2), con los ejemplos de 7.4 como fechas fijas:**
  - sin autorizado: avisos anticipados en la víspera, una nota por gestión, con el asunto con rango de meses; nada durante la licencia; una sola reiteración a la vuelta; `cuenta_desde` retrasa la reiteración de un aviso anticipado; carga tardía;
  - con autorizado: la víspera anticipa los avisos con el párrafo de autorización (o sale la nota de autorización si no hay avisos), la licencia guarda esa nota y durante la licencia las reiteraciones salen en su fecha con dos firmas y la leyenda que cita su número; autorización tardía o cambiada;
  - sin firmante titular elegido: todo como hoy (la batería actual de Notas Digitales sigue en verde sin cambios);
  - en el calendario normal, `cuenta_desde` queda vacío y la selección de reiteraciones no cambia.
- **Editor y auditoría (entrega 3):**
  - permisos de la tabla 8.1, incluido que el editor no puede cambiarse el rol ni modificar a otro editor;
  - regla de respaldo al aprobar y al rechazar, y marca `revisado_como_respaldo`;
  - mínimo de 2 auditores;
  - canal de cada cambio en los casos de 9.4;
  - recordatorio: hora de antigüedad, destinatarios, respaldo y `primer_recordatorio_at`;
  - nota de auditoría: nuevos, reiterados a los 5 días hábiles, una sola nota por día, numeración compartida, contenido, firma y destinatarios, sobre los emails de Mailpit;
  - rollback con y sin editores.

Después de cada entrega, verificación manual en el navegador (Usuarios, Licencias, Mi Perfil, Correos) y una prueba real solo a las casillas de prueba.

## 15. Fuera de alcance

- Feriados trasladables y calendario de feriados editable.
- Licencias de lectores.
- Delegar la auditoría de una persona a otra durante su licencia (la regla de respaldo cubre la falta de auditores).
- Notificar al proponente cuando su cambio se aprueba o rechaza.
- Funciones de Correos exclusivas del superadmin, salvo elegir al firmante titular.
