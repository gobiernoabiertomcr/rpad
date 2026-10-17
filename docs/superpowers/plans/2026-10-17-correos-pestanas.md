# Correos en pestañas — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ordenar `correos.html` en cuatro pestañas (Libro de Notas Digitales primero · Estado · Vista previa y pruebas · Configuración) con el lenguaje visual de Mi Perfil, sin cambiar lo que hace la página.

**Architecture:** Solo dos archivos de producción: `public/correos.html` (marcado y `<style>` propio) y `public/js/correos.js` (pestañas, marca del Estado, filas del Libro, confirmación propia, cierre del "Ver"). Las pestañas copian el patrón de `perfil.js` (sin JS compartido). Los tests nuevos van en `tests/correos-frontend.test.js` (carga `correos.js` en un `vm` con un DOM falso) y la versión del script en `tests/paginas.test.js`.

**Tech Stack:** HTML5, CSS3, JS vanilla (scripts clásicos, no módulos), `node:test` + `vm`.

**Spec:** `docs/superpowers/specs/2026-10-17-correos-pestanas-design.md` (manda sobre el mockup `docs/superpowers/specs/2026-10-17-correos-pestanas-mockup.html`, que es la referencia visual: clases `co-*`, tokens y medidas).

## Global Constraints

- Es un cambio visual: ningún botón, filtro, guardado, vista previa, prueba o reintento cambia lo que hace; no se tocan endpoints, servidor, notas ni emails.
- `correos.js` al cargarse solo declara y registra `DOMContentLoaded`; todo lo que use `window`, `location`, `history`, `classList`, `setAttribute`, `dataset`, `focus` o `querySelector` va dentro de funciones que el test no llama al cargar.
- Las funciones nuevas son declaraciones `function` (los tests las llaman como `contexto.nombre()`).
- Siguen existiendo, con el mismo comportamiento probado: `verAnexoDeVistaPrevia`, `actualizarBotonAnexo`, `aplicarFirmante`, `datosDelFormulario`, `textoLicenciaFirmante`, `textoGestion`, `ETIQUETAS`, `celdaCantidad`, `textoCambioDeNota`, `textoAuditoria`, `nombreVistaPrevia`, `actualizarSelectorGestion`, `textoSinQuienAudite`, `textoPeriodosSinAuditor`, `cargarEstado`, `configActual`.
- No cambia ningún `id` existente de `correos.html`. El HTML de las alertas que arma `cargarEstado` queda exactamente `<div class="nd-alerta nd-advertencia">MENSAJE</div>` / `<div class="nd-alerta">MENSAJE</div>`, unidas sin separador.
- `cargarEstado` sigue reescribiendo `className` de `#envio-activo-texto` (`badge badge-success|badge-secondary`) y `verificarConexionSMTP` el de `#smtp-status` (`smtp-status checking|success|error`): esas clases y sus estilos se quedan.
- Versiones: `auth.js`, `main.js`, `api.js` siguen en `?v=20261023`; `correos.js` pasa a `?v=20261102`. `correos.html` conserva exactamente un `href="usuarios.html"` (el del sidebar). El orden de scripts no cambia.
- Estilos nuevos solo en el `<style>` de `correos.html`; sin recursos externos nuevos (CSP: `img-src` permite `data:`).
- Tokens (los de Mi Perfil, con los mismos nombres `--pf-*` en el `:root` del `<style>` de Correos): tinta `#1F3A5F`, texto `#2B3A4A`, suave `#6B7A8C`, línea `#E4E9EF`, sutil `#F7F9FB`, acento `#3E6B96`; verde `#DDF1E6`/`#2E6B4C`, azul `#DCEAF7`/`#24507A`, rojo `#F8E1E1`/`#8A3434`, ámbar `#FBF1DC`/`#F0DDB0`/`#7A5A14`, violeta `#ECE6F6`/`#4B3A78`, turquesa `#DDF1EE`/`#1F5F58`.
- Letra Inter, fechas con `tabular-nums`, sin emojis ni mayúsculas sostenidas, tarjetas blancas con borde de 1px y radio 12px, responsive a 375px sin scroll horizontal de la página, `prefers-reduced-motion` respetado, foco visible.
- Todo dato que se muestra pasa por `Utils.escapeHtml`. Español en código, comentarios y UI.
- Tests de cada tarea: `node --test tests/correos-frontend.test.js tests/paginas.test.js` (no necesitan la base). La suite completa (`npm test`, con `docker compose up -d` y `RPAD_TESTS_DB_LOCAL=1`) se corre en la Tarea 7.
- Commits con el trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sin push.

## Review Focus

1. Cancelar la activación del envío automático (Cancelar, Escape o clic afuera): el interruptor vuelve a apagado y no se llama a la API; desactivar no pide confirmación. → Tarea 6.
2. Un hash raro (`#`, `#ESTADO`, `#estado/x`, `estado` sin `#`, vacío): abre el Libro salvo que sea exactamente uno de los cuatro nombres (con o sin `#`). → Tarea 1.
3. Volver a cargar el Estado sin alertas apaga la marca que había quedado prendida (también la ámbar de `#nd-sin-quien-audite`). → Tarea 2.
4. Escape con la confirmación abierta solo cancela la confirmación (no cierra "Ver"); Escape sin nada abierto no hace nada ni rompe. → Tarea 6.
5. Filas del Libro raras: nota de prueba (`PRUEBA`, `—`), autorización sin gestión (`—` sin etiqueta), sin `enviada_at` (sin fecha debajo), datos con `<`/`"` (escapados), fallida con Reintentar. → Tarea 3.

