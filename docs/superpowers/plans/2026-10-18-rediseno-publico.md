# Rediseño de las páginas públicas: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el rediseño de la spec: una carcasa nueva (encabezado, menú lateral, footer y fuentes) en las 13 páginas, y una portada, un Datasets, un detalle, un Calendario anual y un Contacto nuevos, sin romper ninguna funcionalidad.

**Architecture:** HTML estático por página, con la carcasa copiada a mano en cada una (los tests leen el HTML). `css/main.css` lleva la carcasa y las fuentes de todo el sitio, y `css/publico.css` (nuevo) todo lo de las cinco páginas públicas. El JS de cada página sigue con funciones `function` de nivel superior que, al cargarse, solo declaran; lo que arma HTML es puro y se prueba en un `vm`. La API y el backend no cambian.

**Tech Stack:** HTML5, CSS3, vanilla JS, Google Fonts (Bricolage Grotesque + Figtree), SVG Lucide embebidos, node:test.

**Spec:** `docs/superpowers/specs/2026-10-18-rediseno-publico-design.md`. Los mockups, en `docs/superpowers/specs/2026-10-18-rediseno-publico-mockups/`, son la referencia visual; la spec manda cuando difieren.

## Global Constraints

- No romper nada de lo implementado. Correr `npm test` completo antes y después de cada tarea (Docker `rpad-db` y `rpad-mailpit` arriba, `RPAD_TESTS_DB_LOCAL=1`; tarda ~4 min). Los tests de frontend solos, sin Docker: `node --test tests/paginas.test.js tests/publico-frontend.test.js tests/main-frontend.test.js tests/admin-frontend.test.js tests/correos-frontend.test.js tests/perfil-frontend.test.js tests/frontend-utils.test.js tests/login-frontend.test.js tests/usuarios-frontend.test.js tests/auth-frontend.test.js`.
- No se tocan `app.js`, `routes/`, `controllers/`, `services/`, `database/`, `public/js/api.js`, `public/js/auth.js`, `public/js/contacto.js` ni el contenido de las pantallas de administración (salvo carcasa y `?v=`).
- Versiones nuevas, iguales en todos lados: `auth.js`, `main.js` y `api.js` con `?v=20261109` en todas las páginas que los cargan (también `login.html` y `establecer-contrasena.html`); `dashboard.js`, `datasets.js`, `dataset-detail.js` y `calendario.js` con `?v=20261109`; `css/main.css?v=20261109` y `css/publico.css?v=20261109`. En `tests/paginas.test.js`: `VERSION = '20261109'` y `VERSION_PUBLICAS = '20261109'`.
- Etiquetas de script exactamente `<script src="js/X.js?v=20261109"></script>`, sin `defer`, `async` ni otros atributos.
- JS de página: funciones `function` de nivel superior; al cargarse solo declara y registra `document.addEventListener('DOMContentLoaded', …)` (los tests lo cargan con un `document` que solo tiene `addEventListener` y `getElementById: () => null`). Nada de `window`, `Auth`, `API` ni DOM fuera de funciones.
- `dashboard.js` no puede contener (ni en comentarios) `Utils.calcularEstado`, `getDiasRestantes` ni `frecuencia_dias`. `dataset.html` no puede contener "Última actualización".
- Fechas: texto `'AAAA-MM-DD'` cortado (`Utils.soloFecha`, `fechaCorta`, `mesAnio`, `mesDeAnio`, `hoyEnArgentina`); nunca `new Date('AAAA-MM-DD')`, `Utils.formatDate` ni `toISOString()` para "hoy". El estado y los días vienen del servidor (`d.estado`, `dias_para_vencer`, `tasaActualizacion`).
- Todo dato en HTML pasa por `Utils.escapeHtml` (o `escaparHtml` en `main.js`).
- Sin emojis, sin "→" en links, sin rótulos en mayúsculas forzadas, sin separadores " · ". Voseo en los textos.
- Tokens y colores exactos de la spec, sección 4.1. Fuentes: Google Fonts `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Figtree:wght@400;500;600;700&display=swap`, con los dos `preconnect` de siempre.
- Toda `var(--x)` usada en `main.css` tiene que estar definida en `main.css` (test de `admin-frontend`). Los valores de las variables viejas de `main.css` no cambian, salvo `--header-height: 72px`.
- `perfil.html`: `.main-content` sin `max-width`. El ancho máximo de las públicas va en `.publico-contenedor`.
- `correos.html`: 4 `<section>` exactas y el comentario `<!-- Footer -->` antes del footer. `admin.html`: sin `onclick=`/`onchange=`/`onsubmit=` en el HTML estático, sin emojis.
- Exactamente un `href="usuarios.html"` en cada página con `id="sidebarAdmin"`.
- Los archivos están en CRLF en la copia de trabajo (`core.autocrlf=true`): respetarlo al editar.
- Commits: mensajes en español, terminados en `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (los de los subagentes). Repo público: ningún nombre ni email de persona.

## Review Focus

1. **Administración sin cambios de comportamiento**: con sesión de admin, el menú lateral sigue mostrando Administración, Herramientas y Mi cuenta, y la campana y "Salir" siguen andando en las 13 páginas. Esperado: mismos links y permisos que hoy. Test: `paginas.test.js` verifica que cada página con carcasa tenga `id="sidebarAdmin"`, `id="sidebarTools"`, `id="sidebarAccount"`, `id="header-actions"`, `id="sidebarToggle"` y los links de administración (Task 1).
2. **Links en circulación**: `datasets.html?estado=vencidos|atrasado|sin-respuesta|eventual|sin-fecha`, `?mes=AAAA-MM`, `?tema=ID`, `?frecuencia=ID` y `?busqueda=` siguen filtrando igual. Test: los filtros leen esos parámetros y los botones de estado reflejan `vencidos`, `atrasado` y `sin-respuesta` (Task 3).
3. **Error de carga contra lista vacía**: un 500 de la API no se muestra como "no hay conjuntos". Test: las funciones de carga usan `API.pedirJson` y el estado de error tiene su propio HTML (Tasks 2, 3, 5), más la revisión en el navegador.
4. **Celular y encabezado con sesión**: a 375 px no hay desborde horizontal y nada se superpone, con y sin sesión. Se verifica en el navegador con la emulación de celular (las capturas de Chrome sin interfaz no bajan de ~500 px). Lo cubre la verificación final.
5. **Datos raros**: un dataset sin área, sin descripción, sin `datos_al`, eventual con próxima vieja o sin fecha no rompe el mosaico, las listas, el almanaque ni las tarjetas. Test: fixtures con esos casos en cada función pura nueva (Tasks 2, 3, 5).

---

### Task 1: Carcasa compartida (encabezado, menú lateral, footer, fuentes) en 12 páginas

**Files:**
- Modify: `public/css/main.css` (variables, `body`, títulos, header, sidebar, `.main-content`, footer, responsive)
- Modify: `public/js/main.js` (`initHeader`, `initSidebar`, año del footer)
- Modify: `public/admin.html`, `areas.html`, `calendario.html`, `contacto.html`, `correos.html`, `dataset.html`, `datasets.html`, `gestion.html`, `notas.html`, `perfil.html`, `reportes.html`, `usuarios.html` (carcasa, `<link>` de fuentes y de `main.css?v=`, versiones de scripts)
- Modify: `public/index.html` (solo los `?v=` de sus `<script>`; su carcasa es de la Task 2)
- Modify: `public/login.html` (logo `img/logo-2025-blanco.png` y `?v=` de `auth`/`api`), `public/establecer-contrasena.html` (solo `?v=`)
- Test: `tests/paginas.test.js`, `tests/main-frontend.test.js`, `tests/admin-frontend.test.js:1215-1218`, `tests/correos-frontend.test.js:429-435`

**Interfaces:**
- Produces (markup que las tareas 2 a 6 copian tal cual en `index.html` y usan en las públicas): el encabezado, el menú lateral y el footer de abajo; la clase `header--con-sesion`; `#footer-anio`; las variables nuevas de `main.css` (`--tinta`, `--tinta-honda`, `--texto`, `--suave`, `--bruma`, `--papel`, `--linea`, `--cielo`, `--cielo-medio`, `--sol`, `--sol-fuerte`, `--f-titulo`, `--f-texto`, `--relleno-main`).
- Produces en `main.js`: `function anioEnArgentina(fecha)` → texto `'AAAA'` del año de `fecha` (un `Date`) en `America/Argentina/Buenos_Aires`, con `Intl.DateTimeFormat`; `function ponerAnioDelFooter()` (escribe `#footer-anio` si existe); `initHeader()` además hace `document.querySelector('.header')?.classList.toggle('header--con-sesion', Auth.isAuthenticated())`; `initSidebar()` mantiene `aria-expanded` del botón en `'true'`/`'false'` al abrir y cerrar (botón, velo y Escape).

Markup de la carcasa (copiar tal cual; la sangría puede seguir la de cada página). El link de la página actual en `.header-nav` lleva `aria-current="page"`: `index.html` → Inicio; `datasets.html` y `dataset.html` → Datasets; `calendario.html` → Calendario; `contacto.html` → Contacto; las de administración, ninguno. Los íconos son los SVG Lucide que ya están en cada página (menú, ingresar y los del sidebar), con `aria-hidden="true"`; para Inicio, `house`, y para Contacto, `mail` (el mismo de Correos).

