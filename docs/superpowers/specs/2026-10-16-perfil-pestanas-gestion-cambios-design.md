# Mi Perfil en pestañas y Gestión de Cambios rediseñada

Fecha: 16/10/2026. Rama: `feat/perfil-pestanas`.
Mockup de referencia (datos inventados): [2026-10-16-perfil-pestanas-mockup.html](2026-10-16-perfil-pestanas-mockup.html). Se abre directo en el navegador desde el repo. El recuadro oscuro de abajo a la derecha es solo del mockup: cambia entre admin y editor y entre las dos formas de comparar. Este documento manda sobre el mockup cuando difieren.

## 1. Intención

Mi Perfil (`public/perfil.html` + `public/js/perfil.js`) junta todo en una sola página larga:
- arriba, una grilla de dos columnas con Datos Personales, Cambiar Contraseña y Mi firma;
- abajo, Gestión de Cambios, con sus propias pestañas "Mis Cambios" y "Para Revisar".

Ahí auditan los cambios los admins y los editores (la doble verificación). La campana del encabezado y el email de las 14:00 llevan a esta página. Hoy se cae arriba de todo, en "Mis Cambios": para auditar hay que bajar y cambiar de pestaña.

Lo que molesta, en palabras del usuario:
- todo pesa igual: tarjetas iguales, y no se distingue lo pendiente de lo resuelto;
- cuesta ver qué cambió: hay que abrir una ventana y leer bloques Antes/Después;
- se ve viejo o plano: emojis en los estados, colores fuertes, aspecto de plantilla.

El objetivo es una página ordenada en pestañas, con una Gestión de Cambios moderna, funcional y propia. El rediseño gira en torno al "control de cambios": el valor viejo tachado y el nuevo resaltado, como en un documento.

## 2. Objetivos, no objetivos y anti-objetivos

Objetivos:
- Pestañas de un solo nivel: **Para revisar**, **Mis cambios**, **Mis datos** y **Mi firma**.
- Cada cambio se revisa y se resuelve en la misma fila, sin ventana.
- La fila cerrada ya dice qué cambió.
- El editor ve en cada cambio si le toca auditarlo.
- Historial de lo ya revisado: en Para revisar, el selector Pendientes / Revisados.
- Los cuatro arreglos elegidos (sección 9).

No objetivos:
- Cambiar las reglas de la doble verificación o de la auditoría: quién puede aprobar, el respaldo del editor, los bloqueos, los recordatorios o las notas.
- Cambiar los endpoints de aprobar y rechazar.
- Agregar "cancelar mi propuesta" (no existe hoy).
- Paginar del lado del servidor.
- Modo oscuro (la app no tiene).
- Tocar `main.js`, `main.css` u otras páginas.

Anti-objetivos (aunque "ande", sería un fracaso):
- Que se pueda aprobar o rechazar algo que hoy no se puede: lo propio, un editor con auditores disponibles o un lector.
- Que se rompa cualquier test existente o cualquier otra pantalla.
- Que un lector vea algo de la gestión de cambios.
- Que se apruebe con un solo clic, sin confirmación.

## 3. Restricciones

- **No romper nada.** Correr `npm test` completo antes y después: requiere `docker compose up -d` y `RPAD_TESTS_DB_LOCAL=1`. Además, probar a mano en la base local un cambio propuesto por un usuario y auditado por otro (sección 12).
- **`tests/perfil-frontend.test.js`** carga `perfil.js` en un `vm` con un `document` falso.
  - El `document` falso solo tiene `addEventListener` y `getElementById`, que devuelve `{ style: {} }`. No existen `window`, `location`, `localStorage` ni `querySelectorAll`.
  - El archivo, al cargarse, solo puede declarar cosas o registrar `DOMContentLoaded`.
  - Siguen existiendo, con la misma firma y el mismo comportamiento verificado:
    - `botonesDeAuditoria(id, permiso)`:
      - con `puede: true`, el HTML contiene `onclick="aprobarCambio(<id>)"` y `abrirModalRechazo(<id>)`, sin `disabled`;
      - con `puede: false`, tiene exactamente 2 `disabled`, `title` con el mensaje, y ni `aprobarCambio` ni `abrirModalRechazo`.
    - `avisoNoCorresponde(mensaje)`: escapa el HTML.
    - `permisoDeAuditoria(cambio)`: falla cerrado.
    - `textoRevisor(cambio)`.
    - `muestraDeFirma`, `actualizarMuestraFirma`, `cargarPerfil` y `RENGLON_FIRMA_CONTRATADO`.
  - En el HTML siguen tal cual:
    - `id="firma-nombre" class="form-input" maxlength="150" placeholder="Ej.: Nombre Apellido"`;
    - `<div id="firma-muestra" class="firma-muestra" hidden></div>`;
    - las reglas `.firma-muestra-chico` y `.firma-muestra-renglon` en `rem`, dentro del `<style>` de `perfil.html`;
    - en ningún lado dice "Téc.".
  - Los nombres `aprobarCambio` y `abrirModalRechazo` se conservan aunque ya no abran un modal: ahora abren la confirmación y el motivo en la fila.
