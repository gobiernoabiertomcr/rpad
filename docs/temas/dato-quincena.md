# El dato de la quincena

El archivo interno y de solo lectura de las ediciones que manda Datito cada dos lunes: qué es y quién lo ve, las lecturas (la lista, el detalle y las descargas) y la página.
El POST de Datito con su token, la validación de la edición, la clave, la huella y el guardado están en `docs/temas/dato-quincena-contrato.md`.
El correo que el RPAD manda con cada edición, su lista, Reenviar y la prueba están en `docs/temas/dato-quincena-correo.md`.
La principal que elige el equipo, en `docs/temas/dato-quincena-principal-equipo.md`.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-11-07-dato-quincena-design.md`
- `docs/superpowers/specs/2026-11-12-dato-quincena-correo-design.md`
- `docs/superpowers/specs/2026-11-14-dato-quincena-v1-3-design.md` (el contrato v1.3: Repite y Efemeride)
- `docs/superpowers/specs/2026-11-14-dato-quincena-agenda-grupos-design.md` (la agenda en tres grupos)
- `docs/superpowers/specs/2026-11-18-dato-quincena-propuestas-datasets-design.md` (el contrato v1.4: las propuestas de datasets nuevos)
- `docs/superpowers/specs/2026-11-18-dato-quincena-detalle-pestanas-design.md` (el detalle en tres pestañas)
- `docs/superpowers/specs/2026-11-21-dato-quincena-principal-equipo-design.md` (la principal del equipo)

## Archivos

datoQuincenaController: las lecturas (`listar`, `ver` y `descargar`); el POST de Datito (`recibirEdicion`) está en `docs/temas/dato-quincena-contrato.md`;
datoQuincenaReglas (puro: `NOMBRE_DEL_BOT`, los textos de la lista y del detalle, los grupos de la agenda (`gruposDeLaAgenda`), la prioridad, la matriz y los textos de las propuestas de datasets (`prioridadDeDataset`, `matrizDePrioridad` y `propuestasDatasetsDelDetalle`), la foto del RPAD y lo que se copia; la validación, la clave, la huella, el token y el recibo, en el contrato);
datoQuincenaDatos (las consultas y `leerEdicionesPrevias`; el guardado, en el contrato);
dato-quincena.html # El dato de la quincena: la lista de un año en tarjetas, el detalle ?id=N en tres pestañas y la pestaña Correo (dato-quincena.js)

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
  La edición no cambia nunca; el estado de su envío y la principal del equipo viven en otras tablas.
- Quién: la ven entera todos los roles con sesión, también el saludo del texto del correo (decisión del usuario: quien valida y trabaja las propuestas puede tener cualquier rol).
  Ninguna sesión escribe la edición ni sus propuestas: solo el POST de Datito.
  La principal del equipo va aparte, en su propia tabla (`docs/temas/dato-quincena-principal-equipo.md`).
  El correo (la lista, los destinatarios, el estado por persona) lo ve solo administración.
- Lo que no se guarda: el HTML del correo, los CSV o XLSX fuente (alcanzan los cálculos y las direcciones de las fuentes), los destinatarios y los encabezados del mail.
  El RPAD no descarga nada de las direcciones de una edición: las guarda y las muestra como enlaces.
  El SVG de la infografía sí se guarda (parte opcional), pero nunca se dibuja ni se sanea: se descarga y se adjunta al mail, y por eso `esSvg` es estricto (`docs/temas/dato-quincena-contrato.md`).
- Las ediciones traen nombres reales y cifras de producción: van solo a la base de producción.
  Los tests usan datos inventados (`tests/dato-quincena-fixtures.js`, con un PNG chico armado byte a byte, y `tests/fixtures/dato-quincena-respuestas.json`), y el paquete de Datito nunca entra al repositorio.

## Las lecturas

- Con `authMiddleware` y sin `adminOnly`, como las lecturas de Proyectos: cualquier rol con sesión (sin sesión, 401); el token del bot no es un JWT y acá no sirve.
  Un id que no pasa `idPositivo` o que no existe da 404 «No existe esa edición.».
  Si falla la base, 500 con un mensaje fijo por operación («Error al obtener las ediciones», «Error al obtener la edición» y «Error al descargar el archivo») y, en la consola, ese mensaje con el `code` y el `message` del error.
- `GET /api/dato-quincena/ediciones?anio=AAAA`, la lista: `{ anios, anio, ediciones }`.
  `anios`, cada año con ediciones y su `cantidad`, del más nuevo al más viejo; `anio`, el pedido o, sin él, el más reciente con ediciones (null con el archivo vacío); un año sin ediciones da `ediciones` vacía.
  Un `anio` que no son cuatro cifras de 2000 a 2100 (también uno repetido en la query) da 400 «El año no es válido.».
  `ediciones`, por `fecha_edicion` descendente y, en el mismo día, por `id` descendente, cada una `{ id, fecha_texto, marca, principal, resto, numero, fecha_partes, cantidad, envio }`: «Lunes 2 de noviembre de 2026»;
  «Piloto N» o null;
  el `titulo`, la `cifra_clave` y el `rotulo` de la principal que cuenta, la del equipo si ya eligió y, si no, la de Datito (`docs/temas/dato-quincena-principal-equipo.md`);
  «Y 2 propuestas más: A y B.», con el nombre del dataset de las demás en su orden, o null;
  `numero`, «N.º 3» en una regular (cuántas regulares hay con esa fecha o anterior, calculado al leer: si una de fecha anterior llega después, los siguientes corren) y null en un piloto;
  `fecha_partes`, `{ dia: 'Lunes', fecha: '9 de noviembre', anio: 'de 2026' }`;
  `cantidad`, «4 propuestas»;
  y `envio`, `{ tipo, texto }`, la pastilla del envío (null si no lleva), con el texto de administración si quien pide lo es (`docs/temas/dato-quincena-correo.md`).
  La lista no trae las infografías ni ninguna dirección de correo.
- `GET /api/dato-quincena/ediciones/:id`, el detalle, con los textos ya armados (`detalleDeLaEdicion`): `{ id, fecha_texto, marca, numero, titulo, nota_archivo, llegada, correo, cantidad, agenda, agenda_grupos, propuestas, propuestas_datasets, matriz_de_prioridad, cantidades, ver_propuestas, aviso_datasets_nuevos, ver_datasets_nuevos, archivos, principal_datito, principal_equipo }`.
  `llegada`, «Llegó al RPAD el dd/mm/aaaa a las HH:MM.», de `recibida_at`;
  `correo`, la línea del envío del RPAD (`docs/temas/dato-quincena-correo.md`);
  en una edición sin envío (archivada antes del correo), la de Datito: «Correo enviado el dd/mm/aaaa a las HH:MM, según Datito.» con la hora pasada a Argentina sea cual sea la zona del bot, «Correo enviado según Datito, sin la hora.» o «Datito archivó esta edición sin que saliera el correo.», que sigue siendo cierto si el correo sale después: la edición no cambia y Datito no la vuelve a mandar (sería un 409);
  `cantidad`, «1 propuesta» o «5 propuestas»;
  `agenda`, cada evento `{ fecha_texto, titulo, detalle, url, etiqueta }`, en el orden en que llegó, con la fecha dd/mm/aaaa y `etiqueta` «Efeméride» (de `tipo: 'efemeride'`) o null.
  Queda para una pestaña abierta con la página anterior: la página y el mail imprimen `agenda_grupos`.
  `agenda_grupos`, la misma agenda en grupos `{ titulo, eventos }`, cada evento `{ fecha_texto, titulo, detalle, url }`, sin etiqueta (`gruposDeLaAgenda`, pura, con la `fecha_edicion` por parámetro).
  Los grupos, en este orden y con estos títulos (decisión del usuario): «Lo que pasó», los eventos (sin `tipo` o con `evento`) anteriores a la edición;
  «Lo que viene», los eventos del día de la edición o después;
  y «Efemérides», cualquiera sea su fecha.
  En cada grupo, por fecha, de la más vieja a la más nueva, y con la misma fecha, en el orden en que llegaron; un grupo vacío no va y, sin agenda, la lista es vacía.
  Los grupos salen de la `fecha` y el `tipo` de cada evento y de la `fecha_edicion`, no del orden en que llegan: el contrato con Datito no cambia.
  Cada propuesta: `orden` (el número del JSON, para la dirección y el índice de la página; el mail lo deja afuera, como `orden_texto`), `orden_texto` («Propuesta 1»), `etiquetas`, `principal`, sus textos tal como llegaron, `dataset` (`{ nombre, id_enlace, url }`, con `id_enlace` el id solo si el dataset existe y está activo), `foto`, `repeticion` (después de la foto), `para_copiar` y `borrador_para_copiar`.
  `etiquetas` son las para mostrar: 'Efemeride' es «Efeméride» y las demás quedan igual; `principal` mira el valor del JSON.
  `repeticion` es null (sin la clave o con null) o `{ texto, motivo, id_edicion }`: «Repite el dataset de la edición del dd/mm/aaaa.» o «Repite el tema de la edición del dd/mm/aaaa.»;
  «Datos nuevos: <detalle>» o «Hecho actual: <detalle>», con el detalle tal como llegó;
  e `id_edicion`, el id de la regular de esa fecha si existe y es anterior a la edición, o null (no depende de que cite el dataset: eso solo da el aviso).
- `propuestas_datasets` (`propuestasDatasetsDelDetalle`), después de `propuestas`: null si la edición no trae la clave (todas las archivadas antes de la v1.4 y las v1.3), una lista vacía si llegó vacía y, si no, cada propuesta de dataset `{ numero, numero_texto, titulo, origenes, justificacion, prioridad, valor, riesgo, valor_y_riesgo, formato, campos, anonimizacion, datasets_relacionados, fuentes }`.
  Se calcula al leer, de la `metadata` guardada, que no cambia: no se guarda nada más ni hay migración.
  `numero`, el del JSON, y `numero_texto`, «Dataset nuevo N»;
  `prioridad`, `{ clave, texto }` (abajo);
  `valor` y `riesgo`, tal como llegaron (`Alto`, `Medio` o `Bajo`), para el marcador de su celda en la matriz;
  `valor_y_riesgo`, «Valor alto · Riesgo bajo», con los dos en minúscula;
  `formato` y `campos`, el `formato_sugerido` y los `campos_sugeridos`;
  cada dataset relacionado, `{ nombre, url }`, con `url` igual a `https://datos.comodoro.gov.ar/dataset/<ckan_slug>`: se arma solo con el slug, que el POST ya validó, y no consulta el portal;
  el título, los orígenes, la justificación, la anonimización (null o el texto) y las fuentes, como llegaron.
