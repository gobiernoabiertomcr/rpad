# Correos en pestañas, con el Libro de Notas Digitales primero

Fecha: 17/10/2026. Rama: `feat/correos-pestanas`.
Mockup aprobado por el usuario (datos de ejemplo): [2026-10-17-correos-pestanas-mockup.html](2026-10-17-correos-pestanas-mockup.html). Este documento manda sobre el mockup cuando difieren.

## 1. Intención

Correos (`public/correos.html` + `public/js/correos.js`) es hoy una sola página larga (unos 4200 px) con cinco tarjetas: Estado, Libro de Notas Digitales, Vista previa y prueba, Configuración y Aviso a las áreas. El usuario quiere ordenarla en pestañas, como Mi Perfil y Usuarios, con el **Libro de Notas Digitales como primera pestaña**, y darle el mismo lenguaje visual que Mi Perfil ("celeste institucional"). **Es un cambio visual**: Correos tiene que hacer exactamente lo mismo que hoy.

## 2. Objetivos, no objetivos y anti-objetivos

Objetivos:
- Cuatro pestañas: **Libro de Notas Digitales** · **Estado** · **Vista previa y pruebas** · **Configuración**.
- Las alertas del Estado, visibles arriba de las pestañas desde cualquier pestaña, con una marca en la pestaña Estado.
- El Libro como tabla renovada: mismas columnas, filtros y acciones, con mejor diseño.
- Cuatro arreglos chicos (sección 9).

No objetivos:
- Cambiar qué hace cualquier botón, filtro, guardado, vista previa, prueba o reintento. Cambiar endpoints, el servidor, el contenido de las notas o los emails.
- Nuevas columnas o datos en el Libro (por ejemplo, quién firmó): requeriría tocar la API.
- Paginación del Libro (sigue el tope de 500 del servidor).

Anti-objetivos (aunque "ande", sería un fracaso):
- Que se rompa cualquier test o cualquier otra página.
- Que una alerta de error (nota fallida, configuración incompleta) quede escondida.
- Que se pueda activar el envío automático o mandar una prueba sin la confirmación que hoy existe.

## 3. Restricciones

- **No romper nada**: `npm test` completo antes y después (requiere `docker compose up -d` y `RPAD_TESTS_DB_LOCAL=1`).
- **`tests/correos-frontend.test.js`** carga `correos.js` en un `vm` con un `document` mínimo (`getElementById`, `addEventListener` que no hace nada, `createElement`); cada elemento falso solo tiene `value`, `disabled`, `title`, `hidden`, `textContent`, `addEventListener` e `innerHTML`. No hay `window`, `location`, `history`, `classList`, `setAttribute`, `dataset`, `tabIndex` ni `querySelector`. Por eso:
  - El archivo, al cargarse, solo declara y registra `DOMContentLoaded`. `hashchange`, teclado y todo lo que use `window`/`location`/`history` va dentro de funciones que el test no llama al cargar.
  - Siguen existiendo, con el mismo comportamiento probado, las funciones y constantes globales que el test usa: `verAnexoDeVistaPrevia`, `actualizarBotonAnexo`, `aplicarFirmante`, `datosDelFormulario`, `textoLicenciaFirmante`, `textoGestion`, `ETIQUETAS`, `celdaCantidad`, `textoCambioDeNota`, `textoAuditoria`, `nombreVistaPrevia`, `actualizarSelectorGestion`, `textoSinQuienAudite`, `textoPeriodosSinAuditor`, `cargarEstado` y `configActual`.
  - Siguen los IDs `preview-tipo`, `preview-gestion`, `btn-preview-anexo`, `firma_nombre`, `firma_cargo`, `firma-archivo`, `firma-ayuda`, `nd-alertas`, `nd-auditoria`, `nd-sin-quien-audite` y `nd-periodos-sin-auditor`, y los textos exactos que el test fija (por ejemplo el title "Solo los avisos llevan anexo").
  - El HTML de las alertas que arma `cargarEstado` no cambia: `<div class="nd-alerta nd-advertencia">MENSAJE</div>` y `<div class="nd-alerta">MENSAJE</div>`, unidas sin separador, dentro de `#nd-alertas`. Lo que cambia es el CSS de `.nd-alerta` y dónde está `#nd-alertas` (sección 5).
  - Lo nuevo que haga `cargarEstado` (la marca de la pestaña) solo puede usar `hidden`, `textContent`, `title` o `innerHTML` de elementos tomados con `getElementById`.
