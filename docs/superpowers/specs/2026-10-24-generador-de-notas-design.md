# Generador de Notas (Herramientas → Notas)

Fecha: 24/10/2026. **Estado: aprobado por el usuario el 24/10/2026** (con el Anexo A y las decisiones de la sección 10). Se implementa después de que "Métricas y Reportes" esté en main (sección 8).

**Cambio del 24/10/2026, posterior a la aprobación (decisión del usuario):** el ámbito del Anexo A quedó confirmado tal cual, con 13 áreas fuera del municipio. Los nombres y las dependencias de las áreas **no se tocan**: quedan como están en la base de producción, y la migración solo agrega y carga el ámbito (secciones 2 y 8).

Maquetas: `2026-10-24-generador-de-notas-mockups/generador.html` (se abre en el navegador; los tres pasos se pueden recorrer y la vista previa cambia en el momento). Usa los datos reales de la base local al 24/10/2026, salvo las notas DGMIT (la tabla real está vacía) y el estado de tres datasets de la Cooperativa, inventados para mostrar una reiteración con dos notas. El recuadro oscuro de abajo a la derecha es de la maqueta, no de la página. Este documento manda sobre la maqueta.

## Por qué

El Generador de Notas se armó hace casi un año, cuando el RPAD sabía poco de cada dataset. Desde entonces el RPAD sumó "Datos al", el tipo de pedido, el "Qué se solicita", el «Requiere nota DGMIT», el estado y el Seguimiento, y el generador no usa nada de eso: el período de cada dataset se escribe a mano y el selector muestra todas las áreas de una.

Además cambió quién lo usa. Lo usaba la Dirección de Datos Públicos y Comunicación (DDPC) para pedirle los datos a la DGMIT, pero desde que existen las Notas Digitales automáticas ya no hace falta. Ahora el generador pasa a ser la herramienta con la que la **DGMIT** arma la nota formal que le pide los datos a un área: lo que hoy hace a mano, por fuera.

Lo que pidió el usuario, en sus palabras: "automatizar un poco más la generación de las notas", que el período "se pueda autocompletar" con lo que el RPAD ya guarda, que el selector proponga "las áreas que tienen datasets vencidos o próximos a vencerse", que las notas salgan "ya con el membrete", y poder bajar en Word la nota que hoy sale en digital, "sin firma, para firmar de puño y letra". Y una condición: "el número de nota no lo tenemos que registrar, es solo un generador".

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- La DGMIT arma su nota a un área en tres pasos (área → datasets y nota → revisar y descargar), con una vista previa de la nota tal como va a salir.
- Dos notas de la DGMIT: **interna** (a la Subsecretaría de Modernización y Transparencia, para que gestione ante un área del municipio) y **externa** (directo al organismo de fuera del municipio). Cuál corresponde lo dice un dato nuevo de cada área: municipal o fuera del municipio.
- Cada dataset sale con los "Datos solicitados" que calcula el RPAD (las mismas reglas que las Notas Digitales) y con su "Qué se solicita".
- La nota sale en Word, en la hoja membretada (oficio de 21,6 × 35,6 cm, con encabezado, marca de agua y pie), sin firma: se imprime y se firma a mano.
- En Correos → Libro de Notas Digitales, cada nota se puede bajar en Word, en la hoja membretada y sin firma, también las que ya salieron.
- Cada área sabe si es municipal o de fuera del municipio (Anexo A, confirmado por el usuario).

**No objetivos**
- El generador **no registra nada**: ni el número, ni la nota, ni quién la generó. La nota DGMIT se sigue cargando aparte, en el Seguimiento, cuando el área la recibe.
- No cambia ninguna Nota Digital automática: ni su texto, ni su PDF, ni cuándo sale. El Word de la DDPC es otra forma de bajar lo que ya está guardado.
- No cambia el circuito: el RPAD sigue avisando por Nota Digital; la nota formal la sigue mandando la DGMIT, por sus vías.
- La reiteración no se propone sola a partir de las notas DGMIT cargadas: la elige la persona (decisión del usuario).
- No se generan notas de varias áreas a la vez.

**Antiobjetivos**
- Que la nota diga algo distinto de lo que dice la Nota Digital sobre el mismo dataset (otro período, otra frecuencia): los "Datos solicitados" salen del mismo cálculo.
- Que la vista previa muestre una cosa y el Word otra.
- Que la nota se lea como un reproche al área: la reiteración dice que "no se ha recibido la información", en impersonal, nunca que el área no respondió.
- Que el generador vuelva a quedar con datos fijos en el código que cambian con las personas (iniciales, cantidad de fojas).

## 1. Quién lo usa

- Usan el generador los mismos que cargan notas DGMIT: el **colaborador** y administración (superadmin, admin y editor). Regla única: `puedeCargarNotasDgmit(rol)` y su copia `Auth.puedeCargarNotasDgmit()`. Todas las rutas nuevas y `POST /api/notas/generar` llevan `authMiddleware` + `cargaNotasDgmit` (sin sesión, 401; lector, 403 con "No tenés permiso para usar el generador de notas.").
- El **lector deja de verlo**: el enlace "Notas" del menú lateral (Herramientas) se muestra solo si `Auth.puedeCargarNotasDgmit()`. Si un lector entra a `notas.html` por la URL, la página no muestra el generador y dice "No tenés permiso para usar el generador de notas." Sin sesión, al login, como hoy.
- El Word de una Nota Digital (sección 6) está en Correos, que ya es solo de administración (`adminOnly`).
- Hoy el README dice que el lector puede "ver" las notas: se corrige (el lector deja de tener Notas).

## 2. Las áreas: municipal o fuera del municipio

