# El dato de la quincena: el contrato con Datito

Lo que el RPAD le exige a Datito y lo que guarda: el POST con su token, la validación de la edición (el JSON v1, con las repeticiones de la v1.3 y las propuestas de datasets nuevos de la v1.4), la clave, la huella, el guardado y el recibo, y el token con su interruptor.
Las lecturas, la página y el archivo en general están en `docs/temas/dato-quincena.md`.
El correo, en `docs/temas/dato-quincena-correo.md`.
La principal del equipo no toca nada de esto: está en `docs/temas/dato-quincena-principal-equipo.md`.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-11-07-dato-quincena-design.md`
- `docs/superpowers/specs/2026-11-14-dato-quincena-v1-3-design.md` (el contrato v1.3: Repite y Efemeride)
- `docs/superpowers/specs/2026-11-18-dato-quincena-propuestas-datasets-design.md` (el contrato v1.4: las propuestas de datasets nuevos)

## Archivos

datoQuincenaController: el POST de Datito (`recibirEdicion`);
datoQuincenaReglas (puro: los topes, la validación de la edición y del manifiesto, la clave, la huella del paquete, el token, `esPng`, `esSvg`, `esTextoUtf8`, `fechasPrevias`, las filas que se guardan, los avisos y el recibo);
datoQuincenaDatos (la transacción del guardado, `guardarEdicion`);
middleware/auth.js (`tokenDelDatoQuincena`), middleware/rateLimit.js (`limiteDatoQuincena`), config/upload.js (`subidaDelDatoQuincena` y `responderAntesDeLeer`);
`database/updates/migracion-dato-quincena.sql` y `rollback-dato-quincena.sql` (las tablas, en `docs/temas/base-de-datos.md`).

## El POST de Datito

- `POST /api/dato-quincena/ediciones`, con `Authorization: Bearer <token>` y un `multipart/form-data` de estas partes, todas como archivo (con `filename`; topes en `TOPES` de `services/datoQuincenaReglas.js`):
  `metadata`, el JSON de la edición en UTF-8 (obligatoria, hasta 256 KB);
  `infografia_png` (obligatoria, hasta 5 MB);
  `correo_texto` (obligatoria, hasta 256 KB);
  `calculos` (opcional, hasta 256 KB);
  y `infografia_svg` (opcional, hasta 1 MB): la infografía editable, que lleva su entrada en el manifiesto solo si llegó.
  `metadata` va como archivo y no como campo: busboy decodifica un campo (cambia lo inválido por U+FFFD sin avisar), y así no habría bytes exactos para la huella ni forma de rechazar un UTF-8 roto.
  El MIME que trae cada parte no cuenta: cuenta el contenido.
  El encabezado `Idempotency-Key`, si llega, no se lee: la clave sale del JSON.
- El orden de los controles, cada uno antes del siguiente (`routes/index.js`):
  1. `limiteDatoQuincena` (`middleware/rateLimit.js`): 20 pedidos por hora por IP, todos (también los que dan 401 o 400); el 21 es 429 «Demasiados pedidos. Probá de nuevo más tarde.», con `Retry-After` en segundos (`standardHeaders: 'draft-8'`; la ventana es fija, así que puede ser menos de una hora).
  2. `tokenDelDatoQuincena` (`middleware/auth.js`): sin la huella configurada, 503; sin el token o con otro, 401 (abajo, «El token y el interruptor»).
  3. `subidaDelDatoQuincena` (`config/upload.js`): que sea un `multipart/form-data`, y la lectura.
  4. `recibirEdicion` (`controllers/datoQuincenaController.js`): el JSON de `metadata`, la validación de la edición y el guardado.
  Antes de las rutas, como en todas, van los lectores globales y `datosComunes` de `app.js`: un cuerpo JSON o de formulario que los lectores no pueden leer (un JSON roto, más de 1 MB), con una clave reservada o de más de 32 niveles (o una query con una clave reservada) recibe su 400 o su 413 de siempre, sin pasar por el límite de pedidos ni por `responderAntesDeLeer`.
  Un cuerpo de otro tipo no lo leen, aunque pase de 1 MB: pasa por el límite y por el token, y recibe «el pedido no es multipart/form-data».
- La lectura: multer en memoria (las partes van a la base), armado en cada pedido, con `limits: { fields: 0, files: 5, parts: 6, fileSize: 5 MB }` y un filtro que anota y descarta sin guardarla una parte con otro nombre o repetida.
  Sin `fieldNameSize`, a propósito: busboy entrega sin nombre una parte sin `name` o con `name=""`, y multer 1.4.5 mide ese nombre con `fieldNameSize` dentro del flujo de busboy, donde el `TypeError` tira el proceso entero.
  El filtro trata como otro nombre uno que no es un texto, que está vacío o que pasa de 100 caracteres.
  `parts` es 6 y no 5: busboy 1.6 avisa el límite al terminar la parte número `parts`, no al pasarla, así que con 5 toda edición completa, de cinco partes, daría 400.
  Con 6, una sexta parte siempre es un 400: «todas las partes van como archivo» si es un campo (`fields: 0`) y «sobran partes» si es un archivo (`files: 5`) o una que busboy salteó.
  Una parte sin `Content-Disposition`, o que no es `form-data`, busboy la saltea antes de que multer la vea: no se guarda ni se informa, y cuenta para las seis.
  Una parte con `Content-Type: application/octet-stream` y sin `filename` (para busboy, un archivo) multer también la descarta sin avisar: si era obligatoria, el 400 dice que falta.
  Al leer, cada parte puede tener hasta 5 MB (multer tiene un solo `fileSize`, el de la infografía PNG); los topes de 256 KB y de 1 MB se miden después de leer.
- Los 400 de la lectura dicen «No se pudo leer la edición: <motivo>.», con el primer motivo fijo que valga:
  «el pedido no es multipart/form-data» (un cuerpo JSON o de formulario ya lo leyeron los lectores globales de `app.js`, hasta 1 MB, y no se usa);
  de multer, «todas las partes van como archivo» (un campo de texto), «sobran partes» o «el pedido está mal armado» (cualquier otro error de multer o de busboy, como un multipart cortado);
  después, «una parte no corresponde» (otro nombre, ninguno, uno vacío o uno de más de 100 caracteres, sin repetir el que llegó), «la parte <nombre> llegó dos veces» y «falta la parte <nombre>» (se busca en el orden `metadata`, `infografia_png`, `correo_texto`; el SVG y los cálculos son opcionales).
  Una parte aceptada (la primera de cada uno de los cinco nombres) que pasa su tope da 413 «La parte <nombre> supera el tamaño permitido (256 KB).», o «(5 MB).» en la infografía PNG y «(1 MB).» en el SVG: un texto fijo por parte, también para una `metadata` de más de 5 MB, que corta multer.
  Una repetida o con otro nombre la descarta el filtro antes de que multer la mida: aunque pase el tope, da un 400 de los de arriba y no el 413 («sobran partes» si es la sexta, que multer corta antes del filtro; una quinta con otro nombre da «una parte no corresponde»).
  El 413 de más de 5 MB lo da multer al leer, antes que «una parte no corresponde», «llegó dos veces» y «falta la parte»; el de 256 KB y el de 1 MB van después de esos tres.
- El JSON (`recibirEdicion`): una `metadata` que no es UTF-8 o no es un JSON da 400 «No se pudo leer la edición: metadata no es un JSON válido.»; el BOM se conserva y la hace fallar igual.
  Con una clave reservada o más de 32 niveles (`motivoDeRechazo` de `middleware/cuerpo.js`, que `datosComunes` no ve en un multipart), el 400 de siempre, «Los datos enviados no tienen un formato válido.» (`MENSAJES_DEL_CUERPO`).
  Una edición con errores, 422 «La edición tiene errores.» con `errores` (abajo, «La edición»).
  Si no, el guardado: 201, 200 o 409 (abajo, «La clave, la huella y el guardado»).
- Las respuestas antes de leer (429, 503, 401 y los 400 y 413 de la lectura) van con `responderAntesDeLeer` (`config/upload.js`): con un `Content-Length` de hasta 7 MB (`TOPE_DEL_PEDIDO`, la suma de los topes más el margen del multipart), se termina de leer el pedido y se responde, como en las subidas de Proyectos (`responderAlTerminarDeLeer`), así quien todavía mandaba recibe la respuesta y no un corte.
  Sin `Content-Length` o con uno mayor, la respuesta va enseguida con `Connection: close` y lo que llega se descarta: lo que manda un desconocido no se lee sin fin.
  Por eso el 429 tiene su propio `handler`.
- La consola registra un renglón por pedido, nunca el token, su huella ni nada de lo recibido:
  `Dato de la quincena: <clave> <estado>` cuando ya hay clave (201, 200, 409 y un 500 del guardado) y `Dato de la quincena: <estado> (<motivo>)` antes (por ejemplo `401 (token)`, `400 (falta una parte)`, `413 (tope)` o `422 (la edición tiene errores)`).
  Un 500, «No se pudo guardar la edición.», suma al renglón solo el `code` y el `message` del error: nunca `err.sql`, que traería la edición.

## La edición

- El JSON v1 de Datito (`validarEdicion` y, con las partes, `erroresDeLaEdicion`, puros): todo objeto es cerrado, y una clave de más es un error y una que falta también (`undefined` cuenta como que falta): todas van siempre, aunque sean null.
  Los largos se cuentan con `Array.from`; un texto obligatorio no puede quedar vacío ni con solo espacios, y ningún texto lleva el carácter nulo.
- La edición: `schema_version` '1.0';
  `agente` 'dato-de-la-quincena';
  `fecha_edicion`, 'AAAA-MM-DD', un día que existe, desde el 01/11/2026 (`FECHA_MINIMA`) hasta mañana en Argentina (`hoyArgentina()`, que llega por parámetro);
  `tipo`, 'regular' o 'piloto';
  `referencia_piloto`, null en una regular y `piloto-N` en un piloto (N de 1 a 999, sin ceros a la izquierda);
  `titulo` (200);
  `generado_at`, un instante o null;
  `correo`, `{ estado, enviado_at }`, el de la copia que Datito se manda: `enviado` con un instante o null, o `no_enviado` con null;
  `nota_archivo` (4000) o null;
  `agenda`, de 0 a 20 `{ titulo (200), fecha, detalle (4000), url }` y, opcional, `tipo` (`evento` o `efemeride`; si falta, `evento`; otro valor, 422);
  `propuestas`, de 1 a 5;
  `propuestas_datasets`, opcional, de 0 a 3 (abajo);
  y `adjuntos`, el manifiesto, de 2 a 4 entradas.
  En una regular, `generado_at` es obligatorio y también `enviado_at` si el correo salió; en un piloto pueden ser null.
  Con `no_enviado`, `enviado_at` con algo que no es null da 422 «Con el correo no enviado, la hora del correo va null.».
  Con un estado que no vale, `enviado_at` puede ser null o un instante: el único error es el del estado, para no pedirle al bot una hora que quizá no existe.
- `nota_archivo` puede llegar vacía o con solo espacios (solo los textos obligatorios no pueden), y el detalle la da como null.
  El `dataset.ckan_slug` de las propuestas, como todo texto que admite null, también puede llegar vacío (el `ckan_slug` de un dataset relacionado de las propuestas de datasets, no: abajo).
- Cada propuesta: `orden` (1, 2, 3… en su orden, sin saltos);
  `titulo` (200);
  `etiquetas`, sin repetidos, de 'Principal', 'Validar', 'Agenda', 'Efemeride' (sin tilde, como la escribe el bot) y 'Repite' (exactamente una propuesta de la edición lleva 'Principal');
  `dataset`, `{ rpad_id, ckan_slug, nombre (200), url }`, con `rpad_id` un entero positivo o null y `ckan_slug` (200) o null;
  `rpad_snapshot`, la foto del RPAD (abajo);
  `cifra_clave` (1000);
  `calculo` y `contexto_historico` (20000);
  `por_que_hoy`, `angulo`, `idea_placa` y `texto_redes` (10000);
  `puntos_centrales`, de 3 a 5 textos (2000);
  `borrador_nota`, `{ titulo (200), parrafos }`, con 2 o 3 párrafos (10000);
  `notas_validacion`, de 0 a 20 textos (10000);
  `fuentes`, de 1 a 20 direcciones;
  y, opcional, `repeticion` (abajo).
- La repetición (contrato v1.3): Datito puede volver sobre un dataset o un tema de una edición anterior si hay datos nuevos o un hecho actual, y lo marca.
  `repeticion` es opcional, como `tipo` en la agenda: sin la clave, la propuesta tiene la forma de antes (v1.2) y `schema_version` sigue en '1.0'.
  Si está, vale null o un objeto cerrado con sus cuatro claves: `fecha_edicion_previa` (un día AAAA-MM-DD que exista), `motivo` (`datos_nuevos` o `hecho_actual`), `alcance` (`dataset` o `tema`) y `detalle` (1000).
  Un valor que no es null ni un objeto da «Tiene que ser un objeto.».
  La coherencia, después de los errores de cada propuesta y en su ruta: 'Repite' sin `repeticion` (o con null) da `propuestas[i].repeticion` «La propuesta tiene la etiqueta Repite pero no tiene repeticion.»; una `repeticion` objeto sin 'Repite' da `propuestas[i].etiquetas` «La propuesta tiene repeticion pero no tiene la etiqueta Repite.».
  Datito copia esos dos textos tal cual: no se cambian.
  La validación no compara la fecha con lo archivado: lo que depende de lo archivado da avisos en el recibo y nunca un 422 (anti-objetivo de la spec: que una edición quede sin archivar por eso).
- Las propuestas de datasets nuevos (contrato v1.4): en cada edición Datito puede proponer hasta tres datasets para abrir en el portal, con la matriz de valor y riesgo de la Guía Práctica de Apertura de Datos del municipio.
  `propuestas_datasets` es opcional, como `repeticion`: sin la clave, la edición tiene la forma de la v1.3 y sigue valiendo, y `schema_version` sigue en '1.0'.
  El RPAD no la exige, a propósito: con `schema_version` en '1.0' no distingue una edición v1.4 de una v1.3, y exigirla rechazaría el plan B de Datito (mandar la edición con la v1.3); la exige el schema oficial v1.4, que Datito chequea antes de cada POST.
  Si está, es una lista de 0 a 3 objetos cerrados: con más, `propuestas_datasets` «Puede haber como mucho 3 propuestas de datasets.»; con null u otra cosa, «Tiene que ser una lista.».
- Cada propuesta de dataset: `numero`, su posición desde 1 («Las propuestas de datasets se numeran desde 1 y sin saltos.»);
  `titulo`, de 5 a 120 caracteres («Tiene que tener de 5 a 120 caracteres.»);
  `origenes`, de 1 a 4 («Tiene que traer de 1 a 4 orígenes.»), de 'Agenda', 'Noticias', 'Pedidos de acceso' y 'Cruce de datasets' («Los orígenes posibles son Agenda, Noticias, Pedidos de acceso y Cruce de datasets.»), sin repetidos («Este origen ya está en la propuesta.»);
  `justificacion`, de 20 a 600 («Tiene que tener de 20 a 600 caracteres.»);
  `datasets_relacionados`, hasta 5 («Puede traer hasta 5 datasets relacionados.»), cada uno `{ ckan_slug, nombre (200) }`, sin slugs repetidos («Este dataset ya está en la lista.», en el `ckan_slug` que repite);
  `ckan_slug` sigue la regla de los nombres de CKAN, que admite el guion bajo: «El slug tiene que tener de 2 a 100 caracteres: letras minúsculas sin tildes, números, - y _.» (también si llega vacío, con espacios o con el carácter nulo; si no es un texto, «Tiene que ser un texto.»);
  `valor` y `riesgo`, 'Alto', 'Medio' o 'Bajo' («El valor tiene que ser Alto, Medio o Bajo.» y «El riesgo tiene que ser Alto, Medio o Bajo.»);
  `formato_sugerido`, 'CSV', 'GeoJSON', 'JSON', 'KML' o 'XML' («El formato sugerido tiene que ser CSV, GeoJSON, JSON, KML o XML.»);
  `campos_sugeridos`, de 3 a 15 («Tiene que traer de 3 a 15 campos sugeridos.») textos de hasta 64 («Puede tener hasta 64 caracteres.»), sin repetidos («Este campo ya está en la lista.»);
  `anonimizacion`, null o un texto de hasta 1000 que, a diferencia de `nota_archivo`, no puede quedar vacío ni con solo espacios: la página y el mail nunca muestran una caja vacía;
  y `fuentes`, de 1 a 5 direcciones («Tiene que traer de 1 a 5 fuentes.»; una que no es `https://` da el mensaje de todas las direcciones), sin repetidas («Esta fuente ya está en la lista.»).
  Los mínimos de 5 y de 20 se miden sobre el texto tal como llegó, con los espacios de los extremos.
  Los repetidos se comparan exactos, después de los errores de la lista, y el error va en el que repite (el segundo, con su índice), solo si su valor no tiene ya su propio error.
  La cantidad y los repetidos se suman, como la cantidad y los elementos de toda lista: cinco orígenes con uno repetido dan los dos errores.
  Dos propuestas de datasets con el mismo `titulo`, sin mirar las mayúsculas ni los espacios de los extremos (las tildes sí cuentan), dan en la segunda `propuestas_datasets[N].titulo` «Hay dos propuestas de datasets con el mismo título.», después de los errores de todas.