```html
        <!-- Header -->
        <header class="header">
            <div class="header-left">
                <button class="sidebar-toggle" id="sidebarToggle" type="button" aria-label="Abrir el menú" aria-controls="sidebar" aria-expanded="false">
                    <!-- svg menu, aria-hidden="true" -->
                </button>
                <a href="index.html" class="header-marca">
                    <img src="img/logo.png" alt="Municipalidad de Comodoro Rivadavia" class="header-logo">
                    <span class="header-marca-texto">
                        <span class="header-title">RPAD</span>
                        <span class="header-subtitle">Registro Permanente de Actualización de Datasets</span>
                    </span>
                </a>
            </div>
            <nav class="header-nav" aria-label="Principal">
                <a href="index.html">Inicio</a>
                <a href="datasets.html">Datasets</a>
                <a href="calendario.html">Calendario</a>
                <a href="contacto.html">Contacto</a>
            </nav>
            <div class="header-right" id="header-actions">
                <a href="login.html" class="btn btn-primary btn-sm"><!-- svg log-in --> Ingresar</a>
            </div>
        </header>

        <!-- Sidebar Overlay -->
        <div class="sidebar-overlay" id="sidebarOverlay"></div>

        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar" aria-label="Menú">
            <div class="sidebar-header">
                <img src="img/logo-2025-blanco.png" alt="Municipalidad de Comodoro Rivadavia" class="sidebar-logo">
            </div>
            <nav class="sidebar-nav">
                <div class="sidebar-section hidden" id="sidebarPrincipal">
                    <div class="sidebar-section-title">Principal</div>
                    <a href="index.html" class="sidebar-link"><!-- svg house --><span>Inicio</span></a>
                    <a href="datasets.html" class="sidebar-link"><!-- svg database --><span>Datasets</span></a>
                    <a href="calendario.html" class="sidebar-link"><!-- svg calendar --><span>Calendario</span></a>
                    <a href="contacto.html" class="sidebar-link"><!-- svg mail --><span>Contacto</span></a>
                </div>
                <!-- sidebarAdmin, sidebarTools y sidebarAccount: los mismos ítems, links e íconos de hoy (copiar de calendario.html),
                     con el título "Mi cuenta" en vez de "Mi Cuenta". Sin "Verificar Sello" (gestion.html) -->
            </nav>
        </aside>
```

```html
            <!-- Footer -->
            <footer class="footer">
                <div class="footer-cuerpo">
                    <div class="footer-marca">
                        <img src="img/logo-2025-blanco.png" alt="Municipalidad de Comodoro Rivadavia" class="footer-logo">
                        <p class="footer-direccion">Dirección de Datos Públicos y Comunicación</p>
                        <p>D. G. de Modernización e Investigación Territorial<br>Subsecretaría de Modernización y Transparencia</p>
                    </div>
                    <div class="footer-columna">
                        <h2 class="footer-titulo">El registro</h2>
                        <ul>
                            <li><a href="index.html">Inicio</a></li>
                            <li><a href="datasets.html">Datasets</a></li>
                            <li><a href="calendario.html">Calendario</a></li>
                            <li><a href="contacto.html">Contacto</a></li>
                        </ul>
                    </div>
                    <div class="footer-columna">
                        <h2 class="footer-titulo">Datos abiertos</h2>
                        <ul>
                            <li><a href="https://datos.comodoro.gov.ar" target="_blank" rel="noopener">datos.comodoro.gov.ar</a></li>
                            <li>Licencia CC BY-SA 4.0</li>
                        </ul>
                    </div>
                    <div class="footer-columna">
                        <h2 class="footer-titulo">Marco legal</h2>
                        <ul>
                            <li>Ordenanza N° 17.662/23, artículo 8°</li>
                        </ul>
                    </div>
                </div>
                <div class="footer-bottom">
                    <span>© <span id="footer-anio">2026</span> Secretaría de Gobierno, Modernización y Transparencia. Municipalidad de Comodoro Rivadavia</span>
                    <span>RPAD v2.0.0</span>
                </div>
            </footer>
```

El footer sigue siendo el último hijo de `<main class="main-content">` (no cambia la estructura de las páginas). Llega a los bordes con márgenes negativos: `.main-content` define `--relleno-main: 24px` (16px a ≤ 1024 px) y lo usa como padding; `.footer` usa `margin: auto calc(-1 * var(--relleno-main)) calc(-1 * var(--relleno-main))`, con `margin-top: 56px` mínimo. Así, `publico.css` puede poner `--relleno-main: 0` en `.main-publico` sin romper el footer.

CSS de la carcasa en `main.css`:
- Variables nuevas en `:root`, con los valores de la spec 4.1; `--f-titulo: 'Bricolage Grotesque', system-ui, sans-serif`; `--f-texto: 'Figtree', system-ui, sans-serif`; `--header-height: 72px`.
- `body`: `font-family: var(--f-texto)`. `h1, h2, h3, h4, .page-title`: `font-family: var(--f-titulo)`, `letter-spacing: -0.02em`; los tamaños y colores de administración quedan. `.fc { font-family }`: `var(--f-texto)` (la regla se va con la Task 5).
- Encabezado: blanco, alto `--header-height`, borde inferior `--linea`; `.header-marca` es un link sin subrayado con el logo (40 px de alto), un separador de 1 px y "RPAD" en `--f-titulo` 1.25rem, `--tinta`; el subtítulo va en 0.75rem, `--suave`, sin mayúsculas, con ancho máximo de ~190 px (dos líneas). `.header-nav a`: píldora, 600, `--texto`; hover `--bruma`; `[aria-current="page"]` con fondo `--cielo` y texto `--tinta`. Botones del header con radio de píldora.
- `.sidebar-toggle`: `display: none` por defecto; `inline-flex` en `.header--con-sesion` y a ≤ 760 px.
- Responsive del encabezado: a ≤ 760 px se ocultan `.header-nav`, `.header-subtitle`, el separador y `.header-user-info`; con sesión, entre 761 y ~1100 px se oculta primero el subtítulo, después `.header-user-info` y, si no entra, `.header-nav` (pasa al menú). Los cortes exactos se eligen probando con y sin sesión: nada se superpone en ningún ancho.
- Menú lateral: fondo `--tinta`; el logo 2025 en blanco (alto ~44 px); `.sidebar-section-title` sin mayúsculas, 0.82rem, `--sol` con opacidad; links en blanco al 85%, hover con fondo blanco al 10%, activo con fondo blanco al 14% y una barra `--sol` de 3 px a la izquierda. Cerrado: `visibility: hidden` (con `transition` de `visibility` para que no se corte la animación); abierto: `visible`. `#sidebarPrincipal` se oculta (`display: none`) mientras el nav del encabezado esté visible; si el nav pasa al menú, se muestra.
- Footer: fondo `--tinta`, texto `#E6EEF6`; grilla `1.7fr 1fr 1fr 1fr` (dos columnas a ≤ 980 px, una a ≤ 760 px); `.footer-titulo` 0.98rem en `--sol`; links blancos subrayados con `rgba(252,232,168,.45)`; `.footer-bottom` con borde superior blanco al 14% y texto `#A9BDD3`, 0.82rem. Contenido interno con ancho máximo de 1180 px centrado.
- Foco: `:focus-visible` con anillo de 3 px `--sol-fuerte` en los links y botones de la carcasa.
- Se borran de `main.css` las reglas viejas de `.footer-cards`, `.footer-card*` y las de `.hero-*`, `.stats-grid`, `.stat-card*`, `.dashboard-*`, `.alert-list`, `.alert-item*`, `.chart-*`, `.legend-*`, `.btn-ver-mas` solo si ninguna página de administración las usa (verificar con `grep` en `public/*.html` y `public/js/*.js` antes de borrar; la portada deja de usarlas en la Task 2).

- [ ] **Step 1: Write the failing tests**

En `tests/paginas.test.js`: `VERSION = '20261109'`, `VERSION_PUBLICAS = '20261109'`, `VERSION_CSS = '20261109'` y estos tests nuevos:

```js
  const CON_CARCASA = paginas.filter(p => leer(p).includes('id="sidebar"'));

  it('hay 13 páginas con carcasa', () => {
    assert.equal(CON_CARCASA.length, 13);
  });

  for (const pagina of CON_CARCASA) {
    it(`${pagina}: carga main.css con ?v=${VERSION_CSS} y las fuentes nuevas`, () => {
      const html = leer(pagina);
      assert.deepEqual(html.match(/css\/main\.css[^"]*"/g), [`css/main.css?v=${VERSION_CSS}"`]);
      assert.ok(html.includes('family=Bricolage+Grotesque'), 'Bricolage Grotesque');
      assert.ok(html.includes('family=Figtree'), 'Figtree');
      assert.doesNotMatch(html, /family=Inter/);
    });

    it(`${pagina}: encabezado con el nav principal y los ids que usa main.js`, () => {
      const html = leer(pagina);
      for (const id of ['header-actions', 'sidebarToggle', 'sidebar', 'sidebarOverlay', 'sidebarPrincipal', 'sidebarAdmin', 'sidebarTools', 'sidebarAccount', 'footer-anio']) {
        assert.match(html, new RegExp(`id="${id}"`), id);
      }
      assert.match(html, /<nav class="header-nav" aria-label="Principal">/);
      for (const destino of ['index.html', 'datasets.html', 'calendario.html', 'contacto.html', 'admin.html', 'areas.html', 'correos.html', 'reportes.html', 'notas.html', 'gestion.html', 'perfil.html']) {
        assert.ok(html.includes(`href="${destino}"`), destino);
      }
      assert.ok(!html.includes('verificar.html'), 'sin el link roto a verificar.html');
      assert.ok(!html.includes('logo-blanco.png'), 'sin el logo que no está en el repo');
    });

    it(`${pagina}: footer nuevo, RPAD v2.0.0`, () => {
      const html = leer(pagina);
      assert.ok(html.includes('<span>RPAD v2.0.0</span>'));
      assert.doesNotMatch(html, /RPAD v1\.\d\.0/);
      assert.ok(html.includes('D. G. de Modernización e Investigación Territorial'));
    });
  }

  for (const [pagina, actual] of [['datasets.html', 'datasets.html'], ['dataset.html', 'datasets.html'], ['calendario.html', 'calendario.html'], ['contacto.html', 'contacto.html']]) {
    it(`${pagina}: el nav marca la página actual`, () => {
      assert.match(leer(pagina), new RegExp(`<a href="${actual.replace('.', '\\.')}" aria-current="page">`));
    });
  }

  it('login.html: el logo es logo-2025-blanco.png', () => {
    assert.ok(leer('login.html').includes('src="img/logo-2025-blanco.png"'));
  });
```

(`index.html` entra en `CON_CARCASA` recién en la Task 2: en esta tarea, el test de 13 páginas y los de carcasa sobre `index.html` fallan hasta entonces. Para que la Task 1 cierre en verde, el filtro de esta tarea es `p !== 'index.html'` y espera 12; la Task 2 saca el filtro y pasa a 13.)

En `tests/main-frontend.test.js`, agregar:

```js
describe('footer: el año del ©', () => {
  const cargar = () => {
    const contexto = vm.createContext({ document: { head: { appendChild() {} }, body: { appendChild() {} }, createElement: () => ({ textContent: '', remove() {} }), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null }, window: { location: { pathname: '/index.html' } }, console, Intl, Date });
    vm.runInContext(`${fs.readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8')}\n;globalThis.anioEnArgentina = anioEnArgentina;`, contexto);
    return contexto;
  };

  it('es el año en Argentina, aunque en UTC ya sea el año siguiente', () => {
    const { anioEnArgentina } = cargar();
    assert.equal(anioEnArgentina(new Date('2026-10-18T12:00:00Z')), '2026');
    assert.equal(anioEnArgentina(new Date('2027-01-01T02:30:00Z')), '2026');
    assert.equal(anioEnArgentina(new Date('2027-01-01T03:00:00Z')), '2027');
  });
});
```

En `tests/admin-frontend.test.js:1215-1218`, el pie pasa a `/<span>RPAD v2\.0\.0<\/span>/` y `doesNotMatch(/RPAD v1\.\d\.0/)`. En `tests/correos-frontend.test.js:429-435`, `<span>RPAD v2.0.0</span>` y sin `RPAD v1.`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/paginas.test.js tests/main-frontend.test.js tests/admin-frontend.test.js tests/correos-frontend.test.js`
Expected: FAIL (versiones, carcasa, footer, `anioEnArgentina is not a function`).

- [ ] **Step 3: Implement the carcasa in the 12 pages, `main.css` and `main.js`**

Reemplazar en cada página el header, el overlay, el sidebar y el footer por el markup de arriba; el `<link>` de Inter por el de las fuentes nuevas; `css/main.css` por `css/main.css?v=20261109`; los `?v=` de `auth`, `main`, `api` y de los cuatro scripts públicos por `20261109`. En `correos.html`, el comentario `<!-- Footer -->` queda inmediatamente antes de `<footer class="footer">`. En `login.html`, `img/logo-blanco.png` pasa a `img/logo-2025-blanco.png`. `main.js`: `anioEnArgentina`, `ponerAnioDelFooter` (llamada en su `DOMContentLoaded`), la clase `header--con-sesion` en `initHeader` y `aria-expanded` en `initSidebar`. El markup de `#header-actions` que arma `initHeader` no cambia.

- [ ] **Step 4: Run the tests to verify they pass**

Run: el mismo comando del Step 2 y después `npm test`.
Expected: PASS; suite completa en verde (0 fallas).

- [ ] **Step 5: Look at it in the browser**

Con el preview `rpad` (puerto 3001): `calendario.html`, `datasets.html`, `admin.html` y `correos.html`, en escritorio y a 375 px (resize mobile), sin sesión y con la sesión de prueba (superadmin `prueba_super`, id 10: firmar un JWT de 1 hora con `JWT_SECRET` del `.env` y guardar `rpad_token`/`rpad_user` en `localStorage`). Verificar que el menú abre y cierra, que muestra Administración, que el nav marca la página actual, que el footer llega a los bordes y que a 375 px no hay desborde (`document.documentElement.scrollWidth === innerWidth`).

- [ ] **Step 6: Commit**

```bash
git add public tests
git commit -m "feat: carcasa nueva (encabezado con nav, menú lateral y footer v2.0.0) y fuentes Bricolage + Figtree"
```

---

### Task 2: Portada nueva y `publico.css`

**Files:**
- Create: `public/css/publico.css`
- Modify: `public/index.html` (reescritura: sin `<style>` ni Chart.js; carcasa de la Task 1; `main.css` + `publico.css`)
- Modify: `public/js/dashboard.js` (reescritura del armado; conserva las funciones con test)
- Modify: `public/css/main.css` (solo si quedan reglas de la portada vieja sin uso)
- Test: `tests/publico-frontend.test.js`, `tests/paginas.test.js` (sacar el filtro de `index.html` de la Task 1: 13 páginas)

**Interfaces:**
- Consumes: la carcasa y las variables de la Task 1.
- Produces en `publico.css` (lo usan las Tasks 3 a 6): `.main-publico` (en `<main class="main-content main-publico">`: `--relleno-main: 0`), `.publico-contenedor` (máx. 1180 px, padding 0 24px, 16px a ≤ 760), `.banda` + `.banda-cuerpo` + `.ola` (el SVG de la ola, inline en cada página), `.btn-tinta`, `.btn-borde`, `.btn-chico`, `.campo` (label + input/select, alto mínimo 44 px, radio 12), `.tile` + `.c-actualizado|c-proximo|c-atrasado|c-sin-respuesta|c-eventual|c-sin-fecha`, las insignias pastel `.badge` + `.badge-success|warning|danger|sin-respuesta|secondary` (con el cuadrito en `::before`), `.lista` + `.fila` (filas de link con título, meta y dato a la derecha), `.enlace`, `.aviso` (mensaje de error/vacío), `.cargando`.
- Produces en `dashboard.js` (funciones puras, en el contexto del `vm`):
  - `gruposDelMosaico(datasets)` → `[{ etiqueta, estados, datasets }]` en el orden `Actualizados` (`actualizado`), `Próximos a vencer` (`proximo`), `Vencidos` (`atrasado` y `sin-respuesta`), `Eventuales` (`eventual`) y, solo si hay, `Sin fecha` (`sin-fecha`). Dentro de cada grupo, orden alfabético por título (`localeCompare` con `'es'`). Usa `Utils.estadoDe(d)`.
  - `textoIndice(stats)` → `{ tasa, frase, aclaracion }`: `tasa` = `textoTasa(stats)`; `frase` = `El ${tasa} de los conjuntos de datos con fecha de actualización están al día: ${actualizados + proximos} de ${total - eventuales}.`; `aclaracion` = `El registro sigue ${total} conjuntos. Los otros ${eventuales} son eventuales: se publican cuando hay novedades y no tienen vencimiento.` + (si `sinFecha > 0`) ` ${sinFecha} todavía no ${sinFecha === 1 ? 'tiene' : 'tienen'} fecha de próxima actualización.`. Con 1 eventual: `El otro es eventual: se publica cuando hay novedades y no tiene vencimiento.`. Con 0 eventuales, sin esa oración.
  - `textoSituacion(hoy)` → `'Situación al domingo 18 de octubre de 2026.'` (el día de la semana sale de `new Date(Date.UTC(a, m - 1, d)).getUTCDay()`).
  - `htmlDelMosaico(grupos)` → HTML: por grupo, `<div class="mosaico-grupo"><div class="mosaico-cabeza"><h3>${etiqueta}</h3><span class="mosaico-cuenta">${n}</span></div><div class="cuadros">…</div>` y, en Vencidos, la leyenda de los dos colores; cada cuadrito `<a class="cuadro c-${estado}" href="dataset.html?id=${id}" data-id="${id}" aria-label="${título escapado}, ${Utils.getEstadoTextoLargo(estado)}"></a>`.
  - `htmlDeLosMeses(meses, conteos)` → por mes `<a class="mes[ actual]" href="${urlDelMes(m)}" aria-label="${m.titulo}: ${n === 1 ? 'vence 1 conjunto' : `vencen ${n} conjuntos`}"><span class="mes-cuenta[ cero]">${n}</span><span class="mes-pila" aria-hidden="true">${'<i></i>'.repeat(n)}</span></a>`, y una fila aparte con las etiquetas (`oct 26`); el primero es el actual.
  - `ultimasCargas(datasets, cantidad = 5)` → los que tienen `ultima_actualizacion`, ordenados por `Utils.soloFecha(ultima_actualizacion)` descendente (y título para desempatar), los primeros `cantidad`.
  - `htmlDeFila(d, dato)` → `<li><a class="fila" href="dataset.html?id=${id}"><span class="fila-titulo">${título}</span><span class="fila-meta">${área o 'Sin área asignada'}</span><span class="fila-dato">${dato}</span></a></li>`, con todo escapado; `dato` lo arma quien llama (HTML ya seguro).
  - `textoDias(n)` → `'1 día'` / `'${n} días'`.
  - Se conservan con sus tests: `mesesDelGrafico`, `vencimientosPorMes`, `urlDelMes`, `textoTasa`, `alertasDe`.
  - Se borran con sus tests: `porcentajesEnteros`, `porcionesDelEstado`, `htmlDeLeyenda`, y todo lo de la portada vieja (`updateHeroGreeting`, `updateHeroDateTime`, `animateCounter`, `renderStats`, `goToDatasets`, `renderDonutChart`, `renderAlertas`, `toggleAtrasados`, `toggleProximos`, `renderCalendarChart`, `donutChart`, `calendarChart`).
  - Carga: `async function cargarPortada()` pide `API.pedirJson('GET', '/datasets/estadisticas')` y `API.pedirJson('GET', '/datasets')` en paralelo y usa `.data`. Si cualquiera falla, muestra el aviso de error de la spec (sección 6) y no dibuja nada más.

