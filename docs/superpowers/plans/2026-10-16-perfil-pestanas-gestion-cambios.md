# Mi Perfil en pestañas y Gestión de Cambios rediseñada: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mi Perfil se reorganiza en pestañas (Para revisar, Mis cambios, Mis datos, Mi firma). La Gestión de Cambios se revisa y se resuelve en filas que se despliegan, con un "control de cambios" de tachado y resaltado. Las reglas de la doble verificación no se tocan.

**Architecture:** Cuatro tareas.
1. El servidor agrega datos de solo lectura a las dos listas de cambios (comparación, nombres de catálogo, permiso de auditoría) y arregla la comparación de fechas.
2. Funciones puras de presentación en `perfil.js`, probadas en `vm`.
3. La estructura de pestañas de la página, todavía con la lista vieja adentro.
4. La nueva Gestión de Cambios, que reemplaza tarjetas y modales.

**Tech Stack:** Node 22, Express, ES Modules, MariaDB (mysql2), vanilla JS sin frameworks, `node:test` (`npm test`, que necesita `docker compose up -d` y `RPAD_TESTS_DB_LOCAL=1`).

**Spec:** `docs/superpowers/specs/2026-10-16-perfil-pestanas-gestion-cambios-design.md`. El mockup de referencia es `docs/superpowers/specs/2026-10-16-perfil-pestanas-mockup.html`, con datos inventados; el spec manda sobre el mockup.

## Global Constraints

- No romper nada: la suite completa (`npm test`) verde al final de cada tarea. La doble verificación (quién puede aprobar o rechazar, el respaldo del editor, los bloqueos) no cambia.
- `tests/perfil-frontend.test.js` carga `public/js/perfil.js` en un `vm`:
  - El `document` falso solo tiene `addEventListener` y `getElementById`, y no existen `window`, `location` ni `localStorage`. El archivo, al cargarse, solo declara cosas y registra `DOMContentLoaded`.
  - Conservan nombre, firma y comportamiento probado:
    - `botonesDeAuditoria(id, permiso)`: con `puede: true` contiene `onclick="aprobarCambio(<id>)"` y `abrirModalRechazo(<id>)`, sin `disabled`. Sin permiso tiene exactamente 2 `disabled`, `title="<mensaje>"` y no contiene `aprobarCambio|abrirModalRechazo|undefined|null`.
    - `avisoNoCorresponde`: escapa el mensaje.
    - `permisoDeAuditoria`: falla cerrado.
    - `textoRevisor`.
    - `muestraDeFirma`, `actualizarMuestraFirma`, `cargarPerfil` y `RENGLON_FIRMA_CONTRATADO`.
- En `public/perfil.html` siguen tal cual:
  - `id="firma-nombre" class="form-input" maxlength="150" placeholder="Ej.: Nombre Apellido"`;
  - `<div id="firma-muestra" class="firma-muestra" hidden></div>`;
  - las reglas `.firma-muestra-chico` y `.firma-muestra-renglon` con `font-size` en `rem`, dentro del `<style>`;
  - en ningún lado dice "Téc.";
  - un único `href="usuarios.html"` en todo el archivo.
- `auth.js`, `main.js` y `api.js` siguen en `?v=20261023`. `main.js`, `main.css` y las otras páginas no se tocan. `perfil.js` pasa a `?v=20261031`.
- `GET /cambios-pendientes/:id` sigue devolviendo `auditoria` exactamente `{ puede, respaldo, mensaje }`. Su única diferencia es la de las fechas (Task 1).
- Todo dato que se muestra pasa por `Utils.escapeHtml`, y todo link por `Utils.safeUrl`. Sin emojis ni mayúsculas sostenidas en la UI. Español.
- Estilos nuevos solo en el `<style>` de `perfil.html`, con prefijo `pf-`. Los tokens son los de la tabla de la sección 7 del spec.
- Sin dependencias nuevas, sin SQL, sin migración.
- Commits en español con el formato del repo (`feat: …`, `fix: …`, `test: …`, `docs: …`), terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No hacer push.
- Nunca matar procesos por nombre (`taskkill /IM node.exe` y similares están prohibidos).

## Review Focus

1. Una descripción enorme (miles de palabras) no puede congelar la página. `diffPalabras` usa un tope y cae al reemplazo entero (Task 2, test "texto enorme").
2. Comillas, `<` o `&` en títulos, valores, motivos y nombres salen escapados en la fila, el resumen y la comparación (Task 2, test de escape del resumen; Task 4, test de escape de la fila).
3. Un cambio que otra persona resolvió mientras la lista estaba abierta: aprobar devuelve 404. Se muestra el mensaje y la lista se recarga, sin quedar colgada (Task 4, verificación manual paso 5).
4. Un hash de una pestaña que el rol no ve (un lector con `#para-revisar`, o `#cualquiera`) cae en la pestaña por defecto del rol (Task 2, tests de `pestanaInicial`).
5. Una lista que no trae `auditoria` (o una vieja en caché) no habilita botones ni muestra marcas: falla cerrado (Task 2, test de `marcaDeAuditoria` sin `auditoria`; los tests existentes de `permisoDeAuditoria`).

---

### Task 1: Servidor: listas con la comparación, fechas comparadas por día y enlace del email

**Files:**
- Modify: `controllers/cambiosPendientesController.js` (`calcularCambios` :54-117, `getCambiosPendientesParaRevisar` :150-206, `getMisCambios` :211-254, `getCambioPendienteById` :259-329)
- Modify: `services/emailTemplates.js:288`
- Create: `tests/cambios-listas-api.test.js`
- Modify: `tests/email-diseno.test.js`

