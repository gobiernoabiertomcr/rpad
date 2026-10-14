# Notas Digitales: reemplazo de los avisos de gestión interna y externa

**Fecha:** 2026-10-12
**Estado:** diseño aprobado, pendiente de revisión de esta especificación

## 1. Objetivo

Reemplazar los siete emails automáticos que hoy informan a la DGMIT sobre datasets próximos a vencer o vencidos por **Notas Digitales**: emails con forma y redacción de nota administrativa (Resolución N° 2820/2022, Anexo I "Nota interna"), numerados, con la nota en PDF firmada adjunta, y registrados en un libro consultable.

El objetivo es que cada pedido de actualización quede **formalmente documentado**: qué se pidió, a quién, cuándo, con qué texto exacto y con el comprobante del servidor de correo.

## 2. Alcance

**Se reemplazan** los avisos `interno-60`, `interno-30`, `interno-vencido`, `externo-60`, `externo-40`, `externo-5` y `externo-vencido`.

**No cambian:**
- el aviso directo a las áreas (`area-aviso-40`), salvo que su botón de prueba deja de escribir a las áreas reales (sección 10);
- el email de cambios pendientes a los administradores;
- el formulario de contacto.

## 3. Conceptos

| Término | Significado |
|---|---|
| **Nota Digital** | Email con formato de nota administrativa, numerado (`N° 12/26`), con la misma nota en PDF adjunta. |
| **Aviso** | Primera nota que menciona un dataset para un vencimiento dado. |
| **Reiteración** | Nota mensual que vuelve a informar los datasets ya avisados que siguen pendientes. |
| **Gestión** | `interna` (datasets producidos por áreas de la DGMIT) o `externa` (provistos por otras áreas u organismos). Es el campo `datasets.tipo_gestion`. |
| **Ciclo** | El par (dataset, vencimiento). El vencimiento es `datasets.proxima_actualizacion`. Cuando se aprueba una actualización, el vencimiento cambia y empieza un ciclo nuevo. |
| **Ventana** | Anticipación del aviso: **60 días** para gestión interna y **30 días** para externa. |

Hay **cuatro variantes** de nota: aviso interna, aviso externa, reiteración interna y reiteración externa.

## 4. Destinatarios

| | Gestión interna | Gestión externa |
|---|---|---|
| Para | `mit@comodoro.gov.ar` | `mit@comodoro.gov.ar` |
| CC | `geoestadisticas@comodoro.gov.ar` | `investigacionterritorial@comodoro.gov.ar` (corresponde a la Dirección Administrativa) |
| CCO (respaldo) | `datospublicos@comodoro.gov.ar` | `datospublicos@comodoro.gov.ar` |
| Línea al pie de la nota | `CC. Dir. de Investigación Territorial` | `CC. Dir. Administrativa` |

- Remitente: `"Dir. de Datos Públicos y Comunicación" <SMTP_USER>`. Se buscaba `datospublicos@comodoro.gov.ar`, pero desde el 13/10/2026 producción envía con `datospublicosmcr@gmail.com`: el servidor de correo oficial rechaza SMTP desde la IP del VPS. Cambiar de cuenta es solo cambiar `SMTP_*` y reiniciar.
- `Reply-To`: el mismo remitente.
- Todos los valores de esta tabla son **configurables desde la pantalla de Correos** (sección 10). Los de la tabla son los valores iniciales.

## 5. Calendario

### 5.1 Días hábiles

Las notas salen solo en días hábiles: de lunes a viernes, excepto los feriados nacionales de fecha fija (01/01, 24/03, 02/04, 01/05, 25/05, 20/06, 09/07, 08/12 y 25/12). Los feriados móviles no se consideran: si coinciden, la nota sale igual ese día.

La fecha de "hoy" se calcula siempre en la zona horaria `America/Argentina/Buenos_Aires`, independientemente de la zona del servidor. Todas las comparaciones de fechas usan esa fecha, no `CURDATE()`.

### 5.2 Avisos

En cada corrida de un día hábil, para cada gestión se arma **como máximo una nota de aviso** con los datasets que cumplen todo lo siguiente:
- `activo = TRUE`;
- su frecuencia tiene días definidos (los "Eventual" quedan afuera);
- `proxima_actualizacion` no es nula y **no está vencida** (es mayor o igual a hoy), y además:
  - es **menor o igual a hoy + ventana**; **o**
  - vence en el **mismo mes (año-mes)** que algún dataset de la misma gestión que ya entró en la ventana. Ese otro dataset se busca entre los que cumplen las dos condiciones anteriores (activo y con frecuencia con días) y tienen vencimiento, **tengan o no aviso**;
- **no tienen un aviso** (no prueba) para su vencimiento actual.

Desde el 14/10/2026 el aviso informa **solo datasets a vencer**. La primera corrida en producción (13/10/2026, N° 1/26 y N° 2/26) avisó también todos los vencidos de ese momento como antecedente formal; a partir de ahí, un vencido sin aviso es un caso raro (una fecha cargada en el pasado, un dataset reactivado) y va a la reiteración (5.3).

