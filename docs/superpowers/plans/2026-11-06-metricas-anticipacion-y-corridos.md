# La anticipación, los días corridos primero y tres correcciones: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir el aviso de la regla de un ciclo reprogramado y dos textos, poner primero los días corridos en los PDF y darle otro diseño al cajón «Aviso anticipado».

**Architecture:** Las reglas y los textos siguen en `services/metricasReglas.js`, y los dibujantes imprimen lo que manda el servidor (Ruling 19). Los PDF reciben las dos vistas del circuito, en corridos y en hábiles; la página sigue con la vista elegida. La forma de la foto no cambia: suma una clave en cada tramo del aviso y `VERSION_DE_LA_FOTO` sigue en 1.

**Tech Stack:** Node.js 22, ES Modules, PDFKit, vanilla JS, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-06-metricas-anticipacion-y-corridos-design.md`. Antes de cada tarea, leé la sección que la tarea nombra y los documentos de `docs/temas/metricas-y-reportes.md` y `docs/temas/ciclo-de-vida.md`.

## Antes de empezar

Este plan espera su turno en la fila de la sesión coordinadora.

1. Traé el `main` y fijate qué cambió desde `3a55679`; ajustá lo que haga falta.
2. Copiá el `.env` del checkout principal al worktree, sin mostrarlo, con `RPAD_TESTS_DB_LOCAL=1`. Si falta `node_modules`, copialo como carpeta real o corré `npm ci`.
3. Corré `npm test` y anotá el resultado: es la línea de base. Una sola suite a la vez por contenedor.

## Global Constraints

- Repositorio público: ningún nombre real, ningún dato ni cifra de producción, tampoco en tests ni comentarios. Los ejemplos son inventados.
- Lenguaje neutro: nunca «tardanza», «demora», «atraso», «sin respuesta», «sin entregar» ni «no mandó».
- El servidor arma cifras y textos; la página y los PDF los imprimen (Ruling 19). Nada se recalcula en el navegador.
- Todo texto del servidor pasa por `Utils.escapeHtml` en la página.
- Cada `?v=` está atado a su constante de `tests/paginas.test.js`.
- Ninguna clase ni id empieza con `ad-`. Foco visible y 4,5:1 o más en todo texto.
- `VERSION_DE_LA_FOTO` sigue en 1. Sin SQL.
- `metricasReglas.js` es puro: sin pool ni `Date` local.
- En los PDF, los elementos se miden antes de dibujarse y las formas adentro de un recuadro no son `roundedRect` ni un `rect` chico (`tests/pdf-diagramacion.js`, que no se afloja).
- Nunca `docker compose` desde un worktree ni `down -v`. Docker: `/Applications/Docker.app/Contents/Resources/bin/docker`. No llames a `/api/cron/*`. Ningún email real.
- Nunca tocar producción ni desplegar. Una rama remota no se borra ni se reescribe sin que lo diga el usuario.
- Cada commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tiene que estar en producción antes del 10/01/2027; lo despliega el usuario.
- **`REFERENCIA_DE_LOS_PDF`** (`tests/reportes-pdf.test.js`): cuando una tarea cambia a propósito esos PDF, vuelve a tomar los sha que da el test al fallar, y antes comprueba con el diff de texto hoja por hoja que cambió solo lo de esa tarea.

## Review Focus

1. Un ciclo reprogramado con una nota DGMIT anterior al aviso nuevo: hasta que sale el aviso, la nota no está pendiente y no cuenta en la redacción; después, la redacción da «En el día». Tarea 1.
2. Con datasets destildados, las dos vistas salen sin ellos: la cifra grande y los hábiles de abajo hablan de los mismos ciclos. Tarea 4.
3. Una foto a la que le falta una de las dos combinaciones: el PDF no tira y sale con lo elegido, sin paréntesis, con la solapa de lo elegido. Tarea 4.
4. Un aviso de 1 día y uno de 0: «1 día corrido de anticipación», y con «En el día» el cajón de siempre, sin línea. Tareas 2, 5 y 6.
5. El cajón nuevo en lo más alto de la hoja: con lo más largo de cada campo, las dos gestiones siguen en la hoja 1 y nada se pisa. Tarea 5.

---

### Tarea 1: el aviso de la regla de un ciclo reprogramado (spec, 3)

**Modelo:** Opus (reglas).

**Files:**
- Modify: `services/metricasReglas.js` (`casoDelCiclo`, `deLaRegla` y `fechaRegla`)
- Test: `tests/metricas-reglas.test.js`, en `describe('casosDe')`

**Interfaces:**
- Produces: `aviso_regla`, `inicio_tramos` y `reiteraciones_rpad` con la regla nueva. Los nombres no cambian.

- [ ] **Paso 1: escribí los tests que fallan**

Con `solo`, `email`, `nota`, `cambio`, `notaDgmit` y `con` de `tests/metricas-casos.js`, y el `casosDel(fuentes, hoy)` del archivo. El dataset de ejemplo vencía el 31/03/2026 y un cambio aprobado el 04/03/2026 lo pasó al 30/06/2026, cuya fecha de la regla es el 21/05/2026:

```js
const reprogramado = (extra = {}) => solo(
  { id: 900, titulo: 'Reprogramado', alta: '2026-01-05 09:00:00', proxima: '2026-06-30', ultima: '2025-12-31' },
  { cambios: [cambio({ id: 70, creado: '2026-03-04 10:00:00', revisado: '2026-03-04 11:00:00', dataset_id: 900,
      nuevos: { proxima_actualizacion: '2026-06-30', ultima_actualizacion: '2025-12-31' },
      anteriores: { proxima_actualizacion: '2026-03-31', ultima_actualizacion: '2025-12-31' } })], ...extra });
const de40 = (id, enviado, datos = {}) => email({ id, tipo: 'externo-40', enviado, ...datos });

it('el aviso de la regla de un ciclo reprogramado es el del vencimiento que rige', () => {
  const [caso] = casosDel(reprogramado({ emails: [de40(901, '2026-02-19 08:00:00'), de40(902, '2026-05-21 08:00:00')] }), '2026-06-01');
  assert.deepEqual([caso.venc, caso.fecha_regla, caso.aviso_regla, caso.inicio_tramos, caso.primer_aviso, caso.reiteraciones_rpad, caso.aviso_que],
    ['2026-06-30', '2026-05-21', '2026-05-21', '2026-05-21', '2026-02-19', 0, 'email de 40 días']);
  assert.deepEqual(caso.avisos_rpad, ['2026-02-19', '2026-05-21']);
});
it('un aviso el mismo día de la fecha de la regla sí cuenta', () => { /* solo el 902: aviso_regla '2026-05-21' */ });
it('sin el aviso nuevo no hay aviso de la regla', () => {
  // Solo el 901, al 01/04: aviso_regla null, inicio_tramos null, motivo_sin_aviso null (su regla todavía no llegó)
  // Solo el 901, al 01/06: aviso_regla null, motivo_sin_aviso 'sin-aviso'
});
it('una Nota Digital de aviso anterior a la fecha de la regla tampoco es el aviso', () => {
  // nota({ id: 903, tipo: 'aviso', seccion: 'proximo', fecha: '2026-02-19', enviada: '2026-02-19 08:15:00', vencimiento: '2026-03-31' }): aviso_regla null
});
it('un email de la regla anterior que no se pudo enviar no da el motivo', () => {
  // de40(904, '2026-02-19 08:00:00', { success: false }), al 01/06: motivo_sin_aviso 'sin-aviso', no 'email-fallido'
});
it('una nota DGMIT anterior al aviso nuevo', () => {
  // notaDgmit({ id: 5, recibida: '2026-03-10' }) con el 901: al 01/04, nota_dgmit cargada, inicio_tramos null;
  // vistaDe al 01/04: tramite sin cifra de este ciclo y pendientes 0
  // Con el 902, al 01/06: vistaDe da cifra.valor 0 y cifra.en_el_dia true en tramite
});
```

- [ ] **Paso 2: comprobá que fallan**

Run: `node --test tests/metricas-reglas.test.js`
Expected: FAIL en estos tests; el primero, con `aviso_regla` en `'2026-02-19'`.

- [ ] **Paso 3: implementá la regla**

Mové la línea de `fechaRegla` antes de `deLaRegla`, y `deLaRegla` pasa a ser `(a) => a.regla && venc !== null && a.dia >= fechaRegla && a.dia <= venc`. Actualizá el comentario de `casoDelCiclo` y el de `casosDe`, citando la spec. Con `venc` null, `deLaRegla` sigue dando falso antes de comparar.

- [ ] **Paso 4: comprobá que pasan**

Run: `node --test tests/metricas-reglas.test.js tests/metricas-foto.test.js tests/feriados-en-metricas.test.js`
Expected: PASS. Si un caso existente cambia, tiene que ser un aviso anterior a su fecha de la regla: decilo en el reporte y corregí su valor esperado.

- [ ] **Paso 5: commit**

`fix(metricas): el aviso de la regla de un ciclo reprogramado es el del vencimiento que rige`

---

### Tarea 2: los textos del servidor (spec, 4, 6 y 7)

**Modelo:** Opus (reglas).

**Files:**
- Modify: `services/metricasReglas.js` (`notasPendientes`, `tramoDelCircuito`; suma `textoEnCursoDeLosDos`)
- Test: `tests/metricas-reglas.test.js` (hoy, líneas 726 a 770 y 984, entre otras), `tests/reportes-pdf.test.js` (`REFERENCIA_DE_LOS_PDF`)

**Interfaces:**
- Produces:
  - `tramo.anticipacion_texto`: `string | null`, en todo tramo de `vistaDe`.
  - `export const textoEnCursoDeLosDos = (enCorridos, enHabiles, estadistico) => string`. `enCorridos` y `enHabiles`: `{ n, valor, texto }` (`en_curso` de cada vista) o null. Sin `enCorridos`, `''`. Sin `enHabiles`, `enCorridos.texto`.

- [ ] **Paso 1: escribí los tests que fallan**

```js
// notasPendientes, por el tramo
assert.equal(tramoDe(uno, 'externa', 'tramite').pendientes_texto, '1 nota pendiente de carga de un ciclo abierto');
assert.equal(tramoDe(tres, 'externa', 'tramite').pendientes_texto, '3 notas pendientes de carga de ciclos abiertos');
assert.equal(tramoDe(sinNinguna, 'externa', 'tramite').vacio.texto, '0 notas pendientes de carga de ciclos abiertos');