- La prioridad de una propuesta de dataset (`prioridadDeDataset`, pura) sale del valor y el riesgo, con la matriz de la Guía Práctica de Apertura de Datos: `alta`, «Prioridad alta», con valor Alto y riesgo Bajo;
  `si_hay_recursos`, «Publicar si hay recursos», con valor Medio o Bajo y riesgo Bajo o Medio;
  y `evaluar`, «Evaluar riesgos», con valor Alto y riesgo Medio o Alto, y con valor Medio y riesgo Alto.
  Valor Medio con riesgo Alto da «Evaluar riesgos» porque lo decidió el usuario: el borrador de Datito no lo cubría.
  Valor Bajo con riesgo Alto no llega, porque el POST lo rechaza: la función da `evaluar`, como con cualquier par que no es de la tabla, y no tira.
  Datito copia la misma tabla en su chequeo: si cambia, cambia en los dos lados.
- Lo de las pestañas de la página, después de `propuestas_datasets` y en todo detalle, para que la página no recalcule nada:
  `matriz_de_prioridad`, null sin la clave y, si no (también con `[]`), las 9 celdas de `matrizDePrioridad` (pura), en el orden de la matriz: riesgo Alto, Medio y Bajo y, en cada uno, valor Bajo, Medio y Alto;
  cada celda `{ valor, riesgo, clave, texto, con_rotulo }`, con la prioridad de `prioridadDeDataset`, salvo valor Bajo con riesgo Alto: `no_se_propone`, «No se propone».
  `con_rotulo` es true en una sola celda por zona, la de la maqueta aprobada: riesgo Alto con valor Bajo y con valor Alto, riesgo Medio con valor Bajo y riesgo Bajo con valor Alto; en las demás, la página pone el rótulo como texto oculto.
  `cantidades`, `{ propuestas, datasets_nuevos }`, los números de las pestañas, con `datasets_nuevos` null sin la clave;
  `ver_propuestas`, «Ver las N propuestas» o, con una sola, «Ver la propuesta»;
  `aviso_datasets_nuevos`, «Datito propone 1 dataset nuevo para abrir.» o «Datito propone N datasets nuevos para abrir.» (con `NOMBRE_DEL_BOT`), null sin la clave o con `[]`;
  y `ver_datasets_nuevos`, el botón del aviso, «Ver el dataset nuevo» o «Ver los datasets nuevos», null cuando no hay aviso.
