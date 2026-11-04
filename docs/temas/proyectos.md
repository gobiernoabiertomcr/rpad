# Proyectos

Los proyectos de la DDPC con sus hitos y documentos, y los logros del área.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-25-proyectos-design.md`

## Archivos

proyectosController: los proyectos, los hitos, los logros, la línea de tiempo y los archivos;
proyectosReglas (la validación de un proyecto, un hito y un logro con sus mensajes, evidenciaTipo, el nombre de un archivo subido, idPositivo e idsPositivos —una lista de ids sin repetidos: las áreas de un proyecto y, desde la agenda, las personas de un evento—, puro);
proyectos.html # Proyectos: pestañas Proyectos (carriles), Línea de tiempo y Logros del área, y el detalle ?id=N (proyectos.js); reemplaza a gestion.html

## Proyectos (spec 2026-10-25-proyectos)

- Qué es:
  Herramientas → Proyectos (`proyectos.html` + `js/proyectos.js`, con su `<style>` y los tokens `--sg-*`, sin `publico.css`), la página que reemplazó a Gestión: los proyectos de la DDPC con sus hitos y documentos, y los logros del área (hitos con `proyecto_id` NULL), en las pestañas Proyectos (carriles de 3 años), Línea de tiempo (`#linea`) y Logros del área (`#logros`), y el detalle `?id=N`.
  Los hitos de cada año salen en el Informe anual (`hitosDelAnio`, sin cambios).
  Sin tablas nuevas ni migración.
  Los textos, las medidas y el dibujo están en la spec; acá, los contratos.
- Quién: la ven todos los roles con sesión; el lector y el colaborador ven todo y bajan y previsualizan los documentos y los archivos (decisión del usuario).
  Escribe solo administración (la página muestra los botones con `Auth.isAdmin()`; el servidor valida igual).
- API (`controllers/proyectosController.js`; la validación, pura, en `services/proyectosReglas.js`; las direcciones siguen en `/api/gestion/…`): con `authMiddleware`, las lecturas (`GET /gestion/proyectos`, `/gestion/proyectos/:id`, `/gestion/timeline`) y las descargas (`GET …/documentos/:docId/descargar`, `…/archivos/:archivoId/descargar`); con `authMiddleware` + `adminOnly` (lector y colaborador, 403;
  `RUTAS_SOLO_ADMIN` de `tests/permisos.test.js`), las escrituras:
  `POST`, `PUT` y `DELETE /gestion/proyectos[/:id]`, `POST /gestion/logros`, `POST /gestion/proyectos/:proyecto_id/hitos`, `PUT` y `DELETE /gestion/hitos/:id`, las subidas (`POST /gestion/proyectos/:id/documentos` y `/gestion/hitos/:id/archivos`, campo `archivos`) y los `DELETE` de documentos y archivos.
  Fechas como texto `'AAAA-MM-DD'` (`DATE_FORMAT`;
  `subido_el`, con `UNIX_TIMESTAMP` + `ahoraArgentina`), `hitos_completados` con `hoyArgentina()` y sin N+1.
- Respuestas:
  `{ success, data?, message? }` (altas y subidas, 201).
  Un error de validación es 400 `{ success: false, error, campo, errores }`, con `errores` como lista `[{ campo, mensaje }]` (`primerError`; las notas DGMIT mandan un objeto); una edición sin nada para guardar, 400 con `campo` null.
  Orden: un id que no pasa `idPositivo`, que no existe, dado de baja o un hito de un proyecto dado de baja → 404; la validación → 400; áreas que no existen → 400 en `areas`.
  Los `PUT` validan con `{ parcial: true }` (lo que no viene no se toca; un nombre vacío es error) y `areas` presente las reemplaza todas.
  `color`, cualquier `#RRGGBB` (no rechaza el «Color actual»); un alta sin color guarda `#3b82f6` (R7).
  Fechas del 01/01/2000 al 31/12 de cinco años después de hoy (`fechaMaxima`).
  `evidencia_tipo` no se recibe: lo deriva `evidenciaTipo` al guardar el hito y al subir o borrar uno de sus archivos.