**El dato.** Cada área suma un ámbito: **Municipal** o **Fuera del municipio**. Decide qué nota de la DGMIT le corresponde: municipal → interna (por la Subsecretaría); fuera del municipio → externa (directo al organismo).
- Columna nueva en `areas` (nombre sugerido `ambito`, `enum('municipal','externo') NOT NULL DEFAULT 'municipal'`).
- Se edita en Áreas: un selector "Ámbito" en el formulario (Municipal / Fuera del municipio), con la ayuda "Define si la nota de la DGMIT va por la Subsecretaría (municipal) o directo al organismo (fuera del municipio)." Lo valida el servidor (otro valor, 400). La lista de Áreas puede mostrarlo como una insignia junto al nombre.
- La clasificación inicial la carga la migración (Anexo A, confirmado por el usuario el 24/10/2026): 13 áreas fuera del municipio y 33 municipales.

**Los textos de las áreas no se tocan** (decisión del usuario, 24/10/2026). El nombre y el "dependiente de…" salen en la nota interna tal como están en la base, también con sus abreviaturas: "…gestionar ante la **Dirección General de Recursos Humanos**, dependiente de la Subsec. de Recursos Humanos. Sec. Gobierno, Modernización y Transparencia, …". Si alguno está mal, se corrige a mano en Áreas. Dos errores ya los corrigió el usuario en producción el 24/10/2026: la dependencia del área 6 pasó a "el Ministerio de Educación del Chubut" y el área 35 (Secretaría de Energía) quedó sin dependencia. El resto queda como está. La base local, con el dump de las 16:45, todavía tiene los dos valores viejos, pero eso no cambia nada: la migración busca las áreas por id y por nombre, y ninguno de los dos cambió.

## 3. La pantalla

Herramientas → Notas (`notas.html` + `js/notas.js`). Título de la página: "Generador de Notas". Una tarjeta con los tres pasos arriba (1. Área, 2. Datasets y nota, 3. Revisar y descargar), con el paso actual marcado (`aria-current="step"`) y los hechos con una tilde. Se puede volver a un paso anterior; no se puede saltar adelante sin completar el actual.

### 3.1 Paso 1: Área

- Texto de ayuda: "Tocá el área a la que se le piden los datos. Primero están las que tienen datasets vencidos o próximos a vencer (60 días); en "Todas", las N áreas con datasets que requieren nota DGMIT."
- Dos filtros como botones con su cantidad (`aria-pressed`): **Con vencidos o próximos a vencer** (el inicial) y **Todas**. Un buscador "Buscar por área o por dataset" (sin tildes ni mayúsculas) filtra lo que muestra el filtro elegido.
- Solo aparecen las áreas que tienen al menos un dataset que se puede pedir: **activo, de gestión externa y con «Requiere nota DGMIT» en Sí o sin dato** (la regla de `sePuedeElegir` de las notas DGMIT). Hoy son 24 áreas con 35 datasets.
- "Con vencidos o próximos a vencer": las áreas con algún dataset pedible vencido o próximo a vencer (60 días o menos, el estado `proximo` de siempre; `atrasado` y `sin-respuesta` cuentan como vencidos). Orden: primero la que tiene el dataset más vencido. "Todas": orden alfabético.
- Cada área es una fila compacta (un botón que ocupa todo el ancho): el nombre, la insignia del ámbito (Municipal / Fuera del municipio), en un renglón más chico los títulos de sus datasets vencidos o próximos (o de todos, si están al día) y, a la derecha, las insignias de estado.
- Insignias de estado, en lenguaje neutro (como el Seguimiento): "Vencido hace N días", "Vence en N días" ("Vence hoy" el día del vencimiento), "Al día" (o "Los N al día" en la fila de un área con todos al día).
- **Un toque en la fila pasa al paso 2** (no hay botón "Siguiente" en este paso). La lista no tiene barra de desplazamiento propia: se recorre con el desplazamiento de la página.
- Sin ninguna área en "Con vencidos o próximos a vencer": "Hoy ninguna área tiene datasets vencidos o próximos a vencer." y el filtro "Todas" a mano. Sin coincidencias en el buscador: "Ninguna área coincide con la búsqueda."

### 3.2 Paso 2: Datasets y nota

- Arriba, el área elegida: nombre, "dependiente de …" (o "sin dependencia cargada") y su ámbito, con el botón "Cambiar el área" (vuelve al paso 1 con el filtro y la búsqueda como estaban).
- Dos columnas: a la izquierda los campos, a la derecha la **vista previa** de la nota (la hoja achicada, fija mientras se desplaza la página) con "Ver en grande" (lleva al paso 3). En pantallas angostas la vista previa va debajo.
- **Tipo de nota** (`fieldset` con dos opciones):
  - "Interna": "A la Subsecretaría de Modernización y Transparencia, para que gestione ante el área."
  - "Externa": "Directo al área u organismo, con "Al/A la … PRESENTE"."
  - Viene elegida por el ámbito del área, con la línea "Viene elegida porque el área figura como municipal en Áreas." (o "fuera del municipio"). Si la persona la cambia: "Cambiada a mano: el área figura como municipal, que lleva nota interna."
