# Rediseño de las páginas públicas (y la carcasa de todo el sitio)

Fecha: 18/10/2026. Rama: `feat/rediseno-publico`.
Mockups de referencia, con los datos de la base local del 18/10/2026: carpeta [2026-10-18-rediseno-publico-mockups/](2026-10-18-rediseno-publico-mockups/) (`portada.html`, `datasets.html`, `calendario.html`). Se abren directo en el navegador desde el repo. En `portada.html`, el recuadro de abajo a la derecha es solo del mockup: cambia la tipografía y el logo (quedan la A, Bricolage + Figtree, y el logo de hoy). Este documento manda sobre los mockups cuando difieren.

## 1. Intención

Las páginas públicas del RPAD (`index.html`, `datasets.html`, `calendario.html` y, por coherencia, `dataset.html` y `contacto.html`) se ven como un tablero genérico de administración, en palabras del usuario muy "hecho con Claude". Tienen un hero azul con degradé, cuatro tarjetas de números iguales, una dona, un reloj con segundos y la misma carcasa que las pantallas internas: un menú hamburguesa escondido, un header blanco y un footer oscuro.

El usuario quiere ir un paso más adelante con un rediseño completo, moderno y propio. Pidió colores pastel sin perder los de siempre (el azul institucional y los colores de estado), tipografía nueva e íconos Lucide. Dio libertad para sacar lo que no va y sumar cosas nuevas. El footer nuevo va en todas las páginas, y también el encabezado.

La portada pasa a hablarle primero a la ciudadanía. Arriba dice, en lenguaje simple, cuánto del registro está al día y muestra todo el registro de un vistazo. Abajo siguen las listas de seguimiento (vencidos y próximos) para el equipo y las áreas.

La regla del proyecto manda: son cambios visuales, de diseño y de contenido de las páginas. **No se rompe ninguna funcionalidad.** Siguen andando los links, los filtros, el CSV, el iCal, la sesión, el menú y los permisos.

## 2. Objetivos, no objetivos y anti-objetivos

Objetivos:
- Identidad visual nueva (sección 4) en las cinco páginas públicas.
- Encabezado, menú lateral y footer nuevos en las 13 páginas que tienen carcasa.
- Fuente nueva en todo el sitio (texto y títulos), también en el contenido de administración.
- Portada nueva: "Índice de actualización", el mosaico del registro, los 12 meses, Vencidos, Próximos a vencer y Últimas cargas (sección 6).
- Datasets con estados como botones con cantidades, vista de lista y orden (sección 7).
- Calendario en vista anual, sin la grilla mensual (sección 9).
- Los arreglos elegidos: calendario (queda resuelto al sacar FullCalendar), celular, logo del menú lateral, contraste y teclado (sección 11).
- Vista previa al compartir un link (metas Open Graph) en las páginas públicas (sección 12).
- Una sola versión en el footer: `RPAD v2.0.0`, con el año del © automático.

No objetivos:
- Cambiar la API, el backend, `app.js` (CSP incluida), la base, los crons, los emails o las notas.
- Rediseñar las pantallas de administración más allá del encabezado, el menú lateral, el footer y la fuente. En administración, los colores, las tablas, los formularios y los modales quedan como están.
- Rediseñar `login.html` y `establecer-contrasena.html` (el usuario no los eligió). En `login.html` solo se cambia el logo roto (sección 11).
- Modo oscuro.
- Abrir el sitio a los buscadores: `robots.txt` sigue cerrándolo a todos, salvo a los robots que arman la vista previa de un link (sección 12).
- URL "lindas" (`/datasets`): los nombres de archivo siguen iguales.
- La exposición de contactos de las áreas en la API pública (ver sección 17): queda para una sesión aparte.

Anti-objetivos (aunque "ande", sería un fracaso):
- Que se rompa un link en circulación: `datasets.html?estado=…`, `?mes=AAAA-MM`, `?tema=`, `?frecuencia=`, `?busqueda=`, `dataset.html?id=N`, `contacto.html`, `login.html`, `index.html` (adonde redirige el login).
- Que una página de administración cambie de comportamiento o de colores, o que un admin pierda el acceso a algo del menú.
- Que se vea "de plantilla": KPIs gigantes con degradé, tarjetas idénticas con sombra para todo, rótulos en mayúsculas sobre cada título, flechas "→" en los links.
- Que el celular se salga del ancho o que el encabezado se superponga.
- Que el estado o las fechas se recalculen en el navegador: siguen saliendo del servidor (`d.estado`, `dias_para_vencer`, `tasaActualizacion`) y se leen como texto (`'AAAA-MM-DD'`).

## 3. Decisiones del usuario (18/10/2026)