- Las ediciones previas (`leerEdicionesPrevias`, de las fechas de `fechasPrevias`: las de las repeticiones anteriores a la edición, sin repetir): una consulta con `tipo = 'regular' AND fecha_edicion IN (?)`, y un `Map` de la fecha a `{ id, rpad_ids }`, con los `rpad_id` que citan sus propuestas en su `metadata`.
  Se mira lo que el bot citó y no el enlace que quedó guardado; sin fechas, no consulta.
  La leen el recibo (`docs/temas/dato-quincena-contrato.md`), `ver` y el mail (`docs/temas/dato-quincena-correo.md`); sin columnas nuevas ni migración: todo sale de `metadata`, que ya se guarda entera.
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
- `tests/fixtures/dato-quincena-respuestas.json`, inventado, es el contrato entre el servidor y la página (`detalle_con_repeticion`, una edición con repeticiones, con y sin enlace; `detalle_con_datasets`, la edición de prueba con tres propuestas de datasets, una de cada prioridad; y `detalle_datasets_vacia`, la misma con la lista vacía; `detalle_equipo_coincide` y `detalle_equipo_otra`, la edición de prueba con la principal del equipo): `tests/dato-quincena-reglas.test.js` le compara lo que arman las reglas, con las claves en su orden;
  `tests/dato-quincena-api.test.js`, la forma de las respuestas reales;
  y `tests/dato-quincena-frontend.test.js` dibuja la página con él y controla sus claves.
  Una clave que cambia en el servidor obliga a cambiar el fixture.

