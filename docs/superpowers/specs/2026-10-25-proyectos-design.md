# Proyectos: la página Gestión pasa a llamarse Proyectos, con el estilo del Seguimiento

Fecha: 25/10/2026. **Estado: borrador para revisar.**

**Maqueta navegable:** `2026-10-25-proyectos-mockups/proyectos.html`.
- **Cómo se mira:** con un servidor estático (el preview `proyectos-maqueta`, puerto 3022). Usa la carcasa y el `main.css` reales.
- **Los datos:** son los 8 proyectos y 14 hitos de la base local del 25/10/2026. Los nombres de las personas están cambiados por nombres inventados. También son inventados el hito previsto del Datathon 2026 y los dos logros del área.
- **El recuadro oscuro** de abajo a la derecha es de la maqueta, no de la página. Cambia:
  - la lista: A tabla, B tarjetas o C carriles;
  - los años de los carriles: 5 con selector o 3 con flechas;
  - el detalle: 1 filas o 2 cinta;
  - quién mira;
  - el ícono del menú.
- **Las elegidas:** C carriles con 3 años y flechas, el detalle 2 con la cinta y el ícono de carpeta con tablero.
- La maqueta no guarda nada. Donde no coincidan, manda este documento.

**Orden de implementación: va al final de la cola** (decisión del usuario, 25/10/2026). La implementación arranca cuando estén en main el Generador de Notas (`feat/generador-de-notas`, en curso) y Configuración (`feat/configuracion`, que arranca después del Generador). Las dos tocan los mismos archivos que esta entrega: el menú de las páginas con carcasa, `tests/paginas.test.js`, `app.js`, `public/js/usuarios.js`, `CLAUDE.md` y `README.md`. La primera tarea del plan trae main a esta rama y relee el código actualizado (sección 12).

## Por qué

Desde el 25/10/2026 las métricas viven en Herramientas → Métricas y Reportes, y la página Gestión (`gestion.html`) quedó solo con los proyectos. El nombre ya no dice lo que hay adentro, y la página tiene otro lenguaje visual que el Seguimiento y Métricas y Reportes, las dos herramientas nuevas.

**Para qué sirve la página.** El usuario marcó cuatro usos:
- el equipo carga ahí su trabajo: proyectos, hitos y documentos;
- otras personas con sesión entran a ver qué se hizo;
- los hitos de cada año salen en el PDF del Informe anual;
- hoy casi no se usa.

Por eso la página nueva tiene que mostrar de un vistazo qué se hizo y cuándo, e invitar a cargar.

**Además, el relevamiento encontró errores** (sección 9). Los más visibles:
- el lector ve «Ver» y «Descargar» en los documentos, pero el servidor le responde 403;
- la × para quitar un archivo antes de subirlo nunca funciona;
- si falla una subida, la página igual dice «guardado» y los archivos se pierden;
- borrar un hito deja sus archivos en el disco;
- los cuatro modales no se pueden usar con el teclado: no tienen Escape ni foco.

Del lado del servidor no hay transacciones ni validaciones, y no hay ningún test de proyectos, hitos ni archivos.

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- **Una página nueva,** `proyectos.html` + `js/proyectos.js`, con el lenguaje del Seguimiento y de Métricas y Reportes: tokens `--sg-*`, tarjetas blancas sin sombra, píldoras, insignias con cuadradito, filas que se despliegan y modales.
- **Tres pestañas:** Proyectos, Línea de tiempo y Logros del área.
- **La pestaña Proyectos** dibuja un carril por proyecto sobre una ventana de 3 años, con flechas, y «Resaltar un año» para ver lo que sale en el Informe anual.
- **Cada proyecto tiene su dirección** (`proyectos.html?id=N`), con la ficha, la cinta del recorrido, los hitos y los documentos.
- **El lector y el colaborador ven todo y bajan los documentos y los archivos** (decisión del usuario). Solo administración carga, edita y borra, como hoy.
- **Se arreglan los errores** de la página y del servidor que encontró el relevamiento, con tests.
- **El renombre en todo el sitio:**
  - el menú de las páginas con carcasa, con el ícono de carpeta con tablero;
  - la dirección vieja `gestion.html`, que redirige;
  - los textos que dicen «Gestión»: el Informe anual, la tarjeta de Reportes y la ayuda del lector en Usuarios;
  - `CLAUDE.md` y `README.md`.

**No objetivos**
- **No se agregan funciones nuevas:** ni avance en porcentaje, ni responsables por hito, ni comentarios, ni notificaciones.
- **No cambian las tablas** (no hay migración) ni la API de métricas de Gestión: `/api/gestion/metricas`, el CSV y las métricas manuales que usa Métricas y Reportes.
- **La API de proyectos conserva sus rutas:** `/api/gestion/proyectos…`, `/api/gestion/hitos…`, `POST /api/gestion/logros` (los logros se leen de `/api/gestion/timeline` y se editan y borran por `/api/gestion/hitos/:id`) y `/api/gestion/timeline`. Cambian sus validaciones, sus permisos de descarga y el formato de las fechas (sección 9).
- **No cambia qué sale en el Informe anual:** los hitos con fecha en el año, de los proyectos activos y los logros del área. Cambia solo el texto «cargados en Gestión».

