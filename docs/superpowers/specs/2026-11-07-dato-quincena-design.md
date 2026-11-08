# El dato de la quincena: el archivo de las ediciones de Grok Bot

Fecha: 07/11/2026. Decisiones del usuario del 07/11/2026, con AskUserQuestion, mirando una maqueta con la carcasa real y los datos del piloto 4, fuera del repo.
Partió de una propuesta técnica que armó Grok Bot (fuera del repo): se tomó como propuesta, no como contrato.
El usuario aprobó esta spec y su plan el 07/11/2026, por escrito; el código espera el turno que da la sesión coordinadora.
Los ejemplos de acá son inventados.
Lo que se ve y los contratos van acá.

## 1. Por qué

Grok Bot es un agente externo que, cada dos lunes desde el 09/11/2026, revisa el portal de datos abiertos y el RPAD, arma hasta cinco propuestas de comunicación con una infografía y se las manda por mail a la Dirección.
El usuario quiere que cada edición también quede guardada en el RPAD, para tener el historial.
El bot no recibe conexiones: la integración la inicia él, con un POST y un token propio, después de confirmar que su mail salió.

## 2. Decisiones del usuario

1. **Qué se guarda:** el JSON de la edición (con las propuestas), el PNG de la infografía, el texto plano del correo y la nota de cálculos.
   El HTML del correo y el SVG de la infografía no, en esta etapa: no se suma ninguna librería para sanearlos.
2. **Quién lo ve:** todos los roles con sesión, como Proyectos. La persona que valida y trabaja las propuestas puede tener cualquier rol, y necesita leerlas y copiarlas. Nadie edita ni borra.
3. **Dónde:** una página propia, al final de Herramientas, después de Seguimiento. El enlace desde cada dataset queda para otra etapa.
4. **Pilotos:** el archivo acepta ediciones «piloto» con su marca. De los que hubo, solo entra el piloto 4 (los anteriores fueron ajustes).
5. **Ediciones anteriores a la activación:** si el archivo se activa después de una edición, el bot la manda después, con su fecha original.
6. **Los archivos van en la base,** como el PDF de las Notas Digitales y la imagen de la firma: se respaldan con el Exportar de siempre y una edición nunca queda a medias.
7. **Inmutable:** nadie edita ni borra una edición desde el RPAD; la misma clave con otro contenido se rechaza. Un caso raro se arregla con un SQL a mano.
8. **No se guardan los CSV o XLSX fuente:** alcanzan los cálculos y las direcciones de las fuentes.
9. **El interruptor es la huella en cPanel:** sin ella, el RPAD no acepta ediciones. Sin botón en la página.
10. **El token lo genera el usuario en su computadora** y lo carga él en Grok Bot; en cPanel va solo su huella. Sin rotación automática.
11. **La página, como la maqueta:** la lista con la infografía en miniatura; el detalle con la infografía y los archivos a un costado, la agenda y las propuestas al otro, la principal abierta y las validaciones siempre a la vista.
    Con «Copiar» en el texto para redes, en el borrador de nota y en la propuesta entera, y sin casilla para ocultar los pilotos.
12. **Primera prueba real:** el piloto 4, en producción. Después, un piloto 5 que recorre la rutina nueva del bot de punta a punta.
13. **El bot congela el paquete** de cada edición desde el 09/11 (lo autorizó el usuario): el reenvío manda los mismos bytes.

## 3. Qué es y qué no

Un archivo interno y de solo lectura de las ediciones de «El dato de la quincena», para todos los roles con sesión.
Guardar una edición no la aprueba ni la publica: son propuestas internas, con sus marcas de «Validar».
No toca datasets, cambios pendientes, historial de actualizaciones, notificaciones, hitos ni Métricas, no corre ningún cron y no manda mails.
No cuenta como actualización de ningún dataset.

## 4. El pedido del bot

`POST /api/dato-quincena/ediciones`, con `Authorization: Bearer <token>` y un `multipart/form-data` de estas partes, todas como archivo (con `filename`), sin otras:

| Parte | Qué es | Obligatoria | Tope |
|---|---|---|---:|
| `metadata` | el JSON de la edición (sección 5), en UTF-8 | sí | 256 KB |
| `infografia_png` | la infografía de la propuesta principal | sí | 5 MB |
| `correo_texto` | el texto plano del correo | sí | 256 KB |
| `calculos` | la nota de cálculos | no | 256 KB |

`metadata` va como archivo y no como campo de texto: un campo llega a multer ya decodificado (busboy cambia lo inválido por U+FFFD sin avisar y nombres como `metadata[x]` se vuelven objetos), y así no habría bytes exactos para la huella ni forma de rechazar un UTF-8 roto.

El orden de los controles, cada uno antes del siguiente:
1. El límite de pedidos (`limiteDatoQuincena`, `middleware/rateLimit.js`): 20 por hora por IP, todos los pedidos; el 21 es 429, con `Retry-After` en segundos (`standardHeaders: 'draft-8'`; la ventana es fija, así que puede ser menos de una hora).
2. El interruptor y el token (`tokenDelDatoQuincena`, `middleware/auth.js`): sin la huella configurada, 503; sin el token o con uno que no corresponde, 401 (sección 12).
3. Que sea un multipart (`req.is('multipart/form-data')`); si no, 400. Un cuerpo JSON o de formulario ya lo leyeron los lectores globales de `app.js` (hasta 1 MB) y no se usa.
4. La lectura (`subidaDelDatoQuincena`, `config/upload.js`): multer en memoria con `limits: { fields: 0, files: 4, parts: 4, fileSize: 5 MB, fieldNameSize: 100 }` y un filtro que descarta, sin guardarla, una parte con otro nombre o repetida.
   Después de leer, `metadata`, `correo_texto` y `calculos` se miden contra sus 256 KB.
   Un pedido que no se puede leer, un campo de texto, una parte de más, repetida, con otro nombre, o que falta (`metadata`, `infografia_png` o `correo_texto`) es 400; una que pasa su tope, 413 (tabla de la sección 7).