// anticipacion_texto
assert.equal(aviso(hábiles).anticipacion_texto, 'días hábiles de anticipación');
assert.equal(aviso(corridos).anticipacion_texto, 'días corridos de anticipación');
assert.equal(avisoConValor1.anticipacion_texto, 'día hábil de anticipación');
assert.equal(avisoEnElDia.anticipacion_texto, null);
assert.equal(avisoSinCifra.anticipacion_texto, null);
assert.equal(tramoDe(v, 'externa', 'respuesta').anticipacion_texto, null);

// textoEnCursoDeLosDos
const c = (n, valor) => ({ n, valor, texto: 'la de la vista' });
assert.equal(textoEnCursoDeLosDos(c(4, 120), c(4, 80), 'mediana'), '4 sin datos registrados todavía, hace 120 días corridos (80 hábiles, mediana)');
assert.equal(textoEnCursoDeLosDos(c(1, 1), c(1, 1), 'promedio'), '1 sin datos registrados todavía, hace 1 día corrido (1 hábil, promedio)');
assert.equal(textoEnCursoDeLosDos(c(2, 3), c(2, 0), 'mediana'), '2 sin datos registrados todavía, hace 3 días corridos (menos de 1 hábil, mediana)');
assert.equal(textoEnCursoDeLosDos(c(2, 0), c(2, 0), 'mediana'), '2 sin datos registrados todavía, hace menos de 1 día corrido (mediana)');
assert.equal(textoEnCursoDeLosDos(c(2, 3), null, 'mediana'), 'la de la vista');
assert.equal(textoEnCursoDeLosDos(null, c(2, 3), 'mediana'), '');
```

- [ ] **Paso 2: comprobá que fallan**

Run: `node --test tests/metricas-reglas.test.js`
Expected: FAIL.

- [ ] **Paso 3: implementá**

`anticipacion_texto` en `tramoDelCircuito`: `clave === 'aviso' && cifra !== null && !cifra.en_el_dia ? \`${cifra.unidad} de anticipación\` : null`. Actualizá los valores esperados de los tests que comparan `pendientes_texto` y el vacío; en los tests del Ciclo de vida, solo el texto de los pendientes.

