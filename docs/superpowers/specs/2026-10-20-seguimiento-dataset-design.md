# Seguimiento del dataset

Fecha: 20/10/2026.

Mockups: `2026-10-20-seguimiento-mockups/`. Usan datos de producción del 20/10/2026, con los nombres de las personas cambiados.
- `consolidado.html` (con la carcasa real) y `consolidado-escritorio.png`: la pantalla. Tiene una botonera para ver tres vistas: "Un dataset", "Sin elegir" y "Menú".
- `pdf.html` y `Seguimiento-mockup-PDF.pdf`: el PDF, con tres hojas reales.
- `cinta-pruebas.html`: la cinta con 9 datasets reales.
- `cinta.js`: el prototipo de las reglas.

**Este documento manda sobre los mockups.** Los mockups son anteriores a tres decisiones:
- los textos neutros del vencido ("Vencido hace N días" en lugar de "sin entregar");
- la insignia "Vencido";
- las reglas nuevas de "Ciclos": la asignación de avisos y la reprogramación después de vencido.

## Por qué

Hoy no hay un lugar donde ver todo lo que pasó con un dataset. No se ve cuándo se actualizó en el RPAD, ni cuándo y cómo se avisó que había que pedir los datos, ni quién propuso y quién aprobó cada cambio. Cuando alguien pide ese detalle, hay que armarlo a mano cruzando el Libro de Notas Digitales, los emails y los cambios aprobados.

El Seguimiento junta todo eso por dataset, en una pantalla y en un PDF de una hoja. Cumple dos funciones a la vez:
- es el **registro de todos los movimientos** del dataset;
- es la **prueba de cada vez que el RPAD avisó** que había que pedir la información.

Lo usan todos los roles, lector incluido. Es de uso interno e integral: muestra todo, también quién hizo cada cosa.

## El circuito que cuenta

El Seguimiento no puede decir "se le pidió al área N veces", porque el RPAD no le pide los datos al área. El circuito real es este:

- **Gestión externa:**
  - El RPAD (la Dirección de Datos Públicos y Comunicación) les avisa a **DGMIT y a la Dirección Administrativa**. Antes lo hacía por email; desde el 13/10/2026, por Nota Digital (Para DGMIT, CC la Dirección Administrativa).
  - Ellas mandan **la nota formal al área**, por fuera del RPAD. Ese paso no queda registrado.
  - A los 40 días, el RPAD le manda al área **un email anticipando que va a recibir una nota formal** (`area-aviso-40`).
- **Gestión interna:** el RPAD les avisa a **DGMIT y a la Dirección de Investigación Territorial**, que hacen el relevamiento por fuera del RPAD. No hay email al área.

Todo el texto de la pantalla y del PDF respeta este circuito:
- los emails de los siete tipos retirados (`interno-*`, `externo-*`) son "Email a DGMIT", no "recordatorio interno";
- las Notas Digitales son "Nota Digital a DGMIT";
- `area-aviso-40` es "Email al área: anticipo de la nota formal".

**Lenguaje neutro (pedido del usuario).** El atraso muchas veces no depende del área, sino de que no se mandó la nota formal. Por eso nada dice "sin entregar", "sin respuesta del área" ni "atrasado". Se describe el estado del dataset:
- "Vencido hace N días";
- "Estuvo vencido N días";
- "Venció";
- "Actualizado el dd/mm/aaaa, N días después del vencimiento".

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- Elegir un dataset y ver en una sola pantalla:
  - su ficha;
  - los avisos del ciclo abierto;
  - una cinta de los últimos 12 meses;
  - la lista de todos sus movimientos.
- Bajar un PDF de **una sola hoja A4**, con el lenguaje visual del ANEXO de los avisos. Lleva:
  - la ficha con QR al portal;
  - los avisos del ciclo abierto;
  - la cinta;
  - los últimos 8 movimientos.
- Una vista inicial con todos los datasets y sus avisos, con los vencidos primero.

**No objetivos**
- No hay carga manual de movimientos: el Seguimiento muestra solo lo que registró el sistema. Lo decidió el usuario, también para las notas formales que mandan DGMIT o la Dirección Administrativa.
- No hay PDF por área ni PDF de todos los datasets: es de a un dataset.
- No se reconstruye lo que no quedó registrado: las ediciones directas anteriores al 26/01/2026 y las cargas por SQL.
- No se usan las fechas del portal (CKAN).
- No es público: requiere sesión.
- No cambia el nombre de los estados en el resto del sitio. "Sin respuesta del área" y "Atrasado" siguen igual en la portada, el listado, los reportes y administración.