- Invariantes del servidor:
  - Transacciones (`enTransaccion`: un 2xx confirma; otro status o un error deshace): crear y editar un proyecto con sus áreas; crear, editar y borrar un hito; subir archivos (la cantidad y los INSERT); borrar un documento o un archivo (la fila y el `evidencia_tipo` del hito).
    `createLogro` es un solo INSERT y `deleteProyecto` un solo UPDATE (baja con `activo`: sus hitos dejan de salir también en los Informes anuales).
  - Ningún archivo huérfano: antes de multer, `prepararSubidaProyecto` y `prepararSubidaHito` validan el id, que el proyecto (activo) o el hito existan y que queden lugares (si no, 404 o 400 sin escribir nada) y dejan `req.subida = { id, carpeta, lugares }`;
    `subida(tipo)` (`config/upload.js`) arma multer en cada pedido (`limits.files` = los lugares, 10 MB, un filtro y un almacén propios): después del primer error descarta sin escribir lo que sigue, borra lo que el pedido escribió y responde cuando terminó de leerlo (`responderAlTerminarDeLeer`: si no, quien seguía mandando recibía un corte en lugar del 400).
    Si falla la transacción de los INSERT, el controlador borra lo escrito.
    Borrar un documento, un archivo o un hito (su carpeta) toca el disco después del commit; un error del disco se registra y no cambia la respuesta.
  - Rutas: las carpetas son `proyectos/<id>` y `hitos/<id>`, con el id de `idPositivo`.
    `rutaSegura(relativa)` da la ruta absoluta si cae dentro de la carpeta de las subidas (compara con el separador final:
    `uploads-otra` no pasa; una absoluta que cae adentro, sí) y null si queda afuera, es la carpeta misma, no es un texto o trae un carácter nulo;
    `rutaDeArchivo` exige además un nombre suelto.
    La carpeta es `UPLOADS_DIR` (absoluta) o `uploads/` junto a la aplicación (los tests usan una temporal; en producción no se define).
  - Archivos: el nombre original pasa de latin1 a UTF-8 (`nombreOriginal`) y uno de más de 255 caracteres se corta conservando la extensión (`nombreDeArchivo`, R8); en el disco, un UUID con la extensión.
    Extensión y MIME se controlan por separado (`EXTENSIONES_PERMITIDAS`, `MIMES_PERMITIDOS`).
    R15: un `.csv` se acepta con `text/csv`, `application/vnd.ms-excel` (Windows con Excel instalado), `text/x-csv`, `application/csv` o `text/comma-separated-values` (Linux y Android): rechazarlo después de guardar el hito era hostil, y se sirve como adjunto y con nosniff.
    Las descargas, con `res.sendFile` y `disposicionDeAdjunto`; un archivo que falta en el disco da 404 `MENSAJE_ARCHIVO_FALTANTE`, y uno de otro proyecto u otro hito, o de un proyecto dado de baja, 404.
  - Errores de una subida, en español:
    `MENSAJE_MAXIMO_POR_HITO` y `…_POR_PROYECTO` (también con un archivo en otro campo), `MENSAJE_TAMANO_MAXIMO`, `mensajeTipoNoPermitido(extension)`, `mensajeMimeNoPermitido(nombre)` («El tipo de archivo de <nombre> no está permitido.») y, con un pedido que no se pudo leer, `MENSAJE_SUBIDA_ILEGIBLE` (el texto de multer, solo en la consola); un error del disco, 500 «Error al subir archivos».
    Una subida bien hecha: 201 con «1 documento subido», «3 archivos subidos».
  - Anotado, sin migración:
    `proyectos.created_by` tiene `ON DELETE CASCADE`, pero los usuarios no se borran.