- **`tests/paginas.test.js`**:
  - `auth.js`, `main.js` y `api.js` siguen en `?v=20261023` en todas las páginas: no se tocan.
  - `perfil.js` cambia, así que sube su `?v=`. El test hoy exige la misma versión (`VERSION_PANTALLAS`) para `usuarios.js`, `correos.js` y `perfil.js`: se le da a `perfil.js` su propia versión, `20261031`.
  - `perfil.html` conserva exactamente un `href="usuarios.html"` en toda la página (el test cuenta en todo el archivo): no agregar enlaces a `usuarios.html`.
- **API**: `tests/auditoria-api.test.js` y `tests/doble-verificacion.test.js` fijan la respuesta de `GET /cambios-pendientes/:id` (`campos_modificados` con sus etiquetas sin tilde, y `auditoria`). Ese endpoint no cambia, salvo el arreglo de fechas de la sección 8.1. Las listas solo **agregan** campos.
- **Página**:
  - Solo se carga `css/main.css`, que no tiene `?v`. `styles.css`, `layout.css` y `perfil.css` no los enlaza nadie: no usarlos.
  - Los estilos nuevos van en el `<style>` de `perfil.html`, como en `usuarios.html`.
  - `[hidden]{display:none!important}` ya está en la página.
- **CSP** (Helmet en `app.js`): permite `<style>` y `style=`, `onclick=` y scripts inline. Imágenes: `self`, `data:` y `blob:`. Sin fuentes ni imágenes externas nuevas.
- **Frontend**: vanilla JS, español. Todo dato que se muestra pasa por `Utils.escapeHtml`; los links, por `Utils.safeUrl`.
- **Deploy**: cPanel sin terminal. No hay migración ni dependencias nuevas.

## 4. Pestañas

**Orden:** Para revisar · Mis cambios · Mis datos · Mi firma.

**Quién ve qué:**
- Admin, superadmin y editor (`Auth.isAdmin()`): las cuatro pestañas.
- Lector: sin barra de pestañas. Ve solo el contenido de Mis datos.

**Contenido de cada pestaña:**
- **Para revisar**: sección 5.
- **Mis cambios**: sección 6.
- **Mis datos**: Datos personales y Contraseña, en dos tarjetas lado a lado que pasan a una columna en pantallas angostas. Los formularios, los IDs y el comportamiento siguen como hoy.
- **Mi firma**: el formulario de firma actual (IDs y comportamiento iguales) a la izquierda y, a la derecha, la vista previa "Así sale en las notas" para todos (cambio pedido por el usuario el 16/10/2026, después del primer deploy): la imagen guardada o la recién elegida, y debajo el nombre, el renglón del personal contratado si corresponde y el cargo, centrados como en el PDF.

**Cuentas en las pestañas:**
- Para revisar: la cantidad de pendientes ajenos (el mismo `GET /cambios-pendientes/contador` que la campana).
- Mis cambios: la cantidad de pendientes propios.
- Una pastilla chica. Con 0 no se muestra.

**Pestaña inicial:**
- La del hash, si es válida para el rol: `#para-revisar`, `#mis-cambios`, `#mis-datos` o `#mi-firma`.
- Si no hay hash válido: Para revisar para admin, superadmin y editor; Mis datos para el lector.
- Al cambiar de pestaña, el hash se actualiza con `history.replaceState`, para que recargar mantenga la pestaña.
- Un `hashchange` (un enlace con hash estando ya en Mi Perfil) cambia de pestaña. La campana no lo dispara: apunta a `perfil.html` sin hash y recarga la página.
- Un hash que el rol no puede ver cae en la pestaña por defecto de ese rol.