- **Pedido** (`fieldset`): "Solicitud" ("La primera vez que se piden estos datos.") o "Reiteración" ("Ya se pidieron y siguen pendientes."). Solicitud es el inicial.
  - Con "Reiteración" aparece, dentro del mismo grupo y en un recuadro con borde violeta (el color de lo de la DGMIT en el Seguimiento), **Nota anterior (opcional)**: uno o más números de nota, como etiquetas con su "×" para quitarlas, y un campo chico con "Agregar" (también con Enter) para sumar otro (cada número, texto de hasta 40 caracteres, sin repetidos). **Solo números, sin fecha** (decisión del usuario). La nota los cita (sección 4.4).
  - **Viene completada con las notas DGMIT cargadas** (pedido del usuario): para cada dataset tildado, la nota DGMIT original de su ciclo abierto, es decir, la primera vigente (sin anular) del ciclo, por fecha de recepción, después por fecha de carga y después por id. Es la misma asignación de una nota a un ciclo que usa el Seguimiento (`cicloDelAviso` con la recepción a las 00:00, y la regla de `algunCicloRige`); hace falta una función hermana de `notaDgmitDelCiclo` que dé la primera en lugar de la más reciente. Se juntan los números distintos, ordenados por recepción (decisión del usuario: "Todas"). Debajo, "Traída de las notas DGMIT cargadas en el Seguimiento." (con el ícono del Seguimiento).
  - Si la persona quita o agrega un número, deja de completarse sola y la línea pasa a "Editada a mano." con el botón "Volver a traer las cargadas"; mientras no la toque, se vuelve a completar cuando cambian los datasets tildados. Sin notas DGMIT cargadas para los elegidos, la lista viene vacía y la línea dice "No hay notas DGMIT cargadas para estos datasets: escribila si la sabés." (hoy la tabla de notas DGMIT está vacía hasta que se importe el Excel).
- **Datos de la nota** (`fieldset`), los dos campos en una fila, del tamaño de lo que contienen (no a todo el ancho):
  - **Fecha**: por defecto hoy en Argentina (`Utils.hoyEnArgentina()`), editable. El estado de cada dataset y sus "Datos solicitados" se calculan con esta fecha.
  - **Número (opcional)**: texto de hasta 40 caracteres (sin los espacios de los extremos), con el ejemplo "Ej.: 156/26".
  - Debajo: "Sin número, la nota sale con "Nota N° ____/26" para completarlo después. No se guarda en ningún lado." (el año, de la fecha de la nota).
- **Datasets del área que requieren nota DGMIT** (`fieldset`): una fila por cada dataset del área que requiere nota (activo, externo, con «Requiere nota» en Sí o sin dato), con casilla, título, insignia de estado y, debajo, "Frecuencia · Datos solicitados: …". Ayuda: "Vienen elegidos los vencidos y los próximos a vencer. Los "Datos solicitados" los calcula el RPAD, igual que en las Notas Digitales."
  - Se pueden elegir los **vencidos, los próximos a vencer, los eventuales y los sin fecha**. Vienen tildados los vencidos y los próximos.
  - **Los que están al día se ven pero no se eligen** (decisión del usuario): la fila en gris, la casilla deshabilitada y "Frecuencia · Vence el dd/mm/aaaa. Al día: todavía no hay datos para pedir." Para un dataset al día, el cálculo del pedido daría el período de un vencimiento futuro ("Vigente al 31/03/2027" en octubre de 2026), y las Notas Digitales nunca piden uno al día.
  - Un área con todos sus datasets al día (se llega desde "Todas") muestra la lista en gris y el aviso "Hoy no hay datos para pedirle a esta área: sus datasets están al día."
  - **Las notas DGMIT del ciclo**, en violeta, debajo de los datos de cada dataset que las tenga: "Notas DGMIT del ciclo: N° 97/26 (solicitud, recibida el 02/07/2026) · N° 131/26 (reiteración, recibida el 10/09/2026)". Las vigentes del ciclo abierto, por fecha de recepción. Ayudan a elegir entre solicitud y reiteración (la propuse yo; el usuario la dejó).
- Botones: "Volver" y "Siguiente: revisar la nota". Sin ningún dataset tildado, "Siguiente" muestra el error "Elegí al menos un dataset." junto a la lista (y lleva el foco ahí), en lugar de quedar deshabilitado.
- La vista previa se actualiza con cada cambio (tipo, pedido, nota anterior, fecha, número, datasets).

### 3.3 Paso 3: Revisar y descargar

- La nota en grande (todas sus hojas), sobre un fondo gris, y al lado un resumen: Área, Nota ("Interna, a la Subsecretaría · Solicitud"), Fecha y número ("24/10/2026 · sin número (queda el espacio)") y Datasets.
- Botón **"Descargar Word"**, con el nombre del archivo debajo y la aclaración "Sale en la hoja membretada, sin firma: se imprime y se firma a mano. El Word se puede retocar antes de imprimir."
- Abajo: "Volver a los datasets" y "Armar otra nota" (vuelve al paso 1 sin área, número ni nota anterior).
- La vista previa muestra el texto, la tabla y el orden exactos del Word; los saltos de página los decide Word al abrirlo (puede cortar distinto).

### 3.4 Estados de la página

- Cargando: el indicador de siempre. Si falla la carga de las áreas: "No se pudieron cargar las áreas. Probá de nuevo en unos minutos." (no una lista vacía).
- Si falla la vista previa o la descarga, un aviso con el mensaje del servidor; con 401, al login.
- Mensajes con estilo: hoy la página usa `.alert-*`, que no existen en `main.css` (salen como texto plano desde febrero); se resuelve en la página.

## 4. La nota de la DGMIT

### 4.1 La hoja