**Antiobjetivos**
- **Perder algo de lo que hace Gestión hoy:** un campo del proyecto, el hito o el logro; la subida, la descarga o la vista previa de los archivos; el borrado de un proyecto, de un hito, de un logro, de un documento o de un archivo; un filtro (buscador y categoría).
- **Que un link viejo deje de andar:** un marcador a `gestion.html` o a `gestion.html#metricas`.
- **Que un proyecto parezca vacío por la ventana de años:** sus hitos fuera de la ventana se cuentan en el borde.
- **Que la página diga «guardado» cuando algo no se guardó,** o que un archivo quede en el disco sin su fila (o al revés).
- **Que el lector vea un botón que el servidor le niega.**

## 1. La página

- **URL y archivos:** `public/proyectos.html` + `public/js/proyectos.js`. Se borran `public/gestion.html` y `public/js/gestion.js`.
- **La carcasa:** la de siempre. El encabezado, el menú y el footer son idénticos a los de `index.html`, sin `aria-current` (es de administración) y sin `publico.css`. Lleva su `<style>` con los tokens `--sg-*` copiados del Seguimiento, como hizo Métricas y Reportes.
- **Título y encabezado:**
  - `<title>Proyectos - RPAD</title>`;
  - `h1` «Proyectos» con el ícono de carpeta con tablero (sección 11), con `aria-hidden="true"` en el SVG.
- **La bajada:** «Los proyectos de la Dirección de Datos Públicos y Comunicación, con sus hitos y documentos, y los logros del área. Los hitos de cada año salen en el Informe anual.»
- **El botón del encabezado:** «Nuevo proyecto», solo para administración (`Auth.isAdmin()`).
- **Quién entra:** todos los roles con sesión, como hoy. Sin sesión, va a `login.html`.
- **Pestañas:** las de Métricas y Reportes, con su comportamiento:
  - `role="tablist"`, con flechas, Inicio y Fin;
  - el fragmento en la dirección: `#proyectos` (la inicial), `#linea` y `#logros`;
  - cada pestaña muestra su cantidad: proyectos activos, todos los hitos y los logros.
- **El link viejo de las métricas:** si la página abre con `#metricas` (el de `gestion.html#metricas`, que llega por la redirección), abre Proyectos y muestra arriba el renglón «Las métricas de Gestión ahora están en Herramientas → Métricas y Reportes.», con el link a `reportes.html#metricas`. Sin ese fragmento, el renglón no aparece.
- **Estados de la página:** cargando, error y vacío, uno a la vez, como el Seguimiento:
  - cargando: «Cargando los proyectos…»;
  - error: «No se pudieron cargar los proyectos. Probá de nuevo en unos minutos.», con `role="alert"`;
  - sin ningún proyecto: lo dice la pestaña (sección 2).
- **Sin JavaScript:** un `<noscript>` lo dice.

## 2. La pestaña Proyectos: los carriles

**Los filtros**, arriba de los carriles. Todos viajan en la dirección con `history.replaceState` (sección 2.4).
- **El buscador:** busca en el nombre, la descripción y el autor, sin tildes ni mayúsculas.
- **El estado:** chips con su cantidad: Todos, En curso, Ideas, Completados y Suspendidos. Un estado aparece solo si hay algún proyecto en él o si está elegido.
- **La categoría:** chips «Todas», Tecnología, Normativa y Difusión, con la misma regla.
- **Las cantidades** cuentan lo que dejan los otros filtros, como en Datasets.
- **La ventana de años:** las flechas (2.2).
- **«Resaltar un año»:** chips «Ninguno» y los 3 años de la ventana, cada uno con la cantidad de hitos de ese año.

### 2.1 Un carril por proyecto

Es una tarjeta con un renglón por proyecto. Arriba van los años de la ventana; debajo, la leyenda.

- **El reparto:** 40 % para el proyecto y 60 % para los años (`minmax(0, 2fr) minmax(0, 3fr)`). Lo pidió el usuario, para que los nombres no queden comprimidos.
- **La columna del proyecto:**
  - el cuadrado con su color y su ícono;
  - el nombre (600, tinta);
  - debajo, la insignia del estado y la categoría.
- **La columna de los años:**
  - una línea punteada por cada 1 de enero;
  - la línea de Hoy;
  - cada hito como un punto en su fecha, con el color del proyecto si ya se cumplió (fecha ≤ hoy) o hueco si está previsto;
  - una línea fina del color del proyecto, del primer al último hito que entran en la ventana.