5. El JSON: `JSON.parse` de `metadata` y `motivoDeRechazo` de `middleware/cuerpo.js` (las claves reservadas y la profundidad, que `datosComunes` no ve en un multipart). Si no se puede usar, 400.
6. La validación de la edición (sección 5): 422 con la lista de errores.
7. El guardado (sección 8): 201, o 200 si ya estaba igual, o 409 si la clave ya tiene otro contenido.

El encabezado `Idempotency-Key`, si llega, no se lee: la clave sale del JSON (sección 6).
Una edición real pesa unos 150 KB; los topes son un techo.

**Las respuestas antes de leer** (429, 401, 503, y los 400 y 413 de la lectura) se dan como las subidas de Proyectos (`responderAlTerminarDeLeer`): se termina de leer el pedido y se responde, así quien todavía mandaba recibe la respuesta y no un corte.
El 429 lleva un `handler` propio para eso.
Para no leer sin fin lo que manda un desconocido: si el pedido no trae `Content-Length` o trae más de 6 MB (`TOPE_DEL_PEDIDO`, la suma de los topes más el margen del multipart), esas respuestas van enseguida, con `Connection: close`, sin leer el resto.

## 5. La edición

El JSON v1 de Grok Bot, sin el HTML ni el SVG.
Todo objeto es cerrado: una clave que no está acá es un error, y una que falta, también. Todas las claves van siempre, aunque su valor sea null (por ejemplo `generado_at` en un piloto).
Los largos se cuentan con `Array.from`, como el resto del servidor, y un texto obligatorio no puede quedar vacío ni con solo espacios.
Un texto no lleva el carácter nulo.

**La edición:**

| Clave | Valor |
|---|---|
| `schema_version` | `'1.0'` |
| `agente` | `'dato-de-la-quincena'` |
| `fecha_edicion` | `'AAAA-MM-DD'`, un día que existe, desde el 01/11/2026 hasta mañana en Argentina (`hoy` llega por parámetro) |
| `tipo` | `'regular'` o `'piloto'` |
| `referencia_piloto` | null en una regular; en un piloto, `piloto-N` (N de 1 a 999, sin ceros a la izquierda) |
| `titulo` | texto, hasta 200 |
| `generado_at` | instante RFC 3339 con zona (`Z` o `±HH:MM`), o null; obligatorio en una regular |
| `correo` | `{ estado: 'enviado', enviado_at }`, con `enviado_at` instante o null; obligatorio en una regular |
| `nota_archivo` | texto hasta 4000, o null |
| `agenda` | lista de 0 a 20 `{ titulo (200), fecha ('AAAA-MM-DD'), detalle (4000), url }` |
| `propuestas` | lista de 1 a 5 (abajo) |
| `adjuntos` | el manifiesto: lista de 2 o 3 `{ campo, nombre, mime, bytes, sha256 }` (abajo) |

**Cada propuesta:**

| Clave | Valor |
|---|---|
| `orden` | entero; las propuestas van 1, 2, 3… en ese orden, sin saltos |
| `titulo` | texto, hasta 200 |
| `etiquetas` | lista sin repetidos de `'Principal'`, `'Validar'` y `'Agenda'`; exactamente una propuesta de la edición lleva `'Principal'` |
| `dataset` | `{ rpad_id, ckan_slug, nombre (200), url }`, con `rpad_id` entero positivo o null y `ckan_slug` texto hasta 200 o null |
| `rpad_snapshot` | `{ estado, datos_al, ultima_actualizacion, updated_at, dias_para_vencer }`: el estado de `GET /api/datasets` (`actualizado`, `proximo`, `atrasado`, `sin-respuesta`, `sin-fecha`, `eventual`) o null; `datos_al` y `ultima_actualizacion`, cada una una fecha `'AAAA-MM-DD'`, un instante o null; `updated_at`, un instante o null; y `dias_para_vencer`, un entero (de −100000 a 100000) o null |
| `cifra_clave` | texto, hasta 1000 |
| `calculo`, `contexto_historico` | texto, hasta 20000 |
| `por_que_hoy`, `angulo`, `idea_placa`, `texto_redes` | texto, hasta 10000 |
| `puntos_centrales` | lista de 3 a 5 textos de hasta 2000 |
| `borrador_nota` | `{ titulo (200), parrafos }`, con 2 o 3 párrafos de hasta 10000 |
| `notas_validacion` | lista de 0 a 20 textos de hasta 10000 |
| `fuentes` | lista de 1 a 20 direcciones |

Una dirección es un texto de hasta 2048 que empieza con `https://` y que `new URL` acepta.
Un instante es `AAAA-MM-DDTHH:MM:SS`, con fracción opcional de hasta 9 cifras y `Z` o `±HH:MM` al final (la `T` y la `Z` en mayúscula), de un día que existe y que `Date.parse` entiende (un segundo 60 no): así ninguno guardado puede romper después el detalle de una edición, que no se puede corregir.

`datos_al` y `ultima_actualizacion` aceptan también un instante porque `GET /api/datasets` manda `ultima_actualizacion` así (`2026-06-03T03:00:00.000Z`: la columna DATE leída por mysql2 sin `dateStrings`, `controllers/datasetController.js`), y el bot copia lo que ve.
Se guardan como llegaron y se muestran como el día en Argentina (`ahoraArgentina(new Date(instante))`, los 10 primeros caracteres).