- **Tamaño oficio 21,6 × 35,6 cm** (216 × 356 mm, "Legal" 8½ × 14″ en Word): el de la hoja membretada que usa la Municipalidad y el del papel en el que se imprime (resma "Oficio 216 × 356 mm / Legal 8 1/2" × 14"", confirmado por el usuario). En la hoja membretada el encabezado es una imagen de 1241 px de ancho estirada a todo el ancho de la hoja: el tamaño de la hoja lo fija la sección, no la imagen.
- Márgenes como la hoja membretada: 3 cm a los costados, 3,5 cm arriba, 2,5 cm abajo; encabezado pegado al borde superior.
- **Encabezado**: la imagen del membrete a todo el ancho (la misma de la hoja membretada y de las Notas Digitales: la de `notas_digitales_config.membrete_imagen`). **Marca de agua**: el isotipo de Comodoro Rivadavia, grande, centrado y muy aclarado, en todas las hojas. **Pie**: el texto de `notas_digitales_config.membrete_pie` ("www.comodoroweb.gov.ar – Moreno 815, Comodoro Rivadavia, Chubut.") centrado, en letra chica, y debajo "Página X de Y".
- Arial 12 en el cuerpo; la tabla en 10; el "Qué se solicita" en 9.
- Sin firma: queda el espacio en blanco para firmar a mano.

### 4.2 Interna (a la Subsecretaría)

En orden (der. = a la derecha; just. = justificado):
1. der. — **REF.:** "Solicitud de datos para el Portal de Datos Abiertos Municipal"
2. der. — **Nota N°** {número} (o "____/AA", con AA el año de la fecha de la nota)
3. **<u>SUBSECRETARÍA DE MODERNIZACIÓN Y TRANSPARENCIA</u>** (negrita y subrayado)
4. just. — "Solicito a Ud. tenga a bien gestionar ante {artículo} **{área}**, dependiente de {artículo superior} {dependencia}, la remisión de la siguiente información, preferiblemente en formato digital editable (Excel, CSV, etc.), con los datos del período que se indica en cada caso:" (sin dependencia: "…ante la **{área}**, la remisión…").
5. La tabla (4.5).
6. **Justificación:**
7. just. — "Dicha solicitud se enmarca en el cumplimiento de la Ordenanza N° 17.662/23, que establece la necesidad de garantizar que los datos publicados en el portal de datos abiertos, datos.comodoro.gov.ar, mantengan su valor. Motivo por el cual resulta fundamental mantener actualizada la información disponible en el mencionado sitio."
8. just. — "Los datos solicitados pueden ser remitidos a los correos electrónicos <u>datospublicos@comodoro.gov.ar</u> o <u>mit@comodoro.gov.ar</u>. Los mismos, una vez recibidos, serán publicados en el Portal de Datos Abiertos Municipal en cumplimiento del Artículo 9° de la mencionada ordenanza, garantizando su disponibilidad en formatos abiertos y reutilizables para generar valor económico y social."
9. **<u>DIRECCIÓN GENERAL DE MODERNIZACIÓN E INVESTIGACIÓN TERRITORIAL</u>**, {fecha larga}. ("24 de octubre de 2026")
10. El espacio en blanco para la firma.

### 4.3 Externa (al organismo)

1. der. — "Comodoro Rivadavia, {fecha larga}"
2. "Al" o "A la", según el artículo del área (hoy dice siempre "A la": con INDEC salía "A la Instituto Nacional…").
3. **<u>{área}</u>**
4. **<u>PRESENTE</u>**
5. der. — **REF.:** "Solicitud de datos para el Portal de Datos Abiertos Municipal"
6. der. — **Nota N°** {número o "____/AA"}
7. "De nuestra consideración:"
8. just. — "Nos dirigimos a Uds. a fin de solicitarles tengan a bien brindar la siguiente información, preferiblemente en formato digital editable (Excel, CSV, etc.), con los datos del período que se indica en cada caso:"
9. La tabla (4.5).
10. just. — "Motiva dicha solicitud la necesidad de actualizar y publicar los datasets disponibles en la página oficial de Datos Abiertos de la Municipalidad de Comodoro Rivadavia (<u>datos.comodoro.gov.ar</u>), en cumplimiento de la Ordenanza N° 17.662/23 y los principios de transparencia y acceso a la información pública que sustentan nuestras políticas de gobierno abierto."
11. just. — "Los datos pueden ser remitidos a los correos electrónicos <u>datospublicos@comodoro.gov.ar</u> o <u>mit@comodoro.gov.ar</u>."
12. "Quedamos a disposición para coordinar los detalles técnicos o administrativos necesarios."
13. "Sin más, saludamos a Uds. atentamente."
14. **<u>DIRECCIÓN GENERAL DE MODERNIZACIÓN E INVESTIGACIÓN TERRITORIAL</u>**
15. El espacio en blanco para la firma.

### 4.4 Reiteración (interna y externa)

Cambian tres cosas; el resto de la nota no cambia.
- **REF**: "Reiteración – Solicitud de datos para el Portal de Datos Abiertos Municipal".
- **Primer párrafo.** En la interna, la Subsecretaría no reitera nada: se le pide que reitere ante el área (pedido del usuario).
  - Interna: "Solicito a Ud. tenga a bien reiterar ante {artículo} **{área}**, dependiente de {artículo superior} {dependencia}, el pedido de la siguiente información, preferiblemente en formato digital editable (Excel, CSV, etc.), con los datos del período que se indica en cada caso:" (sin dependencia: "…ante la **{área}**, el pedido…").
  - Externa: "Nos dirigimos nuevamente a Uds. a fin de reiterar la solicitud de la siguiente información, preferiblemente en formato digital editable (Excel, CSV, etc.), con los datos del período que se indica en cada caso:"
- **Un párrafo nuevo, después de la tabla** (antes de "Justificación:" en la interna; antes de "Motiva dicha solicitud…" en la externa), igual en las dos:
  - con una nota anterior: "La presente reiteración se debe a que, al día de la fecha, no se ha recibido la información solicitada mediante Nota N° {n}, conforme a lo establecido en la Ordenanza N° 17.662/23."
  - con varias: "…solicitada mediante Notas N° {n1}, N° {n2} y N° {n3}, conforme a…".
  - sin nota anterior: "La presente reiteración se debe a que, al día de la fecha, no se ha recibido la información correspondiente, conforme a lo establecido en la Ordenanza N° 17.662/23."