---

### Task 1: Pestañas

**Files:**
- Modify: `public/correos.html` (todo el `<main>`, `<title>`, `<style>`, pie, versión del script)
- Modify: `public/js/correos.js` (constante y funciones de pestañas, `DOMContentLoaded`)
- Modify: `tests/correos-frontend.test.js` (helper y tests nuevos), `tests/paginas.test.js`

**Interfaces:**
- Produces:
  - `const PESTANAS_DE_CORREOS = ['libro', 'estado', 'pruebas', 'configuracion'];`
  - `function pestanaInicial(hash)` → uno de esos nombres; `'libro'` si el hash (sin el `#` inicial) no es exactamente uno de ellos.
  - `function mostrarPestana(nombre)`: para cada pestaña, `setAttribute('aria-selected', String(activa))`, `tabIndex = activa ? 0 : -1`, `classList.toggle('activa', activa)`, `#vista-<n>.hidden = !activa`; después `history.replaceState(null, '', '#<nombre>')`.
  - `function teclaEnPestanas(evento)`: como `perfil.js` (ignora Alt/Ctrl/Meta; `evento.target.dataset?.vista`; ArrowRight/ArrowLeft con vuelta, Home, End; `preventDefault()`, `mostrarPestana`, `focus()` de la pestaña destino; cualquier otra tecla no hace nada).
  - `function conectarPestanas()`: clic en cada `#pestana-<n>` → `mostrarPestana(n)`; `keydown` en `#pestanas-correos` → `teclaEnPestanas`.
  - Marcado: `<div class="pf-pestanas" id="pestanas-correos" role="tablist" aria-label="Secciones de Correos">` con cuatro `<button type="button" class="pf-pestana" role="tab" id="pestana-<n>" aria-selected="false" aria-controls="vista-<n>" data-vista="<n>" tabindex="-1">` (textos: "Libro de Notas Digitales", "Estado", "Vista previa y pruebas", "Configuración") y cuatro `<section id="vista-<n>" role="tabpanel" aria-labelledby="pestana-<n>" hidden>`, en ese orden.
  - Helper de tests: `cargarCorreos(api = {}, globales = {})`; cada elemento falso suma `attrs`, `setAttribute(nombre, valor)` (guarda `String(valor)` en `attrs`), `clases` (Set) con `classList: { add, remove, toggle(clase, activa), contains }`, y `focus()` que agrega su id a `enfocados`; el helper devuelve también `enfocados`. `globales` se suma al contexto del `vm`.

- [ ] **Step 1: Escribir los tests que fallan**

En `tests/paginas.test.js`: sacar `correos` del bucle de `VERSION_PANTALLAS` (queda solo `usuarios.html`) y agregar `const VERSION_CORREOS = '20261102';` con el test `correos.html: correos.js con la versión 20261102` (`js/correos.js?v=${VERSION_CORREOS}"`), con un comentario que diga que cambió con Correos en pestañas.

En `tests/correos-frontend.test.js`, extender el helper como dice Interfaces (sin cambiar los tests existentes) y agregar:

```js
describe('correos.html: pestañas (spec 2026-10-17-correos-pestanas, 4)', () => {
  const PAGINA = fs.readFileSync(new URL('../public/correos.html', import.meta.url), 'utf8');
  const NOMBRES = ['libro', 'estado', 'pruebas', 'configuracion'];
  const etiqueta = (id) => PAGINA.match(new RegExp(`<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>`))?.[0] ?? '';
  // it: la barra (#pestanas-correos) tiene class="pf-pestanas", role="tablist", aria-label="Secciones de Correos", sin hidden
  // it por cada n: pestaña <button type="button" role="tab" aria-controls="vista-n" data-vista="n" aria-selected="false" tabindex="-1">,
  //   panel role="tabpanel" aria-labelledby="pestana-n" hidden
  // it: orden libro, estado, pruebas, configuracion (posiciones crecientes de id="pestana-n" y de id="vista-n")
  // it: solo hay cuatro <section (los paneles) y #modal-nota va después del último </section>
  // it: <title>Correos - RPAD</title>, el h1 dice "Correos" (no "Sistema de Correos"), el pie dice "RPAD v1.5.0"
});

describe('correos.js: pestañas', () => {
  // pestanaInicial: '' → 'libro'; '#estado' → 'estado'; 'estado' → 'estado'; '#configuracion' → 'configuracion';
  //   '#pruebas' → 'pruebas'; '#' → 'libro'; '#ESTADO' → 'libro'; '#estado/x' → 'libro'; '#cualquiera' → 'libro'; undefined → 'libro'
  // mostrarPestana('estado') con cargarCorreos({}, { history: { replaceState: (...a) => historial.push(a[2]) } }):
  //   solo pestana-estado con attrs['aria-selected'] === 'true', tabIndex 0, clases.has('activa'); las otras 'false', -1, sin 'activa';
  //   solo vista-estado con hidden false; historial termina en '#estado'
  // teclaEnPestanas (target = elemento('pestana-<desde>') con dataset = { vista: desde }):
  //   ['libro','ArrowRight','estado'], ['configuracion','ArrowRight','libro'], ['libro','ArrowLeft','configuracion'],
  //   ['pruebas','Home','libro'], ['estado','End','configuracion'] → activa y enfocada la de destino, preventDefault llamado;
  //   'Enter', 'Tab', 'ArrowDown' → nada cambia, sin preventDefault; con altKey, ctrlKey o metaKey → nada cambia
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `node --test tests/correos-frontend.test.js tests/paginas.test.js`
Expected: FAIL en los tests nuevos (`pestanaInicial is not defined`, falta `role="tablist"`, versión 20261024); los existentes siguen pasando.

- [ ] **Step 3: Implementar**

`correos.html`:
- `<title>Correos - RPAD</title>`; el h1 dice "Correos"; el pie `RPAD v1.5.0`; `js/correos.js?v=20261102`.
- En el `<style>`: `[hidden] { display: none !important; }`, `.main-content { min-width: 0; }`, el `:root` con los tokens `--pf-*` de Global Constraints, y las reglas de `.pf-pestanas`/`.pf-pestana` de `perfil.html` (líneas 42-47 y su `prefers-reduced-motion`).
- Debajo de `#message-container`: la barra y los cuatro paneles. Por ahora cada panel lleva las tarjetas `.smtp-card` de hoy tal cual: `vista-libro` ← Libro; `vista-estado` ← Estado (con `#nd-alertas` todavía adentro, la Tarea 2 lo saca); `vista-pruebas` ← Vista previa y prueba + Aviso a las áreas; `vista-configuracion` ← Configuración.
- `#modal-nota`, el pie y los scripts quedan fuera de los paneles.