**El manifiesto** describe las partes que llegaron, una por una: `infografia_png` y `correo_texto` siempre, y `calculos` si y solo si llegó esa parte.
`campo` sin repetidos; `mime`, `image/png` para la infografía, `text/plain` para el texto y `text/markdown` o `text/plain` para los cálculos; `nombre`, de 1 a 255, sin `/`, `\` ni caracteres de control; `bytes`, el tamaño recibido; `sha256`, el SHA-256 en minúsculas de los bytes recibidos.
El MIME que trae la parte del multipart no cuenta: cuenta el contenido.

**El contenido de los archivos:**
- La infografía es un PNG: la firma de 8 bytes, un `IHDR` de 13 bytes al principio, con ancho y alto de 1 a 4096, y un `IEND` al final. No se decodifica la imagen.
- El texto y los cálculos son UTF-8 válido (`TextDecoder` con `fatal`), sin el carácter nulo.

**Un dataset que no existe no frena la edición:** si `rpad_id` no está en `datasets`, la propuesta se guarda sin enlace y el recibo trae un aviso (sección 7).
Un dataset dado de baja sigue enlazado en la base; la página lo nombra sin enlace (sección 10).
El nombre, la dirección del portal y la foto del RPAD se guardan como llegaron: el RPAD no los compara con lo de hoy ni los recalcula.

La validación es pura (`validarEdicion` en `services/datoQuincenaReglas.js`) y junta todos los errores, hasta 50, para que el bot los corrija de una vez.
Cada error es `{ campo, mensaje }`, con `campo` la ruta (`propuestas[2].puntos_centrales`) y un mensaje fijo en español que no repite lo que llegó.

## 6. La clave y la huella

**La clave** de una edición: `dq:regular:AAAA-MM-DD` o `dq:piloto:AAAA-MM-DD:piloto-N` (`claveDeEdicion`).
Los pilotos llevan su referencia porque hubo varios el mismo día.
La base no admite dos ediciones con la misma clave (`UNIQUE`).

**La huella** (`huellaDelPaquete`): el SHA-256 de un texto armado con los SHA-256 de los bytes recibidos de cada parte, en este orden fijo, un renglón por parte:
`metadata:<sha>`, `infografia_png:<sha>`, `correo_texto:<sha>`, `calculos:<sha o ->` (cada renglón termina en `\n`).
Son los bytes, no el JSON interpretado: el bot congela el paquete y su reenvío manda los mismos bytes (lo confirmó Grok Bot).
No se usa RFC 8785 ni otra canonización: no hace falta y sumaría una dependencia.

**Qué pasa al guardar:**
- Clave nueva: 201.
- La misma clave con la misma huella: 200 con el recibo de la primera vez (`repetida: true`); no se escribe nada.
- La misma clave con otra huella: 409; no se toca nada.

Dos pedidos iguales al mismo tiempo dan 201 y 200; dos distintos, 201 y 409: lo decide el `UNIQUE`, no una consulta previa.

## 7. Las respuestas

El formato del RPAD: `{ success, data }` o `{ success: false, error }`, más `errores` en el 422.

**El recibo** (201 y 200):

```json
{
  "success": true,
  "data": {
    "id": 12,
    "clave": "dq:regular:2026-11-23",
    "tipo": "regular",
    "fecha_edicion": "2026-11-23",
    "huella": "<64 hex>",
    "recibida_at": "2026-11-23T08:14:02-03:00",
    "repetida": false,
    "adjuntos": [
      { "campo": "infografia_png", "bytes": 98000, "sha256": "<64 hex>" },
      { "campo": "correo_texto", "bytes": 17000, "sha256": "<64 hex>" }
    ],
    "url": "https://rpad.mcrmodernizacion.gob.ar/dato-quincena.html?id=12",
    "avisos": []
  }
}
```

`recibida_at` es la hora de llegada en Argentina, con la zona (`-03:00`: Argentina no cambia la hora).
Sale siempre de la base, en el 201 también (después del `commit`): `UNIX_TIMESTAMP(recibida_at)` pasado por `ahoraArgentina`, como manda `CLAUDE.md` para un TIMESTAMP (`NOW()` da UTC en el Docker local y hora argentina en producción). Así el 201 y el 200 dicen lo mismo.
`url` usa `RPAD_URL` (`services/emailTemplates.js`, de `APP_URL`).
`avisos` es una lista de textos, por ejemplo «La propuesta 3 cita el dataset 999, que no está en el RPAD: se guardó sin enlace.».
El 200 de una repetida devuelve lo guardado: el mismo `id`, `huella`, `recibida_at` y `adjuntos`, con los avisos armados de nuevo desde lo guardado.

**Los errores**, con un texto fijo que no repite lo que llegó:

| Estado | Cuándo | `error` |
|---:|---|---|
| 400 | no es un multipart, no se puede leer, trae un campo de texto, una parte de más, repetida o con otro nombre, le falta una obligatoria, o `metadata` no es un JSON que se pueda usar | «No se pudo leer la edición: <motivo>.», con el motivo fijo: «el pedido no es multipart/form-data», «el pedido está mal armado», «todas las partes van como archivo», «sobran partes», «una parte no corresponde», «la parte <nombre> llegó dos veces», «falta la parte <nombre>», «metadata no es un JSON válido»; para las claves reservadas y la profundidad, el texto de `middleware/cuerpo.js` (`MENSAJES_DEL_CUERPO`, que se exporta) |
| 401 | sin token o con uno que no corresponde | «Falta el token del dato de la quincena o no es válido.» |
| 409 | la clave ya tiene otro contenido | «Ya hay una edición con la clave <clave> y otro contenido. No se cambió nada.» |
| 413 | una parte pasa su tope | «La parte <nombre> supera el tamaño permitido (<tope>).» |
| 422 | la edición no cumple la sección 5 | «La edición tiene errores.», con `errores: [{ campo, mensaje }]` |
| 429 | más de 20 pedidos en la ventana de una hora desde la misma IP | «Demasiados pedidos. Probá de nuevo más tarde.», con `Retry-After` |
| 500 | un error de la base | «No se pudo guardar la edición.» (en la consola, solo `code` y `message` del error: nunca `err.sql`, que traería la edición) |
| 503 | la huella no está configurada | «La recepción del dato de la quincena no está habilitada.» |

`<nombre>` es solo uno de los cuatro nombres de la sección 4; una parte con otro nombre se nombra «una parte que no corresponde», sin repetir lo que llegó.
La clave del 409 sale de la edición ya validada (fecha, tipo y referencia con su forma fija): repetirla no expone nada.
La consola registra la clave y el estado de cada pedido, nunca el token ni el cuerpo.

## 8. La base

`database/updates/migracion-dato-quincena.sql`, aditiva y repetible (`CREATE TABLE IF NOT EXISTS`), y lo mismo en `database/schema.sql`.
Tres tablas; las fechas de negocio como `DATE` y la llegada como `TIMESTAMP`; sin `CHECK`: el JSON va en un `longtext` que valida el código, como `metricas_fotos.datos` (los tests de las migraciones no admiten la palabra `CHECK`).

```sql
CREATE TABLE IF NOT EXISTS `dato_quincena_ediciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `clave` varchar(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `tipo` enum('regular','piloto') NOT NULL,
  `fecha_edicion` date NOT NULL,
  `referencia_piloto` varchar(20) DEFAULT NULL,
  `titulo` varchar(200) NOT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `huella` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `recibida_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dato_quincena_clave` (`clave`),
  KEY `idx_dato_quincena_fecha` (`fecha_edicion`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dato_quincena_propuestas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `edicion_id` int(11) NOT NULL,
  `orden` tinyint(3) unsigned NOT NULL,
  `titulo` varchar(200) NOT NULL,
  `cifra_clave` varchar(1000) NOT NULL,
  `principal` tinyint(1) NOT NULL DEFAULT 0,
  `dataset_id` int(11) DEFAULT NULL,
  `dataset_nombre` varchar(200) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dato_quincena_orden` (`edicion_id`, `orden`),
  KEY `idx_dato_quincena_dataset` (`dataset_id`),
  CONSTRAINT `fk_dato_quincena_propuesta_edicion` FOREIGN KEY (`edicion_id`) REFERENCES `dato_quincena_ediciones` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dato_quincena_propuesta_dataset` FOREIGN KEY (`dataset_id`) REFERENCES `datasets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dato_quincena_adjuntos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `edicion_id` int(11) NOT NULL,
  `campo` enum('infografia_png','correo_texto','calculos') NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `mime` varchar(30) NOT NULL,
  `bytes` int(10) unsigned NOT NULL,
  `sha256` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `contenido` mediumblob NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dato_quincena_adjunto` (`edicion_id`, `campo`),
  CONSTRAINT `fk_dato_quincena_adjunto_edicion` FOREIGN KEY (`edicion_id`) REFERENCES `dato_quincena_ediciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- `metadata` guarda el texto tal como llegó (ya validado como UTF-8), así la descarga devuelve los mismos bytes.