- La coherencia de cada propuesta de dataset va después de sus errores, solo con un `valor` y un `riesgo` válidos, y da a lo sumo un error:
  valor 'Bajo' con riesgo 'Alto' no se propone: `propuestas_datasets[N].riesgo` «Un dataset de valor bajo y riesgo alto no se propone (matriz de priorización).», y la anonimización ya no se mira;
  si no, y solo si `anonimizacion` no tiene su propio error, riesgo 'Medio' o 'Alto' con null da `propuestas_datasets[N].anonimizacion` «Con riesgo Medio o Alto hace falta indicar la anonimización.», y riesgo 'Bajo' con un texto, «Con riesgo Bajo, anonimizacion va en null.».
  Datito escribió los mensajes de la v1.4 y los copia tal cual en su chequeo: no se cambian.
  Nada de esto consulta la base ni el portal: un slug que no existe no da 422 ni aviso.
- La foto del RPAD (`rpad_snapshot`): `estado`, uno de los de `GET /api/datasets` (`actualizado`, `proximo`, `atrasado`, `sin-respuesta`, `sin-fecha` o `eventual`) o null;
  `datos_al` y `ultima_actualizacion`, una fecha 'AAAA-MM-DD', un instante o null (un instante porque `GET /api/datasets` manda `ultima_actualizacion` así y el bot copia lo que ve);
  `updated_at`, un instante o null;
  y `dias_para_vencer`, un entero de −100000 a 100000 o null.
  El nombre, la dirección del portal y la foto se guardan como llegaron: el RPAD no los compara con lo de hoy ni los recalcula.