**Accesibilidad** (las pestañas de `usuarios.html` son solo el modelo visual: no tienen `aria-controls` ni teclado, así que esto se hace de cero):
- Roles y atributos: `role="tablist"`, `role="tab"` con `aria-selected` y `aria-controls`, y `role="tabpanel"` con `aria-labelledby`.
- Teclado: tabindex móvil, flechas izquierda y derecha, Home y End.
- Foco visible.
- Patrón y aspecto: los de las pestañas de `usuarios.html` (subrayado en `--primary`), sin compartir sus clases.

**Celular:**
- La barra se desplaza horizontalmente, sin scroll de la página.
- `.main-content` lleva `min-width: 0` en esta página: sin eso, la barra ensancha la página.

**Choque de nombres:** las clases y los IDs de las pestañas nuevas no pueden chocar con nada de la página. Las pestañas internas viejas (`.tabs`, `.tab-btn`, `#tab-mis-cambios`, `#tab-para-revisar`) desaparecen.

## 5. Para revisar

**Barra superior:**
- Selector segmentado **Pendientes / Revisados**.
- Filtro de tipo: Todos los tipos / Crear / Editar / Eliminar. La opción "actualizar", que nunca trae nada, se va.

**Pendientes:**
- Fuente: `GET /cambios-pendientes/para-revisar?estado=pendiente` (lista de cambios ajenos, como hoy).
- Orden: los más nuevos primero, como hoy.
- El primero aparece abierto; los demás, cerrados.

**Revisados:**
- Fuente: `GET /cambios-pendientes/para-revisar?estado=todos`, sin los pendientes.
- Son los cambios ajenos ya aprobados o rechazados, por cualquiera.
- Se muestran 20, con un botón "Ver 20 más" que pagina del lado del cliente.

**Fila cerrada** (botón con `aria-expanded` y `aria-controls`):
- **Etiqueta del tipo**: Crear, Editar o Eliminar. Son las mismas palabras y los mismos colores que los emails.
- **Título del dataset**: en `crear`, `datos_nuevos.titulo`; en los demás, `dataset_titulo`. Si viniera vacío, se cae a `datos_anteriores.titulo` o a `datos_nuevos.titulo`. (En `crear`, `dataset_id` y `dataset_url` quedan siempre en null, aun después de aprobado.)
- **Resumen** de qué cambió, en una línea con puntos suspensivos:
  - Editar, con un solo campo, de valores cortos: "**Frecuencia** de Anualmente a Cada medio año".
  - Editar, con más campos: se agrega ", y N campo(s) más".
  - Editar, si el primer campo es un texto largo (Descripción, Observaciones, Qué se solicita): "Cambia **Descripción** y **Observaciones**" (hasta dos nombres más "y N más").
  - Crear: "Dataset nuevo" y, si están, el área y la frecuencia ("Dataset nuevo del área de Ambiente, anualmente" o la forma que lea bien).
  - Eliminar: "Se quita del registro".
  - Los valores del resumen pasan por la misma presentación que el detalle: etiquetas con tilde, fechas dd/mm/aaaa y `-` como "vacío".
- **Quién lo propuso** (`usuario_nombre`, si no `usuario_username`) y **cuándo**, en tiempo relativo como hoy. Si pasaron más de 2 días desde `created_at`, el "cuándo" va en ámbar.
- **Solo para el editor**, la marca de auditoría:
  - si puede de respaldo, una pastilla ámbar "Podés auditarlo de respaldo";
  - si no puede, un texto suave "Lo auditan X, Y y Z" (con un ícono de escudo).
  - A un admin o superadmin no se le muestra.
- **En Revisados** se agrega "Propuesto por X". A la derecha va el resultado ("Aprobado" en verde o "Rechazado" en rojo oscuro, con ícono, no emoji) y la fecha de revisión `revisado_at` en dd/mm/aaaa. La fila se ve más apagada: título con menos peso y etiqueta en gris.