- **Todo el renglón es un link** a `proyectos.html?id=N` (`<a>`). Cada punto tiene su `title`, «dd/mm/aaaa: título», y el renglón lleva un texto oculto para lectores de pantalla: «5 hitos, del 01/08/2021 al 14/08/2025» o «sin hitos todavía».
- **Puntos que se pisan:** dos puntos a menos de su diámetro (15 px) se juntan en uno con la cantidad («2»), con los dos títulos en el `title`. Pasa con RPAD v1.0.0 y v1.4.0, del 30/11 y el 10/12/2025.
  - La función que los junta es pura y recibe el ancho de la pista en píxeles.
  - La parte que toca el DOM mide el ancho real de una pista y vuelve a dibujar cuando cambia (`ResizeObserver`, o `resize` con un pequeño retardo).
  - Los tests la prueban con anchos fijos: el de la computadora y el del teléfono.
- **Sin hitos:** «Sin hitos todavía», en gris.
- **El orden:**
  1. por estado: En curso, Idea, Completado, Suspendido;
  2. por el hito cumplido más reciente, el más nuevo primero;
  3. por nombre.
- **Al final, el renglón «Logros del área»:** con la marca de logro (un cuadrado blanco con el borde tinta y el ícono `award`), «Hitos que no son de un proyecto» y sus logros como rombos tinta. El renglón lleva a la pestaña Logros del área.
- **La leyenda:** Hito cumplido (con el color del proyecto), Hito previsto, Logro del área, Hoy, y «1 antes», Hitos fuera de los años elegidos. Con un año resaltado, suma el año.

### 2.2 La ventana de 3 años con flechas (decisión del usuario)

- **Siempre se ven 3 años:** por defecto, el actual y los dos anteriores (hoy, 2024 a 2026).
- **Las flechas:** van a los costados del texto «2024 a 2026», dentro de una píldora. Cada una corre la ventana un año.
  - Cada flecha tiene su `aria-label`: «Ver 2023 a 2025», «Ver 2025 a 2027».
  - El texto lleva `aria-live="polite"`.
  - Una flecha sin años hacia ese lado queda deshabilitada.
- **Los límites:**
  - el año más viejo con algún hito o fecha de elevación queda en la primera ventana posible;
  - el más nuevo es el mayor entre el año de hoy y el del último hito.
  - Si todo entra en 3 años, las flechas no aparecen.
- **Los hitos fuera de la ventana:** cada renglón cuenta en su borde los que quedaron antes y después, con una píldora blanca: «3 antes», «1 después». Su `title` dice «3 hitos antes de 2024». Así ningún proyecto parece vacío por la ventana.
- **Al correr la ventana:** si el año resaltado queda afuera, el resaltado vuelve a «Ninguno».

### 2.3 «Resaltar un año»: lo que sale en el Informe anual

- **Elegir un año** pinta su columna de amarillo (`#FFF6D6`) en todos los renglones y apaga los puntos de los otros años.
- **Arriba aparece un renglón** con `role="status"`: «En 2025: 7 hitos de 4 proyectos y 1 logro del área. Son los que salen en el Informe anual de 2025.»
  - Cuenta todos los hitos del año, sin los filtros de la lista: el Informe anual no tiene filtros.
  - Sin logros, la frase termina en «… de 4 proyectos.».

### 2.4 La dirección guarda la vista

Los filtros, la ventana y el año resaltado viajan en la dirección: `?estado=en_curso&categoria=difusion&busqueda=indice&anios=2025&resaltar=2025#proyectos` (`anios` es el último año de la ventana).
- Solo se escriben los que no son los de entrada.
- Volver de un proyecto («Ver todos los proyectos» o el botón Atrás) deja la lista como estaba.
- Un valor que no sirve cae al de entrada.

### 2.5 Vacíos

- **Sin ningún proyecto:** «Todavía no hay proyectos.» Para administración suma «Cargá el primero con «Nuevo proyecto».».
- **Ninguno coincide con los filtros:** «Ningún proyecto coincide con lo que buscaste.», con el botón «Ver todos los proyectos», que limpia los filtros.

### 2.6 En el teléfono

- **Debajo de 960 px:** el reparto pasa a 50/50.
- **Debajo de 760 px:** el renglón se apila (el proyecto arriba y su pista abajo, a todo el ancho) y la fila de los años se oculta. Los años siguen en el texto de las flechas.

## 3. El detalle de un proyecto (`proyectos.html?id=N`)

Reemplaza las pestañas. Arriba va el link «Ver todos los proyectos», que vuelve a la lista con sus filtros. El título de la ventana pasa a «<nombre> - Proyectos - RPAD».

**La ficha** (`.pr-tarjeta`):
- **El título:** el cuadrado grande (52 px) con el color y el ícono, el nombre (1,75 rem, 750) y debajo la insignia del estado y la categoría.
- **La descripción completa.**
- **A la derecha, las acciones:**
  - el enlace del proyecto (si es http o https), con un texto que sale de la dirección: «Abrir en GitHub» (github.com), «Abrir el borrador» (docs.google.com o drive.google.com) o «Abrir el enlace»;
  - para administración, «Editar el proyecto» y «Eliminar» (con el borde rojo).
- **Una fila de datos:** Prioridad, Fecha de elevación, Autor o responsable, Áreas, Hitos y Documentos. Un dato vacío es «—».