### 4.5 La tabla de datasets

- Tres columnas: **Conjunto de datos**, **Frecuencia** y **Datos solicitados** (encabezado en negrita sobre gris claro, bordes finos negros), y debajo de cada dataset una fila a todo el ancho: "*Qué se solicita:* {texto}" (decisión del usuario: "Tabla + Qué se solicita").
- Frecuencia: `frecuenciaEnNota` ("Trimestralmente (Acumulado)" en un acumulado de 1 a 11 meses), como en las Notas Digitales.
- Datos solicitados: `pedido(...).texto`, calculado con la fecha de la nota ("Del 01/01/2026 al 30/06/2026", "Vigente al 31/10/2026", "Presupuestos de los ejercicios 2026 y 2027", "Próxima edición disponible"…). Un dataset eventual o sin fecha (sin pedido) dice "Información actualizada disponible".
- Qué se solicita: `datasets.que_se_solicita`; vacío, el texto por defecto de las Notas Digitales (`QUE_SE_SOLICITA_POR_DEFECTO`, que hoy es privado y habría que exportar).
- Orden: los vencidos primero (el más vencido arriba), después los próximos a vencer, después el resto por vencimiento; empates, por título. Es el mismo orden de la lista del paso 2.

### 4.6 El archivo

- Word (`.docx`), editable.
- Nombre: "Nota {interna|externa} - {área} - {AAAA-MM-DD}.docx" (con "reiteracion" si lo es), enviado con `disposicionDeAdjunto` (ASCII en `filename` y UTF-8 en `filename*`).
- Se descarga con `API.pedirArchivo` (el token en el encabezado, nunca en la URL) y `descargarBlob`.

## 5. Lo que se va

- **La nota escalonada** (DDPC → DGMIT y DGMIT → Subsecretaría): la primera hoja ya la cubre la Nota Digital automática; la reemplaza el Word del Libro (sección 6).
- **El sello escalera** con iniciales de personas fijas en el código ("ANB", "GAL") y las fojas fijas ("Consta de 2 (dos) fojas.", "3 (tres)").
- **El período escrito a mano** (las dos fechas "Período desde/hasta" de cada dataset).
- **El modal "Buscar Área por Dataset"**: lo reemplaza el buscador del paso 1, que busca por área o por dataset.
- La aclaración de la página que citaba la Resolución 2820/22: se puede conservar como ayuda si el constructor lo ve útil; no aparece en el documento.

## 6. Nota Digital en Word (Correos → Libro)

- En el Libro de Notas Digitales, cada nota suma el botón **"Word"**, junto a "PDF" y "Anexo". Para todas las notas del libro, de cualquier tipo (aviso, reiteración, autorización, auditoría) y estado, también las anteriores a esta entrega y las de prueba.
- Endpoint nuevo, `adminOnly`, al lado de los del libro (sugerido: `GET /api/notificaciones/notas-digitales/:id/word`).
- **Contenido**: el de la nota tal como se envió. Se arma desde `notas_digitales.html`, que tienen todas las notas (la base local lo confirma para las 8 del libro, de la 1/26 en adelante). No se recalcula nada.
- **Sin firma**: se quitan las firmas (imagen, nombre, cargo y el renglón del personal contratado) y queda solo el espacio en blanco debajo de "DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN, {fecha}." (decisión del usuario: "Solo el espacio en blanco"). Con dos firmas (licencia con persona autorizada), quedan los dos espacios y la leyenda que cita la autorización.
- Se quita la primera línea del email ("SE ADJUNTAN NOTA Y ANEXO EN PDF" / "SE ADJUNTA NOTA EN PDF"): es del email, no de la nota.
- Todo lo demás queda: REF, número ("Nota Digital N° 9/26"; "PRUEBA" en una prueba), destinatario, párrafos, tablas, datos de contacto, la línea "Anexo: …", la justificación y la línea CC.
- **Hoja**: la misma de la nota de la DGMIT (4.1): oficio de 21,6 × 35,6 cm, encabezado, marca de agua, pie y "Página X de Y". Es el papel en el que se imprime para firmar (lo confirmó el usuario); el PDF de las Notas Digitales sigue en 21,6 × 33 cm, así que el Word puede cortar las hojas en otros lugares que el PDF. No importa: el contenido es el mismo.
- El anexo sigue en PDF (botón "Anexo"): no hay Word del anexo.
- Nombre del archivo: "Nota-Digital-{N}-{AA}.docx" (como "Anexo-Nota-Digital-N-AA.pdf"); una prueba, "Nota-Digital-prueba-{id}.docx".

## 7. El servidor

- **Una sola fuente**: un módulo puro arma el contenido de la nota de la DGMIT (un objeto con los párrafos, la tabla y el cierre, como `construirNota` de las Notas Digitales) y de ese mismo objeto salen la vista previa (HTML) y el Word. Así la vista previa y el Word no pueden decir cosas distintas. El navegador no arma el texto de la nota: lo pide.
- Las reglas de fechas, de estado y de "pedible" son las de siempre (`pedido`, `tipoEfectivo`, `frecuenciaEnNota`, `estadoDelDataset`, `sePuedeElegir`); no se copian.
- **Validación** de `POST /api/notas/generar` (y de la vista previa), con 400 `{ success: false, error, campo }`:
  - fecha `AAAA-MM-DD` válida, desde el 01/01/2025 y hasta 30 días después de hoy;
  - número opcional, hasta 40 caracteres sin los espacios de los extremos (contados con `Array.from`, como las notas DGMIT); un número que no es texto, 400 (hoy da 500);
  - tipo `interna` o `externa` (hoy cualquier otro valor sale como externa);
  - pedido `solicitud` o `reiteracion`; nota anterior (lista de números, cada uno hasta 40, sin repetidos) solo con reiteración;
  - área existente;
  - datasets: lista no vacía de ids enteros positivos, sin repetidos; cada uno existente, activo, **del área elegida** (hoy acepta de otra área), pedible (externo con «Requiere nota» en Sí o sin dato) y **no al día** a la fecha de la nota (400: "«título» está al día: todavía no hay datos para pedir.").