`correos.js`: la constante y las cuatro funciones de Interfaces (sección `// PESTAÑAS` con el mismo estilo de comentarios de `perfil.js`). En `DOMContentLoaded`, después de los dos chequeos de sesión y antes de conectar lo demás: `conectarPestanas(); mostrarPestana(pestanaInicial(location.hash)); window.addEventListener('hashchange', () => mostrarPestana(pestanaInicial(location.hash)));`.

- [ ] **Step 4: Correr y verificar que pasan**

Run: `node --test tests/correos-frontend.test.js tests/paginas.test.js`
Expected: PASS, todos.

- [ ] **Step 5: Commit**

```bash
git add public/correos.html public/js/correos.js tests/correos-frontend.test.js tests/paginas.test.js
git commit -m "feat: Correos en cuatro pestañas, con el Libro de Notas Digitales primero"
```

---

### Task 2: Alertas arriba de las pestañas y marca en Estado

**Files:**
- Modify: `public/correos.html`, `public/js/correos.js` (`cargarEstado`), `tests/correos-frontend.test.js`

**Interfaces:**
- Consumes: la barra y los paneles de la Tarea 1.
- Produces:
  - `function marcaDelEstado(alertas, auditoria)` → `'error'` si alguna alerta tiene `nivel !== 'advertencia'`; si no, `'advertencia'` si alguna tiene `nivel === 'advertencia'` o `textoSinQuienAudite(auditoria)` no es `''`; si no, `''`.
  - En la pestaña Estado, después del texto: `<span class="co-punto error" id="marca-estado-error" role="img" aria-label="Hay alertas" title="Hay alertas" hidden></span><span class="co-punto advertencia" id="marca-estado-advertencia" role="img" aria-label="Hay advertencias" title="Hay advertencias" hidden></span>`.
  - `cargarEstado`, con lo mismo que usa para dibujar las alertas: `#marca-estado-error.hidden = marca !== 'error'` y `#marca-estado-advertencia.hidden = marca !== 'advertencia'` (solo `hidden`).

- [ ] **Step 1: Escribir los tests que fallan**

- Estructura: `id="nd-alertas"` está antes de `role="tablist"` y antes de `id="vista-libro"`; su etiqueta tiene `class="co-alertas"`; `marca-estado-error` y `marca-estado-advertencia` están dentro del botón `pestana-estado` (entre su apertura y el `</button>` siguiente) y arrancan con `hidden`.
- `marcaDelEstado`: `([{ nivel: 'error' }, { nivel: 'advertencia' }], undefined)` → `'error'`; `([{ nivel: 'advertencia' }], undefined)` → `'advertencia'`; `([], { sin_quien_audite: 2 })` → `'advertencia'`; `([], { sin_quien_audite: 0 })` → `''`; `([], undefined)` → `''`.
- `cargarEstado` (con un `ESTADO` base como el del describe existente "cargarEstado: las dos líneas…", que es local a ese describe): con `fallidas: 1` → `marca-estado-error.hidden === false` y `marca-estado-advertencia.hidden === true`; con una alerta `{ nivel: 'advertencia', mensaje: 'x' }` → error oculta, advertencia visible; con `auditoria.sin_quien_audite: 1` y sin alertas → advertencia visible; y volver a cargar con todo en cero deja las dos ocultas.
- Los tests existentes de `#nd-alertas` (el `innerHTML` exacto) siguen pasando sin cambios.

- [ ] **Step 2: Correr y verificar que fallan**

Run: `node --test tests/correos-frontend.test.js`
Expected: FAIL en los nuevos (`marcaDelEstado is not defined`, `nd-alertas` después de la barra).

- [ ] **Step 3: Implementar**

