# Frontend común y sitio público

Cómo se cargan las páginas, las versiones, el CSS, la carcasa y las páginas públicas. Cada página de administración o herramienta tiene su parte en el documento de su tema.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-18-rediseno-publico-design.md`
- `docs/superpowers/specs/2026-10-19-indice-portada-design.md`

## Carga de las páginas y versiones

- Cada página con carcasa carga: config.js → auth.js → main.js → api.js → página.js (admin, además, `admin-fechas.js` entre `api.js` y `admin.js`;
  Configuración, `usuarios.js`, después `areas.js` y después `feriados.js`;
  Contacto, sin `api.js`).
  `login.html`: config → auth → api;
  `establecer-contrasena.html`: config → la suya.
  Siempre `<script src="js/X.js…"></script>` a secas, sin `defer` ni otros atributos (lo lee `tests/paginas.test.js`), con `?v=` en los que lo llevan (`config.js` y `contacto.js` van sin versión;
  `reportes.js` la lleva desde «Métricas y Reportes», `VERSION_REPORTES` —desde los feriados en todo el sistema (tanda 2), en `'20261208'`—, y `notas.js` desde el Generador de Notas, `VERSION_NOTAS`;
  `usuarios.js`, `areas.js` y `feriados.js`, `VERSION_PANTALLAS`, `VERSION_AREAS` y `VERSION_FERIADOS` —desde Mi espacio, la primera y la última en `'20261209'`; desde los feriados en todo el sistema (tanda 1), `VERSION_PANTALLAS` en `'20261210'` y, desde la licencia anulada en Configuración, en `'20261211'`; desde los días restituidos, `VERSION_FERIADOS` en `'20261210'`—;
  `proyectos.js`, `VERSION_PROYECTOS`;
  `mi-espacio.js`, `VERSION_MI_ESPACIO`, y `correos.js`, `VERSION_CORREOS` —desde la agenda, las dos en `'20261210'`, desde el Resumen «Titular», `VERSION_MI_ESPACIO` en `'20261211'`, desde la nota de licencia en Word, en `'20261212'` y, desde la planilla de horas extras de contrato, en `'20261213'`;
  desde los feriados en todo el sistema (tanda 1), `VERSION_MI_ESPACIO` en `'20261214'` y `VERSION_CORREOS` en `'20261211'`, desde la licencia anulada en Configuración y las licencias de otro año, `VERSION_MI_ESPACIO` en `'20261215'`, desde la agenda con más onda, en `'20261216'`, desde las vacaciones al cargar una licencia, en `'20261217'`, desde el evento Personal (Público), en `'20261218'`, desde «Sumar al mes anterior», en `'20261219'`, desde los días restituidos,
  en `'20261220'` desde las horas acumuladas, en `'20261221'` y, desde la reiteración bimestral, en `'20261222'`, con `VERSION_PANTALLAS` y `VERSION_CORREOS` en `'20261212'`; desde la firma digital, `VERSION_MI_ESPACIO` en `'20261223'` y `VERSION_PANTALLAS` y `VERSION_CORREOS` en `'20261213'`—);
  `auth.js`, `main.js` y `api.js` con la misma versión en todas las páginas (`VERSION`).

## Las páginas públicas

- `dashboard.js`, `datasets.js`, `dataset-detail.js` y `calendario.js`: al cargarse solo declaran (`tests/publico-frontend.test.js` los carga en un `vm`;
  `main.js`, igual, en `tests/main-frontend.test.js`); lo que cuenta, ordena y arma el HTML es puro, y lo que toca el DOM o la API va aparte.
  Piden los datos con `API.pedirJson` (tira error ante una respuesta de error), no con `API.getDatasets()` ni `getEstadisticas()` (devuelven `[]` o `undefined`; los sigue usando administración): así un error no se dibuja como una lista vacía o con ceros.

## CSS

- Dos hojas, con `?v=` y la misma versión en todas las páginas (`VERSION_CSS` de `tests/paginas.test.js`):
  `css/main.css`, en las 14 páginas con carcasa, y `css/publico.css`, solo en las 5 públicas y después de main.css (así las insignias pastel no llegan a administración).
  `styles.css`, `layout.css` y `perfil.css` no los carga ninguna página.
  Las de administración tienen además su `<style>`; las públicas, no.
- main.css: la carcasa, las fuentes y los tokens nuevos:
  `--tinta` (#1A365D, el `--primary` de siempre), `--tinta-honda`, `--texto`, `--suave` (secundario, ≥ 4,5:1 sobre blanco y bruma), `--bruma` (fondo público), `--papel`, `--linea`, `--cielo` (banda), `--cielo-medio`, `--sol`, `--sol-fuerte`, `--f-titulo` y `--f-texto`.
  Toda `var(--x)` de main.css se define en main.css (test).
  Las variables viejas (`--primary`, `--success`, `--warning`, `--danger`, `--gray-*`, `--shadow*`…) no cambiaron: administración conserva colores, tablas, formularios y modales (`.btn-primary`, `.badge-*`, `.form-*`, y `.alert-*` en el `<style>` de sus páginas).
- Fuentes (un solo `<link>` de Google Fonts, igual en las 14):
  Figtree (texto, `body`) y Bricolage Grotesque con `-0.02em` (`h1`–`h4`, `.page-title`, la marca "RPAD"; en las públicas, peso 750).
  En administración solo cambió la letra.
- publico.css: colores de estado (`--cuadro-*` del cuadrito, `--fondo-*` y `--texto-*` de la insignia, ≥ 4,5:1), `--borde-control` (#76879F, contorno de los controles ≥ 3:1;
  `--linea` queda para separadores y bordes decorativos) y radios (`--radio-panel` 22 px, `--radio-tarjeta` 16, `--radio-campo` 12, `--radio-cuadro` 5).
  Piezas:
  `<main class="main-content main-publico">` con el ancho en `.publico-contenedor` (no en `.main-content`:
  `perfil.html` lo necesita sin `max-width`), la banda celeste (`.banda` + `.banda-cuerpo` + el `svg.ola` copiado en cada página, el único adorno), `.btn-tinta`/`.btn-borde` (píldoras), `.campo` (label + control de 44 px), las insignias `.badge-*` pastel con su cuadrito (`::before`, sin tocar el markup), `.lista`/`.fila` y `.aviso`/`.aviso-error`.
- Foco visible: sobre fondos claros, anillo `--tinta` de 3 px con halo `--sol-fuerte`; sobre el azul del menú lateral y del footer, anillo `--sol-fuerte`.
  En las públicas, sin "→" en los links, sin rótulos en mayúsculas y sin separadores " · ".
- Ningún nombre de clase ni id empieza con `ad-` (de «admin»): los bloqueadores de anuncios ocultan muchos (EasyList y AdGuard tienen `##.ad-btn`, que escondía «Registrar actualización» y los botones de las ventanas de Gestión de Datasets a quien tenía uno).
  Las de esa página llevan `gdat-` desde el 30/10/2026, y `tests/paginas.test.js` lo controla en todas las páginas, los scripts y las hojas (`(?<![A-Za-z0-9_-])ad-[A-Za-z0-9_]`: también `ad-300x250`, y `cantidad-`, `rpad-` y `data-ad-` no cuentan).