- [ ] **Paso 4: tomá de nuevo la referencia y comprobá**

Run: `node --test tests/metricas-reglas.test.js tests/metricas-foto.test.js tests/metricas-api.test.js tests/reportes-pdf.test.js tests/reportes-frontend.test.js`
Expected: PASS, después de tomar `REFERENCIA_DE_LOS_PDF` donde cambió solo «de ciclos abiertos». `anticipacion_texto` no se dibuja todavía.

- [ ] **Paso 5: commit**

`feat(metricas): «de ciclos abiertos», el texto de la anticipación y los dos en curso`

---

### Tarea 3: el Ciclo de vida, primero los corridos (spec, 6, «El Ciclo de vida»)

**Modelo:** Opus (reglas y PDF).

**Files:**
- Modify: `services/metricasReglas.js` (`diasEnPalabras`, `extremoDe`, `etapaDelReporte`, `etapasDe`, `conAnterior`)
- Modify: `services/reportesCicloDeVidaPdf.js` (`ROTULO_DEL_INDICE`, `COMO_SE_CUENTA`, `dibujarMediana`, `dibujarPromedio`, el extremo; las claves `corridosMediana` y `corridosPromedio` de `LETRA` pasan a `habilesMediana` y `habilesPromedio`)
- Test: `tests/metricas-reglas.test.js` (`etapasDe`, `conAnterior`), `tests/reportes-pdf.test.js` (el Ciclo de vida), `tests/metricas-api.test.js` (hoy, 680, 729 y 732), `tests/metricas-foto.test.js`, `tests/feriados-en-metricas.test.js` (hoy, 364 y 365)

**Interfaces:**
- Consumes: `textoEnCursoDeLosDos` (tarea 2).
- Produces: `textos.mediana` y `textos.promedio`: `{ numero, unidad, habiles }`. Cada extremo: `{ …, numero, unidad, habiles_texto, … }`, en lugar de `corridos_texto`. `habiles`, `corridos`, `n` y el orden de los extremos no cambian.

- [ ] **Paso 1: escribí los tests que fallan**