**Fila abierta:**
- **Comparación** "control de cambios":
  - Una fila por campo: la etiqueta con tilde a la izquierda y el valor a la derecha.
  - Editar: el valor viejo tachado (línea rojiza, texto suave) y el nuevo resaltado (fondo verde claro, como un resaltador). Van uno al lado del otro y bajan de línea si no entran.
  - En Descripción, Observaciones y Qué se solicita, comparación palabra por palabra: se tachan solo las palabras que salen y se resaltan solo las que entran, en un único párrafo. La puntuación cuenta como palabra aparte.
  - Etiquetas para mostrar (el servidor manda las de la izquierda y no cambian): `Titulo`→Título, `Descripcion`→Descripción, `Area Responsable`→Área responsable, `Tema Principal`→Tema principal, `Tema Secundario`→Tema secundario, `Tipo de Gestion`→Tipo de gestión, `Ultima Actualizacion`→Última actualización, `Proxima Actualizacion`→Próxima actualización, `URL en Portal`→URL en el portal. El resto queda igual.
  - `-` se muestra como "vacío" en cursiva. Las fechas ISO, como dd/mm/aaaa (hoy lo hace `formatearFechaComparador`).
  - Crear: los campos no vacíos del dataset nuevo (la lista de 13 de hoy), sin tachado ni resaltado.
  - Eliminar: los campos de `datos_anteriores`, más la nota "Al aprobarlo, el dataset deja de figurar en el registro. No se borra: queda inactivo." (es un borrado lógico, `activo = FALSE`).
  - Si un editar no trae campos: "No se detectaron cambios en los campos principales.", como hoy.
- **Pie:**
  - "Propuesto por X el dd/mm/aaaa, hh:mm".
  - "Ver en el portal" si hay URL segura (crear: `datos_nuevos.url_dataset`; eliminar: `datos_anteriores.url_dataset` o `dataset_url`; editar: la nueva, si no la del dataset).
  - A la derecha, **Rechazar** (borde rojo suave) y **Aprobar** (verde oscuro), salidos de `botonesDeAuditoria`.
  - Si el permiso no deja auditar, los botones quedan deshabilitados y arriba del pie aparece `avisoNoCorresponde(mensaje)` como nota ámbar. Esa nota y los botones deshabilitados ya existen y se reubican.
  - Un cambio propio o no pendiente no tiene botones.
- **Revisados abiertos:** misma comparación, más el motivo si fue rechazado ("Motivo del rechazo: …") y en el pie `textoRevisor(cambio)` con la fecha: "Aprobado por X (respaldo) el dd/mm/aaaa".

**Aprobar:**
1. El clic en Aprobar no aprueba: reemplaza los botones por la confirmación en la fila: "¿Aprobar? El cambio se aplica al dataset ahora." con [Cancelar] [Sí, aprobar]. Desaparece el `confirm()` nativo.
2. "Sí, aprobar" llama a `POST /cambios-pendientes/:id/aprobar`, como hoy, con el botón deshabilitado mientras espera.
3. Si sale bien, la fila muestra "Aprobado. El cambio ya está aplicado en el dataset." y aparece `Utils.showSuccess('Cambio aprobado correctamente')`.
4. Se recargan las listas, las cuentas y la campana.

**Rechazar:**
1. Abre debajo del pie un campo "Motivo del rechazo", que es obligatorio como hoy, con [Cancelar] [Rechazar cambio].
2. Sin motivo, sale `Utils.showError('Debe proporcionar un motivo de rechazo')` (el texto de hoy) y no se envía.
3. "Rechazar cambio" llama a `POST /:id/rechazar` con `{ comentario }`.
4. Si sale bien, mismo patrón que aprobar: "Rechazado. Quien lo propuso ve el motivo en Mis cambios." y `Utils.showSuccess('Cambio rechazado correctamente')`.

**Errores:**
- Se muestra el mensaje del servidor con `Utils.showError` y se recarga la lista: 404 "ya fue procesado", 403 propio, 403 de permiso y 400.
- La doble verificación sigue en el servidor. La UI solo refleja lo que el servidor decide.

**Vacíos:**
- Pendientes: "No hay cambios esperando revisión." y, debajo, "Cuando alguien proponga uno, aparece acá."
- Revisados: "Todavía no hay cambios revisados."
- Si un filtro de tipo deja la lista vacía, se dice qué filtro está puesto.
- Error de carga: "No se pudieron cargar los cambios. Probá recargar la página."

## 6. Mis cambios