- `dato_quincena_propuestas` es lo que lee la lista y lo que va a leer el enlace desde el dataset: el contenido completo de cada propuesta está en `metadata`, no se copia.
  `dataset_id` es `rpad_id` si existe en `datasets` y null si no; `principal` es 1 en la que lleva la etiqueta.
- Los `ON DELETE CASCADE` son para el SQL a mano de un caso raro: borrar la edición borra sus propuestas y adjuntos. El RPAD no borra ediciones.
- La edición, sus propuestas y sus adjuntos se escriben en una sola transacción (`beginTransaction`/`commit`/`rollback`). Si el `INSERT` de la edición choca con el `UNIQUE` (`ER_DUP_ENTRY`), se deshace y se lee la que estaba, para responder 200 o 409.
- Los `INSERT` van con `execute`, no con `query`: así los bytes viajan en binario y no en hexadecimal (el doble), y un error no trae la edición en `err.sql` (como el PDF de las Notas Digitales, `services/notasDigitales.js`).
- El código anterior no lee estas tablas: la migración puede ir antes del código sin romper nada.
- `rollback-dato-quincena.sql` borra las tres tablas (adjuntos, propuestas, ediciones). Si ya hay ediciones, se pierden: antes, exportarlas.
- Con un PNG de hasta 5 MB, el `INSERT` necesita unos 6 MB de `max_allowed_packet`, y restaurar un respaldo de phpMyAdmin (que exporta los bytes en hexadecimal), unos 11 MB: el kit comprueba que dé 16 MB o más (lo que trae MariaDB).

## 9. Las lecturas

Con `authMiddleware`, sin `adminOnly`: cualquier rol con sesión (sin sesión, 401), como las lecturas de Proyectos; en `controllers/datoQuincenaController.js`.
El token del bot no sirve acá: no es un JWT.
Un id que no pasa `idPositivo` o que no existe da 404 `{ success: false, error: 'No existe esa edición.' }`.

**`GET /api/dato-quincena/ediciones?anio=AAAA`**, la lista:

```json
{
  "anios": [{ "anio": 2026, "cantidad": 2 }],
  "anio": 2026,
  "ediciones": [
    {
      "id": 12,
      "fecha_texto": "Lunes 23 de noviembre de 2026",
      "marca": null,
      "principal": { "titulo": "Un título inventado", "cifra_clave": "1.234 casos · octubre de 2026" },
      "resto": "Y 4 propuestas más: Dataset A, Dataset B, Dataset C y Dataset D."
    }
  ]
}
```