```js
// diasEnPalabras, por sus etapas: la mediana con 83 corridos y 53 hábiles
assert.deepEqual(aviso.textos.mediana, { numero: '83', unidad: 'días corridos', habiles: '53 días hábiles' });
assert.deepEqual(aviso.textos.promedio, { numero: '84', unidad: 'días corridos', habiles: '(54 días hábiles)' });
assert.equal(aviso.textos.indice, '83');
// 0 y 0
assert.deepEqual(carga.textos.mediana, { numero: 'En el día', unidad: '', habiles: '' });
// Un ciclo con días corridos y 0 hábiles: armalo con las fechas que den 0 en diasHabilesTranscurridos
assert.deepEqual(finDeSemana.largo, { ...finDeSemana.largo, numero: '3', unidad: 'días corridos', habiles_texto: 'En el día, en días hábiles' });
// 1 y 1, y los singulares
assert.deepEqual(unaCarga.textos.mediana, { numero: '1', unidad: 'día corrido', habiles: '1 día hábil' });
// Los extremos se siguen eligiendo por hábiles: el de más hábiles gana aunque otro tenga más corridos
assert.deepEqual([largo.habiles, largo.corridos, largo.dataset_id], [/* el de más hábiles */]);
// En curso
assert.deepEqual(respuesta.textos.notas.find(n => n.tipo === 'en_curso').texto, 'En curso: 4 sin datos registrados todavía, hace 120 días corridos (80 hábiles, mediana)');
// Año anterior
assert.equal(anterior('externa', 'aviso'), 'Año anterior: mediana de 45 días corridos');
assert.equal(anterior('interna', 'aviso'), 'Año anterior: mediana de 1 día corrido');
assert.equal(anterior('externa', 'carga'), 'Año anterior: mediana en el día');
// El PDF: en la hoja, en este orden, «Mediana», «83», «días corridos», «53 días hábiles», «de N ciclos»; el promedio con «(54 días hábiles)»
// El rótulo y «Cómo se cuenta»
assert.ok(lineas.includes('EL CIRCUITO · MEDIANA EN DÍAS CORRIDOS'));
assert.ok(TEXTOS_DEL_CICLO.comoSeCuenta(2026).startsWith('Días corridos: todos los días del calendario. Junto a ellos, los hábiles: de lunes a viernes, sin feriados ni días no laborables.'));
```

Los números van con los casos que armes: lo que pide cada aserción es la forma y qué número va en cada lugar.
El test de paridad de la mediana y el promedio contra `vistaDe`, en las cuatro combinaciones, no se toca y tiene que seguir pasando.

- [ ] **Paso 2: comprobá que fallan**

Run: `node --test tests/metricas-reglas.test.js tests/reportes-pdf.test.js`
Expected: FAIL.

- [ ] **Paso 3: implementá**

`diasEnPalabras(habiles, corridos)`:
- `corridos` no es un número finito: `habiles === 0` da «En el día»; si no, `{ numero: String(habiles), unidad: unidadDe(habiles, 'habiles'), habiles: '' }`.
- Los dos en 0: `{ numero: 'En el día', unidad: '', habiles: '' }`.
- `habiles === 0`: el número en corridos y `habiles: 'En el día, en días hábiles'`.
- Si no: el número en corridos y `habiles: '53 días hábiles'`.

`etapasDe` guarda `corridosEnCurso: medir(h, ctx.corridos).enCurso` con `medir` una sola vez por unidad. La nota del en curso: `En curso: ${textoEnCursoDeLosDos(enCursoDelTramo(valores, ctx.corridos), tramo.en_curso, 'mediana')}`.
`conAnterior` lee `etapa.corridos.mediana`.
`COMO_SE_CUENTA` empieza con el texto del test.
Actualizá los comentarios que describen estas formas.

En `tests/feriados-en-metricas.test.js`, «Año anterior» ya no depende del calendario: la aserción pasa a la mediana en corridos del año anterior. Lo que cubre el calendario queda en los tests de `etapasDe` en hábiles de ese archivo y en que `lecturas` siga en 1.

- [ ] **Paso 4: comprobá**

Run: `node --test tests/metricas-reglas.test.js tests/reportes-pdf.test.js tests/metricas-api.test.js tests/metricas-foto.test.js tests/feriados-en-metricas.test.js`
Expected: PASS, con `verificarDiagramacion` en las hojas del Ciclo de vida, también en la más apretada. `REFERENCIA_DE_LOS_PDF` no incluye este PDF.

- [ ] **Paso 5: commit**

`feat(ciclo-de-vida): primero los días corridos, con los hábiles junto a ellos`

---

### Tarea 4: la hoja 1 de Métricas y del Informe, primero los corridos (spec, 5 y 6)

**Modelo:** Opus (PDF).