## La página: dato-quincena.js

- Herramientas → El dato de la quincena: `dato-quincena.html` (con la carcasa, `main.css` y su `<style>` con los tokens `--sg-*` de Proyectos y las clases `dq-`; sin `publico.css` ni `aria-current` en el HTML) y `js/dato-quincena.js`, como la maqueta aprobada.
  El título, con el `newspaper` de Lucide, y la bajada: «Las propuestas de comunicación que arma Datito cada dos lunes, tal como llegaron. Son internas: guardarlas acá no las aprueba ni las publica. El RPAD las manda por correo a las personas de la lista.».
  El nombre sale de una constante de la página (`NOMBRE_DEL_BOT`) y de la del servidor, porque es provisorio; el HTML no lo repite.
  Administración ve además dos pestañas, «Ediciones» y «Correo» (`docs/temas/dato-quincena-correo.md`); los demás roles, la página sin pestañas.
  Sin sesión, al login; cualquier rol con sesión ve la página entera.
- La lista (sin `?id=`; `?anio=AAAA` elige el año): los años como botones con su cantidad (`aria-pressed`), solo si hay más de uno, la cantidad del año («Ediciones de 2026: 27») y las tarjetas «tipo diario» de a tres (dos debajo de 960 px, una debajo de 560 px), con páginas de a 18.
  Cada tarjeta lleva «El dato de la quincena» y el N.º (o la marca «Piloto N») con una doble línea, el día, la fecha grande y el año, la cantidad de propuestas, el rótulo y el título de la principal que cuenta (hasta tres renglones) y la pastilla del envío.
  Un solo enlace, en la fecha, se estira a toda la tarjeta; no hay miniaturas.
  Las páginas: «Anterior», «Página 1 de 2» con «Mostrando 1–18 de 27» y «Siguiente»; con una sola, nada.
  El año y la página elegidos quedan en la dirección (`?anio=AAAA&pagina=N`, con `history.replaceState`); al cambiar de año, la página 1; uno pedido sin ediciones, con otros que sí tienen, vuelve a la lista sola.
