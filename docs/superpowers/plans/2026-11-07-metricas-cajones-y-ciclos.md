# Los cajones con una frase, los ciclos de cada tramo y las dos unidades juntas: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cajones de «El circuito» con una sola frase, un modal por tramo desde la banda de la página, y los días corridos y hábiles juntos en toda la pestaña Métricas, el PDF «Métricas del año» y el Informe anual, sin el selector de días.

**Architecture:** Las reglas siguen en `services/metricasReglas.js` (pura) y arman todos los textos (Ruling 19): cada duración se cuenta en las dos unidades al armar la vista, y lo nuevo va en claves nuevas del tramo, sin tocar las que lee el Ciclo de vida. La geometría del gráfico del modal va en un archivo puro nuevo, `services/metricasGrafico.js`, como la de la cinta. La foto guarda la vista ya armada; `VERSION_DE_LA_FOTO` sigue en 1 y lo nuevo se lee con tolerancia.

**Tech Stack:** Node.js 22, ES Modules, PDFKit, vanilla JS, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-07-metricas-cajones-y-ciclos-design.md`. Antes de cada tarea, leé la sección que nombra y `docs/temas/metricas-y-reportes.md`; si toca el tramo, también `docs/temas/ciclo-de-vida.md`.

## Antes de empezar

Este plan espera su turno en la fila de la sesión coordinadora: no se escribe código hasta recibirlo.

1. Traé el `main` y fijate qué cambió desde `39b41ba`; ajustá lo que haga falta.
2. Copiá el `.env` del checkout principal al worktree, sin mostrarlo, con `RPAD_TESTS_DB_LOCAL=1`. Si falta `node_modules`, copialo como carpeta real o corré `npm ci`.
3. Pedile a la coordinadora el aviso de contenedor libre, corré `npm test` y anotá el resultado: es la línea de base. Una sola suite a la vez por contenedor.

## Global Constraints

- Repositorio público: ningún nombre real, ningún dato ni cifra de producción, tampoco en tests ni comentarios. Los ejemplos son inventados, con números que no estén en los datos.
- Lenguaje neutro: nunca «tardanza», «demora», «atraso», «sin respuesta», «sin entregar» ni «no mandó» (tampoco en nombres de variables).
- El servidor arma cifras, textos y geometrías; la página y los PDF los imprimen (Ruling 19). Todo texto del servidor pasa por `Utils.escapeHtml` en la página y un número va con `String`.
- Lo que ya trae un tramo de `vista.circuito` (`clave`, `nombre`, `desde_hasta`, `responsable`, `dgmit`, `cifra`, `vacio`, `en_curso`, `pendientes`, `pendientes_texto`, `anticipacion_texto`, en ese orden) no cambia de forma ni de contenido: lo lee el Ciclo de vida (`etapaDelReporte` llama a `tramoDelCircuito`). `tramoDelCircuito`, `TRAMOS` y `aclaracionesDe` no cambian.
- Las frases (`COMO_SE_CUENTA`), al pie de la letra: aviso «Se cuenta desde que el RPAD avisa hasta el vencimiento.»; tramite «Se cuenta desde que la DGMIT y la DA reciben el aviso hasta que entregan la nota.»; respuesta «Se cuenta desde que la DGMIT y la DA entregan la nota hasta que la DDPC recibe la actualización.»; produccion «Se cuenta desde que la DGMIT y la DIT reciben el aviso hasta que entregan el relevamiento a la DDPC.»; carga «Se cuenta desde que la DDPC recibe la actualización hasta la carga en el portal.».
- La bajada de los días: «Los días van corridos y, entre paréntesis, hábiles: de lunes a viernes, sin feriados ni días no laborables.»; el pie del circuito: «Con «Mediana», el número grande es el del medio: en la mitad de los casos, ese número o menos. Con «Promedio», cada cifra lo dice debajo.».
- `VERSION_DE_LA_FOTO` sigue en 1. Sin SQL. `metricasReglas.js` y `metricasGrafico.js` son puros: sin pool ni `Date` local.
- En los PDF, los elementos se miden antes de dibujarse (`tests/pdf-diagramacion.js`, que no se afloja).
- Cada `?v=` está atado a su constante de `tests/paginas.test.js`. Ninguna clase ni id empieza con `ad-`. Foco visible y 4,5:1 o más en todo texto; el color nunca es lo único que distingue; con `prefers-reduced-motion`, nada se mueve. `css/main.css` no cambia: los estilos nuevos van en el `<style>` de `reportes.html`.
- Nunca `docker compose` desde un worktree ni `down -v`. Docker: `/Applications/Docker.app/Contents/Resources/bin/docker`. No llames a `/api/cron/*`. Ningún email real. Nada de `pkill -f` ni `killall` con patrón.
- Nunca tocar producción ni desplegar. Una rama remota no se borra ni se reescribe sin que lo diga el usuario.
- **Modelo:** Métricas y los PDF están en la lista fija de Opus: código y revisiones con Opus.
- **Cada commit, en verde.** Antes de cada commit corré la suite de Métricas, con el aviso de contenedor libre (`metricas-api`, `metricas-foto` y `feriados-en-metricas` usan la base):

```bash
node --test tests/metricas-huellas.test.js tests/metricas-reglas.test.js tests/metricas-grafico.test.js tests/metricas-cinta.test.js tests/metricas-opciones.test.js tests/metricas-foto.test.js tests/metricas-api.test.js tests/feriados-en-metricas.test.js tests/reportes-frontend.test.js tests/reportes-pdf.test.js tests/paginas.test.js
```

  (`metricas-grafico` existe desde la tarea 3; antes, sacalo de la lista.) Cada commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, y después de cada tarea, push de la rama.
- **`REFERENCIA_DE_LOS_PDF`** (`tests/reportes-pdf.test.js`): cuando una tarea cambia a propósito esos PDF, vuelve a tomar los sha que da el test al fallar, y antes comprueba con el texto de cada hoja (`lineasPorHoja`) que cambió solo lo de esa tarea; suma un renglón al comentario de la referencia con la fecha y qué cambió.

## Review Focus

1. **Un link viejo con `?dias=habiles`** (un marcador guardado): la página abre en las dos unidades, la URL queda sin `dias` y el PDF pedido con `dias=habiles` sale igual al de sin `dias`. Tarea 6.
2. **Un tramo con solo ciclos en curso** (sin cifra): el cajón dice el vacío y la frase; el modal tiene los aros sin la línea del estadístico. Tareas 4 y 7.
3. **Datasets destildados:** el modal no los lista, sus cantidades coinciden con `cifra.ciclos`, y repite la franja «Calculado sin…». Tareas 4 y 8.
4. **Un modal con muchos ciclos en el teléfono** (60 o más, a 375 píxeles): el cuerpo se desplaza adentro, la tabla se desplaza de costado en su marco, la × sigue a la vista y la página de atrás no se mueve. Tarea 8.
5. **Un año con foto sin las claves nuevas:** el cajón cae a `desde_hasta`, el PDF saca el paréntesis de la otra vista y la banda no tiene botones; nada tira. Tareas 6, 7 y 8.

---

### Tarea 0: las huellas de lo que no cambia

**Files:**
- Create: `tests/metricas-huellas.test.js`

Se escribe y se commitea sobre el código de antes, antes de la tarea 1, y tiene que seguir verde hasta el final.

- [ ] **Paso 1: escribí el test**

Con `casosDe(mapaDeLosCasos(), { hoy: HOY_DE_LAS_METRICAS })` de `tests/metricas-casos.js` y `sha = (valor) => createHash('sha256').update(JSON.stringify(valor)).digest('hex')`:

```js
const CLAVES_DE_HOY = ['clave', 'nombre', 'desde_hasta', 'responsable', 'dgmit', 'cifra', 'vacio', 'en_curso', 'pendientes', 'pendientes_texto', 'anticipacion_texto'];
const deHoy = (tramo) => Object.fromEntries(CLAVES_DE_HOY.map((k) => [k, tramo[k]]));
const tramosDeHoy = (v) => GESTIONES.map((g) => v.circuito[g].map(deHoy));
const HUELLAS = { tramos: '<sha>', aclaraciones: '<sha>', etapas: '<sha>', ciclo: '<sha>' };

it('los tramos, con sus claves de hoy, en las cuatro combinaciones y con un destildado', () => {
  const todas = [];
  for (const estadistico of ESTADISTICOS) for (const dias of DIAS) for (const sin of [[], [<un dataset_id de los casos>]]) {
    todas.push(tramosDeHoy(vistaDe(CASOS, { anio: 2026, al: HOY_DE_LAS_METRICAS, estadistico, dias, sin })));
  }
  assert.equal(sha(todas), HUELLAS.tramos);
});
// aclaraciones: las tres de hoy (ya_vencidos, fuente_publica, no_requieren_nota) de las dos gestiones, en las cuatro combinaciones
// etapas: etapasDe(CASOS, { anio: 2026, al: HOY_DE_LAS_METRICAS })
// ciclo: contenidoPorHoja(await renderCicloDeVida(...)) con los mismos datos que usa reportes-pdf.test.js para el Ciclo de vida
```

- [ ] **Paso 2: corré `node --test tests/metricas-huellas.test.js`, copiá los sha que da al fallar y volvé a correrlo: verde**

- [ ] **Paso 3: commit** `test(metricas): las huellas del tramo, las aclaraciones y el Ciclo de vida, que no cambian`

---

### Tarea 1: los textos con las dos unidades (spec, 4)

**Files:**
- Modify: `services/metricasReglas.js` (ayudantes nuevos, `textoEnCursoDeLosDos`, `filaDe`, `textoDeDespues`, `resultadosDe`)
- Modify: `services/reportesMetricasPdf.js` (`textoDeHabiles` pasa a reglas; el PDF la importa y la reexporta, para no romper los imports de los tests)
- Test: `tests/metricas-reglas.test.js`, `tests/metricas-foto.test.js`, `tests/reportes-pdf.test.js`, `tests/reportes-frontend.test.js`

**Interfaces:**
- Produces (exportadas de `metricasReglas.js`):
  - `cantidadDeLasDos(corridos: number, habiles: number|null) -> string`: la duración terminada.
  - `haceDeLasDos(corridos: number, habiles: number|null) -> string`: lo que lleva en curso.
  - `haceEnCursoDeLosDos(enCorridos, enHabiles, estadistico) -> string`: «hace 150 días corridos (102 hábiles, mediana)», la parte de `textoEnCursoDeLosDos` después de «N sin datos registrados todavía, ».
  - `textoDeHabiles(cifra, habil) -> string`: la de hoy, movida.

- [ ] **Paso 1: escribí los tests que fallan**

```js
describe('las dos unidades (spec 2026-11-07, 4)', () => {
  it('una duración terminada', () => {
    assert.equal(cantidadDeLasDos(64, 45), '64 días corridos (45 hábiles)');
    assert.equal(cantidadDeLasDos(1, 1), '1 día corrido (1 hábil)');
    assert.equal(cantidadDeLasDos(3, 0), '3 días corridos (en el día, en días hábiles)');
    assert.equal(cantidadDeLasDos(0, 0), 'en el día');
    assert.equal(cantidadDeLasDos(5, null), '5 días corridos');
  });
  it('lo que lleva en curso', () => {
    assert.equal(haceDeLasDos(150, 102), '150 días corridos (102 hábiles)');
    assert.equal(haceDeLasDos(3, 0), '3 días corridos (menos de 1 hábil)');
    assert.equal(haceDeLasDos(0, 0), 'menos de 1 día corrido');
  });
  it('los en curso de los PDF no cambian y comparten la parte de «hace»', () => {
    assert.equal(haceEnCursoDeLosDos({ n: 4, valor: 150 }, { n: 4, valor: 102 }, 'mediana'), 'hace 150 días corridos (102 hábiles, mediana)');
    assert.equal(textoEnCursoDeLosDos({ n: 4, valor: 150 }, { n: 4, valor: 102 }, 'mediana'),
      '4 sin datos registrados todavía, hace 150 días corridos (102 hábiles, mediana)');
  });
});
```

En `describe('Los casos')`, con `cerrado()` (avisado el 19/02/2026, vence el 31/03/2026: 40 corridos y 27 hábiles; datos el 06/04, carga el 08/04), en las dos unidades del selector (el texto ya no depende de `dias`):

```js
for (const dias of DIAS) {
  const [fila] = vista([cerrado({ nota_dgmit: notaDe('2026-03-02') })], { dias }).casos;
  assert.equal(fila.aviso.texto, '40 días corridos (27 hábiles) antes del vencimiento', dias);
  assert.equal(fila.carga.texto, '2 días corridos (2 hábiles) desde que se recibió', dias);
  assert.match(fila.recibido.texto, /^\d+ días corridos \(\d+ hábiles\) desde la nota$/, dias);
}
```

Y: un abierto dice «en curso, N días corridos (M hábiles) desde la nota»; con 0 días sigue en «en curso»; una duración de 0, «en el día»; el aviso de 0, «el día del vencimiento». `resultados.a_tiempo.despues.texto` con un caso armado: «Los otros N se cargaron una mediana de X días corridos (Y hábiles) después.», con X e Y calculados en el test con `duracion`; `despues.valor` sigue en la unidad de la vista (cambia con `dias`).

- [ ] **Paso 2: corré `node --test tests/metricas-reglas.test.js` y mirá que fallen los nuevos**

- [ ] **Paso 3: implementá**

- Los cuatro ayudantes, con `unidadDe` para los corridos; el hábil en singular es «1 hábil».
- `textoEnCursoDeLosDos` arma su texto con `haceEnCursoDeLosDos` y da lo mismo que hoy en todos sus casos.
- `filaDe` cuenta cada duración con `duracion(desde, hasta, 'corridos', ctx.calendario)` y `'habiles'`, no con `ctx.dias`: terminadas con `cantidadDeLasDos`, en curso con `haceDeLasDos` (con 0 corridos, «en curso»); el aviso de 0 sigue en «el día del vencimiento».
- `textoDeDespues` recibe las dos cifras (`cifraDe` de los días después del vencimiento en corridos y en hábiles, con el estadístico de `ctx`) y dice «de ${haceDeLasDos(c, h)} después»; `despues.valor` sigue en `ctx.dias`.

- [ ] **Paso 4: actualizá los tests que fijaban una sola unidad**

`metricas-reglas.test.js` `:1135-1150`, `:1230`, `:1258-1288`, `:1500-1527`, `:2884-2889` y el describe «Los casos» `:2981-3070`; `metricas-foto.test.js` `:316` y `:329`; los destildados del PDF `:921-940`; la página `:629-663` y `:710-715`. El valor esperado es el de la tabla de la spec, sección 4.
Los PDF cambian (el «después» y los destildados): volvé a tomar `REFERENCIA_DE_LOS_PDF`.

- [ ] **Paso 5: corré la suite de Métricas, commit y push** `feat(metricas): los textos de Los casos y del después, en días corridos y hábiles`

---

### Tarea 2: el tramo suma la frase, la cifra en hábiles y dos aclaraciones (spec, 3, 4 y 6)

**Files:**
- Modify: `services/metricasReglas.js` (`COMO_SE_CUENTA`, `vistaDe`, `loNuevoDelTramo`, `aclaracionesNuevas`)
- Test: `tests/metricas-reglas.test.js`

**Interfaces:**
- Consumes: `cantidadDeLasDos`, `haceEnCursoDeLosDos`, `textoDeHabiles` (tarea 1).
- Produces:
  - `COMO_SE_CUENTA` (exportada, congelada), con las cinco frases de las restricciones.
  - Cada medida de `vistaDe` suma `otra`: `medir(h, { ...ctx, dias: <la otra unidad> })`. La usan las tareas 4 y 5.
  - `loNuevoDelTramo(clave, gestion, medidas, ctx, tramo) -> { como_se_cuenta, habiles, habiles_texto, modal }`, con `tramo` el de `tramoDelCircuito`; `vistaDe` arma cada tramo como `{ ...tramo, ...loNuevoDelTramo(...) }` (las claves nuevas, después de las de hoy). En esta tarea, `modal` es null.
  - `habiles`: con `ctx.dias === 'corridos'`, `cifraDelTramo` de los `m.otra.terminados[clave]` con un contexto en hábiles (`{ ...ctx, dias: 'habiles' }`); en la vista en hábiles, null. `habiles_texto`: `textoDeHabiles(tramo.cifra, habiles)` ('' si `habiles` es null).
  - `circuito.aclaraciones.externa` suma `pendientes: { n, texto }` y `en_curso: { n, texto }`; `circuito.aclaraciones.interna`, `en_curso` (texto '' con 0). Las suma `vistaDe` sobre lo que da `aclaracionesDe`, que no cambia.

- [ ] **Paso 1: escribí los tests que fallan**

- `COMO_SE_CUENTA` tiene las cinco frases, al pie de la letra.
- Con los casos reales (`casosReales()`), en las dos unidades: cada tramo tiene las claves de hoy en su orden y después `como_se_cuenta`, `habiles`, `habiles_texto`, `modal` (cambia el test de las claves exactas, `:825`; `sinNadaNulo`, `:745-760`, acepta `habiles` y `modal` null).
- En la vista en corridos, `tramo.habiles` es igual a `cifraDel(vista(c, { dias: 'habiles' }), g, clave)` y `habiles_texto` a `textoDeHabiles(tramo.cifra, tramo.habiles)`; en la vista en hábiles, `habiles` null y `habiles_texto` ''.
- `aclaraciones.externa.pendientes`: con 3 notas pendientes, «3 notas DGMIT de ciclos abiertos están pendientes de carga: cuentan en la redacción y entrega de nota cuando se cargan.»; con 1, «1 nota DGMIT de un ciclo abierto está pendiente de carga: cuenta en la redacción y entrega de nota cuando se carga.»; `n` igual a `pendientes` del trámite.
- `aclaraciones.externa.en_curso`: «3 ciclos abiertos todavía no tienen datos registrados, hace X: cuentan en la respuesta del área cuando se registra la actualización.», con X = `haceEnCursoDeLosDos(enCorridos, enHabiles, estadistico)`; el singular «1 ciclo abierto todavía no tiene datos registrados, hace X: cuenta …»; en la interna, «… en la producción del relevamiento …». Igual en las dos unidades de la vista.
- Los tests que comparan `aclaraciones` con `deepEqual` (`:837`, `:1169`) suman las claves nuevas.
- `tests/metricas-huellas.test.js` sigue verde sin tocarlo.

- [ ] **Paso 2: corré `node --test tests/metricas-reglas.test.js` y mirá que fallen**

- [ ] **Paso 3: implementá** lo de las Interfaces. El «hace» del en curso sale del `enCursoDelTramo` de las dos unidades (de `enCurso` y de `otra.enCurso`).

- [ ] **Paso 4: corré la suite de Métricas, commit y push** `feat(metricas): la frase de cada tramo, su cifra en hábiles y los pendientes y en curso en las aclaraciones`

---

### Tarea 3: la geometría del gráfico del modal (spec, 5)

**Files:**
- Create: `services/metricasGrafico.js` (puro; no importa `metricasReglas.js`)
- Test: `tests/metricas-grafico.test.js`

**Interfaces:**
- Produces: `graficoDelTramo(puntos, { linea }) -> Grafico|null` y la constante `GRAFICO`.
  - `puntos`: `[{ valor: number, estado: 'cuenta' | 'en_curso', titulo: string }]` (los días corridos de cada ciclo).
  - `linea`: `{ valor: number, texto: string }` (el rótulo ya armado) o null.
  - `Grafico`: `{ ancho, alto, eje: { y, marcas: [{ x, texto }], rotulo: { x, y, texto: 'días corridos', anclaje: 'end' } }, linea: { x, y0, y1, rotulo: { x, y, texto, anclaje } } | null, puntos: [{ x, y, estado, titulo }], mas: [{ x, y, texto }] }`; null sin puntos.
  - `GRAFICO = Object.freeze({ ancho: 760, izquierda: 18, derecha: 30, radio: 5.5, paso: 13, tope: 8, arriba: 34, abajo: 50, flecha: 11, letra: 12 })`.

- [ ] **Paso 1: escribí los tests que fallan**

```js
describe('graficoDelTramo', () => {
  const p = (valor, estado = 'cuenta', titulo = `D${valor}`) => ({ valor, estado, titulo });
  it('sin puntos, null', () => assert.equal(graficoDelTramo([], { linea: null }), null));
  it('las marcas del eje: de 0 al tope redondeado, con 6 intervalos o menos', () => {
    const g = graficoDelTramo([p(0), p(137)], { linea: null });
    assert.deepEqual(g.eje.marcas.map((m) => m.texto), ['0', '50', '100', '150']);
    assert.equal(g.eje.marcas[0].x, GRAFICO.izquierda);
    assert.equal(g.eje.marcas.at(-1).x, GRAFICO.ancho - GRAFICO.derecha);
  });
  it('los que se tocarían se apilan, y una columna de más de 8 dice «+N»', () => {
    const doce = Array.from({ length: 12 }, (_, i) => p(20, 'cuenta', `D${i}`));
    const g = graficoDelTramo(doce, { linea: { valor: 20, texto: 'mediana: 20 días corridos' } });
    assert.equal(g.puntos.length, 8);
    assert.deepEqual(g.mas.map((m) => m.texto), ['+4']);
    assert.equal(new Set(g.puntos.map((q) => q.y)).size, 8);
  });
  it('un en curso ocupa también su flecha', () => {
    const g = graficoDelTramo([p(0), p(99, 'en_curso'), p(100)], { linea: null });
    const [curso, cuenta] = [g.puntos.find((q) => q.estado === 'en_curso'), g.puntos.find((q) => q.titulo === 'D100')];
    assert.notEqual(curso.y, cuenta.y);
  });
  it('sin línea, sin línea; a la derecha, el rótulo se ancla al final', () => {
    const dos = [p(10), p(100)];
    assert.equal(graficoDelTramo(dos, { linea: null }).linea, null);
    assert.equal(graficoDelTramo(dos, { linea: { valor: 100, texto: 'mediana: 100 días corridos' } }).linea.rotulo.anclaje, 'end');
    assert.equal(graficoDelTramo(dos, { linea: { valor: 10, texto: 'mediana: 10 días corridos' } }).linea.rotulo.anclaje, 'start');
  });
  it('nada se sale ni se pisa', () => {
    let semilla = 7;
    const azar = () => ((semilla = (semilla * 16807) % 2147483647) % 400);
    const puntos = Array.from({ length: 60 }, (_, i) => p(azar(), i % 5 === 0 ? 'en_curso' : 'cuenta', `D${i}`));
    const g = graficoDelTramo(puntos, { linea: { valor: 120, texto: 'mediana: 120 días corridos' } });
    // cajas: cada punto (radio, más la flecha en curso), cada «+N», cada marca del eje, el rótulo del eje y el de la línea,
    // con el ancho del texto estimado como 0,6 · letra por carácter: todas adentro de [0, ancho] × [0, alto], y ninguna toca a otra
    // salvo un punto con la línea vertical (la línea cruza la columna de la mediana a propósito)
  });
});
```

- [ ] **Paso 2: corré `node --test tests/metricas-grafico.test.js`: falla porque no existe el archivo**

- [ ] **Paso 3: implementá `graficoDelTramo`**

- El paso del eje: el primero de `[1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]` con `max / paso <= 6` (con `max` el mayor valor o la línea, y al menos 1); el tope, `max` redondeado hacia arriba a un múltiplo del paso; `x(v) = izquierda + v / tope · (ancho − izquierda − derecha)`.
- La colocación:

```
ordenados por valor; una columna = mismo valor y mismo estado
si la columna ya tiene `tope` puntos, el punto no se dibuja y suma al «+N» de su columna
si no, su caja es [x − radio − 1, x + radio + 1 + (flecha si en_curso)]; va en el nivel más bajo
donde no toca ninguna caja del mismo nivel; y = arriba + niveles·paso − nivel·paso
```

- `alto = arriba + niveles·paso + abajo`, con un nivel más si hay algún «+N»; el «+N» va un paso arriba del punto más alto de su columna.
- La línea, de `y0 = 22` a la base; su rótulo arriba, con `anclaje: 'end'` si `x > ancho − 220`.

- [ ] **Paso 4: corré `node --test tests/metricas-grafico.test.js`, la suite de Métricas, commit y push** `feat(metricas): la geometría del gráfico de los ciclos de un tramo`

---

### Tarea 4: el modal de cada tramo, en el servidor (spec, 5 y 7)

**Files:**
- Modify: `services/metricasReglas.js` (`modalDelTramo`, llamado desde `loNuevoDelTramo`)
- Test: `tests/metricas-reglas.test.js`

**Interfaces:**
- Consumes: `otra` (tarea 2), `cantidadDeLasDos`, `haceDeLasDos`, `haceEnCursoDeLosDos` (tarea 1), `graficoDelTramo` (tarea 3).
- Produces: `tramo.modal`, solo con `ctx.dias === 'corridos'` (null en la vista en hábiles):
  `{ quien, leyenda: [{ marca, texto }], como_se_cuenta: string[], lista: string, puntas: [string, string], ciclos: [{ dataset_id, titulo, area, estado, desde, hasta, hasta_texto, dias_texto, nota }], vacio: string, grafico: Grafico|null }`.

| Clave | `quien` (más « · gestión externa» o « · gestión interna») | `puntas` | `desde`, `hasta` |
|---|---|---|---|
| aviso | RPAD | Aviso, Vencimiento | `avisoRegla`, `venc` |
| tramite | DGMIT y Dirección Administrativa | Aviso, Nota DGMIT | `inicioTramos`, `nota.recibida` |
| respuesta | Área responsable | Nota DGMIT, Datos recibidos | `nota.recibida`, `recibido` |
| produccion | DGMIT y Dirección de Investigación Territorial | Aviso, Datos recibidos | `inicioTramos`, `recibido` |
| carga | Datos Públicos | Datos recibidos, Carga en el portal | `recibido`, `carga` |

- [ ] **Paso 1: escribí los tests que fallan**

Con los casos reales (`casosReales()`), con y sin un destildado, en mediana y en promedio, en todos los tramos (también sin cifra):
- `modal.ciclos` con `estado` 'cuenta' son `tramo.cifra?.ciclos ?? 0`; 'en_curso', `tramo.en_curso?.n ?? 0`; 'pendiente', `tramo.pendientes ?? 0`. Un destildado no aparece.
- El orden: los que cuentan de más corridos a menos (empate: más hábiles, después título), después los en curso igual, al final las pendientes por `desde`.
- `dias_texto`: un caso armado que cuenta con 64/45, «64 días corridos (45 hábiles)»; uno de 0/0, «En el día»; un en curso, «hace 150 días corridos (102 hábiles)», con `hasta` null y `hasta_texto` «en curso»; una pendiente, `dias_texto` «—», `hasta_texto` «pendiente de carga» y `desde` la fecha del aviso que se muestra (`avisoMostrado`). Con fecha, `hasta_texto` ''.
- `nota`: un avisado ya vencido en el trámite o la producción dice «avisado ya vencido: desde ese primer aviso»; en las otras claves, ''.
- `leyenda`: «12 ciclos cuentan en la cifra», «1 ciclo cuenta en la cifra», «3 en curso, todavía no cuentan», «1 en curso, todavía no cuenta», «3 notas pendientes de carga, sin días», «1 nota pendiente de carga, sin días»; solo las que tienen ciclos; `marca` 'cuenta', 'en_curso' o 'pendiente'.
- `lista`: «Los ciclos (15)», con `ciclos.length`.
- `como_se_cuenta`, cada línea solo con n > 0 y con su singular, contada sobre las medidas de la gestión (sin destildados):
  - aviso: «N ciclos se avisaron cuando ya estaban vencidos: no cuentan en la anticipación.» (`heredado && inicioTramos !== null`, con vencimiento en el año); «N ciclos no tuvieron el aviso de la regla: no cuentan en la anticipación.» (los vencimientos del filtro de la cobertura en `resultadosDe` —vencimiento en el año, fecha de la regla desde `INICIO_DEL_REGISTRO`, `esperabaElAviso`— sin aviso de la regla, menos los de la línea anterior);
  - tramite: «N notas DGMIT de ciclos abiertos están pendientes de carga: cuentan cuando se cargan.» (N = `tramo.pendientes`); «N ciclos se avisaron ya vencidos: se cuentan desde ese primer aviso.» (N = las filas de la lista con esa `nota`); «N ciclos son de datasets que no requieren nota DGMIT: no cuentan en este tramo.» (`enLista && !aplicaNota`, como `aclaracionesDe`);
  - respuesta: «N ciclos abiertos todavía no tienen datos registrados, hace X: cuentan cuando se registra la actualización.» (X de `haceEnCursoDeLosDos`); «N ciclos se resolvieron con datos de una fuente pública: no cuentan en este tramo.» (el filtro de `aclaracionesDe`); la de no requieren nota;
  - produccion: la del en curso; la de los avisados ya vencidos (filas de la lista con esa `nota`);
  - carga: «N ciclos se resolvieron con datos de una fuente pública: la carga se cuenta desde que se obtuvo.» (los que cuentan en la carga con origen `fuente_publica`).
- `vacio`: «Sin ciclos en 2026.» con `ciclos` []; '' si no.
- `grafico`: el de `graficoDelTramo` con los que cuentan y los en curso (valor en corridos; título `${titulo}: ${dias_texto}`) y la línea `{ valor: cifra.valor, texto: \`${estadistico}: ${cifra.en_el_dia ? 'en el día' : \`${cifra.texto} ${cifra.unidad}\`}\` }`, o null sin cifra.
- Un tramo con solo ciclos en curso (una producción armada con dos abiertos y ninguno terminado): `tramo.cifra` null, dos ciclos en curso, `modal.grafico.linea` null y dos puntos `en_curso` (Review Focus 2).
- En la vista en hábiles, `modal` es null. `metricas-huellas.test.js` sigue verde.

- [ ] **Paso 2: corré `node --test tests/metricas-reglas.test.js` y mirá que fallen**

- [ ] **Paso 3: implementá `modalDelTramo(clave, gestion, medidas, ctx, tramo)`** con `medidas` las que cuentan de la gestión, como el tramo.

- [ ] **Paso 4: corré la suite de Métricas, commit y push** `feat(metricas): el modal de cada tramo, con sus ciclos, cómo se cuenta y el gráfico`

---

### Tarea 5: la cinta con los hábiles en sus rótulos (spec, 4)

**Files:**
- Modify: `services/metricasCinta.js` (`textoDelTramo`, los rótulos del aviso y de la carga)
- Test: `tests/metricas-cinta.test.js`

**Interfaces:**
- Consumes: `tramo.habiles` (tarea 2) y `cantidadDeLasDos` (tarea 1). Sin `habiles` (una vista en hábiles o una foto vieja), los rótulos de hoy.

- [ ] **Paso 1: escribí los tests que fallan**

Con `tramo()` del archivo sumando `habiles: { valor }`, en `dias: 'corridos'`:
- «Aviso · 51 días corridos (35 hábiles) antes», «Respuesta del área · 64 días corridos (45 hábiles)», «Entrega y carga, 3 días corridos (1 hábil) después», «Carga · 3 días corridos (en el día, en días hábiles) después».
- Con 0 corridos, «Aviso · el mismo día del vencimiento» y «Entrega y carga, el mismo día».
- Sin `habiles`, los textos de hoy.
- Con los casos reales en corridos (mediana y promedio), nada se pisa ni se sale y el rótulo del aviso está (`:218-234`, `:449-456`); si con el paréntesis no entra en ningún lado, va el de hoy, sin el paréntesis.

- [ ] **Paso 2: corré `node --test tests/metricas-cinta.test.js` y mirá que fallen**

- [ ] **Paso 3: implementá** un `cuantoDelTramo(t, dias)`: con `dias === 'corridos'` y `t.tramo.habiles?.valor` finito, `cantidadDeLasDos(t.valor, t.tramo.habiles.valor)`; si no, el `cuanto` de hoy. Para el aviso, primero con el paréntesis y, si `colocar` no le encuentra lugar, sin él.

- [ ] **Paso 4: corré la suite de Métricas, commit y push** `feat(metricas): la cinta dice los hábiles en sus rótulos`

---

### Tarea 6: sin selector de días, en el servidor, los PDF y la página (spec, 4 y 7)

**Files:**
- Modify: `services/metricasOpciones.js` (`opcionesDeMetricas`)
- Modify: `controllers/reportesController.js` (`COMBINACION_DEL_INFORME` y su comentario)
- Modify: `services/reportesMetricasPdf.js` (`TEXTOS_DE_LA_PESTANA.bajada` y `.pieDelCircuito`, `prepararComoSeCuenta`)
- Modify: `public/js/reportes.js` (`DIAS`, `ESTADO_POR_DEFECTO`, `BAJADA_DE_LOS_DIAS`, `textoDeLaBajada`, `estadoDeLaUrl`, `parametrosDe`, `conSelector`, `htmlDeBarra`, `pedidoDeReporte`, `alCambiarSelector`)
- Modify: `public/reportes.html` (`#mt-bajada`, el pie del circuito y su comentario, `reportes.js?v=20261213`)
- Modify: `public/configuracion.html` (`feriados.js?v=20261214`)
- Test: `tests/metricas-opciones.test.js`, `tests/metricas-api.test.js`, `tests/metricas-foto.test.js`, `tests/feriados-en-metricas.test.js`, `tests/reportes-frontend.test.js`, `tests/reportes-pdf.test.js`, `tests/paginas.test.js`

**Interfaces:**
- Produces: `opcionesDeMetricas(q).dias === 'corridos'` siempre; `COMBINACION_DEL_INFORME = { estadistico: 'mediana', dias: 'corridos' }`; `T.bajada`, un texto (la bajada de los días); `T.pieDelCircuito`, el nuevo; la página sin `dias` en su estado. `VERSION_REPORTES = '20261213'` y `VERSION_FERIADOS = '20261214'`: las tareas 7 y 8 no las vuelven a subir (todo sale en el mismo kit).

- [ ] **Paso 1: escribí los tests que fallan**

- `opcionesDeMetricas({ dias: 'habiles' }).dias`, `({ dias: 'x' })` y `({})`: 'corridos' (cambia `DE_ENTRADA`).
- `GET /api/metricas?dias=habiles` da lo mismo que sin `dias` (reemplaza «?dias=corridos cambia las cifras», `:164-204`); la cifra de `:171-177` es la de corridos; los tramos traen `como_se_cuenta`, `habiles` y `modal`.
- `GET /api/metricas/pdf?dias=habiles`: el mismo texto por hoja que sin `dias` (Review Focus 1).
- La foto: `vistas['mediana-corridos']` con `como_se_cuenta`, `habiles` y `modal`; `vistas['mediana-habiles']` con `modal` null. Las comparaciones de cada combinación con la foto (`:360-388`, `:542-549`) siguen, con las claves nuevas. «Una foto sin una vista» (`:481-506`) pasa a quitar `mediana-habiles` (ahora la de corridos es la que se lee: sin ella, `deLaFoto` tira, como hoy con la elegida), y el caso «sin los hábiles» se arma quitando `habiles` y `habiles_texto` de los tramos.
- Una foto guardada sin las claves nuevas (quitadas del JSON): `metricasDe` responde, el PDF y el Informe salen (Review Focus 5).
- El Informe lee la vista en corridos: su hoja 2 dice «… días corridos (… hábiles) después.».
- `feriados-en-metricas.test.js` `:336-366` y `:390`: lo que leía la cifra en hábiles (25 y 38, que prueban la tabla de feriados) lee `tramo.habiles.valor`; `:184-192` no cambia.
- La página: `htmlDeBarra` no tiene el grupo «Cómo se cuentan los días»; `estadoDeLaUrl('?dias=habiles')` no tiene `dias`; `urlDeEstado`, `consultaDeLaApi` y el pedido del PDF de Métricas nunca lo escriben (`reportes-frontend.test.js` `:67`, `:101-182`, `:194-201`, `:225-228`, `:269-274`, `:1212-1223`, `:1292`).
- La paridad (`:1763-1798`): `#mt-bajada` y `textoDeLaBajada()` terminan en `T.bajada`; el pie del circuito del HTML es `T.pieDelCircuito`.
- «Cómo se cuenta» del PDF empieza con `T.bajada`.
- Los ayudantes de `reportes-pdf.test.js` que arman la vista (`metricasDeLosCasos`, `:744`, y `fotoDeLosCasos`, `:1858`) pasan a días corridos.

- [ ] **Paso 2: corré la suite de Métricas y mirá que fallen los nuevos**

- [ ] **Paso 3: implementá**

`opcionesDeMetricas` deja de leer `q.dias`. `DIAS` no cambia (la foto guarda las cuatro combinaciones y el Ciclo de vida usa la de hábiles). `metricasConOpciones` y `enVivo` no cambian: piden lo que dan las opciones. `prepararComoSeCuenta` ya no recibe `dias`. En la página, todo lo de `dias` se va; `alCambiarSelector` ya no conoce `dias`.

- [ ] **Paso 4: volvé a tomar `REFERENCIA_DE_LOS_PDF`, corré la suite de Métricas, commit y push** `feat(metricas): sin selector de días: todo en corridos con los hábiles entre paréntesis`

---

### Tarea 7: los cajones, en la página y en los PDF (spec, 3 y 6)

**Files:**
- Modify: `services/reportesMetricasPdf.js` (`etapaDe`, `cuerpoDeLaAnticipacion`, `aclaracionesDe` del PDF, `T.seCuentaHasta`, `LINEAS_DE_LOS_DESTILDADOS` si hace falta)
- Modify: `public/js/reportes.js` (`htmlDeFlecha`, `SE_CUENTA_HASTA`)
- Modify: `public/reportes.html` (la clase `.h` del paréntesis)
- Test: `tests/reportes-pdf.test.js`, `tests/reportes-frontend.test.js`

**Interfaces:**
- Consumes: `como_se_cuenta`, `habiles_texto`, `aclaraciones.*.pendientes` y `.en_curso` (tarea 2).
- Produces: `T.seCuentaHasta` y `SE_CUENTA_HASTA` se van, juntos.

- [ ] **Paso 1: escribí los tests que fallan**

La página (`htmlDeFlecha`):
- Con cifra: `<span class="c">${como_se_cuenta}</span>`, sin `desde_hasta`, sin `class="c pend"`, sin `class="c curso"` ni «Se cuenta hasta…» (cambian `:282-371` y `:419-459`).
- `<span class="h">${habiles_texto}</span>` debajo del número cuando no es ''; en el cajón del aviso, después de `mt-anticipa-frase`.
- El trámite sin cifra: el título del vacío y la frase, sin `vacio.texto`; la respuesta sin cifra, con su `vacio.texto`.
- Sin `como_se_cuenta` (foto vieja), `desde_hasta`. El aviso con la línea no lleva la frase; sin la línea, sí.

Los PDF:
- La hoja 1 de Métricas y del Informe: cada tarjeta con cifra tiene su `como_se_cuenta` entero; ninguna dice «Se cuenta hasta que se registra», «sin datos registrados todavía» ni «pendientes de carga» (cambian `:945` y `:961`).
- Las 5 frases, enteras (sin «…»), en los 3 escalones de `LETRAS_DEL_CIRCUITO` y en la columna más angosta (la externa).
- El paréntesis sale de `habiles_texto`; sin esa clave, de `textoDeHabiles` con la otra vista, como hoy. Sin `como_se_cuenta`, `desde_hasta`.
- «Cómo se cuenta»: en cada gestión, primero `pendientes` y `en_curso` y después las de hoy (cambia `:3273`).
- La letra: con `conRespuestaConCifra()` (`:3242`), las dos gestiones entran en la hoja 1 con el primer escalón (cifra de 21 pt): es lo que pidió el usuario. «La interna pasa entera a la hoja siguiente» (`:3358-3368`) se fuerza ahora con el orientativo en todas las tarjetas, la frase de 4 renglones y, si no alcanza, un `vacio.titulo` de 3 renglones en la respuesta.
- Los fixtures de lo más largo (`FILAS_LARGAS`, `:773-788`, y `tramoAMano`, `:803`) pasan a los textos más largos de la spec, sección 4 («en curso, 308 días corridos (220 hábiles) desde el aviso»), con `como_se_cuenta` y `habiles_texto`; con ellos, la tabla de los destildados tiene su fila más larga entera.
- Nada se pisa ni se sale (`verificarDiagramacion`) en Métricas y en el Informe, con mediana y promedio.
- La paridad: el test de `:1784` deja de pedir `T.seCuentaHasta`.

- [ ] **Paso 2: corré `node --test tests/reportes-pdf.test.js tests/reportes-frontend.test.js` y mirá que fallen**

- [ ] **Paso 3: implementá**

- `etapaDe`: en el cuerpo común, `chico(texto(t.como_se_cuenta) || t.desde_hasta, { lineas: 4 })`; sin `pendientes` ni el en curso; el vacío del trámite sin su `texto`; el paréntesis con `typeof t.habiles_texto === 'string' ? t.habiles_texto : textoDeHabiles(cifra, h.cifra)`. Lo mismo en `cuerpoDeLaAnticipacion`.
- `aclaracionesDe` del PDF: `[a.pendientes, a.en_curso, a.ya_vencidos, a.fuente_publica, a.no_requieren_nota]`.
- `htmlDeFlecha`, con lo mismo. La clase `.h` en el `<style>`: 0.8rem, 700, en la tinta de la tarjeta (violeta en `.dgmit`, el color del área en la del área).
- Si la tabla de los destildados corta la fila más larga, subí `LINEAS_DE_LOS_DESTILDADOS`.

- [ ] **Paso 4: volvé a tomar `REFERENCIA_DE_LOS_PDF`, corré la suite de Métricas, commit y push** `feat(metricas): los cajones con una frase, en la página y en los PDF`

---

### Tarea 8: la banda y el modal, en la página (spec, 5)

**Files:**
- Modify: `public/js/reportes.js` (`htmlDeNodo`, `htmlDeCircuito`; `htmlDelModal` y `svgDelGrafico`, nuevos y puros; abrir y cerrar, al final, con los eventos delegados en el contenedor fijo del circuito)
- Modify: `public/reportes.html` (el modal, hijo de `body` después de `.app-container`; sus estilos)
- Test: `tests/reportes-frontend.test.js`

**Interfaces:**
- Consumes: `tramo.modal` (tarea 4), `sin_texto` de la API.
- Produces: `htmlDeNodo(nodo, tramo)`, `htmlDelModal(tramo, { sinTexto }) -> string`, `svgDelGrafico(grafico) -> string`.

- [ ] **Paso 1: escribí los tests que fallan**

`VISTA` y `vistaReal()` (`:57-58`) pasan a `dias: 'corridos'` (en hábiles, `modal` es null).
- `htmlDeCircuito`: cuatro `<button type="button" class="mt-nodo…" data-tramo="…" data-gestion="externa" aria-haspopup="dialog" aria-label="Ver los ciclos de ${nombre del tramo}">` en la externa y tres en la interna; el Portal sigue `<div class="mt-nodo fin">`; el orden de los hijos de `.mt-tramos` no cambió; cada botón dice «Ver los ciclos» y su ícono lleva `aria-hidden="true"`.
- Un tramo sin `modal` (foto vieja): el nodo es un `<div>` como hoy.
- `htmlDelModal`: el título en `<h2 class="modal-title" id="mt-modal-titulo">`; `quien`; con `sinTexto`, la franja; la frase; la cifra con `habiles_texto` y `debajo` (sin cifra, el vacío); la leyenda con su marca (`mt-ley-cuenta`, `mt-ley-curso`, `mt-ley-pend`); `svgDelGrafico`; «Cómo se cuenta» solo si hay líneas; `lista`; la tabla dentro de `<div class="mt-modal-tabla">`, con `puntas`, el link `seguimiento.html?id=N` y, en curso o pendiente, `hasta_texto`; con `vacio`, el vacío y sin tabla.
- Todo lo del servidor escapado: un título `<b>"x"</b>` aparece escapado en la tabla y en el `<title>` de su punto.
- `svgDelGrafico(null)` es ''; con un gráfico: `<svg class="mt-grafico" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Un punto por ciclo según sus días corridos. La lista de abajo tiene los mismos datos.">`, un círculo lleno por punto que cuenta (con su anillo blanco), un aro con su flecha por punto en curso, la línea si viene, los «+N» y el eje, todo con las coordenadas del servidor.
- El CSS (leído de `reportes.html`): `button.mt-nodo` con `font: inherit`, `text-align: left`, `border: 0`, `width: 100%`; `button.mt-nodo:focus-visible` con `outline-offset` negativo; con `forced-colors`, borde en el botón; `.mt-grafico` con `display: none` por debajo de 600px; `.mt-modal-tabla` con `overflow-x: auto`; `.mt-modal .modal-body` y `#mt-modal-tramo` con `overscroll-behavior: contain`; `.mt-modal .modal-close` con un color de 4,5:1 o más sobre blanco; con `prefers-reduced-motion: reduce`, `.mt-modal` sin `transform` ni `transition`.

- [ ] **Paso 2: corré `node --test tests/reportes-frontend.test.js` y mirá que fallen**

- [ ] **Paso 3: implementá**

- Lo puro arriba; lo que toca el DOM al final, como el resto del archivo:
  - `abrirModalDelTramo(gestion, clave)`: arma el HTML con `pagina.datos`, pone `.active`, `inert` en `.app-container` y `overflow: hidden` en `body`, guarda `{ gestion, clave }` y a los 100 ms pasa el foco a la × (como el Seguimiento).
  - `cerrarModalDelTramo()`: saca `.active`, `inert` y el `overflow`, y devuelve el foco al botón con ese `data-tramo` (si la banda se redibujó, al nuevo); si no está, al chip de la gestión elegida.
  - Escape, la × y un clic en el velo cierran; `cargarMetricas` lo cierra antes de dibujar.
- El modal en `reportes.html`: `<div class="modal-overlay" id="mt-modal-tramo"><div class="modal mt-modal" role="dialog" aria-modal="true" aria-labelledby="mt-modal-titulo" id="mt-modal-contenido"></div></div>`.
- Los estilos, con los tokens de la página: `.mt-modal` de 900px.

- [ ] **Paso 4: corré la suite de Métricas, commit y push** `feat(metricas): la banda abre el modal de los ciclos de cada tramo`

---

### Tarea 9: la documentación, la suite y la verificación con los datos locales

**Files:**
- Modify: `docs/temas/metricas-y-reportes.md` (las líneas 19, 31-32, 56-67, 81-87, 101-113, 118, 133, 182-197, 219-244; una sección nueva «El modal de cada tramo»; la spec en la lista de arriba)
- Modify: `docs/temas/ciclo-de-vida.md` (la 22, porque `circuito.aclaraciones` ya no es solo lo de `aclaracionesDe`, y la 43, que deja de ser cierta)

- [ ] **Paso 1: actualizá los documentos**

Lo vigente, un renglón por oración, sin «pasó a» ni historia: la frase y lo que lleva un cajón; las dos unidades y sin selector; el modal (qué muestra, de dónde sale, cómo se usa); «Cómo se cuenta» del PDF; las claves nuevas del tramo, y que las de hoy no cambian porque las lee el Ciclo de vida; `metricasGrafico.js` en «Archivos»; la foto (claves nuevas, versión 1, tolerancia). Con la decisión y su motivo donde alguien podría «arreglarla»: por qué `desde_hasta` sigue en `TRAMOS` y la frase va aparte; por qué los pendientes y los en curso no se borraron (antiobjetivo: un caso que nunca termina no desaparece).

- [ ] **Paso 2: con el contenedor libre, corré `npm test` completo**

Esperado: todo verde, con la cantidad de tests de la línea de base más los nuevos (`tests/documentos.test.js` incluido).

- [ ] **Paso 3: mirá el resultado con los datos de la copia local, fuera del repo**

Con un script en el scratchpad, como `~/rpad-notas/metricas-textos-cajones/scripts/simular.mjs`, que importa los módulos del worktree: el PDF «Métricas del año» de hoy, el Informe anual simulado al 10/01/2027 y la página con el servidor local (en un puerto libre, sin tocar el 3001), con capturas de la banda, de un modal por tramo y del teléfono.
- Las cifras coinciden con las de antes del cambio, y las cantidades del modal, con las del cajón.
- Con el teclado: Tab hasta una flecha, Enter abre, Tab no sale del modal, Escape cierra y el foco vuelve a la flecha.
- A 375 píxeles, el modal más largo (el del aviso) se desplaza adentro con la × a la vista, la tabla se desplaza de costado y la página de atrás no se mueve (Review Focus 4).

Nada de eso va al repo.

- [ ] **Paso 4: commit y push** `docs(metricas): los cajones con una frase, el modal de cada tramo y las dos unidades`

- [ ] **Paso 5: revisión final de toda la rama** con un revisor que no la escribió (Opus); avisale a la coordinadora `TODO EN VERDE` con el resultado de la suite y el commit.