**Files:**
- Modify: `controllers/metricasController.js` (`enVivo`, `metricasConOpciones`, `pdfDeMetricas`; `circuitoEnCorridosDeLaFoto` se reemplaza)
- Modify: `controllers/reportesController.js` (el Informe anual)
- Modify: `services/reportesMetricasPdf.js` (`EN_EL_ANIO`, `textoDeLaPildora`, `textoDeCorridos` se reemplaza, `etapaDe`, `piezaDelCircuito`, `dibujarElCircuito`)
- Modify: `services/reportesInformeAnualPdf.js` (solo el comentario de lo que recibe)
- Test: `tests/reportes-pdf.test.js` (`metricasDeLosCasos`, `fotoDeLosCasos`, `conNotaDgmit`, `enHabilesConParentesis`, `describe('los días corridos entre paréntesis')`), `tests/metricas-api.test.js` (hoy, 400 a 420), `tests/reportes-frontend.test.js` (si importa `textoDeLaPildora`)

**Interfaces:**
- Consumes: `textoEnCursoDeLosDos` (tarea 2).
- Produces:
  - Los PDF reciben `datos.circuito_en_corridos` y `datos.circuito_en_habiles`, con la forma de `vista.circuito`, con cualquiera de los dos selectores.
  - `export const circuitosDeLaFoto = ({ datos }, estadistico) => ({ circuito_en_corridos, circuito_en_habiles })`, cada uno `circuito | null`, en `metricasController.js`.
  - `export const textoDeHabiles = (cifra, habil) => string`, en `reportesMetricasPdf.js`.
  - `etapaDe(doc, clave, tramo, ancho, letra, { habil, estadistico })`: `habil` es el tramo de la vista en hábiles, o null.
  - `const circuitoDeLaHoja = (d) => ({ tramos, habiles, combinada })`, en `reportesMetricasPdf.js`: `combinada` es verdadero si llegaron las dos vistas con las dos gestiones.

- [ ] **Paso 1: escribí los tests que fallan**

```js
const cifra = (texto, unidad, en_el_dia = false) => ({ texto, unidad, en_el_dia });
it('textoDeHabiles: cada caso de la spec', () => {
  assert.equal(textoDeHabiles(cifra('83', 'días corridos'), cifra('53', 'días hábiles')), '(53 días hábiles)');
  assert.equal(textoDeHabiles(cifra('1', 'día corrido'), cifra('1', 'día hábil')), '(1 día hábil)');
  assert.equal(textoDeHabiles(cifra('En el día', '', true), cifra('En el día', '', true)), '');
  assert.equal(textoDeHabiles(cifra('3', 'días corridos'), cifra('En el día', '', true)), '(En el día, en días hábiles)');
  assert.equal(textoDeHabiles(null, cifra('53', 'días hábiles')), '');
  assert.equal(textoDeHabiles(cifra('83', 'días corridos'), null), '');
});
it('la hoja 1 es igual con los dos selectores', async () => {
  // Para mediana y promedio: las líneas de la hoja 1, sin el pie, con dias 'habiles' y 'corridos', deepEqual
});
it('la cifra grande va en corridos y debajo los hábiles, con el estadístico que se pidió', async () => {
  // Cada tramo con cifra de circuito_en_corridos: su `${texto}`, su unidad y, en la línea siguiente, textoDeHabiles
  // Debajo de «En el día» va «mediana en días corridos»
});
it('los hábiles van pegados a la cifra y el espacio va antes del estadístico', async () => {
  // Con textosPorHoja, por las bases (miden desde abajo): cifra.base - habiles.base < habiles.base - estadistico.base
});
it('la tarjeta mide lo mismo con la cifra y los hábiles juntos', () => { /* el alto del grupo = alto de la cifra + alto de los hábiles + 1 */ });
it('la solapa y la píldora dicen las dos unidades', async () => {
  // 'Mediana en días corridos y hábiles' dos veces, en cada solapa; 'Promedio en días corridos y hábiles'
  // textoDeLaPildora con las dos vistas: 'Mediana en días corridos y hábiles · con todos los datasets'
  // Con destildados: '… · calculado sin …'
});
it('sin una de las dos vistas no tira: lo elegido, sin paréntesis', async () => {
  // Borrando circuito_en_habiles, o circuito_en_corridos, con dias 'habiles': la cifra en hábiles, sin paréntesis
  // y la solapa 'Mediana en días hábiles'. Lo mismo con una foto sin 'mediana-corridos': circuitosDeLaFoto da null y el Informe sale
});
it('los en curso dicen los dos', async () => {
  // La línea con textoEnCursoDeLosDos(corrido.en_curso, habil.en_curso, 'mediana'), partida en renglones
  // La página no cambia: vista.circuito sigue con la frase de los días elegidos
});
it('con destildados, las dos vistas salen sin ellos', async () => {
  // pdfDeMetricas({ sin: '…' }): las cifras grandes y los paréntesis son los de vistaDe con ese sin en cada unidad
});
it('«Cómo se cuenta» dice lo del aviso', async () => {
  // La hoja 2 tiene, entera, 'Un tramo cuenta en el año en que terminó; el aviso, en el año de su vencimiento.', también en el Informe
});
```

En `tests/metricas-api.test.js`: el PDF no suma consultas a la base respecto de la API, y `metricasDe` no trae `circuito_en_corridos` ni `circuito_en_habiles`.

