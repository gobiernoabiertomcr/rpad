# El dato de la quincena

El archivo interno y de solo lectura de las ediciones que manda Datito cada dos lunes: su POST con un token propio, la clave y la huella, las lecturas y la página.
El correo que el RPAD manda con cada edición, su lista, Reenviar y la prueba están en `docs/temas/dato-quincena-correo.md`.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-11-07-dato-quincena-design.md`
- `docs/superpowers/specs/2026-11-12-dato-quincena-correo-design.md`
- `docs/superpowers/specs/2026-11-14-dato-quincena-v1-3-design.md` (el contrato v1.3: Repite y Efemeride)

## Archivos

datoQuincenaController: el POST de Datito (`recibirEdicion`) y las lecturas (`listar`, `ver` y `descargar`);
datoQuincenaReglas (puro: los topes, la validación de la edición y del manifiesto, la clave, la huella del paquete, el token, `esPng`, `esSvg`, `esTextoUtf8`, `NOMBRE_DEL_BOT`, los textos de la lista y del detalle, la foto del RPAD, lo que se copia, las filas que se guardan, `fechasPrevias`, los avisos y el recibo);
datoQuincenaDatos (las consultas, la transacción del guardado y `leerEdicionesPrevias`);
dato-quincena.html # El dato de la quincena: la lista de un año en tarjetas, el detalle ?id=N y la pestaña Correo (dato-quincena.js)

## El archivo

- Qué es:
  Herramientas → El dato de la quincena, el archivo de las ediciones que arma Datito, un agente externo: hasta cinco propuestas de comunicación con su infografía, el texto de su correo y su nota de cálculos.
  Datito manda cada edición con un POST y un token propio, apenas está lista: el RPAD nunca lo llama.
  El mail al equipo lo manda el RPAD (`docs/temas/dato-quincena-correo.md`); el de Datito es una copia para el usuario.
  `correo` del JSON habla de esa copia: con `no_enviado` el bot manda la edición igual (decisión del usuario: el archivo no depende del mail).
  Las ediciones anteriores a la activación las manda después, con su fecha original.
  Guardar una edición no la aprueba ni la publica: son propuestas internas, con sus marcas de «Validar».
  Inmutable (decisión del usuario): nadie edita ni borra una edición desde el RPAD, y la misma clave con otro contenido se rechaza; un caso raro se arregla con un SQL a mano.
  No toca ningún dataset ni cuenta como una actualización.
  La edición no cambia nunca; el estado de su envío vive en otras tablas.
- Quién: la ven entera todos los roles con sesión, también el saludo del texto del correo (decisión del usuario: quien valida y trabaja las propuestas puede tener cualquier rol); ninguna sesión escribe: solo el POST de Datito.
  El correo (la lista, los destinatarios, el estado por persona) lo ve solo administración.
- Lo que no se guarda: el HTML del correo, los CSV o XLSX fuente (alcanzan los cálculos y las direcciones de las fuentes), los destinatarios y los encabezados del mail.
  El RPAD no descarga nada de las direcciones de una edición: las guarda y las muestra como enlaces.
  El SVG de la infografía sí se guarda (parte opcional), pero nunca se dibuja ni se sanea: se descarga y se adjunta al mail, y por eso `esSvg` es estricto (abajo).
- Las ediciones traen nombres reales y cifras de producción: van solo a la base de producción.
  Los tests usan datos inventados (`tests/dato-quincena-fixtures.js`, con un PNG chico armado byte a byte, y `tests/fixtures/dato-quincena-respuestas.json`), y el paquete de Datito nunca entra al repositorio.

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
  y `adjuntos`, el manifiesto, de 2 a 4 entradas.
  En una regular, `generado_at` es obligatorio y también `enviado_at` si el correo salió; en un piloto pueden ser null.
  Con `no_enviado`, `enviado_at` con algo que no es null da 422 «Con el correo no enviado, la hora del correo va null.».
  Con un estado que no vale, `enviado_at` puede ser null o un instante: el único error es el del estado, para no pedirle al bot una hora que quizá no existe.
- `nota_archivo` puede llegar vacía o con solo espacios (solo los textos obligatorios no pueden), y el detalle la da como null.
  `ckan_slug`, como todo texto que admite null, también puede llegar vacío.
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
  Las ediciones previas las lee `edicionesPreviasSinFallar(fechasPrevias(edicion))` después de guardar, con una consulta (abajo, «Las lecturas»).
  Si esa lectura falla, el recibo sale igual (201 o 200) sin los avisos de la repetición y con los del dataset: un aviso que depende de lo archivado podría ser falso, y la edición ya está guardada.
  `envio`, `{ estado, programado_at, texto }`, es el envío del RPAD en ese momento (`envioDelRecibo`): `programado_at` es la corrida en que sale, con zona (`2026-11-24T08:05:00-03:00`), solo si está programada; `texto` dice cuándo se envía o por qué no.
  Un piloto: `estado: 'piloto'` y «Los pilotos no se envían por correo.».
  Un 200 lo arma con el estado de ese momento; una regular archivada antes del correo (sin fila de envío) da `envio: null`.
  Los estados y los textos, en `docs/temas/dato-quincena-correo.md`.

## Las lecturas

- Con `authMiddleware` y sin `adminOnly`, como las lecturas de Proyectos: cualquier rol con sesión (sin sesión, 401); el token del bot no es un JWT y acá no sirve.
  Un id que no pasa `idPositivo` o que no existe da 404 «No existe esa edición.».
  Si falla la base, 500 con un mensaje fijo por operación («Error al obtener las ediciones», «Error al obtener la edición» y «Error al descargar el archivo») y, en la consola, ese mensaje con el `code` y el `message` del error.
- `GET /api/dato-quincena/ediciones?anio=AAAA`, la lista: `{ anios, anio, ediciones }`.
  `anios`, cada año con ediciones y su `cantidad`, del más nuevo al más viejo; `anio`, el pedido o, sin él, el más reciente con ediciones (null con el archivo vacío); un año sin ediciones da `ediciones` vacía.
  Un `anio` que no son cuatro cifras de 2000 a 2100 (también uno repetido en la query) da 400 «El año no es válido.».
  `ediciones`, por `fecha_edicion` descendente y, en el mismo día, por `id` descendente, cada una `{ id, fecha_texto, marca, principal, resto, numero, fecha_partes, cantidad, envio }`: «Lunes 2 de noviembre de 2026»;
  «Piloto N» o null;
  el `titulo` y la `cifra_clave` de la principal;
  «Y 2 propuestas más: A y B.», con el nombre del dataset de las demás en su orden, o null;
  `numero`, «N.º 3» en una regular (cuántas regulares hay con esa fecha o anterior, calculado al leer: si una de fecha anterior llega después, los siguientes corren) y null en un piloto;
  `fecha_partes`, `{ dia: 'Lunes', fecha: '9 de noviembre', anio: 'de 2026' }`;
  `cantidad`, «4 propuestas»;
  y `envio`, `{ tipo, texto }`, la pastilla del envío (null si no lleva), con el texto de administración si quien pide lo es (`docs/temas/dato-quincena-correo.md`).
  La lista no trae las infografías ni ninguna dirección de correo.
- `GET /api/dato-quincena/ediciones/:id`, el detalle, con los textos ya armados (`detalleDeLaEdicion`): `{ id, fecha_texto, marca, numero, titulo, nota_archivo, llegada, correo, cantidad, agenda, propuestas, archivos }`.
  `llegada`, «Llegó al RPAD el dd/mm/aaaa a las HH:MM.», de `recibida_at`;
  `correo`, la línea del envío del RPAD (`docs/temas/dato-quincena-correo.md`);
  en una edición sin envío (archivada antes del correo), la de Datito: «Correo enviado el dd/mm/aaaa a las HH:MM, según Datito.» con la hora pasada a Argentina sea cual sea la zona del bot, «Correo enviado según Datito, sin la hora.» o «Datito archivó esta edición sin que saliera el correo.», que sigue siendo cierto si el correo sale después: la edición no cambia y Datito no la vuelve a mandar (sería un 409);
  `cantidad`, «1 propuesta» o «5 propuestas»;
  `agenda`, cada evento `{ fecha_texto, titulo, detalle, url, etiqueta }`, con la fecha dd/mm/aaaa y `etiqueta` «Efeméride» (de `tipo: 'efemeride'`) o null.
  Cada propuesta: `orden_texto` («Propuesta 1»), `etiquetas`, `principal`, sus textos tal como llegaron, `dataset` (`{ nombre, id_enlace, url }`, con `id_enlace` el id solo si el dataset existe y está activo), `foto`, `repeticion` (después de la foto), `para_copiar` y `borrador_para_copiar`.
  `etiquetas` son las para mostrar: 'Efemeride' es «Efeméride» y las demás quedan igual; `principal` mira el valor del JSON.
  `repeticion` es null (sin la clave o con null) o `{ texto, motivo, id_edicion }`: «Repite el dataset de la edición del dd/mm/aaaa.» o «Repite el tema de la edición del dd/mm/aaaa.»;
  «Datos nuevos: <detalle>» o «Hecho actual: <detalle>», con el detalle tal como llegó;
  e `id_edicion`, el id de la regular de esa fecha si existe y es anterior a la edición, o null (no depende de que cite el dataset: eso solo da el aviso).
- Las ediciones previas (`leerEdicionesPrevias`, de las fechas de `fechasPrevias`: las de las repeticiones anteriores a la edición, sin repetir): una consulta con `tipo = 'regular' AND fecha_edicion IN (?)`, y un `Map` de la fecha a `{ id, rpad_ids }`, con los `rpad_id` que citan sus propuestas en su `metadata`.
  Se mira lo que el bot citó y no el enlace que quedó guardado; sin fechas, no consulta.
  La leen el recibo, `ver` y el mail (`docs/temas/dato-quincena-correo.md`); sin columnas nuevas ni migración: todo sale de `metadata`, que ya se guarda entera.
  La llaman a través de `edicionesPreviasSinFallar`, que nunca tira: si la consulta falla, deja en la consola «Dato de la quincena: no se pudieron leer las ediciones previas» con el código del error (el mensaje de la base puede traer las fechas) y da null; el detalle y el mail salen con la repetición sin enlace.
- `archivos`, cada uno `{ campo, rotulo, nombre, detalle, se_puede_ver }`, en este orden: «Infografía» («PNG · 97 KB»), «Texto del correo», «Cálculos» si llegaron, «Infografía editable» (el SVG, «SVG · 84 KB», si llegó) y «La edición completa» (`metadata`, «JSON · 24 KB»).
  `nombre` es el del manifiesto y, en la edición completa, `dato-quincena-<la clave sin dq:, con - en lugar de :>.json`: la página guarda con él, porque `API.pedirArchivo` no da el `Content-Disposition`.
  El tamaño va en KB hacia arriba y, desde 1 MB, en MB con un decimal y coma, también hacia arriba («1,5 MB»); `se_puede_ver` es true en el texto y los cálculos (el SVG se descarga y no se ve: la página no lo dibuja).
- La foto del RPAD de ese día (`fotoDelDataset`), filas `{ rotulo, valor }`: «En el RPAD ese día:» con «Actualizado», «Próximo a vencer», «Vencido», «Sin fecha», «Eventual» o «Sin dato»;
  «Datos al» y «Última actualización», el día en Argentina (dd/mm/aaaa) o «—»;
  y, si vino `dias_para_vencer`, «Próxima en» (0 o más) o «Venció hace» (negativo), con «N días» o «1 día».
  `atrasado` y `sin-respuesta` dicen los dos «Vencido»: `CLAUDE.md` pide lenguaje neutro en lo nuevo (el sitio público todavía muestra otro rótulo para el segundo).
- Lo que se copia (`textoParaCopiar`): la propuesta entera en texto plano, en bloques separados por un renglón en blanco y con los textos tal como llegaron.
  El título con sus etiquetas para mostrar entre corchetes (sin etiquetas, solo), la cifra, «Dataset: <nombre>» con la dirección del portal, la foto en un renglón (cada fila como «<rotulo> <valor>.», separadas por un espacio), la repetición si hay («<texto>\n<motivo>»), «Para validar antes de publicar» si hay notas, y cada campo de la propuesta completa con su título, como el ejemplo de la sección 9 de la spec.
  `borrador_para_copiar` es el título del borrador y sus párrafos, separados por un renglón en blanco.
- `GET /api/dato-quincena/ediciones/:id/archivos/:campo`, la descarga de `infografia_png`, `infografia_svg`, `correo_texto`, `calculos` o `metadata`: los bytes guardados, con un `Content-Type` fijo por campo y no el MIME del manifiesto (`TIPO_DE_DESCARGA`: `image/png`, `image/svg+xml`, `text/plain; charset=utf-8` en el texto y los cálculos, `application/json; charset=utf-8` en la edición) y un `Content-Disposition` de adjunto (`disposicionDeAdjunto`) con el `nombre` del detalle.
  El `no-store` y el `nosniff` los ponen `app.js` y Helmet.
  En una edición que existe, otro `campo`, unos cálculos o un SVG que no llegaron dan 404 «El archivo no existe.».
  Solo la descarga lee los bytes (`contenido`): la lista y el detalle nunca los traen.
- `tests/fixtures/dato-quincena-respuestas.json`, inventado, es el contrato entre el servidor y la página (`detalle_con_repeticion`, una edición con repeticiones, con y sin enlace): `tests/dato-quincena-reglas.test.js` le compara lo que arman las reglas, con las claves en su orden;
  `tests/dato-quincena-api.test.js`, la forma de las respuestas reales;
  y `tests/dato-quincena-frontend.test.js` dibuja la página con él y controla sus claves.
  Una clave que cambia en el servidor obliga a cambiar el fixture.

## La página: dato-quincena.js

- Herramientas → El dato de la quincena: `dato-quincena.html` (con la carcasa, `main.css` y su `<style>` con los tokens `--sg-*` de Proyectos y las clases `dq-`; sin `publico.css` ni `aria-current`) y `js/dato-quincena.js`, como la maqueta aprobada.
  El título, con el `newspaper` de Lucide, y la bajada: «Las propuestas de comunicación que arma Datito cada dos lunes, tal como llegaron. Son internas: guardarlas acá no las aprueba ni las publica. El RPAD las manda por correo a las personas de la lista.».
  El nombre sale de una constante de la página (`NOMBRE_DEL_BOT`) y de la del servidor, porque es provisorio; el HTML no lo repite.
  Administración ve además dos pestañas, «Ediciones» y «Correo» (`docs/temas/dato-quincena-correo.md`); los demás roles, la página sin pestañas.
  Sin sesión, al login; cualquier rol con sesión ve la página entera.
- La lista (sin `?id=`; `?anio=AAAA` elige el año): los años como botones con su cantidad (`aria-pressed`), solo si hay más de uno, la cantidad del año («Ediciones de 2026: 27») y las tarjetas «tipo diario» de a tres (dos debajo de 960 px, una debajo de 560 px), con páginas de a 18.
  Cada tarjeta lleva «El dato de la quincena» y el N.º (o la marca «Piloto N») con una doble línea, el día, la fecha grande y el año, la cantidad de propuestas, el título de la principal (hasta tres renglones) y la pastilla del envío.
  Un solo enlace, en la fecha, se estira a toda la tarjeta; no hay miniaturas.
  Las páginas: «Anterior», «Página 1 de 2» con «Mostrando 1–18 de 27» y «Siguiente»; con una sola, nada.
  El año y la página elegidos quedan en la dirección (`?anio=AAAA&pagina=N`, con `history.replaceState`); al cambiar de año, la página 1; uno pedido sin ediciones, con otros que sí tienen, vuelve a la lista sola.
- El detalle (`?id=N`): «Todas las ediciones», la fecha grande con el N.º o la marca, el título, la llegada, el correo y la cantidad (el punto después de la cantidad lo pone la página) y, si hay, «Nota de Datito:» con la nota.
  A un costado (fijo al bajar, salvo en una pantalla angosta, donde va arriba, o en una pantalla baja), la infografía y «Archivos», con «Descargar» en cada uno y «Ver» en el texto y los cálculos; al otro, «Agenda de la quincena» (si hay) y «Las propuestas».
- Cada propuesta: su número, sus etiquetas («Principal» en tinta, «Agenda» en cielo, «Validar» en sol con el `triangle-alert` y «Repite» en blanco con un borde por dentro y el `history`; «Efeméride», el estilo neutro de `.dq-etiqueta`: nunca solo el color), el título, la cifra, «Dataset:» (con enlace a `dataset.html?id=N` solo con `id_enlace`) y «en el portal», la foto del RPAD y, si hay, la repetición y «Para validar antes de publicar», siempre a la vista.
  La repetición (`.dq-repite`, neutra, con los márgenes de `.dq-validar`): el `history`, alineado con el primer renglón, y el `texto` en negrita, como enlace a `dato-quincena.html?id=<id_edicion>` solo si `idDeEdicion` lo acepta, y abajo el `motivo`.
  El enlace va subrayado: `main.css` le saca el subrayado a todo `<a>` y el texto ya es negrita y tinta, así que sin él no se distinguiría del texto sin enlace.
  Después, en un `<details>` («La propuesta completa», abierto en la principal; «Ver la propuesta completa», cerrado en las otras), los campos en el orden de lo que se copia, y al pie, «Copiar la propuesta».
  La principal lleva el borde de tinta más grueso.
- «Copiar», tres por propuesta, con el texto tal como llega del servidor: en el texto para redes (`texto_redes`), en el borrador (`borrador_para_copiar`) y al pie (`para_copiar`).
  Sus nombres (`aria-label`) dicen qué copian y contienen el texto que se ve, para quien maneja la página con la voz (WCAG 2.5.3): «Copiar el texto para redes», «Copiar el borrador» y «Copiar la propuesta (Propuesta N)».
  Con `navigator.clipboard.writeText`: el botón dice «Copiado» dos segundos; si falla, «No se pudo copiar: seleccioná el texto.» cinco segundos; los dos se anuncian en `#dq-anuncio`, la región viva que no se redibuja.