| Tema | Decisión |
|---|---|
| Para quién es la portada | Ciudadanía primero; abajo sigue el seguimiento para el equipo y las áreas |
| Páginas | index, datasets, calendario, más el detalle de dataset y Contacto. Ingreso no |
| Navegación | Encabezado nuevo en las 13 páginas, con Inicio, Datasets, Calendario y Contacto a la vista. El menú lateral queda para Administración, Herramientas y Mi perfil |
| Arreglos | Calendario (flechas e idioma), celular, logo del menú lateral, contraste y teclado |
| Portada, novedades | Mosaico del registro (agrupado por estado) y Últimas actualizaciones |
| Calendario | Solo vista anual: Vencidos, los 12 meses desde el actual y "Más adelante" |
| Datasets, novedades | Estados con cantidades, vista de lista y ordenar |
| Footer | `RPAD v2.0.0` en todas las páginas, año del © automático, fondo azul institucional |
| Compartir | Metas Open Graph en las públicas; `robots.txt` deja pasar solo a los robots de vista previa (Facebook, X, LinkedIn, Slack, Telegram, WhatsApp) y sigue cerrado para el resto, buscadores incluidos |
| Modo oscuro | No |
| Dirección visual | La de los mockups: banda celeste pastel arriba, mosaico, listas sin cajas, footer azul |
| Tipografía | Títulos: Bricolage Grotesque. Texto: Figtree. Atkinson Hyperlegible se descartó porque dibuja el cero cruzado |
| Logo del encabezado | El de hoy (`img/logo.png`) |
| Fuente en administración | La nueva también en el contenido de administración (solo cambia la letra) |
| Título de la portada | "Índice de actualización" + "El 80% de los conjuntos de datos con fecha de actualización están al día: 53 de 66." |
| Mockups del detalle y Contacto | No hacen falta: van directo a la spec y se ven en el navegador al implementar |

## 4. Identidad visual

### 4.1 Color

Sale de los colores de siempre: el azul institucional `#1A365D` (`--primary`) y los cinco colores de estado. Se agregan versiones pastel para los rellenos y tintas oscuras para el texto sobre pastel, de modo que todo pase AA (4,5:1).

| Token | Hex | Uso |
|---|---|---|
| `--tinta` | `#1A365D` | Títulos, botón principal, footer, bordes fuertes (el `--primary` de siempre) |
| `--tinta-honda` | `#142B4A` | Hover del botón principal |
| `--texto` | `#22324A` | Texto de cuerpo |
| `--suave` | `#56677F` | Texto secundario (≥ 4,5:1 sobre blanco y sobre la bruma) |
| `--bruma` | `#F4F7FA` | Fondo de las páginas públicas |
| `--papel` | `#FFFFFF` | Superficies |
| `--linea` | `#DAE3ED` | Bordes y separadores |
| `--cielo` | `#DCEEF5` | Banda pastel de arriba, nav activo, mes en curso (celeste del escudo, en pastel) |
| `--cielo-medio` | `#9FD3E6` | Marcas de los 12 meses, subrayados |
| `--sol` | `#FCE8A8` | Títulos del footer, aviso del filtro por mes (sol del escudo, en pastel) |
| `--sol-fuerte` | `#F2B705` | Anillo de foco (`:focus-visible`) sobre fondos oscuros (menú lateral, footer); sobre fondos claros, halo alrededor de un anillo `--tinta` (el amarillo solo no llega a 3:1 sobre blanco) |

Estados (cuadrito del mosaico / fondo de la insignia / texto de la insignia):

| Estado | Cuadrito | Fondo | Texto |
|---|---|---|---|
| actualizado | `#7FCBA9` | `#D5F0E3` | `#1D6648` |
| proximo | `#F3C55C` | `#FCEBC0` | `#7A4D00` |
| atrasado | `#EE8E86` | `#FADAD6` | `#9A2B26` |
| sin-respuesta | `#B39DE6` | `#E7DEFA` | `#55339A` |
| eventual y sin-fecha | `#C2CCD9` | `#E4E9F0` | `#45556B` |

Los colores de estado nuevos valen **solo en las páginas públicas**. En administración, las insignias y los colores siguen como hoy.

### 4.2 Tipografía

- Títulos (`h1`–`h3`, marca "RPAD", cifras destacadas): **Bricolage Grotesque**, peso 750, espaciado `-0.02em`.
- Texto: **Figtree** 400/500/600/700.
- Google Fonts: un solo `<link>` con las dos familias, que reemplaza al de Inter en las 13 páginas con carcasa. La CSP ya permite `fonts.googleapis.com` y `fonts.gstatic.com`.
- Escala: base 16 px; títulos de página `clamp(1.9rem, 3.2vw, 2.5rem)` (portada hasta 2.75rem); `h2` de sección 1.4–1.6rem; textos secundarios 0.85–0.92rem; nada por debajo de 0.75rem (12 px).
- En todo el sitio: `body` en Figtree y `h1`–`h4` / `.page-title` en Bricolage. En administración no cambia nada más (tamaños, pesos y colores siguen).

### 4.3 Forma y motivos

- Radios por jerarquía: paneles 22 px, tarjetas 16 px, campos 12 px, botones y chips en píldora, cuadritos 5 px.
- Pocas sombras: bordes de `--linea`. La única sombra marcada es la del panel del mosaico.
- **Ola**: una línea de olas (SVG) cierra la banda celeste de arriba en cada página pública. Es el mar del escudo y del logo. Es el único adorno.
- **Cuadrito = conjunto de datos**: el mosaico, las insignias (un cuadrito antes del texto, dibujado con CSS `::before`), las fichas del calendario y las leyendas usan el mismo cuadrito de color.
- Movimiento: ninguno automático. Solo una respuesta corta al pasar el mouse o enfocar un cuadrito (escala 1,3). Con `prefers-reduced-motion`, nada.
- Sin "→" en los links, sin rótulos en mayúsculas, sin separadores " · ".