- El detalle (`?id=N`), como la maqueta A «Diario» aprobada: «Todas las ediciones» y una hoja blanca con la cabecera de las tarjetas («El dato de la quincena» con el N.º o la marca, la fecha grande y el título del paquete) y, pegadas a su doble línea, las pestañas de la edición.
  Las pestañas son «General», «Propuestas» y «Datasets nuevos», esta solo si la edición trae la clave (con `[]` también, en cero), cada una con su número de `cantidades`; sin `cantidades` (un servidor de antes), sin número.
  Se ven como secciones de un diario, distintas de las de página de administración: la elegida, en tinta y con una barra gruesa debajo.
  Es un `tablist` con un `tabpanel` por pestaña (`aria-selected`, `aria-controls`, `aria-labelledby`); solo la elegida está en el orden del teclado, y las flechas (dando la vuelta), Inicio y Fin cambian de pestaña (`vistaVecina`); con Alt, Ctrl o Meta, no.
  Los paneles se dibujan juntos al cargar y los otros quedan con `hidden`: cambiar de pestaña no pide nada ni vuelve a cargar la infografía.
  Cambiar de pestaña mueve el foco a la elegida y, si las pestañas quedaron arriba de la vista, la página sube hasta ellas; con el teclado, la fila de pestañas también corre hasta la elegida.
  Si no entran (debajo de 360 px), la fila de las pestañas corre de costado, sin barra a la vista, en lugar de encimarlas; por eso su filete de abajo y la barra de la elegida van por dentro.
  La primera pestaña deja 8 px a la izquierda: el anillo del foco va por dentro y, sin ellos, taparía la «G».
- La dirección: `&vista=` elige la pestaña (`general`, `propuestas` o `datasets`) y `&propuesta=K`, en Propuestas, la propuesta de `orden` K (sin `orden`, la de la posición K); se leen como el `id`, de una lista cerrada y enteros positivos sin ceros adelante.
  Otro valor, `datasets` en una edición sin la clave, una propuesta que no existe o `&propuesta=` fuera de Propuestas abren General o la principal, y la dirección se corrige.
  `urlDeEstado` escribe `&vista=` solo si no es General y `&propuesta=` solo en Propuestas; cambiar de pestaña o de propuesta la reemplaza (`history.replaceState`): Atrás no recorre las pestañas ni las propuestas.
  El `#correo` queda como estaba, así que pasar a Correo y volver a Ediciones vuelve a la misma pestaña y propuesta.