**Interfaces:**
- Produces: cada elemento de `GET /cambios-pendientes/para-revisar` y `GET /cambios-pendientes/mis-cambios` trae, además de lo de hoy:
  - `dataset_url` (de `d.url_dataset`, o `null`);
  - `datos_nuevos` y `datos_anteriores` enriquecidos con `enriquecerDatos`: conservan los IDs y suman `area_nombre`, `frecuencia_nombre`, `tema_principal_nombre`, `tema_secundario_nombre` y `formatos_nombres`;
  - `campos_modificados`: `[{ campo, antes, despues }]` si es `editar`, si no `null`;
  - **solo en para-revisar**, `auditoria: { puede: boolean, respaldo: boolean, mensaje: string|null, auditan: string[] }`.
- Produces: `calcularCambios` compara `ultima_actualizacion` y `proxima_actualizacion` por sus primeros 10 caracteres. Los valores devueltos no cambian.

- [ ] **Step 1: Escribir los tests que fallan** en `tests/cambios-listas-api.test.js`. Usar el mismo andamiaje que `tests/auditoria-api.test.js`:
  - `crearBaseDePrueba('rpad_test_cambios_listas')`, `iniciarServidor` y `crearUsuariosPrueba(api, { adminA: 'admin', adminB: 'admin', superadmin: 'superadmin', editor: 'editor' })`. Los nombres que quedan son `Test adminA`, etc.
  - `limpiarBase()`, borrar `cambios_pendientes` y `usuarios_licencias` en `beforeEach`.
  - Los cambios se insertan directo en `cambios_pendientes`, como `proponerBaja`.

  Tests:
  - `para-revisar trae la comparación, los nombres de catálogo y la URL, igual que el detalle`:
    - Insertar un `editar` de adminA sobre un dataset de `crearDataset`. `datos_anteriores`: `{"titulo":"Viejo","area_id":<id real de areas>,"observaciones":null}`. `datos_nuevos`: `{"titulo":"Nuevo","area_id":<mismo>,"observaciones":"Obs nueva"}`.
    - Como adminB, el elemento de `GET /cambios-pendientes/para-revisar` cumple:
      - `campos_modificados` es `deepEqual` al de `GET /cambios-pendientes/:id` y vale `[{campo:'Titulo',antes:'Viejo',despues:'Nuevo'},{campo:'Observaciones',antes:'-',despues:'Obs nueva'}]`;
      - `datos_nuevos.area_nombre` es el nombre de esa área;
      - `'dataset_url' in elemento`.
  - `mis-cambios trae lo mismo y no trae auditoria`:
    - Como adminA, el mismo `campos_modificados`, `datos_nuevos.area_nombre` definido y `!('auditoria' in elemento)`.
  - `crear y eliminar traen campos_modificados null`:
    - Un `crear` y un `eliminar` en la lista, con `campos_modificados === null`.
  - `auditoria en la lista: el mismo permiso que el detalle, con quiénes lo auditan`:
    - Para un cambio pendiente de adminA, el elemento de la lista da:
      - para editor: `{ puede:false, respaldo:false, mensaje:'Este cambio lo auditan Test adminB y Test superadmin. Podés auditarlo solo si ninguno está disponible.', auditan:['Test adminB','Test superadmin'] }`;
      - para adminB: `{ puede:true, respaldo:false, mensaje:null, auditan:['Test adminB','Test superadmin'] }`.
    - Con adminB y superadmin de licencia hoy (como `deLicenciaHoy`), para editor: `{ puede:true, respaldo:true, mensaje:null, auditan:[] }`.
    - Ya aprobado, con `?estado=todos`: `{ puede:false, respaldo:false, mensaje:null, auditan:[] }`.
    - En todos los casos, `GET /:id` trae `auditoria` con exactamente las claves `['mensaje','puede','respaldo']` (ordenadas).
  - `una fecha con hora y la misma sin hora no figura como cambio; un día distinto sí`:
    - `editar` con `datos_anteriores` `{"titulo":"X","ultima_actualizacion":"2026-03-13T03:00:00.000Z","proxima_actualizacion":"2026-05-31T03:00:00.000Z"}` y `datos_nuevos` `{"titulo":"X","ultima_actualizacion":"2026-03-20","proxima_actualizacion":"2026-05-31"}`.
    - `GET /:id` da `campos_modificados` `deepEqual` `[{campo:'Ultima Actualizacion',antes:'2026-03-13T03:00:00.000Z',despues:'2026-03-20'}]`.

  En `tests/email-diseno.test.js`, un `it` nuevo: `el botón del recordatorio de cambios lleva a Para revisar`. Verifica que `cambiosPendientesTemplate([{ tipo_cambio:'editar', dataset_titulo:'X', usuario_nombre:'Y' }]).html` contiene `/perfil.html#para-revisar"`.

- [ ] **Step 2: Correr y ver que fallan**

  Run: `node --test --test-concurrency=1 tests/cambios-listas-api.test.js tests/email-diseno.test.js`
  Expected: FAIL. No está `area_nombre` ni `auditoria` en la lista, la fecha del mismo día aparece en `campos_modificados` y el botón no tiene `#para-revisar`.