En otras palabras, un mes "se abre" para una gestión cuando el **primer** vencimiento de ese mes queda a la distancia de la ventana, y ese día se avisan juntos todos los datasets de la gestión que vencen ese mes. Así un mismo mes no se parte en dos notas casi seguidas cuando algunos datasets vencen el 29 o el 30 y la mayoría el último día. Por ejemplo, en la gestión externa, si unos vencen el 30/01 y otros el 31/01, salen todos en el aviso del 31/12; en la interna, si unos vencen el 29/03 y otros el 31/03, salen todos el 28/01. Si el primero del mes ya se avisó (por ejemplo, ayer) y aparece otro dataset sin aviso que vence ese mismo mes, entra en la corrida siguiente aunque todavía no esté en la ventana. No se mezclan meses distintos ni gestiones distintas.

Como solo entran datasets a vencer, el aviso tiene una sola sección: **próximos a vencer**. Cada aviso va acompañado de un **anexo** con una hoja por dataset (6.7).

Como el criterio es por rango y no por fecha exacta, si un día no hubo corrida o la fecha cae en un día no hábil, el dataset entra en el siguiente día hábil.

La pantalla de Estado (sección 10) muestra como fecha del próximo aviso de cada gestión el primer día hábil, desde hoy, en que esta selección devolvería algún dataset, y como cantidad los datasets que devolvería ese día.

### 5.3 Reiteraciones

Para cada gestión, la reiteración se **evalúa una sola vez por mes calendario**, en la primera corrida de un día hábil del mes:
- normalmente es el **primer día hábil del mes**;
- si ese día no hubo corrida (por ejemplo, porque falló el cron), se evalúa en la siguiente corrida de un día hábil;
- el mes evaluado se registra (sección 7.3) haya salido nota o no. Así, si ese día no había nada para reiterar, no se vuelve a evaluar a mitad de mes, y nunca se generan dos reiteraciones de la misma gestión en el mismo mes.

Incluye los datasets activos y con frecuencia con días que cumplen **una** de estas dos condiciones:
1. tienen un **aviso enviado** para su vencimiento actual (eso significa que no se actualizaron) y la fecha de ese aviso es **anterior o igual a hoy − 20 días**. Por ejemplo, los avisos del 13/10/2026 se reiteran el 02/11/2026 y los del 14/10/2026, recién en diciembre;
2. están **vencidos** (vencimiento < hoy) y **nunca tuvieron aviso** (no prueba) para su vencimiento actual. Entran sin esperar los 20 días, porque ya están atrasados. En la columna "Informado en" dicen **"Sin aviso previo"** y, si los avisaron los emails anteriores, llevan la línea de antecedente (6.4).

Se agrupan en dos secciones: **próximos a vencer** (vencimiento ≥ hoy) y **vencidos** (vencimiento < hoy). Un dataset vencido se reitera todos los meses hasta que se actualice.

La pantalla de Estado (sección 10) cuenta en la próxima reiteración los datasets de las dos condiciones.

### 5.4 Interruptor general

Mientras el envío automático está **desactivado**, el motor no genera ni envía notas. Arranca desactivado.

## 6. Contenido de las notas

### 6.1 Asunto

- Aviso: `Nota Digital N° {n}/{aa} – Ref.: Solicitud de gestión de datos para el Portal de Datos Abiertos Municipal (gestión {interna|externa} – {mes} {año})`
- Reiteración: `Nota Digital N° {n}/{aa} – Ref.: Reiteración – Solicitud de gestión de datos para el Portal de Datos Abiertos Municipal (gestión {interna|externa} – {mes} {año})`

El mes se escribe en minúsculas y en español (por ejemplo, "noviembre 2026").

### 6.2 Estructura

En este orden, siguiendo el Anexo I (sin saludo ni despedida):

1. `REF.: "Solicitud de gestión de datos para el Portal de Datos Abiertos Municipal"`. En la reiteración: `REF.: "Reiteración – Solicitud de gestión de datos para el Portal de Datos Abiertos Municipal"`.
2. `Nota Digital N° {n}/{aa}`, alineado a la derecha.
3. Destinatario en mayúsculas, negrita y subrayado: `DIRECCIÓN GENERAL DE MODERNIZACIÓN E INVESTIGACIÓN TERRITORIAL`.
4. Párrafo inicial (6.3).
5. Sección **Próximos a vencer**, solo si tiene datasets.
6. Sección **Plazo de actualización vencido**, solo si tiene datasets.
7. Solo en la gestión externa: **Datos de contacto de las áreas responsables**.
8. Solo en los avisos, una línea propia: `Anexo: reporte de los conjuntos de datos ({N} hoja/s).`, donde N es la cantidad de datasets (una hoja del anexo por dataset; "1 hoja", "4 hojas").
9. **Justificación** (6.5).
10. Remitente: `DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN` en negrita y subrayado, seguido de `, {fecha larga}.` (por ejemplo, "2 de noviembre de 2026").
11. Firma, a la derecha: imagen de la firma (solo en el PDF), nombre y cargo configurados.
12. Línea de CC según la gestión.

Si las secciones están vacías, la nota no se genera. El aviso solo tiene la sección de próximos a vencer (5.2).

### 6.3 Párrafo inicial

**Aviso, gestión interna:**
> Informo a Ud. que los conjuntos de datos de gestión interna detallados a continuación, publicados en el Portal de Datos Abiertos Municipal, requieren ser actualizados. En tal sentido, solicito tenga a bien gestionar su actualización ante las áreas de esta Dirección General responsables de su producción.

**Aviso, gestión externa:**
> Informo a Ud. que los conjuntos de datos detallados a continuación, publicados en el Portal de Datos Abiertos Municipal y provistos por otras áreas municipales y organismos, requieren ser actualizados. Solicito tenga a bien gestionar, por las vías administrativas correspondientes, ante las áreas responsables, la remisión de la información actualizada en formato digital editable (Excel, CSV, etc.).