**La cinta del recorrido** (tarjeta «Recorrido», con «N hitos» a la derecha). Es un SVG como la cinta del Seguimiento: espacio de 1000 de ancho, línea útil de x = 30 a x = 970.
- **El eje:** va del 1 de enero del año del primer evento al 31 de diciembre del mayor entre el año de hoy y el del último evento. Son 2 años como mínimo. Lleva una marca por año y, si son 3 años o menos, una por mes.
- **Los eventos:**
  - los hitos: un rombo verde si ya se cumplieron, un rombo hueco tinta si están previstos;
  - la fecha de elevación: un círculo hueco tinta.
- **La banda:** celeste del primer evento a hoy (o al último, si ya pasó) y clara de hoy al último hito previsto.
- **La línea de Hoy:** con el rótulo «Hoy».
- **Las etiquetas:** el título (cortado a 34 caracteres con «…») y la fecha, en hasta 3 filas, sin pisarse. Si una no entra, no va, pero su marca sigue con su `title`.
- **Sin hitos ni fecha de elevación:** «Sin hitos ni fecha de elevación: la cinta se dibuja cuando haya alguno.»
- **En el teléfono:** la cinta conserva unos 640 px de ancho dentro de un contenedor con desplazamiento horizontal.
- **La leyenda:** Hito cumplido, Hito previsto, Elevación y Hoy.

**Debajo, dos columnas** (1,5 y 1; en una sola debajo de 960 px):
- **Hitos:** con «Nuevo hito» para administración y, si no, «N hitos».
  - Cada hito es una fila que se despliega, como los movimientos del Seguimiento: fecha, marca, título (con «Previsto» si la fecha es futura), primera línea de la descripción y el chevron.
  - Abierta muestra la descripción completa; «Ver la evidencia» (el enlace, si es http o https, con su dominio); los archivos (sección 6); y, para administración, «Editar el hito», «Subir archivos» y «Eliminar».
  - Van del más nuevo al más viejo.
  - Sin hitos: «Este proyecto todavía no tiene hitos. Un hito es un paso cumplido o previsto: una elevación, un lanzamiento, una presentación.», con «Cargar el primer hito» para administración.
- **Documentos:** con «Subir documentos» para administración y, si no, «N documentos».
  - Cada documento muestra el recuadro con la extensión (PDF, DOCX…), el nombre, el tamaño y «Subido el dd/mm/aaaa», con «Ver» (solo imágenes y PDF), «Descargar» y, para administración, «Eliminar».
  - Sin documentos: «Este proyecto no tiene documentos.»
  - Para administración, debajo: «Hasta 10 documentos de 10 MB cada uno.»

**Estados del detalle:**
- cargando;
- no encontrado: un id que no es un entero positivo, que no existe o que es de un proyecto dado de baja. Muestra el `h2` «Proyecto no encontrado» y «No hay ningún proyecto con ese número.», con el link a la lista;
- error, con su `h2`.

La página conserva su `h1` «Proyectos».

## 4. La pestaña Línea de tiempo

Reemplaza a «Timeline».
- **Los filtros:** chips «Todos», «De los proyectos» y «Logros del área», con su cantidad.
- **Los hitos van agrupados por año,** del más nuevo al más viejo. Cada año lleva su título grande (1,3 rem, 750) y «N hitos»; en el año en curso, «N hitos, hasta hoy y lo previsto».
- **Cada hito es una fila que se despliega:** fecha, el cuadradito del color del proyecto (o la marca de logro), el título (con «Previsto» si corresponde), el nombre del proyecto o «Logro del área», «Enlace» o «N archivos» y el chevron.
- **Abierta:** el link al proyecto, la descripción, la evidencia, los archivos y, para administración, las acciones del hito.
- **Sin paginación:** son pocos.
- **Sin hitos con el filtro:** «No hay hitos con este filtro.»

## 5. La pestaña Logros del área

- **Arriba,** el título y la explicación: «Los logros que no son parte de un proyecto: un premio, una presentación, un convenio. Salen en el Informe anual, al final de los logros del año.» Para administración, el botón «Registrar un logro».
- **Los logros:** filas como las de los hitos, del más nuevo al más viejo.
- **Sin logros:** «Todavía no hay logros del área.»

## 6. Formularios, archivos y confirmaciones

**Los modales** son los del Seguimiento (`.modal.pr-modal`):
- `role="dialog"`, `aria-modal` y `aria-labelledby`, con la × con `aria-label="Cerrar"`;
- cierran con Escape, la ×, Cancelar y el velo (solo si el clic empezó en el velo);
- el foco va al primer campo y vuelve al botón que los abrió;
- cada campo tiene `<label for>`, `aria-required`, `aria-describedby` con su ayuda y su error, y `aria-invalid`;
- **el `<form>` envuelve el cuerpo y el pie y es una columna flexible** (`display: flex; flex-direction: column; min-height: 0`): el cuerpo se desplaza y los botones quedan siempre a la vista. Es el problema que encontró Configuración en el modal de Áreas.