Fuente: `GET /cambios-pendientes/mis-cambios?estado=todos`, separada del lado del cliente en dos grupos.

**Esperando auditoría** (pendientes propios):
- La misma fila, sin botones.
- A la derecha, "Propuesto hace X".
- Abierta: la comparación y "Propuesto el …".
- Si no hay ninguno, el grupo no aparece.

**Resueltos:**
- Selector segmentado Todos / Aprobados / Rechazados.
- Se muestran 20 y se pagina del lado del cliente con "Ver 20 más".
- Cada fila: resultado y fecha a la derecha. Abierta: la comparación, el motivo si fue rechazado y `textoRevisor` con la fecha.
- Vacío: "Todavía no propusiste cambios." si no hay ninguno, o el texto que corresponda al filtro. Se arregla el actual "No tienes cambios " con el filtro Todos.

## 7. Diseño visual

Tokens (en el `<style>` de `perfil.html`, con prefijo propio). Son los colores de los emails nuevos ("celeste institucional"):

| Token | Valor | Uso |
|---|---|---|
| tinta | `#1F3A5F` | títulos |
| texto | `#2B3A4A` | texto |
| suave | `#6B7A8C` | texto secundario |
| línea | `#E4E9EF` | bordes y divisores |
| sutil | `#F7F9FB` | fondo de la fila abierta |
| acento | `#3E6B96` | links y foco |
| crear | `#DDF1E6` / `#2E6B4C` | etiqueta Crear (fondo / texto) |
| editar | `#DCEAF7` / `#24507A` | etiqueta Editar (fondo / texto) |
| eliminar | `#F8E1E1` / `#8A3434` | etiqueta Eliminar (fondo / texto) |
| tachado | `#B5524C` | línea del valor viejo |
| resaltador | `#CBEBD7` | fondo del valor nuevo |
| nuevo | `#1E4D36` | texto del valor nuevo |
| aviso | `#FBF1DC`, borde `#F0DDB0`, texto `#7A5A14` | respaldo, demora y no corresponde |

- **Letra:** Inter, la de toda la app. Fechas con `font-variant-numeric: tabular-nums`. Sin mayúsculas sostenidas ni emojis.
- **Lista:** un solo panel blanco con borde de 1px y radio de 12px. Las filas van separadas por líneas, no son tarjetas sueltas, y no llevan sombras pesadas ni degradados.
- **Botones:**
  - Aprobar: `#2E6B4C` (hover `#255A3F`), texto blanco.
  - Rechazar: blanco, texto `#8A3434`, borde `#E8C4C4`.
  - Neutro (Cancelar, Ver más): blanco con borde de línea.
- **Ancho:** todo el ancho, como las demás páginas (cambio pedido por el usuario el 16/10/2026, después del primer deploy; antes era `max-width: 1120px`). El texto de la comparación se corta en unos 88 caracteres para que se lea cómodo.
- **Movimiento:** solo el giro de la flecha al abrir y cerrar, con `prefers-reduced-motion` respetado.
- **Formularios** de Mis datos y Mi firma: tarjetas blancas con borde, título y una línea de ayuda.
- Ayudas de Mis datos y Mi firma:
  - Mis datos: "Tu nombre y email aparecen en los avisos y en el historial de cambios."
  - Contraseña: "Al cambiarla se cierran tus otras sesiones abiertas." (es cierto: el cambio sube `sesion_version`, `controllers/authController.js:164`).

## 8. Servidor: agregado de solo lectura en las listas

Archivo: `controllers/cambiosPendientesController.js`.

`getCambiosPendientesParaRevisar` y `getMisCambios` agregan, a cada cambio, lo que hoy calcula `getCambioPendienteById`:
- `datos_nuevos` y `datos_anteriores` enriquecidos con `enriquecerDatos`. Conservan los IDs y suman `*_nombre` y `formatos_nombres`.
- `campos_modificados`: con `calcularCambios` si es `editar`; si no, `null`.
- `dataset_url` (`d.url_dataset`), agregado a la consulta.
- `auditoria`, **solo en `para-revisar`**, con la misma forma que en `GET /:id`:
  - si el cambio no está pendiente, `{ puede: false, respaldo: false, mensaje: null }`;
  - si está pendiente, el `permisoParaAuditar`.
  - Se agrega `auditan`: un array con los `nombre_completo` de quienes lo auditan hoy. Sale de `quienesAuditan(personas, usuario_id)`: si `respaldo` es true, `auditan` es `[]` (ahí `personas` son los editores); si no, los nombres de `personas`. Si el cambio no está pendiente, `[]`. Sirve para la marca "Lo auditan X, Y y Z" del editor. **Solo en las listas**: `GET /:id` sigue devolviendo `auditoria` exactamente `{ puede, respaldo, mensaje }` (`tests/auditoria-api.test.js:126-130` lo compara entero).