Estructura de `index.html` (ver el mockup `portada.html`, con lo que fija la spec 6): banda con la columna de texto (`h1` "Índice de actualización", `#indice-frase`, `#indice-aclaracion`, botones "Ver los datasets" → `datasets.html` y "Ver el calendario" → `calendario.html`, `#indice-situacion`) y `#mosaico` (con `#mosaico-pie`, `aria-live="polite"`); la ola; la sección "Qué vence en los próximos 12 meses" (`#meses`, `#meses-nombres`, con caja de desplazamiento horizontal propia); las dos columnas con `#vencidos` (+ `#ver-vencidos` → `datasets.html?estado=vencidos`), `#proximos` y `#ultimas`; `#portada-error` (oculto) y `<noscript>`. El hover y el foco de los cuadritos actualizan `#mosaico-pie` con `<strong>${título}</strong><br>${área}. ${estado largo}.` (escapado), con delegación de eventos sobre `#mosaico`. Metas `<title>`: `RPAD - Índice de actualización de los datos abiertos`.

- [ ] **Step 1: Write the failing tests**

En `tests/publico-frontend.test.js`, reemplazar el `describe('dashboard.js: la dona del estado')` por:

```js
describe('dashboard.js: el índice y el mosaico', () => {
  const tablero = cargar('dashboard.js');
  const STATS = { total: 80, actualizados: 52, proximos: 1, atrasados: 3, sinRespuesta: 10, eventuales: 14, sinFecha: 0, tasaActualizacion: 80 };

  it('la frase usa la tasa del servidor y la misma base: el total sin los eventuales', () => {
    const { tasa, frase, aclaracion } = plano(tablero.textoIndice(STATS));
    assert.equal(tasa, '80%');
    assert.equal(frase, 'El 80% de los conjuntos de datos con fecha de actualización están al día: 53 de 66.');
    assert.equal(aclaracion, 'El registro sigue 80 conjuntos. Los otros 14 son eventuales: se publican cuando hay novedades y no tienen vencimiento.');
  });

  it('nombra los sin fecha solo si hay, y el singular de un eventual', () => {
    assert.match(plano(tablero.textoIndice({ ...STATS, total: 82, sinFecha: 2 })).aclaracion, / 2 todavía no tienen fecha de próxima actualización\.$/);
    assert.match(plano(tablero.textoIndice({ ...STATS, total: 67, eventuales: 1 })).aclaracion, /El otro es eventual: se publica cuando hay novedades y no tiene vencimiento\.$/);
  });

  it('la situación dice el día de la semana sin depender de la zona del navegador', () => {
    assert.equal(tablero.textoSituacion('2026-10-18'), 'Situación al domingo 18 de octubre de 2026.');
    assert.equal(tablero.textoSituacion('2027-01-01'), 'Situación al viernes 1 de enero de 2027.');
  });

  it('agrupa por estado del servidor: vencidos juntos, sin fecha solo si hay, cada grupo por título', () => {
    const lista = [
      dataset({ id: 1, titulo: 'Zeta', estado: 'actualizado' }), dataset({ id: 2, titulo: 'Alfa', estado: 'actualizado' }),
      dataset({ id: 3, estado: 'proximo' }), dataset({ id: 4, estado: 'atrasado' }), dataset({ id: 5, estado: 'sin-respuesta' }),
      eventual({ id: 6 }), dataset({ id: 7, area_nombre: null, descripcion: null, datos_al: null })
    ];
    const grupos = plano(tablero.gruposDelMosaico(lista));
    assert.deepEqual(grupos.map(g => g.etiqueta), ['Actualizados', 'Próximos a vencer', 'Vencidos', 'Eventuales']);
    assert.deepEqual(grupos[0].datasets.map(d => d.id), [2, 7, 1]);
    assert.deepEqual(grupos[2].datasets.map(d => d.id).sort(), [4, 5]);
    assert.equal(grupos.reduce((s, g) => s + g.datasets.length, 0), lista.length);
    const conSinFecha = plano(tablero.gruposDelMosaico([...lista, dataset({ id: 8, estado: 'sin-fecha', proxima_actualizacion: null })]));
    assert.equal(conSinFecha.at(-1).etiqueta, 'Sin fecha');
  });

  it('cada cuadrito es un link al detalle con su nombre y su estado, escapados', () => {
    const html = tablero.htmlDelMosaico(tablero.gruposDelMosaico([dataset({ id: 9, titulo: '<b>X</b> & Y', estado: 'sin-respuesta' })]));
    assert.match(html, /<a class="cuadro c-sin-respuesta" href="dataset\.html\?id=9" data-id="9" aria-label="&lt;b&gt;X&lt;\/b&gt; &amp; Y, Sin respuesta del área responsable"><\/a>/);
    assert.doesNotMatch(html, /<b>X<\/b>/);
  });
});

describe('dashboard.js: los 12 meses y las listas', () => {
  const tablero = cargar('dashboard.js');

  it('cada mes es un link al listado, con la cantidad y una marca por conjunto', () => {
    const meses = tablero.mesesDelGrafico('2026-10-18');
    const html = tablero.htmlDeLosMeses(meses, [0, 1, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.match(html, /<a class="mes actual" href="datasets\.html\?mes=2026-10" aria-label="octubre de 2026: vencen 0 conjuntos">/);
    assert.match(html, /aria-label="noviembre de 2026: vence 1 conjunto"/);
    assert.equal(html.split('<i></i>').length - 1, 17);
  });

  it('últimas cargas: por la fecha de carga (texto), sin los que no tienen, hasta 5', () => {
    const lista = [
      dataset({ id: 1, ultima_actualizacion: '2026-10-13T03:00:00.000Z' }), dataset({ id: 2, ultima_actualizacion: null }),
      dataset({ id: 3, ultima_actualizacion: '2026-10-16' }), dataset({ id: 4, ultima_actualizacion: '2026-01-31T03:00:00.000Z' })
    ];
    assert.deepEqual(plano(tablero.ultimasCargas(lista)).map(d => d.id), [3, 1, 4]);
    assert.equal(tablero.ultimasCargas(Array.from({ length: 9 }, (_, i) => dataset({ id: i }))).length, 5);
  });

  it('la fila escapa y lleva al detalle; sin área lo dice', () => {
    const html = tablero.htmlDeFila(dataset({ id: 5, titulo: '<i>T</i>', area_nombre: null }), '<strong>3 días</strong>');
    assert.ok(html.includes('href="dataset.html?id=5"'));
    assert.ok(html.includes('&lt;i&gt;T&lt;/i&gt;'));
    assert.ok(html.includes('Sin área asignada'));
    assert.equal(tablero.textoDias(1), '1 día');
    assert.equal(tablero.textoDias(625), '625 días');
  });
});
```

En `tests/paginas.test.js`, sacar el filtro de `index.html` de la Task 1 (13 páginas) y agregar:

```js
  const PUBLICAS = ['index.html', 'datasets.html', 'dataset.html', 'calendario.html', 'contacto.html'];
  for (const pagina of paginas) {
    it(`${pagina}: publico.css ${PUBLICAS.includes(pagina) ? 'con' : 'sin'} ?v=${VERSION_CSS}`, () => {
      const usos = leer(pagina).match(/css\/publico\.css[^"]*"/g) || [];
      // index.html entra acá; las otras cuatro públicas se suman en sus tareas: hasta entonces se listan en PENDIENTES
      if (PUBLICAS.includes(pagina) && !PENDIENTES.includes(pagina)) assert.deepEqual(usos, [`css/publico.css?v=${VERSION_CSS}"`]);
      else if (!PUBLICAS.includes(pagina)) assert.deepEqual(usos, []);
    });
  }

  it('index.html: sin <style> propio ni Chart.js', () => {
    const html = leer('index.html');
    assert.doesNotMatch(html, /<style/);
    assert.doesNotMatch(html, /chart\.js|chart\.umd/i);
  });