Sin `anio`, el año más reciente con ediciones; un año sin ediciones da la lista vacía; un `anio` que no es un entero de 2000 a 2100, 400 «El año no es válido.».
Orden: `fecha_edicion` descendente y, en el mismo día, `id` descendente.
`marca` es «Piloto N» en un piloto y null en una regular; `resto`, null si hay una sola propuesta («Y 1 propuesta más: …» si hay dos).
Con el archivo vacío: `anios` vacío, `anio` null, `ediciones` vacía.

**`GET /api/dato-quincena/ediciones/:id`**, el detalle, con los textos ya armados:
- `fecha_texto`, `marca`, `titulo`, `nota_archivo`;
- `llegada`: «Llegó al RPAD el 23/11/2026 a las 08:14.»;
- `correo`: «Correo enviado el 23/11/2026 a las 08:12, según Grok Bot.», con la hora pasada a Argentina (`ahoraArgentina(new Date(enviado_at))`, sea cual sea la zona que mandó el bot), o «Correo enviado según Grok Bot, sin la hora.» si `enviado_at` es null;
- `cantidad`: «5 propuestas» o «1 propuesta»;
- `agenda`: `[{ fecha_texto ('dd/mm/aaaa'), titulo, detalle, url }]`;
- `propuestas`: cada una con `orden_texto` («Propuesta 1»), `etiquetas`, `principal`, `titulo`, `cifra_clave`, `dataset` (`{ nombre, id_enlace, url }`, con `id_enlace` el id solo si el dataset existe y está activo), `foto` (abajo), `notas_validacion`, el resto de sus textos tal como llegaron, `para_copiar` y `borrador_para_copiar` (abajo);
- `archivos`: `[{ campo, rotulo, nombre, detalle, se_puede_ver }]`, en este orden: la infografía («Infografía», «PNG · 97 KB»), el texto del correo, los cálculos si están, y la edición completa (`metadata`, «JSON · 24 KB»).
  `nombre` es el del manifiesto (el de la edición completa, el de la descarga, abajo): la página lo usa para guardar, porque `API.pedirArchivo` no da el `Content-Disposition`.
  `se_puede_ver` es true en el texto y los cálculos.
  El tamaño, en KB redondeado hacia arriba y, desde 1 MB, en MB con un decimal y coma («1,5 MB»).
- Ninguna dirección del detalle es null: todas pasaron la validación.

**La foto del RPAD de ese día** (`foto`), una lista de `{ rotulo, valor }` armada por `fotoDelDataset`:
- «En el RPAD ese día:»: «Actualizado», «Próximo a vencer», «Vencido» (`atrasado` y `sin-respuesta`), «Sin fecha», «Eventual» o «Sin dato» (null).
  `sin-respuesta` no se muestra como «Sin respuesta»: `CLAUDE.md` prohíbe esas palabras en lo nuevo (el sitio público todavía las usa), y el atraso muchas veces no depende del área.
- «Datos al» y «Última actualización»: el día en Argentina como `dd/mm/aaaa`, o «—».
- Con `dias_para_vencer` de 0 o más, «Próxima en»: «N días» («1 día»); negativo, «Venció hace»: «N días»; null, no va.

**La propuesta para copiar** (`para_copiar`, armada por `textoParaCopiar`): la propuesta entera en texto plano, para pegarla en otro lado.
Bloques separados por `\n\n`; dentro de un bloque, los renglones van con `\n`; los textos van tal como llegaron, con sus propios saltos de línea.
Un ejemplo completo (inventado), con una propuesta de dos fuentes:

```
Un título inventado [Principal, Validar]

1.234 casos · octubre de 2026

Dataset: Dataset de prueba A
https://datos.ejemplo.gob.ar/dataset/prueba-a

En el RPAD ese día: Actualizado. Datos al 31/10/2026. Última actualización 05/11/2026. Próxima en 25 días.

Para validar antes de publicar
- Primera nota.
- Segunda nota.

Cómo se calculó
<calculo>

Contexto histórico
<contexto_historico>

Por qué hoy
<por_que_hoy>

Ángulo
<angulo>

Idea de placa
<idea_placa>

Texto para redes
<texto_redes>

Puntos centrales
- <punto 1>
- <punto 2>
- <punto 3>

Borrador de nota
<título del borrador>

<párrafo 1>

<párrafo 2>

Fuentes
https://datos.ejemplo.gob.ar/a.csv
https://datos.ejemplo.gob.ar/b.csv
```

- Sin etiquetas, el título va solo (sin corchetes); sin notas de validación, ese bloque no va.
- La línea de la foto: cada `{ rotulo, valor }` de `foto` como `<rotulo> <valor>.`, separados por un espacio.

**El borrador para copiar** (`borrador_para_copiar`): el título del borrador y sus párrafos, separados por `\n\n`, lo mismo que el final del bloque «Borrador de nota».

**`GET /api/dato-quincena/ediciones/:id/archivos/:campo`**, la descarga, con `campo` `infografia_png`, `correo_texto`, `calculos` o `metadata`.
Los bytes guardados, con `Content-Type` fijo (`image/png`, `text/plain; charset=utf-8` para el texto y los cálculos, `application/json; charset=utf-8` para la edición), `Content-Disposition` de adjunto (`disposicionDeAdjunto`), y el `no-store` y el `nosniff` que ya ponen `app.js` y Helmet.
Un id que no pasa `idPositivo` o que no existe, 404 «No existe esa edición.»; en una edición que existe, otro `campo` o unos cálculos que no llegaron, 404 «El archivo no existe.».
El `Content-Disposition` lleva el `nombre` del manifiesto en los tres archivos y, en la edición completa, `dato-quincena-<clave sin dq:, con - en lugar de :>.json`.