**Reiteración, gestión interna:**
> Informo a Ud. el estado, al día de la fecha, de los conjuntos de datos de gestión interna informados oportunamente que continúan pendientes de actualización en el Portal de Datos Abiertos Municipal. Solicito tenga a bien gestionar su actualización ante las áreas de esta Dirección General responsables de su producción.

**Reiteración, gestión externa:**
> Informo a Ud. el estado, al día de la fecha, de los conjuntos de datos informados oportunamente que continúan pendientes de actualización en el Portal de Datos Abiertos Municipal. Solicito tenga a bien gestionar, por las vías administrativas correspondientes, ante las áreas responsables, la remisión de la información actualizada en formato digital editable (Excel, CSV, etc.).

Introducción de cada sección:
- Próximos a vencer: *"Los siguientes conjuntos de datos se encuentran próximos a cumplir su plazo de actualización:"*
- Vencidos: *"Los siguientes conjuntos de datos se encuentran con su plazo de actualización vencido:"*

### 6.4 Tablas de datasets

| Columna | Aviso | Reiteración | Contenido |
|---|---|---|---|
| Conjunto de datos | ✓ | ✓ | Título, con link a `url_dataset` si es http/https |
| Área (interna) / Área responsable (externa) | ✓ | ✓ | `areas.nombre` |
| Frecuencia | ✓ | ✓ | `frecuencias.nombre` |
| Última actualización | ✓ | ✓ | `dd/mm/aaaa`, o "—" |
| Vence / Venció | ✓ | ✓ | `dd/mm/aaaa` |
| Situación | ✓ | ✓ | "Faltan N días", "Vence hoy" o "Vencido hace N días", calculado a la fecha de la nota |
| Informado en | | ✓ | `Nota Digital N° 9/26 (02/11/2026)` y, si corresponde, `– reiterado N veces` (reiteraciones anteriores del mismo ciclo). Para un vencido que nunca tuvo aviso (5.3, condición 2): `Sin aviso previo` y, si corresponde, `– reiterado N veces` |

**Antecedente por emails anteriores (en avisos y en las filas "Sin aviso previo" de las reiteraciones).** Si el dataset aparece en `notificaciones_log` en alguno de los siete tipos reemplazados, con `success = 1` y `enviado_at` posterior a su `ultima_actualizacion` (o sin `ultima_actualizacion`), debajo de su fila va:
> *Antecedente: notificado a la DGMIT por correo electrónico en {N} oportunidades, entre el {primera} y el {última}.*

Si N = 1: *"Antecedente: notificado a la DGMIT por correo electrónico el {fecha}."*

Los siete emails reemplazados se enviaban a la casilla de la DGMIT, por eso la línea la nombra.

Esto cubre la transición. Como esos emails dejan de existir, la línea desaparece sola cuando cada dataset empieza un ciclo nuevo.

**Contactos (solo en la gestión externa).** Va una entrada por área, aunque el área tenga varios datasets. Incluye: nombre del área, área superior, `email_principal`, `email_secundario`, `telefono_area`, `celular_area`, `nombre_contacto`, `telefono_contacto` y `email_contacto`, omitiendo los vacíos. Si el área no tiene ningún dato, figura "Sin datos de contacto registrados".

### 6.5 Justificación

**Aviso (texto completo):**
> La presente se enmarca en la Ordenanza N° 17.662/23, que promueve mantener actualizados los datos, tanto de áreas municipales como de organismos externos, en el Portal de Datos Abiertos Municipal (datos.comodoro.gov.ar).
>
> Cabe destacar que Comodoro Rivadavia se encuentra entre los primeros puestos del Índice Nacional de Datos Abiertos. En este marco, mantener la información actualizada contribuye directamente a sostener y fortalecer este posicionamiento.
>
> La información actualizada puede ser remitida a los correos electrónicos datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar. Una vez recibida, será publicada en el Portal de Datos Abiertos Municipal en cumplimiento del Artículo 9° de la mencionada ordenanza.

**Reiteración (texto abreviado):**
> La presente se enmarca en la Ordenanza N° 17.662/23, que promueve mantener actualizados los datos en el Portal de Datos Abiertos Municipal (datos.comodoro.gov.ar). La información actualizada puede ser remitida a datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar, y será publicada en cumplimiento del Artículo 9° de la mencionada ordenanza.

(Desde el 14/10/2026 no se menciona el WhatsApp.)

Los textos de las secciones 6.1 a 6.5 son fijos en el código y están en un solo módulo.

### 6.6 Formatos de salida

La nota se construye una vez como estructura de datos (párrafos, secciones, tablas, firma) y se renderiza en tres formatos con el mismo contenido:

- **HTML** (cuerpo del email). Estilo de documento: fuente Arial, texto negro, sin gradientes, emojis ni imágenes. La única excepción de color es la primera línea, en negrita y bordó (`#800000`): **SE ADJUNTAN NOTA Y ANEXO EN PDF** en los avisos y **SE ADJUNTA NOTA EN PDF** en las reiteraciones. El texto plano también empieza con esa línea. REF. y destinatario en negrita y subrayado, párrafos justificados y tablas con borde. Todo dato proveniente de la base se escapa.
- **Texto plano** (parte alternativa del mismo email).
- **PDF** (adjunto `Nota-Digital-{n}-{aa}.pdf`) con PDFKit:
  - hoja oficio de 216 × 330 mm;
  - **membrete municipal en todas las hojas**, configurable desde la pantalla de Correos (7.3 y 10):
    - **banner** (la imagen cargada): arriba de la hoja, en x = 0, y = 0, con el ancho completo de la hoja y alto proporcional. Si el alto proporcional pasara de 45 mm, se achica para entrar en 45 mm, centrado. Se usa el tamaño a la vista: un JPEG guardado girado (orientación EXIF 5 a 8) se dibuja derecho, como lo muestra la pantalla. El archivo guarda la imagen una sola vez aunque se dibuje en todas las hojas;
    - **pie del membrete** (el texto cargado, por ejemplo `www.comodoroweb.gov.ar – Moreno 815, Comodoro Rivadavia, Chubut.`): Helvetica 10, centrado, con su línea de base a 12,5 mm del borde inferior. Un texto que no entra en una línea se escribe en una sola línea con la letra achicada lo justo, nunca por debajo de 7 puntos (la configuración no guarda un pie que no entre en una línea ni así);
  - márgenes:
    - superior de **todas** las hojas: el alto del banner más 9 mm, nunca menos de 2,5 cm (con el banner real, de 1241 × 178 píxeles, unos 31 mm + 9 mm = 40 mm, como el membrete en Word). Sin banner, 2,5 cm;
    - inferior de 2,5 cm para el contenido; izquierda y derecha de 3 cm;
    - las reglas de "mantener juntos" (título con su tabla, antecedente con su fila, "Justificación:", contactos, cierre con la firma) usan el margen de la hoja, no una medida fija;
  - Helvetica 12, interlineado simple, justificado;
  - firma escaneada sobre el nombre y el cargo;
  - si ocupa más de una hoja, pie `Nota Digital N° {n}/{aa} – Página {p} de {t}`, Helvetica 8 centrado:
    - sin pie del membrete, con el borde superior del texto a 12,5 mm del borde inferior de la hoja, como antes (su línea de base queda a unos 10,5 mm);
    - con pie del membrete, arriba de él, con la línea de base a 17,5 mm del borde inferior: sin superponerse con el pie y debajo del margen del contenido;
  - el banner y los pies se dibujan al final, hoja por hoja, sin agregar hojas;
  - sin banner ni pie del membrete el PDF queda sin encabezado, como antes; nunca lleva sello escalera;
  - **solo texto que Helvetica puede escribir.** Las fuentes estándar del PDF escriben un byte por carácter (WinAnsi, CP1252): otro carácter (☎, →, emojis, uso privado, el acento suelto de un texto NFD) saldría como basura y desordenaría el resto de la línea. Todo texto que se escribe o se mide en el PDF (títulos, áreas, contactos, firma, línea CC, pie) pasa por un único resguardo: se normaliza a NFC, el tabulador pasa a espacio y lo que no se puede escribir sale como `?`. Además, la configuración no guarda textos para el PDF con esos caracteres (sección 9).

El membrete va solo en el PDF: el cuerpo del email (HTML y texto) no cambia. El banner y el texto del pie se leen de la configuración al generar la nota y quedan congelados en su PDF: un reintento reenvía el PDF guardado aunque después cambie el membrete.

Las notas de prueba usan `N° PRUEBA` en lugar del número y anteponen `[PRUEBA] ` al asunto. La vista previa usa `N° XX`.

### 6.7 Anexo de los avisos

Cada **aviso** (no las reiteraciones) se envía con un segundo PDF adjunto, `Anexo-Nota-Digital-{n}-{aa}.pdf` (en pruebas `Anexo-Nota-Digital-PRUEBA-{id}.pdf`): un reporte con **una hoja por dataset**, en el mismo orden que la tabla de la nota.

**Formato:**
- hoja **A4 vertical** (210 × 297 mm), márgenes de 15 mm;
- **sin membrete**: diseño propio de ficha, **monocromático** (texto gris oscuro, grises claros para fondos y líneas y un único acento azul suave), legible impreso en blanco y negro;
- Helvetica (regular y negrita) con el mismo resguardo de texto que la nota (6.6): NFC y `?` para lo que no se puede escribir;
- **siempre una sola hoja por dataset**: la diagramación es fija y los textos largos (descripción, observaciones) achican la letra hasta un mínimo legible (8 puntos) y, si aun así no entran en su espacio, se cortan con `… (continúa en el portal)`.

**Contenido de cada hoja, de arriba abajo:**
1. **Encabezado:** "Dirección de Datos Públicos y Comunicación", "Anexo – Nota Digital N° {n}/{aa}" y la fecha de la nota.
2. **Título** del dataset, grande, y un **indicador de estado**: `Vence el {dd/mm/aaaa} · faltan N días` (`falta 1 día`; `Vence hoy`).
3. **Línea de tiempo:** una barra desde la última actualización hasta el vencimiento, con la marca de hoy y las fechas en los extremos. Sin última actualización, la barra arranca en "Sin registro".
4. **Qué se solicita:** recuadro destacado (el acento azul suave) con el texto `que_se_solicita` del dataset (7.6): qué información concreta tiene que remitir el área. Si el dataset no lo tiene cargado, dice: "La versión actualizada del conjunto de datos publicado, con la misma estructura y el mismo nivel de detalle que el archivo disponible en el portal."
5. **Ficha:** área responsable y de quién depende (`area_superior`), gestión (interna o externa), frecuencia, temas (principal y secundario), formatos y link al portal (`url_dataset`, si es http/https), con un **código QR** al lado que abre ese link. Sin link válido no hay QR. Las fechas no se repiten en la ficha: están en la línea de tiempo. Un valor que no entra en dos líneas de media columna ocupa la fila entera.
6. **Descripción** y **observaciones** (si las hay).
7. **Contacto del área responsable:** los mismos datos que los contactos de la nota (6.4), o "Sin datos de contacto registrados".
8. **Pie:** `Anexo – Nota Digital N° {n}/{aa} · Hoja {i} de {t}`.