- [ ] **Step 3: Implementar en `controllers/cambiosPendientesController.js`**
  - `calcularCambios`:
    - La comparación usa `const comparable = (key, texto) => CAMPOS_DE_FECHA.includes(key) ? texto.slice(0, 10) : texto`, con `CAMPOS_DE_FECHA = ['ultima_actualizacion', 'proxima_actualizacion']`.
    - Se compara `comparable(campo.key, antesStr) !== comparable(campo.key, despuesStr)`.
    - Lo que se empuja (`antesStr || '-'`, `despuesStr || '-'`) no cambia.
    - Comentario con la referencia a `valorComparable` de `services/notasDigitalesContenido.js`.
  - Helper `const detallarCambio = (fila, catalogos) => ({ ...fila, datos_nuevos, datos_anteriores, campos_modificados })`:
    - parsea el JSON si viene como texto;
    - enriquece con `enriquecerDatos`;
    - calcula `campos_modificados` solo para `editar` con ambos datos; si no, `null`.
  - `getCambioPendienteById` lo usa. Su respuesta queda igual: `auditoria` se arma como hoy, sin `auditan`.
  - En las dos listas:
    - Agregar `d.url_dataset as dataset_url` al `SELECT`.
    - `catalogosParaAuditoria()` una sola vez por pedido.
    - Mapear con `detallarCambio`.
  - En `getCambiosPendientesParaRevisar`:
    - Si hay alguna fila pendiente, `personasDeAuditoria(hoyArgentina())` una sola vez.
    - Cada fila lleva `auditoria`:
      - si no está pendiente: `{ puede:false, respaldo:false, mensaje:null, auditan:[] }`;
      - si no: `{ respaldo:false, mensaje:null, ...permisoParaAuditar({ id:req.user.userId, rol:req.user.rol }, fila.usuario_id, personas), auditan }`.
    - `auditan`: con `const q = quienesAuditan(personas, fila.usuario_id)`, es `q.respaldo ? [] : q.personas.map(p => p.nombre_completo)`.
    - Importar `quienesAuditan` de `services/auditoriaReglas.js`.
  - En `services/emailTemplates.js:288`: `url: \`${RPAD_URL}/perfil.html#para-revisar\``.

- [ ] **Step 4: Correr los tests y la suite**

  Run: `node --test --test-concurrency=1 tests/cambios-listas-api.test.js tests/email-diseno.test.js tests/auditoria-api.test.js tests/doble-verificacion.test.js`
  Expected: PASS.

  Run: `npm test`
  Expected: todo verde (el resumen `ℹ fail 0`).

- [ ] **Step 5: Commit**

  ```bash
  git add controllers/cambiosPendientesController.js services/emailTemplates.js tests/cambios-listas-api.test.js tests/email-diseno.test.js
  git commit -m "feat: cambios pendientes: las listas traen la comparación y el permiso de auditoría, y las fechas se comparan por día"
  ```

---

### Task 2: Funciones puras de presentación de un cambio (`perfil.js`)

**Files:**
- Modify: `public/js/perfil.js`. Sección nueva `// GESTIÓN DE CAMBIOS: PRESENTACIÓN`, solo funciones y constantes, sin tocar el DOM.
- Modify: `tests/perfil-frontend.test.js`. Bloques `describe` nuevos con el mismo cargador `vm`; agregar al `Utils` falso `safeUrl: (u) => /^https?:\/\//.test(u ?? '') ? u : null`.

**Interfaces:**
- Consumes: la forma de un cambio de la Task 1: `tipo_cambio`, `estado`, `datos_nuevos`/`datos_anteriores` enriquecidos, `campos_modificados`, `dataset_titulo`, `auditoria` con `auditan`. También `formatearFechaComparador(valor)` y `formatearValor(valor)`, que ya existen en `perfil.js`.
- Produces (globales del script; las usan las Tasks 3 y 4):
  - `ETIQUETAS_DE_CAMPO`: objeto con las etiquetas del servidor y las de mostrar:
    - `Titulo`→`Título`
    - `Descripcion`→`Descripción`
    - `Area Responsable`→`Área responsable`
    - `Tema Principal`→`Tema principal`
    - `Tema Secundario`→`Tema secundario`
    - `Tipo de Gestion`→`Tipo de gestión`
    - `Ultima Actualizacion`→`Última actualización`
    - `Proxima Actualizacion`→`Próxima actualización`
    - `URL en Portal`→`URL en el portal`
  - `etiquetaDeCampo(campo: string): string`: la del mapa, o la misma si no está.
  - `CAMPOS_LARGOS = ['Descripcion', 'Observaciones', 'Qué se solicita']`: las etiquetas del servidor que se comparan palabra por palabra.
  - `textoDeValor(valor): string`:
    - `''` para `null`, `undefined`, `''` o `'-'`;
    - una fecha ISO (`AAAA-MM-DD` con o sin hora) como `dd/mm/aaaa`, con `formatearFechaComparador`;
    - si no, `formatearValor(valor)`.
  - `diffPalabras(antes: string, despues: string): Array<{ tipo: '='|'-'|'+', texto: string }>`.
  - `htmlDeDiff(segmentos): string`: `=` escapado tal cual, `-` como `<del>…</del>` y `+` como `<ins>…</ins>`, todo escapado.
  - `listaDeNombres(nombres: string[]): string`: `''`, `'A'`, `'A y B'`, `'A, B y C'`.
  - `tituloDelCambio(cambio): string`:
    - en `crear`, `datos_nuevos?.titulo`;
    - si no, `dataset_titulo`, después `datos_anteriores?.titulo`, después `datos_nuevos?.titulo`;
    - si no hay ninguno, `'Dataset'`.
  - `resumenDelCambio(cambio): string`: HTML escapado.
  - `marcaDeAuditoria(cambio, esEditor: boolean): string`: HTML.
  - `pestanaInicial(hash: string, esAdmin: boolean): 'para-revisar'|'mis-cambios'|'mis-datos'|'mi-firma'`.
  - `estaDemorado(fecha, ahora = Date.now()): boolean`: si pasaron más de 2 días (172 800 000 ms).