- Una dirección es un texto de hasta 2048 caracteres que empieza con `https://` y que `new URL` acepta.
  Un instante es `AAAA-MM-DDTHH:MM:SS`, de un año (sus cuatro primeras cifras) de 1900 en adelante, con hasta 9 decimales y `Z` o `±HH:MM` al final (la `T` y la `Z` en mayúscula), de un día que existe y que `Date.parse` entiende: así ninguno guardado puede romper después el detalle de una edición, que no se puede corregir.
  El año va desde 1900 porque antes no es un dato creíble para estas ediciones y porque un instante muy viejo se imprime roto: con la hora histórica de Argentina (−3:53:48 hasta 1894), el 01/01/1000 a las 00:00 UTC cae en el año 999, que `Intl` no completa con ceros.
  Una fecha `AAAA-MM-DD` no tiene ese mínimo: se imprime cortada como texto.
  Un instante con la hora `24:00:00` pasa, a la letra de la spec: la expresión no mira el rango de la hora y `Date.parse` lo lee como las 00:00 del día siguiente (otra hora 24, un minuto 60 o un segundo 60, no).
  No rompe el detalle, que lo muestra como esa hora pasada a Argentina.
- El manifiesto describe las partes que llegaron: `infografia_png` y `correo_texto` siempre, y `calculos` e `infografia_svg` si y solo si llegaron (`validarAdjuntos`).
  Cada entrada, `{ campo, nombre, mime, bytes, sha256 }`: `campo` sin repetidos;
  `nombre`, de 1 a 255 caracteres, sin `/`, `\` ni caracteres de control;
  `mime`, `image/png` en la infografía, `image/svg+xml` en el SVG, `text/plain` en el texto del correo y `text/markdown` o `text/plain` en los cálculos;
  `bytes`, el tamaño recibido;
  y `sha256`, el SHA-256 en minúsculas de los bytes recibidos.
- El contenido: la infografía es un PNG (`esPng`: la firma, un `IHDR` de 13 bytes al principio con ancho y alto de 1 a 4096, y el `IEND` al final; no se decodifica la imagen ni se miran los CRC), y el texto del correo y los cálculos son UTF-8 válido sin el carácter nulo (`esTextoUtf8`, `TextDecoder` con `fatal`).
  El SVG (`esSvg`) es UTF-8 válido sin el carácter nulo ni el BOM al principio, cuyo primer elemento es `<svg` (antes, como mucho, la declaración XML, comentarios y espacios), sin `<script`, `<foreignObject` ni el espacio de nombres XHTML, sin atributos `on…=`, sin `attributeName` que apunte a un `href` o un `on…`, sin `@import` y sin un `href=` o un `url(` que no empiece con `#`; se mira también con las entidades decodificadas.
  Es estricto a propósito: el RPAD nunca dibuja el SVG, pero lo adjunta a un mail y lo deja descargar, y sanearlo sumaría una librería.
  Por eso puede rechazar texto inocente (un «ONG = 5» o un «href=» escrito en un rótulo): el bot lo ve como un 422 en `infografia_svg` y lo arregla de su lado.
  No cubre los escapes de CSS ni `image-set(` ni `xml:base`, que ningún lector del RPAD usa.
- Los `errores` del 422, que el bot lee: cada uno `{ campo, mensaje }`, todos juntos y hasta 50 (`MAXIMO_DE_ERRORES`), con un mensaje fijo de `MENSAJES_VALIDACION` que no repite lo que llegó.
  Primero los de la forma, en el orden de la edición, y después los del manifiesto contra las partes: cada entrada y, al final, cada parte recibida.
  `campo` es la ruta (`titulo`, `propuestas[2].puntos_centrales`, `adjuntos[1].sha256`), con estas formas más:
  '' si la edición no es un objeto;
  la ruta del objeto que la trae, con «Trae una clave que no está en el formato de la edición.», si una clave de más no tiene forma de nombre (`CLAVE_NOMBRABLE`: así no se repite lo que llegó; si la tiene, va en su propia ruta);
  `propuestas` si no hay exactamente una 'Principal';
  el nombre de la parte (`infografia_png`, `infografia_svg`, `correo_texto` o `calculos`) si su contenido no es el que corresponde;
  y `adjuntos` si una parte llegó sin su entrada en el manifiesto (el mensaje nombra la parte).
- Un dataset que no existe no frena la edición: la propuesta se guarda sin enlace y el recibo trae un aviso.
  Una edición previa que no está o que no cita el dataset, tampoco: el recibo trae su aviso.

## La clave, la huella y el guardado

- La clave (`claveDeEdicion`): `dq:regular:AAAA-MM-DD` o `dq:piloto:AAAA-MM-DD:piloto-N` (los pilotos llevan su referencia porque hubo varios el mismo día).
  La base no admite dos ediciones con la misma clave (`UNIQUE`).
- La huella (`huellaDelPaquete`): el SHA-256 de un renglón por parte, en el orden fijo `metadata`, `infografia_png`, `correo_texto` y `calculos`, cada uno `<parte>:<SHA-256 de sus bytes>` (o `-` si no llegó) terminado en `\n`, y el renglón `infografia_svg` al final solo si llegó: sin SVG la huella es la de siempre y el reenvío de algo ya archivado sigue dando 200.
  Son los bytes y no el JSON interpretado: Datito congela el paquete de cada edición y su reenvío manda los mismos bytes.
  No depende del orden en que llegan las partes, y no usa RFC 8785 ni otra canonización, que sumaría una dependencia.
- El guardado (`guardarEdicion`, `services/datoQuincenaDatos.js`), en una sola transacción: la edición (`metadata` como texto, tal como llegó), sus propuestas (`filasDeLaEdicion`) y sus adjuntos con sus bytes.
  Lo decide el `UNIQUE` y no una consulta previa: una clave nueva da 201; si el `INSERT` de la edición choca (`ER_DUP_ENTRY`), se deshace y se lee la que estaba.
  Con la misma huella, 200 con el recibo de la primera vez (`repetida: true`), sin escribir nada; con otra, 409 «Ya hay una edición con la clave <clave> y otro contenido. No se cambió nada.», sin tocar nada (la clave sale de la edición ya validada, con su forma fija: repetirla no expone nada).
  Dos pedidos iguales a la vez dan 201 y 200; dos distintos, 201 y 409.
  `dataset_id` es el `rpad_id` solo si está en `datasets`, activo o no (una consulta dentro de la transacción); si no, null.
  Las tablas, en `docs/temas/base-de-datos.md`.
- El recibo (201 y 200, `reciboDe`): `{ id, clave, tipo, fecha_edicion, huella, recibida_at, repetida, adjuntos, url, avisos, envio }`.
  `recibida_at` es la llegada en Argentina con la zona (`AAAA-MM-DDTHH:MM:SS-03:00`), leída de la base después del `commit` (`UNIX_TIMESTAMP` + `ahoraArgentina`): así el 201 y el 200 dicen lo mismo.
  `adjuntos` va en el orden infografía, texto, cálculos y SVG, cada uno `{ campo, bytes, sha256 }`; `url` es `<RPAD_URL>/dato-quincena.html?id=N` (de `APP_URL`).
  `avisos`, por cada propuesta en su orden, primero el de su dataset y después el de su repetición; el 200 los arma de nuevo desde lo guardado.
  El del dataset, si cita un `rpad_id` que no está en el RPAD: «La propuesta N cita el dataset X, que no está en el RPAD: se guardó sin enlace.».
  El de la repetición (una `repeticion` objeto; F, la fecha en dd/mm/aaaa), el primero que valga: con F igual o posterior a la edición, «La propuesta N repite la edición del F, que no es anterior a esta: se guardó sin enlace.»;
  sin una edición regular de esa fecha en el RPAD, «La propuesta N repite la edición del F, que no está en el RPAD: se guardó sin enlace.»;
  y, con el alcance `dataset`, un `rpad_id` y una edición de esa fecha que no lo cita, «La propuesta N repite el dataset X de la edición del F, pero esa edición no lo tiene.».
  Las ediciones previas las lee `edicionesPreviasSinFallar(fechasPrevias(edicion))` después de guardar, con una consulta (`docs/temas/dato-quincena.md`, «Las lecturas»).
  Si esa lectura falla, el recibo sale igual (201 o 200) sin los avisos de la repetición y con los del dataset: un aviso que depende de lo archivado podría ser falso, y la edición ya está guardada.
  `envio`, `{ estado, programado_at, texto }`, es el envío del RPAD en ese momento (`envioDelRecibo`): `programado_at` es la corrida en que sale, con zona (`2026-11-24T08:05:00-03:00`), solo si está programada; `texto` dice cuándo se envía o por qué no.
  Un piloto: `estado: 'piloto'` y «Los pilotos no se envían por correo.».
  Un 200 lo arma con el estado de ese momento; una regular archivada antes del correo (sin fila de envío) da `envio: null`.
  Los estados y los textos, en `docs/temas/dato-quincena-correo.md`.

## El token y el interruptor

- En el servidor, una sola variable de entorno, `DATO_QUINCENA_TOKEN_SHA256`: el SHA-256 del token en hexadecimal (64 caracteres, en minúsculas o mayúsculas), nunca el token.
  Se lee en cada pedido (`estadoDelToken`, puro): sin ella o mal formada, la recepción está apagada y el POST da 503 «La recepción del dato de la quincena no está habilitada.», aun con el token.
  Con ella, el pedido trae `Authorization: Bearer <token>`: el SHA-256 de lo que sigue a `Bearer ` (de 1 a 512 caracteres) se compara con la huella con `crypto.timingSafeEqual`, sobre dos buffers de 32 bytes; si falta o no coincide, 401 «Falta el token del dato de la quincena o no es válido.».
  El token no es un JWT ni una cuenta, no usa `JWT_SECRET` ni `CRON_SECRET` y solo sirve para este POST.
  `.env.example` trae la variable vacía; ningún token ni huella real entra al repositorio.
- Cómo se genera, en la Mac del usuario: el token queda en el portapapeles, para pegarlo en Datito (en su campo de secretos, `RPAD_API_TOKEN`) antes de copiar otra cosa, y en la pantalla sale solo la huella.

  ```bash
  TOKEN=$(openssl rand -hex 32); printf %s "$TOKEN" | pbcopy; printf %s "$TOKEN" | shasum -a 256 | cut -d' ' -f1; unset TOKEN
  ```

  La huella se carga en Setup Node.js App, con Restart; nadie más ve el token: ni el chat, ni el repositorio, ni el kit.
- Para apagar la recepción: borrar la variable y Restart (lo guardado queda).
  Para cambiar el token: repetir lo mismo de los dos lados.
  Sin rotación automática ni botón en la página (decisión del usuario).

## Archivos de tests

`dato-quincena-reglas.test.js`, `dato-quincena-api.test.js`, `dato-quincena-resguardo.test.js` (el mail de una edición sin `propuestas_datasets`: el fixture, que no se regenera, con exactamente dos inserciones, la frase y el recuadro de la principal del equipo), `permisos.test.js`, `schema.test.js`