Las tres rutas dan 500 con un mensaje fijo por operación si falla la base.

## 10. La página

`public/dato-quincena.html` + `public/js/dato-quincena.js`, con la carcasa, `main.css`, su `<style>` y los tokens `--sg-*` de Proyectos, como la maqueta aprobada.

- **Título:** «El dato de la quincena», con el ícono `newspaper` de Lucide; bajada: «Las propuestas de comunicación que manda Grok Bot cada dos lunes, tal como llegaron. Son internas: guardarlas acá no las aprueba ni las publica.»
- **La lista** (sin `?id=`): los años como botones con su cantidad (solo si hay más de uno), y una fila por edición con la infografía en miniatura (104 px; 72 px en el teléfono), la fecha y la marca, el título y la cifra de la principal, y `resto`.
  Las miniaturas se piden con `API.pedirArchivo` y se muestran desde un `blob:`.
- **El detalle** (`?id=N`): «Todas las ediciones», la fecha grande con la marca, el título, `llegada`, `correo` y `cantidad`, y `nota_archivo` si hay.
  A un costado (fijo al bajar, arriba en el teléfono), la infografía y «Archivos», con «Descargar» en cada uno (guarda con el `nombre` que manda el servidor) y «Ver» en el texto y los cálculos.
  Al otro, la agenda (si hay) y las propuestas.
- **Cada propuesta:** su número, sus etiquetas («Principal» en tinta, «Agenda» en cielo, «Validar» en sol con un ícono, nunca solo el color), el título, la cifra grande, el dataset (con enlace a `dataset.html?id=N` si hay `id_enlace`, y «en el portal» siempre), la foto del RPAD y, si hay, «Para validar antes de publicar» con sus notas, siempre a la vista.
  Después, en un `<details>` («La propuesta completa», abierto en la principal; «Ver la propuesta completa», cerrado en las otras): cómo se calculó, contexto histórico, por qué hoy, ángulo, idea de placa, texto para redes, puntos centrales, borrador de nota y fuentes.
  La principal lleva el borde de tinta más grueso.
- **«Copiar»**, tres por propuesta:
  en el texto para redes (`texto_redes`); en el borrador (`borrador_para_copiar`); y «Copiar la propuesta», al pie de cada propuesta (`para_copiar`). Los tres copian el texto tal como llega del servidor (sección 9).
  Con `navigator.clipboard.writeText`: el botón dice «Copiado» dos segundos y lo anuncia la región viva; si falla, «No se pudo copiar: seleccioná el texto.».
  Todo el texto de la página se puede seleccionar igual.
- **«Ver»** abre un modal con el texto en un `<pre>`, puesto con `textContent`, y «Descargar».
- **Los estados:** cargando, error («No se pudieron cargar las ediciones. Probá de nuevo en unos minutos.»), vacío («Todavía no llegó ninguna edición. Grok Bot manda cada una después de enviar su correo.») y una edición que no existe («No existe esa edición.» y «Todas las ediciones»).
- **Sin sesión:** al login, como Proyectos. Cualquier rol con sesión ve la página entera.

Convenciones de siempre (`docs/temas/frontend.md` y `CLAUDE.md`):
al cargarse, el script solo declara y engancha `DOMContentLoaded`;
lo que arma HTML es puro y recibe los datos por parámetro;
lo que toca el DOM o la API va al final, con los eventos delegados en contenedores fijos;
todo texto del servidor pasa por `Utils.escapeHtml` (también en `title`, `alt` y `aria-label`) y un número va con `String`;
un enlace de afuera lleva `rel="noopener noreferrer"` y solo se dibuja si empieza con `https://`;
la página no recalcula nada: imprime los textos del servidor.
Foco visible, contraste de 4,5:1, nada se mueve con `prefers-reduced-motion`, y ninguna clase ni id empieza con `ad-` (las de la página empiezan con `dq-`).

## 11. El menú y las versiones

- El enlace «El dato de la quincena» va al final de Herramientas, en las 15 páginas con carcasa (las 14 de hoy y la nueva), igual en todas, con el ícono `newspaper` de Lucide escrito en el HTML (`aria-hidden="true"` y los mismos atributos que los otros íconos del menú).
- Se ve con cualquier sesión, como Proyectos y Seguimiento: `updateSidebarAuth` (`public/js/main.js`) ya muestra Herramientas con sesión, así que `main.js` no cambia y `VERSION` no sube.
- `tests/paginas.test.js`: la constante nueva `VERSION_DATO_QUINCENA`, la página en la lista de scripts, 15 páginas con carcasa, 5 enlaces en Herramientas y `dato-quincena.html` en la lista de destinos de la carcasa.
- La ayuda del rol lector en Configuración (`AYUDA_DEL_ROL`, `public/js/usuarios.js`) nombra las Herramientas: pasa a «Ve los datos públicos y usa las Herramientas (Métricas y Reportes, Proyectos, Seguimiento y El dato de la quincena). No modifica nada.». Sube la versión de `usuarios.js` en `configuracion.html` y su constante en `tests/paginas.test.js`, y cambia lo que controla `tests/usuarios-frontend.test.js`.
- La CSP no cambia: la página no carga nada de afuera salvo las fuentes de Google.

## 12. El token y el interruptor

**En el servidor**, una sola variable de entorno: `DATO_QUINCENA_TOKEN_SHA256`, el SHA-256 en hexadecimal (64 caracteres) del token.
Se lee en cada pedido.
Si no está, o no son 64 caracteres hexadecimales, la recepción está apagada: 503.
Con la huella, el pedido trae `Authorization: Bearer <token>`; el servidor calcula el SHA-256 de lo que sigue a `Bearer ` y lo compara con la huella con `crypto.timingSafeEqual`, sobre dos buffers de 32 bytes. Si no coincide, o falta, 401.
El token del bot no es un JWT, no usa `JWT_SECRET` ni `CRON_SECRET`, no es una cuenta de usuario y solo sirve para este POST.
`.env.example` suma la variable vacía; ningún secreto ni huella real entra al repo.