- [ ] **Paso 2: comprobá que fallan**

Run: `node --test tests/reportes-pdf.test.js tests/metricas-api.test.js`
Expected: FAIL.

- [ ] **Paso 3: implementá**

- `enVivo`: con `conCircuitos`, las dos vistas con los mismos `casos` y `sin`, sin importar `dias`; la de la unidad elegida no se calcula de nuevo.
- `metricasConOpciones` y el Informe: `circuitosDeLaFoto`, que no tira si falta una combinación.
- `etapaDe`: la cifra y los hábiles van en un solo grupo. `subir = letra.cifra * 0.2`, `alto = grande.alto + abajo.alto + 1`, los hábiles se dibujan en `y + grande.alto - subir`.
- Los en curso usan `textoEnCursoDeLosDos(t.en_curso, objeto(habil).en_curso, estadistico)`.
- Con `combinada` falso, todo como la vista elegida y sin hábiles.
- `EN_EL_ANIO = 'Un tramo cuenta en el año en que terminó; el aviso, en el año de su vencimiento.'`.
- `textoDeLaPildora` y la solapa dicen `días corridos y hábiles` con `combinada`, y lo elegido si no. `textoDeLaPildora` recibe los mismos `datos`, que ya traen las vistas.
- Borrá `textoDeCorridos` y `circuitoEnCorridosDeLaFoto`.
- El helper `metricasDeLosCasos` arma siempre las dos vistas, y `enHabilesConParentesis` usa cifras largas en la que va abajo.

- [ ] **Paso 4: tomá de nuevo la referencia y comprobá**

Run: `node --test tests/reportes-pdf.test.js tests/metricas-api.test.js tests/metricas-foto.test.js tests/reportes-frontend.test.js`
Expected: PASS. En el diff de texto cambia la hoja 1 y la frase de la hoja 2; las hojas 3 en adelante, nada.

- [ ] **Paso 5: commit**

`feat(metricas): la hoja 1 del PDF con los días corridos primero y la frase del aviso`

---

### Tarea 5: el cajón «Aviso anticipado» en el PDF (spec, 7)

**Modelo:** Opus (PDF).

**Files:**
- Modify: `services/reportesMetricasPdf.js` (`TEXTOS_DE_LA_PESTANA`, `etapaDe`; suma `cuerpoDeLaAnticipacion`)
- Test: `tests/reportes-pdf.test.js`

**Interfaces:**
- Consumes: `tramo.anticipacion_texto` (tarea 2), el grupo de la cifra y los hábiles (tarea 4).
- Produces: `TEXTOS_DE_LA_PESTANA.anticipacion = { desde: 'aviso', hasta: 'vencimiento' }`, que usa la tarea 6.

- [ ] **Paso 1: escribí los tests que fallan**

```js
it('el cajón: número, «de anticipación», hábiles, rótulos y estadístico', async () => {
  // Para cada gestión, en este orden, adentro del bloque de «Aviso anticipado»:
  // cifra.texto de la vista en corridos; 'días corridos de anticipación'; textoDeHabiles; 'aviso'; 'vencimiento'; cifra.debajo; (orientativo)
  // Y sin 'días corridos' suelto al lado del número, ni 'Del aviso al vencimiento'
});
it('el número tiene la letra de los otros cajones y queda a su altura', async () => {
  // textosPorHoja: el tamaño y la base de la cifra del aviso = los de la cifra de la etapa de al lado
});
it('la línea y los rótulos no se salen del cajón', async () => {
  // 'aviso' empieza donde empieza el texto de la etapa y 'vencimiento' termina donde termina
  // verificarDiagramacion(await diagramacion(...)) y ninguna línea fina de `lineas` adentro del cajón
});
it('sin anticipacion_texto, el cajón de siempre', async () => {
  // Con «En el día» (anticipacion_texto null) y sin cifra: lleva 'Del aviso al vencimiento', sin 'aviso' ni 'vencimiento' sueltos
  // Un aviso de 1 día: '1' y 'día corrido de anticipación'
});
it('con lo más largo: las dos gestiones juntas en la hoja 1', async () => {
  // conLoMasLargo, conLosPendientes y enHabilesConParentesis: 'GESTIÓN INTERNA' sigue en la primera hoja, nada termina en '…'
  // y verificarDiagramacion. En el Informe anual, lo mismo, de lo que guarda la foto
});
```

- [ ] **Paso 2: comprobá que fallan**

Run: `node --test tests/reportes-pdf.test.js`
Expected: FAIL.

- [ ] **Paso 3: implementá `cuerpoDeLaAnticipacion(doc, { tramo, cifra, habil, ancho, letra, tono, chico })` → `{ alto, dibujar(y, x) }`**