**Proyecto** («Nuevo proyecto» / «Editar <nombre>», botón «Guardar el proyecto»):
- **Nombre:** obligatorio, hasta 200 caracteres.
- **Descripción.**
- **Estado:** cuatro opciones grandes con su insignia (Idea, En curso, Completado y Suspendido). Por defecto, Idea.
- **Categoría:** por defecto, Tecnología.
- **Prioridad:** por defecto, Media.
- **Fecha de elevación.**
- **Autor o responsable:** hasta 150 caracteres.
- **Enlace:** `type="url"`, hasta 500 caracteres, con la ayuda «El repositorio, el borrador o la página del proyecto.».
- **Áreas:** casillas con desplazamiento.
- **Color:** una paleta de 10. Reemplaza al selector libre, que admitía colores claros donde el ícono blanco no se lee.
  - Los colores (contraste del ícono blanco, siempre de 3:1 o más): Azul tinta `#1A365D`, Azul oscuro `#0950C6`, Azul `#3B82F6`, Celeste `#2B7AB8`, Petróleo `#0E7490`, Verde `#2E6B4C`, Naranja `#F45000`, Magenta `#CC0066`, Violeta `#6D4BA8` y Gris `#56677F`.
  - Incluye los cuatro colores que ya usan los proyectos y alcanzan ese contraste: `#3B82F6` (3 proyectos), `#0950C6`, `#F45000` y `#CC0066`. Los dos celestes claros en uso (`#6CA3C6` y `#56A2C2`, de 2,7:1 y 2,9:1) no entran: el Celeste `#2B7AB8` es su reemplazo.
  - Un proyecto con un color que no está en la paleta lo conserva como primera opción, «Color actual», hasta que alguien elija otro. Nada se cambia solo.
  - El servidor acepta cualquier `#RRGGBB`, así no rechaza al guardar un proyecto que conserva su color actual.
- **Ícono:** los 25 de `ICON_SELECTOR_MAP` (`main.js`), como opciones de radio.
- **La muestra** de cómo se ve el cuadrado en la lista.
- **El orden** (`proyectos.orden`) sigue sin editarse: queda en lo que tenga.

**Hito o logro** («Nuevo hito», «Editar el hito», «Registrar un logro del área», «Editar el logro»):
- **Arriba, de quién es:** «Del proyecto X. Sale en el Informe anual del año de su fecha.» o «Un logro que no es parte de un proyecto. …».
- **Título:** obligatorio, hasta 200 caracteres.
- **Fecha:** obligatoria; por defecto, hoy (`Utils.hoyEnArgentina()`).
- **Descripción.**
- **Enlace de la evidencia:** opcional, http o https, hasta 500 caracteres.
- **Archivos:** hasta 3.
- **Sale el campo «Tipo de evidencia»:** un hito lleva un enlace, archivos, las dos cosas o ninguna. El servidor sigue guardando `evidencia_tipo`, derivado (sección 9).

**Los archivos** (documentos del proyecto y archivos de un hito o logro):
- **La zona para soltar:** se puede usar con el teclado (es un `<button>`, «elegilos», con un `<input type="file">` oculto).
- **La ayuda:** «Hasta 3 archivos de 10 MB cada uno: PDF, Word, Excel, CSV, ODT, ODS, imágenes, ZIP, RAR o 7Z.» (10 para los documentos).
- **Los pendientes:** se listan con su × (que funciona) antes de guardar y se vacían al cerrar el modal.
- **El navegador controla antes de enviar:**
  - la extensión, los 10 MB y la cantidad máxima (contando los que ya tiene), con los mismos mensajes que el servidor;
  - los repetidos: un archivo con el mismo nombre que otro de la misma tanda o que uno que ya tiene el hito o el proyecto. Dice «Ya hay un archivo llamado <nombre>.» y no lo suma. Este control es solo del navegador: el servidor no rechaza nombres repetidos (los guarda con un nombre único en el disco).
- **Si el hito se guarda pero la subida falla:** el modal queda abierto, avisa «El hito se guardó, pero los archivos no se subieron: <motivo>.» y deja reintentar la subida. Nunca dice «guardado» si algo falló.
- **Subir documentos al proyecto:** abre el selector desde el botón; la subida muestra su estado y avisa el resultado.
- **«Ver»:** abre la vista previa en un modal (la imagen en un `<img>` y el PDF en un `<iframe>`, desde un `blob:` que la CSP ya permite).
- **«Descargar»:** usa `API.pedirArchivo` con el JWT en el encabezado y `descargarBlob`, con el nombre original.

**Confirmaciones:** un modal chico (`pr-modal-chico`), no `confirm()`:
- **Eliminar el proyecto:** «¿Eliminar el proyecto <nombre>? Deja de verse en la lista, en la línea de tiempo y en el Informe anual, con sus N hitos y M documentos.» El proyecto se da de baja (soft delete), como hoy.
- **Eliminar un hito:** «¿Eliminar el hito <título>? Se borran también sus N archivos.»
- **Eliminar un logro:** el mismo texto, con «logro».
- **Eliminar un documento o un archivo:** «¿Eliminar <nombre del archivo>?»