- [ ] **Step 1: Escribir los tests que fallan** en `tests/perfil-frontend.test.js`:
  - `etiquetas con tilde y valores para mostrar`:
    - `etiquetaDeCampo('Proxima Actualizacion') === 'Próxima actualización'` y `etiquetaDeCampo('Frecuencia') === 'Frecuencia'`.
    - `textoDeValor('-') === ''`, `textoDeValor(null) === ''`.
    - `textoDeValor('2026-07-31T03:00:00.000Z') === '31/07/2026'`, `textoDeValor('2026-07-31') === '31/07/2026'`.
    - `textoDeValor('Anualmente') === 'Anualmente'`.
  - `comparación palabra por palabra`. Comparar los arreglos con `JSON.parse(JSON.stringify(...))`, porque vienen de otro contexto `vm`:
    - `diffPalabras('a b c', 'a x c')` → `[{tipo:'=',texto:'a '},{tipo:'-',texto:'b'},{tipo:'+',texto:'x'},{tipo:'=',texto:' c'}]`.
    - `diffPalabras('uno dos', 'uno dos tres')` → `[{tipo:'=',texto:'uno dos'},{tipo:'+',texto:' tres'}]`.
    - `diffPalabras('uno dos tres', 'uno tres')` → `[{tipo:'=',texto:'uno '},{tipo:'-',texto:'dos '},{tipo:'=',texto:'tres'}]`.
    - `diffPalabras('', 'texto nuevo')` → `[{tipo:'+',texto:'texto nuevo'}]`.
    - `diffPalabras('viejo', '')` → `[{tipo:'-',texto:'viejo'}]`.
    - Puntuación: `diffPalabras('corte semestral.', 'corte trimestral.')` contiene `{tipo:'-',texto:'semestral'}` y `{tipo:'+',texto:'trimestral'}`, y el último segmento es `{tipo:'=',texto:'.'}`.
    - Texto enorme: con `antes` y `despues` de 3000 palabras distintas cada uno, devuelve en menos de 500 ms exactamente `[{tipo:'-',texto:antes},{tipo:'+',texto:despues}]`.
    - `htmlDeDiff([{tipo:'=',texto:'a <b> '},{tipo:'-',texto:'x'},{tipo:'+',texto:'y'}])` → `'a &lt;b&gt; <del>x</del><ins>y</ins>'`.
  - `resumen de la fila cerrada`:
    - `editar` con `[{campo:'Frecuencia',antes:'Anualmente',despues:'Cada medio año'}]` → `'<b>Frecuencia</b> de Anualmente a Cada medio año'`.
    - El mismo más un segundo campo → termina en `', y 1 campo más'`. Con tres campos → `', y 2 campos más'`.
    - `editar` con `[{campo:'Descripcion',antes:'a',despues:'b'},{campo:'Observaciones',antes:'-',despues:'c'}]` → `'Cambia <b>Descripción</b> y <b>Observaciones</b>'`. Con un tercer campo `Titulo` → `'Cambia <b>Descripción</b>, <b>Observaciones</b> y 1 más'`.
    - Fechas: `[{campo:'Proxima Actualizacion',antes:'2026-07-31T03:00:00.000Z',despues:'2027-01-31'}]` → `'<b>Próxima actualización</b> de 31/07/2026 a 31/01/2027'`.
    - Vacío: `[{campo:'Tema Secundario',antes:'-',despues:'Salud'}]` → `'<b>Tema secundario</b> de vacío a Salud'`.
    - Valor largo: un valor corto de más de 40 caracteres pasa al formato "Cambia <b>…</b>".
    - Escape: `[{campo:'Titulo',antes:'<i>a</i>',despues:'b'}]` contiene `&lt;i&gt;a&lt;/i&gt;` y no contiene `<i>`.
    - `editar` con `campos_modificados` `[]` o `null` → `'Sin cambios en los campos principales'`.
    - `crear` con `datos_nuevos: { area_nombre:'Ambiente', frecuencia_nombre:'Anualmente' }` → `'Dataset nuevo de Ambiente, anualmente'`. Sin área ni frecuencia → `'Dataset nuevo'`.
    - `eliminar` → `'Se quita del registro'`.
  - `marca del editor`:
    - `marcaDeAuditoria({estado:'pendiente',auditoria:{puede:true,respaldo:true,auditan:[]}}, true)` contiene `Podés auditarlo de respaldo`.
    - Con `{puede:false,respaldo:false,auditan:['Ana','Pablo','Laura']}` contiene `Lo auditan Ana, Pablo y Laura`.
    - Con `esEditor` `false` → `''`. Sin `auditoria` → `''`. Con `estado:'aprobado'` → `''`.
    - Los nombres van escapados.
  - `pestaña inicial según rol y hash`:
    - `pestanaInicial('', true) === 'para-revisar'`.
    - `pestanaInicial('#mis-cambios', true) === 'mis-cambios'`.
    - `pestanaInicial('mi-firma', true) === 'mi-firma'`.
    - `pestanaInicial('#cualquiera', true) === 'para-revisar'`.
    - `pestanaInicial('', false) === 'mis-datos'`.
    - `pestanaInicial('#para-revisar', false) === 'mis-datos'`.
    - `pestanaInicial('#mi-firma', false) === 'mis-datos'`.
  - `demora`: con `ahora = Date.parse('2026-10-16T12:00:00Z')`, `estaDemorado('2026-10-14T11:00:00Z', ahora) === true` y `estaDemorado('2026-10-15T12:00:00Z', ahora) === false`.
  - `nombres`: `listaDeNombres([]) === ''`, `listaDeNombres(['A']) === 'A'`, `listaDeNombres(['A','B']) === 'A y B'`, `listaDeNombres(['A','B','C']) === 'A, B y C'`.

- [ ] **Step 2: Correr y ver que fallan**

  Run: `node --test tests/perfil-frontend.test.js`
  Expected: FAIL con "… is not a function" en los tests nuevos. Los existentes siguen pasando.