`etapaDe` la usa como cuerpo cuando `t.anticipacion_texto` es un texto.
- De arriba abajo: la cifra (`pieza`, con `letra.cifra`, mínimo `letra.cifraMin`, en `tono.tinta`); `anticipacion_texto` en `letra.unidad`, negrita, `COLOR.gris`, hasta 2 líneas; los hábiles, con el mismo grupo de la tarea 4; la línea; los rótulos; `cifra.debajo`; el orientativo.
- Medidas en una constante: `ANTICIPACION = { sobreLinea: 5, altoLinea: 12, punto: 2.8, aro: 3, grueso: 1.4 }`.
- La línea va en `tono.tinta`: `moveTo` y `lineTo`, con un punto lleno al empezar (`circle`) y un aro con fondo blanco al final. Sin `rect`.
- Los rótulos, en `letra.chico - 0.8`, color `COLOR.gris`; `aviso` a la izquierda y `vencimiento` a la derecha, medidos para terminar en el borde.
- Todo el alto se mide antes de dibujar, para que `LETRAS_DEL_CIRCUITO` elija el escalón.

- [ ] **Paso 4: tomá de nuevo la referencia y comprobá**

Run: `node --test tests/reportes-pdf.test.js`
Expected: PASS. El diff de texto muestra solo el cajón del aviso. Mirá la hoja 1 como imagen (`qlmanage -t -s 1500 -o <carpeta fuera del repo> <pdf>`), con lo más largo.

- [ ] **Paso 5: commit**

`feat(metricas): el cajón «Aviso anticipado» en el PDF de Métricas y el Informe anual`

---

### Tarea 6: el cajón «Aviso anticipado» en la página (spec, 7)

**Modelo:** Sonnet, esfuerzo alto: HTML y CSS, sin reglas; imprime lo del servidor. Revisión con Opus.

**Files:**
- Modify: `public/js/reportes.js` (`htmlDeFlecha`, las copias de los rótulos)
- Modify: `public/reportes.html` (`<style>`, `?v=`)
- Modify: `public/configuracion.html` (`feriados.js?v=`)
- Test: `tests/reportes-frontend.test.js`, `tests/paginas.test.js` (`VERSION_REPORTES` = `'20261211'` y `VERSION_FERIADOS` = `'20261212'`, con su comentario)

**Interfaces:**
- Consumes: `tramo.anticipacion_texto` (tarea 2), `TEXTOS_DE_LA_PESTANA.anticipacion` (tarea 5).
- Produces: las clases `anticipa` (en `.mt-flecha`), `mt-anticipa-frase`, `mt-anticipa-tramo`, `mt-anticipa-punto`, `mt-anticipa-linea`, `mt-anticipa-aro` y `mt-anticipa-pie`.

- [ ] **Paso 1: escribí los tests que fallan**

```js
it('htmlDeFlecha: el cajón del aviso con su frase y su línea', () => {
  const html = ctx.htmlDeFlecha({ ...tramo('aviso', 53, { ciclos: 32 }), anticipacion_texto: 'días hábiles de anticipación' });
  assert.match(html, /class="mt-flecha anticipa"/);
  assert.match(html, /<span class="n">53<\/span><span class="mt-anticipa-frase">días hábiles de anticipación<\/span><div class="mt-anticipa-tramo" aria-hidden="true">/);
  assert.match(html, /<div class="mt-anticipa-pie"><span>aviso<\/span><span>vencimiento<\/span><\/div><span class="u">mediana de 32 ciclos<\/span>/);
  assert.doesNotMatch(html, /<small>/);
  assert.doesNotMatch(html, /Del aviso al vencimiento/);
  assert.match(html, /<span class="t">Aviso anticipado<\/span>/);
  assert.match(html, /mt-resp/);
});
it('htmlDeFlecha: sin anticipacion_texto, el cajón de siempre', () => {
  // tramo('aviso', 27, …) sin el campo y con null: no lleva 'anticipa' y lleva <small> y desde_hasta. El tramo sin cifra, igual
});
it('htmlDeFlecha: escapa lo del servidor en el cajón', () => {
  // anticipacion_texto con '<b>': sale escapado
});
it('el orientativo sigue debajo del estadístico', () => { /* cifra.orientativo true: <span class="o"> después de <span class="u"> */ });
it('el CSS: la letra de los otros cajones y el alto contraste', () => {
  // reportes.html: .mt-anticipa-linea usa border-top (se ve con forced-colors), sin un font-size propio para .anticipa .n
});
// En 'reportes.js y el PDF de Métricas: los mismos textos': T.anticipacion.desde y .hasta están en la fuente de reportes.js
// Y el tramo real de vistaDe, con htmlDeFlecha, lleva su anticipacion_texto. El test de hoy de «Con la cifra real» pasa a otro tramo
```

- [ ] **Paso 2: comprobá que fallan**

Run: `node --test tests/reportes-frontend.test.js`
Expected: FAIL.

- [ ] **Paso 3: implementá**