- **`tests/paginas.test.js`**: `auth.js`, `main.js` y `api.js` siguen en `?v=20261023`. `correos.js` sube a `?v=20261102`, con una constante propia en el test (`VERSION_CORREOS`); `usuarios.js` sigue con `VERSION_PANTALLAS = '20261024'`. `correos.html` conserva exactamente un `href="usuarios.html"` (el del sidebar).
- **Página**: solo carga `css/main.css` (sin `?v`); los estilos nuevos van en el `<style>` de `correos.html`. El orden de scripts no cambia. El sidebar sigue enlazando `correos.html` sin hash (`setActiveSidebarLink` compara el href exacto). Ningún enlace del sistema apunta hoy a una sección de Correos, así que los hashes son libres.
- **CSP** (Helmet): permite `<style>`, `style=`, `onclick=` e iframes `sandbox` con `srcdoc` (ya existen). Sin recursos externos nuevos.
- **Mensajes**: Correos usa `showToast` (vía `avisar`), no `#message-container`; sigue igual.
- Español; todo dato que se muestra pasa por `Utils.escapeHtml`.

## 4. Pestañas

- Orden y hashes: `#libro` Libro de Notas Digitales · `#estado` Estado · `#pruebas` Vista previa y pruebas · `#configuracion` Configuración.
- Pestaña inicial: la del hash si es una de esas cuatro; si no, **siempre el Libro** (también cuando hay alertas de error).
- Al cambiar de pestaña, `history.replaceState` actualiza el hash; un `hashchange` cambia de pestaña.
- Accesibilidad y aspecto: el patrón de Mi Perfil (`perfil.html`/`perfil.js`): `role="tablist"`/`tab`/`tabpanel`, `aria-selected`, `aria-controls`, `aria-labelledby`, tabindex móvil, flechas izquierda y derecha con vuelta, Home y End, sin interceptar Alt/Ctrl/Meta, foco visible, subrayado `--primary`. Se copian las funciones (`mostrarPestana`, `teclaEnPestanas`, `conectarPestanas`, `pestanaInicial(hash)`) con los nombres de Correos; no hay JS compartido entre páginas.
- `.main-content { min-width: 0; }` en esta página y la barra con `overflow-x: auto` (sin scroll de la página en celular). `[hidden] { display: none !important; }`.
- Todo sigue cargándose al abrir la página, como hoy: los paneles ocultos siguen en el DOM.
- El modal "Ver" (`#modal-nota`), la confirmación nueva y el toast quedan fuera de los paneles.

## 5. Alertas arriba de las pestañas

- `#nd-alertas` pasa de la tarjeta Estado a arriba de la barra de pestañas (debajo del título). Mismo id y mismo HTML (sección 3); solo cambia el CSS:
  - `.nd-alerta` (error): fondo `#FBEEEE`, borde `#EFCACA`, texto `#8A3434`, radio 10px, ícono de alerta.
  - `.nd-alerta.nd-advertencia`: fondo `#FBF1DC`, borde `#F0DDB0`, texto `#7A5A14`.
  - Sin alertas, el contenedor queda vacío y no ocupa lugar.
- Marca en la pestaña Estado: un punto rojo si hay alguna alerta de error, ámbar si solo hay advertencias, nada si no hay. `cargarEstado` lo decide con lo mismo que arma las alertas (dos elementos con `hidden`, por ejemplo `marca-estado-error` y `marca-estado-advertencia`, y su `title`).

## 6. Libro de Notas Digitales (primera pestaña)

- Mismos filtros (año, tipo, gestión, estado, dataset, "Incluir pruebas"), mismas columnas (N°, Fecha, Tipo, Gestión, Datasets, Para/CC, Estado, acciones), mismo orden, mismo tope, mismos textos de vacío y error, y las mismas acciones (Ver, PDF, Anexo si tiene, Reintentar si no está enviada). `colspan="8"` en los tres lugares.
- Diseño (como el mockup):
  - N° en negrita (`numero/aa`, o "PRUEBA").
  - Tipo como pastilla de color: Aviso `#DCEAF7`/`#24507A`, Reiteración `#FBF1DC`/`#7A5A14`, Auditoría `#ECE6F6`/`#4B3A78`, Autorización `#DDF1EE`/`#1F5F58`.
  - Gestión como etiqueta con borde suave ("—" sin gestión, como hoy).
  - Estado como pastilla (Enviada `#DDF1E6`/`#2E6B4C`, Fallida `#F8E1E1`/`#8A3434`, Pendiente `#FBF1DC`/`#7A5A14`) con la fecha y hora de envío debajo, más chica, en `dd/mm/aaaa HH:MM` (hoy sale `AAAA-MM-DD HH:MM` tal cual); el tooltip con el error o la respuesta SMTP sigue igual.
  - Acciones como botones chicos con borde; Reintentar con borde y texto rojo suave.
  - Tabla en un panel blanco con borde de 1px y radio 12px; encabezado con fondo sutil.