La hoja **aprovecha la A4**: con los textos reales (descripciones de 300 a 510 caracteres, observaciones de hasta 90), la letra y los espacios son generosos y el contacto queda abajo, cerca del pie, sin dejar un cuarto de hoja en blanco. Las reglas de achicar y cortar siguen valiendo solo para textos fuera de lo común.

El QR se dibuja como vectores (cuadrados) a partir de la matriz que calcula la librería `qrcode`, sin imagen intermedia.

El anexo se genera junto con la nota, se guarda en el libro y queda **congelado** igual que la nota: un reintento reenvía los mismos dos PDF. La vista previa y las pruebas de un aviso también lo incluyen (en la vista previa, con `N° XX`); sin datasets reales, la vista previa usa los datos de ejemplo.

## 7. Datos

Tres tablas nuevas, mediante la migración `database/updates/migracion-notas-digitales.sql`. También se agregan a `database/schema.sql`; `tests/schema.test.js` exige que coincidan. El anexo de los avisos (6.7) agrega una columna, mediante `database/updates/migracion-notas-digitales-anexo.sql`.

### 7.1 `notas_digitales` (libro)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | INT PK AI | |
| `numero` | INT NULL | NULL en pruebas |
| `anio` | SMALLINT NULL | Año de la numeración; NULL en pruebas |
| `tipo` | ENUM('aviso','reiteracion') | |
| `gestion` | ENUM('interna','externa') | |
| `periodo` | CHAR(7) NULL | `AAAA-MM`, solo en reiteraciones |
| `fecha` | DATE | Fecha de la nota (fecha en que se generó) |
| `es_prueba` | TINYINT(1) DEFAULT 0 | |
| `asunto` | VARCHAR(300) | |
| `para`, `cc`, `cco` | VARCHAR(500) | Destinatarios efectivos, separados por coma |
| `html` | MEDIUMTEXT | Cuerpo exacto enviado |
| `texto` | MEDIUMTEXT | Parte de texto plano |
| `pdf` | MEDIUMBLOB | PDF exacto adjuntado |
| `anexo_pdf` | MEDIUMBLOB NULL | Anexo exacto adjuntado (6.7); solo en avisos |
| `estado` | ENUM('pendiente','enviada','fallida') DEFAULT 'pendiente' | |
| `intentos` | INT DEFAULT 0 | |
| `ultimo_error` | TEXT NULL | |
| `message_id` | VARCHAR(255) NULL | |
| `respuesta_smtp` | VARCHAR(500) NULL | Por ejemplo `250 OK id=…` |
| `enviada_at` | DATETIME NULL | |
| `creado_por` | INT NULL | Usuario que la generó, o NULL si la generó el cron |
| `created_at` | TIMESTAMP | |

Índices: `UNIQUE (anio, numero)` (los NULL de las pruebas no chocan) e `INDEX (tipo, gestion, periodo)`.

### 7.2 `notas_digitales_datasets`

| Columna | Tipo | Notas |
|---|---|---|
| `nota_id` | INT, FK → `notas_digitales` ON DELETE CASCADE | |
| `dataset_id` | INT, FK → `datasets` ON DELETE CASCADE | |
| `seccion` | ENUM('proximo','vencido') | |
| `vencimiento` | DATE | `proxima_actualizacion` al generar la nota; identifica el ciclo |

PK `(nota_id, dataset_id)` e `INDEX (dataset_id, vencimiento)`. Las notas de prueba no registran filas en esta tabla, así que nunca cuentan como aviso.

### 7.3 `notas_digitales_config` (una sola fila, `id = 1`)

Columnas:
- `envio_activo` (TINYINT, por defecto 0);
- `para_interna`, `cc_interna`, `para_externa`, `cc_externa`, `cco`;
- `linea_cc_interna`, `linea_cc_externa`;
- `firma_nombre`, `firma_cargo`, `firma_imagen` (MEDIUMBLOB), `firma_mime`;
- `membrete_imagen` (MEDIUMBLOB NULL), `membrete_mime` (VARCHAR(20) NULL): banner del membrete del PDF (6.6), PNG o JPEG;
- `membrete_pie` (VARCHAR(300) NULL): texto del pie del membrete del PDF; vacío = sin pie;
- `casillas_prueba`;
- `reiteracion_evaluada_interna`, `reiteracion_evaluada_externa` (CHAR(7) `AAAA-MM`, NULL): último mes en que se evaluó la reiteración de cada gestión (5.3);
- `updated_at`, `updated_by`.