- `<div id="nd-alertas" class="co-alertas" aria-live="polite"></div>` sale de la tarjeta Estado y va entre `#message-container` y la barra.
- CSS: `.co-alertas { display: grid; gap: 8px; margin-bottom: 16px; }` y `.co-alertas:empty { display: none; }`. `.nd-alerta` (error): fondo `#FBEEEE`, borde `#EFCACA`, texto `#8A3434`, radio 10px, `padding: 11px 14px 11px 38px`, ícono de alerta por `::before` (un círculo con signo de exclamación como `data:image/svg+xml`, del color del texto de la variante, posicionado a la izquierda). `.nd-alerta.nd-advertencia`: fondo `#FBF1DC`, borde `#F0DDB0`, texto `#7A5A14` (y su ícono de ese color). Aplica también a `#nd-sin-quien-audite` y `#modal-nota-error`, a propósito (spec 14).
- `.co-punto { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }`, `.co-punto.error { background: #C0504D; }`, `.co-punto.advertencia { background: #D9A33A; }`.
- `marcaDelEstado` y su uso en `cargarEstado`, justo después de dibujar `#nd-alertas` y las líneas de auditoría.

- [ ] **Step 4: Correr y verificar que pasan**

Run: `node --test tests/correos-frontend.test.js tests/paginas.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/correos.html public/js/correos.js tests/correos-frontend.test.js
git commit -m "feat: Correos: las alertas arriba de las pestañas y una marca en Estado"
```

---

### Task 3: Libro renovado

**Files:**
- Modify: `public/correos.html` (panel `vista-libro` y su CSS), `public/js/correos.js` (`cargarLibro`), `tests/correos-frontend.test.js`

**Interfaces:**
- Consumes: el panel `vista-libro` de la Tarea 1.
- Produces: las filas del Libro con este marcado (mismo orden de columnas, mismos `data-*` en los botones, `esc` = `Utils.escapeHtml`):

```js
`<tr>
  <td><span class="co-numero">${numeroDe(n)}</span></td>
  <td class="co-fecha">${fecha(n.fecha)}</td>
  <td><span class="co-chip ${n.tipo}">${ETIQUETAS[n.tipo]}</span></td>
  <td>${n.gestion ? `<span class="co-gestion">${textoGestion(n.gestion)}</span>` : textoGestion(n.gestion)}</td>
  <td class="co-cant">${celdaCantidad(n)}</td>
  <td class="co-para ocultable">${esc(n.para)}${n.cc ? `<small>CC: ${esc(n.cc)}</small>` : ''}</td>
  <td><span class="co-estado"><span class="co-pastilla ${n.estado}" title="${esc(detalleEstado)}">${ETIQUETAS[n.estado]}</span>${n.enviada_at ? `<small>${esc(fechaHora(n.enviada_at))}</small>` : ''}</span></td>
  <td><div class="co-acciones">
    <button type="button" class="co-btn" data-accion="ver" data-id="${n.id}">Ver</button>
    <button type="button" class="co-btn" data-accion="pdf" data-id="${n.id}" data-archivo="${esc(archivo)}">PDF</button>
    ${n.tiene_anexo ? `<button type="button" class="co-btn" data-accion="anexo" data-id="${n.id}" data-archivo="${esc(archivoAnexo)}">Anexo</button>` : ''}
    ${n.estado !== 'enviada' ? `<button type="button" class="co-btn reintentar" data-accion="reintentar" data-id="${n.id}">Reintentar</button>` : ''}
  </div></td>
</tr>`
```
  Las filas de vacío, error y "Cargando…" siguen con sus textos y `colspan="8"`, con `class="co-sin-filas"` en el `<td>`. `CLASE_ESTADO` queda sin uso: se borra.

- [ ] **Step 1: Escribir los tests que fallan**

`describe('correos.js: filas del Libro (spec 6)')`, con `cargarCorreos({ getLibroNotas: async () => NOTAS })` y `await contexto.cargarLibro()`; leer `elemento('libro-cuerpo').innerHTML`:
- Aviso enviado (`{ id: 7, numero: 3, anio: 2026, fecha: '2026-10-21', tipo: 'aviso', gestion: 'externa', cantidad_datasets: 1, para: 'para@rpad.test', cc: 'cc@rpad.test', estado: 'enviada', enviada_at: '2026-10-21 08:15', tiene_anexo: 1, es_prueba: 0 }`): contiene `<span class="co-numero">3/26</span>`, `<span class="co-chip aviso">Aviso</span>`, `<span class="co-gestion">Externa</span>`, `<span class="co-pastilla enviada" title="">Enviada</span><small>21/10/2026 08:15</small>`, `<small>CC: cc@rpad.test</small>`, `data-accion="anexo"`, y no contiene `data-accion="reintentar"`.
- Autorización fallida sin gestión ni `enviada_at`, con `ultimo_error: 'Error <421> "x"'`: la celda de gestión es `<td>—</td>`, `<span class="co-pastilla fallida" title="Error <421> &quot;x&quot;">` si el test pasa un `Utils.escapeHtml` real por `globales`, o, con el falso del helper (que devuelve igual), que el `title` es el `ultimo_error`, hay `class="co-btn reintentar" data-accion="reintentar"` y no hay `<small>` en el estado.
- Nota de prueba (`es_prueba: 1`): `<span class="co-numero">PRUEBA</span>` y celda de datasets `—`.
- `getLibroNotas` → `[]`: `<tr><td colspan="8" class="co-sin-filas">No hay notas con estos filtros.</td></tr>`; si rechaza con `new Error('falló')`: `<tr><td colspan="8" class="co-sin-filas">falló</td></tr>`.
- Estructura: el encabezado de Para / CC es `<th class="ocultable">Para / CC</th>`, la tabla tiene `class="co-libro"` dentro de `class="co-tabla-marco"`, el `<tbody id="libro-cuerpo">` arranca con `<tr><td colspan="8" class="co-sin-filas">Cargando…</td></tr>`, y siguen los ids de los seis filtros.