## Sitio público y carcasa (spec 2026-10-18-rediseno-publico)

- Carcasa copiada a mano en las 14 páginas (admin, calendario, configuracion, contacto, correos, dataset, datasets, index, mi-espacio, notas, perfil, proyectos, reportes y seguimiento; desde «Configuración», `configuracion.html` reemplaza a `areas.html` y `usuarios.html`, desde «Proyectos», `proyectos.html` reemplaza a `gestion.html`, y desde Mi espacio se suma `mi-espacio.html`;
  los tests leen el HTML estático, así que un cambio va en las 14, y `tests/paginas.test.js` compara el encabezado, el menú lateral y el footer de cada una con los de `index.html`, sin `aria-current` ni sangría): encabezado de 72 px con el logo, "RPAD" y el nav Inicio, Datasets, Calendario y Contacto (`aria-current="page"` escrito en el HTML de la página actual;
  `dataset.html` marca Datasets, administración, `seguimiento.html` y `mi-espacio.html` ninguna); menú lateral con Principal (solo cuando el nav del encabezado no entra), Administración (Gestión de Datasets —`admin.html`, con el ícono de capas, `layers` de Lucide—, Correos y Configuración —con la ruedita—), Herramientas (Métricas y Reportes —`reportes.html`—, Notas —solo con `Auth.puedeCargarNotasDgmit()`:
  `updateSidebarAuth` la oculta—, Proyectos —`proyectos.html`, con la carpeta con tablero, `folder-kanban` de Lucide— y Seguimiento) y Mi cuenta (`#sidebarAccount`:
  Mi Perfil y, después, Mi espacio —`mi-espacio.html`, con el `calendar-check` de Lucide escrito en el HTML, como los demás íconos del menú: no está en `ICON_SELECTOR_MAP`, donde aparecería como ícono elegible en Proyectos, ni en `Icons`, porque tocar `main.js` obliga a subir `VERSION` en todas las páginas; lo ven todos los roles con sesión, así que `updateSidebarAuth` no cambió—); footer azul con `<span>RPAD v2.0.0</span>` y el año en `#footer-anio`, que `main.js` pone en hora argentina.
  Con sesión, `initHeader` pone `.header--con-sesion` (sin `:has()`).
  Las transiciones del menú, del velo y del botón van en `.menu-animable`, que `initSidebar` pone después del primer cuadro (si Firefox calcula la página antes de que llegue la hoja, al aplicarla el menú se asomaba).
  En alto contraste (`forced-colors`), el footer y el menú conservan su azul y la ola no se dibuja.
  `login.html` y `establecer-contrasena.html` no tienen carcasa.