- [ ] **Step 3: Implementar las funciones en `public/js/perfil.js`**
  - `diffPalabras`:
    - Partir con `t.split(/(\s+|[,.;:()¿?¡!"])/).filter(x => x)`.
    - Hacer LCS por programación dinámica sobre los tokens y recorrer de adelante hacia atrás. Ante una diferencia, con `L[i+1][j] >= L[i][j+1]`, primero va la baja.
    - Unir segmentos consecutivos del mismo tipo.
    - Tope: si `tokensAntes * tokensDespues > 250000`, devolver `[{tipo:'-',texto:antes},{tipo:'+',texto:despues}]`, sin los vacíos. Un lado vacío devuelve solo el otro.
  - `resumenDelCambio(cambio)` para `editar`:
    - Primer campo, `c0 = campos[0]`.
    - Si `c0` no está en `CAMPOS_LARGOS` y `textoDeValor(c0.antes)` y `textoDeValor(c0.despues)` tienen cada uno ≤ 40 caracteres → `<b>Etiqueta</b> de A a B`. Un valor vacío se escribe `vacío`. Se agrega `, y N campo(s) más` si hay más.
    - Si no → `Cambia <b>E1</b>` / `Cambia <b>E1</b> y <b>E2</b>` / `Cambia <b>E1</b>, <b>E2</b> y N más`.
  - `resumenDelCambio(cambio)` para `crear`:
    - Con área y frecuencia: `Dataset nuevo de {area_nombre}, {frecuencia_nombre en minúscula}`.
    - Con una sola de las dos, la que esté (`Dataset nuevo de {area}` o `Dataset nuevo, {frecuencia}`).
  - `marcaDeAuditoria`:
    - `<span class="pf-marca pf-marca-respaldo">` con un SVG de escudo de Lucide y el texto, o `<span class="pf-marca">`.
    - Nombres con `listaDeNombres`, escapados.

- [ ] **Step 4: Correr los tests**

  Run: `node --test tests/perfil-frontend.test.js`
  Expected: PASS, todos.

  Run: `npm test`
  Expected: `ℹ fail 0`.

- [ ] **Step 5: Commit**

  ```bash
  git add public/js/perfil.js tests/perfil-frontend.test.js
  git commit -m "feat: mi perfil: funciones de presentación de un cambio (resumen, comparación palabra por palabra, marca del editor, pestaña inicial)"
  ```

---

### Task 3: Pestañas de Mi Perfil (estructura, Mis datos y Mi firma)

**Files:**
- Modify: `public/perfil.html` (`<style>` :14-297, contenido :400-558, script :638)
- Modify: `public/js/perfil.js` (`DOMContentLoaded` :11-35, `setupEventos` :64-95, `actualizarBadges` :240-266)
- Modify: `tests/paginas.test.js` (versión propia de `perfil.js`)
- Modify: `tests/perfil-frontend.test.js` (estructura de la página)

**Interfaces:**
- Consumes: `pestanaInicial(hash, esAdmin)` de la Task 2.
- Produces (la Task 4 las usa):
  - `mostrarPestana(nombre: string): void`. Activa la pestaña, muestra su panel, oculta los demás y hace `history.replaceState(null, '', '#' + nombre)`.
  - IDs de pestaña: `pestana-para-revisar`, `pestana-mis-cambios`, `pestana-mis-datos`, `pestana-mi-firma`.
  - IDs de panel: `vista-para-revisar`, `vista-mis-cambios`, `vista-mis-datos`, `vista-mi-firma`.
  - Cuentas: `cuenta-para-revisar` y `cuenta-mis-cambios`, con `hidden` cuando son 0.
  - `#message-container` va arriba de la barra.
  - Dentro de `vista-para-revisar` quedan, por ahora, `#filtro-revisar-tipo` y `#lista-para-revisar`, que hoy existen. Dentro de `vista-mis-cambios`, `#filtro-mis-estado` y `#lista-mis-cambios`. Los modales siguen.

- [ ] **Step 1: Escribir los tests que fallan.**

  En `tests/paginas.test.js`, separar `perfil` de `VERSION_PANTALLAS`: `const VERSION_PERFIL = '20261031'` y un `it` que exige `js/perfil.js?v=20261031"` en `perfil.html`. `usuarios` y `correos` siguen con `VERSION_PANTALLAS`.

  En `tests/perfil-frontend.test.js`, un `describe('perfil.html: pestañas')`:
  - Hay `role="tablist"`, que aparece después de `id="message-container"`.
  - Por cada `n` de `['para-revisar','mis-cambios','mis-datos','mi-firma']`:
    - hay un botón con `id="pestana-${n}"`, `role="tab"` y `aria-controls="vista-${n}"`;
    - hay un elemento con `id="vista-${n}"`, `role="tabpanel"` y `aria-labelledby="pestana-${n}"`.
  - Ya no están `class="tab-btn"` ni `id="seccion-cambios"`.

- [ ] **Step 2: Correr y ver que fallan**

  Run: `node --test tests/perfil-frontend.test.js tests/paginas.test.js`
  Expected: FAIL en los tests nuevos.