**Cómo se genera**, en la Mac del usuario: el token queda en el portapapeles para pegarlo en Grok Bot, y en la pantalla sale solo la huella, para cPanel.

```bash
TOKEN=$(openssl rand -hex 32); printf %s "$TOKEN" | pbcopy; printf %s "$TOKEN" | shasum -a 256 | cut -d' ' -f1; unset TOKEN
```

El usuario pega el token en el campo de secretos de Grok Bot (`RPAD_API_TOKEN`) antes de copiar otra cosa, y carga la huella en Setup Node.js App, con Restart.
Nadie más ve el token: ni el chat, ni el repo, ni el kit.
**Para apagar** la recepción: borrar la variable y Restart. **Para cambiar el token:** repetir lo mismo de los dos lados.

## 13. Seguridad y privacidad

- Las ediciones traen nombres reales (el saludo del texto del correo) y cifras de producción: van solo a la base de producción. El repo, los tests y los ejemplos usan datos inventados, y el paquete de Grok Bot nunca entra al repo.
- Las ve cualquier rol con sesión (decisión del usuario): el saludo del texto del correo también.
- No se guardan destinatarios, direcciones de correo ni encabezados del mail: el JSON no los tiene y el RPAD no los pide.
- El RPAD no descarga nada de las direcciones que trae una edición: solo las guarda y las muestra como enlaces.
- Sin HTML ni SVG del bot, la página no renderiza nada activo: todo texto va escapado y la infografía es un PNG comprobado, en un `<img>` desde un `blob:`.
- El límite de pedidos va antes del token, y el token antes de leer el multipart (un cuerpo JSON o de formulario lo leen antes los lectores globales de `app.js`, hasta 1 MB, como en cualquier ruta).
- Lo que manda un desconocido no se lee sin fin: más de 6 MB o sin `Content-Length`, la respuesta va enseguida y se corta (sección 4).

## 14. Archivos

Nuevos:
`services/datoQuincenaReglas.js` (puro: `validarEdicion`, `claveDeEdicion`, `huellaDelPaquete`, `esPng`, `esTextoUtf8`, los textos de la lista y del detalle, `fotoDelDataset`, `textoParaCopiar`, `avisosDeLaEdicion`, los mensajes),
`services/datoQuincenaDatos.js` (las consultas y la transacción),
`controllers/datoQuincenaController.js`,
`public/dato-quincena.html`, `public/js/dato-quincena.js`,
`database/updates/migracion-dato-quincena.sql`, `database/updates/rollback-dato-quincena.sql`,
`docs/temas/dato-quincena.md`, `.claude/rules/dato-quincena.md`,
los tests de la sección 15 y sus fixtures inventados.

Cambian:
`middleware/auth.js` (`tokenDelDatoQuincena`), `middleware/rateLimit.js` (`limiteDatoQuincena`), `middleware/cuerpo.js` (exporta `MENSAJES_DEL_CUERPO`, sin cambiar lo que hace), `config/upload.js` (`subidaDelDatoQuincena`), `routes/index.js`, `database/schema.sql`,
el menú de las 14 páginas con carcasa (el HTML; sus scripts no cambian), `public/js/usuarios.js` (la ayuda del lector) y su `?v=` en `configuracion.html`,
`.env.example`, `CLAUDE.md` (una fila en «El mapa», la variable en «Variables de entorno», «las 15 páginas» en la estructura y en las convenciones de Frontend, y las Herramientas del lector en «Roles»), y en `docs/temas/`: `frontend.md` (15 páginas con carcasa; `auth.js` en 16 páginas y `main.js` y `api.js` en 15), `base-de-datos.md` (la cuenta de tablas, que ya dice 45 y son 47, pasa a 50) y `despliegue.md`.

## 15. Pruebas

Locales, con la base y Mailpit de Docker, y datos inventados: una edición de ejemplo armada por `tests/dato-quincena-fixtures.js` (como `tests/notas-fixtures.js`) y un PNG chico armado en el test (firma, `IHDR`, `IDAT` e `IEND`, con `zlib.crc32`).