- Portada (`index.html` + `dashboard.js`; spec 2026-10-19-indice-portada): banda con el "Índice de actualización": primero la aclaración ("El registro sigue N conjuntos de datos.
  De ellos, E tienen frecuencia de actualización eventual: …") y después, en grande, la frase ("El T% de los datasets que tienen fecha de vencimiento están al día:
  A de B."; con sin fecha, "que deberían tener fecha de vencimiento (N todavía no la tienen)"; sin ninguno con vencimiento, no hay frase), con la `tasaActualizacion` del servidor, al día = actualizados + próximos y base = total − eventuales; y el mosaico (un cuadrito-link por conjunto, con un pie `aria-live` que dice cuál es y, al salir de los cuadritos sin entrar en otro, vuelve al texto de `index.html`: con el mouse después de 0,3 s, para no parpadear entre dos cuadritos;
  con el teclado, enseguida; grupos Al día —actualizados y próximos—, Vencidos —atrasados y sin respuesta—, Eventuales y, si hay, Sin fecha; dentro de cada grupo, por categoría y después por título;
  Al día y Vencidos con una leyenda con la cantidad de cada categoría, también si es 0; la leyenda usa la clase de siempre, `.leyenda-vencidos`);
  "Qué vence en los próximos 12 meses" (columnas HTML, cada una link a `datasets.html?mes=AAAA-MM`; sin Chart.js);
  Vencidos (6, y "Ver los N vencidos" → `?estado=vencidos`), Próximos a vencer (60 días) y Últimas cargas en el portal (5, por el texto de `ultima_actualizacion`).
- Datasets (`datasets.html` + `datasets.js`): los estados como botones con su cantidad (`aria-pressed`; cuentan lo que dejan los otros filtros;
  Vencidos abre "Todos los vencidos", Atrasados y Sin respuesta del área;
  Sin fecha, solo si hay o está elegido), Buscar, Tema (principal o secundario), Frecuencia, Ordenar por (nombre, próximo vencimiento, área) y Vista (tarjetas, de a 24, o lista, de a 50).
  Todo viaja en la URL:
  `tema`, `frecuencia`, `estado`, `busqueda` y `mes`, como siempre, más `orden=proxima|area` y `vista=lista`, que solo se escriben si no son los por defecto.
  El CSV trae lo mismo que el listado, en el orden elegido en pantalla (encabezados, BOM y filas como antes; con el orden por defecto, el de siempre).
- Detalle (`dataset.html?id=N` + `dataset-detail.js`): migas (la última, con `aria-current="page"`); banda con el título, la insignia larga, el área, los temas y el botón al portal (solo con URL http/https); debajo, Descripción, Qué se solicita y Observaciones, y el panel con Fechas (`htmlDeFechas`), Información técnica y Licencia (en una columna, el panel va primero).
  Cargando, no encontrado (sin id, 404 o algo que no es un dataset) y error (también si falla el dibujo), por separado; no encontrado y error, cada uno con su `h1`.
- Calendario (`calendario.html` + `calendario.js`): almanaque anual, sin FullCalendar:
  Vencidos, los 12 meses desde el actual (los de la portada:
  `mesesDelAlmanaque`, copia de `mesesDelGrafico` de `dashboard.js`, que el calendario no carga, atada por un test de paridad; cada mes, link a `datasets.html?mes=`) y Más adelante; filtros Área y Tema (principal o secundario); el iCal exporta lo que dejan los filtros.
  Eventuales y sin fecha no aparecen.
- Contacto (`contacto.html` + `contacto.js`, sin `api.js`): el formulario en un panel blanco y, al lado, la información de contacto;
  `contacto.js` no cambió (ids, opciones, límites y mensajes).
- Las páginas no recalculan nada: estado, días y tasa salen del servidor, y las fechas se leen como texto.
  Si falla la API, o el dibujo con un dato raro (portada, detalle y calendario lo dibujan dentro del mismo `try`), un aviso ("No se pudo cargar el listado.
  Probá de nuevo en unos minutos." y sus parecidos) en lugar de un spinner eterno o de ceros; sin JavaScript, un `<noscript>` lo dice.
- Vista previa al compartir: las 5 públicas llevan metas Open Graph absolutas (`https://rpad.mcrmodernizacion.gob.ar`;
  `og:image` es `img/compartir.png`, 1200×630;
  `twitter:card` `summary_large_image`;
  `theme-color` #1A365D).
  `og:url`, uno solo y el de la propia página, solo en index (`https://rpad.mcrmodernizacion.gob.ar/`), calendario y contacto:
  `datasets.html` y `dataset.html` no lo llevan (el HTML es estático y una URL fija sin `?id=` ni filtros mandaría a la página sin el dataset o sin los filtros).
  `robots.txt` deja entrar solo a los robots de vista previa (Facebook, X, LinkedIn, Slack, Telegram y WhatsApp) a esas páginas y a la imagen; para el resto, buscadores incluidos, sigue `Disallow: /`.

## Archivos de tests

`paginas.test.js`, `publico-frontend.test.js`, `main-frontend.test.js`