- [ ] **Step 3: Reestructurar `perfil.html`**
  - Barra `<div class="pf-pestanas" id="pestanas-perfil" role="tablist" aria-label="Secciones de Mi Perfil" hidden>` con los cuatro `<button type="button" class="pf-pestana" role="tab" id="pestana-…" aria-selected="false" aria-controls="vista-…" data-vista="…" tabindex="-1">`.
  - Para revisar y Mis cambios llevan `<span class="pf-cuenta" id="cuenta-…" hidden></span>`.
  - Paneles `<section id="vista-…" role="tabpanel" aria-labelledby="pestana-…" hidden>`.
  - **Mis datos**: las tarjetas Datos personales y Contraseña, en `.pf-tarjetas` (dos columnas que pasan a una en ≤ 760 px). Cada tarjeta con título, una línea de ayuda y el formulario de hoy con sus IDs:
    - Datos personales: "Tu nombre y email aparecen en los avisos y en el historial de cambios."
    - Contraseña: "Al cambiarla se cierran tus otras sesiones abiertas."
  - **Mi firma**: la tarjeta de firma de hoy (IDs, `#firma-estado`, `#firma-vista`, `#firma-muestra` iguales).
  - Para revisar y Mis cambios: los filtros y las listas de hoy (Interfaces). Se sacan la tarjeta `seccion-cambios` y sus pestañas internas, con su CSS (`.tabs`, `.tab-btn`, `.tab-content`).
  - CSS nuevo en el `<style>`:
    - tokens `--pf-*` del spec (sección 7);
    - `.main-content { max-width: 1120px; min-width: 0; }`;
    - pestañas como el mockup: subrayado `--primary`, cuenta en pastilla y foco visible. La barra con `overflow-x: auto` y sin barra de scroll visible;
    - `.pf-tarjeta`;
    - mensajes `.alert`, `.alert-success` (fondo `#EAF6EF`, borde `#C7E6D3`, texto `#2E6B4C`) y `.alert-error` (`#FBEEEE` / `#EFCACA` / `#8A3434`);
    - `@media (prefers-reduced-motion: reduce)`.
  - Script: `js/perfil.js?v=20261031`.

- [ ] **Step 4: Conectar en `perfil.js`**
  - `DOMContentLoaded`:
    1. `cargarPerfil()`.
    2. `setupEventos()`. Los formularios se conectan antes de cualquier carga larga.
    3. Si `Auth.isAdmin()`: mostrar `#pestanas-perfil`, `mostrarPestana(pestanaInicial(location.hash, true))`, y lo de la firma y las listas como hoy.
    4. Si no: `mostrarPestana('mis-datos')` con la barra oculta.
  - `mostrarPestana`: para cada pestaña, `aria-selected`, `tabindex` (0 en la activa, -1 en el resto) y la clase `activa`; para cada panel, `hidden`.
  - Teclado en la barra: ArrowLeft y ArrowRight con vuelta, Home y End. Mueven el foco y activan.
  - `window.addEventListener('hashchange', …)` → `mostrarPestana(pestanaInicial(location.hash, Auth.isAdmin()))`.
  - `actualizarBadges` escribe en `cuenta-para-revisar` y `cuenta-mis-cambios` (texto y `hidden`), en lugar de los badges viejos.
  - Se borran el manejo de `.tab-btn` de `setupEventos` y la línea que mostraba `seccion-cambios` (ese elemento ya no existe: `getElementById` daría `null`).

- [ ] **Step 5: Correr los tests**

  Run: `node --test tests/perfil-frontend.test.js tests/paginas.test.js`
  Expected: PASS.

  Run: `npm test`
  Expected: `ℹ fail 0`.

- [ ] **Step 6: Commit**

  ```bash
  git add public/perfil.html public/js/perfil.js tests/paginas.test.js tests/perfil-frontend.test.js
  git commit -m "feat: mi perfil en pestañas: Para revisar, Mis cambios, Mis datos y Mi firma"
  ```

---

### Task 4: La nueva Gestión de Cambios (filas que se despliegan, aprobar y rechazar en la fila)

**Files:**
- Modify: `public/perfil.html`. Contenido de `vista-para-revisar` y `vista-mis-cambios`, CSS de la lista y la comparación, y se borran `modal-detalle`, `modal-rechazo` y el CSS que queda sin uso (`.cambio-card*`, `.badge-tipo`, `.badge-estado`, `.comparador*`, `.filtros-bar`, el `.empty-state` propio, `.link-portal-revision`).
- Modify: `public/js/perfil.js`
- Modify: `tests/perfil-frontend.test.js`
- Modify: `CLAUDE.md` (Arquitectura: Auditoría de cambios pendientes, y una línea en Frontend si corresponde) y `README.md:124,142,596` (descripción de `perfil.html` y `perfil.js`)

**Interfaces:**
- Consumes:
  - Task 1: la forma de las listas.
  - Task 2: `tituloDelCambio`, `resumenDelCambio`, `marcaDeAuditoria`, `etiquetaDeCampo`, `textoDeValor`, `diffPalabras`, `htmlDeDiff`, `CAMPOS_LARGOS` y `estaDemorado`.
  - Task 3: `mostrarPestana`, los paneles y las cuentas.
  - Las que existen: `botonesDeAuditoria`, `avisoNoCorresponde`, `permisoDeAuditoria`, `textoRevisor`, `calcularTiempoRelativo`, `API.getCambiosPendientesParaRevisar({tipo, estado})`, `API.getMisCambios({estado})`, `API.getContadorPendientes()`, `API.aprobarCambio(id)` y `API.rechazarCambio(id, comentario)`. Y la global `cargarContadorNotificaciones` de `main.js`, si existe.
- Produces:
  - `htmlDeFila(cambio, modo: 'revisar'|'revisado'|'mio', opciones: { abierto: boolean, esEditor: boolean, idUsuario: number }): string`. Es pura: un `<li class="pf-cambio" data-id>` con el botón cabecera (`aria-expanded`, `aria-controls="cuerpo-<id>"`) y el cuerpo `id="cuerpo-<id>"` (`hidden` si está cerrado).
  - `htmlDeComparacion(cambio): string`. Es pura.
  - Siguen siendo globales `aprobarCambio(id)` y `abrirModalRechazo(id)`, ahora en la fila, porque los nombres están fijados por tests.
  - Nuevas: `confirmarAprobacion(id)`, `confirmarRechazo(id)`, `cancelarAccion(id)` y `recargarCambios()`.