**Mensajes:** el aviso del servidor con `Utils.showSuccess` y `Utils.showError`, con los estilos `.alert-*` del Seguimiento. Con un modal abierto, el error va dentro del modal, nunca detrás del velo.

## 7. Permisos

- **Ven todo** (lista, detalle, línea de tiempo y logros) **y bajan y previsualizan los documentos y los archivos:** todos los roles con sesión, incluidos lector y colaborador (decisión del usuario).
- **Crean, editan y borran:** solo administración (superadmin, admin y editor: `esAdmin`), como hoy. La página oculta los botones con `Auth.isAdmin()`; el servidor valida igual.

## 8. Lo que no cambia

- Los proyectos dados de baja no se ven, ni sus hitos.
- Los hitos con fecha futura se muestran como «Previsto».
- El Informe anual lee los hitos como hoy (`hitosDelAnio`).
- Los límites: 3 archivos por hito, 10 documentos por proyecto, 10 MB por archivo y las mismas extensiones y tipos MIME.
- Los archivos siguen en `uploads/proyectos/<id>/` y `uploads/hitos/<id>/`.

## 9. El servidor: arreglos y API

**Organización.** Las funciones de proyectos, hitos, logros, timeline y archivos pasan de `controllers/gestionController.js` a `controllers/proyectosController.js`. En `gestionController.js` quedan solo las métricas. Las reglas puras van a `services/proyectosReglas.js`, sin pool ni `Date` local y sin tirar nunca:
- la validación de un proyecto, un hito y un logro, con sus mensajes;
- `evidenciaTipo`;
- el nombre de un archivo subido;
- los textos.

Las rutas de `routes/index.js` no cambian de dirección; solo cambian su handler y sus middlewares.

**Las respuestas:** `{ success, data?, error?, campo?, message? }`. Un error de validación es 400 con `error` y `campo`, igual que las notas DGMIT.

**Las fechas** se mandan como texto `'AAAA-MM-DD'`. Hoy salen como fechas JavaScript con zona horaria. La página las corta como texto.
- `fecha` y `fecha_inicio` son DATE: van con `DATE_FORMAT(…, '%Y-%m-%d')`.
- `created_at` de los archivos y los documentos es TIMESTAMP, y la base puede estar en UTC. Va con la convención del proyecto: `UNIX_TIMESTAMP` y `ahoraArgentina`, como `services/seguimientoDatos.js`, para que «Subido el» sea el día en Argentina. Con `DATE_FORMAT`, un archivo subido después de las 21 diría el día siguiente.

**Validaciones** (las mismas en el navegador, copiadas de `proyectosReglas.js` y atadas por un test de paridad):
- **Proyecto:**
  - `nombre` obligatorio, recortado, hasta 200 caracteres: «Escribí el nombre del proyecto.» y «El nombre puede tener hasta 200 caracteres.»;
  - `estado`, `prioridad` y `categoria`, de su lista: «El estado no es válido.», etc.;
  - `fecha_inicio`, `'AAAA-MM-DD'` válida o vacía, del 01/01/2000 al 31/12 de cinco años después del de hoy: «La fecha de elevación no es válida.». El tope evita que un año mal escrito (2062 por 2026) estire la ventana de los carriles y la cinta;
  - `responsable`, hasta 150 caracteres;
  - `enlace_externo`, vacío o http/https y hasta 500 caracteres: «El enlace tiene que empezar con http:// o https://.»;
  - `color`, `#RRGGBB`;
  - `icono`, de `ICON_SELECTOR_MAP` (o vacío);
  - `areas`, ids enteros positivos que existan: «Elegí áreas que existan.».
  - En una edición, un campo que no viene no se toca, y un `nombre` vacío es un error (hoy lo deja vacío).
- **Hito y logro:**
  - `titulo` obligatorio, hasta 200 caracteres: «Escribí el título del hito.»;
  - `fecha` obligatoria y válida, con el mismo rango que la fecha de elevación: «Elegí la fecha del hito.» (falta) y «La fecha del hito no es válida.» (fuera de rango o mal escrita);
  - `evidencia_url`, vacía o http/https y hasta 500 caracteres;
  - `evidencia_tipo` ya no se recibe: el servidor lo deriva (`evidenciaTipo`) al guardar el hito y al subir o borrar uno de sus archivos. Es `'url'` con enlace, `'archivo'` sin enlace y con archivos, y `'ninguno'` si no tiene ninguna de las dos cosas.

**Los arreglos:**
1. **Transacciones:** crear y editar un proyecto con sus áreas, crear un hito, borrar un hito (filas) y subir archivos (control de la cantidad y los INSERT) van en una transacción.
2. **Archivos huérfanos:**
   - **Antes de que multer lea el pedido,** un middleware valida que el id sea un entero positivo, que el proyecto (activo) o el hito existan y que no estén llenos. Si falla, responde 404 o 400 sin escribir nada.
   - **Mientras multer lee:** recibe como límite de archivos los lugares que quedan (`limits.files`, armado para cada pedido). Si vienen de más, multer corta con su error y borra lo que ya escribió (lo hace solo multer 1.4.5, `make-middleware.js`). La respuesta es 400 con el mensaje de la cantidad (arreglo 12).
   - **Después de escribir:** si falla algo (la transacción de los INSERT), se borran los archivos escritos.