## 5. La carcasa de todas las páginas

Las 13 páginas con carcasa: `admin`, `areas`, `calendario`, `contacto`, `correos`, `dataset`, `datasets`, `gestion`, `index`, `notas`, `perfil`, `reportes`, `usuarios`. Hoy cada una tiene el header, el menú y el footer copiados a mano. **Siguen copiados a mano**, porque los tests leen el HTML estático. Se reemplazan en las 13 con el mismo markup.

### 5.1 Encabezado

- Izquierda: `img/logo.png` (alt "Municipalidad de Comodoro Rivadavia"), un separador y "RPAD" con debajo "Registro Permanente de Actualización de Datasets" (sin mayúsculas forzadas).
- Centro-derecha: `<nav class="header-nav" aria-label="Principal">` con **Inicio** (`index.html`), **Datasets**, **Calendario** y **Contacto**. La página actual lleva `aria-current="page"` escrito en su HTML. `dataset.html` marca Datasets; las de administración no marcan ninguno.
- Derecha: `#header-actions`, que `main.js` sigue llenando igual ("Ingresar", o campana + usuario + "Salir"). Su markup no cambia (lo fija `tests/main-frontend.test.js`); cambia el CSS.
- Botón del menú lateral (`#sidebarToggle`): con sesión, siempre visible. Sin sesión, solo cuando el nav no entra (≤ 760 px). Lo decide el CSS con la clase `header--con-sesion`, que `initHeader` pone en `.header` cuando hay sesión. No se usa `:has()`, porque Firefox ESR 115 no lo soporta. Lleva `aria-label="Abrir el menú"`, `aria-controls="sidebar"` y `aria-expanded` (lo actualiza `main.js`).
- Celular (≤ 760 px): se ocultan el nav, el subtítulo y el nombre y rol del usuario (queda el avatar). Con sesión, el encabezado no se superpone a 375 px.
- **En ningún ancho se superpone nada.** Con sesión, la parte derecha es más ancha (campana, usuario, "Salir"). Entre 761 px y ~1100 px, primero se oculta el subtítulo, después el nombre y el rol, y si igual no entra, el nav pasa al menú lateral antes que sin sesión. Los cortes exactos los elige quien construye, probando con y sin sesión.
- El alto del encabezado pasa a 72 px. Se actualiza `--header-height` en `main.css`: la usan el menú lateral y el margen de `.main-content` en todas las páginas.
- Se mantienen las clases y los ids que usa `main.js`: `.header`, `.header-left`, `.header-right`, `#header-actions`, `.sidebar-toggle#sidebarToggle`, `.header-logo`, `.header-title`, `.header-subtitle`, `.header-user*`, `.header-notification*`.

### 5.2 Menú lateral

- Mismo comportamiento (cajón que se abre con el botón; se cierra con el velo o con Escape) y mismos ids: `#sidebar`, `#sidebarOverlay`, `#sidebarPrincipal`, `#sidebarAdmin`, `#sidebarTools`, `#sidebarAccount`. Mismas reglas de visibilidad por rol en `main.js`.
- Fondo `--tinta` con `img/logo-2025-blanco.png` arriba (reemplaza a `img/logo-blanco.png`, que no está en el repo).
- "Principal" pasa a: **Inicio** (`index.html`), **Datasets**, **Calendario** y **Contacto** (antes: Tablero, Calendario, Datasets, sin Contacto). En pantallas anchas se oculta "Principal", porque ya está en el encabezado.
- Administración, Herramientas y Mi cuenta: los mismos ítems y links de hoy. Queda **exactamente un** `href="usuarios.html"` por página (test).
- Se va "Verificar Sello" de `gestion.html`: apunta a `verificar.html`, que no existe.
- Cerrado no se puede tabular: `visibility: hidden` cuando no está abierto.
- Link activo: igual que hoy (`.sidebar-link.active`, lo pone `main.js`).

### 5.3 Footer

Fondo `--tinta`; `<footer class="footer">` al final, a todo el ancho (hoy queda dentro del padding de `.main-content`). Cuatro columnas que en el celular pasan a una:
1. `img/logo-2025-blanco.png`, **Dirección de Datos Públicos y Comunicación**, y debajo "D. G. de Modernización e Investigación Territorial" (abreviado para que entre en una línea) y "Subsecretaría de Modernización y Transparencia".
2. **El registro**: Inicio, Datasets, Calendario, Contacto.
3. **Datos abiertos**: `datos.comodoro.gov.ar` (link externo, `target="_blank" rel="noopener"`) y "Licencia CC BY-SA 4.0".
4. **Marco legal**: "Ordenanza N° 17.662/23, artículo 8°".