La migración inserta los destinatarios y las líneas de CC de la sección 4 y el texto del pie del membrete, `www.comodoroweb.gov.ar – Moreno 815, Comodoro Rivadavia, Chubut.` (información pública). La firma (nombre, cargo e imagen), el banner del membrete y las casillas de prueba quedan vacíos y se cargan desde la pantalla de Correos; el texto del pie también se cambia ahí (el slogan cambia con cada gestión). **Ni la firma, ni el banner del membrete, ni las casillas personales se versionan en el repositorio** (el banner es público, pero es una imagen institucional que cambia con cada gestión).

### 7.4 Numeración y reintentos

- El número se asigna al **generar** la nota: `MAX(numero) + 1` del año de la fecha de la nota, dentro de una transacción y bajo el bloqueo del motor (8.1). La numeración vuelve a 1 cada año.
- Al generar la nota se renderizan y guardan el HTML, el texto, el PDF y, en los avisos, el anexo. **Un reintento reenvía exactamente el contenido guardado**, con el mismo número y la misma fecha.
- Si el envío falla: `estado = 'fallida'`, se incrementa `intentos` y se guarda `ultimo_error`. Cada corrida reintenta las notas fallidas con menos de 5 intentos. Después de 5 intentos, la nota queda fallida y visible en el libro, con un botón para reintentar manualmente.
- Un dataset cuyo aviso está fallido no se reitera, porque no tiene aviso **enviado**. Tampoco recibe un aviso nuevo, porque ya tiene un aviso registrado para ese vencimiento.

### 7.5 Datos existentes

- `notificaciones_log` se mantiene para `area-aviso-40`. Las filas de los siete tipos reemplazados se conservan como historial y se usan para el antecedente (6.4).
- El indicador mensual "Notificaciones enviadas" de Gestión suma las filas exitosas de `notificaciones_log` y las notas digitales enviadas que no son prueba.
- El PDF "Historial de notificaciones" de Reportes no cambia. El historial de notas es el libro de la pantalla de Correos.

### 7.6 `datasets.que_se_solicita`

Columna nueva `que_se_solicita` (TEXT NULL) en `datasets`, mediante `database/updates/migracion-que-se-solicita.sql` (más `schema.sql` y `tests/schema.test.js`): qué información concreta se le pide al área cuando hay que actualizar el dataset (registros, campos, cobertura y formato), en un texto que vale para cualquier ciclo (no menciona fechas puntuales).

- Es un dato del dataset como los demás: se edita en el formulario del dataset del panel de administración y **pasa por la doble verificación** (se propone, otro admin aprueba). Se muestra en la ficha pública del dataset y en el anexo de los avisos (6.7).
- **Carga inicial:** una migración de datos (`database/updates/migracion-que-se-solicita-datos.sql`) con un texto por dataset activo, redactado a partir de la descripción del dataset, los recursos del portal (API pública de datos.comodoro.gov.ar) y las columnas de sus archivos, y **revisado por el usuario** antes de correrla. Es la única carga que no pasa por la doble verificación, porque inicializa un campo nuevo.

## 8. Motor de envío

Un módulo nuevo, `services/notasDigitales.js`, expone `ejecutarNotasDigitales({ hoy, usuarioId })`. El parámetro `hoy` hace que el motor se pueda probar con cualquier fecha.

### 8.1 Una corrida

1. Intentar tomar el bloqueo `GET_LOCK('rpad_notas_digitales', 0)`. Si otra corrida lo tiene, terminar sin hacer nada.
2. Si `envio_activo = 0`: terminar.
3. Si `hoy` no es día hábil: terminar.
4. Reintentar las notas fallidas (7.4).
5. Para cada gestión, generar y enviar el aviso (5.2) si hay datasets.
6. Para cada gestión cuyo `reiteracion_evaluada_*` sea distinto del mes actual: generar y enviar la reiteración si hay datasets (5.3) y registrar el mes como evaluado. Los datasets incluidos en un aviso del mismo día no entran, porque la regla de 20 días ya los excluye.
7. Liberar el bloqueo y devolver un resumen: notas generadas, enviadas y fallidas.

Generar una nota significa: en una transacción, asignar el número, insertar la nota como `pendiente` con su contenido renderizado e insertar sus filas en `notas_digitales_datasets`; confirmar la transacción y recién entonces enviar.

### 8.2 Disparo

`ejecutarNotificacionesDiarias` (ruta `/api/cron/notificaciones`, con el mismo cron de cPanel) deja de enviar los siete tipos reemplazados, sigue enviando `area-aviso-40` y llama a `ejecutarNotasDigitales` con la fecha de Argentina. `/api/notificaciones/ejecutar` (solo admin) hace lo mismo.

### 8.3 Barrera de destinatarios para pruebas

Si la variable de entorno `EMAIL_SOLO_A` tiene una lista de direcciones separadas por coma, `services/emailService.js` filtra **todo** email del sistema (notas, aviso a áreas, cambios pendientes, contacto): de Para, CC y CCO se quitan las direcciones que no estén en la lista (sin distinguir mayúsculas). Si no queda ningún destinatario, el email no se envía y se devuelve un error `Bloqueado por EMAIL_SOLO_A`. En producción la variable no se define.

La batería de tests levanta el servidor sin `EMAIL_SOLO_A`, salvo el test específico de la barrera.

## 9. API

Todas bajo `/api/notificaciones/notas-digitales`, con `authMiddleware` y `adminOnly`:

| Método | Ruta | Uso |
|---|---|---|
| GET | `/` | Libro. Filtros: `anio`, `tipo`, `gestion`, `estado`, `dataset_id`, `incluir_pruebas` |
| GET | `/estado` | Interruptor, notas fallidas y qué saldrá en el próximo aviso y la próxima reiteración de cada gestión |
| GET | `/:id` | Detalle: datos, HTML enviado y datasets incluidos |
| GET | `/:id/pdf` | PDF guardado |
| GET | `/:id/anexo` | Anexo guardado (404 si la nota no tiene anexo) |
| POST | `/:id/reintentar` | Reintento manual de una nota fallida |
| GET | `/preview?tipo=&gestion=` | HTML con los datos de hoy y `N° XX`; no escribe nada |
| GET | `/preview/pdf?tipo=&gestion=` | PDF de la vista previa (`application/pdf`): el mismo contenido que la vista previa HTML, con `N° XX`, el membrete y la firma; no guarda ni envía nada. Misma validación de `tipo` y `gestion` |
| GET | `/preview/anexo?gestion=` | Anexo del aviso de la vista previa (`application/pdf`), con `N° XX`; no guarda ni envía nada |
| POST | `/prueba` | `{ tipo, gestion }`: envía la nota marcada como prueba a `casillas_prueba` (con su anexo si es un aviso) |
| GET | `/config` | Configuración sin las imágenes: indica si hay firma y banner cargados (`tiene_firma`, `tiene_membrete`) y devuelve `membrete_pie` |
| PUT | `/config` | Guarda destinatarios, líneas de CC, firma (nombre y cargo), texto del pie del membrete (`membrete_pie`: texto recortado de hasta 300 caracteres que entre en una línea del PDF con letra de 7 puntos; `''` o `null` = sin pie), casillas de prueba e interruptor. Los textos que van al PDF (`membrete_pie`, `firma_nombre`, `firma_cargo`, `linea_cc_interna`, `linea_cc_externa`) se guardan en NFC, y uno con caracteres que el PDF no puede escribir responde 400 listándolos (por ejemplo `membrete_pie: caracteres que el PDF no puede escribir: ☎ →`) |
| PUT | `/config/firma` | `{ imagen: base64, mime }`, PNG o JPEG de 500 KB como máximo |
| GET | `/config/firma` | Imagen de la firma, para la vista previa en la pantalla |
| PUT | `/config/membrete` | `{ imagen: base64, mime }`: banner del membrete, PNG o JPEG de 500 KB como máximo, con la misma validación que la firma |
| GET | `/config/membrete` | Banner del membrete, para la vista previa en la pantalla (404 si no hay) |

Las imágenes (firma y banner) se decodifican antes de guardarlas: una imagen dañada responde 400 con un mensaje que nombra la imagen ("La imagen de la firma no es válida: …", "La imagen del membrete no es válida: …"). Si una imagen guardada no se puede leer, la prueba y el PDF de la vista previa responden 400. Las rutas fijas (`/preview/pdf`, `/config/...`) van antes que las de `/:id`.

Para el aviso a las áreas: `POST /api/notificaciones/prueba-area` envía el aviso de 40 días a `casillas_prueba` en lugar de a las áreas. Se eliminan las rutas `GET /api/notificaciones/prueba/:tipo` y `GET /api/notificaciones/preview/:tipo` de los siete tipos reemplazados. La vista previa de `area-aviso-40` se mantiene.

## 10. Pantalla de Correos

1. **Estado.** Incluye:
   - verificación SMTP;
   - interruptor de envío automático;
   - qué saldrá en el próximo aviso y en la próxima reiteración de cada gestión, con fecha y cantidad de datasets;
   - alerta si hay notas fallidas;
   - advertencias que no bloquean el envío si falta una imagen: "No hay imagen de la firma: las notas saldrían sin la firma escaneada." y "No hay imagen del membrete: las notas saldrían sin el encabezado institucional."
2. **Libro de Notas Digitales.**
   - Tabla con número, fecha, tipo, gestión, cantidad de datasets, destinatarios y estado.
   - Filtros de la API, incluido un selector de dataset que funciona como historial por dataset.
   - Por nota: ver el email enviado y descargar el PDF y, si es un aviso, el anexo (botón "Anexo").
   - Las pruebas están ocultas salvo que se marque "incluir pruebas".
3. **Vista previa y prueba.**
   - Se elige aviso o reiteración e interna o externa.
   - "Vista previa" muestra la nota en un `iframe` con `sandbox`.
   - "Ver PDF" descarga el PDF de la vista previa para el tipo y la gestión elegidos, con el membrete y la firma (el botón queda bloqueado mientras se pide).
   - "Ver anexo" descarga el anexo del aviso de la vista previa; solo está habilitado cuando el tipo elegido es aviso.
   - "Enviarme una prueba" la envía a las casillas de prueba.
4. **Configuración.** Destinatarios, líneas de CC, firma (nombre, cargo e imagen con vista previa), membrete del PDF y casillas de prueba.
   - El grupo "Membrete del PDF" tiene el archivo del banner (PNG o JPEG, máximo 500 KB) con vista previa y el campo "Texto del pie", que se guarda con "Guardar configuración".
   - Las imágenes (firma y banner) se suben apenas se eligen, sin recargar el formulario: no pisan los campos que todavía no se guardaron. La vista previa se oculta (con `hidden`) cuando no hay imagen y se liberan las URLs de blob al reemplazarla.
5. **Aviso a las áreas.** Vista previa y prueba a las casillas de prueba.

Se eliminan el selector de los siete tipos reemplazados y las tarjetas que explicaban su calendario. En su lugar va una explicación breve del calendario de la sección 5.