- Ninguna fecha se arma con `new Date` local ni `toISOString`: texto `AAAA-MM-DD` y `hoyArgentina()`, como el resto del sistema.
- Los datos de la pantalla (áreas pedibles con su ámbito, artículos, dependencia y datasets con estado, frecuencia en nota, pedido, "Qué se solicita" y el número de su nota DGMIT original del ciclo abierto) los da un endpoint nuevo detrás de `cargaNotasDgmit`; no se usan `GET /api/datasets` ni `GET /api/areas` (públicos, sin el ámbito ni el pedido para otra fecha).

## 8. Base de datos y despliegue

- **Migración** `database/updates/migracion-generador-notas.sql`, aditiva y repetible, **antes del código**:
  - la columna del ámbito (si no existe);
  - la clasificación inicial (Anexo A, columna Ámbito). Los nombres y las dependencias no se tocan.
  - Sin `CHECK` en la base: valida la API.
- **Vuelta atrás** `rollback-generador-notas.sql`, después de volver a los archivos anteriores: borra la columna.
- `database/schema.sql` suma la columna; `tests/schema.test.js` controla la migración y la vuelta atrás, como en las entregas anteriores.
- No hay datos de personas: las áreas son organismos. Todo va versionado.
- **Coordinación con "Métricas y Reportes"** (rama `feat/metricas-y-reportes`, aprobada y en plan): las dos entregas tocan `routes/index.js`, `database/schema.sql`, `CLAUDE.md`, `README.md` y probablemente `public/js/main.js` (el menú lateral) y los tests de páginas. Esta entrega se implementa y se mergea **después** de Métricas, partiendo de main con Métricas adentro, para no pisarse.

## 9. Convenciones, accesibilidad y pruebas

**Frontend**
- `notas.js` como `seguimiento.js`: al cargarse solo declara; lo que arma HTML (filas de áreas, insignias, lista de datasets, resumen) es puro y lo que toca el DOM o la API va aparte. Pide los datos con `API.pedirJson` y el archivo con `API.pedirArchivo`.
- Copias mínimas en el navegador, si hacen falta para avisar en el momento (el largo del número, el mensaje de "Elegí al menos un dataset."), atadas por un test de paridad con el servidor.
- `notas.js` pasa a llevar `?v=` (hoy va sin versión): cambia por completo y un JS viejo en la caché con el HTML nuevo rompería la página. Se actualizan CLAUDE.md y, si corresponde, `tests/paginas.test.js`.
- La carcasa no cambia (sigue igual a la de `index.html`); el `<style>` de la página se rehace.

**Accesibilidad**
- Cada campo con su `label for`; los grupos de opciones en `fieldset` con `legend`; los errores con `aria-describedby`/`aria-invalid` y foco al primer error; un `aria-live` para los avisos.
- Las filas de áreas son botones (se eligen con el teclado); al cambiar de paso, el foco va al título del paso.
- Íconos decorativos con `aria-hidden="true"`; jerarquía de títulos sin saltos.

**Pruebas** (`npm test` completo antes y después de cada cambio)
- Puras: la nota DGMIT original del ciclo de cada dataset (la primera vigente, sin las anuladas, con la regla de ciclos del Seguimiento); qué datasets se pueden elegir (los al día no); el contenido de la nota (interna y externa; solicitud y reiteración, sin nota anterior, con una, con varias; "Al" y "A la"; con y sin dependencia; número vacío → "____/AA"; la tabla con el "Qué se solicita"; eventual; el orden), el Word (abrir el XML: tamaño 12240 × 20160, márgenes, encabezado con imagen, marca de agua, pie, ninguna firma, los textos) y la validación.
- API (Docker): permisos de las rutas nuevas y de `POST /api/notas/generar` (sin sesión 401, lector 403, colaborador y administración 200; `tests/permisos.test.js`); cada 400; un dataset de otra área; el `Content-Disposition`.
- Word de la Nota Digital: sobre el HTML de notas de cada tipo y época (aviso interno y externo, reiteración, autorización, auditoría, con dos firmas, una de antes del anexo), sin la primera línea ni ningún dato de la firma. **Los HTML de prueba van con los nombres de las personas cambiados** (regla del proyecto: nada de nombres de personas en archivos versionados).
- Áreas: el formulario guarda el ámbito; la migración clasifica y no toca los textos.
- Página: `notas.js` en un `vm`, como las demás.
- Los tests actuales del DOCX (`tests/reportes.test.js`, "notas DOCX") se adaptan: la escalonada deja de existir.

**Documentación**: CLAUDE.md (estructura, roles, convenciones de `notas.js`, la sección nueva), README (roles: el lector ya no tiene Notas; Herramientas → Notas; Correos → Word) y una línea en la spec de las notas DGMIT, que decía que la DGMIT no usa este generador.

## 10. Decisiones mías (para revisar al leer)