- Los catálogos se cargan **una vez** por pedido (`catalogosParaAuditoria`), y las personas de auditoría una vez por pedido (`personasDeAuditoria(hoyArgentina())`). Nada de una consulta por cambio.
- Conviene que el armado de un cambio quede en un solo helper usado también por `getCambioPendienteById`. `auditan` se agrega afuera de ese helper, solo en `para-revisar`.

### 8.1 Fechas que figuran cambiadas sin haber cambiado (decidido por el usuario: arreglarlo en el servidor)

Al editar desde la pantalla, `datos_anteriores` guarda las fechas con hora (`"2026-05-31T03:00:00.000Z"`, de un `SELECT *`) y `datos_nuevos` sin hora (`"2026-05-31"`). `calcularCambios` compara con `String()` y marca la fecha como cambiada aunque sea el mismo día. Pasa en 6 de los 44 cambios de edición reales de la base.

- En `calcularCambios`, `ultima_actualizacion` y `proxima_actualizacion` se comparan por el día: los primeros 10 caracteres. Es la misma regla que `valorComparable` de `services/notasDigitalesContenido.js:295` para la Nota Digital de auditoría.
- Los valores que se devuelven (`antes` y `despues`) no cambian de forma; solo deja de listarse el campo cuando el día es el mismo.
- Vale para `GET /:id` y para las listas, porque es la misma función.
- No toca lo que se aplica al aprobar (`aprobarCambio` usa `datos_nuevos`, no `campos_modificados`).
- Test nuevo: un cambio con la fecha vieja con hora y la nueva igual sin hora no lista esa fecha; otro con un día distinto, sí.

### 8.2 Lo que no cambia

- `getContadorPendientes`, `aprobarCambio`, `rechazarCambio` y los filtros de las consultas: siguen excluyendo lo propio y filtrando por estado y tipo como hoy.
- Ningún campo existente cambia de nombre ni de valor, salvo `campos_modificados` por el arreglo de 8.1.

Con esto, la fila abierta se pinta con los datos de la lista: no hace falta `GET /:id` al abrir. El servidor vuelve a validar todo al aprobar o rechazar.

## 9. Arreglos elegidos

1. **Mensajes con formato:**
   - Estilos para `.alert`, `.alert-success` y `.alert-error` en el `<style>` de `perfil.html` (hoy salen sin formato porque `main.css` no los tiene).
   - Verde y rojo suaves, de la paleta.
   - `#message-container` queda arriba de las pestañas, fuera de los paneles.
2. **Detalle completo:** la fila abierta muestra quién propuso, cuándo, el estado, el motivo y quién revisó (secciones 5 y 6).
3. **Campana al día:** después de aprobar o rechazar, `perfil.js` llama a `cargarContadorNotificaciones()` (función global de `main.js`; `main.js` no se toca) y actualiza las cuentas de las pestañas.
4. **Limpiar filtros y textos:**
   - Se quita el filtro "actualizar".
   - Los textos vacíos quedan bien escritos.
   - Se borran el código muerto que ya no se usa (`nav-badge-admin`, los modales `modal-detalle` y `modal-rechazo`, `verDetalle` y `renderComparador` si quedan sin uso) y el pedido duplicado de `mis-cambios` en `actualizarBadges`.

## 10. Enlaces

- **Email de las 14:00** (`cambiosPendientesTemplate`, `services/emailTemplates.js:288`): el botón pasa a `${RPAD_URL}/perfil.html#para-revisar`. El texto de la Nota Digital ("perfil.html (sección "Para revisar")") ya queda bien y no se toca.
- **Campana** (`main.js:193`): no se toca. Sigue yendo a `perfil.html`, que para admin y editor abre en Para revisar por defecto. Así no hay que cambiar `main.js` ni la versión de todas las páginas.