**Antiobjetivos** (sería un fracaso aunque funcione)
- Presentar como pedido al área algo que no lo fue. Por ejemplo, contar los emails a DGMIT como pedidos al área.
- Atribuirle a un vencimiento avisos que eran de otro.
- Usar un texto que culpe al área de un atraso.
- Que un dataset sin registros parezca "sin movimientos". Una aclaración fija dice desde cuándo hay registro.
- Que el PDF pase a una segunda hoja.
- Romper algo de lo implementado: el ANEXO, los reportes, la carcasa, los permisos o la doble verificación. **No se toca `aprobarCambio`.**

## Las fuentes y los movimientos

Todo sale de la base que ya existe: **no hay tablas, columnas ni migraciones nuevas.** Cada fuente da un tipo de movimiento:

| Movimiento | Fuente | Fecha del movimiento | Título | Detalle | Quién |
|---|---|---|---|---|---|
| Alta | `datasets.created_at` y, si existe, el cambio `crear` aprobado | `created_at`, en hora argentina | Alta en el RPAD | "Carga inicial del registro." o "Cambio #N." | Con cambio, Propuso X / Aprobó Y. En la carga inicial, vacío |
| Actualización registrada | Cambio `editar` aprobado que cambia `ultima_actualizacion` | La nueva `ultima_actualizacion` ("Cargado en el portal") | Actualización registrada | "Cargado en el portal el dd/mm/aaaa. Próxima: dd/mm/aaaa. Cambio #N.", más "Datos al …" y "Recibido el …" si los trae | Propuso X / Aprobó Y |
| Actualización anterior a la doble verificación | `historial_actualizaciones` sin `cambio_id` (diciembre de 2025) | `fecha_actualizacion` | Actualización registrada | "Cargado en el portal el dd/mm/aaaa. Registro anterior a la doble verificación." | El usuario del registro |
| Cambio en la ficha | Cambio `editar` aprobado que **no** cambia `ultima_actualizacion` | `revisado_at` | Cambio en la ficha | Lo que cambió. Por ejemplo, "Próxima: 31/07/2026 a 31/05/2026." o "Cambió la frecuencia." | Propuso X / Aprobó Y |
| Propuesta rechazada | Cambio rechazado | `revisado_at` | Propuesta rechazada | Lo propuesto, el `Motivo: "…"` y "Cambio #N." | Propuso X / Rechazó Y |
| Propuesta pendiente | Cambio pendiente | `created_at` | "Actualización pendiente de aprobación" o "Cambio pendiente de aprobación" | Lo propuesto y "Cambio #N." | Propuso X |
| Baja | Cambio `eliminar` aprobado | `revisado_at` | Baja del RPAD | "Cambio #N." | Propuso X / Aprobó Y |
| Nota Digital a DGMIT | `notas_digitales_datasets` + `notas_digitales` (sin pruebas), tipos `aviso` y `reiteracion` | `notas_digitales.fecha` | Nota Digital N° n/aa a DGMIT | "Aviso de gestión externa, sección vencidos: vencía el dd/mm/aaaa.", "próximos a vencer: vence el …" o "Reiteración: …", y "Pide: …" si quedó guardado | "Envío automático" (sin `creado_por`) o "Generada por X", y "Firmó X" si hay `firmante_id` |
| Nota Digital de auditoría | `notas_digitales_cambios` → cambio → dataset | `notas_digitales.fecha` | Nota Digital N° n/aa de auditoría | "Pidió auditar el cambio #N." (nuevo o reiterado) | Como en la Nota Digital a DGMIT |
| Email a DGMIT | `notificaciones_log`, siete tipos retirados (`FIND_IN_SET` en `datasets_ids`) | `enviado_at`, en hora argentina | `Email a DGMIT: <qué pedía>` | "Faltaban N días. Junto con otros M datasets.", "Solo este dataset." o "No se pudo enviar." | Sistema |
| Email al área | `notificaciones_log`, `area-aviso-40` | `enviado_at`, en hora argentina | Email al área: anticipo de la nota formal | "A <área del log>." o "No se pudo enviar." | Sistema |

**Qué pedía cada email retirado**, según su asunto original:

| Tipo | Qué pedía |
|---|---|
| `externo-60` | redacción de notas |
| `externo-40` | distribución de notas |
| `externo-5` | vencimiento inminente |
| `externo-vencido` | resumen mensual de vencidos |
| `interno-60` | planificación (60 días) |
| `interno-30` | vence en 1 mes |
| `interno-vencido` | resumen mensual de vencidos |

"Faltaban N días" va solo en los tipos de 60, 40, 30 y 5 días. El asunto original completo se ve en el detalle de la fila. Los asuntos de los mensuales eran "Resumen Mensual: Sin Respuesta (Externos)" y "Resumen Mensual: Datasets Atrasados (Internos)": se citan tal cual, pero el título del Seguimiento dice "resumen mensual de vencidos".