- General: arriba, a lo ancho, la franja de la principal del equipo (`docs/temas/dato-quincena-principal-equipo.md`); a la derecha, «La principal de Datito» (la marcada o, si ninguna, la primera) con su título, sus etiquetas sin «Principal», su cifra grande, «Dataset:» con los enlaces de siempre y un botón con `ver_propuestas`, que pasa a Propuestas en la principal; debajo, «Nota de Datito:» si hay y el renglón de la llegada, el correo y la cantidad (el punto lo pone la página).
  A la izquierda, la infografía grande con su pie («La infografía de la principal de Datito.»), una sola en el detalle; debajo de 820 px, primero la principal (el orden del HTML) y después la infografía.
  A lo ancho, la agenda, «Archivos» en una fila (con «Descargar» en cada uno y «Ver» en el texto y los cálculos), el aviso de los datasets nuevos (`aviso_datasets_nuevos` con un botón con `ver_datasets_nuevos` a su pestaña, solo si hay aviso y pestaña) y, para administración, la caja «Correo».
  Sin `ver_propuestas` o `ver_datasets_nuevos` (un servidor de antes), los botones dicen «Ver las propuestas» y «Ver los datasets nuevos».
  En el teléfono la hoja llega a los bordes y las tres pestañas entran en un renglón (el texto puede ir en dos); sin scroll horizontal desde 360 px.
- La agenda (`htmlDeLaAgenda`): `agenda_grupos` en el orden del servidor, cada grupo en su columna, tantas como grupos trae (una debajo de otra debajo de 820 px), con su título en un `h4` (`.dq-agenda-grupo`) y sus eventos como una línea de tiempo corta, sin la pastilla «Efeméride» (el título del grupo ya lo dice).
  Cada evento, la fecha, el título, el detalle y «Ver» si la dirección es `https://`, separados por un espacio; un grupo sin eventos no se dibuja.
- Propuestas (`htmlDelPanelPropuestas`): a la izquierda, un índice fijo al bajar (`.dq-indice`, 272 px) y, a la derecha, una propuesta por vez (`htmlDeLaPropuestaElegida`): la de `&propuesta=` o, sin él, la del equipo si hay y, si no, la principal de Datito (la marcada o, si ninguna, la primera).
  Cada renglón del índice lleva el número de `orden` (sin `orden`, la posición), el título en dos renglones y las marcas «Datito» y «Equipo» (la principal de cada uno) y «Para validar» (la etiqueta Validar o notas de validación, con su ícono); se lee «Propuesta N:» (`orden_texto`) en lugar del número suelto.
  La que se ve lleva `aria-current` y, además del fondo, una barra de tinta a la izquierda (en los chips, el borde grueso y la barra abajo): no es solo el color.
  El CSS la marca con `[aria-current]` sin valor, porque `tests/paginas.test.js` no deja escrito `aria-current` con un valor en una página de administración.
  Elegirla en el índice o con «Anterior» y «Siguiente» la vuelve a dibujar en `.dq-lectura`, marca el índice sin redibujarlo, pasa el foco a su título (`h3` con `tabindex="-1"`), reemplaza la dirección con `&propuesta=K` y, si quedó arriba de la vista, sube hasta ella.
  Un número que la edición no tiene no cambia nada; «Ver las N propuestas» de General vuelve a la del equipo o, sin ella, a la de Datito.
  Debajo de 820 px, el índice es una fila de chips que corre de costado hasta la elegida, también al abrir la página o la pestaña.
- La propuesta que se ve, en un `<article>` nombrado por su título: arriba, el número, las etiquetas, el título grande y la cifra destacada.
  Las etiquetas: «Principal de Datito» en tinta (y «Principal del equipo» en la del equipo), «Agenda» en cielo, «Validar» en sol con el `triangle-alert` y «Repite» en blanco con un borde por dentro y el `history`; «Efeméride», el estilo neutro de `.dq-etiqueta`: nunca solo el color.
  Después, en una tira, «Dataset:» (con enlace a `dataset.html?id=N` solo con `id_enlace`) y «en el portal», y la foto del RPAD; si hay, la repetición y «Para validar antes de publicar», bien visible (un filete ámbar grueso).
  La repetición (`.dq-repite`, neutra, con los márgenes de `.dq-validar`): el `history`, alineado con el primer renglón, y el `texto` en negrita, como enlace a `dato-quincena.html?id=<id_edicion>` solo si `idDeEdicion` lo acepta, y abajo el `motivo`.
  El enlace va subrayado: `main.css` le saca el subrayado a todo `<a>` y el texto ya es negrita y tinta, así que sin él no se distinguiría del texto sin enlace.
  En dos columnas (una debajo de 960 px), «Por qué hoy», «Ángulo» y «Puntos centrales» | «Texto para redes», como tarjeta de publicación, con su «Copiar».
  A lo ancho, el borrador como artículo (68ch) con su «Copiar» e «Idea de placa»; plegados (`<details>` cerrados), «Cómo se calculó», «Contexto histórico» y «Fuentes».
  Al pie, «Copiar la propuesta» y «Anterior» y «Siguiente» con el título de la vecina en un renglón (sin «Anterior» en la primera ni «Siguiente» en la última).
  Lo largo sin cortes no ensancha nada: el índice y la propuesta llevan `overflow-wrap: anywhere` y sus columnas, `minmax(0, …)`.
