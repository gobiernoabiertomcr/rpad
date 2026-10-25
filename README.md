![RPAD - Registro Permanente de Actualización de Datasets](public/img/logo-2025.png)

# RPAD - Registro Permanente de Actualización de Datasets

![Versión](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-v22.18.0-green.svg)
![License](https://img.shields.io/badge/License-CC%20BY--SA%204.0-blue)

Sistema de seguimiento y gestión de actualización de datasets para la Municipalidad de Comodoro Rivadavia.

**Versión actual:** 2.0.0

## Descripción

RPAD permite registrar datasets, asignarles frecuencias de actualización y monitorear su estado. El sitio público le muestra a la ciudadanía cuánto del registro está al día (el índice de actualización), todos los conjuntos de un vistazo y qué vence en los próximos meses; el equipo y las áreas siguen ahí los vencidos y los próximos a vencer, diferenciando entre gestión interna y externa. Incluye un sistema de doble verificación donde un operador propone cambios y un segundo operador los aprueba o rechaza antes de que se apliquen.

## Tecnologías

- **Backend**: Node.js + Express (JavaScript ES Modules)
- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Base de datos**: MySQL/MariaDB
- **Autenticación**: JWT
- **Gráficos**: SVG y HTML propios (la portada, el calendario y Métricas), sin librerías por CDN
- **Tipografía**: Bricolage Grotesque (títulos) y Figtree (texto), de Google Fonts
- **Íconos**: Lucide, como SVG embebidos
- **Email**: Nodemailer
- **PDFs**: PDFKit
- **DOCX:** docx (generación programática de documentos Word)
- **QR:** qrcode (código QR del anexo de las Notas Digitales, dibujado como vectores en el PDF)

## Roles de Usuario

El sistema cuenta con cinco roles de usuario:

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| `superadmin` | Administrador con la cuenta protegida | Todo lo de `admin`. Su cuenta solo la modifica su titular. Recibe un email cuando otro usuario crea un admin o un editor, cambia un rol, cambia el email de un admin o un editor, reactiva a uno de ellos o desactiva a alguien. Se asigna por SQL, no desde la aplicación. |
| `admin` | Administrador completo | Proponer creación, edición y eliminación de datasets. Aprobar o rechazar cambios propuestos por otra persona. Gestionar áreas y usuarios. Configurar notificaciones SMTP. Generar reportes y notas. Cargar las métricas manuales de Métricas y Reportes. |
| `editor` | Administrador sin la responsabilidad formal de auditar | Todo lo de `admin`, con tres diferencias: audita cambios de otros **de respaldo** (si ese día no hay ningún auditor disponible) o, los que propuso un auditor, **sin responsabilidad por la auditoría** (si hay auditores disponibles), en el panel de usuarios solo crea y modifica lectores y colaboradores (y solo pasa a alguien de lector a colaborador o al revés) y no puede ser firmante titular de las Notas Digitales. Puede tener licencia, cargar su firma y ser la persona autorizada del firmante. |
| `colaborador` | Lector que carga notas DGMIT | Todo lo de `lector` y, además, carga las notas DGMIT en Herramientas → Seguimiento (y corrige o anula las que cargó). No modifica datasets, no audita cambios y no entra a la administración. Pensado para el personal de la DGMIT (ver [Notas DGMIT](#notas-dgmit)). |
| `lector` | Solo lectura | Ver todas las secciones (portada, calendario, datasets, Métricas y Reportes, notas, Gestión, Seguimiento) sin poder modificar datos. |

Los cambios sobre datasets requieren doble verificación: alguien propone y otra persona aprueba o rechaza. Auditan los **auditores** (superadmin y admins). Un editor audita **de respaldo** si ese día no hay ningún auditor disponible que no lo haya propuesto, y el cambio queda "aprobado o rechazado de respaldo". Si hay auditores disponibles, un editor puede aprobar o rechazar el cambio que propuso un auditor (por ejemplo, cuando un auditor se lo pide), y queda "aprobado o rechazado **sin responsabilidad por la auditoría**": Mi Perfil se lo avisa antes y lo muestra después. El cambio que propuso un editor, con auditores disponibles, lo auditan ellos. Los usuarios con rol `lector` ven el mensaje "Solo lectura" en lugar de los botones de acción.

**Días sin auditor:** un día hábil en el que ningún superadmin ni admin está disponible (activo, con contraseña y sin licencia; los editores no cuentan, se informan como respaldo). Los días hábiles seguidos forman un período (un fin de semana o un feriado en el medio no lo cortan) y cada período dice cuándo vuelve a haber un auditor. El sistema lo avisa en tres lugares: el formulario de licencias advierte los días sin auditor que dejaría esa licencia (sin bloquear el guardado); a quien propone un cambio que hoy no tiene a nadie que lo audite le llega, en el recordatorio de las 14:00, un único aviso por cambio con la fecha de vuelta; y Correos → Estado muestra cuántos cambios no tienen a quién pedirle la auditoría y los próximos períodos.

### Panel de usuarios

En **Administración → Usuarios**, admin y superadmin pueden (el editor, solo sobre lectores y colaboradores, y como cambio de rol solo de lector a colaborador o al revés):

- **Crear usuarios.** El usuario nuevo recibe un email con un link para elegir su contraseña (vence en 72 h). Nadie ve ni envía contraseñas.
- **Editar** nombre, usuario, email, cargo, vínculo (planta permanente, planta política o contrato) y rol (admin, editor, colaborador o lector). Debajo del rol, una línea explica qué puede hacer cada uno.
- **Desactivar y reactivar.** Desactivar cierra las sesiones de esa persona en el acto. Los usuarios nunca se borran.
- **Enviar un link para restablecer la contraseña** (vence en 2 h), o reenviar la invitación. Cambiar el email de un usuario o desactivarlo anula sus links pendientes: hay que reenviarle el link.
- **Ver el historial** de cambios de cada usuario.
- **Licencias** (pestaña Licencias): fechas de licencia de admins, editores y del superadmin. Durante la licencia esa persona no recibe emails del sistema. En la licencia de quien firma las notas, los avisos se anticipan al último día hábil anterior. El titular puede autorizar a otra persona: la autorización se comunica en esa nota (o en una nota de autorización) y la persona autorizada presenta las demás notas con las dos firmas, citando su número, y vuelve a presentar cada aviso adelantado en su fecha. Si no autoriza a nadie, las reiteraciones salen a la vuelta. Si la persona autorizada también va a faltar algunos días, el formulario lo advierte (esos días no se generan notas). El formulario avisa, debajo de las fechas, los días en que no habría ningún auditor disponible (cuenta las demás licencias y la que se está cargando), y arriba de la lista se muestran los próximos 60 días sin auditores.

Siempre tiene que haber al menos **2 auditores** (superadmin o admins activos): el panel no deja desactivar ni pasar a editor, colaborador o lector a un admin si quedarían menos, ni pasar a editor, colaborador o lector a quien firma las Notas Digitales. Cualquier usuario puede pedir un link nuevo desde **"¿Olvidaste tu contraseña?"** en la pantalla de ingreso.

El superadmin recibe un aviso por email cuando otro usuario crea un administrador o un editor, cambia un rol, cambia el email de un administrador o un editor, reactiva a uno de ellos o desactiva a alguien. Durante su licencia esos avisos se retienen: a la vuelta le llega un solo email de resumen con todos.

## Campo "Qué se solicita" de los datasets

Cada dataset tiene un campo opcional **"Qué se solicita"**: qué información concreta tiene que enviar el área responsable para actualizarlo (registros, campos, cobertura y formato). Es un texto que vale para cualquier ciclo de actualización, sin fechas puntuales.

- **Dónde se edita:** en el formulario del dataset del panel de administración (`admin.html`).
- **Doble verificación:** es un dato del dataset como los demás. Quien lo edita lo propone y otra persona lo aprueba o rechaza; al revisar el cambio se ve el texto anterior y el nuevo. Un campo vacío queda sin texto (`NULL`).
- **Dónde se muestra:** en la página pública del dataset (`dataset.html`), en el recuadro "Qué se solicita" (si el dataset no tiene texto, no se muestra), y en el **anexo** que acompaña a los avisos de las Notas Digitales. Si un dataset no lo tiene cargado, el anexo usa un texto genérico.
- **Carga inicial:** la migración `database/updates/migracion-que-se-solicita-datos.sql` carga el texto de los 80 datasets activos (ver [Segunda entrega de Notas Digitales](#segunda-entrega-de-notas-digitales)). Se corre una sola vez, en ese despliegue: después, cada texto se cambia solo con doble verificación.

## Fechas de los datasets

Cada dataset tiene tres fechas distintas, y el sistema no las confunde:

- **Datos al:** el día al que llegan los datos publicados. Siempre es el último día de un mes (febrero, el 28).
- **Cargado en el portal** (`ultima_actualizacion`): el día en que se cargó en el Portal de Datos Abiertos, no la fecha de los datos.
- **Próxima actualización** (el vencimiento del dataset): siempre el último día de un mes. Los datos se piden al último día del mes anterior, para que el área tenga un mes de margen. La API no guarda una fecha nueva que no la cumpla.

Cada dataset tiene además un **tipo de pedido** (acumulado, foto al corte, año anterior completo, ejercicio, próxima edición, relevamiento interno o eventual), que define qué dice la columna **"Datos solicitados"** de las Notas Digitales y del anexo. Se pide siempre todo lo que falta desde los últimos datos publicados.

- **Registrar actualización** (admin) pregunta a qué fecha son los datos, cuándo llegaron ("Recibido el", obligatorio) y cuándo se cargaron, y en gestión externa quién entregó los datos ("Los entregó el área" o "Los obtuvo Datos Públicos de una fuente pública"; con la fuente pública la fecha se llama "Obtenido el" y en los datasets con "Requiere nota DGMIT" en "No" viene elegida). Propone opciones para la próxima sin elegir ninguna: la persona elige y todo pasa por la doble verificación. Al aprobarse queda un renglón en el historial de actualizaciones del dataset.
- **La edición no registra actualizaciones:** el formulario del dataset no deja cambiar a la vez "Cargado en el portal" y la próxima ("Para registrar una actualización, usá «Registrar actualización»."). Corregir una sola de las dos fechas sigue siendo posible.
- **Dónde está la regla:** `services/fechasDatasetReglas.js`. La pantalla no recalcula nada: le pide el pedido y las opciones al servidor.
- **Detalle de diseño:** `docs/superpowers/specs/2026-10-17-fechas-datasets-design.md`.

## Sitio público

Cinco páginas se ven sin sesión: la portada, Datasets, el detalle de cada dataset, el Calendario y Contacto. Todas comparten con las pantallas de administración el encabezado (Inicio, Datasets, Calendario y Contacto a la vista), el menú lateral y el footer (`RPAD v2.0.0`). Los estados, los días y la tasa salen del servidor: las páginas no recalculan nada.

- **Portada** (`index.html`): el **índice de actualización** ("El registro sigue 81 conjuntos de datos. De ellos, 14 tienen frecuencia de actualización eventual: se actualizan cuando hay novedades y no tienen vencimiento." y, en grande, "El 81% de los datasets que tienen fecha de vencimiento están al día: 54 de 67."), el **mosaico** con un cuadrito por conjunto de datos agrupado en Al día, Vencidos y Eventuales, con la cantidad de cada categoría en la leyenda (cada cuadrito lleva a su detalle), **qué vence en los próximos 12 meses** (cada mes lleva al listado de ese mes), y las listas de **Vencidos**, **Próximos a vencer** y **Últimas cargas en el portal**.
- **Datasets** (`datasets.html`):
  - **Estados** como botones con su cantidad: Todos, Actualizados, Próximos a vencer, Vencidos (con "Todos los vencidos", Atrasados y Sin respuesta del área), Eventuales y Sin fecha (solo si hay). Las cantidades cuentan lo que dejan los otros filtros.
  - **Filtros**: Buscar (título, área y descripción), Tema (principal o secundario) y Frecuencia, más "Limpiar filtros".
  - **Ordenar por**: Nombre, Próximo vencimiento o Área.
  - **Vista**: Tarjetas (de a 24 por página) o Lista (una tabla de a 50, que en el celular se apila).
  - Todo queda en la URL, así un link guarda lo elegido: `?estado=actualizado|proximo|vencidos|atrasado|sin-respuesta|eventual|sin-fecha`, `?tema=ID`, `?frecuencia=ID`, `?busqueda=texto`, `?mes=AAAA-MM` (los que vencen ese mes, desde la portada o el calendario), `?orden=proxima|area` y `?vista=lista`. El orden y la vista se escriben solo si no son los por defecto.
  - **Exportar CSV** con lo que dejan los filtros.
- **Detalle** (`dataset.html?id=N`): estado, área, temas, link al Portal de Datos Abiertos, Descripción, Qué se solicita, Observaciones, las tres fechas ("Datos al", "Cargado en el portal" y "Próxima actualización prevista"), la información técnica y la licencia.
- **Calendario** (`calendario.html`): vista anual con los vencidos, una fila por cada uno de los 12 meses desde el actual y "Más adelante". Filtra por área y por tema (principal o secundario), y **Exportar a mi calendario (iCal)** baja un `.ics` con lo que dejan los filtros.
- **Contacto** (`contacto.html`): el formulario de consultas y los datos de la Dirección.
- **Al compartir un link** de estas páginas (WhatsApp, Telegram, Facebook, X, LinkedIn, Slack) se ve una vista previa con la imagen `img/compartir.png`. `robots.txt` deja pasar solo a esos robots y sigue cerrado para los buscadores.
- **Detalle de diseño:** `docs/superpowers/specs/2026-10-18-rediseno-publico-design.md`.

## Seguimiento del dataset

**Herramientas → Seguimiento** (`seguimiento.html`) junta, por dataset, todo lo que pasó con él: cuándo se actualizó en el RPAD, cuándo y cómo se avisó que había que pedir los datos, y quién propuso y quién aprobó cada cambio. Es el registro de todos los movimientos y la prueba de cada vez que el RPAD avisó. Lo ven todos los roles con sesión, el lector incluido; no es público. Muestra lo que registró el sistema y, además, las notas DGMIT, lo único que se carga a mano (ver [Notas DGMIT](#notas-dgmit)).

- **Sin elegir** (sin `?id`): la lista de todos los datasets con buscador (título o área) y estados como botones con su cantidad: Vencidos (el inicial), Próximos a vencer, Actualizados, Eventuales, Sin fecha y Dados de baja (estos dos, solo si hay) y Todos (solo los activos). Para cada uno: cuándo vence o venció, cuántos días lleva vencido, cuántos avisos a DGMIT hubo en el ciclo ("11 emails y 1 nota"), el último de ellos ("—" si en el ciclo no hubo ninguno) y la última nota DGMIT al área del ciclo.
- **Un dataset** (`seguimiento.html?id=N`):
  - la ficha, con **Descargar PDF** y **Ver en el portal**;
  - los **avisos del ciclo abierto**, con el circuito dibujado: en gestión externa, el RPAD avisa a DGMIT y a la Dirección Administrativa, ellas mandan la nota formal al área por fuera del RPAD (queda en el Seguimiento cuando alguien la carga como nota DGMIT; si no, el circuito dice "Pendiente de carga" o "Todavía no hizo falta") y a los 40 días el RPAD le anticipa al área por email que va a recibirla (si el dataset tiene "Requiere nota DGMIT" en "No", no hay nota formal ni email de anticipo: el circuito dice "No hace falta nota formal" y "Sin nota formal"); en gestión interna, el RPAD avisa a DGMIT y a la Dirección de Investigación Territorial, que hacen el relevamiento por fuera del RPAD (no queda registrado), y no hay email al área;
  - **los últimos 12 meses**: una cinta con los ciclos, lo que estuvo vencido, los vencimientos y las marcas de cada movimiento;
  - los **movimientos** (altas, actualizaciones, cambios en la ficha, propuestas, Notas Digitales, emails, notas DGMIT y bajas), con filtros por tipo, filas que se despliegan para ver el detalle y los hitos de vencimiento entre ellas.
- **Ciclos:** un ciclo es el tiempo en que rige un vencimiento. Una actualización que mueve la próxima y "Cargado en el portal" lo cierra; reprogramar la próxima antes de que venza lo mueve dentro del mismo ciclo y hacerlo después de vencido lo cierra como reprogramado. Las actualizaciones de antes de la doble verificación (diciembre de 2025) también lo cierran, en su fecha. Cada aviso se asigna al ciclo del vencimiento que informa (las notas) o al que regía cuando se envió (los emails), y "Avisos del ciclo abierto" dice desde cuándo se cuentan ("Desde la actualización del 16/12/2025 · Vencimiento del 30/11/2026").
- **Lenguaje neutro:** el atraso muchas veces depende de que no se mandó la nota formal, no del área. Por eso el Seguimiento dice "Vencido hace N días" o "Estuvo vencido N días" (y la insignia, "Vencido"), nunca "sin entregar" ni "atrasado". El resto del sitio conserva "Atrasado" y "Sin respuesta del área".
- **PDF de una hoja** (A4, con el estilo del anexo de las Notas Digitales): ficha con QR al portal (la de un externo, con "Requiere nota DGMIT"), avisos del ciclo abierto, la cinta y los últimos 8 movimientos. Se descarga como `Seguimiento - <título> - <AAAA-MM-DD>.pdf`. Esta misma hoja, una por dataset, es el anexo de cada reiteración de las Notas Digitales.
- **Desde cuándo hay registro:** los envíos quedan registrados desde el 06/12/2025 y los cambios desde el 26/01/2026; antes de esas fechas no hay registro y no se reconstruye. Una aclaración al pie lo dice.
- **Gestión de Datasets** suma, en cada fila, el ícono "Ver seguimiento" que abre el de ese dataset.
- **Dónde está la regla:** `services/seguimientoReglas.js` (puro) y `services/seguimientoCinta.js`; la pantalla y el PDF dibujan lo que calcula el servidor.
- **Detalle de diseño:** `docs/superpowers/specs/2026-10-20-seguimiento-dataset-design.md`.

## Requiere nota DGMIT y anexo de la reiteración

Dos cambios de las Notas Digitales que van juntos.

**Requiere nota DGMIT.** Algunos datasets de gestión externa no se le piden a ningún área: los datos se sacan de una fuente pública (el TMDA, de la web de Vialidad Nacional; la cantidad de empleados municipales, del Boletín Oficial). Para esos la DGMIT no tiene que mandar una nota formal. Cada dataset externo tiene ahora el dato **"Requiere nota DGMIT"** (Sí o No):

- **Dónde se carga:** en el formulario del dataset (`admin.html`, junto a "Tipo de gestión"; solo con gestión externa y obligatorio) y, con doble verificación, como cualquier otro cambio. La lista de Gestión de Datasets suma el filtro "Requiere nota" (Todos, Sí y No). En gestión interna no existe el dato.
- **Las notas siguen informando todo como hoy** y solo agregan el dato: el aviso externo suma la columna "Requiere nota DGMIT" (5 columnas) y la reiteración externa también (7 columnas, con la situación de hoy debajo de la fecha de vencimiento). Un dataset con "No" no desaparece de ninguna nota. Las notas internas no cambian.
- **Email de los 40 días al área:** no sale para los datasets con "No", porque anticipa una nota formal que no les llega.
- **Seguimiento:** la ficha suma el dato y el circuito de un dataset con "No" dice "No hace falta nota formal" y "Sin nota formal: los datos se obtienen de la fuente".
- **Carga inicial:** `database/updates/migracion-requiere-nota-datos.sql` (45 datasets externos: 35 con Sí y 10 con No). Ver [Migración: Requiere nota DGMIT](#migración-requiere-nota-dgmit).

**Anexo de la reiteración.** Cada reiteración (interna o externa) viaja ahora con un segundo PDF, el **anexo**: una hoja A4 por dataset de la nota, en el orden de la tabla, que es la misma hoja que se descarga desde Herramientas → Seguimiento, con la propia reiteración incluida (cuántas veces avisó el RPAD, desde cuándo está vencido, qué se pide). Así la nota prueba por sí sola que ya se avisó. Se genera junto con la nota y queda guardado en el libro: no se regenera nunca. Si el anexo no se puede generar, la reiteración no sale y se reintenta en la próxima corrida. Las notas ya generadas no cambian: las reiteraciones anteriores siguen sin anexo.

- **Detalle de diseño:** `docs/superpowers/specs/2026-10-20-requiere-nota-y-anexo-reiteracion-design.md`.

## Notas DGMIT

En gestión externa, el RPAD avisa a la DGMIT y a la Dirección Administrativa, y ellas le mandan una **nota formal** al área por fuera del RPAD. Ese paso no quedaba registrado: no se podía saber si un dataset estaba vencido porque el área no respondió o porque la nota todavía no había salido. Ahora quien tiene los datos de la nota la carga en el RPAD y queda en el Seguimiento de cada dataset que pide. La DGMIT hace sus notas como siempre, por fuera: acá solo se registran.

- **Quién carga:** el rol nuevo **Colaborador** (ve lo mismo que un lector y, además, carga notas DGMIT; pensado para el personal de la DGMIT) y administración (superadmin, admin y editor). Cada uno corrige o anula las que cargó; administración, cualquiera. Ninguna cuenta es Colaborador al desplegar: se asigna desde Usuarios.
- **Cómo:** Herramientas → Seguimiento → **Cargar nota DGMIT**: número de la nota, fecha en que el área la recibió (desde el 01/01/2025 hasta hoy), tipo (solicitud o reiteración) y los datasets que pide (solo los externos activos que requieren nota DGMIT). Se guarda directo, sin doble verificación, y queda registrado quién la cargó y cuándo. Un número no se repite entre las notas sin anular: si la DGMIT y la Dirección cargan la misma nota, no queda dos veces.
- **Corregir y anular:** con motivo. Una nota nunca se borra: la anulada queda tachada en los movimientos, con el motivo, y deja de contar en todo lo demás. Cada corrección guarda los datos de antes.
- **Dónde se ve:** en el circuito ("Nota DGMIT N° 156/26 / Solicitud recibida por el área el 22/10/2026, hace 2 días", en violeta; sin nota, "Pendiente de carga" si ya hacía falta, "Todavía no hizo falta" si no, o "Ya no se pide" en un dado de baja), en los movimientos (filtro "Notas DGMIT"), en la cinta, en la columna "Última nota DGMIT al área" de la lista, en el PDF del Seguimiento y en el anexo de cada reiteración.
- **En el anexo de la reiteración**, que le llega a la DGMIT, sin nota el circuito dice solo "La manda la DGMIT al área" (nunca "Pendiente de carga").
- **No cambia:** una nota DGMIT no es un aviso del RPAD (no cuenta en los avisos del ciclo, el estado ni los ciclos), no sale ningún email y las Notas Digitales no cambian. Gestión interna sigue igual.
- **Las notas anteriores** no se cargan en esta entrega: las tablas arrancan vacías y, cuando llegue el Excel completo, se importan con un SQL aparte.
- **Dónde está la regla:** `services/notasDgmitReglas.js` (validación, pura), `controllers/notasDgmitController.js` (la API) y `services/seguimientoReglas.js` (cómo se ve en el Seguimiento). Ver [Migración: Notas DGMIT](#migración-notas-dgmit).
- **Detalle de diseño:** `docs/superpowers/specs/2026-10-24-notas-dgmit-design.md`.

## Métricas y Reportes

**Herramientas → Métricas y Reportes** (`reportes.html`, antes "Reportes") tiene dos pestañas: **Métricas** (la inicial) y **Reportes**. La ven todos los roles con sesión, el lector incluido; no es pública. Sirve para un informe a superiores, para mejorar el trabajo de Datos Públicos, para tener respaldo con datos cuando un dataset figura vencido y para conversar con la DGMIT y ajustar el proceso juntos.

- **El circuito:** cada ciclo de un dataset es una cadena de pasos, cada uno a cargo de alguien. En gestión externa, el RPAD avisa, la DGMIT y la Dirección Administrativa mandan la nota formal al área, el área entrega los datos y Datos Públicos los prepara y los carga; en gestión interna, la DGMIT y la Dirección de Investigación Territorial hacen el relevamiento y Datos Públicos lo carga. Métricas muestra cuánto tarda cada paso (aviso anticipado, trámite y entrega de la nota, respuesta del área o producción del relevamiento, y preparación y carga), con la cantidad de casos y los que siguen en curso al lado. Sin notas DGMIT cargadas, el tramo de la DGMIT dice "pendiente de carga": nunca que la nota no salió.
- **Selectores:** el año (el en curso y los anteriores, desde 2026), "Mediana | Promedio" y "Días hábiles | Días corridos" (los días hábiles son de lunes a viernes, sin los feriados nacionales fijos). Todo viaja en la dirección de la página, así un link guarda lo elegido.
- **Destildar:** en la lista de casos, la casilla "Contar" saca un dataset raro (por ejemplo, uno que nunca termina) de todas las cuentas, con una franja que lo avisa ("Calculado sin 1 dataset: …") y el link "Volver a todos". No se guarda: es solo una vista.
- **Secciones:** el circuito de cada gestión con la cinta del "recorrido típico" y la lista de casos; los resultados del año (actualizados a tiempo, cobertura del aviso y reiteraciones; la cobertura cuenta los vencimientos cuyo aviso ya tenía que haber salido —el día de la regla o, si no es hábil, el hábil siguiente— mientras el dataset seguía con esa fecha en el RPAD: uno que se actualizó o se dio de baja antes no figura como "sin el aviso de la regla"); el contexto (el índice de actualización mes a mes, el mismo de la portada, y la antigüedad de los vencidos); el trabajo del RPAD (avisos, actualizaciones, cambios auditados, datasets nuevos, pedidos resueltos con una fuente pública, las métricas manuales y el CSV que estaban en Gestión); áreas y temas (el ranking de áreas de Gestión y los datasets por tema y por frecuencia); y **Para completar**: las notas DGMIT pendientes de carga (con "Cargar nota DGMIT", que abre el formulario del Seguimiento, para quien puede cargarlas) y las actualizaciones sin "Recibido el" o sin el origen de los datos.
- **La foto del 31/12:** el 10/01 de cada año, la corrida de las 8:15 guarda las métricas del año anterior "al 31/12" y ya no cambian nunca: los años anteriores se ven desde su foto. Lo que se registre después del 10/01 con fecha del año anterior ya no entra en ella.
- **Reportes:** siete PDF con el diseño del anexo de las Notas Digitales (A4). **Para presentar:** Métricas del año, Informe anual (desde que hay foto: la foto, la comparación con el año anterior y los logros de Gestión → Proyectos) y Estado general de los datasets. **Para trabajar:** Por área (una portada y una hoja del Seguimiento por cada dataset activo del área), Avisos del RPAD (la constancia de los avisos de un período; reemplaza al Historial de notificaciones), Agenda de pedidos (qué vence en los próximos 3, 6 o 12 meses, con el día aproximado del aviso) y Datos para completar (del año que se elige: entre el 01/01 y el 10/01 propone el año que se cierra, para completarlo antes de su foto). Se sacó el reporte de Cumplimiento (su ranking de áreas está en Métricas).
- **Gestión** queda solo con Proyectos, con un renglón arriba que lleva a Herramientas → Métricas y Reportes.
- **"Recibido el"** es obligatorio en "Registrar actualización" y, en gestión externa, también el origen de los datos (ver [Fechas de los datasets](#fechas-de-los-datasets)). Los de las actualizaciones anteriores se cargaron una vez desde un Excel (ver [Migración: Métricas y Reportes](#migración-métricas-y-reportes)).
- **Dónde está la regla:** `services/metricasReglas.js` (puro), `services/metricasCinta.js`, `services/metricasFoto.js` y `services/reportes*.js`; la página y los PDF dibujan lo que calcula el servidor.
- **Detalle de diseño:** `docs/superpowers/specs/2026-10-24-metricas-y-reportes-design.md`.

## Estructura del proyecto

```
rpad/
├── app.js                         # Entry point - Express server
├── package.json
├── htaccess-frontend.txt          # Referencia de configuración Apache
├── .env                           # Variables de entorno (no incluido en repo)
├── .env.example                   # Template de variables
├── config/
│   └── database.js                # Pool de conexiones MySQL
├── controllers/
│   ├── authController.js          # Login, verificación, cambio password
│   ├── catalogController.js       # Temas, frecuencias, formatos
│   ├── datasetController.js       # CRUD datasets, estadísticas
│   ├── areasController.js         # CRUD áreas responsables
│   ├── andinoController.js        # Integración con portal de datos
│   ├── cambiosPendientesController.js  # Sistema de doble verificación
│   ├── contactoController.js      # Formulario de contacto público
│   ├── notificacionesController.js  # Cron diario: aviso a áreas y Notas Digitales
│   ├── notasDigitalesController.js  # API de Notas Digitales (libro, prueba, configuración)
│   ├── notasController.js         # Generador de notas DOCX
│   ├── seguimientoController.js   # Seguimiento del dataset: lista, ficha y PDF (solo lectura)
│   ├── notasDgmitController.js    # Notas DGMIT: cargar, corregir y anular (administración y el colaborador)
│   ├── metricasController.js      # Métricas: GET /api/metricas y su PDF (solo lectura, cualquier rol con sesión)
│   └── reportesController.js      # Los reportes PDF de la pestaña Reportes (las consultas; los dibuja services/reportes*.js)
├── services/
│   ├── emailService.js            # Configuración SMTP, envío y remitente único ("Dir. de Datos Públicos y Comunicación")
│   ├── avisosDiariosService.js    # Aviso a las áreas y recordatorio de cambios pendientes a quienes pueden auditar (solo días hábiles)
│   ├── emailTemplates.js          # Plantillas HTML de los emails, todas con el mismo marco (marcoEmail)
│   ├── fechasDatasetReglas.js     # Reglas puras de las fechas de un dataset: pedido, opciones de próxima, estado y tasa
│   ├── requiereNotaReglas.js      # Reglas puras de "Requiere nota DGMIT": validación, normalización y texto (Sí, No o —)
│   ├── notasDgmitReglas.js        # Reglas puras de las notas DGMIT: validación de la nota y del motivo, mensajes
│   ├── registroReglas.js          # Reglas puras de "Registrar actualización": el origen de los datos y los mensajes de lo que falta
│   ├── metricas*.js               # Métricas: reglas (casos, circuito, resultados, contexto, trabajo y áreas), cinta, opciones y la foto del 31/12
│   ├── reportes*.js               # Reportes PDF: la base (diseño del anexo) y un archivo por reporte, la agenda de pedidos y los nombres de los archivos
│   ├── seguimiento*.js            # Seguimiento del dataset: reglas (movimientos, ciclos y avisos), cinta, consultas y PDF (de una hoja, o de N para un anexo)
│   └── notasDigitales*.js         # Notas Digitales: motor, calendario, consultas, contenido, PDF, anexo del aviso y anexo de la reiteración (el Seguimiento de cada dataset)
├── database/
│   ├── schema.sql                 # Estructura y datos iniciales de la BD
│   └── updates/                   # Scripts de migración
│       ├── migracion-v1.2.0-v1.3.0.sql
│       ├── migracion-v1.3.0-v1.4.0.sql
│       ├── migracion-v1.4.0-v1.5.0.sql
│       ├── migracion-notas-digitales.sql
│       ├── migracion-notas-digitales-anexo.sql   # Segunda entrega: columna anexo_pdf
│       ├── migracion-que-se-solicita.sql         # Segunda entrega: columna que_se_solicita
│       ├── migracion-que-se-solicita-datos.sql   # Segunda entrega: carga inicial de los textos
│       ├── migracion-fechas-datasets.sql         # Fechas de los datasets: estructura (va antes del código)
│       ├── migracion-fechas-datasets-datos.sql   # Fechas de los datasets: "Datos al" y tipo de pedido de los datasets (después de la estructura y antes del código)
│       ├── migracion-fechas-datasets-textos.sql  # Fechas de los datasets: "Qué se solicita" sin el período (después de subir el código, antes del Restart)
│       ├── migracion-requiere-nota.sql           # Requiere nota DGMIT: estructura, la columna datasets.requiere_nota (va antes del código)
│       ├── migracion-requiere-nota-datos.sql     # Requiere nota DGMIT: carga inicial de los 45 externos (después de la estructura y antes del código; una sola vez)
│       ├── migracion-editor-sin-responsabilidad.sql  # El editor audita sin responsabilidad: la columna cambios_pendientes.revisado_sin_responsabilidad (va antes del código)
│       ├── rollback-editor-sin-responsabilidad.sql   # Deshace la anterior (después de volver a los archivos anteriores)
│       ├── migracion-notas-dgmit.sql             # Notas DGMIT: el rol colaborador y las tres tablas (va antes del código; repetible)
│       ├── rollback-notas-dgmit.sql              # Deshace la anterior (después de volver a los archivos anteriores; antes que las vueltas atrás del editor)
│       ├── migracion-metricas.sql                # Métricas y Reportes: las tablas de la foto anual y de los «Recibido el» importados (va antes del código; repetible)
│       ├── migracion-metricas-recibido-datos.sql # Métricas y Reportes: los «Recibido el» y orígenes viejos, del Excel (después de la anterior; antes del 10/01/2027; repetible)
│       └── rollback-metricas.sql                 # Deshace las dos anteriores (después de volver a los archivos anteriores; se pierden la foto y lo importado)
├── middleware/
│   └── auth.js                    # JWT middleware
├── routes/
│   └── index.js                   # Definición de rutas API
├── scripts/
│   └── setup-admin.js             # Script para crear usuario admin
└── public/                        # FRONTEND (una página HTML por pantalla)
    ├── index.html                 # Portada: índice de actualización, mosaico, 12 meses, vencidos, próximos y últimas cargas
    ├── datasets.html              # Listado: estados con cantidades, filtros, orden, tarjetas o lista, CSV
    ├── dataset.html               # Detalle de un dataset (?id=N)
    ├── calendario.html            # Calendario anual de vencimientos (vencidos, 12 meses y más adelante) e iCal
    ├── contacto.html              # Formulario de contacto público
    ├── login.html                 # Formulario de login
    ├── establecer-contrasena.html # Elegir la contraseña con un link de acceso
    ├── admin.html                 # Panel de administración de datasets
    ├── areas.html                 # Panel de administración de áreas
    ├── usuarios.html              # Panel de usuarios y licencias
    ├── correos.html               # Correos: Libro de Notas Digitales, Estado, Vista previa y pruebas, Configuración (pestañas)
    ├── reportes.html              # Métricas y Reportes: pestañas Métricas (circuito, resultados, contexto, trabajo, áreas y "Para completar") y Reportes (siete PDF)
    ├── notas.html                 # Generador de notas administrativas DOCX
    ├── gestion.html               # Gestión: Proyectos (repositorio, logros y línea de tiempo)
    ├── seguimiento.html           # Seguimiento del dataset: lista "Sin elegir" o un dataset (?id=N), con su cinta, movimientos y PDF
    ├── perfil.html                # Mi Perfil en pestañas: Para revisar, Mis cambios, Mis datos y Mi firma
    ├── robots.txt                 # Cerrado a todos, salvo a los robots de vista previa de un link
    ├── css/
    │   ├── main.css               # Carcasa (encabezado, menú lateral, footer), fuentes, tokens y administración: las 14 páginas con carcasa
    │   ├── publico.css            # Solo las 5 páginas públicas (index, datasets, dataset, calendario y contacto)
    │   └── styles.css, layout.css, perfil.css   # Sin uso: no los carga ninguna página
    ├── js/
    │   ├── config.js              # Configuración (API_URL)
    │   ├── auth.js                # Manejo de autenticación
    │   ├── main.js                # Carcasa compartida: encabezado, menú lateral, año del footer
    │   ├── api.js                 # Llamadas a la API y utilidades
    │   ├── dashboard.js           # Portada
    │   ├── datasets.js            # Listado de datasets
    │   ├── dataset-detail.js      # Detalle de dataset
    │   ├── calendario.js          # Calendario anual de vencimientos e iCal
    │   ├── contacto.js            # Formulario de contacto
    │   ├── admin-fechas.js        # Admin: lo puro de la lista y de "Registrar actualización" (se carga antes de admin.js)
    │   ├── admin.js               # Panel de administración
    │   ├── areas.js               # Gestión de áreas responsables
    │   ├── usuarios.js            # Panel de usuarios y licencias
    │   ├── correos.js             # Correos: pestañas, Libro, Estado, vista previa y configuración
    │   ├── reportes.js            # Métricas y Reportes: dibuja lo que manda GET /api/metricas (SVG y HTML) y descarga los PDF
    │   ├── notas.js               # Generador de notas administrativas
    │   ├── gestion.js             # Gestión: Proyectos
    │   ├── seguimiento.js         # Seguimiento del dataset: lista, ficha, circuito, cinta (SVG) y movimientos
    │   ├── perfil.js              # Mi Perfil: gestión de cambios (aprobar y rechazar en la fila), datos y firma
    │   └── establecer-contrasena.js  # Elegir la contraseña, o pedir un link nuevo
    └── img/
        ├── icon.png
        ├── logo.png               # Logo del encabezado
        ├── logo-2025.png
        ├── logo-2025-blanco.png   # Menú lateral, footer y panel de login
        └── compartir.png          # Vista previa al compartir un link (1200×630)
```

## Base de datos

### Crear la base de datos

1. En cPanel ir a **MySQL Databases**
2. Crear una nueva base de datos (ej: `usuario_rpad`)
3. Crear un usuario MySQL y asignarle todos los permisos sobre esa base

### Ejecutar el schema

Desde **phpMyAdmin** en cPanel:

1. Seleccionar la base de datos creada
2. Ir a la pestaña **Importar**
3. Subir el archivo `database/schema.sql`
4. Click en **Ejecutar**

### Estructura de tablas

| Tabla | Descripción |
|-------|-------------|
| `usuarios` | Administradores del sistema |
| `temas` | Catálogo de temas para clasificación |
| `frecuencias` | Catálogo de frecuencias de actualización |
| `formatos` | Catálogo de formatos de archivo (CSV, XLSX, etc.) con distinción de habituales |
| `areas` | Áreas responsables con contactos, emails y artículos gramaticales (el/la) |
| `datasets` | Registro principal de datasets (sin columnas de formato fijas), con el texto opcional "Qué se solicita" (`que_se_solicita`), "Datos al" (`datos_al`), el tipo de pedido (`tipo_pedido`) y, en los externos, si requiere nota DGMIT (`requiere_nota`: 1 Sí, 0 No, NULL sin dato) |
| `dataset_formatos` | Tabla intermedia para la relación muchos-a-muchos entre datasets y formatos |
| `cambios_pendientes` | Cola de cambios propuestos pendientes de aprobación (doble verificación) |
| `historial_actualizaciones` | Log de actualizaciones realizadas: carga en el portal, "Datos al", fecha de recepción, próxima nueva, el cambio que la registró y el vencimiento que cumplió |
| `notificaciones_log` | Registro de notificaciones enviadas |
| `notas_dgmit` | Notas DGMIT al área cargadas a mano: número, tipo (solicitud o reiteración), fecha en que el área la recibió, si está anulada y quién la cargó |
| `notas_dgmit_datasets` | Qué datasets pide cada nota DGMIT |
| `notas_dgmit_historial` | Correcciones y anulación de cada nota DGMIT: motivo, quién, cuándo y los datos de antes |
| `metricas_fotos` | La foto de las métricas de cada año, al 31/12: se saca sola el 10/01 del año siguiente y no se modifica nunca |
| `actualizaciones_recibido` | El "Recibido el" y el origen de los datos de las actualizaciones aprobadas que no los traían, importados una vez por cambio |

### Migración: Usuarios (superadmin y panel de usuarios)

⚠️ Requisito: las migraciones anteriores aplicadas. No hay dependencias nuevas de npm.

Secuencia de despliegue, **en este orden** (todo desde cPanel):

1. **Backup de la base:** phpMyAdmin → base del RPAD → **Exportar** → método **Personalizado**, formato SQL → en "Opciones de creación de objetos" tildar **Agregar sentencia DROP TABLE / VIEW / PROCEDURE / FUNCTION / EVENT / TRIGGER** → **Continuar**. Guardar el archivo. Sin esa opción, el backup no se puede restaurar con Importar sobre la base existente (falla con "Table already exists").
2. **Backup de los archivos:** Administrador de archivos → carpeta de la app → seleccionar `controllers`, `middleware`, `routes`, `services`, `scripts` y `public` → **Comprimir** → descargar el zip.
3. **Migración de estructura:** phpMyAdmin → base del RPAD → pestaña **SQL** → pegar el contenido de `database/updates/migracion-usuarios-superadmin.sql` → **Continuar**. Agrega columnas y tablas y amplía dos columnas existentes (`password_hash` admite vacío y `rol` admite `superadmin`); no borra ni cambia datos, y el código actual sigue funcionando con la estructura nueva: si los pasos siguientes se demoran, no pasa nada. Si se corta a mitad, se puede volver a correr: lo que ya existe se saltea.
4. **Subir los archivos** con el Administrador de archivos. Cambian 32 archivos, todos dentro de `controllers`, `middleware`, `routes`, `services`, `scripts` y `public` (`app.js`, `config/` y `package.json` no cambian):
   - En la PC, armar un zip **con esos archivos y sus carpetas** (por ejemplo, desde el repo: `git archive --format=zip -o rpad-usuarios.zip main -- $(git diff --name-only <commit-anterior>..main -- controllers middleware routes services scripts public)`). No usar el "Download ZIP" de GitHub tal cual: crea una carpeta de más (`rpad-main/`) y no reemplaza nada.
   - Administrador de archivos → carpeta de la app → **Cargar** el zip → seleccionarlo → **Extraer** en la misma carpeta de la app. Reemplaza los archivos que cambian y agrega los nuevos; no borra nada.
   - Revisar que existan los archivos nuevos: `controllers/usuariosController.js`, `services/accesoService.js`, `services/usuariosReglas.js`, `services/usuariosAuditoriaService.js`, `public/usuarios.html`, `public/establecer-contrasena.html`, `public/js/usuarios.js` y `public/js/establecer-contrasena.js`. Si falta cualquiera de `services/`, la app no arranca. Hacer los pasos 4 y 5 **seguidos**, sin dejar pasar tiempo entre subir los archivos y el Restart: las pantallas nuevas se sirven apenas se suben, y hasta el Restart la app sigue corriendo con el código anterior.
5. **Setup Node.js App** → la app del RPAD → **Environment variables** → agregar `APP_URL` = `https://rpad.mcrmodernizacion.gob.ar` → **Save** (es opcional: si no se agrega, la app usa ese mismo valor). Después, **Restart** (sin demorarse después del paso 4). No hace falta "Run NPM Install": no hay dependencias nuevas.
6. **Datos de usuarios:** phpMyAdmin → pestaña **SQL** → pegar el contenido de `database/privado/usuarios-superadmin-datos.sql`. Ese archivo no está en el repositorio: lo tiene el Director de Datos Públicos y Comunicación. Tiene que ir **después** del Restart: el código anterior no conoce el rol superadmin. El `SELECT` final muestra los usuarios con su rol, cargo y vínculo para revisar.
7. **Verificar:**
   - el superadmin ve "Superadmin" en el header;
   - Administración → Usuarios muestra a todos con su cargo;
   - "Nuevo usuario" con rol **Lector** y una casilla de prueba propia: la invitación llega y el link funciona;
   - desactivar ese usuario de prueba;
   - lo existente sigue igual: ingresar con un admin y con un lector, abrir el Tablero y Gestión de Datasets, ver que los cambios pendientes cargan (Mi Perfil → Para Revisar) y que Correos → Estado no muestra alertas nuevas.

**Si algo sale mal:** subir de nuevo los archivos del backup del paso 2 → Restart → phpMyAdmin → pestaña SQL → pegar `database/updates/rollback-usuarios-superadmin.sql`.

- El rollback deja la estructura exactamente como estaba; se pierden los cargos, vínculos e historial de usuarios. El superadmin queda como admin, y los usuarios con la invitación pendiente (todavía sin contraseña) quedan desactivados.
- Los archivos nuevos (`usuarios.html`, `establecer-contrasena.html`, `js/usuarios.js`, `js/establecer-contrasena.js`, `services/accesoService.js`, `services/usuariosReglas.js`, `services/usuariosAuditoriaService.js`, `controllers/usuariosController.js`) se pueden borrar después con el Administrador de archivos; si quedan, no molestan.
- Si el rollback SQL falla, la alternativa es restaurar el backup del paso 1: phpMyAdmin → **Importar**. Se pierde lo cargado en el sistema desde que se hizo ese backup.

### Migración: Editor y auditoría

⚠️ Requisito: la migración de licencias y firmas aplicada. No hay dependencias nuevas de npm.

1. **Backup de la base** (phpMyAdmin → Exportar → Personalizado, con "Agregar sentencia DROP TABLE / VIEW / PROCEDURE / FUNCTION / EVENT / TRIGGER") y **de los archivos** (comprimir `controllers`, `middleware`, `routes`, `services`, `scripts` y `public` dentro de la carpeta de la app).
2. **Migración de estructura:** phpMyAdmin → pestaña **SQL** → pegar `database/updates/migracion-editor-auditoria.sql` → **Continuar**. Agrega el rol `editor`, tres columnas a los cambios pendientes (la fecha del primer recordatorio, la marca de aprobación de respaldo y la fecha del aviso de días sin auditor, `aviso_sin_auditores_at`), el tipo de nota `auditoria`, la tabla de los cambios de cada nota de auditoría y los destinatarios de auditoría (Para: `mit@comodoro.gov.ar`); no cambia datos y el código actual sigue funcionando con la estructura nueva. Si se corta a mitad, se puede volver a correr (solo hasta aplicar `migracion-notas-dgmit.sql`: ver la nota al final de esta sección).
3. **Subir los archivos** (zip con los archivos que cambian y sus carpetas → Cargar → Extraer en la carpeta de la app) y, enseguida, **Setup Node.js App → Restart**. No hace falta "Run NPM Install".
4. **Editores:** el superadmin entra a Usuarios y pasa a **Editor** a quien corresponda (Ver → Rol → Guardar cambios). No hace falta SQL privado. El panel no deja bajar de 2 auditores ni pasar a editor a quien firma las notas.
5. **Destinatarios de auditoría:** Correos → Configuración → "Notas de auditoría": revisar el Para y el CC, y guardar.
6. **Verificar:** Correos → Vista previa → tipo **Auditoría** → "Vista previa" y "Ver PDF"; Correos → Estado muestra la línea de auditoría (y, si hay días sin auditor, las líneas de los cambios sin quien los audite y de los próximos períodos); Usuarios → Licencias → Nueva licencia avisa los días sin auditor al cargar las fechas; un editor ve su rol en el encabezado y, en Mi Perfil → Para revisar, los botones deshabilitados mientras haya auditores disponibles.

**Si algo sale mal:** subir de nuevo los archivos del backup → Restart → phpMyAdmin → pegar `database/updates/rollback-editor-auditoria.sql`.

⚠️ Después de `migracion-notas-dgmit.sql` (ver «Migración: Notas DGMIT») esta migración no se vuelve a correr (fija el rol sin `colaborador`), y si hay que deshacer todo, `rollback-notas-dgmit.sql` va antes que `rollback-editor-sin-responsabilidad.sql` y que este rollback.

- El rollback pasa a admin a los editores (vuelven a aprobar cambios como cualquier admin) y deja la estructura como estaba, salvo `notas_digitales.tipo`, que queda ampliado con `auditoria` (las notas de auditoría son notas numeradas del libro y no se borran); se pierden la fecha del primer recordatorio de cada cambio, la marca de aprobación de respaldo, la fecha del aviso de días sin auditor (si el aviso ya salió, al volver a migrar se manda de nuevo), qué cambios incluyó cada nota de auditoría y los destinatarios de auditoría. Las notas de auditoría quedan en el libro, que en la versión anterior las muestra con el tipo vacío ("undefined").
- Si el rollback SQL falla, la alternativa es restaurar el backup del paso 1: phpMyAdmin → **Importar**. Se pierde lo cargado en el sistema desde que se hizo ese backup.

### Migración: Licencias y firmas

⚠️ Requisito: la migración de usuarios y la entrega de días hábiles aplicadas. No hay dependencias nuevas de npm.

1. **Backup de la base** (phpMyAdmin → Exportar → Personalizado, con "Agregar sentencia DROP TABLE / VIEW / PROCEDURE / FUNCTION / EVENT / TRIGGER") y **de los archivos** (comprimir `controllers`, `routes`, `services` y `public` dentro de la carpeta de la app).
2. **Migración de estructura:** phpMyAdmin → pestaña **SQL** → pegar `database/updates/migracion-licencias-firmas.sql` → **Continuar**. Solo agrega tablas y columnas; el código actual sigue funcionando con la estructura nueva. Si se corta a mitad, se puede volver a correr.
3. **Subir los archivos** (zip con los archivos que cambian y sus carpetas → Cargar → Extraer en la carpeta de la app) y, enseguida, **Setup Node.js App → Restart**. No hace falta "Run NPM Install".
4. **Firmante titular:** phpMyAdmin → pestaña SQL → pegar `database/privado/licencias-firmas-datos.sql` (no está en el repositorio). Va **después** del Restart. El `SELECT` final muestra al firmante con su firma.
5. **Verificar:** el firmante entra a Mi Perfil → Mi firma y revisa el nombre y el cargo con que firma; Correos → Configuración muestra al firmante titular y "Ver PDF" sale con su firma; Usuarios → Licencias carga y lista; Correos → Estado sin alertas nuevas.

**Si algo sale mal:** subir de nuevo los archivos del backup → Restart → phpMyAdmin → pegar `database/updates/rollback-licencias-firmas.sql`. Las notas vuelven a salir con la firma cargada en Correos (la migración no la toca).

- El rollback deja la estructura como estaba; se pierden las licencias, las firmas cargadas en Mi Perfil, el firmante titular, quién firmó y quién presentó cada nota, el historial de licencias y los avisos al superadmin retenidos (que ya no se envían). Las notas de autorización quedan en el libro, que en la versión anterior las muestra con el tipo y la gestión vacíos ("undefined").
- Si el rollback SQL falla, la alternativa es restaurar el backup del paso 1: phpMyAdmin → **Importar**. Se pierde lo cargado en el sistema desde que se hizo ese backup.

### Migración: Notas Digitales

⚠️ Requisito: la base tiene que tener aplicadas las migraciones anteriores. La migración crea las tablas `notas_digitales` (libro), `notas_digitales_datasets` y `notas_digitales_config` (destinatarios iniciales, texto del pie del membrete del PDF, envío automático **desactivado** y registro de la última corrida diaria).

Secuencia de despliegue, en este orden:

1. **Backup de la base de producción**, por ejemplo:
   ```bash
   mysqldump -u USUARIO -p NOMBRE_BASE > backup-antes-de-notas-digitales.sql
   ```
2. **Ejecutar la migración antes de subir el código.** El script no tiene `USE`: hay que indicar la base en el comando.
   ```bash
   mysql -u USUARIO -p NOMBRE_BASE < database/updates/migracion-notas-digitales.sql
   ```
   La migración no se puede correr dos veces. Solo crea tablas nuevas y no modifica las existentes. Si falla a mitad de camino, borrar las que se hayan creado y volver a correrla. No restaurar el backup por esto: se perdería lo que se cargó en el sistema desde que se hizo.
   ```sql
   DROP TABLE IF EXISTS notas_digitales_datasets, notas_digitales_config, notas_digitales;
   ```
3. **Subir el código**, correr `npm install` y reiniciar la app (**Restart** en Setup Node.js App).
4. **Verificar SMTP** en Correos → Estado ("Verificar conexión SMTP"). Si la conexión es rechazada, habilitar la salida SMTP de la cuenta en WHM ("SMTP Restrictions").
5. En Correos → Configuración, **cargar la firma** (nombre, cargo e imagen), el **membrete del PDF** (la imagen del banner y, si cambió, el texto del pie; la migración deja cargado `www.comodoroweb.gov.ar – Moreno 815, Comodoro Rivadavia, Chubut.`) y las **casillas de prueba**. El banner no está en el repositorio: se sube desde esa pantalla. Revisar el PDF con "Ver PDF" en Correos → Vista previa y prueba. Después, **enviar una prueba de cada variante** (aviso y reiteración, de gestión interna y externa) y revisar las cuatro en las casillas de prueba, con su PDF.
6. **Recién entonces, activar el envío automático** en Correos → Estado. Las notas las dispara el mismo cron diario de `/api/cron/notificaciones` (ver [Configurar Cron Job](#configurar-cron-job-notificaciones-automáticas)).
7. **El primer día hábil siguiente**, revisar Correos → Estado: la línea "Última corrida diaria" tiene que mostrar la corrida de las 08:15 sin errores y no tiene que haber alertas. Revisar también el libro de Notas Digitales.

Los siete emails de aviso anteriores (interno y externo) dejan de salir apenas se sube el código; las Notas Digitales empiezan cuando se activa el envío automático.

#### Segunda entrega de Notas Digitales

⚠️ Requisito: la primera entrega (la secuencia anterior) ya tiene que estar aplicada.

Qué cambia en esta entrega:

- **El aviso informa solo datasets a vencer** (todavía no vencidos). Un dataset vencido que nunca tuvo aviso ya no va en el aviso: entra en la **reiteración** mensual, con "Sin aviso previo" en la columna "Informado en".
- **Cada aviso viaja con un segundo PDF, el anexo**: una hoja A4 por dataset, con la descripción, la ficha (con código QR al portal), "Qué se solicita", las observaciones y el contacto del área. Se genera junto con la nota y se guarda en el libro. (Desde la entrega de [Requiere nota DGMIT y anexo de la reiteración](#requiere-nota-dgmit-y-anexo-de-la-reiteración), la reiteración también lleva su anexo, con el Seguimiento de cada dataset.)
- **Campo nuevo "Qué se solicita"** en los datasets (ver [Campo "Qué se solicita"](#campo-qué-se-solicita-de-los-datasets)), con doble verificación; se muestra en la página pública del dataset y en el anexo.
- **Correos**: botón "Ver anexo" en Vista previa y prueba (para avisos y, desde la entrega de Requiere nota DGMIT, también para reiteraciones) y botón "Anexo" en cada aviso o reiteración con anexo del libro.
- **Textos**: se quitaron las menciones a WhatsApp y las notas dicen "En tal sentido, solicito…".
- **Revisión de cambios**: el campo "Observaciones" muestra el valor anterior y el nuevo.

Secuencia de despliegue, en este orden:

1. **Backup de la base de producción**, por ejemplo:
   ```bash
   mysqldump -u USUARIO -p NOMBRE_BASE > backup-antes-del-anexo-de-avisos.sql
   ```
2. **Columna del anexo.** Los scripts no tienen `USE`: hay que indicar la base en el comando.
   ```bash
   mysql -u USUARIO -p NOMBRE_BASE < database/updates/migracion-notas-digitales-anexo.sql
   ```
3. **Columna "Qué se solicita".**
   ```bash
   mysql -u USUARIO -p NOMBRE_BASE < database/updates/migracion-que-se-solicita.sql
   ```
4. **Carga inicial de "Qué se solicita".** Va después del paso 3, porque necesita la columna.
   ```bash
   mysql -u USUARIO -p NOMBRE_BASE < database/updates/migracion-que-se-solicita-datos.sql
   ```
   Solo completa los datasets que todavía no tienen texto (`que_se_solicita IS NULL`): no pisa un texto ya cargado o aprobado desde RPAD, así que se puede correr también si alguien ya editó alguno.
   ⚠️ **Se corre una sola vez, durante este despliegue.** No volver a correrla meses después: un texto que un admin vació con un cambio aprobado también queda en `NULL`, y la carga lo volvería a llenar sin doble verificación.
5. **Subir el código.**
6. En **Setup Node.js App**, **Run NPM Install**: hay una dependencia nueva, `qrcode` (el código QR del anexo).
7. **Antes del Restart, verificar que exista la carpeta `node_modules/qrcode`** (en el Administrador de archivos de cPanel, dentro de la carpeta de la app). Si no está, volver a correr Run NPM Install. Sin ella la app arranca igual, pero cada aviso falla con el error "No se pudo cargar la librería qrcode" (queda en Correos → Estado, con su alerta) y no sale.
8. **Restart** de la app.
9. En **Correos → Vista previa y prueba**, revisar con "Ver PDF" y "Ver anexo" que se vean bien, y **enviar una prueba de un aviso** a las casillas de prueba: tiene que llegar con **2 adjuntos** (`Nota-Digital-PRUEBA.pdf` y `Anexo-Nota-Digital-PRUEBA.pdf`).

Por qué importa el orden: **las tres migraciones se corren antes de reiniciar con el código nuevo**.

- Sin la columna `anexo_pdf` (paso 2), falla generar y enviar las notas.
- Sin la columna `que_se_solicita` (paso 3), falla aprobar cambios sobre los datasets.
- Si la carga inicial (paso 4) se corre después de que alguien aprobó una edición de "Qué se solicita", no la pisa. Es lo esperado.

En lugar del comando `mysql`, cada script se puede aplicar desde **phpMyAdmin → Importar**, con la base seleccionada y el archivo en UTF-8, en el mismo orden. Los pasos 2 y 3 agregan una columna: si se corren dos veces, la segunda falla con "Duplicate column name" y no cambia nada. El paso 4 se puede repetir sin problema dentro de este mismo despliegue (por ejemplo, si se cortó a mitad); después ya no se vuelve a correr.

### Migración: Fechas de los datasets

⚠️ Requisito: las migraciones anteriores aplicadas. No hay dependencias nuevas de npm. Se despliega en **un solo kit** (reglas, registro y admin; Notas Digitales y avisos; sitio público y estados), con backup de la base y de los archivos antes de empezar y fuera del horario de los crons (8:15 y 14:00). Los SQL se corren en phpMyAdmin (pestaña **SQL**, con la base del RPAD seleccionada). El orden es: **SQL de estructura → SQL de datos → subir todos los archivos → SQL de textos → Restart**.

1. **Consultas previas, de solo lectura.** Si alguna devuelve filas, se corrige desde la aplicación antes de seguir.
   ```sql
   -- Próximas que no son fin de mes (28/2 vale, 29/2 no)
   SELECT d.id, d.titulo, d.proxima_actualizacion FROM datasets d
   WHERE d.activo = 1 AND d.proxima_actualizacion IS NOT NULL
     AND NOT ((MONTH(d.proxima_actualizacion) = 2 AND DAY(d.proxima_actualizacion) = 28)
           OR (MONTH(d.proxima_actualizacion) <> 2 AND d.proxima_actualizacion = LAST_DAY(d.proxima_actualizacion)));
   -- Eventuales con próxima, y no eventuales sin próxima
   SELECT d.id, d.titulo, f.nombre, d.proxima_actualizacion FROM datasets d JOIN frecuencias f ON f.id = d.frecuencia_id
   WHERE d.activo = 1 AND ((f.dias IS NULL AND d.proxima_actualizacion IS NOT NULL) OR (f.dias IS NOT NULL AND d.proxima_actualizacion IS NULL));
   -- Cambios pendientes con fechas: el código nuevo no aprueba una próxima que no sea fin de mes
   SELECT id, dataset_id, datos_nuevos FROM cambios_pendientes
   WHERE estado = 'pendiente' AND JSON_CONTAINS_PATH(datos_nuevos, 'one', '$.proxima_actualizacion');
   -- Próximas en '0000-00-00' (la primera consulta no las ve)
   SELECT id, titulo FROM datasets WHERE CAST(proxima_actualizacion AS CHAR) = '0000-00-00';
   ```
2. **SQL de estructura:** `migracion-fechas-datasets.sql`. Solo agrega columnas (todas en `NULL`) y la frecuencia en meses; el código anterior sigue funcionando con ella, y si se corta a mitad se puede volver a correr. Después, esta consulta tiene que dar **0 filas** (si no, el código nuevo trata a esa frecuencia como Eventual en todos lados):
   ```sql
   SELECT id, nombre FROM frecuencias WHERE dias IS NOT NULL AND meses IS NULL;
   ```
3. **SQL de datos:** `migracion-fechas-datasets-datos.sql` ("Datos al" y tipo de pedido de los 80 datasets). **Se corre una sola vez**: después esos datos cambian desde la aplicación, con doble verificación, y volver a correrla los pisaría. Después, las dos consultas tienen que dar **0**:
   ```sql
   SELECT COUNT(*) FROM datasets WHERE activo = 1 AND tipo_pedido IS NULL;
   SELECT COUNT(*) FROM datasets WHERE CAST(datos_al AS CHAR) = '0000-00-00';
   ```
4. **Subir todos los archivos**, en este orden: primero los del servidor, después `api.js` y los scripts, y al final los HTML.
5. **SQL de textos:** `migracion-fechas-datasets-textos.sql` (saca el período de los 26 "Qué se solicita", porque la nota nueva ya dice los "Datos solicitados"). Va después de subir los archivos y justo antes del Restart. Cada `UPDATE` cambia el texto solo si sigue siendo el original del 17/10/2026, así que tienen que ser **26 filas afectadas**. Un `UPDATE` con 0 filas es un texto que cambió después: no se pisa, se revisa a mano. La cabecera del archivo trae la consulta que lista esos casos.
6. **Restart** de la app.

### Migración: Requiere nota DGMIT

⚠️ Requisito: las migraciones anteriores aplicadas (la de fechas de los datasets incluida). No hay dependencias nuevas de npm (el anexo de la reiteración usa `qrcode`, que ya está instalada desde el anexo de los avisos). Se despliega en **un solo kit** (el dato y su carga, las notas y el email de los 40 días, el Seguimiento y el anexo de la reiteración), con backup de la base y de los archivos antes de empezar y fuera del horario de los crons (8:15 y 14:00). Los SQL se corren en phpMyAdmin (pestaña **SQL**, con la base del RPAD seleccionada). El orden es: **SQL de estructura → SQL de datos → subir todos los archivos → Restart**. Las dos migraciones van **antes** del código: sin la columna `requiere_nota` fallan las notas, el aviso a las áreas y la aprobación de cambios de datasets.

1. **Consultas previas, de solo lectura.**
   ```sql
   -- Externos activos: tienen que ser 45, los de la carga inicial (35 con Sí y 10 con No)
   SELECT COUNT(*) FROM datasets WHERE activo = 1 AND tipo_gestion = 'externa';
   -- Altas y ediciones de datasets pendientes de aprobación: el código nuevo no les agrega el dato
   SELECT id, tipo_cambio, dataset_id FROM cambios_pendientes WHERE estado = 'pendiente' AND tipo_cambio IN ('crear', 'editar');
   ```
   Si la primera da otro número (un externo creado después de la lista), ese dataset queda sin dato: la verificación del paso 3 lo lista y se completa desde el formulario, y mientras tanto se comporta como "Sí". Los cambios pendientes de la segunda consulta se pueden aprobar o rechazar antes de empezar; los que se aprueben después no pisan el dato (una edición no lo toca) y un alta queda sin dato hasta que se edite.
2. **SQL de estructura:** `migracion-requiere-nota.sql`. Solo agrega la columna `datasets.requiere_nota` (en `NULL` para todos); el código anterior sigue funcionando con ella y, si se corta a mitad, se puede volver a correr. Después, esta consulta tiene que dar **1**:
   ```sql
   SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'datasets' AND column_name = 'requiere_nota';
   ```
3. **SQL de datos:** `migracion-requiere-nota-datos.sql` (45 `UPDATE`, uno por dataset externo: 35 con Sí y 10 con No, según la planilla de carga). **Se corre una sola vez**: después el dato cambia desde la aplicación, con doble verificación. Cada `UPDATE` escribe solo si el dataset sigue siendo externo y todavía no tiene dato, así que repetirlo no pisa un cambio aprobado. Después, esta consulta (la del final del archivo) tiene que dar **0 filas**:
   ```sql
   SELECT id, titulo FROM datasets WHERE activo = 1 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
   ```
   y esta, **0 → 10** y **1 → 35** (los datasets de gestión interna quedan en `NULL`: no aparecen):
   ```sql
   SELECT requiere_nota, COUNT(*) FROM datasets WHERE activo = 1 AND tipo_gestion = 'externa' GROUP BY requiere_nota;
   ```
4. **Subir todos los archivos**, en este orden: primero los del servidor, después `api.js` y los scripts, y al final los HTML.
5. **Restart** de la app (Setup Node.js App). No hace falta Run NPM Install.
6. **Controles después del despliegue:**
   - **Correos → Vista previa y pruebas**, tipo Reiteración y gestión externa: la tabla trae la columna "Requiere nota DGMIT" y "Ver anexo" baja un PDF con una hoja por dataset. "Enviarme una prueba" tiene que llegar a las casillas de prueba con **2 adjuntos** (`Nota-Digital-PRUEBA.pdf` y `Anexo-Nota-Digital-PRUEBA.pdf`).
   - **Gestión de Datasets**: el formulario de un dataset externo muestra "Requiere nota DGMIT" con su valor (en uno nuevo viene vacío y es obligatorio) y la lista tiene el filtro "Requiere nota".
   - **Seguimiento** de un dataset con "No" (por ejemplo, el 74): la ficha dice "Requiere nota DGMIT: No" y el circuito, "No hace falta nota formal".

**Si algo sale mal:** volver a subir los archivos del backup y Restart. La columna puede quedar: es aditiva y el código anterior no la usa. Las notas ya generadas (con su anexo) quedan guardadas tal cual.

### Migración: El editor audita sin responsabilidad

⚠️ Requisito: la entrega **«Requiere nota DGMIT y anexo de la reiteración» desplegada completa** (sus dos SQL y su código), y las migraciones anteriores aplicadas. Este código se apoya en ella: `controllers/cambiosPendientesController.js` importa `services/requiereNotaReglas.js` y escribe `datasets.requiere_nota` al aprobar, y las páginas piden las versiones nuevas de `auth.js`, `main.js` y `api.js`. **Subir solo los archivos de esta sección sobre una instalación sin esa entrega deja la aplicación sin arrancar.** Si las dos van juntas, es un solo kit: los SQL en este orden, `migracion-requiere-nota.sql`, `migracion-requiere-nota-datos.sql` y `migracion-editor-sin-responsabilidad.sql`, y después todos los archivos de las dos entregas y un solo Restart. No hay dependencias nuevas de npm. Backup de la base y de los archivos antes de empezar, y fuera del horario de los crons (8:15 y 14:00). El orden es: **SQL → subir los archivos → Restart**. La migración va **antes** del código: si el código sube sin la columna, toda aprobación y todo rechazo de cambios, de cualquier rol, dan error hasta que se corra.

1. **SQL de estructura:** phpMyAdmin → pestaña **SQL** → pegar `database/updates/migracion-editor-sin-responsabilidad.sql` → **Continuar**. Solo agrega la columna `cambios_pendientes.revisado_sin_responsabilidad` (en 0 para todos los cambios); el código anterior sigue funcionando con ella y se puede volver a correr. Después, esta consulta tiene que dar **1**:
   ```sql
   SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'cambios_pendientes' AND column_name = 'revisado_sin_responsabilidad';
   ```
2. **Subir los archivos** (`controllers/cambiosPendientesController.js`, `services/auditoriaReglas.js`, `public/js/perfil.js`, `public/perfil.html`, `public/js/usuarios.js` y `public/usuarios.html`) y **Restart** (Setup Node.js App). No hace falta Run NPM Install.
3. **Verificar:** un editor, con un auditor disponible, ve en Mi Perfil → Para revisar el cambio de un auditor con "Lo auditan …", la nota ámbar "… queda registrado sin responsabilidad por la auditoría" y los botones habilitados; al aprobar, la pregunta dice "¿Aprobar sin responsabilidad por la auditoría?" y Revisados muestra "Aprobado por … (sin responsabilidad por la auditoría)". Usuarios → Editores dice "Proponen cambios y auditan de respaldo o sin responsabilidad".

**Si algo sale mal:** subir de nuevo los archivos del backup → Restart → phpMyAdmin → pegar `database/updates/rollback-editor-sin-responsabilidad.sql`. Se pierde qué cambios se auditaron sin responsabilidad (quedan como aprobados o rechazados por esa persona, sin la marca). Si alguna vez también hay que deshacer la migración del editor, este rollback va primero.

### Migración: Notas DGMIT

⚠️ Requisito: las migraciones anteriores aplicadas y el código desplegado hasta la entrega anterior (**«Firma de las notas: nombre en negrita»**, y antes **«El editor audita sin responsabilidad»**): los archivos de esta entrega se armaron sobre ese código (por ejemplo, `public/perfil.html` es el de la firma, con las versiones nuevas de `auth.js`, `main.js` y `api.js`). No hay dependencias nuevas de npm y no cambian el cron ni las variables de entorno. Backup de la base y de los archivos antes de empezar, y fuera del horario de los crons (8:15 y 14:00). El orden es: **SQL → subir los archivos → Restart**. La migración va **antes** del código: sin ella, cargar una nota DGMIT y asignar el rol Colaborador dan error (el Seguimiento y el anexo de la reiteración siguen funcionando: la consulta de las notas DGMIT va aislada y, si falla, salen sin ellas).

1. **SQL de estructura:** phpMyAdmin → pestaña **SQL** → pegar `database/updates/migracion-notas-dgmit.sql` → **Continuar**. Suma el rol `colaborador` a `usuarios.rol` (los roles que ya hay no cambian) y crea las tablas `notas_dgmit`, `notas_dgmit_datasets` y `notas_dgmit_historial`, vacías. No cambia datos, el código anterior sigue funcionando con la estructura nueva y se puede volver a correr. Después, la primera consulta tiene que listar las **3 tablas** y la segunda, `enum('superadmin','admin','editor','colaborador','lector')`:
   ```sql
   SHOW TABLES LIKE 'notas_dgmit%';
   SELECT COLUMN_TYPE FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'usuarios' AND column_name = 'rol';
   ```
   ⚠️ **Desde acá, no volver a correr `migracion-editor-auditoria.sql` ni `migracion-usuarios-superadmin.sql`**: las dos fijan el rol sin `colaborador` y, si hay algún colaborador, fallan o le dejan el rol vacío.
2. **Subir los archivos** (zip con los archivos que cambian y sus carpetas → Cargar → Extraer en la carpeta de la app). Agrega `controllers/notasDgmitController.js` y `services/notasDgmitReglas.js`, y reemplaza archivos de `controllers`, `middleware`, `routes`, `scripts` y `services`, las 15 páginas HTML de `public` (suben las versiones de `auth.js`, `main.js` y `api.js`) y `public/js/auth.js`, `seguimiento.js` y `usuarios.js`. Si falta cualquiera de los dos archivos nuevos, la app no arranca. Enseguida, **Restart** (Setup Node.js App). No hace falta Run NPM Install.
3. **Verificar** (Ctrl+F5; solo mirar: no cargar una nota de prueba, porque no se borra, solo se anula):
   - **Seguimiento**: la lista tiene la columna "Última nota DGMIT al área" (con "—") y, arriba a la derecha, "Cargar nota DGMIT" (para administración); un dataset externo vencido que requiere nota DGMIT (Sí) dice "Nota formal / Pendiente de carga" en el circuito, y uno externo sin avisos en el ciclo y sin vencer, "Todavía no hizo falta". Con un lector, el botón no aparece.
   - **Usuarios → Nuevo usuario**: el rol ofrece **Colaborador** (entre Editor y Lector) con su línea de ayuda, y la lista tiene el grupo "Colaboradores". Cancelar sin guardar.
   - **Correos → Vista previa y pruebas**, tipo Reiteración y gestión externa → "Ver anexo": en la hoja de un dataset que requiere nota DGMIT, el circuito dice "Nota formal / La manda la DGMIT al área".
4. **Opcional, después:** pasar a Colaborador la cuenta de la DGMIT desde Usuarios (Ver → Rol → Colaborador → Guardar cambios; el superadmin recibe el aviso del cambio de rol, como siempre), o por SQL en `database/privado/` (no versionado).

**Si algo sale mal:** subir de nuevo los archivos del backup → Restart. La estructura nueva puede quedar (es aditiva y el código anterior no la usa), salvo que ya haya algún colaborador: el código anterior no conoce el rol (lo trata como lector y no lo muestra en ningún grupo de Usuarios). En ese caso, o para sacar la estructura, phpMyAdmin → pegar `database/updates/rollback-notas-dgmit.sql` **después** del Restart: pasa los colaboradores a lector, vuelve el rol a cuatro valores y borra las tres tablas. **Se pierden todas las notas DGMIT cargadas** (exportar las tres tablas antes si hace falta conservarlas). Si también hay que deshacer las entregas del editor, este rollback va **antes** que `rollback-editor-sin-responsabilidad.sql` y `rollback-editor-auditoria.sql`.

### Migración: Métricas y Reportes

⚠️ Requisito: las migraciones anteriores aplicadas (la de notas DGMIT incluida) y el código desplegado hasta la entrega anterior (**«Notas Digitales en hoja oficio y la reiteración en su anexo»**): los archivos de esta entrega se armaron sobre ese código. No hay dependencias nuevas de npm, no cambian las variables de entorno y no hace falta una Tarea Cron nueva: la foto del año la saca la corrida de las 8:15, que tiene que seguir corriendo **todos los días** (día de la semana `*`), así la del 10/01 sale ese día aunque caiga domingo. Backup de la base y de los archivos antes de empezar, y fuera del horario de los crons (8:15 y 14:00). Los SQL se corren en phpMyAdmin (pestaña **SQL**, con la base del RPAD seleccionada). El orden es: **SQL de estructura → subir los archivos → Restart → SQL de datos**. La estructura va **antes** del código: sin las dos tablas, Métricas y el Informe anual dan error y la foto del 10/01 falla (el Seguimiento, el anexo de la reiteración y las notas siguen funcionando: la consulta de lo importado va aislada).

1. **SQL de estructura:** pegar `database/updates/migracion-metricas.sql` → **Continuar**. Crea las tablas `metricas_fotos` (la foto de cada año) y `actualizaciones_recibido` (los «Recibido el» importados), vacías. No cambia datos, el código anterior sigue funcionando con la estructura nueva y se puede volver a correr. Después, esta consulta tiene que dar **2**:
   ```sql
   SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('metricas_fotos', 'actualizaciones_recibido');
   ```
2. **Subir los archivos** (zip con los archivos que cambian y sus carpetas → Cargar → Extraer en la carpeta de la app). Agrega `controllers/metricasController.js` y quince archivos de `services` (`metricasReglas.js`, `metricasCinta.js`, `metricasOpciones.js`, `metricasFoto.js`, `registroReglas.js`, `reportesPdfBase.js`, `reportesNombres.js`, `reportesAgenda.js` y los siete `reportes*Pdf.js`), y reemplaza `app.js`, archivos de `controllers`, `routes` y `services`, las 15 páginas HTML de `public` (suben las versiones de `auth.js`, `main.js` y `api.js`, y el menú dice «Métricas y Reportes») y `public/js/admin-fechas.js`, `admin.js`, `api.js`, `gestion.js`, `perfil.js`, `reportes.js`, `seguimiento.js` y `usuarios.js`. Si falta cualquiera de los archivos nuevos, la app no arranca. Enseguida, **Restart** (Setup Node.js App). No hace falta Run NPM Install.
3. **SQL de datos:** pegar `database/updates/migracion-metricas-recibido-datos.sql` → **Continuar**. Carga en `actualizaciones_recibido` los «Recibido el» y los orígenes de las actualizaciones viejas (28 `INSERT`: los 27 que completó el usuario en el Excel, de 32, y el origen "fuente pública" de la actualización del Presupuesto del 19/10/2026, que ya tenía su «Recibido el» y le faltaba el origen, confirmado por el usuario en el diseño; solo el número del cambio, la fecha y el origen: las observaciones no se importan), sin tocar los cambios registrados. Se puede volver a correr (no duplica nada) y un cambio que no existe no hace nada. Puede ir también justo después del paso 1 (el código anterior no lee la tabla), pero **tiene que entrar antes del 10/01/2027**: ese día se saca la foto de 2026, que no se modifica nunca. Después, la consulta comentada del final del archivo (pegarla sola, sin el `-- ` del principio) lista las actualizaciones aprobadas que siguen sin «Recibido el»: con la base del 24/10/2026 tienen que ser **5 filas** (los cambios 25, 27, 38, 39 y 41). Si da más, son actualizaciones aprobadas después del 24/10 sin la fecha: aparecen en Métricas → Para completar.
4. **Verificar** (Ctrl+F5; solo mirar: no registrar actualizaciones ni cargar métricas o notas de prueba):
   - **Herramientas → Métricas y Reportes** (el menú ya no dice «Reportes»): abre en la pestaña Métricas con «2026 (en curso)», «Mediana» y «Días hábiles»; el circuito de la gestión externa tiene sus cifras (si todavía no hay ninguna nota DGMIT cargada, el tramo de la DGMIT dice «Todavía no hay notas DGMIT cargadas») y «Hoy» del índice de actualización da el mismo porcentaje que la portada. Cambiar a «Promedio», a «Días corridos» y a «Gestión interna» cambia las cifras y la dirección de la página. «Para completar» lista las notas DGMIT pendientes de carga y las actualizaciones sin «Recibido el» o sin el origen de los datos (entre ellas, las 5 del paso 3).
   - **Pestaña Reportes:** siete tarjetas en «Para presentar» y «Para trabajar»; el Informe anual dice «Disponible desde el 10/01/2027». Descargar el Estado general (sale en A4, con el diseño del anexo). Ya no están el Reporte de Cumplimiento ni el Historial de notificaciones.
   - **Gestión:** abre directamente en Proyectos, sin la pestaña Métricas.
   - **Gestión de Datasets → Registrar actualización** de un dataset externo (abrir y cancelar sin guardar): pide «Recibido el» y «¿Quién entregó los datos?»; en uno con «Requiere nota DGMIT» en «No» (por ejemplo, el 74) viene elegida la fuente pública y la fecha se llama «Obtenido el». En uno interno no aparece el origen.
   - Con un **lector**: entra a Métricas y Reportes y descarga un PDF, pero no ve «Cargar el mes» ni «Cargar nota DGMIT».

**Si algo sale mal:** subir de nuevo los archivos del backup → Restart. Las tablas nuevas pueden quedar (son aditivas y el código anterior no las usa). Para sacarlas, phpMyAdmin → pegar `database/updates/rollback-metricas.sql` **después** del Restart: borra las dos tablas y **se pierden la foto de cada año y los «Recibido el» importados** (exportarlas antes si hace falta conservarlas). Los cambios registrados no se tocan: las actualizaciones aprobadas con el código nuevo conservan su «Recibido el» y su origen en el cambio.

**Notas DGMIT de 2026:** el Excel `RPAD - Notas DGMIT 2026 - para completar.xlsx` no entra en esta entrega: se importa con la importación de notas DGMIT (sección 9 de `docs/superpowers/specs/2026-10-24-notas-dgmit-design.md`), que se hace aparte y también tiene que entrar antes del 10/01/2027 para que cuente en la foto de 2026.

### Migración desde v1.4.0 a v1.5.0

⚠️ Requisito: Ejecutar esto si su sistema está en la versión 1.4.0.

Si ya tenés la versión 1.4.0 instalada, importar el script ubicado en /database/updates/migracion-v1.4.0-v1.5.0.sql 

### Migración desde v1.3.0 a v1.4.0

⚠️ Requisito: Ejecutar esto si su sistema está en la versión 1.3.0.

Si ya tenés la versión 1.3.0 instalada, importar el script ubicado en /database/updates/migracion-v1.3.0-v1.4.0.sql 

### Migración desde v1.2.0 a v1.3.0

⚠️ Requisito: Ejecutar esto si su sistema está en la versión 1.2.0.

Si ya tenés la versión 1.2.0 instalada, importar el script ubicado en /database/updates/migracion-v1.2.0-v1.3.0.sql 

### Migración desde v1.0.0 a v1.2.0

Si tenés la versión 1.0.0, ejecutar primero:

```sql
ALTER TABLE `datasets` 
ADD COLUMN `tipo_gestion` ENUM('interna', 'externa') NOT NULL DEFAULT 'externa'
AFTER `observaciones`;
```

Y luego ejecutar la migración de v1.2.0 a v1.3.0.

---

## Instalación en cPanel

### 1. Subir archivos

Subir la carpeta `rpad/` al directorio home:
```
/home/TU_USUARIO/rpad/
```

> ⚠️ **NO en public_html**. Debe estar en el directorio home del usuario.

### 2. Configurar variables de entorno

Copiar `.env.example` a `.env` y completar:
```bash
cp .env.example .env
```

Editar `.env`:
```
# Base de datos
DB_HOST=localhost
DB_USER=tu_usuario_mysql
DB_PASSWORD=tu_password
DB_NAME=tu_base_de_datos

# Seguridad
JWT_SECRET=una_clave_secreta_larga
CRON_SECRET=clave_para_cron_job

# Servidor
PORT=3001
CORS_ORIGIN=https://tu-dominio.com

# SMTP (para notificaciones)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_cuenta@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
```

> **Nota sobre SMTP:** Si el hosting bloquea conexiones SMTP salientes (error ECONNREFUSED), usar Gmail con [contraseña de aplicación](https://myaccount.google.com/apppasswords).

### 3. Configurar Node.js App en cPanel

1. Ir a **Setup Node.js App**
2. Click en **Create Application**
3. Configurar:
   - **Node.js version**: 22.x (o la más reciente disponible)
   - **Application mode**: Production
   - **Application root**: `rpad`
   - **Application URL**: Seleccionar dominio/subdominio
   - **Application startup file**: `app.js`
4. Click **Create**

### 4. Instalar dependencias

Desde la terminal virtual de la app en cPanel:
```bash
npm install
```

### 5. Configurar variables de entorno en cPanel

En la sección **Environment variables** de la app, agregar cada variable del `.env`.

### 6. Crear usuario administrador

```bash
npm run setup-admin
```

### 7. Iniciar la aplicación

Click en **Restart** en el panel de Node.js App.

### 8. Verificar funcionamiento

```
https://tu-dominio.com/api/health
```

Respuesta esperada:
```json
{"status":"ok","timestamp":"...","service":"RPAD API"}
```

---

## Configurar Cron Job (Notificaciones automáticas)

### 1. Verificar que funciona manualmente

```
https://tu-dominio.com/api/cron/notificaciones?secret=TU_CRON_SECRET
https://tu-dominio.com/api/cron/cambios-pendientes?secret=TU_CRON_SECRET
```

### 2. Configurar en cPanel → Tareas Cron

| Minuto | Hora | Día | Mes | Día semana | Comando |
|--------|------|-----|-----|------------|---------|
| 15 | 8 | * | * | * | `curl -s "https://tu-dominio.com/api/cron/notificaciones?secret=TU_CRON_SECRET" > /dev/null` |
| 0 | 14 | * | * | * | `curl -s "https://tu-dominio.com/api/cron/cambios-pendientes?secret=TU_CRON_SECRET" > /dev/null` |

Los dos corren todos los días: cPanel no conoce los feriados y el sistema decide. **Todos los recordatorios automáticos salen solo en días hábiles**: de lunes a viernes, sin los feriados nacionales de fecha fija (01/01, 24/03, 02/04, 01/05, 25/05, 20/06, 09/07, 08/12 y 25/12). Los feriados trasladables cuentan como hábiles.

Si se cambia el horario de una tarea existente, hacerlo fuera de las 8:00–8:15 y de las 13:00–14:00: editada en ese intervalo, la tarea puede correr dos veces ese día y repetir los emails.

El de las **8:15** envía el aviso directo a las áreas y las **Notas Digitales**:

- **Aviso a las áreas**: email a las áreas de gestión externa 40 días antes del vencimiento (sin los datasets con "Requiere nota DGMIT" en "No": ese email anticipa una nota formal que no les llega). Cada día hábil avisa también lo que vence 40 días después de los días no hábiles que siguen (un viernes avisa lo del viernes, el sábado y el domingo): se anticipa, nunca se atrasa.
- **Aviso**: gestión interna 60 días antes del vencimiento y gestión externa 40 días antes, junto con los demás datasets de esa gestión que vencen el mismo mes. Informa **solo datasets a vencer** (todavía no vencidos) y se envía con dos PDF: la nota y el **anexo** (una hoja A4 por dataset).
- **Reiteración**: primer día hábil de cada mes, para los datasets avisados hace 20 días o más que siguen pendientes y para los vencidos que nunca tuvieron aviso (con "Sin aviso previo"). Se envía con dos PDF: la nota y el **anexo** (una hoja A4 por dataset, la del Seguimiento de ese dataset). Si el anexo no se puede generar, la reiteración no sale y se reintenta en la próxima corrida. Las reiteraciones generadas antes del anexo siguen sin él.
- **Nota de auditoría**: pide a la Dirección General la auditoría de los cambios pendientes que el firmante no puede auditar (los propuso él o está de licencia) y que ya tuvieron sus dos recordatorios por email (el primero fue hace dos días hábiles o más: recordatorio el día 1 y el día 2 a las 14:00, nota el día 3 a las 8:15). Sale una sola por día, después de avisos y reiteraciones, y se reitera cada 5 días hábiles mientras sigan pendientes. Comparte el interruptor de **envío automático** con las demás notas y necesita la configuración completa y un Para de auditoría (Correos → Configuración → Notas de auditoría): con el envío automático apagado, la configuración incompleta o sin Para de auditoría no sale ninguna nota, y esos cambios siguen con los recordatorios de las 14:00 en lugar de quedar sin aviso.
- Cada nota se numera (`Nota Digital N° 12/26`), se envía con su PDF adjunto (el aviso y la reiteración, también con el anexo) y queda en el libro de la pantalla de Correos, donde se descargan ambos PDF (botones "PDF" y "Anexo").
- La salida del cron se descarta (`> /dev/null`): el resultado de cada corrida queda en Correos → Estado ("Última corrida diaria"), con una alerta si terminó con errores, si se interrumpió o si el cron dejó de llamar.
- El envío automático (también el de la nota de auditoría) arranca **desactivado**: se activa desde Correos cuando la configuración (destinatarios y firma) está completa.
- **La foto del año** (Métricas y Reportes): desde el 10/01, la primera corrida guarda las métricas del año anterior al 31/12, sea o no día hábil, y no las vuelve a tocar nunca. Va aparte del resto: si falla, no frena las notas, queda en Correos → Estado ("Última corrida diaria") y la corrida del día siguiente la vuelve a intentar.

El de las **14:00** envía el **recordatorio** de cambios pendientes: a cada persona que puede auditar un cambio (los auditores disponibles o, si no hay ninguno, los editores, de respaldo), los cambios propuestos hace una hora o más que no van por nota de auditoría (nunca los propios; con el envío automático apagado o sin Para de auditoría, ningún cambio va por nota y todos llegan por acá). Quien está de licencia no lo recibe.

En el mismo recorrido, **aviso de días sin auditor**: si un cambio que entra en el recordatorio no tiene a nadie que pueda auditarlo (ningún auditor ni editor de respaldo disponible que no sea quien lo propuso), quien lo propuso recibe un solo email con todos sus cambios en esa situación: hasta cuándo no hay auditor disponible y que el conjunto de datos sigue bloqueado. Sale una vez por cambio (queda registrado en `cambios_pendientes.aviso_sin_auditores_at`); si quien propuso está de licencia, sale a su vuelta, mientras siga sin auditor. Apenas vuelve a haber un auditor disponible, llega el recordatorio de siempre.

---

## API Endpoints

### Públicos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/datasets` | Listar datasets (con filtros) |
| GET | `/api/datasets/estadisticas` | Estadísticas para la portada |
| GET | `/api/datasets/:id` | Detalle de un dataset |
| GET | `/api/catalogos/temas` | Listar temas |
| GET | `/api/catalogos/frecuencias` | Listar frecuencias |
| GET | `/api/catalogos/formatos` | Listar formatos disponibles |
| GET | `/api/areas` | Listar áreas activas |
| GET | `/api/areas/:id` | Detalle de un área |
| GET | `/api/andino/fetch?url=...` | Obtener metadatos desde el portal |
| POST | `/api/contacto` | Enviar formulario de contacto |

### Protegidos (requieren JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/auth/verify` | Verificar sesión activa |
| POST | `/api/auth/change-password` | Cambiar contraseña |
| POST | `/api/datasets` | Crear dataset (vía cambio pendiente) |
| PUT | `/api/datasets/:id` | Actualizar dataset (vía cambio pendiente) |
| DELETE | `/api/datasets/:id` | Eliminar dataset (vía cambio pendiente) |
| POST | `/api/datasets/:id/actualizar` | Registrar actualización (vía cambio pendiente): "Datos al", carga, recepción y próxima elegida |
| GET | `/api/datasets/:id/opciones-proxima` | Pedido actual y opciones de próxima actualización para un "Datos al" (`?datos_al=AAAA-MM-DD`) |
| GET | `/api/datasets/calculo-pedido` | Datos solicitados para un tipo, frecuencia y fechas (`?tipo=&meses=&proxima=&datos_al=`), para la vista previa del formulario |
| GET | `/api/cambios-pendientes` | Listar cambios pendientes de aprobación |
| GET | `/api/cambios-pendientes/:id` | Detalle de un cambio pendiente |
| POST | `/api/cambios-pendientes/:id/aprobar` | Aprobar un cambio pendiente |
| POST | `/api/cambios-pendientes/:id/rechazar` | Rechazar un cambio pendiente |
| POST | `/api/areas` | Crear área |
| PUT | `/api/areas/:id` | Actualizar área |
| DELETE | `/api/areas/:id` | Eliminar área |
| GET | `/api/notificaciones/ejecutar` | Ejecutar proceso de notificaciones |
| GET | `/api/notificaciones/prueba/:tipo` | Enviar email de prueba |
| GET | `/api/notificaciones/verificar-smtp` | Verificar conexión SMTP |
| GET | `/api/notificaciones/preview/:tipo` | Previsualizar email |
| GET | `/api/metricas` | Métricas de un año (`?anio=&estadistico=mediana\|promedio&dias=habiles\|corridos&sin=12,45`): el circuito, los resultados, los casos, el contexto, el trabajo del RPAD, las áreas y "Para completar" (cualquier rol con sesión; 404 si ese año no tiene métricas) |
| GET | `/api/metricas/pdf` | PDF "Métricas del año" (los mismos parámetros) |
| GET | `/api/reportes/informe-anual` | PDF "Informe anual" de un año con foto (`?anio=`; 404 sin foto) |
| GET | `/api/reportes/estado-general` | PDF "Estado general de los datasets" |
| GET | `/api/reportes/por-area/:areaId` | PDF "Por área": portada del área y una hoja del Seguimiento por cada dataset activo |
| GET | `/api/reportes/avisos` | PDF "Avisos del RPAD" de un período (`?desde=&hasta=`, por defecto del 1/1 a hoy) |
| GET | `/api/reportes/agenda` | PDF "Agenda de pedidos" (`?meses=3\|6\|12&gestion=ambas\|externa\|interna`) |
| GET | `/api/reportes/para-completar` | PDF "Datos para completar" (`?anio=`, como `/api/metricas`; por defecto el año en curso) |
| GET | `/api/seguimiento` | Seguimiento: la lista de todos los datasets con su estado y los avisos del ciclo abierto (cualquier rol con sesión) |
| GET | `/api/seguimiento/:id` | Seguimiento de un dataset: ficha, ciclo abierto y sus avisos, cinta, movimientos e hitos (404 si no existe) |
| GET | `/api/seguimiento/:id/pdf` | PDF de una hoja del seguimiento de un dataset |
| POST | `/api/notas-dgmit` | Cargar una nota DGMIT (`{ numero, recibida, tipo, datasets }`; administración y el colaborador) |
| PUT | `/api/notas-dgmit/:id` | Corregir una nota DGMIT (lo mismo más `motivo`; quien la cargó o administración) |
| POST | `/api/notas-dgmit/:id/anular` | Anular una nota DGMIT (`{ motivo }`; quien la cargó o administración) |

### Cron (requiere secret)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/cron/notificaciones?secret=...` | Ejecutar notificaciones (para cron) |
| GET | `/api/cron/cambios-pendientes?secret=...` | Recordatorio de cambios pendientes (para cron) |

### Filtros disponibles en `/api/datasets`

- `?tema=ID` - Filtrar por tema
- `?frecuencia=ID` - Filtrar por frecuencia
- `?estado=actualizado|proximo|atrasado|sin-respuesta` - Filtrar por estado
- `?busqueda=texto` - Buscar en título y descripción
- `?area=ID` - Filtrar por área responsable

---

## Troubleshooting

### Error de conexión a MySQL
- Verificar credenciales en `.env`
- Verificar que el usuario MySQL tiene permisos sobre la base de datos

### Error 503 / App no inicia
- Revisar logs en cPanel → Setup Node.js App
- Verificar que `app.js` existe y está configurado como startup file

### Error SMTP ECONNREFUSED
- El hosting bloquea conexiones SMTP salientes
- Solución: Usar Gmail con contraseña de aplicación

### Token inválido o expirado
- Cerrar sesión y volver a iniciar

### Notificaciones no se envían
- Verificar conexión SMTP desde panel Admin
- Revisar que CRON_SECRET coincide en `.env` y cron job
- En Correos, revisar que el envío automático de Notas Digitales esté activado y que no haya alertas de configuración incompleta
- En Correos → Estado, revisar la línea "Última corrida diaria" y sus alertas (corrida con errores, interrumpida o que no llegó)
- Revisar en el libro de Notas Digitales las notas "Fallida" (el último error se ve con el botón "Ver") y reintentarlas
- En desarrollo, `EMAIL_SOLO_A` en `.env` limita los envíos a esas casillas

### PDFs con páginas en blanco
- Actualizar a v1.3.0 (corregido con `bufferPages: true`)

---

## Changelog

### Métricas y Reportes (2026-10)
- Herramientas → "Reportes" pasa a ser **Métricas y Reportes**, con dos pestañas. **Métricas** muestra, para el año elegido, cuánto tarda cada paso del circuito de las dos gestiones (con la mediana o el promedio, en días hábiles o corridos, la cantidad de casos y los que siguen en curso), la cinta del recorrido típico, la lista de casos, los resultados del año (actualizados a tiempo, cobertura del aviso y reiteraciones), el índice de actualización mes a mes, la antigüedad de los vencidos, el trabajo del RPAD, las áreas y los temas y "Para completar". Se puede destildar un dataset para ver los números sin él (con una franja que lo avisa), y todo viaja en la dirección de la página
- El 10/01 de cada año la corrida de las 8:15 guarda la **foto** del año anterior al 31/12, que no cambia nunca: los años anteriores se ven desde su foto
- **Reportes:** siete PDF con el diseño del anexo (A4): Métricas del año, Informe anual (desde el 10/01/2027), Estado general, Por área (con una hoja del Seguimiento por dataset), Avisos del RPAD (reemplaza al Historial de notificaciones), Agenda de pedidos y Datos para completar. Se saca el reporte de Cumplimiento
- **Gestión** queda solo con Proyectos: sus métricas, el ranking de áreas, las métricas manuales y el CSV se mudaron a Métricas, y sin Chart.js ninguna página carga librerías por CDN (la política de seguridad ya no permite ninguno)
- **"Registrar actualización"** pide siempre "Recibido el" y, en gestión externa, quién entregó los datos (el área o una fuente pública: entonces la fecha se llama "Obtenido el"). La edición del dataset ya no deja mover juntas la carga en el portal y la próxima actualización. Los cambios pendientes de antes se aprueban igual
- Los "Recibido el" y los orígenes de las actualizaciones anteriores se cargan una vez desde un Excel (más el origen del Presupuesto del 19/10, confirmado por el usuario), sin tocar los cambios registrados
- Dos SQL (la estructura antes del código y los datos del Excel después, antes del 10/01/2027) y dos tablas nuevas, de 27 a 29; Restart, sin Run NPM Install. Ver [Migración: Métricas y Reportes](#migración-métricas-y-reportes)

### Notas Digitales en hoja oficio y la reiteración en su anexo (2026-10)
- El PDF de las Notas Digitales (aviso, reiteración, autorización y auditoría, también la prueba y la vista previa de Correos) sale en hoja oficio Legal, 8½ × 14 pulgadas (612 × 1008 pt, 215,9 × 355,6 mm), el papel en el que se imprime; antes salía en 216 × 330 mm
- La nota se arma igual: el membrete, los márgenes, la letra, las tablas, la firma, el cierre y la paginación no cambian. Cada hoja tiene 26 mm más para el texto (unos 5 renglones, o 3 a 4 filas de tabla): una nota que salía en dos hojas puede salir en una, y la reiteración del 02/11 de la simulación pasa de 7 a 8 filas en la primera hoja
- Los anexos (del aviso y de la reiteración), el PDF del Seguimiento y los reportes siguen en A4. Las notas ya generadas conservan su PDF de 216 × 330 (también las pendientes o fallidas generadas antes del despliegue)
- El anexo de la reiteración muestra también la propia reiteración que acompaña, como las demás notas: en cada hoja es el movimiento más nuevo ("Nota Digital N° 2/27 a DGMIT"), suma uno en "Avisos del ciclo abierto" y tiene su marca en la cinta. En "Ver anexo" de Correos va como "N° XX" y en la prueba como "N° PRUEBA" (con datos reales, el mismo día en que salió la reiteración real, en lugar de ella, para no repetirla). El Seguimiento de la pantalla y la descarga de su PDF no cambian, ni los anexos ya generados. En el PDF, si la lista de los avisos del ciclo no entra en sus dos renglones, se recorta del medio: siempre se ven el primer número y los últimos; y las etiquetas de las notas en la cinta ya no se pisan (también en la descarga del Seguimiento)
- Solo archivos (`services/notasDigitales.js`, `services/notasDigitalesContenido.js`, `services/notasDigitalesPdf.js`, `services/notasDigitalesSeguimiento.js`, `services/seguimientoCinta.js`, `services/seguimientoPdf.js` y `services/seguimientoReglas.js`); Restart, sin SQL ni Run NPM Install

### Notas DGMIT en el Seguimiento (2026-10)
- Rol nuevo, **Colaborador**: ve lo mismo que un lector y, además, carga notas DGMIT. El editor crea y modifica lectores y colaboradores, y pasa a alguien de uno a otro; Usuarios suma el grupo "Colaboradores" y una línea de ayuda debajo del rol
- Herramientas → Seguimiento → **Cargar nota DGMIT**: número, fecha de recepción, tipo (solicitud o reiteración) y datasets; se corrige o se anula con motivo y nunca se borra. El número no se repite entre las notas sin anular
- La nota se ve en el circuito (en violeta; sin nota, "Pendiente de carga", "Todavía no hizo falta" o "Ya no se pide"), en los movimientos, en la cinta, en la columna "Última nota DGMIT al área", en el PDF y en el anexo de la reiteración, donde sin nota el circuito dice solo "La manda la DGMIT al área"
- No es un aviso del RPAD: no cambia los avisos del ciclo, el estado ni los ciclos; no sale ningún email y las Notas Digitales no cambian
- Un SQL de estructura antes de subir el código (el rol y tres tablas nuevas, de 24 a 27); Restart, sin Run NPM Install

### Firma de las notas: nombre en negrita (2026-10)
- En todas las Notas Digitales (aviso, reiteración, autorización y auditoría) y en las dos firmas, el nombre va en negrita y el cargo un punto más chico; el renglón "Personal contratado, cumpliendo funciones de" también baja un punto. En el PDF: nombre en negrita de 11 pt, cargo en 10 y el renglón en 8; en el email: 15, 14 y 11 px. El aire hasta la leyenda y la línea CC no cambia
- La vista previa "Así sale en las notas" de Mi Perfil muestra lo mismo. El texto plano del email no cambia
- El final de la nota se mide de verdad: el remitente, la firma y la línea CC se reservaban con un alto fijo (unos 70 mm) y un cierre que entraba pasaba a la hoja siguiente (la reiteración del 02/11 de la simulación dejaba 111 mm en blanco y pasaba a una segunda hoja un bloque de 103 mm). Ahora se reserva lo que ocupa; lo que viaja junto no cambia (si no entra entero, pasa entero a la hoja siguiente). En todas las notas
- Las notas ya generadas conservan su PDF guardado (también las pendientes o fallidas generadas antes del despliegue)
- Solo archivos (`services/notasDigitalesContenido.js`, `services/notasDigitalesPdf.js`, `public/js/perfil.js` y `public/perfil.html`); Restart, sin SQL ni Run NPM Install

### El editor audita sin responsabilidad (2026-10)
- Con auditores disponibles, un editor puede aprobar o rechazar el cambio que propuso un auditor; queda registrado "sin responsabilidad por la auditoría". El respaldo (sin auditores disponibles) no cambia, y el cambio de un editor sigue siendo de los auditores
- Mi Perfil lo avisa en la fila ("Este cambio lo auditan … Si lo aprobás o lo rechazás vos, queda registrado sin responsabilidad por la auditoría."), lo repite al confirmar y lo muestra en Revisados y Mis cambios; si mientras tanto la situación cambia, no se registra y la fila se actualiza
- Los recordatorios, la nota de auditoría, los días sin auditor, el Seguimiento y los PDF no cambian
- Un SQL de estructura antes de subir el código; Restart, sin Run NPM Install

### Avisos del ciclo desde la última actualización (2026-10)
- Seguimiento: las actualizaciones de antes de la doble verificación (diciembre de 2025) cierran el ciclo, así que los avisos de antes ya no cuentan para el ciclo abierto (Áreas específicas de género pasa de 3 avisos a 1; Hotelería, Medios Periodísticos y la Guía Telefónica de áreas de género, de 2 a 0). Las que después se deshicieron (la tanda del 17/12/2025 en 8 datasets, cuya carga volvió atrás) no cuentan. El ciclo de antes no tiene vencimiento conocido: en la cinta va sin "vence" ni rayado
- "Avisos del ciclo abierto" dice desde cuándo se cuentan ("Desde la actualización del 16/12/2025 · Vencimiento del 30/11/2026"), en la pantalla, el PDF y el anexo de la reiteración
- La columna "Último aviso" de la lista es la del ciclo abierto, el mismo que se cuenta ("—" si no hubo ninguno)
- Sin SQL ni Run NPM Install; Restart

### Requiere nota DGMIT y anexo de la reiteración (2026-10)
- Dato nuevo en los datasets de gestión externa, "Requiere nota DGMIT" (Sí o No): se carga desde la planilla de los 45 externos y se edita con doble verificación; la lista de Gestión de Datasets suma el filtro "Requiere nota"
- El aviso externo suma la columna "Requiere nota DGMIT" (5 columnas) y la reiteración externa también (7 columnas, con la situación de hoy debajo de la fecha de vencimiento); las notas internas no cambian y un dataset con "No" sigue saliendo en todas las notas
- El email de los 40 días al área no sale para los datasets con "No", porque anticipa una nota formal que no les llega
- Seguimiento: la ficha suma el dato y, con "No", el circuito dice "No hace falta nota formal"
- Cada reiteración (interna y externa) lleva un anexo en PDF con la hoja del Seguimiento de cada dataset, y el email dice "SE ADJUNTAN NOTA Y ANEXO EN PDF"; en Correos, "Ver anexo" y la prueba también valen para la reiteración. Las notas ya generadas no cambian
- Dos SQL (estructura y carga inicial) antes de subir el código; Restart, sin Run NPM Install

### Seguimiento del dataset (2026-10)
- Página nueva, Herramientas → Seguimiento, para todos los roles con sesión: por dataset, la ficha, los avisos del ciclo abierto (el circuito del RPAD a DGMIT, de ahí al área y el email de anticipo a los 40 días), una cinta de los últimos 12 meses y la lista de movimientos (altas, actualizaciones, cambios, propuestas, Notas Digitales, emails a DGMIT y al área, bajas) con filtros, detalle y hitos de vencimiento
- Vista "Sin elegir" con todos los datasets, los vencidos primero, y PDF de una sola hoja A4 con el estilo del anexo, QR al portal y los últimos 8 movimientos
- Lenguaje neutro: "Vencido hace N días" y "Estuvo vencido N días"; la insignia "Vencido" solo en el Seguimiento (el resto del sitio no cambia)
- Gestión de Datasets: cada fila suma el ícono "Ver seguimiento"
- Las 14 páginas con carcasa suman el link en el menú lateral; los ayudantes del anexo (`services/notasDigitalesAnexo.js`) se exportan sin cambiar lo que dibujan
- Sin cambios en la base, los crons ni los emails: no hay SQL ni "Run NPM Install"; hace falta Restart por las rutas nuevas

### Índice de la portada: "Al día" y el texto en orden (2026-10)
- El cuadro del índice une Actualizados y Próximos a vencer en "Al día" (el mismo número que el texto), con una leyenda que dice cuántos hay de cada uno; la leyenda de Vencidos también dice cuántos atrasados y cuántos sin respuesta hay
- Dentro de cada grupo, los cuadritos van por categoría (primero los actualizados y después los próximos; primero los atrasados y después los sin respuesta) y cada una por título
- El pie del cuadro, que dice qué conjunto se señala, vuelve a su texto ("Cada cuadrado es un conjunto de datos…") al sacar el mouse de los cuadritos o salir de ellos con el teclado; ya no queda el nombre del último
- El texto se lee en orden: primero el registro y sus eventuales, y después el índice ("El 81% de los datasets que tienen fecha de vencimiento están al día: 54 de 67.")
- Solo `public/index.html` y `public/js/dashboard.js`: sin cambios en la API, la base ni las hojas de estilo

### Estados en los reportes PDF (2026-10)
- El reporte por Área ya no cuenta como vencidos a los datasets sin fecha de próxima actualización: van en su grupo, "Sin fecha (n)", al final, y una línea debajo de las tarjetas los cuenta
- Los reportes Estado General y por Área suman la tarjeta "Eventuales" (Total, Actualizados, Próximos, Vencidos y Eventuales): las tarjetas suman el total; los sin fecha, si hay, los aclara una línea (en el Estado General, que cuentan en la tasa como no al día)
- En administración, el filtro de la lista que decía "Al día" ahora dice "Actualizados" (son los que vencen en más de 60 días; los próximos siguen en "Vencen en menos de 60 días"). "Al día" queda para actualizados + próximos, como en la tasa y en el Cumplimiento
- Sin cambios en la API, la base, los crons ni los emails

### Rediseño de las páginas públicas (2026-10)
- Versión 2.0.0. Identidad visual nueva en las cinco páginas públicas: banda celeste con la ola, colores pastel de estado que pasan el contraste AA, el cuadrito de color como marca de cada conjunto de datos, y tipografía Bricolage Grotesque (títulos) y Figtree (texto), que llega también a administración (solo la letra)
- Encabezado, menú lateral y footer nuevos en las 13 páginas con carcasa: Inicio, Datasets, Calendario y Contacto a la vista en el encabezado; el menú lateral queda para Administración, Herramientas y Mi cuenta; footer azul con `RPAD v2.0.0` y el año automático. Se va el link roto "Verificar Sello" de Gestión y el menú lateral recupera su logo
- Portada nueva: índice de actualización, mosaico de todo el registro, qué vence en los próximos 12 meses (sin Chart.js), Vencidos, Próximos a vencer y Últimas cargas en el portal
- Datasets: los estados como botones con cantidades, orden (nombre, próximo vencimiento, área) y vista de lista, guardados en la URL; los links de siempre (`?estado=`, `?mes=`, `?tema=`, `?frecuencia=`, `?busqueda=`) siguen andando
- Calendario anual (vencidos, los 12 meses desde el actual y "Más adelante") sin FullCalendar: se van las flechas sin ícono y el idioma en inglés; el filtro de tema mira también el tema secundario
- Detalle y Contacto con la estética nueva; si falla la carga, las páginas lo dicen en lugar de quedar cargando o mostrar ceros
- Celular sin desbordes a 375 px, foco visible y `<label>` en todos los filtros
- Vista previa al compartir un link (metas Open Graph e `img/compartir.png`); `robots.txt` deja pasar solo a los robots de vista previa y sigue cerrado para los buscadores
- Solo archivos estáticos de `public/` (más la documentación): sin cambios en la API, la base, los crons ni los emails

### Aviso sin fecha sugerida y frecuencia acumulada (2026-10)
- El aviso de las Notas Digitales (interno y externo) ya no lleva la columna "Fecha sugerida de envío", que repetía en cada fila el mismo vencimiento: "Próximos a vencer" queda con Conjunto de datos, Área, Frecuencia y Datos solicitados, y el párrafo del aviso externo pide los datos "del período que se indica en cada caso"
- Si un aviso junta más de un vencimiento (la víspera de una licencia larga, o un aviso que se recupera tarde), las filas de "Próximos a vencer" van ordenadas por vencimiento, con una fila a todo el ancho "Vencen el dd/mm/aaaa" (o "Vence el …") antes de cada grupo, en el HTML, el texto y el PDF; el aviso de todos los días no cambia
- La frecuencia dice "(Acumulado)" cuando el pedido acumula desde el 1/1 del año con una frecuencia menor al año (por ejemplo, "Trimestralmente (Acumulado)"): en las tablas del aviso y de la reiteración, en el anexo, en el email a las áreas de los 40 días y en la vista previa del admin
- El anexo dice "Vence el dd/mm/aaaa · faltan N días" (o "Venció el … · hace N días") y el email de los 40 días va sin fecha; el admin dice "Vence" en la lista, en "Registrar actualización" y en el ciclo. Las notas ya generadas no cambian

### Vista previa como sale y aviso adelantado que no salió (2026-10)
- La vista previa de Correos (HTML, PDF y anexo) y "Enviarme una prueba" muestran la nota como saldría en la próxima corrida con notas, con la misma selección que la corrida: si hoy es un día no hábil o no se generan notas (licencia del firmante sin persona autorizada, o esa persona de licencia), la vista previa lo dice y todas muestran el día en que saldría
- Un aviso adelantado que no salió ya no deja al dataset sin aviso en su fecha, y ese aviso no cita la nota anticipada que no salió

### Aviso en su fecha con persona autorizada (2026-10)
- Durante la licencia del firmante titular con persona autorizada, la víspera sigue anticipando los avisos y, además, cada dataset adelantado vuelve a salir en un aviso en su fecha, presentado por la persona autorizada con las dos firmas y el párrafo que cita la nota anticipada
- La reiteración muestra cada dataset una sola vez y "Informado en" nombra todos sus avisos; Correos → Estado muestra esas fechas en "Próximas notas"

### Fechas de los datasets (2026-10)
- "Datos al", "Cargado en el portal" y la próxima actualización son tres datos distintos; la próxima y "Datos al" son siempre fin de mes (febrero, el 28)
- Tipo de pedido por dataset: las Notas Digitales, el anexo y el aviso a las áreas dicen qué datos se solicitan; cada nota guarda lo que pidió
- "Registrar actualización" propone la próxima con opciones, la persona elige, y al aprobarse queda en el historial de actualizaciones
- Admin renovado: lista con filtros por estado y tipo de pedido, "Datos publicados" y "Próximo pedido", y formulario con la sección "Actualización y pedido"
- Un solo cálculo de estado, en el servidor, con el estado Eventual; la tasa de actualización deja afuera a los eventuales (tablero, Estado General y reporte de Cumplimiento coinciden)
- El sitio público distingue "Datos al", "Cargado en el portal" y la próxima prevista en el detalle del dataset; el listado muestra "Datos al" y la próxima, y el CSV suma "Cargado en el portal"

### Mi Perfil en pestañas (2026-10)
- Mi Perfil en pestañas: Para revisar, Mis cambios, Mis datos y Mi firma; el email de las 14:00 abre Para revisar
- Gestión de cambios rediseñada: cada cambio es una fila que se despliega con lo viejo tachado y lo nuevo resaltado, y se aprueba (con confirmación) o se rechaza (con motivo) en la misma fila
- Para revisar con Pendientes y Revisados; Mis cambios separa los que esperan auditoría de los resueltos; de a 20 con "Ver 20 más"
- El editor ve en cada cambio si le toca auditarlo; las fechas que no cambiaron de día ya no figuran como cambiadas

### Editor y auditoría de cambios pendientes (2026-10)
- Rol `editor`: todo lo de un admin, pero audita cambios solo de respaldo (si ningún auditor está disponible) y en el panel solo crea y modifica lectores
- Mínimo de 2 auditores (superadmin o admins); el firmante titular sigue siendo superadmin o admin
- Recordatorio de las 14:00 (solo días hábiles) a quienes pueden auditar cada cambio, desde una hora después de propuesto
- Nota Digital de auditoría a la Dirección General para los cambios que el firmante no puede auditar, reiterada cada 5 días hábiles
- Días sin auditor: el formulario de licencias los advierte, quien propone un cambio sin nadie que lo audite recibe un aviso (una vez por cambio) con la fecha de vuelta, y Correos → Estado los muestra

### Días hábiles, licencias y firmas (2026-10)
- Todos los recordatorios automáticos salen solo en días hábiles (sin fines de semana ni los feriados nacionales fijos)
- Licencias de los administradores: durante la licencia no reciben emails; resumen al superadmin a la vuelta
- Firma propia en Mi Perfil y firmante titular de las Notas Digitales
- Personal contratado (vínculo "contrato"): en las notas, su firma lleva entre el nombre y el cargo, en letra más chica, "Personal contratado, cumpliendo funciones de", y los párrafos lo nombran "personal contratado, cumpliendo funciones de {cargo}"; Mi Perfil le muestra cómo sale. Quien no es contratado firma como siempre
- Durante la licencia del firmante: avisos anticipados a la víspera, y notas presentadas por una persona autorizada (autorización por Nota Digital, dos firmas y cita de esa nota) o reiteraciones a la vuelta
- La persona autorizada puede tener una licencia propia que se superponga en parte con la del titular (la autorización se comunica igual en la víspera y los días en que la persona autorizada falta no se generan notas; el formulario lo advierte y Correos → Estado lo muestra como advertencia); si cubre todos los días hábiles de la del titular, no se puede autorizar

### Usuarios y superadmin (2026-10)
- Rol `superadmin`, con la cuenta protegida y avisos por email de cambios hechos por otros admins
- Panel de usuarios: alta, edición, cargo y vínculo, roles, activación, links de acceso e historial
- Contraseñas por link de un solo uso (invitación y recuperación) y "¿Olvidaste tu contraseña?"
- Desactivar a alguien o cambiarle el rol tiene efecto inmediato
- Mínimo de 2 aprobadores activos para la doble verificación

### v1.5.0 (2026-02-06)
- Sistema de doble verificación para cambios en datasets: un operador propone y otro aprueba o rechaza.
- Nueva tabla `cambios_pendientes` con estados pendiente/aprobado/rechazado y validación JSON.
- Nuevo controlador `cambiosPendientesController.js` con endpoints para listar, aprobar y rechazar cambios.
- Las operaciones de crear, editar y eliminar datasets ahora pasan por la cola de aprobación.
- Registro de revisor y comentario de rechazo en cada cambio.
- Artículos gramaticales en tabla `areas`: columnas `articulo` y `articulo_superior` (ENUM el/la) para correcta visualización de nombres.
- Formulario de contacto público (`contacto.html`) con `contactoController.js`.
- Página de configuración de correos separada (`correos.html`).
- Página de perfil de usuario (`perfil.html`) para cambio de contraseña y datos personales.
- JavaScript compartido entre páginas (`main.js`).
- Mejoras en el generador de notas DOCX.
- Archivo de referencia `htaccess-frontend.txt` para configuración Apache.

### v1.4.0 (2025-12-10)
- Migración del sistema de formatos a relación Many-to-Many (N:M).
- Soporte para múltiples formatos por dataset (sin límite).
- Sistema de "chips" en la interfaz de administración para selección rápida de formatos.
- Normalización automática de nombres de formatos al importar desde Andino.
- Eliminación de columnas `formato_primario` y `formato_secundario`.
- Generador de notas administrativas en formato DOCX para solicitud de actualización de datasets.
- Soporte para notas internas (a Subsecretaría) y externas (a organismos).
- Selección múltiple de datasets con períodos pendientes en el generador.
- Formato de notas según Resolución 2820/22.
- Sistema de roles de usuario: `admin` (acceso completo) y `lector` (solo lectura).
- Usuarios con rol `lector` pueden ver todas las secciones pero no crear, editar ni eliminar.
- Middleware `adminOnly` para proteger rutas de escritura en el backend.
- Ocultamiento automático de botones de acción en frontend según rol.
- Calendario interactivo de vencimientos con FullCalendar.js.
- Vista mensual con navegación y colores por estado (verde/amarillo/rojo).
- Modal con listado de datasets al hacer clic en un día.
- Filtros por área y tema en el calendario.
- Exportación a iCal (.ics) compatible con Google Calendar, Outlook y Apple Calendar.
- Script `setup-admin.js` actualizado para solicitar rol al crear usuarios.

### v1.3.0 (2025-12-07)
- Sistema de gestión de áreas con CRUD completo
- Tabla `areas` estructurada con contacto y emails múltiples
- Notificaciones diferenciadas para gestión interna vs externa
- Nuevo tipo de notificación `area-aviso-40` para avisar a las áreas
- Sistema de reportes PDF con 4 tipos de reporte
- Tarjetas visuales en reportes Por Área e Historial
- Calendario de vencimientos en dashboard (próximos 12 meses)
- Tabla `notificaciones_log` para registro de emails enviados
- Fix área en detalle dataset: muestra correctamente el nombre

### v1.2.0 (2025-12-05)
- Integración con API de Andino (portal de datos abiertos)
- Flujo de 2 pasos para crear datasets con importación automática
- Botón "Actualizar desde portal" en edición
- Sistema de notificaciones por email
- Alertas automáticas según tipo de gestión y días restantes
- Panel de notificaciones en administración
- Endpoint de cron para ejecución automática
- Plantillas HTML institucionales para emails

### v1.1.0 (2025-12-04)
- Tablero de seguimiento rediseñado con hero section y gráfico de dona
- Campo `tipo_gestion` para diferenciar datasets internos/externos
- Estados "Atrasado" y "Sin respuesta" según tipo de gestión
- Stat cards clickeables con animaciones

### v1.0.0 (2025-11-30)
- Versión inicial
- CRUD de datasets
- Dashboard con estadísticas
- Autenticación JWT
- Panel de administración

---

## Licencia

Uso interno - Municipalidad de Comodoro Rivadavia

## Contacto

**Dirección de Datos Públicos y Comunicación**  
Dirección General de Modernización e Investigación Territorial  
Municipalidad de Comodoro Rivadavia

📧 datospublicos@comodoro.gov.ar  
🌐 https://datos.comodoro.gov.ar