- [ ] **Step 1: Escribir los tests que fallan** en `tests/perfil-frontend.test.js`, `describe('perfil.js: filas de la gestión de cambios')`. Usan un cambio `editar` de prueba con:
  - `id:7`, `usuario_id:2`, `usuario_nombre:'Ana <b>Gómez</b>'`, `dataset_titulo:'Comercios <script>'`, `estado:'pendiente'`, `created_at:'2026-10-16T13:32:00Z'`;
  - `campos_modificados:[{campo:'Frecuencia',antes:'Anualmente',despues:'Cada medio año'}]`;
  - `auditoria:{puede:true,respaldo:false,mensaje:null,auditan:['Laura']}`.

  Tests:
  - Pendiente con permiso (`modo 'revisar'`, `{abierto:true, esEditor:false, idUsuario:1}`):
    - contiene `onclick="aprobarCambio(7)"`, `abrirModalRechazo(7)`, `<del>Anualmente</del>` y `<ins>Cada medio año</ins>`;
    - contiene `Comercios &lt;script&gt;` y no `<script>`;
    - contiene `Ana &lt;b&gt;Gómez&lt;/b&gt;`;
    - contiene `aria-expanded="true"`.
  - Editor sin permiso (`auditoria:{puede:false,respaldo:false,mensaje:'Este cambio lo auditan Laura. Podés auditarlo solo si ninguno está disponible.',auditan:['Laura']}`, `esEditor:true`):
    - exactamente 2 `disabled`;
    - contiene `Lo auditan Laura` y el mensaje completo de `avisoNoCorresponde`;
    - no contiene `aprobarCambio`.
  - Propio (`usuario_id:1`, `idUsuario:1`, `modo 'mio'`): no contiene `aprobarCambio`, `abrirModalRechazo` ni `disabled`.
  - Revisado rechazado (`estado:'rechazado'`, `comentario_rechazo:'Falta <i>x</i>'`, `revisor_nombre:'Pablo'`, `revisado_como_respaldo:1`, `revisado_at:'2026-10-15T12:00:00Z'`, `modo 'revisado'`):
    - contiene `Motivo del rechazo` y `Falta &lt;i&gt;x&lt;/i&gt;`;
    - contiene `Rechazado por Pablo (respaldo)`;
    - contiene `15/10/2026`;
    - no contiene `aprobarCambio`.
  - Cerrada (`abierto:false`): el cuerpo tiene `hidden` y `aria-expanded="false"`.
  - `htmlDeComparacion`:
    - de un `eliminar` con `datos_anteriores:{titulo:'X', area_nombre:'Deportes'}`: contiene `deja de figurar en el registro` y `Deportes`;
    - de un `crear` con `datos_nuevos:{titulo:'Arbolado', descripcion:'Censo'}`: contiene `Censo` y ningún `<del>`;
    - de un `editar` con `{campo:'Descripcion', antes:'corte semestral.', despues:'corte trimestral.'}`: contiene `<del>semestral</del>` y `<ins>trimestral</ins>`.
  - Página y código viejo:
    - `perfil.html` no contiene `modal-detalle`, `modal-rechazo`, `filtro-mis-estado` ni `value="actualizar"`;
    - `perfil.js` no contiene `confirm(`, `verDetalle`, `renderComparador` ni `nav-badge-admin`.

- [ ] **Step 2: Correr y ver que fallan**

  Run: `node --test tests/perfil-frontend.test.js`
  Expected: FAIL en los nuevos.

- [ ] **Step 3: HTML y CSS de los paneles** (como el mockup)
  - **Para revisar**:
    - Barra `.pf-barra` con el segmento `#segmento-revisar`: dos `<button type="button" data-segmento="pendientes|revisados" aria-pressed>`.
    - `#filtro-revisar-tipo` con las opciones `""` Todos los tipos / `crear` Crear / `editar` Editar / `eliminar` Eliminar.
    - `<ul class="pf-lista" id="lista-para-revisar">` y `<button type="button" id="mas-para-revisar" hidden>Ver 20 más</button>`.
  - **Mis cambios**:
    - `#grupo-mios-pendientes`, con `<h2>Esperando auditoría</h2>` y `ul#lista-mios-pendientes`, `hidden` si no hay.
    - `#grupo-mios-resueltos`, con `<h2>Resueltos</h2>`, el segmento `#segmento-mios` (`data-filtro="todos|aprobado|rechazado"`), `ul#lista-mios-resueltos` y `#mas-mios`.
  - CSS de fila, etiqueta de tipo, resumen, marca, cuerpo (fondo sutil), comparación (`dl` en dos columnas que pasa a una en ≤ 760 px), `del`/`ins` (tachado `#B5524C` y resaltador `#CBEBD7` con el degradado del mockup), notas (baja, no corresponde, motivo), botones `.pf-btn-aprobar`/`.pf-btn-rechazar`/`.pf-btn-quieto`, confirmación, motivo, resultado y vacíos. Valores en la tabla del spec, sección 7.

