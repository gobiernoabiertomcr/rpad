# Generador de Notas

La herramienta con que la DGMIT arma la nota formal que le pide los datos a un área, y el Word de las Notas Digitales.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-24-generador-de-notas-design.md`

## Archivos

notasController: el Generador de Notas, con sus áreas, la vista previa y el Word;
notasGeneradorReglas (la validación del pedido de una nota de la DGMIT, qué datasets se pueden pedir y su orden, puro), notasGeneradorContenido (la nota de la DGMIT como bloques y su HTML, puro), notasGeneradorDatos (las consultas del generador, solo lectura), notasWord (el Word en la hoja membretada, desde los bloques) y notasDigitalesWord (los bloques de una Nota Digital, desde su HTML guardado, puro);
img/membrete-isotipo-aclarado.png # Marca de agua del Word de las notas (el isotipo de Comodoro Rivadavia, ya aclarado)

## Generador de Notas (spec 2026-10-24-generador-de-notas)

- Qué es:
  Herramientas → Notas (`notas.html` + `js/notas.js`, título «Generador de Notas», con su `<style>` y sin `publico.css`), la herramienta con la que la DGMIT arma la nota formal que le pide los datos a un área (antes la usaba la DDPC para pedírselos a la DGMIT: desde las Notas Digitales automáticas ya no hace falta).
  Dos notas:
  **interna** (a la Subsecretaría de Modernización y Transparencia, para que gestione ante un área del municipio) y **externa** (directo al organismo), cada una como solicitud o reiteración.
  **No registra nada**: ni el número, ni la nota, ni quién la generó (la nota DGMIT se sigue cargando en el Seguimiento cuando el área la recibe).
  No cambia ninguna Nota Digital ni el circuito.
  Se fueron la nota escalonada (DDPC → DGMIT → Subsecretaría), el sello con iniciales y fojas fijas en el código, el período escrito a mano y el modal "Buscar Área por Dataset" (lo reemplaza el buscador del paso 1);
  `tests/reportes.test.js` ya no prueba notas DOCX.
  Antiobjetivos: que la nota pida otro período u otra frecuencia que la Nota Digital del mismo dataset (los "Datos solicitados" salen del mismo cálculo), que la vista previa diga una cosa y el Word otra, y que se lea como un reproche al área (la reiteración dice que "no se ha recibido la información", en impersonal).
- Quién: administración y el colaborador (`puedeCargarNotasDgmit`).
  Las cinco rutas llevan `authMiddleware` + `usaGeneradorDeNotas` (`middleware/auth.js`: la regla de `cargaNotasDgmit`, con su propio 403, "No tenés permiso para usar el generador de notas."; sin sesión, 401).
  El lector no ve "Notas" en el menú lateral (`updateSidebarAuth` de `main.js` lo oculta salvo con `Auth.puedeCargarNotasDgmit() === true`) y, si entra por la URL, la página muestra ese mensaje y no pide nada; sin sesión, al login.
- Los tres pasos (1.
  Área, 2.
  Datasets y nota y 3.
  Revisar y descargar; el actual con `aria-current="step"` y los hechos con una tilde; se vuelve atrás, nunca se salta adelante; al cambiar de paso, el foco va a su título):
  - **Área**: las áreas con algún dataset que se puede pedir (`sePuedeElegir` de `notasDgmitReglas.js`: activo, de gestión externa y con «Requiere nota DGMIT» en Sí o sin dato), con el estado de hoy.
    Filtros como botones con su cantidad (`aria-pressed`):
    "Con vencidos o próximos a vencer" (el inicial; primero el área del dataset más vencido) y "Todas" (por nombre), y el buscador por área o por dataset (sin tildes ni mayúsculas).
    Cada área es un botón que pasa al paso 2, con la insignia del ámbito y las de estado en lenguaje neutro ("Vencido hace N días", "Vence en N días", "Vence hoy", "Al día", "Los N al día").
    Si fallan las áreas, "No se pudieron cargar las áreas.
    Probá de nuevo en unos minutos.".
  - **Datasets y nota**: el área ("dependiente de …" o "sin dependencia cargada", y "Cambiar el área", que conserva el filtro y la búsqueda); el tipo, elegido por el ámbito ("Viene elegida porque el área figura como municipal en Áreas." o "Cambiada a mano: …"); el pedido (Solicitud, el inicial, o Reiteración con "Nota anterior (opcional)": ver abajo); la fecha (hoy, `Utils.hoyEnArgentina()`; del 01/01/2025 a hoy + 30 días) y el número (opcional;
    sin número, "Nota N° ____/AA" con el año de la fecha); y los datasets del área que se pueden elegir, **calculados a la fecha de la nota** (la lista del paso 1 usa hoy): tildados los vencidos y los próximos (mientras no se toque una casilla, al cambiar la fecha vienen tildados los de esa fecha); se eligen también los eventuales y los sin fecha; los al día a esa fecha se ven en gris, con la casilla deshabilitada ("Al día: todavía no hay datos para pedir.").
    Cada fila dice "Frecuencia · Datos solicitados: …" y, en violeta, las notas DGMIT del ciclo abierto ("Notas DGMIT del ciclo:
    N° 97/26 (solicitud, recibida el 02/07/2026) · …").
    Al lado, la vista previa achicada; sin ningún dataset tildado, "Siguiente" muestra "Elegí al menos un dataset." (no se deshabilita).
  - **Revisar y descargar**: la nota en grande (una sola hoja que crece: los saltos de página los decide Word al abrirlo), el resumen (Área, Nota, Fecha y número, Datasets) y "Descargar Word", con el nombre del archivo;
    "Armar otra nota" vuelve al paso 1 sin área, número ni nota anterior.
- "Nota anterior" de la reiteración: solo números (sin fecha), como etiquetas que se quitan, cada uno de hasta 40 caracteres y sin repetidos.
  Viene completada con las notas DGMIT cargadas: de cada dataset tildado, la original de su ciclo abierto (la primera de `notasDgmitDelCicloAbierto`, `services/seguimientoReglas.js`: las vigentes del ciclo abierto de la más vieja a la más nueva —por `recibida`, después la carga y después el id—, con la misma asignación al ciclo que `notaDgmitDelCiclo`, R7 incluido;
  sin ciclos —eventual o sin fecha—, las vigentes que no son anteriores a la última carga en el portal, también por R7, mientras que `notaDgmitDelCiclo` y el Seguimiento siguen con la más reciente), con los números distintos ordenados por recepción (`numerosTraidos`) y "Traída de las notas DGMIT cargadas en el Seguimiento.".
  Mientras nadie la toque, se vuelve a completar al cambiar los tildados; quitar o agregar un número la deja "Editada a mano." (con "Volver a traer las cargadas").
  Sin notas cargadas para los elegidos:
  "No hay notas DGMIT cargadas para estos datasets: escribila si la sabés.".
  La nota los cita después de la tabla:
  "…solicitada mediante Nota N° 88/26, …", "…mediante Notas N° 88/26, N° 102/26 y N° 131/26, …" o, sin ninguna, "…la información correspondiente, …".
- La nota (`services/notasGeneradorContenido.js`, puro):
  `construirNotaDgmit({ tipo, pedido, fecha, numero, anteriores, area, datasets })` la arma una sola vez como una lista de bloques (`parrafo`, `tabla`, `lista` y `firma`; el contrato está en su JSDoc:
  `Parte`, `Celda`, `Fila`, `BloqueParrafo`, `BloqueTabla`, `BloqueLista` y `BloqueFirma`), y de esos bloques salen sus dos salidas: la vista previa (`renderHtmlDeBloques`, con las medidas en `em` relativas a la letra del cuerpo: la página le da el tamaño a la hoja) y el Word (`renderDocx`).
  Los textos son los de la spec (4.2 interna, 4.3 externa, 4.4 reiteración y 4.5 la tabla), al pie de la letra, y los del área, tal como están en la base (con sus abreviaturas: se corrigen a mano en Configuración → Áreas).
  La tabla:
  Conjunto de datos, Frecuencia (`frecuenciaEnNota`) y Datos solicitados (el `pedido` de `conPedido`, el cálculo de las Notas Digitales, a la fecha de la nota; sin pedido, `INFORMACION_SIN_PEDIDO`, "Información actualizada disponible"), con una fila a todo el ancho debajo de cada dataset, "*Qué se solicita:* …" (vacío, `QUE_SE_SOLICITA_POR_DEFECTO`), en el orden de la lista del paso 2 (`ordenDeLosDatasets` vía `enElOrdenDeLaTabla`: los vencidos, el más vencido primero; los próximos;
  el resto por vencimiento, un eventual sin el suyo; los empates, por título).
  Letras (`LETRA`):
  Arial 12 en el cuerpo, 10 en la tabla y 9 en el "Qué se solicita".
  Sin firma: el bloque `firma` es el espacio en blanco para firmar a mano.
  Nombre:
  `nombreDelWord`, "Nota interna - <área> - AAAA-MM-DD.docx" (con "reiteracion" si lo es), enviado con `disposicionDeAdjunto`.
- Los artículos:
  "de" + "el" es "del" y "a" + "el" es "al" en todo lo que arma el sistema ("…, dependiente del Ministerio de Educación del Chubut, …"; la externa empieza con "Al" o "A la", según el artículo del área:
  "Al Instituto Nacional…");
  "ante el" no se contrae ("…ante el Ente Autárquico Comodoro Deportes, …").
  Sin dependencia, "…ante la **Dirección General de Sueldos**, la remisión…".
  Decisión del plan: la spec escribe "de {artículo}", y con "el" quedaría "de el".
- El Word (`services/notasWord.js`, `renderDocx(bloques, { membrete, pie })`, con la librería `docx`): oficio Legal (`HOJA`: 12240 × 20160 twips, la misma `PAGINA` de 612 × 1008 pt del PDF de las Notas Digitales) con los márgenes de la hoja membretada (3 cm a los costados, 3,5 arriba y 2,5 abajo).
  En el encabezado, así sale en todas las hojas: el membrete a todo el ancho, anclado al borde (si a todo el ancho pasa del margen de arriba, se achica a ese alto y va centrado), y la marca de agua detrás del texto (`public/img/membrete-isotipo-aclarado.png`, el isotipo ya aclarado:
  `docx` no aplica transparencia; se lee del disco una vez).
  En el pie, `membrete_pie` y "Página X de Y", en Arial 8 (en un estilo de párrafo:
  LibreOffice no les aplica la letra del run a los números de página).
  La fila de títulos se repite arriba de cada hoja y ninguna fila se parte.
  El membrete y el pie son los de las Notas Digitales (`membreteParaWord`, que nunca tira: sin configuración o con una imagen que no sirve, sale sin membrete y con la marca de agua); la vista previa usa el mismo (`membreteParaLaVistaPrevia`, también en `notasWord.js`:
  `GET /api/notas/membrete`, como data URL).
  Todo texto variable del Word (las partes de los bloques y el pie) pasa por `textoParaWord`: los surrogates solos pasan a U+FFFD y se quitan los caracteres que el XML no admite (U+0000–U+001F salvo el tab y los saltos, U+FFFE y U+FFFF), que `docx` escribe tal cual y dejan el Word dañado.
- El cierre junto: el bloque anterior a la firma (el remitente), la firma y lo que la sigue (en una Nota Digital, la leyenda de las dos firmas y la línea CC) van con `keepNext`, salvo el último bloque: el cierre no queda partido entre dos hojas, como en el PDF.
  `Fila.conLaSiguiente` deja en la misma hoja una fila con la siguiente (`keepNext` en sus párrafos): la de un dataset con la de su "Qué se solicita" y, en una Nota Digital, la fila que abre un vencimiento con la que sigue y la de un dataset con su antecedente.
  La vista previa lo ignora.
  El último párrafo del cuerpo termina en un run vacío:
  LibreOffice dibuja los números del pie con la letra del último run del cuerpo.
- El Word de las Notas Digitales (spec, sección 6):
  Correos → Libro suma el botón "Word" en cada nota, de cualquier tipo, estado y época (también las de prueba), con `GET /api/notificaciones/notas-digitales/:id/word` (`adminOnly`, `descargarWord` de `notasDigitalesController.js`) y el nombre del PDF con `.docx` (`Nota-Digital-9-26.docx`; una prueba, `Nota-Digital-PRUEBA-<id>.docx`).
  Sale en la misma hoja membretada que la nota de la DGMIT; el PDF no cambia, y las hojas pueden cortar en otros lugares.
  `bloquesDeNotaDigital(html)` (`services/notasDigitalesWord.js`, puro, sin librería de HTML: un recorrido chico por las etiquetas que escribe `renderHtml`) arma los bloques desde `notas_digitales.html`, tal como se envió, sin recalcular nada.
  Cómo reconoce la nota: saca la primera línea del email (el primer `<p>`, en bordó o con un texto de `AVISO_ADJUNTO`; las notas viejas no la tienen); el remitente es el último `<p>` que empieza con "DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN" y se conserva;
  justo después tiene que estar la firma (el bloque con `margin:32px 0 0`: un `<p>` es una firma y una `<table>`, dos), que pasa a ser el espacio en blanco, de una o dos columnas, sin leer su contenido (ni la imagen, ni el nombre, ni el cargo, ni el renglón del personal contratado); la leyenda (el `<p>` en cursiva que la sigue) y el CC (el último `<p>`) quedan si tienen texto (el CC vacío de la autorización y de la auditoría no va).
  Falla cerrado: sin el remitente, o sin la firma justo después, tira `NotaNoReconocida` ("No se encontró el remitente de la nota." o "No se encontró la firma de la nota.") y la API responde **422** con el mensaje (cualquier otro error es un 500): nunca un Word roto ni con una firma inventada.
  Una sola letra de tabla en toda la nota, la del PDF: todas las tablas en 8,5 pt (`LETRA_DE_TABLA`, 17 medios puntos) con un margen de 3 pt, y lo de adentro achicado en la misma proporción (el antecedente, 7,5; la segunda parte de "Informado en", 7).
  Desde 4 columnas, `sinPartirPalabras` (cada columna mide al menos su palabra más ancha, como `calcularAnchos` del PDF); los anchos, los del PDF (`PROPORCIONES`, `PROPORCIONES_CON_SEGUNDA` y `PROPORCIONES_EXTERNA`, exportados para esto; otra cantidad de columnas, parejos).
  "Del" o "al" con su fecha, y "N°" con su número, van unidos por un espacio duro, como en el PDF.
  Las 8 notas reales del libro al 25/10/2026 se convierten.
- API (`controllers/notasController.js`; las consultas, de solo lectura, en `services/notasGeneradorDatos.js`, y la validación, pura, en `services/notasGeneradorReglas.js`):
  `GET /api/notas/areas` (las áreas del paso 1, cada una con sus datasets que se pueden elegir y el estado de hoy), `GET /api/notas/areas/:id?fecha=` (el área con sus datasets a la fecha de la nota:
  `estado`, `dias`, `frecuencia`, `datos_solicitados`, `que_se_solicita`, `se_puede_pedir` y `notas_dgmit`, con una sola llamada a `fuentesDe`; un id que no es un entero positivo o que no existe, 404; una fecha que no sirve, el 400 de la fecha; un área sin datasets que se puedan elegir, 200 con la lista vacía), `GET /api/notas/membrete` (`{ imagen, pie }`), `POST /api/notas/vista-previa` (`{ html, nombre }`) y `POST /api/notas/generar` (el Word).
  Las dos últimas reciben `{ fecha, numero, tipo, pedido, anteriores, area_id, datasets }` y pasan por `prepararNota`: primero `validarPedidoDeNota(entrada, hoy)` → `{ datos, errores }` (ninguna función tira;
  `MENSAJES_GENERADOR`, en el orden de `ORDEN_DE_CAMPOS`: la fecha, del 01/01/2025 a hoy + `DIAS_ADELANTE` (30); el número, hasta `LARGO_NUMERO` (40) caracteres sin los espacios de los extremos, contados con `Array.from`, y un número que no es un texto da 400;
  `interna` o `externa`;
  `solicitud` o `reiteracion`; las anteriores, solo con reiteración; los ids, con `idsDeDatasets` de `notasDgmitReglas.js`) y después, en la base, que el área exista ("Elegí el área.") y que cada dataset, en el orden recibido, exista y sea del área (`textoDeOtraArea`), se pueda elegir (`textoNoSePuedeElegir`) y no esté al día a la fecha de la nota (`sePuedePedir`, `textoAlDia`:
  "«título» está al día: todavía no hay datos para pedir.").
  Un error es 400 `{ success: false, error, campo, errores }`.
  La página pide la vista previa 300 ms después del último cambio, descarta la respuesta que llega cuando la nota ya cambió y solo deja descargar el Word de la nota que muestra.
- Áreas: el formulario suma "Ámbito" y la lista, la insignia "Fuera del municipio" (desde «Configuración», en la pestaña Áreas: dos opciones grandes, "Municipal" / "La nota de la DGMIT va por la Subsecretaría." y "Fuera del municipio" / "La nota de la DGMIT va directo al organismo.", con "Municipal" elegida en un alta, y la columna Ámbito de la tabla).
  `createArea` y `updateArea` (`controllers/areasController.js`) lo validan con `AMBITOS` y `MENSAJE_AMBITO` ("Elegí si el área es municipal o de fuera del municipio.": otro valor, null incluido, da 400 en `ambito`), sin `|| null`: en el alta, sin el campo, municipal; en la edición, si no llega, no se toca.
  `GET /api/areas`, público, lo devuelve (`a.*`).
- La página (ver la convención de `notas.js`): copias mínimas, para avisar en el momento (el servidor valida igual):
  `MENSAJES_GENERADOR`, `LARGO_NUMERO_NOTA`, `FECHA_MINIMA_NOTA` y `DIAS_ADELANTE_NOTA` (copias de `MENSAJES_GENERADOR`, `LARGO_NUMERO`, `FECHA_MINIMA` y `DIAS_ADELANTE` de `notasGeneradorReglas.js`), `errorDeFecha` (la regla de la fecha de `validarPedidoDeNota`, comparada en los bordes), `MENSAJE_SIN_PERMISO` (el 403 de `usaGeneradorDeNotas`), `INFORMACION_SIN_PEDIDO` (la de `notasGeneradorContenido.js`)
  y `TIPOS_NOTA_DGMIT` (copia de `TEXTO_TIPO_NOTA_DGMIT`), todas atadas por tests de paridad en `tests/notas-frontend.test.js`;
  `textoParaBuscar` (copia de la de `seguimiento.js`), `numeroValido` y `numerosConOtro` (cuentan con `Array.from`: el campo no tiene `maxlength`, que cuenta unidades de UTF-16), `erroresDelPaso2` y `erroresParaSeguir` solo tienen tests de comportamiento.
- Tests:
  `tests/notas-generador-reglas.test.js` (puro: la validación, `sePuedePedir` y el orden), `notas-generador-contenido.test.js` (puro: interna y externa; solicitud y reiteración sin nota anterior, con una y con varias;
  "Al" y "A la"; con y sin dependencia;
  "____/AA"; la tabla con el "Qué se solicita"; el eventual; el HTML y el nombre), `notas-word.test.js` (puro: abre el .docx con JSZip y lee la hoja, los márgenes, el encabezado, la marca de agua, el pie, los textos, la tabla, el espacio de la firma, el cierre junto y que no quede nada que el XML no admita), `notas-word-membrete.test.js` (Docker:
  `membreteParaWord` y `membreteParaLaVistaPrevia`), `notas-digitales-word.test.js` (los HTML de `tests/fixtures/notas-digitales-html/`, con los nombres cambiados: aviso externo, la 1/26 escrita a mano —sin la primera línea, 6 columnas y la firma sin negrita—, reiteración externa con dos firmas, autorización y auditoría; y las notas que arma hoy `renderHtml` con los datos de `ejemplo()`: aviso y reiteración, interna y externa, y la auditoría, cada una con una y con dos firmas;
  los 422 y, con Docker, la API), `notas-generador-api.test.js` (Docker: permisos, los datos de las áreas, la fecha que cambia el estado, cada 400, un dataset de otra área, dado de baja, interno o que no requiere nota, números raros y el `Content-Disposition`), `notas-frontend.test.js` (la página en un `vm`, con las paridades y un DOM falso), `areas-ambito-api.test.js` (Docker), `seguimiento-reglas.test.js` (`notasDgmitDelCicloAbierto`, cuya última nota es la de `notaDgmitDelCiclo`,
  salvo sin ciclos y con todas anteriores a la última carga), `notas-dgmit-reglas.test.js` (`sePuedeElegir` e `idsDeDatasets`), `correos-frontend.test.js` (el botón "Word"), `main-frontend.test.js` ("Notas" solo para quien usa el generador), `usuarios-frontend.test.js` (la ayuda de los roles), `permisos.test.js` (las cinco rutas y la del Word), `paginas.test.js` (`VERSION_NOTAS`) y `schema.test.js` (la columna, la migración y la vuelta atrás).

## La página: notas.js

- `notas.js` (el Generador de Notas): al cargarse solo declara (`tests/notas-frontend.test.js` lo carga en un `vm`, con el `api.js` de verdad, y también con un DOM falso).
  Lo que arma HTML (las filas de las áreas, las insignias, la lista de datasets, la nota anterior, la hoja de la vista previa y el resumen:
  `htmlDeFilaDeArea`, `htmlDeListaDeDatasets`, `htmlDeNotaAnterior`, `htmlDeHoja`, `htmlDelResumen`, …) y el pedido (`cuerpoDelPedido`, `erroresParaSeguir`, `vistaPreviaDe`) son puros; en las filas de áreas (un `<button>`) y en las de datasets (un `<label>`), el contenido va en `<span>` con `display: block`, nunca en `<div>`.
  Lo que toca el DOM o la API va aparte, al final.
  Pide los datos y la vista previa con `API.pedirJson`, y el Word con `pedirWord`, un `fetch` POST propio a `/notas/generar` con `Auth.getAuthHeaders()` (JWT en el encabezado, nunca en la URL; es local porque `API.pedirArchivo` es solo GET y `api.js` no cambió), que lo baja con su `descargarBlob` (también local, copiado de `correos.js`); con un 401, al login.
  No recalcula nada: estado, días, "Datos solicitados", las notas DGMIT del ciclo, el HTML de la nota (lo arma y lo escapa el servidor: va tal cual) y el nombre del Word los manda el servidor.
  "Hoy":
  `Utils.hoyEnArgentina()`.
  Copias mínimas: ver «Generador de Notas».

## Archivos de tests

`notas-frontend.test.js`, `reportes.test.js`, `notas-generador-reglas.test.js`, `notas-generador-contenido.test.js`, `notas-word.test.js`, `notas-word-membrete.test.js`, `notas-digitales-word.test.js`, `notas-generador-api.test.js`, `areas-ambito-api.test.js`, `seguimiento-reglas.test.js`, `notas-dgmit-reglas.test.js`, `correos-frontend.test.js`, `main-frontend.test.js`, `usuarios-frontend.test.js`, `permisos.test.js`, `paginas.test.js`, `schema.test.js`