3. **El id en la carpeta:** `ensureUploadDir` recibe solo un id ya validado (entero positivo). Ya no se usa `req.params.id` crudo: cierra la posibilidad de escribir fuera de `uploads/`. `validarPathSeguro` compara con el separador final.
4. **`ruta_archivo`:** el INSERT de `proyecto_documentos` la completa con la ruta relativa. Hoy la omite y anda solo porque la base no es estricta.
5. **Borrar un hito borra sus archivos del disco,** después del commit. Si el disco falla, lo registra y sigue.
6. **Descargar un archivo que no está en el disco** responde 404 en JSON («El archivo no está en el servidor.»), no 500.
7. **Las descargas** (`GET …/documentos/:docId/descargar` y `GET …/archivos/:archivoId/descargar`) pasan a `authMiddleware` sin `adminOnly` (decisión del usuario). El resto de las escrituras sigue con `adminOnly`.
8. **Editar o borrar un hito de un proyecto dado de baja** responde 404, como si no existiera.
9. **Los nombres con tildes:** el nombre original del archivo se pasa de latin1 a UTF-8 al recibirlo. Multer lo lee como latin1, y hoy «presentación.pdf» se guardaría mal. Un test lo cubre.
10. **`hitos_completados`** usa `hoyArgentina()`, no `CURDATE()`.
11. **Sin consultas N+1:** áreas, hitos, archivos y documentos se traen con una consulta por tabla para todos los proyectos o hitos juntos.
12. **Los errores de multer en español:** «Podés subir hasta 3 archivos por hito.» (y 10 por proyecto), en lugar de «Unexpected field».

**Lo que no se arregla en esta entrega:** `proyectos.created_by` tiene `ON DELETE CASCADE`, pero los usuarios no se borran físicamente (se desactivan). Queda anotado, sin migración.

## 10. El navegador: `proyectos.js`

- **Al cargarse solo declara,** como `seguimiento.js` y `reportes.js`: `tests/proyectos-frontend.test.js` lo carga en un `vm`.
- **Lo que arma HTML es puro** y recibe por parámetro quién mira (`esAdmin`): los carriles, la ventana y los puntos que se juntan, el resaltado, la ficha, la cinta (con sus x y sus filas de etiquetas), las filas de los hitos, los archivos, los formularios y los vacíos.
- **Lo que toca el DOM o la API** va aparte, al final.
- **Los pedidos:**
  - los datos, con `API.pedirJson`;
  - los archivos, con `API.pedirArchivo` y `descargarBlob` (propio de la página, como en `correos.js` y `reportes.js`);
  - las subidas, con `fetch` y `FormData`, con `Auth.getAuthHeaders()` sin `Content-Type`.
  - `api.js` y `main.js` no cambian: si cambiaran, habría que subir `VERSION` en todas las páginas.
- **El escape:** todo texto del servidor pasa por `Utils.escapeHtml`, el color también (validado `#RRGGBB`), y los enlaces por `Utils.esUrlSegura`.
- **«Hoy»:** `Utils.hoyEnArgentina()`. Nunca `toISOString()` ni `new Date(fecha)` para una fecha `'AAAA-MM-DD'`.
- **Copias mínimas, atadas por tests de paridad:**
  - los mensajes y largos de `proyectosReglas.js`;
  - las extensiones, los 10 MB y los máximos de `config/upload.js`;
  - las listas de estados, prioridades y categorías.
- Va con `?v=` propio (`VERSION_PROYECTOS` en `tests/paginas.test.js`).

## 11. El renombre en el sitio

- **La redirección:** `app.js`, antes de `express.static`, responde `GET /gestion.html` con 302 a `/proyectos.html`. El navegador conserva el fragmento: `#metricas` llega a la página nueva (sección 1). Va junto a las que agrega Configuración para `usuarios.html` y `areas.html`, con un test por HTTP.
- **El menú lateral, en todas las páginas con carcasa** (hoy 14; después de Configuración, 13). En Herramientas, el tercer link (Métricas y Reportes, Notas, **Proyectos**, Seguimiento) pasa a:
  - `href="proyectos.html"`;
  - el texto «Proyectos»;
  - el ícono `folder-kanban` de Lucide: `<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><path d="M8 10v4"/><path d="M12 10v2"/><path d="M16 10v6"/>`.
  - El ícono de barras deja de usarse en el menú.
- **Los textos que dicen «Gestión»:**
  - `services/reportesInformeAnualPdf.js`: «Los hitos de AAAA cargados en Gestión» pasa a «Los hitos de AAAA cargados en Proyectos» (y su test). Los comentarios que nombran `gestion.js` se actualizan.
  - `public/js/reportes.js`, tarjeta del Informe anual: «(los hitos de Gestión → Proyectos)» pasa a «(los hitos de Herramientas → Proyectos)». Sube `VERSION_REPORTES`, y su test.
  - `public/js/usuarios.js`, la ayuda del lector (y la del colaborador, si la nombra): «Gestión» pasa a «Proyectos». Sube su `?v=`, y su test. El Generador cambia la misma línea: se escribe sobre la versión que quede en main.
