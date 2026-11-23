# El dato de la quincena: la jerarquía visual del detalle. Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En el detalle de una edición, la cifra clave en una ficha celeste con su rótulo (Propuestas y General), el título de la propuesta un poco más chico, los títulos de los campos en Bricolage y «Por qué es noticia» en lugar de «Por qué hoy» en la página, en «Copiar la propuesta» y en el mail.

**Architecture:** Dos cambios independientes. El servidor cambia un rótulo en `textoParaCopiar` y en la plantilla del mail (con el resguardo del mail ajustado solo en eso). La página cambia el marcado de la cifra (una función pura nueva), el rótulo del campo y el CSS de su `<style>`, y sube su versión.

**Tech Stack:** Node 22 (ES Modules), `node:test`, vanilla JS en la página (cargada en un `vm` por los tests).

**Spec:** `docs/superpowers/specs/2026-11-23-dato-quincena-detalle-visual-design.md`

## Global Constraints

- La clave `por_que_hoy` del JSON no cambia: es contrato con Datito. Cambia solo el rótulo que se muestra.
- El rótulo nuevo es exactamente «Por qué es noticia»; el de la ficha, exactamente «La cifra clave».
- Todo texto del servidor pasa por `esc` (`Utils.escapeHtml`) en la página.
- Repositorio público: en tests, fixtures, specs y commits, solo datos inventados; ningún nombre real ni texto de una edición real.
- `main.css` no cambia: el CSS va en el `<style>` de `public/dato-quincena.html`.
- Accesibilidad: 4,5:1 o más en todo texto (tinta #1A365D sobre cielo #DCEEF5 da 10,2:1), nada depende solo del color, sin scroll de costado desde 360 px.
- Documentos: se escribe lo vigente, un renglón por oración (`CLAUDE.md`, «Cómo se documenta»); `tests/documentos.test.js` controla los topes.
- Los tests de las tareas 1 y 2 son puros y se pueden correr sin el contenedor. La suite completa (`npm test`), solo con el turno del contenedor que da la coordinadora.

## Review Focus

- Una cifra larga sin espacios (un enlace pegado) en un teléfono de 360 px: no ensancha la página (la ficha y su texto llevan `overflow-wrap: anywhere`). Test del CSS en la tarea 2.
- Una cifra con HTML adentro: sale escapada en la ficha de Propuestas y en la de General. Test en la tarea 2.
- Alto contraste (`forced-colors`): sin fondo, la ficha se sigue viendo por el borde transparente que el sistema pinta. Test del CSS en la tarea 2.
- Los títulos de las tarjetas de Datasets nuevos (`h5`) y el de «Para validar antes de publicar» no cambian de letra. Test del CSS en la tarea 2.
- El mail de una edición sin `propuestas_datasets` cambia solo en el rótulo, una vez por propuesta, además de la frase y el recuadro de la principal del equipo. Test del resguardo en la tarea 1.

---

### Task 1: «Por qué es noticia» en lo que se copia y en el mail

**Files:**
- Modify: `services/datoQuincenaReglas.js` (`textoParaCopiar`, el bloque `Por qué hoy\n…`, cerca de la línea 955)
- Modify: `services/emailTemplates.js` (`campoDelDato('Por qué hoy', …)` cerca de la línea 976 y `` `Por qué hoy\n…` `` cerca de la 1171)
- Modify: `tests/dato-quincena-reglas.test.js` (líneas ~2209 y ~2271)
- Modify: `tests/fixtures/dato-quincena-respuestas.json` (las 13 apariciones de `Por qué hoy\n`, todas dentro de `para_copiar`)
- Modify: `tests/dato-quincena-correo-reglas.test.js` (líneas ~1428, ~1465 y ~1573)
- Modify: `tests/email-diseno.test.js` (la lista de títulos, línea ~858)
- Modify: `tests/dato-quincena-resguardo.test.js`
- Modify: `docs/temas/dato-quincena.md` («Lo que se copia»), `docs/temas/dato-quincena-correo.md` (línea ~154 y ~171-172), `docs/temas/dato-quincena-principal-equipo.md` (línea ~126), `docs/temas/dato-quincena-contrato.md` (línea ~212)

**Interfaces:**
- Consumes: nada.
- Produces: `para_copiar` de cada propuesta del detalle con el bloque `Por qué es noticia\n<por_que_hoy>`; la tarea 2 no lo lee (la página copia lo que manda el servidor).

- [ ] **Step 1: Cambiar lo esperado en los tests**

En `tests/dato-quincena-reglas.test.js`, `tests/dato-quincena-correo-reglas.test.js` y `tests/email-diseno.test.js`, cada `'Por qué hoy'` esperado pasa a `'Por qué es noticia'` (también el comentario de la línea ~1570 y el `includes` de la ~1573: `'…Dos.\n\nPor qué es noticia\n'`).
En el fixture, `Por qué hoy\\n` pasa a `Por qué es noticia\\n` en las 13 apariciones (y en ninguna otra parte).

En `tests/dato-quincena-resguardo.test.js`, el fixture sigue sin regenerarse. Sumar el cambio del rótulo a lo esperado:

```js
// El rótulo de `por_que_hoy` (spec 2026-11-23-dato-quincena-detalle-visual): una vez por propuesta (el fixture tiene dos), en el
// HTML y en el texto
const ROTULO_ANTES = 'Por qué hoy';
const ROTULO = 'Por qué es noticia';
const conElRotulo = (texto) => {
  assert.equal(texto.split(ROTULO_ANTES).length - 1, 2, 'el rótulo de antes, una vez por propuesta');
  return texto.split(ROTULO_ANTES).join(ROTULO);
};
```

`conLaPrincipal` devuelve `html` y `text` pasados además por `conElRotulo`; el test «sin la frase ni el recuadro en el modelo» compara contra `{ ...RESGUARDO[caso], html: conElRotulo(RESGUARDO[caso].html), text: conElRotulo(RESGUARDO[caso].text) }`.
Sumar al test de «la plantilla pone la frase…» que el mail no tiene `ROTULO_ANTES` y tiene `ROTULO` dos veces, en el HTML y en el texto.
El comentario de arriba del archivo suma el rótulo como el tercer cambio a propósito.

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `node --test tests/dato-quincena-reglas.test.js tests/dato-quincena-correo-reglas.test.js tests/email-diseno.test.js tests/dato-quincena-resguardo.test.js`
Expected: FAIL en los que esperan «Por qué es noticia» (el servidor todavía dice «Por qué hoy»).

- [ ] **Step 3: Cambiar el rótulo en el servidor**

`textoParaCopiar`: `` `Por qué es noticia\n${propuesta.por_que_hoy}` ``.
`emailTemplates.js`: `campoDelDato('Por qué es noticia', …)` y `` `Por qué es noticia\n${textoDelDato(propuesta?.por_que_hoy)}` ``.
Nada más del mail cambia.

- [ ] **Step 4: Correr los tests y ver que pasan**

Run: el mismo comando del paso 2.
Expected: PASS, 0 fallas.

- [ ] **Step 5: Los documentos**

- `dato-quincena.md`, «Lo que se copia»: el campo `por_que_hoy` va con el título «Por qué es noticia» (la clave del JSON sigue siendo `por_que_hoy`, que es contrato con Datito).
- `dato-quincena-correo.md`: en la línea de los campos de la tarjeta, «Por qué es noticia» en lugar de «por qué hoy»; en lo del resguardo, el fixture con las dos inserciones y el rótulo de `por_que_hoy`.
- `dato-quincena-principal-equipo.md` (línea ~126) y `dato-quincena-contrato.md` (línea ~212): el resguardo compara con las dos inserciones y el rótulo «Por qué es noticia».

Run: `node --test tests/documentos.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/datoQuincenaReglas.js services/emailTemplates.js tests/dato-quincena-reglas.test.js tests/fixtures/dato-quincena-respuestas.json tests/dato-quincena-correo-reglas.test.js tests/email-diseno.test.js tests/dato-quincena-resguardo.test.js docs/temas/dato-quincena.md docs/temas/dato-quincena-correo.md docs/temas/dato-quincena-principal-equipo.md docs/temas/dato-quincena-contrato.md
git commit -m "feat(dato-quincena): «Por qué es noticia» en lo que se copia y en el mail"
```

---

### Task 2: La ficha de la cifra clave, el título y los campos en la página

**Files:**
- Modify: `public/js/dato-quincena.js` (`htmlDePropuesta`, `htmlDeLaPrincipal`, una constante y una función pura nuevas)
- Modify: `public/dato-quincena.html` (el `<style>` y el `?v=` de `dato-quincena.js`)
- Modify: `tests/dato-quincena-frontend.test.js`
- Modify: `tests/paginas.test.js` (`VERSION_DATO_QUINCENA`)
- Modify: `docs/temas/dato-quincena.md` («La página»)

**Interfaces:**
- Consumes: nada de la tarea 1.
- Produces: `TEXTO_CIFRA_CLAVE = 'La cifra clave'` y `htmlDeLaCifra(texto, clase) → string` en `dato-quincena.js` (puros, declarados con `const`, sin nombres repetidos con `main.js`, `api.js` ni `auth.js`).

- [ ] **Step 1: Los tests de la ficha, el rótulo y el CSS**

En `tests/dato-quincena-frontend.test.js`:

- Los cuatro `<p class="dq-cifra">…</p>` y `<p class="dq-principal-cifra">…</p>` esperados (líneas ~714, ~978, ~1085 y la pieza de ~1199) pasan a la ficha:
  `<div class="dq-cifra"><p class="dq-cifra-rotulo">La cifra clave</p><p class="dq-cifra-texto">${esc('1.234 casos · septiembre de 2026')}</p></div>` y lo mismo con `dq-principal-cifra` (en la de XSS, `${XSS_ESCAPADO}`; en la pieza del orden, `'<div class="dq-cifra"><p class="dq-cifra-rotulo">'`).
- `'Por qué hoy'` pasa a `'Por qué es noticia'` en la lista de títulos (~823), en la expresión de las dos columnas (~830) y en las piezas del orden (~1200).
- Un test nuevo, `'la cifra clave en una ficha con su rótulo, en Propuestas y en General, escapada'`:
  `ctx.htmlDeLaCifra(XSS, 'dq-cifra')` es exactamente `<div class="dq-cifra"><p class="dq-cifra-rotulo">La cifra clave</p><p class="dq-cifra-texto">${XSS_ESCAPADO}</p></div>`;
  `ctx.TEXTO_CIFRA_CLAVE === 'La cifra clave'`;
  el HTML de una propuesta y el panel General tienen cada uno una sola vez `class="dq-cifra-rotulo"` y ninguno tiene `<p class="dq-cifra">` ni `<p class="dq-principal-cifra">`.
- Un test nuevo del CSS, `'el CSS de la ficha, del título y de los campos (spec 2026-11-23-dato-quincena-detalle-visual)'`, sobre el `<style>`:
  - `/\.dq-cifra, \.dq-principal-cifra \{[^}]*border: 1px solid transparent;[^}]*border-radius: 12px; background: var\(--sg-cielo\); color: var\(--sg-tinta\);[^}]*overflow-wrap: anywhere;/`;
  - `/\.dq-cifra-texto \{[^}]*font-family: var\(--f-titulo\); font-weight: 700; font-size: clamp\(1\.12rem, 1rem \+ 0\.4vw, 1\.3rem\);[^}]*overflow-wrap: anywhere;/`;
  - `/\.dq-cifra-rotulo \{[^}]*font-size: 0\.8rem; font-weight: 700;/`;
  - `/\.dq-prop-titulo \{[^}]*font-size: clamp\(1\.45rem, 1\.15rem \+ 0\.95vw, 1\.9rem\);/`;
  - `/\.dq-campo h4, \.dq-redes-cabeza h4, \.dq-borrador-cabeza h4 \{[^}]*font-family: var\(--f-titulo\); font-size: 1\.05rem; font-weight: 700;/`;
  - `/\.dq-campo h5 \{[^}]*font-family: var\(--f-texto\); font-size: 0\.88rem;/` (Datasets nuevos no cambia);
  - `/\.dq-validar h4, \.dq-validar h5 \{[^}]*font-family: var\(--f-texto\);/` (sigue como estaba);
  - en `@media (max-width: 640px)`: `.dq-prop-titulo { font-size: 1.4rem; }` y `.dq-cifra-texto, .dq-principal-cifra .dq-cifra-texto { font-size: 1.08rem; }`;
  - ya no está `font-weight: 800; font-size: clamp(1.55rem, 1.2rem + 1vw, 2rem)` (la cifra grande de antes) ni `.dq-prop-titulo, .dq-cifra { font-size: 1.5rem; }`.
- En la lista de clases del CSS del detalle (~2387), sumar `'dq-cifra-rotulo'` y `'dq-cifra-texto'`.

En `tests/paginas.test.js`: `const VERSION_DATO_QUINCENA = '20261237';`.

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `node --test tests/dato-quincena-frontend.test.js tests/paginas.test.js`
Expected: FAIL (la ficha no existe, «Por qué hoy», el CSS de antes y el `?v=20261236`).

- [ ] **Step 3: La ficha y el rótulo en `dato-quincena.js`**

- Junto a `TEXTO_TODAS_LAS_EDICIONES`: `const TEXTO_CIFRA_CLAVE = 'La cifra clave';`, con un comentario: es un rótulo fijo de la página, como «Ángulo».
- Junto a `htmlDeTexto`: `const htmlDeLaCifra = (texto, clase) => …`, que arma `<div class="${clase}"><p class="dq-cifra-rotulo">${TEXTO_CIFRA_CLAVE}</p><p class="dq-cifra-texto">${esc(texto)}</p></div>`; `clase` es siempre un literal de la página (`'dq-cifra'` o `'dq-principal-cifra'`).
- `htmlDePropuesta` usa `htmlDeLaCifra(p.cifra_clave, 'dq-cifra')`; `htmlDeLaPrincipal`, `htmlDeLaCifra(principal.cifra_clave, 'dq-principal-cifra')`.
- `htmlDeCampoDeLaPropuesta('Por qué es noticia', …)`, y los comentarios que dicen «Por qué hoy» o «la cifra destacada» dicen lo nuevo.

- [ ] **Step 4: El CSS en el `<style>` de `dato-quincena.html`**

Reemplazar las reglas `.dq-principal-cifra` y `.dq-cifra` de ahora (filete arriba y Bricolage 800 grande) por:

```css
/* La cifra clave (spec 2026-11-23-dato-quincena-detalle-visual): una ficha celeste con su rótulo, distinta del título, en Propuestas y
   en General. Tinta sobre cielo, 10,2:1. El borde transparente lo pinta el sistema en alto contraste: la ficha no depende del fondo */
.dq-cifra, .dq-principal-cifra { margin: 18px 0 0; padding: 14px 20px 16px; border: 1px solid transparent; border-radius: 12px; background: var(--sg-cielo); color: var(--sg-tinta); overflow-wrap: anywhere; }
.dq-principal-cifra { margin-top: 16px; padding: 12px 18px 14px; }
.dq-cifra-rotulo { margin: 0 0 4px; font-size: 0.8rem; font-weight: 700; line-height: 1.3; color: var(--sg-tinta); }
.dq-cifra-texto { margin: 0; font-family: var(--f-titulo); font-weight: 700; font-size: clamp(1.12rem, 1rem + 0.4vw, 1.3rem); line-height: 1.32; letter-spacing: -0.012em; color: var(--sg-tinta); text-wrap: pretty; overflow-wrap: anywhere; }
.dq-principal-cifra .dq-cifra-texto { font-size: 1.1rem; }
```

- `.dq-prop-titulo`: `font-size: clamp(1.45rem, 1.15rem + 0.95vw, 1.9rem)` (el resto de la regla igual).
- Partir `.dq-campo h4, .dq-campo h5, .dq-redes-cabeza h4, .dq-borrador-cabeza h4 { … }` en dos:
  `.dq-campo h5 { margin: 0; font-family: var(--f-texto); font-size: 0.88rem; font-weight: 700; letter-spacing: 0; color: var(--sg-tinta); }` (igual que hoy) y
  `.dq-campo h4, .dq-redes-cabeza h4, .dq-borrador-cabeza h4 { margin: 0; font-family: var(--f-titulo); font-size: 1.05rem; font-weight: 700; letter-spacing: -0.008em; line-height: 1.3; color: var(--sg-tinta); }`;
  `.dq-campo h4 { margin-bottom: 6px; }`.
- En `@media (max-width: 640px)`: sacar `.dq-principal-cifra { font-size: 1.5rem; }` y `.dq-prop-titulo, .dq-cifra { font-size: 1.5rem; }`; poner `.dq-prop-titulo { font-size: 1.4rem; }`, `.dq-cifra, .dq-principal-cifra { padding: 12px 16px 14px; }` y `.dq-cifra-texto, .dq-principal-cifra .dq-cifra-texto { font-size: 1.08rem; }`.
- El comentario de las dos columnas dice «Por qué es noticia».
- `<script src="js/dato-quincena.js?v=20261237"></script>`.

- [ ] **Step 5: Correr los tests y ver que pasan**

Run: `node --test tests/dato-quincena-frontend.test.js tests/paginas.test.js`
Expected: PASS, 0 fallas.

- [ ] **Step 6: Mirarla en el navegador**

Con la maqueta de `~/rpad-notas/dq-detalle-visual/web/` (copiando encima los `dato-quincena.html` y `dato-quincena.js` de la rama, sin las cuatro líneas MAQUETA de la página y sin `css/maqueta.css`), la edición 25 en Propuestas y en General a 360, 390, 768 y 1280 px:
la ficha con su rótulo, el título más grande que la cifra, los títulos de los campos en Bricolage y `document.documentElement.scrollWidth === innerWidth` en todos los anchos.

- [ ] **Step 7: El documento**

`docs/temas/dato-quincena.md`, «La página»:
- General: la cifra de la principal de Datito va en la ficha celeste con «La cifra clave», no grande.
- La propuesta que se ve: el título y, debajo, la cifra en una ficha celeste (`htmlDeLaCifra`), con el rótulo «La cifra clave» (texto fijo de la página) y el borde transparente para alto contraste; «Por qué es noticia» en lugar de «Por qué hoy»; los títulos de los campos en Bricolage, y los de Datasets nuevos en Figtree.
- Decisión, con su motivo: la cifra va en una ficha y más chica que el título porque los dos son oraciones largas y, del mismo tamaño, no se distinguían (lo eligió el usuario entre tres maquetas).

Run: `node --test tests/documentos.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add public/js/dato-quincena.js public/dato-quincena.html tests/dato-quincena-frontend.test.js tests/paginas.test.js docs/temas/dato-quincena.md
git commit -m "feat(dato-quincena): la cifra clave en una ficha celeste, el título y los campos"
```

---

### Task 3: El kit (fuera del repo, después del merge)

**Files:**
- Create: `~/rpad-kits/RPAD-deploy-dato-quincena-detalle-visual/` con `PASOS.txt`, `archivos-dato-quincena-detalle-visual/` y su `.zip`, y `vuelta-atras/archivos-anteriores/` y su `.zip`.

**Interfaces:**
- Consumes: el merge en main (el `HEAD`) y la base de producción, 1f81139.

- [ ] **Step 1: Armar las carpetas**

`archivos-dato-quincena-detalle-visual/`: los cuatro archivos de código del diff `1f81139..main`, con su ruta (`public/dato-quincena.html`, `public/js/dato-quincena.js`, `services/datoQuincenaReglas.js`, `services/emailTemplates.js`), sacados con `git show main:<ruta>`.
`vuelta-atras/archivos-anteriores/`: los mismos cuatro, de `1f81139`.
Cada `.zip`, sin carpeta raíz (las rutas empiezan en `public/` y `services/`).

- [ ] **Step 2: `PASOS.txt`, con el formato de los kits anteriores (sin tildes)**

- Que cambia: la cifra clave en una ficha celeste con «La cifra clave» en Propuestas y en General, el titulo de la propuesta un poco mas chico, los titulos de los campos mas marcados y «Por que es noticia» en la pagina, en «Copiar la propuesta» y en el mail.
- Base 1f81139 y el commit de main; 4 archivos, sin SQL, sin npm, sin variables, sin Tareas Cron, con Restart.
- Probado: la suite completa (los numeros reales) y la revision con Fable 5.2.
- CUANDO: el martes 24/11 desde las 14:10 (no antes de las 8:10, por el primer correo real de las 8:05; desde las 14:10, el reintento de las 14:00 sale igual que el primero); fuera de las horas en punto y a y media y de las rutinas de Datito (viernes a las 10:00 y a las 11:30).
- PASOS: 0) Ctrl+U en Herramientas -> El dato de la quincena: `dato-quincena.js?v=20261236`; si dice otra cosa, PARAR y avisar. 1) Subir el zip a la raiz de la app, extraer reemplazando y borrar el zip. 2) Restart. 3) Mirar: `?v=20261237`, la edicion del 23/11 en Propuestas y en General, «Por que es noticia», y «Copiar la propuesta» pegado en un texto.
- VUELTA ATRAS: el zip de `vuelta-atras`, extraer reemplazando y Restart; deja `?v=20261236`. Nada para avisarle a Datito.

- [ ] **Step 3: Controlar el kit**

Run: `python3 -I ~/rpad-notas/control-kit.py ~/rpad-kits/RPAD-deploy-dato-quincena-detalle-visual dato-quincena-detalle-visual 1f81139 main`
Expected: 4 de código, «igual a lo esperado: True» en el kit y en la vuelta atrás, los zip iguales a sus carpetas, ningún archivo distinto, 0 palabras en lo agregado y en los mensajes, sin binarios.

---

## Cierre (lo hace la sesión, no un implementador)

- Suite completa antes (en main 1f81139) y después (en la rama), con el turno del contenedor.
- Revisión final de la rama con Fable 5.2, esfuerzo alto; arreglos y su re-revisión si hacen falta.
- Merge en main y push; después el kit (tarea 3) y el aviso TODO EN VERDE a la coordinadora.