- [ ] **Step 4: JS en `perfil.js`**
  - `htmlDeFila`:
    - Cabecera: etiqueta de tipo (`Crear|Editar|Eliminar`), título, resumen y marca.
    - En `revisado`: "Propuesto por X".
    - A la derecha, según el modo:
      - `revisar`: quién lo propuso y `calcularTiempoRelativo`, en ámbar si `estaDemorado`;
      - `mio` pendiente: "Propuesto" con el tiempo;
      - resuelto: resultado y fecha `revisado_at` en dd/mm/aaaa.
  - Cuerpo:
    - `htmlDeComparacion`. Para editar recorre `campos_modificados`: en `CAMPOS_LARGOS` usa `htmlDeDiff(diffPalabras(textoDeValor(antes), textoDeValor(despues)))`; en el resto, `<del>` y `<ins>` con `vacío` en cursiva si está vacío. Crear y eliminar usan la lista de 13 campos de hoy, con las etiquetas de `ETIQUETAS_DE_CAMPO`. Sin campos, `No se detectaron cambios en los campos principales.`.
    - Después: la nota de baja, el motivo y `avisoNoCorresponde` si no puede.
    - El pie: "Propuesto por X el dd/mm/aaaa, hh:mm" o `textoRevisor` con la fecha, el link "Ver en el portal" (`Utils.safeUrl` de: en crear, `datos_nuevos.url_dataset`; en eliminar, `datos_anteriores.url_dataset || dataset_url`; en editar, `datos_nuevos.url_dataset || dataset_url`) y, si está pendiente y no es propio, `<div id="acciones-<id>">` con `botonesDeAuditoria(id, permisoDeAuditoria(cambio))`.
  - `botonesDeAuditoria`: sin el botón Cerrar. Rechazar con `onclick="abrirModalRechazo(id)"` y Aprobar con `onclick="aprobarCambio(id)"`, con las clases `pf-btn`. Iconos SVG, sin emojis.
  - Carga:
    - `cargarCambiosParaRevisar`: segmento pendientes → `estado:'pendiente'`; revisados → `estado:'todos'` y filtrar `estado !== 'pendiente'`. Con el tipo del filtro, guarda la lista y pinta las primeras `visibles` (20; "Ver 20 más" suma 20). En pendientes, la primera abierta.
    - `cargarMisCambios`: `estado:'todos'`. Pendientes en su grupo; resueltos con el filtro del segmento y de a 20.
    - Clic delegado en las listas: abre y cierra la fila (`aria-expanded`, `hidden`).
  - Acciones:
    - `aprobarCambio(id)` reemplaza `#acciones-<id>` por "¿Aprobar? El cambio se aplica al dataset ahora." con [Cancelar] (`cancelarAccion(id)`) y [Sí, aprobar] (`confirmarAprobacion(id)`).
    - `confirmarAprobacion` deshabilita el botón y llama a `API.aprobarCambio`. Si sale bien: la fila muestra "Aprobado. El cambio ya está aplicado en el dataset.", `Utils.showSuccess('Cambio aprobado correctamente')` y `recargarCambios()`. Si falla: `Utils.showError(error.message)` y `recargarCambios()`.
    - `abrirModalRechazo(id)` agrega debajo del pie el campo "Motivo del rechazo" (`textarea#motivo-<id>`, con foco) con [Cancelar] y [Rechazar cambio] (`confirmarRechazo(id)`).
    - `confirmarRechazo`: sin texto, `Utils.showError('Debe proporcionar un motivo de rechazo')` y no envía. Si no, `API.rechazarCambio`, la fila muestra "Rechazado. Quien lo propuso ve el motivo en Mis cambios.", `Utils.showSuccess('Cambio rechazado correctamente')` y `recargarCambios()`. El error, como en aprobar.
    - `recargarCambios`: las dos listas, las cuentas (sin el pedido duplicado de `mis-cambios`: la cuenta propia sale de la lista cargada) y `if (typeof cargarContadorNotificaciones === 'function') cargarContadorNotificaciones()`.
  - Vacíos y errores:
    - "No hay cambios esperando revisión." con "Cuando alguien proponga uno, aparece acá."
    - "Todavía no hay cambios revisados."
    - "Todavía no propusiste cambios."
    - Con filtro: "No hay cambios de tipo {Crear|Editar|Eliminar}." / "No hay cambios {aprobados|rechazados}."
    - Error de carga: "No se pudieron cargar los cambios. Probá recargar la página."
  - Se borran `verDetalle`, `renderComparador`, `renderCambioCard`, `cerrarModalDetalle`, `cerrarModalRechazo`, `cambioSeleccionado` y `nav-badge-admin`.
  - `esEditor`: `Auth.getUser()?.rol === 'editor'`. `idUsuario`: `Number(Auth.getUser()?.id)`.

- [ ] **Step 5: Docs**
  - `CLAUDE.md`, sección "Auditoría de cambios pendientes", una viñeta:
    - Mi Perfil en pestañas (Para revisar, Mis cambios, Mis datos, Mi firma; `#para-revisar` en el email);
    - las listas `para-revisar` y `mis-cambios` traen la comparación (`campos_modificados`), los datos enriquecidos y, `para-revisar`, `auditoria` con `auditan`;
    - `calcularCambios` compara las fechas por día.
  - `README.md`: actualizar las descripciones de `perfil.html`/`perfil.js`.

- [ ] **Step 6: Correr los tests**

  Run: `node --test tests/perfil-frontend.test.js tests/paginas.test.js`
  Expected: PASS.

  Run: `npm test`
  Expected: `ℹ fail 0`.

- [ ] **Step 7: Commit**

  ```bash
  git add public/perfil.html public/js/perfil.js tests/perfil-frontend.test.js CLAUDE.md README.md
  git commit -m "feat: gestión de cambios rediseñada: filas que se despliegan, control de cambios y aprobar o rechazar en la fila"
  ```

---

## Después de las tareas (lo hace quien coordina, no un implementador)

1. Revisión final de toda la rama.
2. Prueba manual del spec, sección 12. Usa la base local con los usuarios de prueba `@rpad.test`: proponer con uno y auditar con otro, el editor de respaldo y el lector. Incluye el paso de Review Focus 3: aprobar desde una pestaña un cambio que otra pestaña ya resolvió → mensaje y lista recargada.
3. Celular a 375 px sin scroll horizontal, y el teclado en las pestañas.
4. Kit de deploy con los 4 archivos del spec, sección 13.