- «Ver» abre `#dq-modal` con el texto en un `<pre>` puesto con `textContent` y su «Descargar», que baja lo mismo sin volver a pedirlo; se cierra con la ×, «Cerrar», Escape o un clic que empieza en el velo, y el foco vuelve al botón.
  Las imágenes y los archivos se piden con `API.pedirArchivo` (el JWT en el encabezado, nunca en la dirección): una imagen va en un `<img>` desde un `blob:`, liberado al cambiar de año y al salir (no si la página queda guardada para «Atrás»), y «Descargar» guarda con el `nombre` del servidor.
- Los estados: «Cargando…», el error («No se pudieron cargar las ediciones. Probá de nuevo en unos minutos.»), el vacío («Todavía no llegó ninguna edición. Datito manda cada una cada dos lunes.») y una edición que no existe («No existe esa edición.» con «Todas las ediciones»; un `id` que no es un entero positivo lo dice sin pedirlo).
  Si falla «Descargar» o «Ver», un aviso: «No se pudo descargar el archivo. Probá de nuevo en unos minutos.» o «No se pudo abrir el archivo. Probá de nuevo en unos minutos.».
  Una infografía que no llega deja su lugar vacío, sin aviso.
  Un 401 cierra la sesión y va al login; con `API.pedirArchivo`, que no da el estado, si `Auth.isTokenExpired()`.
  Una respuesta que llega después de otra más nueva se descarta.