- [ ] **Step 2: Correr y verificar que fallan**

Run: `node --test tests/correos-frontend.test.js`
Expected: FAIL en los nuevos (marcado viejo con `badge`).

- [ ] **Step 3: Implementar**

- `cargarLibro` con el marcado de Interfaces (los filtros, el tope y el armado de `archivo`/`archivoAnexo`/`detalleEstado` no cambian).
- Panel `vista-libro` sin la tarjeta `.smtp-card`: `<div class="co-filtros">` con los mismos seis controles e ids (los `select` sin `form-select`; el de dataset con `class="ancho"`), `<div class="co-tabla-marco"><table class="co-libro">…</table></div>` y `#libro-limite` debajo (con la clase de ayuda de la página).
- CSS del Libro tomado del mockup (`.co-filtros`, `.co-tabla-marco`, `.co-libro`, `.co-numero`, `.co-fecha`, `.co-chip.*`, `.co-gestion`, `.co-cant`, `.co-para`, `.co-estado`, `.co-pastilla.*`, `.co-acciones`, `.co-btn`, `.co-btn.reintentar`), más `.co-btn:disabled` (opacidad .55, `cursor: not-allowed`), `.co-btn.primario`, `.co-sin-filas` (centrado, color suave) y `@media (max-width: 860px) { .co-libro .ocultable { display: none; } }`. La tabla se desplaza dentro de `.co-tabla-marco` (`overflow: auto`) si no entra.

- [ ] **Step 4: Correr y verificar que pasan**

Run: `node --test tests/correos-frontend.test.js tests/paginas.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/correos.html public/js/correos.js tests/correos-frontend.test.js
git commit -m "feat: Correos: el Libro de Notas Digitales como tabla renovada"
```

---

### Task 4: Estado

**Files:**
- Modify: `public/correos.html` (panel `vista-estado` y su CSS), `public/js/correos.js` (`cargarEstado`: `#nd-proximas`), `tests/correos-frontend.test.js`

**Interfaces:**
- Consumes: `vista-estado` (Tarea 1); `#nd-alertas` ya está afuera (Tarea 2).
- Produces:
  - `function cantidadDeDatasets(n)` → `'1 dataset'` si `n === 1`, si no `` `${n} datasets` ``.
  - `#nd-proximas` (con `class="co-proximas"`), una tarjeta por gestión:
    `<div class="co-proxima"><h3>${nombres[gestion]}</h3><dl><dt>Próximo aviso</dt><dd>${p.aviso ? `${fecha(p.aviso.fecha)} · ${cantidadDeDatasets(p.aviso.cantidad)}` : 'sin datasets pendientes'}</dd><dt>Próxima reiteración</dt><dd>${p.reiteracion.cantidad > 0 ? `${fecha(p.reiteracion.fecha)} · ${cantidadDeDatasets(p.reiteracion.cantidad)}` : 'sin datasets pendientes'}</dd></dl></div>`

- [ ] **Step 1: Escribir los tests que fallan**

- `cantidadDeDatasets(1)` → `'1 dataset'`, `(3)` → `'3 datasets'`, `(0)` → `'0 datasets'`.
- `cargarEstado` con `proximas: { interna: { aviso: { fecha: '2026-11-02', cantidad: 1 }, reiteracion: { fecha: '2026-11-02', cantidad: 3 } }, externa: { aviso: null, reiteracion: { fecha: null, cantidad: 0 } } }`: `#nd-proximas.innerHTML` contiene `<h3>Gestión interna</h3>`, `<dd>02/11/2026 · 1 dataset</dd>`, `<dd>02/11/2026 · 3 datasets</dd>`, `<h3>Gestión externa</h3>` y dos `<dd>sin datasets pendientes</dd>`; no contiene `dataset/s`.
- Estructura (`vista-estado`): en este orden `id="envio-activo"`, `id="nd-proximas"`, `id="btn-verificar-smtp"` y el párrafo que empieza con `Aviso de gestión interna 60 días antes`; los textos de las dos reglas son los de hoy, letra por letra; aparecen "Las notas salen solas a las 8:15 de cada día hábil." y "Lo que saldría con los datasets de hoy, si nadie los actualiza antes."; `#envio-activo` sigue siendo `<input type="checkbox"`.

- [ ] **Step 2: Correr y verificar que fallan**

Run: `node --test tests/correos-frontend.test.js`
Expected: FAIL en los nuevos.

- [ ] **Step 3: Implementar**