1. La marca de agua es un archivo fijo del repositorio; el encabezado y el pie salen de la configuración de Correos (los mismos que usa el PDF de las Notas Digitales). Si cambia el membrete, se cambia en un solo lugar; la marca de agua, en el código. El PNG del isotipo de la maqueta está a todo color: hay que generar una versión ya aclarada (como la deja Word en la hoja membretada), porque la librería `docx` no aplica transparencia.
2. "Página X de Y" en el pie de las dos notas en Word (la hoja membretada no lo trae).
3. Un dataset eventual o sin fecha dice "Información actualizada disponible" en "Datos solicitados", y se puede elegir.
4. El orden de la tabla (vencidos, próximos, el resto por vencimiento).
5. Textos: la REF dice "para **el** Portal…" (hoy "para Portal…"); el primer párrafo suma "con los datos del período que se indica en cada caso" (como el aviso de las Notas Digitales); la redacción final de la reiteración (sección 4.4, a partir de la idea del usuario) y que el párrafo de la reiteración vaya después de la tabla, también en la externa; en la externa, la Dirección General va debajo de "Sin más, saludamos…" y después el espacio para la firma.
6. Letras: cuerpo Arial 12, tabla 10, "Qué se solicita" 9.
7. Clasificación del Anexo A: el usuario la confirmó entera el 24/10/2026, con el Concejo Deliberante fuera del municipio y los dos Entes Autárquicos municipales.
8. Word de la Nota Digital: sin la primera línea del email; con dos firmas, los dos espacios y la leyenda; también para las pruebas.
9. "Siguiente" con un error en lugar de deshabilitado cuando no hay datasets tildados.
10. `notas.js` con `?v=`.
11. (Retirada: los textos de las áreas no se tocan, así que la vuelta atrás solo borra la columna.)
12. "Cambiar el área" conserva el filtro y la búsqueda del paso 1.
13. "Nota anterior": se trae la nota original del ciclo (la primera vigente), no la más reciente; si la persona edita la lista, deja de completarse sola.
14. La fecha de la nota va del 01/01/2025 hasta 30 días después de hoy, y el estado de cada dataset (qué se puede elegir y qué viene tildado) se calcula con esa fecha, igual que el pedido. La lista del paso 1 usa el estado de hoy.

## 11. Lo que queda al constructor

- La forma exacta de los endpoints y de sus respuestas (respetando `{ success, data?, error?, message? }`).
- Cómo se arma el Word con la librería `docx` (ya instalada): encabezado con imagen, marca de agua flotante detrás del texto, campos de página, tabla.
- Cómo se pasa el HTML guardado de una Nota Digital a Word: sale siempre de `renderHtml`, con un conjunto chico de etiquetas (`p`, `table`, `b`, `br`, `span`, `a`, `img`), pero cambió con las entregas (columnas, anexo, firmas), así que hay que probarlo con notas de cada época. Cómo se reconoce y se quita la firma.
- Cómo se pide la vista previa sin saturar el servidor (por ejemplo, esperar a que la persona deje de escribir).
- El CSS de la página (con los tokens de `main.css`), siguiendo la maqueta.
- Si la aclaración de la Resolución 2820/22 queda como ayuda en la página.

## 12. Ideas para más adelante (no entran)

- Después de descargar, un enlace a "Cargar nota DGMIT" en el Seguimiento, para cuando el área la reciba.
- Que la reiteración se elija sola cuando el dataset ya tiene una nota DGMIT de solicitud en el ciclo (hoy la elige la persona; lo único automático es completar la nota anterior).
- Varias áreas a la vez (una nota por área, en un solo zip).

## Anexo A. Áreas: ámbito y textos

**Vale solo la columna Ámbito,** confirmada por el usuario el 24/10/2026. Las correcciones de nombre y de dependencia de las otras columnas **no se aplican** (decisión del usuario: las áreas quedan como están en la base de producción). Se dejan acá como registro de los errores encontrados, por si algún día se corrigen a mano en Áreas.

"Dependencia" es `area_superior`; el artículo de la dependencia (`articulo_superior`) va entre paréntesis cuando cambia. "—": sin cambios. En negrita, lo que se habría corregido.