- Las convenciones de siempre: al cargarse, el script solo declara y engancha `DOMContentLoaded`; lo que arma HTML es puro y recibe los datos por parámetro (`tests/dato-quincena-frontend.test.js` lo carga en un `vm` después del `main.js` y el `api.js` de verdad); lo que toca el DOM o la API va al final, con los eventos delegados en `#dq-contenido` y en el modal.
  La página no recalcula nada: imprime los textos del servidor, todos por `Utils.escapeHtml` (también en `data-`, `alt` y `aria-label`), y un número con `String`.
  Una dirección de afuera solo es un enlace si empieza con `https://`, con `rel="noopener noreferrer"`.
- El menú: «El dato de la quincena» va al final de Herramientas, después de Seguimiento, en las 15 páginas con carcasa, con el `newspaper` de Lucide escrito en el HTML, el mismo del título: no está en `ICON_SELECTOR_MAP`, donde aparecería como ícono elegible en Proyectos, ni en `Icons` (tocar `main.js` sube `VERSION` en todas las páginas).
  Lo ve cualquier sesión: `updateSidebarAuth` ya muestra Herramientas con sesión.
  La ayuda del lector en Configuración (`AYUDA_DEL_ROL` de `usuarios.js`) lo nombra entre sus Herramientas.
- `dato-quincena.js` lleva su propia constante, `VERSION_DATO_QUINCENA` (`tests/paginas.test.js`).

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

## Lo que no cambia

- Datasets, la doble verificación, los cambios pendientes, el historial de actualizaciones, los hitos y Proyectos (sus subidas incluidas), Métricas y la foto del 31/12, las Tareas Cron, la CSP y las dependencias.
  Salvo el paso del correo en las corridas de las 8:05 y las 14:00 y su línea y sus alertas en Correos → Estado (`docs/temas/dato-quincena-correo.md`).
  La copia del mail que se manda Datito es suya: el RPAD no la manda ni la lee.
  El mail al equipo, su lista y su corrida sí son del RPAD, y están en `docs/temas/dato-quincena-correo.md`.
- El enlace desde cada dataset queda para otra etapa: `dato_quincena_propuestas` ya tiene el `dataset_id` con su índice.

## Archivos de tests

`dato-quincena-reglas.test.js`, `dato-quincena-api.test.js`, `dato-quincena-frontend.test.js` (los del correo, en su documento), `permisos.test.js`, `paginas.test.js`, `schema.test.js`, `usuarios-frontend.test.js`