Barra de abajo: "© {año} Secretaría de Gobierno, Modernización y Transparencia. Municipalidad de Comodoro Rivadavia" y `<span>RPAD v2.0.0</span>`.
- El año va escrito en el HTML (`2026`) dentro de `<span id="footer-anio">`, y `main.js` lo reemplaza por el año en curso en Argentina (`Intl.DateTimeFormat` con `America/Argentina/Buenos_Aires`, sin `toISOString`).
- Sin `<section>` (lo exige `correos-frontend.test.js`), sin `onclick`, sin emojis. En `correos.html` se conserva el comentario `<!-- Footer -->` antes del footer.
- Se actualizan los dos tests de versión: `admin.html` y `correos.html` pasan a `<span>RPAD v2.0.0</span>`, sin `v1.4.0` ni `v1.5.0`.

### 5.4 CSS

- `css/main.css` (lo cargan las 13 páginas) lleva:
  - la carcasa nueva (encabezado, menú lateral y footer);
  - las fuentes nuevas en `body` y `h1`–`h4`/`.page-title`;
  - los tokens nuevos de la sección 4.1.

  Los tokens nuevos se definen en `main.css`: el test de variables exige que toda `var(--x)` de `main.css` esté definida ahí mismo. Los valores de las variables viejas (`--primary`, `--gray-*`, `--border-radius*`, `--shadow*`, etc.) **no cambian**, así administración conserva sus colores.
- `css/publico.css` (nuevo, solo en las 5 páginas públicas) tiene todo lo de las páginas públicas: banda, ola, botones, campos, insignias pastel, mosaico, meses, listas, tarjetas, tabla, almanaque, detalle y Contacto. Como lo cargan solo esas páginas, las insignias pastel no llegan a administración.
- `index.html` deja su `<style>` de ~1020 líneas (una copia vieja de `main.css`) y pasa a cargar `css/main.css` + `css/publico.css`, como las demás. Los `<style>` de `datasets.html`, `dataset.html`, `calendario.html` y `contacto.html` se van a `publico.css`.
- Las hojas llevan `?v=` (hoy `main.css` no lo tiene): `css/main.css?v=20261019` y `css/publico.css?v=20261019` (o la fecha del día en que se termine; misma versión en todas las páginas). Se suma un test que lo verifica.
- `styles.css`, `layout.css` y `perfil.css` siguen sin usarse. No se tocan; borrarlos queda fuera de este trabajo.

### 5.5 Íconos

SVG Lucide embebidos, como hoy (no hay librería por CDN). `aria-hidden="true"` en los decorativos.

## 6. Portada (`index.html` + `js/dashboard.js`)

Orden en pantalla (ver `portada.html` del mockup):

1. **Banda celeste**, en dos columnas en escritorio y una en el celular:
   - Izquierda:
     - `h1` **"Índice de actualización"**.
     - Frase: "El **{tasa}%** de los conjuntos de datos con fecha de actualización están al día: {al día} de {base}." La tasa es `tasaActualizacion` del servidor; al día = `actualizados + proximos`; base = `total − eventuales`, la misma base que la tasa del servidor.
     - Aclaración: "El registro sigue {total} conjuntos. Los otros {eventuales} son eventuales: se publican cuando hay novedades y no tienen vencimiento." Si hay sin fecha, se suma: "{n} todavía no tienen fecha de próxima actualización."
     - Botones "Ver los datasets" y "Ver el calendario".
     - Al pie: "Situación al {día de la semana} {d} de {mes} de {aaaa}.", con `Utils.hoyEnArgentina()`. El día de la semana se calcula del texto con `Date.UTC`, nunca con la zona del navegador.
   - Derecha, **el mosaico**: un panel blanco con un cuadrito por conjunto de datos, agrupado por estado.
     - Grupos: **Actualizados**, **Próximos a vencer**, **Vencidos** (atrasados y sin respuesta, en dos colores con su leyenda) y **Eventuales**. **Sin fecha** va solo si hay.
     - Cada grupo con su cantidad. Dentro de cada grupo, orden alfabético.
     - Cada cuadrito es un `<a href="dataset.html?id=N">` con `aria-label="{título}, {estado}"`.
     - Al pasar el mouse o enfocar, el pie del panel (`aria-live="polite"`) dice el título, el área y el estado. En el celular el toque abre el detalle.
2. **Qué vence en los próximos 12 meses**: una columna por mes, desde el actual. Cada columna lleva la cantidad arriba, una marca por conjunto apilada y el mes abajo ("oct 26").
   - Cada columna es un link a `datasets.html?mes=AAAA-MM` con `aria-label` ("enero de 2027: vencen 16 conjuntos").
   - El mes en curso va con fondo `--cielo`.
   - En el celular, la fila se desplaza de costado dentro de su caja (la página no).
   - Es HTML: **se saca Chart.js** de la portada.
3. Dos columnas (una en el celular), sin cajas: filas separadas por líneas, con una línea `--tinta` arriba de cada lista.
   - **Vencidos**: "Pasó su fecha de actualización y todavía no se cargaron los datos nuevos. Primero, los que llevan más tiempo." Seis filas: título, área, "{n} días de atraso" (o "1 día") y la insignia "Atrasado" o "Sin respuesta". Debajo, "Ver los {n} vencidos" → `datasets.html?estado=vencidos`. Sin vencidos: "No hay conjuntos vencidos."
   - **Próximos a vencer**: "Vencen en los próximos 60 días." Todas las filas: "{n} días para vencer" ("Vence hoy" si son 0). Vacío: "Ninguno vence en los próximos 60 días."
   - **Últimas cargas en el portal**: "Los conjuntos que se actualizaron más recientemente." Cinco filas, por `ultima_actualizacion` (texto) descendente, sin las nulas: título, área, "{dd/mm/aaaa}" y "cargado".
   - Cada fila es un `<a href="dataset.html?id=N">`.