- Datasets nuevos (`htmlDeLosDatasetsNuevos`, en su pestaña, sección `.dq-nuevos`, verde muy claro): el título «Propuestas de datasets nuevos», la matriz con la lista al lado (debajo en el teléfono) y una tarjeta blanca por propuesta.
  Con `propuestas_datasets` en null (o algo que no es una lista), no hay pestaña; con `[]`, el título y «Esta quincena no hay propuestas de datasets.».
  La matriz (`htmlDeLaMatriz`) es una `<table>` con encabezados de fila (riesgo) y de columna (valor) y las 9 celdas de `matriz_de_prioridad`: la clase de la zona sale de un mapa con `Object.hasOwn` y el texto se ve solo con `con_rotulo` (en las otras va oculto); la de `no_se_propone` va rayada además de roja.
  Cada dataset es un botón con su `numero` en la celda de su `valor` y `riesgo`; la página nunca calcula una zona, y sin `matriz_de_prioridad` no hay matriz, pero sí la lista y las tarjetas.
  Matriz y lista van lado a lado desde 1100 px; la tarjeta tiene cabeza verde con el número grande, título grande, «Por qué abrirlo» de entrada (su `h5` va oculto), la ficha en grilla y los enlaces en dos columnas.
  La lista (número, título, prioridad, eje) y los marcadores (`data-ir-nuevo`) llevan a la tarjeta (`#dq-nuevo-N`): el foco va a su título y la página sube hasta ella.
  Cada tarjeta, en este orden: el número y los orígenes (etiquetas neutras), el título (`h4`), la prioridad con `valor_y_riesgo` al lado, «Por qué abrirlo», «Formato sugerido», «Campos sugeridos» (en monoespaciada) y, solo si hay, «Cómo anonimizar» (con el estilo de «Para validar») y «Datasets relacionados en el portal»; al final, «Fuentes».
  La clase y el ícono de la prioridad salen de un mapa con la clave del servidor (`alta` verde con `check`, `si_hay_recursos` azul con `info`, `evaluar` ámbar con `shield`) y `Object.hasOwn`, nunca del texto: una clave desconocida va sin clase ni ícono, con su texto.
  El texto de la prioridad la dice siempre, así que el color no es lo único que la distingue.
  La justificación y la anonimización van en `.dq-texto` (respeta los saltos de línea) y la tarjeta lleva `overflow-wrap: anywhere`.
  Un relacionado o una fuente es un enlace solo si empieza con `https://`; si no, va su texto.
  Sin «Copiar»; la tarjeta de la lista no muestra las propuestas de datasets.
- «Copiar», tres por propuesta, con el texto tal como llega del servidor: en el texto para redes (`texto_redes`), en el borrador (`borrador_para_copiar`) y al pie (`para_copiar`).
  Sus nombres (`aria-label`) dicen qué copian y contienen el texto que se ve, para quien maneja la página con la voz (WCAG 2.5.3): «Copiar el texto para redes», «Copiar el borrador» y «Copiar la propuesta (Propuesta N)».
  Con `navigator.clipboard.writeText`: el botón dice «Copiado» dos segundos; si falla, «No se pudo copiar: seleccioná el texto.» cinco segundos; los dos se anuncian en `#dq-anuncio`, la región viva que no se redibuja.