- `tests/dato-quincena-reglas.test.js` (puro): cada regla de la sección 5 con sus bordes y sus mensajes; varios errores juntos y el tope de 50; la clave de una regular y de un piloto; la huella (cambia si cambia un byte de cualquier parte; no depende de nada más); `esPng` (firma, `IHDR`, medidas, `IEND`, un archivo cortado); `esTextoUtf8`; los textos de la lista y del detalle; `fotoDelDataset` con cada estado, `sin-respuesta` como «Vencido», las fechas como `'AAAA-MM-DD'` y como instante (`2026-06-03T03:00:00.000Z` da 03/06/2026) y los días; `textoParaCopiar` (el ejemplo de la sección 9, comparado entero, y sin validaciones ni etiquetas cuando no hay); los avisos.
- `tests/dato-quincena-api.test.js`, con su propia base (`crearBaseDePrueba('rpad_test_dato_quincena_api')`, con un área y dos datasets inventados) y la app real con la huella de un token de prueba en el entorno del servidor de prueba.
  Para el 503, servidores aparte con `DATO_QUINCENA_TOKEN_SHA256: ''` y con una mal formada, explícitos (un `.env` local que la tenga se heredaría).
  Cada grupo de pedidos manda su propio `X-Forwarded-For` (con `trust proxy` 1, el límite cuenta esa IP, como `tests/contacto-limite.test.js`), así el límite de 20 no cruza casos.
  La edición de prueba tiene una fecha fija pasada desde el 01/11/2026; los casos de «hasta mañana» se arman con `hoyArgentina()`.
  Casos:
  503 sin la huella y con una mal formada; 401 sin token, con otro token y con el JWT de un admin; 201 con el recibo completo y las filas y bytes guardados; 200 al repetir, con el mismo recibo y sin filas nuevas; 409 con otro contenido, sin cambios; dos pedidos iguales a la vez (201 y 200);
  400 por cada problema de la lectura (un cuerpo JSON, sin `metadata`, sin `infografia_png`, `metadata` como campo de texto, una parte con otro nombre, una repetida, cinco partes, JSON roto, un BOM, una clave reservada, demasiados niveles); 413 por cada tope; 422 con sus `errores`; el aviso de un dataset que no existe; un piloto y una regular del mismo día, y dos pilotos del mismo día; 429 con `Retry-After` al pasar el límite;
  la lista, el detalle y las descargas, con sus textos y sus bytes iguales a los recibidos; 404 por id y por archivo;
  y que nada más cambió: ningún mail en Mailpit y las mismas filas en `datasets`, `cambios_pendientes`, `historial_actualizaciones`, `notificaciones_log`, `proyecto_hitos` e `hito_archivos` antes y después.
- `tests/permisos.test.js` (corre contra la base del `.env`, sin ediciones): `/dato-quincena/ediciones` en las listas de lo que pueden usar el lector y el colaborador (200); el detalle y la descarga de un id que no existe llegan al controlador (404 «No existe esa edición.», nunca 401, 403 ni «Ruta no encontrada»), como las lecturas de la restitución; y las tres, 401 sin sesión.
- `tests/dato-quincena-frontend.test.js` (en un `vm`, después de `main.js` y `api.js` de verdad): el HTML de la lista, el detalle, cada estado, la propuesta abierta y las cerradas, las validaciones a la vista, los tres «Copiar» (el de la propuesta copia `para_copiar` tal cual), los enlaces solo `https://` y todo escapado.
- `tests/paginas.test.js`, `tests/schema.test.js` (las tres tablas) y `tests/documentos.test.js`.

La suite completa antes y después, en verde.
La base local compartida necesita la migración antes de la suite (`tests/schema.test.js` y `tests/permisos.test.js` leen la del `.env`): se avisa a la sesión coordinadora antes de correrla.

## 16. Documentación

- `docs/temas/dato-quincena.md`, el documento del tema: el contrato del POST, la clave y la huella, las lecturas, la página, el token y el interruptor.
- `CLAUDE.md`: la fila «El dato de la quincena: el archivo de Grok Bot, su token y su página» en «El mapa», la variable de entorno y la estructura.
- `.claude/rules/dato-quincena.md`: leer el documento antes de tocar esos archivos (ruta protegida: cada escritura pide permiso).
- `docs/temas/base-de-datos.md` (las tres tablas), `docs/temas/despliegue.md` (la fila 37 de la tabla de migraciones) y `docs/temas/frontend.md` (15 páginas con carcasa y la constante nueva).
- Fuera del repo, para Grok Bot: un documento breve con el contrato, qué hacer con cada respuesta, cómo se carga el token y el orden de las pruebas, en `~/rpad-notas/dato-quincena/para-grok/`.

## 17. Despliegue y primera prueba

Un kit con SQL (`docs/temas/despliegue.md`), fuera del horario de los crons y, con la firma digital prendida, fuera de 8:05 a 14:00:
1. Comprobar los `?v=` del kit anterior y que `SELECT @@max_allowed_packet` dé 16 MB (16777216) o más.
2. Respaldo de la base y de las carpetas de siempre.
3. `migracion-dato-quincena.sql` en phpMyAdmin, con su verificación (las tres tablas).
4. Los archivos y Restart. La recepción queda apagada: el POST da 503.
5. Ctrl+F5 y mirar: Herramientas → El dato de la quincena, vacío, con cualquier rol.
6. El token (sección 12): el usuario lo genera, lo pega en Grok Bot y carga la huella en Setup Node.js App, con Restart.
7. Grok Bot comprueba que tiene la variable, sin mostrarla, y manda el piloto 4 desde su paquete: 201. Lo manda otra vez: 200.
8. Grok Bot corre un piloto 5 por la rutina nueva, que congela el paquete y lo manda: 201.
9. El usuario mira las dos ediciones en la página.

Si algo sale mal: borrar la variable y Restart (la recepción se apaga y lo guardado queda), o volver a los archivos anteriores y Restart; las tablas pueden quedar.

## 18. Lo que no cambia

Datasets, la doble verificación, cambios pendientes, historial de actualizaciones, notificaciones, Notas Digitales, hitos y Proyectos (sus subidas incluidas), Métricas y la foto del 31/12, los crons, los mails, la CSP y las dependencias.
El mail del bot sigue igual: el RPAD no lo manda, no lo lee y no lo conoce.

## Antiobjetivos

- Guardar el HTML del correo o el SVG, o sanearlos.
- Editar, anular o borrar una edición desde el RPAD.
- Una vista pública, sin sesión.
- El enlace desde cada dataset (es la etapa siguiente; la tabla de propuestas ya lo deja listo).
- Avisar por mail que llegó una edición.
- RFC 8785, JSON Schema u otra dependencia nueva; exigir `Idempotency-Key`.
- Un staging, un sistema general de claves de servicio, una lista blanca de IP o la rotación automática del token.
- Guardar los CSV o XLSX fuente, o descargar algo de las direcciones de una edición.
- Que el RPAD decida qué lunes corresponde una edición: eso es de la rutina del bot.