Panel `vista-estado` con cuatro `.co-tarjeta` (spec 7, mockup "ESTADO"):
1. Envío automático: `<div class="co-envio">` con el título `<h2>Envío automático de Notas Digitales</h2>`, la ayuda "Las notas salen solas a las 8:15 de cada día hábil." y, a la derecha, `<label class="co-switch" for="envio-activo">` con `<input type="checkbox" id="envio-activo" role="switch">` dibujado como interruptor por CSS (`appearance: none`, pista de 42×24, perilla blanca, verde `--pf-verde` al estar marcado, foco visible) y `#envio-activo-texto` (sigue `badge`). Debajo, `<div class="co-lineas">` con `#nd-ultima-corrida`, `#nd-licencia` (hidden), `#nd-auditoria`, `#nd-sin-quien-audite` (`nd-alerta nd-advertencia`, hidden) y `#nd-periodos-sin-auditor` (hidden), mismos elementos e ids.
2. `<h2>Próximas notas</h2>`, la ayuda "Lo que saldría con los datasets de hoy, si nadie los actualiza antes." y `#nd-proximas`.
3. `<h2>Conexión del correo</h2>` con `<div class="co-smtp">`: `#btn-verificar-smtp` (`class="co-btn"`) y `#smtp-status` (`class="smtp-status"`, "Sin verificar").
4. `.co-tarjeta.co-reglas` con `<h2>Cómo funcionan</h2>` y los dos párrafos de reglas de hoy, sin cambiar el texto.

CSS del mockup (`.co-tarjeta`, `.co-tarjeta + .co-tarjeta`, `.co-tarjeta h2`, `.co-ayuda`, `.co-envio`, `.co-switch`, `.co-proximas`, `.co-proxima`, `.co-lineas`, `.co-smtp`, `.co-reglas`) y `@media (max-width: 860px) { .co-proximas { grid-template-columns: 1fr; } }`. `cantidadDeDatasets` y el nuevo armado de `#nd-proximas` en `cargarEstado`.

- [ ] **Step 4: Correr y verificar que pasan**

Run: `node --test tests/correos-frontend.test.js tests/paginas.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/correos.html public/js/correos.js tests/correos-frontend.test.js
git commit -m "feat: Correos: la pestaña Estado en tarjetas, con las próximas notas en lista"
```

---

### Task 5: Vista previa y pruebas · Configuración

**Files:**
- Modify: `public/correos.html` (paneles `vista-pruebas` y `vista-configuracion` y su CSS), `tests/correos-frontend.test.js`

**Interfaces:**
- Consumes: los paneles de la Tarea 1; `.co-tarjeta`, `.co-ayuda`, `.co-btn` (Tareas 3 y 4).
- Produces: solo marcado y CSS. `correos.js` no cambia en esta tarea.

- [ ] **Step 1: Escribir los tests que fallan**

Estructura de `correos.html`:
- `vista-pruebas` tiene, en este orden, `id="preview-tipo"`, `id="preview-gestion"`, `id="btn-preview"`, `id="btn-preview-pdf"`, `id="btn-preview-anexo"`, `id="btn-prueba"`, `id="preview-aviso"`, `id="preview-marco"`, y después `id="btn-preview-area"`, `id="btn-prueba-area"`, `id="preview-area-marco"`; los dos `iframe` siguen con `sandbox=""` y `hidden`; aparece "Aviso a las áreas (40 días)" y el texto de hoy "Email directo a las áreas de gestión externa 40 días antes del vencimiento. La prueba se envía solo a las casillas de prueba.".
- `vista-configuracion` contiene `<form id="form-config"` y, dentro del form (antes de su `</form>`), los trece ids de `CAMPOS_CONFIG` más `firmante`, `firmante-ayuda`, `firma-archivo`, `firma-vista`, `firma-ayuda`, `membrete-archivo`, `membrete-vista`; el único `type="submit"` está dentro de `class="co-guardar"`, junto a "Separá varias direcciones con coma."; los siete títulos de grupo en este orden: Gestión interna, Gestión externa, Notas de auditoría, Respaldo y pruebas, Firmante titular, Firma, Membrete del PDF.

- [ ] **Step 2: Correr y verificar que fallan**

Run: `node --test tests/correos-frontend.test.js`
Expected: FAIL (falta `co-guardar`; el resto puede pasar ya).

- [ ] **Step 3: Implementar**

- `vista-pruebas`: `<div class="co-dos">` con dos `.co-tarjeta`:
  - `<h2>Nota Digital</h2>`, la ayuda "Cómo saldría hoy, con los datos reales (o de ejemplo si hoy no sale ninguna). La prueba va solo a las casillas de prueba." (texto del mockup aprobado), una fila `.co-controles` con los dos `select` y otra con los cuatro botones (`btn-preview` `co-btn primario`, los otros `co-btn`), `#preview-aviso`, `#preview-marco` y, después del iframe, `<div class="co-vacio">La vista previa aparece acá.</div>`.
  - `<h2>Aviso a las áreas (40 días)</h2>`, su texto de hoy como ayuda, `.co-controles` con `btn-preview-area` (`co-btn primario`) y `btn-prueba-area` (`co-btn`), `#preview-area-marco` y su `.co-vacio`.
  - El marcador se oculta solo por CSS cuando hay vista previa: `.nd-marco:not([hidden]) ~ .co-vacio { display: none; }`.