| Id | Nombre (corrección) | Dependencia corregida | Ámbito |
|---|---|---|---|
| 1 | Agencia de Acceso a la Información Pública | **Subsecretaría de Modernización y Transparencia de la Secretaría de Gobierno, Modernización y Transparencia** | Municipal |
| 2 | Agencia Provincial de Seguridad Vial | **Subsecretaría de Seguridad Vial del Ministerio de Seguridad de la Provincia del Chubut** | Fuera del municipio |
| 3 | Asociación de Bomberos Voluntarios de Comodoro Rivadavia | — (sin dependencia) | Fuera del municipio |
| 4 | Banco Central de la República Argentina | — (sin dependencia) | Fuera del municipio |
| 5 | Dirección de Datos Públicos y Comunicación | **Subsecretaría de Modernización y Transparencia de la Secretaría de Gobierno, Modernización y Transparencia** | Municipal |
| 6 | Dirección de Estadística y Evaluación Educativa | Ministerio de Educación del Chubut (**artículo: el**) | Fuera del municipio |
| 7 | **Dirección de Patrimonio Cultural y Natural** (era "… . D. G. de Gestión Interinstitucional y Patrimonial") | **Dirección General de Gestión Interinstitucional y Patrimonial de la Subsecretaría de Cultura de la Secretaría de Cultura** | Municipal |
| 8 | Dirección General de Asociaciones Vecinales | **Secretaría de Gobierno, Modernización y Transparencia** | Municipal |
| 9 | Dirección General de Catastro | **Subsecretaría de Coordinación Económica y Control de Gestión** | Municipal |
| 10 | Dirección General de Cultos | **Subsecretaría de Modernización y Transparencia de la Secretaría de Gobierno, Modernización y Transparencia** | Municipal |
| 11 | **Dirección General de Gestión Integral de Contribuyentes** (era "lntegral") | **Subsecretaría de Rentas de la Secretaría de Recaudación** | Municipal |
| 12 | Dirección General de Habilitaciones Comerciales | **Subsecretaría de Fiscalización de la Secretaría de Control Urbano y Operativo** | Municipal |
| 13 | Dirección General de Higiene Urbana y Estrategias Urbano Ambientales | **Secretaría de Gobierno, Modernización y Transparencia** | Municipal |
| 14 | Dirección General de Modernización e Investigación Territorial | **Subsecretaría de Modernización y Transparencia de la Secretaría de Gobierno, Modernización y Transparencia** | Municipal |
| 15 | Dirección General de Parques y Paseos | **Secretaría de Control Urbano y Operativo** | Municipal |
| 16 | Dirección General de Promoción de Derechos para Personas con Discapacidad | **Subsecretaría de Desarrollo Humano y Familia de la Secretaría de Desarrollo Humano y Familia** | Municipal |
| 17 | Dirección General de Promoción Social y Comunitaria | **Subsecretaría de Desarrollo Humano y Familia de la Secretaría de Desarrollo Humano y Familia** | Municipal |
| 18 | Dirección General de Recursos Humanos | **Subsecretaría de Recursos Humanos de la Secretaría de Gobierno, Modernización y Transparencia** | Municipal |
| 19 | Dirección General de Relaciones Laborales | **Subsecretaría de Recursos Humanos de la Secretaría de Gobierno, Modernización y Transparencia** | Municipal |
| 20 | Dirección General de Servicios Administrativos | **Subsecretaría de Gestión Presupuestaria de la Secretaría de Economía, Finanzas y Control de Gestión** | Municipal |
| 21 | Dirección General de Tránsito | **Subsecretaría de Seguridad de la Secretaría de Control Urbano y Operativo** | Municipal |
| 22 | Dirección General de Transporte | **Subsecretaría de Transporte de la Secretaría de Gobierno, Modernización y Transparencia** | Municipal |
| 23 | Dirección General de Veterinaria, Control de Fauna Urbana y Plagas | **Subsecretaría de Fiscalización de la Secretaría de Control Urbano y Operativo** | Municipal |
| 24 | Empresa Argentina de Navegación Aérea | — (sin dependencia) | Fuera del municipio |
| 25 | Ente Autárquico Comodoro Deportes | Intendencia | Municipal (confirmado por el usuario) |
| 26 | Ente Autárquico Comodoro Turismo | Intendencia | Municipal (confirmado por el usuario) |
| 27 | Honorable Concejo Deliberante de Comodoro Rivadavia | — (sin dependencia) | Fuera del municipio (confirmado por el usuario) |
| 28 | Instituto Geográfico Nacional de la República Argentina | — (sin dependencia) | Fuera del municipio |
| 29 | Instituto Nacional de Estadística y Censos de la República Argentina | — (sin dependencia) | Fuera del municipio |
| 30 | Ministerio de Educación del Chubut | Gobierno de la Provincia del Chubut | Fuera del municipio |
| 31 | Municipalidad de Comodoro Rivadavia | — (sin dependencia) | Municipal |
| 32 | Secretaría de Cultura | Intendencia | Municipal |
| 33 | Secretaría de Desarrollo Humano y Familia | Intendencia | Municipal |
| 34 | Secretaría de Economía, Finanzas y Control de Gestión | Intendencia | Municipal |
| 35 | **Secretaría de Energía de la Nación** (era "de Nación") | **sin dependencia** (era "Intendencia") | Fuera del municipio |
| 36 | Secretaría de Infraestructura, Obras y Servicios Públicos | Intendencia | Municipal |
| 37 | Secretaría de la Mujer, Género y Diversidad | Intendencia | Municipal |
| 38 | **Dirección de Información Tributaria** (era "… . Dirección General de Análisis y Administración Tributaria") | **Dirección General de Análisis y Administración Tributaria de la Secretaría de Recaudación** | Municipal |
| 39 | Secretaría de Salud | Intendencia | Municipal |
| 40 | Subsecretaría de Comunicación | **Secretaría General, de Comunicación y de Relaciones Institucionales** (era "…Relaciones Institucionale", sin la coma) | Municipal |
| 41 | Sociedad Cooperativa Popular Limitada | — (sin dependencia) | Fuera del municipio |
| 42 | **Subsecretaría de Coordinación Económica y Control de Gestión** (era "Subsecretaria") | **Secretaría de Economía, Finanzas y Control de Gestión** | Municipal |
| 43 | Tribunal Electoral del Chubut | — (sin dependencia) | Fuera del municipio |
| 44 | Dirección Nacional de Vialidad | — (sin dependencia) | Fuera del municipio |
| 45 | Dirección General de Prensa y Comunicación Institucional | **Subsecretaría de Comunicación de la Secretaría General, de Comunicación y de Relaciones Institucionales** | Municipal |
| 46 | Dirección General de Sueldos | sin dependencia cargada (no se inventa: se completa en Áreas) | Municipal |

Totales: 13 fuera del municipio (2, 3, 4, 6, 24, 27, 28, 29, 30, 35, 41, 43, 44) y 33 municipales. Entre las 24 áreas que hoy tienen datasets pedibles, 4 quedan fuera del municipio (2, 6, 41 y 43) y llevan nota externa.

Los artículos de las áreas no cambian, salvo el de la dependencia del área 6 ("la Ministerio" → "el Ministerio"). Donde la dependencia queda vacía (35), el artículo de la dependencia también.