```

con `const PENDIENTES = ['datasets.html', 'dataset.html', 'calendario.html', 'contacto.html'];`. Cada una de las Tasks 3 a 6 saca su página de `PENDIENTES`; la Task 6 borra la constante.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/publico-frontend.test.js tests/paginas.test.js`
Expected: FAIL (`gruposDelMosaico is not a function`, `index.html` sin carcasa nueva ni `publico.css`).

- [ ] **Step 3: Implement `publico.css`, `index.html` and `dashboard.js`**

Como en las Interfaces y en la spec 4 y 6. Breakpoints: 980 px (una columna en la banda y en las listas) y 760 px (padding de 16 px, cuadritos de 18 px). `prefers-reduced-motion`: sin la escala de los cuadritos.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/publico-frontend.test.js tests/paginas.test.js` y después `npm test`.
Expected: PASS; suite completa en verde.

- [ ] **Step 5: Look at it in the browser**

`index.html` en escritorio y a 375 px, sin sesión y con sesión: las cifras (80% y 53 de 66 con la base local), el mosaico (hover y Tab actualizan el pie), los 12 meses (el clic en enero lleva a `datasets.html?mes=2027-01`), las tres listas y "Ver los 13 vencidos". Simular el error: en la consola, `API.pedirJson = async () => { throw new Error('x'); }; cargarPortada();` y verificar el aviso.

- [ ] **Step 6: Commit**

```bash
git add public tests
git commit -m "feat: portada nueva (índice de actualización, mosaico, 12 meses, vencidos, próximos y últimas cargas)"
```

---

### Task 3: Datasets

**Files:**
- Modify: `public/datasets.html` (sin `<style>`; `publico.css`; banda; estados; herramientas; resultados)
- Modify: `public/js/datasets.js`
- Modify: `public/css/publico.css` (sección Datasets)
- Test: `tests/publico-frontend.test.js`, `tests/paginas.test.js` (sacar `datasets.html` de `PENDIENTES`)

**Interfaces:**
- Consumes: `publico.css` de la Task 2.
- Produces en `datasets.js` (puras):
  - `ORDENES = ['nombre', 'proxima', 'area']`, `VISTAS = ['tarjetas', 'lista']`.
  - `ordenarDatasets(datasets, orden)` → copia ordenada: `nombre` por título (`localeCompare` `'es'`); `proxima` por `Utils.soloFecha(proxima_actualizacion)` ascendente; los eventuales (aunque tengan una próxima vieja) y los que no tienen fecha van al final, entre ellos por título; título para desempatar; `area` por `area_nombre` (los sin área al final) y título.
  - `cantidadesPorEstado(datasets)` → `{ todos, actualizado, proximo, vencidos, atrasado, 'sin-respuesta', eventual, 'sin-fecha' }` con `Utils.estadoDe`.
  - `htmlDeEstados(cantidades, estado)` → la fila de botones `Todos`, `Actualizados`, `Próximos a vencer`, `Vencidos`, `Eventuales` y, si `cantidades['sin-fecha'] > 0` o `estado === 'sin-fecha'`, `Sin fecha`: `<button type="button" class="estado-btn" data-estado="${valor}" aria-pressed="${…}">${cuadrito}${texto} <span class="estado-n">${n}</span></button>`; `Vencidos` queda presionado con `vencidos`, `atrasado` o `sin-respuesta`. Si el estado es uno de esos tres, agrega la segunda fila (`<div class="sub-estados">`) con `Todos los vencidos` (`vencidos`), `Atrasados` (`atrasado`) y `Sin respuesta del área` (`sin-respuesta`).
  - `htmlDeFila(d)` → `<tr>` de la vista lista: título (link `dataset.html?id=`) + área debajo, tema principal, frecuencia, `textoDatosAlCorto(d)`, la próxima corta sin el prefijo `Próxima: ` (y `Eventual` / `sin fecha`), y la insignia `<span class="badge ${getEstadoClase(estado)}">${getEstadoTexto(estado)}</span>`. Todo escapado.
  - `leerParametros(busqueda)` → `{ temaId, frecId, estado, busqueda, mes, orden, vista }` desde un texto `?a=b` (con `URLSearchParams`); valores no válidos de `orden`/`vista` quedan en los por defecto; `mes` pasa por `mesDelParametro`.
  - `armarParametros(filtros)` → texto de query sin los vacíos ni los por defecto (`orden=nombre`, `vista=tarjetas` no se escriben); el orden de las claves es `tema`, `frecuencia`, `estado`, `busqueda`, `mes`, `orden`, `vista`.
  - `ITEMS_POR_PAGINA = { tarjetas: 24, lista: 50 }`.
  - `htmlDeTarjeta(d)`: el markup nuevo (spec 7), conservando lo que fijan los tests actuales (textos de fecha, `</svg> ${área}</span>`, insignia exacta, sin `<img>`/`<b>`/`<i>`, `href="dataset.html?id=…"`). El link del título cubre la tarjeta con `::after` (CSS).
  - Se conservan con sus tests: `filtrarDatasets`, `mesDelParametro`, `textoFiltroMes`, `textoDatosAlCorto`, `textoProximaCorta`, `filaCsv`, `armarCsv`, `exportarCSV`, `limpiarFiltros`, `quitarFiltroMes`, `cambiarPagina`, `getEstadoTexto`, `getEstadoClase`, `getTipoGestionTexto`.
  - Carga: `API.pedirJson('GET', '/datasets')` (`.data`) y, en paralelo, `API.getTemas()` y `API.getFrecuencias()`. Si falla la de datasets, `#datasets-error` con el texto de la spec y sin spinner. Los filtros de la URL se aplican **antes** del primer dibujo (sin parpadeo).
  - Las cantidades de los botones se calculan sobre `filtrarDatasets(todos, { ...filtros, estado: '' })`.
- `datasets.html`: `#estados` (`role="group"`, `aria-label="Filtrar por estado"`), sin `<select id="filter-estado">`; `#search`, `#filter-tema`, `#filter-frecuencia`, `#filter-orden`, cada uno con `<label for>`; `#vista` (dos botones `data-vista` con `aria-pressed`); "Limpiar filtros"; `#resultado-cuenta` (`aria-live="polite"`); `#filtro-mes` + `#filtro-mes-texto` + "Quitar" (`quitarFiltroMes()`); `#datasets-grid`; `#datasets-paginacion`; `#empty-state`; `#datasets-error`. `<title>` "Datasets - RPAD".

- [ ] **Step 1: Write the failing tests**

En `tests/publico-frontend.test.js`, en `describe('datasets.js: filtros y ?mes=')`, reemplazar el test de las `<option>` por:

```js
  it('datasets.html tiene el aviso del filtro por mes y los botones de estado, sin el select viejo', () => {
    const html = leer('datasets.html');
    assert.match(html, /id="filtro-mes"/);
    assert.match(html, /id="estados"/);
    assert.doesNotMatch(html, /id="filter-estado"/);
    for (const id of ['search', 'filter-tema', 'filter-frecuencia', 'filter-orden']) assert.match(html, new RegExp(`<label for="${id}"`), id);
  });
```

y agregar:

```js
describe('datasets.js: estados, orden, vista y URL', () => {
  const listado = cargar('datasets.js');
  const LISTA = [
    dataset({ id: 1, titulo: 'Beta', area_nombre: 'Zona', proxima_actualizacion: '2027-03-31T03:00:00.000Z' }),
    dataset({ id: 2, titulo: 'alfa', area_nombre: null, proxima_actualizacion: '2026-11-30T03:00:00.000Z', estado: 'proximo', dias_para_vencer: 43 }),
    dataset({ id: 3, titulo: 'Gamma', area_nombre: 'Archivo', proxima_actualizacion: '2025-01-31T03:00:00.000Z', estado: 'atrasado', dias_para_vencer: -625 }),
    eventual({ id: 4, titulo: 'Delta', proxima_actualizacion: '2026-01-31T03:00:00.000Z' }),
    dataset({ id: 5, titulo: 'Épsilon', proxima_actualizacion: null, estado: 'sin-fecha', dias_para_vencer: null })
  ];

  it('ordena por nombre, por próximo vencimiento (sin fecha al final) y por área (sin área al final)', () => {
    assert.deepEqual(plano(listado.ordenarDatasets(LISTA, 'nombre')).map(d => d.id), [2, 1, 4, 5, 3]);
    assert.deepEqual(plano(listado.ordenarDatasets(LISTA, 'proxima')).map(d => d.id), [3, 2, 1, 4, 5]);
    assert.deepEqual(plano(listado.ordenarDatasets(LISTA, 'area')).map(d => d.id), [3, 4, 5, 1, 2]);
  });

  it('cuenta por estado del servidor, con vencidos = atrasados + sin respuesta', () => {
    const c = plano(listado.cantidadesPorEstado(LISTA));
    assert.equal(c.todos, 5); assert.equal(c.actualizado, 1); assert.equal(c.proximo, 1);
    assert.equal(c.vencidos, 1); assert.equal(c.atrasado, 1); assert.equal(c['sin-respuesta'], 0);
    assert.equal(c.eventual, 1); assert.equal(c['sin-fecha'], 1);
  });

  it('los botones: Vencidos presionado con atrasado y la segunda fila; Sin fecha solo si hay o si está elegido', () => {
    const c = listado.cantidadesPorEstado(LISTA);
    const html = listado.htmlDeEstados(c, 'atrasado');
    assert.match(html, /data-estado="vencidos" aria-pressed="true"/);
    assert.match(html, /class="sub-estados"/);
    assert.match(html, /data-estado="atrasado" aria-pressed="true"/);
    assert.match(html, /data-estado="sin-fecha"/);
    const sinNinguno = listado.htmlDeEstados({ ...plano(c), 'sin-fecha': 0 }, '');
    assert.doesNotMatch(sinNinguno, /data-estado="sin-fecha"/);
    assert.match(listado.htmlDeEstados({ ...plano(c), 'sin-fecha': 0 }, 'sin-fecha'), /data-estado="sin-fecha" aria-pressed="true"/);
    assert.match(sinNinguno, /data-estado="" aria-pressed="true"/);
  });

  it('la fila de la lista escapa, lleva al detalle y usa la insignia de siempre', () => {
    const html = listado.htmlDeFila(dataset({ id: 7, titulo: '<i>x</i>', area_nombre: 'A & B' }));
    assert.ok(html.includes('href="dataset.html?id=7"'));
    assert.ok(html.includes('A &amp; B'));
    assert.doesNotMatch(html, /<i>x<\/i>/);
    assert.match(html, /<span class="badge badge-success">Actualizado<\/span>/);
    assert.ok(html.includes('ene 2027'));
  });

  it('lee y escribe la URL: los parámetros de siempre siguen igual y orden/vista solo si no son los por defecto', () => {
    const p = plano(listado.leerParametros('?estado=vencidos&mes=2027-01&tema=8&frecuencia=9&busqueda=pauta&orden=area&vista=lista'));
    assert.deepEqual(p, { temaId: '8', frecId: '9', estado: 'vencidos', busqueda: 'pauta', mes: '2027-01', orden: 'area', vista: 'lista' });
    assert.deepEqual(plano(listado.leerParametros('?orden=x&vista=y&mes=2027-13')), { temaId: '', frecId: '', estado: '', busqueda: '', mes: null, orden: 'nombre', vista: 'tarjetas' });
    assert.equal(listado.armarParametros({ temaId: '8', frecId: '', estado: 'vencidos', busqueda: '', mes: '2027-01', orden: 'nombre', vista: 'tarjetas' }), 'tema=8&estado=vencidos&mes=2027-01');
    assert.equal(listado.armarParametros({ temaId: '', frecId: '', estado: '', busqueda: '', mes: null, orden: 'proxima', vista: 'lista' }), 'orden=proxima&vista=lista');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/publico-frontend.test.js tests/paginas.test.js`
Expected: FAIL (`ordenarDatasets is not a function`, el HTML todavía tiene `filter-estado`).

- [ ] **Step 3: Implement**