- `vista-configuracion`: el mismo `form#form-config` (sin la tarjeta `.smtp-card`) con `<div class="co-config">` de dos columnas: izquierda Gestión interna, Gestión externa, Notas de auditoría, Respaldo y pruebas; derecha Firmante titular, Firma, Membrete del PDF. Cada grupo sigue siendo `<fieldset>` con su `<legend>`, ahora `class="co-grupo"` (tarjeta blanca, borde de 1px, radio 12px; el `legend` se ve como título dentro de la tarjeta, por ejemplo `float: left; width: 100%` y `clear: both` en lo que sigue). Al pie del form, `<div class="co-guardar">` (`position: sticky; bottom: 0`) con `<span>Separá varias direcciones con coma.</span>` y `<button type="submit" class="co-btn primario">Guardar configuración</button>`. Mismos campos, ids, `maxlength`, `accept`, `autocomplete` y ayudas.
- CSS del mockup (`.co-dos`, `.co-controles`, `.co-vacio`, `.co-config`, `.co-grupo`, `.co-guardar`), `.nd-marco` con el borde y radio nuevos, y `@media (max-width: 860px) { .co-dos, .co-config { grid-template-columns: 1fr; } }` (en celular los `select` de `.co-controles` ocupan el ancho).

- [ ] **Step 4: Correr y verificar que pasan**

Run: `node --test tests/correos-frontend.test.js tests/paginas.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/correos.html tests/correos-frontend.test.js
git commit -m "feat: Correos: vista previa y pruebas lado a lado, y la configuración en dos columnas"
```

---

### Task 6: Confirmación propia y cierre del "Ver"

**Files:**
- Modify: `public/correos.html` (ventana de confirmación, CSS de las dos ventanas), `public/js/correos.js`, `tests/correos-frontend.test.js`

**Interfaces:**
- Consumes: el helper con `classList`, `focus` y `enfocados` (Tarea 1).
- Produces:
  - Marcado, fuera de los paneles y después de `#modal-nota`: `<div class="modal-overlay" id="modal-confirmar">` con `<div class="modal co-confirmar" role="alertdialog" aria-modal="true" aria-labelledby="modal-confirmar-titulo" aria-describedby="modal-confirmar-texto">`, `<h3 class="modal-title" id="modal-confirmar-titulo">`, `<p id="modal-confirmar-texto">`, `<button type="button" class="co-btn" id="modal-confirmar-cancelar">Cancelar</button>` y `<button type="button" class="co-btn primario" id="modal-confirmar-aceptar">`.
  - `let confirmacionPendiente = null;` (`{ resolver, origen }` mientras está abierta).
  - `function confirmar({ titulo, texto, accion })` → `Promise<boolean>`: si había una pendiente, la cierra como cancelada; pone los tres textos, guarda `origen = document.activeElement`, agrega `active` a `#modal-confirmar` y enfoca `#modal-confirmar-aceptar`.
  - `function cerrarConfirmacion(aceptada)`: si no hay pendiente, no hace nada; si hay, saca `active`, devuelve el foco a `origen` (`origen?.focus?.()`), limpia `confirmacionPendiente` y resuelve con `aceptada`.
  - `function teclaEnPagina(evento)`: solo con `evento.key === 'Escape'`: si hay confirmación pendiente → `cerrarConfirmacion(false)`; si no, si `#modal-nota` tiene `active` → `cerrarModalNota()`; si no, nada.
  - `function clicAfueraDeLaNota(evento)`: si `evento.target === evento.currentTarget` → `cerrarModalNota()`. `function clicAfueraDeLaConfirmacion(evento)`: igual → `cerrarConfirmacion(false)`.
  - Los tres pedidos (mismos casos que los `confirm()` de hoy):
    - `cambiarEnvioAutomatico`, solo al activar: `{ titulo: '¿Activar el envío automático?', texto: 'Desde la próxima corrida diaria (08:15) se enviarán Notas Digitales reales a los destinatarios configurados.', accion: 'Activar' }`; si devuelve `false`, `evento.target.checked = false` y `return` (sin API ni `cargarEstado`).
    - `enviarmePrueba`: `{ titulo: '¿Enviarte una prueba?', texto: 'Se enviará esta nota marcada como PRUEBA solo a las casillas de prueba configuradas.', accion: 'Enviar prueba' }`.
    - `enviarmePruebaArea`: `{ titulo: '¿Enviarte una prueba?', texto: 'Se enviará el aviso a áreas marcado como PRUEBA solo a las casillas de prueba.', accion: 'Enviar prueba' }`.

- [ ] **Step 1: Escribir los tests que fallan**

`describe('correos.js: confirmación propia y cierre del Ver (spec 9)')`:
- `correos.js` no contiene `confirm(` (leer el archivo y `assert.doesNotMatch(codigo, /\bconfirm\(/)`).
- Activar y cancelar: `evento = { target: { checked: true } }`, API con `guardarConfigNotas` que cuenta llamadas; `const p = contexto.cambiarEnvioAutomatico(evento)`; `#modal-confirmar` tiene `active`, `#modal-confirmar-aceptar.textContent === 'Activar'`, `#modal-confirmar-titulo.textContent === '¿Activar el envío automático?'`, `enfocados` termina en `modal-confirmar-aceptar`; `contexto.cerrarConfirmacion(false)`; `await p` → `evento.target.checked === false`, 0 llamadas, `#modal-confirmar` sin `active`.
- Activar y aceptar: `cerrarConfirmacion(true)` → `guardarConfigNotas` llamado una vez con `{ envio_activo: true }`.
- Desactivar (`checked: false`): `guardarConfigNotas` llamado con `{ envio_activo: false }` sin abrir la confirmación (`#modal-confirmar` sin `active`).
- `enviarmePrueba` y `enviarmePruebaArea`: con `cerrarConfirmacion(false)` no llaman a `enviarPruebaNota` / `enviarPruebaAvisoArea`; con `true`, sí, una vez (el texto de cada una es el de Interfaces).
- Escape: `contexto.teclaEnPagina({ key: 'Escape' })` con la confirmación abierta la cancela (la promesa resuelve `false`) y no toca `#modal-nota`; con `#modal-nota` activo (`classList.add('active')`) y sin confirmación, lo cierra (sin `active`, `#modal-nota-marco.srcdoc === ''`); sin nada abierto, no rompe; `{ key: 'Enter' }` no cierra nada.
- Clic afuera: `contexto.clicAfueraDeLaNota({ target: X, currentTarget: X })` cierra; con `target` distinto de `currentTarget`, no.
- Estructura: `#modal-confirmar` está después del último `</section>` y tiene `class="modal-overlay"`.