- La página (las copias del servidor y sus paridades, en la convención de `proyectos.js`;
  `mensajeMimeNoPermitido` y `MENSAJE_SUBIDA_ILEGIBLE` no se copian: el navegador no controla el MIME y muestra el mensaje del servidor):
  - Lo elegido en la lista viaja en la dirección (`history.replaceState`, solo lo que no es de entrada) y el detalle lo conserva.
    El buscador se dibuja una vez y no se le cambia el valor mientras tiene el foco (el redibujo del `ResizeObserver` pisaba una letra con tilde a medias).
    Lo que cambia se anuncia una vez en `#pr-anuncio`, la región viva que no se redibuja; lo que se redibuja no lleva `aria-live` ni `role="status"` (R17).
  - Nunca dice «guardado» si algo falló: si el hito se guarda y la subida no, el modal queda abierto con «El hito se guardó, pero los archivos no se subieron: <motivo>.» y «Guardar» manda el `PUT` del hito ya creado solo si cambió algo (nunca un segundo hito) y reintenta la subida.
    Guardar y confirmar deshabilitan su botón hasta la respuesta; mientras se guarda un hito, su modal no se cierra (Escape, la ×, «Cancelar», el velo) ni cambian sus archivos (`seEstaGuardandoElHito`).
    Un error del servidor va a su campo (`aria-invalid`) o, sin campo, dentro del modal.
  - Las confirmaciones son `#modal-confirmar` (no `confirm()`; textos de `textoDeConfirmacion`).
    Después de eliminar un archivo, un documento o un hito, el foco va a lo más cercano de la misma lista y el mismo panel (`respaldoDeLaEliminacion`), no a «Ver todos los proyectos».
    «Ver» (imágenes y PDF, desde un `blob:`) tiene «Descargar» en el pie: en el teléfono un PDF no se ve en el `<iframe>`.
- El renombre:
  `GET /gestion.html` → 302 a `/proyectos.html` (`app.js`, antes de `express.static`), sin fragmento: el navegador conserva `#metricas`, que abre Proyectos con el aviso «Las métricas de Gestión ahora están en Herramientas → Métricas y Reportes.» y lo saca de la dirección.
  Métricas y Reportes conserva «CSV de Gestión (últimos 12 meses)» y «…que estaban en Gestión.» (el CSV de `/gestion/metricas/csv` no cambió:
  R18).
- Otras decisiones:
  R3, «Subido el dd/mm/aaaa» con `subido_el`;
  R11, la frase del año cuenta los logros dentro de «N hitos»;
  R12 y R13, un hito sin nada dice «Sin descripción, enlace ni archivos.» y la banda de la cinta nunca arranca antes del primer evento, y su parte clara llega al último posterior a hoy;
  R14, el ícono de un proyecto nuevo es `folder`, uno desconocido se edita como `clipboard-list`, el color guardado se conserva tal cual, los repetidos se comparan en NFC y los textos no llevan `maxlength`.
- Tests:
  `proyectos-reglas.test.js` (puro), `proyectos-api.test.js` (Docker y candado; base `rpad_test_proyectos_api`, `UPLOADS_DIR` en una temporal:
  CRUD, cada 400, los 404, transacciones, permisos, subidas —el CSV de Excel y el MIME rechazado—, descargas, «una subida que falla» deja la carpeta como estaba y la dirección vieja), `upload-subida.test.js` (sin base ni candado: el `subida()` de verdad mientras multer lee:
  la carrera de los huérfanos, los MIME del CSV, el pedido ilegible), `proyectos-frontend.test.js` (`proyectos.js` en un `vm` con los datos de la maqueta, anonimizados, de `tests/fixtures/proyectos-maqueta.json`, y un DOM y un `fetch` falsos), `permisos.test.js`, `paginas.test.js` (`VERSION_PROYECTOS`, sin `gestion.html` ni `gestion.js`, el menú) y los textos en `reportes-pdf`, `reportes-frontend` y `usuarios-frontend`.

## La página: proyectos.js