Se van:
- el saludo ("Buenas tardes, …");
- la fecha y la hora en vivo;
- las cuatro tarjetas con contador animado;
- la dona y su leyenda;
- los "Ver más / Ver menos".

Con sesión, la portada es la misma: la sesión solo cambia el encabezado.

Estados:
- Mientras carga: el mosaico y las listas muestran un texto "Cargando…" (sin esqueletos que no se ven).
- Si falla `/datasets/estadisticas` o `/datasets`, o llega un JSON de error: un aviso en la banda, "No se pudieron cargar los datos del registro. Probá de nuevo en unos minutos.". Nada se dibuja con ceros engañosos.
- Para distinguir el error de la lista vacía, las páginas públicas piden los datos con `API.pedirJson('GET', '/datasets')` y `API.pedirJson('GET', '/datasets/estadisticas')`, que tiran error ante una respuesta de error. No usan `API.getDatasets()` ni `getEstadisticas()`, que devuelven `[]` o `undefined`. `api.js` no cambia: esas dos funciones las siguen usando las pantallas de administración. Vale igual para Datasets, el detalle y el Calendario.
- `<noscript>`: "Para ver el índice hace falta JavaScript."

`dashboard.js`:
- Conserva `mesesDelGrafico`, `vencimientosPorMes`, `urlDelMes`, `textoTasa` y `alertasDe`, con sus tests.
- Suma funciones puras con test: los grupos del mosaico, el texto del índice, el HTML del mosaico, el HTML de los meses, las últimas cargas y el HTML de las filas.
- Se borran, con sus tests, `porcentajesEnteros`, `porcionesDelEstado` y `htmlDeLeyenda` (eran de la dona), `goToDatasets`, `toggleAtrasados`, `toggleProximos`, `animateCounter`, el reloj y los gráficos.
- Al cargarse, sigue solo declarando (`tests/publico-frontend.test.js` lo carga en un `vm`).

## 7. Datasets (`datasets.html` + `js/datasets.js`)

Ver `datasets.html` del mockup.
- Banda: `h1` "Datasets", "Los {n} conjuntos de datos que sigue el registro, con su estado y cuándo se actualizan." y "Exportar CSV" (botón con borde; mismo `exportarCSV`).
- **Estados como botones con cantidades**: Todos, Actualizados, Próximos a vencer, Vencidos, Eventuales y Sin fecha (este, solo si hay alguno o si está elegido).
  - Cada botón lleva su cuadrito y su cantidad, y `aria-pressed`.
  - Las cantidades cuentan lo que dejan los otros filtros (búsqueda, tema, frecuencia, mes).
  - Al elegir Vencidos aparece una segunda fila: "Todos los vencidos", "Atrasados" y "Sin respuesta del área".
  - Los valores son los de hoy (`actualizado`, `proximo`, `vencidos`, `atrasado`, `sin-respuesta`, `eventual`, `sin-fecha`), así que `?estado=` sigue igual.
  - **Reemplazan al `<select id="filter-estado">`.** Se actualiza el test que buscaba sus `<option>`: ahora verifica que estén los valores `eventual` y `sin-fecha`.
- Herramientas, con `<label for>` en cada campo:
  - **Buscar**: `#search`, igual que hoy, con debounce.
  - **Tema**: `#filter-tema`, principal o secundario.
  - **Frecuencia**: `#filter-frecuencia`.
  - **Ordenar por** (nuevo): Nombre (por defecto), Próximo vencimiento, Área.
  - **Vista** (nuevo): Tarjetas (por defecto) o Lista.
  - "Limpiar filtros".
- **URL**: se suman `orden=proxima|area` y `vista=lista`, que solo se escriben si no son los de por defecto. Los parámetros de hoy no cambian.
- Debajo: "{n} conjuntos" y, si hay `?mes=`, la pastilla amarilla "Vencen en enero de 2027" con "Quitar" (mismo `#filtro-mes`, `#filtro-mes-texto`, `quitarFiltroMes`).
- **Tarjetas** (`htmlDeTarjeta`), en tres columnas en escritorio, dos en tableta y una en el celular:
  - título (el link `dataset.html?id=N` cubre toda la tarjeta) e insignia de estado;
  - descripción en 2 líneas;
  - área con su ícono y frecuencia con el suyo;
  - tema principal;
  - pie con los formatos y las dos fechas cortas ("Datos al dic 2025" / "Próxima: ene 2027").

  Se respetan los textos y el markup que fijan los tests: `</svg> {área}</span>`, `<span class="badge badge-…">Texto</span>` sin clases ni atributos extra y sin `<img>`, `<b>` ni `<i>`.