- Celular (≤ 860px): se oculta la columna Para/CC; la tabla se desplaza horizontalmente dentro de su marco si no entra.
- La tabla la arma `cargarLibro` en `correos.js`: cambian las clases y el marcado de las celdas, no los datos ni los textos (salvo el formato de la fecha de envío).

## 7. Estado

Tarjetas, en este orden (los IDs de hoy no cambian):
1. Envío automático: el interruptor `#envio-activo` con su texto, la última corrida (`#nd-ultima-corrida`), la licencia del firmante (`#nd-licencia`), la auditoría (`#nd-auditoria`), y las líneas de sin auditor (`#nd-sin-quien-audite`, `#nd-periodos-sin-auditor`).
2. Próximas notas: `#nd-proximas`, una tarjeta por gestión con próximo aviso y próxima reiteración.
3. Conexión del correo: `#btn-verificar-smtp` y `#smtp-status`.
4. Cómo funcionan: los dos párrafos de reglas de hoy (mismo texto).

## 8. Vista previa y pruebas · Configuración

- **Vista previa y pruebas**: dos tarjetas lado a lado (una columna en celular): "Nota Digital" (tipo, gestión, Vista previa, Ver PDF, Ver anexo, Enviarme una prueba, el aviso y el iframe de hoy) y "Aviso a las áreas (40 días)" (su texto, Vista previa, Enviarme una prueba, su iframe). Mismos IDs y comportamiento.
- **Configuración**: el mismo `form#form-config`, en dos columnas (una en celular):
  - izquierda: Gestión interna, Gestión externa, Notas de auditoría, Respaldo y pruebas;
  - derecha: Firmante titular, Firma (con su imagen y ayuda), Membrete del PDF (con su imagen y pie).
  - Cada grupo en una tarjeta blanca con título. El botón "Guardar configuración" y la ayuda "Separá varias direcciones con coma." quedan en una barra fija al pie del panel (`position: sticky`).
  - Mismos campos, nombres, IDs, validaciones y guardado; la firma y el membrete se siguen subiendo al elegir el archivo.

## 9. Arreglos elegidos

1. **"Ver" se cierra con Escape y con clic afuera**, además de la X.
2. **Confirmaciones propias**: los tres `confirm()` del navegador pasan a una ventana de confirmación con el diseño de la página, con los mismos textos y en los mismos casos (activar el envío automático, enviarme una prueba de nota, prueba del aviso a las áreas; desactivar el envío sigue sin confirmación, como hoy). Botones Cancelar y una acción con nombre propio ("Activar", "Enviar prueba"); Escape o clic afuera cancelan; el foco va al botón de acción al abrir y vuelve al botón que la abrió al cerrar. Si se cancela, todo queda como hoy al cancelar el `confirm()` (por ejemplo, el interruptor vuelve a apagado).
3. **Pie**: `RPAD v1.4.0` pasa a `RPAD v1.5.0`.
4. **CSS sin uso**: se borran `.info-card*`, `.test-section*` y `.spinner-inline` (y lo que quede sin uso tras el rediseño), sin cambios visibles.

## 10. Diseño visual

Los tokens de Mi Perfil en el `<style>` de `correos.html` (prefijo propio, por ejemplo `--co-` o reutilizando los nombres `--pf-`): tinta `#1F3A5F`, texto `#2B3A4A`, suave `#6B7A8C`, línea `#E4E9EF`, sutil `#F7F9FB`, acento `#3E6B96`, y los colores de la sección 6. Letra Inter, fechas con `tabular-nums`, sin emojis ni mayúsculas sostenidas. Tarjetas blancas con borde de 1px y radio 12px, sin sombras pesadas. Responsive a 375px sin scroll horizontal de la página; `prefers-reduced-motion` respetado.

## 11. Pruebas