## 11. Cambios en el código existente

- `controllers/notificacionesController.js`: se quitan los siete bloques reemplazados de `ejecutarNotificacionesDiarias`, `pruebaNotificacion` y la parte de `previewEmail` correspondiente; se agrega la llamada al motor.
- `services/emailTemplates.js`: se eliminan las plantillas de los siete tipos (`interno60dias`, `interno30dias`, `internoVencido`, `externo60dias`, `externo40dias`, `externo5dias`, `externoVencido`) y sus auxiliares sin uso.
- `services/emailService.js`: barrera `EMAIL_SOLO_A`; soporte de `cc`, `bcc`, `replyTo`, `text` y adjuntos; devuelve `messageId` y `response`.
- `controllers/gestionController.js`: el indicador de 7.5.
- `routes/index.js`: las rutas de la sección 9.
- `public/correos.html`, `public/js/correos.js` y `public/js/api.js`: la pantalla de la sección 10.

## 12. Pruebas

Se aplica TDD con la batería existente (`npm test`, contra Docker y Mailpit). Tests nuevos:

- **Calendario:**
  - aviso a los 60 días (interna) y a los 30 (externa);
  - el aviso agrupa los datasets de la gestión que vencen el mismo mes, sin mezclar meses ni gestiones;
  - un solo aviso por ciclo, y aviso nuevo cuando cambia el vencimiento;
  - reiteración el primer día hábil y regla de 20 días;
  - fines de semana y feriados fijos;
  - si falla el primer día hábil, sale al siguiente, pero nunca dos reiteraciones por mes y gestión;
  - el aviso lleva solo datasets a vencer; los vencidos sin aviso previo entran en la próxima reiteración, sin esperar 20 días, con "Sin aviso previo" y su antecedente;
  - los Eventual, los inactivos y los que no tienen fecha quedan afuera;
  - con el interruptor apagado no sale nada.
- **Robustez:**
  - numeración correlativa que vuelve a 1 cada año;
  - un reintento conserva el número y el contenido;
  - límite de 5 intentos y reintento manual;
  - dos corridas simultáneas no duplican notas.
- **Contenido, sobre los emails de Mailpit:**
  - Para, CC y CCO por gestión, y el asunto;
  - las secciones vacías se omiten;
  - "Informado en" y "reiterado N veces";
  - antecedente de emails anteriores;
  - contactos agrupados por área;
  - escape de títulos con HTML;
  - el PDF adjunto es válido, mide 216 × 330 mm y contiene el número;
  - el PDF lleva el banner y el pie del membrete en todas las hojas, y los barridos de diagramación corren con y sin membrete;
  - el aviso adjunta el anexo: A4, una hoja por dataset (también con descripciones y observaciones muy largas), con título, estado, QR solo si hay link válido y el pie "Hoja i de t"; la reiteración no lleva anexo;
  - un reintento reenvía los mismos dos PDF.
- **Barrera `EMAIL_SOLO_A`:** filtra Para, CC y CCO, y bloquea si no queda ningún destinatario.
- **Pruebas:** sin número oficial, sin filas en `notas_digitales_datasets` y solo a `casillas_prueba`.
- **Esquema:** `tests/schema.test.js` incluye las tres tablas nuevas.
- **Lo existente:** la batería actual sigue en verde; los tests de previews de los siete tipos se reemplazan.

Después se hace una verificación manual en el navegador de la pantalla de Correos y una prueba real con el SMTP oficial hacia las casillas de prueba: cómo se ve en Gmail y en Yahoo, el PDF, la firma y la bandeja de entrada.

## 13. Despliegue y transición

1. Ejecutar `migracion-notas-digitales.sql` en producción.
2. Subir el código. No hay dependencias nuevas.
3. En Correos, "Verificar SMTP" desde el VPS. Si la conexión a `mail.comodoro.gov.ar:465` es rechazada, habilitar la salida SMTP de la cuenta en WHM ("SMTP Restrictions").
4. Cargar la firma (nombre, cargo e imagen), el membrete del PDF (el banner y, si cambió, el texto del pie) y las casillas de prueba; revisar el PDF con "Ver PDF" y enviar una prueba de cada variante.
5. Activar el interruptor. En la siguiente corrida salen los primeros avisos, que incluyen los datasets vencidos con su antecedente de emails anteriores.
6. Los siete emails reemplazados dejan de salir apenas se despliega el código; las notas empiezan cuando se activa el interruptor.

**Segunda entrega (anexo, avisos solo a vencer y textos, desde el 14/10/2026):**
1. Ejecutar `migracion-notas-digitales-anexo.sql` y `migracion-que-se-solicita.sql` en producción, antes de subir el código; después, `migracion-que-se-solicita-datos.sql` (los textos revisados).
2. Subir el código y correr "Run NPM Install": hay una dependencia nueva, `qrcode`.
3. Restart y revisar con "Ver PDF" y "Ver anexo" en Correos; enviar una prueba de un aviso.

## 14. Fuera de alcance

- Feriados móviles y calendario de feriados editable.
- Textos de las notas editables desde la pantalla.
- Confirmación de lectura.
- Escalamiento a otras dependencias.
- Notas por área adjuntas.
- Cambios en `area-aviso-40` (salvo su botón de prueba), en el email de cambios pendientes y en el formulario de contacto.
- Incluir las notas digitales en el PDF de historial de Reportes.