- **Lista** (nuevo, `htmlDeFila`): una tabla con Conjunto de datos (título con link + área debajo), Tema, Frecuencia, Datos, Próxima y Estado. En el celular cada fila se apila y se ocultan Tema y Frecuencia.
- Paginación: 24 tarjetas o 50 filas por página, con los mismos controles restilados ("Página 1 de 2", con tilde). Al cambiar de página, el desplazamiento deja la primera fila debajo del encabezado fijo (`scroll-margin-top`).
- Vacío: "No hay conjuntos con esos filtros." y "Limpiar filtros". Error de carga: "No se pudo cargar el listado. Probá de nuevo en unos minutos." (hoy queda el spinner para siempre).
- CSV: sin cambios (encabezados, BOM, filas).

## 8. Detalle (`dataset.html` + `js/dataset-detail.js`)

- Migas: Inicio / Datasets / {título}.
- Banda celeste:
  - `h1` con el título, la insignia de estado larga ("Sin respuesta del área responsable", etc.), el área con su ícono y los temas;
  - si hay `url_dataset` segura, el botón principal "Ver en el Portal de Datos Abiertos".
- Debajo, dos columnas (una en el celular, con las fechas **antes** que los textos largos):
  - Principal: **Descripción**, **Qué se solicita** y **Observaciones**, como bloques con título y texto, sin cajas pesadas. Descripción y Observaciones respetan los saltos de línea.
  - Lateral, un panel blanco:
    - **Fechas**: `#dataset-fechas` con `htmlDeFechas`, sin cambios: "Datos al", "Cargado en el portal", "Próxima actualización prevista", 3 `info-row`.
    - **Información técnica**: Frecuencia, Formatos, Tipo de gestión.
    - **Licencia**: Creative Commons BY-SA 4.0.
- Se arregla el ícono del área: el JS escribe en `#dataset-area-text`, no pisa el `<p>`.
- Cargando, no encontrado y error: los mismos tres estados de hoy, restilados. El de no encontrado lleva "Ver todos los datasets".
- Se mantienen todos los ids que usa el JS y el texto "Última actualización" sigue sin aparecer en el archivo.

## 9. Calendario (`calendario.html` + `js/calendario.js`)

Ver `calendario.html` del mockup.
- Banda: `h1` "Calendario de vencimientos", "Mes por mes, qué conjuntos de datos tienen que actualizarse. Casi todos vencen el último día del mes." y el botón "Exportar a mi calendario (iCal)". El botón llama al mismo `exportarIcal`; el formato del `.ics` no cambia. Exporta lo que dejan los filtros, como hoy; con un tema elegido entran también los del tema secundario.
- Filtros, con `<label for>`: Área (`#filter-area`) y Tema (`#filter-tema`, principal **o secundario**, como en Datasets; hoy solo el principal). Al lado, "Limpiar" y la leyenda de los cuatro estados con su cuadrito.
- **Almanaque**: filas, cada una con el rótulo a la izquierda y las fichas de los conjuntos a la derecha (en el celular, una debajo de la otra).
  1. **Vencidos**, si hay, con fondo rosado muy claro: los atrasados y sin respuesta, cada uno con el mes en que venció ("ene 2024"), ordenados por fecha.
  2. Una fila por cada uno de los **12 meses desde el actual**, con los mismos meses que la portada (`mesesDelGrafico`). El nombre del mes es un link a `datasets.html?mes=AAAA-MM`; el año va en el mes en curso y en cada enero. El mes en curso lleva fondo `--cielo` y "Este mes". Sin vencimientos: "Nada vence este mes." en una fila finita.
  3. **Más adelante**, si hay: los que vencen después del mes 12, con su mes.
- Cada ficha es un link a `dataset.html?id=N` con su cuadrito de estado y el título; el área va en `title`. Los eventuales y los sin fecha no aparecen (como hoy).
- **Se saca FullCalendar** (los tres `<script>`/`<link>` de jsDelivr), la grilla mensual y el modal del día. Con eso desaparecen los dos defectos: las flechas sin ícono (la CSP bloqueaba su fuente) y el idioma en inglés (el archivo del español daba 404).
- `calendario.js`:
  - Sigue solo declarando al cargarse.
  - Se borran, con sus tests, `determinarColorEvento`, `htmlDelDia`, `mostrarModalDia`, `cerrarModalDia`, `generarEventos`, `obtenerEventosDelDia`, `inicializarCalendario` y `formatearFecha`, si no la usa el iCal.
  - Suma funciones puras con test: las filas del almanaque y su HTML.
  - Se mantienen `exportarIcal`, `limpiarTextoIcal` y `limpiarFiltros`.
- Vacío por filtros: "No hay conjuntos con fecha para esos filtros." Error: "No se pudo cargar el calendario. Probá de nuevo en unos minutos."

## 10. Contacto (`contacto.html`)

- Solo se restila:
  - banda con `h1` "Contacto" y una bajada;
  - el formulario en un panel blanco de una columna (máximo ~640 px), con los campos y botones del sistema nuevo y `<label for>`;
  - al lado (debajo en el celular), el bloque de información de hoy, **con todo su contenido**: la Dirección y la Dirección General, la dirección postal (Belgrano N° 965 PB), el link al Portal de Datos Abiertos y el horario de atención (lunes a viernes de 8:00 a 15:00 hs).
- `contacto.js` no cambia: mismos ids (`#contacto-form`, `#nombre`, `#email`, `#tipo`, `#mensaje`, `#char-count`, `#btn-enviar`), tipos, límites y mensajes.
- Sigue sin cargar `api.js`.