**Reglas de los datos.** Salen del análisis del dump del 20/10.
- **Zonas horarias.** Los TIMESTAMP (`created_at`, `revisado_at`, `enviado_at`) están en UTC y se pasan a hora argentina. `notas_digitales.fecha` es DATE. `enviada_at` es DATETIME en hora argentina.
- **Fechas viejas en `datos_anteriores`.** Vienen como `2025-07-31T03:00:00.000Z` y se normalizan a `AAAA-MM-DD`.
- **Historial duplicado:**
  - Si una fila de `historial_actualizaciones` tiene `cambio_id`, no se muestra: la fuente es el cambio.
  - Las filas sin `cambio_id` repetidas (mismo dataset y misma `fecha_actualizacion`) se muestran una sola vez.
- **Altas sin dataset.** Los cambios `crear` quedan con `dataset_id` NULL después de aprobarse. La unión con su dataset se hace **al leer**, sin tocar `aprobarCambio`: el título de `datos_nuevos` igual al del dataset y `revisado_at` a menos de 5 segundos de `datasets.created_at`. Si el título cambió después, solo por la hora. El revisor comprobó que así se unen bien las 5 altas actuales (los cambios #1, #2, #22, #30 y #50 con los datasets 77 a 81).
- **Área del email al área.** Es la del momento del envío (`notificaciones_log.area_id`), no la actual. Hay un caso real: el dataset 66 cambió de área.
- **Quedan afuera:** las notas de prueba (`es_prueba = 1`) y la prueba del email al área, que no registra nada.
- **Notas pendientes o fallidas.** También tienen filas en `notas_digitales_datasets`. Se muestran con su estado ("pendiente de envío" o "no se pudo enviar") y no cuentan como aviso.
- **Emails duplicados por corridas manuales** (por ejemplo, el 06/12 y el 10/12/2025). Se muestran los dos, porque se enviaron de verdad.
- **Orden de la lista.** Del más nuevo al más viejo, por fecha. Dentro del mismo día, por el momento exacto (la hora del envío o de la aprobación).
- **Nombres.** Van en "nombre y apellido corto", armado con `usuarios.nombre_completo`: el primer nombre y el último apellido ("Elena Noelia Cuatro" → "Elena Cuatro"), tal como está cargado, sin agregar tildes. Con dos palabras o menos, va completo.
- **Desde cuándo hay registro.** El primer email registrado es del 06/12/2025 a las 14:21 (hora argentina) y el primer cambio, del 26/01/2026.

## Ciclos

Un **ciclo** es el tiempo en que rige un vencimiento (`proxima_actualizacion`). Se reconstruye con los cambios aprobados y las actualizaciones anteriores a la doble verificación, en el orden en que pasaron (`revisado_at` y `created_at`). Cada ciclo dice cómo empezó (`origen`: `alta`, `actualizacion` o `reprogramacion`).

**Reglas**
- **Vencimiento inicial.** Es la próxima anterior (`datos_anteriores.proxima_actualizacion`) del primer cambio aprobado que la trae. Si no hay cambios, es la próxima actual. Si antes de todo hubo una actualización anterior a la doble verificación, no se conoce (ver abajo). El primer ciclo empieza en el alta.
- **Un cambio que mueve la próxima y "Cargado en el portal"** es una actualización y **cierra el ciclo**.
  - Para el atraso, la fecha de cierre es la de la carga.
  - Para saber qué avisos le corresponden, el ciclo rige en el RPAD hasta el momento de la aprobación.
  - El ciclo nuevo empieza con la próxima nueva.
- **Un cambio que solo mueve la próxima** es una reprogramación:
  - **antes** del vencimiento, el vencimiento se reprograma dentro del mismo ciclo;
  - **después** del vencimiento (aprobada después de la fecha de vencimiento), **cierra el ciclo como reprogramado**, en el momento de la aprobación. Ese ciclo estuvo vencido desde el vencimiento hasta la aprobación, y el ciclo nuevo empieza ahí.
- **Un cambio que solo cambia "Cargado en el portal"** es una carga dentro del ciclo y no lo cierra.
- **Una actualización anterior a la doble verificación** (una fila de `historial_actualizaciones` sin `cambio_id`: en diciembre de 2025 el botón de actualizar movía la carga y la próxima en el momento) **también cierra el ciclo**, en su fecha y en el momento en que se registró; las varias del mismo día cuentan como una. Los avisos de antes quedan en el ciclo que cierra (corrección del 20/10/2026: antes estas filas eran solo movimientos y esos avisos se contaban en el ciclo abierto; pasaba con los datasets 25, 32, 56 y 58).
  - La próxima que esa actualización cumplía no quedó guardada. Si ningún cambio anterior la dice, el ciclo que cierra no tiene vencimiento conocido (`venc` null): no se le cuentan días de vencido, no lleva hito y la cinta lo dibuja como un tramo sin "vence" ni rayado. No se inventa una fecha.
  - El vencimiento del ciclo que abre lo da la próxima anterior del cambio siguiente o, si no hay, la próxima actual.
- **Cada cambio se mide contra su propia próxima anterior** (`datos_anteriores.proxima_actualizacion`, si la trae), no contra la que dejó el cambio de antes: si la próxima se corrigió por SQL entre dos cambios, el siguiente cierra o reprograma el ciclo con la fecha corregida.
- **El ciclo abierto vence siempre en la próxima actual del dataset.** Si una corrección por fuera del sistema (por SQL) la cambió sin dejar un cambio, manda la actual. Pasa con el dataset 9: su último cambio la dejó en el 31/12/2026 y hoy es el 31/01/2027.

**Cuánto estuvo vencido**
- Ciclo cerrado por una actualización: la carga menos el vencimiento, si es positivo.
- Ciclo cerrado por una reprogramación: la aprobación menos el vencimiento.
- Ciclo abierto: hoy menos el vencimiento.

**Datasets sin ciclos**
- **Eventual** (frecuencia sin meses): no tiene ciclos.
- **Sin fecha** (frecuencia con meses pero sin próxima): tampoco, y se dice "Sin fecha de próxima actualización".
- **Dado de baja:** sus ciclos terminan en la baja.

**A qué ciclo pertenece cada aviso**
- **Nota Digital:** pertenece al ciclo cuyo vencimiento es el `notas_digitales_datasets.vencimiento` de la nota.
  - Si ningún ciclo tiene ese vencimiento, va al ciclo que regía en el RPAD en el momento del envío. Pasa, por ejemplo, con los datasets 33 y 61, cuya próxima se corrigió por SQL.
- **Email** (a DGMIT o al área): pertenece al ciclo que regía en el RPAD en el momento del envío. Se compara `enviado_at` con los momentos de aprobación que abren y cierran cada ciclo.
- Las notas de auditoría no son avisos de ningún ciclo: tratan sobre un cambio, no sobre el pedido de datos.

**Avisos del ciclo abierto** (la sección del circuito)
- Son los emails a DGMIT enviados con éxito y las Notas Digitales enviadas (aviso y reiteración) que pertenecen al ciclo abierto.
- Los emails al área se cuentan aparte, con la misma regla.
- El encabezado de la sección dice desde cuándo se cuentan y el vencimiento (`circuito.desde` y `circuito.vencimiento`): "Desde la actualización del 16/12/2025 · Vencimiento del 30/11/2026" ("Desde la reprogramación del …" o "Desde el alta del …"; sin alta conocida, solo el vencimiento). Va igual en la pantalla, en el PDF y en las hojas del anexo de la reiteración.

## La pantalla

**Acceso**
- La página es `seguimiento.html` y lleva carcasa.
- En el menú lateral va en **Herramientas → Seguimiento**, debajo de Gestión, con el ícono `history` de Lucide.
- La ven todos los roles con sesión. Sin sesión, manda al login.
- También se llega desde **Gestión de Datasets**: cada fila suma un ícono "Ver seguimiento" que abre `seguimiento.html?id=N`.

**Vista "Sin elegir"** (sin `id` en la URL; la eligió el usuario)
- El buscador y una tabla de los datasets.
- Filtros por estado, como botones con su cantidad (`aria-pressed`):
  - **Vencidos** (atrasados y sin respuesta; es el filtro inicial);
  - Próximos a vencer;
  - **Actualizados** (los `actualizado`, como en administración, porque "Al día" en el RPAD incluye a los próximos);
  - Eventuales;
  - Sin fecha (solo si hay);
  - Dados de baja (solo si hay);
  - Todos (los activos).
- Columnas:
  - el dataset y el área, con una etiqueta "Gestión interna" o "Actualización pendiente de aprobación" cuando corresponde;
  - "Venció el" o "Vence el";
  - "Vencido hace" (los días);
  - **avisos a DGMIT en el ciclo**: el número y, debajo, el desglose (por ejemplo "11 emails y 1 nota");
  - el último aviso.
- Orden: los vencidos por días de vencido, el mayor arriba; el resto, por vencimiento.
- Cada fila abre `seguimiento.html?id=N`. El buscador filtra por título o por área, y elegir un resultado abre el dataset.

**Vista "Un dataset"** (`?id=N`, de arriba abajo)

1. **Buscador**, con el dataset elegido, y el link "Ver todos los datasets".
2. **Ficha:**
   - el título y la insignia;
   - la insignia de los dos estados vencidos dice **"Vencido"**, solo en Seguimiento; los demás estados, como siempre;
   - "Área responsable: X, gestión externa";
   - "Dado de baja el dd/mm/aaaa", si corresponde;
   - los botones **Descargar PDF** y **Ver en el portal** (este último, solo con URL http o https);
   - una fila de datos: Frecuencia, Datos al, Cargado en el portal, "Venció el" (en rojo, con "hace N días") o "Vence el", y Datos solicitados hoy (el `pedido` del servidor).
3. **Avisos del ciclo abierto**, con el circuito dibujado:
   - **gestión externa:**
     - RPAD;
     - "N avisos", con el detalle debajo ("5 emails y la Nota Digital N° 2/26");
     - "DGMIT y Dirección Administrativa" ("Mandan la nota formal al área");
     - una flecha punteada, "Nota formal" ("Por fuera del RPAD: no queda registrada");
     - el área, con "Vencido hace N días" (en rojo) o "Vence en N días";
     - debajo: "Además, el dd/mm/aaaa el RPAD le anticipó por email al área que iba a recibir una nota formal.";
   - **gestión interna:** el nodo del medio es "DGMIT y Dirección de Investigación Territorial" ("Hacen el relevamiento"), la flecha punteada dice "Relevamiento" y no hay línea del email al área;
   - **sin avisos en el ciclo:** "Sin avisos" ("Todavía no hizo falta"; si el ciclo ya venció, "Todavía no se envió ningún aviso");
   - **eventual, sin fecha o dado de baja:** "Sin vencimiento", o "Dado de baja".
4. **Los últimos 12 meses:** la cinta, con su leyenda (ver la sección siguiente).
5. **Movimientos:**
   - **Filtros por tipo**, como botones con la cantidad de cada uno: Todos, Avisos a DGMIT (emails y notas), Emails al área, Actualizaciones, Cambios en la ficha, Propuestas (rechazadas y pendientes), Notas de auditoría, y Alta y baja. Solo aparecen los que tienen algo.
   - **Cada fila** muestra la fecha, la marca, el título, el detalle y quién. Se despliega (`aria-expanded`) para ver más:
     - en una nota: el vencimiento informado; los datos solicitados ("No quedó guardado: las notas 1/26 y 2/26 son anteriores a ese dato"); Para y CC; la fecha y hora de envío; el estado; y "Descargar la nota y su anexo", que ve solo administración (usa los endpoints existentes, que son `adminOnly`);
     - en un email: el asunto original, los destinatarios del momento, la hora y el resultado (el texto técnico del error de un envío fallido lo recibe solo administración; el resto ve "No se pudo enviar.");
     - en un cambio: los campos que cambiaron, con el antes y el después, y cuándo se propuso y cuándo se aprobó.
   - **Hitos de vencimiento** entre las filas. No son movimientos ni se cuentan:
     - ciclo abierto y vencido: "dd/mm/aaaa: Venció", en amarillo;
     - ciclo cerrado después de vencer: "dd/mm/aaaa: Venció. Actualizado el dd/mm/aaaa, N días después del vencimiento", en verde;
     - ciclo cerrado por reprogramación: "dd/mm/aaaa: Venció. Reprogramado el dd/mm/aaaa al dd/mm/aaaa", en amarillo;
     - si el ciclo se cerró antes de vencer, no hay hito.
   - Se ven los primeros 10 y después "Ver los N anteriores", de a 20.
   - Al pie, una **aclaración fija**: "Los envíos quedan registrados desde el 06/12/2025 y los cambios desde el 26/01/2026: antes de esas fechas no hay registro."

**Estados de la página.** Siguen el patrón de `dataset-detail.js`, con `API.pedirJson`:
- cargando;
- no encontrado: no existe ningún dataset con ese id (los dados de baja sí existen), con `h2` (la página conserva su `h1` "Seguimiento de datasets");
- error: "No se pudo cargar el seguimiento. Probá de nuevo en unos minutos.".

## La cinta

Es la pieza más distintiva. Se dibuja igual en la pantalla (SVG) y en el PDF (PDFKit). El prototipo de referencia es `cinta.js` del mockup. Las coordenadas van en un espacio de 1000 de ancho, con la línea útil de x = 30 a x = 970.

- **Ventana:** los 12 meses que terminan en el mes de hoy (hoy = `hoyArgentina()`). Por ejemplo, del 01/11/2025 al 31/10/2026.
  - Una línea fina marca el comienzo de cada mes.
  - Debajo va el nombre del mes en minúscula ("nov", "dic"…), centrado en su tramo.
  - El año va debajo del primer mes y debajo de enero.
- **Posición de un día d:** x = 30 + (d + 0,5 − inicio) / días de la ventana × 940. Los días se cuentan como texto `AAAA-MM-DD`, sin `Date` local. Nada se corre a mano.
- **Banda** (en el medio):
  - antes del alta, una línea punteada y, si hay lugar, "Todavía no estaba en el RPAD";
  - cada ciclo, una banda celeste, separada del anterior por un hueco de 1,5;
  - lo que estuvo vencido, un rayado amarillo con su texto:
    - ciclo abierto: "Vencido hace N días";
    - ciclo cerrado: "Estuvo vencido N días";
    - vencimiento anterior a la ventana: "Vencido desde el dd/mm/aaaa (hace N días)";
    - el texto va en el hueco libre más grande entre las marcas de la banda; si no entra, no va;
  - en el ciclo abierto, de hoy al vencimiento, la banda más clara;
  - en un eventual, una banda gris con "Frecuencia eventual: sin vencimiento", ubicada con la misma regla del hueco;
  - en un dado de baja, la banda termina en la baja.
- **Vencimientos:** una línea punteada y "vence dd/mm" debajo, solo si el ciclo llegó a ese vencimiento y cae en la ventana.
- **Hoy:** una línea oscura y "hoy" debajo. Si choca con la etiqueta de un vencimiento (a menos de 62), baja un renglón.
- **Tres filas de marcas:**
  - **arriba:** las Notas Digitales (rombo lleno, con "Nota n/aa" encima) y los emails a DGMIT (rombo hueco);
  - **sobre la banda:** el alta (aro), las actualizaciones (círculo verde), la actualización pendiente (círculo verde punteado), los cambios en la ficha (cuadradito azul) y el cambio pendiente (cuadradito punteado);
  - **abajo:** los emails al área (círculo punteado) y las propuestas rechazadas (✕).
- **Agrupación:**
  - en una misma fila, las marcas a menos de 11 unidades (12 en el PDF) se dibujan como una sola, con un circulito y la cantidad;
  - se dibuja la de más prioridad, en este orden: nota, email, actualización, actualización pendiente, cambio, cambio pendiente, alta, rechazo, email al área;
  - en pantalla, cada marca tiene un `<title>` con las fechas y los textos de lo que agrupa.
- **Leyenda:** en pantalla van todos los tipos; en el PDF, solo los que aparecen. El rayado se llama "Vencido".
- **Teléfono:** la cinta mantiene un ancho mínimo (unos 640 px) dentro de un contenedor con desplazamiento horizontal. El resto de la página no se desplaza de costado.

## El PDF

Va en A4, en una sola hoja, con el lenguaje del ANEXO:
- la paleta `COLOR`;
- Helvetica y Helvetica-Bold;
- márgenes de 15 mm;
- el encabezado y el pie;
- `DocumentoNota` y `textoParaPdf`;
- el QR vectorial con `qrcode`.

Las secciones tienen lugar fijo y se completan solas. De arriba abajo:

1. **Encabezado.** A la izquierda, "DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN" y "Municipalidad de Comodoro Rivadavia". A la derecha, "Seguimiento del dataset" y la fecha larga de hoy. Debajo, el filete con su tramo de acento.
2. **Etiqueta y título.** La etiqueta es "CONJUNTO DE DATOS · GESTIÓN EXTERNA" (o INTERNA). El título va en 20 pt, con dos líneas reservadas, y se corta con "…" si no entra.
3. **Sin línea de estado.** El usuario pidió sacarla para ganar lugar.
4. **Ficha y QR.**
   - Una grilla de dos columnas con filetes: Área responsable, Depende de, Frecuencia, "Venció el" (en rojo, con "hace N días") o "Próximo vencimiento", Datos al y Cargado en el portal. Si fue dado de baja, "Dado de baja el …".
   - A todo el ancho: Datos que se piden (el `pedido` del servidor) y Link al portal.
   - A la derecha, la tarjeta del QR (30 mm, "Abrir en el portal"), hacia `url_dataset`, como en el ANEXO.
5. **Avisos del ciclo abierto.** El circuito, igual que en la pantalla. Debajo va la línea del email al área, solo en gestión externa.
6. **Los últimos 12 meses.** La cinta y la leyenda.
7. **Últimos movimientos.** Una tabla de 8 renglones: Fecha, marca, Movimiento (título y detalle) y Quién.
   - Si hay menos de 8, sigue "No hay movimientos anteriores: el dataset está en el RPAD desde el dd/mm/aaaa." y el resto queda en blanco.
   - Si hay más, debajo: "Hay N movimientos anteriores: el seguimiento completo está en el RPAD (Herramientas, Seguimiento)."
   - Los hitos de vencimiento no van en el PDF: los muestra la cinta.
8. **Aclaración.** "Los envíos quedan registrados desde el 06/12/2025 y los cambios desde el 26/01/2026."
9. **Pie.** A la izquierda, "Generado el dd/mm/aaaa a las hh:mm por <nombre corto>". A la derecha, "Seguimiento del dataset · Hoja 1 de 1".

El archivo se llama `Seguimiento - <título> - <AAAA-MM-DD>.pdf`. Se descarga con `API.pedirArchivo` + `descargarBlob`, con el JWT en el encabezado, nunca en la URL.

## API

Las reglas tienen una sola fuente: `services/seguimientoReglas.js`. Es puro, sin pool ni `Date` local, con las fechas como texto. Calcula:
- los movimientos;
- los ciclos y la asignación de avisos;
- los avisos del ciclo abierto;
- la cinta, como datos (meses, tramos, vencimientos, marcas agrupadas, etiquetas y hoy) en el espacio de 1000;
- los hitos;
- el nombre corto.

La pantalla y el PDF dibujan lo que calcula el servidor: el navegador no recalcula nada.

Los endpoints usan `authMiddleware` y **no** `adminOnly`, así que los puede usar el lector:
- `GET /api/seguimiento`: la lista de "Sin elegir", con los activos y los dados de baja. Trae estado, vencimiento, días de vencido, avisos del ciclo abierto, último aviso y si hay una actualización pendiente.
- `GET /api/seguimiento/:id`: la ficha, el pedido, el ciclo abierto con sus avisos, la cinta, los movimientos y los hitos. Incluye los dados de baja. Si no existe ningún dataset con ese id, 404.
- `GET /api/seguimiento/:id/pdf`: el PDF.

Las respuestas siguen `{ success, data }`.

## Carcasa, tests y documentación

- **La página nueva es la nº 14 con carcasa:**
  - el link va en `#sidebarTools` de las **14** páginas;
  - el conteo de `tests/paginas.test.js` pasa de 13 a 14 y la página se suma a la lista de `href`;
  - lleva su versión propia (`VERSION_SEGUIMIENTO`);
  - sin `aria-current` en el HTML estático y sin `publico.css`;
  - CLAUDE.md y el README dicen "13" en varios lugares.
- `public/js/seguimiento.js` sigue el patrón de "al cargarse solo declara": lo que arma HTML es puro y se prueba en un `vm`.
- **El link de Gestión de Datasets** va en `htmlDeFila` de `admin-fechas.js`, que es puro. Sube su versión.
- `tests/permisos.test.js` suma las rutas nuevas a la lista de lo que puede usar un lector y prueba que sin sesión respondan 401.
- **El PDF** se prueba con `tests/pdf-lector.js`:
  - una sola hoja;
  - los textos de cada sección;
  - 8 renglones como máximo;
  - el caso con menos movimientos;
  - el QR;
  - que nada se pise (con la técnica de diagramación de `notas-anexo.test.js`).
- **Las reglas** (ciclos, asignación de avisos, cinta y textos neutros) se prueban con casos armados sobre los datasets reales de la tabla siguiente, con los resultados esperados.
- El ANEXO, los reportes y el resto de la suite tienen que seguir pasando: `npm test` completo antes y después.

## Casos reales para las pruebas

Datos del 20/10/2026.

**52, Directores Generales de Planta Permanente**
- 16 movimientos.
- Ciclo del 31/01/2026: actualizado el 04/02, "Estuvo vencido 4 días".
- Ciclo abierto: vence el 31/07/2026, "Vencido hace 81 días". Tiene 6 avisos (5 emails y la Nota 2/26) y 1 email al área (21/06).
- Las 2 propuestas rechazadas y la actualización del 04/02 caen en la misma vertical: el ✕ lleva un 2.

**10, Pauta Publicitaria**
- 19 movimientos.
- Ciclos cerrados después de vencer: 31/01 ("Estuvo vencido 18 días") y 31/07 ("Estuvo vencido 56 días"). Los demás se cerraron antes de vencer.
- El 25/02 hubo un cambio de frecuencia y una carga: una marca con un 2.
- La Nota 2/26 del 13/10 informa el vencimiento del 31/10, que es el ciclo anterior.
- Ciclo abierto (vence el 31/01/2027): "Sin avisos".

**9, Pedidos de Acceso a la Información Pública**
- Vencido desde antes del alta (31/01/2025) hasta la carga del 13/03: "Estuvo vencido 406 días". Ese mismo día se reprogramó la próxima, antes de vencer.
- Volvió a vencer el 30/04. Se cargó el 09/10 ("Estuvo vencido 162 días") y se aprobó el 14/10.
- La Nota 2/26 del 13/10 informa el vencimiento del 30/04: pertenece a ese ciclo.
- Ciclo abierto: vence el 31/01/2027, la próxima actual, aunque el cambio #47 la dejó en el 31/12/2026. "Sin avisos".

**42, Establecimientos Educativos**
- Venció el 31/03/2026 con 3 emails a DGMIT enviados (30/01, 19/02 y 01/04; el del 26/03 falló y no cuenta como aviso) y 1 al área (19/02).
- El cambio #29, propuesto el 01/04 y aprobado el 06/04, pasó la próxima al 30/04/2027 sin carga. Es una reprogramación después de vencido: cierra el ciclo con "Estuvo vencido 6 días" y el hito "Venció. Reprogramado el 06/04/2026 al 30/04/2027".
- Ciclo abierto: "Sin avisos".

**1, Presupuesto Municipal**
- "Vencido hace 262 días" (desde el 31/01/2026).
- Tiene una actualización pendiente (cambio #51), con el círculo verde punteado.

**11, Parque Automotor**
- Vencido desde el 31/01/2024: desde el alta, todo rayado, con "Vencido desde el 31/01/2024 (hace 993 días)".
- Los emails del 06/12 y del 10/12 van agrupados con un 2.

**81, Cantidad de empleados municipales**
- Alta el 19/10/2026 (cambio #50).
- Nota 3/26 del 20/10, que pide "Vigente al 30/09/2026".
- Vence el 31/10.
- En el PDF: 2 movimientos, "No hay movimientos anteriores" y el resto en blanco.

**38, Escala salarial municipal**
- Gestión interna.
- Carga antes de tiempo en febrero.
- Ciclo del 30/09: actualizado el 02/10, "Estuvo vencido 2 días".
- Sin email al área.

**66, Barrios de Comodoro Rivadavia**
- Eventual: sin ciclos ni rayado. El texto de la banda no pisa ninguna marca.
- El 07/12/2025, dos emails a DGMIT y dos al área, agrupados.

**26, Infraestructura deportiva**
- Gestión interna, vencido desde el 31/03/2025.
- Tiene la Nota 1/26.

**33 y 61** (Listado de Proveedores y Comercios habilitados)
- La Nota 2/26 informa el vencimiento del 31/07/2026, pero la próxima actual es el 31/01/2026 (corregida por SQL).
- Ningún ciclo tiene el vencimiento del 31/07, así que la nota va al ciclo que regía el 13/10: el abierto.

## Despliegue

- **Base de datos:** sin SQL.
- **Archivos:** suben las páginas y los scripts de `public/` (las 14 con carcasa, porque cambia el menú) y los archivos nuevos o modificados de `services/`, `controllers/` y `routes/`.
- **Sin "Run NPM Install":** `qrcode` ya está.
- **Restart:** hace falta, porque hay rutas nuevas.
- Va en una rama aparte, con el kit de despliegue en el Escritorio, como los anteriores.

## Decisiones mías (para que las revises)

- **El nombre:** "Seguimiento" en el menú, "Seguimiento de datasets" como título de la página y "Seguimiento del dataset" en el PDF.
- **La ventana de 12 meses** termina en el mes actual y no se mueve. Lo anterior está en la lista.
- **Los hitos de vencimiento** van en la lista de la pantalla y no en el PDF.
- **La fecha de una actualización** es "Cargado en el portal" (para la lista y para cuánto estuvo vencido). La aprobación aparece en el detalle y decide hasta cuándo rige el ciclo en el RPAD, para asignar los avisos.
- **Reprogramar después de vencido** cierra el ciclo como reprogramado. Antes de vencer, lo reprograma sin cerrarlo.
- **Los avisos se asignan por el vencimiento que informan** (las notas) o por el ciclo que regía al enviarse (los emails), y no solo por fecha.
- **Los dados de baja** tienen Seguimiento, con su filtro en "Sin elegir" solo si hay alguno.
- **Las altas sin dataset** se unen al leer. No se toca `aprobarCambio`.
- **El filtro "Actualizados"** reemplaza a "Al día" en "Sin elegir".
- **La paginación de la lista:** 10 filas y después tandas de 20.
- **"Resumen mensual de vencidos"** es el título de los emails mensuales (sus asuntos originales nombraban "Sin Respuesta" y "Atrasados"). El asunto original queda en el detalle.

## Lo que queda para quien lo construye

- La forma exacta de las respuestas de la API y cómo se reparten las funciones entre el servicio puro y el controlador.
- Si el dibujo del PDF reutiliza ayudantes del ANEXO (exportándolos sin cambiar lo que dibujan) o los copia en un módulo propio.
- Los tamaños finos de letra y de espaciado del PDF, siempre que entre en una hoja con 8 renglones de dos líneas y un título de dos líneas.
- El estilo de las filas desplegables, siguiendo `perfil.js`.
- Las consultas SQL, mientras respeten las reglas de datos de arriba y sean parametrizadas.