- `htmlDeFlecha`, cuando `escaparTexto(tramo.anticipacion_texto)` no es vacío y hay cifra. Orden del HTML: `.n` (solo el número), `.mt-anticipa-frase`, `.mt-anticipa-tramo` (`aria-hidden`), `.mt-anticipa-pie` (el lector lo lee), `.u`, `.o`, `.t`, `.l` y `.mt-resp`.
- Copias `ANTICIPACION_DESDE = 'aviso'` y `ANTICIPACION_HASTA = 'vencimiento'`, atadas por el test de paridad.
- El CSS, en el `<style>` de `reportes.html`, con los tokens de hoy:
  - `.mt-anticipa-tramo { display: flex; align-items: center; margin-top: 10px; color: var(--sg-tinta); }`
  - `.mt-anticipa-punto`: 9 × 9 px, lleno. `.mt-anticipa-aro`: 11 × 11 px, con borde de 2 px y fondo `#F4F8FC`. `.mt-anticipa-linea`: `flex: 1; border-top: 2px solid currentColor`.
  - `.mt-anticipa-pie`: `display: flex; justify-content: space-between; font-size: 0.72rem; font-weight: 600; color: var(--sg-suave); margin-top: 3px`.
  - `.mt-anticipa-frase`: `font-size: 0.8rem; font-weight: 600; color: var(--sg-suave); margin-top: 3px`.
  - `.anticipa .u { margin-top: 8px; }`. `.mt-flecha .n` no se pisa: la cifra conserva su letra.
- `reportes.js?v=20261211` en `reportes.html`, `feriados.js?v=20261212` en `configuracion.html`, y las dos constantes.

- [ ] **Paso 4: comprobá**

Run: `node --test tests/reportes-frontend.test.js tests/paginas.test.js`
Expected: PASS.

- [ ] **Paso 5: commit**

`feat(metricas): el cajón «Aviso anticipado» en la página`

---

### Tarea 7: los documentos, la suite y la comparación con el dump (spec, 9 y 10)

**Modelo:** Opus: es la comprobación de todo.

**Files:**
- Modify: `docs/temas/metricas-y-reportes.md` (el aviso de la regla, `pendientes_texto`, «El PDF apaisado»: «Los días corridos», el cajón, `circuitosDeLaFoto`)
- Modify: `docs/temas/ciclo-de-vida.md` (`textos`, los extremos, el año anterior, «Cómo se cuenta», el rótulo)
- Modify: la spec, si la implementación tuvo que apartarse de algo y el usuario lo aprobó

- [ ] **Paso 1: actualizá los documentos**

Se escribe lo vigente, un renglón por oración, con el motivo de lo que alguien podría «arreglar» de buena fe: por qué un aviso anterior a la fecha de la regla no cuenta, por qué los extremos se eligen por hábiles y por qué la línea no es una escala. Sumá la spec a la lista de cada documento.

- [ ] **Paso 2: corré la suite completa**

Run: `npm test`
Expected: lo mismo que la línea de base, más los tests nuevos. `tests/documentos.test.js` en verde.

- [ ] **Paso 3: compará con `3a55679`, sobre el dump, fuera del repo**

Con `DB_NAME=datospublicos_mcr_rpad`, de solo lectura, y los scripts de `~/rpad-notas/auditoria-metricas-pdf/scripts/` si están:
- `metricasDe` en las cuatro combinaciones: cada diferencia explicada. Solo pueden ser el ciclo reprogramado, «de ciclos abiertos» y `anticipacion_texto`.
- Los PDF de Métricas y del Ciclo de vida: las mismas cifras, con lo nuevo de la spec.
- Estado general, Por área, Avisos, Agenda, Datos para completar, Seguimiento y anexo: idénticos por hoja.

Las cifras reales quedan fuera del repo: `~/rpad-notas/`.

- [ ] **Paso 4: mirá el resultado**

- La página en Firefox y en el panel, a 1320, 1120 y 961 píxeles y en el teléfono, sin desplazamiento horizontal, con las dos gestiones, los dos selectores de días y con alto contraste.
- Los PDF como imágenes, en las cuatro combinaciones, un año cerrado sin foto y una foto simulada.

- [ ] **Paso 5: commit y revisión de toda la rama**

`docs(metricas): la anticipación y los días corridos primero`

Después, la revisión de toda la rama, con Opus, contra la spec.

- [ ] **Paso 6: merge, push y kit**

Si todo da bien: merge en `main` y push, sin borrar la rama remota.
Kit contra `3a55679`, sin SQL, con Restart y fuera del horario de los crons (no entre las 8:05 y las 14:00):
`services/metricasReglas.js`, `services/reportesMetricasPdf.js`, `services/reportesCicloDeVidaPdf.js`, `services/reportesInformeAnualPdf.js`, `controllers/metricasController.js`, `controllers/reportesController.js`, `public/reportes.html`, `public/js/reportes.js` y `public/configuracion.html`.
Su `PASOS.txt` empieza comprobando `reportes.js?v=20261210`, `seguimiento.js?v=20261133` y `notas.js?v=20261205` en producción, y dice que tiene que estar antes del 10/01/2027.
Terminá con `TODO EN VERDE`.