## 11. Arreglos incluidos

- **Calendario**: resuelto al sacar FullCalendar (sección 9).
- **Celular**: ninguna página pública se sale del ancho a 375 px, y el encabezado con sesión no se superpone. Se verifica en el navegador con la emulación de celular, no con capturas de Chrome sin interfaz: estas no bajan de ~500 px de ancho y muestran un desborde falso.
- **Logo del menú lateral**: `img/logo-2025-blanco.png` (versionado) en el menú de las 13 páginas y en el panel azul de `login.html`. Es el único cambio en `login.html`. `img/logo-blanco.png` deja de usarse.
- **Contraste y teclado**:
  - insignias y textos ≥ 4,5:1;
  - cuadritos, meses y filas son links reales (`<a>`);
  - foco visible en links, botones y campos de las páginas públicas y de la carcasa. Sobre fondos claros: anillo `--tinta` de 3 px con un halo `--sol-fuerte`. Sobre fondos oscuros: anillo `--sol-fuerte`. El indicador llega al menos a 3:1 contra su fondo (WCAG 1.4.11);
  - `<label for>` en todos los filtros;
  - menú cerrado fuera del orden de tabulación;
  - botón del menú con `aria-label`, `aria-controls` y `aria-expanded`.

## 12. Compartir (Open Graph)

- En las 5 páginas públicas, en el `<head>`:
  - `og:type` `website`;
  - `og:site_name` "RPAD";
  - `og:title` y `og:description` de cada página;
  - `og:url` y `og:image` absolutos con `https://rpad.mcrmodernizacion.gob.ar` (el `RPAD_URL` por defecto de `services/emailTemplates.js`);
  - `og:locale` `es_AR`;
  - `twitter:card` `summary_large_image`;
  - `theme-color` `#1A365D`.
- `og:url` solo en las páginas sin parámetros (`index.html`, `calendario.html`, `contacto.html`). `datasets.html` y `dataset.html` no lo llevan: el HTML es estático y una URL fija sin `?id=` ni filtros haría que Facebook o LinkedIn mandaran a la página sin el dataset o sin los filtros (cambio del 18/10/2026, después de la revisión de la Task 6).
- Imagen nueva `public/img/compartir.png`, de 1200×630: fondo `--cielo`, el logo de hoy, "RPAD", "Registro Permanente de Actualización de Datasets", una franja de cuadritos de estado y la ola. Se genera una vez a partir de un HTML con Chrome sin interfaz y se versiona; el HTML queda en el scratchpad.
- `robots.txt` deja pasar solo a los robots que arman la vista previa:
  - `facebookexternalhit` y `Facebot` (Facebook e Instagram);
  - `Twitterbot`, `LinkedInBot`, `Slackbot-LinkExpanding` (con `Slackbot`), `TelegramBot` y `WhatsApp`;
  - para cada uno, `Allow` de las páginas públicas y de `img/compartir.png`.

  Para todos los demás sigue `User-agent: *` con `Disallow: /`, buscadores incluidos. Los robots de vista previa no indexan.

## 13. Lo que no se puede romper (contrato)

- **Archivos y URL**:
  - `index.html`, `datasets.html`, `dataset.html`, `calendario.html`, `contacto.html` y `login.html`, con los mismos nombres;
  - `PAGINAS_PUBLICAS` de `main.js`, igual;
  - los parámetros de `datasets.html` (sección 7) y `dataset.html?id=`;
  - los archivos de descarga: `datasets-rpad-AAAA-MM-DD.csv` y `rpad-vencimientos-AAAA-MM-DD.ics`.
- **Scripts**: siguen como `<script src="js/X.js?v=…"></script>` a secas, sin `defer` ni atributos (los extrae `paginas.test.js`).
  - Como se tocan `main.js`, `dashboard.js`, `datasets.js`, `dataset-detail.js` y `calendario.js`, se suben las versiones: `auth.js`, `main.js` y `api.js` van con la misma versión nueva en todas las páginas, porque el test usa una sola constante `VERSION`. También se sube `VERSION_PUBLICAS`, y las constantes del test se actualizan.
  - `api.js` y `auth.js` no cambian de contenido.
  - El cambio de versión de `auth.js` y `api.js` toca también los `<script>` de `login.html` y `establecer-contrasena.html`. En esas dos solo cambia el `?v=` (y el logo en `login.html`).
- **JS que se carga en un `vm`**: funciones `function` de nivel superior y nada que toque el DOM al cargarse. Lo exigen los tests de `dashboard.js`, `datasets.js`, `dataset-detail.js`, `calendario.js` y `main.js`. `dashboard.js` no menciona `Utils.calcularEstado`, `getDiasRestantes` ni `frecuencia_dias`.
- **`main.js`**:
  - el markup del usuario en el header no cambia (`header-user-name`, `header-user-avatar`, `header-user-role`, escapados);
  - lo nuevo (año del footer, `aria-expanded`) corre en `DOMContentLoaded` o en `initSidebar`, nunca al cargarse.