- **`tests/paginas.test.js`:**
  - `VERSION_GESTION` pasa a `VERSION_PROYECTOS`;
  - el bloque de `gestion.html` (sin Chart.js, `#tab-proyectos` y el aviso de la mudanza) se reemplaza por el de `proyectos.html`;
  - en los destinos del menú, `gestion.html` pasa a `proyectos.html`;
  - un test nuevo: `gestion.html` y `gestion.js` ya no existen.
- **`CLAUDE.md` y `README.md`:** la estructura, la lista de páginas con carcasa, el lector, «Gestión → Proyectos», una sección corta «Proyectos» y el Changelog.

## 12. Tests y despliegue

**Tests nuevos:**
- `tests/proyectos-reglas.test.js` (puro): validaciones, mensajes, `evidenciaTipo` y el nombre del archivo.
- `tests/proyectos-api.test.js` (Docker, base propia):
  - el CRUD de proyecto, hito y logro;
  - los permisos: el lector y el colaborador leen y bajan, no escriben; sin sesión, 401;
  - cada 400 con su `campo`;
  - el 404 de un proyecto dado de baja;
  - las transacciones (un área que no existe no deja el proyecto creado);
  - las subidas: el límite, ningún archivo escrito si el proyecto no existe, el nombre con tildes y el id con `..%2F`;
  - la descarga de un archivo faltante (404);
  - borrar un hito borra sus archivos;
  - las fechas como texto.
- `tests/proyectos-frontend.test.js` (vm): los carriles y la ventana, los puntos que se juntan, «N antes», el resaltado y su frase, el orden, los filtros y la dirección, la ficha, la cinta (que nada se salga ni se pise), las filas, los formularios, los vacíos, lo que ve cada rol y las paridades.
- La redirección de `/gestion.html` (por HTTP).

**Tests que cambian:**
- `paginas.test.js`, `permisos.test.js` (las descargas para el lector y las escrituras en `RUTAS_SOLO_ADMIN`), `reportes-frontend.test.js`, `reportes-pdf.test.js` y `usuarios-frontend.test.js`.
- `metricas-api.test.js` (Informe anual) no debería cambiar: hay que comprobarlo.

**`npm test` completo** antes y después de cada tarea, sin correr dos suites a la vez con otra sesión.

**El kit** `Escritorio\RPAD-deploy-proyectos`:
- **No lleva SQL:** no hay migración.
- **Va después** de los kits de Métricas, del Generador y de Configuración. Su `PASOS.txt` lo dice.
- **Archivos que se suben:** `proyectos.html`, `js/proyectos.js`, las páginas con carcasa, `app.js`, `routes/index.js`, los dos controladores, `services/proyectosReglas.js`, `config/upload.js`, `services/reportesInformeAnualPdf.js`, `js/reportes.js` + `reportes.html` y `js/usuarios.js` + su página.
- **Después:** Restart y, por último, borrar del servidor `gestion.html` y `js/gestion.js`.
- **La carpeta `uploads/`** no se toca.

## 13. Decisiones

**Del usuario (25/10/2026):**
- La página sirve para cargar el trabajo, mostrar lo hecho y el Informe anual, y hoy casi no se usa.
- Alcance: rediseño con arreglos, de la página y del servidor.
- El lector (y el colaborador) bajan los documentos y los archivos.
- La lista: C, carriles.
- Los años: 3, con flechas.
- El reparto: 40/60, más espacio para los proyectos.
- El detalle: 2, con la cinta del recorrido.
- El ícono: carpeta con tablero (`folder-kanban`).
- Las tres pestañas: Proyectos, Línea de tiempo y Logros del área.
- La implementación va al final de la cola, después de Configuración.

**Mías (para revisar):**
- La API conserva sus rutas `/api/gestion/…`; las funciones se mudan a `proyectosController.js` y las reglas a `services/proyectosReglas.js`.
- La redirección es 302, como en Configuración.
- El aviso de las métricas aparece solo con `#metricas`.
- La paleta de 10 colores, con los cuatro en uso que se leen bien; el color actual se conserva.
- Los repetidos se controlan solo en el navegador (misma tanda y lo que ya tiene).
- Los puntos se juntan con el ancho real de la pista, medido en el DOM; la función que los junta es pura y recibe el ancho.
- Las fechas de los hitos y de elevación, del 01/01/2000 a cinco años después del de hoy.
- Sale «Tipo de evidencia» del formulario; el servidor lo deriva.
- Las confirmaciones van en modales, no con `confirm()`.
- Los filtros, la ventana y el año resaltado van en la dirección.
- El orden de los carriles.
- Eliminar un proyecto sigue siendo darlo de baja: sus hitos dejan de salir también en el Informe anual de años anteriores (es lo que pasa hoy).
- No hay paginación: hoy hay 8 proyectos y 14 hitos.
- `created_by` con `CASCADE` queda anotado sin migración.