- «Ver» abre `#dq-modal` con el texto en un `<pre>` puesto con `textContent` y su «Descargar», que baja lo mismo sin volver a pedirlo; se cierra con la ×, «Cerrar», Escape o un clic que empieza en el velo, y el foco vuelve al botón.
  Las imágenes y los archivos se piden con `API.pedirArchivo` (el JWT en el encabezado, nunca en la dirección): una imagen va en un `<img>` desde un `blob:`, liberado al pasar a Correo y al salir (no si la página queda guardada para «Atrás»), y «Descargar» guarda con el `nombre` del servidor.
- Los estados: «Cargando…», el error («No se pudieron cargar las ediciones. Probá de nuevo en unos minutos.»), el vacío («Todavía no llegó ninguna edición. Datito manda cada una cada dos lunes.») y una edición que no existe («No existe esa edición.» con «Todas las ediciones»; un `id` que no es un entero positivo lo dice sin pedirlo).
  Si falla «Descargar» o «Ver», un aviso: «No se pudo descargar el archivo. Probá de nuevo en unos minutos.» o «No se pudo abrir el archivo. Probá de nuevo en unos minutos.».
  Una infografía que no llega deja su lugar vacío, sin aviso.
  Un 401 cierra la sesión y va al login; con `API.pedirArchivo`, que no da el estado, si `Auth.isTokenExpired()`.
  Una respuesta que llega después de otra más nueva se descarta.
- Las convenciones de siempre: al cargarse, el script solo declara y engancha `DOMContentLoaded`; lo que arma HTML es puro y recibe los datos por parámetro (`tests/dato-quincena-frontend.test.js` lo carga en un `vm` después del `main.js` y el `api.js` de verdad); lo que toca el DOM o la API va al final, con los eventos (los clics y las teclas de las pestañas) delegados en `#dq-contenido` y en el modal.
  La página no recalcula nada: imprime los textos del servidor, todos por `Utils.escapeHtml` (también en `data-`, `alt` y `aria-label`), y un número con `String`.
  Una dirección de afuera solo es un enlace si empieza con `https://`, con `rel="noopener noreferrer"`.
- El menú: «El dato de la quincena» va al final de Herramientas, después de Seguimiento, en las 15 páginas con carcasa, con el `newspaper` de Lucide escrito en el HTML, el mismo del título: no está en `ICON_SELECTOR_MAP`, donde aparecería como ícono elegible en Proyectos, ni en `Icons` (tocar `main.js` sube `VERSION` en todas las páginas).
  Lo ve cualquier sesión: `updateSidebarAuth` ya muestra Herramientas con sesión.
  La ayuda del lector en Configuración (`AYUDA_DEL_ROL` de `usuarios.js`) lo nombra entre sus Herramientas.
- `dato-quincena.js` lleva su propia constante, `VERSION_DATO_QUINCENA` (`tests/paginas.test.js`).

## Lo que no cambia

- Datasets, la doble verificación, los cambios pendientes, el historial de actualizaciones, los hitos y Proyectos (sus subidas incluidas), Métricas y la foto del 31/12, las Tareas Cron, la CSP y las dependencias.
  Salvo el paso del correo en las corridas de las 8:05 y las 14:00 y su línea y sus alertas en Correos → Estado (`docs/temas/dato-quincena-correo.md`).
  La copia del mail que se manda Datito es suya: el RPAD no la manda ni la lee.
  El mail al equipo, su lista y su corrida sí son del RPAD, y están en `docs/temas/dato-quincena-correo.md`.
- El enlace desde cada dataset queda para otra etapa: `dato_quincena_propuestas` ya tiene el `dataset_id` con su índice.

## Archivos de tests

`dato-quincena-reglas.test.js`, `dato-quincena-api.test.js`, `dato-quincena-frontend.test.js` (los del correo, en su documento), `permisos.test.js`, `paginas.test.js`, `schema.test.js`, `usuarios-frontend.test.js`