Como en las Interfaces y la spec 7 (ver `datasets.html` del mockup). La búsqueda sigue con debounce de 300 ms. La URL se reescribe con `history.replaceState` usando `armarParametros`. Al cambiar de página, `scrollIntoView` del resultado con `scroll-margin-top` igual al alto del encabezado más 16 px. La tarjeta: radio 16, borde `--linea`, hover con borde `--tinta`; descripción en 2 líneas; formatos en etiquetas chicas (≥ 0.75rem); fechas a la derecha. La lista: tabla en un panel blanco, encabezado con una línea `--tinta` de 2 px. Responsive: 3 columnas (> 1080 px), 2 y 1 (≤ 760 px); en la lista, a ≤ 760 px se ocultan Tema y Frecuencia y cada fila se apila.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/publico-frontend.test.js tests/paginas.test.js` y después `npm test`.
Expected: PASS; suite completa en verde.

- [ ] **Step 5: Look at it in the browser**

`datasets.html`, `?estado=vencidos`, `?estado=atrasado`, `?mes=2027-01`, `?tema=8`, `?orden=proxima&vista=lista`; buscar "agua"; exportar el CSV (que baje `datasets-rpad-AAAA-MM-DD.csv`); paginar; a 375 px en las dos vistas.

- [ ] **Step 6: Commit**

```bash
git add public tests
git commit -m "feat: Datasets con estados y cantidades, vista de lista y orden"
```

---

### Task 4: Detalle de un dataset

**Files:**
- Modify: `public/dataset.html` (sin `<style>`; `publico.css`; migas; banda; dos columnas)
- Modify: `public/js/dataset-detail.js`
- Modify: `public/css/publico.css` (sección Detalle)
- Test: `tests/publico-frontend.test.js`, `tests/paginas.test.js` (sacar `dataset.html` de `PENDIENTES`)

**Interfaces:**
- Consumes: `publico.css` de la Task 2.
- Produces en `dataset-detail.js`:
  - `htmlDeTemas(d)` → `<span class="tema">…</span>` por tema (principal y secundario), escapados; vacío si no hay.
  - `filasTecnicas(d)` → `[{ rotulo: 'Frecuencia', valor }, { rotulo: 'Formatos', valor }, { rotulo: 'Tipo de gestión', valor: Utils.getTipoGestionTexto(d.tipo_gestion) }]` (`'-'` si falta).
  - `loadDataset()`: `API.pedirJson('GET', \`/datasets/${encodeURIComponent(id)}\`)` (`.data`). Si el error tiene `status === 404` o no hay `id`, `showNotFound()`. Si es otro error, `showError()` con "No se pudo cargar el conjunto de datos. Probá de nuevo en unos minutos.".
  - `renderDataset(d)`: el área va en `#dataset-area-text` (el ícono queda); la insignia larga en `#dataset-estado`; el botón `#dataset-url` (en la banda) solo si `Utils.esUrlSegura`; Descripción (`white-space: pre-line`), Qué se solicita y Observaciones, como hoy.
  - Se conservan con sus tests: `filasDeFechas`, `htmlDeFechas`, `textoDatosAl`, `textoCargadoEnElPortal`, `textoProximaPrevista`.
- `dataset.html`: todos los ids de hoy (`loading`, `dataset-content`, `not-found`, `breadcrumb-title`, `dataset-titulo`, `dataset-area`, `dataset-area-text`, `dataset-estado`, `dataset-temas`, `dataset-descripcion`, `que-se-solicita-card`, `dataset-que-se-solicita`, `observaciones-card`, `dataset-observaciones`, `url-card`, `dataset-url`, `dataset-fechas`, `info-frecuencia`, `info-formatos`, `info-tipo-gestion`) más `#dataset-error`. Los tres rótulos de fechas siguen en el esqueleto del HTML (los exige el test). En el celular, el panel lateral (fechas) va antes que los textos largos (`order`).

- [ ] **Step 1: Write the failing tests**

En `tests/publico-frontend.test.js`, en `describe('dataset-detail.js: las tres fechas del detalle')`, agregar:

```js
  it('los temas escapados, y nada si no hay', () => {
    assert.equal(detalle.htmlDeTemas(dataset({ tema_secundario_nombre: '<b>S</b>' })), '<span class="tema">Economía</span><span class="tema">&lt;b&gt;S&lt;/b&gt;</span>');
    assert.equal(detalle.htmlDeTemas(dataset({ tema_principal_nombre: null })), '');
  });

  it('la información técnica: frecuencia, formatos y tipo de gestión, con raya si falta', () => {
    assert.deepEqual(plano(detalle.filasTecnicas(dataset())), [
      { rotulo: 'Frecuencia', valor: 'Cada medio año' }, { rotulo: 'Formatos', valor: 'CSV, XLSX' }, { rotulo: 'Tipo de gestión', valor: 'Externa (otra área)' }
    ]);
    assert.equal(plano(detalle.filasTecnicas(dataset({ frecuencia_nombre: null, formatos: '' })))[1].valor, '-');
  });

  it('dataset.html: el área tiene su ícono y su texto aparte, y hay dónde avisar un error', () => {
    const html = leer('dataset.html');
    assert.match(html, /id="dataset-area-text"/);
    assert.match(html, /id="dataset-error"/);
    assert.doesNotMatch(leer('js/dataset-detail.js'), /getElementById\('dataset-area'\)\.textContent/);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/publico-frontend.test.js`
Expected: FAIL (`htmlDeTemas is not a function`).

- [ ] **Step 3: Implement**

Como en las Interfaces y la spec 8. Migas arriba de la banda (Inicio / Datasets / título), en `--suave` con el actual en `--texto`. Columnas: `minmax(0, 1fr) 340px` (> 980 px), una a ≤ 980 px. Bloques de texto con `h2` 1.25rem y línea `--tinta` arriba; panel lateral blanco con las filas `info-row` (rótulo `--suave`, valor `--texto` 600). La licencia, en el mismo panel.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/publico-frontend.test.js tests/paginas.test.js` y después `npm test`.
Expected: PASS; suite completa en verde.

- [ ] **Step 5: Look at it in the browser**

`dataset.html?id=` de un actualizado, un sin respuesta, un eventual y uno con Observaciones; `?id=99999` (no encontrado); sin `id`; `?id=estadisticas` (no encontrado, no una página vacía); a 375 px.

- [ ] **Step 6: Commit**

```bash
git add public tests
git commit -m "feat: detalle de dataset con la estética nueva y el error de carga aparte"
```

---

### Task 5: Calendario anual

**Files:**
- Modify: `public/calendario.html` (sin FullCalendar ni modal; `publico.css`; banda; filtros; `#almanaque`)
- Modify: `public/js/calendario.js` (reescritura del armado; conserva el iCal)
- Modify: `public/css/publico.css` (sección Calendario); `public/css/main.css` (borrar los overrides `.fc*` y `.modal-dia-*` si ninguna otra página los usa)
- Test: `tests/publico-frontend.test.js`, `tests/paginas.test.js` (sacar `calendario.html` de `PENDIENTES`)

**Interfaces:**
- Consumes: `publico.css` de la Task 2. `mesesDelGrafico` es de `dashboard.js`, que el calendario no carga: `calendario.js` tiene su propia `mesesDelAlmanaque(hoy)` con la misma salida (`{ clave, etiqueta, titulo }`, 12 meses desde el actual). Un test verifica que las dos coincidan.
- Produces en `calendario.js` (puras):
  - `filtrarCalendario(datasets, { areaId, temaId })` → por `area_id` (comparado como texto) y por tema principal **o secundario**.
  - `filasDelAlmanaque(datasets, hoy)` → `[{ tipo: 'vencidos' | 'mes' | 'despues', clave, titulo, actual, datasets }]`: primero `vencidos` (solo si hay; `atrasado` y `sin-respuesta` por `soloFecha(proxima)` ascendente y título), después los 12 meses (siempre los 12, con `actual: true` en el primero; sin los vencidos, los eventuales ni los sin fecha; por título dentro del mes) y al final `despues` (solo si hay; por fecha y título). Los eventuales y los sin fecha no entran nunca.
  - `htmlDelAlmanaque(filas)` → HTML de la spec 9:
    - el rótulo de cada mes es `<a href="datasets.html?mes=${clave}">${mes}</a>`, con el año en el actual y en cada enero;
    - "Este mes" en el actual;
    - "Nada vence este mes." en los vacíos (clase `vacio`);
    - cada ficha es `<li><a class="ficha" href="dataset.html?id=${id}" title="${área}"><i class="tile c-${estado}" aria-hidden="true"></i>${título}${mes corto en vencidos y después}</a></li>`, todo escapado.
  - `textoCantidad(n)` → `'1 conjunto'` / `'${n} conjuntos'`.
  - `exportarIcal()` sigue igual, salvo que toma los datasets de `filtrarCalendario(datasets, filtrosActuales())`. `limpiarTextoIcal` y `limpiarFiltros` siguen.
  - Se borran con sus tests: `determinarColorEvento`, `htmlDelDia`, `mostrarModalDia`, `cerrarModalDia`, `generarEventos`, `obtenerEventosDelDia`, `inicializarCalendario`, `formatearFecha`, `getBadgeClass`, `getEstadoTexto` (si nadie más los usa), `calendar`, y los listeners del modal y de Escape.
  - Carga: `API.pedirJson('GET', '/datasets')` (`.data`) y, en paralelo, `API.getAreas()` y `API.getTemas()`. Si falla la de datasets, `#calendario-error` con el texto de la spec. Vacío por filtros (ninguna fila con datasets): "No hay conjuntos con fecha para esos filtros.".
- `calendario.html`: `#filter-area` y `#filter-tema` con `<label for>`, "Limpiar" (`limpiarFiltros()`), la leyenda de los cuatro estados con `.tile`, `#almanaque` (`aria-label="Vencimientos por mes"`), `#calendario-vacio`, `#calendario-error`, el botón "Exportar a mi calendario (iCal)" (`exportarIcal()`). Sin `id="calendar"`, sin `modal-dia`, sin `fullcalendar`.

- [ ] **Step 1: Write the failing tests**

En `tests/publico-frontend.test.js`, reemplazar `describe('calendario.js: el color de cada día…')` por:

```js
describe('calendario.js: el almanaque', () => {
  const calendario = cargar('calendario.js');
  const LISTA = [
    dataset({ id: 1, titulo: 'Enero B', proxima_actualizacion: '2027-01-31T03:00:00.000Z' }),
    dataset({ id: 2, titulo: 'Enero A', proxima_actualizacion: '2027-01-31' }),
    dataset({ id: 3, titulo: 'Viejo', proxima_actualizacion: '2024-01-31T03:00:00.000Z', estado: 'sin-respuesta', dias_para_vencer: -990 }),
    dataset({ id: 4, titulo: 'Menos viejo', proxima_actualizacion: '2025-09-30T03:00:00.000Z', estado: 'atrasado', dias_para_vencer: -383 }),
    dataset({ id: 5, titulo: 'Lejano', proxima_actualizacion: '2027-11-30T03:00:00.000Z' }),
    dataset({ id: 6, titulo: 'Este mes', proxima_actualizacion: '2026-10-31T03:00:00.000Z', estado: 'proximo', dias_para_vencer: 13 }),
    eventual({ id: 7, proxima_actualizacion: '2027-01-31T03:00:00.000Z' }),
    dataset({ id: 8, proxima_actualizacion: null, estado: 'sin-fecha', dias_para_vencer: null })
  ];

  it('vencidos primero, los 12 meses desde el actual y después "más adelante"; sin eventuales ni sin fecha', () => {
    const filas = plano(calendario.filasDelAlmanaque(LISTA, '2026-10-18'));
    assert.deepEqual(filas.map(f => f.tipo), ['vencidos', ...Array(12).fill('mes'), 'despues']);
    assert.deepEqual(filas[0].datasets.map(d => d.id), [3, 4]);
    assert.equal(filas[1].clave, '2026-10'); assert.equal(filas[1].actual, true);
    assert.deepEqual(filas[1].datasets.map(d => d.id), [6]);
    assert.deepEqual(filas[4].datasets.map(d => d.id), [2, 1]);
    assert.deepEqual(filas.at(-1).datasets.map(d => d.id), [5]);
    assert.ok(!filas.some(f => f.datasets.some(d => d.id === 7 || d.id === 8)));
  });

  it('sin vencidos ni lejanos, solo los 12 meses', () => {
    assert.equal(calendario.filasDelAlmanaque([LISTA[0]], '2026-10-18').length, 12);
  });

  it('los meses son los mismos que los del gráfico de la portada', () => {
    const tablero = cargar('dashboard.js');
    assert.deepEqual(plano(calendario.mesesDelAlmanaque('2026-10-18')), plano(tablero.mesesDelGrafico('2026-10-18')));
  });

  it('filtra por área y por tema principal o secundario', () => {
    const lista = [dataset({ id: 1, area_id: 3, tema_principal_id: 5 }), dataset({ id: 2, area_id: 4, tema_secundario_id: 5 }), dataset({ id: 3, area_id: 3 })];
    assert.deepEqual(plano(calendario.filtrarCalendario(lista, { areaId: '3', temaId: '' })).map(d => d.id), [1, 3]);
    assert.deepEqual(plano(calendario.filtrarCalendario(lista, { areaId: '', temaId: '5' })).map(d => d.id), [1, 2]);
  });

  it('el HTML: el mes lleva al listado, cada ficha al detalle, escapado, y los meses vacíos lo dicen', () => {
    const html = calendario.htmlDelAlmanaque(calendario.filasDelAlmanaque([...LISTA, dataset({ id: 9, titulo: '<b>x</b>', area_nombre: 'A "B"', proxima_actualizacion: '2027-03-31T03:00:00.000Z' })], '2026-10-18'));
    assert.ok(html.includes('href="datasets.html?mes=2027-01"'));
    assert.ok(html.includes('href="dataset.html?id=9"'));
    assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'));
    assert.ok(html.includes('title="A &quot;B&quot;"'));
    assert.ok(html.includes('Nada vence este mes.'));
    assert.ok(html.includes('Este mes'));
    assert.equal(calendario.textoCantidad(1), '1 conjunto');
  });

  it('calendario.html ya no carga FullCalendar ni tiene el modal del día', () => {
    const html = leer('calendario.html');
    assert.doesNotMatch(html, /fullcalendar/i);
    assert.doesNotMatch(html, /modal-dia/);
    assert.match(html, /id="almanaque"/);
    assert.match(html, /exportarIcal\(\)/);
  });
});
```

y en el `describe('las páginas públicas ya no calculan el estado por su cuenta')`, `calendario.js` sigue sin `calcularEstadoDataset`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/publico-frontend.test.js`
Expected: FAIL (`filasDelAlmanaque is not a function`).

- [ ] **Step 3: Implement**

Como en las Interfaces y la spec 9 (ver `calendario.html` del mockup). Filas: grilla `200px 1fr` (una columna a ≤ 760 px), borde inferior `--linea`, la primera con una línea `--tinta` de 2 px arriba; Vencidos con fondo `#FDF0EE`; el mes actual con fondo `--cielo`; los vacíos más bajos y con el rótulo en `--suave`. Fichas: píldora blanca con borde `--linea`, 0.9rem 600, `--tinta`; en vencidos y después, el mes corto en `--suave`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/publico-frontend.test.js tests/paginas.test.js` y después `npm test`.
Expected: PASS; suite completa en verde.

- [ ] **Step 5: Look at it in the browser**

`calendario.html` sin filtros, con un área, con un tema (que entren los de tema secundario), con una combinación vacía; "Exportar a mi calendario (iCal)" baja `rpad-vencimientos-AAAA-MM-DD.ics` con los filtrados; el clic en "enero" lleva a `datasets.html?mes=2027-01`; a 375 px.

- [ ] **Step 6: Commit**

```bash
git add public tests
git commit -m "feat: calendario anual (vencidos, 12 meses y más adelante) sin FullCalendar"
```

---

### Task 6: Contacto, vista previa al compartir y documentación

**Files:**
- Modify: `public/contacto.html` (sin `<style>`; `publico.css`; banda; formulario y bloque de información)
- Modify: `public/css/publico.css` (sección Contacto)
- Modify: `public/index.html`, `datasets.html`, `dataset.html`, `calendario.html`, `contacto.html` (metas Open Graph y `theme-color`)
- Modify: `public/robots.txt`
- Create: `public/img/compartir.png` (1200×630)
- Modify: `CLAUDE.md`, `README.md`
- Test: `tests/paginas.test.js` (borrar `PENDIENTES`; metas; robots)

**Interfaces:**
- Consumes: `publico.css` de la Task 2.
- `contacto.html`:
  - Mantiene todos los ids y nombres que usa `contacto.js` (`contacto-form`, `nombre`, `email`, `tipo`, `mensaje`, `char-count`, `btn-enviar`, y los de los mensajes de éxito/error que ya tenga), los `<option>` de tipo, los `maxlength`/`minlength` y los textos de ayuda.
  - Cada campo lleva `<label for>`.
  - Al lado va el bloque de información de hoy con todo su contenido (spec 10).
  - Sigue sin cargar `api.js`.
- Metas por página (spec 12):
  - `og:title`: `RPAD - Índice de actualización de los datos abiertos` (index), `Datasets - RPAD`, `Detalle de un conjunto de datos - RPAD`, `Calendario de vencimientos - RPAD`, `Contacto - RPAD`.
  - `og:description`: la `<meta name="description">` de cada página (actualizarla si hace falta: index "Qué conjuntos de datos abiertos de la Municipalidad de Comodoro Rivadavia están al día y cuáles vencen pronto.").
  - `og:url`: `https://rpad.mcrmodernizacion.gob.ar/{página}` (index → `/`).
  - `og:image`: `https://rpad.mcrmodernizacion.gob.ar/img/compartir.png`, con `og:image:width` 1200, `og:image:height` 630 y `og:image:alt`.
  - Además: `og:type` `website`, `og:site_name` `RPAD`, `og:locale` `es_AR`, `twitter:card` `summary_large_image` y `<meta name="theme-color" content="#1A365D">`.
- `robots.txt` (CRLF):

```
# Solo los robots que arman la vista previa de un link (spec 2026-10-18-rediseno-publico, 12). Ningún buscador.
User-agent: facebookexternalhit
User-agent: Facebot
User-agent: Twitterbot
User-agent: LinkedInBot
User-agent: Slackbot-LinkExpanding
User-agent: Slackbot
User-agent: TelegramBot
User-agent: WhatsApp
Allow: /$
Allow: /index.html
Allow: /datasets.html
Allow: /dataset.html
Allow: /calendario.html
Allow: /contacto.html
Allow: /img/compartir.png
Disallow: /

User-agent: *
Disallow: /
```

- `compartir.png`: generar con Chrome sin interfaz (`chrome.exe --headless=new --window-size=1200,630 --screenshot=… file:///…/compartir.html`) a partir de un HTML en el scratchpad de la sesión: fondo `--cielo`, `img/logo.png`, "RPAD" en Bricolage 750 grande, "Registro Permanente de Actualización de Datasets" en Figtree, una franja de ~40 cuadritos con los colores de estado en la proporción de la base local y la ola en `--bruma` abajo. Verificar que mida 1200×630 y pese menos de 300 KB.
- Documentación (spec 15):
  - En `CLAUDE.md`:
    - "CDN": Chart.js solo en Gestión; no hay Lucide ni FullCalendar por CDN.
    - Estructura: `css/main.css` + `css/publico.css`; `styles.css`, `layout.css` y `perfil.css` sin uso.
    - Orden de scripts: `config → auth → main → api → página`.
    - CSS: variables y fuentes nuevas (Bricolage Grotesque + Figtree).
    - "Sitio público": la portada (índice, mosaico, 12 meses, listas), Datasets (estados, lista y orden en la URL), el detalle y el calendario anual.
    - Una línea sobre la carcasa copiada en las 13 páginas y `RPAD v2.0.0`.
  - En `README.md`: la versión 2.0.0, el árbol de `public/`, los filtros y las vistas, y una entrada al principio del changelog: "Rediseño de las páginas públicas (2026-10)".

- [ ] **Step 1: Write the failing tests**

En `tests/paginas.test.js` (borrar `PENDIENTES` y su uso) agregar:

```js
  for (const pagina of ['index.html', 'datasets.html', 'dataset.html', 'calendario.html', 'contacto.html']) {
    it(`${pagina}: vista previa al compartir`, () => {
      const html = leer(pagina);
      for (const meta of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type', 'og:locale', 'twitter:card']) {
        assert.match(html, new RegExp(`<meta (property|name)="${meta}" content="[^"]+">`), meta);
      }
      assert.ok(html.includes('content="https://rpad.mcrmodernizacion.gob.ar/img/compartir.png"'));
      assert.ok(html.includes('<meta name="theme-color" content="#1A365D">'));
    });
  }

  it('robots.txt: los buscadores siguen afuera y los robots de vista previa entran a las públicas', () => {
    const robots = fs.readFileSync(new URL('robots.txt', DIRECTORIO), 'utf8').replace(/\r/g, '');
    assert.match(robots, /User-agent: \*\nDisallow: \/\s*$/);
    for (const robot of ['facebookexternalhit', 'Twitterbot', 'LinkedInBot', 'TelegramBot', 'WhatsApp']) assert.ok(robots.includes(`User-agent: ${robot}`), robot);
    assert.ok(robots.includes('Allow: /img/compartir.png'));
    assert.doesNotMatch(robots, /Allow: \/admin|Allow: \/api/);
  });

  it('contacto.html: los campos con su label y sin api.js', () => {
    const html = leer('contacto.html');
    for (const id of ['nombre', 'email', 'tipo', 'mensaje']) assert.match(html, new RegExp(`<label for="${id}"`), id);
    assert.doesNotMatch(html, /js\/api\.js/);
    assert.ok(html.includes('Belgrano'), 'conserva la dirección postal');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/paginas.test.js`
Expected: FAIL (sin metas, robots viejo, `contacto.html` sin `publico.css`).

- [ ] **Step 3: Implement**

Como en las Interfaces y la spec 10, 12 y 15.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/paginas.test.js` y después `npm test`.
Expected: PASS; suite completa en verde.

- [ ] **Step 5: Look at it in the browser**

`contacto.html` en escritorio y a 375 px; enviar el formulario no hace falta (va a Mailpit en local, pero no es parte de esta tarea): verificar que los mensajes de validación de `contacto.js` siguen apareciendo al dejar campos vacíos. Abrir `img/compartir.png`.

- [ ] **Step 6: Commit**

```bash
git add public tests CLAUDE.md README.md
git commit -m "feat: Contacto con la estética nueva, vista previa al compartir y documentación del rediseño"
```

---

## Después de las tareas (lo hace quien coordina, no un implementador)

1. Revisión final de toda la rama (modelo más capaz) y la ronda de arreglos.
2. Verificación en el navegador de las 13 páginas, en escritorio y a 375 px, con y sin sesión (superadmin de prueba).
3. Alta del dataset de prueba del usuario en la **base local** (nunca en producción), por la pantalla de administración como se haría en producción: lo propone `prueba_super` y lo aprueba un segundo usuario de prueba admin `@rpad.test` creado en la base local.
   - Datos: "Cantidad de empleados municipales (planta permanente y transitoria)".
   - Descripción: la del portal.
   - Área: Dirección General de Sueldos (externa).
   - Tema: Gobierno y Gestión Pública.
   - Frecuencia: Cada medio año.
   - Tipo de pedido: Vigente al (foto).
   - Datos al 30/09/2026, cargado en el portal el 16/10/2026, próxima 30/11/2026.
   - Formatos: CSV y XLSX.
   - URL: `https://datos.comodoro.gov.ar/dataset/cantidad-de-empleados-municipales-planta-permanente-y-transitoria`.

   Después se mira cómo aparece en la portada (Próximos a vencer, el mosaico, noviembre y Últimas cargas), en Datasets, en el detalle y en el calendario.
4. Merge, limpieza y kit: solo con el OK del usuario para el merge; el kit en el Escritorio, como los anteriores.