- `proyectos.js` (Herramientas → Proyectos; ver «Proyectos»): al cargarse solo declara (`tests/proyectos-frontend.test.js` lo carga en un `vm` después del `main.js` de verdad —`getIconSvg` e `ICON_SELECTOR_MAP`— y del `api.js` de verdad, como la página, y también con un DOM falso y un `fetch` falso que anota cada pedido y puede tardar).
  Lo que arma HTML y lo que calcula es puro y recibe por parámetro quién mira (`esAdmin`: solo el `true` literal) y "hoy":
  la dirección (`estadoDeLaUrl`, `urlDeEstado`, `estadoConVentana`, `estadoDeLaLista`, `urlDeLaLista`), la ventana (`extremosDeAnios`, `ventanaDe`), los filtros y el orden (`filtrarProyectos`, `cantidadesDeFiltros`, `ordenarProyectos`), los puntos de un carril (`puntosDelCarril`, que recibe el ancho de la pista en px), la frase del año (`fraseDelAnio`), los filtros en tres partes (`htmlDelBuscador`, que se dibuja una sola vez, `htmlDeChipsDeEstado` y `htmlDeSegundaFila`),
  los carriles (`htmlDeCarriles`), la ficha (`htmlDeFicha`), la cinta (`cintaDelProyecto`, con sus x y sus filas de etiquetas, y `svgDeCinta`), las filas (`htmlDeHito`, `htmlDeArchivos`, `htmlDeDocumentos`), el detalle, la línea de tiempo y los logros (`htmlDeDetalle`, `htmlDeLinea`, `htmlDeLogros`), los formularios (`valoresDelProyecto`, `valoresDelHito`, `erroresDelProyecto`, `erroresDelHito`, `htmlDeColores`, `htmlDeIconos`, `htmlDeAreas`, `htmlDeMuestra`),
  los archivos elegidos (`problemaDeArchivo`, `htmlDePendientes`, `htmlDeVistaPrevia`, solo con un `blob:`) y las confirmaciones (`textoDeConfirmacion`, texto plano para `textContent`).
  Lo que toca el DOM o la API va aparte, al final (`iniciarProyectos`, enganchado a `DOMContentLoaded`, con los eventos delegados en contenedores fijos: volver a dibujar no engancha nada).
  Pide los datos con `API.pedirJson`, los archivos con `API.pedirArchivo` + `descargarBlob` (local, copiado de `seguimiento.js`;
  JWT en el encabezado, nunca en la URL) y sube con `subirArchivos`, un `fetch` POST propio con `FormData` (el campo `archivos`) y `Auth.getAuthHeaders()` sin `Content-Type` (`api.js` no cambió); con un 401, `Auth.clearSession()` y al login (en `API.pedirArchivo`, que no da el estado, si `Auth.isTokenExpired()`).
  Las fechas llegan como texto `'AAAA-MM-DD'` (también `subido_el`) y se cortan como texto; los días se cuentan con `Date.UTC` sobre sus partes;
  "hoy" es `Utils.hoyEnArgentina()`.
  Todo texto del servidor pasa por `Utils.escapeHtml` (también en los `title` y los `aria-label`), un color llega a un `style` solo si es `#RRGGBB` (si no, `#1A365D`) y un número se escribe con `String`.
  Copias mínimas, para avisar en el momento (el servidor valida igual), atadas por tests de paridad:
  `MENSAJES_PROYECTOS`, `LARGOS_PROYECTOS`, `FECHA_MINIMA_PROYECTOS` y `fechaMaxima` (copias de `MENSAJES_PROYECTOS`, `LARGOS`, `FECHA_MINIMA` y `fechaMaxima` de `services/proyectosReglas.js`), `ESTADOS`, `PRIORIDADES`, `CATEGORIAS` e `ICONOS` (copias de `ESTADOS_PROYECTO`, `PRIORIDADES`, `CATEGORIAS` e `ICONOS_PROYECTO`;
  `ICONOS`, también contra `ICON_SELECTOR_MAP` de `main.js`), `EXTENSIONES_PERMITIDAS`, `TAMANO_MAXIMO`, `MAXIMO_POR_HITO`, `MAXIMO_POR_PROYECTO`, `MENSAJE_MAXIMO_POR_HITO`, `MENSAJE_MAXIMO_POR_PROYECTO`, `MENSAJE_TAMANO_MAXIMO` y `mensajeTipoNoPermitido` (copias de las de `config/upload.js`), `CAMPOS_DEL_FORMULARIO` (sus claves son los `campo` de los errores del servidor)
  y `erroresDelProyecto` y `erroresDelHito` (la validación de `validarProyecto` y `validarHito` en un alta, comparada en los casos de borde; cuentan con `Array.from`, como el servidor);
  `PALETA` se compara con los 10 colores de la spec.
  Solo del navegador, con tests de comportamiento: los repetidos de `problemaDeArchivo` («Ya hay un archivo llamado <nombre>.», en la misma tanda o con lo que ya tiene el hito o el proyecto, comparados en NFC: el servidor no rechaza nombres repetidos, los guarda con un nombre único en el disco).
  Los textos no llevan `maxlength` (cuenta unidades de UTF-16: un emoji son dos).

## Archivos de tests

`proyectos-frontend.test.js`, `permisos.test.js`, `proyectos-reglas.test.js`, `proyectos-api.test.js`, `upload-subida.test.js`, `paginas.test.js`