- Toda la suite verde. Los tests existentes de `correos-frontend.test.js` no cambian (salvo que alguno lea algo que se movió a propósito, explicado en el commit).
- Nuevos (estilo `vm` de `correos-frontend.test.js` y de los de estructura de `perfil-frontend.test.js`):
  - Estructura de `correos.html`: `role="tablist"`, las cuatro pestañas con `id`, `aria-controls` y su panel con `aria-labelledby`; el Libro primero; `#nd-alertas` antes de la barra; `#modal-nota` fuera de los paneles; `correos.js?v=20261102`; pie `v1.5.0`.
  - `pestanaInicial(hash)`: `''` → `libro`, `'#estado'` → `estado`, `'#cualquiera'` → `libro`, sin `#` también.
  - Marca de la pestaña Estado: con una alerta de error, la marca de error visible; solo advertencias, la de advertencia; sin alertas, ninguna.
  - Teclado de las pestañas (flechas, Home, End, modificadores) y `mostrarPestana` (aria-selected, tabIndex, `hidden`, `replaceState`), con elementos falsos como en `perfil-frontend.test.js`.
  - La confirmación: con "Cancelar" no se llama a la API; con la acción, sí (para activar el envío y las dos pruebas).
  - El modal "Ver" se cierra con Escape.
- Prueba manual en la base local (copia de producción) con un superadmin de prueba: las cuatro pestañas, el hash, las alertas, filtros y acciones del Libro, vista previa, prueba (va a Mailpit), guardar configuración, activar/desactivar el envío con la confirmación, 375px y teclado.

## 12. Deploy

Dos archivos: `public/correos.html` y `public/js/correos.js`. Sin servidor, sin SQL, sin Restart. Se puede subir en cualquier momento.

## 13. Decisiones tomadas por Claude

- Hashes `#libro`, `#estado`, `#pruebas`, `#configuracion`.
- La marca de la pestaña Estado: punto rojo (error) o ámbar (solo advertencias).
- Orden de las tarjetas del Estado y el nombre "Próximas notas" para el bloque de próximos avisos.
- Configuración en dos columnas (destinatarios a la izquierda, firma y membrete a la derecha) con la barra de guardar fija.
- En celular (≤ 860px) se oculta la columna Para/CC del Libro.
- El mockup muestra una confirmación para desactivar el envío; en la implementación, como hoy, solo se confirma al activar.

## 14. Precisiones de la revisión previa (decisiones de Claude, con el mockup aprobado como guía)

- **Textos del mockup aprobado que se adoptan:**
  - el título de la página y del navegador pasa de "Sistema de Correos" a "Correos" (`<title>Correos - RPAD</title>`);
  - la fecha de envío del Libro en `dd/mm/aaaa HH:MM` (sección 6);
  - en "Próximas notas", cada gestión como lista (Próximo aviso / Próxima reiteración) con "1 dataset" / "N datasets" en singular y plural, en lugar de "(N dataset/s)"; "sin datasets pendientes" sigue igual;
  - las ayudas nuevas del Estado: "Las notas salen solas a las 8:15 de cada día hábil." bajo el envío automático y "Lo que saldría con los datasets de hoy, si nadie los actualiza antes." bajo Próximas notas.
  Ningún test fija los textos que cambian.
- **Marca de la pestaña Estado:** además de las alertas, cuenta `#nd-sin-quien-audite` (cambios sin ningún auditor ni editor de respaldo): si está visible y no hay errores, la marca es ámbar. Así ningún aviso queda escondido detrás de otra pestaña.
- **Ventana "Ver":** solo cambia el CSS y se agrega el cierre con Escape y con clic afuera; su contenido y cómo lo llena `accionDelLibro` no cambian. Con el foco dentro de la nota (iframe con `sandbox`), Escape no llega a la página: se cierra con la X o con clic afuera (aceptado).
- **Confirmación nueva:** usa el mismo mecanismo que `#modal-nota` (`.modal-overlay` que se muestra con la clase `.active`), no `hidden`.
- **Ícono de las alertas:** solo por CSS (`::before` con un SVG en `data:`), porque el test compara el `innerHTML` de `#nd-alertas` exacto. El estilo nuevo de `.nd-alerta` también se aplica a `#modal-nota-error` y a `#nd-sin-quien-audite`, a propósito.
- **Clases que el JS reescribe:** `cargarEstado` reemplaza el `className` de `#envio-activo-texto` (`badge badge-success` / `badge badge-secondary`) y `verificarConexionSMTP` el de `#smtp-status` (`smtp-status checking|success|error`): se mantienen esas clases y sus estilos (no entran en la limpieza de CSS), y lo nuevo de esos elementos va en su contenedor.
- **Funciones nuevas** (`mostrarPestana`, `teclaEnPestanas`, `pestanaInicial`, la de confirmación, la de cierre del modal) son declaraciones `function`, como las que los tests llaman desde el `vm`.
- **`tests/paginas.test.js`:** el test "correos.html: correos.js con la versión 20261024" sale del bucle que comparte con usuarios y pasa a `VERSION_CORREOS = '20261102'`: es el único test existente que cambia.