- [ ] **Step 2: Correr y verificar que fallan**

Run: `node --test tests/correos-frontend.test.js`
Expected: FAIL (`confirm is not defined` en el vm, `cerrarConfirmacion is not defined`).

- [ ] **Step 3: Implementar**

- El marcado de `#modal-confirmar`; las funciones de Interfaces en `correos.js` (sección `// CONFIRMACIÓN Y VENTANAS`); los tres `confirm()` reemplazados por `await confirmar({...})` (en `enviarmePrueba` y `enviarmePruebaArea`, antes de `conBotonBloqueado`, como hoy).
- En `DOMContentLoaded`: `#modal-confirmar-aceptar` clic → `cerrarConfirmacion(true)`; `#modal-confirmar-cancelar` clic → `cerrarConfirmacion(false)`; `#modal-confirmar` clic → `clicAfueraDeLaConfirmacion`; `#modal-nota` clic → `clicAfueraDeLaNota`; `document` `keydown` → `teclaEnPagina`.
- CSS: `#modal-nota` (`.nd-modal`) con radio 14px, bordes `--pf-linea` y título `--pf-tinta`, sin cambiar su contenido; `.co-confirmar` (ancho máximo 440px, texto 0.92rem, botones a la derecha). Con el foco dentro del iframe de la nota, Escape no llega a la página (aceptado, spec 14).

- [ ] **Step 4: Correr y verificar que pasan**

Run: `node --test tests/correos-frontend.test.js tests/paginas.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/correos.html public/js/correos.js tests/correos-frontend.test.js
git commit -m "feat: Correos: confirmaciones propias y el Ver se cierra con Escape o clic afuera"
```

---

### Task 7: CSS sin uso, documentación y suite completa

**Files:**
- Modify: `public/correos.html` (`<style>`), `tests/correos-frontend.test.js`, `README.md`, `CLAUDE.md`

- [ ] **Step 1: Escribir el test que falla**

`it('cada clase del <style> de correos.html se usa en la página o en correos.js')`: tomar el contenido del `<style>`, sacarle los `url(...)` y los comentarios, juntar las clases con `/\.([a-zA-Z][\w-]*)/g`, y verificar que cada una aparece como palabra (`new RegExp(`(^|[^\\w-])${clase}($|[^\\w-])`)`) en el resto de `correos.html` (fuera del `<style>`) o en `correos.js`. El mensaje del assert nombra la clase.

- [ ] **Step 2: Correr y verificar que falla**

Run: `node --test tests/correos-frontend.test.js`
Expected: FAIL nombrando clases viejas (por ejemplo `info-card`, `test-section`, `spinner-inline`, `smtp-card`).

- [ ] **Step 3: Borrar las reglas sin uso y actualizar la documentación**

- Borrar del `<style>` toda regla cuya clase ya no se use (`.smtp-card*`, `.smtp-status-row`, `.spinner-inline`, `.test-section*`, `.test-controls*`, `.info-card*`, `.nd-switch*`, `.nd-proximas`/`.nd-proxima`, `.nd-filtros`, `.nd-check`, `.nd-config*`, `.nd-acciones`, y lo que el test señale). Se quedan `.smtp-status*`, `.nd-alerta*`, `.nd-firma*`, `.nd-marco`, `.nd-modal`. Si `test-hint` sigue en uso (por ejemplo en `#modal-nota-datos`), su regla se queda o se reemplaza por `co-ayuda` en el marcado; sin cambios visibles.
- `README.md`: el comentario de `correos.html` en el árbol del proyecto pasa a `# Correos: Libro de Notas Digitales, Estado, Vista previa y pruebas, Configuración (pestañas)`.
- `CLAUDE.md`, sección Frontend, una línea: `` `correos.js`: pestañas Libro de Notas Digitales (la inicial), Estado, Vista previa y pruebas y Configuración (`#libro`, `#estado`, `#pruebas`, `#configuracion`); las alertas del Estado van arriba de las pestañas, con una marca en Estado. Como `perfil.js`, al cargarse solo declara (los tests lo cargan en un `vm`). ``

- [ ] **Step 4: Correr la suite completa**

Run: `docker compose up -d` (si no están arriba `rpad-db` y `rpad-mailpit`) y `npm test`
Expected: todos los tests pasan (`ℹ fail 0`).

- [ ] **Step 5: Commit**

```bash
git add public/correos.html tests/correos-frontend.test.js README.md CLAUDE.md
git commit -m "chore: Correos: CSS sin uso fuera y documentación de las pestañas"
```