## 11. Pruebas

Las que siguen igual tienen que seguir pasando: toda la suite.

Nuevas o ajustadas:
- **API**:
  - `para-revisar` y `mis-cambios` traen `campos_modificados`, los datos enriquecidos y `dataset_url`.
  - `para-revisar` trae `auditoria`:
    - auditor: `puede: true`;
    - editor con auditores disponibles: `puede: false`, con `auditan` y `mensaje`;
    - editor de respaldo: `puede: true, respaldo: true`;
    - cambio no pendiente: `puede: false`.
  - `GET /:id` no cambia, salvo el arreglo de fechas: un cambio cuya fecha vieja trae hora (`"2026-05-31T03:00:00.000Z"`) y la nueva no (`"2026-05-31"`) ya no la lista en `campos_modificados`; si el día cambió, sí.
- **Frontend**, en el mismo estilo `vm` de `perfil-frontend.test.js` y como funciones puras sin DOM:
  - el resumen de la fila;
  - la comparación palabra por palabra (casos: agregar, quitar, cambiar una palabra, puntuación, texto vacío);
  - el mapa de etiquetas;
  - la fecha;
  - la pestaña inicial según rol y hash;
  - la marca del editor.
  - Siguen verdes las verificaciones de `botonesDeAuditoria`, `avisoNoCorresponde`, `permisoDeAuditoria`, `textoRevisor` y la firma.
- **Páginas**: la versión nueva de `perfil.js` en `paginas.test.js`.
- **Email**: el botón del recordatorio apunta a `perfil.html#para-revisar`.

## 12. Prueba manual (antes de dar por terminado)

En la base local, con usuarios de prueba `@rpad.test`:
1. Un admin y un editor proponen cambios de los tres tipos.
2. Otro admin los ve en Para revisar, con el resumen correcto, los abre, aprueba uno y rechaza otro con motivo. Comprobar:
   - que el dataset cambió;
   - que el rechazado no cambió;
   - las cuentas y la campana.
3. El que propuso ve todo en Mis cambios, con el motivo.
4. Un editor ve "Lo auditan …" y los botones deshabilitados. Con los auditores de licencia, ve "Podés auditarlo de respaldo" y puede auditar, y queda la marca "(respaldo)".
5. Nadie ve botones en lo propio.
6. Un lector ve solo Mis datos, sin pestañas. `#para-revisar` no le muestra nada de cambios.
7. Recorrer Mis datos y Mi firma: guardar datos, cambiar la contraseña y cargar la firma siguen funcionando.
8. Probar en celular (375 px): sin scroll horizontal.
9. Probar el teclado en las pestañas.

## 13. Deploy

Archivos que se suben: `public/perfil.html`, `public/js/perfil.js`, `controllers/cambiosPendientesController.js` y `services/emailTemplates.js`. Después, Restart en Setup Node.js App, fuera de las ventanas del cron (8:00–8:30 y 13:45–14:15). No hay SQL.

## 14. Decisiones tomadas por Claude

- La pestaña inicial sin hash es siempre Para revisar para admin y editor: es la primera, haya pendientes o no. Eso cumple "abrir en Para revisar si hay algo; si no, en la primera".
- La campana no se toca. Ya abre en Para revisar por ser la pestaña por defecto, y así no hay que cambiar la versión de `main.js` en todas las páginas.
- La fila abierta usa los datos de la lista, sin pedir el detalle.
- Mis cambios y Revisados muestran de a 20, paginando del lado del cliente.
- La demora en ámbar arranca a los 2 días corridos desde que se propuso.
- La letra Inter. (El tope de `max-width: 1120px` se sacó a pedido del usuario: ver sección 7.)
- Botón Aprobar en verde oscuro y confirmación en la fila.
- Los estilos de mensajes se agregan solo en `perfil.html`, como hacen las demás páginas con los suyos.
- La vista previa de la firma: primero quedó solo para el personal contratado; el usuario pidió que salga para todos, como en el mockup (sección 4).

## 15. Lo que queda a criterio de quien implementa

- Cómo se dividen las funciones nuevas de `perfil.js`, respetando lo de la sección 3.
- La redacción exacta del resumen de Crear.
- La animación (o no) de la fila al resolverse.
- Los íconos, de Lucide en SVG inline como el resto de la página.