- **Administración**: las páginas y sus tests (`admin-frontend`, `correos-frontend`, `perfil-frontend`, `usuarios-frontend`, `login-frontend`) siguen en verde.
  - En `admin.html`: sin `onclick=` en el HTML estático y sin emojis.
  - En `correos.html`: 4 `<section>` exactas y `<!-- Footer -->`.
  - En `perfil.html`: `.main-content` sin `max-width`. El ancho máximo de las páginas públicas va en un contenedor interno (`.publico-contenedor`), no en `.main-content`.
- **Fechas y estados**: como hoy. Texto `'AAAA-MM-DD'` cortado, `Utils.hoyEnArgentina()`, `d.estado` y `dias_para_vencer` del servidor, y nunca `new Date('AAAA-MM-DD')` en la zona del navegador.
- **CSP**: sin cambios. Solo Google Fonts y jsDelivr (que deja de hacer falta en las públicas: Chart.js sigue solo en `gestion.html`), imágenes locales.

## 14. Tests

- **Se actualizan**:
  - `paginas.test.js`: versiones y un test nuevo de que las hojas `main.css`/`publico.css` tienen `?v=` y la misma versión en todas las páginas;
  - `publico-frontend.test.js`: los tests de la dona y del modal del calendario se reemplazan por los de las funciones nuevas, y el de las `<option>` de estado pasa a los botones;
  - `admin-frontend.test.js` y `correos-frontend.test.js`: `RPAD v2.0.0`.
- **Nuevos**, con funciones puras en el `vm`:
  - grupos del mosaico: orden, etiquetas, Vencidos = atrasado + sin respuesta, Sin fecha solo si hay, y que la suma dé el total;
  - texto del índice: tasa del servidor, base `total − eventuales` y sin fecha;
  - últimas cargas: orden por texto y sin nulas;
  - HTML del mosaico y de los meses: links, `aria-label` y escapado;
  - orden del listado (nombre, próxima y área) y `htmlDeFila` (escapa, link, insignia);
  - cantidades por estado con los otros filtros;
  - filas del almanaque: vencidos primero, 12 meses desde el actual, "Más adelante", sin eventuales ni sin fecha, y tema secundario;
  - año del footer.
- `npm test` completo antes y después, con Docker. Verificación en el navegador:
  - las 13 páginas en escritorio y a 375 px, con y sin sesión;
  - el superadmin de prueba `prueba_super` (id 10), con un JWT local de 1 hora.

## 15. Documentación

- `CLAUDE.md`:
  - CDN (no hay Lucide por CDN; Chart.js solo en Gestión; FullCalendar ya no);
  - estructura de `public/css` (`main.css` + `publico.css`; los otros tres sin uso);
  - orden real de los scripts (config, auth, main, api, página);
  - fuentes (Bricolage + Figtree) y variables nuevas;
  - "Sitio público" (portada, calendario anual, Datasets con estados, lista y orden);
  - carcasa compartida.
- `README.md`: versión 2.0.0, árbol de `public/`, filtros y vistas, y una entrada en el changelog.

## 16. Despliegue

- Kit como los anteriores, en el Escritorio. Lleva `archivos-…zip` (reemplazos), `vuelta-atras/archivos-anteriores.zip` y `PASOS.txt` en ASCII.
- Sin SQL, sin npm y sin Restart: son archivos estáticos de `public/` (incluido `public/robots.txt`), más docs. Si el kit trae `app.js` o algo del servidor, es un error del plan.
- Archivos nuevos: `public/css/publico.css` y `public/img/compartir.png`.
- Verificación en producción, solo mirando: las 5 públicas y una de administración, con Ctrl+F5.

## 17. Fuera de este trabajo (para otra sesión)

- La API pública (`GET /api/datasets` y `/:id`) devuelve los contactos del área (emails, teléfonos y nombre del contacto) sin sesión. El frontend no los muestra. Decidir si es intencional es un cambio de backend.
- Borrar `css/styles.css`, `layout.css` y `perfil.css`, que no se usan.

## 18. Decisiones mías (para revisar al leer)

- Las páginas de administración no pierden nada del menú. "Principal" se oculta en escritorio porque está en el encabezado, y "Tablero" pasa a llamarse "Inicio".
- Se va "Verificar Sello" de `gestion.html`: es un link roto.
- El cuadrito de estado también va en las insignias (con CSS, sin tocar el markup que fijan los tests).
- Se borran las funciones y los tests de la dona y del modal del calendario, en vez de dejarlos sin uso.
- Datasets pagina de a 24 tarjetas (múltiplo de 2 y 3 columnas) o 50 filas.
- La vista y el orden viajan en la URL, como los otros filtros. No se guardan en el navegador.
- Al pie de la banda de la portada dice "Situación al …" y no "Datos al …": "Datos al" ya es un rótulo con otro significado.
- En el calendario, el filtro de tema mira también el tema secundario, como Datasets.
- La imagen para compartir es nueva y se genera desde un HTML.
- `login.html` solo cambia de logo, aunque la fuente nueva vaya "en todo el sitio": no es parte del rediseño.
- Para distinguir "falló la carga" de "no hay datos", las páginas públicas usan `API.pedirJson` (que ya existe y tira error) en vez de tocar `getDatasets`/`getEstadisticas`, que usa administración.
- El encabezado pasa de 64 a 72 px en todas las páginas.
